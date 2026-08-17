import { ERROR_CODES, asPersonId, createAppError, err, ok, type AppError, type Result } from '@ppt/core';
import {
  communicationFileSharingKey,
  communicationFileSharingReadIntent,
  emptyCommunicationFileSharingCenter,
  type CommunicationFileSharingQueryPort,
  type CommunicationFileSharingUnitOfWork,
  type CommunicationFileSharingWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '@ppt/application';
import type { DomainEvent } from '@ppt/events';
import type {
  CommunicationFileSharingCenterKey,
  CommunicationFileSharingPolicyResourceRepositoryPort,
  CommunicationFileSharingRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext
} from '@ppt/repository-contracts';
import {
  RepositoryBackedLifePolicyTransactionRunner,
  type RepositoryBackedLifeApplicationDependencies
} from './life-application-adapter.js';

export interface RepositoryBackedCommunicationFileSharingDependencies extends RepositoryBackedLifeApplicationDependencies {
  readonly communicationFileSharingRepository: CommunicationFileSharingRepositoryPort;
  readonly communicationFileSharingPolicyResourceRepository: CommunicationFileSharingPolicyResourceRepositoryPort;
}

const denied = (context: LifeApplicationContext, message: string): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED, message, category: 'authorization', correlationId: context.correlationId
}));

const keyFor = (context: LifeApplicationContext, ownerPersonId: NonNullable<LifeApplicationContext['actor']['personId']>) =>
  communicationFileSharingKey(context, ownerPersonId);

export class RepositoryBackedCommunicationFileSharingQueryPort implements CommunicationFileSharingQueryPort {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedCommunicationFileSharingDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) { this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies); }

  public getCenter(context: LifeApplicationContext): ReturnType<CommunicationFileSharingQueryPort['getCenter']> {
    return this.#runner.execute(context, communicationFileSharingReadIntent(), ({ repository, occurredAt }) => {
      if (!context.actor.personId) return denied(context, 'Dosya paylaşım merkezi kişi bağlı oturum gerektirir.');
      const key = keyFor(context, context.actor.personId);
      const loaded = this.dependencies.communicationFileSharingRepository.load(repository, key);
      return loaded.ok ? ok(loaded.value?.snapshot ?? emptyCommunicationFileSharingCenter(key, occurredAt)) : loaded;
    });
  }

  public getFile(context: LifeApplicationContext, fileId: string): ReturnType<CommunicationFileSharingQueryPort['getFile']> {
    return this.#runner.execute(context, communicationFileSharingReadIntent(fileId), ({ repository }) => {
      if (!context.actor.personId) return denied(context, 'Dosya önizlemesi kişi bağlı oturum gerektirir.');
      const key = keyFor(context, context.actor.personId);
      const loaded = this.dependencies.communicationFileSharingRepository.load(repository, key);
      if (!loaded.ok) return loaded;
      const file = loaded.value?.snapshot.files.find((candidate) => candidate.id === fileId);
      return file ? ok(file) : denied(context, 'Dosya önizleme kaynağı bulunamadı veya sahibi uyuşmuyor.');
    });
  }

  public getMaintenanceState(context: LifeApplicationContext)
  : ReturnType<CommunicationFileSharingQueryPort['getMaintenanceState']> {
    return this.#runner.execute(context, communicationFileSharingReadIntent(), ({ repository, occurredAt }) => {
      if (!context.actor.personId) return denied(context, 'Dosya payload bakımı kişi bağlı oturum gerektirir.');
      const key = keyFor(context, context.actor.personId);
      const loaded = this.dependencies.communicationFileSharingRepository.load(repository, key);
      return loaded.ok ? ok(Object.freeze({ center: loaded.value?.snapshot
        ?? emptyCommunicationFileSharingCenter(key, occurredAt), occurredAt })) : loaded;
    });
  }
}

class RepositoryBackedCommunicationFileSharingWriteScope implements CommunicationFileSharingWriteScope {
  public readonly key: CommunicationFileSharingCenterKey;
  public constructor(
    private readonly dependencies: RepositoryBackedCommunicationFileSharingDependencies,
    context: LifeApplicationContext,
    private readonly repository: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: CommunicationFileSharingWriteScope['occurredAt']
  ) {
    const owner = repository.policyAuthorization.receiptRecord.request.resource.ownerPersonId;
    if (!context.actor.personId || !owner) throw new Error('Communication file sharing durable owner context is incomplete');
    this.key = keyFor(context, asPersonId(owner));
  }
  public findPerson(personId:string){return this.dependencies.personRepository.findById(this.repository,asPersonId(personId));}
  public load() { return this.dependencies.communicationFileSharingRepository.load(this.repository, this.key); }
  public findMutation(clientOperationId: string) {
    return this.dependencies.communicationFileSharingRepository.findMutation(this.repository, this.key, clientOperationId);
  }
  public save(
    row: Parameters<CommunicationFileSharingWriteScope['save']>[0],
    mutation: Parameters<CommunicationFileSharingWriteScope['save']>[1],
    expectedRevision: number
  ) { return this.dependencies.communicationFileSharingRepository.save(this.repository, row, mutation, expectedRevision); }
  public appendAudit(input: Parameters<CommunicationFileSharingWriteScope['appendAudit']>[0]) {
    return this.dependencies.auditRepository.append(this.repository, input);
  }
  public enqueueEvent<TPayload>(event: DomainEvent<TPayload>) {
    return this.dependencies.outboxRepository.enqueue(this.repository, event);
  }
}

export class RepositoryBackedCommunicationFileSharingUnitOfWork implements CommunicationFileSharingUnitOfWork {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedCommunicationFileSharingDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) { this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies); }
  public execute<T>(context: LifeApplicationContext, intent: LifePolicyIntent,
    operation: (scope: CommunicationFileSharingWriteScope) => Result<T, AppError>): Promise<Result<T, AppError>> {
    return this.#runner.execute(context, intent, ({ repository, occurredAt }) => operation(
      new RepositoryBackedCommunicationFileSharingWriteScope(this.dependencies, context, repository, occurredAt)));
  }
}
