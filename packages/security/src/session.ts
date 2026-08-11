import type { Clock, IsoDateTime } from '@ppt/core';

export interface SessionSnapshot {
  readonly active: boolean;
  readonly accountId?: string;
  readonly startedAt?: IsoDateTime;
  readonly lastActivityAt?: IsoDateTime;
  readonly expiresAt?: IsoDateTime;
  readonly securityEpoch?: number;
}

export class InMemorySessionManager {
  private state:
    | {
        accountId: string;
        startedAt: IsoDateTime;
        lastActivityAt: IsoDateTime;
        securityEpoch: number;
      }
    | undefined;

  public constructor(
    private readonly clock: Clock,
    private readonly idleTimeoutMinutes: number
  ) {
    if (!Number.isFinite(idleTimeoutMinutes) || idleTimeoutMinutes < 1 || idleTimeoutMinutes > 1_440) {
      throw new Error('Oturum zaman aşımı 1 ile 1440 dakika arasında olmalıdır.');
    }
  }

  public start(accountId: string, securityEpoch = 0): SessionSnapshot {
    if (!Number.isSafeInteger(securityEpoch) || securityEpoch < 0) throw new Error('Oturum güvenlik dönemi geçersiz.');
    const now = this.clock.now();
    this.state = { accountId, startedAt: now, lastActivityAt: now, securityEpoch };
    return this.snapshot();
  }

  public clear(): void {
    this.state = undefined;
  }

  public currentAccountId(options: { readonly touch?: boolean } = {}): string | undefined {
    if (!this.state) return undefined;
    if (this.isExpired(this.state.lastActivityAt)) {
      this.clear();
      return undefined;
    }
    if (options.touch ?? true) this.state.lastActivityAt = this.clock.now();
    return this.state.accountId;
  }

  public snapshot(): SessionSnapshot {
    const accountId = this.currentAccountId({ touch: false });
    if (!accountId || !this.state) return { active: false };
    return {
      active: true,
      accountId,
      startedAt: this.state.startedAt,
      lastActivityAt: this.state.lastActivityAt,
      expiresAt: this.expiresAt(this.state.lastActivityAt),
      securityEpoch: this.state.securityEpoch
    };
  }

  private isExpired(lastActivityAt: IsoDateTime): boolean {
    return Date.parse(this.clock.now()) >= Date.parse(this.expiresAt(lastActivityAt));
  }

  private expiresAt(lastActivityAt: IsoDateTime): IsoDateTime {
    return new Date(Date.parse(lastActivityAt) + this.idleTimeoutMinutes * 60_000).toISOString() as IsoDateTime;
  }
}
