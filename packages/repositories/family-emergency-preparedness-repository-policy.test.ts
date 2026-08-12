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
  FamilyEmergencyLedgerItemRow,
  FamilyEmergencyPreparednessLedgerItemRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteLifeRepository } from './src/life-repository.js';
import { computePlatformPolicyReceiptHash } from './src/platform-policy-transaction-repository.js';

const PLAN_AT = '2026-08-13T12:00:00.000Z';
const FAMILY_ID = asFamilyId('family-preparedness');
const OWNER_ID = asPersonId('person-preparedness-owner');
const ACCOUNT_ID = asUserId('account-preparedness');
const databases:DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

const migrations = [83,84,85,86].map((version) =>
  FAMILY_DATABASE_MIGRATIONS.find((migration) => migration.version === version));
if (migrations.some((migration) => !migration)) throw new Error('MIGRATION_83_86_NOT_FOUND');
const migration86 = migrations[3]!;

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
    correlation_id TEXT NOT NULL,resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,
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
  INSERT INTO families VALUES('${FAMILY_ID}');
  INSERT INTO people VALUES('${OWNER_ID}','${FAMILY_ID}','active');
  INSERT INTO accounts VALUES('${ACCOUNT_ID}','${OWNER_ID}','active');
  INSERT INTO database_metadata VALUES('schema_generation','before-33-h','${PLAN_AT}');
  INSERT INTO platform_policy_database_fences VALUES('preparedness-write',86,1);
`;

const openDatabase = ():DatabaseSync => {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  database.exec(fixtureSchema);
  for (const migration of migrations) database.exec(migration!.sql);
  return database;
};

const kernel = new PlatformPolicyKernel({
  policyVersion:'33-h-preparedness-repository-test-v1',
  signingKey:Buffer.from('33-h-preparedness-controlled-test-key','utf8'),
  applicationCapabilities:{ 'windows-desktop':['family.read','family.write'] },
  consentRequiredCapabilities:[],
  onlineOnlyCapabilities:[],
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
    'preparedness-write',86,JSON.stringify(record)
  );
  database.prepare(`
    INSERT INTO platform_policy_journal_projection_outbox(receipt_hash,record_json) VALUES(?,?)
  `).run(receiptHash,JSON.stringify(record));
};

interface PolicyOptions {
  readonly familyId?:string;
  readonly ownerPersonId?:string;
  readonly clockAt?:string;
  readonly action?:'create'|'update'|'read';
}

const executePolicy = async <T>(
  database:DatabaseSync,
  intent:Pick<PlatformPolicyIntent,'resourceId'|'action'|'capability'>,
  operation:(repository:SqliteLifeRepository,context:PolicyAuthorizedRepositoryExecutionContext) => RepositoryResult<T>,
  options:PolicyOptions = {}
):Promise<RepositoryResult<T>> => {
  const correlationId = asCorrelationId(`preparedness-${++nonceSequence}`);
  const familyId = asFamilyId(options.familyId ?? String(FAMILY_ID));
  const ownerPersonId = asPersonId(options.ownerPersonId ?? String(OWNER_ID));
  const clockAt = options.clockAt ?? PLAN_AT;
  const pep = new PlatformPolicyEnforcementPoint({
    kernel,
    authorityResolver:{ resolve:() => ({
      policyVersion:'33-h-preparedness-repository-test-v1',
      accountId:ACCOUNT_ID,
      personId:OWNER_ID,
      deviceId:'device-preparedness',
      applicationId:'windows-desktop',
      deviceTrusted:true,
      membershipActive:true,
      roles:['family_admin'],
      familyIds:[familyId],
      grants:[{
        id:`grant-${correlationId}`,
        subjectAccountId:ACCOUNT_ID,
        resourceType:'life_record',
        resourceId:intent.resourceId,
        actions:[intent.action],
        effect:'allow',
        startsAt:'2026-08-13T00:00:00.000Z'
      }],
      online:true,
      expiresAt:'2026-08-13T16:00:00.000Z'
    }) },
    resourceResolver:{ resolve:() => ({
      type:'life_record',id:intent.resourceId,familyId,ownerPersonId,sensitivity:'personal'
    }) },
    receiptSink:{ append:(record) => persistReceipt(database,record) },
    replayStore:{ reserve:() => true },
    clock:() => clockAt,
    nonceFactory:() => `nonce-preparedness-${nonceSequence}`
  });
  return pep.execute({
    correlationId,
    action:intent.action,
    capability:intent.capability,
    resourceType:'life_record',
    resourceId:intent.resourceId,
    purpose:'general'
  },() => ({ writable:true,epoch:86 }),(policyAuthorization) => operation(
    new SqliteLifeRepository(),
    {
      transaction:database as unknown as RepositoryTransaction,
      actor:{ userId:ACCOUNT_ID,roles:['family_admin'],personId:OWNER_ID },
      correlationId,
      occurredAt:asIsoDateTime(clockAt),
      policyAuthorization
    }
  ));
};

const plan = ():FamilyEmergencyLedgerItemRow => ({
  id:'emergency-plan',familyId:FAMILY_ID,ownerPersonId:OWNER_ID,itemType:'emergency_plan',
  planKind:'general',title:'Aile hazırlık planı',
  evacuationInstructions:'Planı izleyin ve buluşma noktasına gidin.',
  privacy:'family',dataSource:'manual',createdAt:asIsoDateTime(PLAN_AT)
});

const insertPlan = (database:DatabaseSync):Promise<RepositoryResult<void>> => executePolicy(
  database,
  { resourceId:'emergency-plan',action:'create',capability:'family.write' },
  (repository,context) => repository.insertFamilyEmergencyItem(context,plan())
);

const insertPreparedness = (
  database:DatabaseSync,
  row:FamilyEmergencyPreparednessLedgerItemRow,
  options:PolicyOptions = {}
):Promise<RepositoryResult<void>> => executePolicy(
  database,
  { resourceId:row.planId,action:'update',capability:'family.write' },
  (repository,context) => repository.insertFamilyEmergencyPreparednessItem(context,row),
  { ...options,clockAt:options.clockAt ?? row.createdAt }
);

const common = {
  planId:'emergency-plan',familyId:FAMILY_ID,ownerPersonId:OWNER_ID,
  privacy:'family' as const,dataSource:'manual' as const
};

const kit = (id = 'kit-home'):FamilyEmergencyPreparednessLedgerItemRow => ({
  ...common,id,itemType:'preparedness_kit',kitKind:'household_72_hour',label:'Ev afet çantası',
  createdAt:asIsoDateTime('2026-08-13T12:01:00.000Z')
});

describe('33-H family emergency preparedness migration and repository policy', () => {
  it('creates migration 86 and persists exact append-only kit, item, check and drill history', async () => {
    const database = openDatabase();
    expect(migration86.name).toBe('b5_family_emergency_preparedness_ledger');
    const columns = database.prepare(
      "PRAGMA table_info('family_emergency_preparedness_ledger')"
    ).all() as Array<{ name:string }>;
    expect(columns.map(({ name }) => name)).toEqual(expect.arrayContaining([
      'plan_id','item_type','parent_item_id','supersedes_item_id','target_quantity_milliunits',
      'expires_on','actual_quantity_milliunits','checked_at','duration_seconds','policy_receipt_hash'
    ]));
    expect(await insertPlan(database)).toEqual({ ok:true,value:undefined });
    expect(await insertPreparedness(database,kit())).toEqual({ ok:true,value:undefined });
    expect(await insertPreparedness(database,{
      ...common,id:'kit-water',itemType:'preparedness_kit_item',kitId:'kit-home',category:'water',
      label:'İçme suyu',targetQuantityMilliunits:6_000,quantityUnit:'liter',expiresOn:'2027-08-13',
      createdAt:asIsoDateTime('2026-08-13T12:02:00.000Z')
    })).toEqual({ ok:true,value:undefined });
    expect(await insertPreparedness(database,{
      ...common,id:'kit-water-check',itemType:'preparedness_kit_check',kitItemId:'kit-water',
      status:'ready',actualQuantityMilliunits:6_000,checkedAt:asIsoDateTime('2026-08-13T12:03:00.000Z'),
      note:'Miktar elle kontrol edildi.',createdAt:asIsoDateTime('2026-08-13T12:03:00.000Z')
    })).toEqual({ ok:true,value:undefined });
    expect(await insertPreparedness(database,{
      ...common,id:'drill-earthquake',itemType:'emergency_drill',drillKind:'earthquake',
      status:'completed',occurredAt:asIsoDateTime('2026-08-13T12:04:00.000Z'),durationSeconds:420,
      createdAt:asIsoDateTime('2026-08-13T12:04:00.000Z')
    })).toEqual({ ok:true,value:undefined });
    const listed = await executePolicy(
      database,
      { resourceId:'*',action:'read',capability:'family.read' },
      (repository,context) => repository.listFamilyEmergencyPreparednessItems(context),
      { clockAt:'2026-08-13T12:05:00.000Z' }
    );
    expect(listed).toMatchObject({ ok:true });
    if (listed.ok) {
      expect(listed.value).toHaveLength(4);
      expect(listed.value.find(({ id }) => id === 'kit-water-check')).toMatchObject({
        status:'ready',actualQuantityMilliunits:6_000
      });
    }
    expect(() => database.prepare(
      "UPDATE family_emergency_preparedness_ledger SET label='changed' WHERE id='kit-home'"
    ).run()).toThrow(/append-only/i);
    expect(() => database.prepare(
      "DELETE FROM family_emergency_preparedness_ledger WHERE id='kit-home'"
    ).run()).toThrow(/governed deletion workflow/i);
  });

  it('rejects wrong parents, cross-root corrections, invalid calendar dates and unsafe quantities', async () => {
    const database = openDatabase();
    expect(await insertPlan(database)).toEqual({ ok:true,value:undefined });
    expect(await insertPreparedness(database,kit())).toEqual({ ok:true,value:undefined });
    expect((await insertPreparedness(database,{
      ...common,id:'bad-parent-check',itemType:'preparedness_kit_check',kitItemId:'kit-home',
      status:'missing',actualQuantityMilliunits:0,checkedAt:asIsoDateTime('2026-08-13T12:02:00.000Z'),
      createdAt:asIsoDateTime('2026-08-13T12:02:00.000Z')
    })).ok).toBe(false);
    expect((await insertPreparedness(database,{
      ...common,id:'bad-calendar',itemType:'preparedness_kit_item',kitId:'kit-home',category:'food',
      label:'Konserve',targetQuantityMilliunits:2_000,quantityUnit:'item',expiresOn:'2027-02-29',
      createdAt:asIsoDateTime('2026-08-13T12:02:00.000Z')
    })).ok).toBe(false);
    expect((await insertPreparedness(database,{
      ...common,id:'unsafe-quantity',itemType:'preparedness_kit_item',kitId:'kit-home',category:'water',
      label:'Su',targetQuantityMilliunits:9_000_000_000_000_001,quantityUnit:'liter',
      createdAt:asIsoDateTime('2026-08-13T12:03:00.000Z')
    })).ok).toBe(false);
    expect((await insertPreparedness(database,{
      ...common,id:'wrong-type-correction',itemType:'emergency_drill',supersedesItemId:'kit-home',
      drillKind:'fire',status:'partial',occurredAt:asIsoDateTime('2026-08-13T12:04:00.000Z'),
      createdAt:asIsoDateTime('2026-08-13T12:04:00.000Z')
    })).ok).toBe(false);
  });

  it('inherits exact plan scope and hides preparedness history when the plan lifecycle is inactive', async () => {
    const database = openDatabase();
    expect(await insertPlan(database)).toEqual({ ok:true,value:undefined });
    expect(await insertPreparedness(database,kit())).toEqual({ ok:true,value:undefined });
    expect((await insertPreparedness(database,{
      ...kit('wrong-owner'),ownerPersonId:asPersonId('person-wrong-owner')
    },{ ownerPersonId:'person-wrong-owner' })).ok).toBe(false);
    database.prepare(`
      UPDATE data_lifecycle SET state='quarantined'
      WHERE resource_type='life_record' AND resource_id='emergency-plan'
    `).run();
    const listed = await executePolicy(
      database,
      { resourceId:'*',action:'read',capability:'family.read' },
      (repository,context) => repository.listFamilyEmergencyPreparednessItems(context)
    );
    expect(listed).toEqual({ ok:true,value:[] });
    expect((await insertPreparedness(database,{
      ...kit('inactive-plan-child'),createdAt:asIsoDateTime('2026-08-13T12:02:00.000Z')
    })).ok).toBe(false);
  });

  it('rejects cross-ledger id and durable receipt replay in both directions', async () => {
    const database = openDatabase();
    expect(await insertPlan(database)).toEqual({ ok:true,value:undefined });
    expect(await insertPreparedness(database,kit())).toEqual({ ok:true,value:undefined });
    const receipt = database.prepare(`
      SELECT policy_receipt_hash FROM family_emergency_preparedness_ledger WHERE id='kit-home'
    `).get() as { policy_receipt_hash:string };
    expect(receipt.policy_receipt_hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(() => database.prepare(`
      INSERT INTO life_records(
        id,family_id,owner_person_id,category,title,status,privacy,created_at,
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
        policy_correlation_id,policy_resource_type,policy_resource_id,policy_action,policy_capability
      ) SELECT 'preparedness-replay',family_id,owner_person_id,'task','Replay','active','family',created_at,
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
        policy_correlation_id,policy_resource_type,policy_resource_id,policy_action,policy_capability
      FROM family_emergency_preparedness_ledger WHERE id='kit-home'
    `).run()).toThrow(/already bound to an emergency preparedness item/i);
    expect(() => database.prepare(`
      INSERT INTO finance_import_batches(id,policy_receipt_hash)
      VALUES('preparedness-import-replay',?)
    `).run(receipt.policy_receipt_hash)).toThrow(/already bound to an emergency preparedness item/i);
    expect(() => database.prepare(`
      INSERT INTO archive_items(
        id,family_id,destroyed_at,sensitivity,created_at,policy_receipt_hash
      ) VALUES('preparedness-archive-replay',?,NULL,'personal',?,?)
    `).run(FAMILY_ID,PLAN_AT,receipt.policy_receipt_hash))
      .toThrow(/already bound to an emergency preparedness item/i);
    database.prepare("INSERT INTO health_records(id,policy_receipt_hash) VALUES('health-empty',NULL)").run();
    expect(() => database.prepare(`
      UPDATE health_records SET policy_receipt_hash=? WHERE id='health-empty'
    `).run(receipt.policy_receipt_hash)).toThrow(/already bound to an emergency preparedness item/i);
    expect(() => database.prepare(`
      INSERT INTO family_emergency_preparedness_ledger(
        id,plan_id,family_id,owner_person_id,item_type,kit_kind,label,privacy,data_source,created_at,
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,
        policy_resource_type,policy_resource_id,policy_action,policy_capability
      ) SELECT 'existing-receipt-replay',id,family_id,owner_person_id,'preparedness_kit','other',
        'Replay kit',privacy,data_source,created_at,policy_receipt_hash,policy_receipt_version,
        policy_receipt_nonce,policy_correlation_id,policy_resource_type,id,'update',policy_capability
      FROM family_emergency_ledger WHERE id='emergency-plan'
    `).run()).toThrow(/unused exact durable life receipt/i);
    expect(() => database.prepare(`
      INSERT INTO family_emergency_ledger(
        id,family_id,owner_person_id,item_type,plan_kind,title,evacuation_instructions,
        privacy,data_source,created_at,policy_receipt_hash,policy_receipt_version,
        policy_receipt_nonce,policy_correlation_id,policy_resource_type,policy_resource_id,
        policy_action,policy_capability
      ) SELECT 'emergency-replay',family_id,owner_person_id,'emergency_plan','general',
        'Replay plan','Replay instructions',privacy,data_source,created_at,policy_receipt_hash,
        policy_receipt_version,policy_receipt_nonce,policy_correlation_id,policy_resource_type,
        'emergency-replay','create',policy_capability
      FROM family_emergency_preparedness_ledger WHERE id='kit-home'
    `).run()).toThrow(/already bound to an emergency preparedness item/i);
    expect(() => database.prepare(`
      INSERT INTO life_records(id,family_id,owner_person_id,category,title,status,privacy,created_at)
      VALUES('kit-home',? ,? ,'task','Collision','active','family',?)
    `).run(FAMILY_ID,OWNER_ID,PLAN_AT)).toThrow(/collides with an emergency preparedness item/i);
  });
});
