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
  GetPersonMembershipHistoryUseCase
} from '../packages/application/dist/index.js';
import { ok, SystemClock } from '../packages/core/dist/index.js';
import { runFamilyDatabaseMigrations, SqliteTransactionExecutor } from '../packages/database/dist/index.js';
import {
  SqliteAccountRepository,
  SqliteAuditRepository,
  SqliteHouseholdMembershipRepository,
  SqliteOutboxRepository,
  SqlitePersonRepository
} from '../packages/repositories/dist/index.js';
import { RepositoryBackedHouseholdMembershipUnitOfWork } from '../apps/desktop/dist/main/household-membership-application-adapter.js';

const root = mkdtempSync(join(tmpdir(), 'ppt-30-a-household-membership-'));
const databasePath = join(root, 'runtime.db');
const database = new DatabaseSync(databasePath);
const checks = [];
const check = (name, operation) => {
  operation();
  checks.push(name);
};
const assertRejected = (operation, pattern) => {
  assert.throws(operation, (error) => pattern.test(String(error?.message ?? error)));
};

try {
  database.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
  runFamilyDatabaseMigrations({
    database,
    databasePath,
    applicationVersion: '04.08.2026.29',
    skipFileSafetyBackup: true
  });
  database.exec(`
    INSERT INTO families(id,name,created_at) VALUES
      ('family-a','A Ailesi','2026-01-01T00:00:00.000Z'),
      ('family-b','B Ailesi','2026-01-01T00:00:00.000Z');
    INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at) VALUES
      ('person-a','family-a','Ada Pars',NULL,'Aile üyesi',1,'Ana Dal','active','2026-01-01T00:00:00.000Z'),
      ('person-b','family-b','Bora Pars',NULL,'Aile üyesi',1,'Ana Dal','active','2026-01-01T00:00:00.000Z');
  `);

  const repository = new SqliteHouseholdMembershipRepository();
  const personRepository = new SqlitePersonRepository();
  const occurredAt = '2026-08-05T11:40:00.000Z';
  const adminContext = {
    familyId: 'family-a',
    actor: { userId: 'admin-a', roles: ['family_admin'] },
    correlationId: '30-a-runtime-admin'
  };
  const memberContext = {
    familyId: 'family-a',
    actor: { userId: 'member-a', roles: ['adult_member'] },
    correlationId: '30-a-runtime-member'
  };

  const repositoryContextFor = (applicationContext) => ({
    transaction: database,
    actor: applicationContext.actor,
    correlationId: applicationContext.correlationId,
    occurredAt
  });
  const makeScope = (applicationContext) => {
    const context = repositoryContextFor(applicationContext);
    return {
      occurredAt,
      authorizeAdministration: () => ok(applicationContext.actor.roles.includes('family_admin')),
      findPerson: (personId) => {
        const result = personRepository.findById(context, personId);
        if (!result.ok || !result.value) return result;
        return ok({ id: result.value.id, familyId: result.value.familyId });
      },
      findHousehold: (id) => repository.findHousehold(context, id),
      findBranch: (id) => repository.findBranch(context, id),
      findMembership: (id) => repository.findMembership(context, id),
      listHouseholds: (familyId) => repository.listHouseholds(context, familyId),
      listBranches: (familyId) => repository.listBranches(context, familyId),
      listMembershipsByPerson: (personId) => repository.listMembershipsByPerson(context, personId),
      hasOverlappingMembership: (input) => repository.hasOverlappingMembership(context, input),
      insertHousehold: (value) => repository.insertHousehold(context, value),
      insertBranch: (value) => repository.insertBranch(context, value),
      insertMembership: (value) => repository.insertMembership(context, value),
      updateMembershipStatus: (input) => repository.updateMembershipStatus(context, input),
      appendAudit: (input) => ok(`audit:${input.id}`),
      enqueueEvent: () => ok(undefined)
    };
  };
  const unitOfWork = {
    execute: (applicationContext, operation) => operation(makeScope(applicationContext))
  };

  const createHousehold = new CreateHouseholdUseCase(unitOfWork);
  const createBranch = new CreateFamilyBranchUseCase(unitOfWork);
  const assignMembership = new AssignPersonMembershipUseCase(unitOfWork);
  const endMembership = new EndPersonMembershipUseCase(unitOfWork);
  const getHistory = new GetPersonMembershipHistoryUseCase(unitOfWork);

  check('non-admin household mutation is denied before persistence', () => {
    const result = createHousehold.execute({
      context: memberContext,
      command: { name: 'Yetkisiz Hane', kind: 'primary' },
      identifiers: { householdId: 'household-denied', auditId: 'audit-denied', eventId: 'event-denied' }
    });
    assert.equal(result.ok, false);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM households WHERE id='household-denied'").get().total, 0);
  });

  check('desktop adapter delegates role enforcement to central authorization and account state', () => {
    database.exec(`
      INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at)
      VALUES
        ('adapter-admin','Adapter Admin','adapter-admin@example.test','test','2026-01-01T00:00:00.000Z','family_admin','active','person-a','2026-01-01T00:00:00.000Z'),
        ('adapter-member','Adapter Member','adapter-member@example.test','test','2026-01-01T00:00:00.000Z','adult_member','active',NULL,'2026-01-01T00:00:00.000Z');
    `);
    const actualUnitOfWork = new RepositoryBackedHouseholdMembershipUnitOfWork({
      transactionExecutor: new SqliteTransactionExecutor(database, new SystemClock()),
      accountRepository: new SqliteAccountRepository(),
      householdMembershipRepository: repository,
      personRepository,
      auditRepository: new SqliteAuditRepository(),
      outboxRepository: new SqliteOutboxRepository()
    });
    const actualUseCase = new CreateHouseholdUseCase(actualUnitOfWork);
    const deniedResult = actualUseCase.execute({
      context: {
        familyId: 'family-a',
        actor: { userId: 'adapter-member', roles: ['adult_member'] },
        correlationId: '30-a-adapter-member'
      },
      command: { name: 'Adapter Yetkisiz Hane', kind: 'other' },
      identifiers: { householdId: 'household-adapter-denied', auditId: 'audit-adapter-denied', eventId: 'event-adapter-denied' }
    });
    assert.equal(deniedResult.ok, false);
    const allowedResult = actualUseCase.execute({
      context: {
        familyId: 'family-a',
        actor: { userId: 'adapter-admin', roles: ['family_admin'] },
        correlationId: '30-a-adapter-admin'
      },
      command: { name: 'Adapter Yetkili Hane', kind: 'other' },
      identifiers: { householdId: 'household-adapter-allowed', auditId: 'audit-adapter-allowed', eventId: 'event-adapter-allowed' }
    });
    assert.equal(allowedResult.ok, true);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM households WHERE id='household-adapter-denied'").get().total, 0);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM households WHERE id='household-adapter-allowed'").get().total, 1);
  });

  check('family admin creates two households and scoped branches', () => {
    for (const [householdId, branchId, name, kind] of [
      ['household-a1', 'branch-a1', 'Ana Hane', 'primary'],
      ['household-a2', 'branch-a2', 'Yazlık Hane', 'shared']
    ]) {
      const household = createHousehold.execute({
        context: adminContext,
        command: { name, kind },
        identifiers: { householdId, auditId: `audit-${householdId}`, eventId: `event-${householdId}` }
      });
      assert.equal(household.ok, true);
      const branch = createBranch.execute({
        context: adminContext,
        command: { name: `${name} Dalı`, householdId },
        identifiers: { branchId, auditId: `audit-${branchId}`, eventId: `event-${branchId}` }
      });
      assert.equal(branch.ok, true);
    }
  });

  check('one person holds simultaneous memberships in different household and branch scopes', () => {
    for (const [membershipId, householdId, familyBranchId, role] of [
      ['membership-a1', 'household-a1', 'branch-a1', 'resident'],
      ['membership-a2', 'household-a2', 'branch-a2', 'member']
    ]) {
      const result = assignMembership.execute({
        context: adminContext,
        command: {
          personId: 'person-a',
          householdId,
          familyBranchId,
          role,
          validFrom: '2026-01-01T00:00:00.000Z'
        },
        identifiers: { membershipId, auditId: `audit-${membershipId}`, eventId: `event-${membershipId}` }
      });
      assert.equal(result.ok, true);
    }
    const history = getHistory.execute(adminContext, 'person-a');
    assert.equal(history.ok, true);
    if (!history.ok) throw new Error(history.error.message);
    assert.equal(history.value.length, 2);
  });

  check('overlapping identical membership is rejected by use-case and database trigger', () => {
    const result = assignMembership.execute({
      context: adminContext,
      command: {
        personId: 'person-a',
        householdId: 'household-a1',
        familyBranchId: 'branch-a1',
        role: 'resident',
        validFrom: '2026-06-01T00:00:00.000Z'
      },
      identifiers: { membershipId: 'membership-overlap', auditId: 'audit-overlap', eventId: 'event-overlap' }
    });
    assert.equal(result.ok, false);
    assertRejected(() => database.prepare(`
      INSERT INTO person_memberships(
        id,person_id,household_id,family_branch_id,role,status,valid_from,valid_until,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?)
    `).run(
      'membership-overlap-direct','person-a','household-a1','branch-a1','resident','active',
      '2026-06-01T00:00:00.000Z',null,occurredAt,occurredAt
    ), /overlapping person membership interval/);
  });

  check('ending a membership preserves history and allows a contiguous later interval', () => {
    const ended = endMembership.execute({
      context: adminContext,
      membershipId: 'membership-a1',
      endedAt: '2026-07-01T00:00:00.000Z',
      identifiers: { auditId: 'audit-end-a1', eventId: 'event-end-a1' }
    });
    assert.equal(ended.ok, true);
    const next = assignMembership.execute({
      context: adminContext,
      command: {
        personId: 'person-a',
        householdId: 'household-a1',
        familyBranchId: 'branch-a1',
        role: 'guardian',
        validFrom: '2026-07-01T00:00:00.000Z'
      },
      identifiers: { membershipId: 'membership-a3', auditId: 'audit-a3', eventId: 'event-a3' }
    });
    assert.equal(next.ok, true);
    const rows = database.prepare(`
      SELECT id,status,valid_from,valid_until FROM person_memberships
      WHERE person_id='person-a' AND household_id='household-a1'
      ORDER BY valid_from,id
    `).all();
    assert.deepEqual(rows.map((row) => ({ ...row })), [
      { id: 'membership-a1', status: 'ended', valid_from: '2026-01-01T00:00:00.000Z', valid_until: '2026-07-01T00:00:00.000Z' },
      { id: 'membership-a3', status: 'active', valid_from: '2026-07-01T00:00:00.000Z', valid_until: null }
    ]);
  });

  check('cross-family person and household membership is rejected fail-closed', () => {
    database.prepare(`
      INSERT INTO households(id,family_id,name,kind,status,created_at,updated_at)
      VALUES('household-b1','family-b','B Hanesi','primary','active',?,?)
    `).run(occurredAt, occurredAt);
    assertRejected(() => database.prepare(`
      INSERT INTO person_memberships(
        id,person_id,household_id,family_branch_id,role,status,valid_from,valid_until,created_at,updated_at
      ) VALUES('membership-cross','person-a','household-b1',NULL,'member','active','2026-01-01T00:00:00.000Z',NULL,?,?)
    `).run(occurredAt, occurredAt), /person membership household must belong to the person family/);
  });

  check('branch and household scope mismatch is rejected fail-closed', () => {
    assertRejected(() => database.prepare(`
      INSERT INTO person_memberships(
        id,person_id,household_id,family_branch_id,role,status,valid_from,valid_until,created_at,updated_at
      ) VALUES('membership-branch-mismatch','person-a','household-a2','branch-a1','member','active','2027-01-01T00:00:00.000Z',NULL,?,?)
    `).run(occurredAt, occurredAt), /person membership branch must belong to the selected household scope/);
  });

  check('historical membership identity cannot be rewritten', () => {
    assertRejected(() => database.prepare(`
      UPDATE person_memberships SET household_id='household-a2' WHERE id='membership-a1'
    `).run(), /person membership historical identity is immutable/);
  });

  check('invalid chronology is rejected by schema checks', () => {
    assertRejected(() => database.prepare(`
      INSERT INTO person_memberships(
        id,person_id,household_id,family_branch_id,role,status,valid_from,valid_until,created_at,updated_at
      ) VALUES('membership-invalid-time','person-a','household-a1',NULL,'member','ended','2026-05-01T00:00:00.000Z','2026-04-01T00:00:00.000Z',?,?)
    `).run(occurredAt, occurredAt), /CHECK constraint failed/);
  });

  const report = {
    schemaVersion: 1,
    step: '30-A',
    requirement: 'B1-01',
    release: 'Bronze 04.08.2026.29',
    status: 'PASS',
    checkCount: checks.length,
    checks,
    assertions: {
      multiHouseholdMembership: 'PASS',
      historicalIntervals: 'PASS',
      familyScopeIsolation: 'PASS',
      branchHouseholdScopeIsolation: 'PASS',
      overlapPrevention: 'PASS',
      administrativeAuthorization: 'PASS',
      immutableHistoricalIdentity: 'PASS'
    },
    generatedAt: new Date().toISOString()
  };
  mkdirSync('artifacts/validation', { recursive: true });
  writeFileSync('artifacts/validation/30-A-household-membership-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(`30-A household membership runtime: PASS (${checks.length} checks).`);
} finally {
  database.close();
  rmSync(root, { recursive: true, force: true });
}
