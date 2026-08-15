import { describe, expect, it } from 'vitest';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId, asUserId, ok, type AppError, type Result } from '@ppt/core';
import type { CommunicationArchiveIntegrityCheckpointView, CommunicationAuditEventView } from '@ppt/domain';
import type { CommunicationAuditOperationRow } from '@ppt/repository-contracts';
import {
  AppendCommunicationAuditEventUseCase,
  RegisterCommunicationArchiveCheckpointUseCase,
  communicationAuditArchiveCenter,
  verifyCommunicationAuditChain,
  type CommunicationAuditArchiveUnitOfWork,
  type CommunicationAuditArchiveWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '../src/index.js';

const FAMILY=asFamilyId('family-34-h');const OWNER=asPersonId('person-owner-34-h');
const CONTEXT:LifeApplicationContext=Object.freeze({familyId:FAMILY,actor:Object.freeze({userId:asUserId('account-owner-34-h'),
  role:'family_admin',personId:OWNER}),correlationId:asCorrelationId('correlation-owner-34-h')});
const NOW=asIsoDateTime('2026-08-16T01:00:00.000Z');
class State{public events:CommunicationAuditEventView[]=[];public checkpoints:CommunicationArchiveIntegrityCheckpointView[]=[];
  public operations=new Map<string,CommunicationAuditOperationRow>();public clone(){const next=new State();next.events=[...this.events];
    next.checkpoints=[...this.checkpoints];next.operations=new Map(this.operations);return next;}}
class Scope implements CommunicationAuditArchiveWriteScope{public readonly key={familyId:FAMILY,ownerPersonId:OWNER};
  public readonly occurredAt=NOW;public constructor(private readonly state:State){}public listEvents(){return ok(Object.freeze([...this.state.events]));}
  public listCheckpoints(){return ok(Object.freeze([...this.state.checkpoints]));}public findOperation(id:string){return ok(this.state.operations.get(id)??null);}
  public appendEvent(event:CommunicationAuditEventView,operation:CommunicationAuditOperationRow){this.state.events.push(event);
    this.state.operations.set(operation.clientOperationId,operation);return ok(undefined);}public appendCheckpoint(checkpoint:CommunicationArchiveIntegrityCheckpointView,
    operation:CommunicationAuditOperationRow){this.state.checkpoints.push(checkpoint);this.state.operations.set(operation.clientOperationId,operation);return ok(undefined);}}
class Unit implements CommunicationAuditArchiveUnitOfWork{public state=new State();public intents:LifePolicyIntent[]=[];
  public execute<T>(_context:LifeApplicationContext,intent:LifePolicyIntent,operation:(scope:CommunicationAuditArchiveWriteScope)=>Result<T,AppError>){
    this.intents.push(intent);const draft=this.state.clone();const result=operation(new Scope(draft));if(result.ok)this.state=draft;return Promise.resolve(result);}}

describe('34-H communication audit and archive integrity use cases',()=>{
  it('appends content-free immutable metadata into a verifiable hash chain',async()=>{const unit=new Unit();const useCase=new AppendCommunicationAuditEventUseCase(unit);
    const first=await useCase.execute({context:CONTEXT,command:{clientOperationId:'audit-room-34-h',actorDeviceId:'device-34-h',
      eventKind:'room_joined',resourceType:'communication_room',resourceId:'room-34-h',resourceVersion:2,resourceFingerprint:'a'.repeat(64)}});
    const second=await useCase.execute({context:CONTEXT,command:{clientOperationId:'audit-file-34-h',actorDeviceId:'device-34-h',
      eventKind:'file_shared',resourceType:'communication_file_share',resourceId:'file-34-h',resourceVersion:1,resourceFingerprint:'b'.repeat(64)}});
    expect(first.ok&&second.ok).toBe(true);expect(verifyCommunicationAuditChain(unit.state.events)).toBe(true);
    expect(unit.state.events[0]).toMatchObject({sequence:1,previousHash:'0'.repeat(64),contentCopiedToAudit:false});
    expect(unit.state.events[1]?.previousHash).toBe(unit.state.events[0]?.eventHash);
    expect(JSON.stringify(unit.state.events)).not.toMatch(/message body|payload|plaintext/iu);
    const tampered=unit.state.events.map((event,index)=>index===0?{...event,resourceVersion:99}:event);
    expect(verifyCommunicationAuditChain(tampered)).toBe(false);
    const replay=await useCase.execute({context:CONTEXT,command:{clientOperationId:'audit-room-34-h',actorDeviceId:'device-34-h',
      eventKind:'room_joined',resourceType:'communication_room',resourceId:'room-34-h',resourceVersion:2,resourceFingerprint:'a'.repeat(64)}});
    expect(replay).toEqual(first);
  });
  it('records only evidence-backed local integrity checkpoints and never implies remote verification',async()=>{const unit=new Unit();
    const useCase=new RegisterCommunicationArchiveCheckpointUseCase(unit);const invalid=await useCase.execute({context:CONTEXT,command:{
      clientOperationId:'checkpoint-invalid-34-h',archiveGeneration:1,vaultManifestSha256:'1'.repeat(64),databaseManifestSha256:'2'.repeat(64),
      backupManifestSha256:'3'.repeat(64),restoreManifestSha256:'4'.repeat(64),vaultVerified:true,backupVerified:false,replicaVerified:false,restoreVerified:true}});
    expect(invalid).toMatchObject({ok:false,error:{category:'validation'}});const valid=await useCase.execute({context:CONTEXT,command:{
      clientOperationId:'checkpoint-local-34-h',archiveGeneration:1,vaultManifestSha256:'1'.repeat(64),databaseManifestSha256:'2'.repeat(64),
      backupManifestSha256:'3'.repeat(64),restoreManifestSha256:'4'.repeat(64),vaultVerified:true,backupVerified:true,replicaVerified:false,restoreVerified:true}});
    expect(valid.ok).toBe(true);expect(unit.state.checkpoints[0]).toMatchObject({restoreVerified:true,
      externalBackupProviderVerified:false,remoteReplicationVerified:false});
    const center=communicationAuditArchiveCenter(unit.state.events,unit.state.checkpoints,NOW);
    expect(center).toMatchObject({chainValid:true,truth:{contentExcludedFromAuditByConstruction:true,
      productionRemoteReplicationConfigured:false,realRestoreDrillPerformed:false}});
  });
});
