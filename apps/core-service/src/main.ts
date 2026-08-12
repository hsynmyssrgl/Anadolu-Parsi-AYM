import { randomBytes } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { asCorrelationId, asIsoDateTime } from '@ppt/core';
import { writeContentFreeConsoleEvent, type LogLevel } from '@ppt/logging';
import {
  PLATFORM_APPLICATION_IDS,
  PLATFORM_APPLICATION_RUNTIME_CAPABILITY_REQUIREMENTS,
  PlatformCapabilityManifestPolicy,
  PlatformPolicyKernel,
  createPlatformCapabilityManifestAuthority
} from '@ppt/platform-policy';
import { CORE_SERVICE_APPLICATION_API_VERSION } from '@ppt/core-service-contracts';
import { CoreServiceLocalAdminServer } from './local-admin-server.js';
import { CoreServiceRuntime } from './core-service-runtime.js';
import { CoreServicePolicyJournalMonotonicAuthority } from './policy-journal-monotonic-authority.js';

const DEFAULT_POLICY_VERSION = 'PPT-PLATFORM-POLICY-2026-08-04-V1';
const LOCAL_ADMIN_ENDPOINT_ENV = 'PPT_CORE_SERVICE_LOCAL_ADMIN_ENDPOINT';
const LOCAL_ADMIN_TOKEN_ENV = 'PPT_CORE_SERVICE_LOCAL_ADMIN_TOKEN';
const POLICY_SIGNING_KEY_ENV = 'PPT_POLICY_SIGNING_KEY_HEX';
const POLICY_JOURNAL_AUTHORITY_PATH_ENV = 'PPT_POLICY_JOURNAL_AUTHORITY_PATH';

export interface CoreServiceProcessConfiguration {
  readonly localAdminEndpoint: string;
  readonly localAdminToken: string;
  readonly policySigningKey: Buffer;
  readonly policyVersion: string;
  readonly policyJournalAuthorityPath: string;
}

export class CoreServiceProcessConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CoreServiceProcessConfigurationError';
  }
}

const requiredEnvironmentValue = (environment: NodeJS.ProcessEnv, name: string): string => {
  const value = environment[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new CoreServiceProcessConfigurationError(`${name} is required`);
  }
  return value;
};

const validateLocalEndpoint = (endpoint: string, platform: NodeJS.Platform): void => {
  if (endpoint !== endpoint.trim() || /[\0\r\n]/u.test(endpoint)) {
    throw new CoreServiceProcessConfigurationError(`${LOCAL_ADMIN_ENDPOINT_ENV} is invalid`);
  }
  if (platform === 'win32') {
    if (!endpoint.startsWith('\\\\.\\pipe\\') || endpoint.length <= '\\\\.\\pipe\\'.length) {
      throw new CoreServiceProcessConfigurationError(`${LOCAL_ADMIN_ENDPOINT_ENV} must be a local Windows named pipe`);
    }
    return;
  }
  if (!isAbsolute(endpoint)) {
    throw new CoreServiceProcessConfigurationError(`${LOCAL_ADMIN_ENDPOINT_ENV} must be an absolute local socket path`);
  }
};

export const readCoreServiceProcessConfiguration = (
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): CoreServiceProcessConfiguration => {
  const localAdminEndpoint = requiredEnvironmentValue(environment, LOCAL_ADMIN_ENDPOINT_ENV);
  const localAdminToken = requiredEnvironmentValue(environment, LOCAL_ADMIN_TOKEN_ENV);
  const configuredKey = requiredEnvironmentValue(environment, POLICY_SIGNING_KEY_ENV);
  const policyVersion = environment.PPT_POLICY_VERSION ?? DEFAULT_POLICY_VERSION;
  const policyJournalAuthorityPath = requiredEnvironmentValue(environment, POLICY_JOURNAL_AUTHORITY_PATH_ENV);

  validateLocalEndpoint(localAdminEndpoint, platform);
  if (Buffer.byteLength(localAdminToken, 'utf8') < 32) {
    throw new CoreServiceProcessConfigurationError(`${LOCAL_ADMIN_TOKEN_ENV} must contain at least 32 bytes`);
  }
  if (!/^(?:[0-9a-f]{2}){32,}$/iu.test(configuredKey)) {
    throw new CoreServiceProcessConfigurationError(`${POLICY_SIGNING_KEY_ENV} must contain at least 32 bytes of hexadecimal data`);
  }
  if (policyVersion !== policyVersion.trim() || policyVersion.length === 0 || policyVersion.length > 256) {
    throw new CoreServiceProcessConfigurationError('PPT_POLICY_VERSION is invalid');
  }
  if (!isAbsolute(policyJournalAuthorityPath)) {
    throw new CoreServiceProcessConfigurationError(`${POLICY_JOURNAL_AUTHORITY_PATH_ENV} must be an absolute path`);
  }

  return Object.freeze({
    localAdminEndpoint,
    localAdminToken,
    policySigningKey: Buffer.from(configuredKey, 'hex'),
    policyVersion,
    policyJournalAuthorityPath
  });
};

export class CoreServiceProcessHost {
  public readonly runtime: CoreServiceRuntime;
  readonly #server: CoreServiceLocalAdminServer;
  #state: 'created' | 'starting' | 'running' | 'failed' | 'stopping' | 'stopped' = 'created';
  #shutdownRequested = false;
  #startPromise: Promise<void> | undefined;
  #stopPromise: Promise<void> | undefined;

  public constructor(configuration: CoreServiceProcessConfiguration) {
    const kernel = new PlatformPolicyKernel({
      policyVersion: configuration.policyVersion,
      signingKey: configuration.policySigningKey,
      decisionAuthorityId: 'windows-core-service',
      applicationVersions: {
        'windows-desktop': CORE_SERVICE_APPLICATION_API_VERSION,
        'windows-core-service': CORE_SERVICE_APPLICATION_API_VERSION,
        'windows-cluster-agent': 'not-deployed',
        'macos-companion': 'not-deployed',
        'ios-companion': 'not-deployed',
        'ipados-companion': 'not-deployed',
        'watchos-companion': 'not-deployed',
        'visionos-companion': 'not-deployed',
        'ocr-worker': 'not-deployed',
        'ai-worker': 'not-deployed',
        'translation-worker': 'not-deployed',
        'communication-service': 'not-deployed',
        'backup-worker': 'not-deployed',
        'signed-plugin': 'not-deployed'
      },
      deviceCertificateRequiredApplications: [
        'windows-desktop', 'windows-core-service', 'windows-cluster-agent',
        'macos-companion', 'ios-companion', 'ipados-companion', 'watchos-companion',
        'visionos-companion', 'ocr-worker', 'ai-worker', 'translation-worker',
        'communication-service', 'backup-worker', 'signed-plugin'
      ],
      applicationCapabilities: {
        'windows-desktop': ['family.read', 'family.write', 'health.read', 'health.write', 'finance.read', 'finance.write', 'location.read', 'location.share', 'archive.read', 'archive.write'],
        'windows-core-service': ['health.read','health.write','finance.read','finance.write','archive.read','archive.write','archive.ocr','ai.process','translation.process','communication.message','communication.call','communication.record','file.share','backup.create','backup.restore','cluster.admin','plugin.execute'],
        'windows-cluster-agent': [],
        'macos-companion': [],
        'ios-companion': [],
        'ipados-companion': [],
        'watchos-companion': [],
        'visionos-companion': [],
        'ocr-worker': [],
        'ai-worker': [],
        'translation-worker': [],
        'communication-service': [],
        'backup-worker': [],
        'signed-plugin': []
      },
      applicationRuntimeCapabilities: PLATFORM_APPLICATION_RUNTIME_CAPABILITY_REQUIREMENTS,
      consentRequiredCapabilities: ['archive.ocr','ai.process','translation.process','communication.record','location.share'],
      onlineOnlyCapabilities: ['communication.call','communication.record','cluster.admin'],
      writeActions: ['create','update','delete','share','record','administer']
    });
    const capabilityManifestPolicy = new PlatformCapabilityManifestPolicy();
    for (const applicationId of PLATFORM_APPLICATION_IDS) {
      const manifest = kernel.policyPackage.payload.applicationManifests[applicationId];
      if (!manifest) throw new Error(`Core Service signed capability manifest is missing: ${applicationId}`);
      const coverage = capabilityManifestPolicy.evaluateCoverage(applicationId, createPlatformCapabilityManifestAuthority({
        source: 'core-service-kernel',
        policyPackageVerified: kernel.verifyPolicyPackage(kernel.policyPackage),
        policyPackageSha256: kernel.policyPackage.payloadSha256,
        manifest
      }));
      if (!coverage.allowed) {
        throw new Error(`Core Service runtime capability coverage denied: ${applicationId}:${coverage.reason}`);
      }
    }
    const policyJournalMonotonicAuthority = new CoreServicePolicyJournalMonotonicAuthority({
      filePath: configuration.policyJournalAuthorityPath,
      authorityKey: configuration.policySigningKey
    });
    this.runtime = new CoreServiceRuntime({
      policyKernel: kernel,
      policyVersion: configuration.policyVersion,
      policyJournalMonotonicAuthority
    });
    this.#server = new CoreServiceLocalAdminServer({
      endpoint: configuration.localAdminEndpoint,
      authenticationToken: configuration.localAdminToken,
      runtime: this.runtime
    });
  }

  public start(): Promise<void> {
    if (this.#shutdownRequested || this.#state === 'stopping' || this.#state === 'stopped') {
      throw new Error('Core Service process host cannot be started in its current state');
    }
    if (this.#startPromise) return this.#startPromise;
    if (this.#state !== 'created') throw new Error('Core Service process host cannot be started in its current state');
    this.#state = 'starting';
    this.#startPromise = this.#performStart();
    return this.#startPromise;
  }

  public stop(): Promise<void> {
    if (this.#stopPromise) return this.#stopPromise;
    this.#shutdownRequested = true;
    if (this.#state !== 'stopping' && this.#state !== 'stopped') {
      this.#state = 'stopping';
      this.runtime.beginShutdown();
    }
    this.#stopPromise = this.#performStop();
    return this.#stopPromise;
  }

  async #performStart(): Promise<void> {
    try {
      await this.#server.start();
      if (this.#shutdownRequested) return;
      this.runtime.markReady('standalone');
      this.#state = 'running';
    } catch (error) {
      if (!this.#shutdownRequested) {
        this.runtime.enterSafeMode('LOCAL_ADMIN_START_FAILED');
        this.#state = 'failed';
      }
      await this.#server.stop().catch(() => undefined);
      throw error;
    }
  }

  async #performStop(): Promise<void> {
    if (this.#startPromise) await this.#startPromise.catch(() => undefined);
    if (this.#state === 'stopped') return;
    try {
      await this.#server.stop();
      await this.runtime.sealFamilyDataSession();
    } finally {
      this.runtime.finishShutdown();
      this.runtime.dispose();
      this.#state = 'stopped';
    }
  }
}

export const createCoreServiceProcessHost = (
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): CoreServiceProcessHost => new CoreServiceProcessHost(readCoreServiceProcessConfiguration(environment, platform));

export const runCoreServiceProcess = async (): Promise<void> => {
  const host = createCoreServiceProcessHost();
  const instanceId = randomBytes(8).toString('hex');
  interface CoreServiceLogMetadata {
    readonly signal?: string;
    readonly lifecycle?: string;
    readonly role?: string;
    readonly writable?: boolean;
    readonly safeMode?: boolean;
    readonly policyVersion?: string;
    readonly failureCode?: string;
  }
  const logProcessResult = (
    level: LogLevel,
    event: string,
    metadata: CoreServiceLogMetadata,
    stream: 'stdout' | 'stderr' = 'stdout'
  ): void => {
    writeContentFreeConsoleEvent({
      timestamp: asIsoDateTime(new Date().toISOString()),
      level,
      service: 'core-service',
      process: 'service-host',
      event,
      correlationId: asCorrelationId(`core-service-${instanceId}`),
      outcome: level === 'error' ? 'failure' : 'success',
      metadata: {
        instanceId,
        signal: metadata.signal,
        lifecycle: metadata.lifecycle,
        role: metadata.role,
        writable: metadata.writable,
        safeMode: metadata.safeMode,
        policyVersion: metadata.policyVersion,
        failureCode: metadata.failureCode
      }
    }, stream);
  };
  const healthMetadata = (): CoreServiceLogMetadata => {
    const health = host.runtime.health();
    return Object.freeze({
      lifecycle: health.lifecycle,
      role: health.role,
      writable: health.writable,
      safeMode: health.safeMode,
      policyVersion: health.policyVersion
    });
  };
  let shutdownPromise: Promise<void> | undefined;

  const requestShutdown = (signal: 'SIGINT' | 'SIGTERM'): void => {
    if (shutdownPromise) return;
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
    shutdownPromise = (async () => {
      const stopping = host.stop();
      logProcessResult('info', 'core-service.stopping', { signal, ...healthMetadata() });
      await stopping;
      logProcessResult('info', 'core-service.stopped', healthMetadata());
      process.exitCode = 0;
    })().catch(() => {
      logProcessResult('error', 'core-service.shutdown_failed', { failureCode: 'SHUTDOWN_FAILED' }, 'stderr');
      process.exitCode = 1;
    });
  };
  const onSigint = (): void => requestShutdown('SIGINT');
  const onSigterm = (): void => requestShutdown('SIGTERM');

  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  try {
    await host.start();
    if (!shutdownPromise) {
      logProcessResult('info', 'core-service.ready', healthMetadata());
    } else {
      await shutdownPromise;
    }
  } catch (error) {
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
    await host.stop().catch(() => undefined);
    throw error;
  }
};

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) {
  void runCoreServiceProcess().catch((error: unknown) => {
    const configurationFailure = error instanceof CoreServiceProcessConfigurationError;
    writeContentFreeConsoleEvent({
      timestamp: asIsoDateTime(new Date().toISOString()),
      level: 'error',
      service: 'core-service',
      process: 'service-host',
      event: 'core-service.startup_failed',
      correlationId: asCorrelationId('core-service-startup'),
      outcome: 'failure',
      metadata: { failureCode: configurationFailure ? 'CONFIGURATION_INVALID' : 'STARTUP_FAILED' }
    }, 'stderr');
    process.exitCode = configurationFailure ? 78 : 1;
  });
}
