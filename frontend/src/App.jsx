import React, { useMemo, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const steps = [
  { id: 'login', label: 'Login' },
  { id: 'onboarding_agent', label: 'Onboarding Agent' },
  { id: 'professor_agent', label: 'Professor Agent' },
  { id: 'career_coach_agent', label: 'Career Coach Agent' },
  { id: 'review', label: 'Review + Feedback' },
];

async function api(path, method, body, token) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.detail || payload.error_code || 'Request failed');
  }
  return payload;
}

function toPrettyJson(value) {
  return JSON.stringify(value, null, 2);
}

export function App() {
  const [activeStep, setActiveStep] = useState('login');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [session, setSession] = useState(() => {
    const primary = sessionStorage.getItem('pilot_session_token');
    if (primary) return primary;
    const legacy = localStorage.getItem('pilot_session_token');
    if (legacy) {
      localStorage.removeItem('pilot_session_token');
      sessionStorage.setItem('pilot_session_token', legacy);
      return legacy;
    }
    return '';
  });
  const [lastMessage, setLastMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [plainInputs, setPlainInputs] = useState({
    onboarding_agent: {
      current_role: 'Bartender',
      target_role: 'Commercial pilot',
      schedule_constraints: 'shift-work',
      energy_level: 'medium',
      weekly_hours_available: 6,
      session_note: 'I am a bartender who wants to become a pilot.',
    },
    professor_agent: {
      current_topic: 'Aviation basics',
      confidence_level: 'beginner',
      time_available_minutes: 30,
      blocker_note: '',
      session_note: 'Help me pick the best next learning step.',
    },
    career_coach_agent: {
      current_role: 'Bartender',
      target_role: 'Commercial pilot',
      confidence_level: 'medium',
      urgency_level: 'normal',
      session_note: 'I want a realistic transition plan.',
    },
  });

  const [advancedJson, setAdvancedJson] = useState({
    onboarding_agent: '',
    professor_agent: '',
    career_coach_agent: '',
  });

  const [outputs, setOutputs] = useState({});
  const [feedbackHelpful, setFeedbackHelpful] = useState({});
  const [feedbackComment, setFeedbackComment] = useState({});

  const currentStepIndex = useMemo(() => steps.findIndex((s) => s.id === activeStep), [activeStep]);
  const canAccessFlow = !!session;

  function buildAgentInput(agentType) {
    const advancedRaw = (advancedJson[agentType] || '').trim();
    if (advancedRaw.length > 0) {
      return JSON.parse(advancedRaw);
    }
    return {
      ...plainInputs[agentType],
      agent_type: agentType,
      source: 'pilot_form',
    };
  }

  function updatePlainInput(agentType, key, value) {
    setPlainInputs((prev) => ({
      ...prev,
      [agentType]: {
        ...prev[agentType],
        [key]: value,
      },
    }));
  }

  async function requestCode() {
    setLoading(true);
    try {
      const out = await api('/pilot/auth/email/request', 'POST', { email });
      setLastMessage(out.dev_code ? `Code generated (dev fallback): ${out.dev_code}` : 'Check your email for your login code.');
    } catch (error) {
      setLastMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    setLoading(true);
    try {
      const out = await api('/pilot/auth/email/verify', 'POST', { email, code });
      sessionStorage.setItem('pilot_session_token', out.session_token);
      setSession(out.session_token);
      setLastMessage(`Logged in as ${out.user.email}`);
      setActiveStep('onboarding_agent');
    } catch (error) {
      setLastMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function runAgent(agentType) {
    setLoading(true);
    try {
      const input = buildAgentInput(agentType);
      const out = await api(`/pilot/agents/${agentType}/run`, 'POST', { input }, session);
      setOutputs((prev) => ({ ...prev, [agentType]: out }));
      setLastMessage(`${agentType} completed.`);
      const next = steps[currentStepIndex + 1];
      if (next) setActiveStep(next.id);
    } catch (error) {
      setLastMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitFeedback(component, interactionId = null) {
    setLoading(true);
    try {
      await api('/pilot/feedback', 'POST', {
        component,
        interaction_id: interactionId,
        helpful: feedbackHelpful[component] ?? null,
        comment: feedbackComment[component] || '',
      }, session);
      setLastMessage(`Feedback saved for ${component}.`);
    } catch (error) {
      setLastMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      if (session) {
        await api('/pilot/auth/logout', 'POST', {}, session);
      }
    } catch (_error) {
      // local session cleanup proceeds even if server logout call fails
    } finally {
      sessionStorage.removeItem('pilot_session_token');
      localStorage.removeItem('pilot_session_token');
      setSession('');
      setActiveStep('login');
    }
  }

  return (
    <div className="container">
      <h1>Pocket Professor Pilot Wizard</h1>
      <p className="small">API Base: {API_BASE || '(set VITE_API_BASE_URL)'}</p>

      <div className="stepper">
        {steps.map((step, idx) => (
          <span key={step.id} className={`badge ${step.id === activeStep ? 'active' : ''}`}>
            {idx + 1}. {step.label}
          </span>
        ))}
      </div>

      {activeStep === 'login' && (
        <div className="card">
          <h2>Email Login</h2>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <button onClick={requestCode} disabled={loading || !email}>Send login code</button>
          <label>Code</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" />
          <button onClick={verifyCode} disabled={loading || !email || !code}>Verify + Continue</button>
        </div>
      )}

      {canAccessFlow && activeStep === 'onboarding_agent' && (
        <div className="card">
          <h2>Onboarding Agent</h2>
          <p className="small">Fill this form in plain English — no JSON required.</p>
          <label>Current role</label>
          <input value={plainInputs.onboarding_agent.current_role} onChange={(e) => updatePlainInput('onboarding_agent', 'current_role', e.target.value)} />
          <label>Target role</label>
          <input value={plainInputs.onboarding_agent.target_role} onChange={(e) => updatePlainInput('onboarding_agent', 'target_role', e.target.value)} />
          <label>Schedule</label>
          <select value={plainInputs.onboarding_agent.schedule_constraints} onChange={(e) => updatePlainInput('onboarding_agent', 'schedule_constraints', e.target.value)}>
            <option value="shift-work">Shift work</option>
            <option value="fixed-hours">Fixed hours</option>
            <option value="mixed">Mixed</option>
          </select>
          <label>Energy level</label>
          <select value={plainInputs.onboarding_agent.energy_level} onChange={(e) => updatePlainInput('onboarding_agent', 'energy_level', e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <label>Weekly hours available</label>
          <input type="number" min="1" max="40" value={plainInputs.onboarding_agent.weekly_hours_available} onChange={(e) => updatePlainInput('onboarding_agent', 'weekly_hours_available', Number(e.target.value) || 1)} />
          <label>Anything else we should know?</label>
          <textarea rows={4} value={plainInputs.onboarding_agent.session_note} onChange={(e) => updatePlainInput('onboarding_agent', 'session_note', e.target.value)} />
          <details>
            <summary>Advanced: override with raw JSON</summary>
            <textarea rows={8} value={advancedJson.onboarding_agent} onChange={(e) => setAdvancedJson((prev) => ({ ...prev, onboarding_agent: e.target.value }))} placeholder={toPrettyJson(buildAgentInput('onboarding_agent'))} />
          </details>
          <button onClick={() => runAgent('onboarding_agent')} disabled={loading}>Run onboarding_agent</button>

          {outputs.onboarding_agent && (
            <>
              <h3>Output</h3>
              <pre>{toPrettyJson(outputs.onboarding_agent)}</pre>
              <div className="row">
                <select value={feedbackHelpful.onboarding_agent ?? ''} onChange={(e) => setFeedbackHelpful((prev) => ({ ...prev, onboarding_agent: e.target.value === '' ? null : e.target.value === 'true' }))}>
                  <option value="">Was this helpful?</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
                <input placeholder="Optional comment" value={feedbackComment.onboarding_agent || ''} onChange={(e) => setFeedbackComment((prev) => ({ ...prev, onboarding_agent: e.target.value }))} />
              </div>
              <button className="secondary" onClick={() => submitFeedback('onboarding_agent', outputs.onboarding_agent.interaction_id)} disabled={loading}>Save feedback</button>
            </>
          )}
        </div>
      )}

      {canAccessFlow && ['professor_agent', 'career_coach_agent'].includes(activeStep) && (
        <div className="card">
          <h2>{steps[currentStepIndex]?.label}</h2>
          <p className="small">Use plain-language fields below. JSON is optional.</p>
          <label>Session note</label>
          <textarea rows={4} value={plainInputs[activeStep].session_note} onChange={(e) => updatePlainInput(activeStep, 'session_note', e.target.value)} />
          <details>
            <summary>Advanced: override with raw JSON</summary>
            <textarea rows={10} value={advancedJson[activeStep]} onChange={(e) => setAdvancedJson((prev) => ({ ...prev, [activeStep]: e.target.value }))} placeholder={toPrettyJson(buildAgentInput(activeStep))} />
          </details>
          <button onClick={() => runAgent(activeStep)} disabled={loading}>Run {activeStep}</button>

          {outputs[activeStep] && (
            <>
              <h3>Output</h3>
              <pre>{toPrettyJson(outputs[activeStep])}</pre>
              <div className="row">
                <select value={feedbackHelpful[activeStep] ?? ''} onChange={(e) => setFeedbackHelpful((prev) => ({ ...prev, [activeStep]: e.target.value === '' ? null : e.target.value === 'true' }))}>
                  <option value="">Was this helpful?</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
                <input placeholder="Optional comment" value={feedbackComment[activeStep] || ''} onChange={(e) => setFeedbackComment((prev) => ({ ...prev, [activeStep]: e.target.value }))} />
              </div>
              <button className="secondary" onClick={() => submitFeedback(activeStep, outputs[activeStep].interaction_id)} disabled={loading}>Save feedback</button>
            </>
          )}
        </div>
      )}

      {canAccessFlow && activeStep === 'review' && (
        <div className="card">
          <h2>Review + Global Feedback</h2>
          <p>All agent outputs collected in this session:</p>
          <pre>{toPrettyJson(outputs)}</pre>
          <div className="row">
            <select value={feedbackHelpful.review ?? ''} onChange={(e) => setFeedbackHelpful((prev) => ({ ...prev, review: e.target.value === '' ? null : e.target.value === 'true' }))}>
              <option value="">Overall: was this helpful?</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
            <input placeholder="Overall feedback" value={feedbackComment.review || ''} onChange={(e) => setFeedbackComment((prev) => ({ ...prev, review: e.target.value }))} />
          </div>
          <button onClick={() => submitFeedback('wizard_overall', null)} disabled={loading}>Submit overall feedback</button>
          <button className="secondary" onClick={logout}>Log out</button>
        </div>
      )}

      {lastMessage && <div className="card"><strong>Status:</strong> {lastMessage}</div>}
    </div>
  );
}
