import {
  ERROR_CODES,
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
  CreateFamilyLocationInput,
  FamilyLocationView,
  FamilyRole
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';

export interface LocationActorContext {
  readonly userId: UserId;
  readonly role: FamilyRole;
  readonly personId?: PersonId;
}

export interface LocationApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: LocationActorContext;
  readonly correlationId: CorrelationId;
}

export interface LocationPolicyIntent {
  readonly action: 'read' | 'create' | 'delete';
  readonly capability: 'location.read' | 'family.write';
  readonly resourceType: 'location';
  readonly resourceId: string;
  readonly purpose: 'general';
  readonly ownerPersonId?: PersonId;
  readonly sensitivity: 'highly_sensitive';
  /**
   * Internal same-transaction dependency used only when an exact read is
   * authorized before a location created by the same governed batch exists.
   * The completion fence must prove the committed row carries this exact
   * create receipt; otherwise the whole transaction fails closed.
   */
  readonly anticipatedCreate?: Readonly<{
    ownerPersonId: PersonId;
    receiptHash: string;
  }>;
}

export interface LocationApplicationRecord extends FamilyLocationView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly createdAt: IsoDateTime;
}

export interface LocationQueryPort {
  listLocations(context: LocationApplicationContext): Promise<Result<readonly LocationApplicationRecord[], AppError>>;
  findLocation(context: LocationApplicationContext, locationId: string): Promise<Result<LocationApplicationRecord | null, AppError>>;
}

export interface LocationWriteScope {
  readonly occurredAt: IsoDateTime;
  findPerson(personId: PersonId): Result<{
    readonly id: PersonId;
    readonly familyId: FamilyId;
    readonly status: string;
  } | null, AppError>;
  insertLocation(record: LocationApplicationRecord): Result<void, AppError>;
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

export interface LocationUnitOfWork {
  execute<T>(
    context: LocationApplicationContext,
    intent: LocationPolicyIntent,
    operation: (scope: LocationWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

const invalid = (context: LocationApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_INVALID_ARGUMENT,
  message,
  category: 'validation',
  correlationId: context.correlationId
});

const denied = (context: LocationApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message,
  category: 'authorization',
  correlationId: context.correlationId
});

const missing = (context: LocationApplicationContext): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_NOT_FOUND,
  message: 'Konum sahibinin etkin aile üyeliği bulunamadı.',
  category: 'not_found',
  correlationId: context.correlationId
});

const publicView = (record: LocationApplicationRecord): FamilyLocationView => ({
  id: record.id,
  label: record.label,
  ...(record.address ? { address: record.address } : {}),
  ...(record.latitude !== undefined ? { latitude: record.latitude } : {}),
  ...(record.longitude !== undefined ? { longitude: record.longitude } : {}),
  kind: record.kind
});

const locationKinds = new Set<FamilyLocationView['kind']>(['venue', 'residence', 'memory', 'other']);
const locationInputKeys = new Set(['label', 'address', 'latitude', 'longitude', 'kind']);

export class ListFamilyLocationsUseCase {
  public constructor(private readonly query: LocationQueryPort) {}

  public async execute(context: LocationApplicationContext): Promise<Result<readonly FamilyLocationView[], AppError>> {
    const result = await this.query.listLocations(context);
    return result.ok ? ok(result.value.map(publicView)) : result;
  }
}

export class FindFamilyLocationUseCase {
  public constructor(private readonly query: LocationQueryPort) {}

  public async execute(input: {
    readonly context: LocationApplicationContext;
    readonly locationId: string;
  }): Promise<Result<LocationApplicationRecord | null, AppError>> {
    const locationId = input.locationId.trim();
    if (!locationId || locationId.length > 256) return err(invalid(input.context, 'Konum kimliği geçersiz.'));
    return this.query.findLocation(input.context, locationId);
  }
}

export interface CreateGovernedFamilyLocationIdentifiers {
  readonly locationId: string;
  readonly auditId: string;
  readonly outboxEventId: EventId;
}

export class CreateGovernedFamilyLocationUseCase {
  public constructor(private readonly unitOfWork: LocationUnitOfWork) {}

  public execute(input: {
    readonly context: LocationApplicationContext;
    readonly command: CreateFamilyLocationInput;
    readonly identifiers: CreateGovernedFamilyLocationIdentifiers;
  }): Promise<Result<FamilyLocationView, AppError>> {
    if (!input.command || typeof input.command !== 'object' || Array.isArray(input.command)) {
      return Promise.resolve(err(invalid(input.context, 'Konum girdisi geçersiz.')));
    }
    const unknownKeys = Object.keys(input.command).filter((key) => !locationInputKeys.has(key));
    if (unknownKeys.length > 0) {
      return Promise.resolve(err(invalid(input.context, 'Konum girdisi desteklenmeyen alan içeriyor.')));
    }
    if (typeof input.command.label !== 'string' || typeof input.command.kind !== 'string') {
      return Promise.resolve(err(invalid(input.context, 'Konum adı ve türü zorunludur.')));
    }
    const label = input.command.label.trim();
    if (label.length < 2 || label.length > 160) {
      return Promise.resolve(err(invalid(input.context, 'Konum adı 2 ile 160 karakter arasında olmalıdır.')));
    }
    if (!locationKinds.has(input.command.kind)) {
      return Promise.resolve(err(invalid(input.context, 'Konum türü desteklenmiyor.')));
    }
    if (input.command.address !== undefined && typeof input.command.address !== 'string') {
      return Promise.resolve(err(invalid(input.context, 'Konum adresi metin olmalıdır.')));
    }
    const address = input.command.address?.trim();
    if ((address?.length ?? 0) > 500) {
      return Promise.resolve(err(invalid(input.context, 'Konum adresi 500 karakteri aşamaz.')));
    }
    if (
      input.command.latitude !== undefined
      && (typeof input.command.latitude !== 'number' || !Number.isFinite(input.command.latitude)
        || input.command.latitude < -90 || input.command.latitude > 90)
    ) return Promise.resolve(err(invalid(input.context, 'Enlem -90 ile 90 arasında sonlu bir sayı olmalıdır.')));
    if (
      input.command.longitude !== undefined
      && (typeof input.command.longitude !== 'number' || !Number.isFinite(input.command.longitude)
        || input.command.longitude < -180 || input.command.longitude > 180)
    ) return Promise.resolve(err(invalid(input.context, 'Boylam -180 ile 180 arasında sonlu bir sayı olmalıdır.')));
    if (!input.context.actor.personId) {
      return Promise.resolve(err(denied(input.context, 'Konum oluşturmak için etkin kişi üyeliği gereklidir.')));
    }
    const ownerPersonId = asPersonId(input.context.actor.personId);
    const intent: LocationPolicyIntent = {
      action: 'create',
      capability: 'family.write',
      resourceType: 'location',
      resourceId: input.identifiers.locationId,
      purpose: 'general',
      ownerPersonId,
      sensitivity: 'highly_sensitive'
    };
    return this.unitOfWork.execute(input.context, intent, (scope) => {
      const owner = scope.findPerson(ownerPersonId);
      if (!owner.ok) return owner;
      if (!owner.value || owner.value.familyId !== input.context.familyId || owner.value.status !== 'active') {
        return err(missing(input.context));
      }
      const record: LocationApplicationRecord = {
        id: input.identifiers.locationId,
        familyId: input.context.familyId,
        ownerPersonId,
        label,
        ...(address ? { address } : {}),
        ...(input.command.latitude !== undefined ? { latitude: input.command.latitude } : {}),
        ...(input.command.longitude !== undefined ? { longitude: input.command.longitude } : {}),
        kind: input.command.kind,
        createdAt: scope.occurredAt
      };
      const saved = scope.insertLocation(record);
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'location.created',
        resourceType: 'location',
        resourceId: record.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audit.ok) return audit;
      const event = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'location.created',
        eventVersion: 1,
        aggregateType: 'location',
        aggregateId: record.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: { locationId: record.id, kind: record.kind }
      });
      return event.ok ? ok(publicView(record)) : event;
    });
  }
}
