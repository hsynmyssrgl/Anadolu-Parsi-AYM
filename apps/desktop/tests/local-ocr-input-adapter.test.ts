import { createHash } from 'node:crypto';
import {
  linkSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LOCAL_OCR_MAX_INPUT_BYTES, LocalOcrSecurityError } from '@ppt/security';
import { LocalOcrInputFileAdapter } from '../src/main/local-ocr-input-adapter.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const directories: string[] = [];
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-33-q-ocr-input-'));
  directories.push(directory);
  writeFileSync(join(directory, 'receipt.png'), PNG);
  return { directory, adapter: new LocalOcrInputFileAdapter({ inputDirectory: directory }) };
};
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe('33-Q LocalOcrInputFileAdapter security primitive', () => {
  it('reads one regular single-link leaf with bounded TOCTOU checks and creates no temporary file', () => {
    const { directory, adapter } = fixture();
    const before = readdirSync(directory);
    const source = adapter.read({ sourceFileName: 'receipt.png', mediaType: 'image/png', expectedSha256: hash(PNG) });
    expect(source).toMatchObject({ fileName: 'receipt.png', mediaType: 'image/png', sha256: hash(PNG), sizeBytes: PNG.length });
    expect(source.bytes.equals(PNG)).toBe(true);
    expect(Object.keys(source)).not.toContain('path');
    expect(readdirSync(directory)).toEqual(before);
    source.bytes.fill(0);
  });

  it('rejects traversal, absolute, unknown and path-bearing requests with path-free errors', () => {
    const { directory, adapter } = fixture();
    for (const sourceFileName of ['../receipt.png', join(directory, 'receipt.png'), 'missing.png']) {
      try {
        adapter.read({ sourceFileName, mediaType: 'image/png', expectedSha256: hash(PNG) });
        throw new Error('expected input rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(LocalOcrSecurityError);
        expect((error as Error).message).not.toContain(directory);
        expect((error as LocalOcrSecurityError).code).toBe('INPUT_INVALID');
      }
    }
  });

  it('rejects symbolic links, hard links and sparse oversize files before reading bytes', () => {
    const { directory, adapter } = fixture();
    try {
      symlinkSync(join(directory, 'receipt.png'), join(directory, 'linked.png'), 'file');
      expect(() => adapter.read({ sourceFileName: 'linked.png', mediaType: 'image/png', expectedSha256: hash(PNG) }))
        .toThrowError(expect.objectContaining({ code: 'INPUT_INVALID' }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
      const targetDirectory = join(directory, 'target-directory');
      mkdirSync(targetDirectory);
      const junction = join(directory, 'directory-junction');
      symlinkSync(targetDirectory, junction, 'junction');
      expect(() => new LocalOcrInputFileAdapter({ inputDirectory: junction }))
        .toThrowError(expect.objectContaining({ code: 'INPUT_INVALID' }));
    }
    linkSync(join(directory, 'receipt.png'), join(directory, 'hard.png'));
    expect(() => adapter.read({ sourceFileName: 'receipt.png', mediaType: 'image/png', expectedSha256: hash(PNG) }))
      .toThrowError(expect.objectContaining({ code: 'INPUT_INVALID' }));
    const oversize = join(directory, 'oversize.png');
    writeFileSync(oversize, Buffer.alloc(1));
    truncateSync(oversize, LOCAL_OCR_MAX_INPUT_BYTES + 1);
    expect(() => adapter.read({ sourceFileName: 'oversize.png', mediaType: 'image/png', expectedSha256: '0'.repeat(64) }))
      .toThrowError(expect.objectContaining({ code: 'INPUT_TOO_LARGE' }));
  });
});
