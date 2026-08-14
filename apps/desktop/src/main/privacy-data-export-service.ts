import { createHash, randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { access, link, lstat, open, readFile, realpath, unlink } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, resolve } from 'node:path';
import {
  encryptPrivacyDataExport,
  verifyPrivacyDataExportReadback,
  type PrivacyDataExportMetadata,
  type PrivacyDataExportReadbackResult
} from '@ppt/security';

export interface PrivacyDataExportFileInput {
  readonly value: unknown;
  readonly metadata: PrivacyDataExportMetadata;
  readonly passphrase: string;
  readonly destination: string;
  /** Runs only after decrypting readback; rejection removes the new file. */
  readonly onVerified?: (result: PrivacyDataExportReadbackResult) => void | Promise<void>;
}

export interface PrivacyDataExportFileResult {
  readonly fileName: string;
  readonly artifactSha256: string;
  readonly artifactSizeBytes: number;
  readonly createdAt: string;
  readonly delivery: 'not_performed';
}

const exactKeys = (value: object, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
};
const sha256Hex = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException)?.code === 'ENOENT';
const samePath = (left: string, right: string): boolean => process.platform === 'win32'
  ? left.toLocaleLowerCase('en-US') === right.toLocaleLowerCase('en-US')
  : left === right;

const assertAbsent = async (path: string): Promise<void> => {
  try { await lstat(path); throw new Error('Gizlilik dışa aktarım hedefi zaten var; üzerine yazma yasaktır.'); }
  catch (error) { if (!missing(error)) throw error; }
};

const removeIfPresent = async (path: string): Promise<void> => {
  try { await unlink(path); } catch (error) { if (!missing(error)) throw error; }
};

/**
 * Publishes one local encrypted artifact. It performs no network delivery and
 * deliberately returns no absolute path or recipient claim to the renderer.
 */
export async function writePrivacyDataExportFile(input: PrivacyDataExportFileInput): Promise<PrivacyDataExportFileResult> {
  if (!input || typeof input !== 'object'
    || (!exactKeys(input, ['value', 'metadata', 'passphrase', 'destination'])
      && !exactKeys(input, ['value', 'metadata', 'passphrase', 'destination', 'onVerified']))
    || (input.onVerified !== undefined && typeof input.onVerified !== 'function')) {
    throw new Error('Gizlilik dışa aktarım dosya isteği exact değildir.');
  }
  if (typeof input.destination !== 'string' || !isAbsolute(input.destination) || extname(input.destination).toLowerCase() !== '.pptprivacy') {
    throw new Error('Gizlilik dışa aktarım hedefi absolute ve .pptprivacy uzantılı olmalıdır.');
  }
  const destination = resolve(input.destination);
  const parent = dirname(destination);
  const parentEntry = await lstat(parent).catch((error: unknown) => {
    if (missing(error)) throw new Error('Gizlilik dışa aktarım üst dizini mevcut değildir.');
    throw error;
  });
  if (!parentEntry.isDirectory() || parentEntry.isSymbolicLink()) throw new Error('Gizlilik dışa aktarım üst hedefi gerçek bir dizin olmalıdır.');
  const resolvedParent = await realpath(parent);
  if (!samePath(resolve(parent), resolve(resolvedParent))) throw new Error('Gizlilik dışa aktarım üst dizini reparse veya symlink içeremez.');
  await access(resolvedParent, constants.W_OK);
  const finalPath = resolve(resolvedParent, basename(destination));
  await assertAbsent(finalPath);

  const temporaryPath = resolve(resolvedParent, `.${basename(destination)}.${randomBytes(16).toString('hex')}.tmp`);
  let encrypted: Buffer | undefined;
  let readback: Buffer | undefined;
  let temporaryCreated = false;
  let published = false;
  let publishedIdentity: { readonly dev: bigint; readonly ino: bigint } | undefined;
  try {
    encrypted = encryptPrivacyDataExport({ value: input.value, metadata: input.metadata, passphrase: input.passphrase });
    const handle = await open(temporaryPath, 'wx', 0o600);
    temporaryCreated = true;
    try {
      await handle.chmod(0o600);
      await handle.writeFile(encrypted);
      await handle.sync();
    } finally { await handle.close(); }

    const temporaryEntry = await lstat(temporaryPath, { bigint: true });
    if (!temporaryEntry.isFile() || temporaryEntry.isSymbolicLink()) throw new Error('Gizlilik dışa aktarım temp hedefi regular file değildir.');
    await link(temporaryPath, finalPath);
    published = true;
    publishedIdentity = { dev: temporaryEntry.dev, ino: temporaryEntry.ino };

    const finalEntry = await lstat(finalPath, { bigint: true });
    if (!finalEntry.isFile() || finalEntry.isSymbolicLink()
      || finalEntry.dev !== publishedIdentity.dev || finalEntry.ino !== publishedIdentity.ino) {
      throw new Error('Gizlilik dışa aktarım final hedefi regular no-reparse file değildir.');
    }
    readback = await readFile(finalPath);
    const artifactSha256 = sha256Hex(encrypted);
    if (readback.length !== encrypted.length || !readback.equals(encrypted) || sha256Hex(readback) !== artifactSha256) {
      throw new Error('Gizlilik dışa aktarım byte readback doğrulaması başarısızdır.');
    }
    const verified = verifyPrivacyDataExportReadback({ serialized: readback, passphrase: input.passphrase, expectedMetadata: input.metadata });
    if (verified.artifactSha256 !== artifactSha256 || verified.artifactSizeBytes !== readback.length) {
      throw new Error('Gizlilik dışa aktarım decrypt metadata readback doğrulaması başarısızdır.');
    }
    await removeIfPresent(temporaryPath);
    temporaryCreated = false;
    await input.onVerified?.(verified);
    return Object.freeze({
      fileName: basename(finalPath),
      artifactSha256,
      artifactSizeBytes: readback.length,
      createdAt: verified.metadata.createdAt,
      delivery: 'not_performed'
    });
  } catch (error) {
    if (published && publishedIdentity) {
      try {
        const current = await lstat(finalPath, { bigint: true });
        if (current.isFile() && !current.isSymbolicLink()
          && current.dev === publishedIdentity.dev && current.ino === publishedIdentity.ino) await unlink(finalPath);
      } catch (cleanupError) { if (!missing(cleanupError)) throw new AggregateError([error, cleanupError], 'Gizlilik dışa aktarım ve final cleanup başarısız.'); }
    }
    throw error;
  } finally {
    readback?.fill(0);
    encrypted?.fill(0);
    if (temporaryCreated) await removeIfPresent(temporaryPath);
  }
}
