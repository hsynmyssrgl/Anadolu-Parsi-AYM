import { describe, expect, it } from 'vitest';
import {
  ERROR_CODES,
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import type { DomainEvent } from '@ppt/events';
import type {
  CommunicationRecordingConsentRow,
  CommunicationRecordingEventRow,
  CommunicationRecordingMutationRow,
  CommunicationRecordingRequestRow,
  CommunicationRecordingRetentionRow,
  CommunicationRecordingSegmentRow
} from '@ppt/repository-contracts';
import {
  AddCommunicationRecordingLateJoinerUseCase,
  CreateCommunicationRecordingRequestUseCase,
  DecideCommunicationRecordingConsentUseCase,
  RequestCommunicationRecordingDeletionUseCase,
  SetCommunicationRecordingSegmentUseCase,
  UpdateCommunicationRecordingRetentionUseCase,
  WithdrawCommunicationRecordingConsentUseCase,
  type CommunicationRecordingUnitOfWork,
  type CommunicationRecordingWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '../src/index.js';

const FAMILY=asFamilyId('family-34-d');
const OWNER=asPersonId('person-owner-34-d');
const INVITED=asPersonId('person-invited-34-d');
const LATE=asPersonId('person-late-34-d');
const NOW=asIsoDateTime('2026-08-15T16:00:00.000Z');
const context=(personId=OWNER,accountId='account-owner-34-d'):LifeApplicationContext=>Object.freeze({familyId:FAMILY,
  actor:Object.freeze({userId:asUserId(accountId),role:'family_admin',personId}),correlationId:asCorrelationId(`correlation-${accountId}`)});

class State{
  requests=new Map<string,CommunicationRecordingRequestRow>();consents=new Map<string,CommunicationRecordingConsentRow[]>();
  retentions=new Map<string,CommunicationRecordingRetentionRow>();segments=new Map<string,CommunicationRecordingSegmentRow[]>();
  mutations:CommunicationRecordingMutationRow[]=[];events:CommunicationRecordingEventRow[]=[];audits:unknown[]=[];outbox:DomainEvent<unknown>[]=[];
  clone(){const next=new State();next.requests=new Map(this.requests);next.consents=new Map([...this.consents].map(([k,v])=>[k,[...v]]));
    next.retentions=new Map(this.retentions);next.segments=new Map([...this.segments].map(([k,v])=>[k,[...v]]));
    next.mutations=[...this.mutations];next.events=[...this.events];next.audits=[...this.audits];next.outbox=[...this.outbox];return next;}
}
class Scope implements CommunicationRecordingWriteScope{
  readonly occurredAt=NOW;readonly ownerPersonId=OWNER;
  constructor(private readonly state:State,private readonly appContext:LifeApplicationContext,private readonly failOutbox:boolean){}
  findRequest(requestId:string){const request=this.state.requests.get(requestId);if(!request)return ok(null);return ok(Object.freeze({request,
    consents:Object.freeze(this.state.consents.get(requestId)??[]),retention:this.state.retentions.get(requestId)!,
    segments:Object.freeze(this.state.segments.get(requestId)??[])}));}
  findCallGuard(callSessionId:string){return ok(callSessionId==='call-session-34-d'?Object.freeze({id:callSessionId,familyId:FAMILY,
    ownerPersonId:OWNER,state:'planned',participantPersonIds:Object.freeze([OWNER,INVITED])}):null);}
  findMutation(clientOperationId:string){return ok(this.state.mutations.find((row)=>row.clientOperationId===clientOperationId
    &&row.actorAccountId===this.appContext.actor.userId)??null);}
  insertMutation(row:CommunicationRecordingMutationRow){this.state.mutations.push(row);return ok(undefined);}
  insertRequest(row:CommunicationRecordingRequestRow){this.state.requests.set(row.id,row);return ok(undefined);}
  saveRequest(row:CommunicationRecordingRequestRow,expectedRevision:number){if(this.state.requests.get(row.id)?.revision!==expectedRevision)
    throw new Error('request revision mismatch');this.state.requests.set(row.id,row);return ok(undefined);}
  insertConsents(rows:readonly CommunicationRecordingConsentRow[]){this.state.consents.set(rows[0]!.requestId,[...rows]);return ok(undefined);}
  insertLateJoinerConsent(row:CommunicationRecordingConsentRow){this.state.consents.set(row.requestId,[...(this.state.consents.get(row.requestId)??[]),row]);return ok(undefined);}
  saveConsent(row:CommunicationRecordingConsentRow,expectedRevision:number){const rows=this.state.consents.get(row.requestId)??[];
    const found=rows.find((item)=>item.id===row.id);if(found?.revision!==expectedRevision)throw new Error('consent revision mismatch');
    this.state.consents.set(row.requestId,rows.map((item)=>item.id===row.id?row:item));return ok(undefined);}
  saveRetention(row:CommunicationRecordingRetentionRow,expectedRevision:number){if((this.state.retentions.get(row.requestId)?.revision??0)!==expectedRevision)
    throw new Error('retention revision mismatch');this.state.retentions.set(row.requestId,row);return ok(undefined);}
  appendSegment(row:CommunicationRecordingSegmentRow){this.state.segments.set(row.requestId,[...(this.state.segments.get(row.requestId)??[]),row]);return ok(undefined);}
  appendEvent(row:CommunicationRecordingEventRow){this.state.events.push(row);return ok(undefined);}
  appendAudit(input:unknown){this.state.audits.push(input);return ok('audit-34-d');}
  enqueueEvent<T>(event:DomainEvent<T>):Result<void,AppError>{if(this.failOutbox)return err(createAppError({code:ERROR_CODES.CORE_UNEXPECTED,
    category:'internal',message:'outbox failed',correlationId:this.appContext.correlationId}));this.state.outbox.push(event as DomainEvent<unknown>);return ok(undefined);}
}
class Unit implements CommunicationRecordingUnitOfWork{
  state=new State();intents:LifePolicyIntent[]=[];failOutbox=false;
  execute<T>(appContext:LifeApplicationContext,intent:LifePolicyIntent,operation:(scope:CommunicationRecordingWriteScope)=>Result<T,AppError>){
    this.intents.push(intent);const draft=this.state.clone();const result=operation(new Scope(draft,appContext,this.failOutbox));
    if(result.ok)this.state=draft;return Promise.resolve(result);}
}
const create=async(unit:Unit,id='recording-create-34-d')=>new CreateCommunicationRecordingRequestUseCase(unit).execute(context(),{
  clientOperationId:id,expectedRevision:0,callSessionId:'call-session-34-d',participantPersonIds:[OWNER,INVITED],noticeVersion:'notice-v1',
  audioDays:30,videoDays:14,transcriptDays:7,translationDays:3,persistTranscript:false,persistTranslation:false});

describe('34-D explicit-consent recording and retention use cases',()=>{
  it('creates a default-off owner-bound request and replays without duplicate consent or audit rows',async()=>{
    const unit=new Unit();const first=await create(unit);expect(first).toMatchObject({ok:true,value:{mutationKind:'recording_request_create',
      revision:1,mediaCaptureStarted:false,mediaArtifactCreated:false,networkUsed:false}});expect(await create(unit)).toMatchObject({ok:true,value:{replayed:true}});
    expect(unit.state.requests.size).toBe(1);expect(unit.state.consents.values().next().value).toHaveLength(2);
    expect([...unit.state.requests.values()][0]).toMatchObject({state:'consent_pending'});expect(unit.state.audits).toHaveLength(1);
    expect(unit.intents[0]).toMatchObject({resourceType:'communication_recording_request',action:'create',capability:'family.write',privacy:'private'});
  });

  it('requires the exact current call roster before creating any recording metadata',async()=>{
    const unit=new Unit();expect(await new CreateCommunicationRecordingRequestUseCase(unit).execute(context(),{clientOperationId:'bad-roster-34-d',
      expectedRevision:0,callSessionId:'call-session-34-d',participantPersonIds:[OWNER,LATE],noticeVersion:'notice-v1',audioDays:30,
      videoDays:30,transcriptDays:30,translationDays:30,persistTranscript:false,persistTranslation:false}))
      .toMatchObject({ok:false,error:{category:'conflict'}});expect(unit.state.requests.size).toBe(0);expect(unit.state.mutations).toHaveLength(0);
  });

  it('collects only self-consent and keeps on-record as a no-capture request after all adults grant',async()=>{
    const unit=new Unit();const created=await create(unit);if(!created.ok)throw new Error(created.error.message);
    expect(await new DecideCommunicationRecordingConsentUseCase(unit).execute(context(),{clientOperationId:'owner-consent-34-d',expectedRevision:1,
      requestId:created.value.resourceId,decision:'grant',explicitConsent:true,noticeVersion:'notice-v1',ageCategory:'adult',
      ageAppropriateNoticeAcknowledged:true})).toMatchObject({ok:true,value:{revision:2}});
    expect(await new DecideCommunicationRecordingConsentUseCase(unit).execute(context(INVITED,'account-invited-34-d'),{
      clientOperationId:'invited-consent-34-d',expectedRevision:2,requestId:created.value.resourceId,decision:'grant',explicitConsent:true,
      noticeVersion:'notice-v1',ageCategory:'adult',ageAppropriateNoticeAcknowledged:true})).toMatchObject({ok:true,value:{revision:3}});
    expect(unit.state.requests.get(created.value.resourceId)).toMatchObject({state:'ready_not_recording'});
    expect(await new SetCommunicationRecordingSegmentUseCase(unit).execute(context(),{clientOperationId:'segment-34-d',expectedRevision:3,
      requestId:created.value.resourceId,mode:'on_record_requested',reason:'Tüm katılımcılar açık rıza verdi.'}))
      .toMatchObject({ok:true,value:{revision:4,mediaCaptureStarted:false}});
    expect(unit.state.segments.get(created.value.resourceId)?.[0]).toMatchObject({mode:'on_record_requested',captureStarted:false,
      transcriptPersisted:false,translationPersisted:false});
  });

  it('blocks minor-or-unknown grants and pauses immediately for a late joiner',async()=>{
    const unit=new Unit();const created=await create(unit);if(!created.ok)throw new Error(created.error.message);
    expect(await new DecideCommunicationRecordingConsentUseCase(unit).execute(context(),{clientOperationId:'minor-consent-34-d',expectedRevision:1,
      requestId:created.value.resourceId,decision:'grant',explicitConsent:true,noticeVersion:'notice-v1',ageCategory:'minor_or_unknown',
      ageAppropriateNoticeAcknowledged:true})).toMatchObject({ok:false,error:{category:'authorization'}});
    expect(await new AddCommunicationRecordingLateJoinerUseCase(unit).execute(context(),{clientOperationId:'late-joiner-34-d',expectedRevision:1,
      requestId:created.value.resourceId,participantPersonId:LATE})).toMatchObject({ok:true,value:{revision:2}});
    expect(unit.state.requests.get(created.value.resourceId)).toMatchObject({state:'paused_for_joiner'});
    expect(unit.state.consents.get(created.value.resourceId)?.find((item)=>item.participantPersonId===LATE)).toMatchObject({state:'pending'});
  });

  it('turns the request off-record when consent is declined or later withdrawn',async()=>{
    const unit=new Unit();const created=await create(unit);if(!created.ok)throw new Error(created.error.message);
    expect(await new DecideCommunicationRecordingConsentUseCase(unit).execute(context(),{clientOperationId:'owner-grant-34-d',expectedRevision:1,
      requestId:created.value.resourceId,decision:'grant',explicitConsent:true,noticeVersion:'notice-v1',ageCategory:'adult',
      ageAppropriateNoticeAcknowledged:true})).toMatchObject({ok:true});
    expect(await new WithdrawCommunicationRecordingConsentUseCase(unit).execute(context(),{clientOperationId:'owner-withdraw-34-d',expectedRevision:2,
      requestId:created.value.resourceId,reason:'Gelecekteki kayıt rızamı geri çekiyorum.'})).toMatchObject({ok:true,value:{revision:3}});
    expect(unit.state.requests.get(created.value.resourceId)).toMatchObject({state:'off_record'});
    expect(unit.state.consents.get(created.value.resourceId)?.find((item)=>item.participantPersonId===OWNER)).toMatchObject({state:'withdrawn'});
  });

  it('updates per-media retention, requests logical deletion, and rolls every row back on outbox failure',async()=>{
    const unit=new Unit();const created=await create(unit);if(!created.ok)throw new Error(created.error.message);
    expect(await new UpdateCommunicationRecordingRetentionUseCase(unit).execute(context(),{clientOperationId:'retention-34-d',expectedRevision:1,
      requestId:created.value.resourceId,audioDays:60,videoDays:30,transcriptDays:10,translationDays:5,persistTranscript:true,
      persistTranslation:false,secureDeletionRequested:true})).toMatchObject({ok:true,value:{revision:2}});
    expect(unit.state.retentions.get(created.value.resourceId)).toMatchObject({audioDays:60,videoDays:30,transcriptDays:10,
      translationDays:5,persistTranscript:true,secureDeletionRequested:true});
    expect(await new RequestCommunicationRecordingDeletionUseCase(unit).execute(context(),{clientOperationId:'delete-34-d',expectedRevision:2,
      requestId:created.value.resourceId,reason:'Saklama gereksinimi sona erdi.'})).toMatchObject({ok:true,value:{revision:3,mediaArtifactCreated:false}});
    expect(unit.state.requests.get(created.value.resourceId)).toMatchObject({state:'deletion_requested'});
    const rollback=new Unit();rollback.failOutbox=true;expect(await create(rollback,'rollback-34-d')).toMatchObject({ok:false,error:{category:'internal'}});
    expect(rollback.state.requests.size).toBe(0);expect(rollback.state.consents.size).toBe(0);expect(rollback.state.mutations).toHaveLength(0);
    expect(rollback.state.events).toHaveLength(0);expect(rollback.state.audits).toHaveLength(0);
  });
});
