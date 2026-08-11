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
import { inspectDatabaseSchema, type SchemaInspection } from './migration-runner.js';
import { mapSqliteError } from './sqlite-error.js';

export interface SqliteHealthReport {
  readonly quickCheck: 'ok';
  readonly foreignKeyViolationCount: number;
  readonly foreignKeysEnabled: boolean;
  readonly journalMode: string;
  readonly schema: SchemaInspection;
}

export const checkSqliteHealth = (
  database: DatabaseExecutor,
  correlationId: CorrelationId
): Result<SqliteHealthReport, AppError> => {
  try {
    const quickCheckRow = database.prepare('PRAGMA quick_check').get() as
      | { readonly quick_check?: unknown }
      | undefined;
    if (String(quickCheckRow?.quick_check ?? '') !== 'ok') {
      return err(createAppError({
        code: ERROR_CODES.DATABASE_INTEGRITY_FAILED,
        message: 'SQLite quick_check bütünlük kontrolü başarısız.',
        category: 'infrastructure',
        correlationId,
        details: { result: quickCheckRow?.quick_check ?? '<empty>' }
      }));
    }
    const foreignKeyViolations = database.prepare('PRAGMA foreign_key_check').all();
    if (foreignKeyViolations.length > 0) {
      return err(createAppError({
        code: ERROR_CODES.DATABASE_FOREIGN_KEY_FAILED,
        message: 'SQLite foreign key kontrolünde ihlal bulundu.',
        category: 'infrastructure',
        correlationId,
        details: { violationCount: foreignKeyViolations.length }
      }));
    }
    const foreignKeysRow = database.prepare('PRAGMA foreign_keys').get() as
      | { readonly foreign_keys?: unknown }
      | undefined;
    const journalModeRow = database.prepare('PRAGMA journal_mode').get() as
      | { readonly journal_mode?: unknown }
      | undefined;
    return ok(Object.freeze({
      quickCheck: 'ok' as const,
      foreignKeyViolationCount: 0,
      foreignKeysEnabled: Number(foreignKeysRow?.foreign_keys ?? 0) === 1,
      journalMode: String(journalModeRow?.journal_mode ?? ''),
      schema: inspectDatabaseSchema(database)
    }));
  } catch (error) {
    return err(mapSqliteError(error, correlationId));
  }
};

export interface SqliteRuntimeHealthReport {
  readonly integrityOk: boolean;
  readonly journalMode: string;
}

export const inspectSqliteRuntimeHealth = (
  database: DatabaseExecutor,
  correlationId: CorrelationId
): Result<SqliteRuntimeHealthReport, AppError> => {
  try {
    const integrityRows = database.prepare('PRAGMA integrity_check').all() as Array<Record<string, unknown>>;
    const integrityOk = integrityRows.every((row) => Object.values(row).some((value) => String(value).toLowerCase() === 'ok'));
    const journalRow = database.prepare('PRAGMA journal_mode').get() as Record<string, unknown> | undefined;
    return ok(Object.freeze({
      integrityOk,
      journalMode: String(journalRow ? Object.values(journalRow)[0] : 'unknown')
    }));
  } catch (error) {
    return err(mapSqliteError(error, correlationId));
  }
};
