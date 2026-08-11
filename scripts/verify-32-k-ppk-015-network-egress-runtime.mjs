import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const node = process.execPath;
const tasks = [
  { id: 'network-egress-source-gate', args: ['scripts/verify-network-egress-boundary.mjs'], expect: '"status": "PASS"' },
  { id: 'ppk015-targeted-policy-use-case', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/ppk015-network-egress-policy.test.ts', '--maxWorkers=1'], expect: '17 passed' },
  { id: 'ppk014-versioned-api-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/core-service/tests/ppk014-versioned-core-service-api-boundary.test.ts', '--maxWorkers=1'], expect: '17 passed' },
  { id: 'ppk013-data-access-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/ppk013-client-data-access-boundary.test.ts', '--maxWorkers=1'], expect: '20 passed' },
  { id: 'ppk012-offline-cache-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/ppk012-offline-capability-lease-cache-fence.test.ts', '--maxWorkers=1'], expect: '12 passed' },
  { id: 'migration-76-no-new-schema-runtime', before: [['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json']], args: ['scripts/verify-database-migrations.mjs'], expect: '"version": 76' },
  { id: 'root-typescript', args: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit'], expect: '' }
];

const checks = [];
for (const task of tasks) {
  let beforeFailure;
  for (const before of task.before ?? []) {
    const result = spawnSync(node, before, { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    if (result.status !== 0) { beforeFailure = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim(); break; }
  }
  if (beforeFailure) {
    checks.push({ id: task.id, status: 'FAIL', exitCode: -1, expectedOutput: task.expect, output: beforeFailure });
    continue;
  }
  const result = spawnSync(node, task.args, { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
  const passed = result.status === 0 && (task.expect === '' || output.includes(task.expect));
  checks.push({ id: task.id, status: passed ? 'PASS' : 'FAIL', exitCode: result.status, expectedOutput: task.expect, output: output.slice(-8_000) });
}
const failures = checks.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-K',
  requirement: 'PPK-015',
  phase: 'NETWORK_EGRESS_POLICY_RUNTIME',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  realNetworkRequestPerformed: false,
  realDataTransferPerformed: false,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-K-ppk-015-network-egress-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`32-K PPK-015 runtime: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure.id}`);
  process.exit(1);
}
console.log(`32-K PPK-015 runtime: PASS (${checks.length}/${checks.length}).`);
