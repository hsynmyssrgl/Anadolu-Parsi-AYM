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
import { COMMUNICATION_FILE_CHUNK_BYTES, type CommunicationFileSharingCenterView } from '@ppt/domain';
import type { CommunicationFileSharingCenterRow, CommunicationFileSharingMutationRow } from '@ppt/repository-contracts';
import {
  ApplyCommunicationFileSharingCommandUseCase,
  GetCommunicationFileSafePreviewUseCase,
  MaintainCommunicationFilePayloadVaultUseCase,
  PrepareCommunicationFileUseCase,
  communicationFileSharingKey,
  type CommunicationFilePayloadPort,
  type CommunicationFileSharingQueryPort,
  type CommunicationFileSharingUnitOfWork,
  type CommunicationFileSharingWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '../src/index.js';

const FAMILY=asFamilyId('family-34-g');
const OWNER=asPersonId('person-owner-34-g');
const NOW=asIsoDateTime('2026-08-16T00:20:00.000Z');
const CONTEXT:LifeApplicationContext=Object.freeze({familyId:FAMILY,
  actor:Object.freeze({userId:asUserId('account-owner-34-g'),role:'family_admin',personId:OWNER}),
  correlationId:asCorrelationId('correlation-owner-34-g')});

class State {
  public row:CommunicationFileSharingCenterRow|null=null;
  public readonly mutations=new Map<string,CommunicationFileSharingMutationRow>();
  public audits=0;
  public events=0;
  public clone(){const next=new State();next.row=this.row;next.audits=this.audits;next.events=this.events;
    for(const [key,value] of this.mutations)next.mutations.set(key,value);return next;}
}

class Scope implements CommunicationFileSharingWriteScope {
  public readonly key=communicationFileSharingKey(CONTEXT,OWNER);
  public readonly occurredAt=NOW;
  public constructor(private readonly state:State,private readonly failAudit:boolean){}
  public load(){return ok(this.state.row);}
  public findMutation(clientOperationId:string){return ok(this.state.mutations.get(clientOperationId)??null);}
  public save(row:CommunicationFileSharingCenterRow,mutation:CommunicationFileSharingMutationRow,expectedRevision:number){
    if((this.state.row?.snapshot.revision??0)!==expectedRevision)throw new Error('revision mismatch');
    this.state.row=row;this.state.mutations.set(mutation.clientOperationId,mutation);return ok(undefined);
  }
  public appendAudit(){
    if(this.failAudit)return err(createAppError({code:ERROR_CODES.CORE_UNEXPECTED,category:'internal',
      message:'audit unavailable',correlationId:CONTEXT.correlationId}));
    this.state.audits+=1;return ok('audit-hash');
  }
  public enqueueEvent(){this.state.events+=1;return ok(undefined);}
}

class Unit implements CommunicationFileSharingUnitOfWork {
  public state=new State();
  public intents:LifePolicyIntent[]=[];
  public failAudit=false;
  public execute<T>(_context:LifeApplicationContext,intent:LifePolicyIntent,
    operation:(scope:CommunicationFileSharingWriteScope)=>Result<T,AppError>):Promise<Result<T,AppError>>{
    this.intents.push(intent);const draft=this.state.clone();const result=operation(new Scope(draft,this.failAudit));
    if(result.ok)this.state=draft;return Promise.resolve(result);
  }
}

class Payloads implements CommunicationFilePayloadPort {
  public sealed=0;
  public discarded:string[]=[];
  public sweeps:Parameters<CommunicationFilePayloadPort['sweepOrphans']>[0][]=[];
  public previewBytes=Buffer.from('abcdefg','utf8');
  public lastOpened:Uint8Array|undefined;
  public seal(input:Parameters<CommunicationFilePayloadPort['seal']>[0]){
    this.sealed+=1;const totalChunks=Math.ceil(input.bytes.byteLength/COMMUNICATION_FILE_CHUNK_BYTES);
    return ok(Object.freeze({sealedPayloadReference:`comm-file-${'a'.repeat(64)}.pptshare`,
      fullContentSha256:'b'.repeat(64),totalBytes:input.bytes.byteLength,totalChunks,
      providerId:'protected-side-artifact-store-v1' as const,providerEvidenceSha256:'c'.repeat(64),
      verifiedChunks:Object.freeze(Array.from({length:totalChunks},(_,chunkIndex)=>{const offsetBytes=chunkIndex*COMMUNICATION_FILE_CHUNK_BYTES;
        return Object.freeze({chunkIndex,offsetBytes,sizeBytes:Math.min(COMMUNICATION_FILE_CHUNK_BYTES,input.bytes.byteLength-offsetBytes),
          sha256:String(chunkIndex+1).repeat(64)});})),scanState:'provider_unavailable' as const}));
  }
  public open(){this.lastOpened=Buffer.from(this.previewBytes);return ok(this.lastOpened);}
  public discard(reference:string){this.discarded.push(reference);return ok(undefined);}
  public sweepOrphans(input:Parameters<CommunicationFilePayloadPort['sweepOrphans']>[0]){
    this.sweeps.push(input);return ok(Object.freeze({scannedFiles:0,deletedFiles:0,rejectedFiles:0}));
  }
}

class Query implements CommunicationFileSharingQueryPort {
  public constructor(private readonly state:State){}
  public getCenter(){return Promise.resolve(ok(this.state.row!.snapshot));}
  public getFile(_context:LifeApplicationContext,fileId:string){
    const file=this.state.row?.snapshot.files.find((candidate)=>candidate.id===fileId);
    return Promise.resolve(file?ok(file):err(createAppError({code:ERROR_CODES.RESOURCE_NOT_FOUND,category:'not_found',
      message:'missing file',correlationId:CONTEXT.correlationId})));
  }
  public getMaintenanceState(){return Promise.resolve(ok(Object.freeze({center:this.state.row!.snapshot,occurredAt:NOW})));}
}

const apply=(unit:Unit,clientOperationId:string,expectedRevision:number,
  command:Parameters<ApplyCommunicationFileSharingCommandUseCase['execute']>[0]['command'])=>
  new ApplyCommunicationFileSharingCommandUseCase(unit).execute({context:CONTEXT,clientOperationId,expectedRevision,command});

describe('34-G communication file sharing and remaining UX use cases',()=>{
  it('stages a bounded file through the main-only payload port and keeps unavailable scanning fail-closed',async()=>{
    const unit=new Unit();const payloads=new Payloads();const bytes=new Uint8Array(COMMUNICATION_FILE_CHUNK_BYTES+23).fill(7);
    const prepared=await new PrepareCommunicationFileUseCase(unit,payloads).execute({context:CONTEXT,
      clientOperationId:'prepare-file-34-g',expectedRevision:0,roomId:'room-34-g',displayName:'Aile belgesi.pdf',
      mimeType:'application/pdf',bytes});
    expect(prepared).toMatchObject({ok:true,value:{commandKind:'prepare_file',replayed:false,networkUsed:false}});
    expect(unit.intents[0]).toMatchObject({action:'create',capability:'family.write',
      resourceType:'communication_file_sharing',purpose:'general'});
    expect(unit.state.row?.snapshot.files[0]).toMatchObject({state:'scan_required',scanState:'provider_unavailable',
      totalChunks:2,externalLinkEnabled:false,externalLinkAccessCodeRequired:true});
    expect(unit.state.audits).toBe(1);expect(unit.state.events).toBe(1);expect(payloads.sealed).toBe(1);
    expect(payloads.sweeps).toHaveLength(1);
    bytes.fill(0);
  });

  it('requires scanner evidence before grants, keeps a single archive copy and bounds versions',async()=>{
    const unit=new Unit();const payloads=new Payloads();const bytes=new Uint8Array(32).fill(3);
    await new PrepareCommunicationFileUseCase(unit,payloads).execute({context:CONTEXT,
      clientOperationId:'prepare-workflow-34-g',expectedRevision:0,meetingId:'meeting-34-g',displayName:'Plan.txt',
      mimeType:'text/plain',bytes});
    const fileId=unit.state.row!.snapshot.files[0]!.id;
    expect((await apply(unit,'grant-before-scan',1,{kind:'grant_access',fileId,grantId:'grant-before-scan',
      personId:'person-member-34-g',mode:'preview_only',startsAt:NOW,endsAt:'2026-08-17T00:20:00.000Z'})).ok).toBe(false);
    expect((await apply(unit,'scanner-clean-34-g',1,{kind:'set_scan',fileId,scanState:'clean',
      scanProviderId:'local-scanner-34-g',scanEvidenceSha256:'d'.repeat(64)})).ok).toBe(true);
    expect((await apply(unit,'grant-preview-34-g',2,{kind:'grant_access',fileId,grantId:'grant-34-g',
      personId:'person-member-34-g',mode:'preview_only',startsAt:NOW,endsAt:'2026-08-17T00:20:00.000Z'})).ok).toBe(true);
    expect((await apply(unit,'archive-link-34-g',3,{kind:'link_archive',fileId,archiveItemId:'archive-item-34-g'})).ok).toBe(true);
    expect(await apply(unit,'archive-link-conflict-34-g',4,{kind:'link_archive',fileId,
      archiveItemId:'archive-item-other-34-g'})).toMatchObject({ok:false,error:{category:'conflict'}});
    expect((await apply(unit,'version-2-34-g',4,{kind:'add_version',fileId,contentSha256:'e'.repeat(64),sizeBytes:500,
      sealedPayloadReference:`comm-file-${'f'.repeat(64)}.pptshare`,providerId:'protected-side-artifact-store-v1',
      providerEvidenceSha256:'1'.repeat(64)})).ok).toBe(true);
    expect(unit.state.row?.snapshot.files[0]?.versions).toHaveLength(2);bytes.fill(0);
  });

  it('opens only a clean owner-bound bounded text payload and zeroizes preview bytes',async()=>{
    const unit=new Unit();const payloads=new Payloads();const bytes=Buffer.from('abcdefg','utf8');
    await new PrepareCommunicationFileUseCase(unit,payloads).execute({context:CONTEXT,
      clientOperationId:'prepare-preview-34-g',expectedRevision:0,roomId:'room-preview-34-g',displayName:'Not.txt',
      mimeType:'text/plain',bytes});
    const fileId=unit.state.row!.snapshot.files[0]!.id;
    const pendingUseCase=new GetCommunicationFileSafePreviewUseCase(new Query(unit.state),payloads);
    expect(await pendingUseCase.execute(CONTEXT,fileId)).toMatchObject({ok:false,error:{category:'authorization'}});
    expect((await apply(unit,'preview-scan-clean-34-g',1,{kind:'set_scan',fileId,scanState:'clean',
      scanProviderId:'local-scanner-34-g',scanEvidenceSha256:'d'.repeat(64)})).ok).toBe(true);
    const useCase=new GetCommunicationFileSafePreviewUseCase(new Query(unit.state),payloads);
    expect(await useCase.execute(CONTEXT,fileId)).toEqual({ok:true,value:{schemaVersion:1,fileId,displayName:'Not.txt',
      mimeType:'text/plain',text:'abcdefg',totalBytes:7,scanState:'clean',accessMode:'owner',
      renderingMode:'escaped_plain_text',truncated:false,payloadSource:'local_protected_payload',networkUsed:false,cloudUsed:false}});
    expect([...payloads.lastOpened!]).toEqual(Array(7).fill(0));
    payloads.previewBytes=Buffer.from('abc\0def','utf8');
    expect(await useCase.execute(CONTEXT,fileId)).toMatchObject({ok:false,error:{category:'authorization'}});
    expect([...payloads.lastOpened!]).toEqual(Array(7).fill(0));bytes.fill(0);
  });

  it('runs an owner-bound scheduled payload maintenance query without network authority',async()=>{
    const unit=new Unit();const payloads=new Payloads();const bytes=Buffer.from('maintenance','utf8');
    await new PrepareCommunicationFileUseCase(unit,payloads).execute({context:CONTEXT,
      clientOperationId:'prepare-maintenance-34-g',expectedRevision:0,roomId:'room-maintenance-34-g',
      displayName:'Bakım.txt',mimeType:'text/plain',bytes});
    const result=await new MaintainCommunicationFilePayloadVaultUseCase(new Query(unit.state),payloads).execute(CONTEXT);
    expect(result).toEqual({ok:true,value:{scannedFiles:0,deletedFiles:0,rejectedFiles:0,completedAt:NOW,
      networkUsed:false,cloudUsed:false}});
    expect(payloads.sweeps.at(-1)).toMatchObject({familyId:FAMILY,ownerPersonId:OWNER,maximumCandidates:64,
      referencedPayloads:[`comm-file-${'a'.repeat(64)}.pptshare`]});bytes.fill(0);
  });

  it('keeps emergency, remote assistance, co-watch and voice actions local and confirmation-bound',async()=>{
    const unit=new Unit();
    await apply(unit,'notifications-34-g',0,{kind:'set_notifications',quietHoursEnabled:true,
      quietHoursStart:'22:30',quietHoursEnd:'07:30',nonEmergencyDigestEnabled:true,
      roomOverrides:[{roomId:'room-quiet-34-g',muted:true}],personOverrides:[]});
    await apply(unit,'emergency-34-g',1,{kind:'announce_emergency',announcementId:'announcement-34-g',title:'Aile durum bildirimi'});
    await apply(unit,'support-request-34-g',2,{kind:'request_remote_assistance',sessionId:'support-34-g',
      helperPersonId:'person-helper-34-g',allowedControls:['annotate','pointer'],endsAt:'2026-08-16T01:00:00.000Z'});
    await apply(unit,'support-grant-34-g',3,{kind:'grant_remote_assistance',sessionId:'support-34-g',explicitSingleUseConsent:true});
    await apply(unit,'co-watch-34-g',4,{kind:'plan_co_watch',sessionId:'cowatch-34-g',
      mediaReference:'archive-item-family-video',narrationEnabled:true});
    await apply(unit,'voice-prepare-34-g',5,{kind:'prepare_voice_action',actionId:'voice-34-g',
      action:'join_meeting',targetReference:'meeting-34-g'});
    const prepared=unit.state.row?.snapshot as CommunicationFileSharingCenterView;
    expect(prepared.notificationProfile).toEqual({quietHoursEnabled:true,quietHoursStart:'22:30',quietHoursEnd:'07:30',
      nonEmergencyDigestEnabled:true,roomOverrides:[{roomId:'room-quiet-34-g',muted:true}],personOverrides:[]});
    expect('kind' in prepared.notificationProfile).toBe(false);
    expect(prepared.emergencyAnnouncements[0]).toMatchObject({emergencyServiceGuaranteed:false,localDeliveryOnly:true});
    expect(prepared.remoteAssistance[0]).toMatchObject({state:'active_local_plan',visibleIndicatorRequired:true,
      secureDesktopAndPasswordsHidden:true,remoteTransportConfigured:false});
    expect(prepared.coWatchSessions[0]).toMatchObject({sharePlayAdapterConfigured:false});
    expect(prepared.voiceActions[0]).toMatchObject({state:'confirmation_required',executedExternally:false});
    expect((await apply(unit,'voice-confirm-34-g',6,{kind:'confirm_voice_action',actionId:'voice-34-g',
      explicitConfirmation:true})).ok).toBe(true);
    expect(unit.state.row?.snapshot.truth).toMatchObject({productionFileTransportConfigured:false,
      productionMalwareScannerConfigured:false,networkUsedByCurrentImplementation:false});
  });

  it('replays the exact operation without resealing and discards a sealed payload on downstream rollback',async()=>{
    const unit=new Unit();const payloads=new Payloads();const bytes=new Uint8Array(10).fill(4);
    const useCase=new PrepareCommunicationFileUseCase(unit,payloads);const input={context:CONTEXT,
      clientOperationId:'replay-34-g',expectedRevision:0,roomId:'room-replay-34-g',displayName:'Plan.txt',
      mimeType:'text/plain',bytes};
    expect(await useCase.execute(input)).toMatchObject({ok:true,value:{replayed:false}});
    expect(await useCase.execute(input)).toMatchObject({ok:true,value:{replayed:true}});
    expect(payloads.sealed).toBe(1);
    const other=new Unit();const otherPayloads=new Payloads();other.failAudit=true;
    expect((await new PrepareCommunicationFileUseCase(other,otherPayloads).execute({...input,clientOperationId:'rollback-34-g'})).ok).toBe(false);
    expect(other.state.row).toBeNull();expect(otherPayloads.discarded).toEqual([`comm-file-${'a'.repeat(64)}.pptshare`]);bytes.fill(0);
  });
});
