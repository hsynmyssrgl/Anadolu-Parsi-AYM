import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  AssignPersonMembershipUseCase,
  CreateFamilyBranchUseCase,
  CreateHouseholdUseCase,
  EndPersonMembershipUseCase,
  GetHouseholdMembershipWorkspaceUseCase
} from '../packages/application/dist/index.js';
import { SystemClock } from '../packages/core/dist/index.js';
import { runFamilyDatabaseMigrations, SqliteTransactionExecutor } from '../packages/database/dist/index.js';
import {
  SqliteAccountRepository,
  SqliteAuditRepository,
  SqliteHouseholdMembershipRepository,
  SqliteOutboxRepository,
  SqlitePersonRepository
} from '../packages/repositories/dist/index.js';
import { RepositoryBackedHouseholdMembershipUnitOfWork } from '../apps/desktop/dist/main/household-membership-application-adapter.js';

const root = mkdtempSync(join(tmpdir(), 'ppt-30-b-household-workspace-'));
const database = new DatabaseSync(join(root, 'runtime.db'));
const checks = [];
const check = (name, operation) => { operation(); checks.push(name); };

try {
  database.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
  runFamilyDatabaseMigrations({ database, databasePath: join(root, 'runtime.db'), applicationVersion: '04.08.2026.29', skipFileSafetyBackup: true });
  database.exec(`
    INSERT INTO families(id,name,created_at) VALUES
      ('family-a','A Ailesi','2026-01-01T00:00:00.000Z'),
      ('family-b','B Ailesi','2026-01-01T00:00:00.000Z');
    INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at) VALUES
      ('person-a','family-a','Ada Pars',NULL,'Aile üyesi',1,'Ana Dal','active','2026-01-01T00:00:00.000Z'),
      ('person-b','family-b','Bora Pars',NULL,'Aile üyesi',1,'Ana Dal','active','2026-01-01T00:00:00.000Z');
    INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at) VALUES
      ('admin-a','Admin A','admin-a@example.test','test','2026-01-01T00:00:00.000Z','family_admin','active','person-a','2026-01-01T00:00:00.000Z'),
      ('member-a','Member A','member-a@example.test','test','2026-01-01T00:00:00.000Z','adult_member','active',NULL,'2026-01-01T00:00:00.000Z'),
      ('admin-b','Admin B','admin-b@example.test','test','2026-01-01T00:00:00.000Z','family_admin','active','person-b','2026-01-01T00:00:00.000Z');
  `);
  const unitOfWork = new RepositoryBackedHouseholdMembershipUnitOfWork({
    transactionExecutor: new SqliteTransactionExecutor(database, new SystemClock()),
    accountRepository: new SqliteAccountRepository(),
    householdMembershipRepository: new SqliteHouseholdMembershipRepository(),
    personRepository: new SqlitePersonRepository(),
    auditRepository: new SqliteAuditRepository(),
    outboxRepository: new SqliteOutboxRepository()
  });
  const createHousehold = new CreateHouseholdUseCase(unitOfWork);
  const createBranch = new CreateFamilyBranchUseCase(unitOfWork);
  const assign = new AssignPersonMembershipUseCase(unitOfWork);
  const end = new EndPersonMembershipUseCase(unitOfWork);
  const workspace = new GetHouseholdMembershipWorkspaceUseCase(unitOfWork);
  const context = (familyId, userId, role, correlationId) => ({ familyId, actor: { userId, roles: [role] }, correlationId });
  const adminA = context('family-a', 'admin-a', 'family_admin', '30-b-admin-a');
  const adminB = context('family-b', 'admin-b', 'family_admin', '30-b-admin-b');
  const memberA = context('family-a', 'member-a', 'adult_member', '30-b-member-a');

  check('family administrators create independent household scopes', () => {
    assert.equal(createHousehold.execute({ context: adminA, command: { name: 'A Hanesi', kind: 'primary' }, identifiers: { householdId: 'household-a', auditId: 'audit-ha', eventId: 'event-ha' } }).ok, true);
    assert.equal(createHousehold.execute({ context: adminB, command: { name: 'B Hanesi', kind: 'primary' }, identifiers: { householdId: 'household-b', auditId: 'audit-hb', eventId: 'event-hb' } }).ok, true);
  });
  check('branch and person membership are created through governed use cases', () => {
    assert.equal(createBranch.execute({ context: adminA, command: { name: 'A Dalı', householdId: 'household-a' }, identifiers: { branchId: 'branch-a', auditId: 'audit-ba', eventId: 'event-ba' } }).ok, true);
    assert.equal(assign.execute({ context: adminA, command: { personId: 'person-a', householdId: 'household-a', familyBranchId: 'branch-a', role: 'resident', validFrom: '2026-01-01T00:00:00.000Z' }, identifiers: { membershipId: 'membership-a', auditId: 'audit-ma', eventId: 'event-ma' } }).ok, true);
  });
  check('workspace returns the complete authorized family scope', () => {
    const result = workspace.execute(adminA);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error.message);
    assert.deepEqual({ households: result.value.households.length, branches: result.value.branches.length, memberships: result.value.memberships.length }, { households: 1, branches: 1, memberships: 1 });
  });
  check('workspace does not leak another family household', () => {
    const result = workspace.execute(adminA);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error.message);
    assert.equal(result.value.households.some(item => item.id === 'household-b'), false);
  });
  check('non-administrator workspace access fails closed', () => {
    const result = workspace.execute(memberA);
    assert.equal(result.ok, false);
  });
  check('ending through governed use case preserves workspace history', () => {
    const ended = end.execute({ context: adminA, membershipId: 'membership-a', endedAt: '2026-08-01T00:00:00.000Z', identifiers: { auditId: 'audit-end', eventId: 'event-end' } });
    assert.equal(ended.ok, true);
    const result = workspace.execute(adminA);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error.message);
    assert.equal(result.value.memberships[0]?.status, 'ended');
    assert.equal(result.value.memberships[0]?.validUntil, '2026-08-01T00:00:00.000Z');
  });

  const report = { schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '30-B', requirement: 'B1-01', status: 'PASS', checkCount: checks.length, checks, generatedAt: new Date().toISOString() };
  mkdirSync('artifacts/validation', { recursive: true });
  writeFileSync('artifacts/validation/30-B-household-membership-workspace-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(`30-B household membership workspace runtime: PASS (${checks.length} checks).`);
} finally {
  database.close();
  rmSync(root, { recursive: true, force: true });
}
