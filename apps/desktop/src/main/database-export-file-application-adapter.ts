import { copyFileSync } from 'node:fs';
import type { DatabaseExportFilePort } from '@ppt/application';
import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId
} from '@ppt/core';

export class FileSystemDatabaseExportFilePort implements DatabaseExportFilePort {
  public copyDatabase(
    input: { readonly sourcePath: string; readonly destinationPath: string },
    correlationId: CorrelationId
  ): ReturnType<DatabaseExportFilePort['copyDatabase']> {
    try {
      copyFileSync(input.sourcePath, input.destinationPath);
      return ok(undefined);
    } catch (error) {
      return err(this.#error(correlationId, 'Veritabanı dışa aktarılamadı.', error));
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
