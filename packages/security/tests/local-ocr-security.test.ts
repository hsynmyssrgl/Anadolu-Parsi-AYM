import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  LOCAL_OCR_MAX_INPUT_BYTES,
  LocalOcrSecurityError,
  bindLocalOcrPageInspection,
  inspectLocalOcrSource,
  validateLocalOcrResult,
  type BoundedLocalOcrSource,
  type LocalOcrResult
} from '../src/index.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const expectCode = (operation: () => unknown, code: string): void => {
  try {
    operation();
    throw new Error('expected LocalOcrSecurityError');
  } catch (error) {
    expect(error).toBeInstanceOf(LocalOcrSecurityError);
    expect((error as LocalOcrSecurityError).code).toBe(code);
  }
};
const pngSource = () => inspectLocalOcrSource({
  fileName: 'receipt.png',
  mediaType: 'image/png',
  bytes: PNG,
  expectedSha256: hash(PNG)
});
const boundedPng = (): BoundedLocalOcrSource => {
  const source = pngSource();
  return bindLocalOcrPageInspection(source, { inputSha256: source.sha256, pageCount: 1, encrypted: false });
};
const validResult = (source: BoundedLocalOcrSource): LocalOcrResult => ({
  schemaVersion: 1,
  engineId: 'deterministic-local-ocr-v1',
  inputSha256: source.sha256,
  mediaType: source.mediaType,
  pageCount: source.pageCount,
  text: 'Toplam 100,00 TL',
  confidence: { available: true, value: 0.96 },
  languages: [{ languageTag: 'tr', confidence: { available: false, value: null } }],
  layout: [{
    id: 'word-1',
    pageNumber: 1,
    kind: 'text',
    text: 'Toplam',
    boundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
    confidence: { available: true, value: 0.95 }
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
    durationMs: 7,
    memoryLimitMiB: 128,
    cpuTimeLimitMs: 1_000,
    timeLimitMs: 1_000,
    outputLimitBytes: 16_384
  }
});

describe('33-Q local OCR security contract', () => {
  it('binds image magic, digest and intrinsic dimensions without retaining a path', () => {
    const source = pngSource();
    expect(source).toMatchObject({
      schemaVersion: 1,
      fileName: 'receipt.png',
      mediaType: 'image/png',
      sha256: hash(PNG),
      sizeBytes: PNG.length,
      intrinsicPageCount: 1,
      pixelWidth: 1,
      pixelHeight: 1,
      containsActivePdfContent: false
    });
    expect(Object.keys(source)).not.toContain('path');
    expect(bindLocalOcrPageInspection(source, {
      inputSha256: source.sha256,
      pageCount: 1,
      encrypted: false
    }).pageCount).toBe(1);
  });

  it('rejects traversal-shaped names, MIME/extension/magic/hash drift and oversize inputs', () => {
    expectCode(() => inspectLocalOcrSource({
      fileName: '../receipt.png', mediaType: 'image/png', bytes: PNG, expectedSha256: hash(PNG)
    }), 'INPUT_INVALID');
    expectCode(() => inspectLocalOcrSource({
      fileName: 'receipt.jpg', mediaType: 'image/png', bytes: PNG, expectedSha256: hash(PNG)
    }), 'TYPE_MISMATCH');
    expectCode(() => inspectLocalOcrSource({
      fileName: 'receipt.png', mediaType: 'image/png', bytes: Buffer.from('%PDF-1.7\n%%EOF\n'),
      expectedSha256: hash(Buffer.from('%PDF-1.7\n%%EOF\n'))
    }), 'TYPE_MISMATCH');
    expectCode(() => inspectLocalOcrSource({
      fileName: 'receipt.png', mediaType: 'image/png', bytes: PNG, expectedSha256: '0'.repeat(64)
    }), 'HASH_MISMATCH');
    const oversize = new Uint8Array(LOCAL_OCR_MAX_INPUT_BYTES + 1);
    expectCode(() => inspectLocalOcrSource({
      fileName: 'receipt.png', mediaType: 'image/png', bytes: oversize, expectedSha256: '0'.repeat(64)
    }), 'INPUT_TOO_LARGE');
  });

  it('keeps PDF page discovery delegated and fails closed on active/encrypted or excessive pages', () => {
    const pdf = Buffer.from('%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n', 'latin1');
    const source = inspectLocalOcrSource({
      fileName: 'statement.pdf', mediaType: 'application/pdf', bytes: pdf, expectedSha256: hash(pdf)
    });
    expect(source.intrinsicPageCount).toBeNull();
    expect(bindLocalOcrPageInspection(source, {
      inputSha256: source.sha256, pageCount: 50, encrypted: false
    }).pageCount).toBe(50);
    expectCode(() => bindLocalOcrPageInspection(source, {
      inputSha256: source.sha256, pageCount: 51, encrypted: false
    }), 'PAGE_LIMIT_EXCEEDED');
    expectCode(() => bindLocalOcrPageInspection(source, {
      inputSha256: source.sha256, pageCount: 1, encrypted: true
    }), 'INPUT_INVALID');
    for (const marker of ['/OpenAction 2 0 R', '/JavaScript 2 0 R', '/Encrypt 2 0 R']) {
      const unsafe = Buffer.from(`%PDF-1.7\n1 0 obj<<${marker}>>endobj\n%%EOF\n`, 'latin1');
      expectCode(() => inspectLocalOcrSource({
        fileName: 'unsafe.pdf', mediaType: 'application/pdf', bytes: unsafe, expectedSha256: hash(unsafe)
      }), 'INPUT_INVALID');
    }
  });

  it('accepts bounded confidence/language/layout metadata but never invents unavailable confidence', () => {
    const source = boundedPng();
    const validated = validateLocalOcrResult(validResult(source), source, {
      memoryLimitMiB: 128, timeLimitMs: 1_000, outputLimitBytes: 16_384
    });
    expect(validated).toMatchObject({ text: 'Toplam 100,00 TL', languages: [{ languageTag: 'tr' }] });
    expect(Object.isFrozen(validated) && Object.isFrozen(validated.execution) && Object.isFrozen(validated.layout)).toBe(true);
    const unavailable = validResult(source) as unknown as { confidence: { available: boolean; value: number | null } };
    unavailable.confidence = { available: false, value: 0.5 };
    expectCode(() => validateLocalOcrResult(unavailable, source, {
      memoryLimitMiB: 128, timeLimitMs: 1_000, outputLimitBytes: 16_384
    }), 'ENGINE_FAILURE');
  });

  it('rejects network/cloud, page, quota and output attestations that do not exactly bind the request', () => {
    const source = boundedPng();
    for (const [mutate, code] of [
      [(value: Record<string, unknown>) => { (value.execution as Record<string, unknown>).networkUsed = true; }, 'MEMORY_LIMIT_UNATTESTED'],
      [(value: Record<string, unknown>) => { (value.execution as Record<string, unknown>).memoryLimitMiB = 129; }, 'MEMORY_LIMIT_UNATTESTED'],
      [(value: Record<string, unknown>) => { value.pageCount = 2; }, 'ENGINE_FAILURE'],
      [(value: Record<string, unknown>) => { value.inputSha256 = 'f'.repeat(64); }, 'ENGINE_FAILURE']
    ] as const) {
      const value = structuredClone(validResult(source)) as unknown as Record<string, unknown>;
      mutate(value);
      expectCode(() => validateLocalOcrResult(value, source, {
        memoryLimitMiB: 128, timeLimitMs: 1_000, outputLimitBytes: 16_384
      }), code);
    }
    const large = structuredClone(validResult(source)) as unknown as { text: string };
    large.text = 'x'.repeat(20_000);
    (large as unknown as { execution: { outputLimitBytes: number } }).execution.outputLimitBytes = 4_096;
    expectCode(() => validateLocalOcrResult(large, source, {
      memoryLimitMiB: 128, timeLimitMs: 1_000, outputLimitBytes: 4_096
    }), 'OUTPUT_LIMIT_EXCEEDED');
  });
});
