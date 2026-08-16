import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId, asUserId, type Clock } from '@ppt/core';
import { PlatformPolicyEnforcementPoint, PlatformPolicyKernel } from '@ppt/platform-policy';
import type {
  ChildEducationCenterKey,
  ChildEducationItemRow,
  ChildEducationMutationRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult,
  TransactionContext
} from '@ppt/repository-contracts';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';
import { SqliteChildEducationCoordinationRepository } from './src/child-education-coordination-repository.js';
import { SqlitePlatformPolicyTransactionRepository } from './src/platform-policy-transaction-repository.js';

const NOW=asIsoDateTime('2026-08-15T15:30:00.000Z');
const FAMILY=asFamilyId('family-33-u-repository');
const FOREIGN=asFamilyId('family-33-u-foreign');
const ACCOUNT=asUserId('account-33-u-parent');
const PARENT=asPersonId('person-33-u-parent');
const CHILD=asPersonId('person-33-u-child');
const FENCE='child-education-write';const EPOCH=99;const clock:Clock={now:()=>NOW};
const runtimes:SqliteFamilyDatabaseRuntime[]=[];const directories:string[]=[];
afterEach(()=>{for(const runtime of runtimes.splice(0))runtime.close();for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});

const repositoryContext=(transaction:TransactionContext):RepositoryExecutionContext=>({transaction:transaction.transaction,
  actor:{userId:ACCOUNT,personId:PARENT,roles:['family_admin']},correlationId:transaction.correlationId,occurredAt:transaction.occurredAt});

const openHarness=()=>{
  const directory=mkdtempSync(join(tmpdir(),'ppt-33u-child-education-'));directories.push(directory);
  const runtime=new SqliteFamilyDatabaseRuntime({databasePath:join(directory,'family.db'),applicationVersion:'33-u-vitest',clock,
    skipFileMigrationSafetyBackup:true,databaseConfig:{busyTimeoutMs:5_000,journalMode:'WAL',synchronous:'FULL'}});runtimes.push(runtime);
  const policyRepository=new SqlitePlatformPolicyTransactionRepository();
  expect(runtime.transactionExecutor.execute(asCorrelationId('33-u-fence'),(transaction)=>policyRepository.synchronizeFence(
    repositoryContext(transaction),{fenceName:FENCE,epoch:EPOCH,writable:true,synchronizedAt:NOW})).ok).toBe(true);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run(FAMILY,'33-U Family',NOW);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run(FOREIGN,'Foreign Family',NOW);
  const person=runtime.database.prepare('INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
  person.run(PARENT,FAMILY,'Parent','1985-01-01','self',0,'main','active',NOW);
  person.run(CHILD,FAMILY,'Teen','2011-06-01','child',1,'main','active',NOW);
  runtime.database.prepare('INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(ACCOUNT,'Parent','parent-33u@example.test','test-password-record',NOW,'family_admin','active',PARENT,'2026-01-01T00:00:00.000Z');
  return {runtime,repository:new SqliteChildEducationCoordinationRepository(),policyRepository};
};
type Harness=ReturnType<typeof openHarness>;let sequence=0;
const kernel=new PlatformPolicyKernel({policyVersion:'33-u-child-policy-v1',signingKey:Buffer.from('33-u-child-policy-test-key-material-2026','utf8'),
  applicationCapabilities:{'windows-desktop':['family.read','family.write']},consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update','delete']});

const withReceipt=async<T>(harness:Harness,input:{readonly action:'read'|'create'|'update'|'delete';readonly resourceId:string;
  readonly ownerPersonId?:string;readonly familyId?:string;readonly includeChildClass?:boolean},
  operation:(repository:SqliteChildEducationCoordinationRepository,context:PolicyAuthorizedRepositoryExecutionContext)=>RepositoryResult<T>)=>{
  sequence+=1;const correlationId=asCorrelationId(`child-education-${input.action}-${sequence}`);const familyId=input.familyId??FAMILY;
  const resourceType=input.action==='read'?'child_education_center':'child_education_item';const capability=input.action==='read'?'family.read':'family.write';
  const pep=new PlatformPolicyEnforcementPoint({kernel,authorityResolver:{resolve:()=>({policyVersion:'33-u-child-policy-v1',
    accountId:ACCOUNT,personId:PARENT,deviceId:'device-33-u',applicationId:'windows-desktop',deviceTrusted:true,membershipActive:true,
    roles:['family_admin'],familyIds:[familyId],grants:[{id:`grant-${sequence}`,subjectAccountId:ACCOUNT,resourceType,resourceId:input.resourceId,
      actions:[input.action],purposes:['general'],effect:'allow',startsAt:'2026-01-01T00:00:00.000Z'}],online:true,expiresAt:'2026-12-31T23:59:59.999Z'})},
    resourceResolver:{resolve:()=>({type:resourceType,id:input.resourceId,familyId,ownerPersonId:input.ownerPersonId??PARENT,
      sensitivity:'highly_sensitive',...(input.includeChildClass===false
        ? {dataClasses:['personal'] as const,classificationSource:'declared' as const}
        : {dataClasses:['child'] as const,classificationSource:'declared' as const})})},
    receiptSink:{append:()=>undefined,ensure:()=>undefined},replayStore:{reserve:(reservation)=>{const result=harness.runtime.transactionExecutor.execute(
      asCorrelationId(`child-reserve-${sequence}`),(transaction)=>harness.policyRepository.reserveReplayNonce(repositoryContext(transaction),reservation));
      if(!result.ok)throw new Error(result.error.message);return result.value;}},clock:()=>NOW,nonceFactory:()=>`nonce-child-education-${sequence}`,
    deferAllowedReceiptPersistence:true});
  return pep.execute({correlationId,action:input.action,capability,resourceType,resourceId:input.resourceId,purpose:'general'},
    ()=>({writable:true,epoch:EPOCH}),(authorization)=>harness.runtime.transactionExecutor.execute(correlationId,(transaction)=>{
      const context:PolicyAuthorizedRepositoryExecutionContext={...repositoryContext(transaction),correlationId,policyAuthorization:authorization};
      const recorded=harness.policyRepository.recordAuthorizedTransaction(context,{record:authorization.receiptRecord,fenceName:FENCE,fenceEpoch:EPOCH,fenceWritable:true});
      return recorded.ok?operation(harness.repository,context):recorded;
    }));
};

const key:ChildEducationCenterKey={familyId:FAMILY,accountId:ACCOUNT,actorPersonId:PARENT,childPersonId:CHILD,
  centerId:`child-education-center:${FAMILY}:${CHILD}`};
const mutation=(itemId:string,overrides:Partial<ChildEducationMutationRow>={}):ChildEducationMutationRow=>({id:'a'.repeat(64),
  familyId:FAMILY,childPersonId:CHILD,itemId,actorAccountId:ACCOUNT,actorPersonId:PARENT,mutationKind:'item_create',
  clientOperationId:'operation-child-education-33-u',requestFingerprint:'b'.repeat(64),expectedRevision:0,revision:1,
  itemStateFingerprint:'c'.repeat(64),occurredAt:NOW,...overrides});
const item=(row:ChildEducationMutationRow,overrides:Partial<ChildEducationItemRow>={}):ChildEducationItemRow=>({id:row.itemId,
  familyId:FAMILY,childPersonId:CHILD,kind:'school',area:'schoolwork',title:'Yerel okul planı',status:'active',
  visibility:'family_coordination',privacyExplanationCode:'family_admin_coordination',revision:row.revision,institutionLabel:'Örnek okul',
  stateFingerprint:row.itemStateFingerprint,lastMutationId:row.id,createdAt:NOW,updatedAt:NOW,...overrides});

describe('33-U child education repository policy boundary',()=>{
  it('persists and reads an exact child-classified receipt-bound item',async()=>{
    const harness=openHarness();const row=mutation('school-33-u');
    expect((await withReceipt(harness,{action:'create',resourceId:row.itemId,ownerPersonId:CHILD},(repository,context)=>{
      const ledger=repository.insertMutation(context,row);return ledger.ok?repository.insertItem(context,item(row)):ledger;})).ok).toBe(true);
    const loaded=await withReceipt(harness,{action:'read',resourceId:'*'},(repository,context)=>repository.loadCenter(context,key));
    expect(loaded).toMatchObject({ok:true,value:{child:{id:CHILD,birthDate:'2011-06-01'},items:[{id:row.itemId,visibility:'family_coordination'}]}});
  });

  it('rejects forged owner, foreign family and missing child classification before persistence',async()=>{
    const harness=openHarness();const row=mutation('forged-33-u');
    expect((await withReceipt(harness,{action:'create',resourceId:row.itemId,ownerPersonId:PARENT},(repository,context)=>repository.insertMutation(context,row))).ok).toBe(false);
    expect((await withReceipt(harness,{action:'create',resourceId:row.itemId,ownerPersonId:CHILD,familyId:FOREIGN},(repository,context)=>repository.insertMutation(context,row))).ok).toBe(false);
    expect((await withReceipt(harness,{action:'create',resourceId:row.itemId,ownerPersonId:CHILD,includeChildClass:false},(repository,context)=>repository.insertMutation(context,row))).ok).toBe(false);
    expect((harness.runtime.database.prepare('SELECT COUNT(*) AS count FROM child_education_mutations').get() as {count:number}).count).toBe(0);
  });

  it('rejects a guardian forging an adolescent-private item and rolls back its mutation',async()=>{
    const harness=openHarness();const row=mutation('private-33-u');
    const result=await withReceipt(harness,{action:'create',resourceId:row.itemId,ownerPersonId:CHILD},(repository,context)=>{
      const ledger=repository.insertMutation(context,row);return ledger.ok?repository.insertItem(context,item(row,{visibility:'adolescent_private',
        privacyExplanationCode:'adolescent_owner_private'})):ledger;});
    expect(result.ok).toBe(false);
    expect((harness.runtime.database.prepare('SELECT COUNT(*) AS count FROM child_education_mutations').get() as {count:number}).count).toBe(0);
  });

  it('enforces kind-area invariants and immutable physical ledgers',async()=>{
    const harness=openHarness();const bad=mutation('bad-area-33-u');
    expect((await withReceipt(harness,{action:'create',resourceId:bad.itemId,ownerPersonId:CHILD},(repository,context)=>{
      const ledger=repository.insertMutation(context,bad);return ledger.ok?repository.insertItem(context,item(bad,{area:'activities'})):ledger;})).ok).toBe(false);
    const incomplete=mutation('class-no-label-33-u',{id:'e'.repeat(64),clientOperationId:'operation-class-no-label',
      itemStateFingerprint:'f'.repeat(64)});
    expect((await withReceipt(harness,{action:'create',resourceId:incomplete.itemId,ownerPersonId:CHILD},(repository,context)=>{
      const ledger=repository.insertMutation(context,incomplete);return ledger.ok?repository.insertItem(context,item(incomplete,{
        kind:'class',institutionLabel:'Örnek okul',classLabel:undefined})):ledger;})).ok).toBe(false);
    const row=mutation('immutable-33-u',{id:'d'.repeat(64),clientOperationId:'operation-immutable'});
    expect((await withReceipt(harness,{action:'create',resourceId:row.itemId,ownerPersonId:CHILD},(repository,context)=>{
      const ledger=repository.insertMutation(context,row);return ledger.ok?repository.insertItem(context,item(row)):ledger;})).ok).toBe(true);
    expect(()=>harness.runtime.database.prepare('DELETE FROM child_education_items WHERE id=?').run(row.itemId)).toThrow(/durable/u);
    expect(()=>harness.runtime.database.prepare('UPDATE child_education_mutations SET client_operation_id=? WHERE id=?').run('forged',row.id)).toThrow(/immutable/u);
  });

  it('exposes only payload-free metadata to policy preauthorization',async()=>{
    const harness=openHarness();const row=mutation('preauth-33-u');
    expect((await withReceipt(harness,{action:'create',resourceId:row.itemId,ownerPersonId:CHILD},(repository,context)=>{
      const ledger=repository.insertMutation(context,row);return ledger.ok?repository.insertItem(context,item(row,{note:'Özel eğitim notu'})):ledger;})).ok).toBe(true);
    const result=harness.runtime.transactionExecutor.execute(asCorrelationId('child-preauth-read'),(transaction)=>
      harness.repository.findItemForPolicyResolution(repositoryContext(transaction),row.itemId));
    expect(result).toMatchObject({ok:true,value:{id:row.itemId,familyId:FAMILY,childPersonId:CHILD,revision:1,status:'active'}});
    expect(JSON.stringify(result)).not.toContain('Özel eğitim notu');
    expect(Object.keys(result.ok&&result.value?result.value:{}).sort()).toEqual(['childPersonId','familyId','id','revision','stateFingerprint','status','visibility']);
  });
});
