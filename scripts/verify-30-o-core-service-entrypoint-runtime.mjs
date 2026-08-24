import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import {
  CoreServiceProcessConfigurationError,
  createCoreServiceProcessHost,
  readCoreServiceProcessConfiguration
} from '../apps/core-service/src/main.ts';
import {
  CoreServiceLocalAdminClient,
  CoreServiceLocalAdminClientError
} from '../packages/core-service-client/src/index.ts';

const noWrite = process.argv.includes('--no-write');
const mandatoryTruth = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const assertions = [];
const canonicalMandatoryTruth = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const check = (id, condition, actual) => {
  assertions.push({ id, status: condition ? 'PASS' : 'FAIL', actual });
};
const expectConfigurationFailure = (id, environment, platform = process.platform) => {
  let failedClosed = false;
  try {
    readCoreServiceProcessConfiguration(environment, platform);
  } catch (error) {
    failedClosed = error instanceof CoreServiceProcessConfigurationError;
  }
  check(id, failedClosed, failedClosed);
};
const connectSocket = (endpoint) => new Promise((resolve, reject) => {
  const socket = createConnection(endpoint);
  socket.once('connect', () => resolve(socket));
  socket.once('error', reject);
});

const temporaryRoot = await mkdtemp(join(tmpdir(), 'ppt-30o-core-entrypoint-'));
const endpoint = process.platform === 'win32'
  ? `\\\\.\\pipe\\ppt-30o-core-entrypoint-${process.pid}-${Date.now()}`
  : join(temporaryRoot, 'core-service.sock');
const authenticationToken = randomBytes(48).toString('base64url');
const policySigningKeyHex = randomBytes(32).toString('hex');
const environment = {
  PPT_CORE_SERVICE_LOCAL_ADMIN_ENDPOINT: endpoint,
  PPT_CORE_SERVICE_LOCAL_ADMIN_TOKEN: authenticationToken,
  PPT_POLICY_SIGNING_KEY_HEX: policySigningKeyHex,
  PPT_POLICY_JOURNAL_AUTHORITY_PATH: join(temporaryRoot, 'policy-journal-authority.json'),
  PPT_POLICY_VERSION: 'PPT-PLATFORM-POLICY-2026-08-04-V1'
};
let host;
let entrypointChild;

try {
  expectConfigurationFailure('missing-endpoint-fails-closed', {
    PPT_CORE_SERVICE_LOCAL_ADMIN_TOKEN: authenticationToken,
    PPT_POLICY_SIGNING_KEY_HEX: policySigningKeyHex,
    PPT_POLICY_JOURNAL_AUTHORITY_PATH: join(temporaryRoot, 'missing-endpoint-authority.json')
  });
  expectConfigurationFailure('short-token-fails-closed', {
    ...environment,
    PPT_CORE_SERVICE_LOCAL_ADMIN_TOKEN: 'too-short'
  });
  expectConfigurationFailure('odd-hex-signing-key-fails-closed', {
    ...environment,
    PPT_POLICY_SIGNING_KEY_HEX: `${policySigningKeyHex}a`
  });
  expectConfigurationFailure('remote-windows-pipe-fails-closed', {
    ...environment,
    PPT_CORE_SERVICE_LOCAL_ADMIN_ENDPOINT: '\\\\remote-host\\pipe\\ppt-core-service'
  }, 'win32');

  host = createCoreServiceProcessHost(environment);
  check('runtime-starts-in-safe-mode', host.runtime.health().safeMode === true && host.runtime.health().writable === false, host.runtime.health());
  await host.start();
  check('server-listens-before-ready', host.runtime.health().lifecycle === 'ready' && host.runtime.health().writable === true, host.runtime.health());

  const client = new CoreServiceLocalAdminClient({ endpoint, authenticationToken, timeoutMs: 2_000 });
  const health = await client.health();
  check('entrypoint-host-serves-health', health.lifecycle === 'ready' && health.writeFenceEpoch === 1, health);

  let wrongTokenRejected = false;
  try {
    await new CoreServiceLocalAdminClient({
      endpoint,
      authenticationToken: randomBytes(48).toString('base64url'),
      timeoutMs: 2_000
    }).health();
  } catch (error) {
    wrongTokenRejected = error instanceof CoreServiceLocalAdminClientError && error.code === 'AUTHENTICATION_FAILED';
  }
  check('wrong-token-rejected', wrongTokenRejected, wrongTokenRejected);

  const blockingSocket = await connectSocket(endpoint);
  blockingSocket.on('error', () => undefined);
  blockingSocket.write('x');
  await new Promise((resolve) => setImmediate(resolve));
  const dripFeed = setInterval(() => {
    if (!blockingSocket.destroyed) blockingSocket.write('x');
  }, 50);
  await new Promise((resolve) => setTimeout(resolve, 120));
  const shutdownStartedAt = Date.now();
  const stopping = host.stop();
  const stoppingHealth = host.runtime.health();
  check('shutdown-fences-writes-before-close', stoppingHealth.lifecycle === 'stopping' && stoppingHealth.writable === false && stoppingHealth.safeMode === true, stoppingHealth);
  await stopping;
  await new Promise((resolve) => setImmediate(resolve));
  clearInterval(dripFeed);
  const shutdownElapsedMs = Date.now() - shutdownStartedAt;
  check(
    'drip-feed-client-cannot-block-bounded-shutdown',
    blockingSocket.destroyed && shutdownElapsedMs < 5_000,
    { socketDestroyed: blockingSocket.destroyed, shutdownElapsedMs }
  );
  const stoppedHealth = host.runtime.health();
  check('graceful-stop-completes', stoppedHealth.lifecycle === 'stopped' && stoppedHealth.writeFenceEpoch === 3, stoppedHealth);
  await host.stop();
  check('graceful-stop-is-idempotent', host.runtime.health().writeFenceEpoch === 3, host.runtime.health().writeFenceEpoch);

  let stoppedHostRestartRejected = false;
  try {
    await host.start();
  } catch (error) {
    stoppedHostRestartRejected = error instanceof Error
      && error.message === 'Core Service process host cannot be started in its current state';
  }
  check('stopped-host-rejects-restart', stoppedHostRestartRejected, stoppedHostRestartRejected);

  let stoppedConnectionRejected = false;
  try {
    await client.health();
  } catch (error) {
    stoppedConnectionRejected = error instanceof CoreServiceLocalAdminClientError && error.code === 'CONNECTION_FAILED';
  }
  check('stopped-server-refuses-new-connections', stoppedConnectionRejected, stoppedConnectionRejected);

  const childEnvironment = { ...process.env, ...environment, PPT_POLICY_SIGNING_KEY_HEX: 'invalid-signing-key' };
  const configurationFailure = spawnSync(process.execPath, [
    '--experimental-strip-types',
    '--experimental-loader',
    './scripts/ts-workspace-loader.mjs',
    'apps/core-service/src/main.ts'
  ], { cwd: process.cwd(), env: childEnvironment, encoding: 'utf8', timeout: 10_000 });
  check('entrypoint-invalid-config-exits-78', configurationFailure.status === 78, configurationFailure.status);
  const childOutput = `${configurationFailure.stdout ?? ''}${configurationFailure.stderr ?? ''}`;
  check('entrypoint-reports-sanitized-config-failure', childOutput.includes('CONFIGURATION_INVALID'), childOutput.trim());
  check('entrypoint-does-not-disclose-token', !childOutput.includes(authenticationToken), 'token absent');
  check('entrypoint-does-not-disclose-signing-key', !childOutput.includes(policySigningKeyHex), 'signing key absent');

  const childEndpoint = process.platform === 'win32'
    ? `\\\\.\\pipe\\ppt-30o-core-entrypoint-child-${process.pid}-${Date.now()}`
    : join(temporaryRoot, 'core-service-child.sock');
  const directEnvironment = {
    ...process.env,
    ...environment,
    PPT_CORE_SERVICE_LOCAL_ADMIN_ENDPOINT: childEndpoint
  };
  const shutdownPrelude = `data:text/javascript,${encodeURIComponent("process.stdin.once('data',()=>{process.stdin.pause();process.emit('SIGTERM')});process.stdin.resume();")}`;
  entrypointChild = spawn(process.execPath, [
    '--import',
    shutdownPrelude,
    '--experimental-strip-types',
    '--experimental-loader',
    './scripts/ts-workspace-loader.mjs',
    'apps/core-service/src/main.ts'
  ], { cwd: process.cwd(), env: directEnvironment, stdio: ['pipe', 'pipe', 'pipe'] });
  let directOutput = '';
  let pendingLine = '';
  const readyEvent = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Core Service entrypoint ready event timed out')), 10_000);
    entrypointChild.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Core Service entrypoint exited before ready with code ${code}`));
    });
    entrypointChild.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      directOutput += text;
      pendingLine += text;
      const lines = pendingLine.split(/\r?\n/u);
      pendingLine = lines.pop() ?? '';
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.event === 'core-service.ready') {
            clearTimeout(timer);
            resolve(event);
          }
        } catch {
          // Non-JSON process diagnostics are retained below and are not treated as readiness.
        }
      }
    });
    entrypointChild.stderr.on('data', (chunk) => { directOutput += chunk.toString('utf8'); });
  });
  check('direct-entrypoint-emits-ready', readyEvent.metadata?.lifecycle === 'ready' && readyEvent.metadata?.writable === true, readyEvent);
  const directHealth = await new CoreServiceLocalAdminClient({
    endpoint: childEndpoint,
    authenticationToken,
    timeoutMs: 2_000
  }).health();
  check('direct-entrypoint-serves-health', directHealth.lifecycle === 'ready' && directHealth.writable === true, directHealth);
  const directExit = new Promise((resolve) => entrypointChild.once('close', (code, signal) => resolve({ code, signal })));
  entrypointChild.stdin.end('shutdown\n');
  const directExitResult = await directExit;
  check('direct-entrypoint-graceful-exit-zero', directExitResult.code === 0 && directExitResult.signal === null, directExitResult);
  check('direct-entrypoint-stopping-event-is-fenced', directOutput.includes('"event":"core-service.stopping"') && directOutput.includes('"lifecycle":"stopping"') && directOutput.includes('"writable":false'), directOutput.trim());
  check('direct-entrypoint-emits-core-service-stopped', directOutput.includes('"event":"core-service.stopped"') && directOutput.includes('"lifecycle":"stopped"'), directOutput.trim());
  check('direct-entrypoint-does-not-disclose-secrets', !directOutput.includes(authenticationToken) && !directOutput.includes(policySigningKeyHex), 'secrets absent');
} finally {
  await host?.stop().catch(() => undefined);
  if (entrypointChild && entrypointChild.exitCode === null) {
    const exited = new Promise((resolve) => entrypointChild.once('exit', resolve));
    entrypointChild.kill('SIGTERM');
    await exited;
  }
  await rm(temporaryRoot, { recursive: true, force: true });
}

const failures = assertions.filter((assertion) => assertion.status !== 'PASS');
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-O',
  scope: 'Core Service env-provisioned local administration entrypoint lifecycle and fail-closed shutdown runtime',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  assertionCount: assertions.length,
  assertions,
  openBoundaries: [
    'Windows installed-service registration and Service Control Manager lifecycle are NOT_RUN_NOT_PASS.',
    'Protected endpoint/token/signing-key provisioning, rotation and ACL ownership are NOT_IMPLEMENTED.',
    'Desktop remains forbidden from reading Core Service credentials from process environment variables.'
  ],
  mandatoryTruth: canonicalMandatoryTruth,
  generatedAt: new Date().toISOString()
};
if (!noWrite) {
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/30-O-core-service-entrypoint-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
}
if (failures.length > 0) {
  console.error(failures.map((failure) => failure.id).join('\n'));
  process.exit(1);
}
console.log(`30-O Core Service Entrypoint Runtime: PASS (${assertions.length} assertions).`);
