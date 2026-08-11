import type { ObjectPermissionRow, ObjectPermissionRepositoryPort } from '@ppt/repository-contracts';
import type { FamilyBranchId, IsoDateTime, UserId } from '@ppt/core';
import type { RepositoryResult } from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';
import { OBJECT_PERMISSION_ACTIONS, type ObjectPermissionAction } from '@ppt/domain';

const objectPermissionActionSet = new Set<string>(OBJECT_PERMISSION_ACTIONS);
const isObjectPermissionAction = (value: unknown): value is ObjectPermissionAction =>
  typeof value === 'string' && objectPermissionActionSet.has(value);

const parseActions = (value: unknown): readonly ObjectPermissionAction[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(value));
  } catch {
    throw new Error('OBJECT_PERMISSION_ACTIONS_INVALID');
  }
  if (
    !Array.isArray(parsed)
    || parsed.length === 0
    || parsed.some((action) => !isObjectPermissionAction(action))
  ) {
    throw new Error('OBJECT_PERMISSION_ACTIONS_INVALID');
  }
  return [...new Set(parsed)] as readonly ObjectPermissionAction[];
};

const serializeActions = (actions: readonly ObjectPermissionAction[]): string => {
  if (actions.length === 0 || actions.some((action) => !isObjectPermissionAction(action))) {
    throw new Error('OBJECT_PERMISSION_ACTIONS_INVALID');
  }
  return JSON.stringify([...new Set(actions)]);
};

const mapRow = (row: Record<string, unknown>): ObjectPermissionRow => ({
  id: String(row.id),
  subjectAccountId: String(row.subject_account_id) as UserId,
  resourceType: String(row.resource_type),
  resourceId: String(row.resource_id),
  actions: parseActions(row.actions),
  effect: String(row.effect) as 'allow' | 'deny',
  purpose: String(row.purpose) as ObjectPermissionRow['purpose'],
  ...(row.family_branch_id ? { familyBranchId: String(row.family_branch_id) as FamilyBranchId } : {}),
  ...(row.denial_reason ? { denialReason: String(row.denial_reason) } : {}),
  startsAt: String(row.starts_at) as IsoDateTime,
  ...(row.ends_at ? { endsAt: String(row.ends_at) as IsoDateTime } : {}),
  createdAt: String(row.created_at) as IsoDateTime
});

export class SqliteObjectPermissionRepository extends SqliteRepository implements ObjectPermissionRepositoryPort {
  public listAll(context: RepositoryExecutionContext): RepositoryResult<readonly ObjectPermissionRow[]> {
    return this.execute(context, () => (this.database(context).prepare(`
      SELECT id,subject_account_id,resource_type,resource_id,actions,effect,purpose,family_branch_id,denial_reason,starts_at,ends_at,created_at
      FROM object_permissions ORDER BY created_at DESC,id
    `).all() as Array<Record<string, unknown>>).map(mapRow));
  }

  public listActiveForSubject(context: RepositoryExecutionContext, accountId: UserId, occurredAt: IsoDateTime): RepositoryResult<readonly ObjectPermissionRow[]> {
    return this.execute(context, () => (this.database(context).prepare(`
      SELECT id,subject_account_id,resource_type,resource_id,actions,effect,purpose,family_branch_id,denial_reason,starts_at,ends_at,created_at
      FROM object_permissions
      WHERE subject_account_id=? AND starts_at<=? AND (ends_at IS NULL OR ends_at>=?)
      ORDER BY CASE effect WHEN 'deny' THEN 0 ELSE 1 END,created_at DESC
    `).all(accountId, occurredAt, occurredAt) as Array<Record<string, unknown>>).map(mapRow));
  }

  public upsert(context: RepositoryExecutionContext, input: ObjectPermissionRow): RepositoryResult<void> {
    return this.execute(context, () => {
      const serializedActions = serializeActions(input.actions);
      this.database(context).prepare(`
        INSERT INTO object_permissions(id,subject_account_id,resource_type,resource_id,actions,effect,purpose,family_branch_id,denial_reason,starts_at,ends_at,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET subject_account_id=excluded.subject_account_id,resource_type=excluded.resource_type,
          resource_id=excluded.resource_id,actions=excluded.actions,effect=excluded.effect,purpose=excluded.purpose,
          family_branch_id=excluded.family_branch_id,denial_reason=excluded.denial_reason,starts_at=excluded.starts_at,ends_at=excluded.ends_at
      `).run(input.id,input.subjectAccountId,input.resourceType,input.resourceId,serializedActions,input.effect,input.purpose,input.familyBranchId??null,input.denialReason??null,input.startsAt,input.endsAt??null,input.createdAt);
    });
  }

  public delete(context: RepositoryExecutionContext, id: string): RepositoryResult<boolean> {
    return this.execute(context, () => Number(this.database(context).prepare('DELETE FROM object_permissions WHERE id=?').run(id).changes) > 0);
  }
}
