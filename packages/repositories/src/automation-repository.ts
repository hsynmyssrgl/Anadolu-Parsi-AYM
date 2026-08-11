import type { FamilyId, IsoDateTime } from '@ppt/core';
import type {
  AutomationDueSourceRow,
  AutomationLifeRunCandidateRow,
  AutomationRepositoryPort,
  AutomationRuleRow,
  AutomationRunRow,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';

const mapRule = (row: Record<string, unknown>): AutomationRuleRow => ({
  id: String(row.id),
  title: String(row.title),
  sourceType: String(row.source_type),
  daysBefore: Number(row.days_before),
  enabled: Number(row.enabled) === 1,
  createdAt: String(row.created_at) as IsoDateTime
});

const mapRun = (row: Record<string, unknown>): AutomationRunRow => ({
  id: String(row.id),
  ruleId: String(row.rule_id),
  sourceType: String(row.source_type),
  sourceId: String(row.source_id),
  title: String(row.title),
  dueAt: String(row.due_at) as IsoDateTime,
  status: String(row.status),
  ...(row.generated_task_id ? { generatedTaskId: String(row.generated_task_id) } : {}),
  createdAt: String(row.created_at) as IsoDateTime
});

const mapLifeCandidate = (row: Record<string, unknown>): AutomationLifeRunCandidateRow => ({
  id: String(row.id),
  ruleId: String(row.rule_id),
  sourceId: String(row.source_id),
  status: String(row.status),
  ...(row.generated_task_id ? { generatedTaskId: String(row.generated_task_id) } : {}),
  createdAt: String(row.created_at) as IsoDateTime
});

export class SqliteAutomationRepository extends SqliteRepository implements AutomationRepositoryPort {
  public listRules(context: RepositoryExecutionContext): RepositoryResult<readonly AutomationRuleRow[]> {
    return this.execute(context, () => (this.database(context).prepare(
      'SELECT id,title,source_type,days_before,enabled,created_at FROM automation_rules ORDER BY created_at DESC'
    ).all() as Array<Record<string, unknown>>).map(mapRule));
  }

  public insertRule(context: RepositoryExecutionContext, input: AutomationRuleRow): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(
        'INSERT INTO automation_rules (id,title,source_type,days_before,enabled,created_at) VALUES (?,?,?,?,?,?)'
      ).run(input.id, input.title, input.sourceType, input.daysBefore, input.enabled ? 1 : 0, input.createdAt);
    });
  }

  public setRuleEnabled(
    context: RepositoryExecutionContext,
    id: string,
    enabled: boolean
  ): RepositoryResult<boolean> {
    return this.execute(context, () => this.database(context)
      .prepare('UPDATE automation_rules SET enabled=? WHERE id=?')
      .run(enabled ? 1 : 0, id).changes > 0);
  }

  public listEnabledRules(context: RepositoryExecutionContext): RepositoryResult<readonly AutomationRuleRow[]> {
    return this.execute(context, () => (this.database(context).prepare(
      'SELECT id,title,source_type,days_before,enabled,created_at FROM automation_rules WHERE enabled=1 ORDER BY created_at,id'
    ).all() as Array<Record<string, unknown>>).map(mapRule));
  }

  public listNonLifeDueSources(
    context: RepositoryExecutionContext,
    sourceType: string,
    familyId: FamilyId,
    fromAt: IsoDateTime,
    toAt: IsoDateTime
  ): RepositoryResult<readonly AutomationDueSourceRow[]> {
    return this.execute(context, () => {
      let sql = '';
      let args: unknown[] = [familyId, fromAt, toAt];
      if (sourceType === 'important_day') {
        sql = 'SELECT id,title,start_at due_at FROM governed_timeline_events WHERE family_id=? AND start_at>=? AND start_at<=?';
      } else if (sourceType === 'finance_record') {
        if (!context.actor.personId) return [];
        sql = 'SELECT id,title,due_at FROM finance_records WHERE family_id=? AND owner_person_id=? AND due_at IS NOT NULL AND due_at>=? AND due_at<=?';
        args = [familyId, context.actor.personId, fromAt, toAt];
      } else if (sourceType === 'medication_plan') {
        if (!context.actor.personId) return [];
        sql = "SELECT m.id,'İlaç planı' title,m.starts_at due_at FROM medication_plans m WHERE m.family_id=? AND m.owner_person_id=? AND m.starts_at>=? AND m.starts_at<=? AND (m.ends_at IS NULL OR m.ends_at>=?) AND NOT EXISTS (SELECT 1 FROM data_lifecycle dl WHERE dl.resource_type='medication_plan' AND dl.resource_id=m.id AND dl.state<>'active')";
        args = [familyId, context.actor.personId, fromAt, toAt, fromAt];
      } else {
        return [];
      }
      return (this.database(context).prepare(sql).all(...args) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        title: String(row.title),
        dueAt: String(row.due_at) as IsoDateTime
      }));
    });
  }

  public runExists(
    context: RepositoryExecutionContext,
    ruleId: string,
    sourceType: string,
    sourceId: string
  ): RepositoryResult<boolean> {
    return this.execute(context, () => Boolean(this.database(context).prepare(
      'SELECT 1 FROM automation_runs WHERE rule_id=? AND source_type=? AND source_id=?'
    ).get(ruleId, sourceType, sourceId)));
  }

  public resolveTaskOwnerPersonId(
    context: RepositoryExecutionContext,
    actorId: string,
    familyId: FamilyId
  ): RepositoryResult<string | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(
        'SELECT people.id person_id FROM accounts JOIN people ON people.id=accounts.person_id WHERE accounts.id=? AND people.family_id=?'
      ).get(actorId, familyId) as { person_id?: unknown } | undefined;
      return row?.person_id ? String(row.person_id) : null;
    });
  }

  public insertRun(context: RepositoryExecutionContext, input: AutomationRunRow): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(
        'INSERT INTO automation_runs (id,rule_id,source_type,source_id,title,due_at,status,generated_task_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)'
      ).run(
        input.id,
        input.ruleId,
        input.sourceType,
        input.sourceId,
        input.title,
        input.dueAt,
        input.status,
        input.generatedTaskId ?? null,
        input.createdAt
      );
    });
  }

  public listNonLifeRuns(
    context: RepositoryExecutionContext,
    familyId: FamilyId,
    limit: number
  ): RepositoryResult<readonly AutomationRunRow[]> {
    return this.execute(context, () => {
      const actorPersonId = context.actor.personId ?? null;
      const rows = this.database(context).prepare(`
        SELECT ar.id, ar.rule_id, ar.source_type, ar.source_id,
          CASE WHEN ar.source_type='medication_plan' THEN 'İlaç planı' ELSE ar.title END title,
          ar.due_at, ar.status, ar.generated_task_id, ar.created_at
        FROM automation_runs ar
        WHERE ar.source_type<>'life_record' AND (
          (ar.source_type='important_day' AND EXISTS (
            SELECT 1 FROM governed_timeline_events e WHERE e.id=ar.source_id AND e.family_id=?
          ))
          OR (ar.source_type='finance_record' AND ? IS NOT NULL AND EXISTS (
            SELECT 1 FROM finance_records f WHERE f.id=ar.source_id AND f.family_id=? AND f.owner_person_id=?
          ))
          OR (ar.source_type='medication_plan' AND ? IS NOT NULL AND EXISTS (
            SELECT 1 FROM medication_plans m WHERE m.id=ar.source_id AND m.family_id=? AND m.owner_person_id=? AND (m.ends_at IS NULL OR m.ends_at>=?)
              AND NOT EXISTS (SELECT 1 FROM data_lifecycle dl WHERE dl.resource_type='medication_plan' AND dl.resource_id=m.id AND dl.state<>'active')
          ))
        )
        ORDER BY ar.created_at DESC
        LIMIT ?
      `).all(
        familyId,
        actorPersonId, familyId, actorPersonId,
        actorPersonId, familyId, actorPersonId, context.occurredAt,
        limit
      ) as Array<Record<string, unknown>>;
      return rows.map(mapRun);
    });
  }

  public listLifeRunCandidates(
    context: RepositoryExecutionContext,
    input: {
      readonly limit: number;
      readonly before?: { readonly createdAt: IsoDateTime; readonly id: string };
    }
  ): RepositoryResult<readonly AutomationLifeRunCandidateRow[]> {
    return this.execute(context, () => {
      const boundedLimit = Number.isInteger(input.limit)
        ? Math.min(Math.max(input.limit, 1), 500)
        : 1;
      const sql = input.before
        ? `SELECT id,rule_id,source_id,status,generated_task_id,created_at
           FROM automation_runs
           WHERE source_type='life_record'
             AND (created_at<? OR (created_at=? AND id<?))
           ORDER BY created_at DESC,id DESC
           LIMIT ?`
        : `SELECT id,rule_id,source_id,status,generated_task_id,created_at
           FROM automation_runs
           WHERE source_type='life_record'
           ORDER BY created_at DESC,id DESC
           LIMIT ?`;
      const rows = input.before
        ? this.database(context).prepare(sql).all(
            input.before.createdAt,
            input.before.createdAt,
            input.before.id,
            boundedLimit
          )
        : this.database(context).prepare(sql).all(boundedLimit);
      return (rows as Array<Record<string, unknown>>).map(mapLifeCandidate);
    });
  }
}
