import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, normalize, relative, resolve, sep } from 'node:path';

const cliArgs = process.argv.slice(2);
const optionValue = (name, fallback) => {
  const index = cliArgs.indexOf(name);
  if (index < 0) return fallback;
  const value = cliArgs[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};

const root = process.cwd();
const configPath = resolve(optionValue('--config', 'config/source-preflight-checks.json'));
const reportPath = resolve(optionValue('--report', 'artifacts/validation/source-preflight.json'));
const config = JSON.parse(await readFile(configPath, 'utf8'));
const startedAt = new Date().toISOString();
const results = [];
let blockingCheckId = null;
let currentChild = null;
let interruptedSignal = null;

const outputLimit = 65_536;
const appendLimited = (current, chunk) => {
  const combined = `${current}${chunk}`;
  return combined.length <= outputLimit ? combined : combined.slice(-outputLimit);
};

const scriptsRoot = resolve(root, 'scripts');
const resolveSafeScript = (scriptPath) => {
  if (typeof scriptPath !== 'string' || scriptPath.trim().length === 0) throw new Error('Every source preflight check must define a script.');
  if (isAbsolute(scriptPath)) throw new Error(`Source preflight script must be repository-relative: ${scriptPath}`);
  const normalized = normalize(scriptPath).replaceAll('\\', '/');
  if (!normalized.startsWith('scripts/') || !normalized.endsWith('.mjs')) {
    throw new Error(`Source preflight script must be an .mjs file under scripts/: ${scriptPath}`);
  }
  const resolved = resolve(root, normalized);
  const traversal = relative(scriptsRoot, resolved);
  if (traversal.startsWith('..') || isAbsolute(traversal) || traversal.split(sep).includes('..')) {
    throw new Error(`Source preflight script escapes the scripts boundary: ${scriptPath}`);
  }
  return { normalized, resolved };
};

const validateConfig = () => {
  if (!config || typeof config !== 'object') throw new Error('Source preflight configuration must be an object.');
  if (config.schemaVersion !== 1) throw new Error(`Unsupported source preflight schemaVersion=${config.schemaVersion}`);
  if (typeof config.stage !== 'string' || config.stage.trim().length === 0) throw new Error('Source preflight stage must be non-empty.');
  if (!Array.isArray(config.checks) || config.checks.length === 0) throw new Error('Source preflight must contain at least one check.');
  const ids = new Set();
  for (const check of config.checks) {
    if (!check || typeof check !== 'object') throw new Error('Every source preflight check must be an object.');
    if (typeof check.id !== 'string' || check.id.trim().length === 0) throw new Error('Every source preflight check must have a non-empty id.');
    if (ids.has(check.id)) throw new Error(`Duplicate source preflight check id: ${check.id}`);
    ids.add(check.id);
    if (typeof check.label !== 'string' || check.label.trim().length === 0) throw new Error(`Check ${check.id} must have a non-empty label.`);
    resolveSafeScript(check.script);
    if (!Array.isArray(check.args) || check.args.some((value) => typeof value !== 'string')) throw new Error(`Check ${check.id} args must be an array of strings.`);
    if (!Number.isFinite(check.timeoutMs) || check.timeoutMs < 1_000 || check.timeoutMs > 300_000) {
      throw new Error(`Check ${check.id} timeoutMs must be between 1000 and 300000.`);
    }
  }
};
validateConfig();

const buildReport = () => ({
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  stage: config.stage,
  sourceOnly: true,
  dependencyInstallationRequired: false,
  platform: process.platform,
  nodeVersion: process.version,
  startedAt,
  finishedAt: new Date().toISOString(),
  status: results.length === config.checks.length && results.every((result) => result.status === 'PASS') ? 'PASS' : 'FAIL',
  ...(blockingCheckId ? { blockingCheckId } : {}),
  ...(interruptedSignal ? { interruptedSignal } : {}),
  results
});

const persistReport = async () => {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(buildReport(), null, 2)}\n`);
};

const terminateProcessTree = (child, force = false) => {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  const signal = force ? 'SIGKILL' : 'SIGTERM';
  try { process.kill(-child.pid, signal); } catch {
    try { child.kill(signal); } catch { /* already exited */ }
  }
};

const runCheck = (check) => new Promise((resolveCheck) => {
  const checkStartedAt = new Date().toISOString();
  const script = resolveSafeScript(check.script);
  const child = spawn(process.execPath, [script.resolved, ...check.args], {
    cwd: root,
    env: process.env,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32'
  });
  currentChild = child;
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  let settled = false;
  let forceKillTimer;

  const finish = (payload) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutTimer);
    clearTimeout(forceKillTimer);
    if (currentChild === child) currentChild = null;
    resolveCheck({
      id: check.id,
      label: check.label,
      script: script.normalized,
      args: check.args,
      startedAt: checkStartedAt,
      finishedAt: new Date().toISOString(),
      timeoutMs: check.timeoutMs,
      timedOut,
      stdout,
      stderr,
      ...payload
    });
  };

  child.stdout.on('data', (chunk) => {
    stdout = appendLimited(stdout, chunk.toString());
    process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    stderr = appendLimited(stderr, chunk.toString());
    process.stderr.write(chunk);
  });
  child.on('error', (error) => finish({ status: 'FAIL', reason: 'SPAWN_ERROR', exitCode: null, signal: null, error: error.message }));
  child.on('close', (exitCode, signal) => finish({
    status: exitCode === 0 && !timedOut ? 'PASS' : 'FAIL',
    ...(timedOut ? { reason: 'TIMEOUT' } : {}),
    exitCode,
    signal: signal ?? null
  }));

  const timeoutTimer = setTimeout(() => {
    timedOut = true;
    stderr = appendLimited(stderr, `\nSource preflight check exceeded ${check.timeoutMs} ms.\n`);
    terminateProcessTree(child, false);
    forceKillTimer = setTimeout(() => {
      terminateProcessTree(child, true);
      finish({ status: 'FAIL', reason: 'TIMEOUT', exitCode: null, signal: process.platform === 'win32' ? 'TASKKILL' : 'SIGKILL' });
    }, 3_000);
    forceKillTimer.unref?.();
  }, check.timeoutMs);
  timeoutTimer.unref?.();
});

const interrupt = (signal) => {
  if (interruptedSignal) return;
  interruptedSignal = signal;
  if (currentChild) terminateProcessTree(currentChild, false);
};
process.once('SIGINT', () => interrupt('SIGINT'));
process.once('SIGTERM', () => interrupt('SIGTERM'));

await persistReport();
for (const check of config.checks) {
  if (interruptedSignal) {
    results.push({ id: check.id, label: check.label, script: check.script, status: 'NOT_RUN', reason: `Source preflight interrupted by ${interruptedSignal}.` });
    await persistReport();
    continue;
  }
  if (blockingCheckId) {
    results.push({ id: check.id, label: check.label, script: check.script, status: 'NOT_RUN', reason: `Blocked by source preflight check ${blockingCheckId}.`, blockedBy: blockingCheckId });
    await persistReport();
    continue;
  }
  const result = await runCheck(check);
  results.push(result);
  if (result.status !== 'PASS') blockingCheckId = check.id;
  await persistReport();
}

await persistReport();
console.log(`Source preflight report written: ${reportPath}`);
if (buildReport().status !== 'PASS') process.exitCode = 1;
