import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type Result
} from '@ppt/core';

export interface DatabaseExportFilePort {
  copyDatabase(
    input: { readonly sourcePath: string; readonly destinationPath: string },
    correlationId: CorrelationId
  ): Result<void, AppError>;
}

const invalid = (correlationId: CorrelationId, message: string): AppError =>
  createAppError({
    code: ERROR_CODES.CORE_INVALID_ARGUMENT,
    message,
    category: 'validation',
    correlationId
  });

export class ExportDatabaseFileUseCase {
  public constructor(private readonly files: DatabaseExportFilePort) {}

  public execute(
    correlationId: CorrelationId,
    input: { readonly sourcePath: string; readonly destinationPath: string }
  ): Result<void, AppError> {
    if (!input.sourcePath.trim()) {
      return err(invalid(correlationId, 'Kaynak veritabanı yolu zorunludur.'));
    }
    if (!input.destinationPath.trim()) {
      return err(invalid(correlationId, 'Dışa aktarım hedefi zorunludur.'));
    }
    if (!input.destinationPath.toLowerCase().endsWith('.db')) {
      return err(invalid(correlationId, 'Yedek dosyası .db uzantılı olmalıdır.'));
    }
    if (input.sourcePath === input.destinationPath) {
      return err(invalid(correlationId, 'Kaynak ve hedef veritabanı yolu aynı olamaz.'));
    }
    return this.files.copyDatabase(input, correlationId);
  }
}
