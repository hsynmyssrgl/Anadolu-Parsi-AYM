import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId, asUserId } from '@ppt/core';
import type { RepositoryTransaction } from '@ppt/contracts';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  type PlatformPolicyIntent,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import type {
  FamilyEmergencyAssistanceLedgerItemRow,
  FamilyEmergencyAssistanceProfileLedgerItemRow,
  FamilyEmergencyCardPortabilityLedgerItemRow,
  FamilyEmergencyLedgerItemRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteLifeRepository } from './src/life-repository.js';
import { computePlatformPolicyReceiptHash } from './src/platform-policy-transaction-repository.js';

const PLAN_AT = '2026-08-13T14:00:00.000Z';
const FAMILY_ID = asFamilyId('family-portability');
const OTHER_FAMILY_ID = asFamilyId('family-portability-other');
const OWNER_ID = asPersonId('person-portability-owner');
const OTHER_OWNER_ID = asPersonId('person-portability-other');
const ACCOUNT_ID = asUserId('account-portability-owner');
const databases:DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

const migrations = [83,84,85,86,87,88].map((version) =>
  FAMILY_DATABASE_MIGRATIONS.find((migration) => migration.version === version));
if (migrations.some((migration) => !migration)) throw new Error('MIGRATION_83_88_NOT_FOUND');
const migration88 = migrations[5]!;

const fixtureSchema = `
  PRAGMA foreign_keys=ON;
  CREATE TABLE families(id TEXT PRIMARY KEY);
  CREATE TABLE people(id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id),status TEXT NOT NULL);
  CREATE TABLE accounts(id TEXT PRIMARY KEY,person_id TEXT REFERENCES people(id),status TEXT NOT NULL);
  CREATE TABLE database_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
  CREATE TABLE platform_policy_database_fences(
    fence_name TEXT PRIMARY KEY,epoch INTEGER NOT NULL,writable INTEGER NOT NULL
  );
  CREATE TABLE platform_policy_transaction_receipts(
    receipt_hash TEXT PRIMARY KEY,receipt_version INTEGER NOT NULL,nonce TEXT NOT NULL,
    correlation_id TEXT NOT NULL UNIQUE,resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,
    action TEXT NOT NULL,capability TEXT NOT NULL,fence_name TEXT NOT NULL,
    fence_epoch INTEGER NOT NULL,record_json TEXT NOT NULL
  );
  CREATE TABLE platform_policy_journal_projection_outbox(
    receipt_hash TEXT PRIMARY KEY,record_json TEXT NOT NULL
  );
  CREATE TABLE data_lifecycle(
    resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,owner_person_id TEXT,
    privacy TEXT,state TEXT NOT NULL,updated_at TEXT NOT NULL,
    PRIMARY KEY(resource_type,resource_id)
  );
  CREATE TABLE object_permissions(
    id TEXT PRIMARY KEY,subject_account_id TEXT NOT NULL,resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,actions TEXT NOT NULL,effect TEXT NOT NULL,
    purpose TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT
  );
  CREATE TABLE life_records(
    id TEXT PRIMARY KEY,family_id TEXT NOT NULL,owner_person_id TEXT NOT NULL,
    category TEXT NOT NULL,title TEXT NOT NULL,status TEXT NOT NULL,privacy TEXT NOT NULL,
    starts_at TEXT,due_at TEXT,provider TEXT,reference_no TEXT,amount REAL,currency TEXT,
    location TEXT,notes TEXT,created_at TEXT NOT NULL,policy_receipt_hash TEXT,
    policy_receipt_version INTEGER,policy_receipt_nonce TEXT,policy_correlation_id TEXT,
    policy_resource_type TEXT,policy_resource_id TEXT,policy_action TEXT,policy_capability TEXT
  );
  CREATE TABLE archive_items(
    id TEXT PRIMARY KEY,family_id TEXT NOT NULL,destroyed_at TEXT,sensitivity TEXT NOT NULL,
    created_at TEXT NOT NULL,policy_receipt_hash TEXT
  );
  CREATE TABLE archive_versions(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE archive_retention_policies(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE archive_categories(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE archive_tags(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE archive_item_tags(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE events(id TEXT PRIMARY KEY,policy_receipt_hash TEXT,timeline_policy_receipt_hash TEXT);
  CREATE TABLE finance_records(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE finance_valuations(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE health_records(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE medication_plans(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE family_health_history(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE locations(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE bank_accounts(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE payment_cards(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE loan_accounts(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE loan_payment_history(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE finance_planning_ledger(
    id TEXT PRIMARY KEY,item_type TEXT NOT NULL,asset_class TEXT,category_kind TEXT,
    family_id TEXT NOT NULL,owner_person_id TEXT NOT NULL,privacy TEXT NOT NULL,
    amount REAL,currency TEXT,occurred_at TEXT,created_at TEXT NOT NULL,policy_receipt_hash TEXT
  );
  CREATE TABLE finance_import_batches(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  INSERT INTO families VALUES('${FAMILY_ID}'),('${OTHER_FAMILY_ID}');
  INSERT INTO people VALUES('${OWNER_ID}','${FAMILY_ID}','active');
  INSERT INTO people VALUES('${OTHER_OWNER_ID}','${OTHER_FAMILY_ID}','active');
  INSERT INTO accounts VALUES('${ACCOUNT_ID}','${OWNER_ID}','active');
  INSERT INTO database_metadata VALUES('schema_generation','before-33-j','${PLAN_AT}');
  INSERT INTO platform_policy_database_fences VALUES('portability-write',88,1);
`;

const openDatabase = ():DatabaseSync => {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  database.exec(fixtureSchema);
  for (const migration of migrations) database.exec(migration!.sql);
  return database;
};

const kernel = new PlatformPolicyKernel({
  policyVersion:'33-j-portability-repository-test-v1',
  signingKey:Buffer.from('33-j-portability-controlled-test-key','utf8'),
  applicationCapabilities:{ 'windows-desktop':['family.read','family.write','file.share'] },
  consentRequiredCapabilities:[],onlineOnlyCapabilities:[],
  writeActions:['create','update','delete','record']
});

let nonceSequence = 0;
const persistReceipt = (database:DatabaseSync, record:PlatformPolicyReceiptRecord):void => {
  const receiptHash = computePlatformPolicyReceiptHash(record.receipt);
  database.prepare(`
    INSERT INTO platform_policy_transaction_receipts(
      receipt_hash,receipt_version,nonce,correlation_id,resource_type,resource_id,
      action,capability,fence_name,fence_epoch,record_json
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    receiptHash,record.receipt.receiptVersion,record.receipt.nonce,record.correlationId,
    record.resourceType,record.resourceId,record.action,record.capability,
    'portability-write',88,JSON.stringify(record)
  );
  database.prepare(
    'INSERT INTO platform_policy_journal_projection_outbox(receipt_hash,record_json) VALUES(?,?)'
  ).run(receiptHash,JSON.stringify(record));
};

interface PolicyOptions {
  readonly clockAt?:string;
  readonly correlationId?:string;
  readonly ownerPersonId?:string;
  readonly resourceFamilyId?:string;
  readonly sensitivity?:'personal'|'highly_sensitive';
}

const executePolicy = async <T>(
  database:DatabaseSync,
  intent:Pick<PlatformPolicyIntent,'resourceId'|'action'|'capability'> & {
    readonly purpose?:'general'|'emergency-offline-portability';
    readonly requestedFields?:readonly string[];
  },
  operation:(repository:SqliteLifeRepository,context:PolicyAuthorizedRepositoryExecutionContext) => RepositoryResult<T>,
  options:PolicyOptions = {}
):Promise<RepositoryResult<T>> => {
  const sequence = ++nonceSequence;
  const correlationId = asCorrelationId(options.correlationId ?? `portability-${sequence}`);
  const clockAt = options.clockAt ?? PLAN_AT;
  const ownerPersonId = asPersonId(options.ownerPersonId ?? String(OWNER_ID));
  const familyId = asFamilyId(options.resourceFamilyId ?? String(FAMILY_ID));
  const pep = new PlatformPolicyEnforcementPoint({
    kernel,
    authorityResolver:{ resolve:() => ({
      policyVersion:'33-j-portability-repository-test-v1',accountId:ACCOUNT_ID,
      personId:OWNER_ID,deviceId:'device-portability',applicationId:'windows-desktop',
      deviceTrusted:true,membershipActive:true,roles:['family_admin'],familyIds:[FAMILY_ID],
      grants:[{ id:`grant-${correlationId}`,subjectAccountId:ACCOUNT_ID,
        resourceType:'life_record',resourceId:intent.resourceId,actions:[intent.action],
        effect:'allow',startsAt:'2026-08-13T00:00:00.000Z' }],
      online:true,expiresAt:'2026-08-13T20:00:00.000Z'
    }) },
    resourceResolver:{ resolve:() => ({
      type:'life_record',id:intent.resourceId,familyId,ownerPersonId,
      sensitivity:options.sensitivity ?? 'highly_sensitive',
      ...(intent.action === 'share' ? {
        dataClasses:['personal','special','health'] as const,
        classificationSource:'declared' as const
      } : {})
    }) },
    receiptSink:{ append:(record) => persistReceipt(database,record) },
    replayStore:{ reserve:() => true },clock:() => clockAt,
    nonceFactory:() => `nonce-portability-${sequence}`
  });
  return pep.execute({ correlationId,action:intent.action,capability:intent.capability,
    resourceType:'life_record',resourceId:intent.resourceId,purpose:intent.purpose ?? 'general',
    ...(intent.requestedFields ? {requestedFields:intent.requestedFields} : {}) },
  () => ({ writable:true,epoch:88 }),(policyAuthorization) => operation(
    new SqliteLifeRepository(),{
      transaction:database as unknown as RepositoryTransaction,
      actor:{ userId:ACCOUNT_ID,roles:['family_admin'],personId:OWNER_ID },
      correlationId,occurredAt:asIsoDateTime(clockAt),policyAuthorization
    }
  ));
};

const plan = ():FamilyEmergencyLedgerItemRow => ({
  id:'emergency-plan',familyId:FAMILY_ID,ownerPersonId:OWNER_ID,itemType:'emergency_plan',
  planKind:'general',title:'Aile acil durum planı',
  evacuationInstructions:'Planı izleyin ve güvenli buluşma noktasına gidin.',
  privacy:'family',dataSource:'manual',createdAt:asIsoDateTime(PLAN_AT)
});
const profile = ():FamilyEmergencyAssistanceProfileLedgerItemRow => ({
  id:'assistance-profile',planId:'emergency-plan',familyId:FAMILY_ID,ownerPersonId:OWNER_ID,
  itemType:'emergency_profile',subjectKind:'person',subjectPersonId:OWNER_ID,
  label:'Acil sağlık kartım',privacy:'private',dataSource:'manual',
  createdAt:asIsoDateTime('2026-08-13T14:01:00.000Z')
});

const seedRoot = async (database:DatabaseSync):Promise<void> => {
  expect(await executePolicy(database,{resourceId:'emergency-plan',action:'create',capability:'family.write'},
    (repository,context) => repository.insertFamilyEmergencyItem(context,plan()),
    { clockAt:PLAN_AT,sensitivity:'personal' })).toEqual({ ok:true,value:undefined });
  expect(await executePolicy(database,{resourceId:'assistance-profile',action:'create',capability:'family.write'},
    (repository,context) => repository.insertFamilyEmergencyAssistanceItem(context,profile()),
    { clockAt:'2026-08-13T14:01:00.000Z' })).toEqual({ ok:true,value:undefined });
};

const childCommon = {
  planId:'emergency-plan',profileId:'assistance-profile',familyId:FAMILY_ID,
  ownerPersonId:OWNER_ID,privacy:'private' as const,dataSource:'manual' as const
};

const insertAssistanceChild = (
  database:DatabaseSync,
  row:Exclude<FamilyEmergencyAssistanceLedgerItemRow,FamilyEmergencyAssistanceProfileLedgerItemRow>
):Promise<RepositoryResult<void>> => executePolicy(
  database,{resourceId:row.profileId,action:'update',capability:'family.write'},
  (repository,context) => repository.insertFamilyEmergencyAssistanceItem(context,row),
  { clockAt:row.createdAt }
);

const insertPortability = (
  database:DatabaseSync,
  row:FamilyEmergencyCardPortabilityLedgerItemRow,
  options:PolicyOptions = {}
):Promise<RepositoryResult<void>> => executePolicy(
  database,{resourceId:row.profileId,action:'update',capability:'family.write'},
  (repository,context) => repository.insertFamilyEmergencyCardPortabilityItem(context,row),
  { clockAt:row.createdAt,...options }
);

const portabilityCommon = {
  profileId:'assistance-profile',familyId:FAMILY_ID,ownerPersonId:OWNER_ID,
  privacy:'private' as const,dataSource:'manual' as const
};
const configuration = ():FamilyEmergencyCardPortabilityLedgerItemRow => ({
  ...portabilityCommon,id:'card-config',itemType:'card_configuration',
  label:'Çevrimdışı acil kartım',locale:'tr-TR',
  createdAt:asIsoDateTime('2026-08-13T14:02:00.000Z')
});

const authorizeExportSelection = (
  database:DatabaseSync,
  input:{
    readonly correlationId:string;
    readonly selectionSha256:string;
    readonly clockAt:string;
    readonly sourceItemId?:string;
  }
):Promise<{
  readonly result:RepositoryResult<readonly FamilyEmergencyCardPortabilityLedgerItemRow[]>;
  readonly receiptHash:string;
}> => (async () => {
  const result = await executePolicy(database,{
    resourceId:'assistance-profile',action:'share',capability:'file.share',
    purpose:'emergency-offline-portability',
    requestedFields:['phone_e164',`selection_sha256:${input.selectionSha256}`].sort()
  },(repository,context) => {
    expect(repository.findFamilyEmergencyAssistanceProfile(context,'assistance-profile'))
      .toMatchObject({ok:true,value:{id:'assistance-profile'}});
    if (input.sourceItemId) {
      expect(repository.findFamilyEmergencyAssistanceItem(context,input.sourceItemId))
        .toMatchObject({ok:true,value:{id:input.sourceItemId}});
    }
    return repository.listFamilyEmergencyCardPortabilityItems(context,'assistance-profile');
  },{
      correlationId:input.correlationId,
      clockAt:input.clockAt
    }
  );
  const receipt = database.prepare(
    "SELECT receipt_hash FROM platform_policy_transaction_receipts WHERE correlation_id=? AND action='share'"
  ).get(input.correlationId) as {receipt_hash:string};
  return { result,receiptHash:receipt.receipt_hash };
})();

describe('33-J emergency card portability migration and repository policy', () => {
  it('persists exact private configuration, selected field, document, power and metadata-only export history', async () => {
    const database = openDatabase();
    expect(migration88.name).toBe('b5_family_emergency_card_portability_ledger');
    const portabilityColumns = database.prepare(
      "PRAGMA table_info('family_emergency_card_portability_ledger')"
    ).all() as Array<{name:string}>;
    expect(portabilityColumns.map(({name}) => name)).toEqual(expect.arrayContaining([
        'profile_id','configuration_id','source_item_id','field_code','archive_item_id',
        'selection_sha256','artifact_readback_status','printer_dispatch_status',
        'low_battery_claimed','policy_receipt_hash'
      ]));
    await seedRoot(database);
    expect(await insertAssistanceChild(database,{
      ...childCommon,id:'contact-source',itemType:'emergency_contact',name:'Yakın kişi',
      phoneE164:'+905551112233',relationship:'Kardeş',
      createdAt:asIsoDateTime('2026-08-13T14:02:00.000Z')
    })).toEqual({ok:true,value:undefined});
    database.prepare(`INSERT INTO archive_items(
      id,family_id,destroyed_at,sensitivity,created_at,policy_receipt_hash
    ) VALUES('archive-high',?,NULL,'high','2026-08-13T14:01:00.000Z',NULL)`).run(FAMILY_ID);
    expect(await insertPortability(database,configuration())).toEqual({ok:true,value:undefined});
    expect(await insertPortability(database,{
      ...portabilityCommon,id:'field-phone',itemType:'selected_field',configurationId:'card-config',
      sourceItemId:'contact-source',sourceItemType:'emergency_contact',fieldCode:'phone_e164',
      createdAt:asIsoDateTime('2026-08-13T14:03:00.000Z')
    })).toEqual({ok:true,value:undefined});
    expect(await insertPortability(database,{
      ...portabilityCommon,id:'field-name',itemType:'selected_field',configurationId:'card-config',
      sourceItemId:'contact-source',sourceItemType:'emergency_contact',fieldCode:'name',
      createdAt:asIsoDateTime('2026-08-13T14:03:00.000Z')
    })).toEqual({ok:true,value:undefined});
    expect(await insertPortability(database,{
      ...portabilityCommon,id:'doc-high',itemType:'document_link',configurationId:'card-config',
      archiveItemId:'archive-high',createdAt:asIsoDateTime('2026-08-13T14:04:00.000Z')
    })).toEqual({ok:true,value:undefined});
    expect(await insertPortability(database,{
      ...portabilityCommon,id:'power-enabled',itemType:'power_mode_event',configurationId:'card-config',
      mode:'enabled',activationSource:'battery_prompt',powerSource:'battery',
      batteryLevel:'not_measured',automaticLowBatteryDetection:'not_performed',lowBatteryClaimed:false,
      createdAt:asIsoDateTime('2026-08-13T14:05:00.000Z')
    })).toEqual({ok:true,value:undefined});
    database.prepare(
      "UPDATE archive_items SET destroyed_at='2026-08-13T14:05:15.000Z' WHERE id='archive-high'"
    ).run();
    const withoutShare = await insertPortability(database,{
      ...portabilityCommon,id:'export-without-share',itemType:'export_event',configurationId:'card-config',
      mode:'pdf',selectedFieldCount:1,documentCount:0,selectionSha256:'c'.repeat(64),
      shareReceiptHash:'c'.repeat(64),
      artifactSha256:'a'.repeat(64),artifactSizeBytes:4096,artifactReadbackStatus:'verified',
      powerSource:'unknown',batteryLevel:'not_measured',automaticLowBatteryDetection:'not_performed',
      lowBatteryClaimed:false,createdAt:asIsoDateTime('2026-08-13T14:05:20.000Z')
    },{correlationId:'portability-export-without-share'});
    expect(withoutShare.ok).toBe(false);
    const exportCorrelationId = 'portability-export-print';
    const exportAuthorization = await authorizeExportSelection(database,{
      correlationId:exportCorrelationId,selectionSha256:'d'.repeat(64),
      clockAt:'2026-08-13T14:05:30.000Z',sourceItemId:'contact-source'
    });
    expect(exportAuthorization.result).toMatchObject({ok:true});
    await expect(insertPortability(database,{
      ...portabilityCommon,id:'export-same-correlation',itemType:'export_event',
      configurationId:'card-config',mode:'print',selectedFieldCount:1,documentCount:0,
      selectionSha256:'d'.repeat(64),shareReceiptHash:exportAuthorization.receiptHash,
      artifactSha256:'a'.repeat(64),artifactSizeBytes:4096,
      artifactReadbackStatus:'not_applicable_print',printerDispatchStatus:'confirmed',
      powerSource:'battery',batteryLevel:'not_measured',automaticLowBatteryDetection:'not_performed',
      lowBatteryClaimed:false,createdAt:asIsoDateTime('2026-08-13T14:05:45.000Z')
    },{correlationId:exportCorrelationId})).rejects.toThrow(
      /Policy receipt could not be persisted before transaction execution/iu
    );
    expect(await insertPortability(database,{
      ...portabilityCommon,id:'export-print',itemType:'export_event',configurationId:'card-config',
      mode:'print',selectedFieldCount:1,documentCount:0,artifactSha256:'a'.repeat(64),
      selectionSha256:'d'.repeat(64),shareReceiptHash:exportAuthorization.receiptHash,
      artifactSizeBytes:4096,artifactReadbackStatus:'not_applicable_print',
      printerDispatchStatus:'confirmed',powerSource:'battery',batteryLevel:'not_measured',
      automaticLowBatteryDetection:'not_performed',lowBatteryClaimed:false,
      createdAt:asIsoDateTime('2026-08-13T14:06:00.000Z')
    },{correlationId:'portability-export-print-completion'})).toEqual({ok:true,value:undefined});
    const crossSelectionCorrelationId = 'portability-export-cross-selection';
    const crossSelectionAuthorization = await authorizeExportSelection(database,{
      correlationId:crossSelectionCorrelationId,selectionSha256:'f'.repeat(64),
      clockAt:'2026-08-13T14:06:10.000Z'
    });
    expect(crossSelectionAuthorization.result).toMatchObject({ok:true});
    expect((await insertPortability(database,{
      ...portabilityCommon,id:'export-cross-selection',itemType:'export_event',configurationId:'card-config',
      mode:'pdf',selectedFieldCount:1,documentCount:0,selectionSha256:'e'.repeat(64),
      shareReceiptHash:crossSelectionAuthorization.receiptHash,
      artifactSha256:'b'.repeat(64),artifactSizeBytes:4096,artifactReadbackStatus:'verified',
      powerSource:'unknown',batteryLevel:'not_measured',automaticLowBatteryDetection:'not_performed',
      lowBatteryClaimed:false,createdAt:asIsoDateTime('2026-08-13T14:06:20.000Z')
    },{correlationId:'portability-export-cross-selection-completion'})).ok).toBe(false);
    const boundaryShareAuthorization = await authorizeExportSelection(database,{
      correlationId:'portability-export-boundary-share',selectionSha256:'8'.repeat(64),
      clockAt:'2026-08-13T14:06:21.000Z'
    });
    expect(boundaryShareAuthorization.result).toMatchObject({ok:true});
    expect(await insertPortability(database,{
      ...portabilityCommon,id:'export-boundary-share',itemType:'export_event',
      configurationId:'card-config',mode:'pdf',selectedFieldCount:1,documentCount:0,
      selectionSha256:'8'.repeat(64),shareReceiptHash:boundaryShareAuthorization.receiptHash,
      artifactSha256:'8'.repeat(64),artifactSizeBytes:4096,artifactReadbackStatus:'verified',
      powerSource:'unknown',batteryLevel:'not_measured',automaticLowBatteryDetection:'not_performed',
      lowBatteryClaimed:false,createdAt:asIsoDateTime('2026-08-13T14:11:21.000Z')
    },{correlationId:'portability-export-boundary-share-completion'})).toEqual({ok:true,value:undefined});
    const staleShareAuthorization = await authorizeExportSelection(database,{
      correlationId:'portability-export-stale-share',selectionSha256:'9'.repeat(64),
      clockAt:'2026-08-13T14:06:22.000Z'
    });
    expect(staleShareAuthorization.result).toMatchObject({ok:true});
    expect((await insertPortability(database,{
      ...portabilityCommon,id:'export-stale-share',itemType:'export_event',
      configurationId:'card-config',mode:'pdf',selectedFieldCount:1,documentCount:0,
      selectionSha256:'9'.repeat(64),shareReceiptHash:staleShareAuthorization.receiptHash,
      artifactSha256:'9'.repeat(64),artifactSizeBytes:4096,artifactReadbackStatus:'verified',
      powerSource:'unknown',batteryLevel:'not_measured',automaticLowBatteryDetection:'not_performed',
      lowBatteryClaimed:false,createdAt:asIsoDateTime('2026-08-13T14:11:22.001Z')
    },{correlationId:'portability-export-stale-share-completion'})).ok).toBe(false);
    const plaintextDocumentCorrelationId = 'portability-export-plaintext-document';
    const plaintextDocumentAuthorization = await authorizeExportSelection(database,{
      correlationId:plaintextDocumentCorrelationId,selectionSha256:'b'.repeat(64),
      clockAt:'2026-08-13T14:06:21.000Z'
    });
    expect(plaintextDocumentAuthorization.result).toMatchObject({ok:true});
    expect((await insertPortability(database,{
      ...portabilityCommon,id:'export-plaintext-document',itemType:'export_event',
      configurationId:'card-config',mode:'pdf',selectedFieldCount:1,documentCount:1,
      selectionSha256:'b'.repeat(64),shareReceiptHash:plaintextDocumentAuthorization.receiptHash,
      artifactSha256:'b'.repeat(64),artifactSizeBytes:4096,
      artifactReadbackStatus:'verified',powerSource:'unknown',batteryLevel:'not_measured',
      automaticLowBatteryDetection:'not_performed',lowBatteryClaimed:false,
      createdAt:asIsoDateTime('2026-08-13T14:06:22.000Z')
    },{correlationId:'portability-export-plaintext-document-completion'})).ok).toBe(false);
    expect((await insertPortability(database,{
      ...portabilityCommon,id:'export-correlation-replay',itemType:'export_event',configurationId:'card-config',
      mode:'pdf',selectedFieldCount:1,documentCount:0,selectionSha256:'d'.repeat(64),
      shareReceiptHash:exportAuthorization.receiptHash,
      artifactSha256:'c'.repeat(64),artifactSizeBytes:4096,artifactReadbackStatus:'verified',
      powerSource:'unknown',batteryLevel:'not_measured',automaticLowBatteryDetection:'not_performed',
      lowBatteryClaimed:false,createdAt:asIsoDateTime('2026-08-13T14:06:30.000Z')
    },{correlationId:'portability-export-replay-completion'})).ok).toBe(false);
    const listed = await executePolicy(database,{resourceId:'*',action:'read',capability:'family.read'},
      (repository,context) => repository.listFamilyEmergencyCardPortabilityItems(
        context,'assistance-profile'),{clockAt:'2026-08-13T14:07:00.000Z'});
    expect(listed).toMatchObject({ok:true});
    if (listed.ok) {
      expect(listed.value).toHaveLength(6);
      expect(listed.value.find(({id}) => id === 'export-print')).toMatchObject({
        mode:'print',artifactReadbackStatus:'not_applicable_print',printerDispatchStatus:'confirmed',
        selectionSha256:'d'.repeat(64),shareReceiptHash:exportAuthorization.receiptHash,
        lowBatteryClaimed:false
      });
      expect(JSON.stringify(listed.value)).not.toMatch(/policy_receipt|receipt_hash|nonce|file_path/u);
    }
    expect(() => database.prepare(
      "UPDATE family_emergency_card_portability_ledger SET configuration_label='changed' WHERE id='card-config'"
    ).run()).toThrow(/append-only/i);
    expect(() => database.prepare(
      "DELETE FROM family_emergency_card_portability_ledger WHERE id='card-config'"
    ).run()).toThrow(/governed deletion workflow/i);
  });

  it('rejects wrong field matrices, stale sources, unsafe archives/counts and false readback or battery truth', async () => {
    const database = openDatabase();
    await seedRoot(database);
    expect(await insertAssistanceChild(database,{
      ...childCommon,id:'fact-old',itemType:'health_fact',factKind:'allergy',value:'Arı alerjisi',
      createdAt:asIsoDateTime('2026-08-13T14:02:00.000Z')
    })).toEqual({ok:true,value:undefined});
    expect(await insertAssistanceChild(database,{
      ...childCommon,id:'fact-current',itemType:'health_fact',factKind:'allergy',value:'Polen alerjisi',
      supersedesItemId:'fact-old',createdAt:asIsoDateTime('2026-08-13T14:03:00.000Z')
    })).toEqual({ok:true,value:undefined});
    expect(await insertPortability(database,{
      ...configuration(),createdAt:asIsoDateTime('2026-08-13T14:04:00.000Z')
    })).toEqual({ok:true,value:undefined});
    expect((await insertPortability(database,{
      ...portabilityCommon,id:'bad-matrix',itemType:'selected_field',configurationId:'card-config',
      sourceItemId:'fact-current',sourceItemType:'health_fact',fieldCode:'label',
      createdAt:asIsoDateTime('2026-08-13T14:05:00.000Z')
    })).ok).toBe(false);
    expect((await insertPortability(database,{
      ...portabilityCommon,id:'stale-source',itemType:'selected_field',configurationId:'card-config',
      sourceItemId:'fact-old',sourceItemType:'health_fact',fieldCode:'fact_value',
      createdAt:asIsoDateTime('2026-08-13T14:05:00.000Z')
    })).ok).toBe(false);
    database.prepare(`INSERT INTO archive_items(
      id,family_id,destroyed_at,sensitivity,created_at,policy_receipt_hash
    ) VALUES
      ('archive-standard',?,NULL,'standard','2026-08-13T14:01:00.000Z',NULL),
      ('archive-destroyed',?,'2026-08-13T14:02:00.000Z','high','2026-08-13T14:01:00.000Z',NULL),
      ('archive-other',?,NULL,'high','2026-08-13T14:01:00.000Z',NULL)
    `).run(FAMILY_ID,FAMILY_ID,OTHER_FAMILY_ID);
    for (const [id,archiveItemId] of [
      ['bad-standard','archive-standard'],['bad-destroyed','archive-destroyed'],['bad-family','archive-other']
    ] as const) expect((await insertPortability(database,{
      ...portabilityCommon,id,itemType:'document_link',configurationId:'card-config',archiveItemId,
      createdAt:asIsoDateTime('2026-08-13T14:06:00.000Z')
    })).ok).toBe(false);
    expect((await insertPortability(database,{
      ...portabilityCommon,id:'oversized-export',itemType:'export_event',configurationId:'card-config',
      mode:'pdf',selectedFieldCount:0,documentCount:1,artifactSha256:'b'.repeat(64),
      selectionSha256:'e'.repeat(64),
      shareReceiptHash:'e'.repeat(64),
      artifactSizeBytes:67_108_865,artifactReadbackStatus:'verified',powerSource:'unknown',
      batteryLevel:'not_measured',automaticLowBatteryDetection:'not_performed',lowBatteryClaimed:false,
      createdAt:asIsoDateTime('2026-08-13T14:07:00.000Z')
    })).ok).toBe(false);
    expect(() => database.prepare(`
      INSERT INTO family_emergency_card_portability_ledger(
        id,profile_id,configuration_id,family_id,owner_person_id,item_type,export_mode,
        selected_field_count,document_count,selection_sha256,share_receipt_hash,
        artifact_sha256,artifact_size_bytes,
        artifact_readback_status,printer_dispatch_status,power_source,battery_level,
        automatic_low_battery_detection,low_battery_claimed,privacy,data_source,created_at,
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,
        policy_resource_type,policy_resource_id,policy_action,policy_capability
      ) SELECT 'false-readback',profile_id,id,family_id,owner_person_id,'export_event','pdf',
        0,1,'${'e'.repeat(64)}','${'e'.repeat(64)}','${'c'.repeat(64)}',4096,
        'not_applicable_print','confirmed','unknown','not_measured',
        'not_performed',0,privacy,data_source,'2026-08-13T14:08:00.000Z',
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,
        policy_resource_type,profile_id,'update',policy_capability
      FROM family_emergency_card_portability_ledger WHERE id='card-config'
    `).run()).toThrow();
  });

  it('enforces the exact 64 selected-field and 10 document-link configuration limits', async () => {
    const database = openDatabase();
    await seedRoot(database);
    expect(await insertPortability(database,configuration())).toEqual({ok:true,value:undefined});
    for (let index = 0; index < 17; index += 1) {
      expect(await insertAssistanceChild(database,{
        ...childCommon,id:`limit-contact-${index}`,itemType:'emergency_contact',
        name:`YakÄ±n kiÅŸi ${index}`,phoneE164:`+90555000${String(index).padStart(4,'0')}`,
        relationship:'YakÄ±n',note:'Acil durumda aranacak kiÅŸi',
        createdAt:asIsoDateTime('2026-08-13T14:02:00.000Z')
      })).toEqual({ok:true,value:undefined});
    }
    const fieldCodes = ['name','phone_e164','relationship','note'] as const;
    for (let sourceIndex = 0; sourceIndex < 16; sourceIndex += 1) {
      for (const fieldCode of fieldCodes) {
        expect(await insertPortability(database,{
          ...portabilityCommon,id:`limit-field-${sourceIndex}-${fieldCode}`,
          itemType:'selected_field',configurationId:'card-config',
          sourceItemId:`limit-contact-${sourceIndex}`,sourceItemType:'emergency_contact',fieldCode,
          createdAt:asIsoDateTime('2026-08-13T14:03:00.000Z')
        })).toEqual({ok:true,value:undefined});
      }
    }
    expect((await insertPortability(database,{
      ...portabilityCommon,id:'limit-field-65',itemType:'selected_field',configurationId:'card-config',
      sourceItemId:'limit-contact-16',sourceItemType:'emergency_contact',fieldCode:'name',
      createdAt:asIsoDateTime('2026-08-13T14:03:00.000Z')
    })).ok).toBe(false);
    for (let index = 0; index < 11; index += 1) {
      database.prepare(`INSERT INTO archive_items(
        id,family_id,destroyed_at,sensitivity,created_at,policy_receipt_hash
      ) VALUES(?,?,NULL,'high','2026-08-13T14:01:00.000Z',NULL)`
      ).run(`limit-archive-${index}`,FAMILY_ID);
    }
    for (let index = 0; index < 10; index += 1) {
      expect(await insertPortability(database,{
        ...portabilityCommon,id:`limit-document-${index}`,itemType:'document_link',
        configurationId:'card-config',archiveItemId:`limit-archive-${index}`,
        createdAt:asIsoDateTime('2026-08-13T14:04:00.000Z')
      })).toEqual({ok:true,value:undefined});
    }
    expect((await insertPortability(database,{
      ...portabilityCommon,id:'limit-document-11',itemType:'document_link',
      configurationId:'card-config',archiveItemId:'limit-archive-10',
      createdAt:asIsoDateTime('2026-08-13T14:04:00.000Z')
    })).ok).toBe(false);
  });

  it('binds exact update/profile receipt, fences cross-ledger replay and hides inactive private roots', async () => {
    const database = openDatabase();
    await seedRoot(database);
    await expect(insertPortability(database,configuration(),{
      ownerPersonId:OTHER_OWNER_ID
    })).rejects.toThrow(/receipt owner does not match/i);
    expect(await insertPortability(database,configuration())).toEqual({ok:true,value:undefined});
    const shared = await executePolicy(database,{
      resourceId:'assistance-profile',action:'share',capability:'file.share',
      purpose:'emergency-offline-portability',
      requestedFields:['phone_e164',`selection_sha256:${'d'.repeat(64)}`]
    },(repository,context) => repository.listFamilyEmergencyCardPortabilityItems(
      context,'assistance-profile'),{clockAt:'2026-08-13T14:04:00.000Z'});
    expect(shared).toMatchObject({ok:true});
    if (shared.ok) expect(shared.value.map(({id}) => id)).toEqual(['card-config']);
    const receipt = database.prepare(`SELECT policy_receipt_hash
      FROM family_emergency_card_portability_ledger WHERE id='card-config'`
    ).get() as {policy_receipt_hash:string};
    expect(receipt.policy_receipt_hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(() => database.prepare(
      "INSERT INTO finance_import_batches(id,policy_receipt_hash) VALUES('portability-replay',?)"
    ).run(receipt.policy_receipt_hash)).toThrow(/already bound to an emergency card portability item/i);
    database.prepare("INSERT INTO health_records(id,policy_receipt_hash) VALUES('health-empty',NULL)").run();
    expect(() => database.prepare(
      "UPDATE health_records SET policy_receipt_hash=? WHERE id='health-empty'"
    ).run(receipt.policy_receipt_hash)).toThrow(/already bound to an emergency card portability item/i);
    expect(() => database.prepare(`INSERT INTO life_records(
      id,family_id,owner_person_id,category,title,status,privacy,created_at
    ) VALUES('card-config',?,?, 'task','Collision','active','private',?)`
    ).run(FAMILY_ID,OWNER_ID,PLAN_AT)).toThrow(/collides with an emergency card portability item/i);
    database.prepare(`UPDATE data_lifecycle SET state='quarantined'
      WHERE resource_type='life_record' AND resource_id='assistance-profile'`).run();
    const hidden = await executePolicy(database,{resourceId:'*',action:'read',capability:'family.read'},
      (repository,context) => repository.listFamilyEmergencyCardPortabilityItems(
        context,'assistance-profile'),{clockAt:'2026-08-13T14:07:00.000Z'});
    expect(hidden).toEqual({ok:true,value:[]});
  });
});
