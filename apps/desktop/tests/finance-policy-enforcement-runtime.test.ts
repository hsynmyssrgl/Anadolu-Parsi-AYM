import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  asCorrelationId,
  asIsoDateTime,
  asUserId
} from '@ppt/core';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import type { PolicyAuthorizedRepositoryExecutionContext } from '@ppt/repository-contracts';
import {
  SqliteFinanceRepository,
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '@ppt/repositories';
import { FamilyDataStore } from '../src/main/data-store.js';

const POLICY_VERSION = '30-w-finance-policy-test-v1';
const temporaryDirectories: string[] = [];
const openStores: FamilyDataStore[] = [];

const kernel = new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('30-w-finance-policy-controlled-signing-key-v1', 'utf8'),
  applicationCapabilities: {
    'windows-desktop': ['family.read', 'finance.read', 'finance.write', 'location.read', 'archive.write']
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
  entryHash: '7'.repeat(64),
  headSequence: 1,
  headHash: '7'.repeat(64),
  journalSizeBytes: 512,
  issuedAt: record.recordedAt,
  proofMac: '8'.repeat(64)
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

const makeProductionStore = () => {
  const directory = makeDirectory('ppt-30w-finance-policy-');
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
    archiveClusterFence: () => ({ writable: true, epoch: 30 })
  }));
  store.setupAdmin({
    familyName: '30-W Finans Ailesi',
    displayName: '30-W Finans Yöneticisi',
    email: 'finance-30w@example.com',
    password: 'Finans30WGucluParola!'
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

describe('30-W governed finance policy enforcement', () => {
  it('fails closed when no finance PEP is composed', async () => {
    const directory = makeDirectory('ppt-30w-finance-fail-closed-');
    const store = trackStore(new FamilyDataStore({
      databasePath: join(directory, 'family.db'),
      seed: false
    }));
    store.setupAdmin({
      familyName: 'Kapalı Finans Ailesi',
      displayName: 'Kapalı Finans Yöneticisi',
      password: 'KapaliFinans30GucluParola!'
    });

    await expect(store.listFinanceRecords()).rejects.toThrow(/Finance policy enforcement is not composed/u);
    closeStore(store);
  });

  it('rejects an authorization that expires before the repository callback', async () => {
    const directory = makeDirectory('ppt-30w-finance-expiry-');
    const expiryKernel = new PlatformPolicyKernel({
      policyVersion: '30-w-expiry-policy-v1',
      signingKey: Buffer.from('30-w-expiry-controlled-signing-key-v1', 'utf8'),
      applicationCapabilities: { 'windows-desktop': ['finance.read'] },
      consentRequiredCapabilities: [],
      onlineOnlyCapabilities: [],
      writeActions: ['create', 'update', 'delete']
    });
    const store = trackStore(new FamilyDataStore({
      databasePath: join(directory, 'family.db'),
      seed: false,
      archiveClusterFence: () => ({ writable: true, epoch: 30 }),
      financePolicyEnforcementPointResolver: {
        resolve(context) {
          const baseMs = Date.now();
          let clockReads = 0;
          const policyClock = (): string => {
            clockReads += 1;
            return new Date(baseMs + (clockReads >= 4 ? 2_000 : 0)).toISOString();
          };
          return new PlatformPolicyEnforcementPoint({
            kernel: expiryKernel,
            authorityResolver: {
              resolve: () => ({
                policyVersion: '30-w-expiry-policy-v1',
                accountId: context.actor.userId,
                ...(context.actor.personId ? { personId: context.actor.personId } : {}),
                deviceId: 'device-30w-expiry',
                applicationId: 'windows-desktop',
                deviceTrusted: true,
                membershipActive: true,
                roles: [context.actor.role],
                familyIds: [context.familyId],
                online: true,
                expiresAt: new Date(baseMs + 60_000).toISOString()
              })
            },
            resourceResolver: {
              resolve: () => ({
                type: 'finance_record',
                id: '*',
                familyId: context.familyId,
                ...(context.actor.personId ? { ownerPersonId: context.actor.personId } : {}),
                sensitivity: 'personal'
              })
            },
            receiptSink: { append: () => undefined },
            receiptTtlMs: 1_000,
            clock: policyClock
          });
        }
      }
    }));
    store.setupAdmin({
      familyName: 'Süre Aşımı Finans Ailesi',
      displayName: 'Süre Aşımı Finans Yöneticisi',
      password: 'SureAsimiFinans30Parola!'
    });

    await expect(store.listFinanceRecords()).rejects.toThrow(/expired before transaction execution/u);
    closeStore(store);
  });

  it('rejects a forged repository context before any finance SQL executes', () => {
    const forged = {
      transaction: Object.freeze({}),
      actor: { userId: asUserId('forged-account'), roles: ['family_admin'] },
      correlationId: asCorrelationId('forged-finance-context'),
      occurredAt: asIsoDateTime('2026-08-07T20:00:00.000Z'),
      policyAuthorization: Object.freeze({})
    } as unknown as PolicyAuthorizedRepositoryExecutionContext;

    expect(() => new SqliteFinanceRepository().listRecords(forged)).toThrow(/transaction context.*forged/i);
  });

  it('persists exact receipts and rejects missing, stale, copied and deletion writes', async () => {
    const { directory, store } = makeProductionStore();
    const owner = (await store.getSnapshot()).people[0]!;
    const records = await store.createFinanceRecord({
      ownerPersonId: owner.id,
      title: '30-W korumalı yatırım',
      kind: 'asset',
      amount: 250_000,
      currency: 'TRY',
      privacy: 'private',
      occurredAt: '2026-08-07T12:00:00.000Z'
    });
    const record = records.find((row) => row.title === '30-W korumalı yatırım')!;
    const valuations = await store.createFinanceValuation({
      financeRecordId: record.id,
      valueDate: '2026-08-07T13:00:00.000Z',
      unitPrice: 5_000,
      quantity: 50,
      provider: '30-W kontrollü test'
    });
    const valuation = valuations.find((row) => row.financeRecordId === record.id)!;
    closeStore(store);

    const database = new DatabaseSync(join(directory, 'family.db'));
    try {
      const persistedRecord = database.prepare(`
        SELECT policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        FROM finance_records WHERE id=?
      `).get(record.id) as Record<string, unknown>;
      expect(persistedRecord).toMatchObject({
        policy_receipt_version: 1,
        policy_resource_type: 'finance_record',
        policy_resource_id: record.id,
        policy_action: 'create',
        policy_capability: 'finance.write'
      });
      expect(String(persistedRecord.policy_receipt_hash)).toMatch(/^[0-9a-f]{64}$/u);
      expect(String(persistedRecord.policy_receipt_nonce).length).toBeGreaterThan(0);
      expect(String(persistedRecord.policy_correlation_id).length).toBeGreaterThan(0);

      const persistedValuation = database.prepare(`
        SELECT policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        FROM finance_valuations WHERE id=?
      `).get(valuation.id) as Record<string, unknown>;
      expect(persistedValuation).toMatchObject({
        policy_receipt_version: 1,
        policy_resource_type: 'finance_record',
        policy_resource_id: record.id,
        policy_action: 'update',
        policy_capability: 'finance.write'
      });
      expect(String(persistedValuation.policy_receipt_hash)).toMatch(/^[0-9a-f]{64}$/u);

      const projected = Number(database.prepare(`
        SELECT COUNT(*) AS count
        FROM platform_policy_journal_projection_outbox
        WHERE receipt_hash IN (?,?) AND status='projected'
      `).get(
        persistedRecord.policy_receipt_hash,
        persistedValuation.policy_receipt_hash
      )!.count);
      expect(projected).toBe(2);

      expect(() => database.prepare(`
        INSERT INTO finance_records(
          id,family_id,owner_person_id,title,kind,amount,currency,privacy,occurred_at,created_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?)
      `).run(
        'finance-direct-no-receipt',
        'family-main',
        owner.id,
        'Doğrudan yazma',
        'asset',
        1,
        'TRY',
        'private',
        '2026-08-07T14:00:00.000Z',
        '2026-08-07T14:00:00.000Z'
      )).toThrow(/exact durable policy receipt/u);

      expect(() => database.prepare(`
        INSERT INTO finance_records(
          id,family_id,owner_person_id,title,kind,amount,currency,privacy,notes,
          occurred_at,due_at,remaining_principal,symbol,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        )
        SELECT ?,family_id,owner_person_id,title,kind,amount,currency,privacy,notes,
          occurred_at,due_at,remaining_principal,symbol,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        FROM finance_records WHERE id=?
      `).run('finance-copied-receipt', record.id)).toThrow(/exact durable policy receipt/u);

      expect(() => database.prepare(
        'UPDATE finance_records SET title=? WHERE id=?'
      ).run('Bayat receipt güncellemesi', record.id)).toThrow(/fresh exact durable policy receipt/u);
      expect(() => database.prepare(
        'DELETE FROM finance_valuations WHERE id=?'
      ).run(valuation.id)).toThrow(/governed deletion workflow/u);
      expect(() => database.prepare(
        'DELETE FROM finance_records WHERE id=?'
      ).run(record.id)).toThrow(/governed deletion workflow/u);
    } finally {
      database.close();
    }
  });
});
