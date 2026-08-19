import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const root = process.cwd();
const temp = await mkdtemp(join(tmpdir(), 'ppt-build226-fresh-profile-'));
const stage = join(temp, 'stage');
const out = join(temp, 'out');
await mkdir(stage, { recursive: true });
await mkdir(out, { recursive: true });

const copySource = async (source, target, transform = (value) => value) => {
  const destination = join(stage, target);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, transform(await readFile(resolve(root, source), 'utf8')));
};
await copySource('packages/security/src/device-identity.ts', 'security-device-identity.ts', (source) => source.replace("import type { IsoDateTime } from '@ppt/core';", 'type IsoDateTime = string;'));
await copySource('packages/security/src/device-secret-protector.ts', 'device-secret-protector.ts');
await copySource('apps/desktop/src/main/device-identity.ts', 'device-identity.ts', (source) => source
  .replace("import type { Clock } from '@ppt/core';", 'interface Clock { now(): string; }')
  .replace("from '@ppt/security';", "from './security-device-identity.js';"));
await copySource('apps/desktop/src/main/ipc-adaptive-budget-maintenance-reauthentication-state.ts', 'ipc-adaptive-budget-maintenance-reauthentication-state.ts');
await copySource('apps/desktop/src/main/ipc-adaptive-budget-maintenance-reauthentication-guard.ts', 'ipc-adaptive-budget-maintenance-reauthentication-guard.ts');

const testSource = `
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FileDeviceIdentityProvider } from './device-identity.js';
import { IpcAdaptiveBudgetMaintenanceReauthenticationStateStore } from './ipc-adaptive-budget-maintenance-reauthentication-state.js';
import { IpcAdaptiveBudgetMaintenanceReauthenticationGuard } from './ipc-adaptive-budget-maintenance-reauthentication-guard.js';

const temp = process.argv[2];
if (!temp) throw new Error('runtime temp path is required');
const results: Array<{ id: string; status: 'PASS' | 'FAIL'; error?: string }> = [];
const check = (id: string, operation: () => void) => { try { operation(); results.push({ id, status: 'PASS' }); } catch (error) { results.push({ id, status: 'FAIL', error: error instanceof Error ? (error.stack ?? error.message) : String(error) }); } };
const clock = { now: () => '2026-08-02T15:00:00.000Z' };
const protector = {
  protectionId: 'test-os-secret-v1',
  required: true,
  isAvailable: () => true,
  protect: (plainText: string) => Buffer.from('protected-v1:' + plainText, 'utf8').toString('base64'),
  unprotect: (protectedBase64: string) => {
    const decoded = Buffer.from(protectedBase64, 'base64').toString('utf8');
    if (!decoded.startsWith('protected-v1:')) throw new Error('ciphertext cannot be unprotected');
    return decoded.slice('protected-v1:'.length);
  }
};
const binding = (snapshot: { deviceId: string; fingerprint: string }) => createHash('sha256').update(snapshot.deviceId + '\\0' + snapshot.fingerprint, 'utf8').digest('hex');
const firstRoot = join(temp, 'fresh-user-data');
const identityPath = join(firstRoot, 'secrets', 'device-identity.json');
const stateDirectory = join(firstRoot, 'runtime-state');
assert.equal(existsSync(identityPath), false);
let firstBinding = '';
let statePath = '';
check('first-launch-protected-device-identity-created', () => {
  const provider = new FileDeviceIdentityProvider(identityPath, clock, protector);
  firstBinding = binding(provider.snapshot());
  assert.equal(existsSync(identityPath), true);
  const envelope = JSON.parse(readFileSync(identityPath, 'utf8'));
  assert.equal(envelope.schemaVersion, 2);
  assert.equal(envelope.protection.id, protector.protectionId);
  assert.equal(typeof envelope.privateKeyCiphertextBase64, 'string');
  assert.equal(JSON.stringify(envelope).includes('BEGIN PRIVATE KEY'), false);
});
check('first-launch-maintenance-state-persisted', () => {
  const persistence = new IpcAdaptiveBudgetMaintenanceReauthenticationStateStore({ directoryPath: stateDirectory, applicationVersion: '02.08.2026.226', protector: () => protector, deviceBinding: () => firstBinding });
  const guard = new IpcAdaptiveBudgetMaintenanceReauthenticationGuard({ persistence });
  const restored = guard.restore(1_000);
  assert.equal(restored.status, 'MISSING');
  statePath = join(stateDirectory, 'ipc-adaptive-budget-maintenance-reauthentication.json');
  assert.equal(existsSync(statePath), true);
  const stateEnvelope = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.equal(stateEnvelope.schemaVersion, 2);
  assert.equal(stateEnvelope.protection.id, protector.protectionId);
  assert.equal(stateEnvelope.protection.deviceBindingSha256, firstBinding);
});
check('second-launch-state-restored', () => {
  const provider = new FileDeviceIdentityProvider(identityPath, clock, protector);
  const secondBinding = binding(provider.snapshot());
  assert.equal(secondBinding, firstBinding);
  const persistence = new IpcAdaptiveBudgetMaintenanceReauthenticationStateStore({ directoryPath: stateDirectory, applicationVersion: '02.08.2026.226', protector: () => protector, deviceBinding: () => secondBinding });
  const guard = new IpcAdaptiveBudgetMaintenanceReauthenticationGuard({ persistence });
  const restored = guard.restore(2_000);
  assert.equal(restored.status, 'RESTORED');
  assert.equal(restored.recoveryHold, false);
});
const originalIdentity = readFileSync(identityPath, 'utf8');
check('corrupt-device-identity-fails-closed', () => {
  writeFileSync(identityPath, '{broken-json', 'utf8');
  assert.throws(() => new FileDeviceIdentityProvider(identityPath, clock, protector));
  writeFileSync(identityPath, originalIdentity, 'utf8');
});
check('wrong-device-protection-provider-fails-closed', () => {
  const envelope = JSON.parse(originalIdentity);
  envelope.protection.id = 'wrong-provider-v1';
  writeFileSync(identityPath, JSON.stringify(envelope), 'utf8');
  assert.throws(() => new FileDeviceIdentityProvider(identityPath, clock, protector));
  writeFileSync(identityPath, originalIdentity, 'utf8');
});
check('undecipherable-device-ciphertext-fails-closed', () => {
  const envelope = JSON.parse(originalIdentity);
  envelope.privateKeyCiphertextBase64 = Buffer.from('not-valid-protected-content', 'utf8').toString('base64');
  writeFileSync(identityPath, JSON.stringify(envelope), 'utf8');
  assert.throws(() => new FileDeviceIdentityProvider(identityPath, clock, protector));
  writeFileSync(identityPath, originalIdentity, 'utf8');
});
check('unavailable-os-protection-fails-closed', () => {
  const unavailable = { ...protector, isAvailable: () => false };
  assert.throws(() => new FileDeviceIdentityProvider(join(temp, 'unavailable', 'device-identity.json'), clock, unavailable));
});
check('maintenance-device-binding-mismatch-rejected', () => {
  const mismatched = createHash('sha256').update('different-device', 'utf8').digest('hex');
  const persistence = new IpcAdaptiveBudgetMaintenanceReauthenticationStateStore({ directoryPath: stateDirectory, applicationVersion: '02.08.2026.226', protector: () => protector, deviceBinding: () => mismatched });
  const guard = new IpcAdaptiveBudgetMaintenanceReauthenticationGuard({ persistence });
  const restored = guard.restore(3_000);
  assert.equal(restored.status, 'REJECTED');
  assert.equal(restored.recoveryHold, true);
});
const status = results.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL';
console.log(JSON.stringify({ status, assertions: results.length, results }));
if (status !== 'PASS') process.exitCode = 1;
`;
await writeFile(join(stage, 'runtime-test.ts'), testSource);
await writeFile(join(stage, 'tsconfig.json'), `${JSON.stringify({ compilerOptions: { target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, skipLibCheck: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, types: ['node'], typeRoots: [resolve(root, 'node_modules/@types')], rootDir: '.', outDir: '../out' }, include: ['*.ts'] }, null, 2)}\n`);
await writeFile(join(stage, 'package.json'), '{"type":"module"}\n');
await writeFile(join(out, 'package.json'), '{"type":"module"}\n');

const compiler = resolve(root, 'node_modules/typescript/lib/tsc.js');
const compile = spawnSync(process.execPath, [compiler, '-p', join(stage, 'tsconfig.json')], { cwd: root, encoding: 'utf8' });
const execution = compile.status === 0
  ? spawnSync(process.execPath, [join(out, 'runtime-test.js'), temp], { cwd: out, encoding: 'utf8' })
  : { status: 1, stdout: '', stderr: `${compile.stdout}\n${compile.stderr}` };
let parsed;
try { parsed = JSON.parse(execution.stdout.trim()); } catch { parsed = undefined; }
const status = compile.status === 0 && execution.status === 0 && parsed?.status === 'PASS' ? 'PASS' : 'FAIL';
const report = { schemaVersion: 1, build: 226, applicationVersion: '02.08.2026.226', scope: 'Fresh profile protected device identity initialization before device-bound maintenance state restore, second launch and fail-closed tamper cases', status, assertions: parsed?.assertions ?? 0, results: parsed?.results ?? [], compileExitCode: compile.status, executionExitCode: execution.status, stdout: execution.stdout, stderr: execution.stderr, generatedAt: new Date().toISOString() };
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build226-fresh-profile-startup-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
await rm(temp, { recursive: true, force: true });
console.log(`Build226 fresh-profile startup runtime: ${status} (${report.assertions} assertions).`);
if (status !== 'PASS') process.exitCode = 1;
