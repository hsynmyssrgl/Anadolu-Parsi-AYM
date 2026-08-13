import { createHash, randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { basename, extname, join } from 'node:path';
import type { ArchiveVaultFilePort } from '@ppt/application';
import type { ProtectedArchiveVaultKeyProvider } from './archive-vault-key-provider.js';
import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId
} from '@ppt/core';
import { decryptBytes, encryptBytes, type EncryptedEnvelope } from '@ppt/security';

export interface FileSystemArchiveVaultFilePortOptions {
  readonly archivePath: string;
  readonly keyPath: string;
  readonly keyProvider?: ProtectedArchiveVaultKeyProvider;
  readonly temporaryOpenPath: string;
}

export class FileSystemArchiveVaultFilePort implements ArchiveVaultFilePort {
  public constructor(private readonly options: FileSystemArchiveVaultFilePortOptions) {
    mkdirSync(options.archivePath, { recursive: true });
  }

  public store(
    input: { readonly sourcePath: string; readonly itemId: string },
    correlationId: CorrelationId
  ): ReturnType<ArchiveVaultFilePort['store']> {
    try {
      const plain = readFileSync(input.sourcePath);
      const storedName = `${input.itemId}.vault`;
      const targetPath = this.#resolveStoredPath(storedName, correlationId);
      const vaultKey = this.#vaultKey();
      const metadata = {
        originalName: basename(input.sourcePath),
        storedName,
        mimeType: extname(input.sourcePath).toLowerCase() === '.pdf'
          ? 'application/pdf'
          : 'application/octet-stream',
        sizeBytes: plain.length,
        sha256: createHash('sha256').update(plain).digest('hex')
      } as const;
      if (existsSync(targetPath)) {
        const existingEnvelope = JSON.parse(readFileSync(targetPath, 'utf8')) as EncryptedEnvelope;
        const existingPlain = decryptBytes(existingEnvelope, vaultKey);
        const existingSha256 = createHash('sha256').update(existingPlain).digest('hex');
        if (existingPlain.length !== metadata.sizeBytes || existingSha256 !== metadata.sha256) {
          return err(createAppError({
            code: ERROR_CODES.CORE_INVALID_ARGUMENT,
            message: 'Aynı arşiv işlem kimliği farklı dosya içeriğiyle yeniden kullanılamaz.',
            category: 'security',
            correlationId
          }));
        }
        return ok({ ...metadata, createdNewFile: false });
      }
      const envelope = encryptBytes(plain, vaultKey);
      try {
        writeFileSync(targetPath, JSON.stringify(envelope), { flag: 'wx', mode: 0o600 });
        return ok({ ...metadata, createdNewFile: true });
      } catch (error) {
        if (!this.#isAlreadyExistsError(error)) throw error;
        const existingEnvelope = JSON.parse(readFileSync(targetPath, 'utf8')) as EncryptedEnvelope;
        const existingPlain = decryptBytes(existingEnvelope, vaultKey);
        const existingSha256 = createHash('sha256').update(existingPlain).digest('hex');
        if (existingPlain.length !== metadata.sizeBytes || existingSha256 !== metadata.sha256) {
          return err(createAppError({
            code: ERROR_CODES.CORE_INVALID_ARGUMENT,
            message: 'Eşzamanlı arşiv yeniden denemesi farklı dosya içeriği üretti.',
            category: 'security',
            correlationId
          }));
        }
        return ok({ ...metadata, createdNewFile: false });
      }
    } catch (error) {
      return err(this.#error(correlationId, 'Arşiv dosyası kasaya alınamadı.', error));
    }
  }

  public materialize(
    input: {
      readonly itemId: string;
      readonly storedName: string;
      readonly originalName: string;
      readonly expectedSha256: string;
    },
    correlationId: CorrelationId
  ): ReturnType<ArchiveVaultFilePort['materialize']> {
    try {
      const envelope = JSON.parse(
        readFileSync(this.#resolveStoredPath(input.storedName, correlationId), 'utf8')
      ) as EncryptedEnvelope;
      const plain = decryptBytes(envelope, this.#vaultKey());
      const actualSha256 = createHash('sha256').update(plain).digest('hex');
      if (actualSha256 !== input.expectedSha256) {
        return err(createAppError({
          code: ERROR_CODES.CORE_UNEXPECTED,
          message: 'Dosya bütünlük kontrolü başarısız.',
          category: 'security',
          correlationId
        }));
      }
      mkdirSync(this.options.temporaryOpenPath, { recursive: true });
      const targetPath = join(
        this.options.temporaryOpenPath,
        `${input.itemId}-${basename(input.originalName)}`
      );
      writeFileSync(targetPath, plain);
      return ok(targetPath);
    } catch (error) {
      return err(this.#error(correlationId, 'Arşiv dosyası açılamadı.', error));
    }
  }

  public readBytes(
    input: {
      readonly itemId: string;
      readonly storedName: string;
      readonly expectedSha256: string;
      readonly expectedSizeBytes: number;
      readonly maximumBytes: number;
    },
    correlationId: CorrelationId
  ): ReturnType<ArchiveVaultFilePort['readBytes']> {
    let serializedEnvelope: Buffer | undefined;
    let vaultKey: Buffer | undefined;
    let plain: Buffer | undefined;
    try {
      if (
        !Number.isSafeInteger(input.expectedSizeBytes)
        || input.expectedSizeBytes < 1
        || !Number.isSafeInteger(input.maximumBytes)
        || input.maximumBytes < 1
        || input.expectedSizeBytes > input.maximumBytes
        || !/^[a-f0-9]{64}$/iu.test(input.expectedSha256)
      ) {
        return err(createAppError({
          code: ERROR_CODES.CORE_INVALID_ARGUMENT,
          message: 'Arşiv dosyası izin verilen bellek içi okuma sınırını aşıyor.',
          category: 'security',
          correlationId
        }));
      }
      const targetPath = this.#resolveStoredPath(input.storedName, correlationId);
      const stat = statSync(targetPath);
      const maximumEnvelopeBytes = Math.ceil(input.maximumBytes * 4 / 3) + 64 * 1024;
      if (!stat.isFile() || stat.size < 1 || stat.size > maximumEnvelopeBytes) {
        return err(createAppError({
          code: ERROR_CODES.CORE_INVALID_ARGUMENT,
          message: 'Şifreli arşiv zarfı izin verilen okuma sınırını aşıyor.',
          category: 'security',
          correlationId
        }));
      }
      serializedEnvelope = readFileSync(targetPath);
      if (serializedEnvelope.length !== stat.size || serializedEnvelope.length > maximumEnvelopeBytes) {
        return err(createAppError({
          code: ERROR_CODES.CORE_UNEXPECTED,
          message: 'Şifreli arşiv zarfı okuma sırasında değişti.',
          category: 'security',
          correlationId
        }));
      }
      const envelope = JSON.parse(serializedEnvelope.toString('utf8')) as EncryptedEnvelope;
      vaultKey = this.#vaultKey();
      plain = decryptBytes(envelope, vaultKey);
      const actualSha256 = createHash('sha256').update(plain).digest('hex');
      if (
        plain.length !== input.expectedSizeBytes
        || plain.length > input.maximumBytes
        || actualSha256 !== input.expectedSha256.toLowerCase()
      ) {
        return err(createAppError({
          code: ERROR_CODES.CORE_UNEXPECTED,
          message: 'Arşiv dosyası boyut veya bütünlük doğrulamasını geçemedi.',
          category: 'security',
          correlationId
        }));
      }
      const result = Buffer.from(plain);
      plain.fill(0);
      plain = undefined;
      return ok(result);
    } catch (error) {
      return err(this.#error(correlationId, 'Arşiv dosyası bellek içinde okunamadı.', error));
    } finally {
      serializedEnvelope?.fill(0);
      vaultKey?.fill(0);
      plain?.fill(0);
    }
  }

  public destroy(
    input: { readonly storedName: string; readonly secureDestroy: boolean },
    correlationId: CorrelationId
  ): ReturnType<ArchiveVaultFilePort['destroy']> {
    try {
      const targetPath = this.#resolveStoredPath(input.storedName, correlationId);
      if (!existsSync(targetPath)) return ok(undefined);
      if (input.secureDestroy) {
        const size = statSync(targetPath).size;
        writeFileSync(targetPath, randomBytes(Math.max(1, size)));
      }
      rmSync(targetPath, { force: true });
      return ok(undefined);
    } catch (error) {
      return err(this.#error(correlationId, 'Arşiv dosyası silinemedi.', error));
    }
  }

  #vaultKey(): Buffer {
    if (this.options.keyProvider) {
      if (!this.options.keyProvider.matchesPath(this.options.keyPath)) {
        throw new Error('Dijital kasa anahtarı sağlayıcısı depolama yolu ile eşleşmiyor.');
      }
      return this.options.keyProvider.getOrCreateKey();
    }
    if (!existsSync(this.options.keyPath)) {
      writeFileSync(this.options.keyPath, randomBytes(32), { mode: 0o600 });
    }
    const key = readFileSync(this.options.keyPath);
    if (key.length !== 32) throw new Error('Dijital kasa anahtarı geçersiz.');
    return key;
  }

  #resolveStoredPath(storedName: string, correlationId: CorrelationId): string {
    if (basename(storedName) !== storedName) {
      throw createAppError({
        code: ERROR_CODES.CORE_INVALID_ARGUMENT,
        message: 'Güvenli olmayan kasa dosyası adı reddedildi.',
        category: 'security',
        correlationId
      });
    }
    return join(this.options.archivePath, storedName);
  }

  #isAlreadyExistsError(error: unknown): boolean {
    return typeof error === 'object'
      && error !== null
      && 'code' in error
      && (error as { readonly code?: unknown }).code === 'EEXIST';
  }

  #error(correlationId: CorrelationId, message: string, error: unknown): AppError {
    if (typeof error === 'object' && error !== null && 'code' in error && 'correlationId' in error) {
      return error as AppError;
    }
    return createAppError({
      code: ERROR_CODES.CORE_UNEXPECTED,
      message,
      category: 'infrastructure',
      correlationId,
      details: { cause: error instanceof Error ? error.message : String(error) }
    });
  }
}
