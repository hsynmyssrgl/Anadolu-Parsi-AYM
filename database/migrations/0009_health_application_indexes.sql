CREATE INDEX idx_medication_owner_active
ON medication_plans(owner_person_id, starts_at DESC, ends_at);
CREATE INDEX idx_family_health_related
ON family_health_history(related_person_id, created_at DESC);
CREATE INDEX idx_health_kind_date
ON health_records(kind, occurred_at DESC);
UPDATE database_metadata
SET value='REVISION-060-B060-M14-HEALTH-APPLICATION',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key='schema_generation';
