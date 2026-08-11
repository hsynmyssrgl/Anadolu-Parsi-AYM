import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const commands = [
  { name: 'governed-preflight', script: 'scripts/run-governed-preflight.mjs' },
  { name: '29-D2-C-crosswalk', script: 'scripts/verify-29-d2-c-crosswalk.mjs' }
];
const results = [];
let failed = false;
for (const command of commands) {
  const processResult = spawnSync(process.execPath, [command.script], { encoding: 'utf8', env: process.env });
  const exitCode = Number.isInteger(processResult.status) ? processResult.status : 1;
  const result = {
    name: command.name,
    script: command.script,
    exitCode,
    signal: processResult.signal ?? null,
    stdout: (processResult.stdout ?? '').trim(),
    stderr: (processResult.stderr ?? '').trim(),
    status: exitCode === 0 ? 'PASS' : 'FAIL'
  };
  results.push(result);
  if (exitCode !== 0) { failed = true; break; }
}
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  workStep: '29-D2-C',
  phase: 'GOVERNED_PREFLIGHT_AND_EXPLICIT_CROSSWALK',
  status: failed ? 'FAIL' : 'PASS',
  allExitCodesZero: !failed && results.length === commands.length && results.every((entry) => entry.exitCode === 0),
  executedCommandCount: results.length,
  requiredCommandCount: commands.length,
  results,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/29-D2-C-validation-evidence.json', `${JSON.stringify(report, null, 2)}\n`);
for (const result of results) {
  console.log(`${result.name}: ${result.status} / exit ${result.exitCode}`);
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
}
if (failed) process.exit(1);
console.log('29-D2-C combined validation: PASS.');
