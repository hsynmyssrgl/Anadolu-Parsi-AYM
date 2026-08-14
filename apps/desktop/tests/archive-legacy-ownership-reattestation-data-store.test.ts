import { DatabaseSync } from 'node:sqlite';
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
  ok
} from '@ppt/core';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  TransactionContext
} from '@ppt/repository-contracts';
import {
  SqliteArchiveRepository,
  SqlitePlatformPolicyTransactionRepository,
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '@ppt/repositories';
import { archiveLegacyOwnershipReattestationConfirmation } from '@ppt/domain';
import { FamilyDataStore } from '../src/main/data-store.js';
import { SqliteFamilyDatabaseRuntime } from '../src/main/family-database-runtime.js';

const temporaryDirectories:string[]=[];
const NOW=asIsoDateTime('2026-08-14T10:30:00.000Z');
const FAMILY_ID=asFamilyId('family-main');
const POLICY_VERSION='33-q-legacy-archive-ownership-reattestation-v1';
const PASSWORD='Guclu33QArsivParolasi!2026';
const ITEM_ID='legacy-ownerless-archive-item';
const kernel=new PlatformPolicyKernel({policyVersion:POLICY_VERSION,signingKey:Buffer.from('33-q-legacy-archive-owner-policy-key','utf8'),applicationCapabilities:{'windows-desktop':['archive.read','archive.write']},consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update','delete','record']});
const authorizationProvider:PlatformPolicyAuthorizationProvider=Object.freeze({resolvePolicyPackage:()=>kernel.policyPackage,authorize:({request,nonce})=>Object.freeze({effectiveRequest:request,authorization:kernel.authorizeWithReceipt(request,request.occurredAt,nonce)}),verify:({request,receipt})=>kernel.verifyReceiptForRequest(receipt,request)});
let projectionSequence=0;
const projectionProof=(record:PlatformPolicyReceiptRecord):PlatformPolicyJournalProjectionProof=>Object.freeze({schemaVersion:1,receiptHash:computePlatformPolicyReceiptHash(record.receipt),recordHash:computePlatformPolicyReceiptRecordHash(record),receiptNonce:record.receipt.nonce,entrySequence:++projectionSequence,entryHash:'b'.repeat(64),headSequence:projectionSequence,headHash:'b'.repeat(64),journalSizeBytes:projectionSequence*512,issuedAt:record.recordedAt,proofMac:'c'.repeat(64)});
const storeOptions={seed:false,archivePolicyAuthorizationProvider:authorizationProvider,archivePolicyReceiptSink:{append:()=>undefined,ensure:projectionProof,verifyProjectionProof:()=>true},archivePolicyVersion:POLICY_VERSION,archiveClusterFence:()=>({writable:true,epoch:33})} as const;

afterEach(()=>{projectionSequence=0;for(const directory of temporaryDirectories.splice(0))rmSync(directory,{recursive:true,force:true});});

const repositoryContext=(transaction:TransactionContext,accountId:string,personId:string):RepositoryExecutionContext=>({transaction:transaction.transaction,actor:{userId:asUserId(accountId),roles:['family_admin'],personId:asPersonId(personId)},correlationId:transaction.correlationId,occurredAt:transaction.occurredAt});

const seedLegacyOwnerlessArchive=async(databasePath:string,accountId:string,personId:string):Promise<void>=>{
  const runtime=new SqliteFamilyDatabaseRuntime({databasePath,applicationVersion:'33-q-legacy-owner-seed',clock:{now:()=>NOW},skipFileMigrationSafetyBackup:true,databaseConfig:{busyTimeoutMs:5_000,journalMode:'WAL',synchronous:'FULL'}});
  const policyRepository=new SqlitePlatformPolicyTransactionRepository();
  const archiveRepository=new SqliteArchiveRepository();
  try{
    const synchronized=runtime.transactionExecutor.execute(asCorrelationId('legacy-owner-seed-fence'),transaction=>policyRepository.synchronizeFence(repositoryContext(transaction,accountId,personId),{fenceName:'archive-write',epoch:33,writable:true,synchronizedAt:NOW}));
    if(!synchronized.ok)throw new Error(`[${synchronized.error.code}] ${synchronized.error.message}`);
    const pep=new PlatformPolicyEnforcementPoint({kernel,authorityResolver:{resolve:()=>({policyVersion:POLICY_VERSION,accountId:asUserId(accountId),personId:asPersonId(personId),deviceId:'device-33q-legacy-owner',applicationId:'windows-desktop',deviceTrusted:true,membershipActive:true,roles:['family_admin'],familyIds:[FAMILY_ID],online:true,grants:[{id:'grant-33q-legacy-owner-create',subjectAccountId:asUserId(accountId),resourceType:'archive_item',resourceId:ITEM_ID,actions:['create'],purposes:['archive'],effect:'allow',startsAt:'2026-01-01T00:00:00.000Z'}],expiresAt:'2026-08-14T18:35:00.000Z'})},resourceResolver:{resolve:()=>({type:'archive_item',id:ITEM_ID,familyId:FAMILY_ID,sensitivity:'personal'})},receiptSink:{append:()=>undefined,ensure:()=>undefined},replayStore:{reserve:(reservation)=>{const reserved=runtime.transactionExecutor.execute(asCorrelationId('legacy-owner-seed-reservation'),transaction=>policyRepository.reserveReplayNonce(repositoryContext(transaction,accountId,personId),reservation));if(!reserved.ok)throw new Error(reserved.error.message);return reserved.value;}},clock:()=>NOW,nonceFactory:()=> 'nonce-33q-legacy-owner-create',deferAllowedReceiptPersistence:true});
    let failedStage='';
    const result=await pep.execute({correlationId:'corr-33q-legacy-owner-create',action:'create',capability:'archive.write',resourceType:'archive_item',resourceId:ITEM_ID,purpose:'archive'},()=>({writable:true,epoch:33}),(authorization)=>runtime.transactionExecutor.execute(asCorrelationId(authorization.correlationId),transaction=>{
      const execution:PolicyAuthorizedRepositoryExecutionContext={...repositoryContext(transaction,accountId,personId),correlationId:asCorrelationId(authorization.correlationId),policyAuthorization:authorization};
      const recorded=policyRepository.recordAuthorizedTransaction(execution,{record:authorization.receiptRecord,fenceName:'archive-write',fenceEpoch:authorization.fenceEpoch,fenceWritable:true});if(!recorded.ok){failedStage=`record:${recorded.error.code}:${recorded.error.message}`;return recorded;}
      const inserted=archiveRepository.insert(execution,{id:ITEM_ID,familyId:FAMILY_ID,title:'Eski Sahipsiz Belge',originalName:'eski-belge.txt',storedName:'legacy-ownerless.vault',mimeType:'text/plain',sizeBytes:24,sha256:'7'.repeat(64),sensitivity:'personal',aiProcessingAllowed:false,createdAt:NOW});if(!inserted.ok){failedStage=`insert:${inserted.error.code}:${inserted.error.message}`;return inserted;}
      const version=archiveRepository.insertVersion(execution,{id:'legacy-ownerless-version-1',archiveItemId:ITEM_ID,versionNo:1,originalName:'eski-belge.txt',storedName:'legacy-ownerless.vault',mimeType:'text/plain',sizeBytes:24,sha256:'7'.repeat(64),createdAt:NOW,note:'Legacy ownerless fixture'});if(!version.ok)failedStage=`version:${version.error.code}:${version.error.message}`;return version;
    }));
    if(!result.ok)throw new Error(`${failedStage} [${result.error.code}] ${result.error.message} ${JSON.stringify(result.error.details??{})}`);
    const projected=runtime.transactionExecutor.execute(asCorrelationId('legacy-owner-seed-projection'),transaction=>{
      const context=repositoryContext(transaction,accountId,personId);
      const pending=policyRepository.listPendingJournalProjections(context,100);
      if(!pending.ok)return pending;
      for(const projection of pending.value){
        const acknowledged=policyRepository.acknowledgeJournalProjection(context,{
          receiptHash:projection.receiptHash,
          projectedAt:NOW,
          proof:projectionProof(projection.record)
        });
        if(!acknowledged.ok)return acknowledged;
        if(!acknowledged.value)throw new Error(`Platform policy receipt projection was not acknowledged: ${projection.receiptHash}`);
      }
      return ok(undefined);
    });
    if(!projected.ok)throw new Error(`[${projected.error.code}] ${projected.error.message}`);
  }finally{runtime.close();}
};

describe('33-Q legacy archive ownership reattestation DataStore integration',()=>{
  it('fails closed, strongly authenticates, persists one actor-bound ledger and exposes only the safe result',async()=>{
    const directory=mkdtempSync(join(tmpdir(),'ppt-33q-legacy-archive-owner-'));temporaryDirectories.push(directory);
    const databasePath=join(directory,'family.db');
    let store:FamilyDataStore|undefined;
    try{
      store=new FamilyDataStore({databasePath,...storeOptions});
      store.setupAdmin({familyName:'33-Q Legacy Test Ailesi',displayName:'33-Q Yöneticisi',password:PASSWORD});
      const account=store.listAccounts()[0]!;
      store.close();store=undefined;
      await seedLegacyOwnerlessArchive(databasePath,account.id,account.personId!);
      store=new FamilyDataStore({databasePath,...storeOptions});
      store.login({accountId:account.id,password:PASSWORD});
      store.upsertPermission({subjectAccountId:account.id,resourceType:'archive_item',resourceId:ITEM_ID,actions:['read','update'],effect:'allow',purpose:'general'});
      expect(store.listLargeArchive({limit:20}).items.find(item=>item.id===ITEM_ID)?.ownershipBinding).toBe('legacy_unverified');
      await expect(store.reattestLegacyArchiveOwnership({itemId:ITEM_ID,password:'yanlış-parola',confirmation:archiveLegacyOwnershipReattestationConfirmation(ITEM_ID)})).rejects.toThrow(/AUTH-CREDENTIALS-001/u);
      await expect(store.reattestLegacyArchiveOwnership({itemId:ITEM_ID,password:PASSWORD,confirmation:'YANLIŞ ONAY'})).rejects.toThrow(/onay metni/u);
      const result=await store.reattestLegacyArchiveOwnership({itemId:ITEM_ID,password:PASSWORD,confirmation:archiveLegacyOwnershipReattestationConfirmation(ITEM_ID)});
      expect(result).toEqual({itemId:ITEM_ID,ownershipBinding:'verified_actor',reattestedAt:expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/u)});
      expect(store.listLargeArchive({limit:20}).items.find(item=>item.id===ITEM_ID)?.ownershipBinding).toBe('verified_actor');
      await expect(store.reattestLegacyArchiveOwnership({itemId:ITEM_ID,password:PASSWORD,confirmation:archiveLegacyOwnershipReattestationConfirmation(ITEM_ID)})).rejects.toThrow(/RESOURCE-CONFLICT-001/u);
    }finally{store?.close();}

    const database=new DatabaseSync(databasePath,{readOnly:true});
    try{
      expect(Number(database.prepare('SELECT COUNT(*) count FROM archive_legacy_ownership_reattestations WHERE archive_item_id=?').get(ITEM_ID)?.count)).toBe(1);
      expect(Number(database.prepare("SELECT COUNT(*) count FROM audit_log WHERE action='archive.legacy_ownership_reattested' AND resource_id=?").get(ITEM_ID)?.count)).toBe(1);
      expect(Number(database.prepare("SELECT COUNT(*) count FROM event_outbox WHERE event_type='archive.legacy_ownership_reattested' AND aggregate_id=?").get(ITEM_ID)?.count)).toBe(1);
      const receipt=database.prepare("SELECT json_extract(receipt.record_json,'$.request.resource.ownerPersonId') owner_person_id,json_extract(receipt.record_json,'$.request.subject.personId') subject_person_id FROM archive_items item JOIN platform_policy_transaction_receipts receipt ON receipt.receipt_hash=item.policy_receipt_hash WHERE item.id=?").get(ITEM_ID) as Record<string,unknown>;
      expect(receipt.owner_person_id).toBe(receipt.subject_person_id);
      expect(JSON.stringify(database.prepare('SELECT * FROM archive_legacy_ownership_reattestations WHERE archive_item_id=?').get(ITEM_ID))).not.toContain(PASSWORD);
      expect(JSON.stringify(database.prepare("SELECT payload_json FROM event_outbox WHERE event_type='archive.legacy_ownership_reattested' AND aggregate_id=?").get(ITEM_ID))).not.toContain(PASSWORD);
    }finally{database.close();}
  });
});
