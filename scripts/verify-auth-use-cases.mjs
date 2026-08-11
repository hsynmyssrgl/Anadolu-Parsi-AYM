import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { asIsoDateTime } from '../packages/core/dist/index.js';

class MutableClock {
  constructor(value) { this.value = value; }
  now() { return asIsoDateTime(this.value); }
  advanceMinutes(minutes) {
    this.value = new Date(Date.parse(this.value) + minutes * 60_000).toISOString();
  }
}

const directory = mkdtempSync(join(tmpdir(), 'panthera-mvp50-auth-'));
const databasePath = join(directory, 'family.db');
const checks = [];
const check = (name, operation) => { operation(); checks.push(name); };
const clock = new MutableClock('2026-07-23T12:00:00.000Z');
let store;
try {
  store = new FamilyDataStore({
    databasePath,
    applicationVersion: ACTIVE_BUILD_META.applicationVersion,
    migrationBackupDirectory: join(directory, 'migration-backups'),
    clock,
    securityConfig: {
      sessionIdleTimeoutMinutes: 15,
      maximumFailedLoginAttempts: 5
    }
  });

  const setup = store.setupAdmin({
    displayName: 'Kimlik Test Yöneticisi',
    email: 'AUTH-ADMIN@EXAMPLE.COM',
    password: 'GucluKimlikParolasi!2026'
  });
  check('admin setup creates authenticated session', () => {
    assert.equal(setup.initialized, true);
    assert.equal(setup.authenticated, true);
    assert.equal(setup.displayName, 'Kimlik Test Yöneticisi');
    assert.equal(setup.role, 'family_admin');
    assert.equal(setup.sessionExpiresAt, '2026-07-23T12:15:00.000Z');
  });
  check('admin email is normalized', () => {
    const probe = new DatabaseSync(databasePath, { readOnly: true });
    try {
      assert.equal(probe.prepare('SELECT email FROM accounts').get().email, 'auth-admin@example.com');
    } finally { probe.close(); }
  });
  check('second setup is rejected through application conflict', () => {
    assert.throws(() => store.setupAdmin({
      displayName: 'İkinci Yönetici',
      email: 'second@example.com',
      password: 'GucluIkinciParola!2026'
    }), /RESOURCE-CONFLICT-001/);
  });

  const loggedOut = store.logout();
  check('logout clears session and writes state', () => {
    assert.equal(loggedOut.authenticated, false);
    assert.equal(loggedOut.initialized, true);
  });

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    assert.throws(() => store.login({
      email: 'auth-admin@example.com',
      password: 'YanlisParola!2026'
    }), /AUTH-CREDENTIALS-001/);
  }
  check('failed attempts persist and fifth failure locks account', () => {
    const probe = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const row = probe.prepare('SELECT failed_login_count,locked_until FROM accounts').get();
      assert.equal(row.failed_login_count, 0);
      assert.equal(row.locked_until, '2026-07-23T12:15:00.000Z');
      assert.equal(Number(probe.prepare("SELECT COUNT(*) count FROM audit_log WHERE action='session.login_failed'").get().count), 4);
      assert.equal(Number(probe.prepare("SELECT COUNT(*) count FROM audit_log WHERE action='account.locked'").get().count), 1);
    } finally { probe.close(); }
  });
  check('correct password remains blocked during lock window', () => {
    assert.throws(() => store.login({
      email: 'auth-admin@example.com',
      password: 'GucluKimlikParolasi!2026'
    }), /AUTH-LOCKED-001/);
  });

  clock.advanceMinutes(16);
  const login = store.login({
    email: 'auth-admin@example.com',
    password: 'GucluKimlikParolasi!2026'
  });
  check('expired lock permits successful login', () => {
    assert.equal(login.authenticated, true);
    assert.equal(login.sessionExpiresAt, '2026-07-23T12:31:00.000Z');
  });
  check('successful login clears failure state', () => {
    const probe = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const row = probe.prepare('SELECT failed_login_count,locked_until FROM accounts').get();
      assert.equal(row.failed_login_count, 0);
      assert.equal(row.locked_until, null);
    } finally { probe.close(); }
  });

  check('wrong current password rejects password change', () => {
    assert.throws(() => store.changePassword({
      currentPassword: 'YanlisMevcut!2026',
      newPassword: 'YeniGucluKimlikParolasi!2026'
    }), /AUTH-CREDENTIALS-001/);
  });
  const changed = store.changePassword({
    currentPassword: 'GucluKimlikParolasi!2026',
    newPassword: 'YeniGucluKimlikParolasi!2026'
  });
  check('password change preserves active session', () => {
    assert.equal(changed.authenticated, true);
  });
  store.logout();
  check('old password no longer authenticates', () => {
    assert.throws(() => store.login({
      email: 'auth-admin@example.com',
      password: 'GucluKimlikParolasi!2026'
    }), /AUTH-CREDENTIALS-001/);
  });
  store.login({
    email: 'auth-admin@example.com',
    password: 'YeniGucluKimlikParolasi!2026'
  });
  check('new password authenticates', () => {
    assert.equal(store.getAuthState().authenticated, true);
  });

  clock.advanceMinutes(16);
  const expiredState = store.getAuthState();
  assert.equal(expiredState.authenticated, false);
  assert.equal(expiredState.initialized, true);
  await assert.rejects(() => store.getSnapshot(), /oturum açılmalıdır/);
  checks.push('idle timeout expires session without extending on state read');

  const applicationSource = readFileSync(new URL('../packages/application/src/auth-use-cases.ts', import.meta.url), 'utf8');
  const dataStoreSource = readFileSync(new URL('../apps/desktop/src/main/data-store.ts', import.meta.url), 'utf8');
  check('auth application layer has no infrastructure dependency', () => {
    assert.equal(applicationSource.includes('node:sqlite'), false);
    assert.equal(applicationSource.includes('@ppt/repositories'), false);
    assert.equal(applicationSource.includes('@ppt/security'), false);
  });
  check('FamilyDataStore delegates core auth operations to use cases', () => {
    assert.ok(dataStoreSource.includes('this.#setupAdminUseCase.execute'));
    assert.ok(dataStoreSource.includes('this.#loginUseCase.execute'));
    assert.ok(dataStoreSource.includes('this.#logoutUseCase.execute'));
    assert.ok(dataStoreSource.includes('this.#changePasswordUseCase.execute'));
    const block = dataStoreSource.slice(dataStoreSource.indexOf('public getAuthState()'), dataStoreSource.indexOf('public createRelation'));
    assert.equal(/SELECT\s+/i.test(block), false);
    assert.equal(block.includes('this.#database'), false);
  });
  check('password and session audit records are chained', () => {
    const probe = new DatabaseSync(databasePath, { readOnly: true });
    try {
      assert.equal(Number(probe.prepare("SELECT COUNT(*) count FROM audit_log WHERE action='account.password_changed'").get().count), 1);
      assert.ok(Number(probe.prepare("SELECT COUNT(*) count FROM audit_log WHERE action='session.started'").get().count) >= 2);
      assert.ok(Number(probe.prepare("SELECT COUNT(*) count FROM audit_log WHERE action='session.ended'").get().count) >= 2);
      const broken = Number(probe.prepare("SELECT COUNT(*) count FROM audit_log WHERE entry_hash IS NULL OR prev_hash IS NULL").get().count);
      assert.equal(broken, 0);
    } finally { probe.close(); }
  });

  const report = {
    schemaVersion: 1,
    status: 'passed',
    version: ACTIVE_BUILD_META.applicationVersion,
    milestone: ACTIVE_BUILD_META.milestone,
    checks: checks.length,
    checkNames: checks,
    metrics: {
      maximumFailedLoginAttempts: 5,
      lockMinutes: 15,
      sessionIdleTimeoutMinutes: 15
    },
    verifiedAt: new Date().toISOString()
  };
  mkdirSync('artifacts/manifests', { recursive: true });
  writeFileSync('artifacts/manifests/AUTH_SESSION_VERIFICATION_MVP56.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  store?.close();
  rmSync(directory, { recursive: true, force: true });
}
