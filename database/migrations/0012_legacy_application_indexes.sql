CREATE INDEX IF NOT EXISTS idx_legacy_plans_owner_status ON digital_legacy_plans(owner_person_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_legacy_plans_trustee_status ON digital_legacy_plans(trustee_account_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_legacy_grants_plan ON legacy_grants(plan_id,created_at);
CREATE INDEX IF NOT EXISTS idx_legacy_approvals_plan_decision ON legacy_approvals(plan_id,decision,created_at);
UPDATE database_metadata SET value='REVISION-060-B060-M17-DIGITAL-LEGACY-APPLICATION',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key='schema_generation';
