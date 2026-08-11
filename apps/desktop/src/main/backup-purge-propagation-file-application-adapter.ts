import { createHash } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import type { BackupPurgeQuarantineFilePort } from '@ppt/application';
import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId
} from '@ppt/core';

const isWithin = (baseDirectory: string, candidatePath: string): boolean => {
  const value = relative(baseDirectory, candidatePath);
  return value === '' || (!value.startsWith('..') && !isAbsolute(value));
};

const writeDurableJson = (filePath: string, value: unknown): void => {
  const temporaryPath = `${filePath}.tmp`;
  const descriptor = openSync(temporaryPath, 'w', 0o600);
  try {
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporaryPath, filePath);
  try { chmodSync(filePath, 0o600); } catch {}
};

export class FileSystemBackupPurgeQuarantinePort implements BackupPurgeQuarantineFilePort {
  public quarantine(
    input: Parameters<BackupPurgeQuarantineFilePort['quarantine']>[0],
    correlationId: CorrelationId
  ): ReturnType<BackupPurgeQuarantineFilePort['quarantine']> {
    const targetPath = resolve(input.targetPath);
    const excludeFilePath = resolve(input.excludeFilePath);
    if (!isWithin(targetPath, excludeFilePath) || !excludeFilePath.toLowerCase().endsWith('.pptbackup')) {
      return err(this.#error(correlationId, 'Taze yedek hedef klasörünün dışında olamaz.', 'path boundary'));
    }
    if (!existsSync(excludeFilePath)) {
      return err(this.#error(correlationId, 'Karantina öncesinde doğrulanmış taze yedek bulunamadı.', 'fresh backup missing'));
    }

    const quarantineDirectory = join(targetPath, '.purge-quarantine', input.batchId);
    const moved: Array<{ originalFilePath: string; quarantinedFilePath: string; sha256: string; sizeBytes: number }> = [];
    try {
      if (existsSync(quarantineDirectory)) {
        throw new Error('Aynı karantina işlem kimliği daha önce kullanılmış.');
      }
      mkdirSync(quarantineDirectory, { recursive: true, mode: 0o700 });
      try { chmodSync(join(targetPath, '.purge-quarantine'), 0o700); } catch {}
      try { chmodSync(quarantineDirectory, 0o700); } catch {}
      const artifactPaths = [...new Set(input.artifactPaths.map((filePath) => resolve(filePath)))].sort();
      for (const filePath of artifactPaths) {
        if (!isWithin(targetPath, filePath) || !filePath.toLowerCase().endsWith('.pptbackup')) {
          throw new Error(`Yönetilen yedek hedef sınırının dışında: ${basename(filePath)}`);
        }
        if (filePath === excludeFilePath) {
          throw new Error('Taze yedek karantinaya alınamaz.');
        }
        if (!existsSync(filePath)) {
          throw new Error(`Yönetilen eski yedek bulunamadı: ${basename(filePath)}`);
        }
      }

      for (const originalFilePath of artifactPaths) {
        const bytes = readFileSync(originalFilePath);
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        const sizeBytes = statSync(originalFilePath).size;
        const quarantinedFilePath = join(quarantineDirectory, `${basename(originalFilePath)}.quarantined`);
        renameSync(originalFilePath, quarantinedFilePath);
        try { chmodSync(quarantinedFilePath, 0o600); } catch {}
        moved.push({ originalFilePath, quarantinedFilePath, sha256, sizeBytes });
      }

      const manifestPath = join(quarantineDirectory, 'manifest.json');
      writeDurableJson(manifestPath, {
        schemaVersion: 1,
        batchId: input.batchId,
        quarantinedAt: input.quarantinedAt,
        targetName: basename(targetPath),
        freshBackupName: basename(excludeFilePath),
        tombstones: input.tombstones,
        artifacts: moved.map((artifact) => ({
          originalName: basename(artifact.originalFilePath),
          quarantinedName: basename(artifact.quarantinedFilePath),
          sha256: artifact.sha256,
          sizeBytes: artifact.sizeBytes
        })),
        warning: 'Karantina fiziksel imha değildir. Manuel ve yönetilmeyen yedek kopyaları ayrıca ele alınmalıdır.'
      });
      return ok({ quarantineDirectory, manifestPath, artifacts: moved });
    } catch (error) {
      for (const artifact of [...moved].reverse()) {
        try {
          if (!existsSync(artifact.originalFilePath) && existsSync(artifact.quarantinedFilePath)) {
            renameSync(artifact.quarantinedFilePath, artifact.originalFilePath);
          }
        } catch {}
      }
      try { rmSync(quarantineDirectory, { recursive: true, force: true }); } catch {}
      return err(this.#error(correlationId, 'Eski yönetilen yedekler karantinaya alınamadı.', error));
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
