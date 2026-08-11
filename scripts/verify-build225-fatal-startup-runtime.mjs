import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const root = process.cwd();
const temp = await mkdtemp(join(tmpdir(), 'ppt-build225-fatal-'));
const file = 'apps/desktop/src/main/main.ts';
const target = join(temp, file);
await mkdir(dirname(target), { recursive: true });
await cp(resolve(root, file), target);
const verifier = resolve(root, 'scripts/verify-build225-fatal-startup-contract.mjs');
const invoke = (name) => spawnSync(process.execPath, [verifier, temp, join(temp, `${name}.json`)], { cwd: root, encoding: 'utf8' });
const valid = invoke('valid');

await writeFile(target, (await readFile(target, 'utf8')).replace('app.exit(1);', 'app.quit();'));
const zeroTamper = invoke('zero-exit-tamper');

await cp(resolve(root, file), target);
await writeFile(
  target,
  (await readFile(target, 'utf8')).replace(
    'errorFingerprint = sensitiveLogPolicy.hashSensitiveSignal(error);',
    "errorFingerprint = '0'.repeat(64);"
  )
);
const fingerprintTamper = invoke('fingerprint-tamper');

const results = [
  { id: 'valid-contract-pass', status: valid.status === 0 ? 'PASS' : 'FAIL' },
  { id: 'zero-exit-tamper-rejected', status: zeroTamper.status !== 0 ? 'PASS' : 'FAIL' },
  { id: 'fingerprint-loss-tamper-rejected', status: fingerprintTamper.status !== 0 ? 'PASS' : 'FAIL' }
];
const status = results.every((entry) => entry.status === 'PASS') ? 'PASS' : 'FAIL';
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build225-fatal-startup-runtime.json', `${JSON.stringify({
  schemaVersion: 1,
  build: 225,
  status,
  checks: results.length,
  results,
  generatedAt: new Date().toISOString()
}, null, 2)}\n`);
await rm(temp, { recursive: true, force: true });
console.log(`Build225 fatal startup runtime/tamper: ${status} (${results.filter((entry) => entry.status === 'PASS').length}/${results.length}).`);
if (status !== 'PASS') process.exitCode = 1;
