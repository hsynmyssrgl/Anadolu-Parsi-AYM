import { DatabaseSync } from 'node:sqlite';
import type { DatabaseConnection } from '@ppt/contracts';
export interface SqliteDatabaseOptions {
  readonly readOnly?: boolean;
}

export const openSqliteDatabase = (
  databasePath: string,
  options: SqliteDatabaseOptions = {}
): DatabaseConnection => new DatabaseSync(databasePath, options);

export const applySqliteStartupPragmas = (
  database: DatabaseConnection,
  config: { readonly busyTimeoutMs: number; readonly journalMode: 'WAL'; readonly synchronous: 'NORMAL' | 'FULL' }
): void => {
  const synchronous = config.synchronous === 'FULL' ? 'FULL' : 'NORMAL';
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = ${config.journalMode};
    PRAGMA busy_timeout = ${Math.trunc(config.busyTimeoutMs)};
    PRAGMA temp_store = MEMORY;
    PRAGMA synchronous = ${synchronous};
  `);
};
