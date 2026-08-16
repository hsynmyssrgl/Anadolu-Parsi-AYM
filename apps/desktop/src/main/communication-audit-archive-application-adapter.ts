import { ERROR_CODES, createAppError, err, ok, type AppError, type Result } from '@ppt/core';
import {
  communicationAuditArchiveCenter,
  communicationAuditArchiveReadIntent,
  type CommunicationAuditArchiveQueryPort,
  type CommunicationAuditArchiveUnitOfWork,
  type CommunicationAuditArchiveWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '@ppt/application';
import type {
  CommunicationAuditArchiveKey,
  CommunicationAuditArchivePolicyResourceRepositoryPort,
  CommunicationAuditArchiveRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext
} from '@ppt/repository-contracts';
import {
  RepositoryBackedLifePolicyTransactionRunner,
  type RepositoryBackedLifeApplicationDependencies
} from './life-application-adapter.js';

export interface RepositoryBackedCommunicationAuditArchiveDependencies extends RepositoryBackedLifeApplicationDependencies {
  readonly communicationAuditArchiveRepository: CommunicationAuditArchiveRepositoryPort;
  readonly communicationAuditArchivePolicyResourceRepository: CommunicationAuditArchivePolicyResourceRepositoryPort;
}

const denied = (context: LifeApplicationContext, message: string): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED, category: 'authorization', message, correlationId: context.correlationId
}));

const keyFor = (context: LifeApplicationContext): CommunicationAuditArchiveKey | null => context.actor.personId
  ? Object.freeze({ familyId: context.familyId, accountId: context.actor.userId,
      actorPersonId: context.actor.personId, ownerPersonId: context.actor.personId })
  : null;

export class RepositoryBackedCommunicationAuditArchiveQueryPort implements CommunicationAuditArchiveQueryPort {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedCommunicationAuditArchiveDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) { this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies); }

  public load(context: LifeApplicationContext): ReturnType<CommunicationAuditArchiveQueryPort['load']> {
    return this.#runner.execute(context, communicationAuditArchiveReadIntent(), ({ repository, occurredAt }) => {
      const key = keyFor(context); if (!key) return denied(context, 'İletişim denetim merkezi kişi bağlı oturum gerektirir.');
      const events = this.dependencies.communicationAuditArchiveRepository.listEvents(repository, key);
      if (!events.ok) return events;
      const checkpoints = this.dependencies.communicationAuditArchiveRepository.listCheckpoints(repository, key);
      return checkpoints.ok ? ok(communicationAuditArchiveCenter(events.value, checkpoints.value, occurredAt)) : checkpoints;
    });
  }
}

class RepositoryBackedCommunicationAuditArchiveWriteScope implements CommunicationAuditArchiveWriteScope {
  public readonly key: CommunicationAuditArchiveKey;
  public constructor(
    private readonly dependencies: RepositoryBackedCommunicationAuditArchiveDependencies,
    context: LifeApplicationContext,
    private readonly repository: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: CommunicationAuditArchiveWriteScope['occurredAt']
  ) {
    const key = keyFor(context); const owner = repository.policyAuthorization.receiptRecord.request.resource.ownerPersonId;
    if (!key || owner !== key.ownerPersonId) throw new Error('Communication audit archive durable owner context is incomplete');
    this.key = key;
  }
  public listEvents() { return this.dependencies.communicationAuditArchiveRepository.listEvents(this.repository, this.key); }
  public listCheckpoints() { return this.dependencies.communicationAuditArchiveRepository.listCheckpoints(this.repository, this.key); }
  public findOperation(clientOperationId: string) {
    return this.dependencies.communicationAuditArchiveRepository.findOperation(this.repository, this.key, clientOperationId);
  }
  public appendEvent(event: Parameters<CommunicationAuditArchiveWriteScope['appendEvent']>[0],
    operation: Parameters<CommunicationAuditArchiveWriteScope['appendEvent']>[1]) {
    return this.dependencies.communicationAuditArchiveRepository.appendEvent(this.repository, this.key, event, operation);
  }
  public appendCheckpoint(checkpoint: Parameters<CommunicationAuditArchiveWriteScope['appendCheckpoint']>[0],
    operation: Parameters<CommunicationAuditArchiveWriteScope['appendCheckpoint']>[1]) {
    return this.dependencies.communicationAuditArchiveRepository.appendCheckpoint(this.repository, this.key, checkpoint, operation);
  }
}

export class RepositoryBackedCommunicationAuditArchiveUnitOfWork implements CommunicationAuditArchiveUnitOfWork {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedCommunicationAuditArchiveDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) { this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies); }
  public execute<T>(context: LifeApplicationContext, intent: LifePolicyIntent,
    operation: (scope: CommunicationAuditArchiveWriteScope) => Result<T, AppError>): Promise<Result<T, AppError>> {
    return this.#runner.execute(context, intent, ({ repository, occurredAt }) => operation(
      new RepositoryBackedCommunicationAuditArchiveWriteScope(this.dependencies, context, repository, occurredAt)));
  }
}
