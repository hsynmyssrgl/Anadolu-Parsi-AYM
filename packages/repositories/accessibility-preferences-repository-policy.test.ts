import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId
} from '@ppt/core';
import type { RepositoryTransaction } from '@ppt/contracts';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import type {
  AccessibilityPreferencesMutationRow,
  AccessibilityPreferencesRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteAccessibilityPreferencesRepository } from './src/accessibility-preferences-repository.js';
import { computePlatformPolicyReceiptHash } from './src/platform-policy-transaction-repository.js';

const NOW = '2026-08-14T06:00:00.000Z';
const RECORDED_AT = '2026-08-14T06:00:00.125Z';
const FAMILY_ID = asFamilyId('family-accessibility-a');
const PERSON_ID = asPersonId('person-accessibility-a');
const ACCOUNT_ID = asUserId('account-accessibility-a');
const FENCE_NAME = 'accessibility-preferences-write';
const FENCE_EPOCH = 90;
const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

const fixtureSchema = `
  PRAGMA foreign_keys=ON;
  CREATE TABLE families(id TEXT PRIMARY KEY);
  CREATE TABLE people(
    id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id),status TEXT NOT NULL
  );
  CREATE TABLE accounts(
    id TEXT PRIMARY KEY,person_id TEXT NOT NULL REFERENCES people(id),status TEXT NOT NULL
  );
  CREATE TABLE database_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
  CREATE TABLE platform_policy_database_fences(
    fence_name TEXT PRIMARY KEY,epoch INTEGER NOT NULL,writable INTEGER NOT NULL,
    synchronized_at TEXT NOT NULL
  );
  CREATE TABLE platform_policy_transaction_receipts(
    receipt_hash TEXT PRIMARY KEY,receipt_version INTEGER NOT NULL,request_hash TEXT NOT NULL,
    context_hash TEXT NOT NULL,data_classes_json TEXT NOT NULL,obligation_execution_hash TEXT NOT NULL,
    policy_package_version INTEGER NOT NULL,policy_package_sha256 TEXT NOT NULL,
    application_version TEXT NOT NULL,capability_manifest_sha256 TEXT,
    device_certificate_sha256 TEXT,decision_authority_id TEXT,nonce TEXT NOT NULL,
    correlation_id TEXT NOT NULL,policy_version TEXT NOT NULL,resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,action TEXT NOT NULL,capability TEXT NOT NULL,
    fence_name TEXT NOT NULL REFERENCES platform_policy_database_fences(fence_name),
    fence_epoch INTEGER NOT NULL,fence_writable INTEGER NOT NULL,
    issued_at TEXT NOT NULL,recorded_at TEXT NOT NULL,record_json TEXT NOT NULL
  );
  CREATE TABLE platform_policy_journal_projection_outbox(
    receipt_hash TEXT PRIMARY KEY REFERENCES platform_policy_transaction_receipts(receipt_hash),
    record_json TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,projected_at TEXT
  );
  INSERT INTO families VALUES('${FAMILY_ID}');
  INSERT INTO people VALUES('${PERSON_ID}','${FAMILY_ID}','active');
  INSERT INTO accounts VALUES('${ACCOUNT_ID}','${PERSON_ID}','active');
  INSERT INTO database_metadata VALUES('schema_generation','before-33-m','${NOW}');
  INSERT INTO platform_policy_database_fences VALUES('${FENCE_NAME}',${FENCE_EPOCH},1,'${NOW}');
`;

const migration90 = FAMILY_DATABASE_MIGRATIONS.find(({ version }) => version === 90);
if (!migration90) throw new Error('MIGRATION_90_NOT_FOUND');
const migration121 = FAMILY_DATABASE_MIGRATIONS.find(({ version }) => version === 121);
if (!migration121) throw new Error('MIGRATION_121_NOT_FOUND');
const accessibilityTriggerMarker = 'DROP TRIGGER IF EXISTS trg_accessibility_mutation_policy_receipt;';
const accessibilityTriggerStart = migration121.sql.indexOf(accessibilityTriggerMarker);
const accessibilityTriggerEnd = migration121.sql.indexOf('END;', accessibilityTriggerStart);
if (accessibilityTriggerStart < 0 || accessibilityTriggerEnd < 0) {
  throw new Error('MIGRATION_121_ACCESSIBILITY_TRIGGER_NOT_FOUND');
}
const accessibilityMigration121Sql = migration121.sql.slice(
  accessibilityTriggerStart,
  accessibilityTriggerEnd + 4
);

const openFixture = (): DatabaseSync => {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  database.exec(fixtureSchema);
  database.exec(migration90.sql);
  database.exec(accessibilityMigration121Sql);
  return database;
};

const kernel = new PlatformPolicyKernel({
  policyVersion: '33-m-accessibility-preferences-repository-test-v1',
  signingKey: Buffer.from('33-m-accessibility-preferences-controlled-test-key', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

let sequence = 0;

const persistReceipt = (
  database: DatabaseSync,
  record: PlatformPolicyReceiptRecord,
  recordedAt = record.recordedAt
): void => {
  const receiptHash = computePlatformPolicyReceiptHash(record.receipt);
  const storedRecord: PlatformPolicyReceiptRecord = {
    ...record,
    recordedAt: asIsoDateTime(recordedAt)
  };
  const recordJson = JSON.stringify(storedRecord);
  database.prepare(`
    INSERT INTO platform_policy_transaction_receipts(
      receipt_hash,receipt_version,request_hash,context_hash,data_classes_json,
      obligation_execution_hash,policy_package_version,policy_package_sha256,
      application_version,capability_manifest_sha256,device_certificate_sha256,
      decision_authority_id,nonce,correlation_id,policy_version,resource_type,resource_id,
      action,capability,fence_name,fence_epoch,fence_writable,issued_at,recorded_at,record_json
    ) VALUES(${Array.from({ length: 25 }, () => '?').join(',')})
  `).run(
    receiptHash,record.receipt.receiptVersion,record.receipt.requestHash,record.contextHash,
    JSON.stringify(record.dataClasses),record.obligationExecution!.attestationHash,
    record.policyPackageVersion,record.policyPackageSha256,record.applicationVersion,
    record.capabilityManifestSha256,record.deviceCertificateSha256 ?? null,
    record.decisionAuthorityId ?? null,record.receipt.nonce,record.correlationId,
    record.decision.policyVersion,record.resourceType,record.resourceId,record.action,
    record.capability,FENCE_NAME,FENCE_EPOCH,1,record.receipt.issuedAt,recordedAt,
    recordJson
  );
  database.prepare(`
    INSERT INTO platform_policy_journal_projection_outbox(
      receipt_hash,record_json,status,created_at,projected_at
    ) VALUES(?,?,'pending',?,NULL)
  `).run(receiptHash, recordJson, recordedAt);
};

const executePolicy = async <T>(
  database: DatabaseSync,
  action: 'read' | 'create' | 'update',
  resourceId: string,
  operation: (
    repository: SqliteAccessibilityPreferencesRepository,
    context: PolicyAuthorizedRepositoryExecutionContext
  ) => RepositoryResult<T>,
  recordedAt=NOW
): Promise<RepositoryResult<T>> => {
  sequence += 1;
  const correlationId = asCorrelationId(`correlation-accessibility-${sequence}`);
  const capability = action === 'read' ? 'family.read' : 'family.write';
  const pep = new PlatformPolicyEnforcementPoint({
    kernel,
    authorityResolver: {
      resolve: () => ({
        policyVersion: '33-m-accessibility-preferences-repository-test-v1',
        accountId: ACCOUNT_ID,
        personId: PERSON_ID,
        deviceId: 'device-accessibility-a',
        applicationId: 'windows-desktop',
        deviceTrusted: true,
        membershipActive: true,
        roles: ['family_admin'],
        familyIds: [FAMILY_ID],
        grants: [{
          id: `grant-${sequence}`,
          subjectAccountId: ACCOUNT_ID,
          resourceType: 'accessibility_preferences',
          resourceId,
          actions: [action],
          effect: 'allow',
          purpose: 'general',
          startsAt: '2026-08-14T00:00:00.000Z'
        }],
        online: true,
        expiresAt: '2026-08-14T07:00:00.000Z'
      })
    },
    resourceResolver: {
      resolve: () => ({
        type: 'accessibility_preferences',
        id: resourceId,
        familyId: FAMILY_ID,
        ownerPersonId: PERSON_ID,
        sensitivity: 'personal'
      })
    },
    receiptSink: { append: (record) => persistReceipt(database, record, recordedAt) },
    replayStore: { reserve: () => true },
    clock: () => NOW,
    nonceFactory: () => `nonce-accessibility-${sequence}`
  });

  return pep.execute({
    correlationId,
    action,
    capability,
    resourceType: 'accessibility_preferences',
    resourceId,
    purpose: 'general'
  }, () => ({ writable: true, epoch: FENCE_EPOCH }), (policyAuthorization) => operation(
    new SqliteAccessibilityPreferencesRepository(),
    {
      transaction: database as unknown as RepositoryTransaction,
      actor: { userId: ACCOUNT_ID, roles: ['family_admin'], personId: PERSON_ID },
      correlationId,
      occurredAt: asIsoDateTime(recordedAt),
      policyAuthorization
    }
  ));
};

const preferenceMutation = (
  revision: number,
  overrides: Partial<AccessibilityPreferencesMutationRow> = {}
): AccessibilityPreferencesMutationRow => ({
  id: `accessibility-mutation-${revision}`,
  clientOperationId: `accessibility-operation-${revision}`,
  requestFingerprint: revision.toString(16).padStart(64, '0'),
  familyId: FAMILY_ID,
  accountId: ACCOUNT_ID,
  ownerPersonId: PERSON_ID,
  previousRevision: revision - 1,
  revision,
  textScale: revision === 1 ? 'standard' : 'large',
  textScalePercent: revision === 1 ? 100 : 135,
  highContrast: revision > 1,
  reduceMotion: revision > 1,
  theme: revision === 1 ? 'system' : 'dark',
  density: 'standard',
  readingMode: revision === 1 ? 'standard' : 'easy-read',
  audienceProfile: revision === 1 ? 'standard' : 'low-vision',
  captionsEnabled: true,
  audioMuted: false,
  createdAt: asIsoDateTime(NOW),
  ...overrides
});

const currentRow = (
  mutation: AccessibilityPreferencesMutationRow,
  createdAt = mutation.createdAt
): AccessibilityPreferencesRow => ({
  ...mutation,
  createdAt,
  updatedAt: mutation.createdAt,
  lastMutationId: mutation.id
});

describe('33-M accessibility preferences repository policy boundary', () => {
  it('accepts the authoritative receipt time when request and receipt times differ', async () => {
    const database = openFixture();
    const mutation = preferenceMutation(1, { createdAt: asIsoDateTime(RECORDED_AT) });
    const inserted = await executePolicy(
      database,
      'create',
      ACCOUNT_ID,
      (repository, context) => repository.insertMutation(context, mutation),
      RECORDED_AT
    );
    expect(inserted).toEqual({ ok: true, value: undefined });
  });

  it('creates, updates and reads only the exact personal account scope', async () => {
    const database = openFixture();
    const first = preferenceMutation(1);
    const created = await executePolicy(database, 'create', ACCOUNT_ID, (repository, context) => {
      const inserted = repository.insertMutation(context, first);
      return inserted.ok ? repository.saveCurrent(context, currentRow(first), 0) : inserted;
    });
    expect(created).toEqual({ ok: true, value: true });

    const second = preferenceMutation(2);
    const updated = await executePolicy(database, 'update', ACCOUNT_ID, (repository, context) => {
      const inserted = repository.insertMutation(context, second);
      return inserted.ok ? repository.saveCurrent(context, currentRow(second, first.createdAt), 1) : inserted;
    });
    expect(updated).toEqual({ ok: true, value: true });

    const read = await executePolicy(database, 'read', '*', (repository, context) => (
      repository.find(context, ACCOUNT_ID)
    ));
    expect(read).toEqual(expect.objectContaining({
      ok: true,
      value: expect.objectContaining({ revision: 2, textScalePercent: 135, highContrast: true })
    }));

    const resolutionContext = {
      transaction: database as unknown as RepositoryTransaction,
      actor: { userId: ACCOUNT_ID, roles: ['policy_runtime'], personId: PERSON_ID },
      correlationId: asCorrelationId('accessibility-policy-resolution'),
      occurredAt: asIsoDateTime(NOW)
    } satisfies RepositoryExecutionContext;
    expect(new SqliteAccessibilityPreferencesRepository()
      .findForPolicyResolution(resolutionContext, ACCOUNT_ID))
      .toEqual(expect.objectContaining({ ok: true, value: expect.objectContaining({ revision: 2 }) }));
  });

  it('rejects forged contexts, fingerprint mismatch and mutation/delete bypasses', async () => {
    const database = openFixture();
    const first = preferenceMutation(1);
    const created = await executePolicy(database, 'create', ACCOUNT_ID, (repository, context) => {
      const inserted = repository.insertMutation(context, first);
      return inserted.ok ? repository.saveCurrent(context, currentRow(first), 0) : inserted;
    });
    expect(created.ok).toBe(true);

    const ordinary = {
      transaction: database as unknown as RepositoryTransaction,
      actor: { userId: ACCOUNT_ID, roles: [], personId: PERSON_ID },
      correlationId: asCorrelationId('ordinary-accessibility-context'),
      occurredAt: asIsoDateTime(NOW)
    } satisfies RepositoryExecutionContext;
    expect(() => new SqliteAccessibilityPreferencesRepository().find(
      ordinary as PolicyAuthorizedRepositoryExecutionContext,
      ACCOUNT_ID
    )).toThrow(/forged|transaction context/i);

    const mismatch = preferenceMutation(2, {
      clientOperationId: first.clientOperationId,
      requestFingerprint: 'f'.repeat(64)
    });
    const rejected = await executePolicy(database, 'update', ACCOUNT_ID, (repository, context) => (
      repository.insertMutation(context, mismatch)
    ));
    expect(rejected.ok).toBe(false);

    expect(() => database.prepare(
      'UPDATE accessibility_preference_mutations SET text_scale_percent=150 WHERE id=?'
    ).run(first.id)).toThrow(/immutable/i);
    expect(() => database.prepare(
      'DELETE FROM accessibility_preferences WHERE account_id=?'
    ).run(ACCOUNT_ID)).toThrow(/forbidden/i);
  });

  it('fails closed on invalid values and stale optimistic revisions', async () => {
    const database = openFixture();
    const invalid = preferenceMutation(1, { textScalePercent: 226 });
    const rejected = await executePolicy(database, 'create', ACCOUNT_ID, (repository, context) => (
      repository.insertMutation(context, invalid)
    ));
    expect(rejected.ok).toBe(false);

    const first = preferenceMutation(1, { id: 'accessibility-valid-first' });
    await executePolicy(database, 'create', ACCOUNT_ID, (repository, context) => {
      const inserted = repository.insertMutation(context, first);
      return inserted.ok ? repository.saveCurrent(context, currentRow(first), 0) : inserted;
    });
    const stale = preferenceMutation(3, { previousRevision: 2 });
    const staleResult = await executePolicy(database, 'update', ACCOUNT_ID, (repository, context) => (
      repository.insertMutation(context, stale)
    ));
    expect(staleResult.ok).toBe(false);
  });
});

describe('migration 90 accessibility preference durability', () => {
  it('installs strict current and immutable mutation tables', () => {
    const database = openFixture();
    expect(migration90.name).toBe('b7_accessibility_preferences');
    expect(database.prepare("SELECT value FROM database_metadata WHERE key='schema_generation'").get())
      .toEqual({ value: 'REVISION-33-M-ACCESSIBILITY-PREFERENCES' });
    expect(database.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN ('accessibility_preferences','accessibility_preference_mutations')
      ORDER BY name
    `).all()).toHaveLength(2);
  });
});
