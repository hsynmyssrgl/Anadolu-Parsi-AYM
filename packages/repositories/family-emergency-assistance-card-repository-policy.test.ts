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
  FamilyEmergencyLedgerItemRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteLifeRepository } from './src/life-repository.js';
import { computePlatformPolicyReceiptHash } from './src/platform-policy-transaction-repository.js';

const PLAN_AT = '2026-08-13T13:00:00.000Z';
const FAMILY_ID = asFamilyId('family-assistance');
const OWNER_ID = asPersonId('person-assistance-owner');
const OTHER_ID = asPersonId('person-assistance-other');
const ACCOUNT_ID = asUserId('account-assistance-owner');
const OTHER_ACCOUNT_ID = asUserId('account-assistance-other');
const databases:DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

const migrations = [83,84,85,86,87].map((version) =>
  FAMILY_DATABASE_MIGRATIONS.find((migration) => migration.version === version));
if (migrations.some((migration) => !migration)) throw new Error('MIGRATION_83_87_NOT_FOUND');
const migration87 = migrations[4]!;

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
  INSERT INTO people VALUES('${OTHER_ID}','${FAMILY_ID}','active');
  INSERT INTO accounts VALUES('${ACCOUNT_ID}','${OWNER_ID}','active');
  INSERT INTO accounts VALUES('${OTHER_ACCOUNT_ID}','${OTHER_ID}','active');
  INSERT INTO database_metadata VALUES('schema_generation','before-33-i','${PLAN_AT}');
  INSERT INTO platform_policy_database_fences VALUES('assistance-write',87,1);
`;

const openDatabase = ():DatabaseSync => {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  database.exec(fixtureSchema);
  for (const migration of migrations) database.exec(migration!.sql);
  return database;
};

const kernel = new PlatformPolicyKernel({
  policyVersion:'33-i-assistance-repository-test-v1',
  signingKey:Buffer.from('33-i-assistance-controlled-test-key','utf8'),
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
    'assistance-write',87,JSON.stringify(record)
  );
  database.prepare(`
    INSERT INTO platform_policy_journal_projection_outbox(receipt_hash,record_json) VALUES(?,?)
  `).run(receiptHash,JSON.stringify(record));
};

interface PolicyOptions {
  readonly ownerPersonId?:string;
  readonly actorPersonId?:string;
  readonly actorAccountId?:string;
  readonly clockAt?:string;
  readonly sensitivity?:'personal'|'highly_sensitive';
}

const executePolicy = async <T>(
  database:DatabaseSync,
  intent:Pick<PlatformPolicyIntent,'resourceId'|'action'|'capability'>,
  operation:(repository:SqliteLifeRepository,context:PolicyAuthorizedRepositoryExecutionContext) => RepositoryResult<T>,
  options:PolicyOptions = {}
):Promise<RepositoryResult<T>> => {
  const correlationId = asCorrelationId(`assistance-${++nonceSequence}`);
  const ownerPersonId = asPersonId(options.ownerPersonId ?? String(OWNER_ID));
  const actorPersonId = asPersonId(options.actorPersonId ?? String(OWNER_ID));
  const actorAccountId = asUserId(options.actorAccountId ?? String(ACCOUNT_ID));
  const clockAt = options.clockAt ?? PLAN_AT;
  const pep = new PlatformPolicyEnforcementPoint({
    kernel,
    authorityResolver:{ resolve:() => ({
      policyVersion:'33-i-assistance-repository-test-v1',
      accountId:actorAccountId,
      personId:actorPersonId,
      deviceId:'device-assistance',
      applicationId:'windows-desktop',
      deviceTrusted:true,
      membershipActive:true,
      roles:['family_admin'],
      familyIds:[FAMILY_ID],
      grants:[{
        id:`grant-${correlationId}`,
        subjectAccountId:actorAccountId,
        resourceType:'life_record',
        resourceId:intent.resourceId,
        actions:[intent.action],
        effect:'allow',
        startsAt:'2026-08-13T00:00:00.000Z'
      }],
      online:true,
      expiresAt:'2026-08-13T18:00:00.000Z'
    }) },
    resourceResolver:{ resolve:() => ({
      type:'life_record',id:intent.resourceId,familyId:FAMILY_ID,ownerPersonId,
      sensitivity:options.sensitivity ?? 'highly_sensitive'
    }) },
    receiptSink:{ append:(record) => persistReceipt(database,record) },
    replayStore:{ reserve:() => true },
    clock:() => clockAt,
    nonceFactory:() => `nonce-assistance-${nonceSequence}`
  });
  return pep.execute({
    correlationId,
    action:intent.action,
    capability:intent.capability,
    resourceType:'life_record',
    resourceId:intent.resourceId,
    purpose:'general'
  },() => ({ writable:true,epoch:87 }),(policyAuthorization) => operation(
    new SqliteLifeRepository(),
    {
      transaction:database as unknown as RepositoryTransaction,
      actor:{ userId:actorAccountId,roles:['family_admin'],personId:actorPersonId },
      correlationId,
      occurredAt:asIsoDateTime(clockAt),
      policyAuthorization
    }
  ));
};

const plan = ():FamilyEmergencyLedgerItemRow => ({
  id:'emergency-plan',familyId:FAMILY_ID,ownerPersonId:OWNER_ID,itemType:'emergency_plan',
  planKind:'general',title:'Aile acil durum planı',
  evacuationInstructions:'Planı izleyin ve güvenli buluşma noktasına gidin.',
  privacy:'family',dataSource:'manual',createdAt:asIsoDateTime(PLAN_AT)
});

const insertPlan = (database:DatabaseSync):Promise<RepositoryResult<void>> => executePolicy(
  database,
  { resourceId:'emergency-plan',action:'create',capability:'family.write' },
  (repository,context) => repository.insertFamilyEmergencyItem(context,plan()),
  { sensitivity:'personal' }
);

const profile = (id = 'assistance-profile'):FamilyEmergencyAssistanceProfileLedgerItemRow => ({
  id,planId:'emergency-plan',familyId:FAMILY_ID,ownerPersonId:OWNER_ID,
  itemType:'emergency_profile',subjectKind:'person',subjectPersonId:OWNER_ID,
  label:'Acil sağlık kartım',privacy:'private',dataSource:'manual',
  createdAt:asIsoDateTime('2026-08-13T13:01:00.000Z')
});

const insertProfile = (
  database:DatabaseSync,
  row:FamilyEmergencyAssistanceProfileLedgerItemRow = profile()
):Promise<RepositoryResult<void>> => executePolicy(
  database,
  { resourceId:row.id,action:'create',capability:'family.write' },
  (repository,context) => repository.insertFamilyEmergencyAssistanceItem(context,row),
  { ownerPersonId:row.ownerPersonId,clockAt:row.createdAt }
);

const insertChild = (
  database:DatabaseSync,
  row:Exclude<FamilyEmergencyAssistanceLedgerItemRow, FamilyEmergencyAssistanceProfileLedgerItemRow>
):Promise<RepositoryResult<void>> => executePolicy(
  database,
  { resourceId:row.profileId,action:'update',capability:'family.write' },
  (repository,context) => {
    const parent = repository.findFamilyEmergencyAssistanceProfile(context,row.profileId);
    if (!parent.ok || !parent.value) return parent.ok ? { ok:false,error:{
      code:'CORE-NOT_FOUND-001',message:'profile missing',correlationId:context.correlationId,retryable:false
    } } : parent;
    return repository.insertFamilyEmergencyAssistanceItem(context,row);
  },
  { ownerPersonId:row.ownerPersonId,clockAt:row.createdAt }
);

const childCommon = {
  planId:'emergency-plan',profileId:'assistance-profile',familyId:FAMILY_ID,
  ownerPersonId:OWNER_ID,privacy:'private' as const,dataSource:'manual' as const
};

describe('33-I family emergency assistance card migration and repository policy', () => {
  it('persists all four private variants through exact create/update receipts and never grants family-admin visibility', async () => {
    const database = openDatabase();
    expect(migration87.name).toBe('b5_family_emergency_assistance_card_ledger');
    const assistanceColumns = database.prepare(
      "PRAGMA table_info('family_emergency_assistance_ledger')"
    ).all() as Array<{name:string}>;
    expect(assistanceColumns.map(({ name }) => name)).toEqual(expect.arrayContaining([
      'plan_id','profile_id','subject_kind','subject_pet_id','fact_kind','phone_e164',
      'instruction_kind','privacy','policy_receipt_hash'
    ]));
    expect(await insertPlan(database)).toEqual({ ok:true,value:undefined });
    expect(await insertProfile(database)).toEqual({ ok:true,value:undefined });
    expect(await insertChild(database,{
      ...childCommon,id:'contact-equal-profile-ms',itemType:'emergency_contact',name:'Aynı an irtibatı',
      phoneE164:'+905551112244',relationship:'Yakın',
      createdAt:asIsoDateTime('2026-08-13T13:01:00.000Z')
    })).toEqual({ ok:true,value:undefined });
    expect(await insertChild(database,{
      ...childCommon,id:'fact-blood',itemType:'health_fact',factKind:'blood_type',
      bloodType:'o_positive',note:'Kullanıcı tarafından girildi.',
      createdAt:asIsoDateTime('2026-08-13T13:02:00.000Z')
    })).toEqual({ ok:true,value:undefined });
    expect(await insertChild(database,{
      ...childCommon,id:'contact-primary',itemType:'emergency_contact',name:'Yakın kişi',
      phoneE164:'+905551112233',relationship:'Kardeş',
      createdAt:asIsoDateTime('2026-08-13T13:03:00.000Z')
    })).toEqual({ ok:true,value:undefined });
    expect(await insertChild(database,{
      ...childCommon,id:'instruction-mobility',itemType:'assistance_instruction',
      instructionKind:'mobility',instruction:'Tahliye sandalyesini girişten alın.',
      createdAt:asIsoDateTime('2026-08-13T13:04:00.000Z')
    })).toEqual({ ok:true,value:undefined });
    const ownerList = await executePolicy(
      database,{ resourceId:'*',action:'read',capability:'family.read' },
      (repository,context) => repository.listFamilyEmergencyAssistanceItems(context),
      { clockAt:'2026-08-13T13:05:00.000Z' }
    );
    expect(ownerList).toMatchObject({ ok:true });
    if (ownerList.ok) {
      expect(ownerList.value).toHaveLength(5);
      expect(ownerList.value.find(({ id }) => id === 'fact-blood')).toMatchObject({
        factKind:'blood_type',bloodType:'o_positive'
      });
      expect(JSON.stringify(ownerList.value)).not.toMatch(/policy_receipt|receipt_hash|nonce/u);
    }
    const otherAdminList = await executePolicy(
      database,{ resourceId:'*',action:'read',capability:'family.read' },
      (repository,context) => repository.listFamilyEmergencyAssistanceItems(context),
      { actorPersonId:OTHER_ID,actorAccountId:OTHER_ACCOUNT_ID,ownerPersonId:OTHER_ID,
        clockAt:'2026-08-13T13:05:00.000Z' }
    );
    expect(otherAdminList).toEqual({ ok:true,value:[] });
  });

  it('enforces person/pet ownership, exact profile inheritance, subtype supersession and lifecycle', async () => {
    const database = openDatabase();
    expect(await insertPlan(database)).toEqual({ ok:true,value:undefined });
    expect(await insertProfile(database)).toEqual({ ok:true,value:undefined });
    expect((await insertProfile(database,{
      ...profile('wrong-person-owner'),subjectPersonId:OTHER_ID
    })).ok).toBe(false);
    expect(await insertProfile(database,{
      id:'pet-profile',planId:'emergency-plan',familyId:FAMILY_ID,ownerPersonId:OWNER_ID,
      itemType:'emergency_profile',subjectKind:'pet',subjectPetId:'pet-opaque-1',
      responsiblePersonId:OWNER_ID,label:'Evcil hayvan yardım profili',privacy:'private',
      dataSource:'manual',createdAt:asIsoDateTime('2026-08-13T13:02:00.000Z')
    })).toEqual({ ok:true,value:undefined });
    expect((await insertChild(database,{
      ...childCommon,id:'wrong-private-inheritance',ownerPersonId:OTHER_ID,itemType:'health_fact',
      factKind:'allergy',value:'Arı alerjisi',createdAt:asIsoDateTime('2026-08-13T13:03:00.000Z')
    })).ok).toBe(false);
    expect(await insertChild(database,{
      ...childCommon,id:'fact-allergy',itemType:'health_fact',factKind:'allergy',value:'Arı alerjisi',
      createdAt:asIsoDateTime('2026-08-13T13:03:00.000Z')
    })).toEqual({ ok:true,value:undefined });
    expect((await insertChild(database,{
      ...childCommon,id:'bad-subtype-correction',itemType:'health_fact',factKind:'medication',
      value:'İlaç bilgisi',supersedesItemId:'fact-allergy',
      createdAt:asIsoDateTime('2026-08-13T13:04:00.000Z')
    })).ok).toBe(false);
    expect(() => database.prepare(
      "UPDATE family_emergency_assistance_ledger SET label='changed' WHERE id='assistance-profile'"
    ).run()).toThrow(/append-only/i);
    expect(() => database.prepare(
      "DELETE FROM family_emergency_assistance_ledger WHERE id='fact-allergy'"
    ).run()).toThrow(/governed deletion workflow/i);
    database.prepare(`
      UPDATE data_lifecycle SET state='quarantined'
      WHERE resource_type='life_record' AND resource_id='assistance-profile'
    `).run();
    const hidden = await executePolicy(
      database,{ resourceId:'*',action:'read',capability:'family.read' },
      (repository,context) => repository.listFamilyEmergencyAssistanceItems(context),
      { clockAt:'2026-08-13T13:05:00.000Z' }
    );
    expect(hidden).toMatchObject({ ok:true });
    if (hidden.ok) expect(hidden.value.map(({ id }) => id)).not.toContain('assistance-profile');
  });

  it('rejects invalid E.164, cross-ledger ids and durable receipt replay in both directions', async () => {
    const database = openDatabase();
    expect(await insertPlan(database)).toEqual({ ok:true,value:undefined });
    expect(await insertProfile(database)).toEqual({ ok:true,value:undefined });
    expect((await insertChild(database,{
      ...childCommon,id:'bad-phone',itemType:'emergency_contact',name:'Yakın kişi',
      phoneE164:'0555 111 22 33',createdAt:asIsoDateTime('2026-08-13T13:02:00.000Z')
    })).ok).toBe(false);
    expect(await insertChild(database,{
      ...childCommon,id:'contact-replay-source',itemType:'emergency_contact',name:'Yakın kişi',
      phoneE164:'+905551112233',createdAt:asIsoDateTime('2026-08-13T13:03:00.000Z')
    })).toEqual({ ok:true,value:undefined });
    const receipt = database.prepare(`
      SELECT policy_receipt_hash FROM family_emergency_assistance_ledger WHERE id='contact-replay-source'
    `).get() as {policy_receipt_hash:string};
    expect(receipt.policy_receipt_hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(() => database.prepare(`
      INSERT INTO finance_import_batches(id,policy_receipt_hash) VALUES('assistance-replay',?)
    `).run(receipt.policy_receipt_hash)).toThrow(/already bound to an emergency assistance item/i);
    database.prepare("INSERT INTO health_records(id,policy_receipt_hash) VALUES('health-empty',NULL)").run();
    expect(() => database.prepare(`
      UPDATE health_records SET policy_receipt_hash=? WHERE id='health-empty'
    `).run(receipt.policy_receipt_hash)).toThrow(/already bound to an emergency assistance item/i);
    expect(() => database.prepare(`
      INSERT INTO family_emergency_preparedness_ledger(
        id,plan_id,family_id,owner_person_id,item_type,kit_kind,label,privacy,data_source,created_at,
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,
        policy_resource_type,policy_resource_id,policy_action,policy_capability
      ) SELECT 'assistance-to-preparedness-replay',plan_id,family_id,owner_person_id,
        'preparedness_kit','other','Replay kit','family',data_source,created_at,
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,
        policy_resource_type,plan_id,'update',policy_capability
      FROM family_emergency_assistance_ledger WHERE id='contact-replay-source'
    `).run()).toThrow(/already bound to an emergency assistance item/i);
    expect(() => database.prepare(`
      INSERT INTO family_emergency_assistance_ledger(
        id,plan_id,family_id,owner_person_id,item_type,subject_kind,subject_person_id,label,
        privacy,data_source,created_at,policy_receipt_hash,policy_receipt_version,
        policy_receipt_nonce,policy_correlation_id,policy_resource_type,policy_resource_id,
        policy_action,policy_capability
      ) SELECT 'receipt-reuse-new-profile',plan_id,family_id,owner_person_id,'emergency_profile',
        'person',owner_person_id,'Replay profile','private',data_source,created_at,
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,
        policy_resource_type,'receipt-reuse-new-profile','create',policy_capability
      FROM family_emergency_ledger WHERE id='emergency-plan'
    `).run()).toThrow(/unused exact durable private life receipt/i);
    expect(() => database.prepare(`
      INSERT INTO life_records(id,family_id,owner_person_id,category,title,status,privacy,created_at)
      VALUES('contact-replay-source',?,?,'task','Collision','active','private',?)
    `).run(FAMILY_ID,OWNER_ID,PLAN_AT)).toThrow(/collides with an emergency assistance item/i);
  });
});
