import {
  asIsoDateTime,
  ok,
  type AppError,
  type CorrelationId,
  type FamilyId,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import type { FamilyRole, ReportSummaryView } from '@ppt/domain';

export interface ReportApplicationContext {
  readonly actorId: UserId;
  readonly actorRole: FamilyRole;
  readonly actorPersonId?: PersonId;
  readonly familyId: FamilyId;
  readonly correlationId: CorrelationId;
  readonly occurredAt: IsoDateTime;
}

export interface ReportFinanceCurrencyRecord {
  readonly currency: string;
  readonly assets: number;
  readonly debts: number;
}

export interface ReportOverdueRecord {
  readonly id: string;
  readonly title: string;
  readonly sourceType: string;
  readonly dueAt: IsoDateTime;
}

export interface ReportSummaryRecord {
  readonly peopleCount: number;
  readonly upcomingEvents: number;
  readonly activeTasks: number;
  readonly expiringInsurance: number;
  readonly activeMedicationPlans: number;
  readonly financeByCurrency: readonly ReportFinanceCurrencyRecord[];
  readonly overdueItems: readonly ReportOverdueRecord[];
}

export interface ReportQueryPort {
  getSummary(
    context: ReportApplicationContext,
    now: IsoDateTime,
    in30Days: IsoDateTime
  ): Promise<Result<ReportSummaryRecord, AppError>>;
}

export class GetReportSummaryUseCase {
  public constructor(private readonly query: ReportQueryPort) {}

  public async execute(context: ReportApplicationContext): Promise<Result<ReportSummaryView, AppError>> {
    const current = new Date(context.occurredAt);
    const in30Days = asIsoDateTime(new Date(current.getTime() + 30 * 86400000).toISOString());
    const result = await this.query.getSummary(context, context.occurredAt, in30Days);
    if (!result.ok) return result;
    return ok({
      generatedAt: context.occurredAt,
      peopleCount: result.value.peopleCount,
      upcomingEvents: result.value.upcomingEvents,
      activeTasks: result.value.activeTasks,
      expiringInsurance: result.value.expiringInsurance,
      activeMedicationPlans: result.value.activeMedicationPlans,
      financeByCurrency: result.value.financeByCurrency.map((record) => ({
        currency: record.currency,
        assets: record.assets,
        debts: record.debts,
        net: record.assets - record.debts
      })),
      overdueItems: result.value.overdueItems.map((record) => ({
        id: record.id,
        title: record.title,
        sourceType: record.sourceType,
        dueAt: record.dueAt
      }))
    });
  }
}
