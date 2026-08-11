import {
  ERROR_CODES,
  createAppError,
  err,
  type AppError,
  type CorrelationId,
  type Result
} from '@ppt/core';

export interface OperationalArtifactDescriptor {
  readonly filePath: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

export interface OperationalArtifactVerification {
  readonly exists: boolean;
  readonly valid: boolean;
  readonly expectedSha256: string;
  readonly actualSha256?: string;
}

export interface OperationalArtifactFilePort {
  writeText(
    input: { readonly destinationPath: string; readonly content: string },
    correlationId: CorrelationId
  ): Result<OperationalArtifactDescriptor, AppError>;
  writeGzipText(
    input: { readonly destinationPath: string; readonly content: string },
    correlationId: CorrelationId
  ): Result<OperationalArtifactDescriptor, AppError>;
  verify(
    input: { readonly filePath: string; readonly expectedSha256: string },
    correlationId: CorrelationId
  ): Result<OperationalArtifactVerification, AppError>;
  readText(
    input: { readonly filePath: string },
    correlationId: CorrelationId
  ): Result<string, AppError>;
  readGzipText(
    input: { readonly filePath: string },
    correlationId: CorrelationId
  ): Result<string, AppError>;
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
  return { ok: true, value: undefined };
};

export class WriteOperationalTextArtifactUseCase {
  public constructor(private readonly files: OperationalArtifactFilePort) {}

  public execute(
    correlationId: CorrelationId,
    input: { readonly destinationPath: string; readonly content: string }
  ): Result<OperationalArtifactDescriptor, AppError> {
    const path = validatePath(correlationId, input.destinationPath, 'Hedef dosya yolu');
    if (!path.ok) return path;
    return this.files.writeText(input, correlationId);
  }
}

export class WriteOperationalGzipArtifactUseCase {
  public constructor(private readonly files: OperationalArtifactFilePort) {}

  public execute(
    correlationId: CorrelationId,
    input: { readonly destinationPath: string; readonly content: string }
  ): Result<OperationalArtifactDescriptor, AppError> {
    const path = validatePath(correlationId, input.destinationPath, 'Hedef dosya yolu');
    if (!path.ok) return path;
    return this.files.writeGzipText(input, correlationId);
  }
}

export class VerifyOperationalArtifactUseCase {
  public constructor(private readonly files: OperationalArtifactFilePort) {}

  public execute(
    correlationId: CorrelationId,
    input: { readonly filePath: string; readonly expectedSha256: string }
  ): Result<OperationalArtifactVerification, AppError> {
    const path = validatePath(correlationId, input.filePath, 'Dosya yolu');
    if (!path.ok) return path;
    if (!/^[a-f0-9]{64}$/i.test(input.expectedSha256)) {
      return err(invalid(correlationId, 'Beklenen SHA-256 özeti geçersizdir.'));
    }
    return this.files.verify(input, correlationId);
  }
}

export class ReadOperationalTextArtifactUseCase {
  public constructor(private readonly files: OperationalArtifactFilePort) {}

  public execute(
    correlationId: CorrelationId,
    input: { readonly filePath: string }
  ): Result<string, AppError> {
    const path = validatePath(correlationId, input.filePath, 'Dosya yolu');
    if (!path.ok) return path;
    return this.files.readText(input, correlationId);
  }
}

export class ReadOperationalGzipArtifactUseCase {
  public constructor(private readonly files: OperationalArtifactFilePort) {}

  public execute(
    correlationId: CorrelationId,
    input: { readonly filePath: string }
  ): Result<string, AppError> {
    const path = validatePath(correlationId, input.filePath, 'Dosya yolu');
    if (!path.ok) return path;
    return this.files.readGzipText(input, correlationId);
  }
}
