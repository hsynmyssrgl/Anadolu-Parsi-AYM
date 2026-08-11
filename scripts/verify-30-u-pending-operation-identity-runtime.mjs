import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const REPORT_PATH = 'artifacts/validation/30-U-pending-operation-identity-runtime.json';
const VITEST_PATH = 'artifacts/validation/30-U-pending-operation-identity-vitest.json';
const PROCESS_REPORT_PATH = 'artifacts/validation/30-U-pending-operation-process-runtime.json';
const TIMEOUT_MS = 300_000;

const execute = (name, args) => new Promise((resolve) => {
  const startedAt = new Date().toISOString();
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    shell: false,
    windowsHide: true,
    env: { ...process.env, PPT_WORK_STEP: '30-U' },
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
  ['desktop-renderer-typecheck', ['node_modules/typescript/bin/tsc', '-p', 'apps/desktop/tsconfig.renderer.json', '--noEmit']],
  ['desktop-electron-build', ['apps/desktop/scripts/build-electron.mjs']],
  ['database-migration-runtime', ['scripts/verify-database-migrations.mjs']],
  ['ipc-payload-security', ['scripts/verify-ipc-payload-security-contract.mjs']],
  ['archive-vault-boundary-regression', ['scripts/verify-build90-archive-vault-file-boundary.mjs']],
  ['two-process-restart-runtime', ['scripts/verify-30-u-pending-operation-process-runtime.mjs']],
  ['focused-and-regression-vitest', [
    'node_modules/vitest/vitest.mjs',
    'run',
    'apps/desktop/tests/archive-pending-operation-restart-runtime.test.ts',
    'apps/desktop/tests/archive-pending-operation-data-store.test.ts',
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

let vitestBytes;
let vitest;
let processReportBytes;
let processReport;
try {
  vitestBytes = await readFile(VITEST_PATH);
  vitest = JSON.parse(vitestBytes.toString('utf8'));
} catch {
  vitestBytes = undefined;
  vitest = undefined;
}
try {
  processReportBytes = await readFile(PROCESS_REPORT_PATH);
  processReport = JSON.parse(processReportBytes.toString('utf8'));
} catch {
  processReportBytes = undefined;
  processReport = undefined;
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
check(results.length === 13, 'exactly thirteen controlled child processes executed');
check(vitestBytes !== undefined, 'focused Vitest JSON evidence exists');
check(vitest?.success === true, 'focused Vitest reports success');
check(vitest?.numTotalTests === 52 && vitest?.numPassedTests === 52 && vitest?.numFailedTests === 0, '30-U, 30-T, production and DataStore regressions are 52/52 PASS');
check(vitestBytes !== undefined && /^[0-9a-f]{64}$/u.test(createHash('sha256').update(vitestBytes).digest('hex')), 'focused Vitest evidence has a SHA-256 identity');
check(processReportBytes !== undefined, 'two-process restart JSON evidence exists');
check(processReport?.status === 'PASS' && processReport?.passed === processReport?.checkCount && processReport?.checkCount === 12, 'two-process restart evidence is exact 12/12 PASS');
check(processReport?.processes?.length === 2 && processReport.processes.every((item) => item.exitCode === 0), 'two independent restart workers returned real exit code 0');

const status = failures.length === 0 ? 'PASS' : 'FAIL';
const processAssertions = checks.length;
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-U',
  requirement: 'PPK-002',
  phase: 'DURABLE_PENDING_OPERATION_IDENTITY_CONTROLLED_RUNTIME',
  status,
  controlledChecks: {
    expected: processAssertions + 52 + 12,
    actual: checks.filter((item) => item.status === 'PASS').length + (vitest?.numPassedTests ?? 0) + (processReport?.passed ?? 0),
    processAssertions,
    focusedVitestExpected: 52,
    focusedVitestActual: vitest?.numTotalTests ?? null,
    twoProcessExpected: 12,
    twoProcessActual: processReport?.passed ?? null
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
  twoProcessRestart: {
    path: PROCESS_REPORT_PATH,
    available: processReportBytes !== undefined,
    sizeBytes: processReportBytes?.byteLength ?? null,
    sha256: processReportBytes ? createHash('sha256').update(processReportBytes).digest('hex') : null,
    checks: processReport?.checkCount ?? null,
    passed: processReport?.passed ?? null,
    failed: processReport?.failed ?? null
  },
  evidenceBoundary: {
    PPK002: 'PARTIAL',
    archiveCoreAndAccessoryReceiptFence: 'TARGETED_PASS',
    newCorrelationRetryIdempotencyAfterUnknownCommitOutcome: 'TARGETED_PASS',
    durableDatabaseLedgerAcrossSqliteRestart: 'TARGETED_PASS',
    rendererRestartPendingOperationIdentityRecovery: 'TARGETED_NOT_YET_PASS',
    universalRepositoryEnforcement: 'NOT_COMPLETE',
    externalMonotonicAuthorityAgainstCoordinatedDatabaseAndJournalRollback: 'NOT_IMPLEMENTED',
    expiredUnusedReplayReservationPruning: 'NOT_IMPLEMENTED',
    obligationExecution: 'NOT_RUN_NOT_PASS',
    secureFileDeletionAndDatabaseCommitAtomicity: 'NOT_IMPLEMENTED',
    installedCoreServiceRegistrationAndScmLifecycle: 'NOT_RUN_NOT_PASS',
    requirementCompletionClaimed: false
  },
  officialCompletionClaimed: false,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (status !== 'PASS') {
  console.error(`30-U pending operation identity runtime: FAIL (${failures.length}/${checks.length} assertions).`);
  console.error(failures.join('\n'));
  console.error(TRUTH);
  process.exit(1);
}
console.log(`30-U pending operation identity runtime: PASS (${report.controlledChecks.actual}/${report.controlledChecks.expected} controlled checks; PPK-002 remains PARTIAL).`);
console.log(TRUTH);
