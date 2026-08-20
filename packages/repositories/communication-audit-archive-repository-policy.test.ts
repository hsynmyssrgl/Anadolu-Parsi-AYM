import { mkdtempSync,rmSync } from 'node:fs';import { tmpdir } from 'node:os';import { join } from 'node:path';
import { afterEach,describe,expect,it } from 'vitest';import { asIsoDateTime,type Clock } from '@ppt/core';
import { FAMILY_DATABASE_MIGRATIONS,FAMILY_DATABASE_SCHEMA_GENERATION } from '@ppt/database';import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';
const clock:Clock={now:()=>asIsoDateTime('2026-08-16T01:10:00.000Z')};const runtimes:SqliteFamilyDatabaseRuntime[]=[];const directories:string[]=[];
afterEach(()=>{for(const runtime of runtimes.splice(0))runtime.close();for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
const open=()=>{const directory=mkdtempSync(join(tmpdir(),'ppt-34h-repository-'));directories.push(directory);const runtime=new SqliteFamilyDatabaseRuntime({
  databasePath:join(directory,'family.db'),applicationVersion:'34-h-repository-vitest',clock,skipFileMigrationSafetyBackup:true,
  databaseConfig:{busyTimeoutMs:5000,journalMode:'WAL',synchronous:'FULL'}});runtimes.push(runtime);return runtime;};
describe('34-H communication audit archive migration boundary',()=>{
  it('owns migration 112 and immutable content-free audit/checkpoint ledgers',()=>{const runtime=open();
    expect(FAMILY_DATABASE_MIGRATIONS.find((migration)=>migration.version===112)).toMatchObject({version:112,name:'communication_audit_archive_integrity'});
    expect(runtime.database.prepare("SELECT value FROM database_metadata WHERE key='schema_generation'").get())
      .toEqual({value:FAMILY_DATABASE_SCHEMA_GENERATION});
    const tables=(runtime.database.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND
      name IN ('communication_audit_operations','communication_audit_events','communication_archive_integrity_checkpoints') ORDER BY name`).all() as Array<{name:string}>).map(row=>row.name);
    expect(tables).toEqual(['communication_archive_integrity_checkpoints','communication_audit_events','communication_audit_operations']);
    const sql=(runtime.database.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_34h_%'").all() as Array<{sql:string}>).map(row=>row.sql).join('\n');
    expect(sql).toContain('communication audit ledger is immutable');expect(sql).toContain('archive checkpoint ledger is immutable');
    expect(sql).toContain('operation requires exact owner-bound durable PEP receipt');
    expect(sql).toContain('platform_policy_database_fences');expect(sql).toContain('platform_policy_journal_projection_outbox');
    expect(sql).toContain('exact operation receipt and chain head');
    expect(sql).toContain('NEW.archive_generation<>(SELECT COALESCE(MAX(checkpoint.archive_generation),0)+1');
    const columns=(runtime.database.prepare(`SELECT p.name FROM pragma_table_info('communication_audit_events') p ORDER BY p.cid`).all() as Array<{name:string}>).map(row=>row.name).join('\n');
    expect(columns).toContain('resource_fingerprint');expect(columns).not.toMatch(/content_text|message_text|payload|plaintext|ciphertext/iu);
    const operationColumns=(runtime.database.prepare(`SELECT p.name FROM pragma_table_info('communication_audit_operations') p ORDER BY p.cid`).all() as Array<{name:string}>).map(row=>row.name);
    for(const name of ['actor_account_id','actor_person_id','policy_resource_id','occurred_at','policy_receipt_hash',
      'policy_receipt_version','policy_receipt_nonce','policy_correlation_id'])expect(operationColumns).toContain(name);
    expect(()=>runtime.database.prepare(`INSERT INTO communication_audit_operations(client_operation_id,family_id,
      owner_person_id,actor_account_id,actor_person_id,operation_kind,request_fingerprint,result_id,policy_resource_id,
      occurred_at,policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id)
      VALUES('forged','missing-family','missing-person','missing-account','missing-person','audit_append',?,?,'forged-policy',?, ?,1,'forged-nonce-value','forged-correlation')`)
      .run('a'.repeat(64),'b'.repeat(64),'2026-08-16T01:10:00.000Z','c'.repeat(64))).toThrow();
  });
});
