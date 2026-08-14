import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId, asUserId } from '@ppt/core';
import { sha256Hex } from '@ppt/security';
import type { RepositoryTransaction } from '@ppt/contracts';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import { PlatformPolicyEnforcementPoint, PlatformPolicyKernel, type PlatformPolicyReceiptRecord } from '@ppt/platform-policy';
import type {
  FormDraftMutationRow,
  FormDraftRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import {
  FORM_DRAFT_MAX_CURRENT_PER_ACCOUNT,
  FORM_DRAFT_MAX_IMMUTABLE_MUTATIONS_PER_RESOURCE,
  SqliteFormDraftRepository
} from './src/form-draft-repository.js';
import { computePlatformPolicyReceiptHash } from './src/platform-policy-transaction-repository.js';

const NOW = '2026-08-14T06:00:00.000Z';
const FAMILY_ID = asFamilyId('family-form-draft-a');
const PERSON_ID = asPersonId('person-form-draft-a');
const ACCOUNT_ID = asUserId('account-form-draft-a');
const FORM_KEY = 'profile.intake';
const RESOURCE_ID = `form_draft/${ACCOUNT_ID}/${FORM_KEY}`;
const FENCE_NAME = 'form-draft-write';
const FENCE_EPOCH = 91;
const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

const fixtureSchema = `
  PRAGMA foreign_keys=ON;
  CREATE TABLE families(id TEXT PRIMARY KEY);
  CREATE TABLE people(id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id),status TEXT NOT NULL);
  CREATE TABLE accounts(id TEXT PRIMARY KEY,person_id TEXT NOT NULL REFERENCES people(id),status TEXT NOT NULL);
  CREATE TABLE database_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
  CREATE TABLE platform_policy_database_fences(
    fence_name TEXT PRIMARY KEY,epoch INTEGER NOT NULL,writable INTEGER NOT NULL,synchronized_at TEXT NOT NULL
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
  INSERT INTO database_metadata VALUES('schema_generation','before-33-n','${NOW}');
  INSERT INTO platform_policy_database_fences VALUES('${FENCE_NAME}',${FENCE_EPOCH},1,'${NOW}');
`;

const migration91 = FAMILY_DATABASE_MIGRATIONS.find(({ version }) => version === 91);
if (!migration91) throw new Error('MIGRATION_91_NOT_FOUND');

const openFixture = (): DatabaseSync => {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  database.exec(fixtureSchema);
  database.exec(migration91.sql);
  return database;
};

const kernel = new PlatformPolicyKernel({
  policyVersion: '33-n-form-draft-repository-test-v1',
  signingKey: Buffer.from('33-n-form-draft-controlled-test-key', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

let sequence = 0;

const persistReceipt = (database: DatabaseSync, record: PlatformPolicyReceiptRecord): void => {
  const receiptHash = computePlatformPolicyReceiptHash(record.receipt);
  const recordJson = JSON.stringify(record);
  database.prepare(`
    INSERT INTO platform_policy_transaction_receipts(
      receipt_hash,receipt_version,request_hash,context_hash,data_classes_json,
      obligation_execution_hash,policy_package_version,policy_package_sha256,
      application_version,capability_manifest_sha256,device_certificate_sha256,
      decision_authority_id,nonce,correlation_id,policy_version,resource_type,resource_id,
      action,capability,fence_name,fence_epoch,fence_writable,issued_at,recorded_at,record_json
    ) VALUES(${Array.from({ length: 25 }, () => '?').join(',')})
  `).run(
    receiptHash, record.receipt.receiptVersion, record.receipt.requestHash, record.contextHash,
    JSON.stringify(record.dataClasses), record.obligationExecution!.attestationHash,
    record.policyPackageVersion, record.policyPackageSha256, record.applicationVersion,
    record.capabilityManifestSha256, record.deviceCertificateSha256 ?? null,
    record.decisionAuthorityId ?? null, record.receipt.nonce, record.correlationId,
    record.decision.policyVersion, record.resourceType, record.resourceId, record.action,
    record.capability, FENCE_NAME, FENCE_EPOCH, 1, record.receipt.issuedAt, record.recordedAt, recordJson
  );
  database.prepare(`
    INSERT INTO platform_policy_journal_projection_outbox(receipt_hash,record_json,status,created_at,projected_at)
    VALUES(?,?,'pending',?,NULL)
  `).run(receiptHash, recordJson, record.recordedAt);
};

const executePolicy = async <T>(
  database: DatabaseSync,
  action: 'read' | 'create' | 'update',
  operation: (repository: SqliteFormDraftRepository, context: PolicyAuthorizedRepositoryExecutionContext) => RepositoryResult<T>,
  formKey = FORM_KEY
): Promise<RepositoryResult<T>> => {
  sequence += 1;
  const correlationId = asCorrelationId(`correlation-form-draft-${sequence}`);
  const capability = action === 'read' ? 'family.read' : 'family.write';
  const resourceId = `form_draft/${ACCOUNT_ID}/${formKey}`;
  const pep = new PlatformPolicyEnforcementPoint({
    kernel,
    authorityResolver: {
      resolve: () => ({
        policyVersion: '33-n-form-draft-repository-test-v1', accountId: ACCOUNT_ID,
        personId: PERSON_ID, deviceId: 'device-form-draft-a', applicationId: 'windows-desktop',
        deviceTrusted: true, membershipActive: true, roles: ['family_admin'], familyIds: [FAMILY_ID],
        grants: [{
          id: `grant-${sequence}`, subjectAccountId: ACCOUNT_ID, resourceType: 'form_draft',
          resourceId, actions: [action], effect: 'allow', purpose: 'general',
          startsAt: '2026-08-14T00:00:00.000Z'
        }],
        online: true, expiresAt: '2026-08-14T07:00:00.000Z'
      })
    },
    resourceResolver: { resolve: () => ({
      type: 'form_draft', id: resourceId, familyId: FAMILY_ID,
      ownerPersonId: PERSON_ID, sensitivity: 'personal'
    }) },
    receiptSink: { append: (record) => persistReceipt(database, record) },
    replayStore: { reserve: () => true },
    clock: () => NOW,
    nonceFactory: () => `nonce-form-draft-${sequence}`
  });
  return pep.execute({
    correlationId, action, capability, resourceType: 'form_draft', resourceId, purpose: 'general'
  }, () => ({ writable: true, epoch: FENCE_EPOCH }), (policyAuthorization) => operation(
    new SqliteFormDraftRepository(),
    {
      transaction: database as unknown as RepositoryTransaction,
      actor: { userId: ACCOUNT_ID, roles: ['family_admin'], personId: PERSON_ID },
      correlationId, occurredAt: asIsoDateTime(NOW), policyAuthorization
    }
  ));
};

const mutation = (revision: number, overrides: Partial<FormDraftMutationRow> = {}): FormDraftMutationRow => {
  const payloadJson = JSON.stringify({ step: revision });
  return {
    id: `form-draft-mutation-${revision}-${sequence}`,
    clientOperationId: `form-draft-operation-${revision}-${sequence}`,
    requestFingerprint: revision.toString(16).padStart(64, '0'),
    familyId: FAMILY_ID, accountId: ACCOUNT_ID, ownerPersonId: PERSON_ID,
    formKey: FORM_KEY, resourceId: RESOURCE_ID, operation: 'save',
    previousRevision: revision - 1, revision,
    payloadJson,
    payloadFingerprint: sha256Hex(payloadJson),
    restoredFromRevision: null, createdAt: asIsoDateTime(NOW), ...overrides
  };
};

const currentRow = (item: FormDraftMutationRow, createdAt = item.createdAt): FormDraftRow => ({
  resourceId: item.resourceId, familyId: item.familyId, accountId: item.accountId,
  ownerPersonId: item.ownerPersonId, formKey: item.formKey, revision: item.revision,
  payloadJson: item.payloadJson, payloadFingerprint: item.payloadFingerprint,
  createdAt, updatedAt: item.createdAt, lastMutationId: item.id
});

const write = async (database: DatabaseSync, item: FormDraftMutationRow, createdAt = item.createdAt) => (
  executePolicy(database, item.previousRevision === 0 ? 'create' : 'update', (repository, context) => {
    const inserted = repository.insertMutation(context, item);
    return inserted.ok ? repository.saveCurrent(context, currentRow(item, createdAt), item.previousRevision) : inserted;
  }, item.formKey)
);

describe('33-N form draft repository policy boundary', () => {
  it('saves, updates, undoes and retains the exact immutable revision history', async () => {
    const database = openFixture();
    const first = mutation(1);
    expect(await write(database, first)).toEqual({ ok: true, value: true });
    const second = mutation(2);
    expect(await write(database, second, first.createdAt)).toEqual({ ok: true, value: true });
    const undo = mutation(3, {
      operation: 'undo', payloadJson: first.payloadJson, payloadFingerprint: first.payloadFingerprint,
      restoredFromRevision: 1
    });
    expect(await write(database, undo, first.createdAt)).toEqual({ ok: true, value: true });

    const read = await executePolicy(database, 'read', (repository, context) => repository.find(context, ACCOUNT_ID, FORM_KEY));
    expect(read).toEqual(expect.objectContaining({
      ok: true, value: expect.objectContaining({ revision: 3, payloadJson: first.payloadJson })
    }));
    expect(database.prepare(`
      SELECT revision,operation,restored_from_revision FROM governed_form_draft_mutations ORDER BY revision
    `).all()).toEqual([
      { revision: 1, operation: 'save', restored_from_revision: null },
      { revision: 2, operation: 'save', restored_from_revision: null },
      { revision: 3, operation: 'undo', restored_from_revision: 1 }
    ]);

    const resolutionContext = {
      transaction: database as unknown as RepositoryTransaction,
      actor: { userId: ACCOUNT_ID, roles: ['policy_runtime'], personId: PERSON_ID },
      correlationId: asCorrelationId('form-draft-policy-resolution'), occurredAt: asIsoDateTime(NOW)
    } satisfies RepositoryExecutionContext;
    expect(new SqliteFormDraftRepository().findForPolicyResolution(resolutionContext, ACCOUNT_ID, FORM_KEY))
      .toEqual(expect.objectContaining({ ok: true, value: expect.objectContaining({ revision: 3 }) }));
  });

  it('rejects forged and wrong owner, family, resource, purpose, sensitivity and receipt contexts', async () => {
    const database = openFixture();
    let validContext!: PolicyAuthorizedRepositoryExecutionContext;
    await executePolicy(database, 'create', (_repository, context) => {
      validContext = context;
      return { ok: true, value: undefined };
    });
    const repository = new SqliteFormDraftRepository();
    const ordinary = {
      transaction: database as unknown as RepositoryTransaction,
      actor: validContext.actor, correlationId: validContext.correlationId, occurredAt: validContext.occurredAt
    } as PolicyAuthorizedRepositoryExecutionContext;
    expect(() => repository.find(ordinary, ACCOUNT_ID, FORM_KEY)).toThrow(/forged|transaction context/i);

    const authorization = validContext.policyAuthorization;
    const reject = (policyAuthorization: typeof authorization) => expect(() => repository.find(
      { ...validContext, policyAuthorization }, ACCOUNT_ID, FORM_KEY
    )).toThrow();
    reject({ ...authorization, resourceOwnerPersonId: 'person-wrong' });
    reject({ ...authorization, resourceFamilyId: 'family-wrong' });
    reject({ ...authorization, resourceId: 'form_draft/account-wrong/profile.intake' });
    reject({ ...authorization, receiptRecord: {
      ...authorization.receiptRecord,
      request: { ...authorization.receiptRecord.request, purpose: 'timeline' }
    } });
    reject({ ...authorization, receiptRecord: {
      ...authorization.receiptRecord,
      request: { ...authorization.receiptRecord.request, resource: {
        ...authorization.receiptRecord.request.resource, sensitivity: 'highly_sensitive'
      } }
    } });
    reject({ ...authorization, receiptRecord: {
      ...authorization.receiptRecord,
      request: { ...authorization.receiptRecord.request, subject: {
        ...authorization.receiptRecord.request.subject, accountId: 'account-forged'
      } }
    } });
  });

  it('rejects optimistic stale revisions, idempotency mismatch and a missing durable projection receipt', async () => {
    const database = openFixture();
    const first = mutation(1);
    expect((await write(database, first)).ok).toBe(true);

    const mismatch = mutation(2, {
      clientOperationId: first.clientOperationId, requestFingerprint: 'f'.repeat(64)
    });
    expect((await executePolicy(database, 'update', (repository, context) => repository.insertMutation(context, mismatch))).ok)
      .toBe(false);

    const stale = mutation(3, { previousRevision: 2 });
    expect((await executePolicy(database, 'update', (repository, context) => repository.insertMutation(context, stale))).ok)
      .toBe(false);

    const noProjection = mutation(2, { id: 'form-draft-no-projection' });
    const rejected = await executePolicy(database, 'update', (repository, context) => {
      database.prepare('DELETE FROM platform_policy_journal_projection_outbox WHERE receipt_hash=?')
        .run(computePlatformPolicyReceiptHash(context.policyAuthorization.receipt));
      return repository.insertMutation(context, noProjection);
    });
    expect(rejected.ok).toBe(false);
  });

  it('rejects non-canonical payloads, banking-secret fields and incorrect payload fingerprints at the repository boundary', async () => {
    const database = openFixture();
    let validContext!: PolicyAuthorizedRepositoryExecutionContext;
    await executePolicy(database, 'create', (_repository, context) => {
      validContext = context;
      return { ok: true, value: undefined };
    });
    const repository = new SqliteFormDraftRepository();
    const secretPayload = '{"cvv":"never"}';
    expect(() => repository.insertMutation(validContext, mutation(1, {
      payloadJson: secretPayload,
      payloadFingerprint: sha256Hex(secretPayload)
    }))).toThrow(/without banking secrets/i);
    const nonCanonicalPayload = '{"z":1,"a":2}';
    expect(() => repository.insertMutation(validContext, mutation(1, {
      payloadJson: nonCanonicalPayload,
      payloadFingerprint: sha256Hex(nonCanonicalPayload)
    }))).toThrow(/canonical representation/i);
    expect(() => repository.insertMutation(validContext, mutation(1, {
      payloadFingerprint: 'f'.repeat(64)
    }))).toThrow(/fingerprint/i);
  });

  it('rejects non-immediate undo and direct mutation or deletion of durable rows', async () => {
    const database = openFixture();
    const first = mutation(1); await write(database, first);
    const second = mutation(2); await write(database, second, first.createdAt);
    const third = mutation(3); await write(database, third, first.createdAt);
    const nonImmediate = mutation(4, {
      operation: 'undo', payloadJson: first.payloadJson, payloadFingerprint: first.payloadFingerprint,
      restoredFromRevision: 1
    });
    expect((await executePolicy(database, 'update', (repository, context) => repository.insertMutation(context, nonImmediate))).ok)
      .toBe(false);

    expect(() => database.prepare('UPDATE governed_form_draft_mutations SET payload_json=? WHERE id=?')
      .run('{"forged":true}', first.id)).toThrow(/immutable/i);
    expect(() => database.prepare('DELETE FROM governed_form_draft_mutations WHERE id=?').run(first.id))
      .toThrow(/forbidden/i);
    expect(() => database.prepare('DELETE FROM governed_form_drafts WHERE resource_id=?').run(RESOURCE_ID))
      .toThrow(/forbidden/i);
  });

  it('fails closed at the per-account current formKey quota without deleting prior drafts', async () => {
    const database = openFixture();
    for (let index = 0; index < FORM_DRAFT_MAX_CURRENT_PER_ACCOUNT; index += 1) {
      const formKey = `quota.${index.toString().padStart(3, '0')}`;
      const item = mutation(1, {
        id: `quota-current-mutation-${index}`,
        clientOperationId: `quota-current-operation-${index}`,
        formKey,
        resourceId: `form_draft/${ACCOUNT_ID}/${formKey}`
      });
      expect((await write(database, item)).ok).toBe(true);
    }
    const deniedKey = 'quota.denied';
    const denied = mutation(1, {
      id: 'quota-current-mutation-denied',
      clientOperationId: 'quota-current-operation-denied',
      formKey: deniedKey,
      resourceId: `form_draft/${ACCOUNT_ID}/${deniedKey}`
    });
    expect((await write(database, denied)).ok).toBe(false);
    expect(database.prepare('SELECT COUNT(*) AS count FROM governed_form_drafts WHERE account_id=?')
      .get(ACCOUNT_ID)).toEqual({ count: FORM_DRAFT_MAX_CURRENT_PER_ACCOUNT });
    expect(database.prepare('SELECT COUNT(*) AS count FROM governed_form_draft_mutations WHERE account_id=?')
      .get(ACCOUNT_ID)).toEqual({ count: FORM_DRAFT_MAX_CURRENT_PER_ACCOUNT });
  });

  it('fails closed at immutable history quota while preserving idempotent history and current state', async () => {
    const database = openFixture();
    const first = mutation(1);
    expect((await write(database, first)).ok).toBe(true);
    for (let revision = 2; revision <= FORM_DRAFT_MAX_IMMUTABLE_MUTATIONS_PER_RESOURCE; revision += 1) {
      expect((await write(database, mutation(revision), first.createdAt)).ok).toBe(true);
    }
    const denied = mutation(FORM_DRAFT_MAX_IMMUTABLE_MUTATIONS_PER_RESOURCE + 1);
    expect((await executePolicy(database, 'update', (repository, context) => (
      repository.insertMutation(context, denied)
    ))).ok).toBe(false);
    expect(database.prepare('SELECT COUNT(*) AS count FROM governed_form_draft_mutations WHERE resource_id=?')
      .get(RESOURCE_ID)).toEqual({ count: FORM_DRAFT_MAX_IMMUTABLE_MUTATIONS_PER_RESOURCE });
    expect(database.prepare('SELECT revision FROM governed_form_drafts WHERE resource_id=?').get(RESOURCE_ID))
      .toEqual({ revision: FORM_DRAFT_MAX_IMMUTABLE_MUTATIONS_PER_RESOURCE });
    expect(database.prepare('SELECT COUNT(*) AS count FROM governed_form_draft_mutations WHERE id=?')
      .get(first.id)).toEqual({ count: 1 });
  });
});

describe('migration 91 governed form draft durability', () => {
  it('installs strict current and immutable history tables', () => {
    const database = openFixture();
    expect(migration91.name).toBe('b3_governed_form_drafts');
    expect(database.prepare("SELECT value FROM database_metadata WHERE key='schema_generation'").get())
      .toEqual({ value: 'REVISION-33-N-DRAFT-ASYNC-STATE-UX' });
    expect(database.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN ('governed_form_drafts','governed_form_draft_mutations') ORDER BY name
    `).all()).toHaveLength(2);
    expect(database.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='trigger' AND name IN (
        'trg_form_draft_account_current_quota','trg_form_draft_immutable_history_quota'
      ) ORDER BY name
    `).all()).toEqual([
      { name: 'trg_form_draft_account_current_quota' },
      { name: 'trg_form_draft_immutable_history_quota' }
    ]);
  });
});
