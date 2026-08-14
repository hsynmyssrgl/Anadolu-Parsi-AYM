import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  asCorrelationId,
  asIsoDateTime,
  asUserId,
  createAppError,
  err,
  ok,
  ERROR_CODES
} from '@ppt/core';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import {
  EnforceSourceDeletionPropagationUseCase,
  GetSourceDeletionPropagationBoundaryUseCase,
  executeManagedBackupPropagation,
  type SourceDeletionPropagationWriteScope,
  type SourceDeletionRuntimeCacheInvalidationPort
} from '@ppt/application';
import {
  SOURCE_DELETION_PROPAGATION_OWNER_KINDS,
  SOURCE_DELETION_METADATA_ONLY_MUTATION_LEDGERS,
  SOURCE_DELETION_REQUIRED_CACHE_REGISTRIES,
  SourceDeletionPropagationPolicy,
  type SourceDeletionCacheInvalidation,
  type SourceDeletionIdentity,
  type SourceDeletionPersistentOwnerInspection,
  type SourceDeletionPropagationPlan
} from '@ppt/platform-policy';
import { SqliteBackupPropagationRepository, SqliteDataLifecycleRepository } from '@ppt/repositories';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';
import { DesktopSourceDeletionRuntimeCacheInvalidationPort } from '../src/main/source-deletion-propagation-application-adapter.js';

const NOW = '2026-08-12T04:00:00.000Z';
const databases: DatabaseSync[] = [];

const source = (overrides: Partial<SourceDeletionIdentity> = {}): SourceDeletionIdentity => ({
  familyId: 'family-ppk-019',
  resourceType: 'finance_record',
  resourceId: 'finance-ppk-019',
  purgedAt: NOW,
  ...overrides
});

const inspection = (overrides: Partial<SourceDeletionPersistentOwnerInspection> = {}): SourceDeletionPersistentOwnerInspection => ({
  schemaVersion: 1,
  inspectedAt: NOW,
  unregisteredPersistentOwners: [],
  plaintextReplicaEnabled: false,
  derivedPolicyMetadataOnly: true,
  ...overrides
});

const cacheInvalidations = (overrides: Partial<SourceDeletionCacheInvalidation> = {}): readonly SourceDeletionCacheInvalidation[] =>
  SOURCE_DELETION_REQUIRED_CACHE_REGISTRIES.map((registryId, index) => ({
    registryId,
    invalidatedEntryCount: index,
    invalidatedAt: NOW,
    ...overrides
  }));

const allowedPlan = (
  policy = new SourceDeletionPropagationPolicy(),
  persistentInspection = inspection(),
  invalidations = cacheInvalidations()
): SourceDeletionPropagationPlan => {
  const decision = policy.evaluate({ source: source(), persistentInspection, cacheInvalidations: invalidations });
  if (!decision.allowed) throw new Error(`TEST_PLAN_REJECTED:${decision.reason}`);
  return decision.plan;
};

const makeDatabase = (): DatabaseSync => {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  database.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE database_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
    INSERT INTO database_metadata VALUES('schema_generation','test','${NOW}');
    CREATE TABLE finance_records(id TEXT PRIMARY KEY,owner_person_id TEXT NOT NULL,privacy TEXT NOT NULL,title TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE health_records(id TEXT PRIMARY KEY,owner_person_id TEXT NOT NULL,privacy TEXT NOT NULL,title TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE medication_plans(id TEXT PRIMARY KEY,owner_person_id TEXT NOT NULL,privacy TEXT NOT NULL,name TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE family_health_history(id TEXT PRIMARY KEY,related_person_id TEXT NOT NULL,privacy TEXT NOT NULL,condition TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE life_records(id TEXT PRIMARY KEY,owner_person_id TEXT NOT NULL,privacy TEXT NOT NULL,title TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE object_permissions(id TEXT PRIMARY KEY,resource_type TEXT NOT NULL,resource_id TEXT NOT NULL);
    CREATE TABLE ai_consents(id TEXT PRIMARY KEY,resource_type TEXT NOT NULL,resource_id TEXT NOT NULL);
  `);
  for (const version of [16, 17]) {
    const migration = FAMILY_DATABASE_MIGRATIONS.find((candidate) => candidate.version === version);
    if (!migration) throw new Error(`MIGRATION_${version}_MISSING`);
    database.exec(migration.sql);
  }
  database.exec(`
    INSERT INTO finance_records VALUES('finance-ppk-019','person-1','private','Gizli bütçe','${NOW}');
    INSERT INTO data_lifecycle(resource_type,resource_id,owner_person_id,privacy,state,policy_id,purge_execute_after,legal_hold,updated_at,backup_propagation_pending)
    VALUES('finance_record','finance-ppk-019','person-1','private','purge_scheduled',NULL,'${NOW}',0,'${NOW}',0);
    INSERT INTO object_permissions VALUES('permission-1','finance_record','finance-ppk-019');
    INSERT INTO ai_consents VALUES('consent-1','finance_record','finance-ppk-019');
  `);
  return database;
};

const makeMigration92Database = (memoryState?:'active'|'restricted'|'deleted'):DatabaseSync => {
  const database=makeDatabase();
  const derivedMigration=FAMILY_DATABASE_MIGRATIONS.find(candidate=>candidate.version===77);
  const migration=FAMILY_DATABASE_MIGRATIONS.find(candidate=>candidate.version===92);
  if(!derivedMigration)throw new Error('MIGRATION_77_MISSING');
  if(!migration)throw new Error('MIGRATION_92_MISSING');
  database.exec(derivedMigration.sql);
  database.exec(migration.sql);
  database.exec('PRAGMA foreign_keys=OFF');
  for(const row of database.prepare("SELECT name FROM sqlite_schema WHERE type='trigger'").all() as Array<{name:unknown}>){
    database.exec(`DROP TRIGGER "${String(row.name).replaceAll('"','""')}"`);
  }
  if(memoryState){
    const hash=(digit:string)=>digit.repeat(64);
    database.prepare(`INSERT INTO derived_data_policy_bindings(
      binding_hash,schema_version,derived_kind,derived_resource_type,derived_resource_id,derived_resource_version,content_sha256,family_id,
      policy_version,policy_package_sha256,sensitivity,data_classes_json,access_policy_json,access_policy_sha256,obligations_json,
      obligations_sha256,source_set_sha256,producer_receipt_hash,binding_json,source_count,lineage_depth,retention_until,status,created_at,sealed_at
    ) VALUES(?,1,'AI_MEMORY','governed_ai_memory_record','memory-1','1',?,'family-ppk-019','1',?,'personal','["personal"]','{}',?,'[]',?,?,?,'{}',1,1,NULL,'pending',?,NULL)`)
      .run(hash('1'),hash('2'),hash('3'),hash('4'),hash('5'),hash('6'),hash('7'),NOW);
    database.prepare(`INSERT INTO derived_data_policy_sources(
      binding_hash,source_ordinal,source_key,source_resource_type,source_resource_id,source_resource_version,content_sha256,family_id,
      policy_version,policy_package_sha256,sensitivity,data_classes_json,policy_receipt_hash,context_hash,request_hash,source_snapshot_json,
      source_snapshot_sha256,lineage_depth,retention_until,authorized_at
    ) VALUES(?,0,?,'finance_record','finance-ppk-019','1',?,'family-ppk-019','1',?,'personal','["personal"]',?,?,?,'{}',?,0,NULL,?)`)
      .run(hash('1'),hash('8'),hash('9'),hash('3'),hash('7'),hash('a'),hash('b'),hash('c'),NOW);
    const deleted=memoryState==='deleted';
    database.prepare(`INSERT INTO governed_ai_memory_records(
      resource_id,family_id,account_id,owner_person_id,derived_binding_hash,title,statement,source_resource_type,source_resource_id,
      source_occurred_at,restriction_visibility,selected_account_ids_json,allowed_purposes_json,processing_allowed,state,retention_until,
      expired_at,deletion_requested_at,deleted_at,revision,state_fingerprint,last_mutation_id,created_at,updated_at,policy_receipt_hash
    ) VALUES('memory-1','family-ppk-019','account-1','person-1',?,?,?,?,?,NULL,'owner_only','[]','["general"]',?,?,NULL,NULL,NULL,?,1,?,'mutation-1',?,?,?)`)
      .run(hash('1'),deleted?'':'Yerel hafıza',deleted?'':'Kaynak veriden türetildi','finance_record','finance-ppk-019',deleted?0:1,memoryState,deleted?NOW:null,hash('d'),NOW,NOW,hash('7'));
  }
  return database;
};

const repositoryContext = (database: DatabaseSync): RepositoryExecutionContext => ({
  transaction: database as never,
  actor: { userId: asUserId('account-ppk-019'), roles: ['family_admin'] },
  correlationId: asCorrelationId('ppk-019-runtime'),
  occurredAt: asIsoDateTime(NOW)
});

afterEach(() => {
  while (databases.length > 0) databases.pop()?.close();
});

describe('PPK-019 merkezi kaynak silme ve retention yayılımı', () => {
  it('sabit yedi sahip sınıfını ve üç cache kaydını yayınlar', () => {
    expect(SOURCE_DELETION_PROPAGATION_OWNER_KINDS).toEqual([
      'OCR_TEXT', 'SEARCH_INDEX', 'THUMBNAIL', 'AI_MEMORY', 'CACHE', 'REPLICA', 'BACKUP'
    ]);
    expect(SOURCE_DELETION_REQUIRED_CACHE_REGISTRIES).toEqual([
      'family-import-preview', 'ipc-main-read', 'offline-sensitive'
    ]);
    expect(SOURCE_DELETION_METADATA_ONLY_MUTATION_LEDGERS).toEqual(['governed_ai_memory_mutations']);
    expect(Object.isFrozen(SOURCE_DELETION_METADATA_ONLY_MUTATION_LEDGERS)).toBe(true);
  });

  it('yerel sahipleri tamamlayıp yedek yeniden yazımını pending bırakır', () => {
    const plan = allowedPlan();
    expect(plan.localPropagationComplete).toBe(true);
    expect(plan.backupPropagationPending).toBe(true);
    expect(plan.ownerOutcomes).toHaveLength(7);
    expect(plan.ownerOutcomes.filter((owner) => owner.completed)).toHaveLength(6);
    expect(plan.ownerOutcomes.at(-1)).toMatchObject({ kind: 'BACKUP', disposition: 'VERIFIED_REWRITE_PENDING', completed: false });
  });

  it('cache sonuç sırasından bağımsız kanonik plan hash üretir', () => {
    const policy = new SourceDeletionPropagationPolicy();
    const left = policy.evaluate({ source: source(), persistentInspection: inspection(), cacheInvalidations: cacheInvalidations() });
    const right = policy.evaluate({ source: source(), persistentInspection: inspection(), cacheInvalidations: [...cacheInvalidations()].reverse() });
    expect(left.allowed && right.allowed && left.plan.planHash).toBe(right.allowed ? right.plan.planHash : 'rejected');
  });

  it('eksik veya yinelenen cache registry setini reddeder', () => {
    const policy = new SourceDeletionPropagationPolicy();
    expect(policy.evaluate({ source: source(), persistentInspection: inspection(), cacheInvalidations: cacheInvalidations().slice(0, 2) })).toEqual({ allowed: false, reason: 'CACHE_REGISTRY_SET_MISMATCH' });
    expect(policy.evaluate({ source: source(), persistentInspection: inspection(), cacheInvalidations: [cacheInvalidations()[0]!, cacheInvalidations()[0]!, cacheInvalidations()[2]!] })).toEqual({ allowed: false, reason: 'CACHE_REGISTRY_SET_MISMATCH' });
  });

  it('bozuk cache sayısını ve transaction zamanı uyuşmazlığını reddeder', () => {
    const policy = new SourceDeletionPropagationPolicy();
    expect(policy.evaluate({ source: source(), persistentInspection: inspection(), cacheInvalidations: cacheInvalidations({ invalidatedEntryCount: -1 }) })).toEqual({ allowed: false, reason: 'CACHE_INVALIDATION_INVALID' });
    expect(policy.evaluate({ source: source(), persistentInspection: inspection(), cacheInvalidations: cacheInvalidations({ invalidatedAt: '2026-08-12T04:00:00.001Z' }) })).toEqual({ allowed: false, reason: 'CACHE_INVALIDATION_INVALID' });
  });

  it('kayıtsız kalıcı owner veya plaintext replica görünürse fail-closed kalır', () => {
    const policy = new SourceDeletionPropagationPolicy();
    expect(policy.evaluate({ source: source(), persistentInspection: inspection({ unregisteredPersistentOwners: ['ocr_payloads'] }), cacheInvalidations: cacheInvalidations() })).toEqual({ allowed: false, reason: 'UNREGISTERED_PERSISTENT_OWNER' });
    expect(policy.evaluate({ source: source(), persistentInspection: inspection({ plaintextReplicaEnabled: true }), cacheInvalidations: cacheInvalidations() })).toEqual({ allowed: false, reason: 'PLAINTEXT_REPLICA_ACTIVE' });
  });

  it('bozuk metadata sınıflamasını ve inceleme kronolojisini reddeder', () => {
    const policy = new SourceDeletionPropagationPolicy();
    expect(policy.evaluate({ source: source(), persistentInspection: inspection({ derivedPolicyMetadataOnly: false }), cacheInvalidations: cacheInvalidations() })).toEqual({ allowed: false, reason: 'DERIVED_POLICY_METADATA_CLASSIFICATION_INVALID' });
    expect(policy.evaluate({ source: source(), persistentInspection: inspection({ inspectedAt: '2026-08-12T03:59:59.999Z' }), cacheInvalidations: cacheInvalidations() })).toEqual({ allowed: false, reason: 'INSPECTION_TIME_MISMATCH' });
  });

  it('plan hash ve owner sonucu tamperını reddeder', () => {
    const policy = new SourceDeletionPropagationPolicy();
    const plan = allowedPlan(policy);
    expect(policy.verify({ ...plan, planHash: '0'.repeat(64) })).toEqual({ allowed: false, reason: 'PLAN_HASH_MISMATCH' });
    expect(policy.verify({ ...plan, ownerOutcomes: plan.ownerOutcomes.slice(0, 6) })).toEqual({ allowed: false, reason: 'PLAN_STRUCTURE_MISMATCH' });
  });

  it('boundary yalnız content-free güvenlik duruşu döndürür', () => {
    const view = new GetSourceDeletionPropagationBoundaryUseCase(new SourceDeletionPropagationPolicy()).execute();
    expect(view).toMatchObject({ status: 'verified', enforcement: 'fail-closed', activeSemanticPersistentOwners: 0, plaintextReplicaAllowed: false, latestDatabaseMigration: 77, payloadExposedToClient: false });
  });

  it('Desktop adaptörü üç runtime cache sahibini aynı anda temizler', () => {
    const clearFamily = vi.fn(() => 4);
    const clearExternal = vi.fn(() => [
      { registryId: 'ipc-main-read' as const, invalidatedEntryCount: 3 },
      { registryId: 'offline-sensitive' as const, invalidatedEntryCount: 2 }
    ]);
    const port = new DesktopSourceDeletionRuntimeCacheInvalidationPort(clearFamily, { invalidate: clearExternal });
    expect(port.invalidate(source(), asCorrelationId('cache-clear'))).toEqual({ ok: true, value: [
      { registryId: 'family-import-preview', invalidatedEntryCount: 4, invalidatedAt: NOW },
      { registryId: 'ipc-main-read', invalidatedEntryCount: 3, invalidatedAt: NOW },
      { registryId: 'offline-sensitive', invalidatedEntryCount: 2, invalidatedAt: NOW }
    ] });
    expect(clearFamily).toHaveBeenCalledOnce();
    expect(clearExternal).toHaveBeenCalledOnce();
  });

  it('cache temizleme arızasında inspect ve delete çağrılmaz', () => {
    const cachePort: SourceDeletionRuntimeCacheInvalidationPort = {
      invalidate: (_source, correlationId) => err(createAppError({ code: ERROR_CODES.CORE_UNEXPECTED, message: 'cache failure', category: 'infrastructure', correlationId }))
    };
    const scope: SourceDeletionPropagationWriteScope = {
      inspectSourceDeletionPropagation: vi.fn(() => ok(inspection())),
      purgeResourceWithPropagation: vi.fn(() => { throw new Error('must not run'); })
    };
    const result = new EnforceSourceDeletionPropagationUseCase(new SourceDeletionPropagationPolicy(), cachePort).execute({ scope, source: source(), correlationId: asCorrelationId('cache-failure') });
    expect(result.ok).toBe(false);
    expect(scope.inspectSourceDeletionPropagation).not.toHaveBeenCalled();
    expect(scope.purgeResourceWithPropagation).not.toHaveBeenCalled();
  });

  it('policy reddinde payload operation no-call kalır', () => {
    const scope: SourceDeletionPropagationWriteScope = {
      inspectSourceDeletionPropagation: vi.fn(() => ok(inspection({ unregisteredPersistentOwners: ['thumbnail_payloads'] }))),
      purgeResourceWithPropagation: vi.fn(() => { throw new Error('must not run'); })
    };
    const cachePort: SourceDeletionRuntimeCacheInvalidationPort = { invalidate: () => ok(cacheInvalidations()) };
    const result = new EnforceSourceDeletionPropagationUseCase(new SourceDeletionPropagationPolicy(), cachePort).execute({ scope, source: source(), correlationId: asCorrelationId('policy-deny') });
    expect(result.ok).toBe(false);
    expect(scope.purgeResourceWithPropagation).not.toHaveBeenCalled();
  });

  it('repository source ve erişim metadata satırlarını atomik siler', () => {
    const database = makeDatabase();
    const repository = new SqliteDataLifecycleRepository();
    const context = repositoryContext(database);
    const inspected = repository.inspectSourceDeletionPropagation(context, NOW);
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) return;
    const plan = allowedPlan(new SourceDeletionPropagationPolicy(), inspected.value);
    database.exec('BEGIN IMMEDIATE');
    const result = repository.purgeResourceWithPropagation(context, plan);
    database.exec(result.ok ? 'COMMIT' : 'ROLLBACK');
    expect(result).toEqual({ ok: true, value: { schemaVersion: 1, planHash: plan.planHash, sourceDeleted: true, deletedAccessMetadataRows: 2, localPropagationComplete: true, backupPropagationPending: true } });
    expect(database.prepare("SELECT COUNT(*) AS total FROM finance_records WHERE id='finance-ppk-019'").get()).toEqual({ total: 0 });
    expect(database.prepare("SELECT COUNT(*) AS total FROM object_permissions").get()).toEqual({ total: 0 });
    expect(database.prepare("SELECT COUNT(*) AS total FROM ai_consents").get()).toEqual({ total: 0 });
  });

  it('migration 92 yönetilen AI-memory owner kaydını sahte unregistered payload saymaz', () => {
    const database=makeMigration92Database();
    const inspected=new SqliteDataLifecycleRepository().inspectSourceDeletionPropagation(repositoryContext(database),NOW);
    expect(inspected).toEqual({ok:true,value:inspection()});
  });

  it.each(['active','restricted'] as const)('kaynağa bağlı %s AI-memory current row purge işlemini fail-closed engeller', (state) => {
    const database=makeMigration92Database(state);
    const repository=new SqliteDataLifecycleRepository();
    const context=repositoryContext(database);
    const inspected=repository.inspectSourceDeletionPropagation(context,NOW);
    if(!inspected.ok)throw new Error('inspection failed');
    const plan=allowedPlan(new SourceDeletionPropagationPolicy(),inspected.value);
    database.exec('BEGIN IMMEDIATE');
    const result=repository.purgeResourceWithPropagation(context,plan);
    database.exec('ROLLBACK');
    expect(result.ok).toBe(false);
    expect(database.prepare("SELECT COUNT(*) AS total FROM finance_records WHERE id='finance-ppk-019'").get()).toEqual({total:1});
  });

  it('silinmiş ve title/statement scrubbed AI-memory tombstone kaynak purge yayılımına izin verir', () => {
    const database=makeMigration92Database('deleted');
    const repository=new SqliteDataLifecycleRepository();
    const context=repositoryContext(database);
    const inspected=repository.inspectSourceDeletionPropagation(context,NOW);
    if(!inspected.ok)throw new Error('inspection failed');
    const plan=allowedPlan(new SourceDeletionPropagationPolicy(),inspected.value);
    database.exec('BEGIN IMMEDIATE');
    const result=repository.purgeResourceWithPropagation(context,plan);
    database.exec(result.ok?'COMMIT':'ROLLBACK');
    expect(result.ok).toBe(true);
    expect(database.prepare("SELECT COUNT(*) AS total FROM finance_records WHERE id='finance-ppk-019'").get()).toEqual({total:0});
  });

  it('migration 92 yanında kayıtsız başka payload tablosu yine inspection reddi üretir', () => {
    const database=makeMigration92Database();
    database.exec('CREATE TABLE thumbnail_payloads(id TEXT PRIMARY KEY,payload TEXT NOT NULL)');
    const inspected=new SqliteDataLifecycleRepository().inspectSourceDeletionPropagation(repositoryContext(database),NOW);
    expect(inspected.ok&&inspected.value.unregisteredPersistentOwners).toEqual(['thumbnail_payloads']);
  });

  it('repository plan tamperında kaynağı ve metadata satırlarını korur', () => {
    const database = makeDatabase();
    const repository = new SqliteDataLifecycleRepository();
    const context = repositoryContext(database);
    const inspected = repository.inspectSourceDeletionPropagation(context, NOW);
    if (!inspected.ok) throw new Error('inspection failed');
    const plan = allowedPlan(new SourceDeletionPropagationPolicy(), inspected.value);
    database.exec('BEGIN IMMEDIATE');
    const result = repository.purgeResourceWithPropagation(context, { ...plan, planHash: 'f'.repeat(64) });
    database.exec('ROLLBACK');
    expect(result.ok).toBe(false);
    expect(database.prepare("SELECT COUNT(*) AS total FROM finance_records WHERE id='finance-ppk-019'").get()).toEqual({ total: 1 });
    expect(database.prepare("SELECT COUNT(*) AS total FROM object_permissions").get()).toEqual({ total: 1 });
  });

  it('repository TOCTOU şema değişimini ikinci taramada reddeder', () => {
    const database = makeDatabase();
    const repository = new SqliteDataLifecycleRepository();
    const context = repositoryContext(database);
    const inspected = repository.inspectSourceDeletionPropagation(context, NOW);
    if (!inspected.ok) throw new Error('inspection failed');
    const plan = allowedPlan(new SourceDeletionPropagationPolicy(), inspected.value);
    database.exec('CREATE TABLE ocr_payloads(id TEXT PRIMARY KEY,payload TEXT NOT NULL)');
    database.exec('BEGIN IMMEDIATE');
    const result = repository.purgeResourceWithPropagation(context, plan);
    database.exec('ROLLBACK');
    expect(result.ok).toBe(false);
    expect(database.prepare("SELECT COUNT(*) AS total FROM finance_records WHERE id='finance-ppk-019'").get()).toEqual({ total: 1 });
  });

  it('repository aktif hukuki bekletme veya yanlış lifecycle durumunda silmez', () => {
    const database = makeDatabase();
    const repository = new SqliteDataLifecycleRepository();
    const context = repositoryContext(database);
    const inspected = repository.inspectSourceDeletionPropagation(context, NOW);
    if (!inspected.ok) throw new Error('inspection failed');
    const plan = allowedPlan(new SourceDeletionPropagationPolicy(), inspected.value);
    database.prepare("UPDATE data_lifecycle SET legal_hold=1 WHERE resource_type='finance_record' AND resource_id='finance-ppk-019'").run();
    database.exec('BEGIN IMMEDIATE');
    const result = repository.purgeResourceWithPropagation(context, plan);
    database.exec('ROLLBACK');
    expect(result.ok).toBe(false);
    expect(database.prepare("SELECT COUNT(*) AS total FROM finance_records WHERE id='finance-ppk-019'").get()).toEqual({ total: 1 });
  });

  it('yönetilen hedef yoksa backup pending kaydını kapatmaz ve attention döndürür', () => {
    const completePending = vi.fn(() => ok(1));
    const result = executeManagedBackupPropagation({
      correlationId: asCorrelationId('backup-no-target'),
      runId: 'ppk019-no-target',
      pending: [{ resourceType: 'finance_record', resourceId: 'finance-ppk-019', purgedAt: NOW, updatedAt: NOW }],
      targets: [],
      tombstones: [{ fingerprint: '1'.repeat(64), purgedAt: NOW }],
      startedAt: NOW,
      startedMonotonicMs: 0,
      monotonicNowMs: () => 1,
      operations: {
        listSuccessfulRuns: () => ok([]),
        createVerifiedBackup: () => { throw new Error('must not run'); },
        quarantineManagedArtifacts: () => { throw new Error('must not run'); },
        deleteManagedRun: () => ok(undefined),
        listArtifacts: () => ok([]),
        completePending
      }
    });
    expect(result.ok && result.value).toMatchObject({ status: 'attention', pendingRemaining: 1, manualBackupWarning: true });
    expect(completePending).not.toHaveBeenCalled();
  });

  it('tüm yönetilen hedefler temiz yedek ve karantina doğrulayınca pending kaydı kapatır', () => {
    let monotonic = 0;
    const completePending = vi.fn((records: readonly unknown[]) => ok(records.length));
    const result = executeManagedBackupPropagation({
      correlationId: asCorrelationId('backup-success'),
      runId: 'ppk019-backup-success',
      pending: [{ resourceType: 'finance_record', resourceId: 'finance-ppk-019', purgedAt: NOW, updatedAt: NOW }],
      targets: [{ id: 'target-1', name: 'Yerel kasa', kind: 'local', path: 'C:/managed', enabled: true, schedule: 'daily', retentionCount: 3, retryCount: 1, createdAt: NOW }],
      tombstones: [{ fingerprint: '2'.repeat(64), purgedAt: NOW }],
      startedAt: NOW,
      startedMonotonicMs: 0,
      monotonicNowMs: () => ++monotonic,
      operations: {
        listSuccessfulRuns: () => ok([{ id: 'old-run', targetId: 'target-1', status: 'success', filePath: 'C:/managed/old.pptbackup', sha256: '3'.repeat(64), startedAt: NOW, completedAt: NOW }]),
        createVerifiedBackup: () => ok({ id: 'fresh-run', targetId: 'target-1', status: 'success', filePath: 'C:/managed/fresh.pptbackup', sha256: '4'.repeat(64), startedAt: NOW, completedAt: NOW }),
        quarantineManagedArtifacts: () => ok({ quarantineDirectory: 'C:/managed/.purge-quarantine/run', manifestPath: 'C:/managed/.purge-quarantine/run/manifest.json', artifacts: [{ originalFilePath: 'C:/managed/old.pptbackup', quarantinedFilePath: 'C:/managed/.purge-quarantine/run/old.pptbackup.quarantined', sha256: '3'.repeat(64), sizeBytes: 10 }] }),
        deleteManagedRun: () => ok(undefined),
        listArtifacts: () => ok(['C:/managed/fresh.pptbackup']),
        completePending
      }
    });
    expect(result.ok && result.value).toMatchObject({ status: 'success', refreshedTargets: 1, quarantinedArtifacts: 1, pendingRemaining: 0 });
    expect(completePending).toHaveBeenCalledOnce();
  });

  it('yönetilmeyen yedek kalırsa pending kapanmaz ve fail-closed uyarı üretir', () => {
    let monotonic = 0;
    const completePending = vi.fn(() => ok(1));
    const result = executeManagedBackupPropagation({
      correlationId: asCorrelationId('backup-unmanaged'),
      runId: 'ppk019-backup-unmanaged',
      pending: [{ resourceType: 'finance_record', resourceId: 'finance-ppk-019', purgedAt: NOW, updatedAt: NOW }],
      targets: [{ id: 'target-1', name: 'Yerel kasa', kind: 'local', path: 'C:/managed', enabled: true, schedule: 'daily', retentionCount: 3, retryCount: 1, createdAt: NOW }],
      tombstones: [{ fingerprint: '5'.repeat(64), purgedAt: NOW }],
      startedAt: NOW,
      startedMonotonicMs: 0,
      monotonicNowMs: () => ++monotonic,
      operations: {
        listSuccessfulRuns: () => ok([]),
        createVerifiedBackup: () => ok({ id: 'fresh-run', targetId: 'target-1', status: 'success', filePath: 'C:/managed/fresh.pptbackup', sha256: '6'.repeat(64), startedAt: NOW, completedAt: NOW }),
        quarantineManagedArtifacts: () => ok({ quarantineDirectory: 'C:/managed/.purge-quarantine/run', manifestPath: 'C:/managed/.purge-quarantine/run/manifest.json', artifacts: [] }),
        deleteManagedRun: () => ok(undefined),
        listArtifacts: () => ok(['C:/managed/fresh.pptbackup', 'C:/managed/manual-copy.pptbackup']),
        completePending
      }
    });
    expect(result.ok && result.value).toMatchObject({ status: 'failed', pendingRemaining: 1, manualBackupWarning: true });
    expect(result.ok && result.value.targetResults[0]).toMatchObject({ success: false, unmanagedArtifacts: 1 });
    expect(completePending).not.toHaveBeenCalled();
  });

  it('backup repository yalnız exact pending tombstone sürümünü atomik kapatır', () => {
    const database = makeDatabase();
    database.prepare("UPDATE data_lifecycle SET state='purged',purged_at=?,backup_propagation_pending=1 WHERE resource_type='finance_record' AND resource_id='finance-ppk-019'").run(NOW);
    const repository = new SqliteBackupPropagationRepository();
    const context = repositoryContext(database);
    const pending = repository.listPending(context);
    expect(pending.ok && pending.value).toHaveLength(1);
    if (!pending.ok) return;
    database.exec('BEGIN IMMEDIATE');
    const completed = repository.markCompleted(context, pending.value, '2026-08-12T04:01:00.000Z');
    database.exec(completed.ok ? 'COMMIT' : 'ROLLBACK');
    expect(completed).toEqual({ ok: true, value: 1 });
    expect(repository.listPending(context)).toEqual({ ok: true, value: [] });
  });
});
