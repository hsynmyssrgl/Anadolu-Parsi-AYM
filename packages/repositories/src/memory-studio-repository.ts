import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type {
  MemoryStudioMutationKind,
  MemoryStudioRecordKind,
  MemoryStudioRecordStatus,
  MemoryTimeCapsuleApprovalView,
  MemoryTimeCapsuleStatus
} from '@ppt/domain';
import { MEMORY_STUDIO_MAX_CAPSULES, MEMORY_STUDIO_MAX_RECORDS } from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  canonicalMemoryStudioReferences,
  type MemoryStudioCenterKey,
  type MemoryStudioCenterSnapshotRow,
  type MemoryStudioMutationRow,
  type MemoryStudioPolicyResourceRepositoryPort,
  type MemoryStudioRecordRow,
  type MemoryStudioReferenceSet,
  type MemoryStudioRepositoryPort,
  type MemoryTimeCapsuleRow,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const recordSelect = `SELECT id,family_id,owner_person_id,kind,status,title,summary,archive_item_ids_json,
  person_ids_json,ocr_job_id,event_date,manual_face_grouping_approved,reference_fingerprint,revision,
  state_fingerprint,last_mutation_id,created_at,updated_at,deleted_at FROM memory_studio_records`;
const capsuleSelect = `SELECT id,family_id,owner_person_id,title,status,archive_item_ids_json,memory_record_ids_json,
  unlock_at,minimum_approvals,approvals_json,reference_fingerprint,revision,state_fingerprint,last_mutation_id,
  created_at,updated_at,sealed_at,released_at,cancelled_at,rolled_back_at FROM memory_time_capsules`;
const mutationSelect = `SELECT id,family_id,owner_person_id,resource_type,resource_id,actor_account_id,
  actor_person_id,mutation_kind,client_operation_id,request_fingerprint,expected_revision,revision,
  resource_state_fingerprint,reference_fingerprint,reference_count,occurred_at FROM memory_studio_mutations`;
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{1,159}$/u.test(value);
const exactIso = (value: unknown): value is string => typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) && Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;

const stringArray = (raw: unknown, maximum = 32): readonly string[] => {
  const parsed = JSON.parse(String(raw)) as unknown;
  if (!Array.isArray(parsed) || parsed.length > maximum || parsed.some((item) => !safeId(item)) ||
    new Set(parsed).size !== parsed.length) throw new Error('Memory studio reference list is invalid');
  return Object.freeze([...parsed].sort((left, right) => left.localeCompare(right)));
};
const approvals = (raw: unknown): readonly MemoryTimeCapsuleApprovalView[] => {
  const parsed = JSON.parse(String(raw)) as unknown;
  if (!Array.isArray(parsed) || parsed.length > 32 || parsed.some((item) => !item || typeof item !== 'object' ||
    Object.getPrototypeOf(item) !== Object.prototype || Object.keys(item).sort().join(',') !== 'accountId,approvedAt,personId' ||
    !safeId((item as Record<string, unknown>).accountId) || !safeId((item as Record<string, unknown>).personId) ||
    !exactIso((item as Record<string, unknown>).approvedAt)) || new Set((parsed as Array<Record<string, unknown>>)
      .map((item) => item.accountId)).size !== parsed.length) throw new Error('Memory capsule approval ledger is invalid');
  return Object.freeze((parsed as Array<{ accountId: string; personId: string; approvedAt: string }>).map((item) => Object.freeze({
    accountId: item.accountId, personId: item.personId, approvedAt: asIsoDateTime(item.approvedAt)
  })).sort((left, right) => left.accountId.localeCompare(right.accountId)));
};
const mapRecord = (row: Record<string, unknown>): MemoryStudioRecordRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  kind: String(row.kind) as MemoryStudioRecordKind, status: String(row.status) as MemoryStudioRecordStatus,
  title: String(row.title), ...(row.summary ? { summary: String(row.summary) } : {}),
  archiveItemIds: stringArray(row.archive_item_ids_json), personIds: stringArray(row.person_ids_json),
  ...(row.ocr_job_id ? { ocrJobId: String(row.ocr_job_id) } : {}),
  ...(row.event_date ? { eventDate: asIsoDateTime(String(row.event_date)) } : {}),
  manualFaceGroupingApproved: Number(row.manual_face_grouping_approved) === 1,
  referenceFingerprint: String(row.reference_fingerprint), revision: Number(row.revision),
  stateFingerprint: String(row.state_fingerprint), lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at)),
  ...(row.deleted_at ? { deletedAt: asIsoDateTime(String(row.deleted_at)) } : {})
});
const mapCapsule = (row: Record<string, unknown>): MemoryTimeCapsuleRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  title: String(row.title), status: String(row.status) as MemoryTimeCapsuleStatus,
  archiveItemIds: stringArray(row.archive_item_ids_json), memoryRecordIds: stringArray(row.memory_record_ids_json),
  unlockAt: asIsoDateTime(String(row.unlock_at)), minimumApprovals: 2, approvals: approvals(row.approvals_json),
  referenceFingerprint: String(row.reference_fingerprint), revision: Number(row.revision),
  stateFingerprint: String(row.state_fingerprint), lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at)),
  ...(row.sealed_at ? { sealedAt: asIsoDateTime(String(row.sealed_at)) } : {}),
  ...(row.released_at ? { releasedAt: asIsoDateTime(String(row.released_at)) } : {}),
  ...(row.cancelled_at ? { cancelledAt: asIsoDateTime(String(row.cancelled_at)) } : {}),
  ...(row.rolled_back_at ? { rolledBackAt: asIsoDateTime(String(row.rolled_back_at)) } : {})
});
const mapMutation = (row: Record<string, unknown>): MemoryStudioMutationRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  resourceType: String(row.resource_type) as MemoryStudioMutationRow['resourceType'], resourceId: String(row.resource_id),
  actorAccountId: String(row.actor_account_id), actorPersonId: asPersonId(String(row.actor_person_id)),
  mutationKind: String(row.mutation_kind) as MemoryStudioMutationKind, clientOperationId: String(row.client_operation_id),
  requestFingerprint: String(row.request_fingerprint), expectedRevision: Number(row.expected_revision), revision: Number(row.revision),
  resourceStateFingerprint: String(row.resource_state_fingerprint), referenceFingerprint: String(row.reference_fingerprint),
  referenceCount: Number(row.reference_count), occurredAt: asIsoDateTime(String(row.occurred_at))
});

const assertKey = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  key: MemoryStudioCenterKey,
  mode: 'read' | 'write',
  resourceType?: MemoryStudioMutationRow['resourceType'],
  resourceId?: string
): void => {
  assertPolicyAuthorizedRepositoryContext(context, { resourceType: mode === 'read' ? 'memory_studio_center' : resourceType!,
    resourceId: mode === 'read' ? '*' : resourceId!, action: context.policyAuthorization.action,
    capability: mode === 'read' ? 'family.read' : 'family.write', correlationId: context.correlationId,
    resourceFamilyId: key.familyId });
  const authorization = context.policyAuthorization;
  if (authorization.purpose !== 'general' || authorization.subject.accountId !== key.accountId ||
    authorization.subject.personId !== key.actorPersonId || !authorization.subject.familyIds.includes(key.familyId) ||
    authorization.resourceFamilyId !== key.familyId || authorization.receiptRecord.request.resource.ownerPersonId !== key.ownerPersonId ||
    authorization.receiptRecord.request.resource.sensitivity !== 'highly_sensitive' ||
    key.centerId !== `memory-studio:${key.familyId}:${key.ownerPersonId}` || (mode === 'read' &&
      (authorization.action !== 'read' || key.actorPersonId !== key.ownerPersonId)) ||
    (mode === 'write' && !['create', 'update', 'delete'].includes(authorization.action)) ||
    (mode === 'write' && authorization.action === 'create' && key.actorPersonId !== key.ownerPersonId))
    throw new Error('Memory studio key does not match the exact owner policy receipt');
};
const writeBinding = (context: PolicyAuthorizedRepositoryExecutionContext, row: MemoryStudioMutationRow) => {
  const binding = platformPolicyPersistenceBinding(context, row.resourceType, row.resourceId);
  if (!binding || binding.resourceFamilyId !== row.familyId || binding.purpose !== 'general' ||
    binding.capability !== 'family.write' || binding.occurredAt !== row.occurredAt || binding.action !==
      (row.mutationKind === 'record_create' || row.mutationKind === 'capsule_create' ? 'create' :
        row.mutationKind === 'record_delete' || row.mutationKind === 'capsule_cancel' ? 'delete' : 'update'))
    throw new Error('Memory studio mutation requires an exact durable policy receipt');
  return binding;
};

export class SqliteMemoryStudioRepository extends SqliteRepository implements
  MemoryStudioRepositoryPort, MemoryStudioPolicyResourceRepositoryPort {
  public resolvePolicyResource(context: RepositoryExecutionContext, resourceType: MemoryStudioMutationRow['resourceType'], resourceId: string)
  : ReturnType<MemoryStudioPolicyResourceRepositoryPort['resolvePolicyResource']> {
    return this.execute(context, () => {
      const table = resourceType === 'memory_studio_record' ? 'memory_studio_records' : 'memory_time_capsules';
      const row = this.database(context).prepare(`SELECT id,family_id,owner_person_id,revision,status,state_fingerprint FROM ${table} WHERE id=?`)
        .get(resourceId) as Record<string, unknown> | undefined;
      return row ? Object.freeze({ id: String(row.id), familyId: asFamilyId(String(row.family_id)),
        ownerPersonId: asPersonId(String(row.owner_person_id)), revision: Number(row.revision), status: String(row.status),
        stateFingerprint: String(row.state_fingerprint) }) : null;
    });
  }
  public loadCenter(context: PolicyAuthorizedRepositoryExecutionContext, key: MemoryStudioCenterKey)
  : RepositoryResult<MemoryStudioCenterSnapshotRow> {
    assertKey(context, key, 'read'); return this.execute(context, () => {
      const records = this.database(context).prepare(`${recordSelect} WHERE family_id=? AND owner_person_id=? ORDER BY updated_at DESC,id LIMIT ${MEMORY_STUDIO_MAX_RECORDS + 1}`)
        .all(key.familyId, key.ownerPersonId) as Record<string, unknown>[];
      const capsules = this.database(context).prepare(`${capsuleSelect} WHERE family_id=? AND owner_person_id=? ORDER BY updated_at DESC,id LIMIT ${MEMORY_STUDIO_MAX_CAPSULES + 1}`)
        .all(key.familyId, key.ownerPersonId) as Record<string, unknown>[];
      if (records.length > MEMORY_STUDIO_MAX_RECORDS || capsules.length > MEMORY_STUDIO_MAX_CAPSULES)
        throw new Error('Memory studio center exceeds its bounded local result contract');
      return Object.freeze({ records: Object.freeze(records.map(mapRecord)), capsules: Object.freeze(capsules.map(mapCapsule)) });
    });
  }
  public findRecord(context: PolicyAuthorizedRepositoryExecutionContext, key: MemoryStudioCenterKey, recordId: string)
  : RepositoryResult<MemoryStudioRecordRow | null> {
    assertKey(context, key, 'write', 'memory_studio_record', recordId); return this.execute(context, () => {
      const row = this.database(context).prepare(`${recordSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
        .get(recordId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined; return row ? mapRecord(row) : null;
    });
  }
  public findCapsule(context: PolicyAuthorizedRepositoryExecutionContext, key: MemoryStudioCenterKey, capsuleId: string)
  : RepositoryResult<MemoryTimeCapsuleRow | null> {
    assertKey(context, key, 'write', 'memory_time_capsule', capsuleId); return this.execute(context, () => {
      const row = this.database(context).prepare(`${capsuleSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
        .get(capsuleId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined; return row ? mapCapsule(row) : null;
    });
  }
  public findMutationByClientOperationId(context: PolicyAuthorizedRepositoryExecutionContext, key: MemoryStudioCenterKey, clientOperationId: string)
  : RepositoryResult<MemoryStudioMutationRow | null> {
    assertKey(context, key, 'write', context.policyAuthorization.resourceType as MemoryStudioMutationRow['resourceType'],
      context.policyAuthorization.resourceId); return this.execute(context, () => {
      const row = this.database(context).prepare(`${mutationSelect} WHERE family_id=? AND actor_account_id=? AND client_operation_id=?`)
        .get(key.familyId, key.accountId, clientOperationId) as Record<string, unknown> | undefined; return row ? mapMutation(row) : null;
    });
  }
  public validateOwnedReferences(context: PolicyAuthorizedRepositoryExecutionContext, key: MemoryStudioCenterKey,
    input: MemoryStudioReferenceSet): RepositoryResult<boolean> {
    assertKey(context, key, 'write', context.policyAuthorization.resourceType as MemoryStudioMutationRow['resourceType'],
      context.policyAuthorization.resourceId);
    const references = canonicalMemoryStudioReferences(input);
    return this.execute(context, () => {
      const database = this.database(context);
      const count = (sql: string, values: readonly string[], scopeValues: readonly string[]): number => values.length === 0 ? 0 : Number((database.prepare(sql.replace('?',
        values.map(() => '?').join(','))).get(...values, ...scopeValues) as { count: number }).count);
      const archiveCount = count(`SELECT COUNT(*) count FROM archive_items item JOIN platform_policy_transaction_receipts receipt
        ON receipt.receipt_hash=item.policy_receipt_hash WHERE item.id IN (?) AND item.family_id=?
        AND item.destroyed_at IS NULL AND json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=?`,
        references.archiveItemIds, [key.familyId, key.ownerPersonId]);
      const personCount = count(`SELECT COUNT(*) count FROM people WHERE id IN (?) AND family_id=? AND status='active'`,
        references.personIds, [key.familyId]);
      const recordCount = count(`SELECT COUNT(*) count FROM memory_studio_records WHERE id IN (?)
        AND family_id=? AND owner_person_id=? AND status='active'`, references.memoryRecordIds, [key.familyId, key.ownerPersonId]);
      let ocrValid = true;
      if (references.ocrJobId) {
        const row = database.prepare(`SELECT COUNT(*) count FROM local_governed_ocr_jobs WHERE id=? AND family_id=? AND owner_person_id=? AND status<>'deleted'`)
          .get(references.ocrJobId, key.familyId, key.ownerPersonId) as { count: number };
        ocrValid = Number(row.count) === 1;
      }
      return archiveCount === references.archiveItemIds.length && personCount === references.personIds.length &&
        recordCount === references.memoryRecordIds.length && ocrValid;
    });
  }
  public insertMutation(context: PolicyAuthorizedRepositoryExecutionContext, row: MemoryStudioMutationRow): RepositoryResult<void> {
    const binding = writeBinding(context, row);
    if (row.actorAccountId !== context.policyAuthorization.subject.accountId || row.actorPersonId !== context.policyAuthorization.subject.personId ||
      row.ownerPersonId !== context.policyAuthorization.receiptRecord.request.resource.ownerPersonId || row.revision !== row.expectedRevision + 1)
      throw new Error('Memory studio mutation identity or revision is invalid');
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO memory_studio_mutations(
      id,family_id,owner_person_id,resource_type,resource_id,actor_account_id,actor_person_id,mutation_kind,
      client_operation_id,request_fingerprint,expected_revision,revision,resource_state_fingerprint,reference_fingerprint,
      reference_count,occurred_at,policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,
      policy_resource_type,policy_resource_id,policy_action,policy_capability) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        row.id, row.familyId, row.ownerPersonId, row.resourceType, row.resourceId, row.actorAccountId, row.actorPersonId,
        row.mutationKind, row.clientOperationId, row.requestFingerprint, row.expectedRevision, row.revision,
        row.resourceStateFingerprint, row.referenceFingerprint, row.referenceCount, row.occurredAt, binding.receiptHash,
        binding.receiptVersion, binding.nonce, context.correlationId, binding.resourceType, binding.resourceId, binding.action, binding.capability); });
  }
  public insertRecord(context: PolicyAuthorizedRepositoryExecutionContext, row: MemoryStudioRecordRow): RepositoryResult<void> {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType: 'memory_studio_record', resourceId: row.id, action: 'create',
      capability: 'family.write', correlationId: context.correlationId, resourceFamilyId: row.familyId });
    return this.execute(context, () => this.writeRecord(context, row, null));
  }
  public saveRecord(context: PolicyAuthorizedRepositoryExecutionContext, row: MemoryStudioRecordRow, expectedRevision: number): RepositoryResult<void> {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType: 'memory_studio_record', resourceId: row.id, action: 'delete',
      capability: 'family.write', correlationId: context.correlationId, resourceFamilyId: row.familyId });
    return this.execute(context, () => this.writeRecord(context, row, expectedRevision));
  }
  private writeRecord(context: PolicyAuthorizedRepositoryExecutionContext, row: MemoryStudioRecordRow, expectedRevision: number | null): void {
    const binding = platformPolicyPersistenceBinding(context, 'memory_studio_record', row.id); if (!binding) throw new Error('Memory record receipt missing');
    if (expectedRevision === null) { const count = Number((this.database(context).prepare(
      'SELECT COUNT(*) count FROM memory_studio_records WHERE family_id=? AND owner_person_id=?').get(
        row.familyId, row.ownerPersonId) as { count: number }).count);
      if (count >= MEMORY_STUDIO_MAX_RECORDS) throw new Error('Memory studio record capacity is exhausted');
      this.database(context).prepare(`INSERT INTO memory_studio_records(id,family_id,owner_person_id,
      kind,status,title,summary,archive_item_ids_json,person_ids_json,ocr_job_id,event_date,manual_face_grouping_approved,
      reference_fingerprint,revision,state_fingerprint,last_mutation_id,created_at,updated_at,deleted_at,policy_receipt_hash)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id, row.familyId, row.ownerPersonId, row.kind, row.status, row.title,
        row.summary ?? null, JSON.stringify(row.archiveItemIds), JSON.stringify(row.personIds), row.ocrJobId ?? null,
        row.eventDate ?? null, row.manualFaceGroupingApproved ? 1 : 0, row.referenceFingerprint, row.revision,
        row.stateFingerprint, row.lastMutationId, row.createdAt, row.updatedAt, row.deletedAt ?? null, binding.receiptHash); return; }
    const result = this.database(context).prepare(`UPDATE memory_studio_records SET status=?,revision=?,state_fingerprint=?,
      last_mutation_id=?,updated_at=?,deleted_at=?,policy_receipt_hash=? WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`).run(
        row.status, row.revision, row.stateFingerprint, row.lastMutationId, row.updatedAt, row.deletedAt ?? null,
        binding.receiptHash, row.id, row.familyId, row.ownerPersonId, expectedRevision);
    if (Number(result.changes) !== 1) throw new Error('Memory record optimistic revision conflict');
  }
  public insertCapsule(context: PolicyAuthorizedRepositoryExecutionContext, row: MemoryTimeCapsuleRow): RepositoryResult<void> {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType: 'memory_time_capsule', resourceId: row.id, action: 'create',
      capability: 'family.write', correlationId: context.correlationId, resourceFamilyId: row.familyId });
    return this.execute(context, () => this.writeCapsule(context, row, null));
  }
  public saveCapsule(context: PolicyAuthorizedRepositoryExecutionContext, row: MemoryTimeCapsuleRow, expectedRevision: number): RepositoryResult<void> {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType: 'memory_time_capsule', resourceId: row.id,
      action: context.policyAuthorization.action, capability: 'family.write', correlationId: context.correlationId,
      resourceFamilyId: row.familyId }); return this.execute(context, () => this.writeCapsule(context, row, expectedRevision));
  }
  private writeCapsule(context: PolicyAuthorizedRepositoryExecutionContext, row: MemoryTimeCapsuleRow, expectedRevision: number | null): void {
    const binding = platformPolicyPersistenceBinding(context, 'memory_time_capsule', row.id); if (!binding) throw new Error('Time capsule receipt missing');
    if (expectedRevision === null) { const count = Number((this.database(context).prepare(
      'SELECT COUNT(*) count FROM memory_time_capsules WHERE family_id=? AND owner_person_id=?').get(
        row.familyId, row.ownerPersonId) as { count: number }).count);
      if (count >= MEMORY_STUDIO_MAX_CAPSULES) throw new Error('Memory studio capsule capacity is exhausted');
      this.database(context).prepare(`INSERT INTO memory_time_capsules(id,family_id,owner_person_id,
      title,status,archive_item_ids_json,memory_record_ids_json,unlock_at,minimum_approvals,approvals_json,reference_fingerprint,
      revision,state_fingerprint,last_mutation_id,created_at,updated_at,sealed_at,released_at,cancelled_at,rolled_back_at,policy_receipt_hash)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id, row.familyId, row.ownerPersonId, row.title, row.status,
        JSON.stringify(row.archiveItemIds), JSON.stringify(row.memoryRecordIds), row.unlockAt, row.minimumApprovals,
        JSON.stringify(row.approvals), row.referenceFingerprint, row.revision, row.stateFingerprint, row.lastMutationId,
        row.createdAt, row.updatedAt, row.sealedAt ?? null, row.releasedAt ?? null, row.cancelledAt ?? null,
        row.rolledBackAt ?? null, binding.receiptHash); return; }
    const result = this.database(context).prepare(`UPDATE memory_time_capsules SET status=?,approvals_json=?,revision=?,
      state_fingerprint=?,last_mutation_id=?,updated_at=?,sealed_at=?,released_at=?,cancelled_at=?,rolled_back_at=?,
      policy_receipt_hash=? WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`).run(row.status,
        JSON.stringify(row.approvals), row.revision, row.stateFingerprint, row.lastMutationId, row.updatedAt, row.sealedAt ?? null,
        row.releasedAt ?? null, row.cancelledAt ?? null, row.rolledBackAt ?? null, binding.receiptHash, row.id, row.familyId,
        row.ownerPersonId, expectedRevision);
    if (Number(result.changes) !== 1) throw new Error('Time capsule optimistic revision conflict');
  }
}
