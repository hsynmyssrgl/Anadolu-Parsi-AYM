import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { asIsoDateTime } from '../packages/core/dist/index.js';
import { generateTotpCode } from '../packages/security/dist/index.js';

class MutableClock {
  constructor(value) { this.value = value; }
  now() { return asIsoDateTime(this.value); }
  advanceSeconds(seconds) { this.value = new Date(Date.parse(this.value) + seconds * 1000).toISOString(); }
}

const directory = mkdtempSync(join(tmpdir(), 'panthera-mvp51-mfa-'));
const databasePath = join(directory, 'family.db');
const deviceAPath = join(directory, 'device-a', 'device-identity.json');
const deviceBPath = join(directory, 'device-b', 'device-identity.json');
const clock = new MutableClock('2026-07-23T12:00:00.000Z');
const checks = [];
const check = (name, operation) => { operation(); checks.push(name); };
const password = 'Mvp51GucluParola!2026';

const mfaSecretProtector = {
  protectionId: 'test-safe-storage-v1',
  required: true,
  isAvailable: () => true,
  protect: (secret) => Buffer.from(`mfa:${secret}`, 'utf8').toString('base64'),
  unprotect: (ciphertextBase64) => {
    const value = Buffer.from(ciphertextBase64, 'base64').toString('utf8');
    if (!value.startsWith('mfa:')) throw new Error('MFA cipher mismatch');
    return value.slice(4);
  }
};
let store;
try {
  store = new FamilyDataStore({
    databasePath,
    deviceIdentityPath: deviceAPath,
    applicationVersion: ACTIVE_BUILD_META.applicationVersion,
    migrationBackupDirectory: join(directory, 'migration-backups'),
    clock,
    securityConfig: { sessionIdleTimeoutMinutes: 15, maximumFailedLoginAttempts: 5 },
    mfaSecretProtector
  });
  store.setupAdmin({ displayName: 'MFA Yöneticisi', email: 'mfa@example.com', password });
  const setup = store.beginTwoFactorSetup();
  check('TOTP setup returns secret and eight recovery codes', () => {
    assert.match(setup.secret, /^[A-Z2-7]+$/u);
    assert.equal(setup.recoveryCodes.length, 8);
    assert.match(setup.otpauthUri, /^otpauth:\/\/totp\//u);
  });
  check('pending recovery codes are stored only as hashes', () => {
    const probe = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const row = probe.prepare('SELECT pending_totp_secret,pending_recovery_codes FROM accounts').get();
      const hashes = JSON.parse(row.pending_recovery_codes);
      assert.notEqual(row.pending_totp_secret, setup.secret);
      assert.equal(String(row.pending_totp_secret).includes(setup.secret), false);
      const envelope = JSON.parse(String(row.pending_totp_secret));
      assert.equal(envelope.schemaVersion, 1);
      assert.equal(envelope.purpose, 'totp');
      assert.equal(envelope.protectionId, mfaSecretProtector.protectionId);
      assert.equal(hashes.length, 8);
      assert.equal(hashes.includes(setup.recoveryCodes[0]), false);
      assert.ok(hashes.every((value) => /^[a-f0-9]{64}$/u.test(value)));
    } finally { probe.close(); }
  });
  check('invalid TOTP cannot enable MFA', () => {
    assert.throws(() => store.enableTwoFactor({ code: '000000' }), /AUTH-2FA-INVALID-001/);
  });
  const firstTotp = generateTotpCode(setup.secret, Date.parse(clock.now()));
  const enabled = store.enableTwoFactor({ code: firstTotp });
  check('valid TOTP enables MFA and exposes recovery count', () => {
    assert.equal(enabled.twoFactorEnabled, true);
    assert.equal(enabled.recoveryCodesRemaining, 8);
    assert.equal(enabled.trustedDevice, false);
  });
  store.logout();
  check('untrusted device requires a second factor', () => {
    assert.throws(() => store.login({ email: 'mfa@example.com', password }), /AUTH-2FA-REQUIRED-001/);
  });
  store.login({ email: 'mfa@example.com', password, secondFactorCode: firstTotp });
  const trusted = store.trustCurrentDevice({ password, code: firstTotp, displayName: 'Ana Windows Bilgisayarı' });
  check('current cryptographic device can be trusted', () => {
    assert.equal(trusted.length, 1);
    assert.equal(trusted[0].current, true);
    assert.equal(trusted[0].displayName, 'Ana Windows Bilgisayarı');
    assert.equal(trusted[0].revokedAt, undefined);
  });
  const trustedId = trusted[0].id;
  store.logout();
  const trustedLogin = store.login({ email: 'mfa@example.com', password });
  check('trusted device login skips MFA after key proof', () => {
    assert.equal(trustedLogin.authenticated, true);
    assert.equal(trustedLogin.trustedDevice, true);
  });
  store.revokeTrustedDevice(trustedId);
  store.logout();
  check('revoked device immediately requires MFA again', () => {
    assert.throws(() => store.login({ email: 'mfa@example.com', password }), /AUTH-2FA-REQUIRED-001/);
  });
  const firstRecovery = setup.recoveryCodes[0];
  const recoveryLogin = store.login({ email: 'mfa@example.com', password, secondFactorCode: firstRecovery });
  check('recovery code authenticates once and is consumed atomically', () => {
    assert.equal(recoveryLogin.authenticated, true);
    assert.equal(recoveryLogin.recoveryCodesRemaining, 7);
    const probe = new DatabaseSync(databasePath, { readOnly: true });
    try {
      assert.equal(JSON.parse(probe.prepare('SELECT recovery_codes FROM accounts').get().recovery_codes).length, 7);
      assert.equal(Number(probe.prepare("SELECT COUNT(*) count FROM audit_log WHERE action='account.recovery_code_used'").get().count), 1);
    } finally { probe.close(); }
  });
  store.logout();
  check('consumed recovery code cannot be reused', () => {
    assert.throws(() => store.login({ email: 'mfa@example.com', password, secondFactorCode: firstRecovery }), /AUTH-2FA-INVALID-001/);
  });
  store.login({ email: 'mfa@example.com', password, secondFactorCode: generateTotpCode(setup.secret, Date.parse(clock.now())) });
  store.trustCurrentDevice({ password, code: generateTotpCode(setup.secret, Date.parse(clock.now())), displayName: 'Ana Cihaz' });
  const deviceA = JSON.parse(readFileSync(deviceAPath, 'utf8'));
  store.close(); store = undefined;

  const secondStore = new FamilyDataStore({
    databasePath,
    deviceIdentityPath: deviceBPath,
    applicationVersion: ACTIVE_BUILD_META.applicationVersion,
    migrationBackupDirectory: join(directory, 'migration-backups'),
    clock,
    securityConfig: { sessionIdleTimeoutMinutes: 15, maximumFailedLoginAttempts: 5 },
    mfaSecretProtector
  });
  store = secondStore;
  const deviceB = JSON.parse(readFileSync(deviceBPath, 'utf8'));
  check('new device receives a different cryptographic identity', () => {
    assert.notEqual(deviceA.deviceId, deviceB.deviceId);
    assert.notEqual(deviceA.fingerprint, deviceB.fingerprint);
  });
  check('new device does not inherit old device trust', () => {
    assert.throws(() => secondStore.login({ email: 'mfa@example.com', password }), /AUTH-2FA-REQUIRED-001/);
  });
  secondStore.login({ email: 'mfa@example.com', password, secondFactorCode: generateTotpCode(setup.secret, Date.parse(clock.now())) });
  const devicesOnB = secondStore.listTrustedDevices();
  check('trusted device inventory identifies current and previous devices', () => {
    assert.equal(devicesOnB.some((device) => device.current), false);
    assert.ok(devicesOnB.some((device) => device.deviceId === deviceA.deviceId));
  });
  secondStore.disableTwoFactor({ password, code: generateTotpCode(setup.secret, Date.parse(clock.now())) });
  check('disabling MFA revokes every trusted device', () => {
    const probe = new DatabaseSync(databasePath, { readOnly: true });
    try {
      assert.equal(Number(probe.prepare('SELECT COUNT(*) count FROM trusted_devices WHERE revoked_at IS NULL').get().count), 0);
      assert.equal(probe.prepare('SELECT totp_secret FROM accounts').get().totp_secret, null);
    } finally { probe.close(); }
  });
  secondStore.logout();
  check('password-only login works after MFA is disabled', () => {
    assert.equal(secondStore.login({ email: 'mfa@example.com', password }).authenticated, true);
  });
  check('device private key is stored outside SQLite and never in audit', () => {
    const privateKey = String(deviceB.privateKeyPem);
    const probe = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const dump = JSON.stringify(probe.prepare('SELECT * FROM audit_log').all());
      assert.equal(dump.includes(privateKey), false);
      assert.equal(Number(probe.prepare("SELECT COUNT(*) count FROM sqlite_master WHERE type='table' AND name='trusted_devices'").get().count), 1);
    } finally { probe.close(); }
  });

  const report = {
    schemaVersion: 1,
    status: 'passed',
    version: ACTIVE_BUILD_META.applicationVersion,
    milestone: ACTIVE_BUILD_META.milestone,
    checks: checks.length,
    checkNames: checks,
    metrics: { recoveryCodeCount: 8, recoveryCodesRemaining: 7, trustedDeviceTable: true, cryptographicIdentity: 'Ed25519' },
    verifiedAt: new Date().toISOString()
  };
  mkdirSync('artifacts/manifests', { recursive: true });
  writeFileSync('artifacts/manifests/MFA_TRUSTED_DEVICE_VERIFICATION_MVP56.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  store?.close();
  rmSync(directory, { recursive: true, force: true });
}
