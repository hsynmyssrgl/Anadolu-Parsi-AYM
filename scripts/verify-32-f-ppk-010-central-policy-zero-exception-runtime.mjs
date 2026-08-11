import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/gu;
const normalize = (value) => String(value ?? '').replace(ANSI, '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const commands = [
  { id: 'ppk-010-contract', args: ['scripts/verify-32-f-ppk-010-central-policy-zero-exception-contract.mjs'], expectOutput: 'PASS (32/32)' },
  { id: 'ppk-010-targeted-zero-exception', args: ['node_modules/vitest/vitest.mjs','run','packages/security/central-policy-zero-exception.test.ts','--reporter=dot'], minimumTests: 10 },
  { id: 'central-security-regression', args: ['node_modules/vitest/vitest.mjs','run','packages/security/tests/security.test.ts','--reporter=dot'], minimumTests: 2 },
  { id: 'repository-and-adapter-regression', args: ['node_modules/vitest/vitest.mjs','run','packages/repositories/life-repository-policy.test.ts','apps/desktop/tests/health-repository-row-visibility-runtime.test.ts','apps/desktop/tests/archive-production-policy-runtime.test.ts','apps/desktop/tests/data-store.test.ts','apps/desktop/tests/family-data-import-policy-batch-runtime.test.ts','--reporter=dot'], minimumTests: 30 },
  { id: 'universal-core-policy-regression', args: ['node_modules/vitest/vitest.mjs','run','apps/desktop/tests/desktop-universal-api-policy-enforcement.test.ts','apps/desktop/tests/core-service-policy-reevaluation.test.ts','--reporter=dot'], minimumTests: 19 },
  { id: 'migration-74-central-authority', before: [['node_modules/typescript/bin/tsc','-p','packages/database/tsconfig.json']], args: ['scripts/verify-database-migrations.mjs'], expectOutput: '"version": 74' },
  { id: 'root-typescript', args: ['node_modules/typescript/bin/tsc','--noEmit'], expectOutput: '' },
  { id: 'full-vitest-regression', args: ['node_modules/vitest/vitest.mjs','run','--reporter=dot'], minimumTests: 380 }
];
const execute = (args) => spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8', timeout: 300_000, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
const results = commands.map((command) => {
  const preparations = (command.before ?? []).map(execute);
  const execution = preparations.some((item) => item.status !== 0) ? preparations.find((item) => item.status !== 0) : execute(command.args);
  const output = normalize(`${execution.stdout ?? ''}\n${execution.stderr ?? ''}`);
  const match = output.match(/Tests\s+(\d+) passed/u);
  const tests = match ? Number.parseInt(match[1], 10) : undefined;
  const passed = execution.status === 0 && execution.signal === null && execution.error === undefined
    && (command.minimumTests === undefined || (tests !== undefined && tests >= command.minimumTests))
    && (command.expectOutput === undefined || output.includes(command.expectOutput));
  return { id: command.id, status: passed ? 'PASS' : 'FAIL', exitCode: execution.status, signal: execution.signal,
    ...(tests === undefined ? {} : { tests }), ...(command.minimumTests === undefined ? {} : { minimumTests: command.minimumTests }),
    ...(command.expectOutput === undefined ? {} : { expectedOutput: command.expectOutput }), outputSha256: sha256(output),
    outputTail: output.length <= 1600 ? output : output.slice(-1600) };
});
const failed = results.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '32-F', requirement: 'PPK-010',
  phase: 'CENTRAL_POLICY_ZERO_EXCEPTION_RUNTIME', status: failed.length ? 'FAIL' : 'PASS',
  checkCount: results.length, passed: results.length - failed.length, failed: failed.length, results,
  validatedBoundaries: ['EMPTY_EXCEPTION_REGISTRY','CENTRAL_ADMINISTRATION_DECISIONS','CENTRAL_COLLECTION_VISIBILITY','NON_GRANTING_ROLE_IDENTITY','PRODUCTION_STATIC_ZERO_SCAN','CORE_UNIVERSAL_PEP','MIGRATION_74_AUTHORITY_REUSE','FULL_VITEST_REGRESSION'],
  cutoverAuthorityAttached: false, realDataTransferPerformed: false,
  requirementCompletionClaimed: failed.length === 0, generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-F-ppk-010-central-policy-zero-exception-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length) {
  console.error(`32-F PPK-010 runtime: FAIL (${failed.length}/${results.length}).`);
  for (const item of failed) console.error(`${item.id}: ${item.outputTail}`);
  process.exit(1);
}
console.log(`32-F PPK-010 runtime: PASS (${results.length}/${results.length}).`);
