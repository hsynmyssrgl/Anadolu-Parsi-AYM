import type { IsoDateTime } from '@ppt/core';
import {
  assertPolicyAuthorizedRepositoryContext,
  type AcknowledgePlatformPolicyJournalProjectionInput,
  type BindPlatformPolicyArchivePendingOperationInput,
  type PlatformPolicyDatabaseFenceSnapshot,
  type PlatformPolicyArchiveOperationIdentityInput,
  type PlatformPolicyArchiveOperationRecord,
  type PlatformPolicyArchiveOperationResolution,
  type PlatformPolicyArchivePendingOperationIdentityInput,
  type PlatformPolicyArchivePendingOperationMutation,
  type PlatformPolicyArchivePendingOperationRecord,
  type PlatformPolicyJournalAnchor,
  type PlatformPolicyJournalProjection,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceipt,
  type PlatformPolicyReceiptRecord,
  type PlatformPolicyReplayPruningInput,
  type PlatformPolicyReplayPruningResult,
  type PlatformPolicyReplayReservationInput,
  type PlatformPolicyTransactionReceiptRecord,
  type PlatformPolicyTransactionRepositoryPort,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RecordPlatformPolicyArchiveOperationResultInput,
  type RecordPlatformPolicyTransactionInput,
  type RepositoryExecutionContext,
  type RepositoryResult,
  type SynchronizePlatformPolicyFenceInput
} from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';

const SHA256 = /^[0-9a-f]{64}$/u;
const OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const CANONICAL_ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const MAX_REPLAY_PRUNING_BATCH_SIZE = 500;
const ARCHIVE_PENDING_OPERATION_MUTATIONS = new Set<PlatformPolicyArchivePendingOperationMutation>([
  'archive:import',
  'archive:open',
  'archive:secureDestroy',
  'archive:createRetentionPolicy',
  'archive:assignRetentionPolicy',
  'archive:createCategory',
  'archive:updateClassification'
]);

const SHA256_ROUND_CONSTANTS = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

const utf8Bytes = (value: string): number[] => {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    let codePoint = value.charCodeAt(index);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      const low = index + 1 < value.length ? value.charCodeAt(index + 1) : -1;
      if (low >= 0xdc00 && low <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00);
        index += 1;
      } else {
        codePoint = 0xfffd;
      }
    } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
      codePoint = 0xfffd;
    }
    if (codePoint < 0x80) bytes.push(codePoint);
    else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(0xe0 | (codePoint >>> 12), 0x80 | ((codePoint >>> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(
        0xf0 | (codePoint >>> 18),
        0x80 | ((codePoint >>> 12) & 0x3f),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    }
  }
  return bytes;
};

const rotateRight = (value: number, bits: number): number =>
  (value >>> bits) | (value << (32 - bits));

const sha256Utf8 = (value: string): string => {
  const bytes = utf8Bytes(value);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x1_0000_0000);
  const low = bitLength >>> 0;
  bytes.push(
    (high >>> 24) & 0xff, (high >>> 16) & 0xff, (high >>> 8) & 0xff, high & 0xff,
    (low >>> 24) & 0xff, (low >>> 16) & 0xff, (low >>> 8) & 0xff, low & 0xff
  );
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const words = new Array<number>(64).fill(0);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const position = offset + (index * 4);
      words[index] = (
        ((bytes[position] ?? 0) << 24) |
        ((bytes[position + 1] ?? 0) << 16) |
        ((bytes[position + 2] ?? 0) << 8) |
        (bytes[position + 3] ?? 0)
      ) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15] ?? 0;
      const previous2 = words[index - 2] ?? 0;
      const sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3);
      const sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10);
      words[index] = ((words[index - 16] ?? 0) + sigma0 + (words[index - 7] ?? 0) + sigma1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash as [number, number, number, number, number, number, number, number];
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choice + (SHA256_ROUND_CONSTANTS[index] ?? 0) + (words[index] ?? 0)) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = ((hash[0] ?? 0) + a) >>> 0;
    hash[1] = ((hash[1] ?? 0) + b) >>> 0;
    hash[2] = ((hash[2] ?? 0) + c) >>> 0;
    hash[3] = ((hash[3] ?? 0) + d) >>> 0;
    hash[4] = ((hash[4] ?? 0) + e) >>> 0;
    hash[5] = ((hash[5] ?? 0) + f) >>> 0;
    hash[6] = ((hash[6] ?? 0) + g) >>> 0;
    hash[7] = ((hash[7] ?? 0) + h) >>> 0;
  }
  return hash.map((word) => word.toString(16).padStart(8, '0')).join('');
};

/** Canonical JSON used for durable receipt hashes and exact journal records. */
export const canonicalPlatformPolicyJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalPlatformPolicyJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalPlatformPolicyJson(record[key])}`)
      .join(',')}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('Platform policy value is not JSON serializable');
  return serialized;
};

/**
 * The binding hash covers the exact signed receipt, not the surrounding
 * journal envelope. This lets repositories derive the same value directly
 * from the active transaction context.
 */
export const computePlatformPolicyReceiptHash = (receipt: PlatformPolicyReceipt): string =>
  sha256Utf8(canonicalPlatformPolicyJson(receipt));

export const computePlatformPolicyReceiptRecordHash = (record: PlatformPolicyReceiptRecord): string =>
  sha256Utf8(canonicalPlatformPolicyJson(record));

export interface PlatformPolicyPersistenceBinding {
  readonly receiptHash: string;
  readonly receiptVersion: 1;
  readonly contextHash: string;
  readonly dataClasses: PlatformPolicyReceiptRecord['dataClasses'];
  readonly obligationExecutionHash: string;
  readonly policyPackageVersion: number;
  readonly policyPackageSha256: string;
  readonly applicationVersion: string;
  readonly decisionAuthorityId?: PlatformPolicyReceiptRecord['decisionAuthorityId'];
  readonly capabilityManifestSha256?: string;
  readonly deviceCertificateSha256?: string;
  readonly nonce: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly action: PlatformPolicyReceiptRecord['action'];
  readonly capability: PlatformPolicyReceiptRecord['capability'];
  readonly resourceFamilyId: string;
  readonly purpose: string;
  readonly occurredAt: string;
}

/**
 * Legacy contexts remain receiptless. If a policy context is present, it must
 * be an active PEP-issued context and match the persisted resource exactly.
 */
export const platformPolicyPersistenceBinding = (
  context: RepositoryExecutionContext,
  resourceType: string,
  resourceId: string,
  expectedCorrelationId: string = context.correlationId
): PlatformPolicyPersistenceBinding | undefined => {
  const authorization = (context as Partial<PolicyAuthorizedRepositoryExecutionContext>).policyAuthorization;
  if (authorization === undefined) return undefined;
  if (expectedCorrelationId !== context.correlationId) {
    throw new Error('Policy-authorized persistence correlation does not match the repository transaction');
  }
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType,
    resourceId,
    action: authorization.action,
    capability: authorization.capability,
    correlationId: context.correlationId
  });
  return {
    receiptHash: computePlatformPolicyReceiptHash(authorization.receipt),
    receiptVersion: authorization.receipt.receiptVersion,
    contextHash: authorization.contextHash,
    dataClasses: authorization.dataClasses,
    obligationExecutionHash: authorization.obligationExecution.attestationHash,
    policyPackageVersion: authorization.policyPackageVersion,
    policyPackageSha256: authorization.policyPackageSha256,
    applicationVersion: authorization.applicationVersion,
    ...(authorization.decisionAuthorityId ? { decisionAuthorityId: authorization.decisionAuthorityId } : {}),
    ...(authorization.capabilityManifestSha256 ? { capabilityManifestSha256: authorization.capabilityManifestSha256 } : {}),
    ...(authorization.deviceCertificateSha256 ? { deviceCertificateSha256: authorization.deviceCertificateSha256 } : {}),
    nonce: authorization.receipt.nonce,
    resourceType: authorization.resourceType,
    resourceId: authorization.resourceId,
    action: authorization.action,
    capability: authorization.capability,
    resourceFamilyId: authorization.resourceFamilyId,
    purpose: authorization.purpose,
    occurredAt: authorization.occurredAt
  };
};

const assertNonEmpty: (value: unknown, label: string, max: number) => asserts value is string = (value, label, max) => {
  if (typeof value !== 'string' || value.trim() !== value || value.length < 1 || value.length > max) {
    throw new Error(`${label} is invalid`);
  }
};

const assertIsoDate: (value: unknown, label: string) => asserts value is string = (value, label) => {
  if (
    typeof value !== 'string'
    || !CANONICAL_ISO_UTC.test(value)
    || !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`${label} is invalid`);
  }
};

const mapFence = (row: Record<string, unknown>): PlatformPolicyDatabaseFenceSnapshot => ({
  fenceName: String(row.fence_name),
  epoch: Number(row.epoch),
  writable: Number(row.writable) === 1,
  synchronizedAt: String(row.synchronized_at) as IsoDateTime
});

const mapReceipt = (row: Record<string, unknown>): PlatformPolicyTransactionReceiptRecord => ({
  receiptHash: String(row.receipt_hash),
  receiptVersion: 1,
  requestHash: String(row.request_hash),
  ...(typeof row.context_hash === 'string' ? { contextHash: row.context_hash } : {}),
  ...(typeof row.data_classes_json === 'string'
    ? { dataClasses: Object.freeze(JSON.parse(row.data_classes_json) as PlatformPolicyReceiptRecord['dataClasses']) }
    : {}),
  ...(typeof row.obligation_execution_hash === 'string'
    ? { obligationExecutionHash: row.obligation_execution_hash }
    : {}),
  ...(typeof row.policy_package_version === 'number'
    ? { policyPackageVersion: row.policy_package_version }
    : {}),
  ...(typeof row.policy_package_sha256 === 'string'
    ? { policyPackageSha256: row.policy_package_sha256 }
    : {}),
  ...(typeof row.application_version === 'string'
    ? { applicationVersion: row.application_version }
    : {}),
  ...(typeof row.capability_manifest_sha256 === 'string'
    ? { capabilityManifestSha256: row.capability_manifest_sha256 }
    : {}),
  ...(typeof row.device_certificate_sha256 === 'string'
    ? { deviceCertificateSha256: row.device_certificate_sha256 }
    : {}),
  ...(typeof row.decision_authority_id === 'string'
    ? { decisionAuthorityId: row.decision_authority_id as PlatformPolicyReceiptRecord['decisionAuthorityId'] }
    : {}),
  nonce: String(row.nonce),
  correlationId: String(row.correlation_id),
  policyVersion: String(row.policy_version),
  resourceType: String(row.resource_type),
  resourceId: String(row.resource_id),
  action: String(row.action) as PlatformPolicyReceiptRecord['action'],
  capability: String(row.capability) as PlatformPolicyReceiptRecord['capability'],
  fenceName: String(row.fence_name),
  fenceEpoch: Number(row.fence_epoch),
  issuedAt: String(row.issued_at) as IsoDateTime,
  recordedAt: String(row.recorded_at) as IsoDateTime,
  record: JSON.parse(String(row.record_json)) as PlatformPolicyReceiptRecord
});

const mapArchiveOperation = (row: Record<string, unknown>): PlatformPolicyArchiveOperationRecord => {
  const resultJson = String(row.result_json);
  let parsedResult: unknown;
  try { parsedResult = JSON.parse(resultJson); }
  catch { throw new Error('Archive operation result JSON is invalid'); }
  if (canonicalPlatformPolicyJson(parsedResult) !== resultJson) {
    throw new Error('Archive operation result JSON is not canonical');
  }
  const resultHash = String(row.result_hash);
  if (!SHA256.test(resultHash) || sha256Utf8(resultJson) !== resultHash) {
    throw new Error('Archive operation result hash does not match its canonical result');
  }
  return {
    operationId: String(row.operation_id),
    operationFingerprint: String(row.operation_fingerprint),
    resourceFamilyId: String(row.family_id),
    actorAccountId: String(row.actor_account_id),
    purpose: 'archive',
    resourceType: String(row.resource_type),
    resourceId: String(row.resource_id),
    action: String(row.action) as PlatformPolicyReceiptRecord['action'],
    capability: String(row.capability) as PlatformPolicyReceiptRecord['capability'],
    originalReceiptHash: String(row.original_receipt_hash),
    originalCorrelationId: String(row.original_correlation_id),
    resultJson,
    resultHash,
    completedAt: String(row.completed_at) as IsoDateTime,
    retryCount: Number(row.retry_count ?? 0)
  };
};

const ARCHIVE_OPERATION_SELECT = `
  SELECT operation.*,
    (SELECT count(*) FROM platform_policy_archive_operation_retries retry
     WHERE retry.operation_id=operation.operation_id) AS retry_count
  FROM platform_policy_archive_operations operation
  WHERE operation.operation_id=?
`;

const mapArchivePendingOperation = (
  row: Record<string, unknown>
): PlatformPolicyArchivePendingOperationRecord => ({
  operationId: String(row.operation_id),
  intentFingerprint: String(row.intent_fingerprint),
  mutation: String(row.mutation) as PlatformPolicyArchivePendingOperationMutation,
  resourceFamilyId: String(row.family_id),
  actorAccountId: String(row.actor_account_id),
  purpose: 'archive',
  acquiredAt: String(row.acquired_at) as IsoDateTime,
  ...(row.bound_operation_fingerprint
    ? { boundOperationFingerprint: String(row.bound_operation_fingerprint) }
    : {}),
  ...(row.acknowledged_at ? { acknowledgedAt: String(row.acknowledged_at) as IsoDateTime } : {}),
  ...(row.acknowledgement_kind
    ? { acknowledgementKind: String(row.acknowledgement_kind) as 'completed' | 'cancelled' }
    : {})
});

const ARCHIVE_PENDING_OPERATION_SELECT = `
  SELECT operation_id,intent_fingerprint,mutation,family_id,actor_account_id,purpose,
    acquired_at,bound_operation_fingerprint,acknowledged_at,acknowledgement_kind
  FROM platform_policy_archive_pending_operations
  WHERE operation_id=?
`;

const mapProjection = (row: Record<string, unknown>): PlatformPolicyJournalProjection => ({
  receiptHash: String(row.receipt_hash),
  record: JSON.parse(String(row.record_json)) as PlatformPolicyReceiptRecord,
  status: String(row.status) as PlatformPolicyJournalProjection['status'],
  createdAt: String(row.created_at) as IsoDateTime,
  ...(row.projected_at ? { projectedAt: String(row.projected_at) as IsoDateTime } : {})
});

const PROJECTION_PROOF_KEYS = Object.freeze([
  'schemaVersion',
  'receiptHash',
  'recordHash',
  'receiptNonce',
  'entrySequence',
  'entryHash',
  'headSequence',
  'headHash',
  'journalSizeBytes',
  'issuedAt',
  'proofMac'
]);

const assertProjectionProof = (
  proof: PlatformPolicyJournalProjectionProof,
  receiptHash: string,
  receiptNonce: string,
  record: PlatformPolicyReceiptRecord
): void => {
  if (!proof || typeof proof !== 'object') throw new Error('Platform policy journal projection proof is missing');
  const keys = Object.keys(proof).sort();
  const expectedKeys = [...PROJECTION_PROOF_KEYS].sort();
  if (keys.length !== expectedKeys.length || !keys.every((key, index) => key === expectedKeys[index])) {
    throw new Error('Platform policy journal projection proof shape is invalid');
  }
  if (
    proof.schemaVersion !== 1
    || proof.receiptHash !== receiptHash
    || proof.receiptNonce !== receiptNonce
    || proof.recordHash !== computePlatformPolicyReceiptRecordHash(record)
    || !SHA256.test(proof.receiptHash)
    || !SHA256.test(proof.recordHash)
    || !SHA256.test(proof.entryHash)
    || !SHA256.test(proof.headHash)
    || !SHA256.test(proof.proofMac)
    || !Number.isSafeInteger(proof.entrySequence)
    || proof.entrySequence < 1
    || !Number.isSafeInteger(proof.headSequence)
    || proof.headSequence < proof.entrySequence
    || !Number.isSafeInteger(proof.journalSizeBytes)
    || proof.journalSizeBytes < 1
  ) throw new Error('Platform policy journal projection proof binding is invalid');
  assertNonEmpty(proof.receiptNonce, 'Platform policy journal projection proof nonce', 256);
  assertIsoDate(proof.issuedAt, 'Platform policy journal projection proof time');
};

const mapJournalAnchor = (row: Record<string, unknown>): PlatformPolicyJournalAnchor => ({
  anchorName: 'archive-protected-receipt-journal',
  proof: Object.freeze({
    schemaVersion: 1,
    receiptHash: String(row.receipt_hash),
    recordHash: String(row.record_hash),
    receiptNonce: String(row.receipt_nonce),
    entrySequence: Number(row.entry_sequence),
    entryHash: String(row.entry_hash),
    headSequence: Number(row.head_sequence),
    headHash: String(row.head_hash),
    journalSizeBytes: Number(row.journal_size_bytes),
    issuedAt: String(row.proof_issued_at),
    proofMac: String(row.proof_mac)
  }),
  anchoredAt: String(row.anchored_at) as IsoDateTime
});

const assertRecordMatchesContext = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  input: RecordPlatformPolicyTransactionInput
): void => {
  const { record } = input;
  const authorization = context.policyAuthorization;
  const durableAuthorization = authorization as typeof authorization & {
    readonly fenceEpoch: number;
    readonly fenceWritable: boolean;
    readonly receiptRecord: PlatformPolicyReceiptRecord;
  };
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    action: record.action,
    capability: record.capability,
    correlationId: context.correlationId,
    resourceFamilyId: record.request.resource.familyId,
    ...(record.request.resource.householdId ? { resourceHouseholdId: record.request.resource.householdId } : {}),
    ...(record.request.resource.familyBranchId ? { resourceFamilyBranchId: record.request.resource.familyBranchId } : {}),
    ...(record.request.resource.ownerPersonId ? { resourceOwnerPersonId: record.request.resource.ownerPersonId } : {}),
    purpose: record.request.purpose!,
    occurredAt: record.request.occurredAt,
    contextHash: record.contextHash,
    dataClasses: record.dataClasses
  });
  assertNonEmpty(input.fenceName, 'Platform policy fence name', 128);
  if (!Number.isSafeInteger(input.fenceEpoch) || input.fenceEpoch < 0 || input.fenceWritable !== true) {
    throw new Error('Platform policy write fence is invalid');
  }
  assertIsoDate(record.recordedAt, 'Platform policy record time');
  assertIsoDate(record.receipt.issuedAt, 'Platform policy receipt issue time');
  assertNonEmpty(record.receipt.nonce, 'Platform policy receipt nonce', 256);
  if (
    canonicalPlatformPolicyJson(record) !== canonicalPlatformPolicyJson(durableAuthorization.receiptRecord) ||
    record.recordedAt !== record.receipt.issuedAt ||
    input.fenceEpoch !== durableAuthorization.fenceEpoch ||
    input.fenceWritable !== durableAuthorization.fenceWritable ||
    record.correlationId !== context.correlationId ||
    record.resourceType !== authorization.resourceType ||
    record.resourceId !== authorization.resourceId ||
    record.action !== authorization.action ||
    record.capability !== authorization.capability ||
    record.request.correlationId !== context.correlationId ||
    record.request.resource.type !== authorization.resourceType ||
    record.request.resource.id !== authorization.resourceId ||
    record.request.action !== authorization.action ||
    record.request.capability !== authorization.capability ||
    record.request.policyVersion !== authorization.policyVersion ||
    record.policyPackageVersion !== authorization.policyPackageVersion ||
    record.policyPackageSha256 !== authorization.policyPackageSha256 ||
    record.applicationVersion !== authorization.applicationVersion ||
    record.request.policyPackageVersion !== authorization.policyPackageVersion ||
    record.request.policyPackageSha256 !== authorization.policyPackageSha256 ||
    record.request.subject.applicationVersion !== authorization.applicationVersion ||
    record.capabilityManifestSha256 !== authorization.capabilityManifestSha256 ||
    record.deviceCertificateSha256 !== authorization.deviceCertificateSha256 ||
    record.request.subject.capabilityManifestSha256 !== authorization.capabilityManifestSha256 ||
    record.request.subject.deviceCertificate?.certificateSha256 !== authorization.deviceCertificateSha256 ||
    record.decisionAuthorityId !== authorization.decisionAuthorityId ||
    record.request.decisionAuthorityId !== authorization.decisionAuthorityId ||
    record.request.clusterWritable !== true ||
    record.request.enforcementMode !== 'strict' ||
    record.contextHash !== authorization.contextHash ||
    record.contextHash !== record.decision.contextHash ||
    record.contextHash !== record.receipt.decision.contextHash ||
    canonicalPlatformPolicyJson(record.dataClasses) !== canonicalPlatformPolicyJson(authorization.dataClasses) ||
    canonicalPlatformPolicyJson(record.dataClasses) !== canonicalPlatformPolicyJson(record.request.resource.dataClasses) ||
    !record.obligationExecution ||
    record.obligationExecution.attestationHash !== authorization.obligationExecution.attestationHash ||
    record.obligationExecution.requestHash !== record.receipt.requestHash ||
    record.obligationExecution.receiptNonce !== record.receipt.nonce ||
    canonicalPlatformPolicyJson(record.obligationExecution.executed) !== canonicalPlatformPolicyJson(
      authorization.obligationExecution.executed
    ) ||
    record.receipt.receiptVersion !== 1 ||
    record.receipt.requestHash !== authorization.requestHash ||
    record.receipt.decision.policyVersion !== authorization.policyVersion ||
    record.decision.policyVersion !== authorization.policyVersion ||
    record.receipt.decision.policyPackageVersion !== authorization.policyPackageVersion ||
    record.decision.policyPackageVersion !== authorization.policyPackageVersion ||
    record.receipt.decision.policyPackageSha256 !== authorization.policyPackageSha256 ||
    record.decision.policyPackageSha256 !== authorization.policyPackageSha256 ||
    record.receipt.decision.applicationVersion !== authorization.applicationVersion ||
    record.decision.applicationVersion !== authorization.applicationVersion ||
    record.receipt.decision.capabilityManifestSha256 !== authorization.capabilityManifestSha256 ||
    record.decision.capabilityManifestSha256 !== authorization.capabilityManifestSha256 ||
    record.receipt.decision.deviceCertificateSha256 !== authorization.deviceCertificateSha256 ||
    record.decision.deviceCertificateSha256 !== authorization.deviceCertificateSha256 ||
    record.receipt.decision.decisionAuthorityId !== authorization.decisionAuthorityId ||
    record.decision.decisionAuthorityId !== authorization.decisionAuthorityId ||
    record.decision.allowed !== true ||
    canonicalPlatformPolicyJson(record.decision) !== canonicalPlatformPolicyJson(record.receipt.decision) ||
    canonicalPlatformPolicyJson(record.receipt) !== canonicalPlatformPolicyJson(authorization.receipt)
  ) {
    throw new Error('Platform policy receipt record does not match its active transaction context');
  }
  const receiptHash = computePlatformPolicyReceiptHash(record.receipt);
  if (
    !SHA256.test(receiptHash) ||
    !SHA256.test(record.receipt.requestHash) ||
    !SHA256.test(record.contextHash) ||
    !SHA256.test(record.receipt.signature)
  ) {
    throw new Error('Platform policy receipt hashes are invalid');
  }
};

const assertArchiveOperationIdentity = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  input: PlatformPolicyArchiveOperationIdentityInput
): void => {
  const authorization = context.policyAuthorization;
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: authorization.resourceType,
    resourceId: authorization.resourceId,
    action: authorization.action,
    capability: authorization.capability,
    correlationId: context.correlationId
  });
  if (!OPERATION_ID.test(input.operationId)) throw new Error('Archive operation identifier is invalid');
  if (!SHA256.test(input.operationFingerprint)) throw new Error('Archive operation fingerprint is invalid');
  assertNonEmpty(input.resourceFamilyId, 'Archive operation family identifier', 128);
  assertNonEmpty(input.actorAccountId, 'Archive operation actor identifier', 128);
  if (
    input.purpose !== 'archive'
    || authorization.resourceFamilyId !== input.resourceFamilyId
    || authorization.subject.accountId !== input.actorAccountId
    || authorization.receiptRecord.request.resource.familyId !== input.resourceFamilyId
    || authorization.receiptRecord.request.subject.accountId !== input.actorAccountId
    || authorization.receiptRecord.request.purpose !== input.purpose
  ) throw new Error('Archive operation identity does not match its active policy transaction');
};

const assertArchiveOperationMatches = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  input: PlatformPolicyArchiveOperationIdentityInput,
  operation: PlatformPolicyArchiveOperationRecord
): void => {
  const authorization = context.policyAuthorization;
  if (
    operation.operationId !== input.operationId
    || operation.operationFingerprint !== input.operationFingerprint
    || operation.resourceFamilyId !== input.resourceFamilyId
    || operation.actorAccountId !== input.actorAccountId
    || operation.purpose !== input.purpose
    || operation.resourceType !== authorization.resourceType
    || operation.resourceId !== authorization.resourceId
    || operation.action !== authorization.action
    || operation.capability !== authorization.capability
  ) throw new Error('Archive operation identifier was reused with a different semantic mutation');
};

const assertArchivePendingOperationIdentity = (
  context: RepositoryExecutionContext,
  input: PlatformPolicyArchivePendingOperationIdentityInput
): void => {
  if (!OPERATION_ID.test(input.operationId)) throw new Error('Archive pending operation identifier is invalid');
  if (!SHA256.test(input.intentFingerprint)) throw new Error('Archive pending intent fingerprint is invalid');
  if (!ARCHIVE_PENDING_OPERATION_MUTATIONS.has(input.mutation)) {
    throw new Error('Archive pending operation mutation is invalid');
  }
  assertNonEmpty(input.resourceFamilyId, 'Archive pending operation family identifier', 128);
  assertNonEmpty(input.actorAccountId, 'Archive pending operation actor identifier', 128);
  if (input.purpose !== 'archive' || context.actor.userId !== input.actorAccountId) {
    throw new Error('Archive pending operation identity does not match its repository actor');
  }
};

const assertArchivePendingOperationMatches = (
  input: PlatformPolicyArchivePendingOperationIdentityInput,
  operation: PlatformPolicyArchivePendingOperationRecord
): void => {
  if (
    operation.operationId !== input.operationId
    || operation.intentFingerprint !== input.intentFingerprint
    || operation.mutation !== input.mutation
    || operation.resourceFamilyId !== input.resourceFamilyId
    || operation.actorAccountId !== input.actorAccountId
    || operation.purpose !== input.purpose
  ) {
    throw new Error('Archive pending operation identifier was reused with a different renderer intent');
  }
};

const assertArchivePendingOperationBinding = (
  context: RepositoryExecutionContext,
  input: BindPlatformPolicyArchivePendingOperationInput,
  operation: PlatformPolicyArchivePendingOperationRecord
): void => {
  if (!OPERATION_ID.test(input.operationId) || !SHA256.test(input.operationFingerprint)) {
    throw new Error('Archive pending operation binding is invalid');
  }
  if (!ARCHIVE_PENDING_OPERATION_MUTATIONS.has(input.mutation)) {
    throw new Error('Archive pending operation mutation is invalid');
  }
  if (
    input.purpose !== 'archive'
    || context.actor.userId !== input.actorAccountId
    || operation.operationId !== input.operationId
    || operation.mutation !== input.mutation
    || operation.resourceFamilyId !== input.resourceFamilyId
    || operation.actorAccountId !== input.actorAccountId
    || operation.purpose !== input.purpose
  ) {
    throw new Error('Archive pending operation binding does not match its durable renderer intent');
  }
  if (operation.acknowledgedAt) throw new Error('Acknowledged archive pending operation cannot be rebound');
  if (
    operation.boundOperationFingerprint !== undefined
    && operation.boundOperationFingerprint !== input.operationFingerprint
  ) {
    throw new Error('Archive pending operation was rebound to a different operation fingerprint');
  }
};

export class SqlitePlatformPolicyTransactionRepository
  extends SqliteRepository
  implements PlatformPolicyTransactionRepositoryPort {
  public reserveReplayNonce(
    context: RepositoryExecutionContext,
    input: PlatformPolicyReplayReservationInput
  ): RepositoryResult<boolean> {
    return this.execute(context, () => {
      assertNonEmpty(input.nonce, 'Platform policy replay nonce', 256);
      if (
        !Number.isSafeInteger(input.reservedAtMs) || input.reservedAtMs < 0 ||
        !Number.isSafeInteger(input.expiresAtMs) || input.expiresAtMs <= input.reservedAtMs
      ) {
        throw new Error('Platform policy replay reservation interval is invalid');
      }
      const result = this.database(context).prepare(`
        INSERT INTO platform_policy_replay_reservations(nonce,reserved_at_ms,expires_at_ms)
        VALUES(?,?,?)
        ON CONFLICT(nonce) DO UPDATE SET
          reserved_at_ms=excluded.reserved_at_ms,
          expires_at_ms=excluded.expires_at_ms
        WHERE platform_policy_replay_reservations.expires_at_ms<excluded.reserved_at_ms
          AND NOT EXISTS(
            SELECT 1 FROM platform_policy_transaction_receipts receipt
            WHERE receipt.nonce=excluded.nonce
          )
      `).run(input.nonce, input.reservedAtMs, input.expiresAtMs);
      return Number(result.changes) === 1;
    });
  }

  public pruneExpiredUnusedReplayReservations(
    context: RepositoryExecutionContext,
    input: PlatformPolicyReplayPruningInput
  ): RepositoryResult<PlatformPolicyReplayPruningResult> {
    return this.execute(context, () => {
      if (!Number.isSafeInteger(input.cutoffMs) || input.cutoffMs < 0) {
        throw new Error('Platform policy replay pruning cutoff is invalid');
      }
      if (
        !Number.isSafeInteger(input.limit)
        || input.limit < 1
        || input.limit > MAX_REPLAY_PRUNING_BATCH_SIZE
      ) {
        throw new Error('Platform policy replay pruning batch limit is invalid');
      }
      assertIsoDate(context.occurredAt, 'Platform policy replay pruning time');
      const database = this.database(context);
      const state = database.prepare(`
        SELECT cutoff_ms,updated_at
        FROM platform_policy_replay_pruning_state
        WHERE scope='archive'
      `).get() as Record<string, unknown> | undefined;
      if (!state) throw new Error('Platform policy replay pruning watermark is unavailable');
      const currentCutoffMs = Number(state.cutoff_ms);
      if (!Number.isSafeInteger(currentCutoffMs) || input.cutoffMs < currentCutoffMs) {
        throw new Error('Platform policy replay pruning cutoff cannot regress');
      }
      if (input.cutoffMs > currentCutoffMs) {
        const advanced = database.prepare(`
          UPDATE platform_policy_replay_pruning_state
          SET cutoff_ms=?,updated_at=?
          WHERE scope='archive' AND cutoff_ms=?
        `).run(input.cutoffMs, context.occurredAt, currentCutoffMs);
        if (Number(advanced.changes) !== 1) {
          throw new Error('Platform policy replay pruning watermark was not advanced');
        }
      }
      const deleted = database.prepare(`
        DELETE FROM platform_policy_replay_reservations
        WHERE nonce IN (
          SELECT reservation.nonce
          FROM platform_policy_replay_reservations reservation
          WHERE reservation.expires_at_ms<?
            AND NOT EXISTS(
              SELECT 1 FROM platform_policy_transaction_receipts receipt
              WHERE receipt.nonce=reservation.nonce
            )
          ORDER BY reservation.expires_at_ms,reservation.nonce
          LIMIT ?
        )
      `).run(input.cutoffMs, input.limit);
      const remaining = database.prepare(`
        SELECT 1 AS present
        FROM platform_policy_replay_reservations reservation
        WHERE reservation.expires_at_ms<?
          AND NOT EXISTS(
            SELECT 1 FROM platform_policy_transaction_receipts receipt
            WHERE receipt.nonce=reservation.nonce
          )
        LIMIT 1
      `).get(input.cutoffMs) as Record<string, unknown> | undefined;
      return Object.freeze({
        cutoffMs: input.cutoffMs,
        prunedCount: Number(deleted.changes),
        hasMore: remaining !== undefined
      });
    });
  }

  public synchronizeFence(
    context: RepositoryExecutionContext,
    input: SynchronizePlatformPolicyFenceInput
  ): RepositoryResult<PlatformPolicyDatabaseFenceSnapshot> {
    return this.execute(context, () => {
      assertNonEmpty(input.fenceName, 'Platform policy fence name', 128);
      assertIsoDate(input.synchronizedAt, 'Platform policy fence synchronization time');
      if (!Number.isSafeInteger(input.epoch) || input.epoch < 0 || typeof input.writable !== 'boolean') {
        throw new Error('Platform policy fence snapshot is invalid');
      }
      this.database(context).prepare(`
        INSERT INTO platform_policy_database_fences(fence_name,epoch,writable,synchronized_at)
        VALUES(?,?,?,?)
        ON CONFLICT(fence_name) DO UPDATE SET
          epoch=excluded.epoch,
          writable=excluded.writable,
          synchronized_at=excluded.synchronized_at
      `).run(input.fenceName, input.epoch, input.writable ? 1 : 0, input.synchronizedAt);
      const row = this.database(context).prepare(`
        SELECT fence_name,epoch,writable,synchronized_at
        FROM platform_policy_database_fences WHERE fence_name=?
      `).get(input.fenceName) as Record<string, unknown> | undefined;
      if (!row) throw new Error('Platform policy fence synchronization was not persisted');
      return mapFence(row);
    });
  }

  public readFence(
    context: RepositoryExecutionContext,
    fenceName: string
  ): RepositoryResult<PlatformPolicyDatabaseFenceSnapshot | undefined> {
    return this.execute(context, () => {
      assertNonEmpty(fenceName, 'Platform policy fence name', 128);
      const row = this.database(context).prepare(`
        SELECT fence_name,epoch,writable,synchronized_at
        FROM platform_policy_database_fences WHERE fence_name=?
      `).get(fenceName) as Record<string, unknown> | undefined;
      return row ? mapFence(row) : undefined;
    });
  }

  public recordAuthorizedTransaction(
    context: PolicyAuthorizedRepositoryExecutionContext,
    input: RecordPlatformPolicyTransactionInput
  ): RepositoryResult<PlatformPolicyTransactionReceiptRecord> {
    return this.execute(context, () => {
      assertRecordMatchesContext(context, input);
      const { record } = input;
      const receiptHash = computePlatformPolicyReceiptHash(record.receipt);
      const recordJson = canonicalPlatformPolicyJson(record);
      this.database(context).prepare(`
        INSERT INTO platform_policy_transaction_receipts(
          receipt_hash,receipt_version,request_hash,context_hash,data_classes_json,obligation_execution_hash,
          policy_package_version,policy_package_sha256,application_version,capability_manifest_sha256,device_certificate_sha256,decision_authority_id,nonce,correlation_id,policy_version,
          resource_type,resource_id,action,capability,fence_name,fence_epoch,fence_writable,
          issued_at,recorded_at,record_json
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        receiptHash,
        record.receipt.receiptVersion,
        record.receipt.requestHash,
        record.contextHash,
        JSON.stringify(record.dataClasses),
        record.obligationExecution!.attestationHash,
        record.policyPackageVersion,
        record.policyPackageSha256,
        record.applicationVersion,
        record.capabilityManifestSha256,
        record.deviceCertificateSha256 ?? null,
        record.decisionAuthorityId ?? null,
        record.receipt.nonce,
        record.correlationId,
        record.decision.policyVersion,
        record.resourceType,
        record.resourceId,
        record.action,
        record.capability,
        input.fenceName,
        input.fenceEpoch,
        1,
        record.receipt.issuedAt,
        record.recordedAt,
        recordJson
      );
      this.database(context).prepare(`
        INSERT INTO platform_policy_journal_projection_outbox(
          receipt_hash,record_json,status,created_at,projected_at
        ) VALUES(?,?,'pending',?,NULL)
      `).run(receiptHash, recordJson, record.recordedAt);
      const row = this.database(context).prepare(`
        SELECT * FROM platform_policy_transaction_receipts WHERE receipt_hash=?
      `).get(receiptHash) as Record<string, unknown> | undefined;
      if (!row) throw new Error('Platform policy transaction receipt was not persisted');
      return mapReceipt(row);
    });
  }

  public resolveArchiveOperation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    input: PlatformPolicyArchiveOperationIdentityInput
  ): RepositoryResult<PlatformPolicyArchiveOperationResolution> {
    return this.execute(context, () => {
      assertArchiveOperationIdentity(context, input);
      const database = this.database(context);
      const row = database.prepare(ARCHIVE_OPERATION_SELECT).get(input.operationId) as Record<string, unknown> | undefined;
      if (!row) return Object.freeze({ state: 'execute' as const });
      const operation = mapArchiveOperation(row);
      assertArchiveOperationMatches(context, input, operation);
      const authorization = context.policyAuthorization;
      const retryReceiptHash = computePlatformPolicyReceiptHash(authorization.receipt);
      if (retryReceiptHash === operation.originalReceiptHash) {
        throw new Error('Archive operation retry cannot reuse its original receipt');
      }
      database.prepare(`
        INSERT INTO platform_policy_archive_operation_retries(
          retry_receipt_hash,operation_id,operation_fingerprint,retry_correlation_id,retried_at
        ) VALUES(?,?,?,?,?)
      `).run(
        retryReceiptHash,
        input.operationId,
        input.operationFingerprint,
        context.correlationId,
        authorization.receiptRecord.recordedAt
      );
      const replayRow = database.prepare(ARCHIVE_OPERATION_SELECT).get(input.operationId) as Record<string, unknown> | undefined;
      if (!replayRow) throw new Error('Archive operation disappeared while its retry was recorded');
      return Object.freeze({ state: 'replay' as const, operation: mapArchiveOperation(replayRow) });
    });
  }

  public recordArchiveOperationResult(
    context: PolicyAuthorizedRepositoryExecutionContext,
    input: RecordPlatformPolicyArchiveOperationResultInput
  ): RepositoryResult<PlatformPolicyArchiveOperationRecord> {
    return this.execute(context, () => {
      assertArchiveOperationIdentity(context, input);
      if (typeof input.resultJson !== 'string' || input.resultJson.length < 2 || input.resultJson.length > 1_048_576) {
        throw new Error('Archive operation result JSON is invalid');
      }
      let parsedResult: unknown;
      try { parsedResult = JSON.parse(input.resultJson); }
      catch { throw new Error('Archive operation result JSON is invalid'); }
      if (canonicalPlatformPolicyJson(parsedResult) !== input.resultJson) {
        throw new Error('Archive operation result JSON must be canonical');
      }
      const authorization = context.policyAuthorization;
      const receiptHash = computePlatformPolicyReceiptHash(authorization.receipt);
      this.database(context).prepare(`
        INSERT INTO platform_policy_archive_operations(
          operation_id,operation_fingerprint,family_id,actor_account_id,purpose,
          resource_type,resource_id,action,capability,original_receipt_hash,
          original_correlation_id,result_json,result_hash,completed_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        input.operationId,
        input.operationFingerprint,
        input.resourceFamilyId,
        input.actorAccountId,
        input.purpose,
        authorization.resourceType,
        authorization.resourceId,
        authorization.action,
        authorization.capability,
        receiptHash,
        context.correlationId,
        input.resultJson,
        sha256Utf8(input.resultJson),
        authorization.receiptRecord.recordedAt
      );
      const row = this.database(context).prepare(ARCHIVE_OPERATION_SELECT).get(input.operationId) as Record<string, unknown> | undefined;
      if (!row) throw new Error('Archive operation result was not persisted');
      return mapArchiveOperation(row);
    });
  }

  public findArchiveOperation(
    context: RepositoryExecutionContext,
    operationId: string
  ): RepositoryResult<PlatformPolicyArchiveOperationRecord | undefined> {
    return this.execute(context, () => {
      if (!OPERATION_ID.test(operationId)) throw new Error('Archive operation identifier is invalid');
      const row = this.database(context).prepare(ARCHIVE_OPERATION_SELECT).get(operationId) as Record<string, unknown> | undefined;
      return row ? mapArchiveOperation(row) : undefined;
    });
  }

  public acquireArchivePendingOperation(
    context: RepositoryExecutionContext,
    input: PlatformPolicyArchivePendingOperationIdentityInput
  ): RepositoryResult<PlatformPolicyArchivePendingOperationRecord> {
    return this.execute(context, () => {
      assertArchivePendingOperationIdentity(context, input);
      assertIsoDate(context.occurredAt, 'Archive pending operation acquisition time');
      const database = this.database(context);
      database.prepare(`
        INSERT INTO platform_policy_archive_pending_operations(
          operation_id,intent_fingerprint,mutation,family_id,actor_account_id,purpose,
          acquired_at,bound_operation_fingerprint,acknowledged_at,acknowledgement_kind
        ) VALUES(?,?,?,?,?,? ,?,NULL,NULL,NULL)
        ON CONFLICT DO NOTHING
      `).run(
        input.operationId,
        input.intentFingerprint,
        input.mutation,
        input.resourceFamilyId,
        input.actorAccountId,
        input.purpose,
        context.occurredAt
      );
      const row = database.prepare(`
        SELECT operation_id,intent_fingerprint,mutation,family_id,actor_account_id,purpose,
          acquired_at,bound_operation_fingerprint,acknowledged_at,acknowledgement_kind
        FROM platform_policy_archive_pending_operations
        WHERE family_id=? AND actor_account_id=? AND purpose=? AND mutation=?
          AND intent_fingerprint=? AND acknowledged_at IS NULL
      `).get(
        input.resourceFamilyId,
        input.actorAccountId,
        input.purpose,
        input.mutation,
        input.intentFingerprint
      ) as Record<string, unknown> | undefined;
      if (!row) throw new Error('Archive pending operation acquisition did not resolve a durable identity');
      const operation = mapArchivePendingOperation(row);
      if (
        operation.intentFingerprint !== input.intentFingerprint
        || operation.mutation !== input.mutation
        || operation.resourceFamilyId !== input.resourceFamilyId
        || operation.actorAccountId !== input.actorAccountId
        || operation.purpose !== input.purpose
        || operation.acknowledgedAt !== undefined
      ) {
        throw new Error('Archive pending operation acquisition resolved a conflicting durable identity');
      }
      return operation;
    });
  }

  public bindArchivePendingOperation(
    context: RepositoryExecutionContext,
    input: BindPlatformPolicyArchivePendingOperationInput
  ): RepositoryResult<PlatformPolicyArchivePendingOperationRecord | undefined> {
    return this.execute(context, () => {
      const database = this.database(context);
      const existingRow = database.prepare(ARCHIVE_PENDING_OPERATION_SELECT).get(input.operationId) as Record<string, unknown> | undefined;
      if (!existingRow) return undefined;
      const existing = mapArchivePendingOperation(existingRow);
      assertArchivePendingOperationBinding(context, input, existing);
      if (existing.boundOperationFingerprint === undefined) {
        const updated = database.prepare(`
          UPDATE platform_policy_archive_pending_operations
          SET bound_operation_fingerprint=?
          WHERE operation_id=? AND acknowledged_at IS NULL AND bound_operation_fingerprint IS NULL
        `).run(input.operationFingerprint, input.operationId);
        if (Number(updated.changes) !== 1) {
          throw new Error('Archive pending operation binding was not persisted');
        }
      }
      const row = database.prepare(ARCHIVE_PENDING_OPERATION_SELECT).get(input.operationId) as Record<string, unknown> | undefined;
      if (!row) throw new Error('Archive pending operation disappeared after binding');
      const operation = mapArchivePendingOperation(row);
      assertArchivePendingOperationBinding(context, input, operation);
      return operation;
    });
  }

  public acknowledgeArchivePendingOperation(
    context: RepositoryExecutionContext,
    input: PlatformPolicyArchivePendingOperationIdentityInput
  ): RepositoryResult<PlatformPolicyArchivePendingOperationRecord> {
    return this.execute(context, () => {
      assertArchivePendingOperationIdentity(context, input);
      assertIsoDate(context.occurredAt, 'Archive pending operation acknowledgement time');
      const database = this.database(context);
      const existingRow = database.prepare(ARCHIVE_PENDING_OPERATION_SELECT).get(input.operationId) as Record<string, unknown> | undefined;
      if (!existingRow) throw new Error('Archive pending operation acknowledgement target was not found');
      const existing = mapArchivePendingOperation(existingRow);
      assertArchivePendingOperationMatches(input, existing);
      if (existing.acknowledgedAt) return existing;

      const committedRow = database.prepare(`
        SELECT operation_fingerprint,family_id,actor_account_id,purpose
        FROM platform_policy_archive_operations WHERE operation_id=?
      `).get(input.operationId) as Record<string, unknown> | undefined;
      let acknowledgementKind: 'completed' | 'cancelled';
      if (existing.boundOperationFingerprint !== undefined) {
        if (
          !committedRow
          || String(committedRow.operation_fingerprint) !== existing.boundOperationFingerprint
          || String(committedRow.family_id) !== input.resourceFamilyId
          || String(committedRow.actor_account_id) !== input.actorAccountId
          || String(committedRow.purpose) !== input.purpose
        ) {
          throw new Error('Bound archive pending operation cannot be acknowledged without its committed result');
        }
        acknowledgementKind = 'completed';
      } else {
        if (committedRow) {
          throw new Error('Committed archive operation cannot be acknowledged without a pending-operation binding');
        }
        acknowledgementKind = 'cancelled';
      }
      const updated = database.prepare(`
        UPDATE platform_policy_archive_pending_operations
        SET acknowledged_at=?,acknowledgement_kind=?
        WHERE operation_id=? AND acknowledged_at IS NULL
      `).run(context.occurredAt, acknowledgementKind, input.operationId);
      if (Number(updated.changes) !== 1) {
        throw new Error('Archive pending operation acknowledgement was not persisted');
      }
      const row = database.prepare(ARCHIVE_PENDING_OPERATION_SELECT).get(input.operationId) as Record<string, unknown> | undefined;
      if (!row) throw new Error('Archive pending operation disappeared after acknowledgement');
      const operation = mapArchivePendingOperation(row);
      assertArchivePendingOperationMatches(input, operation);
      if (!operation.acknowledgedAt || operation.acknowledgementKind !== acknowledgementKind) {
        throw new Error('Archive pending operation acknowledgement is incomplete');
      }
      return operation;
    });
  }

  public findArchivePendingOperation(
    context: RepositoryExecutionContext,
    operationId: string
  ): RepositoryResult<PlatformPolicyArchivePendingOperationRecord | undefined> {
    return this.execute(context, () => {
      if (!OPERATION_ID.test(operationId)) throw new Error('Archive pending operation identifier is invalid');
      const row = this.database(context).prepare(ARCHIVE_PENDING_OPERATION_SELECT).get(operationId) as Record<string, unknown> | undefined;
      if (!row) return undefined;
      const operation = mapArchivePendingOperation(row);
      if (operation.actorAccountId !== context.actor.userId) {
        throw new Error('Archive pending operation does not belong to the repository actor');
      }
      return operation;
    });
  }

  public listPendingJournalProjections(
    context: RepositoryExecutionContext,
    limit = 100
  ): RepositoryResult<readonly PlatformPolicyJournalProjection[]> {
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT receipt_hash,record_json,status,created_at,projected_at
        FROM platform_policy_journal_projection_outbox
        WHERE status='pending'
        ORDER BY created_at,receipt_hash
        LIMIT ?
      `).all(Math.max(1, Math.min(limit, 500))) as ReadonlyArray<Record<string, unknown>>
    ).map(mapProjection));
  }

  public acknowledgeJournalProjection(
    context: RepositoryExecutionContext,
    input: AcknowledgePlatformPolicyJournalProjectionInput
  ): RepositoryResult<boolean> {
    return this.execute(context, () => {
      if (!SHA256.test(input.receiptHash)) throw new Error('Platform policy receipt hash is invalid');
      assertIsoDate(input.projectedAt, 'Platform policy journal projection time');
      const receipt = this.database(context).prepare(`
        SELECT nonce,record_json
        FROM platform_policy_transaction_receipts
        WHERE receipt_hash=?
      `).get(input.receiptHash) as { nonce: string; record_json: string } | undefined;
      if (!receipt) throw new Error('Platform policy journal projection receipt is missing');
      const record = JSON.parse(receipt.record_json) as PlatformPolicyReceiptRecord;
      assertProjectionProof(input.proof, input.receiptHash, receipt.nonce, record);
      const result = this.database(context).prepare(`
        UPDATE platform_policy_journal_projection_outbox
        SET status='projected',projected_at=?,
          proof_schema_version=?,proof_receipt_hash=?,proof_record_hash=?,proof_receipt_nonce=?,
          proof_entry_sequence=?,proof_entry_hash=?,proof_head_sequence=?,proof_head_hash=?,
          proof_journal_size_bytes=?,proof_issued_at=?,proof_mac=?
        WHERE receipt_hash=? AND status='pending'
      `).run(
        input.projectedAt,
        input.proof.schemaVersion,
        input.proof.receiptHash,
        input.proof.recordHash,
        input.proof.receiptNonce,
        input.proof.entrySequence,
        input.proof.entryHash,
        input.proof.headSequence,
        input.proof.headHash,
        input.proof.journalSizeBytes,
        input.proof.issuedAt,
        input.proof.proofMac,
        input.receiptHash
      );
      if (Number(result.changes) !== 1) return false;
      this.database(context).prepare(`
        INSERT INTO platform_policy_journal_anchors(
          anchor_name,proof_schema_version,receipt_hash,record_hash,receipt_nonce,
          entry_sequence,entry_hash,head_sequence,head_hash,journal_size_bytes,
          proof_issued_at,proof_mac,anchored_at
        ) VALUES('archive-protected-receipt-journal',?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(anchor_name) DO UPDATE SET
          proof_schema_version=excluded.proof_schema_version,
          receipt_hash=excluded.receipt_hash,
          record_hash=excluded.record_hash,
          receipt_nonce=excluded.receipt_nonce,
          entry_sequence=excluded.entry_sequence,
          entry_hash=excluded.entry_hash,
          head_sequence=excluded.head_sequence,
          head_hash=excluded.head_hash,
          journal_size_bytes=excluded.journal_size_bytes,
          proof_issued_at=excluded.proof_issued_at,
          proof_mac=excluded.proof_mac,
          anchored_at=excluded.anchored_at
        WHERE excluded.head_sequence>platform_policy_journal_anchors.head_sequence
      `).run(
        input.proof.schemaVersion,
        input.proof.receiptHash,
        input.proof.recordHash,
        input.proof.receiptNonce,
        input.proof.entrySequence,
        input.proof.entryHash,
        input.proof.headSequence,
        input.proof.headHash,
        input.proof.journalSizeBytes,
        input.proof.issuedAt,
        input.proof.proofMac,
        input.projectedAt
      );
      return true;
    });
  }

  public readJournalAnchor(
    context: RepositoryExecutionContext
  ): RepositoryResult<PlatformPolicyJournalAnchor | undefined> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT * FROM platform_policy_journal_anchors
        WHERE anchor_name='archive-protected-receipt-journal'
      `).get() as Record<string, unknown> | undefined;
      return row ? mapJournalAnchor(row) : undefined;
    });
  }

  public findReceiptByHash(
    context: RepositoryExecutionContext,
    receiptHash: string
  ): RepositoryResult<PlatformPolicyTransactionReceiptRecord | undefined> {
    return this.execute(context, () => {
      if (!SHA256.test(receiptHash)) throw new Error('Platform policy receipt hash is invalid');
      const row = this.database(context).prepare(`
        SELECT * FROM platform_policy_transaction_receipts WHERE receipt_hash=?
      `).get(receiptHash) as Record<string, unknown> | undefined;
      return row ? mapReceipt(row) : undefined;
    });
  }

  public findReceiptByNonce(
    context: RepositoryExecutionContext,
    nonce: string
  ): RepositoryResult<PlatformPolicyTransactionReceiptRecord | undefined> {
    return this.execute(context, () => {
      assertNonEmpty(nonce, 'Platform policy receipt nonce', 256);
      const row = this.database(context).prepare(`
        SELECT * FROM platform_policy_transaction_receipts WHERE nonce=?
      `).get(nonce) as Record<string, unknown> | undefined;
      return row ? mapReceipt(row) : undefined;
    });
  }
}
