import type { FamilyId, IsoDateTime } from '@ppt/core';
import type {
  AutomationLifeRunCandidateRow,
  AutomationRepositoryPort,
  AutomationRuleRow,
  AutomationRunLedgerRow,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';

const REDACTED_RUN_TITLE = '__PPK016_SOURCE_CONTENT_REDACTED__';

const mapRule = (row: Record<string, unknown>): AutomationRuleRow => ({
  id: String(row.id),
  title: String(row.title),
  sourceType: String(row.source_type),
  daysBefore: Number(row.days_before),
  enabled: Number(row.enabled) === 1,
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

  public insertRun(context: RepositoryExecutionContext, input: AutomationRunLedgerRow): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(
        'INSERT INTO automation_runs (id,rule_id,source_type,source_id,title,due_at,status,generated_task_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)'
      ).run(
        input.id,
        input.ruleId,
        input.sourceType,
        input.sourceId,
        REDACTED_RUN_TITLE,
        input.createdAt,
        input.status,
        input.generatedTaskId ?? null,
        input.createdAt
      );
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
