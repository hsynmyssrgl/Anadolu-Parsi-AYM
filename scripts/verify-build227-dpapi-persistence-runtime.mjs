import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const root = process.cwd();
const temporaryRoot = await mkdtemp(join(tmpdir(), 'ppt-b227-dpapi-'));
const helperPath = join(temporaryRoot, 'helper.mjs');
const userData = join(temporaryRoot, 'user-data');
const keyPath = join(userData, 'secrets', 'side-artifact-key.json');
const artifactPath = join(userData, 'validation', 'roundtrip.pptdiag');
const protectorModule = new URL(`file:///${resolve(root, 'apps/desktop/dist/main/device-secret-protector.js').replaceAll('\\', '/')}`).href;
const storeModule = new URL(`file:///${resolve(root, 'apps/desktop/dist/main/protected-side-artifact-store.js').replaceAll('\\', '/')}`).href;
const helper = `
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { WindowsDpapiDeviceSecretProtector } from ${JSON.stringify(protectorModule)};
import { ProtectedSideArtifactStore } from ${JSON.stringify(storeModule)};
const [mode, keyPath, artifactPath] = process.argv.slice(2);
const protector = new WindowsDpapiDeviceSecretProtector({ required: true });
const store = new ProtectedSideArtifactStore({ keyPath, applicationVersion: '02.08.2026.227', protector });
if (mode === 'create') {
  const marker = randomBytes(48).toString('base64url');
  store.writeText(artifactPath, 'build227-cross-process-probe', marker);
  const keyBytes = readFileSync(keyPath);
  const artifactBytes = readFileSync(artifactPath);
  console.log(JSON.stringify({ status: 'PASS', protectionId: protector.protectionId, keyEnvelopeSha256: createHash('sha256').update(keyBytes).digest('hex'), artifactSha256: createHash('sha256').update(artifactBytes).digest('hex'), plaintextSha256: createHash('sha256').update(marker).digest('hex'), plaintextLeaked: artifactBytes.includes(Buffer.from(marker, 'utf8')) }));
} else if (mode === 'read') {
  const marker = store.readText(artifactPath);
  const keyBytes = readFileSync(keyPath);
  console.log(JSON.stringify({ status: 'PASS', protectionId: protector.protectionId, keyEnvelopeSha256: createHash('sha256').update(keyBytes).digest('hex'), plaintextSha256: createHash('sha256').update(marker).digest('hex') }));
} else { throw new Error('unsupported mode'); }
store.dispose();
`;
await writeFile(helperPath, helper);

const run = (mode) => spawnSync(process.execPath, [helperPath, mode, keyPath, artifactPath], { cwd: root, encoding: 'utf8', windowsHide: true });
const parse = (result) => { try { return JSON.parse(result.stdout.trim()); } catch { return undefined; } };
const results = [];
const check = (id, condition, details) => results.push({ id, status: condition ? 'PASS' : 'FAIL', ...(details === undefined ? {} : { details }) });

if (process.platform !== 'win32') {
  check('real-windows-required', false, process.platform);
} else {
  const first = run('create');
  const firstData = parse(first);
  check('fresh-process-encrypt', first.status === 0 && firstData?.status === 'PASS', { exitCode: first.status, stderr: first.stderr });
  check('plaintext-not-logged-or-stored', firstData?.plaintextLeaked === false, firstData?.plaintextLeaked);
  const second = run('read');
  const secondData = parse(second);
  check('second-independent-process-decrypt', second.status === 0 && secondData?.status === 'PASS', { exitCode: second.status, stderr: second.stderr });
  check('cross-process-key-envelope-persistence', firstData?.keyEnvelopeSha256 === secondData?.keyEnvelopeSha256, { run1: firstData?.keyEnvelopeSha256, run2: secondData?.keyEnvelopeSha256 });
  check('protected-side-artifact-roundtrip', firstData?.plaintextSha256 === secondData?.plaintextSha256, { run1: firstData?.plaintextSha256, run2: secondData?.plaintextSha256 });

  const originalArtifact = await readFile(artifactPath, 'utf8');
  const tamperedArtifact = JSON.parse(originalArtifact);
  tamperedArtifact.encryption.ciphertext = `${tamperedArtifact.encryption.ciphertext.slice(0, -4)}AAAA`;
  await writeFile(artifactPath, `${JSON.stringify(tamperedArtifact)}\n`);
  const tamper = run('read');
  check('tamper-ciphertext-fails', tamper.status !== 0, tamper.status);
  await writeFile(artifactPath, originalArtifact);

  const originalKey = await readFile(keyPath, 'utf8');
  const wrongProvider = JSON.parse(originalKey);
  wrongProvider.protectionId = 'wrong-provider-v1';
  const wrongProviderText = `${JSON.stringify(wrongProvider, null, 2)}\n`;
  await writeFile(keyPath, wrongProviderText);
  const wrong = run('read');
  check('wrong-provider-fails-closed', wrong.status !== 0, wrong.status);
  check('wrong-provider-envelope-not-replaced', createHash('sha256').update(await readFile(keyPath)).digest('hex') === createHash('sha256').update(wrongProviderText).digest('hex'));

  const undecryptable = JSON.parse(originalKey);
  undecryptable.protectedDataKey = Buffer.alloc(64, 0xa5).toString('base64');
  const undecryptableText = `${JSON.stringify(undecryptable, null, 2)}\n`;
  await writeFile(keyPath, undecryptableText);
  const badCipher = run('read');
  check('undecryptable-envelope-fails-closed', badCipher.status !== 0, badCipher.status);
  check('undecryptable-envelope-not-replaced', createHash('sha256').update(await readFile(keyPath)).digest('hex') === createHash('sha256').update(undecryptableText).digest('hex'));
  await writeFile(keyPath, originalKey);
}

const failures = results.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1,
  build: 227,
  applicationVersion: '02.08.2026.227',
  platform: process.platform,
  status: failures.length ? 'FAIL' : 'PASS',
  checks: results.length,
  passed: results.length - failures.length,
  failed: failures.length,
  results,
  secretMaterialLogged: false,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build227-dpapi-persistence-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
await rm(temporaryRoot, { recursive: true, force: true });
console.log(`Build227 DPAPI persistence runtime: ${report.status} (${report.passed}/${report.checks}).`);
if (failures.length) process.exitCode = 1;
