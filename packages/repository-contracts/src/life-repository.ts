import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type { LifeRecordView } from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface LifeRecordRow extends LifeRecordView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly startsAt?: IsoDateTime;
  readonly dueAt?: IsoDateTime;
  readonly createdAt: IsoDateTime;
}

export interface LifeRepositoryPort {
  listLifeRecords(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly LifeRecordRow[]>;
  insertLifeRecord(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: LifeRecordRow
  ): RepositoryResult<void>;
}

/**
 * Narrow pre-authorization lookup used only by the production LIFE PEP
 * resolver. Business reads and writes remain policy-authorized operations.
 */
export interface LifePolicyResourceRepositoryPort {
  findLifeRecordForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<LifeRecordRow | null>;
}

export interface LifeAutomationDueProjectionRow {
  readonly id: string;
  readonly title: string;
  readonly dueAt: IsoDateTime;
}

export interface LifeAutomationRunSourceProjectionRow {
  readonly id: string;
  readonly title: string;
  readonly dueAt?: IsoDateTime;
}

export interface LifeReportOverdueProjectionRow extends LifeAutomationDueProjectionRow {
  readonly sourceType: 'life_record';
}

export interface LifeReportProjection {
  readonly activeTasks: number;
  readonly expiringInsurance: number;
  readonly overdueItems: readonly LifeReportOverdueProjectionRow[];
}

/**
 * Receipt-bound LIFE projections for automation and reports. Dashboard
 * aggregation is intentionally not part of this bounded port.
 */
export interface LifeProjectionRepositoryPort {
  listAutomationDueLife(
    context: PolicyAuthorizedRepositoryExecutionContext,
    input: { readonly fromAt: IsoDateTime; readonly toAt: IsoDateTime }
  ): RepositoryResult<readonly LifeAutomationDueProjectionRow[]>;
  listVisibleAutomationLifeRunSources(
    context: PolicyAuthorizedRepositoryExecutionContext,
    ids: readonly string[]
  ): RepositoryResult<readonly LifeAutomationRunSourceProjectionRow[]>;
  getLifeReportProjection(
    context: PolicyAuthorizedRepositoryExecutionContext,
    input: {
      readonly now: IsoDateTime;
      readonly in30Days: IsoDateTime;
      readonly overdueLimit?: number;
    }
  ): RepositoryResult<LifeReportProjection>;
}
