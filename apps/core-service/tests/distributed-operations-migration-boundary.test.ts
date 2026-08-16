import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { asIsoDateTime, type Clock } from '@ppt/core';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import { SqliteFamilyDatabaseRuntime } from '../../desktop/src/main/family-database-runtime.js';

const clock: Clock = {now: () => asIsoDateTime('2026-08-16T02:10:00.000Z')};
const runtimes: SqliteFamilyDatabaseRuntime[] = [];
const dirs: string[] = [];
const openRuntime = (): SqliteFamilyDatabaseRuntime => {
  const dir = mkdtempSync(join(tmpdir(), 'ppt-34j-db-'));
  dirs.push(dir);
  const runtime = new SqliteFamilyDatabaseRuntime({databasePath: join(dir, 'family.db'),
    applicationVersion: '34-j-migration-vitest', clock, skipFileMigrationSafetyBackup: true,
    databaseConfig: {busyTimeoutMs: 5000, journalMode: 'WAL', synchronous: 'FULL'}});
  runtimes.push(runtime);
  return runtime;
};
afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.close();
  for (const dir of dirs.splice(0)) rmSync(dir, {recursive: true, force: true});
});

const seedCluster = (runtime: SqliteFamilyDatabaseRuntime): void => {
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)')
    .run('family-34-j', '34-J Ailesi', '2026-08-16T01:00:00.000Z');
  const insertNode = runtime.database.prepare(
    'INSERT INTO distributed_cluster_nodes(node_id,cluster_id,family_id,role,voter,term,fencing_token,commit_index,applied_index,certificate_fingerprint,certificate_revoked,key_epoch,policy_version,revocation_epoch,safe_mode,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  );
  insertNode.run('leader-34-j', 'cluster-34-j', 'family-34-j', 'leader', 1, 4, 5, 12, 12,
    'a'.repeat(64), 0, 4, 'policy-34-j', 2, 0, '2026-08-16T01:30:00.000Z');
  insertNode.run('follower-34-j', 'cluster-34-j', 'family-34-j', 'follower', 1, 4, 4, 12, 12,
    'b'.repeat(64), 0, 4, 'policy-34-j', 2, 0, '2026-08-16T01:30:00.000Z');
};

describe('34-J distributed operations migration boundary', () => {
  it('owns migration 114 with strict immutable and chain-bound operations tables', () => {
    const runtime = openRuntime();
    expect(FAMILY_DATABASE_MIGRATIONS.find(migration => migration.version === 114))
      .toMatchObject({version: 114, name: 'distributed_clients_operations_disaster_recovery'});
    const tables = runtime.database.prepare(
      "SELECT name,strict FROM pragma_table_list WHERE name IN ('distributed_backup_evidence','distributed_update_plans','distributed_fault_injection_evidence') ORDER BY name"
    ).all() as Array<{name: string; strict: number}>;
    expect(tables).toHaveLength(3);
    expect(tables.every(row => row.strict === 1)).toBe(true);
    const sql = (runtime.database.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_34j_%'")
      .all() as Array<{sql: string}>).map(row => row.sql).join('\n');
    for (const marker of ['backup chain, cluster state or epoch evidence mismatch',
      'update plan requires exact healthy leader-last cluster inventory', 'fault evidence chain or cluster tenancy mismatch',
      'backup evidence is immutable', 'rolling update plan is immutable', 'fault evidence is immutable']) {
      expect(sql).toContain(marker);
    }
  });

  it('accepts only exact cluster-bound backup, update and fault chains', () => {
    const runtime = openRuntime();
    seedCluster(runtime);
    const insertBackup = runtime.database.prepare(
      'INSERT INTO distributed_backup_evidence(id,client_operation_id,request_fingerprint,cluster_id,family_id,backup_sequence,kind,storage_target_id,immutable,independent_from_replica,manifest_sha256,cluster_state_evidence_sha256,source_commit_index,verified_size_bytes,verified_at,key_epoch,policy_version,provider_id,provider_production_verified,provider_evidence_sha256,previous_evidence_sha256,evidence_sha256,restore_tested,real_different_device_restore_verified) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    insertBackup.run('backup-1', 'backup-operation-1', '1'.repeat(64), 'cluster-34-j', 'family-34-j', 1,
      'offline', 'offline-target-34-j', 1, 1, '2'.repeat(64), 'a'.repeat(64), 12, 4096,
      '2026-08-16T02:00:00.000Z', 4, 'policy-34-j', 'synthetic-backup-verifier', 0, '3'.repeat(64),
      '0'.repeat(64), '4'.repeat(64), 0, 0);
    expect(() => insertBackup.run('backup-skip', 'backup-operation-skip', '5'.repeat(64), 'cluster-34-j',
      'family-34-j', 3, 'offline', 'offline-target-34-j', 1, 1, '6'.repeat(64), 'b'.repeat(64), 12,
      4096, '2026-08-16T02:01:00.000Z', 4, 'policy-34-j', 'synthetic-backup-verifier', 0,
      '7'.repeat(64), '4'.repeat(64), '8'.repeat(64), 0, 0)).toThrow(/backup chain/);

    const insertUpdate = runtime.database.prepare(
      'INSERT INTO distributed_update_plans(id,client_operation_id,request_fingerprint,cluster_id,family_id,node_order_json,leader_last,n_minus_one_compatible,signed_package_required,package_signature_verified,rollback_required,schema_migration_leader_quorum_only,current_version,target_version,package_sha256,cluster_state_evidence_sha256,verifier_id,verifier_production_verified,signature_evidence_sha256,plan_sha256,created_at,real_update_executed) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    insertUpdate.run('update-1', 'update-operation-1', '9'.repeat(64), 'cluster-34-j', 'family-34-j',
      JSON.stringify(['follower-34-j', 'leader-34-j']), 1, 1, 1, 1, 1, 1, '4.8.2026-29', '4.8.2026-30',
      'a'.repeat(64), 'b'.repeat(64), 'synthetic-update-verifier', 0, 'c'.repeat(64), 'd'.repeat(64),
      '2026-08-16T02:02:00.000Z', 0);
    runtime.database.prepare(
      'INSERT INTO distributed_cluster_nodes(node_id,cluster_id,family_id,role,voter,term,fencing_token,commit_index,applied_index,certificate_fingerprint,certificate_revoked,key_epoch,policy_version,revocation_epoch,safe_mode,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).run('replica-34-j', 'cluster-34-j', 'family-34-j', 'read_replica', 0, 4, 3, 12, 12,
      'c'.repeat(64), 0, 4, 'policy-34-j', 2, 0, '2026-08-16T01:30:00.000Z');
    expect(() => insertUpdate.run('update-incomplete', 'update-operation-incomplete', 'e'.repeat(64),
      'cluster-34-j', 'family-34-j', JSON.stringify(['follower-34-j', 'leader-34-j']), 1, 1, 1, 1, 1, 1,
      '4.8.2026-29', '4.8.2026-30', 'f'.repeat(64), '1'.repeat(64), 'synthetic-update-verifier', 0,
      '2'.repeat(64), '3'.repeat(64), '2026-08-16T02:03:00.000Z', 0)).toThrow(/exact healthy leader-last/);
    expect(() => insertUpdate.run('update-wrong-order', 'update-operation-wrong-order', 'e'.repeat(64),
      'cluster-34-j', 'family-34-j', JSON.stringify(['leader-34-j', 'follower-34-j']), 1, 1, 1, 1, 1, 1,
      '4.8.2026-29', '4.8.2026-30', 'f'.repeat(64), '1'.repeat(64), 'synthetic-update-verifier', 0,
      '2'.repeat(64), '3'.repeat(64), '2026-08-16T02:03:00.000Z', 0)).toThrow(/leader-last/);

    const insertFault = runtime.database.prepare(
      'INSERT INTO distributed_fault_injection_evidence(id,client_operation_id,request_fingerprint,cluster_id,family_id,fault_sequence,scenario,synthetic_only,contained,provider_id,provider_evidence_sha256,previous_evidence_sha256,evidence_sha256,real_windows_node,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    insertFault.run('fault-1', 'fault-operation-1', '4'.repeat(64), 'cluster-34-j', 'family-34-j', 1,
      'network_partition', 1, 1, 'synthetic-fault-provider', '5'.repeat(64), '0'.repeat(64), '6'.repeat(64), 0,
      '2026-08-16T02:04:00.000Z');
    expect(() => insertFault.run('fault-skip', 'fault-operation-skip', '7'.repeat(64), 'cluster-34-j',
      'family-34-j', 3, 'disk_full', 1, 1, 'synthetic-fault-provider', '8'.repeat(64), '6'.repeat(64),
      '9'.repeat(64), 0, '2026-08-16T02:05:00.000Z')).toThrow(/fault evidence chain/);
    expect(() => runtime.database.prepare("DELETE FROM distributed_backup_evidence WHERE id='backup-1'").run()).toThrow(/immutable/);
    expect(() => runtime.database.prepare("UPDATE distributed_update_plans SET target_version='4.8.2026-31' WHERE id='update-1'").run())
      .toThrow(/immutable/);
    expect(() => runtime.database.prepare("DELETE FROM distributed_fault_injection_evidence WHERE id='fault-1'").run()).toThrow(/immutable/);
  });
});
