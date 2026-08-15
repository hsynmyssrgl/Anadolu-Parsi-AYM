import { ERROR_CODES, asPersonId, createAppError, err, ok, type AppError, type Result } from '@ppt/core';
import {
  memoryStudioReadIntent,
  type LifeApplicationContext,
  type LifePolicyIntent,
  type MemoryStudioQueryPort,
  type MemoryStudioUnitOfWork,
  type MemoryStudioWriteScope
} from '@ppt/application';
import { memoryStudioCenterId, memoryStudioTruth, type MemoryStudioCenterView } from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  MemoryStudioCenterKey,
  MemoryStudioPolicyResourceRepositoryPort,
  MemoryStudioRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext
} from '@ppt/repository-contracts';
import {
  RepositoryBackedLifePolicyTransactionRunner,
  type RepositoryBackedLifeApplicationDependencies
} from './life-application-adapter.js';

export interface RepositoryBackedMemoryStudioDependencies extends RepositoryBackedLifeApplicationDependencies {
  readonly memoryStudioRepository: MemoryStudioRepositoryPort;
  readonly memoryStudioPolicyResourceRepository: MemoryStudioPolicyResourceRepositoryPort;
}

const denied = (context: LifeApplicationContext, message: string): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED, message, category: 'authorization', correlationId: context.correlationId
}));
const keyFor = (
  context: LifeApplicationContext,
  ownerPersonId: NonNullable<LifeApplicationContext['actor']['personId']>
): MemoryStudioCenterKey => ({ familyId: context.familyId, accountId: context.actor.userId,
  actorPersonId: context.actor.personId!, ownerPersonId, centerId: memoryStudioCenterId(context.familyId, ownerPersonId) });

export class RepositoryBackedMemoryStudioQueryPort implements MemoryStudioQueryPort {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(private readonly dependencies: RepositoryBackedMemoryStudioDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner) {
    this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies);
  }
  public getCenter(context: LifeApplicationContext): ReturnType<MemoryStudioQueryPort['getCenter']> {
    return this.#runner.execute(context, memoryStudioReadIntent(), ({ repository, occurredAt }) => {
      if (!context.actor.personId) return denied(context, 'Hafıza stüdyosu kişi bağlı oturum gerektirir.');
      const snapshot = this.dependencies.memoryStudioRepository.loadCenter(repository, keyFor(context, context.actor.personId));
      if (!snapshot.ok) return snapshot;
      const records = snapshot.value.records.filter((record) => record.status !== 'deleted').map(({
        familyId: _family, stateFingerprint: _state, lastMutationId: _mutation, referenceFingerprint: _reference, ...view
      }) => Object.freeze(view));
      const capsules = snapshot.value.capsules.map(({
        familyId: _family, stateFingerprint: _state, lastMutationId: _mutation, referenceFingerprint: _reference, ...view
      }) => Object.freeze(view));
      const view: MemoryStudioCenterView = Object.freeze({ schemaVersion: 1, centerId: keyFor(context, context.actor.personId).centerId,
        ownerPersonId: context.actor.personId, records: Object.freeze(records), capsules: Object.freeze(capsules),
        truth: memoryStudioTruth, generatedAt: occurredAt });
      return ok(view);
    });
  }
}

class RepositoryBackedMemoryStudioWriteScope implements MemoryStudioWriteScope {
  public readonly ownerPersonId: MemoryStudioCenterKey['ownerPersonId'];
  readonly #key: MemoryStudioCenterKey;
  public constructor(private readonly dependencies: RepositoryBackedMemoryStudioDependencies,
    private readonly context: LifeApplicationContext,
    private readonly repository: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: MemoryStudioWriteScope['occurredAt']) {
    const owner = repository.policyAuthorization.receiptRecord.request.resource.ownerPersonId;
    if (!context.actor.personId || !owner) throw new Error('Memory studio durable owner context is incomplete');
    this.ownerPersonId = asPersonId(owner);
    this.#key = keyFor(context, asPersonId(owner));
  }
  public findRecord(recordId: string) { return this.dependencies.memoryStudioRepository.findRecord(this.repository, this.#key, recordId); }
  public findCapsule(capsuleId: string) { return this.dependencies.memoryStudioRepository.findCapsule(this.repository, this.#key, capsuleId); }
  public findMutation(clientOperationId: string) {
    return this.dependencies.memoryStudioRepository.findMutationByClientOperationId(this.repository, this.#key, clientOperationId);
  }
  public validateOwnedReferences(references: Parameters<MemoryStudioWriteScope['validateOwnedReferences']>[0]) {
    return this.dependencies.memoryStudioRepository.validateOwnedReferences(this.repository, this.#key, references);
  }
  public insertMutation(row: Parameters<MemoryStudioWriteScope['insertMutation']>[0]) {
    return this.dependencies.memoryStudioRepository.insertMutation(this.repository, row);
  }
  public insertRecord(row: Parameters<MemoryStudioWriteScope['insertRecord']>[0]) {
    return this.dependencies.memoryStudioRepository.insertRecord(this.repository, row);
  }
  public saveRecord(row: Parameters<MemoryStudioWriteScope['saveRecord']>[0], expectedRevision: number) {
    return this.dependencies.memoryStudioRepository.saveRecord(this.repository, row, expectedRevision);
  }
  public insertCapsule(row: Parameters<MemoryStudioWriteScope['insertCapsule']>[0]) {
    return this.dependencies.memoryStudioRepository.insertCapsule(this.repository, row);
  }
  public saveCapsule(row: Parameters<MemoryStudioWriteScope['saveCapsule']>[0], expectedRevision: number) {
    return this.dependencies.memoryStudioRepository.saveCapsule(this.repository, row, expectedRevision);
  }
  public appendAudit(input: Parameters<MemoryStudioWriteScope['appendAudit']>[0]) {
    return this.dependencies.auditRepository.append(this.repository, input);
  }
  public enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.repository, event);
  }
}

export class RepositoryBackedMemoryStudioUnitOfWork implements MemoryStudioUnitOfWork {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(private readonly dependencies: RepositoryBackedMemoryStudioDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner) {
    this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies);
  }
  public execute<T>(context: LifeApplicationContext, intent: LifePolicyIntent,
    operation: (scope: MemoryStudioWriteScope) => Result<T, AppError>): Promise<Result<T, AppError>> {
    return this.#runner.execute(context, intent, ({ repository, occurredAt }) => operation(
      new RepositoryBackedMemoryStudioWriteScope(this.dependencies, context, repository, occurredAt)));
  }
}
