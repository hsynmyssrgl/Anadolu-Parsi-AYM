ALTER TABLE people ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE people ADD COLUMN archived_at TEXT;
ALTER TABLE people ADD COLUMN merged_into_person_id TEXT REFERENCES people(id) ON DELETE RESTRICT;
ALTER TABLE people ADD COLUMN deletion_requested_at TEXT;
ALTER TABLE people ADD COLUMN lifecycle_version INTEGER NOT NULL DEFAULT 0 CHECK(lifecycle_version>=0);

UPDATE people SET updated_at=created_at WHERE updated_at='';

CREATE INDEX idx_people_profile_duplicate_guard
ON people(family_id,display_name COLLATE NOCASE,birth_date,status);
CREATE INDEX idx_people_merged_target
ON people(merged_into_person_id,status);

CREATE TRIGGER trg_people_lifecycle_insert_defaults
AFTER INSERT ON people
WHEN NEW.updated_at=''
BEGIN
  UPDATE people SET updated_at=NEW.created_at WHERE id=NEW.id;
END;

CREATE TRIGGER trg_people_lifecycle_state_insert
BEFORE INSERT ON people
WHEN (NEW.status='merged' AND NEW.merged_into_person_id IS NULL)
  OR (NEW.status<>'merged' AND NEW.merged_into_person_id IS NOT NULL)
  OR (NEW.status='pending_deletion' AND NEW.deletion_requested_at IS NULL)
  OR (NEW.status<>'pending_deletion' AND NEW.deletion_requested_at IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT,'invalid person lifecycle state');
END;

CREATE TRIGGER trg_people_lifecycle_state_update
BEFORE UPDATE OF family_id,status,merged_into_person_id,deletion_requested_at,lifecycle_version ON people
WHEN NEW.family_id<>OLD.family_id
  OR NEW.lifecycle_version<OLD.lifecycle_version
  OR (NEW.status='merged' AND NEW.merged_into_person_id IS NULL)
  OR (NEW.status<>'merged' AND NEW.merged_into_person_id IS NOT NULL)
  OR (NEW.status='pending_deletion' AND NEW.deletion_requested_at IS NULL)
  OR (NEW.status<>'pending_deletion' AND NEW.deletion_requested_at IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT,'invalid person lifecycle transition');
END;

CREATE TRIGGER trg_people_merge_target_scope
BEFORE UPDATE OF status,merged_into_person_id ON people
WHEN NEW.status='merged' AND (
  NEW.merged_into_person_id=NEW.id
  OR NOT EXISTS(
    SELECT 1 FROM people target
    WHERE target.id=NEW.merged_into_person_id
      AND target.family_id=NEW.family_id
      AND target.status='active'
  )
)
BEGIN
  SELECT RAISE(ABORT,'merge target must be a different active person in the same family');
END;

CREATE TABLE person_lifecycle_operations (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  operation_type TEXT NOT NULL CHECK(operation_type IN ('profile_updated','archived','merged','safe_delete_requested')),
  status TEXT NOT NULL CHECK(status IN ('applied','undone')),
  before_snapshot TEXT NOT NULL CHECK(json_valid(before_snapshot)),
  after_snapshot TEXT NOT NULL CHECK(json_valid(after_snapshot)),
  reference_snapshot TEXT NOT NULL CHECK(json_valid(reference_snapshot)),
  reason TEXT,
  created_at TEXT NOT NULL,
  undone_at TEXT,
  CHECK((status='applied' AND undone_at IS NULL) OR (status='undone' AND undone_at IS NOT NULL))
) STRICT;

CREATE INDEX idx_person_lifecycle_operations_history
ON person_lifecycle_operations(person_id,created_at DESC,id DESC);
CREATE INDEX idx_person_lifecycle_operations_family
ON person_lifecycle_operations(family_id,status,created_at DESC);

CREATE TRIGGER trg_person_lifecycle_operation_family_scope
BEFORE INSERT ON person_lifecycle_operations
WHEN NOT EXISTS(
  SELECT 1 FROM people person
  WHERE person.id=NEW.person_id AND person.family_id=NEW.family_id
)
BEGIN
  SELECT RAISE(ABORT,'person lifecycle operation must stay in the person family');
END;

UPDATE database_metadata
SET value='REVISION-30-C-B1-02-PERSON-PROFILE-LIFECYCLE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
