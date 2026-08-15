import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId, asUserId, type Clock } from '@ppt/core';
import { PlatformPolicyEnforcementPoint, PlatformPolicyKernel } from '@ppt/platform-policy';
import type {
  CommunicationCallPreferencesRow,
  CommunicationRealtimeCallingCenterKey,
  CommunicationRealtimeCallingMutationRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult,
  TransactionContext
} from '@ppt/repository-contracts';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';
import { SqliteCommunicationRealtimeCallingRepository } from './src/communication-realtime-calling-repository.js';
import { SqlitePlatformPolicyTransactionRepository } from './src/platform-policy-transaction-repository.js';

const NOW=asIsoDateTime('2026-08-15T14:00:00.000Z');
const FAMILY=asFamilyId('family-34-c-repository');const ACCOUNT=asUserId('account-34-c-owner');
const OWNER=asPersonId('person-34-c-owner');const OTHER=asPersonId('person-34-c-other');
const FENCE='communication-calling-write';const EPOCH=107;const clock:Clock={now:()=>NOW};
const runtimes:SqliteFamilyDatabaseRuntime[]=[];const directories:string[]=[];
afterEach(()=>{for(const runtime of runtimes.splice(0))runtime.close();for(const directory of directories.splice(0))
  rmSync(directory,{recursive:true,force:true});});
const repositoryContext=(transaction:TransactionContext):RepositoryExecutionContext=>({transaction:transaction.transaction,
  actor:{userId:ACCOUNT,personId:OWNER,roles:['family_admin']},correlationId:transaction.correlationId,occurredAt:transaction.occurredAt});
const openHarness=()=>{const directory=mkdtempSync(join(tmpdir(),'ppt-34c-calling-'));directories.push(directory);
  const runtime=new SqliteFamilyDatabaseRuntime({databasePath:join(directory,'family.db'),applicationVersion:'34-c-vitest',clock,
    skipFileMigrationSafetyBackup:true,databaseConfig:{busyTimeoutMs:5000,journalMode:'WAL',synchronous:'FULL'}});runtimes.push(runtime);
  const policyRepository=new SqlitePlatformPolicyTransactionRepository();expect(runtime.transactionExecutor.execute(
    asCorrelationId('34-c-fence'),transaction=>policyRepository.synchronizeFence(repositoryContext(transaction),{
      fenceName:FENCE,epoch:EPOCH,writable:true,synchronizedAt:NOW})).ok).toBe(true);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run(FAMILY,'34-C Family',NOW);
  const person=runtime.database.prepare(`INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at)
    VALUES(?,?,?,?,?,?,?,?,?)`);person.run(OWNER,FAMILY,'Owner','1985-01-01','self',0,'main','active',NOW);
  person.run(OTHER,FAMILY,'Other','1986-01-01','partner',0,'main','active',NOW);
  runtime.database.prepare(`INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at)
    VALUES(?,?,?,?,?,?,?,?,?)`).run(ACCOUNT,'Owner','owner-34c@example.test','test-password-record',NOW,'family_admin','active',OWNER,
      '2026-01-01T00:00:00.000Z');
  return {runtime,repository:new SqliteCommunicationRealtimeCallingRepository(),policyRepository};};
type Harness=ReturnType<typeof openHarness>;type ResourceType='communication_call_center'|'communication_call_session'|'communication_call_preferences';
let sequence=0;const kernel=new PlatformPolicyKernel({policyVersion:'34-c-calling-policy-v1',
  signingKey:Buffer.from('34-c-calling-policy-key-material','utf8'),applicationCapabilities:{'windows-desktop':['family.read','family.write']},
  consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update','delete']});
const withReceipt=async<T>(harness:Harness,input:{action:'read'|'create'|'update'|'delete';resourceType:ResourceType;
  resourceId:string;ownerPersonId?:string},operation:(repository:SqliteCommunicationRealtimeCallingRepository,
    context:PolicyAuthorizedRepositoryExecutionContext)=>RepositoryResult<T>)=>{sequence+=1;
  const correlationId=asCorrelationId(`calling-${input.action}-${sequence}`);const capability=input.action==='read'?'family.read':'family.write';
  const pep=new PlatformPolicyEnforcementPoint({kernel,authorityResolver:{resolve:()=>({policyVersion:'34-c-calling-policy-v1',
    accountId:ACCOUNT,personId:OWNER,deviceId:'device-34-c',applicationId:'windows-desktop',deviceTrusted:true,
    membershipActive:true,roles:['family_admin'],familyIds:[FAMILY],grants:[{id:`grant-${sequence}`,subjectAccountId:ACCOUNT,
      resourceType:input.resourceType,resourceId:input.resourceId,actions:[input.action],purposes:['general'],effect:'allow',
      startsAt:'2026-01-01T00:00:00.000Z'}],online:true,expiresAt:'2027-12-31T23:59:59.999Z'})},
    resourceResolver:{resolve:()=>({type:input.resourceType,id:input.resourceId,familyId:FAMILY,
      ownerPersonId:input.ownerPersonId??OWNER,sensitivity:'highly_sensitive',dataClasses:['personal'] as const,
      classificationSource:'declared' as const})},receiptSink:{append:()=>undefined,ensure:()=>undefined},
    replayStore:{reserve:reservation=>{const result=harness.runtime.transactionExecutor.execute(asCorrelationId(`calling-reserve-${sequence}`),
      transaction=>harness.policyRepository.reserveReplayNonce(repositoryContext(transaction),reservation));
      if(!result.ok)throw new Error(result.error.message);return result.value;}},clock:()=>NOW,
    nonceFactory:()=>`nonce-communication-calling-${sequence}`,
    deferAllowedReceiptPersistence:true});
  return pep.execute({correlationId,action:input.action,capability,resourceType:input.resourceType,resourceId:input.resourceId,
    purpose:'general'},()=>({writable:true,epoch:EPOCH}),(authorization)=>harness.runtime.transactionExecutor.execute(correlationId,
      transaction=>{const context:PolicyAuthorizedRepositoryExecutionContext={...repositoryContext(transaction),correlationId,
        policyAuthorization:authorization};const recorded=harness.policyRepository.recordAuthorizedTransaction(context,{
          record:authorization.receiptRecord,fenceName:FENCE,fenceEpoch:EPOCH,fenceWritable:true});
        return recorded.ok?operation(harness.repository,context):recorded;}));};
const key:CommunicationRealtimeCallingCenterKey={familyId:FAMILY,accountId:ACCOUNT,actorPersonId:OWNER,ownerPersonId:OWNER,
  centerId:`communication-calling:${FAMILY}:${OWNER}`};
const rows=(revision=1)=>{const mutation:CommunicationRealtimeCallingMutationRow={id:`${revision}`.repeat(64),familyId:FAMILY,
  ownerPersonId:OWNER,resourceType:'communication_call_preferences',resourceId:`communication-call-preferences:${OWNER}`,
  actorAccountId:ACCOUNT,actorPersonId:OWNER,mutationKind:'call_preferences_update',clientOperationId:`preferences-${revision}-34-c`,
  requestFingerprint:`${revision+1}`.repeat(64),expectedRevision:revision-1,revision,resourceStateFingerprint:`${revision+2}`.repeat(64),
  occurredAt:NOW};const preferences:CommunicationCallPreferencesRow={id:mutation.resourceId,familyId:FAMILY,ownerPersonId:OWNER,
  simpleMode:revision===2,largePersonCards:true,captionScalePercent:revision===2?150:125,screenReaderAnnouncements:true,
  keyboardShortcuts:true,automaticAudioFallbackEnabled:true,noiseReductionRequested:true,echoCancellationRequested:true,
  automaticGainControlRequested:true,backgroundEffect:'off',revision,stateFingerprint:mutation.resourceStateFingerprint,
  lastMutationId:mutation.id,createdAt:NOW,updatedAt:NOW};return {mutation,preferences};};

describe('34-C realtime calling repository policy boundary',()=>{
  it('persists owner-bound accessible preferences and exposes them through the bounded center read',async()=>{
    const harness=openHarness();const value=rows();expect((await withReceipt(harness,{action:'create',
      resourceType:'communication_call_preferences',resourceId:value.preferences.id},(repository,context)=>{
        const ledger=repository.insertMutation(context,value.mutation);return ledger.ok?repository.savePreferences(context,value.preferences,0):ledger;
      })).ok).toBe(true);
    expect(await withReceipt(harness,{action:'read',resourceType:'communication_call_center',resourceId:'*'},
      (repository,context)=>repository.loadCenter(context,key))).toMatchObject({ok:true,value:{sessions:[],preferences:{
        id:value.preferences.id,captionScalePercent:125,revision:1},qualityObservations:[]}});
    expect(()=>harness.runtime.database.prepare('DELETE FROM communication_call_mutations').run()).toThrow(/immutable|durable/u);
  });

  it('accepts an exact revision-bound update and rejects forged current-row changes',async()=>{
    const harness=openHarness();const first=rows();await withReceipt(harness,{action:'create',resourceType:'communication_call_preferences',
      resourceId:first.preferences.id},(repository,context)=>{const ledger=repository.insertMutation(context,first.mutation);
      return ledger.ok?repository.savePreferences(context,first.preferences,0):ledger;});const second=rows(2);
    expect((await withReceipt(harness,{action:'update',resourceType:'communication_call_preferences',resourceId:second.preferences.id},
      (repository,context)=>{const ledger=repository.insertMutation(context,second.mutation);
        return ledger.ok?repository.savePreferences(context,second.preferences,1):ledger;})).ok).toBe(true);
    expect(()=>harness.runtime.database.prepare(`UPDATE communication_call_preferences SET revision=3 WHERE id=?`)
      .run(first.preferences.id)).toThrow(/exact owner mutation|revision|policy/u);
  });

  it('fails closed for a foreign owner receipt and rolls back the mutation ledger',async()=>{
    const harness=openHarness();const value=rows();expect((await withReceipt(harness,{action:'create',
      resourceType:'communication_call_preferences',resourceId:value.preferences.id,ownerPersonId:OTHER},
      (repository,context)=>repository.insertMutation(context,value.mutation))).ok).toBe(false);
    expect(harness.runtime.database.prepare('SELECT count(*) count FROM communication_call_mutations').get()).toEqual({count:0});
  });

  it('keeps preauthorization resolution payload-free',async()=>{
    const harness=openHarness();const value=rows();await withReceipt(harness,{action:'create',
      resourceType:'communication_call_preferences',resourceId:value.preferences.id},(repository,context)=>{
        const ledger=repository.insertMutation(context,value.mutation);return ledger.ok?repository.savePreferences(context,value.preferences,0):ledger;});
    const context:RepositoryExecutionContext={transaction:harness.runtime.database,actor:{userId:ACCOUNT,personId:OWNER,roles:['family_admin']},
      correlationId:asCorrelationId('calling-policy-resolution'),occurredAt:NOW};
    const resolved=harness.repository.resolvePolicyResource(context,'communication_call_preferences',value.preferences.id);
    expect(resolved).toMatchObject({ok:true,value:{id:value.preferences.id,familyId:FAMILY,ownerPersonId:OWNER,revision:1,status:'configured'}});
    expect(JSON.stringify(resolved)).not.toMatch(/favorite|caption|background|provider|quality|participant/i);
  });
});
