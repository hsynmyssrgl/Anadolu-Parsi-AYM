import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const REPORT_PATH = 'artifacts/validation/30-U-pending-operation-process-runtime.json';
const TIMEOUT_MS = 180_000;

const execute = (stage, databasePath) => new Promise((resolve) => {
  const workerPath = join(process.cwd(), 'scripts', '30-u-pending-operation-process-worker.mjs');
  const args = [
    workerPath,
    stage,
    databasePath
  ];
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
    resolve({ stage, args, startedAt, completedAt: new Date().toISOString(), exitCode: null, signal: null, timedOut, spawnError: String(error), stdout, stderr });
  });
  child.once('exit', (exitCode, signal) => {
    clearTimeout(timer);
    resolve({ stage, args, startedAt, completedAt: new Date().toISOString(), exitCode, signal, timedOut, spawnError: null, stdout, stderr });
  });
});

const directory = await mkdtemp(join(tmpdir(), 'ppt-30u-process-runtime-'));
const databasePath = join(directory, 'family.db');
let processes;
try {
  const prepare = await execute('prepare', databasePath);
  const recover = prepare.exitCode === 0 ? await execute('recover', databasePath) : undefined;
  processes = recover ? [prepare, recover] : [prepare];
} finally {
  // Cleanup occurs only after stdout and all database evidence are captured by the recovery process.
}

const parseLastJsonLine = (value) => {
  const lines = value.trim().split(/\r?\n/u).filter(Boolean);
  if (lines.length === 0) return undefined;
  try { return JSON.parse(lines.at(-1)); } catch { return undefined; }
};
const prepareEvidence = parseLastJsonLine(processes[0]?.stdout ?? '');
const recoverEvidence = parseLastJsonLine(processes[1]?.stdout ?? '');
const checks = [];
const failures = [];
const check = (condition, name, details = undefined) => {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL', ...(details === undefined ? {} : { details }) });
  if (!condition) failures.push(name);
};
for (const processResult of processes) {
  check(
    processResult.exitCode === 0
      && processResult.signal === null
      && processResult.timedOut === false
      && processResult.spawnError === null,
    `${processResult.stage} child process returns a real exit code 0`,
    {
      exitCode: processResult.exitCode,
      signal: processResult.signal,
      timedOut: processResult.timedOut,
      spawnError: processResult.spawnError
    }
  );
}
check(processes.length === 2, 'exactly two independent application processes executed');
check(prepareEvidence?.recovered === false && prepareEvidence?.acknowledged === false, 'first process commits without renderer acknowledgement');
check(prepareEvidence?.categoryCount === 1, 'first process observes one category result');
check(recoverEvidence?.recovered === true, 'second process recovers a durable pending identity');
check(
  recoverEvidence?.operationId === prepareEvidence?.operationId
    && recoverEvidence?.intentFingerprint === prepareEvidence?.intentFingerprint,
  'second process reuses the exact operation id and canonical intent fingerprint'
);
check(recoverEvidence?.acknowledged === true && recoverEvidence?.acknowledgementKind === 'completed', 'second process explicitly acknowledges the committed result');
check(recoverEvidence?.categoryCount === 1 && recoverEvidence?.databaseCategoryCount === 1, 'business category mutation remains exactly once');
check(recoverEvidence?.operationCount === 1, 'durable operation result remains exactly once');
check(recoverEvidence?.retryCount === 1, 'restart replay records exactly one retry receipt');
check(recoverEvidence?.nextOperationId !== recoverEvidence?.operationId, 'acknowledged intent permits a fresh operation identity');

const status = failures.length === 0 ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-U',
  requirement: 'PPK-002',
  phase: 'DURABLE_PENDING_OPERATION_TWO_PROCESS_RESTART_RUNTIME',
  status,
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  processes: processes.map((item) => ({
    stage: item.stage,
    args: item.args,
    startedAt: item.startedAt,
    completedAt: item.completedAt,
    exitCode: item.exitCode,
    signal: item.signal,
    timedOut: item.timedOut,
    spawnError: item.spawnError,
    stdoutSizeBytes: Buffer.byteLength(item.stdout),
    stdoutSha256: createHash('sha256').update(item.stdout).digest('hex'),
    stderrSizeBytes: Buffer.byteLength(item.stderr),
    stderrSha256: createHash('sha256').update(item.stderr).digest('hex')
  })),
  prepareEvidence,
  recoverEvidence,
  PPK002: 'PARTIAL',
  rendererRestartPendingOperationIdentityRecovery: 'TARGETED_NOT_YET_PASS',
  officialCompletionClaimed: false,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await rm(directory, { recursive: true, force: true });
if (status !== 'PASS') {
  console.error(`30-U two-process restart runtime: FAIL (${failures.length}/${checks.length}).`);
  console.error(failures.join('\n'));
  console.error(TRUTH);
  process.exit(1);
}
console.log(`30-U two-process restart runtime: PASS (${checks.length}/${checks.length}).`);
console.log(TRUTH);
