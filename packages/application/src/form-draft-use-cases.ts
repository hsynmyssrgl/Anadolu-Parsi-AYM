import {
  ERROR_CODES, createAppError, err, ok,
  type AppError, type CorrelationId, type EventId, type FamilyId, type IsoDateTime,
  type PersonId, type Result, type UserId
} from '@ppt/core';
import {
  canonicalizeFormDraftPayload, createFormDraftResourceId,
  type FamilyRole, type FormDraftView, type FormDraftWorkspaceView, type SaveFormDraftInput, type UndoFormDraftInput
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type { FormDraftMutationRow, FormDraftRow } from '@ppt/repository-contracts';
import { sha256Hex } from '@ppt/security';

export interface FormDraftApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: { readonly userId: UserId; readonly role: FamilyRole; readonly personId?: PersonId };
  readonly correlationId: CorrelationId;
}

export interface FormDraftPolicyIntent {
  readonly action: 'read' | 'create' | 'update';
  readonly capability: 'family.read' | 'family.write';
  readonly resourceType: 'form_draft';
  readonly resourceId: string;
  readonly purpose: 'general';
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly privacy: 'private';
  readonly sensitivity: 'personal';
}

export interface FormDraftWriteScope {
  readonly occurredAt: IsoDateTime;
  find(accountId: UserId, formKey: string): Result<FormDraftRow | null, AppError>;
  findMutationByClientOperationId(accountId: UserId, formKey: string, clientOperationId: string): Result<FormDraftMutationRow | null, AppError>;
  findMutationByRevision(accountId: UserId, formKey: string, revision: number): Result<FormDraftMutationRow | null, AppError>;
  listMutations(accountId: UserId, formKey: string, limit: number): Result<readonly FormDraftMutationRow[], AppError>;
  insertMutation(row: FormDraftMutationRow): Result<void, AppError>;
  saveCurrent(row: FormDraftRow, expectedRevision: number): Result<boolean, AppError>;
  appendAudit(input: { readonly id: string; readonly action: string; readonly resourceType: 'form_draft'; readonly resourceId: string; readonly occurredAt: IsoDateTime; readonly actorId: UserId }): Result<string, AppError>;
  enqueueEvent<T>(event: DomainEvent<T>): Result<void, AppError>;
}

export interface FormDraftUnitOfWork {
  execute<T>(context: FormDraftApplicationContext, intent: FormDraftPolicyIntent, operation: (scope: FormDraftWriteScope) => Result<T, AppError>): Promise<Result<T, AppError>>;
}

export interface FormDraftMutationIdentifiers {
  readonly mutationId: string;
  readonly requestFingerprint: string;
  readonly auditId: string;
  readonly outboxEventId: EventId;
}

const invalid = (context: FormDraftApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_INVALID_ARGUMENT, message, category: 'validation', correlationId: context.correlationId
});
const denied = (context: FormDraftApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED, message, category: 'authorization', correlationId: context.correlationId
});
const conflict = (context: FormDraftApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_CONFLICT, message, category: 'conflict', correlationId: context.correlationId
});

const operationIdValid = (value: string): boolean => value === value.trim() && /^[A-Za-z0-9._:-]{8,128}$/u.test(value);
const fingerprintValid = (value: string): boolean => /^[0-9a-f]{64}$/u.test(value);
const identifiersValid = (value: FormDraftMutationIdentifiers): boolean =>
  value.mutationId === value.mutationId.trim() && value.mutationId.length >= 8 && value.mutationId.length <= 160
  && fingerprintValid(value.requestFingerprint)
  && Boolean(value.auditId.trim());

const identityIsExact = (row: FormDraftRow | FormDraftMutationRow, context: FormDraftApplicationContext, ownerPersonId: PersonId, formKey: string, resourceId: string): boolean =>
  row.accountId === context.actor.userId && row.familyId === context.familyId
  && row.ownerPersonId === ownerPersonId && row.formKey === formKey && row.resourceId === resourceId;

const intentFor = (context: FormDraftApplicationContext, ownerPersonId: PersonId, resourceId: string, action: FormDraftPolicyIntent['action']): FormDraftPolicyIntent => ({
  action, capability: action === 'read' ? 'family.read' : 'family.write', resourceType: 'form_draft',
  resourceId, purpose: 'general', familyId: context.familyId, ownerPersonId, privacy: 'private', sensitivity: 'personal'
});

const viewFromRow = (row: FormDraftRow): FormDraftView => ({
  resourceId: row.resourceId, familyId: row.familyId, accountId: row.accountId,
  ownerPersonId: row.ownerPersonId, formKey: row.formKey, revision: row.revision,
  payloadJson: row.payloadJson, payloadFingerprint: row.payloadFingerprint, updatedAt: row.updatedAt
});
const viewFromMutation = (row: FormDraftMutationRow): FormDraftView => ({
  resourceId: row.resourceId, familyId: row.familyId, accountId: row.accountId,
  ownerPersonId: row.ownerPersonId, formKey: row.formKey, revision: row.revision,
  payloadJson: row.payloadJson, payloadFingerprint: row.payloadFingerprint, updatedAt: row.createdAt
});

const validFormKeyAndResource = (context: FormDraftApplicationContext, formKey: string): Result<string, AppError> => {
  try { return ok(createFormDraftResourceId(context.actor.userId, formKey)); }
  catch { return err(invalid(context, 'Form taslak anahtarı geçersiz.')); }
};

export class GetFormDraftWorkspaceUseCase {
  public constructor(private readonly unitOfWork: FormDraftUnitOfWork) {}
  public execute(input: { readonly context: FormDraftApplicationContext; readonly formKey: string }): Promise<Result<FormDraftWorkspaceView, AppError>> {
    const ownerPersonId = input.context.actor.personId;
    if (!ownerPersonId) return Promise.resolve(err(denied(input.context, 'Form taslağı için kişi bağlı oturum gereklidir.')));
    const resource = validFormKeyAndResource(input.context, input.formKey);
    if (!resource.ok) return Promise.resolve(resource);
    return this.unitOfWork.execute(input.context, intentFor(input.context, ownerPersonId, resource.value, 'read'), (scope) => {
      const current = scope.find(input.context.actor.userId, input.formKey);
      if (!current.ok) return current;
      const history = scope.listMutations(input.context.actor.userId, input.formKey, 100);
      if (!history.ok) return history;
      if (current.value && !identityIsExact(current.value, input.context, ownerPersonId, input.formKey, resource.value)) {
        return err(denied(input.context, 'Form taslağı hesap, aile veya kişi kapsamıyla eşleşmiyor.'));
      }
      if (history.value.some((row) => !identityIsExact(row, input.context, ownerPersonId, input.formKey, resource.value))) {
        return err(denied(input.context, 'Form taslak geçmişi kişisel kapsamla eşleşmiyor.'));
      }
      return ok({
        current: current.value ? viewFromRow(current.value) : null,
        history: history.value.map((row) => ({
          mutationId: row.id,
          operation: row.operation,
          revision: row.revision,
          restoredFromRevision: row.restoredFromRevision,
          payloadFingerprint: row.payloadFingerprint,
          createdAt: row.createdAt
        }))
      });
    });
  }
}

const sameReplay = (row: FormDraftMutationRow, operation: 'save' | 'undo', expectedRevision: number, requestFingerprint: string, payloadJson?: string, payloadFingerprint?: string): boolean =>
  row.operation === operation && row.previousRevision === expectedRevision && row.requestFingerprint === requestFingerprint
  && (payloadJson === undefined || (row.payloadJson === payloadJson && row.payloadFingerprint === payloadFingerprint));

const performMutation = (input: {
  readonly context: FormDraftApplicationContext; readonly formKey: string; readonly expectedRevision: number;
  readonly clientOperationId: string; readonly operation: 'save' | 'undo'; readonly identifiers: FormDraftMutationIdentifiers;
  readonly payloadJson?: string; readonly payloadFingerprint?: string;
}, unitOfWork: FormDraftUnitOfWork): Promise<Result<FormDraftView, AppError>> => {
  const ownerPersonId = input.context.actor.personId;
  if (!ownerPersonId) return Promise.resolve(err(denied(input.context, 'Form taslağı için kişi bağlı oturum gereklidir.')));
  const resource = validFormKeyAndResource(input.context, input.formKey);
  if (!resource.ok) return Promise.resolve(resource);
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || input.expectedRevision >= 2_147_483_647
    || !operationIdValid(input.clientOperationId) || !identifiersValid(input.identifiers)) {
    return Promise.resolve(err(invalid(input.context, 'Form taslak işlemi eksik veya geçersiz alan içeriyor.')));
  }
  if (input.operation === 'undo' && input.expectedRevision < 2) return Promise.resolve(err(conflict(input.context, 'Geri alma için en az iki kayıtlı revizyon gereklidir.')));
  const action = input.expectedRevision === 0 ? 'create' : 'update';
  return unitOfWork.execute(input.context, intentFor(input.context, ownerPersonId, resource.value, action), (scope) => {
    const replay = scope.findMutationByClientOperationId(input.context.actor.userId, input.formKey, input.clientOperationId);
    if (!replay.ok) return replay;
    if (replay.value) {
      if (!identityIsExact(replay.value, input.context, ownerPersonId, input.formKey, resource.value)
        || !sameReplay(replay.value, input.operation, input.expectedRevision, input.identifiers.requestFingerprint, input.payloadJson, input.operation === 'save' ? input.payloadFingerprint : undefined)) {
        return err(conflict(input.context, 'İşlem kimliği farklı kapsam veya istek içeriğiyle daha önce kullanılmış.'));
      }
      return ok(viewFromMutation(replay.value));
    }
    const current = scope.find(input.context.actor.userId, input.formKey);
    if (!current.ok) return current;
    if (current.value && !identityIsExact(current.value, input.context, ownerPersonId, input.formKey, resource.value)) return err(denied(input.context, 'Form taslağı hesap, aile veya kişi kapsamıyla eşleşmiyor.'));
    if ((current.value?.revision ?? 0) !== input.expectedRevision) return err(conflict(input.context, 'Form taslak revizyonu güncel değil.'));

    let payloadJson = input.payloadJson;
    let payloadFingerprint = input.payloadFingerprint ?? '';
    let restoredFromRevision: number | null = null;
    if (input.operation === 'undo') {
      restoredFromRevision = input.expectedRevision - 1;
      const restored = scope.findMutationByRevision(input.context.actor.userId, input.formKey, restoredFromRevision);
      if (!restored.ok) return restored;
      if (!restored.value || !identityIsExact(restored.value, input.context, ownerPersonId, input.formKey, resource.value)) return err(conflict(input.context, 'Geri alınacak önceki immutable form taslak revizyonu bulunamadı.'));
      payloadJson = restored.value.payloadJson;
      payloadFingerprint = restored.value.payloadFingerprint;
    }
    if (payloadJson === undefined) return err(invalid(input.context, 'Form taslak yükü bulunamadı.'));
    const revision = input.expectedRevision + 1;
    const mutation: FormDraftMutationRow = {
      id: input.identifiers.mutationId, clientOperationId: input.clientOperationId,
      requestFingerprint: input.identifiers.requestFingerprint, familyId: input.context.familyId,
      accountId: input.context.actor.userId, ownerPersonId, formKey: input.formKey, resourceId: resource.value,
      operation: input.operation, previousRevision: input.expectedRevision, revision, payloadJson,
      payloadFingerprint, restoredFromRevision, createdAt: scope.occurredAt
    };
    const row: FormDraftRow = {
      ...viewFromMutation(mutation), familyId: input.context.familyId, accountId: input.context.actor.userId,
      ownerPersonId, createdAt: current.value?.createdAt ?? scope.occurredAt, updatedAt: scope.occurredAt,
      lastMutationId: mutation.id
    };
    const inserted = scope.insertMutation(mutation); if (!inserted.ok) return inserted;
    const saved = scope.saveCurrent(row, input.expectedRevision); if (!saved.ok) return saved;
    if (!saved.value) return err(conflict(input.context, 'Form taslak revizyonu eşzamanlı olarak değişti.'));
    const eventName = input.operation === 'save' ? 'form_draft.saved' : 'form_draft.undone';
    const audited = scope.appendAudit({ id: input.identifiers.auditId, action: eventName, resourceType: 'form_draft', resourceId: resource.value, occurredAt: scope.occurredAt, actorId: input.context.actor.userId });
    if (!audited.ok) return audited;
    const event: DomainEvent<{ readonly revision: number; readonly clientOperationId: string }> = {
      eventId: input.identifiers.outboxEventId, eventType: eventName, eventVersion: 1,
      aggregateType: 'form_draft', aggregateId: resource.value, occurredAt: scope.occurredAt,
      actorId: input.context.actor.userId, correlationId: input.context.correlationId,
      payload: { revision, clientOperationId: input.clientOperationId }
    };
    const enqueued = scope.enqueueEvent(event); if (!enqueued.ok) return enqueued;
    return ok(viewFromRow(row));
  });
};

export class SaveFormDraftUseCase {
  public constructor(private readonly unitOfWork: FormDraftUnitOfWork) {}
  public execute(input: { readonly context: FormDraftApplicationContext; readonly command: SaveFormDraftInput; readonly identifiers: FormDraftMutationIdentifiers }): Promise<Result<FormDraftView, AppError>> {
    const keys = input.command && typeof input.command === 'object' ? Object.keys(input.command).sort() : [];
    if (keys.join(',') !== 'clientOperationId,expectedRevision,formKey,payload') {
      return Promise.resolve(err(invalid(input.context, 'Form taslak kaydı eksik veya fazla alan içeriyor.')));
    }
    let payloadJson: string;
    try { payloadJson = canonicalizeFormDraftPayload(input.command.payload); }
    catch { return Promise.resolve(err(invalid(input.context, 'Form taslak yükü canonical JSON nesnesi olmalı, sınırı aşmamalı ve bankacılık sırrı içermemelidir.'))); }
    return performMutation({ context: input.context, formKey: input.command.formKey, expectedRevision: input.command.expectedRevision, clientOperationId: input.command.clientOperationId, operation: 'save', identifiers: input.identifiers, payloadJson, payloadFingerprint: sha256Hex(payloadJson) }, this.unitOfWork);
  }
}

export class UndoFormDraftUseCase {
  public constructor(private readonly unitOfWork: FormDraftUnitOfWork) {}
  public execute(input: { readonly context: FormDraftApplicationContext; readonly command: UndoFormDraftInput; readonly identifiers: FormDraftMutationIdentifiers }): Promise<Result<FormDraftView, AppError>> {
    const keys = input.command && typeof input.command === 'object' ? Object.keys(input.command).sort() : [];
    if (keys.join(',') !== 'clientOperationId,expectedRevision,formKey') {
      return Promise.resolve(err(invalid(input.context, 'Form taslak geri alma işlemi eksik veya fazla alan içeriyor.')));
    }
    return performMutation({ context: input.context, formKey: input.command.formKey, expectedRevision: input.command.expectedRevision, clientOperationId: input.command.clientOperationId, operation: 'undo', identifiers: input.identifiers }, this.unitOfWork);
  }
}
