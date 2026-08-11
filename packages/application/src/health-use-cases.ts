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
  CreateFamilyHealthHistoryInput,
  CreateHealthRecordInput,
  CreateMedicationPlanInput,
  FamilyHealthHistoryView,
  FamilyRole,
  HealthRecordView,
  MedicationPlanView,
  RecordPrivacy
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type { AuthorizationAction } from '@ppt/security';

export interface HealthActorContext {
  readonly userId: UserId;
  readonly role: FamilyRole;
  readonly personId?: PersonId;
}

export interface HealthApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: HealthActorContext;
  readonly correlationId: CorrelationId;
}

export interface HealthPolicyIntent {
  readonly action: 'read' | 'create';
  readonly capability: 'health.read' | 'health.write';
  readonly resourceType: 'health_record' | 'medication_plan' | 'family_health_history';
  readonly resourceId: string;
  readonly purpose: 'health';
  readonly ownerPersonId?: PersonId;
  readonly privacy?: RecordPrivacy;
}

export interface HealthQueryPort {
  listHealthRecords(context: HealthApplicationContext): Promise<Result<readonly HealthRecordView[], AppError>>;
  listMedicationPlans(context: HealthApplicationContext): Promise<Result<readonly MedicationPlanView[], AppError>>;
  listFamilyHealthHistory(context: HealthApplicationContext): Promise<Result<readonly FamilyHealthHistoryView[], AppError>>;
}

export interface HealthWriteScope {
  readonly occurredAt: IsoDateTime;
  findPerson(personId: PersonId): Result<{ readonly id: PersonId } | null, AppError>;
  authorize(input: {
    readonly action: AuthorizationAction;
    readonly resourceType: 'health_record' | 'medication_plan' | 'family_health_history';
    readonly resourceId: string;
    readonly ownerPersonId: PersonId;
    readonly privacy: RecordPrivacy;
  }): Result<boolean, AppError>;
  insertHealthRecord(record: HealthRecordView & { readonly familyId: FamilyId; readonly ownerPersonId: PersonId; readonly occurredAt: IsoDateTime; readonly createdAt: IsoDateTime }): Result<void, AppError>;
  insertMedicationPlan(plan: MedicationPlanView & { readonly familyId: FamilyId; readonly ownerPersonId: PersonId; readonly startsAt: IsoDateTime; readonly endsAt?: IsoDateTime; readonly createdAt: IsoDateTime }): Result<void, AppError>;
  insertFamilyHealthHistory(record: FamilyHealthHistoryView & { readonly familyId: FamilyId; readonly relatedPersonId: PersonId; readonly diagnosedAt?: IsoDateTime; readonly createdAt: IsoDateTime }): Result<void, AppError>;
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

export interface HealthUnitOfWork {
  execute<T>(
    context: HealthApplicationContext,
    intent: HealthPolicyIntent,
    operation: (scope: HealthWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

export interface HealthIdentifiers {
  readonly recordId: string;
  readonly auditId: string;
  readonly outboxEventId: EventId;
}

const invalid = (context: HealthApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_INVALID_ARGUMENT,
  message,
  category: 'validation',
  correlationId: context.correlationId
});

const denied = (context: HealthApplicationContext): AppError => createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message: 'Bu sağlık işlemi için yetkiniz bulunmuyor.',
  category: 'authorization',
  correlationId: context.correlationId
});

const notFound = (context: HealthApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_NOT_FOUND,
  message,
  category: 'not_found',
  correlationId: context.correlationId
});

const normalizeDateTime = (
  value: string,
  context: HealthApplicationContext,
  fieldLabel: string
): Result<IsoDateTime, AppError> => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? err(invalid(context, `${fieldLabel} geçersiz.`))
    : ok(asIsoDateTime(parsed.toISOString()));
};

const requirePerson = (
  scope: HealthWriteScope,
  context: HealthApplicationContext,
  personId: PersonId
): Result<void, AppError> => {
  const person = scope.findPerson(personId);
  if (!person.ok) return person;
  return person.value ? ok(undefined) : err(notFound(context, 'Sağlık kaydının bağlanacağı aile üyesi bulunamadı.'));
};

const requireCreate = (
  scope: HealthWriteScope,
  context: HealthApplicationContext,
  resourceType: 'health_record' | 'medication_plan' | 'family_health_history',
  ownerPersonId: PersonId,
  privacy: RecordPrivacy
): Result<void, AppError> => {
  const decision = scope.authorize({ action: 'create', resourceType, resourceId: '*', ownerPersonId, privacy });
  if (!decision.ok) return decision;
  return decision.value ? ok(undefined) : err(denied(context));
};

export class ListHealthRecordsUseCase {
  public constructor(private readonly query: HealthQueryPort) {}
  public execute(context: HealthApplicationContext): Promise<Result<readonly HealthRecordView[], AppError>> {
    return this.query.listHealthRecords(context);
  }
}

export class ListMedicationPlansUseCase {
  public constructor(private readonly query: HealthQueryPort) {}
  public execute(context: HealthApplicationContext): Promise<Result<readonly MedicationPlanView[], AppError>> {
    return this.query.listMedicationPlans(context);
  }
}

export class ListFamilyHealthHistoryUseCase {
  public constructor(private readonly query: HealthQueryPort) {}
  public execute(context: HealthApplicationContext): Promise<Result<readonly FamilyHealthHistoryView[], AppError>> {
    return this.query.listFamilyHealthHistory(context);
  }
}

export class CreateHealthRecordUseCase {
  public constructor(private readonly unitOfWork: HealthUnitOfWork) {}
  public async execute(input: {
    readonly context: HealthApplicationContext;
    readonly command: CreateHealthRecordInput;
    readonly identifiers: HealthIdentifiers;
  }): Promise<Result<HealthRecordView, AppError>> {
    const title = input.command.title.trim();
    if (title.length < 2) return err(invalid(input.context, 'Sağlık kaydı başlığı en az 2 karakter olmalıdır.'));
    const occurredAt = normalizeDateTime(input.command.occurredAt, input.context, 'Sağlık kaydı tarihi');
    if (!occurredAt.ok) return occurredAt;
    const ownerPersonId = asPersonId(input.command.ownerPersonId);
    const intent: HealthPolicyIntent = {
      action: 'create',
      capability: 'health.write',
      resourceType: 'health_record',
      resourceId: input.identifiers.recordId,
      purpose: 'health',
      ownerPersonId,
      privacy: input.command.privacy
    };
    return this.unitOfWork.execute(input.context, intent, (scope) => {
      const person = requirePerson(scope, input.context, ownerPersonId);
      if (!person.ok) return person;
      const authorization = requireCreate(scope, input.context, 'health_record', ownerPersonId, input.command.privacy);
      if (!authorization.ok) return authorization;
      const record: HealthRecordView & { readonly familyId: FamilyId; readonly ownerPersonId: PersonId; readonly occurredAt: IsoDateTime; readonly createdAt: IsoDateTime } = {
        id: input.identifiers.recordId,
        familyId: input.context.familyId,
        ownerPersonId,
        title,
        kind: input.command.kind,
        privacy: input.command.privacy,
        ...(input.command.provider?.trim() ? { provider: input.command.provider.trim() } : {}),
        ...(input.command.notes?.trim() ? { notes: input.command.notes.trim() } : {}),
        occurredAt: occurredAt.value,
        createdAt: scope.occurredAt
      };
      const saved = scope.insertHealthRecord(record);
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'health.created',
        resourceType: 'health_record',
        resourceId: record.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audit.ok) return audit;
      const event = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'health.record.created',
        eventVersion: 1,
        aggregateType: 'health_record',
        aggregateId: record.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: {
          recordId: record.id,
          ownerPersonId,
          kind: record.kind,
          occurredAt: record.occurredAt,
          privacy: record.privacy
        }
      });
      return event.ok ? ok(record) : event;
    });
  }
}

export class CreateMedicationPlanUseCase {
  public constructor(private readonly unitOfWork: HealthUnitOfWork) {}
  public async execute(input: {
    readonly context: HealthApplicationContext;
    readonly command: CreateMedicationPlanInput;
    readonly identifiers: HealthIdentifiers;
  }): Promise<Result<MedicationPlanView, AppError>> {
    const name = input.command.name.trim();
    const dosage = input.command.dosage.trim();
    const schedule = input.command.schedule.trim();
    if (name.length < 2 || !dosage || !schedule) {
      return err(invalid(input.context, 'İlaç adı, doz ve kullanım planı zorunludur.'));
    }
    const startsAt = normalizeDateTime(input.command.startsAt, input.context, 'İlaç başlangıç tarihi');
    if (!startsAt.ok) return startsAt;
    const endsAt = input.command.endsAt
      ? normalizeDateTime(input.command.endsAt, input.context, 'İlaç bitiş tarihi')
      : undefined;
    if (endsAt && !endsAt.ok) return endsAt;
    if (endsAt && Date.parse(endsAt.value) < Date.parse(startsAt.value)) {
      return err(invalid(input.context, 'İlaç bitiş tarihi başlangıçtan önce olamaz.'));
    }
    const ownerPersonId = asPersonId(input.command.ownerPersonId);
    const intent: HealthPolicyIntent = {
      action: 'create',
      capability: 'health.write',
      resourceType: 'medication_plan',
      resourceId: input.identifiers.recordId,
      purpose: 'health',
      ownerPersonId,
      privacy: input.command.privacy
    };
    return this.unitOfWork.execute(input.context, intent, (scope) => {
      const person = requirePerson(scope, input.context, ownerPersonId);
      if (!person.ok) return person;
      const authorization = requireCreate(scope, input.context, 'medication_plan', ownerPersonId, input.command.privacy);
      if (!authorization.ok) return authorization;
      const plan: MedicationPlanView & { readonly familyId: FamilyId; readonly ownerPersonId: PersonId; readonly startsAt: IsoDateTime; readonly endsAt?: IsoDateTime; readonly createdAt: IsoDateTime } = {
        id: input.identifiers.recordId,
        familyId: input.context.familyId,
        ownerPersonId,
        name,
        dosage,
        schedule,
        ...(input.command.provider?.trim() ? { provider: input.command.provider.trim() } : {}),
        startsAt: startsAt.value,
        ...(endsAt?.ok ? { endsAt: endsAt.value } : {}),
        privacy: input.command.privacy,
        ...(input.command.notes?.trim() ? { notes: input.command.notes.trim() } : {}),
        createdAt: scope.occurredAt
      };
      const saved = scope.insertMedicationPlan(plan);
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'medication.created',
        resourceType: 'medication_plan',
        resourceId: plan.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audit.ok) return audit;
      const event = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'health.medication_plan.created',
        eventVersion: 1,
        aggregateType: 'medication_plan',
        aggregateId: plan.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: {
          medicationPlanId: plan.id,
          ownerPersonId,
          startsAt: plan.startsAt,
          endsAt: plan.endsAt ?? null,
          privacy: plan.privacy
        }
      });
      return event.ok ? ok(plan) : event;
    });
  }
}

export class CreateFamilyHealthHistoryUseCase {
  public constructor(private readonly unitOfWork: HealthUnitOfWork) {}
  public async execute(input: {
    readonly context: HealthApplicationContext;
    readonly command: CreateFamilyHealthHistoryInput;
    readonly identifiers: HealthIdentifiers;
  }): Promise<Result<FamilyHealthHistoryView, AppError>> {
    const condition = input.command.condition.trim();
    if (condition.length < 2) return err(invalid(input.context, 'Aile sağlık geçmişi durumu en az 2 karakter olmalıdır.'));
    const diagnosedAt = input.command.diagnosedAt
      ? normalizeDateTime(input.command.diagnosedAt, input.context, 'Tanı tarihi')
      : undefined;
    if (diagnosedAt && !diagnosedAt.ok) return diagnosedAt;
    const relatedPersonId = asPersonId(input.command.relatedPersonId);
    const intent: HealthPolicyIntent = {
      action: 'create',
      capability: 'health.write',
      resourceType: 'family_health_history',
      resourceId: input.identifiers.recordId,
      purpose: 'health',
      ownerPersonId: relatedPersonId,
      privacy: input.command.privacy
    };
    return this.unitOfWork.execute(input.context, intent, (scope) => {
      const person = requirePerson(scope, input.context, relatedPersonId);
      if (!person.ok) return person;
      const authorization = requireCreate(scope, input.context, 'family_health_history', relatedPersonId, input.command.privacy);
      if (!authorization.ok) return authorization;
      const record: FamilyHealthHistoryView & { readonly familyId: FamilyId; readonly relatedPersonId: PersonId; readonly diagnosedAt?: IsoDateTime; readonly createdAt: IsoDateTime } = {
        id: input.identifiers.recordId,
        familyId: input.context.familyId,
        relatedPersonId,
        condition,
        ...(input.command.relationshipNote?.trim() ? { relationshipNote: input.command.relationshipNote.trim() } : {}),
        ...(diagnosedAt?.ok ? { diagnosedAt: diagnosedAt.value } : {}),
        privacy: input.command.privacy,
        ...(input.command.notes?.trim() ? { notes: input.command.notes.trim() } : {}),
        createdAt: scope.occurredAt
      };
      const saved = scope.insertFamilyHealthHistory(record);
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'health_history.created',
        resourceType: 'family_health_history',
        resourceId: record.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audit.ok) return audit;
      const event = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'health.family_history.created',
        eventVersion: 1,
        aggregateType: 'family_health_history',
        aggregateId: record.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: {
          familyHealthHistoryId: record.id,
          relatedPersonId,
          diagnosedAt: record.diagnosedAt ?? null,
          privacy: record.privacy
        }
      });
      return event.ok ? ok(record) : event;
    });
  }
}
