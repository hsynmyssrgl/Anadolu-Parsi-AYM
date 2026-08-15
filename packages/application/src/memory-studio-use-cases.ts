import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  asEventId,
  asIsoDateTime,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import type { DomainEvent } from '@ppt/events';
import {
  MEMORY_STUDIO_RECORD_KINDS,
  memoryStudioCenterId,
  type CreateMemoryStudioRecordInput,
  type CreateMemoryTimeCapsuleInput,
  type DeleteMemoryStudioRecordInput,
  type MemoryStudioCenterView,
  type MemoryStudioMutationKind,
  type MemoryStudioMutationReceiptView,
  type MemoryStudioRecordKind,
  type MemoryTimeCapsuleApprovalView,
  type ReviewMemoryTimeCapsuleInput,
  type TransitionMemoryTimeCapsuleInput
} from '@ppt/domain';
import {
  canonicalMemoryStudioReferences,
  type MemoryStudioCenterKey,
  type MemoryStudioMutationRow,
  type MemoryStudioRecordRow,
  type MemoryStudioReferenceSet,
  type MemoryTimeCapsuleRow
} from '@ppt/repository-contracts';
import type { LifeApplicationContext, LifePolicyIntent } from './life-use-cases.js';

export interface MemoryStudioQueryPort {
  getCenter(context: LifeApplicationContext): Promise<Result<MemoryStudioCenterView, AppError>>;
}

export interface MemoryStudioWriteScope {
  readonly occurredAt: MemoryStudioMutationRow['occurredAt'];
  readonly ownerPersonId: MemoryStudioCenterKey['ownerPersonId'];
  findRecord(recordId: string): Result<MemoryStudioRecordRow | null, AppError>;
  findCapsule(capsuleId: string): Result<MemoryTimeCapsuleRow | null, AppError>;
  findMutation(clientOperationId: string): Result<MemoryStudioMutationRow | null, AppError>;
  validateOwnedReferences(references: MemoryStudioReferenceSet): Result<boolean, AppError>;
  insertMutation(row: MemoryStudioMutationRow): Result<void, AppError>;
  insertRecord(row: MemoryStudioRecordRow): Result<void, AppError>;
  saveRecord(row: MemoryStudioRecordRow, expectedRevision: number): Result<void, AppError>;
  insertCapsule(row: MemoryTimeCapsuleRow): Result<void, AppError>;
  saveCapsule(row: MemoryTimeCapsuleRow, expectedRevision: number): Result<void, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: MemoryStudioMutationRow['occurredAt'];
    readonly actorId: LifeApplicationContext['actor']['userId'];
  }): Result<string, AppError>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError>;
}

export interface MemoryStudioUnitOfWork {
  execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: MemoryStudioWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,255}$/u;
const CONTROL = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const recordKinds = new Set<string>(MEMORY_STUDIO_RECORD_KINDS);
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
const canonicalIds = (values: readonly string[]): readonly string[] => Object.freeze([...new Set(values)].sort());

const appError = (
  context: LifeApplicationContext,
  code: typeof ERROR_CODES.CORE_INVALID_ARGUMENT | typeof ERROR_CODES.RESOURCE_CONFLICT |
    typeof ERROR_CODES.RESOURCE_NOT_FOUND | typeof ERROR_CODES.AUTHORIZATION_DENIED,
  message: string,
  category: 'validation' | 'conflict' | 'not_found' | 'authorization'
): AppError => createAppError({ code, message, category, correlationId: context.correlationId });
const invalid = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.CORE_INVALID_ARGUMENT, message, 'validation');
const conflict = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.RESOURCE_CONFLICT, message, 'conflict');
const missing = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.RESOURCE_NOT_FOUND, message, 'not_found');
const denied = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.AUTHORIZATION_DENIED, message, 'authorization');

const requireActor = (context: LifeApplicationContext): Result<NonNullable<LifeApplicationContext['actor']['personId']>, AppError> =>
  context.actor.personId ? ok(context.actor.personId) : err(denied(context, 'Hafıza stüdyosu kişi bağlı oturum gerektirir.'));

const normalizeText = (
  context: LifeApplicationContext,
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
  optional = false
): Result<string | undefined, AppError> => {
  if (optional && (value === undefined || value === '')) return ok(undefined);
  if (typeof value !== 'string') return err(invalid(context, `${field} metin olmalıdır.`));
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  return normalized.length >= minimum && normalized.length <= maximum && !CONTROL.test(normalized)
    ? ok(normalized)
    : err(invalid(context, `${field} sınırları geçersizdir.`));
};

const ids = (
  context: LifeApplicationContext,
  value: unknown,
  field: string,
  maximum = 32
): Result<readonly string[], AppError> => {
  if (value === undefined) return ok(Object.freeze([]));
  if (!Array.isArray(value) || value.length > maximum || value.some((item) => typeof item !== 'string' || !SAFE_ID.test(item)) ||
    new Set(value).size !== value.length) return err(invalid(context, `${field} kimlik listesi geçersizdir.`));
  return ok(canonicalIds(value as string[]));
};

const date = (context: LifeApplicationContext, value: unknown, field: string): Result<ReturnType<typeof asIsoDateTime>, AppError> => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return err(invalid(context, `${field} zamanı geçersizdir.`));
  return ok(asIsoDateTime(new Date(value).toISOString()));
};

export const memoryStudioReadIntent = (): LifePolicyIntent => ({
  action: 'read', capability: 'family.read', resourceType: 'memory_studio_center', resourceId: '*', purpose: 'general'
});
const writeIntent = (
  resourceType: 'memory_studio_record' | 'memory_time_capsule',
  resourceId: string,
  action: 'create' | 'update' | 'delete',
  ownerPersonId?: string
): LifePolicyIntent => ({
  action, capability: 'family.write', resourceType, resourceId, purpose: 'general',
  ...(action === 'create' && ownerPersonId ? { ownerPersonId: asPersonId(ownerPersonId), privacy: 'private' as const } : {})
});

const referenceCount = (references: MemoryStudioReferenceSet): number =>
  references.archiveItemIds.length + references.personIds.length + references.memoryRecordIds.length + (references.ocrJobId ? 1 : 0);

const recordFingerprint = (row: Omit<MemoryStudioRecordRow, 'stateFingerprint'>): string => hash({
  id: row.id, familyId: row.familyId, ownerPersonId: row.ownerPersonId, kind: row.kind, status: row.status,
  title: row.title, summary: row.summary ?? null, archiveItemIds: row.archiveItemIds, personIds: row.personIds,
  ocrJobId: row.ocrJobId ?? null, eventDate: row.eventDate ?? null,
  manualFaceGroupingApproved: row.manualFaceGroupingApproved, referenceFingerprint: row.referenceFingerprint,
  revision: row.revision, lastMutationId: row.lastMutationId, createdAt: row.createdAt, updatedAt: row.updatedAt,
  deletedAt: row.deletedAt ?? null
});
const capsuleFingerprint = (row: Omit<MemoryTimeCapsuleRow, 'stateFingerprint'>): string => hash({
  id: row.id, familyId: row.familyId, ownerPersonId: row.ownerPersonId, title: row.title, status: row.status,
  archiveItemIds: row.archiveItemIds, memoryRecordIds: row.memoryRecordIds, unlockAt: row.unlockAt,
  minimumApprovals: row.minimumApprovals, approvals: row.approvals, referenceFingerprint: row.referenceFingerprint,
  revision: row.revision, lastMutationId: row.lastMutationId, createdAt: row.createdAt, updatedAt: row.updatedAt,
  sealedAt: row.sealedAt ?? null, releasedAt: row.releasedAt ?? null, cancelledAt: row.cancelledAt ?? null,
  rolledBackAt: row.rolledBackAt ?? null
});

const mutationId = (context: LifeApplicationContext, clientOperationId: string, requestFingerprint: string): string =>
  hash({ familyId: context.familyId, accountId: context.actor.userId, clientOperationId, requestFingerprint });
const mutationReceipt = (row: MemoryStudioMutationRow, replayed: boolean): MemoryStudioMutationReceiptView => Object.freeze({
  resourceType: row.resourceType, resourceId: row.resourceId, mutationKind: row.mutationKind,
  previousRevision: row.expectedRevision, revision: row.revision, occurredAt: row.occurredAt, replayed,
  networkUsed: false, cloudUsed: false, externalDeliveryPerformed: 'not_performed'
});
const replay = (
  context: LifeApplicationContext,
  existing: MemoryStudioMutationRow | null,
  requestFingerprint: string,
  mutationKind: MemoryStudioMutationKind,
  resourceType: MemoryStudioMutationRow['resourceType'],
  resourceId: string
): Result<MemoryStudioMutationReceiptView | null, AppError> => {
  if (!existing) return ok(null);
  return existing.requestFingerprint === requestFingerprint && existing.mutationKind === mutationKind &&
    existing.resourceType === resourceType && existing.resourceId === resourceId
    ? ok(mutationReceipt(existing, true))
    : err(conflict(context, 'Aynı işlem kimliği farklı bir hafıza stüdyosu komutuyla kullanıldı.'));
};

const persist = (
  context: LifeApplicationContext,
  scope: MemoryStudioWriteScope,
  mutation: MemoryStudioMutationRow,
  writeCurrent: () => Result<void, AppError>
): Result<MemoryStudioMutationReceiptView, AppError> => {
  const ledger = scope.insertMutation(mutation); if (!ledger.ok) return ledger;
  const current = writeCurrent(); if (!current.ok) return current;
  const audit = scope.appendAudit({ id: hash({ mutationId: mutation.id, kind: 'audit' }),
    action: `memory_studio.${mutation.mutationKind}`, resourceType: mutation.resourceType,
    resourceId: mutation.resourceId, occurredAt: mutation.occurredAt, actorId: context.actor.userId });
  if (!audit.ok) return audit;
  const event = scope.enqueueEvent({ eventId: asEventId(hash({ mutationId: mutation.id, kind: 'event' })),
    eventType: `memory_studio.${mutation.mutationKind}`, eventVersion: 1, aggregateType: mutation.resourceType,
    aggregateId: mutation.resourceId, occurredAt: mutation.occurredAt, actorId: context.actor.userId,
    correlationId: context.correlationId, payload: { resourceType: mutation.resourceType, resourceId: mutation.resourceId,
      mutationKind: mutation.mutationKind, revision: mutation.revision, referenceCount: mutation.referenceCount,
      networkUsed: false, cloudUsed: false, externalDeliveryPerformed: 'not_performed' } });
  return event.ok ? ok(mutationReceipt(mutation, false)) : event;
};

export class GetMemoryStudioCenterUseCase {
  public constructor(private readonly queryPort: MemoryStudioQueryPort) {}
  public execute(context: LifeApplicationContext): Promise<Result<MemoryStudioCenterView, AppError>> {
    return this.queryPort.getCenter(context);
  }
}

export class CreateMemoryStudioRecordUseCase {
  public constructor(private readonly unitOfWork: MemoryStudioUnitOfWork) {}
  public async execute(input: { readonly context: LifeApplicationContext; readonly command: CreateMemoryStudioRecordInput })
  : Promise<Result<MemoryStudioMutationReceiptView, AppError>> {
    const { context, command } = input; const actor = requireActor(context); if (!actor.ok) return actor;
    if (!SAFE_ID.test(command.clientOperationId) || !SAFE_ID.test(command.recordId) || !recordKinds.has(command.kind))
      return err(invalid(context, 'Hafıza kaydı işlem, kayıt veya tür kimliği geçersizdir.'));
    const title = normalizeText(context, command.title, 'Başlık', 2, 160); if (!title.ok) return title;
    const summary = normalizeText(context, command.summary, 'Özet', 2, 2000, true); if (!summary.ok) return summary;
    const archiveItemIds = ids(context, command.archiveItemIds, 'Arşiv'); if (!archiveItemIds.ok) return archiveItemIds;
    const personIds = ids(context, command.personIds, 'Kişi'); if (!personIds.ok) return personIds;
    if (command.ocrJobId !== undefined && !SAFE_ID.test(command.ocrJobId)) return err(invalid(context, 'OCR işi kimliği geçersizdir.'));
    let eventDate: ReturnType<typeof asIsoDateTime> | undefined;
    if (command.eventDate !== undefined) { const parsed = date(context, command.eventDate, 'Olay'); if (!parsed.ok) return parsed; eventDate = parsed.value; }
    if (!summary.value && archiveItemIds.value.length === 0 && personIds.value.length === 0 && !command.ocrJobId)
      return err(invalid(context, 'Hafıza kaydı en az bir yerel kaynak veya kullanıcı özeti içermelidir.'));
    if (command.kind === 'face_group' && (command.manualFaceGroupingApproved !== true || archiveItemIds.value.length === 0 || personIds.value.length === 0))
      return err(denied(context, 'Yüz grubu yalnız açık manuel onay, arşiv medyası ve kişi seçimiyle oluşturulabilir.'));
    if (command.kind === 'transcript' && archiveItemIds.value.length === 0 && !command.ocrJobId)
      return err(invalid(context, 'Transkript kaydı korunan arşiv veya yerel OCR referansı gerektirir.'));
    const references = canonicalMemoryStudioReferences({ archiveItemIds: archiveItemIds.value, personIds: personIds.value,
      memoryRecordIds: [], ...(command.ocrJobId ? { ocrJobId: command.ocrJobId } : {}) });
    const requestFingerprint = hash({ ...command, title: title.value, summary: summary.value ?? null,
      archiveItemIds: references.archiveItemIds, personIds: references.personIds, eventDate: eventDate ?? null,
      manualFaceGroupingApproved: command.manualFaceGroupingApproved === true });
    return this.unitOfWork.execute(context, writeIntent('memory_studio_record', command.recordId, 'create', actor.value), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(context, prior.value, requestFingerprint, 'record_create', 'memory_studio_record', command.recordId);
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      const current = scope.findRecord(command.recordId); if (!current.ok) return current;
      if (current.value) return err(conflict(context, 'Hafıza kaydı kimliği zaten kullanılıyor.'));
      const validReferences = scope.validateOwnedReferences(references); if (!validReferences.ok) return validReferences;
      if (!validReferences.value) return err(denied(context, 'Hafıza kaydı yalnız aynı sahipteki yetkili yerel kaynaklara bağlanabilir.'));
      const occurredAt = asIsoDateTime(scope.occurredAt); const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const referenceFingerprint = hash(references);
      const base: Omit<MemoryStudioRecordRow, 'stateFingerprint'> = { id: command.recordId, familyId: context.familyId,
        ownerPersonId: scope.ownerPersonId, kind: command.kind as MemoryStudioRecordKind, status: 'active', title: title.value!,
        ...(summary.value ? { summary: summary.value } : {}), archiveItemIds: references.archiveItemIds,
        personIds: references.personIds, ...(references.ocrJobId ? { ocrJobId: references.ocrJobId } : {}),
        ...(eventDate ? { eventDate } : {}), manualFaceGroupingApproved: command.kind === 'face_group', referenceFingerprint,
        revision: 1, lastMutationId: id, createdAt: occurredAt, updatedAt: occurredAt };
      const row: MemoryStudioRecordRow = Object.freeze({ ...base, stateFingerprint: recordFingerprint(base) });
      const mutation: MemoryStudioMutationRow = Object.freeze({ id, familyId: context.familyId, ownerPersonId: scope.ownerPersonId,
        resourceType: 'memory_studio_record', resourceId: command.recordId, actorAccountId: context.actor.userId,
        actorPersonId: actor.value, mutationKind: 'record_create', clientOperationId: command.clientOperationId,
        requestFingerprint, expectedRevision: 0, revision: 1, resourceStateFingerprint: row.stateFingerprint,
        referenceFingerprint, referenceCount: referenceCount(references), occurredAt });
      return persist(context, scope, mutation, () => scope.insertRecord(row));
    });
  }
}

export class DeleteMemoryStudioRecordUseCase {
  public constructor(private readonly unitOfWork: MemoryStudioUnitOfWork) {}
  public async execute(input: { readonly context: LifeApplicationContext; readonly command: DeleteMemoryStudioRecordInput })
  : Promise<Result<MemoryStudioMutationReceiptView, AppError>> {
    const { context, command } = input; const actor = requireActor(context); if (!actor.ok) return actor;
    if (!SAFE_ID.test(command.clientOperationId) || !SAFE_ID.test(command.recordId) || !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 1)
      return err(invalid(context, 'Hafıza kaydı silme komutu geçersizdir.'));
    const requestFingerprint = hash(command);
    return this.unitOfWork.execute(context, writeIntent('memory_studio_record', command.recordId, 'delete'), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(context, prior.value, requestFingerprint, 'record_delete', 'memory_studio_record', command.recordId);
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      const current = scope.findRecord(command.recordId); if (!current.ok) return current;
      if (!current.value) return err(missing(context, 'Hafıza kaydı bulunamadı.'));
      if (current.value.revision !== command.expectedRevision || current.value.status !== 'active')
        return err(conflict(context, 'Hafıza kaydı sürümü veya durumu değişti.'));
      const occurredAt = asIsoDateTime(scope.occurredAt); const revision = current.value.revision + 1;
      const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const base: Omit<MemoryStudioRecordRow, 'stateFingerprint'> = { ...current.value, status: 'deleted', revision,
        lastMutationId: id, updatedAt: occurredAt, deletedAt: occurredAt };
      const row: MemoryStudioRecordRow = Object.freeze({ ...base, stateFingerprint: recordFingerprint(base) });
      const mutation: MemoryStudioMutationRow = Object.freeze({ id, familyId: current.value.familyId,
        ownerPersonId: current.value.ownerPersonId, resourceType: 'memory_studio_record', resourceId: current.value.id,
        actorAccountId: context.actor.userId, actorPersonId: actor.value, mutationKind: 'record_delete',
        clientOperationId: command.clientOperationId, requestFingerprint, expectedRevision: current.value.revision, revision,
        resourceStateFingerprint: row.stateFingerprint, referenceFingerprint: row.referenceFingerprint,
        referenceCount: row.archiveItemIds.length + row.personIds.length + (row.ocrJobId ? 1 : 0), occurredAt });
      return persist(context, scope, mutation, () => scope.saveRecord(row, current.value!.revision));
    });
  }
}

export class CreateMemoryTimeCapsuleUseCase {
  public constructor(private readonly unitOfWork: MemoryStudioUnitOfWork) {}
  public async execute(input: { readonly context: LifeApplicationContext; readonly command: CreateMemoryTimeCapsuleInput })
  : Promise<Result<MemoryStudioMutationReceiptView, AppError>> {
    const { context, command } = input; const actor = requireActor(context); if (!actor.ok) return actor;
    if (!SAFE_ID.test(command.clientOperationId) || !SAFE_ID.test(command.capsuleId))
      return err(invalid(context, 'Zaman kapsülü işlem veya kapsül kimliği geçersizdir.'));
    const title = normalizeText(context, command.title, 'Başlık', 2, 160); if (!title.ok) return title;
    const archiveItemIds = ids(context, command.archiveItemIds, 'Arşiv'); if (!archiveItemIds.ok) return archiveItemIds;
    const memoryRecordIds = ids(context, command.memoryRecordIds, 'Hafıza kaydı'); if (!memoryRecordIds.ok) return memoryRecordIds;
    if (archiveItemIds.value.length + memoryRecordIds.value.length < 1)
      return err(invalid(context, 'Zaman kapsülü en az bir korunan arşiv veya hafıza kaydı referansı içermelidir.'));
    const unlock = date(context, command.unlockAt, 'Açılma'); if (!unlock.ok) return unlock;
    const references = canonicalMemoryStudioReferences({ archiveItemIds: archiveItemIds.value, personIds: [],
      memoryRecordIds: memoryRecordIds.value });
    const requestFingerprint = hash({ ...command, title: title.value, archiveItemIds: references.archiveItemIds,
      memoryRecordIds: references.memoryRecordIds, unlockAt: unlock.value });
    return this.unitOfWork.execute(context, writeIntent('memory_time_capsule', command.capsuleId, 'create', actor.value), (scope) => {
      const now = Date.parse(scope.occurredAt); const unlockAt = Date.parse(unlock.value);
      if (unlockAt < now + 7 * 86_400_000 || unlockAt > now + 100 * 365.25 * 86_400_000)
        return err(invalid(context, 'Zaman kapsülü açılma tarihi en az 7 gün ve en çok 100 yıl ileride olmalıdır.'));
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(context, prior.value, requestFingerprint, 'capsule_create', 'memory_time_capsule', command.capsuleId);
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      const current = scope.findCapsule(command.capsuleId); if (!current.ok) return current;
      if (current.value) return err(conflict(context, 'Zaman kapsülü kimliği zaten kullanılıyor.'));
      const validReferences = scope.validateOwnedReferences(references); if (!validReferences.ok) return validReferences;
      if (!validReferences.value) return err(denied(context, 'Zaman kapsülü yalnız aynı sahipteki yetkili yerel kaynakları içerebilir.'));
      const occurredAt = asIsoDateTime(scope.occurredAt); const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const referenceFingerprint = hash(references);
      const base: Omit<MemoryTimeCapsuleRow, 'stateFingerprint'> = { id: command.capsuleId, familyId: context.familyId,
        ownerPersonId: scope.ownerPersonId, title: title.value!, status: 'awaiting_approvals',
        archiveItemIds: references.archiveItemIds, memoryRecordIds: references.memoryRecordIds, unlockAt: unlock.value,
        minimumApprovals: 2, approvals: Object.freeze([]), referenceFingerprint, revision: 1, lastMutationId: id,
        createdAt: occurredAt, updatedAt: occurredAt };
      const row: MemoryTimeCapsuleRow = Object.freeze({ ...base, stateFingerprint: capsuleFingerprint(base) });
      const mutation: MemoryStudioMutationRow = Object.freeze({ id, familyId: context.familyId, ownerPersonId: scope.ownerPersonId,
        resourceType: 'memory_time_capsule', resourceId: command.capsuleId, actorAccountId: context.actor.userId,
        actorPersonId: actor.value, mutationKind: 'capsule_create', clientOperationId: command.clientOperationId,
        requestFingerprint, expectedRevision: 0, revision: 1, resourceStateFingerprint: row.stateFingerprint,
        referenceFingerprint, referenceCount: referenceCount(references), occurredAt });
      return persist(context, scope, mutation, () => scope.insertCapsule(row));
    });
  }
}

export class ReviewMemoryTimeCapsuleUseCase {
  public constructor(private readonly unitOfWork: MemoryStudioUnitOfWork) {}
  public async execute(input: { readonly context: LifeApplicationContext; readonly command: ReviewMemoryTimeCapsuleInput })
  : Promise<Result<MemoryStudioMutationReceiptView, AppError>> {
    const { context, command } = input; const actor = requireActor(context); if (!actor.ok) return actor;
    if (!SAFE_ID.test(command.clientOperationId) || !SAFE_ID.test(command.capsuleId) || !Number.isSafeInteger(command.expectedRevision) ||
      command.expectedRevision < 1 || !['approve', 'revoke_approval'].includes(command.decision))
      return err(invalid(context, 'Zaman kapsülü onay komutu geçersizdir.'));
    const mutationKind: MemoryStudioMutationKind = command.decision === 'approve' ? 'capsule_approve' : 'capsule_revoke_approval';
    const requestFingerprint = hash(command);
    return this.unitOfWork.execute(context, writeIntent('memory_time_capsule', command.capsuleId, 'update'), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(context, prior.value, requestFingerprint, mutationKind, 'memory_time_capsule', command.capsuleId);
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      const current = scope.findCapsule(command.capsuleId); if (!current.ok) return current;
      if (!current.value) return err(missing(context, 'Zaman kapsülü bulunamadı.'));
      if (current.value.revision !== command.expectedRevision || current.value.status !== 'awaiting_approvals')
        return err(conflict(context, 'Yalnız onay bekleyen güncel kapsülün onayları değiştirilebilir.'));
      const own = current.value.approvals.find((approval) => approval.accountId === context.actor.userId);
      if (command.decision === 'approve' && own) return err(conflict(context, 'Bu hesap kapsülü daha önce onayladı.'));
      if (command.decision === 'revoke_approval' && !own) return err(conflict(context, 'Bu hesabın geri alınacak kapsül onayı yok.'));
      const occurredAt = asIsoDateTime(scope.occurredAt);
      const approvals: readonly MemoryTimeCapsuleApprovalView[] = Object.freeze((command.decision === 'approve'
        ? [...current.value.approvals, { accountId: context.actor.userId, personId: actor.value, approvedAt: occurredAt }]
        : current.value.approvals.filter((approval) => approval.accountId !== context.actor.userId))
        .sort((left, right) => left.accountId.localeCompare(right.accountId)));
      const revision = current.value.revision + 1; const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const base: Omit<MemoryTimeCapsuleRow, 'stateFingerprint'> = { ...current.value, approvals, revision,
        lastMutationId: id, updatedAt: occurredAt };
      const row: MemoryTimeCapsuleRow = Object.freeze({ ...base, stateFingerprint: capsuleFingerprint(base) });
      const mutation: MemoryStudioMutationRow = Object.freeze({ id, familyId: current.value.familyId,
        ownerPersonId: current.value.ownerPersonId, resourceType: 'memory_time_capsule', resourceId: current.value.id,
        actorAccountId: context.actor.userId, actorPersonId: actor.value, mutationKind,
        clientOperationId: command.clientOperationId, requestFingerprint, expectedRevision: current.value.revision, revision,
        resourceStateFingerprint: row.stateFingerprint, referenceFingerprint: row.referenceFingerprint,
        referenceCount: row.archiveItemIds.length + row.memoryRecordIds.length, occurredAt });
      return persist(context, scope, mutation, () => scope.saveCapsule(row, current.value!.revision));
    });
  }
}

export class TransitionMemoryTimeCapsuleUseCase {
  public constructor(private readonly unitOfWork: MemoryStudioUnitOfWork) {}
  public async execute(input: { readonly context: LifeApplicationContext; readonly command: TransitionMemoryTimeCapsuleInput })
  : Promise<Result<MemoryStudioMutationReceiptView, AppError>> {
    const { context, command } = input; const actor = requireActor(context); if (!actor.ok) return actor;
    if (!SAFE_ID.test(command.clientOperationId) || !SAFE_ID.test(command.capsuleId) || !Number.isSafeInteger(command.expectedRevision) ||
      command.expectedRevision < 1 || !['seal', 'release', 'cancel', 'rollback'].includes(command.transition))
      return err(invalid(context, 'Zaman kapsülü geçiş komutu geçersizdir.'));
    const mutationKind = `capsule_${command.transition}` as MemoryStudioMutationKind;
    const action = command.transition === 'cancel' ? 'delete' as const : 'update' as const;
    const requestFingerprint = hash(command);
    return this.unitOfWork.execute(context, writeIntent('memory_time_capsule', command.capsuleId, action), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(context, prior.value, requestFingerprint, mutationKind, 'memory_time_capsule', command.capsuleId);
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      const current = scope.findCapsule(command.capsuleId); if (!current.ok) return current;
      if (!current.value) return err(missing(context, 'Zaman kapsülü bulunamadı.'));
      if (current.value.revision !== command.expectedRevision) return err(conflict(context, 'Zaman kapsülü sürümü değişti.'));
      const occurredAt = asIsoDateTime(scope.occurredAt); const now = Date.parse(occurredAt);
      let status: MemoryTimeCapsuleRow['status'];
      const timestamps: Record<string, ReturnType<typeof asIsoDateTime>> = {};
      if (command.transition === 'seal') {
        if (current.value.status !== 'awaiting_approvals' || new Set(current.value.approvals.map((approval) => approval.accountId)).size < 2)
          return err(denied(context, 'Zaman kapsülü iki ayrı hesap onayı olmadan mühürlenemez.'));
        status = 'sealed'; timestamps.sealedAt = occurredAt;
      } else if (command.transition === 'release') {
        if (current.value.status !== 'sealed' || now < Date.parse(current.value.unlockAt))
          return err(denied(context, 'Zaman kapsülü bekleme süresi dolmadan yerel olarak açılamaz.'));
        status = 'released'; timestamps.releasedAt = occurredAt;
      } else if (command.transition === 'cancel') {
        if (!['awaiting_approvals', 'sealed'].includes(current.value.status))
          return err(conflict(context, 'Yalnız açılmamış zaman kapsülü iptal edilebilir.'));
        status = 'cancelled'; timestamps.cancelledAt = occurredAt;
      } else {
        if (current.value.status !== 'released' || !current.value.releasedAt || now > Date.parse(current.value.releasedAt) + 86_400_000)
          return err(denied(context, 'Yerel kapsül açılışı yalnız ilk 24 saat içinde geri alınabilir.'));
        status = 'rolled_back'; timestamps.rolledBackAt = occurredAt;
      }
      const revision = current.value.revision + 1; const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const base: Omit<MemoryTimeCapsuleRow, 'stateFingerprint'> = { ...current.value, ...timestamps, status, revision,
        lastMutationId: id, updatedAt: occurredAt };
      const row: MemoryTimeCapsuleRow = Object.freeze({ ...base, stateFingerprint: capsuleFingerprint(base) });
      const mutation: MemoryStudioMutationRow = Object.freeze({ id, familyId: current.value.familyId,
        ownerPersonId: current.value.ownerPersonId, resourceType: 'memory_time_capsule', resourceId: current.value.id,
        actorAccountId: context.actor.userId, actorPersonId: actor.value, mutationKind,
        clientOperationId: command.clientOperationId, requestFingerprint, expectedRevision: current.value.revision, revision,
        resourceStateFingerprint: row.stateFingerprint, referenceFingerprint: row.referenceFingerprint,
        referenceCount: row.archiveItemIds.length + row.memoryRecordIds.length, occurredAt });
      return persist(context, scope, mutation, () => scope.saveCapsule(row, current.value!.revision));
    });
  }
}
