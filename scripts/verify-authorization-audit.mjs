import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { FixedClock, asIsoDateTime } from '../packages/core/dist/index.js';
import { createFinancePolicyTestOptions } from './lib/archive-policy-test-harness.mjs';

const root = mkdtempSync(join(tmpdir(), 'panthera-mvp52-authz-'));
const databasePath = join(root, 'family.db');
const deviceIdentityPath = join(root, 'device');
const clock = new FixedClock(asIsoDateTime('2026-07-23T12:00:00.000Z'));
const password = 'Güvenli!Parola2026';
const checks = [];
const check = async (name, operation) => { await operation(); checks.push(name); };
let adminEmail = 'admin@example.com';
let memberEmail = 'limited@example.com';
let memberPassword = 'Üye!Parola2026';
let memberAccountId = '';
let otherFinanceId = '';
let ownerFinanceId = '';
let ownershipPermissionId = '';
let store;
let database;
const policyOptions = createFinancePolicyTestOptions();
const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const decodeBase32 = (value) => {
  let bits = '';
  for (const character of value) bits += base32Alphabet.indexOf(character).toString(2).padStart(5, '0');
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
};
const makeTotp = (secret, occurredAt) => {
  const counter = Math.floor(Date.parse(occurredAt) / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
};
const trustCurrentActorDevice = (activeStore, actorPassword, displayName) => {
  const setup = activeStore.beginTwoFactorSetup();
  activeStore.enableTwoFactor({ code: makeTotp(setup.secret, clock.now()) });
  activeStore.trustCurrentDevice({ password: actorPassword, code: setup.recoveryCodes[0], displayName });
};

try {
  store = new FamilyDataStore({ databasePath, deviceIdentityPath, clock, seed: true, applicationVersion: ACTIVE_BUILD_META.applicationVersion, ...policyOptions });
  store.setupAdmin({ displayName: 'Aile Yöneticisi', email: adminEmail, password });
  trustCurrentActorDevice(store, password, 'Authorization administrator device');
  const adminPersonId = store.listAccounts().find((item) => item.email === adminEmail)?.personId ?? '';
  assert.ok(adminPersonId);
  const bootstrapDatabase = new DatabaseSync(databasePath);
  bootstrapDatabase.prepare(`
    INSERT INTO people(id,family_id,display_name,relationship_type,generation,branch,status,created_at)
    VALUES(?, 'family-main', 'Yetkilendirme Test Üyesi', 'Aile üyesi', 2, 'Ana Dal', 'active', ?)
  `).run('person-authz-member', clock.now());
  bootstrapDatabase.close();

  const other = await store.createFinanceRecord({
    ownerPersonId: adminPersonId, title: 'Özel aile varlığı', kind: 'asset', amount: 1000,
    currency: 'TRY', privacy: 'private', occurredAt: clock.now()
  });
  otherFinanceId = other.find((item) => item.title === 'Özel aile varlığı')?.id ?? '';
  assert.ok(otherFinanceId);

  const invitation = store.createInvitation({ email: memberEmail, role: 'limited_member', personId: 'person-authz-member' });
  store.logout();
  store.acceptInvitation({ token: invitation.token, displayName: 'Sınırlı Üye', password: memberPassword });
  trustCurrentActorDevice(store, memberPassword, 'Authorization member device');
  const owner = await store.createFinanceRecord({
    ownerPersonId: 'person-authz-member', title: 'Test kişi özel birikim', kind: 'asset', amount: 500,
    currency: 'TRY', privacy: 'private', occurredAt: clock.now()
  });
  ownerFinanceId = owner.find((item) => item.title === 'Test kişi özel birikim')?.id ?? '';
  assert.ok(ownerFinanceId);

  await check('non-admin cannot manage permissions', () => {
    assert.throws(() => store.listPermissions(), /PERMISSION-DENIED-001/);
  });
  await check('owner can read own private record', async () => {
    const items = await store.listFinanceRecords();
    assert.equal(items.some((item) => item.id === ownerFinanceId), true);
    assert.equal(items.some((item) => item.id === otherFinanceId), false);
  });

  store.logout();
  store.login({ email: adminEmail, password });
  memberAccountId = store.listAccounts().find((item) => item.email === memberEmail)?.id ?? '';
  assert.ok(memberAccountId);
  store.upsertPermission({ subjectAccountId: memberAccountId, resourceType: 'finance_record', resourceId: '*', actions: ['read'], effect: 'allow' });
  store.logout();
  store.login({ email: memberEmail, password: memberPassword });
  await check('explicit allow grants object access', async () => {
    assert.equal((await store.listFinanceRecords()).some((item) => item.id === otherFinanceId), true);
  });

  store.logout();
  store.login({ email: adminEmail, password });
  store.upsertPermission({ subjectAccountId: memberAccountId, resourceType: 'finance_record', resourceId: otherFinanceId, actions: ['read'], effect: 'deny', denialReason: 'Bu özel finans kaydı üyeye açık değildir.' });
  store.upsertPermission({ subjectAccountId: memberAccountId, resourceType: 'finance_record', resourceId: ownerFinanceId, actions: ['read'], effect: 'deny', denialReason: 'Bu özel finans kaydı üyeye açık değildir.' });
  store.logout();
  store.login({ email: memberEmail, password: memberPassword });
  await check('explicit deny overrides wildcard allow and ownership', async () => {
    const items = await store.listFinanceRecords();
    assert.equal(items.some((item) => item.id === otherFinanceId), false);
    assert.equal(items.some((item) => item.id === ownerFinanceId), false);
  });

  store.logout();
  store.login({ email: adminEmail, password });
  await check('ownership share persists through use-case and repository readback', () => {
    const permissions = store.upsertPermission({
      subjectAccountId: memberAccountId,
      resourceType: 'finance_record',
      resourceId: otherFinanceId,
      actions: ['read'],
      effect: 'allow',
      purpose: 'finance',
      ownershipBasisPoints: 3_750
    });
    const permission = permissions.find((item) => item.resourceId === otherFinanceId && item.ownershipBasisPoints === 3_750);
    assert.ok(permission);
    ownershipPermissionId = permission.id;
  });
  await check('deny and out-of-range ownership shares are rejected atomically', () => {
    const before = store.listPermissions().length;
    assert.throws(() => store.upsertPermission({
      subjectAccountId: memberAccountId, resourceType: 'finance_record', resourceId: otherFinanceId,
      actions: ['read'], effect: 'deny', denialReason: 'Ortak varlık erişimi açıkça reddedildi.', ownershipBasisPoints: 1_000
    }), /CORE-VALIDATION-001/);
    assert.throws(() => store.upsertPermission({
      subjectAccountId: memberAccountId, resourceType: 'finance_record', resourceId: otherFinanceId,
      actions: ['read'], effect: 'allow', ownershipBasisPoints: 10_001
    }), /CORE-VALIDATION-001/);
    assert.equal(store.listPermissions().length, before);
  });
  await check('invalid permission interval is rejected atomically', () => {
    const before = store.listPermissions().length;
    assert.throws(() => store.upsertPermission({
      subjectAccountId: memberAccountId, resourceType: 'health_record', resourceId: '*', actions: ['read'], effect: 'allow',
      startsAt: '2026-08-01T00:00:00.000Z', endsAt: '2026-07-31T00:00:00.000Z'
    }), /CORE-VALIDATION-001/);
    assert.equal(store.listPermissions().length, before);
  });

  await check('audit v2 chain verifies', () => {
    const integrity = store.verifyAuditIntegrity();
    assert.equal(integrity.valid, true);
    assert.ok(integrity.checkedEntries >= 8);
  });

  store.close();
  store = undefined;
  database = new DatabaseSync(databasePath);
  await check('migration 75 blocks converting an ownership grant into a denial', () => {
    assert.ok(ownershipPermissionId);
    assert.throws(() => database.prepare('UPDATE object_permissions SET effect=? WHERE id=?').run('deny', ownershipPermissionId), /invalid object permission ownership share/);
  });
  await check('audit log rejects update and delete mutations', () => {
    assert.throws(() => database.prepare('UPDATE audit_log SET action=? WHERE sequence_no=1').run('tampered'), /AUDIT-APPEND-ONLY/);
    assert.throws(() => database.prepare('DELETE FROM audit_log WHERE sequence_no=1').run(), /AUDIT-APPEND-ONLY/);
  });
  const versions = database.prepare('SELECT hash_version,sequence_no,correlation_id FROM audit_log ORDER BY sequence_no').all();
  await check('new audit entries contain monotonic sequence and v2 metadata', () => {
    assert.equal(versions.every((row, index) => Number(row.sequence_no) === index + 1), true);
    assert.equal(versions.some((row) => Number(row.hash_version) === 2 && Boolean(row.correlation_id)), true);
  });

  database.exec('DROP TRIGGER audit_log_append_only_update; DROP TRIGGER audit_log_append_only_delete;');
  database.prepare('UPDATE audit_log SET entry_hash=? WHERE sequence_no=2').run('0'.repeat(64));
  database.close();
  database = undefined;

  store = new FamilyDataStore({ databasePath, deviceIdentityPath, clock, seed: false, applicationVersion: ACTIVE_BUILD_META.applicationVersion, ...policyOptions });
  store.login({ email: adminEmail, password });
  await check('audit verifier detects externally tampered chain', () => {
    const integrity = store.verifyAuditIntegrity();
    assert.equal(integrity.valid, false);
    assert.ok(integrity.firstInvalidEntryId);
  });
  store.close();
  store = undefined;

  const report = {
    version: ACTIVE_BUILD_META.applicationVersion, status: 'passed', checkedAt: new Date().toISOString(),
    checks, totalChecks: checks.length,
    invariants: {
      denyPrecedence: true, ownerAccess: true, explicitGrant: true, adminOnlyManagement: true,
      ownershipBasisPoints: true, ownershipDenySeparation: true,
      auditAppendOnly: true, auditSequence: true, auditHashVersion: 2, tamperDetection: true
    }
  };
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync('artifacts/manifests', { recursive: true });
  writeFileSync('artifacts/manifests/AUTHORIZATION_AUDIT_VERIFICATION_MVP56.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(`MVP-55 authorization/audit verification passed: ${checks.length}/${checks.length}`);
} finally {
  try { store?.close(); } catch { /* retain the original verification failure */ }
  try { database?.close(); } catch { /* retain the original verification failure */ }
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
