import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type EventId,
  type FamilyId,
  type IsoDate,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import type {
  PersonLifecycleOperation,
  PersonLifecycleProfile,
  PersonReferenceSummary,
  PersonLifecycleWorkspaceView,
  UpdatePersonProfileInput
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';

export interface PersonLifecycleApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: { readonly userId: UserId; readonly roles: readonly string[] };
  readonly correlationId: CorrelationId;
}

export interface PersonLifecycleWriteScope {
  readonly occurredAt: IsoDateTime;
  authorizeAdministration(): Result<boolean, AppError>;
  findProfile(personId: PersonId): Result<PersonLifecycleProfile | null, AppError>;
  findPotentialDuplicate(input: {
    readonly familyId: FamilyId;
    readonly displayName: string;
    readonly birthDate?: IsoDate;
    readonly excludePersonId: PersonId;
  }): Result<PersonLifecycleProfile | null, AppError>;
  inspectReferences(personId: PersonId): Result<PersonReferenceSummary, AppError>;
  updateProfile(input: { readonly profile: PersonLifecycleProfile; readonly expectedVersion: number }): Result<boolean, AppError>;
  insertOperation(operation: PersonLifecycleOperation): Result<void, AppError>;
  findOperation(operationId: string): Result<PersonLifecycleOperation | null, AppError>;
  listOperationsByPerson(personId: PersonId): Result<readonly PersonLifecycleOperation[], AppError>;
  markOperationUndone(input: { readonly operationId: string; readonly undoneAt: IsoDateTime }): Result<boolean, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: IsoDateTime;
    readonly actorId: UserId;
  }): Result<string, AppError>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError>;
}

export interface PersonLifecycleUnitOfWork {
  execute<TValue>(
    context: PersonLifecycleApplicationContext,
    operation: (scope: PersonLifecycleWriteScope) => Result<TValue, AppError>
  ): Result<TValue, AppError>;
}

export interface PersonLifecycleIdentifiers {
  readonly operationId: string;
  readonly auditId: string;
  readonly eventId: EventId;
}

const appError = (
  correlationId: CorrelationId,
  code: AppError['code'],
  category: AppError['category'],
  message: string,
  details?: Readonly<Record<string, unknown>>
): AppError => createAppError({ code, category, message, correlationId, ...(details ? { details } : {}) });

const invalid = (context: PersonLifecycleApplicationContext, message: string): AppError =>
  appError(context.correlationId, ERROR_CODES.CORE_INVALID_ARGUMENT, 'validation', message);
const denied = (context: PersonLifecycleApplicationContext): AppError =>
  appError(context.correlationId, ERROR_CODES.AUTHORIZATION_DENIED, 'authorization', 'Kişi yaşam döngüsünü yalnız aile yöneticisi değiştirebilir.');
const missing = (context: PersonLifecycleApplicationContext, message: string): AppError =>
  appError(context.correlationId, ERROR_CODES.RESOURCE_NOT_FOUND, 'not_found', message);
const conflict = (context: PersonLifecycleApplicationContext, message: string, details?: Readonly<Record<string, unknown>>): AppError =>
  appError(context.correlationId, ERROR_CODES.RESOURCE_CONFLICT, 'conflict', message, details);

const isValidIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const emptyReferences = (): PersonReferenceSummary => ({ counts: {}, total: 0 });

const executeAuthorized = <TValue>(
  unitOfWork: PersonLifecycleUnitOfWork,
  context: PersonLifecycleApplicationContext,
  operation: (scope: PersonLifecycleWriteScope) => Result<TValue, AppError>
): Result<TValue, AppError> => unitOfWork.execute(context, (scope) => {
  const authorized = scope.authorizeAdministration();
  if (!authorized.ok) return authorized;
  return authorized.value ? operation(scope) : err(denied(context));
});

const requireProfile = (
  scope: PersonLifecycleWriteScope,
  context: PersonLifecycleApplicationContext,
  personId: PersonId
): Result<PersonLifecycleProfile, AppError> => {
  const found = scope.findProfile(personId);
  if (!found.ok) return found;
  if (!found.value || found.value.familyId !== context.familyId) return err(missing(context, 'Aile kişisi bulunamadı.'));
  return ok(found.value);
};

const persistChange = (
  scope: PersonLifecycleWriteScope,
  context: PersonLifecycleApplicationContext,
  input: {
    readonly before: PersonLifecycleProfile;
    readonly after: PersonLifecycleProfile;
    readonly type: PersonLifecycleOperation['operationType'];
    readonly identifiers: PersonLifecycleIdentifiers;
    readonly references: PersonReferenceSummary;
    readonly reason?: string;
  }
): Result<PersonLifecycleProfile, AppError> => {
  const updated = scope.updateProfile({ profile: input.after, expectedVersion: input.before.lifecycleVersion });
  if (!updated.ok) return updated;
  if (!updated.value) return err(conflict(context, 'Kişi profili başka bir işlem tarafından değiştirildi; güncel sürüm yeniden yüklenmelidir.'));
  const operation: PersonLifecycleOperation = {
    id: input.identifiers.operationId,
    familyId: context.familyId,
    personId: input.before.id,
    operationType: input.type,
    status: 'applied',
    before: input.before,
    after: input.after,
    references: input.references,
    ...(input.reason ? { reason: input.reason } : {}),
    createdAt: scope.occurredAt
  };
  const recorded = scope.insertOperation(operation);
  if (!recorded.ok) return recorded;
  const audited = scope.appendAudit({
    id: input.identifiers.auditId,
    action: `person.${input.type}`,
    resourceType: 'person',
    resourceId: input.before.id,
    occurredAt: scope.occurredAt,
    actorId: context.actor.userId
  });
  if (!audited.ok) return audited;
  const queued = scope.enqueueEvent({
    eventId: input.identifiers.eventId,
    eventType: `family.person.${input.type}`,
    eventVersion: 1,
    aggregateType: 'person',
    aggregateId: input.before.id,
    occurredAt: scope.occurredAt,
    actorId: context.actor.userId,
    correlationId: context.correlationId,
    payload: {
      familyId: context.familyId,
      personId: input.before.id,
      operationId: operation.id,
      lifecycleVersion: input.after.lifecycleVersion,
      referenceCount: input.references.total
    }
  });
  return queued.ok ? ok(input.after) : queued;
};

export class UpdatePersonProfileUseCase {
  public constructor(private readonly unitOfWork: PersonLifecycleUnitOfWork) {}

  public execute(input: {
    readonly context: PersonLifecycleApplicationContext;
    readonly command: UpdatePersonProfileInput;
    readonly identifiers: PersonLifecycleIdentifiers;
  }): Result<PersonLifecycleProfile, AppError> {
    const displayName = input.command.displayName.trim();
    const relationshipType = input.command.relationshipType.trim();
    const branch = input.command.branch.trim();
    if (displayName.length < 2 || displayName.length > 120) return err(invalid(input.context, 'Ad soyad 2 ile 120 karakter arasında olmalıdır.'));
    if (relationshipType.length < 2 || relationshipType.length > 80) return err(invalid(input.context, 'Yakınlık türü 2 ile 80 karakter arasında olmalıdır.'));
    if (branch.length < 2 || branch.length > 120) return err(invalid(input.context, 'Aile dalı 2 ile 120 karakter arasında olmalıdır.'));
    if (!Number.isInteger(input.command.generation) || input.command.generation < 1 || input.command.generation > 20) return err(invalid(input.context, 'Nesil 1 ile 20 arasında olmalıdır.'));
    if (input.command.birthDate && !isValidIsoDate(input.command.birthDate)) return err(invalid(input.context, 'Doğum tarihi geçerli YYYY-AA-GG biçiminde olmalıdır.'));

    return executeAuthorized(this.unitOfWork, input.context, (scope) => {
      const current = requireProfile(scope, input.context, input.command.personId);
      if (!current.ok) return current;
      if (current.value.lifecycleVersion !== input.command.expectedVersion) return err(conflict(input.context, 'Kişi profili sürümü güncel değil.'));
      if (current.value.status === 'merged' || current.value.status === 'pending_deletion') return err(conflict(input.context, 'Birleştirilmiş veya silinmeyi bekleyen profil düzenlenemez.'));
      const duplicate = scope.findPotentialDuplicate({
        familyId: input.context.familyId,
        displayName,
        ...(input.command.birthDate ? { birthDate: input.command.birthDate } : {}),
        excludePersonId: current.value.id
      });
      if (!duplicate.ok) return duplicate;
      if (duplicate.value) return err(conflict(input.context, 'Aynı ad ve doğum tarihine sahip başka bir kişi profili bulundu.', { duplicatePersonId: duplicate.value.id }));
      const references = scope.inspectReferences(current.value.id);
      if (!references.ok) return references;
      const { birthDate: _previousBirthDate, ...profileWithoutBirthDate } = current.value;
      return persistChange(scope, input.context, {
        before: current.value,
        after: {
          ...profileWithoutBirthDate,
          displayName,
          ...(input.command.birthDate ? { birthDate: input.command.birthDate } : {}),
          relationshipType,
          generation: input.command.generation,
          branch,
          lifecycleVersion: current.value.lifecycleVersion + 1,
          updatedAt: scope.occurredAt
        },
        type: 'profile_updated',
        identifiers: input.identifiers,
        references: references.value
      });
    });
  }
}

export class ArchivePersonProfileUseCase {
  public constructor(private readonly unitOfWork: PersonLifecycleUnitOfWork) {}

  public execute(input: {
    readonly context: PersonLifecycleApplicationContext;
    readonly personId: PersonId;
    readonly expectedVersion: number;
    readonly reason: string;
    readonly identifiers: PersonLifecycleIdentifiers;
  }): Result<PersonLifecycleProfile, AppError> {
    const reason = input.reason.trim();
    if (reason.length < 5 || reason.length > 500) return err(invalid(input.context, 'Arşivleme gerekçesi 5 ile 500 karakter arasında olmalıdır.'));
    return executeAuthorized(this.unitOfWork, input.context, (scope) => {
      const current = requireProfile(scope, input.context, input.personId);
      if (!current.ok) return current;
      if (current.value.lifecycleVersion !== input.expectedVersion) return err(conflict(input.context, 'Kişi profili sürümü güncel değil.'));
      if (current.value.status === 'archived') return err(conflict(input.context, 'Kişi profili zaten arşivlenmiş.'));
      if (current.value.status === 'merged' || current.value.status === 'pending_deletion') return err(conflict(input.context, 'Bu kişi profili arşivlenemez.'));
      const references = scope.inspectReferences(current.value.id);
      if (!references.ok) return references;
      return persistChange(scope, input.context, {
        before: current.value,
        after: { ...current.value, status: 'archived', archivedAt: scope.occurredAt, lifecycleVersion: current.value.lifecycleVersion + 1, updatedAt: scope.occurredAt },
        type: 'archived',
        identifiers: input.identifiers,
        references: references.value,
        reason
      });
    });
  }
}

export class MergePersonProfileUseCase {
  public constructor(private readonly unitOfWork: PersonLifecycleUnitOfWork) {}

  public execute(input: {
    readonly context: PersonLifecycleApplicationContext;
    readonly sourcePersonId: PersonId;
    readonly targetPersonId: PersonId;
    readonly expectedSourceVersion: number;
    readonly expectedTargetVersion: number;
    readonly conflictResolution: 'KEEP_TARGET';
    readonly reason: string;
    readonly identifiers: PersonLifecycleIdentifiers;
  }): Result<PersonLifecycleProfile, AppError> {
    const reason = input.reason.trim();
    if (input.sourcePersonId === input.targetPersonId) return err(invalid(input.context, 'Kişi profili kendisiyle birleştirilemez.'));
    if (input.conflictResolution !== 'KEEP_TARGET') return err(invalid(input.context, 'Birleştirme çakışma çözümü açıkça KEEP_TARGET olmalıdır.'));
    if (reason.length < 5 || reason.length > 500) return err(invalid(input.context, 'Birleştirme gerekçesi 5 ile 500 karakter arasında olmalıdır.'));
    return executeAuthorized(this.unitOfWork, input.context, (scope) => {
      const source = requireProfile(scope, input.context, input.sourcePersonId);
      if (!source.ok) return source;
      const target = requireProfile(scope, input.context, input.targetPersonId);
      if (!target.ok) return target;
      if (source.value.lifecycleVersion !== input.expectedSourceVersion || target.value.lifecycleVersion !== input.expectedTargetVersion) return err(conflict(input.context, 'Kaynak veya hedef kişi profili sürümü güncel değil.'));
      if (source.value.status === 'merged' || source.value.status === 'pending_deletion') return err(conflict(input.context, 'Kaynak profil birleştirmeye uygun değil.'));
      if (target.value.status !== 'active') return err(conflict(input.context, 'Birleştirme hedefi etkin bir kişi profili olmalıdır.'));
      const references = scope.inspectReferences(source.value.id);
      if (!references.ok) return references;
      const {
        deletionRequestedAt: _previousDeletionRequestedAt,
        mergedIntoPersonId: _previousMergedIntoPersonId,
        ...mergeSource
      } = source.value;
      return persistChange(scope, input.context, {
        before: source.value,
        after: {
          ...mergeSource,
          status: 'merged',
          mergedIntoPersonId: target.value.id,
          archivedAt: scope.occurredAt,
          lifecycleVersion: source.value.lifecycleVersion + 1,
          updatedAt: scope.occurredAt
        },
        type: 'merged',
        identifiers: input.identifiers,
        references: references.value,
        reason
      });
    });
  }
}

export class RequestSafePersonDeletionUseCase {
  public constructor(private readonly unitOfWork: PersonLifecycleUnitOfWork) {}

  public execute(input: {
    readonly context: PersonLifecycleApplicationContext;
    readonly personId: PersonId;
    readonly expectedVersion: number;
    readonly confirmationText: string;
    readonly reason: string;
    readonly identifiers: PersonLifecycleIdentifiers;
  }): Result<PersonLifecycleProfile, AppError> {
    const reason = input.reason.trim();
    if (reason.length < 5 || reason.length > 500) return err(invalid(input.context, 'Silme gerekçesi 5 ile 500 karakter arasında olmalıdır.'));
    return executeAuthorized(this.unitOfWork, input.context, (scope) => {
      const current = requireProfile(scope, input.context, input.personId);
      if (!current.ok) return current;
      if (current.value.lifecycleVersion !== input.expectedVersion) return err(conflict(input.context, 'Kişi profili sürümü güncel değil.'));
      if (input.confirmationText !== current.value.displayName) return err(invalid(input.context, 'Güvenli silme onayı kişi adıyla birebir eşleşmelidir.'));
      if (current.value.status === 'merged' || current.value.status === 'pending_deletion') return err(conflict(input.context, 'Bu kişi profili silme isteğine uygun değil.'));
      const references = scope.inspectReferences(current.value.id);
      if (!references.ok) return references;
      if (references.value.total > 0) return err(conflict(input.context, 'Referans bütünlüğü nedeniyle kişi güvenli silmeye alınamadı.', { references: references.value.counts, total: references.value.total }));
      const {
        deletionRequestedAt: _previousDeletionRequestedAt,
        mergedIntoPersonId: _previousMergedIntoPersonId,
        ...deletionSource
      } = current.value;
      return persistChange(scope, input.context, {
        before: current.value,
        after: {
          ...deletionSource,
          status: 'pending_deletion',
          deletionRequestedAt: scope.occurredAt,
          archivedAt: scope.occurredAt,
          lifecycleVersion: current.value.lifecycleVersion + 1,
          updatedAt: scope.occurredAt
        },
        type: 'safe_delete_requested',
        identifiers: input.identifiers,
        references: references.value,
        reason
      });
    });
  }
}

export class UndoPersonLifecycleOperationUseCase {
  public constructor(private readonly unitOfWork: PersonLifecycleUnitOfWork) {}

  public execute(input: {
    readonly context: PersonLifecycleApplicationContext;
    readonly operationId: string;
    readonly auditId: string;
    readonly eventId: EventId;
  }): Result<PersonLifecycleProfile, AppError> {
    return executeAuthorized(this.unitOfWork, input.context, (scope) => {
      const operation = scope.findOperation(input.operationId);
      if (!operation.ok) return operation;
      if (!operation.value || operation.value.familyId !== input.context.familyId) return err(missing(input.context, 'Geri alınabilir kişi işlemi bulunamadı.'));
      if (operation.value.status !== 'applied') return err(conflict(input.context, 'Kişi işlemi daha önce geri alınmış.'));
      const current = requireProfile(scope, input.context, operation.value.personId);
      if (!current.ok) return current;
      if (current.value.lifecycleVersion !== operation.value.after.lifecycleVersion) return err(conflict(input.context, 'Bu işlemden sonra kişi profili değiştiği için otomatik geri alma güvenli değil.'));
      const restored: PersonLifecycleProfile = {
        ...operation.value.before,
        lifecycleVersion: current.value.lifecycleVersion + 1,
        updatedAt: scope.occurredAt
      };
      const updated = scope.updateProfile({ profile: restored, expectedVersion: current.value.lifecycleVersion });
      if (!updated.ok) return updated;
      if (!updated.value) return err(conflict(input.context, 'Kişi profili geri alma sırasında değişti.'));
      const marked = scope.markOperationUndone({ operationId: input.operationId, undoneAt: scope.occurredAt });
      if (!marked.ok) return marked;
      if (!marked.value) return err(conflict(input.context, 'Kişi işlemi geri alınmış olarak işaretlenemedi.'));
      const audited = scope.appendAudit({ id: input.auditId, action: 'person.lifecycle_undone', resourceType: 'person', resourceId: restored.id, occurredAt: scope.occurredAt, actorId: input.context.actor.userId });
      if (!audited.ok) return audited;
      const queued = scope.enqueueEvent({
        eventId: input.eventId,
        eventType: 'family.person.lifecycle_undone',
        eventVersion: 1,
        aggregateType: 'person',
        aggregateId: restored.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: { familyId: input.context.familyId, personId: restored.id, operationId: input.operationId, lifecycleVersion: restored.lifecycleVersion }
      });
      return queued.ok ? ok(restored) : queued;
    });
  }
}

export class GetPersonLifecycleHistoryUseCase {
  public constructor(private readonly unitOfWork: PersonLifecycleUnitOfWork) {}

  public execute(context: PersonLifecycleApplicationContext, personId: PersonId): Result<readonly PersonLifecycleOperation[], AppError> {
    return executeAuthorized(this.unitOfWork, context, (scope) => {
      const profile = requireProfile(scope, context, personId);
      if (!profile.ok) return profile;
      return scope.listOperationsByPerson(personId);
    });
  }
}

export class GetPersonLifecycleWorkspaceUseCase {
  public constructor(private readonly unitOfWork: PersonLifecycleUnitOfWork) {}

  public execute(context: PersonLifecycleApplicationContext, personId: PersonId): Result<PersonLifecycleWorkspaceView, AppError> {
    return executeAuthorized(this.unitOfWork, context, (scope) => {
      const profile = requireProfile(scope, context, personId);
      if (!profile.ok) return profile;
      const operations = scope.listOperationsByPerson(personId);
      if (!operations.ok) return operations;
      return ok({ profile: profile.value, operations: operations.value });
    });
  }
}
