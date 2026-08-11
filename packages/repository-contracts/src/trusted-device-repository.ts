import type { IsoDateTime, UserId } from '@ppt/core';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface TrustedDeviceRow {
  readonly id: string;
  readonly accountId: UserId;
  readonly deviceId: string;
  readonly displayName: string;
  readonly fingerprint: string;
  readonly publicKeyPem: string;
  readonly trustedAt: IsoDateTime;
  readonly lastSeenAt: IsoDateTime;
  readonly securityEpoch: number;
  readonly revokedAt?: IsoDateTime;
}

export interface TrustedDeviceRepositoryPort {
    findActive(context: RepositoryExecutionContext, accountId: UserId, deviceId: string): RepositoryResult<TrustedDeviceRow | null>;
    listByAccount(context: RepositoryExecutionContext, accountId: UserId): RepositoryResult<readonly TrustedDeviceRow[]>;
    upsert(context: RepositoryExecutionContext, input: TrustedDeviceRow): RepositoryResult<void>;
    touch(context: RepositoryExecutionContext, accountId: UserId, deviceId: string, lastSeenAt: IsoDateTime): RepositoryResult<void>;
    revoke(context: RepositoryExecutionContext, accountId: UserId, trustedDeviceId: string, revokedAt: IsoDateTime): RepositoryResult<void>;
    revokeAll(context: RepositoryExecutionContext, accountId: UserId, revokedAt: IsoDateTime): RepositoryResult<void>;
}
