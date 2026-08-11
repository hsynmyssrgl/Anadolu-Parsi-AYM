import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { resolveValidationCommand } from './lib/validation-command.mjs';

const cliArgs = process.argv.slice(2);
const optionValue = (name) => {
  const index = cliArgs.indexOf(name);
  if (index < 0) return undefined;
  if (!cliArgs[index + 1] || cliArgs[index + 1].startsWith('--')) throw new Error(`${name} requires a file path.`);
  return cliArgs[index + 1];
};
const reportPath = resolve(optionValue('--report') ?? 'artifacts/validation/rc2-validation-report.json');
const configPath = resolve(optionValue('--config') ?? 'config/rc2-validation-gates.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const startedAt = new Date().toISOString();
const results = [];
let blockingGateId = null;
let currentGate = null;
let interruptedSignal = null;

const supportedPlatforms = new Set(['linux', 'darwin', 'win32']);
const phaseOrder = [
  'source-preflight',
  'dependency-bootstrap',
  'compile',
  'test',
  'build',
  'smoke',
  'windows-runtime',
  'windows-installer'
];
const phaseIndexes = new Map(phaseOrder.map((phase, index) => [phase, index]));

const validateConfig = () => {
  if (!config || typeof config !== 'object') throw new Error('RC2 validation configuration must be an object.');
  if (config.schemaVersion !== 3) throw new Error(`Unsupported RC2 validation schemaVersion=${config.schemaVersion}`);
  if (!Array.isArray(config.gates) || config.gates.length === 0) throw new Error('RC2 validation configuration must contain at least one gate.');
  const ids = new Set();
  let previousPhaseIndex = -1;
  for (const gate of config.gates) {
    if (!gate || typeof gate !== 'object') throw new Error('Every RC2 validation gate must be an object.');
    if (typeof gate.id !== 'string' || gate.id.trim().length === 0) throw new Error('Every RC2 validation gate must have a non-empty id.');
    if (ids.has(gate.id)) throw new Error(`Duplicate RC2 validation gate id: ${gate.id}`);
    ids.add(gate.id);
    if (typeof gate.label !== 'string' || gate.label.trim().length === 0) throw new Error(`Gate ${gate.id} must have a non-empty label.`);
    if (!phaseIndexes.has(gate.phase)) throw new Error(`Gate ${gate.id} has unsupported phase=${gate.phase}`);
    const currentPhaseIndex = phaseIndexes.get(gate.phase);
    if (currentPhaseIndex < previousPhaseIndex) throw new Error(`Gate ${gate.id} phase ${gate.phase} violates the required RC2 phase order.`);
    previousPhaseIndex = currentPhaseIndex;
    if (typeof gate.command !== 'string' || gate.command.trim().length === 0) throw new Error(`Gate ${gate.id} must have a non-empty command.`);
    if (!Array.isArray(gate.args) || gate.args.some((value) => typeof value !== 'string')) throw new Error(`Gate ${gate.id} args must be an array of strings.`);
    if (!Array.isArray(gate.platforms) || gate.platforms.length === 0 || gate.platforms.some((value) => !supportedPlatforms.has(value))) {
      throw new Error(`Gate ${gate.id} platforms must contain supported platform names.`);
    }
    if (!Number.isFinite(gate.timeoutMs) || gate.timeoutMs <= 0) throw new Error(`Gate ${gate.id} timeoutMs must be positive.`);
  }
  if (config.gates[0]?.phase !== 'source-preflight') throw new Error('The first RC2 gate must be in the source-preflight phase.');
  if (config.gates[0]?.id !== 'source-preflight') throw new Error('The first RC2 gate must be source-preflight.');
};
validateConfig();

const timeoutOverride = Number(process.env.PPT_RC2_GATE_TIMEOUT_OVERRIDE_MS ?? 0);
const effectiveTimeout = (gate) => Number.isFinite(timeoutOverride) && timeoutOverride > 0
  ? timeoutOverride
  : gate.timeoutMs;

const buildReport = () => ({
  schemaVersion: 4,
  stage: config.stage,
  platform: process.platform,
  nodeVersion: process.version,
  startedAt,
  finishedAt: new Date().toISOString(),
  ...(interruptedSignal === null ? {} : { interruptedSignal }),
  ...(blockingGateId === null ? {} : { blockingGateId }),
  sourcePreflightStatus: results.find((result) => result.id === 'source-preflight')?.status ?? 'NOT_RUN',
  dependencyBootstrapStatus: results.find((result) => result.id === 'clean-npm-ci')?.status ?? 'NOT_RUN',
  overallStatus: results.length === config.gates.length && results.every((result) => result.status === 'PASS')
    ? 'PASS'
    : 'INCOMPLETE',
  results
});

const persistReport = async () => {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(buildReport(), null, 2)}\n`);
};

const terminateProcessTree = (child) => {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try { child.kill('SIGTERM'); } catch { /* process already exited */ }
  }
};

const forceKillProcessTree = (child) => {
  if (!child.pid || process.platform === 'win32') return;
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    try { child.kill('SIGKILL'); } catch { /* process already exited */ }
  }
};

const run = (gate) => new Promise((resolveRun) => {
  const gateStartedAt = new Date().toISOString();
  const timeoutMs = effectiveTimeout(gate);
  const invocation = resolveValidationCommand({ command: gate.command, args: gate.args });
  const child = spawn(invocation.command, invocation.args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32'
  });
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  let settled = false;
  let timeoutTimer;
  let forceKillTimer;

  const resultBase = () => ({
    id: gate.id,
    label: gate.label,
    phase: gate.phase,
    requestedCommand: invocation.requestedCommand,
    requestedArgs: invocation.requestedArgs,
    resolvedCommand: invocation.command,
    resolvedArgs: invocation.args,
    commandResolutionStrategy: invocation.strategy,
    timeoutMs,
    startedAt: gateStartedAt,
    finishedAt: new Date().toISOString()
  });

  const settle = (result) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutTimer);
    clearTimeout(forceKillTimer);
    if (currentGate?.child === child) currentGate = null;
    resolveRun(result);
  };

  const cancel = (signal) => {
    if (settled) return;
    stderr += `\nValidation runner interrupted by ${signal}.\n`;
    terminateProcessTree(child);
    settle({
      ...resultBase(),
      status: 'FAIL',
      reason: 'RUNNER_INTERRUPTED',
      signal,
      timedOut: false,
      exitCode: null,
      stdout,
      stderr
    });
  };
  currentGate = { gate, child, cancel };

  timeoutTimer = setTimeout(() => {
    timedOut = true;
    stderr += `\nValidation gate exceeded timeout of ${timeoutMs} ms.\n`;
    terminateProcessTree(child);
    forceKillTimer = setTimeout(() => {
      forceKillProcessTree(child);
      settle({
        ...resultBase(),
        status: 'FAIL',
        reason: 'TIMEOUT',
        timedOut: true,
        exitCode: null,
        signal: process.platform === 'win32' ? 'TASKKILL' : 'SIGKILL',
        stdout,
        stderr
      });
    }, 5_000);
    forceKillTimer.unref?.();
  }, timeoutMs);
  timeoutTimer.unref?.();

  child.stdout.on('data', (chunk) => { stdout += chunk; process.stdout.write(chunk); });
  child.stderr.on('data', (chunk) => { stderr += chunk; process.stderr.write(chunk); });
  child.on('error', (error) => settle({
    ...resultBase(),
    status: 'FAIL',
    reason: 'SPAWN_ERROR',
    timedOut,
    exitCode: null,
    error: error.message,
    stdout,
    stderr
  }));
  child.on('close', (code, signal) => settle({
    ...resultBase(),
    status: code === 0 && !timedOut ? 'PASS' : 'FAIL',
    ...(timedOut ? { reason: 'TIMEOUT' } : {}),
    timedOut,
    exitCode: code,
    signal: signal ?? null,
    stdout,
    stderr
  }));
});

const interrupt = (signal) => {
  if (interruptedSignal !== null) return;
  interruptedSignal = signal;
  currentGate?.cancel(signal);
};
process.once('SIGINT', () => interrupt('SIGINT'));
process.once('SIGTERM', () => interrupt('SIGTERM'));

await persistReport();
for (const gate of config.gates) {
  if (interruptedSignal !== null) break;
  if (blockingGateId !== null) {
    results.push({
      id: gate.id,
      label: gate.label,
      phase: gate.phase,
      status: 'NOT_RUN',
      reason: `Blocked by required validation gate ${blockingGateId}.`,
      blockedBy: blockingGateId
    });
    await persistReport();
    continue;
  }
  if (!gate.platforms.includes(process.platform)) {
    results.push({
      id: gate.id,
      label: gate.label,
      phase: gate.phase,
      status: 'NOT_RUN',
      reason: `Platform ${process.platform} is not eligible; required: ${gate.platforms.join(', ')}.`
    });
    await persistReport();
    continue;
  }
  const result = await run(gate);
  results.push(result);
  if (result.status !== 'PASS' && config.stopOnFailure) blockingGateId = gate.id;
  await persistReport();
}

if (interruptedSignal !== null) {
  const completedIds = new Set(results.map((result) => result.id));
  for (const gate of config.gates) {
    if (!completedIds.has(gate.id)) {
      results.push({
        id: gate.id,
        label: gate.label,
        phase: gate.phase,
        status: 'NOT_RUN',
        reason: `Validation runner interrupted by ${interruptedSignal}.`
      });
    }
  }
}

await persistReport();
console.log(`RC2 validation report written: ${reportPath}`);
if (buildReport().overallStatus !== 'PASS') process.exitCode = 1;
