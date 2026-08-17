import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { asIsoDateTime, type Clock } from '@ppt/core';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';

const NOW = asIsoDateTime('2026-08-16T02:40:00.000Z');
const clock: Clock = {now: () => NOW};
const runtimes: SqliteFamilyDatabaseRuntime[] = [];
const directories: string[] = [];
afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.close();
  for (const directory of directories.splice(0)) rmSync(directory, {recursive: true, force: true});
});

const open = (): SqliteFamilyDatabaseRuntime => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-34k-db-'));
  directories.push(directory);
  const runtime = new SqliteFamilyDatabaseRuntime({
    databasePath: join(directory, 'family.db'),
    applicationVersion: '34-k-migration-vitest',
    clock,
    skipFileMigrationSafetyBackup: true,
    databaseConfig: {busyTimeoutMs: 5000, journalMode: 'WAL', synchronous: 'FULL'}
  });
  runtimes.push(runtime);
  return runtime;
};

const seedOwner = (runtime: SqliteFamilyDatabaseRuntime): void => {
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)')
    .run('family-34-k-db', '34-K Family', NOW);
  runtime.database.prepare(`INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at)
    VALUES(?,?,?,?,?,?,?,?,?)`).run('person-34-k-db', 'family-34-k-db', 'Owner', '1985-01-01', 'self', 0, 'main', 'active', NOW);
  runtime.database.prepare(`INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at)
    VALUES(?,?,?,?,?,?,?,?,?)`).run('account-34-k-db', 'Owner', 'owner-34k@example.test', 'test-password-record', NOW,
      'family_admin', 'active', 'person-34-k-db', '2026-01-01T00:00:00.000Z');
};

describe('34-K resilience universal UX migration boundary', () => {
  it('owns strict migration 115 with exact receipt and provider evidence columns', () => {
    const runtime = open();
    const migration = FAMILY_DATABASE_MIGRATIONS.at(-1);
    expect(migration).toMatchObject({version: 115, name: 'windows_resilience_universal_ux',
      checksum: 'e9e67d7ef5c3097f4e39ea3a01aca76a7f9b64fe5b54de8da4de8cfbfc42e5cc'});
    expect(runtime.database.prepare("SELECT value FROM database_metadata WHERE key='schema_generation'").get())
      .toEqual({value: 'REVISION-34-K-WINDOWS-RESILIENCE-UNIVERSAL-UX'});
    const tableRows = runtime.database.prepare(`SELECT name,sql FROM sqlite_master WHERE type='table' AND name IN
      ('universal_ux_operations','universal_ux_preferences','policy_weakening_proposals','windows_resilience_evidence')
      ORDER BY name`).all() as Array<{name: string; sql: string}>;
    expect(tableRows).toHaveLength(4);
    for (const row of tableRows) expect(row.sql).toMatch(/\) STRICT$/u);
    const schemaSql = tableRows.map(row => row.sql).join('\n');
    expect(schemaSql).toContain("provider_evidence_sha256<>'0000000000000000000000000000000000000000000000000000000000000000'");
    expect(schemaSql).toContain('julianday(recorded_at)-julianday(observed_at)<=1');
    const operationColumns = (runtime.database.prepare("SELECT name FROM pragma_table_info('universal_ux_operations')")
      .all() as Array<{name: string}>).map(row => row.name);
    for (const column of ['actor_account_id', 'actor_person_id', 'policy_resource_id', 'occurred_at',
      'result_requirements_closed', 'policy_receipt_hash', 'policy_receipt_version', 'policy_receipt_nonce',
      'policy_correlation_id']) expect(operationColumns).toContain(column);
    const policyColumns = (runtime.database.prepare("SELECT name FROM pragma_table_info('policy_weakening_proposals')")
      .all() as Array<{name: string}>).map(row => row.name);
    for (const column of ['explicit_user_decision_sha256', 'proposed_policy_package_sha256', 'decision_reason',
      'verification_provider_id', 'verification_provider_production_verified', 'verification_evidence_sha256',
      'network_used']) expect(policyColumns).toContain(column);
  });

  it('requires active owner, writable fence, journal projection and exact personal PEP receipt', () => {
    const runtime = open();
    seedOwner(runtime);
    const trigger = (runtime.database.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='trg_34k_operation_insert'")
      .get() as {sql: string}).sql;
    for (const marker of ['platform_policy_database_fences', 'platform_policy_journal_projection_outbox',
      "$.request.subject.accountId", "$.request.subject.personId", "$.request.resource.familyId",
      "$.request.resource.ownerPersonId", "$.request.resource.sensitivity", "'personal'", "'general'"])
      expect(trigger).toContain(marker);
    expect(() => runtime.database.prepare(`INSERT INTO universal_ux_operations(client_operation_id,family_id,
      owner_person_id,actor_account_id,actor_person_id,operation_kind,request_fingerprint,result_id,policy_resource_id,
      occurred_at,result_requirements_closed,policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id)
      VALUES(?,?,?,?,?,?,?,?,?,?,0,?,1,?,?)`).run('forged-operation', 'family-34-k-db', 'person-34-k-db',
      'account-34-k-db', 'person-34-k-db', 'preferences_update', '1'.repeat(64), '2'.repeat(64),
      'universal-ux:person-34-k-db', NOW, '3'.repeat(64), 'forged-nonce-value', 'forged-correlation')).toThrow();
    expect(runtime.database.prepare('SELECT COUNT(*) count FROM universal_ux_operations').get()).toEqual({count: 0});
  });

  it('keeps operation, policy and resilience ledgers immutable and blocks unbound preference state', () => {
    const runtime = open();
    const triggerSql = (runtime.database.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_34k_%'")
      .all() as Array<{sql: string}>).map(row => row.sql).join('\n');
    expect(triggerSql).toContain('UX operation ledger is immutable');
    expect(triggerSql).toContain('policy weakening proposal is immutable');
    expect(triggerSql).toContain('resilience evidence is immutable');
    expect(triggerSql).toContain('preferences require exact initial operation and bounded schema');
    expect(triggerSql).toContain('policy weakening proposal requires exact operation receipt');
    expect(triggerSql).toContain('resilience evidence requires exact operation receipt');
    seedOwner(runtime);
    const preferences = JSON.stringify({mode: 'standard', favoriteRouteIds: [], recentRouteIds: [], dashboardCardIds: [],
      quietHoursEnabled: false, quietHoursStart: '22:00', quietHoursEnd: '07:00', weeklyDigestEnabled: true,
      revision: 1, updatedAt: NOW});
    expect(() => runtime.database.prepare(`INSERT INTO universal_ux_preferences(family_id,owner_person_id,
      preferences_json,revision,last_operation_id,updated_at) VALUES(?,?,?,?,?,?)`).run('family-34-k-db',
      'person-34-k-db', preferences, 1, '4'.repeat(64), NOW)).toThrow();
  });
});
