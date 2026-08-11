import {
  ERROR_CODES,
  asIsoDateTime,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type EventId,
  type FamilyId,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import type {
  CreateLifeRecordInput,
  FamilyRole,
  LifeRecordView,
  RecordPrivacy
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type { AuthorizationAction } from '@ppt/security';

export interface LifeActorContext {
  readonly userId: UserId;
  readonly role: FamilyRole;
  readonly personId?: PersonId;
}

export interface LifeApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: LifeActorContext;
  readonly correlationId: CorrelationId;
}

export interface LifePolicyIntent {
  readonly action: 'read' | 'create';
  readonly capability: 'family.read' | 'family.write';
  readonly resourceType: 'life_record';
  readonly resourceId: string;
  readonly purpose: 'general';
  readonly ownerPersonId?: PersonId;
  readonly privacy?: RecordPrivacy;
}

export interface LifeQueryPort {
  listLifeRecords(context: LifeApplicationContext): Promise<Result<readonly LifeRecordView[], AppError>>;
}

export interface LifeWriteScope {
  readonly occurredAt: IsoDateTime;
  findPerson(personId: PersonId): Result<{ readonly id: PersonId } | null, AppError>;
  authorize(input: {
    readonly action: AuthorizationAction;
    readonly resourceType: 'life_record';
    readonly resourceId: string;
    readonly ownerPersonId: PersonId;
    readonly privacy: RecordPrivacy;
  }): Result<boolean, AppError>;
  insertLifeRecord(record: LifeRecordView & {
    readonly familyId: FamilyId;
    readonly ownerPersonId: PersonId;
    readonly startsAt?: IsoDateTime;
    readonly dueAt?: IsoDateTime;
    readonly createdAt: IsoDateTime;
  }): Result<void, AppError>;
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

export interface LifeUnitOfWork {
  execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: LifeWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

const invalid = (context: LifeApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_INVALID_ARGUMENT,
  message,
  category: 'validation',
  correlationId: context.correlationId
});

const denied = (context: LifeApplicationContext): AppError => createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message: 'Bu yaşam kaydı işlemi için yetkiniz bulunmuyor.',
  category: 'authorization',
  correlationId: context.correlationId
});

const missing = (context: LifeApplicationContext): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_NOT_FOUND,
  message: 'Yaşam kaydının bağlanacağı aile üyesi bulunamadı.',
  category: 'not_found',
  correlationId: context.correlationId
});

const normalizeOptionalDate = (
  value: string | undefined,
  context: LifeApplicationContext,
  label: string
): Result<IsoDateTime | undefined, AppError> => {
  if (!value) return ok(undefined);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? err(invalid(context, label + ' geçersiz.'))
    : ok(asIsoDateTime(parsed.toISOString()));
};

export class ListLifeRecordsUseCase {
  public constructor(private readonly query: LifeQueryPort) {}

  public execute(context: LifeApplicationContext): ReturnType<LifeQueryPort['listLifeRecords']> {
    return this.query.listLifeRecords(context);
  }
}

export class CreateLifeRecordUseCase {
  public constructor(private readonly unitOfWork: LifeUnitOfWork) {}

  public execute(input: {
    readonly context: LifeApplicationContext;
    readonly command: CreateLifeRecordInput;
    readonly identifiers: {
      readonly recordId: string;
      readonly auditId: string;
      readonly outboxEventId: EventId;
    };
  }): Promise<Result<LifeRecordView, AppError>> {
    const title = input.command.title.trim();
    if (title.length < 2) {
      return Promise.resolve(err(invalid(input.context, 'Yaşam kaydı başlığı en az 2 karakter olmalıdır.')));
    }
    const starts = normalizeOptionalDate(input.command.startsAt, input.context, 'Başlangıç tarihi');
    if (!starts.ok) return Promise.resolve(starts);
    const due = normalizeOptionalDate(input.command.dueAt, input.context, 'Vade tarihi');
    if (!due.ok) return Promise.resolve(due);
    if (starts.value && due.value && Date.parse(due.value) < Date.parse(starts.value)) {
      return Promise.resolve(err(invalid(input.context, 'Vade tarihi başlangıç tarihinden önce olamaz.')));
    }
    if (
      input.command.amount !== undefined
      && (!Number.isFinite(input.command.amount) || input.command.amount < 0)
    ) {
      return Promise.resolve(err(invalid(input.context, 'Tutar sıfırdan küçük olamaz.')));
    }

    const ownerPersonId = asPersonId(input.command.ownerPersonId);
    const intent: LifePolicyIntent = {
      action: 'create',
      capability: 'family.write',
      resourceType: 'life_record',
      resourceId: input.identifiers.recordId,
      purpose: 'general',
      ownerPersonId,
      privacy: input.command.privacy
    };
    return this.unitOfWork.execute(input.context, intent, (scope) => {
      const person = scope.findPerson(ownerPersonId);
      if (!person.ok) return person;
      if (!person.value) return err(missing(input.context));
      const authorization = scope.authorize({
        action: 'create',
        resourceType: 'life_record',
        resourceId: input.identifiers.recordId,
        ownerPersonId,
        privacy: input.command.privacy
      });
      if (!authorization.ok) return authorization;
      if (!authorization.value) return err(denied(input.context));

      const record: LifeRecordView & {
        readonly familyId: FamilyId;
        readonly ownerPersonId: PersonId;
        readonly startsAt?: IsoDateTime;
        readonly dueAt?: IsoDateTime;
        readonly createdAt: IsoDateTime;
      } = {
        id: input.identifiers.recordId,
        familyId: input.context.familyId,
        ownerPersonId,
        category: input.command.category,
        title,
        status: input.command.status,
        privacy: input.command.privacy,
        ...(starts.value ? { startsAt: starts.value } : {}),
        ...(due.value ? { dueAt: due.value } : {}),
        ...(input.command.provider?.trim() ? { provider: input.command.provider.trim() } : {}),
        ...(input.command.referenceNo?.trim() ? { referenceNo: input.command.referenceNo.trim() } : {}),
        ...(input.command.amount !== undefined ? { amount: input.command.amount } : {}),
        ...(input.command.currency?.trim()
          ? { currency: input.command.currency.trim().toUpperCase() }
          : {}),
        ...(input.command.location?.trim() ? { location: input.command.location.trim() } : {}),
        ...(input.command.notes?.trim() ? { notes: input.command.notes.trim() } : {}),
        createdAt: scope.occurredAt
      };
      const saved = scope.insertLifeRecord(record);
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'life_record.created',
        resourceType: 'life_record',
        resourceId: record.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audit.ok) return audit;
      const event = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'life.record.created',
        eventVersion: 1,
        aggregateType: 'life_record',
        aggregateId: record.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: {
          recordId: record.id,
          ownerPersonId,
          category: record.category,
          status: record.status,
          privacy: record.privacy
        }
      });
      return event.ok ? ok(record) : event;
    });
  }
}
