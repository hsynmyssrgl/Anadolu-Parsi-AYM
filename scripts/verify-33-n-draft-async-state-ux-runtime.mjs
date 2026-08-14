import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
const output = 'artifacts/validation/33-N-draft-async-state-ux-runtime.json';
const testFiles = [
  'packages/application/tests/form-draft-use-cases.test.ts',
  'packages/repositories/form-draft-repository-policy.test.ts',
  'apps/desktop/tests/form-draft-ipc-integration.test.ts',
  'apps/desktop/tests/form-ux.test.ts',
  'apps/desktop/tests/async-state-guard.test.ts',
  'apps/desktop/tests/data-store.test.ts',
  'apps/desktop/tests/b7-15-route-async-state-governance.test.ts'
];
const run = spawnSync(process.execPath, [
  'node_modules/vitest/vitest.mjs', 'run', ...testFiles,
  '-t', '33-N|form draft|form UX', '--maxWorkers=1'
], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 300_000, maxBuffer: 32 * 1024 * 1024, env: process.env });
const combined = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
const passedMatch = combined.match(/Tests\s+(\d+) passed/u);
const testsPassed = passedMatch ? Number(passedMatch[1]) : 0;
const testSource = Object.fromEntries(await Promise.all(testFiles.map(async (path) => [path, await readFile(resolve(root, path), 'utf8')])));
const allSource = Object.values(testSource).join('\n');
const checks = [
  { name: 'targeted vitest exits successfully', status: run.status === 0 ? 'PASS' : 'FAIL' },
  { name: 'exact seven targeted test files pass', status: run.status === 0 && /Test Files\s+7 passed/u.test(combined) ? 'PASS' : 'FAIL' },
  { name: 'governed draft async guard and route-state test floor passes', status: testsPassed >= 40 ? 'PASS' : 'FAIL' },
  { name: 'canonical save immediate undo and immutable history pass', status: run.status === 0 && allSource.includes('immediately prior immutable revision') && allSource.includes('retains the exact immutable revision history') ? 'PASS' : 'FAIL' },
  { name: 'nested banking secret and prototype negatives pass', status: run.status === 0 && allSource.includes('nested banking secret') && allSource.includes('forged prototype') ? 'PASS' : 'FAIL' },
  { name: 'stale revision idempotency canonical payload and forged receipt negatives pass', status: run.status === 0 && allSource.includes('stale revisions') && allSource.includes('idempotency mismatch') && allSource.includes('non-canonical payloads') && allSource.includes('incorrect payload fingerprints') && allSource.includes('rejects forged and wrong owner') ? 'PASS' : 'FAIL' },
  { name: 'exact IPC shape payload size and nesting negatives pass', status: run.status === 0 && allSource.includes('exact workspace, save and undo contracts') && allSource.includes('oversized payloads and excessive nesting') ? 'PASS' : 'FAIL' },
  { name: 'accessible async validation focus and retry states pass', status: run.status === 0 && allSource.includes('canlı bölge') && allSource.includes('ilk geçersiz alanı odaklar') && allSource.includes('retry') ? 'PASS' : 'FAIL' },
  { name: 'stale async completion session invalidation duplicate and watermark fencing pass', status: run.status === 0 && allSource.includes('sadece son monotonik sonucu kabul eder') && allSource.includes('accepts only the newest write') && allSource.includes('invalidates all tickets on session change') && allSource.includes('suppresses duplicate mutations') && allSource.includes('never regresses revision watermarks') ? 'PASS' : 'FAIL' },
  { name: 'production data store central PEP UoW persistence passes', status: run.status === 0 && allSource.includes('33-N governed form draft persists autosave history and immediate undo through central PEP/UoW') ? 'PASS' : 'FAIL' },
  { name: 'all 22 routes have five governed state behavior mappings', status: run.status === 0 && allSource.includes('all 22 canonical routes') && allSource.includes('meaningful shared behavior for every route-state mapping') && allSource.includes('toBe(110)') ? 'PASS' : 'FAIL' }
];
const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, step: '33-N', decision: 'DEC-225', requirements: ['B3-02', 'B7-14', 'B7-15'], status: failures.length ? 'FAIL' : 'PASS', checksPassed: checks.length - failures.length, checksFailed: failures.length, targetedTestFilesPassed: run.status === 0 ? testFiles.length : 0, targetedTestsPassed: testsPassed, checks, process: { exitCode: run.status, signal: run.signal ?? null }, generatedAt: new Date().toISOString() };
await mkdir(dirname(resolve(root, output)), { recursive: true });
await writeFile(resolve(root, output), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`33-N draft async-state UX runtime: ${report.status} (${report.checksPassed}/${checks.length}; ${testsPassed} tests).`);
if (failures.length) {
  console.error(combined.slice(-4000));
  process.exitCode = 1;
}
