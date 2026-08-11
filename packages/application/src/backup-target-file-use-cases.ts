import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type Result
} from '@ppt/core';

export interface BackupTargetArtifactDescriptor {
  readonly filePath: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

export interface BackupTargetFilePort {
  inspectFreeBytes(
    input: { readonly targetPath: string },
    correlationId: CorrelationId
  ): Result<number, AppError>;
  prepareWritableTarget(
    input: { readonly targetPath: string },
    correlationId: CorrelationId
  ): Result<number, AppError>;
  createArtifactPath(
    input: { readonly targetPath: string; readonly createdAt: string; readonly attempt: number },
    correlationId: CorrelationId
  ): Result<string, AppError>;
  inspectArtifact(
    input: { readonly filePath: string },
    correlationId: CorrelationId
  ): Result<BackupTargetArtifactDescriptor, AppError>;
  deleteArtifact(
    input: { readonly filePath: string },
    correlationId: CorrelationId
  ): Result<void, AppError>;
  listArtifacts(
    input: { readonly targetPath: string },
    correlationId: CorrelationId
  ): Result<readonly string[], AppError>;
}

const invalid = (correlationId: CorrelationId, message: string): AppError =>
  createAppError({
    code: ERROR_CODES.CORE_INVALID_ARGUMENT,
    message,
    category: 'validation',
    correlationId
  });

const validatePath = (
  correlationId: CorrelationId,
  path: string,
  label: string
): Result<void, AppError> => {
  if (!path.trim()) return err(invalid(correlationId, `${label} zorunludur.`));
  return ok(undefined);
};

export class GetBackupTargetFreeBytesUseCase {
  public constructor(private readonly files: BackupTargetFilePort) {}

  public execute(correlationId: CorrelationId, targetPath: string): Result<number, AppError> {
    const path = validatePath(correlationId, targetPath, 'Yedek hedefi');
    if (!path.ok) return path;
    return this.files.inspectFreeBytes({ targetPath }, correlationId);
  }
}

export class PrepareBackupTargetUseCase {
  public constructor(private readonly files: BackupTargetFilePort) {}

  public execute(
    correlationId: CorrelationId,
    input: { readonly targetPath: string; readonly minimumFreeBytes: number }
  ): Result<{ readonly freeBytes: number }, AppError> {
    const path = validatePath(correlationId, input.targetPath, 'Yedek hedefi');
    if (!path.ok) return path;
    if (!Number.isSafeInteger(input.minimumFreeBytes) || input.minimumFreeBytes < 0) {
      return err(invalid(correlationId, 'Asgari boş alan değeri geçersizdir.'));
    }
    const prepared = this.files.prepareWritableTarget({ targetPath: input.targetPath }, correlationId);
    if (!prepared.ok) return prepared;
    if (prepared.value < input.minimumFreeBytes) {
      return err(invalid(correlationId, 'Yedek hedefinde en az 100 MB boş alan bulunmalıdır.'));
    }
    return ok({ freeBytes: prepared.value });
  }
}

export class CreateBackupArtifactPathUseCase {
  public constructor(private readonly files: BackupTargetFilePort) {}

  public execute(
    correlationId: CorrelationId,
    input: { readonly targetPath: string; readonly createdAt: string; readonly attempt: number }
  ): Result<string, AppError> {
    const path = validatePath(correlationId, input.targetPath, 'Yedek hedefi');
    if (!path.ok) return path;
    if (!Number.isInteger(input.attempt) || input.attempt < 0) {
      return err(invalid(correlationId, 'Yedek deneme numarası geçersizdir.'));
    }
    if (Number.isNaN(Date.parse(input.createdAt))) {
      return err(invalid(correlationId, 'Yedek oluşturma zamanı geçersizdir.'));
    }
    return this.files.createArtifactPath(input, correlationId);
  }
}

export class InspectBackupArtifactUseCase {
  public constructor(private readonly files: BackupTargetFilePort) {}

  public execute(
    correlationId: CorrelationId,
    filePath: string
  ): Result<BackupTargetArtifactDescriptor, AppError> {
    const path = validatePath(correlationId, filePath, 'Yedek dosyası');
    if (!path.ok) return path;
    return this.files.inspectArtifact({ filePath }, correlationId);
  }
}

export class DeleteBackupArtifactUseCase {
  public constructor(private readonly files: BackupTargetFilePort) {}

  public execute(correlationId: CorrelationId, filePath: string): Result<void, AppError> {
    const path = validatePath(correlationId, filePath, 'Yedek dosyası');
    if (!path.ok) return path;
    return this.files.deleteArtifact({ filePath }, correlationId);
  }
}

export class ListBackupArtifactsUseCase {
  public constructor(private readonly files: BackupTargetFilePort) {}

  public execute(
    correlationId: CorrelationId,
    targetPath: string
  ): Result<readonly string[], AppError> {
    const path = validatePath(correlationId, targetPath, 'Yedek hedefi');
    if (!path.ok) return path;
    return this.files.listArtifacts({ targetPath }, correlationId);
  }
}
