import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { asCorrelationId, asIsoDateTime, asUserId } from '@ppt/core';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import type { PolicyAuthorizedRepositoryExecutionContext } from '@ppt/repository-contracts';
import {
  SqliteLifeRepository,
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '@ppt/repositories';
import { FamilyDataStore } from '../src/main/data-store.js';

const POLICY_VERSION = '30-y-life-policy-test-v1';
const temporaryDirectories: string[] = [];
const openStores: FamilyDataStore[] = [];

const kernel = new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('30-y-life-policy-controlled-signing-key-v1', 'utf8'),
  applicationCapabilities: {
    'windows-desktop': [
      'family.read',
      'family.write',
      'health.read',
      'health.write',
      'finance.read',
      'finance.write',
      'location.read',
      'archive.write'
    ]
  },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

const provider: PlatformPolicyAuthorizationProvider = Object.freeze({
  resolvePolicyPackage: () => kernel.policyPackage,
  authorize({ request, nonce }) {
    return Object.freeze({
      effectiveRequest: request,
      authorization: kernel.authorizeWithReceipt(request, request.occurredAt, nonce)
    });
  },
  verify({ request, receipt }) {
    return kernel.verifyReceiptForRequest(receipt, request);
  }
});

const projectionProof = (
  record: PlatformPolicyReceiptRecord
): PlatformPolicyJournalProjectionProof => Object.freeze({
  schemaVersion: 1,
  receiptHash: computePlatformPolicyReceiptHash(record.receipt),
  recordHash: computePlatformPolicyReceiptRecordHash(record),
  receiptNonce: record.receipt.nonce,
  entrySequence: 1,
  entryHash: '8'.repeat(64),
  headSequence: 1,
  headHash: '8'.repeat(64),
  journalSizeBytes: 512,
  issuedAt: record.recordedAt,
  proofMac: 'b'.repeat(64)
});

const makeDirectory = (prefix: string): string => {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
};

const trackStore = (store: FamilyDataStore): FamilyDataStore => {
  openStores.push(store);
  return store;
};

const closeStore = (store: FamilyDataStore): void => {
  const index = openStores.indexOf(store);
  if (index >= 0) openStores.splice(index, 1);
  store.close();
};

const makeProductionStore = (writable = true) => {
  const directory = makeDirectory('ppt-30y-life-policy-');
  const store = trackStore(new FamilyDataStore({
    databasePath: join(directory, 'family.db'),
    seed: false,
    archivePolicyAuthorizationProvider: provider,
    archivePolicyReceiptSink: {
      append: () => undefined,
      ensure: projectionProof,
      verifyProjectionProof: () => true
    },
    archivePolicyVersion: POLICY_VERSION,
    archiveClusterFence: () => ({ writable, epoch: 32 })
  }));
  store.setupAdmin({
    familyName: '30-Y Yaşam Ailesi',
    displayName: '30-Y Yaşam Yöneticisi',
    email: 'life-30y@example.com',
    password: 'Yasam30YGucluParola!'
  });
  return { directory, store };
};

afterEach(() => {
  for (const store of openStores.splice(0)) {
    try { store.close(); } catch { /* best-effort test cleanup */ }
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('30-Y governed LIFE policy enforcement', () => {
  it('fails closed when no LIFE PEP is composed', async () => {
    const directory = makeDirectory('ppt-30y-life-fail-closed-');
    const store = trackStore(new FamilyDataStore({
      databasePath: join(directory, 'family.db'),
      seed: false
    }));
    store.setupAdmin({
      familyName: 'Kapalı Yaşam Ailesi',
      displayName: 'Kapalı Yaşam Yöneticisi',
      password: 'KapaliYasam30YParola!'
    });
    const ownerPersonId = store.listAccounts()[0]!.personId!;

    await expect(store.listLifeRecords()).rejects.toThrow(/Life policy enforcement is not composed/u);
    await expect(store.createLifeRecord({
      ownerPersonId,
      category: 'task',
      title: 'PEP olmadan yaşam kaydı',
      status: 'planned',
      privacy: 'private'
    })).rejects.toThrow(/Life policy enforcement is not composed/u);
    closeStore(store);
  });

  it('rejects a forged repository context before LIFE SQL executes', () => {
    const forged = {
      transaction: Object.freeze({}),
      actor: { userId: asUserId('forged-life-account'), roles: ['family_admin'] },
      correlationId: asCorrelationId('forged-life-context'),
      occurredAt: asIsoDateTime('2026-08-08T00:00:00.000Z'),
      policyAuthorization: Object.freeze({})
    } as unknown as PolicyAuthorizedRepositoryExecutionContext;
    const repository = new SqliteLifeRepository();

    expect(() => repository.listLifeRecords(forged)).toThrow(/transaction context.*forged/i);
  });

  it('rejects LIFE access when the live production fence is not writable', async () => {
    const { store } = makeProductionStore(false);
    await expect(store.listLifeRecords()).rejects.toThrow(/writable|fence/i);
    closeStore(store);
  });

  it('rejects account and role drift between authorization and the LIFE transaction', async () => {
    const directory = makeDirectory('ppt-30y-life-authority-drift-');
    const databasePath = join(directory, 'family.db');
    let authorizations = 0;
    const driftingProvider: PlatformPolicyAuthorizationProvider = Object.freeze({
      resolvePolicyPackage: (applicationId) => provider.resolvePolicyPackage!(applicationId),
      authorize(input) {
        const authorization = provider.authorize(input);
        authorizations += 1;
        // Timeline/location reads may precede LIFE. Drift only after the exact
        // LIFE create receipt has been issued, independent of read count.
        if (input.request.resource.type === 'life_record' && input.request.action === 'create') {
          const mutator = new DatabaseSync(databasePath);
          try {
            mutator.prepare("UPDATE accounts SET role='adult_member' WHERE person_id IS NOT NULL").run();
          } finally {
            mutator.close();
          }
        }
        return authorization;
      },
      verify(input) {
        return provider.verify(input);
      }
    });
    const store = trackStore(new FamilyDataStore({
      databasePath,
      seed: false,
      archivePolicyAuthorizationProvider: driftingProvider,
      archivePolicyReceiptSink: {
        append: () => undefined,
        ensure: projectionProof,
        verifyProjectionProof: () => true
      },
      archivePolicyVersion: POLICY_VERSION,
      archiveClusterFence: () => ({ writable: true, epoch: 32 })
    }));
    store.setupAdmin({
      familyName: '30-Y Drift Ailesi',
      displayName: '30-Y Drift Yöneticisi',
      email: 'life-30y-drift@example.com',
      password: 'Life30YDriftParola!'
    });
    const owner = (await store.getSnapshot()).people[0]!;

    await expect(store.createLifeRecord({
      ownerPersonId: owner.id,
      category: 'task',
      title: 'Drift sırasında yazılmamalı',
      status: 'planned',
      privacy: 'private'
    })).rejects.toThrow(/account|role|authority|policy/i);
    closeStore(store);

    const probe = new DatabaseSync(databasePath, { readOnly: true });
    try {
      expect(Number(probe.prepare(
        "SELECT COUNT(*) AS count FROM life_records WHERE title='Drift sırasında yazılmamalı'"
      ).get()!.count)).toBe(0);
      expect(Number(probe.prepare(`
        SELECT COUNT(*) AS count FROM platform_policy_transaction_receipts
        WHERE resource_type='life_record' AND action='create'
      `).get()!.count)).toBe(0);
    } finally {
      probe.close();
    }
  });

  it('rejects provider subject, family, correlation, capability and resource substitution', async () => {
    type TamperMode = 'subject' | 'family' | 'correlation' | 'capability' | 'resource';
    let mode: TamperMode = 'subject';
    const tamperingProvider: PlatformPolicyAuthorizationProvider = Object.freeze({
      resolvePolicyPackage: (applicationId) => provider.resolvePolicyPackage!(applicationId),
      authorize({ request, nonce }) {
        const effectiveRequest = mode === 'subject'
          ? { ...request, subject: { ...request.subject, accountId: 'substituted-account' } }
          : mode === 'family'
            ? { ...request, resource: { ...request.resource, familyId: 'substituted-family' } }
            : mode === 'correlation'
              ? { ...request, correlationId: 'substituted-correlation' }
              : mode === 'capability'
                ? { ...request, capability: 'family.write' as const }
                : { ...request, resource: { ...request.resource, id: 'substituted-resource' } };
        return Object.freeze({
          effectiveRequest,
          authorization: kernel.authorizeWithReceipt(
            effectiveRequest,
            effectiveRequest.occurredAt,
            nonce
          )
        });
      },
      verify({ request, receipt }) {
        return kernel.verifyReceiptForRequest(receipt, request);
      }
    });
    const directory = makeDirectory('ppt-30y-life-provider-tamper-');
    const store = trackStore(new FamilyDataStore({
      databasePath: join(directory, 'family.db'),
      seed: false,
      archivePolicyAuthorizationProvider: tamperingProvider,
      archivePolicyReceiptSink: {
        append: () => undefined,
        ensure: projectionProof,
        verifyProjectionProof: () => true
      },
      archivePolicyVersion: POLICY_VERSION,
      archiveClusterFence: () => ({ writable: true, epoch: 32 })
    }));
    store.setupAdmin({
      familyName: '30-Y Tamper Ailesi',
      displayName: '30-Y Tamper Yöneticisi',
      email: 'life-30y-tamper@example.com',
      password: 'Life30YTamperParola!'
    });

    for (const candidate of ['subject', 'family', 'correlation', 'capability', 'resource'] as const) {
      mode = candidate;
      await expect(store.listLifeRecords()).rejects.toThrow(/policy|request|mismatch|changed/i);
    }
    closeStore(store);
  });

  it('rejects a receipt that expires before the LIFE transaction starts', async () => {
    let current = asIsoDateTime(new Date(Date.now() + 60_000).toISOString());
    let armed = false;
    const expiringProvider: PlatformPolicyAuthorizationProvider = Object.freeze({
      resolvePolicyPackage: (applicationId) => provider.resolvePolicyPackage!(applicationId),
      authorize(input) {
        const authorization = provider.authorize(input);
        if (armed) {
          current = asIsoDateTime(new Date(Date.parse(input.request.occurredAt) + 31_000).toISOString());
        }
        return authorization;
      },
      verify(input) {
        return provider.verify(input);
      }
    });
    const directory = makeDirectory('ppt-30y-life-expired-receipt-');
    const store = trackStore(new FamilyDataStore({
      databasePath: join(directory, 'family.db'),
      seed: false,
      clock: { now: () => current },
      archivePolicyAuthorizationProvider: expiringProvider,
      archivePolicyReceiptSink: {
        append: () => undefined,
        ensure: projectionProof,
        verifyProjectionProof: () => true
      },
      archivePolicyVersion: POLICY_VERSION,
      archiveClusterFence: () => ({ writable: true, epoch: 32 })
    }));
    store.setupAdmin({
      familyName: '30-Y Expiry Ailesi',
      displayName: '30-Y Expiry Yöneticisi',
      email: 'life-30y-expiry@example.com',
      password: 'Life30YExpiryParola!'
    });
    const membershipFix = new DatabaseSync(join(directory, 'family.db'));
    try {
      membershipFix.prepare("UPDATE accounts SET starts_at='2000-01-01T00:00:00.000Z'").run();
    } finally {
      membershipFix.close();
    }
    armed = true;

    await expect(store.listLifeRecords()).rejects.toThrow(/expired|policy/i);
    closeStore(store);
  });

  it('persists the exact family.write LIFE receipt and returns one committed record', async () => {
    const { directory, store } = makeProductionStore();
    const owner = (await store.getSnapshot()).people[0]!;
    const records = await store.createLifeRecord({
      ownerPersonId: owner.id,
      category: 'task',
      title: '30-Y receipt-bound yaşam kaydı',
      status: 'planned',
      privacy: 'private',
      dueAt: '2026-08-20T10:00:00.000Z'
    });
    const created = records.filter((record) => record.title === '30-Y receipt-bound yaşam kaydı');
    expect(created).toHaveLength(1);
    closeStore(store);

    const database = new DatabaseSync(join(directory, 'family.db'), { readOnly: true });
    try {
      const persisted = database.prepare(`
        SELECT policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        FROM life_records WHERE id=?
      `).get(created[0]!.id) as Record<string, unknown>;
      expect(persisted).toMatchObject({
        policy_receipt_version: 1,
        policy_resource_type: 'life_record',
        policy_resource_id: created[0]!.id,
        policy_action: 'create',
        policy_capability: 'family.write'
      });
      expect(String(persisted.policy_receipt_hash)).toMatch(/^[0-9a-f]{64}$/u);
      expect(String(persisted.policy_receipt_nonce).length).toBeGreaterThan(0);
      expect(String(persisted.policy_correlation_id).length).toBeGreaterThan(0);
      expect(Number(database.prepare(`
        SELECT COUNT(*) AS count
        FROM platform_policy_transaction_receipts
        WHERE receipt_hash=? AND resource_type='life_record'
          AND resource_id=? AND action='create' AND capability='family.write'
      `).get(persisted.policy_receipt_hash, created[0]!.id)!.count)).toBe(1);
      expect(Number(database.prepare(`
        SELECT COUNT(*) AS count
        FROM platform_policy_journal_projection_outbox
        WHERE receipt_hash=? AND status='projected'
      `).get(persisted.policy_receipt_hash)!.count)).toBe(1);
    } finally {
      database.close();
    }
  });

  it('recovers one pending protected-journal projection after restart without duplication', async () => {
    const directory = makeDirectory('ppt-30y-life-projection-restart-');
    const databasePath = join(directory, 'family.db');
    let ensureCalls = 0;
    const firstStore = trackStore(new FamilyDataStore({
      databasePath,
      seed: false,
      archivePolicyAuthorizationProvider: provider,
      archivePolicyReceiptSink: {
        append: () => undefined,
        ensure: (record) => {
          ensureCalls += 1;
          if (ensureCalls === 2) throw new Error('controlled LIFE projection interruption');
          return projectionProof(record);
        },
        verifyProjectionProof: () => true
      },
      archivePolicyVersion: POLICY_VERSION,
      archiveClusterFence: () => ({ writable: true, epoch: 32 })
    }));
    firstStore.setupAdmin({
      familyName: '30-Y Recovery Ailesi',
      displayName: '30-Y Recovery Yöneticisi',
      email: 'life-30y-recovery@example.com',
      password: 'Life30YRecoveryParola!'
    });
    const ownerPersonId = firstStore.listAccounts()[0]!.personId!;
    const created = await firstStore.createLifeRecord({
      ownerPersonId,
      category: 'task',
      title: 'Restart sonrası tek LIFE kaydı',
      status: 'planned',
      privacy: 'private'
    });
    expect(created.filter((record) => record.title === 'Restart sonrası tek LIFE kaydı')).toHaveLength(1);
    expect(ensureCalls).toBe(2);
    closeStore(firstStore);

    const projectedReceiptHashes: string[] = [];
    const restarted = trackStore(new FamilyDataStore({
      databasePath,
      seed: false,
      archivePolicyAuthorizationProvider: provider,
      archivePolicyReceiptSink: {
        append: () => undefined,
        ensure: (record) => {
          projectedReceiptHashes.push(computePlatformPolicyReceiptHash(record.receipt));
          return projectionProof(record);
        },
        verifyProjectionProof: () => true
      },
      archivePolicyVersion: POLICY_VERSION,
      archiveClusterFence: () => ({ writable: true, epoch: 32 })
    }));
    restarted.login({
      email: 'life-30y-recovery@example.com',
      password: 'Life30YRecoveryParola!'
    });
    const recovered = await restarted.listLifeRecords();
    expect(recovered.filter((record) => record.title === 'Restart sonrası tek LIFE kaydı')).toHaveLength(1);
    expect(new Set(projectedReceiptHashes).size).toBe(projectedReceiptHashes.length);
    closeStore(restarted);

    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      expect(Number(database.prepare(
        "SELECT COUNT(*) AS count FROM life_records WHERE title='Restart sonrası tek LIFE kaydı'"
      ).get()!.count)).toBe(1);
      expect(Number(database.prepare(`
        SELECT COUNT(*) AS count FROM platform_policy_journal_projection_outbox
        WHERE status='pending'
      `).get()!.count)).toBe(0);
      expect(Number(database.prepare(`
        SELECT COUNT(*) AS count FROM (
          SELECT receipt_hash FROM platform_policy_journal_projection_outbox
          GROUP BY receipt_hash HAVING COUNT(*)>1
        )
      `).get()!.count)).toBe(0);
    } finally {
      database.close();
    }
  });

  it('rolls back LIFE data, receipt, audit and outbox atomically', async () => {
    const { directory, store } = makeProductionStore();
    const owner = (await store.getSnapshot()).people[0]!;
    const databasePath = join(directory, 'family.db');
    const faultInjector = new DatabaseSync(databasePath);
    try {
      faultInjector.exec(`
        CREATE TRIGGER test_30y_life_outbox_failure
        BEFORE INSERT ON event_outbox
        WHEN NEW.event_type='life.record.created'
        BEGIN
          SELECT RAISE(ABORT,'controlled LIFE outbox failure');
        END;
      `);
    } finally {
      faultInjector.close();
    }

    await expect(store.createLifeRecord({
      ownerPersonId: owner.id,
      category: 'task',
      title: '30-Y atomik geri alma kaydı',
      status: 'planned',
      privacy: 'private'
    })).rejects.toThrow(/SQLite|beklenmeyen/i);
    closeStore(store);

    const probe = new DatabaseSync(databasePath, { readOnly: true });
    try {
      expect(Number(probe.prepare(
        "SELECT COUNT(*) AS count FROM life_records WHERE title='30-Y atomik geri alma kaydı'"
      ).get()!.count)).toBe(0);
      expect(Number(probe.prepare(
        "SELECT COUNT(*) AS count FROM audit_log WHERE action='life_record.created'"
      ).get()!.count)).toBe(0);
      expect(Number(probe.prepare(
        "SELECT COUNT(*) AS count FROM event_outbox WHERE event_type='life.record.created'"
      ).get()!.count)).toBe(0);
      expect(Number(probe.prepare(`
        SELECT COUNT(*) AS count FROM platform_policy_transaction_receipts
        WHERE resource_type='life_record' AND action='create'
      `).get()!.count)).toBe(0);
    } finally {
      probe.close();
    }
  });
});
