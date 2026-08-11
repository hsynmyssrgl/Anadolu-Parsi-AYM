import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { FixedClock, asIsoDateTime } from '../packages/core/dist/index.js';

const root = mkdtempSync(join(tmpdir(), 'ppt-30-f-authorization-workspace-'));
const databasePath = join(root, 'family.db');
const deviceIdentityPath = join(root, 'device');
const clock = new FixedClock(asIsoDateTime('2026-08-05T12:00:00.000Z'));
const checks = [];
const check = (name, operation) => { operation(); checks.push(name); };
const adminPassword = 'BaglamsalYonetici!2026';
const memberPassword = 'BaglamsalUye!2026';
let store;

try {
  store = new FamilyDataStore({ databasePath, deviceIdentityPath, clock, applicationVersion: '04.08.2026.29' });
  store.setupAdmin({ displayName: 'Bağlamsal Yönetici', email: 'context-admin@example.test', password: adminPassword });
  const household = store.createHousehold({ name: 'Bağlam Hanesi', kind: 'primary' });
  const branch = store.createFamilyBranch({ name: 'Sağlık Dalı', householdId: household.id });
  const database = new DatabaseSync(databasePath);
  database.prepare(`
    INSERT INTO people(id,family_id,display_name,relationship_type,generation,branch,status,created_at)
    VALUES('person-context-member','family-main','Bağlam Üyesi','Aile üyesi',2,'Sağlık Dalı','active',?)
  `).run(clock.now());
  database.close();
  const invitation = store.createInvitation({ email: 'context-member@example.test', role: 'adult_member', personId: 'person-context-member' });
  store.acceptInvitation({ token: invitation.token, displayName: 'Bağlam Üyesi', password: memberPassword });
  store.logout();
  store.login({ email: 'context-admin@example.test', password: adminPassword });
  const member = store.listAccounts().find((item) => item.email === 'context-member@example.test');
  assert.ok(member);

  check('context workspace returns governed accounts and active family branches', () => {
    const workspace = store.getAuthorizationContextWorkspace();
    assert.equal(workspace.accounts.some((item) => item.id === member.id), true);
    assert.equal(workspace.branches.some((item) => item.id === branch.id && item.status === 'active'), true);
    assert.equal(workspace.permissions.length, 0);
  });

  const permissions = store.upsertPermission({
    subjectAccountId: member.id,
    resourceType: 'health_record',
    resourceId: '*',
    actions: ['read', 'ai_process', 'record'],
    effect: 'allow',
    purpose: 'health',
    familyBranchId: branch.id,
    startsAt: '2026-08-01T00:00:00.000Z',
    endsAt: '2026-12-31T23:59:59.999Z'
  });
  const allow = permissions.find((item) => item.subjectAccountId === member.id && item.effect === 'allow');
  check('contextual allow round-trips through data store workspace', () => {
    assert.ok(allow);
    assert.equal(allow.purpose, 'health');
    assert.equal(allow.familyBranchId, branch.id);
    assert.equal(allow.startsAt, '2026-08-01T00:00:00.000Z');
    assert.equal(allow.endsAt, '2026-12-31T23:59:59.999Z');
    assert.deepEqual(allow.actions, ['read', 'ai_process', 'record']);
  });
  check('workspace persists the same contextual allow', () => {
    const saved = store.getAuthorizationContextWorkspace().permissions.find((item) => item.id === allow.id);
    assert.equal(saved?.purpose, 'health');
    assert.equal(saved?.familyBranchId, branch.id);
  });
  check('deny without explicit reason fails closed', () => {
    assert.throws(() => store.upsertPermission({ subjectAccountId: member.id, resourceType: 'finance_record', resourceId: '*', actions: ['read'], effect: 'deny', purpose: 'finance' }), /CORE-VALIDATION-001/);
  });
  check('unknown permission action fails closed without a write', () => {
    const before = store.listPermissions().length;
    assert.throws(() => store.upsertPermission({ subjectAccountId: member.id, resourceType: 'archive_item', resourceId: '*', actions: ['execute_arbitrary'], effect: 'allow', purpose: 'archive' }), /CORE-VALIDATION-001/);
    assert.equal(store.listPermissions().length, before);
  });
  const denied = store.upsertPermission({
    subjectAccountId: member.id,
    resourceType: 'finance_record',
    resourceId: '*',
    actions: ['read'],
    effect: 'deny',
    purpose: 'finance',
    familyBranchId: branch.id,
    denialReason: 'Bu aile dalındaki finans kayıtları üyeye kapalıdır.',
    startsAt: '2026-08-05T00:00:00.000Z'
  }).find((item) => item.effect === 'deny');
  check('explicit denial reason round-trips without loss', () => {
    assert.ok(denied);
    assert.equal(denied.purpose, 'finance');
    assert.equal(denied.familyBranchId, branch.id);
    assert.equal(denied.denialReason, 'Bu aile dalındaki finans kayıtları üyeye kapalıdır.');
  });
  check('allow carrying denial text fails closed', () => {
    assert.throws(() => store.upsertPermission({ subjectAccountId: member.id, resourceType: 'event', resourceId: '*', actions: ['read'], effect: 'allow', denialReason: 'İzin kaydı ret gerekçesi taşımamalıdır.' }), /CORE-VALIDATION-001/);
  });
  check('inverted validity range is rejected atomically', () => {
    const before = store.listPermissions().length;
    assert.throws(() => store.upsertPermission({ subjectAccountId: member.id, resourceType: 'archive_item', resourceId: '*', actions: ['read'], effect: 'allow', purpose: 'archive', startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-08-01T00:00:00.000Z' }), /CORE-VALIDATION-001/);
    assert.equal(store.listPermissions().length, before);
  });
  check('workspace delete removes only the selected contextual permission', () => {
    const remaining = store.deletePermission(allow.id);
    assert.equal(remaining.some((item) => item.id === allow.id), false);
    assert.equal(remaining.some((item) => item.id === denied.id), true);
  });
  check('permission writes preserve audit integrity', () => {
    assert.equal(store.verifyAuditIntegrity().valid, true);
  });

  const report = {
    schemaVersion: 1,
    release: 'Bronze 04.08.2026.29',
    step: '30-F',
    requirement: 'B1-03',
    status: 'PASS',
    checkCount: checks.length,
    checks,
    generatedAt: new Date().toISOString()
  };
  mkdirSync('artifacts/validation', { recursive: true });
  writeFileSync('artifacts/validation/30-F-authorization-context-workspace-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(`30-F authorization context workspace runtime: PASS (${checks.length} checks).`);
} finally {
  try { store?.close(); } catch { /* retain original verification result */ }
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
