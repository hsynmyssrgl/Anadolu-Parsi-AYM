import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const commands = Object.freeze([
  { id: 'boundary', args: ['scripts/verify-privacy-consent-lost-device-control-boundary.mjs'], expect: 'PASS' },
  { id: 'contract', args: ['scripts/verify-33-k-privacy-consent-lost-device-control-contract.mjs'], expect: 'PASS' },
  { id: 'targeted-tests', args: ['node_modules/vitest/vitest.mjs', 'run',
    'packages/application/tests/privacy-control-use-cases.test.ts',
    'apps/desktop/tests/b5-privacy-control-ipc-integration.test.ts', '--reporter=dot', '--maxWorkers=1'],
  minimumTests: 6, minimumFiles: 2 },
  { id: 'root-typescript', args: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit'] },
  { id: 'desktop-electron-typescript', args: ['node_modules/typescript/bin/tsc', '-p', 'apps/desktop/tsconfig.electron.json', '--noEmit'] },
  { id: 'desktop-renderer-typescript', args: ['node_modules/typescript/bin/tsc', '-p', 'apps/desktop/tsconfig.renderer.json', '--noEmit'] },
  { id: 'ppk021', args: ['scripts/verify-platform-policy-ast-gate.mjs'], expect: '"exactAllowlistEntries": 557' },
  { id: 'ppk022', args: ['scripts/verify-platform-capability-manifest-gate.mjs'], expect: '"exactManifestSurfaces": 246' },
  { id: 'decision-ledger', args: ['scripts/verify-user-decision-ledger.mjs'], expect: 'PASS' }
]);

const results = commands.map((command) => {
  const execution = spawnSync(process.execPath, command.args, {
    cwd: process.cwd(), encoding: 'utf8', timeout: 900_000,
    maxBuffer: 64 * 1024 * 1024, windowsHide: true, env: process.env
  });
  const output = `${execution.stdout ?? ''}\n${execution.stderr ?? ''}`.replace(/\r\n/gu, '\n').trim();
  const tests = Number.parseInt(output.match(/Tests\s+(\d+) passed/u)?.[1] ?? '0', 10);
  const testFiles = Number.parseInt(output.match(/Test Files\s+(\d+) passed/u)?.[1] ?? '0', 10);
  const passed = execution.status === 0 && execution.signal === null && execution.error === undefined
    && (command.expect === undefined || output.includes(command.expect))
    && (command.minimumTests === undefined || tests >= command.minimumTests)
    && (command.minimumFiles === undefined || testFiles >= command.minimumFiles);
  return Object.freeze({
    id: command.id, status: passed ? 'PASS' : 'FAIL', exitCode: execution.status,
    ...(command.minimumTests === undefined ? {} : { tests, testFiles }),
    outputTail: output.slice(-3000)
  });
});
const failures = results.filter((item) => item.status === 'FAIL').map((item) => item.id);
let boundary = {};
let contract = {};
try {
  boundary = JSON.parse(await readFile('artifacts/validation/33-K-privacy-consent-lost-device-control-boundary.json', 'utf8'));
  contract = JSON.parse(await readFile('artifacts/validation/33-K-privacy-consent-lost-device-control-contract.json', 'utf8'));
} catch { /* prerequisite failure is retained in results */ }
const targeted = results.find((item) => item.id === 'targeted-tests');
const report = Object.freeze({
  schemaVersion: 1, step: '33-K', requirements: Object.freeze(['B5-06', 'EXT-039']),
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: results.length - failures.length, checksFailed: failures.length,
  targetedTestFilesPassed: targeted?.testFiles ?? 0, targetedTestsPassed: targeted?.tests ?? 0,
  latestDatabaseMigration: 88, ipcChannels: 3, networkChannels: 0,
  scope: 'local_authority_only', remoteWipePerformed: false, mdmOperationPerformed: false,
  networkDelivery: 'not_performed', ppk021ExactAllowlistEntries: boundary.ppk021ExactAllowlistEntries,
  ppk021UseCaseCompositionSurfaces: boundary.ppk021UseCaseCompositionSurfaces,
  ppk022CapabilitySurfaces: boundary.ppk022CapabilitySurfaces,
  boundaryChecksPassed: boundary.checksPassed, contractChecksPassed: contract.checksPassed,
  results: Object.freeze(results), failures: Object.freeze(failures),
  requirementCompletionClaimed: failures.length === 0, persistentReceiptClaimed: false,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/33-K-privacy-consent-lost-device-control-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`Privacy consent lost-device control runtime: ${report.status} (${report.checksPassed}/${results.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
