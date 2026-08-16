import { DatabaseSync } from 'node:sqlite';
import { afterEach,describe,expect,it } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';import { join } from 'node:path';import { tmpdir } from 'node:os';
import { PlatformPolicyKernel,type PlatformPolicyAuthorizationProvider,type PlatformPolicyJournalProjectionProof,type PlatformPolicyReceiptRecord } from '@ppt/platform-policy';
import { computePlatformPolicyReceiptHash,computePlatformPolicyReceiptRecordHash } from '@ppt/repositories';
import { FamilyDataStore } from '../src/main/data-store.js';

const POLICY_VERSION='33-x-memory-studio-data-store-v1';const PASSWORD='Guclu33XHafizaStudyosuParolasi!';
const directories:string[]=[];const stores:FamilyDataStore[]=[];let projectionSequence=0;
const kernel=new PlatformPolicyKernel({policyVersion:POLICY_VERSION,signingKey:Buffer.from('33-x-memory-studio-data-store-key-material','utf8'),
  applicationCapabilities:{'windows-desktop':['family.read','family.write','location.read']},consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update','delete']});
const provider:PlatformPolicyAuthorizationProvider={resolvePolicyPackage:()=>kernel.policyPackage,
  authorize:({request,nonce})=>({effectiveRequest:request,authorization:kernel.authorizeWithReceipt(request,request.occurredAt,nonce)}),
  verify:({request,receipt})=>kernel.verifyReceiptForRequest(receipt,request)};
const projectionProof=(record:PlatformPolicyReceiptRecord):PlatformPolicyJournalProjectionProof=>({schemaVersion:1,
  receiptHash:computePlatformPolicyReceiptHash(record.receipt),recordHash:computePlatformPolicyReceiptRecordHash(record),receiptNonce:record.receipt.nonce,
  entrySequence:++projectionSequence,entryHash:'d'.repeat(64),headSequence:projectionSequence,headHash:'d'.repeat(64),
  journalSizeBytes:projectionSequence*512,issuedAt:record.recordedAt,proofMac:'e'.repeat(64)});
afterEach(()=>{projectionSequence=0;for(const store of stores.splice(0)){try{store.close();}catch{/* best effort */}}
  for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
const makeStore=(governed:boolean)=>{const directory=mkdtempSync(join(tmpdir(),'ppt-33x-memory-studio-'));directories.push(directory);
  const databasePath=join(directory,'family.db');const store=new FamilyDataStore({databasePath,seed:false,...(governed?{
    archivePolicyAuthorizationProvider:provider,archivePolicyReceiptSink:{append:()=>undefined,ensure:projectionProof,verifyProjectionProof:()=>true},
    archivePolicyVersion:POLICY_VERSION,archiveClusterFence:()=>({writable:true,epoch:102})}:{})});stores.push(store);
  store.setupAdmin({familyName:'33-X Hafıza Ailesi',displayName:'33-X Aile Yöneticisi',email:'memory-33x@example.test',password:PASSWORD});
  const account=store.listAccounts()[0]!;return {databasePath,store,ownerPersonId:account.personId!,accountId:account.id};};

describe('33-X memory studio DataStore integration',()=>{
  it('fails closed before center reads or mutations when the production Life PEP is absent',async()=>{const {store}=makeStore(false);
    await expect(store.getMemoryStudioCenter()).rejects.toThrow(/policy enforcement is not composed/i);
    await expect(store.createMemoryStudioRecord({clientOperationId:'operation-no-pep-33-x',recordId:'record-no-pep-33-x',
      kind:'recipe',title:'Yerel tarif',summary:'Kullanıcı tarafından girilen aile tarifi.'})).rejects.toThrow(/policy enforcement is not composed/i);
  });

  it('persists local metadata, replays, enforces approval count and rolls back audit/outbox atomically',async()=>{
    const {databasePath,store,accountId}=makeStore(true);
    store.upsertPermission({subjectAccountId:accountId,resourceType:'memory_studio_center',resourceId:'*',actions:['read'],effect:'allow',purpose:'general'});
    store.upsertPermission({subjectAccountId:accountId,resourceType:'memory_studio_record',resourceId:'*',actions:['create','delete'],effect:'allow',purpose:'general'});
    store.upsertPermission({subjectAccountId:accountId,resourceType:'memory_time_capsule',resourceId:'*',actions:['create','update','delete'],effect:'allow',purpose:'general'});
    const recordCommand={clientOperationId:'operation-record-33-x',recordId:'record-33-x',kind:'recipe' as const,title:'Aile tarifi',
      summary:'Malzemeler kullanıcı tarafından yerel olarak yazıldı.'};
    expect(await store.createMemoryStudioRecord(recordCommand)).toMatchObject({revision:1,replayed:false,mutationKind:'record_create',
      networkUsed:false,cloudUsed:false,externalDeliveryPerformed:'not_performed'});
    expect(await store.createMemoryStudioRecord(recordCommand)).toMatchObject({revision:1,replayed:true});
    const unlockAt=new Date(Date.now()+8*86_400_000).toISOString();
    expect(await store.createMemoryTimeCapsule({clientOperationId:'operation-capsule-33-x',capsuleId:'capsule-33-x',
      title:'Geleceğe aile tarifi',memoryRecordIds:['record-33-x'],unlockAt})).toMatchObject({revision:1,mutationKind:'capsule_create'});
    expect(await store.reviewMemoryTimeCapsule({clientOperationId:'operation-approve-33-x',capsuleId:'capsule-33-x',
      expectedRevision:1,decision:'approve'})).toMatchObject({revision:2,mutationKind:'capsule_approve'});
    await expect(store.transitionMemoryTimeCapsule({clientOperationId:'operation-seal-denied-33-x',capsuleId:'capsule-33-x',
      expectedRevision:2,transition:'seal'})).rejects.toThrow(/iki ayrı hesap onayı/i);
    const center=await store.getMemoryStudioCenter();
    expect(center).toMatchObject({records:[{id:'record-33-x',status:'active'}],
      capsules:[{id:'capsule-33-x',status:'awaiting_approvals',minimumApprovals:2,approvalCount:1,
        currentAccountApprovalRecorded:true}],storageCapacity:{records:{maximum:500,used:1,remaining:499,limitReached:false},
        capsules:{maximum:200,used:1,remaining:199,limitReached:false}},
      truth:{localOnly:true,newBinaryPayloadStored:false,transcriptionPerformed:false,faceRecognitionPerformed:false,
        duplicateDetectionPerformed:false,sourceReferencesRevalidatedAtSealAndRelease:true,monotonicStateTimeEnforced:true,
        networkUsed:false,cloudUsed:false,externalDeliveryPerformed:'not_performed'}});
    expect(JSON.stringify(center)).not.toContain('"accountId"');
    expect(JSON.stringify(center)).not.toContain('"approvals"');
    expect(await store.reviewMemoryTimeCapsule({clientOperationId:'operation-revoke-33-x',capsuleId:'capsule-33-x',
      expectedRevision:2,decision:'revoke_approval'})).toMatchObject({revision:3,mutationKind:'capsule_revoke_approval'});
    expect(await store.reviewMemoryTimeCapsule({clientOperationId:'operation-reapprove-33-x',capsuleId:'capsule-33-x',
      expectedRevision:3,decision:'approve'})).toMatchObject({revision:4,mutationKind:'capsule_approve'});
    const injector=new DatabaseSync(databasePath);try{injector.exec(`CREATE TRIGGER test_33x_memory_outbox_failure BEFORE INSERT ON event_outbox WHEN NEW.event_type='memory_studio.record_create' BEGIN SELECT RAISE(ABORT,'controlled 33-X outbox failure'); END;`);}finally{injector.close();}
    await expect(store.createMemoryStudioRecord({clientOperationId:'operation-rollback-33-x',recordId:'record-rollback-33-x',
      kind:'tradition',title:'Yerel gelenek',summary:'Bu satır rollback ile kalıcılaşmamalı.'})).rejects.toThrow(/SQLite|beklenmeyen/i);
    store.close();stores.splice(stores.indexOf(store),1);const database=new DatabaseSync(databasePath,{readOnly:true});try{
      expect(database.prepare('SELECT COUNT(*) count FROM memory_studio_records').get()).toEqual({count:1});
      expect(database.prepare('SELECT COUNT(*) count FROM memory_time_capsules').get()).toEqual({count:1});
      expect(database.prepare('SELECT COUNT(*) count FROM memory_studio_mutations').get()).toEqual({count:5});
      expect(database.prepare("SELECT COUNT(*) count FROM memory_studio_records WHERE id='record-rollback-33-x'").get()).toEqual({count:0});
      const metadata=JSON.stringify({audits:database.prepare("SELECT action,resource_type,resource_id FROM audit_log WHERE action LIKE 'memory_studio.%'").all(),
        events:database.prepare("SELECT event_type,aggregate_type,aggregate_id,payload_json FROM event_outbox WHERE event_type LIKE 'memory_studio.%'").all()});
      expect(metadata).not.toContain('Malzemeler kullanıcı');expect(metadata).not.toContain('rollback ile kalıcılaşmamalı');
    }finally{database.close();}
  });
});
