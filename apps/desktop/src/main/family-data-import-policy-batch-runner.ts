import type {
  LocationApplicationContext,
  LocationPolicyIntent,
  TimelineApplicationContext,
  TimelinePolicyIntent
} from '@ppt/application';
import { ERROR_CODES, createAppError, err, type AppError, type CorrelationId, type Result } from '@ppt/core';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';
import type {
  GovernedLocationPolicyAuthorizationLease,
  RepositoryBackedLocationPolicyTransactionRunner
} from './location-application-adapter.js';
import type {
  GovernedTimelinePolicyAuthorizationLease,
  RepositoryBackedTimelinePolicyTransactionRunner
} from './timeline-application-adapter.js';

export type FamilyDataImportPolicyBatchRequest =
  | Readonly<{ key: string; kind: 'location'; context: LocationApplicationContext; intent: LocationPolicyIntent }>
  | Readonly<{
      key: string;
      kind: 'created-location-read';
      createKey: string;
      context: LocationApplicationContext;
      intent: LocationPolicyIntent;
    }>
  | Readonly<{ key: string; kind: 'event'; context: TimelineApplicationContext; intent: TimelinePolicyIntent }>;

type PolicyLease = GovernedLocationPolicyAuthorizationLease | GovernedTimelinePolicyAuthorizationLease;
type PolicyLeaseEntry = Readonly<{ request: FamilyDataImportPolicyBatchRequest; lease: PolicyLease }>;
const RECEIPT_HASH = /^[a-f0-9]{64}$/u;

export interface FamilyDataImportPolicyBatchScope {
  readonly transaction: TransactionContext;
  readonly repositories: ReadonlyMap<string, PolicyAuthorizedRepositoryExecutionContext>;
}

export interface FamilyDataImportPolicyBatchRunnerPort {
  execute<T>(
    correlationId: CorrelationId,
    requests: readonly FamilyDataImportPolicyBatchRequest[],
    operation: (scope: FamilyDataImportPolicyBatchScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

export class RepositoryBackedFamilyDataImportPolicyBatchRunner implements FamilyDataImportPolicyBatchRunnerPort {
  public constructor(private readonly dependencies: {
    readonly transactionExecutor: TransactionExecutor;
    readonly locationRunner: RepositoryBackedLocationPolicyTransactionRunner;
    readonly timelineRunner: RepositoryBackedTimelinePolicyTransactionRunner;
  }) {}

  public execute<T>(
    correlationId: CorrelationId,
    requests: readonly FamilyDataImportPolicyBatchRequest[],
    operation: (scope: FamilyDataImportPolicyBatchScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    const keys = new Set(requests.map((request) => request.key));
    if (keys.size !== requests.length || requests.some((request) => request.key.trim().length === 0)) {
      throw new Error('Family data import policy batch keys must be unique and non-empty');
    }
    return this.#authorize(correlationId, requests, operation, 0, []);
  }

  #authorize<T>(
    correlationId: CorrelationId,
    requests: readonly FamilyDataImportPolicyBatchRequest[],
    operation: (scope: FamilyDataImportPolicyBatchScope) => Result<T, AppError>,
    index: number,
    entries: readonly PolicyLeaseEntry[]
  ): Promise<Result<T, AppError>> {
    if (index === requests.length) {
      return Promise.resolve(this.dependencies.transactionExecutor.execute(correlationId, (transaction) => {
        const repositories = new Map<string, PolicyAuthorizedRepositoryExecutionContext>();
        for (const entry of entries) {
          const established = entry.lease.establish(transaction);
          if (!established.ok) return established;
          repositories.set(entry.request.key, established.value.repository);
        }
        const result = operation({ transaction, repositories });
        if (!result.ok) return result;
        for (let current = entries.length - 1; current >= 0; current -= 1) {
          const entry = entries[current]!;
          if ('complete' in entry.lease && typeof entry.lease.complete === 'function') {
            const completed = entry.lease.complete(transaction);
            if (!completed.ok) return completed;
          } else if (entry.request.kind === 'created-location-read') {
            return err(createAppError({
              code: ERROR_CODES.AUTHORIZATION_DENIED,
              message: 'Created-location dependent read completion fence is missing.',
              category: 'security',
              correlationId
            }));
          }
        }
        return result;
      }));
    }
    const request = requests[index]!;
    if (request.kind === 'location') {
      return this.dependencies.locationRunner.authorize(request.context, request.intent, (lease) =>
        this.#authorize(correlationId, requests, operation, index + 1, [...entries, { request, lease }])
      );
    }
    if (request.kind === 'created-location-read') {
      const source = entries.find((entry) => entry.request.key === request.createKey);
      const createRequest = source?.request;
      if (
        !source
        || createRequest?.kind !== 'location'
        || createRequest.intent.action !== 'create'
        || createRequest.intent.capability !== 'family.write'
        || createRequest.intent.resourceType !== 'location'
        || createRequest.intent.resourceId !== request.intent.resourceId
        || createRequest.context.familyId !== request.context.familyId
        || createRequest.context.actor.userId !== request.context.actor.userId
        || createRequest.context.actor.personId !== request.context.actor.personId
        || !createRequest.intent.ownerPersonId
        || createRequest.intent.ownerPersonId !== request.context.actor.personId
        || request.intent.action !== 'read'
        || request.intent.capability !== 'location.read'
        || request.intent.resourceType !== 'location'
        || request.intent.anticipatedCreate !== undefined
        || !('receiptHash' in source.lease)
        || !source.lease.receiptHash
        || !RECEIPT_HASH.test(source.lease.receiptHash)
      ) return Promise.resolve(err(createAppError({
        code: ERROR_CODES.AUTHORIZATION_DENIED,
        message: 'Created-location dependent read is not bound to an exact prior create receipt.',
        category: 'security',
        correlationId
      })));
      const dependentIntent: LocationPolicyIntent = Object.freeze({
        ...request.intent,
        anticipatedCreate: Object.freeze({
          ownerPersonId: createRequest.intent.ownerPersonId,
          receiptHash: source.lease.receiptHash
        })
      });
      return this.dependencies.locationRunner.authorize(request.context, dependentIntent, (lease) =>
        this.#authorize(correlationId, requests, operation, index + 1, [...entries, { request, lease }])
      );
    }
    return this.dependencies.timelineRunner.authorize(request.context, request.intent, (lease) =>
      this.#authorize(correlationId, requests, operation, index + 1, [...entries, { request, lease }])
    );
  }
}
