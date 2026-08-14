import { createHash } from 'node:crypto';
import {
  existsSync,
  linkSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ArchiveVaultFilePort } from '@ppt/application';
import {
  ERROR_CODES,
  asCorrelationId,
  createAppError,
  err,
  ok,
  type CorrelationId
} from '@ppt/core';
import {
  LocalOcrSecurityError,
  type BoundedLocalOcrSource,
  type InspectedLocalOcrSource,
  type LocalOcrResult
} from '@ppt/security';
import type { DeviceSecretProtector } from '../src/main/device-secret-protector.js';
import type {
  LocalOcrEngineDescriptor,
  LocalOcrEnginePort,
  LocalOcrWorkerQuotas
} from '../src/main/local-ocr-engine-adapter.js';
import {
  BoundedLocalOcrWorker,
  NotConfiguredLocalOcrMalwareVerdictAdapter,
  type LocalOcrMalwareScanRequest,
  type LocalOcrMalwareScanResult,
  type LocalOcrMalwareScannerDescriptor,
  type LocalOcrMalwareVerdictPort
} from '../src/main/local-ocr-worker.js';
import {
  MainLocalGovernedOcrRuntimeAdapter,
  type AuthorizedLocalGovernedOcrArchiveSource,
  type AuthorizedLocalGovernedOcrJobBinding,
  type LocalGovernedOcrMainAuthorityPort
} from '../src/main/local-governed-ocr-runtime-adapter.js';
import {
  LocalGovernedOcrResultVault,
  type LocalGovernedOcrRuntimeBinding
} from '../src/main/local-governed-ocr-result-vault.js';
import { ProtectedSideArtifactStore } from '../src/main/protected-side-artifact-store.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n', 'latin1');
const CORRELATION = asCorrelationId('local-ocr-runtime-test');
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

class TestProtector implements DeviceSecretProtector {
  public readonly protectionId = 'test-current-user-protector-v1';
  public readonly required = true;
  public isAvailable(): boolean { return true; }
  public protect(secret: string): string { return Buffer.from(`wrapped:${secret}`, 'utf8').toString('base64'); }
  public unprotect(value: string): string {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    if (!decoded.startsWith('wrapped:')) throw new Error('foreign protection');
    return decoded.slice('wrapped:'.length);
  }
}

class FakeArchiveVaultFiles implements ArchiveVaultFilePort {
  public readonly bytesByItem = new Map<string, Buffer>();
  public lastReturnedBytes: Buffer | undefined;
  public corruptNextRead = false;
  public store(): ReturnType<ArchiveVaultFilePort['store']> { throw new Error('not used'); }
  public materialize(): ReturnType<ArchiveVaultFilePort['materialize']> { throw new Error('not used'); }
  public readBytes(
    input: Parameters<ArchiveVaultFilePort['readBytes']>[0],
    correlationId: CorrelationId
  ): ReturnType<ArchiveVaultFilePort['readBytes']> {
    const source = this.bytesByItem.get(input.itemId);
    if (!source) return err(createAppError({
      code: ERROR_CODES.RESOURCE_NOT_FOUND, message: 'missing', category: 'not_found', correlationId
    }));
    const result = Buffer.from(source);
    if (this.corruptNextRead) { result[result.length - 1] = Number(result[result.length - 1]) ^ 0x01; this.corruptNextRead = false; }
    this.lastReturnedBytes = result;
    return ok(result);
  }
  public destroy(): ReturnType<ArchiveVaultFilePort['destroy']> { return ok(undefined); }
}

class FakeAuthority implements LocalGovernedOcrMainAuthorityPort {
  public readonly sources = new Map<string, AuthorizedLocalGovernedOcrArchiveSource>();
  public readonly current = new Map<string, string | null>();
  public readonly foreignSweepJobs = new Set<string>();
  public denyJobs = new Set<string>();

  public addJob(jobId: string, bytes: Buffer, mimeType: 'image/png' | 'image/jpeg' | 'application/pdf', originalName: string):
  AuthorizedLocalGovernedOcrArchiveSource {
    const sourceResourceId = `archive-${jobId}`;
    const source: AuthorizedLocalGovernedOcrArchiveSource = Object.freeze({
      authority: 'central_pep_authorized_archive_vault_read',
      resourceType: 'archive_item',
      familyId: 'family-33-q',
      accountId: 'account-33-q',
      ownerPersonId: 'person-33-q',
      jobId,
      derivedResourceId: `derived-${jobId}`,
      sourceResourceId,
      inputSha256: sha256(bytes),
      storedName: `${sourceResourceId}.vault`,
      originalName,
      mimeType,
      sizeBytes: bytes.byteLength
    });
    this.sources.set(jobId, source);
    this.current.set(jobId, null);
    return source;
  }

  public resolveAuthorizedArchiveSource(
    input: Parameters<LocalGovernedOcrMainAuthorityPort['resolveAuthorizedArchiveSource']>[0]
  ): ReturnType<LocalGovernedOcrMainAuthorityPort['resolveAuthorizedArchiveSource']> {
    const source = this.sources.get(input.jobId);
    if (!source || this.denyJobs.has(input.jobId)) return err(createAppError({
      code: ERROR_CODES.AUTHORIZATION_DENIED, message: 'denied', category: 'authorization', correlationId: input.correlationId
    }));
    return ok(source);
  }

  public resolveAuthorizedJobBinding(
    input: Parameters<LocalGovernedOcrMainAuthorityPort['resolveAuthorizedJobBinding']>[0]
  ): ReturnType<LocalGovernedOcrMainAuthorityPort['resolveAuthorizedJobBinding']> {
    const source = this.sources.get(input.jobId);
    if (!source || this.denyJobs.has(input.jobId)) return err(createAppError({
      code: ERROR_CODES.AUTHORIZATION_DENIED, message: 'denied', category: 'authorization', correlationId: input.correlationId
    }));
    const ownerPersonId = input.operation === 'orphan_sweep' && this.foreignSweepJobs.has(input.jobId)
      ? 'person-foreign' : source.ownerPersonId;
    return ok(Object.freeze({
      authority: 'central_pep_authorized_local_ocr_job',
      familyId: source.familyId,
      accountId: source.accountId,
      ownerPersonId,
      jobId: source.jobId,
      derivedResourceId: source.derivedResourceId,
      sourceResourceId: source.sourceResourceId,
      inputSha256: source.inputSha256,
      currentSealedResultId: this.current.get(input.jobId) ?? null
    } satisfies AuthorizedLocalGovernedOcrJobBinding));
  }
}

const engineDescriptor = (): LocalOcrEngineDescriptor => Object.freeze({
  configured: true,
  engineId: 'deterministic-local-ocr-v1',
  provider: 'windows_media_ocr',
  executionBoundary: 'bounded-child-process',
  localOnly: true,
  networkAccess: false,
  cloudProcessing: false,
  inputTransferredByPath: false,
  temporaryPlaintextCreated: false,
  processSeparated: true,
  lowPrivilegeSandboxVerified: false,
  resourceLimitsEnforcedPerJob: true,
  supportedMediaTypes: Object.freeze(['image/png'] as const),
  confidenceAvailable: false
});

class FakeEngine implements LocalOcrEnginePort {
  public calls = 0;
  public waitForAbort = false;
  public readonly started: Promise<void>;
  private markStarted!: () => void;
  public constructor() { this.started = new Promise((resolve) => { this.markStarted = resolve; }); }
  public descriptor(): LocalOcrEngineDescriptor { return engineDescriptor(); }
  public async inspect(source: InspectedLocalOcrSource, signal: AbortSignal) {
    if (signal.aborted) throw new LocalOcrSecurityError('CANCELLED');
    return Object.freeze({ inputSha256: source.sha256, pageCount: 1, encrypted: false });
  }
  public async recognize(source: BoundedLocalOcrSource, quotas: LocalOcrWorkerQuotas, signal: AbortSignal): Promise<unknown> {
    this.calls += 1;
    this.markStarted();
    if (this.waitForAbort) {
      await new Promise<never>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new LocalOcrSecurityError('CANCELLED')), { once: true });
        if (signal.aborted) reject(new LocalOcrSecurityError('CANCELLED'));
      });
    }
    return Object.freeze({
      schemaVersion: 1,
      engineId: 'deterministic-local-ocr-v1',
      inputSha256: source.sha256,
      mediaType: source.mediaType,
      pageCount: source.pageCount,
      text: 'Aylık kaynak bütçesi 20.000 TL',
      confidence: { available: false, value: null },
      languages: [{ languageTag: 'tr', confidence: { available: false, value: null } }],
      layout: [{
        id: 'word-1', pageNumber: 1, kind: 'text', text: 'Aylık',
        boundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
        confidence: { available: false, value: null }
      }],
      execution: {
        localOnly: true, networkUsed: false, cloudUsed: false, processSeparated: true,
        lowPrivilegeSandboxVerified: false, memoryLimitEnforced: true, cpuTimeLimitEnforced: true,
        timeLimitEnforced: true, outputLimitEnforced: true, durationMs: 1,
        memoryLimitMiB: quotas.memoryLimitMiB, cpuTimeLimitMs: quotas.timeoutMs,
        timeLimitMs: quotas.timeoutMs, outputLimitBytes: quotas.outputLimitBytes
      }
    } satisfies LocalOcrResult);
  }
}

class CleanScanner implements LocalOcrMalwareVerdictPort {
  public descriptor(): LocalOcrMalwareScannerDescriptor {
    return Object.freeze({ configured: true, scannerId: 'local-clean-scanner-v1', localOnly: true,
      networkAccess: false, cloudProcessing: false });
  }
  public async scan(request: LocalOcrMalwareScanRequest, signal: AbortSignal): Promise<LocalOcrMalwareScanResult> {
    if (signal.aborted) throw new LocalOcrSecurityError('CANCELLED');
    return Object.freeze({ schemaVersion: 1, scannerId: 'local-clean-scanner-v1', inputSha256: request.inputSha256,
      sizeBytes: request.sizeBytes, verdict: 'clean', localOnly: true, networkUsed: false, cloudUsed: false });
  }
}

const directories: string[] = [];
const stores: ProtectedSideArtifactStore[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.dispose();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const setup = (options: {
  readonly scanner?: LocalOcrMalwareVerdictPort;
  readonly engine?: FakeEngine;
  readonly now?: () => string;
  readonly orphanGraceMs?: number;
  readonly maximumFiles?: number;
} = {}) => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-33q-ocr-sealed-'));
  directories.push(directory);
  const protectedStore = new ProtectedSideArtifactStore({
    keyPath: join(directory, 'keys', 'side-artifact-key.json'),
    applicationVersion: '33-q-test',
    protector: new TestProtector(),
    now: options.now
  });
  stores.push(protectedStore);
  const resultRoot = join(directory, 'main-only-ocr-results');
  const vault = new LocalGovernedOcrResultVault({
    rootDirectory: resultRoot,
    protectedStore,
    ...(options.maximumFiles === undefined ? {} : { maximumFiles: options.maximumFiles })
  });
  const authority = new FakeAuthority();
  const archive = new FakeArchiveVaultFiles();
  const engine = options.engine ?? new FakeEngine();
  const worker = new BoundedLocalOcrWorker(engine, options.scanner ?? new CleanScanner());
  const runtime = new MainLocalGovernedOcrRuntimeAdapter({
    authority,
    archiveVaultFiles: archive,
    resultVault: vault,
    worker,
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.orphanGraceMs === undefined ? {} : { orphanGraceMs: options.orphanGraceMs })
  });
  return { directory, resultRoot, protectedStore, vault, authority, archive, engine, runtime };
};

const addPngJob = (context: ReturnType<typeof setup>, jobId: string) => {
  const source = context.authority.addJob(jobId, PNG, 'image/png', 'receipt.png');
  context.archive.bytesByItem.set(source.sourceResourceId, PNG);
  return source;
};

const runInput = (source: AuthorizedLocalGovernedOcrArchiveSource) => ({
  jobId: source.jobId,
  derivedResourceId: source.derivedResourceId,
  sourceResourceType: 'archive_item' as const,
  sourceResourceId: source.sourceResourceId,
  expectedInputSha256: source.inputSha256,
  languageHints: ['tr'],
  correlationId: CORRELATION
});
const runtimeBinding = (source: AuthorizedLocalGovernedOcrArchiveSource): LocalGovernedOcrRuntimeBinding => ({
  familyId: source.familyId,
  accountId: source.accountId,
  ownerPersonId: source.ownerPersonId,
  jobId: source.jobId,
  derivedResourceId: source.derivedResourceId,
  sourceResourceId: source.sourceResourceId,
  inputSha256: source.inputSha256
});

describe('MainLocalGovernedOcrRuntimeAdapter / encrypted sealed result vault', () => {
  it('reads only archive-vault bytes, seals main-only plaintext and verifies exact readback', async () => {
    const context = setup();
    const source = addPngJob(context, 'job-0001');
    const executed = await context.runtime.runAndSeal(runInput(source));
    expect(executed.ok).toBe(true);
    if (!executed.ok || executed.value.status !== 'completed') return;
    context.authority.current.set(source.jobId, executed.value.sealedResultId);
    expect(context.archive.lastReturnedBytes?.every((byte) => byte === 0)).toBe(true);
    expect(context.engine.calls).toBe(1);
    const files = readdirSync(context.resultRoot).filter((name) => name.endsWith('.ocrsealed'));
    expect(files).toHaveLength(1);
    const raw = readFileSync(join(context.resultRoot, files[0]!));
    expect(raw.includes(Buffer.from('Aylık kaynak bütçesi', 'utf8'))).toBe(false);
    if (process.platform !== 'win32') expect(statSync(join(context.resultRoot, files[0]!)).mode & 0o777).toBe(0o600);
    const read = await context.runtime.readSealedResult({
      jobId: source.jobId, sealedResultId: executed.value.sealedResultId, correlationId: CORRELATION
    });
    expect(read).toEqual(ok({ text: 'Aylık kaynak bütçesi 20.000 TL',
      contentSha256: sha256(Buffer.from('Aylık kaynak bütçesi 20.000 TL', 'utf8')),
      networkUsed: false, cloudUsed: false }));
    expect(context.runtime.truth()).toEqual(expect.objectContaining({
      sourceAuthority: 'archive_vault_read_bytes_only', networkUsed: false, cloudUsed: false,
      lowPrivilegeSandboxVerified: false, sourceBytesExposedToRenderer: false
    }));
  });

  it('fails closed when the explicit local malware provider is not configured', async () => {
    const context = setup({ scanner: new NotConfiguredLocalOcrMalwareVerdictAdapter() });
    const source = addPngJob(context, 'job-0002');
    const executed = await context.runtime.runAndSeal(runInput(source));
    expect(executed.ok && executed.value).toEqual(expect.objectContaining({
      status: 'failed', failureCode: 'engine_failed', networkUsed: false, cloudUsed: false
    }));
    expect(readdirSync(context.resultRoot)).toEqual([]);
    expect(context.archive.lastReturnedBytes?.every((byte) => byte === 0)).toBe(true);
  });

  it('reuses the verified deterministic envelope after a simulated DB rollback instead of rerunning or overwriting', async () => {
    const context = setup();
    const source = addPngJob(context, 'job-0002b');
    const first = await context.runtime.runAndSeal(runInput(source));
    // currentSealedResultId deliberately remains null: the external seal succeeded but the DB transaction did not.
    const second = await context.runtime.runAndSeal(runInput(source));
    expect(first.ok && first.value.status).toBe('completed');
    expect(second).toEqual(first);
    expect(context.engine.calls).toBe(1);
    expect(readdirSync(context.resultRoot).filter((name) => name.endsWith('.ocrsealed'))).toHaveLength(1);
  });

  it('keeps PDF unsupported and never creates a sealed result', async () => {
    const context = setup();
    const source = context.authority.addJob('job-0003', PDF, 'application/pdf', 'document.pdf');
    context.archive.bytesByItem.set(source.sourceResourceId, PDF);
    const executed = await context.runtime.runAndSeal(runInput(source));
    expect(executed.ok && executed.value).toEqual(expect.objectContaining({ status: 'failed', failureCode: 'engine_failed' }));
    expect(context.engine.calls).toBe(0);
    expect(readdirSync(context.resultRoot)).toEqual([]);
  });

  it('reports exact archive hash drift as integrity mismatch and zeroes the rejected bytes', async () => {
    const context = setup();
    const source = addPngJob(context, 'job-0004');
    context.archive.corruptNextRead = true;
    const executed = await context.runtime.runAndSeal(runInput(source));
    expect(executed.ok && executed.value).toEqual(expect.objectContaining({
      status: 'failed', failureCode: 'integrity_mismatch'
    }));
    expect(context.archive.lastReturnedBytes?.every((byte) => byte === 0)).toBe(true);
    expect(readdirSync(context.resultRoot)).toEqual([]);
  });

  it('reseals corrections, exposes only the current authorized result and purges the full owner-bound chain', async () => {
    const context = setup();
    const source = addPngJob(context, 'job-0005');
    const executed = await context.runtime.runAndSeal(runInput(source));
    expect(executed.ok && executed.value.status).toBe('completed');
    if (!executed.ok || executed.value.status !== 'completed') return;
    context.authority.current.set(source.jobId, executed.value.sealedResultId);
    const corrected = await context.runtime.correctAndSeal({
      jobId: source.jobId,
      previousSealedResultId: executed.value.sealedResultId,
      expectedInputSha256: source.inputSha256,
      correctedText: 'Düzeltilmiş tutar 20.000 TL',
      correlationId: CORRELATION
    });
    expect(corrected.ok).toBe(true);
    if (!corrected.ok) return;
    expect(corrected.value.sealedResultId).not.toBe(executed.value.sealedResultId);
    expect(readdirSync(context.resultRoot).filter((name) => name.endsWith('.ocrsealed'))).toHaveLength(2);
    context.authority.current.set(source.jobId, corrected.value.sealedResultId);
    const staleRead = await context.runtime.readSealedResult({
      jobId: source.jobId, sealedResultId: executed.value.sealedResultId, correlationId: CORRELATION
    });
    expect(staleRead.ok).toBe(false);
    const read = await context.runtime.readSealedResult({
      jobId: source.jobId, sealedResultId: corrected.value.sealedResultId, correlationId: CORRELATION
    });
    expect(read.ok && read.value.text).toBe('Düzeltilmiş tutar 20.000 TL');
    const purged = await context.runtime.purgeSealedResult({
      jobId: source.jobId, sealedResultId: corrected.value.sealedResultId, correlationId: CORRELATION
    });
    expect(purged).toEqual(ok({ deleted: true, verified: true }));
    expect(readdirSync(context.resultRoot).filter((name) => name.endsWith('.ocrsealed'))).toEqual([]);
    context.authority.current.set(source.jobId, null);
    const retried = await context.runtime.purgeSealedResult({
      jobId: source.jobId, sealedResultId: corrected.value.sealedResultId, correlationId: CORRELATION
    });
    expect(retried).toEqual(ok({ deleted: true, verified: true }));
  });

  it('rejects foreign-owner authority and leaves the envelope untouched', async () => {
    const context = setup();
    const source = addPngJob(context, 'job-0006');
    const executed = await context.runtime.runAndSeal(runInput(source));
    if (!executed.ok || executed.value.status !== 'completed') throw new Error('setup failed');
    context.authority.current.set(source.jobId, executed.value.sealedResultId);
    context.authority.sources.set(source.jobId, Object.freeze({ ...source, ownerPersonId: 'person-foreign' }));
    const read = await context.runtime.readSealedResult({
      jobId: source.jobId, sealedResultId: executed.value.sealedResultId, correlationId: CORRELATION
    });
    const purge = await context.runtime.purgeSealedResult({
      jobId: source.jobId, sealedResultId: executed.value.sealedResultId, correlationId: CORRELATION
    });
    expect(read.ok).toBe(false);
    expect(purge.ok).toBe(false);
    expect(readdirSync(context.resultRoot).filter((name) => name.endsWith('.ocrsealed'))).toHaveLength(1);
  });

  it('rejects symlink or foreign hardlink substitution before decrypting', async () => {
    const context = setup();
    const source = addPngJob(context, 'job-0007');
    const executed = await context.runtime.runAndSeal(runInput(source));
    if (!executed.ok || executed.value.status !== 'completed') throw new Error('setup failed');
    context.authority.current.set(source.jobId, executed.value.sealedResultId);
    const target = join(context.resultRoot, `${executed.value.sealedResultId}.ocrsealed`);
    const foreign = join(context.directory, 'foreign-envelope.bin');
    writeFileSync(foreign, readFileSync(target));
    rmSync(target);
    try { symlinkSync(foreign, target, 'file'); }
    catch { linkSync(foreign, target); }
    const read = await context.runtime.readSealedResult({
      jobId: source.jobId, sealedResultId: executed.value.sealedResultId, correlationId: CORRELATION
    });
    expect(read.ok).toBe(false);
    expect(existsSync(target)).toBe(true);
  });

  it('cancels the exact active worker without leaking source bytes', async () => {
    const engine = new FakeEngine();
    engine.waitForAbort = true;
    const context = setup({ engine });
    const source = addPngJob(context, 'job-0008');
    const running = context.runtime.runAndSeal(runInput(source));
    await engine.started;
    const cancelled = await context.runtime.requestCancellation({ jobId: source.jobId, correlationId: CORRELATION });
    expect(cancelled).toEqual(ok({ accepted: true }));
    const outcome = await running;
    expect(outcome.ok && outcome.value).toEqual(expect.objectContaining({ status: 'cancelled', networkUsed: false, cloudUsed: false }));
    expect(context.archive.lastReturnedBytes?.every((byte) => byte === 0)).toBe(true);
    expect(readdirSync(context.resultRoot)).toEqual([]);
  });

  it('sweeps only old unreferenced exact-owner orphans after grace; current and foreign-owner files survive', async () => {
    let time = '2026-08-14T10:00:00.000Z';
    const context = setup({ now: () => time, orphanGraceMs: 5 * 60 * 1_000 });
    const orphan = addPngJob(context, 'job-0101');
    const referenced = addPngJob(context, 'job-0102');
    const foreign = addPngJob(context, 'job-0103');
    const outcomes = await Promise.all([
      context.runtime.runAndSeal(runInput(orphan)),
      context.runtime.runAndSeal(runInput(referenced)),
      context.runtime.runAndSeal(runInput(foreign))
    ]);
    // Worker concurrency is one, so run sequentially if the parallel capacity guard fired.
    for (let index = 0; index < outcomes.length; index += 1) {
      if (!outcomes[index]!.ok || outcomes[index]!.value.status !== 'completed') {
        outcomes[index] = await context.runtime.runAndSeal(runInput([orphan, referenced, foreign][index]!));
      }
    }
    const completed = outcomes.map((outcome) => {
      if (!outcome.ok || outcome.value.status !== 'completed') throw new Error('setup failed');
      return outcome.value;
    });
    context.authority.current.set(referenced.jobId, completed[1]!.sealedResultId);
    context.authority.foreignSweepJobs.add(foreign.jobId);
    time = '2026-08-14T10:10:01.000Z';
    const swept = await context.runtime.sweepOrphans({ correlationId: CORRELATION, maximumCandidates: 10 });
    expect(swept).toEqual(ok({ scanned: 3, deleted: 1, referenced: 1, rejected: 1,
      networkUsed: false, cloudUsed: false }));
    expect(context.vault.readIfPresent(runtimeBinding(orphan), completed[0]!.sealedResultId)).toBeNull();
    expect(context.vault.readIfPresent(runtimeBinding(referenced), completed[1]!.sealedResultId)).not.toBeNull();
    expect(context.vault.readIfPresent(runtimeBinding(foreign), completed[2]!.sealedResultId)).not.toBeNull();
  });

  it('repairs an owner-valid hard-link publication interrupted before temp cleanup', async () => {
    const context = setup();
    const source = addPngJob(context, 'job-0151');
    const executed = await context.runtime.runAndSeal(runInput(source));
    if (!executed.ok || executed.value.status !== 'completed') throw new Error('setup failed');
    const target = join(context.resultRoot, `${executed.value.sealedResultId}.ocrsealed`);
    const interruptedTemp = join(context.resultRoot, `.ocrsealed-999-${'a'.repeat(24)}.tmp`);
    linkSync(target, interruptedTemp);
    expect(statSync(target).nlink).toBe(2);
    const recovered = new LocalGovernedOcrResultVault({
      rootDirectory: context.resultRoot,
      protectedStore: context.protectedStore
    });
    expect(existsSync(interruptedTemp)).toBe(false);
    expect(statSync(target).nlink).toBe(1);
    expect(recovered.read(runtimeBinding(source), executed.value.sealedResultId).contentSha256)
      .toBe(executed.value.contentSha256);
  });

  it('deletes a stale loser correction branch but preserves every exact current-chain envelope', async () => {
    let time = '2026-08-14T10:00:00.000Z';
    const context = setup({ now: () => time, orphanGraceMs: 5 * 60 * 1_000 });
    const source = addPngJob(context, 'job-0161');
    const executed = await context.runtime.runAndSeal(runInput(source));
    if (!executed.ok || executed.value.status !== 'completed') throw new Error('setup failed');
    context.authority.current.set(source.jobId, executed.value.sealedResultId);
    const winner = await context.runtime.correctAndSeal({ jobId: source.jobId,
      previousSealedResultId: executed.value.sealedResultId, expectedInputSha256: source.inputSha256,
      correctedText: 'Kazanan düzeltme', correlationId: CORRELATION });
    const loser = await context.runtime.correctAndSeal({ jobId: source.jobId,
      previousSealedResultId: executed.value.sealedResultId, expectedInputSha256: source.inputSha256,
      correctedText: 'Kaybeden düzeltme', correlationId: CORRELATION });
    if (!winner.ok || !loser.ok) throw new Error('correction setup failed');
    context.authority.current.set(source.jobId, winner.value.sealedResultId);
    time = '2026-08-14T10:10:01.000Z';
    const swept = await context.runtime.sweepOrphans({ correlationId: CORRELATION, maximumCandidates: 10 });
    expect(swept).toEqual(ok({ scanned: 3, deleted: 1, referenced: 2, rejected: 0,
      networkUsed: false, cloudUsed: false }));
    const binding = runtimeBinding(source);
    expect(context.vault.readIfPresent(binding, loser.value.sealedResultId)).toBeNull();
    expect(context.vault.readIfPresent(binding, winner.value.sealedResultId)).not.toBeNull();
    expect(context.vault.readIfPresent(binding, executed.value.sealedResultId)).not.toBeNull();
  });

  it('advances a bounded sweep cursor so referenced prefixes cannot starve a later orphan', async () => {
    let time = '2026-08-14T10:00:00.000Z';
    const context = setup({ now: () => time, orphanGraceMs: 5 * 60 * 1_000 });
    const sources = ['job-0171', 'job-0172', 'job-0173', 'job-0174', 'job-0175']
      .map((jobId) => addPngJob(context, jobId));
    const completed = [];
    for (const source of sources) {
      const outcome = await context.runtime.runAndSeal(runInput(source));
      if (!outcome.ok || outcome.value.status !== 'completed') throw new Error('setup failed');
      completed.push(outcome.value);
    }
    for (let index = 0; index < 4; index += 1) {
      context.authority.current.set(sources[index]!.jobId, completed[index]!.sealedResultId);
    }
    const orphan = sources[4]!;
    const orphanResult = completed[4]!;
    time = '2026-08-14T10:10:01.000Z';
    let deleted = false;
    for (let pass = 0; pass < 6; pass += 1) {
      const swept = await context.runtime.sweepOrphans({ correlationId: CORRELATION, maximumCandidates: 1 });
      expect(swept.ok).toBe(true);
      if (context.vault.readIfPresent(runtimeBinding(orphan), orphanResult.sealedResultId) === null) {
        deleted = true;
        break;
      }
    }
    expect(deleted).toBe(true);
  });

  it('enforces an absolute result-file quota and never overwrites an existing envelope', async () => {
    const context = setup({ maximumFiles: 1 });
    const first = addPngJob(context, 'job-0201');
    const second = addPngJob(context, 'job-0202');
    const firstResult = await context.runtime.runAndSeal(runInput(first));
    const firstRaw = readFileSync(join(context.resultRoot, readdirSync(context.resultRoot)[0]!));
    const secondResult = await context.runtime.runAndSeal(runInput(second));
    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(false);
    expect(readdirSync(context.resultRoot).filter((name) => name.endsWith('.ocrsealed'))).toHaveLength(1);
    expect(readFileSync(join(context.resultRoot, readdirSync(context.resultRoot)[0]!))).toEqual(firstRaw);
  });

  it('does not log plaintext or source metadata on negative paths', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const context = setup();
    const source = addPngJob(context, 'job-0301');
    context.authority.denyJobs.add(source.jobId);
    const result = await context.runtime.runAndSeal(runInput(source));
    expect(result.ok).toBe(false);
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('production source has no user-path/input-file authority escape hatch', () => {
    const source = readFileSync(join(process.cwd(), 'apps/desktop/src/main/local-governed-ocr-runtime-adapter.ts'), 'utf8');
    expect(source).toContain('ReadArchiveFileBytesUseCase');
    expect(source).toContain("sourceAuthority: 'archive_vault_read_bytes_only'");
    expect(source).toContain('options.malwareScanner ?? new NotConfiguredLocalOcrMalwareVerdictAdapter()');
    expect(source).not.toContain('local-ocr-input-adapter');
    expect(source).not.toMatch(/sourcePath|readFileSync\s*\(\s*source/iu);
  });
});
