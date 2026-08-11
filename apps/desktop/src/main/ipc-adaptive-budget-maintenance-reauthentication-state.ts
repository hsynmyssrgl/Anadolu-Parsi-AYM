import { createHash, randomBytes, randomFillSync, timingSafeEqual } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { DeviceSecretProtector } from './device-secret-protector.js';

export interface IpcAdaptiveBudgetMaintenanceReauthenticationDurableAttempt {
  readonly contextKey: string;
  readonly failedAttempts: number;
  readonly firstFailureAt: number;
  readonly lastFailureAt: number;
  readonly lockedUntil?: number;
}

export interface IpcAdaptiveBudgetMaintenanceReauthenticationDurableSnapshot {
  readonly schemaVersion: 1;
  readonly recoveryHoldUntil?: number;
  readonly attempts: readonly IpcAdaptiveBudgetMaintenanceReauthenticationDurableAttempt[];
}

export type IpcAdaptiveBudgetMaintenanceReauthenticationRestoreStatus =
  | 'MISSING'
  | 'RESTORED'
  | 'REJECTED'
  | 'UNAVAILABLE';

export type IpcAdaptiveBudgetMaintenanceReauthenticationRestoreClassification =
  | 'STATE_FILE_MISSING'
  | 'STATE_RESTORED'
  | 'LEGACY_STATE_RESTORED'
  | 'PROTECTION_UNAVAILABLE'
  | 'PROTECTION_PROVIDER_CHANGED'
  | 'DEVICE_BINDING_CHANGED'
  | 'DECRYPTION_FAILED'
  | 'PAYLOAD_INTEGRITY_FAILED'
  | 'STATE_SCHEMA_INVALID'
  | 'STATE_FILE_INVALID';

export interface IpcAdaptiveBudgetMaintenanceReauthenticationRestoreResult {
  readonly status: IpcAdaptiveBudgetMaintenanceReauthenticationRestoreStatus;
  readonly reason: string;
  readonly classification: IpcAdaptiveBudgetMaintenanceReauthenticationRestoreClassification;
  readonly snapshot?: IpcAdaptiveBudgetMaintenanceReauthenticationDurableSnapshot;
  readonly quarantinePath?: string;
  readonly requiresRewrite?: boolean;
}

export interface IpcAdaptiveBudgetMaintenanceReauthenticationPersistence {
  load(now?: number): IpcAdaptiveBudgetMaintenanceReauthenticationRestoreResult;
  save(snapshot: IpcAdaptiveBudgetMaintenanceReauthenticationDurableSnapshot, now?: number): void;
  clear(): void;
}

export interface IpcAdaptiveBudgetMaintenanceReauthenticationStateStoreOptions {
  readonly directoryPath: string;
  readonly applicationVersion: string;
  readonly protector: () => DeviceSecretProtector;
  readonly deviceBinding?: () => string;
  readonly maximumTrackedContexts?: number;
  readonly maximumFileBytes?: number;
  readonly maximumQuarantineFiles?: number;
}

interface ProtectedStateEnvelopeV1 {
  readonly schemaVersion: 1;
  readonly protectionId: string;
  readonly writerVersion: string;
  readonly persistedAt: string;
  readonly payloadSha256: string;
  readonly protectedPayload: string;
}

interface ProtectedStateEnvelopeV2 {
  readonly schemaVersion: 2;
  readonly protection: {
    readonly id: string;
    readonly encoding: 'base64';
    readonly deviceBindingSha256: string;
  };
  readonly writerVersion: string;
  readonly persistedAt: string;
  readonly payloadSha256: string;
  readonly protectedPayload: string;
}

type ProtectedStateEnvelope = ProtectedStateEnvelopeV1 | ProtectedStateEnvelopeV2;

class StateRestoreError extends Error {
  constructor(
    public readonly classification: Exclude<
      IpcAdaptiveBudgetMaintenanceReauthenticationRestoreClassification,
      'STATE_FILE_MISSING' | 'STATE_RESTORED' | 'LEGACY_STATE_RESTORED' | 'PROTECTION_UNAVAILABLE'
    >,
    message: string
  ) {
    super(message);
  }
}

const CONTEXT_KEY_PATTERN = /^[a-f0-9]{64}$/u;
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/u;
const DEFAULT_MAXIMUM_TRACKED_CONTEXTS = 256;
const DEFAULT_MAXIMUM_FILE_BYTES = 524_288;
const DEFAULT_MAXIMUM_QUARANTINE_FILES = 4;
const MAXIMUM_TIMESTAMP = 8_640_000_000_000_000;
const SECURE_ERASE_CHUNK_BYTES = 65_536;
const UNBOUND_DEVICE_BINDING = createHash('sha256').update('ppt-local-unbound-device-binding-v1', 'utf8').digest('hex');

const positiveInteger = (value: number | undefined, fallback: number): number =>
  Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const sameHash = (left: string, right: string): boolean => {
  if (!HASH_PATTERN.test(left) || !HASH_PATTERN.test(right)) return false;
  const leftBytes = Buffer.from(left, 'hex');
  const rightBytes = Buffer.from(right, 'hex');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
};

const exactKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...allowed].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const finiteTimestamp = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0 && Number(value) <= MAXIMUM_TIMESTAMP;

const validAttempt = (value: unknown, maximumFailedAttempts = 1_000): value is IpcAdaptiveBudgetMaintenanceReauthenticationDurableAttempt => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const attempt = value as Record<string, unknown>;
  const allowed = attempt.lockedUntil === undefined
    ? ['contextKey', 'failedAttempts', 'firstFailureAt', 'lastFailureAt']
    : ['contextKey', 'failedAttempts', 'firstFailureAt', 'lastFailureAt', 'lockedUntil'];
  if (!exactKeys(attempt, allowed)) return false;
  if (typeof attempt.contextKey !== 'string' || !CONTEXT_KEY_PATTERN.test(attempt.contextKey)) return false;
  if (!Number.isInteger(attempt.failedAttempts) || Number(attempt.failedAttempts) < 1 || Number(attempt.failedAttempts) > maximumFailedAttempts) return false;
  if (!finiteTimestamp(attempt.firstFailureAt) || !finiteTimestamp(attempt.lastFailureAt)) return false;
  if (Number(attempt.firstFailureAt) > Number(attempt.lastFailureAt)) return false;
  if (attempt.lockedUntil !== undefined && (!finiteTimestamp(attempt.lockedUntil) || Number(attempt.lockedUntil) <= Number(attempt.lastFailureAt))) return false;
  return true;
};

const validSnapshot = (
  value: unknown,
  maximumTrackedContexts: number
): value is IpcAdaptiveBudgetMaintenanceReauthenticationDurableSnapshot => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  const allowed = snapshot.recoveryHoldUntil === undefined
    ? ['schemaVersion', 'attempts']
    : ['schemaVersion', 'recoveryHoldUntil', 'attempts'];
  if (!exactKeys(snapshot, allowed) || snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.attempts)) return false;
  if (snapshot.attempts.length > maximumTrackedContexts) return false;
  if (snapshot.recoveryHoldUntil !== undefined && !finiteTimestamp(snapshot.recoveryHoldUntil)) return false;
  const keys = new Set<string>();
  for (const attempt of snapshot.attempts) {
    if (!validAttempt(attempt)) return false;
    if (keys.has(attempt.contextKey)) return false;
    keys.add(attempt.contextKey);
  }
  return true;
};

const validCommonEnvelopeFields = (envelope: Record<string, unknown>): boolean =>
  typeof envelope.writerVersion === 'string'
  && envelope.writerVersion.length >= 3
  && envelope.writerVersion.length <= 64
  && typeof envelope.persistedAt === 'string'
  && Number.isFinite(Date.parse(envelope.persistedAt))
  && typeof envelope.payloadSha256 === 'string'
  && HASH_PATTERN.test(envelope.payloadSha256)
  && typeof envelope.protectedPayload === 'string'
  && envelope.protectedPayload.length >= 4
  && envelope.protectedPayload.length % 4 === 0
  && BASE64_PATTERN.test(envelope.protectedPayload);

const validEnvelopeV1 = (value: unknown): value is ProtectedStateEnvelopeV1 => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const envelope = value as Record<string, unknown>;
  if (!exactKeys(envelope, ['schemaVersion', 'protectionId', 'writerVersion', 'persistedAt', 'payloadSha256', 'protectedPayload'])) return false;
  return envelope.schemaVersion === 1
    && typeof envelope.protectionId === 'string'
    && envelope.protectionId.length >= 3
    && envelope.protectionId.length <= 128
    && validCommonEnvelopeFields(envelope);
};

const validEnvelopeV2 = (value: unknown): value is ProtectedStateEnvelopeV2 => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const envelope = value as Record<string, unknown>;
  if (!exactKeys(envelope, ['schemaVersion', 'protection', 'writerVersion', 'persistedAt', 'payloadSha256', 'protectedPayload'])) return false;
  if (envelope.schemaVersion !== 2 || !envelope.protection || typeof envelope.protection !== 'object' || Array.isArray(envelope.protection)) return false;
  const protection = envelope.protection as Record<string, unknown>;
  return exactKeys(protection, ['id', 'encoding', 'deviceBindingSha256'])
    && typeof protection.id === 'string'
    && protection.id.length >= 3
    && protection.id.length <= 128
    && protection.encoding === 'base64'
    && typeof protection.deviceBindingSha256 === 'string'
    && HASH_PATTERN.test(protection.deviceBindingSha256)
    && validCommonEnvelopeFields(envelope);
};

const writeAtomicJson = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporaryPath, 'wx', 0o600);
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    try { chmodSync(temporaryPath, 0o600); } catch { /* Windows ACL ve DPAPI üst katmandadır. */ }
    renameSync(temporaryPath, path);
    try { chmodSync(path, 0o600); } catch { /* Windows ACL ve DPAPI üst katmandadır. */ }
  } catch (error) {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* en iyi çaba */ }
    }
    rmSync(temporaryPath, { force: true });
    throw error;
  }
};

const secureEraseFile = (path: string, maximumBytes: number): void => {
  if (!existsSync(path)) return;
  let descriptor: number | undefined;
  try {
    const size = statSync(path).size;
    if (size > 0 && size <= maximumBytes) {
      descriptor = openSync(path, 'r+');
      const chunk = Buffer.alloc(Math.min(SECURE_ERASE_CHUNK_BYTES, Math.max(1, size)));
      let offset = 0;
      while (offset < size) {
        const length = Math.min(chunk.length, size - offset);
        randomFillSync(chunk, 0, length);
        writeSync(descriptor, chunk, 0, length, offset);
        offset += length;
      }
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = undefined;
    }
  } catch {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* en iyi çaba */ }
    }
  } finally {
    try { rmSync(path, { force: true }); } catch { /* en iyi çaba */ }
  }
};

export class IpcAdaptiveBudgetMaintenanceReauthenticationStateStore implements IpcAdaptiveBudgetMaintenanceReauthenticationPersistence {
  readonly #statePath: string;
  readonly #quarantineDirectoryPath: string;
  readonly #applicationVersion: string;
  readonly #protector: () => DeviceSecretProtector;
  readonly #deviceBinding: () => string;
  readonly #maximumTrackedContexts: number;
  readonly #maximumFileBytes: number;
  readonly #maximumQuarantineFiles: number;

  constructor(options: IpcAdaptiveBudgetMaintenanceReauthenticationStateStoreOptions) {
    if (!options.directoryPath || !options.applicationVersion || typeof options.protector !== 'function') {
      throw new Error('Bakım yeniden doğrulama durum deposu seçenekleri geçersiz.');
    }
    this.#statePath = join(options.directoryPath, 'ipc-adaptive-budget-maintenance-reauthentication.json');
    this.#quarantineDirectoryPath = join(options.directoryPath, 'quarantine');
    this.#applicationVersion = options.applicationVersion;
    this.#protector = options.protector;
    this.#deviceBinding = options.deviceBinding ?? (() => UNBOUND_DEVICE_BINDING);
    this.#maximumTrackedContexts = Math.max(1, Math.min(positiveInteger(options.maximumTrackedContexts, DEFAULT_MAXIMUM_TRACKED_CONTEXTS), 4_096));
    this.#maximumFileBytes = Math.max(4_096, Math.min(positiveInteger(options.maximumFileBytes, DEFAULT_MAXIMUM_FILE_BYTES), 4_194_304));
    this.#maximumQuarantineFiles = Math.max(1, Math.min(positiveInteger(options.maximumQuarantineFiles, DEFAULT_MAXIMUM_QUARANTINE_FILES), 32));
    this.#pruneQuarantine();
  }

  load(_now = Date.now()): IpcAdaptiveBudgetMaintenanceReauthenticationRestoreResult {
    if (!existsSync(this.#statePath)) {
      return Object.freeze({ status: 'MISSING', reason: 'STATE_FILE_MISSING', classification: 'STATE_FILE_MISSING' });
    }
    let parsed: ProtectedStateEnvelope;
    try {
      const fileSize = statSync(this.#statePath).size;
      if (fileSize <= 0 || fileSize > this.#maximumFileBytes) {
        throw new StateRestoreError('STATE_FILE_INVALID', 'Korunan durum dosyası boyut sınırını aşıyor.');
      }
      const candidate = JSON.parse(readFileSync(this.#statePath, 'utf8')) as unknown;
      if (validEnvelopeV2(candidate) || validEnvelopeV1(candidate)) parsed = candidate;
      else throw new StateRestoreError('STATE_SCHEMA_INVALID', 'Korunan durum zarfı şeması geçersiz.');
    } catch (error) {
      return this.#reject(error);
    }

    const protector = this.#protector();
    if (!protector.isAvailable()) {
      return Object.freeze({
        status: 'UNAVAILABLE',
        reason: 'OS_PROTECTION_TEMPORARILY_UNAVAILABLE',
        classification: 'PROTECTION_UNAVAILABLE'
      });
    }

    try {
      const protectionId = parsed.schemaVersion === 1 ? parsed.protectionId : parsed.protection.id;
      if (protectionId !== protector.protectionId) {
        throw new StateRestoreError('PROTECTION_PROVIDER_CHANGED', 'Korunan durum farklı bir sır koruma sağlayıcısına ait.');
      }
      if (parsed.schemaVersion === 2 && !sameHash(parsed.protection.deviceBindingSha256, this.#resolveDeviceBinding())) {
        throw new StateRestoreError('DEVICE_BINDING_CHANGED', 'Korunan durum farklı bir cihaz kimliğine bağlı.');
      }
      let payload: string;
      try {
        payload = protector.unprotect(parsed.protectedPayload);
      } catch {
        throw new StateRestoreError('DECRYPTION_FAILED', 'Korunan durum işletim sistemi korumasıyla açılamadı.');
      }
      if (!sameHash(sha256(payload), parsed.payloadSha256)) {
        throw new StateRestoreError('PAYLOAD_INTEGRITY_FAILED', 'Korunan durum payload bütünlüğü doğrulanamadı.');
      }
      let snapshot: unknown;
      try {
        snapshot = JSON.parse(payload);
      } catch {
        throw new StateRestoreError('STATE_SCHEMA_INVALID', 'Bakım yeniden doğrulama payload JSON biçimi geçersiz.');
      }
      if (!validSnapshot(snapshot, this.#maximumTrackedContexts)) {
        throw new StateRestoreError('STATE_SCHEMA_INVALID', 'Bakım yeniden doğrulama durum şeması geçersiz.');
      }
      const legacy = parsed.schemaVersion === 1;
      return Object.freeze({
        status: 'RESTORED',
        reason: legacy ? 'LEGACY_OS_PROTECTED_STATE_RESTORED' : 'OS_PROTECTED_DEVICE_BOUND_STATE_RESTORED',
        classification: legacy ? 'LEGACY_STATE_RESTORED' : 'STATE_RESTORED',
        snapshot,
        ...(legacy ? { requiresRewrite: true } : {})
      });
    } catch (error) {
      return this.#reject(error);
    }
  }

  save(snapshot: IpcAdaptiveBudgetMaintenanceReauthenticationDurableSnapshot, now = Date.now()): void {
    if (!validSnapshot(snapshot, this.#maximumTrackedContexts)) throw new Error('Kaydedilecek bakım yeniden doğrulama durumu geçersiz.');
    const protector = this.#protector();
    if (!protector.isAvailable()) throw new Error('Bakım yeniden doğrulama durumu için işletim sistemi sır koruması kullanılamıyor.');
    const payload = JSON.stringify(snapshot);
    const envelope: ProtectedStateEnvelopeV2 = {
      schemaVersion: 2,
      protection: {
        id: protector.protectionId,
        encoding: 'base64',
        deviceBindingSha256: this.#resolveDeviceBinding()
      },
      writerVersion: this.#applicationVersion,
      persistedAt: new Date(now).toISOString(),
      payloadSha256: sha256(payload),
      protectedPayload: protector.protect(payload)
    };
    writeAtomicJson(this.#statePath, envelope);
    if (statSync(this.#statePath).size > this.#maximumFileBytes) {
      secureEraseFile(this.#statePath, this.#maximumFileBytes * 2);
      throw new Error('Korunan bakım yeniden doğrulama durumu boyut sınırını aştı.');
    }
  }

  clear(): void {
    secureEraseFile(this.#statePath, this.#maximumFileBytes);
  }

  #resolveDeviceBinding(): string {
    const binding = this.#deviceBinding();
    if (!HASH_PATTERN.test(binding)) throw new Error('Bakım yeniden doğrulama cihaz bağlama özeti geçersiz.');
    return binding;
  }

  #reject(error: unknown): IpcAdaptiveBudgetMaintenanceReauthenticationRestoreResult {
    const classification = error instanceof StateRestoreError ? error.classification : 'STATE_FILE_INVALID';
    const quarantinePath = this.#quarantine(error instanceof Error ? error.message : String(error));
    return Object.freeze({
      status: 'REJECTED',
      reason: 'STATE_REJECTED_AND_QUARANTINED',
      classification,
      ...(quarantinePath ? { quarantinePath } : {})
    });
  }

  #quarantine(_reason: string): string | undefined {
    try {
      mkdirSync(this.#quarantineDirectoryPath, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/gu, '-');
      const quarantinePath = join(this.#quarantineDirectoryPath, `${basename(this.#statePath)}.${timestamp}.${randomBytes(4).toString('hex')}.rejected`);
      renameSync(this.#statePath, quarantinePath);
      try { chmodSync(quarantinePath, 0o600); } catch { /* Windows ACL üst katmandadır. */ }
      this.#pruneQuarantine();
      return quarantinePath;
    } catch {
      secureEraseFile(this.#statePath, this.#maximumFileBytes);
      return undefined;
    }
  }

  #pruneQuarantine(): void {
    if (!existsSync(this.#quarantineDirectoryPath)) return;
    const files = readdirSync(this.#quarantineDirectoryPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.rejected'))
      .map((entry) => ({
        path: join(this.#quarantineDirectoryPath, entry.name),
        modifiedAt: statSync(join(this.#quarantineDirectoryPath, entry.name)).mtimeMs
      }))
      .sort((left, right) => right.modifiedAt - left.modifiedAt);
    for (const stale of files.slice(this.#maximumQuarantineFiles)) secureEraseFile(stale.path, this.#maximumFileBytes);
  }
}
