CREATE TABLE data_repair_operations (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  issue_id TEXT NOT NULL,
  issue_kind TEXT NOT NULL CHECK(issue_kind IN ('duplicate_person','broken_relation','inconsistent_family_link')),
  resolution TEXT NOT NULL CHECK(resolution IN ('merge_duplicate_person','remove_broken_relation','align_relation_family','remove_cross_family_relation','end_inconsistent_membership')),
  status TEXT NOT NULL CHECK(status IN ('previewed','applied','undone')),
  revision_token TEXT NOT NULL CHECK(length(revision_token)>0),
  before_snapshot TEXT NOT NULL CHECK(json_valid(before_snapshot)),
  after_snapshot TEXT NOT NULL CHECK(json_valid(after_snapshot)),
  reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 500),
  created_by TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  applied_at TEXT,
  undone_at TEXT,
  CHECK(
    (status='previewed' AND applied_at IS NULL AND undone_at IS NULL)
    OR (status='applied' AND applied_at IS NOT NULL AND undone_at IS NULL)
    OR (status='undone' AND applied_at IS NOT NULL AND undone_at IS NOT NULL)
  ),
  CHECK(
    (issue_kind='duplicate_person' AND resolution='merge_duplicate_person')
    OR (issue_kind='broken_relation' AND resolution='remove_broken_relation')
    OR (issue_kind='inconsistent_family_link' AND resolution IN ('align_relation_family','remove_cross_family_relation','end_inconsistent_membership'))
  )
) STRICT;

CREATE UNIQUE INDEX ux_data_repair_active_issue
ON data_repair_operations(family_id,issue_id)
WHERE status IN ('previewed','applied');

CREATE INDEX idx_data_repair_family_history
ON data_repair_operations(family_id,created_at DESC,id DESC);

CREATE TRIGGER trg_data_repair_family_scope_insert
BEFORE INSERT ON data_repair_operations
WHEN NOT EXISTS(SELECT 1 FROM families WHERE id=NEW.family_id)
  OR NOT EXISTS(SELECT 1 FROM accounts WHERE id=NEW.created_by AND status='active')
BEGIN
  SELECT RAISE(ABORT,'data repair operation requires an existing family and active actor');
END;

CREATE TRIGGER trg_data_repair_transition_update
BEFORE UPDATE ON data_repair_operations
WHEN NEW.id<>OLD.id
  OR NEW.family_id<>OLD.family_id
  OR NEW.issue_id<>OLD.issue_id
  OR NEW.issue_kind<>OLD.issue_kind
  OR NEW.resolution<>OLD.resolution
  OR NEW.revision_token<>OLD.revision_token
  OR NEW.before_snapshot<>OLD.before_snapshot
  OR NEW.after_snapshot<>OLD.after_snapshot
  OR NEW.reason<>OLD.reason
  OR NEW.created_by<>OLD.created_by
  OR NEW.created_at<>OLD.created_at
  OR (OLD.status='previewed' AND NEW.status NOT IN ('previewed','applied'))
  OR (OLD.status='applied' AND NEW.status NOT IN ('applied','undone'))
  OR (OLD.status='undone' AND NEW.status<>'undone')
  OR (NEW.status='previewed' AND (NEW.applied_at IS NOT NULL OR NEW.undone_at IS NOT NULL))
  OR (NEW.status='applied' AND (NEW.applied_at IS NULL OR NEW.undone_at IS NOT NULL))
  OR (NEW.status='undone' AND (NEW.applied_at IS NULL OR NEW.undone_at IS NULL))
BEGIN
  SELECT RAISE(ABORT,'invalid data repair operation transition');
END;

UPDATE database_metadata
SET value='REVISION-30-I-B1-05-DATA-REPAIR-CENTER',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
