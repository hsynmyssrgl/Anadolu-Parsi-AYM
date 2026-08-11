CREATE TABLE trusted_devices (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  public_key_pem TEXT NOT NULL,
  trusted_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(account_id, device_id)
) STRICT;
CREATE INDEX idx_trusted_devices_account
ON trusted_devices(account_id, revoked_at, last_seen_at DESC);
UPDATE database_metadata
SET value='REVISION-060-B060-M11-TRUSTED-DEVICES',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
