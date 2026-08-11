import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type EventId,
  type FamilyId,
  type IsoDateTime,
  type Result,
  type UserId
} from '@ppt/core';
import type { DataRepairIssue, DataRepairOperation, DataRepairWorkspaceView } from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';

export interface DataRepairApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: { readonly userId: UserId; readonly roles: readonly string[] };
  readonly correlationId: CorrelationId;
}

export interface DataRepairWriteScope {
  readonly occurredAt: IsoDateTime;
  authorizeAdministration(): Result<boolean, AppError>;
  scanIssues(familyId: FamilyId): Result<readonly DataRepairIssue[], AppError>;
  previewRepair(input: {
    readonly operationId: string;
    readonly familyId: FamilyId;
    readonly issueId: string;
    readonly reason: string;
    readonly createdBy: UserId;
    readonly createdAt: IsoDateTime;
  }): Result<DataRepairOperation | null, AppError>;
  applyRepair(input: {
    readonly operationId: string;
    readonly expectedRevisionToken: string;
    readonly appliedAt: IsoDateTime;
  }): Result<DataRepairOperation | null, AppError>;
  undoRepair(input: {
    readonly operationId: string;
    readonly undoneAt: IsoDateTime;
  }): Result<DataRepairOperation | null, AppError>;
  findOperation(operationId: string): Result<DataRepairOperation | null, AppError>;
  listOperations(familyId: FamilyId): Result<readonly DataRepairOperation[], AppError>;
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

export interface DataRepairUnitOfWork {
  execute<TValue>(
    context: DataRepairApplicationContext,
    operation: (scope: DataRepairWriteScope) => Result<TValue, AppError>
  ): Result<TValue, AppError>;
}

export interface DataRepairIdentifiers {
  readonly operationId: string;
  readonly auditId: string;
  readonly eventId: EventId;
}

export interface DataRepairMutationIdentifiers {
  readonly auditId: string;
  readonly eventId: EventId;
}

const appError = (
  context: DataRepairApplicationContext,
  code: AppError['code'],
  category: AppError['category'],
  message: string,
  details?: Readonly<Record<string, unknown>>
): AppError => createAppError({ code, category, message, correlationId: context.correlationId, ...(details ? { details } : {}) });

const invalid = (context: DataRepairApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.CORE_INVALID_ARGUMENT, 'validation', message);
const denied = (context: DataRepairApplicationContext): AppError =>
  appError(context, ERROR_CODES.AUTHORIZATION_DENIED, 'authorization', 'Veri onarma merkezini yalnız aile yöneticisi kullanabilir.');
const missing = (context: DataRepairApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.RESOURCE_NOT_FOUND, 'not_found', message);
const conflict = (context: DataRepairApplicationContext, message: string, details?: Readonly<Record<string, unknown>>): AppError =>
  appError(context, ERROR_CODES.RESOURCE_CONFLICT, 'conflict', message, details);

const executeAuthorized = <TValue>(
  unitOfWork: DataRepairUnitOfWork,
  context: DataRepairApplicationContext,
  operation: (scope: DataRepairWriteScope) => Result<TValue, AppError>
): Result<TValue, AppError> => unitOfWork.execute(context, (scope) => {
  const authorized = scope.authorizeAdministration();
  if (!authorized.ok) return authorized;
  return authorized.value ? operation(scope) : err(denied(context));
});

const appendEvidence = (
  scope: DataRepairWriteScope,
  context: DataRepairApplicationContext,
  operation: DataRepairOperation,
  phase: 'previewed' | 'applied' | 'undone',
  identifiers: DataRepairMutationIdentifiers
): Result<void, AppError> => {
  const audited = scope.appendAudit({
    id: identifiers.auditId,
    action: `data_repair.${phase}`,
    resourceType: 'data_repair_operation',
    resourceId: operation.id,
    occurredAt: scope.occurredAt,
    actorId: context.actor.userId
  });
  if (!audited.ok) return audited;
  return scope.enqueueEvent({
    eventId: identifiers.eventId,
    eventType: `family.data_repair.${phase}`,
    eventVersion: 1,
    aggregateType: 'data_repair_operation',
    aggregateId: operation.id,
    occurredAt: scope.occurredAt,
    actorId: context.actor.userId,
    correlationId: context.correlationId,
    payload: {
      familyId: context.familyId,
      operationId: operation.id,
      issueId: operation.issueId,
      issueKind: operation.issueKind,
      resolution: operation.resolution,
      status: operation.status
    }
  });
};

export class ScanDataRepairIssuesUseCase {
  public constructor(private readonly unitOfWork: DataRepairUnitOfWork) {}

  public execute(context: DataRepairApplicationContext): Result<readonly DataRepairIssue[], AppError> {
    return executeAuthorized(this.unitOfWork, context, (scope) => scope.scanIssues(context.familyId));
  }
}

export class PreviewDataRepairUseCase {
  public constructor(private readonly unitOfWork: DataRepairUnitOfWork) {}

  public execute(input: {
    readonly context: DataRepairApplicationContext;
    readonly issueId: string;
    readonly reason: string;
    readonly identifiers: DataRepairIdentifiers;
  }): Result<DataRepairOperation, AppError> {
    const issueId = input.issueId.trim();
    const reason = input.reason.trim();
    if (issueId.length < 3 || issueId.length > 240) return err(invalid(input.context, 'Onarılacak sorun kimliği geçersiz.'));
    if (reason.length < 5 || reason.length > 500) return err(invalid(input.context, 'Onarma gerekçesi 5 ile 500 karakter arasında olmalıdır.'));
    return executeAuthorized(this.unitOfWork, input.context, (scope) => {
      const preview = scope.previewRepair({
        operationId: input.identifiers.operationId,
        familyId: input.context.familyId,
        issueId,
        reason,
        createdBy: input.context.actor.userId,
        createdAt: scope.occurredAt
      });
      if (!preview.ok) return preview;
      if (!preview.value) return err(conflict(input.context, 'Sorun artık mevcut değil, değişti veya güvenli otomatik onarmaya uygun değil.'));
      const evidence = appendEvidence(scope, input.context, preview.value, 'previewed', input.identifiers);
      return evidence.ok ? ok(preview.value) : evidence;
    });
  }
}

export class ApplyDataRepairUseCase {
  public constructor(private readonly unitOfWork: DataRepairUnitOfWork) {}

  public execute(input: {
    readonly context: DataRepairApplicationContext;
    readonly operationId: string;
    readonly expectedRevisionToken: string;
    readonly identifiers: DataRepairMutationIdentifiers;
  }): Result<DataRepairOperation, AppError> {
    if (!input.operationId.trim() || !input.expectedRevisionToken) return err(invalid(input.context, 'Onarma işlemi ve önizleme sürümü zorunludur.'));
    return executeAuthorized(this.unitOfWork, input.context, (scope) => {
      const existing = scope.findOperation(input.operationId);
      if (!existing.ok) return existing;
      if (!existing.value || existing.value.familyId !== input.context.familyId) return err(missing(input.context, 'Onarma önizlemesi bulunamadı.'));
      if (existing.value.status !== 'previewed') return err(conflict(input.context, 'Yalnız bekleyen bir önizleme uygulanabilir.'));
      if (existing.value.revisionToken !== input.expectedRevisionToken) return err(conflict(input.context, 'Onarma önizleme sürümü uyuşmuyor.'));
      const applied = scope.applyRepair({ operationId: input.operationId, expectedRevisionToken: input.expectedRevisionToken, appliedAt: scope.occurredAt });
      if (!applied.ok) return applied;
      if (!applied.value) return err(conflict(input.context, 'Veri önizlemeden sonra değişti; güvenli onarma için yeniden tarama ve önizleme gerekir.'));
      const evidence = appendEvidence(scope, input.context, applied.value, 'applied', input.identifiers);
      return evidence.ok ? ok(applied.value) : evidence;
    });
  }
}

export class UndoDataRepairUseCase {
  public constructor(private readonly unitOfWork: DataRepairUnitOfWork) {}

  public execute(input: {
    readonly context: DataRepairApplicationContext;
    readonly operationId: string;
    readonly identifiers: DataRepairMutationIdentifiers;
  }): Result<DataRepairOperation, AppError> {
    if (!input.operationId.trim()) return err(invalid(input.context, 'Geri alınacak onarma işlemi zorunludur.'));
    return executeAuthorized(this.unitOfWork, input.context, (scope) => {
      const existing = scope.findOperation(input.operationId);
      if (!existing.ok) return existing;
      if (!existing.value || existing.value.familyId !== input.context.familyId) return err(missing(input.context, 'Geri alınabilir onarma işlemi bulunamadı.'));
      if (existing.value.status !== 'applied') return err(conflict(input.context, 'Yalnız uygulanmış ve daha önce geri alınmamış bir onarma geri alınabilir.'));
      const undone = scope.undoRepair({ operationId: input.operationId, undoneAt: scope.occurredAt });
      if (!undone.ok) return undone;
      if (!undone.value) return err(conflict(input.context, 'Onarılan veri sonradan değişti veya bağımlılıklar geri yüklemeye uygun değil; işlem fail-closed durduruldu.'));
      const evidence = appendEvidence(scope, input.context, undone.value, 'undone', input.identifiers);
      return evidence.ok ? ok(undone.value) : evidence;
    });
  }
}

export class GetDataRepairWorkspaceUseCase {
  public constructor(private readonly unitOfWork: DataRepairUnitOfWork) {}

  public execute(context: DataRepairApplicationContext): Result<DataRepairWorkspaceView, AppError> {
    return executeAuthorized(this.unitOfWork, context, (scope) => {
      const issues = scope.scanIssues(context.familyId);
      if (!issues.ok) return issues;
      const operations = scope.listOperations(context.familyId);
      return operations.ok ? ok({ issues: issues.value, operations: operations.value }) : operations;
    });
  }
}
