import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  LOCAL_OCR_MAX_INPUT_BYTES,
  LocalOcrSecurityError,
  inspectLocalOcrSource,
  type BoundedLocalOcrSource,
  type InspectedLocalOcrSource,
  type LocalOcrResult
} from '@ppt/security';
import {
  BoundedLocalOcrWorker,
  NotConfiguredLocalOcrMalwareVerdictAdapter,
  type LocalOcrMalwareScanRequest,
  type LocalOcrMalwareScanResult,
  type LocalOcrMalwareScannerDescriptor,
  type LocalOcrMalwareVerdict,
  type LocalOcrMalwareVerdictPort
} from '../src/main/local-ocr-worker.js';
import type {
  LocalOcrEngineDescriptor,
  LocalOcrEnginePort,
  LocalOcrWorkerQuotas
} from '../src/main/local-ocr-engine-adapter.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const SHA256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const expectSecurityCode = (operation: () => unknown, code: string): void => {
  try {
    operation();
    throw new Error('expected LocalOcrSecurityError');
  } catch (error) {
    expect(error).toBeInstanceOf(LocalOcrSecurityError);
    expect((error as LocalOcrSecurityError).code).toBe(code);
  }
};

const inspect = (fileName: string, mediaType: 'image/png' | 'image/jpeg' | 'application/pdf', bytes: Buffer) =>
  inspectLocalOcrSource({ fileName, mediaType, bytes, expectedSha256: SHA256(bytes) });

class NeverReachedEngine implements LocalOcrEnginePort {
  public inspectCalls = 0;
  public recognizeCalls = 0;

  public descriptor(): LocalOcrEngineDescriptor {
    return Object.freeze({
      configured: true,
      engineId: 'malicious-matrix-never-reached-v1',
      provider: 'windows_media_ocr',
      executionBoundary: 'bounded-child-process',
      localOnly: true,
      inputTransferredByPath: false,
      temporaryPlaintextCreated: false,
      processSeparated: true,
      lowPrivilegeSandboxVerified: false,
      networkAccess: false,
      cloudProcessing: false,
      resourceLimitsEnforcedPerJob: true,
      supportedMediaTypes: Object.freeze(['image/png', 'image/jpeg']),
      confidenceAvailable: false
    });
  }

  public async inspect(source: InspectedLocalOcrSource) {
    this.inspectCalls += 1;
    return Object.freeze({ inputSha256: source.sha256, pageCount: 1, encrypted: false });
  }

  public async recognize(
    _source: BoundedLocalOcrSource,
    _quotas: LocalOcrWorkerQuotas,
    _signal: AbortSignal
  ): Promise<LocalOcrResult> {
    this.recognizeCalls += 1;
    throw new Error('recognize must not be reached');
  }
}

class VerdictScanner implements LocalOcrMalwareVerdictPort {
  public constructor(private readonly verdict: LocalOcrMalwareVerdict) {}

  public descriptor(): LocalOcrMalwareScannerDescriptor {
    return Object.freeze({
      configured: true,
      scannerId: 'malicious-document-matrix-v1',
      localOnly: true,
      networkAccess: false,
      cloudProcessing: false
    });
  }

  public async scan(request: LocalOcrMalwareScanRequest): Promise<LocalOcrMalwareScanResult> {
    return Object.freeze({
      schemaVersion: 1,
      scannerId: 'malicious-document-matrix-v1',
      inputSha256: request.inputSha256,
      sizeBytes: request.sizeBytes,
      verdict: this.verdict,
      localOnly: true,
      networkUsed: false,
      cloudUsed: false
    });
  }
}

describe('33-Q malicious document fail-closed matrix', () => {
  it('rejects truncated, CRC-corrupted and ZIP-polyglot PNG payloads before any worker starts', () => {
    const truncated = Buffer.from(PNG.subarray(0, 33));
    expectSecurityCode(() => inspect('truncated.png', 'image/png', truncated), 'TYPE_MISMATCH');

    const corruptCrc = Buffer.from(PNG);
    corruptCrc[29] = corruptCrc[29]! ^ 0xff;
    expectSecurityCode(() => inspect('corrupt-crc.png', 'image/png', corruptCrc), 'TYPE_MISMATCH');

    const polyglot = Buffer.concat([PNG, Buffer.from('PK\x03\x04embedded-archive', 'binary')]);
    expectSecurityCode(() => inspect('polyglot.png', 'image/png', polyglot), 'TYPE_MISMATCH');
  });

  it('rejects image dimension bombs and the exact 16 MiB boundary overflow', () => {
    const dimensionBomb = Buffer.from(PNG);
    dimensionBomb.writeUInt32BE(10_000, 16);
    dimensionBomb.writeUInt32BE(10_000, 20);
    expectSecurityCode(() => inspect('dimension-bomb.png', 'image/png', dimensionBomb), 'INPUT_INVALID');

    const oversize = Buffer.alloc(LOCAL_OCR_MAX_INPUT_BYTES + 1, 0);
    expectSecurityCode(() => inspectLocalOcrSource({
      fileName: 'oversize.png', mediaType: 'image/png', bytes: oversize, expectedSha256: SHA256(oversize)
    }), 'INPUT_TOO_LARGE');
    oversize.fill(0);
  });

  it.each([
    '/JavaScript 2 0 R',
    '/Java#53cript 2 0 R',
    '/Launch 2 0 R',
    '/EmbeddedFile 2 0 R',
    '/RichMedia 2 0 R',
    '/OpenAction 2 0 R',
    '/AA 2 0 R',
    '/Encrypt 2 0 R'
  ])('rejects active, embedded or encrypted PDF dictionaries: %s', (marker) => {
    const pdf = Buffer.from(`%PDF-1.7\n1 0 obj<<${marker}>>endobj\n%%EOF\n`, 'latin1');
    expectSecurityCode(() => inspect('unsafe.pdf', 'application/pdf', pdf), 'INPUT_INVALID');
  });

  it('rejects ZIP masquerading, trailing PDF polyglots and MIME-extension drift', () => {
    const zip = Buffer.from('PK\x03\x04not-an-image-or-pdf', 'binary');
    expectSecurityCode(() => inspect('archive.png', 'image/png', zip), 'TYPE_MISMATCH');
    expectSecurityCode(() => inspect('archive.pdf', 'application/pdf', zip), 'TYPE_MISMATCH');

    const trailingPdf = Buffer.from('%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\nPK\x03\x04', 'binary');
    expectSecurityCode(() => inspect('trailing.pdf', 'application/pdf', trailingPdf), 'TYPE_MISMATCH');
    expectSecurityCode(() => inspect('renamed.jpg', 'image/png', PNG), 'TYPE_MISMATCH');
  });

  it.each(['malicious', 'unknown', 'scanner-error'] as const)(
    'stops the worker before page inspection when the scanner returns %s',
    async (verdict) => {
      const engine = new NeverReachedEngine();
      const source = inspect('receipt.png', 'image/png', PNG);
      await expect(new BoundedLocalOcrWorker(engine, new VerdictScanner(verdict)).run(source))
        .rejects.toMatchObject({ code: 'MALWARE_NOT_CLEAN' });
      expect({ inspect: engine.inspectCalls, recognize: engine.recognizeCalls }).toEqual({ inspect: 0, recognize: 0 });
    }
  );

  it('keeps production admission fail-closed when no malware provider is configured', async () => {
    const engine = new NeverReachedEngine();
    const source = inspect('receipt.png', 'image/png', PNG);
    await expect(new BoundedLocalOcrWorker(engine, new NotConfiguredLocalOcrMalwareVerdictAdapter()).run(source))
      .rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    expect({ inspect: engine.inspectCalls, recognize: engine.recognizeCalls }).toEqual({ inspect: 0, recognize: 0 });
  });
});
