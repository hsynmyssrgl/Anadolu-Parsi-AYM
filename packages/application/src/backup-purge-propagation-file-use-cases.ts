import {
  ERROR_CODES,
  createAppError,
  err,
  type AppError,
  type CorrelationId,
  type Result
} from '@ppt/core';

export interface BackupPurgeTombstoneFingerprint {
  readonly fingerprint: string;
  readonly purgedAt: string;
}

export interface QuarantinedBackupArtifactDescriptor {
  readonly originalFilePath: string;
  readonly quarantinedFilePath: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

export interface BackupPurgeQuarantineResult {
  readonly quarantineDirectory: string;
  readonly manifestPath: string;
  readonly artifacts: readonly QuarantinedBackupArtifactDescriptor[];
}

export interface BackupPurgeQuarantineFilePort {
  quarantine(
    input: {
      readonly targetPath: string;
      readonly excludeFilePath: string;
      readonly artifactPaths: readonly string[];
      readonly batchId: string;
      readonly quarantinedAt: string;
      readonly tombstones: readonly BackupPurgeTombstoneFingerprint[];
    },
    correlationId: CorrelationId
  ): Result<BackupPurgeQuarantineResult, AppError>;
}

const invalid = (correlationId: CorrelationId, message: string): AppError =>
  createAppError({
    code: ERROR_CODES.CORE_INVALID_ARGUMENT,
    message,
    category: 'validation',
    correlationId
  });

export class QuarantineManagedBackupArtifactsUseCase {
  public constructor(private readonly files: BackupPurgeQuarantineFilePort) {}

  public execute(
    correlationId: CorrelationId,
    input: {
      readonly targetPath: string;
      readonly excludeFilePath: string;
      readonly artifactPaths: readonly string[];
      readonly batchId: string;
      readonly quarantinedAt: string;
      readonly tombstones: readonly BackupPurgeTombstoneFingerprint[];
    }
  ): Result<BackupPurgeQuarantineResult, AppError> {
    if (!input.targetPath.trim()) return err(invalid(correlationId, 'Yedek hedefi zorunludur.'));
    if (!input.excludeFilePath.trim()) return err(invalid(correlationId, 'Korunacak taze yedek yolu zorunludur.'));
    if (input.artifactPaths.some((filePath) => !filePath.trim())) return err(invalid(correlationId, 'Karantinaya alınacak yedek yolu boş olamaz.'));
    if (!/^[a-zA-Z0-9._-]{8,160}$/.test(input.batchId)) {
      return err(invalid(correlationId, 'Yedek karantina işlem kimliği geçersizdir.'));
    }
    if (Number.isNaN(Date.parse(input.quarantinedAt))) {
      return err(invalid(correlationId, 'Yedek karantina zamanı geçersizdir.'));
    }
    if (input.tombstones.length === 0) {
      return err(invalid(correlationId, 'Karantina için en az bir imha tombstone parmak izi gereklidir.'));
    }
    for (const tombstone of input.tombstones) {
      if (!/^[a-f0-9]{64}$/.test(tombstone.fingerprint)) {
        return err(invalid(correlationId, 'İmha tombstone parmak izi SHA-256 biçiminde olmalıdır.'));
      }
      if (Number.isNaN(Date.parse(tombstone.purgedAt))) {
        return err(invalid(correlationId, 'İmha tombstone zamanı geçersizdir.'));
      }
    }
    return this.files.quarantine(input, correlationId);
  }
}
