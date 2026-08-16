import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
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
import { basename, dirname, join, resolve } from 'node:path';
import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type Result
} from '@ppt/core';
import {
  COMMUNICATION_FILE_CHUNK_BYTES,
  COMMUNICATION_FILE_LOCAL_STAGING_MAX_BYTES
} from '@ppt/domain';
import type { CommunicationFilePayloadPort, VerifiedCommunicationFilePayload } from '@ppt/application';
import { ProtectedSideArtifactStore, type ProtectedSideArtifactEnvelope } from './protected-side-artifact-store.js';

const PAYLOAD_KIND = 'communication-file-local-sealed-payload-v1';
const REFERENCE = /^comm-file-[0-9a-f]{64}\.pptshare$/u;
const TEMPORARY = /^\.comm-file-[0-9]+-[0-9a-f]{16}\.tmp$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,255}$/u;
const MIME = /^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,127}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const MAX_FILES = 512;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_ENVELOPE_BYTES = 96 * 1024 * 1024;
const MAX_SCANNER_OUTPUT_BYTES = 1024 * 1024;
const DEFAULT_SCANNER_TIMEOUT_MS = 30_000;
const DETECTION_OUTPUT = /(?:has detected|detected|found)\s+(?:[1-9]\d*)\s+threats?/iu;

interface StoredCommunicationFilePayloadHeader {
  readonly schemaVersion: 1;
  readonly kind: typeof PAYLOAD_KIND;
  readonly familyId: string;
  readonly ownerPersonId: string;
  readonly fileId: string;
  readonly displayName: string;
  readonly mimeType: string;
  readonly totalBytes: number;
  readonly fullContentSha256: string;
  readonly occurredAt: string;
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export interface CommunicationFileMalwareScanResult {
  readonly verdict: 'clean' | 'malicious';
  readonly providerId: string;
  readonly evidenceSha256: string;
}

export interface CommunicationFileMalwareScannerPort {
  scan(input: { readonly bytes: Uint8Array; readonly mimeType: string; readonly fullContentSha256: string;
    readonly correlationId: CorrelationId }): Result<CommunicationFileMalwareScanResult, AppError>;
}

export interface CommunicationFileScannerProcessResult {
  readonly status: number | null;
  readonly signal: string | null;
  readonly stdout: Buffer;
  readonly stderr: Buffer;
  readonly errorCode?: string;
}

export interface CommunicationFileScannerProcessPort {
  run(executablePath: string, args: readonly string[], timeoutMs: number): CommunicationFileScannerProcessResult;
}

export interface WindowsDefenderCommunicationFileScannerOptions {
  readonly scratchDirectory: string;
  readonly executablePath: string;
  readonly timeoutMs?: number;
  readonly processRunner?: CommunicationFileScannerProcessPort;
}

export interface CommunicationFilePayloadVaultOptions {
  readonly rootDirectory: string;
  readonly protectedStore: ProtectedSideArtifactStore;
  readonly malwareScanner?: CommunicationFileMalwareScannerPort;
}

const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const payloadReference = (input: Pick<StoredCommunicationFilePayloadHeader,
  'familyId' | 'ownerPersonId' | 'fileId' | 'fullContentSha256'>): string =>
  `comm-file-${digest(Buffer.from(JSON.stringify({ familyId: input.familyId,
    ownerPersonId: input.ownerPersonId, fileId: input.fileId,
    fullContentSha256: input.fullContentSha256 }), 'utf8'))}.pptshare`;
const safeId = (value: unknown): value is string => typeof value === 'string' && value === value.trim()
  && IDENTIFIER.test(value) && !value.includes('..') && !value.includes('\\') && !value.includes('://');
const validIso = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) && Number.isFinite(Date.parse(value));
const failure = (correlationId: CorrelationId, message: string): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED, message, category: 'security', correlationId
}));
const samePath = (left: string, right: string): boolean => process.platform === 'win32'
  ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right);

const defaultScannerProcess: CommunicationFileScannerProcessPort = Object.freeze({
  run: (executablePath: string, args: readonly string[], timeoutMs: number) => {
    const result = spawnSync(executablePath, [...args], { shell: false, windowsHide: true, timeout: timeoutMs,
      killSignal: 'SIGKILL', maxBuffer: MAX_SCANNER_OUTPUT_BYTES, encoding: 'buffer' });
    return Object.freeze({ status: result.status, signal: result.signal,
      stdout: Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.alloc(0),
      stderr: Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.alloc(0),
      ...(result.error === undefined ? {} : { errorCode: 'code' in result.error && typeof result.error.code === 'string'
        ? result.error.code : 'PROCESS_ERROR' }) });
  }
});

export class WindowsDefenderCommunicationFileMalwareScanner implements CommunicationFileMalwareScannerPort {
  readonly #scratch: string;
  readonly #executable: string;
  readonly #executableSha256: string;
  readonly #executableDevice: number;
  readonly #executableInode: number;
  readonly #executableSize: number;
  readonly #timeoutMs: number;
  readonly #runner: CommunicationFileScannerProcessPort;

  public constructor(options: WindowsDefenderCommunicationFileScannerOptions) {
    if (!options || typeof options.scratchDirectory !== 'string' || !options.scratchDirectory.trim()
      || typeof options.executablePath !== 'string' || !resolve(options.executablePath).toLowerCase().endsWith('mpcmdrun.exe'))
      throw new Error('Windows Defender communication scanner options are invalid');
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_SCANNER_TIMEOUT_MS;
    if (!Number.isSafeInteger(this.#timeoutMs) || this.#timeoutMs < 1_000 || this.#timeoutMs > 120_000)
      throw new Error('Windows Defender communication scanner timeout is invalid');
    mkdirSync(options.scratchDirectory, { recursive: true, mode: 0o700 });
    const scratch = lstatSync(options.scratchDirectory);
    if (!scratch.isDirectory() || scratch.isSymbolicLink()) throw new Error('Windows Defender scanner scratch root is unsafe');
    this.#scratch = realpathSync(options.scratchDirectory);
    try { chmodSync(this.#scratch, 0o700); } catch { /* Windows ACL is authoritative. */ }
    const executablePath = resolve(options.executablePath);
    const executable = lstatSync(executablePath);
    if (!executable.isFile() || executable.isSymbolicLink() || executable.size < 1
      || executable.size > 128 * 1024 * 1024 || basename(executablePath).toLowerCase() !== 'mpcmdrun.exe')
      throw new Error('Windows Defender scanner executable is unsafe');
    this.#executable = realpathSync(executablePath);
    this.#executableDevice = executable.dev;
    this.#executableInode = executable.ino;
    this.#executableSize = executable.size;
    const executableBytes = readFileSync(this.#executable);
    try { this.#executableSha256 = digest(executableBytes); } finally { executableBytes.fill(0); }
    this.#runner = options.processRunner ?? defaultScannerProcess;
  }

  public scan(input: Parameters<CommunicationFileMalwareScannerPort['scan']>[0])
  : ReturnType<CommunicationFileMalwareScannerPort['scan']> {
    if (!(input.bytes instanceof Uint8Array) || input.bytes.byteLength < 1
      || input.bytes.byteLength > COMMUNICATION_FILE_LOCAL_STAGING_MAX_BYTES || !MIME.test(input.mimeType)
      || !SHA256.test(input.fullContentSha256) || digest(input.bytes) !== input.fullContentSha256)
      return failure(input.correlationId, 'Windows Defender tarama girdisi doğrulanamadı.');
    try { this.#assertScratch(); this.#assertExecutable(); }
    catch { return failure(input.correlationId, 'Windows Defender tarama otoritesi çalışma anında doğrulanamadı.'); }
    const temporary = join(this.#scratch, `.comm-scan-${process.pid}-${randomBytes(8).toString('hex')}.bin`);
    let descriptor: number | undefined; let stdout = Buffer.alloc(0); let stderr = Buffer.alloc(0);
    let combinedOutput: Buffer | undefined;
    let verdict: CommunicationFileMalwareScanResult | undefined; let scanFailed = false; let cleanupFailed = false;
    try {
      descriptor = openSync(temporary, 'wx', 0o600); writeFileSync(descriptor, input.bytes); fsyncSync(descriptor);
      closeSync(descriptor); descriptor = undefined; try { chmodSync(temporary, 0o600); } catch { /* Windows ACL is authoritative. */ }
      const before = lstatSync(temporary);
      if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size !== input.bytes.byteLength)
        throw new Error('Windows Defender scan staging identity is invalid');
      const result = this.#runner.run(this.#executable,
        ['-Scan', '-ScanType', '3', '-File', temporary, '-DisableRemediation'], this.#timeoutMs);
      if (!result || !Buffer.isBuffer(result.stdout) || !Buffer.isBuffer(result.stderr)
        || result.stdout.byteLength + result.stderr.byteLength > MAX_SCANNER_OUTPUT_BYTES
        || (result.status !== null && !Number.isSafeInteger(result.status))
        || (result.signal !== null && typeof result.signal !== 'string')
        || (result.errorCode !== undefined && typeof result.errorCode !== 'string'))
        throw new Error('Windows Defender process result is invalid');
      stdout = Buffer.from(result.stdout); stderr = Buffer.from(result.stderr);
      this.#assertExecutable();
      const after = lstatSync(temporary); const readback = readFileSync(temporary);
      try {
        if (!after.isFile() || after.isSymbolicLink() || after.nlink !== 1 || after.dev !== before.dev
          || after.ino !== before.ino || after.size !== input.bytes.byteLength || digest(readback) !== input.fullContentSha256)
          throw new Error('Windows Defender scan staging readback is invalid');
      } finally { readback.fill(0); }
      combinedOutput = Buffer.concat([stdout, Buffer.from([0]), stderr]);
      const outputSha256 = digest(combinedOutput);
      const evidenceSha256 = digest(Buffer.from(JSON.stringify({ schemaVersion: 1,
        providerId: 'microsoft-defender-mpcmdrun-v1', executableSha256: this.#executableSha256,
        contentSha256: input.fullContentSha256, mimeType: input.mimeType, status: result.status,
        signal: result.signal, outputSha256 }), 'utf8'));
      if (result.errorCode !== undefined || result.signal !== null || result.status === null) scanFailed = true;
      else if (result.status === 0) verdict = Object.freeze({ verdict: 'clean',
        providerId: 'microsoft-defender-mpcmdrun-v1', evidenceSha256 });
      else if (result.status === 2 && DETECTION_OUTPUT.test(combinedOutput.toString('utf8')))
        verdict = Object.freeze({ verdict: 'malicious', providerId: 'microsoft-defender-mpcmdrun-v1', evidenceSha256 });
      else scanFailed = true;
    } catch { scanFailed = true; }
    finally {
      if (descriptor !== undefined) try { closeSync(descriptor); } catch { cleanupFailed = true; }
      try { if (existsSync(temporary)) rmSync(temporary, { force: false }); } catch { cleanupFailed = true; }
      if (existsSync(temporary)) cleanupFailed = true;
      stdout.fill(0); stderr.fill(0); combinedOutput?.fill(0);
    }
    return !scanFailed && !cleanupFailed && verdict !== undefined ? ok(verdict)
      : failure(input.correlationId, 'Windows Defender taraması kesin ve temizlenmiş bir kanıt üretemedi.');
  }

  #assertScratch(): void {
    const scratch = lstatSync(this.#scratch);
    if (!scratch.isDirectory() || scratch.isSymbolicLink() || !samePath(realpathSync(this.#scratch), this.#scratch))
      throw new Error('Windows Defender scanner scratch identity changed');
  }

  #assertExecutable(): void {
    const executable = lstatSync(this.#executable);
    if (!executable.isFile() || executable.isSymbolicLink() || executable.dev !== this.#executableDevice
      || executable.ino !== this.#executableInode || executable.size !== this.#executableSize
      || !samePath(realpathSync(this.#executable), this.#executable))
      throw new Error('Windows Defender executable identity changed');
    const bytes = readFileSync(this.#executable);
    try { if (digest(bytes) !== this.#executableSha256) throw new Error('Windows Defender executable digest changed'); }
    finally { bytes.fill(0); }
  }
}

const parseEnvelope = (raw: Buffer): ProtectedSideArtifactEnvelope => {
  const value = JSON.parse(raw.toString('utf8')) as Partial<ProtectedSideArtifactEnvelope>;
  if (value.schemaVersion !== 1 || value.kind !== PAYLOAD_KIND || typeof value.product !== 'string'
    || typeof value.applicationVersion !== 'string' || !validIso(value.generatedAt) || !value.encryption
    || value.encryption.algorithm !== 'aes-256-gcm') throw new Error('Invalid protected communication file envelope');
  return value as ProtectedSideArtifactEnvelope;
};

const encodePayload = (header: StoredCommunicationFilePayloadHeader, bytes: Uint8Array): Buffer => {
  const headerBytes = Buffer.from(JSON.stringify(header), 'utf8');
  const result = Buffer.allocUnsafe(4 + headerBytes.byteLength + bytes.byteLength);
  result.writeUInt32BE(headerBytes.byteLength, 0); headerBytes.copy(result, 4); result.set(bytes, 4 + headerBytes.byteLength);
  headerBytes.fill(0); return result;
};

const decodePayload = (payload: Buffer): { readonly header: StoredCommunicationFilePayloadHeader; readonly bytes: Buffer } => {
  if (payload.byteLength < 5) throw new Error('Communication file payload is truncated');
  const headerLength = payload.readUInt32BE(0);
  if (headerLength < 2 || headerLength > 16_384 || 4 + headerLength >= payload.byteLength)
    throw new Error('Communication file payload header length is invalid');
  const header = JSON.parse(payload.subarray(4, 4 + headerLength).toString('utf8')) as StoredCommunicationFilePayloadHeader;
  if (header.schemaVersion !== 1 || header.kind !== PAYLOAD_KIND || !safeId(header.familyId)
    || !safeId(header.ownerPersonId) || !safeId(header.fileId) || typeof header.displayName !== 'string'
    || header.displayName.length < 1 || header.displayName.length > 255 || !MIME.test(header.mimeType)
    || !Number.isSafeInteger(header.totalBytes) || header.totalBytes < 1
    || header.totalBytes > COMMUNICATION_FILE_LOCAL_STAGING_MAX_BYTES || !SHA256.test(header.fullContentSha256)
    || !validIso(header.occurredAt) || header.networkUsed !== false || header.cloudUsed !== false
    || payload.byteLength - 4 - headerLength !== header.totalBytes) throw new Error('Communication file payload header is invalid');
  return Object.freeze({ header: Object.freeze(header), bytes: payload.subarray(4 + headerLength) });
};

export class CommunicationFilePayloadVault implements CommunicationFilePayloadPort {
  readonly #root: string;
  public constructor(private readonly options: CommunicationFilePayloadVaultOptions) {
    mkdirSync(options.rootDirectory, { recursive: true, mode: 0o700 });
    const stat = lstatSync(options.rootDirectory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Communication file payload root must be a real directory');
    this.#root = realpathSync(options.rootDirectory);
    try { chmodSync(this.#root, 0o700); } catch { /* Windows ACL is authoritative. */ }
    this.#assertRoot();
    this.#recoverInterruptedPublications();
  }

  public seal(input: Parameters<CommunicationFilePayloadPort['seal']>[0]): Result<VerifiedCommunicationFilePayload, AppError> {
    if (!safeId(input.familyId) || !safeId(input.ownerPersonId) || !safeId(input.fileId)
      || typeof input.displayName !== 'string' || input.displayName.normalize('NFKC').trim() !== input.displayName
      || input.displayName.length < 1 || input.displayName.length > 255 || !MIME.test(input.mimeType)
      || !(input.bytes instanceof Uint8Array) || input.bytes.byteLength < 1
      || input.bytes.byteLength > COMMUNICATION_FILE_LOCAL_STAGING_MAX_BYTES || !validIso(input.occurredAt))
      return failure(input.correlationId, 'Dosya payload kasası girdisi güvenlik sözleşmesine uymuyor.');
    const fullContentSha256 = digest(input.bytes);
    const scan = this.options.malwareScanner?.scan({ bytes: input.bytes, mimeType: input.mimeType,
      fullContentSha256, correlationId: input.correlationId });
    if (scan && !scan.ok) return scan;
    if (scan?.ok && (!safeId(scan.value.providerId) || !SHA256.test(scan.value.evidenceSha256)))
      return failure(input.correlationId, 'Zararlı dosya tarayıcı kanıtı geçersizdir.');
    const header: StoredCommunicationFilePayloadHeader = Object.freeze({ schemaVersion: 1, kind: PAYLOAD_KIND,
      familyId: input.familyId, ownerPersonId: input.ownerPersonId, fileId: input.fileId,
      displayName: input.displayName, mimeType: input.mimeType, totalBytes: input.bytes.byteLength,
      fullContentSha256, occurredAt: input.occurredAt, networkUsed: false, cloudUsed: false });
    const reference = payloadReference(header);
    const chunks = Object.freeze(Array.from({ length: Math.ceil(input.bytes.byteLength / COMMUNICATION_FILE_CHUNK_BYTES) }, (_, index) => {
      const offsetBytes = index * COMMUNICATION_FILE_CHUNK_BYTES;
      const chunk = input.bytes.subarray(offsetBytes, Math.min(input.bytes.byteLength, offsetBytes + COMMUNICATION_FILE_CHUNK_BYTES));
      return Object.freeze({ chunkIndex: index, offsetBytes, sizeBytes: chunk.byteLength, sha256: digest(chunk) });
    }));
    try {
      const reusedEvidence = this.#reuseExisting(reference, header, input.bytes);
      if (reusedEvidence !== null) return ok(Object.freeze({ sealedPayloadReference: reference, fullContentSha256,
        totalBytes: input.bytes.byteLength, totalChunks: chunks.length, providerId: 'protected-side-artifact-store-v1',
        providerEvidenceSha256: reusedEvidence, verifiedChunks: chunks,
        scanState: scan?.ok ? scan.value.verdict : 'provider_unavailable',
        ...(scan?.ok ? { scanProviderId: scan.value.providerId, scanEvidenceSha256: scan.value.evidenceSha256 } : {}) }));
    } catch { return failure(input.correlationId, 'Dosya payload kasası mevcut no-overwrite kaydını doğrulayamadı.'); }
    const plaintext = encodePayload(header, input.bytes);
    let encrypted: Buffer | undefined;
    let publishedReference: string | undefined;
    try {
      const envelope = this.options.protectedStore.sealBuffer(PAYLOAD_KIND, plaintext);
      encrypted = Buffer.from(`${JSON.stringify(envelope)}\n`, 'utf8');
      this.#publish(reference, encrypted);
      publishedReference = reference;
      const readback = this.#open(reference);
      try {
        const decoded = decodePayload(readback);
        if (decoded.header.familyId !== input.familyId || decoded.header.ownerPersonId !== input.ownerPersonId
          || decoded.header.fileId !== input.fileId || decoded.header.fullContentSha256 !== fullContentSha256
          || !decoded.bytes.equals(Buffer.from(input.bytes.buffer, input.bytes.byteOffset, input.bytes.byteLength))) {
          this.#remove(reference); return failure(input.correlationId, 'Dosya payload kasası readback doğrulaması başarısız.');
        }
      } finally { readback.fill(0); }
      return ok(Object.freeze({ sealedPayloadReference: reference, fullContentSha256,
        totalBytes: input.bytes.byteLength, totalChunks: chunks.length, providerId: 'protected-side-artifact-store-v1',
        providerEvidenceSha256: digest(encrypted), verifiedChunks: chunks,
        scanState: scan?.ok ? scan.value.verdict : 'provider_unavailable',
        ...(scan?.ok ? { scanProviderId: scan.value.providerId, scanEvidenceSha256: scan.value.evidenceSha256 } : {}) }));
    } catch {
      if (publishedReference !== undefined) {
        try { this.#remove(publishedReference); } catch { /* Preserve the original fail-closed result. */ }
      }
      return failure(input.correlationId, 'Dosya payload kasası güvenli yazımı başarısız.');
    } finally { plaintext.fill(0); encrypted?.fill(0); }
  }

  public open(input: Parameters<CommunicationFilePayloadPort['open']>[0]): ReturnType<CommunicationFilePayloadPort['open']> {
    if (!REFERENCE.test(input.reference) || !safeId(input.familyId) || !safeId(input.ownerPersonId)
      || !safeId(input.fileId) || typeof input.displayName !== 'string' || input.displayName.length < 1
      || input.displayName.length > 255 || !MIME.test(input.mimeType) || !Number.isSafeInteger(input.totalBytes)
      || input.totalBytes < 1 || input.totalBytes > COMMUNICATION_FILE_LOCAL_STAGING_MAX_BYTES
      || !SHA256.test(input.fullContentSha256) || !SHA256.test(input.providerEvidenceSha256))
      return failure(input.correlationId, 'Dosya payload kasası okuma bağlayıcısı geçersizdir.');
    let encrypted: Buffer | undefined; let plaintext: Buffer | undefined;
    try {
      encrypted = this.#raw(input.reference);
      if (digest(encrypted) !== input.providerEvidenceSha256) return failure(input.correlationId, 'Dosya payload sağlayıcı kanıtı uyuşmuyor.');
      plaintext = this.options.protectedStore.openEnvelope(parseEnvelope(encrypted));
      const decoded = decodePayload(plaintext);
      if (decoded.header.familyId !== input.familyId || decoded.header.ownerPersonId !== input.ownerPersonId
        || decoded.header.fileId !== input.fileId || decoded.header.displayName !== input.displayName
        || decoded.header.mimeType !== input.mimeType || decoded.header.totalBytes !== input.totalBytes
        || decoded.header.fullContentSha256 !== input.fullContentSha256
        || digest(decoded.bytes) !== input.fullContentSha256)
        return failure(input.correlationId, 'Dosya payload kimlik veya içerik bağı uyuşmuyor.');
      return ok(Buffer.from(decoded.bytes));
    } catch { return failure(input.correlationId, 'Dosya payload kasası açılamadı.'); }
    finally { encrypted?.fill(0); plaintext?.fill(0); }
  }

  public sweepOrphans(input: Parameters<CommunicationFilePayloadPort['sweepOrphans']>[0])
  : ReturnType<CommunicationFilePayloadPort['sweepOrphans']> {
    if (!safeId(input.familyId) || !safeId(input.ownerPersonId) || !validIso(input.completedBefore)
      || !Number.isSafeInteger(input.maximumCandidates) || input.maximumCandidates < 1 || input.maximumCandidates > 128
      || !Array.isArray(input.referencedPayloads) || input.referencedPayloads.length > MAX_FILES
      || input.referencedPayloads.some((reference, index) => !REFERENCE.test(reference)
        || (index > 0 && String(input.referencedPayloads[index - 1]).localeCompare(reference) >= 0))) {
      return failure(input.correlationId, 'Dosya payload kasası yetim bakım girdisi geçersizdir.');
    }
    try {
      this.#assertRoot();
      const inventory = readdirSync(this.#root, { withFileTypes: true });
      if (inventory.length > MAX_FILES + 64 || inventory.some((entry) => !entry.isFile() || entry.isSymbolicLink()
        || (!REFERENCE.test(entry.name) && !TEMPORARY.test(entry.name)))) {
        return failure(input.correlationId, 'Dosya payload kasası yetim bakım envanteri güvenli değildir.');
      }
      const entries = inventory.filter((entry) => REFERENCE.test(entry.name))
        .sort((left, right) => left.name.localeCompare(right.name));
      if (entries.length === 0) return ok(Object.freeze({ scannedFiles: 0, deletedFiles: 0, rejectedFiles: 0 }));
      const preserved = new Set(input.referencedPayloads);
      const rotation = Number.parseInt(digest(Buffer.from(`${input.familyId}:${input.ownerPersonId}:${input.completedBefore.slice(0, 10)}`,
        'utf8')).slice(0, 8), 16) % entries.length;
      const scanCount = Math.min(input.maximumCandidates, entries.length);
      let deletedFiles = 0; let rejectedFiles = 0;
      for (let offset = 0; offset < scanCount; offset += 1) {
        const entry = entries[(rotation + offset) % entries.length];
        if (entry === undefined) continue;
        let encrypted: Buffer | undefined; let plaintext: Buffer | undefined;
        try {
          encrypted = this.#raw(entry.name);
          plaintext = this.options.protectedStore.openEnvelope(parseEnvelope(encrypted));
          const decoded = decodePayload(plaintext);
          if (digest(decoded.bytes) !== decoded.header.fullContentSha256
            || payloadReference(decoded.header) !== entry.name) throw new Error('Communication file orphan binding is invalid');
          if (decoded.header.familyId !== input.familyId || decoded.header.ownerPersonId !== input.ownerPersonId
            || preserved.has(entry.name) || Date.parse(decoded.header.occurredAt) >= Date.parse(input.completedBefore)) continue;
          this.#remove(entry.name);
          if (existsSync(join(this.#root, entry.name))) throw new Error('Communication file orphan deletion readback failed');
          deletedFiles += 1;
        } catch { rejectedFiles += 1; }
        finally { encrypted?.fill(0); plaintext?.fill(0); }
      }
      return ok(Object.freeze({ scannedFiles: scanCount, deletedFiles, rejectedFiles }));
    } catch { return failure(input.correlationId, 'Dosya payload kasası yetim bakımı başarısız.'); }
  }

  public discard(reference: string, correlationId: CorrelationId): Result<void, AppError> {
    if (!REFERENCE.test(reference)) return failure(correlationId, 'Dosya payload kasası silme referansı geçersizdir.');
    try { this.#remove(reference); return existsSync(join(this.#root, reference))
      ? failure(correlationId, 'Dosya payload kasası silme readback doğrulaması başarısız.') : ok(undefined); }
    catch { return failure(correlationId, 'Dosya payload kasası mantıksal silme işlemi başarısız.'); }
  }

  #path(reference: string): string {
    if (!REFERENCE.test(reference)) throw new Error('Invalid communication file payload reference');
    const path = join(this.#root, reference);
    if (!samePath(realpathSync(dirname(path)), this.#root)) throw new Error('Communication file payload path escaped its root');
    return path;
  }
  #assertRoot(): void {
    const stat = lstatSync(this.#root);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !samePath(realpathSync(this.#root), this.#root))
      throw new Error('Communication file payload root identity is invalid');
  }
  #reuseExisting(reference: string, expected: StoredCommunicationFilePayloadHeader, bytes: Uint8Array): string | null {
    const path = join(this.#root, reference);
    if (!existsSync(path)) return null;
    let encrypted: Buffer | undefined; let plaintext: Buffer | undefined;
    try {
      encrypted = this.#raw(reference);
      plaintext = this.options.protectedStore.openEnvelope(parseEnvelope(encrypted));
      const decoded = decodePayload(plaintext);
      if (decoded.header.familyId !== expected.familyId || decoded.header.ownerPersonId !== expected.ownerPersonId
        || decoded.header.fileId !== expected.fileId || decoded.header.displayName !== expected.displayName
        || decoded.header.mimeType !== expected.mimeType || decoded.header.totalBytes !== expected.totalBytes
        || decoded.header.fullContentSha256 !== expected.fullContentSha256
        || !decoded.bytes.equals(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))) {
        throw new Error('Communication file payload no-overwrite identity conflict');
      }
      return digest(encrypted);
    } finally { encrypted?.fill(0); plaintext?.fill(0); }
  }
  #recoverInterruptedPublications(): void {
    this.#assertRoot();
    const entries = readdirSync(this.#root, { withFileTypes: true });
    if (entries.length > MAX_FILES + 64) throw new Error('Communication file payload root inventory exceeded');
    const temporaryEntries = entries.filter((entry) => TEMPORARY.test(entry.name));
    if (temporaryEntries.length > 64) throw new Error('Communication file payload temporary inventory exceeded');
    for (const entry of entries) {
      if (!REFERENCE.test(entry.name) && !TEMPORARY.test(entry.name))
        throw new Error('Communication file payload root contains an unknown entry');
      if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('Communication file payload root entry is unsafe');
    }
    for (const entry of temporaryEntries) {
      const temporaryPath = join(this.#root, entry.name);
      const temporaryStat = lstatSync(temporaryPath);
      if (!temporaryStat.isFile() || temporaryStat.isSymbolicLink() || ![1, 2].includes(temporaryStat.nlink)
        || temporaryStat.size < 2 || temporaryStat.size > MAX_ENVELOPE_BYTES)
        throw new Error('Communication file payload interrupted publication is unsafe');
      let encrypted: Buffer | undefined; let plaintext: Buffer | undefined; let recoveredTargetPath: string | undefined;
      let validatedTemporary = false;
      try {
        encrypted = this.#rawAtPath(temporaryPath, new Set([1, 2]));
        plaintext = this.options.protectedStore.openEnvelope(parseEnvelope(encrypted));
        const decoded = decodePayload(plaintext);
        if (digest(decoded.bytes) !== decoded.header.fullContentSha256)
          throw new Error('Communication file payload recovery content digest is invalid');
        validatedTemporary = true;
        const reference = payloadReference(decoded.header);
        const targetPath = join(this.#root, reference);
        if (existsSync(targetPath)) {
          const target = this.#rawAtPath(targetPath, new Set([1, 2]));
          try { if (digest(target) !== digest(encrypted)) throw new Error('Communication file payload recovery conflict'); }
          finally { target.fill(0); }
          rmSync(temporaryPath, { force: false });
        } else {
          linkSync(temporaryPath, targetPath);
          recoveredTargetPath = targetPath;
          rmSync(temporaryPath, { force: false });
        }
        const recovered = lstatSync(targetPath);
        if (!recovered.isFile() || recovered.isSymbolicLink() || recovered.nlink !== 1
          || recovered.size !== encrypted.byteLength) throw new Error('Communication file payload recovery readback failed');
      } catch (error) {
        if (recoveredTargetPath !== undefined && existsSync(recoveredTargetPath)) {
          try {
            const recovered = lstatSync(recoveredTargetPath);
            if (recovered.isFile() && !recovered.isSymbolicLink() && recovered.nlink === 1) rmSync(recoveredTargetPath, { force: false });
          } catch { /* Preserve the fail-closed constructor error. */ }
        }
        if (!validatedTemporary && temporaryStat.nlink === 1 && existsSync(temporaryPath)) {
          try { rmSync(temporaryPath, { force: false }); } catch { /* Preserve the fail-closed constructor error. */ }
          continue;
        }
        throw error;
      } finally { encrypted?.fill(0); plaintext?.fill(0); }
    }
  }
  #raw(reference: string): Buffer {
    return this.#rawAtPath(this.#path(reference), new Set([1]));
  }
  #rawAtPath(path: string, allowedLinkCounts: ReadonlySet<number>): Buffer {
    this.#assertRoot();
    if (!samePath(realpathSync(dirname(path)), this.#root)) throw new Error('Communication file payload path escaped its root');
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || !allowedLinkCounts.has(stat.nlink)
      || stat.size < 2 || stat.size > MAX_ENVELOPE_BYTES)
      throw new Error('Communication file payload metadata is invalid');
    const descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try { const opened = fstatSync(descriptor);
      if (!opened.isFile() || !allowedLinkCounts.has(opened.nlink) || opened.dev !== stat.dev || opened.ino !== stat.ino)
        throw new Error('Communication file payload identity changed');
      return readFileSync(descriptor);
    } finally { closeSync(descriptor); }
  }
  #open(reference: string): Buffer {
    const encrypted = this.#raw(reference);
    try { return this.options.protectedStore.openEnvelope(parseEnvelope(encrypted)); }
    finally { encrypted.fill(0); }
  }
  #publish(reference: string, encrypted: Buffer): void {
    this.#assertRoot();
    const inventory = readdirSync(this.#root, { withFileTypes: true });
    if (inventory.some((entry) => !entry.isFile() || entry.isSymbolicLink()
      || (!REFERENCE.test(entry.name) && !TEMPORARY.test(entry.name))))
      throw new Error('Communication file payload root inventory is unsafe');
    const files = inventory.filter((entry) => entry.isFile() && REFERENCE.test(entry.name));
    let bytes = 0; for (const entry of files) bytes += lstatSync(join(this.#root, entry.name)).size;
    if (files.length >= MAX_FILES || bytes + encrypted.byteLength > MAX_TOTAL_BYTES) throw new Error('Communication file payload vault quota exceeded');
    const target = join(this.#root, reference); if (existsSync(target)) throw new Error('Communication file payload no-overwrite conflict');
    const temporary = join(this.#root, `.comm-file-${process.pid}-${randomBytes(8).toString('hex')}.tmp`);
    let descriptor: number | undefined; let publishedByThisCall = false;
    try {
      descriptor = openSync(temporary, 'wx', 0o600); writeFileSync(descriptor, encrypted); fsyncSync(descriptor);
      closeSync(descriptor); descriptor = undefined; try { chmodSync(temporary, 0o600); } catch { /* Windows ACL is authoritative. */ }
      linkSync(temporary, target); publishedByThisCall = true; rmSync(temporary, { force: true }); try { chmodSync(target, 0o600); } catch { /* Windows ACL is authoritative. */ }
      const stat = lstatSync(target); if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size !== encrypted.byteLength)
        throw new Error('Communication file payload publish readback failed');
    } catch (error) {
      if (descriptor !== undefined) try { closeSync(descriptor); } catch { /* best effort */ }
      rmSync(temporary, { force: true }); if (publishedByThisCall) rmSync(target, { force: true }); throw error;
    }
  }
  #remove(reference: string): void {
    const path = join(this.#root, reference); if (!existsSync(path)) return;
    const stat = lstatSync(path); if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1)
      throw new Error('Unsafe communication file payload removal target');
    rmSync(path, { force: false });
  }
}
