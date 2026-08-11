ALTER TABLE object_permissions
ADD COLUMN purpose TEXT NOT NULL DEFAULT 'general'
CHECK(purpose IN ('general','care','finance','health','archive','legacy','ai_processing','administration'));

ALTER TABLE object_permissions
ADD COLUMN family_branch_id TEXT REFERENCES family_branches(id) ON DELETE RESTRICT;

ALTER TABLE object_permissions
ADD COLUMN denial_reason TEXT;

UPDATE object_permissions
SET denial_reason='Legacy explicit denial; original reason unavailable.'
WHERE effect='deny' AND (denial_reason IS NULL OR length(trim(denial_reason))<5);

CREATE INDEX idx_object_permissions_context
ON object_permissions(subject_account_id,purpose,family_branch_id,effect,starts_at,ends_at);

CREATE TRIGGER trg_object_permissions_context_insert
BEFORE INSERT ON object_permissions
WHEN (NEW.effect='deny' AND length(trim(COALESCE(NEW.denial_reason,'')))<5)
  OR (NEW.effect='allow' AND NEW.denial_reason IS NOT NULL)
  OR (NEW.ends_at IS NOT NULL AND NEW.ends_at<=NEW.starts_at)
  OR (NEW.family_branch_id IS NOT NULL AND NOT EXISTS(
    SELECT 1
    FROM accounts account
    JOIN people person ON person.id=account.person_id
    JOIN family_branches branch ON branch.id=NEW.family_branch_id
    WHERE account.id=NEW.subject_account_id
      AND person.family_id=branch.family_id
  ))
BEGIN
  SELECT RAISE(ABORT,'invalid object permission authorization context');
END;

CREATE TRIGGER trg_object_permissions_context_update
BEFORE UPDATE OF subject_account_id,effect,purpose,family_branch_id,denial_reason,starts_at,ends_at
ON object_permissions
WHEN (NEW.effect='deny' AND length(trim(COALESCE(NEW.denial_reason,'')))<5)
  OR (NEW.effect='allow' AND NEW.denial_reason IS NOT NULL)
  OR (NEW.ends_at IS NOT NULL AND NEW.ends_at<=NEW.starts_at)
  OR (NEW.family_branch_id IS NOT NULL AND NOT EXISTS(
    SELECT 1
    FROM accounts account
    JOIN people person ON person.id=account.person_id
    JOIN family_branches branch ON branch.id=NEW.family_branch_id
    WHERE account.id=NEW.subject_account_id
      AND person.family_id=branch.family_id
  ))
BEGIN
  SELECT RAISE(ABORT,'invalid object permission authorization context');
END;

UPDATE database_metadata
SET value='REVISION-30-E-B1-03-AUTHORIZATION-CONTEXT',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';

