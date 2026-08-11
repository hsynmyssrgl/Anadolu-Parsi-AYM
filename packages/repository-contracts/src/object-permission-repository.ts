import type { FamilyBranchId, IsoDateTime, UserId } from '@ppt/core';
import type { AuthorizationPurpose, ObjectPermissionAction } from '@ppt/domain';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface ObjectPermissionRow {
  readonly id: string;
  readonly subjectAccountId: UserId;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly actions: readonly ObjectPermissionAction[];
  readonly effect: 'allow' | 'deny';
  readonly purpose: AuthorizationPurpose;
  readonly familyBranchId?: FamilyBranchId;
  readonly denialReason?: string;
  readonly startsAt: IsoDateTime;
  readonly endsAt?: IsoDateTime;
  readonly createdAt: IsoDateTime;
}

export interface ObjectPermissionRepositoryPort {
    listAll(context: RepositoryExecutionContext): RepositoryResult<readonly ObjectPermissionRow[]>;
    listActiveForSubject(context: RepositoryExecutionContext, accountId: UserId, occurredAt: IsoDateTime): RepositoryResult<readonly ObjectPermissionRow[]>;
    upsert(context: RepositoryExecutionContext, input: ObjectPermissionRow): RepositoryResult<void>;
    delete(context: RepositoryExecutionContext, id: string): RepositoryResult<boolean>;
}
