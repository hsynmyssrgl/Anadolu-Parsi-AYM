import { DatabaseSync } from 'node:sqlite';
import { afterEach,describe,expect,it } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';import { join } from 'node:path';import { tmpdir } from 'node:os';
import { PlatformPolicyKernel,type PlatformPolicyAuthorizationProvider,type PlatformPolicyJournalProjectionProof,type PlatformPolicyReceiptRecord } from '@ppt/platform-policy';
import { asCorrelationId,asFamilyId,asPersonId,asUserId,ok } from '@ppt/core';
import { computePlatformPolicyReceiptHash,computePlatformPolicyReceiptRecordHash } from '@ppt/repositories';
import { FamilyDataStore } from '../src/main/data-store.js';
import { RepositoryBackedFamilyAiAssistantSourcePort } from '../src/main/family-ai-assistant-application-adapter.js';

const POLICY_VERSION='33-w-family-ai-data-store-v1';const PASSWORD='Guclu33WAileAsistaniParolasi!';
const directories:string[]=[];const stores:FamilyDataStore[]=[];let projectionSequence=0;
const kernel=new PlatformPolicyKernel({policyVersion:POLICY_VERSION,signingKey:Buffer.from('33-w-family-ai-data-store-key-material','utf8'),
  applicationCapabilities:{'windows-desktop':['family.read','family.write','location.read']},consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update','delete']});
const provider:PlatformPolicyAuthorizationProvider={resolvePolicyPackage:()=>kernel.policyPackage,
  authorize:({request,nonce})=>({effectiveRequest:request,authorization:kernel.authorizeWithReceipt(request,request.occurredAt,nonce)}),
  verify:({request,receipt})=>kernel.verifyReceiptForRequest(receipt,request)};
const projectionProof=(record:PlatformPolicyReceiptRecord):PlatformPolicyJournalProjectionProof=>({schemaVersion:1,
  receiptHash:computePlatformPolicyReceiptHash(record.receipt),recordHash:computePlatformPolicyReceiptRecordHash(record),receiptNonce:record.receipt.nonce,
  entrySequence:++projectionSequence,entryHash:'d'.repeat(64),headSequence:projectionSequence,headHash:'d'.repeat(64),
  journalSizeBytes:projectionSequence*512,issuedAt:record.recordedAt,proofMac:'e'.repeat(64)});
afterEach(()=>{projectionSequence=0;for(const store of stores.splice(0)){try{store.close();}catch{/* best effort */}}
  for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
const makeStore=(governed:boolean)=>{const directory=mkdtempSync(join(tmpdir(),'ppt-33w-family-ai-'));directories.push(directory);
  const databasePath=join(directory,'family.db');const store=new FamilyDataStore({databasePath,seed:false,...(governed?{
    archivePolicyAuthorizationProvider:provider,archivePolicyReceiptSink:{append:()=>undefined,ensure:projectionProof,verifyProjectionProof:()=>true},
    archivePolicyVersion:POLICY_VERSION,archiveClusterFence:()=>({writable:true,epoch:101})}: {})});stores.push(store);
  store.setupAdmin({familyName:'33-W Yerel Asistan Ailesi',displayName:'33-W Aile Yöneticisi',email:'assistant-33w@example.test',password:PASSWORD});
  const account=store.listAccounts()[0]!;return {databasePath,store,ownerPersonId:account.personId!,accountId:account.id};};

describe('33-W family AI assistant DataStore integration',()=>{
  it('does not require sensitive-profile authority for a non-sensitive source set',async()=>{
    let sensitiveLoads=0;const source=new RepositoryBackedFamilyAiAssistantSourcePort({
      unifiedSource:{now:()=> '2026-08-16T00:00:00.000Z' as never,loadAuthorizedCandidates:()=>Promise.resolve(ok([{
        module:'event' as const,resourceType:'event' as const,resourceId:'event-non-sensitive-33-w',title:'Aile toplantısı',
        searchableText:['Aile toplantısı'],occurredAt:'2026-08-16T00:00:00.000Z' as never}]))},
      loadOcrCenter:()=>{throw new Error('unexpected OCR load');},loadHouseholdCenter:()=>{throw new Error('unexpected household load');},
      loadPlacesCenter:()=>{throw new Error('unexpected places load');},
      listConsents:()=>Promise.resolve([{id:'consent-event-33-w',accountId:'account-source-33-w',purpose:'search',resourceType:'event',
        resourceId:'event-non-sensitive-33-w',status:'granted' as const,startsAt:'2026-01-01T00:00:00.000Z',createdAt:'2026-01-01T00:00:00.000Z'}]),
      listSensitiveProfiles:()=>{sensitiveLoads+=1;throw new Error('sensitive profile authority unavailable');},
      now:()=> '2026-08-16T00:00:00.000Z'
    });
    const context={familyId:asFamilyId('family-source-33-w'),actor:{userId:asUserId('account-source-33-w'),role:'member' as const,
      personId:asPersonId('person-source-33-w')},correlationId:asCorrelationId('correlation-source-33-w')};
    expect(await source.loadAuthorizedCandidates(context,{kind:'authorized_search',purpose:'search',modules:['event'],query:'aile'}))
      .toMatchObject({ok:true,value:[{resourceId:'event-non-sensitive-33-w'}]});expect(sensitiveLoads).toBe(0);
    expect(await source.loadAuthorizedCandidates(context,{kind:'authorized_search',purpose:'search',modules:['finance'],query:'aile'}))
      .toMatchObject({ok:true,value:[]});expect(sensitiveLoads).toBe(1);
  });

  it('fails closed before reads or writes when production Life PEP is absent',async()=>{const {store}=makeStore(false);
    await expect(store.getFamilyAiAssistantCenter()).rejects.toThrow(/policy enforcement is not composed/i);
    await expect(store.generateFamilyAiSuggestion({clientOperationId:'operation-no-pep-33-w',suggestionId:'suggestion-no-pep-33-w',
      kind:'authorized_search',modules:['event'],query:'aile toplantısı'})).rejects.toThrow(/PERMISSION-DENIED|yetkili kaynak/i);
  });

  it('persists, replays, confirms, hides on consent revocation and atomically rolls back',async()=>{
    const {databasePath,store,accountId}=makeStore(true);
    store.upsertPermission({subjectAccountId:accountId,resourceType:'family_ai_assistant_center',resourceId:'*',actions:['read'],effect:'allow',purpose:'general'});
    store.upsertPermission({subjectAccountId:accountId,resourceType:'family_ai_suggestion',resourceId:'*',actions:['read','create','update'],effect:'allow',purpose:'general'});
    const created=await store.createEvent({title:'33-W Aile Toplantısı',startAt:'2026-09-01T15:00:00.000Z',visibility:'family',
      participantPersonIds:[],aiProcessingAllowed:true});const eventId=created.event!.id;
    expect((await store.getSnapshotSections({sections:['graph','timeline']})).events?.some(event=>event.id===eventId)).toBe(true);
    store.upsertAiConsent({purpose:'search',resourceType:'event',resourceId:eventId,status:'granted'});
    const command={clientOperationId:'operation-generate-33-w',suggestionId:'suggestion-33-w',kind:'authorized_search' as const,
      modules:['event'] as const,query:'aile toplantısı'};
    expect(await store.generateFamilyAiSuggestion(command)).toMatchObject({revision:1,replayed:false,mutationKind:'suggestion_generate',
      durableActionPerformed:'not_performed',networkUsed:false,cloudUsed:false});
    expect(await store.generateFamilyAiSuggestion(command)).toMatchObject({revision:1,replayed:true});
    await expect(store.generateFamilyAiSuggestion({...command,query:'toplantısı'})).rejects.toThrow(/CONFLICT|çatış|farklı/i);
    expect(await store.getFamilyAiAssistantCenter()).toMatchObject({suggestions:[{id:command.suggestionId,status:'pending_confirmation',
      sources:[{module:'event',resourceType:'event',resourceId:eventId}]}],truth:{localFirst:true,providerConfigured:false,networkUsed:false,
      modelInferencePerformed:false,confirmationExecutesDownstreamAction:false}});
    expect(await store.reviewFamilyAiSuggestion({clientOperationId:'operation-confirm-33-w',suggestionId:command.suggestionId,
      expectedRevision:1,decision:'confirm'})).toMatchObject({revision:2,mutationKind:'suggestion_confirm',humanConfirmationRecorded:true,
      durableActionPerformed:'not_performed'});
    const pending={clientOperationId:'operation-pending-33-w',suggestionId:'suggestion-pending-33-w',kind:'authorized_search' as const,
      modules:['event'] as const,query:'aile toplantısı'};
    expect(await store.generateFamilyAiSuggestion(pending)).toMatchObject({revision:1,replayed:false});
    store.upsertAiConsent({purpose:'search',resourceType:'event',resourceId:eventId,status:'revoked'});
    store.upsertAiConsent({purpose:'search',resourceType:'event',resourceId:'*',status:'granted'});
    expect(await store.getFamilyAiAssistantCenter()).toMatchObject({suggestions:[],hiddenAfterConsentRevocationCount:2,
      inactiveConsentSuggestions:[{id:pending.suggestionId,revision:1}],suggestionCapacity:{maximum:500,used:2,remaining:498,limitReached:false},
      truth:{explicitConsentRevocationOverridesBroaderGrant:true,confidenceRepresentsSourceCoverageOnly:true}});
    await expect(store.reviewFamilyAiSuggestion({clientOperationId:'operation-revoked-confirm-33-w',suggestionId:pending.suggestionId,
      expectedRevision:1,decision:'confirm'})).rejects.toThrow(/PERMISSION-DENIED|geri çekilmiş/i);
    expect(await store.reviewFamilyAiSuggestion({clientOperationId:'operation-revoked-dismiss-33-w',suggestionId:pending.suggestionId,
      expectedRevision:1,decision:'dismiss'})).toMatchObject({revision:2,mutationKind:'suggestion_dismiss',humanConfirmationRecorded:false});
    expect(await store.getFamilyAiAssistantCenter()).toMatchObject({suggestions:[],hiddenAfterConsentRevocationCount:2,
      inactiveConsentSuggestions:[]});
    store.upsertAiConsent({purpose:'search',resourceType:'event',resourceId:eventId,status:'granted'});
    const injector=new DatabaseSync(databasePath);try{injector.exec(`CREATE TRIGGER test_33w_family_ai_outbox_failure BEFORE INSERT ON event_outbox WHEN NEW.event_type='family_ai.suggestion_generate' BEGIN SELECT RAISE(ABORT,'controlled 33-W outbox failure'); END;`);}finally{injector.close();}
    await expect(store.generateFamilyAiSuggestion({clientOperationId:'operation-rollback-33-w',suggestionId:'suggestion-rollback-33-w',
      kind:'authorized_search',modules:['event'],query:'aile toplantısı'})).rejects.toThrow(/SQLite|beklenmeyen/i);
    store.close();stores.splice(stores.indexOf(store),1);const database=new DatabaseSync(databasePath,{readOnly:true});try{
      expect(database.prepare('SELECT COUNT(*) count FROM family_ai_suggestions').get()).toEqual({count:2});
      expect(database.prepare('SELECT COUNT(*) count FROM family_ai_suggestion_mutations').get()).toEqual({count:4});
      expect(database.prepare("SELECT COUNT(*) count FROM family_ai_suggestions WHERE id='suggestion-rollback-33-w'").get()).toEqual({count:0});
      expect(database.prepare("SELECT COUNT(*) count FROM audit_log WHERE action LIKE 'family_ai.%'").get()).toEqual({count:4});
      expect(database.prepare("SELECT COUNT(*) count FROM event_outbox WHERE event_type LIKE 'family_ai.%'").get()).toEqual({count:4});
      const metadata=JSON.stringify({audits:database.prepare("SELECT action,resource_type,resource_id FROM audit_log WHERE action LIKE 'family_ai.%'").all(),
        events:database.prepare("SELECT event_type,aggregate_type,aggregate_id,payload_json FROM event_outbox WHERE event_type LIKE 'family_ai.%'").all()});
      expect(metadata).not.toContain('33-W Aile Toplantısı');expect(metadata).not.toContain('aile toplantısı');
    }finally{database.close();}
  });
});
