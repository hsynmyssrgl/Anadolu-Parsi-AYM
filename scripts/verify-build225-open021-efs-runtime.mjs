import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const root = process.cwd();
const temp = await mkdtemp(join(tmpdir(), 'ppt-build225-open021-'));
const files = ['apps/desktop/src/main/windows-open021-efs-evidence-probe.ts','apps/desktop/src/main/volatile-sqlite-session.ts','apps/desktop/src/main/windows-efs-protection.ts'];
for (const file of files) { const target = join(temp, file); await mkdir(dirname(target), { recursive: true }); await cp(resolve(root, file), target); }
const verifier = resolve(root, 'scripts/verify-build225-open021-efs-contract.mjs');
const invoke = (name) => spawnSync(process.execPath, [verifier, temp, join(temp, `${name}.json`)], { cwd: root, encoding: 'utf8' });
const valid = invoke('valid');
const helper = join(temp, 'apps/desktop/src/main/windows-efs-protection.ts');
await writeFile(helper, (await readFile(helper, 'utf8')).replace("[Environment]::GetEnvironmentVariable('${WINDOWS_EFS_PATH_ENV}', 'Process')", '$args[0]'));
const argsTamper = invoke('args-tamper');
await cp(resolve(root, 'apps/desktop/src/main/windows-efs-protection.ts'), helper);
const session = join(temp, 'apps/desktop/src/main/volatile-sqlite-session.ts');
const sessionSource = await readFile(session, 'utf8');
const snapshotProtectionMarker = "protectWindowsPathWithEfs(snapshotPath, 'Windows EFS SQLite snapshot placeholder');";
const snapshotProtectionMarkerCount = sessionSource.split(snapshotProtectionMarker).length - 1;
if (snapshotProtectionMarkerCount === 1) {
  await writeFile(session, sessionSource.replace(snapshotProtectionMarker, '// tampered protection removed'));
}
const plaintextTamper = snapshotProtectionMarkerCount === 1 ? invoke('plaintext-tamper') : undefined;
const results = [
  { id: 'valid-contract-pass', status: valid.status === 0 ? 'PASS' : 'FAIL', details: valid.stderr },
  { id: 'positional-args-tamper-rejected', status: argsTamper.status !== 0 ? 'PASS' : 'FAIL', details: argsTamper.stdout },
  { id: 'snapshot-protection-marker-exactly-once', status: snapshotProtectionMarkerCount === 1 ? 'PASS' : 'FAIL', details: `count=${snapshotProtectionMarkerCount}` },
  { id: 'plaintext-snapshot-tamper-rejected', status: plaintextTamper?.status !== 0 ? 'PASS' : 'FAIL', details: plaintextTamper?.stdout ?? 'tamper was not executed because the marker count was not exactly one' }
];
const status = results.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL';
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build225-open021-efs-runtime.json', `${JSON.stringify({ schemaVersion: 1, build: 225, openWorkId: 'OPEN-021', status, checks: results.length, results, generatedAt: new Date().toISOString() }, null, 2)}\n`);
await rm(temp, { recursive: true, force: true });
console.log(`Build225 OPEN-021 EFS runtime/tamper: ${status} (${results.filter((item) => item.status === 'PASS').length}/${results.length}).`);
if (status !== 'PASS') process.exitCode = 1;
