import { mkdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const reportPath = resolve(process.argv[2] ?? 'artifacts/validation/build129-mfa-secret-protection-runtime.json');
const testModulePath = resolve('.tmp/build129-mfa-secret-protection-runtime.mjs');
await mkdir(dirname(testModulePath), { recursive: true });
const moduleUrl = new URL('../apps/desktop/src/main/mfa-secret-protection.ts', new URL(`file://${testModulePath}`)).href;
await writeFile(testModulePath, `
import assert from 'node:assert/strict';
import { isProtectedMfaSecret, isValidTotpSecret, protectMfaSecret, unprotectMfaSecret } from ${JSON.stringify(moduleUrl)};
const secret = 'JBSWY3DPEHPK3PXP';
const protector = {
  protectionId: 'test-safe-storage-v1',
  required: true,
  isAvailable: () => true,
  protect: (plainText) => Buffer.from('cipher:' + plainText, 'utf8').toString('base64'),
  unprotect: (cipherText) => {
    const value = Buffer.from(cipherText, 'base64').toString('utf8');
    if (!value.startsWith('cipher:')) throw new Error('cipher mismatch');
    return value.slice(7);
  }
};
assert.equal(isValidTotpSecret(secret), true);
assert.equal(isValidTotpSecret('not-a-secret'), false);
const protectedValue = protectMfaSecret(protector, secret);
assert.equal(isProtectedMfaSecret(protectedValue), true);
assert.equal(protectedValue.includes(secret), false);
assert.equal(unprotectMfaSecret(protector, protectedValue), secret);
const parsed = JSON.parse(protectedValue);
assert.equal(parsed.schemaVersion, 1);
assert.equal(parsed.purpose, 'totp');
assert.throws(() => unprotectMfaSecret({ ...protector, protectionId: 'other-v1' }, protectedValue), /farklı bir koruma sağlayıcısına/u);
assert.throws(() => unprotectMfaSecret(protector, '{}'), /zarfı geçersiz/u);
assert.throws(() => protectMfaSecret({ ...protector, isAvailable: () => false }, secret), /kullanılamıyor/u);
assert.throws(() => protectMfaSecret(protector, 'INVALID'), /biçimi geçersiz/u);
console.log(JSON.stringify({ status: 'PASS', assertions: 11 }));
`);
const result = spawnSync(process.execPath, ['--experimental-strip-types', testModulePath], {
  cwd: process.cwd(),
  encoding: 'utf8',
  env: { ...process.env, NODE_NO_WARNINGS: '1' }
});
await rm(testModulePath, { force: true });
const parsed = result.status === 0 ? JSON.parse(result.stdout.trim()) : undefined;
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  build: 129,
  applicationVersion: '27.07.2026.129',
  packageVersion: '27.7.2026-129',
  stage: 'Bronze RC2 Active Development',
  scope: 'TOTP secret envelope validation, protected round-trip, plaintext non-disclosure and fail-closed refusal paths',
  status: result.status === 0 && parsed?.status === 'PASS' ? 'PASS' : 'FAIL',
  assertions: parsed?.assertions ?? 0,
  exitCode: result.status,
  stdout: result.stdout,
  stderr: result.stderr,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`MFA secret protection runtime: ${report.status} (${report.assertions} assertions)`);
if (report.status !== 'PASS') process.exitCode = 1;
