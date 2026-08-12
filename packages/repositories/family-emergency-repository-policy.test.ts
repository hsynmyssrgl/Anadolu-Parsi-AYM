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
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteLifeRepository } from './src/life-repository.js';
import { computePlatformPolicyReceiptHash } from './src/platform-policy-transaction-repository.js';

const NOW = '2026-08-13T12:00:00.000Z';
const FAMILY_ID = asFamilyId('family-emergency');
const OWNER_ID = asPersonId('person-emergency-owner');
const MEMBER_ID = asPersonId('person-emergency-member');
const ACCOUNT_ID = asUserId('account-emergency');
const databases:DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

const migration85 = FAMILY_DATABASE_MIGRATIONS.find(({ version }) => version === 85);
if (!migration85) throw new Error('MIGRATION_85_NOT_FOUND');
const migration83 = FAMILY_DATABASE_MIGRATIONS.find(({ version }) => version === 83);
const migration84 = FAMILY_DATABASE_MIGRATIONS.find(({ version }) => version === 84);
if (!migration83 || !migration84) throw new Error('MIGRATION_83_84_NOT_FOUND');

const fixtureSchema = `
  PRAGMA foreign_keys=ON;
  CREATE TABLE families(id TEXT PRIMARY KEY);
  CREATE TABLE people(
    id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id),status TEXT NOT NULL
  );
  CREATE TABLE accounts(
    id TEXT PRIMARY KEY,person_id TEXT REFERENCES people(id),status TEXT NOT NULL
  );
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
  CREATE TABLE finance_planning_ledger(
    id TEXT PRIMARY KEY,item_type TEXT NOT NULL,asset_class TEXT,category_kind TEXT,
    family_id TEXT NOT NULL,owner_person_id TEXT NOT NULL,privacy TEXT NOT NULL,
    amount REAL,currency TEXT,occurred_at TEXT,created_at TEXT NOT NULL,policy_receipt_hash TEXT
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
  CREATE TABLE finance_import_batches(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  INSERT INTO families VALUES('${FAMILY_ID}');
  INSERT INTO people VALUES('${OWNER_ID}','${FAMILY_ID}','active');
  INSERT INTO people VALUES('${MEMBER_ID}','${FAMILY_ID}','active');
  INSERT INTO accounts VALUES('${ACCOUNT_ID}','${OWNER_ID}','active');
  INSERT INTO database_metadata VALUES('schema_generation','before-33-g','${NOW}');
  INSERT INTO platform_policy_database_fences VALUES('family-emergency-write',85,1);
`;

const openDatabase = ():DatabaseSync => {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  database.exec(fixtureSchema);
  database.exec(migration83.sql);
  database.exec(migration84.sql);
  database.exec(migration85.sql);
  return database;
};

const kernel = new PlatformPolicyKernel({
  policyVersion: '33-g-family-emergency-repository-test-v1',
  signingKey: Buffer.from('33-g-family-emergency-controlled-test-key', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create','update','delete','record']
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
    receiptHash,
    record.receipt.receiptVersion,
    record.receipt.nonce,
    record.correlationId,
    record.resourceType,
    record.resourceId,
    record.action,
    record.capability,
    'family-emergency-write',
    85,
    JSON.stringify(record)
  );
  database.prepare(`
    INSERT INTO platform_policy_journal_projection_outbox(receipt_hash,record_json) VALUES(?,?)
  `).run(receiptHash, JSON.stringify(record));
};

interface PolicyOptions {
  readonly actorPersonId?:string;
  readonly accountId?:string;
  readonly roles?:readonly string[];
  readonly familyId?:string;
  readonly sensitivity?:'personal'|'highly_sensitive'|'sensitive';
  readonly clockAt?:string;
}

const executePolicy = async <T>(
  database:DatabaseSync,
  intent:Pick<PlatformPolicyIntent,'resourceId'|'action'|'capability'>,
  ownerPersonId:string,
  operation:(repository:SqliteLifeRepository, context:PolicyAuthorizedRepositoryExecutionContext) => RepositoryResult<T>,
  options:PolicyOptions = {}
):Promise<RepositoryResult<T>> => {
  const correlationId = asCorrelationId(`family-emergency-${++nonceSequence}`);
  const actorPersonId = options.actorPersonId ?? String(OWNER_ID);
  const accountId = asUserId(options.accountId ?? String(ACCOUNT_ID));
  const roles = options.roles ?? ['family_admin'];
  const familyId = asFamilyId(options.familyId ?? String(FAMILY_ID));
  const clockAt = options.clockAt ?? NOW;
  const pep = new PlatformPolicyEnforcementPoint({
    kernel,
    authorityResolver: {
      resolve: () => ({
        policyVersion: '33-g-family-emergency-repository-test-v1',
        accountId,
        personId: asPersonId(actorPersonId),
        deviceId: 'device-family-emergency',
        applicationId: 'windows-desktop',
        deviceTrusted: true,
        membershipActive: true,
        roles,
        familyIds: [familyId],
        grants: [{
          id: `grant-${correlationId}`,
          subjectAccountId: accountId,
          resourceType: 'life_record',
          resourceId: intent.resourceId,
          actions: [intent.action],
          effect: 'allow',
          startsAt: '2026-08-13T00:00:00.000Z'
        }],
        online: true,
        expiresAt: '2026-08-13T14:00:00.000Z'
      })
    },
    resourceResolver: {
      resolve: () => ({
        type: 'life_record',
        id: intent.resourceId,
        familyId,
        ownerPersonId: asPersonId(ownerPersonId),
        sensitivity: options.sensitivity ?? 'personal'
      })
    },
    receiptSink: { append: (record) => persistReceipt(database, record) },
    replayStore: { reserve: () => true },
    clock: () => clockAt,
    nonceFactory: () => `nonce-family-emergency-${nonceSequence}`
  });
  return pep.execute({
    correlationId,
    action: intent.action,
    capability: intent.capability,
    resourceType: 'life_record',
    resourceId: intent.resourceId,
    purpose: 'general'
  }, () => ({ writable: true, epoch: 85 }), (policyAuthorization) => operation(
    new SqliteLifeRepository(),
    {
      transaction: database as unknown as RepositoryTransaction,
      actor: {
        userId: accountId,
        roles,
        personId: asPersonId(actorPersonId)
      },
      correlationId,
      occurredAt: asIsoDateTime(clockAt),
      policyAuthorization
    }
  ));
};

const plan = (id = 'emergency-plan'):FamilyEmergencyLedgerItemRow => ({
  id,
  familyId: FAMILY_ID,
  ownerPersonId: OWNER_ID,
  itemType: 'emergency_plan',
  planKind: 'earthquake',
  title: 'Aile deprem planı',
  evacuationInstructions: 'Sarsıntı bitince ana çıkıştan ayrılın.',
  privacy: 'family',
  dataSource: 'manual',
  createdAt: asIsoDateTime(NOW)
});

const insertEmergency = async (
  database:DatabaseSync,
  row:FamilyEmergencyLedgerItemRow,
  options:PolicyOptions = {}
):Promise<RepositoryResult<void>> => {
  const create = row.itemType === 'emergency_plan' || row.itemType === 'member_status';
  return executePolicy(
    database,
    {
      resourceId: create ? row.id : row.planId,
      action: create ? 'create' : 'update',
      capability: 'family.write'
    },
    row.itemType === 'member_status' ? row.memberPersonId : row.ownerPersonId,
    (repository, context) => repository.insertFamilyEmergencyItem(context, row),
    { ...options, clockAt: options.clockAt ?? row.createdAt }
  );
};

describe('33-G family emergency migration and repository policy', () => {
  it('creates migration 85 exact append-only schema and policy lookup lifecycle', async () => {
    const database = openDatabase();
    expect(migration85.name).toBe('b5_family_emergency_planning_ledger');
    expect((database.prepare("PRAGMA table_info('family_emergency_ledger')").all() as Array<{ name:string }>)
      .map(({ name }) => name)).toEqual(expect.arrayContaining([
      'item_type','plan_id','parent_item_id','supersedes_item_id','phone_e164',
      'checklist_status','member_person_id','reported_by_person_id','occurred_at','policy_receipt_hash'
    ]));
    expect((database.prepare("PRAGMA index_list('family_emergency_ledger')").all() as Array<{ name:string }>)
      .map(({ name }) => name)).toEqual(expect.arrayContaining([
      'idx_family_emergency_family_created','idx_family_emergency_plan_created',
      'idx_family_emergency_checklist_status','idx_family_emergency_member_status'
    ]));
    expect(await insertEmergency(database, plan())).toEqual({ ok: true, value: undefined });
    const context = {
      transaction: database as unknown as RepositoryTransaction,
      actor: { userId: ACCOUNT_ID, roles: ['family_admin'], personId: OWNER_ID },
      correlationId: asCorrelationId('family-emergency-resolution'),
      occurredAt: asIsoDateTime(NOW)
    } satisfies RepositoryExecutionContext;
    const repository = new SqliteLifeRepository();
    expect(repository.findFamilyEmergencyPlanForPolicyResolution(context, 'emergency-plan')).toMatchObject({
      ok: true,
      value: { id: 'emergency-plan', itemType: 'emergency_plan', planKind: 'earthquake' }
    });
    database.prepare(`
      UPDATE data_lifecycle SET state='quarantined'
      WHERE resource_type='life_record' AND resource_id='emergency-plan'
    `).run();
    expect(repository.findFamilyEmergencyPlanForPolicyResolution(context, 'emergency-plan'))
      .toEqual({ ok: true, value: null });
  });

  it('persists root-bound children, exposes authorized offline phone and retains latest event history', async () => {
    const database = openDatabase();
    expect(await insertEmergency(database, plan())).toEqual({ ok: true, value: undefined });
    const common = {
      familyId: FAMILY_ID,
      ownerPersonId: OWNER_ID,
      planId: 'emergency-plan',
      privacy: 'family' as const,
      dataSource: 'manual' as const
    };
    expect(await insertEmergency(database, {
      ...common,
      id: 'meeting-primary', itemType: 'meeting_point', meetingPointKind: 'primary',
      label: 'Okul bahçesi', address: 'Merkez mahallesi 1',
      createdAt: asIsoDateTime('2026-08-13T12:01:00.000Z')
    })).toEqual({ ok: true, value: undefined });
    expect(await insertEmergency(database, {
      ...common,
      id: 'contact-out-of-area', itemType: 'external_contact', name: 'Şehir dışı irtibat',
      phoneE164: '+905551234567', city: 'Ankara',
      createdAt: asIsoDateTime('2026-08-13T12:02:00.000Z')
    })).toEqual({ ok: true, value: undefined });
    expect(await insertEmergency(database, {
      ...common,
      id: 'checklist-water', itemType: 'checklist_item', label: 'Suyu kapat', sortOrder: 1,
      createdAt: asIsoDateTime('2026-08-13T12:03:00.000Z')
    })).toEqual({ ok: true, value: undefined });
    expect(await insertEmergency(database, {
      ...common,
      id: 'checklist-water-open', itemType: 'checklist_status', checklistItemId: 'checklist-water',
      status: 'open', createdAt: asIsoDateTime('2026-08-13T12:04:00.000Z')
    })).toEqual({ ok: true, value: undefined });
    expect(await insertEmergency(database, {
      ...common,
      id: 'checklist-water-complete', itemType: 'checklist_status', checklistItemId: 'checklist-water',
      status: 'completed', createdAt: asIsoDateTime('2026-08-13T12:05:00.000Z')
    })).toEqual({ ok: true, value: undefined });
    expect(await insertEmergency(database, {
      ...common,
      id: 'member-safe', itemType: 'member_status', ownerPersonId: MEMBER_ID,
      memberPersonId: MEMBER_ID, reportedByPersonId: OWNER_ID, status: 'safe',
      occurredAt: asIsoDateTime(NOW),
      createdAt: asIsoDateTime(NOW)
    }, { roles: ['family_admin'] })).toEqual({ ok: true, value: undefined });

    const listed = await executePolicy(
      database,
      { resourceId: '*', action: 'read', capability: 'family.read' },
      OWNER_ID,
      (repository, context) => repository.listFamilyEmergencyItems(context)
    );
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value).toHaveLength(7);
      expect(listed.value.filter(({ itemType }) => itemType === 'checklist_status')).toHaveLength(2);
      expect(listed.value.find(({ itemType }) => itemType === 'external_contact')).toMatchObject({
        phoneE164: '+905551234567'
      });
      expect(listed.value.find(({ itemType }) => itemType === 'member_status')).toMatchObject({
        memberPersonId: MEMBER_ID, reportedByPersonId: OWNER_ID, status: 'safe'
      });
    }
    expect(() => database.prepare(
      "UPDATE family_emergency_ledger SET title='changed' WHERE id='emergency-plan'"
    ).run()).toThrow(/append-only/i);
    expect(() => database.prepare(
      "DELETE FROM family_emergency_ledger WHERE id='meeting-primary'"
    ).run()).toThrow(/governed deletion workflow/i);
  });

  it('rejects cross-scope roots, invalid parents/corrections, E.164, chronology and confused deputy writes', async () => {
    const database = openDatabase();
    database.exec(`
      INSERT INTO families(id) VALUES('family-emergency-other');
      INSERT INTO people(id,family_id,status)
      VALUES('person-emergency-other','family-emergency-other','active');
      INSERT INTO accounts(id,person_id,status)
      VALUES('account-emergency-other','person-emergency-other','active');
    `);
    expect(await insertEmergency(database, plan())).toEqual({ ok: true, value: undefined });
    expect(await insertEmergency(database, plan('emergency-plan-two'))).toEqual({ ok: true, value: undefined });
    expect(await insertEmergency(database, {
      ...plan('emergency-plan-other-family'),
      familyId: asFamilyId('family-emergency-other'),
      ownerPersonId: asPersonId('person-emergency-other')
    }, {
      familyId: 'family-emergency-other',
      actorPersonId: 'person-emergency-other',
      accountId: 'account-emergency-other'
    })).toEqual({ ok: true, value: undefined });
    const familyVisible = await executePolicy(
      database,
      { resourceId: '*', action: 'read', capability: 'family.read' },
      OWNER_ID,
      (repository, context) => repository.listFamilyEmergencyItems(context)
    );
    expect(familyVisible).toMatchObject({ ok: true });
    if (familyVisible.ok) {
      expect(familyVisible.value.map(({ id }) => id)).not.toContain('emergency-plan-other-family');
      expect(familyVisible.value.every(({ familyId }) => familyId === FAMILY_ID)).toBe(true);
    }
    database.prepare('UPDATE people SET status=? WHERE id=?').run('archived', OWNER_ID);
    expect((await insertEmergency(database, {
      familyId: FAMILY_ID, ownerPersonId: OWNER_ID, planId: 'emergency-plan',
      id: 'inactive-coordinator-child', itemType: 'meeting_point', meetingPointKind: 'primary',
      label: 'Koordinatör aktif değil', privacy: 'family', dataSource: 'manual',
      createdAt: asIsoDateTime('2026-08-13T12:01:00.000Z')
    })).ok).toBe(false);
    database.prepare('UPDATE people SET status=? WHERE id=?').run('active', OWNER_ID);
    const childCommon = {
      familyId: FAMILY_ID, ownerPersonId: OWNER_ID, planId: 'emergency-plan',
      privacy: 'family' as const, dataSource: 'manual' as const
    };
    expect((await insertEmergency(database, {
      ...childCommon, id: 'bad-phone', itemType: 'external_contact', name: 'İrtibat',
      phoneE164: '05551234567', city: 'Ankara', createdAt: asIsoDateTime('2026-08-13T12:01:00.000Z')
    })).ok).toBe(false);
    expect((await insertEmergency(database, {
      ...childCommon, ownerPersonId: MEMBER_ID, id: 'wrong-owner', itemType: 'meeting_point',
      meetingPointKind: 'primary', label: 'Yanlış sahip', createdAt: asIsoDateTime('2026-08-13T12:01:00.000Z')
    })).ok).toBe(false);
    expect(await insertEmergency(database, {
      ...childCommon, id: 'checklist-one', itemType: 'checklist_item', label: 'İlk madde', sortOrder: 1,
      createdAt: asIsoDateTime('2026-08-13T12:01:00.000Z')
    })).toEqual({ ok: true, value: undefined });
    expect((await insertEmergency(database, {
      ...childCommon, planId: 'emergency-plan-two', id: 'wrong-parent', itemType: 'checklist_status',
      checklistItemId: 'checklist-one', status: 'open', createdAt: asIsoDateTime('2026-08-13T12:02:00.000Z')
    })).ok).toBe(false);
    expect((await insertEmergency(database, {
      ...childCommon, id: 'wrong-type-correction', itemType: 'meeting_point',
      supersedesItemId: 'checklist-one', meetingPointKind: 'alternate', label: 'Yanlış düzeltme',
      createdAt: asIsoDateTime('2026-08-13T12:02:00.000Z')
    })).ok).toBe(false);
    expect((await insertEmergency(database, {
      ...childCommon, id: 'future-member-status', itemType: 'member_status', ownerPersonId: MEMBER_ID,
      memberPersonId: MEMBER_ID, reportedByPersonId: OWNER_ID, status: 'needs_help',
      occurredAt: asIsoDateTime('2026-08-13T12:01:00.000Z'), createdAt: asIsoDateTime(NOW)
    }, { roles: ['family_admin'] })).ok).toBe(false);
    await expect(insertEmergency(database, {
      ...childCommon, id: 'confused-deputy-status', itemType: 'member_status', ownerPersonId: MEMBER_ID,
      memberPersonId: MEMBER_ID, reportedByPersonId: MEMBER_ID, status: 'safe',
      occurredAt: asIsoDateTime(NOW), createdAt: asIsoDateTime(NOW)
    }, { roles: ['adult_member'] })).rejects.toThrow(/reporter must be the receipt subject/i);
  });

  it('rejects identity/receipt replay in both directions and protects exact durable source binding', async () => {
    const database = openDatabase();
    expect(await insertEmergency(database, plan())).toEqual({ ok: true, value: undefined });
    const receipt = database.prepare(`
      SELECT policy_receipt_hash FROM family_emergency_ledger WHERE id='emergency-plan'
    `).get() as { policy_receipt_hash:string };
    expect(receipt.policy_receipt_hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(() => database.prepare(`
      INSERT INTO life_records(
        id,family_id,owner_person_id,category,title,status,privacy,created_at,
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
        policy_correlation_id,policy_resource_type,policy_resource_id,policy_action,policy_capability
      ) SELECT 'life-replay',family_id,owner_person_id,'task','Replay','active','family',created_at,
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
        policy_correlation_id,policy_resource_type,policy_resource_id,policy_action,policy_capability
      FROM family_emergency_ledger WHERE id='emergency-plan'
    `).run()).toThrow(/already bound to a family emergency item/i);
    expect(() => database.prepare(`
      INSERT INTO life_records(
        id,family_id,owner_person_id,category,title,status,privacy,created_at
      ) VALUES('emergency-plan',?,?, 'task','Collision','active','family',?)
    `).run(FAMILY_ID, OWNER_ID, NOW)).toThrow(/collides with a family emergency item/i);

    expect(await insertEmergency(database, {
      id: 'contact-replay-source', familyId: FAMILY_ID, ownerPersonId: OWNER_ID,
      itemType: 'external_contact', planId: 'emergency-plan', name: 'İrtibat',
      phoneE164: '+905551234567', city: 'Ankara', privacy: 'family', dataSource: 'manual',
      createdAt: asIsoDateTime('2026-08-13T12:01:00.000Z')
    })).toEqual({ ok: true, value: undefined });
    expect(() => database.prepare(`
      INSERT INTO finance_import_batches(id,policy_receipt_hash)
      SELECT 'import-replay',policy_receipt_hash
      FROM family_emergency_ledger WHERE id='contact-replay-source'
    `).run()).toThrow(/already bound to a family emergency item/i);
    database.prepare("INSERT INTO health_records(id,policy_receipt_hash) VALUES('health-replay',NULL)").run();
    expect(() => database.prepare(`
      UPDATE health_records
      SET policy_receipt_hash=(
        SELECT policy_receipt_hash FROM family_emergency_ledger WHERE id='contact-replay-source'
      )
      WHERE id='health-replay'
    `).run()).toThrow(/already bound to a family emergency item/i);
  });
});
