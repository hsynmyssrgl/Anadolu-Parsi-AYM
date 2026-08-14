import { createHash } from 'node:crypto';
import {
  ReadArchiveFileBytesUseCase,
  type ArchiveVaultFilePort,
  type LocalGovernedOcrRunOutcome,
  type LocalGovernedOcrRuntimePort,
  type LocalGovernedOcrSealedResult
} from '@ppt/application';
import {
  ERROR_CODES,
  asIsoDateTime,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type Result
} from '@ppt/core';
import {
  LOCAL_OCR_MAX_INPUT_BYTES,
  LOCAL_OCR_MAX_OUTPUT_BYTES,
  LOCAL_OCR_MAX_TEXT_CHARACTERS,
  LocalOcrSecurityError,
  inspectLocalOcrSource,
  type LocalOcrMediaType,
  type LocalOcrResult
} from '@ppt/security';
import {
  BoundedLocalOcrWorker,
  NotConfiguredLocalOcrMalwareVerdictAdapter,
  type BoundedLocalOcrWorkerOptions,
  type LocalOcrMalwareVerdictPort
} from './local-ocr-worker.js';
import { WindowsMediaOcrEngineAdapter } from './windows-media-ocr-engine-adapter.js';
import {
  LocalGovernedOcrResultVault,
  LocalGovernedOcrResultVaultError,
  LOCAL_GOVERNED_OCR_SEARCH_INDEX_PERSISTED,
  deriveLocalGovernedOcrCorrectionSealedResultId,
  deriveLocalGovernedOcrRunSealedResultId,
  type LocalGovernedOcrRuntimeBinding,
  type LocalGovernedOcrSealedPayload
} from './local-governed-ocr-result-vault.js';
import {
  buildLocalGovernedOcrSearchIndex,
  searchLocalGovernedOcrText
} from './local-governed-ocr-search-index.js';

const SHA256 = /^[0-9a-f]{64}$/u;
const IDENTIFIER = /^[A-Za-z0-9._:-]{1,160}$/u;
const LANGUAGE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})?$/u;
const MAX_LANGUAGE_HINTS = 8;
const DEFAULT_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1_000;
const MINIMUM_ORPHAN_GRACE_MS = 5 * 60 * 1_000;
const MAXIMUM_ORPHAN_GRACE_MS = 30 * 24 * 60 * 60 * 1_000;

export interface AuthorizedLocalGovernedOcrArchiveSource extends LocalGovernedOcrRuntimeBinding {
  readonly authority: 'central_pep_authorized_archive_vault_read';
  readonly resourceType: 'archive_item';
  readonly storedName: string;
  readonly originalName: string;
  readonly mimeType: LocalOcrMediaType;
  readonly sizeBytes: number;
}

export interface AuthorizedLocalGovernedOcrJobBinding extends LocalGovernedOcrRuntimeBinding {
  readonly authority: 'central_pep_authorized_local_ocr_job';
  readonly currentSealedResultId: string | null;
}

export type LocalGovernedOcrRuntimeJobOperation = 'read' | 'search' | 'correct' | 'purge' | 'cancel' | 'orphan_sweep';

/**
 * Main-only adapter supplied by the central PEP transaction composition. Merely knowing a file name or
 * job id is not authority: every runtime call must resolve an exact current owner/account/family binding.
 */
export interface LocalGovernedOcrMainAuthorityPort {
  resolveAuthorizedArchiveSource(input: {
    readonly operation: 'run';
    readonly runId: string;
    readonly jobId: string;
    readonly derivedResourceId: string;
    readonly sourceResourceId: string;
    readonly expectedInputSha256: string;
    readonly correlationId: CorrelationId;
  }): Result<AuthorizedLocalGovernedOcrArchiveSource, AppError>
    | Promise<Result<AuthorizedLocalGovernedOcrArchiveSource, AppError>>;
  resolveAuthorizedJobBinding(input: {
    readonly operation: LocalGovernedOcrRuntimeJobOperation;
    readonly jobId: string;
    readonly sealedResultId: string | null;
    readonly correlationId: CorrelationId;
  }): Result<AuthorizedLocalGovernedOcrJobBinding, AppError>
    | Promise<Result<AuthorizedLocalGovernedOcrJobBinding, AppError>>;
}

export interface LocalGovernedOcrRuntimeAdapterOptions {
  readonly authority: LocalGovernedOcrMainAuthorityPort;
  readonly archiveVaultFiles: ArchiveVaultFilePort;
  readonly resultVault: LocalGovernedOcrResultVault;
  readonly worker: BoundedLocalOcrWorker;
  readonly now?: () => string;
  readonly orphanGraceMs?: number;
}

export interface WindowsLocalGovernedOcrRuntimeOptions
  extends Omit<LocalGovernedOcrRuntimeAdapterOptions, 'worker'> {
  /** Omission deliberately composes the fail-closed NOT_CONFIGURED malware provider. */
  readonly malwareScanner?: LocalOcrMalwareVerdictPort;
  readonly workerOptions?: BoundedLocalOcrWorkerOptions;
}

export interface LocalGovernedOcrOrphanSweepResult {
  readonly scanned: number;
  readonly deleted: number;
  readonly referenced: number;
  readonly rejected: number;
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

const hashText = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const validIdentifier = (value: unknown): value is string => typeof value === 'string'
  && value === value.trim() && IDENTIFIER.test(value);
const validLeafName = (value: unknown): value is string => typeof value === 'string'
  && value === value.trim() && value.length >= 3 && value.length <= 128
  && value !== '.' && value !== '..' && !/[\\/:\u0000-\u001f\u007f]/u.test(value)
  && !value.startsWith('.') && !value.endsWith('.') && !value.endsWith(' ');
const validMime = (value: unknown): value is LocalOcrMediaType =>
  value === 'image/png' || value === 'image/jpeg' || value === 'application/pdf';
const validBinding = (value: LocalGovernedOcrRuntimeBinding): boolean => validIdentifier(value.familyId)
  && validIdentifier(value.accountId) && validIdentifier(value.ownerPersonId) && validIdentifier(value.jobId)
  && validIdentifier(value.derivedResourceId) && validIdentifier(value.sourceResourceId)
  && SHA256.test(value.inputSha256);
const sameBinding = (left: LocalGovernedOcrRuntimeBinding, right: LocalGovernedOcrRuntimeBinding): boolean =>
  left.familyId === right.familyId && left.accountId === right.accountId
  && left.ownerPersonId === right.ownerPersonId && left.jobId === right.jobId
  && left.derivedResourceId === right.derivedResourceId && left.sourceResourceId === right.sourceResourceId
  && left.inputSha256 === right.inputSha256;
const exactRuntimeBinding = (value: LocalGovernedOcrRuntimeBinding): LocalGovernedOcrRuntimeBinding => Object.freeze({
  familyId: value.familyId,
  accountId: value.accountId,
  ownerPersonId: value.ownerPersonId,
  jobId: value.jobId,
  derivedResourceId: value.derivedResourceId,
  sourceResourceId: value.sourceResourceId,
  inputSha256: value.inputSha256
});
const validLanguageHints = (value: readonly string[]): boolean => Array.isArray(value)
  && value.length <= MAX_LANGUAGE_HINTS && value.every((item) => LANGUAGE.test(item))
  && new Set(value.map((item) => item.toLowerCase())).size === value.length;
const validCorrectedText = (value: string): boolean => typeof value === 'string'
  && value.length >= 1 && value.length <= LOCAL_OCR_MAX_TEXT_CHARACTERS
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);

const appError = (
  correlationId: CorrelationId,
  code: typeof ERROR_CODES.CORE_INVALID_ARGUMENT | typeof ERROR_CODES.AUTHORIZATION_DENIED
    | typeof ERROR_CODES.RESOURCE_NOT_FOUND | typeof ERROR_CODES.RESOURCE_CONFLICT | typeof ERROR_CODES.CORE_UNEXPECTED,
  category: 'validation' | 'authorization' | 'not_found' | 'conflict' | 'security' | 'unexpected',
  message: string
): AppError => createAppError({ code, category, message, correlationId });

const invalid = (correlationId: CorrelationId): AppError => appError(
  correlationId, ERROR_CODES.CORE_INVALID_ARGUMENT, 'validation', 'Yerel OCR runtime girdisi geçersizdir.'
);
const denied = (correlationId: CorrelationId): AppError => appError(
  correlationId, ERROR_CODES.AUTHORIZATION_DENIED, 'authorization', 'Yerel OCR runtime owner/authority bağını doğrulayamadı.'
);
const unexpected = (correlationId: CorrelationId): AppError => appError(
  correlationId, ERROR_CODES.CORE_UNEXPECTED, 'security', 'Yerel OCR korumalı sonuç işlemi güvenli biçimde tamamlanamadı.'
);

const nowIso = (clock: () => string, correlationId: CorrelationId): Result<string, AppError> => {
  const value = clock();
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? ok(value)
    : err(unexpected(correlationId));
};

const sealedMetadata = (payload: LocalGovernedOcrSealedPayload): LocalGovernedOcrSealedResult => ({
  sealedResultId: payload.sealedResultId,
  inputSha256: payload.binding.inputSha256,
  contentSha256: payload.contentSha256,
  characterCount: payload.characterCount,
  pageCount: payload.pageCount,
  ...(payload.confidenceBasisPoints === null ? {} : { confidenceBasisPoints: payload.confidenceBasisPoints }),
  completedAt: asIsoDateTime(payload.completedAt),
  networkUsed: false,
  cloudUsed: false
});

const confidenceBasisPoints = (result: LocalOcrResult): number | null => result.confidence.available
  ? Math.max(0, Math.min(10_000, Math.round(Number(result.confidence.value) * 10_000)))
  : null;

const failureCodeFor = (code: LocalOcrSecurityError['code']): 'source_unavailable' | 'engine_failed' | 'integrity_mismatch' =>
  code === 'HASH_MISMATCH' ? 'integrity_mismatch'
    : code === 'INPUT_TOO_LARGE' || code === 'TYPE_MISMATCH' || code === 'INPUT_INVALID' ? 'source_unavailable'
      : 'engine_failed';

export class MainLocalGovernedOcrRuntimeAdapter implements LocalGovernedOcrRuntimePort {
  readonly #authority: LocalGovernedOcrMainAuthorityPort;
  readonly #archiveReader: ReadArchiveFileBytesUseCase;
  readonly #resultVault: LocalGovernedOcrResultVault;
  readonly #worker: BoundedLocalOcrWorker;
  readonly #now: () => string;
  readonly #orphanGraceMs: number;
  readonly #activeJobs = new Map<string, AbortController>();
  #orphanSweepCursor: string | null = null;

  public constructor(options: LocalGovernedOcrRuntimeAdapterOptions) {
    if (!options?.authority || !options.archiveVaultFiles || !(options.resultVault instanceof LocalGovernedOcrResultVault)
      || !(options.worker instanceof BoundedLocalOcrWorker)) throw new Error('Yerel OCR runtime bağımlılıkları geçersizdir.');
    this.#authority = options.authority;
    this.#archiveReader = new ReadArchiveFileBytesUseCase(options.archiveVaultFiles);
    this.#resultVault = options.resultVault;
    this.#worker = options.worker;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#orphanGraceMs = options.orphanGraceMs ?? DEFAULT_ORPHAN_GRACE_MS;
    if (!Number.isSafeInteger(this.#orphanGraceMs) || this.#orphanGraceMs < MINIMUM_ORPHAN_GRACE_MS
      || this.#orphanGraceMs > MAXIMUM_ORPHAN_GRACE_MS) throw new Error('Yerel OCR orphan grace süresi geçersizdir.');
  }

  public truth(): Readonly<{
    executionScope: 'bounded_child_process';
    sourceAuthority: 'archive_vault_read_bytes_only';
    sourceBytesExposedToRenderer: false;
    plaintextResultPersistedInRepository: false;
    networkUsed: false;
    cloudUsed: false;
    lowPrivilegeSandboxVerified: false;
  }> {
    return Object.freeze({
      executionScope: 'bounded_child_process',
      sourceAuthority: 'archive_vault_read_bytes_only',
      sourceBytesExposedToRenderer: false,
      plaintextResultPersistedInRepository: false,
      networkUsed: false,
      cloudUsed: false,
      lowPrivilegeSandboxVerified: false
    });
  }

  public async runAndSeal(input: Parameters<LocalGovernedOcrRuntimePort['runAndSeal']>[0]):
  Promise<Result<LocalGovernedOcrRunOutcome, AppError>> {
    if (!SHA256.test(input.runId) || !validIdentifier(input.jobId) || !validIdentifier(input.derivedResourceId)
      || input.sourceResourceType !== 'archive_item' || !validIdentifier(input.sourceResourceId)
      || !SHA256.test(input.expectedInputSha256) || !validLanguageHints(input.languageHints)) {
      return err(invalid(input.correlationId));
    }
    let sourceBytes: Uint8Array | undefined;
    let inspected: ReturnType<typeof inspectLocalOcrSource> | undefined;
    let controller: AbortController | undefined;
    try {
      const authority = await this.#authority.resolveAuthorizedArchiveSource({
        operation: 'run', runId: input.runId, jobId: input.jobId, derivedResourceId: input.derivedResourceId,
        sourceResourceId: input.sourceResourceId, expectedInputSha256: input.expectedInputSha256,
        correlationId: input.correlationId
      });
      if (!authority.ok) return authority;
      const source = authority.value;
      const binding: LocalGovernedOcrRuntimeBinding = {
        familyId: source.familyId, accountId: source.accountId, ownerPersonId: source.ownerPersonId,
        jobId: source.jobId, derivedResourceId: source.derivedResourceId,
        sourceResourceId: source.sourceResourceId, inputSha256: source.inputSha256
      };
      if (source.authority !== 'central_pep_authorized_archive_vault_read' || source.resourceType !== 'archive_item'
        || !validBinding(binding) || source.jobId !== input.jobId || source.derivedResourceId !== input.derivedResourceId
        || source.sourceResourceId !== input.sourceResourceId || source.inputSha256 !== input.expectedInputSha256
        || !validLeafName(source.storedName) || !validLeafName(source.originalName) || !validMime(source.mimeType)
        || !Number.isSafeInteger(source.sizeBytes) || source.sizeBytes < 12 || source.sizeBytes > LOCAL_OCR_MAX_INPUT_BYTES) {
        return err(denied(input.correlationId));
      }
      const sealedResultId = deriveLocalGovernedOcrRunSealedResultId({ binding, languageHints: input.languageHints });
      const existing = this.#resultVault.readIfPresent(binding, sealedResultId);
      if (existing !== null) return ok({ status: 'completed', ...sealedMetadata(existing) });
      if (this.#activeJobs.has(input.jobId)) {
        return err(appError(input.correlationId, ERROR_CODES.RESOURCE_CONFLICT, 'conflict', 'Yerel OCR işi zaten çalışıyor.'));
      }
      controller = new AbortController();
      this.#activeJobs.set(input.jobId, controller);
      const read = this.#archiveReader.execute(input.correlationId, {
        itemId: source.sourceResourceId,
        storedName: source.storedName,
        expectedSha256: source.inputSha256,
        expectedSizeBytes: source.sizeBytes,
        maximumBytes: LOCAL_OCR_MAX_INPUT_BYTES
      });
      if (!read.ok) {
        const time = nowIso(this.#now, input.correlationId);
        return time.ok ? ok({ status: 'failed', failedAt: asIsoDateTime(time.value),
          failureCode: read.error.code === ERROR_CODES.CORE_UNEXPECTED ? 'integrity_mismatch' : 'source_unavailable',
          networkUsed: false, cloudUsed: false }) : time;
      }
      sourceBytes = read.value;
      inspected = inspectLocalOcrSource({
        fileName: source.originalName,
        mediaType: source.mimeType,
        bytes: sourceBytes,
        expectedSha256: source.inputSha256
      });
      const result = await this.#worker.run(inspected, controller.signal);
      inspected = undefined; // BoundedLocalOcrWorker consumed and zeroed it.
      if (!validCorrectedText(result.text)) throw new LocalOcrSecurityError('OUTPUT_LIMIT_EXCEEDED');
      const completed = nowIso(this.#now, input.correlationId);
      if (!completed.ok) return completed;
      const contentSha256 = hashText(result.text);
      const payload: LocalGovernedOcrSealedPayload = Object.freeze({
        schemaVersion: 2,
        kind: 'local-governed-ocr-sealed-result-v1',
        sealedResultId,
        binding: Object.freeze(binding),
        text: result.text,
        contentSha256,
        characterCount: result.text.length,
        pageCount: result.pageCount,
        confidenceBasisPoints: confidenceBasisPoints(result),
        completedAt: completed.value,
        corrected: false,
        previousSealedResultId: null,
        searchIndex: buildLocalGovernedOcrSearchIndex(result.text, contentSha256),
        providerResult: result,
        networkUsed: false,
        cloudUsed: false
      });
      try { this.#resultVault.publish(payload); }
      catch (error) {
        if (!(error instanceof LocalGovernedOcrResultVaultError) || error.code !== 'NO_OVERWRITE_CONFLICT') throw error;
      }
      const verified = this.#resultVault.read(binding, sealedResultId);
      if (verified.contentSha256 !== payload.contentSha256 || verified.characterCount !== payload.characterCount) {
        return err(unexpected(input.correlationId));
      }
      return ok({ status: 'completed', ...sealedMetadata(verified) });
    } catch (error) {
      if (error instanceof LocalOcrSecurityError) {
        const time = nowIso(this.#now, input.correlationId);
        if (!time.ok) return time;
        if (error.code === 'CANCELLED') return ok({ status: 'cancelled', cancelledAt: asIsoDateTime(time.value),
          networkUsed: false, cloudUsed: false });
        return ok({ status: 'failed', failedAt: asIsoDateTime(time.value), failureCode: failureCodeFor(error.code),
          networkUsed: false, cloudUsed: false });
      }
      return err(unexpected(input.correlationId));
    } finally {
      if (controller !== undefined && this.#activeJobs.get(input.jobId) === controller) this.#activeJobs.delete(input.jobId);
      inspected?.bytes.fill(0);
      sourceBytes?.fill(0);
    }
  }

  public async correctAndSeal(input: Parameters<LocalGovernedOcrRuntimePort['correctAndSeal']>[0]):
  Promise<Result<LocalGovernedOcrSealedResult, AppError>> {
    if (!validIdentifier(input.jobId) || !SHA256.test(input.previousSealedResultId)
      || !SHA256.test(input.expectedInputSha256) || !validCorrectedText(input.correctedText)) {
      return err(invalid(input.correlationId));
    }
    try {
      const authority = await this.#resolveJobAuthority('correct', input.jobId, input.previousSealedResultId, input.correlationId);
      if (!authority.ok) return authority;
      if (authority.value.currentSealedResultId !== input.previousSealedResultId
        || authority.value.inputSha256 !== input.expectedInputSha256) return err(denied(input.correlationId));
      const binding = exactRuntimeBinding(authority.value);
      const previous = this.#resultVault.read(binding, input.previousSealedResultId);
      if (this.#resultVault.correctionDepth(binding, input.previousSealedResultId) >= 512) {
        return err(appError(input.correlationId, ERROR_CODES.RESOURCE_CONFLICT, 'conflict',
          'Yerel OCR düzeltme zinciri güvenli üst sınırına ulaştı; açık rerun gerekir.'));
      }
      const correctedContentSha256 = hashText(input.correctedText);
      const sealedResultId = deriveLocalGovernedOcrCorrectionSealedResultId({
        binding: authority.value,
        previousSealedResultId: input.previousSealedResultId,
        correctedContentSha256
      });
      const existing = this.#resultVault.readIfPresent(binding, sealedResultId);
      if (existing !== null) return ok(sealedMetadata(existing));
      const completed = nowIso(this.#now, input.correlationId);
      if (!completed.ok) return completed;
      const payload: LocalGovernedOcrSealedPayload = Object.freeze({
        ...previous,
        schemaVersion: 2,
        sealedResultId,
        text: input.correctedText,
        contentSha256: correctedContentSha256,
        characterCount: input.correctedText.length,
        completedAt: completed.value,
        corrected: true,
        previousSealedResultId: input.previousSealedResultId,
        searchIndex: buildLocalGovernedOcrSearchIndex(input.correctedText, correctedContentSha256),
        networkUsed: false,
        cloudUsed: false
      });
      try { this.#resultVault.publish(payload); }
      catch (error) {
        if (!(error instanceof LocalGovernedOcrResultVaultError) || error.code !== 'NO_OVERWRITE_CONFLICT') throw error;
      }
      const verified = this.#resultVault.read(binding, sealedResultId);
      if (verified.contentSha256 !== correctedContentSha256 || verified.text !== input.correctedText) {
        return err(unexpected(input.correlationId));
      }
      return ok(sealedMetadata(verified));
    } catch { return err(unexpected(input.correlationId)); }
  }

  public async readSealedResult(input: Parameters<LocalGovernedOcrRuntimePort['readSealedResult']>[0]):
  ReturnType<LocalGovernedOcrRuntimePort['readSealedResult']> {
    if (!validIdentifier(input.jobId) || !SHA256.test(input.sealedResultId)) return err(invalid(input.correlationId));
    try {
      const authority = await this.#resolveJobAuthority('read', input.jobId, input.sealedResultId, input.correlationId);
      if (!authority.ok) return authority;
      if (authority.value.currentSealedResultId !== input.sealedResultId) return err(denied(input.correlationId));
      const payload = this.#resultVault.read(exactRuntimeBinding(authority.value), input.sealedResultId);
      return ok({ text: payload.text, contentSha256: payload.contentSha256, networkUsed: false, cloudUsed: false });
    } catch (error) {
      if (error instanceof LocalGovernedOcrResultVaultError && error.code === 'NOT_FOUND') {
        return err(appError(input.correlationId, ERROR_CODES.RESOURCE_NOT_FOUND, 'not_found', 'Yerel OCR sealed sonucu bulunamadı.'));
      }
      return err(unexpected(input.correlationId));
    }
  }

  public async searchSealedResult(input: Parameters<LocalGovernedOcrRuntimePort['searchSealedResult']>[0]):
  ReturnType<LocalGovernedOcrRuntimePort['searchSealedResult']> {
    if (!validIdentifier(input.jobId) || !SHA256.test(input.sealedResultId)) return err(invalid(input.correlationId));
    try {
      const authority = await this.#resolveJobAuthority('search', input.jobId, input.sealedResultId, input.correlationId);
      if (!authority.ok) return authority;
      if (authority.value.currentSealedResultId !== input.sealedResultId) return err(denied(input.correlationId));
      const payload = this.#resultVault.read(exactRuntimeBinding(authority.value), input.sealedResultId);
      if (payload[LOCAL_GOVERNED_OCR_SEARCH_INDEX_PERSISTED] !== true) {
        return err(appError(input.correlationId, ERROR_CODES.RESOURCE_CONFLICT, 'conflict',
          'Legacy OCR result has no encrypted search index; rerun or correct the result before searching.'));
      }
      const hit = searchLocalGovernedOcrText({ index: payload.searchIndex, text: payload.text,
        contentSha256: payload.contentSha256, query: input.query, corrected: payload.corrected,
        layout: payload.providerResult.layout });
      return hit === null
        ? ok({ matched: false, matchedTokenCount: 0, contentSha256: payload.contentSha256,
          snippet: null, snippetMasked: true,
          pageNumber: null, networkUsed: false, cloudUsed: false })
        : ok({ matched: true, matchedTokenCount: hit.matchedTokenCount, contentSha256: payload.contentSha256,
          snippet: hit.snippet,
          snippetMasked: true, pageNumber: hit.pageNumber, networkUsed: false, cloudUsed: false });
    } catch (error) {
      if (error instanceof LocalGovernedOcrResultVaultError && error.code === 'NOT_FOUND') {
        return err(appError(input.correlationId, ERROR_CODES.RESOURCE_NOT_FOUND, 'not_found', 'Yerel OCR sealed indeksi bulunamadı.'));
      }
      return err(unexpected(input.correlationId));
    }
  }

  public async requestCancellation(input: Parameters<LocalGovernedOcrRuntimePort['requestCancellation']>[0]):
  ReturnType<LocalGovernedOcrRuntimePort['requestCancellation']> {
    if (!validIdentifier(input.jobId)) return err(invalid(input.correlationId));
    try {
      const authority = await this.#resolveJobAuthority('cancel', input.jobId, null, input.correlationId);
      if (!authority.ok) return authority;
      this.#activeJobs.get(input.jobId)?.abort();
      return ok({ accepted: true });
    } catch { return err(unexpected(input.correlationId)); }
  }

  public async purgeSealedResult(input: Parameters<LocalGovernedOcrRuntimePort['purgeSealedResult']>[0]):
  ReturnType<LocalGovernedOcrRuntimePort['purgeSealedResult']> {
    if (!validIdentifier(input.jobId) || !SHA256.test(input.sealedResultId)) return err(invalid(input.correlationId));
    try {
      const authority = await this.#resolveJobAuthority('purge', input.jobId, input.sealedResultId, input.correlationId);
      if (!authority.ok) return authority;
      if (authority.value.currentSealedResultId !== null
        && authority.value.currentSealedResultId !== input.sealedResultId) return err(denied(input.correlationId));
      return ok(this.#resultVault.purge(exactRuntimeBinding(authority.value), input.sealedResultId));
    } catch { return err(unexpected(input.correlationId)); }
  }

  public async sweepOrphans(input: {
    readonly correlationId: CorrelationId;
    readonly maximumCandidates?: number;
  }): Promise<Result<LocalGovernedOcrOrphanSweepResult, AppError>> {
    const maximumCandidates = input.maximumCandidates ?? 64;
    if (!Number.isSafeInteger(maximumCandidates) || maximumCandidates < 1 || maximumCandidates > 128) {
      return err(invalid(input.correlationId));
    }
    const currentTime = nowIso(this.#now, input.correlationId);
    if (!currentTime.ok) return currentTime;
    const cutoff = new Date(Date.parse(currentTime.value) - this.#orphanGraceMs).toISOString();
    try {
      const inventory = this.#resultVault.listMaintenanceCandidates({
        completedBefore: cutoff,
        maximumCandidates,
        afterSealedResultId: this.#orphanSweepCursor
      });
      this.#orphanSweepCursor = inventory.nextCursor;
      let deleted = 0;
      let referenced = 0;
      let rejected = inventory.rejectedCount;
      for (const candidate of inventory.candidates) {
        let authority: Result<AuthorizedLocalGovernedOcrJobBinding, AppError>;
        try {
          authority = await this.#authority.resolveAuthorizedJobBinding({
            operation: 'orphan_sweep', jobId: candidate.binding.jobId,
            sealedResultId: candidate.sealedResultId, correlationId: input.correlationId
          });
        } catch { rejected += 1; continue; }
        if (!authority.ok || !this.#validJobAuthority(authority.value, candidate.binding.jobId)
          || !sameBinding(authority.value, candidate.binding)) { rejected += 1; continue; }
        const binding = exactRuntimeBinding(authority.value);
        try {
          if (authority.value.currentSealedResultId !== null) {
            const protectedChain = new Set(this.#resultVault.correctionChainIds(
              binding, authority.value.currentSealedResultId
            ));
            if (protectedChain.has(candidate.sealedResultId)) { referenced += 1; continue; }
            this.#resultVault.purgeUnreferencedBranch(binding, candidate.sealedResultId, protectedChain);
          } else {
            this.#resultVault.purge(binding, candidate.sealedResultId);
          }
          deleted += 1;
        } catch { rejected += 1; }
      }
      return ok(Object.freeze({
        scanned: inventory.candidates.length,
        deleted,
        referenced,
        rejected,
        networkUsed: false,
        cloudUsed: false
      }));
    } catch { return err(unexpected(input.correlationId)); }
  }

  async #resolveJobAuthority(
    operation: LocalGovernedOcrRuntimeJobOperation,
    jobId: string,
    sealedResultId: string | null,
    correlationId: CorrelationId
  ): Promise<Result<AuthorizedLocalGovernedOcrJobBinding, AppError>> {
    const result = await this.#authority.resolveAuthorizedJobBinding({ operation, jobId, sealedResultId, correlationId });
    if (!result.ok) return result;
    return this.#validJobAuthority(result.value, jobId) ? result : err(denied(correlationId));
  }

  #validJobAuthority(value: AuthorizedLocalGovernedOcrJobBinding, jobId: string): boolean {
    return value.authority === 'central_pep_authorized_local_ocr_job' && value.jobId === jobId && validBinding(value)
      && (value.currentSealedResultId === null
        || (typeof value.currentSealedResultId === 'string' && SHA256.test(value.currentSealedResultId)));
  }
}

export const createWindowsLocalGovernedOcrRuntimeAdapter = (
  options: WindowsLocalGovernedOcrRuntimeOptions
): MainLocalGovernedOcrRuntimeAdapter => new MainLocalGovernedOcrRuntimeAdapter({
  authority: options.authority,
  archiveVaultFiles: options.archiveVaultFiles,
  resultVault: options.resultVault,
  worker: new BoundedLocalOcrWorker(
    new WindowsMediaOcrEngineAdapter(),
    options.malwareScanner ?? new NotConfiguredLocalOcrMalwareVerdictAdapter(),
    options.workerOptions
  ),
  ...(options.now === undefined ? {} : { now: options.now }),
  ...(options.orphanGraceMs === undefined ? {} : { orphanGraceMs: options.orphanGraceMs })
});
