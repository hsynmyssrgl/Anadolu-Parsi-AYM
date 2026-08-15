import { mkdtempSync,rmSync } from 'node:fs';import { tmpdir } from 'node:os';import { join } from 'node:path';
import { afterEach,describe,expect,it } from 'vitest';import { asIsoDateTime,type Clock } from '@ppt/core';import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import { SqliteFamilyDatabaseRuntime } from '../../desktop/src/main/family-database-runtime.js';const clock:Clock={now:()=>asIsoDateTime('2026-08-16T02:10:00.000Z')};
const runtimes:SqliteFamilyDatabaseRuntime[]=[];const dirs:string[]=[];afterEach(()=>{for(const runtime of runtimes.splice(0))runtime.close();for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});});
describe('34-J distributed operations migration boundary',()=>{it('owns migration 114 and immutable backup/fault evidence',()=>{const dir=mkdtempSync(join(tmpdir(),'ppt-34j-db-'));dirs.push(dir);
  const runtime=new SqliteFamilyDatabaseRuntime({databasePath:join(dir,'family.db'),applicationVersion:'34-j-migration-vitest',clock,
    skipFileMigrationSafetyBackup:true,databaseConfig:{busyTimeoutMs:5000,journalMode:'WAL',synchronous:'FULL'}});runtimes.push(runtime);
  expect(FAMILY_DATABASE_MIGRATIONS.find((migration)=>migration.version===114)).toMatchObject({version:114,name:'distributed_clients_operations_disaster_recovery'});
  expect(runtime.database.prepare("SELECT value FROM database_metadata WHERE key='schema_generation'").get()).toEqual({value:'REVISION-34-K-WINDOWS-RESILIENCE-UNIVERSAL-UX'});
  const sql=(runtime.database.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_34j_%'").all() as Array<{sql:string}>).map(row=>row.sql).join('\n');
  expect(sql).toContain('backup evidence is immutable');expect(sql).toContain('fault evidence is immutable');});});
