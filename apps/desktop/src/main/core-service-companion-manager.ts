import { randomBytes, timingSafeEqual } from 'node:crypto';
import { isAbsolute } from 'node:path';
import {
  CORE_SERVICE_COMPANION_BOOTSTRAP_KIND,
  CORE_SERVICE_COMPANION_FAILURE_KIND,
  CORE_SERVICE_COMPANION_READY_KIND,
  CORE_SERVICE_COMPANION_SHUTDOWN_KIND,
  CORE_SERVICE_DEFAULT_POLICY_VERSION
} from '@ppt/core-service-contracts';

const PROVISIONING_SCHEMA_VERSION = 1;
const PROVISIONING_KIND = 'core-service-device-provisioning';
const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{43}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

export interface CoreServiceCompanionProtectedStore {
  readText(path: string): string;
  writeText(path: string, kind: string, text: string): {
    readonly filePath: string;
    readonly sha256: string;
    readonly sizeBytes: number;
  };
}

interface CoreServiceDeviceProvisioningRecord {
  readonly schemaVersion: 1;
  readonly kind: typeof PROVISIONING_KIND;
  readonly policySigningKeyBase64Url: string;
  readonly createdAt: string;
}

export interface CoreServiceCompanionProcessLike {
  on(event: 'spawn', listener: () => void): this;
  on(event: 'message', listener: (message: unknown) => void): this;
  on(event: 'exit', listener: (code: number) => void): this;
  on(event: 'error', listener: (type: string, location: string, report: string) => void): this;
  postMessage(message: unknown): void;
  kill(): boolean;
  readonly pid: number | undefined;
}

export interface CoreServiceCompanionForkOptions {
  readonly env: NodeJS.ProcessEnv;
  readonly execArgv: readonly string[];
  readonly stdio: 'ignore';
  readonly serviceName: string;
}

export interface CoreServiceCompanionManagerOptions {
  readonly modulePath: string;
  readonly authorityPath: string;
  readonly provisioningPath: string;
  readonly policyJournalAuthorityPath: string;
  readonly protectedStore: CoreServiceCompanionProtectedStore;
  readonly platform?: NodeJS.Platform;
  readonly clock?: () => string;
  readonly startupTimeoutMs?: number;
  readonly fork: (modulePath: string, options: CoreServiceCompanionForkOptions) => CoreServiceCompanionProcessLike;
}

const exactKeys = (value: object, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
};

const isMissingFileError = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');

const parseProvisioningRecord = (raw: string): { readonly record: CoreServiceDeviceProvisioningRecord; readonly key: Buffer } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error('CORE_SERVICE_PROVISIONING_INVALID', { cause: error });
  }
  if (!parsed || typeof parsed !== 'object' || !exactKeys(parsed, [
    'schemaVersion', 'kind', 'policySigningKeyBase64Url', 'createdAt'
  ])) throw new Error('CORE_SERVICE_PROVISIONING_INVALID');
  const provisioning = parsed as Partial<CoreServiceDeviceProvisioningRecord>;
  if (
    provisioning.schemaVersion !== PROVISIONING_SCHEMA_VERSION
    || provisioning.kind !== PROVISIONING_KIND
    || typeof provisioning.policySigningKeyBase64Url !== 'string'
    || !BASE64URL_32_BYTES.test(provisioning.policySigningKeyBase64Url)
    || typeof provisioning.createdAt !== 'string'
    || !Number.isFinite(Date.parse(provisioning.createdAt))
  ) throw new Error('CORE_SERVICE_PROVISIONING_INVALID');
  const key = Buffer.from(provisioning.policySigningKeyBase64Url, 'base64url');
  if (key.byteLength !== 32 || key.toString('base64url') !== provisioning.policySigningKeyBase64Url) {
    key.fill(0);
    throw new Error('CORE_SERVICE_PROVISIONING_INVALID');
  }
  return Object.freeze({ record: provisioning as CoreServiceDeviceProvisioningRecord, key });
};

const sanitizedUtilityEnvironment = (): NodeJS.ProcessEnv => {
  const environment: NodeJS.ProcessEnv = { PPT_CORE_SERVICE_COMPANION: '1' };
  for (const name of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP']) {
    const value = process.env[name];
    if (value) environment[name] = value;
  }
  return environment;
};

export class CoreServiceCompanionManager {
  readonly #platform: NodeJS.Platform;
  readonly #clock: () => string;
  readonly #startupTimeoutMs: number;
  readonly #fork: NonNullable<CoreServiceCompanionManagerOptions['fork']>;
  #process: CoreServiceCompanionProcessLike | undefined;
  #stopping = false;

  public constructor(private readonly options: CoreServiceCompanionManagerOptions) {
    this.#platform = options.platform ?? process.platform;
    this.#clock = options.clock ?? (() => new Date().toISOString());
    this.#startupTimeoutMs = options.startupTimeoutMs ?? 15_000;
    this.#fork = options.fork;
    if (
      this.#platform !== 'win32'
      || !isAbsolute(options.modulePath)
      || !isAbsolute(options.authorityPath)
      || !isAbsolute(options.provisioningPath)
      || !isAbsolute(options.policyJournalAuthorityPath)
      || typeof options.fork !== 'function'
      || !Number.isSafeInteger(this.#startupTimeoutMs)
      || this.#startupTimeoutMs < 1_000
      || this.#startupTimeoutMs > 60_000
    ) throw new Error('CORE_SERVICE_COMPANION_OPTIONS_INVALID');
  }

  public async start(): Promise<{ readonly authorityPath: string; readonly pid: number }> {
    if (this.#process) throw new Error('CORE_SERVICE_COMPANION_ALREADY_STARTED');
    const policySigningKey = this.#loadOrCreatePolicySigningKey();
    const endpoint = `\\\\.\\pipe\\ppt-core-service-${randomBytes(16).toString('hex')}`;
    const authenticationToken = randomBytes(48).toString('base64url');
    const issuedAt = this.#clock();
    if (!Number.isFinite(Date.parse(issuedAt))) {
      policySigningKey.fill(0);
      throw new Error('CORE_SERVICE_COMPANION_CLOCK_INVALID');
    }
    const authority = Object.freeze({
      schemaVersion: 1 as const,
      endpoint,
      authenticationToken,
      expectedPolicyVersion: CORE_SERVICE_DEFAULT_POLICY_VERSION,
      issuedAt
    });
    const authorityWrite = this.options.protectedStore.writeText(
      this.options.authorityPath,
      'core-service-connection-authority',
      `${JSON.stringify(authority)}\n`
    );
    if (!SHA256.test(authorityWrite.sha256) || authorityWrite.filePath !== this.options.authorityPath) {
      policySigningKey.fill(0);
      throw new Error('CORE_SERVICE_CONNECTION_AUTHORITY_WRITE_FAILED');
    }
    const authorityReadback = this.options.protectedStore.readText(this.options.authorityPath);
    if (authorityReadback !== `${JSON.stringify(authority)}\n`) {
      policySigningKey.fill(0);
      throw new Error('CORE_SERVICE_CONNECTION_AUTHORITY_READBACK_FAILED');
    }

    const child = this.#fork(this.options.modulePath, {
      env: sanitizedUtilityEnvironment(),
      execArgv: [],
      stdio: 'ignore',
      serviceName: 'Anadolu Parsı Core Service'
    });
    this.#process = child;
    return await new Promise((resolve, reject) => {
      let settled = false;
      const finishFailure = (error: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        policySigningKey.fill(0);
        child.kill();
        this.#process = undefined;
        reject(error);
      };
      const timer = setTimeout(() => finishFailure(new Error('CORE_SERVICE_COMPANION_START_TIMEOUT')), this.#startupTimeoutMs);
      child.on('error', () => finishFailure(new Error('CORE_SERVICE_COMPANION_PROCESS_ERROR')));
      child.on('exit', (code) => {
        if (!settled) finishFailure(new Error(`CORE_SERVICE_COMPANION_EXITED:${String(code)}`));
        else if (!this.#stopping) this.#process = undefined;
      });
      child.on('message', (message) => {
        if (!message || typeof message !== 'object') return;
        if (
          exactKeys(message, ['schemaVersion', 'kind', 'code'])
          && (message as { schemaVersion?: unknown }).schemaVersion === 1
          && (message as { kind?: unknown }).kind === CORE_SERVICE_COMPANION_FAILURE_KIND
        ) {
          finishFailure(new Error(`CORE_SERVICE_COMPANION_REJECTED:${String((message as { code?: unknown }).code)}`));
          return;
        }
        if (
          !exactKeys(message, ['schemaVersion', 'kind', 'lifecycle', 'policyVersion', 'writable', 'safeMode'])
          || (message as { schemaVersion?: unknown }).schemaVersion !== 1
          || (message as { kind?: unknown }).kind !== CORE_SERVICE_COMPANION_READY_KIND
          || (message as { lifecycle?: unknown }).lifecycle !== 'ready'
          || (message as { policyVersion?: unknown }).policyVersion !== CORE_SERVICE_DEFAULT_POLICY_VERSION
          || typeof (message as { writable?: unknown }).writable !== 'boolean'
          || typeof (message as { safeMode?: unknown }).safeMode !== 'boolean'
        ) return;
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        policySigningKey.fill(0);
        const pid = child.pid;
        if (!Number.isSafeInteger(pid) || Number(pid) < 1) {
          child.kill();
          this.#process = undefined;
          reject(new Error('CORE_SERVICE_COMPANION_PID_INVALID'));
          return;
        }
        resolve(Object.freeze({ authorityPath: this.options.authorityPath, pid: Number(pid) }));
      });
      child.on('spawn', () => {
        try {
          child.postMessage(Object.freeze({
            schemaVersion: 1,
            kind: CORE_SERVICE_COMPANION_BOOTSTRAP_KIND,
            configuration: Object.freeze({
              localAdminEndpoint: endpoint,
              localAdminToken: authenticationToken,
              policySigningKey: new Uint8Array(policySigningKey),
              policyVersion: CORE_SERVICE_DEFAULT_POLICY_VERSION,
              policyJournalAuthorityPath: this.options.policyJournalAuthorityPath
            })
          }));
        } catch {
          finishFailure(new Error('CORE_SERVICE_COMPANION_BOOTSTRAP_SEND_FAILED'));
        }
      });
    });
  }

  public dispose(): void {
    if (this.#stopping) return;
    this.#stopping = true;
    const child = this.#process;
    this.#process = undefined;
    if (!child) return;
    try {
      child.postMessage(Object.freeze({ schemaVersion: 1, kind: CORE_SERVICE_COMPANION_SHUTDOWN_KIND }));
    } catch {
      child.kill();
      return;
    }
    const timer = setTimeout(() => child.kill(), 2_000);
    timer.unref();
  }

  #loadOrCreatePolicySigningKey(): Buffer {
    try {
      return parseProvisioningRecord(this.options.protectedStore.readText(this.options.provisioningPath)).key;
    } catch (error) {
      if (!isMissingFileError(error)) throw error;
    }
    const key = randomBytes(32);
    const provisioning: CoreServiceDeviceProvisioningRecord = Object.freeze({
      schemaVersion: PROVISIONING_SCHEMA_VERSION,
      kind: PROVISIONING_KIND,
      policySigningKeyBase64Url: key.toString('base64url'),
      createdAt: this.#clock()
    });
    if (!Number.isFinite(Date.parse(provisioning.createdAt))) {
      key.fill(0);
      throw new Error('CORE_SERVICE_COMPANION_CLOCK_INVALID');
    }
    this.options.protectedStore.writeText(
      this.options.provisioningPath,
      PROVISIONING_KIND,
      `${JSON.stringify(provisioning)}\n`
    );
    const readback = parseProvisioningRecord(this.options.protectedStore.readText(this.options.provisioningPath));
    const equal = readback.key.byteLength === key.byteLength && timingSafeEqual(readback.key, key);
    readback.key.fill(0);
    if (!equal) {
      key.fill(0);
      throw new Error('CORE_SERVICE_PROVISIONING_READBACK_FAILED');
    }
    return key;
  }
}
