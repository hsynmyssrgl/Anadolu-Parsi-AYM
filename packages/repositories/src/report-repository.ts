import type { FamilyId, IsoDateTime } from '@ppt/core';
import type {
  ReportNonLifeSummaryRecord,
  ReportRepositoryPort,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';

export class SqliteReportRepository extends SqliteRepository implements ReportRepositoryPort {
  public getNonLifeSummary(
    context: RepositoryExecutionContext,
    familyId: FamilyId,
    now: IsoDateTime,
    in30Days: IsoDateTime
  ): RepositoryResult<ReportNonLifeSummaryRecord> {
    return this.execute(context, () => {
      const count = (sql: string, ...args: unknown[]): number => Number(
        (this.database(context).prepare(sql).get(...args) as { c: number }).c
      );
      const actorPersonId = context.actor.personId;
      const financeByCurrency = actorPersonId
        ? (this.database(context).prepare(`
            SELECT currency,
              SUM(CASE WHEN kind IN ('asset','income') THEN amount ELSE 0 END) assets,
              SUM(CASE WHEN kind IN ('debt','expense') THEN COALESCE(remaining_principal,amount) ELSE 0 END) debts
            FROM finance_records
            WHERE family_id=? AND owner_person_id=?
            GROUP BY currency
            ORDER BY currency
          `).all(familyId, actorPersonId) as Array<{
            currency: string;
            assets: number | null;
            debts: number | null;
          }>).map((row) => ({
            currency: row.currency,
            assets: Number(row.assets ?? 0),
            debts: Number(row.debts ?? 0)
          }))
        : [];

      return {
        peopleCount: count("SELECT COUNT(*) c FROM people WHERE family_id=? AND status='active'", familyId),
        upcomingEvents: count(
          'SELECT COUNT(*) c FROM governed_timeline_events WHERE family_id=? AND start_at>=? AND start_at<=?',
          familyId,
          now,
          in30Days
        ),
        activeMedicationPlans: actorPersonId
          ? count(
              "SELECT COUNT(*) c FROM medication_plans m WHERE m.family_id=? AND m.owner_person_id=? AND m.starts_at<=? AND (m.ends_at IS NULL OR m.ends_at>=?) AND NOT EXISTS (SELECT 1 FROM data_lifecycle dl WHERE dl.resource_type='medication_plan' AND dl.resource_id=m.id AND dl.state<>'active')",
              familyId,
              actorPersonId,
              now,
              now
            )
          : 0,
        financeByCurrency
      };
    });
  }
}
