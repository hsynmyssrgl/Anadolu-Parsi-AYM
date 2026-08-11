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

/**
 * Content-free mutation ledger input. Source title and schedule deliberately do
 * not cross this persistence port. A reader may project them only through the
 * source-specific live PEP; where no such PEP exists, it must fail closed.
 */
export interface AutomationRunLedgerRow {
  readonly id: string;
  readonly ruleId: string;
  readonly sourceType: string;
  readonly sourceId: string;
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
  insertRun(context: RepositoryExecutionContext, input: AutomationRunLedgerRow): RepositoryResult<void>;
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
