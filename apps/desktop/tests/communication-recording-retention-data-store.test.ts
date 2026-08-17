import { createHash, createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ok } from '@ppt/core';
import type { CommunicationMlsFoundationPort } from '@ppt/application';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import { computePlatformPolicyReceiptHash, computePlatformPolicyReceiptRecordHash } from '@ppt/repositories';
import { FamilyDataStore } from '../src/main/data-store.js';

const POLICY_VERSION='34-d-recording-retention-v1';const ADMIN_PASSWORD='Guclu34DKayitParolasi!';
const MEMBER_PASSWORD='Guclu34DKatilimciParolasi!';const directories:string[]=[];const stores:FamilyDataStore[]=[];let projectionSequence=0;
const sha=(value:unknown):string=>createHash('sha256').update(JSON.stringify(value),'utf8').digest('hex');
const kernel=new PlatformPolicyKernel({policyVersion:POLICY_VERSION,
  signingKey:Buffer.from('34-d-recording-retention-policy-key-material','utf8'),
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
  advanceEpoch(input:Parameters<CommunicationMlsFoundationPort['advanceEpoch']>[0]){return ok({
    ...this.epoch(input.roomId,input.currentEpoch+1,input.groupIdSha256,input.membershipDigestSha256,input.reason,input.occurredAt),
    previousEpoch:input.currentEpoch,previousCommitSha256:input.previousCommitSha256,
    previousConfirmedTranscriptHashSha256:input.previousConfirmedTranscriptHashSha256});}
  private epoch(roomId:string,epoch:number,groupIdSha256:string,membershipDigestSha256:string,
    reason:'room_created'|'member_added'|'member_removed'|'device_revoked_recovery',createdAt:string){return {roomId,epoch,
      cipherSuite:'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519' as const,groupIdSha256,
      commitSha256:sha({roomId,epoch,reason,type:'commit'}),confirmedTranscriptHashSha256:sha({roomId,epoch,reason,type:'transcript'}),
      groupContextSha256:sha({roomId,epoch,reason,type:'context'}),membershipDigestSha256,
      sealedStateReference:`mls-vault:room:${roomId}:epoch:${epoch}`,providerId:'test-rfc9420-provider',
      providerImplementation:'test-rfc9420-adapter',providerAttestationSha256:sha({roomId,epoch,reason}),
      providerEvidenceVerified:true as const,createdAt,reason};}
}
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const decodeBase32=(value:string):Buffer=>{let bits='';for(const char of value)bits+=alphabet.indexOf(char).toString(2).padStart(5,'0');
  const bytes:number[]=[];for(let index=0;index+8<=bits.length;index+=8)bytes.push(Number.parseInt(bits.slice(index,index+8),2));
  return Buffer.from(bytes);};
const makeTotp=(secret:string):string=>{const counter=Math.floor(Date.now()/30_000);const message=Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));const digest=createHmac('sha1',decodeBase32(secret)).update(message).digest();
  const offset=digest[digest.length-1]!&0x0f;const binary=((digest[offset]!&0x7f)<<24)|((digest[offset+1]!&0xff)<<16)
    |((digest[offset+2]!&0xff)<<8)|(digest[offset+3]!&0xff);return String(binary%1_000_000).padStart(6,'0');};
afterEach(()=>{projectionSequence=0;for(const store of stores.splice(0))try{store.close();}catch{/* best effort */}
  for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
const makeStore=(governed:boolean)=>{const directory=mkdtempSync(join(tmpdir(),'ppt-34d-recording-'));directories.push(directory);
  const databasePath=join(directory,'family.db');const store=new FamilyDataStore({databasePath,seed:false,
    communicationMlsFoundation:new TestMlsProvider(),...(governed?{archivePolicyAuthorizationProvider:authorizationProvider,
      archivePolicyReceiptSink:{append:()=>undefined,ensure:projectionProof,verifyProjectionProof:()=>true},
      archivePolicyVersion:POLICY_VERSION,archiveClusterFence:()=>({writable:true,epoch:108})}:{})});stores.push(store);
  store.setupAdmin({familyName:'34-D İletişim Ailesi',displayName:'34-D Aile Yöneticisi',
    email:'communication-34d-admin@example.test',password:ADMIN_PASSWORD});return {directory,databasePath,store};};
const allow=(store:FamilyDataStore,accountId:string,participant=false)=>{for(const [resourceType,actions] of participant?[
  ['communication_security_center',['read']],['communication_device_credential',['create']],['communication_recording_request',['update']]
]:[
  ['communication_security_center',['read']],['communication_device_credential',['create','delete']],
  ['communication_room',['create','update','delete']],['communication_call_center',['read']],
  ['communication_call_session',['create','update','delete']],['communication_recording_center',['read']],
  ['communication_recording_request',['create','update','delete']]
] as readonly (readonly [string,readonly string[]])[])store.upsertPermission({subjectAccountId:accountId,resourceType,resourceId:'*',
    actions:[...actions],effect:'allow',purpose:'general'});};
const prepareCall=async(store:FamilyDataStore)=>{const admin=store.listAccounts()[0]!;allow(store,admin.id);
  const member=store.createMember({displayName:'34-D Katılımcı',relationshipType:'Eş',generation:1,branch:'Ana Dal'});
  const invitation=store.createInvitation({email:'communication-34d-member@example.test',role:'adult_member',personId:member.entityId});
  store.logout();store.acceptInvitation({token:invitation.token,displayName:'34-D Katılımcı',password:MEMBER_PASSWORD});
  const setup=store.beginTwoFactorSetup();store.enableTwoFactor({code:makeTotp(setup.secret)});store.trustCurrentDevice({password:MEMBER_PASSWORD,
    code:setup.recoveryCodes[0]!,displayName:'34-D katılımcı cihazı'});
  store.logout();store.login({email:'communication-34d-admin@example.test',password:ADMIN_PASSWORD});
  const memberAccount=store.listAccounts().find(item=>item.personId===member.entityId)!;allow(store,memberAccount.id,true);
  store.logout();store.login({email:'communication-34d-member@example.test',password:MEMBER_PASSWORD});
  const memberCredential=await store.registerCommunicationDeviceCredential({clientOperationId:'member-device-34-d',expectedRevision:0});
  store.logout();store.login({email:'communication-34d-admin@example.test',password:ADMIN_PASSWORD});
  const ownerCredential=await store.registerCommunicationDeviceCredential({clientOperationId:'owner-device-34-d',expectedRevision:0});
  const room=await store.createCommunicationRoom({clientOperationId:'room-create-34-d',expectedRevision:0,
    ownerDeviceCredentialId:ownerCredential.resourceId,roomType:'direct',displayName:'34-D kayıt rıza odası'});
  await store.addCommunicationRoomMember({clientOperationId:'room-member-34-d',expectedRevision:1,roomId:room.resourceId,
    memberPersonId:member.entityId,deviceCredentialId:memberCredential.resourceId,role:'member'});
  const call=await store.createCommunicationCall({clientOperationId:'call-create-34-d',expectedRevision:0,roomId:room.resourceId,
    topology:'direct_p2p',requestedMediaMode:'video',invitedPersonIds:[member.entityId],waitingRoomEnabled:true,
    automaticAudioFallbackEnabled:true});return {admin,member,memberAccount,call};};

describe('34-D recording and retention DataStore production composition',()=>{
  it('fails closed without central policy and creates no recording metadata',async()=>{
    const value=makeStore(false);await expect(value.store.getCommunicationRecordingCenter()).rejects.toThrow(/policy enforcement is not composed/i);
    const database=new DatabaseSync(value.databasePath,{readOnly:true});try{
      expect(database.prepare('SELECT COUNT(*) count FROM communication_recording_requests').get()).toEqual({count:0});
      expect(database.prepare('SELECT COUNT(*) count FROM communication_recording_mutations').get()).toEqual({count:0});
    }finally{database.close();}
  });

  it('collects exact self-consent across two accounts while capture, artifacts and network stay false',async()=>{
    const {store,databasePath}=makeStore(true);const prepared=await prepareCall(store);const createInput={clientOperationId:'recording-create-34-d',
      expectedRevision:0 as const,callSessionId:prepared.call.resourceId,participantPersonIds:[prepared.admin.personId!,prepared.member.entityId],
      noticeVersion:'recording-notice-v1',audioDays:30,videoDays:14,transcriptDays:7,translationDays:3,
      persistTranscript:false,persistTranslation:false};
    const created=await store.createCommunicationRecordingRequest(createInput);expect(created).toMatchObject({revision:1,replayed:false,
      mediaCaptureStarted:false,mediaArtifactCreated:false,networkUsed:false});expect(await store.createCommunicationRecordingRequest(createInput))
      .toMatchObject({revision:1,replayed:true});
    const outsider=store.createMember({displayName:'34-D Oda Dışı Kişi',relationshipType:'Yakın',generation:1,branch:'Ana Dal'});
    await expect(store.addCommunicationRecordingLateJoiner({clientOperationId:'outsider-late-joiner-34-d',expectedRevision:1,
      requestId:created.resourceId,participantPersonId:outsider.entityId})).rejects.toThrow(/etkin oda üyeliği/i);
    await store.decideCommunicationRecordingConsent({clientOperationId:'admin-consent-34-d',expectedRevision:1,
      requestId:created.resourceId,decision:'grant',explicitConsent:true,noticeVersion:'recording-notice-v1',ageCategory:'adult',
      ageAppropriateNoticeAcknowledged:true});
    store.logout();store.login({email:'communication-34d-member@example.test',password:MEMBER_PASSWORD});
    expect(await store.decideCommunicationRecordingConsent({clientOperationId:'member-consent-34-d',expectedRevision:2,
      requestId:created.resourceId,decision:'grant',explicitConsent:true,noticeVersion:'recording-notice-v1',ageCategory:'adult',
      ageAppropriateNoticeAcknowledged:true})).toMatchObject({revision:3,mediaCaptureStarted:false});
    store.logout();store.login({email:'communication-34d-admin@example.test',password:ADMIN_PASSWORD});
    expect(await store.setCommunicationRecordingSegment({clientOperationId:'segment-34-d',expectedRevision:3,
      requestId:created.resourceId,mode:'on_record_requested',reason:'Tüm katılımcılar açık rıza verdi.'}))
      .toMatchObject({revision:4,mediaArtifactCreated:false,networkUsed:false});
    expect(await store.getCommunicationRecordingCenter()).toMatchObject({requests:[{id:created.resourceId,state:'ready_not_recording',
      visibleRecordingIndicatorActive:false,audibleRecordingAnnouncementExecuted:false,recordingRoleBoundToE2eeGroup:false,
      mediaCaptureStarted:false,participants:[{state:'granted'},{state:'granted'}],segments:[{mode:'on_record_requested',captureStarted:false}]}],
      truth:{recordingDefaultOff:true,productionRecordingProviderConfigured:false,encryptedMediaVaultConfigured:false,
        securePhysicalDeletionVerified:false,guardianLegalPolicyConfigured:false,networkUsedByCurrentImplementation:false}});
    const database=new DatabaseSync(databasePath,{readOnly:true});try{
      expect(database.prepare('SELECT COUNT(*) count FROM communication_recording_segments WHERE capture_started<>0').get()).toEqual({count:0});
      expect(database.prepare('SELECT COUNT(*) count FROM communication_recording_events').get()).toEqual({count:4});
      expect(JSON.stringify(database.prepare('SELECT * FROM communication_recording_mutations').all())).not.toMatch(/recording-notice|reason|secret|token/i);
    }finally{database.close();}
  },30_000);

  it('rolls request, consents, retention, audit and outbox back together on downstream failure',async()=>{
    const {store,databasePath}=makeStore(true);const prepared=await prepareCall(store);const injector=new DatabaseSync(databasePath);
    try{injector.exec(`CREATE TRIGGER test_34d_outbox_failure BEFORE INSERT ON event_outbox
      WHEN NEW.event_type='communication.recording.changed' BEGIN SELECT RAISE(ABORT,'controlled 34-D outbox failure'); END;`);}finally{injector.close();}
    await expect(store.createCommunicationRecordingRequest({clientOperationId:'rollback-recording-34-d',expectedRevision:0,
      callSessionId:prepared.call.resourceId,participantPersonIds:[prepared.admin.personId!,prepared.member.entityId],
      noticeVersion:'recording-notice-v1',audioDays:30,videoDays:14,transcriptDays:7,translationDays:3,
      persistTranscript:false,persistTranslation:false})).rejects.toThrow();
    const database=new DatabaseSync(databasePath,{readOnly:true});try{
      for(const table of ['communication_recording_requests','communication_recording_consents','communication_recording_retention',
        'communication_recording_mutations','communication_recording_events'])
        expect(database.prepare(`SELECT COUNT(*) count FROM ${table}`).get()).toEqual({count:0});
      expect(database.prepare("SELECT COUNT(*) count FROM event_outbox WHERE event_type='communication.recording.changed'").get()).toEqual({count:0});
    }finally{database.close();}
  },30_000);
});
