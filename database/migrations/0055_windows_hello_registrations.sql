CREATE TABLE windows_hello_registrations (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL CHECK(length(trim(device_id)) BETWEEN 1 AND 200),
  device_fingerprint TEXT NOT NULL CHECK(length(trim(device_fingerprint)) BETWEEN 16 AND 512),
  windows_principal_hash TEXT NOT NULL CHECK(
    length(windows_principal_hash)=64
    AND windows_principal_hash NOT GLOB '*[^0-9a-f]*'
  ),
  display_name TEXT NOT NULL CHECK(length(trim(display_name)) BETWEEN 1 AND 120),
  security_epoch INTEGER NOT NULL CHECK(security_epoch BETWEEN 0 AND 2147483647),
  enrolled_at TEXT NOT NULL,
  last_verified_at TEXT,
  revoked_at TEXT,
  revocation_reason TEXT CHECK(
    revocation_reason IS NULL
    OR revocation_reason IN ('manual','reenrolled','device_changed','principal_changed','security_epoch_changed')
  ),
  created_at TEXT NOT NULL,
  CHECK(last_verified_at IS NULL OR last_verified_at>=enrolled_at),
  CHECK(revoked_at IS NULL OR revoked_at>=enrolled_at),
  CHECK(last_verified_at IS NULL OR revoked_at IS NULL OR last_verified_at<=revoked_at),
  CHECK(
    (revoked_at IS NULL AND revocation_reason IS NULL)
    OR (revoked_at IS NOT NULL AND revocation_reason IS NOT NULL)
  )
) STRICT;

CREATE UNIQUE INDEX ux_windows_hello_active_account_device
ON windows_hello_registrations(account_id,device_id)
WHERE revoked_at IS NULL;

CREATE INDEX idx_windows_hello_account_history
ON windows_hello_registrations(account_id,revoked_at,enrolled_at DESC,id DESC);

CREATE TRIGGER trg_windows_hello_registration_insert
BEFORE INSERT ON windows_hello_registrations
WHEN NOT EXISTS(
  SELECT 1 FROM accounts
  WHERE id=NEW.account_id AND status='active'
)
BEGIN
  SELECT RAISE(ABORT,'windows hello registration requires an active account');
END;

CREATE TRIGGER trg_windows_hello_registration_update
BEFORE UPDATE ON windows_hello_registrations
WHEN NEW.id<>OLD.id
  OR NEW.account_id<>OLD.account_id
  OR NEW.device_id<>OLD.device_id
  OR NEW.device_fingerprint<>OLD.device_fingerprint
  OR NEW.windows_principal_hash<>OLD.windows_principal_hash
  OR NEW.display_name<>OLD.display_name
  OR NEW.security_epoch<>OLD.security_epoch
  OR NEW.enrolled_at<>OLD.enrolled_at
  OR NEW.created_at<>OLD.created_at
  OR (OLD.last_verified_at IS NOT NULL AND NEW.last_verified_at IS NULL)
  OR (
    OLD.last_verified_at IS NOT NULL
    AND NEW.last_verified_at IS NOT NULL
    AND NEW.last_verified_at<OLD.last_verified_at
  )
  OR (
    OLD.revoked_at IS NOT NULL
    AND (
      NEW.revoked_at IS NOT OLD.revoked_at
      OR NEW.revocation_reason IS NOT OLD.revocation_reason
      OR NEW.last_verified_at IS NOT OLD.last_verified_at
    )
  )
  OR (NEW.revoked_at IS NULL AND NEW.revocation_reason IS NOT NULL)
  OR (NEW.revoked_at IS NOT NULL AND NEW.revocation_reason IS NULL)
BEGIN
  SELECT RAISE(ABORT,'invalid windows hello registration transition');
END;

UPDATE database_metadata
SET value='REVISION-30-K-B2-01-WINDOWS-HELLO-FOUNDATION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
