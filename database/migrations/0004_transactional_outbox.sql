CREATE TABLE event_outbox (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  headers_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  available_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','processing','published','failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT
) STRICT;
CREATE INDEX idx_event_outbox_pending ON event_outbox(status, available_at, occurred_at);
CREATE INDEX idx_event_outbox_aggregate ON event_outbox(aggregate_type, aggregate_id, occurred_at);
CREATE TABLE event_handler_receipts (
  event_id TEXT NOT NULL REFERENCES event_outbox(id) ON DELETE CASCADE,
  handler_name TEXT NOT NULL,
  handled_at TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('success','failure')),
  error_code TEXT,
  PRIMARY KEY(event_id, handler_name)
) STRICT;
UPDATE database_metadata
SET value='REVISION-060-B060-M5', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
