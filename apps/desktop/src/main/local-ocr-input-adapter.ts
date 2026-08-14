import { constants, closeSync, fstatSync, lstatSync, openSync, readSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  LOCAL_OCR_MAX_INPUT_BYTES,
  LocalOcrSecurityError,
  inspectLocalOcrSource,
  type InspectedLocalOcrSource,
  type LocalOcrMediaType
} from '@ppt/security';

export interface LocalOcrInputFileAdapterOptions {
  readonly inputDirectory: string;
}

export interface ReadLocalOcrInputFileRequest {
  readonly sourceFileName: string;
  readonly mediaType: LocalOcrMediaType;
  readonly expectedSha256: string;
}

const samePath = (left: string, right: string): boolean => process.platform === 'win32'
  ? left.toLocaleLowerCase('en-US') === right.toLocaleLowerCase('en-US')
  : left === right;
const leafName = (value: unknown): value is string => typeof value === 'string'
  && value === value.trim() && value.length >= 3 && value.length <= 128
  && value !== '.' && value !== '..' && !/[\\/:\u0000-\u001f\u007f]/u.test(value)
  && !value.startsWith('.') && !value.endsWith('.') && !value.endsWith(' ');

/**
 * Security-test/reference reader for one already-authorized directory.
 * Production composition must use the governed archive-vault readBytes authority instead.
 * This adapter creates no temporary file and never returns or logs the canonical path.
 */
export class LocalOcrInputFileAdapter {
  readonly #directory: string;

  public constructor(options: LocalOcrInputFileAdapterOptions) {
    if (!options || typeof options !== 'object' || typeof options.inputDirectory !== 'string') {
      throw new LocalOcrSecurityError('INPUT_INVALID');
    }
    try {
      const requested = resolve(options.inputDirectory);
      const stat = lstatSync(requested);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new LocalOcrSecurityError('INPUT_INVALID');
      const canonical = realpathSync(requested);
      if (!samePath(requested, canonical)) throw new LocalOcrSecurityError('INPUT_INVALID');
      this.#directory = canonical;
    } catch (error) {
      if (error instanceof LocalOcrSecurityError) throw error;
      throw new LocalOcrSecurityError('INPUT_INVALID');
    }
  }

  public read(request: ReadLocalOcrInputFileRequest): InspectedLocalOcrSource {
    if (!request || typeof request !== 'object' || Object.keys(request).sort().join('|') !== 'expectedSha256|mediaType|sourceFileName'
      || !leafName(request.sourceFileName)) throw new LocalOcrSecurityError('INPUT_INVALID');
    try {
      return this.#readValidated(request);
    } catch (error) {
      if (error instanceof LocalOcrSecurityError) throw error;
      throw new LocalOcrSecurityError('INPUT_INVALID');
    }
  }

  #readValidated(request: ReadLocalOcrInputFileRequest): InspectedLocalOcrSource {
    const path = resolve(this.#directory, request.sourceFileName);
    if (!samePath(dirname(path), this.#directory)) throw new LocalOcrSecurityError('INPUT_INVALID');
    const before = lstatSync(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size < 12) {
      throw new LocalOcrSecurityError('INPUT_INVALID');
    }
    if (before.size > LOCAL_OCR_MAX_INPUT_BYTES) throw new LocalOcrSecurityError('INPUT_TOO_LARGE');
    const noFollow = 'O_NOFOLLOW' in constants ? Number(constants.O_NOFOLLOW) : 0;
    const descriptor = openSync(path, constants.O_RDONLY | noFollow);
    let bytes: Buffer | undefined;
    try {
      const opened = fstatSync(descriptor);
      if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size) {
        throw new LocalOcrSecurityError('INPUT_INVALID');
      }
      bytes = Buffer.allocUnsafe(opened.size);
      let offset = 0;
      while (offset < bytes.length) {
        const read = readSync(descriptor, bytes, offset, bytes.length - offset, null);
        if (read === 0) throw new LocalOcrSecurityError('INPUT_INVALID');
        offset += read;
      }
      const extra = Buffer.allocUnsafe(1);
      try { if (readSync(descriptor, extra, 0, 1, null) !== 0) throw new LocalOcrSecurityError('INPUT_INVALID'); }
      finally { extra.fill(0); }
      const after = fstatSync(descriptor);
      if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs) {
        throw new LocalOcrSecurityError('INPUT_INVALID');
      }
      const inspected = inspectLocalOcrSource({
        fileName: request.sourceFileName,
        mediaType: request.mediaType,
        bytes,
        expectedSha256: request.expectedSha256
      });
      bytes.fill(0);
      bytes = undefined;
      return inspected;
    } catch (error) {
      bytes?.fill(0);
      throw error;
    } finally {
      closeSync(descriptor);
    }
  }
}
