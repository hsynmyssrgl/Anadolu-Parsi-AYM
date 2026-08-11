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
import { openSqliteDatabase } from './sqlite.js';

const integrityRowsAreValid = (rows: readonly Record<string, unknown>[]): boolean =>
  rows.length > 0 && rows.every((row) =>
    Object.values(row).some((value) => String(value).toLowerCase() === 'ok')
  );

export interface RestoredDatabaseReauthorizationSummary {
  readonly revokedTrustedDeviceCount: number;
  readonly trustedDeviceTablePresent: boolean;
}

export const checkpointSqliteForBackup = (
  database: DatabaseExecutor,
  correlationId: CorrelationId
): Result<void, AppError> => {
  try {
    database.exec('PRAGMA wal_checkpoint(FULL)');
    return ok(undefined);
  } catch (error) {
    return err(mapSqliteError(error, correlationId));
  }
};

export const verifySqliteBackupFileIntegrity = (
  databasePath: string,
  correlationId: CorrelationId
): Result<void, AppError> => {
  let database: ReturnType<typeof openSqliteDatabase> | undefined;
  try {
    database = openSqliteDatabase(databasePath, { readOnly: true });
    const rows = database.prepare('PRAGMA integrity_check').all() as Array<Record<string, unknown>>;
    if (!integrityRowsAreValid(rows)) {
      return err(createAppError({
        code: ERROR_CODES.DATABASE_INTEGRITY_FAILED,
        message: 'Yedek veritabanı bütünlük kontrolünü geçemedi.',
        category: 'infrastructure',
        correlationId,
        details: { databasePath, rowCount: rows.length }
      }));
    }
    return ok(undefined);
  } catch (error) {
    return err(mapSqliteError(error, correlationId));
  } finally {
    database?.close();
  }
};

/**
 * Geri yüklenen veritabanının eski cihaz güvenlerini yeni makineye taşımamasını sağlar.
 * İşlem yalnız staged kopya üzerinde çalışır; canlı veritabanına commit öncesinde uygulanır.
 */
export const prepareSqliteRestoredDatabaseForReauthorization = (
  databasePath: string,
  restoredAt: string,
  correlationId: CorrelationId
): Result<RestoredDatabaseReauthorizationSummary, AppError> => {
  let database: ReturnType<typeof openSqliteDatabase> | undefined;
  try {
    if (Number.isNaN(Date.parse(restoredAt))) {
      return err(createAppError({
        code: ERROR_CODES.CORE_INVALID_ARGUMENT,
        message: 'Geri yükleme zamanı geçersizdir.',
        category: 'validation',
        correlationId
      }));
    }

    database = openSqliteDatabase(databasePath);
    database.exec('PRAGMA foreign_keys=ON');
    database.exec('BEGIN IMMEDIATE');
    try {
      const trustedDeviceTable = database.prepare(
        "SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='trusted_devices' LIMIT 1"
      ).get() as { present?: number } | undefined;
      const trustedDeviceTablePresent = trustedDeviceTable?.present === 1;
      let revokedTrustedDeviceCount = 0;

      if (trustedDeviceTablePresent) {
        const countRow = database.prepare(
          'SELECT COUNT(*) AS count FROM trusted_devices WHERE revoked_at IS NULL'
        ).get() as { count?: number | bigint } | undefined;
        revokedTrustedDeviceCount = Number(countRow?.count ?? 0);
        database.prepare(
          'UPDATE trusted_devices SET revoked_at=? WHERE revoked_at IS NULL'
        ).run(restoredAt);
      }

      const metadataTable = database.prepare(
        "SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='database_metadata' LIMIT 1"
      ).get() as { present?: number } | undefined;
      if (metadataTable?.present === 1) {
        const upsert = database.prepare(`
          INSERT INTO database_metadata(key,value,updated_at)
          VALUES(?,?,?)
          ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
        `);
        upsert.run('restore_reauthorization_required', '1', restoredAt);
        upsert.run('last_full_restore_at', restoredAt, restoredAt);
      }

      database.exec('COMMIT');
      database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      return ok({ revokedTrustedDeviceCount, trustedDeviceTablePresent });
    } catch (error) {
      try { database.exec('ROLLBACK'); } catch {}
      throw error;
    }
  } catch (error) {
    return err(mapSqliteError(error, correlationId));
  } finally {
    database?.close();
  }
};
