import {
  ERROR_CODES,
  createAppError,
  err,
  type AppError,
  type CorrelationId,
  type Result
} from '@ppt/core';

/**
 * Historical raw-copy adapter retained for source archaeology only.
 * It is deliberately absent from the application root export and production
 * composition; user-facing backups must use the protected full-backup path.
 */
interface DormantDatabaseExportFilePort {
  copyDatabase(
    input: { readonly sourcePath: string; readonly destinationPath: string },
    correlationId: CorrelationId
  ): Result<void, AppError>;
}

export class FileSystemDatabaseExportFilePort implements DormantDatabaseExportFilePort {
  public copyDatabase(
    input: { readonly sourcePath: string; readonly destinationPath: string },
    correlationId: CorrelationId
  ): Result<void, AppError> {
    return err(createAppError({
      code: ERROR_CODES.AUTHORIZATION_DENIED,
      message: 'Korumasız SQLite kopyalama adaptörü kalıcı olarak devre dışıdır.',
      category: 'security',
      correlationId,
      details: Object.freeze({
        sourceProvided: input.sourcePath.trim().length > 0,
        destinationProvided: input.destinationPath.trim().length > 0,
        replacement: 'protected-full-backup'
      })
    }));
  }
}
