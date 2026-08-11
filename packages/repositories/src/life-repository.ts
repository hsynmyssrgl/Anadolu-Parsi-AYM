import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type { LifeRecordView, RecordPrivacy } from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type LifeAutomationDueProjectionRow,
  type LifeAutomationRunSourceProjectionRow,
  type LifePolicyResourceRepositoryPort,
  type LifeProjectionRepositoryPort,
  type LifeRecordRow,
  type LifeRepositoryPort,
  type LifeReportProjection,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const mapLifeRecord = (row: Record<string, unknown>): LifeRecordRow => ({
  id: String(row.id),
  familyId: asFamilyId(String(row.family_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  category: String(row.category) as LifeRecordView['category'],
  title: String(row.title),
  status: String(row.status) as LifeRecordView['status'],
  privacy: String(row.privacy) as RecordPrivacy,
  ...(row.starts_at ? { startsAt: asIsoDateTime(String(row.starts_at)) } : {}),
  ...(row.due_at ? { dueAt: asIsoDateTime(String(row.due_at)) } : {}),
  ...(row.provider ? { provider: String(row.provider) } : {}),
  ...(row.reference_no ? { referenceNo: String(row.reference_no) } : {}),
  ...(row.amount !== null && row.amount !== undefined ? { amount: Number(row.amount) } : {}),
  ...(row.currency ? { currency: String(row.currency) } : {}),
  ...(row.location ? { location: String(row.location) } : {}),
  ...(row.notes ? { notes: String(row.notes) } : {}),
  createdAt: asIsoDateTime(String(row.created_at))
});

interface LifeReadBinding {
  readonly familyId: string;
  readonly accountId: string;
  readonly actorPersonId: string;
  readonly familyRoleAllowed: number;
  readonly occurredAt: string;
}

const lifeFamilyReadRoles = new Set(['family_admin', 'adult_member', 'caregiver']);

const assertReceiptSubject = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  familyId: string
): void => {
  if (context.policyAuthorization.receiptRecord.request.purpose !== 'general') {
    throw new Error('LIFE policy receipt purpose must be general');
  }
  const subject = context.policyAuthorization.subject;
  if (!subject.familyIds.includes(familyId)) {
    throw new Error('LIFE policy receipt subject is outside the resource family');
  }
  if (
    String(context.actor.userId) !== subject.accountId
    || (context.actor.personId === undefined ? undefined : String(context.actor.personId)) !== subject.personId
  ) {
    throw new Error('LIFE repository actor does not match the policy receipt subject');
  }
};

const lifeReadBinding = (
  context: PolicyAuthorizedRepositoryExecutionContext
): LifeReadBinding => {
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'life_record',
    resourceId: '*',
    action: 'read',
    capability: 'family.read',
    correlationId: context.correlationId
  });
  const familyId = context.policyAuthorization.resourceFamilyId;
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'life_record',
    resourceId: '*',
    action: 'read',
    capability: 'family.read',
    correlationId: context.correlationId,
    resourceFamilyId: familyId
  });
  assertReceiptSubject(context, familyId);
  const subject = context.policyAuthorization.subject;
  return Object.freeze({
    familyId: asFamilyId(familyId),
    accountId: subject.accountId,
    actorPersonId: subject.personId ?? '',
    familyRoleAllowed: subject.roles.some((role) => lifeFamilyReadRoles.has(role)) ? 1 : 0,
    occurredAt: context.policyAuthorization.receiptRecord.request.occurredAt
  });
};

const lifeVisibilitySql = `
  AND NOT EXISTS (
    SELECT 1 FROM data_lifecycle dl
    WHERE dl.resource_type='life_record'
      AND dl.resource_id=life_records.id
      AND dl.state<>'active'
  )
  AND NOT EXISTS (
    SELECT 1 FROM object_permissions denied
    WHERE denied.subject_account_id=?
      AND denied.resource_type='life_record'
      AND (denied.resource_id=life_records.id OR denied.resource_id='*')
      AND denied.effect='deny'
      AND denied.purpose='general'
      AND denied.starts_at<=?
      AND (denied.ends_at IS NULL OR denied.ends_at>=?)
      AND EXISTS (SELECT 1 FROM json_each(denied.actions) action WHERE action.value='read')
  )
  AND (
    life_records.owner_person_id=?
    OR EXISTS (
      SELECT 1 FROM object_permissions allowed
      WHERE allowed.subject_account_id=?
        AND allowed.resource_type='life_record'
        AND (allowed.resource_id=life_records.id OR allowed.resource_id='*')
        AND allowed.effect='allow'
        AND allowed.purpose='general'
        AND allowed.starts_at<=?
        AND (allowed.ends_at IS NULL OR allowed.ends_at>=?)
        AND EXISTS (SELECT 1 FROM json_each(allowed.actions) action WHERE action.value='read')
    )
    OR (life_records.privacy='family' AND ?=1)
  )
`;

const lifeVisibilityParameters = (binding: LifeReadBinding): readonly unknown[] => [
  binding.accountId,
  binding.occurredAt,
  binding.occurredAt,
  binding.actorPersonId,
  binding.accountId,
  binding.occurredAt,
  binding.occurredAt,
  binding.familyRoleAllowed
];

const lifeOwnerProjectionVisibilitySql = `
  AND life_records.owner_person_id=?
  AND NOT EXISTS (
    SELECT 1 FROM data_lifecycle dl
    WHERE dl.resource_type='life_record'
      AND dl.resource_id=life_records.id
      AND dl.state<>'active'
  )
  AND NOT EXISTS (
    SELECT 1 FROM object_permissions denied
    WHERE denied.subject_account_id=?
      AND denied.resource_type='life_record'
      AND (denied.resource_id=life_records.id OR denied.resource_id='*')
      AND denied.effect='deny'
      AND denied.purpose='general'
      AND denied.starts_at<=?
      AND (denied.ends_at IS NULL OR denied.ends_at>=?)
      AND EXISTS (SELECT 1 FROM json_each(denied.actions) action WHERE action.value='read')
  )
`;

const lifeOwnerProjectionParameters = (binding: LifeReadBinding): readonly unknown[] => [
  binding.actorPersonId,
  binding.accountId,
  binding.occurredAt,
  binding.occurredAt
];

const lifeWriteBinding = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  row: LifeRecordRow
) => {
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'life_record',
    resourceId: row.id,
    action: 'create',
    capability: 'family.write',
    correlationId: context.correlationId,
    resourceFamilyId: row.familyId
  });
  assertReceiptSubject(context, row.familyId);
  const binding = platformPolicyPersistenceBinding(context, 'life_record', row.id);
  if (!binding) throw new Error('LIFE write requires an active platform policy receipt binding');
  return binding;
};

export class SqliteLifeRepository extends SqliteRepository implements
  LifeRepositoryPort,
  LifePolicyResourceRepositoryPort,
  LifeProjectionRepositoryPort {
  public listLifeRecords(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly LifeRecordRow[]> {
    const visibility = lifeReadBinding(context);
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT id,family_id,owner_person_id,category,title,status,privacy,starts_at,due_at,
          provider,reference_no,amount,currency,location,notes,created_at
        FROM life_records
        WHERE family_id=?
          ${lifeVisibilitySql}
        ORDER BY COALESCE(due_at,starts_at,created_at) DESC,id
      `).all(visibility.familyId, ...lifeVisibilityParameters(visibility)) as ReadonlyArray<Record<string, unknown>>
    ).map(mapLifeRecord));
  }

  public findLifeRecordForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<LifeRecordRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,family_id,owner_person_id,category,title,status,privacy,starts_at,due_at,
          provider,reference_no,amount,currency,location,notes,created_at
        FROM life_records
        WHERE id=?
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle dl
            WHERE dl.resource_type='life_record'
              AND dl.resource_id=life_records.id
              AND dl.state<>'active'
          )
      `).get(id) as Record<string, unknown> | undefined;
      return row ? mapLifeRecord(row) : null;
    });
  }

  public insertLifeRecord(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: LifeRecordRow
  ): RepositoryResult<void> {
    const policy = lifeWriteBinding(context, row);
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO life_records(
          id,family_id,owner_person_id,category,title,status,privacy,starts_at,due_at,
          provider,reference_no,amount,currency,location,notes,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        row.id,
        row.familyId,
        row.ownerPersonId,
        row.category,
        row.title,
        row.status,
        row.privacy,
        row.startsAt ?? null,
        row.dueAt ?? null,
        row.provider ?? null,
        row.referenceNo ?? null,
        row.amount ?? null,
        row.currency ?? null,
        row.location ?? null,
        row.notes ?? null,
        row.createdAt,
        policy.receiptHash,
        policy.receiptVersion,
        policy.nonce,
        context.correlationId,
        policy.resourceType,
        policy.resourceId,
        policy.action,
        policy.capability
      );
      this.database(context).prepare(
        "INSERT OR IGNORE INTO data_lifecycle(resource_type,resource_id,owner_person_id,privacy,state,updated_at) VALUES('life_record',?,?,?,'active',?)"
      ).run(row.id, row.ownerPersonId, row.privacy, row.createdAt);
    });
  }

  public listAutomationDueLife(
    context: PolicyAuthorizedRepositoryExecutionContext,
    input: { readonly fromAt: import('@ppt/core').IsoDateTime; readonly toAt: import('@ppt/core').IsoDateTime }
  ): RepositoryResult<readonly LifeAutomationDueProjectionRow[]> {
    const visibility = lifeReadBinding(context);
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT id,title,due_at
        FROM life_records
        WHERE family_id=?
          AND due_at IS NOT NULL
          AND due_at>=?
          AND due_at<=?
          AND status IN ('planned','active')
          ${lifeOwnerProjectionVisibilitySql}
        ORDER BY due_at,id
      `).all(
        visibility.familyId,
        input.fromAt,
        input.toAt,
        ...lifeOwnerProjectionParameters(visibility)
      ) as ReadonlyArray<Record<string, unknown>>
    ).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      dueAt: asIsoDateTime(String(row.due_at))
    })));
  }

  public listVisibleAutomationLifeRunSources(
    context: PolicyAuthorizedRepositoryExecutionContext,
    ids: readonly string[]
  ): RepositoryResult<readonly LifeAutomationRunSourceProjectionRow[]> {
    const visibility = lifeReadBinding(context);
    const distinctIds = [...new Set(ids.filter((id) => id.length > 0))];
    if (distinctIds.length === 0) return { ok: true, value: [] };
    if (distinctIds.length > 500) {
      throw new Error('LIFE automation run-source lookup is limited to 500 ids');
    }
    const placeholders = distinctIds.map(() => '?').join(',');
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT id,title,due_at
        FROM life_records
        WHERE family_id=?
          AND id IN (${placeholders})
          ${lifeVisibilitySql}
        ORDER BY id
      `).all(
        visibility.familyId,
        ...distinctIds,
        ...lifeVisibilityParameters(visibility)
      ) as ReadonlyArray<Record<string, unknown>>
    ).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      ...(row.due_at ? { dueAt: asIsoDateTime(String(row.due_at)) } : {})
    })));
  }

  public getLifeReportProjection(
    context: PolicyAuthorizedRepositoryExecutionContext,
    input: {
      readonly now: import('@ppt/core').IsoDateTime;
      readonly in30Days: import('@ppt/core').IsoDateTime;
      readonly overdueLimit?: number;
    }
  ): RepositoryResult<LifeReportProjection> {
    const visibility = lifeReadBinding(context);
    const overdueLimit = Math.max(0, Math.min(100, Math.trunc(input.overdueLimit ?? 25)));
    return this.execute(context, () => {
      const projection = this.database(context).prepare(`
        SELECT
          SUM(CASE WHEN category='task' AND status IN ('planned','active') THEN 1 ELSE 0 END) active_tasks,
          SUM(CASE WHEN category='insurance' AND status='active' AND due_at IS NOT NULL AND due_at<=? THEN 1 ELSE 0 END) expiring_insurance
        FROM life_records
        WHERE family_id=?
          ${lifeOwnerProjectionVisibilitySql}
      `).get(
        input.in30Days,
        visibility.familyId,
        ...lifeOwnerProjectionParameters(visibility)
      ) as Record<string, unknown>;
      const overdueItems = (this.database(context).prepare(`
        SELECT id,title,due_at
        FROM life_records
        WHERE family_id=?
          AND due_at IS NOT NULL
          AND due_at<?
          AND status IN ('planned','active')
          ${lifeOwnerProjectionVisibilitySql}
        ORDER BY due_at,id
        LIMIT ?
      `).all(
        visibility.familyId,
        input.now,
        ...lifeOwnerProjectionParameters(visibility),
        overdueLimit
      ) as ReadonlyArray<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        title: String(row.title),
        sourceType: 'life_record' as const,
        dueAt: asIsoDateTime(String(row.due_at))
      }));
      return {
        activeTasks: Number(projection.active_tasks ?? 0),
        expiringInsurance: Number(projection.expiring_insurance ?? 0),
        overdueItems
      };
    });
  }
}
