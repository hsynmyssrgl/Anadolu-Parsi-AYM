import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type Result
} from '@ppt/core';
import type { DatabaseExecutor } from '@ppt/contracts';
import { mapSqliteError } from './sqlite-error.js';

export type SqliteMaintenanceOperation =
  | 'integrity_check'
  | 'wal_checkpoint'
  | 'analyze'
  | 'vacuum';

const isIntegrityOk = (rows: readonly Record<string, unknown>[]): boolean =>
  rows.length > 0 && rows.every((row) =>
    Object.values(row).some((value) => String(value).toLowerCase() === 'ok')
  );

export const executeSqliteMaintenance = (
  database: DatabaseExecutor,
  operation: SqliteMaintenanceOperation,
  correlationId: CorrelationId
): Result<void, AppError> => {
  try {
    switch (operation) {
      case 'integrity_check': {
        const rows = database.prepare('PRAGMA integrity_check').all() as Array<Record<string, unknown>>;
        if (!isIntegrityOk(rows)) {
          return err(createAppError({
            code: ERROR_CODES.DATABASE_INTEGRITY_FAILED,
            message: 'Bütünlük kontrolü başarısız.',
            category: 'infrastructure',
            correlationId,
            details: { rowCount: rows.length }
          }));
        }
        break;
      }
      case 'wal_checkpoint':
        database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
        break;
      case 'analyze':
        database.exec('ANALYZE');
        break;
      case 'vacuum':
        database.exec('VACUUM');
        break;
    }
    return ok(undefined);
  } catch (error) {
    return err(mapSqliteError(error, correlationId));
  }
};
