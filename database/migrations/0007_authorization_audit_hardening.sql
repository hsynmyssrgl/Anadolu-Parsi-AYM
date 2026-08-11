ALTER TABLE audit_log ADD COLUMN sequence_no INTEGER;
ALTER TABLE audit_log ADD COLUMN hash_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE audit_log ADD COLUMN correlation_id TEXT;
UPDATE audit_log SET sequence_no=rowid WHERE sequence_no IS NULL;
CREATE UNIQUE INDEX idx_audit_sequence_no ON audit_log(sequence_no);
CREATE INDEX idx_permission_subject_active ON object_permissions(subject_account_id,starts_at,ends_at,effect);
UPDATE database_metadata
SET value='REVISION-060-B060-M12-RBAC-AUDIT-HARDENING',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
