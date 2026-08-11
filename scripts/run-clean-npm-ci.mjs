import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { resolveValidationCommand } from './lib/validation-command.mjs';
import { cleanupFailedInstallResidue, classifyNpmCiFailure, redactNpmOutput, runNpmCiWithRetry } from './lib/clean-npm-ci.mjs';
import { assessNpmOfflineCache, resolveNpmCacheRoot } from './lib/npm-offline-cache.mjs';
import { importNpmCacheTransferBundle } from './lib/npm-cache-transfer.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const policyPath = resolve(option('--policy', 'config/npm-ci-policy.json'));
const cacheBundleOption = option('--cache-bundle', process.env.PPT_NPM_CACHE_BUNDLE);
const explicitCacheOption = option('--cache', undefined);
const reportPath = resolve(option('--report', 'artifacts/validation/npm-ci-dependency-access.json'));
const policy = JSON.parse(await readFile(policyPath, 'utf8'));
const startedAt = new Date().toISOString();
let currentAttemptChild = null;
let interruptedSignal = null;
let interruptForceKillTimer = null;
let currentAttemptForceSettle = null;

if (policy.schemaVersion !== 2) throw new Error(`Unsupported npm ci policy schemaVersion=${policy.schemaVersion}`);
if (policy.registry !== 'https://registry.npmjs.org/') throw new Error(`Only the official npm registry is allowed; received ${policy.registry}`);
if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1 || policy.maxAttempts > 5) throw new Error('maxAttempts must be an integer between 1 and 5.');
if (!Number.isFinite(policy.baseDelayMs) || policy.baseDelayMs < 0) throw new Error('baseDelayMs must be non-negative.');
if (!Number.isFinite(policy.maxDelayMs) || policy.maxDelayMs < policy.baseDelayMs) throw new Error('maxDelayMs must be >= baseDelayMs.');
if (!Number.isFinite(policy.attemptTimeoutMs) || policy.attemptTimeoutMs < 5_000 || policy.attemptTimeoutMs > 300_000) throw new Error('attemptTimeoutMs must be between 5000 and 300000.');
if (!policy.offlineCache || typeof policy.offlineCache !== 'object') throw new Error('offlineCache policy is required.');
if (typeof policy.ignoreScripts !== 'boolean') throw new Error('ignoreScripts policy must be boolean.');
for (const field of ['enabled', 'attemptWhenComplete', 'preferOfflineForOnlineAttempts']) {
  if (typeof policy.offlineCache[field] !== 'boolean') throw new Error(`offlineCache.${field} must be boolean.`);
}
const attemptTimeoutOverride = Number(process.env.PPT_NPM_CI_ATTEMPT_TIMEOUT_OVERRIDE_MS ?? 0);
const effectiveAttemptTimeoutMs = Number.isFinite(attemptTimeoutOverride) && attemptTimeoutOverride >= 5_000 && attemptTimeoutOverride <= policy.attemptTimeoutMs
  ? attemptTimeoutOverride
  : policy.attemptTimeoutMs;

const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const registryOrigins = [...new Set(Object.values(lock.packages ?? {})
  .map((entry) => entry?.resolved)
  .filter((value) => typeof value === 'string' && value.startsWith('http'))
  .map((value) => new URL(value).origin))].sort();
const allowedOrigin = new URL(policy.registry).origin;
const unexpectedOrigins = registryOrigins.filter((origin) => origin !== allowedOrigin);
if (unexpectedOrigins.length > 0) throw new Error(`package-lock contains non-official registry origins: ${unexpectedOrigins.join(', ')}`);
const defaultBundleCacheRoot = resolve('.tmp/npm-cache-bootstrap');
const cacheRoot = resolveNpmCacheRoot(explicitCacheOption ?? (cacheBundleOption ? defaultBundleCacheRoot : undefined));
let cacheBundleImport = { status: 'NOT_RUN', reason: cacheBundleOption ? 'PENDING' : 'NOT_PROVIDED' };
if (cacheBundleOption) {
  const archivePath = resolve(cacheBundleOption);
  const usesManagedCacheRoot = explicitCacheOption === undefined && cacheRoot === defaultBundleCacheRoot;
  if (usesManagedCacheRoot) await rm(cacheRoot, { recursive: true, force: true });
  try {
    cacheBundleImport = await importNpmCacheTransferBundle({
      lock,
      lockBytes: await readFile('package-lock.json'),
      packageVersion: JSON.parse(await readFile('package.json', 'utf8')).version,
      archivePath,
      targetCacheRoot: cacheRoot
    });
  } catch (error) {
    cacheBundleImport = { status: 'FAIL', importStatus: 'FAIL', archivePath, targetCacheRoot: cacheRoot, failures: [error.message] };
  }
  if (cacheBundleImport.status !== 'PASS') {
    const report = {
      schemaVersion: 2,
      product: 'Anadolu Parsı Aile Yaşam Merkezi',
      stage: 'Bronze RC2 Active Development',
      startedAt,
      finishedAt: new Date().toISOString(),
      platform: process.platform,
      nodeVersion: process.version,
      status: 'FAIL',
      classification: 'CACHE_BUNDLE_REJECTED',
      officialRegistryOnly: true,
      registry: policy.registry,
      cacheBundleImport
    };
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.error('Clean npm ci cache bundle import failed.');
    process.exit(1);
  }
}
const offlineCacheReadiness = policy.offlineCache.enabled
  ? await assessNpmOfflineCache({ lock, cacheRoot, registry: policy.registry })
  : { schemaVersion: 1, status: 'DISABLED', cacheRoot, requiredTarballCount: 0, readyTarballCount: 0, missingOrInvalidTarballCount: 0, reasonCounts: {}, entries: [] };

try {
  await stat('node_modules');
  throw new Error('Clean npm ci gate requires a source tree without root node_modules.');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const baseNpmArgs = [
  'ci',
  '--no-audit',
  '--no-fund',
  '--fetch-retries=0',
  '--fetch-timeout=20000',
  `--cache=${cacheRoot}`,
  `--registry=${policy.registry}`,
  ...(policy.ignoreScripts ? ['--ignore-scripts'] : [])
];
const onlineNpmArgs = [
  ...baseNpmArgs,
  ...(policy.offlineCache.preferOfflineForOnlineAttempts ? ['--prefer-offline'] : [])
];
const offlineNpmArgs = [...baseNpmArgs, '--offline'];
const onlineInvocation = resolveValidationCommand({ command: 'npm', args: onlineNpmArgs });
const offlineInvocation = resolveValidationCommand({ command: 'npm', args: offlineNpmArgs });
const outputLimit = 65_536;
const npmLogRoot = resolve(process.env.npm_config_cache ?? process.env.NPM_CONFIG_CACHE ?? resolve(homedir(), '.npm'), '_logs');
const summarizeDebugLog = (content) => {
  const lines = content.split(/\r?\n/);
  const signalPattern = /EAI_AGAIN|ECONNRESET|ECONNREFUSED|ENETUNREACH|ETIMEDOUT|UND_ERR_|HTTP(?:\s+ERROR)?\s+(?:408|429|500|502|503|504)|\bE(?:408|429|500|502|503|504)\b|Exit handler never called/i;
  const signalLines = lines.filter((line) => signalPattern.test(line));
  const tailLines = lines.slice(-40);
  return [...new Set([...signalLines, ...tailLines])].join('\n').slice(-outputLimit);
};
const extractDebugLogPath = (stderr) => {
  const match = /complete log of this run can be found in:\s*(.+?\.log)\s*$/im.exec(stderr);
  if (!match) return undefined;
  const candidate = isAbsolute(match[1].trim()) ? resolve(match[1].trim()) : resolve(process.cwd(), match[1].trim());
  const traversal = relative(npmLogRoot, candidate);
  if (traversal.startsWith('..') || isAbsolute(traversal)) return undefined;
  return candidate;
};
const newestAttemptDebugLog = async (attemptStarted) => {
  try {
    const entries = await readdir(npmLogRoot, { withFileTypes: true });
    const candidates = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('-debug-0.log')) continue;
      const path = resolve(npmLogRoot, entry.name);
      const info = await stat(path);
      if (info.mtimeMs >= attemptStarted - 2_000) candidates.push({ path, mtimeMs: info.mtimeMs });
    }
    candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
    return candidates[0]?.path;
  } catch {
    return undefined;
  }
};
const readDebugLog = async (stderr, attemptStarted) => {
  const path = extractDebugLogPath(stderr) ?? await newestAttemptDebugLog(attemptStarted);
  if (!path) return { debugLog: '', debugLogFile: undefined };
  try {
    const content = await readFile(path, 'utf8');
    return {
      debugLog: redactNpmOutput(summarizeDebugLog(content)),
      debugLogFile: basename(path)
    };
  } catch {
    return { debugLog: '', debugLogFile: basename(path) };
  }
};
const appendLimited = (current, chunk) => {
  const combined = `${current}${chunk}`;
  return combined.length <= outputLimit ? combined : combined.slice(-outputLimit);
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

const createAttemptExecutor = ({ invocation, mode, maxAttempts }) => (attempt) => new Promise((resolveAttempt) => {
  const attemptStarted = Date.now();
  if (interruptedSignal) {
    resolveAttempt({
      mode,
      startedAt: new Date(attemptStarted).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      exitCode: null,
      signal: interruptedSignal,
      timedOut: false,
      interrupted: true,
      interruptedSignal,
      stdout: '',
      stderr: `Clean npm ci was interrupted by ${interruptedSignal} before attempt ${attempt}.`,
      debugLog: ''
    });
    return;
  }
  const child = spawn(invocation.command, invocation.args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      npm_config_registry: policy.registry,
      NPM_CONFIG_REGISTRY: policy.registry,
      npm_config_cache: cacheRoot,
      NPM_CONFIG_CACHE: cacheRoot
    },
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32'
  });
  currentAttemptChild = child;
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    stdout = appendLimited(stdout, text);
    process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderr = appendLimited(stderr, text);
    process.stderr.write(chunk);
  });
  let settled = false;
  let timedOut = false;
  let forceKillTimer;
  const attemptTimer = setTimeout(() => {
    timedOut = true;
    stderr = appendLimited(stderr, `\nClean npm ci attempt exceeded ${effectiveAttemptTimeoutMs} ms and was terminated.\n`);
    terminateProcessTree(child, false);
    forceKillTimer = setTimeout(() => {
      terminateProcessTree(child, true);
      void finish({
        exitCode: null,
        signal: process.platform === 'win32' ? 'TASKKILL' : 'SIGKILL',
        forcedSettlement: true
      });
    }, 3_000);
    forceKillTimer.unref?.();
  }, effectiveAttemptTimeoutMs);
  attemptTimer.unref?.();
  const finish = async ({ exitCode, signal, error, forcedSettlement = false }) => {
    if (settled) return;
    settled = true;
    clearTimeout(attemptTimer);
    clearTimeout(forceKillTimer);
    if (currentAttemptChild === child) currentAttemptChild = null;
    if (currentAttemptForceSettle) currentAttemptForceSettle = null;
    if (forcedSettlement || interruptedSignal) {
      child.stdout?.destroy();
      child.stderr?.destroy();
      child.stdin?.destroy();
      child.unref?.();
    }
    const debug = await readDebugLog(stderr, attemptStarted);
    resolveAttempt({
      mode,
      startedAt: new Date(attemptStarted).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - attemptStarted,
      exitCode,
      signal: signal ?? null,
      timedOut,
      forcedSettlement,
      interrupted: Boolean(interruptedSignal),
      ...(interruptedSignal ? { interruptedSignal } : {}),
      ...(error ? { error: redactNpmOutput(error.message) } : {}),
      stdout: redactNpmOutput(stdout),
      stderr: redactNpmOutput(stderr),
      ...debug
    });
  };
  currentAttemptForceSettle = (signal = 'SIGKILL') => {
    void finish({ exitCode: null, signal, forcedSettlement: true });
  };
  child.on('error', (error) => { void finish({ exitCode: null, signal: null, error }); });
  child.on('close', (exitCode, signal) => { void finish({ exitCode, signal }); });
  console.log(`Clean npm ci ${mode} attempt ${attempt}/${maxAttempts} started.`);
});

const handleInterrupt = (signal) => {
  if (interruptedSignal) return;
  interruptedSignal = signal;
  if (!currentAttemptChild) return;
  const interruptedChild = currentAttemptChild;
  terminateProcessTree(interruptedChild, false);
  interruptForceKillTimer = setTimeout(() => {
    terminateProcessTree(interruptedChild, true);
    currentAttemptForceSettle?.(process.platform === 'win32' ? 'TASKKILL' : 'SIGKILL');
  }, 3_000);
  interruptForceKillTimer.unref?.();
};
process.once('SIGINT', () => handleInterrupt('SIGINT'));
process.once('SIGTERM', () => handleInterrupt('SIGTERM'));

const workspacePackagePaths = Object.keys(lock.packages ?? {})
  .filter((packagePath) => /^(?:apps|packages)\/[^/]+$/.test(packagePath))
  .sort();

const onlineExecuteAttempt = createAttemptExecutor({ invocation: onlineInvocation, mode: 'OFFICIAL_REGISTRY_ONLINE', maxAttempts: policy.maxAttempts });
const offlineExecuteAttempt = createAttemptExecutor({ invocation: offlineInvocation, mode: 'VERIFIED_OFFLINE_CACHE', maxAttempts: 1 });
let offlineAttempt = {
  status: 'NOT_RUN',
  reason: policy.offlineCache.enabled
    ? (offlineCacheReadiness.status === 'PASS' ? 'POLICY_DID_NOT_REQUEST' : 'CACHE_INCOMPLETE')
    : 'CACHE_POLICY_DISABLED'
};
let outcome;
let installMode = 'OFFICIAL_REGISTRY_ONLINE';
let cleanupBeforeOnline = { performed: false, status: 'NOT_REQUIRED', paths: [] };

if (policy.offlineCache.enabled && policy.offlineCache.attemptWhenComplete && offlineCacheReadiness.status === 'PASS') {
  const rawOfflineAttempt = await offlineExecuteAttempt(1);
  const offlineClassification = rawOfflineAttempt.interrupted
    ? { classification: 'RUNNER_INTERRUPTED', retryable: false, matchedSignals: [rawOfflineAttempt.interruptedSignal ?? 'INTERRUPTED'] }
    : rawOfflineAttempt.exitCode === 0
      ? { classification: 'NONE', retryable: false, matchedSignals: [] }
      : classifyNpmCiFailure(rawOfflineAttempt, policy);
  offlineAttempt = { attempt: 1, ...rawOfflineAttempt, ...offlineClassification, status: rawOfflineAttempt.exitCode === 0 ? 'PASS' : 'FAIL' };
  if (rawOfflineAttempt.exitCode === 0) {
    outcome = { status: 'PASS', classification: 'NONE', attempts: [offlineAttempt] };
    installMode = 'VERIFIED_OFFLINE_CACHE';
  } else {
    cleanupBeforeOnline = await cleanupFailedInstallResidue({ root: process.cwd(), workspacePackagePaths });
  }
}

if (!outcome) {
  outcome = await runNpmCiWithRetry({
    policy,
    executeAttempt: onlineExecuteAttempt,
    onRetry: ({ attempt, nextAttempt, delayMs, classification }) => {
      console.error(`Attempt ${attempt} classified as ${classification.classification}; retrying attempt ${nextAttempt} after ${delayMs} ms.`);
    }
  });
}
const partialInstallCleanup = outcome.status === 'PASS'
  ? { performed: false, status: 'NOT_REQUIRED', paths: [] }
  : await cleanupFailedInstallResidue({ root: process.cwd(), workspacePackagePaths });

const report = {
  schemaVersion: 2,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  stage: 'Bronze RC2 Active Development',
  startedAt,
  finishedAt: new Date().toISOString(),
  platform: process.platform,
  nodeVersion: process.version,
  status: outcome.status,
  classification: outcome.classification,
  officialRegistryOnly: true,
  registry: policy.registry,
  lockfileRegistryOrigins: registryOrigins,
  installMode,
  requestedCommand: 'npm',
  requestedArgs: installMode === 'VERIFIED_OFFLINE_CACHE' ? offlineNpmArgs : onlineNpmArgs,
  resolvedCommand: installMode === 'VERIFIED_OFFLINE_CACHE' ? offlineInvocation.command : onlineInvocation.command,
  resolvedArgs: installMode === 'VERIFIED_OFFLINE_CACHE' ? offlineInvocation.args : onlineInvocation.args,
  commandResolutionStrategy: installMode === 'VERIFIED_OFFLINE_CACHE' ? offlineInvocation.strategy : onlineInvocation.strategy,
  onlineRequestedArgs: onlineNpmArgs,
  offlineRequestedArgs: offlineNpmArgs,
  cacheBundleImport,
  offlineCacheReadiness,
  offlineAttempt,
  cleanupBeforeOnline,
  policy: {
    maxAttempts: policy.maxAttempts,
    baseDelayMs: policy.baseDelayMs,
    maxDelayMs: policy.maxDelayMs,
    configuredAttemptTimeoutMs: policy.attemptTimeoutMs,
    effectiveAttemptTimeoutMs,
    retryableHttpStatuses: policy.retryableHttpStatuses,
    retryableNetworkCodes: policy.retryableNetworkCodes,
    ignoreScripts: policy.ignoreScripts
  },
  attempts: outcome.attempts,
  ...(interruptedSignal ? { interruptedSignal } : {}),
  partialInstallCleanup
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
clearTimeout(interruptForceKillTimer);
console.log(`Clean npm ci dependency access report written: ${reportPath}`);
if (outcome.status !== 'PASS') process.exitCode = 1;
