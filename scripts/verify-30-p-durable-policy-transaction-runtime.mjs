import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const requestedAttempt = process.argv.find((argument) => argument.startsWith('--attempt='))?.slice('--attempt='.length);
const reportPath = resolve(repoRoot, requestedAttempt === 'clean-2'
  ? 'artifacts/validation/30-P-durable-policy-transaction-runtime-clean-2.json'
  : requestedAttempt === 'clean'
    ? 'artifacts/validation/30-P-durable-policy-transaction-runtime-clean.json'
    : 'artifacts/validation/30-P-durable-policy-transaction-runtime.json');
const vitestReportPath = resolve(repoRoot, requestedAttempt === 'clean-2'
  ? 'artifacts/validation/30-P-durable-policy-transaction-vitest-clean-2.json'
  : requestedAttempt === 'clean'
    ? 'artifacts/validation/30-P-durable-policy-transaction-vitest-clean.json'
    : 'artifacts/validation/30-P-durable-policy-transaction-vitest.json');
const childFixture = resolve(repoRoot, 'scripts/fixtures/30-p-sqlite-race-child.mjs');
const childLoader = pathToFileURL(resolve(repoRoot, 'scripts/fixtures/30-p-ts-workspace-loader.mjs')).href;
const EXPECTED_VITEST_TESTS = 15;
const EXPECTED_PROCESS_CHECKS = 25;
const MAX_OUTPUT = 16_000;
const PROCESS_TIMEOUT_MS = 180_000;
const truth = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';

const bounded = (current, chunk) => {
  const next = `${current}${chunk.toString('utf8')}`;
  return next.length <= MAX_OUTPUT ? next : next.slice(-MAX_OUTPUT);
};

const execute = (id, args) => new Promise((complete) => {
  const startedAt = new Date();
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  let spawnError = null;
  const child = spawn(process.execPath, args, {
    cwd: repoRoot,
    env: process.env,
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk) => { stdout = bounded(stdout, chunk); });
  child.stderr.on('data', (chunk) => { stderr = bounded(stderr, chunk); });
  child.once('error', (error) => { spawnError = error; });
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
  }, PROCESS_TIMEOUT_MS);
  child.once('close', (exitCode, signal) => {
    clearTimeout(timer);
    complete({
      id,
      executable: process.execPath,
      args,
      shell: false,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      exitCode,
      signal,
      timedOut,
      spawnError: spawnError instanceof Error ? spawnError.message : null,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      processId: child.pid ?? null
    });
  });
});

const fixtureArgs = (databasePath, values) => [
  '--experimental-strip-types',
  '--experimental-transform-types',
  '--experimental-loader',
  childLoader,
  childFixture,
  '--db', databasePath,
  ...Object.entries(values).flatMap(([key, value]) => [`--${key}`, String(value)])
];

const parseFixtureOutput = (result) => {
  const lines = result.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try { return JSON.parse(lines[index]); } catch { /* Continue to the preceding line. */ }
  }
  return null;
};

const checks = [];
const failures = [];
const check = (name, condition, details = undefined) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status, ...(details === undefined ? {} : { details }) });
  if (!condition) failures.push({ name, details });
};

const readFreshJson = async (path, startedAt) => {
  try {
    const [bytes, metadata] = await Promise.all([readFile(path), stat(path)]);
    return {
      available: true,
      fresh: metadata.mtimeMs >= startedAt - 2_000,
      size: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      parsed: JSON.parse(bytes.toString('utf8'))
    };
  } catch (error) {
    return {
      available: false,
      fresh: false,
      size: null,
      sha256: null,
      parsed: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

await mkdir(dirname(reportPath), { recursive: true });
const runtimeTemporaryParent = resolve(repoRoot, '.tmp');
await mkdir(runtimeTemporaryParent, { recursive: true });
const temporaryRoot = await mkdtemp(resolve(runtimeTemporaryParent, 'ppt-30p-two-process-runtime-'));
const databasePath = resolve(temporaryRoot, 'family.db');
const childResults = [];
let databaseEvidence = null;
let vitestResult = null;
let vitestEvidence = null;

try {
  const initialized = await execute('database-initialization', fixtureArgs(databasePath, {
    mode: 'init',
    epoch: 31,
    nonce: 'unused-init',
    correlation: 'corr-30p-init',
    resource: 'archive-30p-init'
  }));
  childResults.push(initialized);
  const initializedOutput = parseFixtureOutput(initialized);
  check('database initialization child exits zero', initialized.exitCode === 0 && initialized.signal === null && !initialized.timedOut && !initialized.spawnError, initialized);
  check('database initialization reports exact writable epoch 31', initializedOutput?.status === 'INITIALIZED' && initializedOutput?.databaseFence?.epoch === 31 && initializedOutput?.databaseFence?.writable === true, initializedOutput);

  const noncePair = await Promise.all([
    execute('nonce-race-a', fixtureArgs(databasePath, {
      mode: 'nonce', epoch: 31, nonce: 'nonce-30p-two-process-shared',
      correlation: 'corr-30p-nonce-race-a', resource: 'archive-30p-nonce-race-a'
    })),
    execute('nonce-race-b', fixtureArgs(databasePath, {
      mode: 'nonce', epoch: 31, nonce: 'nonce-30p-two-process-shared',
      correlation: 'corr-30p-nonce-race-b', resource: 'archive-30p-nonce-race-b'
    }))
  ]);
  childResults.push(...noncePair);
  const nonceOutputs = noncePair.map(parseFixtureOutput);
  check('duplicate nonce race uses two real child process ids', noncePair.every((item) => Number.isSafeInteger(item.processId)) && new Set(noncePair.map((item) => item.processId)).size === 2, noncePair.map((item) => item.processId));
  check('duplicate nonce race has one commit and one explicit replay exit code', noncePair.map((item) => item.exitCode).sort((a, b) => a - b).join(',') === '0,20', noncePair.map((item) => item.exitCode));
  check('duplicate nonce child statuses distinguish commit from replay rejection', nonceOutputs.map((item) => item?.status).sort().join(',') === 'COMMITTED,DUPLICATE_NONCE_REJECTED', nonceOutputs);

  const correlationPair = await Promise.all([
    execute('correlation-race-a', fixtureArgs(databasePath, {
      mode: 'correlation', epoch: 31, nonce: 'nonce-30p-correlation-race-a',
      correlation: 'corr-30p-two-process-shared', resource: 'archive-30p-correlation-race-a'
    })),
    execute('correlation-race-b', fixtureArgs(databasePath, {
      mode: 'correlation', epoch: 31, nonce: 'nonce-30p-correlation-race-b',
      correlation: 'corr-30p-two-process-shared', resource: 'archive-30p-correlation-race-b'
    }))
  ]);
  childResults.push(...correlationPair);
  const correlationOutputs = correlationPair.map(parseFixtureOutput);
  check('duplicate correlation race uses two real child process ids', correlationPair.every((item) => Number.isSafeInteger(item.processId)) && new Set(correlationPair.map((item) => item.processId)).size === 2, correlationPair.map((item) => item.processId));
  check('duplicate correlation race has one commit and one conflict exit code', correlationPair.map((item) => item.exitCode).sort((a, b) => a - b).join(',') === '0,21', correlationPair.map((item) => item.exitCode));
  check('duplicate correlation child statuses distinguish commit from durable conflict', correlationOutputs.map((item) => item?.status).sort().join(',') === 'COMMITTED,DUPLICATE_CORRELATION_REJECTED', correlationOutputs);

  const fencePair = await Promise.all([
    execute('fresh-fence-race', fixtureArgs(databasePath, {
      mode: 'fresh', epoch: 31, nonce: 'nonce-30p-fresh-fence',
      correlation: 'corr-30p-fresh-fence', resource: 'archive-30p-fresh-fence'
    })),
    execute('stale-fence-race', fixtureArgs(databasePath, {
      mode: 'stale', epoch: 30, nonce: 'nonce-30p-stale-fence',
      correlation: 'corr-30p-stale-fence', resource: 'archive-30p-stale-fence'
    }))
  ]);
  childResults.push(...fencePair);
  const fenceOutputs = fencePair.map(parseFixtureOutput);
  check('fresh/stale fence race uses two real child process ids', fencePair.every((item) => Number.isSafeInteger(item.processId)) && new Set(fencePair.map((item) => item.processId)).size === 2, fencePair.map((item) => item.processId));
  check('fresh/stale fence race has one commit and one stale-fence exit code', fencePair.map((item) => item.exitCode).sort((a, b) => a - b).join(',') === '0,22', fencePair.map((item) => item.exitCode));
  check('fresh/stale child statuses distinguish commit from stale-fence rejection', fenceOutputs.map((item) => item?.status).sort().join(',') === 'COMMITTED,STALE_FENCE_REJECTED', fenceOutputs);

  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const scalar = (sql, ...parameters) => Number(database.prepare(sql).get(...parameters)?.count ?? 0);
    databaseEvidence = {
      sharedNonceReservations: scalar('SELECT COUNT(*) AS count FROM platform_policy_replay_reservations WHERE nonce=?', 'nonce-30p-two-process-shared'),
      sharedCorrelationReceipts: scalar('SELECT COUNT(*) AS count FROM platform_policy_transaction_receipts WHERE correlation_id=?', 'corr-30p-two-process-shared'),
      sharedCorrelationProjections: scalar(`
        SELECT COUNT(*) AS count FROM platform_policy_journal_projection_outbox projection
        JOIN platform_policy_transaction_receipts receipt USING(receipt_hash)
        WHERE receipt.correlation_id=?
      `, 'corr-30p-two-process-shared'),
      freshFenceReceipts: scalar('SELECT COUNT(*) AS count FROM platform_policy_transaction_receipts WHERE correlation_id=?', 'corr-30p-fresh-fence'),
      staleFenceReceipts: scalar('SELECT COUNT(*) AS count FROM platform_policy_transaction_receipts WHERE correlation_id=?', 'corr-30p-stale-fence'),
      staleFenceReservations: scalar('SELECT COUNT(*) AS count FROM platform_policy_replay_reservations WHERE nonce=?', 'nonce-30p-stale-fence'),
      totalReceipts: scalar('SELECT COUNT(*) AS count FROM platform_policy_transaction_receipts'),
      integrityCheck: String(database.prepare('PRAGMA integrity_check').get()?.integrity_check ?? '')
    };
  } finally {
    database.close();
  }
  check('duplicate nonce race leaves exactly one durable reservation', databaseEvidence.sharedNonceReservations === 1, databaseEvidence);
  check('duplicate correlation race leaves exactly one durable receipt', databaseEvidence.sharedCorrelationReceipts === 1, databaseEvidence);
  check('duplicate correlation winner leaves exactly one pending journal projection', databaseEvidence.sharedCorrelationProjections === 1, databaseEvidence);
  check('fresh epoch commits exactly one receipt', databaseEvidence.freshFenceReceipts === 1, databaseEvidence);
  check('stale epoch commits no receipt', databaseEvidence.staleFenceReceipts === 0, databaseEvidence);
  check('stale epoch attempt still consumes its durable replay reservation', databaseEvidence.staleFenceReservations === 1, databaseEvidence);
  check('race database contains only correlation winner and fresh-fence receipts', databaseEvidence.totalReceipts === 2, databaseEvidence);
  check('race database integrity_check is ok', databaseEvidence.integrityCheck === 'ok', databaseEvidence);
  check('all race children terminate without timeout, signal or spawn failure', childResults.every((item) => !item.timedOut && item.signal === null && item.spawnError === null), childResults);

  const vitestStartedAt = Date.now();
  vitestResult = await execute('focused-vitest', [
    'node_modules/vitest/vitest.mjs',
    'run',
    'apps/desktop/tests/archive-durable-policy-transaction-runtime.test.ts',
    '--reporter=json',
    '--outputFile',
    vitestReportPath
  ]);
  vitestEvidence = await readFreshJson(vitestReportPath, vitestStartedAt);
  check('focused Vitest process exits zero with a real process result', vitestResult.exitCode === 0 && vitestResult.signal === null && !vitestResult.timedOut && !vitestResult.spawnError, vitestResult);
  check('focused Vitest report exists, is fresh and has a SHA-256 binding', vitestEvidence.available && vitestEvidence.fresh && /^[0-9a-f]{64}$/u.test(vitestEvidence.sha256 ?? ''), vitestEvidence);
  check('focused Vitest report contains the exact controlled test count', vitestEvidence.parsed?.numTotalTests === EXPECTED_VITEST_TESTS, vitestEvidence.parsed);
  check('all focused Vitest tests pass with zero failure', vitestEvidence.parsed?.numPassedTests === EXPECTED_VITEST_TESTS && vitestEvidence.parsed?.numFailedTests === 0 && vitestEvidence.parsed?.success === true, vitestEvidence.parsed);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

check('runtime verifier itself executed the exact process-level assertion count', checks.length + 1 === EXPECTED_PROCESS_CHECKS, { actualIncludingThisCheck: checks.length + 1, expected: EXPECTED_PROCESS_CHECKS });
const status = failures.length === 0 && checks.length === EXPECTED_PROCESS_CHECKS ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-P',
  requirement: 'PPK-002',
  phase: 'DURABLE_POLICY_TRANSACTION_CONTROLLED_RUNTIME',
  attempt: requestedAttempt ?? 'first',
  status,
  controlledChecks: {
    expected: EXPECTED_PROCESS_CHECKS + EXPECTED_VITEST_TESTS,
    actual: checks.filter((item) => item.status === 'PASS').length + (vitestEvidence?.parsed?.numPassedTests ?? 0),
    processAssertionsExpected: EXPECTED_PROCESS_CHECKS,
    processAssertionsActual: checks.length,
    focusedVitestExpected: EXPECTED_VITEST_TESTS,
    focusedVitestActual: vitestEvidence?.parsed?.numTotalTests ?? null
  },
  childProcessContract: {
    executable: process.execPath,
    shell: false,
    actualExitCodesRequired: true,
    expectedDomainExitCodes: { committed: 0, duplicateNonce: 20, duplicateCorrelation: 21, staleFence: 22 },
    twoIndependentProcessesPerRace: true
  },
  checks,
  failures,
  childProcesses: childResults,
  databaseEvidence,
  focusedVitest: {
    process: vitestResult,
    report: vitestEvidence && {
      path: 'artifacts/validation/30-P-durable-policy-transaction-vitest.json',
      available: vitestEvidence.available,
      fresh: vitestEvidence.fresh,
      size: vitestEvidence.size,
      sha256: vitestEvidence.sha256,
      status: vitestEvidence.parsed?.success === true ? 'PASS' : 'FAIL',
      total: vitestEvidence.parsed?.numTotalTests ?? null,
      passed: vitestEvidence.parsed?.numPassedTests ?? null,
      failed: vitestEvidence.parsed?.numFailedTests ?? null
    }
  },
  evidenceBoundary: {
    PPK002: 'PARTIAL',
    universalRepositoryEnforcement: 'NOT_COMPLETE',
    completeTailJournalRollbackDetection: 'NOT_IMPLEMENTED',
    obligationExecution: 'NOT_RUN_NOT_PASS',
    auditAndOutboxRepositoryEnforcement: 'NOT_COMPLETE',
    eventAttachmentCrossAggregateReceiptBinding: 'NOT_COMPLETE',
    secureFileDeletionAndDatabaseCommitAtomicity: 'NOT_IMPLEMENTED',
    installedCoreServiceRegistrationAndScmLifecycle: 'NOT_RUN_NOT_PASS',
    protectedCoreServiceAuthorityProvisioningRotationAndAcl: 'NOT_IMPLEMENTED',
    nativeInteractiveWindowsHello: 'NOT_RUN_NOT_PASS',
    requirementCompletionClaimed: false
  },
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: truth
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (status !== 'PASS') {
  console.error(`30-P durable policy transaction runtime: FAIL (${failures.length} failed assertions).`);
  console.error(truth);
  process.exit(1);
}
console.log(`30-P durable policy transaction runtime: PASS (${EXPECTED_PROCESS_CHECKS + EXPECTED_VITEST_TESTS}/${EXPECTED_PROCESS_CHECKS + EXPECTED_VITEST_TESTS} controlled checks; PPK-002 remains PARTIAL).`);
console.log(truth);
