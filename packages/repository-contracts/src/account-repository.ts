import type { IsoDateTime, UserId } from '@ppt/core';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface AccountRow {
  readonly id: UserId;
  readonly displayName: string;
  readonly email: string;
  readonly passwordRecord: string;
  readonly role: string;
  readonly status: string;
  readonly personId?: string;
  readonly startsAt: IsoDateTime;
  readonly endsAt?: IsoDateTime;
  readonly failedLoginCount: number;
  readonly securityEpoch: number;
  readonly lockedUntil?: IsoDateTime;
  readonly totpSecret?: string;
  readonly recoveryCodes?: string;
  readonly pendingTotpSecret?: string;
  readonly pendingRecoveryCodes?: string;
  readonly createdAt: IsoDateTime;
}

export interface InsertAccountInput {
  readonly id: UserId;
  readonly displayName: string;
  readonly email: string;
  readonly passwordRecord: string;
  readonly role: string;
  readonly status: string;
  readonly startsAt: IsoDateTime;
  readonly endsAt?: IsoDateTime;
  readonly personId?: string;
  readonly createdAt: IsoDateTime;
}


export interface ProtectLegacyTwoFactorSecretsInput {
  readonly accountId: UserId;
  readonly active?: {
    readonly expectedPlaintext: string;
    readonly protectedValue: string;
  };
  readonly pending?: {
    readonly expectedPlaintext: string;
    readonly protectedValue: string;
  };
}

export interface AccountRepositoryPort {
    count(context: RepositoryExecutionContext): RepositoryResult<number>;
    findByEmail(context: RepositoryExecutionContext, email: string): RepositoryResult<AccountRow | null>;
    findById(context: RepositoryExecutionContext, id: UserId): RepositoryResult<AccountRow | null>;
    insert(context: RepositoryExecutionContext, input: InsertAccountInput): RepositoryResult<void>;
    list(context: RepositoryExecutionContext): RepositoryResult<readonly AccountRow[]>;
    ensureFamilyAdminExists(context: RepositoryExecutionContext): RepositoryResult<boolean>;
    updateMembership(context: RepositoryExecutionContext, input: {
        readonly accountId: UserId;
        readonly role: string;
        readonly status: string;
        readonly personId?: string;
        readonly startsAt: IsoDateTime;
        readonly endsAt?: IsoDateTime;
    }): RepositoryResult<boolean>;
    recordLoginFailure(context: RepositoryExecutionContext, input: {
        readonly accountId: UserId;
        readonly failedLoginCount: number;
        readonly lockedUntil?: IsoDateTime;
    }): RepositoryResult<void>;
    clearLoginFailures(context: RepositoryExecutionContext, accountId: UserId): RepositoryResult<void>;
    advanceSecurityEpoch(context: RepositoryExecutionContext, accountId: UserId): RepositoryResult<number>;
    updatePassword(context: RepositoryExecutionContext, accountId: UserId, passwordRecord: string): RepositoryResult<void>;
    savePendingTwoFactor(context: RepositoryExecutionContext, input: {
        readonly accountId: UserId;
        readonly secret: string;
        readonly recoveryCodes: string;
    }): RepositoryResult<void>;
    enableTwoFactor(context: RepositoryExecutionContext, accountId: UserId): RepositoryResult<void>;
    disableTwoFactor(context: RepositoryExecutionContext, accountId: UserId): RepositoryResult<void>;
    updateRecoveryCodes(context: RepositoryExecutionContext, accountId: UserId, recoveryCodes: string): RepositoryResult<void>;
    protectLegacyTwoFactorSecrets(context: RepositoryExecutionContext, input: ProtectLegacyTwoFactorSecretsInput): RepositoryResult<boolean>;
}
