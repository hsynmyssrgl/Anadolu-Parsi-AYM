import { createHash, randomBytes } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  LOCAL_OCR_MAX_LAYOUT_BLOCKS,
  LOCAL_OCR_MAX_LANGUAGES,
  LOCAL_OCR_MAX_OUTPUT_BYTES,
  LOCAL_OCR_MAX_PAGES,
  LOCAL_OCR_MAX_TEXT_CHARACTERS,
  type LocalOcrResult
} from '@ppt/security';
import { ProtectedSideArtifactStore, type ProtectedSideArtifactEnvelope } from './protected-side-artifact-store.js';

const RESULT_SCHEMA_VERSION = 1;
const RESULT_KIND = 'local-governed-ocr-sealed-result-v1';
const MAX_PROTECTED_ENVELOPE_BYTES = 2 * 1024 * 1024;
const MAX_CORRECTION_CHAIN = 512;
export const LOCAL_GOVERNED_OCR_RESULT_VAULT_MAX_FILES = 1_024;
export const LOCAL_GOVERNED_OCR_RESULT_VAULT_MAX_BYTES = 256 * 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/u;
const IDENTIFIER = /^[A-Za-z0-9._:-]{1,160}$/u;

export interface LocalGovernedOcrRuntimeBinding {
  readonly familyId: string;
  readonly accountId: string;
  readonly ownerPersonId: string;
  readonly jobId: string;
  readonly derivedResourceId: string;
  readonly sourceResourceId: string;
  readonly inputSha256: string;
}

export interface LocalGovernedOcrSealedPayload {
  readonly schemaVersion: 1;
  readonly kind: typeof RESULT_KIND;
  readonly sealedResultId: string;
  readonly binding: LocalGovernedOcrRuntimeBinding;
  readonly text: string;
  readonly contentSha256: string;
  readonly characterCount: number;
  readonly pageCount: number;
  readonly confidenceBasisPoints: number | null;
  readonly completedAt: string;
  readonly corrected: boolean;
  readonly previousSealedResultId: string | null;
  /** Validated provider output is retained only inside the encrypted main-process envelope. */
  readonly providerResult: LocalOcrResult;
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export interface LocalGovernedOcrResultVaultOptions {
  readonly rootDirectory: string;
  readonly protectedStore: ProtectedSideArtifactStore;
  readonly maximumFiles?: number;
  readonly maximumBytes?: number;
}

export interface LocalGovernedOcrResultVaultMaintenanceCandidate {
  readonly sealedResultId: string;
  readonly binding: LocalGovernedOcrRuntimeBinding;
  readonly completedAt: string;
  readonly sizeBytes: number;
}

export type LocalGovernedOcrResultVaultFailure =
  | 'NOT_FOUND'
  | 'PATH_REJECTED'
  | 'ENVELOPE_REJECTED'
  | 'NO_OVERWRITE_CONFLICT';

export class LocalGovernedOcrResultVaultError extends Error {
  public constructor(public readonly code: LocalGovernedOcrResultVaultFailure) {
    super(code);
    this.name = 'LocalGovernedOcrResultVaultError';
  }
}

const hashBytes = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
const hashText = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const plainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const exactKeys = (value: object, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length && actual.every((key, index) => key === canonical[index]);
};
const validIdentifier = (value: unknown): value is string => typeof value === 'string'
  && value === value.trim() && IDENTIFIER.test(value);
const samePath = (left: string, right: string): boolean => process.platform === 'win32'
  ? resolve(left).toLowerCase() === resolve(right).toLowerCase()
  : resolve(left) === resolve(right);
const validText = (value: unknown): value is string => typeof value === 'string'
  && value.length >= 1 && value.length <= LOCAL_OCR_MAX_TEXT_CHARACTERS
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);

const validBinding = (value: unknown): value is LocalGovernedOcrRuntimeBinding => plainRecord(value)
  && exactKeys(value, [
    'familyId', 'accountId', 'ownerPersonId', 'jobId', 'derivedResourceId', 'sourceResourceId', 'inputSha256'
  ])
  && validIdentifier(value.familyId) && validIdentifier(value.accountId) && validIdentifier(value.ownerPersonId)
  && validIdentifier(value.jobId) && validIdentifier(value.derivedResourceId) && validIdentifier(value.sourceResourceId)
  && typeof value.inputSha256 === 'string' && SHA256.test(value.inputSha256);

const sameBinding = (left: LocalGovernedOcrRuntimeBinding, right: LocalGovernedOcrRuntimeBinding): boolean =>
  left.familyId === right.familyId && left.accountId === right.accountId
  && left.ownerPersonId === right.ownerPersonId && left.jobId === right.jobId
  && left.derivedResourceId === right.derivedResourceId && left.sourceResourceId === right.sourceResourceId
  && left.inputSha256 === right.inputSha256;

const validProviderResult = (value: unknown, binding: LocalGovernedOcrRuntimeBinding, pageCount: number): value is LocalOcrResult => {
  if (!plainRecord(value) || !exactKeys(value, [
    'schemaVersion', 'engineId', 'inputSha256', 'mediaType', 'pageCount', 'text',
    'confidence', 'languages', 'layout', 'execution'
  ]) || value.schemaVersion !== 1 || typeof value.engineId !== 'string'
    || value.inputSha256 !== binding.inputSha256
    || !['image/png', 'image/jpeg', 'application/pdf'].includes(String(value.mediaType))
    || value.pageCount !== pageCount || !validText(value.text)
    || !Array.isArray(value.languages) || value.languages.length < 1 || value.languages.length > LOCAL_OCR_MAX_LANGUAGES
    || !Array.isArray(value.layout) || value.layout.length > LOCAL_OCR_MAX_LAYOUT_BLOCKS
    || !plainRecord(value.execution)) return false;
  const execution = value.execution;
  return execution.localOnly === true && execution.networkUsed === false && execution.cloudUsed === false
    && execution.processSeparated === true && execution.lowPrivilegeSandboxVerified === false
    && execution.memoryLimitEnforced === true && execution.cpuTimeLimitEnforced === true
    && execution.timeLimitEnforced === true && execution.outputLimitEnforced === true;
};

const parsePayload = (bytes: Buffer): LocalGovernedOcrSealedPayload => {
  if (bytes.byteLength < 2 || bytes.byteLength > LOCAL_OCR_MAX_OUTPUT_BYTES) {
    throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
  }
  let value: unknown;
  try { value = JSON.parse(bytes.toString('utf8')) as unknown; }
  catch { throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED'); }
  if (!plainRecord(value) || !exactKeys(value, [
    'schemaVersion', 'kind', 'sealedResultId', 'binding', 'text', 'contentSha256', 'characterCount',
    'pageCount', 'confidenceBasisPoints', 'completedAt', 'corrected', 'previousSealedResultId',
    'providerResult', 'networkUsed', 'cloudUsed'
  ]) || value.schemaVersion !== RESULT_SCHEMA_VERSION || value.kind !== RESULT_KIND
    || typeof value.sealedResultId !== 'string' || !SHA256.test(value.sealedResultId)
    || !validBinding(value.binding) || !validText(value.text)
    || typeof value.contentSha256 !== 'string' || !SHA256.test(value.contentSha256)
    || hashText(value.text) !== value.contentSha256 || value.characterCount !== value.text.length
    || !Number.isSafeInteger(value.pageCount) || Number(value.pageCount) < 1 || Number(value.pageCount) > LOCAL_OCR_MAX_PAGES
    || !(value.confidenceBasisPoints === null || (Number.isSafeInteger(value.confidenceBasisPoints)
      && Number(value.confidenceBasisPoints) >= 0 && Number(value.confidenceBasisPoints) <= 10_000))
    || typeof value.completedAt !== 'string' || !Number.isFinite(Date.parse(value.completedAt))
    || typeof value.corrected !== 'boolean'
    || !(value.previousSealedResultId === null
      || (typeof value.previousSealedResultId === 'string' && SHA256.test(value.previousSealedResultId)))
    || (value.corrected !== (value.previousSealedResultId !== null))
    || !validProviderResult(value.providerResult, value.binding, Number(value.pageCount))
    || value.networkUsed !== false || value.cloudUsed !== false) {
    throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
  }
  return Object.freeze(value as unknown as LocalGovernedOcrSealedPayload);
};

const parseProtectedEnvelope = (bytes: Buffer): ProtectedSideArtifactEnvelope => {
  let value: unknown;
  try { value = JSON.parse(bytes.toString('utf8')) as unknown; }
  catch { throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED'); }
  if (!plainRecord(value) || !exactKeys(value, [
    'schemaVersion', 'product', 'applicationVersion', 'kind', 'generatedAt', 'encryption'
  ]) || value.schemaVersion !== 1 || typeof value.product !== 'string' || value.product.length < 3
    || typeof value.applicationVersion !== 'string' || value.applicationVersion.length < 1
    || value.kind !== RESULT_KIND || typeof value.generatedAt !== 'string' || !Number.isFinite(Date.parse(value.generatedAt))
    || !plainRecord(value.encryption) || !exactKeys(value.encryption, ['version', 'algorithm', 'iv', 'authTag', 'ciphertext'])
    || value.encryption.version !== 1 || value.encryption.algorithm !== 'aes-256-gcm'
    || typeof value.encryption.iv !== 'string' || Buffer.from(value.encryption.iv, 'base64').byteLength !== 12
    || typeof value.encryption.authTag !== 'string' || Buffer.from(value.encryption.authTag, 'base64').byteLength !== 16
    || typeof value.encryption.ciphertext !== 'string' || value.encryption.ciphertext.length < 4) {
    throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
  }
  return value as unknown as ProtectedSideArtifactEnvelope;
};

export const deriveLocalGovernedOcrRunSealedResultId = (input: {
  readonly binding: LocalGovernedOcrRuntimeBinding;
  readonly languageHints: readonly string[];
}): string => hashText(JSON.stringify({
  schemaVersion: 1,
  operation: 'run',
  binding: input.binding,
  languageHints: [...input.languageHints]
}));

export const deriveLocalGovernedOcrCorrectionSealedResultId = (input: {
  readonly binding: LocalGovernedOcrRuntimeBinding;
  readonly previousSealedResultId: string;
  readonly correctedContentSha256: string;
}): string => hashText(JSON.stringify({
  schemaVersion: 1,
  operation: 'correct',
  binding: input.binding,
  previousSealedResultId: input.previousSealedResultId,
  correctedContentSha256: input.correctedContentSha256
}));

/**
 * Main-process-only encrypted OCR result store. The protected store owns the DPAPI/safeStorage-wrapped
 * data key; this class adds owner binding, strict paths and atomic no-overwrite publication.
 */
export class LocalGovernedOcrResultVault {
  readonly #rootDirectory: string;
  readonly #protectedStore: ProtectedSideArtifactStore;
  readonly #maximumFiles: number;
  readonly #maximumBytes: number;

  public constructor(options: LocalGovernedOcrResultVaultOptions) {
    if (!options || typeof options.rootDirectory !== 'string' || !options.rootDirectory.trim()
      || !(options.protectedStore instanceof ProtectedSideArtifactStore)) {
      throw new LocalGovernedOcrResultVaultError('PATH_REJECTED');
    }
    this.#rootDirectory = resolve(options.rootDirectory);
    this.#protectedStore = options.protectedStore;
    this.#maximumFiles = options.maximumFiles ?? LOCAL_GOVERNED_OCR_RESULT_VAULT_MAX_FILES;
    this.#maximumBytes = options.maximumBytes ?? LOCAL_GOVERNED_OCR_RESULT_VAULT_MAX_BYTES;
    if (!Number.isSafeInteger(this.#maximumFiles) || this.#maximumFiles < 1
      || this.#maximumFiles > LOCAL_GOVERNED_OCR_RESULT_VAULT_MAX_FILES
      || !Number.isSafeInteger(this.#maximumBytes) || this.#maximumBytes < MAX_PROTECTED_ENVELOPE_BYTES
      || this.#maximumBytes > LOCAL_GOVERNED_OCR_RESULT_VAULT_MAX_BYTES) {
      throw new LocalGovernedOcrResultVaultError('PATH_REJECTED');
    }
    if (existsSync(this.#rootDirectory) && lstatSync(this.#rootDirectory).isSymbolicLink()) {
      throw new LocalGovernedOcrResultVaultError('PATH_REJECTED');
    }
    mkdirSync(this.#rootDirectory, { recursive: true, mode: 0o700 });
    try { chmodSync(this.#rootDirectory, 0o700); } catch { /* Windows ACL is authoritative. */ }
    this.#assertRoot();
    this.#recoverInterruptedPublications();
  }

  public publish(payload: LocalGovernedOcrSealedPayload): void {
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8');
    let protectedBytes: Buffer | undefined;
    try {
      const validated = parsePayload(encoded);
      if (validated.sealedResultId !== payload.sealedResultId || !sameBinding(validated.binding, payload.binding)) {
        throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
      }
      protectedBytes = Buffer.from(`${JSON.stringify(this.#protectedStore.sealBuffer(RESULT_KIND, encoded))}\n`, 'utf8');
      if (protectedBytes.byteLength > MAX_PROTECTED_ENVELOPE_BYTES) {
        throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
      }
      this.#assertQuota(protectedBytes.byteLength);
      this.#atomicNoOverwrite(this.#pathFor(payload.sealedResultId), protectedBytes);
    } finally {
      encoded.fill(0);
      protectedBytes?.fill(0);
    }
  }

  public read(binding: LocalGovernedOcrRuntimeBinding, sealedResultId: string): LocalGovernedOcrSealedPayload {
    if (!validBinding(binding) || !SHA256.test(sealedResultId)) {
      throw new LocalGovernedOcrResultVaultError('PATH_REJECTED');
    }
    const payload = this.#readPayload(sealedResultId);
    if (payload.sealedResultId !== sealedResultId || !sameBinding(payload.binding, binding)) {
      throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
    }
    return payload;
  }

  public readIfPresent(
    binding: LocalGovernedOcrRuntimeBinding,
    sealedResultId: string
  ): LocalGovernedOcrSealedPayload | null {
    try { return this.read(binding, sealedResultId); }
    catch (error) {
      if (error instanceof LocalGovernedOcrResultVaultError && error.code === 'NOT_FOUND') return null;
      throw error;
    }
  }

  public correctionDepth(binding: LocalGovernedOcrRuntimeBinding, sealedResultId: string): number {
    return this.correctionChainIds(binding, sealedResultId).length;
  }

  public correctionChainIds(
    binding: LocalGovernedOcrRuntimeBinding,
    sealedResultId: string
  ): readonly string[] {
    if (!validBinding(binding) || !SHA256.test(sealedResultId)) {
      throw new LocalGovernedOcrResultVaultError('PATH_REJECTED');
    }
    const visited = new Set<string>();
    const chain: string[] = [];
    let current: string | null = sealedResultId;
    while (current !== null) {
      if (visited.has(current) || chain.length >= MAX_CORRECTION_CHAIN) {
        throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
      }
      visited.add(current);
      const payload = this.read(binding, current);
      chain.push(current);
      current = payload.previousSealedResultId;
    }
    return Object.freeze(chain);
  }

  /** Deletes the exact owner-bound result and any owner-bound correction ancestors. */
  public purge(binding: LocalGovernedOcrRuntimeBinding, sealedResultId: string): { readonly deleted: true; readonly verified: true } {
    if (!validBinding(binding) || !SHA256.test(sealedResultId)) {
      throw new LocalGovernedOcrResultVaultError('PATH_REJECTED');
    }
    const chain: string[] = [];
    const visited = new Set<string>();
    let current: string | null = sealedResultId;
    while (current !== null) {
      if (visited.has(current) || chain.length >= MAX_CORRECTION_CHAIN) {
        throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
      }
      visited.add(current);
      const payload = this.readIfPresent(binding, current);
      if (payload === null) break;
      chain.push(current);
      current = payload.previousSealedResultId;
    }
    for (const resultId of chain) {
      const path = this.#pathFor(resultId);
      this.#assertSafeExistingFile(path);
      rmSync(path);
      if (existsSync(path)) throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
    }
    if (existsSync(this.#pathFor(sealedResultId))) {
      throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
    }
    return Object.freeze({ deleted: true, verified: true });
  }

  /** Deletes an unreferenced correction branch but stops before any exact current-chain ancestor. */
  public purgeUnreferencedBranch(
    binding: LocalGovernedOcrRuntimeBinding,
    sealedResultId: string,
    protectedChainIds: ReadonlySet<string>
  ): { readonly deletedFiles: number; readonly verified: true } {
    if (!validBinding(binding) || !SHA256.test(sealedResultId)
      || [...protectedChainIds].some((value) => !SHA256.test(value))) {
      throw new LocalGovernedOcrResultVaultError('PATH_REJECTED');
    }
    const chain: string[] = [];
    const visited = new Set<string>();
    let current: string | null = sealedResultId;
    while (current !== null && !protectedChainIds.has(current)) {
      if (visited.has(current) || chain.length >= MAX_CORRECTION_CHAIN) {
        throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
      }
      visited.add(current);
      const payload = this.readIfPresent(binding, current);
      if (payload === null) break;
      chain.push(current);
      current = payload.previousSealedResultId;
    }
    for (const resultId of chain) {
      const path = this.#pathFor(resultId);
      this.#assertSafeExistingFile(path);
      rmSync(path);
      if (existsSync(path)) throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
    }
    if (!protectedChainIds.has(sealedResultId) && existsSync(this.#pathFor(sealedResultId))) {
      throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
    }
    return Object.freeze({ deletedFiles: chain.length, verified: true });
  }

  /** Bounded metadata-only maintenance inventory. Invalid or foreign envelopes are counted, never returned as trusted. */
  public listMaintenanceCandidates(input: {
    readonly completedBefore: string;
    readonly maximumCandidates: number;
    readonly afterSealedResultId?: string | null;
  }): {
    readonly candidates: readonly LocalGovernedOcrResultVaultMaintenanceCandidate[];
    readonly rejectedCount: number;
    readonly nextCursor: string | null;
  } {
    if (!Number.isFinite(Date.parse(input.completedBefore)) || !Number.isSafeInteger(input.maximumCandidates)
      || input.maximumCandidates < 1 || input.maximumCandidates > 128
      || !(input.afterSealedResultId === undefined || input.afterSealedResultId === null
        || SHA256.test(input.afterSealedResultId))) {
      throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
    }
    this.#assertRoot();
    const entries = readdirSync(this.#rootDirectory, { withFileTypes: true });
    if (entries.length > this.#maximumFiles + 64) throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
    const cutoff = Date.parse(input.completedBefore);
    const candidates: LocalGovernedOcrResultVaultMaintenanceCandidate[] = [];
    let rejectedCount = 0;
    const ordered = entries.sort((left, right) => left.name.localeCompare(right.name));
    const sealedEntries: Array<{ readonly entry: (typeof ordered)[number]; readonly sealedResultId: string }> = [];
    for (const entry of ordered) {
      const match = /^([0-9a-f]{64})\.ocrsealed$/u.exec(entry.name);
      if (!match || !entry.isFile() || entry.isSymbolicLink()) {
        if (!entry.name.startsWith('.ocrsealed-')) rejectedCount += 1;
        continue;
      }
      const sealedResultId = match[1];
      if (sealedResultId === undefined) { rejectedCount += 1; continue; }
      sealedEntries.push({ entry, sealedResultId });
    }
    const after = input.afterSealedResultId ?? null;
    const start = after === null ? 0 : sealedEntries.findIndex((value) => value.sealedResultId > after);
    let lastScanned: string | null = null;
    let stoppedAtLimit = false;
    for (let index = start < 0 ? sealedEntries.length : start; index < sealedEntries.length; index += 1) {
      const item = sealedEntries[index];
      if (item === undefined) continue;
      const { sealedResultId } = item;
      lastScanned = sealedResultId;
      try {
        const payload = this.#readPayload(sealedResultId);
        if (payload.sealedResultId !== sealedResultId) { rejectedCount += 1; continue; }
        if (Date.parse(payload.completedAt) >= cutoff) continue;
        if (candidates.length < input.maximumCandidates) {
          candidates.push(Object.freeze({
            sealedResultId,
            binding: payload.binding,
            completedAt: payload.completedAt,
            sizeBytes: lstatSync(this.#pathFor(sealedResultId)).size
          }));
        }
      } catch { rejectedCount += 1; }
      if (candidates.length >= input.maximumCandidates) {
        stoppedAtLimit = index < sealedEntries.length - 1;
        break;
      }
    }
    return Object.freeze({
      candidates: Object.freeze(candidates),
      rejectedCount,
      nextCursor: stoppedAtLimit ? lastScanned : null
    });
  }

  #assertRoot(): void {
    const stat = lstatSync(this.#rootDirectory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !samePath(realpathSync(this.#rootDirectory), this.#rootDirectory)) {
      throw new LocalGovernedOcrResultVaultError('PATH_REJECTED');
    }
  }

  #assertQuota(incomingBytes: number): void {
    this.#assertRoot();
    const entries = readdirSync(this.#rootDirectory, { withFileTypes: true });
    if (entries.length > this.#maximumFiles + 64) throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
    let fileCount = 0;
    let totalBytes = 0;
    for (const entry of entries) {
      const path = join(this.#rootDirectory, entry.name);
      if (!entry.isFile() || entry.isSymbolicLink()) throw new LocalGovernedOcrResultVaultError('PATH_REJECTED');
      const stat = lstatSync(path);
      const sealed = /^[0-9a-f]{64}\.ocrsealed$/u.test(entry.name);
      const interrupted = /^\.ocrsealed-[0-9]+-[0-9a-f]{24}\.tmp$/u.test(entry.name);
      if ((!sealed && !interrupted) || !stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1
        || stat.size < 2 || stat.size > MAX_PROTECTED_ENVELOPE_BYTES) {
        throw new LocalGovernedOcrResultVaultError('PATH_REJECTED');
      }
      fileCount += 1;
      totalBytes += stat.size;
      if (fileCount > this.#maximumFiles || totalBytes > this.#maximumBytes) {
        throw new LocalGovernedOcrResultVaultError('NO_OVERWRITE_CONFLICT');
      }
    }
    if (fileCount >= this.#maximumFiles || totalBytes + incomingBytes > this.#maximumBytes) {
      throw new LocalGovernedOcrResultVaultError('NO_OVERWRITE_CONFLICT');
    }
  }

  #recoverInterruptedPublications(): void {
    this.#assertRoot();
    const entries = readdirSync(this.#rootDirectory, { withFileTypes: true });
    const temporaryEntries = entries.filter((entry) => /^\.ocrsealed-[0-9]+-[0-9a-f]{24}\.tmp$/u.test(entry.name));
    if (temporaryEntries.length > 64) throw new LocalGovernedOcrResultVaultError('PATH_REJECTED');
    for (const entry of temporaryEntries) {
      if (!entry.isFile() || entry.isSymbolicLink()) continue;
      const temporaryPath = join(this.#rootDirectory, entry.name);
      let payload: LocalGovernedOcrSealedPayload;
      try { payload = this.#readPayloadAtPath(temporaryPath, new Set([1, 2])); }
      catch { continue; }
      const targetPath = this.#pathFor(payload.sealedResultId);
      if (existsSync(targetPath)) {
        let target: LocalGovernedOcrSealedPayload;
        try { target = this.#readPayloadAtPath(targetPath, new Set([1, 2])); }
        catch { throw new LocalGovernedOcrResultVaultError('NO_OVERWRITE_CONFLICT'); }
        if (target.sealedResultId !== payload.sealedResultId || !sameBinding(target.binding, payload.binding)
          || target.contentSha256 !== payload.contentSha256) {
          throw new LocalGovernedOcrResultVaultError('NO_OVERWRITE_CONFLICT');
        }
        const temporaryRaw = readFileSync(temporaryPath);
        const targetRaw = readFileSync(targetPath);
        try {
          if (hashBytes(temporaryRaw) !== hashBytes(targetRaw)) {
            throw new LocalGovernedOcrResultVaultError('NO_OVERWRITE_CONFLICT');
          }
        } finally { temporaryRaw.fill(0); targetRaw.fill(0); }
        rmSync(temporaryPath);
      } else {
        linkSync(temporaryPath, targetPath);
        rmSync(temporaryPath);
      }
      this.#assertSafeExistingFile(targetPath);
    }
  }

  #pathFor(sealedResultId: string): string {
    if (!SHA256.test(sealedResultId)) throw new LocalGovernedOcrResultVaultError('PATH_REJECTED');
    this.#assertRoot();
    const path = join(this.#rootDirectory, `${sealedResultId}.ocrsealed`);
    if (!samePath(dirname(path), this.#rootDirectory)) throw new LocalGovernedOcrResultVaultError('PATH_REJECTED');
    return path;
  }

  #assertSafeExistingFile(path: string): void {
    this.#assertRoot();
    const link = lstatSync(path);
    if (!link.isFile() || link.isSymbolicLink() || link.nlink !== 1
      || !samePath(dirname(realpathSync(path)), this.#rootDirectory)) {
      throw new LocalGovernedOcrResultVaultError('PATH_REJECTED');
    }
  }

  #readPayload(sealedResultId: string): LocalGovernedOcrSealedPayload {
    const path = this.#pathFor(sealedResultId);
    if (!existsSync(path)) throw new LocalGovernedOcrResultVaultError('NOT_FOUND');
    this.#assertSafeExistingFile(path);
    return this.#readPayloadAtPath(path, new Set([1]));
  }

  #readPayloadAtPath(path: string, allowedLinkCounts: ReadonlySet<number>): LocalGovernedOcrSealedPayload {
    this.#assertRoot();
    const link = lstatSync(path);
    if (!link.isFile() || link.isSymbolicLink() || !allowedLinkCounts.has(link.nlink)
      || !samePath(dirname(realpathSync(path)), this.#rootDirectory)) {
      throw new LocalGovernedOcrResultVaultError('PATH_REJECTED');
    }
    let descriptor: number | undefined;
    let raw: Buffer | undefined;
    let plain: Buffer | undefined;
    try {
      descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      const stat = fstatSync(descriptor);
      if (!stat.isFile() || !allowedLinkCounts.has(stat.nlink)
        || stat.size < 2 || stat.size > MAX_PROTECTED_ENVELOPE_BYTES) {
        throw new LocalGovernedOcrResultVaultError('PATH_REJECTED');
      }
      raw = readFileSync(descriptor);
      if (raw.byteLength !== stat.size) throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
      plain = this.#protectedStore.openEnvelope(parseProtectedEnvelope(raw));
      return parsePayload(plain);
    } catch (error) {
      if (error instanceof LocalGovernedOcrResultVaultError) throw error;
      throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
    } finally {
      if (descriptor !== undefined) try { closeSync(descriptor); } catch { /* best effort */ }
      raw?.fill(0);
      plain?.fill(0);
    }
  }

  #atomicNoOverwrite(path: string, bytes: Buffer): void {
    if (existsSync(path)) throw new LocalGovernedOcrResultVaultError('NO_OVERWRITE_CONFLICT');
    const temporaryPath = join(this.#rootDirectory, `.ocrsealed-${process.pid}-${randomBytes(12).toString('hex')}.tmp`);
    let descriptor: number | undefined;
    let published = false;
    try {
      descriptor = openSync(temporaryPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
      writeFileSync(descriptor, bytes);
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = undefined;
      try { chmodSync(temporaryPath, 0o600); } catch { /* Windows ACL is authoritative. */ }
      linkSync(temporaryPath, path);
      published = true;
      try { chmodSync(path, 0o600); } catch { /* Windows ACL is authoritative. */ }
      rmSync(temporaryPath);
      this.#assertSafeExistingFile(path);
      const readback = readFileSync(path);
      try {
        const actual = hashBytes(readback);
        if (actual !== hashBytes(bytes)) throw new LocalGovernedOcrResultVaultError('ENVELOPE_REJECTED');
      } finally { readback.fill(0); }
    } catch (error) {
      if (descriptor !== undefined) try { closeSync(descriptor); } catch { /* best effort */ }
      if (!published) rmSync(temporaryPath, { force: true });
      if (error instanceof LocalGovernedOcrResultVaultError) throw error;
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      throw new LocalGovernedOcrResultVaultError(code === 'EEXIST' ? 'NO_OVERWRITE_CONFLICT' : 'ENVELOPE_REJECTED');
    } finally {
      rmSync(temporaryPath, { force: true });
    }
  }
}
