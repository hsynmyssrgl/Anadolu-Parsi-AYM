import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = await mkdtemp(join(tmpdir(), 'ppt-build214-side-artifact-'));
await writeFile(join(root, 'package.json'), '{"type":"module"}\n');
const tsc = join('node_modules', 'typescript', 'lib', 'tsc.js');
execFileSync(process.execPath, [tsc, '--ignoreConfig', 'packages/security/src/encryption.ts', '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler', '--rootDir', 'packages/security/src', '--outDir', root, '--types', 'node', '--skipLibCheck', '--noCheck'], { stdio: 'pipe' });
execFileSync(process.execPath, [tsc, '--ignoreConfig', 'apps/desktop/src/main/protected-side-artifact-store.ts', '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler', '--rootDir', 'apps/desktop/src/main', '--outDir', root, '--types', 'node', '--skipLibCheck', '--noCheck'], { stdio: 'pipe' });
const encryptionModule = join(root, 'encryption.js');
const storeModule = join(root, 'protected-side-artifact-store.js');
let storeSource = await readFile(storeModule, 'utf8');
storeSource = storeSource.replace("from '@ppt/security'", "from './encryption.js'");
const patchedStoreModule = join(root, 'protected-store.js');
await writeFile(patchedStoreModule, storeSource);
const { ProtectedSideArtifactStore } = await import(pathToFileURL(patchedStoreModule).href);

const checks = [];
const check = (label, condition) => {
  if (!condition) throw new Error(label);
  checks.push(label);
};
const protector = {
  protectionId: 'test-windows-dpapi',
  required: true,
  isAvailable: () => true,
  protect: (value) => Buffer.from(`wrapped:${value}`, 'utf8').toString('base64url'),
  unprotect: (value) => Buffer.from(value, 'base64url').toString('utf8').slice('wrapped:'.length)
};
const keyPath = join(root, 'secrets', 'side-artifact-key.json');
const store = new ProtectedSideArtifactStore({ keyPath, applicationVersion: '01.08.2026.214', protector, now: () => '2026-08-01T17:00:00.000Z' });
check('side-artifact key envelope is created', existsSync(keyPath));
const keyEnvelopeText = await readFile(keyPath, 'utf8');
check('key envelope is device-wrapped and does not expose an AES key field', keyEnvelopeText.includes('protectedDataKey') && !keyEnvelopeText.includes('dataKey":"'));

const secret = 'KİŞİSEL-HASSAS-VERİ-214';
const diagPath = join(root, 'exports', 'sample.pptdiag');
const written = store.writeText(diagPath, 'diagnostic-export', secret);
const encryptedText = await readFile(diagPath, 'utf8');
check('encrypted diagnostic container does not contain plaintext', !encryptedText.includes(secret));
const envelope = JSON.parse(encryptedText);
check('container uses AES-256-GCM', envelope.encryption?.algorithm === 'aes-256-gcm' && envelope.encryption?.version === 1);
check('encrypted diagnostic round-trips', store.readText(diagPath) === secret);
check('descriptor hash covers ciphertext container', written.sha256 === (await import('node:crypto')).createHash('sha256').update(await readFile(diagPath)).digest('hex'));

const logPath = join(root, 'logs', 'desktop-main.pplog');
store.appendTextRecord(logPath, 'log-event', JSON.stringify({ event: 'demo', metadata: { name: secret } }));
const logText = await readFile(logPath, 'utf8');
check('protected log record does not contain plaintext metadata', !logText.includes(secret));
const logEnvelope = JSON.parse(logText.trim());
check('protected log record decrypts to the original event', store.openEnvelope(logEnvelope).toString('utf8').includes(secret));

const tampered = JSON.parse(encryptedText);
tampered.encryption.ciphertext = `${tampered.encryption.ciphertext.slice(0, -2)}AA`;
const tamperedPath = join(root, 'exports', 'tampered.pptdiag');
await writeFile(tamperedPath, `${JSON.stringify(tampered)}\n`);
let tamperRejected = false;
try { store.readText(tamperedPath); } catch { tamperRejected = true; }
check('AES-GCM authentication rejects tampering', tamperRejected);
store.dispose();

const store2 = new ProtectedSideArtifactStore({ keyPath, applicationVersion: '01.08.2026.214', protector });
check('device-wrapped key is reusable across process instances', store2.readText(diagPath) === secret);
store2.dispose();

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build214-protected-side-artifact-runtime.json', `${JSON.stringify({
  schemaVersion: 1,
  build: 214,
  status: 'PASS',
  checks: checks.length,
  results: checks,
  encryption: 'AES-256-GCM',
  deviceKeyProtectionRuntime: 'MOCK_PROTECTOR_ONLY',
  windowsSafeStorageDpapiRuntime: 'NOT_RUN',
  generatedAt: new Date().toISOString(),
  limitations: [
    'The cryptographic container and key-wrapping interface are exercised with a deterministic mock DeviceSecretProtector.',
    'Real Electron safeStorage/Windows DPAPI behavior remains NOT_RUN until a packaged Windows validation environment is used.'
  ]
}, null, 2)}\n`);
await rm(root, { recursive: true, force: true });
console.log(`Build 214 protected side-artifact runtime: PASS (${checks.length}/${checks.length}).`);
