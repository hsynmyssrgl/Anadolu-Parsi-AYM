ALTER TABLE event_outbox ADD COLUMN processing_started_at TEXT;
CREATE INDEX idx_event_outbox_processing
ON event_outbox(status, processing_started_at);
UPDATE database_metadata
SET value='REVISION-060-B060-M5-DISPATCHER',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
