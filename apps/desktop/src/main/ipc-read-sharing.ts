import { createHash } from 'node:crypto';
import type { IpcTransportRevisions } from './ipc-transport-context.js';

export type IpcReadSharingPriority = 'interactive' | 'standard';

export interface IpcReadSharingPolicy {
  readonly enabled: boolean;
  readonly priority: IpcReadSharingPriority;
  readonly ttlMs: number;
  readonly maxEntries: number;
  readonly maxResultBytes: number;
}

/**
 * These reads can project governed saved-location identifiers or labels. They
 * must cross the location PEP on every invocation so a grant expiry or
 * revocation can never be hidden by either the preload or main-process cache.
 */
export const IPC_POLICY_SENSITIVE_READ_CHANNELS = Object.freeze([
  'data:getSnapshot',
  'data:getSnapshotSections',
  'dashboard:getOverview',
  'largeData:timeline',
  'timeline:listArchived'
] as const);

const policySensitiveChannels = new Set<string>(IPC_POLICY_SENSITIVE_READ_CHANNELS);

const interactiveChannels = new Set<string>([
  'catalog:listPeople',
  'catalog:listEvents',
  'catalog:lookup'
]);

const standardChannels = new Set<string>([
  'largeData:tree',
  'largeData:archive',
  'genealogy:insights',
  'archive:versions',
  'archive:search'
]);

const disabledPolicy: IpcReadSharingPolicy = Object.freeze({
  enabled: false,
  priority: 'standard',
  ttlMs: 0,
  maxEntries: 0,
  maxResultBytes: 0
});

export const resolveIpcReadSharingPolicy = (channel: string): IpcReadSharingPolicy => {
  if (policySensitiveChannels.has(channel)) return disabledPolicy;
  if (interactiveChannels.has(channel)) {
    return Object.freeze({
      enabled: true,
      priority: 'interactive',
      ttlMs: 160,
      maxEntries: 24,
      maxResultBytes: 1_500_000
    });
  }
  if (standardChannels.has(channel)) {
    return Object.freeze({
      enabled: true,
      priority: 'standard',
      ttlMs: 90,
      maxEntries: 12,
      maxResultBytes: 2_500_000
    });
  }
  return disabledPolicy;
};

const MUTATION_ACTION_PATTERN = /^(?:create|update|delete|upsert|set|archive|restore|revoke|accept|apply|run|execute|acknowledge|import|rollback|assign|enable|disable|trust|change|process|evaluate|capture|enqueue|repair|cleanup|purge|destroy|register|rotate|attest|propagate|request|cancel)/i;

export const shouldInvalidateIpcReadSharing = (channel: string): boolean => {
  if (resolveIpcReadSharingPolicy(channel).enabled) return false;
  const action = channel.split(':', 2)[1] ?? '';
  return MUTATION_ACTION_PATTERN.test(action);
};

const encodeNumber = (value: number): string => {
  if (Number.isNaN(value)) return 'number:NaN';
  if (value === Number.POSITIVE_INFINITY) return 'number:+Infinity';
  if (value === Number.NEGATIVE_INFINITY) return 'number:-Infinity';
  if (Object.is(value, -0)) return 'number:-0';
  return `number:${String(value)}`;
};

const canonicalize = (value: unknown, seen: Set<object>): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `string:${JSON.stringify(value)}`;
  if (typeof value === 'boolean') return value ? 'boolean:true' : 'boolean:false';
  if (typeof value === 'number') return encodeNumber(value);
  if (typeof value === 'bigint') return `bigint:${value.toString(10)}`;
  if (typeof value !== 'object') throw new TypeError(`IPC paylaşım anahtarında desteklenmeyen değer: ${typeof value}.`);
  if (seen.has(value)) throw new TypeError('IPC paylaşım anahtarında döngüsel değer kullanılamaz.');
  seen.add(value);
  try {
    if (value instanceof Date) return `date:${value.toISOString()}`;
    if (value instanceof Uint8Array) return `bytes:${Buffer.from(value).toString('base64')}`;
    if (Array.isArray(value)) return `array:[${value.map((item) => canonicalize(item, seen)).join(',')}]`;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('IPC paylaşım anahtarında yalnız düz nesneler kullanılabilir.');
    }
    const record = value as Record<string, unknown>;
    return `object:{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}=${canonicalize(record[key], seen)}`).join(',')}}`;
  } finally {
    seen.delete(value);
  }
};

export interface IpcReadSharingKeyInput {
  readonly rendererSessionId: string;
  readonly sessionEpoch: number;
  readonly channel: string;
  readonly revisions: IpcTransportRevisions;
  readonly arguments: readonly unknown[];
}

export const createIpcReadSharingKey = (input: IpcReadSharingKeyInput): string => {
  const canonical = canonicalize({
    rendererSessionId: input.rendererSessionId,
    sessionEpoch: input.sessionEpoch,
    channel: input.channel,
    revisions: input.revisions,
    arguments: input.arguments
  }, new Set<object>());
  return createHash('sha256').update(canonical).digest('hex');
};

const cloneValue = <T>(value: T): T => {
  if (typeof globalThis.structuredClone !== 'function') {
    throw new TypeError('IPC paylaşım katmanı structuredClone desteği gerektirir.');
  }
  return globalThis.structuredClone(value);
};

const estimateResultBytes = (value: unknown, limit: number): number => {
  const seen = new Set<object>();
  let bytes = 0;
  const add = (amount: number): void => {
    bytes += amount;
    if (bytes > limit) throw new RangeError('IPC paylaşım sonucu cache boyut sınırını aşıyor.');
  };
  const visit = (candidate: unknown): void => {
    if (candidate === null || candidate === undefined) { add(4); return; }
    if (typeof candidate === 'string') { add(Buffer.byteLength(candidate, 'utf8') + 8); return; }
    if (typeof candidate === 'number' || typeof candidate === 'bigint') { add(16); return; }
    if (typeof candidate === 'boolean') { add(4); return; }
    if (typeof candidate !== 'object') throw new TypeError('IPC paylaşım sonucu desteklenmeyen değer içeriyor.');
    if (seen.has(candidate)) throw new TypeError('IPC paylaşım sonucu döngüsel değer içeriyor.');
    seen.add(candidate);
    try {
      if (candidate instanceof Date) { add(32); return; }
      if (candidate instanceof Uint8Array) { add(candidate.byteLength + 16); return; }
      if (Array.isArray(candidate)) {
        add(16);
        for (const item of candidate) visit(item);
        return;
      }
      const prototype = Object.getPrototypeOf(candidate);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError('IPC paylaşım sonucu yalnız düz nesne, dizi ve temel değerlerden oluşmalıdır.');
      }
      add(24);
      for (const [key, item] of Object.entries(candidate as Record<string, unknown>)) {
        add(Buffer.byteLength(key, 'utf8') + 8);
        visit(item);
      }
    } finally {
      seen.delete(candidate);
    }
  };
  visit(value);
  return bytes;
};

interface CachedReadResult {
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly value: unknown;
  readonly estimatedBytes: number;
}

export interface IpcReadCacheLookup<TResult> {
  readonly hit: boolean;
  readonly result?: TResult;
  readonly ageMs?: number;
  readonly estimatedBytes?: number;
}

export class IpcReadResultCacheRegistry {
  readonly #cacheBySender = new Map<number, Map<string, CachedReadResult>>();
  readonly #generationBySender = new Map<number, number>();

  public lookup<TResult>(senderId: number, key: string, now = Date.now()): IpcReadCacheLookup<TResult> {
    const cache = this.#cacheBySender.get(senderId);
    const entry = cache?.get(key);
    if (!entry) return Object.freeze({ hit: false });
    if (entry.expiresAt <= now) {
      cache?.delete(key);
      if (cache?.size === 0) this.#cacheBySender.delete(senderId);
      return Object.freeze({ hit: false });
    }
    return Object.freeze({
      hit: true,
      result: cloneValue(entry.value) as TResult,
      ageMs: Math.max(0, now - entry.createdAt),
      estimatedBytes: entry.estimatedBytes
    });
  }

  public store<TResult>(
    senderId: number,
    key: string,
    result: TResult,
    policy: IpcReadSharingPolicy,
    now = Date.now(),
    expectedGeneration = this.generation(senderId)
  ): boolean {
    if (!policy.enabled || policy.ttlMs <= 0 || policy.maxEntries <= 0) return false;
    if (expectedGeneration !== this.generation(senderId)) return false;
    let estimatedBytes: number;
    let cloned: TResult;
    try {
      estimatedBytes = estimateResultBytes(result, policy.maxResultBytes);
      cloned = cloneValue(result);
    } catch {
      return false;
    }
    let cache = this.#cacheBySender.get(senderId);
    if (!cache) {
      cache = new Map<string, CachedReadResult>();
      this.#cacheBySender.set(senderId, cache);
    }
    this.#prune(cache, now);
    cache.delete(key);
    cache.set(key, { createdAt: now, expiresAt: now + policy.ttlMs, value: cloned, estimatedBytes });
    while (cache.size > policy.maxEntries) {
      const oldest = cache.keys().next().value as string | undefined;
      if (!oldest) break;
      cache.delete(oldest);
    }
    return true;
  }

  public invalidateSender(senderId: number): number {
    const count = this.#cacheBySender.get(senderId)?.size ?? 0;
    this.#cacheBySender.delete(senderId);
    this.#generationBySender.set(senderId, this.generation(senderId) + 1);
    return count;
  }

  public generation(senderId: number): number {
    return this.#generationBySender.get(senderId) ?? 0;
  }

  public clearAll(): void {
    this.#cacheBySender.clear();
    this.#generationBySender.clear();
  }

  public entryCount(senderId?: number): number {
    if (senderId !== undefined) return this.#cacheBySender.get(senderId)?.size ?? 0;
    let count = 0;
    for (const cache of this.#cacheBySender.values()) count += cache.size;
    return count;
  }

  #prune(cache: Map<string, CachedReadResult>, now: number): void {
    for (const [key, entry] of cache.entries()) if (entry.expiresAt <= now) cache.delete(key);
  }
}

interface ClientCacheEntry {
  readonly expiresAt: number;
  readonly value: unknown;
}

interface ClientInFlightEntry {
  readonly generation: number;
  readonly promise: Promise<unknown>;
}

export class IpcReadSharingClient {
  readonly #now: () => number;
  readonly #cache = new Map<string, ClientCacheEntry>();
  readonly #inFlight = new Map<string, ClientInFlightEntry>();
  #generation = 0;

  public constructor(now: () => number = Date.now) {
    this.#now = now;
  }

  public execute<TResult>(
    key: string,
    policy: IpcReadSharingPolicy,
    operation: () => Promise<TResult>,
    now = this.#now()
  ): Promise<TResult> {
    if (!policy.enabled) return operation();
    this.#prune(now);
    const cached = this.#cache.get(key);
    if (cached && cached.expiresAt > now) return Promise.resolve(cloneValue(cached.value) as TResult);
    const current = this.#inFlight.get(key);
    if (current && current.generation === this.#generation) {
      return current.promise.then((value) => cloneValue(value) as TResult);
    }
    const generation = this.#generation;
    const promise = Promise.resolve()
      .then(operation)
      .then((result) => {
        if (generation === this.#generation) {
          try {
            estimateResultBytes(result, policy.maxResultBytes);
            this.#cache.delete(key);
            this.#cache.set(key, { expiresAt: this.#now() + policy.ttlMs, value: cloneValue(result) });
            while (this.#cache.size > policy.maxEntries) {
              const oldest = this.#cache.keys().next().value as string | undefined;
              if (!oldest) break;
              this.#cache.delete(oldest);
            }
          } catch {
            // Cache dışı sonuç yine çağırana döner; yalnız paylaşım saklaması yapılmaz.
          }
        }
        return result;
      })
      .finally(() => {
        const active = this.#inFlight.get(key);
        if (active?.promise === promise) this.#inFlight.delete(key);
      });
    this.#inFlight.set(key, { generation, promise });
    return promise.then((value) => cloneValue(value) as TResult);
  }

  public invalidate(): void {
    this.#generation += 1;
    this.#cache.clear();
    this.#inFlight.clear();
  }

  public cacheCount(): number {
    return this.#cache.size;
  }

  public inFlightCount(): number {
    return this.#inFlight.size;
  }

  public generation(): number {
    return this.#generation;
  }

  #prune(now: number): void {
    for (const [key, entry] of this.#cache.entries()) if (entry.expiresAt <= now) this.#cache.delete(key);
  }
}
