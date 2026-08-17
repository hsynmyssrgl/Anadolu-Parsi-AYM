import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  FixedClock,
  SystemClock,
  ERROR_CODES,
  asCorrelationId,
  asIsoDateTime,
  createAppError,
  err,
  ok
} from '../packages/core/dist/index.js';
import {
  SqliteMigrationRunner,
  SqliteTransactionExecutor,
  checkSqliteHealth,
  createMigrationDefinition,
  inspectDatabaseSchema,
  FAMILY_DATABASE_MIGRATIONS,
  LEGACY_MVP40_SCHEMA_FINGERPRINT,
  FamilyDatabaseMigrationError,
  runFamilyDatabaseMigrations
} from '../packages/database/dist/index.js';

const noWrite = process.argv.includes('--no-write');
const root = mkdtempSync(join(tmpdir(), 'panthera-mvp44-migrations-'));
const checks = [];
const expectedVersions = FAMILY_DATABASE_MIGRATIONS.map((migration) => migration.version);
const expectedRecords = (adoptedThrough = 0) => expectedVersions.map((version) => ({
  version,
  adopted: version <= adoptedThrough ? 1 : 0
}));
const verify = (name, operation) => {
  operation();
  checks.push(name);
};
const hasTable = (database, name) => Boolean(database.prepare(
  "SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name=? LIMIT 1"
).get(name));
const open = (name) => {
  const path = join(root, name);
  const database = new DatabaseSync(path);
  database.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  return { database, path };
};

try {
  verify('fresh database applies all migrations', () => {
    const { database, path } = open('fresh.db');
    try {
      const result = runFamilyDatabaseMigrations({
        database,
        databasePath: path,
        applicationVersion: ACTIVE_BUILD_META.applicationVersion
      });
      assert.deepEqual(result.appliedVersions, expectedVersions);
      assert.deepEqual(result.adoptedVersions, []);
      assert.equal(result.schemaAfter.tableCount >= 42, true);
      assert.equal(hasTable(database, 'schema_migrations'), true);
      assert.equal(hasTable(database, 'database_metadata'), true);
      assert.equal(hasTable(database, 'households'), true);
      assert.equal(hasTable(database, 'family_branches'), true);
      assert.equal(hasTable(database, 'person_memberships'), true);
      const records = database.prepare('SELECT version,adopted FROM schema_migrations ORDER BY version').all().map((row) => ({ version: Number(row.version), adopted: Number(row.adopted) }));
      assert.deepEqual(records, expectedRecords());
      assert.equal(result.safetyBackup, undefined);
    } finally {
      database.close();
    }
  });

  verify('second run is idempotent', () => {
    const path = join(root, 'fresh.db');
    const database = new DatabaseSync(path);
    try {
      const result = runFamilyDatabaseMigrations({
        database,
        databasePath: path,
        applicationVersion: ACTIVE_BUILD_META.applicationVersion
      });
      assert.deepEqual(result.appliedVersions, []);
      assert.deepEqual(result.adoptedVersions, []);
      assert.deepEqual(result.alreadyAppliedVersions, expectedVersions);
      assert.equal(result.quickCheck, 'ok');
    } finally {
      database.close();
    }
  });

  verify('known legacy baseline is adopted after pre-migration backup', () => {
    const { database, path } = open('legacy.db');
    const backupDirectory = join(root, 'legacy-backups');
    try {
      database.exec(FAMILY_DATABASE_MIGRATIONS[0].sql);
      database.exec(FAMILY_DATABASE_MIGRATIONS[1].sql);
      const before = inspectDatabaseSchema(database);
      assert.equal(before.fingerprint, LEGACY_MVP40_SCHEMA_FINGERPRINT);
      const result = runFamilyDatabaseMigrations({
        database,
        databasePath: path,
        applicationVersion: ACTIVE_BUILD_META.applicationVersion,
        backupDirectory
      });
      assert.equal(result.adoptedBaseline, 'Bronze MVP-40/MVP-42 legacy schema');
      assert.deepEqual(result.adoptedVersions, [1, 2]);
      assert.deepEqual(result.appliedVersions, expectedVersions.slice(2));
      assert.ok(result.safetyBackup);
      assert.equal(existsSync(result.safetyBackup.backupPath), true);
      assert.equal(existsSync(result.safetyBackup.manifestPath), true);
      const bytes = readFileSync(result.safetyBackup.backupPath);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), result.safetyBackup.sha256);
      const backupProbe = new DatabaseSync(result.safetyBackup.backupPath, { readOnly: true });
      try {
        assert.equal(hasTable(backupProbe, 'schema_migrations'), false, 'Safety backup migration mutasyonundan önce alınmalıdır.');
      } finally {
        backupProbe.close();
      }
      const records = database.prepare('SELECT version,adopted FROM schema_migrations ORDER BY version').all().map((row) => ({ version: Number(row.version), adopted: Number(row.adopted) }));
      assert.deepEqual(records, expectedRecords(2));
    } finally {
      database.close();
    }
  });

  verify('unknown legacy baseline stops without mutation', () => {
    const { database, path } = open('unknown.db');
    try {
      database.exec('CREATE TABLE unrecognized_table(id TEXT PRIMARY KEY, payload TEXT);');
      assert.throws(
        () => runFamilyDatabaseMigrations({
          database,
          databasePath: path,
          applicationVersion: ACTIVE_BUILD_META.applicationVersion
        }),
        (error) => error instanceof FamilyDatabaseMigrationError && error.code === ERROR_CODES.MIGRATION_UNKNOWN_BASELINE
      );
      assert.equal(hasTable(database, 'schema_migrations'), false);
      assert.equal(hasTable(database, 'unrecognized_table'), true);
    } finally {
      database.close();
    }
  });

  verify('checksum mismatch blocks startup', () => {
    const path = join(root, 'fresh.db');
    const database = new DatabaseSync(path);
    try {
      database.prepare("UPDATE schema_migrations SET checksum='tampered' WHERE version=2").run();
      assert.throws(
        () => runFamilyDatabaseMigrations({
          database,
          databasePath: path,
          applicationVersion: ACTIVE_BUILD_META.applicationVersion
        }),
        (error) => error instanceof FamilyDatabaseMigrationError && error.code === ERROR_CODES.MIGRATION_CHECKSUM_MISMATCH
      );
    } finally {
      database.close();
    }
  });

  verify('database health report confirms WAL and foreign keys', () => {
    const { database } = open('health.db');
    try {
      database.exec('CREATE TABLE health_probe(id TEXT PRIMARY KEY);');
      const result = checkSqliteHealth(database, asCorrelationId('database-health-test'));
      assert.equal(result.ok, true);
      if (!result.ok) throw new Error(result.error.message);
      assert.equal(result.value.quickCheck, 'ok');
      assert.equal(result.value.foreignKeysEnabled, true);
      assert.equal(result.value.journalMode.toLowerCase(), 'wal');
      assert.equal(result.value.schema.tableCount, 1);
    } finally {
      database.close();
    }
  });

  verify('transaction executor commits success and rolls back Result error', () => {
    const { database } = open('transaction.db');
    try {
      database.exec('CREATE TABLE transaction_probe(id TEXT PRIMARY KEY, value TEXT NOT NULL);');
      const executor = new SqliteTransactionExecutor(database, new SystemClock());
      const correlationId = asCorrelationId('transaction-test');
      const success = executor.execute(correlationId, () => {
        database.prepare('INSERT INTO transaction_probe(id,value) VALUES(?,?)').run('ok', 'committed');
        return ok('committed');
      });
      assert.deepEqual(success, { ok: true, value: 'committed' });
      const rejected = executor.execute(correlationId, () => {
        database.prepare('INSERT INTO transaction_probe(id,value) VALUES(?,?)').run('rollback', 'discarded');
        return err(createAppError({
          code: ERROR_CODES.CORE_INVALID_ARGUMENT,
          message: 'Test validation rejection.',
          category: 'validation',
          correlationId
        }));
      });
      assert.equal(rejected.ok, false);
      assert.equal(database.prepare("SELECT COUNT(*) AS total FROM transaction_probe WHERE id='rollback'").get().total, 0);
      assert.equal(database.prepare("SELECT COUNT(*) AS total FROM transaction_probe WHERE id='ok'").get().total, 1);
    } finally {
      database.close();
    }
  });

  verify('transaction executor maps unique constraint errors', () => {
    const { database } = open('transaction-error.db');
    try {
      database.exec("CREATE TABLE unique_probe(id TEXT PRIMARY KEY); INSERT INTO unique_probe(id) VALUES('same');");
      const executor = new SqliteTransactionExecutor(database, new SystemClock());
      const result = executor.execute(asCorrelationId('transaction-unique-test'), () => {
        database.prepare('INSERT INTO unique_probe(id) VALUES(?)').run('same');
        return ok(undefined);
      });
      assert.equal(result.ok, false);
      if (result.ok) throw new Error('Unique constraint testi beklenmedik biçimde başarılı oldu.');
      assert.equal(result.error.code, ERROR_CODES.RESOURCE_CONFLICT);
    } finally {
      database.close();
    }
  });

  verify('failed migration rolls back schema and record', () => {
    const { database } = open('rollback.db');
    try {
      const clock = new FixedClock(asIsoDateTime('2026-07-23T12:00:00.000Z'));
      const runner = new SqliteMigrationRunner();
      const result = runner.run({
        database,
        migrations: [
          createMigrationDefinition(1, 'stable', 'CREATE TABLE stable_table(id TEXT PRIMARY KEY);'),
          createMigrationDefinition(2, 'rollback', 'CREATE TABLE rollback_probe(id TEXT); INSERT INTO missing_table(id) VALUES(1);')
        ],
        applicationVersion: ACTIVE_BUILD_META.applicationVersion,
        correlationId: asCorrelationId('migration-rollback-test'),
        clock
      });
      assert.equal(result.ok, false);
      if (result.ok) throw new Error('Rollback testi beklenmedik biçimde başarılı oldu.');
      assert.equal(result.error.code, ERROR_CODES.MIGRATION_FAILED);
      assert.equal(hasTable(database, 'stable_table'), true);
      assert.equal(hasTable(database, 'rollback_probe'), false);
      assert.deepEqual(database.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((row) => ({ version: Number(row.version) })), [{ version: 1 }]);
    } finally {
      database.close();
    }
  });

  const report = {
    schemaVersion: 1,
    product: 'Panthera pardus tulliana',
    version: ACTIVE_BUILD_META.applicationVersion,
    milestone: ACTIVE_BUILD_META.milestone,
    status: 'passed',
    checkCount: checks.length,
    checks,
    legacyFingerprint: LEGACY_MVP40_SCHEMA_FINGERPRINT,
    migrationVersions: FAMILY_DATABASE_MIGRATIONS.map((migration) => ({
      version: migration.version,
      name: migration.name,
      checksum: migration.checksum
    })),
    generatedAt: new Date().toISOString()
  };
  if (!noWrite) {
    mkdirSync('artifacts/manifests', { recursive: true });
    writeFileSync(
      'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
      JSON.stringify(report, null, 2) + '\n'
    );
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
