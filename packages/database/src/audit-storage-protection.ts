import {
  err,
  ok,
  type AppError,
  type CorrelationId,
  type Result
} from '@ppt/core';
import type { DatabaseExecutor } from '@ppt/contracts';
import { mapSqliteError } from './sqlite-error.js';

export const installSqliteAuditAppendOnlyGuards = (
  database: DatabaseExecutor,
  correlationId: CorrelationId
): Result<void, AppError> => {
  try {
    database.exec(`
      CREATE TRIGGER IF NOT EXISTS audit_log_append_only_update
      BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT,'AUDIT-APPEND-ONLY'); END;
      CREATE TRIGGER IF NOT EXISTS audit_log_append_only_delete
      BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT,'AUDIT-APPEND-ONLY'); END;
    `);
    return ok(undefined);
  } catch (error) {
    return err(mapSqliteError(error, correlationId));
  }
};
