import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { asIsoDateTime, type Clock } from '@ppt/core';
import { FAMILY_DATABASE_MIGRATIONS, FAMILY_DATABASE_SCHEMA_GENERATION } from '@ppt/database';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';

const NOW = asIsoDateTime('2026-08-15T18:00:00.000Z');
const clock: Clock = { now: () => NOW };
const runtimes: SqliteFamilyDatabaseRuntime[] = [];
const directories: string[] = [];
afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
const open = () => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-34f-repository-')); directories.push(directory);
  const runtime = new SqliteFamilyDatabaseRuntime({ databasePath: join(directory, 'family.db'),
    applicationVersion: '34-f-repository-vitest', clock, skipFileMigrationSafetyBackup: true,
    databaseConfig: { busyTimeoutMs: 5000, journalMode: 'WAL', synchronous: 'FULL' } });
  runtimes.push(runtime); return runtime;
};

describe('34-F family meeting repository and migration boundary', () => {
  it('owns migration 110 and the exact current plus append-only table set', () => {
    const runtime = open();
    const tables = (runtime.database.prepare(`SELECT name FROM sqlite_master WHERE type='table'
      AND (name='family_meetings' OR name LIKE 'family_meeting_%') ORDER BY name`).all() as Array<{name:string}>)
      .map((row) => row.name);
    expect(tables).toEqual([
      'family_meeting_agenda_items', 'family_meeting_collaboration_items', 'family_meeting_decisions',
      'family_meeting_events', 'family_meeting_minutes', 'family_meeting_mutations', 'family_meeting_participants',
      'family_meeting_polls', 'family_meeting_tasks', 'family_meeting_votes', 'family_meetings'
    ]);
    expect(runtime.database.prepare("SELECT value FROM database_metadata WHERE key='schema_generation'").get())
      .toEqual({ value: FAMILY_DATABASE_SCHEMA_GENERATION });
    expect(FAMILY_DATABASE_MIGRATIONS.find((migration) => migration.version === 110)).toMatchObject({ version: 110,
      name: 'family_meetings_decisions_consent_minutes', checksum: '8bcc5777aa80794122742bcfd73be036234488f5861adbcd34956c56e6d0d6ac' });
  });

  it('keeps plaintext minutes, transcript, recording bytes, keys, secrets and paths outside SQLite', () => {
    const runtime = open();
    const columns = (runtime.database.prepare(`SELECT m.name table_name,p.name column_name FROM sqlite_master m,
      pragma_table_info(m.name) p WHERE m.type='table' AND (m.name='family_meetings' OR m.name LIKE 'family_meeting_%')
      ORDER BY m.name,p.cid`).all() as Array<{table_name:string;column_name:string}>)
      .map((row) => `${row.table_name}.${row.column_name}`);
    expect(columns).toContain('family_meeting_minutes.sealed_payload_reference');
    expect(columns).toContain('family_meeting_minutes.participant_access_json');
    expect(columns).toContain('family_meeting_decisions.ledger_reference');
    expect(columns.join('\n')).not.toMatch(/minutes_text|summary_text|transcript_text|transcript_payload|recording_bytes|audio_bytes|video_bytes|plaintext|ciphertext|file_path|private_key|secret|token/iu);
  });

  it('pins exact family-personal PEP receipts, human approval and immutable vote, decision and event ledgers', () => {
    const runtime = open();
    const triggers = runtime.database.prepare(`SELECT name,sql FROM sqlite_master WHERE type='trigger'
      AND name LIKE 'trg_34f_%' ORDER BY name`).all() as Array<{name:string;sql:string}>;
    const sql = triggers.map((row) => row.sql).join('\n');
    expect(triggers.length).toBeGreaterThanOrEqual(30);
    for (const marker of ["sensitivity')='personal'", "purpose')='general'",
      '34-F vote ledger is immutable', '34-F decision ledger is immutable', '34-F event ledger is immutable'])
      expect(sql).toContain(marker);
    const minutes = (runtime.database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='family_meeting_minutes'")
      .get() as {sql:string}).sql;
    expect(minutes).toContain("state='sealed_local'");
    expect(minutes).toContain('human_approval_recorded=1');
    expect(minutes).toContain('network_used INTEGER NOT NULL CHECK(network_used=0)');
    expect(minutes).toContain('cloud_used INTEGER NOT NULL CHECK(cloud_used=0)');
  });

  it('keeps policy resolution payload-free and binds every write to the exact durable receipt', () => {
    const source = readFileSync('packages/repositories/src/family-meeting-repository.ts', 'utf8');
    expect(source).toContain("platformPolicyPersistenceBinding(context, 'family_meeting', row.resourceId)");
    expect(source).toContain("platformPolicyPersistenceBinding(context, 'family_meeting', meetingId)");
    const resolver = source.slice(source.indexOf('public resolvePolicyResource'), source.indexOf('public loadCenter'));
    expect(resolver).toContain('WHERE id=?');
    expect(resolver).not.toMatch(/title|question|statement|note_text|annotation|sealed_payload_reference|participant_access/iu);
  });
});
