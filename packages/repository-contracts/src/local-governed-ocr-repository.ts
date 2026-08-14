import type {
  LocalGovernedOcrAggregateKey,
  LocalGovernedOcrJobView,
  LocalGovernedOcrMutationKind,
  LocalGovernedOcrResourceType,
  LocalGovernedOcrSettingsView
} from '@ppt/domain';
import type { IsoDateTime } from '@ppt/core';
import type { DerivedDataSourcePolicySnapshot } from '@ppt/platform-policy';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

/**
 * Internal metadata row. OCR text, source bytes, filesystem paths and cloud/network tokens
 * are deliberately absent; `sealedResultId` is an opaque main-process vault identifier.
 */
export interface LocalGovernedOcrJobRow extends LocalGovernedOcrJobView {
  /** Main-only two-phase run binding. It is never projected into renderer-safe job views. */
  readonly activeRunId?: string;
  readonly sealedResultId?: string;
  readonly stateFingerprint: string;
}

export interface LocalGovernedOcrSettingsRow extends LocalGovernedOcrSettingsView {
  readonly stateFingerprint: string;
}

export interface LocalGovernedOcrSourceRow {
  readonly key: LocalGovernedOcrAggregateKey;
  readonly resourceType: 'archive_item';
  readonly resourceId: string;
  readonly inputSha256: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sourcePolicy: DerivedDataSourcePolicySnapshot;
}

/**
 * Main-process-only opaque archive-vault locator. This is available only beneath the exact
 * `archive_item` + `archive.ocr` + `ocr_process` source receipt; it is never a renderer DTO.
 */
export interface LocalGovernedOcrArchiveVaultLocatorRow {
  readonly key: LocalGovernedOcrAggregateKey;
  readonly resourceType: 'archive_item';
  readonly resourceId: string;
  readonly storedName: string;
  readonly originalName: string;
  readonly inputSha256: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface LocalGovernedOcrConsentRow {
  readonly id: string;
  readonly key: LocalGovernedOcrAggregateKey;
  readonly purpose: 'sensitive_processing';
  readonly resourceType: 'archive_item';
  readonly resourceId: string;
  readonly status: 'granted';
  readonly startsAt: IsoDateTime;
  readonly endsAt?: IsoDateTime;
}

export type LocalGovernedOcrAuthorizationRevocationReason =
  | 'consent_revoked'
  | 'consent_expired'
  | 'permission_revoked';

/** Payload-free durable-work projection; the current job row remains the retry authority. */
export interface LocalGovernedOcrAuthorizationReconciliationCandidate {
  readonly jobId: string;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly reason: LocalGovernedOcrAuthorizationRevocationReason;
}

export interface LocalGovernedOcrCenterSnapshotRow {
  readonly settings: LocalGovernedOcrSettingsRow;
  readonly jobs: readonly LocalGovernedOcrJobRow[];
}

export interface LocalGovernedOcrMutationRow {
  readonly id: string;
  readonly key: LocalGovernedOcrAggregateKey;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly mutationKind: LocalGovernedOcrMutationKind;
  readonly resourceType: LocalGovernedOcrResourceType;
  readonly resourceId: string;
  readonly previousRevision: number;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly occurredAt: IsoDateTime;
}

/** One exact current-row transition sealed beneath a shared archive-source deletion receipt. */
export interface LocalGovernedOcrSourceDeletionItem {
  readonly previous: LocalGovernedOcrJobRow;
  readonly next: LocalGovernedOcrJobRow;
}

/**
 * Specialized PPK-019 batch. The repository must persist the batch mutation, an immutable item ledger
 * sealing each exact previous/next pair, and every current-row transition atomically beneath the
 * caller's exact archive delete receipt. Item-ledger identifiers and fingerprints are derived by the
 * repository from the batch identity plus each exact previous/next pair; callers cannot supply them.
 */
export interface LocalGovernedOcrSourceDeletionBatch {
  readonly sourceResourceType: 'archive_item';
  readonly sourceResourceId: string;
  readonly batchMutation: LocalGovernedOcrMutationRow & {
    readonly mutationKind: 'source_delete_propagate';
    readonly resourceType: 'local_ocr_job';
  };
  readonly items: readonly LocalGovernedOcrSourceDeletionItem[];
}

export interface LocalGovernedOcrPolicyResourceMetadata {
  readonly familyId: string;
  readonly accountId: string;
  readonly ownerPersonId: string;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly sensitivity: 'personal' | 'sensitive' | 'highly_sensitive';
  readonly sourceResourceType: 'archive_item' | null;
  readonly sourceResourceId: string | null;
  /** Exact opaque derived-result resource owned by a job; null for settings and archive sources. */
  readonly derivedResourceId: string | null;
}

export interface LocalGovernedOcrRepositoryPort {
  loadCenter(
    context: RepositoryExecutionContext,
    key: LocalGovernedOcrAggregateKey
  ): RepositoryResult<LocalGovernedOcrCenterSnapshotRow>;

  findJob(
    context: RepositoryExecutionContext,
    key: LocalGovernedOcrAggregateKey,
    jobId: string
  ): RepositoryResult<LocalGovernedOcrJobRow | null>;

  listJobsBySource(
    context: RepositoryExecutionContext,
    key: LocalGovernedOcrAggregateKey,
    resourceType: 'archive_item',
    resourceId: string
  ): RepositoryResult<readonly LocalGovernedOcrJobRow[]>;

  resolveArchiveSource(
    context: RepositoryExecutionContext,
    key: LocalGovernedOcrAggregateKey,
    resourceId: string
  ): RepositoryResult<LocalGovernedOcrSourceRow | null>;

  resolveAuthorizedArchiveVaultLocator(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: LocalGovernedOcrAggregateKey,
    resourceId: string
  ): RepositoryResult<LocalGovernedOcrArchiveVaultLocatorRow | null>;

  resolveActiveSensitiveProcessingConsent(
    context: RepositoryExecutionContext,
    key: LocalGovernedOcrAggregateKey,
    resourceType: 'archive_item',
    resourceId: string,
    at: string
  ): RepositoryResult<LocalGovernedOcrConsentRow | null>;

  /** Receiptless, actor-bound and payload-free pre-authorization maintenance lookup. */
  listAuthorizationReconciliationCandidates(
    context: RepositoryExecutionContext,
    key: LocalGovernedOcrAggregateKey,
    at: string,
    limit: number
  ): RepositoryResult<readonly LocalGovernedOcrAuthorizationReconciliationCandidate[]>;

  /** Revalidates the exact current denial beneath the job-delete receipt before tombstoning. */
  resolveAuthorizationRevocation(
    context: RepositoryExecutionContext,
    key: LocalGovernedOcrAggregateKey,
    jobId: string,
    at: string
  ): RepositoryResult<LocalGovernedOcrAuthorizationRevocationReason | null>;

  findMutationByClientOperationId(
    context: RepositoryExecutionContext,
    key: LocalGovernedOcrAggregateKey,
    clientOperationId: string
  ): RepositoryResult<LocalGovernedOcrMutationRow | null>;

  /** Authorized only beneath the exact archive-source delete receipt; never a generic job mutation lookup. */
  findSourceDeletionMutationByClientOperationId(
    context: RepositoryExecutionContext,
    key: LocalGovernedOcrAggregateKey,
    sourceResourceId: string,
    clientOperationId: string
  ): RepositoryResult<LocalGovernedOcrMutationRow | null>;

  insertJob(context: RepositoryExecutionContext, row: LocalGovernedOcrJobRow): RepositoryResult<void>;
  saveJob(
    context: RepositoryExecutionContext,
    row: LocalGovernedOcrJobRow,
    expectedRevision: number
  ): RepositoryResult<boolean>;
  saveSettings(
    context: RepositoryExecutionContext,
    row: LocalGovernedOcrSettingsRow,
    expectedRevision: number
  ): RepositoryResult<boolean>;
  insertMutation(context: RepositoryExecutionContext, row: LocalGovernedOcrMutationRow): RepositoryResult<void>;
  propagateSourceDeletion(
    context: RepositoryExecutionContext,
    batch: LocalGovernedOcrSourceDeletionBatch
  ): RepositoryResult<void>;

  /** Receiptless, payload-free lookup used only to construct the central PEP transaction intent. */
  resolvePolicyResource(
    context: RepositoryExecutionContext,
    key: LocalGovernedOcrAggregateKey,
    resourceType: LocalGovernedOcrResourceType,
    resourceId: string
  ): RepositoryResult<LocalGovernedOcrPolicyResourceMetadata | null>;

  /** Payload-free archive source metadata for the secondary central-PEP pre-authorization lookup. */
  resolveArchivePolicyResource(
    context: RepositoryExecutionContext,
    key: LocalGovernedOcrAggregateKey,
    resourceId: string
  ): RepositoryResult<LocalGovernedOcrPolicyResourceMetadata | null>;
}
