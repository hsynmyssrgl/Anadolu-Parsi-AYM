import type {
  IpcAdaptiveBudgetMaintenanceReauthenticationDurableAttempt,
  IpcAdaptiveBudgetMaintenanceReauthenticationDurableSnapshot,
  IpcAdaptiveBudgetMaintenanceReauthenticationPersistence,
  IpcAdaptiveBudgetMaintenanceReauthenticationRestoreResult
} from './ipc-adaptive-budget-maintenance-reauthentication-state.js';

export interface IpcAdaptiveBudgetMaintenanceReauthenticationGuardOptions {
  readonly maximumFailedAttempts?: number;
  readonly lockDurationMs?: number;
  readonly failureWindowMs?: number;
  readonly maximumTrackedContexts?: number;
  readonly persistence?: IpcAdaptiveBudgetMaintenanceReauthenticationPersistence;
}

export interface IpcAdaptiveBudgetMaintenanceReauthenticationThrottleView {
  readonly locked: boolean;
  readonly failedAttempts: number;
  readonly remainingAttempts: number;
  readonly maximumAttempts: number;
  readonly retryAfterSeconds?: number;
  readonly lockedUntil?: string;
}

export interface IpcAdaptiveBudgetMaintenanceReauthenticationGuardRestoreView {
  readonly status: IpcAdaptiveBudgetMaintenanceReauthenticationRestoreResult['status'] | 'DISABLED';
  readonly reason: string;
  readonly restoredContextCount: number;
  readonly recoveryHold: boolean;
  readonly recoveryHoldUntil?: string;
  readonly quarantinePath?: string;
  readonly classification?: IpcAdaptiveBudgetMaintenanceReauthenticationRestoreResult['classification'];
  readonly stateRewriteCompleted?: boolean;
}

interface AttemptState {
  readonly failedAttempts: number;
  readonly firstFailureAt: number;
  readonly lastFailureAt: number;
  readonly lockedUntil?: number;
}

const DEFAULT_MAXIMUM_FAILED_ATTEMPTS = 5;
const DEFAULT_LOCK_DURATION_MS = 5 * 60_000;
const DEFAULT_FAILURE_WINDOW_MS = 10 * 60_000;
const DEFAULT_MAXIMUM_TRACKED_CONTEXTS = 256;
const CONTEXT_KEY_PATTERN = /^[a-f0-9]{64}$/u;

const positiveInteger = (value: number | undefined, fallback: number): number =>
  Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;

export class IpcAdaptiveBudgetMaintenanceReauthenticationGuard {
  readonly #maximumFailedAttempts: number;
  readonly #lockDurationMs: number;
  readonly #failureWindowMs: number;
  readonly #maximumTrackedContexts: number;
  readonly #persistence: IpcAdaptiveBudgetMaintenanceReauthenticationPersistence | undefined;
  readonly #attempts = new Map<string, AttemptState>();
  #recoveryHoldUntil: number | undefined;

  constructor(options: IpcAdaptiveBudgetMaintenanceReauthenticationGuardOptions = {}) {
    this.#maximumFailedAttempts = positiveInteger(options.maximumFailedAttempts, DEFAULT_MAXIMUM_FAILED_ATTEMPTS);
    this.#lockDurationMs = positiveInteger(options.lockDurationMs, DEFAULT_LOCK_DURATION_MS);
    this.#failureWindowMs = positiveInteger(options.failureWindowMs, DEFAULT_FAILURE_WINDOW_MS);
    this.#maximumTrackedContexts = positiveInteger(options.maximumTrackedContexts, DEFAULT_MAXIMUM_TRACKED_CONTEXTS);
    this.#persistence = options.persistence;
  }

  restore(now = Date.now()): IpcAdaptiveBudgetMaintenanceReauthenticationGuardRestoreView {
    this.#attempts.clear();
    this.#recoveryHoldUntil = undefined;
    if (!this.#persistence) {
      return Object.freeze({ status: 'DISABLED', reason: 'PERSISTENCE_NOT_CONFIGURED', restoredContextCount: 0, recoveryHold: false });
    }
    const result = this.#persistence.load(now);
    if (result.status === 'RESTORED' && result.snapshot) {
      this.#recoveryHoldUntil = result.snapshot.recoveryHoldUntil;
      for (const attempt of [...result.snapshot.attempts].sort((left, right) => left.lastFailureAt - right.lastFailureAt)) {
        this.#attempts.set(attempt.contextKey, {
          failedAttempts: Math.min(this.#maximumFailedAttempts, attempt.failedAttempts),
          firstFailureAt: attempt.firstFailureAt,
          lastFailureAt: attempt.lastFailureAt,
          ...(attempt.lockedUntil === undefined ? {} : { lockedUntil: attempt.lockedUntil })
        });
      }
      const changed = this.#enforceCapacity() || this.#prune(now);
      if (changed || result.requiresRewrite === true) this.#persist(now);
    } else if (result.status === 'REJECTED') {
      this.#recoveryHoldUntil = now + this.#lockDurationMs;
      this.#persist(now);
    } else if (result.status === 'UNAVAILABLE') {
      this.#recoveryHoldUntil = now + this.#lockDurationMs;
    } else {
      this.#persist(now);
    }
    const recoveryHold = this.#recoveryHoldUntil !== undefined && this.#recoveryHoldUntil > now;
    return Object.freeze({
      status: result.status,
      reason: result.reason,
      restoredContextCount: this.#attempts.size,
      recoveryHold,
      ...(recoveryHold && this.#recoveryHoldUntil !== undefined ? { recoveryHoldUntil: new Date(this.#recoveryHoldUntil).toISOString() } : {}),
      ...(result.quarantinePath ? { quarantinePath: result.quarantinePath } : {}),
      ...(result.classification ? { classification: result.classification } : {}),
      ...(result.requiresRewrite === true ? { stateRewriteCompleted: true } : {})
    });
  }

  status(contextKey: string, now = Date.now()): IpcAdaptiveBudgetMaintenanceReauthenticationThrottleView {
    this.#assertContextKey(contextKey);
    if (this.#prune(now)) this.#persist(now);
    if (this.#recoveryHoldUntil !== undefined && this.#recoveryHoldUntil > now) {
      return this.#view(undefined, now, this.#recoveryHoldUntil);
    }
    return this.#view(this.#attempts.get(contextKey), now);
  }

  recordFailure(contextKey: string, now = Date.now()): IpcAdaptiveBudgetMaintenanceReauthenticationThrottleView {
    const current = this.status(contextKey, now);
    if (current.locked) return current;
    const previous = this.#attempts.get(contextKey);
    const failedAttempts = Math.min(this.#maximumFailedAttempts, (previous?.failedAttempts ?? 0) + 1);
    const lockedUntil = failedAttempts >= this.#maximumFailedAttempts ? now + this.#lockDurationMs : undefined;
    this.#attempts.delete(contextKey);
    this.#attempts.set(contextKey, {
      failedAttempts,
      firstFailureAt: previous?.firstFailureAt ?? now,
      lastFailureAt: now,
      ...(lockedUntil === undefined ? {} : { lockedUntil })
    });
    this.#enforceCapacity();
    this.#persist(now);
    return this.#view(this.#attempts.get(contextKey), now);
  }

  recordSuccess(contextKey: string, now = Date.now()): void {
    this.#assertContextKey(contextKey);
    if (this.#attempts.delete(contextKey)) this.#persist(now);
  }

  clear(contextKey: string, now = Date.now()): void {
    this.#assertContextKey(contextKey);
    if (this.#attempts.delete(contextKey)) this.#persist(now);
  }

  clearAll(now = Date.now()): void {
    this.#attempts.clear();
    this.#recoveryHoldUntil = undefined;
    if (this.#persistence) this.#persist(now);
  }

  clearMemory(): void {
    this.#attempts.clear();
    this.#recoveryHoldUntil = undefined;
  }

  trackedContextCount(now = Date.now()): number {
    if (this.#prune(now)) this.#persist(now);
    return this.#attempts.size;
  }

  #view(state: AttemptState | undefined, now: number, forcedLockedUntil?: number): IpcAdaptiveBudgetMaintenanceReauthenticationThrottleView {
    const lockedUntil = forcedLockedUntil ?? state?.lockedUntil;
    const locked = lockedUntil !== undefined && lockedUntil > now;
    const failedAttempts = forcedLockedUntil === undefined ? state?.failedAttempts ?? 0 : this.#maximumFailedAttempts;
    return Object.freeze({
      locked,
      failedAttempts,
      remainingAttempts: locked ? 0 : Math.max(0, this.#maximumFailedAttempts - failedAttempts),
      maximumAttempts: this.#maximumFailedAttempts,
      ...(locked && lockedUntil !== undefined ? {
        retryAfterSeconds: Math.max(1, Math.ceil((lockedUntil - now) / 1_000)),
        lockedUntil: new Date(lockedUntil).toISOString()
      } : {})
    });
  }

  #prune(now: number): boolean {
    let changed = false;
    if (this.#recoveryHoldUntil !== undefined && this.#recoveryHoldUntil <= now) {
      this.#recoveryHoldUntil = undefined;
      changed = true;
    }
    for (const [key, state] of this.#attempts) {
      const lockExpired = state.lockedUntil !== undefined && state.lockedUntil <= now;
      const failureWindowExpired = state.lockedUntil === undefined && now - state.lastFailureAt >= this.#failureWindowMs;
      if (lockExpired || failureWindowExpired) {
        this.#attempts.delete(key);
        changed = true;
      }
    }
    return changed;
  }

  #enforceCapacity(): boolean {
    let changed = false;
    while (this.#attempts.size > this.#maximumTrackedContexts) {
      const oldest = this.#attempts.keys().next().value as string | undefined;
      if (!oldest) break;
      this.#attempts.delete(oldest);
      changed = true;
    }
    return changed;
  }

  #snapshot(): IpcAdaptiveBudgetMaintenanceReauthenticationDurableSnapshot {
    const attempts: IpcAdaptiveBudgetMaintenanceReauthenticationDurableAttempt[] = [...this.#attempts.entries()].map(([contextKey, state]) => ({
      contextKey,
      failedAttempts: state.failedAttempts,
      firstFailureAt: state.firstFailureAt,
      lastFailureAt: state.lastFailureAt,
      ...(state.lockedUntil === undefined ? {} : { lockedUntil: state.lockedUntil })
    }));
    return Object.freeze({
      schemaVersion: 1,
      ...(this.#recoveryHoldUntil === undefined ? {} : { recoveryHoldUntil: this.#recoveryHoldUntil }),
      attempts: Object.freeze(attempts)
    });
  }

  #persist(now: number): void {
    this.#persistence?.save(this.#snapshot(), now);
  }

  #assertContextKey(contextKey: string): void {
    if (!CONTEXT_KEY_PATTERN.test(contextKey)) throw new Error('Bakım yeniden doğrulama bağlam anahtarı geçersiz.');
  }
}
