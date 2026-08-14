import type { FamilyId, IsoDateTime, PersonId, UserId } from '@ppt/core';

export const LOCAL_GOVERNED_OCR_MAX_JOBS = 500 as const;
export const LOCAL_GOVERNED_OCR_MAX_LANGUAGE_HINTS = 8 as const;
export const LOCAL_GOVERNED_OCR_MAX_SOURCE_BYTES = 16 * 1_024 * 1_024;
export const LOCAL_GOVERNED_OCR_MAX_RESULT_CHARACTERS = 250_000 as const;
export const LOCAL_GOVERNED_OCR_MAX_PAGES = 50 as const;

export interface LocalGovernedOcrAggregateKey {
  readonly familyId: FamilyId;
  readonly accountId: UserId;
  readonly ownerPersonId: PersonId;
}

export type LocalGovernedOcrJobStatus =
  | 'queued'
  | 'running'
  | 'cancel_requested'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'deleted';

export type LocalGovernedOcrFailureCode =
  | 'source_unavailable'
  | 'consent_unavailable'
  | 'engine_failed'
  | 'integrity_mismatch';

export interface LocalGovernedOcrSourceView {
  readonly resourceType: 'archive_item';
  readonly resourceId: string;
  readonly inputSha256: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface LocalGovernedOcrJobView {
  readonly id: string;
  readonly key: LocalGovernedOcrAggregateKey;
  readonly revision: number;
  readonly source: LocalGovernedOcrSourceView;
  readonly derivedResourceId: string;
  readonly languageHints: readonly string[];
  readonly status: LocalGovernedOcrJobStatus;
  readonly runAttempt: number;
  readonly correctionRevision: number;
  readonly resultAvailable: boolean;
  readonly resultContentSha256?: string;
  readonly resultCharacterCount?: number;
  readonly resultPageCount?: number;
  readonly confidenceBasisPoints?: number;
  readonly derivedBindingHash?: string;
  readonly consentId: string;
  readonly consentExpiresAt?: IsoDateTime;
  readonly retentionUntil?: IsoDateTime;
  readonly failureCode?: LocalGovernedOcrFailureCode;
  readonly cancellationRequestedAt?: IsoDateTime;
  readonly completedAt?: IsoDateTime;
  readonly failedAt?: IsoDateTime;
  readonly cancelledAt?: IsoDateTime;
  readonly deletedAt?: IsoDateTime;
  readonly sourceDeletedAt?: IsoDateTime;
  readonly deletionPropagation: 'active' | 'locally_deleted';
  readonly processor: 'local_ocr';
  readonly networkUsed: false;
  readonly cloudUsed: false;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface LocalGovernedOcrSettingsView {
  readonly key: LocalGovernedOcrAggregateKey;
  readonly revision: number;
  readonly enabled: boolean;
  readonly disabledReason?: string;
  readonly disabledAt?: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface LocalGovernedOcrTruthView {
  readonly executionScope: 'bounded_child_process';
  readonly lowPrivilegeSandboxVerified: false;
  readonly sourceBytesExposedToRenderer: false;
  readonly plaintextResultPersistedInRepository: false;
  readonly networkUsed: false;
  readonly cloudUsed: false;
  readonly providerDeliveryGuaranteed: false;
  readonly explicitSensitiveProcessingConsentRequired: true;
  readonly derivedPolicyBindingRequired: true;
  readonly sourceDeletionPropagatesToDerivedResult: true;
  readonly sourceDeletionAutoResumeGuaranteed: true;
  readonly authorizationRevocationPropagatesToSealedResult: true;
  readonly derivedDeletionDeletesSource: false;
}

export interface LocalGovernedOcrCenterView {
  readonly schemaVersion: 1;
  readonly key: LocalGovernedOcrAggregateKey;
  readonly settings: LocalGovernedOcrSettingsView;
  readonly jobs: readonly LocalGovernedOcrJobView[];
  readonly truth: LocalGovernedOcrTruthView;
  readonly generatedAt: IsoDateTime;
}

export interface LocalGovernedOcrResultView {
  readonly jobId: string;
  readonly revision: number;
  readonly text: string;
  readonly contentSha256: string;
  readonly corrected: boolean;
  readonly payloadSource: 'sealed_local_result';
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export type LocalGovernedOcrMutationKind =
  | 'job_create'
  | 'job_run_begin'
  | 'job_run'
  | 'job_cancel'
  | 'result_correct'
  | 'job_rerun'
  | 'job_delete'
  | 'authorization_revoke_propagate'
  | 'processing_disable'
  | 'processing_enable'
  | 'source_delete_propagate';

export type LocalGovernedOcrResourceType = 'local_ocr_job' | 'local_ocr_settings';

export interface LocalGovernedOcrMutationReceiptView {
  readonly clientOperationId: string;
  readonly mutationKind: LocalGovernedOcrMutationKind;
  readonly resourceType: LocalGovernedOcrResourceType;
  readonly resourceId: string;
  readonly previousRevision: number;
  readonly revision: number;
  readonly occurredAt: IsoDateTime;
  readonly stateFingerprint: string;
  readonly replayed: boolean;
  /** True only for a verified archive-source deletion propagation receipt. */
  readonly sourceResourceDeleted: boolean;
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export interface LocalGovernedOcrMutationIdentity {
  readonly expectedRevision: number;
  readonly clientOperationId: string;
}

export interface CreateLocalGovernedOcrJobInput extends LocalGovernedOcrMutationIdentity {
  readonly sourceResourceType: 'archive_item';
  readonly sourceResourceId: string;
  readonly languageHints: readonly string[];
}

export interface RunLocalGovernedOcrJobInput extends LocalGovernedOcrMutationIdentity {
  readonly jobId: string;
}

export interface CancelLocalGovernedOcrJobInput extends LocalGovernedOcrMutationIdentity {
  readonly jobId: string;
}

export interface CorrectLocalGovernedOcrResultInput extends LocalGovernedOcrMutationIdentity {
  readonly jobId: string;
  readonly correctedText: string;
}

export interface RerunLocalGovernedOcrJobInput extends LocalGovernedOcrMutationIdentity {
  readonly jobId: string;
  readonly languageHints?: readonly string[];
}

export interface DeleteLocalGovernedOcrJobInput extends LocalGovernedOcrMutationIdentity {
  readonly jobId: string;
  readonly reason: string;
}

export interface SetLocalGovernedOcrEnabledInput extends LocalGovernedOcrMutationIdentity {
  readonly enabled: boolean;
  readonly reason: string;
}

export interface PropagateLocalGovernedOcrSourceDeletionInput {
  readonly sourceResourceType: 'archive_item';
  readonly sourceResourceId: string;
  readonly purgedAt: IsoDateTime;
  readonly clientOperationId: string;
}

const canonicalKey = (key: LocalGovernedOcrAggregateKey) => ({
  familyId: key.familyId,
  accountId: key.accountId,
  ownerPersonId: key.ownerPersonId
});

/** Byte-exact semantic projection shared by application and repository implementations. */
export const canonicalLocalGovernedOcrJobStateJson = (row: LocalGovernedOcrJobView): string => JSON.stringify({
  id: row.id,
  key: canonicalKey(row.key),
  revision: row.revision,
  source: {
    resourceType: row.source.resourceType,
    resourceId: row.source.resourceId,
    inputSha256: row.source.inputSha256,
    mimeType: row.source.mimeType,
    sizeBytes: row.source.sizeBytes
  },
  derivedResourceId: row.derivedResourceId,
  languageHints: [...row.languageHints],
  status: row.status,
  runAttempt: row.runAttempt,
  correctionRevision: row.correctionRevision,
  resultAvailable: row.resultAvailable,
  resultContentSha256: row.resultContentSha256 ?? null,
  resultCharacterCount: row.resultCharacterCount ?? null,
  resultPageCount: row.resultPageCount ?? null,
  confidenceBasisPoints: row.confidenceBasisPoints ?? null,
  derivedBindingHash: row.derivedBindingHash ?? null,
  consentId: row.consentId,
  consentExpiresAt: row.consentExpiresAt ?? null,
  retentionUntil: row.retentionUntil ?? null,
  failureCode: row.failureCode ?? null,
  cancellationRequestedAt: row.cancellationRequestedAt ?? null,
  completedAt: row.completedAt ?? null,
  failedAt: row.failedAt ?? null,
  cancelledAt: row.cancelledAt ?? null,
  deletedAt: row.deletedAt ?? null,
  sourceDeletedAt: row.sourceDeletedAt ?? null,
  deletionPropagation: row.deletionPropagation,
  processor: row.processor,
  networkUsed: row.networkUsed,
  cloudUsed: row.cloudUsed,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

export const canonicalLocalGovernedOcrSettingsStateJson = (row: LocalGovernedOcrSettingsView): string => JSON.stringify({
  key: canonicalKey(row.key),
  revision: row.revision,
  enabled: row.enabled,
  disabledReason: row.disabledReason ?? null,
  disabledAt: row.disabledAt ?? null,
  updatedAt: row.updatedAt
});
