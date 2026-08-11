import { ERROR_CODES, createAppError, err, ok, type AppError, type CorrelationId, type FamilyId, type IsoDateTime, type Result, type UserId } from '@ppt/core';

export interface BootstrapSeedData {
  readonly family: { readonly id: FamilyId; readonly name: string };
  readonly people: readonly { readonly id: string; readonly displayName: string; readonly birthDate?: string; readonly relationshipType: string; readonly generation: number; readonly branch: string }[];
  readonly relations: readonly { readonly id: string; readonly fromPersonId: string; readonly toPersonId: string; readonly relationType: string }[];
  readonly locations: readonly { readonly id: string; readonly label: string; readonly address?: string; readonly latitude?: number; readonly longitude?: number; readonly kind: string }[];
  readonly events: readonly { readonly id: string; readonly kind: string; readonly title: string; readonly description?: string; readonly startAt: string; readonly locationId?: string; readonly locationLabel?: string; readonly visibility: string; readonly participantPersonIds: readonly string[]; readonly invitationText?: string; readonly notes?: string; readonly attachmentCount: number; readonly aiProcessingAllowed: boolean; readonly recurrence: string; readonly reminderDays: readonly number[] }[];
}

type BootstrapSeedEvent = BootstrapSeedData['events'][number];
export type BootstrapPersistableSeedData = Omit<BootstrapSeedData, 'locations' | 'events'> & {
  readonly events: readonly Omit<BootstrapSeedEvent, 'locationId'>[];
};

export interface BootstrapApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: { readonly userId: UserId; readonly roles: readonly string[] };
  readonly correlationId: CorrelationId;
}

export interface BootstrapWriteScope {
  readonly occurredAt: IsoDateTime;
  seedIfEmpty(seed: BootstrapPersistableSeedData): Result<boolean, AppError>;
  appendAudit(input: {
    readonly id: string; readonly action: string; readonly resourceType: string;
    readonly resourceId: string; readonly occurredAt: IsoDateTime; readonly actorId: UserId;
  }): Result<string, AppError>;
}

export interface BootstrapApplicationUnitOfWork {
  execute<TValue>(context: BootstrapApplicationContext, operation: (scope: BootstrapWriteScope) => Result<TValue, AppError>): Result<TValue, AppError>;
}

export class SeedDefaultFamilyUseCase {
  public constructor(private readonly unitOfWork: BootstrapApplicationUnitOfWork) {}

  public execute(input: {
    readonly context: BootstrapApplicationContext;
    readonly seed: BootstrapSeedData;
    readonly auditId: string;
  }): Result<boolean, AppError> {
    if (input.seed.locations.length > 0 || input.seed.events.some((event) => event.locationId !== undefined)) {
      return err(createAppError({
        code: ERROR_CODES.CORE_INVALID_ARGUMENT,
        message: 'Bootstrap konum kaydı oluşturamaz; konumlar governed oluşturma işlemiyle eklenmelidir.',
        category: 'validation',
        correlationId: input.context.correlationId,
        details: { boundary: 'locationBootstrapWriteBypass', status: 'FAIL_CLOSED' }
      }));
    }
    const { locations: _rejectedLocations, events, ...seedWithoutLocations } = input.seed;
    const persistableSeed: BootstrapPersistableSeedData = {
      ...seedWithoutLocations,
      events: events.map(({ locationId: _rejectedLocationId, ...event }) => event)
    };
    return this.unitOfWork.execute(input.context, (scope) => {
      const seeded = scope.seedIfEmpty(persistableSeed);
      if (!seeded.ok || !seeded.value) return seeded;
      const audit = scope.appendAudit({
        id: input.auditId,
        action: 'database.seeded',
        resourceType: 'family',
        resourceId: input.seed.family.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      return audit.ok ? ok(true) : audit;
    });
  }
}
