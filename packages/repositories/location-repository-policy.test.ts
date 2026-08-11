import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId, asUserId } from '@ppt/core';
import type { RepositoryTransaction } from '@ppt/contracts';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import { PlatformPolicyEnforcementPoint, PlatformPolicyKernel } from '@ppt/platform-policy';
import type {
  LocationRecord,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext
} from '@ppt/repository-contracts';
import { SqliteLocationRepository } from './src/location-repository.js';

const NOW = '2026-08-08T03:00:00.000Z';
const FAMILY_ID = 'family-location-a';
const OTHER_FAMILY_ID = 'family-location-b';
const ACCOUNT_ID = 'account-location-reader';
const PERSON_ID = 'person-location-reader';
const OTHER_ACCOUNT_ID = 'account-location-other';
const OTHER_PERSON_ID = 'person-location-other';
const OTHER_FAMILY_ACCOUNT_ID = 'account-location-other-family';
const OTHER_FAMILY_PERSON_ID = 'person-location-other-family';
const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

const migrationFixtureSchema = `
  CREATE TABLE people(
    id TEXT PRIMARY KEY,family_id TEXT NOT NULL,status TEXT NOT NULL
  );
  CREATE TABLE accounts(
    id TEXT PRIMARY KEY,person_id TEXT,status TEXT NOT NULL
  );
  CREATE TABLE locations(
    id TEXT PRIMARY KEY,family_id TEXT NOT NULL,label TEXT NOT NULL,address TEXT,
    latitude REAL,longitude REAL,kind TEXT NOT NULL,created_at TEXT NOT NULL
  );
  CREATE TABLE data_lifecycle(
    resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,state TEXT NOT NULL,
    PRIMARY KEY(resource_type,resource_id)
  );
  CREATE TABLE object_permissions(
    id TEXT PRIMARY KEY,subject_account_id TEXT NOT NULL,resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,actions TEXT NOT NULL,effect TEXT NOT NULL,
    purpose TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT
  );
  CREATE TABLE database_metadata(
    key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL
  );
  INSERT INTO database_metadata VALUES('schema_generation','before-30-z','${NOW}');
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
  INSERT INTO platform_policy_database_fences VALUES('location-write',66,1);
  INSERT INTO people VALUES
    ('${PERSON_ID}','${FAMILY_ID}','active'),
    ('${OTHER_PERSON_ID}','${FAMILY_ID}','active'),
    ('${OTHER_FAMILY_PERSON_ID}','${OTHER_FAMILY_ID}','active');
  INSERT INTO accounts VALUES
    ('${ACCOUNT_ID}','${PERSON_ID}','active'),
    ('${OTHER_ACCOUNT_ID}','${OTHER_PERSON_ID}','active'),
    ('${OTHER_FAMILY_ACCOUNT_ID}','${OTHER_FAMILY_PERSON_ID}','active');
  INSERT INTO locations(
    id,family_id,label,address,latitude,longitude,kind,created_at
  ) VALUES(
    'legacy-location','${FAMILY_ID}','legacy location','legacy address',1,2,'other','${NOW}'
  );
`;

interface ReceiptInput {
  readonly id: string;
  readonly hash: string;
  readonly nonce: string;
  readonly correlationId: string;
  readonly familyId?: string;
  readonly ownerPersonId?: string;
  readonly subjectAccountId?: string;
  readonly subjectPersonId?: string;
  readonly sensitivity?: string;
  readonly purpose?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly action?: string;
  readonly capability?: string;
  readonly fenceEpoch?: number;
  readonly project?: boolean;
}

const insertReceipt = (database: DatabaseSync, input: ReceiptInput): string => {
  const familyId = input.familyId ?? FAMILY_ID;
  const ownerPersonId = input.ownerPersonId ?? PERSON_ID;
  const recordJson = JSON.stringify({
    request: {
      subject: {
        accountId: input.subjectAccountId ?? ACCOUNT_ID,
        personId: input.subjectPersonId ?? ownerPersonId
      },
      resource: {
        familyId,
        ownerPersonId,
        sensitivity: input.sensitivity ?? 'highly_sensitive'
      },
      purpose: input.purpose ?? 'general'
    }
  });
  database.prepare(`
    INSERT INTO platform_policy_transaction_receipts(
      receipt_hash,receipt_version,nonce,correlation_id,resource_type,resource_id,
      action,capability,fence_name,fence_epoch,record_json
    ) VALUES(?,1,?,?,?,?,?,?, 'location-write',?,?)
  `).run(
    input.hash,
    input.nonce,
    input.correlationId,
    input.resourceType ?? 'location',
    input.resourceId ?? input.id,
    input.action ?? 'create',
    input.capability ?? 'family.write',
    input.fenceEpoch ?? 66,
    recordJson
  );
  if (input.project !== false) {
    database.prepare(
      'INSERT INTO platform_policy_journal_projection_outbox VALUES(?,?)'
    ).run(input.hash, recordJson);
  }
  return recordJson;
};

interface LocationInsertInput extends ReceiptInput {
  readonly rowFamilyId?: string;
  readonly rowOwnerPersonId?: string;
  readonly rowCorrelationId?: string;
  readonly rowNonce?: string;
  readonly rowResourceType?: string;
  readonly rowResourceId?: string;
  readonly rowAction?: string;
  readonly rowCapability?: string;
  readonly label?: string;
}

const insertLocationWithReceipt = (database: DatabaseSync, input: LocationInsertInput): void => {
  insertReceipt(database, input);
  database.prepare(`
    INSERT INTO locations(
      id,family_id,owner_person_id,label,address,latitude,longitude,kind,created_at,
      policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
      policy_correlation_id,policy_resource_type,policy_resource_id,
      policy_action,policy_capability
    ) VALUES(?,?,?,?,NULL,NULL,NULL,'other',?,?,1,?,?,?,?,?,?)
  `).run(
    input.id,
    input.rowFamilyId ?? input.familyId ?? FAMILY_ID,
    input.rowOwnerPersonId ?? input.ownerPersonId ?? PERSON_ID,
    input.label ?? input.id,
    NOW,
    input.hash,
    input.rowNonce ?? input.nonce,
    input.rowCorrelationId ?? input.correlationId,
    input.rowResourceType ?? input.resourceType ?? 'location',
    input.rowResourceId ?? input.resourceId ?? input.id,
    input.rowAction ?? input.action ?? 'create',
    input.rowCapability ?? input.capability ?? 'family.write'
  );
};

let receiptSequence = 0;
const addGovernedLocation = (
  database: DatabaseSync,
  id: string,
  ownerPersonId = PERSON_ID,
  familyId = FAMILY_ID,
  label = id
): void => {
  receiptSequence += 1;
  const subjectAccountId = ownerPersonId === PERSON_ID
    ? ACCOUNT_ID
    : ownerPersonId === OTHER_PERSON_ID ? OTHER_ACCOUNT_ID : OTHER_FAMILY_ACCOUNT_ID;
  insertLocationWithReceipt(database, {
    id,
    hash: receiptSequence.toString(16).padStart(64, '0'),
    nonce: `location-nonce-${receiptSequence}`,
    correlationId: `location-correlation-${receiptSequence}`,
    familyId,
    ownerPersonId,
    subjectPersonId: ownerPersonId,
    subjectAccountId,
    label
  });
};

const migrateLocationFixture = (): {
  readonly database: DatabaseSync;
  readonly migration: NonNullable<(typeof FAMILY_DATABASE_MIGRATIONS)[number]>;
} => {
  receiptSequence = 0;
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  database.exec(migrationFixtureSchema);
  database.exec('PRAGMA foreign_keys=ON');
  const migration = FAMILY_DATABASE_MIGRATIONS.find(({ version }) => version === 66);
  if (!migration) throw new Error('MIGRATION_66_NOT_FOUND');
  database.exec(migration.sql);
  return { database, migration };
};

const addPermission = (
  database: DatabaseSync,
  id: string,
  resourceId: string,
  effect: 'allow' | 'deny',
  endsAt: string | null
): void => {
  database.prepare(`
    INSERT INTO object_permissions(
      id,subject_account_id,resource_type,resource_id,actions,effect,
      purpose,starts_at,ends_at
    ) VALUES(?,?,'location',?,'["read"]',?,'general','2026-08-08T00:00:00.000Z',?)
  `).run(id, ACCOUNT_ID, resourceId, effect, endsAt);
};

const readKernel = new PlatformPolicyKernel({
  policyVersion: '30-z-location-repository-test-v1',
  signingKey: Buffer.from('30-z-location-repository-controlled-test-key', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['location.read'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

const executeLocationRead = async <T>(
  database: DatabaseSync,
  resourceId: string,
  operation: (
    repository: SqliteLocationRepository,
    context: PolicyAuthorizedRepositoryExecutionContext
  ) => T
): Promise<T> => {
  const correlationId = `location-read-${resourceId.replaceAll(/[^A-Za-z0-9._:-]/g, 'all')}-${Math.random()}`;
  const pep = new PlatformPolicyEnforcementPoint({
    kernel: readKernel,
    authorityResolver: {
      resolve: () => ({
        policyVersion: '30-z-location-repository-test-v1',
        accountId: ACCOUNT_ID,
        personId: PERSON_ID,
        deviceId: 'device-location-reader',
        applicationId: 'windows-desktop',
        deviceTrusted: true,
        membershipActive: true,
        roles: ['family_admin'],
        familyIds: [FAMILY_ID],
        online: true,
        expiresAt: '2026-08-08T04:00:00.000Z'
      })
    },
    resourceResolver: {
      resolve: () => ({
        type: 'location',
        id: resourceId,
        familyId: FAMILY_ID,
        ownerPersonId: PERSON_ID,
        sensitivity: 'highly_sensitive'
      })
    },
    receiptSink: { append: () => undefined },
    clock: () => NOW
  });
  return pep.execute({
    correlationId,
    action: 'read',
    capability: 'location.read',
    resourceType: 'location',
    resourceId,
    purpose: 'general'
  }, () => ({ writable: true, epoch: 66 }), (policyAuthorization) => operation(
    new SqliteLocationRepository(),
    {
      transaction: database as unknown as RepositoryTransaction,
      actor: {
        userId: asUserId(ACCOUNT_ID),
        roles: ['family_admin'],
        personId: asPersonId(PERSON_ID)
      },
      correlationId: asCorrelationId(correlationId),
      occurredAt: asIsoDateTime(NOW),
      policyAuthorization
    }
  ));
};

describe('30-Z LOCATION repository authorization boundary', () => {
  it('rejects ordinary and forged contexts before business SQL', () => {
    const ordinary = {
      transaction: Object.freeze({}),
      actor: {
        userId: asUserId(ACCOUNT_ID),
        roles: ['family_admin'],
        personId: asPersonId(PERSON_ID)
      },
      correlationId: asCorrelationId('ordinary-location-context'),
      occurredAt: asIsoDateTime(NOW)
    } satisfies RepositoryExecutionContext;
    const location: LocationRecord = {
      id: 'ordinary-location',
      familyId: asFamilyId(FAMILY_ID),
      ownerPersonId: asPersonId(PERSON_ID),
      label: 'ordinary',
      kind: 'other',
      createdAt: asIsoDateTime(NOW)
    };
    const repository = new SqliteLocationRepository();

    expect(() => repository.listByFamily(
      ordinary as PolicyAuthorizedRepositoryExecutionContext,
      asFamilyId(FAMILY_ID)
    )).toThrow(/forged|transaction context/i);
    expect(() => repository.findById(
      ordinary as PolicyAuthorizedRepositoryExecutionContext,
      asFamilyId(FAMILY_ID),
      location.id
    )).toThrow(/forged|transaction context/i);
    expect(() => repository.insert(
      ordinary as PolicyAuthorizedRepositoryExecutionContext,
      location
    )).toThrow(/forged|transaction context/i);

    const forged = {
      ...ordinary,
      policyAuthorization: Object.freeze({
        correlationId: ordinary.correlationId,
        resourceType: 'location',
        resourceId: '*',
        action: 'read',
        capability: 'location.read'
      })
    } as unknown as PolicyAuthorizedRepositoryExecutionContext;
    expect(() => repository.listByFamily(forged, asFamilyId(FAMILY_ID)))
      .toThrow(/forged|transaction context/i);
  });

  it('quarantines legacy rows and enforces family, finite allow, deny and lifecycle filters', async () => {
    const { database } = migrateLocationFixture();
    addGovernedLocation(database, 'owner-visible');
    addGovernedLocation(database, 'owner-denied');
    addGovernedLocation(database, 'other-finite-allowed', OTHER_PERSON_ID);
    addGovernedLocation(database, 'other-open-allow', OTHER_PERSON_ID);
    addGovernedLocation(database, 'other-hidden', OTHER_PERSON_ID);
    addGovernedLocation(database, 'inactive-hidden');
    addGovernedLocation(
      database,
      'other-family-hidden',
      OTHER_FAMILY_PERSON_ID,
      OTHER_FAMILY_ID
    );
    database.prepare(
      "INSERT INTO data_lifecycle VALUES('location','inactive-hidden','archived')"
    ).run();
    addPermission(database, 'deny-owner', 'owner-denied', 'deny', null);
    addPermission(database, 'allow-owner-denied', 'owner-denied', 'allow', '2026-08-09T00:00:00.000Z');
    addPermission(database, 'allow-other-finite', 'other-finite-allowed', 'allow', '2026-08-09T00:00:00.000Z');
    addPermission(database, 'allow-other-open', 'other-open-allow', 'allow', null);
    addPermission(database, 'allow-legacy', 'legacy-location', 'allow', '2026-08-09T00:00:00.000Z');

    const listed = await executeLocationRead(database, '*', (repository, context) => (
      repository.listByFamily(context, asFamilyId(FAMILY_ID))
    ));
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.map(({ id }) => id)).toEqual([
      'other-finite-allowed',
      'owner-visible'
    ]);
    expect(listed.value.every(({ familyId }) => familyId === FAMILY_ID)).toBe(true);

    const found = await executeLocationRead(database, 'owner-visible', (repository, context) => (
      repository.findById(context, asFamilyId(FAMILY_ID), 'owner-visible')
    ));
    expect(found).toEqual(expect.objectContaining({
      ok: true,
      value: expect.objectContaining({
        id: 'owner-visible',
        ownerPersonId: PERSON_ID,
        createdAt: NOW
      })
    }));

    const resolver = new SqliteLocationRepository();
    const resolverContext = {
      transaction: database as unknown as RepositoryTransaction,
      actor: {
        userId: asUserId(ACCOUNT_ID),
        roles: ['family_admin'],
        personId: asPersonId(PERSON_ID)
      },
      correlationId: asCorrelationId('location-policy-resolution'),
      occurredAt: asIsoDateTime(NOW)
    } satisfies RepositoryExecutionContext;
    expect(resolver.findLocationForPolicyResolution(resolverContext, 'owner-visible')).toEqual({
      ok: true,
      value: {
        id: 'owner-visible',
        familyId: FAMILY_ID,
        ownerPersonId: PERSON_ID,
        createReceiptHash: '1'.padStart(64, '0')
      }
    });
    expect(resolver.findLocationForPolicyResolution(resolverContext, 'legacy-location')).toEqual({
      ok: true,
      value: null
    });
    expect(resolver.findLocationForPolicyResolution(resolverContext, 'inactive-hidden')).toEqual({
      ok: true,
      value: null
    });
  });

  it('does not expose update or delete repository operations', () => {
    const repository = new SqliteLocationRepository() as unknown as Record<string, unknown>;
    expect(repository).not.toHaveProperty('update');
    expect(repository).not.toHaveProperty('delete');
  });
});

describe('migration 66 LOCATION durable policy receipt fence', () => {
  it('preserves legacy rows, rejects direct mutation and accepts one exact create receipt', () => {
    const { database, migration } = migrateLocationFixture();
    expect(migration.name).toBe('location_policy_receipt_fence');
    expect(migration.checksum).toBe(
      'e55b15e48f504fc65452556f6c907b8845bb81b6b6d65caa5c243410d11c9609'
    );
    expect(database.prepare(
      "SELECT value FROM database_metadata WHERE key='schema_generation'"
    ).get()).toEqual({
      value: 'REVISION-30-Z-PPK-002-LOCATION-POLICY-RECEIPT-FENCE'
    });

    const columns = (database.prepare("PRAGMA table_info('locations')").all() as Array<{ name: string }>)
      .map(({ name }) => name);
    expect(columns).toContain('owner_person_id');
    expect(columns.filter((name) => name.startsWith('policy_'))).toEqual([
      'policy_receipt_hash',
      'policy_receipt_version',
      'policy_receipt_nonce',
      'policy_correlation_id',
      'policy_resource_type',
      'policy_resource_id',
      'policy_action',
      'policy_capability'
    ]);
    expect(columns).not.toContain('privacy');
    expect(columns).not.toContain('ai_processing_allowed');
    expect(database.prepare(
      "SELECT owner_person_id,policy_receipt_hash FROM locations WHERE id='legacy-location'"
    ).get()).toEqual({ owner_person_id: null, policy_receipt_hash: null });
    expect(database.prepare("PRAGMA index_list('locations')").all()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'idx_locations_family_owner_label' }),
      expect.objectContaining({ name: 'idx_locations_policy_receipt', unique: 1 })
    ]));

    expect(() => database.prepare(`
      INSERT INTO locations(
        id,family_id,owner_person_id,label,kind,created_at
      ) VALUES('direct-location',?,?, 'direct','other',?)
    `).run(FAMILY_ID, PERSON_ID, NOW)).toThrow(/exact durable policy receipt/i);

    const hash = 'a'.repeat(64);
    insertLocationWithReceipt(database, {
      id: 'governed-location',
      hash,
      nonce: 'governed-location-nonce',
      correlationId: 'governed-location-correlation'
    });
    expect(database.prepare(
      "SELECT owner_person_id,policy_receipt_hash FROM locations WHERE id='governed-location'"
    ).get()).toEqual({ owner_person_id: PERSON_ID, policy_receipt_hash: hash });

    expect(() => database.prepare(
      "UPDATE locations SET label='changed' WHERE id='governed-location'"
    ).run()).toThrow(/GOVERNED_UPDATE_WORKFLOW_REQUIRED/);
    expect(() => database.prepare(
      "UPDATE locations SET label='changed legacy' WHERE id='legacy-location'"
    ).run()).toThrow(/GOVERNED_UPDATE_WORKFLOW_REQUIRED/);
    expect(() => database.prepare(
      "DELETE FROM locations WHERE id='governed-location'"
    ).run()).toThrow(/GOVERNED_DELETION_WORKFLOW_REQUIRED/);
    expect(database.prepare(
      "SELECT label FROM locations WHERE id='governed-location'"
    ).get()).toEqual({ label: 'governed-location' });

    expect(database.prepare(
      "DELETE FROM locations WHERE id='legacy-location'"
    ).run().changes).toBe(1);
  });

  it('rejects mismatched receipts, stale fences and missing projections without mutation', () => {
    const { database } = migrateLocationFixture();
    let sequence = 0;
    const reject = (overrides: Partial<LocationInsertInput>): void => {
      sequence += 1;
      const id = `rejected-location-${sequence}`;
      const input: LocationInsertInput = {
        id,
        hash: (sequence + 20).toString(16).padStart(64, '0'),
        nonce: `rejected-location-nonce-${sequence}`,
        correlationId: `rejected-location-correlation-${sequence}`,
        ...overrides
      };
      expect(() => insertLocationWithReceipt(database, input))
        .toThrow(/exact durable policy receipt/i);
      expect(database.prepare(
        'SELECT COUNT(*) AS count FROM locations WHERE id=?'
      ).get(id)).toEqual({ count: 0 });
    };

    reject({ familyId: OTHER_FAMILY_ID });
    reject({ ownerPersonId: OTHER_PERSON_ID });
    reject({ subjectPersonId: OTHER_PERSON_ID });
    reject({ sensitivity: 'personal' });
    reject({ purpose: 'timeline' });
    reject({ resourceId: 'receipt-for-another-location', rowResourceId: 'receipt-for-another-location' });
    reject({ resourceType: 'life_record', rowResourceType: 'life_record' });
    reject({ action: 'read', rowAction: 'read' });
    reject({ capability: 'family.read', rowCapability: 'family.read' });
    reject({ rowCorrelationId: 'copied-correlation' });
    reject({ rowNonce: 'copied-nonce' });
    reject({ fenceEpoch: 65 });
    reject({ project: false });
  });
});
