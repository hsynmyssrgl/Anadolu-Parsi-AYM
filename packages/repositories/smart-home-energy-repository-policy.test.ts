import { afterEach,describe,expect,it } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';import { join } from 'node:path';import { tmpdir } from 'node:os';
import { asCorrelationId,asFamilyId,asIsoDateTime,asPersonId,asUserId,type Clock } from '@ppt/core';
import { PlatformPolicyEnforcementPoint,PlatformPolicyKernel } from '@ppt/platform-policy';
import type { PolicyAuthorizedRepositoryExecutionContext,RepositoryExecutionContext,RepositoryResult,SmartHomeDeviceRow,
  SmartHomeCameraConsentRow,SmartHomeEnergyCenterKey,SmartHomeMutationRow,SmartHomeObservationRow,SmartHomeSettingsRow,
  TransactionContext } from '@ppt/repository-contracts';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';
import { SqlitePlatformPolicyTransactionRepository } from './src/platform-policy-transaction-repository.js';
import { SqliteSmartHomeEnergyRepository } from './src/smart-home-energy-repository.js';

let now=asIsoDateTime('2026-08-15T12:00:00.000Z');const FAMILY=asFamilyId('family-33-y-repository');
const ACCOUNT=asUserId('account-33-y-owner');const OWNER=asPersonId('person-33-y-owner');const OTHER=asPersonId('person-33-y-other');
const FENCE='smart-home-write';const EPOCH=103;const MANIFEST='a'.repeat(64);const clock:Clock={now:()=>now};
const runtimes:SqliteFamilyDatabaseRuntime[]=[];const directories:string[]=[];
afterEach(()=>{now=asIsoDateTime('2026-08-15T12:00:00.000Z');for(const runtime of runtimes.splice(0))runtime.close();
  for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
const repositoryContext=(transaction:TransactionContext):RepositoryExecutionContext=>({transaction:transaction.transaction,
  actor:{userId:ACCOUNT,personId:OWNER,roles:['family_admin']},correlationId:transaction.correlationId,occurredAt:transaction.occurredAt});
const openHarness=()=>{const directory=mkdtempSync(join(tmpdir(),'ppt-33y-smart-home-'));directories.push(directory);
  const runtime=new SqliteFamilyDatabaseRuntime({databasePath:join(directory,'family.db'),applicationVersion:'33-y-vitest',clock,
    skipFileMigrationSafetyBackup:true,databaseConfig:{busyTimeoutMs:5000,journalMode:'WAL',synchronous:'FULL'}});runtimes.push(runtime);
  const policyRepository=new SqlitePlatformPolicyTransactionRepository();
  expect(runtime.transactionExecutor.execute(asCorrelationId('33-y-fence'),transaction=>policyRepository.synchronizeFence(repositoryContext(transaction),
    {fenceName:FENCE,epoch:EPOCH,writable:true,synchronizedAt:now})).ok).toBe(true);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run(FAMILY,'33-Y Family',now);
  const person=runtime.database.prepare('INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
  person.run(OWNER,FAMILY,'Owner','1985-01-01','self',0,'main','active',now);person.run(OTHER,FAMILY,'Other','1986-01-01','partner',0,'main','active',now);
  runtime.database.prepare('INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(ACCOUNT,'Owner','owner-33y@example.test','test-password-record',now,'family_admin','active',OWNER,'2026-01-01T00:00:00.000Z');
  return{runtime,repository:new SqliteSmartHomeEnergyRepository(),policyRepository};};
type Harness=ReturnType<typeof openHarness>;let sequence=0;
const kernel=new PlatformPolicyKernel({policyVersion:'33-y-smart-home-policy-v1',signingKey:Buffer.from('33-y-smart-home-policy-key-material','utf8'),
  applicationCapabilities:{'windows-desktop':['family.read','family.write']},consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update','delete']});
type ResourceType='smart_home_energy_center'|'smart_home_device'|'smart_home_observation'|'smart_home_camera_consent'|'smart_home_settings';
const withReceipt=async<T>(harness:Harness,input:{action:'read'|'create'|'update'|'delete';resourceType:ResourceType;resourceId:string;ownerPersonId?:string},
  operation:(repository:SqliteSmartHomeEnergyRepository,context:PolicyAuthorizedRepositoryExecutionContext)=>RepositoryResult<T>)=>{
  sequence+=1;const correlationId=asCorrelationId(`smart-home-${input.action}-${sequence}`);const capability=input.action==='read'?'family.read':'family.write';
  const pep=new PlatformPolicyEnforcementPoint({kernel,authorityResolver:{resolve:()=>({policyVersion:'33-y-smart-home-policy-v1',accountId:ACCOUNT,
    personId:OWNER,deviceId:'device-33-y',applicationId:'windows-desktop',deviceTrusted:true,membershipActive:true,roles:['family_admin'],familyIds:[FAMILY],
    grants:[{id:`grant-${sequence}`,subjectAccountId:ACCOUNT,resourceType:input.resourceType,resourceId:input.resourceId,actions:[input.action],
      purposes:['general'],effect:'allow',startsAt:'2026-01-01T00:00:00.000Z'}],online:true,expiresAt:'2027-12-31T23:59:59.999Z'})},
    resourceResolver:{resolve:()=>({type:input.resourceType,id:input.resourceId,familyId:FAMILY,ownerPersonId:input.ownerPersonId??OWNER,
      sensitivity:'highly_sensitive',dataClasses:['personal'] as const,classificationSource:'declared' as const})},
    receiptSink:{append:()=>undefined,ensure:()=>undefined},replayStore:{reserve:reservation=>{const result=harness.runtime.transactionExecutor.execute(
      asCorrelationId(`smart-home-reserve-${sequence}`),transaction=>harness.policyRepository.reserveReplayNonce(repositoryContext(transaction),reservation));
      if(!result.ok)throw new Error(result.error.message);return result.value;}},clock:()=>now,nonceFactory:()=>`nonce-smart-home-${sequence}`,
    deferAllowedReceiptPersistence:true});
  return pep.execute({correlationId,action:input.action,capability,resourceType:input.resourceType,resourceId:input.resourceId,purpose:'general'},
    ()=>({writable:true,epoch:EPOCH}),authorization=>harness.runtime.transactionExecutor.execute(correlationId,transaction=>{
      const context:PolicyAuthorizedRepositoryExecutionContext={...repositoryContext(transaction),correlationId,policyAuthorization:authorization};
      const recorded=harness.policyRepository.recordAuthorizedTransaction(context,{record:authorization.receiptRecord,fenceName:FENCE,
        fenceEpoch:EPOCH,fenceWritable:true});return recorded.ok?operation(harness.repository,context):recorded;}));};
const key:SmartHomeEnergyCenterKey={familyId:FAMILY,accountId:ACCOUNT,actorPersonId:OWNER,ownerPersonId:OWNER,
  centerId:`smart-home-energy:${FAMILY}:${OWNER}`};
const mutation=(type:SmartHomeMutationRow['resourceType'],id:string,kind:SmartHomeMutationRow['mutationKind'],overrides:Partial<SmartHomeMutationRow>={}):SmartHomeMutationRow=>({
  id:'1'.repeat(64),familyId:FAMILY,ownerPersonId:OWNER,resourceType:type,resourceId:id,actorAccountId:ACCOUNT,actorPersonId:OWNER,
  mutationKind:kind,clientOperationId:`operation-${id}`,requestFingerprint:'2'.repeat(64),expectedRevision:0,revision:1,
  resourceStateFingerprint:'3'.repeat(64),occurredAt:now,...overrides});
const device=(row:SmartHomeMutationRow,overrides:Partial<SmartHomeDeviceRow>={}):SmartHomeDeviceRow=>({id:row.resourceId,familyId:FAMILY,
  ownerPersonId:OWNER,adapterId:'adapter-33-y',providerId:'provider-33-y',kind:'energy_meter',label:'Yerel enerji sayacı',status:'active',
  localIdentifierSha256:'4'.repeat(64),adapterManifestSha256:MANIFEST,adapterSignerKeyId:'signer-33-y',signedAdapterEvidencePersisted:true,
  revision:row.revision,stateFingerprint:row.resourceStateFingerprint,lastMutationId:row.id,createdAt:now,updatedAt:now,...overrides});

describe('33-Y smart home repository policy boundary',()=>{
  it('persists exact owner-bound signed device metadata and loads the bounded center',async()=>{const harness=openHarness();
    const created=mutation('smart_home_device','meter-33-y','device_register');expect((await withReceipt(harness,{action:'create',resourceType:'smart_home_device',resourceId:created.resourceId},
      (repo,ctx)=>{const ledger=repo.insertMutation(ctx,created);return ledger.ok?repo.insertDevice(ctx,device(created)):ledger;})).ok).toBe(true);
    const loaded=await withReceipt(harness,{action:'read',resourceType:'smart_home_energy_center',resourceId:'*'},(repo,ctx)=>repo.loadCenter(ctx,key));
    expect(loaded).toMatchObject({ok:true,value:{devices:[{id:'meter-33-y',signedAdapterEvidencePersisted:true}],observationTotal:0,
      cameraConsentTotal:0,storageUsage:{deviceCount:1,observationCount:0,cameraConsentCount:0,mutationCount:1}}});
  });

  it('rejects a forged owner receipt without leaving mutation evidence',async()=>{const harness=openHarness();
    const forged=mutation('smart_home_device','forged-33-y','device_register');
    expect((await withReceipt(harness,{action:'create',resourceType:'smart_home_device',resourceId:forged.resourceId,ownerPersonId:OTHER},
      (repo,ctx)=>repo.insertMutation(ctx,forged))).ok).toBe(false);
    expect(harness.runtime.database.prepare('SELECT COUNT(*) count FROM smart_home_mutations').get()).toEqual({count:0});
  });

  it('binds scalar observation to the active device and exact signed manifest',async()=>{const harness=openHarness();
    const created=mutation('smart_home_device','meter-observation-33-y','device_register');await withReceipt(harness,
      {action:'create',resourceType:'smart_home_device',resourceId:created.resourceId},(repo,ctx)=>{const ledger=repo.insertMutation(ctx,created);
        return ledger.ok?repo.insertDevice(ctx,device(created)):ledger;});
    const recorded=mutation('smart_home_observation','observation-33-y','observation_record',{id:'5'.repeat(64),clientOperationId:'operation-observation-33-y',
      requestFingerprint:'6'.repeat(64),resourceStateFingerprint:'7'.repeat(64)});
    const observation:SmartHomeObservationRow={id:recorded.resourceId,familyId:FAMILY,ownerPersonId:OWNER,deviceId:created.resourceId,
      kind:'energy_kilowatt_hour',unit:'kilowatt_hour',numericValue:8.25,observedAt:asIsoDateTime('2026-08-15T11:59:00.000Z'),recordedAt:now,
      sourceManifestSha256:MANIFEST,stateFingerprint:recorded.resourceStateFingerprint,lastMutationId:recorded.id};
    expect((await withReceipt(harness,{action:'create',resourceType:'smart_home_observation',resourceId:recorded.resourceId},(repo,ctx)=>{
      const ledger=repo.insertMutation(ctx,recorded);return ledger.ok?repo.insertObservation(ctx,observation):ledger;})).ok).toBe(false);
    expect(harness.runtime.database.prepare('SELECT COUNT(*) count FROM smart_home_mutations WHERE id=?').get(recorded.id)).toEqual({count:0});
    const settingsId=`smart-home-settings:${OWNER}`;const enabled=mutation('smart_home_settings',settingsId,'processing_enable',{id:'b'.repeat(64),
      clientOperationId:'operation-settings-enabled-33-y',requestFingerprint:'c'.repeat(64),resourceStateFingerprint:'d'.repeat(64)});
    const settings:SmartHomeSettingsRow={id:settingsId,familyId:FAMILY,ownerPersonId:OWNER,processingEnabled:true,
      cameraAccessDefaultDenied:true,hiddenSurveillanceProhibited:true,revision:1,stateFingerprint:enabled.resourceStateFingerprint,
      lastMutationId:enabled.id,createdAt:now,updatedAt:now};
    expect((await withReceipt(harness,{action:'create',resourceType:'smart_home_settings',resourceId:settingsId},(repo,ctx)=>{
      const ledger=repo.insertMutation(ctx,enabled);return ledger.ok?repo.insertSettings(ctx,settings):ledger;})).ok).toBe(true);
    expect((await withReceipt(harness,{action:'create',resourceType:'smart_home_observation',resourceId:recorded.resourceId},(repo,ctx)=>{
      const ledger=repo.insertMutation(ctx,recorded);return ledger.ok?repo.insertObservation(ctx,observation):ledger;})).ok).toBe(true);
    const forged=mutation('smart_home_observation','observation-forged-33-y','observation_record',{id:'8'.repeat(64),
      clientOperationId:'operation-observation-forged-33-y',requestFingerprint:'9'.repeat(64),resourceStateFingerprint:'a'.repeat(64)});
    expect((await withReceipt(harness,{action:'create',resourceType:'smart_home_observation',resourceId:forged.resourceId},(repo,ctx)=>{
      const ledger=repo.insertMutation(ctx,forged);return ledger.ok?repo.insertObservation(ctx,{...observation,id:forged.resourceId,
        stateFingerprint:forged.resourceStateFingerprint,lastMutationId:forged.id,sourceManifestSha256:'b'.repeat(64)}):ledger;})).ok).toBe(false);
    expect(harness.runtime.database.prepare('SELECT COUNT(*) count FROM smart_home_observations').get()).toEqual({count:1});
  });

  it('rejects incompatible camera purpose and backward device state time at the SQL boundary',async()=>{const harness=openHarness();
    const created=mutation('smart_home_device','camera-policy-33-y','device_register',{id:'e'.repeat(64),
      clientOperationId:'operation-camera-policy-33-y',requestFingerprint:'f'.repeat(64),resourceStateFingerprint:'0'.repeat(64)});
    const camera=device(created,{kind:'camera',label:'Yerel kamera'});expect((await withReceipt(harness,
      {action:'create',resourceType:'smart_home_device',resourceId:created.resourceId},(repo,ctx)=>{const ledger=repo.insertMutation(ctx,created);
        return ledger.ok?repo.insertDevice(ctx,camera):ledger;})).ok).toBe(true);
    const consentMutation=mutation('smart_home_camera_consent','consent-purpose-33-y','camera_consent_grant',{id:'6'.repeat(64),
      clientOperationId:'operation-consent-purpose-33-y',requestFingerprint:'7'.repeat(64),resourceStateFingerprint:'8'.repeat(64)});
    const consent:SmartHomeCameraConsentRow={id:consentMutation.resourceId,familyId:FAMILY,ownerPersonId:OWNER,deviceId:camera.id,
      purpose:'doorbell_answer',status:'active',grantedByAccountId:ACCOUNT,grantedByPersonId:OWNER,visibleIndicatorRequired:true,
      expiresAt:asIsoDateTime('2026-08-15T12:30:00.000Z'),revision:1,stateFingerprint:consentMutation.resourceStateFingerprint,
      lastMutationId:consentMutation.id,createdAt:now,updatedAt:now};
    expect((await withReceipt(harness,{action:'create',resourceType:'smart_home_camera_consent',resourceId:consent.id},(repo,ctx)=>{
      const ledger=repo.insertMutation(ctx,consentMutation);return ledger.ok?repo.insertConsent(ctx,consent):ledger;})).ok).toBe(false);
    now=asIsoDateTime('2026-08-15T11:59:59.999Z');const update=mutation('smart_home_device',camera.id,'device_status_update',{id:'9'.repeat(64),
      clientOperationId:'operation-camera-time-33-y',requestFingerprint:'a'.repeat(64),expectedRevision:1,revision:2,
      resourceStateFingerprint:'b'.repeat(64),occurredAt:now});
    expect((await withReceipt(harness,{action:'update',resourceType:'smart_home_device',resourceId:camera.id},(repo,ctx)=>{
      const ledger=repo.insertMutation(ctx,update);return ledger.ok?repo.saveDevice(ctx,{...camera,status:'offline',revision:2,
        stateFingerprint:update.resourceStateFingerprint,lastMutationId:update.id,updatedAt:now},1):ledger;})).ok).toBe(false);
    expect(harness.runtime.database.prepare('SELECT status,revision FROM smart_home_devices WHERE id=?').get(camera.id))
      .toEqual({status:'active',revision:1});
  });

  it('returns payload-free metadata for central preauthorization',async()=>{const harness=openHarness();const created=mutation('smart_home_device','preauth-33-y','device_register');
    await withReceipt(harness,{action:'create',resourceType:'smart_home_device',resourceId:created.resourceId},(repo,ctx)=>{const ledger=repo.insertMutation(ctx,created);
      return ledger.ok?repo.insertDevice(ctx,device(created,{label:'Gizli olmayan etiket'})):ledger;});
    const result=harness.runtime.transactionExecutor.execute(asCorrelationId('smart-home-preauth'),transaction=>
      harness.repository.resolvePolicyResource(repositoryContext(transaction),'smart_home_device',created.resourceId));
    expect(result).toMatchObject({ok:true,value:{id:created.resourceId,familyId:FAMILY,ownerPersonId:OWNER,revision:1,status:'active'}});
    expect(Object.keys(result.ok&&result.value?result.value:{}).sort()).toEqual(['familyId','id','ownerPersonId','revision','stateFingerprint','status']);
    expect(JSON.stringify(result)).not.toContain('Gizli olmayan etiket');
  });
});
