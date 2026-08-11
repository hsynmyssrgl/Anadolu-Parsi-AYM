import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type {
  DatabaseConnection,
  DatabaseExecutor
} from '@ppt/contracts';

export type {
  DatabaseConnection,
  DatabaseExecutor,
  DatabaseStatement,
  StatementRunResult,
  TransactionContext,
  TransactionExecutor
} from '@ppt/contracts';
import {
  ERROR_CODES,
  asIsoDateTime,
  asSha256,
  createAppError,
  err,
  ok,
  type AppError,
  type Clock,
  type CorrelationId,
  type IsoDateTime,
  type Result,
  type Sha256
} from '@ppt/core';

export interface MigrationDefinition {
  readonly version: number;
  readonly name: string;
  readonly checksum: Sha256;
  readonly sql: string;
}

export interface MigrationRecord {
  readonly version: number;
  readonly name: string;
  readonly checksum: Sha256;
  readonly appliedAt: IsoDateTime;
  readonly durationMs: number;
  readonly applicationVersion: string;
  readonly success: boolean;
  readonly adopted: boolean;
}

export interface SchemaColumnSnapshot {
  readonly name: string;
  readonly type: string;
  readonly notNull: number;
  readonly defaultValue: string | null;
  readonly primaryKey: number;
}

export interface SchemaTableSnapshot {
  readonly name: string;
  readonly columns: readonly SchemaColumnSnapshot[];
}

export interface SchemaInspection {
  readonly tables: readonly SchemaTableSnapshot[];
  readonly tableCount: number;
  readonly columnCount: number;
  readonly fingerprint: Sha256;
}

export interface KnownLegacyBaseline {
  readonly name: string;
  readonly fingerprint: Sha256;
  readonly adoptThroughVersion: number;
}

export interface MigrationSafetyBackup {
  readonly databasePath: string;
  readonly backupPath: string;
  readonly manifestPath: string;
  readonly sha256: Sha256;
  readonly sizeBytes: number;
  readonly createdAt: IsoDateTime;
}

export interface MigrationRunSummary {
  readonly applicationVersion: string;
  readonly adoptedBaseline?: string;
  readonly appliedVersions: readonly number[];
  readonly adoptedVersions: readonly number[];
  readonly alreadyAppliedVersions: readonly number[];
  readonly safetyBackup?: MigrationSafetyBackup;
  readonly schemaBefore: SchemaInspection;
  readonly schemaAfter: SchemaInspection;
  readonly quickCheck: 'ok';
  readonly foreignKeyViolationCount: number;
}

export interface MigrationRunnerOptions {
  readonly database: DatabaseExecutor;
  readonly migrations: readonly MigrationDefinition[];
  readonly applicationVersion: string;
  readonly correlationId: CorrelationId;
  readonly clock: Clock;
  readonly knownLegacyBaselines?: readonly KnownLegacyBaseline[];
  readonly createSafetyBackup?: () => MigrationSafetyBackup;
}

const infrastructureTables = new Set(['schema_migrations', 'database_metadata', 'event_outbox', 'event_handler_receipts']);

const quoteIdentifier = (identifier: string): string => `"${identifier.replaceAll('"', '""')}"`;

const normalizeSql = (sql: string): string => sql.replace(/\r\n/g, '\n').trim() + '\n';

export const createMigrationDefinition = (
  version: number,
  name: string,
  sql: string
): MigrationDefinition => {
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('Migration version pozitif tam sayı olmalıdır.');
  const normalized = normalizeSql(sql);
  return Object.freeze({
    version,
    name,
    sql: normalized,
    checksum: asSha256(createHash('sha256').update(normalized).digest('hex'))
  });
};

const listApplicationTableNames = (database: DatabaseExecutor): readonly string[] => (
  database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all() as ReadonlyArray<{ readonly name: string }>
)
  .map((row) => row.name)
  .filter((name) => !infrastructureTables.has(name));

export const inspectDatabaseSchema = (database: DatabaseExecutor): SchemaInspection => {
  const tables = listApplicationTableNames(database).map((name): SchemaTableSnapshot => {
    const columns = (
      database.prepare(`PRAGMA table_info(${quoteIdentifier(name)})`).all() as ReadonlyArray<{
        readonly name: string;
        readonly type: string;
        readonly notnull: number;
        readonly dflt_value: unknown;
        readonly pk: number;
      }>
    ).map((column): SchemaColumnSnapshot => ({
      name: column.name,
      type: column.type,
      notNull: Number(column.notnull),
      defaultValue: column.dflt_value === null || column.dflt_value === undefined
        ? null
        : String(column.dflt_value),
      primaryKey: Number(column.pk)
    }));
    return Object.freeze({ name, columns: Object.freeze(columns) });
  });
  const canonical = JSON.stringify(tables);
  return Object.freeze({
    tables: Object.freeze(tables),
    tableCount: tables.length,
    columnCount: tables.reduce((sum, table) => sum + table.columns.length, 0),
    fingerprint: asSha256(createHash('sha256').update(canonical).digest('hex'))
  });
};

const migrationTableSql = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  application_version TEXT NOT NULL,
  success INTEGER NOT NULL,
  adopted INTEGER NOT NULL DEFAULT 0
) STRICT;
`;

const readMigrationRecords = (database: DatabaseExecutor): readonly MigrationRecord[] => (
  database.prepare(
    'SELECT version,name,checksum,applied_at,duration_ms,application_version,success,adopted FROM schema_migrations ORDER BY version'
  ).all() as ReadonlyArray<Record<string, unknown>>
).map((row): MigrationRecord => ({
  version: Number(row.version),
  name: String(row.name),
  checksum: asSha256(String(row.checksum)),
  appliedAt: asIsoDateTime(String(row.applied_at)),
  durationMs: Number(row.duration_ms),
  applicationVersion: String(row.application_version),
  success: Boolean(row.success),
  adopted: Boolean(row.adopted)
}));

const appError = (
  options: MigrationRunnerOptions,
  code: keyof typeof ERROR_CODES,
  message: string,
  details?: Readonly<Record<string, unknown>>
): AppError => createAppError({
  code: ERROR_CODES[code],
  message,
  category: code.startsWith('MIGRATION_') ? 'infrastructure' : 'infrastructure',
  correlationId: options.correlationId,
  ...(details === undefined ? {} : { details })
});

const tableExists = (database: DatabaseExecutor, tableName: string): boolean => {
  const row = database.prepare(
    "SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name=? LIMIT 1"
  ).get(tableName) as { readonly present?: unknown } | undefined;
  return Number(row?.present ?? 0) === 1;
};

export class SqliteMigrationRunner {
  public run(options: MigrationRunnerOptions): Result<MigrationRunSummary, AppError> {
    const ordered = [...options.migrations].sort((left, right) => left.version - right.version);
    const duplicateVersion = ordered.find(
      (migration, index) => index > 0 && ordered[index - 1]?.version === migration.version
    );
    if (duplicateVersion) {
      return err(appError(options, 'MIGRATION_FAILED', `Tekrarlanan migration sürümü: ${duplicateVersion.version}`));
    }

    const schemaBefore = inspectDatabaseSchema(options.database);
    const migrationTableAlreadyExists = tableExists(options.database, 'schema_migrations');
    let safetyBackup: MigrationSafetyBackup | undefined;
    let matchedLegacyBaseline: KnownLegacyBaseline | undefined;

    try {
      if (!migrationTableAlreadyExists && schemaBefore.tableCount > 0) {
        matchedLegacyBaseline = options.knownLegacyBaselines?.find(
          (item) => item.fingerprint === schemaBefore.fingerprint
        );
        if (!matchedLegacyBaseline) {
          return err(appError(
            options,
            'MIGRATION_UNKNOWN_BASELINE',
            'Mevcut SQLite şeması bilinen Bronze baseline ile eşleşmiyor; otomatik migration durduruldu.',
            {
              fingerprint: schemaBefore.fingerprint,
              tableCount: schemaBefore.tableCount,
              columnCount: schemaBefore.columnCount
            }
          ));
        }
        if (options.createSafetyBackup) safetyBackup = options.createSafetyBackup();
      }

      options.database.exec(migrationTableSql);
      let records = readMigrationRecords(options.database);
      const knownVersions = new Set(ordered.map((migration) => migration.version));
      const unknownRecord = records.find((record) => !knownVersions.has(record.version));
      if (unknownRecord) {
        return err(appError(
          options,
          'MIGRATION_UNKNOWN_VERSION',
          'Veritabanında uygulamanın tanımadığı migration sürümü bulundu.',
          { version: unknownRecord.version }
        ));
      }

      for (const record of records) {
        const definition = ordered.find((migration) => migration.version === record.version);
        if (!definition || record.checksum !== definition.checksum) {
          return err(appError(
            options,
            'MIGRATION_CHECKSUM_MISMATCH',
            'Uygulanmış migration checksum değeri değişmiş.',
            {
              version: record.version,
              storedChecksum: record.checksum,
              expectedChecksum: definition?.checksum ?? '<missing>'
            }
          ));
        }
        if (!record.success) {
          return err(appError(
            options,
            'MIGRATION_FAILED',
            'Başarısız işaretlenmiş migration kaydı bulundu.',
            { version: record.version }
          ));
        }
      }

      let adoptedBaseline: string | undefined;
      const adoptedVersions: number[] = [];
      if (records.length === 0 && matchedLegacyBaseline) {
        adoptedBaseline = matchedLegacyBaseline.name;
        const adoptable = ordered.filter(
          (migration) => migration.version <= matchedLegacyBaseline!.adoptThroughVersion
        );
        options.database.exec('BEGIN IMMEDIATE');
        try {
          const statement = options.database.prepare(
            'INSERT INTO schema_migrations(version,name,checksum,applied_at,duration_ms,application_version,success,adopted) VALUES(?,?,?,?,?,?,1,1)'
          );
          for (const migration of adoptable) {
            statement.run(
              migration.version,
              migration.name,
              migration.checksum,
              options.clock.now(),
              0,
              options.applicationVersion
            );
            adoptedVersions.push(migration.version);
          }
          options.database.exec('COMMIT');
        } catch (error) {
          options.database.exec('ROLLBACK');
          throw error;
        }
        records = readMigrationRecords(options.database);
      }

      const appliedBeforeRun = new Set(records.map((record) => record.version));
      const pending = ordered.filter((migration) => !appliedBeforeRun.has(migration.version));
      if (
        pending.length > 0 &&
        schemaBefore.tableCount > 0 &&
        safetyBackup === undefined &&
        options.createSafetyBackup
      ) {
        safetyBackup = options.createSafetyBackup();
      }

      const appliedVersions: number[] = [];
      for (const migration of pending) {
        const startedAt = Date.now();
        options.database.exec('BEGIN IMMEDIATE');
        try {
          options.database.exec(migration.sql);
          options.database.prepare(
            'INSERT INTO schema_migrations(version,name,checksum,applied_at,duration_ms,application_version,success,adopted) VALUES(?,?,?,?,?,?,1,0)'
          ).run(
            migration.version,
            migration.name,
            migration.checksum,
            options.clock.now(),
            Math.max(0, Date.now() - startedAt),
            options.applicationVersion
          );
          options.database.exec('COMMIT');
          appliedVersions.push(migration.version);
        } catch (error) {
          options.database.exec('ROLLBACK');
          return err(appError(
            options,
            'MIGRATION_FAILED',
            `Migration uygulanamadı: ${migration.version} ${migration.name}`,
            {
              version: migration.version,
              errorName: error instanceof Error ? error.name : typeof error
            }
          ));
        }
      }

      const quickCheckRow = options.database.prepare('PRAGMA quick_check').get() as
        | { readonly quick_check?: unknown }
        | undefined;
      if (String(quickCheckRow?.quick_check ?? '') !== 'ok') {
        return err(appError(
          options,
          'DATABASE_INTEGRITY_FAILED',
          'Migration sonrası SQLite quick_check başarısız.',
          { result: quickCheckRow?.quick_check ?? '<empty>' }
        ));
      }
      const foreignKeyViolations = options.database.prepare('PRAGMA foreign_key_check').all();
      if (foreignKeyViolations.length > 0) {
        return err(appError(
          options,
          'DATABASE_FOREIGN_KEY_FAILED',
          'Migration sonrası foreign key ihlali bulundu.',
          { violationCount: foreignKeyViolations.length }
        ));
      }

      const schemaAfter = inspectDatabaseSchema(options.database);
      const recordsAfter = readMigrationRecords(options.database);
      const summaryBase = {
        applicationVersion: options.applicationVersion,
        appliedVersions: Object.freeze(appliedVersions),
        adoptedVersions: Object.freeze(adoptedVersions),
        alreadyAppliedVersions: Object.freeze(
          recordsAfter
            .filter((record) => !appliedVersions.includes(record.version) && !adoptedVersions.includes(record.version))
            .map((record) => record.version)
        ),
        schemaBefore,
        schemaAfter,
        quickCheck: 'ok' as const,
        foreignKeyViolationCount: 0
      };
      return ok(Object.freeze({
        ...summaryBase,
        ...(adoptedBaseline === undefined ? {} : { adoptedBaseline }),
        ...(safetyBackup === undefined ? {} : { safetyBackup })
      }));
    } catch (error) {
      return err(appError(
        options,
        'MIGRATION_FAILED',
        'Migration runner beklenmeyen bir hatayla durdu.',
        { errorName: error instanceof Error ? error.name : typeof error }
      ));
    }
  }
}

export interface CreateSqliteSafetyBackupInput {
  readonly database: DatabaseExecutor;
  readonly databasePath: string;
  readonly backupDirectory: string;
  readonly applicationVersion: string;
  readonly clock: Clock;
}

const safeFilePart = (value: string): string => value.replace(/[^A-Za-z0-9._-]+/g, '-');

export const createSqliteSafetyBackup = (
  input: CreateSqliteSafetyBackupInput
): MigrationSafetyBackup => {
  if (!existsSync(input.databasePath)) throw new Error('Migration safety backup için SQLite dosyası bulunamadı.');
  mkdirSync(input.backupDirectory, { recursive: true });
  input.database.exec('PRAGMA wal_checkpoint(FULL)');
  const createdAt = input.clock.now();
  const stamp = safeFilePart(String(createdAt));
  const version = safeFilePart(input.applicationVersion);
  const baseName = `${basename(input.databasePath)}.pre-migration-${version}-${stamp}`;
  const backupPath = join(input.backupDirectory, `${baseName}.db`);
  copyFileSync(input.databasePath, backupPath);
  const bytes = readFileSync(backupPath);
  const sha256 = asSha256(createHash('sha256').update(bytes).digest('hex'));
  const evidence: MigrationSafetyBackup = Object.freeze({
    databasePath: input.databasePath,
    backupPath,
    manifestPath: join(input.backupDirectory, `${baseName}.json`),
    sha256,
    sizeBytes: statSync(backupPath).size,
    createdAt
  });
  writeFileSync(evidence.manifestPath, JSON.stringify({
    schemaVersion: 1,
    kind: 'pre-migration-safety-backup',
    applicationVersion: input.applicationVersion,
    sourceDatabase: input.databasePath,
    backupPath,
    sha256,
    sizeBytes: evidence.sizeBytes,
    createdAt
  }, null, 2) + '\n', { mode: 0o600 });
  return evidence;
};

export const defaultMigrationBackupDirectory = (databasePath: string): string => (
  join(dirname(databasePath), 'migration-backups')
);
