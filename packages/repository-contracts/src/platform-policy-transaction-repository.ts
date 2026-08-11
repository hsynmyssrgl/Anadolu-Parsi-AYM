import type { IsoDateTime } from '@ppt/core';
import type {
  PlatformDataClass,
  PlatformPolicyJournalProjectionProof,
  PlatformPolicyReceipt,
  PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

/**
 * A replay reservation is deliberately expressed with epoch milliseconds so
 * the repository can implement PlatformPolicyReplayStore without changing the
 * PEP reservation boundary.
 */
export interface PlatformPolicyReplayReservationInput {
  readonly nonce: string;
  readonly reservedAtMs: number;
  readonly expiresAtMs: number;
}

export interface PlatformPolicyReplayPruningInput {
  /** Local monotonic cutoff; only rows with expiresAtMs strictly below it qualify. */
  readonly cutoffMs: number;
  /** Bounded delete size so normal authorization traffic cannot perform unbounded maintenance. */
  readonly limit: number;
}

export interface PlatformPolicyReplayPruningResult {
  readonly cutoffMs: number;
  readonly prunedCount: number;
  readonly hasMore: boolean;
}

export interface SynchronizePlatformPolicyFenceInput {
  readonly fenceName: string;
  readonly epoch: number;
  readonly writable: boolean;
  readonly synchronizedAt: IsoDateTime;
}

export interface PlatformPolicyDatabaseFenceSnapshot {
  readonly fenceName: string;
  readonly epoch: number;
  readonly writable: boolean;
  readonly synchronizedAt: IsoDateTime;
}

export interface RecordPlatformPolicyTransactionInput {
  /** The complete journal record; the durable projection must reproduce it. */
  readonly record: PlatformPolicyReceiptRecord;
  readonly fenceName: string;
  readonly fenceEpoch: number;
  /** Archive mutations are never valid against a read-only fence. */
  readonly fenceWritable: true;
}

/**
 * Caller-stable identity for a governed archive mutation. The fingerprint is
 * independent of correlation, nonce and receipt identity so a caller can
 * safely retry after an unknown COMMIT outcome.
 */
export interface PlatformPolicyArchiveOperationIdentityInput {
  readonly operationId: string;
  readonly operationFingerprint: string;
  readonly resourceFamilyId: string;
  readonly actorAccountId: string;
  readonly purpose: 'archive';
}

export interface RecordPlatformPolicyArchiveOperationResultInput
  extends PlatformPolicyArchiveOperationIdentityInput {
  /** Canonical JSON envelope containing the successful application result. */
  readonly resultJson: string;
}

export interface PlatformPolicyArchiveOperationRecord
  extends PlatformPolicyArchiveOperationIdentityInput {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly action: PlatformPolicyReceiptRecord['action'];
  readonly capability: PlatformPolicyReceiptRecord['capability'];
  readonly originalReceiptHash: string;
  readonly originalCorrelationId: string;
  readonly resultJson: string;
  readonly resultHash: string;
  readonly completedAt: IsoDateTime;
  readonly retryCount: number;
}

export type PlatformPolicyArchiveOperationResolution =
  | Readonly<{ state: 'execute' }>
  | Readonly<{ state: 'replay'; operation: PlatformPolicyArchiveOperationRecord }>;

export type PlatformPolicyArchivePendingOperationMutation =
  | 'archive:import'
  | 'archive:open'
  | 'archive:secureDestroy'
  | 'archive:createRetentionPolicy'
  | 'archive:assignRetentionPolicy'
  | 'archive:createCategory'
  | 'archive:updateClassification';

/**
 * A durable renderer intent identity. It exists before the protected archive
 * transaction so the operation identifier survives renderer and application
 * restarts even when the previous response outcome is unknown.
 */
export interface PlatformPolicyArchivePendingOperationIdentityInput {
  readonly operationId: string;
  readonly intentFingerprint: string;
  readonly mutation: PlatformPolicyArchivePendingOperationMutation;
  readonly resourceFamilyId: string;
  readonly actorAccountId: string;
  readonly purpose: 'archive';
}

export interface BindPlatformPolicyArchivePendingOperationInput {
  readonly operationId: string;
  readonly operationFingerprint: string;
  readonly mutation: PlatformPolicyArchivePendingOperationMutation;
  readonly resourceFamilyId: string;
  readonly actorAccountId: string;
  readonly purpose: 'archive';
}

export interface PlatformPolicyArchivePendingOperationRecord
  extends PlatformPolicyArchivePendingOperationIdentityInput {
  readonly acquiredAt: IsoDateTime;
  readonly boundOperationFingerprint?: string;
  readonly acknowledgedAt?: IsoDateTime;
  readonly acknowledgementKind?: 'completed' | 'cancelled';
}

export interface PlatformPolicyTransactionReceiptRecord {
  readonly receiptHash: string;
  readonly receiptVersion: 1;
  readonly requestHash: string;
  /** Absent only on historical rows created before migration 69. */
  readonly contextHash?: string;
  /** Absent only on historical rows created before migration 70. */
  readonly dataClasses?: readonly PlatformDataClass[];
  /** Absent only on historical rows created before migration 71. */
  readonly obligationExecutionHash?: string;
  readonly nonce: string;
  readonly correlationId: string;
  readonly policyVersion: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly action: PlatformPolicyReceiptRecord['action'];
  readonly capability: PlatformPolicyReceiptRecord['capability'];
  readonly fenceName: string;
  readonly fenceEpoch: number;
  readonly issuedAt: IsoDateTime;
  readonly recordedAt: IsoDateTime;
  readonly record: PlatformPolicyReceiptRecord;
}

export interface PlatformPolicyJournalProjection {
  readonly receiptHash: string;
  readonly record: PlatformPolicyReceiptRecord;
  readonly status: 'pending' | 'projected';
  readonly createdAt: IsoDateTime;
  readonly projectedAt?: IsoDateTime;
}

export interface AcknowledgePlatformPolicyJournalProjectionInput {
  readonly receiptHash: string;
  readonly projectedAt: IsoDateTime;
  readonly proof: PlatformPolicyJournalProjectionProof;
}

export interface PlatformPolicyJournalAnchor {
  readonly anchorName: 'archive-protected-receipt-journal';
  readonly proof: PlatformPolicyJournalProjectionProof;
  readonly anchoredAt: IsoDateTime;
}

export interface PlatformPolicyTransactionRepositoryPort {
  reserveReplayNonce(
    context: RepositoryExecutionContext,
    input: PlatformPolicyReplayReservationInput
  ): RepositoryResult<boolean>;

  pruneExpiredUnusedReplayReservations(
    context: RepositoryExecutionContext,
    input: PlatformPolicyReplayPruningInput
  ): RepositoryResult<PlatformPolicyReplayPruningResult>;

  synchronizeFence(
    context: RepositoryExecutionContext,
    input: SynchronizePlatformPolicyFenceInput
  ): RepositoryResult<PlatformPolicyDatabaseFenceSnapshot>;

  readFence(
    context: RepositoryExecutionContext,
    fenceName: string
  ): RepositoryResult<PlatformPolicyDatabaseFenceSnapshot | undefined>;

  /**
   * Must be called inside the same SQLite transaction as the protected
   * business mutation, audit append and event-outbox append.
   */
  recordAuthorizedTransaction(
    context: PolicyAuthorizedRepositoryExecutionContext,
    input: RecordPlatformPolicyTransactionInput
  ): RepositoryResult<PlatformPolicyTransactionReceiptRecord>;

  /**
   * Resolves an operation inside the protected SQLite transaction after the
   * current receipt has been recorded. A matching committed operation records
   * the current receipt as an immutable retry and returns its original result.
   */
  resolveArchiveOperation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    input: PlatformPolicyArchiveOperationIdentityInput
  ): RepositoryResult<PlatformPolicyArchiveOperationResolution>;

  /** Persists the first successful result atomically with its business write. */
  recordArchiveOperationResult(
    context: PolicyAuthorizedRepositoryExecutionContext,
    input: RecordPlatformPolicyArchiveOperationResultInput
  ): RepositoryResult<PlatformPolicyArchiveOperationRecord>;

  findArchiveOperation(
    context: RepositoryExecutionContext,
    operationId: string
  ): RepositoryResult<PlatformPolicyArchiveOperationRecord | undefined>;

  /**
   * Creates or recovers the single unacknowledged identity for a canonical
   * renderer intent. Concurrent candidates resolve to the same durable row.
   */
  acquireArchivePendingOperation(
    context: RepositoryExecutionContext,
    input: PlatformPolicyArchivePendingOperationIdentityInput
  ): RepositoryResult<PlatformPolicyArchivePendingOperationRecord>;

  /** Binds a recovered renderer intent to the final 30-T operation hash. */
  bindArchivePendingOperation(
    context: RepositoryExecutionContext,
    input: BindPlatformPolicyArchivePendingOperationInput
  ): RepositoryResult<PlatformPolicyArchivePendingOperationRecord | undefined>;

  /**
   * Seals the identity after the caller observes a successful transport
   * result, or after a side-effect-free cancellation.
   */
  acknowledgeArchivePendingOperation(
    context: RepositoryExecutionContext,
    input: PlatformPolicyArchivePendingOperationIdentityInput
  ): RepositoryResult<PlatformPolicyArchivePendingOperationRecord>;

  findArchivePendingOperation(
    context: RepositoryExecutionContext,
    operationId: string
  ): RepositoryResult<PlatformPolicyArchivePendingOperationRecord | undefined>;

  listPendingJournalProjections(
    context: RepositoryExecutionContext,
    limit?: number
  ): RepositoryResult<readonly PlatformPolicyJournalProjection[]>;

  acknowledgeJournalProjection(
    context: RepositoryExecutionContext,
    input: AcknowledgePlatformPolicyJournalProjectionInput
  ): RepositoryResult<boolean>;

  readJournalAnchor(
    context: RepositoryExecutionContext
  ): RepositoryResult<PlatformPolicyJournalAnchor | undefined>;

  findReceiptByHash(
    context: RepositoryExecutionContext,
    receiptHash: string
  ): RepositoryResult<PlatformPolicyTransactionReceiptRecord | undefined>;

  findReceiptByNonce(
    context: RepositoryExecutionContext,
    nonce: string
  ): RepositoryResult<PlatformPolicyTransactionReceiptRecord | undefined>;
}

export type {
  PlatformPolicyJournalProjectionProof,
  PlatformPolicyReceipt,
  PlatformPolicyReceiptRecord
};
