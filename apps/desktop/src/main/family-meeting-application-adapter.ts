import { createHash } from 'node:crypto';
import { ERROR_CODES, asPersonId, createAppError, err, ok, type AppError, type Result } from '@ppt/core';
import {
  communicationRecordingKey,
  communicationRecordingReadIntent,
  familyMeetingKey,
  familyMeetingReadIntent,
  familyMeetingSnapshotToCenter,
  type FamilyMeetingMinutesArtifactPort,
  type FamilyMeetingQueryPort,
  type FamilyMeetingRecordingConsentEvidence,
  type FamilyMeetingRecordingConsentPort,
  type FamilyMeetingUnitOfWork,
  type FamilyMeetingWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '@ppt/application';
import type { DomainEvent } from '@ppt/events';
import type {
  CommunicationRecordingRepositoryPort,
  FamilyMeetingCenterKey,
  FamilyMeetingPolicyResourceRepositoryPort,
  FamilyMeetingRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext
} from '@ppt/repository-contracts';
import {
  RepositoryBackedLifePolicyTransactionRunner,
  type RepositoryBackedLifeApplicationDependencies
} from './life-application-adapter.js';

export interface RepositoryBackedFamilyMeetingDependencies extends RepositoryBackedLifeApplicationDependencies {
  readonly familyMeetingRepository: FamilyMeetingRepositoryPort;
  readonly familyMeetingPolicyResourceRepository: FamilyMeetingPolicyResourceRepositoryPort;
  readonly communicationRecordingRepository: CommunicationRecordingRepositoryPort;
  readonly minutesArtifacts: FamilyMeetingMinutesArtifactPort;
}

const denied = (context: LifeApplicationContext, message: string): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED, message, category: 'authorization', correlationId: context.correlationId
}));
const missing = (context: LifeApplicationContext, message: string): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.RESOURCE_NOT_FOUND, message, category: 'not_found', correlationId: context.correlationId
}));
const keyFor = (context: LifeApplicationContext, ownerPersonId: NonNullable<LifeApplicationContext['actor']['personId']>) =>
  familyMeetingKey(context, ownerPersonId);

export class RepositoryBackedFamilyMeetingQueryPort implements FamilyMeetingQueryPort {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedFamilyMeetingDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) { this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies); }

  public getCenter(context: LifeApplicationContext): ReturnType<FamilyMeetingQueryPort['getCenter']> {
    return this.#runner.execute(context, familyMeetingReadIntent(), ({ repository, occurredAt }) => {
      if (!context.actor.personId) return denied(context, 'Aile toplantisi merkezi kisi bagli oturum gerektirir.');
      const key = keyFor(context, context.actor.personId);
      const snapshot = this.dependencies.familyMeetingRepository.loadCenter(repository, key);
      return snapshot.ok ? ok(familyMeetingSnapshotToCenter(snapshot.value, key, occurredAt)) : snapshot;
    });
  }

  public getMinutes(context: LifeApplicationContext, meetingId: string): ReturnType<FamilyMeetingQueryPort['getMinutes']> {
    return this.#runner.execute(context, familyMeetingReadIntent(), ({ repository }) => {
      if (!context.actor.personId) return denied(context, 'Toplanti tutanagi kisi bagli oturum gerektirir.');
      const found = this.dependencies.familyMeetingRepository.findMeeting(repository, keyFor(context, context.actor.personId), meetingId);
      if (!found.ok) return found;
      if (!found.value?.minutes) return missing(context, 'Muhurlu toplanti tutanagi bulunamadi.');
      return this.dependencies.minutesArtifacts.open(found.value.minutes, context.actor.personId, context.correlationId);
    });
  }
}

class RepositoryBackedFamilyMeetingWriteScope implements FamilyMeetingWriteScope {
  public readonly ownerPersonId: FamilyMeetingCenterKey['ownerPersonId'];
  public readonly actorPersonId: FamilyMeetingCenterKey['actorPersonId'];
  readonly #key: FamilyMeetingCenterKey;
  public constructor(
    private readonly dependencies: RepositoryBackedFamilyMeetingDependencies,
    private readonly context: LifeApplicationContext,
    private readonly repository: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: FamilyMeetingWriteScope['occurredAt']
  ) {
    const owner = repository.policyAuthorization.receiptRecord.request.resource.ownerPersonId;
    const actor = repository.policyAuthorization.subject.personId;
    if (!context.actor.personId || !owner || !actor || actor !== context.actor.personId)
      throw new Error('Family meeting durable owner or actor context is incomplete');
    this.ownerPersonId = asPersonId(owner); this.actorPersonId = asPersonId(actor);
    this.#key = keyFor(context, this.ownerPersonId);
  }
  public findPerson(personId:string){return this.dependencies.personRepository.findById(this.repository,asPersonId(personId));}
  public findMeeting(meetingId:string){return this.dependencies.familyMeetingRepository.findMeeting(this.repository,this.#key,meetingId);}
  public findMutation(clientOperationId:string){return this.dependencies.familyMeetingRepository.findMutationByClientOperationId(this.repository,this.#key,clientOperationId);}
  public insertMutation(row:Parameters<FamilyMeetingWriteScope['insertMutation']>[0]){return this.dependencies.familyMeetingRepository.insertMutation(this.repository,row);}
  public insertMeeting(row:Parameters<FamilyMeetingWriteScope['insertMeeting']>[0]){return this.dependencies.familyMeetingRepository.insertMeeting(this.repository,row);}
  public saveMeeting(row:Parameters<FamilyMeetingWriteScope['saveMeeting']>[0],expectedRevision:number){return this.dependencies.familyMeetingRepository.saveMeeting(this.repository,row,expectedRevision);}
  public upsertParticipant(row:Parameters<FamilyMeetingWriteScope['upsertParticipant']>[0],expectedRevision:number){return this.dependencies.familyMeetingRepository.upsertParticipant(this.repository,row,expectedRevision);}
  public upsertAgendaItem(row:Parameters<FamilyMeetingWriteScope['upsertAgendaItem']>[0],expectedRevision:number){return this.dependencies.familyMeetingRepository.upsertAgendaItem(this.repository,row,expectedRevision);}
  public insertPoll(row:Parameters<FamilyMeetingWriteScope['insertPoll']>[0]){return this.dependencies.familyMeetingRepository.insertPoll(this.repository,row);}
  public insertVote(row:Parameters<FamilyMeetingWriteScope['insertVote']>[0]){return this.dependencies.familyMeetingRepository.insertVote(this.repository,row);}
  public insertDecision(row:Parameters<FamilyMeetingWriteScope['insertDecision']>[0]){return this.dependencies.familyMeetingRepository.insertDecision(this.repository,row);}
  public upsertTask(row:Parameters<FamilyMeetingWriteScope['upsertTask']>[0],expectedRevision:number){return this.dependencies.familyMeetingRepository.upsertTask(this.repository,row,expectedRevision);}
  public insertCollaboration(row:Parameters<FamilyMeetingWriteScope['insertCollaboration']>[0]){return this.dependencies.familyMeetingRepository.insertCollaboration(this.repository,row);}
  public upsertMinutes(row:Parameters<FamilyMeetingWriteScope['upsertMinutes']>[0],expectedRevision:number){return this.dependencies.familyMeetingRepository.upsertMinutes(this.repository,row,expectedRevision);}
  public appendEvent(row:Parameters<FamilyMeetingWriteScope['appendEvent']>[0]){return this.dependencies.familyMeetingRepository.appendEvent(this.repository,row);}
  public appendAudit(input:Parameters<FamilyMeetingWriteScope['appendAudit']>[0]){return this.dependencies.auditRepository.append(this.repository,input);}
  public enqueueEvent<TPayload>(event:DomainEvent<TPayload>):Result<void,AppError>{return this.dependencies.outboxRepository.enqueue(this.repository,event);}
}

export class RepositoryBackedFamilyMeetingUnitOfWork implements FamilyMeetingUnitOfWork {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedFamilyMeetingDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) { this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies); }
  public execute<T>(context:LifeApplicationContext,intent:LifePolicyIntent,
    operation:(scope:FamilyMeetingWriteScope)=>Result<T,AppError>):Promise<Result<T,AppError>>{
    return this.#runner.execute(context,intent,({repository,occurredAt})=>operation(
      new RepositoryBackedFamilyMeetingWriteScope(this.dependencies,context,repository,occurredAt)));
  }
}

export class RepositoryBackedFamilyMeetingRecordingConsentPort implements FamilyMeetingRecordingConsentPort {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;
  public constructor(
    private readonly dependencies: RepositoryBackedFamilyMeetingDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) { this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies); }
  public verify(context:LifeApplicationContext,recordingRequestId:string):ReturnType<FamilyMeetingRecordingConsentPort['verify']>{
    return this.#runner.execute<FamilyMeetingRecordingConsentEvidence>(context,communicationRecordingReadIntent(),({repository})=>{
      if(!context.actor.personId)return denied(context,'Kayit rizasi kisi bagli oturum gerektirir.');
      const key=communicationRecordingKey(context,context.actor.personId);
      const found=this.dependencies.communicationRecordingRepository.findRequest(repository,key,recordingRequestId);
      if(!found.ok)return found;
      const snapshot=found.value;
      if(!snapshot||snapshot.request.state==='cancelled'||snapshot.request.state==='deletion_requested'
        ||snapshot.consents.length<2||!snapshot.retention.persistTranscript
        ||snapshot.consents.some((consent)=>consent.state!=='granted'||!consent.explicitConsent))
        return ok(Object.freeze({verified:false}));
      const evidenceSha256=createHash('sha256').update(JSON.stringify({requestId:snapshot.request.id,
        requestRevision:snapshot.request.revision,retentionRevision:snapshot.retention.revision,persistTranscript:true,
        consents:snapshot.consents.map((consent)=>({personId:consent.participantPersonId,state:consent.state,
          explicitConsent:consent.explicitConsent,noticeVersion:consent.noticeVersion,revision:consent.revision}))
          .sort((left,right)=>left.personId.localeCompare(right.personId))}),'utf8').digest('hex');
      return ok(Object.freeze({verified:true,recordingRequestId:snapshot.request.id,
        participantPersonIds:Object.freeze(snapshot.consents.map((consent)=>consent.participantPersonId).sort()),
        evidenceSha256}));
    });
  }
}
