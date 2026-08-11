ALTER TABLE invitations
ADD COLUMN revoked_at TEXT;

ALTER TABLE invitations
ADD COLUMN revocation_reason TEXT
CHECK(revocation_reason IS NULL OR revocation_reason IN ('manual','resent'));

ALTER TABLE invitations
ADD COLUMN resent_from_invitation_id TEXT REFERENCES invitations(id) ON DELETE RESTRICT;

ALTER TABLE invitations
ADD COLUMN superseded_by_invitation_id TEXT REFERENCES invitations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE UNIQUE INDEX idx_invitations_resent_from
ON invitations(resent_from_invitation_id)
WHERE resent_from_invitation_id IS NOT NULL;

CREATE UNIQUE INDEX idx_invitations_superseded_by
ON invitations(superseded_by_invitation_id)
WHERE superseded_by_invitation_id IS NOT NULL;

CREATE TRIGGER trg_invitations_lifecycle_insert
BEFORE INSERT ON invitations
WHEN (NEW.status='accepted' AND NEW.accepted_at IS NULL)
  OR (NEW.status='revoked' AND (NEW.revoked_at IS NULL OR NEW.revocation_reason IS NULL))
  OR (NEW.status<>'revoked' AND (NEW.revoked_at IS NOT NULL OR NEW.revocation_reason IS NOT NULL OR NEW.superseded_by_invitation_id IS NOT NULL))
BEGIN
  SELECT RAISE(ABORT,'invalid invitation lifecycle state');
END;

CREATE TRIGGER trg_invitations_lifecycle_update
BEFORE UPDATE OF status,accepted_at,revoked_at,revocation_reason,resent_from_invitation_id,superseded_by_invitation_id
ON invitations
WHEN (NEW.status='accepted' AND NEW.accepted_at IS NULL)
  OR (NEW.status='revoked' AND (NEW.revoked_at IS NULL OR NEW.revocation_reason IS NULL))
  OR (NEW.status<>'revoked' AND (NEW.revoked_at IS NOT NULL OR NEW.revocation_reason IS NOT NULL OR NEW.superseded_by_invitation_id IS NOT NULL))
  OR (NEW.resent_from_invitation_id=NEW.id)
  OR (NEW.superseded_by_invitation_id=NEW.id)
BEGIN
  SELECT RAISE(ABORT,'invalid invitation lifecycle state');
END;

UPDATE database_metadata
SET value='REVISION-30-G-B1-04-INVITATION-LIFECYCLE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
