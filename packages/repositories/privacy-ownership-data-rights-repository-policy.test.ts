import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId, asUserId } from '@ppt/core';
import type { RepositoryTransaction } from '@ppt/contracts';
import { FAMILY_DATABASE_MIGRATIONS, runFamilyDatabaseMigrations } from '@ppt/database';
import { canonicalDataRightsRequestStateJson, canonicalEncryptedPrivacyExportStateJson } from '@ppt/domain';
import { PlatformPolicyEnforcementPoint, PlatformPolicyKernel } from '@ppt/platform-policy';
import type { DataRightsRequestRow, PolicyAuthorizedRepositoryExecutionContext } from '@ppt/repository-contracts';
import {
  computePrivacyOwnershipStateFingerprint,
  SqlitePrivacyOwnershipDataRightsRepository
} from './src/privacy-ownership-data-rights-repository.js';

const NOW = '2026-08-14T06:00:00.000Z';
const FAMILY_ID = asFamilyId('family-33-o-a');
const PERSON_ID = asPersonId('person-33-o-a');
const ACCOUNT_ID = asUserId('account-33-o-a');
const SAME_FAMILY_PERSON_ID = asPersonId('person-33-o-b');
const SAME_FAMILY_ACCOUNT_ID = asUserId('account-33-o-b');
const OTHER_FAMILY_ID = asFamilyId('family-33-o-b');
const OTHER_PERSON_ID = asPersonId('person-33-o-c');
const OTHER_ACCOUNT_ID = asUserId('account-33-o-c');
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);
const databases: DatabaseSync[] = [];

afterEach(() => { for (const database of databases.splice(0)) database.close(); });

const migration92 = FAMILY_DATABASE_MIGRATIONS.find(({ version }) => version === 92);
if (!migration92) throw new Error('MIGRATION_92_NOT_FOUND');

const fixtureSchema = `
 PRAGMA foreign_keys=ON;
 CREATE TABLE families(id TEXT PRIMARY KEY);
 CREATE TABLE people(id TEXT PRIMARY KEY,family_id TEXT NOT NULL,status TEXT NOT NULL);
 CREATE TABLE accounts(id TEXT PRIMARY KEY,person_id TEXT NOT NULL,status TEXT NOT NULL);
 CREATE TABLE database_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE platform_policy_database_fences(fence_name TEXT PRIMARY KEY,epoch INTEGER NOT NULL,writable INTEGER NOT NULL);
 CREATE TABLE platform_policy_transaction_receipts(
  receipt_hash TEXT PRIMARY KEY,resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,action TEXT NOT NULL,
  capability TEXT NOT NULL,fence_name TEXT NOT NULL,fence_epoch INTEGER NOT NULL,record_json TEXT NOT NULL
 );
 CREATE TABLE platform_policy_journal_projection_outbox(receipt_hash TEXT PRIMARY KEY,record_json TEXT NOT NULL);
 CREATE TABLE derived_data_policy_bindings(
  binding_hash TEXT PRIMARY KEY,status TEXT NOT NULL,derived_kind TEXT NOT NULL,derived_resource_type TEXT NOT NULL,
  derived_resource_id TEXT NOT NULL,family_id TEXT NOT NULL,sealed_at TEXT,lineage_depth INTEGER,retention_until TEXT
 );
 CREATE TABLE derived_data_policy_sources(
  binding_hash TEXT NOT NULL,source_resource_type TEXT NOT NULL,source_resource_id TEXT NOT NULL,source_ordinal INTEGER
 );
 CREATE TABLE trusted_devices(
  id TEXT PRIMARY KEY,account_id TEXT NOT NULL,device_id TEXT NOT NULL,display_name TEXT NOT NULL,last_seen_at TEXT NOT NULL,
  security_epoch INTEGER NOT NULL,revoked_at TEXT
 );
 CREATE TABLE data_lifecycle(resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,state TEXT,backup_propagation_pending INTEGER);
 INSERT INTO families VALUES('${FAMILY_ID}');
 INSERT INTO people VALUES('${PERSON_ID}','${FAMILY_ID}','active');
 INSERT INTO accounts VALUES('${ACCOUNT_ID}','${PERSON_ID}','active');
 INSERT INTO database_metadata VALUES('schema_generation','before-33-o','${NOW}');
 INSERT INTO platform_policy_database_fences VALUES('33-o-write',92,1);
`;

const openFixture = (): DatabaseSync => {
  const database = new DatabaseSync(':memory:'); databases.push(database);
  database.exec(fixtureSchema); database.exec(migration92.sql); return database;
};

interface TableColumn {
  readonly name: string;
  readonly type: string;
}

const uncheckedValue = (table: string, suffix: string, column: TableColumn): unknown => {
  if (column.name.endsWith('_at') || column.name.endsWith('_date') || column.name.includes('occurred')) return NOW;
  if (column.name.includes('sha256') || column.name.includes('fingerprint') || column.name.endsWith('_hash')) {
    return createHash('sha256').update(`${table}:${suffix}:${column.name}`,'utf8').digest('hex');
  }
  if (column.name.endsWith('_json')) return column.name.includes('mapping') || column.name.includes('payload') ? '{}' : '[]';
  if (/INT/u.test(column.type)) return 1;
  if (/REAL|NUM|DEC|DOUBLE|FLOAT/u.test(column.type)) return 1;
  if (/BLOB/u.test(column.type)) return Buffer.from(`${table}:${suffix}:${column.name}`,'utf8');
  return `${table}-${suffix}-${column.name}`;
};

const insertActualRow = (
  database: DatabaseSync,
  table: string,
  suffix: string,
  overrides: Readonly<Record<string, unknown>> = {}
): void => {
  const columns = database.prepare(`PRAGMA table_info("${table.replaceAll('"','""')}")`).all() as TableColumn[];
  if (columns.length === 0) throw new Error(`ACTUAL_MIGRATION_TABLE_MISSING:${table}`);
  const values = columns.map((column) => Object.prototype.hasOwnProperty.call(overrides,column.name)
    ? overrides[column.name]
    : uncheckedValue(table,suffix,column));
  database.prepare(`INSERT INTO "${table.replaceAll('"','""')}"(${columns.map((column)=>`"${column.name.replaceAll('"','""')}"`).join(',')})
    VALUES(${columns.map(()=>'?').join(',')})`).run(...values);
};

const receiptRecordJson = (accountId:string,personId:string,familyId:string):string => JSON.stringify({
  request:{subject:{accountId,personId},resource:{familyId,ownerPersonId:personId}},decision:{allowed:true}
});

const openActualInventoryFixture = (): DatabaseSync => {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  runFamilyDatabaseMigrations({database,databasePath:':memory:',applicationVersion:'33-o-inventory-test',skipFileSafetyBackup:true});
  database.exec('PRAGMA foreign_keys=OFF; PRAGMA ignore_check_constraints=ON;');
  for(const row of database.prepare("SELECT name FROM sqlite_schema WHERE type='trigger' ORDER BY name").all() as Array<{name:string}>){
    database.exec(`DROP TRIGGER "${row.name.replaceAll('"','""')}"`);
  }
  insertActualRow(database,'families','owner',{id:FAMILY_ID});
  insertActualRow(database,'families','other',{id:OTHER_FAMILY_ID});
  insertActualRow(database,'people','owner',{id:PERSON_ID,family_id:FAMILY_ID,status:'active'});
  insertActualRow(database,'people','same-family',{id:SAME_FAMILY_PERSON_ID,family_id:FAMILY_ID,status:'active'});
  insertActualRow(database,'people','other-family',{id:OTHER_PERSON_ID,family_id:OTHER_FAMILY_ID,status:'active'});
  insertActualRow(database,'accounts','owner',{id:ACCOUNT_ID,person_id:PERSON_ID,status:'active',role:'family_admin'});
  insertActualRow(database,'accounts','same-family',{id:SAME_FAMILY_ACCOUNT_ID,person_id:SAME_FAMILY_PERSON_ID,status:'active',role:'family_admin'});
  insertActualRow(database,'accounts','other-family',{id:OTHER_ACCOUNT_ID,person_id:OTHER_PERSON_ID,status:'active',role:'family_admin'});
  return database;
};

const seedInventoryCollections = (database:DatabaseSync):void => {
  const ownerScope={family_id:FAMILY_ID,owner_person_id:PERSON_ID};
  const foreignScope={family_id:FAMILY_ID,owner_person_id:SAME_FAMILY_PERSON_ID};
  for(const table of ['locations','events','bank_accounts','payment_cards','loan_accounts','finance_planning_ledger',
    'finance_import_batches','finance_import_entries','life_managed_ledger','life_home_inventory_ledger']){
    insertActualRow(database,table,'owner',{...ownerScope,id:`${table}-owner`});
    insertActualRow(database,table,'foreign',{...foreignScope,id:`${table}-foreign`});
  }
  insertActualRow(database,'long_term_portfolios','owner',{...ownerScope,id:'portfolio-owner'});
  insertActualRow(database,'long_term_portfolios','foreign',{family_id:OTHER_FAMILY_ID,owner_person_id:OTHER_PERSON_ID,id:'portfolio-foreign'});
  insertActualRow(database,'governed_form_drafts','owner',{...ownerScope,account_id:ACCOUNT_ID,resource_id:'form-owner'});
  insertActualRow(database,'governed_form_drafts','foreign',{...foreignScope,account_id:SAME_FAMILY_ACCOUNT_ID,resource_id:'form-foreign'});
  insertActualRow(database,'accessibility_preferences','owner',{...ownerScope,account_id:ACCOUNT_ID});
  insertActualRow(database,'accessibility_preferences','foreign',{...foreignScope,account_id:SAME_FAMILY_ACCOUNT_ID});

  const ownerArchiveReceipt='1'.repeat(64);const foreignArchiveReceipt='2'.repeat(64);
  insertActualRow(database,'platform_policy_transaction_receipts','archive-owner',{
    receipt_hash:ownerArchiveReceipt,record_json:receiptRecordJson(ACCOUNT_ID,PERSON_ID,FAMILY_ID)
  });
  insertActualRow(database,'platform_policy_transaction_receipts','archive-foreign',{
    receipt_hash:foreignArchiveReceipt,record_json:receiptRecordJson(SAME_FAMILY_ACCOUNT_ID,SAME_FAMILY_PERSON_ID,FAMILY_ID)
  });
  insertActualRow(database,'archive_items','owner',{id:'archive-owner',family_id:FAMILY_ID,policy_receipt_hash:ownerArchiveReceipt,destroyed_at:null});
  insertActualRow(database,'archive_items','foreign',{id:'archive-foreign',family_id:FAMILY_ID,policy_receipt_hash:foreignArchiveReceipt,destroyed_at:null});

  insertActualRow(database,'digital_legacy_plans','owner',{id:'legacy-owner',owner_person_id:PERSON_ID,status:'active'});
  insertActualRow(database,'digital_legacy_plans','foreign',{id:'legacy-foreign',owner_person_id:SAME_FAMILY_PERSON_ID,status:'active'});
  insertActualRow(database,'data_lifecycle','owner',{resource_type:'finance_record',resource_id:'finance-owner',owner_person_id:PERSON_ID,privacy:'private',state:'active'});
  insertActualRow(database,'data_lifecycle','foreign',{resource_type:'finance_record',resource_id:'finance-foreign',owner_person_id:SAME_FAMILY_PERSON_ID,privacy:'private',state:'active'});

  const ownerDerivedReceipt='3'.repeat(64);const foreignDerivedReceipt='4'.repeat(64);
  insertActualRow(database,'platform_policy_transaction_receipts','derived-owner',{
    receipt_hash:ownerDerivedReceipt,record_json:receiptRecordJson(ACCOUNT_ID,PERSON_ID,FAMILY_ID)
  });
  insertActualRow(database,'platform_policy_transaction_receipts','derived-foreign',{
    receipt_hash:foreignDerivedReceipt,record_json:receiptRecordJson(SAME_FAMILY_ACCOUNT_ID,SAME_FAMILY_PERSON_ID,FAMILY_ID)
  });
  insertActualRow(database,'derived_data_policy_bindings','derived-owner',{
    binding_hash:'5'.repeat(64),family_id:FAMILY_ID,status:'sealed',derived_kind:'OCR_TEXT',derived_resource_type:'ocr_text',
    derived_resource_id:'derived-owner',sensitivity:'personal',producer_receipt_hash:ownerDerivedReceipt,sealed_at:NOW,lineage_depth:1
  });
  insertActualRow(database,'derived_data_policy_bindings','derived-foreign',{
    binding_hash:'6'.repeat(64),family_id:FAMILY_ID,status:'sealed',derived_kind:'OCR_TEXT',derived_resource_type:'ocr_text',
    derived_resource_id:'derived-foreign',sensitivity:'personal',producer_receipt_hash:foreignDerivedReceipt,sealed_at:NOW,lineage_depth:1
  });
  insertActualRow(database,'derived_data_policy_sources','derived-owner',{
    binding_hash:'5'.repeat(64),source_ordinal:0,source_resource_type:'archive_item',source_resource_id:'archive-owner'
  });
  insertActualRow(database,'derived_data_policy_sources','derived-foreign',{
    binding_hash:'6'.repeat(64),source_ordinal:0,source_resource_type:'archive_item',source_resource_id:'archive-foreign'
  });
};

let inventoryPolicySequence=0;
const loadActualInventory = async (database:DatabaseSync) => {
  inventoryPolicySequence+=1;
  const kernel=new PlatformPolicyKernel({
    policyVersion:'33-o-inventory-policy-v1',signingKey:Buffer.from('33-o-inventory-policy-signing-key-v1','utf8'),
    applicationCapabilities:{'windows-desktop':['family.read']},consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update','delete','record']
  });
  const correlationId=asCorrelationId(`33-o-inventory-${inventoryPolicySequence}`);
  const pep=new PlatformPolicyEnforcementPoint({kernel,authorityResolver:{resolve:()=>({
    policyVersion:'33-o-inventory-policy-v1',accountId:ACCOUNT_ID,personId:PERSON_ID,deviceId:'device-owner',applicationId:'windows-desktop',
    deviceTrusted:true,membershipActive:true,roles:['family_admin'],familyIds:[FAMILY_ID],online:true,expiresAt:'2026-08-14T07:00:00.000Z',
    grants:[{id:'inventory-read',subjectAccountId:ACCOUNT_ID,resourceType:'privacy_ownership_center',resourceId:ACCOUNT_ID,
      actions:['read'],effect:'allow',purpose:'administration',startsAt:'2026-08-14T05:00:00.000Z'}]
  })},resourceResolver:{resolve:()=>({type:'privacy_ownership_center',id:ACCOUNT_ID,familyId:FAMILY_ID,ownerPersonId:PERSON_ID,sensitivity:'personal'})},
  receiptSink:{append:()=>undefined},replayStore:{reserve:()=>true},clock:()=>NOW,nonceFactory:()=>`inventory-nonce-${inventoryPolicySequence}`});
  return pep.execute({correlationId,action:'read',capability:'family.read',resourceType:'privacy_ownership_center',resourceId:ACCOUNT_ID,purpose:'administration'},
    ()=>({writable:true,epoch:92}),(policyAuthorization)=>new SqlitePrivacyOwnershipDataRightsRepository().loadCenter({
      transaction:database as unknown as RepositoryTransaction,
      actor:{userId:ACCOUNT_ID,roles:['family_admin'],personId:PERSON_ID},correlationId,occurredAt:asIsoDateTime(NOW),policyAuthorization
    } satisfies PolicyAuthorizedRepositoryExecutionContext,{familyId:FAMILY_ID,accountId:ACCOUNT_ID,ownerPersonId:PERSON_ID}));
};

const receiptJson = (resourceType: string, resourceId: string, action: string, purpose = 'general') => JSON.stringify({
  request: {
    subject: { accountId: ACCOUNT_ID, personId: PERSON_ID },
    resource: { type: resourceType, id: resourceId, familyId: FAMILY_ID, ownerPersonId: PERSON_ID, sensitivity: 'personal' },
    action, capability: 'family.write', purpose
  }
});

const seedReceipt = (database: DatabaseSync, hash: string, resourceType: string, resourceId: string, action: string, purpose = 'general') => {
  const json = receiptJson(resourceType, resourceId, action, purpose);
  database.prepare(`INSERT INTO platform_policy_transaction_receipts VALUES(?,?,?,?,?,?,92,?)`)
    .run(hash, resourceType, resourceId, action, 'family.write', '33-o-write', json);
  database.prepare(`INSERT INTO platform_policy_journal_projection_outbox VALUES(?,?)`).run(hash, json);
};

const rightsRow = (overrides: Partial<DataRightsRequestRow> = {}): DataRightsRequestRow => {
  const key = { familyId: FAMILY_ID, accountId: ACCOUNT_ID, ownerPersonId: PERSON_ID };
  const provisional = {
    id: 'rights-1', key, familyId: FAMILY_ID, accountId: ACCOUNT_ID, ownerPersonId: PERSON_ID,
    revision: 1, kind: 'erasure' as const, scopeResourceType: 'ai_memory', scopeResourceId: 'memory-1',
    status: 'requested' as const, reason: 'Owner requested erasure', encryptedExportRequired: false,
    externalCopiesErasureGuaranteed: false as const, createdAt: asIsoDateTime(NOW), updatedAt: asIsoDateTime(NOW),
    lastMutationId: 'mutation-rights-1', stateFingerprint: ''
  };
  const merged = { ...provisional, ...overrides } as DataRightsRequestRow;
  return { ...merged, stateFingerprint: computePrivacyOwnershipStateFingerprint(merged) };
};

describe('33-O migration 92 and privacy repository policy', () => {
  it('defines the exact durable schema without payload/path/secret columns', () => {
    expect(migration92.name).toBe('privacy_ownership_data_rights_incident_control');
    for (const table of ['governed_ai_memory_records','governed_ai_memory_mutations','privacy_access_observations',
      'privacy_processing_observations','privacy_rights_requests','privacy_rights_request_events','privacy_export_records',
      'policy_incident_cases','policy_incident_events','policy_incident_revocations','policy_incident_quarantine_items']) {
      expect(migration92.sql).toContain(`CREATE TABLE ${table}`);
    }
    expect(migration92.sql).not.toMatch(/artifact_path|file_path|raw_payload|secret_value/u);
    expect(migration92.sql).toContain('plaintext_size_bytes BETWEEN 1 AND 33554432');
    expect(migration92.sql).toContain('size_bytes BETWEEN 1 AND 52428800');
  });

  it('applies migration 92 and publishes immutable/quota/receipt triggers', () => {
    const database = openFixture();
    const names = (database.prepare(`SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_33o_%'`).all() as {name:string}[]).map(({name})=>name);
    expect(names).toContain('trg_33o_ai_mutation_receipt');
    expect(names).toContain('trg_33o_rights_event_parent');
    expect(names).toContain('trg_33o_export_receipt');
    expect(names).toContain('trg_33o_revocation_receipt');
    expect(names).toContain('trg_33o_quarantine_receipt');
    expect(names.length).toBeGreaterThanOrEqual(30);
  });

  it('rejects rights state without an exact durable mutation receipt', () => {
    const database = openFixture();
    expect(() => database.prepare(`INSERT INTO governed_ai_memory_mutations(
      id,client_operation_id,request_fingerprint,state_fingerprint,mutation_kind,resource_type,resource_id,family_id,account_id,owner_person_id,
      previous_revision,revision,policy_receipt_hash,policy_resource_type,policy_resource_id,policy_action,policy_capability,policy_purpose,policy_sensitivity,occurred_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      'mutation-rights-1','operation-rights-1',SHA_A,SHA_B,'rights_request_create','data_rights_request','rights-1',FAMILY_ID,ACCOUNT_ID,PERSON_ID,
      0,1,SHA_A,'data_rights_request','rights-1','create','family.write','administration','personal',NOW
    )).toThrow(/policy receipt|foreign key/i);
  });

  it('binds initial rights current state and event to the same state fingerprint', () => {
    const database = openFixture(); seedReceipt(database,SHA_A,'data_rights_request','rights-1','create','administration');
    const row = rightsRow();
    database.prepare(`INSERT INTO governed_ai_memory_mutations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      row.lastMutationId,'operation-rights-1',SHA_B,row.stateFingerprint,'rights_request_create','data_rights_request',row.id,FAMILY_ID,ACCOUNT_ID,PERSON_ID,
      0,1,SHA_A,'data_rights_request',row.id,'create','family.write','administration','personal',NOW);
    database.prepare(`INSERT INTO privacy_rights_requests VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      row.id,FAMILY_ID,ACCOUNT_ID,PERSON_ID,row.kind,row.scopeResourceType,row.scopeResourceId,null,row.status,row.reason,null,0,0,1,row.stateFingerprint,
      row.lastMutationId,SHA_A,NOW,NOW);
    expect(() => database.prepare(`INSERT INTO privacy_rights_request_events VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
      'event-rights-1',row.id,FAMILY_ID,ACCOUNT_ID,1,SHA_A,'requested',SHA_B,SHA_A,NOW
    )).toThrow(/current parent|receipt/i);
    database.prepare(`INSERT INTO privacy_rights_request_events VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
      'event-rights-1',row.id,FAMILY_ID,ACCOUNT_ID,1,row.stateFingerprint,'requested',SHA_B,SHA_A,NOW);
    expect(() => database.prepare(`UPDATE privacy_rights_request_events SET event_type='rejected' WHERE id='event-rights-1'`).run()).toThrow(/immutable/i);
  });

  it('computes deterministic state fingerprints and detects business-state swaps', () => {
    const first = rightsRow();
    const replay = rightsRow();
    const changed = rightsRow({ reason: 'A different erasure reason' });
    expect(first.stateFingerprint).toBe(replay.stateFingerprint);
    expect(changed.stateFingerprint).not.toBe(first.stateFingerprint);
    expect(first.stateFingerprint).toMatch(/^[0-9a-f]{64}$/u);
    expect(first.stateFingerprint).toBe(createHash('sha256').update(canonicalDataRightsRequestStateJson(first),'utf8').digest('hex'));
  });

  it('keeps capability revocation and quarantine as durable non-delete ledgers', () => {
    expect(migration92.sql).toContain("target_kind IN ('session','trusted_device','capability','offline_lease','consent')");
    expect(migration92.sql).toContain('33-O revocations are immutable');
    expect(migration92.sql).toContain('33-O quarantine items cannot be deleted');
  });

  it('records create-transaction incident controls only against the exact current parent receipt', () => {
    const database=openFixture();seedReceipt(database,SHA_A,'privacy_incident','incident-1','create','administration');
    seedReceipt(database,SHA_C,'privacy_incident','incident-1','create','administration');
    database.prepare(`INSERT INTO governed_ai_memory_mutations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      'mutation-incident-1','operation-incident-1',SHA_C,SHA_B,'incident_create','privacy_incident','incident-1',FAMILY_ID,ACCOUNT_ID,PERSON_ID,
      0,1,SHA_A,'privacy_incident','incident-1','create','family.write','administration','personal',NOW);
    database.prepare(`INSERT INTO policy_incident_cases(id,family_id,account_id,owner_person_id,title,status,severity,suspected_at,actions_json,
      evidence_reference_ids_json,resolution_note,revision,state_fingerprint,last_mutation_id,remote_wipe_performed,mdm_operation_performed,
      network_delivery_guaranteed,policy_receipt_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,0,?,?,?)`).run(
      'incident-1',FAMILY_ID,ACCOUNT_ID,PERSON_ID,'Local compromise','open','high',NOW,
      '[{"action":"revoke_capability","targetId":"family.write"}]','[]',null,1,SHA_B,'mutation-incident-1',SHA_A,NOW,NOW);
    expect(()=>database.prepare(`INSERT INTO policy_incident_revocations VALUES(?,?,?,?,?,?,?,?,?)`).run(
      'revocation-forged','incident-1',FAMILY_ID,ACCOUNT_ID,'capability',SHA_B,'revoked',SHA_C,NOW)).toThrow(/exact parent|receipt/i);
    database.prepare(`INSERT INTO policy_incident_revocations VALUES(?,?,?,?,?,?,?,?,?)`).run(
      'revocation-1','incident-1',FAMILY_ID,ACCOUNT_ID,'capability',SHA_B,'revoked',SHA_A,NOW);
    database.prepare(`INSERT INTO policy_incident_quarantine_items VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      'quarantine-1','incident-1',FAMILY_ID,ACCOUNT_ID,'capability_state',SHA_B,SHA_C,'quarantined',1,SHA_A,NOW,null);
    expect(()=>database.prepare(`UPDATE policy_incident_quarantine_items SET status='destroyed',resolved_at=? WHERE id='quarantine-1'`).run(NOW)).toThrow(/immutable/i);
  });

  it('binds AI memory writes to family.write receipts and validates structured incident intents', () => {
    expect(migration92.sql).toContain("NEW.policy_action=CASE WHEN NEW.previous_revision=0 THEN 'create'");
    expect(migration92.sql).toContain("NEW.policy_capability='family.write'");
    expect(migration92.sql).toContain('NEW.policy_resource_type=NEW.resource_type');
    expect(migration92.sql).toContain("WHEN NEW.resource_type='ai_memory_record' THEN 'ai_processing' ELSE 'administration'");
    expect(migration92.sql).toContain("receipt.action='process' AND receipt.capability=CASE NEW.processor_kind WHEN 'ai' THEN 'ai.process'");
    expect(migration92.sql).toContain("property.key NOT IN ('action','targetId')");
    expect(migration92.sql).toContain("'revoke_capability','quarantine_local_derived_data'");
  });

  it('projects field-minimized immutable receipts into access history and deduplicates local observations', () => {
    const source=readFileSync(new URL('./src/privacy-ownership-data-rights-repository.ts',import.meta.url),'utf8');
    expect(source).toContain("json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=?");
    expect(source).toContain("json_extract(receipt.record_json,'$.decision.allowed')=1");
    expect(source).toContain('observedReceiptHashes');
    expect(source).toContain("decisionReason:'policy_allowed'");
    expect(source).not.toContain('receipt.record_json,observer');
  });

  it('builds bounded content-free inventory across owner lifecycle, legacy, AI, rights, incidents, devices and sealed lineage', () => {
    const source=readFileSync(new URL('./src/privacy-ownership-data-rights-repository.ts',import.meta.url),'utf8');
    for(const marker of ['inventory/rights/','inventory/incident/','inventory/device/','inventory/derived/',
      'inventory/lifecycle/','inventory/legacy/plan/'])expect(source).toContain(marker);
    expect(source).toContain("if(inventory.length>MAX_INVENTORY)throw new Error('Privacy inventory category bound exceeded')");
    expect(source).toContain('displayName:`ai_memory:${String(row.state)}`');
    expect(source).not.toContain('displayName: String(row.title)');
    expect(source).toContain("currentDevice: !row.revoked_at && String(row.device_id)===context.policyAuthorization.subject.deviceId");
    expect(source).toContain("b.status='sealed'");
    expect(source.match(/json_extract\(receipt\.record_json,'\$\.request\.resource\.ownerPersonId'\)=\?/gu)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain("lifecycle.owner_person_id=? AND lifecycle.state<>'purged'");
    expect(source).toContain('WHERE plan.owner_person_id=? AND owner.family_id=?');
    expect(source).not.toContain('displayName:`legacy_plan:${String(row.title)}');
    for(const type of ['account_profile','person_profile','location','event','archive_item','bank_account','payment_card',
      'loan_account','finance_planning_item','finance_import_batch','finance_import_entry','managed_life_item',
      'home_inventory_item','long_term_portfolio','form_draft','accessibility_preferences'])expect(source).toContain(`'${type}'`);
    expect(source).toContain('JOIN platform_policy_transaction_receipts receipt ON receipt.receipt_hash=item.policy_receipt_hash');
    expect(source).not.toContain('archive_items WHERE family_id=? AND owner_person_id=?');
  });

  it('executes aggregate inventory against the actual migrations and isolates every owner sentinel', async () => {
    const database = openActualInventoryFixture();
    seedInventoryCollections(database);

    const result = await loadActualInventory(database);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expectedCollectionTypes = [
      'account_profile','person_profile','location','event','archive_item','bank_account','payment_card','loan_account',
      'finance_planning_item','finance_import_batch','finance_import_entry','managed_life_item','home_inventory_item',
      'long_term_portfolio','form_draft','accessibility_preferences'
    ] as const;
    for (const resourceType of expectedCollectionTypes) {
      const item = result.value.dataInventory.find(({ id }) => id === `inventory/collection/${resourceType}`);
      expect(item, resourceType).toMatchObject({ resourceType, recordCount: 1, derivedDataCount: 0 });
    }

    expect(result.value.dataInventory.find(({ id }) => id === 'inventory/legacy/plan/active')).toMatchObject({
      resourceType: 'digital_legacy_plan', recordCount: 1
    });
    expect(result.value.dataInventory.find(({ id }) => id === 'inventory/lifecycle/finance_record/active/private')).toMatchObject({
      resourceType: 'finance_record', recordCount: 1
    });
    expect(result.value.dataInventory.find(({ id }) => id === 'inventory/derived/OCR_TEXT/ocr_text')).toMatchObject({
      resourceType: 'ocr_text', recordCount: 1, derivedDataCount: 1
    });
    expect(result.value.derivedDataLineage).toHaveLength(1);
    expect(result.value.derivedDataLineage[0]).toMatchObject({
      derivedResourceId: 'derived-owner', sourceResourceType: 'archive_item', sourceResourceId: 'archive-owner', payloadExposed: false
    });
    expect(JSON.stringify(result.value.dataInventory)).not.toContain('foreign');
    expect(JSON.stringify(result.value.derivedDataLineage)).not.toContain('foreign');
  });

  it('fails closed instead of silently truncating an oversized category inventory', async () => {
    const database = openActualInventoryFixture();
    for (let index = 0; index <= 1_000; index += 1) {
      insertActualRow(database, 'data_lifecycle', `overflow-${index}`, {
        resource_type: `sentinel_${index}`, resource_id: `resource_${index}`, owner_person_id: PERSON_ID,
        privacy: 'private', state: 'active'
      });
    }

    const result = await loadActualInventory(database);
    expect(result.ok).toBe(false);
  });

  it('carries and verifies the exact immutable AI derived binding instead of selecting a latest binding', () => {
    const source=readFileSync(new URL('./src/privacy-ownership-data-rights-repository.ts',import.meta.url),'utf8');
    expect(source).toContain('derivedBindingHash: String(row.derived_binding_hash)');
    expect(source).toContain('WHERE binding.binding_hash=? AND binding.family_id=?');
    expect(source).toContain('.get(row.derivedBindingHash, row.familyId, row.id, row.accountId, row.ownerPersonId, row.familyId, row.ownerPersonId)');
    expect(source).toContain('EXISTS(SELECT 1 FROM derived_data_policy_sources source WHERE source.binding_hash=binding.binding_hash)');
    expect(source).not.toContain("status='sealed' ORDER BY sealed_at DESC LIMIT 1");
  });

  it('exposes durable export, revocation and quarantine writes through the repository port', () => {
    const contract=readFileSync(new URL('../repository-contracts/src/privacy-ownership-data-rights-repository.ts',import.meta.url),'utf8');
    const source=readFileSync(new URL('./src/privacy-ownership-data-rights-repository.ts',import.meta.url),'utf8');
    for(const method of ['recordIncidentRevocation','quarantineIncidentItem','recordEncryptedExport']){
      expect(contract).toContain(`${method}(`);expect(source).toContain(`public ${method}(`);
    }
    expect(source).toContain("policyScope(context,row.key,'privacy_incident',row.incidentId,['create','update'])");
    expect(source).toContain("policyScope(context,row.key,'data_rights_request',row.requestId,['update'])");
    expect(migration92.sql).toContain("'rights_export_finalize'");
    expect(migration92.sql).toContain("m.mutation_kind=CASE WHEN NEW.status='locally_completed' THEN 'rights_export_finalize'");
    expect(source).toContain('canonicalEncryptedPrivacyExportStateJson(mapped)');
  });

  it('finalizes export only after the exact rights mutation and rolls the parent back on a forged export receipt', () => {
    const database=openFixture();
    const prepare=(id:string,createReceipt:string,updateReceipt:string)=>{
      seedReceipt(database,createReceipt,'data_rights_request',id,'create','administration');
      seedReceipt(database,updateReceipt,'data_rights_request',id,'update','administration');
      const initial=rightsRow({id,lastMutationId:`mutation-${id}-1`,kind:'encrypted_export',encryptedExportRequired:true});
      database.prepare(`INSERT INTO governed_ai_memory_mutations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        initial.lastMutationId,`operation-${id}-1`,SHA_B,initial.stateFingerprint,'rights_request_create','data_rights_request',id,FAMILY_ID,ACCOUNT_ID,PERSON_ID,
        0,1,createReceipt,'data_rights_request',id,'create','family.write','administration','personal',NOW);
      database.prepare(`INSERT INTO privacy_rights_requests VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id,FAMILY_ID,ACCOUNT_ID,PERSON_ID,'encrypted_export','all','all',null,'requested','Encrypted export',null,1,0,1,initial.stateFingerprint,
        initial.lastMutationId,createReceipt,NOW,NOW);
      const next=rightsRow({...initial,revision:2,status:'locally_completed',resolutionNote:'Local readback verified',updatedAt:NOW,lastMutationId:`mutation-${id}-2`});
      database.prepare(`INSERT INTO governed_ai_memory_mutations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        next.lastMutationId,`operation-${id}-2`,'d'.repeat(64),next.stateFingerprint,'rights_export_finalize','data_rights_request',id,FAMILY_ID,ACCOUNT_ID,PERSON_ID,
        1,2,updateReceipt,'data_rights_request',id,'update','family.write','administration','personal',NOW);
      return next;
    };
    const finalize=(id:string,next:DataRightsRequestRow,receipt:string,artifact:string,exportReceipt=receipt)=>{
      database.prepare(`UPDATE privacy_rights_requests SET status=?,resolution_note=?,revision=?,state_fingerprint=?,last_mutation_id=?,policy_receipt_hash=?,updated_at=? WHERE id=? AND revision=1`)
        .run(next.status,next.resolutionNote??null,2,next.stateFingerprint,next.lastMutationId,receipt,NOW,id);
      const view={id:`export-${id}`,key:{familyId:FAMILY_ID,accountId:ACCOUNT_ID,ownerPersonId:PERSON_ID},requestId:id,requestKind:'encrypted_export' as const,requestRevision:2,artifactSha256:artifact,
        envelopeSha256:'8'.repeat(64),lineageSha256:'9'.repeat(64),itemCount:1,plaintextSizeBytes:128,sizeBytes:256,
        readbackVerified:true as const,encrypted:true as const,localUserSelected:true as const,networkDeliveryGuaranteed:false as const,
        recipientReadGuaranteed:false as const,localArtifactPathExposed:false as const,passphraseExposed:false as const,createdAt:NOW};
      const state=createHash('sha256').update(canonicalEncryptedPrivacyExportStateJson(view),'utf8').digest('hex');
      database.prepare(`INSERT INTO privacy_export_records VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        view.id,id,FAMILY_ID,ACCOUNT_ID,PERSON_ID,2,view.artifactSha256,view.envelopeSha256,view.lineageSha256,'AES-256-GCM',1,128,256,1,0,0,state,exportReceipt,NOW);
    };
    const success=prepare('rights-export-ok','1'.repeat(64),'2'.repeat(64));
    database.exec('BEGIN');finalize('rights-export-ok',success,'2'.repeat(64),'7'.repeat(64));database.exec('COMMIT');
    expect(database.prepare(`SELECT COUNT(*) value FROM privacy_export_records WHERE rights_request_id='rights-export-ok'`).get()).toEqual({value:1});

    const rollback=prepare('rights-export-rollback','3'.repeat(64),'4'.repeat(64));
    seedReceipt(database,'5'.repeat(64),'data_rights_request','rights-export-rollback','update','administration');
    database.exec('BEGIN');
    expect(()=>finalize('rights-export-rollback',rollback,'4'.repeat(64),'6'.repeat(64),'5'.repeat(64))).toThrow(/exact completed|receipt/i);
    database.exec('ROLLBACK');
    expect(database.prepare(`SELECT revision,status FROM privacy_rights_requests WHERE id='rights-export-rollback'`).get()).toEqual({revision:1,status:'requested'});
    expect(database.prepare(`SELECT COUNT(*) value FROM privacy_export_records WHERE rights_request_id='rights-export-rollback'`).get()).toEqual({value:0});
  });
});
