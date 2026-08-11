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
  createMigrationDefinition(69, 'ppk004_complete_policy_context_binding', platformPolicyContextBindingSql)
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
