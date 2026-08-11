import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { EvaluateAuthorizationUseCase, UpsertObjectPermissionUseCase } from '../packages/application/dist/index.js';
import { SystemClock } from '../packages/core/dist/index.js';
import { runFamilyDatabaseMigrations, SqliteTransactionExecutor } from '../packages/database/dist/index.js';
import { SqliteAccountRepository, SqliteAuditRepository, SqliteHouseholdMembershipRepository, SqliteObjectPermissionRepository } from '../packages/repositories/dist/index.js';
import { RepositoryBackedAuthorizationQueryPort, RepositoryBackedAuthorizationUnitOfWork } from '../apps/desktop/dist/main/authorization-application-adapter.js';

const root = mkdtempSync(join(tmpdir(), 'ppt-30-e-authorization-context-'));
const databasePath = join(root, 'runtime.db');
const database = new DatabaseSync(databasePath);
const checks = [];
const check = (name, operation) => { operation(); checks.push(name); };
const at = '2026-08-05T12:00:00.000Z';

try {
  database.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
  runFamilyDatabaseMigrations({ database, databasePath, applicationVersion: '04.08.2026.29', skipFileSafetyBackup: true });
  database.exec(`
    INSERT INTO families(id,name,created_at) VALUES
      ('family-a','A Ailesi','2026-01-01T00:00:00.000Z'),
      ('family-b','B Ailesi','2026-01-01T00:00:00.000Z');
    INSERT INTO people(id,family_id,display_name,relationship_type,generation,branch,status,created_at) VALUES
      ('person-admin','family-a','A Yöneticisi','Yönetici',1,'Ana Dal','active','2026-01-01T00:00:00.000Z'),
      ('person-member','family-a','A Üyesi','Üye',2,'Ana Dal','active','2026-01-01T00:00:00.000Z'),
      ('person-foreign','family-b','B Üyesi','Üye',1,'B Dalı','active','2026-01-01T00:00:00.000Z');
    INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at) VALUES
      ('admin-a','Admin A','admin-a@example.test','test','2026-01-01T00:00:00.000Z','family_admin','active','person-admin','2026-01-01T00:00:00.000Z'),
      ('member-a','Member A','member-a@example.test','test','2026-01-01T00:00:00.000Z','adult_member','active','person-member','2026-01-01T00:00:00.000Z'),
      ('member-b','Member B','member-b@example.test','test','2026-01-01T00:00:00.000Z','adult_member','active','person-foreign','2026-01-01T00:00:00.000Z');
    INSERT INTO households(id,family_id,name,kind,status,created_at,updated_at) VALUES
      ('house-a','family-a','A Hanesi','primary','active','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z'),
      ('house-b','family-b','B Hanesi','primary','active','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z');
    INSERT INTO family_branches(id,family_id,household_id,name,status,created_at,updated_at) VALUES
      ('branch-a','family-a','house-a','A Dalı','active','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z'),
      ('branch-b','family-b','house-b','B Dalı','active','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z');
    INSERT INTO person_memberships(id,person_id,household_id,family_branch_id,role,status,valid_from,created_at,updated_at) VALUES
      ('membership-a','person-member','house-a','branch-a','member','active','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z');
  `);

  const dependencies = {
    transactionExecutor: new SqliteTransactionExecutor(database, new SystemClock()),
    accountRepository: new SqliteAccountRepository(),
    permissionRepository: new SqliteObjectPermissionRepository(),
    householdMembershipRepository: new SqliteHouseholdMembershipRepository(),
    auditRepository: new SqliteAuditRepository()
  };
  const query = new RepositoryBackedAuthorizationQueryPort(dependencies);
  const unit = new RepositoryBackedAuthorizationUnitOfWork(dependencies);
  const evaluate = new EvaluateAuthorizationUseCase(query);
  const upsert = new UpsertObjectPermissionUseCase(unit);
  const context = (suffix) => ({ correlationId: `30-e-${suffix}` });
  const save = (permissionId, command) => upsert.execute({ context: context(permissionId), actorId: 'admin-a', command, permissionId, auditId: `${permissionId}-audit` });

  check('deny permission without an explicit reason fails closed', () => {
    const result = save('deny-missing', { subjectAccountId: 'member-a', resourceType: 'archive_item', resourceId: 'missing', actions: ['read'], effect: 'deny', purpose: 'archive' });
    assert.equal(result.ok, false);
  });
  check('purpose and branch scoped allow is persisted', () => {
    const result = save('allow-archive-a', { subjectAccountId: 'member-a', resourceType: 'archive_item', resourceId: 'record-a', actions: ['read'], effect: 'allow', purpose: 'archive', familyBranchId: 'branch-a', startsAt: '2026-01-01T00:00:00.000Z', endsAt: '2027-01-01T00:00:00.000Z' });
    assert.equal(result.ok, true);
    const row = database.prepare("SELECT purpose,family_branch_id,denial_reason FROM object_permissions WHERE id='allow-archive-a'").get();
    assert.deepEqual({ ...row }, { purpose: 'archive', family_branch_id: 'branch-a', denial_reason: null });
  });
  check('matching purpose and active family branch grants access', () => {
    const result = evaluate.execute({ context: context('matching'), accountId: 'member-a', occurredAt: at, action: 'read', resourceType: 'archive_item', resourceId: 'record-a', purpose: 'archive', resourceBranchId: 'branch-a' });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error.message);
    assert.deepEqual({ allowed: result.value.allowed, reason: result.value.reason, grant: result.value.matchedGrantId }, { allowed: true, reason: 'explicit_allow', grant: 'allow-archive-a' });
  });
  check('purpose mismatch does not reuse a scoped grant', () => {
    const result = evaluate.execute({ context: context('purpose-mismatch'), accountId: 'member-a', occurredAt: at, action: 'read', resourceType: 'archive_item', resourceId: 'record-a', purpose: 'health', resourceBranchId: 'branch-a' });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error.message);
    assert.equal(result.value.allowed, false);
    assert.equal(result.value.reason, 'no_policy');
  });
  check('branch boundary denies access without a matching explicit allow', () => {
    const result = evaluate.execute({ context: context('branch-boundary'), accountId: 'member-a', occurredAt: at, action: 'read', resourceType: 'archive_item', resourceId: 'record-b', purpose: 'archive', resourceBranchId: 'branch-b' });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error.message);
    assert.deepEqual({ allowed: result.value.allowed, reason: result.value.reason }, { allowed: false, reason: 'branch_boundary' });
  });
  check('explicit deny wins and returns its auditable denial reason', () => {
    const saved = save('deny-archive-a', { subjectAccountId: 'member-a', resourceType: 'archive_item', resourceId: 'record-denied', actions: ['read'], effect: 'deny', purpose: 'archive', familyBranchId: 'branch-a', denialReason: 'Mahrem aile arşivi erişime kapalıdır.', startsAt: '2026-01-01T00:00:00.000Z' });
    assert.equal(saved.ok, true);
    const result = evaluate.execute({ context: context('explicit-deny'), accountId: 'member-a', occurredAt: at, action: 'read', resourceType: 'archive_item', resourceId: 'record-denied', purpose: 'archive', resourceBranchId: 'branch-a' });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error.message);
    assert.equal(result.value.allowed, false);
    assert.equal(result.value.reason, 'explicit_deny');
    assert.equal(result.value.denialReason, 'Mahrem aile arşivi erişime kapalıdır.');
  });
  check('expired grant is excluded by the effective time range', () => {
    assert.equal(save('expired-allow', { subjectAccountId: 'member-a', resourceType: 'archive_item', resourceId: 'record-expired', actions: ['read'], effect: 'allow', purpose: 'archive', familyBranchId: 'branch-a', startsAt: '2025-01-01T00:00:00.000Z', endsAt: '2025-12-31T23:59:59.000Z' }).ok, true);
    const result = evaluate.execute({ context: context('expired'), accountId: 'member-a', occurredAt: at, action: 'read', resourceType: 'archive_item', resourceId: 'record-expired', purpose: 'archive', resourceBranchId: 'branch-a' });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error.message);
    assert.equal(result.value.allowed, false);
    assert.equal(result.value.reason, 'no_policy');
  });
  check('family administrator role remains valid across branch boundaries', () => {
    const result = evaluate.execute({ context: context('admin'), accountId: 'admin-a', occurredAt: at, action: 'read', resourceType: 'archive_item', resourceId: 'record-b', purpose: 'archive', resourceBranchId: 'branch-b' });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error.message);
    assert.equal(result.value.allowed, true);
    assert.equal(result.value.reason, 'role');
  });
  check('database rejects cross-family branch scope', () => {
    const result = save('cross-family', { subjectAccountId: 'member-a', resourceType: 'archive_item', resourceId: 'cross', actions: ['read'], effect: 'allow', purpose: 'archive', familyBranchId: 'branch-b' });
    assert.equal(result.ok, false);
  });
  check('database rejects allow rows carrying denial text', () => {
    assert.throws(() => database.prepare(`
      INSERT INTO object_permissions(id,subject_account_id,resource_type,resource_id,actions,effect,purpose,denial_reason,starts_at,created_at)
      VALUES('invalid-allow','member-a','archive_item','invalid','["read"]','allow','archive','Bu alan yalnız ret içindir.','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')
    `).run(), /invalid object permission authorization context/);
  });
  check('successful context changes are audit recorded', () => {
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM audit_log WHERE action='permission.upserted'").get().total, 3);
  });

  const report = { schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '30-E', requirement: 'B1-03', status: 'PASS', checkCount: checks.length, checks, assertions: { purposeContext: 'PASS', familyBranchContext: 'PASS', activeTimeRange: 'PASS', explicitDenialContext: 'PASS', crossFamilyFailClosed: 'PASS', audit: 'PASS' }, generatedAt: new Date().toISOString() };
  mkdirSync('artifacts/validation', { recursive: true });
  writeFileSync('artifacts/validation/30-E-authorization-context-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(`30-E authorization context runtime: PASS (${checks.length} checks).`);
} finally {
  database.close();
  rmSync(root, { recursive: true, force: true });
}
