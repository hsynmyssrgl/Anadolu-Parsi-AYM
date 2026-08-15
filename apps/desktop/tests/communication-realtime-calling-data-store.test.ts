import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ok } from '@ppt/core';
import type { CommunicationCallPreflightPort, CommunicationMlsFoundationPort } from '@ppt/application';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import { computePlatformPolicyReceiptHash, computePlatformPolicyReceiptRecordHash } from '@ppt/repositories';
import { FamilyDataStore } from '../src/main/data-store.js';

const POLICY_VERSION='34-c-realtime-calling-v1';const PASSWORD='Guclu34CCagriParolasi!';
const directories:string[]=[];const stores:FamilyDataStore[]=[];let projectionSequence=0;
const sha=(value:unknown):string=>createHash('sha256').update(JSON.stringify(value),'utf8').digest('hex');
const kernel=new PlatformPolicyKernel({policyVersion:POLICY_VERSION,
  signingKey:Buffer.from('34-c-realtime-calling-policy-key-material','utf8'),
  applicationCapabilities:{'windows-desktop':['family.read','family.write','location.read']},
  consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update','delete']});
const authorizationProvider:PlatformPolicyAuthorizationProvider={resolvePolicyPackage:()=>kernel.policyPackage,
  authorize:({request,nonce})=>({effectiveRequest:request,authorization:kernel.authorizeWithReceipt(request,request.occurredAt,nonce)}),
  verify:({request,receipt})=>kernel.verifyReceiptForRequest(receipt,request)};
const projectionProof=(record:PlatformPolicyReceiptRecord):PlatformPolicyJournalProjectionProof=>({schemaVersion:1,
  receiptHash:computePlatformPolicyReceiptHash(record.receipt),recordHash:computePlatformPolicyReceiptRecordHash(record),
  receiptNonce:record.receipt.nonce,entrySequence:++projectionSequence,entryHash:'d'.repeat(64),headSequence:projectionSequence,
  headHash:'d'.repeat(64),journalSizeBytes:projectionSequence*512,issuedAt:record.recordedAt,proofMac:'e'.repeat(64)});
class TestMlsProvider implements CommunicationMlsFoundationPort{
  provisionDeviceCredential(input:Parameters<CommunicationMlsFoundationPort['provisionDeviceCredential']>[0]){return ok({
    trustedDeviceId:input.trustedDeviceId,deviceCredentialSha256:sha({device:input.trustedDeviceId}),
    keyPackageSha256:sha({key:input.trustedDeviceId}),sealedCredentialReference:`mls-vault:device:${input.trustedDeviceId}`,
    providerId:'test-rfc9420-provider',providerImplementation:'test-rfc9420-adapter',
    providerAttestationSha256:sha({attestation:input.trustedDeviceId}),providerEvidenceVerified:true as const,createdAt:input.occurredAt});}
  createGroup(input:Parameters<CommunicationMlsFoundationPort['createGroup']>[0]){return ok(this.epoch(input.roomId,1,
    sha({group:input.roomId}),input.membershipDigestSha256,'room_created',input.occurredAt));}
  advanceEpoch(input:Parameters<CommunicationMlsFoundationPort['advanceEpoch']>[0]){return ok(this.epoch(input.roomId,
    input.currentEpoch+1,input.groupIdSha256,input.membershipDigestSha256,input.reason,input.occurredAt));}
  private epoch(roomId:string,epoch:number,groupIdSha256:string,membershipDigestSha256:string,
    reason:'room_created'|'member_added'|'member_removed'|'device_revoked_recovery',createdAt:string){return {roomId,epoch,
      cipherSuite:'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519' as const,groupIdSha256,
      commitSha256:sha({roomId,epoch,reason,type:'commit'}),confirmedTranscriptHashSha256:sha({roomId,epoch,reason,type:'transcript'}),
      groupContextSha256:sha({roomId,epoch,reason,type:'context'}),membershipDigestSha256,
      sealedStateReference:`mls-vault:room:${roomId}:epoch:${epoch}`,providerId:'test-rfc9420-provider',
      providerImplementation:'test-rfc9420-adapter',providerAttestationSha256:sha({roomId,epoch,reason}),
      providerEvidenceVerified:true as const,createdAt,reason};}
}
const preflight:CommunicationCallPreflightPort={run:(_context,input)=>Promise.resolve(ok({sessionId:input.sessionId,
  microphone:'passed',camera:'passed',speaker:'passed',providerId:'test-main-device-preflight',
  providerEvidenceSha256:'a'.repeat(64),providerVerified:true,networkUsed:false,observedAt:'2026-08-15T14:00:00.000Z'}))};
afterEach(()=>{projectionSequence=0;for(const store of stores.splice(0))try{store.close();}catch{/* best effort */}
  for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
const makeStore=(input:{governed:boolean;verifiedPreflight?:boolean})=>{const directory=mkdtempSync(join(tmpdir(),'ppt-34c-calling-'));
  directories.push(directory);const databasePath=join(directory,'family.db');const store=new FamilyDataStore({databasePath,seed:false,
    communicationMlsFoundation:new TestMlsProvider(),...(input.verifiedPreflight?{communicationCallPreflight:preflight}:{}),
    ...(input.governed?{archivePolicyAuthorizationProvider:authorizationProvider,archivePolicyReceiptSink:{append:()=>undefined,
      ensure:projectionProof,verifyProjectionProof:()=>true},archivePolicyVersion:POLICY_VERSION,
      archiveClusterFence:()=>({writable:true,epoch:107})}:{})});stores.push(store);store.setupAdmin({familyName:'34-C İletişim Ailesi',
    displayName:'34-C Aile Yöneticisi',email:'communication-34c@example.test',password:PASSWORD});
  return {directory,databasePath,store,accountId:store.listAccounts()[0]!.id};};
const allow=(store:FamilyDataStore,accountId:string)=>{for(const [resourceType,actions] of [
  ['communication_security_center',['read']],['communication_device_credential',['create','delete']],
  ['communication_room',['create','update','delete']],['communication_call_center',['read']],
  ['communication_call_session',['create','update','delete']],['communication_call_preferences',['create','update']]
] as const)store.upsertPermission({subjectAccountId:accountId,resourceType,resourceId:'*',actions:[...actions],effect:'allow',purpose:'general'});};
const createOwnerRoom=async(store:FamilyDataStore)=>{const credential=await store.registerCommunicationDeviceCredential({
  clientOperationId:'register-call-device',expectedRevision:0});return store.createCommunicationRoom({
  clientOperationId:'create-call-room',expectedRevision:0,ownerDeviceCredentialId:credential.resourceId,roomType:'direct',
  displayName:'Bire bir çağrı odası'});};

describe('34-C realtime calling DataStore production composition',()=>{
  it('fails closed without central policy and does not create calling metadata',async()=>{
    const value=makeStore({governed:false});await expect(value.store.getCommunicationRealtimeCallingCenter())
      .rejects.toThrow(/policy enforcement is not composed/i);const database=new DatabaseSync(value.databasePath,{readOnly:true});try{
        expect(database.prepare('SELECT COUNT(*) count FROM communication_call_mutations').get()).toEqual({count:0});
        expect(database.prepare('SELECT COUNT(*) count FROM communication_call_sessions').get()).toEqual({count:0});
      }finally{database.close();}
  });

  it('persists and exactly replays accessible preferences while every media/network truth remains false',async()=>{
    const {store,accountId}=makeStore({governed:true});allow(store,accountId);const command={clientOperationId:'preferences-e2e-34-c',
      expectedRevision:0,simpleMode:true,largePersonCards:true,captionScalePercent:150,screenReaderAnnouncements:true,
      keyboardShortcuts:true,automaticAudioFallbackEnabled:true,noiseReductionRequested:true,echoCancellationRequested:true,
      automaticGainControlRequested:true,backgroundEffect:'off' as const};
    expect(await store.setCommunicationCallPreferences(command)).toMatchObject({revision:1,replayed:false,networkUsed:false});
    expect(await store.setCommunicationCallPreferences(command)).toMatchObject({revision:1,replayed:true});
    await expect(store.setCommunicationCallPreferences({...command,simpleMode:false})).rejects.toThrow(/clientOperationId|farklı/i);
    expect(await store.getCommunicationRealtimeCallingCenter()).toMatchObject({preferences:{simpleMode:true,captionScalePercent:150},
      sessions:[],qualityObservations:[],truth:{productionMediaProviderConfigured:false,webRtcPeerConnectionExecuted:false,
        sfuServiceConfigured:false,stunTurnServiceConfigured:false,sframeMediaEncryptionExecuted:false,
        liveCaptionProviderConfigured:false,realOneToOneCallPerformed:false,realGroupCallPerformed:false,
        networkUsedByCurrentImplementation:false}});
  });

  it('rejects a non-member invite and the default unconfigured preflight without partial writes',async()=>{
    const {store,accountId,databasePath}=makeStore({governed:true});allow(store,accountId);const room=await createOwnerRoom(store);
    await expect(store.createCommunicationCall({clientOperationId:'foreign-call-e2e-34-c',expectedRevision:0,roomId:room.resourceId,
      topology:'direct_p2p',requestedMediaMode:'video',invitedPersonIds:['person-not-in-room-34-c'],waitingRoomEnabled:true,
      automaticAudioFallbackEnabled:true})).rejects.toThrow();
    await expect(store.runCommunicationCallPreflight({clientOperationId:'missing-preflight-e2e-34-c',expectedRevision:1,
      sessionId:'communication-call-does-not-exist-34-c'})).rejects.toThrow(/preflight|yapılandırılmadı/i);
    const database=new DatabaseSync(databasePath,{readOnly:true});try{
      expect(database.prepare('SELECT COUNT(*) count FROM communication_call_sessions').get()).toEqual({count:0});
      expect(database.prepare('SELECT COUNT(*) count FROM communication_call_mutations').get()).toEqual({count:0});
      expect(database.prepare("SELECT COUNT(*) count FROM event_outbox WHERE event_type='communication.calling.changed'").get())
        .toEqual({count:0});
    }finally{database.close();}
  });

  it('rolls preferences, mutation, audit and outbox back together after a downstream outbox failure',async()=>{
    const {store,accountId,databasePath}=makeStore({governed:true});allow(store,accountId);const injector=new DatabaseSync(databasePath);
    try{injector.exec(`CREATE TRIGGER test_34c_outbox_failure BEFORE INSERT ON event_outbox
      WHEN NEW.event_type='communication.calling.changed' BEGIN SELECT RAISE(ABORT,'controlled 34-C outbox failure'); END;`);
    }finally{injector.close();}
    await expect(store.setCommunicationCallPreferences({clientOperationId:'rollback-preferences-34-c',expectedRevision:0,
      simpleMode:true,largePersonCards:true,captionScalePercent:150,screenReaderAnnouncements:true,keyboardShortcuts:true,
      automaticAudioFallbackEnabled:true,noiseReductionRequested:true,echoCancellationRequested:true,
      automaticGainControlRequested:true,backgroundEffect:'off'})).rejects.toThrow(/SQLite|beklenmeyen/i);
    const database=new DatabaseSync(databasePath,{readOnly:true});try{
      expect(database.prepare('SELECT COUNT(*) count FROM communication_call_preferences').get()).toEqual({count:0});
      expect(database.prepare('SELECT COUNT(*) count FROM communication_call_mutations').get()).toEqual({count:0});
      expect(database.prepare("SELECT COUNT(*) count FROM audit_log WHERE action='communication.call.preferences'").get()).toEqual({count:0});
      expect(database.prepare("SELECT COUNT(*) count FROM event_outbox WHERE event_type='communication.calling.changed'").get()).toEqual({count:0});
    }finally{database.close();}
  });
});
