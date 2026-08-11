import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const reportPath = resolve(process.argv[2] ?? 'artifacts/validation/build135-archive-vault-key-protection-runtime.json');
const testModulePath = resolve('.tmp/build135-archive-vault-key-protection-runtime.mjs');
await mkdir(dirname(testModulePath), { recursive: true });
const providerUrl = new URL('../apps/desktop/src/main/archive-vault-key-provider.ts', new URL(`file://${testModulePath}`)).href;
await writeFile(testModulePath, `
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProtectedArchiveVaultKeyProvider } from ${JSON.stringify(providerUrl)};

const root = mkdtempSync(join(tmpdir(), 'ppt-vault-key-'));
const clock = { now: () => '2026-07-28T00:00:00.000Z' };
const protector = {
  protectionId: 'test-safe-storage-v1',
  required: true,
  isAvailable: () => true,
  protect: (plainText) => Buffer.from('cipher:' + plainText, 'utf8').toString('base64'),
  unprotect: (cipherText) => {
    const decoded = Buffer.from(cipherText, 'base64').toString('utf8');
    if (!decoded.startsWith('cipher:')) throw new Error('cipher mismatch');
    return decoded.slice(7);
  }
};
let assertions = 0;
const check = (condition, message) => { assertions += 1; assert.ok(condition, message); };
const equal = (actual, expected, message) => { assertions += 1; assert.equal(actual, expected, message); };
const throws = (fn, pattern, message) => { assertions += 1; assert.throws(fn, pattern, message); };

try {
  const keyPath = join(root, 'archive-vault.key');
  const provider = new ProtectedArchiveVaultKeyProvider(keyPath, protector, clock);
  const first = provider.getOrCreateKey();
  equal(first.length, 32, 'new key length');
  const storedText = readFileSync(keyPath, 'utf8');
  const stored = JSON.parse(storedText);
  equal(stored.schemaVersion, 2, 'schema version');
  equal(stored.purpose, 'archive-vault-key', 'purpose');
  equal(stored.protection.id, protector.protectionId, 'protection id');
  check(!storedText.includes(first.toString('base64')), 'plaintext key must not appear in local envelope');
  equal(provider.getOrCreateKey().toString('hex'), first.toString('hex'), 'key remains stable');
  check(provider.matchesPath(keyPath), 'matching path accepted');
  check(!provider.matchesPath(join(root, 'other.key')), 'different path rejected');

  const portable = Buffer.alloc(32, 7);
  const localBytes = provider.serializePortableKeyForCurrentDevice(portable, '2026-07-28T01:00:00.000Z');
  equal(provider.verifyLocalStorageBytes(localBytes).toString('hex'), portable.toString('hex'), 'portable key rewrap round-trip');
  throws(() => provider.serializePortableKeyForCurrentDevice(Buffer.alloc(31)), /32 bayt/u, 'invalid portable key length rejected');
  throws(() => provider.serializePortableKeyForCurrentDevice(portable, 'invalid'), /zamanı geçersiz/u, 'invalid creation time rejected');

  const legacyPath = join(root, 'legacy-vault.key');
  const legacy = Buffer.alloc(32, 9);
  writeFileSync(legacyPath, legacy, { mode: 0o600 });
  const legacyProvider = new ProtectedArchiveVaultKeyProvider(legacyPath, protector, clock);
  equal(legacyProvider.getOrCreateKey().toString('hex'), legacy.toString('hex'), 'legacy key preserved during migration');
  const migrated = JSON.parse(readFileSync(legacyPath, 'utf8'));
  equal(migrated.schemaVersion, 2, 'legacy key migrated to protected schema');
  check(!readFileSync(legacyPath).equals(legacy), 'legacy raw bytes replaced');
  check(!existsSync(legacyPath + '.migration-backup'), 'migration backup removed after success');

  const interruptedPath = join(root, 'interrupted-vault.key');
  const interrupted = Buffer.alloc(32, 11);
  writeFileSync(interruptedPath + '.migration-backup', interrupted, { mode: 0o600 });
  const interruptedProvider = new ProtectedArchiveVaultKeyProvider(interruptedPath, protector, clock);
  equal(interruptedProvider.getOrCreateKey().toString('hex'), interrupted.toString('hex'), 'interrupted migration recovered');
  check(!existsSync(interruptedPath + '.migration-backup'), 'recovered migration backup removed');

  const wrongProvider = new ProtectedArchiveVaultKeyProvider(keyPath, { ...protector, protectionId: 'other-v1' }, clock);
  throws(() => wrongProvider.getOrCreateKey(), /farklı bir koruma sağlayıcısına/u, 'provider mismatch rejected');

  const unavailablePath = join(root, 'unavailable.key');
  const unavailable = new ProtectedArchiveVaultKeyProvider(unavailablePath, { ...protector, isAvailable: () => false }, clock);
  throws(() => unavailable.getOrCreateKey(), /koruması kullanılamıyor/u, 'unavailable protector rejected');
  check(!existsSync(unavailablePath), 'unavailable protector must not create plaintext key');

  const tamperedPath = join(root, 'tampered.key');
  writeFileSync(tamperedPath, localBytes);
  const tampered = JSON.parse(readFileSync(tamperedPath, 'utf8'));
  tampered.keySha256 = '0'.repeat(64);
  writeFileSync(tamperedPath, JSON.stringify(tampered));
  const tamperedProvider = new ProtectedArchiveVaultKeyProvider(tamperedPath, protector, clock);
  throws(() => tamperedProvider.getOrCreateKey(), /bütünlük doğrulamasını geçemedi/u, 'tampered key hash rejected');

  console.log(JSON.stringify({ status: 'PASS', assertions }));
} finally {
  rmSync(root, { recursive: true, force: true });
}
`);
const result = spawnSync(process.execPath, ['--experimental-strip-types', testModulePath], {
  cwd: process.cwd(),
  encoding: 'utf8',
  env: { ...process.env, NODE_NO_WARNINGS: '1' }
});
await rm(testModulePath, { force: true });
let parsed;
try { parsed = result.status === 0 ? JSON.parse(result.stdout.trim()) : undefined; } catch { parsed = undefined; }
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  build: 135,
  applicationVersion: '28.07.2026.135',
  packageVersion: '28.7.2026-135',
  stage: 'Bronze RC2 Active Development',
  scope: 'OS-protected archive vault key creation, legacy plaintext migration, interrupted migration recovery, portable rewrap, provider mismatch, tamper and unavailable-protector refusal paths',
  status: result.status === 0 && parsed?.status === 'PASS' ? 'PASS' : 'FAIL',
  assertions: parsed?.assertions ?? 0,
  exitCode: result.status,
  stdout: result.stdout,
  stderr: result.stderr,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Archive vault key protection runtime: ${report.status} (${report.assertions} assertions)`);
if (report.status !== 'PASS') process.exitCode = 1;
