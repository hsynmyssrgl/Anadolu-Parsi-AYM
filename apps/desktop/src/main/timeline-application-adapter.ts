import {
  ERROR_CODES,
  asCorrelationId,
  asPersonId,
  asUserId,
  createAppError,
  err,
  ok,
  type AppError,
  type EventId,
  type IsoDateTime,
  type Result
} from '@ppt/core';
import type {
  LocationApplicationContext,
  TimelineApplicationContext,
  TimelineApplicationUnitOfWork,
  TimelineEventRecord,
  TimelineLocationRecord,
  TimelinePolicyIntent,
  TimelineQueryPort,
  TimelineUnitOfWorkOptions,
  TimelineWriteScope
} from '@ppt/application';
import type { DomainEvent } from '@ppt/events';
import { computePlatformPolicyReceiptHash } from '@ppt/repositories';
import { isAuthorizationRole } from '@ppt/security';
import {
  PlatformPolicyEnforcementError,
  assertActivePlatformPolicyTransactionContext,
  type PlatformPolicyClusterFence,
  type PlatformPolicyEnforcementPoint,
  type PlatformPolicyTransactionContext
} from '@ppt/platform-policy';
import type {
  AuditRepositoryPort,
  FamilyRepositoryPort,
  LocationRepositoryPort,
  NotificationStateRepositoryPort,
  OutboxRepositoryPort,
  PersonRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  TimelineRepositoryPort,
  TransactionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';
import {
  RepositoryBackedLocationPolicyTransactionRunner,
  locationCollectionReadIntent,
  locationExactReadIntent
} from './location-application-adapter.js';

export interface TimelinePolicyTransactionRevalidationInput {
  readonly context: TimelineApplicationContext;
  readonly intent: TimelinePolicyIntent;
  readonly authorization: PlatformPolicyTransactionContext;
  readonly transaction: TransactionContext;
}

export interface TimelinePolicyCommittedTransactionInput {
  readonly context: TimelineApplicationContext;
  readonly intent: TimelinePolicyIntent;
  readonly authorization: PlatformPolicyTransactionContext;
}

export type TimelinePolicyEnforcementPoint = Pick<PlatformPolicyEnforcementPoint, 'execute'> & {
  readonly requiresTransactionRevalidation?: true;
  readonly revalidateTransaction?: (
    input: TimelinePolicyTransactionRevalidationInput
  ) => Result<void, AppError>;
  readonly requiresDurableTransactionReceipt?: true;
  readonly recordAuthorizedTransaction?: (
    input: TimelinePolicyTransactionRevalidationInput
  ) => Result<void, AppError>;
  readonly projectCommittedTransaction?: (
    input: TimelinePolicyCommittedTransactionInput
  ) => Promise<Result<void, AppError>> | Result<void, AppError>;
};

export interface TimelinePolicyEnforcementPointResolver {
  resolve(
    context: TimelineApplicationContext,
    intent: TimelinePolicyIntent
  ): TimelinePolicyEnforcementPoint | Promise<TimelinePolicyEnforcementPoint>;
}

export interface RepositoryBackedTimelineApplicationDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly familyRepository: FamilyRepositoryPort;
  readonly personRepository: PersonRepositoryPort;
  readonly locationRepository: LocationRepositoryPort;
  readonly timelineRepository: TimelineRepositoryPort;
  readonly notificationStateRepository: NotificationStateRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly outboxRepository: OutboxRepositoryPort;
  readonly locationPolicyTransactionRunner: RepositoryBackedLocationPolicyTransactionRunner;
  readonly policyEnforcementPointResolver: TimelinePolicyEnforcementPointResolver;
  readonly clusterFence: PlatformPolicyClusterFence;
}

export const failClosedTimelinePolicyEnforcementPointResolver: TimelinePolicyEnforcementPointResolver = Object.freeze({
  resolve(): never {
    throw new PlatformPolicyEnforcementError(
      'ENFORCEMENT_UNAVAILABLE',
      'Timeline event policy enforcement is not composed for this process'
    );
  }
});

export const nonWritableTimelineClusterFence: PlatformPolicyClusterFence = () => Object.freeze({
  writable: false,
  epoch: 0
});

const repositoryContext = (
  context: TimelineApplicationContext,
  transaction: TransactionContext
): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: context.actor,
  correlationId: context.correlationId,
  occurredAt: transaction.occurredAt
});

const governedRepositoryContext = (
  context: TimelineApplicationContext,
  transaction: TransactionContext,
  authorization: PlatformPolicyTransactionContext,
  intent: TimelinePolicyIntent
): PolicyAuthorizedRepositoryExecutionContext => {
  assertActivePlatformPolicyTransactionContext(authorization, {
    resourceType: intent.resourceType,
    resourceId: intent.resourceId,
    action: intent.action,
    capability: intent.capability,
    correlationId: context.correlationId,
    resourceFamilyId: context.familyId,
    fenceEpoch: authorization.fenceEpoch,
    fenceWritable: authorization.fenceWritable
  });
  if (
    authorization.subject.accountId !== context.actor.userId
    || authorization.resourceFamilyId !== context.familyId
    || authorization.subject.personId !== context.actor.personId
  ) {
    throw new PlatformPolicyEnforcementError(
      'TRANSACTION_CONTEXT_MISMATCH',
      'Trusted policy subject or family does not match the timeline application boundary'
    );
  }
  return {
    transaction: transaction.transaction,
    actor: {
      userId: asUserId(authorization.subject.accountId),
      roles: authorization.subject.roles,
      ...(authorization.subject.personId
        ? { personId: asPersonId(authorization.subject.personId) }
        : {})
    },
    correlationId: context.correlationId,
    occurredAt: transaction.occurredAt,
    policyAuthorization: authorization
  };
};

const policyFailure = (
  context: TimelineApplicationContext,
  error: unknown
): Result<never, AppError> => {
  const enforcementCode = error instanceof PlatformPolicyEnforcementError
    ? error.code
    : 'ENFORCEMENT_UNAVAILABLE';
  const message = error instanceof Error ? error.message : 'Timeline event policy enforcement is unavailable';
  return err(createAppError({
    code: ERROR_CODES.AUTHORIZATION_DENIED,
    message: `Zaman tüneli işlemi merkezi politika tarafından güvenli biçimde durduruldu: ${message}`,
    category: enforcementCode === 'POLICY_DENIED' ? 'authorization' : 'security',
    correlationId: context.correlationId,
    details: { enforcementCode }
  }));
};

const establishGovernedTransaction = (
  enforcementPoint: TimelinePolicyEnforcementPoint,
  input: TimelinePolicyTransactionRevalidationInput
): Result<void, AppError> => {
  const revalidation = enforcementPoint.revalidateTransaction?.(input);
  if (revalidation && !revalidation.ok) return revalidation;
  const recorded = enforcementPoint.recordAuthorizedTransaction?.(input);
  return recorded && !recorded.ok ? recorded : ok(undefined);
};

const executeGoverned = async <T>(
  dependencies: RepositoryBackedTimelineApplicationDependencies,
  context: TimelineApplicationContext,
  intent: TimelinePolicyIntent,
  operation: (
    authorization: PlatformPolicyTransactionContext,
    enforcementPoint: TimelinePolicyEnforcementPoint
  ) => Result<T, AppError> | Promise<Result<T, AppError>>
): Promise<Result<T, AppError>> => {
  try {
    const enforcementPoint = await dependencies.policyEnforcementPointResolver.resolve(context, intent);
    if (!enforcementPoint || typeof enforcementPoint.execute !== 'function') {
      throw new PlatformPolicyEnforcementError('ENFORCEMENT_UNAVAILABLE', 'Timeline Policy Enforcement Point is missing');
    }
    if (
      enforcementPoint.requiresTransactionRevalidation === true
      && typeof enforcementPoint.revalidateTransaction !== 'function'
    ) throw new PlatformPolicyEnforcementError('ENFORCEMENT_UNAVAILABLE', 'Timeline policy transaction revalidation is missing');
    if (
      enforcementPoint.requiresDurableTransactionReceipt === true
      && (
        typeof enforcementPoint.recordAuthorizedTransaction !== 'function'
        || typeof enforcementPoint.projectCommittedTransaction !== 'function'
      )
    ) throw new PlatformPolicyEnforcementError('ENFORCEMENT_UNAVAILABLE', 'Timeline durable policy receipt boundary is incomplete');

    let committedAuthorization: PlatformPolicyTransactionContext | undefined;
    const result = await enforcementPoint.execute(
      {
        correlationId: context.correlationId,
        action: intent.action,
        capability: intent.capability,
        resourceType: intent.resourceType,
        resourceId: intent.resourceId,
        purpose: intent.purpose
      },
      dependencies.clusterFence,
      async (authorization) => {
        assertActivePlatformPolicyTransactionContext(authorization, {
          resourceType: intent.resourceType,
          resourceId: intent.resourceId,
          action: intent.action,
          capability: intent.capability,
          correlationId: context.correlationId,
          resourceFamilyId: context.familyId,
          fenceEpoch: authorization.fenceEpoch,
          fenceWritable: authorization.fenceWritable
        });
        if (
          authorization.subject.accountId !== context.actor.userId
          || authorization.subject.personId !== context.actor.personId
          || authorization.resourceFamilyId !== context.familyId
        ) throw new PlatformPolicyEnforcementError('TRANSACTION_CONTEXT_MISMATCH', 'Timeline policy subject or family changed');
        const operationResult = await operation(authorization, enforcementPoint);
        if (operationResult.ok) committedAuthorization = authorization;
        return operationResult;
      }
    );
    if (result.ok && committedAuthorization && enforcementPoint.requiresDurableTransactionReceipt === true) {
      const projection = await enforcementPoint.projectCommittedTransaction!({
        context,
        intent,
        authorization: committedAuthorization
      });
      if (!projection.ok) {
        const committed = projection.error.details?.businessTransactionCommitted === true;
        const pending = projection.error.details?.durableProjectionPending === true;
        if (!committed || !pending) return projection;
      }
    }
    return result;
  } catch (error) {
    return policyFailure(context, error);
  }
};

export interface GovernedTimelinePolicyTransactionScope {
  readonly repository: PolicyAuthorizedRepositoryExecutionContext;
  readonly occurredAt: IsoDateTime;
  readonly authorization: PlatformPolicyTransactionContext;
}

export interface GovernedTimelinePolicyAuthorizationLease {
  establish(transaction: TransactionContext): Result<GovernedTimelinePolicyTransactionScope, AppError>;
}

/** Reusable same-SQLite-transaction boundary for governed timeline event operations. */
export class RepositoryBackedTimelinePolicyTransactionRunner {
  public constructor(private readonly dependencies: RepositoryBackedTimelineApplicationDependencies) {}

  public authorize<T>(
    context: TimelineApplicationContext,
    intent: TimelinePolicyIntent,
    operation: (lease: GovernedTimelinePolicyAuthorizationLease) => Result<T, AppError> | Promise<Result<T, AppError>>
  ): Promise<Result<T, AppError>> {
    return executeGoverned(this.dependencies, context, intent, (authorization, enforcementPoint) => operation({
      establish: (transaction) => {
        const governedInput = { context, intent, authorization, transaction };
        const established = establishGovernedTransaction(enforcementPoint, governedInput);
        if (!established.ok) return established;
        return ok({
          repository: governedRepositoryContext(context, transaction, authorization, intent),
          occurredAt: transaction.occurredAt,
          authorization
        });
      }
    }));
  }

  public execute<T>(
    context: TimelineApplicationContext,
    intent: TimelinePolicyIntent,
    operation: (scope: GovernedTimelinePolicyTransactionScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    return this.authorize(context, intent, (lease) =>
      this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
        const established = lease.establish(transaction);
        if (!established.ok) return established;
        const result = operation(established.value);
        if (!result.ok) return result;
        assertActivePlatformPolicyTransactionContext(established.value.authorization, {
          resourceType: intent.resourceType,
          resourceId: intent.resourceId,
          action: intent.action,
          capability: intent.capability,
          correlationId: context.correlationId,
          resourceFamilyId: context.familyId,
          fenceEpoch: established.value.authorization.fenceEpoch,
          fenceWritable: established.value.authorization.fenceWritable
        });
        return result;
      })
    );
  }
}

export const timelineCollectionReadIntent = (): TimelinePolicyIntent => Object.freeze({
  action: 'read',
  capability: 'family.read',
  resourceType: 'event',
  resourceId: '*',
  purpose: 'general'
});

export const timelineExactReadIntent = (eventId: string): TimelinePolicyIntent => Object.freeze({
  action: 'read',
  capability: 'family.read',
  resourceType: 'event',
  resourceId: eventId,
  purpose: 'general'
});

const locationApplicationContext = (
  context: TimelineApplicationContext,
  suffix: string
): Result<LocationApplicationContext, AppError> => {
  const role = context.actor.roles.find(isAuthorizationRole);
  if (!role || !context.actor.personId) {
    return err(createAppError({
      code: ERROR_CODES.AUTHORIZATION_DENIED,
      message: 'Konum görünürlüğü etkin kişi üyeliği ve aile rolü olmadan değerlendirilemez.',
      category: 'authorization',
      correlationId: context.correlationId
    }));
  }
  return ok({
    familyId: context.familyId,
    actor: {
      userId: context.actor.userId,
      role,
      personId: context.actor.personId
    },
    correlationId: asCorrelationId(`${context.correlationId}:${suffix}`)
  });
};

const sanitizeEventLocations = (
  events: readonly TimelineEventRecord[],
  locations: readonly TimelineLocationRecord[]
): readonly TimelineEventRecord[] => {
  const visibleLocations = new Map(locations.map((location) => [location.id, location]));
  return events.map((event) => {
    if (!event.locationId) return event;
    const location = visibleLocations.get(event.locationId);
    if (location) return { ...event, locationId: location.id, locationLabel: location.label };
    const { locationId: _locationId, locationLabel: _locationLabel, ...redacted } = event;
    return redacted;
  });
};

interface TimelineLocationProof {
  readonly location: TimelineLocationRecord;
  readonly receiptHash: string;
}

class RepositoryBackedTimelineWriteScope implements TimelineWriteScope {
  public constructor(
    private readonly dependencies: RepositoryBackedTimelineApplicationDependencies,
    private readonly repository: PolicyAuthorizedRepositoryExecutionContext,
    private readonly familyId: TimelineApplicationContext['familyId'],
    private readonly locationProof: TimelineLocationProof | undefined,
    public readonly occurredAt: TimelineWriteScope['occurredAt']
  ) {}

  public findFamily(familyId: Parameters<TimelineWriteScope['findFamily']>[0]): ReturnType<TimelineWriteScope['findFamily']> {
    const result = this.dependencies.familyRepository.findById(this.repository, familyId);
    if (!result.ok || !result.value) return result as ReturnType<TimelineWriteScope['findFamily']>;
    return ok({ id: result.value.id });
  }

  public listPeople(familyId: Parameters<TimelineWriteScope['listPeople']>[0]): ReturnType<TimelineWriteScope['listPeople']> {
    const result = this.dependencies.personRepository.listByFamily(this.repository, familyId);
    return result.ok ? ok(result.value.map((person) => ({ id: person.id }))) : result;
  }

  public findLocation(locationId: string): Result<TimelineLocationRecord | null, AppError> {
    return ok(this.locationProof?.location.id === locationId ? this.locationProof.location : null);
  }

  public findEvent(eventId: EventId): ReturnType<TimelineWriteScope['findEvent']> {
    return this.dependencies.timelineRepository.findForMutation(this.repository, eventId);
  }

  public insertEvent(event: TimelineEventRecord): Result<void, AppError> {
    const personId = this.repository.policyAuthorization.subject.personId;
    const governed = {
      ...event,
      ...(event.ownerPersonId ? {} : personId ? { ownerPersonId: asPersonId(personId) } : {}),
      ...(event.locationId && this.locationProof?.location.id === event.locationId
        ? { sourceLocationReceiptHash: this.locationProof.receiptHash }
        : {})
    };
    return this.dependencies.timelineRepository.insert(this.repository, governed);
  }

  public updateEvent(event: TimelineEventRecord): ReturnType<TimelineWriteScope['updateEvent']> {
    const locationReceipt = event.locationId && this.locationProof?.location.id === event.locationId
      ? this.locationProof.receiptHash
      : event.locationId ? event.sourceLocationReceiptHash : undefined;
    const { sourceLocationReceiptHash: _previousLocationReceipt, ...withoutLocationReceipt } = event;
    const governed: TimelineEventRecord = locationReceipt
      ? { ...withoutLocationReceipt, sourceLocationReceiptHash: locationReceipt }
      : withoutLocationReceipt;
    return this.dependencies.timelineRepository.update(this.repository, governed);
  }

  public setEventArchived(
    eventId: EventId,
    archivedAt?: TimelineWriteScope['occurredAt']
  ): ReturnType<TimelineWriteScope['setEventArchived']> {
    return this.dependencies.timelineRepository.setArchived(this.repository, eventId, archivedAt);
  }

  public updateParticipants(
    eventId: EventId,
    participantPersonIds: Parameters<TimelineWriteScope['updateParticipants']>[1],
    visibility: Parameters<TimelineWriteScope['updateParticipants']>[2]
  ): ReturnType<TimelineWriteScope['updateParticipants']> {
    return this.dependencies.timelineRepository.updateParticipants(
      this.repository,
      eventId,
      participantPersonIds,
      visibility
    );
  }

  public updateInvitation(
    eventId: EventId,
    invitationText?: string
  ): ReturnType<TimelineWriteScope['updateInvitation']> {
    return this.dependencies.timelineRepository.updateInvitation(this.repository, eventId, invitationText);
  }

  public updateNotes(eventId: EventId, notes?: string): ReturnType<TimelineWriteScope['updateNotes']> {
    return this.dependencies.timelineRepository.updateNotes(this.repository, eventId, notes);
  }

  public acknowledgeNotification(
    _state: Parameters<TimelineWriteScope['acknowledgeNotification']>[0]
  ): ReturnType<TimelineWriteScope['acknowledgeNotification']> {
    return err(createAppError({
      code: ERROR_CODES.AUTHORIZATION_DENIED,
      message: 'Timeline event transaction cannot mutate notification state.',
      category: 'security',
      correlationId: this.repository.correlationId
    }));
  }

  public appendAudit(input: Parameters<TimelineWriteScope['appendAudit']>[0]): ReturnType<TimelineWriteScope['appendAudit']> {
    return this.dependencies.auditRepository.append(this.repository, input);
  }

  public enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.repository, event);
  }
}

class RepositoryBackedTimelineNotificationWriteScope implements TimelineWriteScope {
  public readonly occurredAt: TimelineWriteScope['occurredAt'];

  public constructor(
    private readonly dependencies: RepositoryBackedTimelineApplicationDependencies,
    private readonly context: RepositoryExecutionContext
  ) {
    this.occurredAt = context.occurredAt;
  }

  private blocked<T>(): Result<T, AppError> {
    return err(createAppError({
      code: ERROR_CODES.AUTHORIZATION_DENIED,
      message: 'Notification transaction cannot access timeline event repositories.',
      category: 'security',
      correlationId: this.context.correlationId
    }));
  }

  public findFamily(): ReturnType<TimelineWriteScope['findFamily']> { return this.blocked(); }
  public listPeople(): ReturnType<TimelineWriteScope['listPeople']> { return this.blocked(); }
  public findLocation(): ReturnType<TimelineWriteScope['findLocation']> { return this.blocked(); }
  public findEvent(): ReturnType<TimelineWriteScope['findEvent']> { return this.blocked(); }
  public insertEvent(): ReturnType<TimelineWriteScope['insertEvent']> { return this.blocked(); }
  public updateEvent(): ReturnType<TimelineWriteScope['updateEvent']> { return this.blocked(); }
  public setEventArchived(): ReturnType<TimelineWriteScope['setEventArchived']> { return this.blocked(); }
  public updateParticipants(): ReturnType<TimelineWriteScope['updateParticipants']> { return this.blocked(); }
  public updateInvitation(): ReturnType<TimelineWriteScope['updateInvitation']> { return this.blocked(); }
  public updateNotes(): ReturnType<TimelineWriteScope['updateNotes']> { return this.blocked(); }

  public acknowledgeNotification(
    state: Parameters<TimelineWriteScope['acknowledgeNotification']>[0]
  ): ReturnType<TimelineWriteScope['acknowledgeNotification']> {
    return this.dependencies.notificationStateRepository.acknowledge(this.context, state);
  }

  public appendAudit(input: Parameters<TimelineWriteScope['appendAudit']>[0]): ReturnType<TimelineWriteScope['appendAudit']> {
    return this.dependencies.auditRepository.append(this.context, input);
  }

  public enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.context, event);
  }
}

export class RepositoryBackedTimelineApplicationUnitOfWork implements TimelineApplicationUnitOfWork {
  readonly #runner: RepositoryBackedTimelinePolicyTransactionRunner;

  public constructor(
    private readonly dependencies: RepositoryBackedTimelineApplicationDependencies,
    runner?: RepositoryBackedTimelinePolicyTransactionRunner
  ) {
    this.#runner = runner ?? new RepositoryBackedTimelinePolicyTransactionRunner(dependencies);
  }

  public async execute<TValue>(
    context: TimelineApplicationContext,
    operation: (scope: TimelineWriteScope) => Result<TValue, AppError>,
    options: TimelineUnitOfWorkOptions
  ): Promise<Result<TValue, AppError>> {
    if ('notificationMutation' in options) {
      return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) =>
        operation(new RepositoryBackedTimelineNotificationWriteScope(
          this.dependencies,
          repositoryContext(context, transaction)
        ))
      );
    }

    const executeTimeline = (locationProof?: TimelineLocationProof) => this.#runner.execute(
      context,
      options.policyIntent,
      ({ repository, occurredAt }) => operation(new RepositoryBackedTimelineWriteScope(
        this.dependencies,
        repository,
        context.familyId,
        locationProof,
        occurredAt
      ))
    );

    if (!options.governedLocationReadId) {
      if (options.policyIntent.sourceResourceMode === 'replace' && options.policyIntent.sourceResourceId) {
        return policyFailure(context, new Error('Exact location receipt is required for the new event location reference'));
      }
      return executeTimeline();
    }
    if (
      options.policyIntent.sourceResourceMode !== 'replace'
      || options.policyIntent.sourceResourceId !== options.governedLocationReadId
    ) return policyFailure(context, new Error('Timeline and location policy intents do not identify the same source resource'));

    const locationContext = locationApplicationContext(context, 'timeline-location-proof');
    if (!locationContext.ok) return locationContext;
    const proof = await this.dependencies.locationPolicyTransactionRunner.execute(
      locationContext.value,
      locationExactReadIntent(options.governedLocationReadId),
      ({ repository, authorization }) => {
        const location = this.dependencies.locationRepository.findById(
          repository,
          context.familyId,
          options.governedLocationReadId!
        );
        if (!location.ok) return location;
        if (!location.value) {
          return err(createAppError({
            code: ERROR_CODES.RESOURCE_NOT_FOUND,
            message: 'Governed timeline location reference was not found.',
            category: 'not_found',
            correlationId: context.correlationId
          }));
        }
        return ok({
          location: location.value,
          receiptHash: computePlatformPolicyReceiptHash(authorization.receiptRecord.receipt)
        });
      }
    );
    return proof.ok ? executeTimeline(proof.value) : proof;
  }
}

export class RepositoryBackedTimelineQueryPort implements TimelineQueryPort {
  readonly #runner: RepositoryBackedTimelinePolicyTransactionRunner;

  public constructor(
    private readonly dependencies: RepositoryBackedTimelineApplicationDependencies,
    runner?: RepositoryBackedTimelinePolicyTransactionRunner
  ) {
    this.#runner = runner ?? new RepositoryBackedTimelinePolicyTransactionRunner(dependencies);
  }

  public async load(context: TimelineApplicationContext): ReturnType<TimelineQueryPort['load']> {
    const events = await this.#runner.execute(
      context,
      timelineCollectionReadIntent(),
      ({ repository }) => this.dependencies.timelineRepository.listByFamily(repository, context.familyId)
    );
    if (!events.ok) return events;
    const locationContext = locationApplicationContext(context, 'timeline-location-collection');
    if (!locationContext.ok) return locationContext;
    const locations = await this.dependencies.locationPolicyTransactionRunner.execute(
      locationContext.value,
      locationCollectionReadIntent(),
      ({ repository }) => this.dependencies.locationRepository.listByFamily(repository, context.familyId)
    );
    if (!locations.ok) return locations;
    return ok({
      locations: locations.value,
      events: sanitizeEventLocations(events.value, locations.value)
    });
  }

  public listNotificationStates(
    context: TimelineApplicationContext,
    notificationIds: readonly string[]
  ): ReturnType<TimelineQueryPort['listNotificationStates']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) =>
      this.dependencies.notificationStateRepository.listByNotificationIds(
        repositoryContext(context, transaction),
        context.actor.userId,
        notificationIds
      )
    );
  }

  public async findVisibleById(
    context: TimelineApplicationContext,
    eventId: EventId
  ): ReturnType<TimelineQueryPort['findVisibleById']> {
    const event = await this.#runner.execute(
      context,
      timelineExactReadIntent(eventId),
      ({ repository }) => this.dependencies.timelineRepository.findById(repository, eventId)
    );
    if (!event.ok || !event.value || !event.value.locationId) return event;
    const locationId = event.value.locationId;
    const locationContext = locationApplicationContext(context, 'timeline-location-exact');
    if (!locationContext.ok) return locationContext;
    const location = await this.dependencies.locationPolicyTransactionRunner.execute(
      locationContext.value,
      locationExactReadIntent(locationId),
      ({ repository }) => this.dependencies.locationRepository.findById(repository, context.familyId, locationId)
    );
    if (!location.ok) {
      if (location.error.code === ERROR_CODES.AUTHORIZATION_DENIED) {
        return ok(sanitizeEventLocations([event.value], [])[0] ?? null);
      }
      return location;
    }
    return ok(sanitizeEventLocations([event.value], location.value ? [location.value] : [])[0] ?? null);
  }

  public async listArchived(context: TimelineApplicationContext): ReturnType<TimelineQueryPort['listArchived']> {
    const events = await this.#runner.execute(
      context,
      timelineCollectionReadIntent(),
      ({ repository }) => this.dependencies.timelineRepository.listArchivedByFamily(repository, context.familyId)
    );
    if (!events.ok) return events;
    const locationContext = locationApplicationContext(context, 'timeline-archived-location-collection');
    if (!locationContext.ok) return locationContext;
    const locations = await this.dependencies.locationPolicyTransactionRunner.execute(
      locationContext.value,
      locationCollectionReadIntent(),
      ({ repository }) => this.dependencies.locationRepository.listByFamily(repository, context.familyId)
    );
    return locations.ok ? ok(sanitizeEventLocations(events.value, locations.value)) : locations;
  }
}
