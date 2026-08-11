import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ArchiveApplicationContext, ArchivePolicyIntent } from '@ppt/application';
import {
  ERROR_CODES,
  asCorrelationId,
  asEventId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  createAppError,
  err,
  ok,
  type Clock
} from '@ppt/core';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import type { RepositoryExecutionContext, TransactionContext } from '@ppt/repository-contracts';
import {
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '@ppt/repositories';
import { RepositoryBackedArchiveUnitOfWork } from '../src/main/archive-application-adapter.js';
import { FileSystemArchiveVaultFilePort } from '../src/main/archive-vault-file-application-adapter.js';
import { createArchiveProductionPolicyEnforcementPointResolver } from '../src/main/archive-production-policy-runtime.js';
import { FileDeviceIdentityProvider } from '../src/main/device-identity.js';
import { SqliteFamilyDatabaseRuntime } from '../src/main/family-database-runtime.js';
import { createSqliteRepositoryCompositionRoot } from '../src/main/repository-composition-root.js';

const NOW = asIsoDateTime('2026-08-07T05:40:00.000Z');
const STARTS_AT = asIsoDateTime('2026-01-01T00:00:00.000Z');
const FAMILY_ID = asFamilyId('family-30t-operation-idempotency');
const ACCOUNT_ID = asUserId('account-30t-operation-idempotency');
const PERSON_ID = asPersonId('person-30t-operation-idempotency');
const POLICY_VERSION = '30-t-archive-operation-idempotency-v1';
const clock: Clock = Object.freeze({ now: () => NOW });
const temporaryDirectories: string[] = [];
const activeRuntimes: SqliteFamilyDatabaseRuntime[] = [];

const fingerprint = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const context = (
  correlationId: string,
  operationId: string,
  operationFingerprint: string
): ArchiveApplicationContext => ({
  familyId: FAMILY_ID,
  actor: { userId: ACCOUNT_ID, role: 'family_admin', personId: PERSON_ID },
  correlationId: asCorrelationId(correlationId),
  operationId,
  operationFingerprint
});

const repositoryContext = (
  applicationContext: ArchiveApplicationContext,
  transaction: TransactionContext
): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: { userId: ACCOUNT_ID, roles: ['family_admin'], personId: PERSON_ID },
  correlationId: applicationContext.correlationId,
  occurredAt: transaction.occurredAt
});

const authorizationProvider = (): PlatformPolicyAuthorizationProvider => {
  const kernel = new PlatformPolicyKernel({
    policyVersion: POLICY_VERSION,
    signingKey: Buffer.from('30-t-operation-idempotency-controlled-signing-key', 'utf8'),
    applicationCapabilities: { 'windows-desktop': ['archive.write'] },
    consentRequiredCapabilities: [],
    onlineOnlyCapabilities: [],
    writeActions: ['create', 'update', 'delete', 'record']
  });
  return Object.freeze({
    resolvePolicyPackage: () => kernel.policyPackage,
    authorize: ({ request, nonce }) => Object.freeze({
      effectiveRequest: request,
      authorization: kernel.authorizeWithReceipt(request, request.occurredAt, nonce)
    }),
    verify: ({ request, receipt }) => kernel.verifyReceiptForRequest(receipt, request)
  });
};

const projectionProof = (
  record: PlatformPolicyReceiptRecord,
  sequence: number
): PlatformPolicyJournalProjectionProof => Object.freeze({
  schemaVersion: 1,
  receiptHash: computePlatformPolicyReceiptHash(record.receipt),
  recordHash: computePlatformPolicyReceiptRecordHash(record),
  receiptNonce: record.receipt.nonce,
  entrySequence: sequence,
  entryHash: fingerprint(`entry:${sequence}:${record.correlationId}`),
  headSequence: sequence,
  headHash: fingerprint(`entry:${sequence}:${record.correlationId}`),
  journalSizeBytes: sequence * 512,
  issuedAt: record.recordedAt,
  proofMac: fingerprint(`mac:${sequence}:${record.correlationId}`)
});

const makeHarness = () => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-30t-operation-idempotency-'));
  temporaryDirectories.push(directory);
  const runtime = new SqliteFamilyDatabaseRuntime({
    databasePath: join(directory, 'family.db'),
    applicationVersion: '30-t-vitest',
    clock,
    skipFileMigrationSafetyBackup: true,
    databaseConfig: { busyTimeoutMs: 5_000, journalMode: 'WAL', synchronous: 'FULL' }
  });
  activeRuntimes.push(runtime);
  const repositories = createSqliteRepositoryCompositionRoot();
  const deviceIdentity = new FileDeviceIdentityProvider(join(directory, 'device-identity.json'), clock);
  const identity = deviceIdentity.snapshot();
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)')
    .run(FAMILY_ID, '30-T Operation Idempotency Family', STARTS_AT);
  const seedContext = context('30-t-seed', 'archive-op-30t-seed', fingerprint('seed'));
  const seeded = runtime.transactionExecutor.execute(seedContext.correlationId, (transaction) => {
    const execution = repositoryContext(seedContext, transaction);
    const person = repositories.personRepository.insert(execution, {
      id: PERSON_ID,
      familyId: FAMILY_ID,
      displayName: '30-T Person',
      relationshipType: 'admin',
      generation: 1,
      branch: 'main',
      status: 'active',
      createdAt: STARTS_AT
    });
    if (!person.ok) return person;
    const account = repositories.accountRepository.insert(execution, {
      id: ACCOUNT_ID,
      displayName: '30-T Account',
      email: '30-t-operation@local.pardus',
      passwordRecord: 'test-only-password-record',
      role: 'family_admin',
      status: 'active',
      startsAt: STARTS_AT,
      personId: PERSON_ID,
      createdAt: STARTS_AT
    });
    if (!account.ok) return account;
    const trusted = repositories.trustedDeviceRepository.upsert(execution, {
      id: 'trusted-device-30t-operation',
      accountId: ACCOUNT_ID,
      deviceId: identity.deviceId,
      displayName: '30-T Device',
      fingerprint: identity.fingerprint,
      publicKeyPem: identity.publicKeyPem,
      trustedAt: NOW,
      lastSeenAt: NOW,
      securityEpoch: 0
    });
    if (!trusted.ok) return trusted;
    for (const resourceType of ['archive_item', 'archive_retention_policy', 'archive_category'] as const) {
      const permission = repositories.objectPermissionRepository.upsert(execution, {
        id: `permission-30t-${resourceType}`,
        subjectAccountId: ACCOUNT_ID,
        resourceType,
        resourceId: '*',
        actions: ['create', 'update', 'delete', 'record'],
        effect: 'allow',
        purpose: 'archive',
        startsAt: STARTS_AT,
        createdAt: STARTS_AT
      });
      if (!permission.ok) return permission;
    }
    return ok(undefined);
  });
  expect(seeded.ok).toBe(true);

  let sequence = 0;
  const resolver = createArchiveProductionPolicyEnforcementPointResolver({
    transactionExecutor: runtime.transactionExecutor,
    accountRepository: repositories.accountRepository,
    permissionRepository: repositories.objectPermissionRepository,
    trustedDeviceRepository: repositories.trustedDeviceRepository,
    archiveRepository: repositories.archiveRepository,
    personRepository: repositories.personRepository,
    deviceIdentityProvider: deviceIdentity,
    authorizationProvider: authorizationProvider(),
    receiptSink: {
      append: () => undefined,
      ensure: (record) => projectionProof(record, ++sequence),
      verifyProjectionProof: () => true
    },
    policyTransactionRepository: repositories.platformPolicyTransactionRepository,
    clusterFence: () => ({ writable: true, epoch: 30 }),
    policyVersion: POLICY_VERSION,
    clock
  });
  const unitOfWork = new RepositoryBackedArchiveUnitOfWork({
    transactionExecutor: runtime.transactionExecutor,
    archiveRepository: repositories.archiveRepository,
    accountRepository: repositories.accountRepository,
    permissionRepository: repositories.objectPermissionRepository,
    auditRepository: repositories.auditRepository,
    outboxRepository: repositories.outboxRepository,
    policyEnforcementPointResolver: resolver,
    clusterFence: () => ({ writable: true, epoch: 30 })
  });
  return { directory, runtime, repositories, unitOfWork };
};

afterEach(() => {
  for (const runtime of activeRuntimes.splice(0)) runtime.close();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('30-T durable archive operation idempotency', () => {
  it('replays a committed create under a new correlation without repeating business writes', async () => {
    const harness = makeHarness();
    const operationId = 'archive-op-30t-lost-response';
    const operationFingerprint = fingerprint('archive.create:item-30t-lost-response:title-and-file-hash');
    const resourceId = 'archive-item-30t-lost-response';
    const intent: ArchivePolicyIntent = {
      action: 'create',
      capability: 'archive.write',
      resourceType: 'archive_item',
      resourceId,
      purpose: 'archive'
    };
    const expectedResult = Object.freeze({ itemId: resourceId, accepted: true });
    let businessExecutions = 0;
    const first = await harness.unitOfWork.execute(
      context('corr-30t-lost-response-first', operationId, operationFingerprint),
      intent,
      (scope) => {
        businessExecutions += 1;
        const item = scope.insertItem({
          id: resourceId,
          familyId: FAMILY_ID,
          title: '30-T lost response item',
          originalName: 'lost-response.txt',
          storedName: 'lost-response.vault',
          mimeType: 'text/plain',
          sizeBytes: 32,
          sha256: fingerprint('lost-response-file'),
          sensitivity: 'standard',
          aiProcessingAllowed: false,
          createdAt: scope.occurredAt
        });
        if (!item.ok) return item;
        const audit = scope.appendAudit({
          id: 'audit-30t-lost-response',
          action: 'archive.imported',
          resourceType: 'archive_item',
          resourceId,
          occurredAt: scope.occurredAt,
          actorId: ACCOUNT_ID
        });
        if (!audit.ok) return audit;
        const outbox = scope.enqueueEvent({
          eventId: asEventId('event-30t-lost-response'),
          eventType: 'archive.item.imported',
          eventVersion: 1,
          aggregateType: 'archive_item',
          aggregateId: resourceId,
          occurredAt: scope.occurredAt,
          actorId: ACCOUNT_ID,
          correlationId: asCorrelationId('corr-30t-lost-response-first'),
          payload: { itemId: resourceId }
        });
        return outbox.ok ? ok(expectedResult) : outbox;
      }
    );
    expect(first).toEqual({ ok: true, value: expectedResult });

    // The first response is intentionally treated as lost/unknown by the caller.
    const replay = await harness.unitOfWork.execute(
      context('corr-30t-lost-response-retry', operationId, operationFingerprint),
      intent,
      () => {
        businessExecutions += 1;
        throw new Error('BUSINESS_MUTATION_MUST_NOT_RUN_ON_REPLAY');
      }
    );
    expect(replay).toEqual({ ok: true, value: expectedResult });
    expect(businessExecutions).toBe(1);
    expect(harness.runtime.database.prepare(
      'SELECT COUNT(*) AS count FROM archive_items WHERE id=?'
    ).get(resourceId)?.count).toBe(1);
    expect(harness.runtime.database.prepare(
      'SELECT COUNT(*) AS count FROM audit_log WHERE id=?'
    ).get('audit-30t-lost-response')?.count).toBe(1);
    expect(harness.runtime.database.prepare(
      'SELECT COUNT(*) AS count FROM event_outbox WHERE id=?'
    ).get('event-30t-lost-response')?.count).toBe(1);
    expect(harness.runtime.database.prepare(
      'SELECT COUNT(*) AS count FROM platform_policy_archive_operations WHERE operation_id=?'
    ).get(operationId)?.count).toBe(1);
    expect(harness.runtime.database.prepare(
      'SELECT COUNT(*) AS count FROM platform_policy_archive_operation_retries WHERE operation_id=?'
    ).get(operationId)?.count).toBe(1);
    expect(harness.runtime.database.prepare(
      'SELECT COUNT(*) AS count FROM platform_policy_transaction_receipts WHERE resource_id=?'
    ).get(resourceId)?.count).toBe(2);

    expect(() => harness.runtime.database.prepare(
      'UPDATE platform_policy_archive_operations SET result_hash=? WHERE operation_id=?'
    ).run('f'.repeat(64), operationId)).toThrow(/immutable/u);
    expect(() => harness.runtime.database.prepare(
      'UPDATE platform_policy_archive_operation_retries SET operation_fingerprint=? WHERE operation_id=?'
    ).run('f'.repeat(64), operationId)).toThrow(/immutable/u);
  });

  it('retains the canonical operation result across a real SQLite close and restart', async () => {
    const harness = makeHarness();
    const operationId = 'archive-op-30t-restart';
    const operationFingerprint = fingerprint('archive.create:restart-durability');
    const resourceId = 'archive-item-30t-restart';
    const committed = await harness.unitOfWork.execute(
      context('corr-30t-restart-first', operationId, operationFingerprint),
      {
        action: 'create',
        capability: 'archive.write',
        resourceType: 'archive_item',
        resourceId,
        purpose: 'archive'
      },
      (scope) => {
        const inserted = scope.insertItem({
          id: resourceId,
          familyId: FAMILY_ID,
          title: '30-T restart item',
          originalName: 'restart.txt',
          storedName: 'restart.vault',
          mimeType: 'text/plain',
          sizeBytes: 16,
          sha256: fingerprint('restart-file'),
          sensitivity: 'standard',
          aiProcessingAllowed: false,
          createdAt: scope.occurredAt
        });
        return inserted.ok ? ok({ itemId: resourceId, durable: true }) : inserted;
      }
    );
    expect(committed.ok).toBe(true);
    harness.runtime.close();
    activeRuntimes.splice(activeRuntimes.indexOf(harness.runtime), 1);

    const restarted = new SqliteFamilyDatabaseRuntime({
      databasePath: join(harness.directory, 'family.db'),
      applicationVersion: '30-t-vitest-restart',
      clock,
      skipFileMigrationSafetyBackup: true,
      databaseConfig: { busyTimeoutMs: 5_000, journalMode: 'WAL', synchronous: 'FULL' }
    });
    activeRuntimes.push(restarted);
    const repositories = createSqliteRepositoryCompositionRoot();
    const readContext = context('corr-30t-restart-read', operationId, operationFingerprint);
    const found = restarted.transactionExecutor.execute(readContext.correlationId, (transaction) =>
      repositories.platformPolicyTransactionRepository.findArchiveOperation(
        repositoryContext(readContext, transaction),
        operationId
      )
    );
    expect(found.ok).toBe(true);
    expect(found.ok && found.value).toMatchObject({
      operationId,
      operationFingerprint,
      resourceId,
      originalCorrelationId: 'corr-30t-restart-first',
      retryCount: 0
    });
    expect(found.ok && found.value?.resultJson).toBe(
      '{"hasValue":true,"value":{"durable":true,"itemId":"archive-item-30t-restart"}}'
    );
  });

  it('fails closed for semantic identity reuse and leaves failed attempts retryable', async () => {
    const harness = makeHarness();
    const resourceId = 'archive-item-30t-rollback';
    const seeded = await harness.unitOfWork.execute(
      context('corr-30t-rollback-seed', 'archive-op-30t-rollback-seed', fingerprint('rollback-seed')),
      {
        action: 'create',
        capability: 'archive.write',
        resourceType: 'archive_item',
        resourceId,
        purpose: 'archive'
      },
      (scope) => scope.insertItem({
        id: resourceId,
        familyId: FAMILY_ID,
        title: '30-T seeded item',
        originalName: 'seed.txt',
        storedName: 'seed.vault',
        mimeType: 'text/plain',
        sizeBytes: 12,
        sha256: fingerprint('seed-file'),
        sensitivity: 'standard',
        aiProcessingAllowed: false,
        createdAt: scope.occurredAt
      })
    );
    expect(seeded.ok).toBe(true);
    const intent: ArchivePolicyIntent = {
      action: 'record',
      capability: 'archive.write',
      resourceType: 'archive_item',
      resourceId,
      purpose: 'archive'
    };
    const operationId = 'archive-op-30t-rollback';
    const operationFingerprint = fingerprint('archive.record:rollback');
    const failed = await harness.unitOfWork.execute(
      context('corr-30t-rollback-first', operationId, operationFingerprint),
      intent,
      (scope) => {
        const audit = scope.appendAudit({
          id: 'audit-30t-rollback',
          action: 'archive.opened',
          resourceType: 'archive_item',
          resourceId,
          occurredAt: scope.occurredAt,
          actorId: ACCOUNT_ID
        });
        if (!audit.ok) return audit;
        return err(createAppError({
          code: ERROR_CODES.DATABASE_INTEGRITY_FAILED,
          message: 'Controlled rollback after the candidate mutation',
          category: 'infrastructure',
          correlationId: asCorrelationId('corr-30t-rollback-first')
        }));
      }
    );
    expect(failed.ok).toBe(false);
    expect(harness.runtime.database.prepare(
      'SELECT COUNT(*) AS count FROM audit_log WHERE id=?'
    ).get('audit-30t-rollback')?.count).toBe(0);
    expect(harness.runtime.database.prepare(
      'SELECT COUNT(*) AS count FROM platform_policy_archive_operations WHERE operation_id=?'
    ).get(operationId)?.count).toBe(0);
    expect(harness.runtime.database.prepare(
      'SELECT COUNT(*) AS count FROM platform_policy_transaction_receipts WHERE correlation_id=?'
    ).get('corr-30t-rollback-first')?.count).toBe(0);

    let retryExecutions = 0;
    const committed = await harness.unitOfWork.execute(
      context('corr-30t-rollback-retry', operationId, operationFingerprint),
      intent,
      (scope) => {
        retryExecutions += 1;
        return scope.appendAudit({
          id: 'audit-30t-rollback',
          action: 'archive.opened',
          resourceType: 'archive_item',
          resourceId,
          occurredAt: scope.occurredAt,
          actorId: ACCOUNT_ID
        });
      }
    );
    expect(committed.ok).toBe(true);
    expect(committed.ok && committed.value).toMatch(/^[0-9a-f]{64}$/u);
    expect(retryExecutions).toBe(1);

    let mismatchedBusinessExecutions = 0;
    const mismatched = await harness.unitOfWork.execute(
      context('corr-30t-rollback-mismatch', operationId, fingerprint('different-semantic-mutation')),
      intent,
      () => {
        mismatchedBusinessExecutions += 1;
        return ok('must-not-commit');
      }
    );
    expect(mismatched.ok).toBe(false);
    expect(mismatchedBusinessExecutions).toBe(0);
    expect(harness.runtime.database.prepare(
      'SELECT COUNT(*) AS count FROM platform_policy_transaction_receipts WHERE correlation_id=?'
    ).get('corr-30t-rollback-mismatch')?.count).toBe(0);
    expect(harness.runtime.database.prepare(
      'SELECT COUNT(*) AS count FROM platform_policy_archive_operation_retries WHERE operation_id=?'
    ).get(operationId)?.count).toBe(0);
  });

  it('keeps encrypted file storage content-idempotent for a stable item identifier', () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppt-30t-vault-idempotency-'));
    temporaryDirectories.push(directory);
    const archivePath = join(directory, 'archive');
    const sourceA = join(directory, 'source-a.txt');
    const sourceB = join(directory, 'source-b.txt');
    writeFileSync(sourceA, 'same durable archive content', 'utf8');
    writeFileSync(sourceB, 'different archive content', 'utf8');
    const files = new FileSystemArchiveVaultFilePort({
      archivePath,
      keyPath: join(directory, 'archive.key'),
      temporaryOpenPath: join(directory, 'open')
    });
    const first = files.store(
      { sourcePath: sourceA, itemId: 'archive-item-30t-file' },
      asCorrelationId('corr-30t-file-first')
    );
    expect(first.ok && first.value.createdNewFile).toBe(true);
    const encryptedPath = join(archivePath, 'archive-item-30t-file.vault');
    const encryptedBeforeRetry = readFileSync(encryptedPath);

    const retry = files.store(
      { sourcePath: sourceA, itemId: 'archive-item-30t-file' },
      asCorrelationId('corr-30t-file-retry')
    );
    expect(retry.ok && retry.value.createdNewFile).toBe(false);
    expect(readFileSync(encryptedPath)).toEqual(encryptedBeforeRetry);

    const mismatch = files.store(
      { sourcePath: sourceB, itemId: 'archive-item-30t-file' },
      asCorrelationId('corr-30t-file-mismatch')
    );
    expect(mismatch.ok).toBe(false);
    expect(readFileSync(encryptedPath)).toEqual(encryptedBeforeRetry);
  });
});
