import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  type Clock
} from '@ppt/core';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import { communicationFileSharingTruth } from '@ppt/domain';
import { PlatformPolicyEnforcementPoint, PlatformPolicyKernel } from '@ppt/platform-policy';
import type {
  CommunicationFileSharingCenterKey,
  CommunicationFileSharingCenterRow,
  CommunicationFileSharingMutationRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult,
  TransactionContext
} from '@ppt/repository-contracts';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';
import { SqliteCommunicationFileSharingRepository } from './src/communication-file-sharing-repository.js';
import { SqlitePlatformPolicyTransactionRepository } from './src/platform-policy-transaction-repository.js';

const NOW=asIsoDateTime('2026-08-16T00:30:00.000Z');
const FAMILY=asFamilyId('family-34-g-repository');
const ACCOUNT=asUserId('account-34-g-owner');
const OWNER=asPersonId('person-34-g-owner');
const OTHER=asPersonId('person-34-g-other');
const FENCE='communication-file-sharing-write';
const EPOCH=111;
const clock:Clock={now:()=>NOW};
const runtimes:SqliteFamilyDatabaseRuntime[]=[];
const directories:string[]=[];
afterEach(()=>{for(const runtime of runtimes.splice(0))runtime.close();
  for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
const open=()=>{const directory=mkdtempSync(join(tmpdir(),'ppt-34g-repository-'));directories.push(directory);
  const runtime=new SqliteFamilyDatabaseRuntime({databasePath:join(directory,'family.db'),
    applicationVersion:'34-g-repository-vitest',clock,skipFileMigrationSafetyBackup:true,
    databaseConfig:{busyTimeoutMs:5000,journalMode:'WAL',synchronous:'FULL'}});
  runtimes.push(runtime);return runtime;};
const repositoryContext=(transaction:TransactionContext):RepositoryExecutionContext=>({transaction:transaction.transaction,
  actor:{userId:ACCOUNT,personId:OWNER,roles:['family_admin']},correlationId:transaction.correlationId,occurredAt:transaction.occurredAt});
const openHarness=()=>{const runtime=open();const policyRepository=new SqlitePlatformPolicyTransactionRepository();
  expect(runtime.transactionExecutor.execute(asCorrelationId('34-g-file-fence'),transaction=>
    policyRepository.synchronizeFence(repositoryContext(transaction),{fenceName:FENCE,epoch:EPOCH,writable:true,
      synchronizedAt:NOW})).ok).toBe(true);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run(FAMILY,'34-G Family',NOW);
  const person=runtime.database.prepare(`INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at)
    VALUES(?,?,?,?,?,?,?,?,?)`);person.run(OWNER,FAMILY,'Owner','1985-01-01','self',0,'main','active',NOW);
  person.run(OTHER,FAMILY,'Other','1986-01-01','partner',0,'main','active',NOW);
  runtime.database.prepare(`INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at)
    VALUES(?,?,?,?,?,?,?,?,?)`).run(ACCOUNT,'Owner','owner-34g@example.test','test-password-record',NOW,'family_admin','active',OWNER,
      '2026-01-01T00:00:00.000Z');
  return{runtime,repository:new SqliteCommunicationFileSharingRepository(),policyRepository};};
type Harness=ReturnType<typeof openHarness>;
type ResourceType='communication_file_sharing_center'|'communication_file_sharing';
let sequence=0;
const kernel=new PlatformPolicyKernel({policyVersion:'34-g-file-sharing-policy-v1',
  signingKey:Buffer.from('34-g-file-sharing-policy-key-material','utf8'),applicationCapabilities:{'windows-desktop':['family.read','family.write']},
  consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update','delete']});
const withReceipt=async<T>(harness:Harness,input:{action:'read'|'create'|'update'|'delete';resourceType:ResourceType;
  resourceId:string;ownerPersonId?:string},operation:(repository:SqliteCommunicationFileSharingRepository,
    context:PolicyAuthorizedRepositoryExecutionContext)=>RepositoryResult<T>)=>{sequence+=1;
  const correlationId=asCorrelationId(`file-sharing-${input.action}-${sequence}`);
  const capability=input.action==='read'?'family.read':'family.write';
  const pep=new PlatformPolicyEnforcementPoint({kernel,authorityResolver:{resolve:()=>({policyVersion:'34-g-file-sharing-policy-v1',
    accountId:ACCOUNT,personId:OWNER,deviceId:'device-34-g',applicationId:'windows-desktop',deviceTrusted:true,
    membershipActive:true,roles:['family_admin'],familyIds:[FAMILY],grants:[{id:`grant-${sequence}`,subjectAccountId:ACCOUNT,
      resourceType:input.resourceType,resourceId:input.resourceId,actions:[input.action],purposes:['general'],effect:'allow',
      startsAt:'2026-01-01T00:00:00.000Z'}],online:true,expiresAt:'2027-12-31T23:59:59.999Z'})},
    resourceResolver:{resolve:()=>({type:input.resourceType,id:input.resourceId,familyId:FAMILY,
      ownerPersonId:input.ownerPersonId??OWNER,sensitivity:'highly_sensitive',dataClasses:['personal'] as const,
      classificationSource:'declared' as const})},receiptSink:{append:()=>undefined,ensure:()=>undefined},
    replayStore:{reserve:reservation=>{const result=harness.runtime.transactionExecutor.execute(
      asCorrelationId(`file-sharing-reserve-${sequence}`),transaction=>
        harness.policyRepository.reserveReplayNonce(repositoryContext(transaction),reservation));
      if(!result.ok)throw new Error(result.error.message);return result.value;}},clock:()=>NOW,
    nonceFactory:()=>`nonce-communication-file-sharing-${sequence}`,deferAllowedReceiptPersistence:true});
  return pep.execute({correlationId,action:input.action,capability,resourceType:input.resourceType,resourceId:input.resourceId,
    purpose:'general'},()=>({writable:true,epoch:EPOCH}),(authorization)=>harness.runtime.transactionExecutor.execute(correlationId,
      transaction=>{const context:PolicyAuthorizedRepositoryExecutionContext={...repositoryContext(transaction),correlationId,
        policyAuthorization:authorization};const recorded=harness.policyRepository.recordAuthorizedTransaction(context,{
          record:authorization.receiptRecord,fenceName:FENCE,fenceEpoch:EPOCH,fenceWritable:true});
        return recorded.ok?operation(harness.repository,context):recorded;}));};
const key:CommunicationFileSharingCenterKey={familyId:FAMILY,accountId:ACCOUNT,actorPersonId:OWNER,ownerPersonId:OWNER,
  centerId:`communication-file-sharing:${FAMILY}:${OWNER}`};
const fileId=`comm-file-${'1'.repeat(48)}`;
const rows=():{readonly row:CommunicationFileSharingCenterRow;readonly mutation:CommunicationFileSharingMutationRow}=>{
  const stateFingerprint='6'.repeat(64);const mutation:CommunicationFileSharingMutationRow={id:'7'.repeat(64),familyId:FAMILY,
    ownerPersonId:OWNER,centerId:key.centerId,resourceType:'communication_file_sharing',resourceId:fileId,
    actorAccountId:ACCOUNT,actorPersonId:OWNER,clientOperationId:'prepare-file-34-g-repository',commandKind:'prepare_file',
    requestFingerprint:'8'.repeat(64),expectedRevision:0,revision:1,stateFingerprint,occurredAt:NOW};
  const sealedPayloadReference=`comm-file-${'2'.repeat(64)}.pptshare`;const contentSha256='4'.repeat(64);
  const snapshot={schemaVersion:1 as const,centerId:key.centerId,ownerPersonId:OWNER,files:[{id:fileId,
    roomId:'room-34-g-repository',ownerPersonId:OWNER,displayName:'Aile belgesi.txt',mimeType:'text/plain',totalBytes:16,
    totalChunks:1,fullContentSha256:contentSha256,sealedPayloadReference,providerId:'protected-side-artifact-store-v1' as const,
    providerEvidenceSha256:'3'.repeat(64),state:'scan_required' as const,scanState:'provider_unavailable' as const,
    chunks:[{chunkIndex:0,offsetBytes:0,sizeBytes:16,sha256:'5'.repeat(64),verifiedAt:NOW}],versions:[{version:1,
      contentSha256,sizeBytes:16,sealedPayloadReference,providerId:'protected-side-artifact-store-v1' as const,
      providerEvidenceSha256:'3'.repeat(64),createdByPersonId:OWNER,createdAt:NOW}],comments:[],accessGrants:[],
    selectedForStory:false,likedByPersonIds:[],externalLinkEnabled:false as const,externalLinkAccessCodeRequired:true as const,
    revision:1,createdAt:NOW,updatedAt:NOW}],notificationProfile:{quietHoursEnabled:false,quietHoursStart:'22:00',
      quietHoursEnd:'07:00',nonEmergencyDigestEnabled:true,roomOverrides:[],personOverrides:[]},emergencyAnnouncements:[],
    remoteAssistance:[],coWatchSessions:[],voiceActions:[],truth:communicationFileSharingTruth,revision:1,generatedAt:NOW};
  return{mutation,row:{key,snapshot,stateFingerprint,lastMutationId:mutation.id,updatedAt:NOW}};};

describe('34-G communication file sharing repository and migration boundary',()=>{
  it('owns migration 111 with exact current state and an immutable receipt ledger',()=>{
    const runtime=open();
    expect(runtime.database.prepare("SELECT value FROM database_metadata WHERE key='schema_generation'").get())
      .toEqual({value:'REVISION-34-K-WINDOWS-RESILIENCE-UNIVERSAL-UX'});
    expect(FAMILY_DATABASE_MIGRATIONS.find((migration)=>migration.version===111)).toMatchObject({version:111,
      name:'communication_file_sharing_remaining_ux',checksum:'7d87d405a85196a2f76a765899adf7b734858f7dc2b1715c59577d0048838700'});
    const tables=(runtime.database.prepare(`SELECT name FROM sqlite_master WHERE type='table'
      AND name LIKE 'communication_file_sharing_%' ORDER BY name`).all() as Array<{name:string}>).map((row)=>row.name);
    expect(tables).toEqual(['communication_file_sharing_centers','communication_file_sharing_mutations']);
    const triggers=runtime.database.prepare(`SELECT name,sql FROM sqlite_master WHERE type='trigger'
      AND name LIKE 'trg_34g_%' ORDER BY name`).all() as Array<{name:string;sql:string}>;
    const triggerSql=triggers.map((row)=>row.sql).join('\n');
    expect(triggers).toHaveLength(6);
    expect(triggerSql).toContain('34-G mutation ledger is immutable');
    expect(triggerSql).toContain('34-G center update requires exact next mutation and safe file metadata');
    expect(triggerSql).toContain('34-G mutation requires exact owner-bound durable PEP receipt and current resource');
  });

  it('binds mutations to receipt version, nonce, correlation, fence, projection and exact subject/resource',()=>{
    const runtime=open();
    const tableSql=(runtime.database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='communication_file_sharing_mutations'")
      .get() as {sql:string}).sql;
    for(const marker of ['policy_receipt_hash','policy_receipt_version','policy_receipt_nonce','policy_correlation_id',
      'policy_resource_type','policy_resource_id','policy_action','policy_capability'])expect(tableSql).toContain(marker);
    const triggerSql=(runtime.database.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='trg_34g_file_sharing_mutation_insert'")
      .get() as {sql:string}).sql;
    for(const marker of ['platform_policy_database_fences','platform_policy_journal_projection_outbox',
      "$.request.subject.accountId","$.request.subject.personId","$.request.resource.familyId",
      "$.request.resource.ownerPersonId","$.request.resource.sensitivity","'highly_sensitive'","'general'"])
      expect(triggerSql).toContain(marker);
  });

  it('keeps raw file bytes, paths, plaintext payloads, keys, secrets and external URLs outside SQLite',()=>{
    const runtime=open();
    const columns=(runtime.database.prepare(`SELECT m.name table_name,p.name column_name FROM sqlite_master m,
      pragma_table_info(m.name) p WHERE m.type='table' AND m.name LIKE 'communication_file_sharing_%'
      ORDER BY m.name,p.cid`).all() as Array<{table_name:string;column_name:string}>)
      .map((row)=>`${row.table_name}.${row.column_name}`);
    expect(columns).toContain('communication_file_sharing_centers.snapshot_json');
    expect(columns.join('\n')).not.toMatch(/file_bytes|plaintext|ciphertext|private_key|secret|external_url|access_code|file_path/iu);
    const source=readFileSync('packages/repositories/src/communication-file-sharing-repository.ts','utf8');
    expect(source).toContain('Communication file sharing optimistic revision conflict');
    expect(source).toContain('platformPolicyPersistenceBinding(context, row.resourceType, row.resourceId)');
    expect(source).toContain('snapshot size bound exceeded');
  });

  it('keeps policy preauthorization resolution payload-free and rejects ambiguous file identity',()=>{
    const source=readFileSync('packages/repositories/src/communication-file-sharing-repository.ts','utf8');
    const resolver=source.slice(source.indexOf('public resolvePolicyResource'),source.indexOf('public load('));
    expect(resolver).toContain('LIMIT 2');
    expect(resolver).toContain('resource identity is ambiguous');
    expect(resolver).not.toMatch(/sealedPayloadReference|providerEvidenceSha256|fullContentSha256|displayName|comments|accessGrants/iu);
  });

  it('persists an exact owner-bound prepared file and resolves only payload-free policy metadata',async()=>{
    const harness=openHarness();const value=rows();
    expect((await withReceipt(harness,{action:'create',resourceType:'communication_file_sharing',resourceId:fileId},
      (repository,context)=>repository.save(context,value.row,value.mutation,0))).ok).toBe(true);
    expect(await withReceipt(harness,{action:'read',resourceType:'communication_file_sharing_center',resourceId:'*'},
      (repository,context)=>repository.load(context,key))).toMatchObject({ok:true,value:{snapshot:{revision:1,files:[{
        id:fileId,state:'scan_required',scanState:'provider_unavailable'}]}}});
    expect(await withReceipt(harness,{action:'read',resourceType:'communication_file_sharing',resourceId:fileId},
      (repository,context)=>repository.load(context,key))).toMatchObject({ok:true,value:{snapshot:{files:[{id:fileId}]}}});
    const context:RepositoryExecutionContext={transaction:harness.runtime.database,
      actor:{userId:ACCOUNT,personId:OWNER,roles:['family_admin']},correlationId:asCorrelationId('file-sharing-resolution'),occurredAt:NOW};
    const resolved=harness.repository.resolvePolicyResource(context,'communication_file_sharing',fileId);
    expect(resolved).toMatchObject({ok:true,value:{id:fileId,familyId:FAMILY,ownerPersonId:OWNER,revision:1,state:'scan_required'}});
    expect(JSON.stringify(resolved)).not.toMatch(/sealedPayloadReference|providerEvidenceSha256|fullContentSha256|displayName/iu);
    expect(()=>harness.runtime.database.prepare('DELETE FROM communication_file_sharing_mutations').run()).toThrow(/immutable/u);
  });

  it('rejects a foreign-owner receipt and rolls back both the mutation and current row',async()=>{
    const harness=openHarness();const value=rows();
    expect((await withReceipt(harness,{action:'create',resourceType:'communication_file_sharing',resourceId:fileId,
      ownerPersonId:OTHER},(repository,context)=>repository.save(context,value.row,value.mutation,0))).ok).toBe(false);
    expect(harness.runtime.database.prepare('SELECT count(*) count FROM communication_file_sharing_mutations').get()).toEqual({count:0});
    expect(harness.runtime.database.prepare('SELECT count(*) count FROM communication_file_sharing_centers').get()).toEqual({count:0});
  });
});
