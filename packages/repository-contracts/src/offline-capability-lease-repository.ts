import type { IsoDateTime, UserId } from '@ppt/core';
import type { OfflineCapability } from '@ppt/domain';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface OfflineCapabilityLeaseRow {
  readonly schemaVersion: 1;
  readonly leaseId: string;
  readonly familyId: string;
  readonly subjectAccountId: UserId;
  readonly deviceId: string;
  readonly capability: OfflineCapability;
  readonly issuedAt: IsoDateTime;
  readonly notBefore: IsoDateTime;
  readonly expiresAt: IsoDateTime;
  readonly policyVersion: string;
  readonly policyPackageVersion: number;
  readonly policyPackageSha256: string;
  readonly capabilityManifestSha256: string;
  readonly nonce: string;
  readonly revokedAt?: IsoDateTime;
  readonly leaseSha256: string;
}

export interface OfflineCapabilityLeaseRepositoryPort {
  listForFamily(context: RepositoryExecutionContext, familyId: string): RepositoryResult<readonly OfflineCapabilityLeaseRow[]>;
  findById(context: RepositoryExecutionContext, leaseId: string): RepositoryResult<OfflineCapabilityLeaseRow | undefined>;
  findActiveForScope(context: RepositoryExecutionContext, input: {
    readonly familyId: string;
    readonly subjectAccountId: UserId;
    readonly deviceId: string;
    readonly capability: OfflineCapability;
    readonly occurredAt: IsoDateTime;
  }): RepositoryResult<OfflineCapabilityLeaseRow | undefined>;
  insert(context: RepositoryExecutionContext, lease: OfflineCapabilityLeaseRow): RepositoryResult<void>;
  revoke(context: RepositoryExecutionContext, lease: OfflineCapabilityLeaseRow): RepositoryResult<boolean>;
}
