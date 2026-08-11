import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const REPORT_PATH = 'artifacts/validation/30-V-replay-pruning-runtime.json';
const VITEST_PATH = 'artifacts/validation/30-V-replay-pruning-vitest.json';
const TIMEOUT_MS = 300_000;

const execute = (name, args) => new Promise((resolve) => {
  const startedAt = new Date().toISOString();
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    shell: false,
    windowsHide: true,
    env: { ...process.env, PPT_WORK_STEP: '30-V' },
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
const vitestArgs = [
  'node_modules/vitest/vitest.mjs',
  'run',
  'apps/desktop/tests/archive-replay-reservation-pruning.test.ts',
  'apps/desktop/tests/archive-durable-policy-transaction-runtime.test.ts',
  'apps/desktop/tests/archive-production-policy-runtime.test.ts',
  '--reporter=json',
  '--outputFile',
  VITEST_PATH
];
const result = await execute('focused-replay-pruning-and-production-regression-vitest', vitestArgs);

let vitestBytes;
let vitest;
try {
  vitestBytes = await readFile(VITEST_PATH);
  vitest = JSON.parse(vitestBytes.toString('utf8'));
} catch {
  vitestBytes = undefined;
  vitest = undefined;
}
const assertionNames = (vitest?.testResults ?? []).flatMap((suite) =>
  (suite.assertionResults ?? []).map((assertion) => assertion.fullName ?? assertion.title ?? '')
);
const checks = [];
const failures = [];
const check = (condition, name, details = undefined) => {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL', ...(details === undefined ? {} : { details }) });
  if (!condition) failures.push(name);
};
check(result.exitCode === 0 && result.signal === null && result.timedOut === false && result.spawnError === null, 'focused Vitest returns a real exit code 0', {
  exitCode: result.exitCode,
  signal: result.signal,
  timedOut: result.timedOut,
  spawnError: result.spawnError
});
check(vitestBytes !== undefined, 'focused Vitest JSON evidence exists');
check(vitest?.success === true, 'focused Vitest reports success');
check(vitest?.testResults?.length === 3, 'exactly three focused and regression suites execute');
check(vitest?.numTotalTests === 24 && vitest?.numPassedTests === 24 && vitest?.numFailedTests === 0, 'replay pruning and production regressions are 24/24 PASS');
check(vitestBytes !== undefined && /^[0-9a-f]{64}$/u.test(createHash('sha256').update(vitestBytes).digest('hex')), 'focused Vitest evidence has a SHA-256 identity');
for (const expectedName of [
  'prunes deterministic bounded batches and reports whether eligible rows remain',
  'keeps the cutoff exclusive and blocks direct deletion of an unexpired row',
  'rejects regressing cutoffs and invalid or unbounded batch sizes without deleting rows',
  'persists the monotonic cutoff across SQLite close and reopen',
  'never prunes a replay reservation consumed by a durable receipt',
  'resolves live SQLite authority and resources for governed archive writes'
]) check(assertionNames.some((name) => name.includes(expectedName)), `focused Vitest executes: ${expectedName}`);

const status = failures.length === 0 ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-V',
  requirement: 'PPK-002',
  phase: 'EXPIRED_UNUSED_REPLAY_RESERVATION_PRUNING_CONTROLLED_RUNTIME',
  status,
  controlledChecks: {
    expected: checks.length + 24,
    actual: checks.filter((item) => item.status === 'PASS').length + (vitest?.numPassedTests ?? 0),
    processAssertions: checks.length,
    focusedVitestExpected: 24,
    focusedVitestActual: vitest?.numTotalTests ?? null
  },
  checks,
  failures,
  childProcesses: [result],
  focusedVitest: {
    path: VITEST_PATH,
    available: vitestBytes !== undefined,
    sizeBytes: vitestBytes?.byteLength ?? null,
    sha256: vitestBytes ? createHash('sha256').update(vitestBytes).digest('hex') : null,
    suites: vitest?.testResults?.length ?? null,
    total: vitest?.numTotalTests ?? null,
    passed: vitest?.numPassedTests ?? null,
    failed: vitest?.numFailedTests ?? null
  },
  evidenceBoundary: {
    PPK002: 'PARTIAL',
    archiveCoreAndAccessoryReceiptFence: 'TARGETED_PASS',
    newCorrelationRetryIdempotencyAfterUnknownCommitOutcome: 'TARGETED_PASS',
    durableDatabaseLedgerAcrossSqliteRestart: 'TARGETED_PASS',
    rendererRestartPendingOperationIdentityRecovery: 'TARGETED_PASS',
    expiredUnusedReplayReservationPruning: status === 'PASS' ? 'TARGETED_PASS' : 'TARGETED_NOT_YET_PASS',
    universalRepositoryEnforcement: 'NOT_COMPLETE',
    externalMonotonicAuthorityAgainstCoordinatedDatabaseAndJournalRollback: 'NOT_IMPLEMENTED',
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
  console.error(`30-V replay pruning runtime: FAIL (${failures.length}/${checks.length} assertions).`);
  console.error(failures.join('\n'));
  console.error(TRUTH);
  process.exit(1);
}
console.log(`30-V replay pruning runtime: PASS (${report.controlledChecks.actual}/${report.controlledChecks.expected} controlled checks; PPK-002 remains PARTIAL).`);
console.log(TRUTH);
