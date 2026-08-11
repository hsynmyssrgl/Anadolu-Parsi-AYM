import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ArchiveApplicationContext, ArchivePolicyIntent } from '@ppt/application';
import {
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  ok,
  type Clock
} from '@ppt/core';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import type {
  PlatformPolicyArchivePendingOperationIdentityInput,
  RepositoryExecutionContext,
  TransactionContext
} from '@ppt/repository-contracts';
import {
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '@ppt/repositories';
import { RepositoryBackedArchiveUnitOfWork } from '../src/main/archive-application-adapter.js';
import { createArchiveProductionPolicyEnforcementPointResolver } from '../src/main/archive-production-policy-runtime.js';
import { FileDeviceIdentityProvider } from '../src/main/device-identity.js';
import { SqliteFamilyDatabaseRuntime } from '../src/main/family-database-runtime.js';
import {
  createSqliteRepositoryCompositionRoot,
  type RepositoryCompositionRoot
} from '../src/main/repository-composition-root.js';

const NOW = asIsoDateTime('2026-08-07T08:40:00.000Z');
const STARTS_AT = asIsoDateTime('2026-01-01T00:00:00.000Z');
const FAMILY_ID = asFamilyId('family-30u-pending-operation');
const ACCOUNT_ID = asUserId('account-30u-pending-operation');
const PERSON_ID = asPersonId('person-30u-pending-operation');
const POLICY_VERSION = '30-u-pending-operation-recovery-v1';
const clock: Clock = Object.freeze({ now: () => NOW });
const temporaryDirectories: string[] = [];
const activeRuntimes: SqliteFamilyDatabaseRuntime[] = [];

const fingerprint = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const applicationContext = (
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
  correlationId: string,
  transaction: TransactionContext,
  actorAccountId = ACCOUNT_ID
): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: { userId: actorAccountId, roles: ['family_admin'], personId: PERSON_ID },
  correlationId: asCorrelationId(correlationId),
  occurredAt: transaction.occurredAt
});

const pendingIdentity = (
  operationId: string,
  intentFingerprint: string
): PlatformPolicyArchivePendingOperationIdentityInput => ({
  operationId,
  intentFingerprint,
  mutation: 'archive:createCategory',
  resourceFamilyId: FAMILY_ID,
  actorAccountId: ACCOUNT_ID,
  purpose: 'archive'
});

const authorizationProvider = (): PlatformPolicyAuthorizationProvider => {
  const kernel = new PlatformPolicyKernel({
    policyVersion: POLICY_VERSION,
    signingKey: Buffer.from('30-u-pending-operation-controlled-signing-key', 'utf8'),
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

const createUnitOfWork = (
  directory: string,
  runtime: SqliteFamilyDatabaseRuntime,
  repositories: RepositoryCompositionRoot
): RepositoryBackedArchiveUnitOfWork => {
  const deviceIdentity = new FileDeviceIdentityProvider(join(directory, 'device-identity.json'), clock);
  let sequence = Number(runtime.database.prepare(
    'SELECT COUNT(*) AS count FROM platform_policy_transaction_receipts'
  ).get()?.count ?? 0);
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
    clusterFence: () => ({ writable: true, epoch: 31 }),
    policyVersion: POLICY_VERSION,
    clock
  });
  return new RepositoryBackedArchiveUnitOfWork({
    transactionExecutor: runtime.transactionExecutor,
    archiveRepository: repositories.archiveRepository,
    accountRepository: repositories.accountRepository,
    permissionRepository: repositories.objectPermissionRepository,
    auditRepository: repositories.auditRepository,
    outboxRepository: repositories.outboxRepository,
    policyEnforcementPointResolver: resolver,
    clusterFence: () => ({ writable: true, epoch: 31 })
  });
};

const makeHarness = () => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-30u-pending-operation-'));
  temporaryDirectories.push(directory);
  const databasePath = join(directory, 'family.db');
  const runtime = new SqliteFamilyDatabaseRuntime({
    databasePath,
    applicationVersion: '30-u-vitest',
    clock,
    skipFileMigrationSafetyBackup: true,
    databaseConfig: { busyTimeoutMs: 5_000, journalMode: 'WAL', synchronous: 'FULL' }
  });
  activeRuntimes.push(runtime);
  const repositories = createSqliteRepositoryCompositionRoot();
  const identity = new FileDeviceIdentityProvider(join(directory, 'device-identity.json'), clock).snapshot();
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)')
    .run(FAMILY_ID, '30-U Pending Operation Family', STARTS_AT);
  const seeded = runtime.transactionExecutor.execute(asCorrelationId('30-u-seed'), (transaction) => {
    const execution = repositoryContext('30-u-seed', transaction);
    const person = repositories.personRepository.insert(execution, {
      id: PERSON_ID,
      familyId: FAMILY_ID,
      displayName: '30-U Person',
      relationshipType: 'admin',
      generation: 1,
      branch: 'main',
      status: 'active',
      createdAt: STARTS_AT
    });
    if (!person.ok) return person;
    const account = repositories.accountRepository.insert(execution, {
      id: ACCOUNT_ID,
      displayName: '30-U Account',
      email: '30-u-pending@local.pardus',
      passwordRecord: 'test-only-password-record',
      role: 'family_admin',
      status: 'active',
      startsAt: STARTS_AT,
      personId: PERSON_ID,
      createdAt: STARTS_AT
    });
    if (!account.ok) return account;
    const trusted = repositories.trustedDeviceRepository.upsert(execution, {
      id: 'trusted-device-30u-pending',
      accountId: ACCOUNT_ID,
      deviceId: identity.deviceId,
      displayName: '30-U Device',
      fingerprint: identity.fingerprint,
      publicKeyPem: identity.publicKeyPem,
      trustedAt: NOW,
      lastSeenAt: NOW,
      securityEpoch: 0
    });
    if (!trusted.ok) return trusted;
    for (const resourceType of ['archive_item', 'archive_retention_policy', 'archive_category'] as const) {
      const permission = repositories.objectPermissionRepository.upsert(execution, {
        id: `permission-30u-${resourceType}`,
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
  return {
    directory,
    databasePath,
    runtime,
    repositories,
    unitOfWork: createUnitOfWork(directory, runtime, repositories)
  };
};

const closeRuntime = (runtime: SqliteFamilyDatabaseRuntime): void => {
  runtime.close();
  const index = activeRuntimes.indexOf(runtime);
  if (index >= 0) activeRuntimes.splice(index, 1);
};

afterEach(() => {
  for (const runtime of activeRuntimes.splice(0)) runtime.close();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('30-U durable pending archive operation identity recovery', () => {
  it('recovers the same identity after SQLite restart and replays the business mutation exactly once', async () => {
    const harness = makeHarness();
    const intentFingerprint = fingerprint('30-u:create-category:tax-documents');
    const operationFingerprint = fingerprint('archive.category.create:tax-documents');
    const operationId = 'archive-op-30u-restart-original';
    const acquired = harness.runtime.transactionExecutor.execute(asCorrelationId('30-u-acquire-first'), (transaction) =>
      harness.repositories.platformPolicyTransactionRepository.acquireArchivePendingOperation(
        repositoryContext('30-u-acquire-first', transaction),
        pendingIdentity(operationId, intentFingerprint)
      )
    );
    expect(acquired.ok && acquired.value.operationId).toBe(operationId);
    const bound = harness.runtime.transactionExecutor.execute(asCorrelationId('30-u-bind-first'), (transaction) =>
      harness.repositories.platformPolicyTransactionRepository.bindArchivePendingOperation(
        repositoryContext('30-u-bind-first', transaction),
        {
          operationId,
          operationFingerprint,
          mutation: 'archive:createCategory',
          resourceFamilyId: FAMILY_ID,
          actorAccountId: ACCOUNT_ID,
          purpose: 'archive'
        }
      )
    );
    expect(bound.ok && bound.value?.boundOperationFingerprint).toBe(operationFingerprint);

    const resourceId = 'archive-category-30u-restart';
    const policyIntent: ArchivePolicyIntent = {
      action: 'create',
      capability: 'archive.write',
      resourceType: 'archive_category',
      resourceId,
      purpose: 'archive'
    };
    let businessExecutions = 0;
    const first = await harness.unitOfWork.execute(
      applicationContext('corr-30u-first-unknown', operationId, operationFingerprint),
      policyIntent,
      (scope) => {
        businessExecutions += 1;
        const category = scope.insertCategory({
          id: resourceId,
          name: 'Tax Documents',
          createdAt: scope.occurredAt
        });
        if (!category.ok) return category;
        const audit = scope.appendAudit({
          id: 'audit-30u-restart',
          action: 'archive.category.created',
          resourceType: 'archive_category',
          resourceId,
          occurredAt: scope.occurredAt,
          actorId: ACCOUNT_ID
        });
        return audit.ok ? ok({ categoryId: resourceId, created: true }) : audit;
      }
    );
    expect(first).toEqual({ ok: true, value: { categoryId: resourceId, created: true } });

    // The response and all renderer memory are treated as lost before acknowledgement.
    closeRuntime(harness.runtime);
    const restarted = new SqliteFamilyDatabaseRuntime({
      databasePath: harness.databasePath,
      applicationVersion: '30-u-vitest-restarted',
      clock,
      skipFileMigrationSafetyBackup: true,
      databaseConfig: { busyTimeoutMs: 5_000, journalMode: 'WAL', synchronous: 'FULL' }
    });
    activeRuntimes.push(restarted);
    const repositories = createSqliteRepositoryCompositionRoot();
    const recovered = restarted.transactionExecutor.execute(asCorrelationId('30-u-acquire-restarted'), (transaction) =>
      repositories.platformPolicyTransactionRepository.acquireArchivePendingOperation(
        repositoryContext('30-u-acquire-restarted', transaction),
        pendingIdentity('archive-op-30u-restart-new-candidate', intentFingerprint)
      )
    );
    expect(recovered.ok && recovered.value).toMatchObject({
      operationId,
      intentFingerprint,
      boundOperationFingerprint: operationFingerprint
    });

    const replay = await createUnitOfWork(harness.directory, restarted, repositories).execute(
      applicationContext('corr-30u-restarted-retry', operationId, operationFingerprint),
      policyIntent,
      () => {
        businessExecutions += 1;
        throw new Error('BUSINESS_MUTATION_MUST_NOT_RUN_AFTER_RESTART');
      }
    );
    expect(replay).toEqual({ ok: true, value: { categoryId: resourceId, created: true } });
    expect(businessExecutions).toBe(1);

    const acknowledged = restarted.transactionExecutor.execute(asCorrelationId('30-u-ack-restarted'), (transaction) =>
      repositories.platformPolicyTransactionRepository.acknowledgeArchivePendingOperation(
        repositoryContext('30-u-ack-restarted', transaction),
        pendingIdentity(operationId, intentFingerprint)
      )
    );
    expect(acknowledged.ok && acknowledged.value).toMatchObject({
      operationId,
      acknowledgementKind: 'completed',
      acknowledgedAt: NOW
    });
    const nextIntent = restarted.transactionExecutor.execute(asCorrelationId('30-u-acquire-new-intent'), (transaction) =>
      repositories.platformPolicyTransactionRepository.acquireArchivePendingOperation(
        repositoryContext('30-u-acquire-new-intent', transaction),
        pendingIdentity('archive-op-30u-after-ack', intentFingerprint)
      )
    );
    expect(nextIntent.ok && nextIntent.value.operationId).toBe('archive-op-30u-after-ack');
    expect(restarted.database.prepare(
      'SELECT COUNT(*) AS count FROM archive_categories WHERE id=?'
    ).get(resourceId)?.count).toBe(1);
    expect(restarted.database.prepare(
      'SELECT COUNT(*) AS count FROM audit_log WHERE id=?'
    ).get('audit-30u-restart')?.count).toBe(1);
    expect(restarted.database.prepare(
      'SELECT COUNT(*) AS count FROM platform_policy_archive_operation_retries WHERE operation_id=?'
    ).get(operationId)?.count).toBe(1);
  });

  it('coalesces concurrent candidates and fails closed for binding or intent conflicts', () => {
    const harness = makeHarness();
    const intentFingerprint = fingerprint('30-u:coalesced-intent');
    const first = harness.runtime.transactionExecutor.execute(asCorrelationId('30-u-coalesce-first'), (transaction) =>
      harness.repositories.platformPolicyTransactionRepository.acquireArchivePendingOperation(
        repositoryContext('30-u-coalesce-first', transaction),
        pendingIdentity('archive-op-30u-coalesce-first', intentFingerprint)
      )
    );
    const second = harness.runtime.transactionExecutor.execute(asCorrelationId('30-u-coalesce-second'), (transaction) =>
      harness.repositories.platformPolicyTransactionRepository.acquireArchivePendingOperation(
        repositoryContext('30-u-coalesce-second', transaction),
        pendingIdentity('archive-op-30u-coalesce-second', intentFingerprint)
      )
    );
    expect(first.ok && first.value.operationId).toBe('archive-op-30u-coalesce-first');
    expect(second.ok && second.value.operationId).toBe('archive-op-30u-coalesce-first');

    const operationFingerprint = fingerprint('30-u:bound-operation');
    const bound = harness.runtime.transactionExecutor.execute(asCorrelationId('30-u-bind'), (transaction) =>
      harness.repositories.platformPolicyTransactionRepository.bindArchivePendingOperation(
        repositoryContext('30-u-bind', transaction),
        {
          operationId: 'archive-op-30u-coalesce-first',
          operationFingerprint,
          mutation: 'archive:createCategory',
          resourceFamilyId: FAMILY_ID,
          actorAccountId: ACCOUNT_ID,
          purpose: 'archive'
        }
      )
    );
    expect(bound.ok).toBe(true);
    const conflictingBinding = harness.runtime.transactionExecutor.execute(asCorrelationId('30-u-bind-conflict'), (transaction) =>
      harness.repositories.platformPolicyTransactionRepository.bindArchivePendingOperation(
        repositoryContext('30-u-bind-conflict', transaction),
        {
          operationId: 'archive-op-30u-coalesce-first',
          operationFingerprint: fingerprint('30-u:different-operation'),
          mutation: 'archive:createCategory',
          resourceFamilyId: FAMILY_ID,
          actorAccountId: ACCOUNT_ID,
          purpose: 'archive'
        }
      )
    );
    expect(conflictingBinding.ok).toBe(false);
    const conflictingIntent = harness.runtime.transactionExecutor.execute(asCorrelationId('30-u-intent-conflict'), (transaction) =>
      harness.repositories.platformPolicyTransactionRepository.acquireArchivePendingOperation(
        repositoryContext('30-u-intent-conflict', transaction),
        pendingIdentity('archive-op-30u-coalesce-first', fingerprint('30-u:different-intent'))
      )
    );
    expect(conflictingIntent.ok).toBe(false);
    const prematureAcknowledgement = harness.runtime.transactionExecutor.execute(asCorrelationId('30-u-premature-ack'), (transaction) =>
      harness.repositories.platformPolicyTransactionRepository.acknowledgeArchivePendingOperation(
        repositoryContext('30-u-premature-ack', transaction),
        pendingIdentity('archive-op-30u-coalesce-first', intentFingerprint)
      )
    );
    expect(prematureAcknowledgement.ok).toBe(false);
    expect(() => harness.runtime.database.prepare(`
      UPDATE platform_policy_archive_pending_operations
      SET intent_fingerprint=? WHERE operation_id=?
    `).run(fingerprint('tampered'), 'archive-op-30u-coalesce-first')).toThrow(/only one binding and one acknowledgement/u);
    expect(() => harness.runtime.database.prepare(
      'DELETE FROM platform_policy_archive_pending_operations WHERE operation_id=?'
    ).run('archive-op-30u-coalesce-first')).toThrow(/durable/u);
  });

  it('acknowledges an unbound side-effect-free cancellation and permits a fresh identity', () => {
    const harness = makeHarness();
    const intentFingerprint = fingerprint('30-u:cancelled-file-dialog');
    const operationId = 'archive-op-30u-cancelled';
    const acquired = harness.runtime.transactionExecutor.execute(asCorrelationId('30-u-cancel-acquire'), (transaction) =>
      harness.repositories.platformPolicyTransactionRepository.acquireArchivePendingOperation(
        repositoryContext('30-u-cancel-acquire', transaction),
        pendingIdentity(operationId, intentFingerprint)
      )
    );
    expect(acquired.ok).toBe(true);
    const cancelled = harness.runtime.transactionExecutor.execute(asCorrelationId('30-u-cancel-ack'), (transaction) =>
      harness.repositories.platformPolicyTransactionRepository.acknowledgeArchivePendingOperation(
        repositoryContext('30-u-cancel-ack', transaction),
        pendingIdentity(operationId, intentFingerprint)
      )
    );
    expect(cancelled.ok && cancelled.value.acknowledgementKind).toBe('cancelled');
    const next = harness.runtime.transactionExecutor.execute(asCorrelationId('30-u-cancel-next'), (transaction) =>
      harness.repositories.platformPolicyTransactionRepository.acquireArchivePendingOperation(
        repositoryContext('30-u-cancel-next', transaction),
        pendingIdentity('archive-op-30u-after-cancel', intentFingerprint)
      )
    );
    expect(next.ok && next.value.operationId).toBe('archive-op-30u-after-cancel');
  });
});
