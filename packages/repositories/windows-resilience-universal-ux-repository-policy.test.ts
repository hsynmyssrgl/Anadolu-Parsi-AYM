import { mkdtempSync,rmSync } from 'node:fs';import { tmpdir } from 'node:os';import { join } from 'node:path';import { afterEach,describe,expect,it } from 'vitest';
import { asIsoDateTime,type Clock } from '@ppt/core';import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';
const clock:Clock={now:()=>asIsoDateTime('2026-08-16T02:40:00.000Z')};const runtimes:SqliteFamilyDatabaseRuntime[]=[];const dirs:string[]=[];
afterEach(()=>{for(const runtime of runtimes.splice(0))runtime.close();for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});});
describe('34-K resilience universal UX migration boundary',()=>{it('owns migration 115 and immutable policy/resilience ledgers',()=>{const dir=mkdtempSync(join(tmpdir(),'ppt-34k-db-'));dirs.push(dir);
  const runtime=new SqliteFamilyDatabaseRuntime({databasePath:join(dir,'family.db'),applicationVersion:'34-k-migration-vitest',clock,
    skipFileMigrationSafetyBackup:true,databaseConfig:{busyTimeoutMs:5000,journalMode:'WAL',synchronous:'FULL'}});runtimes.push(runtime);
  expect(FAMILY_DATABASE_MIGRATIONS.at(-1)).toMatchObject({version:115,name:'windows_resilience_universal_ux'});
  expect(runtime.database.prepare("SELECT value FROM database_metadata WHERE key='schema_generation'").get()).toEqual({value:'REVISION-34-K-WINDOWS-RESILIENCE-UNIVERSAL-UX'});
  const sql=(runtime.database.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_34k_%'").all() as Array<{sql:string}>).map(row=>row.sql).join('\n');
  expect(sql).toContain('policy weakening proposal is immutable');expect(sql).toContain('resilience evidence is immutable');});});
