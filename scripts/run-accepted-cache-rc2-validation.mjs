import { spawn, spawnSync } from 'node:child_process';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { validateAcceptedNpmCacheForRc2 } from './lib/accepted-cache-rc2-validation.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const projectRoot = resolve(option('--project-root', process.cwd()));
const policyPath = resolve(projectRoot, option('--policy', 'config/accepted-cache-rc2-validation-policy.json'));
const reportPath = resolve(projectRoot, option('--report', 'artifacts/validation/build153-accepted-cache-rc2-validation.json'));
const startedAt = new Date().toISOString();
let child = null;
let interruptedSignal = null;
let forceKillTimer = null;

const policy = JSON.parse(await readFile(policyPath, 'utf8'));
if (policy.schemaVersion !== 1) throw new Error(`Unsupported accepted-cache RC2 validation policy schemaVersion=${policy.schemaVersion}`);
if (!Number.isFinite(policy.runnerTimeoutMs) || policy.runnerTimeoutMs < 10_000 || policy.runnerTimeoutMs > 7_200_000) throw new Error('runnerTimeoutMs must be between 10000 and 7200000.');
for (const field of ['requireCompleteImportedCache', 'verifyBundlePayloadBeforeGates']) {
  if (typeof policy[field] !== 'boolean') throw new Error(`${field} must be boolean.`);
}
for (const field of ['acceptedBundleEnvironmentVariable', 'acceptedReceiptEnvironmentVariable']) {
  if (!/^[A-Z][A-Z0-9_]{2,80}$/.test(policy[field] ?? '')) throw new Error(`${field} is invalid.`);
}
const ensureProjectFile = async (candidate, label) => {
  const absolute = resolve(projectRoot, candidate);
  const traversal = relative(projectRoot, absolute);
  if (traversal.startsWith('..') || isAbsolute(traversal)) throw new Error(`${label} must remain inside the project root.`);
  const info = await lstat(absolute);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error(`${label} must be a regular non-symlink file.`);
  return absolute;
};
const acceptancePolicyPath = await ensureProjectFile(policy.acceptancePolicyPath, 'Acceptance policy');
const gateConfigPath = await ensureProjectFile(option('--gates', policy.validationGatesPath), 'Validation gate configuration');
const gateRunnerScript = await ensureProjectFile(option('--runner-script', policy.gateRunnerScript), 'Validation gate runner');
const gateReportPath = resolve(projectRoot, option('--gate-report', policy.gateReportPath));
const acceptancePolicy = JSON.parse(await readFile(acceptancePolicyPath, 'utf8'));
const packageVersion = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8')).version;
const lockBytes = await readFile(resolve(projectRoot, 'package-lock.json'));

const persist = async (report) => {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
};
const terminate = (target) => {
  if (!target?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/pid', String(target.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try { process.kill(-target.pid, 'SIGTERM'); }
  catch { try { target.kill('SIGTERM'); } catch { /* already exited */ } }
};
const forceKill = (target) => {
  if (!target?.pid || process.platform === 'win32') return;
  try { process.kill(-target.pid, 'SIGKILL'); }
  catch { try { target.kill('SIGKILL'); } catch { /* already exited */ } }
};
const interrupt = (signal) => {
  if (interruptedSignal) return;
  interruptedSignal = signal;
  terminate(child);
  forceKillTimer = setTimeout(() => forceKill(child), 5_000);
  forceKillTimer.unref?.();
};
process.once('SIGINT', () => interrupt('SIGINT'));
process.once('SIGTERM', () => interrupt('SIGTERM'));

let acceptedCacheValidation;
try {
  acceptedCacheValidation = await validateAcceptedNpmCacheForRc2({
    projectRoot,
    acceptancePolicy,
    packageVersion,
    lockBytes,
    requireCompleteImportedCache: policy.requireCompleteImportedCache,
    verifyBundlePayload: policy.verifyBundlePayloadBeforeGates
  });
} catch (error) {
  const report = {
    schemaVersion: 1,
    product: 'Anadolu Parsı Aile Yaşam Merkezi',
    stage: 'Bronze RC2 Active Development',
    applicationVersion: '29.07.2026.153',
    packageVersion,
    build: 153,
    status: 'FAIL',
    classification: error?.code ?? 'ACCEPTED_CACHE_VALIDATION_ERROR',
    startedAt,
    finishedAt: new Date().toISOString(),
    platform: process.platform,
    nodeVersion: process.version,
    gatesStarted: false,
    failures: [error?.message ?? String(error)],
    ...(error?.details ? { details: error.details } : {})
  };
  await persist(report);
  console.error(`Accepted-cache RC2 validation blocked before gates: ${report.classification}.`);
  process.exit(1);
}

const runnerArgs = [gateRunnerScript, '--config', gateConfigPath, '--report', gateReportPath];
const runnerEnvironment = {
  ...process.env,
  [policy.acceptedBundleEnvironmentVariable]: acceptedCacheValidation.acceptedArchivePath,
  [policy.acceptedReceiptEnvironmentVariable]: acceptedCacheValidation.receiptPath
};
const runResult = await new Promise((resolveRun) => {
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    terminate(child);
    setTimeout(() => forceKill(child), 5_000).unref?.();
  }, policy.runnerTimeoutMs);
  timeout.unref?.();
  child = spawn(process.execPath, runnerArgs, {
    cwd: projectRoot,
    env: runnerEnvironment,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32'
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; process.stdout.write(chunk); });
  child.stderr.on('data', (chunk) => { stderr += chunk; process.stderr.write(chunk); });
  child.on('error', (error) => {
    clearTimeout(timeout);
    resolveRun({ status: 'FAIL', classification: 'GATE_RUNNER_SPAWN_ERROR', exitCode: null, signal: null, timedOut, stdout, stderr, error: error.message });
  });
  child.on('close', (code, signal) => {
    clearTimeout(timeout); clearTimeout(forceKillTimer);
    resolveRun({
      status: code === 0 && !timedOut && !interruptedSignal ? 'PASS' : 'FAIL',
      classification: interruptedSignal ? 'RUNNER_INTERRUPTED' : timedOut ? 'GATE_RUNNER_TIMEOUT' : code === 0 ? 'GATE_RUNNER_COMPLETED' : 'GATE_RUNNER_FAILED',
      exitCode: code,
      signal: signal ?? null,
      timedOut,
      stdout,
      stderr
    });
  });
});

let gateReport = null;
let gateReportReadFailure = null;
try { gateReport = JSON.parse(await readFile(gateReportPath, 'utf8')); }
catch (error) { gateReportReadFailure = error.message; }
const results = Array.isArray(gateReport?.results) ? gateReport.results : [];
const platformEligible = results.filter((result) => result.status !== 'NOT_RUN' || !String(result.reason ?? '').startsWith(`Platform ${process.platform} is not eligible`));
const currentPlatformPass = platformEligible.length > 0 && platformEligible.every((result) => result.status === 'PASS');
const releaseComplete = results.length > 0 && results.every((result) => result.status === 'PASS');
const status = runResult.status === 'PASS' && currentPlatformPass ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  stage: 'Bronze RC2 Active Development',
  applicationVersion: '29.07.2026.153',
  packageVersion,
  build: 153,
  status,
  classification: status === 'PASS' ? 'ACCEPTED_CACHE_PLATFORM_VALIDATION_PASS' : runResult.classification,
  releaseReadinessStatus: releaseComplete ? 'PASS' : 'INCOMPLETE',
  platformValidationStatus: currentPlatformPass ? 'PASS' : 'FAIL',
  startedAt,
  finishedAt: new Date().toISOString(),
  platform: process.platform,
  nodeVersion: process.version,
  interruptedSignal,
  gatesStarted: true,
  acceptedCacheValidation,
  gateRunner: {
    script: gateRunnerScript,
    config: gateConfigPath,
    report: gateReportPath,
    ...runResult
  },
  ...(gateReport ? { gateReport } : {}),
  ...(gateReportReadFailure ? { gateReportReadFailure } : {})
};
await persist(report);
console.log(`Accepted-cache RC2 validation: ${report.status}; platform=${report.platformValidationStatus}; release=${report.releaseReadinessStatus}.`);
if (report.status !== 'PASS') process.exitCode = 1;
