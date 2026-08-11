import { DatabaseSync } from 'node:sqlite';
import { PlatformPolicyKernel } from '@ppt/platform-policy';
import {
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '@ppt/repositories';
import { FamilyDataStore } from '../apps/desktop/dist/main/data-store.js';

const [stage, databasePath] = process.argv.slice(2);
if (!['prepare', 'recover'].includes(stage) || !databasePath) {
  throw new Error('Usage: 30-u-pending-operation-process-worker.mjs <prepare|recover> <database-path>');
}

const PASSWORD = 'Guclu30UProcessParolasi!2026';
const POLICY_VERSION = '30-u-process-restart-policy-v1';
const semanticInput = Object.freeze({
  name: 'Process Restart Documents',
  description: '30-U controlled process restart proof'
});
const kernel = new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('30-u-controlled-process-policy-signing-key', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['archive.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});
const authorizationProvider = Object.freeze({
  authorize: ({ request, nonce }) => Object.freeze({
    effectiveRequest: request,
    authorization: kernel.authorizeWithReceipt(request, request.occurredAt, nonce)
  }),
  verify: ({ request, receipt }) => kernel.verifyReceiptForRequest(receipt, request)
});
let proofSequence = stage === 'prepare' ? 100 : 200;
const options = {
  databasePath,
  seed: false,
  skipFileMigrationSafetyBackup: true,
  archivePolicyAuthorizationProvider: authorizationProvider,
  archivePolicyReceiptSink: {
    append: () => undefined,
    ensure: (record) => {
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
    },
    verifyProjectionProof: () => true
  },
  archivePolicyVersion: POLICY_VERSION,
  archiveClusterFence: () => ({ writable: true, epoch: 31 })
};

if (stage === 'prepare') {
  const store = new FamilyDataStore(options);
  try {
    store.setupAdmin({
      familyName: '30-U Process Test Family',
      displayName: '30-U Process Administrator',
      password: PASSWORD
    });
    const identity = store.acquireArchivePendingOperationIdentity({
      mutation: 'archive:createCategory',
      semanticInput
    });
    const result = await store.createArchiveCategory({ ...semanticInput, operationId: identity.operationId });
    console.log(JSON.stringify({
      stage,
      operationId: identity.operationId,
      intentFingerprint: identity.intentFingerprint,
      recovered: identity.recovered,
      categoryCount: result.filter((item) => item.name === semanticInput.name).length,
      acknowledged: false
    }));
  } finally {
    store.close();
  }
} else if (stage === 'recover') {
  const store = new FamilyDataStore(options);
  let result;
  try {
    const profile = store.getAuthState().profiles?.[0];
    if (!profile) throw new Error('Restarted local profile was not found');
    store.login({ accountId: profile.id, password: PASSWORD });
    const identity = store.acquireArchivePendingOperationIdentity({
      mutation: 'archive:createCategory',
      semanticInput
    });
    const replay = await store.createArchiveCategory({ ...semanticInput, operationId: identity.operationId });
    const acknowledged = store.acknowledgeArchivePendingOperationIdentity({
      operationId: identity.operationId,
      mutation: 'archive:createCategory',
      semanticInput
    });
    const nextIdentity = store.acquireArchivePendingOperationIdentity({
      mutation: 'archive:createCategory',
      semanticInput
    });
    result = {
      stage,
      operationId: identity.operationId,
      intentFingerprint: identity.intentFingerprint,
      recovered: identity.recovered,
      categoryCount: replay.filter((item) => item.name === semanticInput.name).length,
      acknowledged: acknowledged.state === 'acknowledged',
      nextOperationId: nextIdentity.operationId
    };
  } finally {
    store.close();
  }
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const operationId = result.operationId;
    result = {
      ...result,
      databaseCategoryCount: Number(database.prepare(
        'SELECT COUNT(*) AS count FROM archive_categories WHERE name=?'
      ).get(semanticInput.name)?.count),
      operationCount: Number(database.prepare(
        'SELECT COUNT(*) AS count FROM platform_policy_archive_operations WHERE operation_id=?'
      ).get(operationId)?.count),
      retryCount: Number(database.prepare(
        'SELECT COUNT(*) AS count FROM platform_policy_archive_operation_retries WHERE operation_id=?'
      ).get(operationId)?.count),
      acknowledgementKind: database.prepare(`
        SELECT acknowledgement_kind FROM platform_policy_archive_pending_operations WHERE operation_id=?
      `).get(operationId)?.acknowledgement_kind
    };
  } finally {
    database.close();
  }
  console.log(JSON.stringify(result));
}
