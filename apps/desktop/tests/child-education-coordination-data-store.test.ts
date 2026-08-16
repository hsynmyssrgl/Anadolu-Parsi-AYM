import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import { computePlatformPolicyReceiptHash, computePlatformPolicyReceiptRecordHash } from '@ppt/repositories';
import type { CreateChildEducationItemInput } from '@ppt/domain';
import { FamilyDataStore } from '../src/main/data-store.js';

const POLICY_VERSION='33-u-child-education-data-store-v1';
const PASSWORD='Guclu33UCocukEgitimParolasi!';
const directories:string[]=[];const stores:FamilyDataStore[]=[];let projectionSequence=0;
const kernel=new PlatformPolicyKernel({
  policyVersion:POLICY_VERSION,signingKey:Buffer.from('33-u-child-education-data-store-policy-key','utf8'),
  applicationCapabilities:{'windows-desktop':['family.read','family.write']},consentRequiredCapabilities:[],
  onlineOnlyCapabilities:[],writeActions:['create','update','delete']
});
const provider:PlatformPolicyAuthorizationProvider={
  resolvePolicyPackage:()=>kernel.policyPackage,
  authorize:({request,nonce})=>({effectiveRequest:request,authorization:kernel.authorizeWithReceipt(request,request.occurredAt,nonce)}),
  verify:({request,receipt})=>kernel.verifyReceiptForRequest(receipt,request)
};
const projectionProof=(record:PlatformPolicyReceiptRecord):PlatformPolicyJournalProjectionProof=>({
  schemaVersion:1,receiptHash:computePlatformPolicyReceiptHash(record.receipt),recordHash:computePlatformPolicyReceiptRecordHash(record),
  receiptNonce:record.receipt.nonce,entrySequence:++projectionSequence,entryHash:'d'.repeat(64),headSequence:projectionSequence,
  headHash:'d'.repeat(64),journalSizeBytes:projectionSequence*512,issuedAt:record.recordedAt,proofMac:'e'.repeat(64)
});
afterEach(()=>{
  projectionSequence=0;
  for(const store of stores.splice(0)){try{store.close();}catch{/* best effort */}}
  for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});
});
const makeStore=(governed:boolean)=>{
  const directory=mkdtempSync(join(tmpdir(),'ppt-33u-child-education-'));directories.push(directory);
  const databasePath=join(directory,'family.db');
  const store=new FamilyDataStore({databasePath,seed:false,...(governed?{
    archivePolicyAuthorizationProvider:provider,
    archivePolicyReceiptSink:{append:()=>undefined,ensure:projectionProof,verifyProjectionProof:()=>true},
    archivePolicyVersion:POLICY_VERSION,archiveClusterFence:()=>({writable:true,epoch:99})
  }:{})});stores.push(store);
  store.setupAdmin({familyName:'33-U Çocuk Eğitim Ailesi',displayName:'33-U Aile Yöneticisi',email:'child-33u@example.test',password:PASSWORD});
  const child=store.createMember({displayName:'33-U Ergen',birthDate:'2011-06-01',relationshipType:'Çocuk',generation:1,branch:'Ana Dal'});
  return {databasePath,store,childPersonId:child.entityId};
};

describe('33-U child education DataStore integration',()=>{
  it('fails closed before child reads or writes when production Life PEP is absent',async()=>{
    const {store,childPersonId}=makeStore(false);
    await expect(store.getChildEducationCenter(childPersonId)).rejects.toThrow(/policy enforcement is not composed/i);
    await expect(store.createChildEducationItem({clientOperationId:'operation-child-no-pep',itemId:'child-item-no-pep',
      childPersonId,kind:'homework',title:'Matematik ödevi',visibility:'family_coordination',subjectLabel:'Matematik',
      dueAt:'2026-08-20T15:00:00.000Z'}))
      .rejects.toThrow(/policy enforcement is not composed/i);
  });

  it('persists, replays, protects teen privacy, updates, deletes and atomically rolls back child-classified records',async()=>{
    const {databasePath,store,childPersonId}=makeStore(true);
    const account=store.listAccounts()[0]!;
    store.upsertPermission({subjectAccountId:account.id,resourceType:'child_education_item',resourceId:'*',
      actions:['read','create','update','delete'],effect:'allow',purpose:'general'});
    expect(await store.getChildEducationCenter(childPersonId)).toMatchObject({childPersonId,ageBand:'teen',viewMode:'teen_standard',items:[],
      truth:{localOnly:true,childDataClassEnforced:true,aiProcessingAllowed:false,externalSharingAllowed:false}});
    const homework={clientOperationId:'operation-homework-33-u',itemId:'homework-33-u',childPersonId,kind:'homework' as const,
      title:'Matematik ödevi',visibility:'family_coordination' as const,subjectLabel:'Matematik',dueAt:'2026-08-20T15:00:00.000Z',
      note:'33-U-CHILD-PLAINTEXT-CANARY'};
    expect(await store.createChildEducationItem(homework)).toMatchObject({revision:1,replayed:false,mutationKind:'item_create'});
    expect(await store.createChildEducationItem(homework)).toMatchObject({revision:1,replayed:true});
    await expect(store.createChildEducationItem({...homework,title:'Değiştirilmiş ödev'})).rejects.toThrow(/CONFLICT|çatış|fingerprint|parmak/i);
    await expect(store.createChildEducationItem({clientOperationId:'operation-private-denied-33-u',itemId:'private-33-u',childPersonId,
      kind:'book',title:'Özel günlük kitabı',visibility:'adolescent_private'})).rejects.toThrow(/AUTHORIZATION|yetki|özel alan/i);
    expect(await store.createChildEducationItem({clientOperationId:'operation-pickup-33-u',itemId:'pickup-33-u',childPersonId,
      kind:'pickup_authority',title:'Antrenman teslim planı',visibility:'family_coordination',authorityReferenceId:'temporary-credential-ref-33-p',
      scheduledAt:'2026-08-16T08:00:00.000Z',dueAt:'2026-08-16T18:00:00.000Z'}))
      .toMatchObject({revision:1,mutationKind:'item_create'});
    expect(await store.createChildEducationItem({clientOperationId:'operation-budget-33-u',itemId:'budget-33-u',childPersonId,
      kind:'allowance_budget',title:'Aylık kitap bütçesi',visibility:'family_coordination',amountMinor:25_000,currency:'TRY'}))
      .toMatchObject({revision:1,mutationKind:'item_create'});
    const coverageInputs=[
      {clientOperationId:'operation-school-coverage-33-u',itemId:'school-coverage-33-u',childPersonId,kind:'school',title:'Örnek okul',visibility:'family_coordination',institutionLabel:'Örnek okul'},
      {clientOperationId:'operation-class-coverage-33-u',itemId:'class-coverage-33-u',childPersonId,kind:'class',title:'10-A sınıfı',visibility:'family_coordination',institutionLabel:'Örnek okul',classLabel:'10-A'},
      {clientOperationId:'operation-timetable-coverage-33-u',itemId:'timetable-coverage-33-u',childPersonId,kind:'timetable',title:'Pazartesi matematik',visibility:'family_coordination',subjectLabel:'Matematik',scheduledAt:'2026-08-17T08:30:00.000Z',recurrence:'Her pazartesi'},
      {clientOperationId:'operation-exam-coverage-33-u',itemId:'exam-coverage-33-u',childPersonId,kind:'exam',title:'Fen sınavı',visibility:'family_coordination',subjectLabel:'Fen',scheduledAt:'2026-08-21T09:00:00.000Z'},
      {clientOperationId:'operation-event-coverage-33-u',itemId:'event-coverage-33-u',childPersonId,kind:'school_event',title:'Okul gezisi',visibility:'family_coordination',institutionLabel:'Örnek okul',scheduledAt:'2026-08-22T07:30:00.000Z'},
      {clientOperationId:'operation-transport-coverage-33-u',itemId:'transport-coverage-33-u',childPersonId,kind:'transport_plan',title:'Sabah okul servisi',visibility:'family_coordination',transportMode:'school_service',scheduledAt:'2026-08-17T07:15:00.000Z'},
      {clientOperationId:'operation-course-coverage-33-u',itemId:'course-coverage-33-u',childPersonId,kind:'course',title:'Kodlama kursu',visibility:'family_coordination',institutionLabel:'Yerel kurs',scheduledAt:'2026-08-19T17:00:00.000Z'},
      {clientOperationId:'operation-sport-coverage-33-u',itemId:'sport-coverage-33-u',childPersonId,kind:'sport',title:'Yüzme antrenmanı',visibility:'family_coordination',institutionLabel:'Yerel spor merkezi',scheduledAt:'2026-08-20T16:00:00.000Z'},
      {clientOperationId:'operation-certificate-coverage-33-u',itemId:'certificate-coverage-33-u',childPersonId,kind:'certificate',title:'Yerel kurs sertifikası',visibility:'family_coordination',institutionLabel:'Yerel kurs'},
      {clientOperationId:'operation-book-coverage-33-u',itemId:'book-coverage-33-u',childPersonId,kind:'book',title:'Okuma listesi kitabı',visibility:'family_coordination'},
      {clientOperationId:'operation-goal-coverage-33-u',itemId:'goal-coverage-33-u',childPersonId,kind:'education_goal',title:'Okuma hedefi',visibility:'family_coordination',progressBasisPoints:2500,dueAt:'2026-09-01T18:00:00.000Z'}
    ] as const satisfies readonly CreateChildEducationItemInput[];
    for(const input of coverageInputs){
      expect(await store.createChildEducationItem(input)).toMatchObject({revision:1,mutationKind:'item_create'});
    }
    expect(await store.updateChildEducationItem({clientOperationId:'operation-homework-update-33-u',itemId:homework.itemId,
      childPersonId,expectedRevision:1,status:'submitted'})).toMatchObject({previousRevision:1,revision:2,mutationKind:'item_update'});
    expect(await store.deleteChildEducationItem({clientOperationId:'operation-pickup-delete-33-u',itemId:'pickup-33-u',childPersonId,
      expectedRevision:1,reason:'Teslim planı yerel olarak sona erdi.'})).toMatchObject({previousRevision:1,revision:2,mutationKind:'item_delete'});

    const center=await store.getChildEducationCenter(childPersonId);
    expect(center).toMatchObject({countsByArea:{schoolwork:5,events_access:2,activities:4,money_goals:2},
      truth:{schoolPortalSync:'not_configured',teacherMessaging:'not_performed',liveTransportTracking:'not_performed',
        pickupCredentialIssuance:'managed_separately_in_identity_center',allowancePaymentExecution:'not_performed',
        certificateVerification:'not_performed',healthDataDuplicated:false}});
    expect(center.items.find((entry)=>entry.id===homework.itemId)).toMatchObject({status:'submitted',revision:2});
    expect(center.items.find((entry)=>entry.id==='pickup-33-u')).toMatchObject({status:'deleted',title:'Silindi',revision:2});
    expect(center.items.find((entry)=>entry.id==='class-coverage-33-u')).toMatchObject({classLabel:'10-A'});
    expect(center.items.find((entry)=>entry.id==='event-coverage-33-u')).toMatchObject({scheduledAt:'2026-08-22T07:30:00.000Z'});
    expect(center.items.find((entry)=>entry.id==='certificate-coverage-33-u')).toMatchObject({certificateStatus:'locally_recorded_unverified'});
    expect(JSON.stringify(center)).not.toContain('policyReceipt');expect(JSON.stringify(center)).not.toContain('stateFingerprint');

    const injector=new DatabaseSync(databasePath);
    try{injector.exec(`CREATE TRIGGER test_33u_child_outbox_failure BEFORE INSERT ON event_outbox WHEN NEW.event_type='child_education.item_create' BEGIN SELECT RAISE(ABORT,'controlled 33-U child outbox failure'); END;`);}finally{injector.close();}
    await expect(store.createChildEducationItem({clientOperationId:'operation-child-rollback-33-u',itemId:'course-rollback-33-u',
      childPersonId,kind:'course',title:'Kodlama kursu',visibility:'family_coordination',institutionLabel:'Yerel Kurs',scheduledAt:'2026-08-23T17:00:00.000Z'}))
      .rejects.toThrow(/SQLite|beklenmeyen/i);

    store.close();stores.splice(stores.indexOf(store),1);
    const database=new DatabaseSync(databasePath,{readOnly:true});
    try{
      expect(database.prepare('SELECT COUNT(*) count FROM child_education_items').get()).toEqual({count:14});
      expect(database.prepare('SELECT COUNT(*) count FROM child_education_mutations').get()).toEqual({count:16});
      expect(database.prepare("SELECT COUNT(*) count FROM child_education_items WHERE id='course-rollback-33-u'").get()).toEqual({count:0});
      expect(database.prepare("SELECT COUNT(*) count FROM audit_log WHERE action LIKE 'child_education.%'").get()).toEqual({count:16});
      expect(database.prepare("SELECT COUNT(*) count FROM event_outbox WHERE event_type LIKE 'child_education.%'").get()).toEqual({count:16});
      const metadata=JSON.stringify({
        audits:database.prepare("SELECT action,resource_type,resource_id FROM audit_log WHERE action LIKE 'child_education.%'").all(),
        events:database.prepare("SELECT event_type,aggregate_type,aggregate_id,payload_json FROM event_outbox WHERE event_type LIKE 'child_education.%'").all()
      });
      expect(metadata).not.toContain('33-U-CHILD-PLAINTEXT-CANARY');
      expect(metadata).not.toContain('temporary-credential-ref-33-p');
    }finally{database.close();}
  });
});
