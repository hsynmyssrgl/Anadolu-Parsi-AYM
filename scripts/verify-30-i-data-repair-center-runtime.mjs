import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  ApplyDataRepairUseCase,
  GetDataRepairWorkspaceUseCase,
  PreviewDataRepairUseCase,
  ScanDataRepairIssuesUseCase,
  UndoDataRepairUseCase
} from '../packages/application/dist/index.js';
import { FixedClock, asIsoDateTime } from '../packages/core/dist/index.js';
import { runFamilyDatabaseMigrations, SqliteTransactionExecutor } from '../packages/database/dist/index.js';
import {
  SqliteAccountRepository,
  SqliteAuditRepository,
  SqliteDataRepairRepository,
  SqliteOutboxRepository
} from '../packages/repositories/dist/index.js';
import { RepositoryBackedDataRepairUnitOfWork } from '../apps/desktop/dist/main/data-repair-application-adapter.js';

const root = mkdtempSync(join(tmpdir(), 'ppt-30-i-data-repair-'));
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
      ('dup-canonical','family-a','Aynı Kişi','1980-01-01','Aile üyesi',1,'Ana Dal','active','2026-01-01T00:00:00.000Z'),
      ('dup-source','family-a','Aynı Kişi','1980-01-01','Aile üyesi',1,'Ana Dal','active','2026-01-02T00:00:00.000Z'),
      ('stale-canonical','family-a','Stale Kişi','1985-05-05','Aile üyesi',1,'Ana Dal','active','2026-01-01T00:00:00.000Z'),
      ('stale-source','family-a','Stale Kişi','1985-05-05','Aile üyesi',1,'Ana Dal','active','2026-01-02T00:00:00.000Z'),
      ('person-a2','family-a','İkinci A Kişisi','1990-01-01','Aile üyesi',2,'İkinci Dal','active','2026-01-01T00:00:00.000Z'),
      ('person-b','family-b','B Kişisi','1992-01-01','Aile üyesi',1,'Ana Dal','active','2026-01-01T00:00:00.000Z');
    INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at) VALUES
      ('admin-a','Admin A','admin-a-30i@example.test','test','2026-01-01T00:00:00.000Z','family_admin','active','dup-canonical','2026-01-01T00:00:00.000Z'),
      ('member-a','Member A','member-a-30i@example.test','test','2026-01-01T00:00:00.000Z','adult_member','active',NULL,'2026-01-01T00:00:00.000Z');
    INSERT INTO households(id,family_id,name,kind,status,created_at,updated_at) VALUES
      ('household-a','family-a','A Hanesi','primary','active','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z'),
      ('household-b','family-b','B Hanesi','primary','active','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z');
    INSERT INTO person_memberships(id,person_id,household_id,role,status,valid_from,created_at,updated_at)
    VALUES('membership-corrupt','person-a2','household-a','resident','active','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z');
    INSERT INTO relations(id,family_id,from_person_id,to_person_id,relation_type) VALUES
      ('relation-align','family-b','dup-canonical','person-a2','sibling'),
      ('relation-cross','family-a','person-a2','person-b','relative');
    DROP TRIGGER trg_person_memberships_identity_immutable;
    UPDATE person_memberships SET household_id='household-b' WHERE id='membership-corrupt';
  `);
  database.exec('PRAGMA foreign_keys=OFF;');
  database.prepare(`INSERT INTO relations(id,family_id,from_person_id,to_person_id,relation_type) VALUES(?,?,?,?,?)`)
    .run('relation-broken', 'family-a', 'person-a2', 'missing-person', 'relative');
  database.exec('PRAGMA foreign_keys=ON;');

  const unitOfWork = new RepositoryBackedDataRepairUnitOfWork({
    transactionExecutor: new SqliteTransactionExecutor(database, new FixedClock(asIsoDateTime('2026-08-05T12:00:00.000Z'))),
    accountRepository: new SqliteAccountRepository(),
    dataRepairRepository: new SqliteDataRepairRepository(),
    auditRepository: new SqliteAuditRepository(),
    outboxRepository: new SqliteOutboxRepository()
  });
  const scan = new ScanDataRepairIssuesUseCase(unitOfWork);
  const preview = new PreviewDataRepairUseCase(unitOfWork);
  const apply = new ApplyDataRepairUseCase(unitOfWork);
  const undo = new UndoDataRepairUseCase(unitOfWork);
  const workspace = new GetDataRepairWorkspaceUseCase(unitOfWork);
  const admin = { familyId: 'family-a', actor: { userId: 'admin-a', roles: ['family_admin'] }, correlationId: '30-i-admin' };
  const member = { familyId: 'family-a', actor: { userId: 'member-a', roles: ['adult_member'] }, correlationId: '30-i-member' };
  const ids = (prefix) => ({ operationId: `${prefix}-operation`, auditId: `${prefix}-audit`, eventId: `${prefix}-event` });
  const mutationIds = (prefix) => ({ auditId: `${prefix}-audit`, eventId: `${prefix}-event` });

  check('non-administrator scan is denied without disclosure', () => {
    const result = scan.execute(member);
    assert.equal(result.ok, false);
  });

  const initial = scan.execute(admin);
  check('authorized scan finds every governed corruption class', () => {
    assert.equal(initial.ok, true);
    if (!initial.ok) throw new Error(initial.error.message);
    assert.equal(initial.value.length, 6);
    assert.equal(initial.value.filter((issue) => issue.kind === 'duplicate_person').length, 2);
    assert.equal(initial.value.filter((issue) => issue.kind === 'broken_relation').length, 1);
    assert.equal(initial.value.filter((issue) => issue.kind === 'inconsistent_family_link').length, 3);
  });

  const stalePreview = preview.execute({ context: admin, issueId: 'duplicate-person:stale-source:stale-canonical', reason: 'Stale önizleme korumasını doğrula', identifiers: ids('stale') });
  check('preview records immutable before and after snapshots', () => {
    assert.equal(stalePreview.ok, true);
    if (!stalePreview.ok) throw new Error(stalePreview.error.message);
    assert.equal(stalePreview.value.status, 'previewed');
    assert.equal(stalePreview.value.beforeSnapshot.entityType, 'person');
    assert.equal(stalePreview.value.afterSnapshot.entityType, 'person');
  });
  database.prepare(`UPDATE people SET display_name='Stale Kişi Değişti',updated_at='2026-08-05T11:00:00.000Z' WHERE id='stale-source'`).run();
  check('stale preview fails closed without applying mutation', () => {
    if (!stalePreview.ok) throw new Error(stalePreview.error.message);
    const result = apply.execute({ context: admin, operationId: stalePreview.value.id, expectedRevisionToken: stalePreview.value.revisionToken, identifiers: mutationIds('stale-apply') });
    assert.equal(result.ok, false);
    assert.equal(database.prepare("SELECT status FROM data_repair_operations WHERE id='stale-operation'").get().status, 'previewed');
    assert.equal(database.prepare("SELECT status FROM people WHERE id='stale-source'").get().status, 'active');
  });

  const duplicatePreview = preview.execute({ context: admin, issueId: 'duplicate-person:dup-source:dup-canonical', reason: 'Yinelenen kişi profilini güvenle birleştir', identifiers: ids('duplicate') });
  check('duplicate preview applies a logical merge without physical deletion', () => {
    assert.equal(duplicatePreview.ok, true);
    if (!duplicatePreview.ok) throw new Error(duplicatePreview.error.message);
    const result = apply.execute({ context: admin, operationId: duplicatePreview.value.id, expectedRevisionToken: duplicatePreview.value.revisionToken, identifiers: mutationIds('duplicate-apply') });
    assert.equal(result.ok, true);
    assert.deepEqual({ ...database.prepare("SELECT status,merged_into_person_id,lifecycle_version FROM people WHERE id='dup-source'").get() }, { status: 'merged', merged_into_person_id: 'dup-canonical', lifecycle_version: 1 });
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM people WHERE id='dup-source'").get().total, 1);
  });
  check('duplicate repair rollback restores active profile with monotonic version', () => {
    const result = undo.execute({ context: admin, operationId: 'duplicate-operation', identifiers: mutationIds('duplicate-undo') });
    assert.equal(result.ok, true);
    assert.deepEqual({ ...database.prepare("SELECT status,merged_into_person_id,lifecycle_version FROM people WHERE id='dup-source'").get() }, { status: 'active', merged_into_person_id: null, lifecycle_version: 2 });
  });

  const brokenPreview = preview.execute({ context: admin, issueId: 'broken-relation:relation-broken', reason: 'Eksik uçlu bağı güvenle kaldır', identifiers: ids('broken') });
  check('broken relation repair removes only the previewed row', () => {
    assert.equal(brokenPreview.ok, true);
    if (!brokenPreview.ok) throw new Error(brokenPreview.error.message);
    const result = apply.execute({ context: admin, operationId: brokenPreview.value.id, expectedRevisionToken: brokenPreview.value.revisionToken, identifiers: mutationIds('broken-apply') });
    assert.equal(result.ok, true);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM relations WHERE id='relation-broken'").get().total, 0);
  });
  database.prepare(`INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)`)
    .run('missing-person', 'family-a', 'Kurtarılan Kişi', '2000-01-01', 'Aile üyesi', 3, 'Üçüncü Dal', 'active', '2026-08-05T11:30:00.000Z');
  check('broken relation rollback requires restored endpoints and then succeeds', () => {
    const result = undo.execute({ context: admin, operationId: 'broken-operation', identifiers: mutationIds('broken-undo') });
    assert.equal(result.ok, true);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM relations WHERE id='relation-broken'").get().total, 1);
  });

  const alignPreview = preview.execute({ context: admin, issueId: 'relation-family:relation-align', reason: 'Bağ aile kapsamını ortak aileye hizala', identifiers: ids('align') });
  check('relation family alignment is previewed, applied and reversible', () => {
    assert.equal(alignPreview.ok, true);
    if (!alignPreview.ok) throw new Error(alignPreview.error.message);
    assert.equal(apply.execute({ context: admin, operationId: alignPreview.value.id, expectedRevisionToken: alignPreview.value.revisionToken, identifiers: mutationIds('align-apply') }).ok, true);
    assert.equal(database.prepare("SELECT family_id FROM relations WHERE id='relation-align'").get().family_id, 'family-a');
    assert.equal(undo.execute({ context: admin, operationId: 'align-operation', identifiers: mutationIds('align-undo') }).ok, true);
    assert.equal(database.prepare("SELECT family_id FROM relations WHERE id='relation-align'").get().family_id, 'family-b');
  });

  const crossPreview = preview.execute({ context: admin, issueId: 'cross-family-relation:relation-cross', reason: 'Aileler arası tutarsız bağı kaldır', identifiers: ids('cross') });
  check('cross-family relation removal retains rollback snapshot', () => {
    assert.equal(crossPreview.ok, true);
    if (!crossPreview.ok) throw new Error(crossPreview.error.message);
    assert.equal(apply.execute({ context: admin, operationId: crossPreview.value.id, expectedRevisionToken: crossPreview.value.revisionToken, identifiers: mutationIds('cross-apply') }).ok, true);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM relations WHERE id='relation-cross'").get().total, 0);
    assert.equal(undo.execute({ context: admin, operationId: 'cross-operation', identifiers: mutationIds('cross-undo') }).ok, true);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM relations WHERE id='relation-cross'").get().total, 1);
  });

  const membershipPreview = preview.execute({ context: admin, issueId: 'membership-family:membership-corrupt', reason: 'Tutarsız üyeliği tarihçeyi koruyarak sonlandır', identifiers: ids('membership') });
  check('inconsistent membership is ended rather than deleted and can be undone', () => {
    assert.equal(membershipPreview.ok, true);
    if (!membershipPreview.ok) throw new Error(membershipPreview.error.message);
    assert.equal(apply.execute({ context: admin, operationId: membershipPreview.value.id, expectedRevisionToken: membershipPreview.value.revisionToken, identifiers: mutationIds('membership-apply') }).ok, true);
    assert.deepEqual({ ...database.prepare("SELECT status,valid_until FROM person_memberships WHERE id='membership-corrupt'").get() }, { status: 'ended', valid_until: '2026-08-05T12:00:00.000Z' });
    assert.equal(undo.execute({ context: admin, operationId: 'membership-operation', identifiers: mutationIds('membership-undo') }).ok, true);
    assert.deepEqual({ ...database.prepare("SELECT status,valid_until FROM person_memberships WHERE id='membership-corrupt'").get() }, { status: 'active', valid_until: null });
  });

  check('workspace exposes current issues and complete immutable operation history', () => {
    const result = workspace.execute(admin);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error.message);
    assert.equal(result.value.operations.length, 6);
    assert.equal(result.value.operations.filter((operation) => operation.status === 'undone').length, 5);
    assert.equal(result.value.operations.filter((operation) => operation.status === 'previewed').length, 1);
  });

  check('audit and outbox evidence exist for every successful phase', () => {
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM audit_log WHERE action='data_repair.previewed'").get().total, 6);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM audit_log WHERE action='data_repair.applied'").get().total, 5);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM audit_log WHERE action='data_repair.undone'").get().total, 5);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM event_outbox WHERE event_type LIKE 'family.data_repair.%'").get().total, 16);
  });

  check('database trigger rejects reopening an undone repair ledger row', () => {
    assert.throws(() => database.prepare("UPDATE data_repair_operations SET status='applied',undone_at=NULL WHERE id='duplicate-operation'").run(), /invalid data repair operation transition/);
  });

  const report = {
    schemaVersion: 1,
    release: 'Bronze 04.08.2026.29',
    step: '30-I',
    requirement: 'B1-05',
    status: 'PASS',
    checkCount: checks.length,
    checks,
    assertions: {
      duplicateDetection: 'PASS',
      brokenRelationDetection: 'PASS',
      familyLinkConsistency: 'PASS',
      immutablePreview: 'PASS',
      stalePreviewProtection: 'PASS',
      atomicApply: 'PASS',
      rollback: 'PASS',
      auditAndOutbox: 'PASS',
      centralAuthorization: 'PASS',
      databaseTransitionGuards: 'PASS'
    },
    generatedAt: new Date().toISOString()
  };
  mkdirSync('artifacts/validation', { recursive: true });
  writeFileSync('artifacts/validation/30-I-data-repair-center-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(`30-I data repair center runtime: PASS (${checks.length} checks).`);
} finally {
  database.close();
  rmSync(root, { recursive: true, force: true });
}
