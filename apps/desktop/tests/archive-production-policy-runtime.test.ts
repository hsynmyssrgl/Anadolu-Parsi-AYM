import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ArchiveApplicationContext } from '@ppt/application';
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
  type PlatformPolicyReceiptRecord,
  type PlatformPolicyRequest
} from '@ppt/platform-policy';
import type {
  RepositoryExecutionContext,
  TransactionContext
} from '@ppt/repository-contracts';
import { createArchiveProductionPolicyEnforcementPointResolver } from '../src/main/archive-production-policy-runtime.js';
import { RepositoryBackedArchiveUnitOfWork } from '../src/main/archive-application-adapter.js';
import { FamilyDataStore } from '../src/main/data-store.js';
import { FileDeviceIdentityProvider } from '../src/main/device-identity.js';
import { SqliteFamilyDatabaseRuntime } from '../src/main/family-database-runtime.js';
import { createSqliteRepositoryCompositionRoot } from '../src/main/repository-composition-root.js';
import {
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '@ppt/repositories';

const NOW = asIsoDateTime('2026-08-06T03:00:00.000Z');
const STARTS_AT = asIsoDateTime('2026-01-01T00:00:00.000Z');
const FAMILY_ID = asFamilyId('family-policy-runtime');
const ACCOUNT_ID = asUserId('account-policy-runtime');
const PERSON_ID = asPersonId('person-policy-runtime');
const POLICY_VERSION = '30-o-archive-production-policy-v1';
const clock: Clock = Object.freeze({ now: () => NOW });
const temporaryDirectories: string[] = [];
const activeRuntimes: SqliteFamilyDatabaseRuntime[] = [];
const writableFence = () => ({ writable: true, epoch: 30 });
const controlledProjectionProof = (
  record: PlatformPolicyReceiptRecord
): PlatformPolicyJournalProjectionProof => Object.freeze({
  schemaVersion: 1,
  receiptHash: computePlatformPolicyReceiptHash(record.receipt),
  recordHash: computePlatformPolicyReceiptRecordHash(record),
  receiptNonce: record.receipt.nonce,
  entrySequence: 1,
  entryHash: 'd'.repeat(64),
  headSequence: 1,
  headHash: 'd'.repeat(64),
  journalSizeBytes: 512,
  issuedAt: record.recordedAt,
  proofMac: 'e'.repeat(64)
});
const noOpReceiptSink = Object.freeze({
  append: () => undefined,
  ensure: controlledProjectionProof,
  verifyProjectionProof: () => true
});

const policyKernel = (): PlatformPolicyKernel => new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('30-o-archive-production-policy-test-signing-key', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['archive.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

const recordingProvider = (
  requests: PlatformPolicyRequest[],
  afterAuthorize?: () => void
): PlatformPolicyAuthorizationProvider => {
  const kernel = policyKernel();
  return Object.freeze({
    resolvePolicyPackage: () => kernel.policyPackage,
    authorize({ request, nonce }) {
      requests.push(request);
      const authorization = kernel.authorizeWithReceipt(request, request.occurredAt, nonce);
      afterAuthorize?.();
      return Object.freeze({
        effectiveRequest: request,
        authorization
      });
    },
    verify({ request, receipt }) {
      return kernel.verifyReceiptForRequest(receipt, request);
    }
  });
};

const applicationContext = (suffix: string): ArchiveApplicationContext => ({
  familyId: FAMILY_ID,
  actor: {
    userId: ACCOUNT_ID,
    role: 'family_admin',
    personId: PERSON_ID
  },
  correlationId: asCorrelationId(`30-o-archive-${suffix}`),
  operationId: `archive-operation-${suffix}`,
  operationFingerprint: createHash('sha256').update(`archive-operation-${suffix}`, 'utf8').digest('hex')
});

const repositoryContext = (
  context: ArchiveApplicationContext,
  transaction: TransactionContext
): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: {
    userId: context.actor.userId,
    roles: [context.actor.role],
    personId: PERSON_ID
  },
  correlationId: context.correlationId,
  occurredAt: transaction.occurredAt
});

afterEach(() => {
  for (const runtime of activeRuntimes.splice(0)) runtime.close();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('archive production policy runtime', () => {
  it('resolves live SQLite authority and resources for governed archive writes', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'archive-production-policy-'));
    temporaryDirectories.push(directory);
    const runtime = new SqliteFamilyDatabaseRuntime({
      databasePath: join(directory, 'family.db'),
      applicationVersion: '30-o-test',
      clock,
      skipFileMigrationSafetyBackup: true
    });
    activeRuntimes.push(runtime);
    const repositories = createSqliteRepositoryCompositionRoot();
    const deviceIdentity = new FileDeviceIdentityProvider(join(directory, 'device-identity.json'), clock);
    const identity = deviceIdentity.snapshot();
    runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)')
      .run(FAMILY_ID, 'Policy Runtime Family', STARTS_AT);

    const seeded = runtime.transactionExecutor.execute(asCorrelationId('30-o-archive-seed'), (transaction) => {
      const execution: RepositoryExecutionContext = {
        transaction: transaction.transaction,
        actor: { userId: ACCOUNT_ID, roles: ['family_admin'], personId: PERSON_ID },
        correlationId: transaction.correlationId,
        occurredAt: transaction.occurredAt
      };
      const person = repositories.personRepository.insert(execution, {
        id: PERSON_ID,
        familyId: FAMILY_ID,
        displayName: 'Policy Person',
        relationshipType: 'admin',
        generation: 1,
        branch: 'main',
        status: 'active',
        createdAt: STARTS_AT
      });
      if (!person.ok) return person;
      const account = repositories.accountRepository.insert(execution, {
        id: ACCOUNT_ID,
        displayName: 'Policy Account',
        email: 'policy-runtime@local.pardus',
        passwordRecord: 'test-only-password-record',
        role: 'family_admin',
        status: 'active',
        startsAt: STARTS_AT,
        personId: PERSON_ID,
        createdAt: STARTS_AT
      });
      if (!account.ok) return account;
      const trusted = repositories.trustedDeviceRepository.upsert(execution, {
        id: 'trusted-device-policy-runtime',
        accountId: ACCOUNT_ID,
        deviceId: identity.deviceId,
        displayName: 'Policy Runtime Device',
        fingerprint: identity.fingerprint,
        publicKeyPem: identity.publicKeyPem,
        trustedAt: NOW,
        lastSeenAt: NOW,
        securityEpoch: 0
      });
      if (!trusted.ok) return trusted;
      for (const resourceType of ['archive_item', 'archive_retention_policy', 'archive_category'] as const) {
        const permission = repositories.objectPermissionRepository.upsert(execution, {
          id: `permission-${resourceType}`,
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
      const unrelatedPermission = repositories.objectPermissionRepository.upsert(execution, {
        id: 'permission-unrelated-ai',
        subjectAccountId: ACCOUNT_ID,
        resourceType: 'health_record',
        resourceId: '*',
        actions: ['ai_process'],
        effect: 'allow',
        purpose: 'ai_processing',
        startsAt: STARTS_AT,
        createdAt: STARTS_AT
      });
      return unrelatedPermission.ok ? ok(undefined) : unrelatedPermission;
    });
    expect(seeded.ok).toBe(true);

    const abandonedReplay = runtime.transactionExecutor.execute(
      asCorrelationId('30-v-production-expired-replay-seed'),
      (transaction) => repositories.platformPolicyTransactionRepository.reserveReplayNonce(
        repositoryContext(applicationContext('expired-replay-seed'), transaction),
        {
          nonce: 'nonce-30v-production-expired-unused',
          reservedAtMs: Date.parse(NOW) - 120_000,
          expiresAtMs: Date.parse(NOW) - 60_000
        }
      )
    );
    expect(abandonedReplay).toEqual({ ok: true, value: true });

    const requests: PlatformPolicyRequest[] = [];
    const receiptRecords: PlatformPolicyReceiptRecord[] = [];
    const recordExecutionOrder: string[] = [];
    const resolver = createArchiveProductionPolicyEnforcementPointResolver({
      transactionExecutor: runtime.transactionExecutor,
      accountRepository: repositories.accountRepository,
      permissionRepository: repositories.objectPermissionRepository,
      trustedDeviceRepository: repositories.trustedDeviceRepository,
      archiveRepository: repositories.archiveRepository,
      personRepository: repositories.personRepository,
      deviceIdentityProvider: deviceIdentity,
      authorizationProvider: recordingProvider(requests),
      receiptSink: {
        append: (record) => { receiptRecords.push(record); },
        ensure: (record) => {
          receiptRecords.push(record);
          if (record.correlationId === '30-o-archive-record') recordExecutionOrder.push('receipt-projected');
          return controlledProjectionProof(record);
        },
        verifyProjectionProof: () => true
      },
      policyTransactionRepository: repositories.platformPolicyTransactionRepository,
      clusterFence: writableFence,
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
      clusterFence: writableFence
    });

    const createContext = applicationContext('create');
    const archiveItem = {
      id: 'archive-item-policy-runtime',
      familyId: FAMILY_ID,
      title: 'Governed item',
      originalName: 'governed.txt',
      storedName: 'governed.bin',
      mimeType: 'text/plain',
      sizeBytes: 8,
      sha256: 'a'.repeat(64),
      sensitivity: 'standard' as const,
      aiProcessingAllowed: false,
      createdAt: NOW
    };
    const created = await unitOfWork.execute(
      createContext,
      {
        action: 'create',
        capability: 'archive.write',
        resourceType: 'archive_item',
        resourceId: archiveItem.id,
        purpose: 'archive'
      },
      (scope) => scope.insertItem(archiveItem)
    );
    expect(created.ok).toBe(true);
    expect(Number(runtime.database.prepare(
      'SELECT COUNT(*) AS count FROM platform_policy_replay_reservations WHERE nonce=?'
    ).get('nonce-30v-production-expired-unused')?.count)).toBe(0);
    expect(Number(runtime.database.prepare(
      "SELECT cutoff_ms FROM platform_policy_replay_pruning_state WHERE scope='archive'"
    ).get()?.cutoff_ms)).toBe(Date.parse(NOW));

    const updateContext = applicationContext('update');
    const updated = await unitOfWork.execute(
      updateContext,
      {
        action: 'update',
        capability: 'archive.write',
        resourceType: 'archive_item',
        resourceId: archiveItem.id,
        purpose: 'archive'
      },
      (scope) => scope.updateClassification({
        itemId: archiveItem.id,
        categoryId: null,
        sensitivity: 'personal',
        aiProcessingAllowed: false,
        tags: []
      })
    );
    expect(updated.ok).toBe(true);

    const authorityRaceRequests: PlatformPolicyRequest[] = [];
    const authorityRaceResolver = createArchiveProductionPolicyEnforcementPointResolver({
      transactionExecutor: runtime.transactionExecutor,
      accountRepository: repositories.accountRepository,
      permissionRepository: repositories.objectPermissionRepository,
      trustedDeviceRepository: repositories.trustedDeviceRepository,
      archiveRepository: repositories.archiveRepository,
      personRepository: repositories.personRepository,
      deviceIdentityProvider: deviceIdentity,
      authorizationProvider: recordingProvider(authorityRaceRequests, () => {
          runtime.database.prepare('DELETE FROM object_permissions WHERE id=?')
            .run('permission-archive_item');
      }),
      receiptSink: noOpReceiptSink,
      policyTransactionRepository: repositories.platformPolicyTransactionRepository,
      clusterFence: writableFence,
      policyVersion: POLICY_VERSION,
      clock
    });
    const authorityRaceUnitOfWork = new RepositoryBackedArchiveUnitOfWork({
      transactionExecutor: runtime.transactionExecutor,
      archiveRepository: repositories.archiveRepository,
      accountRepository: repositories.accountRepository,
      permissionRepository: repositories.objectPermissionRepository,
      auditRepository: repositories.auditRepository,
      outboxRepository: repositories.outboxRepository,
      policyEnforcementPointResolver: authorityRaceResolver,
      clusterFence: writableFence
    });
    let authorityRaceOperationRan = false;
    const authorityRaceContext = applicationContext('authority-race');
    const authorityRaceResult = await authorityRaceUnitOfWork.execute(
      authorityRaceContext,
      {
        action: 'record',
        capability: 'archive.write',
        resourceType: 'archive_item',
        resourceId: archiveItem.id,
        purpose: 'archive'
      },
      () => {
        authorityRaceOperationRan = true;
        return ok(undefined);
      }
    );
    expect(authorityRaceResult.ok).toBe(false);
    expect(authorityRaceResult.ok ? '' : authorityRaceResult.error.message).toMatch(/authority changed after receipt issuance/u);
    expect(authorityRaceOperationRan).toBe(false);
    expect(authorityRaceRequests).toHaveLength(1);

    const restoredPermission = runtime.transactionExecutor.execute(
      asCorrelationId('30-o-authority-race-restore'),
      (transaction) => repositories.objectPermissionRepository.upsert(
        repositoryContext(authorityRaceContext, transaction),
        {
          id: 'permission-archive_item',
          subjectAccountId: ACCOUNT_ID,
          resourceType: 'archive_item',
          resourceId: '*',
          actions: ['create', 'update', 'delete', 'record'],
          effect: 'allow',
          purpose: 'archive',
          startsAt: STARTS_AT,
          createdAt: STARTS_AT
        }
      )
    );
    expect(restoredPermission.ok).toBe(true);

    const resourceRaceSeedContext = applicationContext('resource-race-seed');
    const resourceRaceSeed = await unitOfWork.execute(
      resourceRaceSeedContext,
      {
        action: 'update',
        capability: 'archive.write',
        resourceType: 'archive_item',
        resourceId: archiveItem.id,
        purpose: 'archive'
      },
      (scope) => scope.updateClassification({
        itemId: archiveItem.id,
        categoryId: null,
        sensitivity: 'personal',
        aiProcessingAllowed: false,
        tags: [{ id: 'archive-tag-race', name: 'Receipt race tag' }]
      })
    );
    expect(resourceRaceSeed.ok).toBe(true);
    let hideGovernedTagRelation = false;
    const resourceRaceArchiveRepository = new Proxy(repositories.archiveRepository, {
      get(target, property, receiver) {
        if (property === 'listClassificationsForPolicyResolution') {
          return (context: RepositoryExecutionContext) => {
            const result = target.listClassificationsForPolicyResolution(context);
            if (!result.ok || !hideGovernedTagRelation) return result;
            return ok(result.value.map((classification) => classification.itemId === archiveItem.id
              ? {
                  ...classification,
                  tags: classification.tags.filter((tag) => tag.id !== 'archive-tag-race')
                }
              : classification));
          };
        }
        const value: unknown = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
    const resourceRaces: Array<{
      readonly label: string;
      readonly prepare?: () => void;
      readonly mutate: () => void;
      readonly restore: () => void;
    }> = [
      {
        label: 'tag-relation-race',
        mutate: () => {
          hideGovernedTagRelation = true;
        },
        restore: () => {
          hideGovernedTagRelation = false;
        }
      }
    ];
    for (const resourceRace of resourceRaces) {
      resourceRace.prepare?.();
      const resourceRaceRequests: PlatformPolicyRequest[] = [];
      const resourceRaceResolver = createArchiveProductionPolicyEnforcementPointResolver({
        transactionExecutor: runtime.transactionExecutor,
        accountRepository: repositories.accountRepository,
        permissionRepository: repositories.objectPermissionRepository,
        trustedDeviceRepository: repositories.trustedDeviceRepository,
        archiveRepository: resourceRaceArchiveRepository,
        personRepository: repositories.personRepository,
        deviceIdentityProvider: deviceIdentity,
        authorizationProvider: recordingProvider(resourceRaceRequests, resourceRace.mutate),
        receiptSink: noOpReceiptSink,
        policyTransactionRepository: repositories.platformPolicyTransactionRepository,
        clusterFence: writableFence,
        policyVersion: POLICY_VERSION,
        clock
      });
      const resourceRaceUnitOfWork = new RepositoryBackedArchiveUnitOfWork({
        transactionExecutor: runtime.transactionExecutor,
        archiveRepository: resourceRaceArchiveRepository,
        accountRepository: repositories.accountRepository,
        permissionRepository: repositories.objectPermissionRepository,
        auditRepository: repositories.auditRepository,
        outboxRepository: repositories.outboxRepository,
        policyEnforcementPointResolver: resourceRaceResolver,
        clusterFence: writableFence
      });
      let resourceRaceOperationRan = false;
      const resourceRaceContext = applicationContext(resourceRace.label);
      const resourceRaceResult = await resourceRaceUnitOfWork.execute(
        resourceRaceContext,
        {
          action: 'record',
          capability: 'archive.write',
          resourceType: 'archive_item',
          resourceId: archiveItem.id,
          purpose: 'archive'
        },
        () => {
          resourceRaceOperationRan = true;
          return ok(undefined);
        }
      );
      expect(resourceRaceResult.ok).toBe(false);
      expect(resourceRaceResult.ok ? '' : resourceRaceResult.error.message).toMatch(/resource changed after receipt issuance/u);
      expect(resourceRaceOperationRan).toBe(false);
      expect(resourceRaceRequests).toHaveLength(1);
      resourceRace.restore();
    }

    let mutableFence = { writable: true, epoch: 30 };
    const fenceRaceResolver = createArchiveProductionPolicyEnforcementPointResolver({
      transactionExecutor: runtime.transactionExecutor,
      accountRepository: repositories.accountRepository,
      permissionRepository: repositories.objectPermissionRepository,
      trustedDeviceRepository: repositories.trustedDeviceRepository,
      archiveRepository: repositories.archiveRepository,
      personRepository: repositories.personRepository,
      deviceIdentityProvider: deviceIdentity,
      authorizationProvider: recordingProvider([]),
      receiptSink: noOpReceiptSink,
      policyTransactionRepository: repositories.platformPolicyTransactionRepository,
      clusterFence: () => mutableFence,
      policyVersion: POLICY_VERSION,
      clock
    });
    const fenceRaceUnitOfWork = new RepositoryBackedArchiveUnitOfWork({
      transactionExecutor: runtime.transactionExecutor,
      archiveRepository: repositories.archiveRepository,
      accountRepository: repositories.accountRepository,
      permissionRepository: repositories.objectPermissionRepository,
      auditRepository: repositories.auditRepository,
      outboxRepository: repositories.outboxRepository,
      policyEnforcementPointResolver: fenceRaceResolver,
      clusterFence: () => mutableFence
    });
    const fenceRaceContext = applicationContext('fence-race');
    const fenceRaceResult = await fenceRaceUnitOfWork.execute(
      fenceRaceContext,
      {
        action: 'record',
        capability: 'archive.write',
        resourceType: 'archive_item',
        resourceId: archiveItem.id,
        purpose: 'archive'
      },
      (scope) => {
        const appended = scope.appendAudit({
          id: 'audit-fence-race-must-rollback',
          action: 'archive.opened',
          resourceType: 'archive_item',
          resourceId: archiveItem.id,
          occurredAt: scope.occurredAt,
          actorId: ACCOUNT_ID
        });
        mutableFence = { writable: false, epoch: 31 };
        return appended.ok ? ok(undefined) : appended;
      }
    );
    expect(fenceRaceResult.ok).toBe(false);
    mutableFence = { writable: true, epoch: 30 };
    const fenceAuditRead = runtime.transactionExecutor.execute(
      asCorrelationId('30-o-fence-race-audit-read'),
      (transaction) => repositories.auditRepository.listEntries(repositoryContext(fenceRaceContext, transaction))
    );
    expect(fenceAuditRead.ok && fenceAuditRead.value.some((entry) =>
      entry.id === 'audit-fence-race-must-rollback'
    )).toBe(false);

    const recordContext = applicationContext('record');
    const recorded = await unitOfWork.execute(
      recordContext,
      {
        action: 'record',
        capability: 'archive.write',
        resourceType: 'archive_item',
        resourceId: archiveItem.id,
        purpose: 'archive'
      },
      (scope) => {
        recordExecutionOrder.push('sqlite-transaction-started');
        return scope.appendAudit({
          id: 'audit-archive-opened',
          action: 'archive.opened',
          resourceType: 'archive_item',
          resourceId: archiveItem.id,
          occurredAt: scope.occurredAt,
          actorId: ACCOUNT_ID
        });
      }
    );
    expect(recorded.ok).toBe(true);
    expect(recordExecutionOrder).toEqual(['sqlite-transaction-started', 'receipt-projected']);
    const auditContext = applicationContext('audit-read');
    const auditEntries = runtime.transactionExecutor.execute(auditContext.correlationId, (transaction) =>
      repositories.auditRepository.listEntries(repositoryContext(auditContext, transaction))
    );
    expect(auditEntries.ok && auditEntries.value.some((entry) =>
      entry.action === 'archive.opened' && entry.resourceId === archiveItem.id
    )).toBe(true);

    const deleteContext = applicationContext('delete');
    const deleted = await unitOfWork.execute(
      deleteContext,
      {
        action: 'delete',
        capability: 'archive.write',
        resourceType: 'archive_item',
        resourceId: archiveItem.id,
        purpose: 'archive'
      },
      (scope) => scope.markDestroyed(archiveItem.id, scope.occurredAt)
    );
    expect(deleted.ok).toBe(true);

    expect(requests).toHaveLength(5);
    expect(receiptRecords).toHaveLength(5);
    expect(requests.map((request) => request.purpose)).toEqual([
      'archive',
      'archive',
      'archive',
      'archive',
      'archive'
    ]);
    expect(requests.map((request) => request.resource.sensitivity)).toEqual([
      'internal',
      'internal',
      'personal',
      'personal',
      'personal'
    ]);
    expect(requests[0]!.grants).toHaveLength(3);
    expect(requests[0]!.grants?.every((grant) => grant.purposes?.[0] === 'archive')).toBe(true);
    expect(requests[0]!.grants?.some((grant) => grant.id === 'permission-unrelated-ai')).toBe(false);

    const readContext = applicationContext('read-destroyed');
    const afterDelete = runtime.transactionExecutor.execute(readContext.correlationId, (transaction) =>
      repositories.archiveRepository.findForPolicyResolution(repositoryContext(readContext, transaction), archiveItem.id)
    );
    expect(afterDelete.ok && afterDelete.value).toBeNull();
  });

  it('fails closed when the live trusted-device fingerprint no longer matches', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'archive-production-policy-device-'));
    temporaryDirectories.push(directory);
    const runtime = new SqliteFamilyDatabaseRuntime({
      databasePath: join(directory, 'family.db'),
      applicationVersion: '30-o-device-test',
      clock,
      skipFileMigrationSafetyBackup: true
    });
    activeRuntimes.push(runtime);
    const repositories = createSqliteRepositoryCompositionRoot();
    const deviceIdentity = new FileDeviceIdentityProvider(join(directory, 'device-identity.json'), clock);
    const identity = deviceIdentity.snapshot();
    runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)')
      .run(FAMILY_ID, 'Policy Runtime Family', STARTS_AT);
    const seeded = runtime.transactionExecutor.execute(asCorrelationId('30-o-device-seed'), (transaction) => {
      const execution: RepositoryExecutionContext = {
        transaction: transaction.transaction,
        actor: { userId: ACCOUNT_ID, roles: ['family_admin'], personId: PERSON_ID },
        correlationId: transaction.correlationId,
        occurredAt: transaction.occurredAt
      };
      const person = repositories.personRepository.insert(execution, {
        id: PERSON_ID,
        familyId: FAMILY_ID,
        displayName: 'Policy Person',
        relationshipType: 'admin',
        generation: 1,
        branch: 'main',
        status: 'active',
        createdAt: STARTS_AT
      });
      if (!person.ok) return person;
      const account = repositories.accountRepository.insert(execution, {
        id: ACCOUNT_ID,
        displayName: 'Policy Account',
        email: 'policy-device@local.pardus',
        passwordRecord: 'test-record',
        role: 'family_admin',
        status: 'active',
        startsAt: STARTS_AT,
        personId: PERSON_ID,
        createdAt: STARTS_AT
      });
      if (!account.ok) return account;
      return repositories.trustedDeviceRepository.upsert(execution, {
        id: 'trusted-device-mismatch',
        accountId: ACCOUNT_ID,
        deviceId: identity.deviceId,
        displayName: 'Device',
        fingerprint: 'wrong-fingerprint',
        publicKeyPem: identity.publicKeyPem,
        trustedAt: NOW,
        lastSeenAt: NOW,
        securityEpoch: 0
      });
    });
    expect(seeded.ok).toBe(true);

    const requests: PlatformPolicyRequest[] = [];
    const resolver = createArchiveProductionPolicyEnforcementPointResolver({
      transactionExecutor: runtime.transactionExecutor,
      accountRepository: repositories.accountRepository,
      permissionRepository: repositories.objectPermissionRepository,
      trustedDeviceRepository: repositories.trustedDeviceRepository,
      archiveRepository: repositories.archiveRepository,
      personRepository: repositories.personRepository,
      deviceIdentityProvider: deviceIdentity,
      authorizationProvider: recordingProvider(requests),
      receiptSink: noOpReceiptSink,
      policyTransactionRepository: repositories.platformPolicyTransactionRepository,
      clusterFence: writableFence,
      policyVersion: POLICY_VERSION,
      clock
    });

    await expect(resolver.resolve(applicationContext('device-mismatch'))).rejects.toMatchObject({
      code: 'AUTHORITY_RESOLUTION_FAILED'
    });
    expect(requests).toEqual([]);
  });

  it('rejects a partial DataStore production policy composition before creating storage', () => {
    const directory = mkdtempSync(join(tmpdir(), 'archive-production-policy-partial-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'must-not-exist.db');
    const requests: PlatformPolicyRequest[] = [];
    expect(() => new FamilyDataStore({
      databasePath,
      archivePolicyAuthorizationProvider: recordingProvider(requests),
      archivePolicyReceiptSink: noOpReceiptSink,
      archivePolicyVersion: POLICY_VERSION
    })).toThrow(/live cluster fence/u);
    expect(requests).toEqual([]);
  });
});
