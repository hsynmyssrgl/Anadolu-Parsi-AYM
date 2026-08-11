CREATE TEMP TABLE legacy_demo_cleanup_candidate(run INTEGER NOT NULL);
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
