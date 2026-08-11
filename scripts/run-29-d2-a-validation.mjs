import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const commands = [
  { name: 'governed-preflight', script: 'scripts/run-governed-preflight.mjs' },
  { name: '29-D2-A-input-lock', script: 'scripts/verify-29-d2-a-inventory-input-lock.mjs' }
];
const results = [];
let failed = false;
for (const command of commands) {
  const processResult = spawnSync(process.execPath, [command.script], { encoding: 'utf8', env: process.env });
  const result = {
    name: command.name,
    script: command.script,
    exitCode: processResult.status,
    stdout: (processResult.stdout ?? '').trim(),
    stderr: (processResult.stderr ?? '').trim(),
    status: processResult.status === 0 ? 'PASS' : 'FAIL'
  };
  results.push(result);
  if (processResult.status !== 0) { failed = true; break; }
}
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  workStep: '29-D2-A',
  phase: 'GOVERNED_PREFLIGHT_AND_INPUT_LOCK',
  status: failed ? 'FAIL' : 'PASS',
  allExitCodesZero: !failed && results.every((result) => result.exitCode === 0),
  results,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.'
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/29-D2-A-validation-evidence.json', `${JSON.stringify(report, null, 2)}\n`);
for (const result of results) {
  console.log(`${result.name}: ${result.status} / exit ${result.exitCode}`);
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
}
if (failed) process.exit(1);
console.log('29-D2-A combined validation: PASS.');
