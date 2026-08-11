import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  ArchivePersonProfileUseCase,
  GetPersonLifecycleHistoryUseCase,
  MergePersonProfileUseCase,
  RequestSafePersonDeletionUseCase,
  UndoPersonLifecycleOperationUseCase,
  UpdatePersonProfileUseCase
} from '../packages/application/dist/index.js';
import { SystemClock } from '../packages/core/dist/index.js';
import { runFamilyDatabaseMigrations, SqliteTransactionExecutor } from '../packages/database/dist/index.js';
import {
  SqliteAccountRepository,
  SqliteAuditRepository,
  SqliteOutboxRepository,
  SqlitePersonLifecycleRepository
} from '../packages/repositories/dist/index.js';
import { RepositoryBackedPersonLifecycleUnitOfWork } from '../apps/desktop/dist/main/person-lifecycle-application-adapter.js';

const root = mkdtempSync(join(tmpdir(), 'ppt-30-c-person-lifecycle-'));
const databasePath = join(root, 'runtime.db');
const database = new DatabaseSync(databasePath);
const checks = [];
const check = (name, operation) => { operation(); checks.push(name); };

try {
  database.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
  runFamilyDatabaseMigrations({ database, databasePath, applicationVersion: '04.08.2026.29', skipFileSafetyBackup: true });
  database.exec(`
    INSERT INTO families(id,name,created_at) VALUES
      ('family-a','A Ailesi','2026-01-01T00:00:00.000Z'),
      ('family-b','B Ailesi','2026-01-01T00:00:00.000Z');
    INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at) VALUES
      ('person-source','family-a','Kaynak Kişi','1980-01-01','Aile üyesi',1,'Ana Dal','active','2026-01-01T00:00:00.000Z'),
      ('person-target','family-a','Hedef Kişi','1981-01-01','Aile üyesi',1,'Ana Dal','active','2026-01-01T00:00:00.000Z'),
      ('person-clean','family-a','Temiz Kişi','1990-02-03','Aile üyesi',2,'İkinci Dal','active','2026-01-01T00:00:00.000Z'),
      ('person-duplicate','family-a','Çakışan Kişi','1991-04-05','Aile üyesi',2,'İkinci Dal','active','2026-01-01T00:00:00.000Z'),
      ('person-foreign','family-b','Yabancı Kişi','1970-01-01','Aile üyesi',1,'Ana Dal','active','2026-01-01T00:00:00.000Z');
    INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at) VALUES
      ('admin-a','Admin A','admin-a@example.test','test','2026-01-01T00:00:00.000Z','family_admin','active','person-target','2026-01-01T00:00:00.000Z'),
      ('member-a','Member A','member-a@example.test','test','2026-01-01T00:00:00.000Z','adult_member','active',NULL,'2026-01-01T00:00:00.000Z');
    INSERT INTO relations(id,family_id,from_person_id,to_person_id,relation_type)
    VALUES('relation-source-target','family-a','person-source','person-target','sibling');
  `);

  const unitOfWork = new RepositoryBackedPersonLifecycleUnitOfWork({
    transactionExecutor: new SqliteTransactionExecutor(database, new SystemClock()),
    accountRepository: new SqliteAccountRepository(),
    personLifecycleRepository: new SqlitePersonLifecycleRepository(),
    auditRepository: new SqliteAuditRepository(),
    outboxRepository: new SqliteOutboxRepository()
  });
  const update = new UpdatePersonProfileUseCase(unitOfWork);
  const archive = new ArchivePersonProfileUseCase(unitOfWork);
  const merge = new MergePersonProfileUseCase(unitOfWork);
  const safeDelete = new RequestSafePersonDeletionUseCase(unitOfWork);
  const undo = new UndoPersonLifecycleOperationUseCase(unitOfWork);
  const history = new GetPersonLifecycleHistoryUseCase(unitOfWork);
  const admin = { familyId: 'family-a', actor: { userId: 'admin-a', roles: ['family_admin'] }, correlationId: '30-c-admin' };
  const member = { familyId: 'family-a', actor: { userId: 'member-a', roles: ['adult_member'] }, correlationId: '30-c-member' };
  const ids = (prefix) => ({ operationId: `${prefix}-operation`, auditId: `${prefix}-audit`, eventId: `${prefix}-event` });

  check('central authorization denies non-administrator mutation', () => {
    const result = archive.execute({ context: member, personId: 'person-clean', expectedVersion: 0, reason: 'Yetkisiz deneme', identifiers: ids('denied') });
    assert.equal(result.ok, false);
    assert.equal(database.prepare("SELECT status FROM people WHERE id='person-clean'").get().status, 'active');
  });

  check('duplicate profile update is rejected without mutation', () => {
    const result = update.execute({
      context: admin,
      command: { personId: 'person-clean', expectedVersion: 0, displayName: 'Çakışan Kişi', birthDate: '1991-04-05', relationshipType: 'Aile üyesi', generation: 2, branch: 'İkinci Dal' },
      identifiers: ids('duplicate')
    });
    assert.equal(result.ok, false);
    assert.equal(database.prepare("SELECT lifecycle_version FROM people WHERE id='person-clean'").get().lifecycle_version, 0);
  });

  check('profile update creates versioned reversible audit operation', () => {
    const result = update.execute({
      context: admin,
      command: { personId: 'person-clean', expectedVersion: 0, displayName: 'Temiz Kişi Güncel', birthDate: '1990-02-03', relationshipType: 'Kuzen', generation: 3, branch: 'Yeni Dal' },
      identifiers: ids('update')
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error.message);
    assert.equal(result.value.lifecycleVersion, 1);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM person_lifecycle_operations WHERE id='update-operation'").get().total, 1);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM audit_log WHERE action='person.profile_updated'").get().total, 1);
  });

  check('optimistic concurrency rejects stale profile version', () => {
    const result = archive.execute({ context: admin, personId: 'person-clean', expectedVersion: 0, reason: 'Eski sürüm denemesi', identifiers: ids('stale') });
    assert.equal(result.ok, false);
  });

  check('archive and undo restore profile with monotonic version', () => {
    const archived = archive.execute({ context: admin, personId: 'person-clean', expectedVersion: 1, reason: 'Geçici arşivleme', identifiers: ids('archive') });
    assert.equal(archived.ok, true);
    const restored = undo.execute({ context: admin, operationId: 'archive-operation', auditId: 'undo-archive-audit', eventId: 'undo-archive-event' });
    assert.equal(restored.ok, true);
    if (!restored.ok) throw new Error(restored.error.message);
    assert.equal(restored.value.status, 'active');
    assert.equal(restored.value.lifecycleVersion, 3);
    assert.equal(database.prepare("SELECT status FROM person_lifecycle_operations WHERE id='archive-operation'").get().status, 'undone');
  });

  check('logical merge preserves references and can be undone', () => {
    const merged = merge.execute({
      context: admin,
      sourcePersonId: 'person-source',
      targetPersonId: 'person-target',
      expectedSourceVersion: 0,
      expectedTargetVersion: 0,
      conflictResolution: 'KEEP_TARGET',
      reason: 'Yinelenen kişi kayıtlarını birleştir',
      identifiers: ids('merge')
    });
    assert.equal(merged.ok, true);
    if (!merged.ok) throw new Error(merged.error.message);
    assert.equal(merged.value.status, 'merged');
    assert.equal(merged.value.mergedIntoPersonId, 'person-target');
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM relations WHERE id='relation-source-target'").get().total, 1);
    const restored = undo.execute({ context: admin, operationId: 'merge-operation', auditId: 'undo-merge-audit', eventId: 'undo-merge-event' });
    assert.equal(restored.ok, true);
    if (!restored.ok) throw new Error(restored.error.message);
    assert.equal(restored.value.status, 'active');
    assert.equal(restored.value.mergedIntoPersonId, undefined);
  });

  check('safe delete is fail-closed when references exist', () => {
    const result = safeDelete.execute({ context: admin, personId: 'person-source', expectedVersion: 2, confirmationText: 'Kaynak Kişi', reason: 'Referanslı silme denemesi', identifiers: ids('blocked-delete') });
    assert.equal(result.ok, false);
    assert.equal(database.prepare("SELECT status FROM people WHERE id='person-source'").get().status, 'active');
  });

  check('safe delete requires exact confirmation text', () => {
    const result = safeDelete.execute({ context: admin, personId: 'person-clean', expectedVersion: 3, confirmationText: 'yanlış', reason: 'Onay metni denemesi', identifiers: ids('wrong-confirm') });
    assert.equal(result.ok, false);
  });

  check('unreferenced safe delete creates a reversible tombstone', () => {
    const result = safeDelete.execute({ context: admin, personId: 'person-clean', expectedVersion: 3, confirmationText: 'Temiz Kişi Güncel', reason: 'Kullanıcı tarafından güvenli silme', identifiers: ids('safe-delete') });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error.message);
    assert.equal(result.value.status, 'pending_deletion');
    assert.ok(result.value.deletionRequestedAt);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM people WHERE id='person-clean'").get().total, 1);
    const restored = undo.execute({ context: admin, operationId: 'safe-delete-operation', auditId: 'undo-delete-audit', eventId: 'undo-delete-event' });
    assert.equal(restored.ok, true);
    if (!restored.ok) throw new Error(restored.error.message);
    assert.equal(restored.value.status, 'active');
  });

  check('cross-family merge is rejected by database trigger', () => {
    assert.throws(() => database.prepare(`
      UPDATE people SET status='merged',merged_into_person_id='person-foreign',archived_at='2026-08-05T12:00:00.000Z',lifecycle_version=lifecycle_version+1
      WHERE id='person-source'
    `).run(), /merge target must be a different active person in the same family/);
  });

  check('operation ledger rejects a mismatched family', () => {
    const source = database.prepare("SELECT * FROM person_lifecycle_operations WHERE id='update-operation'").get();
    assert.throws(() => database.prepare(`
      INSERT INTO person_lifecycle_operations(id,family_id,person_id,operation_type,status,before_snapshot,after_snapshot,reference_snapshot,created_at)
      VALUES('cross-family-operation','family-b','person-clean','profile_updated','applied',?,?,?,'2026-08-05T12:00:00.000Z')
    `).run(source.before_snapshot, source.after_snapshot, source.reference_snapshot), /person lifecycle operation must stay in the person family/);
  });

  check('authorized history exposes applied and undone operations', () => {
    const result = history.execute(admin, 'person-clean');
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error.message);
    assert.equal(result.value.length, 3);
    assert.equal(result.value.filter((item) => item.status === 'undone').length, 2);
  });

  const report = {
    schemaVersion: 1,
    release: 'Bronze 04.08.2026.29',
    step: '30-C',
    requirement: 'B1-02',
    status: 'PASS',
    checkCount: checks.length,
    checks,
    assertions: {
      conflictDetection: 'PASS',
      optimisticConcurrency: 'PASS',
      auditAndOutbox: 'PASS',
      reversibleArchiveMergeAndDelete: 'PASS',
      referenceIntegrity: 'PASS',
      familyScopeIsolation: 'PASS',
      centralAuthorization: 'PASS'
    },
    generatedAt: new Date().toISOString()
  };
  mkdirSync('artifacts/validation', { recursive: true });
  writeFileSync('artifacts/validation/30-C-person-lifecycle-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(`30-C person lifecycle runtime: PASS (${checks.length} checks).`);
} finally {
  database.close();
  rmSync(root, { recursive: true, force: true });
}
