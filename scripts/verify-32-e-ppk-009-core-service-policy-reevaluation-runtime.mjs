import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/gu;
const normalize = (value) => String(value ?? '').replace(ANSI, '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const commands = [
  { id: 'ppk-009-contract', args: ['scripts/verify-32-e-ppk-009-core-service-policy-reevaluation-contract.mjs'], expectOutput: 'PASS (32/32)' },
  { id: 'ppk-009-targeted-runtime', args: ['node_modules/vitest/vitest.mjs','run','apps/desktop/tests/core-service-policy-reevaluation.test.ts','--reporter=dot'], minimumTests: 10 },
  { id: 'policy-and-universal-regression', args: ['node_modules/vitest/vitest.mjs','run','packages/platform-policy','apps/desktop/tests/desktop-universal-api-policy-enforcement.test.ts','apps/core-service/tests/core-service-method-dispatcher.test.ts','--reporter=dot'], minimumTests: 100 },
  { id: 'production-core-provider-regression', args: ['node_modules/vitest/vitest.mjs','run','apps/core-service/tests/platform-policy-obligation-execution.test.ts','apps/desktop/tests/archive-production-policy-runtime.test.ts','--reporter=dot'], minimumTests: 5 },
  { id: 'migration-74-runtime', before: [['node_modules/typescript/bin/tsc','-p','packages/database/tsconfig.json']], args: ['scripts/verify-database-migrations.mjs'], expectOutput: '"version": 74' },
  { id: 'durable-decision-authority-repository', args: ['node_modules/vitest/vitest.mjs','run','apps/desktop/tests/archive-durable-policy-transaction-runtime.test.ts','--reporter=dot'], minimumTests: 17 },
  { id: 'root-typescript', args: ['node_modules/typescript/bin/tsc','--noEmit'], expectOutput: '' },
  { id: 'full-vitest-regression', args: ['node_modules/vitest/vitest.mjs','run','--reporter=dot'], minimumTests: 370 }
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
  schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '32-E', requirement: 'PPK-009',
  phase: 'CORE_SERVICE_POLICY_REEVALUATION_RUNTIME', status: failed.length ? 'FAIL' : 'PASS',
  checkCount: results.length, passed: results.length - failed.length, failed: failed.length, results,
  validatedBoundaries: ['SIGNED_CORE_DECISION_AUTHORITY','CORE_FRESH_REEVALUATION','UI_BYPASS_DEFAULT_DENY','PROVIDER_RELABEL_DEFAULT_DENY','EXPLICIT_BOOTSTRAP_ONLY','MIGRATION_74_BINDING','DURABLE_REPOSITORY_BINDING','FULL_VITEST_REGRESSION'],
  cutoverAuthorityAttached: false, realDataTransferPerformed: false,
  requirementCompletionClaimed: failed.length === 0, generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-E-ppk-009-core-service-policy-reevaluation-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length) {
  console.error(`32-E PPK-009 runtime: FAIL (${failed.length}/${results.length}).`);
  for (const item of failed) console.error(`${item.id}: ${item.outputTail}`);
  process.exit(1);
}
console.log(`32-E PPK-009 runtime: PASS (${results.length}/${results.length}).`);
