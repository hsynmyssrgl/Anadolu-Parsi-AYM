import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  bindLocalOcrPageInspection,
  inspectLocalOcrSource,
  validateLocalOcrResult
} from '@ppt/security';
import { WindowsMediaOcrEngineAdapter } from '../src/main/windows-media-ocr-engine-adapter.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKAP/2Q==',
  'base64'
);
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

describe('33-Q WindowsMediaOcrEngineAdapter real local provider', () => {
  it('pins the fixed stdin/in-memory script against network, path, plaintext-file and diagnostic leakage primitives', () => {
    const adapterSource = readFileSync(new URL('../src/main/windows-media-ocr-engine-adapter.ts', import.meta.url), 'utf8');
    expect(adapterSource).toContain('[Console]::OpenStandardInput()');
    expect(adapterSource).toContain('InMemoryRandomAccessStream');
    expect(adapterSource).toContain("[Console]::Error.WriteLine('OCR_ENGINE_FAILURE')");
    expect(adapterSource).not.toMatch(/Invoke-WebRequest|Invoke-RestMethod|System\.Net|WebClient|Start-BitsTransfer|HttpClient/iu);
    expect(adapterSource).not.toMatch(/WriteAll(?:Bytes|Text)|FileStream|Set-Content|Out-File|Add-Content/iu);
    expect(adapterSource).not.toMatch(/HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY/iu);
  });

  it('reports process separation and per-job quotas without claiming a low-privilege sandbox', () => {
    const descriptor = new WindowsMediaOcrEngineAdapter().descriptor();
    expect(descriptor).toMatchObject({
      configured: process.platform === 'win32',
      localOnly: true,
      networkAccess: false,
      cloudProcessing: false,
      inputTransferredByPath: false,
      temporaryPlaintextCreated: false,
      processSeparated: process.platform === 'win32',
      lowPrivilegeSandboxVerified: false,
      resourceLimitsEnforcedPerJob: process.platform === 'win32',
      confidenceAvailable: false
    });
  });

  it('fails closed for PDF because no reviewed local rasterizer/page probe is configured', async () => {
    const pdf = Buffer.from('%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n', 'latin1');
    const source = inspectLocalOcrSource({
      fileName: 'statement.pdf', mediaType: 'application/pdf', bytes: pdf, expectedSha256: hash(pdf)
    });
    const controller = new AbortController();
    await expect(new WindowsMediaOcrEngineAdapter().inspect(source, controller.signal))
      .rejects.toMatchObject({ code: process.platform === 'win32' ? 'UNSUPPORTED_MEDIA' : 'NOT_CONFIGURED' });
    source.bytes.fill(0);
  });

  it.runIf(process.platform === 'win32')(
    'executes an actual in-memory Windows.Media.Ocr smoke with no path or plaintext temp file',
    async () => {
      const quotas = { timeoutMs: 30_000, memoryLimitMiB: 384, outputLimitBytes: 65_536 } as const;
      for (const sample of [
        { fileName: 'one-pixel.png', mediaType: 'image/png', bytes: PNG },
        { fileName: 'one-pixel.jpg', mediaType: 'image/jpeg', bytes: JPEG }
      ] as const) {
        const source = inspectLocalOcrSource({ ...sample, expectedSha256: hash(sample.bytes) });
        const adapter = new WindowsMediaOcrEngineAdapter();
        const controller = new AbortController();
        const inspection = await adapter.inspect(source, controller.signal);
        const bounded = bindLocalOcrPageInspection(source, inspection);
        try {
          const raw = await adapter.recognize(bounded, quotas, controller.signal);
          const result = validateLocalOcrResult(raw, bounded, {
            memoryLimitMiB: quotas.memoryLimitMiB,
            timeLimitMs: quotas.timeoutMs,
            outputLimitBytes: quotas.outputLimitBytes
          });
          expect(result).toMatchObject({
            engineId: 'windows-media-ocr-v1',
            inputSha256: hash(sample.bytes),
            mediaType: sample.mediaType,
            pageCount: 1,
            confidence: { available: false, value: null },
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
              memoryLimitMiB: 384,
              cpuTimeLimitMs: 30_000,
              timeLimitMs: 30_000,
              outputLimitBytes: 65_536
            }
          });
          expect(result.languages[0]?.languageTag).toMatch(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u);
        } finally {
          source.bytes.fill(0);
        }
      }
    },
    45_000
  );

  it.runIf(process.platform === 'win32')('does not spawn when cancellation is already active', async () => {
    const source = inspectLocalOcrSource({
      fileName: 'one-pixel.png', mediaType: 'image/png', bytes: PNG, expectedSha256: hash(PNG)
    });
    const bounded = bindLocalOcrPageInspection(source, { inputSha256: source.sha256, pageCount: 1, encrypted: false });
    const controller = new AbortController();
    controller.abort();
    await expect(new WindowsMediaOcrEngineAdapter().recognize(
      bounded,
      { timeoutMs: 30_000, memoryLimitMiB: 384, outputLimitBytes: 65_536 },
      controller.signal
    )).rejects.toMatchObject({ code: 'CANCELLED' });
    source.bytes.fill(0);
  });

  it.runIf(process.platform === 'win32')('terminates an active bounded child when cancellation arrives', async () => {
    const source = inspectLocalOcrSource({
      fileName: 'cancelled-pixel.png', mediaType: 'image/png', bytes: PNG, expectedSha256: hash(PNG)
    });
    const bounded = bindLocalOcrPageInspection(source, { inputSha256: source.sha256, pageCount: 1, encrypted: false });
    const controller = new AbortController();
    const operation = new WindowsMediaOcrEngineAdapter().recognize(
      bounded,
      { timeoutMs: 30_000, memoryLimitMiB: 384, outputLimitBytes: 65_536 },
      controller.signal
    );
    setTimeout(() => controller.abort(), 25).unref();
    await expect(operation).rejects.toMatchObject({ code: 'CANCELLED' });
    source.bytes.fill(0);
  });
});
