import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { asIsoDateTime, type Clock } from '@ppt/core';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';

const clock: Clock = { now: () => asIsoDateTime('2026-08-16T00:30:00.000Z') };
const runtimes: SqliteFamilyDatabaseRuntime[] = []; const directories: string[] = [];
afterEach(() => { for (const runtime of runtimes.splice(0)) runtime.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
const open = () => { const directory = mkdtempSync(join(tmpdir(), 'ppt-34g-repository-')); directories.push(directory);
  const runtime = new SqliteFamilyDatabaseRuntime({ databasePath: join(directory, 'family.db'),
    applicationVersion: '34-g-repository-vitest', clock, skipFileMigrationSafetyBackup: true,
    databaseConfig: { busyTimeoutMs: 5000, journalMode: 'WAL', synchronous: 'FULL' } });
  runtimes.push(runtime); return runtime; };

describe('34-G communication file sharing repository and migration boundary', () => {
  it('owns migration 111 with a snapshot table and immutable receipt ledger', () => {
    const runtime = open();
    expect(runtime.database.prepare("SELECT value FROM database_metadata WHERE key='schema_generation'").get())
      .toEqual({ value: 'REVISION-34-K-WINDOWS-RESILIENCE-UNIVERSAL-UX' });
    expect(FAMILY_DATABASE_MIGRATIONS.find((migration) => migration.version === 111)).toMatchObject({ version: 111,
      name: 'communication_file_sharing_remaining_ux' });
    const tables = runtime.database.prepare(`SELECT name FROM sqlite_master WHERE type='table'
      AND name LIKE 'communication_file_sharing_%' ORDER BY name`).all() as Array<{name:string}>;
    expect(tables.map((row) => row.name)).toEqual(['communication_file_sharing_centers','communication_file_sharing_mutations']);
    const triggerSql = (runtime.database.prepare(`SELECT sql FROM sqlite_master WHERE type='trigger'
      AND name LIKE 'trg_34g_%' ORDER BY name`).all() as Array<{sql:string}>).map((row) => row.sql).join('\n');
    expect(triggerSql).toContain('34-G mutation ledger is immutable');
    expect(triggerSql).toContain('exact next mutation receipt');
  });

  it('keeps file bytes, plaintext, keys and external URLs outside SQLite', () => {
    const runtime = open();
    const columns = (runtime.database.prepare(`SELECT m.name table_name,p.name column_name FROM sqlite_master m,
      pragma_table_info(m.name) p WHERE m.type='table' AND m.name LIKE 'communication_file_sharing_%'
      ORDER BY m.name,p.cid`).all() as Array<{table_name:string;column_name:string}>).map((row) => `${row.table_name}.${row.column_name}`);
    expect(columns).toContain('communication_file_sharing_centers.snapshot_json');
    expect(columns.join('\n')).not.toMatch(/file_bytes|plaintext|ciphertext|private_key|secret|external_url|access_code/iu);
    const source = readFileSync('packages/repositories/src/communication-file-sharing-repository.ts','utf8');
    expect(source).toContain('Communication file sharing optimistic revision conflict');
    expect(source).toContain('mutation quota exceeded');
  });
});
