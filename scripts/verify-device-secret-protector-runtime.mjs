import { mkdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const reportPath = resolve(process.argv[2] ?? 'artifacts/validation/build128-device-secret-protector-runtime.json');
const testModulePath = resolve('.tmp/build128-device-secret-protector-runtime.mjs');
await mkdir(dirname(testModulePath), { recursive: true });
const protectorUrl = new URL('../apps/desktop/src/main/device-secret-protector.ts', new URL(`file://${testModulePath}`)).href;
await writeFile(testModulePath, `
import assert from 'node:assert/strict';
import { ElectronSafeStorageDeviceSecretProtector } from ${JSON.stringify(protectorUrl)};
const safeStorage = {
  isEncryptionAvailable: () => true,
  getSelectedStorageBackend: () => 'dpapi',
  encryptString: (plainText) => Buffer.from('cipher:' + plainText, 'utf8'),
  decryptString: (encrypted) => {
    const value = encrypted.toString('utf8');
    if (!value.startsWith('cipher:')) throw new Error('cipher mismatch');
    return value.slice(7);
  }
};
const protector = new ElectronSafeStorageDeviceSecretProtector(safeStorage, true);
assert.equal(protector.required, true);
assert.equal(protector.isAvailable(), true);
const secret = '-----BEGIN PRIVATE KEY-----\\nTEST\\n-----END PRIVATE KEY-----';
const protectedValue = protector.protect(secret);
assert.notEqual(protectedValue, secret);
assert.equal(protector.unprotect(protectedValue), secret);
const basicText = new ElectronSafeStorageDeviceSecretProtector({ ...safeStorage, getSelectedStorageBackend: () => 'basic_text' }, false);
assert.equal(basicText.isAvailable(), false);
assert.throws(() => basicText.protect(secret), /kullanılamıyor/u);
assert.throws(() => protector.unprotect('not-base64!'), /biçimi geçersiz/u);
console.log(JSON.stringify({ status: 'PASS', assertions: 7 }));
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
  build: 128,
  applicationVersion: '27.07.2026.128',
  packageVersion: '27.7.2026-128',
  stage: 'Bronze RC2 Active Development',
  scope: 'Electron safeStorage adapter availability, protected round-trip, unsafe backend refusal and malformed payload refusal',
  status: result.status === 0 && parsed?.status === 'PASS' ? 'PASS' : 'FAIL',
  assertions: parsed?.assertions ?? 0,
  exitCode: result.status,
  stdout: result.stdout,
  stderr: result.stderr,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Device secret protector runtime: ${report.status} (${report.assertions} assertions)`);
if (report.status !== 'PASS') process.exitCode = 1;
