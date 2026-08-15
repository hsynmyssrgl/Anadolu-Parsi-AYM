import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import { HEALTH_CARE_ACCESS_SCOPES } from '@ppt/domain';
import type {
  FamilyHealthHistoryView,
  HealthCareAccessGrantView,
  HealthCareAccessScope,
  HealthCareEntryView,
  HealthCareMutationKind,
  HealthRecordView,
  MedicationPlanView,
  RecordPrivacy
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type FamilyHealthHistoryRow,
  type HealthCareAccessGrantRow,
  type HealthCareCenterKey,
  type HealthCareCenterRow,
  type HealthCareCenterSnapshotRow,
  type HealthCareEntryRow,
  type HealthCareMutationRow,
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

const parseStringArray = <T extends string>(value: unknown): readonly T[] => {
  if (typeof value !== 'string') throw new Error('Health care JSON array is missing');
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    throw new Error('Health care JSON array is invalid');
  }
  return Object.freeze(parsed as T[]);
};

const mapHealthCareCenter = (row: Record<string, unknown>): HealthCareCenterRow => ({
  id: String(row.id),
  familyId: asFamilyId(String(row.family_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  revision: Number(row.revision),
  stateFingerprint: String(row.state_fingerprint),
  lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)),
  updatedAt: asIsoDateTime(String(row.updated_at))
});

const mapHealthCareEntry = (row: Record<string, unknown>): HealthCareEntryRow => ({
  id: String(row.id),
  centerId: String(row.center_id),
  familyId: asFamilyId(String(row.family_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  kind: String(row.kind) as HealthCareEntryView['kind'],
  accessScope: String(row.access_scope) as HealthCareAccessScope,
  title: String(row.title),
  status: String(row.status) as HealthCareEntryView['status'],
  occurredAt: asIsoDateTime(String(row.occurred_at)),
  ...(row.scheduled_at ? { scheduledAt: asIsoDateTime(String(row.scheduled_at)) } : {}),
  ...(row.note ? { note: String(row.note) } : {}),
  ...(row.measurement_value !== null && row.measurement_value !== undefined
    ? { measurement: {
        value: Number(row.measurement_value),
        ...(row.measurement_secondary_value !== null && row.measurement_secondary_value !== undefined
          ? { secondaryValue: Number(row.measurement_secondary_value) }
          : {}),
        unit: String(row.measurement_unit)
      } }
    : {}),
  ...(row.related_health_record_id ? { relatedHealthRecordId: String(row.related_health_record_id) } : {}),
  ...(row.related_medication_plan_id ? { relatedMedicationPlanId: String(row.related_medication_plan_id) } : {}),
  ...(row.related_archive_item_id ? { relatedArchiveItemId: String(row.related_archive_item_id) } : {}),
  recordedBy: String(row.recorded_by_role) as HealthCareEntryView['recordedBy'],
  recordedByAccountId: String(row.recorded_by_account_id),
  recordedByPersonId: asPersonId(String(row.recorded_by_person_id)),
  source: 'manual_local',
  mutationId: String(row.mutation_id),
  createdAt: asIsoDateTime(String(row.created_at))
});

const mapHealthCareGrant = (row: Record<string, unknown>): HealthCareAccessGrantRow => ({
  id: String(row.id),
  centerId: String(row.center_id),
  familyId: asFamilyId(String(row.family_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  caregiverAccountId: String(row.caregiver_account_id),
  caregiverPersonId: String(row.caregiver_person_id),
  allowedScopes: parseStringArray<HealthCareAccessScope>(row.allowed_scopes_json),
  actions: parseStringArray<HealthCareAccessGrantView['actions'][number]>(row.actions_json),
  state: String(row.state) as HealthCareAccessGrantView['state'],
  startsAt: asIsoDateTime(String(row.starts_at)),
  ...(row.ends_at ? { endsAt: asIsoDateTime(String(row.ends_at)) } : {}),
  revision: Number(row.revision),
  mutationId: String(row.mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)),
  updatedAt: asIsoDateTime(String(row.updated_at)),
  ...(row.revoked_at ? { revokedAt: asIsoDateTime(String(row.revoked_at)) } : {})
});

const mapHealthCareMutation = (row: Record<string, unknown>): HealthCareMutationRow => ({
  id: String(row.id),
  centerId: String(row.center_id),
  familyId: asFamilyId(String(row.family_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  actorAccountId: String(row.actor_account_id),
  actorPersonId: asPersonId(String(row.actor_person_id)),
  mutationKind: String(row.mutation_kind) as HealthCareMutationKind,
  clientOperationId: String(row.client_operation_id),
  requestFingerprint: String(row.request_fingerprint),
  expectedRevision: Number(row.expected_revision),
  revision: Number(row.revision),
  stateFingerprint: String(row.state_fingerprint),
  targetId: String(row.target_id),
  occurredAt: asIsoDateTime(String(row.occurred_at))
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

const assertHealthCareKey = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  key: HealthCareCenterKey,
  actions: readonly ('read' | 'create' | 'update')[]
) => {
  const authorization = context.policyAuthorization;
  const subject = authorization.subject;
  if (
    authorization.resourceType !== 'health_care_center'
    || authorization.resourceId !== key.centerId
    || authorization.resourceFamilyId !== key.familyId
    || !actions.includes(authorization.action as 'read' | 'create' | 'update')
    || authorization.capability !== (authorization.action === 'read' ? 'health.read' : 'health.write')
    || authorization.receiptRecord.request.purpose !== 'care'
    || subject.accountId !== key.accountId
    || String(context.actor.userId) !== key.accountId
    || !subject.familyIds.includes(key.familyId)
    || key.centerId !== `health-care-center:${key.ownerPersonId}`
  ) throw new Error('Health care center key does not match the exact policy receipt');
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'health_care_center',
    resourceId: key.centerId,
    action: authorization.action,
    capability: authorization.capability,
    correlationId: context.correlationId,
    resourceFamilyId: key.familyId
  });
  return authorization;
};

const healthCareWriteBinding = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  centerId: string,
  familyId: string
) => {
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'health_care_center',
    resourceId: centerId,
    action: 'update',
    capability: 'health.write',
    correlationId: context.correlationId,
    resourceFamilyId: familyId
  });
  if (context.policyAuthorization.receiptRecord.request.purpose !== 'care') {
    throw new Error('Health care write requires the care purpose');
  }
  const binding = platformPolicyPersistenceBinding(context, 'health_care_center', centerId);
  if (!binding) throw new Error('Health care write requires an active platform policy receipt binding');
  return binding;
};

const healthCareCenterSelect = `
  SELECT id,family_id,owner_person_id,revision,state_fingerprint,last_mutation_id,created_at,updated_at
  FROM health_care_centers
`;

const healthCareGrantSelect = `
  SELECT id,center_id,family_id,owner_person_id,caregiver_account_id,caregiver_person_id,
         allowed_scopes_json,actions_json,state,starts_at,ends_at,revision,mutation_id,
         created_at,updated_at,revoked_at
  FROM health_care_access_grants
`;

const healthCareEntrySelect = `
  SELECT id,center_id,family_id,owner_person_id,kind,access_scope,title,status,occurred_at,
         scheduled_at,note,measurement_value,measurement_secondary_value,measurement_unit,
         related_health_record_id,related_medication_plan_id,related_archive_item_id,
         recorded_by_role,recorded_by_account_id,recorded_by_person_id,mutation_id,created_at
  FROM health_care_entries
`;

const healthCareMutationSelect = `
  SELECT id,center_id,family_id,owner_person_id,actor_account_id,actor_person_id,mutation_kind,
         client_operation_id,request_fingerprint,expected_revision,revision,state_fingerprint,
         target_id,occurred_at
  FROM health_care_mutations
`;

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

  public findHealthCareCenterForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<HealthCareCenterRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`${healthCareCenterSelect} WHERE id=?`).get(id) as
        | Record<string, unknown>
        | undefined;
      return row ? mapHealthCareCenter(row) : null;
    });
  }

  public loadHealthCareCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: HealthCareCenterKey
  ): RepositoryResult<HealthCareCenterSnapshotRow> {
    const authorization = assertHealthCareKey(context, key, ['read']);
    return this.execute(context, () => {
      const database = this.database(context);
      const centerRow = database.prepare(`${healthCareCenterSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
        .get(key.centerId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined;
      const center = centerRow ? mapHealthCareCenter(centerRow) : null;
      const subject = authorization.subject;
      const direct = subject.personId === key.ownerPersonId;
      const occurredAt = authorization.receiptRecord.request.occurredAt;
      const ownGrantRow = direct ? undefined : database.prepare(`
        ${healthCareGrantSelect}
        WHERE center_id=? AND family_id=? AND owner_person_id=? AND caregiver_account_id=?
          AND state='active' AND starts_at<=? AND (ends_at IS NULL OR ends_at>=?)
        ORDER BY updated_at DESC,id LIMIT 1
      `).get(key.centerId, key.familyId, key.ownerPersonId, key.accountId, occurredAt, occurredAt) as
        | Record<string, unknown>
        | undefined;
      if (!direct && !ownGrantRow) throw new Error('Health care center has no active minimum-necessary caregiver grant');
      const ownGrant = ownGrantRow ? mapHealthCareGrant(ownGrantRow) : undefined;
      const visibleScopes = direct
        ? Object.freeze([...HEALTH_CARE_ACCESS_SCOPES])
        : ownGrant!.allowedScopes;
      const entryRows = center
        ? database.prepare(`
            ${healthCareEntrySelect}
            WHERE center_id=? AND family_id=? AND owner_person_id=?
              AND access_scope IN (SELECT value FROM json_each(?))
            ORDER BY occurred_at DESC,id LIMIT 501
          `).all(key.centerId, key.familyId, key.ownerPersonId, JSON.stringify(visibleScopes)) as ReadonlyArray<Record<string, unknown>>
        : [];
      const grantRows = center
        ? database.prepare(`
            ${healthCareGrantSelect}
            WHERE center_id=? AND family_id=? AND owner_person_id=?
              AND (?=1 OR caregiver_account_id=?)
            ORDER BY updated_at DESC,id LIMIT 257
          `).all(key.centerId, key.familyId, key.ownerPersonId, direct ? 1 : 0, key.accountId) as ReadonlyArray<Record<string, unknown>>
        : [];
      if (grantRows.length > 256) throw new Error('Health care grant result exceeds the bounded center contract');
      return Object.freeze({
        center,
        entries: Object.freeze(entryRows.slice(0, 500).map(mapHealthCareEntry)),
        grants: Object.freeze(grantRows.map(mapHealthCareGrant)),
        visibleScopes,
        canRecord: direct || ownGrant!.actions.includes('record'),
        truncated: entryRows.length > 500
      });
    });
  }

  public findHealthCareCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: HealthCareCenterKey
  ): RepositoryResult<HealthCareCenterRow | null> {
    assertHealthCareKey(context, key, ['create', 'update']);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`${healthCareCenterSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
        .get(key.centerId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined;
      return row ? mapHealthCareCenter(row) : null;
    });
  }

  public findHealthCareMutationByClientOperationId(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: HealthCareCenterKey,
    clientOperationId: string
  ): RepositoryResult<HealthCareMutationRow | null> {
    assertHealthCareKey(context, key, ['create', 'update']);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        ${healthCareMutationSelect}
        WHERE family_id=? AND actor_account_id=? AND client_operation_id=?
      `).get(key.familyId, key.accountId, clientOperationId) as Record<string, unknown> | undefined;
      return row ? mapHealthCareMutation(row) : null;
    });
  }

  public insertHealthCareMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: HealthCareMutationRow
  ): RepositoryResult<void> {
    const binding = healthCareWriteBinding(context, row.centerId, row.familyId);
    const subject = context.policyAuthorization.subject;
    if (
      row.actorAccountId !== subject.accountId
      || row.actorPersonId !== subject.personId
      || row.ownerPersonId !== context.policyAuthorization.receiptRecord.request.resource.ownerPersonId
      || row.revision !== row.expectedRevision + 1
    ) throw new Error('Health care mutation identity or revision does not match the receipt');
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO health_care_mutations(
          id,center_id,family_id,owner_person_id,actor_account_id,actor_person_id,mutation_kind,
          client_operation_id,request_fingerprint,expected_revision,revision,state_fingerprint,
          target_id,occurred_at,policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,policy_action,policy_capability
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        row.id,row.centerId,row.familyId,row.ownerPersonId,row.actorAccountId,row.actorPersonId,row.mutationKind,
        row.clientOperationId,row.requestFingerprint,row.expectedRevision,row.revision,row.stateFingerprint,
        row.targetId,row.occurredAt,binding.receiptHash,binding.receiptVersion,binding.nonce,
        context.correlationId,binding.resourceType,binding.resourceId,binding.action,binding.capability
      );
    });
  }

  public insertHealthCareCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: HealthCareCenterRow
  ): RepositoryResult<void> {
    healthCareWriteBinding(context, row.id, row.familyId);
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO health_care_centers(
          id,family_id,owner_person_id,revision,state_fingerprint,last_mutation_id,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?)
      `).run(row.id,row.familyId,row.ownerPersonId,row.revision,row.stateFingerprint,row.lastMutationId,row.createdAt,row.updatedAt);
    });
  }

  public saveHealthCareCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: HealthCareCenterRow,
    expectedRevision: number
  ): RepositoryResult<void> {
    healthCareWriteBinding(context, row.id, row.familyId);
    return this.execute(context, () => {
      const updated = this.database(context).prepare(`
        UPDATE health_care_centers
        SET revision=?,state_fingerprint=?,last_mutation_id=?,updated_at=?
        WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?
      `).run(row.revision,row.stateFingerprint,row.lastMutationId,row.updatedAt,row.id,row.familyId,row.ownerPersonId,expectedRevision);
      if (updated.changes !== 1) throw new Error('Health care center optimistic revision conflict');
    });
  }

  public insertHealthCareEntry(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: HealthCareEntryRow
  ): RepositoryResult<void> {
    const mutation = this.database(context).prepare(`
      SELECT expected_revision FROM health_care_mutations WHERE id=? AND center_id=?
    `).get(row.mutationId, row.centerId) as { expected_revision?: unknown } | undefined;
    if (!mutation) throw new Error('Health care entry mutation is missing');
    healthCareWriteBinding(context, row.centerId, row.familyId);
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO health_care_entries(
          id,center_id,family_id,owner_person_id,kind,access_scope,title,status,occurred_at,
          scheduled_at,note,measurement_value,measurement_secondary_value,measurement_unit,
          related_health_record_id,related_medication_plan_id,related_archive_item_id,
          recorded_by_role,recorded_by_account_id,recorded_by_person_id,mutation_id,created_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        row.id,row.centerId,row.familyId,row.ownerPersonId,row.kind,row.accessScope,row.title,row.status,row.occurredAt,
        row.scheduledAt ?? null,row.note ?? null,row.measurement?.value ?? null,row.measurement?.secondaryValue ?? null,
        row.measurement?.unit ?? null,row.relatedHealthRecordId ?? null,row.relatedMedicationPlanId ?? null,
        row.relatedArchiveItemId ?? null,row.recordedBy,row.recordedByAccountId,row.recordedByPersonId,row.mutationId,row.createdAt
      );
    });
  }

  public findHealthCareAccessGrant(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: HealthCareCenterKey,
    grantId: string
  ): RepositoryResult<HealthCareAccessGrantRow | null> {
    assertHealthCareKey(context, key, ['create', 'update']);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        ${healthCareGrantSelect}
        WHERE id=? AND center_id=? AND family_id=? AND owner_person_id=?
      `).get(grantId,key.centerId,key.familyId,key.ownerPersonId) as Record<string, unknown> | undefined;
      return row ? mapHealthCareGrant(row) : null;
    });
  }

  public findActiveHealthCareAccessGrantForActor(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: HealthCareCenterKey,
    occurredAt: HealthCareAccessGrantRow['updatedAt']
  ): RepositoryResult<HealthCareAccessGrantRow | null> {
    assertHealthCareKey(context, key, ['update']);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        ${healthCareGrantSelect}
        WHERE center_id=? AND family_id=? AND owner_person_id=? AND caregiver_account_id=?
          AND state='active' AND starts_at<=? AND (ends_at IS NULL OR ends_at>=?)
        ORDER BY updated_at DESC,id LIMIT 1
      `).get(key.centerId,key.familyId,key.ownerPersonId,key.accountId,occurredAt,occurredAt) as
        | Record<string, unknown>
        | undefined;
      return row ? mapHealthCareGrant(row) : null;
    });
  }

  public upsertHealthCareAccessGrant(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: HealthCareAccessGrantRow,
    expectedRevision: number | null
  ): RepositoryResult<void> {
    const mutation = this.database(context).prepare(`
      SELECT expected_revision FROM health_care_mutations WHERE id=? AND center_id=?
    `).get(row.mutationId, row.centerId) as { expected_revision?: unknown } | undefined;
    if (!mutation) throw new Error('Health care grant mutation is missing');
    healthCareWriteBinding(context, row.centerId, row.familyId);
    return this.execute(context, () => {
      if (expectedRevision === null) {
        this.database(context).prepare(`
          INSERT INTO health_care_access_grants(
            id,center_id,family_id,owner_person_id,caregiver_account_id,caregiver_person_id,
            allowed_scopes_json,actions_json,state,starts_at,ends_at,revision,mutation_id,
            created_at,updated_at,revoked_at
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          row.id,row.centerId,row.familyId,row.ownerPersonId,row.caregiverAccountId,row.caregiverPersonId,
          JSON.stringify(row.allowedScopes),JSON.stringify(row.actions),row.state,row.startsAt,row.endsAt ?? null,
          row.revision,row.mutationId,row.createdAt,row.updatedAt,row.revokedAt ?? null
        );
        return;
      }
      const updated = this.database(context).prepare(`
        UPDATE health_care_access_grants
        SET caregiver_account_id=?,caregiver_person_id=?,allowed_scopes_json=?,actions_json=?,state=?,
            starts_at=?,ends_at=?,revision=?,mutation_id=?,updated_at=?,revoked_at=?
        WHERE id=? AND center_id=? AND family_id=? AND owner_person_id=? AND revision=?
      `).run(
        row.caregiverAccountId,row.caregiverPersonId,JSON.stringify(row.allowedScopes),JSON.stringify(row.actions),
        row.state,row.startsAt,row.endsAt ?? null,row.revision,row.mutationId,row.updatedAt,row.revokedAt ?? null,
        row.id,row.centerId,row.familyId,row.ownerPersonId,expectedRevision
      );
      if (updated.changes !== 1) throw new Error('Health care grant optimistic revision conflict');
    });
  }
}
