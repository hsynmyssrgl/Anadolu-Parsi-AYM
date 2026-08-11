import type { FamilyId, IsoDateTime } from '@ppt/core';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface AutomationRuleRow {
  readonly id: string;
  readonly title: string;
  readonly sourceType: string;
  readonly daysBefore: number;
  readonly enabled: boolean;
  readonly createdAt: IsoDateTime;
}

export interface AutomationDueSourceRow {
  readonly id: string;
  readonly title: string;
  readonly dueAt: IsoDateTime;
}

export interface AutomationRunRow {
  readonly id: string;
  readonly ruleId: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly title: string;
  readonly dueAt: IsoDateTime;
  readonly status: string;
  readonly generatedTaskId?: string;
  readonly createdAt: IsoDateTime;
}

/**
 * LIFE title and due-date fields are intentionally absent. A caller must join
 * these identifiers to the receipt-bound LifeProjectionRepositoryPort.
 */
export interface AutomationLifeRunCandidateRow {
  readonly id: string;
  readonly ruleId: string;
  readonly sourceId: string;
  readonly status: string;
  readonly generatedTaskId?: string;
  readonly createdAt: IsoDateTime;
}

export interface AutomationRepositoryPort {
  listRules(context: RepositoryExecutionContext): RepositoryResult<readonly AutomationRuleRow[]>;
  insertRule(context: RepositoryExecutionContext, input: AutomationRuleRow): RepositoryResult<void>;
  setRuleEnabled(context: RepositoryExecutionContext, id: string, enabled: boolean): RepositoryResult<boolean>;
  listEnabledRules(context: RepositoryExecutionContext): RepositoryResult<readonly AutomationRuleRow[]>;
  listNonLifeDueSources(
    context: RepositoryExecutionContext,
    sourceType: string,
    familyId: FamilyId,
    fromAt: IsoDateTime,
    toAt: IsoDateTime
  ): RepositoryResult<readonly AutomationDueSourceRow[]>;
  runExists(
    context: RepositoryExecutionContext,
    ruleId: string,
    sourceType: string,
    sourceId: string
  ): RepositoryResult<boolean>;
  resolveTaskOwnerPersonId(
    context: RepositoryExecutionContext,
    actorId: string,
    familyId: FamilyId
  ): RepositoryResult<string | null>;
  insertRun(context: RepositoryExecutionContext, input: AutomationRunRow): RepositoryResult<void>;
  listNonLifeRuns(
    context: RepositoryExecutionContext,
    familyId: FamilyId,
    limit: number
  ): RepositoryResult<readonly AutomationRunRow[]>;
  listLifeRunCandidates(
    context: RepositoryExecutionContext,
    input: {
      readonly limit: number;
      readonly before?: {
        readonly createdAt: IsoDateTime;
        readonly id: string;
      };
    }
  ): RepositoryResult<readonly AutomationLifeRunCandidateRow[]>;
}
