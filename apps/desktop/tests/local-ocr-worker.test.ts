import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  LocalOcrSecurityError,
  inspectLocalOcrSource,
  type BoundedLocalOcrSource,
  type InspectedLocalOcrSource,
  type LocalOcrResult
} from '@ppt/security';
import {
  NotConfiguredLocalOcrEngineAdapter,
  type LocalOcrEngineDescriptor,
  type LocalOcrEnginePort,
  type LocalOcrWorkerQuotas
} from '../src/main/local-ocr-engine-adapter.js';
import {
  BoundedLocalOcrWorker,
  NotConfiguredLocalOcrMalwareVerdictAdapter,
  type LocalOcrMalwareScanRequest,
  type LocalOcrMalwareScanResult,
  type LocalOcrMalwareScannerDescriptor,
  type LocalOcrMalwareVerdict,
  type LocalOcrMalwareVerdictPort
} from '../src/main/local-ocr-worker.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const source = (name = 'receipt.png'): InspectedLocalOcrSource => inspectLocalOcrSource({
  fileName: name,
  mediaType: 'image/png',
  bytes: PNG,
  expectedSha256: hash(PNG)
});
const descriptor = (): LocalOcrEngineDescriptor => Object.freeze({
  configured: true,
  engineId: 'deterministic-fake-ocr-v1',
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
  supportedMediaTypes: Object.freeze(['image/png']),
  confidenceAvailable: false
});
const result = (value: BoundedLocalOcrSource, quotas: LocalOcrWorkerQuotas): LocalOcrResult => ({
  schemaVersion: 1,
  engineId: 'deterministic-fake-ocr-v1',
  inputSha256: value.sha256,
  mediaType: value.mediaType,
  pageCount: value.pageCount,
  text: 'Birikim 20.000 TL',
  confidence: { available: false, value: null },
  languages: [{ languageTag: 'tr', confidence: { available: false, value: null } }],
  layout: [{
    id: 'word-1', pageNumber: 1, kind: 'text', text: 'Birikim',
    boundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
    confidence: { available: false, value: null }
  }],
  execution: {
    localOnly: true,
    networkUsed: false,
    cloudUsed: false,
    processSeparated: true,
    lowPrivilegeSandboxVerified: false,
    memoryLimitEnforced: true,
    cpuTimeLimitEnforced: true,
    timeLimitEnforced: true,
    outputLimitEnforced: true,
    durationMs: 1,
    memoryLimitMiB: quotas.memoryLimitMiB,
    cpuTimeLimitMs: quotas.timeoutMs,
    timeLimitMs: quotas.timeoutMs,
    outputLimitBytes: quotas.outputLimitBytes
  }
});

class FakeEngine implements LocalOcrEnginePort {
  public inspectCalls = 0;
  public recognizeCalls = 0;
  public mutateNetworkAttestation = false;
  public driftEngineId = false;
  public fabricateConfidence = false;
  public waitForAbort = false;
  public descriptor(): LocalOcrEngineDescriptor { return descriptor(); }
  public async inspect(value: InspectedLocalOcrSource, signal: AbortSignal) {
    this.inspectCalls += 1;
    if (signal.aborted) throw new LocalOcrSecurityError('CANCELLED');
    return Object.freeze({ inputSha256: value.sha256, pageCount: 1, encrypted: false });
  }
  public async recognize(value: BoundedLocalOcrSource, quotas: LocalOcrWorkerQuotas, signal: AbortSignal): Promise<unknown> {
    this.recognizeCalls += 1;
    if (this.waitForAbort) {
      await new Promise<never>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new LocalOcrSecurityError('CANCELLED')), { once: true });
        if (signal.aborted) reject(new LocalOcrSecurityError('CANCELLED'));
      });
    }
    const output = structuredClone(result(value, quotas)) as unknown as Record<string, unknown>;
    if (this.mutateNetworkAttestation) (output.execution as Record<string, unknown>).networkUsed = true;
    if (this.driftEngineId) output.engineId = 'unbound-engine-v1';
    if (this.fabricateConfidence) output.confidence = { available: true, value: 0.9 };
    return output;
  }
}

class FakeScanner implements LocalOcrMalwareVerdictPort {
  public calls = 0;
  public verdict: LocalOcrMalwareVerdict = 'clean';
  public mutateInput = false;
  public descriptor(): LocalOcrMalwareScannerDescriptor {
    return Object.freeze({
      configured: true,
      scannerId: 'deterministic-local-malware-v1',
      localOnly: true,
      networkAccess: false,
      cloudProcessing: false
    });
  }
  public async scan(request: LocalOcrMalwareScanRequest, signal: AbortSignal): Promise<LocalOcrMalwareScanResult> {
    this.calls += 1;
    if (signal.aborted) throw new LocalOcrSecurityError('CANCELLED');
    if (this.mutateInput) request.bytes[0] = request.bytes[0]! ^ 1;
    return Object.freeze({
      schemaVersion: 1,
      scannerId: 'deterministic-local-malware-v1',
      inputSha256: request.inputSha256,
      sizeBytes: request.sizeBytes,
      verdict: this.verdict,
      localOnly: true,
      networkUsed: false,
      cloudUsed: false
    });
  }
}

describe('33-Q BoundedLocalOcrWorker', () => {
  it('rejects worker quotas outside the fixed CPU/wall, RAM and output envelope', () => {
    for (const options of [
      { timeoutMs: 99, memoryLimitMiB: 128, outputLimitBytes: 4_096 },
      { timeoutMs: 30_001, memoryLimitMiB: 128, outputLimitBytes: 4_096 },
      { timeoutMs: 1_000, memoryLimitMiB: 127, outputLimitBytes: 4_096 },
      { timeoutMs: 1_000, memoryLimitMiB: 385, outputLimitBytes: 4_096 },
      { timeoutMs: 1_000, memoryLimitMiB: 128, outputLimitBytes: 4_095 },
      { timeoutMs: 1_000, memoryLimitMiB: 128, outputLimitBytes: 1_048_577 }
    ]) {
      expect(() => new BoundedLocalOcrWorker(new FakeEngine(), new FakeScanner(), options))
        .toThrowError(expect.objectContaining({ code: 'INPUT_INVALID' }));
    }
  });

  it('requires a clean local verdict, binds every stage to one digest and returns deterministic metadata', async () => {
    const engine = new FakeEngine();
    const scanner = new FakeScanner();
    const worker = new BoundedLocalOcrWorker(engine, scanner, {
      timeoutMs: 1_000, memoryLimitMiB: 128, outputLimitBytes: 16_384
    });
    const input = source();
    const output = await worker.run(input);
    expect(output).toMatchObject({
      engineId: 'deterministic-fake-ocr-v1',
      inputSha256: hash(PNG),
      text: 'Birikim 20.000 TL',
      confidence: { available: false, value: null },
      languages: [{ languageTag: 'tr' }],
      execution: {
        localOnly: true,
        networkUsed: false,
        cloudUsed: false,
        processSeparated: true,
        lowPrivilegeSandboxVerified: false,
        memoryLimitEnforced: true,
        cpuTimeLimitEnforced: true,
        timeLimitEnforced: true,
        outputLimitEnforced: true
      }
    });
    expect({ scannerCalls: scanner.calls, inspectCalls: engine.inspectCalls, recognizeCalls: engine.recognizeCalls })
      .toEqual({ scannerCalls: 1, inspectCalls: 1, recognizeCalls: 1 });
    expect(input.bytes.every((byte) => byte === 0)).toBe(true);
  });

  it('fails closed when the OCR engine or malware scanner is not configured', async () => {
    await expect(new BoundedLocalOcrWorker(new NotConfiguredLocalOcrEngineAdapter(), new FakeScanner()).run(source()))
      .rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    await expect(new BoundedLocalOcrWorker(new FakeEngine(), new NotConfiguredLocalOcrMalwareVerdictAdapter()).run(source()))
      .rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });

  it.each(['malicious', 'unknown', 'scanner-error'] as const)(
    'rejects the %s malware verdict before inspecting or recognizing',
    async (verdict) => {
      const engine = new FakeEngine();
      const scanner = new FakeScanner();
      scanner.verdict = verdict;
      await expect(new BoundedLocalOcrWorker(engine, scanner).run(source()))
        .rejects.toMatchObject({ code: 'MALWARE_NOT_CLEAN' });
      expect({ inspect: engine.inspectCalls, recognize: engine.recognizeCalls }).toEqual({ inspect: 0, recognize: 0 });
    }
  );

  it('detects scanner byte mutation and fabricated network attestations', async () => {
    const mutatingScanner = new FakeScanner();
    mutatingScanner.mutateInput = true;
    await expect(new BoundedLocalOcrWorker(new FakeEngine(), mutatingScanner).run(source()))
      .rejects.toMatchObject({ code: 'HASH_MISMATCH' });
    const engine = new FakeEngine();
    engine.mutateNetworkAttestation = true;
    await expect(new BoundedLocalOcrWorker(engine, new FakeScanner()).run(source()))
      .rejects.toMatchObject({ code: 'MEMORY_LIMIT_UNATTESTED' });
  });

  it('binds the result to the admitted engine and rejects confidence the provider says is unavailable', async () => {
    const drifted = new FakeEngine();
    drifted.driftEngineId = true;
    await expect(new BoundedLocalOcrWorker(drifted, new FakeScanner()).run(source()))
      .rejects.toMatchObject({ code: 'ENGINE_FAILURE' });
    const fabricated = new FakeEngine();
    fabricated.fabricateConfidence = true;
    await expect(new BoundedLocalOcrWorker(fabricated, new FakeScanner()).run(source()))
      .rejects.toMatchObject({ code: 'ENGINE_FAILURE' });
  });

  it('propagates cancellation and enforces an overall deadline even when the provider waits', async () => {
    const cancelled = new AbortController();
    cancelled.abort();
    const scanner = new FakeScanner();
    await expect(new BoundedLocalOcrWorker(new FakeEngine(), scanner).run(source(), cancelled.signal))
      .rejects.toMatchObject({ code: 'CANCELLED' });
    expect(scanner.calls).toBe(0);

    const engine = new FakeEngine();
    engine.waitForAbort = true;
    const worker = new BoundedLocalOcrWorker(engine, new FakeScanner(), {
      timeoutMs: 100, memoryLimitMiB: 128, outputLimitBytes: 4_096
    });
    await expect(worker.run(source())).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('caps concurrent jobs at one so parallel callers cannot multiply the memory quota', async () => {
    let release: (() => void) | undefined;
    let started = false;
    const engine = new FakeEngine();
    engine.recognize = async (value, quotas) => {
      started = true;
      await new Promise<void>((resolve) => { release = resolve; });
      return result(value, quotas);
    };
    const worker = new BoundedLocalOcrWorker(engine, new FakeScanner(), {
      timeoutMs: 1_000, memoryLimitMiB: 128, outputLimitBytes: 16_384
    });
    const first = worker.run(source('first.png'));
    await vi.waitFor(() => expect(started).toBe(true));
    await expect(worker.run(source('second.png'))).rejects.toMatchObject({ code: 'CAPACITY_EXCEEDED' });
    release?.();
    await expect(first).resolves.toMatchObject({ text: 'Birikim 20.000 TL' });
  });
});
