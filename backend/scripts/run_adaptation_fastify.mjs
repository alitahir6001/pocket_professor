import Fastify from 'fastify';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAdaptationHttpRoute } from '../dist/src/modules/adaptation/phase3/adaptationFrameworkBindings.js';
import { classifyAdaptationError } from '../dist/src/modules/adaptation/phase3/adaptationObservability.js';
import { validateAgentOutput } from '../dist/src/modules/agents/phase2/validation/agentOutputGuard.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const port = Number(process.env.ADAPTATION_PORT || 3040);
const host = process.env.ADAPTATION_HOST || '127.0.0.1';
const persistenceMode = process.env.ADAPTATION_PERSISTENCE_MODE === 'postgres' ? 'postgres' : 'file';
const auditFilePath = process.env.ADAPTATION_AUDIT_FILE || './data/adaptation-evaluations.json';
const databaseUrl = process.env.ADAPTATION_DATABASE_URL || process.env.DATABASE_URL || '';
const frontendOrigin = process.env.FRONTEND_ORIGIN || '*';
const sessionTtlHours = Number(process.env.PILOT_SESSION_TTL_HOURS || '24');
const loginCodeTtlMinutes = Number(process.env.PILOT_LOGIN_CODE_TTL_MINUTES || '15');
const authMaxFailures = Number(process.env.PILOT_AUTH_MAX_FAILURES || '5');
const authLockMinutes = Number(process.env.PILOT_AUTH_LOCK_MINUTES || '15');
const authWindowMinutes = Number(process.env.PILOT_AUTH_WINDOW_MINUTES || '30');
const authRequestCooldownSeconds = Number(process.env.PILOT_AUTH_REQUEST_COOLDOWN_SECONDS || '60');
const enableDevCodeResponse = process.env.PILOT_ALLOW_DEV_CODE === 'true';

const llmProvider = process.env.LLM_PROVIDER || 'openai';
const llmBaseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
const llmApiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
const llmModel = process.env.LLM_MODEL || 'gpt-4.1-mini';

if (databaseUrl.length < 1) {
  throw new Error('ADAPTATION_DATABASE_URL or DATABASE_URL is required for pilot runtime.');
}

const postgresPool = new (await import('pg')).Pool({ connectionString: databaseUrl });

const app = Fastify({ logger: true, bodyLimit: 256 * 1024 });

app.addHook('onRequest', async (request, reply) => {
  const contentType = request.headers['content-type'];
  if (typeof contentType === 'string' && contentType.includes('\t')) {
    return reply.code(400).send({ ok: false, error_code: 'BAD_REQUEST', detail: 'Invalid Content-Type header.' });
  }
});

app.addHook('onSend', async (_request, reply) => {
  reply.header('access-control-allow-origin', frontendOrigin);
  reply.header('access-control-allow-methods', 'GET,POST,OPTIONS');
  reply.header('access-control-allow-headers', 'content-type,authorization,x-request-id');
});

app.options('/*', async (_request, reply) => reply.code(204).send());
app.addHook('onClose', async () => { await postgresPool.end(); });

app.setErrorHandler((error, request, reply) => {
  const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 500
    ? error.statusCode
    : 500;
  const errorCode = statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST';
  const detail = statusCode >= 500 ? 'Internal runtime error.' : (error.message || 'Invalid request payload.');

  request.log.warn(
    { err: error, errorCode, diagnosticCode: classifyAdaptationError(error), statusCode, requestId: request.id },
    'Pilot API rejected request',
  );
  reply.code(statusCode).send({ ok: false, error_code: errorCode, detail });
});

const AGENT_TYPES = ['onboarding_agent', 'professor_agent', 'career_coach_agent'];

function sha(value) {
  return createHash('sha256').update(value).digest('hex');
}

function safeHashEquals(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function randomCode() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function parseBearer(authHeader) {
  if (typeof authHeader !== 'string') return '';
  const [scheme, token] = authHeader.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : '';
}

function toIsoAfterMinutes(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

async function getAuthLockState(email) {
  const out = await postgresPool.query(
    `SELECT failure_count, first_failure_at, locked_until
     FROM pilot_auth_attempts
     WHERE email = $1
     LIMIT 1`,
    [email],
  );
  return out.rows?.[0] || null;
}

async function clearAuthFailures(email) {
  await postgresPool.query('DELETE FROM pilot_auth_attempts WHERE email = $1', [email]);
}

async function registerAuthFailure(email) {
  const now = new Date();
  const current = await getAuthLockState(email);

  if (!current) {
    await postgresPool.query(
      `INSERT INTO pilot_auth_attempts (email, failure_count, first_failure_at, updated_at)
       VALUES ($1, 1, NOW(), NOW())`,
      [email],
    );
    return;
  }

  const firstFailureAtMs = current.first_failure_at ? Date.parse(current.first_failure_at) : now.getTime();
  const windowExceeded = now.getTime() - firstFailureAtMs > authWindowMinutes * 60 * 1000;
  const nextFailureCount = windowExceeded ? 1 : Number(current.failure_count || 0) + 1;
  const shouldLock = nextFailureCount >= authMaxFailures;
  const lockUntil = shouldLock ? toIsoAfterMinutes(authLockMinutes) : null;

  await postgresPool.query(
    `UPDATE pilot_auth_attempts
     SET failure_count = $2,
         first_failure_at = CASE WHEN $3 THEN NOW() ELSE first_failure_at END,
         locked_until = $4::timestamptz,
         updated_at = NOW()
     WHERE email = $1`,
    [email, nextFailureCount, windowExceeded, lockUntil],
  );
}

async function recordUsageEvent({ userId, eventName, step = null, metadata = {} }) {
  if (!userId || !eventName) return;
  try {
    await postgresPool.query(
      `INSERT INTO pilot_usage_events (event_id, user_id, event_name, step, metadata_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [`evt_${randomUUID()}`, userId, eventName, step, JSON.stringify(metadata)],
    );
  } catch (error) {
    app.log.warn({ err: error, userId, eventName }, 'Failed to record usage event');
  }
}

async function ensurePilotUser(email) {
  const existing = await postgresPool.query('SELECT user_id FROM pilot_users WHERE email = $1 LIMIT 1', [email]);
  const existingUserId = existing.rows?.[0]?.user_id;
  if (typeof existingUserId === 'string') return existingUserId;

  const userId = `user_${randomUUID()}`;
  await postgresPool.query('INSERT INTO pilot_users (user_id, email) VALUES ($1, $2)', [userId, email]);
  return userId;
}

function agentFiles(agentType) {
  return {
    onboarding_agent: {
      example: '../src/modules/agents/phase2/onboarding-agent/example_output.json',
      instructions: '../src/modules/agents/phase2/onboarding-agent/system_instructions.md',
    },
    professor_agent: {
      example: '../src/modules/agents/phase2/professor-agent/example_output.json',
      instructions: '../src/modules/agents/phase2/professor-agent/system_instructions.md',
    },
    career_coach_agent: {
      example: '../src/modules/agents/phase2/career-coach-agent/example_output.json',
      instructions: '../src/modules/agents/phase2/career-coach-agent/system_instructions.md',
    },
  }[agentType];
}

async function loadAgentExample(agentType) {
  const files = agentFiles(agentType);
  if (!files) throw new Error('Unknown agent type');
  return JSON.parse(await readFile(join(__dirname, files.example), 'utf8'));
}

async function loadAgentInstructions(agentType) {
  const files = agentFiles(agentType);
  if (!files) throw new Error('Unknown agent type');
  return readFile(join(__dirname, files.instructions), 'utf8');
}

async function callOpenAILLM({ agentType, input, fallbackTemplate, userId }) {
  if (!llmApiKey) return null;
  if (llmProvider !== 'openai') return null;

  const instructions = await loadAgentInstructions(agentType);
  const prompt = [
    'You are generating strict JSON only for a pilot product.',
    'Follow these instructions exactly:',
    instructions,
    `Agent type: ${agentType}`,
    `User ID: ${userId}`,
    `Input JSON: ${JSON.stringify(input)}`,
    `Output JSON must match the same shape as this example: ${JSON.stringify(fallbackTemplate)}`,
    'Return only valid JSON and no markdown.',
  ].join('\n\n');

  const response = await fetch(`${llmBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${llmApiKey}`,
    },
    body: JSON.stringify({
      model: llmModel,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Return strict JSON only.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LLM request failed: ${detail}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') return null;

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function generateAgentOutput({ agentType, input, userId }) {
  const template = await loadAgentExample(agentType);
  try {
    const llmOutput = await callOpenAILLM({ agentType, input, fallbackTemplate: template, userId });
    if (llmOutput) {
      const guard = validateAgentOutput(agentType, llmOutput);
      if (guard.ok) {
        return {
          output: { ...llmOutput, generated_at: new Date().toISOString(), generated_for_user: userId },
          source: 'llm',
          guard: { ok: true },
        };
      }

      app.log.warn({ agentType, reason: guard.reason, detail: guard.detail }, 'LLM output failed guard; falling back to template');
      return {
        output: { ...template, generated_at: new Date().toISOString(), generated_for_user: userId, fallback_reason: guard.reason },
        source: 'template_fallback',
        guard,
      };
    }
  } catch (error) {
    app.log.warn({ err: error, agentType }, 'LLM generation failed; falling back to template');
  }

  return {
    output: { ...template, generated_at: new Date().toISOString(), generated_for_user: userId, fallback_reason: 'LLM_UNAVAILABLE' },
    source: 'template_fallback',
    guard: { ok: true },
  };
}

async function requireSession(request) {
  const token = parseBearer(request.headers.authorization);
  if (!token) throw Object.assign(new Error('Missing authorization token.'), { statusCode: 401 });

  const out = await postgresPool.query(
    `SELECT s.session_id, s.user_id, u.email
     FROM pilot_sessions s
     JOIN pilot_users u ON u.user_id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW() AND s.revoked_at IS NULL
     LIMIT 1`,
    [sha(token)],
  );

  const row = out.rows?.[0];
  if (!row?.user_id) throw Object.assign(new Error('Invalid or expired session.'), { statusCode: 401 });

  await postgresPool.query('UPDATE pilot_sessions SET last_seen_at = NOW() WHERE session_id = $1', [row.session_id]);
  return { user_id: row.user_id, email: row.email, session_id: row.session_id };
}

async function sendLoginCodeEmail(email, code) {
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const resendFrom = process.env.RESEND_FROM_EMAIL || '';

  if (!resendApiKey || !resendFrom) {
    app.log.warn({ email, code }, 'RESEND not configured; login code emitted to logs for pilot bootstrap');
    return { delivered: false, mode: 'log_only' };
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${resendApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [email],
      subject: 'Pocket Professor pilot login code',
      text: `Your login code is ${code}. It expires in ${loginCodeTtlMinutes} minutes.`,
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`Failed to deliver login code email: ${detail}`);
  }

  return { delivered: true, mode: 'resend' };
}

app.get('/adaptation/health', async () => ({
  ok: true,
  service: 'adaptation_runtime',
  persistence_mode: persistenceMode,
  audit_file_path: persistenceMode === 'file' ? auditFilePath : undefined,
  database_configured: databaseUrl.length > 0,
  pilot_auth_enabled: true,
  llm_configured: Boolean(llmApiKey),
  llm_provider: llmProvider,
  llm_model: llmModel,
}));

app.post('/adaptation/evaluate', async (request, reply) => {
  const requestId = (typeof request.headers['x-request-id'] === 'string' && request.headers['x-request-id'].length > 0)
    ? request.headers['x-request-id']
    : randomUUID();

  const response = await handleAdaptationHttpRoute({ body: request.body }, { persistenceMode, auditFilePath, postgresPool });

  if (response.status >= 400) {
    request.log.warn({ status: response.status, error: response.json, requestId }, 'Adaptation evaluation failed closed');
  } else {
    request.log.info({ evaluation_id: response.json.evaluation_id, requestId }, 'Adaptation evaluation completed');
  }

  return reply.code(response.status).send(response.json);
});

app.post('/pilot/auth/email/request', async (request) => {
  const email = normalizeEmail(request.body?.email);
  if (!email || !email.includes('@')) throw Object.assign(new Error('Valid email is required.'), { statusCode: 400 });

  const cooldownOut = await postgresPool.query(
    `SELECT created_at
     FROM pilot_login_codes
     WHERE email = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [email],
  );
  const latestCreatedAt = cooldownOut.rows?.[0]?.created_at ? Date.parse(cooldownOut.rows[0].created_at) : null;
  if (latestCreatedAt && Date.now() - latestCreatedAt < authRequestCooldownSeconds * 1000) {
    throw Object.assign(new Error(`Please wait ${authRequestCooldownSeconds} seconds before requesting another code.`), { statusCode: 429 });
  }

  const code = randomCode();
  const codeId = `code_${randomUUID()}`;
  const expiresAt = toIsoAfterMinutes(loginCodeTtlMinutes);

  await postgresPool.query(
    `UPDATE pilot_login_codes
     SET used_at = NOW()
     WHERE email = $1 AND used_at IS NULL`,
    [email],
  );

  await postgresPool.query(
    `INSERT INTO pilot_login_codes (code_id, email, code_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [codeId, email, sha(code), expiresAt],
  );

  const delivery = await sendLoginCodeEmail(email, code);
  return { ok: true, email, delivery, expires_at: expiresAt, dev_code: enableDevCodeResponse && !delivery.delivered ? code : undefined };
});

app.post('/pilot/auth/email/verify', async (request) => {
  const email = normalizeEmail(request.body?.email);
  const code = String(request.body?.code || '').trim();
  if (!email || !code) throw Object.assign(new Error('email and code are required.'), { statusCode: 400 });

  const lockState = await getAuthLockState(email);
  if (lockState?.locked_until && Date.parse(lockState.locked_until) > Date.now()) {
    throw Object.assign(new Error('Too many failed attempts. Try again later.'), { statusCode: 429 });
  }

  const out = await postgresPool.query(
    `SELECT code_id, code_hash
     FROM pilot_login_codes
     WHERE email = $1 AND expires_at > NOW() AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [email],
  );

  const codeRow = out.rows?.[0] || null;
  if (!codeRow?.code_id || !codeRow?.code_hash) {
    await registerAuthFailure(email);
    throw Object.assign(new Error('Invalid or expired login code.'), { statusCode: 401 });
  }

  if (!safeHashEquals(sha(code), codeRow.code_hash)) {
    await registerAuthFailure(email);
    throw Object.assign(new Error('Invalid or expired login code.'), { statusCode: 401 });
  }

  await postgresPool.query('UPDATE pilot_login_codes SET used_at = NOW() WHERE code_id = $1', [codeRow.code_id]);
  await clearAuthFailures(email);
  const userId = await ensurePilotUser(email);
  await postgresPool.query('UPDATE pilot_users SET last_login_at = NOW() WHERE user_id = $1', [userId]);

  const sessionToken = `sess_${randomUUID()}`;
  const sessionId = `psess_${randomUUID()}`;
  const expiresAt = new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000).toISOString();

  await postgresPool.query(
    `INSERT INTO pilot_sessions (session_id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [sessionId, userId, sha(sessionToken), expiresAt],
  );

  await recordUsageEvent({ userId, eventName: 'auth_login_success', step: 'login', metadata: { email } });
  return { ok: true, session_token: sessionToken, expires_at: expiresAt, user: { user_id: userId, email } };
});

app.get('/pilot/me', async (request) => {
  const session = await requireSession(request);
  return { ok: true, user: { user_id: session.user_id, email: session.email } };
});

app.post('/pilot/auth/logout', async (request) => {
  const session = await requireSession(request);
  await postgresPool.query(
    `UPDATE pilot_sessions
     SET revoked_at = NOW()
     WHERE session_id = $1`,
    [session.session_id],
  );
  await recordUsageEvent({ userId: session.user_id, eventName: 'auth_logout', step: 'logout' });
  return { ok: true };
});

app.post('/pilot/agents/:agentType/run', async (request) => {
  const session = await requireSession(request);
  const agentType = String(request.params.agentType || '');
  if (!AGENT_TYPES.includes(agentType)) throw Object.assign(new Error('Unsupported agent type.'), { statusCode: 400 });

  const input = request.body?.input && typeof request.body.input === 'object' ? request.body.input : {};
  const generation = await generateAgentOutput({ agentType, input, userId: session.user_id });

  const interactionId = `ia_${randomUUID()}`;
  await postgresPool.query(
    `INSERT INTO pilot_agent_interactions (interaction_id, user_id, agent_type, input_json, output_json)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
    [interactionId, session.user_id, agentType, JSON.stringify(input), JSON.stringify(generation.output)],
  );

  await recordUsageEvent({
    userId: session.user_id,
    eventName: 'agent_run',
    step: agentType,
    metadata: { interaction_id: interactionId, source: generation.source },
  });

  return {
    ok: true,
    interaction_id: interactionId,
    agent_type: agentType,
    output: generation.output,
    source: generation.source,
    guard: generation.guard,
  };
});

app.post('/pilot/feedback', async (request) => {
  const session = await requireSession(request);
  const component = String(request.body?.component || '').trim();
  const helpful = typeof request.body?.helpful === 'boolean' ? request.body.helpful : null;
  const comment = typeof request.body?.comment === 'string' ? request.body.comment.slice(0, 1000) : null;
  const interactionId = typeof request.body?.interaction_id === 'string' ? request.body.interaction_id : null;
  const metadata = request.body?.metadata && typeof request.body.metadata === 'object' ? request.body.metadata : {};

  if (!component) throw Object.assign(new Error('component is required.'), { statusCode: 400 });

  const feedbackId = `fb_${randomUUID()}`;
  await postgresPool.query(
    `INSERT INTO pilot_feedback_events (feedback_id, user_id, component, helpful, comment, metadata_json)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [feedbackId, session.user_id, component, helpful, comment, JSON.stringify({ ...metadata, interaction_id: interactionId })],
  );

  if (interactionId && helpful !== null) {
    await postgresPool.query(
      `UPDATE pilot_agent_interactions
       SET helpful = $1, feedback_comment = COALESCE($2, feedback_comment)
       WHERE interaction_id = $3 AND user_id = $4`,
      [helpful, comment, interactionId, session.user_id],
    );
  }

  await recordUsageEvent({ userId: session.user_id, eventName: 'feedback_submitted', step: component, metadata: { helpful } });
  return { ok: true, feedback_id: feedbackId };
});

app.post('/pilot/usage', async (request) => {
  const session = await requireSession(request);
  const eventName = String(request.body?.event_name || '').trim();
  const step = typeof request.body?.step === 'string' ? request.body.step : null;
  const metadata = request.body?.metadata && typeof request.body.metadata === 'object' ? request.body.metadata : {};

  if (!eventName) throw Object.assign(new Error('event_name is required.'), { statusCode: 400 });
  await recordUsageEvent({ userId: session.user_id, eventName, step, metadata });
  return { ok: true };
});

app.get('/pilot/metrics/summary', async (request) => {
  const session = await requireSession(request);

  const usageOut = await postgresPool.query(
    `SELECT event_name, COUNT(*)::int AS count
     FROM pilot_usage_events
     WHERE user_id = $1
     GROUP BY event_name
     ORDER BY count DESC`,
    [session.user_id],
  );

  const feedbackOut = await postgresPool.query(
    `SELECT component,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE helpful IS TRUE)::int AS helpful_yes,
            COUNT(*) FILTER (WHERE helpful IS FALSE)::int AS helpful_no
     FROM pilot_feedback_events
     WHERE user_id = $1
     GROUP BY component
     ORDER BY component`,
    [session.user_id],
  );

  return { ok: true, usage: usageOut.rows || [], feedback: feedbackOut.rows || [] };
});

app.get('/pilot/interactions', async (request) => {
  const session = await requireSession(request);
  const out = await postgresPool.query(
    `SELECT interaction_id, agent_type, input_json, output_json, helpful, feedback_comment, created_at
     FROM pilot_agent_interactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [session.user_id],
  );

  return { ok: true, items: out.rows || [] };
});

try {
  await app.listen({ port, host });
  app.log.info(
    {
      persistenceMode,
      frontendOrigin,
      llmConfigured: Boolean(llmApiKey),
      llmProvider,
      llmModel,
    },
    `Pilot runtime listening at http://${host}:${port}`,
  );
} catch (error) {
  app.log.error({ err: error, diagnosticCode: classifyAdaptationError(error) }, 'Pilot runtime failed to start');
  process.exit(1);
}
