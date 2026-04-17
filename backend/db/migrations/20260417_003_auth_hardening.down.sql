BEGIN;

DROP INDEX IF EXISTS idx_pilot_usage_events_event;
DROP INDEX IF EXISTS idx_pilot_usage_events_user_created;
DROP TABLE IF EXISTS pilot_usage_events;

DROP TABLE IF EXISTS pilot_auth_attempts;

DROP INDEX IF EXISTS idx_pilot_sessions_user_active;
ALTER TABLE pilot_sessions
  DROP COLUMN IF EXISTS revoked_at;

COMMIT;
