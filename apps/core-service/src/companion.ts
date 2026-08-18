import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CORE_SERVICE_COMPANION_BOOTSTRAP_KIND,
  CORE_SERVICE_COMPANION_FAILURE_KIND,
  CORE_SERVICE_COMPANION_READY_KIND,
  CORE_SERVICE_COMPANION_SHUTDOWN_KIND,
  CORE_SERVICE_DEFAULT_POLICY_VERSION
} from '@ppt/core-service-contracts';
import { CoreServiceProcessHost, type CoreServiceProcessConfiguration } from './main.js';

interface ParentPortMessageEventLike {
  readonly data: unknown;
}

export interface CoreServiceCompanionParentPort {
  on(event: 'message', listener: (event: ParentPortMessageEventLike) => void): this;
  postMessage(message: unknown): void;
}

interface CoreServiceCompanionBootstrapMessage {
  readonly schemaVersion: 1;
  readonly kind: typeof CORE_SERVICE_COMPANION_BOOTSTRAP_KIND;
  readonly configuration: {
    readonly localAdminEndpoint: string;
    readonly localAdminToken: string;
    readonly policySigningKey: Uint8Array;
    readonly policyVersion: typeof CORE_SERVICE_DEFAULT_POLICY_VERSION;
    readonly policyJournalAuthorityPath: string;
  };
}

const exactKeys = (value: object, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
};

const isCanonicalWindowsPipe = (value: string): boolean =>
  value.startsWith('\\\\.\\pipe\\ppt-core-service-')
  && value.length <= 240
  && !/[\0\r\n]/u.test(value)
  && value === value.trim();

export const parseCoreServiceCompanionBootstrap = (
  value: unknown,
  platform: NodeJS.Platform = process.platform
): CoreServiceProcessConfiguration => {
  if (!value || typeof value !== 'object' || !exactKeys(value, ['schemaVersion', 'kind', 'configuration'])) {
    throw new Error('CORE_SERVICE_COMPANION_BOOTSTRAP_INVALID');
  }
  const message = value as Partial<CoreServiceCompanionBootstrapMessage>;
  const configuration = message.configuration;
  if (
    message.schemaVersion !== 1
    || message.kind !== CORE_SERVICE_COMPANION_BOOTSTRAP_KIND
    || !configuration
    || typeof configuration !== 'object'
    || !exactKeys(configuration, [
      'localAdminEndpoint', 'localAdminToken', 'policySigningKey',
      'policyVersion', 'policyJournalAuthorityPath'
    ])
    || typeof configuration.localAdminEndpoint !== 'string'
    || (platform === 'win32'
      ? !isCanonicalWindowsPipe(configuration.localAdminEndpoint)
      : !isAbsolute(configuration.localAdminEndpoint))
    || typeof configuration.localAdminToken !== 'string'
    || Buffer.byteLength(configuration.localAdminToken, 'utf8') < 32
    || Buffer.byteLength(configuration.localAdminToken, 'utf8') > 128
    || !(configuration.policySigningKey instanceof Uint8Array)
    || configuration.policySigningKey.byteLength !== 32
    || configuration.policyVersion !== CORE_SERVICE_DEFAULT_POLICY_VERSION
    || typeof configuration.policyJournalAuthorityPath !== 'string'
    || !isAbsolute(configuration.policyJournalAuthorityPath)
  ) {
    throw new Error('CORE_SERVICE_COMPANION_BOOTSTRAP_INVALID');
  }
  return Object.freeze({
    localAdminEndpoint: configuration.localAdminEndpoint,
    localAdminToken: configuration.localAdminToken,
    policySigningKey: Buffer.from(configuration.policySigningKey),
    policyVersion: configuration.policyVersion,
    policyJournalAuthorityPath: configuration.policyJournalAuthorityPath
  });
};

export class CoreServiceCompanionProcess {
  #host: CoreServiceProcessHost | undefined;
  #started = false;
  #stopping = false;
  readonly #bootstrapTimer: NodeJS.Timeout;

  public constructor(
    private readonly parentPort: CoreServiceCompanionParentPort,
    private readonly platform: NodeJS.Platform = process.platform,
    bootstrapTimeoutMs = 15_000
  ) {
    if (!Number.isSafeInteger(bootstrapTimeoutMs) || bootstrapTimeoutMs < 1_000 || bootstrapTimeoutMs > 60_000) {
      throw new Error('CORE_SERVICE_COMPANION_BOOTSTRAP_TIMEOUT_INVALID');
    }
    this.parentPort.on('message', (event) => this.#onMessage(event.data));
    this.#bootstrapTimer = setTimeout(() => {
      if (!this.#started) this.#fail('BOOTSTRAP_TIMEOUT');
    }, bootstrapTimeoutMs);
    this.#bootstrapTimer.unref();
  }

  async #onMessage(message: unknown): Promise<void> {
    if (
      message && typeof message === 'object'
      && exactKeys(message, ['schemaVersion', 'kind'])
      && (message as { schemaVersion?: unknown }).schemaVersion === 1
      && (message as { kind?: unknown }).kind === CORE_SERVICE_COMPANION_SHUTDOWN_KIND
    ) {
      await this.#stop();
      return;
    }
    if (this.#started || this.#stopping) {
      this.#fail('BOOTSTRAP_REPLAY');
      return;
    }
    let configuration: CoreServiceProcessConfiguration;
    try {
      configuration = parseCoreServiceCompanionBootstrap(message, this.platform);
    } catch {
      this.#fail('BOOTSTRAP_INVALID');
      return;
    }
    this.#started = true;
    clearTimeout(this.#bootstrapTimer);
    try {
      this.#host = new CoreServiceProcessHost(configuration);
      configuration.policySigningKey.fill(0);
      await this.#host.start();
      const health = this.#host.runtime.health();
      this.parentPort.postMessage(Object.freeze({
        schemaVersion: 1,
        kind: CORE_SERVICE_COMPANION_READY_KIND,
        lifecycle: health.lifecycle,
        policyVersion: health.policyVersion,
        writable: health.writable,
        safeMode: health.safeMode
      }));
    } catch {
      configuration.policySigningKey.fill(0);
      this.#fail('START_FAILED');
    }
  }

  async #stop(): Promise<void> {
    if (this.#stopping) return;
    this.#stopping = true;
    clearTimeout(this.#bootstrapTimer);
    try {
      await this.#host?.stop();
    } finally {
      this.#host = undefined;
      process.exitCode = 0;
    }
  }

  #fail(code: 'BOOTSTRAP_TIMEOUT' | 'BOOTSTRAP_REPLAY' | 'BOOTSTRAP_INVALID' | 'START_FAILED'): void {
    clearTimeout(this.#bootstrapTimer);
    try {
      this.parentPort.postMessage(Object.freeze({
        schemaVersion: 1,
        kind: CORE_SERVICE_COMPANION_FAILURE_KIND,
        code
      }));
    } finally {
      void this.#stop().finally(() => { process.exitCode = 1; });
    }
  }
}

export const runCoreServiceCompanionProcess = (): CoreServiceCompanionProcess => {
  const processWithParentPort = process as NodeJS.Process & { parentPort?: CoreServiceCompanionParentPort | null };
  if (!processWithParentPort.parentPort) throw new Error('CORE_SERVICE_COMPANION_PARENT_PORT_UNAVAILABLE');
  return new CoreServiceCompanionProcess(processWithParentPort.parentPort);
};

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) {
  try {
    runCoreServiceCompanionProcess();
  } catch {
    process.exitCode = 1;
  }
}
