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
  ManagedLifeLedgerItemRow,
  ManagedHomeInventoryLedgerItemRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteLifeRepository } from './src/life-repository.js';
import { computePlatformPolicyReceiptHash } from './src/platform-policy-transaction-repository.js';

const NOW = '2026-08-12T12:00:00.000Z';
const FAMILY_ID = asFamilyId('family-managed-life');
const PERSON_ID = asPersonId('person-managed-life');
const ACCOUNT_ID = asUserId('account-managed-life');
const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

const fixtureSchema = `
  PRAGMA foreign_keys=ON;
  CREATE TABLE families(id TEXT PRIMARY KEY);
  CREATE TABLE people(id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id));
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
  CREATE TABLE platform_policy_journal_projection_outbox(receipt_hash TEXT PRIMARY KEY);
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
    amount REAL,currency TEXT,occurred_at TEXT,created_at TEXT NOT NULL,
    policy_receipt_hash TEXT
  );
  CREATE TABLE archive_versions(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE archive_retention_policies(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE archive_categories(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE archive_tags(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE archive_item_tags(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE events(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
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
  INSERT INTO people VALUES('${PERSON_ID}','${FAMILY_ID}');
  INSERT INTO people VALUES('person-managed-other','${FAMILY_ID}');
  INSERT INTO database_metadata VALUES('schema_generation','before-33-e','${NOW}');
  INSERT INTO platform_policy_database_fences VALUES('managed-life-write',83,1);
`;

const migration83 = FAMILY_DATABASE_MIGRATIONS.find(({ version }) => version === 83);
if (!migration83) throw new Error('MIGRATION_83_NOT_FOUND');
const migration84 = FAMILY_DATABASE_MIGRATIONS.find(({ version }) => version === 84);
if (!migration84) throw new Error('MIGRATION_84_NOT_FOUND');

const openFixture = (): DatabaseSync => {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  database.exec(fixtureSchema);
  database.exec(migration83.sql);
  database.exec(migration84.sql);
  return database;
};

const policyKernel = new PlatformPolicyKernel({
  policyVersion: '33-e-managed-life-repository-test-v1',
  signingKey: Buffer.from('33-e-managed-life-repository-controlled-test-key', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

let nonceSequence = 0;

const persistReceipt = (database: DatabaseSync, record: PlatformPolicyReceiptRecord): void => {
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
    'managed-life-write',
    83,
    JSON.stringify(record)
  );
  database.prepare('INSERT INTO platform_policy_journal_projection_outbox VALUES(?)').run(receiptHash);
};

const executePolicy = async <T>(
  database: DatabaseSync,
  intent: Pick<PlatformPolicyIntent, 'resourceId' | 'action' | 'capability'>,
  ownerPersonId: string,
  operation: (
    repository: SqliteLifeRepository,
    context: PolicyAuthorizedRepositoryExecutionContext
  ) => RepositoryResult<T>
): Promise<RepositoryResult<T>> => {
  const correlationId = asCorrelationId(`managed-life-${++nonceSequence}`);
  const pep = new PlatformPolicyEnforcementPoint({
    kernel: policyKernel,
    authorityResolver: {
      resolve: () => ({
        policyVersion: '33-e-managed-life-repository-test-v1',
        accountId: ACCOUNT_ID,
        personId: PERSON_ID,
        deviceId: 'device-managed-life',
        applicationId: 'windows-desktop',
        deviceTrusted: true,
        membershipActive: true,
        roles: ['adult_member'],
        familyIds: [FAMILY_ID],
        grants: [{
          id: `grant-${correlationId}`,
          subjectAccountId: ACCOUNT_ID,
          resourceType: 'life_record',
          resourceId: intent.resourceId,
          actions: [intent.action],
          effect: 'allow',
          startsAt: '2026-08-12T00:00:00.000Z'
        }],
        online: true,
        expiresAt: '2026-08-12T13:00:00.000Z'
      })
    },
    resourceResolver: {
      resolve: () => ({
        type: 'life_record',
        id: intent.resourceId,
        familyId: FAMILY_ID,
        ownerPersonId,
        sensitivity: 'highly_sensitive'
      })
    },
    receiptSink: { append: (record) => persistReceipt(database, record) },
    replayStore: { reserve: () => true },
    clock: () => NOW,
    nonceFactory: () => `nonce-managed-life-${nonceSequence}`
  });
  return pep.execute({
    correlationId,
    action: intent.action,
    capability: intent.capability,
    resourceType: 'life_record',
    resourceId: intent.resourceId,
    purpose: 'general'
  }, () => ({ writable: true, epoch: 83 }), (policyAuthorization) => operation(
    new SqliteLifeRepository(),
    {
      transaction: database as unknown as RepositoryTransaction,
      actor: {
        userId: ACCOUNT_ID,
        roles: ['adult_member'],
        personId: PERSON_ID
      },
      correlationId,
      occurredAt: asIsoDateTime(NOW),
      policyAuthorization
    }
  ));
};

const common = {
  familyId: FAMILY_ID,
  ownerPersonId: PERSON_ID,
  privacy: 'private' as const,
  dataSource: 'manual' as const,
  externalVerification: 'not_performed' as const,
  paymentExecution: 'not_performed' as const,
  createdAt: asIsoDateTime(NOW)
};

const insertItem = async (
  database: DatabaseSync,
  row: ManagedLifeLedgerItemRow
): Promise<RepositoryResult<void>> => executePolicy(
  database,
  {
    resourceId: row.itemType === 'profile' ? row.id : row.recordId,
    action: row.itemType === 'profile' ? 'create' : 'update',
    capability: 'family.write'
  },
  row.ownerPersonId,
  (repository, context) => repository.insertManagedLifeItem(context, row)
);

const insertHomeInventoryItem = async (
  database: DatabaseSync,
  row: ManagedHomeInventoryLedgerItemRow
): Promise<RepositoryResult<void>> => executePolicy(
  database,
  { resourceId: row.recordId, action: 'update', capability: 'family.write' },
  row.ownerPersonId,
  (repository, context) => repository.insertManagedHomeInventoryItem(context, row)
);

describe('33-E managed LIFE repository and migration policy', () => {
  it('creates migration 83 metadata, exact indexes and immutable single-ledger shape', () => {
    const database = openFixture();
    expect(migration83.name).toBe('b5_life_home_vehicle_managed_ledger');
    expect(database.prepare(
      "SELECT value FROM database_metadata WHERE key='schema_generation'"
    ).get()).toEqual({ value: 'REVISION-33-F-HOME-INVENTORY-UTILITY-BELONGINGS' });
    expect((database.prepare("PRAGMA table_info('life_managed_ledger')").all() as Array<{ name: string }>)
      .map(({ name }) => name)).toEqual(expect.arrayContaining([
      'item_type', 'parent_record_id', 'details_json', 'reminder_mutation',
      'next_reminder_at', 'data_source', 'external_verification', 'payment_execution',
      'amount_minor', 'quantity_milliunits', 'odometer_km', 'archive_item_id',
      'finance_asset_id', 'finance_expense_id', 'policy_receipt_hash'
    ]));
    expect((database.prepare("PRAGMA index_list('life_managed_ledger')").all() as Array<{ name: string }>)
      .map(({ name }) => name)).toEqual(expect.arrayContaining([
      'idx_life_managed_family_created',
      'idx_life_managed_parent_created',
      'idx_life_managed_reminder_due',
      'idx_life_managed_archive_item'
    ]));
  });

  it('persists and reads exact profile, latest reminder, activity and document projections', async () => {
    const database = openFixture();
    database.prepare(`
      INSERT INTO finance_planning_ledger(
        id,item_type,asset_class,category_kind,family_id,owner_person_id,privacy,
        amount,currency,occurred_at,created_at
      ) VALUES('asset-home','asset','real_estate',NULL,?,?,?,NULL,'TRY',NULL,?)
    `).run(FAMILY_ID, PERSON_ID, 'private', '2026-08-12T11:00:00.000Z');
    database.prepare(`
      INSERT INTO archive_items(id,family_id,destroyed_at,sensitivity,created_at)
      VALUES('archive-lease',?,NULL,'high','2026-08-12T11:30:00.000Z')
    `).run(FAMILY_ID);

    expect(await insertItem(database, {
      ...common,
      id: 'home-profile',
      itemType: 'profile',
      category: 'home',
      title: 'Aile evi',
      status: 'active',
      details: { tenure: 'owner', propertyType: 'residence', addressLabel: 'Merkez ev' },
      initialReminder: { kind: 'insurance', dueAt: asIsoDateTime('2026-08-20T09:00:00.000Z') },
      financeAssetId: 'asset-home'
    })).toEqual({ ok: true, value: undefined });
    expect(await insertItem(database, {
      ...common,
      id: 'home-reminder-update',
      itemType: 'activity',
      recordId: 'home-profile',
      activityKind: 'maintenance',
      occurredAt: asIsoDateTime('2026-08-12T11:45:00.000Z'),
      amountMinor: 125000,
      currency: 'TRY',
      financePosting: 'not_performed',
      reminderMutation: {
        action: 'set',
        kind: 'maintenance',
        dueAt: asIsoDateTime('2026-08-15T09:00:00.000Z')
      }
    })).toEqual({ ok: true, value: undefined });
    expect(await insertItem(database, {
      ...common,
      id: 'home-lease-document',
      itemType: 'document',
      recordId: 'home-profile',
      archiveItemId: 'archive-lease',
      documentKind: 'lease',
      label: 'Kira sözleşmesi'
    })).toEqual({ ok: true, value: undefined });

    const listed = await executePolicy(
      database,
      { resourceId: '*', action: 'read', capability: 'family.read' },
      PERSON_ID,
      (repository, context) => repository.listManagedLifeItems(context)
    );
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value).toHaveLength(3);
      expect(listed.value.find(({ id }) => id === 'home-profile')).toMatchObject({
        itemType: 'profile',
        category: 'home',
        financeAssetId: 'asset-home',
        dataSource: 'manual',
        externalVerification: 'not_performed'
      });
      expect(listed.value.find(({ id }) => id === 'home-reminder-update')).toMatchObject({
        itemType: 'activity',
        financePosting: 'not_performed',
        amountMinor: 125000
      });
    }
    const due = await executePolicy(
      database,
      { resourceId: '*', action: 'read', capability: 'family.read' },
      PERSON_ID,
      (repository, context) => repository.listAutomationDueLife(context, {
        fromAt: asIsoDateTime('2026-08-13T00:00:00.000Z'),
        toAt: asIsoDateTime('2026-08-16T00:00:00.000Z')
      })
    );
    expect(due).toEqual({
      ok: true,
      value: [{ id: 'home-reminder-update', title: 'Aile evi', dueAt: '2026-08-15T09:00:00.000Z' }]
    });
    const sources = await executePolicy(
      database,
      { resourceId: '*', action: 'read', capability: 'family.read' },
      PERSON_ID,
      (repository, context) => repository.listVisibleAutomationLifeRunSources(
        context,
        ['home-profile', 'home-reminder-update']
      )
    );
    expect(sources).toEqual({
      ok: true,
      value: [{ id: 'home-reminder-update', title: 'Aile evi', dueAt: '2026-08-15T09:00:00.000Z' }]
    });
  });

  it('enforces category, parent, archive, finance, canonical scalar and append-only constraints', async () => {
    const database = openFixture();
    database.prepare(`
      INSERT INTO finance_planning_ledger(
        id,item_type,asset_class,category_kind,family_id,owner_person_id,privacy,
        amount,currency,occurred_at,created_at
      ) VALUES('asset-vehicle','asset','vehicle',NULL,?,?,?,NULL,'TRY',NULL,?)
    `).run(FAMILY_ID, PERSON_ID, 'private', '2026-08-12T11:00:00.000Z');
    const wrongAsset = await insertItem(database, {
      ...common,
      id: 'invalid-home-profile',
      itemType: 'profile',
      category: 'home',
      title: 'Hatalı ev',
      status: 'active',
      details: { tenure: 'owner', propertyType: 'residence', addressLabel: 'Ev' },
      financeAssetId: 'asset-vehicle'
    });
    expect(wrongAsset.ok).toBe(false);
    expect(database.prepare("SELECT COUNT(*) AS total FROM life_managed_ledger WHERE id='invalid-home-profile'").get())
      .toEqual({ total: 0 });

    expect(await insertItem(database, {
      ...common,
      id: 'vehicle-profile',
      itemType: 'profile',
      category: 'vehicle',
      title: 'Aile aracı',
      status: 'active',
      details: { vehicleType: 'car', energyType: 'fuel', plate: '34 TEST 34' },
      financeAssetId: 'asset-vehicle'
    })).toEqual({ ok: true, value: undefined });
    const fractionalFuel = await insertItem(database, {
      ...common,
      id: 'fractional-fuel',
      itemType: 'activity',
      recordId: 'vehicle-profile',
      activityKind: 'fuel',
      occurredAt: asIsoDateTime('2026-08-12T11:45:00.000Z'),
      amountMinor: 25000,
      currency: 'TRY',
      quantityMilliunits: 12500.5,
      odometerKm: 12000,
      financePosting: 'not_performed'
    });
    expect(fractionalFuel.ok).toBe(false);
    const nonCanonicalDate = await insertItem(database, {
      ...common,
      id: 'non-canonical-maintenance',
      itemType: 'activity',
      recordId: 'vehicle-profile',
      activityKind: 'maintenance',
      occurredAt: asIsoDateTime('2026-08-12T11:45:00Z'),
      financePosting: 'not_performed'
    });
    expect(nonCanonicalDate.ok).toBe(false);
    const wrongDocument = await insertItem(database, {
      ...common,
      id: 'wrong-document-category',
      itemType: 'document',
      recordId: 'vehicle-profile',
      archiveItemId: 'missing-archive',
      documentKind: 'deed'
    });
    expect(wrongDocument.ok).toBe(false);
    expect(() => database.prepare(
      "UPDATE life_managed_ledger SET title='değiştirilemez' WHERE id='vehicle-profile'"
    ).run()).toThrow(/append-only/i);
    expect(() => database.prepare(
      "DELETE FROM life_managed_ledger WHERE id='vehicle-profile'"
    ).run()).toThrow(/governed deletion workflow/i);
  });

  it('prevents legacy id and receipt reuse and resolves policy profiles without bypassing lifecycle', async () => {
    const database = openFixture();
    database.prepare(`
      INSERT INTO life_records(
        id,family_id,owner_person_id,category,title,status,privacy,created_at
      ) VALUES('legacy-collision',?,?,'task','Legacy','active','private',?)
    `).run(FAMILY_ID, PERSON_ID, NOW);
    const idCollision = await insertItem(database, {
      ...common,
      id: 'legacy-collision',
      itemType: 'profile',
      category: 'insurance',
      title: 'Çakışan poliçe',
      status: 'active',
      details: { insuranceKind: 'other', provider: 'Sağlayıcı' }
    });
    expect(idCollision.ok).toBe(false);
    expect(database.prepare("SELECT COUNT(*) AS total FROM life_managed_ledger WHERE id='legacy-collision'").get())
      .toEqual({ total: 0 });

    expect(await insertItem(database, {
      ...common,
      id: 'policy-profile',
      itemType: 'profile',
      category: 'insurance',
      title: 'Poliçe',
      status: 'active',
      details: { insuranceKind: 'other', provider: 'Sağlayıcı' }
    })).toEqual({ ok: true, value: undefined });
    const receipt = database.prepare(
      "SELECT policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,policy_resource_type,policy_resource_id,policy_action,policy_capability FROM life_managed_ledger WHERE id='policy-profile'"
    ).get() as Record<string, unknown>;
    expect(() => database.prepare(`
      INSERT INTO life_records(
        id,family_id,owner_person_id,category,title,status,privacy,created_at,
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
        policy_correlation_id,policy_resource_type,policy_resource_id,
        policy_action,policy_capability
      ) VALUES('reused-receipt',?,?,'task','Reuse','active','private',?,?,?,?,?,?,?,?,?)
    `).run(
      FAMILY_ID,
      PERSON_ID,
      NOW,
      receipt.policy_receipt_hash,
      receipt.policy_receipt_version,
      receipt.policy_receipt_nonce,
      receipt.policy_correlation_id,
      receipt.policy_resource_type,
      receipt.policy_resource_id,
      receipt.policy_action,
      receipt.policy_capability
    )).toThrow(/already bound to a managed life item/i);

    const ordinaryContext = {
      transaction: database as unknown as RepositoryTransaction,
      actor: { userId: ACCOUNT_ID, roles: ['adult_member'], personId: PERSON_ID },
      correlationId: asCorrelationId('managed-policy-resolution'),
      occurredAt: asIsoDateTime(NOW)
    } satisfies RepositoryExecutionContext;
    const repository = new SqliteLifeRepository();
    expect(repository.findManagedLifeProfileForPolicyResolution(ordinaryContext, 'policy-profile')).toMatchObject({
      ok: true,
      value: { id: 'policy-profile', itemType: 'profile' }
    });
    database.prepare(`
      UPDATE data_lifecycle SET state='quarantined'
      WHERE resource_type='life_record' AND resource_id='policy-profile'
    `).run();
    expect(repository.findManagedLifeProfileForPolicyResolution(ordinaryContext, 'policy-profile')).toEqual({
      ok: true,
      value: null
    });
  });
});

describe('33-F managed home inventory repository and migration policy', () => {
  const homeProfile = {
    ...common,
    id: 'inventory-home-profile',
    itemType: 'profile' as const,
    category: 'home' as const,
    title: 'Envanter evi',
    status: 'active' as const,
    details: { tenure: 'owner' as const, propertyType: 'residence' as const, addressLabel: 'Ev' }
  };

  it('persists family-scoped room, meter, reset and masked belonging projections', async () => {
    const database = openFixture();
    expect(migration84.name).toBe('b5_life_home_inventory_ledger');
    expect(await insertItem(database, homeProfile)).toEqual({ ok: true, value: undefined });
    expect(await insertHomeInventoryItem(database, {
      ...common,
      id: 'room-kitchen', recordId: homeProfile.id, itemType: 'room',
      name: 'Mutfak', roomKind: 'kitchen'
    })).toEqual({ ok: true, value: undefined });
    expect(await insertHomeInventoryItem(database, {
      ...common,
      id: 'meter-water', recordId: homeProfile.id, itemType: 'meter',
      roomId: 'room-kitchen', label: 'Su sayacı', meterKind: 'water', readingUnit: 'milliliter'
    })).toEqual({ ok: true, value: undefined });
    expect(await insertHomeInventoryItem(database, {
      ...common,
      id: 'reading-water-1', recordId: homeProfile.id, itemType: 'meter_reading',
      meterId: 'meter-water', readingKind: 'reading', readingMilliunits: 15000,
      recordedAt: asIsoDateTime('2026-08-12T11:00:00.000Z')
    })).toEqual({ ok: true, value: undefined });
    expect(await insertHomeInventoryItem(database, {
      ...common,
      id: 'reading-water-reset', recordId: homeProfile.id, itemType: 'meter_reading',
      meterId: 'meter-water', readingKind: 'reset', readingMilliunits: 25,
      recordedAt: asIsoDateTime('2026-08-12T11:30:00.000Z'), note: 'Sayaç değiştirildi'
    })).toEqual({ ok: true, value: undefined });
    expect(await insertHomeInventoryItem(database, {
      ...common,
      id: 'belonging-fridge', recordId: homeProfile.id, itemType: 'belonging',
      roomId: 'room-kitchen', name: 'Buzdolabı', belongingKind: 'appliance',
      serialNumber: 'SERIAL-12345678', financePosting: 'not_performed'
    })).toEqual({ ok: true, value: undefined });

    const listed = await executePolicy(
      database,
      { resourceId: '*', action: 'read', capability: 'family.read' },
      PERSON_ID,
      (repository, context) => repository.listManagedHomeInventoryItems(context)
    );
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.find(({ id }) => id === 'belonging-fridge')).toMatchObject({
        serialNumberMasked: '***********5678', financePosting: 'not_performed'
      });
      expect(listed.value.find(({ id }) => id === 'belonging-fridge')).not.toHaveProperty('serialNumber');
    }
    const latest = await executePolicy(
      database,
      { resourceId: homeProfile.id, action: 'update', capability: 'family.write' },
      PERSON_ID,
      (repository, context) => repository.findLatestManagedHomeMeterReading(
        context, homeProfile.id, 'meter-water'
      )
    );
    expect(latest).toMatchObject({ ok: true, value: { id: 'reading-water-reset', readingMilliunits: 25 } });
  });

  it('rejects decreasing normal readings, incompatible parents, receipt reuse and mutation', async () => {
    const database = openFixture();
    expect(await insertItem(database, homeProfile)).toEqual({ ok: true, value: undefined });
    expect(await insertHomeInventoryItem(database, {
      ...common,
      id: 'room-living', recordId: homeProfile.id, itemType: 'room',
      name: 'Salon', roomKind: 'living_room'
    })).toEqual({ ok: true, value: undefined });
    expect(await insertHomeInventoryItem(database, {
      ...common,
      id: 'meter-electric', recordId: homeProfile.id, itemType: 'meter',
      roomId: 'room-living', label: 'Elektrik', meterKind: 'electricity', readingUnit: 'wh'
    })).toEqual({ ok: true, value: undefined });
    expect(await insertHomeInventoryItem(database, {
      ...common,
      id: 'reading-electric-1', recordId: homeProfile.id, itemType: 'meter_reading',
      meterId: 'meter-electric', readingKind: 'reading', readingMilliunits: 100,
      recordedAt: asIsoDateTime('2026-08-12T11:00:00.000Z')
    })).toEqual({ ok: true, value: undefined });
    expect((await insertHomeInventoryItem(database, {
      ...common,
      id: 'reading-electric-lower', recordId: homeProfile.id, itemType: 'meter_reading',
      meterId: 'meter-electric', readingKind: 'reading', readingMilliunits: 99,
      recordedAt: asIsoDateTime('2026-08-12T11:30:00.000Z')
    })).ok).toBe(false);
    expect((await insertHomeInventoryItem(database, {
      ...common,
      id: 'bad-warranty', recordId: homeProfile.id, itemType: 'warranty',
      belongingId: 'meter-electric', startsAt: asIsoDateTime('2026-08-01T00:00:00.000Z'),
      endsAt: asIsoDateTime('2027-08-01T00:00:00.000Z')
    })).ok).toBe(false);
    expect(() => database.prepare(
      "UPDATE life_home_inventory_ledger SET name='changed' WHERE id='room-living'"
    ).run()).toThrow(/append-only/i);
    expect(() => database.prepare(
      "DELETE FROM life_home_inventory_ledger WHERE id='room-living'"
    ).run()).toThrow(/governed deletion workflow/i);

    const receipt = database.prepare(
      "SELECT policy_receipt_hash FROM life_home_inventory_ledger WHERE id='room-living'"
    ).get() as { policy_receipt_hash: string };
    expect(() => database.prepare(`
      INSERT INTO life_records(
        id,family_id,owner_person_id,category,title,status,privacy,created_at,
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
        policy_correlation_id,policy_resource_type,policy_resource_id,policy_action,policy_capability
      ) SELECT 'receipt-reuse',family_id,owner_person_id,'task','Reuse','active',privacy,created_at,
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,
        policy_resource_type,policy_resource_id,policy_action,policy_capability
      FROM life_home_inventory_ledger WHERE id='room-living'
    `).run()).toThrow(/already bound to a home inventory item/i);
    expect(receipt.policy_receipt_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects cross-family owner privacy roots, wrong targets and invalid supersessions', async () => {
    const database = openFixture();
    database.exec(`
      INSERT INTO families VALUES('family-managed-other');
      INSERT INTO people VALUES('person-other-family','family-managed-other');
    `);
    expect(await insertItem(database, homeProfile)).toEqual({ ok: true, value: undefined });
    expect(await insertItem(database, { ...homeProfile, id: 'inventory-home-profile-2' }))
      .toEqual({ ok: true, value: undefined });

    await expect(insertHomeInventoryItem(database, {
      ...common,
      familyId: asFamilyId('family-managed-other'),
      ownerPersonId: asPersonId('person-other-family'),
      id: 'cross-family-room', recordId: homeProfile.id, itemType: 'room',
      name: 'Başka aile', roomKind: 'other'
    })).rejects.toThrow(/does not match the repository operation/i);
    expect((await insertHomeInventoryItem(database, {
      ...common,
      ownerPersonId: asPersonId('person-managed-other'),
      id: 'cross-owner-room', recordId: homeProfile.id, itemType: 'room',
      name: 'Başka sahip', roomKind: 'other'
    })).ok).toBe(false);
    expect((await insertHomeInventoryItem(database, {
      ...common,
      privacy: 'family',
      id: 'cross-privacy-room', recordId: homeProfile.id, itemType: 'room',
      name: 'Başka gizlilik', roomKind: 'other'
    })).ok).toBe(false);

    expect(await insertHomeInventoryItem(database, {
      ...common,
      id: 'root-one-room', recordId: homeProfile.id, itemType: 'room',
      name: 'Birinci oda', roomKind: 'living_room'
    })).toEqual({ ok: true, value: undefined });
    expect(await insertHomeInventoryItem(database, {
      ...common,
      id: 'root-two-room', recordId: 'inventory-home-profile-2', itemType: 'room',
      name: 'İkinci oda', roomKind: 'bedroom'
    })).toEqual({ ok: true, value: undefined });
    expect(await insertHomeInventoryItem(database, {
      ...common,
      id: 'root-one-meter', recordId: homeProfile.id, itemType: 'meter',
      roomId: 'root-one-room', label: 'Elektrik', meterKind: 'electricity', readingUnit: 'wh'
    })).toEqual({ ok: true, value: undefined });

    expect((await insertHomeInventoryItem(database, {
      ...common,
      id: 'wrong-root-service', recordId: homeProfile.id, itemType: 'service',
      targetItemId: 'root-two-room', targetType: 'room', serviceKind: 'maintenance',
      occurredAt: asIsoDateTime('2026-08-12T11:30:00.000Z'), financePosting: 'not_performed'
    })).ok).toBe(false);
    expect((await insertHomeInventoryItem(database, {
      ...common,
      id: 'wrong-target-type-service', recordId: homeProfile.id, itemType: 'service',
      targetItemId: 'root-one-room', targetType: 'meter', serviceKind: 'maintenance',
      occurredAt: asIsoDateTime('2026-08-12T11:30:00.000Z'), financePosting: 'not_performed'
    })).ok).toBe(false);
    expect((await insertHomeInventoryItem(database, {
      ...common,
      createdAt: asIsoDateTime('2026-08-12T12:01:00.000Z'),
      id: 'wrong-root-supersession', recordId: 'inventory-home-profile-2', itemType: 'room',
      supersedesItemId: 'root-one-room', name: 'Yanlış kök', roomKind: 'other'
    })).ok).toBe(false);
    expect((await insertHomeInventoryItem(database, {
      ...common,
      createdAt: asIsoDateTime('2026-08-12T12:01:00.000Z'),
      id: 'wrong-type-supersession', recordId: homeProfile.id, itemType: 'room',
      supersedesItemId: 'root-one-meter', name: 'Yanlış tür', roomKind: 'other'
    })).ok).toBe(false);
    expect((await insertHomeInventoryItem(database, {
      ...common,
      id: 'non-chronological-supersession', recordId: homeProfile.id, itemType: 'room',
      supersedesItemId: 'root-one-room', name: 'Aynı an', roomKind: 'other'
    })).ok).toBe(false);
  });

  it('rejects archive and finance scope drift, invalid scalars, id collisions and reverse receipt reuse', async () => {
    const database = openFixture();
    expect(await insertItem(database, homeProfile)).toEqual({ ok: true, value: undefined });
    expect(await insertHomeInventoryItem(database, {
      ...common,
      id: 'scope-room', recordId: homeProfile.id, itemType: 'room',
      name: 'Depo', roomKind: 'storage'
    })).toEqual({ ok: true, value: undefined });
    expect(await insertHomeInventoryItem(database, {
      ...common,
      id: 'scope-meter', recordId: homeProfile.id, itemType: 'meter',
      roomId: 'scope-room', label: 'Su', meterKind: 'water', readingUnit: 'milliliter'
    })).toEqual({ ok: true, value: undefined });
    expect(await insertHomeInventoryItem(database, {
      ...common,
      id: 'scope-belonging', recordId: homeProfile.id, itemType: 'belonging',
      roomId: 'scope-room', name: 'Alet', belongingKind: 'tool', financePosting: 'not_performed'
    })).toEqual({ ok: true, value: undefined });

    database.exec(`
      INSERT INTO archive_items VALUES('archive-wrong-family','other-family',NULL,'high','2026-08-12T11:00:00.000Z',NULL);
      INSERT INTO archive_items VALUES('archive-wrong-sensitivity','${FAMILY_ID}',NULL,'standard','2026-08-12T11:00:00.000Z',NULL);
      INSERT INTO archive_items VALUES('archive-destroyed','${FAMILY_ID}','2026-08-12T11:30:00.000Z','high','2026-08-12T11:00:00.000Z',NULL);
      INSERT INTO finance_planning_ledger VALUES('expense-wrong-family','cash_flow',NULL,'expense','other-family','${PERSON_ID}','private',1,'TRY','2026-08-12T11:00:00.000Z','2026-08-12T11:00:00.000Z',NULL);
      INSERT INTO finance_planning_ledger VALUES('expense-wrong-owner','cash_flow',NULL,'expense','${FAMILY_ID}','person-managed-other','private',1,'TRY','2026-08-12T11:00:00.000Z','2026-08-12T11:00:00.000Z',NULL);
      INSERT INTO finance_planning_ledger VALUES('expense-wrong-privacy','cash_flow',NULL,'expense','${FAMILY_ID}','${PERSON_ID}','family',1,'TRY','2026-08-12T11:00:00.000Z','2026-08-12T11:00:00.000Z',NULL);
      INSERT INTO finance_planning_ledger VALUES('expense-wrong-type','asset','real_estate',NULL,'${FAMILY_ID}','${PERSON_ID}','private',1,'TRY','2026-08-12T11:00:00.000Z','2026-08-12T11:00:00.000Z',NULL);
    `);
    for (const archiveItemId of ['archive-wrong-family', 'archive-wrong-sensitivity', 'archive-destroyed']) {
      expect((await insertHomeInventoryItem(database, {
        ...common,
        id: `document-${archiveItemId}`, recordId: homeProfile.id, itemType: 'document',
        targetItemId: 'scope-belonging', targetType: 'belonging', archiveItemId,
        documentKind: 'invoice'
      })).ok).toBe(false);
    }
    for (const financeExpenseId of [
      'expense-wrong-family', 'expense-wrong-owner', 'expense-wrong-privacy', 'expense-wrong-type'
    ]) {
      expect((await insertHomeInventoryItem(database, {
        ...common,
        id: `belonging-${financeExpenseId}`, recordId: homeProfile.id, itemType: 'belonging',
        roomId: 'scope-room', name: 'Finans kapsamı', belongingKind: 'other',
        financeExpenseId, financePosting: 'linked'
      })).ok).toBe(false);
    }

    expect((await insertHomeInventoryItem(database, {
      ...common,
      id: 'invalid-calendar-room', recordId: homeProfile.id, itemType: 'room',
      name: 'Takvim', roomKind: 'other', createdAt: asIsoDateTime('2026-02-30T12:00:00.000Z')
    })).ok).toBe(false);
    for (const readingMilliunits of [1.5, 9000000000000001]) {
      expect((await insertHomeInventoryItem(database, {
        ...common,
        id: `invalid-reading-${readingMilliunits}`, recordId: homeProfile.id, itemType: 'meter_reading',
        meterId: 'scope-meter', readingKind: 'reading', readingMilliunits,
        recordedAt: asIsoDateTime('2026-08-12T11:45:00.000Z')
      })).ok).toBe(false);
    }
    expect((await insertHomeInventoryItem(database, {
      ...common,
      id: homeProfile.id, recordId: homeProfile.id, itemType: 'room',
      name: 'Kimlik çakışması', roomKind: 'other'
    })).ok).toBe(false);

    expect(await insertItem(database, {
      ...common,
      id: 'managed-update-receipt', itemType: 'activity', recordId: homeProfile.id,
      activityKind: 'maintenance', occurredAt: asIsoDateTime('2026-08-12T11:30:00.000Z'),
      financePosting: 'not_performed'
    })).toEqual({ ok: true, value: undefined });
    expect(() => database.prepare(`
      INSERT INTO life_home_inventory_ledger(
        id,home_profile_id,family_id,owner_person_id,item_type,name,room_kind,privacy,
        data_source,external_verification,payment_execution,created_at,
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
        policy_correlation_id,policy_resource_type,policy_resource_id,policy_action,policy_capability
      ) SELECT 'reverse-receipt-reuse',parent_record_id,family_id,owner_person_id,'room','Reuse','other',privacy,
        'manual','not_performed','not_performed',created_at,
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
        policy_correlation_id,policy_resource_type,policy_resource_id,policy_action,policy_capability
      FROM life_managed_ledger WHERE id='managed-update-receipt'
    `).run()).toThrow(/unused exact durable life update receipt/i);
  });
});
