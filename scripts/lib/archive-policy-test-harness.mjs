import { createHash, createHmac, randomBytes } from 'node:crypto';
import { PlatformPolicyKernel } from '@ppt/platform-policy';
import {
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '@ppt/repositories';

const POLICY_VERSION = '30-q-archive-policy-test-v1';
const kernel = new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('30-n-archive-policy-test-signing-key-v1', 'utf8'),
  applicationCapabilities: {
    'windows-desktop': ['archive.read', 'archive.write', 'family.read', 'family.write', 'location.read']
  },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

const authorizationProvider = Object.freeze({
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

const canonicalize = (value) => {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('TEST_POLICY_RECEIPT_NON_FINITE_NUMBER');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    if (keys.some((key) => value[key] === undefined)) {
      throw new Error('TEST_POLICY_RECEIPT_UNDEFINED_VALUE');
    }
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  throw new Error('TEST_POLICY_RECEIPT_UNSUPPORTED_VALUE');
};

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const proofPayload = (proof) => ({
  schemaVersion: proof.schemaVersion,
  receiptHash: proof.receiptHash,
  recordHash: proof.recordHash,
  receiptNonce: proof.receiptNonce,
  entrySequence: proof.entrySequence,
  entryHash: proof.entryHash,
  headSequence: proof.headSequence,
  headHash: proof.headHash,
  journalSizeBytes: proof.journalSizeBytes,
  issuedAt: proof.issuedAt
});

const createReceiptJournalSink = (receiptRecords) => {
  const proofKey = randomBytes(32);
  const entries = [];
  const appendExact = (record) => {
    const recordHash = computePlatformPolicyReceiptRecordHash(record);
    const existing = entries.find((entry) => entry.record.receipt.nonce === record.receipt.nonce);
    if (existing) {
      if (existing.recordHash !== recordHash) throw new Error('TEST_POLICY_RECEIPT_NONCE_COLLISION');
      return existing;
    }
    const previousHash = entries.at(-1)?.entryHash ?? '0'.repeat(64);
    const entryHash = sha256(canonicalize({
      sequence: entries.length + 1,
      previousHash,
      recordHash
    }));
    const entry = Object.freeze({
      sequence: entries.length + 1,
      previousHash,
      recordHash,
      entryHash,
      record
    });
    entries.push(entry);
    receiptRecords.push(record);
    return entry;
  };
  return Object.freeze({
    append: (record) => { appendExact(record); },
    ensure: (record) => {
      const entry = appendExact(record);
      const head = entries.at(-1);
      const payload = Object.freeze({
        schemaVersion: 1,
        receiptHash: computePlatformPolicyReceiptHash(record.receipt),
        recordHash: entry.recordHash,
        receiptNonce: record.receipt.nonce,
        entrySequence: entry.sequence,
        entryHash: entry.entryHash,
        headSequence: head.sequence,
        headHash: head.entryHash,
        journalSizeBytes: Buffer.byteLength(entries.map((item) => canonicalize(item.record)).join('\n') + '\n'),
        issuedAt: record.recordedAt
      });
      return Object.freeze({
        ...payload,
        proofMac: createHmac('sha256', proofKey).update(canonicalize(payload)).digest('hex')
      });
    },
    verifyProjectionProof: (proof) => {
      if (!proof || typeof proof !== 'object') return false;
      const expectedMac = createHmac('sha256', proofKey).update(canonicalize(proofPayload(proof))).digest('hex');
      const entry = entries[proof.entrySequence - 1];
      const head = entries[proof.headSequence - 1];
      return proof.proofMac === expectedMac
        && entry?.entryHash === proof.entryHash
        && entry?.recordHash === proof.recordHash
        && entry?.record.receipt.nonce === proof.receiptNonce
        && computePlatformPolicyReceiptHash(entry.record.receipt) === proof.receiptHash
        && head?.entryHash === proof.headHash;
    }
  });
};

export const createArchivePolicyTestOptions = (receiptRecords = []) => ({
  archivePolicyAuthorizationProvider: authorizationProvider,
  archivePolicyReceiptSink: createReceiptJournalSink(receiptRecords),
  archivePolicyVersion: POLICY_VERSION,
  archiveClusterFence: () => ({ writable: true, epoch: 30 })
});

const FINANCE_POLICY_VERSION = '30-z-finance-authorization-verifier-policy-v1';
const financeKernel = new PlatformPolicyKernel({
  policyVersion: FINANCE_POLICY_VERSION,
  signingKey: Buffer.from('30-z-finance-authorization-verifier-signing-key-v1', 'utf8'),
  applicationCapabilities: {
    'windows-desktop': ['finance.read', 'finance.write']
  },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});
const financeAuthorizationProvider = Object.freeze({
  resolvePolicyPackage: () => financeKernel.policyPackage,
  authorize({ request, nonce }) {
    return Object.freeze({
      effectiveRequest: request,
      authorization: financeKernel.authorizeWithReceipt(request, request.occurredAt, nonce)
    });
  },
  verify({ request, receipt }) {
    return financeKernel.verifyReceiptForRequest(receipt, request);
  }
});

export const createFinancePolicyTestOptions = (receiptRecords = []) => ({
  archivePolicyAuthorizationProvider: financeAuthorizationProvider,
  archivePolicyReceiptSink: createReceiptJournalSink(receiptRecords),
  archivePolicyVersion: FINANCE_POLICY_VERSION,
  archiveClusterFence: () => ({ writable: true, epoch: 30 })
});
