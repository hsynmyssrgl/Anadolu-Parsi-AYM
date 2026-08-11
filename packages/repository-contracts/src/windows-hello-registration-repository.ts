import type { IsoDateTime, UserId } from '@ppt/core';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export type WindowsHelloRevocationReason =
  | 'manual'
  | 'reenrolled'
  | 'device_changed'
  | 'principal_changed'
  | 'security_epoch_changed';

export interface WindowsHelloRegistrationRow {
  readonly id: string;
  readonly accountId: UserId;
  readonly deviceId: string;
  readonly deviceFingerprint: string;
  readonly windowsPrincipalHash: string;
  readonly displayName: string;
  readonly securityEpoch: number;
  readonly enrolledAt: IsoDateTime;
  readonly lastVerifiedAt?: IsoDateTime;
  readonly revokedAt?: IsoDateTime;
  readonly revocationReason?: WindowsHelloRevocationReason;
}

export interface WindowsHelloRegistrationRepositoryPort {
  findActive(
    context: RepositoryExecutionContext,
    accountId: UserId,
    deviceId: string
  ): RepositoryResult<WindowsHelloRegistrationRow | null>;
  listByAccount(
    context: RepositoryExecutionContext,
    accountId: UserId
  ): RepositoryResult<readonly WindowsHelloRegistrationRow[]>;
  insert(
    context: RepositoryExecutionContext,
    input: WindowsHelloRegistrationRow
  ): RepositoryResult<void>;
  markVerified(
    context: RepositoryExecutionContext,
    input: {
      readonly registrationId: string;
      readonly accountId: UserId;
      readonly deviceId: string;
      readonly deviceFingerprint: string;
      readonly windowsPrincipalHash: string;
      readonly securityEpoch: number;
      readonly verifiedAt: IsoDateTime;
    }
  ): RepositoryResult<boolean>;
  revokeActiveForDevice(
    context: RepositoryExecutionContext,
    input: {
      readonly accountId: UserId;
      readonly registrationId: string;
      readonly deviceId: string;
      readonly revokedAt: IsoDateTime;
      readonly reason: WindowsHelloRevocationReason;
    }
  ): RepositoryResult<number>;
}
