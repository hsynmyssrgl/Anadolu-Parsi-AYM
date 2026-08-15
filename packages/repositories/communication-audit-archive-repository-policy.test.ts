import { mkdtempSync,rmSync } from 'node:fs';import { tmpdir } from 'node:os';import { join } from 'node:path';
import { afterEach,describe,expect,it } from 'vitest';import { asIsoDateTime,type Clock } from '@ppt/core';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';
const clock:Clock={now:()=>asIsoDateTime('2026-08-16T01:10:00.000Z')};const runtimes:SqliteFamilyDatabaseRuntime[]=[];const directories:string[]=[];
afterEach(()=>{for(const runtime of runtimes.splice(0))runtime.close();for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
const open=()=>{const directory=mkdtempSync(join(tmpdir(),'ppt-34h-repository-'));directories.push(directory);const runtime=new SqliteFamilyDatabaseRuntime({
  databasePath:join(directory,'family.db'),applicationVersion:'34-h-repository-vitest',clock,skipFileMigrationSafetyBackup:true,
  databaseConfig:{busyTimeoutMs:5000,journalMode:'WAL',synchronous:'FULL'}});runtimes.push(runtime);return runtime;};
describe('34-H communication audit archive migration boundary',()=>{
  it('owns migration 112 and immutable content-free audit/checkpoint ledgers',()=>{const runtime=open();
    expect(FAMILY_DATABASE_MIGRATIONS.find((migration)=>migration.version===112)).toMatchObject({version:112,name:'communication_audit_archive_integrity'});
    expect(runtime.database.prepare("SELECT value FROM database_metadata WHERE key='schema_generation'").get())
      .toEqual({value:'REVISION-34-K-WINDOWS-RESILIENCE-UNIVERSAL-UX'});
    const tables=(runtime.database.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND
      name IN ('communication_audit_operations','communication_audit_events','communication_archive_integrity_checkpoints') ORDER BY name`).all() as Array<{name:string}>).map(row=>row.name);
    expect(tables).toEqual(['communication_archive_integrity_checkpoints','communication_audit_events','communication_audit_operations']);
    const sql=(runtime.database.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_34h_%'").all() as Array<{sql:string}>).map(row=>row.sql).join('\n');
    expect(sql).toContain('communication audit ledger is immutable');expect(sql).toContain('archive checkpoint ledger is immutable');
    const columns=(runtime.database.prepare(`SELECT p.name FROM pragma_table_info('communication_audit_events') p ORDER BY p.cid`).all() as Array<{name:string}>).map(row=>row.name).join('\n');
    expect(columns).toContain('resource_fingerprint');expect(columns).not.toMatch(/content_text|message_text|payload|plaintext|ciphertext/iu);
  });
});
