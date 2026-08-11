import {
  resolveIpcRequestAdmissionPolicy,
  type IpcRequestAdmissionPolicy,
  type IpcRequestAdmissionPriority
} from './ipc-request-lifecycle.js';
import { createHash } from 'node:crypto';
import type {
  IpcAdaptiveResourceBudgetDurableState,
  IpcAdaptiveResourceBudgetJournalEvent,
  IpcAdaptiveResourceBudgetStatePersistence
} from './ipc-adaptive-resource-budget-state.js';
import {
  resolveIpcReadSharingPolicy,
  type IpcReadSharingPolicy,
  type IpcReadSharingPriority
} from './ipc-read-sharing.js';

export type IpcAdaptiveResourceBudgetMode = 'baseline' | 'guarded' | 'restricted';
export type IpcAdaptiveResourceBudgetReason =
  | 'startup-baseline'
  | 'insufficient-samples'
  | 'healthy'
  | 'warning-pressure'
  | 'critical-pressure'
  | 'invalid-telemetry'
  | 'recovery-hold'
  | 'restored'
  | 'restore-rejected'
  | 'persistence-failure'
  | 'manual-reset';

export interface IpcAdaptiveResourceBudgetAdmissionView {
  readonly priority: IpcRequestAdmissionPriority;
  readonly maxConcurrentPerSender: number;
  readonly maxConcurrentPerChannel: number;
  readonly maxQueuedPerSender: number;
  readonly queueTimeoutMs: number;
}

export interface IpcAdaptiveResourceBudgetCacheView {
  readonly priority: IpcReadSharingPriority;
  readonly ttlMsCap: number;
  readonly maxEntries: number;
  readonly maxResultBytes: number;
}

export interface IpcAdaptiveResourceBudgetPersistenceView {
  readonly status: 'disabled' | 'initialized' | 'verified' | 'recovered' | 'rejected' | 'write-failed';
  readonly reason: string;
  readonly lastPersistedAt?: string;
}

export interface IpcAdaptiveResourceBudgetView {
  readonly schemaVersion: 1;
  readonly mode: IpcAdaptiveResourceBudgetMode;
  readonly reason: IpcAdaptiveResourceBudgetReason;
  readonly generation: number;
  readonly evaluatedAt: string;
  readonly sampleCount: number;
  readonly minimumSampleCount: number;
  readonly recoveryNotBefore?: string;
  readonly admission: readonly IpcAdaptiveResourceBudgetAdmissionView[];
  readonly cache: readonly IpcAdaptiveResourceBudgetCacheView[];
  readonly persistence: IpcAdaptiveResourceBudgetPersistenceView;
}

export interface IpcAdaptiveTelemetrySnapshot {
  readonly totalSamples: number;
  readonly activeRequests: number;
  readonly queuedRequests: number;
  readonly cacheEntries: number;
  readonly alerts: readonly {
    readonly severity: 'warning' | 'critical';
    readonly code: string;
  }[];
}

export interface IpcAdaptiveResourceBudgetRefreshResult {
  readonly changed: boolean;
  readonly previousMode: IpcAdaptiveResourceBudgetMode;
  readonly current: IpcAdaptiveResourceBudgetView;
}

interface ModeBudget {
  readonly admission: Readonly<Record<IpcRequestAdmissionPriority, IpcAdaptiveResourceBudgetAdmissionView>>;
  readonly cache: Readonly<Record<IpcReadSharingPriority, IpcAdaptiveResourceBudgetCacheView>>;
}

const MINIMUM_SAMPLE_COUNT = 32;
const REFRESH_INTERVAL_MS = 5_000;
const RESTRICTED_RECOVERY_MS = 60_000;
const GUARDED_RECOVERY_MS = 120_000;

const freezeBudget = (input: ModeBudget): ModeBudget => Object.freeze({
  admission: Object.freeze({
    interactive: Object.freeze(input.admission.interactive),
    standard: Object.freeze(input.admission.standard),
    background: Object.freeze(input.admission.background)
  }),
  cache: Object.freeze({
    interactive: Object.freeze(input.cache.interactive),
    standard: Object.freeze(input.cache.standard)
  })
});

const MODE_BUDGETS: Readonly<Record<IpcAdaptiveResourceBudgetMode, ModeBudget>> = Object.freeze({
  baseline: freezeBudget({
    admission: {
      interactive: { priority: 'interactive', maxConcurrentPerSender: 4, maxConcurrentPerChannel: 1, maxQueuedPerSender: 12, queueTimeoutMs: 4_000 },
      standard: { priority: 'standard', maxConcurrentPerSender: 4, maxConcurrentPerChannel: 1, maxQueuedPerSender: 12, queueTimeoutMs: 6_000 },
      background: { priority: 'background', maxConcurrentPerSender: 2, maxConcurrentPerChannel: 1, maxQueuedPerSender: 4, queueTimeoutMs: 10_000 }
    },
    cache: {
      interactive: { priority: 'interactive', ttlMsCap: 250, maxEntries: 24, maxResultBytes: 1_500_000 },
      standard: { priority: 'standard', ttlMsCap: 90, maxEntries: 12, maxResultBytes: 2_500_000 }
    }
  }),
  guarded: freezeBudget({
    admission: {
      interactive: { priority: 'interactive', maxConcurrentPerSender: 3, maxConcurrentPerChannel: 1, maxQueuedPerSender: 8, queueTimeoutMs: 4_000 },
      standard: { priority: 'standard', maxConcurrentPerSender: 3, maxConcurrentPerChannel: 1, maxQueuedPerSender: 8, queueTimeoutMs: 6_000 },
      background: { priority: 'background', maxConcurrentPerSender: 1, maxConcurrentPerChannel: 1, maxQueuedPerSender: 2, queueTimeoutMs: 10_000 }
    },
    cache: {
      interactive: { priority: 'interactive', ttlMsCap: 160, maxEntries: 16, maxResultBytes: 1_250_000 },
      standard: { priority: 'standard', ttlMsCap: 75, maxEntries: 8, maxResultBytes: 2_000_000 }
    }
  }),
  restricted: freezeBudget({
    admission: {
      interactive: { priority: 'interactive', maxConcurrentPerSender: 2, maxConcurrentPerChannel: 1, maxQueuedPerSender: 4, queueTimeoutMs: 3_000 },
      standard: { priority: 'standard', maxConcurrentPerSender: 1, maxConcurrentPerChannel: 1, maxQueuedPerSender: 4, queueTimeoutMs: 4_500 },
      background: { priority: 'background', maxConcurrentPerSender: 1, maxConcurrentPerChannel: 1, maxQueuedPerSender: 1, queueTimeoutMs: 7_500 }
    },
    cache: {
      interactive: { priority: 'interactive', ttlMsCap: 100, maxEntries: 8, maxResultBytes: 1_000_000 },
      standard: { priority: 'standard', ttlMsCap: 50, maxEntries: 4, maxResultBytes: 1_500_000 }
    }
  })
});


const POLICY_FINGERPRINT_INPUT = Object.freeze({
  schemaVersion: 1,
  minimumSampleCount: MINIMUM_SAMPLE_COUNT,
  refreshIntervalMs: REFRESH_INTERVAL_MS,
  restrictedRecoveryMs: RESTRICTED_RECOVERY_MS,
  guardedRecoveryMs: GUARDED_RECOVERY_MS,
  modeBudgets: MODE_BUDGETS
});

export const IPC_ADAPTIVE_RESOURCE_BUDGET_POLICY_FINGERPRINT = createHash('sha256')
  .update(JSON.stringify(POLICY_FINGERPRINT_INPUT), 'utf8')
  .digest('hex');

export interface IpcAdaptiveResourceBudgetControllerOptions {
  readonly persistence?: IpcAdaptiveResourceBudgetStatePersistence;
  readonly now?: () => number;
}

const finiteNonNegativeInteger = (value: unknown, max: number): number | undefined => {
  if (!Number.isFinite(value)) return undefined;
  const normalized = Math.trunc(Number(value));
  if (normalized < 0 || normalized > max) return undefined;
  return normalized;
};

const validSnapshot = (snapshot: IpcAdaptiveTelemetrySnapshot): boolean => {
  if (finiteNonNegativeInteger(snapshot.totalSamples, 1_000_000) === undefined) return false;
  if (finiteNonNegativeInteger(snapshot.activeRequests, 10_000) === undefined) return false;
  if (finiteNonNegativeInteger(snapshot.queuedRequests, 10_000) === undefined) return false;
  if (finiteNonNegativeInteger(snapshot.cacheEntries, 100_000) === undefined) return false;
  if (!Array.isArray(snapshot.alerts) || snapshot.alerts.length > 64) return false;
  return snapshot.alerts.every((alert) => alert && (alert.severity === 'warning' || alert.severity === 'critical')
    && typeof alert.code === 'string' && alert.code.length > 0 && alert.code.length <= 64);
};

const pressureMode = (snapshot: IpcAdaptiveTelemetrySnapshot): IpcAdaptiveResourceBudgetMode => {
  const hasCritical = snapshot.alerts.some((alert) => alert.severity === 'critical');
  const hasWarning = snapshot.alerts.some((alert) => alert.severity === 'warning');
  if (hasCritical || snapshot.queuedRequests >= 12 || snapshot.activeRequests >= 12) return 'restricted';
  if (hasWarning || snapshot.queuedRequests >= 6 || snapshot.activeRequests >= 8) return 'guarded';
  return 'baseline';
};

const clampAdmission = (base: IpcRequestAdmissionPolicy, budget: IpcAdaptiveResourceBudgetAdmissionView): IpcRequestAdmissionPolicy => {
  if (!base.enabled) return base;
  return Object.freeze({
    ...base,
    maxConcurrentPerSender: Math.max(1, Math.min(base.maxConcurrentPerSender, budget.maxConcurrentPerSender)),
    maxConcurrentPerChannel: Math.max(1, Math.min(base.maxConcurrentPerChannel, budget.maxConcurrentPerChannel)),
    maxQueuedPerSender: Math.max(1, Math.min(base.maxQueuedPerSender, budget.maxQueuedPerSender)),
    queueTimeoutMs: Math.max(500, Math.min(base.queueTimeoutMs, budget.queueTimeoutMs))
  });
};

const clampCache = (base: IpcReadSharingPolicy, budget: IpcAdaptiveResourceBudgetCacheView): IpcReadSharingPolicy => {
  if (!base.enabled) return base;
  return Object.freeze({
    ...base,
    ttlMs: Math.max(1, Math.min(base.ttlMs, budget.ttlMsCap)),
    maxEntries: Math.max(1, Math.min(base.maxEntries, budget.maxEntries)),
    maxResultBytes: Math.max(64_000, Math.min(base.maxResultBytes, budget.maxResultBytes))
  });
};

export class IpcAdaptiveResourceBudgetController {
  #mode: IpcAdaptiveResourceBudgetMode = 'baseline';
  #reason: IpcAdaptiveResourceBudgetReason = 'startup-baseline';
  #generation = 0;
  #evaluatedAt = 0;
  #lastRefreshAt = Number.NEGATIVE_INFINITY;
  #healthySince: number | undefined;
  #sampleCount = 0;
  #persistenceStatus: IpcAdaptiveResourceBudgetPersistenceView['status'] = 'disabled';
  #persistenceReason = 'PERSISTENCE_NOT_CONFIGURED';
  #lastPersistedAt: number | undefined;
  readonly #persistence: IpcAdaptiveResourceBudgetStatePersistence | undefined;
  readonly #now: () => number;

  public constructor(options: IpcAdaptiveResourceBudgetControllerOptions = {}) {
    this.#persistence = options.persistence;
    this.#now = options.now ?? (() => Date.now());
    if (!this.#persistence) return;
    const restored = this.#persistence.load(this.#now());
    if (restored.status === 'RESTORED' && restored.state && this.#restoreDurableState(restored.state)) {
      this.#reason = 'restored';
      this.#persistenceStatus = restored.recoveredFromJournal ? 'recovered' : 'verified';
      this.#persistenceReason = restored.reason;
      this.#persist('restore', this.#now());
      return;
    }
    this.#mode = 'baseline';
    this.#reason = restored.status === 'REJECTED' ? 'restore-rejected' : 'startup-baseline';
    this.#persistenceStatus = restored.status === 'REJECTED' ? 'rejected' : 'initialized';
    this.#persistenceReason = restored.reason;
    this.#generation = 0;
    this.#evaluatedAt = 0;
    this.#lastRefreshAt = Number.NEGATIVE_INFINITY;
    this.#healthySince = undefined;
    this.#sampleCount = 0;
    this.#persist(restored.status === 'REJECTED' ? 'restore-rejected' : 'startup', this.#now());
  }

  public refresh(snapshot: IpcAdaptiveTelemetrySnapshot, now = this.#now()): IpcAdaptiveResourceBudgetRefreshResult {
    const normalizedNow = Number.isFinite(now) ? Math.max(0, Number(now)) : Date.now();
    const previousMode = this.#mode;
    if (normalizedNow - this.#lastRefreshAt < REFRESH_INTERVAL_MS) {
      return Object.freeze({ changed: false, previousMode, current: this.snapshot() });
    }
    this.#lastRefreshAt = normalizedNow;
    this.#evaluatedAt = normalizedNow;
    if (!validSnapshot(snapshot)) {
      this.#reason = 'invalid-telemetry';
      this.#healthySince = undefined;
      this.#persist('evaluation', normalizedNow);
      return Object.freeze({ changed: false, previousMode, current: this.snapshot() });
    }
    this.#sampleCount = snapshot.totalSamples;
    if (snapshot.totalSamples < MINIMUM_SAMPLE_COUNT) {
      this.#reason = 'insufficient-samples';
      this.#healthySince = undefined;
      this.#persist('evaluation', normalizedNow);
      return Object.freeze({ changed: false, previousMode, current: this.snapshot() });
    }
    const target = pressureMode(snapshot);
    if (target === 'restricted') {
      this.#applyMode('restricted', 'critical-pressure');
      this.#healthySince = undefined;
    } else if (target === 'guarded') {
      if (this.#mode !== 'restricted') this.#applyMode('guarded', 'warning-pressure');
      else this.#reason = 'recovery-hold';
      this.#healthySince = undefined;
    } else {
      this.#healthySince ??= normalizedNow;
      const healthyFor = normalizedNow - this.#healthySince;
      if (this.#mode === 'restricted' && healthyFor >= RESTRICTED_RECOVERY_MS) {
        this.#applyMode('guarded', 'healthy');
        this.#healthySince = normalizedNow;
      } else if (this.#mode === 'guarded' && healthyFor >= GUARDED_RECOVERY_MS) {
        this.#applyMode('baseline', 'healthy');
        this.#healthySince = normalizedNow;
      } else {
        this.#reason = this.#mode === 'baseline' ? 'healthy' : 'recovery-hold';
      }
    }
    this.#persist('evaluation', normalizedNow);
    return Object.freeze({ changed: previousMode !== this.#mode, previousMode, current: this.snapshot() });
  }

  public resolveAdmissionPolicy(channel: string): IpcRequestAdmissionPolicy {
    const base = resolveIpcRequestAdmissionPolicy(channel);
    if (!base.enabled) return base;
    return clampAdmission(base, MODE_BUDGETS[this.#mode].admission[base.priority]);
  }

  public resolveReadSharingPolicy(channel: string): IpcReadSharingPolicy {
    const base = resolveIpcReadSharingPolicy(channel);
    if (!base.enabled) return base;
    return clampCache(base, MODE_BUDGETS[this.#mode].cache[base.priority]);
  }

  public snapshot(): IpcAdaptiveResourceBudgetView {
    const budget = MODE_BUDGETS[this.#mode];
    const recoveryMs = this.#mode === 'restricted' ? RESTRICTED_RECOVERY_MS : this.#mode === 'guarded' ? GUARDED_RECOVERY_MS : 0;
    return Object.freeze({
      schemaVersion: 1,
      mode: this.#mode,
      reason: this.#reason,
      generation: this.#generation,
      evaluatedAt: new Date(this.#evaluatedAt).toISOString(),
      sampleCount: this.#sampleCount,
      minimumSampleCount: MINIMUM_SAMPLE_COUNT,
      ...(this.#healthySince !== undefined && recoveryMs > 0
        ? { recoveryNotBefore: new Date(this.#healthySince + recoveryMs).toISOString() }
        : {}),
      admission: Object.freeze(['interactive', 'standard', 'background'].map((priority) => budget.admission[priority as IpcRequestAdmissionPriority])),
      cache: Object.freeze(['interactive', 'standard'].map((priority) => budget.cache[priority as IpcReadSharingPriority])),
      persistence: Object.freeze({
        status: this.#persistenceStatus,
        reason: this.#persistenceReason,
        ...(this.#lastPersistedAt !== undefined ? { lastPersistedAt: new Date(this.#lastPersistedAt).toISOString() } : {})
      })
    });
  }

  public manualReset(now = this.#now()): IpcAdaptiveResourceBudgetView {
    const normalizedNow = Number.isFinite(now) ? Math.max(0, Number(now)) : Date.now();
    this.#mode = 'baseline';
    this.#reason = 'manual-reset';
    this.#generation += 1;
    this.#evaluatedAt = normalizedNow;
    this.#lastRefreshAt = Number.NEGATIVE_INFINITY;
    this.#healthySince = undefined;
    this.#sampleCount = 0;
    this.#persist('manual-clear', normalizedNow);
    return this.snapshot();
  }

  public clear(options: { readonly persist?: boolean } = {}): void {
    this.#mode = 'baseline';
    this.#reason = 'startup-baseline';
    this.#generation = 0;
    this.#evaluatedAt = 0;
    this.#lastRefreshAt = Number.NEGATIVE_INFINITY;
    this.#healthySince = undefined;
    this.#sampleCount = 0;
    if (options.persist !== false) this.#persist('manual-clear', this.#now());
  }

  #durableState(): IpcAdaptiveResourceBudgetDurableState {
    return Object.freeze({
      schemaVersion: 1,
      mode: this.#mode,
      reason: this.#reason,
      generation: this.#generation,
      evaluatedAtMs: this.#evaluatedAt,
      lastRefreshAtMs: Number.isFinite(this.#lastRefreshAt) ? this.#lastRefreshAt : 0,
      ...(this.#healthySince !== undefined ? { healthySinceMs: this.#healthySince } : {}),
      sampleCount: this.#sampleCount
    });
  }

  #restoreDurableState(state: IpcAdaptiveResourceBudgetDurableState): boolean {
    if (state.schemaVersion !== 1 || !['baseline', 'guarded', 'restricted'].includes(state.mode)) return false;
    if (!Number.isInteger(state.generation) || state.generation < 0 || !Number.isFinite(state.evaluatedAtMs) || !Number.isFinite(state.lastRefreshAtMs)) return false;
    if (!Number.isInteger(state.sampleCount) || state.sampleCount < 0) return false;
    if (state.healthySinceMs !== undefined && !Number.isFinite(state.healthySinceMs)) return false;
    this.#mode = state.mode;
    this.#reason = state.reason;
    this.#generation = state.generation;
    this.#evaluatedAt = state.evaluatedAtMs;
    this.#lastRefreshAt = state.lastRefreshAtMs;
    this.#healthySince = state.healthySinceMs;
    this.#sampleCount = state.sampleCount;
    return true;
  }

  #persist(event: IpcAdaptiveResourceBudgetJournalEvent, now: number): void {
    if (!this.#persistence) return;
    try {
      this.#persistence.persist(this.#durableState(), event, now);
      this.#lastPersistedAt = now;
      if (this.#persistenceStatus !== 'rejected' && this.#persistenceStatus !== 'recovered' && event !== 'restore-rejected' && event !== 'restore') this.#persistenceStatus = 'verified';
      this.#persistenceReason = `PERSISTED_${event.toUpperCase().replaceAll('-', '_')}`;
    } catch (error) {
      this.#reason = 'persistence-failure';
      this.#persistenceStatus = 'write-failed';
      this.#persistenceReason = error instanceof Error ? error.message.slice(0, 160) : 'UNKNOWN_PERSISTENCE_ERROR';
    }
  }

  #applyMode(mode: IpcAdaptiveResourceBudgetMode, reason: IpcAdaptiveResourceBudgetReason): void {
    if (mode !== this.#mode) {
      this.#mode = mode;
      this.#generation += 1;
    }
    this.#reason = reason;
  }
}
