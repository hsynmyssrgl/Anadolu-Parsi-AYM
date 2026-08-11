import type { AppError, CorrelationId, Result } from '@ppt/core';
export interface RestoredDatabaseReauthorizationSummary {
  readonly revokedTrustedDeviceCount: number;
  readonly trustedDeviceTablePresent: boolean;
}

export interface BackupDatabaseSafetyPort {
  checkpoint(correlationId: CorrelationId): Result<void, AppError>;
  verifyFile(databasePath: string, correlationId: CorrelationId): Result<void, AppError>;
  prepareRestoredFileForReauthorization(
    databasePath: string,
    restoredAt: string,
    correlationId: CorrelationId
  ): Result<RestoredDatabaseReauthorizationSummary, AppError>;
}

export class PrepareBackupDatabaseUseCase {
  public constructor(private readonly safety: BackupDatabaseSafetyPort) {}

  public execute(correlationId: CorrelationId): Result<void, AppError> {
    return this.safety.checkpoint(correlationId);
  }
}

export class VerifyBackupDatabaseIntegrityUseCase {
  public constructor(private readonly safety: BackupDatabaseSafetyPort) {}

  public execute(databasePath: string, correlationId: CorrelationId): Result<void, AppError> {
    return this.safety.verifyFile(databasePath, correlationId);
  }
}

export class PrepareRestoredDatabaseForReauthorizationUseCase {
  public constructor(private readonly safety: BackupDatabaseSafetyPort) {}

  public execute(
    databasePath: string,
    restoredAt: string,
    correlationId: CorrelationId
  ): Result<RestoredDatabaseReauthorizationSummary, AppError> {
    return this.safety.prepareRestoredFileForReauthorization(databasePath, restoredAt, correlationId);
  }
}
