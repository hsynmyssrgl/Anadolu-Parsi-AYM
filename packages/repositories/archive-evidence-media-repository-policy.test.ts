import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  type Clock
} from '@ppt/core';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  type PolicyAction
} from '@ppt/platform-policy';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult,
  TransactionContext
} from '@ppt/repository-contracts';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';
import { SqliteArchiveRepository } from './src/archive-repository.js';
import { SqlitePlatformPolicyTransactionRepository } from './src/platform-policy-transaction-repository.js';

const NOW=asIsoDateTime('2026-08-15T13:00:00.000Z');
const FAMILY_ID=asFamilyId('family-33-r-repository');
const FOREIGN_FAMILY_ID=asFamilyId('foreign-family-33-r');
const ACCOUNT_ID=asUserId('account-33-r-repository');
const PERSON_ID=asPersonId('person-33-r-owner');
const RELATED_PERSON_ID=asPersonId('person-33-r-related');
const FOREIGN_PERSON_ID=asPersonId('foreign-person-33-r');
const ITEM_ID='archive-item-33-r';
const RELATION_ID='relation-33-r';
const FOREIGN_RELATION_ID='foreign-relation-33-r';
const FENCE_NAME='archive-write';
const FENCE_EPOCH=96;
const clock:Clock={now:()=>NOW};
const runtimes:SqliteFamilyDatabaseRuntime[]=[];
const directories:string[]=[];

afterEach(()=>{
  for(const runtime of runtimes.splice(0))runtime.close();
  for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});
});

const repositoryContext=(transaction:TransactionContext):RepositoryExecutionContext=>({
  transaction:transaction.transaction,
  actor:{userId:ACCOUNT_ID,roles:['family_admin'],personId:PERSON_ID},
  correlationId:transaction.correlationId,
  occurredAt:transaction.occurredAt
});

const openHarness=()=>{
  const directory=mkdtempSync(join(tmpdir(),'ppt-33r-archive-repository-'));
  directories.push(directory);
  const runtime=new SqliteFamilyDatabaseRuntime({
    databasePath:join(directory,'family.db'),applicationVersion:'33-r-vitest',clock,
    skipFileMigrationSafetyBackup:true,databaseConfig:{busyTimeoutMs:5_000,journalMode:'WAL',synchronous:'FULL'}
  });
  runtimes.push(runtime);
  const policyRepository=new SqlitePlatformPolicyTransactionRepository();
  const fence=runtime.transactionExecutor.execute(asCorrelationId('33-r-fence'),transaction=>policyRepository.synchronizeFence(repositoryContext(transaction),{fenceName:FENCE_NAME,epoch:FENCE_EPOCH,writable:true,synchronizedAt:NOW}));
  expect(fence.ok).toBe(true);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run(FAMILY_ID,'33-R Family',NOW);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run(FOREIGN_FAMILY_ID,'Foreign Family',NOW);
  const insertPerson=runtime.database.prepare('INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
  insertPerson.run(PERSON_ID,FAMILY_ID,'Archive Owner',null,'self',0,'main','active',NOW);
  insertPerson.run(RELATED_PERSON_ID,FAMILY_ID,'Related Person',null,'relative',1,'main','active',NOW);
  insertPerson.run(FOREIGN_PERSON_ID,FOREIGN_FAMILY_ID,'Foreign Person',null,'self',0,'main','active',NOW);
  runtime.database.prepare('INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at) VALUES(?,?,?,?,?,?,?,?,?)').run(ACCOUNT_ID,'Archive Owner','archive-33r@example.test','test-password-record',NOW,'family_admin','active',PERSON_ID,'2026-01-01T00:00:00.000Z');
  runtime.database.prepare('INSERT INTO relations(id,family_id,from_person_id,to_person_id,relation_type) VALUES(?,?,?,?,?)').run(RELATION_ID,FAMILY_ID,PERSON_ID,RELATED_PERSON_ID,'parent');
  runtime.database.prepare('INSERT INTO relations(id,family_id,from_person_id,to_person_id,relation_type) VALUES(?,?,?,?,?)').run(FOREIGN_RELATION_ID,FOREIGN_FAMILY_ID,FOREIGN_PERSON_ID,FOREIGN_PERSON_ID,'other');
  return {runtime,repository:new SqliteArchiveRepository(),policyRepository};
};

type Harness=ReturnType<typeof openHarness>;
let sequence=0;
const kernel=new PlatformPolicyKernel({
  policyVersion:'33-r-archive-evidence-policy-v1',
  signingKey:Buffer.from('33-r-archive-evidence-policy-test-key','utf8'),
  applicationCapabilities:{'windows-desktop':['archive.write','archive.read']},
  consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update','delete','record']
});

const withWriteReceipt=async<T>(harness:Harness,input:{resourceId:string;action:'create'|'update';familyId?:typeof FAMILY_ID|typeof FOREIGN_FAMILY_ID;ownerPersonId?:typeof PERSON_ID|typeof FOREIGN_PERSON_ID},operation:(repository:SqliteArchiveRepository,context:PolicyAuthorizedRepositoryExecutionContext)=>RepositoryResult<T>)=>{
  sequence+=1;
  const correlationId=asCorrelationId(`archive-33-r-${input.action}-${sequence}`);
  const familyId=input.familyId??FAMILY_ID;
  const ownerPersonId=input.ownerPersonId??PERSON_ID;
  const pep=new PlatformPolicyEnforcementPoint({
    kernel,
    authorityResolver:{resolve:()=>({policyVersion:'33-r-archive-evidence-policy-v1',accountId:ACCOUNT_ID,personId:PERSON_ID,deviceId:'device-33-r',applicationId:'windows-desktop',deviceTrusted:true,membershipActive:true,roles:['family_admin'],familyIds:[FAMILY_ID],grants:[{id:`grant-${sequence}`,subjectAccountId:ACCOUNT_ID,resourceType:'archive_item',resourceId:input.resourceId,actions:[input.action],purposes:['archive'],effect:'allow',startsAt:'2026-01-01T00:00:00.000Z'}],online:true,expiresAt:'2026-12-31T23:59:59.999Z'})},
    resourceResolver:{resolve:()=>({type:'archive_item',id:input.resourceId,familyId,ownerPersonId,sensitivity:'personal'})},
    receiptSink:{append:()=>undefined,ensure:()=>undefined},
    replayStore:{reserve:(reservation)=>{
      const reserved=harness.runtime.transactionExecutor.execute(asCorrelationId(`archive-33-r-reserve-${sequence}`),transaction=>harness.policyRepository.reserveReplayNonce(repositoryContext(transaction),reservation));
      if(!reserved.ok)throw new Error(reserved.error.message);
      return reserved.value;
    }},clock:()=>NOW,nonceFactory:()=>`nonce-33-r-${sequence}`,deferAllowedReceiptPersistence:true
  });
  return pep.execute({correlationId,action:input.action,capability:'archive.write',resourceType:'archive_item',resourceId:input.resourceId,purpose:'archive'},()=>({writable:true,epoch:FENCE_EPOCH}),authorization=>harness.runtime.transactionExecutor.execute(correlationId,transaction=>{
    const context:PolicyAuthorizedRepositoryExecutionContext={...repositoryContext(transaction),correlationId,policyAuthorization:authorization};
    const recorded=harness.policyRepository.recordAuthorizedTransaction(context,{record:authorization.receiptRecord,fenceName:FENCE_NAME,fenceEpoch:FENCE_EPOCH,fenceWritable:true});
    return recorded.ok?operation(harness.repository,context):recorded;
  }));
};

const seedItem=async(harness:Harness)=>{
  const result=await withWriteReceipt(harness,{resourceId:ITEM_ID,action:'create'},(repository,context)=>{
    const inserted=repository.insert(context,{id:ITEM_ID,familyId:FAMILY_ID,title:'Aile ilişki belgesi',originalName:'relation.pdf',storedName:'relation-v1.enc',mimeType:'application/pdf',sizeBytes:12,sha256:'a'.repeat(64),sensitivity:'personal',aiProcessingAllowed:false,createdAt:NOW});
    if(!inserted.ok)return inserted;
    return repository.insertVersion(context,{id:'archive-version-1',archiveItemId:ITEM_ID,versionNo:1,originalName:'relation.pdf',storedName:'relation-v1.enc',mimeType:'application/pdf',sizeBytes:12,sha256:'a'.repeat(64),createdAt:NOW,note:'İlk sürüm'});
  });
  expect(result,JSON.stringify(result)).toMatchObject({ok:true});
};

describe('33-R archive evidence/media repository policy',()=>{
  it('persists exact owner-bound evidence, hides removed current rows and retains immutable history',async()=>{
    const harness=openHarness();
    await seedItem(harness);
    const created=await withWriteReceipt(harness,{resourceId:ITEM_ID,action:'update'},(repository,context)=>repository.insertRelationEvidence(context,{evidenceId:'evidence-33-r',relationId:RELATION_ID,archiveItemId:ITEM_ID,evidenceDate:'2026-08-14',confidence:'high',mutationId:'mutation-create-33-r',clientOperationId:'operation-create-33-r',requestFingerprint:'b'.repeat(64),occurredAt:NOW}));
    expect(created).toMatchObject({ok:true,value:{status:'active',revision:1,documentTitle:'Aile ilişki belgesi'}});
    const removed=await withWriteReceipt(harness,{resourceId:ITEM_ID,action:'update'},(repository,context)=>repository.removeRelationEvidence(context,{evidenceId:'evidence-33-r',archiveItemId:ITEM_ID,expectedRevision:1,mutationId:'mutation-remove-33-r',clientOperationId:'operation-remove-33-r',requestFingerprint:'c'.repeat(64),occurredAt:NOW}));
    expect(removed).toMatchObject({ok:true,value:{status:'removed',revision:2}});
    const counts=harness.runtime.database.prepare("SELECT (SELECT COUNT(*) FROM archive_relation_evidence WHERE status='active') active_count,(SELECT COUNT(*) FROM archive_relation_evidence_mutations) history_count").get() as {active_count:number;history_count:number};
    expect(counts).toEqual({active_count:0,history_count:2});
    expect(()=>harness.runtime.database.prepare("DELETE FROM archive_relation_evidence_mutations WHERE id='mutation-create-33-r'").run()).toThrow(/durable|immutable/u);
    expect(()=>harness.runtime.database.prepare("UPDATE archive_relation_evidence SET confidence='low' WHERE id='evidence-33-r'").run()).toThrow(/only transition|exact immutable/u);
  });

  it('rejects a foreign-family relation and a future evidence date with full transaction rollback',async()=>{
    const harness=openHarness();
    await seedItem(harness);
    const foreign=await withWriteReceipt(harness,{resourceId:ITEM_ID,action:'update'},(repository,context)=>repository.insertRelationEvidence(context,{evidenceId:'evidence-foreign',relationId:FOREIGN_RELATION_ID,archiveItemId:ITEM_ID,evidenceDate:'2026-08-14',confidence:'medium',mutationId:'mutation-foreign',clientOperationId:'operation-foreign',requestFingerprint:'d'.repeat(64),occurredAt:NOW}));
    expect(foreign.ok).toBe(false);
    const future=await withWriteReceipt(harness,{resourceId:ITEM_ID,action:'update'},(repository,context)=>repository.insertRelationEvidence(context,{evidenceId:'evidence-future',relationId:RELATION_ID,archiveItemId:ITEM_ID,evidenceDate:'2026-08-16',confidence:'medium',mutationId:'mutation-future',clientOperationId:'operation-future',requestFingerprint:'e'.repeat(64),occurredAt:NOW}));
    expect(future.ok).toBe(false);
    expect((harness.runtime.database.prepare('SELECT COUNT(*) count FROM archive_relation_evidence_mutations').get() as {count:number}).count).toBe(0);
  });

  it('rejects a receipt for another archive resource before persistence',async()=>{
    const harness=openHarness();
    await seedItem(harness);
    const result=await withWriteReceipt(harness,{resourceId:'other-archive-item',action:'update'},(repository,context)=>repository.insertRelationEvidence(context,{evidenceId:'evidence-forged',relationId:RELATION_ID,archiveItemId:ITEM_ID,evidenceDate:'2026-08-14',confidence:'medium',mutationId:'mutation-forged',clientOperationId:'operation-forged',requestFingerprint:'f'.repeat(64),occurredAt:NOW}));
    expect(result.ok).toBe(false);
    expect((harness.runtime.database.prepare('SELECT COUNT(*) count FROM archive_relation_evidence_mutations').get() as {count:number}).count).toBe(0);
  });

  it('accepts version two only under an update receipt and atomically advances current file metadata',async()=>{
    const harness=openHarness();
    await seedItem(harness);
    let stage='insert-version';
    const updated=await withWriteReceipt(harness,{resourceId:ITEM_ID,action:'update'},(repository,context)=>{
      const inserted=repository.insertVersion(context,{id:'archive-version-2',archiveItemId:ITEM_ID,versionNo:2,originalName:'relation-v2.pdf',storedName:'relation-v2.enc',mimeType:'application/pdf',sizeBytes:24,sha256:'9'.repeat(64),createdAt:NOW,note:'Doğrulanmış ikinci sürüm'});
      if(!inserted.ok)return inserted;
      stage='replace-current';
      return repository.replaceItemFile(context,{itemId:ITEM_ID,originalName:'relation-v2.pdf',storedName:'relation-v2.enc',mimeType:'application/pdf',sizeBytes:24,sha256:'9'.repeat(64)});
    });
    expect(updated,`${stage}: ${JSON.stringify(updated)}`).toMatchObject({ok:true});
    expect(harness.runtime.database.prepare('SELECT original_name,stored_name,size_bytes,sha256 FROM archive_items WHERE id=?').get(ITEM_ID)).toEqual({original_name:'relation-v2.pdf',stored_name:'relation-v2.enc',size_bytes:24,sha256:'9'.repeat(64)});
    expect((harness.runtime.database.prepare('SELECT COUNT(*) count FROM archive_versions WHERE archive_item_id=?').get(ITEM_ID) as {count:number}).count).toBe(2);
    expect(()=>harness.runtime.database.prepare("UPDATE archive_versions SET note='forged' WHERE id='archive-version-2'").run()).toThrow(/forbidden/u);
  });
});
