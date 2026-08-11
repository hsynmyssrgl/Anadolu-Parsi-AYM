import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/gu;
const normalize = (value) => String(value ?? '').replace(ANSI, '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const commands = [
  {
    id: 'root-typecheck',
    args: ['node_modules/typescript/bin/tsc', '--noEmit', '--pretty', 'false']
  },
  {
    id: 'full-vitest',
    args: ['node_modules/vitest/vitest.mjs', 'run', '--reporter=dot', '--silent'],
    minimumTestFiles: 51,
    minimumTests: 267
  },
  {
    id: '30-n-archive-policy-runtime-regression',
    args: ['scripts/verify-30-n-archive-policy-enforcement-runtime.mjs']
  },
  {
    id: '30-n-archive-policy-contract-regression',
    args: ['scripts/verify-30-n-archive-policy-enforcement-contract.mjs']
  },
  {
    id: '30-o-archive-production-composition-contract-regression',
    args: [
      'scripts/verify-30-o-archive-production-composition-contract.mjs',
      '--successor-regression',
      '--attempt=30p-clean'
    ]
  },
  {
    id: '30-o-core-service-policy-provider-runtime',
    args: [
      '--experimental-strip-types',
      '--experimental-loader',
      './scripts/ts-workspace-loader.mjs',
      'scripts/verify-30-o-core-service-policy-provider-runtime.mjs'
    ]
  },
  {
    id: '30-o-core-service-entrypoint-runtime',
    args: [
      '--experimental-strip-types',
      '--experimental-loader',
      './scripts/ts-workspace-loader.mjs',
      'scripts/verify-30-o-core-service-entrypoint-runtime.mjs'
    ]
  },
  {
    id: '30-o-protected-receipt-journal-runtime',
    args: ['scripts/verify-30-o-protected-receipt-journal-runtime.mjs']
  },
  {
    id: '31-u-w-remaining-boundaries-contract',
    args: ['scripts/verify-31-u-w-ppk-002-remaining-boundaries-contract.mjs']
  },
  {
    id: 'platform-policy-gate',
    args: ['scripts/verify-platform-policy-gate.mjs']
  }
];

const results = commands.map((command) => {
  const execution = spawnSync(process.execPath, command.args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true
  });
  const output = normalize(`${execution.stdout ?? ''}\n${execution.stderr ?? ''}`);
  const testFileMatch = output.match(/Test Files\s+(\d+) passed/u);
  const testMatch = output.match(/Tests\s+(\d+) passed/u);
  const testFiles = testFileMatch ? Number.parseInt(testFileMatch[1], 10) : undefined;
  const tests = testMatch ? Number.parseInt(testMatch[1], 10) : undefined;
  const countSatisfied = (
    (command.minimumTestFiles === undefined || (testFiles !== undefined && testFiles >= command.minimumTestFiles))
    && (command.minimumTests === undefined || (tests !== undefined && tests >= command.minimumTests))
  );
  const passed = execution.status === 0 && execution.signal === null && execution.error === undefined && countSatisfied;
  return Object.freeze({
    id: command.id,
    status: passed ? 'PASS' : 'FAIL',
    exitCode: execution.status,
    signal: execution.signal,
    ...(execution.error ? { error: execution.error.message } : {}),
    ...(testFiles === undefined ? {} : { testFiles }),
    ...(tests === undefined ? {} : { tests }),
    ...(command.minimumTestFiles === undefined ? {} : { minimumTestFiles: command.minimumTestFiles }),
    ...(command.minimumTests === undefined ? {} : { minimumTests: command.minimumTests }),
    outputSha256: sha256(output),
    outputTail: output.length <= 1_600 ? output : output.slice(-1_600)
  });
});

const failed = results.filter((result) => result.status === 'FAIL');
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '31-U-W',
  requirement: 'PPK-002',
  phase: 'REMAINING_TECHNICAL_BOUNDARIES_RUNTIME',
  status: failed.length === 0 ? 'PASS' : 'FAIL',
  checkCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  validatedBoundaries: [
    'UNIVERSAL_TRUSTED_RENDERER_API_PEP',
    'READ_CACHE_REAUTHORIZATION',
    'ARCHIVE_BUSINESS_READ_REPOSITORY_RECEIPT_BINDING',
    'STRICT_OBLIGATION_EXECUTION_ATTESTATION',
    'EXTERNAL_CORE_SERVICE_MONOTONIC_AUTHORITY',
    'ZERO_DIRECT_AUTHORIZATION_ROLE_COMPARISONS'
  ],
  requirementCompletionClaimed: false,
  remainingRequirementBoundary: 'INTERNAL_NON_IPC_LEGACY_REPOSITORY_CONTEXTS_AND_IDENTITY_BOOTSTRAP_EXCEPTIONS',
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile(
  'artifacts/validation/31-U-W-ppk-002-remaining-boundaries-runtime.json',
  `${JSON.stringify(report, null, 2)}\n`
);

if (failed.length > 0) {
  console.error(`31-U-W PPK-002 remaining-boundaries runtime: FAIL (${failed.length}/${results.length}).`);
  for (const result of failed) console.error(`${result.id}: ${result.outputTail}`);
  process.exit(1);
}
console.log(`31-U-W PPK-002 remaining-boundaries runtime: PASS (${results.length}/${results.length}; full Vitest ${results[1].testFiles}/${results[1].tests}).`);
