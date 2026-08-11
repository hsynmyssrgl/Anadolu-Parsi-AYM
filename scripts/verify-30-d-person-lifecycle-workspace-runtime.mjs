import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  ArchivePersonProfileUseCase,
  GetPersonLifecycleWorkspaceUseCase,
  UndoPersonLifecycleOperationUseCase,
  UpdatePersonProfileUseCase
} from '../packages/application/dist/index.js';
import { SystemClock } from '../packages/core/dist/index.js';
import { runFamilyDatabaseMigrations, SqliteTransactionExecutor } from '../packages/database/dist/index.js';
import { SqliteAccountRepository, SqliteAuditRepository, SqliteOutboxRepository, SqlitePersonLifecycleRepository } from '../packages/repositories/dist/index.js';
import { RepositoryBackedPersonLifecycleUnitOfWork } from '../apps/desktop/dist/main/person-lifecycle-application-adapter.js';

const root = mkdtempSync(join(tmpdir(), 'ppt-30-d-person-lifecycle-workspace-'));
const databasePath = join(root, 'runtime.db');
const database = new DatabaseSync(databasePath);
const checks = [];
const check = (name, operation) => { operation(); checks.push(name); };

try {
  database.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
  runFamilyDatabaseMigrations({ database, databasePath, applicationVersion: '04.08.2026.29', skipFileSafetyBackup: true });
  database.exec(`
    INSERT INTO families(id,name,created_at) VALUES('family-a','A Ailesi','2026-01-01T00:00:00.000Z');
    INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at) VALUES
      ('person-a','family-a','Ada Pars','1990-01-02','Aile üyesi',1,'Ana Dal','active','2026-01-01T00:00:00.000Z');
    INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at) VALUES
      ('admin-a','Admin A','admin-a@example.test','test','2026-01-01T00:00:00.000Z','family_admin','active','person-a','2026-01-01T00:00:00.000Z'),
      ('member-a','Member A','member-a@example.test','test','2026-01-01T00:00:00.000Z','adult_member','active',NULL,'2026-01-01T00:00:00.000Z');
  `);
  const unitOfWork = new RepositoryBackedPersonLifecycleUnitOfWork({
    transactionExecutor: new SqliteTransactionExecutor(database, new SystemClock()),
    accountRepository: new SqliteAccountRepository(),
    personLifecycleRepository: new SqlitePersonLifecycleRepository(),
    auditRepository: new SqliteAuditRepository(),
    outboxRepository: new SqliteOutboxRepository()
  });
  const workspace = new GetPersonLifecycleWorkspaceUseCase(unitOfWork);
  const update = new UpdatePersonProfileUseCase(unitOfWork);
  const archive = new ArchivePersonProfileUseCase(unitOfWork);
  const undo = new UndoPersonLifecycleOperationUseCase(unitOfWork);
  const admin = { familyId: 'family-a', actor: { userId: 'admin-a', roles: ['family_admin'] }, correlationId: '30-d-admin' };
  const member = { familyId: 'family-a', actor: { userId: 'member-a', roles: ['adult_member'] }, correlationId: '30-d-member' };
  const ids = (prefix) => ({ operationId: `${prefix}-operation`, auditId: `${prefix}-audit`, eventId: `${prefix}-event` });

  check('authorized workspace initially returns current profile and empty history', () => {
    const result = workspace.execute(admin, 'person-a');
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error.message);
    assert.equal(result.value.profile.displayName, 'Ada Pars');
    assert.equal(result.value.profile.lifecycleVersion, 0);
    assert.equal(result.value.operations.length, 0);
  });
  check('non-administrator workspace access fails closed', () => {
    assert.equal(workspace.execute(member, 'person-a').ok, false);
  });
  check('versioned update becomes visible in the same workspace read', () => {
    const result = update.execute({ context: admin, command: { personId: 'person-a', expectedVersion: 0, displayName: 'Ada Pars Güncel', birthDate: '1990-01-02', relationshipType: 'Kuzen', generation: 2, branch: 'İkinci Dal' }, identifiers: ids('update') });
    assert.equal(result.ok, true);
    const current = workspace.execute(admin, 'person-a');
    assert.equal(current.ok, true);
    if (!current.ok) throw new Error(current.error.message);
    assert.equal(current.value.profile.lifecycleVersion, 1);
    assert.equal(current.value.operations[0]?.operationType, 'profile_updated');
    assert.equal(current.value.operations[0]?.status, 'applied');
  });
  check('archive is exposed as a reversible current operation', () => {
    const result = archive.execute({ context: admin, personId: 'person-a', expectedVersion: 1, reason: 'Geçici arşiv denetimi', identifiers: ids('archive') });
    assert.equal(result.ok, true);
    const current = workspace.execute(admin, 'person-a');
    assert.equal(current.ok, true);
    if (!current.ok) throw new Error(current.error.message);
    assert.equal(current.value.profile.status, 'archived');
    assert.equal(current.value.operations[0]?.id, 'archive-operation');
    assert.equal(current.value.operations[0]?.after.lifecycleVersion, current.value.profile.lifecycleVersion);
  });
  check('undo advances the version while restoring the prior state', () => {
    const result = undo.execute({ context: admin, operationId: 'archive-operation', auditId: 'undo-audit', eventId: 'undo-event' });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error.message);
    assert.equal(result.value.status, 'active');
    assert.equal(result.value.lifecycleVersion, 3);
  });
  check('workspace marks the reversed operation without erasing evidence', () => {
    const current = workspace.execute(admin, 'person-a');
    assert.equal(current.ok, true);
    if (!current.ok) throw new Error(current.error.message);
    assert.equal(current.value.operations.length, 2);
    assert.equal(current.value.operations.find(item => item.id === 'archive-operation')?.status, 'undone');
  });
  check('audit and outbox evidence remain transactionally recorded', () => {
    assert.equal(database.prepare('SELECT COUNT(*) AS total FROM audit_log').get().total, 3);
    assert.equal(database.prepare('SELECT COUNT(*) AS total FROM event_outbox').get().total, 3);
  });

  const report = { schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '30-D', requirement: 'B1-02', status: 'PASS', checkCount: checks.length, checks, generatedAt: new Date().toISOString() };
  mkdirSync('artifacts/validation', { recursive: true });
  writeFileSync('artifacts/validation/30-D-person-lifecycle-workspace-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(`30-D person lifecycle workspace runtime: PASS (${checks.length} checks).`);
} finally {
  database.close();
  rmSync(root, { recursive: true, force: true });
}
