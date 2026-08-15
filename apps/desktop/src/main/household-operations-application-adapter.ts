import { asPersonId, type AppError, type Result } from '@ppt/core';
import {
  emptyHouseholdOperationsCounts,
  householdOperationsReadIntent,
  householdOperationsTruth,
  type HouseholdOperationsQueryPort,
  type HouseholdOperationsUnitOfWork,
  type HouseholdOperationsWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '@ppt/application';
import { householdOperationsCenterId, type HouseholdOperationItemView } from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  HouseholdOperationsCenterKey,
  HouseholdOperationsRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext
} from '@ppt/repository-contracts';
import {
  RepositoryBackedLifePolicyTransactionRunner,
  type RepositoryBackedLifeApplicationDependencies
} from './life-application-adapter.js';

export interface RepositoryBackedHouseholdOperationsDependencies
  extends RepositoryBackedLifeApplicationDependencies {
  readonly householdOperationsRepository: HouseholdOperationsRepositoryPort;
}

const keyFor = (context: LifeApplicationContext): HouseholdOperationsCenterKey => ({
  familyId: context.familyId,
  accountId: context.actor.userId,
  actorPersonId: context.actor.personId!,
  centerId: householdOperationsCenterId(context.familyId)
});

export class RepositoryBackedHouseholdOperationsQueryPort implements HouseholdOperationsQueryPort {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;

  public constructor(
    private readonly dependencies: RepositoryBackedHouseholdOperationsDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) {
    this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies);
  }

  public getCenter(
    context: LifeApplicationContext
  ): ReturnType<HouseholdOperationsQueryPort['getCenter']> {
    return this.#runner.execute(context, householdOperationsReadIntent(), ({ repository, occurredAt }) => {
      const loaded = this.dependencies.householdOperationsRepository.loadCenter(repository, keyFor(context));
      if (!loaded.ok) return loaded;
      const counts = emptyHouseholdOperationsCounts();
      const items = Object.freeze(loaded.value.items.map((row): HouseholdOperationItemView => {
        const {
          familyId: _familyId,
          stateFingerprint: _stateFingerprint,
          lastMutationId: _lastMutationId,
          ...view
        } = row;
        if (view.status !== 'deleted') counts[view.area] += 1;
        return Object.freeze(view);
      }));
      return {
        ok: true,
        value: Object.freeze({
          schemaVersion: 1 as const,
          centerId: keyFor(context).centerId,
          revision: loaded.value.center?.revision ?? 0,
          items,
          countsByArea: Object.freeze(counts),
          truth: householdOperationsTruth,
          generatedAt: occurredAt
        })
      };
    });
  }
}

class RepositoryBackedHouseholdOperationsWriteScope implements HouseholdOperationsWriteScope {
  public constructor(
    private readonly dependencies: RepositoryBackedHouseholdOperationsDependencies,
    private readonly repository: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: HouseholdOperationsWriteScope['occurredAt']
  ) {}

  public findPerson(personId: string): ReturnType<HouseholdOperationsWriteScope['findPerson']> {
    const found = this.dependencies.personRepository.findById(this.repository, asPersonId(personId));
    return found.ok
      ? { ok: true, value: found.value ? {
          id: found.value.id,
          familyId: found.value.familyId,
          status: found.value.status
        } : null }
      : found;
  }

  public findCenter(key: HouseholdOperationsCenterKey): ReturnType<HouseholdOperationsWriteScope['findCenter']> {
    return this.dependencies.householdOperationsRepository.findCenter(this.repository, key);
  }

  public findItem(key: HouseholdOperationsCenterKey, itemId: string): ReturnType<HouseholdOperationsWriteScope['findItem']> {
    return this.dependencies.householdOperationsRepository.findItem(this.repository, key, itemId);
  }

  public findMutation(key: HouseholdOperationsCenterKey, clientOperationId: string): ReturnType<HouseholdOperationsWriteScope['findMutation']> {
    return this.dependencies.householdOperationsRepository.findMutationByClientOperationId(
      this.repository,
      key,
      clientOperationId
    );
  }

  public insertMutation(row: Parameters<HouseholdOperationsWriteScope['insertMutation']>[0]): ReturnType<HouseholdOperationsWriteScope['insertMutation']> {
    return this.dependencies.householdOperationsRepository.insertMutation(this.repository, row);
  }

  public insertCenter(row: Parameters<HouseholdOperationsWriteScope['insertCenter']>[0]): ReturnType<HouseholdOperationsWriteScope['insertCenter']> {
    return this.dependencies.householdOperationsRepository.insertCenter(this.repository, row);
  }

  public saveCenter(
    row: Parameters<HouseholdOperationsWriteScope['saveCenter']>[0],
    expectedRevision: number
  ): ReturnType<HouseholdOperationsWriteScope['saveCenter']> {
    return this.dependencies.householdOperationsRepository.saveCenter(this.repository, row, expectedRevision);
  }

  public insertItem(row: Parameters<HouseholdOperationsWriteScope['insertItem']>[0]): ReturnType<HouseholdOperationsWriteScope['insertItem']> {
    return this.dependencies.householdOperationsRepository.insertItem(this.repository, row);
  }

  public saveItem(
    row: Parameters<HouseholdOperationsWriteScope['saveItem']>[0],
    expectedRevision: number
  ): ReturnType<HouseholdOperationsWriteScope['saveItem']> {
    return this.dependencies.householdOperationsRepository.saveItem(this.repository, row, expectedRevision);
  }

  public appendAudit(input: Parameters<HouseholdOperationsWriteScope['appendAudit']>[0]): ReturnType<HouseholdOperationsWriteScope['appendAudit']> {
    return this.dependencies.auditRepository.append(this.repository, input);
  }

  public enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.repository, event);
  }
}

export class RepositoryBackedHouseholdOperationsUnitOfWork implements HouseholdOperationsUnitOfWork {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;

  public constructor(
    private readonly dependencies: RepositoryBackedHouseholdOperationsDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) {
    this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies);
  }

  public execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: HouseholdOperationsWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    return this.#runner.execute(context, intent, ({ repository, occurredAt }) => operation(
      new RepositoryBackedHouseholdOperationsWriteScope(this.dependencies, repository, occurredAt)
    ));
  }
}
