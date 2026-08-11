import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { generateTotpCode } from '../packages/security/dist/index.js';

const directory = mkdtempSync(join(tmpdir(), 'anadolu-build129-mfa-migration-'));
const databasePath = join(directory, 'family.db');
const password = 'Build129GucluParola!2026';
const protector = {
  protectionId: 'test-safe-storage-v1',
  required: true,
  isAvailable: () => true,
  protect: (secret) => Buffer.from(`protected:${secret}`, 'utf8').toString('base64'),
  unprotect: (ciphertextBase64) => {
    const value = Buffer.from(ciphertextBase64, 'base64').toString('utf8');
    if (!value.startsWith('protected:')) throw new Error('cipher mismatch');
    return value.slice(10);
  }
};
let first;
let migrated;
try {
  first = new FamilyDataStore({ databasePath, seed: false, applicationVersion: ACTIVE_BUILD_META.applicationVersion });
  first.setupAdmin({ displayName: 'Legacy MFA', email: 'legacy@example.com', password });
  const setup = first.beginTwoFactorSetup();
  first.close(); first = undefined;
  const before = new DatabaseSync(databasePath, { readOnly: true });
  const plaintext = String(before.prepare('SELECT pending_totp_secret FROM accounts').get().pending_totp_secret);
  before.close();
  assert.equal(plaintext, setup.secret);

  migrated = new FamilyDataStore({
    databasePath,
    seed: false,
    applicationVersion: ACTIVE_BUILD_META.applicationVersion,
    mfaSecretProtector: protector
  });
  const state = migrated.getAuthState();
  assert.equal(state.initialized, true);
  const signedIn = migrated.login({ email: 'legacy@example.com', password });
  assert.equal(signedIn.authenticated, true);
  const after = new DatabaseSync(databasePath, { readOnly: true });
  const protectedValue = String(after.prepare('SELECT pending_totp_secret FROM accounts').get().pending_totp_secret);
  after.close();
  assert.notEqual(protectedValue, setup.secret);
  assert.equal(protectedValue.includes(setup.secret), false);
  const envelope = JSON.parse(protectedValue);
  assert.equal(envelope.schemaVersion, 1);
  assert.equal(envelope.purpose, 'totp');
  assert.equal(envelope.protectionId, protector.protectionId);
  assert.equal(protector.unprotect(envelope.ciphertextBase64), setup.secret);
  const enabled = migrated.enableTwoFactor({ code: generateTotpCode(setup.secret, Date.now()) });
  assert.equal(enabled.twoFactorEnabled, true);
  const report = {
    schemaVersion: 1,
    product: 'Anadolu Parsı Aile Yaşam Merkezi',
    build: 129,
    applicationVersion: ACTIVE_BUILD_META.applicationVersion,
    packageVersion: ACTIVE_BUILD_META.packageVersion,
    stage: 'Bronze RC2 Active Development',
    scope: 'Legacy plaintext pending TOTP secret transaction migration and post-migration enablement',
    status: 'PASS',
    assertions: 11,
    generatedAt: new Date().toISOString()
  };
  mkdirSync('artifacts/validation', { recursive: true });
  writeFileSync('artifacts/validation/build129-mfa-secret-legacy-migration.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} finally {
  first?.close();
  migrated?.close();
  rmSync(directory, { recursive: true, force: true });
}
