import type { IsoDateTime, UserId } from '@ppt/core';
import type { DigitalLegacyPlanView, LegacyApprovalView, LegacyGrantView } from '@ppt/domain';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface LegacyPlanRow extends DigitalLegacyPlanView{readonly confirmationNote?:string}

export interface LegacyRepositoryPort {
    listPlans(c: RepositoryExecutionContext): RepositoryResult<readonly LegacyPlanRow[]>;
    findPlan(c: RepositoryExecutionContext, id: string): RepositoryResult<LegacyPlanRow | null>;
    upsertPlan(c: RepositoryExecutionContext, p: LegacyPlanRow): RepositoryResult<void>;
    listGrants(c: RepositoryExecutionContext, planId?: string): RepositoryResult<readonly LegacyGrantView[]>;
    upsertGrant(c: RepositoryExecutionContext, g: LegacyGrantView): RepositoryResult<void>;
    listApprovals(c: RepositoryExecutionContext, planId: string): RepositoryResult<readonly LegacyApprovalView[]>;
    clearApprovals(c: RepositoryExecutionContext, planId: string): RepositoryResult<void>;
    upsertApproval(c: RepositoryExecutionContext, a: LegacyApprovalView): RepositoryResult<void>;
    countApprovals(c: RepositoryExecutionContext, planId: string): RepositoryResult<number>;
    replaceExecutionPermissions(c: RepositoryExecutionContext, planId: string, subject: UserId, grants: readonly LegacyGrantView[], at: IsoDateTime, ids: readonly string[]): RepositoryResult<void>;
    revokeExecutionPermissions(c: RepositoryExecutionContext, planId: string): RepositoryResult<void>;
}
