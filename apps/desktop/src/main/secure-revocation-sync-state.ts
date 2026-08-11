import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { FetchedExternalBackupEvidenceRevocationListView, RevocationSyncListFreshness } from '@ppt/domain';
import type { DeviceSecretProtector } from './device-secret-protector.js';

export interface PersistedRevocationSyncEndpointState {
  readonly endpointId: string;
  readonly status: 'idle' | 'checking' | 'update_available' | 'current' | 'backoff' | 'blocked';
  readonly consecutiveFailures: number;
  readonly nextAttemptAt: string;
  readonly lastAttemptAt?: string;
  readonly lastSuccessAt?: string;
  readonly lastError?: string;
  readonly listFreshness: RevocationSyncListFreshness;
  readonly currentSequenceNumber?: number;
  readonly currentNextUpdate?: string;
  readonly lastFreshnessNoticeKey?: string;
  readonly pending?: {
    readonly fetched: FetchedExternalBackupEvidenceRevocationListView;
    readonly endpointFingerprint: string;
  };
}

export interface RevocationSyncStateRestoreResult {
  readonly status: 'MISSING' | 'RESTORED' | 'REJECTED' | 'UNAVAILABLE';
  readonly reason: string;
  readonly states: readonly PersistedRevocationSyncEndpointState[];
}

export interface RevocationSyncStatePersistence {
  load(): RevocationSyncStateRestoreResult;
  persist(states: readonly PersistedRevocationSyncEndpointState[]): void;
}

interface ProtectedEnvelope {
  readonly schemaVersion: 1;
  readonly applicationVersion: string;
  readonly persistedAt: string;
  readonly protectionId: string;
  readonly payloadSha256: string;
  readonly protectedPayload: string;
}

interface PlainPayload {
  readonly schemaVersion: 1;
  readonly states: readonly PersistedRevocationSyncEndpointState[];
}

export interface ProtectedRevocationSyncStateStoreOptions {
  readonly directoryPath: string;
  readonly applicationVersion: string;
  readonly protector: () => DeviceSecretProtector;
  readonly maximumEndpoints?: number;
  readonly maximumFileBytes?: number;
  readonly maximumQuarantineFiles?: number;
}

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const VALID_STATUSES = new Set(['idle', 'checking', 'update_available', 'current', 'backoff', 'blocked']);
const VALID_FRESHNESS = new Set<RevocationSyncListFreshness>(['missing', 'fresh', 'expiring_soon', 'expired']);
const validIso = (value: unknown): value is string => typeof value === 'string' && ISO_PATTERN.test(value) && Number.isFinite(Date.parse(value));
const exactKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean => Object.keys(value).every((key) => allowed.includes(key));
const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const validFetched = (value: unknown): value is FetchedExternalBackupEvidenceRevocationListView => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (!exactKeys(row, ['endpointId', 'list', 'fetchedAt', 'sourceUrl', 'tlsSpkiSha256', 'matchedPin', 'responseBytes'])) return false;
  if (typeof row.endpointId !== 'string' || row.endpointId.length < 1 || row.endpointId.length > 128) return false;
  if (!validIso(row.fetchedAt) || typeof row.sourceUrl !== 'string' || row.sourceUrl.length > 2_048) return false;
  if (typeof row.tlsSpkiSha256 !== 'string' || !HASH_PATTERN.test(row.tlsSpkiSha256)) return false;
  if (row.matchedPin !== 'primary' && row.matchedPin !== 'secondary') return false;
  if (!Number.isSafeInteger(row.responseBytes) || Number(row.responseBytes) < 0 || Number(row.responseBytes) > 1_048_576) return false;
  if (!row.list || typeof row.list !== 'object' || Array.isArray(row.list)) return false;
  const list = row.list as Record<string, unknown>;
  if (typeof list.signerIssuerId !== 'string' || typeof list.listId !== 'string' || !Number.isSafeInteger(list.sequenceNumber)) return false;
  if (!validIso(list.thisUpdate) || !validIso(list.nextUpdate) || typeof list.signatureBase64 !== 'string') return false;
  if (!Array.isArray(list.entries) || list.entries.length > 10_000) return false;
  return list.entries.every((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const item = entry as Record<string, unknown>;
    return typeof item.fingerprintSha256 === 'string'
      && HASH_PATTERN.test(item.fingerprintSha256)
      && validIso(item.revokedAt)
      && typeof item.reason === 'string'
      && item.reason.length >= 1
      && item.reason.length <= 1_000;
  });
};

const validState = (value: unknown): value is PersistedRevocationSyncEndpointState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (!exactKeys(row, ['endpointId', 'status', 'consecutiveFailures', 'nextAttemptAt', 'lastAttemptAt', 'lastSuccessAt', 'lastError', 'listFreshness', 'currentSequenceNumber', 'currentNextUpdate', 'lastFreshnessNoticeKey', 'pending'])) return false;
  if (typeof row.endpointId !== 'string' || row.endpointId.length < 1 || row.endpointId.length > 128) return false;
  if (typeof row.status !== 'string' || !VALID_STATUSES.has(row.status)) return false;
  if (!Number.isSafeInteger(row.consecutiveFailures) || Number(row.consecutiveFailures) < 0 || Number(row.consecutiveFailures) > 64) return false;
  if (!validIso(row.nextAttemptAt)) return false;
  for (const key of ['lastAttemptAt', 'lastSuccessAt', 'currentNextUpdate'] as const) if (row[key] !== undefined && !validIso(row[key])) return false;
  if (row.lastError !== undefined && (typeof row.lastError !== 'string' || row.lastError.length > 2_000)) return false;
  if (typeof row.listFreshness !== 'string' || !VALID_FRESHNESS.has(row.listFreshness as RevocationSyncListFreshness)) return false;
  if (row.currentSequenceNumber !== undefined && (!Number.isSafeInteger(row.currentSequenceNumber) || Number(row.currentSequenceNumber) < 1)) return false;
  if (row.lastFreshnessNoticeKey !== undefined && (typeof row.lastFreshnessNoticeKey !== 'string' || row.lastFreshnessNoticeKey.length > 256)) return false;
  if (row.pending !== undefined) {
    if (!row.pending || typeof row.pending !== 'object' || Array.isArray(row.pending)) return false;
    const pending = row.pending as Record<string, unknown>;
    if (!exactKeys(pending, ['fetched', 'endpointFingerprint'])) return false;
    if (typeof pending.endpointFingerprint !== 'string' || !HASH_PATTERN.test(pending.endpointFingerprint) || !validFetched(pending.fetched)) return false;
  }
  return true;
};

const validEnvelope = (value: unknown): value is ProtectedEnvelope => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return exactKeys(row, ['schemaVersion', 'applicationVersion', 'persistedAt', 'protectionId', 'payloadSha256', 'protectedPayload'])
    && row.schemaVersion === 1
    && typeof row.applicationVersion === 'string'
    && validIso(row.persistedAt)
    && typeof row.protectionId === 'string'
    && row.protectionId.length >= 3
    && row.protectionId.length <= 128
    && typeof row.payloadSha256 === 'string'
    && HASH_PATTERN.test(row.payloadSha256)
    && typeof row.protectedPayload === 'string'
    && row.protectedPayload.length > 0;
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
    try { chmodSync(temporaryPath, 0o600); } catch { /* Windows ACL and safeStorage are authoritative. */ }
    renameSync(temporaryPath, path);
    try { chmodSync(path, 0o600); } catch { /* Windows ACL and safeStorage are authoritative. */ }
  } catch (error) {
    if (descriptor !== undefined) try { closeSync(descriptor); } catch { /* best effort */ }
    rmSync(temporaryPath, { force: true });
    throw error;
  }
};

export class ProtectedRevocationSyncStateStore implements RevocationSyncStatePersistence {
  readonly #statePath: string;
  readonly #quarantinePath: string;
  readonly #applicationVersion: string;
  readonly #protector: () => DeviceSecretProtector;
  readonly #maximumEndpoints: number;
  readonly #maximumFileBytes: number;
  readonly #maximumQuarantineFiles: number;

  public constructor(options: ProtectedRevocationSyncStateStoreOptions) {
    if (!options.directoryPath || !options.applicationVersion || typeof options.protector !== 'function') throw new Error('İptal listesi senkronizasyon durum deposu seçenekleri geçersiz.');
    this.#statePath = join(options.directoryPath, 'revocation-sync-state.json');
    this.#quarantinePath = join(options.directoryPath, 'quarantine');
    this.#applicationVersion = options.applicationVersion;
    this.#protector = options.protector;
    this.#maximumEndpoints = Math.max(1, Math.min(options.maximumEndpoints ?? 128, 512));
    this.#maximumFileBytes = Math.max(65_536, Math.min(options.maximumFileBytes ?? 2_097_152, 16_777_216));
    this.#maximumQuarantineFiles = Math.max(1, Math.min(options.maximumQuarantineFiles ?? 8, 64));
    this.#pruneQuarantine();
  }

  public load(): RevocationSyncStateRestoreResult {
    if (!existsSync(this.#statePath)) return Object.freeze({ status: 'MISSING', reason: 'STATE_MISSING', states: [] });
    const protector = this.#protector();
    if (!protector.isAvailable()) return Object.freeze({ status: 'UNAVAILABLE', reason: 'PROTECTOR_UNAVAILABLE', states: [] });
    try {
      if (statSync(this.#statePath).size > this.#maximumFileBytes) throw new Error('STATE_FILE_TOO_LARGE');
      const envelope = JSON.parse(readFileSync(this.#statePath, 'utf8')) as unknown;
      if (!validEnvelope(envelope)) throw new Error('STATE_ENVELOPE_INVALID');
      if (envelope.protectionId !== protector.protectionId) throw new Error('PROTECTION_PROVIDER_MISMATCH');
      const payloadText = protector.unprotect(envelope.protectedPayload);
      if (sha256(payloadText) !== envelope.payloadSha256) throw new Error('PAYLOAD_HASH_MISMATCH');
      const payload = JSON.parse(payloadText) as unknown;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('PAYLOAD_INVALID');
      const record = payload as Record<string, unknown>;
      if (record.schemaVersion !== 1 || !Array.isArray(record.states) || record.states.length > this.#maximumEndpoints || !record.states.every(validState)) throw new Error('STATE_COLLECTION_INVALID');
      const unique = new Set((record.states as PersistedRevocationSyncEndpointState[]).map((state) => state.endpointId));
      if (unique.size !== record.states.length) throw new Error('DUPLICATE_ENDPOINT_STATE');
      return Object.freeze({ status: 'RESTORED', reason: 'PROTECTED_STATE_VERIFIED', states: Object.freeze([...(record.states as PersistedRevocationSyncEndpointState[])]) });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'STATE_RESTORE_FAILED';
      this.#quarantine(reason);
      return Object.freeze({ status: 'REJECTED', reason, states: [] });
    }
  }

  public persist(states: readonly PersistedRevocationSyncEndpointState[]): void {
    if (states.length > this.#maximumEndpoints || !states.every(validState)) throw new Error('İptal listesi senkronizasyon durumu geçersiz.');
    const unique = new Set(states.map((state) => state.endpointId));
    if (unique.size !== states.length) throw new Error('İptal listesi senkronizasyon durumunda yinelenen kaynak kimliği var.');
    const protector = this.#protector();
    if (!protector.isAvailable()) throw new Error('İptal listesi senkronizasyon durumu için işletim sistemi koruması kullanılamıyor.');
    const payload: PlainPayload = { schemaVersion: 1, states: [...states].sort((left, right) => left.endpointId.localeCompare(right.endpointId)) };
    const payloadText = JSON.stringify(payload);
    const envelope: ProtectedEnvelope = {
      schemaVersion: 1,
      applicationVersion: this.#applicationVersion,
      persistedAt: new Date().toISOString(),
      protectionId: protector.protectionId,
      payloadSha256: sha256(payloadText),
      protectedPayload: protector.protect(payloadText)
    };
    const serialized = JSON.stringify(envelope);
    if (Buffer.byteLength(serialized, 'utf8') > this.#maximumFileBytes) throw new Error('İptal listesi senkronizasyon durum dosyası boyut sınırını aşıyor.');
    writeAtomicJson(this.#statePath, envelope);
  }

  #quarantine(reason: string): void {
    try {
      mkdirSync(this.#quarantinePath, { recursive: true });
      const suffix = `${Date.now()}-${sha256(reason).slice(0, 12)}`;
      renameSync(this.#statePath, join(this.#quarantinePath, `revocation-sync-state.${suffix}.corrupt.json`));
    } catch { rmSync(this.#statePath, { force: true }); }
    this.#pruneQuarantine();
  }

  #pruneQuarantine(): void {
    try {
      mkdirSync(this.#quarantinePath, { recursive: true });
      const entries = readdirSync(this.#quarantinePath, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.startsWith('revocation-sync-state.'))
        .map((entry) => ({ name: entry.name, path: join(this.#quarantinePath, entry.name), modified: statSync(join(this.#quarantinePath, entry.name)).mtimeMs }))
        .sort((left, right) => right.modified - left.modified);
      for (const entry of entries.slice(this.#maximumQuarantineFiles)) rmSync(entry.path, { force: true });
    } catch { /* Retention is best effort and retried on next start. */ }
  }
}
