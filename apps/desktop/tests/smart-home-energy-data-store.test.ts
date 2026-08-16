import { DatabaseSync } from 'node:sqlite';
import { afterEach,describe,expect,it } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';import { join } from 'node:path';import { tmpdir } from 'node:os';
import { asIsoDateTime } from '@ppt/core';
import { PlatformPolicyKernel,type PlatformPolicyAuthorizationProvider,type PlatformPolicyJournalProjectionProof,type PlatformPolicyReceiptRecord } from '@ppt/platform-policy';
import { computePlatformPolicyReceiptHash,computePlatformPolicyReceiptRecordHash } from '@ppt/repositories';
import { FamilyDataStore } from '../src/main/data-store.js';

const POLICY_VERSION='33-y-smart-home-data-store-v1';const PASSWORD='Guclu33YAkilliEvParolasi!';const MANIFEST='a'.repeat(64);
const directories:string[]=[];const stores:FamilyDataStore[]=[];let projectionSequence=0;
let now=asIsoDateTime(new Date().toISOString());
const kernel=new PlatformPolicyKernel({policyVersion:POLICY_VERSION,signingKey:Buffer.from('33-y-smart-home-data-store-key-material','utf8'),
  applicationCapabilities:{'windows-desktop':['family.read','family.write','location.read']},consentRequiredCapabilities:[],onlineOnlyCapabilities:[],
  writeActions:['create','update','delete']});
const provider:PlatformPolicyAuthorizationProvider={resolvePolicyPackage:()=>kernel.policyPackage,
  authorize:({request,nonce})=>({effectiveRequest:request,authorization:kernel.authorizeWithReceipt(request,request.occurredAt,nonce)}),
  verify:({request,receipt})=>kernel.verifyReceiptForRequest(receipt,request)};
const projectionProof=(record:PlatformPolicyReceiptRecord):PlatformPolicyJournalProjectionProof=>({schemaVersion:1,
  receiptHash:computePlatformPolicyReceiptHash(record.receipt),recordHash:computePlatformPolicyReceiptRecordHash(record),receiptNonce:record.receipt.nonce,
  entrySequence:++projectionSequence,entryHash:'d'.repeat(64),headSequence:projectionSequence,headHash:'d'.repeat(64),
  journalSizeBytes:projectionSequence*512,issuedAt:record.recordedAt,proofMac:'e'.repeat(64)});
afterEach(()=>{projectionSequence=0;now=asIsoDateTime(new Date().toISOString());for(const store of stores.splice(0)){try{store.close();}catch{/* best effort */}}
  for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
const makeStore=(governed:boolean)=>{const directory=mkdtempSync(join(tmpdir(),'ppt-33y-smart-home-'));directories.push(directory);
  const databasePath=join(directory,'family.db');const store=new FamilyDataStore({databasePath,seed:false,clock:{now:()=>now},...(governed?{
    archivePolicyAuthorizationProvider:provider,archivePolicyReceiptSink:{append:()=>undefined,ensure:projectionProof,verifyProjectionProof:()=>true},
    archivePolicyVersion:POLICY_VERSION,archiveClusterFence:()=>({writable:true,epoch:103})}:{})});stores.push(store);
  store.setupAdmin({familyName:'33-Y Akıllı Ev Ailesi',displayName:'33-Y Aile Yöneticisi',email:'smart-home-33y@example.test',password:PASSWORD});
  const account=store.listAccounts()[0]!;return{databasePath,store,accountId:account.id,ownerPersonId:account.personId!};};
const allow=(store:FamilyDataStore,accountId:string)=>{for(const [resourceType,actions] of [
  ['smart_home_energy_center',['read']],['smart_home_device',['create','update']],['smart_home_observation',['create']],
  ['smart_home_camera_consent',['create','delete']],['smart_home_settings',['create','update']]] as const)
  store.upsertPermission({subjectAccountId:accountId,resourceType,resourceId:'*',actions:[...actions],effect:'allow',purpose:'general'});};

describe('33-Y smart home DataStore integration',()=>{
  it('fails closed when the production Life PEP is absent',async()=>{const{store}=makeStore(false);
    await expect(store.getSmartHomeEnergyCenter()).rejects.toThrow(/policy enforcement is not composed/i);
    await expect(store.setSmartHomeProcessing({clientOperationId:'operation-no-pep-33-y',expectedRevision:0,enabled:true,
      reason:'Yerel işleme açma denemesi.'})).rejects.toThrow(/policy enforcement is not composed/i);
  });

  it('persists signed device, scalar energy, visible consent and fail-closed settings without leaking trust hashes',async()=>{
    const{store,accountId}=makeStore(true);allow(store,accountId);
    const device={clientOperationId:'operation-device-33-y',deviceId:'doorbell-33-y',adapterId:'matter-adapter-33-y',
      providerId:'provider-local-33-y',kind:'doorbell' as const,label:'Ön kapı zili',room:'Giriş',localIdentifierSha256:'b'.repeat(64),
      adapterManifestSha256:MANIFEST,adapterSignerKeyId:'signer-33-y',adapterSignatureVerified:true as const};
    expect(await store.registerSmartHomeDevice(device)).toMatchObject({revision:1,replayed:false,providerActionPerformed:'not_performed'});
    expect(await store.registerSmartHomeDevice(device)).toMatchObject({revision:1,replayed:true});
    const observation={clientOperationId:'operation-door-33-y',observationId:'door-observation-33-y',deviceId:'doorbell-33-y',
      expectedDeviceRevision:1,kind:'door_open' as const,booleanValue:true,observedAt:now,sourceManifestSha256:MANIFEST};
    await expect(store.recordSmartHomeObservation(observation)).rejects.toThrow(/yerel işleme açık olmalıdır/i);
    expect(await store.setSmartHomeProcessing({clientOperationId:'operation-processing-33-y',expectedRevision:0,enabled:true,
      reason:'Yerel sensör metadatası özeti.'})).toMatchObject({mutationKind:'processing_enable',revision:1});
    expect(await store.recordSmartHomeObservation(observation)).toMatchObject({mutationKind:'observation_record',revision:1,networkUsed:false,cloudUsed:false});
    const expiresAt=new Date(Date.parse(now)+5*60_000).toISOString();
    expect(await store.grantSmartHomeCameraConsent({clientOperationId:'operation-consent-33-y',consentId:'consent-33-y',deviceId:'doorbell-33-y',
      purpose:'doorbell_answer',expiresAt})).toMatchObject({mutationKind:'camera_consent_grant',revision:1});
    const center=await store.getSmartHomeEnergyCenter();expect(center).toMatchObject({devices:[{id:'doorbell-33-y',signedAdapterEvidencePersisted:true}],
      observations:[{id:'door-observation-33-y',kind:'door_open',booleanValue:true}],observationTotal:1,observationsTruncated:false,
      cameraConsents:[{id:'consent-33-y',visibleIndicatorRequired:true,status:'active',effectiveStatus:'active'}],
      cameraConsentTotal:1,cameraConsentsTruncated:false,storageCapacity:{devices:{current:1,maximum:500},
        observations:{current:1,maximum:50_000},cameraConsents:{current:1,maximum:2_000},mutations:{current:4,maximum:100_000}},
      settings:{processingEnabled:true,revision:1},
      truth:{matterCommissioningPerformed:false,liveProviderConnectionTested:false,liveDeviceControlPerformed:false,
        sensorProviderIngestionPerformed:false,rawCameraOrAudioStored:false,hiddenSurveillanceProhibited:true,
        maximumCameraConsentMinutes:60,networkUsedByCurrentImplementation:false,processingDisabledBlocksNewObservations:true,
        expiredConsentPresentedAsActive:false,boundedStorageCapsEnforced:true,automaticRetentionRecoveryImplemented:false}});
    const serialized=JSON.stringify(center);expect(serialized).not.toContain(MANIFEST);expect(serialized).not.toContain('localIdentifierSha256');
    expect(serialized).not.toContain('grantedByAccountId');expect(serialized).not.toContain('grantedByPersonId');
    now=asIsoDateTime(new Date(Date.parse(now)+6*60_000).toISOString());expect(await store.getSmartHomeEnergyCenter()).toMatchObject({cameraConsents:[{id:'consent-33-y',
      status:'active',effectiveStatus:'expired'}]});
    expect(await store.revokeSmartHomeCameraConsent({clientOperationId:'operation-revoke-33-y',consentId:'consent-33-y',expectedRevision:1}))
      .toMatchObject({mutationKind:'camera_consent_revoke',revision:2});
  });

  it('rolls back current rows, mutation, audit and outbox together on downstream failure',async()=>{const{databasePath,store,accountId}=makeStore(true);allow(store,accountId);
    await store.setSmartHomeProcessing({clientOperationId:'operation-settings-create-33-y',expectedRevision:0,enabled:true,reason:'Yerel işleme.'});
    const injector=new DatabaseSync(databasePath);try{injector.exec(`CREATE TRIGGER test_33y_outbox_failure BEFORE INSERT ON event_outbox
      WHEN NEW.event_type='smart_home.processing_disable' BEGIN SELECT RAISE(ABORT,'controlled 33-Y outbox failure'); END;`);}finally{injector.close();}
    await expect(store.setSmartHomeProcessing({clientOperationId:'operation-settings-rollback-33-y',expectedRevision:1,enabled:false,
      reason:'Rollback kanıtı.'})).rejects.toThrow(/SQLite|beklenmeyen/i);
    store.close();stores.splice(stores.indexOf(store),1);const database=new DatabaseSync(databasePath,{readOnly:true});try{
      expect(database.prepare('SELECT processing_enabled,revision FROM smart_home_settings').get()).toEqual({processing_enabled:1,revision:1});
      expect(database.prepare('SELECT COUNT(*) count FROM smart_home_mutations').get()).toEqual({count:1});
      expect(database.prepare("SELECT COUNT(*) count FROM audit_log WHERE action='smart_home.processing_disable'").get()).toEqual({count:0});
      expect(database.prepare("SELECT COUNT(*) count FROM event_outbox WHERE event_type='smart_home.processing_disable'").get()).toEqual({count:0});
    }finally{database.close();}
  });
});
