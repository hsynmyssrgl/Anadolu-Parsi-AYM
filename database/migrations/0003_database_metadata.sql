CREATE TABLE database_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
INSERT INTO database_metadata(key,value,updated_at)
VALUES(
  'schema_generation',
  'REVISION-060-B060-M4',
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
);
