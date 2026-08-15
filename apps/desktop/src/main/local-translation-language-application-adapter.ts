import { ERROR_CODES, asPersonId, createAppError, err, ok, type AppError, type Result } from '@ppt/core';
import {
  localTranslationKey,
  localTranslationReadIntent,
  localTranslationSnapshotToCenterView,
  type LifeApplicationContext,
  type LifePolicyIntent,
  type LocalTranslationQueryPort,
  type LocalTranslationUnitOfWork,
  type LocalTranslationWriteScope
} from '@ppt/application';
import type { DomainEvent } from '@ppt/events';
import type {
  LocalTranslationCenterKey,
  LocalTranslationLanguageRepositoryPort,
  LocalTranslationPolicyResourceRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext
} from '@ppt/repository-contracts';
import {
  RepositoryBackedLifePolicyTransactionRunner,
  type RepositoryBackedLifeApplicationDependencies
} from './life-application-adapter.js';

export interface RepositoryBackedLocalTranslationDependencies extends RepositoryBackedLifeApplicationDependencies {
  readonly localTranslationRepository: LocalTranslationLanguageRepositoryPort;
  readonly localTranslationPolicyResourceRepository: LocalTranslationPolicyResourceRepositoryPort;
}

const denied = (context: LifeApplicationContext, message: string): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED, message, category: 'authorization', correlationId: context.correlationId
}));
const keyFor = (context: LifeApplicationContext, ownerPersonId: NonNullable<LifeApplicationContext['actor']['personId']>) =>
  localTranslationKey(context, ownerPersonId);

export class RepositoryBackedLocalTranslationQueryPort implements LocalTranslationQueryPort {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedLocalTranslationDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) { this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies); }
  public getCenter(context: LifeApplicationContext): ReturnType<LocalTranslationQueryPort['getCenter']> {
    return this.#runner.execute(context, localTranslationReadIntent(), ({ repository, occurredAt }) => {
      if (!context.actor.personId) return denied(context, 'Dil ve çeviri merkezi kişi bağlı oturum gerektirir.');
      const key = keyFor(context, context.actor.personId);
      const snapshot = this.dependencies.localTranslationRepository.loadCenter(repository, key);
      return snapshot.ok ? ok(localTranslationSnapshotToCenterView(snapshot.value, key, occurredAt)) : snapshot;
    });
  }
}

class RepositoryBackedLocalTranslationWriteScope implements LocalTranslationWriteScope {
  public readonly ownerPersonId: LocalTranslationCenterKey['ownerPersonId'];
  readonly #key: LocalTranslationCenterKey;
  public constructor(
    private readonly dependencies: RepositoryBackedLocalTranslationDependencies,
    private readonly context: LifeApplicationContext,
    private readonly repository: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: LocalTranslationWriteScope['occurredAt']
  ) {
    const owner = repository.policyAuthorization.receiptRecord.request.resource.ownerPersonId;
    if (!context.actor.personId || !owner) throw new Error('Local translation durable owner context is incomplete');
    this.ownerPersonId = asPersonId(owner); this.#key = keyFor(context, this.ownerPersonId);
  }
  public findProfile(){return this.dependencies.localTranslationRepository.findProfile(this.repository,this.#key);}
  public findDictionaryEntry(entryId:string){return this.dependencies.localTranslationRepository.findDictionaryEntry(this.repository,this.#key,entryId);}
  public findRequest(requestId:string){return this.dependencies.localTranslationRepository.findRequest(this.repository,this.#key,requestId);}
  public findMutation(clientOperationId:string){return this.dependencies.localTranslationRepository.findMutationByClientOperationId(this.repository,this.#key,clientOperationId);}
  public insertMutation(row:Parameters<LocalTranslationWriteScope['insertMutation']>[0]){return this.dependencies.localTranslationRepository.insertMutation(this.repository,row);}
  public insertProfile(row:Parameters<LocalTranslationWriteScope['insertProfile']>[0]){return this.dependencies.localTranslationRepository.insertProfile(this.repository,row);}
  public saveProfile(row:Parameters<LocalTranslationWriteScope['saveProfile']>[0],expectedRevision:number){return this.dependencies.localTranslationRepository.saveProfile(this.repository,row,expectedRevision);}
  public insertDictionaryEntry(row:Parameters<LocalTranslationWriteScope['insertDictionaryEntry']>[0]){return this.dependencies.localTranslationRepository.insertDictionaryEntry(this.repository,row);}
  public saveDictionaryEntry(row:Parameters<LocalTranslationWriteScope['saveDictionaryEntry']>[0],expectedRevision:number){return this.dependencies.localTranslationRepository.saveDictionaryEntry(this.repository,row,expectedRevision);}
  public insertRequest(row:Parameters<LocalTranslationWriteScope['insertRequest']>[0]){return this.dependencies.localTranslationRepository.insertRequest(this.repository,row);}
  public saveRequest(row:Parameters<LocalTranslationWriteScope['saveRequest']>[0],expectedRevision:number){return this.dependencies.localTranslationRepository.saveRequest(this.repository,row,expectedRevision);}
  public appendEvent(row:Parameters<LocalTranslationWriteScope['appendEvent']>[0]){return this.dependencies.localTranslationRepository.appendEvent(this.repository,row);}
  public appendAudit(input:Parameters<LocalTranslationWriteScope['appendAudit']>[0]){return this.dependencies.auditRepository.append(this.repository,input);}
  public enqueueEvent<TPayload>(event:DomainEvent<TPayload>):Result<void,AppError>{return this.dependencies.outboxRepository.enqueue(this.repository,event);}
}

export class RepositoryBackedLocalTranslationUnitOfWork implements LocalTranslationUnitOfWork {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedLocalTranslationDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) { this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies); }
  public execute<T>(context:LifeApplicationContext,intent:LifePolicyIntent,
    operation:(scope:LocalTranslationWriteScope)=>Result<T,AppError>):Promise<Result<T,AppError>>{
    return this.#runner.execute(context,intent,({repository,occurredAt})=>operation(
      new RepositoryBackedLocalTranslationWriteScope(this.dependencies,context,repository,occurredAt)));
  }
}
