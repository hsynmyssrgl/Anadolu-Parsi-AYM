import { DatabaseSync } from 'node:sqlite';import { afterEach,describe,expect,it } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';import { join } from 'node:path';import { tmpdir } from 'node:os';
import { PlatformPolicyKernel,type PlatformPolicyAuthorizationProvider,type PlatformPolicyJournalProjectionProof,type PlatformPolicyReceiptRecord } from '@ppt/platform-policy';
import { computePlatformPolicyReceiptHash,computePlatformPolicyReceiptRecordHash } from '@ppt/repositories';
import { FamilyDataStore } from '../src/main/data-store.js';
const POLICY_VERSION='33-v-places-travel-data-store-v1';const PASSWORD='Guclu33VYerSeyahatParolasi!';
const directories:string[]=[];const stores:FamilyDataStore[]=[];let projectionSequence=0;
const kernel=new PlatformPolicyKernel({policyVersion:POLICY_VERSION,signingKey:Buffer.from('33-v-places-travel-data-store-key','utf8'),
  applicationCapabilities:{'windows-desktop':['family.read','family.write']},consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update','delete']});
const provider:PlatformPolicyAuthorizationProvider={resolvePolicyPackage:()=>kernel.policyPackage,
  authorize:({request,nonce})=>({effectiveRequest:request,authorization:kernel.authorizeWithReceipt(request,request.occurredAt,nonce)}),
  verify:({request,receipt})=>kernel.verifyReceiptForRequest(receipt,request)};
const projectionProof=(record:PlatformPolicyReceiptRecord):PlatformPolicyJournalProjectionProof=>({schemaVersion:1,
  receiptHash:computePlatformPolicyReceiptHash(record.receipt),recordHash:computePlatformPolicyReceiptRecordHash(record),receiptNonce:record.receipt.nonce,
  entrySequence:++projectionSequence,entryHash:'d'.repeat(64),headSequence:projectionSequence,headHash:'d'.repeat(64),
  journalSizeBytes:projectionSequence*512,issuedAt:record.recordedAt,proofMac:'e'.repeat(64)});
afterEach(()=>{projectionSequence=0;for(const store of stores.splice(0)){try{store.close();}catch{/* best effort */}}
  for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
const makeStore=(governed:boolean)=>{const directory=mkdtempSync(join(tmpdir(),'ppt-33v-places-travel-'));directories.push(directory);
  const databasePath=join(directory,'family.db');const store=new FamilyDataStore({databasePath,seed:false,...(governed?{
    archivePolicyAuthorizationProvider:provider,archivePolicyReceiptSink:{append:()=>undefined,ensure:projectionProof,verifyProjectionProof:()=>true},
    archivePolicyVersion:POLICY_VERSION,archiveClusterFence:()=>({writable:true,epoch:100})}: {})});stores.push(store);
  store.setupAdmin({familyName:'33-V Yer ve Seyahat Ailesi',displayName:'33-V Aile Yöneticisi',email:'places-33v@example.test',password:PASSWORD});
  const account=store.listAccounts()[0]!;return {databasePath,store,ownerPersonId:account.personId!,accountId:account.id};};

describe('33-V places travel asset and pet DataStore integration',()=>{
  it('fails closed before reads or writes when production Life PEP is absent',async()=>{const {store,ownerPersonId}=makeStore(false);
    await expect(store.getPlacesTravelCenter(ownerPersonId)).rejects.toThrow(/policy enforcement is not composed/i);
    await expect(store.createPlacesTravelItem({clientOperationId:'operation-place-no-pep',itemId:'place-no-pep',ownerPersonId,
      kind:'stored_place',title:'Yerel yer',visibility:'private',addressLabel:'Adres'})).rejects.toThrow(/policy enforcement is not composed/i);
  });
  it('persists replays updates deletes and atomically rolls back local-only workflows',async()=>{
    const {databasePath,store,ownerPersonId,accountId}=makeStore(true);store.upsertPermission({subjectAccountId:accountId,
      resourceType:'places_travel_item',resourceId:'*',actions:['read','create','update','delete'],effect:'allow',purpose:'general'});
    expect(await store.getPlacesTravelCenter(ownerPersonId)).toMatchObject({ownerPersonId,items:[],truth:{localOnly:true,mapProviderConfigured:false,
      externalBookingPerformed:'not_performed',paymentExecutionPerformed:'not_performed',petHealthAdviceProvided:false}});
    const place={clientOperationId:'operation-place-33-v',itemId:'place-33-v',ownerPersonId,kind:'stored_place' as const,
      title:'Buluşma noktası',visibility:'private' as const,addressLabel:'Parkın kuzey kapısı',latitudeE6:41015137,longitudeE6:28979430,
      offlineFallbackLabel:'Kuzey kapısı',note:'33-V-PLACES-PLAINTEXT-CANARY'};
    expect(await store.createPlacesTravelItem(place)).toMatchObject({revision:1,replayed:false,mutationKind:'item_create'});
    expect(await store.createPlacesTravelItem(place)).toMatchObject({revision:1,replayed:true});
    await expect(store.createPlacesTravelItem({...place,title:'Değiştirilmiş yer'})).rejects.toThrow(/CONFLICT|çatış|farklı/i);
    expect(await store.createPlacesTravelItem({clientOperationId:'operation-pet-33-v',itemId:'pet-33-v',ownerPersonId,
      kind:'pet_care_record',title:'Aşı belgesi hatırlatması',visibility:'private',petReferenceId:'opaque-pet',petWorkflow:'vaccination'}))
      .toMatchObject({revision:1,mutationKind:'item_create'});
    expect(await store.createPlacesTravelItem({clientOperationId:'operation-pack-33-v',itemId:'pack-33-v',ownerPersonId,
      kind:'offline_travel_pack',title:'Çevrimdışı gezi paketi',visibility:'private',archiveItemId:'opaque-archive-pack'}))
      .toMatchObject({revision:1,mutationKind:'item_create'});
    expect(await store.updatePlacesTravelItem({clientOperationId:'operation-place-update-33-v',itemId:place.itemId,ownerPersonId,
      expectedRevision:1,status:'completed'})).toMatchObject({previousRevision:1,revision:2,mutationKind:'item_update'});
    expect(await store.deletePlacesTravelItem({clientOperationId:'operation-pet-delete-33-v',itemId:'pet-33-v',ownerPersonId,
      expectedRevision:1,reason:'Yerel evcil hayvan hatırlatması sona erdi.'})).toMatchObject({previousRevision:1,revision:2,mutationKind:'item_delete'});
    const center=await store.getPlacesTravelCenter(ownerPersonId);expect(center).toMatchObject({countsByArea:{places:1,moving:0,pet_care:0,travel:1},
      truth:{schoolOrTravelProviderSync:'not_configured',liveTransportTrackingPerformed:'not_performed',documentVerificationPerformed:'not_performed',
        ocrSuggestionAutomaticallyAccepted:false,offlinePackDeliveryPerformed:'not_performed',externalSharingAllowed:false}});
    expect(center.items.find((entry)=>entry.id===place.itemId)).toMatchObject({status:'completed',revision:2});
    expect(center.items.find((entry)=>entry.id==='pet-33-v')).toMatchObject({status:'deleted',title:'Silindi',revision:2});
    expect(JSON.stringify(center)).not.toContain('policyReceipt');expect(JSON.stringify(center)).not.toContain('stateFingerprint');
    const injector=new DatabaseSync(databasePath);try{injector.exec(`CREATE TRIGGER test_33v_places_outbox_failure BEFORE INSERT ON event_outbox WHEN NEW.event_type='places_travel.item_create' BEGIN SELECT RAISE(ABORT,'controlled 33-V outbox failure'); END;`);}finally{injector.close();}
    await expect(store.createPlacesTravelItem({clientOperationId:'operation-rollback-33-v',itemId:'album-rollback-33-v',ownerPersonId,
      kind:'travel_album',title:'Yerel albüm',visibility:'private',archiveItemId:'opaque-album'})).rejects.toThrow(/SQLite|beklenmeyen/i);
    store.close();stores.splice(stores.indexOf(store),1);const database=new DatabaseSync(databasePath,{readOnly:true});try{
      expect(database.prepare('SELECT COUNT(*) count FROM places_travel_items').get()).toEqual({count:3});
      expect(database.prepare('SELECT COUNT(*) count FROM places_travel_mutations').get()).toEqual({count:5});
      expect(database.prepare("SELECT COUNT(*) count FROM places_travel_items WHERE id='album-rollback-33-v'").get()).toEqual({count:0});
      expect(database.prepare("SELECT COUNT(*) count FROM audit_log WHERE action LIKE 'places_travel.%'").get()).toEqual({count:5});
      expect(database.prepare("SELECT COUNT(*) count FROM event_outbox WHERE event_type LIKE 'places_travel.%'").get()).toEqual({count:5});
      const metadata=JSON.stringify({audits:database.prepare("SELECT action,resource_type,resource_id FROM audit_log WHERE action LIKE 'places_travel.%'").all(),
        events:database.prepare("SELECT event_type,aggregate_type,aggregate_id,payload_json FROM event_outbox WHERE event_type LIKE 'places_travel.%'").all()});
      expect(metadata).not.toContain('33-V-PLACES-PLAINTEXT-CANARY');expect(metadata).not.toContain('opaque-pet');expect(metadata).not.toContain('opaque-archive-pack');
    }finally{database.close();}
  });
});
