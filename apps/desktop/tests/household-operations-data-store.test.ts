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
import { FamilyDataStore } from '../src/main/data-store.js';

const POLICY_VERSION='33-t-household-data-store-v1';
const PASSWORD='Guclu33THaneOperasyonParolasi!';
const directories:string[]=[];
const stores:FamilyDataStore[]=[];
let projectionSequence=0;

const kernel=new PlatformPolicyKernel({
  policyVersion:POLICY_VERSION,
  signingKey:Buffer.from('33-t-household-data-store-policy-key','utf8'),
  applicationCapabilities:{'windows-desktop':['family.read','family.write']},
  consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update','delete']
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
  const directory=mkdtempSync(join(tmpdir(),'ppt-33t-household-data-store-'));directories.push(directory);
  const databasePath=join(directory,'family.db');
  const store=new FamilyDataStore({
    databasePath,seed:false,
    ...(governed?{
      archivePolicyAuthorizationProvider:provider,
      archivePolicyReceiptSink:{append:()=>undefined,ensure:projectionProof,verifyProjectionProof:()=>true},
      archivePolicyVersion:POLICY_VERSION,
      archiveClusterFence:()=>({writable:true,epoch:98})
    }:{})
  });
  stores.push(store);
  store.setupAdmin({familyName:'33-T Hane Operasyonları Ailesi',displayName:'33-T Hane Yöneticisi',email:'household-33t@example.test',password:PASSWORD});
  return {directory,databasePath,store};
};

describe('33-T household operations DataStore integration',()=>{
  it('fails closed before reads or writes when the production Life PEP is absent',async()=>{
    const {store}=makeStore(false);
    await expect(store.getHouseholdOperationsCenter()).rejects.toThrow(/policy enforcement is not composed/i);
    await expect(store.createHouseholdOperationItem({
      expectedCenterRevision:0,clientOperationId:'operation-household-no-pep',itemId:'shopping-list-no-pep',kind:'shopping_list',title:'Yerel liste'
    })).rejects.toThrow(/policy enforcement is not composed/i);
  });

  it('persists, replays, filters, updates, deletes and atomically rolls back governed household records',async()=>{
    const {databasePath,store}=makeStore(true);
    const owner=store.listAccounts()[0]!;
    const member=store.createMember({displayName:'33-T Aile Üyesi',relationshipType:'Çocuk',generation:1,branch:'Ana Dal'});
    expect(await store.getHouseholdOperationsCenter()).toMatchObject({revision:0,items:[],truth:{localOnly:true,paymentExecution:'not_performed',remoteAccessControl:'not_configured',keyCodeStored:false}});

    const recipeInput={
      expectedCenterRevision:0,clientOperationId:'operation-household-recipe-33-t',itemId:'recipe-household-33-t',kind:'recipe' as const,
      title:'Sütlü çorba',ingredientNames:['süt','pirinç'],allergenCodes:['süt']
    };
    expect(await store.createHouseholdOperationItem(recipeInput)).toMatchObject({centerRevision:1,itemRevision:1,replayed:false});
    expect(await store.createHouseholdOperationItem(recipeInput)).toMatchObject({centerRevision:1,itemRevision:1,replayed:true});
    await expect(store.createHouseholdOperationItem({...recipeInput,title:'Değiştirilmiş tarif'})).rejects.toThrow(/CONFLICT|çatış|fingerprint|parmak/i);

    await expect(store.createHouseholdOperationItem({
      expectedCenterRevision:1,clientOperationId:'operation-household-meal-denied-33-t',itemId:'meal-denied-33-t',kind:'meal_plan',title:'Uygunsuz öğün',parentItemId:recipeInput.itemId,avoidedAllergenCodes:['süt']
    })).rejects.toThrow(/CONFLICT|alerjen/i);
    expect(await store.createHouseholdOperationItem({
      expectedCenterRevision:1,clientOperationId:'operation-household-meal-safe-33-t',itemId:'meal-safe-33-t',kind:'meal_plan',title:'Güvenli öğün',parentItemId:recipeInput.itemId,avoidedAllergenCodes:['fıstık']
    })).toMatchObject({centerRevision:2});

    expect(await store.createHouseholdOperationItem({
      expectedCenterRevision:2,clientOperationId:'operation-household-expense-33-t',itemId:'expense-household-33-t',kind:'shared_expense',title:'Ortak market gideri',
      amountMinor:12_500,currency:'TRY',splitShares:[{personId:owner.personId!,basisPoints:6000},{personId:member.entityId,basisPoints:4000}],
      note:'33-T-HOUSEHOLD-PLAINTEXT-CANARY'
    })).toMatchObject({centerRevision:3});
    expect(await store.createHouseholdOperationItem({
      expectedCenterRevision:3,clientOperationId:'operation-household-delivery-33-t',itemId:'delivery-household-33-t',kind:'delivery',title:'Paket',providerLabel:'Yerel Taşıyıcı',trackingLastFour:'A729'
    })).toMatchObject({centerRevision:4});
    expect(await store.updateHouseholdOperationItem({
      expectedCenterRevision:4,expectedItemRevision:1,clientOperationId:'operation-household-delivered-33-t',itemId:'delivery-household-33-t',status:'delivered'
    })).toMatchObject({centerRevision:5,itemRevision:2,mutationKind:'item_update'});
    expect(await store.deleteHouseholdOperationItem({
      expectedCenterRevision:5,expectedItemRevision:1,clientOperationId:'operation-household-delete-33-t',itemId:'meal-safe-33-t',reason:'Öğün planı artık gerekli değil.'
    })).toMatchObject({centerRevision:6,itemRevision:2,mutationKind:'item_delete'});

    const center=await store.getHouseholdOperationsCenter();
    expect(center).toMatchObject({
      revision:6,
      countsByArea:{meals:1,expenses:1,deliveries:1},
      truth:{externalShoppingOrder:'not_performed',recipeMedicalAdvice:'not_provided',carrierSynchronization:'not_performed',petCareDelivery:'not_performed'}
    });
    expect(center.items.find((item)=>item.id==='meal-safe-33-t')).toMatchObject({status:'deleted',revision:2});
    expect(center.items.find((item)=>item.id==='delivery-household-33-t')).toMatchObject({status:'delivered',trackingLastFour:'A729'});
    expect(JSON.stringify(center)).not.toContain('TRK-1234567890');
    expect(JSON.stringify(center)).not.toContain('policyReceipt');
    expect(JSON.stringify(center)).not.toContain('stateFingerprint');

    const injector=new DatabaseSync(databasePath);
    try{injector.exec(`CREATE TRIGGER test_33t_household_outbox_failure BEFORE INSERT ON event_outbox WHEN NEW.event_type='household_operations.item_create' BEGIN SELECT RAISE(ABORT,'controlled 33-T household outbox failure'); END;`);}finally{injector.close();}
    await expect(store.createHouseholdOperationItem({
      expectedCenterRevision:6,clientOperationId:'operation-household-rollback-33-t',itemId:'pet-care-rollback-33-t',kind:'pet_care',title:'Mavi için su',opaquePetReference:'pet-local-mavi'
    })).rejects.toThrow(/SQLite|beklenmeyen/i);

    store.close();stores.splice(stores.indexOf(store),1);
    const database=new DatabaseSync(databasePath,{readOnly:true});
    try{
      expect(database.prepare('SELECT revision FROM household_operations_centers WHERE id=?').get(center.centerId)).toEqual({revision:6});
      expect(database.prepare('SELECT COUNT(*) count FROM household_operation_items').get()).toEqual({count:4});
      expect(database.prepare('SELECT COUNT(*) count FROM household_operation_mutations').get()).toEqual({count:6});
      expect(database.prepare("SELECT COUNT(*) count FROM household_operation_items WHERE id='pet-care-rollback-33-t'").get()).toEqual({count:0});
      expect(database.prepare("SELECT COUNT(*) count FROM audit_log WHERE action LIKE 'household_operations.%'").get()).toEqual({count:6});
      expect(database.prepare("SELECT COUNT(*) count FROM event_outbox WHERE event_type LIKE 'household_operations.%'").get()).toEqual({count:6});
      const metadata=JSON.stringify({
        audits:database.prepare("SELECT action,resource_type,resource_id FROM audit_log WHERE action LIKE 'household_operations.%'").all(),
        events:database.prepare("SELECT event_type,aggregate_type,aggregate_id,payload_json FROM event_outbox WHERE event_type LIKE 'household_operations.%'").all()
      });
      expect(metadata).not.toContain('33-T-HOUSEHOLD-PLAINTEXT-CANARY');
      expect(metadata).not.toContain('Yerel Taşıyıcı');
    }finally{database.close();}
  });
});
