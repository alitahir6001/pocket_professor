BEGIN;

ALTER TABLE pilot_sessions
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pilot_sessions_user_active
  ON pilot_sessions (user_id, created_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS pilot_auth_attempts (
  email TEXT PRIMARY KEY,
  failure_count INTEGER NOT NULL DEFAULT 0,
  first_failure_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pilot_usage_events (
  event_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES pilot_users(user_id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  step TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pilot_usage_events_user_created
  ON pilot_usage_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pilot_usage_events_event
  ON pilot_usage_events (event_name, created_at DESC);

COMMIT;
