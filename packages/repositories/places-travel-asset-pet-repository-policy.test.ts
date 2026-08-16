import { afterEach,describe,expect,it } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';import { join } from 'node:path';import { tmpdir } from 'node:os';
import { asCorrelationId,asFamilyId,asIsoDateTime,asPersonId,asUserId,type Clock } from '@ppt/core';
import { PlatformPolicyEnforcementPoint,PlatformPolicyKernel } from '@ppt/platform-policy';
import type { PlacesTravelCenterKey,PlacesTravelItemRow,PlacesTravelMutationRow,PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,RepositoryResult,TransactionContext } from '@ppt/repository-contracts';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';
import { SqlitePlacesTravelAssetPetRepository } from './src/places-travel-asset-pet-repository.js';
import { SqlitePlatformPolicyTransactionRepository } from './src/platform-policy-transaction-repository.js';

const NOW=asIsoDateTime('2026-08-15T16:00:00.000Z');const FAMILY=asFamilyId('family-33-v-repository');
const FOREIGN=asFamilyId('family-33-v-foreign');const ACCOUNT=asUserId('account-33-v-admin');
const ACTOR=asPersonId('person-33-v-actor');const OWNER=asPersonId('person-33-v-owner');const MEMBER=asPersonId('person-33-v-member');
const FENCE='places-travel-write';const EPOCH=100;const clock:Clock={now:()=>NOW};
const runtimes:SqliteFamilyDatabaseRuntime[]=[];const directories:string[]=[];
afterEach(()=>{for(const runtime of runtimes.splice(0))runtime.close();for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
const repositoryContext=(transaction:TransactionContext):RepositoryExecutionContext=>({transaction:transaction.transaction,
  actor:{userId:ACCOUNT,personId:ACTOR,roles:['family_admin']},correlationId:transaction.correlationId,occurredAt:transaction.occurredAt});
const openHarness=()=>{const directory=mkdtempSync(join(tmpdir(),'ppt-33v-places-travel-'));directories.push(directory);
  const runtime=new SqliteFamilyDatabaseRuntime({databasePath:join(directory,'family.db'),applicationVersion:'33-v-vitest',clock,
    skipFileMigrationSafetyBackup:true,databaseConfig:{busyTimeoutMs:5000,journalMode:'WAL',synchronous:'FULL'}});runtimes.push(runtime);
  const policyRepository=new SqlitePlatformPolicyTransactionRepository();
  expect(runtime.transactionExecutor.execute(asCorrelationId('33-v-fence'),(transaction)=>policyRepository.synchronizeFence(
    repositoryContext(transaction),{fenceName:FENCE,epoch:EPOCH,writable:true,synchronizedAt:NOW})).ok).toBe(true);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run(FAMILY,'33-V Family',NOW);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run(FOREIGN,'Foreign Family',NOW);
  const person=runtime.database.prepare('INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
  person.run(ACTOR,FAMILY,'Actor','1985-01-01','self',0,'main','active',NOW);person.run(OWNER,FAMILY,'Owner','1987-01-01','partner',0,'main','active',NOW);
  person.run(MEMBER,FAMILY,'Member','2010-01-01','child',1,'main','active',NOW);
  runtime.database.prepare('INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(ACCOUNT,'Actor','actor-33v@example.test','test-password-record',NOW,'family_admin','active',ACTOR,'2026-01-01T00:00:00.000Z');
  return {runtime,repository:new SqlitePlacesTravelAssetPetRepository(),policyRepository};};
type Harness=ReturnType<typeof openHarness>;let sequence=0;
const kernel=new PlatformPolicyKernel({policyVersion:'33-v-places-policy-v1',signingKey:Buffer.from('33-v-places-policy-test-key-material','utf8'),
  applicationCapabilities:{'windows-desktop':['family.read','family.write']},consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update','delete']});
const withReceipt=async<T>(harness:Harness,input:{readonly action:'read'|'create'|'update'|'delete';readonly resourceId:string;
  readonly ownerPersonId?:string;readonly familyId?:string},operation:(repository:SqlitePlacesTravelAssetPetRepository,
  context:PolicyAuthorizedRepositoryExecutionContext)=>RepositoryResult<T>)=>{sequence+=1;const correlationId=asCorrelationId(`places-travel-${input.action}-${sequence}`);
  const familyId=input.familyId??FAMILY;const resourceType=input.action==='read'?'places_travel_center':'places_travel_item';
  const capability=input.action==='read'?'family.read':'family.write';const pep=new PlatformPolicyEnforcementPoint({kernel,
    authorityResolver:{resolve:()=>({policyVersion:'33-v-places-policy-v1',accountId:ACCOUNT,personId:ACTOR,deviceId:'device-33-v',
      applicationId:'windows-desktop',deviceTrusted:true,membershipActive:true,roles:['family_admin'],familyIds:[familyId],
      grants:[{id:`grant-${sequence}`,subjectAccountId:ACCOUNT,resourceType,resourceId:input.resourceId,actions:[input.action],
        purposes:['general'],effect:'allow',startsAt:'2026-01-01T00:00:00.000Z'}],online:true,expiresAt:'2026-12-31T23:59:59.999Z'})},
    resourceResolver:{resolve:()=>({type:resourceType,id:input.resourceId,familyId,ownerPersonId:input.ownerPersonId??ACTOR,
      sensitivity:'highly_sensitive',dataClasses:['personal'] as const,classificationSource:'declared' as const})},
    receiptSink:{append:()=>undefined,ensure:()=>undefined},replayStore:{reserve:(reservation)=>{const result=harness.runtime.transactionExecutor.execute(
      asCorrelationId(`places-reserve-${sequence}`),(transaction)=>harness.policyRepository.reserveReplayNonce(repositoryContext(transaction),reservation));
      if(!result.ok)throw new Error(result.error.message);return result.value;}},clock:()=>NOW,nonceFactory:()=>`nonce-places-travel-${sequence}`,
    deferAllowedReceiptPersistence:true});
  return pep.execute({correlationId,action:input.action,capability,resourceType,resourceId:input.resourceId,purpose:'general'},
    ()=>({writable:true,epoch:EPOCH}),(authorization)=>harness.runtime.transactionExecutor.execute(correlationId,(transaction)=>{
      const context:PolicyAuthorizedRepositoryExecutionContext={...repositoryContext(transaction),correlationId,policyAuthorization:authorization};
      const recorded=harness.policyRepository.recordAuthorizedTransaction(context,{record:authorization.receiptRecord,fenceName:FENCE,fenceEpoch:EPOCH,fenceWritable:true});
      return recorded.ok?operation(harness.repository,context):recorded;}));};
const key:PlacesTravelCenterKey={familyId:FAMILY,accountId:ACCOUNT,actorPersonId:ACTOR,ownerPersonId:OWNER,
  centerId:`places-travel-center:${FAMILY}:${OWNER}`};
const mutation=(itemId:string,overrides:Partial<PlacesTravelMutationRow>={}):PlacesTravelMutationRow=>({id:'a'.repeat(64),familyId:FAMILY,
  ownerPersonId:OWNER,itemId,actorAccountId:ACCOUNT,actorPersonId:ACTOR,mutationKind:'item_create',clientOperationId:'operation-places-33-v',
  requestFingerprint:'b'.repeat(64),expectedRevision:0,revision:1,itemStateFingerprint:'c'.repeat(64),occurredAt:NOW,...overrides});
const item=(row:PlacesTravelMutationRow,overrides:Partial<PlacesTravelItemRow>={}):PlacesTravelItemRow=>({id:row.itemId,familyId:FAMILY,
  ownerPersonId:OWNER,kind:'stored_place',area:'places',title:'Yerel buluşma noktası',status:'active',visibility:'family_coordination',
  revision:row.revision,addressLabel:'Parkın kuzey kapısı',stateFingerprint:row.itemStateFingerprint,lastMutationId:row.id,
  createdAt:NOW,updatedAt:NOW,...overrides});

describe('33-V places travel repository policy boundary',()=>{
  it('persists and reads an exact receipt-bound local place',async()=>{const h=openHarness();const row=mutation('place-33-v');
    expect((await withReceipt(h,{action:'create',resourceId:row.itemId,ownerPersonId:OWNER},(repo,ctx)=>{const ledger=repo.insertMutation(ctx,row);return ledger.ok?repo.insertItem(ctx,item(row)):ledger;})).ok).toBe(true);
    const loaded=await withReceipt(h,{action:'read',resourceId:'*',ownerPersonId:OWNER},(repo,ctx)=>repo.loadCenter(ctx,key));
    expect(loaded).toMatchObject({ok:true,value:{owner:{id:OWNER},items:[{id:row.itemId,addressLabel:'Parkın kuzey kapısı'}]}});
  });
  it('rejects forged owner and foreign-family receipts without persistence',async()=>{const h=openHarness();const row=mutation('forged-33-v');
    expect((await withReceipt(h,{action:'read',resourceId:'*',ownerPersonId:ACTOR},(repo,ctx)=>repo.loadCenter(ctx,key))).ok).toBe(false);
    expect((await withReceipt(h,{action:'create',resourceId:row.itemId,ownerPersonId:ACTOR},(repo,ctx)=>repo.insertMutation(ctx,row))).ok).toBe(false);
    expect((await withReceipt(h,{action:'create',resourceId:row.itemId,ownerPersonId:OWNER,familyId:FOREIGN},(repo,ctx)=>repo.insertMutation(ctx,row))).ok).toBe(false);
    expect((h.runtime.database.prepare('SELECT COUNT(*) AS count FROM places_travel_mutations').get() as {count:number}).count).toBe(0);
  });
  it('rejects a non-owner forging a private item and rolls back its mutation',async()=>{const h=openHarness();const row=mutation('private-33-v');
    const result=await withReceipt(h,{action:'create',resourceId:row.itemId,ownerPersonId:OWNER},(repo,ctx)=>{const ledger=repo.insertMutation(ctx,row);
      return ledger.ok?repo.insertItem(ctx,item(row,{visibility:'private'})):ledger;});expect(result.ok).toBe(false);
    expect((h.runtime.database.prepare('SELECT COUNT(*) AS count FROM places_travel_mutations').get() as {count:number}).count).toBe(0);
  });
  it('enforces kind-area and active unique participant invariants plus immutable ledgers',async()=>{const h=openHarness();const bad=mutation('bad-area-33-v');
    expect((await withReceipt(h,{action:'create',resourceId:bad.itemId,ownerPersonId:OWNER},(repo,ctx)=>{const ledger=repo.insertMutation(ctx,bad);return ledger.ok?repo.insertItem(ctx,item(bad,{area:'travel'})):ledger;})).ok).toBe(false);
    const row=mutation('trip-33-v',{id:'d'.repeat(64),clientOperationId:'operation-trip'});
    expect((await withReceipt(h,{action:'create',resourceId:row.itemId,ownerPersonId:OWNER},(repo,ctx)=>{const ledger=repo.insertMutation(ctx,row);
      return ledger.ok?repo.insertItem(ctx,item(row,{kind:'travel_plan',area:'travel',addressLabel:undefined,
        offlineFallbackLabel:'Yerel buluşma etiketi',participantPersonIds:[OWNER,MEMBER],startsAt:NOW,
        endsAt:asIsoDateTime('2026-08-16T16:00:00.000Z')})):ledger;})).ok).toBe(true);
    expect(()=>h.runtime.database.prepare('DELETE FROM places_travel_items WHERE id=?').run(row.itemId)).toThrow(/durable/u);
    expect(()=>h.runtime.database.prepare('UPDATE places_travel_mutations SET client_operation_id=? WHERE id=?').run('forged',row.id)).toThrow(/immutable/u);
  });
  it('exposes only payload-free metadata to policy preauthorization',async()=>{const h=openHarness();const row=mutation('preauth-33-v');
    expect((await withReceipt(h,{action:'create',resourceId:row.itemId,ownerPersonId:OWNER},(repo,ctx)=>{const ledger=repo.insertMutation(ctx,row);
      return ledger.ok?repo.insertItem(ctx,item(row,{note:'Özel seyahat notu'})):ledger;})).ok).toBe(true);
    const result=h.runtime.transactionExecutor.execute(asCorrelationId('places-preauth-read'),(transaction)=>h.repository.findItemForPolicyResolution(repositoryContext(transaction),row.itemId));
    expect(result).toMatchObject({ok:true,value:{id:row.itemId,familyId:FAMILY,ownerPersonId:OWNER,revision:1,status:'active'}});
    expect(JSON.stringify(result)).not.toContain('Özel seyahat notu');expect(Object.keys(result.ok&&result.value?result.value:{}).sort())
      .toEqual(['familyId','id','ownerPersonId','revision','stateFingerprint','status','visibility']);
  });
});
