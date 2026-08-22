import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  ftruncateSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { dirname, isAbsolute } from 'node:path';
import {
  ImmutablePolicyDecisionAuditPolicy,
  type ImmutablePolicyDecisionAuditRecord,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord,
  type PlatformPolicyReceiptSink
} from '@ppt/platform-policy';
import type { DeviceSecretProtector } from './device-secret-protector.js';
import type {
  PolicyJournalCheckpointContractPayload,
  PolicyJournalCheckpointContractResult
} from '@ppt/core-service-contracts';
import type { ProtectedSideArtifactEnvelope } from './protected-side-artifact-store.js';
import { ProtectedSideArtifactStore } from './protected-side-artifact-store.js';

const JOURNAL_SCHEMA_VERSION = 2 as const;
const PROTECTED_DECISION_AUDIT_ENVELOPE_SCHEMA_VERSION = 1 as const;
const PROTECTED_DECISION_AUDIT_ENVELOPE_KIND = 'immutable-policy-decision-audit' as const;
const MAC_KEY_SCHEMA_VERSION = 1 as const;
const GENESIS_HASH = '0'.repeat(64);
const RECEIPT_ARTIFACT_KIND = 'platform-policy-receipt';
const DEFAULT_MAX_JOURNAL_BYTES = 256 * 1024 * 1024;
const MAX_RECORD_BYTES = 2 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const JOURNAL_LOCK_RETRY_MS = 25;
const JOURNAL_LOCK_TIMEOUT_MS = 10_000;
const PROJECTION_PROOF_MAC_DOMAIN = 'ppt.platform-policy.journal-projection-proof.v1\0';

interface PlatformPolicyReceiptJournalEntryPayload {
  readonly schemaVersion: 2;
  readonly sequence: number;
  readonly previousHash: string;
  readonly protectedRecordHash: string;
  readonly protectedRecord: ProtectedSideArtifactEnvelope;
}

interface PlatformPolicyReceiptJournalEntry extends PlatformPolicyReceiptJournalEntryPayload {
  readonly entryHash: string;
}

interface VerifiedPlatformPolicyReceiptJournalEntry extends PlatformPolicyReceiptJournalEntry {
  readonly record: PlatformPolicyReceiptRecord;
  readonly auditRecord?: ImmutablePolicyDecisionAuditRecord;
}

interface ProtectedPolicyDecisionAuditEnvelope {
  readonly schemaVersion: 1;
  readonly kind: 'immutable-policy-decision-audit';
  readonly auditRecord: ImmutablePolicyDecisionAuditRecord;
  readonly receiptRecord: PlatformPolicyReceiptRecord;
}

type PlatformPolicyJournalProjectionProofPayload = Omit<PlatformPolicyJournalProjectionProof, 'proofMac'>;

export interface PlatformPolicyReceiptFileSinkOptions {
  readonly filePath: string;
  readonly macKeyPath: string;
  readonly macKeyProtector: DeviceSecretProtector;
  readonly protectedArtifactStore: ProtectedSideArtifactStore;
  readonly maxJournalBytes?: number;
  readonly monotonicAuthority: {
    checkpointPolicyJournal(
      input: PolicyJournalCheckpointContractPayload
    ): Promise<PolicyJournalCheckpointContractResult>;
  };
}

interface PlatformPolicyReceiptJournalMacKeyEnvelope {
  readonly schemaVersion: 1;
  readonly protectionId: string;
  readonly protectedMacKey: string;
  readonly createdAt: string;
}

export interface PlatformPolicyReceiptJournalInspection {
  readonly filePath: string;
  readonly exists: boolean;
  readonly valid: boolean;
  readonly protection: 'AES_256_GCM_AND_HMAC_SHA256_DEVICE_PROTECTED_KEYS';
  readonly entryCount: number;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly headHash: string;
  readonly auditedEntryCount: number;
  readonly legacyReceiptEntryCount: number;
  readonly latestReceiptNonce?: string;
  readonly latestAuditHash?: string;
}

export interface PlatformPolicyDecisionAuditJournalInspection {
  readonly valid: boolean;
  readonly entryCount: number;
  readonly auditedEntryCount: number;
  readonly legacyReceiptEntryCount: number;
  readonly headHash: string;
  readonly latestAuditHash?: string;
}

const decisionAuditPolicy = new ImmutablePolicyDecisionAuditPolicy();

const canonicalize = (value: unknown): string => {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('POLICY_RECEIPT_JOURNAL_NON_FINITE_NUMBER');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (keys.some((key) => record[key] === undefined)) {
      throw new Error('POLICY_RECEIPT_JOURNAL_UNDEFINED_VALUE');
    }
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
  }
  throw new Error('POLICY_RECEIPT_JOURNAL_UNSUPPORTED_VALUE');
};

const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const hmacSha256 = (key: Buffer, value: string): string => createHmac('sha256', key).update(value).digest('hex');
const equalHex = (left: string, right: string): boolean => {
  if (!SHA256_PATTERN.test(left) || !SHA256_PATTERN.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
};
const fileErrorCode = (error: unknown): string =>
  error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
const processIsAlive = (processId: number): boolean => {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return fileErrorCode(error) === 'EPERM';
  }
};
const waitForLockRetry = (): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, JOURNAL_LOCK_RETRY_MS);
});
const entryPayload = (entry: PlatformPolicyReceiptJournalEntry): PlatformPolicyReceiptJournalEntryPayload => ({
  schemaVersion: entry.schemaVersion,
  sequence: entry.sequence,
  previousHash: entry.previousHash,
  protectedRecordHash: entry.protectedRecordHash,
  protectedRecord: entry.protectedRecord
});
const entryHash = (payload: PlatformPolicyReceiptJournalEntryPayload, macKey: Buffer): string =>
  hmacSha256(macKey, canonicalize(payload));
const projectionProofPayload = (
  proof: PlatformPolicyJournalProjectionProof
): PlatformPolicyJournalProjectionProofPayload => ({
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
const projectionProofMac = (
  macKey: Buffer,
  payload: PlatformPolicyJournalProjectionProofPayload
): string => hmacSha256(macKey, `${PROJECTION_PROOF_MAC_DOMAIN}${canonicalize(payload)}`);

const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
};

const projectionProofKeys = Object.freeze([
  'schemaVersion', 'receiptHash', 'recordHash', 'receiptNonce', 'entrySequence',
  'entryHash', 'headSequence', 'headHash', 'journalSizeBytes', 'issuedAt', 'proofMac'
]);

const journalPrefixSize = (bytes: Buffer, sequence: number): number => {
  let current = 0;
  for (let index = 0; index < bytes.byteLength; index += 1) {
    if (bytes[index] !== 0x0a) continue;
    current += 1;
    if (current === sequence) return index + 1;
  }
  throw new Error('POLICY_RECEIPT_JOURNAL_PROOF_PREFIX_MISSING');
};

const assertReceiptRecordShape = (record: PlatformPolicyReceiptRecord): void => {
  if (
    !record || typeof record !== 'object' ||
    typeof record.correlationId !== 'string' || record.correlationId.length === 0 ||
    typeof record.resourceType !== 'string' || record.resourceType.length === 0 ||
    typeof record.resourceId !== 'string' || record.resourceId.length === 0 ||
    typeof record.action !== 'string' || typeof record.capability !== 'string' ||
    !record.request || typeof record.request !== 'object' ||
    !record.decision || typeof record.decision !== 'object' ||
    !record.receipt || typeof record.receipt !== 'object' ||
    typeof record.recordedAt !== 'string' || !Number.isFinite(Date.parse(record.recordedAt))
  ) throw new Error('POLICY_RECEIPT_JOURNAL_RECORD_INVALID');

  if (
    record.request.correlationId !== record.correlationId ||
    record.request.resource?.type !== record.resourceType ||
    record.request.resource.id !== record.resourceId ||
    record.request.action !== record.action ||
    record.request.capability !== record.capability ||
    record.receipt.issuedAt !== record.recordedAt ||
    canonicalize(record.receipt.decision) !== canonicalize(record.decision) ||
    !SHA256_PATTERN.test(record.receipt.requestHash) ||
    !SHA256_PATTERN.test(record.receipt.signature) ||
    typeof record.receipt.nonce !== 'string' || record.receipt.nonce.length === 0
  ) throw new Error('POLICY_RECEIPT_JOURNAL_RECORD_BINDING_INVALID');
};

const assertProtectedRecordShape: (value: unknown) => asserts value is ProtectedSideArtifactEnvelope = (
  value: unknown
): asserts value is ProtectedSideArtifactEnvelope => {
  const candidate = value as Partial<ProtectedSideArtifactEnvelope> | null;
  if (
    !candidate || typeof candidate !== 'object' ||
    candidate.schemaVersion !== 1 ||
    typeof candidate.product !== 'string' || candidate.product.length === 0 ||
    typeof candidate.applicationVersion !== 'string' || candidate.applicationVersion.length === 0 ||
    candidate.kind !== RECEIPT_ARTIFACT_KIND ||
    typeof candidate.generatedAt !== 'string' || !Number.isFinite(Date.parse(candidate.generatedAt)) ||
    !candidate.encryption || candidate.encryption.algorithm !== 'aes-256-gcm'
  ) throw new Error('POLICY_RECEIPT_JOURNAL_PROTECTED_RECORD_INVALID');
};

const openReceiptRecord = (
  protectedArtifactStore: ProtectedSideArtifactStore,
  envelope: ProtectedSideArtifactEnvelope
): { readonly record: PlatformPolicyReceiptRecord; readonly auditRecord?: ImmutablePolicyDecisionAuditRecord } => {
  const plaintext = protectedArtifactStore.openEnvelope(envelope);
  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
    } catch (error) {
      throw new Error('POLICY_RECEIPT_JOURNAL_PROTECTED_PAYLOAD_INVALID', { cause: error });
    }
    if (
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      && (parsed as Record<string, unknown>).schemaVersion === PROTECTED_DECISION_AUDIT_ENVELOPE_SCHEMA_VERSION
      && (parsed as Record<string, unknown>).kind === PROTECTED_DECISION_AUDIT_ENVELOPE_KIND
    ) {
      const candidate = parsed as Partial<ProtectedPolicyDecisionAuditEnvelope> & Record<string, unknown>;
      if (!exactKeys(candidate, ['schemaVersion', 'kind', 'auditRecord', 'receiptRecord'])) {
        throw new Error('POLICY_DECISION_AUDIT_ENVELOPE_INVALID');
      }
      assertReceiptRecordShape(candidate.receiptRecord as PlatformPolicyReceiptRecord);
      const receiptRecord = candidate.receiptRecord as PlatformPolicyReceiptRecord;
      const auditRecord = candidate.auditRecord as ImmutablePolicyDecisionAuditRecord;
      if (!decisionAuditPolicy.verify(receiptRecord, auditRecord)) {
        throw new Error('POLICY_DECISION_AUDIT_BINDING_INVALID');
      }
      return Object.freeze({ record: receiptRecord, auditRecord });
    }
    assertReceiptRecordShape(parsed as PlatformPolicyReceiptRecord);
    return Object.freeze({ record: parsed as PlatformPolicyReceiptRecord });
  } finally {
    plaintext.fill(0);
  }
};

const parseJournal = (
  bytes: Buffer,
  protectedArtifactStore: ProtectedSideArtifactStore,
  macKey: Buffer
): readonly VerifiedPlatformPolicyReceiptJournalEntry[] => {
  if (bytes.byteLength === 0) return Object.freeze([]);
  if (bytes.at(-1) !== 0x0a) throw new Error('POLICY_RECEIPT_JOURNAL_TRUNCATED');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw new Error('POLICY_RECEIPT_JOURNAL_UTF8_INVALID', { cause: error });
  }
  const lines = text.slice(0, -1).split('\n');
  if (lines.some((line) => line.length === 0 || line.endsWith('\r'))) {
    throw new Error('POLICY_RECEIPT_JOURNAL_LINE_INVALID');
  }
  const entries: VerifiedPlatformPolicyReceiptJournalEntry[] = [];
  const receiptNonces = new Set<string>();
  let expectedPreviousHash = GENESIS_HASH;
  for (const [index, line] of lines.entries()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      throw new Error('POLICY_RECEIPT_JOURNAL_JSON_INVALID', { cause: error });
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('POLICY_RECEIPT_JOURNAL_ENTRY_INVALID');
    }
    const candidate = parsed as Partial<PlatformPolicyReceiptJournalEntry> & Record<string, unknown>;
    if (
      !exactKeys(candidate, ['schemaVersion', 'sequence', 'previousHash', 'protectedRecordHash', 'protectedRecord', 'entryHash']) ||
      candidate.schemaVersion !== JOURNAL_SCHEMA_VERSION ||
      candidate.sequence !== index + 1 ||
      candidate.previousHash !== expectedPreviousHash ||
      typeof candidate.protectedRecordHash !== 'string' || !SHA256_PATTERN.test(candidate.protectedRecordHash) ||
      typeof candidate.entryHash !== 'string' || !SHA256_PATTERN.test(candidate.entryHash)
    ) throw new Error('POLICY_RECEIPT_JOURNAL_ENTRY_INVALID');
    assertProtectedRecordShape(candidate.protectedRecord);

    const entry = candidate as unknown as PlatformPolicyReceiptJournalEntry;
    if (
      sha256(canonicalize(entry.protectedRecord)) !== entry.protectedRecordHash ||
      !equalHex(entryHash(entryPayload(entry), macKey), entry.entryHash)
    ) throw new Error('POLICY_RECEIPT_JOURNAL_HASH_CHAIN_INVALID');
    const opened = openReceiptRecord(protectedArtifactStore, entry.protectedRecord);
    const { record } = opened;
    if (receiptNonces.has(record.receipt.nonce)) {
      throw new Error('POLICY_RECEIPT_JOURNAL_NONCE_REPLAY');
    }
    receiptNonces.add(record.receipt.nonce);
    entries.push(Object.freeze({ ...entry, record, ...(opened.auditRecord ? { auditRecord: opened.auditRecord } : {}) }));
    expectedPreviousHash = entry.entryHash;
  }
  return Object.freeze(entries);
};

const syncDirectory = (path: string): void => {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, 'r');
    fsyncSync(descriptor);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (!(process.platform === 'win32' && ['EINVAL', 'EPERM', 'EBADF'].includes(code))) throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
};

const atomicWriteMacKey = (path: string, bytes: Buffer): void => {
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporaryPath, 'wx', 0o600);
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    try { chmodSync(temporaryPath, 0o600); } catch { /* Windows ACL/DPAPI protection is authoritative. */ }
    renameSync(temporaryPath, path);
    try { chmodSync(path, 0o600); } catch { /* Windows ACL/DPAPI protection is authoritative. */ }
    syncDirectory(directory);
  } catch (error) {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* best effort */ }
    }
    try {
      rmSync(temporaryPath, { force: true });
    } catch { /* best effort */ }
    throw error;
  }
};

const parseMacKeyEnvelope = (bytes: Buffer): PlatformPolicyReceiptJournalMacKeyEnvelope => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    throw new Error('POLICY_RECEIPT_JOURNAL_MAC_KEY_INVALID', { cause: error });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('POLICY_RECEIPT_JOURNAL_MAC_KEY_INVALID');
  }
  const candidate = parsed as Partial<PlatformPolicyReceiptJournalMacKeyEnvelope> & Record<string, unknown>;
  if (
    !exactKeys(candidate, ['schemaVersion', 'protectionId', 'protectedMacKey', 'createdAt']) ||
    candidate.schemaVersion !== MAC_KEY_SCHEMA_VERSION ||
    typeof candidate.protectionId !== 'string' || candidate.protectionId.length === 0 ||
    typeof candidate.protectedMacKey !== 'string' || candidate.protectedMacKey.length === 0 ||
    typeof candidate.createdAt !== 'string' || !Number.isFinite(Date.parse(candidate.createdAt))
  ) throw new Error('POLICY_RECEIPT_JOURNAL_MAC_KEY_INVALID');
  return candidate as PlatformPolicyReceiptJournalMacKeyEnvelope;
};

const loadOrCreateMacKey = (
  journalPath: string,
  macKeyPath: string,
  protector: DeviceSecretProtector
): Buffer => {
  if (!protector || typeof protector.isAvailable !== 'function' || !protector.isAvailable()) {
    throw new Error('POLICY_RECEIPT_JOURNAL_MAC_KEY_PROTECTION_UNAVAILABLE');
  }
  if (existsSync(macKeyPath)) {
    try {
      const envelope = parseMacKeyEnvelope(readFileSync(macKeyPath));
      if (envelope.protectionId !== protector.protectionId) {
        throw new Error('POLICY_RECEIPT_JOURNAL_MAC_KEY_PROTECTION_MISMATCH');
      }
      const key = Buffer.from(protector.unprotect(envelope.protectedMacKey), 'base64url');
      if (key.byteLength !== 32) {
        key.fill(0);
        throw new Error('POLICY_RECEIPT_JOURNAL_MAC_KEY_INVALID');
      }
      return key;
    } catch (error) {
      if (error instanceof Error && error.message === 'POLICY_RECEIPT_JOURNAL_MAC_KEY_PROTECTION_MISMATCH') throw error;
      throw new Error('POLICY_RECEIPT_JOURNAL_MAC_KEY_INVALID', { cause: error });
    }
  }
  if (existsSync(journalPath)) throw new Error('POLICY_RECEIPT_JOURNAL_MAC_KEY_MISSING');

  const key = randomBytes(32);
  try {
    const envelope: PlatformPolicyReceiptJournalMacKeyEnvelope = Object.freeze({
      schemaVersion: MAC_KEY_SCHEMA_VERSION,
      protectionId: protector.protectionId,
      protectedMacKey: protector.protect(key.toString('base64url')),
      createdAt: new Date().toISOString()
    });
    atomicWriteMacKey(macKeyPath, Buffer.from(`${JSON.stringify(envelope, null, 2)}\n`, 'utf8'));
    return key;
  } catch (error) {
    key.fill(0);
    throw new Error('POLICY_RECEIPT_JOURNAL_MAC_KEY_PERSISTENCE_FAILED', { cause: error });
  }
};

/**
 * Single-host append-only receipt journal. Receipt records are AES-256-GCM sealed by
 * the device-protected side-artifact authority. Every append is chained with HMAC-SHA256
 * under a separate device-protected MAC key,
 * file-fsynced and fully decrypted/read back before the policy operation may start.
 *
 * The exclusive side lock deliberately fails closed after an unclean process exit;
 * recovery requires an explicit journal inspection rather than silently discarding
 * a possibly active lock. This is not a multi-process replay or business-commit
 * atomicity claim.
 */
export class PlatformPolicyReceiptFileSink implements PlatformPolicyReceiptSink {
  readonly #filePath: string;
  readonly #lockPath: string;
  readonly #recoveryLockPath: string;
  readonly #macKey: Buffer;
  readonly #protectedArtifactStore: ProtectedSideArtifactStore;
  readonly #maxJournalBytes: number;
  readonly #monotonicAuthority: PlatformPolicyReceiptFileSinkOptions['monotonicAuthority'];
  #checkpointTail: Promise<void> = Promise.resolve();
  #disposed = false;

  public constructor(options: PlatformPolicyReceiptFileSinkOptions) {
    if (!options || typeof options.filePath !== 'string' || !isAbsolute(options.filePath)) {
      throw new Error('POLICY_RECEIPT_JOURNAL_PATH_INVALID');
    }
    if (
      typeof options.macKeyPath !== 'string' || !isAbsolute(options.macKeyPath) ||
      options.macKeyPath === options.filePath || options.macKeyPath === `${options.filePath}.lock`
    ) throw new Error('POLICY_RECEIPT_JOURNAL_MAC_KEY_PATH_INVALID');
    if (!(options.protectedArtifactStore instanceof ProtectedSideArtifactStore)) {
      throw new Error('POLICY_RECEIPT_JOURNAL_PROTECTION_UNAVAILABLE');
    }
    if (!options.monotonicAuthority || typeof options.monotonicAuthority.checkpointPolicyJournal !== 'function') {
      throw new Error('POLICY_RECEIPT_JOURNAL_MONOTONIC_AUTHORITY_UNAVAILABLE');
    }
    const maxJournalBytes = options.maxJournalBytes ?? DEFAULT_MAX_JOURNAL_BYTES;
    if (!Number.isSafeInteger(maxJournalBytes) || maxJournalBytes < MAX_RECORD_BYTES || maxJournalBytes > 2_147_483_647) {
      throw new Error('POLICY_RECEIPT_JOURNAL_SIZE_LIMIT_INVALID');
    }
    this.#filePath = options.filePath;
    this.#lockPath = `${options.filePath}.lock`;
    this.#recoveryLockPath = `${options.filePath}.recovery.lock`;
    this.#macKey = loadOrCreateMacKey(options.filePath, options.macKeyPath, options.macKeyProtector);
    this.#protectedArtifactStore = options.protectedArtifactStore;
    this.#maxJournalBytes = maxJournalBytes;
    this.#monotonicAuthority = options.monotonicAuthority;
  }

  public async append(record: PlatformPolicyReceiptRecord): Promise<void> {
    const proof = this.#persist(record, false);
    await this.#checkpoint(proof.headSequence, proof.headHash, proof.journalSizeBytes);
  }

  /**
   * Idempotently confirms that the exact receipt record is present. A matching
   * nonce with different canonical content remains a replay/tamper failure.
   * This is used only after the canonical SQLite policy transaction commits;
   * the resulting head is then acknowledged by the external Core Service
   * monotonic authority before success is returned.
   */
  public async ensure(record: PlatformPolicyReceiptRecord): Promise<PlatformPolicyJournalProjectionProof> {
    const deadline = Date.now() + JOURNAL_LOCK_TIMEOUT_MS;
    for (;;) {
      try {
        const proof = this.#persist(record, true);
        await this.#checkpoint(proof.headSequence, proof.headHash, proof.journalSizeBytes);
        return proof;
      } catch (error) {
        const lockContention = fileErrorCode(error) === 'EEXIST'
          || (error instanceof Error && error.message === 'POLICY_RECEIPT_JOURNAL_RECOVERY_LOCK_PRESENT');
        if (!lockContention) throw error;
        if (this.#recoverDeadProjectionLock()) continue;
        if (Date.now() >= deadline) {
          throw new Error('POLICY_RECEIPT_JOURNAL_LOCK_TIMEOUT', { cause: error });
        }
        await waitForLockRetry();
      }
    }
  }

  public verifyProjectionProof(proof: PlatformPolicyJournalProjectionProof): boolean {
    try {
      this.#assertActive();
      if (existsSync(this.#lockPath) || existsSync(this.#recoveryLockPath)) return false;
      if (!proof || typeof proof !== 'object' || !exactKeys(
        proof as unknown as Record<string, unknown>,
        projectionProofKeys
      )) return false;
      if (
        proof.schemaVersion !== 1
        || !SHA256_PATTERN.test(proof.receiptHash)
        || !SHA256_PATTERN.test(proof.recordHash)
        || typeof proof.receiptNonce !== 'string'
        || proof.receiptNonce.length < 1
        || proof.receiptNonce.length > 256
        || !Number.isSafeInteger(proof.entrySequence)
        || proof.entrySequence < 1
        || !SHA256_PATTERN.test(proof.entryHash)
        || !Number.isSafeInteger(proof.headSequence)
        || proof.headSequence < proof.entrySequence
        || !SHA256_PATTERN.test(proof.headHash)
        || !Number.isSafeInteger(proof.journalSizeBytes)
        || proof.journalSizeBytes < 1
        || typeof proof.issuedAt !== 'string'
        || !Number.isFinite(Date.parse(proof.issuedAt))
        || !SHA256_PATTERN.test(proof.proofMac)
        || !equalHex(projectionProofMac(this.#macKey, projectionProofPayload(proof)), proof.proofMac)
        || !existsSync(this.#filePath)
      ) return false;
      const bytes = readFileSync(this.#filePath);
      if (bytes.byteLength > this.#maxJournalBytes) return false;
      const entries = parseJournal(bytes, this.#protectedArtifactStore, this.#macKey);
      const entry = entries[proof.entrySequence - 1];
      const head = entries[proof.headSequence - 1];
      return Boolean(
        entry
        && head
        && entry.entryHash === proof.entryHash
        && entry.record.receipt.nonce === proof.receiptNonce
        && sha256(canonicalize(entry.record.receipt)) === proof.receiptHash
        && sha256(canonicalize(entry.record)) === proof.recordHash
        && head.entryHash === proof.headHash
        && journalPrefixSize(bytes, proof.headSequence) === proof.journalSizeBytes
      );
    } catch {
      return false;
    }
  }

  #createProjectionProof(
    entry: VerifiedPlatformPolicyReceiptJournalEntry,
    entries: readonly VerifiedPlatformPolicyReceiptJournalEntry[],
    journalSizeBytes: number
  ): PlatformPolicyJournalProjectionProof {
    const head = entries.at(-1);
    if (!head || entries.length < entry.sequence) {
      throw new Error('POLICY_RECEIPT_JOURNAL_PROOF_HEAD_MISSING');
    }
    const payload: PlatformPolicyJournalProjectionProofPayload = Object.freeze({
      schemaVersion: 1,
      receiptHash: sha256(canonicalize(entry.record.receipt)),
      recordHash: sha256(canonicalize(entry.record)),
      receiptNonce: entry.record.receipt.nonce,
      entrySequence: entry.sequence,
      entryHash: entry.entryHash,
      headSequence: head.sequence,
      headHash: head.entryHash,
      journalSizeBytes,
      issuedAt: new Date().toISOString()
    });
    return Object.freeze({
      ...payload,
      proofMac: projectionProofMac(this.#macKey, payload)
    });
  }

  #persist(
    record: PlatformPolicyReceiptRecord,
    allowExactExisting: boolean
  ): PlatformPolicyJournalProjectionProof {
    this.#assertActive();
    assertReceiptRecordShape(record);
    const canonicalRecord = canonicalize(record);
    if (Buffer.byteLength(canonicalRecord, 'utf8') > MAX_RECORD_BYTES) {
      throw new Error('POLICY_RECEIPT_JOURNAL_RECORD_TOO_LARGE');
    }

    const directory = dirname(this.#filePath);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    let lockDescriptor: number | undefined;
    try {
      if (existsSync(this.#recoveryLockPath)) {
        throw new Error('POLICY_RECEIPT_JOURNAL_RECOVERY_LOCK_PRESENT');
      }
      lockDescriptor = openSync(this.#lockPath, 'wx', 0o600);
      writeFileSync(lockDescriptor, `${process.pid}:${randomBytes(16).toString('hex')}\n`, 'utf8');
      fsyncSync(lockDescriptor);

      const before = existsSync(this.#filePath) ? readFileSync(this.#filePath) : Buffer.alloc(0);
      if (before.byteLength > this.#maxJournalBytes) throw new Error('POLICY_RECEIPT_JOURNAL_SIZE_LIMIT_EXCEEDED');
      const entries = parseJournal(before, this.#protectedArtifactStore, this.#macKey);
      const existing = entries.find((entry) => entry.record.receipt.nonce === record.receipt.nonce);
      if (existing) {
        if (allowExactExisting && canonicalize(existing.record) === canonicalRecord) {
          return this.#createProjectionProof(existing, entries, before.byteLength);
        }
        throw new Error('POLICY_RECEIPT_JOURNAL_NONCE_REPLAY');
      }

      const auditRecord = decisionAuditPolicy.create(record);
      const protectedPayload: ProtectedPolicyDecisionAuditEnvelope = Object.freeze({
        schemaVersion: PROTECTED_DECISION_AUDIT_ENVELOPE_SCHEMA_VERSION,
        kind: PROTECTED_DECISION_AUDIT_ENVELOPE_KIND,
        auditRecord,
        receiptRecord: record
      });
      const canonicalProtectedPayload = canonicalize(protectedPayload);
      if (Buffer.byteLength(canonicalProtectedPayload, 'utf8') > MAX_RECORD_BYTES) {
        throw new Error('POLICY_RECEIPT_JOURNAL_RECORD_TOO_LARGE');
      }
      const recordBytes = Buffer.from(canonicalProtectedPayload, 'utf8');
      let protectedRecord: ProtectedSideArtifactEnvelope;
      try {
        protectedRecord = this.#protectedArtifactStore.sealBuffer(RECEIPT_ARTIFACT_KIND, recordBytes);
      } finally {
        recordBytes.fill(0);
      }
      const payload: PlatformPolicyReceiptJournalEntryPayload = Object.freeze({
        schemaVersion: JOURNAL_SCHEMA_VERSION,
        sequence: entries.length + 1,
        previousHash: entries.at(-1)?.entryHash ?? GENESIS_HASH,
        protectedRecordHash: sha256(canonicalize(protectedRecord)),
        protectedRecord
      });
      const appended: PlatformPolicyReceiptJournalEntry = Object.freeze({
        ...payload,
        entryHash: entryHash(payload, this.#macKey)
      });
      const line = `${JSON.stringify(appended)}\n`;
      if (before.byteLength + Buffer.byteLength(line, 'utf8') > this.#maxJournalBytes) {
        throw new Error('POLICY_RECEIPT_JOURNAL_SIZE_LIMIT_EXCEEDED');
      }

      let journalDescriptor: number | undefined;
      try {
        journalDescriptor = openSync(this.#filePath, 'a', 0o600);
        writeFileSync(journalDescriptor, line, 'utf8');
        fsyncSync(journalDescriptor);
      } finally {
        if (journalDescriptor !== undefined) closeSync(journalDescriptor);
      }
      try { chmodSync(this.#filePath, 0o600); } catch { /* Windows ACL is authoritative. */ }
      syncDirectory(directory);

      const readback = readFileSync(this.#filePath);
      const verifiedEntries = parseJournal(readback, this.#protectedArtifactStore, this.#macKey);
      const verified = verifiedEntries.at(-1);
      if (
        readback.byteLength !== before.byteLength + Buffer.byteLength(line, 'utf8') ||
        !verified || verified.sequence !== appended.sequence || verified.entryHash !== appended.entryHash ||
        verified.protectedRecordHash !== appended.protectedRecordHash || canonicalize(verified.record) !== canonicalRecord
        || !verified.auditRecord || canonicalize(verified.auditRecord) !== canonicalize(auditRecord)
      ) throw new Error('POLICY_RECEIPT_JOURNAL_READBACK_MISMATCH');
      return this.#createProjectionProof(verified, verifiedEntries, readback.byteLength);
    } finally {
      if (lockDescriptor !== undefined) {
        closeSync(lockDescriptor);
        unlinkSync(this.#lockPath);
      }
    }
  }

  /**
   * Recovery is deliberately limited to an abandoned process lock and an
   * incomplete final byte tail. The complete verified prefix is never changed,
   * and the original bytes are fsynced to a protected-side forensic recovery
   * file before truncation. A complete but invalid line remains fail-closed.
   */
  #recoverDeadProjectionLock(): boolean {
    if (!existsSync(this.#lockPath)) return !existsSync(this.#recoveryLockPath);
    const directory = dirname(this.#filePath);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    let recoveryDescriptor: number | undefined;
    try {
      try {
        recoveryDescriptor = openSync(this.#recoveryLockPath, 'wx', 0o600);
      } catch (error) {
        if (fileErrorCode(error) === 'EEXIST') return false;
        throw error;
      }
      writeFileSync(recoveryDescriptor, `${process.pid}:${randomBytes(16).toString('hex')}\n`, 'utf8');
      fsyncSync(recoveryDescriptor);
      if (!existsSync(this.#lockPath)) return true;
      const lockBytes = readFileSync(this.#lockPath);
      let lockText: string;
      try {
        lockText = new TextDecoder('utf-8', { fatal: true }).decode(lockBytes);
      } catch (error) {
        throw new Error('POLICY_RECEIPT_JOURNAL_LOCK_INVALID', { cause: error });
      }
      const match = /^([1-9][0-9]*):[0-9a-f]{32}\n$/u.exec(lockText);
      const ownerProcessId = match ? Number(match[1]) : Number.NaN;
      if (!Number.isSafeInteger(ownerProcessId) || ownerProcessId < 1) {
        throw new Error('POLICY_RECEIPT_JOURNAL_LOCK_INVALID');
      }
      if (processIsAlive(ownerProcessId)) return false;
      this.#repairIncompleteJournalTail();
      unlinkSync(this.#lockPath);
      syncDirectory(directory);
      return true;
    } finally {
      if (recoveryDescriptor !== undefined) closeSync(recoveryDescriptor);
      try { unlinkSync(this.#recoveryLockPath); } catch (error) {
        if (fileErrorCode(error) !== 'ENOENT') throw error;
      }
    }
  }

  #repairIncompleteJournalTail(): void {
    if (!existsSync(this.#filePath)) return;
    const bytes = readFileSync(this.#filePath);
    if (bytes.byteLength === 0 || bytes.at(-1) === 0x0a) {
      parseJournal(bytes, this.#protectedArtifactStore, this.#macKey);
      return;
    }
    const lastNewline = bytes.lastIndexOf(0x0a);
    const verifiedPrefixLength = lastNewline < 0 ? 0 : lastNewline + 1;
    const verifiedPrefix = bytes.subarray(0, verifiedPrefixLength);
    parseJournal(verifiedPrefix, this.#protectedArtifactStore, this.#macKey);

    const originalHash = sha256(bytes);
    const forensicPath = `${this.#filePath}.partial-tail.${originalHash}.recovery`;
    if (existsSync(forensicPath)) {
      if (sha256(readFileSync(forensicPath)) !== originalHash) {
        throw new Error('POLICY_RECEIPT_JOURNAL_RECOVERY_EVIDENCE_MISMATCH');
      }
    } else {
      atomicWriteMacKey(forensicPath, bytes);
    }

    let descriptor: number | undefined;
    try {
      descriptor = openSync(this.#filePath, 'r+');
      ftruncateSync(descriptor, verifiedPrefixLength);
      fsyncSync(descriptor);
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
    syncDirectory(dirname(this.#filePath));
    const readback = readFileSync(this.#filePath);
    if (readback.byteLength !== verifiedPrefixLength || !readback.equals(verifiedPrefix)) {
      throw new Error('POLICY_RECEIPT_JOURNAL_RECOVERY_READBACK_MISMATCH');
    }
    parseJournal(readback, this.#protectedArtifactStore, this.#macKey);
  }

  /**
   * Local-only inspection for controlled tests and append readback. Production
   * startup must use inspectWithTrustedProvider so Core Service verifies every
   * decrypted request/receipt pair after a restart.
   */
  public inspectForControlledTest(): PlatformPolicyReceiptJournalInspection {
    return this.#inspectLocal().inspection;
  }

  /** Content-free production projection; no receipt, resource or payload leaves the main process. */
  public inspectDecisionAuditBoundary(): PlatformPolicyDecisionAuditJournalInspection {
    const inspection = this.#inspectLocal().inspection;
    return Object.freeze({
      valid: inspection.valid,
      entryCount: inspection.entryCount,
      auditedEntryCount: inspection.auditedEntryCount,
      legacyReceiptEntryCount: inspection.legacyReceiptEntryCount,
      headHash: inspection.headHash,
      ...(inspection.latestAuditHash ? { latestAuditHash: inspection.latestAuditHash } : {})
    });
  }

  public async inspectWithTrustedProvider(
    provider: Pick<PlatformPolicyAuthorizationProvider, 'verify'>
  ): Promise<PlatformPolicyReceiptJournalInspection> {
    this.#assertActive();
    if (!provider || typeof provider.verify !== 'function') {
      throw new Error('POLICY_RECEIPT_JOURNAL_TRUSTED_VERIFIER_UNAVAILABLE');
    }
    const local = this.#inspectLocal();
    for (const entry of local.entries) {
      let valid: boolean;
      try {
        valid = (await provider.verify(Object.freeze({
          request: entry.record.request,
          receipt: entry.record.receipt
        }))) === true;
      } catch (error) {
        throw new Error('POLICY_RECEIPT_JOURNAL_RECEIPT_VERIFICATION_FAILED', { cause: error });
      }
      if (!valid) throw new Error('POLICY_RECEIPT_JOURNAL_RECEIPT_VERIFICATION_FAILED');
    }
    await this.#checkpoint(
      local.inspection.entryCount,
      local.inspection.headHash,
      local.inspection.sizeBytes
    );
    return local.inspection;
  }

  async #checkpoint(journalSequence: number, journalHeadHash: string, journalSizeBytes: number): Promise<void> {
    const checkpoint = this.#checkpointTail.then(
      () => this.#checkpointNow(journalSequence, journalHeadHash, journalSizeBytes),
      () => this.#checkpointNow(journalSequence, journalHeadHash, journalSizeBytes)
    );
    this.#checkpointTail = checkpoint.catch(() => undefined);
    await checkpoint;
  }

  async #checkpointNow(journalSequence: number, journalHeadHash: string, journalSizeBytes: number): Promise<void> {
    let result: PolicyJournalCheckpointContractResult;
    try {
      result = await this.#monotonicAuthority.checkpointPolicyJournal({
        journalSequence,
        journalHeadHash,
        journalSizeBytes
      });
    } catch (error) {
      throw new Error('POLICY_RECEIPT_JOURNAL_MONOTONIC_CHECKPOINT_FAILED', { cause: error });
    }
    if (
      !result || result.schemaVersion !== 1
      || !Number.isSafeInteger(result.authorityEpoch) || result.authorityEpoch < 1
      || result.journalSequence !== journalSequence
      || result.journalHeadHash !== journalHeadHash
      || result.journalSizeBytes !== journalSizeBytes
      || !SHA256_PATTERN.test(result.checkpointHash)
      || typeof result.acceptedAt !== 'string' || !Number.isFinite(Date.parse(result.acceptedAt))
    ) throw new Error('POLICY_RECEIPT_JOURNAL_MONOTONIC_CHECKPOINT_INVALID');
  }

  public dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#macKey.fill(0);
  }

  #inspectLocal(): {
    readonly inspection: PlatformPolicyReceiptJournalInspection;
    readonly entries: readonly VerifiedPlatformPolicyReceiptJournalEntry[];
  } {
    this.#assertActive();
    if (existsSync(this.#lockPath)) {
      throw new Error('POLICY_RECEIPT_JOURNAL_LOCK_PRESENT');
    }
    if (!existsSync(this.#filePath)) {
      return Object.freeze({
        entries: Object.freeze([]),
        inspection: Object.freeze({
        filePath: this.#filePath,
        exists: false,
        valid: true,
        protection: 'AES_256_GCM_AND_HMAC_SHA256_DEVICE_PROTECTED_KEYS',
        entryCount: 0,
        auditedEntryCount: 0,
        legacyReceiptEntryCount: 0,
        sizeBytes: 0,
        sha256: sha256(Buffer.alloc(0)),
        headHash: GENESIS_HASH
        })
      });
    }
    const bytes = readFileSync(this.#filePath);
    if (bytes.byteLength > this.#maxJournalBytes) throw new Error('POLICY_RECEIPT_JOURNAL_SIZE_LIMIT_EXCEEDED');
    const entries = parseJournal(bytes, this.#protectedArtifactStore, this.#macKey);
    const latest = entries.at(-1);
    const auditedEntryCount = entries.filter((entry) => entry.auditRecord !== undefined).length;
    const latestAuditRecord = entries.findLast((entry) => entry.auditRecord !== undefined)?.auditRecord;
    return Object.freeze({
      entries,
      inspection: Object.freeze({
        filePath: this.#filePath,
        exists: true,
        valid: true,
        protection: 'AES_256_GCM_AND_HMAC_SHA256_DEVICE_PROTECTED_KEYS',
        entryCount: entries.length,
        auditedEntryCount,
        legacyReceiptEntryCount: entries.length - auditedEntryCount,
        sizeBytes: bytes.byteLength,
        sha256: sha256(bytes),
        headHash: latest?.entryHash ?? GENESIS_HASH,
        ...(latest ? { latestReceiptNonce: latest.record.receipt.nonce } : {}),
        ...(latestAuditRecord ? { latestAuditHash: latestAuditRecord.auditHash } : {})
      })
    });
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error('POLICY_RECEIPT_JOURNAL_DISPOSED');
  }
}
