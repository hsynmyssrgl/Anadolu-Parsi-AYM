import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { afterEach, describe, expect, it } from 'vitest';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId, asUserId } from '@ppt/core';
import type { RepositoryTransaction } from '@ppt/contracts';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  type PlatformPolicyReceiptRecord,
  type PolicyAction
} from '@ppt/platform-policy';
import type {
  LocalGovernedOcrJobRow,
  LocalGovernedOcrMutationRow,
  LocalGovernedOcrSettingsRow,
  LocalGovernedOcrSourceDeletionBatch,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';

import {
  computeLocalGovernedOcrJobStateFingerprint,
  computeLocalGovernedOcrSettingsStateFingerprint,
  SqliteLocalGovernedOcrRepository
} from './src/local-governed-ocr-repository.js';
import { computePlatformPolicyReceiptHash } from './src/platform-policy-transaction-repository.js';

const NOW = '2026-08-14T09:00:00.000Z';
const FAMILY_ID = asFamilyId('family-33-q');
const PERSON_ID = asPersonId('person-33-q');
const ACCOUNT_ID = asUserId('account-33-q');
const SOURCE_SHA = 'a'.repeat(64);
const FENCE_NAME = 'local-ocr-write';
const FENCE_EPOCH = 94;
const databases: DatabaseSync[] = [];

afterEach(() => { for (const database of databases.splice(0)) database.close(); });

const migration94 = FAMILY_DATABASE_MIGRATIONS.find(({ version }) => version === 94);
if (!migration94) throw new Error('MIGRATION_94_NOT_FOUND');

const fixtureSchema = `
PRAGMA foreign_keys=ON;
CREATE TABLE families(id TEXT PRIMARY KEY);
CREATE TABLE people(id TEXT PRIMARY KEY,family_id TEXT NOT NULL,status TEXT NOT NULL);
CREATE TABLE accounts(id TEXT PRIMARY KEY,person_id TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE database_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE platform_policy_database_fences(fence_name TEXT PRIMARY KEY,epoch INTEGER NOT NULL,writable INTEGER NOT NULL,synchronized_at TEXT NOT NULL);
CREATE TABLE platform_policy_transaction_receipts(
  receipt_hash TEXT PRIMARY KEY,receipt_version INTEGER NOT NULL,request_hash TEXT NOT NULL,context_hash TEXT NOT NULL,
  data_classes_json TEXT NOT NULL,obligation_execution_hash TEXT NOT NULL,policy_package_version INTEGER NOT NULL,
  policy_package_sha256 TEXT NOT NULL,application_version TEXT NOT NULL,capability_manifest_sha256 TEXT,
  device_certificate_sha256 TEXT,decision_authority_id TEXT,nonce TEXT NOT NULL,correlation_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,action TEXT NOT NULL,
  capability TEXT NOT NULL,fence_name TEXT NOT NULL,fence_epoch INTEGER NOT NULL,fence_writable INTEGER NOT NULL,
  issued_at TEXT NOT NULL,recorded_at TEXT NOT NULL,record_json TEXT NOT NULL
);
CREATE TABLE platform_policy_journal_projection_outbox(receipt_hash TEXT PRIMARY KEY,record_json TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,projected_at TEXT);
CREATE TABLE archive_retention_policies(id TEXT PRIMARY KEY,retention_days INTEGER NOT NULL);
CREATE TABLE archive_items(
  id TEXT PRIMARY KEY,family_id TEXT NOT NULL,title TEXT NOT NULL,original_name TEXT NOT NULL,stored_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,size_bytes INTEGER NOT NULL,sha256 TEXT NOT NULL,sensitivity TEXT NOT NULL,ai_processing_allowed INTEGER NOT NULL,
  retention_policy_id TEXT,destroyed_at TEXT,created_at TEXT NOT NULL,policy_receipt_hash TEXT NOT NULL
);
CREATE TABLE ai_consents(id TEXT PRIMARY KEY,account_id TEXT NOT NULL,purpose TEXT NOT NULL,resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,status TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT,created_at TEXT NOT NULL);
CREATE TABLE object_permissions(
  id TEXT PRIMARY KEY,subject_account_id TEXT NOT NULL,resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,
  actions TEXT NOT NULL,effect TEXT NOT NULL,purpose TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT
);
CREATE TABLE derived_data_policy_bindings(
  binding_hash TEXT PRIMARY KEY,status TEXT NOT NULL,derived_kind TEXT NOT NULL,derived_resource_id TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,family_id TEXT NOT NULL
);
CREATE TABLE derived_data_policy_sources(
  binding_hash TEXT NOT NULL,source_resource_type TEXT NOT NULL,source_resource_id TEXT NOT NULL,content_sha256 TEXT NOT NULL
);
INSERT INTO families VALUES('${FAMILY_ID}');
INSERT INTO people VALUES('${PERSON_ID}','${FAMILY_ID}','active');
INSERT INTO accounts VALUES('${ACCOUNT_ID}','${PERSON_ID}','active','${NOW}');
INSERT INTO database_metadata VALUES('schema_generation','before-33-q','${NOW}');
INSERT INTO platform_policy_database_fences VALUES('${FENCE_NAME}',${FENCE_EPOCH},1,'${NOW}');
`;

const openFixture = (): DatabaseSync => {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  database.exec(fixtureSchema);
  database.exec(migration94.sql);
  return database;
};

const kernel = new PlatformPolicyKernel({
  policyVersion: '33-q-local-ocr-repository-test-v1',
  signingKey: Buffer.from('33-q-local-ocr-controlled-test-signing-key', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write', 'archive.ocr', 'archive.write'] },
  consentRequiredCapabilities: [], onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'process', 'record']
});

let sequence = 0;
const persistReceipt = (database: DatabaseSync, record: PlatformPolicyReceiptRecord): void => {
  const receiptHash = computePlatformPolicyReceiptHash(record.receipt);
  const recordJson = JSON.stringify(record);
  database.prepare(`INSERT INTO platform_policy_transaction_receipts(
    receipt_hash,receipt_version,request_hash,context_hash,data_classes_json,obligation_execution_hash,
    policy_package_version,policy_package_sha256,application_version,capability_manifest_sha256,device_certificate_sha256,
    decision_authority_id,nonce,correlation_id,policy_version,resource_type,resource_id,action,capability,fence_name,
    fence_epoch,fence_writable,issued_at,recorded_at,record_json
  ) VALUES(${Array.from({ length: 25 }, () => '?').join(',')})`).run(receiptHash, record.receipt.receiptVersion,
    record.receipt.requestHash, record.contextHash, JSON.stringify(record.dataClasses), record.obligationExecution!.attestationHash,
    record.policyPackageVersion, record.policyPackageSha256, record.applicationVersion, record.capabilityManifestSha256,
    record.deviceCertificateSha256 ?? null, record.decisionAuthorityId ?? null, record.receipt.nonce, record.correlationId,
    record.decision.policyVersion, record.resourceType, record.resourceId, record.action, record.capability, FENCE_NAME,
    FENCE_EPOCH, 1, record.receipt.issuedAt, record.recordedAt, recordJson);
  database.prepare(`INSERT INTO platform_policy_journal_projection_outbox VALUES(?,?,'pending',?,NULL)`)
    .run(receiptHash, recordJson, record.recordedAt);
};

const policyParameters = (resourceType: string, action: PolicyAction): { capability: 'family.read' | 'family.write' | 'archive.ocr' | 'archive.write'; purpose: string; sensitivity: 'personal' | 'sensitive' } =>
  resourceType === 'local_ocr_settings'
    ? { capability: action === 'read' ? 'family.read' : 'family.write', purpose: 'administration', sensitivity: 'personal' }
    : { capability: action === 'delete' ? 'archive.write' : 'archive.ocr', purpose: 'ocr_process', sensitivity: 'sensitive' };

const executePolicy = async <T>(database: DatabaseSync, resourceType: string, resourceId: string, action: PolicyAction,
  operation: (repository: SqliteLocalGovernedOcrRepository, context: PolicyAuthorizedRepositoryExecutionContext) => RepositoryResult<T>,
  occurredAt = NOW, sensitivityOverride?: 'personal' | 'sensitive'): Promise<RepositoryResult<T>> => {
  sequence += 1;
  const parameters = policyParameters(resourceType, action);
  const correlationId = asCorrelationId(`local-ocr-correlation-${sequence}`);
  const pep = new PlatformPolicyEnforcementPoint({
    kernel,
    authorityResolver: { resolve: () => ({
      policyVersion: '33-q-local-ocr-repository-test-v1', accountId: ACCOUNT_ID, personId: PERSON_ID,
      deviceId: 'device-33-q', applicationId: 'windows-desktop', deviceTrusted: true, membershipActive: true,
      roles: ['family_admin'], familyIds: [FAMILY_ID], grants: [{ id: `grant-${sequence}`, subjectAccountId: ACCOUNT_ID,
        resourceType, resourceId, actions: [action], effect: 'allow', purpose: parameters.purpose,
        startsAt: '2026-01-01T00:00:00.000Z' }], online: true, expiresAt: '2026-12-31T23:59:59.999Z'
    }) },
    resourceResolver: { resolve: () => ({ type: resourceType, id: resourceId, familyId: FAMILY_ID,
      ownerPersonId: PERSON_ID, sensitivity: sensitivityOverride ?? parameters.sensitivity }) },
    receiptSink: { append: (record) => persistReceipt(database, record) }, replayStore: { reserve: () => true },
    clock: () => occurredAt, nonceFactory: () => `nonce-local-ocr-${sequence}`
  });
  return pep.execute({ correlationId, action, capability: parameters.capability, resourceType, resourceId,
    purpose: parameters.purpose }, () => ({ writable: true, epoch: FENCE_EPOCH }), (policyAuthorization) => operation(
      new SqliteLocalGovernedOcrRepository(), {
        transaction: database as unknown as RepositoryTransaction,
        actor: { userId: ACCOUNT_ID, roles: ['family_admin'], personId: PERSON_ID }, correlationId,
        occurredAt: asIsoDateTime(occurredAt), policyAuthorization
      }
    ));
};

const seedSource = async (database: DatabaseSync): Promise<void> => {
  database.prepare(`INSERT INTO ai_consents VALUES('consent-33-q',?,'sensitive_processing','archive_item','archive-33-q','granted',?,NULL,?)`)
    .run(ACCOUNT_ID, NOW, NOW);
  const seeded = await executePolicy(database, 'archive_item', 'archive-33-q', 'read', (_repository, context) => {
    const receiptHash = computePlatformPolicyReceiptHash(context.policyAuthorization.receipt);
    database.prepare(`INSERT INTO archive_items VALUES('archive-33-q',?,'Belge','belge.png','opaque-vault-id','image/png',128,?,'standard',1,NULL,NULL,?,?)`)
      .run(FAMILY_ID, SOURCE_SHA, NOW, receiptHash);
    return { ok: true, value: undefined };
  });
  expect(seeded.ok).toBe(true);
};

const queuedJob = (revision = 1): LocalGovernedOcrJobRow => {
  const base = Object.freeze({
    id: 'ocr-job-1', key: { familyId: FAMILY_ID, accountId: ACCOUNT_ID, ownerPersonId: PERSON_ID }, revision,
    source: { resourceType: 'archive_item' as const, resourceId: 'archive-33-q', inputSha256: SOURCE_SHA,
      mimeType: 'image/png', sizeBytes: 128 }, derivedResourceId: 'local-ocr-result:ocr-job-1',
    languageHints: Object.freeze(['tr']), status: 'queued' as const, runAttempt: 0, correctionRevision: 0,
    resultAvailable: false, consentId: 'consent-33-q', deletionPropagation: 'active' as const,
    processor: 'local_ocr' as const, networkUsed: false as const, cloudUsed: false as const,
    createdAt: asIsoDateTime(NOW), updatedAt: asIsoDateTime(NOW)
  });
  return Object.freeze({ ...base, stateFingerprint: computeLocalGovernedOcrJobStateFingerprint(base) });
};

const mutationFor = (row: LocalGovernedOcrJobRow): LocalGovernedOcrMutationRow => Object.freeze({
  id: `ocr-mutation-${row.revision}`, key: row.key, clientOperationId: `ocr-operation-${row.revision}`,
  requestFingerprint: createHash('sha256').update(`request-${row.revision}`).digest('hex'), mutationKind: 'job_create',
  resourceType: 'local_ocr_job', resourceId: row.id, previousRevision: row.revision - 1, revision: row.revision,
  stateFingerprint: row.stateFingerprint, occurredAt: asIsoDateTime(NOW)
});

describe('33-Q local governed OCR repository policy boundary', () => {
  it('keeps SQLite metadata-only and makes current and mutation ledgers tamper resistant', () => {
    const database = openFixture();
    const columns = (database.prepare(`SELECT name FROM pragma_table_info('local_governed_ocr_jobs')
      UNION ALL SELECT name FROM pragma_table_info('local_governed_ocr_mutations')`).all() as { name: string }[]).map(({ name }) => name);
    expect(columns.some((name) => /(?:ocr_text|plaintext|document_bytes|file_path|vault_path|token|password|secret)/u.test(name))).toBe(false);
    expect(columns).toContain('sealed_result_id');
    expect(migration94.sql).toContain("processor TEXT NOT NULL CHECK(processor='local_ocr')");
    expect(migration94.sql).toContain('network_used INTEGER NOT NULL CHECK(network_used=0)');
    expect(() => database.prepare(`DELETE FROM local_governed_ocr_settings`).run()).not.toThrow();
  });

  it('resolves only a fresh source receipt plus exact owner and active explicit sensitive-processing consent', async () => {
    const database = openFixture();
    await seedSource(database);
    const source = await executePolicy(database, 'archive_item', 'archive-33-q', 'read', (repository, context) =>
      repository.resolveArchiveSource(context, { familyId: FAMILY_ID, accountId: ACCOUNT_ID, ownerPersonId: PERSON_ID }, 'archive-33-q'), NOW, 'personal');
    expect(source).toEqual(expect.objectContaining({ ok: true, value: expect.objectContaining({
      inputSha256: SOURCE_SHA,
      sourcePolicy: expect.objectContaining({ receiptActive: true, sensitivity: 'personal',
        allowedPurposes: ['ocr_process'], allowedCapabilities: ['archive.ocr'] })
    }) }));
    const metadata = await executePolicy(database, 'archive_item', 'archive-33-q', 'read', (repository, context) =>
      repository.resolveArchivePolicyResource(context, { familyId: FAMILY_ID, accountId: ACCOUNT_ID, ownerPersonId: PERSON_ID }, 'archive-33-q'), NOW, 'personal');
    expect(metadata).toEqual(expect.objectContaining({ ok: true, value: expect.objectContaining({ sensitivity: 'personal' }) }));
    const locator = await executePolicy(database, 'archive_item', 'archive-33-q', 'read', (repository, context) =>
      repository.resolveAuthorizedArchiveVaultLocator(context,
        { familyId: FAMILY_ID, accountId: ACCOUNT_ID, ownerPersonId: PERSON_ID }, 'archive-33-q'), NOW, 'personal');
    expect(locator).toEqual(expect.objectContaining({ ok: true, value: expect.objectContaining({
      resourceId: 'archive-33-q', storedName: 'opaque-vault-id', originalName: 'belge.png',
      inputSha256: SOURCE_SHA, mimeType: 'image/png', sizeBytes: 128
    }) }));
    await expect(executePolicy(database, 'archive_item', 'archive-33-q', 'delete', (repository, context) =>
      repository.resolveAuthorizedArchiveVaultLocator(context,
        { familyId: FAMILY_ID, accountId: ACCOUNT_ID, ownerPersonId: PERSON_ID }, 'archive-33-q')))
      .rejects.toThrow(/OCR source policy scope is invalid/u);
    const consent = await executePolicy(database, 'archive_item', 'archive-33-q', 'read', (repository, context) =>
      repository.resolveActiveSensitiveProcessingConsent(context, { familyId: FAMILY_ID, accountId: ACCOUNT_ID, ownerPersonId: PERSON_ID },
        'archive_item', 'archive-33-q', NOW));
    expect(consent).toEqual(expect.objectContaining({ ok: true, value: expect.objectContaining({ id: 'consent-33-q', status: 'granted' }) }));
    database.prepare(`UPDATE ai_consents SET status='revoked' WHERE id='consent-33-q'`).run();
    const revoked = await executePolicy(database, 'archive_item', 'archive-33-q', 'read', (repository, context) =>
      repository.resolveActiveSensitiveProcessingConsent(context, { familyId: FAMILY_ID, accountId: ACCOUNT_ID, ownerPersonId: PERSON_ID },
        'archive_item', 'archive-33-q', NOW));
    expect(revoked).toEqual({ ok: true, value: null });
  });

  it('creates one idempotent metadata-only job and rejects forged direct writes', async () => {
    const database = openFixture(); await seedSource(database);
    const row = queuedJob(); const mutation = mutationFor(row);
    const created = await executePolicy(database, 'local_ocr_job', row.id, 'process', (repository, context) => {
      const inserted = repository.insertMutation(context, mutation);
      return inserted.ok ? repository.insertJob(context, row) : inserted;
    }, NOW, 'personal');
    expect(created).toEqual({ ok: true, value: undefined });
    expect(database.prepare(`SELECT id,revision,status,result_available,network_used,cloud_used FROM local_governed_ocr_jobs`).get())
      .toEqual({ id: row.id, revision: 1, status: 'queued', result_available: 0, network_used: 0, cloud_used: 0 });
    const replay = await executePolicy(database, 'local_ocr_job', row.id, 'process', (repository, context) =>
      repository.findMutationByClientOperationId(context, row.key, mutation.clientOperationId));
    expect(replay).toEqual(expect.objectContaining({ ok: true, value: expect.objectContaining({ requestFingerprint: mutation.requestFingerprint }) }));
    expect(() => database.prepare(`UPDATE local_governed_ocr_mutations SET state_fingerprint=?`).run('b'.repeat(64))).toThrow(/immutable/u);
    expect(() => database.prepare(`DELETE FROM local_governed_ocr_jobs WHERE id=?`).run(row.id)).toThrow(/cannot be physically deleted/u);
  });

  it('prunes only exact-owner expired unreferenced mutation metadata and rolls pruning back when insertion fails', async () => {
    const database = openFixture();
    const key = { familyId: FAMILY_ID, accountId: ACCOUNT_ID, ownerPersonId: PERSON_ID };
    const mutation = (id: string, clientOperationId: string, resourceId: string, occurredAt: string): LocalGovernedOcrMutationRow =>
      Object.freeze({ id, key, clientOperationId, requestFingerprint: createHash('sha256').update(clientOperationId).digest('hex'),
        mutationKind: 'job_create', resourceType: 'local_ocr_job', resourceId, previousRevision: 0, revision: 1,
        stateFingerprint: createHash('sha256').update(resourceId).digest('hex'), occurredAt: asIsoDateTime(occurredAt) });
    const oldAt = '2026-06-01T09:00:00.000Z';
    const old = mutation('old-orphan-mutation', 'old-orphan-operation', 'old-orphan-resource', oldAt);
    const recent = mutation('recent-orphan-mutation', 'recent-orphan-operation', 'recent-orphan-resource', NOW);
    expect((await executePolicy(database, 'local_ocr_job', recent.resourceId, 'process', (repository, context) =>
      repository.insertMutation(context, recent))).ok).toBe(true);
    expect((await executePolicy(database, 'local_ocr_job', old.resourceId, 'process', (repository, context) =>
      repository.insertMutation(context, old), oldAt)).ok).toBe(true);
    expect(() => database.prepare(`DELETE FROM local_governed_ocr_mutations WHERE id=?`).run(recent.id))
      .toThrow(/thirty-day grace/u);

    const colliding = mutation(recent.id, 'colliding-operation', 'colliding-resource', NOW);
    const rejected = await executePolicy(database, 'local_ocr_job', colliding.resourceId, 'process', (repository, context) =>
      repository.insertMutation(context, colliding));
    expect(rejected.ok).toBe(false);
    expect(database.prepare(`SELECT COUNT(*) AS count FROM local_governed_ocr_mutations WHERE id=?`).get(old.id))
      .toEqual({ count: 1 });

    const accepted = mutation('accepted-mutation', 'accepted-operation', 'accepted-resource', NOW);
    expect((await executePolicy(database, 'local_ocr_job', accepted.resourceId, 'process', (repository, context) =>
      repository.insertMutation(context, accepted))).ok).toBe(true);
    expect(database.prepare(`SELECT COUNT(*) AS count FROM local_governed_ocr_mutations WHERE id=?`).get(old.id))
      .toEqual({ count: 0 });
    expect(database.prepare(`SELECT COUNT(*) AS count FROM local_governed_ocr_mutations`).get())
      .toEqual({ count: 2 });
  });

  it('persists source deletion as one archive-authorized batch plus repository-derived immutable item ledgers', async () => {
    const database = openFixture(); await seedSource(database);
    const row = queuedJob(); const firstMutation = mutationFor(row);
    expect((await executePolicy(database, 'local_ocr_job', row.id, 'process', (repository, context) => {
      const inserted = repository.insertMutation(context, firstMutation);
      return inserted.ok ? repository.insertJob(context, row) : inserted;
    })).ok).toBe(true);

    const { stateFingerprint: _stateFingerprint, ...currentView } = row;
    const nextBase = Object.freeze({ ...currentView, revision: 2, status: 'deleted' as const,
      resultAvailable: false, deletedAt: asIsoDateTime(NOW), sourceDeletedAt: asIsoDateTime(NOW),
      deletionPropagation: 'locally_deleted' as const, updatedAt: asIsoDateTime(NOW) });
    const next: LocalGovernedOcrJobRow = Object.freeze({ ...nextBase,
      stateFingerprint: computeLocalGovernedOcrJobStateFingerprint(nextBase) });
    const aggregateFingerprint = createHash('sha256').update(JSON.stringify([
      { id: next.id, revision: next.revision, stateFingerprint: next.stateFingerprint }
    ])).digest('hex');
    const batchMutation: LocalGovernedOcrMutationRow & { readonly mutationKind: 'source_delete_propagate';
      readonly resourceType: 'local_ocr_job' } = Object.freeze({ id: 'ocr-source-delete-batch', key: row.key,
      clientOperationId: 'ocr-source-delete-operation', requestFingerprint: '7'.repeat(64),
      mutationKind: 'source_delete_propagate', resourceType: 'local_ocr_job', resourceId: 'archive-33-q',
      previousRevision: 0, revision: 1, stateFingerprint: aggregateFingerprint, occurredAt: asIsoDateTime(NOW) });
    const batch: LocalGovernedOcrSourceDeletionBatch = Object.freeze({ sourceResourceType: 'archive_item',
      sourceResourceId: 'archive-33-q', batchMutation, items: Object.freeze([{ previous: row, next }]) });

    const forged = await executePolicy(database, 'archive_item', 'archive-33-q', 'delete', (repository, context) =>
      repository.propagateSourceDeletion(context, { ...batch,
        batchMutation: { ...batchMutation, stateFingerprint: 'f'.repeat(64) } }));
    expect(forged.ok).toBe(false);
    expect(database.prepare(`SELECT revision,status FROM local_governed_ocr_jobs WHERE id=?`).get(row.id))
      .toEqual({ revision: 1, status: 'queued' });
    expect(database.prepare(`SELECT COUNT(*) count FROM local_governed_ocr_source_deletion_items`).get()).toEqual({ count: 0 });

    const propagated = await executePolicy(database, 'archive_item', 'archive-33-q', 'delete', (repository, context) => {
      const listed = repository.listJobsBySource(context, row.key, 'archive_item', 'archive-33-q');
      expect(listed).toEqual(expect.objectContaining({ ok: true, value: [expect.objectContaining({ id: row.id })] }));
      return listed.ok ? repository.propagateSourceDeletion(context, batch) : listed;
    });
    expect(propagated).toEqual({ ok: true, value: undefined });
    expect(database.prepare(`SELECT revision,status,result_available,source_deleted_at,deletion_propagation,last_mutation_id
      FROM local_governed_ocr_jobs WHERE id=?`).get(row.id)).toEqual({ revision: 2, status: 'deleted', result_available: 0,
      source_deleted_at: NOW, deletion_propagation: 'locally_deleted', last_mutation_id: batchMutation.id });
    const item = database.prepare(`SELECT batch_mutation_id,item_mutation_id,client_operation_id,request_fingerprint,
      job_id,previous_revision,revision,state_fingerprint FROM local_governed_ocr_source_deletion_items`).get() as Record<string, unknown>;
    expect(item).toEqual(expect.objectContaining({ batch_mutation_id: batchMutation.id, job_id: row.id,
      previous_revision: 1, revision: 2, state_fingerprint: next.stateFingerprint }));
    expect(item.item_mutation_id).toBe(`ocr-source-item:${createHash('sha256')
      .update(JSON.stringify([batchMutation.id, row.id])).digest('hex')}`);
    expect(item.client_operation_id).toBe(`ocr-source-op:${createHash('sha256')
      .update(JSON.stringify([batchMutation.clientOperationId, row.id])).digest('hex')}`);
    expect(item.request_fingerprint).toBe(createHash('sha256').update(JSON.stringify([batchMutation.requestFingerprint,
      row.id, row.revision, next.revision, next.stateFingerprint])).digest('hex'));
    expect(() => database.prepare(`UPDATE local_governed_ocr_source_deletion_items SET request_fingerprint=?`)
      .run('8'.repeat(64))).toThrow(/immutable/u);
    expect(() => database.prepare(`DELETE FROM local_governed_ocr_source_deletion_items`).run()).toThrow(/immutable/u);

    const replay = await executePolicy(database, 'archive_item', 'archive-33-q', 'delete', (repository, context) =>
      repository.findSourceDeletionMutationByClientOperationId(context, row.key, 'archive-33-q', batchMutation.clientOperationId));
    expect(replay).toEqual(expect.objectContaining({ ok: true, value: expect.objectContaining({
      id: batchMutation.id, requestFingerprint: batchMutation.requestFingerprint, stateFingerprint: aggregateFingerprint
    }) }));
  });

  it('binds run begin, cancellation and terminal finalization to one exact active run id', async () => {
    const database = openFixture(); await seedSource(database);
    const queued = queuedJob();
    const created = await executePolicy(database, 'local_ocr_job', queued.id, 'process', (repository, context) => {
      const inserted = repository.insertMutation(context, mutationFor(queued));
      return inserted.ok ? repository.insertJob(context, queued) : inserted;
    });
    expect(created.ok).toBe(true);

    const runId = '6'.repeat(64);
    const { stateFingerprint: _queuedFingerprint, ...queuedView } = queued;
    const runningBase = Object.freeze({ ...queuedView, revision: 2, status: 'running' as const,
      runAttempt: 1, activeRunId: runId, updatedAt: asIsoDateTime(NOW) });
    const running: LocalGovernedOcrJobRow = Object.freeze({ ...runningBase,
      stateFingerprint: computeLocalGovernedOcrJobStateFingerprint(runningBase) });
    const beginMutation: LocalGovernedOcrMutationRow = Object.freeze({ id: 'ocr-run-begin-mutation', key: queued.key,
      clientOperationId: 'ocr-run-begin-operation', requestFingerprint: runId, mutationKind: 'job_run_begin',
      resourceType: 'local_ocr_job', resourceId: queued.id, previousRevision: 1, revision: 2,
      stateFingerprint: running.stateFingerprint, occurredAt: asIsoDateTime(NOW) });

    const forgedBase = Object.freeze({ ...runningBase, activeRunId: '7'.repeat(64) });
    const forged: LocalGovernedOcrJobRow = Object.freeze({ ...forgedBase,
      stateFingerprint: computeLocalGovernedOcrJobStateFingerprint(forgedBase) });
    const forgedBegin = await executePolicy(database, 'local_ocr_job', queued.id, 'process', (repository, context) => {
      database.exec('BEGIN IMMEDIATE');
      const inserted = repository.insertMutation(context, beginMutation);
      const saved = inserted.ok ? repository.saveJob(context, forged, 1) : inserted;
      database.exec(saved.ok ? 'COMMIT' : 'ROLLBACK');
      return saved;
    });
    expect(forgedBegin.ok).toBe(false);
    expect(database.prepare('SELECT revision,status,active_run_id FROM local_governed_ocr_jobs WHERE id=?').get(queued.id))
      .toEqual({ revision: 1, status: 'queued', active_run_id: null });

    const begun = await executePolicy(database, 'local_ocr_job', queued.id, 'process', (repository, context) => {
      const inserted = repository.insertMutation(context, beginMutation);
      return inserted.ok ? repository.saveJob(context, running, 1) : inserted;
    });
    expect(begun).toEqual({ ok: true, value: true });

    const { stateFingerprint: _runningFingerprint, ...runningView } = running;
    const cancellingBase = Object.freeze({ ...runningView, revision: 3, status: 'cancel_requested' as const,
      cancellationRequestedAt: asIsoDateTime(NOW), updatedAt: asIsoDateTime(NOW) });
    const cancelling: LocalGovernedOcrJobRow = Object.freeze({ ...cancellingBase,
      stateFingerprint: computeLocalGovernedOcrJobStateFingerprint(cancellingBase) });
    const cancelMutation: LocalGovernedOcrMutationRow = Object.freeze({ id: 'ocr-run-cancel-mutation', key: queued.key,
      clientOperationId: 'ocr-run-cancel-operation', requestFingerprint: '8'.repeat(64), mutationKind: 'job_cancel',
      resourceType: 'local_ocr_job', resourceId: queued.id, previousRevision: 2, revision: 3,
      stateFingerprint: cancelling.stateFingerprint, occurredAt: asIsoDateTime(NOW) });
    const cancellation = await executePolicy(database, 'local_ocr_job', queued.id, 'process', (repository, context) => {
      const inserted = repository.insertMutation(context, cancelMutation);
      return inserted.ok ? repository.saveJob(context, cancelling, 2) : inserted;
    });
    expect(cancellation).toEqual({ ok: true, value: true });

    const { stateFingerprint: _cancellingFingerprint, activeRunId: _activeRunId,
      cancellationRequestedAt: _requestedAt, ...cancellingView } = cancelling;
    const cancelledBase = Object.freeze({ ...cancellingView, revision: 4, status: 'cancelled' as const,
      cancelledAt: asIsoDateTime(NOW), updatedAt: asIsoDateTime(NOW) });
    const cancelled: LocalGovernedOcrJobRow = Object.freeze({ ...cancelledBase,
      stateFingerprint: computeLocalGovernedOcrJobStateFingerprint(cancelledBase) });
    const finalMutation: LocalGovernedOcrMutationRow = Object.freeze({ id: 'ocr-run-final-mutation', key: queued.key,
      clientOperationId: 'ocr-run-final-operation', requestFingerprint: '9'.repeat(64), mutationKind: 'job_run',
      resourceType: 'local_ocr_job', resourceId: queued.id, previousRevision: 3, revision: 4,
      stateFingerprint: cancelled.stateFingerprint, occurredAt: asIsoDateTime(NOW) });
    const finalized = await executePolicy(database, 'local_ocr_job', queued.id, 'process', (repository, context) => {
      const inserted = repository.insertMutation(context, finalMutation);
      return inserted.ok ? repository.saveJob(context, cancelled, 3) : inserted;
    });
    expect(finalized).toEqual({ ok: true, value: true });
    expect(database.prepare(`SELECT revision,status,run_attempt,active_run_id,cancellation_requested_at,cancelled_at
      FROM local_governed_ocr_jobs WHERE id=?`).get(queued.id)).toEqual({ revision: 4, status: 'cancelled',
      run_attempt: 1, active_run_id: null, cancellation_requested_at: null, cancelled_at: NOW });
  });

  it('discovers revoked, expired and denied authorization and tombstones only under the exact live denial', async () => {
    const database = openFixture(); await seedSource(database);
    const queued = queuedJob();
    expect((await executePolicy(database, 'local_ocr_job', queued.id, 'process', (repository, context) => {
      const inserted = repository.insertMutation(context, mutationFor(queued));
      return inserted.ok ? repository.insertJob(context, queued) : inserted;
    })).ok).toBe(true);

    const resultSha = 'd'.repeat(64);
    const bindingHash = 'e'.repeat(64);
    database.prepare('INSERT INTO derived_data_policy_bindings VALUES(?,?,?,?,?,?)')
      .run(bindingHash, 'sealed', 'OCR_TEXT', queued.derivedResourceId, resultSha, FAMILY_ID);
    database.prepare('INSERT INTO derived_data_policy_sources VALUES(?,?,?,?)')
      .run(bindingHash, 'archive_item', queued.source.resourceId, SOURCE_SHA);
    const { stateFingerprint: _queuedFingerprint, ...queuedView } = queued;
    const completedBase = Object.freeze({ ...queuedView, revision: 2, status: 'completed' as const, runAttempt: 1,
      resultAvailable: true, resultContentSha256: resultSha, resultCharacterCount: 12, resultPageCount: 1,
      derivedBindingHash: bindingHash, sealedResultId: 'ocr-result:authorization-reconcile', completedAt: asIsoDateTime(NOW),
      updatedAt: asIsoDateTime(NOW) });
    const completed: LocalGovernedOcrJobRow = Object.freeze({ ...completedBase,
      stateFingerprint: computeLocalGovernedOcrJobStateFingerprint(completedBase) });
    const completionMutation: LocalGovernedOcrMutationRow = Object.freeze({ id: 'ocr-authorization-complete-mutation',
      key: queued.key, clientOperationId: 'ocr-authorization-complete-operation', requestFingerprint: '4'.repeat(64),
      mutationKind: 'job_run', resourceType: 'local_ocr_job', resourceId: queued.id, previousRevision: 1, revision: 2,
      stateFingerprint: completed.stateFingerprint, occurredAt: asIsoDateTime(NOW) });
    expect((await executePolicy(database, 'local_ocr_job', queued.id, 'process', (repository, context) => {
      const inserted = repository.insertMutation(context, completionMutation);
      return inserted.ok ? repository.saveJob(context, completed, 1) : inserted;
    }))).toEqual({ ok: true, value: true });

    const at = '2026-08-14T10:00:00.000Z';
    database.prepare(`UPDATE ai_consents SET ends_at='2026-08-14T09:30:00.000Z' WHERE id='consent-33-q'`).run();
    const expired = await executePolicy(database, 'local_ocr_job', queued.id, 'delete', (repository, context) =>
      repository.listAuthorizationReconciliationCandidates(context, queued.key, at, 8), at);
    expect(expired).toEqual({ ok: true, value: [expect.objectContaining({ jobId: queued.id,
      revision: 2, reason: 'consent_expired' })] });

    database.prepare(`UPDATE ai_consents SET status='revoked',ends_at=NULL WHERE id='consent-33-q'`).run();
    const revoked = await executePolicy(database, 'local_ocr_job', queued.id, 'delete', (repository, context) =>
      repository.resolveAuthorizationRevocation(context, queued.key, queued.id, at), at);
    expect(revoked).toEqual({ ok: true, value: 'consent_revoked' });

    database.prepare(`UPDATE ai_consents SET status='granted',ends_at=NULL WHERE id='consent-33-q'`).run();
    database.prepare(`INSERT INTO object_permissions VALUES(
      'ocr-permission-deny',?,'archive_item',?,'["read"]','deny','general',?,NULL
    )`).run(ACCOUNT_ID, queued.source.resourceId, NOW);
    const denied = await executePolicy(database, 'local_ocr_job', queued.id, 'delete', (repository, context) =>
      repository.resolveAuthorizationRevocation(context, queued.key, queued.id, at), at);
    expect(denied).toEqual({ ok: true, value: 'permission_revoked' });

    const { stateFingerprint: _completedFingerprint, sealedResultId: _sealed, resultContentSha256: _result,
      resultCharacterCount: _characters, resultPageCount: _pages, derivedBindingHash: _binding,
      completedAt: _completedAt, ...completedView } = completed;
    const deletedBase = Object.freeze({ ...completedView, revision: 3, status: 'deleted' as const,
      resultAvailable: false, deletedAt: asIsoDateTime(at), deletionPropagation: 'active' as const,
      updatedAt: asIsoDateTime(at) });
    const deleted: LocalGovernedOcrJobRow = Object.freeze({ ...deletedBase,
      stateFingerprint: computeLocalGovernedOcrJobStateFingerprint(deletedBase) });
    const mutation: LocalGovernedOcrMutationRow = Object.freeze({ id: 'ocr-authorization-revoke-mutation',
      key: queued.key, clientOperationId: 'ocr-authorization-revoke-operation', requestFingerprint: '5'.repeat(64),
      mutationKind: 'authorization_revoke_propagate', resourceType: 'local_ocr_job', resourceId: queued.id,
      previousRevision: 2, revision: 3, stateFingerprint: deleted.stateFingerprint, occurredAt: asIsoDateTime(at) });

    database.prepare(`DELETE FROM object_permissions WHERE id='ocr-permission-deny'`).run();
    const forged = await executePolicy(database, 'local_ocr_job', queued.id, 'delete', (repository, context) => {
      database.exec('BEGIN IMMEDIATE');
      const inserted = repository.insertMutation(context, mutation);
      const saved = inserted.ok ? repository.saveJob(context, deleted, 2) : inserted;
      database.exec(saved.ok ? 'COMMIT' : 'ROLLBACK');
      return saved;
    }, at);
    expect(forged.ok).toBe(false);
    expect(database.prepare('SELECT revision,status,result_available FROM local_governed_ocr_jobs WHERE id=?')
      .get(queued.id)).toEqual({ revision: 2, status: 'completed', result_available: 1 });

    database.prepare(`INSERT INTO object_permissions VALUES(
      'ocr-permission-deny',?,'local_ocr_result',?,'["ai_process"]','deny','ai_processing',?,NULL
    )`).run(ACCOUNT_ID, queued.derivedResourceId, NOW);
    const reconciled = await executePolicy(database, 'local_ocr_job', queued.id, 'delete', (repository, context) => {
      const inserted = repository.insertMutation(context, mutation);
      return inserted.ok ? repository.saveJob(context, deleted, 2) : inserted;
    }, at);
    expect(reconciled).toEqual({ ok: true, value: true });
    expect(database.prepare(`SELECT revision,status,result_available,sealed_result_id,source_deleted_at,deletion_propagation,
      last_mutation_id FROM local_governed_ocr_jobs WHERE id=?`).get(queued.id)).toEqual({ revision: 3,
      status: 'deleted', result_available: 0, sealed_result_id: null, source_deleted_at: null,
      deletion_propagation: 'active', last_mutation_id: mutation.id });
    expect(() => database.prepare(`UPDATE local_governed_ocr_mutations SET request_fingerprint=? WHERE id=?`)
      .run('6'.repeat(64), mutation.id)).toThrow(/immutable/u);
  });

  it('persists default-off/on settings under administration and denies unsealed completed results', async () => {
    const database = openFixture(); await seedSource(database);
    const key = { familyId: FAMILY_ID, accountId: ACCOUNT_ID, ownerPersonId: PERSON_ID };
    const settingsResourceId = `local-ocr-settings:${PERSON_ID}`;
    const defaultAtCreation = await executePolicy(database, 'local_ocr_settings', settingsResourceId, 'read',
      (repository, context) => repository.loadCenter(context, key));
    const defaultLater = await executePolicy(database, 'local_ocr_settings', settingsResourceId, 'read',
      (repository, context) => repository.loadCenter(context, key), '2026-08-14T10:00:00.000Z');
    expect(defaultAtCreation).toEqual(expect.objectContaining({ ok: true, value: expect.objectContaining({
      settings: expect.objectContaining({ revision: 0, enabled: true, updatedAt: NOW })
    }) }));
    expect(defaultLater).toEqual(defaultAtCreation);
    const metadataAtCreation = await executePolicy(database, 'local_ocr_settings', settingsResourceId, 'read',
      (repository, context) => repository.resolvePolicyResource(context, key, 'local_ocr_settings', settingsResourceId));
    const metadataLater = await executePolicy(database, 'local_ocr_settings', settingsResourceId, 'read',
      (repository, context) => repository.resolvePolicyResource(context, key, 'local_ocr_settings', settingsResourceId),
      '2026-08-14T10:00:00.000Z');
    expect(metadataLater).toEqual(metadataAtCreation);
    const settingsBase = Object.freeze({ key, revision: 1, enabled: false, disabledReason: 'Kullanıcı kapattı',
      disabledAt: asIsoDateTime(NOW), updatedAt: asIsoDateTime(NOW) });
    const settings: LocalGovernedOcrSettingsRow = Object.freeze({ ...settingsBase,
      stateFingerprint: computeLocalGovernedOcrSettingsStateFingerprint(settingsBase) });
    const settingsMutation: LocalGovernedOcrMutationRow = Object.freeze({ id: 'settings-mutation-1', key,
      clientOperationId: 'settings-operation-1', requestFingerprint: 'c'.repeat(64), mutationKind: 'processing_disable',
      resourceType: 'local_ocr_settings', resourceId: settingsResourceId, previousRevision: 0, revision: 1,
      stateFingerprint: settings.stateFingerprint, occurredAt: asIsoDateTime(NOW) });
    const saved = await executePolicy(database, 'local_ocr_settings', settingsResourceId, 'update', (repository, context) => {
      const inserted = repository.insertMutation(context, settingsMutation);
      return inserted.ok ? repository.saveSettings(context, settings, 0) : inserted;
    });
    expect(saved).toEqual({ ok: true, value: true });
    const center = await executePolicy(database, 'local_ocr_settings', settingsResourceId, 'read', (repository, context) =>
      repository.loadCenter(context, key));
    expect(center).toEqual(expect.objectContaining({ ok: true, value: expect.objectContaining({
      settings: expect.objectContaining({ enabled: false, revision: 1 }), jobs: []
    }) }));

    const row = queuedJob(); const firstMutation = mutationFor(row);
    const created = await executePolicy(database, 'local_ocr_job', row.id, 'process', (repository, context) => {
      const inserted = repository.insertMutation(context, firstMutation);
      return inserted.ok ? repository.insertJob(context, row) : inserted;
    });
    expect(created.ok).toBe(true);
    const completedBase = Object.freeze({ ...row, revision: 2, status: 'completed' as const, runAttempt: 1,
      resultAvailable: true, resultContentSha256: 'd'.repeat(64), resultCharacterCount: 10, resultPageCount: 1,
      derivedBindingHash: 'e'.repeat(64), sealedResultId: 'ocr-result:sealed-1', completedAt: asIsoDateTime(NOW) });
    const completed: LocalGovernedOcrJobRow = Object.freeze({ ...completedBase,
      stateFingerprint: computeLocalGovernedOcrJobStateFingerprint(completedBase) });
    const secondMutation: LocalGovernedOcrMutationRow = Object.freeze({ ...mutationFor(completed),
      id: 'ocr-mutation-2', clientOperationId: 'ocr-operation-2', mutationKind: 'job_run', previousRevision: 1 });
    const rejected = await executePolicy(database, 'local_ocr_job', row.id, 'process', (repository, context) => {
      database.exec('BEGIN IMMEDIATE');
      const inserted = repository.insertMutation(context, secondMutation);
      const result = inserted.ok ? repository.saveJob(context, completed, 1) : inserted;
      database.exec(result.ok ? 'COMMIT' : 'ROLLBACK');
      return result;
    });
    expect(rejected.ok).toBe(false);
    expect(database.prepare(`SELECT revision,status FROM local_governed_ocr_jobs WHERE id=?`).get(row.id)).toEqual({ revision: 1, status: 'queued' });
  });
});
