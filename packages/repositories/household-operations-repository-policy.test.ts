import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId, asUserId, type Clock } from '@ppt/core';
import { PlatformPolicyEnforcementPoint, PlatformPolicyKernel } from '@ppt/platform-policy';
import type {
  HouseholdOperationItemRow,
  HouseholdOperationMutationRow,
  HouseholdOperationsCenterKey,
  HouseholdOperationsCenterRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult,
  TransactionContext
} from '@ppt/repository-contracts';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';
import { SqliteHouseholdOperationsRepository } from './src/household-operations-repository.js';
import { SqlitePlatformPolicyTransactionRepository } from './src/platform-policy-transaction-repository.js';

const NOW=asIsoDateTime('2026-08-15T15:30:00.000Z');
const FAMILY=asFamilyId('family-33-t-repository');
const FOREIGN_FAMILY=asFamilyId('family-33-t-foreign');
const ACCOUNT=asUserId('account-33-t-repository');
const PERSON=asPersonId('person-33-t-repository');
const MEMBER=asPersonId('person-33-t-member');
const CENTER_ID=`household-operations-center:${FAMILY}`;
const FENCE_NAME='household-operations-write';
const FENCE_EPOCH=98;
const clock:Clock={now:()=>NOW};
const runtimes:SqliteFamilyDatabaseRuntime[]=[];
const directories:string[]=[];

afterEach(()=>{
  for(const runtime of runtimes.splice(0))runtime.close();
  for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});
});

const actor={accountId:ACCOUNT,personId:PERSON,roles:['family_admin'] as const};
const repositoryContext=(transaction:TransactionContext):RepositoryExecutionContext=>({
  transaction:transaction.transaction,
  actor:{userId:ACCOUNT,personId:PERSON,roles:actor.roles},
  correlationId:transaction.correlationId,
  occurredAt:transaction.occurredAt
});

const openHarness=()=>{
  const directory=mkdtempSync(join(tmpdir(),'ppt-33t-household-repository-'));directories.push(directory);
  const runtime=new SqliteFamilyDatabaseRuntime({
    databasePath:join(directory,'family.db'),applicationVersion:'33-t-vitest',clock,
    skipFileMigrationSafetyBackup:true,databaseConfig:{busyTimeoutMs:5_000,journalMode:'WAL',synchronous:'FULL'}
  });
  runtimes.push(runtime);
  const policyRepository=new SqlitePlatformPolicyTransactionRepository();
  expect(runtime.transactionExecutor.execute(asCorrelationId('33-t-household-fence'),(transaction)=>
    policyRepository.synchronizeFence(repositoryContext(transaction),{fenceName:FENCE_NAME,epoch:FENCE_EPOCH,writable:true,synchronizedAt:NOW})
  ).ok).toBe(true);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run(FAMILY,'33-T Family',NOW);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run(FOREIGN_FAMILY,'Foreign Family',NOW);
  const insertPerson=runtime.database.prepare('INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
  insertPerson.run(PERSON,FAMILY,'Household Owner',null,'self',0,'main','active',NOW);
  insertPerson.run(MEMBER,FAMILY,'Household Member',null,'child',1,'main','active',NOW);
  runtime.database.prepare('INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(ACCOUNT,'Household Owner','owner-33t@example.test','test-password-record',NOW,'family_admin','active',PERSON,'2026-01-01T00:00:00.000Z');
  return {runtime,repository:new SqliteHouseholdOperationsRepository(),policyRepository};
};

type Harness=ReturnType<typeof openHarness>;
let sequence=0;
const kernel=new PlatformPolicyKernel({
  policyVersion:'33-t-household-policy-v1',
  signingKey:Buffer.from('33-t-household-policy-test-signing-key','utf8'),
  applicationCapabilities:{'windows-desktop':['family.read','family.write']},
  consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update','delete']
});

const withReceipt=async<T>(harness:Harness,input:{readonly action:'read'|'create'|'update'|'delete';readonly resourceId:string;readonly ownerPersonId?:string;readonly familyId?:string},operation:(repository:SqliteHouseholdOperationsRepository,context:PolicyAuthorizedRepositoryExecutionContext)=>RepositoryResult<T>)=>{
  sequence+=1;const correlationId=asCorrelationId(`household-33-t-${input.action}-${sequence}`);
  const familyId=input.familyId??FAMILY;const resourceType=input.action==='read'?'household_operations_center':'household_operation_item';
  const capability=input.action==='read'?'family.read':'family.write';
  const pep=new PlatformPolicyEnforcementPoint({
    kernel,
    authorityResolver:{resolve:()=>({
      policyVersion:'33-t-household-policy-v1',accountId:ACCOUNT,personId:PERSON,deviceId:'device-33-t',applicationId:'windows-desktop',
      deviceTrusted:true,membershipActive:true,roles:actor.roles,familyIds:[familyId],grants:[{
        id:`grant-${sequence}`,subjectAccountId:ACCOUNT,resourceType,resourceId:input.resourceId,actions:[input.action],purposes:['general'],effect:'allow',startsAt:'2026-01-01T00:00:00.000Z'
      }],online:true,expiresAt:'2026-12-31T23:59:59.999Z'
    })},
    resourceResolver:{resolve:()=>({type:resourceType,id:input.resourceId,familyId,ownerPersonId:input.ownerPersonId??PERSON,sensitivity:'personal'})},
    receiptSink:{append:()=>undefined,ensure:()=>undefined},
    replayStore:{reserve:(reservation)=>{
      const result=harness.runtime.transactionExecutor.execute(asCorrelationId(`household-33-t-reserve-${sequence}`),(transaction)=>harness.policyRepository.reserveReplayNonce(repositoryContext(transaction),reservation));
      if(!result.ok)throw new Error(result.error.message);return result.value;
    }},
    clock:()=>NOW,nonceFactory:()=>`nonce-household-33-t-${sequence}`,deferAllowedReceiptPersistence:true
  });
  return pep.execute({correlationId,action:input.action,capability,resourceType,resourceId:input.resourceId,purpose:'general'},()=>({writable:true,epoch:FENCE_EPOCH}),(authorization)=>
    harness.runtime.transactionExecutor.execute(correlationId,(transaction)=>{
      const context:PolicyAuthorizedRepositoryExecutionContext={...repositoryContext(transaction),correlationId,policyAuthorization:authorization};
      const recorded=harness.policyRepository.recordAuthorizedTransaction(context,{record:authorization.receiptRecord,fenceName:FENCE_NAME,fenceEpoch:FENCE_EPOCH,fenceWritable:true});
      return recorded.ok?operation(harness.repository,context):recorded;
    })
  );
};

const key:HouseholdOperationsCenterKey={familyId:FAMILY,accountId:ACCOUNT,actorPersonId:PERSON,centerId:CENTER_ID};
const mutation=(itemId:string,overrides:Partial<HouseholdOperationMutationRow>={}):HouseholdOperationMutationRow=>({
  id:'a'.repeat(64),centerId:CENTER_ID,familyId:FAMILY,itemId,ownerPersonId:PERSON,actorAccountId:ACCOUNT,actorPersonId:PERSON,
  mutationKind:'item_create',clientOperationId:'operation-household-repository-33-t',requestFingerprint:'b'.repeat(64),
  expectedCenterRevision:0,centerRevision:1,expectedItemRevision:0,itemRevision:1,
  centerStateFingerprint:'c'.repeat(64),itemStateFingerprint:'d'.repeat(64),occurredAt:NOW,...overrides
});
const center=(row:HouseholdOperationMutationRow):HouseholdOperationsCenterRow=>({
  id:CENTER_ID,familyId:FAMILY,revision:row.centerRevision,stateFingerprint:row.centerStateFingerprint,lastMutationId:row.id,createdAt:NOW,updatedAt:NOW
});
const item=(row:HouseholdOperationMutationRow,overrides:Partial<HouseholdOperationItemRow>={}):HouseholdOperationItemRow=>({
  id:row.itemId,centerId:CENTER_ID,familyId:FAMILY,ownerPersonId:PERSON,kind:'shopping_list',area:'shopping',title:'Haftalık alışveriş',status:'active',revision:row.itemRevision,
  allergyFilterStatus:'not_applicable',stateFingerprint:row.itemStateFingerprint,lastMutationId:row.id,createdAt:NOW,updatedAt:NOW,...overrides
});

describe('33-T household operations repository policy boundary',()=>{
  it('persists an exact receipt-bound mutation, center and item then reads the scoped center',async()=>{
    const harness=openHarness();const row=mutation('shopping-list-33-t');
    const created=await withReceipt(harness,{action:'create',resourceId:row.itemId},(repository,context)=>{
      const inserted=repository.insertMutation(context,row);if(!inserted.ok)return inserted;
      const insertedCenter=repository.insertCenter(context,center(row));if(!insertedCenter.ok)return insertedCenter;
      return repository.insertItem(context,item(row));
    });
    expect(created.ok).toBe(true);
    const loaded=await withReceipt(harness,{action:'read',resourceId:'*'},(repository,context)=>repository.loadCenter(context,key));
    expect(loaded).toMatchObject({ok:true,value:{center:{revision:1},items:[{id:row.itemId,kind:'shopping_list',area:'shopping'}]}});
  });

  it('rejects forged owner and family receipt bindings before any durable mutation',async()=>{
    const harness=openHarness();const row=mutation('shopping-list-forged-33-t');
    const forgedOwner=await withReceipt(harness,{action:'create',resourceId:row.itemId,ownerPersonId:MEMBER},(repository,context)=>repository.insertMutation(context,row));
    expect(forgedOwner.ok).toBe(false);
    const forgedFamily=await withReceipt(harness,{action:'create',resourceId:row.itemId,familyId:FOREIGN_FAMILY},(repository,context)=>repository.insertMutation(context,row));
    expect(forgedFamily.ok).toBe(false);
    expect((harness.runtime.database.prepare('SELECT COUNT(*) AS count FROM household_operation_mutations').get() as {count:number}).count).toBe(0);
  });

  it('enforces parent, area and family-member split invariants in SQLite',async()=>{
    const harness=openHarness();const row=mutation('invalid-area-33-t');
    const invalid=await withReceipt(harness,{action:'create',resourceId:row.itemId},(repository,context)=>{
      const inserted=repository.insertMutation(context,row);if(!inserted.ok)return inserted;
      const insertedCenter=repository.insertCenter(context,center(row));if(!insertedCenter.ok)return insertedCenter;
      return repository.insertItem(context,item(row,{area:'pets'}));
    });
    expect(invalid.ok).toBe(false);
    expect((harness.runtime.database.prepare('SELECT COUNT(*) AS count FROM household_operations_centers').get() as {count:number}).count).toBe(0);
  });

  it('keeps item and mutation ledgers physically immutable',async()=>{
    const harness=openHarness();const row=mutation('shopping-list-immutable-33-t');
    expect((await withReceipt(harness,{action:'create',resourceId:row.itemId},(repository,context)=>{
      const one=repository.insertMutation(context,row);if(!one.ok)return one;
      const two=repository.insertCenter(context,center(row));if(!two.ok)return two;
      return repository.insertItem(context,item(row));
    })).ok).toBe(true);
    expect(()=>harness.runtime.database.prepare('DELETE FROM household_operation_items WHERE id=?').run(row.itemId)).toThrow(/durable/u);
    expect(()=>harness.runtime.database.prepare('UPDATE household_operation_mutations SET client_operation_id=? WHERE id=?').run('forged',row.id)).toThrow(/immutable/u);
  });

  it('exposes only payload-free metadata during policy preauthorization',()=>{
    const harness=openHarness();const row=mutation('shopping-list-preauth-33-t');
    return withReceipt(harness,{action:'create',resourceId:row.itemId},(repository,context)=>{
      const one=repository.insertMutation(context,row);if(!one.ok)return one;
      const two=repository.insertCenter(context,center(row));if(!two.ok)return two;
      return repository.insertItem(context,item(row,{note:'Bu metin preauth sonucuna çıkmamalı.'}));
    }).then((created)=>{
      expect(created.ok).toBe(true);
      const result=harness.runtime.transactionExecutor.execute(asCorrelationId('household-preauth-read'),(transaction)=>
        harness.repository.findItemForPolicyResolution(repositoryContext(transaction),row.itemId)
      );
      expect(result).toMatchObject({ok:true,value:{id:row.itemId,familyId:FAMILY,ownerPersonId:PERSON,revision:1,status:'active'}});
      expect(JSON.stringify(result)).not.toContain('Bu metin');
      expect(Object.keys(result.ok&&result.value?result.value:{}).sort()).toEqual(['familyId','id','ownerPersonId','revision','stateFingerprint','status']);
    });
  });
});
