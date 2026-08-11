import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId, asUserId } from '@ppt/core';
import type { RepositoryTransaction } from '@ppt/contracts';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel
} from '@ppt/platform-policy';
import type {
  LifeRecordRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext
} from '@ppt/repository-contracts';
import { SqliteLifeRepository } from './src/life-repository.js';

const NOW = '2026-08-08T03:00:00.000Z';
const FAMILY_ID = 'family-life-a';
const ACCOUNT_ID = 'account-life-reader';
const PERSON_ID = 'person-life-reader';
const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

const repositorySchema = `
  CREATE TABLE life_records(
    id TEXT PRIMARY KEY,family_id TEXT NOT NULL,owner_person_id TEXT NOT NULL,
    category TEXT NOT NULL,title TEXT NOT NULL,status TEXT NOT NULL,privacy TEXT NOT NULL,
    starts_at TEXT,due_at TEXT,provider TEXT,reference_no TEXT,amount REAL,currency TEXT,
    location TEXT,notes TEXT,created_at TEXT NOT NULL
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
`;

const addLife = (
  database: DatabaseSync,
  id: string,
  ownerPersonId: string,
  privacy: string,
  familyId = FAMILY_ID,
  lifecycleState = 'active'
): void => {
  database.prepare(`
    INSERT INTO life_records(
      id,family_id,owner_person_id,category,title,status,privacy,due_at,created_at
    ) VALUES(?,?,?,'task',?,'active',?, '2026-08-09T03:00:00.000Z',?)
  `).run(id, familyId, ownerPersonId, id, privacy, NOW);
  database.prepare(
    "INSERT INTO data_lifecycle VALUES('life_record',?,?,?,?,?)"
  ).run(id, ownerPersonId, privacy, lifecycleState, NOW);
};

const addPermission = (
  database: DatabaseSync,
  id: string,
  resourceId: string,
  effect: 'allow' | 'deny'
): void => {
  database.prepare(
    "INSERT INTO object_permissions VALUES(?,?, 'life_record',?, '[\"read\"]',?,'general','2026-08-08T00:00:00.000Z',NULL)"
  ).run(id, ACCOUNT_ID, resourceId, effect);
};

const readKernel = new PlatformPolicyKernel({
  policyVersion: '30-y-life-repository-test-v1',
  signingKey: Buffer.from('30-y-life-repository-controlled-test-key', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['family.read'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

const executeLifeRead = async <T>(
  database: DatabaseSync,
  operation: (repository: SqliteLifeRepository, context: PolicyAuthorizedRepositoryExecutionContext) => T
): Promise<T> => {
  const correlationId = `life-read-${Math.random()}`;
  const pep = new PlatformPolicyEnforcementPoint({
    kernel: readKernel,
    authorityResolver: {
      resolve: () => ({
        policyVersion: '30-y-life-repository-test-v1',
        accountId: ACCOUNT_ID,
        personId: PERSON_ID,
        deviceId: 'device-life-reader',
        applicationId: 'windows-desktop',
        deviceTrusted: true,
        membershipActive: true,
        roles: ['adult_member'],
        familyIds: [FAMILY_ID],
        grants: [{
          id: 'grant-life-collection-read',
          subjectAccountId: ACCOUNT_ID,
          resourceType: 'life_record',
          resourceId: '*',
          actions: ['read'],
          effect: 'allow',
          startsAt: '2026-08-08T00:00:00.000Z'
        }],
        online: true,
        expiresAt: '2026-08-08T04:00:00.000Z'
      })
    },
    resourceResolver: {
      resolve: () => ({
        type: 'life_record',
        id: '*',
        familyId: FAMILY_ID,
        sensitivity: 'personal'
      })
    },
    receiptSink: { append: () => undefined },
    clock: () => NOW
  });
  return pep.execute({
    correlationId,
    action: 'read',
    capability: 'family.read',
    resourceType: 'life_record',
    resourceId: '*',
    purpose: 'general'
  }, () => ({ writable: true, epoch: 65 }), (policyAuthorization) => operation(
    new SqliteLifeRepository(),
    {
      transaction: database as unknown as RepositoryTransaction,
      actor: {
        userId: asUserId(ACCOUNT_ID),
        roles: ['adult_member'],
        personId: asPersonId(PERSON_ID)
      },
      correlationId: asCorrelationId(correlationId),
      occurredAt: asIsoDateTime(NOW),
      policyAuthorization
    }
  ));
};

describe('30-Y LIFE repository authorization boundary', () => {
  it('rejects an ordinary repository context before SQL', () => {
    const ordinary = {
      transaction: Object.freeze({}),
      actor: {
        userId: asUserId(ACCOUNT_ID),
        roles: ['adult_member'],
        personId: asPersonId(PERSON_ID)
      },
      correlationId: asCorrelationId('ordinary-life-context'),
      occurredAt: asIsoDateTime(NOW)
    } satisfies RepositoryExecutionContext;
    const repository = new SqliteLifeRepository();

    expect(() => repository.listLifeRecords(
      ordinary as PolicyAuthorizedRepositoryExecutionContext
    )).toThrow(/forged|transaction context/i);
    const row: LifeRecordRow = {
      id: 'ordinary-write',
      familyId: asFamilyId(FAMILY_ID),
      ownerPersonId: asPersonId(PERSON_ID),
      category: 'task',
      title: 'ordinary write',
      status: 'active',
      privacy: 'private',
      createdAt: asIsoDateTime(NOW)
    };
    expect(() => repository.insertLifeRecord(
      ordinary as PolicyAuthorizedRepositoryExecutionContext,
      row
    )).toThrow(/forged|transaction context/i);

    const forged = {
      ...ordinary,
      policyAuthorization: Object.freeze({
        correlationId: ordinary.correlationId,
        resourceType: 'life_record',
        resourceId: '*',
        action: 'read',
        capability: 'family.read'
      })
    } as unknown as PolicyAuthorizedRepositoryExecutionContext;
    expect(() => repository.listLifeRecords(forged)).toThrow(/forged|transaction context/i);
    expect(() => repository.insertLifeRecord(forged, row)).toThrow(/forged|transaction context/i);
  });

  it('enforces family, privacy, explicit deny precedence and lifecycle state', async () => {
    const database = new DatabaseSync(':memory:');
    databases.push(database);
    database.exec(repositorySchema);
    addLife(database, 'owner-visible', PERSON_ID, 'private');
    addLife(database, 'owner-denied', PERSON_ID, 'private');
    addLife(database, 'family-visible', 'person-other', 'family');
    addLife(database, 'selected-allowed', 'person-other', 'selected_members');
    addLife(database, 'private-hidden', 'person-other', 'private');
    addLife(database, 'other-family', PERSON_ID, 'family', 'family-life-b');
    addLife(database, 'inactive-hidden', PERSON_ID, 'private', FAMILY_ID, 'quarantined');
    addPermission(database, 'deny-owner', 'owner-denied', 'deny');
    addPermission(database, 'allow-selected', 'selected-allowed', 'allow');

    const result = await executeLifeRead(database, (repository, context) => (
      repository.listLifeRecords(context)
    ));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((row) => row.id).sort()).toEqual([
      'family-visible',
      'owner-visible',
      'selected-allowed'
    ]);
    expect(result.value.every((row) => row.familyId === FAMILY_ID)).toBe(true);

    const visibleRuns = await executeLifeRead(database, (repository, context) => (
      repository.listVisibleAutomationLifeRunSources(context, [
        'owner-visible', 'owner-denied', 'family-visible', 'inactive-hidden', 'other-family'
      ])
    ));
    expect(visibleRuns.ok).toBe(true);
    if (visibleRuns.ok) {
      expect(visibleRuns.value.map((row) => row.id)).toEqual(['family-visible', 'owner-visible']);
    }

    const dueLife = await executeLifeRead(database, (repository, context) => (
      repository.listAutomationDueLife(context, {
        fromAt: asIsoDateTime(NOW),
        toAt: asIsoDateTime('2026-08-10T03:00:00.000Z')
      })
    ));
    expect(dueLife.ok).toBe(true);
    if (dueLife.ok) expect(dueLife.value.map((row) => row.id)).toEqual(['owner-visible']);

    const report = await executeLifeRead(database, (repository, context) => (
      repository.getLifeReportProjection(context, {
        now: asIsoDateTime(NOW),
        in30Days: asIsoDateTime('2026-09-07T03:00:00.000Z')
      })
    ));
    expect(report).toEqual({
      ok: true,
      value: { activeTasks: 1, expiringInsurance: 0, overdueItems: [] }
    });
  });
});

const migrationFixtureSchema = `
  CREATE TABLE life_records(
    id TEXT PRIMARY KEY,family_id TEXT NOT NULL,owner_person_id TEXT NOT NULL,
    category TEXT NOT NULL,title TEXT NOT NULL,status TEXT NOT NULL,privacy TEXT NOT NULL,
    starts_at TEXT,due_at TEXT,provider TEXT,reference_no TEXT,amount REAL,currency TEXT,
    location TEXT,notes TEXT,created_at TEXT NOT NULL
  );
  CREATE TABLE database_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
  INSERT INTO database_metadata VALUES('schema_generation','before-30-y','${NOW}');
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
  INSERT INTO life_records(
    id,family_id,owner_person_id,category,title,status,privacy,created_at
  ) VALUES('legacy-life','family-life-a','person-life-reader','task','legacy','active','private','${NOW}');
`;

const insertReceipt = (
  database: DatabaseSync,
  input: {
    readonly hash: string;
    readonly nonce: string;
    readonly correlationId: string;
    readonly resourceId: string;
    readonly action: string;
    readonly privacy: 'private' | 'selected_members' | 'family';
    readonly resourceType?: string;
    readonly capability?: string;
    readonly familyId?: string;
    readonly ownerPersonId?: string;
    readonly sensitivity?: string;
    readonly purpose?: string;
    readonly fenceName?: string;
    readonly fenceEpoch?: number;
  }
): void => {
  const sensitivity = input.sensitivity ?? (input.privacy === 'private'
    ? 'highly_sensitive'
    : input.privacy === 'selected_members' ? 'sensitive' : 'personal');
  const recordJson = JSON.stringify({
    request: {
      resource: {
        familyId: input.familyId ?? FAMILY_ID,
        ownerPersonId: input.ownerPersonId ?? PERSON_ID,
        sensitivity
      },
      purpose: input.purpose ?? 'general'
    }
  });
  database.prepare(`
    INSERT INTO platform_policy_transaction_receipts(
      receipt_hash,receipt_version,nonce,correlation_id,resource_type,resource_id,
      action,capability,fence_name,fence_epoch,record_json
    ) VALUES(?,1,?,?,?,?,?,?,?,?,?)
  `).run(
    input.hash,
    input.nonce,
    input.correlationId,
    input.resourceType ?? 'life_record',
    input.resourceId,
    input.action,
    input.capability ?? 'family.write',
    input.fenceName ?? 'life-write',
    input.fenceEpoch ?? 65,
    recordJson
  );
  database.prepare(
    'INSERT INTO platform_policy_journal_projection_outbox VALUES(?)'
  ).run(input.hash);
};

const insertLifeWithReceipt = (
  database: DatabaseSync,
  input: {
    readonly id: string;
    readonly hash: string;
    readonly nonce: string;
    readonly correlationId: string;
    readonly familyId?: string;
    readonly ownerPersonId?: string;
    readonly privacy?: 'private' | 'selected_members' | 'family';
    readonly resourceType?: string;
    readonly resourceId?: string;
    readonly action?: string;
    readonly capability?: string;
  }
): void => {
  database.prepare(`
    INSERT INTO life_records(
      id,family_id,owner_person_id,category,title,status,privacy,created_at,
      policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
      policy_correlation_id,policy_resource_type,policy_resource_id,
      policy_action,policy_capability
    ) VALUES(?,?,?,'task',?,'active',?,?,?,1,?,?,?,?,?,?)
  `).run(
    input.id,
    input.familyId ?? FAMILY_ID,
    input.ownerPersonId ?? PERSON_ID,
    input.id,
    input.privacy ?? 'private',
    NOW,
    input.hash,
    input.nonce,
    input.correlationId,
    input.resourceType ?? 'life_record',
    input.resourceId ?? input.id,
    input.action ?? 'create',
    input.capability ?? 'family.write'
  );
};

const migrateLifeFixture = (): { database: DatabaseSync; migration: NonNullable<(typeof FAMILY_DATABASE_MIGRATIONS)[number]> } => {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  database.exec(migrationFixtureSchema);
  database.prepare(
    "INSERT INTO platform_policy_database_fences VALUES('life-write',65,1)"
  ).run();
  const migration = FAMILY_DATABASE_MIGRATIONS.find(({ version }) => version === 65);
  if (!migration) throw new Error('MIGRATION_65_NOT_FOUND');
  database.exec(migration.sql);
  return { database, migration };
};

describe('migration 65 LIFE durable policy receipt fence', () => {
  it('preserves old rows and rejects direct writes while accepting exact fresh receipts', () => {
    const { database, migration } = migrateLifeFixture();
    expect(migration.name).toBe('life_policy_receipt_fence');
    expect(migration.checksum).toBe(
      'a47e05b0b5249e300b8b001b31314663d90020b921b1049252df13426c58d178'
    );
    expect(database.prepare(
      "SELECT value FROM database_metadata WHERE key='schema_generation'"
    ).get()).toEqual({
      value: 'REVISION-30-Y-PPK-002-LIFE-POLICY-RECEIPT-FENCE'
    });

    expect(database.prepare("SELECT title FROM life_records WHERE id='legacy-life'").get()).toEqual({
      title: 'legacy'
    });
    const policyColumns = (database.prepare("PRAGMA table_info('life_records')").all() as Array<{ name: string }>)
      .map(({ name }) => name)
      .filter((name) => name.startsWith('policy_'));
    expect(policyColumns).toEqual([
      'policy_receipt_hash', 'policy_receipt_version', 'policy_receipt_nonce',
      'policy_correlation_id', 'policy_resource_type', 'policy_resource_id',
      'policy_action', 'policy_capability'
    ]);
    expect(database.prepare("PRAGMA index_list('life_records')").all()).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'idx_life_records_policy_receipt', unique: 1 })])
    );

    expect(() => database.prepare(`
      INSERT INTO life_records(
        id,family_id,owner_person_id,category,title,status,privacy,created_at
      ) VALUES('direct-life',?,?, 'task','direct','active','private',?)
    `).run(FAMILY_ID, PERSON_ID, NOW)).toThrow(/exact durable policy receipt/i);

    const createHash = 'a'.repeat(64);
    insertReceipt(database, {
      hash: createHash,
      nonce: 'nonce-life-create',
      correlationId: 'correlation-life-create',
      resourceId: 'governed-life',
      action: 'create',
      privacy: 'private'
    });
    insertLifeWithReceipt(database, {
      id: 'governed-life',
      hash: createHash,
      nonce: 'nonce-life-create',
      correlationId: 'correlation-life-create'
    });

    expect(() => database.prepare(
      "UPDATE life_records SET title='direct update' WHERE id='governed-life'"
    ).run()).toThrow(/fresh exact durable policy receipt/i);

    const updateHash = 'b'.repeat(64);
    insertReceipt(database, {
      hash: updateHash,
      nonce: 'nonce-life-update',
      correlationId: 'correlation-life-update',
      resourceId: 'governed-life',
      action: 'update',
      privacy: 'private'
    });
    database.prepare(`
      UPDATE life_records SET
        title='exact update',policy_receipt_hash=?,policy_receipt_version=1,
        policy_receipt_nonce='nonce-life-update',policy_correlation_id='correlation-life-update',
        policy_resource_type='life_record',policy_resource_id='governed-life',
        policy_action='update',policy_capability='family.write'
      WHERE id='governed-life'
    `).run(updateHash);
    expect(database.prepare("SELECT title FROM life_records WHERE id='governed-life'").get()).toEqual({
      title: 'exact update'
    });

    expect(() => database.prepare(
      "UPDATE life_records SET title='reused current update receipt' WHERE id='governed-life'"
    ).run()).toThrow(/fresh exact durable policy receipt/i);
    expect(database.prepare("SELECT title FROM life_records WHERE id='governed-life'").get()).toEqual({
      title: 'exact update'
    });

    expect(() => database.prepare(
      "DELETE FROM life_records WHERE id='governed-life'"
    ).run()).toThrow(/GOVERNED_DELETION_WORKFLOW_REQUIRED/);
    expect(database.prepare("SELECT title FROM life_records WHERE id='governed-life'").get()).toEqual({
      title: 'exact update'
    });
  });

  it('rejects copied or mismatched receipts and stale fences before any insert mutation', () => {
    const { database } = migrateLifeFixture();
    let sequence = 0;
    const reject = (input: {
      readonly receipt?: Partial<Parameters<typeof insertReceipt>[1]>;
      readonly row?: Partial<Parameters<typeof insertLifeWithReceipt>[1]>;
    }): void => {
      sequence += 1;
      const id = `rejected-life-${sequence}`;
      const hash = sequence.toString(16).padStart(64, '0');
      const nonce = `nonce-${sequence}`;
      const correlationId = `correlation-${sequence}`;
      const receipt = {
        hash,
        nonce,
        correlationId,
        resourceId: id,
        action: 'create',
        privacy: 'private' as const,
        ...input.receipt
      };
      insertReceipt(database, receipt);
      expect(() => insertLifeWithReceipt(database, {
        id,
        hash,
        nonce,
        correlationId,
        ...input.row
      })).toThrow(/exact durable policy receipt/i);
      expect(database.prepare('SELECT COUNT(*) AS count FROM life_records WHERE id=?').get(id)).toEqual({
        count: 0
      });
    };

    reject({
      receipt: { resourceId: 'authorized-for-another-life' },
      row: { resourceId: 'authorized-for-another-life' }
    });
    reject({ receipt: { familyId: 'family-life-b' } });
    reject({ receipt: { ownerPersonId: 'person-life-other' } });
    reject({ receipt: { sensitivity: 'personal' } });
    reject({ receipt: { privacy: 'private' }, row: { privacy: 'family' } });
    reject({ receipt: { capability: 'family.read' }, row: { capability: 'family.read' } });
    reject({ receipt: { action: 'update' }, row: { action: 'update' } });
    reject({ row: { correlationId: 'copied-correlation' } });
    reject({ row: { nonce: 'copied-nonce' } });
    reject({ receipt: { fenceEpoch: 64 } });
  });

  it('keeps production LIFE update and delete workflows explicitly NOT_COMPLETE', () => {
    const repository = new SqliteLifeRepository() as unknown as Record<string, unknown>;
    expect(repository).not.toHaveProperty('updateLifeRecord');
    expect(repository).not.toHaveProperty('deleteLifeRecord');
  });
});
