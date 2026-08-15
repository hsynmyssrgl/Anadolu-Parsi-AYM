import { ERROR_CODES, asPersonId, createAppError, err, ok, type AppError, type Result } from '@ppt/core';
import {
  communicationRecordingKey,
  communicationRecordingReadIntent,
  communicationRecordingSnapshotToView,
  type CommunicationRecordingQueryPort,
  type CommunicationRecordingUnitOfWork,
  type CommunicationRecordingWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '@ppt/application';
import { communicationRecordingTruth, type CommunicationRecordingCenterView } from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  CommunicationRecordingCenterKey,
  CommunicationRecordingPolicyResourceRepositoryPort,
  CommunicationRecordingRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext
} from '@ppt/repository-contracts';
import {
  RepositoryBackedLifePolicyTransactionRunner,
  type RepositoryBackedLifeApplicationDependencies
} from './life-application-adapter.js';

export interface RepositoryBackedCommunicationRecordingDependencies extends RepositoryBackedLifeApplicationDependencies {
  readonly communicationRecordingRepository: CommunicationRecordingRepositoryPort;
  readonly communicationRecordingPolicyResourceRepository: CommunicationRecordingPolicyResourceRepositoryPort;
}

const denied = (context: LifeApplicationContext, message: string): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED, message, category: 'authorization', correlationId: context.correlationId
}));
const keyFor = (context: LifeApplicationContext, ownerPersonId: NonNullable<LifeApplicationContext['actor']['personId']>) =>
  communicationRecordingKey(context, ownerPersonId);

export class RepositoryBackedCommunicationRecordingQueryPort implements CommunicationRecordingQueryPort {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedCommunicationRecordingDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) { this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies); }
  public getCenter(context: LifeApplicationContext): ReturnType<CommunicationRecordingQueryPort['getCenter']> {
    return this.#runner.execute(context, communicationRecordingReadIntent(), ({ repository, occurredAt }) => {
      if (!context.actor.personId) return denied(context, 'Kayıt ve rıza merkezi kişi bağlı oturum gerektirir.');
      const key = keyFor(context, context.actor.personId);
      const snapshot = this.dependencies.communicationRecordingRepository.loadCenter(repository, key);
      if (!snapshot.ok) return snapshot;
      const view: CommunicationRecordingCenterView = Object.freeze({ schemaVersion: 1, centerId: key.centerId,
        ownerPersonId: context.actor.personId, requests: Object.freeze(snapshot.value.requests.map(communicationRecordingSnapshotToView)),
        truth: communicationRecordingTruth, generatedAt: occurredAt });
      return ok(view);
    });
  }
}

class RepositoryBackedCommunicationRecordingWriteScope implements CommunicationRecordingWriteScope {
  public readonly ownerPersonId: CommunicationRecordingCenterKey['ownerPersonId'];
  readonly #key: CommunicationRecordingCenterKey;
  public constructor(
    private readonly dependencies: RepositoryBackedCommunicationRecordingDependencies,
    private readonly context: LifeApplicationContext,
    private readonly repository: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: CommunicationRecordingWriteScope['occurredAt']
  ) {
    const owner = repository.policyAuthorization.receiptRecord.request.resource.ownerPersonId;
    if (!context.actor.personId || !owner) throw new Error('Communication recording durable owner context is incomplete');
    this.ownerPersonId = asPersonId(owner); this.#key = keyFor(context, this.ownerPersonId);
  }
  public findRequest(requestId:string){return this.dependencies.communicationRecordingRepository.findRequest(this.repository,this.#key,requestId);}
  public findCallGuard(callSessionId:string){return this.dependencies.communicationRecordingRepository.findCallGuard(this.repository,this.#key,callSessionId);}
  public findMutation(clientOperationId:string){return this.dependencies.communicationRecordingRepository.findMutationByClientOperationId(this.repository,this.#key,clientOperationId);}
  public insertMutation(row:Parameters<CommunicationRecordingWriteScope['insertMutation']>[0]){return this.dependencies.communicationRecordingRepository.insertMutation(this.repository,row);}
  public insertRequest(row:Parameters<CommunicationRecordingWriteScope['insertRequest']>[0]){return this.dependencies.communicationRecordingRepository.insertRequest(this.repository,row);}
  public saveRequest(row:Parameters<CommunicationRecordingWriteScope['saveRequest']>[0],expectedRevision:number){return this.dependencies.communicationRecordingRepository.saveRequest(this.repository,row,expectedRevision);}
  public insertConsents(rows:Parameters<CommunicationRecordingWriteScope['insertConsents']>[0]){return this.dependencies.communicationRecordingRepository.insertConsents(this.repository,rows);}
  public insertLateJoinerConsent(row:Parameters<CommunicationRecordingWriteScope['insertLateJoinerConsent']>[0]){return this.dependencies.communicationRecordingRepository.insertLateJoinerConsent(this.repository,row);}
  public saveConsent(row:Parameters<CommunicationRecordingWriteScope['saveConsent']>[0],expectedRevision:number){return this.dependencies.communicationRecordingRepository.saveConsent(this.repository,row,expectedRevision);}
  public saveRetention(row:Parameters<CommunicationRecordingWriteScope['saveRetention']>[0],expectedRevision:number){return this.dependencies.communicationRecordingRepository.saveRetention(this.repository,row,expectedRevision);}
  public appendSegment(row:Parameters<CommunicationRecordingWriteScope['appendSegment']>[0]){return this.dependencies.communicationRecordingRepository.appendSegment(this.repository,row);}
  public appendEvent(row:Parameters<CommunicationRecordingWriteScope['appendEvent']>[0]){return this.dependencies.communicationRecordingRepository.appendEvent(this.repository,row);}
  public appendAudit(input:Parameters<CommunicationRecordingWriteScope['appendAudit']>[0]){return this.dependencies.auditRepository.append(this.repository,input);}
  public enqueueEvent<TPayload>(event:DomainEvent<TPayload>):Result<void,AppError>{return this.dependencies.outboxRepository.enqueue(this.repository,event);}
}

export class RepositoryBackedCommunicationRecordingUnitOfWork implements CommunicationRecordingUnitOfWork {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedCommunicationRecordingDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) { this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies); }
  public execute<T>(context:LifeApplicationContext,intent:LifePolicyIntent,
    operation:(scope:CommunicationRecordingWriteScope)=>Result<T,AppError>):Promise<Result<T,AppError>>{
    return this.#runner.execute(context,intent,({repository,occurredAt})=>operation(
      new RepositoryBackedCommunicationRecordingWriteScope(this.dependencies,context,repository,occurredAt)));
  }
}
