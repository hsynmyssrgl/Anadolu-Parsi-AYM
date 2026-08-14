import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Clock } from '@ppt/core';
import {
  applySqliteStartupPragmas,
  openSqliteDatabase,
  SqliteTransactionExecutor,
  runFamilyDatabaseMigrations,
  type MigrationRunSummary
} from '@ppt/database';
import type { AsyncTransactionExecutor, DatabaseConnection } from '@ppt/contracts';

export interface SqliteFamilyDatabaseRuntimeOptions {
  readonly databasePath: string;
  readonly databaseConnection?: DatabaseConnection;
  readonly closeDatabaseOnClose?: boolean;
  readonly skipFileMigrationSafetyBackup?: boolean;
  readonly applicationVersion: string;
  readonly clock: Clock;
  readonly databaseConfig?: {
    readonly busyTimeoutMs: number;
    readonly journalMode: 'WAL';
    readonly synchronous: 'NORMAL' | 'FULL';
  };
  readonly migrationBackupDirectory?: string;
  readonly onMigrationCompleted?: (summary: MigrationRunSummary) => void;
}

export class SqliteFamilyDatabaseRuntime {
  public readonly database: DatabaseConnection;
  public readonly transactionExecutor: AsyncTransactionExecutor;
  private readonly closeDatabaseOnClose: boolean;

  public constructor(options: SqliteFamilyDatabaseRuntimeOptions) {
    mkdirSync(dirname(options.databasePath), { recursive: true });
    this.database = options.databaseConnection ?? openSqliteDatabase(options.databasePath);
    this.closeDatabaseOnClose = options.closeDatabaseOnClose ?? options.databaseConnection === undefined;
    applySqliteStartupPragmas(this.database, options.databaseConfig ?? {
      busyTimeoutMs: 5_000,
      journalMode: 'WAL',
      synchronous: 'NORMAL'
    });

    const migrationSummary = runFamilyDatabaseMigrations({
      database: this.database,
      databasePath: options.databasePath,
      applicationVersion: options.applicationVersion,
      ...(options.migrationBackupDirectory === undefined
        ? {}
        : { backupDirectory: options.migrationBackupDirectory }),
      ...(options.skipFileMigrationSafetyBackup === undefined
        ? {}
        : { skipFileSafetyBackup: options.skipFileMigrationSafetyBackup })
    });
    options.onMigrationCompleted?.(migrationSummary);
    this.transactionExecutor = new SqliteTransactionExecutor(this.database, options.clock);
  }

  public close(): void {
    try { this.database.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch { /* Best effort before encrypted session sealing. */ }
    if (this.closeDatabaseOnClose) this.database.close();
  }
}
