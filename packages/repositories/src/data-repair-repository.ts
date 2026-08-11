import type { DatabaseExecutor } from '@ppt/contracts';
import type { FamilyId, IsoDate, IsoDateTime, PersonId, UserId } from '@ppt/core';
import type {
  DataRepairEntitySnapshot,
  DataRepairIssue,
  DataRepairMembershipSnapshot,
  DataRepairOperation,
  DataRepairPersonSnapshot,
  DataRepairRelationSnapshot
} from '@ppt/domain';
import type {
  DataRepairRepositoryPort,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';

const personColumns = `id,family_id,display_name,birth_date,relationship_type,generation,branch,status,
  merged_into_person_id,archived_at,deletion_requested_at,lifecycle_version,created_at,updated_at`;

const mapPerson = (row: Record<string, unknown>): DataRepairPersonSnapshot => ({
  id: String(row.id) as PersonId,
  familyId: String(row.family_id) as FamilyId,
  displayName: String(row.display_name),
  ...(row.birth_date ? { birthDate: String(row.birth_date) as IsoDate } : {}),
  relationshipType: String(row.relationship_type),
  generation: Number(row.generation),
  branch: String(row.branch),
  status: String(row.status) as DataRepairPersonSnapshot['status'],
  ...(row.merged_into_person_id ? { mergedIntoPersonId: String(row.merged_into_person_id) as PersonId } : {}),
  ...(row.archived_at ? { archivedAt: String(row.archived_at) as IsoDateTime } : {}),
  ...(row.deletion_requested_at ? { deletionRequestedAt: String(row.deletion_requested_at) as IsoDateTime } : {}),
  lifecycleVersion: Number(row.lifecycle_version),
  createdAt: String(row.created_at) as IsoDateTime,
  updatedAt: String(row.updated_at) as IsoDateTime
});

const mapRelation = (row: Record<string, unknown>): DataRepairRelationSnapshot => ({
  id: String(row.id),
  familyId: String(row.family_id) as FamilyId,
  fromPersonId: String(row.from_person_id) as PersonId,
  toPersonId: String(row.to_person_id) as PersonId,
  relationType: String(row.relation_type)
});

const mapMembership = (row: Record<string, unknown>): DataRepairMembershipSnapshot => ({
  id: String(row.id),
  personId: String(row.person_id) as PersonId,
  householdId: String(row.household_id),
  ...(row.family_branch_id ? { familyBranchId: String(row.family_branch_id) } : {}),
  role: String(row.role),
  status: String(row.status) as DataRepairMembershipSnapshot['status'],
  validFrom: String(row.valid_from) as IsoDateTime,
  ...(row.valid_until ? { validUntil: String(row.valid_until) as IsoDateTime } : {}),
  createdAt: String(row.created_at) as IsoDateTime,
  updatedAt: String(row.updated_at) as IsoDateTime
});

const revisionToken = (...parts: readonly unknown[]): string => JSON.stringify(parts);

const parseOperation = (row: Record<string, unknown>): DataRepairOperation => ({
  id: String(row.id),
  familyId: String(row.family_id) as FamilyId,
  issueId: String(row.issue_id),
  issueKind: String(row.issue_kind) as DataRepairOperation['issueKind'],
  resolution: String(row.resolution) as DataRepairOperation['resolution'],
  status: String(row.status) as DataRepairOperation['status'],
  revisionToken: String(row.revision_token),
  beforeSnapshot: JSON.parse(String(row.before_snapshot)) as DataRepairEntitySnapshot,
  afterSnapshot: JSON.parse(String(row.after_snapshot)) as DataRepairEntitySnapshot,
  reason: String(row.reason),
  createdBy: String(row.created_by) as UserId,
  createdAt: String(row.created_at) as IsoDateTime,
  ...(row.applied_at ? { appliedAt: String(row.applied_at) as IsoDateTime } : {}),
  ...(row.undone_at ? { undoneAt: String(row.undone_at) as IsoDateTime } : {})
});

const safeMembershipEnd = (validFrom: IsoDateTime, occurredAt: IsoDateTime): IsoDateTime => {
  const validFromTime = Date.parse(validFrom);
  const occurredTime = Date.parse(occurredAt);
  if (Number.isFinite(validFromTime) && Number.isFinite(occurredTime) && occurredTime <= validFromTime) {
    return new Date(validFromTime + 1).toISOString() as IsoDateTime;
  }
  return occurredAt;
};

const scanIssues = (database: DatabaseExecutor, familyId: FamilyId): readonly DataRepairIssue[] => {
  const issues: DataRepairIssue[] = [];
  const duplicateRows = database.prepare(`
    WITH ranked AS (
      SELECT p.*,
        FIRST_VALUE(id) OVER (
          PARTITION BY family_id,lower(trim(display_name)),COALESCE(birth_date,'')
          ORDER BY created_at,id
        ) AS canonical_id,
        ROW_NUMBER() OVER (
          PARTITION BY family_id,lower(trim(display_name)),COALESCE(birth_date,'')
          ORDER BY created_at,id
        ) AS duplicate_ordinal
      FROM people p
      WHERE family_id=? AND status NOT IN ('merged','pending_deletion')
    )
    SELECT ranked.*,target.lifecycle_version AS target_version,target.status AS target_status
    FROM ranked
    JOIN people target ON target.id=ranked.canonical_id
    WHERE ranked.duplicate_ordinal>1 AND target.status='active'
    ORDER BY ranked.id
  `).all(familyId) as ReadonlyArray<Record<string, unknown>>;
  for (const row of duplicateRows) {
    const sourceId = String(row.id);
    const targetId = String(row.canonical_id);
    issues.push({
      id: `duplicate-person:${sourceId}:${targetId}`,
      familyId,
      kind: 'duplicate_person',
      severity: 'warning',
      entityType: 'person',
      primaryEntityId: sourceId,
      relatedEntityId: targetId,
      summary: 'Aynı ad ve doğum tarihini kullanan yinelenen kişi profili bulundu.',
      suggestedResolution: 'merge_duplicate_person',
      revisionToken: revisionToken('duplicate_person', sourceId, row.lifecycle_version, row.status, targetId, row.target_version, row.target_status),
      repairable: true
    });
  }

  const brokenRelations = database.prepare(`
    SELECT relation.*
    FROM relations relation
    LEFT JOIN people source ON source.id=relation.from_person_id
    LEFT JOIN people target ON target.id=relation.to_person_id
    WHERE relation.family_id=? AND (source.id IS NULL OR target.id IS NULL)
    ORDER BY relation.id
  `).all(familyId) as ReadonlyArray<Record<string, unknown>>;
  for (const row of brokenRelations) {
    const relation = mapRelation(row);
    issues.push({
      id: `broken-relation:${relation.id}`,
      familyId,
      kind: 'broken_relation',
      severity: 'critical',
      entityType: 'relation',
      primaryEntityId: relation.id,
      summary: 'Bağın kaynak veya hedef kişi kaydı bulunamadı.',
      suggestedResolution: 'remove_broken_relation',
      revisionToken: revisionToken('broken_relation', relation.id, relation.familyId, relation.fromPersonId, relation.toPersonId, relation.relationType),
      repairable: true
    });
  }

  const alignableRelations = database.prepare(`
    SELECT relation.*
    FROM relations relation
    JOIN people source ON source.id=relation.from_person_id
    JOIN people target ON target.id=relation.to_person_id
    WHERE source.family_id=? AND target.family_id=source.family_id AND relation.family_id<>source.family_id
    ORDER BY relation.id
  `).all(familyId) as ReadonlyArray<Record<string, unknown>>;
  for (const row of alignableRelations) {
    const relation = mapRelation(row);
    issues.push({
      id: `relation-family:${relation.id}`,
      familyId,
      kind: 'inconsistent_family_link',
      severity: 'critical',
      entityType: 'relation',
      primaryEntityId: relation.id,
      summary: 'Bağın aile kimliği, iki kişi profilinin ortak aile kimliğiyle uyuşmuyor.',
      suggestedResolution: 'align_relation_family',
      revisionToken: revisionToken('align_relation_family', relation.id, relation.familyId, relation.fromPersonId, relation.toPersonId, relation.relationType, familyId),
      repairable: true
    });
  }

  const crossFamilyRelations = database.prepare(`
    SELECT relation.*
    FROM relations relation
    JOIN people source ON source.id=relation.from_person_id
    JOIN people target ON target.id=relation.to_person_id
    WHERE relation.family_id=? AND source.family_id<>target.family_id
    ORDER BY relation.id
  `).all(familyId) as ReadonlyArray<Record<string, unknown>>;
  for (const row of crossFamilyRelations) {
    const relation = mapRelation(row);
    issues.push({
      id: `cross-family-relation:${relation.id}`,
      familyId,
      kind: 'inconsistent_family_link',
      severity: 'critical',
      entityType: 'relation',
      primaryEntityId: relation.id,
      summary: 'Bağ, farklı ailelere ait iki kişi profilini yetkisiz biçimde birleştiriyor.',
      suggestedResolution: 'remove_cross_family_relation',
      revisionToken: revisionToken('remove_cross_family_relation', relation.id, relation.familyId, relation.fromPersonId, relation.toPersonId, relation.relationType),
      repairable: true
    });
  }

  const inconsistentMemberships = database.prepare(`
    SELECT membership.*
    FROM person_memberships membership
    JOIN people person ON person.id=membership.person_id
    JOIN households household ON household.id=membership.household_id
    LEFT JOIN family_branches branch ON branch.id=membership.family_branch_id
    WHERE person.family_id=? AND membership.status<>'ended' AND (
      household.family_id<>person.family_id
      OR (membership.family_branch_id IS NOT NULL AND (
        branch.id IS NULL
        OR branch.family_id<>person.family_id
        OR (branch.household_id IS NOT NULL AND branch.household_id<>membership.household_id)
      ))
    )
    ORDER BY membership.id
  `).all(familyId) as ReadonlyArray<Record<string, unknown>>;
  for (const row of inconsistentMemberships) {
    const membership = mapMembership(row);
    issues.push({
      id: `membership-family:${membership.id}`,
      familyId,
      kind: 'inconsistent_family_link',
      severity: 'critical',
      entityType: 'person_membership',
      primaryEntityId: membership.id,
      relatedEntityId: membership.personId,
      summary: 'Kişi üyeliği, hane veya aile dalı kapsamıyla uyuşmuyor.',
      suggestedResolution: 'end_inconsistent_membership',
      revisionToken: revisionToken('end_inconsistent_membership', membership.id, membership.personId, membership.householdId, membership.familyBranchId ?? null, membership.status, membership.validFrom, membership.validUntil ?? null),
      repairable: true
    });
  }

  return issues.sort((left, right) => left.id.localeCompare(right.id, 'en'));
};

export class SqliteDataRepairRepository extends SqliteRepository implements DataRepairRepositoryPort {
  public scanIssues(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<readonly DataRepairIssue[]> {
    return this.execute(context, () => scanIssues(this.database(context), familyId));
  }

  public previewRepair(
    context: RepositoryExecutionContext,
    input: Parameters<DataRepairRepositoryPort['previewRepair']>[1]
  ): RepositoryResult<DataRepairOperation | null> {
    return this.execute(context, () => {
      const database = this.database(context);
      const issue = scanIssues(database, input.familyId).find((candidate) => candidate.id === input.issueId && candidate.repairable);
      if (!issue) return null;
      let beforeSnapshot: DataRepairEntitySnapshot;
      let afterSnapshot: DataRepairEntitySnapshot;
      if (issue.entityType === 'person') {
        const row = database.prepare(`SELECT ${personColumns} FROM people WHERE id=? AND family_id=?`).get(issue.primaryEntityId, input.familyId) as Record<string, unknown> | undefined;
        if (!row || !issue.relatedEntityId) return null;
        const before = mapPerson(row);
        beforeSnapshot = { entityType: 'person', row: before };
        afterSnapshot = { entityType: 'person', row: {
          ...before,
          status: 'merged',
          mergedIntoPersonId: issue.relatedEntityId as PersonId,
          archivedAt: input.createdAt,
          lifecycleVersion: before.lifecycleVersion + 1,
          updatedAt: input.createdAt
        } };
      } else if (issue.entityType === 'relation') {
        const row = database.prepare('SELECT id,family_id,from_person_id,to_person_id,relation_type FROM relations WHERE id=?').get(issue.primaryEntityId) as Record<string, unknown> | undefined;
        if (!row) return null;
        const before = mapRelation(row);
        beforeSnapshot = { entityType: 'relation', row: before };
        afterSnapshot = issue.suggestedResolution === 'align_relation_family'
          ? { entityType: 'relation', row: { ...before, familyId: input.familyId } }
          : { entityType: 'relation', row: null };
      } else {
        const row = database.prepare('SELECT id,person_id,household_id,family_branch_id,role,status,valid_from,valid_until,created_at,updated_at FROM person_memberships WHERE id=?').get(issue.primaryEntityId) as Record<string, unknown> | undefined;
        if (!row) return null;
        const before = mapMembership(row);
        beforeSnapshot = { entityType: 'person_membership', row: before };
        afterSnapshot = { entityType: 'person_membership', row: {
          ...before,
          status: 'ended',
          validUntil: safeMembershipEnd(before.validFrom, input.createdAt),
          updatedAt: input.createdAt
        } };
      }
      database.prepare(`
        INSERT INTO data_repair_operations(
          id,family_id,issue_id,issue_kind,resolution,status,revision_token,
          before_snapshot,after_snapshot,reason,created_by,created_at
        ) VALUES(?,?,?,?,?,'previewed',?,?,?,?,?,?)
      `).run(
        input.operationId,
        input.familyId,
        issue.id,
        issue.kind,
        issue.suggestedResolution,
        issue.revisionToken,
        JSON.stringify(beforeSnapshot),
        JSON.stringify(afterSnapshot),
        input.reason,
        input.createdBy,
        input.createdAt
      );
      const created = database.prepare('SELECT * FROM data_repair_operations WHERE id=?').get(input.operationId) as Record<string, unknown>;
      return parseOperation(created);
    });
  }

  public applyRepair(
    context: RepositoryExecutionContext,
    input: Parameters<DataRepairRepositoryPort['applyRepair']>[1]
  ): RepositoryResult<DataRepairOperation | null> {
    return this.execute(context, () => {
      const database = this.database(context);
      const row = database.prepare('SELECT * FROM data_repair_operations WHERE id=?').get(input.operationId) as Record<string, unknown> | undefined;
      if (!row) return null;
      const operation = parseOperation(row);
      if (operation.status !== 'previewed' || operation.revisionToken !== input.expectedRevisionToken) return null;
      const issue = scanIssues(database, operation.familyId).find((candidate) => candidate.id === operation.issueId);
      if (!issue || issue.revisionToken !== operation.revisionToken || issue.suggestedResolution !== operation.resolution) return null;
      let changes = 0;
      if (operation.beforeSnapshot.entityType === 'person' && operation.afterSnapshot.entityType === 'person') {
        const before = operation.beforeSnapshot.row;
        const after = operation.afterSnapshot.row;
        changes = Number(database.prepare(`
          UPDATE people SET status=?,merged_into_person_id=?,archived_at=?,deletion_requested_at=?,lifecycle_version=?,updated_at=?
          WHERE id=? AND family_id=? AND lifecycle_version=? AND status=? AND merged_into_person_id IS ?
        `).run(
          after.status,
          after.mergedIntoPersonId ?? null,
          after.archivedAt ?? null,
          after.deletionRequestedAt ?? null,
          after.lifecycleVersion,
          after.updatedAt,
          before.id,
          before.familyId,
          before.lifecycleVersion,
          before.status,
          before.mergedIntoPersonId ?? null
        ).changes);
      } else if (operation.beforeSnapshot.entityType === 'relation' && operation.afterSnapshot.entityType === 'relation') {
        const before = operation.beforeSnapshot.row;
        if (!before) return null;
        const after = operation.afterSnapshot.row;
        changes = after
          ? Number(database.prepare(`
              UPDATE relations SET family_id=?
              WHERE id=? AND family_id=? AND from_person_id=? AND to_person_id=? AND relation_type=?
            `).run(after.familyId, before.id, before.familyId, before.fromPersonId, before.toPersonId, before.relationType).changes)
          : Number(database.prepare(`
              DELETE FROM relations
              WHERE id=? AND family_id=? AND from_person_id=? AND to_person_id=? AND relation_type=?
            `).run(before.id, before.familyId, before.fromPersonId, before.toPersonId, before.relationType).changes);
      } else if (operation.beforeSnapshot.entityType === 'person_membership' && operation.afterSnapshot.entityType === 'person_membership') {
        const before = operation.beforeSnapshot.row;
        const after = operation.afterSnapshot.row;
        changes = Number(database.prepare(`
          UPDATE person_memberships SET status=?,valid_until=?,updated_at=?
          WHERE id=? AND person_id=? AND household_id=? AND family_branch_id IS ? AND status=? AND valid_from=? AND valid_until IS ?
        `).run(after.status, after.validUntil ?? null, after.updatedAt, before.id, before.personId, before.householdId, before.familyBranchId ?? null, before.status, before.validFrom, before.validUntil ?? null).changes);
      }
      if (changes !== 1) return null;
      if (Number(database.prepare(`
        UPDATE data_repair_operations SET status='applied',applied_at=? WHERE id=? AND status='previewed'
      `).run(input.appliedAt, operation.id).changes) !== 1) return null;
      return parseOperation(database.prepare('SELECT * FROM data_repair_operations WHERE id=?').get(operation.id) as Record<string, unknown>);
    });
  }

  public undoRepair(
    context: RepositoryExecutionContext,
    input: Parameters<DataRepairRepositoryPort['undoRepair']>[1]
  ): RepositoryResult<DataRepairOperation | null> {
    return this.execute(context, () => {
      const database = this.database(context);
      const row = database.prepare('SELECT * FROM data_repair_operations WHERE id=?').get(input.operationId) as Record<string, unknown> | undefined;
      if (!row) return null;
      const operation = parseOperation(row);
      if (operation.status !== 'applied') return null;
      let changes = 0;
      if (operation.beforeSnapshot.entityType === 'person' && operation.afterSnapshot.entityType === 'person') {
        const before = operation.beforeSnapshot.row;
        const after = operation.afterSnapshot.row;
        changes = Number(database.prepare(`
          UPDATE people SET display_name=?,birth_date=?,relationship_type=?,generation=?,branch=?,status=?,
            merged_into_person_id=?,archived_at=?,deletion_requested_at=?,lifecycle_version=?,updated_at=?
          WHERE id=? AND family_id=? AND lifecycle_version=? AND status=? AND merged_into_person_id IS ?
        `).run(
          before.displayName,
          before.birthDate ?? null,
          before.relationshipType,
          before.generation,
          before.branch,
          before.status,
          before.mergedIntoPersonId ?? null,
          before.archivedAt ?? null,
          before.deletionRequestedAt ?? null,
          after.lifecycleVersion + 1,
          input.undoneAt,
          after.id,
          after.familyId,
          after.lifecycleVersion,
          after.status,
          after.mergedIntoPersonId ?? null
        ).changes);
      } else if (operation.beforeSnapshot.entityType === 'relation' && operation.afterSnapshot.entityType === 'relation') {
        const before = operation.beforeSnapshot.row;
        if (!before) return null;
        const after = operation.afterSnapshot.row;
        if (after) {
          changes = Number(database.prepare(`
            UPDATE relations SET family_id=?
            WHERE id=? AND family_id=? AND from_person_id=? AND to_person_id=? AND relation_type=?
          `).run(before.familyId, after.id, after.familyId, after.fromPersonId, after.toPersonId, after.relationType).changes);
        } else {
          changes = Number(database.prepare(`
            INSERT INTO relations(id,family_id,from_person_id,to_person_id,relation_type) VALUES(?,?,?,?,?)
          `).run(before.id, before.familyId, before.fromPersonId, before.toPersonId, before.relationType).changes);
        }
      } else if (operation.beforeSnapshot.entityType === 'person_membership' && operation.afterSnapshot.entityType === 'person_membership') {
        const before = operation.beforeSnapshot.row;
        const after = operation.afterSnapshot.row;
        changes = Number(database.prepare(`
          UPDATE person_memberships SET status=?,valid_until=?,updated_at=?
          WHERE id=? AND person_id=? AND household_id=? AND family_branch_id IS ? AND status=? AND valid_from=? AND valid_until IS ?
        `).run(before.status, before.validUntil ?? null, before.updatedAt, after.id, after.personId, after.householdId, after.familyBranchId ?? null, after.status, after.validFrom, after.validUntil ?? null).changes);
      }
      if (changes !== 1) return null;
      if (Number(database.prepare(`
        UPDATE data_repair_operations SET status='undone',undone_at=? WHERE id=? AND status='applied'
      `).run(input.undoneAt, operation.id).changes) !== 1) return null;
      return parseOperation(database.prepare('SELECT * FROM data_repair_operations WHERE id=?').get(operation.id) as Record<string, unknown>);
    });
  }

  public findOperation(context: RepositoryExecutionContext, operationId: string): RepositoryResult<DataRepairOperation | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare('SELECT * FROM data_repair_operations WHERE id=?').get(operationId) as Record<string, unknown> | undefined;
      return row ? parseOperation(row) : null;
    });
  }

  public listOperations(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<readonly DataRepairOperation[]> {
    return this.execute(context, () => (this.database(context).prepare(`
      SELECT * FROM data_repair_operations WHERE family_id=? ORDER BY created_at DESC,id DESC
    `).all(familyId) as ReadonlyArray<Record<string, unknown>>).map(parseOperation));
  }
}
