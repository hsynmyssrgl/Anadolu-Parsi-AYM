import type { FamilyId, IsoDateTime } from '@ppt/core';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface ReportFinanceCurrencyRow {
  readonly currency: string;
  readonly assets: number;
  readonly debts: number;
}

/** Non-LIFE report fields. LIFE fields must come from LifeProjectionRepositoryPort. */
export interface ReportNonLifeSummaryRecord {
  readonly peopleCount: number;
  readonly upcomingEvents: number;
  readonly activeMedicationPlans: number;
  readonly financeByCurrency: readonly ReportFinanceCurrencyRow[];
}

export interface ReportRepositoryPort {
  getNonLifeSummary(
    context: RepositoryExecutionContext,
    familyId: FamilyId,
    now: IsoDateTime,
    in30Days: IsoDateTime
  ): RepositoryResult<ReportNonLifeSummaryRecord>;
}
