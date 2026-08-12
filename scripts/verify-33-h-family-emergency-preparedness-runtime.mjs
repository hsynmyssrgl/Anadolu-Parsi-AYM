import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const node = process.execPath;
const commands = Object.freeze([
  Object.freeze({
    id: 'family-emergency-preparedness-boundary',
    args: ['scripts/verify-family-emergency-preparedness-boundary.mjs'],
    expectOutput: 'Family emergency preparedness boundary: PASS'
  }),
  Object.freeze({
    id: 'family-emergency-preparedness-contract',
    args: ['scripts/verify-33-h-family-emergency-preparedness-contract.mjs'],
    expectOutput: 'Family emergency preparedness contract: PASS'
  }),
  Object.freeze({
    id: 'family-emergency-preparedness-targeted-tests',
    args: ['node_modules/vitest/vitest.mjs', 'run',
      'packages/application/tests/family-emergency-preparedness.test.ts',
      'packages/repositories/family-emergency-preparedness-repository-policy.test.ts',
      'apps/desktop/tests/b5-family-emergency-preparedness-ipc-integration.test.ts',
      '--reporter=dot', '--maxWorkers=1'],
    minimumTests: 12,
    minimumTestFiles: 3
  }),
  Object.freeze({
    id: 'root-typescript',
    args: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit']
  }),
  Object.freeze({
    id: 'desktop-electron-typescript',
    args: ['node_modules/typescript/bin/tsc', '-p', 'apps/desktop/tsconfig.electron.json', '--noEmit']
  }),
  Object.freeze({
    id: 'desktop-renderer-typescript',
    args: ['node_modules/typescript/bin/tsc', '-p', 'apps/desktop/tsconfig.renderer.json', '--noEmit']
  }),
  Object.freeze({
    id: 'database-package-build',
    args: ['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json']
  }),
  Object.freeze({
    id: 'migration-86-runtime',
    args: ['scripts/verify-database-migrations.mjs'],
    expectOutput: '"version": 86'
  }),
  Object.freeze({
    id: 'ppk021-ast-ratchet',
    args: ['scripts/verify-platform-policy-ast-gate.mjs'],
    expectOutput: '"status": "PASS"'
  }),
  Object.freeze({
    id: 'ppk022-capability-ratchet',
    args: ['scripts/verify-platform-capability-manifest-gate.mjs'],
    expectOutput: '"status": "PASS"'
  }),
  Object.freeze({
    id: 'decision-ledger',
    args: ['scripts/verify-user-decision-ledger.mjs'],
    expectOutput: 'User Decision Ledger: PASS'
  })
]);

const results = commands.map((command) => {
  const execution = spawnSync(node, command.args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 900_000,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    env: process.env
  });
  const output = `${execution.stdout ?? ''}\n${execution.stderr ?? ''}`.replace(/\r\n/gu, '\n').trim();
  const testsMatch = output.match(/Tests\s+(\d+) passed/u);
  const filesMatch = output.match(/Test Files\s+(\d+) passed/u);
  const tests = testsMatch ? Number.parseInt(testsMatch[1], 10) : undefined;
  const testFiles = filesMatch ? Number.parseInt(filesMatch[1], 10) : undefined;
  const passed = execution.status === 0
    && execution.signal === null && execution.error === undefined
    && (command.expectOutput === undefined || output.includes(command.expectOutput))
    && (command.minimumTests === undefined || (tests ?? 0) >= command.minimumTests)
    && (command.minimumTestFiles === undefined || (testFiles ?? 0) >= command.minimumTestFiles);
  return Object.freeze({
    id: command.id,
    status: passed ? 'PASS' : 'FAIL',
    exitCode: execution.status,
    signal: execution.signal,
    ...(tests === undefined ? {} : { tests }),
    ...(testFiles === undefined ? {} : { testFiles }),
    outputTail: output.slice(-4_000)
  });
});
const failures = results.filter((result) => result.status !== 'PASS').map((result) => result.id);
const targeted = results.find((result) => result.id === 'family-emergency-preparedness-targeted-tests');
let boundary = {};
let contract = {};
try {
  boundary = JSON.parse(await readFile(
    'artifacts/validation/33-H-family-emergency-preparedness-boundary.json', 'utf8'
  ));
  contract = JSON.parse(await readFile(
    'artifacts/validation/33-H-family-emergency-preparedness-contract.json', 'utf8'
  ));
} catch {
  // Failed prerequisites remain visible in command output and keep the runtime red.
}
const report = Object.freeze({
  schemaVersion: 1,
  step: '33-H',
  requirements: Object.freeze(['EXT-011', 'EXT-015']),
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: results.length - failures.length,
  checksFailed: failures.length,
  targetedTestFilesPassed: targeted?.testFiles ?? 0,
  targetedTestsPassed: targeted?.tests ?? 0,
  latestDatabaseMigration: 86,
  familyEmergencyPreparednessTables: 1,
  preparednessItemTypes: 4,
  ipcChannels: 2,
  networkChannels: 0,
  dataSource: 'manual',
  offlineAvailability: 'local_only',
  barcodeLookup: 'not_performed',
  expiryVerification: 'not_performed',
  notificationDelivery: 'not_performed',
  sensorIntegration: 'not_performed',
  readinessGuarantee: 'not_claimed',
  networkEgressAdded: false,
  ppk021ExactAllowlistEntries: boundary.ppk021ExactAllowlistEntries,
  ppk021UseCaseCompositionSurfaces: boundary.ppk021UseCaseCompositionSurfaces,
  ppk022CapabilitySurfaces: boundary.ppk022CapabilitySurfaces,
  boundaryChecksPassed: boundary.checksPassed,
  contractChecksPassed: contract.checksPassed,
  results: Object.freeze(results),
  failures: Object.freeze(failures),
  requirementCompletionClaimed: failures.length === 0,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile(
  'artifacts/validation/33-H-family-emergency-preparedness-runtime.json',
  `${JSON.stringify(report, null, 2)}\n`
);
console.log(`Family emergency preparedness runtime: ${report.status} (${report.checksPassed}/${results.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
