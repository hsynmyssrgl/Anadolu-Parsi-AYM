CREATE TABLE households (
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
