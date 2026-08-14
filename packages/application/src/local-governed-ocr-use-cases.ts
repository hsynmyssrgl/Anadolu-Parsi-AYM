import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  asCorrelationId,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type EventId,
  type FamilyId,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import {
  LOCAL_GOVERNED_OCR_MAX_JOBS,
  LOCAL_GOVERNED_OCR_MAX_LANGUAGE_HINTS,
  LOCAL_GOVERNED_OCR_MAX_PAGES,
  LOCAL_GOVERNED_OCR_MAX_RESULT_CHARACTERS,
  LOCAL_GOVERNED_OCR_MAX_SEARCH_CANDIDATES,
  LOCAL_GOVERNED_OCR_MAX_SEARCH_MATCHES,
  LOCAL_GOVERNED_OCR_MAX_SEARCH_SNIPPET_CHARACTERS,
  LOCAL_GOVERNED_OCR_MAX_SOURCE_BYTES,
  canonicalLocalGovernedOcrSearchTokens,
  canonicalLocalGovernedOcrJobStateJson,
  canonicalLocalGovernedOcrSettingsStateJson,
  type CancelLocalGovernedOcrJobInput,
  type CorrectLocalGovernedOcrResultInput,
  type CreateLocalGovernedOcrJobInput,
  type DeleteLocalGovernedOcrJobInput,
  type FamilyRole,
  type LocalGovernedOcrAggregateKey,
  type LocalGovernedOcrCenterView,
  type LocalGovernedOcrFailureCode,
  type LocalGovernedOcrJobView,
  type LocalGovernedOcrMutationKind,
  type LocalGovernedOcrMutationReceiptView,
  type LocalGovernedOcrResourceType,
  type LocalGovernedOcrResultView,
  type LocalGovernedOcrSearchMatchView,
  type LocalGovernedOcrSearchView,
  type LocalGovernedOcrSettingsView,
  type PropagateLocalGovernedOcrSourceDeletionInput,
  type RerunLocalGovernedOcrJobInput,
  type RunLocalGovernedOcrJobInput,
  type SearchLocalGovernedOcrInput,
  type SetLocalGovernedOcrEnabledInput
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import {
  DerivedDataInheritancePolicy,
  type DerivedDataPolicyBinding,
  type DerivedDataTargetPolicy
} from '@ppt/platform-policy';
import type {
  LocalGovernedOcrAuthorizationReconciliationCandidate,
  LocalGovernedOcrAuthorizationRevocationReason,
  LocalGovernedOcrCenterSnapshotRow,
  LocalGovernedOcrConsentRow,
  LocalGovernedOcrJobRow,
  LocalGovernedOcrMutationRow,
  LocalGovernedOcrPolicyResourceMetadata,
  LocalGovernedOcrRetentionReconciliationCandidate,
  LocalGovernedOcrSettingsRow,
  LocalGovernedOcrSourceRow,
  LocalGovernedOcrSourceDeletionBatch
} from '@ppt/repository-contracts';

export interface LocalGovernedOcrApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: {
    readonly userId: UserId;
    readonly role: FamilyRole;
    readonly personId?: PersonId;
  };
  readonly correlationId: CorrelationId;
}

export interface LocalGovernedOcrPolicyIntent {
  readonly action: 'read' | 'process' | 'update' | 'delete';
  readonly capability: 'archive.ocr' | 'archive.write' | 'family.read' | 'family.write';
  readonly resourceType: LocalGovernedOcrResourceType | 'archive_item' | 'local_ocr_result';
  readonly resourceId: string;
  readonly purpose: 'ocr_process' | 'administration';
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly privacy: 'private';
  readonly sensitivity: 'personal' | 'sensitive' | 'highly_sensitive';
}

export interface LocalGovernedOcrAuthorizationPlan {
  readonly primary: LocalGovernedOcrPolicyIntent;
  /** A distinct current receipt; an archive create receipt must never be reused as PPK-016 source evidence. */
  readonly source?: LocalGovernedOcrPolicyIntent & {
    readonly resourceType: 'archive_item';
    readonly capability: 'archive.ocr';
    readonly action: 'read' | 'process';
    readonly purpose: 'ocr_process';
  };
  /** Exact owner-scoped settings read used only for enablement/quota guards. */
  readonly settings?: LocalGovernedOcrPolicyIntent & {
    readonly resourceType: 'local_ocr_settings';
    readonly capability: 'family.read';
    readonly action: 'read';
    readonly purpose: 'administration';
  };
  /** A distinct producer receipt for the PPK-016 derived target. */
  readonly target?: LocalGovernedOcrPolicyIntent & {
    readonly resourceType: 'local_ocr_result';
    readonly capability: 'archive.ocr';
    readonly action: 'process';
    readonly purpose: 'ocr_process';
    readonly sourceJobId: string;
  };
}

export interface LocalGovernedOcrWriteScope {
  readonly occurredAt: IsoDateTime;
  loadCenter(key: LocalGovernedOcrAggregateKey): Result<LocalGovernedOcrCenterSnapshotRow, AppError>;
  findJob(key: LocalGovernedOcrAggregateKey, jobId: string): Result<LocalGovernedOcrJobRow | null, AppError>;
  listJobsBySource(
    key: LocalGovernedOcrAggregateKey,
    resourceType: 'archive_item',
    resourceId: string
  ): Result<readonly LocalGovernedOcrJobRow[], AppError>;
  /** Must be backed by the active `authorization.source` receipt from this same transaction. */
  resolveArchiveSource(key: LocalGovernedOcrAggregateKey, resourceId: string): Result<LocalGovernedOcrSourceRow | null, AppError>;
  resolveActiveSensitiveProcessingConsent(
    key: LocalGovernedOcrAggregateKey,
    resourceType: 'archive_item',
    resourceId: string,
    at: IsoDateTime
  ): Result<LocalGovernedOcrConsentRow | null, AppError>;
  resolveAuthorizationRevocation(
    key: LocalGovernedOcrAggregateKey,
    jobId: string,
    at: IsoDateTime
  ): Result<LocalGovernedOcrAuthorizationRevocationReason | null, AppError>;
  resolveRetentionExpiry(
    key: LocalGovernedOcrAggregateKey,
    jobId: string,
    at: IsoDateTime
  ): Result<IsoDateTime | null, AppError>;
  findMutationByClientOperationId(
    key: LocalGovernedOcrAggregateKey,
    clientOperationId: string
  ): Result<LocalGovernedOcrMutationRow | null, AppError>;
  /** Exact archive-delete-receipt lookup; generic local-job mutation lookup is deliberately not reused. */
  findSourceDeletionMutationByClientOperationId(
    key: LocalGovernedOcrAggregateKey,
    sourceResourceId: string,
    clientOperationId: string
  ): Result<LocalGovernedOcrMutationRow | null, AppError>;
  insertJob(row: LocalGovernedOcrJobRow): Result<void, AppError>;
  saveJob(row: LocalGovernedOcrJobRow, expectedRevision: number): Result<boolean, AppError>;
  saveSettings(row: LocalGovernedOcrSettingsRow, expectedRevision: number): Result<boolean, AppError>;
  insertMutation(row: LocalGovernedOcrMutationRow): Result<void, AppError>;
  /** Atomically persists the batch ledger, per-item ledgers and all exact current-row transitions. */
  propagateSourceDeletion(batch: LocalGovernedOcrSourceDeletionBatch): Result<void, AppError>;
  /** Composed only with the single PPK-016 authorized derived-data repository adapter. */
  insertDerivedBinding(binding: DerivedDataPolicyBinding): Result<void, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: LocalGovernedOcrResourceType | 'archive_item';
    readonly resourceId: string;
    readonly occurredAt: IsoDateTime;
    readonly actorId: UserId;
  }): Result<string, AppError>;
  enqueueEvent<T>(event: DomainEvent<T>): Result<void, AppError>;
}

export interface LocalGovernedOcrUnitOfWork {
  /** Receiptless and payload-free; used only to resolve an exact source intent before authorization. */
  resolvePolicyResource(
    context: LocalGovernedOcrApplicationContext,
    key: LocalGovernedOcrAggregateKey,
    resourceType: LocalGovernedOcrResourceType,
    resourceId: string
  ): Result<LocalGovernedOcrPolicyResourceMetadata | null, AppError>;
  /** Receiptless and payload-free archive lookup used only to construct exact central-PEP intents. */
  resolveArchivePolicyResource(
    context: LocalGovernedOcrApplicationContext,
    key: LocalGovernedOcrAggregateKey,
    resourceId: string
  ): Result<LocalGovernedOcrPolicyResourceMetadata | null, AppError>;
  /** Actor-bound, payload-free work discovery; the current job row is the durable retry queue. */
  listAuthorizationReconciliationCandidates(
    context: LocalGovernedOcrApplicationContext,
    key: LocalGovernedOcrAggregateKey,
    limit: number
  ): Result<readonly LocalGovernedOcrAuthorizationReconciliationCandidate[], AppError>;
  /** Actor-bound, payload-free retention discovery; current rows are the durable retry queue. */
  listRetentionReconciliationCandidates(
    context: LocalGovernedOcrApplicationContext,
    key: LocalGovernedOcrAggregateKey,
    limit: number
  ): Result<readonly LocalGovernedOcrRetentionReconciliationCandidate[], AppError>;
  /** Every supplied intent is authorized by the central PEP before the shared transaction callback runs. */
  execute<T>(
    context: LocalGovernedOcrApplicationContext,
    authorization: LocalGovernedOcrAuthorizationPlan,
    operation: (scope: LocalGovernedOcrWriteScope) => Result<T, AppError> | Promise<Result<T, AppError>>
  ): Promise<Result<T, AppError>>;
  /**
   * Commits a short authorization/write phase, then runs the supplied callback with a bounded,
   * main-only source authority lease after the database transaction has closed.
   */
  executeDetached<TPrepared, TResult>(
    context: LocalGovernedOcrApplicationContext,
    authorization: LocalGovernedOcrAuthorizationPlan,
    runtimeAuthority: (prepared: TPrepared) => {
      readonly operation: 'run';
      readonly runId: string;
      readonly jobId: string;
      readonly derivedResourceId: string;
      readonly sourceResourceId: string;
      readonly expectedInputSha256: string;
    },
    prepare: (scope: LocalGovernedOcrWriteScope) => Result<TPrepared, AppError> | Promise<Result<TPrepared, AppError>>,
    operation: (prepared: TPrepared) => Promise<Result<TResult, AppError>>
  ): Promise<Result<TResult, AppError>>;
  /**
   * Commits a short, owner-scoped settings maintenance receipt before exposing a bounded main-only
   * authority lease. The lease is revoked in every completion and failure path.
   */
  executeMaintenance<TResult>(
    context: LocalGovernedOcrApplicationContext,
    authorization: LocalGovernedOcrAuthorizationPlan,
    prepare: (scope: LocalGovernedOcrWriteScope) => Result<void, AppError> | Promise<Result<void, AppError>>,
    operation: () => Promise<Result<TResult, AppError>>
  ): Promise<Result<TResult, AppError>>;
}

export interface LocalGovernedOcrSealedResult {
  readonly sealedResultId: string;
  readonly inputSha256: string;
  readonly contentSha256: string;
  readonly characterCount: number;
  readonly pageCount: number;
  readonly confidenceBasisPoints?: number;
  readonly completedAt: IsoDateTime;
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export type LocalGovernedOcrRunOutcome =
  | ({ readonly status: 'completed' } & LocalGovernedOcrSealedResult)
  | { readonly status: 'cancelled'; readonly cancelledAt: IsoDateTime; readonly networkUsed: false; readonly cloudUsed: false }
  | { readonly status: 'failed'; readonly failedAt: IsoDateTime; readonly failureCode: LocalGovernedOcrFailureCode;
      readonly networkUsed: false; readonly cloudUsed: false };

/**
 * Main-authorized local child/worker boundary. Implementations resolve and consume source bytes privately;
 * bytes, paths and plaintext results never enter repository rows, audit events or outbox payloads.
 */
export interface LocalGovernedOcrRuntimePort {
  runAndSeal(input: {
    readonly runId: string;
    readonly jobId: string;
    readonly derivedResourceId: string;
    readonly sourceResourceType: 'archive_item';
    readonly sourceResourceId: string;
    readonly expectedInputSha256: string;
    readonly languageHints: readonly string[];
    readonly correlationId: CorrelationId;
  }): Promise<Result<LocalGovernedOcrRunOutcome, AppError>>;
  correctAndSeal(input: {
    readonly jobId: string;
    readonly previousSealedResultId: string;
    readonly expectedInputSha256: string;
    readonly correctedText: string;
    readonly correlationId: CorrelationId;
  }): Promise<Result<LocalGovernedOcrSealedResult, AppError>>;
  readSealedResult(input: {
    readonly jobId: string;
    readonly sealedResultId: string;
    readonly correlationId: CorrelationId;
  }): Promise<Result<{ readonly text: string; readonly contentSha256: string; readonly networkUsed: false; readonly cloudUsed: false }, AppError>>;
  searchSealedResult(input: {
    readonly jobId: string;
    readonly sealedResultId: string;
    readonly query: string;
    readonly correlationId: CorrelationId;
  }): Promise<Result<{
    readonly matched: boolean;
    readonly matchedTokenCount: number;
    readonly contentSha256: string;
    readonly snippet: string | null;
    readonly snippetMasked: true;
    readonly pageNumber: number | null;
    readonly networkUsed: false;
    readonly cloudUsed: false;
  }, AppError>>;
  requestCancellation(input: { readonly jobId: string; readonly correlationId: CorrelationId }): Promise<Result<{ readonly accepted: true }, AppError>>;
  /**
   * Idempotent owner-bound local logical/file removal. `verified` proves the exact sealed result is absent;
   * it never claims physical medium erasure or recovery resistance.
   */
  purgeSealedResult(input: {
    readonly jobId: string;
    readonly sealedResultId: string;
    readonly correlationId: CorrelationId;
  }): Promise<Result<{ readonly deleted: true; readonly verified: true }, AppError>>;
  sweepOrphans(input: {
    readonly correlationId: CorrelationId;
    readonly maximumCandidates?: number;
  }): Promise<Result<LocalGovernedOcrOrphanSweepResult, AppError>>;
}

export interface LocalGovernedOcrOrphanSweepResult {
  readonly scanned: number;
  readonly deleted: number;
  readonly referenced: number;
  readonly rejected: number;
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export interface LocalGovernedOcrOperationIdentifiers {
  readonly mutationId: string;
  readonly resourceId: string;
  readonly requestFingerprint: string;
  readonly auditId: string;
  readonly outboxEventId: EventId;
}

const SHA256 = /^[0-9a-f]{64}$/u;
const IDENTIFIER = /^[A-Za-z0-9._:-]{8,160}$/u;
const LANGUAGE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})?$/u;
const MIME = /^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,127}$/u;
const hash = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const sourceDeletionStateFingerprint = (rows: readonly LocalGovernedOcrJobRow[]): string => hash(JSON.stringify(
  rows.map((row) => ({ id: row.id, revision: row.revision, stateFingerprint: row.stateFingerprint }))
    .sort((left, right) => left.id.localeCompare(right.id))
));
const nonEmpty = (value: unknown, maximum = 256): value is string => typeof value === 'string'
  && value === value.trim() && value.length > 0 && value.length <= maximum;
const validTime = (value: unknown): value is IsoDateTime => typeof value === 'string' && Number.isFinite(Date.parse(value));
const validRevision = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) < 2_147_483_647;
const exactKey = (left: LocalGovernedOcrAggregateKey, right: LocalGovernedOcrAggregateKey): boolean =>
  left.familyId === right.familyId && left.accountId === right.accountId && left.ownerPersonId === right.ownerPersonId;

const applicationError = (
  context: LocalGovernedOcrApplicationContext,
  code: typeof ERROR_CODES.CORE_INVALID_ARGUMENT | typeof ERROR_CODES.AUTHORIZATION_DENIED
    | typeof ERROR_CODES.RESOURCE_CONFLICT | typeof ERROR_CODES.RESOURCE_NOT_FOUND | typeof ERROR_CODES.CORE_UNEXPECTED,
  category: 'validation' | 'authorization' | 'conflict' | 'not_found' | 'unexpected',
  message: string
): AppError => createAppError({ code, category, message, correlationId: context.correlationId });
const invalid = (context: LocalGovernedOcrApplicationContext, message: string) =>
  applicationError(context, ERROR_CODES.CORE_INVALID_ARGUMENT, 'validation', message);
const denied = (context: LocalGovernedOcrApplicationContext, message: string) =>
  applicationError(context, ERROR_CODES.AUTHORIZATION_DENIED, 'authorization', message);
const conflict = (context: LocalGovernedOcrApplicationContext, message: string) =>
  applicationError(context, ERROR_CODES.RESOURCE_CONFLICT, 'conflict', message);
const missing = (context: LocalGovernedOcrApplicationContext, message: string) =>
  applicationError(context, ERROR_CODES.RESOURCE_NOT_FOUND, 'not_found', message);
const unexpected = (context: LocalGovernedOcrApplicationContext, message: string) =>
  applicationError(context, ERROR_CODES.CORE_UNEXPECTED, 'unexpected', message);

const keyFor = (context: LocalGovernedOcrApplicationContext): Result<LocalGovernedOcrAggregateKey, AppError> =>
  context.actor.personId
    ? ok({ familyId: context.familyId, accountId: context.actor.userId, ownerPersonId: context.actor.personId })
    : err(denied(context, 'Yerel OCR merkezi için kişi bağlı hesap gerekir.'));

export const localGovernedOcrSettingsResourceId = (ownerPersonId: PersonId): string =>
  `local-ocr-settings:${ownerPersonId}`;

const jobIntent = (
  key: LocalGovernedOcrAggregateKey,
  action: 'read' | 'process' | 'delete',
  resourceId: string,
  sensitivity: LocalGovernedOcrPolicyIntent['sensitivity']
): LocalGovernedOcrPolicyIntent => ({
  action,
  capability: action === 'delete' ? 'archive.write' : 'archive.ocr',
  resourceType: 'local_ocr_job',
  resourceId,
  purpose: 'ocr_process',
  familyId: key.familyId,
  ownerPersonId: key.ownerPersonId,
  privacy: 'private',
  sensitivity
});

const settingsIntent = (key: LocalGovernedOcrAggregateKey, action: 'read' | 'update'): LocalGovernedOcrPolicyIntent => ({
  action,
  capability: action === 'read' ? 'family.read' : 'family.write',
  resourceType: 'local_ocr_settings',
  resourceId: localGovernedOcrSettingsResourceId(key.ownerPersonId),
  purpose: 'administration',
  familyId: key.familyId,
  ownerPersonId: key.ownerPersonId,
  privacy: 'private',
  sensitivity: 'personal'
});

const settingsReadIntent = (
  key: LocalGovernedOcrAggregateKey
): NonNullable<LocalGovernedOcrAuthorizationPlan['settings']> => ({
  ...settingsIntent(key, 'read'),
  action: 'read',
  capability: 'family.read',
  resourceType: 'local_ocr_settings',
  purpose: 'administration'
});

const sourceIntent = (
  key: LocalGovernedOcrAggregateKey,
  action: 'read' | 'process',
  resourceId: string,
  sensitivity: LocalGovernedOcrPolicyIntent['sensitivity']
): NonNullable<LocalGovernedOcrAuthorizationPlan['source']> => ({
  action,
  capability: 'archive.ocr',
  resourceType: 'archive_item',
  resourceId,
  purpose: 'ocr_process',
  familyId: key.familyId,
  ownerPersonId: key.ownerPersonId,
  privacy: 'private',
  sensitivity
});

const targetIntent = (
  key: LocalGovernedOcrAggregateKey,
  sourceJobId: string,
  resourceId: string,
  sensitivity: LocalGovernedOcrPolicyIntent['sensitivity']
): NonNullable<LocalGovernedOcrAuthorizationPlan['target']> => ({
  action: 'process',
  capability: 'archive.ocr',
  resourceType: 'local_ocr_result',
  resourceId,
  sourceJobId,
  purpose: 'ocr_process',
  familyId: key.familyId,
  ownerPersonId: key.ownerPersonId,
  privacy: 'private',
  sensitivity
});

const normalizeLanguages = (value: readonly string[]): readonly string[] | null => {
  if (!Array.isArray(value) || value.length > LOCAL_GOVERNED_OCR_MAX_LANGUAGE_HINTS) return null;
  const normalized = [...new Set(value.map((item) => item.trim()))].sort();
  return normalized.every((item) => LANGUAGE.test(item)) ? Object.freeze(normalized) : null;
};

const identifiersValid = (value: LocalGovernedOcrOperationIdentifiers): boolean =>
  [value.mutationId, value.resourceId, value.auditId, value.outboxEventId].every((item) => IDENTIFIER.test(item))
  && SHA256.test(value.requestFingerprint);

const jobView = (row: LocalGovernedOcrJobRow): LocalGovernedOcrJobView => {
  const { sealedResultId: _sealed, stateFingerprint: _fingerprint, activeRunId: _activeRunId, ...view } = row;
  return view;
};
const settingsView = (row: LocalGovernedOcrSettingsRow): LocalGovernedOcrSettingsView => {
  const { stateFingerprint: _fingerprint, ...view } = row;
  return view;
};
const jobRow = (
  view: LocalGovernedOcrJobView,
  sealedResultId?: string,
  activeRunId?: string
): LocalGovernedOcrJobRow => ({
  ...view,
  ...(activeRunId === undefined ? {} : { activeRunId }),
  ...(sealedResultId === undefined ? {} : { sealedResultId }),
  stateFingerprint: hash(activeRunId === undefined
    ? canonicalLocalGovernedOcrJobStateJson(view)
    : JSON.stringify({ state: JSON.parse(canonicalLocalGovernedOcrJobStateJson(view)), activeRunId }))
});
const settingsRow = (view: LocalGovernedOcrSettingsView): LocalGovernedOcrSettingsRow => ({
  ...view,
  stateFingerprint: hash(canonicalLocalGovernedOcrSettingsStateJson(view))
});

const validSource = (
  source: LocalGovernedOcrSourceRow,
  key: LocalGovernedOcrAggregateKey,
  resourceId: string,
  requiredAction: 'read' | 'process'
): boolean =>
  exactKey(source.key, key)
  && source.resourceType === 'archive_item' && source.resourceId === resourceId
  && SHA256.test(source.inputSha256) && source.sourcePolicy.contentSha256 === source.inputSha256
  && source.sourcePolicy.resourceType === 'archive_item' && source.sourcePolicy.resourceId === resourceId
  && source.sourcePolicy.familyId === key.familyId && source.sourcePolicy.receiptActive
  && source.sourcePolicy.allowedCapabilities.includes('archive.ocr')
  && source.sourcePolicy.allowedActions.includes(requiredAction)
  && source.sourcePolicy.allowedPurposes.includes('ocr_process')
  && MIME.test(source.mimeType) && Number.isSafeInteger(source.sizeBytes)
  && source.sizeBytes >= 1 && source.sizeBytes <= LOCAL_GOVERNED_OCR_MAX_SOURCE_BYTES
  && (source.sourcePolicy.retentionUntil === null || validTime(source.sourcePolicy.retentionUntil));

const sourceRetentionUntil = (source: LocalGovernedOcrSourceRow): IsoDateTime | undefined => {
  const value = source.sourcePolicy.retentionUntil;
  return value !== null && validTime(value) ? value : undefined;
};

const validConsent = (
  consent: LocalGovernedOcrConsentRow,
  key: LocalGovernedOcrAggregateKey,
  resourceId: string,
  at: IsoDateTime
): boolean => exactKey(consent.key, key) && consent.purpose === 'sensitive_processing'
  && consent.resourceType === 'archive_item' && consent.resourceId === resourceId && consent.status === 'granted'
  && validTime(consent.startsAt) && Date.parse(consent.startsAt) <= Date.parse(at)
  && (consent.endsAt === undefined || (validTime(consent.endsAt) && Date.parse(consent.endsAt) > Date.parse(at)));

const resolveSourceAndConsent = (
  scope: LocalGovernedOcrWriteScope,
  context: LocalGovernedOcrApplicationContext,
  key: LocalGovernedOcrAggregateKey,
  resourceId: string,
  requiredAction: 'read' | 'process'
): Result<{ readonly source: LocalGovernedOcrSourceRow; readonly consent: LocalGovernedOcrConsentRow }, AppError> => {
  const source = scope.resolveArchiveSource(key, resourceId);
  if (!source.ok) return source;
  if (!source.value || !validSource(source.value, key, resourceId, requiredAction)) {
    return err(denied(context, 'Arşiv kaynağı taze PPK-016 source receipt ile doğrulanamadı.'));
  }
  const consent = scope.resolveActiveSensitiveProcessingConsent(key, 'archive_item', resourceId, scope.occurredAt);
  if (!consent.ok) return consent;
  if (!consent.value || !validConsent(consent.value, key, resourceId, scope.occurredAt)) {
    return err(denied(context, 'OCR için exact kaynak kapsamlı ve süreli hassas işleme rızası gerekir.'));
  }
  return ok({ source: source.value, consent: consent.value });
};

const validSealedResult = (value: LocalGovernedOcrSealedResult, expectedInputSha256: string): boolean =>
  IDENTIFIER.test(value.sealedResultId) && value.inputSha256 === expectedInputSha256
  && SHA256.test(value.contentSha256)
  && Number.isSafeInteger(value.characterCount) && value.characterCount >= 1
  && value.characterCount <= LOCAL_GOVERNED_OCR_MAX_RESULT_CHARACTERS
  && Number.isSafeInteger(value.pageCount) && value.pageCount >= 1 && value.pageCount <= LOCAL_GOVERNED_OCR_MAX_PAGES
  && (value.confidenceBasisPoints === undefined || (Number.isSafeInteger(value.confidenceBasisPoints)
    && value.confidenceBasisPoints >= 0 && value.confidenceBasisPoints <= 10_000))
  && validTime(value.completedAt) && !value.networkUsed && !value.cloudUsed;

const sealDerivedBinding = (
  scope: LocalGovernedOcrWriteScope,
  context: LocalGovernedOcrApplicationContext,
  key: LocalGovernedOcrAggregateKey,
  source: LocalGovernedOcrSourceRow,
  job: LocalGovernedOcrJobRow,
  result: LocalGovernedOcrSealedResult,
  targetResourceVersion: string,
  policy: DerivedDataInheritancePolicy
): Result<DerivedDataPolicyBinding, AppError> => {
  const target: DerivedDataTargetPolicy = {
    schemaVersion: 1,
    kind: 'OCR_TEXT',
    resourceType: 'local_ocr_result',
    resourceId: job.derivedResourceId,
    resourceVersion: targetResourceVersion,
    contentSha256: result.contentSha256,
    familyId: key.familyId,
    policyVersion: source.sourcePolicy.policyVersion,
    policyPackageSha256: source.sourcePolicy.policyPackageSha256,
    sensitivity: source.sourcePolicy.sensitivity,
    dataClasses: source.sourcePolicy.dataClasses,
    allowedAccountIds: [key.accountId],
    allowedApplicationIds: ['windows-desktop'],
    allowedCapabilities: ['archive.ocr'],
    allowedActions: source.sourcePolicy.allowedActions.filter(
      (action): action is 'read' | 'process' => action === 'read' || action === 'process'
    ),
    allowedPurposes: ['ocr_process'],
    obligations: source.sourcePolicy.obligations,
    retentionUntil: source.sourcePolicy.retentionUntil
  };
  const evaluated = policy.evaluate({ target, sources: [source.sourcePolicy] });
  if (!evaluated.allowed) return err(denied(context, `PPK-016 OCR binding reddedildi: ${evaluated.reason}`));
  const verified = policy.verify(evaluated.binding);
  if (!verified.allowed) return err(denied(context, `PPK-016 OCR binding doğrulanamadı: ${verified.reason}`));
  const inserted = scope.insertDerivedBinding(verified.binding);
  return inserted.ok ? ok(verified.binding) : inserted;
};

const mutationReceipt = (row: LocalGovernedOcrMutationRow, replayed: boolean): LocalGovernedOcrMutationReceiptView => ({
  clientOperationId: row.clientOperationId,
  mutationKind: row.mutationKind,
  resourceType: row.resourceType,
  resourceId: row.resourceId,
  previousRevision: row.previousRevision,
  revision: row.revision,
  occurredAt: row.occurredAt,
  stateFingerprint: row.stateFingerprint,
  replayed,
  sourceResourceDeleted: row.mutationKind === 'source_delete_propagate',
  networkUsed: false,
  cloudUsed: false
});

interface CurrentMutationState { readonly revision: number; readonly stateFingerprint: string }
interface PreparedMutation {
  readonly previousRevision: number;
  readonly revision: number;
  readonly stateFingerprint: string;
  persist(): Result<void, AppError> | Promise<Result<void, AppError>>;
}

interface MutationExecutionInput {
  readonly context: LocalGovernedOcrApplicationContext;
  readonly key: LocalGovernedOcrAggregateKey;
  readonly expectedRevision: number;
  readonly clientOperationId: string;
  readonly identifiers: LocalGovernedOcrOperationIdentifiers;
}

interface MutationSpecification {
  readonly mutationKind: LocalGovernedOcrMutationKind;
  readonly resourceType: LocalGovernedOcrResourceType;
  readonly authorization: LocalGovernedOcrAuthorizationPlan;
  loadCurrent(scope: LocalGovernedOcrWriteScope): Result<CurrentMutationState | null, AppError>;
  prepare(scope: LocalGovernedOcrWriteScope): Result<PreparedMutation, AppError> | Promise<Result<PreparedMutation, AppError>>;
}

const executeMutationInScope = async (
  scope: LocalGovernedOcrWriteScope,
  input: MutationExecutionInput,
  specification: MutationSpecification
): Promise<Result<LocalGovernedOcrMutationReceiptView, AppError>> => {
  const replay = scope.findMutationByClientOperationId(input.key, input.clientOperationId);
  if (!replay.ok) return replay;
  if (replay.value) {
    if (!exactKey(replay.value.key, input.key)
      || replay.value.requestFingerprint !== input.identifiers.requestFingerprint
      || replay.value.mutationKind !== specification.mutationKind
      || replay.value.resourceType !== specification.resourceType
      || replay.value.resourceId !== input.identifiers.resourceId
      || replay.value.previousRevision !== input.expectedRevision) {
      return err(conflict(input.context, 'OCR istemci işlem kimliği farklı istek veya kapsamla yeniden kullanılmış.'));
    }
    const current = specification.loadCurrent(scope);
    if (!current.ok) return current;
    if (!current.value || current.value.revision !== replay.value.revision
      || current.value.stateFingerprint !== replay.value.stateFingerprint) {
      return err(conflict(input.context, 'OCR replay sonucu artık exact current state değildir.'));
    }
    return ok(mutationReceipt(replay.value, true));
  }
  const prepared = await specification.prepare(scope);
  if (!prepared.ok) return prepared;
  if (prepared.value.previousRevision !== input.expectedRevision) {
    return err(conflict(input.context, 'OCR kaynağı revizyonu güncel değildir.'));
  }
  const mutation: LocalGovernedOcrMutationRow = {
    id: input.identifiers.mutationId,
    key: input.key,
    clientOperationId: input.clientOperationId,
    requestFingerprint: input.identifiers.requestFingerprint,
    mutationKind: specification.mutationKind,
    resourceType: specification.resourceType,
    resourceId: input.identifiers.resourceId,
    previousRevision: prepared.value.previousRevision,
    revision: prepared.value.revision,
    stateFingerprint: prepared.value.stateFingerprint,
    occurredAt: scope.occurredAt
  };
  const inserted = scope.insertMutation(mutation);
  if (!inserted.ok) return inserted;
  const persisted = await prepared.value.persist();
  if (!persisted.ok) return persisted;
  const audited = scope.appendAudit({
    id: input.identifiers.auditId,
    action: `ocr.${specification.mutationKind}`,
    resourceType: specification.resourceType,
    resourceId: input.identifiers.resourceId,
    occurredAt: scope.occurredAt,
    actorId: input.context.actor.userId
  });
  if (!audited.ok) return audited;
  const event: DomainEvent<{
    readonly clientOperationId: string;
    readonly mutationKind: LocalGovernedOcrMutationKind;
    readonly revision: number;
    readonly stateFingerprint: string;
  }> = {
    eventId: input.identifiers.outboxEventId,
    eventType: 'ocr.state.changed',
    eventVersion: 1,
    aggregateType: specification.resourceType,
    aggregateId: input.identifiers.resourceId,
    occurredAt: scope.occurredAt,
    actorId: input.context.actor.userId,
    correlationId: input.context.correlationId,
    payload: {
      clientOperationId: input.clientOperationId,
      mutationKind: specification.mutationKind,
      revision: mutation.revision,
      stateFingerprint: mutation.stateFingerprint
    }
  };
  const queued = scope.enqueueEvent(event);
  return queued.ok ? ok(mutationReceipt(mutation, false)) : queued;
};

const executeMutation = async (
  unitOfWork: LocalGovernedOcrUnitOfWork,
  input: MutationExecutionInput,
  specification: MutationSpecification
): Promise<Result<LocalGovernedOcrMutationReceiptView, AppError>> => {
  if (!validRevision(input.expectedRevision) || !IDENTIFIER.test(input.clientOperationId)
    || !identifiersValid(input.identifiers)) {
    return err(invalid(input.context, 'OCR işlem kimliği, revizyonu veya fingerprint geçersiz.'));
  }
  return unitOfWork.execute(input.context, specification.authorization,
    (scope) => executeMutationInScope(scope, input, specification));
};

const loadExactJob = (
  scope: LocalGovernedOcrWriteScope,
  context: LocalGovernedOcrApplicationContext,
  key: LocalGovernedOcrAggregateKey,
  jobId: string
): Result<LocalGovernedOcrJobRow, AppError> => {
  const loaded = scope.findJob(key, jobId);
  if (!loaded.ok) return loaded;
  if (!loaded.value || !exactKey(loaded.value.key, key)) return err(missing(context, 'OCR işi bulunamadı.'));
  return ok(loaded.value);
};

const resolveJobSourceMetadata = (
  unitOfWork: LocalGovernedOcrUnitOfWork,
  context: LocalGovernedOcrApplicationContext,
  key: LocalGovernedOcrAggregateKey,
  jobId: string
): Result<{
  readonly resourceType: 'archive_item';
  readonly resourceId: string;
  readonly derivedResourceId: string;
  readonly sensitivity: LocalGovernedOcrPolicyIntent['sensitivity'];
}, AppError> => {
  const metadata = unitOfWork.resolvePolicyResource(context, key, 'local_ocr_job', jobId);
  if (!metadata.ok) return metadata;
  if (!metadata.value || metadata.value.familyId !== key.familyId || metadata.value.accountId !== key.accountId
    || metadata.value.ownerPersonId !== key.ownerPersonId || metadata.value.sourceResourceType !== 'archive_item'
    || !nonEmpty(metadata.value.sourceResourceId) || !nonEmpty(metadata.value.derivedResourceId)) {
    return err(missing(context, 'OCR işi source policy metadata ile çözülemedi.'));
  }
  return ok({ resourceType: 'archive_item', resourceId: metadata.value.sourceResourceId,
    derivedResourceId: metadata.value.derivedResourceId, sensitivity: metadata.value.sensitivity });
};

const resolveArchiveMetadata = (
  unitOfWork: LocalGovernedOcrUnitOfWork,
  context: LocalGovernedOcrApplicationContext,
  key: LocalGovernedOcrAggregateKey,
  resourceId: string
): Result<LocalGovernedOcrPolicyResourceMetadata, AppError> => {
  const metadata = unitOfWork.resolveArchivePolicyResource(context, key, resourceId);
  if (!metadata.ok) return metadata;
  if (!metadata.value || metadata.value.familyId !== key.familyId || metadata.value.accountId !== key.accountId
    || metadata.value.ownerPersonId !== key.ownerPersonId || metadata.value.sourceResourceType !== null
    || metadata.value.sourceResourceId !== null || metadata.value.derivedResourceId !== null) {
    return err(missing(context, 'OCR arşiv kaynağı policy metadata ile çözülemedi.'));
  }
  return ok(metadata.value);
};

export class GetLocalGovernedOcrCenterUseCase {
  public constructor(private readonly unitOfWork: LocalGovernedOcrUnitOfWork) {}

  public async execute(context: LocalGovernedOcrApplicationContext): Promise<Result<LocalGovernedOcrCenterView, AppError>> {
    const key = keyFor(context);
    if (!key.ok) return key;
    return this.unitOfWork.execute(context, { primary: settingsIntent(key.value, 'read') }, (scope) => {
      const loaded = scope.loadCenter(key.value);
      if (!loaded.ok) return loaded;
      if (!exactKey(loaded.value.settings.key, key.value) || loaded.value.jobs.length > LOCAL_GOVERNED_OCR_MAX_JOBS
        || loaded.value.jobs.some((job) => !exactKey(job.key, key.value))) {
        return err(unexpected(context, 'OCR merkez snapshot kapsamı veya limiti geçersizdir.'));
      }
      return ok({
        schemaVersion: 1,
        key: key.value,
        settings: settingsView(loaded.value.settings),
        jobs: loaded.value.jobs.map(jobView),
        truth: {
          executionScope: 'bounded_child_process',
          lowPrivilegeSandboxVerified: false,
          sourceBytesExposedToRenderer: false,
          plaintextResultPersistedInRepository: false,
          networkUsed: false,
          cloudUsed: false,
          providerDeliveryGuaranteed: false,
          explicitSensitiveProcessingConsentRequired: true,
          derivedPolicyBindingRequired: true,
          sourceDeletionPropagatesToDerivedResult: true,
          sourceDeletionAutoResumeGuaranteed: true,
          authorizationRevocationPropagatesToSealedResult: true,
          retentionExpiryPropagatesToSealedResult: true,
          scheduledOrphanSweepUsesDistinctMaintenanceAuthority: true,
          encryptedFullTextIndexAvailable: true,
          policyFilteredSearchRequired: true,
          snippetMaskingEnforced: true,
          derivedDeletionDeletesSource: false
        },
        generatedAt: scope.occurredAt
      });
    });
  }
}

export class CreateLocalGovernedOcrJobUseCase {
  public constructor(private readonly unitOfWork: LocalGovernedOcrUnitOfWork) {}

  public async execute(input: {
    readonly context: LocalGovernedOcrApplicationContext;
    readonly command: CreateLocalGovernedOcrJobInput;
    readonly identifiers: LocalGovernedOcrOperationIdentifiers;
  }): Promise<Result<LocalGovernedOcrMutationReceiptView, AppError>> {
    const key = keyFor(input.context);
    if (!key.ok) return key;
    const languages = normalizeLanguages(input.command.languageHints);
    if (!languages || input.command.expectedRevision !== 0 || input.command.sourceResourceType !== 'archive_item'
      || !IDENTIFIER.test(input.command.sourceResourceId)) {
      return err(invalid(input.context, 'OCR kaynak, dil veya başlangıç revizyonu geçersizdir.'));
    }
    const sourceMetadata = resolveArchiveMetadata(
      this.unitOfWork, input.context, key.value, input.command.sourceResourceId
    );
    if (!sourceMetadata.ok) return sourceMetadata;
    const authorization: LocalGovernedOcrAuthorizationPlan = {
      primary: jobIntent(key.value, 'process', input.identifiers.resourceId, sourceMetadata.value.sensitivity),
      source: sourceIntent(key.value, 'read', input.command.sourceResourceId, sourceMetadata.value.sensitivity),
      settings: settingsReadIntent(key.value)
    };
    return executeMutation(this.unitOfWork, {
      context: input.context, key: key.value, expectedRevision: 0,
      clientOperationId: input.command.clientOperationId, identifiers: input.identifiers
    }, {
      mutationKind: 'job_create', resourceType: 'local_ocr_job', authorization,
      loadCurrent: (scope) => {
        const found = scope.findJob(key.value, input.identifiers.resourceId);
        return found.ok ? ok(found.value ? { revision: found.value.revision, stateFingerprint: found.value.stateFingerprint } : null) : found;
      },
      prepare: (scope) => {
        const center = scope.loadCenter(key.value);
        if (!center.ok) return center;
        if (!center.value.settings.enabled) return err(conflict(input.context, 'Yerel OCR işlemesi devre dışıdır.'));
        if (center.value.jobs.filter((job) => job.status !== 'deleted').length >= LOCAL_GOVERNED_OCR_MAX_JOBS) {
          return err(conflict(input.context, 'Yerel OCR iş limiti doludur.'));
        }
        const existing = scope.findJob(key.value, input.identifiers.resourceId);
        if (!existing.ok) return existing;
        if (existing.value) return err(conflict(input.context, 'OCR işi zaten vardır.'));
        const authority = resolveSourceAndConsent(scope, input.context, key.value, input.command.sourceResourceId, 'read');
        if (!authority.ok) return authority;
        const view: LocalGovernedOcrJobView = {
          id: input.identifiers.resourceId,
          key: key.value,
          revision: 1,
          source: {
            resourceType: 'archive_item', resourceId: authority.value.source.resourceId,
            inputSha256: authority.value.source.inputSha256, mimeType: authority.value.source.mimeType,
            sizeBytes: authority.value.source.sizeBytes
          },
          derivedResourceId: `${input.identifiers.resourceId}:result`,
          languageHints: languages,
          status: 'queued',
          runAttempt: 0,
          correctionRevision: 0,
          resultAvailable: false,
          consentId: authority.value.consent.id,
          ...(authority.value.consent.endsAt === undefined ? {} : { consentExpiresAt: authority.value.consent.endsAt }),
          ...(sourceRetentionUntil(authority.value.source) === undefined ? {} : { retentionUntil: sourceRetentionUntil(authority.value.source)! }),
          deletionPropagation: 'active',
          processor: 'local_ocr', networkUsed: false, cloudUsed: false,
          createdAt: scope.occurredAt, updatedAt: scope.occurredAt
        };
        const row = jobRow(view);
        return ok({ previousRevision: 0, revision: 1, stateFingerprint: row.stateFingerprint,
          persist: () => scope.insertJob(row) });
      }
    });
  }
}

export class RunLocalGovernedOcrJobUseCase {
  public constructor(
    private readonly unitOfWork: LocalGovernedOcrUnitOfWork,
    private readonly runtime: LocalGovernedOcrRuntimePort,
    private readonly inheritance = new DerivedDataInheritancePolicy()
  ) {}

  public async execute(input: {
    readonly context: LocalGovernedOcrApplicationContext;
    readonly command: RunLocalGovernedOcrJobInput;
    readonly identifiers: LocalGovernedOcrOperationIdentifiers;
  }): Promise<Result<LocalGovernedOcrMutationReceiptView, AppError>> {
    const key = keyFor(input.context);
    if (!key.ok) return key;
    if (input.command.jobId !== input.identifiers.resourceId || !validRevision(input.command.expectedRevision)
      || !IDENTIFIER.test(input.command.clientOperationId) || !identifiersValid(input.identifiers)) {
      return err(invalid(input.context, 'OCR iş kimliği, revizyonu veya fingerprint geçersiz.'));
    }
    const sourceMetadata = resolveJobSourceMetadata(this.unitOfWork, input.context, key.value, input.command.jobId);
    if (!sourceMetadata.ok) return sourceMetadata;
    const authorization: LocalGovernedOcrAuthorizationPlan = {
      primary: jobIntent(key.value, 'process', input.command.jobId, sourceMetadata.value.sensitivity),
      source: sourceIntent(key.value, 'process', sourceMetadata.value.resourceId, sourceMetadata.value.sensitivity),
      settings: settingsReadIntent(key.value),
      target: targetIntent(key.value, input.command.jobId, sourceMetadata.value.derivedResourceId,
        sourceMetadata.value.sensitivity)
    };
    const activeRunId = hash(JSON.stringify([
      'local-governed-ocr-run-v2', key.value.familyId, key.value.accountId, key.value.ownerPersonId,
      input.command.jobId, input.command.clientOperationId, input.identifiers.requestFingerprint,
      input.command.expectedRevision
    ]));
    const beginClientOperationId = `ocr-run-begin:${activeRunId}`;
    const phaseContext = (phase: 'preflight' | 'begin' | 'postflight' | 'final'): LocalGovernedOcrApplicationContext => ({
      ...input.context,
      correlationId: asCorrelationId(`local-ocr-run-${phase}-${hash(JSON.stringify([
        input.context.correlationId, activeRunId, phase
      ]))}`)
    });
    const preflightContext = phaseContext('preflight');
    const beginContext = phaseContext('begin');
    const finalContext = phaseContext('final');
    const beginIdentifiers: LocalGovernedOcrOperationIdentifiers = {
      mutationId: `ocr-run-begin-mutation:${activeRunId}`,
      resourceId: input.command.jobId,
      requestFingerprint: activeRunId,
      auditId: `ocr-run-begin-audit:${activeRunId}`,
      outboxEventId: `ocr-run-begin-event:${activeRunId}` as EventId
    };
    const beginInput: MutationExecutionInput = {
      context: beginContext,
      key: key.value,
      expectedRevision: input.command.expectedRevision,
      clientOperationId: beginClientOperationId,
      identifiers: beginIdentifiers
    };
    const loadFinalReplay = (scope: LocalGovernedOcrWriteScope): Result<LocalGovernedOcrMutationReceiptView | null, AppError> => {
      const replay = scope.findMutationByClientOperationId(key.value, input.command.clientOperationId);
      if (!replay.ok) return replay;
      if (!replay.value) return ok(null);
      const begin = scope.findMutationByClientOperationId(key.value, beginClientOperationId);
      if (!begin.ok) return begin;
      if (!begin.value || !exactKey(begin.value.key, key.value)
        || begin.value.mutationKind !== 'job_run_begin' || begin.value.resourceType !== 'local_ocr_job'
        || begin.value.resourceId !== input.command.jobId || begin.value.requestFingerprint !== activeRunId
        || begin.value.previousRevision !== input.command.expectedRevision
        || begin.value.revision !== input.command.expectedRevision + 1
        || !exactKey(replay.value.key, key.value)
        || replay.value.requestFingerprint !== input.identifiers.requestFingerprint
        || replay.value.mutationKind !== 'job_run' || replay.value.resourceType !== 'local_ocr_job'
        || replay.value.resourceId !== input.command.jobId
        || replay.value.previousRevision < begin.value.revision
        || replay.value.previousRevision > begin.value.revision + 1
        || replay.value.revision !== replay.value.previousRevision + 1) {
        return err(conflict(input.context, 'OCR run replay zinciri exact begin/final kimliğiyle eşleşmiyor.'));
      }
      const current = scope.findJob(key.value, input.command.jobId);
      if (!current.ok) return current;
      if (!current.value || current.value.revision !== replay.value.revision
        || current.value.stateFingerprint !== replay.value.stateFingerprint) {
        return err(conflict(input.context, 'OCR run replay sonucu artık exact current state değildir.'));
      }
      return ok(mutationReceipt(replay.value, true));
    };

    const preflight = await this.unitOfWork.execute(preflightContext, authorization, loadFinalReplay);
    if (!preflight.ok) return preflight;
    if (preflight.value) return ok(preflight.value);

    const detached = await this.unitOfWork.executeDetached<
      { readonly beginReceipt: LocalGovernedOcrMutationReceiptView; readonly job: LocalGovernedOcrJobRow },
      { readonly outcome: LocalGovernedOcrRunOutcome }
    >(beginContext, authorization, (prepared) => ({
      operation: 'run',
      runId: activeRunId,
      jobId: input.command.jobId,
      derivedResourceId: sourceMetadata.value.derivedResourceId,
      sourceResourceId: sourceMetadata.value.resourceId,
      expectedInputSha256: prepared.job.source.inputSha256
    }), async (scope) => {
      const begun = await executeMutationInScope(scope, beginInput, {
        mutationKind: 'job_run_begin',
        resourceType: 'local_ocr_job',
        authorization,
        loadCurrent: (currentScope) => {
          const loaded = currentScope.findJob(key.value, input.command.jobId);
          return loaded.ok
            ? ok(loaded.value ? { revision: loaded.value.revision, stateFingerprint: loaded.value.stateFingerprint } : null)
            : loaded;
        },
        prepare: (currentScope) => {
          const current = loadExactJob(currentScope, input.context, key.value, input.command.jobId);
          if (!current.ok) return current;
          if (current.value.revision !== input.command.expectedRevision || current.value.status !== 'queued'
            || current.value.activeRunId !== undefined) {
            return err(conflict(input.context, 'Yalnız exact sıradaki OCR işi başlatılabilir.'));
          }
          const center = currentScope.loadCenter(key.value);
          if (!center.ok) return center;
          if (!center.value.settings.enabled) return err(conflict(input.context, 'Yerel OCR işlemesi devre dışıdır.'));
          const authority = resolveSourceAndConsent(currentScope, input.context, key.value,
            current.value.source.resourceId, 'process');
          if (!authority.ok) return authority;
          if (authority.value.source.inputSha256 !== current.value.source.inputSha256) {
            return err(conflict(input.context, 'Arşiv kaynağı değişmiştir; açık rerun işlemi gerekir.'));
          }
          const { stateFingerprint: _fingerprint, sealedResultId: _sealed, activeRunId: _active,
            resultContentSha256: _content, resultCharacterCount: _characters, resultPageCount: _pages,
            confidenceBasisPoints: _confidence, derivedBindingHash: _binding, failureCode: _failure,
            completedAt: _completed, failedAt: _failed, cancelledAt: _cancelled,
            cancellationRequestedAt: _cancelRequested, consentExpiresAt: _consentExpiresAt,
            ...base } = current.value;
          const view: LocalGovernedOcrJobView = {
            ...base,
            revision: current.value.revision + 1,
            status: 'running',
            runAttempt: current.value.runAttempt + 1,
            resultAvailable: false,
            consentId: authority.value.consent.id,
            ...(authority.value.consent.endsAt === undefined
              ? {}
              : { consentExpiresAt: authority.value.consent.endsAt }),
            updatedAt: currentScope.occurredAt
          };
          const row = jobRow(view, undefined, activeRunId);
          return ok({
            previousRevision: current.value.revision,
            revision: row.revision,
            stateFingerprint: row.stateFingerprint,
            persist: () => {
              const saved = currentScope.saveJob(row, current.value.revision);
              return saved.ok && saved.value ? ok(undefined)
                : saved.ok ? err(conflict(input.context, 'OCR begin revizyonu yarıştı.')) : saved;
            }
          });
        }
      });
      if (!begun.ok) return begun;
      const running = loadExactJob(scope, input.context, key.value, input.command.jobId);
      if (!running.ok) return running;
      if (running.value.status !== 'running' || running.value.activeRunId !== activeRunId
        || running.value.source.resourceId !== sourceMetadata.value.resourceId
        || running.value.derivedResourceId !== sourceMetadata.value.derivedResourceId) {
        return err(conflict(input.context, 'OCR detached run authority exact running state ile eşleşmiyor.'));
      }
      return ok({ beginReceipt: begun.value, job: running.value });
    }, async (prepared) => {
      const executed = await this.runtime.runAndSeal({
        runId: activeRunId,
        jobId: prepared.job.id,
        derivedResourceId: prepared.job.derivedResourceId,
        sourceResourceType: 'archive_item',
        sourceResourceId: prepared.job.source.resourceId,
        expectedInputSha256: prepared.job.source.inputSha256,
        languageHints: prepared.job.languageHints,
        correlationId: beginContext.correlationId
      });
      return executed.ok ? ok({ outcome: executed.value }) : executed;
    });
    if (!detached.ok) {
      const postflight = await this.unitOfWork.execute(phaseContext('postflight'), authorization, loadFinalReplay);
      if (postflight.ok && postflight.value) return ok(postflight.value);
      return detached;
    }
    if (detached.value.outcome.networkUsed || detached.value.outcome.cloudUsed) {
      return err(denied(input.context, 'Yerel OCR runtime ağ veya bulut kullanımı bildirdi.'));
    }
    if (detached.value.outcome.status === 'failed'
      && (!validTime(detached.value.outcome.failedAt)
        || !['source_unavailable', 'consent_unavailable', 'engine_failed', 'integrity_mismatch']
          .includes(detached.value.outcome.failureCode))) {
      return err(denied(input.context, 'OCR runtime failure sonucu doğrulanamadı.'));
    }
    if (detached.value.outcome.status === 'cancelled' && !validTime(detached.value.outcome.cancelledAt)) {
      return err(denied(input.context, 'OCR runtime iptal sonucu doğrulanamadı.'));
    }

    return this.unitOfWork.execute(finalContext, authorization, async (scope) => {
      const replay = loadFinalReplay(scope);
      if (!replay.ok) return replay;
      if (replay.value) return ok(replay.value);
      const begin = scope.findMutationByClientOperationId(key.value, beginClientOperationId);
      if (!begin.ok) return begin;
      if (!begin.value || begin.value.mutationKind !== 'job_run_begin'
        || begin.value.requestFingerprint !== activeRunId
        || begin.value.previousRevision !== input.command.expectedRevision
        || begin.value.revision !== input.command.expectedRevision + 1) {
        return err(conflict(input.context, 'OCR finalizasyonu exact begin ledger olmadan yapılamaz.'));
      }
      const current = loadExactJob(scope, input.context, key.value, input.command.jobId);
      if (!current.ok) return current;
      if (!['running', 'cancel_requested'].includes(current.value.status)
        || current.value.activeRunId !== activeRunId
        || current.value.revision < begin.value.revision || current.value.revision > begin.value.revision + 1
        || current.value.source.resourceId !== sourceMetadata.value.resourceId
        || current.value.derivedResourceId !== sourceMetadata.value.derivedResourceId) {
        return err(conflict(input.context, 'OCR finalizasyonu exact aktif run state ile eşleşmiyor.'));
      }
      const authority = resolveSourceAndConsent(scope, input.context, key.value,
        current.value.source.resourceId, 'process');
      if (!authority.ok) return authority;
      if (authority.value.source.inputSha256 !== current.value.source.inputSha256) {
        return err(conflict(input.context, 'Arşiv kaynağı run sırasında değişmiştir.'));
      }
      return executeMutationInScope(scope, {
        context: finalContext,
        key: key.value,
        expectedRevision: current.value.revision,
        clientOperationId: input.command.clientOperationId,
        identifiers: input.identifiers
      }, {
        mutationKind: 'job_run',
        resourceType: 'local_ocr_job',
        authorization,
        loadCurrent: (currentScope) => {
          const loaded = currentScope.findJob(key.value, input.command.jobId);
          return loaded.ok
            ? ok(loaded.value ? { revision: loaded.value.revision, stateFingerprint: loaded.value.stateFingerprint } : null)
            : loaded;
        },
        prepare: (currentScope) => {
          const nextRevision = current.value.revision + 1;
          const { stateFingerprint: _fingerprint, sealedResultId: _sealed, activeRunId: _active,
            resultContentSha256: _content, resultCharacterCount: _characters, resultPageCount: _pages,
            confidenceBasisPoints: _confidence, derivedBindingHash: _binding, failureCode: _failure,
            completedAt: _completed, failedAt: _failed, cancelledAt: _cancelled,
            cancellationRequestedAt: _cancelRequested, consentExpiresAt: _consentExpiresAt,
            ...base } = current.value;
          let row: LocalGovernedOcrJobRow;
          if (detached.value.outcome.status === 'failed') {
            row = jobRow({
              ...base,
              revision: nextRevision,
              status: 'failed',
              resultAvailable: false,
              failureCode: detached.value.outcome.failureCode,
              failedAt: detached.value.outcome.failedAt,
              consentId: authority.value.consent.id,
              ...(authority.value.consent.endsAt === undefined
                ? {}
                : { consentExpiresAt: authority.value.consent.endsAt }),
              updatedAt: currentScope.occurredAt
            });
          } else if (detached.value.outcome.status === 'cancelled') {
            row = jobRow({
              ...base,
              revision: nextRevision,
              status: 'cancelled',
              resultAvailable: false,
              cancelledAt: detached.value.outcome.cancelledAt,
              consentId: authority.value.consent.id,
              ...(authority.value.consent.endsAt === undefined
                ? {}
                : { consentExpiresAt: authority.value.consent.endsAt }),
              updatedAt: currentScope.occurredAt
            });
          } else {
            if (!validSealedResult(detached.value.outcome, current.value.source.inputSha256)) {
              return err(denied(input.context, 'OCR runtime sonucu bütünlük veya limit kontrolünden geçmedi.'));
            }
            const binding = sealDerivedBinding(currentScope, input.context, key.value, authority.value.source,
              current.value, detached.value.outcome,
              `run-${current.value.runAttempt}-correction-${current.value.correctionRevision}`,
              this.inheritance);
            if (!binding.ok) return binding;
            row = jobRow({
              ...base,
              revision: nextRevision,
              status: 'completed',
              resultAvailable: true,
              resultContentSha256: detached.value.outcome.contentSha256,
              resultCharacterCount: detached.value.outcome.characterCount,
              resultPageCount: detached.value.outcome.pageCount,
              ...(detached.value.outcome.confidenceBasisPoints === undefined
                ? {}
                : { confidenceBasisPoints: detached.value.outcome.confidenceBasisPoints }),
              derivedBindingHash: binding.value.bindingHash,
              consentId: authority.value.consent.id,
              ...(authority.value.consent.endsAt === undefined
                ? {}
                : { consentExpiresAt: authority.value.consent.endsAt }),
              completedAt: detached.value.outcome.completedAt,
              updatedAt: currentScope.occurredAt
            }, detached.value.outcome.sealedResultId);
          }
          return ok({
            previousRevision: current.value.revision,
            revision: row.revision,
            stateFingerprint: row.stateFingerprint,
            persist: () => {
              const saved = currentScope.saveJob(row, current.value.revision);
              return saved.ok && saved.value ? ok(undefined)
                : saved.ok ? err(conflict(input.context, 'OCR final revizyonu yarıştı.')) : saved;
            }
          });
        }
      });
    });
  }
}

export class CancelLocalGovernedOcrJobUseCase {
  public constructor(private readonly unitOfWork: LocalGovernedOcrUnitOfWork, private readonly runtime: LocalGovernedOcrRuntimePort) {}

  public async execute(input: { readonly context: LocalGovernedOcrApplicationContext;
    readonly command: CancelLocalGovernedOcrJobInput; readonly identifiers: LocalGovernedOcrOperationIdentifiers }) {
    const key = keyFor(input.context); if (!key.ok) return key;
    if (input.command.jobId !== input.identifiers.resourceId) return err(invalid(input.context, 'OCR iş kimliği uyuşmuyor.'));
    const source = resolveJobSourceMetadata(this.unitOfWork, input.context, key.value, input.command.jobId);
    if (!source.ok) return source;
    return executeMutation(this.unitOfWork, { context: input.context, key: key.value,
      expectedRevision: input.command.expectedRevision, clientOperationId: input.command.clientOperationId,
      identifiers: input.identifiers }, {
      mutationKind: 'job_cancel', resourceType: 'local_ocr_job',
      authorization: { primary: jobIntent(key.value, 'process', input.command.jobId, source.value.sensitivity),
        source: sourceIntent(key.value, 'read', source.value.resourceId, source.value.sensitivity) },
      loadCurrent: (scope) => { const row = scope.findJob(key.value, input.command.jobId);
        return row.ok ? ok(row.value ? { revision: row.value.revision, stateFingerprint: row.value.stateFingerprint } : null) : row; },
      prepare: async (scope) => {
        const current = loadExactJob(scope, input.context, key.value, input.command.jobId); if (!current.ok) return current;
        if (current.value.revision !== input.command.expectedRevision) return err(conflict(input.context, 'OCR iş revizyonu güncel değildir.'));
        if (!['queued', 'running'].includes(current.value.status)) return err(conflict(input.context, 'OCR işi bu durumda iptal edilemez.'));
        if (current.value.status === 'running') {
          const requested = await this.runtime.requestCancellation({ jobId: current.value.id, correlationId: input.context.correlationId });
          if (!requested.ok) return requested;
        }
        const { stateFingerprint: _fingerprint, ...base } = current.value;
        const nextStatus = current.value.status === 'running' ? 'cancel_requested' as const : 'cancelled' as const;
        const view: LocalGovernedOcrJobView = { ...base, revision: current.value.revision + 1, status: nextStatus,
          ...(nextStatus === 'cancel_requested' ? { cancellationRequestedAt: scope.occurredAt } : { cancelledAt: scope.occurredAt }),
          updatedAt: scope.occurredAt };
        const row = jobRow(view, current.value.sealedResultId, current.value.activeRunId);
        return ok({ previousRevision: current.value.revision, revision: row.revision, stateFingerprint: row.stateFingerprint,
          persist: () => { const saved = scope.saveJob(row, current.value.revision);
            return saved.ok && saved.value ? ok(undefined) : saved.ok ? err(conflict(input.context, 'OCR iş revizyonu yarıştı.')) : saved; } });
      }
    });
  }
}

export class CorrectLocalGovernedOcrResultUseCase {
  public constructor(private readonly unitOfWork: LocalGovernedOcrUnitOfWork,
    private readonly runtime: LocalGovernedOcrRuntimePort,
    private readonly inheritance = new DerivedDataInheritancePolicy()) {}

  public async execute(input: { readonly context: LocalGovernedOcrApplicationContext;
    readonly command: CorrectLocalGovernedOcrResultInput; readonly identifiers: LocalGovernedOcrOperationIdentifiers }) {
    const key = keyFor(input.context); if (!key.ok) return key;
    if (input.command.jobId !== input.identifiers.resourceId || input.command.correctedText.length < 1
      || input.command.correctedText.length > LOCAL_GOVERNED_OCR_MAX_RESULT_CHARACTERS
      || /[\u0000]/u.test(input.command.correctedText)) return err(invalid(input.context, 'OCR düzeltme girdisi geçersizdir.'));
    const source = resolveJobSourceMetadata(this.unitOfWork, input.context, key.value, input.command.jobId); if (!source.ok) return source;
    return executeMutation(this.unitOfWork, { context: input.context, key: key.value,
      expectedRevision: input.command.expectedRevision, clientOperationId: input.command.clientOperationId,
      identifiers: input.identifiers }, {
      mutationKind: 'result_correct', resourceType: 'local_ocr_job',
      authorization: { primary: jobIntent(key.value, 'process', input.command.jobId, source.value.sensitivity),
        source: sourceIntent(key.value, 'process', source.value.resourceId, source.value.sensitivity),
        target: targetIntent(key.value, input.command.jobId, source.value.derivedResourceId, source.value.sensitivity) },
      loadCurrent: (scope) => { const row = scope.findJob(key.value, input.command.jobId);
        return row.ok ? ok(row.value ? { revision: row.value.revision, stateFingerprint: row.value.stateFingerprint } : null) : row; },
      prepare: async (scope) => {
        const current = loadExactJob(scope, input.context, key.value, input.command.jobId); if (!current.ok) return current;
        if (current.value.revision !== input.command.expectedRevision || current.value.status !== 'completed'
          || !current.value.sealedResultId) return err(conflict(input.context, 'Yalnız tamamlanmış exact OCR sonucu düzeltilebilir.'));
        const authority = resolveSourceAndConsent(scope, input.context, key.value, current.value.source.resourceId, 'process');
        if (!authority.ok) return authority;
        if (authority.value.source.inputSha256 !== current.value.source.inputSha256) return err(conflict(input.context, 'OCR kaynağı değişmiştir.'));
        const corrected = await this.runtime.correctAndSeal({ jobId: current.value.id,
          previousSealedResultId: current.value.sealedResultId, expectedInputSha256: current.value.source.inputSha256,
          correctedText: input.command.correctedText, correlationId: input.context.correlationId });
        if (!corrected.ok) return corrected;
        if (!validSealedResult(corrected.value, current.value.source.inputSha256)) return err(denied(input.context, 'Düzeltilmiş OCR sonucu doğrulanamadı.'));
        const binding = sealDerivedBinding(scope, input.context, key.value, authority.value.source,
          current.value, corrected.value,
          `run-${current.value.runAttempt}-correction-${current.value.correctionRevision + 1}`,
          this.inheritance); if (!binding.ok) return binding;
        const { stateFingerprint: _fingerprint, sealedResultId: _sealed, ...base } = current.value;
        const row = jobRow({ ...base, revision: current.value.revision + 1, status: 'completed', resultAvailable: true,
          correctionRevision: current.value.correctionRevision + 1, resultContentSha256: corrected.value.contentSha256,
          resultCharacterCount: corrected.value.characterCount, resultPageCount: corrected.value.pageCount,
          ...(corrected.value.confidenceBasisPoints === undefined ? {} : { confidenceBasisPoints: corrected.value.confidenceBasisPoints }),
          derivedBindingHash: binding.value.bindingHash,
          consentId: authority.value.consent.id,
          ...(authority.value.consent.endsAt === undefined ? {} : { consentExpiresAt: authority.value.consent.endsAt }),
          completedAt: corrected.value.completedAt, updatedAt: scope.occurredAt }, corrected.value.sealedResultId);
        return ok({ previousRevision: current.value.revision, revision: row.revision, stateFingerprint: row.stateFingerprint,
          persist: () => { const saved = scope.saveJob(row, current.value.revision);
            return saved.ok && saved.value ? ok(undefined) : saved.ok ? err(conflict(input.context, 'OCR iş revizyonu yarıştı.')) : saved; } });
      }
    });
  }
}

export class RerunLocalGovernedOcrJobUseCase {
  public constructor(private readonly unitOfWork: LocalGovernedOcrUnitOfWork, private readonly runtime: LocalGovernedOcrRuntimePort) {}

  public async execute(input: { readonly context: LocalGovernedOcrApplicationContext;
    readonly command: RerunLocalGovernedOcrJobInput; readonly identifiers: LocalGovernedOcrOperationIdentifiers }) {
    const key = keyFor(input.context); if (!key.ok) return key;
    if (input.command.jobId !== input.identifiers.resourceId) return err(invalid(input.context, 'OCR iş kimliği uyuşmuyor.'));
    const languages = input.command.languageHints === undefined ? undefined : normalizeLanguages(input.command.languageHints);
    if (languages === null) return err(invalid(input.context, 'OCR dil ipuçları geçersizdir.'));
    const source = resolveJobSourceMetadata(this.unitOfWork, input.context, key.value, input.command.jobId); if (!source.ok) return source;
    return executeMutation(this.unitOfWork, { context: input.context, key: key.value,
      expectedRevision: input.command.expectedRevision, clientOperationId: input.command.clientOperationId,
      identifiers: input.identifiers }, {
      mutationKind: 'job_rerun', resourceType: 'local_ocr_job',
      authorization: { primary: jobIntent(key.value, 'process', input.command.jobId, source.value.sensitivity),
        source: sourceIntent(key.value, 'read', source.value.resourceId, source.value.sensitivity) },
      loadCurrent: (scope) => { const row = scope.findJob(key.value, input.command.jobId);
        return row.ok ? ok(row.value ? { revision: row.value.revision, stateFingerprint: row.value.stateFingerprint } : null) : row; },
      prepare: async (scope) => {
        const current = loadExactJob(scope, input.context, key.value, input.command.jobId); if (!current.ok) return current;
        if (current.value.revision !== input.command.expectedRevision || !['completed', 'failed', 'cancelled'].includes(current.value.status)) {
          return err(conflict(input.context, 'OCR işi bu durumda yeniden sıraya alınamaz.'));
        }
        const authority = resolveSourceAndConsent(scope, input.context, key.value, current.value.source.resourceId, 'read');
        if (!authority.ok) return authority;
        if (current.value.sealedResultId) {
          const purged = await this.runtime.purgeSealedResult({ jobId: current.value.id,
            sealedResultId: current.value.sealedResultId, correlationId: input.context.correlationId });
          if (!purged.ok || !purged.value.deleted || !purged.value.verified) return purged.ok
            ? err(unexpected(input.context, 'Eski OCR sealed sonucu doğrulanmış biçimde silinemedi.')) : purged;
        }
        const { stateFingerprint: _fingerprint, sealedResultId: _sealed, resultContentSha256: _content,
          resultCharacterCount: _chars, resultPageCount: _pages, confidenceBasisPoints: _confidence,
          derivedBindingHash: _binding, failureCode: _failure, cancellationRequestedAt: _cancelRequest,
          completedAt: _completed, failedAt: _failed, cancelledAt: _cancelled, consentExpiresAt: _oldExpiry,
          retentionUntil: _oldRetention, ...base } = current.value;
        const view: LocalGovernedOcrJobView = {
          ...base, revision: current.value.revision + 1,
          source: { resourceType: 'archive_item', resourceId: authority.value.source.resourceId,
            inputSha256: authority.value.source.inputSha256, mimeType: authority.value.source.mimeType,
            sizeBytes: authority.value.source.sizeBytes },
          languageHints: languages ?? current.value.languageHints, status: 'queued', resultAvailable: false,
          consentId: authority.value.consent.id,
          ...(authority.value.consent.endsAt === undefined ? {} : { consentExpiresAt: authority.value.consent.endsAt }),
          ...(sourceRetentionUntil(authority.value.source) === undefined ? {} : { retentionUntil: sourceRetentionUntil(authority.value.source)! }),
          updatedAt: scope.occurredAt
        };
        const row = jobRow(view);
        return ok({ previousRevision: current.value.revision, revision: row.revision, stateFingerprint: row.stateFingerprint,
          persist: () => { const saved = scope.saveJob(row, current.value.revision);
            return saved.ok && saved.value ? ok(undefined) : saved.ok ? err(conflict(input.context, 'OCR iş revizyonu yarıştı.')) : saved; } });
      }
    });
  }
}

export class DeleteLocalGovernedOcrJobUseCase {
  public constructor(private readonly unitOfWork: LocalGovernedOcrUnitOfWork, private readonly runtime: LocalGovernedOcrRuntimePort) {}

  public async execute(input: { readonly context: LocalGovernedOcrApplicationContext;
    readonly command: DeleteLocalGovernedOcrJobInput; readonly identifiers: LocalGovernedOcrOperationIdentifiers }) {
    const key = keyFor(input.context); if (!key.ok) return key;
    if (input.command.jobId !== input.identifiers.resourceId || !nonEmpty(input.command.reason, 512)) {
      return err(invalid(input.context, 'OCR silme girdisi geçersizdir.'));
    }
    const source = resolveJobSourceMetadata(this.unitOfWork, input.context, key.value, input.command.jobId); if (!source.ok) return source;
    return executeMutation(this.unitOfWork, { context: input.context, key: key.value,
      expectedRevision: input.command.expectedRevision, clientOperationId: input.command.clientOperationId,
      identifiers: input.identifiers }, {
      mutationKind: 'job_delete', resourceType: 'local_ocr_job',
      authorization: { primary: jobIntent(key.value, 'delete', input.command.jobId, source.value.sensitivity),
        source: sourceIntent(key.value, 'read', source.value.resourceId, source.value.sensitivity) },
      loadCurrent: (scope) => { const row = scope.findJob(key.value, input.command.jobId);
        return row.ok ? ok(row.value ? { revision: row.value.revision, stateFingerprint: row.value.stateFingerprint } : null) : row; },
      prepare: async (scope) => {
        const current = loadExactJob(scope, input.context, key.value, input.command.jobId); if (!current.ok) return current;
        if (current.value.revision !== input.command.expectedRevision || current.value.status === 'deleted') {
          return err(conflict(input.context, 'OCR işi zaten silinmiş veya revizyonu değişmiştir.'));
        }
        if (current.value.sealedResultId) {
          const purged = await this.runtime.purgeSealedResult({ jobId: current.value.id,
            sealedResultId: current.value.sealedResultId, correlationId: input.context.correlationId });
          if (!purged.ok || !purged.value.deleted || !purged.value.verified) return purged.ok
            ? err(unexpected(input.context, 'OCR sealed sonucu doğrulanmış biçimde silinemedi.')) : purged;
        }
        const { stateFingerprint: _fingerprint, sealedResultId: _sealed, resultContentSha256: _content,
          resultCharacterCount: _chars, resultPageCount: _pages, confidenceBasisPoints: _confidence,
          derivedBindingHash: _binding, failureCode: _failure, cancellationRequestedAt: _cancelRequest,
          completedAt: _completed, failedAt: _failed, cancelledAt: _cancelled, ...base } = current.value;
        const row = jobRow({ ...base, revision: current.value.revision + 1, status: 'deleted', resultAvailable: false,
          deletedAt: scope.occurredAt, deletionPropagation: 'active', updatedAt: scope.occurredAt });
        return ok({ previousRevision: current.value.revision, revision: row.revision, stateFingerprint: row.stateFingerprint,
          persist: () => { const saved = scope.saveJob(row, current.value.revision);
            return saved.ok && saved.value ? ok(undefined) : saved.ok ? err(conflict(input.context, 'OCR iş revizyonu yarıştı.')) : saved; } });
      }
    });
  }
}

export interface ReconcileLocalGovernedOcrAuthorizationInput {
  readonly jobId: string;
  readonly expectedRevision: number;
  readonly reason: LocalGovernedOcrAuthorizationRevocationReason;
  readonly clientOperationId: string;
}

/**
 * Main-only reconciliation. Discovery is payload-free; the exact denial is revalidated beneath a
 * fresh job-delete receipt before file-first purge and the atomic current-row tombstone.
 */
export class ReconcileLocalGovernedOcrAuthorizationUseCase {
  public constructor(
    private readonly unitOfWork: LocalGovernedOcrUnitOfWork,
    private readonly runtime: LocalGovernedOcrRuntimePort
  ) {}

  public list(
    context: LocalGovernedOcrApplicationContext,
    limit = 8
  ): Result<readonly LocalGovernedOcrAuthorizationReconciliationCandidate[], AppError> {
    const key = keyFor(context);
    if (!key.ok) return key;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 32) {
      return err(invalid(context, 'OCR yetki uzlaştırma sınırı geçersizdir.'));
    }
    return this.unitOfWork.listAuthorizationReconciliationCandidates(context, key.value, limit);
  }

  public async execute(input: {
    readonly context: LocalGovernedOcrApplicationContext;
    readonly command: ReconcileLocalGovernedOcrAuthorizationInput;
    readonly identifiers: LocalGovernedOcrOperationIdentifiers;
  }): Promise<Result<LocalGovernedOcrMutationReceiptView, AppError>> {
    const key = keyFor(input.context);
    if (!key.ok) return key;
    if (input.command.jobId !== input.identifiers.resourceId
      || !['consent_revoked', 'consent_expired', 'permission_revoked'].includes(input.command.reason)) {
      return err(invalid(input.context, 'OCR yetki uzlaştırma kapsamı geçersizdir.'));
    }
    const metadata = resolveJobSourceMetadata(
      this.unitOfWork,
      input.context,
      key.value,
      input.command.jobId
    );
    if (!metadata.ok) return metadata;
    return executeMutation(this.unitOfWork, {
      context: input.context,
      key: key.value,
      expectedRevision: input.command.expectedRevision,
      clientOperationId: input.command.clientOperationId,
      identifiers: input.identifiers
    }, {
      mutationKind: 'authorization_revoke_propagate',
      resourceType: 'local_ocr_job',
      authorization: {
        primary: jobIntent(key.value, 'delete', input.command.jobId, metadata.value.sensitivity)
      },
      loadCurrent: (scope) => {
        const row = scope.findJob(key.value, input.command.jobId);
        return row.ok
          ? ok(row.value ? { revision: row.value.revision, stateFingerprint: row.value.stateFingerprint } : null)
          : row;
      },
      prepare: async (scope) => {
        const current = loadExactJob(scope, input.context, key.value, input.command.jobId);
        if (!current.ok) return current;
        if (current.value.revision !== input.command.expectedRevision
          || current.value.status !== 'completed'
          || !current.value.resultAvailable
          || !current.value.sealedResultId) {
          return err(conflict(input.context, 'OCR sonucu uzlaştırma için exact current durumda değildir.'));
        }
        const reason = scope.resolveAuthorizationRevocation(
          key.value,
          current.value.id,
          scope.occurredAt
        );
        if (!reason.ok) return reason;
        if (reason.value !== input.command.reason) {
          return err(conflict(input.context, 'OCR yetki iptali artık exact current durumla uyuşmuyor.'));
        }
        const purged = await this.runtime.purgeSealedResult({
          jobId: current.value.id,
          sealedResultId: current.value.sealedResultId,
          correlationId: input.context.correlationId
        });
        if (!purged.ok || !purged.value.deleted || !purged.value.verified) {
          return purged.ok
            ? err(unexpected(input.context, 'OCR yetki iptalinde sealed sonuç doğrulanmış biçimde silinemedi.'))
            : purged;
        }
        const {
          stateFingerprint: _fingerprint,
          sealedResultId: _sealed,
          resultContentSha256: _content,
          resultCharacterCount: _characters,
          resultPageCount: _pages,
          confidenceBasisPoints: _confidence,
          derivedBindingHash: _binding,
          failureCode: _failure,
          cancellationRequestedAt: _cancellationRequestedAt,
          completedAt: _completedAt,
          failedAt: _failedAt,
          cancelledAt: _cancelledAt,
          ...base
        } = current.value;
        const row = jobRow({
          ...base,
          revision: current.value.revision + 1,
          status: 'deleted',
          resultAvailable: false,
          deletedAt: scope.occurredAt,
          deletionPropagation: 'active',
          updatedAt: scope.occurredAt
        });
        return ok({
          previousRevision: current.value.revision,
          revision: row.revision,
          stateFingerprint: row.stateFingerprint,
          persist: () => {
            const saved = scope.saveJob(row, current.value.revision);
            return saved.ok && saved.value
              ? ok(undefined)
              : saved.ok
                ? err(conflict(input.context, 'OCR yetki uzlaştırma revizyonu yarıştı.'))
                : saved;
          }
        });
      }
    });
  }
}

export interface ReconcileLocalGovernedOcrRetentionInput {
  readonly jobId: string;
  readonly expectedRevision: number;
  readonly retentionUntil: IsoDateTime;
  readonly clientOperationId: string;
}

/**
 * Main-only retention reconciliation. Discovery contains no OCR payload; expiry is revalidated beneath
 * a fresh job-delete receipt before file-first purge and the atomic current-row tombstone.
 */
export class ReconcileLocalGovernedOcrRetentionUseCase {
  public constructor(
    private readonly unitOfWork: LocalGovernedOcrUnitOfWork,
    private readonly runtime: LocalGovernedOcrRuntimePort
  ) {}

  public list(
    context: LocalGovernedOcrApplicationContext,
    limit = 8
  ): Result<readonly LocalGovernedOcrRetentionReconciliationCandidate[], AppError> {
    const key = keyFor(context);
    if (!key.ok) return key;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 32) {
      return err(invalid(context, 'OCR retention uzlaştırma sınırı geçersizdir.'));
    }
    return this.unitOfWork.listRetentionReconciliationCandidates(context, key.value, limit);
  }

  public async execute(input: {
    readonly context: LocalGovernedOcrApplicationContext;
    readonly command: ReconcileLocalGovernedOcrRetentionInput;
    readonly identifiers: LocalGovernedOcrOperationIdentifiers;
  }): Promise<Result<LocalGovernedOcrMutationReceiptView, AppError>> {
    const key = keyFor(input.context);
    if (!key.ok) return key;
    if (input.command.jobId !== input.identifiers.resourceId || !validTime(input.command.retentionUntil)) {
      return err(invalid(input.context, 'OCR retention uzlaştırma kapsamı geçersizdir.'));
    }
    const metadata = resolveJobSourceMetadata(
      this.unitOfWork,
      input.context,
      key.value,
      input.command.jobId
    );
    if (!metadata.ok) return metadata;
    return executeMutation(this.unitOfWork, {
      context: input.context,
      key: key.value,
      expectedRevision: input.command.expectedRevision,
      clientOperationId: input.command.clientOperationId,
      identifiers: input.identifiers
    }, {
      mutationKind: 'retention_expire_propagate',
      resourceType: 'local_ocr_job',
      authorization: {
        primary: jobIntent(key.value, 'delete', input.command.jobId, metadata.value.sensitivity)
      },
      loadCurrent: (scope) => {
        const row = scope.findJob(key.value, input.command.jobId);
        return row.ok
          ? ok(row.value ? { revision: row.value.revision, stateFingerprint: row.value.stateFingerprint } : null)
          : row;
      },
      prepare: async (scope) => {
        const current = loadExactJob(scope, input.context, key.value, input.command.jobId);
        if (!current.ok) return current;
        if (current.value.revision !== input.command.expectedRevision
          || current.value.status !== 'completed'
          || !current.value.resultAvailable
          || !current.value.sealedResultId
          || current.value.retentionUntil !== input.command.retentionUntil) {
          return err(conflict(input.context, 'OCR sonucu retention uzlaştırması için exact current durumda değildir.'));
        }
        const expiry = scope.resolveRetentionExpiry(key.value, current.value.id, scope.occurredAt);
        if (!expiry.ok) return expiry;
        if (expiry.value !== input.command.retentionUntil) {
          return err(conflict(input.context, 'OCR retention süresi artık exact current durumla uyuşmuyor.'));
        }
        const purged = await this.runtime.purgeSealedResult({
          jobId: current.value.id,
          sealedResultId: current.value.sealedResultId,
          correlationId: input.context.correlationId
        });
        if (!purged.ok || !purged.value.deleted || !purged.value.verified) {
          return purged.ok
            ? err(unexpected(input.context, 'OCR retention süresi dolan sealed sonuç doğrulanmış biçimde silinemedi.'))
            : purged;
        }
        const {
          stateFingerprint: _fingerprint,
          sealedResultId: _sealed,
          resultContentSha256: _content,
          resultCharacterCount: _characters,
          resultPageCount: _pages,
          confidenceBasisPoints: _confidence,
          derivedBindingHash: _binding,
          failureCode: _failure,
          cancellationRequestedAt: _cancellationRequestedAt,
          completedAt: _completedAt,
          failedAt: _failedAt,
          cancelledAt: _cancelledAt,
          ...base
        } = current.value;
        const row = jobRow({
          ...base,
          revision: current.value.revision + 1,
          status: 'deleted',
          resultAvailable: false,
          deletedAt: scope.occurredAt,
          deletionPropagation: 'active',
          updatedAt: scope.occurredAt
        });
        return ok({
          previousRevision: current.value.revision,
          revision: row.revision,
          stateFingerprint: row.stateFingerprint,
          persist: () => {
            const saved = scope.saveJob(row, current.value.revision);
            return saved.ok && saved.value
              ? ok(undefined)
              : saved.ok
                ? err(conflict(input.context, 'OCR retention uzlaştırma revizyonu yarıştı.'))
                : saved;
          }
        });
      }
    });
  }
}

/** Distinct owner-scoped PEP receipt for bounded main-only orphan cleanup. */
export class SweepLocalGovernedOcrOrphansUseCase {
  public constructor(
    private readonly unitOfWork: LocalGovernedOcrUnitOfWork,
    private readonly runtime: LocalGovernedOcrRuntimePort
  ) {}

  public async execute(input: {
    readonly context: LocalGovernedOcrApplicationContext;
    readonly maximumCandidates?: number;
    readonly auditId: string;
    readonly outboxEventId: EventId;
  }): Promise<Result<LocalGovernedOcrOrphanSweepResult, AppError>> {
    const key = keyFor(input.context);
    if (!key.ok) return key;
    const maximumCandidates = input.maximumCandidates ?? 64;
    if (!Number.isSafeInteger(maximumCandidates) || maximumCandidates < 1 || maximumCandidates > 128
      || !IDENTIFIER.test(input.auditId) || !IDENTIFIER.test(input.outboxEventId)) {
      return err(invalid(input.context, 'OCR orphan bakım sınırı veya kimliği geçersizdir.'));
    }
    const resourceId = localGovernedOcrSettingsResourceId(key.value.ownerPersonId);
    return this.unitOfWork.executeMaintenance(
      input.context,
      { primary: settingsIntent(key.value, 'update') },
      (scope) => {
        const center = scope.loadCenter(key.value);
        if (!center.ok) return center;
        if (!exactKey(center.value.settings.key, key.value)) {
          return err(denied(input.context, 'OCR orphan bakımı exact owner settings kaydına bağlı değildir.'));
        }
        const audited = scope.appendAudit({
          id: input.auditId,
          action: 'ocr.orphan_sweep_authorized',
          resourceType: 'local_ocr_settings',
          resourceId,
          occurredAt: scope.occurredAt,
          actorId: input.context.actor.userId
        });
        if (!audited.ok) return audited;
        return scope.enqueueEvent({
          eventId: input.outboxEventId,
          eventType: 'ocr.maintenance.authorized',
          eventVersion: 1,
          aggregateType: 'local_ocr_settings',
          aggregateId: resourceId,
          occurredAt: scope.occurredAt,
          actorId: input.context.actor.userId,
          correlationId: input.context.correlationId,
          payload: { operation: 'orphan_sweep', maximumCandidates }
        });
      },
      async () => {
        const swept = await this.runtime.sweepOrphans({
          correlationId: input.context.correlationId,
          maximumCandidates
        });
        if (!swept.ok) return swept;
        const total = swept.value.deleted + swept.value.referenced + swept.value.rejected;
        if (swept.value.networkUsed || swept.value.cloudUsed
          || !Number.isSafeInteger(swept.value.scanned) || swept.value.scanned < 0
          || !Number.isSafeInteger(swept.value.deleted) || swept.value.deleted < 0
          || !Number.isSafeInteger(swept.value.referenced) || swept.value.referenced < 0
          || !Number.isSafeInteger(swept.value.rejected) || swept.value.rejected < 0
          || swept.value.scanned > maximumCandidates || total < swept.value.scanned) {
          return err(unexpected(input.context, 'OCR orphan bakım sonucu güvenli sınırları aşmıştır.'));
        }
        return swept;
      }
    );
  }
}

export class SetLocalGovernedOcrEnabledUseCase {
  public constructor(private readonly unitOfWork: LocalGovernedOcrUnitOfWork, private readonly runtime: LocalGovernedOcrRuntimePort) {}

  public async execute(input: { readonly context: LocalGovernedOcrApplicationContext;
    readonly command: SetLocalGovernedOcrEnabledInput; readonly identifiers: LocalGovernedOcrOperationIdentifiers }) {
    const key = keyFor(input.context); if (!key.ok) return key;
    const resourceId = localGovernedOcrSettingsResourceId(key.value.ownerPersonId);
    if (input.identifiers.resourceId !== resourceId || !nonEmpty(input.command.reason, 512)) {
      return err(invalid(input.context, 'OCR ayar kimliği veya gerekçesi geçersizdir.'));
    }
    const mutationKind: LocalGovernedOcrMutationKind = input.command.enabled ? 'processing_enable' : 'processing_disable';
    return executeMutation(this.unitOfWork, { context: input.context, key: key.value,
      expectedRevision: input.command.expectedRevision, clientOperationId: input.command.clientOperationId,
      identifiers: input.identifiers }, {
      mutationKind, resourceType: 'local_ocr_settings', authorization: { primary: settingsIntent(key.value, 'update') },
      loadCurrent: (scope) => { const center = scope.loadCenter(key.value);
        return center.ok ? ok({ revision: center.value.settings.revision, stateFingerprint: center.value.settings.stateFingerprint }) : center; },
      prepare: async (scope) => {
        const center = scope.loadCenter(key.value); if (!center.ok) return center;
        if (center.value.settings.revision !== input.command.expectedRevision
          || center.value.settings.enabled === input.command.enabled) return err(conflict(input.context, 'OCR ayarı değişmemiş veya revizyonu güncel değildir.'));
        const view: LocalGovernedOcrSettingsView = {
          key: key.value, revision: center.value.settings.revision + 1, enabled: input.command.enabled,
          ...(input.command.enabled ? {} : { disabledReason: input.command.reason, disabledAt: scope.occurredAt }),
          updatedAt: scope.occurredAt
        };
        const nextSettings = settingsRow(view);
        const runningJobs = input.command.enabled ? [] : center.value.jobs.filter((job) => job.status === 'running');
        return ok({ previousRevision: center.value.settings.revision, revision: nextSettings.revision,
          stateFingerprint: nextSettings.stateFingerprint, persist: async () => {
            for (const current of runningJobs) {
              const requested = await this.runtime.requestCancellation({ jobId: current.id, correlationId: input.context.correlationId });
              if (!requested.ok) return requested;
            }
            const savedSettings = scope.saveSettings(nextSettings, center.value.settings.revision);
            return savedSettings.ok && savedSettings.value ? ok(undefined)
              : savedSettings.ok ? err(conflict(input.context, 'OCR ayar revizyonu yarıştı.')) : savedSettings;
          } });
      }
    });
  }
}

export class GetLocalGovernedOcrResultUseCase {
  public constructor(private readonly unitOfWork: LocalGovernedOcrUnitOfWork, private readonly runtime: LocalGovernedOcrRuntimePort) {}

  public async execute(input: { readonly context: LocalGovernedOcrApplicationContext; readonly jobId: string; readonly auditId: string }) {
    const key = keyFor(input.context); if (!key.ok) return key;
    if (!IDENTIFIER.test(input.jobId) || !IDENTIFIER.test(input.auditId)) return err(invalid(input.context, 'OCR sonuç okuma kimliği geçersizdir.'));
    const source = resolveJobSourceMetadata(this.unitOfWork, input.context, key.value, input.jobId); if (!source.ok) return source;
    return this.unitOfWork.execute(input.context, { primary: jobIntent(key.value, 'read', input.jobId, source.value.sensitivity),
      source: sourceIntent(key.value, 'read', source.value.resourceId, source.value.sensitivity) }, async (scope) => {
      const current = loadExactJob(scope, input.context, key.value, input.jobId); if (!current.ok) return current;
      if (current.value.status !== 'completed' || !current.value.resultAvailable || !current.value.sealedResultId
        || !current.value.resultContentSha256) return err(conflict(input.context, 'OCR sonucu okunabilir durumda değildir.'));
      const authority = resolveSourceAndConsent(scope, input.context, key.value, current.value.source.resourceId, 'read');
      if (!authority.ok) return authority;
      const read = await this.runtime.readSealedResult({ jobId: current.value.id,
        sealedResultId: current.value.sealedResultId, correlationId: input.context.correlationId });
      if (!read.ok) return read;
      if (read.value.networkUsed || read.value.cloudUsed || read.value.contentSha256 !== current.value.resultContentSha256
        || read.value.text.length < 1 || read.value.text.length > LOCAL_GOVERNED_OCR_MAX_RESULT_CHARACTERS) {
        return err(denied(input.context, 'OCR sealed sonuç bütünlüğü doğrulanamadı.'));
      }
      const audited = scope.appendAudit({ id: input.auditId, action: 'ocr.result_read', resourceType: 'local_ocr_job',
        resourceId: current.value.id, occurredAt: scope.occurredAt, actorId: input.context.actor.userId });
      return audited.ok ? ok<LocalGovernedOcrResultView>({ jobId: current.value.id, revision: current.value.revision,
        text: read.value.text, contentSha256: read.value.contentSha256,
        corrected: current.value.correctionRevision > 0, payloadSource: 'sealed_local_result', networkUsed: false, cloudUsed: false }) : audited;
    });
  }
}

export class SearchLocalGovernedOcrUseCase {
  public constructor(private readonly unitOfWork: LocalGovernedOcrUnitOfWork, private readonly runtime: LocalGovernedOcrRuntimePort) {}

  public async execute(input: {
    readonly context: LocalGovernedOcrApplicationContext;
    readonly command: SearchLocalGovernedOcrInput;
    readonly auditId: string;
  }): Promise<Result<LocalGovernedOcrSearchView, AppError>> {
    const key = keyFor(input.context); if (!key.ok) return key;
    const queryTokens = canonicalLocalGovernedOcrSearchTokens(input.command.query);
    const limit = input.command.limit ?? 10;
    if (!queryTokens || !Number.isSafeInteger(limit) || limit < 1 || limit > LOCAL_GOVERNED_OCR_MAX_SEARCH_MATCHES
      || !IDENTIFIER.test(input.auditId)) return err(invalid(input.context, 'OCR arama sorgusu veya limiti geçersizdir.'));

    const enumeration = await this.unitOfWork.execute(input.context, { primary: settingsIntent(key.value, 'read') }, (scope) => {
      const loaded = scope.loadCenter(key.value);
      if (!loaded.ok) return loaded;
      if (!exactKey(loaded.value.settings.key, key.value) || loaded.value.jobs.length > LOCAL_GOVERNED_OCR_MAX_JOBS
        || loaded.value.jobs.some((job) => !exactKey(job.key, key.value))) {
        return err(unexpected(input.context, 'OCR arama aday kapsamı veya limiti geçersizdir.'));
      }
      const audited = scope.appendAudit({ id: input.auditId, action: 'ocr.search_requested', resourceType: 'local_ocr_settings',
        resourceId: localGovernedOcrSettingsResourceId(key.value.ownerPersonId), occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId });
      if (!audited.ok) return audited;
      const jobs = loaded.value.jobs
        .filter((job) => job.status === 'completed' && job.resultAvailable && Boolean(job.sealedResultId) && Boolean(job.resultContentSha256))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id));
      return ok({ jobs, generatedAt: scope.occurredAt });
    });
    if (!enumeration.ok) return enumeration;

    const candidates = enumeration.value.jobs.slice(0, LOCAL_GOVERNED_OCR_MAX_SEARCH_CANDIDATES);
    const matches: LocalGovernedOcrSearchMatchView[] = [];
    let truncated = enumeration.value.jobs.length > candidates.length;
    for (const candidate of candidates) {
      const source = resolveJobSourceMetadata(this.unitOfWork, input.context, key.value, candidate.id);
      if (!source.ok) {
        if (source.error.code === ERROR_CODES.RESOURCE_CONFLICT) { truncated = true; continue; }
        if (source.error.code === ERROR_CODES.AUTHORIZATION_DENIED
          || source.error.code === ERROR_CODES.RESOURCE_NOT_FOUND
        ) continue;
        return source;
      }
      const correlationId = asCorrelationId(`ocr-search-${hash(`${input.context.correlationId}|${candidate.id}`).slice(0, 48)}`);
      const context: LocalGovernedOcrApplicationContext = { ...input.context, correlationId };
      const searched = await this.unitOfWork.execute(context, {
        primary: jobIntent(key.value, 'read', candidate.id, source.value.sensitivity),
        source: sourceIntent(key.value, 'read', source.value.resourceId, source.value.sensitivity)
      }, async (scope): Promise<Result<LocalGovernedOcrSearchMatchView | null, AppError>> => {
        const current = loadExactJob(scope, context, key.value, candidate.id); if (!current.ok) return current;
        if (current.value.revision !== candidate.revision || current.value.status !== 'completed'
          || !current.value.resultAvailable || !current.value.sealedResultId || !current.value.resultContentSha256) return ok(null);
        const authority = resolveSourceAndConsent(scope, context, key.value, current.value.source.resourceId, 'read');
        if (!authority.ok) return authority;
        const found = await this.runtime.searchSealedResult({ jobId: current.value.id,
          sealedResultId: current.value.sealedResultId, query: input.command.query, correlationId });
        if (!found.ok) return found;
        if (found.value.contentSha256 !== current.value.resultContentSha256) {
          return err(conflict(context, 'OCR arama sealed-index içerik bağı güncel değildir.'));
        }
        if (found.value.networkUsed || found.value.cloudUsed || found.value.snippetMasked !== true
          || typeof found.value.matched !== 'boolean'
          || !Number.isSafeInteger(found.value.matchedTokenCount) || found.value.matchedTokenCount < 0
          || !(found.value.pageNumber === null || (Number.isSafeInteger(found.value.pageNumber)
            && found.value.pageNumber >= 1 && found.value.pageNumber <= (current.value.resultPageCount ?? LOCAL_GOVERNED_OCR_MAX_PAGES)))) {
          return err(denied(context, 'OCR arama sealed-index sonucu doğrulanamadı.'));
        }
        const auditId = hash(`${input.auditId}|${current.value.id}`);
        const audited = scope.appendAudit({ id: auditId, action: 'ocr.search_result_checked', resourceType: 'local_ocr_job',
          resourceId: current.value.id, occurredAt: scope.occurredAt, actorId: context.actor.userId });
        if (!audited.ok) return audited;
        if (!found.value.matched) {
          return found.value.snippet === null && found.value.matchedTokenCount === 0 && found.value.pageNumber === null
            ? ok(null) : err(denied(context, 'OCR arama negatif sonucu geçersizdir.'));
        }
        if (found.value.matchedTokenCount !== queryTokens.length || typeof found.value.snippet !== 'string'
          || found.value.snippet.length < 1 || found.value.snippet.length > LOCAL_GOVERNED_OCR_MAX_SEARCH_SNIPPET_CHARACTERS) {
          return err(denied(context, 'OCR arama snippet sonucu geçersizdir.'));
        }
        return ok({ jobId: current.value.id, revision: current.value.revision, snippet: found.value.snippet,
          snippetMasked: true, matchedTokenCount: found.value.matchedTokenCount, pageNumber: found.value.pageNumber,
          corrected: current.value.correctionRevision > 0, networkUsed: false, cloudUsed: false });
      });
      if (!searched.ok) {
        if (searched.error.code === ERROR_CODES.RESOURCE_CONFLICT) { truncated = true; continue; }
        if (searched.error.code === ERROR_CODES.AUTHORIZATION_DENIED
          || searched.error.code === ERROR_CODES.RESOURCE_NOT_FOUND
        ) continue;
        return searched;
      }
      if (searched.value) matches.push(searched.value);
      if (matches.length > limit) { truncated = true; break; }
    }
    return ok({ schemaVersion: 1, matches: Object.freeze(matches.slice(0, limit)), truncated,
      policyFiltered: true, encryptedIndexAtRest: true, snippetsMasked: true, queryEchoed: false,
      networkUsed: false, cloudUsed: false, generatedAt: enumeration.value.generatedAt });
  }
}

export class PropagateLocalGovernedOcrSourceDeletionUseCase {
  public constructor(private readonly unitOfWork: LocalGovernedOcrUnitOfWork, private readonly runtime: LocalGovernedOcrRuntimePort) {}

  public async execute(input: { readonly context: LocalGovernedOcrApplicationContext;
    readonly command: PropagateLocalGovernedOcrSourceDeletionInput; readonly identifiers: LocalGovernedOcrOperationIdentifiers }) {
    const key = keyFor(input.context); if (!key.ok) return key;
    if (input.command.sourceResourceType !== 'archive_item' || !IDENTIFIER.test(input.command.sourceResourceId)
      || !validTime(input.command.purgedAt) || input.identifiers.resourceId !== input.command.sourceResourceId
      || !IDENTIFIER.test(input.command.clientOperationId) || !identifiersValid(input.identifiers)) {
      return err(invalid(input.context, 'OCR source deletion girdisi veya işlem kimlikleri geçersizdir.'));
    }
    const sourceMetadata = resolveArchiveMetadata(
      this.unitOfWork, input.context, key.value, input.command.sourceResourceId
    );
    if (!sourceMetadata.ok) return sourceMetadata;
    const authorization: LocalGovernedOcrAuthorizationPlan = { primary: {
      action: 'delete', capability: 'archive.write', resourceType: 'archive_item',
      resourceId: input.command.sourceResourceId, purpose: 'ocr_process', familyId: key.value.familyId,
      ownerPersonId: key.value.ownerPersonId, privacy: 'private', sensitivity: sourceMetadata.value.sensitivity
    } };
    return this.unitOfWork.execute(input.context, authorization, async (scope) => {
      const replay = scope.findSourceDeletionMutationByClientOperationId(
        key.value, input.command.sourceResourceId, input.command.clientOperationId
      );
      if (!replay.ok) return replay;
      const jobs = scope.listJobsBySource(key.value, 'archive_item', input.command.sourceResourceId);
      if (!jobs.ok) return jobs;
      if (jobs.value.some((job) => !exactKey(job.key, key.value)
        || job.source.resourceType !== 'archive_item' || job.source.resourceId !== input.command.sourceResourceId)) {
        return err(denied(input.context, 'OCR source deletion kapsamı uyuşmuyor.'));
      }
      if (replay.value) {
        if (replay.value.requestFingerprint !== input.identifiers.requestFingerprint
          || replay.value.mutationKind !== 'source_delete_propagate'
          || replay.value.resourceType !== 'local_ocr_job'
          || replay.value.resourceId !== input.command.sourceResourceId
          || replay.value.previousRevision !== 0 || replay.value.revision !== 1
          || jobs.value.some((job) => job.sourceDeletedAt === undefined)
          || replay.value.stateFingerprint !== sourceDeletionStateFingerprint(jobs.value)) {
          return err(conflict(input.context, 'OCR source deletion replay kapsamı veya current state ile uyuşmuyor.'));
        }
        return ok(mutationReceipt(replay.value, true));
      }

      const items: LocalGovernedOcrSourceDeletionBatch['items'][number][] = [];
      for (const current of jobs.value.filter((job) => job.sourceDeletedAt === undefined)) {
        if (current.sealedResultId) {
          const purged = await this.runtime.purgeSealedResult({ jobId: current.id,
            sealedResultId: current.sealedResultId, correlationId: input.context.correlationId });
          if (!purged.ok || !purged.value.deleted || !purged.value.verified) return purged.ok
            ? err(unexpected(input.context, 'PPK-019 yerel sealed-result silme işlemi doğrulanamadı.')) : purged;
        }
        const { stateFingerprint: _fingerprint, sealedResultId: _sealed, resultContentSha256: _content,
          resultCharacterCount: _chars, resultPageCount: _pages, confidenceBasisPoints: _confidence,
          derivedBindingHash: _binding, failureCode: _failure, cancellationRequestedAt: _cancelRequest,
          completedAt: _completed, failedAt: _failed, cancelledAt: _cancelled, ...base } = current;
        const next = jobRow({ ...base, revision: current.revision + 1, status: 'deleted', resultAvailable: false,
          deletedAt: current.deletedAt ?? scope.occurredAt, sourceDeletedAt: scope.occurredAt,
          deletionPropagation: 'locally_deleted', updatedAt: scope.occurredAt });
        items.push({ previous: current, next });
      }
      const nextById = new Map(items.map((item) => [item.next.id, item.next]));
      const finalRows = jobs.value.map((row) => nextById.get(row.id) ?? row);
      const mutation: LocalGovernedOcrMutationRow & { readonly mutationKind: 'source_delete_propagate';
        readonly resourceType: 'local_ocr_job' } = {
        id: input.identifiers.mutationId, key: key.value,
        clientOperationId: input.command.clientOperationId,
        requestFingerprint: input.identifiers.requestFingerprint,
        mutationKind: 'source_delete_propagate', resourceType: 'local_ocr_job',
        resourceId: input.command.sourceResourceId,
        previousRevision: 0, revision: 1,
        stateFingerprint: sourceDeletionStateFingerprint(finalRows), occurredAt: scope.occurredAt
      };
      const persisted = scope.propagateSourceDeletion({ sourceResourceType: 'archive_item',
        sourceResourceId: input.command.sourceResourceId, batchMutation: mutation, items });
      if (!persisted.ok) return persisted;
      const audited = scope.appendAudit({ id: input.identifiers.auditId, action: 'ocr.source_delete_propagate',
        resourceType: 'archive_item', resourceId: input.command.sourceResourceId,
        occurredAt: scope.occurredAt, actorId: input.context.actor.userId });
      if (!audited.ok) return audited;
      const event: DomainEvent<{ readonly clientOperationId: string; readonly mutationKind: 'source_delete_propagate';
        readonly revision: 1; readonly stateFingerprint: string }> = {
        eventId: input.identifiers.outboxEventId, eventType: 'ocr.state.changed', eventVersion: 1,
        aggregateType: 'archive_item', aggregateId: input.command.sourceResourceId,
        occurredAt: scope.occurredAt, actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: { clientOperationId: input.command.clientOperationId, mutationKind: 'source_delete_propagate',
          revision: 1, stateFingerprint: mutation.stateFingerprint }
      };
      const queued = scope.enqueueEvent(event);
      return queued.ok ? ok(mutationReceipt(mutation, false)) : queued;
    });
  }
}
