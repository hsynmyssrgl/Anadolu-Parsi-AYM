import { readFile } from 'node:fs/promises';
import { classifyNpmCiFailure, redactNpmOutput, retryDelayMs, runNpmCiWithRetry } from './lib/clean-npm-ci.mjs';

const failures = [];
let checks = 0;
const verify = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const expectedDisplayVersion = '25.07.2026.110';
const expectedPackageVersion = '25.7.2026-110';
const rootPackage = await readJson('package.json');
verify(rootPackage.version === expectedPackageVersion, `root package version=${rootPackage.version}`);
verify(rootPackage.scripts?.['verify:clean-npm-ci'] === 'node scripts/run-clean-npm-ci.mjs', 'root clean npm ci script is missing');
verify(rootPackage.scripts?.['verify:build110:architecture'] === 'node scripts/verify-build110-architecture.mjs', 'Build 110 architecture script is missing');

const policy = await readJson('config/npm-ci-policy.json');
verify(policy.schemaVersion === 1, `npm ci policy schemaVersion=${policy.schemaVersion}`);
verify(policy.registry === 'https://registry.npmjs.org/', `npm ci registry=${policy.registry}`);
verify(policy.maxAttempts === 3, `npm ci maxAttempts=${policy.maxAttempts}`);
verify(policy.baseDelayMs > 0, `npm ci baseDelayMs=${policy.baseDelayMs}`);
verify(policy.maxDelayMs >= policy.baseDelayMs, `npm ci maxDelayMs=${policy.maxDelayMs}`);
verify(policy.attemptTimeoutMs === 180000, `npm ci attemptTimeoutMs=${policy.attemptTimeoutMs}`);
for (const status of [408, 429, 500, 502, 503, 504]) verify(policy.retryableHttpStatuses.includes(status), `retryable HTTP status missing=${status}`);
for (const code of ['EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT']) verify(policy.retryableNetworkCodes.includes(code), `retryable network code missing=${code}`);

const transient503 = classifyNpmCiFailure({ stderr: 'npm error 503 Service Temporarily Unavailable', exitCode: 1 }, policy);
verify(transient503.classification === 'EXTERNAL_DEPENDENCY_SERVICE_UNAVAILABLE', `503 classification=${transient503.classification}`);
verify(transient503.retryable === true, '503 must be retryable');
verify(transient503.matchedSignals.includes('HTTP_503'), `503 signals=${transient503.matchedSignals.join(',')}`);
const transientNetwork = classifyNpmCiFailure({ stderr: 'request failed with ECONNRESET', exitCode: 1 }, policy);
verify(transientNetwork.retryable === true, 'ECONNRESET must be retryable');
verify(transientNetwork.matchedSignals.includes('ECONNRESET'), `network signals=${transientNetwork.matchedSignals.join(',')}`);
const hiddenNetwork = classifyNpmCiFailure({ stderr: 'npm error Exit handler never called!', debugLog: 'http fetch attempt 1 failed with EAI_AGAIN', exitCode: 1 }, policy);
verify(hiddenNetwork.retryable === true, 'debug-log EAI_AGAIN must be retryable');
verify(hiddenNetwork.matchedSignals.includes('EAI_AGAIN'), `debug-log signals=${hiddenNetwork.matchedSignals.join(',')}`);
const timeoutFailure = classifyNpmCiFailure({ stderr: '', exitCode: null, timedOut: true }, policy);
verify(timeoutFailure.classification === 'NPM_PROCESS_TIMEOUT', `timeout classification=${timeoutFailure.classification}`);
verify(timeoutFailure.retryable === true, 'attempt timeout must be retryable');
verify(timeoutFailure.matchedSignals.includes('ATTEMPT_TIMEOUT'), `timeout signals=${timeoutFailure.matchedSignals.join(',')}`);
const timeoutWithNetwork = classifyNpmCiFailure({ stderr: '', debugLog: 'fetch failed with EAI_AGAIN', exitCode: null, timedOut: true }, policy);
verify(timeoutWithNetwork.classification === 'EXTERNAL_DEPENDENCY_SERVICE_UNAVAILABLE', `timeout/network classification=${timeoutWithNetwork.classification}`);
verify(timeoutWithNetwork.matchedSignals.includes('EAI_AGAIN'), `timeout/network signals=${timeoutWithNetwork.matchedSignals.join(',')}`);
verify(timeoutWithNetwork.matchedSignals.includes('ATTEMPT_TIMEOUT'), `timeout/network timeout signal=${timeoutWithNetwork.matchedSignals.join(',')}`);
const lockFailure = classifyNpmCiFailure({ stderr: 'npm error code EUSAGE package-lock.json is out of date', exitCode: 1 }, policy);
verify(lockFailure.classification === 'LOCKFILE_OR_INSTALL_POLICY_ERROR', `lock classification=${lockFailure.classification}`);
verify(lockFailure.retryable === false, 'lockfile failure must not be retried');
const integrityFailure = classifyNpmCiFailure({ stderr: 'EINTEGRITY integrity checksum failed', exitCode: 1 }, policy);
verify(integrityFailure.classification === 'PACKAGE_INTEGRITY_ERROR', `integrity classification=${integrityFailure.classification}`);
verify(integrityFailure.retryable === false, 'integrity failure must not be retried');
const permissionFailure = classifyNpmCiFailure({ stderr: 'EACCES permission denied', exitCode: 1 }, policy);
verify(permissionFailure.classification === 'LOCAL_FILESYSTEM_PERMISSION_ERROR', `permission classification=${permissionFailure.classification}`);
verify(permissionFailure.retryable === false, 'permission failure must not be retried');

const secretOutput = 'https://user:secret@registry.npmjs.org/\n_authToken=top-secret\n//registry.npmjs.org/:_authToken=another-secret';
const redacted = redactNpmOutput(secretOutput);
verify(!redacted.includes('secret@'), 'URL password was not redacted');
verify(!redacted.includes('top-secret'), 'plain auth token was not redacted');
verify(!redacted.includes('another-secret'), 'registry auth token was not redacted');
verify(redacted.includes('[REDACTED]'), 'redaction marker is missing');

verify(retryDelayMs({ attempt: 1, baseDelayMs: 1500, maxDelayMs: 6000 }) === 1500, 'retry delay attempt 1 mismatch');
verify(retryDelayMs({ attempt: 2, baseDelayMs: 1500, maxDelayMs: 6000 }) === 3000, 'retry delay attempt 2 mismatch');
verify(retryDelayMs({ attempt: 4, baseDelayMs: 1500, maxDelayMs: 6000 }) === 6000, 'retry delay cap mismatch');

const retrySequence = [
  { exitCode: 1, stdout: '', stderr: 'HTTP 503 Service Temporarily Unavailable' },
  { exitCode: 0, stdout: 'installed', stderr: '' }
];
const retryEvents = [];
const sleeps = [];
const recovered = await runNpmCiWithRetry({
  policy,
  executeAttempt: async () => retrySequence.shift(),
  sleep: async (delayMs) => { sleeps.push(delayMs); },
  onRetry: (event) => retryEvents.push(event)
});
verify(recovered.status === 'PASS', `retry recovery status=${recovered.status}`);
verify(recovered.attempts.length === 2, `retry recovery attempts=${recovered.attempts.length}`);
verify(retryEvents.length === 1, `retry event count=${retryEvents.length}`);
verify(sleeps.length === 1 && sleeps[0] === policy.baseDelayMs, `retry sleep=${JSON.stringify(sleeps)}`);

let deterministicAttempts = 0;
const deterministic = await runNpmCiWithRetry({
  policy,
  executeAttempt: async () => { deterministicAttempts += 1; return { exitCode: 1, stdout: '', stderr: 'ELOCKVERIFY lock file invalid' }; },
  sleep: async () => { throw new Error('deterministic failure must not sleep'); }
});
verify(deterministic.status === 'FAIL', `deterministic status=${deterministic.status}`);
verify(deterministic.classification === 'LOCKFILE_OR_INSTALL_POLICY_ERROR', `deterministic classification=${deterministic.classification}`);
verify(deterministicAttempts === 1, `deterministic attempts=${deterministicAttempts}`);

let exhaustedAttempts = 0;
const exhausted = await runNpmCiWithRetry({
  policy,
  executeAttempt: async () => { exhaustedAttempts += 1; return { exitCode: 1, stdout: '', stderr: 'HTTP 503 Service Temporarily Unavailable' }; },
  sleep: async () => {}
});
verify(exhausted.status === 'FAIL', `exhausted status=${exhausted.status}`);
verify(exhausted.classification === 'EXTERNAL_DEPENDENCY_SERVICE_UNAVAILABLE', `exhausted classification=${exhausted.classification}`);
verify(exhaustedAttempts === policy.maxAttempts, `exhausted attempts=${exhaustedAttempts}`);

const wrapper = await readFile('scripts/run-clean-npm-ci.mjs', 'utf8');
verify(wrapper.includes("policy.registry !== 'https://registry.npmjs.org/'"), 'wrapper does not enforce official registry');
verify(wrapper.includes('unexpectedOrigins.length > 0'), 'wrapper does not reject unexpected lockfile origins');
verify(wrapper.includes("await stat('node_modules')"), 'wrapper does not enforce a clean root source tree');
verify(wrapper.includes('officialRegistryOnly: true'), 'dependency report does not declare official registry policy');
verify(wrapper.includes('redactNpmOutput'), 'wrapper does not redact npm output');
verify(wrapper.includes("'--fetch-retries=0'"), 'wrapper must own retry behavior deterministically');
verify(wrapper.includes('runNpmCiWithRetry'), 'wrapper bypasses the retry orchestrator');
verify(wrapper.includes('extractDebugLogPath'), 'wrapper does not inspect npm debug logs');
verify(wrapper.includes('npmLogRoot'), 'wrapper does not constrain npm debug-log reads');
verify(wrapper.includes('newestAttemptDebugLog'), 'wrapper does not recover debug logs from terminated npm attempts');
verify(wrapper.includes('summarizeDebugLog'), 'wrapper stores unsummarized npm debug logs');
verify(wrapper.includes('effectiveAttemptTimeoutMs'), 'wrapper does not enforce effective per-attempt timeout');
verify(wrapper.includes('PPT_NPM_CI_ATTEMPT_TIMEOUT_OVERRIDE_MS'), 'wrapper does not support constrained validation timeout override');
verify(wrapper.includes('attemptTimeoutOverride <= policy.attemptTimeoutMs'), 'timeout override can extend production timeout');
verify(wrapper.includes('terminateProcessTree'), 'wrapper does not terminate hung npm process trees');

const gateConfig = await readJson('config/rc2-validation-gates.json');
const cleanGate = gateConfig.gates?.[0];
verify(cleanGate?.id === 'clean-npm-ci', `first gate=${cleanGate?.id}`);
verify(cleanGate?.command === 'node', `clean gate command=${cleanGate?.command}`);
verify(cleanGate?.args?.[0] === 'scripts/run-clean-npm-ci.mjs', `clean gate runner=${cleanGate?.args?.[0]}`);
verify(cleanGate?.args?.includes('artifacts/validation/npm-ci-dependency-access.json'), 'clean gate report path missing');
verify(cleanGate?.platforms?.includes('win32') && cleanGate.platforms.includes('linux') && cleanGate.platforms.includes('darwin'), 'clean gate platform coverage is incomplete');

const workflow = await readFile('.github/workflows/windows-rc2-validation.yml', 'utf8');
verify(workflow.includes('validate:rc2:gates'), 'Windows workflow bypasses ordered RC2 gates');
verify(workflow.includes('artifacts/validation/npm-ci-dependency-access.json'), 'Windows workflow does not preserve dependency access evidence');
verify(workflow.includes("registry-url: 'https://registry.npmjs.org'"), 'Windows workflow registry is not official npm');

const appMeta = await readFile('packages/domain/src/app-meta.ts', 'utf8');
verify(appMeta.includes(`version: '${expectedDisplayVersion}'`), 'APP_META display version mismatch');
verify(appMeta.includes(`packageVersion: '${expectedPackageVersion}'`), 'APP_META package version mismatch');
verify(appMeta.includes("stage: 'Bronze RC2 · Aktif Geliştirme · Build 110'"), 'APP_META stage mismatch');

if (failures.length > 0) {
  console.error(`Build 110 architecture verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 110 architecture verification completed: ${checks} targeted assertions.`);
