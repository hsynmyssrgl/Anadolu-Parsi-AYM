import {
  ERROR_CODES,
  createAppError,
  err,
  type AppError,
  type CorrelationId,
  type Result
} from '@ppt/core';

export interface FamilyStorageLayoutView {
  readonly databasePath: string;
  readonly deviceIdentityPath: string;
  readonly archivePath: string;
  readonly vaultKeyPath: string;
  readonly temporaryOpenPath: string;
}

export interface FamilyStorageLayoutPort {
  resolve(
    input: {
      readonly databasePath: string;
      readonly deviceIdentityPath?: string;
      readonly archivePath?: string;
    },
    correlationId: CorrelationId
  ): Result<FamilyStorageLayoutView, AppError>;
}

const invalid = (correlationId: CorrelationId, message: string): AppError =>
  createAppError({
    code: ERROR_CODES.CORE_INVALID_ARGUMENT,
    message,
    category: 'validation',
    correlationId
  });

export class ResolveFamilyStorageLayoutUseCase {
  public constructor(private readonly storageLayout: FamilyStorageLayoutPort) {}

  public execute(
    correlationId: CorrelationId,
    input: {
      readonly databasePath: string;
      readonly deviceIdentityPath?: string;
      readonly archivePath?: string;
    }
  ): Result<FamilyStorageLayoutView, AppError> {
    if (!input.databasePath.trim()) {
      return err(invalid(correlationId, 'Veritabanı yolu zorunludur.'));
    }
    if (input.deviceIdentityPath !== undefined && !input.deviceIdentityPath.trim()) {
      return err(invalid(correlationId, 'Cihaz kimliği yolu boş olamaz.'));
    }
    if (input.archivePath !== undefined && !input.archivePath.trim()) {
      return err(invalid(correlationId, 'Arşiv yolu boş olamaz.'));
    }
    return this.storageLayout.resolve(input, correlationId);
  }
}
