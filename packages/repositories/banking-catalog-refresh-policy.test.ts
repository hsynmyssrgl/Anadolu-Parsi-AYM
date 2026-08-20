import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { asIsoDateTime, type Clock } from '@ppt/core';
import { FAMILY_DATABASE_MIGRATIONS, FAMILY_DATABASE_SCHEMA_GENERATION } from '@ppt/database';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';
import { resolveBankaKurumGorseli } from '../../apps/desktop/src/renderer/BankaKurumIsareti.js';

const NOW = asIsoDateTime('2026-08-20T08:00:00.000Z');
const clock: Clock = { now: () => NOW };
const runtimes: SqliteFamilyDatabaseRuntime[] = [];
const directories: string[] = [];

afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const open = (): SqliteFamilyDatabaseRuntime => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-banka-katalogu-'));
  directories.push(directory);
  const runtime = new SqliteFamilyDatabaseRuntime({
    databasePath: join(directory, 'family.db'),
    applicationVersion: 'b4-banking-catalog-refresh-test',
    clock,
    skipFileMigrationSafetyBackup: true,
    databaseConfig: { busyTimeoutMs: 5_000, journalMode: 'WAL', synchronous: 'FULL' }
  });
  runtimes.push(runtime);
  return runtime;
};

describe('B4 güncel TCMB banka kataloğu', () => {
  it('migration 116 ile 71 kurumu, 69 seçilebilir girdiyi ve Hepsi Bank unvanını sabitler', () => {
    const migration = FAMILY_DATABASE_MIGRATIONS.find(({ version }) => version === 116);
    expect(migration).toEqual({
      version: 116,
      name: 'b4_banking_catalog_2026_refresh',
      checksum: '90ce518f7e25bff775f93181f8232c3c150fc546825c009d0522057afde344f6',
      sql: expect.any(String)
    });

    const runtime = open();
    const totals = runtime.database.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN supports_customer_accounts=1 THEN 1 ELSE 0 END) AS selectable,
      SUM(CASE WHEN supports_customer_accounts=0 THEN 1 ELSE 0 END) AS excluded
      FROM bank_institutions WHERE country_code='TR' AND status='active'`).get();
    expect(totals).toEqual({ total: 71, selectable: 69, excluded: 2 });

    const renamed = runtime.database.prepare(`SELECT institution_code,iban_provider_code,official_name,
      icon_source,source_version,source_retrieved_at FROM bank_institutions WHERE institution_code='0137'`).get();
    expect(renamed).toEqual({
      institution_code: '0137',
      iban_provider_code: '00137',
      official_name: 'HEPSİ BANK A.Ş.',
      icon_source: 'local_lettermark',
      source_version: '2026',
      source_retrieved_at: '2026-08-20T00:00:00.000Z'
    });

    const excluded = runtime.database.prepare(`SELECT institution_code,official_name
      FROM bank_institutions WHERE supports_customer_accounts=0 ORDER BY institution_code`).all();
    expect(excluded).toEqual([
      { institution_code: '0001', official_name: 'T.C. MERKEZ BANKASI' },
      { institution_code: '0806', official_name: 'MERKEZİ KAYIT KURULUŞU A.Ş.' }
    ]);
    expect(runtime.database.prepare("SELECT value FROM database_metadata WHERE key='schema_generation'").get())
      .toEqual({ value: FAMILY_DATABASE_SCHEMA_GENERATION });

    const selectable = runtime.database.prepare(`SELECT institution_code,official_name FROM bank_institutions
      WHERE country_code='TR' AND status='active' AND supports_customer_accounts=1 ORDER BY official_name`).all() as
      Array<{ institution_code: string; official_name: string }>;
    expect(selectable).toHaveLength(69);
    for (const institution of selectable) {
      const visual = resolveBankaKurumGorseli({
        institutionCode: institution.institution_code,
        officialName: institution.official_name
      });
      expect(visual.shortLabel).toMatch(/^\S{1,4}$/u);
      expect(visual.background).toMatch(/^#[0-9a-f]{6}$/u);
      expect(visual.foreground).toMatch(/^#[0-9a-f]{6}$/u);
    }
  });
});
