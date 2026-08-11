import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import type { OperationalArtifactFilePort } from '@ppt/application';
import type { ProtectedSideArtifactStore } from './protected-side-artifact-store.js';
import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId
} from '@ppt/core';

export class FileSystemOperationalArtifactFilePort implements OperationalArtifactFilePort {
  public writeText(
    input: { readonly destinationPath: string; readonly content: string },
    correlationId: CorrelationId
  ): ReturnType<OperationalArtifactFilePort['writeText']> {
    try {
      const bytes = Buffer.from(input.content, 'utf8');
      this.#write(input.destinationPath, bytes);
      return ok(this.#descriptor(input.destinationPath, bytes));
    } catch (error) {
      return err(this.#error(correlationId, 'Operasyonel çıktı dosyası yazılamadı.', error));
    }
  }

  public writeGzipText(
    input: { readonly destinationPath: string; readonly content: string },
    correlationId: CorrelationId
  ): ReturnType<OperationalArtifactFilePort['writeGzipText']> {
    try {
      const bytes = gzipSync(Buffer.from(input.content, 'utf8'));
      this.#write(input.destinationPath, bytes);
      return ok(this.#descriptor(input.destinationPath, bytes));
    } catch (error) {
      return err(this.#error(correlationId, 'Sıkıştırılmış operasyonel çıktı yazılamadı.', error));
    }
  }

  public verify(
    input: { readonly filePath: string; readonly expectedSha256: string },
    correlationId: CorrelationId
  ): ReturnType<OperationalArtifactFilePort['verify']> {
    try {
      if (!existsSync(input.filePath)) {
        return ok({ exists: false, valid: false, expectedSha256: input.expectedSha256 });
      }
      const actualSha256 = this.#sha256(readFileSync(input.filePath));
      return ok({
        exists: true,
        valid: actualSha256 === input.expectedSha256,
        expectedSha256: input.expectedSha256,
        actualSha256
      });
    } catch (error) {
      return err(this.#error(correlationId, 'Operasyonel çıktı doğrulanamadı.', error));
    }
  }

  public readText(
    input: { readonly filePath: string },
    correlationId: CorrelationId
  ): ReturnType<OperationalArtifactFilePort['readText']> {
    try {
      return ok(readFileSync(input.filePath, 'utf8'));
    } catch (error) {
      return err(this.#error(correlationId, 'Operasyonel çıktı okunamadı.', error));
    }
  }

  public readGzipText(
    input: { readonly filePath: string },
    correlationId: CorrelationId
  ): ReturnType<OperationalArtifactFilePort['readGzipText']> {
    try {
      return ok(gunzipSync(readFileSync(input.filePath)).toString('utf8'));
    } catch (error) {
      return err(this.#error(correlationId, 'Sıkıştırılmış operasyonel çıktı okunamadı.', error));
    }
  }

  #write(destinationPath: string, bytes: Buffer): void {
    mkdirSync(dirname(destinationPath), { recursive: true });
    writeFileSync(destinationPath, bytes);
  }

  #descriptor(filePath: string, bytes: Buffer) {
    return { filePath, sha256: this.#sha256(bytes), sizeBytes: bytes.byteLength };
  }

  #sha256(bytes: Buffer): string {
    return createHash('sha256').update(bytes).digest('hex');
  }

  #error(correlationId: CorrelationId, message: string, error: unknown): AppError {
    return createAppError({
      code: ERROR_CODES.CORE_UNEXPECTED,
      message,
      category: 'infrastructure',
      correlationId,
      details: { cause: error instanceof Error ? error.message : String(error) }
    });
  }
}

export class ProtectedOperationalArtifactFilePort implements OperationalArtifactFilePort {
  public constructor(private readonly store: ProtectedSideArtifactStore) {}

  public writeText(
    input: { readonly destinationPath: string; readonly content: string },
    correlationId: CorrelationId
  ): ReturnType<OperationalArtifactFilePort['writeText']> {
    try {
      return ok(this.store.writeText(input.destinationPath, 'operational-text-export', input.content));
    } catch (error) {
      return err(this.#error(correlationId, 'Korumalı operasyonel çıktı yazılamadı.', error));
    }
  }

  public writeGzipText(
    input: { readonly destinationPath: string; readonly content: string },
    correlationId: CorrelationId
  ): ReturnType<OperationalArtifactFilePort['writeGzipText']> {
    try {
      const compressed = gzipSync(Buffer.from(input.content, 'utf8'));
      return ok(this.store.writeBuffer(input.destinationPath, 'operational-gzip-export', compressed));
    } catch (error) {
      return err(this.#error(correlationId, 'Korumalı sıkıştırılmış operasyonel çıktı yazılamadı.', error));
    }
  }

  public verify(
    input: { readonly filePath: string; readonly expectedSha256: string },
    correlationId: CorrelationId
  ): ReturnType<OperationalArtifactFilePort['verify']> {
    try {
      return ok(this.store.verify(input.filePath, input.expectedSha256));
    } catch (error) {
      return err(this.#error(correlationId, 'Korumalı operasyonel çıktı doğrulanamadı.', error));
    }
  }

  public readText(
    input: { readonly filePath: string },
    correlationId: CorrelationId
  ): ReturnType<OperationalArtifactFilePort['readText']> {
    try {
      return ok(this.store.readText(input.filePath));
    } catch (error) {
      return err(this.#error(correlationId, 'Korumalı operasyonel çıktı okunamadı.', error));
    }
  }

  public readGzipText(
    input: { readonly filePath: string },
    correlationId: CorrelationId
  ): ReturnType<OperationalArtifactFilePort['readGzipText']> {
    try {
      return ok(gunzipSync(this.store.readBuffer(input.filePath)).toString('utf8'));
    } catch (error) {
      return err(this.#error(correlationId, 'Korumalı sıkıştırılmış operasyonel çıktı okunamadı.', error));
    }
  }

  #error(correlationId: CorrelationId, message: string, error: unknown): AppError {
    return createAppError({
      code: ERROR_CODES.CORE_UNEXPECTED,
      message,
      category: 'infrastructure',
      correlationId,
      details: { cause: error instanceof Error ? error.message : String(error) }
    });
  }
}

