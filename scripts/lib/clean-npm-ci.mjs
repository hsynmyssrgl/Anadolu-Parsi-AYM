import { rm, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
const normalizeText = (value) => typeof value === 'string' ? value : '';

export const redactNpmOutput = (value) => normalizeText(value)
  .replace(/(https?:\/\/)([^\s/@:]+):([^\s/@]+)@/gi, '$1[REDACTED]@')
  .replace(/((?:_authToken|npm_auth_token|npm_token)\s*[=:]\s*)[^\s"']+/gi, '$1[REDACTED]')
  .replace(/(\/\/[A-Za-z0-9._-]+(?::\d+)?\/:_authToken=)[^\s]+/gi, '$1[REDACTED]');

export const classifyNpmCiFailure = ({ stdout = '', stderr = '', exitCode = null, error = '', debugLog = '', timedOut = false }, policy) => {
  const combined = `${normalizeText(stdout)}\n${normalizeText(stderr)}\n${normalizeText(error)}\n${normalizeText(debugLog)}`;
  const upper = combined.toUpperCase();
  const matchedSignals = [];

  for (const status of policy.retryableHttpStatuses ?? []) {
    const patterns = [
      new RegExp(`\\bHTTP(?:\\s+ERROR)?\\s+${status}\\b`, 'i'),
      new RegExp(`\\bE${status}\\b`, 'i'),
      new RegExp(`\\b${status}\\s+(?:SERVICE|BAD|GATEWAY|TOO|INTERNAL|REQUEST)`, 'i')
    ];
    if (patterns.some((pattern) => pattern.test(combined))) matchedSignals.push(`HTTP_${status}`);
  }
  for (const code of policy.retryableNetworkCodes ?? []) {
    if (upper.includes(String(code).toUpperCase())) matchedSignals.push(String(code).toUpperCase());
  }
  if (/SOCKET HANG UP/i.test(combined)) matchedSignals.push('SOCKET_HANG_UP');

  const uniqueSignals = [...new Set(matchedSignals)];
  if (uniqueSignals.length > 0) {
    return {
      classification: 'EXTERNAL_DEPENDENCY_SERVICE_UNAVAILABLE',
      retryable: true,
      matchedSignals: timedOut ? [...new Set([...uniqueSignals, 'ATTEMPT_TIMEOUT'])] : uniqueSignals
    };
  }
  if (timedOut) {
    return {
      classification: 'NPM_PROCESS_TIMEOUT',
      retryable: true,
      matchedSignals: ['ATTEMPT_TIMEOUT']
    };
  }
  if (/EUSAGE|ELOCKVERIFY|PACKAGE-LOCK\.JSON.*OUT OF DATE|LOCK FILE.*OUT OF DATE/i.test(combined)) {
    return {
      classification: 'LOCKFILE_OR_INSTALL_POLICY_ERROR',
      retryable: false,
      matchedSignals: []
    };
  }
  if (/EINTEGRITY|INTEGRITY CHECK FAILED|CHECKSUM/i.test(combined)) {
    return {
      classification: 'PACKAGE_INTEGRITY_ERROR',
      retryable: false,
      matchedSignals: []
    };
  }
  if (/EACCES|EPERM|PERMISSION DENIED/i.test(combined)) {
    return {
      classification: 'LOCAL_FILESYSTEM_PERMISSION_ERROR',
      retryable: false,
      matchedSignals: []
    };
  }
  return {
    classification: exitCode === 0 ? 'NONE' : 'UNCLASSIFIED_NPM_CI_FAILURE',
    retryable: false,
    matchedSignals: []
  };
};

export const retryDelayMs = ({ attempt, baseDelayMs, maxDelayMs }) =>
  Math.min(maxDelayMs, baseDelayMs * (2 ** Math.max(0, attempt - 1)));

export const runNpmCiWithRetry = async ({
  policy,
  executeAttempt,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  onRetry = () => {},
  onAttemptComplete = async () => {}
}) => {
  const attempts = [];
  const maxAttempts = policy.maxAttempts;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const rawResult = await executeAttempt(attempt);
    const classification = rawResult.interrupted
      ? { classification: 'RUNNER_INTERRUPTED', retryable: false, matchedSignals: [rawResult.interruptedSignal ?? 'INTERRUPTED'] }
      : rawResult.exitCode === 0
        ? { classification: 'NONE', retryable: false, matchedSignals: [] }
        : classifyNpmCiFailure(rawResult, policy);
    const result = { attempt, ...rawResult, ...classification };
    attempts.push(result);
    await onAttemptComplete(result, [...attempts]);
    if (rawResult.exitCode === 0) {
      return { status: 'PASS', classification: 'NONE', attempts };
    }
    if (!classification.retryable || attempt >= maxAttempts) {
      return { status: 'FAIL', classification: classification.classification, attempts };
    }
    const delayMs = retryDelayMs({
      attempt,
      baseDelayMs: policy.baseDelayMs,
      maxDelayMs: policy.maxDelayMs
    });
    onRetry({ attempt, nextAttempt: attempt + 1, delayMs, classification });
    await sleep(delayMs);
  }
  return { status: 'FAIL', classification: 'UNCLASSIFIED_NPM_CI_FAILURE', attempts };
};


export const resolveInstallResiduePaths = ({ root, workspacePackagePaths = [] }) => {
  const normalizedRoot = resolve(root);
  const candidates = ['node_modules'];
  for (const workspacePath of workspacePackagePaths) {
    const normalized = String(workspacePath).replaceAll('\\', '/');
    if (!/^(?:apps|packages)\/[^/]+$/.test(normalized)) {
      throw new Error(`Unsafe workspace path for install residue cleanup: ${workspacePath}`);
    }
    candidates.push(`${normalized}/node_modules`);
  }
  return [...new Set(candidates)].map((candidate) => {
    const absolute = resolve(normalizedRoot, candidate);
    const traversal = relative(normalizedRoot, absolute);
    if (traversal.startsWith('..') || isAbsolute(traversal)) {
      throw new Error(`Install residue cleanup path escapes repository root: ${candidate}`);
    }
    return { relativePath: candidate.replaceAll('\\', '/'), absolutePath: absolute };
  });
};

export const cleanupFailedInstallResidue = async ({ root, workspacePackagePaths = [] }) => {
  const paths = resolveInstallResiduePaths({ root, workspacePackagePaths });
  const results = [];
  for (const path of paths) {
    let existed = false;
    try {
      await stat(path.absolutePath);
      existed = true;
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        results.push({ path: path.relativePath, existed: false, removed: false, error: error.message });
        continue;
      }
    }
    if (!existed) {
      results.push({ path: path.relativePath, existed: false, removed: false });
      continue;
    }
    try {
      await rm(path.absolutePath, { recursive: true, force: true });
      results.push({ path: path.relativePath, existed: true, removed: true });
    } catch (error) {
      results.push({ path: path.relativePath, existed: true, removed: false, error: error.message });
    }
  }
  return {
    performed: true,
    status: results.some((result) => result.error) ? 'FAIL' : 'PASS',
    paths: results
  };
};
