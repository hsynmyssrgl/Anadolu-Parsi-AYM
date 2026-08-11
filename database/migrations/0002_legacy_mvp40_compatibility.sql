ALTER TABLE finance_records ADD COLUMN due_at TEXT;
ALTER TABLE finance_records ADD COLUMN remaining_principal REAL;
ALTER TABLE finance_records ADD COLUMN symbol TEXT;
ALTER TABLE archive_items ADD COLUMN category_id TEXT REFERENCES archive_categories(id) ON DELETE SET NULL;
ALTER TABLE archive_items ADD COLUMN sensitivity TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE archive_items ADD COLUMN ai_processing_allowed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE archive_items ADD COLUMN retention_policy_id TEXT REFERENCES archive_retention_policies(id) ON DELETE SET NULL;
ALTER TABLE archive_items ADD COLUMN destroyed_at TEXT;
ALTER TABLE accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'adult_member';
ALTER TABLE accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE accounts ADD COLUMN person_id TEXT REFERENCES people(id) ON DELETE SET NULL;
ALTER TABLE accounts ADD COLUMN starts_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
ALTER TABLE accounts ADD COLUMN ends_at TEXT;
ALTER TABLE backup_targets ADD COLUMN schedule TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE backup_targets ADD COLUMN retention_count INTEGER NOT NULL DEFAULT 10;
ALTER TABLE backup_targets ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 2;
ALTER TABLE backup_targets ADD COLUMN next_run_at TEXT;
ALTER TABLE digital_legacy_plans ADD COLUMN waiting_days INTEGER NOT NULL DEFAULT 7;
ALTER TABLE digital_legacy_plans ADD COLUMN rollback_hours INTEGER NOT NULL DEFAULT 24;
ALTER TABLE digital_legacy_plans ADD COLUMN execution_requested_at TEXT;
ALTER TABLE digital_legacy_plans ADD COLUMN execute_after TEXT;
ALTER TABLE digital_legacy_plans ADD COLUMN rollback_until TEXT;
ALTER TABLE digital_legacy_plans ADD COLUMN confirmation_note TEXT;
ALTER TABLE object_permissions ADD COLUMN source_legacy_plan_id TEXT;
INSERT OR IGNORE INTO maintenance_policy(
  id,enabled,interval_hours,keep_diagnostic_days,keep_performance_days,next_run_at,created_at
) VALUES(
  'default',1,24,90,180,
  strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 day'),
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
);
