import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const REPORT_PATH = 'artifacts/validation/30-T-archive-operation-idempotency-runtime.json';
const VITEST_PATH = 'artifacts/validation/30-T-archive-operation-idempotency-vitest.json';
const TIMEOUT_MS = 240_000;

const execute = (name, args) => new Promise((resolve) => {
  const startedAt = new Date().toISOString();
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, TIMEOUT_MS);
  child.once('error', (error) => {
    clearTimeout(timer);
    resolve({ name, args, startedAt, completedAt: new Date().toISOString(), exitCode: null, signal: null, timedOut, spawnError: String(error), stdout, stderr });
  });
  child.once('exit', (exitCode, signal) => {
    clearTimeout(timer);
    resolve({ name, args, startedAt, completedAt: new Date().toISOString(), exitCode, signal, timedOut, spawnError: null, stdout, stderr });
  });
});

await mkdir('artifacts/validation', { recursive: true });
await rm(VITEST_PATH, { force: true });
const commands = [
  ['root-typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['repository-contracts-build', ['node_modules/typescript/bin/tsc', '-p', 'packages/repository-contracts/tsconfig.json']],
  ['database-build', ['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json']],
  ['repositories-build', ['node_modules/typescript/bin/tsc', '-p', 'packages/repositories/tsconfig.json']],
  ['application-build', ['node_modules/typescript/bin/tsc', '-p', 'packages/application/tsconfig.json']],
  ['desktop-main-typecheck', ['node_modules/typescript/bin/tsc', '-p', 'apps/desktop/tsconfig.electron.json', '--noEmit']],
  ['database-migration-runtime', ['scripts/verify-database-migrations.mjs']],
  ['archive-vault-boundary', ['scripts/verify-build90-archive-vault-file-boundary.mjs']],
  ['ipc-payload-security', ['scripts/verify-ipc-payload-security-contract.mjs']],
  ['focused-and-regression-vitest', [
    'node_modules/vitest/vitest.mjs',
    'run',
    'apps/desktop/tests/archive-operation-idempotency-runtime.test.ts',
    'apps/desktop/tests/archive-production-policy-runtime.test.ts',
    'apps/desktop/tests/data-store.test.ts',
    '--reporter=json',
    '--outputFile',
    VITEST_PATH
  ]]
];
const results = [];
for (const [name, args] of commands) results.push(await execute(name, args));

let vitest;
let vitestBytes;
try {
  vitestBytes = await readFile(VITEST_PATH);
  vitest = JSON.parse(vitestBytes.toString('utf8'));
} catch {
  vitestBytes = undefined;
  vitest = undefined;
}
const checks = [];
const failures = [];
const check = (condition, name, details = undefined) => {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL', ...(details === undefined ? {} : { details }) });
  if (!condition) failures.push(name);
};
for (const result of results) {
  check(
    result.exitCode === 0 && result.signal === null && result.timedOut === false && result.spawnError === null,
    `${result.name} returns a real exit code 0`,
    { exitCode: result.exitCode, signal: result.signal, timedOut: result.timedOut, spawnError: result.spawnError }
  );
}
check(results.length === 10, 'exactly ten controlled child processes executed');
check(vitestBytes !== undefined, 'focused Vitest JSON evidence exists');
check(vitest?.success === true, 'focused Vitest reports success');
check(vitest?.numTotalTests === 48 && vitest?.numPassedTests === 48 && vitest?.numFailedTests === 0, '30-T, production and DataStore regressions are 48/48 PASS');
check(vitestBytes !== undefined && /^[0-9a-f]{64}$/u.test(createHash('sha256').update(vitestBytes).digest('hex')), 'focused Vitest evidence has a SHA-256 identity');

const status = failures.length === 0 ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-T',
  requirement: 'PPK-002',
  phase: 'ARCHIVE_OPERATION_IDEMPOTENCY_CONTROLLED_RUNTIME',
  status,
  controlledChecks: {
    expected: checks.length + 48,
    actual: checks.filter((item) => item.status === 'PASS').length + (vitest?.numPassedTests ?? 0),
    processAssertions: checks.length,
    focusedVitestExpected: 48,
    focusedVitestActual: vitest?.numTotalTests ?? null
  },
  checks,
  failures,
  childProcesses: results,
  focusedVitest: {
    path: VITEST_PATH,
    available: vitestBytes !== undefined,
    sizeBytes: vitestBytes?.byteLength ?? null,
    sha256: vitestBytes ? createHash('sha256').update(vitestBytes).digest('hex') : null,
    total: vitest?.numTotalTests ?? null,
    passed: vitest?.numPassedTests ?? null,
    failed: vitest?.numFailedTests ?? null
  },
  evidenceBoundary: {
    PPK002: 'PARTIAL',
    archiveCoreAndAccessoryReceiptFence: 'TARGETED_PASS',
    newCorrelationRetryIdempotencyAfterUnknownCommitOutcome: 'TARGETED_PASS',
    universalRepositoryEnforcement: 'NOT_COMPLETE',
    externalMonotonicAuthorityAgainstCoordinatedDatabaseAndJournalRollback: 'NOT_IMPLEMENTED',
    expiredUnusedReplayReservationPruning: 'NOT_IMPLEMENTED',
    obligationExecution: 'NOT_RUN_NOT_PASS',
    secureFileDeletionAndDatabaseCommitAtomicity: 'NOT_IMPLEMENTED',
    installedCoreServiceRegistrationAndScmLifecycle: 'NOT_RUN_NOT_PASS',
    requirementCompletionClaimed: false
  },
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (status !== 'PASS') {
  console.error(`30-T archive operation idempotency runtime: FAIL (${failures.length}/${checks.length} process assertions).`);
  console.error(failures.join('\n'));
  console.error(TRUTH);
  process.exit(1);
}
console.log(`30-T archive operation idempotency runtime: PASS (${report.controlledChecks.actual}/${report.controlledChecks.expected} controlled checks; PPK-002 remains PARTIAL).`);
console.log(TRUTH);
