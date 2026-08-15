import { mkdtempSync,rmSync } from 'node:fs';import { tmpdir } from 'node:os';import { join } from 'node:path';
import { afterEach,describe,expect,it } from 'vitest';import { asIsoDateTime,type Clock } from '@ppt/core';import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import { SqliteFamilyDatabaseRuntime } from '../../desktop/src/main/family-database-runtime.js';
const clock:Clock={now:()=>asIsoDateTime('2026-08-16T01:40:00.000Z')};const runtimes:SqliteFamilyDatabaseRuntime[]=[];const dirs:string[]=[];
afterEach(()=>{for(const runtime of runtimes.splice(0))runtime.close();for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});});
describe('34-I distributed core migration boundary',()=>{it('owns migration 113 with immutable log and verified snapshot tables',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ppt-34i-db-'));dirs.push(dir);const runtime=new SqliteFamilyDatabaseRuntime({databasePath:join(dir,'family.db'),
    applicationVersion:'34-i-migration-vitest',clock,skipFileMigrationSafetyBackup:true,databaseConfig:{busyTimeoutMs:5000,journalMode:'WAL',synchronous:'FULL'}});runtimes.push(runtime);
  expect(FAMILY_DATABASE_MIGRATIONS.find((migration)=>migration.version===113)).toMatchObject({version:113,name:'distributed_core_consensus_tenancy'});
  expect(runtime.database.prepare("SELECT value FROM database_metadata WHERE key='schema_generation'").get())
    .toEqual({value:'REVISION-34-K-WINDOWS-RESILIENCE-UNIVERSAL-UX'});
  const sql=(runtime.database.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_34i_%'").all() as Array<{sql:string}>).map(row=>row.sql).join('\n');
  expect(sql).toContain('replicated mutation log is immutable');expect(sql).toContain('verified cluster snapshot is immutable');
});});
