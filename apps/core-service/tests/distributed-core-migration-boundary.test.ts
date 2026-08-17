import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach,describe,expect,it } from 'vitest';
import { asIsoDateTime,type Clock } from '@ppt/core';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import { SqliteFamilyDatabaseRuntime } from '../../desktop/src/main/family-database-runtime.js';

const clock:Clock={now:()=>asIsoDateTime('2026-08-16T01:40:00.000Z')};
const runtimes:SqliteFamilyDatabaseRuntime[]=[];
const dirs:string[]=[];
const openRuntime=():SqliteFamilyDatabaseRuntime=>{
  const dir=mkdtempSync(join(tmpdir(),'ppt-34i-db-'));dirs.push(dir);
  const runtime=new SqliteFamilyDatabaseRuntime({databasePath:join(dir,'family.db'),
    applicationVersion:'34-i-migration-vitest',clock,skipFileMigrationSafetyBackup:true,
    databaseConfig:{busyTimeoutMs:5000,journalMode:'WAL',synchronous:'FULL'}});
  runtimes.push(runtime);return runtime;
};
afterEach(()=>{
  for(const runtime of runtimes.splice(0))runtime.close();
  for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});
});

describe('34-I distributed core migration boundary',()=>{
  it('owns migration 113 with strict immutable and monotonic cluster tables',()=>{
    const runtime=openRuntime();
    expect(FAMILY_DATABASE_MIGRATIONS.find((migration)=>migration.version===113))
      .toMatchObject({version:113,name:'distributed_core_consensus_tenancy'});
    expect(runtime.database.prepare("SELECT value FROM database_metadata WHERE key='schema_generation'").get())
      .toEqual({value:'REVISION-34-K-WINDOWS-RESILIENCE-UNIVERSAL-UX'});
    const tables=runtime.database.prepare(
      "SELECT name,strict FROM pragma_table_list WHERE name IN ('distributed_cluster_nodes','distributed_mutation_log','distributed_cluster_snapshots') ORDER BY name"
    ).all() as Array<{name:string;strict:number}>;
    expect(tables).toHaveLength(3);
    expect(tables.every(row=>row.strict===1)).toBe(true);
    const mutationTable=runtime.database.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='distributed_mutation_log'"
    ).get() as {sql:string};
    expect(mutationTable.sql.replaceAll(/\s+/gu,'')).toContain(
      'PRIMARYKEY(cluster_id,family_id,mutation_id),UNIQUE(cluster_id,family_id,idempotency_key)'
    );
    const triggerRows=runtime.database.prepare(
      "SELECT sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_34i_%'"
    ).all() as Array<{sql:string}>;
    const sql=triggerRows.map(row=>row.sql).join('\n');
    expect(sql).toContain('replicated mutation log is immutable');
    expect(sql).toContain('verified cluster snapshot is immutable');
    expect(sql).toContain('mutation chain, leader fence or tenancy evidence mismatch');
    expect(sql).toContain('snapshot leader fence, tenancy or monotonic index mismatch');
    expect(sql).toContain('node identity or monotonic state cannot regress');
    expect(sql).toContain('n.commit_index=NEW.commit_index AND n.applied_index=NEW.commit_index');
    expect(sql).toContain('NEW.snapshot_index<=n.applied_index');
  });

  it('accepts only exact leader-bound chains and rejects regressions, forged actors and stale snapshots',()=>{
    const runtime=openRuntime();
    runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)')
      .run('family-34-i','34-I Ailesi','2026-08-16T01:00:00.000Z');
    runtime.database.prepare(
      'INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)'
    ).run('person-34-i','family-34-i','34-I Yöneticisi',null,'self',0,'main','active','2026-08-16T01:00:00.000Z');
    runtime.database.prepare(
      'INSERT INTO distributed_cluster_nodes(node_id,cluster_id,family_id,role,voter,term,fencing_token,commit_index,applied_index,certificate_fingerprint,certificate_revoked,key_epoch,policy_version,revocation_epoch,safe_mode,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).run('node-34-i','cluster-34-i','family-34-i','leader',1,4,5,0,0,'a'.repeat(64),0,3,'policy-34-i',2,0,
      '2026-08-16T01:30:00.000Z');
    runtime.database.prepare("UPDATE distributed_cluster_nodes SET commit_index=1,applied_index=1 WHERE node_id='node-34-i'").run();
    const insertMutation=runtime.database.prepare(
      'INSERT INTO distributed_mutation_log(mutation_id,idempotency_key,request_fingerprint,cluster_id,family_id,node_id,leader_term,fencing_token,entity_type,entity_id,entity_version,global_sequence,actor_person_id,device_id,schema_version,policy_version,revocation_epoch,key_epoch,payload_sha256,previous_hash,mutation_hash,commit_index,provider_id,provider_evidence_sha256,projection_sha256,occurred_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    insertMutation.run('mutation-1','idempotency-1','1'.repeat(64),'cluster-34-i','family-34-i','node-34-i',4,5,
      'health_record','health-1',1,1,'person-34-i','device-34-i',1,'policy-34-i',2,3,'7'.repeat(64),
      '0'.repeat(64),'2'.repeat(64),1,'synthetic-provider','8'.repeat(64),'9'.repeat(64),'2026-08-16T01:30:00.000Z');
    expect(()=>insertMutation.run('mutation-skip','idempotency-skip','3'.repeat(64),'cluster-34-i','family-34-i',
      'node-34-i',4,5,'health_record','health-1',2,3,'person-34-i','device-34-i',1,'policy-34-i',2,3,
      '7'.repeat(64),'2'.repeat(64),'4'.repeat(64),2,'synthetic-provider','8'.repeat(64),'9'.repeat(64),
      '2026-08-16T01:31:00.000Z')).toThrow(/mutation chain/);
    expect(()=>runtime.database.prepare("UPDATE distributed_cluster_nodes SET fencing_token=4 WHERE node_id='node-34-i'").run())
      .toThrow(/cannot regress/);
    expect(()=>runtime.database.prepare("DELETE FROM distributed_mutation_log WHERE mutation_id='mutation-1'").run())
      .toThrow(/immutable/);
    const insertSnapshot=runtime.database.prepare(
      'INSERT INTO distributed_cluster_snapshots(snapshot_id,cluster_id,family_id,node_id,leader_term,fencing_token,snapshot_index,snapshot_sha256,encrypted_reference,key_epoch,policy_version,revocation_epoch,provider_id,provider_evidence_sha256,verified,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    insertSnapshot.run('snapshot-1','cluster-34-i','family-34-i','node-34-i',4,5,1,'5'.repeat(64),
      'opaque-envelope-1',3,'policy-34-i',2,'synthetic-provider','6'.repeat(64),1,'2026-08-16T01:32:00.000Z');
    expect(()=>insertSnapshot.run('snapshot-stale','cluster-34-i','family-34-i','node-34-i',4,5,0,'4'.repeat(64),
      'opaque-envelope-2',3,'policy-34-i',2,'synthetic-provider','6'.repeat(64),1,'2026-08-16T01:33:00.000Z'))
      .toThrow(/snapshot leader fence/);
    runtime.database.prepare("UPDATE distributed_cluster_nodes SET certificate_revoked=1 WHERE node_id='node-34-i'").run();
    expect(()=>runtime.database.prepare("UPDATE distributed_cluster_nodes SET certificate_revoked=0 WHERE node_id='node-34-i'").run())
      .toThrow(/cannot regress/);
  });
});
