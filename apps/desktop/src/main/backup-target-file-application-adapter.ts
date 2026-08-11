import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, statfsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BackupTargetFilePort } from '@ppt/application';
import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId
} from '@ppt/core';

export class FileSystemBackupTargetFilePort implements BackupTargetFilePort {
  public inspectFreeBytes(
    input: { readonly targetPath: string },
    correlationId: CorrelationId
  ): ReturnType<BackupTargetFilePort['inspectFreeBytes']> {
    try {
      return ok(this.#freeBytes(input.targetPath));
    } catch (error) {
      return err(this.#error(correlationId, 'Yedek hedefi boş alanı okunamadı.', error));
    }
  }

  public prepareWritableTarget(
    input: { readonly targetPath: string },
    correlationId: CorrelationId
  ): ReturnType<BackupTargetFilePort['prepareWritableTarget']> {
    const probePath = join(input.targetPath, '.ppt-write-test');
    try {
      mkdirSync(input.targetPath, { recursive: true });
      writeFileSync(probePath, 'ok');
      rmSync(probePath, { force: true });
      return ok(this.#freeBytes(input.targetPath));
    } catch (error) {
      try { rmSync(probePath, { force: true }); } catch {}
      return err(this.#error(correlationId, 'Yedek hedefi yazılabilir değil.', error));
    }
  }

  public createArtifactPath(
    input: { readonly targetPath: string; readonly createdAt: string; readonly attempt: number },
    correlationId: CorrelationId
  ): ReturnType<BackupTargetFilePort['createArtifactPath']> {
    try {
      const timestamp = new Date(input.createdAt).toISOString().replace(/[:.]/g, '-');
      return ok(join(input.targetPath, `Anadolu_Parsi_${timestamp}_${input.attempt}.pptbackup`));
    } catch (error) {
      return err(this.#error(correlationId, 'Yedek dosyası yolu oluşturulamadı.', error));
    }
  }

  public inspectArtifact(
    input: { readonly filePath: string },
    correlationId: CorrelationId
  ): ReturnType<BackupTargetFilePort['inspectArtifact']> {
    try {
      const bytes = readFileSync(input.filePath);
      const sha256 = this.#sha256(bytes);
      const readbackSha256 = this.#sha256(readFileSync(input.filePath));
      if (readbackSha256 !== sha256) {
        return err(this.#error(correlationId, 'Yedek hash doğrulaması başarısız.', 'readback hash mismatch'));
      }
      return ok({ filePath: input.filePath, sizeBytes: bytes.byteLength, sha256 });
    } catch (error) {
      return err(this.#error(correlationId, 'Yedek dosyası doğrulanamadı.', error));
    }
  }

  public deleteArtifact(
    input: { readonly filePath: string },
    correlationId: CorrelationId
  ): ReturnType<BackupTargetFilePort['deleteArtifact']> {
    try {
      rmSync(input.filePath, { force: true });
      return ok(undefined);
    } catch (error) {
      return err(this.#error(correlationId, 'Yedek dosyası silinemedi.', error));
    }
  }

  public listArtifacts(
    input: { readonly targetPath: string },
    correlationId: CorrelationId
  ): ReturnType<BackupTargetFilePort['listArtifacts']> {
    try {
      return ok(
        readdirSync(input.targetPath)
          .filter((name) => name.endsWith('.pptbackup'))
          .map((name) => join(input.targetPath, name))
      );
    } catch (error) {
      return err(this.#error(correlationId, 'Yedek hedefi dosyaları listelenemedi.', error));
    }
  }

  #freeBytes(targetPath: string): number {
    const disk = statfsSync(targetPath);
    return Math.min(Number.MAX_SAFE_INTEGER, Number(disk.bavail) * Number(disk.bsize));
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
