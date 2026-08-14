import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
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
  LOCAL_GOVERNED_OCR_MAX_SOURCE_BYTES,
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
  type LocalGovernedOcrSettingsView,
  type PropagateLocalGovernedOcrSourceDeletionInput,
  type RerunLocalGovernedOcrJobInput,
  type RunLocalGovernedOcrJobInput,
  type SetLocalGovernedOcrEnabledInput
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import {
  DerivedDataInheritancePolicy,
  type DerivedDataPolicyBinding,
  type DerivedDataTargetPolicy
} from '@ppt/platform-policy';
import type {
  LocalGovernedOcrCenterSnapshotRow,
  LocalGovernedOcrConsentRow,
  LocalGovernedOcrJobRow,
  LocalGovernedOcrMutationRow,
  LocalGovernedOcrPolicyResourceMetadata,
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
  /** Every supplied intent is authorized by the central PEP before the shared transaction callback runs. */
  execute<T>(
    context: LocalGovernedOcrApplicationContext,
    authorization: LocalGovernedOcrAuthorizationPlan,
    operation: (scope: LocalGovernedOcrWriteScope) => Result<T, AppError> | Promise<Result<T, AppError>>
  ): Promise<Result<T, AppError>>;
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
  const { sealedResultId: _sealed, stateFingerprint: _fingerprint, ...view } = row;
  return view;
};
const settingsView = (row: LocalGovernedOcrSettingsRow): LocalGovernedOcrSettingsView => {
  const { stateFingerprint: _fingerprint, ...view } = row;
  return view;
};
const jobRow = (view: LocalGovernedOcrJobView, sealedResultId?: string): LocalGovernedOcrJobRow => ({
  ...view,
  ...(sealedResultId === undefined ? {} : { sealedResultId }),
  stateFingerprint: hash(canonicalLocalGovernedOcrJobStateJson(view))
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

const executeMutation = async (
  unitOfWork: LocalGovernedOcrUnitOfWork,
  input: {
    readonly context: LocalGovernedOcrApplicationContext;
    readonly key: LocalGovernedOcrAggregateKey;
    readonly expectedRevision: number;
    readonly clientOperationId: string;
    readonly identifiers: LocalGovernedOcrOperationIdentifiers;
  },
  specification: {
    readonly mutationKind: LocalGovernedOcrMutationKind;
    readonly resourceType: LocalGovernedOcrResourceType;
    readonly authorization: LocalGovernedOcrAuthorizationPlan;
    loadCurrent(scope: LocalGovernedOcrWriteScope): Result<CurrentMutationState | null, AppError>;
    prepare(scope: LocalGovernedOcrWriteScope): Result<PreparedMutation, AppError> | Promise<Result<PreparedMutation, AppError>>;
  }
): Promise<Result<LocalGovernedOcrMutationReceiptView, AppError>> => {
  if (!validRevision(input.expectedRevision) || !IDENTIFIER.test(input.clientOperationId)
    || !identifiersValid(input.identifiers)) {
    return err(invalid(input.context, 'OCR işlem kimliği, revizyonu veya fingerprint geçersiz.'));
  }
  return unitOfWork.execute(input.context, specification.authorization, async (scope) => {
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
  });
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
          sourceDeletionAutoResumeGuaranteed: false,
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
    if (input.command.jobId !== input.identifiers.resourceId) return err(invalid(input.context, 'OCR iş kimliği uyuşmuyor.'));
    const sourceMetadata = resolveJobSourceMetadata(this.unitOfWork, input.context, key.value, input.command.jobId);
    if (!sourceMetadata.ok) return sourceMetadata;
    const authorization: LocalGovernedOcrAuthorizationPlan = {
      primary: jobIntent(key.value, 'process', input.command.jobId, sourceMetadata.value.sensitivity),
      source: sourceIntent(key.value, 'process', sourceMetadata.value.resourceId, sourceMetadata.value.sensitivity),
      settings: settingsReadIntent(key.value),
      target: targetIntent(key.value, input.command.jobId, sourceMetadata.value.derivedResourceId,
        sourceMetadata.value.sensitivity)
    };
    return executeMutation(this.unitOfWork, {
      context: input.context, key: key.value, expectedRevision: input.command.expectedRevision,
      clientOperationId: input.command.clientOperationId, identifiers: input.identifiers
    }, {
      mutationKind: 'job_run', resourceType: 'local_ocr_job', authorization,
      loadCurrent: (scope) => {
        const loaded = scope.findJob(key.value, input.command.jobId);
        return loaded.ok ? ok(loaded.value ? { revision: loaded.value.revision, stateFingerprint: loaded.value.stateFingerprint } : null) : loaded;
      },
      prepare: async (scope) => {
        const current = loadExactJob(scope, input.context, key.value, input.command.jobId);
        if (!current.ok) return current;
        if (current.value.revision !== input.command.expectedRevision) return err(conflict(input.context, 'OCR iş revizyonu güncel değildir.'));
        if (current.value.status !== 'queued') return err(conflict(input.context, 'Yalnız sıradaki OCR işi çalıştırılabilir.'));
        const center = scope.loadCenter(key.value);
        if (!center.ok) return center;
        if (!center.value.settings.enabled) return err(conflict(input.context, 'Yerel OCR işlemesi devre dışıdır.'));
        const authority = resolveSourceAndConsent(scope, input.context, key.value, current.value.source.resourceId, 'process');
        if (!authority.ok) return authority;
        if (authority.value.source.inputSha256 !== current.value.source.inputSha256) {
          return err(conflict(input.context, 'Arşiv kaynağı değişmiştir; açık rerun işlemi gerekir.'));
        }
        const executed = await this.runtime.runAndSeal({
          jobId: current.value.id, derivedResourceId: current.value.derivedResourceId,
          sourceResourceType: 'archive_item', sourceResourceId: current.value.source.resourceId,
          expectedInputSha256: current.value.source.inputSha256,
          languageHints: current.value.languageHints, correlationId: input.context.correlationId
        });
        if (!executed.ok) return executed;
        if (executed.value.networkUsed || executed.value.cloudUsed) {
          return err(denied(input.context, 'Yerel OCR runtime ağ veya bulut kullanımı bildirdi.'));
        }
        const nextRevision = current.value.revision + 1;
        if (executed.value.status === 'failed') {
          const { stateFingerprint: _fingerprint, sealedResultId: _sealed, ...base } = current.value;
          const row = jobRow({ ...base, revision: nextRevision, status: 'failed', runAttempt: current.value.runAttempt + 1,
            resultAvailable: false, failureCode: executed.value.failureCode, failedAt: executed.value.failedAt,
            consentId: authority.value.consent.id,
            ...(authority.value.consent.endsAt === undefined ? {} : { consentExpiresAt: authority.value.consent.endsAt }),
            updatedAt: scope.occurredAt });
          return ok({ previousRevision: current.value.revision, revision: nextRevision, stateFingerprint: row.stateFingerprint,
            persist: async () => {
              const saved = scope.saveJob(row, current.value.revision);
              return saved.ok && saved.value ? ok(undefined) : saved.ok ? err(conflict(input.context, 'OCR iş revizyonu yarıştı.')) : saved;
            } });
        }
        if (executed.value.status === 'cancelled') {
          const { stateFingerprint: _fingerprint, sealedResultId: _sealed, ...base } = current.value;
          const row = jobRow({ ...base, revision: nextRevision, status: 'cancelled', runAttempt: current.value.runAttempt + 1,
            resultAvailable: false, cancelledAt: executed.value.cancelledAt, consentId: authority.value.consent.id,
            ...(authority.value.consent.endsAt === undefined ? {} : { consentExpiresAt: authority.value.consent.endsAt }),
            updatedAt: scope.occurredAt });
          return ok({ previousRevision: current.value.revision, revision: nextRevision, stateFingerprint: row.stateFingerprint,
            persist: () => {
              const saved = scope.saveJob(row, current.value.revision);
              return saved.ok && saved.value ? ok(undefined) : saved.ok ? err(conflict(input.context, 'OCR iş revizyonu yarıştı.')) : saved;
            } });
        }
        if (!validSealedResult(executed.value, current.value.source.inputSha256)) {
          return err(denied(input.context, 'OCR runtime sonucu bütünlük veya limit kontrolünden geçmedi.'));
        }
        const binding = sealDerivedBinding(scope, input.context, key.value, authority.value.source,
          current.value, executed.value,
          `run-${current.value.runAttempt + 1}-correction-${current.value.correctionRevision}`,
          this.inheritance);
        if (!binding.ok) return binding;
        const { stateFingerprint: _fingerprint, sealedResultId: _sealed, failureCode: _failure,
          failedAt: _failed, cancelledAt: _cancelled, cancellationRequestedAt: _cancelRequested, ...base } = current.value;
        const row = jobRow({
          ...base, revision: nextRevision, status: 'completed', runAttempt: current.value.runAttempt + 1,
          resultAvailable: true, resultContentSha256: executed.value.contentSha256,
          resultCharacterCount: executed.value.characterCount, resultPageCount: executed.value.pageCount,
          ...(executed.value.confidenceBasisPoints === undefined ? {} : { confidenceBasisPoints: executed.value.confidenceBasisPoints }),
          derivedBindingHash: binding.value.bindingHash,
          consentId: authority.value.consent.id,
          ...(authority.value.consent.endsAt === undefined ? {} : { consentExpiresAt: authority.value.consent.endsAt }),
          completedAt: executed.value.completedAt, updatedAt: scope.occurredAt
        }, executed.value.sealedResultId);
        return ok({ previousRevision: current.value.revision, revision: nextRevision, stateFingerprint: row.stateFingerprint,
          persist: () => {
            const saved = scope.saveJob(row, current.value.revision);
            return saved.ok && saved.value ? ok(undefined) : saved.ok ? err(conflict(input.context, 'OCR iş revizyonu yarıştı.')) : saved;
          } });
      }
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
        const row = jobRow(view, current.value.sealedResultId);
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
