import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type {
  FamilyHealthHistoryView,
  HealthRecordView,
  MedicationPlanView,
  RecordPrivacy
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type FamilyHealthHistoryRow,
  type HealthPolicyResourceRepositoryPort,
  type HealthRecordRow,
  type HealthRepositoryPort,
  type MedicationPlanRow,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { CentralAuthorizationService, isAuthorizationRole } from '@ppt/security';

const mapHealthRecord = (row: Record<string, unknown>): HealthRecordRow => ({
  id: String(row.id),
  familyId: asFamilyId(String(row.family_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  title: String(row.title),
  kind: String(row.kind) as HealthRecordView['kind'],
  privacy: String(row.privacy) as RecordPrivacy,
  ...(row.provider ? { provider: String(row.provider) } : {}),
  ...(row.notes ? { notes: String(row.notes) } : {}),
  occurredAt: asIsoDateTime(String(row.occurred_at)),
  createdAt: asIsoDateTime(String(row.created_at))
});

const mapMedicationPlan = (row: Record<string, unknown>): MedicationPlanRow => ({
  id: String(row.id),
  familyId: asFamilyId(String(row.family_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  name: String(row.name),
  dosage: String(row.dosage),
  schedule: String(row.schedule),
  ...(row.provider ? { provider: String(row.provider) } : {}),
  startsAt: asIsoDateTime(String(row.starts_at)),
  ...(row.ends_at ? { endsAt: asIsoDateTime(String(row.ends_at)) } : {}),
  privacy: String(row.privacy) as RecordPrivacy,
  ...(row.notes ? { notes: String(row.notes) } : {}),
  createdAt: asIsoDateTime(String(row.created_at))
});

const mapFamilyHealthHistory = (row: Record<string, unknown>): FamilyHealthHistoryRow => ({
  id: String(row.id),
  familyId: asFamilyId(String(row.family_id)),
  relatedPersonId: asPersonId(String(row.related_person_id)),
  condition: String(row.condition),
  ...(row.relationship_note ? { relationshipNote: String(row.relationship_note) } : {}),
  ...(row.diagnosed_at ? { diagnosedAt: asIsoDateTime(String(row.diagnosed_at)) } : {}),
  privacy: String(row.privacy) as RecordPrivacy,
  ...(row.notes ? { notes: String(row.notes) } : {}),
  createdAt: asIsoDateTime(String(row.created_at))
});

type HealthResourceType = 'health_record' | 'medication_plan' | 'family_health_history';

interface HealthCollectionVisibilityBinding {
  readonly familyId: string;
  readonly accountId: string;
  readonly actorPersonId: string;
  readonly familyRoleAllowed: number;
  readonly occurredAt: string;
}

const centralHealthAuthorization = new CentralAuthorizationService();

const assertCollectionRead = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  resourceType: HealthResourceType
): HealthCollectionVisibilityBinding => {
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType,
    resourceId: '*',
    action: 'read',
    capability: 'health.read',
    correlationId: context.correlationId
  });
  const familyId = context.policyAuthorization.resourceFamilyId;
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType,
    resourceId: '*',
    action: 'read',
    capability: 'health.read',
    correlationId: context.correlationId,
    resourceFamilyId: familyId
  });
  const subject = context.policyAuthorization.subject;
  if (!subject.familyIds.includes(familyId)) {
    throw new Error('Health collection receipt subject is outside the resource family');
  }
  if (
    String(context.actor.userId) !== subject.accountId
    || (context.actor.personId === undefined ? undefined : String(context.actor.personId)) !== subject.personId
  ) {
    throw new Error('Health collection repository actor does not match the policy receipt subject');
  }
  return Object.freeze({
    familyId: asFamilyId(familyId),
    accountId: subject.accountId,
    actorPersonId: subject.personId ?? '',
    familyRoleAllowed: subject.roles.some((role) => isAuthorizationRole(role) && centralHealthAuthorization.authorize({
      accountId: subject.accountId,
      role,
      action: 'read',
      resourceType,
      resourceId: '*',
      occurredAt: context.policyAuthorization.receiptRecord.request.occurredAt,
      purpose: 'general',
      ...(subject.personId ? { actorPersonId: subject.personId } : {})
    }).allowed) ? 1 : 0,
    occurredAt: context.policyAuthorization.receiptRecord.request.occurredAt
  });
};

const collectionVisibilitySql = (
  tableName: 'health_records' | 'medication_plans' | 'family_health_history',
  ownerColumn: 'owner_person_id' | 'related_person_id'
): string => `
  AND NOT EXISTS (
    SELECT 1 FROM data_lifecycle dl
    WHERE dl.resource_type=?
      AND dl.resource_id=${tableName}.id
      AND dl.state<>'active'
  )
  AND NOT EXISTS (
    SELECT 1 FROM object_permissions denied
    WHERE denied.subject_account_id=?
      AND denied.resource_type=?
      AND (denied.resource_id=${tableName}.id OR denied.resource_id='*')
      AND denied.effect='deny'
      AND denied.purpose='general'
      AND denied.starts_at<=?
      AND (denied.ends_at IS NULL OR denied.ends_at>=?)
      AND EXISTS (SELECT 1 FROM json_each(denied.actions) action WHERE action.value='read')
  )
  AND (
    ${tableName}.${ownerColumn}=?
    OR EXISTS (
      SELECT 1 FROM object_permissions allowed
      WHERE allowed.subject_account_id=?
        AND allowed.resource_type=?
        AND (allowed.resource_id=${tableName}.id OR allowed.resource_id='*')
        AND allowed.effect='allow'
        AND allowed.purpose='general'
        AND allowed.starts_at<=?
        AND (allowed.ends_at IS NULL OR allowed.ends_at>=?)
        AND EXISTS (SELECT 1 FROM json_each(allowed.actions) action WHERE action.value='read')
    )
    OR (${tableName}.privacy='family' AND ?=1)
  )
`;

const collectionVisibilityParameters = (
  binding: HealthCollectionVisibilityBinding,
  resourceType: HealthResourceType
): readonly unknown[] => [
  resourceType,
  binding.accountId,
  resourceType,
  binding.occurredAt,
  binding.occurredAt,
  binding.actorPersonId,
  binding.accountId,
  resourceType,
  binding.occurredAt,
  binding.occurredAt,
  binding.familyRoleAllowed
];

const healthWriteBinding = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  resourceType: HealthResourceType,
  resourceId: string,
  familyId: string
) => {
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType,
    resourceId,
    action: 'create',
    capability: 'health.write',
    correlationId: context.correlationId,
    resourceFamilyId: familyId
  });
  const binding = platformPolicyPersistenceBinding(context, resourceType, resourceId);
  if (!binding) throw new Error('Health write requires an active platform policy receipt binding');
  return binding;
};

export class SqliteHealthRepository extends SqliteRepository implements HealthRepositoryPort, HealthPolicyResourceRepositoryPort {
  public listHealthRecords(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly HealthRecordRow[]> {
    const visibility = assertCollectionRead(context, 'health_record');
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT id,family_id,owner_person_id,title,kind,privacy,provider,notes,occurred_at,created_at
        FROM health_records
        WHERE family_id=?
          ${collectionVisibilitySql('health_records', 'owner_person_id')}
        ORDER BY occurred_at DESC,id
      `).all(visibility.familyId, ...collectionVisibilityParameters(visibility, 'health_record')) as ReadonlyArray<Record<string, unknown>>
    ).map(mapHealthRecord));
  }

  public findHealthRecordForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<HealthRecordRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,family_id,owner_person_id,title,kind,privacy,provider,notes,occurred_at,created_at
        FROM health_records
        WHERE id=?
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle dl
            WHERE dl.resource_type='health_record'
              AND dl.resource_id=health_records.id
              AND dl.state<>'active'
          )
      `).get(id) as Record<string, unknown> | undefined;
      return row ? mapHealthRecord(row) : null;
    });
  }

  public insertHealthRecord(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: HealthRecordRow
  ): RepositoryResult<void> {
    const policy = healthWriteBinding(context, 'health_record', row.id, row.familyId);
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO health_records(
          id,family_id,owner_person_id,title,kind,privacy,provider,notes,occurred_at,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        row.id,
        row.familyId,
        row.ownerPersonId,
        row.title,
        row.kind,
        row.privacy,
        row.provider ?? null,
        row.notes ?? null,
        row.occurredAt,
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
      this.database(context).prepare("INSERT OR IGNORE INTO data_lifecycle(resource_type,resource_id,owner_person_id,privacy,state,updated_at) VALUES('health_record',?,?,?,'active',?)").run(row.id,row.ownerPersonId,row.privacy,row.createdAt);
    });
  }

  public listMedicationPlans(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly MedicationPlanRow[]> {
    const visibility = assertCollectionRead(context, 'medication_plan');
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT id,family_id,owner_person_id,name,dosage,schedule,provider,starts_at,ends_at,privacy,notes,created_at
        FROM medication_plans
        WHERE family_id=?
          ${collectionVisibilitySql('medication_plans', 'owner_person_id')}
        ORDER BY starts_at DESC,id
      `).all(visibility.familyId, ...collectionVisibilityParameters(visibility, 'medication_plan')) as ReadonlyArray<Record<string, unknown>>
    ).map(mapMedicationPlan));
  }

  public findMedicationPlanForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<MedicationPlanRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,family_id,owner_person_id,name,dosage,schedule,provider,starts_at,ends_at,privacy,notes,created_at
        FROM medication_plans
        WHERE id=?
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle dl
            WHERE dl.resource_type='medication_plan'
              AND dl.resource_id=medication_plans.id
              AND dl.state<>'active'
          )
      `).get(id) as Record<string, unknown> | undefined;
      return row ? mapMedicationPlan(row) : null;
    });
  }

  public insertMedicationPlan(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: MedicationPlanRow
  ): RepositoryResult<void> {
    const policy = healthWriteBinding(context, 'medication_plan', row.id, row.familyId);
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO medication_plans(
          id,family_id,owner_person_id,name,dosage,schedule,provider,starts_at,ends_at,privacy,notes,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        row.id,
        row.familyId,
        row.ownerPersonId,
        row.name,
        row.dosage,
        row.schedule,
        row.provider ?? null,
        row.startsAt,
        row.endsAt ?? null,
        row.privacy,
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
      this.database(context).prepare("INSERT OR IGNORE INTO data_lifecycle(resource_type,resource_id,owner_person_id,privacy,state,updated_at) VALUES('medication_plan',?,?,?,'active',?)").run(row.id,row.ownerPersonId,row.privacy,row.createdAt);
    });
  }

  public listFamilyHealthHistory(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly FamilyHealthHistoryRow[]> {
    const visibility = assertCollectionRead(context, 'family_health_history');
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT id,family_id,related_person_id,condition,relationship_note,diagnosed_at,privacy,notes,created_at
        FROM family_health_history
        WHERE family_id=?
          ${collectionVisibilitySql('family_health_history', 'related_person_id')}
        ORDER BY created_at DESC,id
      `).all(visibility.familyId, ...collectionVisibilityParameters(visibility, 'family_health_history')) as ReadonlyArray<Record<string, unknown>>
    ).map(mapFamilyHealthHistory));
  }

  public findFamilyHealthHistoryForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<FamilyHealthHistoryRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,family_id,related_person_id,condition,relationship_note,diagnosed_at,privacy,notes,created_at
        FROM family_health_history
        WHERE id=?
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle dl
            WHERE dl.resource_type='family_health_history'
              AND dl.resource_id=family_health_history.id
              AND dl.state<>'active'
          )
      `).get(id) as Record<string, unknown> | undefined;
      return row ? mapFamilyHealthHistory(row) : null;
    });
  }

  public insertFamilyHealthHistory(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: FamilyHealthHistoryRow
  ): RepositoryResult<void> {
    const policy = healthWriteBinding(context, 'family_health_history', row.id, row.familyId);
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO family_health_history(
          id,family_id,related_person_id,condition,relationship_note,diagnosed_at,privacy,notes,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        row.id,
        row.familyId,
        row.relatedPersonId,
        row.condition,
        row.relationshipNote ?? null,
        row.diagnosedAt ?? null,
        row.privacy,
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
      this.database(context).prepare("INSERT OR IGNORE INTO data_lifecycle(resource_type,resource_id,owner_person_id,privacy,state,updated_at) VALUES('family_health_history',?,?,?,'active',?)").run(row.id,row.relatedPersonId,row.privacy,row.createdAt);
    });
  }
}
