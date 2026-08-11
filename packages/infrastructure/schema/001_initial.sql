PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS persons (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  birth_date TEXT,
  death_date TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS family_memberships (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  person_id TEXT NOT NULL REFERENCES persons(id),
  user_id TEXT,
  relationship_type TEXT NOT NULL,
  roles_json TEXT NOT NULL,
  branch_ids_json TEXT NOT NULL,
  status TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_until TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS family_relationships (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  from_person_id TEXT NOT NULL REFERENCES persons(id),
  to_person_id TEXT NOT NULL REFERENCES persons(id),
  relationship_type TEXT NOT NULL,
  valid_from TEXT,
  valid_until TEXT,
  evidence_status TEXT NOT NULL DEFAULT 'unverified'
) STRICT;

CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT,
  owner_person_id TEXT REFERENCES persons(id),
  visibility TEXT NOT NULL,
  sensitivity TEXT NOT NULL,
  ai_processing_allowed INTEGER NOT NULL CHECK(ai_processing_allowed IN (0, 1)),
  location_json TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS event_participants (
  event_id TEXT NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(id),
  role TEXT,
  PRIMARY KEY(event_id, person_id)
) STRICT;

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  owner_person_id TEXT REFERENCES persons(id),
  kind TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  vault_path TEXT NOT NULL,
  sensitivity TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS event_attachments (
  event_id TEXT NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
  attachment_id TEXT NOT NULL REFERENCES attachments(id),
  PRIMARY KEY(event_id, attachment_id)
) STRICT;

CREATE TABLE IF NOT EXISTS object_permissions (
  id TEXT PRIMARY KEY,
  subject_person_id TEXT NOT NULL REFERENCES persons(id),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  denied INTEGER NOT NULL DEFAULT 0 CHECK(denied IN (0, 1)),
  valid_from TEXT NOT NULL,
  valid_until TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  reason TEXT,
  previous_hash TEXT,
  event_hash TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_timeline_family_start
  ON timeline_events(family_id, start_at);
CREATE INDEX IF NOT EXISTS idx_membership_family_person
  ON family_memberships(family_id, person_id);
CREATE INDEX IF NOT EXISTS idx_permission_resource
  ON object_permissions(resource_type, resource_id);
