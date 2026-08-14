import type { DatabaseConnection } from '@ppt/contracts';
import { SystemClock, asCorrelationId, asSha256 } from '@ppt/core';
import {
  SqliteMigrationRunner,
  createMigrationDefinition,
  createSqliteSafetyBackup,
  defaultMigrationBackupDirectory,
  type MigrationRunSummary
} from './migration-runner.js';

const legacySchemaSql = "CREATE TABLE IF NOT EXISTS families (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS people (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE, display_name TEXT NOT NULL, birth_date TEXT, relationship_type TEXT NOT NULL, generation INTEGER NOT NULL, branch TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS relations (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE, from_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE, to_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE, relation_type TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS locations (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE, label TEXT NOT NULL, address TEXT, latitude REAL, longitude REAL, kind TEXT NOT NULL, created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE, kind TEXT NOT NULL, title TEXT NOT NULL, description TEXT, start_at TEXT NOT NULL, location_id TEXT REFERENCES locations(id) ON DELETE SET NULL, location_label TEXT, visibility TEXT NOT NULL, participant_person_ids TEXT NOT NULL, invitation_text TEXT, notes TEXT, attachment_count INTEGER NOT NULL DEFAULT 0, ai_processing_allowed INTEGER NOT NULL DEFAULT 0, recurrence TEXT NOT NULL DEFAULT 'none', reminder_days TEXT NOT NULL DEFAULT '[7,1]', created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, display_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_record TEXT NOT NULL, failed_login_count INTEGER NOT NULL DEFAULT 0, locked_until TEXT, totp_secret TEXT, recovery_codes TEXT, pending_totp_secret TEXT, pending_recovery_codes TEXT, created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS archive_items (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE, title TEXT NOT NULL, original_name TEXT NOT NULL, stored_name TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, sha256 TEXT NOT NULL, linked_event_id TEXT REFERENCES events(id) ON DELETE SET NULL, created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, occurred_at TEXT NOT NULL, actor_id TEXT, prev_hash TEXT, entry_hash TEXT);\n      CREATE TABLE IF NOT EXISTS invitations (id TEXT PRIMARY KEY,email TEXT NOT NULL,role TEXT NOT NULL,person_id TEXT REFERENCES people(id) ON DELETE SET NULL,starts_at TEXT NOT NULL,ends_at TEXT,status TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,accepted_at TEXT);\n      CREATE TABLE IF NOT EXISTS object_permissions (id TEXT PRIMARY KEY,subject_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,actions TEXT NOT NULL,effect TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT,created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS finance_records (id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,title TEXT NOT NULL,kind TEXT NOT NULL,amount REAL NOT NULL,currency TEXT NOT NULL,privacy TEXT NOT NULL,notes TEXT,occurred_at TEXT NOT NULL,created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS health_records (id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,title TEXT NOT NULL,kind TEXT NOT NULL,privacy TEXT NOT NULL,provider TEXT,notes TEXT,occurred_at TEXT NOT NULL,created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS medication_plans (id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,name TEXT NOT NULL,dosage TEXT NOT NULL,schedule TEXT NOT NULL,provider TEXT,starts_at TEXT NOT NULL,ends_at TEXT,privacy TEXT NOT NULL,notes TEXT,created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS family_health_history (id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,related_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,condition TEXT NOT NULL,relationship_note TEXT,diagnosed_at TEXT,privacy TEXT NOT NULL,notes TEXT,created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS life_records (id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,category TEXT NOT NULL,title TEXT NOT NULL,status TEXT NOT NULL,privacy TEXT NOT NULL,starts_at TEXT,due_at TEXT,provider TEXT,reference_no TEXT,amount REAL,currency TEXT,location TEXT,notes TEXT,created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS finance_valuations (id TEXT PRIMARY KEY,finance_record_id TEXT NOT NULL REFERENCES finance_records(id) ON DELETE CASCADE,value_date TEXT NOT NULL,unit_price REAL NOT NULL,quantity REAL NOT NULL,market_value REAL NOT NULL,provider TEXT NOT NULL,created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS automation_rules (id TEXT PRIMARY KEY,title TEXT NOT NULL,source_type TEXT NOT NULL,days_before INTEGER NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS automation_runs (id TEXT PRIMARY KEY,rule_id TEXT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,source_type TEXT NOT NULL,source_id TEXT NOT NULL,title TEXT NOT NULL,due_at TEXT NOT NULL,status TEXT NOT NULL,generated_task_id TEXT,created_at TEXT NOT NULL,UNIQUE(rule_id,source_type,source_id));\n      CREATE TABLE IF NOT EXISTS digital_legacy_plans (id TEXT PRIMARY KEY,owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,title TEXT NOT NULL,status TEXT NOT NULL,trigger_type TEXT NOT NULL,trustee_account_id TEXT NOT NULL REFERENCES accounts(id),secondary_trustee_account_id TEXT REFERENCES accounts(id),instructions TEXT,starts_at TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS legacy_grants (id TEXT PRIMARY KEY,plan_id TEXT NOT NULL REFERENCES digital_legacy_plans(id) ON DELETE CASCADE,resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,actions TEXT NOT NULL,created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS legacy_approvals (id TEXT PRIMARY KEY,plan_id TEXT NOT NULL REFERENCES digital_legacy_plans(id) ON DELETE CASCADE,approver_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,decision TEXT NOT NULL,note TEXT,created_at TEXT NOT NULL,UNIQUE(plan_id,approver_account_id));\n      CREATE TABLE IF NOT EXISTS archive_categories (id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE,description TEXT,created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS archive_tags (id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE,created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS archive_item_tags (archive_item_id TEXT NOT NULL REFERENCES archive_items(id) ON DELETE CASCADE,tag_id TEXT NOT NULL REFERENCES archive_tags(id) ON DELETE CASCADE,PRIMARY KEY(archive_item_id,tag_id));\n      CREATE TABLE IF NOT EXISTS archive_versions (id TEXT PRIMARY KEY,archive_item_id TEXT NOT NULL REFERENCES archive_items(id) ON DELETE CASCADE,version_no INTEGER NOT NULL,original_name TEXT NOT NULL,mime_type TEXT NOT NULL,size_bytes INTEGER NOT NULL,sha256 TEXT NOT NULL,created_at TEXT NOT NULL,note TEXT,UNIQUE(archive_item_id,version_no));\n      CREATE TABLE IF NOT EXISTS archive_retention_policies (id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE,retention_days INTEGER NOT NULL,secure_destroy INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS backup_targets (id TEXT PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL,path TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,last_success_at TEXT,last_verified_at TEXT,last_error TEXT,created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS diagnostic_entries (id TEXT PRIMARY KEY,severity TEXT NOT NULL,code TEXT NOT NULL,message TEXT NOT NULL,details TEXT,occurred_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS backup_runs (id TEXT PRIMARY KEY,target_id TEXT NOT NULL REFERENCES backup_targets(id) ON DELETE CASCADE,status TEXT NOT NULL,file_path TEXT,size_bytes INTEGER,sha256 TEXT,free_bytes INTEGER,error TEXT,started_at TEXT NOT NULL,completed_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS performance_samples (id TEXT PRIMARY KEY,cpu_load_percent REAL NOT NULL,memory_usage_percent REAL NOT NULL,database_bytes INTEGER NOT NULL,archive_bytes INTEGER NOT NULL,sampled_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS background_tasks (id TEXT PRIMARY KEY,task_type TEXT NOT NULL,label TEXT NOT NULL,status TEXT NOT NULL,started_at TEXT NOT NULL,completed_at TEXT,duration_ms INTEGER,warning_threshold_ms INTEGER NOT NULL DEFAULT 30000,details TEXT);\n      CREATE TABLE IF NOT EXISTS task_queue (id TEXT PRIMARY KEY,task_type TEXT NOT NULL,label TEXT NOT NULL,priority TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,started_at TEXT,completed_at TEXT,attempts INTEGER NOT NULL DEFAULT 0,max_attempts INTEGER NOT NULL DEFAULT 2,payload TEXT,details TEXT);\n      CREATE TABLE IF NOT EXISTS maintenance_policy (id TEXT PRIMARY KEY,enabled INTEGER NOT NULL,interval_hours INTEGER NOT NULL,keep_diagnostic_days INTEGER NOT NULL,keep_performance_days INTEGER NOT NULL,next_run_at TEXT,last_run_at TEXT,created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS health_notifications (id TEXT PRIMARY KEY,severity TEXT NOT NULL,code TEXT NOT NULL,title TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL,acknowledged_at TEXT,generated_task_id TEXT);\n      CREATE TABLE IF NOT EXISTS diagnostic_reports (id TEXT PRIMARY KEY,generated_at TEXT NOT NULL,health_score INTEGER NOT NULL,status TEXT NOT NULL,file_path TEXT,sha256 TEXT NOT NULL,size_bytes INTEGER NOT NULL);\n      CREATE TABLE IF NOT EXISTS maintenance_history (id TEXT PRIMARY KEY,operation TEXT NOT NULL,success INTEGER NOT NULL,message TEXT NOT NULL,started_at TEXT NOT NULL,completed_at TEXT NOT NULL,duration_ms INTEGER NOT NULL,source TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS export_artifacts (id TEXT PRIMARY KEY,kind TEXT NOT NULL,format TEXT NOT NULL,file_path TEXT NOT NULL,sha256 TEXT NOT NULL,size_bytes INTEGER NOT NULL,record_count INTEGER,created_at TEXT NOT NULL);\n      CREATE TABLE IF NOT EXISTS system_health_history (id TEXT PRIMARY KEY,score INTEGER NOT NULL,grade TEXT NOT NULL,system_status TEXT NOT NULL,deductions INTEGER NOT NULL,captured_at TEXT NOT NULL);\n      CREATE INDEX IF NOT EXISTS idx_system_health_history_captured ON system_health_history(captured_at);\n      CREATE TABLE IF NOT EXISTS diagnostic_archives (id TEXT PRIMARY KEY,created_at TEXT NOT NULL,from_at TEXT NOT NULL,to_at TEXT NOT NULL,entry_count INTEGER NOT NULL,file_path TEXT NOT NULL,sha256 TEXT NOT NULL,size_bytes INTEGER NOT NULL);\n      CREATE TABLE IF NOT EXISTS ai_consents (id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,purpose TEXT NOT NULL,resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,status TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT,created_at TEXT NOT NULL,UNIQUE(account_id,purpose,resource_type,resource_id));\n      CREATE INDEX IF NOT EXISTS idx_people_family ON people(family_id);\n      CREATE INDEX IF NOT EXISTS idx_events_family_date ON events(family_id, start_at DESC);\n      CREATE INDEX IF NOT EXISTS idx_locations_family ON locations(family_id);\n      CREATE INDEX IF NOT EXISTS idx_relations_family ON relations(family_id);\n      CREATE INDEX IF NOT EXISTS idx_archive_family_created ON archive_items(family_id, created_at DESC);\n      CREATE INDEX IF NOT EXISTS idx_finance_family_date ON finance_records(family_id, occurred_at DESC);\n      CREATE INDEX IF NOT EXISTS idx_finance_owner_date ON finance_records(owner_person_id, occurred_at DESC);\n      CREATE INDEX IF NOT EXISTS idx_health_family_date ON health_records(family_id, occurred_at DESC);\n      CREATE INDEX IF NOT EXISTS idx_health_owner_date ON health_records(owner_person_id, occurred_at DESC);\n      CREATE INDEX IF NOT EXISTS idx_life_family_due ON life_records(family_id, due_at);\n      CREATE INDEX IF NOT EXISTS idx_diagnostics_occurred ON diagnostic_entries(occurred_at DESC);\n      CREATE INDEX IF NOT EXISTS idx_performance_sampled ON performance_samples(sampled_at DESC);\n      CREATE INDEX IF NOT EXISTS idx_backup_runs_started ON backup_runs(started_at DESC);\n      CREATE INDEX IF NOT EXISTS idx_background_tasks_started ON background_tasks(started_at DESC);\n      CREATE INDEX IF NOT EXISTS idx_task_queue_dispatch ON task_queue(status, priority, created_at);\n      CREATE INDEX IF NOT EXISTS idx_audit_occurred ON audit_log(occurred_at DESC);\n      CREATE INDEX IF NOT EXISTS idx_maintenance_started ON maintenance_history(started_at DESC);\n      CREATE INDEX IF NOT EXISTS idx_health_notifications_created ON health_notifications(created_at DESC);\n";
const legacyCompatibilitySql = "ALTER TABLE finance_records ADD COLUMN due_at TEXT;\nALTER TABLE finance_records ADD COLUMN remaining_principal REAL;\nALTER TABLE finance_records ADD COLUMN symbol TEXT;\nALTER TABLE archive_items ADD COLUMN category_id TEXT REFERENCES archive_categories(id) ON DELETE SET NULL;\nALTER TABLE archive_items ADD COLUMN sensitivity TEXT NOT NULL DEFAULT 'standard';\nALTER TABLE archive_items ADD COLUMN ai_processing_allowed INTEGER NOT NULL DEFAULT 0;\nALTER TABLE archive_items ADD COLUMN retention_policy_id TEXT REFERENCES archive_retention_policies(id) ON DELETE SET NULL;\nALTER TABLE archive_items ADD COLUMN destroyed_at TEXT;\nALTER TABLE accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'adult_member';\nALTER TABLE accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'active';\nALTER TABLE accounts ADD COLUMN person_id TEXT REFERENCES people(id) ON DELETE SET NULL;\nALTER TABLE accounts ADD COLUMN starts_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';\nALTER TABLE accounts ADD COLUMN ends_at TEXT;\nALTER TABLE backup_targets ADD COLUMN schedule TEXT NOT NULL DEFAULT 'manual';\nALTER TABLE backup_targets ADD COLUMN retention_count INTEGER NOT NULL DEFAULT 10;\nALTER TABLE backup_targets ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 2;\nALTER TABLE backup_targets ADD COLUMN next_run_at TEXT;\nALTER TABLE digital_legacy_plans ADD COLUMN waiting_days INTEGER NOT NULL DEFAULT 7;\nALTER TABLE digital_legacy_plans ADD COLUMN rollback_hours INTEGER NOT NULL DEFAULT 24;\nALTER TABLE digital_legacy_plans ADD COLUMN execution_requested_at TEXT;\nALTER TABLE digital_legacy_plans ADD COLUMN execute_after TEXT;\nALTER TABLE digital_legacy_plans ADD COLUMN rollback_until TEXT;\nALTER TABLE digital_legacy_plans ADD COLUMN confirmation_note TEXT;\nALTER TABLE object_permissions ADD COLUMN source_legacy_plan_id TEXT;\nINSERT OR IGNORE INTO maintenance_policy(\n  id,enabled,interval_hours,keep_diagnostic_days,keep_performance_days,next_run_at,created_at\n) VALUES(\n  'default',1,24,90,180,\n  strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 day'),\n  strftime('%Y-%m-%dT%H:%M:%fZ','now')\n);\n";
const databaseMetadataSql = "CREATE TABLE database_metadata (\n  key TEXT PRIMARY KEY,\n  value TEXT NOT NULL,\n  updated_at TEXT NOT NULL\n) STRICT;\nINSERT INTO database_metadata(key,value,updated_at)\nVALUES(\n  'schema_generation',\n  'REVISION-060-B060-M4',\n  strftime('%Y-%m-%dT%H:%M:%fZ','now')\n);\n";
const transactionalOutboxSql = "CREATE TABLE event_outbox (\n  id TEXT PRIMARY KEY,\n  event_type TEXT NOT NULL,\n  event_version INTEGER NOT NULL,\n  aggregate_type TEXT NOT NULL,\n  aggregate_id TEXT NOT NULL,\n  payload_json TEXT NOT NULL,\n  headers_json TEXT NOT NULL,\n  occurred_at TEXT NOT NULL,\n  available_at TEXT NOT NULL,\n  status TEXT NOT NULL CHECK(status IN ('pending','processing','published','failed')),\n  attempt_count INTEGER NOT NULL DEFAULT 0,\n  published_at TEXT,\n  last_error_code TEXT,\n  last_error_message TEXT\n) STRICT;\nCREATE INDEX idx_event_outbox_pending ON event_outbox(status, available_at, occurred_at);\nCREATE INDEX idx_event_outbox_aggregate ON event_outbox(aggregate_type, aggregate_id, occurred_at);\nCREATE TABLE event_handler_receipts (\n  event_id TEXT NOT NULL REFERENCES event_outbox(id) ON DELETE CASCADE,\n  handler_name TEXT NOT NULL,\n  handled_at TEXT NOT NULL,\n  outcome TEXT NOT NULL CHECK(outcome IN ('success','failure')),\n  error_code TEXT,\n  PRIMARY KEY(event_id, handler_name)\n) STRICT;\nUPDATE database_metadata\nSET value='REVISION-060-B060-M5', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')\nWHERE key='schema_generation';\n";
const eventDispatcherStateSql = "ALTER TABLE event_outbox ADD COLUMN processing_started_at TEXT;\nCREATE INDEX idx_event_outbox_processing\nON event_outbox(status, processing_started_at);\nUPDATE database_metadata\nSET value='REVISION-060-B060-M5-DISPATCHER',\n    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')\nWHERE key='schema_generation';\n";

const trustedDevicesSql = "CREATE TABLE trusted_devices (\n  id TEXT PRIMARY KEY,\n  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,\n  device_id TEXT NOT NULL,\n  display_name TEXT NOT NULL,\n  fingerprint TEXT NOT NULL,\n  public_key_pem TEXT NOT NULL,\n  trusted_at TEXT NOT NULL,\n  last_seen_at TEXT NOT NULL,\n  revoked_at TEXT,\n  created_at TEXT NOT NULL,\n  UNIQUE(account_id, device_id)\n) STRICT;\nCREATE INDEX idx_trusted_devices_account\nON trusted_devices(account_id, revoked_at, last_seen_at DESC);\nUPDATE database_metadata\nSET value='REVISION-060-B060-M11-TRUSTED-DEVICES',\n    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')\nWHERE key='schema_generation';\n";

const authorizationAuditHardeningSql = `ALTER TABLE audit_log ADD COLUMN sequence_no INTEGER;
ALTER TABLE audit_log ADD COLUMN hash_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE audit_log ADD COLUMN correlation_id TEXT;
UPDATE audit_log SET sequence_no=rowid WHERE sequence_no IS NULL;
CREATE UNIQUE INDEX idx_audit_sequence_no ON audit_log(sequence_no);
CREATE INDEX idx_permission_subject_active ON object_permissions(subject_account_id,starts_at,ends_at,effect);
UPDATE database_metadata
SET value='REVISION-060-B060-M12-RBAC-AUDIT-HARDENING',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const invitationLifecycleSql = `ALTER TABLE invitations
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
`;

const dataRepairCenterSql = `CREATE TABLE data_repair_operations (
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
`;



const membershipCollaborationNotificationsSql = `CREATE TABLE event_notification_states (
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
`;

const healthApplicationIndexesSql = `CREATE INDEX idx_medication_owner_active
ON medication_plans(owner_person_id, starts_at DESC, ends_at);
CREATE INDEX idx_family_health_related
ON family_health_history(related_person_id, created_at DESC);
CREATE INDEX idx_health_kind_date
ON health_records(kind, occurred_at DESC);
UPDATE database_metadata
SET value='REVISION-060-B060-M14-HEALTH-APPLICATION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;


const financeApplicationIndexesSql = `CREATE INDEX IF NOT EXISTS idx_finance_records_kind_currency_date
ON finance_records(kind,currency,occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_valuations_record_date
ON finance_valuations(finance_record_id,value_date DESC);
UPDATE database_metadata
SET value='REVISION-060-B060-M15-FINANCE-APPLICATION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;


const archiveApplicationIndexesSql = `ALTER TABLE archive_versions ADD COLUMN stored_name TEXT;
UPDATE archive_versions SET stored_name=(SELECT stored_name FROM archive_items WHERE archive_items.id=archive_versions.archive_item_id) WHERE stored_name IS NULL;
CREATE INDEX IF NOT EXISTS idx_archive_items_family_created ON archive_items(family_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archive_versions_item_version ON archive_versions(archive_item_id,version_no DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_archive_versions_item_sha ON archive_versions(archive_item_id,sha256);
UPDATE database_metadata
SET value='REVISION-060-B060-M16-ARCHIVE-APPLICATION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;


const legacyApplicationIndexesSql = `CREATE INDEX IF NOT EXISTS idx_legacy_plans_owner_status ON digital_legacy_plans(owner_person_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_legacy_plans_trustee_status ON digital_legacy_plans(trustee_account_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_legacy_grants_plan ON legacy_grants(plan_id,created_at);
CREATE INDEX IF NOT EXISTS idx_legacy_approvals_plan_decision ON legacy_approvals(plan_id,decision,created_at);
UPDATE database_metadata SET value='REVISION-060-B060-M17-DIGITAL-LEGACY-APPLICATION',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key='schema_generation';
`;

const removeUntouchedLegacyDemoSql = `CREATE TEMP TABLE legacy_demo_cleanup_candidate(run INTEGER NOT NULL);
INSERT INTO legacy_demo_cleanup_candidate(run)
SELECT 1
WHERE (SELECT COUNT(*) FROM families)=1
  AND (SELECT COUNT(*) FROM families WHERE id='family-main')=1
  AND (SELECT COUNT(*) FROM accounts)=1
  AND (SELECT COUNT(*) FROM people)=6
  AND (SELECT COUNT(*) FROM relations)=6
  AND (SELECT COUNT(*) FROM relations WHERE id IN ('relation-1','relation-2','relation-3','relation-4','relation-5','relation-6'))=6
  AND (SELECT COUNT(*) FROM locations)=2
  AND (SELECT COUNT(*) FROM locations WHERE id IN ('location-itu','location-sakarya'))=2
  AND (SELECT COUNT(*) FROM events)=4
  AND (SELECT COUNT(*) FROM events WHERE id IN ('event-graduation','event-birthday','event-family-meeting','event-home'))=4
  AND NOT EXISTS(SELECT 1 FROM archive_items)
  AND NOT EXISTS(SELECT 1 FROM finance_records)
  AND NOT EXISTS(SELECT 1 FROM health_records)
  AND NOT EXISTS(SELECT 1 FROM medication_plans)
  AND NOT EXISTS(SELECT 1 FROM family_health_history)
  AND NOT EXISTS(SELECT 1 FROM life_records)
  AND NOT EXISTS(SELECT 1 FROM digital_legacy_plans);
DELETE FROM families WHERE id='family-main' AND EXISTS(SELECT 1 FROM legacy_demo_cleanup_candidate WHERE run=1);
INSERT INTO families(id,name,created_at)
SELECT 'family-main','Ailem',strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE EXISTS(SELECT 1 FROM legacy_demo_cleanup_candidate WHERE run=1);
INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at)
SELECT 'person-' || id,'family-main',display_name,NULL,'Aile yöneticisi',1,'Ana Dal','active',strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM accounts WHERE EXISTS(SELECT 1 FROM legacy_demo_cleanup_candidate WHERE run=1);
UPDATE accounts SET person_id='person-' || id,role='family_admin',status='active'
WHERE EXISTS(SELECT 1 FROM legacy_demo_cleanup_candidate WHERE run=1);
UPDATE database_metadata
SET value='REVISION-122-LOCAL-FIRST-RUN',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation' AND EXISTS(SELECT 1 FROM legacy_demo_cleanup_candidate WHERE run=1);
DROP TABLE legacy_demo_cleanup_candidate;
`;

const removeKnownSyntheticProfilesSql = `CREATE TEMP TABLE known_synthetic_cleanup_candidate(run INTEGER NOT NULL);
INSERT INTO known_synthetic_cleanup_candidate(run)
SELECT 1
WHERE (SELECT COUNT(*) FROM families)=1
  AND (SELECT COUNT(*) FROM families WHERE id='family-main')=1
  AND (SELECT COUNT(*) FROM people)=6
  AND (SELECT COUNT(*) FROM relations WHERE id IN ('relation-1','relation-2','relation-3','relation-4','relation-5','relation-6'))=6
  AND (SELECT COUNT(*) FROM locations WHERE id IN ('location-itu','location-sakarya'))=2
  AND (SELECT COUNT(*) FROM events WHERE id IN ('event-graduation','event-birthday','event-family-meeting','event-home'))=4;
INSERT OR IGNORE INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at)
SELECT 'person-' || accounts.id,'family-main',accounts.display_name,NULL,'Aile yöneticisi',1,'Ana Dal','active',strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM accounts WHERE EXISTS(SELECT 1 FROM known_synthetic_cleanup_candidate WHERE run=1);
UPDATE accounts SET person_id='person-' || id
WHERE EXISTS(SELECT 1 FROM known_synthetic_cleanup_candidate WHERE run=1);
DELETE FROM events WHERE id IN ('event-graduation','event-birthday','event-family-meeting','event-home') AND EXISTS(SELECT 1 FROM known_synthetic_cleanup_candidate WHERE run=1);
DELETE FROM relations WHERE id IN ('relation-1','relation-2','relation-3','relation-4','relation-5','relation-6') AND EXISTS(SELECT 1 FROM known_synthetic_cleanup_candidate WHERE run=1);
DELETE FROM locations WHERE id IN ('location-itu','location-sakarya') AND EXISTS(SELECT 1 FROM known_synthetic_cleanup_candidate WHERE run=1);
DELETE FROM people
WHERE family_id='family-main'
  AND id NOT IN (SELECT person_id FROM accounts WHERE person_id IS NOT NULL)
  AND EXISTS(SELECT 1 FROM known_synthetic_cleanup_candidate WHERE run=1);
UPDATE families SET name='Ailem'
WHERE id='family-main' AND EXISTS(SELECT 1 FROM known_synthetic_cleanup_candidate WHERE run=1);
UPDATE database_metadata SET value='REVISION-124-SYNTHETIC-DATA-REMOVAL',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key='schema_generation';
DROP TABLE known_synthetic_cleanup_candidate;
`;

const timelineLifecycleSql = `ALTER TABLE events ADD COLUMN updated_at TEXT;
ALTER TABLE events ADD COLUMN archived_at TEXT;
UPDATE events SET updated_at=created_at WHERE updated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_family_archived_date
ON events(family_id,archived_at,start_at DESC);
UPDATE database_metadata
SET value='REVISION-125-TIMELINE-LIFECYCLE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;


const dataLifecycleGovernanceSql = `CREATE TABLE IF NOT EXISTS data_retention_policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  resource_types TEXT NOT NULL,
  retention_days INTEGER NOT NULL CHECK(retention_days BETWEEN 1 AND 36500),
  grace_days INTEGER NOT NULL CHECK(grace_days BETWEEN 1 AND 365),
  requires_strong_auth INTEGER NOT NULL DEFAULT 1 CHECK(requires_strong_auth IN (0,1)),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS data_lifecycle (
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  owner_person_id TEXT,
  privacy TEXT,
  state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','archived','purge_scheduled','purged')),
  policy_id TEXT REFERENCES data_retention_policies(id) ON DELETE SET NULL,
  archived_at TEXT,
  purge_eligible_at TEXT,
  purge_requested_at TEXT,
  purge_execute_after TEXT,
  legal_hold INTEGER NOT NULL DEFAULT 0 CHECK(legal_hold IN (0,1)),
  hold_reason TEXT,
  purged_at TEXT,
  updated_at TEXT NOT NULL,
  backup_propagation_pending INTEGER NOT NULL DEFAULT 0 CHECK(backup_propagation_pending IN (0,1)),
  PRIMARY KEY(resource_type,resource_id)
);
CREATE INDEX IF NOT EXISTS idx_data_lifecycle_state_due
ON data_lifecycle(state,purge_execute_after,purge_eligible_at);
CREATE INDEX IF NOT EXISTS idx_data_lifecycle_owner
ON data_lifecycle(owner_person_id,state,updated_at DESC);
INSERT OR IGNORE INTO data_lifecycle(resource_type,resource_id,owner_person_id,privacy,state,updated_at)
SELECT 'finance_record',id,owner_person_id,privacy,'active',created_at FROM finance_records;
INSERT OR IGNORE INTO data_lifecycle(resource_type,resource_id,owner_person_id,privacy,state,updated_at)
SELECT 'health_record',id,owner_person_id,privacy,'active',created_at FROM health_records;
INSERT OR IGNORE INTO data_lifecycle(resource_type,resource_id,owner_person_id,privacy,state,updated_at)
SELECT 'medication_plan',id,owner_person_id,privacy,'active',created_at FROM medication_plans;
INSERT OR IGNORE INTO data_lifecycle(resource_type,resource_id,owner_person_id,privacy,state,updated_at)
SELECT 'family_health_history',id,related_person_id,privacy,'active',created_at FROM family_health_history;
INSERT OR IGNORE INTO data_lifecycle(resource_type,resource_id,owner_person_id,privacy,state,updated_at)
SELECT 'life_record',id,owner_person_id,privacy,'active',created_at FROM life_records;
UPDATE database_metadata
SET value='REVISION-136-DATA-LIFECYCLE-GOVERNANCE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const backupPurgePropagationSql = `CREATE TABLE IF NOT EXISTS backup_propagation_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('success','partial','failed','attention')),
  pending_records INTEGER NOT NULL CHECK(pending_records>=0),
  target_count INTEGER NOT NULL CHECK(target_count>=0),
  refreshed_targets INTEGER NOT NULL CHECK(refreshed_targets>=0),
  quarantined_artifacts INTEGER NOT NULL CHECK(quarantined_artifacts>=0),
  pending_remaining INTEGER NOT NULL CHECK(pending_remaining>=0),
  manual_backup_warning INTEGER NOT NULL DEFAULT 1 CHECK(manual_backup_warning IN (0,1)),
  target_results TEXT NOT NULL DEFAULT '[]',
  error TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_backup_propagation_runs_started
ON backup_propagation_runs(started_at DESC);
UPDATE database_metadata
SET value='REVISION-137-BACKUP-PURGE-PROPAGATION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const backupQuarantineLifecycleSql = `CREATE TABLE IF NOT EXISTS backup_quarantine_policy (
  id TEXT PRIMARY KEY CHECK(id='default'),
  retention_days INTEGER NOT NULL CHECK(retention_days BETWEEN 1 AND 3650),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO backup_quarantine_policy(id,retention_days,created_at,updated_at)
VALUES('default',90,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
CREATE TABLE IF NOT EXISTS backup_quarantine_batches (
  id TEXT PRIMARY KEY,
  propagation_run_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_name TEXT NOT NULL,
  quarantine_directory TEXT NOT NULL,
  manifest_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('retained','destroying','destroyed')),
  quarantined_artifacts INTEGER NOT NULL CHECK(quarantined_artifacts>=0),
  quarantined_at TEXT NOT NULL,
  retain_until TEXT NOT NULL,
  legal_hold INTEGER NOT NULL DEFAULT 0 CHECK(legal_hold IN (0,1)),
  hold_reason TEXT,
  destroyed_at TEXT,
  destroyed_artifacts INTEGER,
  destroyed_bytes INTEGER,
  updated_at TEXT NOT NULL,
  UNIQUE(propagation_run_id,target_id),
  FOREIGN KEY(propagation_run_id) REFERENCES backup_propagation_runs(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_backup_quarantine_batches_status_due
ON backup_quarantine_batches(status,legal_hold,retain_until);
CREATE INDEX IF NOT EXISTS idx_backup_quarantine_batches_propagation
ON backup_quarantine_batches(propagation_run_id,target_id);
UPDATE database_metadata
SET value='REVISION-138-BACKUP-QUARANTINE-LIFECYCLE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;


const externalBackupInventorySql = `CREATE TABLE IF NOT EXISTS external_backup_copies (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL CHECK(length(trim(label)) BETWEEN 3 AND 120),
  kind TEXT NOT NULL CHECK(kind IN ('offline_disk','manual_file','cloud_history','other')),
  location_hint TEXT NOT NULL CHECK(length(trim(location_hint)) BETWEEN 2 AND 500),
  custodian TEXT NOT NULL CHECK(length(trim(custodian)) BETWEEN 2 AND 120),
  status TEXT NOT NULL CHECK(status IN ('active','unreachable','retired','destroyed')),
  contains_historical_data_risk INTEGER NOT NULL DEFAULT 1 CHECK(contains_historical_data_risk IN (0,1)),
  review_interval_days INTEGER NOT NULL CHECK(review_interval_days BETWEEN 1 AND 3650),
  last_reviewed_at TEXT,
  next_review_at TEXT NOT NULL,
  legal_hold INTEGER NOT NULL DEFAULT 0 CHECK(legal_hold IN (0,1)),
  hold_reason TEXT,
  attestation_note TEXT,
  evidence_sha256 TEXT CHECK(evidence_sha256 IS NULL OR length(evidence_sha256)=64),
  attested_at TEXT,
  attested_by TEXT,
  destroyed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_external_backup_copies_review
ON external_backup_copies(status,legal_hold,next_review_at);
CREATE INDEX IF NOT EXISTS idx_external_backup_copies_risk
ON external_backup_copies(contains_historical_data_risk,status);
CREATE TABLE IF NOT EXISTS external_backup_copy_attestations (
  id TEXT PRIMARY KEY,
  copy_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('registered','reviewed','hold_enabled','hold_disabled','destroyed_attested')),
  note TEXT NOT NULL,
  evidence_sha256 TEXT CHECK(evidence_sha256 IS NULL OR length(evidence_sha256)=64),
  actor_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  FOREIGN KEY(copy_id) REFERENCES external_backup_copies(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_external_backup_copy_attestations_copy
ON external_backup_copy_attestations(copy_id,occurred_at DESC);
UPDATE database_metadata
SET value='REVISION-139-EXTERNAL-BACKUP-INVENTORY',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;



const externalBackupRevocationEndpointSql = `CREATE TABLE IF NOT EXISTS external_backup_revocation_endpoints (
  id TEXT PRIMARY KEY,
  issuer_id TEXT NOT NULL UNIQUE,
  source_url TEXT NOT NULL,
  primary_spki_sha256 TEXT NOT NULL CHECK(length(primary_spki_sha256)=64),
  secondary_spki_sha256 TEXT CHECK(secondary_spki_sha256 IS NULL OR length(secondary_spki_sha256)=64),
  secondary_valid_from TEXT,
  primary_valid_until TEXT,
  status TEXT NOT NULL CHECK(status IN ('active','disabled')),
  last_fetch_status TEXT NOT NULL DEFAULT 'never' CHECK(last_fetch_status IN ('never','success','failed')),
  last_fetched_at TEXT,
  last_fetch_error TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(issuer_id) REFERENCES external_backup_evidence_issuers(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_external_backup_revocation_endpoints_status
ON external_backup_revocation_endpoints(status,issuer_id);
UPDATE database_metadata
SET value='REVISION-144-REVOCATION-ENDPOINT-PIN-ROTATION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const externalBackupEvidenceRevocationListSql = `ALTER TABLE external_backup_evidence_issuers
ADD COLUMN revocation_source TEXT CHECK(revocation_source IS NULL OR revocation_source IN ('manual','signed_list'));
ALTER TABLE external_backup_evidence_issuers
ADD COLUMN revocation_list_id TEXT;
CREATE TABLE IF NOT EXISTS external_backup_evidence_revocation_lists (
  id TEXT PRIMARY KEY,
  authority_root_issuer_id TEXT NOT NULL,
  signer_issuer_id TEXT NOT NULL,
  list_id TEXT NOT NULL,
  sequence_number INTEGER NOT NULL CHECK(sequence_number>0),
  schema_version INTEGER NOT NULL CHECK(schema_version=1),
  this_update TEXT NOT NULL,
  next_update TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=64),
  signature_base64 TEXT NOT NULL,
  canonical_payload_json TEXT NOT NULL,
  source_url TEXT,
  status TEXT NOT NULL CHECK(status IN ('current','superseded','expired')),
  verified_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(authority_root_issuer_id,list_id),
  UNIQUE(authority_root_issuer_id,sequence_number),
  FOREIGN KEY(authority_root_issuer_id) REFERENCES external_backup_evidence_issuers(id) ON DELETE RESTRICT,
  FOREIGN KEY(signer_issuer_id) REFERENCES external_backup_evidence_issuers(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_external_backup_evidence_revocation_lists_current
ON external_backup_evidence_revocation_lists(authority_root_issuer_id,status,sequence_number DESC);
CREATE TABLE IF NOT EXISTS external_backup_evidence_revocation_entries (
  id TEXT PRIMARY KEY,
  list_row_id TEXT NOT NULL,
  issuer_id TEXT NOT NULL,
  fingerprint_sha256 TEXT NOT NULL CHECK(length(fingerprint_sha256)=64),
  revoked_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  UNIQUE(list_row_id,fingerprint_sha256),
  FOREIGN KEY(list_row_id) REFERENCES external_backup_evidence_revocation_lists(id) ON DELETE CASCADE,
  FOREIGN KEY(issuer_id) REFERENCES external_backup_evidence_issuers(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_external_backup_evidence_revocation_entries_issuer
ON external_backup_evidence_revocation_entries(issuer_id,revoked_at);
UPDATE database_metadata
SET value='REVISION-142-SIGNED-REVOCATION-LIST',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const externalBackupEvidenceKeyRotationSql = `ALTER TABLE external_backup_evidence_issuers
ADD COLUMN valid_from TEXT;
ALTER TABLE external_backup_evidence_issuers
ADD COLUMN valid_until TEXT;
ALTER TABLE external_backup_evidence_issuers
ADD COLUMN predecessor_issuer_id TEXT;
ALTER TABLE external_backup_evidence_issuers
ADD COLUMN rotation_sequence INTEGER NOT NULL DEFAULT 0 CHECK(rotation_sequence>=0);
ALTER TABLE external_backup_evidence_issuers
ADD COLUMN rotation_receipt_id TEXT;
ALTER TABLE external_backup_evidence_issuers
ADD COLUMN rotation_verified_at TEXT;
UPDATE external_backup_evidence_issuers SET valid_from=added_at WHERE valid_from IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_backup_evidence_issuer_fingerprint
ON external_backup_evidence_issuers(fingerprint_sha256);
CREATE INDEX IF NOT EXISTS idx_external_backup_evidence_issuer_validity
ON external_backup_evidence_issuers(status,valid_from,valid_until);
CREATE INDEX IF NOT EXISTS idx_external_backup_evidence_issuer_predecessor
ON external_backup_evidence_issuers(predecessor_issuer_id,rotation_sequence);
CREATE TABLE IF NOT EXISTS external_backup_evidence_issuer_rotations (
  id TEXT PRIMARY KEY,
  predecessor_issuer_id TEXT NOT NULL,
  successor_issuer_id TEXT NOT NULL UNIQUE,
  receipt_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK(schema_version=1),
  successor_fingerprint_sha256 TEXT NOT NULL CHECK(length(successor_fingerprint_sha256)=64),
  effective_at TEXT NOT NULL,
  signature_base64 TEXT NOT NULL,
  canonical_payload_json TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(predecessor_issuer_id,receipt_id),
  FOREIGN KEY(predecessor_issuer_id) REFERENCES external_backup_evidence_issuers(id) ON DELETE RESTRICT,
  FOREIGN KEY(successor_issuer_id) REFERENCES external_backup_evidence_issuers(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_external_backup_evidence_rotations_predecessor
ON external_backup_evidence_issuer_rotations(predecessor_issuer_id,effective_at);
CREATE TABLE IF NOT EXISTS external_backup_evidence_issuer_events (
  id TEXT PRIMARY KEY,
  issuer_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('registered','rotated_in','rotated_out','revoked')),
  related_issuer_id TEXT,
  reason TEXT,
  occurred_at TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  FOREIGN KEY(issuer_id) REFERENCES external_backup_evidence_issuers(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_external_backup_evidence_issuer_events
ON external_backup_evidence_issuer_events(issuer_id,occurred_at DESC);
UPDATE database_metadata
SET value='REVISION-141-EXTERNAL-EVIDENCE-KEY-ROTATION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const externalBackupSignedEvidenceSql = `ALTER TABLE external_backup_copies
ADD COLUMN evidence_verification_status TEXT NOT NULL DEFAULT 'none'
CHECK(evidence_verification_status IN ('none','verified','revoked'));
ALTER TABLE external_backup_copies
ADD COLUMN verified_evidence_id TEXT;
CREATE TABLE IF NOT EXISTS external_backup_evidence_issuers (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL CHECK(length(trim(label)) BETWEEN 3 AND 160),
  algorithm TEXT NOT NULL CHECK(algorithm='ed25519'),
  public_key_pem TEXT NOT NULL,
  fingerprint_sha256 TEXT NOT NULL UNIQUE CHECK(length(fingerprint_sha256)=64),
  status TEXT NOT NULL CHECK(status IN ('trusted','revoked')),
  added_by TEXT NOT NULL,
  added_at TEXT NOT NULL,
  revoked_by TEXT,
  revoked_at TEXT,
  revocation_reason TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_external_backup_evidence_issuers_status
ON external_backup_evidence_issuers(status,label);
CREATE TABLE IF NOT EXISTS external_backup_destruction_evidence (
  id TEXT PRIMARY KEY,
  copy_id TEXT NOT NULL,
  issuer_id TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK(schema_version=1),
  evidence_sha256 TEXT NOT NULL CHECK(length(evidence_sha256)=64),
  signature_base64 TEXT NOT NULL,
  canonical_payload_json TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK(verification_status IN ('verified','revoked')),
  failure_reason TEXT,
  verified_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(issuer_id,receipt_id),
  FOREIGN KEY(copy_id) REFERENCES external_backup_copies(id) ON DELETE RESTRICT,
  FOREIGN KEY(issuer_id) REFERENCES external_backup_evidence_issuers(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_external_backup_destruction_evidence_copy
ON external_backup_destruction_evidence(copy_id,verified_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_backup_destruction_evidence_issuer
ON external_backup_destruction_evidence(issuer_id,verification_status);
UPDATE database_metadata
SET value='REVISION-140-SIGNED-EXTERNAL-BACKUP-EVIDENCE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;


const familyDataImportSql = `CREATE TABLE IF NOT EXISTS family_data_import_batches (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  source_file_name TEXT NOT NULL CHECK(length(trim(source_file_name)) BETWEEN 1 AND 255),
  source_sha256 TEXT NOT NULL CHECK(length(source_sha256)=64),
  source_export_id TEXT NOT NULL,
  source_created_at TEXT NOT NULL,
  source_family_name TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK(schema_version=1),
  status TEXT NOT NULL CHECK(status IN ('applied','rolled_back','rollback_blocked')),
  applied_at TEXT NOT NULL,
  rollback_deadline TEXT NOT NULL,
  rolled_back_at TEXT,
  actor_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  summary_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_family_data_import_batches_family
ON family_data_import_batches(family_id,applied_at DESC);
CREATE TABLE IF NOT EXISTS family_data_import_items (
  batch_id TEXT NOT NULL REFERENCES family_data_import_batches(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('person','relation','location','event')),
  entity_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  resolution TEXT NOT NULL CHECK(resolution IN ('created','reused')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(batch_id,entity_type,source_id)
);
CREATE INDEX IF NOT EXISTS idx_family_data_import_items_entity
ON family_data_import_items(entity_type,entity_id,resolution);
UPDATE database_metadata
SET value='REVISION-146-FAMILY-DATA-IMPORT',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const largeFamilyReadModelPerformanceSql = `CREATE INDEX IF NOT EXISTS idx_people_large_tree_page
ON people(family_id,status,generation,display_name COLLATE NOCASE,id);
CREATE INDEX IF NOT EXISTS idx_people_large_tree_branch
ON people(family_id,status,branch COLLATE NOCASE,generation,display_name COLLATE NOCASE,id);
CREATE INDEX IF NOT EXISTS idx_relations_large_tree_from
ON relations(family_id,from_person_id,relation_type,to_person_id);
CREATE INDEX IF NOT EXISTS idx_relations_large_tree_to
ON relations(family_id,to_person_id,relation_type,from_person_id);
CREATE INDEX IF NOT EXISTS idx_events_large_timeline_page
ON events(family_id,archived_at,start_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_events_large_timeline_kind
ON events(family_id,archived_at,kind,start_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_archive_large_page
ON archive_items(family_id,destroyed_at,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_archive_large_category
ON archive_items(family_id,destroyed_at,category_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_archive_large_sensitivity
ON archive_items(family_id,destroyed_at,sensitivity,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_archive_large_event
ON archive_items(family_id,destroyed_at,linked_event_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_archive_item_tags_reverse
ON archive_item_tags(tag_id,archive_item_id);
UPDATE database_metadata
SET value='REVISION-147-LARGE-FAMILY-READ-MODEL-PERFORMANCE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const entityCatalogPerformanceSql = `CREATE INDEX IF NOT EXISTS idx_people_entity_catalog
ON people(family_id,status,display_name COLLATE NOCASE,id);
UPDATE database_metadata
SET value='REVISION-156-ENTITY-CATALOG-PAGINATION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const externalBackupRootTrustVerificationSql = `ALTER TABLE external_backup_evidence_issuers
ADD COLUMN verification_method TEXT NOT NULL DEFAULT 'legacy_unverified'
CHECK(verification_method IN ('legacy_unverified','out_of_band_dual_evidence','rotation_inherited'));
ALTER TABLE external_backup_evidence_issuers ADD COLUMN legal_entity_name TEXT;
ALTER TABLE external_backup_evidence_issuers ADD COLUMN identity_evidence_reference TEXT;
ALTER TABLE external_backup_evidence_issuers ADD COLUMN key_fingerprint_evidence_reference TEXT;
ALTER TABLE external_backup_evidence_issuers ADD COLUMN verification_witness_name TEXT;
ALTER TABLE external_backup_evidence_issuers ADD COLUMN verification_witness_organization TEXT;
ALTER TABLE external_backup_evidence_issuers ADD COLUMN verification_checked_at TEXT;
ALTER TABLE external_backup_evidence_issuers ADD COLUMN verification_receipt_sha256 TEXT CHECK(verification_receipt_sha256 IS NULL OR length(verification_receipt_sha256)=64);
CREATE INDEX IF NOT EXISTS idx_external_backup_evidence_issuer_verification
ON external_backup_evidence_issuers(verification_method,verification_checked_at);
UPDATE database_metadata
SET value='REVISION-182-EXTERNAL-EVIDENCE-ROOT-TRUST-VERIFICATION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const automaticCleanBackupRewriteSql = `CREATE TABLE IF NOT EXISTS backup_clean_rewrite_policy (
  id TEXT PRIMARY KEY CHECK(id='default'),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  retention_days INTEGER NOT NULL DEFAULT 30 CHECK(retention_days BETWEEN 1 AND 3650),
  manual_failure_backoff_minutes INTEGER NOT NULL DEFAULT 60 CHECK(manual_failure_backoff_minutes=60),
  automatic_failure_backoff_minutes INTEGER NOT NULL DEFAULT 360 CHECK(automatic_failure_backoff_minutes=360),
  high_load_defer_minutes INTEGER NOT NULL DEFAULT 30 CHECK(high_load_defer_minutes=30),
  state TEXT NOT NULL DEFAULT 'idle' CHECK(state IN ('idle','running','backoff','deferred','attention')),
  consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK(consecutive_failures>=0),
  last_outcome TEXT NOT NULL DEFAULT 'never' CHECK(last_outcome IN ('never','success','partial','failed','attention','deferred')),
  last_trigger TEXT CHECK(last_trigger IS NULL OR last_trigger IN ('manual','automatic')),
  last_attempt_at TEXT,
  last_success_at TEXT,
  next_attempt_at TEXT,
  last_error TEXT,
  in_progress_run_id TEXT,
  in_progress_started_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
INSERT OR IGNORE INTO backup_clean_rewrite_policy(
  id,enabled,retention_days,manual_failure_backoff_minutes,automatic_failure_backoff_minutes,
  high_load_defer_minutes,state,consecutive_failures,last_outcome,created_at,updated_at
) VALUES('default',1,30,60,360,30,'idle',0,'never',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
CREATE INDEX IF NOT EXISTS idx_data_lifecycle_backup_rewrite_due
ON data_lifecycle(backup_propagation_pending,purged_at,resource_type,resource_id)
WHERE state='purged' AND backup_propagation_pending=1;
UPDATE database_metadata
SET value='REVISION-183-AUTOMATIC-CLEAN-BACKUP-REWRITE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const cleanBackupRewriteRunLedgerSql = `CREATE TABLE IF NOT EXISTS backup_clean_rewrite_runs (
  id TEXT PRIMARY KEY,
  trigger TEXT NOT NULL CHECK(trigger IN ('manual','automatic')),
  status TEXT NOT NULL CHECK(status IN ('running','success','partial','failed','attention','deferred','interrupted')),
  retention_cutoff TEXT NOT NULL,
  due_records INTEGER NOT NULL CHECK(due_records>=0),
  enabled_targets INTEGER NOT NULL CHECK(enabled_targets>=0),
  propagation_run_id TEXT,
  next_attempt_at TEXT,
  error TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_backup_clean_rewrite_runs_started
ON backup_clean_rewrite_runs(started_at DESC,id);
CREATE INDEX IF NOT EXISTS idx_backup_clean_rewrite_runs_status
ON backup_clean_rewrite_runs(status,updated_at DESC);
UPDATE database_metadata
SET value='REVISION-184-CLEAN-BACKUP-REWRITE-FINALIZATION-LEDGER',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const cleanBackupRewriteLinkedChronologySql = `CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_chronology_insert
BEFORE INSERT ON backup_clean_rewrite_runs
WHEN NEW.completed_at IS NOT NULL
BEGIN
  SELECT CASE
    WHEN julianday(NEW.started_at) IS NULL OR julianday(NEW.completed_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite chronology timestamp is invalid')
    WHEN julianday(NEW.completed_at) < julianday(NEW.started_at)
      THEN RAISE(ABORT,'clean rewrite completion precedes start')
    WHEN NEW.status IN ('success','partial') AND NEW.propagation_run_id IS NULL
      THEN RAISE(ABORT,'successful or partial clean rewrite requires propagation run')
    WHEN NEW.propagation_run_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM backup_propagation_runs WHERE id=NEW.propagation_run_id
    )
      THEN RAISE(ABORT,'linked propagation run is missing')
    WHEN NEW.propagation_run_id IS NOT NULL AND (
      SELECT julianday(completed_at) FROM backup_propagation_runs WHERE id=NEW.propagation_run_id
    ) IS NULL
      THEN RAISE(ABORT,'linked propagation completion is invalid')
    WHEN NEW.propagation_run_id IS NOT NULL AND julianday(NEW.completed_at) < (
      SELECT julianday(completed_at) FROM backup_propagation_runs WHERE id=NEW.propagation_run_id
    )
      THEN RAISE(ABORT,'clean rewrite completion precedes linked propagation completion')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_chronology_update
BEFORE UPDATE OF status,propagation_run_id,started_at,completed_at ON backup_clean_rewrite_runs
WHEN NEW.completed_at IS NOT NULL
BEGIN
  SELECT CASE
    WHEN julianday(NEW.started_at) IS NULL OR julianday(NEW.completed_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite chronology timestamp is invalid')
    WHEN julianday(NEW.completed_at) < julianday(NEW.started_at)
      THEN RAISE(ABORT,'clean rewrite completion precedes start')
    WHEN NEW.status IN ('success','partial') AND NEW.propagation_run_id IS NULL
      THEN RAISE(ABORT,'successful or partial clean rewrite requires propagation run')
    WHEN NEW.propagation_run_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM backup_propagation_runs WHERE id=NEW.propagation_run_id
    )
      THEN RAISE(ABORT,'linked propagation run is missing')
    WHEN NEW.propagation_run_id IS NOT NULL AND (
      SELECT julianday(completed_at) FROM backup_propagation_runs WHERE id=NEW.propagation_run_id
    ) IS NULL
      THEN RAISE(ABORT,'linked propagation completion is invalid')
    WHEN NEW.propagation_run_id IS NOT NULL AND julianday(NEW.completed_at) < (
      SELECT julianday(completed_at) FROM backup_propagation_runs WHERE id=NEW.propagation_run_id
    )
      THEN RAISE(ABORT,'clean rewrite completion precedes linked propagation completion')
  END;
END;
CREATE INDEX IF NOT EXISTS idx_backup_clean_rewrite_runs_propagation
ON backup_clean_rewrite_runs(propagation_run_id,completed_at DESC)
WHERE propagation_run_id IS NOT NULL;
UPDATE database_metadata
SET value='REVISION-186-CLEAN-BACKUP-LINKED-CHRONOLOGY',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;


const cleanBackupRewriteRecoveryChronologySql = `CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_policy_state_insert
BEFORE INSERT ON backup_clean_rewrite_policy
BEGIN
  SELECT CASE
    WHEN julianday(NEW.updated_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite policy updated timestamp is invalid')
    WHEN NEW.state='running' AND (NEW.in_progress_run_id IS NULL OR NEW.in_progress_started_at IS NULL)
      THEN RAISE(ABORT,'running clean rewrite policy requires owner and start')
    WHEN NEW.state<>'running' AND (NEW.in_progress_run_id IS NOT NULL OR NEW.in_progress_started_at IS NOT NULL)
      THEN RAISE(ABORT,'non-running clean rewrite policy cannot retain owner')
    WHEN NEW.state IN ('running','idle') AND NEW.next_attempt_at IS NOT NULL
      THEN RAISE(ABORT,'running or idle clean rewrite policy cannot retain next attempt')
    WHEN NEW.state IN ('backoff','deferred','attention') AND NEW.next_attempt_at IS NULL
      THEN RAISE(ABORT,'non-idle clean rewrite policy requires next attempt')
    WHEN NEW.next_attempt_at IS NOT NULL AND julianday(NEW.next_attempt_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite policy next attempt is invalid')
    WHEN NEW.next_attempt_at IS NOT NULL AND julianday(NEW.next_attempt_at) < julianday(NEW.updated_at)
      THEN RAISE(ABORT,'clean rewrite policy next attempt precedes update')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_policy_state_update
BEFORE UPDATE OF state,next_attempt_at,in_progress_run_id,in_progress_started_at,updated_at ON backup_clean_rewrite_policy
BEGIN
  SELECT CASE
    WHEN julianday(NEW.updated_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite policy updated timestamp is invalid')
    WHEN NEW.state='running' AND (NEW.in_progress_run_id IS NULL OR NEW.in_progress_started_at IS NULL)
      THEN RAISE(ABORT,'running clean rewrite policy requires owner and start')
    WHEN NEW.state<>'running' AND (NEW.in_progress_run_id IS NOT NULL OR NEW.in_progress_started_at IS NOT NULL)
      THEN RAISE(ABORT,'non-running clean rewrite policy cannot retain owner')
    WHEN NEW.state IN ('running','idle') AND NEW.next_attempt_at IS NOT NULL
      THEN RAISE(ABORT,'running or idle clean rewrite policy cannot retain next attempt')
    WHEN NEW.state IN ('backoff','deferred','attention') AND NEW.next_attempt_at IS NULL
      THEN RAISE(ABORT,'non-idle clean rewrite policy requires next attempt')
    WHEN NEW.next_attempt_at IS NOT NULL AND julianday(NEW.next_attempt_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite policy next attempt is invalid')
    WHEN NEW.next_attempt_at IS NOT NULL AND julianday(NEW.next_attempt_at) < julianday(NEW.updated_at)
      THEN RAISE(ABORT,'clean rewrite policy next attempt precedes update')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_retry_insert
BEFORE INSERT ON backup_clean_rewrite_runs
BEGIN
  SELECT CASE
    WHEN NEW.status='running' AND (NEW.completed_at IS NOT NULL OR NEW.next_attempt_at IS NOT NULL)
      THEN RAISE(ABORT,'running clean rewrite run cannot be completed or scheduled')
    WHEN NEW.status<>'running' AND NEW.completed_at IS NULL
      THEN RAISE(ABORT,'completed clean rewrite run requires completion time')
    WHEN NEW.status='success' AND NEW.next_attempt_at IS NOT NULL
      THEN RAISE(ABORT,'successful clean rewrite run cannot retain next attempt')
    WHEN NEW.status IN ('partial','failed','attention','deferred','interrupted') AND NEW.next_attempt_at IS NULL
      THEN RAISE(ABORT,'non-success clean rewrite run requires next attempt')
    WHEN NEW.next_attempt_at IS NOT NULL AND julianday(NEW.next_attempt_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite run next attempt is invalid')
    WHEN NEW.next_attempt_at IS NOT NULL AND julianday(NEW.completed_at) IS NOT NULL AND julianday(NEW.next_attempt_at) < julianday(NEW.completed_at)
      THEN RAISE(ABORT,'clean rewrite run next attempt precedes completion')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_retry_update
BEFORE UPDATE OF status,next_attempt_at,completed_at ON backup_clean_rewrite_runs
BEGIN
  SELECT CASE
    WHEN NEW.status='running' AND (NEW.completed_at IS NOT NULL OR NEW.next_attempt_at IS NOT NULL)
      THEN RAISE(ABORT,'running clean rewrite run cannot be completed or scheduled')
    WHEN NEW.status<>'running' AND NEW.completed_at IS NULL
      THEN RAISE(ABORT,'completed clean rewrite run requires completion time')
    WHEN NEW.status='success' AND NEW.next_attempt_at IS NOT NULL
      THEN RAISE(ABORT,'successful clean rewrite run cannot retain next attempt')
    WHEN NEW.status IN ('partial','failed','attention','deferred','interrupted') AND NEW.next_attempt_at IS NULL
      THEN RAISE(ABORT,'non-success clean rewrite run requires next attempt')
    WHEN NEW.next_attempt_at IS NOT NULL AND julianday(NEW.next_attempt_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite run next attempt is invalid')
    WHEN NEW.next_attempt_at IS NOT NULL AND julianday(NEW.completed_at) IS NOT NULL AND julianday(NEW.next_attempt_at) < julianday(NEW.completed_at)
      THEN RAISE(ABORT,'clean rewrite run next attempt precedes completion')
  END;
END;
UPDATE database_metadata
SET value='REVISION-187-CLEAN-BACKUP-RECOVERY-CHRONOLOGY',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;


const cleanBackupRewriteClaimChronologySql = `CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_policy_claim_chronology
BEFORE UPDATE OF state,last_attempt_at,last_success_at,in_progress_run_id,in_progress_started_at,updated_at ON backup_clean_rewrite_policy
BEGIN
  SELECT CASE
    WHEN julianday(NEW.updated_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite policy update chronology is invalid')
    WHEN julianday(OLD.updated_at) IS NULL
      THEN RAISE(ABORT,'persisted clean rewrite policy chronology is invalid')
    WHEN julianday(NEW.updated_at) < julianday(OLD.updated_at)
      THEN RAISE(ABORT,'clean rewrite policy update regresses chronology')
    WHEN OLD.last_attempt_at IS NOT NULL AND NEW.last_attempt_at IS NOT NULL AND julianday(NEW.last_attempt_at) < julianday(OLD.last_attempt_at)
      THEN RAISE(ABORT,'clean rewrite last attempt regresses chronology')
    WHEN OLD.last_success_at IS NOT NULL AND NEW.last_success_at IS NOT NULL AND julianday(NEW.last_success_at) < julianday(OLD.last_success_at)
      THEN RAISE(ABORT,'clean rewrite last success regresses chronology')
    WHEN NEW.state='running' AND (julianday(NEW.last_attempt_at) IS NULL OR julianday(NEW.in_progress_started_at) IS NULL)
      THEN RAISE(ABORT,'clean rewrite claim chronology is invalid')
    WHEN NEW.state='running' AND julianday(NEW.last_attempt_at) <> julianday(NEW.in_progress_started_at)
      THEN RAISE(ABORT,'clean rewrite claim owner chronology differs')
    WHEN NEW.state='running' AND julianday(NEW.updated_at) <> julianday(NEW.in_progress_started_at)
      THEN RAISE(ABORT,'clean rewrite claim update chronology differs')
    WHEN NEW.state='running' AND julianday(NEW.in_progress_started_at) < julianday(OLD.updated_at)
      THEN RAISE(ABORT,'clean rewrite claim precedes persisted policy update')
    WHEN NEW.state='running' AND OLD.last_attempt_at IS NOT NULL AND julianday(NEW.in_progress_started_at) < julianday(OLD.last_attempt_at)
      THEN RAISE(ABORT,'clean rewrite claim precedes last attempt')
    WHEN NEW.state='running' AND OLD.last_success_at IS NOT NULL AND julianday(NEW.in_progress_started_at) < julianday(OLD.last_success_at)
      THEN RAISE(ABORT,'clean rewrite claim precedes last success')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_claim_insert
BEFORE INSERT ON backup_clean_rewrite_runs
BEGIN
  SELECT CASE
    WHEN julianday(NEW.started_at) IS NULL OR julianday(NEW.retention_cutoff) IS NULL OR julianday(NEW.updated_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite run claim chronology is invalid')
    WHEN julianday(NEW.retention_cutoff) > julianday(NEW.started_at)
      THEN RAISE(ABORT,'clean rewrite retention cutoff follows start')
    WHEN julianday(NEW.updated_at) < julianday(NEW.started_at)
      THEN RAISE(ABORT,'clean rewrite run update precedes start')
    WHEN NEW.status='running' AND julianday(NEW.updated_at) <> julianday(NEW.started_at)
      THEN RAISE(ABORT,'running clean rewrite claim timestamps differ')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_claim_update
BEFORE UPDATE OF started_at,retention_cutoff,updated_at ON backup_clean_rewrite_runs
BEGIN
  SELECT CASE
    WHEN NEW.started_at <> OLD.started_at
      THEN RAISE(ABORT,'clean rewrite run start is immutable')
    WHEN NEW.retention_cutoff <> OLD.retention_cutoff
      THEN RAISE(ABORT,'clean rewrite retention cutoff is immutable')
    WHEN julianday(NEW.updated_at) IS NULL OR julianday(OLD.updated_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite run update chronology is invalid')
    WHEN julianday(NEW.updated_at) < julianday(OLD.updated_at)
      THEN RAISE(ABORT,'clean rewrite run update regresses chronology')
    WHEN julianday(NEW.updated_at) < julianday(NEW.started_at)
      THEN RAISE(ABORT,'clean rewrite run update precedes start')
  END;
END;
CREATE UNIQUE INDEX IF NOT EXISTS idx_backup_clean_rewrite_runs_single_running
ON backup_clean_rewrite_runs(status)
WHERE status='running';
UPDATE database_metadata
SET value='REVISION-188-CLEAN-BACKUP-CLAIM-CHRONOLOGY',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const cleanBackupRewriteOperationalIsolationSql = `CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_policy_active_settings_lock
BEFORE UPDATE OF enabled,retention_days,manual_failure_backoff_minutes,automatic_failure_backoff_minutes,high_load_defer_minutes ON backup_clean_rewrite_policy
WHEN OLD.state='running' AND (
  NEW.enabled<>OLD.enabled OR
  NEW.retention_days<>OLD.retention_days OR
  NEW.manual_failure_backoff_minutes<>OLD.manual_failure_backoff_minutes OR
  NEW.automatic_failure_backoff_minutes<>OLD.automatic_failure_backoff_minutes OR
  NEW.high_load_defer_minutes<>OLD.high_load_defer_minutes
)
BEGIN
  SELECT RAISE(ABORT,'active clean rewrite policy settings are locked');
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_terminal_consistency_update
BEFORE UPDATE OF status,propagation_run_id,next_attempt_at,error,completed_at,updated_at ON backup_clean_rewrite_runs
WHEN OLD.status='running' AND NEW.status<>'running'
BEGIN
  SELECT CASE
    WHEN NOT EXISTS(
      SELECT 1 FROM backup_clean_rewrite_policy policy
      WHERE policy.id='default'
        AND policy.state=CASE NEW.status
          WHEN 'success' THEN 'idle'
          WHEN 'partial' THEN 'backoff'
          WHEN 'failed' THEN 'backoff'
          WHEN 'interrupted' THEN 'backoff'
          WHEN 'attention' THEN 'attention'
          WHEN 'deferred' THEN 'deferred'
        END
        AND policy.last_outcome=CASE NEW.status WHEN 'interrupted' THEN 'failed' ELSE NEW.status END
        AND policy.last_trigger=NEW.trigger
        AND policy.in_progress_run_id IS NULL
        AND policy.in_progress_started_at IS NULL
        AND julianday(policy.updated_at)=julianday(NEW.completed_at)
        AND julianday(policy.last_attempt_at)=julianday(NEW.started_at)
        AND COALESCE(policy.next_attempt_at,'')=COALESCE(NEW.next_attempt_at,'')
        AND COALESCE(policy.last_error,'')=COALESCE(NEW.error,'')
    ) THEN RAISE(ABORT,'clean rewrite terminal policy and run state differ')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_terminal_consistency_insert
BEFORE INSERT ON backup_clean_rewrite_runs
WHEN NEW.status<>'running'
BEGIN
  SELECT CASE
    WHEN NOT EXISTS(
      SELECT 1 FROM backup_clean_rewrite_policy policy
      WHERE policy.id='default'
        AND policy.state=CASE NEW.status
          WHEN 'success' THEN 'idle'
          WHEN 'partial' THEN 'backoff'
          WHEN 'failed' THEN 'backoff'
          WHEN 'interrupted' THEN 'backoff'
          WHEN 'attention' THEN 'attention'
          WHEN 'deferred' THEN 'deferred'
        END
        AND policy.last_outcome=CASE NEW.status WHEN 'interrupted' THEN 'failed' ELSE NEW.status END
        AND policy.last_trigger=NEW.trigger
        AND policy.in_progress_run_id IS NULL
        AND policy.in_progress_started_at IS NULL
        AND julianday(policy.updated_at)=julianday(NEW.completed_at)
        AND julianday(policy.last_attempt_at)=julianday(NEW.started_at)
        AND COALESCE(policy.next_attempt_at,'')=COALESCE(NEW.next_attempt_at,'')
        AND COALESCE(policy.last_error,'')=COALESCE(NEW.error,'')
    ) THEN RAISE(ABORT,'clean rewrite terminal policy and run state differ')
  END;
END;
UPDATE database_metadata
SET value='REVISION-189-CLEAN-BACKUP-OPERATIONAL-ISOLATION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const cleanBackupRewriteTriggerAwareBackoffSql = `CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_policy_trigger_backoff_insert
BEFORE INSERT ON backup_clean_rewrite_policy
WHEN NEW.state IN ('backoff','deferred','attention')
BEGIN
  SELECT CASE
    WHEN NEW.last_trigger IS NULL OR NEW.last_trigger NOT IN ('manual','automatic')
      THEN RAISE(ABORT,'clean rewrite retry trigger is invalid')
    WHEN NEW.next_attempt_at IS NULL OR julianday(NEW.next_attempt_at) IS NULL OR julianday(NEW.updated_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite trigger-aware retry chronology is invalid')
    WHEN ABS(
      (julianday(NEW.next_attempt_at)-julianday(NEW.updated_at))*1440.0 -
      CASE
        WHEN NEW.state='deferred' THEN NEW.high_load_defer_minutes
        WHEN NEW.last_trigger='manual' THEN NEW.manual_failure_backoff_minutes
        ELSE NEW.automatic_failure_backoff_minutes
      END
    ) > 0.00005
      THEN RAISE(ABORT,'clean rewrite policy retry delay differs from trigger policy')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_policy_trigger_backoff_update
BEFORE UPDATE OF state,last_outcome,last_trigger,next_attempt_at,updated_at ON backup_clean_rewrite_policy
WHEN NEW.state IN ('backoff','deferred','attention')
BEGIN
  SELECT CASE
    WHEN NEW.last_trigger IS NULL OR NEW.last_trigger NOT IN ('manual','automatic')
      THEN RAISE(ABORT,'clean rewrite retry trigger is invalid')
    WHEN NEW.next_attempt_at IS NULL OR julianday(NEW.next_attempt_at) IS NULL OR julianday(NEW.updated_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite trigger-aware retry chronology is invalid')
    WHEN ABS(
      (julianday(NEW.next_attempt_at)-julianday(NEW.updated_at))*1440.0 -
      CASE
        WHEN NEW.state='deferred' THEN NEW.high_load_defer_minutes
        WHEN NEW.last_trigger='manual' THEN NEW.manual_failure_backoff_minutes
        ELSE NEW.automatic_failure_backoff_minutes
      END
    ) > 0.00005
      THEN RAISE(ABORT,'clean rewrite policy retry delay differs from trigger policy')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_trigger_backoff_insert
BEFORE INSERT ON backup_clean_rewrite_runs
WHEN NEW.status IN ('partial','failed','attention','deferred','interrupted')
BEGIN
  SELECT CASE
    WHEN NEW.next_attempt_at IS NULL OR julianday(NEW.next_attempt_at) IS NULL OR julianday(NEW.completed_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite run trigger-aware retry chronology is invalid')
    WHEN ABS(
      (julianday(NEW.next_attempt_at)-julianday(NEW.completed_at))*1440.0 -
      CASE
        WHEN NEW.status='deferred' THEN COALESCE((SELECT high_load_defer_minutes FROM backup_clean_rewrite_policy WHERE id='default'),-1)
        WHEN NEW.trigger='manual' THEN COALESCE((SELECT manual_failure_backoff_minutes FROM backup_clean_rewrite_policy WHERE id='default'),-1)
        ELSE COALESCE((SELECT automatic_failure_backoff_minutes FROM backup_clean_rewrite_policy WHERE id='default'),-1)
      END
    ) > 0.00005
      THEN RAISE(ABORT,'clean rewrite run retry delay differs from trigger policy')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_trigger_backoff_update
BEFORE UPDATE OF status,trigger,next_attempt_at,completed_at ON backup_clean_rewrite_runs
WHEN NEW.status IN ('partial','failed','attention','deferred','interrupted')
BEGIN
  SELECT CASE
    WHEN NEW.next_attempt_at IS NULL OR julianday(NEW.next_attempt_at) IS NULL OR julianday(NEW.completed_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite run trigger-aware retry chronology is invalid')
    WHEN ABS(
      (julianday(NEW.next_attempt_at)-julianday(NEW.completed_at))*1440.0 -
      CASE
        WHEN NEW.status='deferred' THEN COALESCE((SELECT high_load_defer_minutes FROM backup_clean_rewrite_policy WHERE id='default'),-1)
        WHEN NEW.trigger='manual' THEN COALESCE((SELECT manual_failure_backoff_minutes FROM backup_clean_rewrite_policy WHERE id='default'),-1)
        ELSE COALESCE((SELECT automatic_failure_backoff_minutes FROM backup_clean_rewrite_policy WHERE id='default'),-1)
      END
    ) > 0.00005
      THEN RAISE(ABORT,'clean rewrite run retry delay differs from trigger policy')
  END;
END;
UPDATE database_metadata
SET value='REVISION-191-CLEAN-BACKUP-TRIGGER-AWARE-BACKOFF',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const cleanBackupRewriteManualAvailabilitySql = `CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_policy_manual_availability_insert
BEFORE INSERT ON backup_clean_rewrite_policy
WHEN NEW.state='running'
BEGIN
  SELECT CASE
    WHEN NEW.last_trigger IS NULL OR NEW.last_trigger NOT IN ('manual','automatic')
      THEN RAISE(ABORT,'running clean rewrite policy trigger is invalid')
    WHEN NEW.enabled=0 AND NEW.last_trigger<>'manual'
      THEN RAISE(ABORT,'disabled clean rewrite policy permits manual runs only')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_policy_manual_availability_update
BEFORE UPDATE OF enabled,state,last_trigger,in_progress_run_id,in_progress_started_at ON backup_clean_rewrite_policy
WHEN NEW.state='running'
BEGIN
  SELECT CASE
    WHEN NEW.last_trigger IS NULL OR NEW.last_trigger NOT IN ('manual','automatic')
      THEN RAISE(ABORT,'running clean rewrite policy trigger is invalid')
    WHEN NEW.enabled=0 AND NEW.last_trigger<>'manual'
      THEN RAISE(ABORT,'disabled clean rewrite policy permits manual runs only')
  END;
END;
UPDATE database_metadata
SET value='REVISION-192-CLEAN-BACKUP-MANUAL-AVAILABILITY',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;


const cleanBackupRewriteRunningLedgerIdentitySql = `CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_running_identity_insert
BEFORE INSERT ON backup_clean_rewrite_runs
WHEN NEW.status='running'
BEGIN
  SELECT CASE
    WHEN NOT EXISTS(
      SELECT 1 FROM backup_clean_rewrite_policy policy
      WHERE policy.id='default'
        AND policy.state='running'
        AND policy.in_progress_run_id=NEW.id
        AND policy.last_trigger=NEW.trigger
        AND julianday(policy.in_progress_started_at)=julianday(NEW.started_at)
        AND julianday(policy.last_attempt_at)=julianday(NEW.started_at)
        AND julianday(policy.updated_at)=julianday(NEW.updated_at)
    ) THEN RAISE(ABORT,'running clean rewrite ledger does not match policy owner')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_running_identity_update
BEFORE UPDATE OF id,trigger,status,started_at,updated_at ON backup_clean_rewrite_runs
WHEN NEW.status='running'
BEGIN
  SELECT CASE
    WHEN NOT EXISTS(
      SELECT 1 FROM backup_clean_rewrite_policy policy
      WHERE policy.id='default'
        AND policy.state='running'
        AND policy.in_progress_run_id=NEW.id
        AND policy.last_trigger=NEW.trigger
        AND julianday(policy.in_progress_started_at)=julianday(NEW.started_at)
        AND julianday(policy.last_attempt_at)=julianday(NEW.started_at)
        AND julianday(policy.updated_at)=julianday(NEW.updated_at)
    ) THEN RAISE(ABORT,'running clean rewrite ledger does not match policy owner')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_running_identity_delete
BEFORE DELETE ON backup_clean_rewrite_runs
WHEN OLD.status='running' AND EXISTS(
  SELECT 1 FROM backup_clean_rewrite_policy policy
  WHERE policy.id='default' AND policy.state='running' AND policy.in_progress_run_id=OLD.id
)
BEGIN
  SELECT RAISE(ABORT,'active running clean rewrite ledger cannot be deleted');
END;
UPDATE database_metadata
SET value='REVISION-193-CLEAN-BACKUP-RUNNING-LEDGER-IDENTITY',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;


const cleanBackupRewriteClaimReservationSql = `CREATE TABLE IF NOT EXISTS backup_clean_rewrite_claim_reservations(
  run_id TEXT PRIMARY KEY CHECK(length(trim(run_id))>0),
  trigger TEXT NOT NULL CHECK(trigger IN ('manual','automatic')),
  started_at TEXT NOT NULL,
  retention_cutoff TEXT NOT NULL,
  due_records INTEGER NOT NULL CHECK(due_records>=0),
  enabled_targets INTEGER NOT NULL CHECK(enabled_targets>=0),
  state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','consumed')),
  created_at TEXT NOT NULL,
  consumed_at TEXT
);
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_claim_reservation_insert
BEFORE INSERT ON backup_clean_rewrite_claim_reservations
BEGIN
  SELECT CASE
    WHEN julianday(NEW.started_at) IS NULL OR julianday(NEW.retention_cutoff) IS NULL OR julianday(NEW.created_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite claim reservation chronology is invalid')
    WHEN julianday(NEW.created_at)<>julianday(NEW.started_at)
      THEN RAISE(ABORT,'clean rewrite claim reservation creation differs from start')
    WHEN julianday(NEW.retention_cutoff)>julianday(NEW.started_at)
      THEN RAISE(ABORT,'clean rewrite claim reservation cutoff follows start')
    WHEN NEW.state<>'open' OR NEW.consumed_at IS NOT NULL
      THEN RAISE(ABORT,'new clean rewrite claim reservation must be open')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_claim_reservation_update
BEFORE UPDATE ON backup_clean_rewrite_claim_reservations
BEGIN
  SELECT CASE
    WHEN NEW.run_id<>OLD.run_id OR NEW.trigger<>OLD.trigger OR NEW.started_at<>OLD.started_at OR NEW.retention_cutoff<>OLD.retention_cutoff OR NEW.due_records<>OLD.due_records OR NEW.enabled_targets<>OLD.enabled_targets OR NEW.created_at<>OLD.created_at
      THEN RAISE(ABORT,'clean rewrite claim reservation identity is immutable')
    WHEN OLD.state='consumed'
      THEN RAISE(ABORT,'consumed clean rewrite claim reservation is immutable')
    WHEN NEW.state<>'consumed' OR julianday(NEW.consumed_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite claim reservation may only be consumed')
    WHEN julianday(NEW.consumed_at)<julianday(NEW.started_at)
      THEN RAISE(ABORT,'clean rewrite claim reservation consumption precedes start')
    WHEN NOT EXISTS(
      SELECT 1 FROM backup_clean_rewrite_policy policy
      JOIN backup_clean_rewrite_runs run ON run.id=NEW.run_id
      WHERE policy.id='default' AND policy.state='running' AND policy.in_progress_run_id=NEW.run_id
        AND policy.last_trigger=NEW.trigger AND julianday(policy.in_progress_started_at)=julianday(NEW.started_at)
        AND run.status='running' AND run.trigger=NEW.trigger AND julianday(run.started_at)=julianday(NEW.started_at)
    ) THEN RAISE(ABORT,'clean rewrite claim reservation cannot be consumed before ownership is established')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_policy_claim_reservation_update
BEFORE UPDATE OF state,last_trigger,in_progress_run_id,in_progress_started_at ON backup_clean_rewrite_policy
WHEN NEW.state='running'
BEGIN
  SELECT CASE
    WHEN NOT EXISTS(
      SELECT 1 FROM backup_clean_rewrite_claim_reservations reservation
      WHERE reservation.run_id=NEW.in_progress_run_id AND reservation.state='open'
        AND reservation.trigger=NEW.last_trigger
        AND julianday(reservation.started_at)=julianday(NEW.in_progress_started_at)
        AND julianday(reservation.started_at)=julianday(NEW.updated_at)
    ) THEN RAISE(ABORT,'clean rewrite policy claim requires matching open reservation')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_claim_reservation_insert
BEFORE INSERT ON backup_clean_rewrite_runs
WHEN NEW.status='running'
BEGIN
  SELECT CASE
    WHEN NOT EXISTS(
      SELECT 1 FROM backup_clean_rewrite_claim_reservations reservation
      WHERE reservation.run_id=NEW.id AND reservation.state='open'
        AND reservation.trigger=NEW.trigger
        AND julianday(reservation.started_at)=julianday(NEW.started_at)
        AND reservation.retention_cutoff=NEW.retention_cutoff
        AND reservation.due_records=NEW.due_records
        AND reservation.enabled_targets=NEW.enabled_targets
    ) THEN RAISE(ABORT,'running clean rewrite ledger requires matching open reservation')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_claim_reservation_delete
BEFORE DELETE ON backup_clean_rewrite_claim_reservations
WHEN OLD.state='consumed'
BEGIN
  SELECT RAISE(ABORT,'consumed clean rewrite claim reservation cannot be deleted');
END;
UPDATE database_metadata
SET value='REVISION-194-CLEAN-BACKUP-CLAIM-RESERVATION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;


const cleanBackupRewriteActiveOwnershipSnapshotSql = `CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_policy_active_snapshot_update
BEFORE UPDATE OF last_trigger,last_attempt_at,in_progress_run_id,in_progress_started_at,updated_at ON backup_clean_rewrite_policy
WHEN OLD.state='running' AND NEW.state='running'
BEGIN
  SELECT CASE
    WHEN NEW.last_trigger IS NOT OLD.last_trigger
      OR NEW.last_attempt_at IS NOT OLD.last_attempt_at
      OR NEW.in_progress_run_id IS NOT OLD.in_progress_run_id
      OR NEW.in_progress_started_at IS NOT OLD.in_progress_started_at
      OR NEW.updated_at IS NOT OLD.updated_at
      THEN RAISE(ABORT,'active clean rewrite policy ownership snapshot is immutable')
    WHEN NOT EXISTS(
      SELECT 1 FROM backup_clean_rewrite_claim_reservations reservation
      JOIN backup_clean_rewrite_runs run ON run.id=reservation.run_id
      WHERE reservation.run_id=NEW.in_progress_run_id AND reservation.state='consumed'
        AND reservation.trigger=NEW.last_trigger
        AND julianday(reservation.started_at)=julianday(NEW.in_progress_started_at)
        AND julianday(reservation.started_at)=julianday(NEW.last_attempt_at)
        AND julianday(reservation.started_at)=julianday(NEW.updated_at)
        AND run.status='running' AND run.trigger=reservation.trigger
        AND run.retention_cutoff=reservation.retention_cutoff
        AND run.due_records=reservation.due_records
        AND run.enabled_targets=reservation.enabled_targets
        AND julianday(run.started_at)=julianday(reservation.started_at)
        AND julianday(run.updated_at)=julianday(reservation.started_at)
    ) THEN RAISE(ABORT,'active clean rewrite policy snapshot lacks consumed claim ownership')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_active_snapshot_update
BEFORE UPDATE OF id,trigger,retention_cutoff,due_records,enabled_targets,propagation_run_id,next_attempt_at,error,started_at,completed_at,updated_at ON backup_clean_rewrite_runs
WHEN OLD.status='running' AND NEW.status='running'
BEGIN
  SELECT CASE
    WHEN NEW.id IS NOT OLD.id
      OR NEW.trigger IS NOT OLD.trigger
      OR NEW.retention_cutoff IS NOT OLD.retention_cutoff
      OR NEW.due_records IS NOT OLD.due_records
      OR NEW.enabled_targets IS NOT OLD.enabled_targets
      OR NEW.propagation_run_id IS NOT OLD.propagation_run_id
      OR NEW.next_attempt_at IS NOT OLD.next_attempt_at
      OR NEW.error IS NOT OLD.error
      OR NEW.started_at IS NOT OLD.started_at
      OR NEW.completed_at IS NOT OLD.completed_at
      OR NEW.updated_at IS NOT OLD.updated_at
      THEN RAISE(ABORT,'active clean rewrite ledger snapshot is immutable')
    WHEN NOT EXISTS(
      SELECT 1 FROM backup_clean_rewrite_claim_reservations reservation
      JOIN backup_clean_rewrite_policy policy ON policy.id='default'
      WHERE reservation.run_id=NEW.id AND reservation.state='consumed'
        AND reservation.trigger=NEW.trigger
        AND reservation.retention_cutoff=NEW.retention_cutoff
        AND reservation.due_records=NEW.due_records
        AND reservation.enabled_targets=NEW.enabled_targets
        AND julianday(reservation.started_at)=julianday(NEW.started_at)
        AND julianday(reservation.started_at)=julianday(NEW.updated_at)
        AND policy.state='running' AND policy.in_progress_run_id=NEW.id
        AND policy.last_trigger=NEW.trigger
        AND julianday(policy.in_progress_started_at)=julianday(NEW.started_at)
        AND julianday(policy.last_attempt_at)=julianday(NEW.started_at)
        AND julianday(policy.updated_at)=julianday(NEW.updated_at)
    ) THEN RAISE(ABORT,'active clean rewrite ledger snapshot lacks consumed claim ownership')
  END;
END;
UPDATE database_metadata
SET value='REVISION-195-CLEAN-BACKUP-ACTIVE-OWNERSHIP-SNAPSHOT',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const cleanBackupRewriteActivePolicyParametersSql = `CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_policy_active_parameters_update
BEFORE UPDATE OF enabled,retention_days,manual_failure_backoff_minutes,automatic_failure_backoff_minutes,high_load_defer_minutes,created_at ON backup_clean_rewrite_policy
WHEN OLD.state='running'
BEGIN
  SELECT CASE
    WHEN NEW.enabled IS NOT OLD.enabled
      OR NEW.retention_days IS NOT OLD.retention_days
      OR NEW.manual_failure_backoff_minutes IS NOT OLD.manual_failure_backoff_minutes
      OR NEW.automatic_failure_backoff_minutes IS NOT OLD.automatic_failure_backoff_minutes
      OR NEW.high_load_defer_minutes IS NOT OLD.high_load_defer_minutes
      OR NEW.created_at IS NOT OLD.created_at
      THEN RAISE(ABORT,'active clean rewrite policy execution parameters are immutable')
  END;
END;
UPDATE database_metadata
SET value='REVISION-196-CLEAN-BACKUP-ACTIVE-POLICY-PARAMETERS',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const accountSecurityEpochSql = `ALTER TABLE accounts
ADD COLUMN security_epoch INTEGER NOT NULL DEFAULT 0 CHECK(security_epoch BETWEEN 0 AND 2147483647);
ALTER TABLE trusted_devices
ADD COLUMN security_epoch INTEGER NOT NULL DEFAULT 0 CHECK(security_epoch BETWEEN 0 AND 2147483647);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_account_security_epoch
ON trusted_devices(account_id,security_epoch,revoked_at,last_seen_at DESC);
UPDATE database_metadata
SET value='REVISION-175-ACCOUNT-SECURITY-EPOCH',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

export const LEGACY_MVP40_SCHEMA_FINGERPRINT = asSha256(
  '45fedc9c9dc9d4456a7b5829809cd4e23bb4e837070a57e8e5608f89a0d39569'
);

export const MVP54_APPLICATION_SCHEMA_FINGERPRINT = asSha256(
  '1792e245001eed0a8e6d293390b9d565adccf2e84f312c82a70280d1ec6ec0c9'
);

export const MVP55_APPLICATION_SCHEMA_FINGERPRINT = asSha256(
  '1792e245001eed0a8e6d293390b9d565adccf2e84f312c82a70280d1ec6ec0c9'
);

export const MVP56_APPLICATION_SCHEMA_FINGERPRINT = asSha256(
  '33b93d5b2479e83d4af415e150ac837c61f58ba9137a89432644527e0246a49b'
);


const cleanBackupRewriteAtomicTerminalTransitionSql = `DROP TRIGGER IF EXISTS trg_backup_clean_rewrite_runs_terminal_consistency_update;
DROP TRIGGER IF EXISTS trg_backup_clean_rewrite_runs_terminal_consistency_insert;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_policy_terminal_transition_update
BEFORE UPDATE OF state,last_outcome,consecutive_failures,last_success_at,next_attempt_at,last_error,in_progress_run_id,in_progress_started_at,updated_at ON backup_clean_rewrite_policy
WHEN OLD.state='running' AND NEW.state<>'running'
BEGIN
  SELECT CASE
    WHEN OLD.in_progress_run_id IS NULL
      THEN RAISE(ABORT,'clean rewrite terminal policy transition lacks active owner')
    WHEN NOT EXISTS(
      SELECT 1 FROM backup_clean_rewrite_runs run
      WHERE run.id=OLD.in_progress_run_id
        AND run.status<>'running'
        AND run.trigger=OLD.last_trigger
        AND NEW.state=CASE run.status
          WHEN 'success' THEN 'idle'
          WHEN 'partial' THEN 'backoff'
          WHEN 'failed' THEN 'backoff'
          WHEN 'interrupted' THEN 'backoff'
          WHEN 'attention' THEN 'attention'
          WHEN 'deferred' THEN 'deferred'
        END
        AND NEW.last_outcome=CASE run.status WHEN 'interrupted' THEN 'failed' ELSE run.status END
        AND NEW.consecutive_failures=CASE
          WHEN run.status='success' THEN 0
          WHEN run.status IN ('partial','failed','interrupted') THEN OLD.consecutive_failures+1
          ELSE OLD.consecutive_failures
        END
        AND (
          (run.status='success' AND julianday(NEW.last_success_at)=julianday(run.completed_at))
          OR (run.status<>'success' AND NEW.last_success_at IS OLD.last_success_at)
        )
        AND NEW.in_progress_run_id IS NULL
        AND NEW.in_progress_started_at IS NULL
        AND julianday(NEW.updated_at)=julianday(run.completed_at)
        AND julianday(OLD.last_attempt_at)=julianday(run.started_at)
        AND COALESCE(NEW.next_attempt_at,'')=COALESCE(run.next_attempt_at,'')
        AND COALESCE(NEW.last_error,'')=COALESCE(run.error,'')
    ) THEN RAISE(ABORT,'clean rewrite policy terminal transition requires finalized owner ledger')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_terminal_consistency_update
BEFORE UPDATE OF id,trigger,status,retention_cutoff,due_records,enabled_targets,propagation_run_id,next_attempt_at,error,started_at,completed_at,updated_at ON backup_clean_rewrite_runs
WHEN OLD.status='running' AND NEW.status<>'running'
BEGIN
  SELECT CASE
    WHEN NEW.id IS NOT OLD.id OR NEW.trigger IS NOT OLD.trigger
      OR NEW.retention_cutoff IS NOT OLD.retention_cutoff
      OR NEW.due_records IS NOT OLD.due_records
      OR NEW.enabled_targets IS NOT OLD.enabled_targets
      OR NEW.started_at IS NOT OLD.started_at
      THEN RAISE(ABORT,'clean rewrite terminal transition cannot mutate active workload identity')
    WHEN julianday(NEW.completed_at) IS NULL OR julianday(NEW.updated_at) IS NULL
      OR julianday(NEW.completed_at)<>julianday(NEW.updated_at)
      THEN RAISE(ABORT,'clean rewrite terminal transition completion chronology is invalid')
    WHEN NOT EXISTS(
      SELECT 1 FROM backup_clean_rewrite_policy policy
      JOIN backup_clean_rewrite_claim_reservations reservation ON reservation.run_id=OLD.id
      WHERE policy.id='default' AND policy.state='running' AND policy.in_progress_run_id=OLD.id
        AND policy.last_trigger=OLD.trigger
        AND julianday(policy.in_progress_started_at)=julianday(OLD.started_at)
        AND julianday(policy.last_attempt_at)=julianday(OLD.started_at)
        AND reservation.state='consumed' AND reservation.trigger=OLD.trigger
        AND reservation.retention_cutoff=OLD.retention_cutoff
        AND reservation.due_records=OLD.due_records
        AND reservation.enabled_targets=OLD.enabled_targets
        AND julianday(reservation.started_at)=julianday(OLD.started_at)
    ) THEN RAISE(ABORT,'clean rewrite terminal transition lacks active consumed ownership')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_terminal_consistency_insert
BEFORE INSERT ON backup_clean_rewrite_runs
WHEN NEW.status<>'running'
BEGIN
  SELECT CASE
    WHEN julianday(NEW.completed_at) IS NULL OR julianday(NEW.updated_at) IS NULL
      OR julianday(NEW.completed_at)<>julianday(NEW.updated_at)
      THEN RAISE(ABORT,'clean rewrite terminal recovery chronology is invalid')
    WHEN NOT EXISTS(
      SELECT 1 FROM backup_clean_rewrite_policy policy
      JOIN backup_clean_rewrite_claim_reservations reservation ON reservation.run_id=NEW.id
      WHERE policy.id='default' AND policy.state='running' AND policy.in_progress_run_id=NEW.id
        AND policy.last_trigger=NEW.trigger
        AND julianday(policy.in_progress_started_at)=julianday(NEW.started_at)
        AND julianday(policy.last_attempt_at)=julianday(NEW.started_at)
        AND reservation.state='consumed' AND reservation.trigger=NEW.trigger
        AND reservation.retention_cutoff=NEW.retention_cutoff
        AND reservation.due_records=NEW.due_records
        AND reservation.enabled_targets=NEW.enabled_targets
        AND julianday(reservation.started_at)=julianday(NEW.started_at)
    ) THEN RAISE(ABORT,'clean rewrite terminal recovery lacks active consumed ownership')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_terminal_policy_update
AFTER UPDATE OF status,propagation_run_id,next_attempt_at,error,completed_at,updated_at ON backup_clean_rewrite_runs
WHEN OLD.status='running' AND NEW.status<>'running'
BEGIN
  UPDATE backup_clean_rewrite_policy
  SET state=CASE NEW.status
        WHEN 'success' THEN 'idle'
        WHEN 'partial' THEN 'backoff'
        WHEN 'failed' THEN 'backoff'
        WHEN 'interrupted' THEN 'backoff'
        WHEN 'attention' THEN 'attention'
        WHEN 'deferred' THEN 'deferred'
      END,
      last_outcome=CASE NEW.status WHEN 'interrupted' THEN 'failed' ELSE NEW.status END,
      consecutive_failures=CASE
        WHEN NEW.status='success' THEN 0
        WHEN NEW.status IN ('partial','failed','interrupted') THEN consecutive_failures+1
        ELSE consecutive_failures
      END,
      last_success_at=CASE WHEN NEW.status='success' THEN NEW.completed_at ELSE last_success_at END,
      next_attempt_at=NEW.next_attempt_at,
      last_error=NEW.error,
      in_progress_run_id=NULL,
      in_progress_started_at=NULL,
      updated_at=NEW.completed_at
  WHERE id='default' AND state='running' AND in_progress_run_id=OLD.id;
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM backup_clean_rewrite_policy policy
    WHERE policy.id='default'
      AND policy.state=CASE NEW.status
        WHEN 'success' THEN 'idle'
        WHEN 'partial' THEN 'backoff'
        WHEN 'failed' THEN 'backoff'
        WHEN 'interrupted' THEN 'backoff'
        WHEN 'attention' THEN 'attention'
        WHEN 'deferred' THEN 'deferred'
      END
      AND policy.last_outcome=CASE NEW.status WHEN 'interrupted' THEN 'failed' ELSE NEW.status END
      AND policy.in_progress_run_id IS NULL AND policy.in_progress_started_at IS NULL
      AND julianday(policy.updated_at)=julianday(NEW.completed_at)
      AND COALESCE(policy.next_attempt_at,'')=COALESCE(NEW.next_attempt_at,'')
      AND COALESCE(policy.last_error,'')=COALESCE(NEW.error,'')
  ) THEN RAISE(ABORT,'clean rewrite terminal ledger could not finalize policy atomically') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_terminal_policy_insert
AFTER INSERT ON backup_clean_rewrite_runs
WHEN NEW.status<>'running'
BEGIN
  UPDATE backup_clean_rewrite_policy
  SET state=CASE NEW.status
        WHEN 'success' THEN 'idle'
        WHEN 'partial' THEN 'backoff'
        WHEN 'failed' THEN 'backoff'
        WHEN 'interrupted' THEN 'backoff'
        WHEN 'attention' THEN 'attention'
        WHEN 'deferred' THEN 'deferred'
      END,
      last_outcome=CASE NEW.status WHEN 'interrupted' THEN 'failed' ELSE NEW.status END,
      consecutive_failures=CASE
        WHEN NEW.status='success' THEN 0
        WHEN NEW.status IN ('partial','failed','interrupted') THEN consecutive_failures+1
        ELSE consecutive_failures
      END,
      last_success_at=CASE WHEN NEW.status='success' THEN NEW.completed_at ELSE last_success_at END,
      next_attempt_at=NEW.next_attempt_at,
      last_error=NEW.error,
      in_progress_run_id=NULL,
      in_progress_started_at=NULL,
      updated_at=NEW.completed_at
  WHERE id='default' AND state='running' AND in_progress_run_id=NEW.id;
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM backup_clean_rewrite_policy policy
    WHERE policy.id='default' AND policy.in_progress_run_id IS NULL
      AND policy.in_progress_started_at IS NULL
      AND julianday(policy.updated_at)=julianday(NEW.completed_at)
      AND COALESCE(policy.next_attempt_at,'')=COALESCE(NEW.next_attempt_at,'')
      AND COALESCE(policy.last_error,'')=COALESCE(NEW.error,'')
  ) THEN RAISE(ABORT,'clean rewrite recovered terminal ledger could not finalize policy atomically') END;
END;
UPDATE database_metadata
SET value='REVISION-197-CLEAN-BACKUP-ATOMIC-TERMINAL-TRANSITION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;



const cleanBackupRewriteTerminalChronologyMonotonicitySql = `CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_terminal_monotonicity_update
BEFORE UPDATE OF status,started_at,completed_at,updated_at ON backup_clean_rewrite_runs
WHEN OLD.status='running' AND NEW.status<>'running'
BEGIN
  SELECT CASE
    WHEN julianday(NEW.started_at) IS NULL OR julianday(NEW.completed_at) IS NULL OR julianday(NEW.updated_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite terminal chronology is invalid')
    WHEN julianday(NEW.completed_at)<julianday(NEW.started_at)
      THEN RAISE(ABORT,'clean rewrite terminal completion precedes start')
    WHEN julianday(NEW.updated_at)<>julianday(NEW.completed_at)
      THEN RAISE(ABORT,'clean rewrite terminal update chronology is invalid')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_terminal_monotonicity_insert
BEFORE INSERT ON backup_clean_rewrite_runs
WHEN NEW.status<>'running'
BEGIN
  SELECT CASE
    WHEN julianday(NEW.started_at) IS NULL OR julianday(NEW.completed_at) IS NULL OR julianday(NEW.updated_at) IS NULL
      THEN RAISE(ABORT,'clean rewrite recovered terminal chronology is invalid')
    WHEN julianday(NEW.completed_at)<julianday(NEW.started_at)
      THEN RAISE(ABORT,'clean rewrite recovered completion precedes start')
    WHEN julianday(NEW.updated_at)<>julianday(NEW.completed_at)
      THEN RAISE(ABORT,'clean rewrite recovered update chronology is invalid')
  END;
END;
UPDATE database_metadata
SET value='REVISION-198-CLEAN-BACKUP-TERMINAL-CHRONOLOGY-MONOTONICITY',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;



const cleanBackupRewritePropagationOutcomeIntegritySql = `CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_propagation_outcome_insert
BEFORE INSERT ON backup_clean_rewrite_runs
BEGIN
  SELECT CASE
    WHEN NEW.status IN ('success','partial') AND NEW.propagation_run_id IS NULL
      THEN RAISE(ABORT,'clean rewrite successful or partial result requires propagation')
    WHEN NEW.status IN ('running','failed','attention','deferred','interrupted') AND NEW.propagation_run_id IS NOT NULL
      THEN RAISE(ABORT,'clean rewrite non-propagating result cannot reference propagation')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_propagation_outcome_update
BEFORE UPDATE OF status,propagation_run_id ON backup_clean_rewrite_runs
BEGIN
  SELECT CASE
    WHEN NEW.status IN ('success','partial') AND NEW.propagation_run_id IS NULL
      THEN RAISE(ABORT,'clean rewrite successful or partial result requires propagation')
    WHEN NEW.status IN ('running','failed','attention','deferred','interrupted') AND NEW.propagation_run_id IS NOT NULL
      THEN RAISE(ABORT,'clean rewrite non-propagating result cannot reference propagation')
  END;
END;
UPDATE database_metadata
SET value='REVISION-199-CLEAN-BACKUP-PROPAGATION-OUTCOME-INTEGRITY',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;



const cleanBackupRewritePropagationOutcomeStatusIntegritySql = `CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_propagation_status_insert
BEFORE INSERT ON backup_clean_rewrite_runs
WHEN NEW.propagation_run_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NEW.status='success' AND COALESCE((SELECT status FROM backup_propagation_runs WHERE id=NEW.propagation_run_id),'missing')<>'success'
      THEN RAISE(ABORT,'clean rewrite success requires successful propagation')
    WHEN NEW.status='partial' AND COALESCE((SELECT status FROM backup_propagation_runs WHERE id=NEW.propagation_run_id),'missing')<>'partial'
      THEN RAISE(ABORT,'clean rewrite partial requires partial propagation')
  END;
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_propagation_status_update
BEFORE UPDATE OF status,propagation_run_id ON backup_clean_rewrite_runs
WHEN NEW.propagation_run_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NEW.status='success' AND COALESCE((SELECT status FROM backup_propagation_runs WHERE id=NEW.propagation_run_id),'missing')<>'success'
      THEN RAISE(ABORT,'clean rewrite success requires successful propagation')
    WHEN NEW.status='partial' AND COALESCE((SELECT status FROM backup_propagation_runs WHERE id=NEW.propagation_run_id),'missing')<>'partial'
      THEN RAISE(ABORT,'clean rewrite partial requires partial propagation')
  END;
END;
UPDATE database_metadata
SET value='REVISION-200-CLEAN-BACKUP-PROPAGATION-STATUS-INTEGRITY',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;



const cleanBackupRewritePropagationUniquenessSql = `CREATE UNIQUE INDEX IF NOT EXISTS ux_backup_clean_rewrite_runs_propagation_once
ON backup_clean_rewrite_runs(propagation_run_id)
WHERE propagation_run_id IS NOT NULL;
UPDATE database_metadata
SET value='REVISION-201-CLEAN-BACKUP-PROPAGATION-UNIQUENESS',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;



const cleanBackupRewritePropagationReferencePermanenceSql = `CREATE TRIGGER IF NOT EXISTS trg_backup_propagation_runs_clean_rewrite_reference_delete
BEFORE DELETE ON backup_propagation_runs
WHEN EXISTS (SELECT 1 FROM backup_clean_rewrite_runs WHERE propagation_run_id=OLD.id)
BEGIN
  SELECT RAISE(ABORT,'referenced clean rewrite propagation cannot be deleted');
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_propagation_runs_clean_rewrite_reference_id_update
BEFORE UPDATE OF id ON backup_propagation_runs
WHEN NEW.id<>OLD.id AND EXISTS (SELECT 1 FROM backup_clean_rewrite_runs WHERE propagation_run_id=OLD.id)
BEGIN
  SELECT RAISE(ABORT,'referenced clean rewrite propagation id cannot change');
END;
UPDATE database_metadata
SET value='REVISION-202-CLEAN-BACKUP-PROPAGATION-REFERENCE-PERMANENCE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;



const cleanBackupRewritePropagationReferencedEvidenceImmutabilitySql = `CREATE TRIGGER IF NOT EXISTS trg_backup_propagation_runs_clean_rewrite_reference_evidence_update
BEFORE UPDATE OF status,pending_records,target_count,refreshed_targets,quarantined_artifacts,pending_remaining,manual_backup_warning,target_results,error,started_at,completed_at ON backup_propagation_runs
WHEN EXISTS (SELECT 1 FROM backup_clean_rewrite_runs WHERE propagation_run_id=OLD.id)
  AND (
    NEW.status IS NOT OLD.status
    OR NEW.pending_records IS NOT OLD.pending_records
    OR NEW.target_count IS NOT OLD.target_count
    OR NEW.refreshed_targets IS NOT OLD.refreshed_targets
    OR NEW.quarantined_artifacts IS NOT OLD.quarantined_artifacts
    OR NEW.pending_remaining IS NOT OLD.pending_remaining
    OR NEW.manual_backup_warning IS NOT OLD.manual_backup_warning
    OR NEW.target_results IS NOT OLD.target_results
    OR NEW.error IS NOT OLD.error
    OR NEW.started_at IS NOT OLD.started_at
    OR NEW.completed_at IS NOT OLD.completed_at
  )
BEGIN
  SELECT RAISE(ABORT,'referenced clean rewrite propagation evidence cannot change');
END;
UPDATE database_metadata
SET value='REVISION-203-CLEAN-BACKUP-PROPAGATION-REFERENCED-EVIDENCE-IMMUTABILITY',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;



const cleanBackupRewritePropagationReplaceBypassProtectionSql = `CREATE TRIGGER IF NOT EXISTS trg_backup_propagation_runs_clean_rewrite_reference_insert
BEFORE INSERT ON backup_propagation_runs
WHEN EXISTS (SELECT 1 FROM backup_clean_rewrite_runs WHERE propagation_run_id=NEW.id)
BEGIN
  SELECT RAISE(ABORT,'referenced clean rewrite propagation cannot be replaced');
END;
UPDATE database_metadata
SET value='REVISION-204-CLEAN-BACKUP-PROPAGATION-REPLACE-BYPASS-PROTECTION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;


const cleanBackupRewriteTerminalLedgerImmutabilitySql = `CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_terminal_immutable_update
BEFORE UPDATE ON backup_clean_rewrite_runs
WHEN OLD.status<>'running'
  AND (
    NEW.id IS NOT OLD.id
    OR NEW.trigger IS NOT OLD.trigger
    OR NEW.status IS NOT OLD.status
    OR NEW.retention_cutoff IS NOT OLD.retention_cutoff
    OR NEW.due_records IS NOT OLD.due_records
    OR NEW.enabled_targets IS NOT OLD.enabled_targets
    OR NEW.propagation_run_id IS NOT OLD.propagation_run_id
    OR NEW.next_attempt_at IS NOT OLD.next_attempt_at
    OR NEW.error IS NOT OLD.error
    OR NEW.started_at IS NOT OLD.started_at
    OR NEW.completed_at IS NOT OLD.completed_at
    OR NEW.updated_at IS NOT OLD.updated_at
  )
BEGIN
  SELECT RAISE(ABORT,'terminal clean rewrite ledger is immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_terminal_immutable_delete
BEFORE DELETE ON backup_clean_rewrite_runs
WHEN OLD.status<>'running'
BEGIN
  SELECT RAISE(ABORT,'terminal clean rewrite ledger cannot be deleted');
END;
CREATE TRIGGER IF NOT EXISTS trg_backup_clean_rewrite_runs_terminal_replace_guard
BEFORE INSERT ON backup_clean_rewrite_runs
WHEN EXISTS(
  SELECT 1 FROM backup_clean_rewrite_runs existing
  WHERE existing.id=NEW.id AND existing.status<>'running'
)
BEGIN
  SELECT RAISE(ABORT,'terminal clean rewrite ledger cannot be replaced');
END;
UPDATE database_metadata
SET value='REVISION-210-CLEAN-BACKUP-TERMINAL-LEDGER-IMMUTABILITY',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const householdFamilyBranchPersonMembershipSql = `CREATE TABLE households (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 120),
  kind TEXT NOT NULL CHECK(kind IN ('primary','shared','extended','other')),
  status TEXT NOT NULL CHECK(status IN ('active','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE UNIQUE INDEX ux_households_family_name
ON households(family_id,name COLLATE NOCASE);
CREATE INDEX idx_households_family_status
ON households(family_id,status,name COLLATE NOCASE);

CREATE TABLE family_branches (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  household_id TEXT REFERENCES households(id) ON DELETE RESTRICT,
  parent_branch_id TEXT REFERENCES family_branches(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 120),
  status TEXT NOT NULL CHECK(status IN ('active','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(parent_branch_id IS NULL OR parent_branch_id<>id)
) STRICT;
CREATE UNIQUE INDEX ux_family_branches_scope_name
ON family_branches(family_id,COALESCE(household_id,''),name COLLATE NOCASE);
CREATE INDEX idx_family_branches_family_status
ON family_branches(family_id,status,name COLLATE NOCASE);
CREATE INDEX idx_family_branches_parent
ON family_branches(parent_branch_id);

CREATE TRIGGER trg_family_branches_household_family_insert
BEFORE INSERT ON family_branches
WHEN NEW.household_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM households h WHERE h.id=NEW.household_id AND h.family_id=NEW.family_id
)
BEGIN
  SELECT RAISE(ABORT,'family branch household must belong to the same family');
END;
CREATE TRIGGER trg_family_branches_parent_family_insert
BEFORE INSERT ON family_branches
WHEN NEW.parent_branch_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM family_branches p
  WHERE p.id=NEW.parent_branch_id
    AND p.family_id=NEW.family_id
    AND (NEW.household_id IS NULL OR p.household_id IS NULL OR p.household_id=NEW.household_id)
)
BEGIN
  SELECT RAISE(ABORT,'family branch parent must belong to the same family and household scope');
END;

CREATE TABLE person_memberships (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
  family_branch_id TEXT REFERENCES family_branches(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK(role IN ('resident','member','guardian','dependent','other')),
  status TEXT NOT NULL CHECK(status IN ('active','suspended','ended')),
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(valid_until IS NULL OR valid_until>valid_from),
  CHECK(status<>'ended' OR valid_until IS NOT NULL)
) STRICT;
CREATE INDEX idx_person_memberships_person_history
ON person_memberships(person_id,valid_from DESC,id);
CREATE INDEX idx_person_memberships_household_active
ON person_memberships(household_id,status,valid_from,valid_until);
CREATE INDEX idx_person_memberships_branch_active
ON person_memberships(family_branch_id,status,valid_from,valid_until);

CREATE TRIGGER trg_person_memberships_family_scope_insert
BEFORE INSERT ON person_memberships
WHEN NOT EXISTS(
  SELECT 1 FROM people p
  JOIN households h ON h.id=NEW.household_id AND h.family_id=p.family_id
  WHERE p.id=NEW.person_id
)
BEGIN
  SELECT RAISE(ABORT,'person membership household must belong to the person family');
END;
CREATE TRIGGER trg_person_memberships_branch_scope_insert
BEFORE INSERT ON person_memberships
WHEN NEW.family_branch_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM family_branches b
  JOIN households h ON h.id=NEW.household_id AND h.family_id=b.family_id
  WHERE b.id=NEW.family_branch_id
    AND (b.household_id IS NULL OR b.household_id=NEW.household_id)
)
BEGIN
  SELECT RAISE(ABORT,'person membership branch must belong to the selected household scope');
END;
CREATE TRIGGER trg_person_memberships_overlap_insert
BEFORE INSERT ON person_memberships
WHEN EXISTS(
  SELECT 1 FROM person_memberships existing
  WHERE existing.person_id=NEW.person_id
    AND existing.household_id=NEW.household_id
    AND existing.family_branch_id IS NEW.family_branch_id
    AND COALESCE(existing.valid_until,'9999-12-31T23:59:59.999Z')>NEW.valid_from
    AND COALESCE(NEW.valid_until,'9999-12-31T23:59:59.999Z')>existing.valid_from
)
BEGIN
  SELECT RAISE(ABORT,'overlapping person membership interval');
END;
CREATE TRIGGER trg_person_memberships_identity_immutable
BEFORE UPDATE OF person_id,household_id,family_branch_id,valid_from ON person_memberships
WHEN NEW.person_id IS NOT OLD.person_id
  OR NEW.household_id IS NOT OLD.household_id
  OR NEW.family_branch_id IS NOT OLD.family_branch_id
  OR NEW.valid_from IS NOT OLD.valid_from
BEGIN
  SELECT RAISE(ABORT,'person membership historical identity is immutable');
END;
CREATE TRIGGER trg_person_memberships_overlap_update
BEFORE UPDATE OF valid_until ON person_memberships
WHEN EXISTS(
  SELECT 1 FROM person_memberships existing
  WHERE existing.id<>OLD.id
    AND existing.person_id=OLD.person_id
    AND existing.household_id=OLD.household_id
    AND existing.family_branch_id IS OLD.family_branch_id
    AND COALESCE(existing.valid_until,'9999-12-31T23:59:59.999Z')>OLD.valid_from
    AND COALESCE(NEW.valid_until,'9999-12-31T23:59:59.999Z')>existing.valid_from
)
BEGIN
  SELECT RAISE(ABORT,'updated person membership interval overlaps history');
END;

UPDATE database_metadata
SET value='REVISION-30-A-B1-01-HOUSEHOLD-MEMBERSHIP',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const personProfileLifecycleSql = `ALTER TABLE people ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
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
`;

const authorizationContextSql = `ALTER TABLE object_permissions
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
`;

const windowsHelloRegistrationsSql = `CREATE TABLE windows_hello_registrations (
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
`;

const durablePlatformPolicyTransactionsSql = `CREATE TABLE platform_policy_replay_reservations (
  nonce TEXT PRIMARY KEY CHECK(length(trim(nonce)) BETWEEN 1 AND 256),
  reserved_at_ms INTEGER NOT NULL CHECK(reserved_at_ms>=0),
  expires_at_ms INTEGER NOT NULL CHECK(expires_at_ms>reserved_at_ms)
) STRICT;

CREATE INDEX idx_platform_policy_replay_expiry
ON platform_policy_replay_reservations(expires_at_ms);

CREATE TRIGGER trg_platform_policy_replay_update
BEFORE UPDATE ON platform_policy_replay_reservations
WHEN NEW.nonce<>OLD.nonce
  OR OLD.expires_at_ms>=NEW.reserved_at_ms
  OR NEW.expires_at_ms<=NEW.reserved_at_ms
BEGIN
  SELECT RAISE(ABORT,'platform policy replay reservation is not expired');
END;

CREATE TRIGGER trg_platform_policy_replay_delete
BEFORE DELETE ON platform_policy_replay_reservations
BEGIN
  SELECT RAISE(ABORT,'platform policy replay reservations are durable');
END;

CREATE TABLE platform_policy_database_fences (
  fence_name TEXT PRIMARY KEY CHECK(length(trim(fence_name)) BETWEEN 1 AND 128),
  epoch INTEGER NOT NULL CHECK(epoch>=0),
  writable INTEGER NOT NULL CHECK(writable IN (0,1)),
  synchronized_at TEXT NOT NULL CHECK(
    length(synchronized_at)=24
    AND synchronized_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(synchronized_at) IS NOT NULL
  )
) STRICT;

CREATE TRIGGER trg_platform_policy_fence_update
BEFORE UPDATE ON platform_policy_database_fences
WHEN NEW.fence_name<>OLD.fence_name
  OR NEW.epoch<OLD.epoch
  OR (NEW.epoch=OLD.epoch AND NEW.writable>OLD.writable)
  OR julianday(NEW.synchronized_at)<julianday(OLD.synchronized_at)
BEGIN
  SELECT RAISE(ABORT,'stale or widening platform policy fence transition');
END;

CREATE TRIGGER trg_platform_policy_fence_delete
BEFORE DELETE ON platform_policy_database_fences
BEGIN
  SELECT RAISE(ABORT,'platform policy database fence is durable');
END;

CREATE TABLE platform_policy_transaction_receipts (
  receipt_hash TEXT PRIMARY KEY CHECK(
    length(receipt_hash)=64 AND receipt_hash NOT GLOB '*[^0-9a-f]*'
  ),
  receipt_version INTEGER NOT NULL CHECK(receipt_version=1),
  request_hash TEXT NOT NULL CHECK(
    length(request_hash)=64 AND request_hash NOT GLOB '*[^0-9a-f]*'
  ),
  nonce TEXT NOT NULL UNIQUE REFERENCES platform_policy_replay_reservations(nonce) ON DELETE RESTRICT
    CHECK(length(trim(nonce)) BETWEEN 1 AND 256),
  correlation_id TEXT NOT NULL UNIQUE CHECK(length(trim(correlation_id)) BETWEEN 1 AND 128),
  policy_version TEXT NOT NULL CHECK(length(trim(policy_version)) BETWEEN 1 AND 128),
  resource_type TEXT NOT NULL CHECK(length(trim(resource_type)) BETWEEN 1 AND 128),
  resource_id TEXT NOT NULL CHECK(length(trim(resource_id)) BETWEEN 1 AND 256),
  action TEXT NOT NULL CHECK(action IN ('read','create','update','delete','share','process','record','administer')),
  capability TEXT NOT NULL CHECK(capability IN (
    'family.read','family.write','health.read','health.write','finance.read','finance.write',
    'location.read','location.share','archive.read','archive.write','archive.ocr','ai.process',
    'translation.process','communication.message','communication.call','communication.record',
    'file.share','backup.create','backup.restore','cluster.admin','plugin.execute'
  )),
  fence_name TEXT NOT NULL REFERENCES platform_policy_database_fences(fence_name) ON DELETE RESTRICT,
  fence_epoch INTEGER NOT NULL CHECK(fence_epoch>=0),
  fence_writable INTEGER NOT NULL CHECK(fence_writable=1),
  issued_at TEXT NOT NULL CHECK(
    length(issued_at)=24 AND issued_at GLOB '????-??-??T??:??:??.???Z' AND julianday(issued_at) IS NOT NULL
  ),
  recorded_at TEXT NOT NULL CHECK(
    length(recorded_at)=24 AND recorded_at GLOB '????-??-??T??:??:??.???Z' AND julianday(recorded_at) IS NOT NULL
  ),
  record_json TEXT NOT NULL CHECK(json_valid(record_json))
) STRICT;

CREATE INDEX idx_platform_policy_receipt_resource
ON platform_policy_transaction_receipts(resource_type,resource_id,recorded_at DESC);
CREATE INDEX idx_platform_policy_receipt_fence
ON platform_policy_transaction_receipts(fence_name,fence_epoch,recorded_at DESC);

CREATE TRIGGER trg_platform_policy_replay_consumed_update
BEFORE UPDATE ON platform_policy_replay_reservations
WHEN EXISTS(
  SELECT 1 FROM platform_policy_transaction_receipts receipt
  WHERE receipt.nonce=OLD.nonce
)
BEGIN
  SELECT RAISE(ABORT,'consumed platform policy replay reservation is immutable');
END;

CREATE TRIGGER trg_platform_policy_receipt_insert
BEFORE INSERT ON platform_policy_transaction_receipts
WHEN NOT EXISTS(
    SELECT 1 FROM platform_policy_database_fences fence
    WHERE fence.fence_name=NEW.fence_name
      AND fence.epoch=NEW.fence_epoch
      AND fence.writable=NEW.fence_writable
  )
  OR julianday(NEW.issued_at) IS NULL
  OR julianday(NEW.recorded_at) IS NULL
  OR julianday(NEW.recorded_at)<julianday(NEW.issued_at)
  OR NOT EXISTS(
    SELECT 1 FROM platform_policy_replay_reservations reservation
    WHERE reservation.nonce=NEW.nonce
      AND reservation.reserved_at_ms<=((julianday(NEW.issued_at)-2440587.5)*86400000.0)+1.0
      AND reservation.reserved_at_ms<=((julianday(NEW.recorded_at)-2440587.5)*86400000.0)+1.0
      AND reservation.expires_at_ms>=((julianday(NEW.recorded_at)-2440587.5)*86400000.0)-1.0
  )
  OR json_extract(NEW.record_json,'$.correlationId') IS NOT NEW.correlation_id
  OR json_extract(NEW.record_json,'$.resourceType') IS NOT NEW.resource_type
  OR json_extract(NEW.record_json,'$.resourceId') IS NOT NEW.resource_id
  OR json_extract(NEW.record_json,'$.action') IS NOT NEW.action
  OR json_extract(NEW.record_json,'$.capability') IS NOT NEW.capability
  OR json_extract(NEW.record_json,'$.recordedAt') IS NOT NEW.recorded_at
  OR json_extract(NEW.record_json,'$.receipt.receiptVersion') IS NOT NEW.receipt_version
  OR json_extract(NEW.record_json,'$.receipt.requestHash') IS NOT NEW.request_hash
  OR json_extract(NEW.record_json,'$.receipt.nonce') IS NOT NEW.nonce
  OR json_extract(NEW.record_json,'$.receipt.issuedAt') IS NOT NEW.issued_at
  OR json_extract(NEW.record_json,'$.receipt.decision.policyVersion') IS NOT NEW.policy_version
  OR json_extract(NEW.record_json,'$.decision.policyVersion') IS NOT NEW.policy_version
  OR json_extract(NEW.record_json,'$.decision.allowed') IS NOT 1
  OR json_extract(NEW.record_json,'$.receipt.decision.allowed') IS NOT 1
  OR json_extract(NEW.record_json,'$.request.correlationId') IS NOT NEW.correlation_id
  OR json_extract(NEW.record_json,'$.request.policyVersion') IS NOT NEW.policy_version
  OR json_extract(NEW.record_json,'$.request.resource.type') IS NOT NEW.resource_type
  OR json_extract(NEW.record_json,'$.request.resource.id') IS NOT NEW.resource_id
  OR json_extract(NEW.record_json,'$.request.action') IS NOT NEW.action
  OR json_extract(NEW.record_json,'$.request.capability') IS NOT NEW.capability
  OR json_extract(NEW.record_json,'$.request.clusterWritable') IS NOT NEW.fence_writable
  OR json_extract(NEW.record_json,'$.request.enforcementMode') IS NOT 'strict'
  OR json_type(NEW.record_json,'$.receipt.signature') IS NOT 'text'
  OR length(json_extract(NEW.record_json,'$.receipt.signature'))<>64
  OR json_extract(NEW.record_json,'$.receipt.signature') GLOB '*[^0-9a-f]*'
BEGIN
  SELECT RAISE(ABORT,'platform policy receipt, context or database fence mismatch');
END;

CREATE TRIGGER trg_platform_policy_receipt_update
BEFORE UPDATE ON platform_policy_transaction_receipts
BEGIN
  SELECT RAISE(ABORT,'platform policy transaction receipt is immutable');
END;

CREATE TRIGGER trg_platform_policy_receipt_delete
BEFORE DELETE ON platform_policy_transaction_receipts
BEGIN
  SELECT RAISE(ABORT,'platform policy transaction receipt is immutable');
END;

CREATE TABLE platform_policy_journal_projection_outbox (
  receipt_hash TEXT PRIMARY KEY REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
  record_json TEXT NOT NULL CHECK(json_valid(record_json)),
  status TEXT NOT NULL CHECK(status IN ('pending','projected')),
  created_at TEXT NOT NULL,
  projected_at TEXT,
  CHECK(
    (status='pending' AND projected_at IS NULL)
    OR (status='projected' AND projected_at IS NOT NULL)
  )
) STRICT;

CREATE INDEX idx_platform_policy_projection_pending
ON platform_policy_journal_projection_outbox(status,created_at,receipt_hash);

CREATE TRIGGER trg_platform_policy_projection_insert
BEFORE INSERT ON platform_policy_journal_projection_outbox
WHEN NEW.status<>'pending'
  OR NEW.projected_at IS NOT NULL
  OR NOT EXISTS(
    SELECT 1 FROM platform_policy_transaction_receipts receipt
    WHERE receipt.receipt_hash=NEW.receipt_hash
      AND receipt.record_json=NEW.record_json
  )
BEGIN
  SELECT RAISE(ABORT,'platform policy journal projection does not match its receipt');
END;

CREATE TRIGGER trg_platform_policy_projection_update
BEFORE UPDATE ON platform_policy_journal_projection_outbox
WHEN NEW.receipt_hash<>OLD.receipt_hash
  OR NEW.record_json<>OLD.record_json
  OR NEW.created_at<>OLD.created_at
  OR OLD.status<>'pending'
  OR NEW.status<>'projected'
  OR NEW.projected_at IS NULL
  OR NEW.projected_at<OLD.created_at
BEGIN
  SELECT RAISE(ABORT,'invalid platform policy journal projection transition');
END;

CREATE TRIGGER trg_platform_policy_projection_delete
BEFORE DELETE ON platform_policy_journal_projection_outbox
BEGIN
  SELECT RAISE(ABORT,'platform policy journal projection is durable');
END;

ALTER TABLE audit_log ADD COLUMN policy_receipt_hash TEXT CHECK(
  policy_receipt_hash IS NULL
  OR (length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE audit_log ADD COLUMN policy_receipt_version INTEGER CHECK(
  policy_receipt_version IS NULL OR policy_receipt_version=1
);
ALTER TABLE audit_log ADD COLUMN policy_receipt_nonce TEXT;
ALTER TABLE audit_log ADD COLUMN policy_resource_type TEXT;
ALTER TABLE audit_log ADD COLUMN policy_resource_id TEXT;
ALTER TABLE audit_log ADD COLUMN policy_action TEXT;
ALTER TABLE audit_log ADD COLUMN policy_capability TEXT;

ALTER TABLE event_outbox ADD COLUMN policy_receipt_hash TEXT CHECK(
  policy_receipt_hash IS NULL
  OR (length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE event_outbox ADD COLUMN policy_receipt_version INTEGER CHECK(
  policy_receipt_version IS NULL OR policy_receipt_version=1
);
ALTER TABLE event_outbox ADD COLUMN policy_receipt_nonce TEXT;
ALTER TABLE event_outbox ADD COLUMN policy_resource_type TEXT;
ALTER TABLE event_outbox ADD COLUMN policy_resource_id TEXT;
ALTER TABLE event_outbox ADD COLUMN policy_action TEXT;
ALTER TABLE event_outbox ADD COLUMN policy_capability TEXT;

CREATE INDEX idx_audit_policy_receipt
ON audit_log(policy_receipt_hash)
WHERE policy_receipt_hash IS NOT NULL;
CREATE INDEX idx_event_outbox_policy_receipt
ON event_outbox(policy_receipt_hash)
WHERE policy_receipt_hash IS NOT NULL;

CREATE TRIGGER trg_audit_policy_binding_insert
BEFORE INSERT ON audit_log
WHEN NOT (
    (NEW.policy_receipt_hash IS NULL
      AND NEW.policy_receipt_version IS NULL
      AND NEW.policy_receipt_nonce IS NULL
      AND NEW.policy_resource_type IS NULL
      AND NEW.policy_resource_id IS NULL
      AND NEW.policy_action IS NULL
      AND NEW.policy_capability IS NULL)
    OR
    (NEW.policy_receipt_hash IS NOT NULL
      AND NEW.policy_receipt_version IS NOT NULL
      AND NEW.policy_receipt_nonce IS NOT NULL
      AND NEW.policy_resource_type IS NOT NULL
      AND NEW.policy_resource_id IS NOT NULL
      AND NEW.policy_action IS NOT NULL
      AND NEW.policy_capability IS NOT NULL
      AND NEW.resource_type=NEW.policy_resource_type
      AND NEW.resource_id=NEW.policy_resource_id
      AND EXISTS(
        SELECT 1 FROM platform_policy_transaction_receipts receipt
        WHERE receipt.receipt_hash=NEW.policy_receipt_hash
          AND receipt.receipt_version=NEW.policy_receipt_version
          AND receipt.nonce=NEW.policy_receipt_nonce
          AND receipt.correlation_id=NEW.correlation_id
          AND receipt.resource_type=NEW.policy_resource_type
          AND receipt.resource_id=NEW.policy_resource_id
          AND receipt.action=NEW.policy_action
          AND receipt.capability=NEW.policy_capability
      ))
  )
BEGIN
  SELECT RAISE(ABORT,'audit policy receipt binding is incomplete or invalid');
END;

CREATE TRIGGER trg_audit_policy_binding_immutable
BEFORE UPDATE OF policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
  policy_resource_type,policy_resource_id,policy_action,policy_capability ON audit_log
WHEN NEW.policy_receipt_hash IS NOT OLD.policy_receipt_hash
  OR NEW.policy_receipt_version IS NOT OLD.policy_receipt_version
  OR NEW.policy_receipt_nonce IS NOT OLD.policy_receipt_nonce
  OR NEW.policy_resource_type IS NOT OLD.policy_resource_type
  OR NEW.policy_resource_id IS NOT OLD.policy_resource_id
  OR NEW.policy_action IS NOT OLD.policy_action
  OR NEW.policy_capability IS NOT OLD.policy_capability
BEGIN
  SELECT RAISE(ABORT,'audit policy receipt binding is immutable');
END;

CREATE TRIGGER trg_audit_policy_scope_immutable
BEFORE UPDATE OF correlation_id,resource_type,resource_id ON audit_log
WHEN OLD.policy_receipt_hash IS NOT NULL
  AND (
    NEW.correlation_id IS NOT OLD.correlation_id
    OR NEW.resource_type IS NOT OLD.resource_type
    OR NEW.resource_id IS NOT OLD.resource_id
  )
BEGIN
  SELECT RAISE(ABORT,'audit policy receipt scope is immutable');
END;

CREATE TRIGGER trg_audit_policy_row_immutable
BEFORE UPDATE ON audit_log
WHEN OLD.policy_receipt_hash IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'policy-bound audit row is immutable');
END;

CREATE TRIGGER trg_audit_policy_row_delete
BEFORE DELETE ON audit_log
WHEN OLD.policy_receipt_hash IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'policy-bound audit row is immutable');
END;

CREATE TRIGGER trg_event_outbox_policy_binding_insert
BEFORE INSERT ON event_outbox
WHEN NOT (
    (NEW.policy_receipt_hash IS NULL
      AND NEW.policy_receipt_version IS NULL
      AND NEW.policy_receipt_nonce IS NULL
      AND NEW.policy_resource_type IS NULL
      AND NEW.policy_resource_id IS NULL
      AND NEW.policy_action IS NULL
      AND NEW.policy_capability IS NULL)
    OR
    (NEW.policy_receipt_hash IS NOT NULL
      AND NEW.policy_receipt_version IS NOT NULL
      AND NEW.policy_receipt_nonce IS NOT NULL
      AND NEW.policy_resource_type IS NOT NULL
      AND NEW.policy_resource_id IS NOT NULL
      AND NEW.policy_action IS NOT NULL
      AND NEW.policy_capability IS NOT NULL
      AND NEW.aggregate_type=NEW.policy_resource_type
      AND NEW.aggregate_id=NEW.policy_resource_id
      AND EXISTS(
        SELECT 1 FROM platform_policy_transaction_receipts receipt
        WHERE receipt.receipt_hash=NEW.policy_receipt_hash
          AND receipt.receipt_version=NEW.policy_receipt_version
          AND receipt.nonce=NEW.policy_receipt_nonce
          AND receipt.correlation_id=json_extract(NEW.headers_json,'$.correlationId')
          AND receipt.resource_type=NEW.policy_resource_type
          AND receipt.resource_id=NEW.policy_resource_id
          AND receipt.action=NEW.policy_action
          AND receipt.capability=NEW.policy_capability
      ))
  )
BEGIN
  SELECT RAISE(ABORT,'event outbox policy receipt binding is incomplete or invalid');
END;

CREATE TRIGGER trg_event_outbox_policy_binding_immutable
BEFORE UPDATE OF policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
  policy_resource_type,policy_resource_id,policy_action,policy_capability ON event_outbox
WHEN NEW.policy_receipt_hash IS NOT OLD.policy_receipt_hash
  OR NEW.policy_receipt_version IS NOT OLD.policy_receipt_version
  OR NEW.policy_receipt_nonce IS NOT OLD.policy_receipt_nonce
  OR NEW.policy_resource_type IS NOT OLD.policy_resource_type
  OR NEW.policy_resource_id IS NOT OLD.policy_resource_id
  OR NEW.policy_action IS NOT OLD.policy_action
  OR NEW.policy_capability IS NOT OLD.policy_capability
BEGIN
  SELECT RAISE(ABORT,'event outbox policy receipt binding is immutable');
END;

CREATE TRIGGER trg_event_outbox_policy_scope_immutable
BEFORE UPDATE OF id,event_type,event_version,aggregate_type,aggregate_id,payload_json,headers_json,occurred_at
ON event_outbox
WHEN OLD.policy_receipt_hash IS NOT NULL
  AND (
    NEW.id IS NOT OLD.id
    OR NEW.event_type IS NOT OLD.event_type
    OR NEW.event_version IS NOT OLD.event_version
    OR NEW.aggregate_type IS NOT OLD.aggregate_type
    OR NEW.aggregate_id IS NOT OLD.aggregate_id
    OR NEW.payload_json IS NOT OLD.payload_json
    OR NEW.headers_json IS NOT OLD.headers_json
    OR NEW.occurred_at IS NOT OLD.occurred_at
  )
BEGIN
  SELECT RAISE(ABORT,'event outbox policy receipt scope is immutable');
END;

CREATE TRIGGER trg_event_outbox_policy_row_delete
BEFORE DELETE ON event_outbox
WHEN OLD.policy_receipt_hash IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'policy-bound event outbox row is durable');
END;

UPDATE database_metadata
SET value='REVISION-30-P-PPK-002-DURABLE-POLICY-TRANSACTION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const protectedJournalProjectionProofSql = `ALTER TABLE platform_policy_journal_projection_outbox
ADD COLUMN proof_schema_version INTEGER CHECK(proof_schema_version IS NULL OR proof_schema_version=1);
ALTER TABLE platform_policy_journal_projection_outbox
ADD COLUMN proof_receipt_hash TEXT CHECK(
  proof_receipt_hash IS NULL
  OR (length(proof_receipt_hash)=64 AND proof_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE platform_policy_journal_projection_outbox
ADD COLUMN proof_record_hash TEXT CHECK(
  proof_record_hash IS NULL
  OR (length(proof_record_hash)=64 AND proof_record_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE platform_policy_journal_projection_outbox
ADD COLUMN proof_receipt_nonce TEXT;
ALTER TABLE platform_policy_journal_projection_outbox
ADD COLUMN proof_entry_sequence INTEGER CHECK(proof_entry_sequence IS NULL OR proof_entry_sequence>=1);
ALTER TABLE platform_policy_journal_projection_outbox
ADD COLUMN proof_entry_hash TEXT CHECK(
  proof_entry_hash IS NULL
  OR (length(proof_entry_hash)=64 AND proof_entry_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE platform_policy_journal_projection_outbox
ADD COLUMN proof_head_sequence INTEGER CHECK(proof_head_sequence IS NULL OR proof_head_sequence>=1);
ALTER TABLE platform_policy_journal_projection_outbox
ADD COLUMN proof_head_hash TEXT CHECK(
  proof_head_hash IS NULL
  OR (length(proof_head_hash)=64 AND proof_head_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE platform_policy_journal_projection_outbox
ADD COLUMN proof_journal_size_bytes INTEGER CHECK(
  proof_journal_size_bytes IS NULL OR proof_journal_size_bytes>=1
);
ALTER TABLE platform_policy_journal_projection_outbox
ADD COLUMN proof_issued_at TEXT;
ALTER TABLE platform_policy_journal_projection_outbox
ADD COLUMN proof_mac TEXT CHECK(
  proof_mac IS NULL
  OR (length(proof_mac)=64 AND proof_mac NOT GLOB '*[^0-9a-f]*')
);

DROP TRIGGER trg_platform_policy_projection_update;

CREATE TRIGGER trg_platform_policy_projection_insert_proof_empty
BEFORE INSERT ON platform_policy_journal_projection_outbox
WHEN NEW.proof_schema_version IS NOT NULL
  OR NEW.proof_receipt_hash IS NOT NULL
  OR NEW.proof_record_hash IS NOT NULL
  OR NEW.proof_receipt_nonce IS NOT NULL
  OR NEW.proof_entry_sequence IS NOT NULL
  OR NEW.proof_entry_hash IS NOT NULL
  OR NEW.proof_head_sequence IS NOT NULL
  OR NEW.proof_head_hash IS NOT NULL
  OR NEW.proof_journal_size_bytes IS NOT NULL
  OR NEW.proof_issued_at IS NOT NULL
  OR NEW.proof_mac IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'pending platform policy journal projection cannot contain proof');
END;

CREATE TRIGGER trg_platform_policy_projection_update
BEFORE UPDATE ON platform_policy_journal_projection_outbox
WHEN NEW.receipt_hash<>OLD.receipt_hash
  OR NEW.record_json<>OLD.record_json
  OR NEW.created_at<>OLD.created_at
  OR OLD.status<>'pending'
  OR NEW.status<>'projected'
  OR NEW.projected_at IS NULL
  OR NEW.projected_at<OLD.created_at
  OR NEW.proof_schema_version IS NOT 1
  OR NEW.proof_receipt_hash IS NOT NEW.receipt_hash
  OR NEW.proof_record_hash IS NULL
  OR NEW.proof_receipt_nonce IS NULL
  OR NEW.proof_entry_sequence IS NULL
  OR NEW.proof_entry_hash IS NULL
  OR NEW.proof_head_sequence IS NULL
  OR NEW.proof_head_hash IS NULL
  OR NEW.proof_journal_size_bytes IS NULL
  OR NEW.proof_issued_at IS NULL
  OR NEW.proof_mac IS NULL
  OR NEW.proof_head_sequence<NEW.proof_entry_sequence
  OR length(NEW.proof_record_hash)<>64
  OR NEW.proof_record_hash GLOB '*[^0-9a-f]*'
  OR length(NEW.proof_entry_hash)<>64
  OR NEW.proof_entry_hash GLOB '*[^0-9a-f]*'
  OR length(NEW.proof_head_hash)<>64
  OR NEW.proof_head_hash GLOB '*[^0-9a-f]*'
  OR length(NEW.proof_mac)<>64
  OR NEW.proof_mac GLOB '*[^0-9a-f]*'
  OR length(NEW.proof_issued_at)<>24
  OR NEW.proof_issued_at NOT GLOB '????-??-??T??:??:??.???Z'
  OR julianday(NEW.proof_issued_at) IS NULL
  OR NOT EXISTS(
    SELECT 1 FROM platform_policy_transaction_receipts receipt
    WHERE receipt.receipt_hash=NEW.receipt_hash
      AND receipt.nonce=NEW.proof_receipt_nonce
  )
BEGIN
  SELECT RAISE(ABORT,'invalid or unbound platform policy journal projection proof');
END;

CREATE TABLE platform_policy_journal_anchors (
  anchor_name TEXT PRIMARY KEY CHECK(anchor_name='archive-protected-receipt-journal'),
  proof_schema_version INTEGER NOT NULL CHECK(proof_schema_version=1),
  receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
  record_hash TEXT NOT NULL CHECK(length(record_hash)=64 AND record_hash NOT GLOB '*[^0-9a-f]*'),
  receipt_nonce TEXT NOT NULL CHECK(length(trim(receipt_nonce)) BETWEEN 1 AND 256),
  entry_sequence INTEGER NOT NULL CHECK(entry_sequence>=1),
  entry_hash TEXT NOT NULL CHECK(length(entry_hash)=64 AND entry_hash NOT GLOB '*[^0-9a-f]*'),
  head_sequence INTEGER NOT NULL CHECK(head_sequence>=entry_sequence),
  head_hash TEXT NOT NULL CHECK(length(head_hash)=64 AND head_hash NOT GLOB '*[^0-9a-f]*'),
  journal_size_bytes INTEGER NOT NULL CHECK(journal_size_bytes>=1),
  proof_issued_at TEXT NOT NULL CHECK(
    length(proof_issued_at)=24
    AND proof_issued_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(proof_issued_at) IS NOT NULL
  ),
  proof_mac TEXT NOT NULL CHECK(length(proof_mac)=64 AND proof_mac NOT GLOB '*[^0-9a-f]*'),
  anchored_at TEXT NOT NULL CHECK(
    length(anchored_at)=24
    AND anchored_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(anchored_at) IS NOT NULL
  )
) STRICT;

CREATE TRIGGER trg_platform_policy_journal_anchor_insert
BEFORE INSERT ON platform_policy_journal_anchors
WHEN NOT EXISTS(
  SELECT 1 FROM platform_policy_journal_projection_outbox projection
  WHERE projection.receipt_hash=NEW.receipt_hash
    AND projection.status='projected'
    AND projection.proof_schema_version=NEW.proof_schema_version
    AND projection.proof_receipt_hash=NEW.receipt_hash
    AND projection.proof_record_hash=NEW.record_hash
    AND projection.proof_receipt_nonce=NEW.receipt_nonce
    AND projection.proof_entry_sequence=NEW.entry_sequence
    AND projection.proof_entry_hash=NEW.entry_hash
    AND projection.proof_head_sequence=NEW.head_sequence
    AND projection.proof_head_hash=NEW.head_hash
    AND projection.proof_journal_size_bytes=NEW.journal_size_bytes
    AND projection.proof_issued_at=NEW.proof_issued_at
    AND projection.proof_mac=NEW.proof_mac
    AND julianday(NEW.anchored_at)>=julianday(projection.projected_at)
)
BEGIN
  SELECT RAISE(ABORT,'platform policy journal anchor proof is not acknowledged');
END;

CREATE TRIGGER trg_platform_policy_journal_anchor_update
BEFORE UPDATE ON platform_policy_journal_anchors
WHEN NEW.anchor_name<>OLD.anchor_name
  OR NEW.head_sequence<=OLD.head_sequence
  OR julianday(NEW.anchored_at)<julianday(OLD.anchored_at)
  OR NOT EXISTS(
    SELECT 1 FROM platform_policy_journal_projection_outbox projection
    WHERE projection.receipt_hash=NEW.receipt_hash
      AND projection.status='projected'
      AND projection.proof_schema_version=NEW.proof_schema_version
      AND projection.proof_receipt_hash=NEW.receipt_hash
      AND projection.proof_record_hash=NEW.record_hash
      AND projection.proof_receipt_nonce=NEW.receipt_nonce
      AND projection.proof_entry_sequence=NEW.entry_sequence
      AND projection.proof_entry_hash=NEW.entry_hash
      AND projection.proof_head_sequence=NEW.head_sequence
      AND projection.proof_head_hash=NEW.head_hash
      AND projection.proof_journal_size_bytes=NEW.journal_size_bytes
      AND projection.proof_issued_at=NEW.proof_issued_at
      AND projection.proof_mac=NEW.proof_mac
      AND julianday(NEW.anchored_at)>=julianday(projection.projected_at)
  )
BEGIN
  SELECT RAISE(ABORT,'non-monotonic or unacknowledged platform policy journal anchor');
END;

CREATE TRIGGER trg_platform_policy_journal_anchor_delete
BEFORE DELETE ON platform_policy_journal_anchors
BEGIN
  SELECT RAISE(ABORT,'platform policy journal anchor is durable');
END;

UPDATE database_metadata
SET value='REVISION-30-Q-PPK-002-JOURNAL-PROOF-ROLLBACK-ANCHOR',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const archiveCoreTableReceiptFenceSql = `ALTER TABLE archive_items
ADD COLUMN policy_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
  policy_receipt_hash IS NULL
  OR (length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE archive_items
ADD COLUMN policy_receipt_version INTEGER CHECK(policy_receipt_version IS NULL OR policy_receipt_version=1);
ALTER TABLE archive_items ADD COLUMN policy_receipt_nonce TEXT;
ALTER TABLE archive_items ADD COLUMN policy_correlation_id TEXT;
ALTER TABLE archive_items ADD COLUMN policy_resource_type TEXT;
ALTER TABLE archive_items ADD COLUMN policy_resource_id TEXT;
ALTER TABLE archive_items ADD COLUMN policy_action TEXT;
ALTER TABLE archive_items ADD COLUMN policy_capability TEXT;

ALTER TABLE archive_versions
ADD COLUMN policy_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
  policy_receipt_hash IS NULL
  OR (length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE archive_versions
ADD COLUMN policy_receipt_version INTEGER CHECK(policy_receipt_version IS NULL OR policy_receipt_version=1);
ALTER TABLE archive_versions ADD COLUMN policy_receipt_nonce TEXT;
ALTER TABLE archive_versions ADD COLUMN policy_correlation_id TEXT;
ALTER TABLE archive_versions ADD COLUMN policy_resource_type TEXT;
ALTER TABLE archive_versions ADD COLUMN policy_resource_id TEXT;
ALTER TABLE archive_versions ADD COLUMN policy_action TEXT;
ALTER TABLE archive_versions ADD COLUMN policy_capability TEXT;

CREATE TABLE platform_policy_archive_business_mutations (
  receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
  receipt_version INTEGER NOT NULL CHECK(receipt_version=1),
  receipt_nonce TEXT NOT NULL CHECK(length(trim(receipt_nonce)) BETWEEN 1 AND 256),
  correlation_id TEXT NOT NULL CHECK(length(trim(correlation_id)) BETWEEN 1 AND 128),
  table_name TEXT NOT NULL CHECK(table_name IN ('archive_items','archive_versions')),
  operation TEXT NOT NULL CHECK(operation IN ('insert','update','destroy')),
  row_id TEXT NOT NULL CHECK(length(trim(row_id)) BETWEEN 1 AND 256),
  resource_type TEXT NOT NULL CHECK(resource_type='archive_item'),
  resource_id TEXT NOT NULL CHECK(length(trim(resource_id)) BETWEEN 1 AND 256),
  action TEXT NOT NULL CHECK(action IN ('create','update','delete')),
  capability TEXT NOT NULL CHECK(capability='archive.write'),
  consumed_at TEXT NOT NULL CHECK(
    length(consumed_at)=24
    AND consumed_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(consumed_at) IS NOT NULL
  ),
  PRIMARY KEY(receipt_hash,table_name,operation),
  UNIQUE(receipt_nonce,table_name,operation)
) STRICT;

CREATE INDEX idx_platform_policy_archive_mutation_row
ON platform_policy_archive_business_mutations(table_name,row_id,consumed_at DESC);
CREATE INDEX idx_archive_items_policy_receipt
ON archive_items(policy_receipt_hash)
WHERE policy_receipt_hash IS NOT NULL;
CREATE INDEX idx_archive_versions_policy_receipt
ON archive_versions(policy_receipt_hash)
WHERE policy_receipt_hash IS NOT NULL;

CREATE TRIGGER trg_platform_policy_archive_mutation_insert
BEFORE INSERT ON platform_policy_archive_business_mutations
WHEN NOT EXISTS(
    SELECT 1
    FROM platform_policy_transaction_receipts receipt
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    WHERE receipt.receipt_hash=NEW.receipt_hash
      AND receipt.receipt_version=NEW.receipt_version
      AND receipt.nonce=NEW.receipt_nonce
      AND receipt.correlation_id=NEW.correlation_id
      AND receipt.resource_type=NEW.resource_type
      AND receipt.resource_id=NEW.resource_id
      AND receipt.action=NEW.action
      AND receipt.capability=NEW.capability
      AND receipt.recorded_at=NEW.consumed_at
  )
  OR NOT (
    (
      NEW.table_name='archive_items'
      AND NEW.operation IN ('insert','update','destroy')
      AND NEW.row_id=NEW.resource_id
      AND NEW.action=CASE NEW.operation
        WHEN 'insert' THEN 'create'
        WHEN 'update' THEN 'update'
        ELSE 'delete'
      END
      AND EXISTS(
        SELECT 1 FROM archive_items item
        WHERE item.id=NEW.row_id
          AND item.policy_receipt_hash=NEW.receipt_hash
          AND item.policy_receipt_version=NEW.receipt_version
          AND item.policy_receipt_nonce=NEW.receipt_nonce
          AND item.policy_correlation_id=NEW.correlation_id
          AND item.policy_resource_type=NEW.resource_type
          AND item.policy_resource_id=NEW.resource_id
          AND item.policy_action=NEW.action
          AND item.policy_capability=NEW.capability
      )
    )
    OR
    (
      NEW.table_name='archive_versions'
      AND NEW.operation='insert'
      AND NEW.action='create'
      AND EXISTS(
        SELECT 1 FROM archive_versions version
        WHERE version.id=NEW.row_id
          AND version.archive_item_id=NEW.resource_id
          AND version.policy_receipt_hash=NEW.receipt_hash
          AND version.policy_receipt_version=NEW.receipt_version
          AND version.policy_receipt_nonce=NEW.receipt_nonce
          AND version.policy_correlation_id=NEW.correlation_id
          AND version.policy_resource_type=NEW.resource_type
          AND version.policy_resource_id=NEW.resource_id
          AND version.policy_action=NEW.action
          AND version.policy_capability=NEW.capability
      )
    )
  )
BEGIN
  SELECT RAISE(ABORT,'archive business mutation ledger binding is invalid');
END;

CREATE TRIGGER trg_platform_policy_archive_mutation_update
BEFORE UPDATE ON platform_policy_archive_business_mutations
BEGIN
  SELECT RAISE(ABORT,'archive business mutation ledger is immutable');
END;

CREATE TRIGGER trg_platform_policy_archive_mutation_delete
BEFORE DELETE ON platform_policy_archive_business_mutations
BEGIN
  SELECT RAISE(ABORT,'archive business mutation ledger is immutable');
END;

CREATE TRIGGER trg_archive_items_policy_insert
BEFORE INSERT ON archive_items
WHEN NEW.policy_resource_type IS NOT 'archive_item'
  OR NEW.policy_resource_id IS NOT NEW.id
  OR NEW.policy_action IS NOT 'create'
  OR NEW.policy_capability IS NOT 'archive.write'
  OR NOT EXISTS(
    SELECT 1
    FROM platform_policy_transaction_receipts receipt
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash
    WHERE receipt.receipt_hash=NEW.policy_receipt_hash
      AND receipt.receipt_version=NEW.policy_receipt_version
      AND receipt.nonce=NEW.policy_receipt_nonce
      AND receipt.correlation_id=NEW.policy_correlation_id
      AND receipt.resource_type=NEW.policy_resource_type
      AND receipt.resource_id=NEW.policy_resource_id
      AND receipt.action=NEW.policy_action
      AND receipt.capability=NEW.policy_capability
      AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
  )
  OR EXISTS(
    SELECT 1 FROM platform_policy_archive_business_mutations consumed
    WHERE consumed.receipt_hash=NEW.policy_receipt_hash
      AND consumed.table_name='archive_items'
      AND consumed.operation='insert'
  )
BEGIN
  SELECT RAISE(ABORT,'archive item insert requires a fresh exact policy receipt');
END;

CREATE TRIGGER trg_archive_items_policy_insert_consumption
AFTER INSERT ON archive_items
BEGIN
  INSERT INTO platform_policy_archive_business_mutations(
    receipt_hash,receipt_version,receipt_nonce,correlation_id,table_name,operation,
    row_id,resource_type,resource_id,action,capability,consumed_at
  )
  SELECT
    NEW.policy_receipt_hash,NEW.policy_receipt_version,NEW.policy_receipt_nonce,
    NEW.policy_correlation_id,'archive_items','insert',NEW.id,
    NEW.policy_resource_type,NEW.policy_resource_id,NEW.policy_action,
    NEW.policy_capability,receipt.recorded_at
  FROM platform_policy_transaction_receipts receipt
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash;
END;

CREATE TRIGGER trg_archive_items_policy_update
BEFORE UPDATE ON archive_items
WHEN NEW.id IS NOT OLD.id
  OR NEW.family_id IS NOT OLD.family_id
  OR NEW.created_at IS NOT OLD.created_at
  OR OLD.destroyed_at IS NOT NULL
  OR NEW.policy_resource_type IS NOT 'archive_item'
  OR NEW.policy_resource_id IS NOT NEW.id
  OR NEW.policy_capability IS NOT 'archive.write'
  OR NOT (
    (NEW.policy_action='update' AND NEW.destroyed_at IS OLD.destroyed_at)
    OR
    (
      NEW.policy_action='delete'
      AND OLD.destroyed_at IS NULL
      AND NEW.destroyed_at IS NOT NULL
      AND NEW.title IS OLD.title
      AND NEW.original_name IS OLD.original_name
      AND NEW.stored_name IS OLD.stored_name
      AND NEW.mime_type IS OLD.mime_type
      AND NEW.size_bytes IS OLD.size_bytes
      AND NEW.sha256 IS OLD.sha256
      AND NEW.linked_event_id IS OLD.linked_event_id
      AND NEW.category_id IS OLD.category_id
      AND NEW.sensitivity IS OLD.sensitivity
      AND NEW.ai_processing_allowed IS OLD.ai_processing_allowed
      AND NEW.retention_policy_id IS OLD.retention_policy_id
    )
  )
  OR NOT EXISTS(
    SELECT 1
    FROM platform_policy_transaction_receipts receipt
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash
    WHERE receipt.receipt_hash=NEW.policy_receipt_hash
      AND receipt.receipt_version=NEW.policy_receipt_version
      AND receipt.nonce=NEW.policy_receipt_nonce
      AND receipt.correlation_id=NEW.policy_correlation_id
      AND receipt.resource_type=NEW.policy_resource_type
      AND receipt.resource_id=NEW.policy_resource_id
      AND receipt.action=NEW.policy_action
      AND receipt.capability=NEW.policy_capability
      AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
  )
  OR EXISTS(
    SELECT 1 FROM platform_policy_archive_business_mutations consumed
    WHERE consumed.receipt_hash=NEW.policy_receipt_hash
      AND consumed.table_name='archive_items'
      AND consumed.operation=CASE NEW.policy_action WHEN 'delete' THEN 'destroy' ELSE 'update' END
  )
BEGIN
  SELECT RAISE(ABORT,'archive item update requires a fresh exact policy receipt');
END;

CREATE TRIGGER trg_archive_items_policy_update_consumption
AFTER UPDATE ON archive_items
BEGIN
  INSERT INTO platform_policy_archive_business_mutations(
    receipt_hash,receipt_version,receipt_nonce,correlation_id,table_name,operation,
    row_id,resource_type,resource_id,action,capability,consumed_at
  )
  SELECT
    NEW.policy_receipt_hash,NEW.policy_receipt_version,NEW.policy_receipt_nonce,
    NEW.policy_correlation_id,'archive_items',
    CASE NEW.policy_action WHEN 'delete' THEN 'destroy' ELSE 'update' END,
    NEW.id,NEW.policy_resource_type,NEW.policy_resource_id,NEW.policy_action,
    NEW.policy_capability,receipt.recorded_at
  FROM platform_policy_transaction_receipts receipt
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash;
END;

CREATE TRIGGER trg_archive_items_policy_delete
BEFORE DELETE ON archive_items
BEGIN
  SELECT RAISE(ABORT,'archive item physical deletion is forbidden');
END;

CREATE TRIGGER trg_archive_versions_policy_insert
BEFORE INSERT ON archive_versions
WHEN NEW.policy_resource_type IS NOT 'archive_item'
  OR NEW.policy_resource_id IS NOT NEW.archive_item_id
  OR NEW.policy_action IS NOT 'create'
  OR NEW.policy_capability IS NOT 'archive.write'
  OR NOT EXISTS(
    SELECT 1
    FROM platform_policy_transaction_receipts receipt
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash
    JOIN archive_items item
      ON item.id=NEW.archive_item_id
     AND item.family_id=json_extract(receipt.record_json,'$.request.resource.familyId')
    WHERE receipt.receipt_hash=NEW.policy_receipt_hash
      AND receipt.receipt_version=NEW.policy_receipt_version
      AND receipt.nonce=NEW.policy_receipt_nonce
      AND receipt.correlation_id=NEW.policy_correlation_id
      AND receipt.resource_type=NEW.policy_resource_type
      AND receipt.resource_id=NEW.policy_resource_id
      AND receipt.action=NEW.policy_action
      AND receipt.capability=NEW.policy_capability
  )
  OR EXISTS(
    SELECT 1 FROM platform_policy_archive_business_mutations consumed
    WHERE consumed.receipt_hash=NEW.policy_receipt_hash
      AND consumed.table_name='archive_versions'
      AND consumed.operation='insert'
  )
BEGIN
  SELECT RAISE(ABORT,'archive version insert requires a fresh exact parent policy receipt');
END;

CREATE TRIGGER trg_archive_versions_policy_insert_consumption
AFTER INSERT ON archive_versions
BEGIN
  INSERT INTO platform_policy_archive_business_mutations(
    receipt_hash,receipt_version,receipt_nonce,correlation_id,table_name,operation,
    row_id,resource_type,resource_id,action,capability,consumed_at
  )
  SELECT
    NEW.policy_receipt_hash,NEW.policy_receipt_version,NEW.policy_receipt_nonce,
    NEW.policy_correlation_id,'archive_versions','insert',NEW.id,
    NEW.policy_resource_type,NEW.policy_resource_id,NEW.policy_action,
    NEW.policy_capability,receipt.recorded_at
  FROM platform_policy_transaction_receipts receipt
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash;
END;

CREATE TRIGGER trg_archive_versions_policy_update
BEFORE UPDATE ON archive_versions
BEGIN
  SELECT RAISE(ABORT,'archive version mutation is forbidden');
END;

CREATE TRIGGER trg_archive_versions_policy_delete
BEFORE DELETE ON archive_versions
BEGIN
  SELECT RAISE(ABORT,'archive version deletion is forbidden');
END;

UPDATE database_metadata
SET value='REVISION-30-R-PPK-002-ARCHIVE-CORE-RECEIPT-FENCE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const archiveAccessoryReceiptFenceSql = `ALTER TABLE archive_retention_policies
ADD COLUMN policy_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
  policy_receipt_hash IS NULL
  OR (length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE archive_retention_policies
ADD COLUMN policy_receipt_version INTEGER CHECK(policy_receipt_version IS NULL OR policy_receipt_version=1);
ALTER TABLE archive_retention_policies ADD COLUMN policy_receipt_nonce TEXT;
ALTER TABLE archive_retention_policies ADD COLUMN policy_correlation_id TEXT;
ALTER TABLE archive_retention_policies ADD COLUMN policy_resource_type TEXT;
ALTER TABLE archive_retention_policies ADD COLUMN policy_resource_id TEXT;
ALTER TABLE archive_retention_policies ADD COLUMN policy_action TEXT;
ALTER TABLE archive_retention_policies ADD COLUMN policy_capability TEXT;

ALTER TABLE archive_categories
ADD COLUMN policy_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
  policy_receipt_hash IS NULL
  OR (length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE archive_categories
ADD COLUMN policy_receipt_version INTEGER CHECK(policy_receipt_version IS NULL OR policy_receipt_version=1);
ALTER TABLE archive_categories ADD COLUMN policy_receipt_nonce TEXT;
ALTER TABLE archive_categories ADD COLUMN policy_correlation_id TEXT;
ALTER TABLE archive_categories ADD COLUMN policy_resource_type TEXT;
ALTER TABLE archive_categories ADD COLUMN policy_resource_id TEXT;
ALTER TABLE archive_categories ADD COLUMN policy_action TEXT;
ALTER TABLE archive_categories ADD COLUMN policy_capability TEXT;

ALTER TABLE archive_tags
ADD COLUMN policy_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
  policy_receipt_hash IS NULL
  OR (length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE archive_tags
ADD COLUMN policy_receipt_version INTEGER CHECK(policy_receipt_version IS NULL OR policy_receipt_version=1);
ALTER TABLE archive_tags ADD COLUMN policy_receipt_nonce TEXT;
ALTER TABLE archive_tags ADD COLUMN policy_correlation_id TEXT;
ALTER TABLE archive_tags ADD COLUMN policy_resource_type TEXT;
ALTER TABLE archive_tags ADD COLUMN policy_resource_id TEXT;
ALTER TABLE archive_tags ADD COLUMN policy_action TEXT;
ALTER TABLE archive_tags ADD COLUMN policy_capability TEXT;

ALTER TABLE archive_item_tags
ADD COLUMN policy_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
  policy_receipt_hash IS NULL
  OR (length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE archive_item_tags
ADD COLUMN policy_receipt_version INTEGER CHECK(policy_receipt_version IS NULL OR policy_receipt_version=1);
ALTER TABLE archive_item_tags ADD COLUMN policy_receipt_nonce TEXT;
ALTER TABLE archive_item_tags ADD COLUMN policy_correlation_id TEXT;
ALTER TABLE archive_item_tags ADD COLUMN policy_resource_type TEXT;
ALTER TABLE archive_item_tags ADD COLUMN policy_resource_id TEXT;
ALTER TABLE archive_item_tags ADD COLUMN policy_action TEXT;
ALTER TABLE archive_item_tags ADD COLUMN policy_capability TEXT;

ALTER TABLE events
ADD COLUMN policy_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
  policy_receipt_hash IS NULL
  OR (length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE events
ADD COLUMN policy_receipt_version INTEGER CHECK(policy_receipt_version IS NULL OR policy_receipt_version=1);
ALTER TABLE events ADD COLUMN policy_receipt_nonce TEXT;
ALTER TABLE events ADD COLUMN policy_correlation_id TEXT;
ALTER TABLE events ADD COLUMN policy_resource_type TEXT;
ALTER TABLE events ADD COLUMN policy_resource_id TEXT;
ALTER TABLE events ADD COLUMN policy_action TEXT;
ALTER TABLE events ADD COLUMN policy_capability TEXT;

CREATE TABLE platform_policy_archive_accessory_mutations (
  receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
  receipt_version INTEGER NOT NULL CHECK(receipt_version=1),
  receipt_nonce TEXT NOT NULL CHECK(length(trim(receipt_nonce)) BETWEEN 1 AND 256),
  correlation_id TEXT NOT NULL CHECK(length(trim(correlation_id)) BETWEEN 1 AND 128),
  table_name TEXT NOT NULL CHECK(table_name IN (
    'archive_retention_policies','archive_categories','archive_tags',
    'archive_item_tags','events','archive_classification_batches'
  )),
  operation TEXT NOT NULL,
  row_id TEXT NOT NULL CHECK(length(trim(row_id)) BETWEEN 1 AND 256),
  related_row_id TEXT NOT NULL DEFAULT '' CHECK(length(related_row_id)<=256),
  resource_type TEXT NOT NULL CHECK(resource_type IN ('archive_item','archive_retention_policy','archive_category')),
  resource_id TEXT NOT NULL CHECK(length(trim(resource_id)) BETWEEN 1 AND 256),
  action TEXT NOT NULL CHECK(action IN ('create','update')),
  capability TEXT NOT NULL CHECK(capability='archive.write'),
  consumed_at TEXT NOT NULL CHECK(
    length(consumed_at)=24
    AND consumed_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(consumed_at) IS NOT NULL
  ),
  CHECK(
    (table_name='archive_retention_policies' AND operation='insert')
    OR (table_name='archive_categories' AND operation='insert')
    OR (table_name='archive_tags' AND operation='insert')
    OR (table_name='archive_item_tags' AND operation IN ('insert','delete'))
    OR (table_name='events' AND operation='attachment_increment')
    OR (table_name='archive_classification_batches' AND operation IN ('open','seal'))
  ),
  PRIMARY KEY(receipt_hash,table_name,operation,row_id,related_row_id),
  UNIQUE(receipt_nonce,table_name,operation,row_id,related_row_id)
) STRICT;

CREATE INDEX idx_platform_policy_archive_accessory_mutation_row
ON platform_policy_archive_accessory_mutations(table_name,row_id,related_row_id,consumed_at DESC);

CREATE TABLE platform_policy_archive_classification_batches (
  receipt_hash TEXT PRIMARY KEY REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
  receipt_version INTEGER NOT NULL CHECK(receipt_version=1),
  receipt_nonce TEXT NOT NULL UNIQUE CHECK(length(trim(receipt_nonce)) BETWEEN 1 AND 256),
  correlation_id TEXT NOT NULL CHECK(length(trim(correlation_id)) BETWEEN 1 AND 128),
  archive_item_id TEXT NOT NULL REFERENCES archive_items(id) ON DELETE RESTRICT,
  resource_type TEXT NOT NULL CHECK(resource_type='archive_item'),
  resource_id TEXT NOT NULL CHECK(length(trim(resource_id)) BETWEEN 1 AND 256),
  action TEXT NOT NULL CHECK(action='update'),
  capability TEXT NOT NULL CHECK(capability='archive.write'),
  desired_tags_json TEXT NOT NULL CHECK(
    json_valid(desired_tags_json)
    AND json_type(desired_tags_json)='array'
    AND json_array_length(desired_tags_json) BETWEEN 0 AND 20
  ),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','sealed')),
  opened_at TEXT NOT NULL CHECK(
    length(opened_at)=24
    AND opened_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(opened_at) IS NOT NULL
  ),
  sealed_at TEXT,
  CHECK(
    (status='open' AND sealed_at IS NULL)
    OR (
      status='sealed'
      AND length(sealed_at)=24
      AND sealed_at GLOB '????-??-??T??:??:??.???Z'
      AND julianday(sealed_at) IS NOT NULL
    )
  )
) STRICT;

CREATE UNIQUE INDEX idx_platform_policy_archive_classification_open_item
ON platform_policy_archive_classification_batches(archive_item_id)
WHERE status='open';

CREATE INDEX idx_archive_retention_policy_receipt
ON archive_retention_policies(policy_receipt_hash)
WHERE policy_receipt_hash IS NOT NULL;
CREATE INDEX idx_archive_category_receipt
ON archive_categories(policy_receipt_hash)
WHERE policy_receipt_hash IS NOT NULL;
CREATE INDEX idx_archive_tag_receipt
ON archive_tags(policy_receipt_hash)
WHERE policy_receipt_hash IS NOT NULL;
CREATE INDEX idx_archive_item_tag_receipt
ON archive_item_tags(policy_receipt_hash)
WHERE policy_receipt_hash IS NOT NULL;
CREATE INDEX idx_event_attachment_receipt
ON events(policy_receipt_hash)
WHERE policy_receipt_hash IS NOT NULL;

CREATE TRIGGER trg_platform_policy_archive_accessory_mutation_insert
BEFORE INSERT ON platform_policy_archive_accessory_mutations
WHEN NOT EXISTS(
    SELECT 1
    FROM platform_policy_transaction_receipts receipt
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash
    WHERE receipt.receipt_hash=NEW.receipt_hash
      AND receipt.receipt_version=NEW.receipt_version
      AND receipt.nonce=NEW.receipt_nonce
      AND receipt.correlation_id=NEW.correlation_id
      AND receipt.resource_type=NEW.resource_type
      AND receipt.resource_id=NEW.resource_id
      AND receipt.action=NEW.action
      AND receipt.capability=NEW.capability
      AND receipt.recorded_at=NEW.consumed_at
  )
  OR NOT (
    (
      NEW.table_name='archive_retention_policies'
      AND NEW.operation='insert'
      AND NEW.related_row_id=''
      AND NEW.resource_type='archive_retention_policy'
      AND NEW.resource_id=NEW.row_id
      AND NEW.action='create'
      AND EXISTS(
        SELECT 1 FROM archive_retention_policies policy
        WHERE policy.id=NEW.row_id
          AND policy.policy_receipt_hash=NEW.receipt_hash
          AND policy.policy_receipt_version=NEW.receipt_version
          AND policy.policy_receipt_nonce=NEW.receipt_nonce
          AND policy.policy_correlation_id=NEW.correlation_id
          AND policy.policy_resource_type=NEW.resource_type
          AND policy.policy_resource_id=NEW.resource_id
          AND policy.policy_action=NEW.action
          AND policy.policy_capability=NEW.capability
      )
    )
    OR (
      NEW.table_name='archive_categories'
      AND NEW.operation='insert'
      AND NEW.related_row_id=''
      AND NEW.resource_type='archive_category'
      AND NEW.resource_id=NEW.row_id
      AND NEW.action='create'
      AND EXISTS(
        SELECT 1 FROM archive_categories category
        WHERE category.id=NEW.row_id
          AND category.policy_receipt_hash=NEW.receipt_hash
          AND category.policy_receipt_version=NEW.receipt_version
          AND category.policy_receipt_nonce=NEW.receipt_nonce
          AND category.policy_correlation_id=NEW.correlation_id
          AND category.policy_resource_type=NEW.resource_type
          AND category.policy_resource_id=NEW.resource_id
          AND category.policy_action=NEW.action
          AND category.policy_capability=NEW.capability
      )
    )
    OR (
      NEW.table_name='archive_tags'
      AND NEW.operation='insert'
      AND NEW.related_row_id=''
      AND NEW.resource_type='archive_item'
      AND NEW.action='update'
      AND EXISTS(
        SELECT 1 FROM archive_tags tag
        WHERE tag.id=NEW.row_id
          AND tag.policy_receipt_hash=NEW.receipt_hash
          AND tag.policy_receipt_version=NEW.receipt_version
          AND tag.policy_receipt_nonce=NEW.receipt_nonce
          AND tag.policy_correlation_id=NEW.correlation_id
          AND tag.policy_resource_type=NEW.resource_type
          AND tag.policy_resource_id=NEW.resource_id
          AND tag.policy_action=NEW.action
          AND tag.policy_capability=NEW.capability
      )
    )
    OR (
      NEW.table_name='archive_item_tags'
      AND NEW.operation IN ('insert','delete')
      AND NEW.resource_type='archive_item'
      AND NEW.resource_id=NEW.row_id
      AND NEW.action='update'
      AND EXISTS(
        SELECT 1 FROM archive_item_tags relation
        WHERE relation.archive_item_id=NEW.row_id
          AND relation.tag_id=NEW.related_row_id
          AND relation.policy_receipt_hash=NEW.receipt_hash
          AND relation.policy_receipt_version=NEW.receipt_version
          AND relation.policy_receipt_nonce=NEW.receipt_nonce
          AND relation.policy_correlation_id=NEW.correlation_id
          AND relation.policy_resource_type=NEW.resource_type
          AND relation.policy_resource_id=NEW.resource_id
          AND relation.policy_action=NEW.action
          AND relation.policy_capability=NEW.capability
      )
    )
    OR (
      NEW.table_name='events'
      AND NEW.operation='attachment_increment'
      AND NEW.resource_type='archive_item'
      AND NEW.related_row_id=NEW.resource_id
      AND NEW.action='create'
      AND EXISTS(
        SELECT 1 FROM events event
        JOIN archive_items item
          ON item.id=NEW.resource_id
         AND item.linked_event_id=event.id
         AND item.family_id=event.family_id
        WHERE event.id=NEW.row_id
          AND event.policy_receipt_hash=NEW.receipt_hash
          AND event.policy_receipt_version=NEW.receipt_version
          AND event.policy_receipt_nonce=NEW.receipt_nonce
          AND event.policy_correlation_id=NEW.correlation_id
          AND event.policy_resource_type=NEW.resource_type
          AND event.policy_resource_id=NEW.resource_id
          AND event.policy_action=NEW.action
          AND event.policy_capability=NEW.capability
      )
    )
    OR (
      NEW.table_name='archive_classification_batches'
      AND NEW.operation IN ('open','seal')
      AND NEW.related_row_id=''
      AND NEW.resource_type='archive_item'
      AND NEW.resource_id=NEW.row_id
      AND NEW.action='update'
      AND EXISTS(
        SELECT 1 FROM platform_policy_archive_classification_batches batch
        WHERE batch.receipt_hash=NEW.receipt_hash
          AND batch.receipt_version=NEW.receipt_version
          AND batch.receipt_nonce=NEW.receipt_nonce
          AND batch.correlation_id=NEW.correlation_id
          AND batch.archive_item_id=NEW.row_id
          AND batch.resource_type=NEW.resource_type
          AND batch.resource_id=NEW.resource_id
          AND batch.action=NEW.action
          AND batch.capability=NEW.capability
          AND batch.status=CASE NEW.operation WHEN 'open' THEN 'open' ELSE 'sealed' END
      )
    )
  )
BEGIN
  SELECT RAISE(ABORT,'archive accessory mutation ledger binding is invalid');
END;

CREATE TRIGGER trg_platform_policy_archive_accessory_mutation_update
BEFORE UPDATE ON platform_policy_archive_accessory_mutations
BEGIN
  SELECT RAISE(ABORT,'archive accessory mutation ledger is immutable');
END;

CREATE TRIGGER trg_platform_policy_archive_accessory_mutation_delete
BEFORE DELETE ON platform_policy_archive_accessory_mutations
BEGIN
  SELECT RAISE(ABORT,'archive accessory mutation ledger is immutable');
END;

CREATE TRIGGER trg_archive_retention_policies_policy_insert
BEFORE INSERT ON archive_retention_policies
WHEN NEW.policy_resource_type IS NOT 'archive_retention_policy'
  OR NEW.policy_resource_id IS NOT NEW.id
  OR NEW.policy_action IS NOT 'create'
  OR NEW.policy_capability IS NOT 'archive.write'
  OR NOT EXISTS(
    SELECT 1
    FROM platform_policy_transaction_receipts receipt
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash
    WHERE receipt.receipt_hash=NEW.policy_receipt_hash
      AND receipt.receipt_version=NEW.policy_receipt_version
      AND receipt.nonce=NEW.policy_receipt_nonce
      AND receipt.correlation_id=NEW.policy_correlation_id
      AND receipt.resource_type=NEW.policy_resource_type
      AND receipt.resource_id=NEW.policy_resource_id
      AND receipt.action=NEW.policy_action
      AND receipt.capability=NEW.policy_capability
      AND json_type(receipt.record_json,'$.request.resource.familyId')='text'
  )
  OR EXISTS(
    SELECT 1 FROM platform_policy_archive_accessory_mutations consumed
    WHERE consumed.receipt_hash=NEW.policy_receipt_hash
      AND consumed.table_name='archive_retention_policies'
      AND consumed.operation='insert'
  )
BEGIN
  SELECT RAISE(ABORT,'archive retention policy insert requires a fresh exact policy receipt');
END;

CREATE TRIGGER trg_archive_retention_policies_policy_insert_consumption
AFTER INSERT ON archive_retention_policies
BEGIN
  INSERT INTO platform_policy_archive_accessory_mutations(
    receipt_hash,receipt_version,receipt_nonce,correlation_id,table_name,operation,
    row_id,related_row_id,resource_type,resource_id,action,capability,consumed_at
  )
  SELECT NEW.policy_receipt_hash,NEW.policy_receipt_version,NEW.policy_receipt_nonce,
    NEW.policy_correlation_id,'archive_retention_policies','insert',NEW.id,'',
    NEW.policy_resource_type,NEW.policy_resource_id,NEW.policy_action,NEW.policy_capability,
    receipt.recorded_at
  FROM platform_policy_transaction_receipts receipt
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash;
END;

CREATE TRIGGER trg_archive_retention_policies_policy_update
BEFORE UPDATE ON archive_retention_policies
BEGIN
  SELECT RAISE(ABORT,'archive retention policy mutation is forbidden');
END;

CREATE TRIGGER trg_archive_retention_policies_policy_delete
BEFORE DELETE ON archive_retention_policies
BEGIN
  SELECT RAISE(ABORT,'archive retention policy deletion is forbidden');
END;

CREATE TRIGGER trg_archive_categories_policy_insert
BEFORE INSERT ON archive_categories
WHEN NEW.policy_resource_type IS NOT 'archive_category'
  OR NEW.policy_resource_id IS NOT NEW.id
  OR NEW.policy_action IS NOT 'create'
  OR NEW.policy_capability IS NOT 'archive.write'
  OR NOT EXISTS(
    SELECT 1
    FROM platform_policy_transaction_receipts receipt
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash
    WHERE receipt.receipt_hash=NEW.policy_receipt_hash
      AND receipt.receipt_version=NEW.policy_receipt_version
      AND receipt.nonce=NEW.policy_receipt_nonce
      AND receipt.correlation_id=NEW.policy_correlation_id
      AND receipt.resource_type=NEW.policy_resource_type
      AND receipt.resource_id=NEW.policy_resource_id
      AND receipt.action=NEW.policy_action
      AND receipt.capability=NEW.policy_capability
      AND json_type(receipt.record_json,'$.request.resource.familyId')='text'
  )
  OR EXISTS(
    SELECT 1 FROM platform_policy_archive_accessory_mutations consumed
    WHERE consumed.receipt_hash=NEW.policy_receipt_hash
      AND consumed.table_name='archive_categories'
      AND consumed.operation='insert'
  )
BEGIN
  SELECT RAISE(ABORT,'archive category insert requires a fresh exact policy receipt');
END;

CREATE TRIGGER trg_archive_categories_policy_insert_consumption
AFTER INSERT ON archive_categories
BEGIN
  INSERT INTO platform_policy_archive_accessory_mutations(
    receipt_hash,receipt_version,receipt_nonce,correlation_id,table_name,operation,
    row_id,related_row_id,resource_type,resource_id,action,capability,consumed_at
  )
  SELECT NEW.policy_receipt_hash,NEW.policy_receipt_version,NEW.policy_receipt_nonce,
    NEW.policy_correlation_id,'archive_categories','insert',NEW.id,'',
    NEW.policy_resource_type,NEW.policy_resource_id,NEW.policy_action,NEW.policy_capability,
    receipt.recorded_at
  FROM platform_policy_transaction_receipts receipt
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash;
END;

CREATE TRIGGER trg_archive_categories_policy_update
BEFORE UPDATE ON archive_categories
BEGIN
  SELECT RAISE(ABORT,'archive category mutation is forbidden');
END;

CREATE TRIGGER trg_archive_categories_policy_delete
BEFORE DELETE ON archive_categories
BEGIN
  SELECT RAISE(ABORT,'archive category deletion is forbidden');
END;

CREATE TRIGGER trg_archive_classification_batch_insert
BEFORE INSERT ON platform_policy_archive_classification_batches
WHEN NEW.status IS NOT 'open'
  OR NEW.sealed_at IS NOT NULL
  OR NEW.resource_type IS NOT 'archive_item'
  OR NEW.resource_id IS NOT NEW.archive_item_id
  OR NEW.action IS NOT 'update'
  OR NEW.capability IS NOT 'archive.write'
  OR EXISTS(
    SELECT 1 FROM json_each(NEW.desired_tags_json) desired
    WHERE json_type(desired.value,'$.id') IS NOT 'text'
       OR json_type(desired.value,'$.name') IS NOT 'text'
       OR length(trim(CAST(json_extract(desired.value,'$.id') AS TEXT))) NOT BETWEEN 1 AND 256
       OR length(trim(CAST(json_extract(desired.value,'$.name') AS TEXT))) NOT BETWEEN 1 AND 80
  )
  OR EXISTS(
    SELECT 1
    FROM json_each(NEW.desired_tags_json) left_tag
    JOIN json_each(NEW.desired_tags_json) right_tag
      ON CAST(left_tag.key AS INTEGER)<CAST(right_tag.key AS INTEGER)
    WHERE json_extract(left_tag.value,'$.id')=json_extract(right_tag.value,'$.id')
       OR json_extract(left_tag.value,'$.name')=json_extract(right_tag.value,'$.name') COLLATE NOCASE
  )
  OR NOT EXISTS(
    SELECT 1
    FROM platform_policy_transaction_receipts receipt
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash
    JOIN archive_items item
      ON item.id=NEW.archive_item_id
     AND item.family_id=json_extract(receipt.record_json,'$.request.resource.familyId')
     AND item.policy_receipt_hash=receipt.receipt_hash
     AND item.policy_receipt_version=receipt.receipt_version
     AND item.policy_receipt_nonce=receipt.nonce
     AND item.policy_correlation_id=receipt.correlation_id
     AND item.policy_resource_type=receipt.resource_type
     AND item.policy_resource_id=receipt.resource_id
     AND item.policy_action=receipt.action
     AND item.policy_capability=receipt.capability
    WHERE receipt.receipt_hash=NEW.receipt_hash
      AND receipt.receipt_version=NEW.receipt_version
      AND receipt.nonce=NEW.receipt_nonce
      AND receipt.correlation_id=NEW.correlation_id
      AND receipt.resource_type=NEW.resource_type
      AND receipt.resource_id=NEW.resource_id
      AND receipt.action=NEW.action
      AND receipt.capability=NEW.capability
      AND receipt.recorded_at=NEW.opened_at
  )
  OR EXISTS(
    SELECT 1 FROM platform_policy_archive_accessory_mutations consumed
    WHERE consumed.receipt_hash=NEW.receipt_hash
      AND consumed.table_name='archive_classification_batches'
  )
BEGIN
  SELECT RAISE(ABORT,'archive classification batch requires a fresh exact item update receipt');
END;

CREATE TRIGGER trg_archive_tags_policy_insert
BEFORE INSERT ON archive_tags
WHEN NEW.policy_resource_type IS NOT 'archive_item'
  OR NEW.policy_action IS NOT 'update'
  OR NEW.policy_capability IS NOT 'archive.write'
  OR NOT EXISTS(
    SELECT 1
    FROM platform_policy_archive_classification_batches batch
    JOIN platform_policy_transaction_receipts receipt
      ON receipt.receipt_hash=batch.receipt_hash
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash
    JOIN json_each(batch.desired_tags_json) desired
      ON json_extract(desired.value,'$.id')=NEW.id
     AND json_extract(desired.value,'$.name')=NEW.name COLLATE NOCASE
    WHERE batch.status='open'
      AND batch.receipt_hash=NEW.policy_receipt_hash
      AND batch.receipt_version=NEW.policy_receipt_version
      AND batch.receipt_nonce=NEW.policy_receipt_nonce
      AND batch.correlation_id=NEW.policy_correlation_id
      AND batch.resource_type=NEW.policy_resource_type
      AND batch.resource_id=NEW.policy_resource_id
      AND batch.action=NEW.policy_action
      AND batch.capability=NEW.policy_capability
  )
  OR EXISTS(
    SELECT 1 FROM platform_policy_archive_accessory_mutations consumed
    WHERE consumed.receipt_hash=NEW.policy_receipt_hash
      AND consumed.table_name='archive_tags'
      AND consumed.operation='insert'
      AND consumed.row_id=NEW.id
  )
BEGIN
  SELECT RAISE(ABORT,'archive tag insert requires an open exact classification receipt batch');
END;

CREATE TRIGGER trg_archive_tags_policy_insert_consumption
AFTER INSERT ON archive_tags
BEGIN
  INSERT INTO platform_policy_archive_accessory_mutations(
    receipt_hash,receipt_version,receipt_nonce,correlation_id,table_name,operation,
    row_id,related_row_id,resource_type,resource_id,action,capability,consumed_at
  )
  SELECT NEW.policy_receipt_hash,NEW.policy_receipt_version,NEW.policy_receipt_nonce,
    NEW.policy_correlation_id,'archive_tags','insert',NEW.id,'',NEW.policy_resource_type,
    NEW.policy_resource_id,NEW.policy_action,NEW.policy_capability,receipt.recorded_at
  FROM platform_policy_transaction_receipts receipt
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash;
END;

CREATE TRIGGER trg_archive_tags_policy_update
BEFORE UPDATE ON archive_tags
BEGIN
  SELECT RAISE(ABORT,'archive tag mutation is forbidden');
END;

CREATE TRIGGER trg_archive_tags_policy_delete
BEFORE DELETE ON archive_tags
BEGIN
  SELECT RAISE(ABORT,'archive tag deletion is forbidden');
END;

CREATE TRIGGER trg_archive_item_tags_policy_update
BEFORE UPDATE ON archive_item_tags
WHEN NEW.archive_item_id IS NOT OLD.archive_item_id
  OR NEW.tag_id IS NOT OLD.tag_id
  OR NEW.policy_resource_type IS NOT 'archive_item'
  OR NEW.policy_resource_id IS NOT NEW.archive_item_id
  OR NEW.policy_action IS NOT 'update'
  OR NEW.policy_capability IS NOT 'archive.write'
  OR NOT EXISTS(
    SELECT 1
    FROM platform_policy_archive_classification_batches batch
    JOIN platform_policy_transaction_receipts receipt
      ON receipt.receipt_hash=batch.receipt_hash
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash
    WHERE batch.status='open'
      AND batch.archive_item_id=NEW.archive_item_id
      AND batch.receipt_hash=NEW.policy_receipt_hash
      AND batch.receipt_version=NEW.policy_receipt_version
      AND batch.receipt_nonce=NEW.policy_receipt_nonce
      AND batch.correlation_id=NEW.policy_correlation_id
      AND batch.resource_type=NEW.policy_resource_type
      AND batch.resource_id=NEW.policy_resource_id
      AND batch.action=NEW.policy_action
      AND batch.capability=NEW.policy_capability
  )
BEGIN
  SELECT RAISE(ABORT,'archive item-tag staging requires an open exact classification receipt batch');
END;

CREATE TRIGGER trg_archive_item_tags_policy_insert
BEFORE INSERT ON archive_item_tags
WHEN NEW.policy_resource_type IS NOT 'archive_item'
  OR NEW.policy_resource_id IS NOT NEW.archive_item_id
  OR NEW.policy_action IS NOT 'update'
  OR NEW.policy_capability IS NOT 'archive.write'
  OR NOT EXISTS(
    SELECT 1
    FROM platform_policy_archive_classification_batches batch
    JOIN platform_policy_transaction_receipts receipt
      ON receipt.receipt_hash=batch.receipt_hash
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash
    JOIN archive_tags tag ON tag.id=NEW.tag_id
    JOIN json_each(batch.desired_tags_json) desired
      ON json_extract(desired.value,'$.name')=tag.name COLLATE NOCASE
    WHERE batch.status='open'
      AND batch.archive_item_id=NEW.archive_item_id
      AND batch.receipt_hash=NEW.policy_receipt_hash
      AND batch.receipt_version=NEW.policy_receipt_version
      AND batch.receipt_nonce=NEW.policy_receipt_nonce
      AND batch.correlation_id=NEW.policy_correlation_id
      AND batch.resource_type=NEW.policy_resource_type
      AND batch.resource_id=NEW.policy_resource_id
      AND batch.action=NEW.policy_action
      AND batch.capability=NEW.policy_capability
  )
  OR EXISTS(
    SELECT 1 FROM platform_policy_archive_accessory_mutations consumed
    WHERE consumed.receipt_hash=NEW.policy_receipt_hash
      AND consumed.table_name='archive_item_tags'
      AND consumed.operation='insert'
      AND consumed.row_id=NEW.archive_item_id
      AND consumed.related_row_id=NEW.tag_id
  )
BEGIN
  SELECT RAISE(ABORT,'archive item-tag insert requires a desired relation in an open exact classification receipt batch');
END;

CREATE TRIGGER trg_archive_item_tags_policy_insert_consumption
AFTER INSERT ON archive_item_tags
BEGIN
  INSERT INTO platform_policy_archive_accessory_mutations(
    receipt_hash,receipt_version,receipt_nonce,correlation_id,table_name,operation,
    row_id,related_row_id,resource_type,resource_id,action,capability,consumed_at
  )
  SELECT NEW.policy_receipt_hash,NEW.policy_receipt_version,NEW.policy_receipt_nonce,
    NEW.policy_correlation_id,'archive_item_tags','insert',NEW.archive_item_id,NEW.tag_id,
    NEW.policy_resource_type,NEW.policy_resource_id,NEW.policy_action,NEW.policy_capability,
    receipt.recorded_at
  FROM platform_policy_transaction_receipts receipt
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash;
END;

CREATE TRIGGER trg_archive_item_tags_policy_delete
BEFORE DELETE ON archive_item_tags
BEGIN
  SELECT RAISE(ABORT,'archive item-tag deletion requires an open exact classification receipt batch')
  WHERE OLD.policy_resource_type IS NOT 'archive_item'
     OR OLD.policy_resource_id IS NOT OLD.archive_item_id
     OR OLD.policy_action IS NOT 'update'
     OR OLD.policy_capability IS NOT 'archive.write'
     OR NOT EXISTS(
       SELECT 1
       FROM platform_policy_archive_classification_batches batch
       JOIN platform_policy_transaction_receipts receipt
         ON receipt.receipt_hash=batch.receipt_hash
       JOIN platform_policy_database_fences fence
         ON fence.fence_name=receipt.fence_name
        AND fence.epoch=receipt.fence_epoch
        AND fence.writable=1
       JOIN platform_policy_journal_projection_outbox projection
         ON projection.receipt_hash=receipt.receipt_hash
       WHERE batch.status='open'
         AND batch.archive_item_id=OLD.archive_item_id
         AND batch.receipt_hash=OLD.policy_receipt_hash
         AND batch.receipt_version=OLD.policy_receipt_version
         AND batch.receipt_nonce=OLD.policy_receipt_nonce
         AND batch.correlation_id=OLD.policy_correlation_id
         AND batch.resource_type=OLD.policy_resource_type
         AND batch.resource_id=OLD.policy_resource_id
         AND batch.action=OLD.policy_action
         AND batch.capability=OLD.policy_capability
     )
     OR EXISTS(
       SELECT 1 FROM platform_policy_archive_accessory_mutations consumed
       WHERE consumed.receipt_hash=OLD.policy_receipt_hash
         AND consumed.table_name='archive_item_tags'
         AND consumed.operation='delete'
         AND consumed.row_id=OLD.archive_item_id
         AND consumed.related_row_id=OLD.tag_id
     );
  INSERT INTO platform_policy_archive_accessory_mutations(
    receipt_hash,receipt_version,receipt_nonce,correlation_id,table_name,operation,
    row_id,related_row_id,resource_type,resource_id,action,capability,consumed_at
  )
  SELECT OLD.policy_receipt_hash,OLD.policy_receipt_version,OLD.policy_receipt_nonce,
    OLD.policy_correlation_id,'archive_item_tags','delete',OLD.archive_item_id,OLD.tag_id,
    OLD.policy_resource_type,OLD.policy_resource_id,OLD.policy_action,OLD.policy_capability,
    receipt.recorded_at
  FROM platform_policy_transaction_receipts receipt
  WHERE receipt.receipt_hash=OLD.policy_receipt_hash;
END;

CREATE TRIGGER trg_archive_classification_batch_apply
AFTER INSERT ON platform_policy_archive_classification_batches
BEGIN
  INSERT INTO platform_policy_archive_accessory_mutations(
    receipt_hash,receipt_version,receipt_nonce,correlation_id,table_name,operation,
    row_id,related_row_id,resource_type,resource_id,action,capability,consumed_at
  ) VALUES(
    NEW.receipt_hash,NEW.receipt_version,NEW.receipt_nonce,NEW.correlation_id,
    'archive_classification_batches','open',NEW.archive_item_id,'',NEW.resource_type,
    NEW.resource_id,NEW.action,NEW.capability,NEW.opened_at
  );

  UPDATE archive_item_tags
  SET policy_receipt_hash=NEW.receipt_hash,
      policy_receipt_version=NEW.receipt_version,
      policy_receipt_nonce=NEW.receipt_nonce,
      policy_correlation_id=NEW.correlation_id,
      policy_resource_type=NEW.resource_type,
      policy_resource_id=NEW.resource_id,
      policy_action=NEW.action,
      policy_capability=NEW.capability
  WHERE archive_item_id=NEW.archive_item_id;

  DELETE FROM archive_item_tags
  WHERE archive_item_id=NEW.archive_item_id;

  INSERT INTO archive_tags(
    id,name,created_at,policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
    policy_correlation_id,policy_resource_type,policy_resource_id,policy_action,policy_capability
  )
  SELECT
    json_extract(desired.value,'$.id'),json_extract(desired.value,'$.name'),NEW.opened_at,
    NEW.receipt_hash,NEW.receipt_version,NEW.receipt_nonce,NEW.correlation_id,
    NEW.resource_type,NEW.resource_id,NEW.action,NEW.capability
  FROM json_each(NEW.desired_tags_json) desired
  WHERE NOT EXISTS(
    SELECT 1 FROM archive_tags existing
    WHERE existing.name=json_extract(desired.value,'$.name') COLLATE NOCASE
  )
  ORDER BY CAST(desired.key AS INTEGER);

  INSERT INTO archive_item_tags(
    archive_item_id,tag_id,policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
    policy_correlation_id,policy_resource_type,policy_resource_id,policy_action,policy_capability
  )
  SELECT NEW.archive_item_id,tag.id,NEW.receipt_hash,NEW.receipt_version,NEW.receipt_nonce,
    NEW.correlation_id,NEW.resource_type,NEW.resource_id,NEW.action,NEW.capability
  FROM json_each(NEW.desired_tags_json) desired
  JOIN archive_tags tag
    ON tag.name=json_extract(desired.value,'$.name') COLLATE NOCASE
  ORDER BY CAST(desired.key AS INTEGER);

  UPDATE platform_policy_archive_classification_batches
  SET status='sealed',sealed_at=NEW.opened_at
  WHERE receipt_hash=NEW.receipt_hash AND status='open';
END;

CREATE TRIGGER trg_archive_classification_batch_seal
BEFORE UPDATE ON platform_policy_archive_classification_batches
WHEN OLD.status IS NOT 'open'
  OR NEW.status IS NOT 'sealed'
  OR NEW.sealed_at IS NOT OLD.opened_at
  OR NEW.receipt_hash IS NOT OLD.receipt_hash
  OR NEW.receipt_version IS NOT OLD.receipt_version
  OR NEW.receipt_nonce IS NOT OLD.receipt_nonce
  OR NEW.correlation_id IS NOT OLD.correlation_id
  OR NEW.archive_item_id IS NOT OLD.archive_item_id
  OR NEW.resource_type IS NOT OLD.resource_type
  OR NEW.resource_id IS NOT OLD.resource_id
  OR NEW.action IS NOT OLD.action
  OR NEW.capability IS NOT OLD.capability
  OR NEW.desired_tags_json IS NOT OLD.desired_tags_json
  OR NEW.opened_at IS NOT OLD.opened_at
  OR NOT EXISTS(
    SELECT 1
    FROM platform_policy_transaction_receipts receipt
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash
    WHERE receipt.receipt_hash=NEW.receipt_hash
      AND receipt.receipt_version=NEW.receipt_version
      AND receipt.nonce=NEW.receipt_nonce
      AND receipt.correlation_id=NEW.correlation_id
      AND receipt.resource_type=NEW.resource_type
      AND receipt.resource_id=NEW.resource_id
      AND receipt.action=NEW.action
      AND receipt.capability=NEW.capability
      AND receipt.recorded_at=NEW.sealed_at
  )
  OR (SELECT count(*) FROM archive_item_tags relation WHERE relation.archive_item_id=NEW.archive_item_id)
     IS NOT json_array_length(NEW.desired_tags_json)
  OR EXISTS(
    SELECT 1 FROM json_each(NEW.desired_tags_json) desired
    WHERE NOT EXISTS(
      SELECT 1
      FROM archive_item_tags relation
      JOIN archive_tags tag ON tag.id=relation.tag_id
      WHERE relation.archive_item_id=NEW.archive_item_id
        AND tag.name=json_extract(desired.value,'$.name') COLLATE NOCASE
        AND relation.policy_receipt_hash=NEW.receipt_hash
        AND relation.policy_receipt_version=NEW.receipt_version
        AND relation.policy_receipt_nonce=NEW.receipt_nonce
        AND relation.policy_correlation_id=NEW.correlation_id
        AND relation.policy_resource_type=NEW.resource_type
        AND relation.policy_resource_id=NEW.resource_id
        AND relation.policy_action=NEW.action
        AND relation.policy_capability=NEW.capability
    )
  )
  OR EXISTS(
    SELECT 1
    FROM archive_item_tags relation
    JOIN archive_tags tag ON tag.id=relation.tag_id
    WHERE relation.archive_item_id=NEW.archive_item_id
      AND NOT EXISTS(
        SELECT 1 FROM json_each(NEW.desired_tags_json) desired
        WHERE json_extract(desired.value,'$.name')=tag.name COLLATE NOCASE
      )
  )
  OR EXISTS(
    SELECT 1 FROM platform_policy_archive_accessory_mutations consumed
    WHERE consumed.receipt_hash=NEW.receipt_hash
      AND consumed.table_name='archive_classification_batches'
      AND consumed.operation='seal'
  )
BEGIN
  SELECT RAISE(ABORT,'archive classification batch cannot seal without an exact complete desired tag set');
END;

CREATE TRIGGER trg_archive_classification_batch_seal_consumption
AFTER UPDATE OF status ON platform_policy_archive_classification_batches
WHEN OLD.status='open' AND NEW.status='sealed'
BEGIN
  INSERT INTO platform_policy_archive_accessory_mutations(
    receipt_hash,receipt_version,receipt_nonce,correlation_id,table_name,operation,
    row_id,related_row_id,resource_type,resource_id,action,capability,consumed_at
  ) VALUES(
    NEW.receipt_hash,NEW.receipt_version,NEW.receipt_nonce,NEW.correlation_id,
    'archive_classification_batches','seal',NEW.archive_item_id,'',NEW.resource_type,
    NEW.resource_id,NEW.action,NEW.capability,NEW.sealed_at
  );
END;

CREATE TRIGGER trg_archive_classification_batch_delete
BEFORE DELETE ON platform_policy_archive_classification_batches
BEGIN
  SELECT RAISE(ABORT,'archive classification receipt batch is durable');
END;

CREATE TRIGGER trg_events_attachment_initial_count
BEFORE INSERT ON events
WHEN NEW.attachment_count<>0
BEGIN
  SELECT RAISE(ABORT,'event initial attachment count must be zero');
END;

CREATE TRIGGER trg_events_attachment_policy_update
BEFORE UPDATE OF attachment_count ON events
WHEN NEW.attachment_count IS NOT OLD.attachment_count
 AND (
  NEW.attachment_count IS NOT OLD.attachment_count+1
  OR NEW.id IS NOT OLD.id
  OR NEW.family_id IS NOT OLD.family_id
  OR NEW.kind IS NOT OLD.kind
  OR NEW.title IS NOT OLD.title
  OR NEW.description IS NOT OLD.description
  OR NEW.start_at IS NOT OLD.start_at
  OR NEW.location_id IS NOT OLD.location_id
  OR NEW.location_label IS NOT OLD.location_label
  OR NEW.visibility IS NOT OLD.visibility
  OR NEW.participant_person_ids IS NOT OLD.participant_person_ids
  OR NEW.invitation_text IS NOT OLD.invitation_text
  OR NEW.notes IS NOT OLD.notes
  OR NEW.ai_processing_allowed IS NOT OLD.ai_processing_allowed
  OR NEW.recurrence IS NOT OLD.recurrence
  OR NEW.reminder_days IS NOT OLD.reminder_days
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.updated_at IS NOT OLD.updated_at
  OR NEW.archived_at IS NOT OLD.archived_at
  OR NEW.policy_resource_type IS NOT 'archive_item'
  OR NEW.policy_action IS NOT 'create'
  OR NEW.policy_capability IS NOT 'archive.write'
  OR NOT EXISTS(
    SELECT 1
    FROM platform_policy_transaction_receipts receipt
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash
    JOIN archive_items item
      ON item.id=NEW.policy_resource_id
     AND item.family_id=NEW.family_id
     AND item.linked_event_id=NEW.id
     AND item.policy_receipt_hash=receipt.receipt_hash
     AND item.policy_receipt_version=receipt.receipt_version
     AND item.policy_receipt_nonce=receipt.nonce
     AND item.policy_correlation_id=receipt.correlation_id
     AND item.policy_resource_type=receipt.resource_type
     AND item.policy_resource_id=receipt.resource_id
     AND item.policy_action=receipt.action
     AND item.policy_capability=receipt.capability
    WHERE receipt.receipt_hash=NEW.policy_receipt_hash
      AND receipt.receipt_version=NEW.policy_receipt_version
      AND receipt.nonce=NEW.policy_receipt_nonce
      AND receipt.correlation_id=NEW.policy_correlation_id
      AND receipt.resource_type=NEW.policy_resource_type
      AND receipt.resource_id=NEW.policy_resource_id
      AND receipt.action=NEW.policy_action
      AND receipt.capability=NEW.policy_capability
      AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
  )
  OR EXISTS(
    SELECT 1 FROM platform_policy_archive_accessory_mutations consumed
    WHERE consumed.receipt_hash=NEW.policy_receipt_hash
      AND consumed.table_name='events'
      AND consumed.operation='attachment_increment'
  )
 )
BEGIN
  SELECT RAISE(ABORT,'event attachment increment requires a fresh exact linked archive item receipt');
END;

CREATE TRIGGER trg_events_attachment_policy_update_consumption
AFTER UPDATE OF attachment_count ON events
WHEN NEW.attachment_count IS NOT OLD.attachment_count
BEGIN
  INSERT INTO platform_policy_archive_accessory_mutations(
    receipt_hash,receipt_version,receipt_nonce,correlation_id,table_name,operation,
    row_id,related_row_id,resource_type,resource_id,action,capability,consumed_at
  )
  SELECT NEW.policy_receipt_hash,NEW.policy_receipt_version,NEW.policy_receipt_nonce,
    NEW.policy_correlation_id,'events','attachment_increment',NEW.id,NEW.policy_resource_id,
    NEW.policy_resource_type,NEW.policy_resource_id,NEW.policy_action,NEW.policy_capability,
    receipt.recorded_at
  FROM platform_policy_transaction_receipts receipt
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash;
END;

UPDATE database_metadata
SET value='REVISION-30-S-PPK-002-ARCHIVE-ACCESSORY-RECEIPT-FENCE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const archiveOperationIdempotencySql = `CREATE TABLE platform_policy_archive_operations (
  operation_id TEXT PRIMARY KEY CHECK(
    length(operation_id) BETWEEN 1 AND 128
    AND substr(operation_id,1,1) GLOB '[A-Za-z0-9]'
    AND operation_id NOT GLOB '*[^A-Za-z0-9._:-]*'
  ),
  operation_fingerprint TEXT NOT NULL CHECK(
    length(operation_fingerprint)=64 AND operation_fingerprint NOT GLOB '*[^0-9a-f]*'
  ),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  actor_account_id TEXT NOT NULL CHECK(length(trim(actor_account_id)) BETWEEN 1 AND 128),
  purpose TEXT NOT NULL CHECK(purpose='archive'),
  resource_type TEXT NOT NULL CHECK(resource_type IN ('archive_item','archive_retention_policy','archive_category')),
  resource_id TEXT NOT NULL CHECK(length(trim(resource_id)) BETWEEN 1 AND 256),
  action TEXT NOT NULL CHECK(action IN ('create','update','delete','record')),
  capability TEXT NOT NULL CHECK(capability='archive.write'),
  original_receipt_hash TEXT NOT NULL UNIQUE
    REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
  original_correlation_id TEXT NOT NULL UNIQUE CHECK(length(trim(original_correlation_id)) BETWEEN 1 AND 128),
  result_json TEXT NOT NULL CHECK(json_valid(result_json)),
  result_hash TEXT NOT NULL CHECK(
    length(result_hash)=64 AND result_hash NOT GLOB '*[^0-9a-f]*'
  ),
  completed_at TEXT NOT NULL CHECK(
    length(completed_at)=24 AND completed_at GLOB '????-??-??T??:??:??.???Z' AND julianday(completed_at) IS NOT NULL
  )
) STRICT;

CREATE INDEX idx_platform_policy_archive_operation_resource
ON platform_policy_archive_operations(resource_type,resource_id,completed_at DESC);

CREATE TRIGGER trg_platform_policy_archive_operation_insert
BEFORE INSERT ON platform_policy_archive_operations
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name
   AND fence.epoch=receipt.fence_epoch
   AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection
    ON projection.receipt_hash=receipt.receipt_hash
  WHERE receipt.receipt_hash=NEW.original_receipt_hash
    AND receipt.correlation_id=NEW.original_correlation_id
    AND receipt.resource_type=NEW.resource_type
    AND receipt.resource_id=NEW.resource_id
    AND receipt.action=NEW.action
    AND receipt.capability=NEW.capability
    AND receipt.recorded_at=NEW.completed_at
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.subject.accountId')=NEW.actor_account_id
    AND json_extract(receipt.record_json,'$.request.purpose')=NEW.purpose
)
BEGIN
  SELECT RAISE(ABORT,'archive operation requires an exact durable policy receipt');
END;

CREATE TRIGGER trg_platform_policy_archive_operation_update
BEFORE UPDATE ON platform_policy_archive_operations
BEGIN
  SELECT RAISE(ABORT,'archive operation idempotency record is immutable');
END;

CREATE TRIGGER trg_platform_policy_archive_operation_delete
BEFORE DELETE ON platform_policy_archive_operations
BEGIN
  SELECT RAISE(ABORT,'archive operation idempotency record is durable');
END;

CREATE TABLE platform_policy_archive_operation_retries (
  retry_receipt_hash TEXT PRIMARY KEY
    REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
  operation_id TEXT NOT NULL
    REFERENCES platform_policy_archive_operations(operation_id) ON DELETE RESTRICT,
  operation_fingerprint TEXT NOT NULL CHECK(
    length(operation_fingerprint)=64 AND operation_fingerprint NOT GLOB '*[^0-9a-f]*'
  ),
  retry_correlation_id TEXT NOT NULL UNIQUE CHECK(length(trim(retry_correlation_id)) BETWEEN 1 AND 128),
  retried_at TEXT NOT NULL CHECK(
    length(retried_at)=24 AND retried_at GLOB '????-??-??T??:??:??.???Z' AND julianday(retried_at) IS NOT NULL
  )
) STRICT;

CREATE INDEX idx_platform_policy_archive_operation_retry
ON platform_policy_archive_operation_retries(operation_id,retried_at,retry_receipt_hash);

CREATE TRIGGER trg_platform_policy_archive_operation_retry_insert
BEFORE INSERT ON platform_policy_archive_operation_retries
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_archive_operations operation
  JOIN platform_policy_transaction_receipts receipt
    ON receipt.receipt_hash=NEW.retry_receipt_hash
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name
   AND fence.epoch=receipt.fence_epoch
   AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection
    ON projection.receipt_hash=receipt.receipt_hash
  WHERE operation.operation_id=NEW.operation_id
    AND operation.operation_fingerprint=NEW.operation_fingerprint
    AND operation.original_receipt_hash<>NEW.retry_receipt_hash
    AND operation.original_correlation_id<>NEW.retry_correlation_id
    AND receipt.correlation_id=NEW.retry_correlation_id
    AND receipt.resource_type=operation.resource_type
    AND receipt.resource_id=operation.resource_id
    AND receipt.action=operation.action
    AND receipt.capability=operation.capability
    AND receipt.recorded_at=NEW.retried_at
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=operation.family_id
    AND json_extract(receipt.record_json,'$.request.subject.accountId')=operation.actor_account_id
    AND json_extract(receipt.record_json,'$.request.purpose')=operation.purpose
)
BEGIN
  SELECT RAISE(ABORT,'archive operation retry does not match its committed operation and receipt');
END;

CREATE TRIGGER trg_platform_policy_archive_operation_retry_update
BEFORE UPDATE ON platform_policy_archive_operation_retries
BEGIN
  SELECT RAISE(ABORT,'archive operation retry evidence is immutable');
END;

CREATE TRIGGER trg_platform_policy_archive_operation_retry_delete
BEFORE DELETE ON platform_policy_archive_operation_retries
BEGIN
  SELECT RAISE(ABORT,'archive operation retry evidence is durable');
END;

UPDATE database_metadata
SET value='REVISION-30-T-PPK-002-ARCHIVE-OPERATION-IDEMPOTENCY',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const archivePendingOperationIdentityRecoverySql = `CREATE TABLE platform_policy_archive_pending_operations (
  operation_id TEXT PRIMARY KEY CHECK(
    length(operation_id) BETWEEN 1 AND 128
    AND substr(operation_id,1,1) GLOB '[A-Za-z0-9]'
    AND operation_id NOT GLOB '*[^A-Za-z0-9._:-]*'
  ),
  intent_fingerprint TEXT NOT NULL CHECK(
    length(intent_fingerprint)=64 AND intent_fingerprint NOT GLOB '*[^0-9a-f]*'
  ),
  mutation TEXT NOT NULL CHECK(mutation IN (
    'archive:import','archive:open','archive:secureDestroy','archive:createRetentionPolicy',
    'archive:assignRetentionPolicy','archive:createCategory','archive:updateClassification'
  )),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  actor_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL CHECK(purpose='archive'),
  acquired_at TEXT NOT NULL CHECK(
    length(acquired_at)=24 AND acquired_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(acquired_at) IS NOT NULL
  ),
  bound_operation_fingerprint TEXT CHECK(
    bound_operation_fingerprint IS NULL OR (
      length(bound_operation_fingerprint)=64
      AND bound_operation_fingerprint NOT GLOB '*[^0-9a-f]*'
    )
  ),
  acknowledged_at TEXT CHECK(
    acknowledged_at IS NULL OR (
      length(acknowledged_at)=24 AND acknowledged_at GLOB '????-??-??T??:??:??.???Z'
      AND julianday(acknowledged_at) IS NOT NULL
      AND julianday(acknowledged_at)>=julianday(acquired_at)
    )
  ),
  acknowledgement_kind TEXT CHECK(acknowledgement_kind IN ('completed','cancelled')),
  CHECK(
    (acknowledged_at IS NULL AND acknowledgement_kind IS NULL)
    OR (acknowledged_at IS NOT NULL AND acknowledgement_kind IS NOT NULL)
  )
) STRICT;

CREATE UNIQUE INDEX idx_platform_policy_archive_pending_intent
ON platform_policy_archive_pending_operations(
  family_id,actor_account_id,purpose,mutation,intent_fingerprint
)
WHERE acknowledged_at IS NULL;

CREATE INDEX idx_platform_policy_archive_pending_actor
ON platform_policy_archive_pending_operations(
  family_id,actor_account_id,acknowledged_at,acquired_at,operation_id
);

CREATE TRIGGER trg_platform_policy_archive_pending_operation_update
BEFORE UPDATE ON platform_policy_archive_pending_operations
WHEN NOT (
  (
    OLD.operation_id=NEW.operation_id
    AND OLD.intent_fingerprint=NEW.intent_fingerprint
    AND OLD.mutation=NEW.mutation
    AND OLD.family_id=NEW.family_id
    AND OLD.actor_account_id=NEW.actor_account_id
    AND OLD.purpose=NEW.purpose
    AND OLD.acquired_at=NEW.acquired_at
    AND OLD.bound_operation_fingerprint IS NULL
    AND NEW.bound_operation_fingerprint IS NOT NULL
    AND OLD.acknowledged_at IS NULL AND NEW.acknowledged_at IS NULL
    AND OLD.acknowledgement_kind IS NULL AND NEW.acknowledgement_kind IS NULL
  )
  OR
  (
    OLD.operation_id=NEW.operation_id
    AND OLD.intent_fingerprint=NEW.intent_fingerprint
    AND OLD.mutation=NEW.mutation
    AND OLD.family_id=NEW.family_id
    AND OLD.actor_account_id=NEW.actor_account_id
    AND OLD.purpose=NEW.purpose
    AND OLD.acquired_at=NEW.acquired_at
    AND OLD.bound_operation_fingerprint IS NEW.bound_operation_fingerprint
    AND OLD.acknowledged_at IS NULL AND NEW.acknowledged_at IS NOT NULL
    AND OLD.acknowledgement_kind IS NULL
    AND NEW.acknowledgement_kind IN ('completed','cancelled')
  )
)
BEGIN
  SELECT RAISE(ABORT,'archive pending operation permits only one binding and one acknowledgement');
END;

CREATE TRIGGER trg_platform_policy_archive_pending_operation_acknowledgement
BEFORE UPDATE OF acknowledged_at,acknowledgement_kind
ON platform_policy_archive_pending_operations
WHEN (
  NEW.acknowledgement_kind='completed'
  AND (
    NEW.bound_operation_fingerprint IS NULL
    OR NOT EXISTS(
      SELECT 1 FROM platform_policy_archive_operations operation
      WHERE operation.operation_id=NEW.operation_id
        AND operation.operation_fingerprint=NEW.bound_operation_fingerprint
        AND operation.family_id=NEW.family_id
        AND operation.actor_account_id=NEW.actor_account_id
        AND operation.purpose=NEW.purpose
    )
  )
) OR (
  NEW.acknowledgement_kind='cancelled'
  AND (
    NEW.bound_operation_fingerprint IS NOT NULL
    OR EXISTS(
      SELECT 1 FROM platform_policy_archive_operations operation
      WHERE operation.operation_id=NEW.operation_id
    )
  )
)
BEGIN
  SELECT RAISE(ABORT,'archive pending operation acknowledgement does not match its committed outcome');
END;

CREATE TRIGGER trg_platform_policy_archive_pending_operation_delete
BEFORE DELETE ON platform_policy_archive_pending_operations
BEGIN
  SELECT RAISE(ABORT,'archive pending operation recovery evidence is durable');
END;

CREATE TRIGGER trg_platform_policy_archive_operation_pending_binding
BEFORE INSERT ON platform_policy_archive_operations
WHEN EXISTS(
  SELECT 1 FROM platform_policy_archive_pending_operations pending
  WHERE pending.operation_id=NEW.operation_id
) AND NOT EXISTS(
  SELECT 1 FROM platform_policy_archive_pending_operations pending
  WHERE pending.operation_id=NEW.operation_id
    AND pending.family_id=NEW.family_id
    AND pending.actor_account_id=NEW.actor_account_id
    AND pending.purpose=NEW.purpose
    AND pending.bound_operation_fingerprint=NEW.operation_fingerprint
    AND pending.acknowledged_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT,'archive operation does not match its durable pending identity binding');
END;

UPDATE database_metadata
SET value='REVISION-30-U-PPK-002-DURABLE-PENDING-OPERATION-IDENTITY-RECOVERY',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const expiredReplayReservationPruningSql = `CREATE TABLE platform_policy_replay_pruning_state (
  scope TEXT PRIMARY KEY CHECK(scope='archive'),
  cutoff_ms INTEGER NOT NULL CHECK(cutoff_ms>=0),
  updated_at TEXT NOT NULL CHECK(
    length(updated_at)=24 AND updated_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(updated_at) IS NOT NULL
  )
) STRICT;

INSERT INTO platform_policy_replay_pruning_state(scope,cutoff_ms,updated_at)
VALUES('archive',0,'1970-01-01T00:00:00.000Z');

CREATE TRIGGER trg_platform_policy_replay_pruning_state_update
BEFORE UPDATE ON platform_policy_replay_pruning_state
WHEN NEW.scope<>OLD.scope
  OR NEW.cutoff_ms<OLD.cutoff_ms
  OR julianday(NEW.updated_at)<julianday(OLD.updated_at)
BEGIN
  SELECT RAISE(ABORT,'platform policy replay pruning watermark cannot regress');
END;

CREATE TRIGGER trg_platform_policy_replay_pruning_state_delete
BEFORE DELETE ON platform_policy_replay_pruning_state
BEGIN
  SELECT RAISE(ABORT,'platform policy replay pruning watermark is durable');
END;

DROP TRIGGER trg_platform_policy_replay_delete;

CREATE TRIGGER trg_platform_policy_replay_delete
BEFORE DELETE ON platform_policy_replay_reservations
WHEN NOT EXISTS(
    SELECT 1 FROM platform_policy_replay_pruning_state state
    WHERE state.scope='archive'
  )
  OR OLD.expires_at_ms>=COALESCE((
    SELECT state.cutoff_ms FROM platform_policy_replay_pruning_state state
    WHERE state.scope='archive'
  ),-1)
  OR EXISTS(
    SELECT 1 FROM platform_policy_transaction_receipts receipt
    WHERE receipt.nonce=OLD.nonce
  )
BEGIN
  SELECT RAISE(ABORT,'platform policy replay reservation is not expired and unused at the durable cutoff');
END;

UPDATE database_metadata
SET value='REVISION-30-V-PPK-002-EXPIRED-REPLAY-RESERVATION-PRUNING',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const financePolicyReceiptFenceSql = `ALTER TABLE finance_records
ADD COLUMN policy_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
  policy_receipt_hash IS NULL
  OR (length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE finance_records
ADD COLUMN policy_receipt_version INTEGER CHECK(policy_receipt_version IS NULL OR policy_receipt_version=1);
ALTER TABLE finance_records ADD COLUMN policy_receipt_nonce TEXT;
ALTER TABLE finance_records ADD COLUMN policy_correlation_id TEXT;
ALTER TABLE finance_records ADD COLUMN policy_resource_type TEXT;
ALTER TABLE finance_records ADD COLUMN policy_resource_id TEXT;
ALTER TABLE finance_records ADD COLUMN policy_action TEXT;
ALTER TABLE finance_records ADD COLUMN policy_capability TEXT;

ALTER TABLE finance_valuations
ADD COLUMN policy_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
  policy_receipt_hash IS NULL
  OR (length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE finance_valuations
ADD COLUMN policy_receipt_version INTEGER CHECK(policy_receipt_version IS NULL OR policy_receipt_version=1);
ALTER TABLE finance_valuations ADD COLUMN policy_receipt_nonce TEXT;
ALTER TABLE finance_valuations ADD COLUMN policy_correlation_id TEXT;
ALTER TABLE finance_valuations ADD COLUMN policy_resource_type TEXT;
ALTER TABLE finance_valuations ADD COLUMN policy_resource_id TEXT;
ALTER TABLE finance_valuations ADD COLUMN policy_action TEXT;
ALTER TABLE finance_valuations ADD COLUMN policy_capability TEXT;

CREATE UNIQUE INDEX idx_finance_records_policy_receipt
ON finance_records(policy_receipt_hash)
WHERE policy_receipt_hash IS NOT NULL;
CREATE UNIQUE INDEX idx_finance_valuations_policy_receipt
ON finance_valuations(policy_receipt_hash)
WHERE policy_receipt_hash IS NOT NULL;

CREATE TRIGGER trg_platform_policy_finance_record_insert
BEFORE INSERT ON finance_records
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name
   AND fence.epoch=receipt.fence_epoch
   AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection
    ON projection.receipt_hash=receipt.receipt_hash
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='finance_record'
    AND receipt.resource_id=NEW.id
    AND receipt.action='create'
    AND receipt.capability='finance.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.purpose')='finance'
)
BEGIN
  SELECT RAISE(ABORT,'finance record write requires an exact durable policy receipt');
END;

CREATE TRIGGER trg_platform_policy_finance_record_update
BEFORE UPDATE ON finance_records
WHEN NEW.policy_receipt_hash IS OLD.policy_receipt_hash
  OR NOT EXISTS(
    SELECT 1
    FROM platform_policy_transaction_receipts receipt
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash
    WHERE receipt.receipt_hash=NEW.policy_receipt_hash
      AND receipt.receipt_version=NEW.policy_receipt_version
      AND receipt.nonce=NEW.policy_receipt_nonce
      AND receipt.correlation_id=NEW.policy_correlation_id
      AND receipt.resource_type=NEW.policy_resource_type
      AND receipt.resource_id=NEW.policy_resource_id
      AND receipt.action=NEW.policy_action
      AND receipt.capability=NEW.policy_capability
      AND receipt.resource_type='finance_record'
      AND receipt.resource_id=NEW.id
      AND receipt.action='update'
      AND receipt.capability='finance.write'
      AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
      AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
      AND json_extract(receipt.record_json,'$.request.purpose')='finance'
  )
BEGIN
  SELECT RAISE(ABORT,'finance record update requires a fresh exact durable policy receipt');
END;

CREATE TRIGGER trg_platform_policy_finance_record_delete
BEFORE DELETE ON finance_records
BEGIN
  SELECT RAISE(ABORT,'finance record deletion requires a governed deletion workflow');
END;

CREATE TRIGGER trg_platform_policy_finance_valuation_insert
BEFORE INSERT ON finance_valuations
WHEN NOT EXISTS(
  SELECT 1
  FROM finance_records record
  JOIN platform_policy_transaction_receipts receipt
    ON receipt.receipt_hash=NEW.policy_receipt_hash
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name
   AND fence.epoch=receipt.fence_epoch
   AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection
    ON projection.receipt_hash=receipt.receipt_hash
  WHERE record.id=NEW.finance_record_id
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='finance_record'
    AND receipt.resource_id=NEW.finance_record_id
    AND receipt.action='update'
    AND receipt.capability='finance.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=record.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=record.owner_person_id
    AND json_extract(receipt.record_json,'$.request.purpose')='finance'
)
BEGIN
  SELECT RAISE(ABORT,'finance valuation write requires an exact durable policy receipt');
END;

CREATE TRIGGER trg_platform_policy_finance_valuation_update
BEFORE UPDATE ON finance_valuations
WHEN NEW.policy_receipt_hash IS OLD.policy_receipt_hash
  OR NOT EXISTS(
    SELECT 1
    FROM finance_records record
    JOIN platform_policy_transaction_receipts receipt
      ON receipt.receipt_hash=NEW.policy_receipt_hash
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash
    WHERE record.id=NEW.finance_record_id
      AND receipt.receipt_version=NEW.policy_receipt_version
      AND receipt.nonce=NEW.policy_receipt_nonce
      AND receipt.correlation_id=NEW.policy_correlation_id
      AND receipt.resource_type=NEW.policy_resource_type
      AND receipt.resource_id=NEW.policy_resource_id
      AND receipt.action=NEW.policy_action
      AND receipt.capability=NEW.policy_capability
      AND receipt.resource_type='finance_record'
      AND receipt.resource_id=NEW.finance_record_id
      AND receipt.action='update'
      AND receipt.capability='finance.write'
      AND json_extract(receipt.record_json,'$.request.resource.familyId')=record.family_id
      AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=record.owner_person_id
      AND json_extract(receipt.record_json,'$.request.purpose')='finance'
  )
BEGIN
  SELECT RAISE(ABORT,'finance valuation update requires a fresh exact durable policy receipt');
END;

CREATE TRIGGER trg_platform_policy_finance_valuation_delete
BEFORE DELETE ON finance_valuations
BEGIN
  SELECT RAISE(ABORT,'finance valuation deletion requires a governed deletion workflow');
END;

UPDATE database_metadata
SET value='REVISION-30-W-PPK-002-FINANCE-POLICY-RECEIPT-FENCE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const healthPolicyReceiptFenceSql = `ALTER TABLE health_records
ADD COLUMN policy_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
  policy_receipt_hash IS NULL
  OR (length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE health_records
ADD COLUMN policy_receipt_version INTEGER CHECK(policy_receipt_version IS NULL OR policy_receipt_version=1);
ALTER TABLE health_records ADD COLUMN policy_receipt_nonce TEXT;
ALTER TABLE health_records ADD COLUMN policy_correlation_id TEXT;
ALTER TABLE health_records ADD COLUMN policy_resource_type TEXT;
ALTER TABLE health_records ADD COLUMN policy_resource_id TEXT;
ALTER TABLE health_records ADD COLUMN policy_action TEXT;
ALTER TABLE health_records ADD COLUMN policy_capability TEXT;

ALTER TABLE medication_plans
ADD COLUMN policy_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
  policy_receipt_hash IS NULL
  OR (length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE medication_plans
ADD COLUMN policy_receipt_version INTEGER CHECK(policy_receipt_version IS NULL OR policy_receipt_version=1);
ALTER TABLE medication_plans ADD COLUMN policy_receipt_nonce TEXT;
ALTER TABLE medication_plans ADD COLUMN policy_correlation_id TEXT;
ALTER TABLE medication_plans ADD COLUMN policy_resource_type TEXT;
ALTER TABLE medication_plans ADD COLUMN policy_resource_id TEXT;
ALTER TABLE medication_plans ADD COLUMN policy_action TEXT;
ALTER TABLE medication_plans ADD COLUMN policy_capability TEXT;

ALTER TABLE family_health_history
ADD COLUMN policy_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
  policy_receipt_hash IS NULL
  OR (length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE family_health_history
ADD COLUMN policy_receipt_version INTEGER CHECK(policy_receipt_version IS NULL OR policy_receipt_version=1);
ALTER TABLE family_health_history ADD COLUMN policy_receipt_nonce TEXT;
ALTER TABLE family_health_history ADD COLUMN policy_correlation_id TEXT;
ALTER TABLE family_health_history ADD COLUMN policy_resource_type TEXT;
ALTER TABLE family_health_history ADD COLUMN policy_resource_id TEXT;
ALTER TABLE family_health_history ADD COLUMN policy_action TEXT;
ALTER TABLE family_health_history ADD COLUMN policy_capability TEXT;

CREATE UNIQUE INDEX idx_health_records_policy_receipt
ON health_records(policy_receipt_hash)
WHERE policy_receipt_hash IS NOT NULL;
CREATE UNIQUE INDEX idx_medication_plans_policy_receipt
ON medication_plans(policy_receipt_hash)
WHERE policy_receipt_hash IS NOT NULL;
CREATE UNIQUE INDEX idx_family_health_history_policy_receipt
ON family_health_history(policy_receipt_hash)
WHERE policy_receipt_hash IS NOT NULL;

CREATE TRIGGER trg_platform_policy_health_record_insert
BEFORE INSERT ON health_records
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name
   AND fence.epoch=receipt.fence_epoch
   AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection
    ON projection.receipt_hash=receipt.receipt_hash
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='health_record'
    AND receipt.resource_id=NEW.id
    AND receipt.action='create'
    AND receipt.capability='health.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE NEW.privacy
      WHEN 'private' THEN 'highly_sensitive'
      WHEN 'selected_members' THEN 'sensitive'
      WHEN 'family' THEN 'personal'
    END
    AND json_extract(receipt.record_json,'$.request.purpose')='health'
)
BEGIN
  SELECT RAISE(ABORT,'health record write requires an exact durable policy receipt');
END;

CREATE TRIGGER trg_platform_policy_health_record_update
BEFORE UPDATE ON health_records
WHEN NEW.policy_receipt_hash IS OLD.policy_receipt_hash
  OR NOT EXISTS(
    SELECT 1
    FROM platform_policy_transaction_receipts receipt
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash
    WHERE receipt.receipt_hash=NEW.policy_receipt_hash
      AND receipt.receipt_version=NEW.policy_receipt_version
      AND receipt.nonce=NEW.policy_receipt_nonce
      AND receipt.correlation_id=NEW.policy_correlation_id
      AND receipt.resource_type=NEW.policy_resource_type
      AND receipt.resource_id=NEW.policy_resource_id
      AND receipt.action=NEW.policy_action
      AND receipt.capability=NEW.policy_capability
      AND receipt.resource_type='health_record'
      AND receipt.resource_id=NEW.id
      AND receipt.action='update'
      AND receipt.capability='health.write'
      AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
      AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
      AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE NEW.privacy
        WHEN 'private' THEN 'highly_sensitive'
        WHEN 'selected_members' THEN 'sensitive'
        WHEN 'family' THEN 'personal'
      END
      AND json_extract(receipt.record_json,'$.request.purpose')='health'
  )
BEGIN
  SELECT RAISE(ABORT,'health record update requires a fresh exact durable policy receipt');
END;

CREATE TRIGGER trg_platform_policy_health_record_delete
BEFORE DELETE ON health_records
BEGIN
  SELECT RAISE(ABORT,'health record deletion requires a governed deletion workflow');
END;

CREATE TRIGGER trg_platform_policy_medication_plan_insert
BEFORE INSERT ON medication_plans
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name
   AND fence.epoch=receipt.fence_epoch
   AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection
    ON projection.receipt_hash=receipt.receipt_hash
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='medication_plan'
    AND receipt.resource_id=NEW.id
    AND receipt.action='create'
    AND receipt.capability='health.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE NEW.privacy
      WHEN 'private' THEN 'highly_sensitive'
      WHEN 'selected_members' THEN 'sensitive'
      WHEN 'family' THEN 'personal'
    END
    AND json_extract(receipt.record_json,'$.request.purpose')='health'
)
BEGIN
  SELECT RAISE(ABORT,'medication plan write requires an exact durable policy receipt');
END;

CREATE TRIGGER trg_platform_policy_medication_plan_update
BEFORE UPDATE ON medication_plans
WHEN NEW.policy_receipt_hash IS OLD.policy_receipt_hash
  OR NOT EXISTS(
    SELECT 1
    FROM platform_policy_transaction_receipts receipt
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash
    WHERE receipt.receipt_hash=NEW.policy_receipt_hash
      AND receipt.receipt_version=NEW.policy_receipt_version
      AND receipt.nonce=NEW.policy_receipt_nonce
      AND receipt.correlation_id=NEW.policy_correlation_id
      AND receipt.resource_type=NEW.policy_resource_type
      AND receipt.resource_id=NEW.policy_resource_id
      AND receipt.action=NEW.policy_action
      AND receipt.capability=NEW.policy_capability
      AND receipt.resource_type='medication_plan'
      AND receipt.resource_id=NEW.id
      AND receipt.action='update'
      AND receipt.capability='health.write'
      AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
      AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
      AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE NEW.privacy
        WHEN 'private' THEN 'highly_sensitive'
        WHEN 'selected_members' THEN 'sensitive'
        WHEN 'family' THEN 'personal'
      END
      AND json_extract(receipt.record_json,'$.request.purpose')='health'
  )
BEGIN
  SELECT RAISE(ABORT,'medication plan update requires a fresh exact durable policy receipt');
END;

CREATE TRIGGER trg_platform_policy_medication_plan_delete
BEFORE DELETE ON medication_plans
BEGIN
  SELECT RAISE(ABORT,'medication plan deletion requires a governed deletion workflow');
END;

CREATE TRIGGER trg_platform_policy_family_health_history_insert
BEFORE INSERT ON family_health_history
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name
   AND fence.epoch=receipt.fence_epoch
   AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection
    ON projection.receipt_hash=receipt.receipt_hash
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='family_health_history'
    AND receipt.resource_id=NEW.id
    AND receipt.action='create'
    AND receipt.capability='health.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.related_person_id
    AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE NEW.privacy
      WHEN 'private' THEN 'highly_sensitive'
      WHEN 'selected_members' THEN 'sensitive'
      WHEN 'family' THEN 'personal'
    END
    AND json_extract(receipt.record_json,'$.request.purpose')='health'
)
BEGIN
  SELECT RAISE(ABORT,'family health history write requires an exact durable policy receipt');
END;

CREATE TRIGGER trg_platform_policy_family_health_history_update
BEFORE UPDATE ON family_health_history
WHEN NEW.policy_receipt_hash IS OLD.policy_receipt_hash
  OR NOT EXISTS(
    SELECT 1
    FROM platform_policy_transaction_receipts receipt
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash
    WHERE receipt.receipt_hash=NEW.policy_receipt_hash
      AND receipt.receipt_version=NEW.policy_receipt_version
      AND receipt.nonce=NEW.policy_receipt_nonce
      AND receipt.correlation_id=NEW.policy_correlation_id
      AND receipt.resource_type=NEW.policy_resource_type
      AND receipt.resource_id=NEW.policy_resource_id
      AND receipt.action=NEW.policy_action
      AND receipt.capability=NEW.policy_capability
      AND receipt.resource_type='family_health_history'
      AND receipt.resource_id=NEW.id
      AND receipt.action='update'
      AND receipt.capability='health.write'
      AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
      AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.related_person_id
      AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE NEW.privacy
        WHEN 'private' THEN 'highly_sensitive'
        WHEN 'selected_members' THEN 'sensitive'
        WHEN 'family' THEN 'personal'
      END
      AND json_extract(receipt.record_json,'$.request.purpose')='health'
  )
BEGIN
  SELECT RAISE(ABORT,'family health history update requires a fresh exact durable policy receipt');
END;

CREATE TRIGGER trg_platform_policy_family_health_history_delete
BEFORE DELETE ON family_health_history
BEGIN
  SELECT RAISE(ABORT,'family health history deletion requires a governed deletion workflow');
END;

UPDATE database_metadata
SET value='REVISION-30-X-PPK-002-HEALTH-POLICY-RECEIPT-FENCE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const lifePolicyReceiptFenceSql = `ALTER TABLE life_records
ADD COLUMN policy_receipt_hash TEXT CHECK(
  policy_receipt_hash IS NULL OR
  (length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE life_records
ADD COLUMN policy_receipt_version INTEGER CHECK(policy_receipt_version IS NULL OR policy_receipt_version=1);
ALTER TABLE life_records ADD COLUMN policy_receipt_nonce TEXT;
ALTER TABLE life_records ADD COLUMN policy_correlation_id TEXT;
ALTER TABLE life_records ADD COLUMN policy_resource_type TEXT;
ALTER TABLE life_records ADD COLUMN policy_resource_id TEXT;
ALTER TABLE life_records ADD COLUMN policy_action TEXT;
ALTER TABLE life_records ADD COLUMN policy_capability TEXT;

CREATE UNIQUE INDEX idx_life_records_policy_receipt
ON life_records(policy_receipt_hash)
WHERE policy_receipt_hash IS NOT NULL;

CREATE TRIGGER trg_platform_policy_life_record_insert
BEFORE INSERT ON life_records
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name
   AND fence.epoch=receipt.fence_epoch
   AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection
    ON projection.receipt_hash=receipt.receipt_hash
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='life_record'
    AND receipt.resource_id=NEW.id
    AND receipt.action='create'
    AND receipt.capability='family.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE NEW.privacy
      WHEN 'private' THEN 'highly_sensitive'
      WHEN 'selected_members' THEN 'sensitive'
      WHEN 'family' THEN 'personal'
    END
    AND json_extract(receipt.record_json,'$.request.purpose')='general'
)
BEGIN
  SELECT RAISE(ABORT,'life record write requires an exact durable policy receipt');
END;

CREATE TRIGGER trg_platform_policy_life_record_update
BEFORE UPDATE ON life_records
WHEN NEW.policy_receipt_hash IS OLD.policy_receipt_hash
  OR NOT EXISTS(
    SELECT 1
    FROM platform_policy_transaction_receipts receipt
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name
     AND fence.epoch=receipt.fence_epoch
     AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash
    WHERE receipt.receipt_hash=NEW.policy_receipt_hash
      AND receipt.receipt_version=NEW.policy_receipt_version
      AND receipt.nonce=NEW.policy_receipt_nonce
      AND receipt.correlation_id=NEW.policy_correlation_id
      AND receipt.resource_type=NEW.policy_resource_type
      AND receipt.resource_id=NEW.policy_resource_id
      AND receipt.action=NEW.policy_action
      AND receipt.capability=NEW.policy_capability
      AND receipt.resource_type='life_record'
      AND receipt.resource_id=NEW.id
      AND receipt.action='update'
      AND receipt.capability='family.write'
      AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
      AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
      AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE NEW.privacy
        WHEN 'private' THEN 'highly_sensitive'
        WHEN 'selected_members' THEN 'sensitive'
        WHEN 'family' THEN 'personal'
      END
      AND json_extract(receipt.record_json,'$.request.purpose')='general'
  )
BEGIN
  SELECT RAISE(ABORT,'life record update requires a fresh exact durable policy receipt');
END;

CREATE TRIGGER trg_platform_policy_life_record_delete
BEFORE DELETE ON life_records
BEGIN
  SELECT RAISE(ABORT,'GOVERNED_DELETION_WORKFLOW_REQUIRED');
END;

UPDATE database_metadata
SET value='REVISION-30-Y-PPK-002-LIFE-POLICY-RECEIPT-FENCE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const locationPolicyReceiptFenceSql = `ALTER TABLE locations
ADD COLUMN owner_person_id TEXT REFERENCES people(id) ON DELETE RESTRICT;
ALTER TABLE locations
ADD COLUMN policy_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
  policy_receipt_hash IS NULL OR
  (length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE locations
ADD COLUMN policy_receipt_version INTEGER CHECK(policy_receipt_version IS NULL OR policy_receipt_version=1);
ALTER TABLE locations ADD COLUMN policy_receipt_nonce TEXT;
ALTER TABLE locations ADD COLUMN policy_correlation_id TEXT;
ALTER TABLE locations ADD COLUMN policy_resource_type TEXT;
ALTER TABLE locations ADD COLUMN policy_resource_id TEXT;
ALTER TABLE locations ADD COLUMN policy_action TEXT;
ALTER TABLE locations ADD COLUMN policy_capability TEXT;

CREATE INDEX idx_locations_family_owner_label
ON locations(family_id,owner_person_id,label COLLATE NOCASE,id);
CREATE UNIQUE INDEX idx_locations_policy_receipt
ON locations(policy_receipt_hash)
WHERE policy_receipt_hash IS NOT NULL;

CREATE TRIGGER trg_platform_policy_location_insert
BEFORE INSERT ON locations
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name
   AND fence.epoch=receipt.fence_epoch
   AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection
    ON projection.receipt_hash=receipt.receipt_hash
   AND projection.record_json=receipt.record_json
  JOIN accounts actor
    ON actor.id=json_extract(receipt.record_json,'$.request.subject.accountId')
   AND actor.person_id=NEW.owner_person_id
   AND actor.status='active'
  JOIN people owner
    ON owner.id=NEW.owner_person_id
   AND owner.family_id=NEW.family_id
   AND owner.status='active'
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='location'
    AND receipt.resource_id=NEW.id
    AND receipt.action='create'
    AND receipt.capability='family.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.subject.personId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.resource.sensitivity')='highly_sensitive'
    AND json_extract(receipt.record_json,'$.request.purpose')='general'
)
BEGIN
  SELECT RAISE(ABORT,'location write requires an exact durable policy receipt');
END;

CREATE TRIGGER trg_platform_policy_location_update
BEFORE UPDATE ON locations
BEGIN
  SELECT RAISE(ABORT,'GOVERNED_UPDATE_WORKFLOW_REQUIRED');
END;

CREATE TRIGGER trg_platform_policy_location_delete
BEFORE DELETE ON locations
WHEN OLD.policy_receipt_hash IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'GOVERNED_DELETION_WORKFLOW_REQUIRED');
END;

UPDATE database_metadata
SET value='REVISION-30-Z-PPK-002-LOCATION-POLICY-RECEIPT-FENCE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const timelineEventPolicyReceiptFenceSql = `ALTER TABLE events
ADD COLUMN owner_person_id TEXT REFERENCES people(id) ON DELETE RESTRICT;
ALTER TABLE events
ADD COLUMN timeline_policy_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
  timeline_policy_receipt_hash IS NULL OR
  (length(timeline_policy_receipt_hash)=64 AND timeline_policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);
ALTER TABLE events ADD COLUMN timeline_policy_receipt_version INTEGER CHECK(timeline_policy_receipt_version IS NULL OR timeline_policy_receipt_version=1);
ALTER TABLE events ADD COLUMN timeline_policy_receipt_nonce TEXT;
ALTER TABLE events ADD COLUMN timeline_policy_correlation_id TEXT;
ALTER TABLE events ADD COLUMN timeline_policy_resource_type TEXT;
ALTER TABLE events ADD COLUMN timeline_policy_resource_id TEXT;
ALTER TABLE events ADD COLUMN timeline_policy_action TEXT;
ALTER TABLE events ADD COLUMN timeline_policy_capability TEXT;
ALTER TABLE events
ADD COLUMN source_location_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
  source_location_receipt_hash IS NULL OR
  (length(source_location_receipt_hash)=64 AND source_location_receipt_hash NOT GLOB '*[^0-9a-f]*')
);

CREATE UNIQUE INDEX idx_events_timeline_policy_receipt
ON events(timeline_policy_receipt_hash) WHERE timeline_policy_receipt_hash IS NOT NULL;
CREATE INDEX idx_events_family_owner_visibility
ON events(family_id,owner_person_id,visibility,archived_at,start_at DESC,id);

CREATE VIEW governed_timeline_events AS
SELECT event.*
FROM events event
JOIN platform_policy_transaction_receipts receipt
  ON receipt.receipt_hash=event.timeline_policy_receipt_hash
 AND receipt.receipt_version=event.timeline_policy_receipt_version
 AND receipt.nonce=event.timeline_policy_receipt_nonce
 AND receipt.correlation_id=event.timeline_policy_correlation_id
 AND receipt.resource_type=event.timeline_policy_resource_type
 AND receipt.resource_id=event.timeline_policy_resource_id
 AND receipt.action=event.timeline_policy_action
 AND receipt.capability=event.timeline_policy_capability
JOIN platform_policy_database_fences fence
  ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
JOIN platform_policy_journal_projection_outbox projection
  ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
JOIN people owner
  ON owner.id=event.owner_person_id AND owner.family_id=event.family_id AND owner.status='active'
WHERE receipt.fence_name='timeline-event-write'
  AND receipt.resource_type='event'
  AND receipt.resource_id=event.id
  AND receipt.action IN ('create','update')
  AND receipt.capability='family.write'
  AND json_extract(receipt.record_json,'$.request.resource.familyId')=event.family_id
  AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=event.owner_person_id
  AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE event.visibility
    WHEN 'personal' THEN 'highly_sensitive'
    WHEN 'selected_members' THEN 'sensitive'
    WHEN 'family' THEN 'personal'
  END
  AND json_extract(receipt.record_json,'$.request.purpose')='general'
  AND (
    (event.location_id IS NULL AND event.source_location_receipt_hash IS NULL
      AND json_type(receipt.record_json,'$.request.resource.sourceResourceId') IS NULL)
    OR (
      event.location_id IS NOT NULL
      AND json_extract(receipt.record_json,'$.request.resource.sourceResourceId')=event.location_id
      AND EXISTS(
        SELECT 1 FROM platform_policy_transaction_receipts source_receipt
        JOIN platform_policy_database_fences source_fence
          ON source_fence.fence_name=source_receipt.fence_name
         AND source_fence.epoch=source_receipt.fence_epoch AND source_fence.writable=1
        JOIN platform_policy_journal_projection_outbox source_projection
          ON source_projection.receipt_hash=source_receipt.receipt_hash
         AND source_projection.record_json=source_receipt.record_json
        WHERE source_receipt.receipt_hash=event.source_location_receipt_hash
          AND source_receipt.fence_name='location-write'
          AND source_receipt.resource_type='location'
          AND source_receipt.resource_id=event.location_id
          AND source_receipt.action='read'
          AND source_receipt.capability='location.read'
          AND json_extract(source_receipt.record_json,'$.request.resource.familyId')=event.family_id
          AND json_extract(source_receipt.record_json,'$.request.resource.sensitivity')='highly_sensitive'
          AND json_extract(source_receipt.record_json,'$.request.purpose')='general'
      )
    )
  )
  AND NOT EXISTS(
    SELECT 1 FROM data_lifecycle lifecycle
    WHERE lifecycle.resource_type IN ('event','timeline_event')
      AND lifecycle.resource_id=event.id AND lifecycle.state<>'active'
  );

CREATE TRIGGER trg_timeline_event_policy_insert
BEFORE INSERT ON events
WHEN COALESCE(NEW.owner_person_id,'')<>''
  OR COALESCE(NEW.timeline_policy_receipt_hash,'')<>''
  OR COALESCE(NEW.source_location_receipt_hash,'')<>''
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM platform_policy_transaction_receipts receipt
    JOIN platform_policy_database_fences fence
      ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
    JOIN platform_policy_journal_projection_outbox projection
      ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
    JOIN accounts actor
      ON actor.id=json_extract(receipt.record_json,'$.request.subject.accountId')
     AND actor.person_id=NEW.owner_person_id AND actor.status='active'
    JOIN people owner
      ON owner.id=NEW.owner_person_id AND owner.family_id=NEW.family_id AND owner.status='active'
    WHERE receipt.receipt_hash=NEW.timeline_policy_receipt_hash
      AND receipt.receipt_version=NEW.timeline_policy_receipt_version
      AND receipt.nonce=NEW.timeline_policy_receipt_nonce
      AND receipt.correlation_id=NEW.timeline_policy_correlation_id
      AND receipt.resource_type=NEW.timeline_policy_resource_type
      AND receipt.resource_id=NEW.timeline_policy_resource_id
      AND receipt.action=NEW.timeline_policy_action
      AND receipt.capability=NEW.timeline_policy_capability
      AND receipt.fence_name='timeline-event-write'
      AND receipt.resource_type='event' AND receipt.resource_id=NEW.id
      AND receipt.action='create' AND receipt.capability='family.write'
      AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
      AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
      AND json_extract(receipt.record_json,'$.request.subject.personId')=NEW.owner_person_id
      AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE NEW.visibility
        WHEN 'personal' THEN 'highly_sensitive'
        WHEN 'selected_members' THEN 'sensitive'
        WHEN 'family' THEN 'personal'
      END
      AND json_extract(receipt.record_json,'$.request.purpose')='general'
      AND (
        (NEW.location_id IS NULL AND NEW.source_location_receipt_hash IS NULL
          AND json_type(receipt.record_json,'$.request.resource.sourceResourceId') IS NULL)
        OR (
          NEW.location_id IS NOT NULL
          AND json_extract(receipt.record_json,'$.request.resource.sourceResourceId')=NEW.location_id
          AND EXISTS(
            SELECT 1 FROM platform_policy_transaction_receipts source_receipt
            JOIN platform_policy_database_fences source_fence
              ON source_fence.fence_name=source_receipt.fence_name
             AND source_fence.epoch=source_receipt.fence_epoch AND source_fence.writable=1
            JOIN platform_policy_journal_projection_outbox source_projection
              ON source_projection.receipt_hash=source_receipt.receipt_hash
             AND source_projection.record_json=source_receipt.record_json
            WHERE source_receipt.receipt_hash=NEW.source_location_receipt_hash
              AND source_receipt.fence_name='location-write'
              AND source_receipt.resource_type='location'
              AND source_receipt.resource_id=NEW.location_id
              AND source_receipt.action='read' AND source_receipt.capability='location.read'
              AND json_extract(source_receipt.record_json,'$.request.resource.familyId')=NEW.family_id
              AND json_extract(source_receipt.record_json,'$.request.subject.accountId')=json_extract(receipt.record_json,'$.request.subject.accountId')
              AND json_extract(source_receipt.record_json,'$.request.resource.sensitivity')='highly_sensitive'
              AND json_extract(source_receipt.record_json,'$.request.purpose')='general'
          )
        )
      )
  ) THEN RAISE(ABORT,'timeline event insert requires an exact durable event policy receipt') END;
END;

CREATE TRIGGER trg_timeline_event_policy_update
BEFORE UPDATE OF kind,title,description,start_at,location_id,location_label,visibility,
  participant_person_ids,invitation_text,notes,ai_processing_allowed,recurrence,
  reminder_days,updated_at,archived_at ON events
WHEN COALESCE(OLD.timeline_policy_receipt_hash,'')<>''
  OR COALESCE(NEW.owner_person_id,'')<>''
  OR COALESCE(NEW.timeline_policy_receipt_hash,'')<>''
BEGIN
  SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.family_id IS NOT OLD.family_id
    OR NEW.owner_person_id IS NOT OLD.owner_person_id
    THEN RAISE(ABORT,'timeline event identity and owner are immutable') END;
  SELECT CASE WHEN NEW.timeline_policy_receipt_hash IS OLD.timeline_policy_receipt_hash
    OR NOT EXISTS(
      SELECT 1 FROM platform_policy_transaction_receipts receipt
      JOIN platform_policy_database_fences fence
        ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
      JOIN platform_policy_journal_projection_outbox projection
        ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
      JOIN people owner
        ON owner.id=NEW.owner_person_id AND owner.family_id=NEW.family_id AND owner.status='active'
      WHERE receipt.receipt_hash=NEW.timeline_policy_receipt_hash
        AND receipt.receipt_version=NEW.timeline_policy_receipt_version
        AND receipt.nonce=NEW.timeline_policy_receipt_nonce
        AND receipt.correlation_id=NEW.timeline_policy_correlation_id
        AND receipt.resource_type=NEW.timeline_policy_resource_type
        AND receipt.resource_id=NEW.timeline_policy_resource_id
        AND receipt.action=NEW.timeline_policy_action
        AND receipt.capability=NEW.timeline_policy_capability
        AND receipt.fence_name='timeline-event-write'
        AND receipt.resource_type='event' AND receipt.resource_id=NEW.id
        AND receipt.action='update' AND receipt.capability='family.write'
        AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
        AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
        AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE NEW.visibility
          WHEN 'personal' THEN 'highly_sensitive'
          WHEN 'selected_members' THEN 'sensitive'
          WHEN 'family' THEN 'personal'
        END
        AND json_extract(receipt.record_json,'$.request.purpose')='general'
        AND (
          (NEW.location_id IS NULL AND NEW.source_location_receipt_hash IS NULL
            AND json_type(receipt.record_json,'$.request.resource.sourceResourceId') IS NULL)
          OR (
            NEW.location_id IS NOT NULL
            AND json_extract(receipt.record_json,'$.request.resource.sourceResourceId')=NEW.location_id
            AND EXISTS(
              SELECT 1 FROM platform_policy_transaction_receipts source_receipt
              JOIN platform_policy_database_fences source_fence
                ON source_fence.fence_name=source_receipt.fence_name
               AND source_fence.epoch=source_receipt.fence_epoch AND source_fence.writable=1
              JOIN platform_policy_journal_projection_outbox source_projection
                ON source_projection.receipt_hash=source_receipt.receipt_hash
               AND source_projection.record_json=source_receipt.record_json
              WHERE source_receipt.receipt_hash=NEW.source_location_receipt_hash
                AND source_receipt.fence_name='location-write'
                AND source_receipt.resource_type='location'
                AND source_receipt.resource_id=NEW.location_id
                AND source_receipt.action='read' AND source_receipt.capability='location.read'
                AND json_extract(source_receipt.record_json,'$.request.resource.familyId')=NEW.family_id
                AND json_extract(source_receipt.record_json,'$.request.resource.sensitivity')='highly_sensitive'
                AND json_extract(source_receipt.record_json,'$.request.purpose')='general'
                AND (
                  (NEW.location_id IS OLD.location_id AND NEW.source_location_receipt_hash IS OLD.source_location_receipt_hash)
                  OR (
                    NEW.source_location_receipt_hash IS NOT OLD.source_location_receipt_hash
                    AND json_extract(source_receipt.record_json,'$.request.subject.accountId')=json_extract(receipt.record_json,'$.request.subject.accountId')
                  )
                )
            )
          )
        )
    ) THEN RAISE(ABORT,'timeline event update requires a fresh exact durable event policy receipt') END;
END;

CREATE TRIGGER trg_timeline_event_policy_delete
BEFORE DELETE ON events
WHEN OLD.timeline_policy_receipt_hash IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'GOVERNED_TIMELINE_EVENT_DELETION_WORKFLOW_REQUIRED');
END;

UPDATE database_metadata
SET value='REVISION-LOCAL-PPK-002-TIMELINE-EVENT-POLICY-RECEIPT-FENCE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const familyImportGovernedRollbackReceiptFenceSql = `ALTER TABLE family_data_import_items
ADD COLUMN create_policy_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
  create_policy_receipt_hash IS NULL OR
  (length(create_policy_receipt_hash)=64 AND create_policy_receipt_hash NOT GLOB '*[^0-9a-f]*')
);

UPDATE family_data_import_items
SET create_policy_receipt_hash=CASE entity_type
  WHEN 'event' THEN (SELECT event.timeline_policy_receipt_hash FROM events event WHERE event.id=family_data_import_items.entity_id)
  WHEN 'location' THEN (SELECT location.policy_receipt_hash FROM locations location WHERE location.id=family_data_import_items.entity_id)
  ELSE NULL
END
WHERE resolution='created' AND entity_type IN ('event','location');

CREATE TRIGGER trg_family_import_item_capture_create_receipt
AFTER INSERT ON family_data_import_items
WHEN NEW.resolution='created' AND NEW.entity_type IN ('event','location')
BEGIN
  UPDATE family_data_import_items
  SET create_policy_receipt_hash=CASE NEW.entity_type
    WHEN 'event' THEN (SELECT event.timeline_policy_receipt_hash FROM events event WHERE event.id=NEW.entity_id)
    WHEN 'location' THEN (SELECT location.policy_receipt_hash FROM locations location WHERE location.id=NEW.entity_id)
    ELSE NULL
  END
  WHERE batch_id=NEW.batch_id AND entity_type=NEW.entity_type AND source_id=NEW.source_id;
END;

CREATE TRIGGER trg_family_import_item_create_receipt_immutable
BEFORE UPDATE OF create_policy_receipt_hash ON family_data_import_items
WHEN OLD.create_policy_receipt_hash IS NOT NULL
  OR NEW.create_policy_receipt_hash IS NULL
  OR (
    NEW.entity_type='event'
    AND NEW.create_policy_receipt_hash IS NOT (SELECT event.timeline_policy_receipt_hash FROM events event WHERE event.id=NEW.entity_id)
  )
  OR (
    NEW.entity_type='location'
    AND NEW.create_policy_receipt_hash IS NOT (SELECT location.policy_receipt_hash FROM locations location WHERE location.id=NEW.entity_id)
  )
BEGIN
  SELECT RAISE(ABORT,'family import create receipt provenance is immutable');
END;

CREATE TABLE family_data_import_rollback_deletions (
  batch_id TEXT NOT NULL REFERENCES family_data_import_batches(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('event','location')),
  entity_id TEXT NOT NULL,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  create_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
    length(create_receipt_hash)=64 AND create_receipt_hash NOT GLOB '*[^0-9a-f]*'
  ),
  delete_receipt_hash TEXT NOT NULL UNIQUE REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
    length(delete_receipt_hash)=64 AND delete_receipt_hash NOT GLOB '*[^0-9a-f]*'
  ),
  delete_receipt_version INTEGER NOT NULL CHECK(delete_receipt_version=1),
  delete_receipt_nonce TEXT NOT NULL,
  delete_correlation_id TEXT NOT NULL,
  delete_resource_type TEXT NOT NULL,
  delete_resource_id TEXT NOT NULL,
  delete_action TEXT NOT NULL CHECK(delete_action='delete'),
  delete_capability TEXT NOT NULL CHECK(delete_capability='family.write'),
  authorized_at TEXT NOT NULL,
  consumed_at TEXT,
  PRIMARY KEY(entity_type,entity_id)
);
CREATE INDEX idx_family_import_rollback_deletions_batch
ON family_data_import_rollback_deletions(batch_id,consumed_at,entity_type,entity_id);

CREATE TRIGGER trg_family_import_rollback_event_authorize
BEFORE INSERT ON family_data_import_rollback_deletions
WHEN NEW.entity_type='event'
BEGIN
  SELECT CASE WHEN NEW.consumed_at IS NOT NULL OR NOT EXISTS(
    SELECT 1
    FROM family_data_import_batches batch
    JOIN family_data_import_items item
      ON item.batch_id=batch.id
     AND item.entity_type='event'
     AND item.entity_id=NEW.entity_id
     AND item.resolution='created'
     AND item.create_policy_receipt_hash=NEW.create_receipt_hash
    JOIN events event
      ON event.id=item.entity_id
     AND event.family_id=NEW.family_id
     AND event.owner_person_id=NEW.owner_person_id
     AND event.timeline_policy_receipt_hash=NEW.create_receipt_hash
    JOIN platform_policy_transaction_receipts create_receipt
      ON create_receipt.receipt_hash=NEW.create_receipt_hash
     AND create_receipt.resource_type='event'
     AND create_receipt.resource_id=event.id
     AND create_receipt.action='create'
     AND create_receipt.capability='family.write'
    JOIN platform_policy_database_fences create_fence
      ON create_fence.fence_name=create_receipt.fence_name
     AND create_fence.epoch=create_receipt.fence_epoch
     AND create_fence.writable=1
    JOIN platform_policy_journal_projection_outbox create_projection
      ON create_projection.receipt_hash=create_receipt.receipt_hash
     AND create_projection.record_json=create_receipt.record_json
    JOIN platform_policy_transaction_receipts delete_receipt
      ON delete_receipt.receipt_hash=NEW.delete_receipt_hash
     AND delete_receipt.receipt_version=NEW.delete_receipt_version
     AND delete_receipt.nonce=NEW.delete_receipt_nonce
     AND delete_receipt.correlation_id=NEW.delete_correlation_id
     AND delete_receipt.resource_type=NEW.delete_resource_type
     AND delete_receipt.resource_id=NEW.delete_resource_id
     AND delete_receipt.action=NEW.delete_action
     AND delete_receipt.capability=NEW.delete_capability
    JOIN platform_policy_database_fences delete_fence
      ON delete_fence.fence_name=delete_receipt.fence_name
     AND delete_fence.epoch=delete_receipt.fence_epoch
     AND delete_fence.writable=1
    JOIN platform_policy_journal_projection_outbox delete_projection
      ON delete_projection.receipt_hash=delete_receipt.receipt_hash
     AND delete_projection.record_json=delete_receipt.record_json
    WHERE batch.id=NEW.batch_id
      AND batch.family_id=NEW.family_id
      AND batch.status IN ('applied','rollback_blocked')
      AND batch.actor_id=json_extract(delete_receipt.record_json,'$.request.subject.accountId')
      AND NEW.delete_resource_type='event'
      AND NEW.delete_resource_id=NEW.entity_id
      AND NEW.delete_action='delete'
      AND NEW.delete_capability='family.write'
      AND json_extract(delete_receipt.record_json,'$.request.subject.personId')=NEW.owner_person_id
      AND json_extract(delete_receipt.record_json,'$.request.resource.familyId')=NEW.family_id
      AND json_extract(delete_receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
      AND json_extract(delete_receipt.record_json,'$.request.resource.sensitivity')=CASE event.visibility
        WHEN 'personal' THEN 'highly_sensitive'
        WHEN 'selected_members' THEN 'sensitive'
        WHEN 'family' THEN 'personal'
      END
      AND json_extract(delete_receipt.record_json,'$.request.purpose')='general'
  ) THEN RAISE(ABORT,'governed import event rollback requires exact create and delete receipts') END;
END;

CREATE TRIGGER trg_family_import_rollback_location_authorize
BEFORE INSERT ON family_data_import_rollback_deletions
WHEN NEW.entity_type='location'
BEGIN
  SELECT CASE WHEN NEW.consumed_at IS NOT NULL OR NOT EXISTS(
    SELECT 1
    FROM family_data_import_batches batch
    JOIN family_data_import_items item
      ON item.batch_id=batch.id
     AND item.entity_type='location'
     AND item.entity_id=NEW.entity_id
     AND item.resolution='created'
     AND item.create_policy_receipt_hash=NEW.create_receipt_hash
    JOIN locations location
      ON location.id=item.entity_id
     AND location.family_id=NEW.family_id
     AND location.owner_person_id=NEW.owner_person_id
     AND location.policy_receipt_hash=NEW.create_receipt_hash
    JOIN platform_policy_transaction_receipts create_receipt
      ON create_receipt.receipt_hash=NEW.create_receipt_hash
     AND create_receipt.resource_type='location'
     AND create_receipt.resource_id=location.id
     AND create_receipt.action='create'
     AND create_receipt.capability='family.write'
    JOIN platform_policy_database_fences create_fence
      ON create_fence.fence_name=create_receipt.fence_name
     AND create_fence.epoch=create_receipt.fence_epoch
     AND create_fence.writable=1
    JOIN platform_policy_journal_projection_outbox create_projection
      ON create_projection.receipt_hash=create_receipt.receipt_hash
     AND create_projection.record_json=create_receipt.record_json
    JOIN platform_policy_transaction_receipts delete_receipt
      ON delete_receipt.receipt_hash=NEW.delete_receipt_hash
     AND delete_receipt.receipt_version=NEW.delete_receipt_version
     AND delete_receipt.nonce=NEW.delete_receipt_nonce
     AND delete_receipt.correlation_id=NEW.delete_correlation_id
     AND delete_receipt.resource_type=NEW.delete_resource_type
     AND delete_receipt.resource_id=NEW.delete_resource_id
     AND delete_receipt.action=NEW.delete_action
     AND delete_receipt.capability=NEW.delete_capability
    JOIN platform_policy_database_fences delete_fence
      ON delete_fence.fence_name=delete_receipt.fence_name
     AND delete_fence.epoch=delete_receipt.fence_epoch
     AND delete_fence.writable=1
    JOIN platform_policy_journal_projection_outbox delete_projection
      ON delete_projection.receipt_hash=delete_receipt.receipt_hash
     AND delete_projection.record_json=delete_receipt.record_json
    WHERE batch.id=NEW.batch_id
      AND batch.family_id=NEW.family_id
      AND batch.status IN ('applied','rollback_blocked')
      AND batch.actor_id=json_extract(delete_receipt.record_json,'$.request.subject.accountId')
      AND NEW.delete_resource_type='location'
      AND NEW.delete_resource_id=NEW.entity_id
      AND NEW.delete_action='delete'
      AND NEW.delete_capability='family.write'
      AND json_extract(delete_receipt.record_json,'$.request.subject.personId')=NEW.owner_person_id
      AND json_extract(delete_receipt.record_json,'$.request.resource.familyId')=NEW.family_id
      AND json_extract(delete_receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
      AND json_extract(delete_receipt.record_json,'$.request.resource.sensitivity')='highly_sensitive'
      AND json_extract(delete_receipt.record_json,'$.request.purpose')='general'
  ) THEN RAISE(ABORT,'governed import location rollback requires exact create and delete receipts') END;
END;

CREATE TRIGGER trg_family_import_rollback_deletion_consume_only
BEFORE UPDATE ON family_data_import_rollback_deletions
WHEN OLD.consumed_at IS NOT NULL
  OR NEW.consumed_at IS NULL
  OR NEW.batch_id IS NOT OLD.batch_id
  OR NEW.entity_type IS NOT OLD.entity_type
  OR NEW.entity_id IS NOT OLD.entity_id
  OR NEW.family_id IS NOT OLD.family_id
  OR NEW.owner_person_id IS NOT OLD.owner_person_id
  OR NEW.create_receipt_hash IS NOT OLD.create_receipt_hash
  OR NEW.delete_receipt_hash IS NOT OLD.delete_receipt_hash
  OR NEW.delete_receipt_version IS NOT OLD.delete_receipt_version
  OR NEW.delete_receipt_nonce IS NOT OLD.delete_receipt_nonce
  OR NEW.delete_correlation_id IS NOT OLD.delete_correlation_id
  OR NEW.delete_resource_type IS NOT OLD.delete_resource_type
  OR NEW.delete_resource_id IS NOT OLD.delete_resource_id
  OR NEW.delete_action IS NOT OLD.delete_action
  OR NEW.delete_capability IS NOT OLD.delete_capability
  OR NEW.authorized_at IS NOT OLD.authorized_at
  OR (NEW.entity_type='event' AND EXISTS(SELECT 1 FROM events event WHERE event.id=NEW.entity_id))
  OR (NEW.entity_type='location' AND EXISTS(SELECT 1 FROM locations location WHERE location.id=NEW.entity_id))
BEGIN
  SELECT RAISE(ABORT,'governed import rollback deletion tombstone is immutable and consume-only');
END;

CREATE TRIGGER trg_family_import_rollback_deletion_no_delete
BEFORE DELETE ON family_data_import_rollback_deletions
BEGIN
  SELECT RAISE(ABORT,'governed import rollback deletion tombstone cannot be deleted');
END;

DROP TRIGGER IF EXISTS trg_timeline_event_policy_delete;
CREATE TRIGGER trg_timeline_event_policy_delete
BEFORE DELETE ON events
WHEN OLD.timeline_policy_receipt_hash IS NOT NULL
  AND NOT EXISTS(
    SELECT 1 FROM family_data_import_rollback_deletions deletion
    WHERE deletion.entity_type='event'
      AND deletion.entity_id=OLD.id
      AND deletion.family_id=OLD.family_id
      AND deletion.owner_person_id=OLD.owner_person_id
      AND deletion.create_receipt_hash=OLD.timeline_policy_receipt_hash
      AND deletion.consumed_at IS NULL
  )
BEGIN
  SELECT RAISE(ABORT,'GOVERNED_TIMELINE_EVENT_DELETION_WORKFLOW_REQUIRED');
END;

CREATE TRIGGER trg_family_import_rollback_event_consumed
AFTER DELETE ON events
WHEN OLD.timeline_policy_receipt_hash IS NOT NULL
BEGIN
  UPDATE family_data_import_rollback_deletions
  SET consumed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE entity_type='event' AND entity_id=OLD.id
    AND create_receipt_hash=OLD.timeline_policy_receipt_hash
    AND consumed_at IS NULL;
END;

DROP TRIGGER IF EXISTS trg_platform_policy_location_delete;
CREATE TRIGGER trg_platform_policy_location_delete
BEFORE DELETE ON locations
WHEN OLD.policy_receipt_hash IS NOT NULL
  AND NOT EXISTS(
    SELECT 1 FROM family_data_import_rollback_deletions deletion
    WHERE deletion.entity_type='location'
      AND deletion.entity_id=OLD.id
      AND deletion.family_id=OLD.family_id
      AND deletion.owner_person_id=OLD.owner_person_id
      AND deletion.create_receipt_hash=OLD.policy_receipt_hash
      AND deletion.consumed_at IS NULL
  )
BEGIN
  SELECT RAISE(ABORT,'GOVERNED_DELETION_WORKFLOW_REQUIRED');
END;

CREATE TRIGGER trg_family_import_rollback_location_consumed
AFTER DELETE ON locations
WHEN OLD.policy_receipt_hash IS NOT NULL
BEGIN
  UPDATE family_data_import_rollback_deletions
  SET consumed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE entity_type='location' AND entity_id=OLD.id
    AND create_receipt_hash=OLD.policy_receipt_hash
    AND consumed_at IS NULL;
END;

CREATE TRIGGER trg_family_import_rollback_completion_fence
BEFORE UPDATE OF status,rolled_back_at ON family_data_import_batches
WHEN NEW.status='rolled_back' AND OLD.status<>'rolled_back'
BEGIN
  SELECT CASE WHEN NEW.rolled_back_at IS NULL OR EXISTS(
    SELECT 1 FROM family_data_import_items item
    WHERE item.batch_id=NEW.id AND item.resolution='created' AND (
      (item.entity_type='person' AND EXISTS(SELECT 1 FROM people person WHERE person.id=item.entity_id))
      OR (item.entity_type='relation' AND EXISTS(SELECT 1 FROM relations relation WHERE relation.id=item.entity_id))
      OR (item.entity_type='location' AND EXISTS(SELECT 1 FROM locations location WHERE location.id=item.entity_id))
      OR (item.entity_type='event' AND EXISTS(SELECT 1 FROM events event WHERE event.id=item.entity_id))
    )
  ) THEN RAISE(ABORT,'family import rollback completion requires every created row to be absent') END;
  SELECT CASE WHEN EXISTS(
    SELECT 1 FROM family_data_import_items item
    WHERE item.batch_id=NEW.id
      AND item.resolution='created'
      AND item.create_policy_receipt_hash IS NOT NULL
      AND NOT EXISTS(
        SELECT 1 FROM family_data_import_rollback_deletions deletion
        WHERE deletion.batch_id=item.batch_id
          AND deletion.entity_type=item.entity_type
          AND deletion.entity_id=item.entity_id
          AND deletion.create_receipt_hash=item.create_policy_receipt_hash
          AND deletion.consumed_at IS NOT NULL
      )
  ) THEN RAISE(ABORT,'family import rollback completion requires consumed governed deletion tombstones') END;
END;

UPDATE database_metadata
SET value='REVISION-31-T-PPK-002-FAMILY-IMPORT-GOVERNED-ROLLBACK-RECEIPT-FENCE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const platformPolicyContextBindingSql = `ALTER TABLE platform_policy_transaction_receipts
ADD COLUMN context_hash TEXT CHECK(
  context_hash IS NULL OR (
    length(context_hash)=64 AND context_hash NOT GLOB '*[^0-9a-f]*'
  )
);

CREATE INDEX idx_platform_policy_receipt_context
ON platform_policy_transaction_receipts(context_hash)
WHERE context_hash IS NOT NULL;

CREATE TRIGGER trg_ppk004_platform_policy_context_insert
BEFORE INSERT ON platform_policy_transaction_receipts
WHEN NEW.context_hash IS NULL
  OR length(NEW.context_hash)<>64
  OR NEW.context_hash GLOB '*[^0-9a-f]*'
  OR json_extract(NEW.record_json,'$.contextHash') IS NOT NEW.context_hash
  OR json_extract(NEW.record_json,'$.decision.contextHash') IS NOT NEW.context_hash
  OR json_extract(NEW.record_json,'$.receipt.decision.contextHash') IS NOT NEW.context_hash
  OR json_extract(NEW.record_json,'$.request.correlationId') IS NOT NEW.correlation_id
  OR json_type(NEW.record_json,'$.request.subject.accountId') IS NOT 'text'
  OR length(trim(json_extract(NEW.record_json,'$.request.subject.accountId'))) < 1
  OR json_type(NEW.record_json,'$.request.subject.deviceId') IS NOT 'text'
  OR length(trim(json_extract(NEW.record_json,'$.request.subject.deviceId'))) < 1
  OR json_type(NEW.record_json,'$.request.subject.applicationId') IS NOT 'text'
  OR json_type(NEW.record_json,'$.request.subject.roles') IS NOT 'array'
  OR json_array_length(json_extract(NEW.record_json,'$.request.subject.roles')) < 1
  OR json_type(NEW.record_json,'$.request.subject.familyIds') IS NOT 'array'
  OR json_array_length(json_extract(NEW.record_json,'$.request.subject.familyIds')) < 1
  OR json_type(NEW.record_json,'$.request.subject.householdIds') IS NOT 'array'
  OR json_type(NEW.record_json,'$.request.subject.familyBranchIds') IS NOT 'array'
  OR json_type(NEW.record_json,'$.request.resource.familyId') IS NOT 'text'
  OR length(trim(json_extract(NEW.record_json,'$.request.resource.familyId'))) < 1
  OR json_type(NEW.record_json,'$.request.purpose') IS NOT 'text'
  OR length(trim(json_extract(NEW.record_json,'$.request.purpose'))) < 1
  OR json_type(NEW.record_json,'$.request.occurredAt') IS NOT 'text'
  OR julianday(json_extract(NEW.record_json,'$.request.occurredAt')) IS NULL
  OR json_extract(NEW.record_json,'$.request.action') IS NOT NEW.action
  OR json_extract(NEW.record_json,'$.request.capability') IS NOT NEW.capability
BEGIN
  SELECT RAISE(ABORT,'platform policy context binding is missing or inconsistent');
END;

UPDATE database_metadata
SET value='REVISION-31-Z-PPK-004-COMPLETE-POLICY-CONTEXT-BINDING',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const platformPolicyDataClassificationSql = `ALTER TABLE platform_policy_transaction_receipts
ADD COLUMN data_classes_json TEXT CHECK(
  data_classes_json IS NULL OR (
    json_valid(data_classes_json)
    AND json_type(data_classes_json)='array'
    AND json_array_length(data_classes_json) BETWEEN 1 AND 10
  )
);

CREATE INDEX idx_platform_policy_receipt_data_classes
ON platform_policy_transaction_receipts(data_classes_json)
WHERE data_classes_json IS NOT NULL;

CREATE TRIGGER trg_ppk005_platform_policy_data_classes_insert
BEFORE INSERT ON platform_policy_transaction_receipts
WHEN NEW.data_classes_json IS NULL
  OR json_type(NEW.data_classes_json) IS NOT 'array'
  OR json_array_length(NEW.data_classes_json) NOT BETWEEN 1 AND 10
  OR EXISTS(
    SELECT 1 FROM json_each(NEW.data_classes_json) item
    WHERE item.type<>'text' OR item.value NOT IN (
      'general','personal','special','health','finance','child',
      'location','communication','biometric','legacy'
    )
  )
  OR (
    SELECT COUNT(*) FROM json_each(NEW.data_classes_json)
  )<>(
    SELECT COUNT(DISTINCT item.value) FROM json_each(NEW.data_classes_json) item
  )
  OR json_extract(NEW.record_json,'$.dataClasses') IS NOT json(NEW.data_classes_json)
  OR json_extract(NEW.record_json,'$.request.resource.dataClasses') IS NOT json(NEW.data_classes_json)
  OR json_extract(NEW.record_json,'$.request.resource.classificationSource') NOT IN ('declared','policy_default')
BEGIN
  SELECT RAISE(ABORT,'platform policy data classification is missing or inconsistent');
END;

UPDATE database_metadata
SET value='REVISION-32-A-PPK-005-COMPLETE-DATA-CLASSIFICATION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const platformPolicyObligationExecutionSql = `ALTER TABLE platform_policy_transaction_receipts
ADD COLUMN obligation_execution_hash TEXT CHECK(
  obligation_execution_hash IS NULL OR (
    length(obligation_execution_hash)=64
    AND obligation_execution_hash NOT GLOB '*[^0-9a-f]*'
  )
);

CREATE INDEX idx_platform_policy_receipt_obligation_execution
ON platform_policy_transaction_receipts(obligation_execution_hash)
WHERE obligation_execution_hash IS NOT NULL;

CREATE TRIGGER trg_ppk006_platform_policy_obligation_execution_insert
BEFORE INSERT ON platform_policy_transaction_receipts
WHEN NEW.obligation_execution_hash IS NULL
  OR length(NEW.obligation_execution_hash)<>64
  OR NEW.obligation_execution_hash GLOB '*[^0-9a-f]*'
  OR json_type(NEW.record_json,'$.obligationExecution') IS NOT 'object'
  OR json_extract(NEW.record_json,'$.obligationExecution.schemaVersion') IS NOT 1
  OR json_extract(NEW.record_json,'$.obligationExecution.executorId') IS NOT 'ppt.platform-policy.strict-obligation-executor.v1'
  OR json_extract(NEW.record_json,'$.obligationExecution.requestHash') IS NOT NEW.request_hash
  OR json_extract(NEW.record_json,'$.obligationExecution.receiptNonce') IS NOT NEW.nonce
  OR julianday(json_extract(NEW.record_json,'$.obligationExecution.executedAt')) IS NULL
  OR json_extract(NEW.record_json,'$.obligationExecution.attestationHash') IS NOT NEW.obligation_execution_hash
  OR json_type(NEW.record_json,'$.decision.obligations') IS NOT 'array'
  OR json_type(NEW.record_json,'$.obligationExecution.executed') IS NOT 'array'
  OR json_array_length(json_extract(NEW.record_json,'$.obligationExecution.executed'))
     <>json_array_length(json_extract(NEW.record_json,'$.decision.obligations'))
  OR EXISTS(
    SELECT 1
    FROM json_each(NEW.record_json,'$.obligationExecution.executed') executed
    LEFT JOIN json_each(NEW.record_json,'$.decision.obligations') obligation
      ON obligation.key=executed.key
    WHERE json_extract(executed.value,'$.ordinal') IS NOT executed.key
      OR json_extract(executed.value,'$.enforcement') IS NOT 'PEP_RUNTIME_CONTROL'
      OR json_extract(executed.value,'$.type') IS NOT json_extract(obligation.value,'$.type')
      OR json_extract(executed.value,'$.value') IS NOT json_extract(obligation.value,'$.value')
  )
  OR json_type(NEW.record_json,'$.obligationExecution.controls') IS NOT 'object'
  OR json_type(NEW.record_json,'$.obligationExecution.controls.localProcessingOnly') NOT IN ('true','false')
  OR json_type(NEW.record_json,'$.obligationExecution.controls.allowCache') NOT IN ('true','false')
  OR json_type(NEW.record_json,'$.obligationExecution.controls.allowExport') NOT IN ('true','false')
  OR json_type(NEW.record_json,'$.obligationExecution.controls.allowAi') NOT IN ('true','false')
  OR json_type(NEW.record_json,'$.obligationExecution.controls.allowRecording') NOT IN ('true','false')
  OR json_type(NEW.record_json,'$.obligationExecution.controls.maskedFields') IS NOT 'array'
  OR json_extract(NEW.record_json,'$.obligationExecution.controls.localProcessingOnly') IS NOT CASE WHEN EXISTS(
    SELECT 1 FROM json_each(NEW.record_json,'$.decision.obligations') item
    WHERE json_extract(item.value,'$.type')='local_processing_only'
  ) THEN 1 ELSE 0 END
  OR json_extract(NEW.record_json,'$.obligationExecution.controls.allowCache') IS NOT CASE WHEN EXISTS(
    SELECT 1 FROM json_each(NEW.record_json,'$.decision.obligations') item
    WHERE json_extract(item.value,'$.type')='no_cache'
  ) THEN 0 ELSE 1 END
  OR json_extract(NEW.record_json,'$.obligationExecution.controls.allowExport') IS NOT CASE WHEN EXISTS(
    SELECT 1 FROM json_each(NEW.record_json,'$.decision.obligations') item
    WHERE json_extract(item.value,'$.type')='no_export'
  ) THEN 0 ELSE 1 END
  OR json_extract(NEW.record_json,'$.obligationExecution.controls.allowAi') IS NOT CASE WHEN EXISTS(
    SELECT 1 FROM json_each(NEW.record_json,'$.decision.obligations') item
    WHERE json_extract(item.value,'$.type')='no_ai'
  ) THEN 0 ELSE 1 END
  OR json_extract(NEW.record_json,'$.obligationExecution.controls.allowRecording') IS NOT CASE WHEN EXISTS(
    SELECT 1 FROM json_each(NEW.record_json,'$.decision.obligations') item
    WHERE json_extract(item.value,'$.type')='no_recording'
  ) THEN 0 ELSE 1 END
  OR json_extract(NEW.record_json,'$.obligationExecution.controls.maskedFields') IS NOT COALESCE((
    SELECT json_extract(item.value,'$.value')
    FROM json_each(NEW.record_json,'$.decision.obligations') item
    WHERE json_extract(item.value,'$.type')='mask_fields'
  ),json('[]'))
  OR json_extract(NEW.record_json,'$.obligationExecution.controls.watermark') IS NOT (
    SELECT json_extract(item.value,'$.value')
    FROM json_each(NEW.record_json,'$.decision.obligations') item
    WHERE json_extract(item.value,'$.type')='watermark'
  )
  OR json_extract(NEW.record_json,'$.obligationExecution.controls.deleteAfter') IS NOT (
    SELECT json_extract(item.value,'$.value')
    FROM json_each(NEW.record_json,'$.decision.obligations') item
    WHERE json_extract(item.value,'$.type')='delete_after'
  )
BEGIN
  SELECT RAISE(ABORT,'platform policy obligation execution is missing or inconsistent');
END;

UPDATE database_metadata
SET value='REVISION-32-B-PPK-006-COMPLETE-POLICY-OBLIGATION-SUITE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const platformPolicyPackageBindingSql = `ALTER TABLE platform_policy_transaction_receipts
ADD COLUMN policy_package_version INTEGER CHECK(
  policy_package_version IS NULL OR policy_package_version>=1
);

ALTER TABLE platform_policy_transaction_receipts
ADD COLUMN policy_package_sha256 TEXT CHECK(
  policy_package_sha256 IS NULL OR (
    length(policy_package_sha256)=64
    AND policy_package_sha256 NOT GLOB '*[^0-9a-f]*'
  )
);

ALTER TABLE platform_policy_transaction_receipts
ADD COLUMN application_version TEXT CHECK(
  application_version IS NULL OR length(trim(application_version)) BETWEEN 1 AND 128
);

CREATE INDEX idx_platform_policy_receipt_package_binding
ON platform_policy_transaction_receipts(policy_package_version,policy_package_sha256,application_version)
WHERE policy_package_version IS NOT NULL;

CREATE TRIGGER trg_ppk007_platform_policy_package_binding_insert
BEFORE INSERT ON platform_policy_transaction_receipts
WHEN NEW.policy_package_version IS NULL
  OR NEW.policy_package_sha256 IS NULL
  OR NEW.application_version IS NULL
  OR json_extract(NEW.record_json,'$.policyPackageVersion') IS NOT NEW.policy_package_version
  OR json_extract(NEW.record_json,'$.policyPackageSha256') IS NOT NEW.policy_package_sha256
  OR json_extract(NEW.record_json,'$.applicationVersion') IS NOT NEW.application_version
  OR json_extract(NEW.record_json,'$.request.policyPackageVersion') IS NOT NEW.policy_package_version
  OR json_extract(NEW.record_json,'$.request.policyPackageSha256') IS NOT NEW.policy_package_sha256
  OR json_extract(NEW.record_json,'$.request.subject.applicationVersion') IS NOT NEW.application_version
  OR json_extract(NEW.record_json,'$.decision.policyPackageVersion') IS NOT NEW.policy_package_version
  OR json_extract(NEW.record_json,'$.decision.policyPackageSha256') IS NOT NEW.policy_package_sha256
  OR json_extract(NEW.record_json,'$.decision.applicationVersion') IS NOT NEW.application_version
  OR json_extract(NEW.record_json,'$.receipt.decision.policyPackageVersion') IS NOT NEW.policy_package_version
  OR json_extract(NEW.record_json,'$.receipt.decision.policyPackageSha256') IS NOT NEW.policy_package_sha256
  OR json_extract(NEW.record_json,'$.receipt.decision.applicationVersion') IS NOT NEW.application_version
BEGIN
  SELECT RAISE(ABORT,'platform policy package binding is missing or inconsistent');
END;

UPDATE database_metadata
SET value='REVISION-32-C-PPK-007-SIGNED-VERSIONED-POLICY-PACKAGE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const platformApplicationIdentityBindingSql = `ALTER TABLE platform_policy_transaction_receipts
ADD COLUMN capability_manifest_sha256 TEXT CHECK(
  capability_manifest_sha256 IS NULL OR (
    length(capability_manifest_sha256)=64
    AND capability_manifest_sha256 NOT GLOB '*[^0-9a-f]*'
  )
);

ALTER TABLE platform_policy_transaction_receipts
ADD COLUMN device_certificate_sha256 TEXT CHECK(
  device_certificate_sha256 IS NULL OR (
    length(device_certificate_sha256)=64
    AND device_certificate_sha256 NOT GLOB '*[^0-9a-f]*'
  )
);

CREATE INDEX idx_platform_policy_receipt_application_identity
ON platform_policy_transaction_receipts(capability_manifest_sha256,device_certificate_sha256)
WHERE capability_manifest_sha256 IS NOT NULL;

CREATE TRIGGER trg_ppk008_platform_application_identity_insert
BEFORE INSERT ON platform_policy_transaction_receipts
WHEN NEW.capability_manifest_sha256 IS NULL
  OR json_extract(NEW.record_json,'$.capabilityManifestSha256') IS NOT NEW.capability_manifest_sha256
  OR json_extract(NEW.record_json,'$.request.subject.capabilityManifestSha256') IS NOT NEW.capability_manifest_sha256
  OR json_extract(NEW.record_json,'$.decision.capabilityManifestSha256') IS NOT NEW.capability_manifest_sha256
  OR json_extract(NEW.record_json,'$.receipt.decision.capabilityManifestSha256') IS NOT NEW.capability_manifest_sha256
  OR (NEW.device_certificate_sha256 IS NULL) IS NOT (json_type(NEW.record_json,'$.request.subject.deviceCertificate') IS NULL)
  OR (NEW.device_certificate_sha256 IS NOT NULL AND (
    json_extract(NEW.record_json,'$.deviceCertificateSha256') IS NOT NEW.device_certificate_sha256
    OR json_extract(NEW.record_json,'$.request.subject.deviceCertificate.certificateSha256') IS NOT NEW.device_certificate_sha256
    OR json_extract(NEW.record_json,'$.decision.deviceCertificateSha256') IS NOT NEW.device_certificate_sha256
    OR json_extract(NEW.record_json,'$.receipt.decision.deviceCertificateSha256') IS NOT NEW.device_certificate_sha256
  ))
BEGIN
  SELECT RAISE(ABORT,'platform application identity binding is missing or inconsistent');
END;

UPDATE database_metadata
SET value='REVISION-32-D-PPK-008-APPLICATION-IDENTITY-DEVICE-CERTIFICATE-CAPABILITY-MANIFEST',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const platformPolicyDecisionAuthorityBindingSql = `ALTER TABLE platform_policy_transaction_receipts
ADD COLUMN decision_authority_id TEXT CHECK(
  decision_authority_id IS NULL OR decision_authority_id IN ('local-policy-kernel','windows-core-service')
);

CREATE INDEX idx_platform_policy_receipt_decision_authority
ON platform_policy_transaction_receipts(decision_authority_id)
WHERE decision_authority_id IS NOT NULL;

CREATE TRIGGER trg_ppk009_platform_policy_decision_authority_insert
BEFORE INSERT ON platform_policy_transaction_receipts
WHEN (NEW.decision_authority_id IS NULL) IS NOT (json_type(NEW.record_json,'$.decisionAuthorityId') IS NULL)
  OR (NEW.decision_authority_id IS NOT NULL AND (
    json_extract(NEW.record_json,'$.decisionAuthorityId') IS NOT NEW.decision_authority_id
    OR json_extract(NEW.record_json,'$.request.decisionAuthorityId') IS NOT NEW.decision_authority_id
    OR json_extract(NEW.record_json,'$.decision.decisionAuthorityId') IS NOT NEW.decision_authority_id
    OR json_extract(NEW.record_json,'$.receipt.decision.decisionAuthorityId') IS NOT NEW.decision_authority_id
  ))
BEGIN
  SELECT RAISE(ABORT,'platform policy decision authority is missing or inconsistent');
END;

UPDATE database_metadata
SET value='REVISION-32-E-PPK-009-CORE-SERVICE-DECISION-REEVALUATION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const authorizationOwnershipShareSql = `ALTER TABLE object_permissions
ADD COLUMN ownership_basis_points INTEGER CHECK(
  ownership_basis_points IS NULL
  OR (typeof(ownership_basis_points)='integer' AND ownership_basis_points BETWEEN 1 AND 10000)
);

CREATE INDEX idx_object_permissions_ownership_share
ON object_permissions(subject_account_id,resource_type,resource_id,ownership_basis_points)
WHERE ownership_basis_points IS NOT NULL;

CREATE TRIGGER trg_ppk011_object_permission_ownership_insert
BEFORE INSERT ON object_permissions
WHEN (NEW.effect='deny' AND NEW.ownership_basis_points IS NOT NULL)
  OR (NEW.ownership_basis_points IS NOT NULL AND (
    typeof(NEW.ownership_basis_points)<>'integer'
    OR NEW.ownership_basis_points NOT BETWEEN 1 AND 10000
  ))
BEGIN
  SELECT RAISE(ABORT,'invalid object permission ownership share');
END;

CREATE TRIGGER trg_ppk011_object_permission_ownership_update
BEFORE UPDATE OF effect,ownership_basis_points ON object_permissions
WHEN (NEW.effect='deny' AND NEW.ownership_basis_points IS NOT NULL)
  OR (NEW.ownership_basis_points IS NOT NULL AND (
    typeof(NEW.ownership_basis_points)<>'integer'
    OR NEW.ownership_basis_points NOT BETWEEN 1 AND 10000
  ))
BEGIN
  SELECT RAISE(ABORT,'invalid object permission ownership share');
END;

UPDATE database_metadata
SET value='REVISION-32-G-PPK-011-CONTEXTUAL-OWNERSHIP-SHARE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const offlineCapabilityLeaseSql = `CREATE TABLE offline_capability_leases(
  lease_id TEXT PRIMARY KEY CHECK(length(lease_id) BETWEEN 1 AND 128),
  schema_version INTEGER NOT NULL CHECK(schema_version=1),
  family_id TEXT NOT NULL CHECK(length(family_id) BETWEEN 1 AND 128),
  subject_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL CHECK(length(device_id) BETWEEN 1 AND 128),
  capability TEXT NOT NULL CHECK(capability IN (
    'family.read','family.write','health.read','health.write','finance.read','finance.write',
    'location.read','location.share','archive.read','archive.write','archive.ocr','ai.process',
    'translation.process','communication.message','communication.call','communication.record',
    'file.share','backup.create','backup.restore','cluster.admin','plugin.execute'
  )),
  issued_at TEXT NOT NULL,
  not_before TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  policy_version TEXT NOT NULL CHECK(length(policy_version) BETWEEN 1 AND 80),
  policy_package_version INTEGER NOT NULL CHECK(policy_package_version>=1),
  policy_package_sha256 TEXT NOT NULL CHECK(length(policy_package_sha256)=64 AND policy_package_sha256 NOT GLOB '*[^0-9a-f]*'),
  capability_manifest_sha256 TEXT NOT NULL CHECK(length(capability_manifest_sha256)=64 AND capability_manifest_sha256 NOT GLOB '*[^0-9a-f]*'),
  nonce TEXT NOT NULL UNIQUE CHECK(length(nonce) BETWEEN 1 AND 128),
  revoked_at TEXT,
  lease_sha256 TEXT NOT NULL UNIQUE CHECK(length(lease_sha256)=64 AND lease_sha256 NOT GLOB '*[^0-9a-f]*'),
  CHECK(datetime(issued_at) IS NOT NULL AND datetime(not_before) IS NOT NULL AND datetime(expires_at) IS NOT NULL),
  CHECK(unixepoch(not_before)>=unixepoch(issued_at)),
  CHECK(unixepoch(expires_at)-unixepoch(not_before) BETWEEN 60 AND 86400),
  CHECK(revoked_at IS NULL OR (datetime(revoked_at) IS NOT NULL AND unixepoch(revoked_at)>=unixepoch(issued_at)))
);

CREATE INDEX idx_offline_capability_lease_scope
ON offline_capability_leases(family_id,subject_account_id,device_id,capability,expires_at)
WHERE revoked_at IS NULL;

CREATE TRIGGER trg_ppk012_offline_capability_lease_immutable
BEFORE UPDATE OF lease_id,schema_version,family_id,subject_account_id,device_id,capability,issued_at,not_before,expires_at,
  policy_version,policy_package_version,policy_package_sha256,capability_manifest_sha256,nonce
ON offline_capability_leases
BEGIN
  SELECT RAISE(ABORT,'offline capability lease identity is immutable');
END;

CREATE TRIGGER trg_ppk012_offline_capability_lease_revoke_once
BEFORE UPDATE OF revoked_at,lease_sha256 ON offline_capability_leases
WHEN OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL
  OR datetime(NEW.revoked_at) IS NULL OR unixepoch(NEW.revoked_at)<unixepoch(OLD.issued_at)
  OR length(NEW.lease_sha256)<>64 OR NEW.lease_sha256 GLOB '*[^0-9a-f]*'
BEGIN
  SELECT RAISE(ABORT,'offline capability lease revocation is invalid');
END;

UPDATE database_metadata
SET value='REVISION-32-H-PPK-012-OFFLINE-CAPABILITY-LEASE-CACHE-FENCE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const derivedDataPolicyInheritanceSql = `CREATE TABLE derived_data_policy_bindings(
  binding_hash TEXT PRIMARY KEY CHECK(
    length(binding_hash)=64 AND binding_hash NOT GLOB '*[^0-9a-f]*'
  ),
  schema_version INTEGER NOT NULL CHECK(schema_version=1),
  derived_kind TEXT NOT NULL CHECK(derived_kind IN (
    'OCR_TEXT','SEARCH_INDEX','THUMBNAIL','AI_MEMORY','SUMMARY',
    'EMBEDDING','TRANSLATION','TRANSCRIPT','CACHE','REPLICA'
  )),
  derived_resource_type TEXT NOT NULL CHECK(length(trim(derived_resource_type)) BETWEEN 1 AND 128),
  derived_resource_id TEXT NOT NULL CHECK(length(trim(derived_resource_id)) BETWEEN 1 AND 256),
  derived_resource_version TEXT NOT NULL CHECK(length(trim(derived_resource_version)) BETWEEN 1 AND 128),
  content_sha256 TEXT NOT NULL CHECK(
    length(content_sha256)=64 AND content_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  family_id TEXT NOT NULL CHECK(length(trim(family_id)) BETWEEN 1 AND 256),
  policy_version TEXT NOT NULL CHECK(length(trim(policy_version)) BETWEEN 1 AND 128),
  policy_package_sha256 TEXT NOT NULL CHECK(
    length(policy_package_sha256)=64 AND policy_package_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  sensitivity TEXT NOT NULL CHECK(sensitivity IN (
    'public','internal','personal','sensitive','highly_sensitive'
  )),
  data_classes_json TEXT NOT NULL CHECK(
    json_valid(data_classes_json)
    AND json_type(data_classes_json)='array'
    AND json_array_length(data_classes_json) BETWEEN 1 AND 10
    AND json(data_classes_json)=data_classes_json
  ),
  access_policy_json TEXT NOT NULL CHECK(
    json_valid(access_policy_json)
    AND json_type(access_policy_json)='object'
    AND json(access_policy_json)=access_policy_json
  ),
  access_policy_sha256 TEXT NOT NULL CHECK(
    length(access_policy_sha256)=64 AND access_policy_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  obligations_json TEXT NOT NULL CHECK(
    json_valid(obligations_json)
    AND json_type(obligations_json)='array'
    AND json(obligations_json)=obligations_json
  ),
  obligations_sha256 TEXT NOT NULL CHECK(
    length(obligations_sha256)=64 AND obligations_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  source_set_sha256 TEXT NOT NULL CHECK(
    length(source_set_sha256)=64 AND source_set_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  producer_receipt_hash TEXT NOT NULL
    REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT
    CHECK(length(producer_receipt_hash)=64 AND producer_receipt_hash NOT GLOB '*[^0-9a-f]*'),
  binding_json TEXT NOT NULL CHECK(
    json_valid(binding_json)
    AND json_type(binding_json)='object'
    AND json(binding_json)=binding_json
  ),
  source_count INTEGER NOT NULL CHECK(
    typeof(source_count)='integer' AND source_count BETWEEN 1 AND 32
  ),
  lineage_depth INTEGER NOT NULL CHECK(
    typeof(lineage_depth)='integer' AND lineage_depth BETWEEN 1 AND 16
  ),
  retention_until TEXT CHECK(
    retention_until IS NULL OR (
      length(retention_until)=24
      AND retention_until GLOB '????-??-??T??:??:??.???Z'
      AND julianday(retention_until) IS NOT NULL
    )
  ),
  status TEXT NOT NULL CHECK(status IN ('pending','sealed')),
  created_at TEXT NOT NULL CHECK(
    length(created_at)=24
    AND created_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(created_at) IS NOT NULL
  ),
  sealed_at TEXT CHECK(
    sealed_at IS NULL OR (
      length(sealed_at)=24
      AND sealed_at GLOB '????-??-??T??:??:??.???Z'
      AND julianday(sealed_at) IS NOT NULL
    )
  ),
  UNIQUE(derived_resource_type,derived_resource_id,derived_resource_version),
  CHECK(
    (status='pending' AND sealed_at IS NULL)
    OR (
      status='sealed'
      AND sealed_at IS NOT NULL
      AND julianday(sealed_at)>=julianday(created_at)
    )
  )
) STRICT;

CREATE TABLE derived_data_policy_sources(
  binding_hash TEXT NOT NULL
    REFERENCES derived_data_policy_bindings(binding_hash) ON DELETE RESTRICT
    CHECK(length(binding_hash)=64 AND binding_hash NOT GLOB '*[^0-9a-f]*'),
  source_ordinal INTEGER NOT NULL CHECK(
    typeof(source_ordinal)='integer' AND source_ordinal BETWEEN 0 AND 31
  ),
  source_key TEXT NOT NULL CHECK(
    length(source_key)=64 AND source_key NOT GLOB '*[^0-9a-f]*'
  ),
  source_resource_type TEXT NOT NULL CHECK(length(trim(source_resource_type)) BETWEEN 1 AND 128),
  source_resource_id TEXT NOT NULL CHECK(length(trim(source_resource_id)) BETWEEN 1 AND 256),
  source_resource_version TEXT NOT NULL CHECK(length(trim(source_resource_version)) BETWEEN 1 AND 128),
  content_sha256 TEXT NOT NULL CHECK(
    length(content_sha256)=64 AND content_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  family_id TEXT NOT NULL CHECK(length(trim(family_id)) BETWEEN 1 AND 256),
  policy_version TEXT NOT NULL CHECK(length(trim(policy_version)) BETWEEN 1 AND 128),
  policy_package_sha256 TEXT NOT NULL CHECK(
    length(policy_package_sha256)=64 AND policy_package_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  sensitivity TEXT NOT NULL CHECK(sensitivity IN (
    'public','internal','personal','sensitive','highly_sensitive'
  )),
  data_classes_json TEXT NOT NULL CHECK(
    json_valid(data_classes_json)
    AND json_type(data_classes_json)='array'
    AND json_array_length(data_classes_json) BETWEEN 1 AND 10
    AND json(data_classes_json)=data_classes_json
  ),
  policy_receipt_hash TEXT NOT NULL
    REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT
    CHECK(length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*'),
  context_hash TEXT NOT NULL CHECK(
    length(context_hash)=64 AND context_hash NOT GLOB '*[^0-9a-f]*'
  ),
  request_hash TEXT NOT NULL CHECK(
    length(request_hash)=64 AND request_hash NOT GLOB '*[^0-9a-f]*'
  ),
  source_snapshot_json TEXT NOT NULL CHECK(
    json_valid(source_snapshot_json)
    AND json_type(source_snapshot_json)='object'
    AND json(source_snapshot_json)=source_snapshot_json
  ),
  source_snapshot_sha256 TEXT NOT NULL CHECK(
    length(source_snapshot_sha256)=64 AND source_snapshot_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  lineage_depth INTEGER NOT NULL CHECK(
    typeof(lineage_depth)='integer' AND lineage_depth BETWEEN 0 AND 16
  ),
  retention_until TEXT CHECK(
    retention_until IS NULL OR (
      length(retention_until)=24
      AND retention_until GLOB '????-??-??T??:??:??.???Z'
      AND julianday(retention_until) IS NOT NULL
    )
  ),
  authorized_at TEXT NOT NULL CHECK(
    length(authorized_at)=24
    AND authorized_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(authorized_at) IS NOT NULL
  ),
  PRIMARY KEY(binding_hash,source_ordinal),
  UNIQUE(binding_hash,source_key)
) STRICT;

CREATE INDEX idx_derived_data_policy_identity
ON derived_data_policy_bindings(derived_resource_type,derived_resource_id,derived_resource_version);

CREATE INDEX idx_derived_data_policy_source
ON derived_data_policy_sources(source_key,binding_hash);

CREATE INDEX idx_derived_data_policy_source_resource
ON derived_data_policy_sources(source_resource_type,source_resource_id,source_resource_version,binding_hash);

CREATE TRIGGER trg_ppk016_derived_binding_pending_insert
BEFORE INSERT ON derived_data_policy_bindings
WHEN NEW.status<>'pending' OR NEW.sealed_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'derived data policy binding must begin pending');
END;

CREATE TRIGGER trg_ppk016_derived_binding_canonical_json
BEFORE INSERT ON derived_data_policy_bindings
WHEN json_extract(NEW.binding_json,'$.schemaVersion') IS NOT NEW.schema_version
  OR json_extract(NEW.binding_json,'$.bindingHash') IS NOT NEW.binding_hash
  OR json_extract(NEW.binding_json,'$.target.kind') IS NOT NEW.derived_kind
  OR json_extract(NEW.binding_json,'$.target.resourceType') IS NOT NEW.derived_resource_type
  OR json_extract(NEW.binding_json,'$.target.resourceId') IS NOT NEW.derived_resource_id
  OR json_extract(NEW.binding_json,'$.target.resourceVersion') IS NOT NEW.derived_resource_version
  OR json_extract(NEW.binding_json,'$.target.contentSha256') IS NOT NEW.content_sha256
  OR json_extract(NEW.binding_json,'$.target.familyId') IS NOT NEW.family_id
  OR json_extract(NEW.binding_json,'$.target.policyVersion') IS NOT NEW.policy_version
  OR json_extract(NEW.binding_json,'$.target.policyPackageSha256') IS NOT NEW.policy_package_sha256
  OR json_extract(NEW.binding_json,'$.target.sensitivity') IS NOT NEW.sensitivity
  OR json_extract(NEW.binding_json,'$.target.dataClasses') IS NOT json(NEW.data_classes_json)
  OR json_extract(NEW.binding_json,'$.sourceSetHash') IS NOT NEW.source_set_sha256
  OR json_array_length(json_extract(NEW.binding_json,'$.sources')) IS NOT NEW.source_count
  OR json_extract(NEW.binding_json,'$.lineageDepth') IS NOT NEW.lineage_depth
  OR json_extract(NEW.binding_json,'$.effectivePolicy.retentionUntil') IS NOT NEW.retention_until
  OR json_extract(NEW.binding_json,'$.effectivePolicy.allowedAccountIds')
     IS NOT json_extract(NEW.access_policy_json,'$.allowedAccountIds')
  OR json_extract(NEW.binding_json,'$.effectivePolicy.allowedApplicationIds')
     IS NOT json_extract(NEW.access_policy_json,'$.allowedApplicationIds')
  OR json_extract(NEW.binding_json,'$.effectivePolicy.allowedCapabilities')
     IS NOT json_extract(NEW.access_policy_json,'$.allowedCapabilities')
  OR json_extract(NEW.binding_json,'$.effectivePolicy.allowedActions')
     IS NOT json_extract(NEW.access_policy_json,'$.allowedActions')
  OR json_extract(NEW.binding_json,'$.effectivePolicy.allowedPurposes')
     IS NOT json_extract(NEW.access_policy_json,'$.allowedPurposes')
  OR json_extract(NEW.binding_json,'$.effectivePolicy.obligations') IS NOT json(NEW.obligations_json)
BEGIN
  SELECT RAISE(ABORT,'derived data policy binding JSON does not match structural metadata');
END;

CREATE TRIGGER trg_ppk016_derived_binding_receipt
BEFORE INSERT ON derived_data_policy_bindings
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  WHERE receipt.receipt_hash=NEW.producer_receipt_hash
    AND json_extract(receipt.record_json,'$.decision.allowed')=1
    AND receipt.resource_type=NEW.derived_resource_type
    AND receipt.resource_id=NEW.derived_resource_id
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=NEW.sensitivity
    AND json_extract(receipt.record_json,'$.request.resource.dataClasses')=json(NEW.data_classes_json)
    AND receipt.policy_version=NEW.policy_version
    AND receipt.policy_package_sha256=NEW.policy_package_sha256
    AND receipt.issued_at=NEW.created_at
)
BEGIN
  SELECT RAISE(ABORT,'derived data policy binding requires an allowed family-bound producer receipt');
END;

CREATE TRIGGER trg_ppk016_derived_source_pending_insert
BEFORE INSERT ON derived_data_policy_sources
WHEN NOT EXISTS(
  SELECT 1
  FROM derived_data_policy_bindings binding
  WHERE binding.binding_hash=NEW.binding_hash
    AND binding.status='pending'
    AND binding.family_id=NEW.family_id
    AND julianday(binding.created_at)>=julianday(NEW.authorized_at)
    AND (julianday(binding.created_at)-julianday(NEW.authorized_at))*86400000<=30000
)
BEGIN
  SELECT RAISE(ABORT,'derived data policy source requires a matching pending binding');
END;

CREATE TRIGGER trg_ppk016_derived_source_receipt
BEFORE INSERT ON derived_data_policy_sources
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.resource_type=NEW.source_resource_type
    AND receipt.resource_id=NEW.source_resource_id
    AND receipt.request_hash=NEW.request_hash
    AND receipt.context_hash=NEW.context_hash
    AND receipt.policy_version=NEW.policy_version
    AND receipt.policy_package_sha256=NEW.policy_package_sha256
    AND json_extract(receipt.record_json,'$.decision.allowed')=1
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=NEW.sensitivity
    AND json_extract(receipt.record_json,'$.request.resource.dataClasses')=json(NEW.data_classes_json)
    AND receipt.issued_at=NEW.authorized_at
)
BEGIN
  SELECT RAISE(ABORT,'derived data policy source receipt does not match the source snapshot');
END;

CREATE TRIGGER trg_ppk016_derived_source_canonical_json
BEFORE INSERT ON derived_data_policy_sources
WHEN json_extract(NEW.source_snapshot_json,'$.schemaVersion') IS NOT 1
  OR json_extract(NEW.source_snapshot_json,'$.resourceType') IS NOT NEW.source_resource_type
  OR json_extract(NEW.source_snapshot_json,'$.resourceId') IS NOT NEW.source_resource_id
  OR json_extract(NEW.source_snapshot_json,'$.resourceVersion') IS NOT NEW.source_resource_version
  OR json_extract(NEW.source_snapshot_json,'$.contentSha256') IS NOT NEW.content_sha256
  OR json_extract(NEW.source_snapshot_json,'$.familyId') IS NOT NEW.family_id
  OR json_extract(NEW.source_snapshot_json,'$.policyVersion') IS NOT NEW.policy_version
  OR json_extract(NEW.source_snapshot_json,'$.policyPackageSha256') IS NOT NEW.policy_package_sha256
  OR json_extract(NEW.source_snapshot_json,'$.receiptActive') IS NOT 1
  OR json_extract(NEW.source_snapshot_json,'$.receiptHash') IS NOT NEW.policy_receipt_hash
  OR json_extract(NEW.source_snapshot_json,'$.contextHash') IS NOT NEW.context_hash
  OR json_extract(NEW.source_snapshot_json,'$.requestHash') IS NOT NEW.request_hash
  OR json_extract(NEW.source_snapshot_json,'$.sensitivity') IS NOT NEW.sensitivity
  OR json_extract(NEW.source_snapshot_json,'$.dataClasses') IS NOT json(NEW.data_classes_json)
  OR json_extract(NEW.source_snapshot_json,'$.lineageDepth') IS NOT NEW.lineage_depth
  OR json_extract(NEW.source_snapshot_json,'$.retentionUntil') IS NOT NEW.retention_until
BEGIN
  SELECT RAISE(ABORT,'derived data policy source JSON does not match structural metadata');
END;

CREATE TRIGGER trg_ppk016_derived_binding_pending_immutable
BEFORE UPDATE ON derived_data_policy_bindings
WHEN OLD.status='pending' AND (
  NEW.binding_hash IS NOT OLD.binding_hash
  OR NEW.schema_version IS NOT OLD.schema_version
  OR NEW.derived_kind IS NOT OLD.derived_kind
  OR NEW.derived_resource_type IS NOT OLD.derived_resource_type
  OR NEW.derived_resource_id IS NOT OLD.derived_resource_id
  OR NEW.derived_resource_version IS NOT OLD.derived_resource_version
  OR NEW.content_sha256 IS NOT OLD.content_sha256
  OR NEW.family_id IS NOT OLD.family_id
  OR NEW.policy_version IS NOT OLD.policy_version
  OR NEW.policy_package_sha256 IS NOT OLD.policy_package_sha256
  OR NEW.sensitivity IS NOT OLD.sensitivity
  OR NEW.data_classes_json IS NOT OLD.data_classes_json
  OR NEW.access_policy_json IS NOT OLD.access_policy_json
  OR NEW.access_policy_sha256 IS NOT OLD.access_policy_sha256
  OR NEW.obligations_json IS NOT OLD.obligations_json
  OR NEW.obligations_sha256 IS NOT OLD.obligations_sha256
  OR NEW.source_set_sha256 IS NOT OLD.source_set_sha256
  OR NEW.producer_receipt_hash IS NOT OLD.producer_receipt_hash
  OR NEW.binding_json IS NOT OLD.binding_json
  OR NEW.source_count IS NOT OLD.source_count
  OR NEW.lineage_depth IS NOT OLD.lineage_depth
  OR NEW.retention_until IS NOT OLD.retention_until
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.status NOT IN ('pending','sealed')
  OR (NEW.status='pending' AND NEW.sealed_at IS NOT NULL)
  OR (NEW.status='sealed' AND NEW.sealed_at IS NULL)
)
BEGIN
  SELECT RAISE(ABORT,'pending derived data policy binding metadata is immutable');
END;

CREATE TRIGGER trg_ppk016_derived_binding_seal_complete
BEFORE UPDATE OF status,sealed_at ON derived_data_policy_bindings
WHEN OLD.status='pending' AND NEW.status='sealed' AND (
  NEW.sealed_at IS NULL
  OR julianday(NEW.sealed_at)<julianday(OLD.created_at)
  OR (SELECT COUNT(*) FROM derived_data_policy_sources source
      WHERE source.binding_hash=OLD.binding_hash)<>OLD.source_count
  OR (SELECT COALESCE(MIN(source.source_ordinal),-1) FROM derived_data_policy_sources source
      WHERE source.binding_hash=OLD.binding_hash)<>0
  OR (SELECT COALESCE(MAX(source.source_ordinal),-1) FROM derived_data_policy_sources source
      WHERE source.binding_hash=OLD.binding_hash)<>OLD.source_count-1
  OR EXISTS(
    SELECT 1
    FROM derived_data_policy_sources source
    WHERE source.binding_hash=OLD.binding_hash
      AND CASE source.sensitivity
        WHEN 'public' THEN 0 WHEN 'internal' THEN 1 WHEN 'personal' THEN 2
        WHEN 'sensitive' THEN 3 WHEN 'highly_sensitive' THEN 4 ELSE 99
      END > CASE OLD.sensitivity
        WHEN 'public' THEN 0 WHEN 'internal' THEN 1 WHEN 'personal' THEN 2
        WHEN 'sensitive' THEN 3 WHEN 'highly_sensitive' THEN 4 ELSE -1
      END
  )
  OR EXISTS(
    SELECT 1
    FROM derived_data_policy_sources source, json_each(source.data_classes_json) source_class
    WHERE source.binding_hash=OLD.binding_hash
      AND NOT EXISTS(
        SELECT 1 FROM json_each(OLD.data_classes_json) binding_class
        WHERE binding_class.value=source_class.value
      )
  )
)
BEGIN
  SELECT RAISE(ABORT,'derived data policy binding cannot seal without complete non-downgraded sources');
END;

CREATE TRIGGER trg_ppk016_derived_binding_sealed_update
BEFORE UPDATE ON derived_data_policy_bindings
WHEN OLD.status='sealed'
BEGIN
  SELECT RAISE(ABORT,'sealed derived data policy binding is immutable');
END;

CREATE TRIGGER trg_ppk016_derived_binding_sealed_delete
BEFORE DELETE ON derived_data_policy_bindings
WHEN OLD.status='sealed'
BEGIN
  SELECT RAISE(ABORT,'sealed derived data policy binding cannot be deleted');
END;

CREATE TRIGGER trg_ppk016_derived_source_update
BEFORE UPDATE ON derived_data_policy_sources
BEGIN
  SELECT RAISE(ABORT,'derived data policy source is immutable');
END;

CREATE TRIGGER trg_ppk016_derived_source_delete
BEFORE DELETE ON derived_data_policy_sources
BEGIN
  SELECT RAISE(ABORT,'derived data policy source cannot be deleted');
END;

UPDATE database_metadata
SET value='REVISION-32-L-PPK-016-DERIVED-DATA-POLICY-INHERITANCE',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const bankingFoundationSql = `CREATE TABLE bank_institutions(
  institution_code TEXT PRIMARY KEY CHECK(
    length(institution_code)=4 AND institution_code NOT GLOB '*[^0-9]*'
  ),
  iban_provider_code TEXT NOT NULL UNIQUE CHECK(
    length(iban_provider_code)=5 AND iban_provider_code NOT GLOB '*[^0-9]*'
  ),
  official_name TEXT NOT NULL CHECK(length(trim(official_name)) BETWEEN 2 AND 200),
  country_code TEXT NOT NULL CHECK(country_code='TR'),
  kind TEXT NOT NULL CHECK(kind IN ('bank','central_bank','postal_payment','market_infrastructure')),
  supports_customer_accounts INTEGER NOT NULL CHECK(supports_customer_accounts IN (0,1)),
  icon_key TEXT NOT NULL UNIQUE CHECK(length(trim(icon_key)) BETWEEN 2 AND 80),
  icon_source TEXT NOT NULL CHECK(icon_source='local_lettermark'),
  source_name TEXT NOT NULL CHECK(source_name='TCMB Ödeme Sistemleri Katılımcıları'),
  source_version TEXT NOT NULL CHECK(source_version='2026'),
  source_url TEXT NOT NULL CHECK(source_url LIKE 'https://www.tcmb.gov.tr/%'),
  source_retrieved_at TEXT NOT NULL CHECK(datetime(source_retrieved_at) IS NOT NULL),
  status TEXT NOT NULL CHECK(status='active'),
  UNIQUE(institution_code,iban_provider_code)
);

INSERT INTO bank_institutions(
  institution_code,iban_provider_code,official_name,country_code,kind,supports_customer_accounts,
  icon_key,icon_source,source_name,source_version,source_url,source_retrieved_at,status
) VALUES
('0215','00215','ADİL KATILIM BANKASI A.Ş.','TR','bank',1,'bank-00215','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0046','00046','AKBANK T.A.Ş.','TR','bank',1,'bank-00046','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0143','00143','AKTİF YATIRIM BANKASI A.Ş.','TR','bank',1,'bank-00143','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0203','00203','ALBARAKA TÜRK KATILIM BANKASI A.Ş.','TR','bank',1,'bank-00203','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0124','00124','ALTERNATİFBANK A.Ş.','TR','bank',1,'bank-00124','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0135','00135','ANADOLUBANK A.Ş.','TR','bank',1,'bank-00135','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0091','00091','ARAP TÜRK BANKASI','TR','bank',1,'bank-00091','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0161','00161','AYTEMİZ YATIRIM BANKASI A.Ş.','TR','bank',1,'bank-00161','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0129','00129','BANK OF AMERICA YATIRIM BANK A.Ş.','TR','bank',1,'bank-00129','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0149','00149','BANK OF CHINA TURKEY A.Ş.','TR','bank',1,'bank-00149','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0142','00142','BANKPOZİTİF KREDİ VE KALK.BANK.A.Ş.','TR','bank',1,'bank-00142','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0029','00029','BİRLEŞİK FON BANKASI A.Ş.','TR','bank',1,'bank-00029','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0125','00125','BURGAN BANK A.Ş.','TR','bank',1,'bank-00125','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0092','00092','CITIBANK A.Ş.','TR','bank',1,'bank-00092','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0158','00158','COLENDİ BANK A.Ş.','TR','bank',1,'bank-00158','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0151','00151','D YATIRIM BANKASI A.Ş.','TR','bank',1,'bank-00151','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0134','00134','DENİZBANK A.Ş.','TR','bank',1,'bank-00134','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0152','00152','DESTEK YATIRIM BANKASI A.Ş.','TR','bank',1,'bank-00152','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0115','00115','DEUTSCHE BANK A.Ş.','TR','bank',1,'bank-00115','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0138','00138','DİLER YATIRIM BANKASI A.Ş.','TR','bank',1,'bank-00138','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0214','00214','DÜNYA KATILIM BANKASI A.Ş.','TR','bank',1,'bank-00214','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0157','00157','ENPARA BANK A.Ş.','TR','bank',1,'bank-00157','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0103','00103','FİBABANKA A.Ş.','TR','bank',1,'bank-00103','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0159','00159','FUPS BANK A.Ş.','TR','bank',1,'bank-00159','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0150','00150','GOLDEN GLOBAL YATIRIM BANKASI A.Ş.','TR','bank',1,'bank-00150','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0139','00139','GSD YATIRIM BANKASI A.Ş.','TR','bank',1,'bank-00139','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0212','00212','HAYAT FİNANS KATILIM BANKASI','TR','bank',1,'bank-00212','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0156','00156','HEDEF YATIRIM BANKASI A.Ş.','TR','bank',1,'bank-00156','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0123','00123','HSBC BANK A.Ş.','TR','bank',1,'bank-00123','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0109','00109','ICBC TURKEY BANK A.Ş.','TR','bank',1,'bank-00109','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0099','00099','ING BANK A.Ş.','TR','bank',1,'bank-00099','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0148','00148','INTESA SANPAOLO S.P.A.','TR','bank',1,'bank-00148','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0216','00216','İKTİSAT KATILIM BANKASI A.Ş.','TR','bank',1,'bank-00216','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0004','00004','İLLER BANKASI A.Ş.','TR','bank',1,'bank-00004','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0132','00132','İSTANBUL TAKAS VE SAKLAMA BANK. A.Ş.','TR','bank',1,'bank-00132','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0098','00098','JPMORGAN CHASE BANK N.A.','TR','bank',1,'bank-00098','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0205','00205','KUVEYT TÜRK KATILIM BANKASI A.Ş.','TR','bank',1,'bank-00205','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0806','00806','MERKEZİ KAYIT KURULUŞU A.Ş.','TR','market_infrastructure',0,'bank-00806','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0153','00153','MİSYON YATIRIM BANKASI A.Ş.','TR','bank',1,'bank-00153','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0147','00147','MUFG BANK TURKEY A.Ş.','TR','bank',1,'bank-00147','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0141','00141','NUROL YATIRIM BANKASI A.Ş.','TR','bank',1,'bank-00141','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0146','00146','ODEA BANK A.Ş.','TR','bank',1,'bank-00146','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0116','00116','PASHA YATIRIM BANK A.Ş.','TR','bank',1,'bank-00116','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0807','00807','POSTA VE TELGRAF TEŞKİLATI A.Ş.','TR','postal_payment',1,'bank-00807','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0137','00137','RABOBANK A.Ş.','TR','bank',1,'bank-00137','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0122','00122','SOCIETE GENERALE (SA)','TR','bank',1,'bank-00122','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0121','00121','STANDARD CHARTERED YATIRIM BANKASI TÜRK A.Ş.','TR','bank',1,'bank-00121','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0059','00059','ŞEKERBANK T.A.Ş.','TR','bank',1,'bank-00059','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0032','00032','T. EKONOMİ BANKASI A.Ş.','TR','bank',1,'bank-00032','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0016','00016','T. EXİMBANK','TR','bank',1,'bank-00016','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0062','00062','T. GARANTİ BANKASI A.Ş.','TR','bank',1,'bank-00062','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0012','00012','T. HALK BANKASI A.Ş.','TR','bank',1,'bank-00012','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0064','00064','T. İŞ BANKASI A.Ş.','TR','bank',1,'bank-00064','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0017','00017','T. KALKINMA BANKASI A.Ş.','TR','bank',1,'bank-00017','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0014','00014','T. SINAİ KALKINMA BANKASI A.Ş.','TR','bank',1,'bank-00014','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0015','00015','T. VAKIFLAR BANKASI T.A.O.','TR','bank',1,'bank-00015','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0001','00001','T.C. MERKEZ BANKASI','TR','central_bank',0,'bank-00001','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0010','00010','T.C. ZİRAAT BANKASI A.Ş.','TR','bank',1,'bank-00010','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0154','00154','TERA YATIRIM BANKASI A.Ş.','TR','bank',1,'bank-00154','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0213','00213','T.O.M. KATILIM BANKASI A.Ş.','TR','bank',1,'bank-00213','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0096','00096','TURKISH BANK A.Ş.','TR','bank',1,'bank-00096','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0108','00108','TURKLAND BANK A.S.','TR','bank',1,'bank-00108','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0060','00060','TÜRK TİCARET BANKASI A.Ş.','TR','bank',1,'bank-00060','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0211','00211','TÜRKİYE EMLAK KATILIM BANKASI A.Ş.','TR','bank',1,'bank-00211','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0206','00206','TÜRKİYE FİNANS KATILIM BANKASI A.Ş.','TR','bank',1,'bank-00206','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0210','00210','VAKIF KATILIM BANKASI A.Ş.','TR','bank',1,'bank-00210','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0067','00067','YAPI VE KREDİ BANKASI A.Ş.','TR','bank',1,'bank-00067','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0160','00160','ZİRAAT DİNAMİK BANKA A.Ş.','TR','bank',1,'bank-00160','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0209','00209','ZİRAAT KATILIM BANKASI A.Ş.','TR','bank',1,'bank-00209','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0155','00155','Q YATIRIM BANKASI A.Ş.','TR','bank',1,'bank-00155','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active'),
('0111','00111','QNB FİNANSBANK A.Ş.','TR','bank',1,'bank-00111','local_lettermark','TCMB Ödeme Sistemleri Katılımcıları','2026','https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Odeme+Sistemleri','2026-08-12T00:00:00.000Z','active');

CREATE TABLE bank_accounts(
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  institution_code TEXT NOT NULL,
  normalized_iban TEXT NOT NULL CHECK(
    length(normalized_iban)=26
    AND normalized_iban=upper(normalized_iban)
    AND normalized_iban NOT GLOB '*[^A-Z0-9]*'
    AND substr(normalized_iban,1,2)='TR'
    AND substr(normalized_iban,5,5) NOT GLOB '*[^0-9]*'
    AND substr(normalized_iban,10,1)='0'
  ),
  iban_country_code TEXT NOT NULL CHECK(iban_country_code='TR'),
  iban_provider_code TEXT NOT NULL CHECK(
    length(iban_provider_code)=5 AND iban_provider_code NOT GLOB '*[^0-9]*'
  ),
  account_type TEXT NOT NULL CHECK(account_type IN ('checking','savings','time_deposit','participation','investment','other')),
  currency TEXT NOT NULL CHECK(length(currency)=3 AND currency=upper(currency) AND currency NOT GLOB '*[^A-Z]*'),
  alias TEXT NOT NULL CHECK(length(trim(alias)) BETWEEN 2 AND 100),
  branch TEXT CHECK(branch IS NULL OR length(trim(branch)) BETWEEN 1 AND 120),
  ownership_basis_points INTEGER NOT NULL CHECK(ownership_basis_points BETWEEN 1 AND 10000),
  status TEXT NOT NULL CHECK(status IN ('active','inactive','closed')),
  privacy TEXT NOT NULL CHECK(privacy IN ('private','selected_members','family')),
  structural_validation TEXT NOT NULL CHECK(structural_validation='valid'),
  account_verification TEXT NOT NULL CHECK(account_verification='not_performed'),
  ownership_verification TEXT NOT NULL CHECK(ownership_verification='not_performed'),
  created_at TEXT NOT NULL CHECK(datetime(created_at) IS NOT NULL),
  policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
    length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*'
  ),
  policy_receipt_version INTEGER NOT NULL CHECK(policy_receipt_version=1),
  policy_receipt_nonce TEXT NOT NULL,
  policy_correlation_id TEXT NOT NULL,
  policy_resource_type TEXT NOT NULL CHECK(policy_resource_type='finance_record'),
  policy_resource_id TEXT NOT NULL,
  policy_action TEXT NOT NULL CHECK(policy_action='create'),
  policy_capability TEXT NOT NULL CHECK(policy_capability='finance.write'),
  FOREIGN KEY(institution_code,iban_provider_code)
    REFERENCES bank_institutions(institution_code,iban_provider_code) ON DELETE RESTRICT,
  UNIQUE(family_id,normalized_iban),
  UNIQUE(policy_receipt_hash)
);

CREATE INDEX idx_bank_accounts_family_created ON bank_accounts(family_id,created_at DESC);
CREATE INDEX idx_bank_accounts_owner_created ON bank_accounts(owner_person_id,created_at DESC);
CREATE INDEX idx_bank_accounts_institution ON bank_accounts(institution_code,status);

CREATE TRIGGER trg_b4_bank_account_insert_policy_receipt
BEFORE INSERT ON bank_accounts
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='finance_record'
    AND receipt.resource_id=NEW.id
    AND receipt.action='create'
    AND receipt.capability='finance.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.purpose')='finance'
)
OR EXISTS(SELECT 1 FROM finance_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_valuations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'bank account write requires an unused exact durable finance policy receipt');
END;

CREATE TRIGGER trg_b4_finance_record_bank_receipt_reuse
BEFORE INSERT ON finance_records
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM bank_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'finance policy receipt is already bound to a bank account');
END;

CREATE TRIGGER trg_b4_finance_valuation_bank_receipt_reuse
BEFORE INSERT ON finance_valuations
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM bank_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'finance policy receipt is already bound to a bank account');
END;

CREATE TRIGGER trg_b4_bank_account_immutable
BEFORE UPDATE ON bank_accounts
BEGIN
  SELECT RAISE(ABORT,'bank account mutation requires a future governed update workflow');
END;

CREATE TRIGGER trg_b4_bank_account_delete_guard
BEFORE DELETE ON bank_accounts
BEGIN
  SELECT RAISE(ABORT,'bank account deletion requires a governed deletion workflow');
END;

UPDATE database_metadata
SET value='REVISION-32-Z-B4-BANKING-FOUNDATION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const paymentCardManagementSql = `CREATE TABLE payment_cards(
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  institution_code TEXT NOT NULL REFERENCES bank_institutions(institution_code) ON DELETE RESTRICT,
  product_name TEXT NOT NULL CHECK(length(trim(product_name)) BETWEEN 2 AND 120),
  kind TEXT NOT NULL CHECK(kind IN ('credit','debit','prepaid')),
  network TEXT NOT NULL CHECK(network IN ('troy','visa','mastercard','american_express','unionpay','other')),
  form_factor TEXT NOT NULL CHECK(form_factor IN ('physical','virtual','supplementary')),
  last4 TEXT NOT NULL CHECK(length(last4)=4 AND last4 NOT GLOB '*[^0-9]*'),
  currency TEXT NOT NULL CHECK(length(currency)=3 AND currency=upper(currency) AND currency GLOB '[A-Z][A-Z][A-Z]'),
  credit_limit REAL NOT NULL CHECK(credit_limit>=0 AND credit_limit<=1000000000000000),
  available_limit REAL NOT NULL CHECK(available_limit>=0 AND available_limit<=credit_limit),
  current_debt REAL NOT NULL CHECK(current_debt>=0 AND current_debt<=1000000000000000),
  statement_balance REAL NOT NULL CHECK(statement_balance>=0 AND statement_balance<=1000000000000000),
  statement_closing_at TEXT NOT NULL CHECK(datetime(statement_closing_at) IS NOT NULL),
  payment_due_at TEXT NOT NULL CHECK(datetime(payment_due_at) IS NOT NULL AND datetime(payment_due_at)>=datetime(statement_closing_at)),
  active_installment_count INTEGER NOT NULL CHECK(
    typeof(active_installment_count)='integer' AND active_installment_count BETWEEN 0 AND 999
  ),
  installment_outstanding_amount REAL NOT NULL CHECK(
    installment_outstanding_amount>=0 AND installment_outstanding_amount<=1000000000000000
    AND ((active_installment_count=0 AND installment_outstanding_amount=0)
      OR (active_installment_count>0 AND installment_outstanding_amount>0))
  ),
  automatic_payment_mode TEXT NOT NULL CHECK(automatic_payment_mode IN ('none','minimum','full')),
  reward_points REAL NOT NULL CHECK(reward_points>=0 AND reward_points<=1000000000000000),
  reward_miles REAL NOT NULL CHECK(reward_miles>=0 AND reward_miles<=1000000000000000),
  annual_fee_amount REAL NOT NULL CHECK(annual_fee_amount>=0 AND annual_fee_amount<=1000000000000000),
  annual_fee_due_at TEXT CHECK(
    (annual_fee_amount=0 AND (annual_fee_due_at IS NULL OR datetime(annual_fee_due_at) IS NOT NULL))
    OR (annual_fee_amount>0 AND annual_fee_due_at IS NOT NULL AND datetime(annual_fee_due_at) IS NOT NULL)
  ),
  alerts_enabled INTEGER NOT NULL CHECK(alerts_enabled IN (0,1)),
  utilization_alert_basis_points INTEGER NOT NULL CHECK(
    typeof(utilization_alert_basis_points)='integer' AND utilization_alert_basis_points BETWEEN 1 AND 10000
  ),
  payment_due_alert_days INTEGER NOT NULL CHECK(
    typeof(payment_due_alert_days)='integer' AND payment_due_alert_days BETWEEN 0 AND 365
  ),
  status TEXT NOT NULL CHECK(status IN ('active','frozen','closed')),
  privacy TEXT NOT NULL CHECK(privacy IN ('private','selected_members','family')),
  created_at TEXT NOT NULL CHECK(datetime(created_at) IS NOT NULL),
  policy_receipt_hash TEXT NOT NULL,
  policy_receipt_version INTEGER NOT NULL CHECK(policy_receipt_version=1),
  policy_receipt_nonce TEXT NOT NULL,
  policy_correlation_id TEXT NOT NULL,
  policy_resource_type TEXT NOT NULL CHECK(policy_resource_type='finance_record'),
  policy_resource_id TEXT NOT NULL,
  policy_action TEXT NOT NULL CHECK(policy_action='create'),
  policy_capability TEXT NOT NULL CHECK(policy_capability='finance.write'),
  UNIQUE(policy_receipt_hash)
);

CREATE INDEX idx_payment_cards_family_created ON payment_cards(family_id,created_at DESC);
CREATE INDEX idx_payment_cards_owner_created ON payment_cards(owner_person_id,created_at DESC);
CREATE INDEX idx_payment_cards_institution_status ON payment_cards(institution_code,status);
CREATE INDEX idx_payment_cards_due ON payment_cards(payment_due_at,status);

CREATE TRIGGER trg_b4_payment_card_insert_policy_receipt
BEFORE INSERT ON payment_cards
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='finance_record'
    AND receipt.resource_id=NEW.id
    AND receipt.action='create'
    AND receipt.capability='finance.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.purpose')='finance'
)
OR EXISTS(SELECT 1 FROM finance_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_valuations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM bank_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'payment card write requires an unused exact durable finance policy receipt');
END;

CREATE TRIGGER trg_b4_finance_record_card_receipt_reuse
BEFORE INSERT ON finance_records
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM payment_cards WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'finance policy receipt is already bound to a payment card');
END;

CREATE TRIGGER trg_b4_finance_valuation_card_receipt_reuse
BEFORE INSERT ON finance_valuations
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM payment_cards WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'finance policy receipt is already bound to a payment card');
END;

CREATE TRIGGER trg_b4_bank_account_card_receipt_reuse
BEFORE INSERT ON bank_accounts
WHEN EXISTS(SELECT 1 FROM payment_cards WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'finance policy receipt is already bound to a payment card');
END;

CREATE TRIGGER trg_b4_payment_card_immutable
BEFORE UPDATE ON payment_cards
BEGIN
  SELECT RAISE(ABORT,'payment card mutation requires a future governed update workflow');
END;

CREATE TRIGGER trg_b4_payment_card_delete_guard
BEFORE DELETE ON payment_cards
BEGIN
  SELECT RAISE(ABORT,'payment card deletion requires a governed deletion workflow');
END;

UPDATE database_metadata
SET value='REVISION-33-A-B4-PAYMENT-CARD-MANAGEMENT',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const loanManagementSql = `CREATE TABLE loan_accounts(
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  institution_code TEXT NOT NULL REFERENCES bank_institutions(institution_code) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 2 AND 120),
  kind TEXT NOT NULL CHECK(kind IN ('consumer','mortgage','vehicle','other')),
  rate_type TEXT NOT NULL CHECK(rate_type IN ('fixed','variable','profit_share','interest_free')),
  annual_rate_basis_points INTEGER NOT NULL CHECK(
    typeof(annual_rate_basis_points)='integer'
    AND annual_rate_basis_points BETWEEN 0 AND 100000
    AND (rate_type<>'interest_free' OR annual_rate_basis_points=0)
  ),
  term_months INTEGER NOT NULL CHECK(typeof(term_months)='integer' AND term_months BETWEEN 1 AND 600),
  currency TEXT NOT NULL CHECK(length(currency)=3 AND currency=upper(currency) AND currency GLOB '[A-Z][A-Z][A-Z]'),
  original_principal REAL NOT NULL CHECK(original_principal>0 AND original_principal<=1000000000000000),
  installment_amount REAL NOT NULL CHECK(
    installment_amount>0 AND installment_amount<=1000000000000000
    AND (installment_amount*term_months)+0.01>=original_principal
  ),
  remaining_principal REAL NOT NULL CHECK(remaining_principal>=0 AND remaining_principal<=original_principal),
  disbursed_at TEXT NOT NULL CHECK(datetime(disbursed_at) IS NOT NULL),
  first_payment_at TEXT NOT NULL CHECK(
    datetime(first_payment_at) IS NOT NULL AND datetime(first_payment_at)>=datetime(disbursed_at)
  ),
  maturity_at TEXT NOT NULL CHECK(
    datetime(maturity_at) IS NOT NULL AND datetime(maturity_at)>=datetime(first_payment_at)
  ),
  early_settlement_amount REAL NOT NULL CHECK(
    early_settlement_amount>=0 AND early_settlement_amount<=1000000000000000
  ),
  early_settlement_quoted_at TEXT CHECK(
    (early_settlement_amount=0 AND early_settlement_quoted_at IS NULL)
    OR (early_settlement_amount>0 AND early_settlement_quoted_at IS NOT NULL
      AND datetime(early_settlement_quoted_at)>=datetime(disbursed_at))
  ),
  overdue_installment_count INTEGER NOT NULL CHECK(
    typeof(overdue_installment_count)='integer' AND overdue_installment_count BETWEEN 0 AND 600
  ),
  overdue_amount REAL NOT NULL CHECK(overdue_amount>=0 AND overdue_amount<=1000000000000000),
  days_past_due INTEGER NOT NULL CHECK(typeof(days_past_due)='integer' AND days_past_due BETWEEN 0 AND 36500),
  insurance_status TEXT NOT NULL CHECK(insurance_status IN ('none','active','expired','cancelled')),
  insurance_provider TEXT CHECK(insurance_provider IS NULL OR length(trim(insurance_provider)) BETWEEN 1 AND 120),
  insurance_policy_reference TEXT CHECK(
    insurance_policy_reference IS NULL OR length(trim(insurance_policy_reference)) BETWEEN 1 AND 120
  ),
  insurance_premium_amount REAL NOT NULL CHECK(
    insurance_premium_amount>=0 AND insurance_premium_amount<=1000000000000000
  ),
  insurance_ends_at TEXT CHECK(insurance_ends_at IS NULL OR datetime(insurance_ends_at) IS NOT NULL),
  collateral_type TEXT NOT NULL CHECK(collateral_type IN ('none','vehicle','real_estate','deposit','guarantee','other')),
  collateral_description TEXT CHECK(
    collateral_description IS NULL OR length(trim(collateral_description)) BETWEEN 1 AND 240
  ),
  collateral_estimated_value REAL NOT NULL CHECK(
    collateral_estimated_value>=0 AND collateral_estimated_value<=1000000000000000
  ),
  status TEXT NOT NULL CHECK(status IN ('active','overdue','restructured','closed')),
  privacy TEXT NOT NULL CHECK(privacy IN ('private','selected_members','family')),
  created_at TEXT NOT NULL CHECK(datetime(created_at) IS NOT NULL),
  policy_receipt_hash TEXT NOT NULL,
  policy_receipt_version INTEGER NOT NULL CHECK(policy_receipt_version=1),
  policy_receipt_nonce TEXT NOT NULL,
  policy_correlation_id TEXT NOT NULL,
  policy_resource_type TEXT NOT NULL CHECK(policy_resource_type='finance_record'),
  policy_resource_id TEXT NOT NULL,
  policy_action TEXT NOT NULL CHECK(policy_action='create'),
  policy_capability TEXT NOT NULL CHECK(policy_capability='finance.write'),
  CHECK(
    (status='overdue' AND overdue_installment_count>0 AND overdue_amount>0 AND days_past_due>0)
    OR (status<>'overdue' AND overdue_installment_count=0 AND overdue_amount=0 AND days_past_due=0)
  ),
  CHECK((status='closed' AND remaining_principal=0) OR (status<>'closed' AND remaining_principal>0)),
  CHECK(
    (insurance_status='none' AND insurance_provider IS NULL AND insurance_policy_reference IS NULL
      AND insurance_premium_amount=0 AND insurance_ends_at IS NULL)
    OR (insurance_status<>'none' AND insurance_provider IS NOT NULL
      AND insurance_policy_reference IS NOT NULL AND insurance_premium_amount>0
      AND insurance_ends_at IS NOT NULL)
  ),
  CHECK(
    (collateral_type='none' AND collateral_description IS NULL AND collateral_estimated_value=0)
    OR (collateral_type<>'none' AND collateral_description IS NOT NULL AND collateral_estimated_value>0)
  ),
  UNIQUE(policy_receipt_hash)
);

CREATE TABLE loan_payment_schedule(
  loan_id TEXT NOT NULL REFERENCES loan_accounts(id) ON DELETE CASCADE,
  installment_sequence INTEGER NOT NULL CHECK(
    typeof(installment_sequence)='integer' AND installment_sequence BETWEEN 1 AND 600
  ),
  due_at TEXT NOT NULL CHECK(datetime(due_at) IS NOT NULL),
  scheduled_amount REAL NOT NULL CHECK(scheduled_amount>0 AND scheduled_amount<=1000000000000000),
  PRIMARY KEY(loan_id,installment_sequence)
);

CREATE TABLE loan_payment_history(
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL REFERENCES loan_accounts(id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  paid_at TEXT NOT NULL CHECK(datetime(paid_at) IS NOT NULL),
  scheduled_installment_sequence INTEGER CHECK(
    scheduled_installment_sequence IS NULL
    OR (typeof(scheduled_installment_sequence)='integer' AND scheduled_installment_sequence BETWEEN 1 AND 600)
  ),
  amount REAL NOT NULL CHECK(amount>0 AND amount<=1000000000000000),
  principal_amount REAL NOT NULL CHECK(principal_amount>=0 AND principal_amount<=1000000000000000),
  interest_amount REAL NOT NULL CHECK(interest_amount>=0 AND interest_amount<=1000000000000000),
  late_fee_amount REAL NOT NULL CHECK(late_fee_amount>=0 AND late_fee_amount<=1000000000000000),
  notes TEXT CHECK(notes IS NULL OR length(trim(notes)) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL CHECK(datetime(created_at) IS NOT NULL AND datetime(paid_at)<=datetime(created_at)),
  policy_receipt_hash TEXT NOT NULL,
  policy_receipt_version INTEGER NOT NULL CHECK(policy_receipt_version=1),
  policy_receipt_nonce TEXT NOT NULL,
  policy_correlation_id TEXT NOT NULL,
  policy_resource_type TEXT NOT NULL CHECK(policy_resource_type='finance_record'),
  policy_resource_id TEXT NOT NULL,
  policy_action TEXT NOT NULL CHECK(policy_action='update'),
  policy_capability TEXT NOT NULL CHECK(policy_capability='finance.write'),
  CHECK(abs(amount-(principal_amount+interest_amount+late_fee_amount))<0.005),
  UNIQUE(policy_receipt_hash)
);

CREATE INDEX idx_loan_accounts_family_created ON loan_accounts(family_id,created_at DESC);
CREATE INDEX idx_loan_accounts_owner_created ON loan_accounts(owner_person_id,created_at DESC);
CREATE INDEX idx_loan_accounts_institution_status ON loan_accounts(institution_code,status);
CREATE INDEX idx_loan_accounts_maturity ON loan_accounts(maturity_at,status);
CREATE INDEX idx_loan_schedule_due ON loan_payment_schedule(due_at,loan_id);
CREATE INDEX idx_loan_payment_history_loan_paid ON loan_payment_history(loan_id,paid_at DESC);

CREATE TRIGGER trg_b4_loan_account_insert_policy_receipt
BEFORE INSERT ON loan_accounts
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='finance_record'
    AND receipt.resource_id=NEW.id
    AND receipt.action='create'
    AND receipt.capability='finance.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.purpose')='finance'
)
OR EXISTS(SELECT 1 FROM finance_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_valuations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM bank_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM payment_cards WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_payment_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'loan account write requires an unused exact durable finance policy receipt');
END;

CREATE TRIGGER trg_b4_loan_schedule_parent_guard
BEFORE INSERT ON loan_payment_schedule
WHEN NOT EXISTS(
  SELECT 1 FROM loan_accounts loan
  WHERE loan.id=NEW.loan_id
    AND NEW.installment_sequence<=loan.term_months
    AND datetime(NEW.due_at)>=datetime(loan.first_payment_at)
    AND datetime(NEW.due_at)<=datetime(loan.maturity_at)
    AND NEW.scheduled_amount=loan.installment_amount
)
BEGIN
  SELECT RAISE(ABORT,'loan schedule requires an exact parent loan plan');
END;

CREATE TRIGGER trg_b4_loan_payment_insert_policy_receipt
BEFORE INSERT ON loan_payment_history
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash
  JOIN loan_accounts loan ON loan.id=NEW.loan_id
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='finance_record'
    AND receipt.resource_id=NEW.loan_id
    AND receipt.action='update'
    AND receipt.capability='finance.write'
    AND loan.family_id=NEW.family_id
    AND loan.owner_person_id=NEW.owner_person_id
    AND datetime(NEW.paid_at)>=datetime(loan.disbursed_at)
    AND (NEW.scheduled_installment_sequence IS NULL OR NEW.scheduled_installment_sequence<=loan.term_months)
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.purpose')='finance'
)
OR EXISTS(SELECT 1 FROM finance_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_valuations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM bank_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM payment_cards WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'loan payment write requires an unused exact durable finance policy receipt');
END;

CREATE TRIGGER trg_b4_finance_record_loan_receipt_reuse
BEFORE INSERT ON finance_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND (
  EXISTS(SELECT 1 FROM loan_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
  OR EXISTS(SELECT 1 FROM loan_payment_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
)
BEGIN
  SELECT RAISE(ABORT,'finance policy receipt is already bound to a loan record');
END;

CREATE TRIGGER trg_b4_finance_valuation_loan_receipt_reuse
BEFORE INSERT ON finance_valuations
WHEN NEW.policy_receipt_hash IS NOT NULL AND (
  EXISTS(SELECT 1 FROM loan_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
  OR EXISTS(SELECT 1 FROM loan_payment_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
)
BEGIN
  SELECT RAISE(ABORT,'finance policy receipt is already bound to a loan record');
END;

CREATE TRIGGER trg_b4_bank_account_loan_receipt_reuse
BEFORE INSERT ON bank_accounts
WHEN EXISTS(SELECT 1 FROM loan_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
  OR EXISTS(SELECT 1 FROM loan_payment_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'finance policy receipt is already bound to a loan record');
END;

CREATE TRIGGER trg_b4_payment_card_loan_receipt_reuse
BEFORE INSERT ON payment_cards
WHEN EXISTS(SELECT 1 FROM loan_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
  OR EXISTS(SELECT 1 FROM loan_payment_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'finance policy receipt is already bound to a loan record');
END;

CREATE TRIGGER trg_b4_loan_account_immutable
BEFORE UPDATE ON loan_accounts
BEGIN
  SELECT RAISE(ABORT,'loan account mutation requires a future governed snapshot workflow');
END;

CREATE TRIGGER trg_b4_loan_account_delete_guard
BEFORE DELETE ON loan_accounts
BEGIN
  SELECT RAISE(ABORT,'loan account deletion requires a governed deletion workflow');
END;

CREATE TRIGGER trg_b4_loan_schedule_immutable
BEFORE UPDATE ON loan_payment_schedule
BEGIN
  SELECT RAISE(ABORT,'loan schedule is immutable');
END;

CREATE TRIGGER trg_b4_loan_schedule_delete_guard
BEFORE DELETE ON loan_payment_schedule
BEGIN
  SELECT RAISE(ABORT,'loan schedule deletion requires a governed deletion workflow');
END;

CREATE TRIGGER trg_b4_loan_payment_immutable
BEFORE UPDATE ON loan_payment_history
BEGIN
  SELECT RAISE(ABORT,'loan payment history is append-only');
END;

CREATE TRIGGER trg_b4_loan_payment_delete_guard
BEFORE DELETE ON loan_payment_history
BEGIN
  SELECT RAISE(ABORT,'loan payment deletion requires a governed deletion workflow');
END;

UPDATE database_metadata
SET value='REVISION-33-B-B4-LOAN-MANAGEMENT',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const financePlanningLedgerSql = `CREATE TABLE finance_planning_ledger(
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 2 AND 160),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  item_type TEXT NOT NULL CHECK(item_type IN (
    'category','cash_flow','budget','recurring_rule','recurring_state',
    'goal','goal_progress','asset','asset_valuation'
  )),
  parent_item_id TEXT REFERENCES finance_planning_ledger(id) ON DELETE RESTRICT,
  name TEXT,
  category_kind TEXT,
  description TEXT,
  cash_flow_status TEXT,
  amount REAL,
  currency TEXT,
  occurred_at TEXT,
  period_month TEXT,
  frequency TEXT,
  interval_count INTEGER,
  starts_at TEXT,
  next_occurrence_at TEXT,
  ends_at TEXT,
  recurring_status TEXT,
  goal_kind TEXT,
  target_amount REAL,
  current_amount REAL,
  due_at TEXT,
  asset_class TEXT,
  quantity REAL,
  unit_value REAL,
  market_value REAL,
  valued_at TEXT,
  note TEXT,
  privacy TEXT NOT NULL CHECK(privacy IN ('private','selected_members','family')),
  created_at TEXT NOT NULL CHECK(datetime(created_at) IS NOT NULL),
  policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
    length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*'
  ),
  policy_receipt_version INTEGER NOT NULL CHECK(policy_receipt_version=1),
  policy_receipt_nonce TEXT NOT NULL,
  policy_correlation_id TEXT NOT NULL,
  policy_resource_type TEXT NOT NULL CHECK(policy_resource_type='finance_record'),
  policy_resource_id TEXT NOT NULL,
  policy_action TEXT NOT NULL CHECK(policy_action IN ('create','update')),
  policy_capability TEXT NOT NULL CHECK(policy_capability='finance.write'),
  CHECK(
    (item_type IN ('category','goal','asset') AND parent_item_id IS NULL
      AND policy_action='create' AND policy_resource_id=id)
    OR
    (item_type IN ('cash_flow','budget','recurring_rule','recurring_state','goal_progress','asset_valuation')
      AND parent_item_id IS NOT NULL AND policy_action='update' AND policy_resource_id=parent_item_id)
  ),
  CHECK(
    (item_type IN ('category','goal','asset') AND name IS NOT NULL
      AND length(trim(name)) BETWEEN 2 AND 120)
    OR (item_type NOT IN ('category','goal','asset') AND name IS NULL)
  ),
  CHECK(
    (item_type IN ('category','cash_flow','recurring_rule')
      AND category_kind IN ('income','expense'))
    OR (item_type NOT IN ('category','cash_flow','recurring_rule') AND category_kind IS NULL)
  ),
  CHECK(
    item_type IN ('cash_flow','recurring_rule')
    OR description IS NULL
  ),
  CHECK(description IS NULL OR length(trim(description)) BETWEEN 1 AND 240),
  CHECK(
    (item_type='cash_flow' AND cash_flow_status IN ('planned','realized'))
    OR (item_type<>'cash_flow' AND cash_flow_status IS NULL)
  ),
  CHECK(
    (item_type IN ('cash_flow','recurring_rule') AND amount>0 AND amount<=1000000000000000)
    OR (item_type='budget' AND amount>=0 AND amount<=1000000000000000)
    OR (item_type NOT IN ('cash_flow','budget','recurring_rule') AND amount IS NULL)
  ),
  CHECK(
    (item_type IN ('cash_flow','budget','recurring_rule','goal','asset')
      AND length(currency)=3 AND currency=upper(currency) AND currency GLOB '[A-Z][A-Z][A-Z]')
    OR (item_type NOT IN ('cash_flow','budget','recurring_rule','goal','asset') AND currency IS NULL)
  ),
  CHECK(
    (item_type IN ('cash_flow','recurring_state','goal_progress') AND datetime(occurred_at) IS NOT NULL)
    OR (item_type NOT IN ('cash_flow','recurring_state','goal_progress') AND occurred_at IS NULL)
  ),
  CHECK(
    (item_type='budget' AND length(period_month)=7
      AND period_month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'
      AND substr(period_month,6,2) BETWEEN '01' AND '12')
    OR (item_type<>'budget' AND period_month IS NULL)
  ),
  CHECK(
    (item_type='recurring_rule'
      AND frequency IN ('weekly','monthly','quarterly','yearly')
      AND typeof(interval_count)='integer' AND interval_count BETWEEN 1 AND 120
      AND datetime(starts_at) IS NOT NULL
      AND datetime(next_occurrence_at) IS NOT NULL
      AND datetime(next_occurrence_at)>=datetime(starts_at)
      AND (ends_at IS NULL OR (datetime(ends_at) IS NOT NULL AND datetime(ends_at)>=datetime(next_occurrence_at)))
      AND recurring_status='active')
    OR
    (item_type='recurring_state'
      AND frequency IS NULL AND interval_count IS NULL AND starts_at IS NULL
      AND next_occurrence_at IS NULL AND ends_at IS NULL
      AND recurring_status IN ('active','paused','ended'))
    OR
    (item_type NOT IN ('recurring_rule','recurring_state')
      AND frequency IS NULL AND interval_count IS NULL AND starts_at IS NULL
      AND next_occurrence_at IS NULL AND ends_at IS NULL AND recurring_status IS NULL)
  ),
  CHECK(
    (item_type='goal'
      AND goal_kind IN ('savings','debt_reduction','investment','purchase','emergency_fund','other')
      AND target_amount>0 AND target_amount<=1000000000000000
      AND current_amount>=0 AND current_amount<=1000000000000000
      AND (due_at IS NULL OR datetime(due_at) IS NOT NULL))
    OR
    (item_type='goal_progress'
      AND goal_kind IS NULL AND target_amount IS NULL
      AND current_amount>=0 AND current_amount<=1000000000000000 AND due_at IS NULL)
    OR
    (item_type NOT IN ('goal','goal_progress')
      AND goal_kind IS NULL AND target_amount IS NULL AND current_amount IS NULL AND due_at IS NULL)
  ),
  CHECK(
    (item_type='asset'
      AND asset_class IN ('cash','deposit','precious_metal_fx','investment','pension','real_estate','vehicle')
      AND quantity>0 AND quantity<=1000000000000000
      AND unit_value>=0 AND unit_value<=1000000000000000
      AND market_value>=0 AND market_value<=1000000000000000
      AND abs(market_value-(quantity*unit_value))<0.005
      AND datetime(valued_at) IS NOT NULL)
    OR
    (item_type='asset_valuation'
      AND asset_class IS NULL
      AND quantity>0 AND quantity<=1000000000000000
      AND unit_value>=0 AND unit_value<=1000000000000000
      AND market_value>=0 AND market_value<=1000000000000000
      AND abs(market_value-(quantity*unit_value))<0.005
      AND datetime(valued_at) IS NOT NULL)
    OR
    (item_type NOT IN ('asset','asset_valuation')
      AND asset_class IS NULL AND quantity IS NULL AND unit_value IS NULL
      AND market_value IS NULL AND valued_at IS NULL)
  ),
  CHECK(
    item_type IN ('goal_progress','asset','asset_valuation')
    OR note IS NULL
  ),
  CHECK(note IS NULL OR length(trim(note)) BETWEEN 1 AND 500),
  UNIQUE(policy_receipt_hash)
);

CREATE INDEX idx_finance_planning_family_created
ON finance_planning_ledger(family_id,created_at DESC,id);
CREATE INDEX idx_finance_planning_owner_created
ON finance_planning_ledger(owner_person_id,created_at DESC,id);
CREATE INDEX idx_finance_planning_type_created
ON finance_planning_ledger(item_type,created_at DESC,id);
CREATE INDEX idx_finance_planning_parent_created
ON finance_planning_ledger(parent_item_id,created_at DESC,id)
WHERE parent_item_id IS NOT NULL;
CREATE INDEX idx_finance_planning_period
ON finance_planning_ledger(period_month,category_kind,parent_item_id)
WHERE period_month IS NOT NULL;
CREATE INDEX idx_finance_planning_occurred
ON finance_planning_ledger(occurred_at,item_type)
WHERE occurred_at IS NOT NULL;
CREATE INDEX idx_finance_planning_due
ON finance_planning_ledger(due_at,item_type)
WHERE due_at IS NOT NULL;
CREATE INDEX idx_finance_planning_next_occurrence
ON finance_planning_ledger(next_occurrence_at,recurring_status)
WHERE next_occurrence_at IS NOT NULL;
CREATE INDEX idx_finance_planning_valued
ON finance_planning_ledger(valued_at,item_type)
WHERE valued_at IS NOT NULL;

CREATE TRIGGER trg_b4_finance_planning_parent_guard
BEFORE INSERT ON finance_planning_ledger
WHEN NEW.parent_item_id IS NOT NULL AND NOT EXISTS(
  SELECT 1
  FROM finance_planning_ledger parent
  WHERE parent.id=NEW.parent_item_id
    AND parent.family_id=NEW.family_id
    AND parent.owner_person_id=NEW.owner_person_id
    AND parent.privacy=NEW.privacy
    AND datetime(NEW.created_at)>=datetime(parent.created_at)
    AND (
      (NEW.item_type IN ('cash_flow','budget','recurring_rule') AND parent.item_type='category')
      OR (NEW.item_type='recurring_state' AND parent.item_type='recurring_rule')
      OR (NEW.item_type='goal_progress' AND parent.item_type='goal')
      OR (NEW.item_type='asset_valuation' AND parent.item_type='asset')
    )
    AND (
      NEW.item_type NOT IN ('cash_flow','recurring_rule')
      OR NEW.category_kind=parent.category_kind
    )
    AND (
      NEW.item_type<>'recurring_state'
      OR datetime(NEW.occurred_at)>=datetime(parent.starts_at)
    )
    AND (
      NEW.item_type<>'goal_progress'
      OR datetime(NEW.occurred_at)>=datetime(parent.created_at)
    )
    AND (
      NEW.item_type<>'asset_valuation'
      OR datetime(NEW.valued_at)>=datetime(parent.valued_at)
    )
)
BEGIN
  SELECT RAISE(ABORT,'finance planning child requires an exact compatible parent');
END;

CREATE TRIGGER trg_b4_finance_planning_insert_policy_receipt
BEFORE INSERT ON finance_planning_ledger
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='finance_record'
    AND receipt.resource_id=CASE WHEN NEW.parent_item_id IS NULL THEN NEW.id ELSE NEW.parent_item_id END
    AND receipt.action=CASE WHEN NEW.parent_item_id IS NULL THEN 'create' ELSE 'update' END
    AND receipt.capability='finance.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.purpose')='finance'
)
OR EXISTS(SELECT 1 FROM finance_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_valuations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM bank_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM payment_cards WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_payment_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_planning_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'finance planning write requires an unused exact durable finance policy receipt');
END;

CREATE TRIGGER trg_b4_finance_record_planning_receipt_reuse
BEFORE INSERT ON finance_records
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM finance_planning_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'finance policy receipt is already bound to a planning record');
END;

CREATE TRIGGER trg_b4_finance_valuation_planning_receipt_reuse
BEFORE INSERT ON finance_valuations
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM finance_planning_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'finance policy receipt is already bound to a planning record');
END;

CREATE TRIGGER trg_b4_bank_account_planning_receipt_reuse
BEFORE INSERT ON bank_accounts
WHEN EXISTS(SELECT 1 FROM finance_planning_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'finance policy receipt is already bound to a planning record');
END;

CREATE TRIGGER trg_b4_payment_card_planning_receipt_reuse
BEFORE INSERT ON payment_cards
WHEN EXISTS(SELECT 1 FROM finance_planning_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'finance policy receipt is already bound to a planning record');
END;

CREATE TRIGGER trg_b4_loan_account_planning_receipt_reuse
BEFORE INSERT ON loan_accounts
WHEN EXISTS(SELECT 1 FROM finance_planning_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'finance policy receipt is already bound to a planning record');
END;

CREATE TRIGGER trg_b4_loan_payment_planning_receipt_reuse
BEFORE INSERT ON loan_payment_history
WHEN EXISTS(SELECT 1 FROM finance_planning_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'finance policy receipt is already bound to a planning record');
END;

CREATE TRIGGER trg_b4_finance_planning_immutable
BEFORE UPDATE ON finance_planning_ledger
BEGIN
  SELECT RAISE(ABORT,'finance planning ledger is append-only');
END;

CREATE TRIGGER trg_b4_finance_planning_delete_guard
BEFORE DELETE ON finance_planning_ledger
BEGIN
  SELECT RAISE(ABORT,'finance planning deletion requires a governed deletion workflow');
END;

UPDATE database_metadata
SET value='REVISION-33-C-B4-FINANCE-PLANNING-PORTFOLIO-ANALYTICS',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const financeControlledImportOpenBankingSql = `CREATE TABLE finance_import_batches(
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 2 AND 160),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  source_mode TEXT NOT NULL CHECK(source_mode IN ('controlled_file','sandbox')),
  source_format TEXT NOT NULL CHECK(source_format IN ('csv','tsv','xlsx','ofx','qfx','sandbox')),
  file_name TEXT NOT NULL CHECK(
    length(trim(file_name)) BETWEEN 1 AND 180
    AND instr(file_name,'/')=0 AND instr(file_name,char(92))=0 AND instr(file_name,char(0))=0
  ),
  file_sha256 TEXT NOT NULL CHECK(length(file_sha256)=64 AND file_sha256 NOT GLOB '*[^0-9a-f]*'),
  mapping_json TEXT NOT NULL CHECK(
    length(mapping_json)<=4096 AND json_valid(mapping_json)=1 AND json_type(mapping_json)='object'
  ),
  default_currency TEXT NOT NULL CHECK(
    length(default_currency)=3 AND default_currency=upper(default_currency)
    AND default_currency GLOB '[A-Z][A-Z][A-Z]'
  ),
  duplicate_strategy TEXT NOT NULL CHECK(duplicate_strategy IN ('skip','reject')),
  total_rows INTEGER NOT NULL CHECK(typeof(total_rows)='integer' AND total_rows BETWEEN 1 AND 5000),
  imported_rows INTEGER NOT NULL CHECK(typeof(imported_rows)='integer' AND imported_rows BETWEEN 0 AND 5000),
  duplicate_rows INTEGER NOT NULL CHECK(typeof(duplicate_rows)='integer' AND duplicate_rows BETWEEN 0 AND 5000),
  status TEXT NOT NULL CHECK(status IN ('staging','committed')),
  adapter_contract TEXT NOT NULL CHECK(adapter_contract='ohvps-v1-local'),
  network_access TEXT NOT NULL CHECK(network_access='not_performed'),
  credential_exchange TEXT NOT NULL CHECK(credential_exchange='not_performed'),
  external_consent TEXT NOT NULL CHECK(external_consent='not_performed'),
  privacy TEXT NOT NULL CHECK(privacy IN ('private','selected_members','family')),
  created_at TEXT NOT NULL CHECK(datetime(created_at) IS NOT NULL),
  policy_receipt_hash TEXT NOT NULL UNIQUE REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
    length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*'
  ),
  policy_receipt_version INTEGER NOT NULL CHECK(policy_receipt_version=1),
  policy_receipt_nonce TEXT NOT NULL,
  policy_correlation_id TEXT NOT NULL,
  policy_resource_type TEXT NOT NULL CHECK(policy_resource_type='finance_record'),
  policy_resource_id TEXT NOT NULL CHECK(policy_resource_id=id),
  policy_action TEXT NOT NULL CHECK(policy_action='create'),
  policy_capability TEXT NOT NULL CHECK(policy_capability='finance.write'),
  CHECK(imported_rows+duplicate_rows=total_rows),
  CHECK(
    (source_mode='sandbox' AND source_format='sandbox')
    OR (source_mode='controlled_file' AND source_format IN ('csv','tsv','xlsx','ofx','qfx'))
  )
);

CREATE TABLE finance_import_entries(
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 2 AND 160),
  batch_id TEXT NOT NULL REFERENCES finance_import_batches(id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  category_id TEXT NOT NULL REFERENCES finance_planning_ledger(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK(direction IN ('income','expense')),
  amount REAL NOT NULL CHECK(amount>0 AND amount<=1000000000000000),
  currency TEXT NOT NULL CHECK(
    length(currency)=3 AND currency=upper(currency) AND currency GLOB '[A-Z][A-Z][A-Z]'
  ),
  occurred_at TEXT NOT NULL CHECK(datetime(occurred_at) IS NOT NULL),
  description TEXT CHECK(description IS NULL OR length(trim(description)) BETWEEN 1 AND 240),
  external_id TEXT CHECK(external_id IS NULL OR length(trim(external_id)) BETWEEN 1 AND 160),
  source_row_number INTEGER NOT NULL CHECK(typeof(source_row_number)='integer' AND source_row_number BETWEEN 1 AND 1000000),
  row_fingerprint TEXT NOT NULL CHECK(length(row_fingerprint)=64 AND row_fingerprint NOT GLOB '*[^0-9a-f]*'),
  privacy TEXT NOT NULL CHECK(privacy IN ('private','selected_members','family')),
  created_at TEXT NOT NULL CHECK(datetime(created_at) IS NOT NULL),
  UNIQUE(family_id,row_fingerprint),
  UNIQUE(batch_id,source_row_number)
);

CREATE INDEX idx_finance_import_batch_family_created
ON finance_import_batches(family_id,created_at DESC,id);
CREATE INDEX idx_finance_import_batch_owner_created
ON finance_import_batches(owner_person_id,created_at DESC,id);
CREATE INDEX idx_finance_import_entry_batch
ON finance_import_entries(batch_id,source_row_number,id);
CREATE INDEX idx_finance_import_entry_owner_occurred
ON finance_import_entries(owner_person_id,occurred_at DESC,id);
CREATE INDEX idx_finance_import_entry_category_occurred
ON finance_import_entries(category_id,occurred_at DESC,id);

CREATE TRIGGER trg_b4_finance_import_batch_staging_guard
BEFORE INSERT ON finance_import_batches
WHEN NEW.status<>'staging'
BEGIN
  SELECT RAISE(ABORT,'finance import batch must begin in staging state');
END;

CREATE TRIGGER trg_b4_finance_import_batch_policy_receipt
BEFORE INSERT ON finance_import_batches
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.id
    AND receipt.action='create'
    AND receipt.capability='finance.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE NEW.privacy
      WHEN 'private' THEN 'highly_sensitive'
      WHEN 'selected_members' THEN 'sensitive'
      ELSE 'personal'
    END
    AND json_extract(receipt.record_json,'$.request.purpose')='finance'
)
OR EXISTS(SELECT 1 FROM finance_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_valuations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM bank_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM payment_cards WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_payment_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_planning_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_import_batches WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'finance import batch requires an unused exact durable finance policy receipt');
END;

CREATE TRIGGER trg_b4_finance_import_entry_parent_guard
BEFORE INSERT ON finance_import_entries
WHEN NOT EXISTS(
  SELECT 1
  FROM finance_import_batches batch
  JOIN finance_planning_ledger category ON category.id=NEW.category_id
  WHERE batch.id=NEW.batch_id
    AND batch.status='staging'
    AND batch.family_id=NEW.family_id
    AND batch.owner_person_id=NEW.owner_person_id
    AND batch.privacy=NEW.privacy
    AND NEW.created_at=batch.created_at
    AND datetime(NEW.occurred_at)<=datetime(batch.created_at)
    AND category.item_type='category'
    AND category.family_id=NEW.family_id
    AND category.owner_person_id=NEW.owner_person_id
    AND category.privacy=NEW.privacy
    AND category.category_kind=NEW.direction
)
OR (SELECT count(*) FROM finance_import_entries WHERE batch_id=NEW.batch_id)>=(
  SELECT imported_rows FROM finance_import_batches WHERE id=NEW.batch_id
)
BEGIN
  SELECT RAISE(ABORT,'finance import entry requires an open exact batch and compatible category');
END;

CREATE TRIGGER trg_b4_finance_import_batch_seal_guard
BEFORE UPDATE ON finance_import_batches
WHEN NOT(
  OLD.status='staging' AND NEW.status='committed'
  AND NEW.id IS OLD.id AND NEW.family_id IS OLD.family_id
  AND NEW.owner_person_id IS OLD.owner_person_id AND NEW.source_mode IS OLD.source_mode
  AND NEW.source_format IS OLD.source_format AND NEW.file_name IS OLD.file_name
  AND NEW.file_sha256 IS OLD.file_sha256 AND NEW.mapping_json IS OLD.mapping_json
  AND NEW.default_currency IS OLD.default_currency AND NEW.duplicate_strategy IS OLD.duplicate_strategy
  AND NEW.total_rows IS OLD.total_rows AND NEW.imported_rows IS OLD.imported_rows
  AND NEW.duplicate_rows IS OLD.duplicate_rows AND NEW.adapter_contract IS OLD.adapter_contract
  AND NEW.network_access IS OLD.network_access AND NEW.credential_exchange IS OLD.credential_exchange
  AND NEW.external_consent IS OLD.external_consent AND NEW.privacy IS OLD.privacy
  AND NEW.created_at IS OLD.created_at AND NEW.policy_receipt_hash IS OLD.policy_receipt_hash
  AND NEW.policy_receipt_version IS OLD.policy_receipt_version
  AND NEW.policy_receipt_nonce IS OLD.policy_receipt_nonce
  AND NEW.policy_correlation_id IS OLD.policy_correlation_id
  AND NEW.policy_resource_type IS OLD.policy_resource_type
  AND NEW.policy_resource_id IS OLD.policy_resource_id
  AND NEW.policy_action IS OLD.policy_action AND NEW.policy_capability IS OLD.policy_capability
  AND (SELECT count(*) FROM finance_import_entries WHERE batch_id=OLD.id)=OLD.imported_rows
)
BEGIN
  SELECT RAISE(ABORT,'finance import batch only permits an exact complete staging seal');
END;

CREATE TRIGGER trg_b4_finance_import_entry_immutable
BEFORE UPDATE ON finance_import_entries
BEGIN
  SELECT RAISE(ABORT,'finance import entries are append-only');
END;
CREATE TRIGGER trg_b4_finance_import_entry_delete_guard
BEFORE DELETE ON finance_import_entries
BEGIN
  SELECT RAISE(ABORT,'finance import deletion requires a governed deletion workflow');
END;
CREATE TRIGGER trg_b4_finance_import_batch_delete_guard
BEFORE DELETE ON finance_import_batches
BEGIN
  SELECT RAISE(ABORT,'finance import batch deletion requires a governed deletion workflow');
END;

CREATE TRIGGER trg_b4_finance_record_import_receipt_reuse
BEFORE INSERT ON finance_records
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM finance_import_batches WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'finance policy receipt is already bound to an import batch'); END;
CREATE TRIGGER trg_b4_finance_valuation_import_receipt_reuse
BEFORE INSERT ON finance_valuations
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM finance_import_batches WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'finance policy receipt is already bound to an import batch'); END;
CREATE TRIGGER trg_b4_bank_account_import_receipt_reuse
BEFORE INSERT ON bank_accounts
WHEN EXISTS(SELECT 1 FROM finance_import_batches WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'finance policy receipt is already bound to an import batch'); END;
CREATE TRIGGER trg_b4_payment_card_import_receipt_reuse
BEFORE INSERT ON payment_cards
WHEN EXISTS(SELECT 1 FROM finance_import_batches WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'finance policy receipt is already bound to an import batch'); END;
CREATE TRIGGER trg_b4_loan_account_import_receipt_reuse
BEFORE INSERT ON loan_accounts
WHEN EXISTS(SELECT 1 FROM finance_import_batches WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'finance policy receipt is already bound to an import batch'); END;
CREATE TRIGGER trg_b4_loan_payment_import_receipt_reuse
BEFORE INSERT ON loan_payment_history
WHEN EXISTS(SELECT 1 FROM finance_import_batches WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'finance policy receipt is already bound to an import batch'); END;
CREATE TRIGGER trg_b4_finance_planning_import_receipt_reuse
BEFORE INSERT ON finance_planning_ledger
WHEN EXISTS(SELECT 1 FROM finance_import_batches WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'finance policy receipt is already bound to an import batch'); END;

UPDATE database_metadata
SET value='REVISION-33-D-B4-CONTROLLED-IMPORT-OPEN-BANKING',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const lifeHomeVehicleManagedLedgerSql = `CREATE TABLE life_managed_ledger(
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 2 AND 160),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  item_type TEXT NOT NULL CHECK(item_type IN ('profile','activity','document')),
  parent_record_id TEXT REFERENCES life_managed_ledger(id) ON DELETE RESTRICT,
  category TEXT CHECK(category IS NULL OR category IN (
    'insurance','subscription','education','employment','official_operation','home','vehicle'
  )),
  title TEXT CHECK(title IS NULL OR length(trim(title)) BETWEEN 2 AND 160),
  status TEXT CHECK(status IS NULL OR status IN ('planned','active','completed','expired','cancelled')),
  details_json TEXT CHECK(details_json IS NULL OR json_valid(details_json)=1),
  starts_at TEXT CHECK(starts_at IS NULL OR (
    length(starts_at)=24
    AND starts_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
    AND strftime('%Y-%m-%dT%H:%M:%fZ',starts_at)=starts_at
  )),
  ends_at TEXT CHECK(ends_at IS NULL OR (
    length(ends_at)=24
    AND ends_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
    AND strftime('%Y-%m-%dT%H:%M:%fZ',ends_at)=ends_at
  )),
  reminder_mutation TEXT CHECK(reminder_mutation IS NULL OR reminder_mutation IN ('set','clear')),
  reminder_kind TEXT CHECK(reminder_kind IS NULL OR reminder_kind IN (
    'renewal','expiry','payment','term','contract_end','official_deadline',
    'rent','insurance','inspection','maintenance','other'
  )),
  next_reminder_at TEXT CHECK(next_reminder_at IS NULL OR (
    length(next_reminder_at)=24
    AND next_reminder_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
    AND strftime('%Y-%m-%dT%H:%M:%fZ',next_reminder_at)=next_reminder_at
  )),
  finance_asset_id TEXT REFERENCES finance_planning_ledger(id) ON DELETE RESTRICT,
  activity_kind TEXT CHECK(activity_kind IS NULL OR activity_kind IN (
    'renewal','rent_payment','insurance_premium','inspection','maintenance',
    'service','fuel','charging','expense'
  )),
  occurred_at TEXT CHECK(occurred_at IS NULL OR (
    length(occurred_at)=24
    AND occurred_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
    AND strftime('%Y-%m-%dT%H:%M:%fZ',occurred_at)=occurred_at
  )),
  provider TEXT CHECK(provider IS NULL OR length(trim(provider)) BETWEEN 1 AND 160),
  amount_minor INTEGER CHECK(amount_minor IS NULL OR (
    typeof(amount_minor)='integer' AND amount_minor BETWEEN 1 AND 1000000000000000
  )),
  currency TEXT CHECK(currency IS NULL OR (
    length(currency)=3 AND currency=upper(currency) AND currency GLOB '[A-Z][A-Z][A-Z]'
  )),
  quantity_milliunits INTEGER CHECK(quantity_milliunits IS NULL OR (
    typeof(quantity_milliunits)='integer' AND quantity_milliunits BETWEEN 1 AND 1000000000000000
  )),
  odometer_km INTEGER CHECK(odometer_km IS NULL OR (
    typeof(odometer_km)='integer' AND odometer_km BETWEEN 0 AND 10000000
  )),
  finance_expense_id TEXT REFERENCES finance_planning_ledger(id) ON DELETE RESTRICT,
  note TEXT CHECK(note IS NULL OR length(trim(note)) BETWEEN 1 AND 500),
  archive_item_id TEXT REFERENCES archive_items(id) ON DELETE RESTRICT,
  document_kind TEXT CHECK(document_kind IS NULL OR document_kind IN (
    'policy','contract','certificate','application_receipt','invoice','lease','deed',
    'dask_policy','home_insurance_policy','vehicle_registration','vehicle_insurance_policy',
    'inspection_report','service_receipt','fuel_receipt','charging_receipt','other'
  )),
  label TEXT CHECK(label IS NULL OR length(trim(label)) BETWEEN 1 AND 160),
  privacy TEXT NOT NULL CHECK(privacy IN ('private','selected_members','family')),
  data_source TEXT NOT NULL CHECK(data_source='manual'),
  external_verification TEXT NOT NULL CHECK(external_verification='not_performed'),
  payment_execution TEXT NOT NULL CHECK(payment_execution='not_performed'),
  created_at TEXT NOT NULL CHECK(
    length(created_at)=24
    AND created_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
    AND strftime('%Y-%m-%dT%H:%M:%fZ',created_at)=created_at
  ),
  policy_receipt_hash TEXT NOT NULL UNIQUE REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
    length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*'
  ),
  policy_receipt_version INTEGER NOT NULL CHECK(policy_receipt_version=1),
  policy_receipt_nonce TEXT NOT NULL,
  policy_correlation_id TEXT NOT NULL,
  policy_resource_type TEXT NOT NULL CHECK(policy_resource_type='life_record'),
  policy_resource_id TEXT NOT NULL,
  policy_action TEXT NOT NULL CHECK(policy_action IN ('create','update')),
  policy_capability TEXT NOT NULL CHECK(policy_capability='family.write'),
  CHECK((amount_minor IS NULL AND currency IS NULL) OR (amount_minor IS NOT NULL AND currency IS NOT NULL)),
  CHECK(starts_at IS NULL OR ends_at IS NULL OR datetime(ends_at)>=datetime(starts_at)),
  CHECK(occurred_at IS NULL OR datetime(occurred_at)<=datetime(created_at)),
  CHECK(
    (item_type='profile'
      AND parent_record_id IS NULL
      AND category IS NOT NULL AND title IS NOT NULL AND status IS NOT NULL AND details_json IS NOT NULL
      AND activity_kind IS NULL AND occurred_at IS NULL AND provider IS NULL
      AND amount_minor IS NULL AND currency IS NULL AND quantity_milliunits IS NULL
      AND odometer_km IS NULL AND finance_expense_id IS NULL AND note IS NULL
      AND archive_item_id IS NULL AND document_kind IS NULL AND label IS NULL
      AND (reminder_mutation IS NULL OR reminder_mutation='set')
      AND ((reminder_mutation IS NULL AND reminder_kind IS NULL AND next_reminder_at IS NULL)
        OR (reminder_mutation='set' AND reminder_kind IS NOT NULL AND next_reminder_at IS NOT NULL))
      AND (finance_asset_id IS NULL OR category IN ('home','vehicle'))
      AND policy_action='create' AND policy_resource_id=id)
    OR
    (item_type='activity'
      AND parent_record_id IS NOT NULL
      AND category IS NULL AND title IS NULL AND status IS NULL AND details_json IS NULL
      AND starts_at IS NULL AND ends_at IS NULL AND finance_asset_id IS NULL
      AND activity_kind IS NOT NULL AND occurred_at IS NOT NULL
      AND archive_item_id IS NULL AND document_kind IS NULL AND label IS NULL
      AND ((reminder_mutation IS NULL AND reminder_kind IS NULL AND next_reminder_at IS NULL)
        OR (reminder_mutation='set' AND reminder_kind IS NOT NULL AND next_reminder_at IS NOT NULL)
        OR (reminder_mutation='clear' AND reminder_kind IS NULL AND next_reminder_at IS NULL))
      AND policy_action='update' AND policy_resource_id=parent_record_id)
    OR
    (item_type='document'
      AND parent_record_id IS NOT NULL
      AND category IS NULL AND title IS NULL AND status IS NULL AND details_json IS NULL
      AND starts_at IS NULL AND ends_at IS NULL AND reminder_mutation IS NULL
      AND reminder_kind IS NULL AND next_reminder_at IS NULL AND finance_asset_id IS NULL
      AND activity_kind IS NULL AND occurred_at IS NULL AND provider IS NULL
      AND amount_minor IS NULL AND currency IS NULL AND quantity_milliunits IS NULL
      AND odometer_km IS NULL AND finance_expense_id IS NULL AND note IS NULL
      AND archive_item_id IS NOT NULL AND document_kind IS NOT NULL
      AND policy_action='update' AND policy_resource_id=parent_record_id)
  ),
  CHECK(
    item_type<>'activity'
    OR (activity_kind IN ('fuel','charging')
      AND amount_minor IS NOT NULL AND quantity_milliunits IS NOT NULL)
    OR (activity_kind IN ('rent_payment','insurance_premium','expense')
      AND amount_minor IS NOT NULL AND quantity_milliunits IS NULL AND odometer_km IS NULL)
    OR (activity_kind IN ('renewal','inspection','maintenance','service')
      AND quantity_milliunits IS NULL)
  ),
  CHECK(item_type<>'activity' OR activity_kind IN ('inspection','maintenance','service','fuel','charging') OR odometer_km IS NULL),
  CHECK(finance_expense_id IS NULL OR amount_minor IS NOT NULL)
);

CREATE INDEX idx_life_managed_family_created
ON life_managed_ledger(family_id,created_at DESC,id);
CREATE INDEX idx_life_managed_owner_created
ON life_managed_ledger(owner_person_id,created_at DESC,id);
CREATE INDEX idx_life_managed_profile_category_status
ON life_managed_ledger(family_id,category,status,created_at DESC,id)
WHERE item_type='profile';
CREATE INDEX idx_life_managed_parent_created
ON life_managed_ledger(parent_record_id,created_at DESC,id)
WHERE parent_record_id IS NOT NULL;
CREATE INDEX idx_life_managed_reminder_due
ON life_managed_ledger(next_reminder_at,parent_record_id,id)
WHERE reminder_mutation='set';
CREATE INDEX idx_life_managed_activity_occurred
ON life_managed_ledger(parent_record_id,occurred_at DESC,id)
WHERE item_type='activity';
CREATE UNIQUE INDEX idx_life_managed_archive_item
ON life_managed_ledger(archive_item_id)
WHERE archive_item_id IS NOT NULL;
CREATE UNIQUE INDEX idx_life_managed_finance_asset
ON life_managed_ledger(finance_asset_id)
WHERE finance_asset_id IS NOT NULL;
CREATE UNIQUE INDEX idx_life_managed_finance_expense
ON life_managed_ledger(finance_expense_id)
WHERE finance_expense_id IS NOT NULL;

CREATE TRIGGER trg_b5_life_managed_details_matrix
BEFORE INSERT ON life_managed_ledger
WHEN NEW.item_type='profile' AND CASE
  WHEN json_valid(NEW.details_json)<>1 OR json_type(NEW.details_json)<>'object' THEN 1
  ELSE NOT (
    (NEW.category='insurance'
      AND (SELECT count(*) FROM json_each(NEW.details_json))=2
      AND NOT EXISTS(SELECT 1 FROM json_each(NEW.details_json) WHERE key NOT IN ('insuranceKind','provider'))
      AND json_extract(NEW.details_json,'$.insuranceKind') IN ('dask','home','vehicle_compulsory','vehicle_comprehensive','other')
      AND json_type(NEW.details_json,'$.provider')='text'
      AND length(trim(json_extract(NEW.details_json,'$.provider'))) BETWEEN 1 AND 160)
    OR (NEW.category='subscription'
      AND (SELECT count(*) FROM json_each(NEW.details_json))=3
      AND NOT EXISTS(SELECT 1 FROM json_each(NEW.details_json) WHERE key NOT IN ('provider','planName','billingCycle'))
      AND json_type(NEW.details_json,'$.provider')='text'
      AND length(trim(json_extract(NEW.details_json,'$.provider'))) BETWEEN 1 AND 160
      AND json_type(NEW.details_json,'$.planName')='text'
      AND length(trim(json_extract(NEW.details_json,'$.planName'))) BETWEEN 1 AND 160
      AND json_extract(NEW.details_json,'$.billingCycle') IN ('monthly','quarterly','yearly','other'))
    OR (NEW.category='education'
      AND (SELECT count(*) FROM json_each(NEW.details_json))=2
      AND NOT EXISTS(SELECT 1 FROM json_each(NEW.details_json) WHERE key NOT IN ('institution','program'))
      AND json_type(NEW.details_json,'$.institution')='text'
      AND length(trim(json_extract(NEW.details_json,'$.institution'))) BETWEEN 1 AND 160
      AND json_type(NEW.details_json,'$.program')='text'
      AND length(trim(json_extract(NEW.details_json,'$.program'))) BETWEEN 1 AND 160)
    OR (NEW.category='employment'
      AND (SELECT count(*) FROM json_each(NEW.details_json))=2
      AND NOT EXISTS(SELECT 1 FROM json_each(NEW.details_json) WHERE key NOT IN ('employer','position'))
      AND json_type(NEW.details_json,'$.employer')='text'
      AND length(trim(json_extract(NEW.details_json,'$.employer'))) BETWEEN 1 AND 160
      AND json_type(NEW.details_json,'$.position')='text'
      AND length(trim(json_extract(NEW.details_json,'$.position'))) BETWEEN 1 AND 160)
    OR (NEW.category='official_operation'
      AND (SELECT count(*) FROM json_each(NEW.details_json))=2
      AND NOT EXISTS(SELECT 1 FROM json_each(NEW.details_json) WHERE key NOT IN ('authority','operationType'))
      AND json_type(NEW.details_json,'$.authority')='text'
      AND length(trim(json_extract(NEW.details_json,'$.authority'))) BETWEEN 1 AND 160
      AND json_type(NEW.details_json,'$.operationType')='text'
      AND length(trim(json_extract(NEW.details_json,'$.operationType'))) BETWEEN 1 AND 160)
    OR (NEW.category='home'
      AND (SELECT count(*) FROM json_each(NEW.details_json))=3
      AND NOT EXISTS(SELECT 1 FROM json_each(NEW.details_json) WHERE key NOT IN ('tenure','propertyType','addressLabel'))
      AND json_extract(NEW.details_json,'$.tenure') IN ('owner','tenant')
      AND json_extract(NEW.details_json,'$.propertyType') IN ('residence','workplace','land','other')
      AND json_type(NEW.details_json,'$.addressLabel')='text'
      AND length(trim(json_extract(NEW.details_json,'$.addressLabel'))) BETWEEN 1 AND 240)
    OR (NEW.category='vehicle'
      AND (SELECT count(*) FROM json_each(NEW.details_json)) BETWEEN 2 AND 3
      AND NOT EXISTS(SELECT 1 FROM json_each(NEW.details_json) WHERE key NOT IN ('vehicleType','energyType','plate'))
      AND json_extract(NEW.details_json,'$.vehicleType') IN ('car','motorcycle','commercial','other')
      AND json_extract(NEW.details_json,'$.energyType') IN ('fuel','electric','hybrid','other')
      AND (json_type(NEW.details_json,'$.plate') IS NULL OR (
        json_type(NEW.details_json,'$.plate')='text'
        AND length(trim(json_extract(NEW.details_json,'$.plate'))) BETWEEN 2 AND 32)))
  )
END
BEGIN
  SELECT RAISE(ABORT,'managed life profile requires exact category details');
END;

CREATE TRIGGER trg_b5_life_managed_parent_matrix
BEFORE INSERT ON life_managed_ledger
WHEN NEW.item_type IN ('activity','document') AND NOT EXISTS(
  SELECT 1
  FROM life_managed_ledger parent
  WHERE parent.id=NEW.parent_record_id
    AND parent.item_type='profile'
    AND parent.family_id=NEW.family_id
    AND parent.owner_person_id=NEW.owner_person_id
    AND parent.privacy=NEW.privacy
    AND datetime(NEW.created_at)>=datetime(parent.created_at)
    AND (
      (NEW.item_type='activity' AND (
        NEW.activity_kind='renewal'
        OR (NEW.activity_kind='rent_payment' AND parent.category='home')
        OR (NEW.activity_kind='insurance_premium' AND parent.category IN ('insurance','home','vehicle'))
        OR (NEW.activity_kind='inspection' AND parent.category='vehicle')
        OR (NEW.activity_kind IN ('maintenance','service','expense') AND parent.category IN ('home','vehicle'))
        OR (NEW.activity_kind IN ('fuel','charging') AND parent.category='vehicle')
      ))
      OR (NEW.item_type='document' AND (
        NEW.document_kind='other'
        OR (NEW.document_kind='policy' AND parent.category='insurance')
        OR (NEW.document_kind='contract' AND parent.category IN ('subscription','education','employment','official_operation'))
        OR (NEW.document_kind='certificate' AND parent.category IN ('education','employment','official_operation'))
        OR (NEW.document_kind='application_receipt' AND parent.category='official_operation')
        OR (NEW.document_kind='invoice' AND parent.category IN ('subscription','home','vehicle'))
        OR (NEW.document_kind='service_receipt' AND parent.category IN ('home','vehicle'))
        OR (NEW.document_kind IN ('lease','deed','dask_policy','home_insurance_policy') AND parent.category='home')
        OR (NEW.document_kind IN (
          'vehicle_registration','vehicle_insurance_policy','inspection_report',
          'fuel_receipt','charging_receipt'
        ) AND parent.category='vehicle')
      ))
    )
)
BEGIN
  SELECT RAISE(ABORT,'managed life child requires exact compatible parent family owner privacy and category');
END;

CREATE TRIGGER trg_b5_life_managed_external_link_scope
BEFORE INSERT ON life_managed_ledger
WHEN (
  NEW.item_type='document' AND NOT EXISTS(
    SELECT 1 FROM archive_items archive
    WHERE archive.id=NEW.archive_item_id
      AND archive.family_id=NEW.family_id
      AND archive.destroyed_at IS NULL
      AND archive.sensitivity=CASE NEW.privacy
        WHEN 'private' THEN 'high'
        WHEN 'selected_members' THEN 'personal'
        ELSE 'standard'
      END
      AND datetime(archive.created_at)<=datetime(NEW.created_at)
  )
) OR (
  NEW.finance_asset_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM finance_planning_ledger asset
    WHERE asset.id=NEW.finance_asset_id
      AND asset.item_type='asset'
      AND asset.asset_class=CASE NEW.category WHEN 'home' THEN 'real_estate' ELSE 'vehicle' END
      AND asset.family_id=NEW.family_id
      AND asset.owner_person_id=NEW.owner_person_id
      AND asset.privacy=NEW.privacy
      AND datetime(asset.created_at)<=datetime(NEW.created_at)
  )
) OR (
  NEW.finance_expense_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM finance_planning_ledger expense
    WHERE expense.id=NEW.finance_expense_id
      AND expense.item_type='cash_flow'
      AND expense.category_kind='expense'
      AND expense.family_id=NEW.family_id
      AND expense.owner_person_id=NEW.owner_person_id
      AND expense.privacy=NEW.privacy
      AND expense.currency=NEW.currency
      AND CAST(round(expense.amount*100) AS INTEGER)=NEW.amount_minor
      AND expense.occurred_at=NEW.occurred_at
      AND datetime(expense.created_at)<=datetime(NEW.created_at)
  )
)
BEGIN
  SELECT RAISE(ABORT,'managed life archive or finance link is outside exact scope');
END;

CREATE TRIGGER trg_b5_life_managed_id_collision
BEFORE INSERT ON life_managed_ledger
WHEN EXISTS(SELECT 1 FROM life_records WHERE id=NEW.id)
BEGIN
  SELECT RAISE(ABORT,'managed life id collides with a legacy life record');
END;

CREATE TRIGGER trg_b5_life_record_managed_id_collision
BEFORE INSERT ON life_records
WHEN EXISTS(SELECT 1 FROM life_managed_ledger WHERE id=NEW.id)
BEGIN
  SELECT RAISE(ABORT,'life record id collides with a managed life ledger item');
END;

CREATE TRIGGER trg_b5_life_managed_policy_receipt
BEFORE INSERT ON life_managed_ledger
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='life_record'
    AND receipt.resource_id=CASE WHEN NEW.item_type='profile' THEN NEW.id ELSE NEW.parent_record_id END
    AND receipt.action=CASE WHEN NEW.item_type='profile' THEN 'create' ELSE 'update' END
    AND receipt.capability='family.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE NEW.privacy
      WHEN 'private' THEN 'highly_sensitive'
      WHEN 'selected_members' THEN 'sensitive'
      ELSE 'personal'
    END
    AND json_extract(receipt.record_json,'$.request.purpose')='general'
)
OR EXISTS(SELECT 1 FROM archive_items WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_versions WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_retention_policies WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_categories WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_tags WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_item_tags WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM events WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_valuations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM health_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM medication_plans WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM family_health_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM life_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM locations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM bank_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM payment_cards WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_payment_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_planning_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_import_batches WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM life_managed_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'managed life write requires an unused exact durable life policy receipt');
END;

CREATE TRIGGER trg_b5_life_record_managed_receipt_reuse_insert
BEFORE INSERT ON life_records
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM life_managed_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'life policy receipt is already bound to a managed life item');
END;
CREATE TRIGGER trg_b5_life_record_managed_receipt_reuse_update
BEFORE UPDATE ON life_records
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM life_managed_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'life policy receipt is already bound to a managed life item');
END;

CREATE TRIGGER trg_b5_life_managed_immutable
BEFORE UPDATE ON life_managed_ledger
BEGIN
  SELECT RAISE(ABORT,'managed life ledger is append-only');
END;
CREATE TRIGGER trg_b5_life_managed_delete_guard
BEFORE DELETE ON life_managed_ledger
BEGIN
  SELECT RAISE(ABORT,'managed life deletion requires a governed deletion workflow');
END;

UPDATE database_metadata
SET value='REVISION-33-E-B5-LIFE-HOME-VEHICLE-MANAGED-LEDGER',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const lifeHomeInventoryLedgerSql = `CREATE TABLE life_home_inventory_ledger(
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 2 AND 160),
  home_profile_id TEXT NOT NULL REFERENCES life_managed_ledger(id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  item_type TEXT NOT NULL CHECK(item_type IN (
    'room','meter','meter_reading','belonging','warranty','service','document'
  )),
  parent_item_id TEXT REFERENCES life_home_inventory_ledger(id) ON DELETE RESTRICT,
  supersedes_item_id TEXT REFERENCES life_home_inventory_ledger(id) ON DELETE RESTRICT,
  name TEXT CHECK(name IS NULL OR length(trim(name)) BETWEEN 1 AND 160),
  room_kind TEXT CHECK(room_kind IS NULL OR room_kind IN (
    'living_room','bedroom','kitchen','bathroom','storage','garage','garden','other'
  )),
  label TEXT CHECK(label IS NULL OR length(trim(label)) BETWEEN 1 AND 160),
  meter_kind TEXT CHECK(meter_kind IS NULL OR meter_kind IN ('electricity','water','natural_gas','other')),
  reading_unit TEXT CHECK(reading_unit IS NULL OR reading_unit IN (
    'wh','milliliter','milliliter_cubic_meter_equivalent','custom_milliunit'
  )),
  reading_milliunits INTEGER CHECK(reading_milliunits IS NULL OR (
    typeof(reading_milliunits)='integer' AND reading_milliunits BETWEEN 0 AND 9000000000000000
  )),
  reading_kind TEXT CHECK(reading_kind IS NULL OR reading_kind IN ('reading','reset','replacement')),
  belonging_kind TEXT CHECK(belonging_kind IS NULL OR belonging_kind IN (
    'appliance','electronics','furniture','tool','other'
  )),
  serial_number TEXT CHECK(serial_number IS NULL OR length(trim(serial_number)) BETWEEN 2 AND 160),
  purchased_at TEXT CHECK(purchased_at IS NULL OR (
    length(purchased_at)=24
    AND purchased_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
    AND strftime('%Y-%m-%dT%H:%M:%fZ',purchased_at) IS NOT NULL
    AND strftime('%Y-%m-%dT%H:%M:%fZ',purchased_at)=purchased_at
  )),
  starts_at TEXT CHECK(starts_at IS NULL OR (
    length(starts_at)=24
    AND starts_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
    AND strftime('%Y-%m-%dT%H:%M:%fZ',starts_at) IS NOT NULL
    AND strftime('%Y-%m-%dT%H:%M:%fZ',starts_at)=starts_at
  )),
  ends_at TEXT CHECK(ends_at IS NULL OR (
    length(ends_at)=24
    AND ends_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
    AND strftime('%Y-%m-%dT%H:%M:%fZ',ends_at) IS NOT NULL
    AND strftime('%Y-%m-%dT%H:%M:%fZ',ends_at)=ends_at
  )),
  reminder_at TEXT CHECK(reminder_at IS NULL OR (
    length(reminder_at)=24
    AND reminder_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
    AND strftime('%Y-%m-%dT%H:%M:%fZ',reminder_at) IS NOT NULL
    AND strftime('%Y-%m-%dT%H:%M:%fZ',reminder_at)=reminder_at
  )),
  target_type TEXT CHECK(target_type IS NULL OR target_type IN ('room','meter','belonging','warranty','service')),
  service_kind TEXT CHECK(service_kind IS NULL OR service_kind IN (
    'maintenance','repair','inspection','installation','other'
  )),
  occurred_at TEXT CHECK(occurred_at IS NULL OR (
    length(occurred_at)=24
    AND occurred_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
    AND strftime('%Y-%m-%dT%H:%M:%fZ',occurred_at) IS NOT NULL
    AND strftime('%Y-%m-%dT%H:%M:%fZ',occurred_at)=occurred_at
  )),
  provider TEXT CHECK(provider IS NULL OR length(trim(provider)) BETWEEN 1 AND 160),
  amount_minor INTEGER CHECK(amount_minor IS NULL OR (
    typeof(amount_minor)='integer' AND amount_minor BETWEEN 1 AND 1000000000000000
  )),
  currency TEXT CHECK(currency IS NULL OR (
    length(currency)=3 AND currency=upper(currency) AND currency GLOB '[A-Z][A-Z][A-Z]'
  )),
  finance_expense_id TEXT REFERENCES finance_planning_ledger(id) ON DELETE RESTRICT,
  archive_item_id TEXT REFERENCES archive_items(id) ON DELETE RESTRICT,
  document_kind TEXT CHECK(document_kind IS NULL OR document_kind IN (
    'invoice','warranty','service_receipt','meter_document','other'
  )),
  note TEXT CHECK(note IS NULL OR length(trim(note)) BETWEEN 1 AND 500),
  privacy TEXT NOT NULL CHECK(privacy IN ('private','selected_members','family')),
  data_source TEXT NOT NULL CHECK(data_source='manual'),
  external_verification TEXT NOT NULL CHECK(external_verification='not_performed'),
  payment_execution TEXT NOT NULL CHECK(payment_execution='not_performed'),
  created_at TEXT NOT NULL CHECK(
    length(created_at)=24
    AND created_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
    AND strftime('%Y-%m-%dT%H:%M:%fZ',created_at) IS NOT NULL
    AND strftime('%Y-%m-%dT%H:%M:%fZ',created_at)=created_at
  ),
  policy_receipt_hash TEXT NOT NULL UNIQUE REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
    length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*'
  ),
  policy_receipt_version INTEGER NOT NULL CHECK(policy_receipt_version=1),
  policy_receipt_nonce TEXT NOT NULL,
  policy_correlation_id TEXT NOT NULL,
  policy_resource_type TEXT NOT NULL CHECK(policy_resource_type='life_record'),
  policy_resource_id TEXT NOT NULL,
  policy_action TEXT NOT NULL CHECK(policy_action='update'),
  policy_capability TEXT NOT NULL CHECK(policy_capability='family.write'),
  CHECK(policy_resource_id=home_profile_id),
  CHECK((amount_minor IS NULL AND currency IS NULL) OR (amount_minor IS NOT NULL AND currency IS NOT NULL)),
  CHECK(finance_expense_id IS NULL OR (amount_minor IS NULL AND currency IS NULL)),
  CHECK(starts_at IS NULL OR ends_at IS NULL OR datetime(ends_at)>=datetime(starts_at)),
  CHECK(reminder_at IS NULL OR (
    starts_at IS NOT NULL AND ends_at IS NOT NULL
    AND datetime(reminder_at)>=datetime(starts_at)
    AND datetime(reminder_at)<=datetime(ends_at)
  )),
  CHECK(purchased_at IS NULL OR datetime(purchased_at)<=datetime(created_at)),
  CHECK(occurred_at IS NULL OR datetime(occurred_at)<=datetime(created_at)),
  CHECK(supersedes_item_id IS NULL OR supersedes_item_id<>id),
  CHECK(
    (item_type='room'
      AND parent_item_id IS NULL AND name IS NOT NULL AND room_kind IS NOT NULL
      AND label IS NULL AND meter_kind IS NULL AND reading_unit IS NULL
      AND reading_milliunits IS NULL AND reading_kind IS NULL AND belonging_kind IS NULL
      AND serial_number IS NULL AND purchased_at IS NULL
      AND starts_at IS NULL AND ends_at IS NULL AND reminder_at IS NULL AND target_type IS NULL
      AND service_kind IS NULL AND occurred_at IS NULL AND provider IS NULL
      AND amount_minor IS NULL AND currency IS NULL AND finance_expense_id IS NULL
      AND archive_item_id IS NULL AND document_kind IS NULL AND note IS NULL)
    OR
    (item_type='meter'
      AND name IS NULL AND room_kind IS NULL AND label IS NOT NULL
      AND meter_kind IS NOT NULL AND reading_unit IS NOT NULL
      AND ((meter_kind='electricity' AND reading_unit='wh')
        OR (meter_kind='water' AND reading_unit='milliliter')
        OR (meter_kind='natural_gas' AND reading_unit='milliliter_cubic_meter_equivalent')
        OR (meter_kind='other' AND reading_unit='custom_milliunit'))
      AND reading_milliunits IS NULL AND reading_kind IS NULL AND belonging_kind IS NULL
      AND serial_number IS NULL AND purchased_at IS NULL
      AND starts_at IS NULL AND ends_at IS NULL AND reminder_at IS NULL AND target_type IS NULL
      AND service_kind IS NULL AND occurred_at IS NULL
      AND provider IS NULL AND amount_minor IS NULL AND currency IS NULL AND finance_expense_id IS NULL
      AND archive_item_id IS NULL AND document_kind IS NULL AND note IS NULL)
    OR
    (item_type='meter_reading'
      AND parent_item_id IS NOT NULL AND name IS NULL AND room_kind IS NULL AND label IS NULL
      AND meter_kind IS NULL AND reading_unit IS NULL
      AND reading_milliunits IS NOT NULL AND reading_kind IS NOT NULL
      AND (reading_kind='reading' OR (reading_kind IN ('reset','replacement') AND note IS NOT NULL AND length(trim(note)) BETWEEN 2 AND 240))
      AND belonging_kind IS NULL AND serial_number IS NULL AND purchased_at IS NULL
      AND starts_at IS NULL AND ends_at IS NULL AND reminder_at IS NULL AND target_type IS NULL
      AND service_kind IS NULL AND occurred_at IS NOT NULL
      AND provider IS NULL AND amount_minor IS NULL AND currency IS NULL AND finance_expense_id IS NULL
      AND archive_item_id IS NULL AND document_kind IS NULL)
    OR
    (item_type='belonging'
      AND name IS NOT NULL AND room_kind IS NULL AND label IS NULL
      AND meter_kind IS NULL AND reading_unit IS NULL AND reading_milliunits IS NULL AND reading_kind IS NULL
      AND belonging_kind IS NOT NULL
      AND starts_at IS NULL AND ends_at IS NULL AND reminder_at IS NULL AND target_type IS NULL
      AND service_kind IS NULL AND occurred_at IS NULL AND provider IS NULL
      AND archive_item_id IS NULL AND document_kind IS NULL AND note IS NULL)
    OR
    (item_type='warranty'
      AND parent_item_id IS NOT NULL AND name IS NULL AND room_kind IS NULL AND label IS NULL
      AND meter_kind IS NULL AND reading_unit IS NULL AND reading_milliunits IS NULL AND reading_kind IS NULL
      AND belonging_kind IS NULL AND serial_number IS NULL AND purchased_at IS NULL
      AND starts_at IS NOT NULL AND ends_at IS NOT NULL AND target_type IS NULL
      AND service_kind IS NULL AND occurred_at IS NULL
      AND amount_minor IS NULL AND currency IS NULL AND finance_expense_id IS NULL
      AND archive_item_id IS NULL AND document_kind IS NULL)
    OR
    (item_type='service'
      AND parent_item_id IS NOT NULL AND name IS NULL AND room_kind IS NULL AND label IS NULL
      AND meter_kind IS NULL AND reading_unit IS NULL AND reading_milliunits IS NULL AND reading_kind IS NULL
      AND belonging_kind IS NULL AND serial_number IS NULL AND purchased_at IS NULL
      AND starts_at IS NULL AND ends_at IS NULL AND reminder_at IS NULL
      AND target_type IN ('room','meter','belonging') AND service_kind IS NOT NULL AND occurred_at IS NOT NULL
      AND archive_item_id IS NULL AND document_kind IS NULL)
    OR
    (item_type='document'
      AND parent_item_id IS NOT NULL AND name IS NULL AND room_kind IS NULL
      AND meter_kind IS NULL AND reading_unit IS NULL AND reading_milliunits IS NULL AND reading_kind IS NULL
      AND belonging_kind IS NULL AND serial_number IS NULL AND purchased_at IS NULL
      AND starts_at IS NULL AND ends_at IS NULL AND reminder_at IS NULL
      AND target_type IN ('meter','belonging','warranty','service')
      AND service_kind IS NULL AND occurred_at IS NULL
      AND provider IS NULL AND amount_minor IS NULL AND currency IS NULL AND finance_expense_id IS NULL
      AND archive_item_id IS NOT NULL AND document_kind IS NOT NULL AND note IS NULL)
  )
);

CREATE INDEX idx_life_home_inventory_profile_created
ON life_home_inventory_ledger(home_profile_id,created_at DESC,id);
CREATE INDEX idx_life_home_inventory_family_created
ON life_home_inventory_ledger(family_id,created_at DESC,id);
CREATE INDEX idx_life_home_inventory_parent_created
ON life_home_inventory_ledger(parent_item_id,created_at DESC,id)
WHERE parent_item_id IS NOT NULL;
CREATE UNIQUE INDEX idx_life_home_inventory_meter_reading
ON life_home_inventory_ledger(parent_item_id,occurred_at DESC)
WHERE item_type='meter_reading';
CREATE UNIQUE INDEX idx_life_home_inventory_supersedes
ON life_home_inventory_ledger(supersedes_item_id)
WHERE supersedes_item_id IS NOT NULL;
CREATE UNIQUE INDEX idx_life_home_inventory_archive_item
ON life_home_inventory_ledger(archive_item_id)
WHERE archive_item_id IS NOT NULL;
CREATE UNIQUE INDEX idx_life_home_inventory_finance_expense
ON life_home_inventory_ledger(finance_expense_id)
WHERE finance_expense_id IS NOT NULL;

CREATE TRIGGER trg_b5_home_inventory_root_scope
BEFORE INSERT ON life_home_inventory_ledger
WHEN NOT EXISTS(
  SELECT 1
  FROM life_managed_ledger profile
  WHERE profile.id=NEW.home_profile_id
    AND profile.item_type='profile'
    AND profile.category='home'
    AND profile.family_id=NEW.family_id
    AND profile.owner_person_id=NEW.owner_person_id
    AND profile.privacy=NEW.privacy
    AND datetime(NEW.created_at)>=datetime(profile.created_at)
    AND NOT EXISTS(
      SELECT 1 FROM data_lifecycle lifecycle
      WHERE lifecycle.resource_type='life_record'
        AND lifecycle.resource_id=profile.id
        AND lifecycle.state<>'active'
    )
)
BEGIN
  SELECT RAISE(ABORT,'home inventory item requires an active managed home profile with exact family owner and privacy');
END;

CREATE TRIGGER trg_b5_home_inventory_parent_matrix
BEFORE INSERT ON life_home_inventory_ledger
WHEN NOT (
  (NEW.item_type='room' AND NEW.parent_item_id IS NULL)
  OR (NEW.item_type IN ('meter','belonging') AND (
    NEW.parent_item_id IS NULL OR EXISTS(
      SELECT 1 FROM life_home_inventory_ledger parent
      WHERE parent.id=NEW.parent_item_id AND parent.item_type='room'
        AND parent.home_profile_id=NEW.home_profile_id
        AND parent.family_id=NEW.family_id AND parent.owner_person_id=NEW.owner_person_id
        AND parent.privacy=NEW.privacy AND datetime(NEW.created_at)>=datetime(parent.created_at)
    )
  ))
  OR (NEW.item_type='meter_reading' AND EXISTS(
    SELECT 1 FROM life_home_inventory_ledger parent
    WHERE parent.id=NEW.parent_item_id AND parent.item_type='meter'
      AND parent.home_profile_id=NEW.home_profile_id
      AND parent.family_id=NEW.family_id AND parent.owner_person_id=NEW.owner_person_id
      AND parent.privacy=NEW.privacy AND datetime(NEW.created_at)>=datetime(parent.created_at)
  ))
  OR (NEW.item_type='warranty' AND EXISTS(
    SELECT 1 FROM life_home_inventory_ledger parent
    WHERE parent.id=NEW.parent_item_id AND parent.item_type='belonging'
      AND parent.home_profile_id=NEW.home_profile_id
      AND parent.family_id=NEW.family_id AND parent.owner_person_id=NEW.owner_person_id
      AND parent.privacy=NEW.privacy AND datetime(NEW.created_at)>=datetime(parent.created_at)
  ))
  OR (NEW.item_type='service' AND EXISTS(
    SELECT 1 FROM life_home_inventory_ledger parent
    WHERE parent.id=NEW.parent_item_id AND parent.item_type IN ('room','meter','belonging')
      AND NEW.target_type=parent.item_type
      AND parent.home_profile_id=NEW.home_profile_id
      AND parent.family_id=NEW.family_id AND parent.owner_person_id=NEW.owner_person_id
      AND parent.privacy=NEW.privacy AND datetime(NEW.created_at)>=datetime(parent.created_at)
  ))
  OR (NEW.item_type='document' AND EXISTS(
    SELECT 1 FROM life_home_inventory_ledger parent
    WHERE parent.id=NEW.parent_item_id AND parent.item_type IN ('meter','belonging','warranty','service')
      AND NEW.target_type=parent.item_type
      AND parent.home_profile_id=NEW.home_profile_id
      AND parent.family_id=NEW.family_id AND parent.owner_person_id=NEW.owner_person_id
      AND parent.privacy=NEW.privacy AND datetime(NEW.created_at)>=datetime(parent.created_at)
  ))
)
BEGIN
  SELECT RAISE(ABORT,'home inventory item requires an exact compatible parent in the same root scope');
END;

CREATE TRIGGER trg_b5_home_inventory_supersession_scope
BEFORE INSERT ON life_home_inventory_ledger
WHEN NEW.supersedes_item_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM life_home_inventory_ledger prior
  WHERE prior.id=NEW.supersedes_item_id
    AND prior.item_type=NEW.item_type
    AND prior.home_profile_id=NEW.home_profile_id
    AND prior.family_id=NEW.family_id
    AND prior.owner_person_id=NEW.owner_person_id
    AND prior.privacy=NEW.privacy
    AND datetime(NEW.created_at)>datetime(prior.created_at)
)
BEGIN
  SELECT RAISE(ABORT,'home inventory supersession requires an older item of the same type and root scope');
END;

CREATE TRIGGER trg_b5_home_inventory_meter_monotonic
BEFORE INSERT ON life_home_inventory_ledger
WHEN NEW.item_type='meter_reading' AND EXISTS(
  SELECT 1
  FROM life_home_inventory_ledger prior
  WHERE prior.item_type='meter_reading'
    AND prior.parent_item_id=NEW.parent_item_id
    AND prior.home_profile_id=NEW.home_profile_id
    AND (
      datetime(NEW.occurred_at)<=datetime(prior.occurred_at)
      OR (
        NEW.reading_kind='reading'
        AND prior.id=(
          SELECT latest.id FROM life_home_inventory_ledger latest
          WHERE latest.item_type='meter_reading'
            AND latest.parent_item_id=NEW.parent_item_id
            AND latest.home_profile_id=NEW.home_profile_id
          ORDER BY latest.occurred_at DESC,latest.created_at DESC,latest.id DESC LIMIT 1
        )
        AND NEW.reading_milliunits<prior.reading_milliunits
      )
    )
)
BEGIN
  SELECT RAISE(ABORT,'home meter readings must be chronological and monotonic unless reset or replacement is explicit');
END;

CREATE TRIGGER trg_b5_home_inventory_external_link_scope
BEFORE INSERT ON life_home_inventory_ledger
WHEN (
  NEW.archive_item_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM archive_items archive
    WHERE archive.id=NEW.archive_item_id
      AND archive.family_id=NEW.family_id
      AND archive.destroyed_at IS NULL
      AND archive.sensitivity=CASE NEW.privacy
        WHEN 'private' THEN 'high'
        WHEN 'selected_members' THEN 'personal'
        ELSE 'standard'
      END
      AND datetime(archive.created_at)<=datetime(NEW.created_at)
  )
) OR (
  NEW.finance_expense_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM finance_planning_ledger expense
    WHERE expense.id=NEW.finance_expense_id
      AND expense.item_type='cash_flow'
      AND expense.category_kind='expense'
      AND expense.family_id=NEW.family_id
      AND expense.owner_person_id=NEW.owner_person_id
      AND expense.privacy=NEW.privacy
      AND datetime(expense.created_at)<=datetime(NEW.created_at)
  )
)
BEGIN
  SELECT RAISE(ABORT,'home inventory archive or finance link is outside exact scope');
END;

CREATE TRIGGER trg_b5_home_inventory_id_collision
BEFORE INSERT ON life_home_inventory_ledger
WHEN EXISTS(SELECT 1 FROM life_records WHERE id=NEW.id)
  OR EXISTS(SELECT 1 FROM life_managed_ledger WHERE id=NEW.id)
BEGIN
  SELECT RAISE(ABORT,'home inventory id collides with another life record');
END;

CREATE TRIGGER trg_b5_life_record_home_inventory_id_collision
BEFORE INSERT ON life_records
WHEN EXISTS(SELECT 1 FROM life_home_inventory_ledger WHERE id=NEW.id)
BEGIN
  SELECT RAISE(ABORT,'life record id collides with a home inventory item');
END;

CREATE TRIGGER trg_b5_life_managed_home_inventory_id_collision
BEFORE INSERT ON life_managed_ledger
WHEN EXISTS(SELECT 1 FROM life_home_inventory_ledger WHERE id=NEW.id)
BEGIN
  SELECT RAISE(ABORT,'managed life id collides with a home inventory item');
END;

CREATE TRIGGER trg_b5_home_inventory_policy_receipt
BEFORE INSERT ON life_home_inventory_ledger
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='life_record'
    AND receipt.resource_id=NEW.home_profile_id
    AND receipt.action='update'
    AND receipt.capability='family.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE NEW.privacy
      WHEN 'private' THEN 'highly_sensitive'
      WHEN 'selected_members' THEN 'sensitive'
      ELSE 'personal'
    END
    AND json_extract(receipt.record_json,'$.request.purpose')='general'
)
OR EXISTS(SELECT 1 FROM archive_items WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_versions WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_retention_policies WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_categories WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_tags WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_item_tags WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM events WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_valuations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM health_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM medication_plans WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM family_health_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM life_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM locations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM bank_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM payment_cards WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_payment_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_planning_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_import_batches WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM life_managed_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM life_home_inventory_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'home inventory write requires an unused exact durable life update receipt');
END;

CREATE TRIGGER trg_b5_life_record_home_inventory_receipt_reuse_insert
BEFORE INSERT ON life_records
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM life_home_inventory_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'life policy receipt is already bound to a home inventory item');
END;
CREATE TRIGGER trg_b5_life_record_home_inventory_receipt_reuse_update
BEFORE UPDATE ON life_records
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM life_home_inventory_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'life policy receipt is already bound to a home inventory item');
END;
CREATE TRIGGER trg_b5_life_managed_home_inventory_receipt_reuse
BEFORE INSERT ON life_managed_ledger
WHEN EXISTS(SELECT 1 FROM life_home_inventory_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'life policy receipt is already bound to a home inventory item');
END;

CREATE TRIGGER trg_b5_home_inventory_immutable
BEFORE UPDATE ON life_home_inventory_ledger
BEGIN
  SELECT RAISE(ABORT,'home inventory ledger is append-only');
END;
CREATE TRIGGER trg_b5_home_inventory_delete_guard
BEFORE DELETE ON life_home_inventory_ledger
BEGIN
  SELECT RAISE(ABORT,'home inventory deletion requires a governed deletion workflow');
END;

UPDATE database_metadata
SET value='REVISION-33-F-HOME-INVENTORY-UTILITY-BELONGINGS',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const familyEmergencyPlanningLedgerSql = `CREATE TABLE family_emergency_ledger(
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 2 AND 160),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  item_type TEXT NOT NULL CHECK(item_type IN (
    'emergency_plan','meeting_point','external_contact','checklist_item','checklist_status','member_status'
  )),
  plan_id TEXT REFERENCES family_emergency_ledger(id) ON DELETE RESTRICT,
  parent_item_id TEXT REFERENCES family_emergency_ledger(id) ON DELETE RESTRICT,
  supersedes_item_id TEXT REFERENCES family_emergency_ledger(id) ON DELETE RESTRICT,
  plan_kind TEXT CHECK(plan_kind IS NULL OR plan_kind IN ('general','earthquake','fire','flood','evacuation','other')),
  title TEXT CHECK(title IS NULL OR length(trim(title)) BETWEEN 2 AND 120),
  evacuation_instructions TEXT CHECK(
    evacuation_instructions IS NULL OR length(trim(evacuation_instructions)) BETWEEN 2 AND 2000
  ),
  meeting_point_kind TEXT CHECK(
    meeting_point_kind IS NULL OR meeting_point_kind IN ('primary','alternate')
  ),
  label TEXT CHECK(label IS NULL OR length(trim(label)) BETWEEN 2 AND 240),
  address TEXT CHECK(address IS NULL OR length(trim(address)) BETWEEN 2 AND 300),
  directions TEXT CHECK(directions IS NULL OR length(trim(directions)) BETWEEN 2 AND 500),
  contact_name TEXT CHECK(contact_name IS NULL OR length(trim(contact_name)) BETWEEN 2 AND 120),
  phone_e164 TEXT CHECK(phone_e164 IS NULL OR (
    length(phone_e164) BETWEEN 9 AND 16
    AND substr(phone_e164,1,1)='+'
    AND substr(phone_e164,2,1) GLOB '[1-9]'
    AND substr(phone_e164,2) NOT GLOB '*[^0-9]*'
  )),
  city TEXT CHECK(city IS NULL OR length(trim(city)) BETWEEN 2 AND 120),
  sort_order INTEGER CHECK(sort_order IS NULL OR (
    typeof(sort_order)='integer' AND sort_order BETWEEN 0 AND 10000
  )),
  checklist_status TEXT CHECK(checklist_status IS NULL OR checklist_status IN ('open','completed')),
  member_person_id TEXT REFERENCES people(id) ON DELETE RESTRICT,
  reported_by_person_id TEXT REFERENCES people(id) ON DELETE RESTRICT,
  member_status TEXT CHECK(member_status IS NULL OR member_status IN ('safe','needs_help')),
  occurred_at TEXT CHECK(occurred_at IS NULL OR (
    length(occurred_at)=24
    AND occurred_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
    AND strftime('%Y-%m-%dT%H:%M:%fZ',occurred_at) IS NOT NULL
    AND strftime('%Y-%m-%dT%H:%M:%fZ',occurred_at)=occurred_at
  )),
  note TEXT CHECK(note IS NULL OR length(trim(note)) BETWEEN 2 AND 500),
  privacy TEXT NOT NULL CHECK(privacy='family'),
  data_source TEXT NOT NULL CHECK(data_source='manual'),
  created_at TEXT NOT NULL CHECK(
    length(created_at)=24
    AND created_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
    AND strftime('%Y-%m-%dT%H:%M:%fZ',created_at) IS NOT NULL
    AND strftime('%Y-%m-%dT%H:%M:%fZ',created_at)=created_at
  ),
  policy_receipt_hash TEXT NOT NULL UNIQUE REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
    length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*'
  ),
  policy_receipt_version INTEGER NOT NULL CHECK(policy_receipt_version=1),
  policy_receipt_nonce TEXT NOT NULL,
  policy_correlation_id TEXT NOT NULL,
  policy_resource_type TEXT NOT NULL CHECK(policy_resource_type='life_record'),
  policy_resource_id TEXT NOT NULL,
  policy_action TEXT NOT NULL CHECK(policy_action IN ('create','update')),
  policy_capability TEXT NOT NULL CHECK(policy_capability='family.write'),
  CHECK(supersedes_item_id IS NULL OR supersedes_item_id<>id),
  CHECK(occurred_at IS NULL OR occurred_at<=created_at),
  CHECK(
    (item_type='emergency_plan'
      AND plan_id IS NULL AND parent_item_id IS NULL AND supersedes_item_id IS NULL
      AND plan_kind IS NOT NULL AND title IS NOT NULL AND evacuation_instructions IS NOT NULL
      AND meeting_point_kind IS NULL AND label IS NULL AND address IS NULL AND directions IS NULL
      AND contact_name IS NULL AND phone_e164 IS NULL AND city IS NULL AND sort_order IS NULL
      AND checklist_status IS NULL AND member_person_id IS NULL AND reported_by_person_id IS NULL
      AND member_status IS NULL AND occurred_at IS NULL AND note IS NULL
      AND policy_action='create' AND policy_resource_id=id)
    OR
    (item_type='meeting_point'
      AND plan_id IS NOT NULL AND parent_item_id IS NULL
      AND plan_kind IS NULL AND title IS NULL AND evacuation_instructions IS NULL
      AND meeting_point_kind IS NOT NULL AND label IS NOT NULL
      AND contact_name IS NULL AND phone_e164 IS NULL AND city IS NULL AND sort_order IS NULL
      AND checklist_status IS NULL AND member_person_id IS NULL AND reported_by_person_id IS NULL
      AND member_status IS NULL AND occurred_at IS NULL AND note IS NULL
      AND policy_action='update' AND policy_resource_id=plan_id)
    OR
    (item_type='external_contact'
      AND plan_id IS NOT NULL AND parent_item_id IS NULL
      AND plan_kind IS NULL AND title IS NULL AND evacuation_instructions IS NULL
      AND meeting_point_kind IS NULL AND label IS NULL AND address IS NULL AND directions IS NULL
      AND contact_name IS NOT NULL AND phone_e164 IS NOT NULL AND city IS NOT NULL AND sort_order IS NULL
      AND checklist_status IS NULL AND member_person_id IS NULL AND reported_by_person_id IS NULL
      AND member_status IS NULL AND occurred_at IS NULL
      AND policy_action='update' AND policy_resource_id=plan_id)
    OR
    (item_type='checklist_item'
      AND plan_id IS NOT NULL AND parent_item_id IS NULL
      AND plan_kind IS NULL AND title IS NULL AND evacuation_instructions IS NULL
      AND meeting_point_kind IS NULL AND label IS NOT NULL AND address IS NULL AND directions IS NULL
      AND contact_name IS NULL AND phone_e164 IS NULL AND city IS NULL AND sort_order IS NOT NULL
      AND checklist_status IS NULL AND member_person_id IS NULL AND reported_by_person_id IS NULL
      AND member_status IS NULL AND occurred_at IS NULL AND note IS NULL
      AND policy_action='update' AND policy_resource_id=plan_id)
    OR
    (item_type='checklist_status'
      AND plan_id IS NOT NULL AND parent_item_id IS NOT NULL AND supersedes_item_id IS NULL
      AND plan_kind IS NULL AND title IS NULL AND evacuation_instructions IS NULL
      AND meeting_point_kind IS NULL AND label IS NULL AND address IS NULL AND directions IS NULL
      AND contact_name IS NULL AND phone_e164 IS NULL AND city IS NULL AND sort_order IS NULL
      AND checklist_status IS NOT NULL AND member_person_id IS NULL AND reported_by_person_id IS NULL
      AND member_status IS NULL AND occurred_at IS NULL AND note IS NULL
      AND policy_action='update' AND policy_resource_id=plan_id)
    OR
    (item_type='member_status'
      AND plan_id IS NOT NULL AND parent_item_id IS NULL AND supersedes_item_id IS NULL
      AND plan_kind IS NULL AND title IS NULL AND evacuation_instructions IS NULL
      AND meeting_point_kind IS NULL AND label IS NULL AND address IS NULL AND directions IS NULL
      AND contact_name IS NULL AND phone_e164 IS NULL AND city IS NULL AND sort_order IS NULL
      AND checklist_status IS NULL AND member_person_id IS NOT NULL AND reported_by_person_id IS NOT NULL
      AND owner_person_id=member_person_id AND member_status IS NOT NULL AND occurred_at IS NOT NULL
      AND policy_action='create' AND policy_resource_id=id)
  )
) STRICT;

CREATE INDEX idx_family_emergency_family_created
ON family_emergency_ledger(family_id,created_at DESC,id);
CREATE INDEX idx_family_emergency_plan_created
ON family_emergency_ledger(plan_id,created_at DESC,id)
WHERE plan_id IS NOT NULL;
CREATE INDEX idx_family_emergency_plan_kind
ON family_emergency_ledger(family_id,plan_kind,created_at DESC,id)
WHERE item_type='emergency_plan';
CREATE INDEX idx_family_emergency_checklist_status
ON family_emergency_ledger(parent_item_id,created_at DESC,id)
WHERE item_type='checklist_status';
CREATE INDEX idx_family_emergency_member_status
ON family_emergency_ledger(plan_id,member_person_id,occurred_at DESC,created_at DESC,id)
WHERE item_type='member_status';
CREATE UNIQUE INDEX idx_family_emergency_supersedes
ON family_emergency_ledger(supersedes_item_id)
WHERE supersedes_item_id IS NOT NULL;
CREATE UNIQUE INDEX idx_family_emergency_checklist_status_time
ON family_emergency_ledger(parent_item_id,created_at)
WHERE item_type='checklist_status';
CREATE UNIQUE INDEX idx_family_emergency_member_status_time
ON family_emergency_ledger(plan_id,member_person_id,occurred_at)
WHERE item_type='member_status';

CREATE TRIGGER trg_b5_family_emergency_root_owner
BEFORE INSERT ON family_emergency_ledger
WHEN NEW.item_type='emergency_plan' AND NOT EXISTS(
  SELECT 1 FROM people owner
  WHERE owner.id=NEW.owner_person_id
    AND owner.family_id=NEW.family_id
    AND owner.status='active'
)
BEGIN
  SELECT RAISE(ABORT,'family emergency plan requires an active owner in the exact family');
END;

CREATE TRIGGER trg_b5_family_emergency_plan_scope
BEFORE INSERT ON family_emergency_ledger
WHEN NEW.item_type<>'emergency_plan' AND NOT EXISTS(
  SELECT 1
  FROM family_emergency_ledger plan
  WHERE plan.id=NEW.plan_id
    AND plan.item_type='emergency_plan'
    AND plan.family_id=NEW.family_id
    AND plan.privacy=NEW.privacy
    AND NEW.created_at>=plan.created_at
    AND (NEW.item_type='member_status' OR NEW.owner_person_id=plan.owner_person_id)
    AND EXISTS(
      SELECT 1 FROM people coordinator
      WHERE coordinator.id=plan.owner_person_id
        AND coordinator.family_id=plan.family_id
        AND coordinator.status='active'
    )
    AND NOT EXISTS(
      SELECT 1 FROM data_lifecycle lifecycle
      WHERE lifecycle.resource_type='life_record'
        AND lifecycle.resource_id=plan.id
        AND lifecycle.state<>'active'
    )
)
BEGIN
  SELECT RAISE(ABORT,'family emergency child requires an active exact-family plan root and inherited owner/privacy');
END;

CREATE TRIGGER trg_b5_family_emergency_member_scope
BEFORE INSERT ON family_emergency_ledger
WHEN NEW.item_type='member_status' AND (
  NOT EXISTS(
    SELECT 1 FROM people member
    WHERE member.id=NEW.member_person_id
      AND member.family_id=NEW.family_id
      AND member.status='active'
  )
  OR NOT EXISTS(
    SELECT 1 FROM people reporter
    WHERE reporter.id=NEW.reported_by_person_id
      AND reporter.family_id=NEW.family_id
      AND reporter.status='active'
  )
)
BEGIN
  SELECT RAISE(ABORT,'family emergency status requires active member and reporter in the exact family');
END;

CREATE TRIGGER trg_b5_family_emergency_parent_matrix
BEFORE INSERT ON family_emergency_ledger
WHEN NEW.item_type='checklist_status' AND NOT EXISTS(
  SELECT 1
  FROM family_emergency_ledger checklist
  WHERE checklist.id=NEW.parent_item_id
    AND checklist.item_type='checklist_item'
    AND checklist.plan_id=NEW.plan_id
    AND checklist.family_id=NEW.family_id
    AND checklist.owner_person_id=NEW.owner_person_id
    AND checklist.privacy=NEW.privacy
    AND NEW.created_at>checklist.created_at
    AND NOT EXISTS(
      SELECT 1 FROM family_emergency_ledger correction
      WHERE correction.supersedes_item_id=checklist.id
    )
)
BEGIN
  SELECT RAISE(ABORT,'family emergency checklist status requires the current checklist item in the exact root scope');
END;

CREATE TRIGGER trg_b5_family_emergency_supersession_scope
BEFORE INSERT ON family_emergency_ledger
WHEN NEW.supersedes_item_id IS NOT NULL AND (
  NEW.item_type NOT IN ('meeting_point','external_contact','checklist_item')
  OR NOT EXISTS(
    SELECT 1 FROM family_emergency_ledger prior
    WHERE prior.id=NEW.supersedes_item_id
      AND prior.item_type=NEW.item_type
      AND prior.plan_id=NEW.plan_id
      AND prior.family_id=NEW.family_id
      AND prior.owner_person_id=NEW.owner_person_id
      AND prior.privacy=NEW.privacy
      AND NEW.created_at>prior.created_at
  )
)
BEGIN
  SELECT RAISE(ABORT,'family emergency correction requires an older item of the same type and exact root scope');
END;

CREATE TRIGGER trg_b5_family_emergency_event_chronology
BEFORE INSERT ON family_emergency_ledger
WHEN (
  NEW.item_type='checklist_status' AND EXISTS(
    SELECT 1 FROM family_emergency_ledger prior
    WHERE prior.item_type='checklist_status'
      AND prior.parent_item_id=NEW.parent_item_id
      AND prior.created_at>=NEW.created_at
  )
) OR (
  NEW.item_type='member_status' AND (
    EXISTS(
      SELECT 1 FROM family_emergency_ledger plan
      WHERE plan.id=NEW.plan_id AND NEW.occurred_at<plan.created_at
    )
    OR EXISTS(
      SELECT 1 FROM family_emergency_ledger prior
      WHERE prior.item_type='member_status'
        AND prior.plan_id=NEW.plan_id
        AND prior.member_person_id=NEW.member_person_id
        AND prior.occurred_at>=NEW.occurred_at
    )
  )
)
BEGIN
  SELECT RAISE(ABORT,'family emergency status events must be strictly chronological in their exact scope');
END;

CREATE TRIGGER trg_b5_family_emergency_id_collision
BEFORE INSERT ON family_emergency_ledger
WHEN EXISTS(SELECT 1 FROM life_records WHERE id=NEW.id)
  OR EXISTS(SELECT 1 FROM life_managed_ledger WHERE id=NEW.id)
  OR EXISTS(SELECT 1 FROM life_home_inventory_ledger WHERE id=NEW.id)
BEGIN
  SELECT RAISE(ABORT,'family emergency id collides with another life ledger');
END;

CREATE TRIGGER trg_b5_life_record_emergency_id_collision
BEFORE INSERT ON life_records
WHEN EXISTS(SELECT 1 FROM family_emergency_ledger WHERE id=NEW.id)
BEGIN
  SELECT RAISE(ABORT,'life record id collides with a family emergency item');
END;
CREATE TRIGGER trg_b5_life_managed_emergency_id_collision
BEFORE INSERT ON life_managed_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_ledger WHERE id=NEW.id)
BEGIN
  SELECT RAISE(ABORT,'managed life id collides with a family emergency item');
END;
CREATE TRIGGER trg_b5_home_inventory_emergency_id_collision
BEFORE INSERT ON life_home_inventory_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_ledger WHERE id=NEW.id)
BEGIN
  SELECT RAISE(ABORT,'home inventory id collides with a family emergency item');
END;

CREATE TRIGGER trg_b5_family_emergency_policy_receipt
BEFORE INSERT ON family_emergency_ledger
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection
    ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
  JOIN accounts actor_account
    ON actor_account.id=json_extract(receipt.record_json,'$.request.subject.accountId')
      AND actor_account.status='active'
  JOIN people actor_person
    ON actor_person.id=json_extract(receipt.record_json,'$.request.subject.personId')
      AND actor_person.id=actor_account.person_id
      AND actor_person.family_id=NEW.family_id
      AND actor_person.status='active'
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='life_record'
    AND receipt.resource_id=CASE
      WHEN NEW.item_type IN ('emergency_plan','member_status') THEN NEW.id
      ELSE NEW.plan_id
    END
    AND receipt.action=CASE
      WHEN NEW.item_type IN ('emergency_plan','member_status') THEN 'create'
      ELSE 'update'
    END
    AND receipt.capability='family.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=CASE
      WHEN NEW.item_type='member_status' THEN NEW.member_person_id
      ELSE NEW.owner_person_id
    END
    AND json_extract(receipt.record_json,'$.request.resource.sensitivity')='personal'
    AND json_extract(receipt.record_json,'$.request.purpose')='general'
    AND json_extract(receipt.record_json,'$.request.occurredAt')=NEW.created_at
    AND (NEW.item_type<>'emergency_plan' OR actor_person.id=NEW.owner_person_id)
    AND (NEW.item_type<>'member_status' OR actor_person.id=NEW.reported_by_person_id)
)
OR EXISTS(SELECT 1 FROM archive_items WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_versions WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_retention_policies WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_categories WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_tags WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_item_tags WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM events WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_valuations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM health_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM medication_plans WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM family_health_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM life_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM locations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM bank_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM payment_cards WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_payment_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_planning_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_import_batches WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM life_managed_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM life_home_inventory_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM events WHERE timeline_policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'family emergency write requires an unused exact durable life receipt');
END;

CREATE TRIGGER trg_b5_life_record_emergency_receipt_reuse_insert
BEFORE INSERT ON life_records
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'life policy receipt is already bound to a family emergency item');
END;
CREATE TRIGGER trg_b5_life_record_emergency_receipt_reuse_update
BEFORE UPDATE ON life_records
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'life policy receipt is already bound to a family emergency item');
END;
CREATE TRIGGER trg_b5_life_managed_emergency_receipt_reuse
BEFORE INSERT ON life_managed_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'managed life receipt is already bound to a family emergency item');
END;
CREATE TRIGGER trg_b5_home_inventory_emergency_receipt_reuse
BEFORE INSERT ON life_home_inventory_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN
  SELECT RAISE(ABORT,'home inventory receipt is already bound to a family emergency item');
END;

CREATE TRIGGER trg_b5_archive_item_emergency_receipt_reuse
BEFORE INSERT ON archive_items
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_archive_item_emergency_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_items
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_archive_version_emergency_receipt_reuse
BEFORE INSERT ON archive_versions
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_archive_version_emergency_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_versions
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_archive_retention_emergency_receipt_reuse
BEFORE INSERT ON archive_retention_policies
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_archive_retention_emergency_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_retention_policies
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_archive_category_emergency_receipt_reuse
BEFORE INSERT ON archive_categories
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_archive_category_emergency_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_categories
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_archive_tag_emergency_receipt_reuse
BEFORE INSERT ON archive_tags
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_archive_tag_emergency_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_tags
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_archive_item_tag_emergency_receipt_reuse
BEFORE INSERT ON archive_item_tags
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_archive_item_tag_emergency_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_item_tags
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_event_emergency_receipt_reuse
BEFORE INSERT ON events
WHEN (NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
    SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
  )) OR (NEW.timeline_policy_receipt_hash IS NOT NULL AND EXISTS(
    SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.timeline_policy_receipt_hash
  ))
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_event_emergency_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash,timeline_policy_receipt_hash ON events
WHEN (NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
    SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
  )) OR (NEW.timeline_policy_receipt_hash IS NOT NULL AND EXISTS(
    SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.timeline_policy_receipt_hash
  ))
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_finance_record_emergency_receipt_reuse
BEFORE INSERT ON finance_records
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_finance_record_emergency_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON finance_records
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_finance_valuation_emergency_receipt_reuse
BEFORE INSERT ON finance_valuations
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_finance_valuation_emergency_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON finance_valuations
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_health_record_emergency_receipt_reuse
BEFORE INSERT ON health_records
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_health_record_emergency_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON health_records
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_medication_plan_emergency_receipt_reuse
BEFORE INSERT ON medication_plans
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_medication_plan_emergency_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON medication_plans
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_family_health_history_emergency_receipt_reuse
BEFORE INSERT ON family_health_history
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_family_health_history_emergency_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON family_health_history
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_location_emergency_receipt_reuse
BEFORE INSERT ON locations
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_location_emergency_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON locations
WHEN NEW.policy_receipt_hash IS NOT NULL
  AND EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_bank_account_emergency_receipt_reuse
BEFORE INSERT ON bank_accounts
WHEN EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_payment_card_emergency_receipt_reuse
BEFORE INSERT ON payment_cards
WHEN EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_loan_account_emergency_receipt_reuse
BEFORE INSERT ON loan_accounts
WHEN EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_loan_payment_emergency_receipt_reuse
BEFORE INSERT ON loan_payment_history
WHEN EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_finance_planning_emergency_receipt_reuse
BEFORE INSERT ON finance_planning_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;
CREATE TRIGGER trg_b5_finance_import_emergency_receipt_reuse
BEFORE INSERT ON finance_import_batches
WHEN EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to a family emergency item'); END;

CREATE TRIGGER trg_b5_family_emergency_immutable
BEFORE UPDATE ON family_emergency_ledger
BEGIN
  SELECT RAISE(ABORT,'family emergency ledger is append-only');
END;
CREATE TRIGGER trg_b5_family_emergency_delete_guard
BEFORE DELETE ON family_emergency_ledger
BEGIN
  SELECT RAISE(ABORT,'family emergency deletion requires a governed deletion workflow');
END;

UPDATE database_metadata
SET value='REVISION-33-G-B5-FAMILY-EMERGENCY-PLANNING',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const familyEmergencyPreparednessLedgerSql = `CREATE TABLE family_emergency_preparedness_ledger(
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 2 AND 160),
  plan_id TEXT NOT NULL REFERENCES family_emergency_ledger(id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  item_type TEXT NOT NULL CHECK(item_type IN (
    'preparedness_kit','preparedness_kit_item','preparedness_kit_check','emergency_drill'
  )),
  parent_item_id TEXT REFERENCES family_emergency_preparedness_ledger(id) ON DELETE RESTRICT,
  supersedes_item_id TEXT REFERENCES family_emergency_preparedness_ledger(id) ON DELETE RESTRICT,
  kit_kind TEXT CHECK(
    kit_kind IS NULL OR kit_kind IN ('household_72_hour','vehicle','workplace','other')
  ),
  category TEXT CHECK(category IS NULL OR category IN (
    'water','food','first_aid','hygiene','lighting_power','communication',
    'clothing_shelter','document_copy','tool','other'
  )),
  label TEXT CHECK(label IS NULL OR length(trim(label)) BETWEEN 2 AND 160),
  target_quantity_milliunits INTEGER CHECK(target_quantity_milliunits IS NULL OR (
    typeof(target_quantity_milliunits)='integer'
    AND target_quantity_milliunits BETWEEN 1 AND 9000000000000000
  )),
  quantity_unit TEXT CHECK(
    quantity_unit IS NULL OR quantity_unit IN ('item','liter','kilogram','dose','meter','other')
  ),
  expires_on TEXT CHECK(expires_on IS NULL OR (
    length(expires_on)=10
    AND expires_on GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
    AND strftime('%Y-%m-%d',expires_on || 'T00:00:00.000Z','+0 days')=expires_on
  )),
  check_status TEXT CHECK(
    check_status IS NULL OR check_status IN ('ready','low','missing','expired','replace')
  ),
  actual_quantity_milliunits INTEGER CHECK(actual_quantity_milliunits IS NULL OR (
    typeof(actual_quantity_milliunits)='integer'
    AND actual_quantity_milliunits BETWEEN 0 AND 9000000000000000
  )),
  checked_at TEXT CHECK(checked_at IS NULL OR (
    length(checked_at)=24
    AND checked_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
    AND strftime('%Y-%m-%dT%H:%M:%fZ',checked_at) IS NOT NULL
    AND strftime('%Y-%m-%dT%H:%M:%fZ',checked_at)=checked_at
  )),
  drill_kind TEXT CHECK(
    drill_kind IS NULL OR drill_kind IN ('earthquake','fire','flood','power_outage')
  ),
  drill_status TEXT CHECK(
    drill_status IS NULL OR drill_status IN ('completed','partial','cancelled')
  ),
  occurred_at TEXT CHECK(occurred_at IS NULL OR (
    length(occurred_at)=24
    AND occurred_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
    AND strftime('%Y-%m-%dT%H:%M:%fZ',occurred_at) IS NOT NULL
    AND strftime('%Y-%m-%dT%H:%M:%fZ',occurred_at)=occurred_at
  )),
  duration_seconds INTEGER CHECK(duration_seconds IS NULL OR (
    typeof(duration_seconds)='integer' AND duration_seconds BETWEEN 1 AND 604800
  )),
  note TEXT CHECK(note IS NULL OR length(trim(note)) BETWEEN 2 AND 500),
  privacy TEXT NOT NULL CHECK(privacy='family'),
  data_source TEXT NOT NULL CHECK(data_source='manual'),
  created_at TEXT NOT NULL CHECK(
    length(created_at)=24
    AND created_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
    AND strftime('%Y-%m-%dT%H:%M:%fZ',created_at) IS NOT NULL
    AND strftime('%Y-%m-%dT%H:%M:%fZ',created_at)=created_at
  ),
  policy_receipt_hash TEXT NOT NULL UNIQUE REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
    length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*'
  ),
  policy_receipt_version INTEGER NOT NULL CHECK(policy_receipt_version=1),
  policy_receipt_nonce TEXT NOT NULL,
  policy_correlation_id TEXT NOT NULL,
  policy_resource_type TEXT NOT NULL CHECK(policy_resource_type='life_record'),
  policy_resource_id TEXT NOT NULL,
  policy_action TEXT NOT NULL CHECK(policy_action='update'),
  policy_capability TEXT NOT NULL CHECK(policy_capability='family.write'),
  CHECK(supersedes_item_id IS NULL OR supersedes_item_id<>id),
  CHECK(checked_at IS NULL OR checked_at<=created_at),
  CHECK(occurred_at IS NULL OR occurred_at<=created_at),
  CHECK(policy_resource_id=plan_id),
  CHECK(
    (item_type='preparedness_kit'
      AND parent_item_id IS NULL
      AND kit_kind IS NOT NULL AND label IS NOT NULL AND length(trim(label))<=120
      AND category IS NULL AND target_quantity_milliunits IS NULL AND quantity_unit IS NULL
      AND expires_on IS NULL AND check_status IS NULL AND actual_quantity_milliunits IS NULL
      AND checked_at IS NULL AND drill_kind IS NULL AND drill_status IS NULL
      AND occurred_at IS NULL AND duration_seconds IS NULL AND note IS NULL)
    OR
    (item_type='preparedness_kit_item'
      AND parent_item_id IS NOT NULL
      AND kit_kind IS NULL AND category IS NOT NULL AND label IS NOT NULL
      AND target_quantity_milliunits IS NOT NULL AND quantity_unit IS NOT NULL
      AND check_status IS NULL AND actual_quantity_milliunits IS NULL AND checked_at IS NULL
      AND drill_kind IS NULL AND drill_status IS NULL AND occurred_at IS NULL
      AND duration_seconds IS NULL AND note IS NULL)
    OR
    (item_type='preparedness_kit_check'
      AND parent_item_id IS NOT NULL AND supersedes_item_id IS NULL
      AND kit_kind IS NULL AND category IS NULL AND label IS NULL
      AND target_quantity_milliunits IS NULL AND quantity_unit IS NULL AND expires_on IS NULL
      AND check_status IS NOT NULL AND actual_quantity_milliunits IS NOT NULL
      AND checked_at IS NOT NULL AND drill_kind IS NULL AND drill_status IS NULL
      AND occurred_at IS NULL AND duration_seconds IS NULL)
    OR
    (item_type='emergency_drill'
      AND parent_item_id IS NULL
      AND kit_kind IS NULL AND category IS NULL AND label IS NULL
      AND target_quantity_milliunits IS NULL AND quantity_unit IS NULL AND expires_on IS NULL
      AND check_status IS NULL AND actual_quantity_milliunits IS NULL AND checked_at IS NULL
      AND drill_kind IS NOT NULL AND drill_status IS NOT NULL AND occurred_at IS NOT NULL)
  )
) STRICT;

CREATE INDEX idx_family_emergency_preparedness_plan_created
ON family_emergency_preparedness_ledger(plan_id,created_at DESC,id);
CREATE INDEX idx_family_emergency_preparedness_family_created
ON family_emergency_preparedness_ledger(family_id,created_at DESC,id);
CREATE INDEX idx_family_emergency_preparedness_parent_created
ON family_emergency_preparedness_ledger(parent_item_id,created_at DESC,id)
WHERE parent_item_id IS NOT NULL;
CREATE INDEX idx_family_emergency_preparedness_checks
ON family_emergency_preparedness_ledger(parent_item_id,checked_at DESC,created_at DESC,id)
WHERE item_type='preparedness_kit_check';
CREATE INDEX idx_family_emergency_preparedness_drills
ON family_emergency_preparedness_ledger(plan_id,occurred_at DESC,created_at DESC,id)
WHERE item_type='emergency_drill';
CREATE UNIQUE INDEX idx_family_emergency_preparedness_supersedes
ON family_emergency_preparedness_ledger(supersedes_item_id)
WHERE supersedes_item_id IS NOT NULL;
CREATE UNIQUE INDEX idx_family_emergency_preparedness_check_time
ON family_emergency_preparedness_ledger(parent_item_id,checked_at)
WHERE item_type='preparedness_kit_check';

CREATE TRIGGER trg_b5_emergency_preparedness_plan_scope
BEFORE INSERT ON family_emergency_preparedness_ledger
WHEN NOT EXISTS(
  SELECT 1
  FROM family_emergency_ledger plan
  JOIN people owner ON owner.id=plan.owner_person_id
  WHERE plan.id=NEW.plan_id
    AND plan.item_type='emergency_plan'
    AND plan.family_id=NEW.family_id
    AND plan.owner_person_id=NEW.owner_person_id
    AND plan.privacy=NEW.privacy
    AND owner.family_id=plan.family_id
    AND owner.status='active'
    AND NEW.created_at>=plan.created_at
    AND NOT EXISTS(
      SELECT 1 FROM data_lifecycle lifecycle
      WHERE lifecycle.resource_type='life_record'
        AND lifecycle.resource_id=plan.id
        AND lifecycle.state<>'active'
    )
)
BEGIN
  SELECT RAISE(ABORT,'emergency preparedness item requires an active exact-family plan root and inherited owner/privacy');
END;

CREATE TRIGGER trg_b5_emergency_preparedness_parent_matrix
BEFORE INSERT ON family_emergency_preparedness_ledger
WHEN NEW.item_type IN ('preparedness_kit_item','preparedness_kit_check') AND NOT EXISTS(
  SELECT 1
  FROM family_emergency_preparedness_ledger parent
  WHERE parent.id=NEW.parent_item_id
    AND parent.item_type=CASE
      WHEN NEW.item_type='preparedness_kit_item' THEN 'preparedness_kit'
      ELSE 'preparedness_kit_item'
    END
    AND parent.plan_id=NEW.plan_id
    AND parent.family_id=NEW.family_id
    AND parent.owner_person_id=NEW.owner_person_id
    AND parent.privacy=NEW.privacy
    AND NEW.created_at>parent.created_at
    AND (NEW.item_type<>'preparedness_kit_check' OR NEW.checked_at>=parent.created_at)
    AND NOT EXISTS(
      SELECT 1 FROM family_emergency_preparedness_ledger correction
      WHERE correction.supersedes_item_id=parent.id
    )
)
BEGIN
  SELECT RAISE(ABORT,'emergency preparedness child requires a current exact-type parent in the same plan scope');
END;

CREATE TRIGGER trg_b5_emergency_preparedness_event_chronology
BEFORE INSERT ON family_emergency_preparedness_ledger
WHEN (NEW.item_type='preparedness_kit_check' AND NOT EXISTS(
    SELECT 1 FROM family_emergency_ledger plan
    WHERE plan.id=NEW.plan_id AND NEW.checked_at>=plan.created_at
  ))
  OR (NEW.item_type='emergency_drill' AND NOT EXISTS(
    SELECT 1 FROM family_emergency_ledger plan
    WHERE plan.id=NEW.plan_id AND NEW.occurred_at>=plan.created_at
  ))
BEGIN
  SELECT RAISE(ABORT,'emergency preparedness event must be within the exact plan chronology');
END;

CREATE TRIGGER trg_b5_emergency_preparedness_supersession_scope
BEFORE INSERT ON family_emergency_preparedness_ledger
WHEN NEW.supersedes_item_id IS NOT NULL AND (
  NEW.item_type NOT IN ('preparedness_kit','preparedness_kit_item','emergency_drill')
  OR NOT EXISTS(
    SELECT 1 FROM family_emergency_preparedness_ledger prior
    WHERE prior.id=NEW.supersedes_item_id
      AND prior.item_type=NEW.item_type
      AND prior.plan_id=NEW.plan_id
      AND prior.family_id=NEW.family_id
      AND prior.owner_person_id=NEW.owner_person_id
      AND prior.privacy=NEW.privacy
      AND (NEW.item_type<>'preparedness_kit_item' OR prior.parent_item_id=NEW.parent_item_id)
      AND NEW.created_at>prior.created_at
  )
)
BEGIN
  SELECT RAISE(ABORT,'emergency preparedness correction requires an older same-type item in the exact plan scope');
END;

CREATE TRIGGER trg_b5_emergency_preparedness_id_collision
BEFORE INSERT ON family_emergency_preparedness_ledger
WHEN EXISTS(SELECT 1 FROM life_records WHERE id=NEW.id)
  OR EXISTS(SELECT 1 FROM life_managed_ledger WHERE id=NEW.id)
  OR EXISTS(SELECT 1 FROM life_home_inventory_ledger WHERE id=NEW.id)
  OR EXISTS(SELECT 1 FROM family_emergency_ledger WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'emergency preparedness id collides with another life ledger'); END;
CREATE TRIGGER trg_b5_life_record_preparedness_id_collision
BEFORE INSERT ON life_records
WHEN EXISTS(SELECT 1 FROM family_emergency_preparedness_ledger WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'life record id collides with an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_life_managed_preparedness_id_collision
BEFORE INSERT ON life_managed_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_preparedness_ledger WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'managed life id collides with an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_home_inventory_preparedness_id_collision
BEFORE INSERT ON life_home_inventory_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_preparedness_ledger WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'home inventory id collides with an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_family_emergency_preparedness_id_collision
BEFORE INSERT ON family_emergency_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_preparedness_ledger WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'family emergency id collides with an emergency preparedness item'); END;

CREATE TRIGGER trg_b5_emergency_preparedness_policy_receipt
BEFORE INSERT ON family_emergency_preparedness_ledger
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection
    ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
  JOIN accounts actor_account
    ON actor_account.id=json_extract(receipt.record_json,'$.request.subject.accountId')
      AND actor_account.status='active'
  JOIN people actor_person
    ON actor_person.id=json_extract(receipt.record_json,'$.request.subject.personId')
      AND actor_person.id=actor_account.person_id
      AND actor_person.family_id=NEW.family_id
      AND actor_person.status='active'
  JOIN family_emergency_ledger plan
    ON plan.id=NEW.plan_id AND plan.item_type='emergency_plan'
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='life_record'
    AND receipt.resource_id=NEW.plan_id
    AND receipt.action='update'
    AND receipt.capability='family.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.resource.sensitivity')='personal'
    AND json_extract(receipt.record_json,'$.request.purpose')='general'
    AND json_extract(receipt.record_json,'$.request.occurredAt')=NEW.created_at
    AND plan.family_id=NEW.family_id
    AND plan.owner_person_id=NEW.owner_person_id
    AND plan.privacy=NEW.privacy
)
OR EXISTS(SELECT 1 FROM archive_items WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_versions WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_retention_policies WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_categories WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_tags WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_item_tags WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM events WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM events WHERE timeline_policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_valuations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM health_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM medication_plans WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM family_health_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM life_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM locations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM bank_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM payment_cards WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_payment_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_planning_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_import_batches WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM life_managed_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM life_home_inventory_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'emergency preparedness write requires an unused exact durable life receipt'); END;

CREATE TRIGGER trg_b5_life_record_preparedness_receipt_reuse_insert
BEFORE INSERT ON life_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'life policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_life_record_preparedness_receipt_reuse_update
BEFORE UPDATE ON life_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'life policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_life_managed_preparedness_receipt_reuse
BEFORE INSERT ON life_managed_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'managed life receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_home_inventory_preparedness_receipt_reuse
BEFORE INSERT ON life_home_inventory_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'home inventory receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_family_emergency_preparedness_receipt_reuse
BEFORE INSERT ON family_emergency_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'family emergency receipt is already bound to an emergency preparedness item'); END;

CREATE TRIGGER trg_b5_archive_item_preparedness_receipt_reuse
BEFORE INSERT ON archive_items
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_archive_item_preparedness_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_items
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_archive_version_preparedness_receipt_reuse
BEFORE INSERT ON archive_versions
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_archive_version_preparedness_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_versions
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_archive_retention_preparedness_receipt_reuse
BEFORE INSERT ON archive_retention_policies
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_archive_retention_preparedness_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_retention_policies
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_archive_category_preparedness_receipt_reuse
BEFORE INSERT ON archive_categories
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_archive_category_preparedness_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_categories
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_archive_tag_preparedness_receipt_reuse
BEFORE INSERT ON archive_tags
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_archive_tag_preparedness_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_tags
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_archive_item_tag_preparedness_receipt_reuse
BEFORE INSERT ON archive_item_tags
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_archive_item_tag_preparedness_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_item_tags
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;

CREATE TRIGGER trg_b5_event_preparedness_receipt_reuse
BEFORE INSERT ON events
WHEN (NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)) OR (NEW.timeline_policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.timeline_policy_receipt_hash
))
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_event_preparedness_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash,timeline_policy_receipt_hash ON events
WHEN (NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)) OR (NEW.timeline_policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.timeline_policy_receipt_hash
))
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;

CREATE TRIGGER trg_b5_finance_record_preparedness_receipt_reuse
BEFORE INSERT ON finance_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_finance_record_preparedness_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON finance_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_finance_valuation_preparedness_receipt_reuse
BEFORE INSERT ON finance_valuations
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_finance_valuation_preparedness_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON finance_valuations
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_health_record_preparedness_receipt_reuse
BEFORE INSERT ON health_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_health_record_preparedness_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON health_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_medication_plan_preparedness_receipt_reuse
BEFORE INSERT ON medication_plans
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_medication_plan_preparedness_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON medication_plans
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_family_health_history_preparedness_receipt_reuse
BEFORE INSERT ON family_health_history
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_family_health_history_preparedness_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON family_health_history
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_location_preparedness_receipt_reuse
BEFORE INSERT ON locations
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_location_preparedness_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON locations
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;

CREATE TRIGGER trg_b5_bank_account_preparedness_receipt_reuse
BEFORE INSERT ON bank_accounts
WHEN EXISTS(SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_payment_card_preparedness_receipt_reuse
BEFORE INSERT ON payment_cards
WHEN EXISTS(SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_loan_account_preparedness_receipt_reuse
BEFORE INSERT ON loan_accounts
WHEN EXISTS(SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_loan_payment_preparedness_receipt_reuse
BEFORE INSERT ON loan_payment_history
WHEN EXISTS(SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_finance_planning_preparedness_receipt_reuse
BEFORE INSERT ON finance_planning_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;
CREATE TRIGGER trg_b5_finance_import_preparedness_receipt_reuse
BEFORE INSERT ON finance_import_batches
WHEN EXISTS(SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency preparedness item'); END;

CREATE TRIGGER trg_b5_emergency_preparedness_immutable
BEFORE UPDATE ON family_emergency_preparedness_ledger
BEGIN SELECT RAISE(ABORT,'emergency preparedness ledger is append-only'); END;
CREATE TRIGGER trg_b5_emergency_preparedness_delete_guard
BEFORE DELETE ON family_emergency_preparedness_ledger
BEGIN SELECT RAISE(ABORT,'emergency preparedness deletion requires a governed deletion workflow'); END;

UPDATE database_metadata
SET value='REVISION-33-H-FAMILY-EMERGENCY-PREPAREDNESS',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const familyEmergencyAssistanceCardLedgerSql = `CREATE TABLE family_emergency_assistance_ledger(
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 2 AND 160),
  plan_id TEXT NOT NULL REFERENCES family_emergency_ledger(id) ON DELETE RESTRICT,
  profile_id TEXT REFERENCES family_emergency_assistance_ledger(id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  item_type TEXT NOT NULL CHECK(item_type IN (
    'emergency_profile','health_fact','emergency_contact','assistance_instruction'
  )),
  supersedes_item_id TEXT REFERENCES family_emergency_assistance_ledger(id) ON DELETE RESTRICT,
  subject_kind TEXT CHECK(subject_kind IS NULL OR subject_kind IN ('person','pet')),
  subject_person_id TEXT REFERENCES people(id) ON DELETE RESTRICT,
  subject_pet_id TEXT CHECK(subject_pet_id IS NULL OR length(trim(subject_pet_id)) BETWEEN 2 AND 160),
  responsible_person_id TEXT REFERENCES people(id) ON DELETE RESTRICT,
  label TEXT CHECK(label IS NULL OR length(trim(label)) BETWEEN 2 AND 120),
  fact_kind TEXT CHECK(fact_kind IS NULL OR fact_kind IN (
    'blood_type','allergy','chronic_condition','medication','medical_device','other'
  )),
  blood_type TEXT CHECK(blood_type IS NULL OR blood_type IN (
    'a_positive','a_negative','b_positive','b_negative','ab_positive','ab_negative',
    'o_positive','o_negative','unknown'
  )),
  fact_value TEXT CHECK(fact_value IS NULL OR length(trim(fact_value)) BETWEEN 2 AND 240),
  contact_name TEXT CHECK(contact_name IS NULL OR length(trim(contact_name)) BETWEEN 2 AND 120),
  phone_e164 TEXT CHECK(phone_e164 IS NULL OR (
    length(phone_e164) BETWEEN 9 AND 16
    AND substr(phone_e164,1,1)='+'
    AND substr(phone_e164,2,1) GLOB '[1-9]'
    AND substr(phone_e164,2) NOT GLOB '*[^0-9]*'
  )),
  relationship TEXT CHECK(relationship IS NULL OR length(trim(relationship)) BETWEEN 2 AND 120),
  instruction_kind TEXT CHECK(instruction_kind IS NULL OR instruction_kind IN (
    'mobility','vision','hearing','communication','cognitive','medication_support',
    'evacuation','pet_care','other'
  )),
  instruction TEXT CHECK(instruction IS NULL OR length(trim(instruction)) BETWEEN 2 AND 1000),
  note TEXT CHECK(note IS NULL OR length(trim(note)) BETWEEN 2 AND 500),
  privacy TEXT NOT NULL CHECK(privacy='private'),
  data_source TEXT NOT NULL CHECK(data_source='manual'),
  created_at TEXT NOT NULL CHECK(
    length(created_at)=24
    AND created_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
    AND strftime('%Y-%m-%dT%H:%M:%fZ',created_at) IS NOT NULL
    AND strftime('%Y-%m-%dT%H:%M:%fZ',created_at)=created_at
  ),
  policy_receipt_hash TEXT NOT NULL UNIQUE REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
    length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*'
  ),
  policy_receipt_version INTEGER NOT NULL CHECK(policy_receipt_version=1),
  policy_receipt_nonce TEXT NOT NULL,
  policy_correlation_id TEXT NOT NULL,
  policy_resource_type TEXT NOT NULL CHECK(policy_resource_type='life_record'),
  policy_resource_id TEXT NOT NULL,
  policy_action TEXT NOT NULL CHECK(policy_action IN ('create','update')),
  policy_capability TEXT NOT NULL CHECK(policy_capability='family.write'),
  CHECK(supersedes_item_id IS NULL OR supersedes_item_id<>id),
  CHECK(
    (item_type='emergency_profile'
      AND profile_id IS NULL AND supersedes_item_id IS NULL
      AND subject_kind IS NOT NULL AND label IS NOT NULL
      AND fact_kind IS NULL AND blood_type IS NULL AND fact_value IS NULL
      AND contact_name IS NULL AND phone_e164 IS NULL AND relationship IS NULL
      AND instruction_kind IS NULL AND instruction IS NULL AND note IS NULL
      AND policy_action='create' AND policy_resource_id=id
      AND (
        (subject_kind='person' AND subject_person_id IS NOT NULL
          AND owner_person_id=subject_person_id
          AND subject_pet_id IS NULL AND responsible_person_id IS NULL)
        OR
        (subject_kind='pet' AND subject_person_id IS NULL
          AND subject_pet_id IS NOT NULL AND responsible_person_id IS NOT NULL
          AND owner_person_id=responsible_person_id)
      ))
    OR
    (item_type='health_fact'
      AND profile_id IS NOT NULL AND subject_kind IS NULL AND subject_person_id IS NULL
      AND subject_pet_id IS NULL AND responsible_person_id IS NULL AND label IS NULL
      AND fact_kind IS NOT NULL
      AND ((fact_kind='blood_type' AND blood_type IS NOT NULL AND fact_value IS NULL)
        OR (fact_kind<>'blood_type' AND blood_type IS NULL AND fact_value IS NOT NULL))
      AND contact_name IS NULL AND phone_e164 IS NULL AND relationship IS NULL
      AND instruction_kind IS NULL AND instruction IS NULL
      AND policy_action='update' AND policy_resource_id=profile_id)
    OR
    (item_type='emergency_contact'
      AND profile_id IS NOT NULL AND subject_kind IS NULL AND subject_person_id IS NULL
      AND subject_pet_id IS NULL AND responsible_person_id IS NULL AND label IS NULL
      AND fact_kind IS NULL AND blood_type IS NULL AND fact_value IS NULL
      AND contact_name IS NOT NULL AND phone_e164 IS NOT NULL
      AND instruction_kind IS NULL AND instruction IS NULL
      AND policy_action='update' AND policy_resource_id=profile_id)
    OR
    (item_type='assistance_instruction'
      AND profile_id IS NOT NULL AND subject_kind IS NULL AND subject_person_id IS NULL
      AND subject_pet_id IS NULL AND responsible_person_id IS NULL AND label IS NULL
      AND fact_kind IS NULL AND blood_type IS NULL AND fact_value IS NULL
      AND contact_name IS NULL AND phone_e164 IS NULL AND relationship IS NULL
      AND instruction_kind IS NOT NULL AND instruction IS NOT NULL
      AND policy_action='update' AND policy_resource_id=profile_id)
  )
) STRICT;

CREATE INDEX idx_family_emergency_assistance_family_created
ON family_emergency_assistance_ledger(family_id,created_at DESC,id);
CREATE INDEX idx_family_emergency_assistance_plan_created
ON family_emergency_assistance_ledger(plan_id,created_at DESC,id);
CREATE INDEX idx_family_emergency_assistance_profile_created
ON family_emergency_assistance_ledger(profile_id,created_at DESC,id)
WHERE profile_id IS NOT NULL;
CREATE INDEX idx_family_emergency_assistance_person_subject
ON family_emergency_assistance_ledger(subject_person_id,created_at DESC,id)
WHERE item_type='emergency_profile' AND subject_kind='person';
CREATE INDEX idx_family_emergency_assistance_pet_subject
ON family_emergency_assistance_ledger(family_id,subject_pet_id,created_at DESC,id)
WHERE item_type='emergency_profile' AND subject_kind='pet';
CREATE UNIQUE INDEX idx_family_emergency_assistance_supersedes
ON family_emergency_assistance_ledger(supersedes_item_id)
WHERE supersedes_item_id IS NOT NULL;

CREATE TRIGGER trg_b5_emergency_assistance_profile_scope
BEFORE INSERT ON family_emergency_assistance_ledger
WHEN NEW.item_type='emergency_profile' AND (
  NOT EXISTS(
    SELECT 1
    FROM family_emergency_ledger plan
    WHERE plan.id=NEW.plan_id
      AND plan.item_type='emergency_plan'
      AND plan.family_id=NEW.family_id
      AND NEW.created_at>=plan.created_at
      AND NOT EXISTS(
        SELECT 1 FROM data_lifecycle lifecycle
        WHERE lifecycle.resource_type='life_record'
          AND lifecycle.resource_id=plan.id
          AND lifecycle.state<>'active'
      )
  )
  OR NOT EXISTS(
    SELECT 1 FROM people owner
    WHERE owner.id=NEW.owner_person_id
      AND owner.family_id=NEW.family_id
      AND owner.status='active'
  )
  OR (NEW.subject_kind='person' AND NOT EXISTS(
    SELECT 1 FROM people subject
    WHERE subject.id=NEW.subject_person_id
      AND subject.id=NEW.owner_person_id
      AND subject.family_id=NEW.family_id
      AND subject.status='active'
  ))
  OR (NEW.subject_kind='pet' AND NOT EXISTS(
    SELECT 1 FROM people responsible
    WHERE responsible.id=NEW.responsible_person_id
      AND responsible.id=NEW.owner_person_id
      AND responsible.family_id=NEW.family_id
      AND responsible.status='active'
  ))
)
BEGIN
  SELECT RAISE(ABORT,'emergency assistance profile requires an active same-family plan and exact person/pet owner binding');
END;

CREATE TRIGGER trg_b5_emergency_assistance_child_scope
BEFORE INSERT ON family_emergency_assistance_ledger
WHEN NEW.item_type<>'emergency_profile' AND NOT EXISTS(
  SELECT 1
  FROM family_emergency_assistance_ledger profile
  JOIN family_emergency_ledger plan
    ON plan.id=profile.plan_id AND plan.item_type='emergency_plan'
  JOIN people owner
    ON owner.id=profile.owner_person_id AND owner.family_id=profile.family_id AND owner.status='active'
  WHERE profile.id=NEW.profile_id
    AND profile.item_type='emergency_profile'
    AND profile.plan_id=NEW.plan_id
    AND profile.family_id=NEW.family_id
    AND profile.owner_person_id=NEW.owner_person_id
    AND profile.privacy=NEW.privacy
    AND profile.privacy='private'
    AND plan.family_id=NEW.family_id
    AND NEW.created_at>=profile.created_at
    AND NOT EXISTS(
      SELECT 1 FROM data_lifecycle lifecycle
      WHERE lifecycle.resource_type='life_record'
        AND lifecycle.resource_id=profile.id
        AND lifecycle.state<>'active'
    )
    AND NOT EXISTS(
      SELECT 1 FROM data_lifecycle lifecycle
      WHERE lifecycle.resource_type='life_record'
        AND lifecycle.resource_id=plan.id
        AND lifecycle.state<>'active'
    )
)
BEGIN
  SELECT RAISE(ABORT,'emergency assistance child requires an active exact private profile root and plan scope');
END;

CREATE TRIGGER trg_b5_emergency_assistance_supersession_scope
BEFORE INSERT ON family_emergency_assistance_ledger
WHEN NEW.supersedes_item_id IS NOT NULL AND (
  NEW.item_type='emergency_profile'
  OR NOT EXISTS(
    SELECT 1 FROM family_emergency_assistance_ledger prior
    WHERE prior.id=NEW.supersedes_item_id
      AND prior.item_type=NEW.item_type
      AND prior.profile_id=NEW.profile_id
      AND prior.plan_id=NEW.plan_id
      AND prior.family_id=NEW.family_id
      AND prior.owner_person_id=NEW.owner_person_id
      AND prior.privacy=NEW.privacy
      AND NEW.created_at>prior.created_at
      AND (NEW.item_type<>'health_fact' OR prior.fact_kind=NEW.fact_kind)
      AND (NEW.item_type<>'assistance_instruction' OR prior.instruction_kind=NEW.instruction_kind)
  )
)
BEGIN
  SELECT RAISE(ABORT,'emergency assistance correction requires an older same-profile item with exact subtype scope');
END;

CREATE TRIGGER trg_b5_emergency_assistance_id_collision
BEFORE INSERT ON family_emergency_assistance_ledger
WHEN EXISTS(SELECT 1 FROM life_records WHERE id=NEW.id)
  OR EXISTS(SELECT 1 FROM life_managed_ledger WHERE id=NEW.id)
  OR EXISTS(SELECT 1 FROM life_home_inventory_ledger WHERE id=NEW.id)
  OR EXISTS(SELECT 1 FROM family_emergency_ledger WHERE id=NEW.id)
  OR EXISTS(SELECT 1 FROM family_emergency_preparedness_ledger WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'emergency assistance id collides with another life ledger'); END;
CREATE TRIGGER trg_b5_life_record_assistance_id_collision
BEFORE INSERT ON life_records
WHEN EXISTS(SELECT 1 FROM family_emergency_assistance_ledger WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'life record id collides with an emergency assistance item'); END;
CREATE TRIGGER trg_b5_life_managed_assistance_id_collision
BEFORE INSERT ON life_managed_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_assistance_ledger WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'managed life id collides with an emergency assistance item'); END;
CREATE TRIGGER trg_b5_home_inventory_assistance_id_collision
BEFORE INSERT ON life_home_inventory_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_assistance_ledger WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'home inventory id collides with an emergency assistance item'); END;
CREATE TRIGGER trg_b5_family_emergency_assistance_id_collision
BEFORE INSERT ON family_emergency_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_assistance_ledger WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'family emergency id collides with an emergency assistance item'); END;
CREATE TRIGGER trg_b5_preparedness_assistance_id_collision
BEFORE INSERT ON family_emergency_preparedness_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_assistance_ledger WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'emergency preparedness id collides with an emergency assistance item'); END;

CREATE TRIGGER trg_b5_emergency_assistance_policy_receipt
BEFORE INSERT ON family_emergency_assistance_ledger
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection
    ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
  JOIN accounts actor_account
    ON actor_account.id=json_extract(receipt.record_json,'$.request.subject.accountId')
      AND actor_account.status='active'
  JOIN people actor_person
    ON actor_person.id=json_extract(receipt.record_json,'$.request.subject.personId')
      AND actor_person.id=actor_account.person_id
      AND actor_person.family_id=NEW.family_id
      AND actor_person.status='active'
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='life_record'
    AND receipt.resource_id=CASE WHEN NEW.item_type='emergency_profile' THEN NEW.id ELSE NEW.profile_id END
    AND receipt.action=CASE WHEN NEW.item_type='emergency_profile' THEN 'create' ELSE 'update' END
    AND receipt.capability='family.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.resource.sensitivity')='highly_sensitive'
    AND json_extract(receipt.record_json,'$.request.purpose')='general'
    AND json_extract(receipt.record_json,'$.request.occurredAt')=NEW.created_at
)
OR EXISTS(SELECT 1 FROM archive_items WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_versions WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_retention_policies WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_categories WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_tags WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_item_tags WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM events WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM events WHERE timeline_policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_valuations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM health_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM medication_plans WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM family_health_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM life_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM locations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM bank_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM payment_cards WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_payment_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_planning_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_import_batches WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM life_managed_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM life_home_inventory_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'emergency assistance write requires an unused exact durable private life receipt'); END;

CREATE TRIGGER trg_b5_life_record_assistance_receipt_reuse_insert
BEFORE INSERT ON life_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'life policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_life_record_assistance_receipt_reuse_update
BEFORE UPDATE ON life_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'life policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_life_managed_assistance_receipt_reuse
BEFORE INSERT ON life_managed_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'managed life receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_home_inventory_assistance_receipt_reuse
BEFORE INSERT ON life_home_inventory_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'home inventory receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_family_emergency_assistance_receipt_reuse
BEFORE INSERT ON family_emergency_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'family emergency receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_preparedness_assistance_receipt_reuse
BEFORE INSERT ON family_emergency_preparedness_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'preparedness receipt is already bound to an emergency assistance item'); END;

CREATE TRIGGER trg_b5_archive_item_assistance_receipt_reuse
BEFORE INSERT ON archive_items
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_archive_item_assistance_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_items
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_archive_version_assistance_receipt_reuse
BEFORE INSERT ON archive_versions
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_archive_version_assistance_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_versions
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_archive_retention_assistance_receipt_reuse
BEFORE INSERT ON archive_retention_policies
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_archive_retention_assistance_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_retention_policies
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_archive_category_assistance_receipt_reuse
BEFORE INSERT ON archive_categories
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_archive_category_assistance_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_categories
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_archive_tag_assistance_receipt_reuse
BEFORE INSERT ON archive_tags
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_archive_tag_assistance_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_tags
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_archive_item_tag_assistance_receipt_reuse
BEFORE INSERT ON archive_item_tags
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_archive_item_tag_assistance_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_item_tags
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;

CREATE TRIGGER trg_b5_event_assistance_receipt_reuse
BEFORE INSERT ON events
WHEN (NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)) OR (NEW.timeline_policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.timeline_policy_receipt_hash
))
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_event_assistance_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash,timeline_policy_receipt_hash ON events
WHEN (NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)) OR (NEW.timeline_policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.timeline_policy_receipt_hash
))
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;

CREATE TRIGGER trg_b5_finance_record_assistance_receipt_reuse
BEFORE INSERT ON finance_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_finance_record_assistance_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON finance_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_finance_valuation_assistance_receipt_reuse
BEFORE INSERT ON finance_valuations
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_finance_valuation_assistance_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON finance_valuations
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_health_record_assistance_receipt_reuse
BEFORE INSERT ON health_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_health_record_assistance_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON health_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_medication_plan_assistance_receipt_reuse
BEFORE INSERT ON medication_plans
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_medication_plan_assistance_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON medication_plans
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_family_health_history_assistance_receipt_reuse
BEFORE INSERT ON family_health_history
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_family_health_history_assistance_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON family_health_history
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_location_assistance_receipt_reuse
BEFORE INSERT ON locations
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_location_assistance_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON locations
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;

CREATE TRIGGER trg_b5_bank_account_assistance_receipt_reuse
BEFORE INSERT ON bank_accounts
WHEN EXISTS(SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_payment_card_assistance_receipt_reuse
BEFORE INSERT ON payment_cards
WHEN EXISTS(SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_loan_account_assistance_receipt_reuse
BEFORE INSERT ON loan_accounts
WHEN EXISTS(SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_loan_payment_assistance_receipt_reuse
BEFORE INSERT ON loan_payment_history
WHEN EXISTS(SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_finance_planning_assistance_receipt_reuse
BEFORE INSERT ON finance_planning_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;
CREATE TRIGGER trg_b5_finance_import_assistance_receipt_reuse
BEFORE INSERT ON finance_import_batches
WHEN EXISTS(SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency assistance item'); END;

CREATE TRIGGER trg_b5_emergency_assistance_immutable
BEFORE UPDATE ON family_emergency_assistance_ledger
BEGIN SELECT RAISE(ABORT,'emergency assistance ledger is append-only'); END;
CREATE TRIGGER trg_b5_emergency_assistance_delete_guard
BEFORE DELETE ON family_emergency_assistance_ledger
BEGIN SELECT RAISE(ABORT,'emergency assistance deletion requires a governed deletion workflow'); END;

UPDATE database_metadata
SET value='REVISION-33-I-FAMILY-EMERGENCY-ASSISTANCE-CARD',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const familyEmergencyCardPortabilityLedgerSql = `CREATE TABLE family_emergency_card_portability_ledger(
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 2 AND 160),
  profile_id TEXT NOT NULL REFERENCES family_emergency_assistance_ledger(id) ON DELETE RESTRICT,
  configuration_id TEXT REFERENCES family_emergency_card_portability_ledger(id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  item_type TEXT NOT NULL CHECK(item_type IN (
    'card_configuration','selected_field','document_link','export_event','power_mode_event'
  )),
  configuration_label TEXT CHECK(
    configuration_label IS NULL OR length(trim(configuration_label)) BETWEEN 2 AND 120
  ),
  locale TEXT CHECK(locale IS NULL OR locale='tr-TR'),
  source_item_id TEXT REFERENCES family_emergency_assistance_ledger(id) ON DELETE RESTRICT,
  source_item_type TEXT CHECK(source_item_type IS NULL OR source_item_type IN (
    'emergency_profile','health_fact','emergency_contact','assistance_instruction'
  )),
  field_code TEXT CHECK(field_code IS NULL OR field_code IN (
    'label','subject_display','fact_value','note','name','phone_e164','relationship',
    'instruction_kind','instruction'
  )),
  archive_item_id TEXT REFERENCES archive_items(id) ON DELETE RESTRICT,
  export_mode TEXT CHECK(export_mode IS NULL OR export_mode IN ('print','pdf','encrypted_pack')),
  selected_field_count INTEGER CHECK(
    selected_field_count IS NULL OR (selected_field_count BETWEEN 0 AND 64)
  ),
  document_count INTEGER CHECK(document_count IS NULL OR (document_count BETWEEN 0 AND 10)) ,
  selection_sha256 TEXT CHECK(
    selection_sha256 IS NULL OR (
      length(selection_sha256)=64 AND selection_sha256 NOT GLOB '*[^0-9a-f]*'
    )
  ),
  share_receipt_hash TEXT UNIQUE REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
    share_receipt_hash IS NULL OR (
      length(share_receipt_hash)=64 AND share_receipt_hash NOT GLOB '*[^0-9a-f]*'
    )
  ),
  artifact_sha256 TEXT CHECK(
    artifact_sha256 IS NULL OR (
      length(artifact_sha256)=64 AND artifact_sha256 NOT GLOB '*[^0-9a-f]*'
    )
  ),
  artifact_size_bytes INTEGER CHECK(
    artifact_size_bytes IS NULL OR (artifact_size_bytes BETWEEN 1 AND 67108864)
  ),
  artifact_readback_status TEXT CHECK(
    artifact_readback_status IS NULL
    OR artifact_readback_status IN ('verified','not_applicable_print')
  ),
  printer_dispatch_status TEXT CHECK(
    printer_dispatch_status IS NULL OR printer_dispatch_status='confirmed'
  ),
  power_mode TEXT CHECK(power_mode IS NULL OR power_mode IN ('enabled','disabled')),
  activation_source TEXT CHECK(
    activation_source IS NULL OR activation_source IN ('manual','battery_prompt')
  ),
  power_source TEXT CHECK(power_source IS NULL OR power_source IN ('battery','ac','unknown')),
  battery_level TEXT CHECK(battery_level IS NULL OR battery_level='not_measured'),
  automatic_low_battery_detection TEXT CHECK(
    automatic_low_battery_detection IS NULL OR automatic_low_battery_detection='not_performed'
  ),
  low_battery_claimed INTEGER CHECK(low_battery_claimed IS NULL OR low_battery_claimed=0),
  privacy TEXT NOT NULL CHECK(privacy='private'),
  data_source TEXT NOT NULL CHECK(data_source='manual'),
  created_at TEXT NOT NULL CHECK(
    length(created_at)=24
    AND created_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'
    AND strftime('%Y-%m-%dT%H:%M:%fZ',created_at) IS NOT NULL
    AND strftime('%Y-%m-%dT%H:%M:%fZ',created_at)=created_at
  ),
  policy_receipt_hash TEXT NOT NULL UNIQUE REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(
    length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*'
  ),
  policy_receipt_version INTEGER NOT NULL CHECK(policy_receipt_version=1),
  policy_receipt_nonce TEXT NOT NULL,
  policy_correlation_id TEXT NOT NULL,
  policy_resource_type TEXT NOT NULL CHECK(policy_resource_type='life_record'),
  policy_resource_id TEXT NOT NULL,
  policy_action TEXT NOT NULL CHECK(policy_action='update'),
  policy_capability TEXT NOT NULL CHECK(policy_capability='family.write'),
  CHECK(
    (item_type='card_configuration'
      AND configuration_id IS NULL
      AND configuration_label IS NOT NULL AND locale='tr-TR'
      AND source_item_id IS NULL AND source_item_type IS NULL AND field_code IS NULL
      AND archive_item_id IS NULL AND export_mode IS NULL
      AND selected_field_count IS NULL AND document_count IS NULL
      AND selection_sha256 IS NULL
      AND share_receipt_hash IS NULL
      AND artifact_sha256 IS NULL AND artifact_size_bytes IS NULL
      AND artifact_readback_status IS NULL AND printer_dispatch_status IS NULL
      AND power_mode IS NULL AND activation_source IS NULL AND power_source IS NULL
      AND battery_level IS NULL AND automatic_low_battery_detection IS NULL
      AND low_battery_claimed IS NULL)
    OR
    (item_type='selected_field'
      AND configuration_id IS NOT NULL
      AND configuration_label IS NULL AND locale IS NULL
      AND source_item_id IS NOT NULL AND source_item_type IS NOT NULL AND field_code IS NOT NULL
      AND archive_item_id IS NULL AND export_mode IS NULL
      AND selected_field_count IS NULL AND document_count IS NULL
      AND selection_sha256 IS NULL
      AND share_receipt_hash IS NULL
      AND artifact_sha256 IS NULL AND artifact_size_bytes IS NULL
      AND artifact_readback_status IS NULL AND printer_dispatch_status IS NULL
      AND power_mode IS NULL AND activation_source IS NULL AND power_source IS NULL
      AND battery_level IS NULL AND automatic_low_battery_detection IS NULL
      AND low_battery_claimed IS NULL
      AND (
        (source_item_type='emergency_profile' AND field_code IN ('label','subject_display'))
        OR (source_item_type='health_fact' AND field_code IN ('fact_value','note'))
        OR (source_item_type='emergency_contact'
          AND field_code IN ('name','phone_e164','relationship','note'))
        OR (source_item_type='assistance_instruction'
          AND field_code IN ('instruction_kind','instruction','note'))
      ))
    OR
    (item_type='document_link'
      AND configuration_id IS NOT NULL
      AND configuration_label IS NULL AND locale IS NULL
      AND source_item_id IS NULL AND source_item_type IS NULL AND field_code IS NULL
      AND archive_item_id IS NOT NULL AND export_mode IS NULL
      AND selected_field_count IS NULL AND document_count IS NULL
      AND selection_sha256 IS NULL
      AND share_receipt_hash IS NULL
      AND artifact_sha256 IS NULL AND artifact_size_bytes IS NULL
      AND artifact_readback_status IS NULL AND printer_dispatch_status IS NULL
      AND power_mode IS NULL AND activation_source IS NULL AND power_source IS NULL
      AND battery_level IS NULL AND automatic_low_battery_detection IS NULL
      AND low_battery_claimed IS NULL)
    OR
    (item_type='export_event'
      AND configuration_id IS NOT NULL
      AND configuration_label IS NULL AND locale IS NULL
      AND source_item_id IS NULL AND source_item_type IS NULL AND field_code IS NULL
      AND archive_item_id IS NULL AND export_mode IS NOT NULL
      AND selected_field_count IS NOT NULL AND document_count IS NOT NULL
      AND selection_sha256 IS NOT NULL
      AND share_receipt_hash IS NOT NULL
      AND artifact_sha256 IS NOT NULL AND artifact_size_bytes IS NOT NULL
      AND power_mode IS NULL AND activation_source IS NULL AND power_source IS NOT NULL
      AND battery_level='not_measured' AND automatic_low_battery_detection='not_performed'
      AND low_battery_claimed=0
      AND selected_field_count+document_count>=1
      AND (export_mode='encrypted_pack' OR document_count=0)
      AND (
        (export_mode='print' AND artifact_readback_status='not_applicable_print'
          AND printer_dispatch_status='confirmed')
        OR (export_mode IN ('pdf','encrypted_pack') AND artifact_readback_status='verified'
          AND printer_dispatch_status IS NULL)
      ))
    OR
    (item_type='power_mode_event'
      AND configuration_id IS NOT NULL
      AND configuration_label IS NULL AND locale IS NULL
      AND source_item_id IS NULL AND source_item_type IS NULL AND field_code IS NULL
      AND archive_item_id IS NULL AND export_mode IS NULL
      AND selected_field_count IS NULL AND document_count IS NULL
      AND selection_sha256 IS NULL
      AND share_receipt_hash IS NULL
      AND artifact_sha256 IS NULL AND artifact_size_bytes IS NULL
      AND artifact_readback_status IS NULL AND printer_dispatch_status IS NULL
      AND power_mode IS NOT NULL AND activation_source IS NOT NULL AND power_source IS NOT NULL
      AND battery_level='not_measured' AND automatic_low_battery_detection='not_performed'
      AND low_battery_claimed=0)
  ),
  UNIQUE(configuration_id,source_item_id,field_code),
  UNIQUE(configuration_id,archive_item_id)
) STRICT;

CREATE INDEX idx_family_emergency_card_portability_profile_created
ON family_emergency_card_portability_ledger(profile_id,created_at DESC,id);
CREATE INDEX idx_family_emergency_card_portability_configuration_created
ON family_emergency_card_portability_ledger(configuration_id,created_at DESC,id)
WHERE configuration_id IS NOT NULL;
CREATE INDEX idx_family_emergency_card_portability_archive
ON family_emergency_card_portability_ledger(archive_item_id)
WHERE archive_item_id IS NOT NULL;
CREATE TRIGGER trg_b5_emergency_card_portability_profile_scope
BEFORE INSERT ON family_emergency_card_portability_ledger
WHEN NOT EXISTS(
  SELECT 1
  FROM family_emergency_assistance_ledger profile
  JOIN family_emergency_ledger plan
    ON plan.id=profile.plan_id AND plan.item_type='emergency_plan'
  JOIN people owner
    ON owner.id=profile.owner_person_id AND owner.family_id=profile.family_id AND owner.status='active'
  WHERE profile.id=NEW.profile_id
    AND profile.item_type='emergency_profile'
    AND profile.family_id=NEW.family_id
    AND profile.owner_person_id=NEW.owner_person_id
    AND profile.privacy=NEW.privacy AND profile.privacy='private'
    AND plan.family_id=NEW.family_id
    AND NEW.created_at>=profile.created_at
    AND NOT EXISTS(
      SELECT 1 FROM data_lifecycle lifecycle
      WHERE lifecycle.resource_type='life_record'
        AND lifecycle.resource_id=profile.id AND lifecycle.state<>'active'
    )
    AND NOT EXISTS(
      SELECT 1 FROM data_lifecycle lifecycle
      WHERE lifecycle.resource_type='life_record'
        AND lifecycle.resource_id=plan.id AND lifecycle.state<>'active'
    )
)
BEGIN
  SELECT RAISE(ABORT,'emergency card portability requires an active exact private assistance profile root');
END;

CREATE TRIGGER trg_b5_emergency_card_portability_configuration_scope
BEFORE INSERT ON family_emergency_card_portability_ledger
WHEN NEW.item_type<>'card_configuration' AND NOT EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger configuration
  WHERE configuration.id=NEW.configuration_id
    AND configuration.item_type='card_configuration'
    AND configuration.profile_id=NEW.profile_id
    AND configuration.family_id=NEW.family_id
    AND configuration.owner_person_id=NEW.owner_person_id
    AND configuration.privacy=NEW.privacy
    AND NEW.created_at>=configuration.created_at
)
BEGIN
  SELECT RAISE(ABORT,'emergency card portability child requires an exact immutable configuration root');
END;

CREATE TRIGGER trg_b5_emergency_card_portability_selected_field_scope
BEFORE INSERT ON family_emergency_card_portability_ledger
WHEN NEW.item_type='selected_field' AND NOT EXISTS(
  SELECT 1 FROM family_emergency_assistance_ledger source
  WHERE source.id=NEW.source_item_id
    AND source.item_type=NEW.source_item_type
    AND source.family_id=NEW.family_id
    AND source.owner_person_id=NEW.owner_person_id
    AND source.privacy=NEW.privacy AND source.privacy='private'
    AND NEW.created_at>=source.created_at
    AND (
      (source.item_type='emergency_profile' AND source.id=NEW.profile_id)
      OR (source.item_type<>'emergency_profile' AND source.profile_id=NEW.profile_id)
    )
    AND (NEW.field_code<>'fact_value' OR (
      source.item_type='health_fact' AND (source.blood_type IS NOT NULL OR source.fact_value IS NOT NULL)
    ))
    AND (NEW.field_code<>'note' OR source.note IS NOT NULL)
    AND (NEW.field_code<>'relationship' OR source.relationship IS NOT NULL)
    AND NOT EXISTS(
      SELECT 1 FROM family_emergency_assistance_ledger correction
      WHERE correction.supersedes_item_id=source.id
    )
)
BEGIN
  SELECT RAISE(ABORT,'selected emergency card field requires a current exact same-profile source item');
END;

CREATE TRIGGER trg_b5_emergency_card_portability_selected_field_limit
BEFORE INSERT ON family_emergency_card_portability_ledger
WHEN NEW.item_type='selected_field' AND (
  SELECT count(*) FROM family_emergency_card_portability_ledger selected
  WHERE selected.configuration_id=NEW.configuration_id AND selected.item_type='selected_field'
)>=64
BEGIN
  SELECT RAISE(ABORT,'emergency card configuration is limited to 64 selected fields');
END;

CREATE TRIGGER trg_b5_emergency_card_portability_document_scope
BEFORE INSERT ON family_emergency_card_portability_ledger
WHEN NEW.item_type='document_link' AND NOT EXISTS(
  SELECT 1 FROM archive_items archive
  WHERE archive.id=NEW.archive_item_id
    AND archive.family_id=NEW.family_id
    AND archive.destroyed_at IS NULL
    AND archive.sensitivity='high'
    AND archive.created_at<=NEW.created_at
)
BEGIN
  SELECT RAISE(ABORT,'emergency document link requires an existing same-family active high-sensitivity archive item');
END;

CREATE TRIGGER trg_b5_emergency_card_portability_document_limit
BEFORE INSERT ON family_emergency_card_portability_ledger
WHEN NEW.item_type='document_link' AND (
  SELECT count(*) FROM family_emergency_card_portability_ledger document
  WHERE document.configuration_id=NEW.configuration_id AND document.item_type='document_link'
)>=10
BEGIN
  SELECT RAISE(ABORT,'emergency card configuration is limited to 10 document links');
END;

CREATE TRIGGER trg_b5_emergency_card_portability_export_counts
BEFORE INSERT ON family_emergency_card_portability_ledger
WHEN NEW.item_type='export_event' AND (
  NEW.selected_field_count>(
    SELECT count(*) FROM family_emergency_card_portability_ledger selected
    WHERE selected.configuration_id=NEW.configuration_id AND selected.item_type='selected_field'
  )
  OR NEW.document_count>(
    SELECT count(*) FROM family_emergency_card_portability_ledger document
    WHERE document.configuration_id=NEW.configuration_id AND document.item_type='document_link'
  )
)
BEGIN
  SELECT RAISE(ABORT,'emergency export metadata counts must be bounded by the exact immutable configuration');
END;

CREATE TRIGGER trg_b5_emergency_card_portability_id_collision
BEFORE INSERT ON family_emergency_card_portability_ledger
WHEN EXISTS(SELECT 1 FROM life_records WHERE id=NEW.id)
  OR EXISTS(SELECT 1 FROM life_managed_ledger WHERE id=NEW.id)
  OR EXISTS(SELECT 1 FROM life_home_inventory_ledger WHERE id=NEW.id)
  OR EXISTS(SELECT 1 FROM family_emergency_ledger WHERE id=NEW.id)
  OR EXISTS(SELECT 1 FROM family_emergency_preparedness_ledger WHERE id=NEW.id)
  OR EXISTS(SELECT 1 FROM family_emergency_assistance_ledger WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'emergency card portability id collides with another life ledger'); END;
CREATE TRIGGER trg_b5_life_record_portability_id_collision
BEFORE INSERT ON life_records
WHEN EXISTS(SELECT 1 FROM family_emergency_card_portability_ledger WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'life record id collides with an emergency card portability item'); END;
CREATE TRIGGER trg_b5_life_managed_portability_id_collision
BEFORE INSERT ON life_managed_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_card_portability_ledger WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'managed life id collides with an emergency card portability item'); END;
CREATE TRIGGER trg_b5_home_inventory_portability_id_collision
BEFORE INSERT ON life_home_inventory_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_card_portability_ledger WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'home inventory id collides with an emergency card portability item'); END;
CREATE TRIGGER trg_b5_family_emergency_portability_id_collision
BEFORE INSERT ON family_emergency_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_card_portability_ledger WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'family emergency id collides with an emergency card portability item'); END;
CREATE TRIGGER trg_b5_preparedness_portability_id_collision
BEFORE INSERT ON family_emergency_preparedness_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_card_portability_ledger WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'emergency preparedness id collides with an emergency card portability item'); END;
CREATE TRIGGER trg_b5_assistance_portability_id_collision
BEFORE INSERT ON family_emergency_assistance_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_card_portability_ledger WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'emergency assistance id collides with an emergency card portability item'); END;

CREATE TRIGGER trg_b5_emergency_card_portability_policy_receipt
BEFORE INSERT ON family_emergency_card_portability_ledger
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection
    ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
  JOIN accounts actor_account
    ON actor_account.id=json_extract(receipt.record_json,'$.request.subject.accountId')
      AND actor_account.status='active'
  JOIN people actor_person
    ON actor_person.id=json_extract(receipt.record_json,'$.request.subject.personId')
      AND actor_person.id=actor_account.person_id
      AND actor_person.family_id=NEW.family_id
      AND actor_person.status='active'
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='life_record'
    AND receipt.resource_id=NEW.profile_id
    AND receipt.action='update'
    AND receipt.capability='family.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.resource.sensitivity')='highly_sensitive'
    AND json_extract(receipt.record_json,'$.request.purpose')='general'
    AND json_extract(receipt.record_json,'$.request.occurredAt')=NEW.created_at
)
OR EXISTS(SELECT 1 FROM archive_items WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_versions WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_retention_policies WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_categories WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_tags WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM archive_item_tags WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM events WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM events WHERE timeline_policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_valuations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM health_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM medication_plans WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM family_health_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM life_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM locations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM bank_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM payment_cards WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_payment_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_planning_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_import_batches WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM life_managed_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM life_home_inventory_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM family_emergency_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM family_emergency_preparedness_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM family_emergency_assistance_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'emergency card portability write requires an unused exact durable private life update receipt'); END;

CREATE TRIGGER trg_b5_emergency_card_portability_export_share_receipt
BEFORE INSERT ON family_emergency_card_portability_ledger
WHEN NEW.item_type='export_event' AND NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts share_receipt
  JOIN platform_policy_database_fences share_fence
    ON share_fence.fence_name=share_receipt.fence_name
      AND share_fence.epoch=share_receipt.fence_epoch
      AND share_fence.writable=1
  JOIN platform_policy_journal_projection_outbox share_projection
    ON share_projection.receipt_hash=share_receipt.receipt_hash
      AND share_projection.record_json=share_receipt.record_json
  JOIN accounts share_account
    ON share_account.id=json_extract(share_receipt.record_json,'$.request.subject.accountId')
      AND share_account.status='active'
  JOIN people share_person
    ON share_person.id=json_extract(share_receipt.record_json,'$.request.subject.personId')
      AND share_person.id=share_account.person_id
      AND share_person.id=NEW.owner_person_id
      AND share_person.family_id=NEW.family_id
      AND share_person.status='active'
  WHERE share_receipt.receipt_hash=NEW.share_receipt_hash
    AND share_receipt.resource_type='life_record'
    AND share_receipt.resource_id=NEW.profile_id
    AND share_receipt.action='share'
    AND share_receipt.capability='file.share'
    AND json_extract(share_receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(share_receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(share_receipt.record_json,'$.request.resource.sensitivity')='highly_sensitive'
    AND json_extract(share_receipt.record_json,'$.request.purpose')='emergency-offline-portability'
    AND json_type(share_receipt.record_json,'$.request.requestedFields')='array'
    AND json_array_length(share_receipt.record_json,'$.request.requestedFields') BETWEEN 1 AND 10
    AND NOT EXISTS(
      SELECT 1 FROM json_each(share_receipt.record_json,'$.request.requestedFields') field
      WHERE field.type<>'text' OR (
        field.value NOT IN (
          'fact_value','instruction','instruction_kind','label','name','note',
          'phone_e164','relationship','subject_display'
        )
        AND field.value<>'selection_sha256:'||NEW.selection_sha256
      )
    )
    AND NOT EXISTS(
      SELECT 1
      FROM json_each(share_receipt.record_json,'$.request.requestedFields') current_field
      JOIN json_each(share_receipt.record_json,'$.request.requestedFields') next_field
        ON CAST(next_field.key AS INTEGER)=CAST(current_field.key AS INTEGER)+1
      WHERE current_field.value>=next_field.value
    )
    AND EXISTS(
      SELECT 1 FROM json_each(share_receipt.record_json,'$.request.requestedFields') field
      WHERE field.type='text' AND field.value='selection_sha256:'||NEW.selection_sha256
    )
    AND 1=(
      SELECT count(*) FROM json_each(share_receipt.record_json,'$.request.requestedFields') field
      WHERE field.type='text' AND substr(field.value,1,17)='selection_sha256:'
    )
    AND julianday(json_extract(share_receipt.record_json,'$.request.occurredAt'))
      <=julianday(NEW.created_at)
    AND julianday(NEW.created_at)
      <=julianday(json_extract(share_receipt.record_json,'$.request.occurredAt'))+(300.0/86400.0)
)
BEGIN
  SELECT RAISE(ABORT,'emergency export event requires the exact prior local share receipt and selection digest');
END;

CREATE TRIGGER trg_b5_life_record_portability_receipt_reuse_insert
BEFORE INSERT ON life_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'life policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_life_record_portability_receipt_reuse_update
BEFORE UPDATE ON life_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'life policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_life_managed_portability_receipt_reuse
BEFORE INSERT ON life_managed_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'managed life receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_home_inventory_portability_receipt_reuse
BEFORE INSERT ON life_home_inventory_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'home inventory receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_family_emergency_portability_receipt_reuse
BEFORE INSERT ON family_emergency_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'family emergency receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_preparedness_portability_receipt_reuse
BEFORE INSERT ON family_emergency_preparedness_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'preparedness receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_assistance_portability_receipt_reuse
BEFORE INSERT ON family_emergency_assistance_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'assistance receipt is already bound to an emergency card portability item'); END;

CREATE TRIGGER trg_b5_archive_item_portability_receipt_reuse
BEFORE INSERT ON archive_items
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_archive_item_portability_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_items
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_archive_version_portability_receipt_reuse
BEFORE INSERT ON archive_versions
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_archive_version_portability_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_versions
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_archive_retention_portability_receipt_reuse
BEFORE INSERT ON archive_retention_policies
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_archive_retention_portability_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_retention_policies
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_archive_category_portability_receipt_reuse
BEFORE INSERT ON archive_categories
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_archive_category_portability_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_categories
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_archive_tag_portability_receipt_reuse
BEFORE INSERT ON archive_tags
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_archive_tag_portability_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_tags
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_archive_item_tag_portability_receipt_reuse
BEFORE INSERT ON archive_item_tags
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_archive_item_tag_portability_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON archive_item_tags
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;

CREATE TRIGGER trg_b5_event_portability_receipt_reuse
BEFORE INSERT ON events
WHEN (NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)) OR (NEW.timeline_policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.timeline_policy_receipt_hash
))
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_event_portability_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash,timeline_policy_receipt_hash ON events
WHEN (NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)) OR (NEW.timeline_policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.timeline_policy_receipt_hash
))
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;

CREATE TRIGGER trg_b5_finance_record_portability_receipt_reuse
BEFORE INSERT ON finance_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_finance_record_portability_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON finance_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_finance_valuation_portability_receipt_reuse
BEFORE INSERT ON finance_valuations
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_finance_valuation_portability_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON finance_valuations
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_health_record_portability_receipt_reuse
BEFORE INSERT ON health_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_health_record_portability_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON health_records
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_medication_plan_portability_receipt_reuse
BEFORE INSERT ON medication_plans
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_medication_plan_portability_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON medication_plans
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_family_health_history_portability_receipt_reuse
BEFORE INSERT ON family_health_history
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_family_health_history_portability_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON family_health_history
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_location_portability_receipt_reuse
BEFORE INSERT ON locations
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_location_portability_receipt_reuse_update
BEFORE UPDATE OF policy_receipt_hash ON locations
WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(
  SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash
)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;

CREATE TRIGGER trg_b5_bank_account_portability_receipt_reuse
BEFORE INSERT ON bank_accounts
WHEN EXISTS(SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_payment_card_portability_receipt_reuse
BEFORE INSERT ON payment_cards
WHEN EXISTS(SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_loan_account_portability_receipt_reuse
BEFORE INSERT ON loan_accounts
WHEN EXISTS(SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_loan_payment_portability_receipt_reuse
BEFORE INSERT ON loan_payment_history
WHEN EXISTS(SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_finance_planning_portability_receipt_reuse
BEFORE INSERT ON finance_planning_ledger
WHEN EXISTS(SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;
CREATE TRIGGER trg_b5_finance_import_portability_receipt_reuse
BEFORE INSERT ON finance_import_batches
WHEN EXISTS(SELECT 1 FROM family_emergency_card_portability_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'policy receipt is already bound to an emergency card portability item'); END;

CREATE TRIGGER trg_b5_emergency_card_portability_immutable
BEFORE UPDATE ON family_emergency_card_portability_ledger
BEGIN SELECT RAISE(ABORT,'emergency card portability ledger is append-only'); END;
CREATE TRIGGER trg_b5_emergency_card_portability_delete_guard
BEFORE DELETE ON family_emergency_card_portability_ledger
BEGIN SELECT RAISE(ABORT,'emergency card portability deletion requires a governed deletion workflow'); END;

UPDATE database_metadata
SET value='REVISION-33-J-FAMILY-EMERGENCY-CARD-PORTABILITY',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
`;

const longTermPortfolioLedgerSql = `CREATE TABLE long_term_portfolio_mutations(
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 2 AND 160),
  client_operation_id TEXT NOT NULL CHECK(length(trim(client_operation_id)) BETWEEN 8 AND 128),
  request_fingerprint TEXT NOT NULL CHECK(length(request_fingerprint)=64 AND request_fingerprint NOT GLOB '*[^0-9a-f]*'),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  privacy TEXT NOT NULL CHECK(privacy IN ('private','selected_members','family')),
  operation TEXT NOT NULL CHECK(operation IN ('bootstrap_default','instrument_revision','plan_version','ledger_event','price_observation')),
  resource_id TEXT NOT NULL CHECK(length(trim(resource_id)) BETWEEN 2 AND 160),
  created_at TEXT NOT NULL CHECK(datetime(created_at) IS NOT NULL),
  policy_receipt_hash TEXT NOT NULL UNIQUE REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*'),
  policy_receipt_version INTEGER NOT NULL CHECK(policy_receipt_version=1),
  policy_receipt_nonce TEXT NOT NULL,
  policy_correlation_id TEXT NOT NULL,
  policy_resource_type TEXT NOT NULL CHECK(policy_resource_type='finance_record'),
  policy_resource_id TEXT NOT NULL CHECK(policy_resource_id=id),
  policy_action TEXT NOT NULL CHECK(policy_action='create'),
  policy_capability TEXT NOT NULL CHECK(policy_capability='finance.write'),
  UNIQUE(family_id,client_operation_id)
) STRICT;

CREATE TABLE long_term_portfolio_instruments(
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 2 AND 160),
  mutation_id TEXT NOT NULL REFERENCES long_term_portfolio_mutations(id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  privacy TEXT NOT NULL CHECK(privacy IN ('private','selected_members','family')),
  created_at TEXT NOT NULL CHECK(datetime(created_at) IS NOT NULL)
) STRICT;

CREATE TABLE long_term_portfolio_instrument_revisions(
  revision_id TEXT PRIMARY KEY CHECK(length(trim(revision_id)) BETWEEN 2 AND 160),
  instrument_id TEXT NOT NULL REFERENCES long_term_portfolio_instruments(id) ON DELETE RESTRICT,
  mutation_id TEXT NOT NULL REFERENCES long_term_portfolio_mutations(id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  privacy TEXT NOT NULL CHECK(privacy IN ('private','selected_members','family')),
  asset_class TEXT NOT NULL CHECK(asset_class IN ('domestic_equity','foreign_equity','fund','etf','bond_note','eurobond','deposit','foreign_currency','gold','silver','commodity','private_pension','ipo_reserve','cash_savings','crypto_asset','real_estate','vehicle','custom')),
  group_label TEXT NOT NULL CHECK(length(trim(group_label)) BETWEEN 1 AND 80),
  code TEXT NOT NULL CHECK(length(trim(code)) BETWEEN 1 AND 32),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 180),
  currency TEXT NOT NULL CHECK(length(currency)=3 AND currency=upper(currency) AND currency GLOB '[A-Z][A-Z][A-Z]'),
  effective_from TEXT NOT NULL CHECK(datetime(effective_from) IS NOT NULL),
  status TEXT NOT NULL CHECK(status IN ('active','inactive','matured','merged')),
  isin TEXT CHECK(isin IS NULL OR length(trim(isin)) BETWEEN 2 AND 32),
  exchange_name TEXT CHECK(exchange_name IS NULL OR length(trim(exchange_name)) BETWEEN 1 AND 120),
  country_code TEXT CHECK(country_code IS NULL OR length(country_code)=2),
  price_source TEXT CHECK(price_source IS NULL OR length(trim(price_source)) BETWEEN 1 AND 180),
  tax_profile TEXT CHECK(tax_profile IS NULL OR length(trim(tax_profile)) BETWEEN 1 AND 240),
  fee_profile TEXT CHECK(fee_profile IS NULL OR length(trim(fee_profile)) BETWEEN 1 AND 240),
  notes TEXT CHECK(notes IS NULL OR length(trim(notes)) BETWEEN 1 AND 1000),
  replaces_revision_id TEXT REFERENCES long_term_portfolio_instrument_revisions(revision_id) ON DELETE RESTRICT,
  data_source TEXT NOT NULL CHECK(data_source IN ('user_entered','manual','csv_import')),
  external_verification TEXT NOT NULL CHECK(external_verification IN ('not_performed','user_confirmed','source_document_checked')),
  created_at TEXT NOT NULL CHECK(datetime(created_at) IS NOT NULL),
  CHECK(datetime(effective_from)<=datetime(created_at)),
  UNIQUE(instrument_id,effective_from)
) STRICT;

CREATE TABLE long_term_portfolios(
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 2 AND 160),
  mutation_id TEXT NOT NULL UNIQUE REFERENCES long_term_portfolio_mutations(id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 160),
  base_currency TEXT NOT NULL CHECK(length(base_currency)=3 AND base_currency=upper(base_currency) AND base_currency GLOB '[A-Z][A-Z][A-Z]'),
  privacy TEXT NOT NULL CHECK(privacy IN ('private','selected_members','family')),
  target_date TEXT NOT NULL CHECK(datetime(target_date) IS NOT NULL),
  purpose TEXT NOT NULL CHECK(length(trim(purpose)) BETWEEN 2 AND 240),
  created_at TEXT NOT NULL CHECK(datetime(created_at) IS NOT NULL),
  UNIQUE(family_id)
) STRICT;

CREATE TABLE long_term_portfolio_plan_versions(
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 2 AND 160),
  portfolio_id TEXT NOT NULL REFERENCES long_term_portfolios(id) ON DELETE RESTRICT,
  mutation_id TEXT NOT NULL UNIQUE REFERENCES long_term_portfolio_mutations(id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  privacy TEXT NOT NULL CHECK(privacy IN ('private','selected_members','family')),
  version INTEGER NOT NULL CHECK(version BETWEEN 1 AND 1000000),
  effective_month TEXT NOT NULL CHECK(length(effective_month)=7 AND effective_month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]' AND substr(effective_month,6,2) BETWEEN '01' AND '12'),
  monthly_contribution REAL NOT NULL CHECK(monthly_contribution>0 AND monthly_contribution<=1000000000000000),
  contribution_currency TEXT NOT NULL CHECK(length(contribution_currency)=3 AND contribution_currency=upper(contribution_currency) AND contribution_currency GLOB '[A-Z][A-Z][A-Z]'),
  contribution_change_reason TEXT NOT NULL CHECK(length(trim(contribution_change_reason)) BETWEEN 2 AND 240),
  rebalance_interval_months INTEGER NOT NULL CHECK(rebalance_interval_months BETWEEN 1 AND 60),
  inflation_adjustment TEXT NOT NULL CHECK(inflation_adjustment IN ('manual_realized_inflation','fixed_assumption','none')),
  target_date TEXT NOT NULL CHECK(datetime(target_date) IS NOT NULL),
  pessimistic_return_bps INTEGER NOT NULL CHECK(pessimistic_return_bps BETWEEN -10000 AND 100000),
  base_return_bps INTEGER NOT NULL CHECK(base_return_bps BETWEEN -10000 AND 100000),
  optimistic_return_bps INTEGER NOT NULL CHECK(optimistic_return_bps BETWEEN -10000 AND 100000),
  annual_inflation_bps INTEGER NOT NULL CHECK(annual_inflation_bps BETWEEN -10000 AND 100000),
  annual_contribution_growth_bps INTEGER NOT NULL CHECK(annual_contribution_growth_bps BETWEEN -10000 AND 100000),
  supersedes_plan_version_id TEXT REFERENCES long_term_portfolio_plan_versions(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL CHECK(datetime(created_at) IS NOT NULL),
  CHECK(substr(target_date,1,7)>=effective_month),
  UNIQUE(portfolio_id,version),
  UNIQUE(portfolio_id,effective_month)
) STRICT;

CREATE TABLE long_term_portfolio_allocations(
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 2 AND 160),
  portfolio_id TEXT NOT NULL REFERENCES long_term_portfolios(id) ON DELETE RESTRICT,
  plan_version_id TEXT NOT NULL REFERENCES long_term_portfolio_plan_versions(id) ON DELETE RESTRICT,
  instrument_id TEXT NOT NULL REFERENCES long_term_portfolio_instruments(id) ON DELETE RESTRICT,
  mutation_id TEXT NOT NULL REFERENCES long_term_portfolio_mutations(id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  privacy TEXT NOT NULL CHECK(privacy IN ('private','selected_members','family')),
  sleeve TEXT NOT NULL CHECK(sleeve IN ('core','growth','opportunity','ipo_reserve','liquidity','hedge','custom')),
  target_basis_points INTEGER NOT NULL CHECK(target_basis_points BETWEEN 0 AND 10000),
  carryover_policy TEXT NOT NULL CHECK(carryover_policy='same_instrument'),
  display_order INTEGER NOT NULL CHECK(display_order BETWEEN 1 AND 10000),
  note TEXT CHECK(note IS NULL OR length(trim(note)) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL CHECK(datetime(created_at) IS NOT NULL),
  UNIQUE(plan_version_id,instrument_id,sleeve)
) STRICT;

CREATE TABLE long_term_portfolio_plan_seals(
  plan_version_id TEXT PRIMARY KEY REFERENCES long_term_portfolio_plan_versions(id) ON DELETE RESTRICT,
  mutation_id TEXT NOT NULL REFERENCES long_term_portfolio_mutations(id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  privacy TEXT NOT NULL CHECK(privacy IN ('private','selected_members','family')),
  allocation_count INTEGER NOT NULL CHECK(allocation_count BETWEEN 1 AND 10000),
  total_basis_points INTEGER NOT NULL CHECK(total_basis_points=10000),
  created_at TEXT NOT NULL CHECK(datetime(created_at) IS NOT NULL)
) STRICT;

CREATE TABLE long_term_portfolio_ledger_events(
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 2 AND 160),
  portfolio_id TEXT NOT NULL REFERENCES long_term_portfolios(id) ON DELETE RESTRICT,
  instrument_id TEXT REFERENCES long_term_portfolio_instruments(id) ON DELETE RESTRICT,
  mutation_id TEXT NOT NULL UNIQUE REFERENCES long_term_portfolio_mutations(id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  privacy TEXT NOT NULL CHECK(privacy IN ('private','selected_members','family')),
  event_type TEXT NOT NULL CHECK(event_type IN ('buy','sell','cash_dividend','rights_issue_used','rights_issue_sold','rights_issue_expired','bonus_shares','split','reverse_split','coupon','interest','fund_distribution','merger_exchange','code_change','transfer_in','transfer_out','fee','tax','cash_adjustment','reversal')),
  direction TEXT NOT NULL CHECK(direction IN ('cash_in','cash_out','security_in','security_out','non_cash')),
  currency TEXT NOT NULL CHECK(length(currency)=3 AND currency=upper(currency) AND currency GLOB '[A-Z][A-Z][A-Z]'),
  order_at TEXT CHECK(order_at IS NULL OR datetime(order_at) IS NOT NULL),
  executed_at TEXT NOT NULL CHECK(datetime(executed_at) IS NOT NULL),
  settlement_at TEXT CHECK(settlement_at IS NULL OR datetime(settlement_at) IS NOT NULL),
  entitlement_at TEXT CHECK(entitlement_at IS NULL OR datetime(entitlement_at) IS NOT NULL),
  record_at TEXT CHECK(record_at IS NULL OR datetime(record_at) IS NOT NULL),
  payment_at TEXT CHECK(payment_at IS NULL OR datetime(payment_at) IS NOT NULL),
  quantity REAL CHECK(quantity IS NULL OR (quantity>0 AND quantity<=1000000000000000)),
  unit_price REAL CHECK(unit_price IS NULL OR (unit_price>=0 AND unit_price<=1000000000000000)),
  gross_amount REAL NOT NULL CHECK(gross_amount>=0 AND gross_amount<=1000000000000000),
  fee_amount REAL NOT NULL CHECK(fee_amount>=0 AND fee_amount<=1000000000000000),
  tax_amount REAL NOT NULL CHECK(tax_amount>=0 AND tax_amount<=1000000000000000),
  net_cash_amount REAL NOT NULL CHECK(abs(net_cash_amount)<=1000000000000000),
  fx_rate REAL CHECK(fx_rate IS NULL OR (fx_rate>0 AND fx_rate<=1000000000)),
  broker TEXT CHECK(broker IS NULL OR length(trim(broker)) BETWEEN 1 AND 160),
  account_reference TEXT CHECK(account_reference IS NULL OR length(trim(account_reference)) BETWEEN 1 AND 160),
  order_reference TEXT CHECK(order_reference IS NULL OR length(trim(order_reference)) BETWEEN 1 AND 160),
  execution_reference TEXT CHECK(execution_reference IS NULL OR length(trim(execution_reference)) BETWEEN 1 AND 160),
  partial_fill_sequence INTEGER CHECK(partial_fill_sequence IS NULL OR partial_fill_sequence BETWEEN 1 AND 1000000),
  lot_reference TEXT CHECK(lot_reference IS NULL OR length(trim(lot_reference)) BETWEEN 1 AND 160),
  cost_layer_method TEXT CHECK(cost_layer_method IS NULL OR cost_layer_method IN ('fifo','weighted_average','specific_lot','not_applicable')),
  corporate_action_reference TEXT CHECK(corporate_action_reference IS NULL OR length(trim(corporate_action_reference)) BETWEEN 1 AND 160),
  ratio_numerator REAL CHECK(ratio_numerator IS NULL OR ratio_numerator>0),
  ratio_denominator REAL CHECK(ratio_denominator IS NULL OR ratio_denominator>0),
  cash_carryover_instrument_id TEXT REFERENCES long_term_portfolio_instruments(id) ON DELETE RESTRICT,
  transfer_counterparty_instrument_id TEXT REFERENCES long_term_portfolio_instruments(id) ON DELETE RESTRICT,
  reversal_of_event_id TEXT UNIQUE REFERENCES long_term_portfolio_ledger_events(id) ON DELETE RESTRICT,
  correction_reason TEXT CHECK(correction_reason IS NULL OR length(trim(correction_reason)) BETWEEN 3 AND 500),
  source_label TEXT NOT NULL CHECK(length(trim(source_label)) BETWEEN 2 AND 180),
  source_document_reference TEXT CHECK(source_document_reference IS NULL OR length(trim(source_document_reference)) BETWEEN 1 AND 240),
  notes TEXT CHECK(notes IS NULL OR length(trim(notes)) BETWEEN 1 AND 1000),
  data_source TEXT NOT NULL CHECK(data_source IN ('user_entered','manual','csv_import')),
  external_verification TEXT NOT NULL CHECK(external_verification IN ('not_performed','user_confirmed','source_document_checked')),
  created_at TEXT NOT NULL CHECK(datetime(created_at) IS NOT NULL),
  CHECK(datetime(executed_at)<=datetime(created_at)),
  CHECK(order_at IS NULL OR datetime(order_at)<=datetime(executed_at)),
  CHECK(settlement_at IS NULL OR datetime(executed_at)<=datetime(settlement_at)),
  CHECK(entitlement_at IS NULL OR record_at IS NULL OR datetime(entitlement_at)<=datetime(record_at)),
  CHECK(entitlement_at IS NULL OR payment_at IS NULL OR datetime(entitlement_at)<=datetime(payment_at)),
  CHECK(record_at IS NULL OR payment_at IS NULL OR datetime(record_at)<=datetime(payment_at)),
  CHECK((event_type IN ('buy','rights_issue_used','fee','tax') AND direction='cash_out') OR (event_type IN ('sell','cash_dividend','rights_issue_sold','coupon','interest','fund_distribution') AND direction='cash_in') OR (event_type IN ('bonus_shares','transfer_in') AND direction='security_in') OR (event_type='rights_issue_expired' AND direction='security_out') OR (event_type IN ('split','reverse_split','merger_exchange','code_change','transfer_out','reversal') AND direction='non_cash') OR (event_type='cash_adjustment' AND direction IN ('cash_in','cash_out'))),
  CHECK(abs(net_cash_amount-CASE direction WHEN 'cash_out' THEN -(gross_amount+fee_amount+tax_amount) WHEN 'cash_in' THEN gross_amount-fee_amount-tax_amount ELSE 0 END)<=0.000001),
  CHECK((event_type='reversal' AND reversal_of_event_id IS NOT NULL AND correction_reason IS NOT NULL) OR (event_type<>'reversal' AND reversal_of_event_id IS NULL AND correction_reason IS NULL)),
  CHECK(event_type NOT IN ('buy','sell') OR (instrument_id IS NOT NULL AND order_at IS NOT NULL AND settlement_at IS NOT NULL AND quantity IS NOT NULL AND unit_price IS NOT NULL)),
  CHECK(event_type NOT IN ('buy','sell') OR abs(gross_amount-(quantity*unit_price))<=0.01),
  CHECK(event_type NOT IN ('buy','sell','rights_issue_used','rights_issue_sold','rights_issue_expired','bonus_shares','split','reverse_split','transfer_in') OR (instrument_id IS NOT NULL AND quantity IS NOT NULL)),
  CHECK(event_type NOT IN ('split','reverse_split','merger_exchange') OR (ratio_numerator IS NOT NULL AND ratio_denominator IS NOT NULL)),
  CHECK(event_type NOT IN ('cash_dividend','coupon','interest','fund_distribution') OR (instrument_id IS NOT NULL AND record_at IS NOT NULL AND payment_at IS NOT NULL)),
  CHECK((event_type='transfer_out' AND instrument_id IS NOT NULL AND transfer_counterparty_instrument_id IS NOT NULL AND transfer_counterparty_instrument_id<>instrument_id AND quantity IS NULL AND gross_amount>0) OR (event_type<>'transfer_out' AND transfer_counterparty_instrument_id IS NULL)),
  CHECK(event_type<>'transfer_in' OR source_document_reference IS NOT NULL),
  CHECK(event_type NOT IN ('rights_issue_used','rights_issue_sold','rights_issue_expired','bonus_shares','split','reverse_split','merger_exchange','code_change') OR (instrument_id IS NOT NULL AND corporate_action_reference IS NOT NULL))
) STRICT;

CREATE TABLE long_term_portfolio_price_observations(
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 2 AND 160),
  portfolio_id TEXT NOT NULL REFERENCES long_term_portfolios(id) ON DELETE RESTRICT,
  instrument_id TEXT NOT NULL REFERENCES long_term_portfolio_instruments(id) ON DELETE RESTRICT,
  mutation_id TEXT NOT NULL UNIQUE REFERENCES long_term_portfolio_mutations(id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  privacy TEXT NOT NULL CHECK(privacy IN ('private','selected_members','family')),
  observed_at TEXT NOT NULL CHECK(datetime(observed_at) IS NOT NULL),
  unit_price REAL NOT NULL CHECK(unit_price>0 AND unit_price<=1000000000000000),
  currency TEXT NOT NULL CHECK(length(currency)=3 AND currency=upper(currency) AND currency GLOB '[A-Z][A-Z][A-Z]'),
  source_label TEXT NOT NULL CHECK(length(trim(source_label)) BETWEEN 2 AND 180),
  data_source TEXT NOT NULL CHECK(data_source IN ('user_entered','manual','csv_import')),
  external_verification TEXT NOT NULL CHECK(external_verification IN ('not_performed','user_confirmed','source_document_checked')),
  created_at TEXT NOT NULL CHECK(datetime(created_at) IS NOT NULL),
  CHECK(datetime(observed_at)<=datetime(created_at)),
  UNIQUE(instrument_id,observed_at,source_label)
) STRICT;

CREATE INDEX idx_ltp_mutation_family_created ON long_term_portfolio_mutations(family_id,created_at DESC,id);
CREATE INDEX idx_ltp_instrument_family ON long_term_portfolio_instruments(family_id,created_at DESC,id);
CREATE INDEX idx_ltp_revision_current ON long_term_portfolio_instrument_revisions(instrument_id,effective_from DESC,created_at DESC);
CREATE INDEX idx_ltp_revision_code ON long_term_portfolio_instrument_revisions(family_id,code,effective_from DESC);
CREATE INDEX idx_ltp_portfolio_owner ON long_term_portfolios(owner_person_id,created_at DESC,id);
CREATE INDEX idx_ltp_plan_effective ON long_term_portfolio_plan_versions(portfolio_id,effective_month DESC,version DESC);
CREATE INDEX idx_ltp_allocation_plan ON long_term_portfolio_allocations(plan_version_id,display_order,id);
CREATE INDEX idx_ltp_plan_seal_family ON long_term_portfolio_plan_seals(family_id,created_at DESC,plan_version_id);
CREATE INDEX idx_ltp_event_portfolio_time ON long_term_portfolio_ledger_events(portfolio_id,executed_at DESC,id);
CREATE INDEX idx_ltp_event_instrument_time ON long_term_portfolio_ledger_events(instrument_id,executed_at DESC,id);
CREATE UNIQUE INDEX uq_ltp_event_execution ON long_term_portfolio_ledger_events(portfolio_id,coalesce(instrument_id,''),execution_reference,coalesce(partial_fill_sequence,0)) WHERE execution_reference IS NOT NULL;
CREATE INDEX idx_ltp_price_instrument_time ON long_term_portfolio_price_observations(instrument_id,observed_at DESC,id);

CREATE TRIGGER trg_ltp_mutation_policy_receipt BEFORE INSERT ON long_term_portfolio_mutations
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection
    ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
  JOIN accounts actor_account
    ON actor_account.id=json_extract(receipt.record_json,'$.request.subject.accountId')
      AND actor_account.status='active'
  JOIN people actor_person
    ON actor_person.id=json_extract(receipt.record_json,'$.request.subject.personId')
      AND actor_person.id=actor_account.person_id
      AND actor_person.family_id=NEW.family_id
      AND actor_person.status='active'
  JOIN people owner_person
    ON owner_person.id=NEW.owner_person_id
      AND owner_person.family_id=NEW.family_id
      AND owner_person.status='active'
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='finance_record'
    AND receipt.resource_id=NEW.id
    AND receipt.action='create'
    AND receipt.capability='finance.write'
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE NEW.privacy
      WHEN 'private' THEN 'highly_sensitive'
      WHEN 'selected_members' THEN 'sensitive'
      ELSE 'personal'
    END
    AND json_extract(receipt.record_json,'$.request.purpose')='finance'
    AND json_extract(receipt.record_json,'$.request.occurredAt')=NEW.created_at
)
OR EXISTS(SELECT 1 FROM finance_records WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_valuations WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM bank_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM payment_cards WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM loan_payment_history WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_planning_ledger WHERE policy_receipt_hash=NEW.policy_receipt_hash)
OR EXISTS(SELECT 1 FROM finance_import_batches WHERE policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'long-term portfolio mutation requires an unused exact durable finance policy receipt'); END;

CREATE TRIGGER trg_ltp_finance_record_receipt_reuse BEFORE INSERT ON finance_records WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(SELECT 1 FROM long_term_portfolio_mutations WHERE policy_receipt_hash=NEW.policy_receipt_hash) BEGIN SELECT RAISE(ABORT,'finance policy receipt is already bound to a long-term portfolio mutation'); END;
CREATE TRIGGER trg_ltp_finance_valuation_receipt_reuse BEFORE INSERT ON finance_valuations WHEN NEW.policy_receipt_hash IS NOT NULL AND EXISTS(SELECT 1 FROM long_term_portfolio_mutations WHERE policy_receipt_hash=NEW.policy_receipt_hash) BEGIN SELECT RAISE(ABORT,'finance policy receipt is already bound to a long-term portfolio mutation'); END;
CREATE TRIGGER trg_ltp_bank_account_receipt_reuse BEFORE INSERT ON bank_accounts WHEN EXISTS(SELECT 1 FROM long_term_portfolio_mutations WHERE policy_receipt_hash=NEW.policy_receipt_hash) BEGIN SELECT RAISE(ABORT,'finance policy receipt is already bound to a long-term portfolio mutation'); END;
CREATE TRIGGER trg_ltp_payment_card_receipt_reuse BEFORE INSERT ON payment_cards WHEN EXISTS(SELECT 1 FROM long_term_portfolio_mutations WHERE policy_receipt_hash=NEW.policy_receipt_hash) BEGIN SELECT RAISE(ABORT,'finance policy receipt is already bound to a long-term portfolio mutation'); END;
CREATE TRIGGER trg_ltp_loan_account_receipt_reuse BEFORE INSERT ON loan_accounts WHEN EXISTS(SELECT 1 FROM long_term_portfolio_mutations WHERE policy_receipt_hash=NEW.policy_receipt_hash) BEGIN SELECT RAISE(ABORT,'finance policy receipt is already bound to a long-term portfolio mutation'); END;
CREATE TRIGGER trg_ltp_loan_payment_receipt_reuse BEFORE INSERT ON loan_payment_history WHEN EXISTS(SELECT 1 FROM long_term_portfolio_mutations WHERE policy_receipt_hash=NEW.policy_receipt_hash) BEGIN SELECT RAISE(ABORT,'finance policy receipt is already bound to a long-term portfolio mutation'); END;
CREATE TRIGGER trg_ltp_planning_receipt_reuse BEFORE INSERT ON finance_planning_ledger WHEN EXISTS(SELECT 1 FROM long_term_portfolio_mutations WHERE policy_receipt_hash=NEW.policy_receipt_hash) BEGIN SELECT RAISE(ABORT,'finance policy receipt is already bound to a long-term portfolio mutation'); END;
CREATE TRIGGER trg_ltp_import_receipt_reuse BEFORE INSERT ON finance_import_batches WHEN EXISTS(SELECT 1 FROM long_term_portfolio_mutations WHERE policy_receipt_hash=NEW.policy_receipt_hash) BEGIN SELECT RAISE(ABORT,'finance policy receipt is already bound to a long-term portfolio mutation'); END;

CREATE TRIGGER trg_ltp_instrument_scope BEFORE INSERT ON long_term_portfolio_instruments WHEN NOT EXISTS(SELECT 1 FROM long_term_portfolio_mutations mutation WHERE mutation.id=NEW.mutation_id AND mutation.family_id=NEW.family_id AND mutation.owner_person_id=NEW.owner_person_id AND mutation.privacy=NEW.privacy AND mutation.operation IN ('bootstrap_default','instrument_revision')) BEGIN SELECT RAISE(ABORT,'stable instrument scope does not match its mutation'); END;
CREATE TRIGGER trg_ltp_revision_linear_history BEFORE INSERT ON long_term_portfolio_instrument_revisions WHEN (NEW.replaces_revision_id IS NULL AND EXISTS(SELECT 1 FROM long_term_portfolio_instrument_revisions prior WHERE prior.instrument_id=NEW.instrument_id)) OR (NEW.replaces_revision_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_instrument_revisions previous WHERE previous.revision_id=NEW.replaces_revision_id AND previous.instrument_id=NEW.instrument_id AND datetime(previous.effective_from)<datetime(NEW.effective_from) AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_instrument_revisions later WHERE later.instrument_id=previous.instrument_id AND datetime(later.effective_from)>datetime(previous.effective_from)))) BEGIN SELECT RAISE(ABORT,'instrument revisions must form one strictly ordered linear history'); END;
CREATE TRIGGER trg_ltp_revision_scope BEFORE INSERT ON long_term_portfolio_instrument_revisions WHEN NOT EXISTS(SELECT 1 FROM long_term_portfolio_instruments instrument JOIN long_term_portfolio_mutations mutation ON mutation.id=NEW.mutation_id WHERE instrument.id=NEW.instrument_id AND instrument.family_id=NEW.family_id AND instrument.owner_person_id=NEW.owner_person_id AND instrument.privacy=NEW.privacy AND mutation.family_id=NEW.family_id AND mutation.owner_person_id=NEW.owner_person_id AND mutation.privacy=NEW.privacy AND mutation.operation IN ('bootstrap_default','instrument_revision')) OR (NEW.replaces_revision_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_instrument_revisions previous WHERE previous.revision_id=NEW.replaces_revision_id AND previous.instrument_id=NEW.instrument_id AND previous.family_id=NEW.family_id AND previous.owner_person_id=NEW.owner_person_id AND previous.privacy=NEW.privacy)) BEGIN SELECT RAISE(ABORT,'instrument revision scope does not match its stable instrument and mutation'); END;
CREATE TRIGGER trg_ltp_portfolio_scope BEFORE INSERT ON long_term_portfolios WHEN NOT EXISTS(SELECT 1 FROM long_term_portfolio_mutations mutation WHERE mutation.id=NEW.mutation_id AND mutation.family_id=NEW.family_id AND mutation.owner_person_id=NEW.owner_person_id AND mutation.privacy=NEW.privacy AND mutation.operation='bootstrap_default') BEGIN SELECT RAISE(ABORT,'portfolio scope does not match bootstrap mutation'); END;
CREATE TRIGGER trg_ltp_plan_linear_history BEFORE INSERT ON long_term_portfolio_plan_versions WHEN (NEW.version=1 AND (NEW.supersedes_plan_version_id IS NOT NULL OR EXISTS(SELECT 1 FROM long_term_portfolio_plan_versions prior WHERE prior.portfolio_id=NEW.portfolio_id))) OR (NEW.version>1 AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_plan_versions previous WHERE previous.id=NEW.supersedes_plan_version_id AND previous.portfolio_id=NEW.portfolio_id AND previous.version=NEW.version-1 AND previous.effective_month<NEW.effective_month AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_plan_versions later WHERE later.portfolio_id=previous.portfolio_id AND later.version>previous.version))) BEGIN SELECT RAISE(ABORT,'portfolio plans must form one forward effective-month history'); END;
CREATE TRIGGER trg_ltp_plan_scope BEFORE INSERT ON long_term_portfolio_plan_versions WHEN NOT EXISTS(SELECT 1 FROM long_term_portfolios portfolio JOIN long_term_portfolio_mutations mutation ON mutation.id=NEW.mutation_id WHERE portfolio.id=NEW.portfolio_id AND portfolio.family_id=NEW.family_id AND portfolio.owner_person_id=NEW.owner_person_id AND portfolio.privacy=NEW.privacy AND mutation.family_id=NEW.family_id AND mutation.owner_person_id=NEW.owner_person_id AND mutation.privacy=NEW.privacy AND mutation.operation IN ('bootstrap_default','plan_version')) BEGIN SELECT RAISE(ABORT,'plan version scope does not match portfolio and mutation'); END;
CREATE TRIGGER trg_ltp_allocation_after_seal BEFORE INSERT ON long_term_portfolio_allocations WHEN EXISTS(SELECT 1 FROM long_term_portfolio_plan_seals seal WHERE seal.plan_version_id=NEW.plan_version_id) BEGIN SELECT RAISE(ABORT,'sealed plan allocations cannot be extended'); END;
CREATE TRIGGER trg_ltp_allocation_scope BEFORE INSERT ON long_term_portfolio_allocations WHEN NOT EXISTS(SELECT 1 FROM long_term_portfolio_plan_versions plan JOIN long_term_portfolios portfolio ON portfolio.id=NEW.portfolio_id JOIN long_term_portfolio_instruments instrument ON instrument.id=NEW.instrument_id JOIN long_term_portfolio_mutations mutation ON mutation.id=NEW.mutation_id WHERE plan.id=NEW.plan_version_id AND plan.portfolio_id=portfolio.id AND plan.family_id=NEW.family_id AND plan.owner_person_id=NEW.owner_person_id AND plan.privacy=NEW.privacy AND portfolio.family_id=NEW.family_id AND portfolio.owner_person_id=NEW.owner_person_id AND portfolio.privacy=NEW.privacy AND instrument.family_id=NEW.family_id AND instrument.owner_person_id=NEW.owner_person_id AND instrument.privacy=NEW.privacy AND mutation.family_id=NEW.family_id AND mutation.owner_person_id=NEW.owner_person_id AND mutation.privacy=NEW.privacy AND mutation.operation IN ('bootstrap_default','plan_version')) BEGIN SELECT RAISE(ABORT,'allocation scope does not match plan, instrument and mutation'); END;
CREATE TRIGGER trg_ltp_plan_seal_scope BEFORE INSERT ON long_term_portfolio_plan_seals WHEN NOT EXISTS(SELECT 1 FROM long_term_portfolio_plan_versions plan JOIN long_term_portfolio_mutations mutation ON mutation.id=NEW.mutation_id WHERE plan.id=NEW.plan_version_id AND plan.mutation_id=NEW.mutation_id AND plan.family_id=NEW.family_id AND plan.owner_person_id=NEW.owner_person_id AND plan.privacy=NEW.privacy AND mutation.family_id=NEW.family_id AND mutation.owner_person_id=NEW.owner_person_id AND mutation.privacy=NEW.privacy AND mutation.operation IN ('bootstrap_default','plan_version')) OR NEW.allocation_count<>(SELECT count(*) FROM long_term_portfolio_allocations allocation WHERE allocation.plan_version_id=NEW.plan_version_id AND allocation.family_id=NEW.family_id AND allocation.owner_person_id=NEW.owner_person_id AND allocation.privacy=NEW.privacy) OR NEW.total_basis_points<>(SELECT coalesce(sum(allocation.target_basis_points),0) FROM long_term_portfolio_allocations allocation WHERE allocation.plan_version_id=NEW.plan_version_id AND allocation.family_id=NEW.family_id AND allocation.owner_person_id=NEW.owner_person_id AND allocation.privacy=NEW.privacy) BEGIN SELECT RAISE(ABORT,'plan seal requires an exact non-empty 100 percent allocation aggregate'); END;
CREATE TRIGGER trg_ltp_event_scope BEFORE INSERT ON long_term_portfolio_ledger_events WHEN NOT EXISTS(SELECT 1 FROM long_term_portfolios portfolio JOIN long_term_portfolio_mutations mutation ON mutation.id=NEW.mutation_id WHERE portfolio.id=NEW.portfolio_id AND portfolio.family_id=NEW.family_id AND portfolio.owner_person_id=NEW.owner_person_id AND portfolio.privacy=NEW.privacy AND mutation.family_id=NEW.family_id AND mutation.owner_person_id=NEW.owner_person_id AND mutation.privacy=NEW.privacy AND mutation.operation='ledger_event') OR (NEW.instrument_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_instruments instrument WHERE instrument.id=NEW.instrument_id AND instrument.family_id=NEW.family_id AND instrument.owner_person_id=NEW.owner_person_id AND instrument.privacy=NEW.privacy)) OR (NEW.cash_carryover_instrument_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_instruments instrument WHERE instrument.id=NEW.cash_carryover_instrument_id AND instrument.family_id=NEW.family_id AND instrument.owner_person_id=NEW.owner_person_id AND instrument.privacy=NEW.privacy)) OR (NEW.transfer_counterparty_instrument_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_instruments instrument WHERE instrument.id=NEW.transfer_counterparty_instrument_id AND instrument.family_id=NEW.family_id AND instrument.owner_person_id=NEW.owner_person_id AND instrument.privacy=NEW.privacy)) OR (NEW.reversal_of_event_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_ledger_events original WHERE original.id=NEW.reversal_of_event_id AND original.portfolio_id=NEW.portfolio_id AND original.family_id=NEW.family_id AND original.owner_person_id=NEW.owner_person_id AND original.privacy=NEW.privacy AND original.event_type<>'reversal')) BEGIN SELECT RAISE(ABORT,'ledger event scope or reversal target is invalid'); END;
CREATE TRIGGER trg_ltp_event_fx_rate BEFORE INSERT ON long_term_portfolio_ledger_events WHEN NEW.currency<>(SELECT portfolio.base_currency FROM long_term_portfolios portfolio WHERE portfolio.id=NEW.portfolio_id) AND NEW.fx_rate IS NULL BEGIN SELECT RAISE(ABORT,'foreign-currency ledger events require an explicit base-currency fx rate'); END;
CREATE TRIGGER trg_ltp_event_currency BEFORE INSERT ON long_term_portfolio_ledger_events WHEN (NEW.instrument_id IS NULL AND NOT EXISTS(SELECT 1 FROM long_term_portfolios portfolio WHERE portfolio.id=NEW.portfolio_id AND portfolio.base_currency=NEW.currency)) OR (NEW.instrument_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_instrument_revisions revision WHERE revision.instrument_id=NEW.instrument_id AND revision.currency=NEW.currency AND datetime(revision.effective_from)<=datetime(NEW.executed_at) AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_instrument_revisions later WHERE later.instrument_id=revision.instrument_id AND datetime(later.effective_from)<=datetime(NEW.executed_at) AND datetime(later.effective_from)>datetime(revision.effective_from)))) OR (NEW.transfer_counterparty_instrument_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_instrument_revisions revision WHERE revision.instrument_id=NEW.transfer_counterparty_instrument_id AND revision.currency=NEW.currency AND datetime(revision.effective_from)<=datetime(NEW.executed_at) AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_instrument_revisions later WHERE later.instrument_id=revision.instrument_id AND datetime(later.effective_from)<=datetime(NEW.executed_at) AND datetime(later.effective_from)>datetime(revision.effective_from)))) BEGIN SELECT RAISE(ABORT,'ledger currency must match the effective instrument or portfolio base currency'); END;
CREATE TRIGGER trg_ltp_event_quantity_balance BEFORE INSERT ON long_term_portfolio_ledger_events
WHEN NEW.instrument_id IS NOT NULL AND NEW.event_type IN ('sell','rights_issue_sold','rights_issue_expired','reverse_split') AND (
  coalesce((SELECT sum(CASE event.event_type WHEN 'buy' THEN coalesce(event.quantity,0) WHEN 'transfer_in' THEN coalesce(event.quantity,0) WHEN 'bonus_shares' THEN coalesce(event.quantity,0) WHEN 'rights_issue_used' THEN coalesce(event.quantity,0) WHEN 'split' THEN coalesce(event.quantity,0) WHEN 'sell' THEN -coalesce(event.quantity,0) WHEN 'rights_issue_sold' THEN -coalesce(event.quantity,0) WHEN 'rights_issue_expired' THEN -coalesce(event.quantity,0) WHEN 'reverse_split' THEN -coalesce(event.quantity,0) ELSE 0 END) FROM long_term_portfolio_ledger_events event WHERE event.portfolio_id=NEW.portfolio_id AND event.instrument_id=NEW.instrument_id AND datetime(event.executed_at)<=datetime(NEW.executed_at) AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_ledger_events reversal WHERE reversal.reversal_of_event_id=event.id)),0)-NEW.quantity < -0.000001
  OR EXISTS(SELECT 1 FROM long_term_portfolio_ledger_events pivot WHERE pivot.portfolio_id=NEW.portfolio_id AND pivot.instrument_id=NEW.instrument_id AND datetime(pivot.executed_at)>=datetime(NEW.executed_at) AND coalesce((SELECT sum(CASE event.event_type WHEN 'buy' THEN coalesce(event.quantity,0) WHEN 'transfer_in' THEN coalesce(event.quantity,0) WHEN 'bonus_shares' THEN coalesce(event.quantity,0) WHEN 'rights_issue_used' THEN coalesce(event.quantity,0) WHEN 'split' THEN coalesce(event.quantity,0) WHEN 'sell' THEN -coalesce(event.quantity,0) WHEN 'rights_issue_sold' THEN -coalesce(event.quantity,0) WHEN 'rights_issue_expired' THEN -coalesce(event.quantity,0) WHEN 'reverse_split' THEN -coalesce(event.quantity,0) ELSE 0 END) FROM long_term_portfolio_ledger_events event WHERE event.portfolio_id=NEW.portfolio_id AND event.instrument_id=NEW.instrument_id AND datetime(event.executed_at)<=datetime(pivot.executed_at) AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_ledger_events reversal WHERE reversal.reversal_of_event_id=event.id)),0)-NEW.quantity < -0.000001)
) BEGIN SELECT RAISE(ABORT,'ledger event would make the instrument quantity negative'); END;
CREATE TRIGGER trg_ltp_reversal_quantity_balance BEFORE INSERT ON long_term_portfolio_ledger_events
WHEN NEW.event_type='reversal' AND EXISTS(SELECT 1 FROM long_term_portfolio_ledger_events original WHERE original.id=NEW.reversal_of_event_id AND original.instrument_id IS NOT NULL AND original.event_type IN ('buy','transfer_in','bonus_shares','rights_issue_used','split')) AND EXISTS(
  SELECT 1 FROM long_term_portfolio_ledger_events pivot JOIN long_term_portfolio_ledger_events original ON original.id=NEW.reversal_of_event_id
  WHERE pivot.portfolio_id=original.portfolio_id AND pivot.instrument_id=original.instrument_id AND datetime(pivot.executed_at)>=datetime(original.executed_at) AND coalesce((SELECT sum(CASE event.event_type WHEN 'buy' THEN coalesce(event.quantity,0) WHEN 'transfer_in' THEN coalesce(event.quantity,0) WHEN 'bonus_shares' THEN coalesce(event.quantity,0) WHEN 'rights_issue_used' THEN coalesce(event.quantity,0) WHEN 'split' THEN coalesce(event.quantity,0) WHEN 'sell' THEN -coalesce(event.quantity,0) WHEN 'rights_issue_sold' THEN -coalesce(event.quantity,0) WHEN 'rights_issue_expired' THEN -coalesce(event.quantity,0) WHEN 'reverse_split' THEN -coalesce(event.quantity,0) ELSE 0 END) FROM long_term_portfolio_ledger_events event WHERE event.portfolio_id=original.portfolio_id AND event.instrument_id=original.instrument_id AND event.id<>original.id AND datetime(event.executed_at)<=datetime(pivot.executed_at) AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_ledger_events reversal WHERE reversal.reversal_of_event_id=event.id)),0) < -0.000001
) BEGIN SELECT RAISE(ABORT,'reversal would make the instrument quantity negative'); END;
CREATE TRIGGER trg_ltp_price_scope BEFORE INSERT ON long_term_portfolio_price_observations WHEN NOT EXISTS(SELECT 1 FROM long_term_portfolios portfolio JOIN long_term_portfolio_instruments instrument ON instrument.id=NEW.instrument_id JOIN long_term_portfolio_mutations mutation ON mutation.id=NEW.mutation_id WHERE portfolio.id=NEW.portfolio_id AND portfolio.family_id=NEW.family_id AND portfolio.owner_person_id=NEW.owner_person_id AND portfolio.privacy=NEW.privacy AND instrument.family_id=NEW.family_id AND instrument.owner_person_id=NEW.owner_person_id AND instrument.privacy=NEW.privacy AND mutation.family_id=NEW.family_id AND mutation.owner_person_id=NEW.owner_person_id AND mutation.privacy=NEW.privacy AND mutation.operation='price_observation') BEGIN SELECT RAISE(ABORT,'price observation scope does not match portfolio, instrument and mutation'); END;
CREATE TRIGGER trg_ltp_price_currency BEFORE INSERT ON long_term_portfolio_price_observations WHEN NOT EXISTS(SELECT 1 FROM long_term_portfolio_instrument_revisions revision WHERE revision.instrument_id=NEW.instrument_id AND revision.currency=NEW.currency AND datetime(revision.effective_from)<=datetime(NEW.observed_at) AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_instrument_revisions later WHERE later.instrument_id=revision.instrument_id AND datetime(later.effective_from)<=datetime(NEW.observed_at) AND datetime(later.effective_from)>datetime(revision.effective_from))) BEGIN SELECT RAISE(ABORT,'price currency must match the effective instrument revision'); END;

CREATE TRIGGER trg_ltp_mutation_update BEFORE UPDATE ON long_term_portfolio_mutations BEGIN SELECT RAISE(ABORT,'long-term portfolio mutation ledger is append-only'); END;
CREATE TRIGGER trg_ltp_mutation_delete BEFORE DELETE ON long_term_portfolio_mutations BEGIN SELECT RAISE(ABORT,'long-term portfolio mutation deletion requires governed lifecycle'); END;
CREATE TRIGGER trg_ltp_instrument_update BEFORE UPDATE ON long_term_portfolio_instruments BEGIN SELECT RAISE(ABORT,'long-term portfolio stable instruments are immutable'); END;
CREATE TRIGGER trg_ltp_instrument_delete BEFORE DELETE ON long_term_portfolio_instruments BEGIN SELECT RAISE(ABORT,'long-term portfolio instrument deletion is forbidden; append a revision'); END;
CREATE TRIGGER trg_ltp_revision_update BEFORE UPDATE ON long_term_portfolio_instrument_revisions BEGIN SELECT RAISE(ABORT,'long-term portfolio instrument revisions are append-only'); END;
CREATE TRIGGER trg_ltp_revision_delete BEFORE DELETE ON long_term_portfolio_instrument_revisions BEGIN SELECT RAISE(ABORT,'long-term portfolio instrument revision deletion is forbidden'); END;
CREATE TRIGGER trg_ltp_portfolio_update BEFORE UPDATE ON long_term_portfolios BEGIN SELECT RAISE(ABORT,'long-term portfolios are immutable'); END;
CREATE TRIGGER trg_ltp_portfolio_delete BEFORE DELETE ON long_term_portfolios BEGIN SELECT RAISE(ABORT,'long-term portfolio deletion requires governed lifecycle'); END;
CREATE TRIGGER trg_ltp_plan_update BEFORE UPDATE ON long_term_portfolio_plan_versions BEGIN SELECT RAISE(ABORT,'long-term portfolio plans are versioned and immutable'); END;
CREATE TRIGGER trg_ltp_plan_delete BEFORE DELETE ON long_term_portfolio_plan_versions BEGIN SELECT RAISE(ABORT,'long-term portfolio plan deletion is forbidden'); END;
CREATE TRIGGER trg_ltp_allocation_update BEFORE UPDATE ON long_term_portfolio_allocations BEGIN SELECT RAISE(ABORT,'long-term portfolio allocations are versioned and immutable'); END;
CREATE TRIGGER trg_ltp_allocation_delete BEFORE DELETE ON long_term_portfolio_allocations BEGIN SELECT RAISE(ABORT,'long-term portfolio allocation deletion is forbidden'); END;
CREATE TRIGGER trg_ltp_plan_seal_update BEFORE UPDATE ON long_term_portfolio_plan_seals BEGIN SELECT RAISE(ABORT,'long-term portfolio plan seals are immutable'); END;
CREATE TRIGGER trg_ltp_plan_seal_delete BEFORE DELETE ON long_term_portfolio_plan_seals BEGIN SELECT RAISE(ABORT,'long-term portfolio plan seal deletion is forbidden'); END;
CREATE TRIGGER trg_ltp_event_update BEFORE UPDATE ON long_term_portfolio_ledger_events BEGIN SELECT RAISE(ABORT,'long-term portfolio ledger is append-only; use a reversal'); END;
CREATE TRIGGER trg_ltp_event_delete BEFORE DELETE ON long_term_portfolio_ledger_events BEGIN SELECT RAISE(ABORT,'long-term portfolio ledger deletion is forbidden; use a reversal'); END;
CREATE TRIGGER trg_ltp_price_update BEFORE UPDATE ON long_term_portfolio_price_observations BEGIN SELECT RAISE(ABORT,'long-term portfolio price observations are append-only'); END;
CREATE TRIGGER trg_ltp_price_delete BEFORE DELETE ON long_term_portfolio_price_observations BEGIN SELECT RAISE(ABORT,'long-term portfolio price observation deletion is forbidden'); END;

UPDATE database_metadata SET value='REVISION-33-L-LONG-TERM-PORTFOLIO',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key='schema_generation';
`;

const accessibilityPreferencesSql = `CREATE TABLE accessibility_preference_mutations(
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 2 AND 160),
  client_operation_id TEXT NOT NULL CHECK(length(trim(client_operation_id)) BETWEEN 8 AND 128),
  request_fingerprint TEXT NOT NULL CHECK(length(request_fingerprint)=64 AND request_fingerprint NOT GLOB '*[^0-9a-f]*'),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  previous_revision INTEGER NOT NULL CHECK(previous_revision BETWEEN 0 AND 2147483646),
  revision INTEGER NOT NULL CHECK(revision=previous_revision+1 AND revision BETWEEN 1 AND 2147483647),
  text_scale TEXT NOT NULL CHECK(text_scale IN ('standard','large','extra-large')),
  text_scale_percent INTEGER NOT NULL CHECK(text_scale_percent BETWEEN 100 AND 225),
  high_contrast INTEGER NOT NULL CHECK(high_contrast IN (0,1)),
  reduce_motion INTEGER NOT NULL CHECK(reduce_motion IN (0,1)),
  theme TEXT NOT NULL CHECK(theme IN ('system','light','dark')),
  density TEXT NOT NULL CHECK(density IN ('comfortable','standard','compact')),
  reading_mode TEXT NOT NULL CHECK(reading_mode IN ('standard','easy-read')),
  audience_profile TEXT NOT NULL CHECK(audience_profile IN ('youth','standard','senior','low-vision','caregiver')),
  captions_enabled INTEGER NOT NULL CHECK(captions_enabled IN (0,1)),
  audio_muted INTEGER NOT NULL CHECK(audio_muted IN (0,1)),
  created_at TEXT NOT NULL CHECK(length(created_at)=24 AND created_at GLOB '????-??-??T??:??:??.???Z' AND julianday(created_at) IS NOT NULL),
  policy_receipt_hash TEXT NOT NULL UNIQUE REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*'),
  policy_receipt_version INTEGER NOT NULL CHECK(policy_receipt_version=1),
  policy_receipt_nonce TEXT NOT NULL UNIQUE CHECK(length(trim(policy_receipt_nonce)) BETWEEN 1 AND 256),
  policy_correlation_id TEXT NOT NULL CHECK(length(trim(policy_correlation_id)) BETWEEN 1 AND 128),
  policy_resource_type TEXT NOT NULL CHECK(policy_resource_type='accessibility_preferences'),
  policy_resource_id TEXT NOT NULL CHECK(policy_resource_id=account_id),
  policy_action TEXT NOT NULL CHECK(policy_action IN ('create','update')),
  policy_capability TEXT NOT NULL CHECK(policy_capability='family.write'),
  UNIQUE(family_id,account_id,client_operation_id),
  UNIQUE(account_id,revision)
) STRICT;

CREATE TABLE accessibility_preferences(
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 2147483647),
  text_scale TEXT NOT NULL CHECK(text_scale IN ('standard','large','extra-large')),
  text_scale_percent INTEGER NOT NULL CHECK(text_scale_percent BETWEEN 100 AND 225),
  high_contrast INTEGER NOT NULL CHECK(high_contrast IN (0,1)),
  reduce_motion INTEGER NOT NULL CHECK(reduce_motion IN (0,1)),
  theme TEXT NOT NULL CHECK(theme IN ('system','light','dark')),
  density TEXT NOT NULL CHECK(density IN ('comfortable','standard','compact')),
  reading_mode TEXT NOT NULL CHECK(reading_mode IN ('standard','easy-read')),
  audience_profile TEXT NOT NULL CHECK(audience_profile IN ('youth','standard','senior','low-vision','caregiver')),
  captions_enabled INTEGER NOT NULL CHECK(captions_enabled IN (0,1)),
  audio_muted INTEGER NOT NULL CHECK(audio_muted IN (0,1)),
  created_at TEXT NOT NULL CHECK(length(created_at)=24 AND created_at GLOB '????-??-??T??:??:??.???Z' AND julianday(created_at) IS NOT NULL),
  updated_at TEXT NOT NULL CHECK(length(updated_at)=24 AND updated_at GLOB '????-??-??T??:??:??.???Z' AND julianday(updated_at) IS NOT NULL),
  last_mutation_id TEXT NOT NULL UNIQUE REFERENCES accessibility_preference_mutations(id) ON DELETE RESTRICT,
  CHECK(julianday(created_at)<=julianday(updated_at))
) STRICT;

CREATE INDEX idx_accessibility_preference_mutations_account_created
ON accessibility_preference_mutations(family_id,account_id,created_at DESC,id);
CREATE INDEX idx_accessibility_preferences_family_owner
ON accessibility_preferences(family_id,owner_person_id,account_id);

CREATE TRIGGER trg_accessibility_mutation_idempotency_mismatch
BEFORE INSERT ON accessibility_preference_mutations
WHEN EXISTS(
  SELECT 1 FROM accessibility_preference_mutations prior
  WHERE prior.family_id=NEW.family_id
    AND prior.account_id=NEW.account_id
    AND prior.client_operation_id=NEW.client_operation_id
    AND prior.request_fingerprint<>NEW.request_fingerprint
)
BEGIN SELECT RAISE(ABORT,'accessibility preference idempotency fingerprint mismatch'); END;

CREATE TRIGGER trg_accessibility_mutation_revision
BEFORE INSERT ON accessibility_preference_mutations
WHEN NOT (
  (NEW.previous_revision=0 AND NEW.revision=1 AND NOT EXISTS(
    SELECT 1 FROM accessibility_preferences current WHERE current.account_id=NEW.account_id
  ))
  OR EXISTS(
    SELECT 1 FROM accessibility_preferences current
    WHERE current.account_id=NEW.account_id
      AND current.family_id=NEW.family_id
      AND current.owner_person_id=NEW.owner_person_id
      AND current.revision=NEW.previous_revision
      AND NEW.revision=current.revision+1
  )
)
BEGIN SELECT RAISE(ABORT,'accessibility preference optimistic revision mismatch'); END;

CREATE TRIGGER trg_accessibility_mutation_policy_receipt
BEFORE INSERT ON accessibility_preference_mutations
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection
    ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
  JOIN accounts active_account
    ON active_account.id=NEW.account_id
      AND active_account.status='active'
      AND active_account.person_id=NEW.owner_person_id
  JOIN people active_person
    ON active_person.id=NEW.owner_person_id
      AND active_person.family_id=NEW.family_id
      AND active_person.status='active'
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='accessibility_preferences'
    AND receipt.resource_id=NEW.account_id
    AND receipt.action=CASE NEW.previous_revision WHEN 0 THEN 'create' ELSE 'update' END
    AND receipt.capability='family.write'
    AND json_extract(receipt.record_json,'$.request.subject.accountId')=NEW.account_id
    AND json_extract(receipt.record_json,'$.request.subject.personId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.resource.sensitivity')='personal'
    AND json_extract(receipt.record_json,'$.request.purpose')='general'
    AND json_extract(receipt.record_json,'$.request.occurredAt')=NEW.created_at
)
BEGIN SELECT RAISE(ABORT,'accessibility preference mutation requires an exact active personal policy receipt'); END;

CREATE TRIGGER trg_accessibility_current_insert
BEFORE INSERT ON accessibility_preferences
WHEN NOT EXISTS(
  SELECT 1 FROM accessibility_preference_mutations mutation
  WHERE mutation.id=NEW.last_mutation_id
    AND mutation.account_id=NEW.account_id
    AND mutation.family_id=NEW.family_id
    AND mutation.owner_person_id=NEW.owner_person_id
    AND mutation.previous_revision=0
    AND mutation.revision=NEW.revision
    AND mutation.text_scale=NEW.text_scale
    AND mutation.text_scale_percent=NEW.text_scale_percent
    AND mutation.high_contrast=NEW.high_contrast
    AND mutation.reduce_motion=NEW.reduce_motion
    AND mutation.theme=NEW.theme
    AND mutation.density=NEW.density
    AND mutation.reading_mode=NEW.reading_mode
    AND mutation.audience_profile=NEW.audience_profile
    AND mutation.captions_enabled=NEW.captions_enabled
    AND mutation.audio_muted=NEW.audio_muted
    AND mutation.created_at=NEW.created_at
    AND mutation.created_at=NEW.updated_at
)
BEGIN SELECT RAISE(ABORT,'accessibility preference current row requires its exact initial mutation'); END;

CREATE TRIGGER trg_accessibility_current_update
BEFORE UPDATE ON accessibility_preferences
WHEN NEW.account_id<>OLD.account_id
  OR NEW.family_id<>OLD.family_id
  OR NEW.owner_person_id<>OLD.owner_person_id
  OR NEW.created_at<>OLD.created_at
  OR NOT EXISTS(
    SELECT 1 FROM accessibility_preference_mutations mutation
    WHERE mutation.id=NEW.last_mutation_id
      AND mutation.account_id=OLD.account_id
      AND mutation.family_id=OLD.family_id
      AND mutation.owner_person_id=OLD.owner_person_id
      AND mutation.previous_revision=OLD.revision
      AND mutation.revision=NEW.revision
      AND mutation.text_scale=NEW.text_scale
      AND mutation.text_scale_percent=NEW.text_scale_percent
      AND mutation.high_contrast=NEW.high_contrast
      AND mutation.reduce_motion=NEW.reduce_motion
      AND mutation.theme=NEW.theme
      AND mutation.density=NEW.density
      AND mutation.reading_mode=NEW.reading_mode
      AND mutation.audience_profile=NEW.audience_profile
      AND mutation.captions_enabled=NEW.captions_enabled
      AND mutation.audio_muted=NEW.audio_muted
      AND mutation.created_at=NEW.updated_at
  )
BEGIN SELECT RAISE(ABORT,'accessibility preference update requires its exact next mutation'); END;

CREATE TRIGGER trg_accessibility_mutation_update
BEFORE UPDATE ON accessibility_preference_mutations
BEGIN SELECT RAISE(ABORT,'accessibility preference mutations are immutable'); END;
CREATE TRIGGER trg_accessibility_mutation_delete
BEFORE DELETE ON accessibility_preference_mutations
BEGIN SELECT RAISE(ABORT,'accessibility preference mutation deletion is forbidden'); END;
CREATE TRIGGER trg_accessibility_current_delete
BEFORE DELETE ON accessibility_preferences
BEGIN SELECT RAISE(ABORT,'accessibility preference deletion is forbidden'); END;

UPDATE database_metadata SET value='REVISION-33-M-ACCESSIBILITY-PREFERENCES',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key='schema_generation';
`;

const governedFormDraftsSql = `CREATE TABLE governed_form_draft_mutations(
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 8 AND 160),
  client_operation_id TEXT NOT NULL CHECK(length(trim(client_operation_id)) BETWEEN 8 AND 128),
  request_fingerprint TEXT NOT NULL CHECK(length(request_fingerprint)=64 AND request_fingerprint NOT GLOB '*[^0-9a-f]*'),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  form_key TEXT NOT NULL CHECK(length(form_key) BETWEEN 3 AND 128 AND form_key=trim(form_key) AND form_key NOT GLOB '*[^A-Za-z0-9._:-]*'),
  resource_id TEXT NOT NULL CHECK(resource_id='form_draft/'||account_id||'/'||form_key),
  operation TEXT NOT NULL CHECK(operation IN ('save','undo')),
  previous_revision INTEGER NOT NULL CHECK(previous_revision BETWEEN 0 AND 2147483646),
  revision INTEGER NOT NULL CHECK(revision=previous_revision+1 AND revision BETWEEN 1 AND 2147483647),
  payload_json TEXT NOT NULL CHECK(length(CAST(payload_json AS BLOB)) BETWEEN 2 AND 65536 AND json_valid(payload_json)=1 AND json_type(payload_json)='object'),
  payload_fingerprint TEXT NOT NULL CHECK(length(payload_fingerprint)=64 AND payload_fingerprint NOT GLOB '*[^0-9a-f]*'),
  restored_from_revision INTEGER,
  created_at TEXT NOT NULL CHECK(length(created_at)=24 AND created_at GLOB '????-??-??T??:??:??.???Z' AND julianday(created_at) IS NOT NULL),
  policy_receipt_hash TEXT NOT NULL UNIQUE REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT CHECK(length(policy_receipt_hash)=64 AND policy_receipt_hash NOT GLOB '*[^0-9a-f]*'),
  policy_receipt_version INTEGER NOT NULL CHECK(policy_receipt_version=1),
  policy_receipt_nonce TEXT NOT NULL UNIQUE CHECK(length(trim(policy_receipt_nonce)) BETWEEN 1 AND 256),
  policy_correlation_id TEXT NOT NULL CHECK(length(trim(policy_correlation_id)) BETWEEN 1 AND 128),
  policy_resource_type TEXT NOT NULL CHECK(policy_resource_type='form_draft'),
  policy_resource_id TEXT NOT NULL CHECK(policy_resource_id=resource_id),
  policy_action TEXT NOT NULL CHECK(policy_action IN ('create','update')),
  policy_capability TEXT NOT NULL CHECK(policy_capability='family.write'),
  CHECK(
    (operation='save' AND restored_from_revision IS NULL)
    OR (operation='undo' AND previous_revision>=2 AND restored_from_revision=previous_revision-1)
  ),
  UNIQUE(family_id,account_id,form_key,client_operation_id),
  UNIQUE(account_id,form_key,revision),
  UNIQUE(resource_id,revision)
) STRICT;

CREATE TABLE governed_form_drafts(
  resource_id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  form_key TEXT NOT NULL CHECK(length(form_key) BETWEEN 3 AND 128 AND form_key=trim(form_key) AND form_key NOT GLOB '*[^A-Za-z0-9._:-]*'),
  revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 2147483647),
  payload_json TEXT NOT NULL CHECK(length(CAST(payload_json AS BLOB)) BETWEEN 2 AND 65536 AND json_valid(payload_json)=1 AND json_type(payload_json)='object'),
  payload_fingerprint TEXT NOT NULL CHECK(length(payload_fingerprint)=64 AND payload_fingerprint NOT GLOB '*[^0-9a-f]*'),
  created_at TEXT NOT NULL CHECK(length(created_at)=24 AND created_at GLOB '????-??-??T??:??:??.???Z' AND julianday(created_at) IS NOT NULL),
  updated_at TEXT NOT NULL CHECK(length(updated_at)=24 AND updated_at GLOB '????-??-??T??:??:??.???Z' AND julianday(updated_at) IS NOT NULL),
  last_mutation_id TEXT NOT NULL UNIQUE REFERENCES governed_form_draft_mutations(id) ON DELETE RESTRICT,
  CHECK(resource_id='form_draft/'||account_id||'/'||form_key),
  CHECK(julianday(created_at)<=julianday(updated_at)),
  UNIQUE(account_id,form_key)
) STRICT;

CREATE INDEX idx_governed_form_draft_history
ON governed_form_draft_mutations(family_id,account_id,form_key,revision DESC);
CREATE INDEX idx_governed_form_drafts_owner
ON governed_form_drafts(family_id,owner_person_id,account_id,form_key);

CREATE TRIGGER trg_form_draft_account_current_quota
BEFORE INSERT ON governed_form_draft_mutations
WHEN NEW.previous_revision=0 AND (
  SELECT COUNT(*) FROM governed_form_drafts current WHERE current.account_id=NEW.account_id
)>=32
BEGIN SELECT RAISE(ABORT,'form draft account current quota exceeded; new writes are denied'); END;

CREATE TRIGGER trg_form_draft_immutable_history_quota
BEFORE INSERT ON governed_form_draft_mutations
WHEN (
  SELECT COUNT(*) FROM governed_form_draft_mutations history WHERE history.resource_id=NEW.resource_id
)>=256
BEGIN SELECT RAISE(ABORT,'form draft immutable history quota exceeded; new writes are denied'); END;

CREATE TRIGGER trg_form_draft_idempotency_mismatch
BEFORE INSERT ON governed_form_draft_mutations
WHEN EXISTS(
  SELECT 1 FROM governed_form_draft_mutations prior
  WHERE prior.family_id=NEW.family_id
    AND prior.account_id=NEW.account_id
    AND prior.form_key=NEW.form_key
    AND prior.client_operation_id=NEW.client_operation_id
    AND prior.request_fingerprint<>NEW.request_fingerprint
)
BEGIN SELECT RAISE(ABORT,'form draft idempotency fingerprint mismatch'); END;

CREATE TRIGGER trg_form_draft_mutation_revision
BEFORE INSERT ON governed_form_draft_mutations
WHEN NOT (
  (NEW.previous_revision=0 AND NEW.revision=1 AND NOT EXISTS(
    SELECT 1 FROM governed_form_drafts current WHERE current.resource_id=NEW.resource_id
  ))
  OR EXISTS(
    SELECT 1 FROM governed_form_drafts current
    WHERE current.resource_id=NEW.resource_id
      AND current.family_id=NEW.family_id
      AND current.account_id=NEW.account_id
      AND current.owner_person_id=NEW.owner_person_id
      AND current.form_key=NEW.form_key
      AND current.revision=NEW.previous_revision
      AND NEW.revision=current.revision+1
  )
)
BEGIN SELECT RAISE(ABORT,'form draft optimistic revision mismatch'); END;

CREATE TRIGGER trg_form_draft_undo_payload
BEFORE INSERT ON governed_form_draft_mutations
WHEN NEW.operation='undo' AND NOT EXISTS(
  SELECT 1 FROM governed_form_draft_mutations restored
  WHERE restored.resource_id=NEW.resource_id
    AND restored.revision=NEW.restored_from_revision
    AND restored.payload_json=NEW.payload_json
    AND restored.payload_fingerprint=NEW.payload_fingerprint
)
BEGIN SELECT RAISE(ABORT,'form draft undo must restore the immediately preceding immutable revision'); END;

CREATE TRIGGER trg_form_draft_mutation_policy_receipt
BEFORE INSERT ON governed_form_draft_mutations
WHEN NOT EXISTS(
  SELECT 1
  FROM platform_policy_transaction_receipts receipt
  JOIN platform_policy_database_fences fence
    ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
  JOIN platform_policy_journal_projection_outbox projection
    ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
  JOIN accounts active_account
    ON active_account.id=NEW.account_id
      AND active_account.status='active'
      AND active_account.person_id=NEW.owner_person_id
  JOIN people active_person
    ON active_person.id=NEW.owner_person_id
      AND active_person.family_id=NEW.family_id
      AND active_person.status='active'
  WHERE receipt.receipt_hash=NEW.policy_receipt_hash
    AND receipt.receipt_version=NEW.policy_receipt_version
    AND receipt.nonce=NEW.policy_receipt_nonce
    AND receipt.correlation_id=NEW.policy_correlation_id
    AND receipt.resource_type=NEW.policy_resource_type
    AND receipt.resource_id=NEW.policy_resource_id
    AND receipt.action=NEW.policy_action
    AND receipt.capability=NEW.policy_capability
    AND receipt.resource_type='form_draft'
    AND receipt.resource_id=NEW.resource_id
    AND receipt.action=CASE NEW.previous_revision WHEN 0 THEN 'create' ELSE 'update' END
    AND receipt.capability='family.write'
    AND json_extract(receipt.record_json,'$.request.subject.accountId')=NEW.account_id
    AND json_extract(receipt.record_json,'$.request.subject.personId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
    AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
    AND json_extract(receipt.record_json,'$.request.resource.sensitivity')='personal'
    AND json_extract(receipt.record_json,'$.request.purpose')='general'
    AND json_extract(receipt.record_json,'$.request.occurredAt')=NEW.created_at
)
BEGIN SELECT RAISE(ABORT,'form draft mutation requires an exact active personal policy receipt'); END;

CREATE TRIGGER trg_form_draft_current_insert
BEFORE INSERT ON governed_form_drafts
WHEN NOT EXISTS(
  SELECT 1 FROM governed_form_draft_mutations mutation
  WHERE mutation.id=NEW.last_mutation_id
    AND mutation.resource_id=NEW.resource_id
    AND mutation.family_id=NEW.family_id
    AND mutation.account_id=NEW.account_id
    AND mutation.owner_person_id=NEW.owner_person_id
    AND mutation.form_key=NEW.form_key
    AND mutation.previous_revision=0
    AND mutation.revision=NEW.revision
    AND mutation.payload_json=NEW.payload_json
    AND mutation.payload_fingerprint=NEW.payload_fingerprint
    AND mutation.created_at=NEW.created_at
    AND mutation.created_at=NEW.updated_at
)
BEGIN SELECT RAISE(ABORT,'form draft current row requires its exact initial mutation'); END;

CREATE TRIGGER trg_form_draft_current_update
BEFORE UPDATE ON governed_form_drafts
WHEN NEW.resource_id<>OLD.resource_id
  OR NEW.family_id<>OLD.family_id
  OR NEW.account_id<>OLD.account_id
  OR NEW.owner_person_id<>OLD.owner_person_id
  OR NEW.form_key<>OLD.form_key
  OR NEW.created_at<>OLD.created_at
  OR NOT EXISTS(
    SELECT 1 FROM governed_form_draft_mutations mutation
    WHERE mutation.id=NEW.last_mutation_id
      AND mutation.resource_id=OLD.resource_id
      AND mutation.family_id=OLD.family_id
      AND mutation.account_id=OLD.account_id
      AND mutation.owner_person_id=OLD.owner_person_id
      AND mutation.form_key=OLD.form_key
      AND mutation.previous_revision=OLD.revision
      AND mutation.revision=NEW.revision
      AND mutation.payload_json=NEW.payload_json
      AND mutation.payload_fingerprint=NEW.payload_fingerprint
      AND mutation.created_at=NEW.updated_at
  )
BEGIN SELECT RAISE(ABORT,'form draft update requires its exact next mutation'); END;

CREATE TRIGGER trg_form_draft_mutation_update
BEFORE UPDATE ON governed_form_draft_mutations
BEGIN SELECT RAISE(ABORT,'form draft mutations are immutable'); END;
CREATE TRIGGER trg_form_draft_mutation_delete
BEFORE DELETE ON governed_form_draft_mutations
BEGIN SELECT RAISE(ABORT,'form draft mutation deletion is forbidden'); END;
CREATE TRIGGER trg_form_draft_current_delete
BEFORE DELETE ON governed_form_drafts
BEGIN SELECT RAISE(ABORT,'form draft deletion is forbidden'); END;

UPDATE database_metadata SET value='REVISION-33-N-DRAFT-ASYNC-STATE-UX',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key='schema_generation';
`;

const privacyOwnershipDataRightsIncidentControlSql = `
CREATE TABLE governed_ai_memory_mutations(
 id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
 client_operation_id TEXT NOT NULL CHECK(length(trim(client_operation_id)) BETWEEN 1 AND 128),
 request_fingerprint TEXT NOT NULL CHECK(length(request_fingerprint)=64 AND request_fingerprint NOT GLOB '*[^0-9a-f]*'),
 state_fingerprint TEXT NOT NULL CHECK(length(state_fingerprint)=64 AND state_fingerprint NOT GLOB '*[^0-9a-f]*'),
 mutation_kind TEXT NOT NULL CHECK(mutation_kind IN ('ai_memory_correct','ai_memory_restrict','ai_memory_delete','ai_memory_expire','rights_request_create','rights_request_update','rights_export_finalize','incident_create','incident_update')),
 resource_type TEXT NOT NULL CHECK(resource_type IN ('ai_memory_record','data_rights_request','privacy_incident')),
 resource_id TEXT NOT NULL CHECK(length(trim(resource_id)) BETWEEN 1 AND 256),
 family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
 previous_revision INTEGER NOT NULL CHECK(previous_revision BETWEEN 0 AND 2147483646),
 revision INTEGER NOT NULL CHECK(revision=previous_revision+1),
 policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
 policy_resource_type TEXT NOT NULL CHECK(length(trim(policy_resource_type)) BETWEEN 1 AND 128),
 policy_resource_id TEXT NOT NULL CHECK(policy_resource_id=resource_id),
 policy_action TEXT NOT NULL CHECK(policy_action IN ('create','update','delete')),
 policy_capability TEXT NOT NULL CHECK(policy_capability IN ('family.read','family.write','ai.process')),
 policy_purpose TEXT NOT NULL CHECK(policy_purpose IN ('general','ai_processing','administration')),
 policy_sensitivity TEXT NOT NULL CHECK(policy_sensitivity IN ('personal','sensitive','highly_sensitive')),
 occurred_at TEXT NOT NULL CHECK(length(occurred_at)=24 AND occurred_at GLOB '????-??-??T??:??:??.???Z' AND julianday(occurred_at) IS NOT NULL),
 UNIQUE(account_id,client_operation_id), UNIQUE(resource_id,revision),
 CHECK((mutation_kind IN ('ai_memory_correct','rights_request_create','incident_create') AND previous_revision>=0)
   OR (mutation_kind NOT IN ('ai_memory_correct','rights_request_create','incident_create') AND previous_revision>0))
) STRICT;

CREATE TABLE governed_ai_memory_records(
 resource_id TEXT PRIMARY KEY CHECK(length(trim(resource_id)) BETWEEN 1 AND 256),
 family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
 derived_binding_hash TEXT NOT NULL REFERENCES derived_data_policy_bindings(binding_hash) ON DELETE RESTRICT,
 title TEXT NOT NULL CHECK(length(title)<=256),
 statement TEXT NOT NULL CHECK(length(statement)<=4096),
 source_resource_type TEXT NOT NULL CHECK(length(trim(source_resource_type)) BETWEEN 1 AND 128),
 source_resource_id TEXT NOT NULL CHECK(length(trim(source_resource_id)) BETWEEN 1 AND 256),
 source_occurred_at TEXT CHECK(source_occurred_at IS NULL OR (length(source_occurred_at)=24 AND source_occurred_at GLOB '????-??-??T??:??:??.???Z' AND julianday(source_occurred_at) IS NOT NULL)),
 restriction_visibility TEXT NOT NULL CHECK(restriction_visibility IN ('owner_only','selected_accounts','family')),
 selected_account_ids_json TEXT NOT NULL CHECK(json_valid(selected_account_ids_json) AND json_type(selected_account_ids_json)='array' AND json_array_length(selected_account_ids_json)<=32 AND json(selected_account_ids_json)=selected_account_ids_json),
 allowed_purposes_json TEXT NOT NULL CHECK(json_valid(allowed_purposes_json) AND json_type(allowed_purposes_json)='array' AND json_array_length(allowed_purposes_json) BETWEEN 1 AND 7 AND json(allowed_purposes_json)=allowed_purposes_json),
 processing_allowed INTEGER NOT NULL CHECK(processing_allowed IN (0,1)),
 state TEXT NOT NULL CHECK(state IN ('active','restricted','expired','pending_deletion','deleted')),
 retention_until TEXT CHECK(retention_until IS NULL OR (length(retention_until)=24 AND retention_until GLOB '????-??-??T??:??:??.???Z' AND julianday(retention_until) IS NOT NULL)),
 expired_at TEXT CHECK(expired_at IS NULL OR (length(expired_at)=24 AND expired_at GLOB '????-??-??T??:??:??.???Z' AND julianday(expired_at) IS NOT NULL)),
 deletion_requested_at TEXT CHECK(deletion_requested_at IS NULL OR (length(deletion_requested_at)=24 AND deletion_requested_at GLOB '????-??-??T??:??:??.???Z' AND julianday(deletion_requested_at) IS NOT NULL)),
 deleted_at TEXT CHECK(deleted_at IS NULL OR (length(deleted_at)=24 AND deleted_at GLOB '????-??-??T??:??:??.???Z' AND julianday(deleted_at) IS NOT NULL)),
 revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 2147483647),
 state_fingerprint TEXT NOT NULL CHECK(length(state_fingerprint)=64 AND state_fingerprint NOT GLOB '*[^0-9a-f]*'),
 last_mutation_id TEXT NOT NULL UNIQUE REFERENCES governed_ai_memory_mutations(id) ON DELETE RESTRICT,
 created_at TEXT NOT NULL CHECK(length(created_at)=24 AND created_at GLOB '????-??-??T??:??:??.???Z' AND julianday(created_at) IS NOT NULL),
 updated_at TEXT NOT NULL CHECK(length(updated_at)=24 AND updated_at GLOB '????-??-??T??:??:??.???Z' AND julianday(updated_at) IS NOT NULL),
 policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
 UNIQUE(account_id,derived_binding_hash), CHECK(julianday(updated_at)>=julianday(created_at)),
 CHECK((state='deleted' AND deleted_at IS NOT NULL) OR state<>'deleted'),
 CHECK((state='deleted' AND title='' AND statement='' AND processing_allowed=0 AND restriction_visibility='owner_only')
   OR (state<>'deleted' AND length(trim(title))>=1 AND length(trim(statement))>=1)),
 CHECK((restriction_visibility='selected_accounts' AND json_array_length(selected_account_ids_json)>0) OR (restriction_visibility<>'selected_accounts' AND json_array_length(selected_account_ids_json)=0))
) STRICT;
CREATE INDEX idx_33o_ai_memory_owner ON governed_ai_memory_records(family_id,owner_person_id,account_id,state,updated_at DESC);
CREATE INDEX idx_33o_ai_memory_history ON governed_ai_memory_mutations(resource_id,revision DESC);

CREATE TABLE privacy_access_observations(
 id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
 family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
 observer_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 observer_person_id TEXT REFERENCES people(id) ON DELETE RESTRICT,
 observer_display_name TEXT NOT NULL CHECK(length(trim(observer_display_name)) BETWEEN 1 AND 256),
 resource_type TEXT NOT NULL CHECK(length(trim(resource_type)) BETWEEN 1 AND 128),
 resource_id TEXT NOT NULL CHECK(length(trim(resource_id)) BETWEEN 1 AND 256),
 action TEXT NOT NULL CHECK(action IN ('read','share','process','record','administer')),
 decision TEXT NOT NULL CHECK(decision IN ('allowed','denied')),
 decision_reason TEXT NOT NULL CHECK(length(trim(decision_reason)) BETWEEN 1 AND 512),
 purpose TEXT NOT NULL CHECK(length(trim(purpose)) BETWEEN 1 AND 128),
 policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
 observation_fingerprint TEXT NOT NULL UNIQUE CHECK(length(observation_fingerprint)=64 AND observation_fingerprint NOT GLOB '*[^0-9a-f]*'),
 device_id TEXT CHECK(device_id IS NULL OR length(trim(device_id)) BETWEEN 1 AND 128),
 correlation_id TEXT NOT NULL CHECK(length(trim(correlation_id)) BETWEEN 1 AND 128),
 source TEXT NOT NULL CHECK(source IN ('immutable_policy_receipt','audit_chain')),
 observed_at TEXT NOT NULL CHECK(length(observed_at)=24 AND observed_at GLOB '????-??-??T??:??:??.???Z' AND julianday(observed_at) IS NOT NULL)
) STRICT;
CREATE INDEX idx_33o_access_subject ON privacy_access_observations(account_id,observed_at DESC,id);

CREATE TABLE privacy_processing_observations(
 id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
 family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
 resource_type TEXT NOT NULL CHECK(length(trim(resource_type)) BETWEEN 1 AND 128),
 resource_id TEXT NOT NULL CHECK(length(trim(resource_id)) BETWEEN 1 AND 256),
 processor_kind TEXT NOT NULL CHECK(processor_kind IN ('ai','ocr','translation')),
 observation_status TEXT NOT NULL CHECK(observation_status IN ('started','completed','failed','cancelled')),
 purpose TEXT NOT NULL CHECK(length(trim(purpose)) BETWEEN 1 AND 128),
 processor TEXT NOT NULL CHECK(processor IN ('local_ai','local_ocr','local_translation')),
 locally_observed INTEGER NOT NULL CHECK(locally_observed=1),
 network_delivery_observed INTEGER NOT NULL CHECK(network_delivery_observed=0),
 policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
 observation_fingerprint TEXT NOT NULL UNIQUE CHECK(length(observation_fingerprint)=64 AND observation_fingerprint NOT GLOB '*[^0-9a-f]*'),
 observed_at TEXT NOT NULL CHECK(length(observed_at)=24 AND observed_at GLOB '????-??-??T??:??:??.???Z' AND julianday(observed_at) IS NOT NULL)
 ,completed_at TEXT CHECK(completed_at IS NULL OR (length(completed_at)=24 AND completed_at GLOB '????-??-??T??:??:??.???Z' AND julianday(completed_at)>=julianday(observed_at)))
) STRICT;
CREATE INDEX idx_33o_processing_subject ON privacy_processing_observations(account_id,observed_at DESC,id);

CREATE TABLE privacy_rights_requests(
 id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
 family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
 request_kind TEXT NOT NULL CHECK(request_kind IN ('encrypted_export','retention_change','erasure','legacy_export')),
 scope_resource_type TEXT NOT NULL CHECK(length(trim(scope_resource_type)) BETWEEN 1 AND 128),
 scope_resource_id TEXT NOT NULL CHECK(length(trim(scope_resource_id)) BETWEEN 1 AND 256),
 requested_retention_until TEXT CHECK(requested_retention_until IS NULL OR (length(requested_retention_until)=24 AND requested_retention_until GLOB '????-??-??T??:??:??.???Z' AND julianday(requested_retention_until) IS NOT NULL)),
 status TEXT NOT NULL CHECK(status IN ('requested','in_review','locally_completed','rejected','cancelled')),
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 4096),
 resolution_note TEXT CHECK(resolution_note IS NULL OR length(trim(resolution_note)) BETWEEN 1 AND 4096),
 encrypted_export_required INTEGER NOT NULL CHECK(encrypted_export_required IN (0,1)),
 external_copies_erasure_guaranteed INTEGER NOT NULL CHECK(external_copies_erasure_guaranteed=0),
 revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 2147483647),
 state_fingerprint TEXT NOT NULL CHECK(length(state_fingerprint)=64 AND state_fingerprint NOT GLOB '*[^0-9a-f]*'),
 last_mutation_id TEXT NOT NULL UNIQUE REFERENCES governed_ai_memory_mutations(id) ON DELETE RESTRICT,
 policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
 created_at TEXT NOT NULL CHECK(length(created_at)=24 AND created_at GLOB '????-??-??T??:??:??.???Z' AND julianday(created_at) IS NOT NULL),
 updated_at TEXT NOT NULL CHECK(length(updated_at)=24 AND updated_at GLOB '????-??-??T??:??:??.???Z' AND julianday(updated_at) IS NOT NULL),
 CHECK(julianday(updated_at)>=julianday(created_at)),
 CHECK((request_kind IN ('encrypted_export','legacy_export') AND encrypted_export_required=1) OR (request_kind NOT IN ('encrypted_export','legacy_export')))
) STRICT;
CREATE INDEX idx_33o_rights_subject ON privacy_rights_requests(account_id,status,updated_at DESC,id);

CREATE TABLE privacy_rights_request_events(
 id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
 request_id TEXT NOT NULL REFERENCES privacy_rights_requests(id) ON DELETE RESTRICT,
 family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 2147483647),
 state_fingerprint TEXT NOT NULL CHECK(length(state_fingerprint)=64 AND state_fingerprint NOT GLOB '*[^0-9a-f]*'),
 event_type TEXT NOT NULL CHECK(event_type IN ('requested','in_review','locally_completed','rejected','cancelled')),
 event_fingerprint TEXT NOT NULL UNIQUE CHECK(length(event_fingerprint)=64 AND event_fingerprint NOT GLOB '*[^0-9a-f]*'),
 policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
 occurred_at TEXT NOT NULL CHECK(length(occurred_at)=24 AND occurred_at GLOB '????-??-??T??:??:??.???Z' AND julianday(occurred_at) IS NOT NULL),
 UNIQUE(request_id,revision)
) STRICT;

CREATE TABLE privacy_export_records(
 id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
 rights_request_id TEXT NOT NULL UNIQUE REFERENCES privacy_rights_requests(id) ON DELETE RESTRICT,
 family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
 request_revision INTEGER NOT NULL CHECK(request_revision BETWEEN 1 AND 2147483647),
 artifact_sha256 TEXT NOT NULL UNIQUE CHECK(length(artifact_sha256)=64 AND artifact_sha256 NOT GLOB '*[^0-9a-f]*'),
 envelope_sha256 TEXT NOT NULL UNIQUE CHECK(length(envelope_sha256)=64 AND envelope_sha256 NOT GLOB '*[^0-9a-f]*'),
 lineage_snapshot_sha256 TEXT NOT NULL CHECK(length(lineage_snapshot_sha256)=64 AND lineage_snapshot_sha256 NOT GLOB '*[^0-9a-f]*'),
 encryption_algorithm TEXT NOT NULL CHECK(encryption_algorithm='AES-256-GCM'),
 item_count INTEGER NOT NULL CHECK(item_count BETWEEN 0 AND 10000),
 plaintext_size_bytes INTEGER NOT NULL CHECK(plaintext_size_bytes BETWEEN 1 AND 33554432),
 size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 1 AND 52428800),
 local_user_selected INTEGER NOT NULL CHECK(local_user_selected=1),
 delivery_guaranteed INTEGER NOT NULL CHECK(delivery_guaranteed=0),
 recipient_read_guaranteed INTEGER NOT NULL CHECK(recipient_read_guaranteed=0),
 state_fingerprint TEXT NOT NULL CHECK(length(state_fingerprint)=64 AND state_fingerprint NOT GLOB '*[^0-9a-f]*'),
 policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
 created_at TEXT NOT NULL CHECK(length(created_at)=24 AND created_at GLOB '????-??-??T??:??:??.???Z' AND julianday(created_at) IS NOT NULL)
) STRICT;
CREATE INDEX idx_33o_export_subject ON privacy_export_records(account_id,created_at DESC,id);

CREATE TABLE policy_incident_cases(
 id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
 family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 256),
 status TEXT NOT NULL CHECK(status IN ('open','contained_locally','resolved','cancelled')),
 severity TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')),
 suspected_at TEXT NOT NULL CHECK(length(suspected_at)=24 AND suspected_at GLOB '????-??-??T??:??:??.???Z' AND julianday(suspected_at) IS NOT NULL),
 actions_json TEXT NOT NULL CHECK(json_valid(actions_json) AND json_type(actions_json)='array' AND json_array_length(actions_json) BETWEEN 1 AND 5 AND json(actions_json)=actions_json),
 evidence_reference_ids_json TEXT NOT NULL CHECK(json_valid(evidence_reference_ids_json) AND json_type(evidence_reference_ids_json)='array' AND json_array_length(evidence_reference_ids_json)<=64 AND json(evidence_reference_ids_json)=evidence_reference_ids_json),
 resolution_note TEXT CHECK(resolution_note IS NULL OR length(trim(resolution_note)) BETWEEN 1 AND 4096),
 revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 2147483647),
 state_fingerprint TEXT NOT NULL CHECK(length(state_fingerprint)=64 AND state_fingerprint NOT GLOB '*[^0-9a-f]*'),
 last_mutation_id TEXT NOT NULL UNIQUE REFERENCES governed_ai_memory_mutations(id) ON DELETE RESTRICT,
 remote_wipe_performed INTEGER NOT NULL CHECK(remote_wipe_performed=0),
 mdm_operation_performed INTEGER NOT NULL CHECK(mdm_operation_performed=0),
 network_delivery_guaranteed INTEGER NOT NULL CHECK(network_delivery_guaranteed=0),
 policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
 created_at TEXT NOT NULL CHECK(length(created_at)=24 AND created_at GLOB '????-??-??T??:??:??.???Z' AND julianday(created_at) IS NOT NULL),
 updated_at TEXT NOT NULL CHECK(length(updated_at)=24 AND updated_at GLOB '????-??-??T??:??:??.???Z' AND julianday(updated_at) IS NOT NULL),
 CHECK(julianday(updated_at)>=julianday(created_at))
) STRICT;
CREATE INDEX idx_33o_incident_subject ON policy_incident_cases(account_id,status,updated_at DESC,id);

CREATE TABLE policy_incident_events(
 id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
 incident_id TEXT NOT NULL REFERENCES policy_incident_cases(id) ON DELETE RESTRICT,
 family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 2147483647),
 state_fingerprint TEXT NOT NULL CHECK(length(state_fingerprint)=64 AND state_fingerprint NOT GLOB '*[^0-9a-f]*'),
 event_type TEXT NOT NULL CHECK(event_type IN ('opened','contained_locally','authority_revoked','resolved','cancelled')),
 event_fingerprint TEXT NOT NULL UNIQUE CHECK(length(event_fingerprint)=64 AND event_fingerprint NOT GLOB '*[^0-9a-f]*'),
 evidence_sha256 TEXT NOT NULL CHECK(length(evidence_sha256)=64 AND evidence_sha256 NOT GLOB '*[^0-9a-f]*'),
 policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
 occurred_at TEXT NOT NULL CHECK(length(occurred_at)=24 AND occurred_at GLOB '????-??-??T??:??:??.???Z' AND julianday(occurred_at) IS NOT NULL),
 UNIQUE(incident_id,revision)
) STRICT;

CREATE TABLE policy_incident_revocations(
 id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
 incident_id TEXT NOT NULL REFERENCES policy_incident_cases(id) ON DELETE RESTRICT,
 family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 target_kind TEXT NOT NULL CHECK(target_kind IN ('session','trusted_device','capability','offline_lease','consent')),
 target_fingerprint TEXT NOT NULL CHECK(length(target_fingerprint)=64 AND target_fingerprint NOT GLOB '*[^0-9a-f]*'),
 outcome TEXT NOT NULL CHECK(outcome IN ('revoked','already_revoked')),
 policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
 revoked_at TEXT NOT NULL CHECK(length(revoked_at)=24 AND revoked_at GLOB '????-??-??T??:??:??.???Z' AND julianday(revoked_at) IS NOT NULL),
 UNIQUE(incident_id,target_kind,target_fingerprint)
) STRICT;

CREATE TABLE policy_incident_quarantine_items(
 id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
 incident_id TEXT NOT NULL REFERENCES policy_incident_cases(id) ON DELETE RESTRICT,
 family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 target_kind TEXT NOT NULL CHECK(target_kind IN ('device_state','capability_state','event_package','derived_artifact')),
 target_fingerprint TEXT NOT NULL CHECK(length(target_fingerprint)=64 AND target_fingerprint NOT GLOB '*[^0-9a-f]*'),
 integrity_sha256 TEXT NOT NULL CHECK(length(integrity_sha256)=64 AND integrity_sha256 NOT GLOB '*[^0-9a-f]*'),
 status TEXT NOT NULL CHECK(status IN ('quarantined','released','destroyed')),
 revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 2147483647),
 policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
 quarantined_at TEXT NOT NULL CHECK(length(quarantined_at)=24 AND quarantined_at GLOB '????-??-??T??:??:??.???Z' AND julianday(quarantined_at) IS NOT NULL),
 resolved_at TEXT CHECK(resolved_at IS NULL OR (length(resolved_at)=24 AND resolved_at GLOB '????-??-??T??:??:??.???Z' AND julianday(resolved_at) IS NOT NULL)),
 UNIQUE(incident_id,target_kind,target_fingerprint),
 CHECK((status='quarantined' AND resolved_at IS NULL) OR (status IN ('released','destroyed') AND resolved_at IS NOT NULL))
) STRICT;

CREATE TRIGGER trg_33o_incident_payload_insert BEFORE INSERT ON policy_incident_cases
WHEN EXISTS(SELECT 1 FROM json_each(NEW.actions_json) item
 WHERE json_type(item.value)<>'object'
    OR (SELECT COUNT(*) FROM json_each(item.value))<>2
    OR EXISTS(SELECT 1 FROM json_each(item.value) property WHERE property.key NOT IN ('action','targetId'))
    OR json_type(item.value,'$.action')<>'text'
    OR json_extract(item.value,'$.action') NOT IN ('revoke_local_session_authority','revoke_trusted_device','revoke_offline_capability','revoke_consent','revoke_capability','quarantine_local_derived_data')
    OR json_type(item.value,'$.targetId')<>'text'
    OR length(trim(json_extract(item.value,'$.targetId'))) NOT BETWEEN 1 AND 256)
 OR EXISTS(SELECT 1 FROM json_each(NEW.evidence_reference_ids_json) evidence
    WHERE evidence.type<>'text' OR length(trim(evidence.value)) NOT BETWEEN 1 AND 256)
BEGIN SELECT RAISE(ABORT,'33-O incident actions or evidence are invalid'); END;
CREATE TRIGGER trg_33o_incident_payload_update BEFORE UPDATE OF actions_json,evidence_reference_ids_json ON policy_incident_cases
WHEN EXISTS(SELECT 1 FROM json_each(NEW.actions_json) item
 WHERE json_type(item.value)<>'object'
    OR (SELECT COUNT(*) FROM json_each(item.value))<>2
    OR EXISTS(SELECT 1 FROM json_each(item.value) property WHERE property.key NOT IN ('action','targetId'))
    OR json_type(item.value,'$.action')<>'text'
    OR json_extract(item.value,'$.action') NOT IN ('revoke_local_session_authority','revoke_trusted_device','revoke_offline_capability','revoke_consent','revoke_capability','quarantine_local_derived_data')
    OR json_type(item.value,'$.targetId')<>'text'
    OR length(trim(json_extract(item.value,'$.targetId'))) NOT BETWEEN 1 AND 256)
 OR EXISTS(SELECT 1 FROM json_each(NEW.evidence_reference_ids_json) evidence
    WHERE evidence.type<>'text' OR length(trim(evidence.value)) NOT BETWEEN 1 AND 256)
BEGIN SELECT RAISE(ABORT,'33-O incident actions or evidence are invalid'); END;

CREATE TRIGGER trg_33o_ai_mutation_receipt BEFORE INSERT ON governed_ai_memory_mutations
WHEN NOT EXISTS(SELECT 1 FROM platform_policy_transaction_receipts receipt
 JOIN platform_policy_database_fences fence ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
 JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
 JOIN accounts account ON account.id=NEW.account_id AND account.status='active' AND account.person_id=NEW.owner_person_id
 JOIN people person ON person.id=NEW.owner_person_id AND person.status='active' AND person.family_id=NEW.family_id
 WHERE receipt.receipt_hash=NEW.policy_receipt_hash AND receipt.resource_type=NEW.policy_resource_type AND receipt.resource_id=NEW.resource_id
  AND receipt.action=NEW.policy_action AND receipt.capability=NEW.policy_capability
  AND NEW.policy_resource_type=NEW.resource_type
  AND NEW.policy_action=CASE WHEN NEW.previous_revision=0 THEN 'create' WHEN NEW.mutation_kind='ai_memory_delete' THEN 'delete' ELSE 'update' END
  AND NEW.policy_capability='family.write'
  AND NEW.policy_purpose=CASE WHEN NEW.resource_type='ai_memory_record' THEN 'ai_processing' ELSE 'administration' END
  AND json_extract(receipt.record_json,'$.request.subject.accountId')=NEW.account_id
  AND json_extract(receipt.record_json,'$.request.subject.personId')=NEW.owner_person_id
  AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
  AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
  AND json_extract(receipt.record_json,'$.request.resource.sensitivity')=NEW.policy_sensitivity
  AND json_extract(receipt.record_json,'$.request.purpose')=NEW.policy_purpose)
BEGIN SELECT RAISE(ABORT,'33-O mutation requires exact active subject and durable policy receipt'); END;
CREATE TRIGGER trg_33o_ai_current_insert BEFORE INSERT ON governed_ai_memory_records
WHEN NOT EXISTS(SELECT 1 FROM governed_ai_memory_mutations m WHERE m.id=NEW.last_mutation_id AND m.resource_id=NEW.resource_id
 AND m.family_id=NEW.family_id AND m.account_id=NEW.account_id AND m.owner_person_id=NEW.owner_person_id
 AND m.resource_type='ai_memory_record' AND m.previous_revision=0 AND m.revision=NEW.revision
 AND m.mutation_kind='ai_memory_correct' AND m.state_fingerprint=NEW.state_fingerprint
 AND m.policy_receipt_hash=NEW.policy_receipt_hash AND m.occurred_at=NEW.created_at AND NEW.created_at=NEW.updated_at)
 OR NOT EXISTS(SELECT 1 FROM derived_data_policy_bindings binding
   JOIN platform_policy_transaction_receipts producer ON producer.receipt_hash=binding.producer_receipt_hash
   JOIN platform_policy_database_fences producer_fence ON producer_fence.fence_name=producer.fence_name AND producer_fence.epoch=producer.fence_epoch AND producer_fence.writable=1
   JOIN platform_policy_journal_projection_outbox producer_projection ON producer_projection.receipt_hash=producer.receipt_hash AND producer_projection.record_json=producer.record_json
   WHERE binding.binding_hash=NEW.derived_binding_hash
   AND binding.status='sealed' AND binding.derived_kind='AI_MEMORY' AND binding.derived_resource_type='ai_memory'
   AND binding.derived_resource_id=NEW.resource_id AND binding.family_id=NEW.family_id
   AND json_extract(producer.record_json,'$.request.subject.accountId')=NEW.account_id
   AND json_extract(producer.record_json,'$.request.subject.personId')=NEW.owner_person_id
   AND json_extract(producer.record_json,'$.request.resource.familyId')=NEW.family_id
   AND json_extract(producer.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id)
BEGIN SELECT RAISE(ABORT,'33-O AI memory current row requires exact initial mutation'); END;
CREATE TRIGGER trg_33o_ai_current_update BEFORE UPDATE ON governed_ai_memory_records
WHEN NEW.resource_id<>OLD.resource_id OR NEW.family_id<>OLD.family_id OR NEW.account_id<>OLD.account_id
 OR NEW.owner_person_id<>OLD.owner_person_id OR NEW.derived_binding_hash<>OLD.derived_binding_hash OR NEW.created_at<>OLD.created_at
 OR OLD.state='deleted' OR NEW.revision<>OLD.revision+1 OR julianday(NEW.updated_at)<julianday(OLD.updated_at)
 OR NOT EXISTS(SELECT 1 FROM governed_ai_memory_mutations m WHERE m.id=NEW.last_mutation_id AND m.resource_id=OLD.resource_id
  AND m.resource_type='ai_memory_record' AND m.family_id=OLD.family_id AND m.account_id=OLD.account_id AND m.owner_person_id=OLD.owner_person_id
  AND m.previous_revision=OLD.revision AND m.revision=NEW.revision
  AND m.state_fingerprint=NEW.state_fingerprint AND m.policy_receipt_hash=NEW.policy_receipt_hash AND m.occurred_at=NEW.updated_at
  AND ((m.mutation_kind='ai_memory_delete' AND NEW.state IN ('pending_deletion','deleted'))
    OR (m.mutation_kind='ai_memory_expire' AND NEW.state='expired')
    OR (m.mutation_kind='ai_memory_restrict' AND NEW.state IN ('active','restricted'))
    OR (m.mutation_kind='ai_memory_correct' AND NEW.state IN ('active','restricted'))))
BEGIN SELECT RAISE(ABORT,'33-O AI memory update requires exact next immutable mutation'); END;

CREATE TRIGGER trg_33o_rights_insert BEFORE INSERT ON privacy_rights_requests
WHEN NOT EXISTS(SELECT 1 FROM governed_ai_memory_mutations m WHERE m.id=NEW.last_mutation_id
 AND m.mutation_kind='rights_request_create' AND m.resource_type='data_rights_request' AND m.resource_id=NEW.id
 AND m.family_id=NEW.family_id AND m.account_id=NEW.account_id AND m.owner_person_id=NEW.owner_person_id
 AND m.previous_revision=0 AND m.revision=NEW.revision AND m.policy_receipt_hash=NEW.policy_receipt_hash
 AND m.state_fingerprint=NEW.state_fingerprint AND m.occurred_at=NEW.created_at AND NEW.created_at=NEW.updated_at)
BEGIN SELECT RAISE(ABORT,'33-O rights request requires exact initial mutation'); END;

CREATE TRIGGER trg_33o_rights_update BEFORE UPDATE ON privacy_rights_requests
WHEN NEW.id<>OLD.id OR NEW.family_id<>OLD.family_id OR NEW.account_id<>OLD.account_id OR NEW.owner_person_id<>OLD.owner_person_id
 OR NEW.request_kind<>OLD.request_kind OR NEW.scope_resource_type<>OLD.scope_resource_type OR NEW.scope_resource_id<>OLD.scope_resource_id
 OR NEW.reason<>OLD.reason OR NEW.created_at<>OLD.created_at OR NEW.revision<>OLD.revision+1
 OR julianday(NEW.updated_at)<julianday(OLD.updated_at) OR OLD.status IN ('locally_completed','rejected','cancelled')
 OR (OLD.status='requested' AND NEW.status NOT IN ('in_review','locally_completed','rejected','cancelled'))
 OR (OLD.status='in_review' AND NEW.status NOT IN ('locally_completed','rejected','cancelled'))
 OR (NEW.status='locally_completed' AND OLD.request_kind NOT IN ('encrypted_export','legacy_export'))
 OR NOT EXISTS(SELECT 1 FROM governed_ai_memory_mutations m WHERE m.id=NEW.last_mutation_id
   AND m.mutation_kind=CASE WHEN NEW.status='locally_completed' THEN 'rights_export_finalize' ELSE 'rights_request_update' END
   AND m.resource_type='data_rights_request' AND m.resource_id=OLD.id
   AND m.family_id=OLD.family_id AND m.account_id=OLD.account_id AND m.owner_person_id=OLD.owner_person_id
   AND m.previous_revision=OLD.revision AND m.revision=NEW.revision AND m.state_fingerprint=NEW.state_fingerprint
   AND m.policy_receipt_hash=NEW.policy_receipt_hash AND m.occurred_at=NEW.updated_at)
BEGIN SELECT RAISE(ABORT,'33-O rights request transition is stale or invalid'); END;

CREATE TRIGGER trg_33o_incident_insert BEFORE INSERT ON policy_incident_cases
WHEN NOT EXISTS(SELECT 1 FROM governed_ai_memory_mutations m WHERE m.id=NEW.last_mutation_id
 AND m.mutation_kind='incident_create' AND m.resource_type='privacy_incident' AND m.resource_id=NEW.id
 AND m.family_id=NEW.family_id AND m.account_id=NEW.account_id AND m.owner_person_id=NEW.owner_person_id
 AND m.previous_revision=0 AND m.revision=NEW.revision AND m.policy_receipt_hash=NEW.policy_receipt_hash
 AND m.state_fingerprint=NEW.state_fingerprint AND m.occurred_at=NEW.created_at AND NEW.created_at=NEW.updated_at)
BEGIN SELECT RAISE(ABORT,'33-O incident requires exact initial mutation'); END;
CREATE TRIGGER trg_33o_incident_update BEFORE UPDATE ON policy_incident_cases
WHEN NEW.id<>OLD.id OR NEW.family_id<>OLD.family_id OR NEW.account_id<>OLD.account_id OR NEW.owner_person_id<>OLD.owner_person_id
 OR NEW.title<>OLD.title OR NEW.severity<>OLD.severity OR NEW.suspected_at<>OLD.suspected_at OR NEW.actions_json<>OLD.actions_json
 OR NEW.evidence_reference_ids_json<>OLD.evidence_reference_ids_json OR NEW.created_at<>OLD.created_at
 OR NEW.revision<>OLD.revision+1 OR julianday(NEW.updated_at)<julianday(OLD.updated_at) OR OLD.status IN ('resolved','cancelled')
 OR (OLD.status='open' AND NEW.status NOT IN ('contained_locally','resolved','cancelled'))
 OR (OLD.status='contained_locally' AND NEW.status NOT IN ('resolved','cancelled'))
 OR NOT EXISTS(SELECT 1 FROM governed_ai_memory_mutations m WHERE m.id=NEW.last_mutation_id
   AND m.mutation_kind='incident_update' AND m.resource_type='privacy_incident' AND m.resource_id=OLD.id
   AND m.family_id=OLD.family_id AND m.account_id=OLD.account_id AND m.owner_person_id=OLD.owner_person_id
   AND m.previous_revision=OLD.revision AND m.revision=NEW.revision AND m.state_fingerprint=NEW.state_fingerprint
   AND m.policy_receipt_hash=NEW.policy_receipt_hash AND m.occurred_at=NEW.updated_at)
BEGIN SELECT RAISE(ABORT,'33-O incident transition is stale or invalid'); END;
CREATE TRIGGER trg_33o_quarantine_update BEFORE UPDATE ON policy_incident_quarantine_items
BEGIN SELECT RAISE(ABORT,'33-O quarantine ledger is immutable'); END;

CREATE TRIGGER trg_33o_access_receipt BEFORE INSERT ON privacy_access_observations
WHEN NOT EXISTS(SELECT 1 FROM platform_policy_transaction_receipts receipt
 JOIN platform_policy_database_fences fence ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
 JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
 JOIN accounts owner_account ON owner_account.id=NEW.account_id AND owner_account.status='active' AND owner_account.person_id=NEW.owner_person_id
 JOIN people owner ON owner.id=NEW.owner_person_id AND owner.status='active' AND owner.family_id=NEW.family_id
 JOIN accounts observer ON observer.id=NEW.observer_account_id AND observer.status='active'
 WHERE receipt.receipt_hash=NEW.policy_receipt_hash AND receipt.resource_type=NEW.resource_type AND receipt.resource_id=NEW.resource_id
  AND receipt.action=NEW.action AND json_extract(receipt.record_json,'$.request.subject.accountId')=NEW.observer_account_id
  AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
  AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
  AND json_extract(receipt.record_json,'$.request.purpose')=NEW.purpose
  AND json_extract(receipt.record_json,'$.request.resource.sensitivity') IN ('personal','sensitive','highly_sensitive'))
BEGIN SELECT RAISE(ABORT,'33-O access observation requires exact durable receipt'); END;

CREATE TRIGGER trg_33o_processing_receipt BEFORE INSERT ON privacy_processing_observations
WHEN NOT EXISTS(SELECT 1 FROM platform_policy_transaction_receipts receipt
 JOIN platform_policy_database_fences fence ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
 JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
 JOIN accounts account ON account.id=NEW.account_id AND account.status='active' AND account.person_id=NEW.owner_person_id
 JOIN people person ON person.id=NEW.owner_person_id AND person.status='active' AND person.family_id=NEW.family_id
 WHERE receipt.receipt_hash=NEW.policy_receipt_hash AND receipt.resource_type=NEW.resource_type AND receipt.resource_id=NEW.resource_id
  AND receipt.action='process' AND receipt.capability=CASE NEW.processor_kind WHEN 'ai' THEN 'ai.process' WHEN 'ocr' THEN 'archive.ocr' ELSE 'translation.process' END
  AND NEW.processor=CASE NEW.processor_kind WHEN 'ai' THEN 'local_ai' WHEN 'ocr' THEN 'local_ocr' ELSE 'local_translation' END
  AND json_extract(receipt.record_json,'$.request.subject.accountId')=NEW.account_id
  AND json_extract(receipt.record_json,'$.request.subject.personId')=NEW.owner_person_id
  AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
  AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
  AND json_extract(receipt.record_json,'$.request.purpose')=NEW.purpose
  AND json_extract(receipt.record_json,'$.request.resource.sensitivity') IN ('personal','sensitive','highly_sensitive'))
BEGIN SELECT RAISE(ABORT,'33-O processing observation requires exact local durable receipt'); END;

CREATE TRIGGER trg_33o_rights_event_parent BEFORE INSERT ON privacy_rights_request_events
WHEN NOT EXISTS(SELECT 1 FROM privacy_rights_requests parent
 JOIN platform_policy_transaction_receipts receipt ON receipt.receipt_hash=NEW.policy_receipt_hash
 JOIN platform_policy_database_fences fence ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
 JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
 WHERE parent.id=NEW.request_id AND parent.family_id=NEW.family_id AND parent.account_id=NEW.account_id
  AND parent.revision=NEW.revision AND parent.status=NEW.event_type AND parent.state_fingerprint=NEW.state_fingerprint
  AND parent.policy_receipt_hash=NEW.policy_receipt_hash
  AND receipt.resource_type='data_rights_request' AND receipt.resource_id=NEW.request_id
  AND receipt.action=CASE NEW.revision WHEN 1 THEN 'create' ELSE 'update' END AND receipt.capability='family.write'
  AND json_extract(receipt.record_json,'$.request.subject.accountId')=NEW.account_id
  AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
  AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=parent.owner_person_id)
BEGIN SELECT RAISE(ABORT,'33-O rights event requires exact current parent and receipt'); END;

CREATE TRIGGER trg_33o_export_receipt BEFORE INSERT ON privacy_export_records
WHEN NOT EXISTS(SELECT 1 FROM privacy_rights_requests parent
 JOIN platform_policy_transaction_receipts receipt ON receipt.receipt_hash=NEW.policy_receipt_hash
 JOIN platform_policy_database_fences fence ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
 JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
 WHERE parent.id=NEW.rights_request_id AND parent.family_id=NEW.family_id AND parent.account_id=NEW.account_id
  AND parent.owner_person_id=NEW.owner_person_id AND parent.request_kind IN ('encrypted_export','legacy_export')
  AND parent.policy_receipt_hash=NEW.policy_receipt_hash
  AND parent.revision=NEW.request_revision
  AND parent.status='locally_completed' AND receipt.resource_type='data_rights_request' AND receipt.resource_id=parent.id
  AND receipt.action='update' AND receipt.capability='family.write'
  AND json_extract(receipt.record_json,'$.request.subject.accountId')=NEW.account_id
  AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
  AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
  AND json_extract(receipt.record_json,'$.request.resource.sensitivity') IN ('personal','sensitive','highly_sensitive'))
BEGIN SELECT RAISE(ABORT,'33-O encrypted export requires exact completed local rights request'); END;

CREATE TRIGGER trg_33o_incident_event_parent BEFORE INSERT ON policy_incident_events
WHEN NOT EXISTS(SELECT 1 FROM policy_incident_cases parent
 JOIN platform_policy_transaction_receipts receipt ON receipt.receipt_hash=NEW.policy_receipt_hash
 JOIN platform_policy_database_fences fence ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
 JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
 WHERE parent.id=NEW.incident_id AND parent.family_id=NEW.family_id AND parent.account_id=NEW.account_id
  AND parent.revision=NEW.revision AND parent.state_fingerprint=NEW.state_fingerprint AND parent.policy_receipt_hash=NEW.policy_receipt_hash
  AND NEW.event_type=CASE parent.status WHEN 'open' THEN 'opened' ELSE parent.status END
  AND receipt.resource_type='privacy_incident' AND receipt.resource_id=NEW.incident_id
  AND receipt.action=CASE NEW.revision WHEN 1 THEN 'create' ELSE 'update' END AND receipt.capability='family.write'
  AND json_extract(receipt.record_json,'$.request.subject.accountId')=NEW.account_id
  AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
  AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=parent.owner_person_id)
BEGIN SELECT RAISE(ABORT,'33-O incident event requires exact current parent and receipt'); END;

CREATE TRIGGER trg_33o_revocation_receipt BEFORE INSERT ON policy_incident_revocations
WHEN NOT EXISTS(SELECT 1 FROM policy_incident_cases parent
 JOIN platform_policy_transaction_receipts receipt ON receipt.receipt_hash=NEW.policy_receipt_hash
 JOIN platform_policy_database_fences fence ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
 JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
 WHERE parent.id=NEW.incident_id AND parent.family_id=NEW.family_id AND parent.account_id=NEW.account_id
  AND parent.policy_receipt_hash=NEW.policy_receipt_hash
  AND receipt.resource_type='privacy_incident' AND receipt.resource_id=NEW.incident_id
  AND receipt.action IN ('create','update') AND receipt.capability='family.write'
  AND json_extract(receipt.record_json,'$.request.subject.accountId')=NEW.account_id
  AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
  AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=parent.owner_person_id)
BEGIN SELECT RAISE(ABORT,'33-O incident revocation requires exact parent and receipt'); END;

CREATE TRIGGER trg_33o_quarantine_receipt BEFORE INSERT ON policy_incident_quarantine_items
WHEN NEW.status<>'quarantined' OR NEW.revision<>1 OR NOT EXISTS(SELECT 1 FROM policy_incident_cases parent
 JOIN platform_policy_transaction_receipts receipt ON receipt.receipt_hash=NEW.policy_receipt_hash
 JOIN platform_policy_database_fences fence ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
 JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
 WHERE parent.id=NEW.incident_id AND parent.family_id=NEW.family_id AND parent.account_id=NEW.account_id
  AND parent.policy_receipt_hash=NEW.policy_receipt_hash
  AND receipt.resource_type='privacy_incident' AND receipt.resource_id=NEW.incident_id
  AND receipt.action IN ('create','update') AND receipt.capability='family.write'
  AND json_extract(receipt.record_json,'$.request.subject.accountId')=NEW.account_id
  AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
  AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=parent.owner_person_id)
BEGIN SELECT RAISE(ABORT,'33-O quarantine requires exact parent and receipt'); END;

CREATE TRIGGER trg_33o_ai_current_delete BEFORE DELETE ON governed_ai_memory_records BEGIN SELECT RAISE(ABORT,'33-O AI memory current deletion is forbidden'); END;
CREATE TRIGGER trg_33o_ai_mutation_update BEFORE UPDATE ON governed_ai_memory_mutations BEGIN SELECT RAISE(ABORT,'33-O AI memory mutation ledger is immutable'); END;
CREATE TRIGGER trg_33o_ai_mutation_delete BEFORE DELETE ON governed_ai_memory_mutations BEGIN SELECT RAISE(ABORT,'33-O AI memory mutation ledger is immutable'); END;
CREATE TRIGGER trg_33o_access_update BEFORE UPDATE ON privacy_access_observations BEGIN SELECT RAISE(ABORT,'33-O access observations are immutable'); END;
CREATE TRIGGER trg_33o_access_delete BEFORE DELETE ON privacy_access_observations BEGIN SELECT RAISE(ABORT,'33-O access observations are immutable'); END;
CREATE TRIGGER trg_33o_processing_update BEFORE UPDATE ON privacy_processing_observations BEGIN SELECT RAISE(ABORT,'33-O processing observations are immutable'); END;
CREATE TRIGGER trg_33o_processing_delete BEFORE DELETE ON privacy_processing_observations BEGIN SELECT RAISE(ABORT,'33-O processing observations are immutable'); END;
CREATE TRIGGER trg_33o_rights_delete BEFORE DELETE ON privacy_rights_requests BEGIN SELECT RAISE(ABORT,'33-O rights requests cannot be deleted'); END;
CREATE TRIGGER trg_33o_rights_event_update BEFORE UPDATE ON privacy_rights_request_events BEGIN SELECT RAISE(ABORT,'33-O rights events are immutable'); END;
CREATE TRIGGER trg_33o_rights_event_delete BEFORE DELETE ON privacy_rights_request_events BEGIN SELECT RAISE(ABORT,'33-O rights events are immutable'); END;
CREATE TRIGGER trg_33o_export_update BEFORE UPDATE ON privacy_export_records BEGIN SELECT RAISE(ABORT,'33-O export receipts are immutable'); END;
CREATE TRIGGER trg_33o_export_delete BEFORE DELETE ON privacy_export_records BEGIN SELECT RAISE(ABORT,'33-O export receipts are immutable'); END;
CREATE TRIGGER trg_33o_incident_delete BEFORE DELETE ON policy_incident_cases BEGIN SELECT RAISE(ABORT,'33-O incidents cannot be deleted'); END;
CREATE TRIGGER trg_33o_incident_event_update BEFORE UPDATE ON policy_incident_events BEGIN SELECT RAISE(ABORT,'33-O incident events are immutable'); END;
CREATE TRIGGER trg_33o_incident_event_delete BEFORE DELETE ON policy_incident_events BEGIN SELECT RAISE(ABORT,'33-O incident events are immutable'); END;
CREATE TRIGGER trg_33o_revocation_update BEFORE UPDATE ON policy_incident_revocations BEGIN SELECT RAISE(ABORT,'33-O revocations are immutable'); END;
CREATE TRIGGER trg_33o_revocation_delete BEFORE DELETE ON policy_incident_revocations BEGIN SELECT RAISE(ABORT,'33-O revocations are immutable'); END;
CREATE TRIGGER trg_33o_quarantine_delete BEFORE DELETE ON policy_incident_quarantine_items BEGIN SELECT RAISE(ABORT,'33-O quarantine items cannot be deleted'); END;

CREATE TRIGGER trg_33o_ai_current_quota BEFORE INSERT ON governed_ai_memory_records WHEN (SELECT COUNT(*) FROM governed_ai_memory_records WHERE account_id=NEW.account_id)>=500 BEGIN SELECT RAISE(ABORT,'33-O AI memory quota exceeded'); END;
CREATE TRIGGER trg_33o_ai_mutation_quota BEFORE INSERT ON governed_ai_memory_mutations WHEN (SELECT COUNT(*) FROM governed_ai_memory_mutations WHERE account_id=NEW.account_id)>=4096 BEGIN SELECT RAISE(ABORT,'33-O AI memory history quota exceeded'); END;
CREATE TRIGGER trg_33o_access_quota BEFORE INSERT ON privacy_access_observations WHEN (SELECT COUNT(*) FROM privacy_access_observations WHERE account_id=NEW.account_id)>=500 BEGIN SELECT RAISE(ABORT,'33-O access observation quota exceeded'); END;
CREATE TRIGGER trg_33o_processing_quota BEFORE INSERT ON privacy_processing_observations WHEN (SELECT COUNT(*) FROM privacy_processing_observations WHERE account_id=NEW.account_id)>=500 BEGIN SELECT RAISE(ABORT,'33-O processing observation quota exceeded'); END;
CREATE TRIGGER trg_33o_rights_quota BEFORE INSERT ON privacy_rights_requests WHEN (SELECT COUNT(*) FROM privacy_rights_requests WHERE account_id=NEW.account_id)>=100 BEGIN SELECT RAISE(ABORT,'33-O rights request quota exceeded'); END;
CREATE TRIGGER trg_33o_rights_event_quota BEFORE INSERT ON privacy_rights_request_events WHEN (SELECT COUNT(*) FROM privacy_rights_request_events WHERE account_id=NEW.account_id)>=1024 BEGIN SELECT RAISE(ABORT,'33-O rights event quota exceeded'); END;
CREATE TRIGGER trg_33o_export_quota BEFORE INSERT ON privacy_export_records WHEN (SELECT COUNT(*) FROM privacy_export_records WHERE account_id=NEW.account_id)>=256 BEGIN SELECT RAISE(ABORT,'33-O export receipt quota exceeded'); END;
CREATE TRIGGER trg_33o_incident_quota BEFORE INSERT ON policy_incident_cases WHEN (SELECT COUNT(*) FROM policy_incident_cases WHERE account_id=NEW.account_id)>=100 BEGIN SELECT RAISE(ABORT,'33-O incident quota exceeded'); END;
CREATE TRIGGER trg_33o_incident_event_quota BEFORE INSERT ON policy_incident_events WHEN (SELECT COUNT(*) FROM policy_incident_events WHERE account_id=NEW.account_id)>=2048 BEGIN SELECT RAISE(ABORT,'33-O incident event quota exceeded'); END;
CREATE TRIGGER trg_33o_revocation_quota BEFORE INSERT ON policy_incident_revocations WHEN (SELECT COUNT(*) FROM policy_incident_revocations WHERE account_id=NEW.account_id)>=512 BEGIN SELECT RAISE(ABORT,'33-O incident revocation quota exceeded'); END;
CREATE TRIGGER trg_33o_quarantine_quota BEFORE INSERT ON policy_incident_quarantine_items WHEN (SELECT COUNT(*) FROM policy_incident_quarantine_items WHERE account_id=NEW.account_id)>=512 BEGIN SELECT RAISE(ABORT,'33-O quarantine quota exceeded'); END;

UPDATE database_metadata SET value='REVISION-33-O-PRIVACY-OWNERSHIP-DATA-RIGHTS-INCIDENT-CONTROL',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key='schema_generation';
`;

const identityAccessCredentialLedgerSql = `
CREATE TABLE identity_access_mutations (
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
  client_operation_id TEXT NOT NULL CHECK(length(trim(client_operation_id)) BETWEEN 1 AND 160),
  request_fingerprint TEXT NOT NULL CHECK(length(request_fingerprint)=64 AND request_fingerprint NOT GLOB '*[^0-9a-f]*'),
  state_fingerprint TEXT NOT NULL CHECK(length(state_fingerprint)=64 AND state_fingerprint NOT GLOB '*[^0-9a-f]*'),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  mutation_kind TEXT NOT NULL CHECK(mutation_kind IN ('passkey_register','passkey_authenticate','passkey_revoke','passkey_recover_lost','federated_link','federated_unlink','temporary_credential_issue','temporary_credential_revoke')),
  resource_type TEXT NOT NULL CHECK(resource_type IN ('passkey_credential','federated_identity_link','temporary_verifiable_credential')),
  resource_id TEXT NOT NULL CHECK(length(trim(resource_id)) BETWEEN 1 AND 256),
  previous_revision INTEGER NOT NULL CHECK(previous_revision>=0),
  revision INTEGER NOT NULL CHECK(revision=previous_revision+1),
  policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
  occurred_at TEXT NOT NULL CHECK(length(occurred_at)=24 AND occurred_at GLOB '????-??-??T??:??:??.???Z' AND julianday(occurred_at) IS NOT NULL),
  UNIQUE(account_id,client_operation_id), UNIQUE(resource_type,resource_id,revision)
) STRICT;
CREATE INDEX idx_identity_mutations_resource ON identity_access_mutations(account_id,resource_type,resource_id,revision DESC);

CREATE TABLE identity_passkey_challenges (
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL CHECK(purpose IN ('passkey_registration','passkey_authentication')),
  challenge_sha256 TEXT NOT NULL UNIQUE CHECK(length(challenge_sha256)=64 AND challenge_sha256 NOT GLOB '*[^0-9a-f]*'),
  relying_party_id TEXT NOT NULL CHECK(length(trim(relying_party_id)) BETWEEN 1 AND 253),
  trusted_device_id TEXT NOT NULL REFERENCES trusted_devices(id) ON DELETE RESTRICT,
  device_id TEXT NOT NULL CHECK(length(trim(device_id)) BETWEEN 1 AND 256),
  security_epoch INTEGER NOT NULL CHECK(security_epoch BETWEEN 0 AND 2147483647),
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL, consumed_at TEXT,
  consumption_mutation_id TEXT REFERENCES identity_access_mutations(id) ON DELETE RESTRICT,
  policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
  CHECK(length(created_at)=24 AND julianday(created_at) IS NOT NULL),
  CHECK(length(expires_at)=24 AND julianday(expires_at) IS NOT NULL),
  CHECK(julianday(expires_at)>julianday(created_at) AND (julianday(expires_at)-julianday(created_at))*86400.0<=300.001),
  CHECK((consumed_at IS NULL)=(consumption_mutation_id IS NULL))
) STRICT;

CREATE TABLE identity_passkey_credentials (
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK(revision>=1), display_name TEXT NOT NULL CHECK(length(trim(display_name)) BETWEEN 1 AND 120),
  credential_id TEXT NOT NULL UNIQUE CHECK(length(trim(credential_id)) BETWEEN 1 AND 2048),
  credential_id_sha256 TEXT NOT NULL UNIQUE CHECK(length(credential_id_sha256)=64 AND credential_id_sha256 NOT GLOB '*[^0-9a-f]*'),
  public_key_cose_base64url TEXT NOT NULL CHECK(length(trim(public_key_cose_base64url)) BETWEEN 1 AND 8192),
  public_key_sha256 TEXT NOT NULL CHECK(length(public_key_sha256)=64 AND public_key_sha256 NOT GLOB '*[^0-9a-f]*'),
  user_handle_sha256 TEXT NOT NULL CHECK(length(user_handle_sha256)=64 AND user_handle_sha256 NOT GLOB '*[^0-9a-f]*'),
  relying_party_id TEXT NOT NULL CHECK(length(trim(relying_party_id)) BETWEEN 1 AND 253), aaguid TEXT CHECK(length(trim(aaguid)) BETWEEN 1 AND 64),
  transports_json TEXT NOT NULL CHECK(json_valid(transports_json) AND json_type(transports_json)='array' AND length(transports_json)<=128),
  sign_count INTEGER NOT NULL CHECK(sign_count BETWEEN 0 AND 4294967295), backup_eligible INTEGER NOT NULL CHECK(backup_eligible IN (0,1)), backup_state INTEGER NOT NULL CHECK(backup_state IN (0,1)),
  trusted_device_id TEXT NOT NULL REFERENCES trusted_devices(id) ON DELETE RESTRICT, security_epoch INTEGER NOT NULL CHECK(security_epoch BETWEEN 0 AND 2147483647),
  status TEXT NOT NULL CHECK(status IN ('active','revoked')), created_at TEXT NOT NULL, last_used_at TEXT, revoked_at TEXT,
  revocation_reason TEXT CHECK(revocation_reason IN ('manual','lost','recovery','device_revoked','security_epoch_changed')),
  last_mutation_id TEXT NOT NULL REFERENCES identity_access_mutations(id) ON DELETE RESTRICT,
  state_fingerprint TEXT NOT NULL CHECK(length(state_fingerprint)=64 AND state_fingerprint NOT GLOB '*[^0-9a-f]*'),
  policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
  CHECK((status='active' AND revoked_at IS NULL AND revocation_reason IS NULL) OR (status='revoked' AND revoked_at IS NOT NULL AND revocation_reason IS NOT NULL))
) STRICT;
CREATE INDEX idx_identity_passkeys_owner ON identity_passkey_credentials(account_id,status,created_at DESC);

CREATE TABLE identity_passkey_credential_tombstones (
  credential_id_sha256 TEXT PRIMARY KEY CHECK(length(credential_id_sha256)=64 AND credential_id_sha256 NOT GLOB '*[^0-9a-f]*'),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  terminal_status TEXT NOT NULL CHECK(terminal_status='revoked'),
  revocation_reason TEXT NOT NULL CHECK(revocation_reason IN ('manual','lost','recovery','device_revoked','security_epoch_changed')),
  revoked_at TEXT NOT NULL CHECK(length(revoked_at)=24 AND julianday(revoked_at) IS NOT NULL),
  retain_until TEXT NOT NULL CHECK(length(retain_until)=24 AND julianday(retain_until)>julianday(revoked_at)),
  final_revision INTEGER NOT NULL CHECK(final_revision>=2),
  final_state_fingerprint TEXT NOT NULL CHECK(length(final_state_fingerprint)=64 AND final_state_fingerprint NOT GLOB '*[^0-9a-f]*'),
  final_mutation_id TEXT NOT NULL REFERENCES identity_access_mutations(id) ON DELETE RESTRICT,
  policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
  recorded_at TEXT NOT NULL CHECK(length(recorded_at)=24 AND julianday(recorded_at) IS NOT NULL)
) STRICT;

CREATE TABLE identity_federated_provider_configurations (
  provider TEXT PRIMARY KEY CHECK(provider IN ('apple','google','microsoft')), configured INTEGER NOT NULL CHECK(configured IN (0,1)),
  configuration_id TEXT NOT NULL CHECK(length(trim(configuration_id)) BETWEEN 1 AND 128),
  authorization_endpoint_sha256 TEXT NOT NULL CHECK(length(authorization_endpoint_sha256)=64 AND authorization_endpoint_sha256 NOT GLOB '*[^0-9a-f]*'),
  client_configuration_sha256 TEXT NOT NULL CHECK(length(client_configuration_sha256)=64 AND client_configuration_sha256 NOT GLOB '*[^0-9a-f]*')
) STRICT;

CREATE TABLE identity_access_source_clocks (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE RESTRICT,
  source_version INTEGER NOT NULL CHECK(source_version BETWEEN 1 AND 9007199254740991),
  updated_at TEXT NOT NULL CHECK(length(updated_at)=24 AND julianday(updated_at) IS NOT NULL)
) STRICT;

CREATE TABLE identity_federated_links (
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128), family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT, owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK(revision>=1), provider TEXT NOT NULL REFERENCES identity_federated_provider_configurations(provider) ON DELETE RESTRICT,
  configuration_id TEXT NOT NULL CHECK(length(trim(configuration_id)) BETWEEN 1 AND 128),
  authorization_endpoint_sha256 TEXT NOT NULL CHECK(length(authorization_endpoint_sha256)=64 AND authorization_endpoint_sha256 NOT GLOB '*[^0-9a-f]*'),
  client_configuration_sha256 TEXT NOT NULL CHECK(length(client_configuration_sha256)=64 AND client_configuration_sha256 NOT GLOB '*[^0-9a-f]*'),
  provider_subject_sha256 TEXT NOT NULL CHECK(length(provider_subject_sha256)=64 AND provider_subject_sha256 NOT GLOB '*[^0-9a-f]*'),
  granted_scopes_json TEXT NOT NULL CHECK(json_valid(granted_scopes_json) AND json_type(granted_scopes_json)='array' AND length(granted_scopes_json)<=1024),
  status TEXT NOT NULL CHECK(status IN ('linked','revoked')), encrypted_vault_entry_id TEXT NOT NULL CHECK(length(trim(encrypted_vault_entry_id)) BETWEEN 1 AND 256),
  live_account_tested INTEGER NOT NULL CHECK(live_account_tested=1), authorization_code_pkce_verified INTEGER NOT NULL CHECK(authorization_code_pkce_verified=1),
  state_verified INTEGER NOT NULL CHECK(state_verified=1), nonce_verified INTEGER NOT NULL CHECK(nonce_verified=1),
  token_bytes_exposed INTEGER NOT NULL CHECK(token_bytes_exposed=0), token_stored_in_encrypted_vault INTEGER NOT NULL CHECK(token_stored_in_encrypted_vault=1),
  provider_availability_guaranteed INTEGER NOT NULL CHECK(provider_availability_guaranteed=0), provider_delivery_guaranteed INTEGER NOT NULL CHECK(provider_delivery_guaranteed=0),
  linked_at TEXT NOT NULL, last_locally_verified_at TEXT NOT NULL, revoked_at TEXT,
  last_mutation_id TEXT NOT NULL REFERENCES identity_access_mutations(id) ON DELETE RESTRICT,
  state_fingerprint TEXT NOT NULL CHECK(length(state_fingerprint)=64 AND state_fingerprint NOT GLOB '*[^0-9a-f]*'),
  policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
  UNIQUE(account_id,provider), UNIQUE(provider,provider_subject_sha256), CHECK((status='linked' AND revoked_at IS NULL) OR (status='revoked' AND revoked_at IS NOT NULL))
) STRICT;

CREATE TABLE identity_temporary_credentials (
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128), family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT, owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK(revision>=1), kind TEXT NOT NULL CHECK(kind IN ('school_pickup','temporary_caregiver','pet_caregiver','emergency_contact_health','event_invitation','temporary_home_access')),
  purpose TEXT NOT NULL CHECK(purpose IN ('school_pickup_authorization','temporary_care_authorization','pet_care_authorization','emergency_contact_health_access','event_invitation_access','temporary_home_access')),
  audience_ref_sha256 TEXT NOT NULL CHECK(length(audience_ref_sha256)=64 AND audience_ref_sha256 NOT GLOB '*[^0-9a-f]*'),
  disclosed_claim_keys_json TEXT NOT NULL CHECK(json_valid(disclosed_claim_keys_json) AND json_type(disclosed_claim_keys_json)='array' AND json_array_length(disclosed_claim_keys_json) BETWEEN 1 AND 8 AND length(disclosed_claim_keys_json)<=512),
  disclosure_sha256 TEXT NOT NULL CHECK(length(disclosure_sha256)=64 AND disclosure_sha256 NOT GLOB '*[^0-9a-f]*'), payload_sha256 TEXT NOT NULL UNIQUE CHECK(length(payload_sha256)=64 AND payload_sha256 NOT GLOB '*[^0-9a-f]*'),
  signature_sha256 TEXT NOT NULL CHECK(length(signature_sha256)=64 AND signature_sha256 NOT GLOB '*[^0-9a-f]*'), issuer_key_id TEXT NOT NULL CHECK(length(trim(issuer_key_id)) BETWEEN 1 AND 128),
  issuer_public_key_sha256 TEXT NOT NULL CHECK(length(issuer_public_key_sha256)=64 AND issuer_public_key_sha256 NOT GLOB '*[^0-9a-f]*'), signature_algorithm TEXT NOT NULL CHECK(signature_algorithm='Ed25519'),
  qr_payload_bytes INTEGER NOT NULL CHECK(qr_payload_bytes BETWEEN 1 AND 4096), status TEXT NOT NULL CHECK(status IN ('active','revoked')),
  not_before TEXT NOT NULL, expires_at TEXT NOT NULL, issued_at TEXT NOT NULL, revoked_at TEXT, revocation_reason TEXT CHECK(length(trim(revocation_reason)) BETWEEN 1 AND 256),
  encrypted_envelope_reference TEXT NOT NULL CHECK(length(trim(encrypted_envelope_reference)) BETWEEN 1 AND 256),
  last_mutation_id TEXT NOT NULL REFERENCES identity_access_mutations(id) ON DELETE RESTRICT,
  state_fingerprint TEXT NOT NULL CHECK(length(state_fingerprint)=64 AND state_fingerprint NOT GLOB '*[^0-9a-f]*'),
  policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
  CHECK(julianday(expires_at)>julianday(not_before) AND (julianday(expires_at)-julianday(not_before))*86400.0<=2678400.001),
  CHECK((status='active' AND revoked_at IS NULL AND revocation_reason IS NULL) OR (status='revoked' AND revoked_at IS NOT NULL AND revocation_reason IS NOT NULL))
) STRICT;
CREATE INDEX idx_identity_temp_owner ON identity_temporary_credentials(account_id,status,expires_at DESC);

CREATE TABLE identity_temporary_credential_tombstones (
  credential_id TEXT PRIMARY KEY CHECK(length(trim(credential_id)) BETWEEN 1 AND 128),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  payload_sha256 TEXT NOT NULL UNIQUE CHECK(length(payload_sha256)=64 AND payload_sha256 NOT GLOB '*[^0-9a-f]*'),
  terminal_status TEXT NOT NULL CHECK(terminal_status IN ('expired','revoked')),
  expires_at TEXT NOT NULL CHECK(length(expires_at)=24 AND julianday(expires_at) IS NOT NULL),
  revoked_at TEXT CHECK(revoked_at IS NULL OR (length(revoked_at)=24 AND julianday(revoked_at) IS NOT NULL)),
  retain_until TEXT NOT NULL CHECK(length(retain_until)=24 AND julianday(retain_until)>julianday(expires_at)),
  final_revision INTEGER NOT NULL CHECK(final_revision>=1),
  final_state_fingerprint TEXT NOT NULL CHECK(length(final_state_fingerprint)=64 AND final_state_fingerprint NOT GLOB '*[^0-9a-f]*'),
  final_mutation_id TEXT NOT NULL REFERENCES identity_access_mutations(id) ON DELETE RESTRICT,
  policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
  pruned_at TEXT NOT NULL CHECK(length(pruned_at)=24 AND julianday(pruned_at) IS NOT NULL)
) STRICT;

CREATE TABLE identity_companion_snapshots (
  id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128), family_id TEXT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT, owner_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  trusted_device_id TEXT NOT NULL REFERENCES trusted_devices(id) ON DELETE RESTRICT, protocol_version INTEGER NOT NULL CHECK(protocol_version=1),
  source_version INTEGER NOT NULL CHECK(source_version>=0), schema_version INTEGER NOT NULL CHECK(schema_version>=1),
  ciphertext_sha256 TEXT NOT NULL CHECK(length(ciphertext_sha256)=64 AND ciphertext_sha256 NOT GLOB '*[^0-9a-f]*'), envelope_sha256 TEXT NOT NULL CHECK(length(envelope_sha256)=64 AND envelope_sha256 NOT GLOB '*[^0-9a-f]*'),
  envelope_bytes INTEGER NOT NULL CHECK(envelope_bytes BETWEEN 1 AND 8388608), security_epoch INTEGER NOT NULL CHECK(security_epoch>=0), generated_at TEXT NOT NULL, expires_at TEXT NOT NULL,
  policy_receipt_hash TEXT NOT NULL REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT,
  UNIQUE(account_id,trusted_device_id,source_version,schema_version,security_epoch),
  CHECK(julianday(expires_at)>julianday(generated_at) AND (julianday(expires_at)-julianday(generated_at))*86400.0<=86400.001)
) STRICT;

CREATE TRIGGER trg_33p_mutation_receipt BEFORE INSERT ON identity_access_mutations
WHEN NOT EXISTS(SELECT 1 FROM accounts a JOIN people p ON p.id=a.person_id
 JOIN platform_policy_transaction_receipts receipt ON receipt.receipt_hash=NEW.policy_receipt_hash
 JOIN platform_policy_database_fences fence ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
 JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
 WHERE a.id=NEW.account_id AND a.person_id=NEW.owner_person_id AND a.status='active' AND p.id=NEW.owner_person_id AND p.family_id=NEW.family_id AND p.status='active'
 AND receipt.resource_type=NEW.resource_type AND receipt.resource_id=NEW.resource_id AND receipt.capability='family.write'
 AND receipt.issued_at=NEW.occurred_at AND receipt.recorded_at=NEW.occurred_at
 AND receipt.action=CASE WHEN NEW.mutation_kind IN ('passkey_register','federated_link','temporary_credential_issue') THEN 'create'
                         WHEN NEW.mutation_kind IN ('passkey_revoke','passkey_recover_lost','federated_unlink','temporary_credential_revoke') THEN 'delete' ELSE 'update' END
 AND json_extract(receipt.record_json,'$.request.subject.accountId')=NEW.account_id
 AND json_extract(receipt.record_json,'$.request.subject.personId')=NEW.owner_person_id
 AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
 AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
 AND json_extract(receipt.record_json,'$.request.purpose')='administration'
 AND json_extract(receipt.record_json,'$.request.resource.sensitivity')='highly_sensitive')
BEGIN SELECT RAISE(ABORT,'33-P mutation requires exact durable identity receipt'); END;

CREATE TRIGGER trg_33p_challenge_insert BEFORE INSERT ON identity_passkey_challenges
WHEN NOT EXISTS(SELECT 1 FROM accounts a JOIN people p ON p.id=a.person_id JOIN trusted_devices d ON d.id=NEW.trusted_device_id
 JOIN platform_policy_transaction_receipts receipt ON receipt.receipt_hash=NEW.policy_receipt_hash
 JOIN platform_policy_database_fences fence ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
 JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
 WHERE a.id=NEW.account_id AND a.person_id=NEW.owner_person_id AND a.security_epoch=NEW.security_epoch AND a.status='active'
 AND p.id=NEW.owner_person_id AND p.family_id=NEW.family_id AND p.status='active' AND d.account_id=NEW.account_id AND d.device_id=NEW.device_id AND d.security_epoch=NEW.security_epoch AND d.revoked_at IS NULL
 AND receipt.resource_type='identity_challenge' AND receipt.resource_id=NEW.id AND receipt.action='create' AND receipt.capability='family.write'
 AND receipt.issued_at=NEW.created_at AND receipt.recorded_at=NEW.created_at
 AND json_extract(receipt.record_json,'$.request.subject.accountId')=NEW.account_id AND json_extract(receipt.record_json,'$.request.subject.personId')=NEW.owner_person_id
 AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id
 AND json_extract(receipt.record_json,'$.request.purpose')='administration' AND json_extract(receipt.record_json,'$.request.resource.sensitivity')='highly_sensitive')
BEGIN SELECT RAISE(ABORT,'33-P challenge requires active device epoch and exact receipt'); END;

CREATE TRIGGER trg_33p_challenge_consume BEFORE UPDATE ON identity_passkey_challenges
WHEN OLD.consumed_at IS NOT NULL OR NEW.consumed_at IS NULL OR NEW.consumption_mutation_id IS NULL OR julianday(NEW.consumed_at)>=julianday(OLD.expires_at)
 OR NEW.id<>OLD.id OR NEW.family_id<>OLD.family_id OR NEW.account_id<>OLD.account_id OR NEW.owner_person_id<>OLD.owner_person_id
 OR NEW.purpose<>OLD.purpose OR NEW.challenge_sha256<>OLD.challenge_sha256 OR NEW.relying_party_id<>OLD.relying_party_id OR NEW.trusted_device_id<>OLD.trusted_device_id
 OR NEW.device_id<>OLD.device_id OR NEW.security_epoch<>OLD.security_epoch OR NEW.created_at<>OLD.created_at OR NEW.expires_at<>OLD.expires_at OR NEW.policy_receipt_hash<>OLD.policy_receipt_hash
 OR NOT EXISTS(SELECT 1 FROM identity_access_mutations m WHERE m.id=NEW.consumption_mutation_id AND m.family_id=NEW.family_id AND m.account_id=NEW.account_id AND m.owner_person_id=NEW.owner_person_id
   AND m.mutation_kind=CASE NEW.purpose WHEN 'passkey_registration' THEN 'passkey_register' ELSE 'passkey_authenticate' END)
BEGIN SELECT RAISE(ABORT,'33-P challenge replay, expiry or mutation mismatch'); END;

CREATE TRIGGER trg_33p_passkey_current_insert BEFORE INSERT ON identity_passkey_credentials
WHEN NEW.status<>'active' OR NEW.revoked_at IS NOT NULL OR (SELECT COUNT(*) FROM identity_passkey_credentials WHERE account_id=NEW.account_id AND status='active')>=16
 OR (SELECT COUNT(*) FROM (SELECT credential_id_sha256 FROM identity_passkey_credentials WHERE account_id=NEW.account_id UNION SELECT credential_id_sha256 FROM identity_passkey_credential_tombstones WHERE account_id=NEW.account_id))>=256
 OR EXISTS(SELECT 1 FROM identity_passkey_credential_tombstones tombstone WHERE tombstone.credential_id_sha256=NEW.credential_id_sha256 AND julianday(tombstone.retain_until)>julianday(NEW.created_at)) OR NOT EXISTS(
 SELECT 1 FROM identity_access_mutations m JOIN trusted_devices d ON d.id=NEW.trusted_device_id
 WHERE m.id=NEW.last_mutation_id AND m.family_id=NEW.family_id AND m.account_id=NEW.account_id AND m.owner_person_id=NEW.owner_person_id
 AND m.mutation_kind='passkey_register' AND m.resource_type='passkey_credential' AND m.resource_id=NEW.id AND m.previous_revision=0 AND m.revision=NEW.revision AND m.state_fingerprint=NEW.state_fingerprint AND m.occurred_at=NEW.created_at
 AND m.policy_receipt_hash=NEW.policy_receipt_hash AND d.account_id=NEW.account_id AND d.security_epoch=NEW.security_epoch AND d.revoked_at IS NULL)
BEGIN SELECT RAISE(ABORT,'33-P passkey insert requires exact mutation/device or quota'); END;
CREATE TRIGGER trg_33p_passkey_current_update BEFORE UPDATE ON identity_passkey_credentials
WHEN NEW.revision<>OLD.revision+1 OR NEW.id<>OLD.id OR NEW.family_id<>OLD.family_id OR NEW.account_id<>OLD.account_id OR NEW.owner_person_id<>OLD.owner_person_id
 OR NEW.credential_id<>OLD.credential_id OR NEW.credential_id_sha256<>OLD.credential_id_sha256 OR NEW.public_key_cose_base64url<>OLD.public_key_cose_base64url OR NEW.public_key_sha256<>OLD.public_key_sha256 OR NEW.user_handle_sha256<>OLD.user_handle_sha256
 OR NEW.display_name<>OLD.display_name OR NEW.relying_party_id<>OLD.relying_party_id OR NEW.aaguid IS NOT OLD.aaguid OR NEW.transports_json<>OLD.transports_json
 OR NEW.trusted_device_id<>OLD.trusted_device_id OR NEW.security_epoch<>OLD.security_epoch OR NEW.created_at<>OLD.created_at
 OR OLD.status='revoked' OR (NEW.status='active' AND NOT ((OLD.sign_count=0 AND NEW.sign_count=0) OR NEW.sign_count>OLD.sign_count)) OR (NEW.status='revoked' AND NEW.sign_count<>OLD.sign_count)
 OR (NEW.status='revoked' AND (NEW.backup_eligible<>OLD.backup_eligible OR NEW.backup_state<>OLD.backup_state OR NEW.last_used_at IS NOT OLD.last_used_at))
 OR NOT EXISTS(SELECT 1 FROM identity_access_mutations m WHERE m.id=NEW.last_mutation_id AND m.family_id=NEW.family_id AND m.account_id=NEW.account_id AND m.owner_person_id=NEW.owner_person_id
  AND m.resource_type='passkey_credential' AND m.resource_id=NEW.id AND m.previous_revision=OLD.revision AND m.revision=NEW.revision AND m.state_fingerprint=NEW.state_fingerprint AND m.policy_receipt_hash=NEW.policy_receipt_hash
  AND ((m.mutation_kind='passkey_authenticate' AND NEW.status='active') OR (m.mutation_kind IN ('passkey_revoke','passkey_recover_lost') AND NEW.status='revoked')))
BEGIN SELECT RAISE(ABORT,'33-P passkey optimistic revision, clone counter or transition mismatch'); END;
CREATE TRIGGER trg_33p_passkey_tombstone_insert BEFORE INSERT ON identity_passkey_credential_tombstones
WHEN (SELECT COUNT(*) FROM identity_passkey_credential_tombstones WHERE account_id=NEW.account_id)>=256
 OR abs((julianday(NEW.retain_until)-julianday(NEW.revoked_at))*86400.0-31536000.0)>0.001 OR julianday(NEW.recorded_at)<julianday(NEW.revoked_at) OR NOT EXISTS(
 SELECT 1 FROM identity_passkey_credentials current WHERE current.credential_id_sha256=NEW.credential_id_sha256
 AND current.family_id=NEW.family_id AND current.account_id=NEW.account_id AND current.owner_person_id=NEW.owner_person_id
 AND current.status='revoked' AND current.revocation_reason=NEW.revocation_reason AND current.revoked_at=NEW.revoked_at
 AND current.revision=NEW.final_revision AND current.state_fingerprint=NEW.final_state_fingerprint
 AND current.last_mutation_id=NEW.final_mutation_id AND current.policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'33-P passkey tombstone requires exact revoked credential and bounded retention'); END;

CREATE TRIGGER trg_33p_federated_insert BEFORE INSERT ON identity_federated_links
WHEN NEW.status<>'linked' OR NEW.revoked_at IS NOT NULL OR (SELECT COUNT(*) FROM identity_federated_links WHERE account_id=NEW.account_id AND status='linked')>=3 OR NOT EXISTS(SELECT 1 FROM identity_access_mutations m
 JOIN identity_federated_provider_configurations config ON config.provider=NEW.provider AND config.configured=1 AND config.configuration_id=NEW.configuration_id AND config.authorization_endpoint_sha256=NEW.authorization_endpoint_sha256 AND config.client_configuration_sha256=NEW.client_configuration_sha256
 WHERE m.id=NEW.last_mutation_id AND m.family_id=NEW.family_id AND m.account_id=NEW.account_id AND m.owner_person_id=NEW.owner_person_id AND m.mutation_kind='federated_link'
 AND m.resource_type='federated_identity_link' AND m.resource_id=NEW.id AND m.previous_revision=0 AND m.revision=NEW.revision AND m.state_fingerprint=NEW.state_fingerprint AND m.policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'33-P federated link requires exact mutation or quota'); END;
CREATE TRIGGER trg_33p_federated_update BEFORE UPDATE ON identity_federated_links
WHEN NEW.revision<>OLD.revision+1 OR NEW.id<>OLD.id OR NEW.family_id<>OLD.family_id OR NEW.account_id<>OLD.account_id OR NEW.owner_person_id<>OLD.owner_person_id OR NEW.provider<>OLD.provider
 OR NOT EXISTS(SELECT 1 FROM identity_access_mutations m
   JOIN identity_federated_provider_configurations config ON config.provider=NEW.provider AND config.configured=1
     AND config.configuration_id=NEW.configuration_id AND config.authorization_endpoint_sha256=NEW.authorization_endpoint_sha256 AND config.client_configuration_sha256=NEW.client_configuration_sha256
   WHERE m.id=NEW.last_mutation_id AND m.family_id=NEW.family_id AND m.account_id=NEW.account_id AND m.owner_person_id=NEW.owner_person_id
   AND m.resource_type='federated_identity_link' AND m.resource_id=NEW.id AND m.previous_revision=OLD.revision AND m.revision=NEW.revision AND m.state_fingerprint=NEW.state_fingerprint AND m.policy_receipt_hash=NEW.policy_receipt_hash
   AND ((OLD.status='linked' AND NEW.status='revoked' AND m.mutation_kind='federated_unlink'
         AND NEW.configuration_id=OLD.configuration_id AND NEW.authorization_endpoint_sha256=OLD.authorization_endpoint_sha256 AND NEW.client_configuration_sha256=OLD.client_configuration_sha256
         AND NEW.provider_subject_sha256=OLD.provider_subject_sha256 AND NEW.encrypted_vault_entry_id=OLD.encrypted_vault_entry_id AND NEW.granted_scopes_json=OLD.granted_scopes_json AND NEW.linked_at=OLD.linked_at)
     OR (OLD.status='revoked' AND NEW.status='linked' AND NEW.revoked_at IS NULL AND m.mutation_kind='federated_link')))
BEGIN SELECT RAISE(ABORT,'33-P federation unlink/relink transition or configuration mismatch'); END;

CREATE TRIGGER trg_33p_temp_insert BEFORE INSERT ON identity_temporary_credentials
WHEN NEW.status<>'active' OR NEW.revoked_at IS NOT NULL OR NEW.revocation_reason IS NOT NULL
 OR NEW.purpose<>CASE NEW.kind WHEN 'school_pickup' THEN 'school_pickup_authorization' WHEN 'temporary_caregiver' THEN 'temporary_care_authorization'
   WHEN 'pet_caregiver' THEN 'pet_care_authorization' WHEN 'emergency_contact_health' THEN 'emergency_contact_health_access'
   WHEN 'event_invitation' THEN 'event_invitation_access' WHEN 'temporary_home_access' THEN 'temporary_home_access' END
 OR (SELECT COUNT(*) FROM json_each(NEW.disclosed_claim_keys_json))<>(SELECT COUNT(DISTINCT value) FROM json_each(NEW.disclosed_claim_keys_json))
 OR EXISTS(SELECT 1 FROM json_each(NEW.disclosed_claim_keys_json) claim WHERE claim.type<>'text' OR claim.value NOT IN (
   'subject_display_name','authorized_person_display_name','caregiver_display_name','pet_display_name','school_name','emergency_contact_name','emergency_contact_phone','allergy_summary','critical_medication_summary','event_title','valid_location_label','contact_phone'))
 OR EXISTS(SELECT 1 FROM json_each(NEW.disclosed_claim_keys_json) claim WHERE
   (NEW.kind='school_pickup' AND claim.value NOT IN ('subject_display_name','authorized_person_display_name','school_name','contact_phone')) OR
   (NEW.kind='temporary_caregiver' AND claim.value NOT IN ('subject_display_name','caregiver_display_name','contact_phone')) OR
   (NEW.kind='pet_caregiver' AND claim.value NOT IN ('pet_display_name','caregiver_display_name','contact_phone')) OR
   (NEW.kind='emergency_contact_health' AND claim.value NOT IN ('subject_display_name','emergency_contact_name','emergency_contact_phone','allergy_summary','critical_medication_summary')) OR
   (NEW.kind='event_invitation' AND claim.value NOT IN ('subject_display_name','event_title','valid_location_label','contact_phone')) OR
   (NEW.kind='temporary_home_access' AND claim.value NOT IN ('subject_display_name','valid_location_label','contact_phone')))
 OR (NEW.kind='school_pickup' AND (NOT EXISTS(SELECT 1 FROM json_each(NEW.disclosed_claim_keys_json) WHERE value='subject_display_name') OR NOT EXISTS(SELECT 1 FROM json_each(NEW.disclosed_claim_keys_json) WHERE value='authorized_person_display_name')))
 OR (NEW.kind='temporary_caregiver' AND (NOT EXISTS(SELECT 1 FROM json_each(NEW.disclosed_claim_keys_json) WHERE value='subject_display_name') OR NOT EXISTS(SELECT 1 FROM json_each(NEW.disclosed_claim_keys_json) WHERE value='caregiver_display_name')))
 OR (NEW.kind='pet_caregiver' AND (NOT EXISTS(SELECT 1 FROM json_each(NEW.disclosed_claim_keys_json) WHERE value='pet_display_name') OR NOT EXISTS(SELECT 1 FROM json_each(NEW.disclosed_claim_keys_json) WHERE value='caregiver_display_name')))
 OR (NEW.kind='emergency_contact_health' AND (NOT EXISTS(SELECT 1 FROM json_each(NEW.disclosed_claim_keys_json) WHERE value='subject_display_name') OR NOT EXISTS(SELECT 1 FROM json_each(NEW.disclosed_claim_keys_json) WHERE value='emergency_contact_name') OR NOT EXISTS(SELECT 1 FROM json_each(NEW.disclosed_claim_keys_json) WHERE value='emergency_contact_phone')))
 OR (NEW.kind='event_invitation' AND (NOT EXISTS(SELECT 1 FROM json_each(NEW.disclosed_claim_keys_json) WHERE value='subject_display_name') OR NOT EXISTS(SELECT 1 FROM json_each(NEW.disclosed_claim_keys_json) WHERE value='event_title')))
 OR (NEW.kind='temporary_home_access' AND (NOT EXISTS(SELECT 1 FROM json_each(NEW.disclosed_claim_keys_json) WHERE value='subject_display_name') OR NOT EXISTS(SELECT 1 FROM json_each(NEW.disclosed_claim_keys_json) WHERE value='valid_location_label')))
 OR (SELECT COUNT(*) FROM identity_temporary_credentials WHERE account_id=NEW.account_id AND status='active' AND julianday(expires_at)>julianday(NEW.issued_at))>=256
 OR (SELECT COUNT(*) FROM (SELECT id FROM identity_temporary_credentials WHERE account_id=NEW.account_id UNION SELECT credential_id AS id FROM identity_temporary_credential_tombstones WHERE account_id=NEW.account_id))>=2048
 OR NOT EXISTS(SELECT 1 FROM identity_access_mutations m
 WHERE m.id=NEW.last_mutation_id AND m.family_id=NEW.family_id AND m.account_id=NEW.account_id AND m.owner_person_id=NEW.owner_person_id AND m.mutation_kind='temporary_credential_issue'
 AND m.resource_type='temporary_verifiable_credential' AND m.resource_id=NEW.id AND m.previous_revision=0 AND m.revision=NEW.revision AND m.state_fingerprint=NEW.state_fingerprint AND m.policy_receipt_hash=NEW.policy_receipt_hash AND m.occurred_at=NEW.issued_at)
BEGIN SELECT RAISE(ABORT,'33-P temporary credential requires exact mutation or quota'); END;
CREATE TRIGGER trg_33p_temp_update BEFORE UPDATE ON identity_temporary_credentials
WHEN NEW.revision<>OLD.revision+1 OR OLD.status<>'active' OR NEW.status<>'revoked' OR NEW.id<>OLD.id OR NEW.family_id<>OLD.family_id OR NEW.account_id<>OLD.account_id OR NEW.owner_person_id<>OLD.owner_person_id
 OR NEW.kind<>OLD.kind OR NEW.purpose<>OLD.purpose OR NEW.audience_ref_sha256<>OLD.audience_ref_sha256 OR NEW.disclosed_claim_keys_json<>OLD.disclosed_claim_keys_json OR NEW.disclosure_sha256<>OLD.disclosure_sha256 OR NEW.payload_sha256<>OLD.payload_sha256 OR NEW.signature_sha256<>OLD.signature_sha256 OR NEW.encrypted_envelope_reference<>OLD.encrypted_envelope_reference
 OR NEW.issuer_key_id<>OLD.issuer_key_id OR NEW.issuer_public_key_sha256<>OLD.issuer_public_key_sha256 OR NEW.signature_algorithm<>OLD.signature_algorithm OR NEW.qr_payload_bytes<>OLD.qr_payload_bytes
 OR NEW.not_before<>OLD.not_before OR NEW.expires_at<>OLD.expires_at OR NEW.issued_at<>OLD.issued_at
 OR NOT EXISTS(SELECT 1 FROM identity_access_mutations m WHERE m.id=NEW.last_mutation_id AND m.family_id=NEW.family_id AND m.account_id=NEW.account_id AND m.owner_person_id=NEW.owner_person_id AND m.mutation_kind='temporary_credential_revoke' AND m.resource_type='temporary_verifiable_credential' AND m.resource_id=NEW.id AND m.previous_revision=OLD.revision AND m.revision=NEW.revision AND m.state_fingerprint=NEW.state_fingerprint AND m.policy_receipt_hash=NEW.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'33-P temporary credential revocation mismatch'); END;
CREATE TRIGGER trg_33p_temp_tombstone_insert BEFORE INSERT ON identity_temporary_credential_tombstones
WHEN (SELECT COUNT(*) FROM identity_temporary_credential_tombstones WHERE account_id=NEW.account_id)>=2048
 OR julianday(NEW.pruned_at)<julianday(NEW.expires_at)+7 OR abs((julianday(NEW.retain_until)-julianday(NEW.expires_at))*86400.0-31536000.0)>0.001 OR NOT EXISTS(
 SELECT 1 FROM identity_temporary_credentials current WHERE current.id=NEW.credential_id
 AND current.family_id=NEW.family_id AND current.account_id=NEW.account_id AND current.owner_person_id=NEW.owner_person_id
 AND current.payload_sha256=NEW.payload_sha256 AND current.expires_at=NEW.expires_at AND current.revision=NEW.final_revision
 AND current.state_fingerprint=NEW.final_state_fingerprint AND current.last_mutation_id=NEW.final_mutation_id
 AND current.policy_receipt_hash=NEW.policy_receipt_hash
 AND NEW.terminal_status=CASE current.status WHEN 'revoked' THEN 'revoked' ELSE 'expired' END
 AND NEW.revoked_at IS current.revoked_at)
BEGIN SELECT RAISE(ABORT,'33-P temporary tombstone requires expiry grace and exact content-free terminal metadata'); END;

CREATE TRIGGER trg_33p_companion_insert BEFORE INSERT ON identity_companion_snapshots
WHEN (SELECT COUNT(*) FROM identity_companion_snapshots WHERE account_id=NEW.account_id AND julianday(expires_at)>julianday(NEW.generated_at))>=256 OR NOT EXISTS(SELECT 1 FROM accounts a JOIN people p ON p.id=a.person_id JOIN trusted_devices d ON d.id=NEW.trusted_device_id
 JOIN platform_policy_transaction_receipts receipt ON receipt.receipt_hash=NEW.policy_receipt_hash
 JOIN platform_policy_database_fences fence ON fence.fence_name=receipt.fence_name AND fence.epoch=receipt.fence_epoch AND fence.writable=1
 JOIN platform_policy_journal_projection_outbox projection ON projection.receipt_hash=receipt.receipt_hash AND projection.record_json=receipt.record_json
 WHERE a.id=NEW.account_id AND a.person_id=NEW.owner_person_id AND a.security_epoch=NEW.security_epoch AND a.status='active' AND p.family_id=NEW.family_id AND p.status='active'
 AND d.account_id=NEW.account_id AND d.security_epoch=NEW.security_epoch AND d.revoked_at IS NULL AND receipt.resource_type='companion_sync_snapshot' AND receipt.resource_id=NEW.id
 AND receipt.action='create' AND receipt.capability='family.write' AND receipt.issued_at=NEW.generated_at AND receipt.recorded_at=NEW.generated_at AND json_extract(receipt.record_json,'$.request.subject.accountId')=NEW.account_id
 AND json_extract(receipt.record_json,'$.request.subject.personId')=NEW.owner_person_id AND json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id
 AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id AND json_extract(receipt.record_json,'$.request.purpose')='administration'
 AND json_extract(receipt.record_json,'$.request.resource.sensitivity')='highly_sensitive')
BEGIN SELECT RAISE(ABORT,'33-P companion snapshot requires exact current device receipt'); END;

CREATE TRIGGER trg_33p_mutation_update BEFORE UPDATE ON identity_access_mutations BEGIN SELECT RAISE(ABORT,'33-P mutation ledger is immutable'); END;
CREATE TRIGGER trg_33p_mutation_delete BEFORE DELETE ON identity_access_mutations
WHEN julianday(OLD.occurred_at)>julianday('now','-7 days')
 OR EXISTS(SELECT 1 FROM identity_passkey_challenges challenge WHERE challenge.consumption_mutation_id=OLD.id)
 OR EXISTS(SELECT 1 FROM identity_passkey_credentials current WHERE current.last_mutation_id=OLD.id)
 OR EXISTS(SELECT 1 FROM identity_federated_links current WHERE current.last_mutation_id=OLD.id)
 OR EXISTS(SELECT 1 FROM identity_temporary_credentials current WHERE current.last_mutation_id=OLD.id)
 OR EXISTS(SELECT 1 FROM identity_passkey_credential_tombstones tombstone WHERE tombstone.final_mutation_id=OLD.id)
 OR EXISTS(SELECT 1 FROM identity_temporary_credential_tombstones tombstone WHERE tombstone.final_mutation_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'33-P mutation prune requires seven-day grace and zero current/challenge/tombstone references'); END;
CREATE TRIGGER trg_33p_challenge_delete BEFORE DELETE ON identity_passkey_challenges
WHEN OLD.consumed_at IS NULL AND julianday(OLD.expires_at)>julianday('now')
BEGIN SELECT RAISE(ABORT,'33-P active challenge cannot be deleted'); END;
CREATE TRIGGER trg_33p_passkey_delete BEFORE DELETE ON identity_passkey_credentials
WHEN OLD.status<>'revoked' OR julianday(OLD.revoked_at)>julianday('now','-2 days') OR NOT EXISTS(
 SELECT 1 FROM identity_passkey_credential_tombstones tombstone WHERE tombstone.credential_id_sha256=OLD.credential_id_sha256
 AND tombstone.family_id=OLD.family_id AND tombstone.account_id=OLD.account_id AND tombstone.owner_person_id=OLD.owner_person_id
 AND tombstone.revoked_at=OLD.revoked_at AND tombstone.final_revision=OLD.revision AND tombstone.final_state_fingerprint=OLD.state_fingerprint
 AND tombstone.final_mutation_id=OLD.last_mutation_id AND tombstone.policy_receipt_hash=OLD.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'33-P passkey delete requires retained exact digest tombstone and replay grace'); END;
CREATE TRIGGER trg_33p_federated_delete BEFORE DELETE ON identity_federated_links BEGIN SELECT RAISE(ABORT,'33-P federated links cannot be deleted'); END;
CREATE TRIGGER trg_33p_temp_delete BEFORE DELETE ON identity_temporary_credentials
WHEN julianday(OLD.expires_at)>julianday('now','-7 days') OR NOT EXISTS(
 SELECT 1 FROM identity_temporary_credential_tombstones tombstone WHERE tombstone.credential_id=OLD.id
 AND tombstone.family_id=OLD.family_id AND tombstone.account_id=OLD.account_id AND tombstone.owner_person_id=OLD.owner_person_id
 AND tombstone.payload_sha256=OLD.payload_sha256 AND tombstone.expires_at=OLD.expires_at AND tombstone.final_revision=OLD.revision
 AND tombstone.final_state_fingerprint=OLD.state_fingerprint AND tombstone.final_mutation_id=OLD.last_mutation_id
 AND tombstone.policy_receipt_hash=OLD.policy_receipt_hash)
BEGIN SELECT RAISE(ABORT,'33-P temporary credential delete requires expiry grace and exact content-free tombstone'); END;
CREATE TRIGGER trg_33p_passkey_tombstone_update BEFORE UPDATE ON identity_passkey_credential_tombstones BEGIN SELECT RAISE(ABORT,'33-P passkey tombstones are immutable'); END;
CREATE TRIGGER trg_33p_passkey_tombstone_delete BEFORE DELETE ON identity_passkey_credential_tombstones
WHEN julianday(OLD.retain_until)>julianday('now') OR EXISTS(SELECT 1 FROM identity_passkey_credentials current WHERE current.credential_id_sha256=OLD.credential_id_sha256)
BEGIN SELECT RAISE(ABORT,'33-P passkey digest tombstone retention is active'); END;
CREATE TRIGGER trg_33p_temp_tombstone_update BEFORE UPDATE ON identity_temporary_credential_tombstones BEGIN SELECT RAISE(ABORT,'33-P temporary credential tombstones are immutable'); END;
CREATE TRIGGER trg_33p_temp_tombstone_delete BEFORE DELETE ON identity_temporary_credential_tombstones
WHEN julianday(OLD.retain_until)>julianday('now') OR EXISTS(SELECT 1 FROM identity_temporary_credentials current WHERE current.id=OLD.credential_id)
BEGIN SELECT RAISE(ABORT,'33-P temporary credential tombstone retention is active'); END;
CREATE TRIGGER trg_33p_companion_update BEFORE UPDATE ON identity_companion_snapshots BEGIN SELECT RAISE(ABORT,'33-P companion snapshots are immutable'); END;
CREATE TRIGGER trg_33p_companion_delete BEFORE DELETE ON identity_companion_snapshots
WHEN julianday(OLD.expires_at)>julianday('now')
BEGIN SELECT RAISE(ABORT,'33-P active companion snapshots are immutable'); END;
CREATE TRIGGER trg_33p_mutation_quota BEFORE INSERT ON identity_access_mutations WHEN (SELECT COUNT(*) FROM identity_access_mutations WHERE account_id=NEW.account_id)>=4096 BEGIN SELECT RAISE(ABORT,'33-P bounded mutation metadata quota exceeded'); END;
CREATE TRIGGER trg_33p_challenge_quota BEFORE INSERT ON identity_passkey_challenges WHEN (SELECT COUNT(*) FROM identity_passkey_challenges WHERE account_id=NEW.account_id)>=512 OR (SELECT COUNT(*) FROM identity_passkey_challenges WHERE account_id=NEW.account_id AND consumed_at IS NULL AND julianday(expires_at)>julianday(NEW.created_at))>=32 BEGIN SELECT RAISE(ABORT,'33-P bounded challenge quota exceeded'); END;

CREATE TRIGGER trg_33p_identity_source_clock AFTER INSERT ON identity_access_mutations
BEGIN
  INSERT INTO identity_access_source_clocks(account_id,source_version,updated_at) VALUES(NEW.account_id,1,NEW.occurred_at)
  ON CONFLICT(account_id) DO UPDATE SET source_version=source_version+1,updated_at=excluded.updated_at;
END;
CREATE TRIGGER trg_33p_identity_provider_source_clock AFTER UPDATE OF configured,configuration_id,authorization_endpoint_sha256,client_configuration_sha256 ON identity_federated_provider_configurations
WHEN NEW.configured<>OLD.configured OR NEW.configuration_id<>OLD.configuration_id OR NEW.authorization_endpoint_sha256<>OLD.authorization_endpoint_sha256 OR NEW.client_configuration_sha256<>OLD.client_configuration_sha256
BEGIN
  INSERT INTO identity_access_source_clocks(account_id,source_version,updated_at)
    SELECT DISTINCT account_id,1,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM identity_federated_links WHERE provider=NEW.provider
  ON CONFLICT(account_id) DO UPDATE SET source_version=source_version+1,updated_at=excluded.updated_at;
END;

UPDATE database_metadata SET value='REVISION-33-P-IDENTITY-ACCESS-CREDENTIALS',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key='schema_generation';
`;

export const FAMILY_DATABASE_MIGRATIONS = Object.freeze([
  createMigrationDefinition(1, 'legacy_mvp40_schema', legacySchemaSql),
  createMigrationDefinition(2, 'legacy_mvp40_compatibility', legacyCompatibilitySql),
  createMigrationDefinition(3, 'database_metadata', databaseMetadataSql),
  createMigrationDefinition(4, 'transactional_outbox', transactionalOutboxSql),
  createMigrationDefinition(5, 'event_dispatcher_state', eventDispatcherStateSql),
  createMigrationDefinition(6, 'trusted_devices', trustedDevicesSql),
  createMigrationDefinition(7, 'authorization_audit_hardening', authorizationAuditHardeningSql),
  createMigrationDefinition(8, 'membership_collaboration_notifications', membershipCollaborationNotificationsSql),
  createMigrationDefinition(9, 'health_application_indexes', healthApplicationIndexesSql),
  createMigrationDefinition(10, 'finance_application_indexes', financeApplicationIndexesSql),
  createMigrationDefinition(11, 'archive_application_indexes', archiveApplicationIndexesSql),
  createMigrationDefinition(12, 'legacy_application_indexes', legacyApplicationIndexesSql),
  createMigrationDefinition(13, 'remove_untouched_legacy_demo', removeUntouchedLegacyDemoSql),
  createMigrationDefinition(14, 'remove_known_synthetic_profiles', removeKnownSyntheticProfilesSql),
  createMigrationDefinition(15, 'timeline_event_lifecycle', timelineLifecycleSql),
  createMigrationDefinition(16, 'data_lifecycle_governance', dataLifecycleGovernanceSql),
  createMigrationDefinition(17, 'backup_purge_propagation', backupPurgePropagationSql),
  createMigrationDefinition(18, 'backup_quarantine_lifecycle', backupQuarantineLifecycleSql),
  createMigrationDefinition(19, 'external_backup_inventory', externalBackupInventorySql),
  createMigrationDefinition(20, 'external_backup_signed_evidence', externalBackupSignedEvidenceSql),
  createMigrationDefinition(21, 'external_backup_evidence_key_rotation', externalBackupEvidenceKeyRotationSql),
  createMigrationDefinition(22, 'external_backup_evidence_revocation_list', externalBackupEvidenceRevocationListSql),
  createMigrationDefinition(23, 'external_backup_revocation_endpoint_pin_rotation', externalBackupRevocationEndpointSql),
  createMigrationDefinition(24, 'family_data_import_preview_and_rollback', familyDataImportSql),
  createMigrationDefinition(25, 'large_family_read_model_performance', largeFamilyReadModelPerformanceSql),
  createMigrationDefinition(26, 'entity_catalog_pagination', entityCatalogPerformanceSql),
  createMigrationDefinition(27, 'account_security_epoch', accountSecurityEpochSql),
  createMigrationDefinition(28, 'external_evidence_root_trust_verification', externalBackupRootTrustVerificationSql),
  createMigrationDefinition(29, 'automatic_clean_backup_rewrite', automaticCleanBackupRewriteSql),
  createMigrationDefinition(30, 'clean_backup_rewrite_finalization_ledger', cleanBackupRewriteRunLedgerSql),
  createMigrationDefinition(31, 'clean_backup_rewrite_linked_chronology', cleanBackupRewriteLinkedChronologySql),
  createMigrationDefinition(32, 'clean_backup_rewrite_recovery_chronology', cleanBackupRewriteRecoveryChronologySql),
  createMigrationDefinition(33, 'clean_backup_rewrite_claim_chronology', cleanBackupRewriteClaimChronologySql),
  createMigrationDefinition(34, 'clean_backup_rewrite_operational_isolation', cleanBackupRewriteOperationalIsolationSql),
  createMigrationDefinition(35, 'clean_backup_rewrite_trigger_aware_backoff', cleanBackupRewriteTriggerAwareBackoffSql),
  createMigrationDefinition(36, 'clean_backup_rewrite_manual_availability', cleanBackupRewriteManualAvailabilitySql),
  createMigrationDefinition(37, 'clean_backup_rewrite_running_ledger_identity', cleanBackupRewriteRunningLedgerIdentitySql),
  createMigrationDefinition(38, 'clean_backup_rewrite_claim_reservation', cleanBackupRewriteClaimReservationSql),
  createMigrationDefinition(39, 'clean_backup_rewrite_active_ownership_snapshot', cleanBackupRewriteActiveOwnershipSnapshotSql),
  createMigrationDefinition(40, 'clean_backup_rewrite_active_policy_parameters', cleanBackupRewriteActivePolicyParametersSql),
  createMigrationDefinition(41, 'clean_backup_rewrite_atomic_terminal_transition', cleanBackupRewriteAtomicTerminalTransitionSql),
  createMigrationDefinition(42, 'clean_backup_rewrite_terminal_chronology_monotonicity', cleanBackupRewriteTerminalChronologyMonotonicitySql),
  createMigrationDefinition(43, 'clean_backup_rewrite_propagation_outcome_integrity', cleanBackupRewritePropagationOutcomeIntegritySql),
  createMigrationDefinition(44, 'clean_backup_rewrite_propagation_status_integrity', cleanBackupRewritePropagationOutcomeStatusIntegritySql),
  createMigrationDefinition(45, 'clean_backup_rewrite_propagation_uniqueness', cleanBackupRewritePropagationUniquenessSql),
  createMigrationDefinition(46, 'clean_backup_rewrite_propagation_reference_permanence', cleanBackupRewritePropagationReferencePermanenceSql),
  createMigrationDefinition(47, 'clean_backup_rewrite_propagation_referenced_evidence_immutability', cleanBackupRewritePropagationReferencedEvidenceImmutabilitySql),
  createMigrationDefinition(48, 'clean_backup_rewrite_propagation_replace_bypass_protection', cleanBackupRewritePropagationReplaceBypassProtectionSql),
  createMigrationDefinition(49, 'clean_backup_rewrite_terminal_ledger_immutability', cleanBackupRewriteTerminalLedgerImmutabilitySql),
  createMigrationDefinition(50, 'household_family_branch_person_membership', householdFamilyBranchPersonMembershipSql),
  createMigrationDefinition(51, 'person_profile_lifecycle', personProfileLifecycleSql),
  createMigrationDefinition(52, 'authorization_context', authorizationContextSql),
  createMigrationDefinition(53, 'invitation_lifecycle', invitationLifecycleSql),
  createMigrationDefinition(54, 'data_repair_center', dataRepairCenterSql),
  createMigrationDefinition(55, 'windows_hello_registrations', windowsHelloRegistrationsSql),
  createMigrationDefinition(56, 'durable_platform_policy_transactions', durablePlatformPolicyTransactionsSql),
  createMigrationDefinition(57, 'protected_journal_projection_proof', protectedJournalProjectionProofSql),
  createMigrationDefinition(58, 'archive_core_table_receipt_fence', archiveCoreTableReceiptFenceSql),
  createMigrationDefinition(59, 'archive_accessory_receipt_fence', archiveAccessoryReceiptFenceSql),
  createMigrationDefinition(60, 'archive_operation_idempotency', archiveOperationIdempotencySql),
  createMigrationDefinition(61, 'archive_pending_operation_identity_recovery', archivePendingOperationIdentityRecoverySql),
  createMigrationDefinition(62, 'expired_replay_reservation_pruning', expiredReplayReservationPruningSql),
  createMigrationDefinition(63, 'finance_policy_receipt_fence', financePolicyReceiptFenceSql),
  createMigrationDefinition(64, 'health_policy_receipt_fence', healthPolicyReceiptFenceSql),
  createMigrationDefinition(65, 'life_policy_receipt_fence', lifePolicyReceiptFenceSql),
  createMigrationDefinition(66, 'location_policy_receipt_fence', locationPolicyReceiptFenceSql),
  createMigrationDefinition(67, 'local_ppk002_timeline_event_policy_receipt_fence', timelineEventPolicyReceiptFenceSql),
  createMigrationDefinition(68, 'ppk002_family_import_governed_rollback_receipt_fence', familyImportGovernedRollbackReceiptFenceSql),
  createMigrationDefinition(69, 'ppk004_complete_policy_context_binding', platformPolicyContextBindingSql),
  createMigrationDefinition(70, 'ppk005_complete_data_classification', platformPolicyDataClassificationSql),
  createMigrationDefinition(71, 'ppk006_complete_policy_obligation_suite', platformPolicyObligationExecutionSql),
  createMigrationDefinition(72, 'ppk007_signed_versioned_policy_package', platformPolicyPackageBindingSql),
  createMigrationDefinition(73, 'ppk008_application_identity_device_certificate_manifest', platformApplicationIdentityBindingSql),
  createMigrationDefinition(74, 'ppk009_core_service_decision_reevaluation', platformPolicyDecisionAuthorityBindingSql),
  createMigrationDefinition(75, 'ppk011_contextual_ownership_share', authorizationOwnershipShareSql),
  createMigrationDefinition(76, 'ppk012_offline_capability_lease_cache_fence', offlineCapabilityLeaseSql),
  createMigrationDefinition(77, 'ppk016_derived_data_policy_inheritance', derivedDataPolicyInheritanceSql),
  createMigrationDefinition(78, 'b4_banking_foundation', bankingFoundationSql),
  createMigrationDefinition(79, 'b4_payment_card_management', paymentCardManagementSql),
  createMigrationDefinition(80, 'b4_loan_management', loanManagementSql),
  createMigrationDefinition(81, 'b4_finance_planning_portfolio_analytics', financePlanningLedgerSql),
  createMigrationDefinition(82, 'b4_controlled_import_open_banking', financeControlledImportOpenBankingSql),
  createMigrationDefinition(83, 'b5_life_home_vehicle_managed_ledger', lifeHomeVehicleManagedLedgerSql),
  createMigrationDefinition(84, 'b5_life_home_inventory_ledger', lifeHomeInventoryLedgerSql),
  createMigrationDefinition(85, 'b5_family_emergency_planning_ledger', familyEmergencyPlanningLedgerSql),
  createMigrationDefinition(86, 'b5_family_emergency_preparedness_ledger', familyEmergencyPreparednessLedgerSql),
  createMigrationDefinition(87, 'b5_family_emergency_assistance_card_ledger', familyEmergencyAssistanceCardLedgerSql),
  createMigrationDefinition(88, 'b5_family_emergency_card_portability_ledger', familyEmergencyCardPortabilityLedgerSql),
  createMigrationDefinition(89, 'b4_long_term_portfolio_ledger', longTermPortfolioLedgerSql),
  createMigrationDefinition(90, 'b7_accessibility_preferences', accessibilityPreferencesSql),
  createMigrationDefinition(91, 'b3_governed_form_drafts', governedFormDraftsSql),
  createMigrationDefinition(92, 'privacy_ownership_data_rights_incident_control', privacyOwnershipDataRightsIncidentControlSql),
  createMigrationDefinition(93, 'identity_access_credentials', identityAccessCredentialLedgerSql)
]);

export interface RunFamilyDatabaseMigrationsInput {
  readonly database: DatabaseConnection;
  readonly databasePath: string;
  readonly applicationVersion: string;
  readonly backupDirectory?: string;
  readonly skipFileSafetyBackup?: boolean;
}

export class FamilyDatabaseMigrationError extends Error {
  public constructor(
    public readonly code: string,
    message: string
  ) {
    super(`[${code}] ${message}`);
    this.name = 'FamilyDatabaseMigrationError';
  }
}

export const runFamilyDatabaseMigrations = (
  input: RunFamilyDatabaseMigrationsInput
): MigrationRunSummary => {
  const clock = new SystemClock();
  const runner = new SqliteMigrationRunner();
  const result = runner.run({
    database: input.database,
    migrations: FAMILY_DATABASE_MIGRATIONS,
    applicationVersion: input.applicationVersion,
    correlationId: asCorrelationId(`migration-${input.applicationVersion}`),
    clock,
    knownLegacyBaselines: [{
      name: 'Bronze MVP-40/MVP-42 legacy schema',
      fingerprint: LEGACY_MVP40_SCHEMA_FINGERPRINT,
      adoptThroughVersion: 2
    }],
    ...(input.skipFileSafetyBackup
      ? {}
      : {
          createSafetyBackup: () => createSqliteSafetyBackup({
            database: input.database,
            databasePath: input.databasePath,
            backupDirectory: input.backupDirectory ?? defaultMigrationBackupDirectory(input.databasePath),
            applicationVersion: input.applicationVersion,
            clock
          })
        })
  });
  if (!result.ok) throw new FamilyDatabaseMigrationError(result.error.code, result.error.message);
  return result.value;
};
