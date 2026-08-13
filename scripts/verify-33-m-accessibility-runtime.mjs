import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
const output = 'artifacts/validation/33-M-accessibility-runtime.json';
const testFiles = [
  'packages/application/tests/accessibility-preferences-use-cases.test.ts',
  'packages/repositories/accessibility-preferences-repository-policy.test.ts',
  'apps/desktop/tests/accessibility-preferences-ipc-integration.test.ts',
  'apps/desktop/tests/accessibility-preference-center.test.ts',
  'apps/desktop/tests/data-store.test.ts'
];
const run = spawnSync(process.execPath, [
  'node_modules/vitest/vitest.mjs', 'run', ...testFiles,
  '-t', '33-M erişilebilirlik|accessibility', '--maxWorkers=1'
], {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true,
  timeout: 300_000,
  maxBuffer: 32 * 1024 * 1024,
  env: process.env
});
const combined = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
const passedMatch = combined.match(/Tests\s+(\d+) passed/u);
const testsPassed = passedMatch ? Number(passedMatch[1]) : 0;
const testSource = (await Promise.all(testFiles.map((path) => readFile(resolve(root, path), 'utf8')))).join('\n');
const checks = [
  { name: 'targeted vitest exits successfully', status: run.status === 0 ? 'PASS' : 'FAIL' },
  { name: 'exact targeted test files pass', status: run.status === 0 && /Test Files\s+5 passed/u.test(combined) ? 'PASS' : 'FAIL' },
  { name: 'governed preference test floor passes', status: testsPassed >= 19 ? 'PASS' : 'FAIL' },
  { name: 'malformed bootstrap negative case is present and suite passes', status: run.status === 0 && testSource.includes('fails closed to bounded values for malformed local bootstrap data') ? 'PASS' : 'FAIL' },
  { name: 'production data-store PEP and UoW persistence passes', status: run.status === 0 && testSource.includes('merkezi PEP ve aynı UoW ile kalıcılaştırır') ? 'PASS' : 'FAIL' },
  { name: 'repository forged receipt and immutable mutation tests pass', status: run.status === 0 && testSource.includes('rejects forged contexts') ? 'PASS' : 'FAIL' },
  { name: 'IPC exact shape and nested secret tests pass', status: run.status === 0 && testSource.includes('rejects nested secrets') ? 'PASS' : 'FAIL' },
  { name: 'no real-device certification claimed', status: 'PASS' },
  { name: 'no Narrator Magnifier or human UAT certification claimed', status: 'PASS' }
];
const failures = checks.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1,
  step: '33-M',
  decision: 'DEC-224',
  requirements: Array.from({ length: 13 }, (_, index) => `B7-${String(index + 1).padStart(2, '0')}`),
  status: failures.length ? 'FAIL' : 'PASS',
  checksPassed: checks.length - failures.length,
  checksFailed: failures.length,
  targetedTestFilesPassed: run.status === 0 ? testFiles.length : 0,
  targetedTestsPassed: testsPassed,
  checks,
  manualCertification: { windowsNarrator: 'NOT_RUN', windowsMagnifier: 'NOT_RUN', realDevice: 'NOT_RUN', humanUat: 'NOT_RUN', certificationClaimed: false },
  process: { exitCode: run.status, signal: run.signal ?? null },
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(resolve(root, output)), { recursive: true });
await writeFile(resolve(root, output), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`33-M accessibility runtime: ${report.status} (${report.checksPassed}/${checks.length}; ${testsPassed} tests).`);
if (failures.length) {
  console.error(combined.slice(-4000));
  process.exitCode = 1;
}
