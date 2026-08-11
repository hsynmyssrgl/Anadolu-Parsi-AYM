import {
  ERROR_CODES,
  asPersonId,
  asUserId,
  createAppError,
  err,
  type AppError,
  type IsoDateTime,
  type Result
} from '@ppt/core';
import type {
  LocationApplicationContext,
  LocationApplicationRecord,
  LocationPolicyIntent,
  LocationQueryPort,
  LocationUnitOfWork,
  LocationWriteScope
} from '@ppt/application';
import {
  PlatformPolicyEnforcementError,
  assertActivePlatformPolicyTransactionContext,
  type PlatformPolicyClusterFence,
  type PlatformPolicyEnforcementPoint,
  type PlatformPolicyTransactionContext
} from '@ppt/platform-policy';
import type { DomainEvent } from '@ppt/events';
import { computePlatformPolicyReceiptHash } from '@ppt/repositories';
import type {
  AuditRepositoryPort,
  LocationRepositoryPort,
  OutboxRepositoryPort,
  PersonRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';

export interface LocationPolicyTransactionRevalidationInput {
  readonly context: LocationApplicationContext;
  readonly intent: LocationPolicyIntent;
  readonly authorization: PlatformPolicyTransactionContext;
  readonly transaction: TransactionContext;
}

export interface LocationPolicyCommittedTransactionInput {
  readonly context: LocationApplicationContext;
  readonly intent: LocationPolicyIntent;
  readonly authorization: PlatformPolicyTransactionContext;
}

export type LocationPolicyEnforcementPoint = Pick<PlatformPolicyEnforcementPoint, 'execute'> & {
  readonly requiresTransactionRevalidation?: true;
  readonly revalidateTransaction?: (input: LocationPolicyTransactionRevalidationInput) => Result<void, AppError>;
  readonly requiresDurableTransactionReceipt?: true;
  readonly recordAuthorizedTransaction?: (input: LocationPolicyTransactionRevalidationInput) => Result<void, AppError>;
  readonly requiresTransactionCompletionValidation?: true;
  readonly validateTransactionCompletion?: (input: LocationPolicyTransactionRevalidationInput) => Result<void, AppError>;
  readonly projectCommittedTransaction?: (
    input: LocationPolicyCommittedTransactionInput
  ) => Promise<Result<void, AppError>> | Result<void, AppError>;
};

export interface LocationPolicyEnforcementPointResolver {
  resolve(
    context: LocationApplicationContext,
    intent: LocationPolicyIntent
  ): LocationPolicyEnforcementPoint | Promise<LocationPolicyEnforcementPoint>;
}

export interface RepositoryBackedLocationApplicationDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly locationRepository: LocationRepositoryPort;
  readonly personRepository: PersonRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly outboxRepository: OutboxRepositoryPort;
  readonly policyEnforcementPointResolver: LocationPolicyEnforcementPointResolver;
  readonly clusterFence: PlatformPolicyClusterFence;
}

export const failClosedLocationPolicyEnforcementPointResolver: LocationPolicyEnforcementPointResolver = Object.freeze({
  resolve(): never {
    throw new PlatformPolicyEnforcementError(
      'ENFORCEMENT_UNAVAILABLE',
      'Location policy enforcement is not composed for this process'
    );
  }
});

export const nonWritableLocationClusterFence: PlatformPolicyClusterFence = () => Object.freeze({
  writable: false,
  epoch: 0
});

const governedRepositoryContext = (
  context: LocationApplicationContext,
  transaction: TransactionContext,
  authorization: PlatformPolicyTransactionContext,
  intent: LocationPolicyIntent
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
      'Trusted policy subject or family does not match the location application boundary'
    );
  }
  return {
    transaction: transaction.transaction,
    actor: {
      userId: asUserId(authorization.subject.accountId),
      roles: authorization.subject.roles,
      ...(authorization.subject.personId ? { personId: asPersonId(authorization.subject.personId) } : {})
    },
    correlationId: context.correlationId,
    occurredAt: transaction.occurredAt,
    policyAuthorization: authorization
  };
};

const policyFailure = (
  context: LocationApplicationContext,
  error: unknown
): Result<never, AppError> => {
  const enforcementCode = error instanceof PlatformPolicyEnforcementError
    ? error.code
    : 'ENFORCEMENT_UNAVAILABLE';
  const message = error instanceof Error ? error.message : 'Location policy enforcement is unavailable';
  return err(createAppError({
    code: ERROR_CODES.AUTHORIZATION_DENIED,
    message: `Konum işlemi merkezi politika tarafından güvenli biçimde durduruldu: ${message}`,
    category: enforcementCode === 'POLICY_DENIED' ? 'authorization' : 'security',
    correlationId: context.correlationId,
    details: { enforcementCode }
  }));
};

const establishGovernedTransaction = (
  enforcementPoint: LocationPolicyEnforcementPoint,
  input: LocationPolicyTransactionRevalidationInput
): Result<void, AppError> => {
  const revalidation = enforcementPoint.revalidateTransaction?.(input);
  if (revalidation && !revalidation.ok) return revalidation;
  const recorded = enforcementPoint.recordAuthorizedTransaction?.(input);
  return recorded && !recorded.ok ? recorded : { ok: true, value: undefined };
};

const executeGoverned = async <T>(
  dependencies: RepositoryBackedLocationApplicationDependencies,
  context: LocationApplicationContext,
  intent: LocationPolicyIntent,
  operation: (
    authorization: PlatformPolicyTransactionContext,
    enforcementPoint: LocationPolicyEnforcementPoint
  ) => Result<T, AppError> | Promise<Result<T, AppError>>
): Promise<Result<T, AppError>> => {
  try {
    const enforcementPoint = await dependencies.policyEnforcementPointResolver.resolve(context, intent);
    if (!enforcementPoint || typeof enforcementPoint.execute !== 'function') {
      throw new PlatformPolicyEnforcementError('ENFORCEMENT_UNAVAILABLE', 'Location Policy Enforcement Point is missing');
    }
    if (
      enforcementPoint.requiresTransactionRevalidation === true
      && typeof enforcementPoint.revalidateTransaction !== 'function'
    ) throw new PlatformPolicyEnforcementError('ENFORCEMENT_UNAVAILABLE', 'Location policy transaction revalidation is missing');
    if (
      enforcementPoint.requiresDurableTransactionReceipt === true
      && (
        typeof enforcementPoint.recordAuthorizedTransaction !== 'function'
        || typeof enforcementPoint.projectCommittedTransaction !== 'function'
      )
    ) throw new PlatformPolicyEnforcementError('ENFORCEMENT_UNAVAILABLE', 'Location durable policy receipt boundary is incomplete');
    if (
      enforcementPoint.requiresTransactionCompletionValidation === true
      && typeof enforcementPoint.validateTransactionCompletion !== 'function'
    ) throw new PlatformPolicyEnforcementError('ENFORCEMENT_UNAVAILABLE', 'Location transaction completion validation is missing');

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
        ) throw new PlatformPolicyEnforcementError('TRANSACTION_CONTEXT_MISMATCH', 'Location policy subject or family changed');
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

export interface GovernedLocationPolicyTransactionScope {
  readonly repository: PolicyAuthorizedRepositoryExecutionContext;
  readonly occurredAt: IsoDateTime;
  readonly authorization: PlatformPolicyTransactionContext;
}

export interface GovernedLocationPolicyAuthorizationLease {
  readonly receiptHash?: string;
  establish(transaction: TransactionContext): Result<GovernedLocationPolicyTransactionScope, AppError>;
  complete?(transaction: TransactionContext): Result<void, AppError>;
}

/** Reusable same-SQLite-transaction boundary for every governed location surface. */
export class RepositoryBackedLocationPolicyTransactionRunner {
  public constructor(private readonly dependencies: RepositoryBackedLocationApplicationDependencies) {}

  public authorize<T>(
    context: LocationApplicationContext,
    intent: LocationPolicyIntent,
    operation: (lease: GovernedLocationPolicyAuthorizationLease) => Result<T, AppError> | Promise<Result<T, AppError>>
  ): Promise<Result<T, AppError>> {
    return executeGoverned(this.dependencies, context, intent, (authorization, enforcementPoint) => operation({
      receiptHash: computePlatformPolicyReceiptHash(authorization.receiptRecord.receipt),
      establish: (transaction) => {
        const governedInput = { context, intent, authorization, transaction };
        const established = establishGovernedTransaction(enforcementPoint, governedInput);
        if (!established.ok) return established;
        return { ok: true, value: {
          repository: governedRepositoryContext(context, transaction, authorization, intent),
          occurredAt: transaction.occurredAt,
          authorization
        } };
      },
      complete: (transaction) => enforcementPoint.validateTransactionCompletion?.({
        context,
        intent,
        authorization,
        transaction
      }) ?? { ok: true, value: undefined }
    }));
  }

  public execute<T>(
    context: LocationApplicationContext,
    intent: LocationPolicyIntent,
    operation: (scope: GovernedLocationPolicyTransactionScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    return this.authorize(context, intent, (lease) =>
      this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
        const established = lease.establish(transaction);
        if (!established.ok) return established;
        const result = operation(established.value);
        if (!result.ok) return result;
        const completed = lease.complete?.(transaction);
        if (completed && !completed.ok) return completed;
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

export const locationCollectionReadIntent = (): LocationPolicyIntent => Object.freeze({
  action: 'read',
  capability: 'location.read',
  resourceType: 'location',
  resourceId: '*',
  purpose: 'general',
  sensitivity: 'highly_sensitive'
});

export const locationExactReadIntent = (locationId: string): LocationPolicyIntent => Object.freeze({
  action: 'read',
  capability: 'location.read',
  resourceType: 'location',
  resourceId: locationId,
  purpose: 'general',
  sensitivity: 'highly_sensitive'
});

export class RepositoryBackedLocationQueryPort implements LocationQueryPort {
  readonly #runner: RepositoryBackedLocationPolicyTransactionRunner;

  public constructor(
    private readonly dependencies: RepositoryBackedLocationApplicationDependencies,
    runner?: RepositoryBackedLocationPolicyTransactionRunner
  ) {
    this.#runner = runner ?? new RepositoryBackedLocationPolicyTransactionRunner(dependencies);
  }

  public listLocations(context: LocationApplicationContext): ReturnType<LocationQueryPort['listLocations']> {
    return this.#runner.execute(context, locationCollectionReadIntent(), ({ repository }) =>
      this.dependencies.locationRepository.listByFamily(repository, context.familyId)
    );
  }

  public findLocation(
    context: LocationApplicationContext,
    locationId: string
  ): ReturnType<LocationQueryPort['findLocation']> {
    return this.#runner.execute(context, locationExactReadIntent(locationId), ({ repository }) =>
      this.dependencies.locationRepository.findById(repository, context.familyId, locationId)
    );
  }
}

class RepositoryBackedLocationWriteScope implements LocationWriteScope {
  public constructor(
    private readonly dependencies: RepositoryBackedLocationApplicationDependencies,
    private readonly repository: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: IsoDateTime
  ) {}

  public findPerson(personId: Parameters<LocationWriteScope['findPerson']>[0]): ReturnType<LocationWriteScope['findPerson']> {
    const result = this.dependencies.personRepository.findById(this.repository, personId);
    return result.ok ? { ok: true, value: result.value ? {
      id: result.value.id,
      familyId: result.value.familyId,
      status: result.value.status
    } : null } : result;
  }

  public insertLocation(record: LocationApplicationRecord): ReturnType<LocationWriteScope['insertLocation']> {
    return this.dependencies.locationRepository.insert(this.repository, record);
  }

  public appendAudit(input: Parameters<LocationWriteScope['appendAudit']>[0]): ReturnType<LocationWriteScope['appendAudit']> {
    return this.dependencies.auditRepository.append(this.repository, input);
  }

  public enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.repository, event);
  }
}

export class RepositoryBackedLocationUnitOfWork implements LocationUnitOfWork {
  readonly #runner: RepositoryBackedLocationPolicyTransactionRunner;

  public constructor(
    private readonly dependencies: RepositoryBackedLocationApplicationDependencies,
    runner?: RepositoryBackedLocationPolicyTransactionRunner
  ) {
    this.#runner = runner ?? new RepositoryBackedLocationPolicyTransactionRunner(dependencies);
  }

  public execute<T>(
    context: LocationApplicationContext,
    intent: LocationPolicyIntent,
    operation: (scope: LocationWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    return this.#runner.execute(context, intent, ({ repository, occurredAt }) =>
      operation(new RepositoryBackedLocationWriteScope(this.dependencies, repository, occurredAt))
    );
  }
}
