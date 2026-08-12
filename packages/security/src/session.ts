import type { Clock, IsoDateTime } from '@ppt/core';

export interface SessionSnapshot {
  readonly active: boolean;
  readonly status: 'signed_out' | 'active' | 'warning' | 'locked';
  readonly accountId?: string;
  readonly startedAt?: IsoDateTime;
  readonly lastActivityAt?: IsoDateTime;
  readonly expiresAt?: IsoDateTime;
  readonly warningAt?: IsoDateTime;
  readonly lockedAt?: IsoDateTime;
  readonly lockReason?: 'idle_timeout' | 'manual';
  readonly idleTimeoutMinutes: number;
  readonly warningBeforeSeconds: number;
  readonly secondsRemaining: number;
  readonly securityEpoch?: number;
}

export class InMemorySessionManager {
  private state:
    | {
        accountId: string;
        startedAt: IsoDateTime;
        lastActivityAt: IsoDateTime;
        securityEpoch: number;
        status: 'active' | 'locked';
        lockedAt?: IsoDateTime;
        lockReason?: 'idle_timeout' | 'manual';
      }
    | undefined;

  public constructor(
    private readonly clock: Clock,
    private readonly idleTimeoutMinutes: number,
    private readonly warningBeforeSeconds = 60
  ) {
    if (!Number.isFinite(idleTimeoutMinutes) || idleTimeoutMinutes < 1 || idleTimeoutMinutes > 1_440) {
      throw new Error('Oturum zaman aşımı 1 ile 1440 dakika arasında olmalıdır.');
    }
    if (!Number.isSafeInteger(warningBeforeSeconds) || warningBeforeSeconds < 15 || warningBeforeSeconds >= idleTimeoutMinutes * 60) {
      throw new Error('Oturum uyarı süresi en az 15 saniye ve zaman aşımından kısa olmalıdır.');
    }
  }

  public start(accountId: string, securityEpoch = 0): SessionSnapshot {
    if (!Number.isSafeInteger(securityEpoch) || securityEpoch < 0) throw new Error('Oturum güvenlik dönemi geçersiz.');
    const now = this.clock.now();
    this.state = { accountId, startedAt: now, lastActivityAt: now, securityEpoch, status: 'active' };
    return this.snapshot();
  }

  public clear(): void {
    this.state = undefined;
  }

  public currentAccountId(options: { readonly touch?: boolean } = {}): string | undefined {
    if (!this.state) return undefined;
    this.applyIdleLock();
    if (!this.state || this.state.status === 'locked') return undefined;
    if (options.touch ?? true) this.state.lastActivityAt = this.clock.now();
    return this.state.accountId;
  }

  public recordActivity(): SessionSnapshot {
    if (!this.state) return this.snapshot();
    this.applyIdleLock();
    if (this.state?.status === 'active') this.state.lastActivityAt = this.clock.now();
    return this.snapshot();
  }

  public lock(reason: 'idle_timeout' | 'manual' = 'manual'): SessionSnapshot {
    if (!this.state) return this.snapshot();
    if (this.state.status === 'active') {
      this.state.status = 'locked';
      this.state.lockedAt = reason === 'idle_timeout' ? this.expiresAt(this.state.lastActivityAt) : this.clock.now();
      this.state.lockReason = reason;
    }
    return this.snapshot();
  }

  public snapshot(): SessionSnapshot {
    this.applyIdleLock();
    if (!this.state) return {
      active: false,
      status: 'signed_out',
      idleTimeoutMinutes: this.idleTimeoutMinutes,
      warningBeforeSeconds: this.warningBeforeSeconds,
      secondsRemaining: 0
    };
    const expiresAt = this.expiresAt(this.state.lastActivityAt);
    const warningAt = this.warningAt(this.state.lastActivityAt);
    const secondsRemaining = Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.parse(this.clock.now())) / 1_000));
    const status = this.state.status === 'locked'
      ? 'locked'
      : Date.parse(this.clock.now()) >= Date.parse(warningAt) ? 'warning' : 'active';
    return {
      active: this.state.status === 'active',
      status,
      accountId: this.state.accountId,
      startedAt: this.state.startedAt,
      lastActivityAt: this.state.lastActivityAt,
      expiresAt,
      warningAt,
      ...(this.state.lockedAt ? { lockedAt: this.state.lockedAt } : {}),
      ...(this.state.lockReason ? { lockReason: this.state.lockReason } : {}),
      idleTimeoutMinutes: this.idleTimeoutMinutes,
      warningBeforeSeconds: this.warningBeforeSeconds,
      secondsRemaining,
      securityEpoch: this.state.securityEpoch
    };
  }

  private applyIdleLock(): void {
    if (this.state?.status === 'active' && Date.parse(this.clock.now()) >= Date.parse(this.expiresAt(this.state.lastActivityAt))) {
      this.state.status = 'locked';
      this.state.lockedAt = this.expiresAt(this.state.lastActivityAt);
      this.state.lockReason = 'idle_timeout';
    }
  }

  private expiresAt(lastActivityAt: IsoDateTime): IsoDateTime {
    return new Date(Date.parse(lastActivityAt) + this.idleTimeoutMinutes * 60_000).toISOString() as IsoDateTime;
  }

  private warningAt(lastActivityAt: IsoDateTime): IsoDateTime {
    return new Date(Date.parse(this.expiresAt(lastActivityAt)) - this.warningBeforeSeconds * 1_000).toISOString() as IsoDateTime;
  }
}
