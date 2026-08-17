import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import {
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '@ppt/repositories';
import { FamilyDataStore } from '../src/main/data-store.js';

const directories:string[]=[];
const stores:FamilyDataStore[]=[];
const policyVersion='33-r-archive-evidence-data-store-v1';
const kernel=new PlatformPolicyKernel({
  policyVersion,signingKey:Buffer.from('33-r-archive-evidence-data-store-policy-key','utf8'),
  applicationCapabilities:{'windows-desktop':['family.read','family.write','archive.read','archive.write']},
  consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update','delete','record']
});
const provider:PlatformPolicyAuthorizationProvider={
  resolvePolicyPackage:()=>kernel.policyPackage,
  authorize:({request,nonce})=>({effectiveRequest:request,authorization:kernel.authorizeWithReceipt(request,request.occurredAt,nonce)}),
  verify:({request,receipt})=>kernel.verifyReceiptForRequest(receipt,request)
};
let projectionSequence=0;
const projectionProof=(record:PlatformPolicyReceiptRecord):PlatformPolicyJournalProjectionProof=>({
  schemaVersion:1,receiptHash:computePlatformPolicyReceiptHash(record.receipt),recordHash:computePlatformPolicyReceiptRecordHash(record),
  receiptNonce:record.receipt.nonce,entrySequence:++projectionSequence,entryHash:'d'.repeat(64),headSequence:projectionSequence,
  headHash:'d'.repeat(64),journalSizeBytes:projectionSequence*512,issuedAt:record.recordedAt,proofMac:'e'.repeat(64)
});

afterEach(()=>{
  projectionSequence=0;
  for(const store of stores.splice(0))store.close();
  for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});
});

const makeStore=()=>{
  const directory=mkdtempSync(join(tmpdir(),'ppt-33r-archive-data-store-'));
  directories.push(directory);
  const databasePath=join(directory,'family.db');
  const store=new FamilyDataStore({
    databasePath,seed:false,archivePath:join(directory,'archive-vault'),
    archivePolicyAuthorizationProvider:provider,
    archivePolicyReceiptSink:{append:()=>undefined,ensure:projectionProof,verifyProjectionProof:()=>true},
    archivePolicyVersion:policyVersion,archiveClusterFence:()=>({writable:true,epoch:96})
  });
  stores.push(store);
  return {directory,databasePath,store};
};

describe('33-R archive evidence/media DataStore integration',()=>{
  it('persists/replays relation evidence and version files without leaking plaintext or paths',async()=>{
    const {directory,databasePath,store}=makeStore();
    store.setupAdmin({familyName:'33-R Test Ailesi',displayName:'33-R Yöneticisi',email:'33r@example.test',password:'Guclu33RArsivParolasi!'});
    const owner=store.listAccounts()[0]!;
    const member=store.createMember({displayName:'Kanıt İlişkisi Kişisi',relationshipType:'Çocuk',generation:1,branch:'Ana Dal'});
    const relation=store.createRelation({fromPersonId:owner.personId!,toPersonId:member.entityId,relationType:'parent'});
    const firstPath=join(directory,'aile-belgesi-v1.txt');
    const secondPath=join(directory,'aile-belgesi-v2.txt');
    const plaintextCanary='33-R-PLAINTEXT-CANARY-ARSIV-KANITI';
    writeFileSync(firstPath,'ilk sürüm','utf8');
    writeFileSync(secondPath,`${plaintextCanary}\nikinci sürüm`,'utf8');
    const item=(await store.importArchiveFile(firstPath,{title:'Aile İlişkisi Kanıt Belgesi'})).find(value=>value.title==='Aile İlişkisi Kanıt Belgesi')!;

    const addInput={archiveItemId:item.id,relationId:relation.entityId,evidenceDate:new Date().toISOString().slice(0,10),confidence:'high' as const,clientOperationId:'archive-evidence-add-33-r'};
    const added=await store.addArchiveRelationEvidence(addInput);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({relationId:relation.entityId,archiveItemId:item.id,confidence:'high',status:'active',revision:1});
    expect(await store.addArchiveRelationEvidence(addInput)).toEqual(added);
    expect(await store.listArchiveRelationEvidenceHistory(item.id)).toHaveLength(1);

    const versionInput={itemId:item.id,note:'Doğrulanmış ikinci sürüm',clientOperationId:'archive-version-add-33-r'};
    const versions=await store.addArchiveItemVersionFile(secondPath,versionInput);
    expect(versions.map(value=>value.versionNo)).toEqual([2,1]);
    expect(versions[0]).toMatchObject({originalName:'aile-belgesi-v2.txt',note:'Doğrulanmış ikinci sürüm'});
    expect(await store.addArchiveItemVersionFile(secondPath,versionInput)).toEqual(versions);

    const removeInput={archiveItemId:item.id,evidenceId:added[0]!.id,expectedRevision:1,clientOperationId:'archive-evidence-remove-33-r'};
    expect(await store.removeArchiveRelationEvidence(removeInput)).toEqual([]);
    expect(await store.removeArchiveRelationEvidence(removeInput)).toEqual([]);
    const history=await store.listArchiveRelationEvidenceHistory(item.id);
    expect(history.map(value=>value.mutationKind)).toEqual(['evidence_remove','evidence_create']);

    store.close();stores.splice(stores.indexOf(store),1);
    const restarted=new FamilyDataStore({
      databasePath,seed:false,archivePath:join(directory,'archive-vault'),
      archivePolicyAuthorizationProvider:provider,
      archivePolicyReceiptSink:{append:()=>undefined,ensure:projectionProof,verifyProjectionProof:()=>true},
      archivePolicyVersion:policyVersion,archiveClusterFence:()=>({writable:true,epoch:96})
    });
    stores.push(restarted);
    restarted.login({email:'33r@example.test',password:'Guclu33RArsivParolasi!'});
    expect(await restarted.addArchiveItemVersionFile(secondPath,{...versionInput,clientOperationId:'restartte-degisen-renderer-kimligi'})).toEqual(versions);
    restarted.close();stores.splice(stores.indexOf(restarted),1);
    const database=new DatabaseSync(databasePath,{readOnly:true});
    try{
      expect(database.prepare('SELECT COUNT(*) count FROM archive_relation_evidence_mutations').get()).toEqual({count:2});
      expect(database.prepare('SELECT status,revision FROM archive_relation_evidence').get()).toEqual({status:'removed',revision:2});
      expect(database.prepare('SELECT COUNT(*) count FROM archive_versions WHERE archive_item_id=?').get(item.id)).toEqual({count:2});
      expect(database.prepare('SELECT original_name,size_bytes FROM archive_items WHERE id=?').get(item.id)).toEqual({original_name:'aile-belgesi-v2.txt',size_bytes:Buffer.byteLength(`${plaintextCanary}\nikinci sürüm`,'utf8')});
      const persisted=JSON.stringify({audits:database.prepare("SELECT action,resource_type,resource_id FROM audit_log WHERE action LIKE 'archive.%'").all(),events:database.prepare("SELECT event_type,aggregate_type,aggregate_id,payload_json FROM event_outbox WHERE event_type LIKE 'archive.%'").all()});
      expect(persisted).not.toContain(plaintextCanary);
      expect(persisted).not.toContain(secondPath);
      expect(persisted).not.toContain('stored_name');
    }finally{database.close();}
  });
});
