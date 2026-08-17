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
import type { VerifiedCommunicationCallPreflightInput } from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  CommunicationCallEventRow,
  CommunicationCallParticipantRow,
  CommunicationCallPreferencesRow,
  CommunicationCallQualityObservationRow,
  CommunicationCallSessionRow,
  CommunicationRealtimeCallingMutationRow,
  CommunicationRoomMembershipRow,
  CommunicationRoomRow
} from '@ppt/repository-contracts';
import {
  AdvanceCommunicationCallUseCase,
  CreateCommunicationCallUseCase,
  RecordCommunicationCallQualityObservationUseCase,
  RunCommunicationCallPreflightUseCase,
  SetCommunicationCallPreferencesUseCase,
  UpdateCommunicationCallControlsUseCase,
  communicationCallSessionRowToView,
  type CommunicationCallPreflightPort,
  type CommunicationRealtimeCallingUnitOfWork,
  type CommunicationRealtimeCallingWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '../src/index.js';

const FAMILY=asFamilyId('family-34-c');
const OWNER=asPersonId('person-owner-34-c');
const INVITED=asPersonId('person-invited-34-c');
const SECOND=asPersonId('person-second-34-c');
const NOW=asIsoDateTime('2026-08-15T14:00:00.000Z');
const CONTEXT:LifeApplicationContext=Object.freeze({familyId:FAMILY,actor:Object.freeze({userId:asUserId('account-owner-34-c'),
  role:'family_admin',personId:OWNER}),correlationId:asCorrelationId('correlation-owner-34-c')});
const room=(roomType:'direct'|'family'='direct'):CommunicationRoomRow=>Object.freeze({id:`room-${roomType}-34-c`,familyId:FAMILY,
  accountId:CONTEXT.actor.userId,ownerPersonId:OWNER,displayName:'Çağrı odası',roomType,maskedRoomRefSha256:'1'.repeat(64),
  providerGroupIdSha256:'2'.repeat(64),status:'active',historyAccessMode:'new_members_no_history',currentEpoch:1,
  currentEpochId:'3'.repeat(64),revision:1,stateFingerprint:'4'.repeat(64),lastMutationId:'5'.repeat(64),createdAt:NOW,updatedAt:NOW});
const membership=(roomId:string,personId:typeof OWNER,role:'owner'|'member'):CommunicationRoomMembershipRow=>Object.freeze({
  id:`membership-${personId}`,familyId:FAMILY,ownerPersonId:OWNER,roomId,memberPersonId:personId,
  deviceCredentialId:`device-${personId}`,role,status:'active',joinedAtEpoch:1,historyVisibleFromEpoch:1,revision:1,
  stateFingerprint:'6'.repeat(64),lastMutationId:'7'.repeat(64),createdAt:NOW,updatedAt:NOW});

class State{
  sessions=new Map<string,CommunicationCallSessionRow>(); participants=new Map<string,CommunicationCallParticipantRow[]>();
  mutations=new Map<string,CommunicationRealtimeCallingMutationRow>(); events:CommunicationCallEventRow[]=[];
  preferences:CommunicationCallPreferencesRow|null=null; quality:CommunicationCallQualityObservationRow[]=[];
  audits:unknown[]=[]; outbox:DomainEvent<unknown>[]=[];
  clone(){const next=new State();next.sessions=new Map(this.sessions);next.participants=new Map([...this.participants]
    .map(([key,value])=>[key,[...value]]));next.mutations=new Map(this.mutations);next.events=[...this.events];
    next.preferences=this.preferences;next.quality=[...this.quality];next.audits=[...this.audits];next.outbox=[...this.outbox];return next;}
}
class Scope implements CommunicationRealtimeCallingWriteScope{
  readonly occurredAt=NOW;readonly ownerPersonId=OWNER;
  constructor(private readonly state:State,private readonly rooms:Map<string,CommunicationRoomRow>,private readonly failOutbox:boolean){}
  findRoomGuard(roomId:string){const found=this.rooms.get(roomId);return ok(found?Object.freeze({room:found,memberships:Object.freeze([
    membership(roomId,OWNER,'owner'),membership(roomId,INVITED,'member'),...(found.roomType==='family'?[membership(roomId,SECOND,'member')]:[])
  ])}):null);}
  findSession(sessionId:string){const session=this.state.sessions.get(sessionId);return ok(session?Object.freeze({session,
    participants:Object.freeze(this.state.participants.get(sessionId)??[])}):null);}
  findPreferences(){return ok(this.state.preferences);}
  findMutation(id:string){return ok(this.state.mutations.get(id)??null);}
  insertMutation(row:CommunicationRealtimeCallingMutationRow){this.state.mutations.set(row.clientOperationId,row);return ok(undefined);}
  insertSession(row:CommunicationCallSessionRow){this.state.sessions.set(row.id,row);return ok(undefined);}
  saveSession(row:CommunicationCallSessionRow,expectedRevision:number){if(this.state.sessions.get(row.id)?.revision!==expectedRevision)
    throw new Error('session revision mismatch');this.state.sessions.set(row.id,row);return ok(undefined);}
  insertParticipants(rows:readonly CommunicationCallParticipantRow[]){this.state.participants.set(rows[0]!.sessionId,[...rows]);return ok(undefined);}
  appendEvent(row:CommunicationCallEventRow){this.state.events.push(row);return ok(undefined);}
  savePreferences(row:CommunicationCallPreferencesRow,expectedRevision:number){if((this.state.preferences?.revision??0)!==expectedRevision)
    throw new Error('preferences revision mismatch');this.state.preferences=row;return ok(undefined);}
  appendQualityObservation(row:CommunicationCallQualityObservationRow){this.state.quality.push(row);return ok(undefined);}
  appendAudit(input:unknown){this.state.audits.push(input);return ok('audit-34-c');}
  enqueueEvent<T>(event:DomainEvent<T>):Result<void,AppError>{if(this.failOutbox)return err(createAppError({
    code:ERROR_CODES.CORE_UNEXPECTED,category:'internal',message:'outbox failed',correlationId:CONTEXT.correlationId}));
    this.state.outbox.push(event as DomainEvent<unknown>);return ok(undefined);}
}
class Unit implements CommunicationRealtimeCallingUnitOfWork{
  state=new State();intents:LifePolicyIntent[]=[];failOutbox=false;rooms=new Map<string,CommunicationRoomRow>([
    [room('direct').id,room('direct')],[room('family').id,room('family')]]);
  execute<T>(_context:LifeApplicationContext,intent:LifePolicyIntent,operation:(scope:CommunicationRealtimeCallingWriteScope)=>Result<T,AppError>){
    this.intents.push(intent);const draft=this.state.clone();const result=operation(new Scope(draft,this.rooms,this.failOutbox));
    if(result.ok)this.state=draft;return Promise.resolve(result);}
}
class Preflight implements CommunicationCallPreflightPort{
  calls=0;constructor(private readonly value:VerifiedCommunicationCallPreflightInput){}
  run(){this.calls+=1;return Promise.resolve(ok(this.value));}
}
const create=async(unit:Unit,id='call-create-34-c',roomType:'direct'|'family'='direct')=>new CreateCommunicationCallUseCase(unit)
  .execute(CONTEXT,{clientOperationId:id,expectedRevision:0,roomId:room(roomType).id,
    topology:roomType==='direct'?'direct_p2p':'family_group_sfu',requestedMediaMode:'video',
    invitedPersonIds:roomType==='direct'?[INVITED]:[INVITED,SECOND],waitingRoomEnabled:true,automaticAudioFallbackEnabled:true});

describe('34-C realtime calling use cases',()=>{
  it('creates an owner-bound local call plan and replays without duplicate lifecycle rows',async()=>{
    const unit=new Unit();const first=await create(unit);expect(first).toMatchObject({ok:true,value:{mutationKind:'call_create',
      revision:1,mediaTransportStarted:false,networkUsed:false}});expect(await create(unit)).toMatchObject({ok:true,value:{replayed:true}});
    expect(unit.state.sessions.size).toBe(1);expect(unit.state.events).toHaveLength(1);expect(unit.state.participants.values().next().value).toHaveLength(2);
    expect(unit.intents[0]).toMatchObject({action:'create',capability:'family.write',resourceType:'communication_call_session',purpose:'general'});
  });

  it('rejects topology and membership mismatches before creating persistent call metadata',async()=>{
    const unit=new Unit();expect(await new CreateCommunicationCallUseCase(unit).execute(CONTEXT,{clientOperationId:'bad-topology-34-c',
      expectedRevision:0,roomId:room('family').id,topology:'direct_p2p',requestedMediaMode:'audio',
      invitedPersonIds:[INVITED],waitingRoomEnabled:false,automaticAudioFallbackEnabled:true}))
      .toMatchObject({ok:false,error:{category:'conflict'}});
    expect(await new CreateCommunicationCallUseCase(unit).execute(CONTEXT,{clientOperationId:'foreign-member-34-c',expectedRevision:0,
      roomId:room('direct').id,topology:'direct_p2p',requestedMediaMode:'audio',invitedPersonIds:['person-foreign-34-c'],
      waitingRoomEnabled:false,automaticAudioFallbackEnabled:true})).toMatchObject({ok:false,error:{category:'authorization'}});
    expect(unit.state.sessions.size).toBe(0);expect(unit.state.mutations.size).toBe(0);
  });

  it('accepts only verified no-network preflight evidence and advances to a local waiting state',async()=>{
    const unit=new Unit();const created=await create(unit);if(!created.ok)throw new Error(created.error.message);
    const preflight=new Preflight(Object.freeze({sessionId:created.value.resourceId,microphone:'passed',camera:'passed',speaker:'passed',
      providerId:'main-local-device-provider',providerEvidenceSha256:'a'.repeat(64),providerVerified:true,networkUsed:false,observedAt:NOW}));
    expect(await new RunCommunicationCallPreflightUseCase(unit,preflight).execute(CONTEXT,{clientOperationId:'preflight-34-c',
      expectedRevision:1,sessionId:created.value.resourceId})).toMatchObject({ok:true,value:{revision:2}});
    expect(await new RunCommunicationCallPreflightUseCase(unit,preflight).execute(CONTEXT,{clientOperationId:'preflight-34-c',
      expectedRevision:1,sessionId:created.value.resourceId})).toMatchObject({ok:true,value:{revision:2,replayed:true}});
    expect(await new AdvanceCommunicationCallUseCase(unit).execute(CONTEXT,{clientOperationId:'waiting-34-c',expectedRevision:2,
      sessionId:created.value.resourceId,action:'enter_local_waiting_room',reason:'Kullanıcı yerel bekleme alanını açtı.'}))
      .toMatchObject({ok:true,value:{revision:3,networkUsed:false}});
    expect(unit.state.sessions.get(created.value.resourceId)).toMatchObject({state:'waiting_local',networkState:'local_waiting_only'});
    expect(preflight.calls).toBe(1);
  });

  it('authorizes the exact session before device access and rejects stale evidence without writes',async()=>{
    const unit=new Unit();const created=await create(unit);if(!created.ok)throw new Error(created.error.message);
    const stale=new Preflight(Object.freeze({sessionId:created.value.resourceId,microphone:'passed',camera:'passed',speaker:'passed',
      providerId:'main-local-device-provider',providerEvidenceSha256:'a'.repeat(64),providerVerified:true,networkUsed:false,
      observedAt:asIsoDateTime('2026-08-15T13:00:00.000Z')}));
    expect(await new RunCommunicationCallPreflightUseCase(unit,stale).execute(CONTEXT,{clientOperationId:'stale-preflight-34-c',
      expectedRevision:1,sessionId:created.value.resourceId})).toMatchObject({ok:false,error:{category:'authorization'}});
    expect(unit.state.sessions.get(created.value.resourceId)).toMatchObject({revision:1});
    expect(unit.state.sessions.get(created.value.resourceId)).not.toHaveProperty('preflightEvidenceSha256');
    expect(unit.state.mutations.has('stale-preflight-34-c')).toBe(false);expect(stale.calls).toBe(1);
    const missing=new Preflight(Object.freeze({sessionId:'missing-call-34-c',microphone:'passed',camera:'passed',speaker:'passed',
      providerId:'main-local-device-provider',providerEvidenceSha256:'a'.repeat(64),providerVerified:true,networkUsed:false,observedAt:NOW}));
    expect(await new RunCommunicationCallPreflightUseCase(unit,missing).execute(CONTEXT,{clientOperationId:'missing-preflight-34-c',
      expectedRevision:1,sessionId:'missing-call-34-c'})).toMatchObject({ok:false,error:{category:'not_found'}});
    expect(missing.calls).toBe(0);
  });

  it('updates accessible local controls and blocks pinning a non-participant',async()=>{
    const unit=new Unit();const created=await create(unit);if(!created.ok)throw new Error(created.error.message);
    expect(await new UpdateCommunicationCallControlsUseCase(unit).execute(CONTEXT,{clientOperationId:'controls-34-c',expectedRevision:1,
      sessionId:created.value.resourceId,audioOnly:true,meetingLocked:true,captionsRequested:true,realtimeTextRequested:true,localHandRaised:true,
      pinnedPersonId:INVITED,signLanguagePinnedPersonId:INVITED,reactionCode:'wave'})).toMatchObject({ok:true,value:{revision:2}});
    expect(unit.state.sessions.get(created.value.resourceId)).toMatchObject({audioOnly:true,meetingLocked:true,captionsRequested:true,
      realtimeTextRequested:true,localHandRaised:true,pinnedPersonId:INVITED,signLanguagePinnedPersonId:INVITED,reactionCode:'wave'});
    expect(communicationCallSessionRowToView({session:unit.state.sessions.get(created.value.resourceId)!,
      participants:unit.state.participants.get(created.value.resourceId)!}).participants).toEqual(expect.arrayContaining([
        expect.objectContaining({role:'host',handRaised:true,reactionCode:'wave'}),
        expect.objectContaining({personId:INVITED,pinnedLocally:true,signLanguageSpeakerPinnedLocally:true})
      ]));
    expect(await new UpdateCommunicationCallControlsUseCase(unit).execute(CONTEXT,{clientOperationId:'clear-controls-34-c',expectedRevision:2,
      sessionId:created.value.resourceId,pinnedPersonId:null,signLanguagePinnedPersonId:null,reactionCode:null}))
      .toMatchObject({ok:true,value:{revision:3}});
    expect(unit.state.sessions.get(created.value.resourceId)).not.toHaveProperty('pinnedPersonId');
    expect(unit.state.sessions.get(created.value.resourceId)).not.toHaveProperty('signLanguagePinnedPersonId');
    expect(unit.state.sessions.get(created.value.resourceId)).not.toHaveProperty('reactionCode');
    expect(await new UpdateCommunicationCallControlsUseCase(unit).execute(CONTEXT,{clientOperationId:'bad-pin-34-c',expectedRevision:3,
      sessionId:created.value.resourceId,pinnedPersonId:'person-foreign-34-c'})).toMatchObject({ok:false,error:{category:'authorization'}});
    expect(await new UpdateCommunicationCallControlsUseCase(unit).execute(CONTEXT,{clientOperationId:'empty-controls-34-c',expectedRevision:3,
      sessionId:created.value.resourceId})).toMatchObject({ok:false,error:{category:'validation'}});
  });

  it('persists bounded accessibility preferences and verified quality metadata without provider secrets',async()=>{
    const unit=new Unit();expect(await new SetCommunicationCallPreferencesUseCase(unit).execute(CONTEXT,{clientOperationId:'prefs-34-c',
      expectedRevision:0,simpleMode:true,favoritePersonId:INVITED,largePersonCards:true,captionScalePercent:150,
      screenReaderAnnouncements:true,keyboardShortcuts:true,automaticAudioFallbackEnabled:true,noiseReductionRequested:true,
      echoCancellationRequested:true,automaticGainControlRequested:true,backgroundEffect:'off'}))
      .toMatchObject({ok:true,value:{resourceType:'communication_call_preferences',revision:1}});
    const created=await create(unit);if(!created.ok)throw new Error(created.error.message);
    expect(await new RecordCommunicationCallQualityObservationUseCase(unit).execute(CONTEXT,{clientOperationId:'quality-34-c',
      expectedRevision:1,sessionId:created.value.resourceId,verifiedObservation:{sessionId:created.value.resourceId,roundTripMs:42,
        packetLossPermille:4,jitterMs:7,uplinkKbps:2500,downlinkKbps:5000,providerId:'trusted-quality-provider',
        providerEvidenceSha256:'b'.repeat(64),providerVerified:true,observedAt:NOW}})).toMatchObject({ok:true,value:{revision:2}});
    expect(unit.state.quality).toHaveLength(1);expect(JSON.stringify(unit.state.quality)).not.toContain('token');
  });

  it('rolls back session, participant, mutation, audit and event state when outbox persistence fails',async()=>{
    const unit=new Unit();unit.failOutbox=true;expect(await create(unit,'rollback-call-34-c')).toMatchObject({ok:false,error:{category:'internal'}});
    expect(unit.state.sessions.size).toBe(0);expect(unit.state.participants.size).toBe(0);expect(unit.state.mutations.size).toBe(0);
    expect(unit.state.events).toHaveLength(0);expect(unit.state.audits).toHaveLength(0);expect(unit.state.outbox).toHaveLength(0);
  });
});
