import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import {
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '@ppt/repositories';
import { FamilyDataStore } from '../src/main/data-store.js';

const temporaryDirectories: string[] = [];
const POLICY_VERSION = '30-u-data-store-pending-operation-v1';
const kernel = new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('30-u-data-store-pending-operation-key', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['archive.read', 'archive.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});
const authorizationProvider: PlatformPolicyAuthorizationProvider = Object.freeze({
  authorize: ({ request, nonce }) => Object.freeze({
    effectiveRequest: request,
    authorization: kernel.authorizeWithReceipt(request, request.occurredAt, nonce)
  }),
  verify: ({ request, receipt }) => kernel.verifyReceiptForRequest(receipt, request)
});
let proofSequence = 0;
const projectionProof = (record: PlatformPolicyReceiptRecord): PlatformPolicyJournalProjectionProof => {
  proofSequence += 1;
  return Object.freeze({
    schemaVersion: 1,
    receiptHash: computePlatformPolicyReceiptHash(record.receipt),
    recordHash: computePlatformPolicyReceiptRecordHash(record),
    receiptNonce: record.receipt.nonce,
    entrySequence: proofSequence,
    entryHash: 'd'.repeat(64),
    headSequence: proofSequence,
    headHash: 'd'.repeat(64),
    journalSizeBytes: proofSequence * 512,
    issuedAt: record.recordedAt,
    proofMac: 'e'.repeat(64)
  });
};
const storeOptions = {
  seed: false,
  archivePolicyAuthorizationProvider: authorizationProvider,
  archivePolicyReceiptSink: {
    append: () => undefined,
    ensure: projectionProof,
    verifyProjectionProof: () => true
  },
  archivePolicyVersion: POLICY_VERSION,
  archiveClusterFence: () => ({ writable: true, epoch: 31 })
} as const;

afterEach(() => {
  proofSequence = 0;
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('30-U FamilyDataStore pending operation identity handoff', () => {
  it('recovers an unknown category result after application restart and acknowledges it explicitly', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppt-30u-data-store-restart-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'family.db');
    const firstStore = new FamilyDataStore({ databasePath, ...storeOptions });
    firstStore.setupAdmin({
      familyName: '30-U Test Ailesi',
      displayName: '30-U Yöneticisi',
      password: 'Guclu30UTestParolasi!2026'
    });
    const accountId = firstStore.listAccounts()[0]!.id;
    const semanticInput = { name: 'Restart Belgeleri', description: 'Kalıcı işlem kimliği testi' };
    const firstIdentity = firstStore.acquireArchivePendingOperationIdentity({
      mutation: 'archive:createCategory',
      semanticInput
    });
    expect(firstIdentity).toMatchObject({ recovered: false, state: 'pending' });
    expect(firstStore.requireArchivePendingOperationIdentity({
      operationId: firstIdentity.operationId,
      mutation: 'archive:createCategory',
      semanticInput
    })).toMatchObject({ operationId: firstIdentity.operationId, state: 'pending' });
    const firstResult = await firstStore.createArchiveCategory({
      ...semanticInput,
      operationId: firstIdentity.operationId
    });
    expect(firstResult.filter((item) => item.name === semanticInput.name)).toHaveLength(1);

    // Simulate an application shutdown after COMMIT but before renderer acknowledgement.
    firstStore.close();
    const restartedStore = new FamilyDataStore({ databasePath, ...storeOptions });
    restartedStore.login({
      accountId,
      password: 'Guclu30UTestParolasi!2026'
    });
    const recoveredIdentity = restartedStore.acquireArchivePendingOperationIdentity({
      mutation: 'archive:createCategory',
      semanticInput
    });
    expect(recoveredIdentity).toMatchObject({
      operationId: firstIdentity.operationId,
      intentFingerprint: firstIdentity.intentFingerprint,
      recovered: true,
      state: 'pending'
    });
    const replayedResult = await restartedStore.createArchiveCategory({
      ...semanticInput,
      operationId: recoveredIdentity.operationId
    });
    expect(replayedResult.filter((item) => item.name === semanticInput.name)).toHaveLength(1);
    const acknowledged = restartedStore.acknowledgeArchivePendingOperationIdentity({
      operationId: recoveredIdentity.operationId,
      mutation: 'archive:createCategory',
      semanticInput
    });
    expect(acknowledged).toMatchObject({
      operationId: firstIdentity.operationId,
      state: 'acknowledged'
    });
    expect(() => restartedStore.requireArchivePendingOperationIdentity({
      operationId: recoveredIdentity.operationId,
      mutation: 'archive:createCategory',
      semanticInput
    })).toThrow(/kalıcı işlem kimliği/u);
    const intentionalNext = restartedStore.acquireArchivePendingOperationIdentity({
      mutation: 'archive:createCategory',
      semanticInput
    });
    expect(intentionalNext.operationId).not.toBe(firstIdentity.operationId);
    expect(intentionalNext.recovered).toBe(false);
    restartedStore.close();

    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      expect(Number(database.prepare(
        'SELECT COUNT(*) AS count FROM archive_categories WHERE name=?'
      ).get(semanticInput.name)?.count)).toBe(1);
      expect(Number(database.prepare(
        'SELECT COUNT(*) AS count FROM platform_policy_archive_operations WHERE operation_id=?'
      ).get(firstIdentity.operationId)?.count)).toBe(1);
      expect(Number(database.prepare(
        'SELECT COUNT(*) AS count FROM platform_policy_archive_operation_retries WHERE operation_id=?'
      ).get(firstIdentity.operationId)?.count)).toBe(1);
      expect(database.prepare(`
        SELECT acknowledgement_kind FROM platform_policy_archive_pending_operations WHERE operation_id=?
      `).get(firstIdentity.operationId)?.acknowledgement_kind).toBe('completed');
    } finally {
      database.close();
    }
  });
});
