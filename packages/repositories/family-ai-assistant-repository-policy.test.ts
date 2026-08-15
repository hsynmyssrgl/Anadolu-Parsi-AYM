import { afterEach,describe,expect,it } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';import { join } from 'node:path';import { tmpdir } from 'node:os';
import { asCorrelationId,asFamilyId,asIsoDateTime,asPersonId,asUserId,type Clock } from '@ppt/core';
import { PlatformPolicyEnforcementPoint,PlatformPolicyKernel } from '@ppt/platform-policy';
import type { FamilyAiAssistantCenterKey,FamilyAiSuggestionMutationRow,FamilyAiSuggestionRow,
  PolicyAuthorizedRepositoryExecutionContext,RepositoryExecutionContext,RepositoryResult,TransactionContext } from '@ppt/repository-contracts';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';
import { SqliteFamilyAiAssistantRepository } from './src/family-ai-assistant-repository.js';
import { SqlitePlatformPolicyTransactionRepository } from './src/platform-policy-transaction-repository.js';

const NOW=asIsoDateTime('2026-08-15T12:00:00.000Z');const FAMILY=asFamilyId('family-33-w-repository');
const FOREIGN=asFamilyId('family-33-w-foreign');const ACCOUNT=asUserId('account-33-w-admin');
const OWNER=asPersonId('person-33-w-owner');const OTHER=asPersonId('person-33-w-other');
const FENCE='family-ai-write';const EPOCH=101;const clock:Clock={now:()=>NOW};
const runtimes:SqliteFamilyDatabaseRuntime[]=[];const directories:string[]=[];
afterEach(()=>{for(const runtime of runtimes.splice(0))runtime.close();for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
const repositoryContext=(transaction:TransactionContext):RepositoryExecutionContext=>({transaction:transaction.transaction,
  actor:{userId:ACCOUNT,personId:OWNER,roles:['family_admin']},correlationId:transaction.correlationId,occurredAt:transaction.occurredAt});
const openHarness=()=>{const directory=mkdtempSync(join(tmpdir(),'ppt-33w-family-ai-'));directories.push(directory);
  const runtime=new SqliteFamilyDatabaseRuntime({databasePath:join(directory,'family.db'),applicationVersion:'33-w-vitest',clock,
    skipFileMigrationSafetyBackup:true,databaseConfig:{busyTimeoutMs:5000,journalMode:'WAL',synchronous:'FULL'}});runtimes.push(runtime);
  const policyRepository=new SqlitePlatformPolicyTransactionRepository();
  expect(runtime.transactionExecutor.execute(asCorrelationId('33-w-fence'),transaction=>policyRepository.synchronizeFence(
    repositoryContext(transaction),{fenceName:FENCE,epoch:EPOCH,writable:true,synchronizedAt:NOW})).ok).toBe(true);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run(FAMILY,'33-W Family',NOW);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run(FOREIGN,'Foreign Family',NOW);
  const person=runtime.database.prepare('INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
  person.run(OWNER,FAMILY,'Owner','1985-01-01','self',0,'main','active',NOW);person.run(OTHER,FAMILY,'Other','1987-01-01','partner',0,'main','active',NOW);
  runtime.database.prepare('INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(ACCOUNT,'Owner','owner-33w@example.test','test-password-record',NOW,'family_admin','active',OWNER,'2026-01-01T00:00:00.000Z');
  return {runtime,repository:new SqliteFamilyAiAssistantRepository(),policyRepository};};
type Harness=ReturnType<typeof openHarness>;let sequence=0;
const kernel=new PlatformPolicyKernel({policyVersion:'33-w-family-ai-policy-v1',signingKey:Buffer.from('33-w-family-ai-policy-test-key-material','utf8'),
  applicationCapabilities:{'windows-desktop':['family.read','family.write']},consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update']});
const withReceipt=async<T>(harness:Harness,input:{readonly action:'read'|'create'|'update';readonly resourceId:string;
  readonly ownerPersonId?:string;readonly familyId?:string},operation:(repository:SqliteFamilyAiAssistantRepository,
  context:PolicyAuthorizedRepositoryExecutionContext)=>RepositoryResult<T>)=>{sequence+=1;const correlationId=asCorrelationId(`family-ai-${input.action}-${sequence}`);
  const familyId=input.familyId??FAMILY;const resourceType=input.action==='read'?'family_ai_assistant_center':'family_ai_suggestion';
  const capability=input.action==='read'?'family.read':'family.write';const pep=new PlatformPolicyEnforcementPoint({kernel,
    authorityResolver:{resolve:()=>({policyVersion:'33-w-family-ai-policy-v1',accountId:ACCOUNT,personId:OWNER,deviceId:'device-33-w',
      applicationId:'windows-desktop',deviceTrusted:true,membershipActive:true,roles:['family_admin'],familyIds:[familyId],
      grants:[{id:`grant-${sequence}`,subjectAccountId:ACCOUNT,resourceType,resourceId:input.resourceId,actions:[input.action],
        purposes:['general'],effect:'allow',startsAt:'2026-01-01T00:00:00.000Z'}],online:true,expiresAt:'2026-12-31T23:59:59.999Z'})},
    resourceResolver:{resolve:()=>({type:resourceType,id:input.resourceId,familyId,ownerPersonId:input.ownerPersonId??OWNER,
      sensitivity:'highly_sensitive',dataClasses:['personal'] as const,classificationSource:'declared' as const})},
    receiptSink:{append:()=>undefined,ensure:()=>undefined},replayStore:{reserve:reservation=>{const result=harness.runtime.transactionExecutor.execute(
      asCorrelationId(`family-ai-reserve-${sequence}`),transaction=>harness.policyRepository.reserveReplayNonce(repositoryContext(transaction),reservation));
      if(!result.ok)throw new Error(result.error.message);return result.value;}},clock:()=>NOW,nonceFactory:()=>`nonce-family-ai-${sequence}`,
    deferAllowedReceiptPersistence:true});
  return pep.execute({correlationId,action:input.action,capability,resourceType,resourceId:input.resourceId,purpose:'general'},
    ()=>({writable:true,epoch:EPOCH}),authorization=>harness.runtime.transactionExecutor.execute(correlationId,transaction=>{
      const context:PolicyAuthorizedRepositoryExecutionContext={...repositoryContext(transaction),correlationId,policyAuthorization:authorization};
      const recorded=harness.policyRepository.recordAuthorizedTransaction(context,{record:authorization.receiptRecord,fenceName:FENCE,fenceEpoch:EPOCH,fenceWritable:true});
      return recorded.ok?operation(harness.repository,context):recorded;}));};
const key:FamilyAiAssistantCenterKey={familyId:FAMILY,accountId:ACCOUNT,actorPersonId:OWNER,ownerPersonId:OWNER,
  centerId:`family-ai-assistant:${FAMILY}:${OWNER}`};
const mutation=(suggestionId:string,overrides:Partial<FamilyAiSuggestionMutationRow>={}):FamilyAiSuggestionMutationRow=>({id:'a'.repeat(64),
  familyId:FAMILY,ownerPersonId:OWNER,suggestionId,actorAccountId:ACCOUNT,actorPersonId:OWNER,mutationKind:'suggestion_generate',
  purpose:'search',clientOperationId:'operation-family-ai-33-w',requestFingerprint:'b'.repeat(64),expectedRevision:0,revision:1,
  suggestionStateFingerprint:'c'.repeat(64),sourceFingerprint:'d'.repeat(64),sourceCount:1,occurredAt:NOW,...overrides});
const suggestion=(row:FamilyAiSuggestionMutationRow,overrides:Partial<FamilyAiSuggestionRow>={}):FamilyAiSuggestionRow=>({id:row.suggestionId,
  familyId:FAMILY,ownerPersonId:OWNER,kind:'authorized_search',purpose:'search',status:'pending_confirmation',title:'Yerel inceleme önerisi',
  explanation:'Bir izinli yerel kaynak kullanıcı incelemesi için işaretlendi.',confidenceBasisPoints:6250,
  sources:[{module:'event',resourceType:'event',resourceId:'event-33-w'}],sourceFingerprint:row.sourceFingerprint,revision:row.revision,
  stateFingerprint:row.suggestionStateFingerprint,lastMutationId:row.id,createdAt:NOW,updatedAt:NOW,...overrides});

describe('33-W family AI assistant repository policy boundary',()=>{
  it('persists and reads an exact owner-receipt-bound suggestion',async()=>{const h=openHarness();const row=mutation('suggestion-33-w');
    expect((await withReceipt(h,{action:'create',resourceId:row.suggestionId},(repo,ctx)=>{const ledger=repo.insertMutation(ctx,row);
      return ledger.ok?repo.insertSuggestion(ctx,suggestion(row)):ledger;})).ok).toBe(true);
    const loaded=await withReceipt(h,{action:'read',resourceId:'*'},(repo,ctx)=>repo.loadCenter(ctx,key));
    expect(loaded).toMatchObject({ok:true,value:{suggestions:[{id:row.suggestionId,status:'pending_confirmation'}]}});
    expect(JSON.stringify(loaded)).not.toContain('policy_receipt');
  });

  it('rejects forged owner and foreign-family receipts with complete rollback',async()=>{const h=openHarness();const row=mutation('forged-33-w');
    expect((await withReceipt(h,{action:'create',resourceId:row.suggestionId,ownerPersonId:OTHER},(repo,ctx)=>repo.insertMutation(ctx,row))).ok).toBe(false);
    expect((await withReceipt(h,{action:'create',resourceId:row.suggestionId,familyId:FOREIGN},(repo,ctx)=>repo.insertMutation(ctx,row))).ok).toBe(false);
    expect((h.runtime.database.prepare('SELECT COUNT(*) AS count FROM family_ai_suggestion_mutations').get() as {count:number}).count).toBe(0);
  });

  it('allows only an exact immutable human-review transition',async()=>{const h=openHarness();const created=mutation('review-33-w');
    expect((await withReceipt(h,{action:'create',resourceId:created.suggestionId},(repo,ctx)=>{const ledger=repo.insertMutation(ctx,created);
      return ledger.ok?repo.insertSuggestion(ctx,suggestion(created)):ledger;})).ok).toBe(true);
    const reviewed=mutation(created.suggestionId,{id:'e'.repeat(64),mutationKind:'suggestion_confirm',clientOperationId:'operation-confirm-33-w',
      requestFingerprint:'f'.repeat(64),expectedRevision:1,revision:2,suggestionStateFingerprint:'1'.repeat(64)});
    const next=suggestion(reviewed,{status:'confirmed',createdAt:NOW,confirmedAt:NOW});
    const update=await withReceipt(h,{action:'update',resourceId:created.suggestionId},(repo,ctx)=>{const ledger=repo.insertMutation(ctx,reviewed);
      return ledger.ok?repo.saveSuggestion(ctx,next,1):ledger;});
    expect(update).toMatchObject({ok:true});
    expect(()=>h.runtime.database.prepare('DELETE FROM family_ai_suggestions WHERE id=?').run(created.suggestionId)).toThrow(/durable/u);
    expect(()=>h.runtime.database.prepare('UPDATE family_ai_suggestion_mutations SET client_operation_id=? WHERE id=?').run('forged',created.id)).toThrow(/immutable/u);
  });

  it('exposes only payload-free metadata during preauthorization',async()=>{const h=openHarness();const row=mutation('preauth-33-w');
    expect((await withReceipt(h,{action:'create',resourceId:row.suggestionId},(repo,ctx)=>{const ledger=repo.insertMutation(ctx,row);
      return ledger.ok?repo.insertSuggestion(ctx,suggestion(row,{explanation:'Özel ayrıntı içermez ama yine de renderer öncesi taşınmamalıdır.'})):ledger;})).ok).toBe(true);
    const result=h.runtime.transactionExecutor.execute(asCorrelationId('family-ai-preauth-read'),transaction=>
      h.repository.findSuggestionForPolicyResolution(repositoryContext(transaction),row.suggestionId));
    expect(result).toMatchObject({ok:true,value:{id:row.suggestionId,familyId:FAMILY,ownerPersonId:OWNER,revision:1,status:'pending_confirmation'}});
    expect(Object.keys(result.ok&&result.value?result.value:{}).sort()).toEqual(['familyId','id','ownerPersonId','revision','stateFingerprint','status']);
    expect(JSON.stringify(result)).not.toContain('Özel ayrıntı');
  });
});
