CREATE TABLE event_notification_states (
  notification_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  occurrence_key TEXT NOT NULL,
  acknowledged_at TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY(notification_id, account_id)
) STRICT;

CREATE INDEX idx_event_notification_states_account
ON event_notification_states(account_id, acknowledged_at, occurrence_key);

CREATE INDEX idx_event_notification_states_source
ON event_notification_states(source_type, source_id, occurrence_key);

CREATE UNIQUE INDEX idx_invitations_pending_email
ON invitations(email)
WHERE status='pending';

CREATE INDEX idx_invitations_status_created
ON invitations(status, created_at DESC);

UPDATE database_metadata
SET value='REVISION-060-B060-M13-MEMBERSHIP-COLLABORATION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
