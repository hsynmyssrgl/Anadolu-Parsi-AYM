import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type FamilyId,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import type {
  AutomationRuleView,
  AutomationRunView,
  CreateAutomationRuleInput,
  FamilyRole
} from '@ppt/domain';

export interface AutomationApplicationContext {
  readonly actorId: UserId;
  readonly actorRole: FamilyRole;
  readonly actorPersonId?: PersonId;
  readonly familyId: FamilyId;
  readonly correlationId: CorrelationId;
  readonly occurredAt: IsoDateTime;
}

export interface AutomationRuleRecord {
  readonly id: string;
  readonly title: string;
  readonly sourceType: string;
  readonly daysBefore: number;
  readonly enabled: boolean;
  readonly createdAt: IsoDateTime;
}

export interface AutomationRunRecord {
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

export interface AutomationExecutionIdentifiers {
  readonly nextRunId: () => string;
  readonly nextTaskId: () => string;
  readonly nextAuditId: () => string;
}

export interface AutomationPort {
  listRules(context: AutomationApplicationContext): Promise<Result<readonly AutomationRuleRecord[], AppError>>;
  insertRule(context: AutomationApplicationContext, record: AutomationRuleRecord): Promise<Result<void, AppError>>;
  setRuleEnabled(context: AutomationApplicationContext, id: string, enabled: boolean): Promise<Result<boolean, AppError>>;
  listRuns(context: AutomationApplicationContext, limit: number): Promise<Result<readonly AutomationRunRecord[], AppError>>;
  executeDueRules(
    context: AutomationApplicationContext,
    now: IsoDateTime,
    identifiers: AutomationExecutionIdentifiers
  ): Promise<Result<number, AppError>>;
}

const ruleView = (record: AutomationRuleRecord): AutomationRuleView => ({
  id: record.id,
  title: record.title,
  sourceType: record.sourceType as AutomationRuleView['sourceType'],
  daysBefore: record.daysBefore,
  enabled: record.enabled,
  createdAt: record.createdAt
});

const runView = (record: AutomationRunRecord): AutomationRunView => ({
  id: record.id,
  ruleId: record.ruleId,
  sourceType: record.sourceType,
  sourceId: record.sourceId,
  title: record.title,
  dueAt: record.dueAt,
  status: record.status as AutomationRunView['status'],
  ...(record.generatedTaskId ? { generatedTaskId: record.generatedTaskId } : {}),
  createdAt: record.createdAt
});

const invalid = (context: AutomationApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_INVALID_ARGUMENT,
  message,
  category: 'validation',
  correlationId: context.correlationId
});

export class ListAutomationRulesUseCase {
  public constructor(private readonly port: AutomationPort) {}

  public async execute(context: AutomationApplicationContext): Promise<Result<readonly AutomationRuleView[], AppError>> {
    const result = await this.port.listRules(context);
    return result.ok ? ok(result.value.map(ruleView)) : result;
  }
}

export class CreateAutomationRuleUseCase {
  public constructor(private readonly port: AutomationPort) {}

  public async execute(
    context: AutomationApplicationContext,
    input: CreateAutomationRuleInput,
    id: string
  ): Promise<Result<void, AppError>> {
    const title = input.title.trim();
    if (!title) return err(invalid(context, 'Otomasyon başlığı zorunludur.'));
    if (!Number.isInteger(input.daysBefore) || input.daysBefore < 0 || input.daysBefore > 365) {
      return err(invalid(context, 'Hatırlatma günü 0-365 arasında olmalıdır.'));
    }
    return this.port.insertRule(context, {
      id,
      title,
      sourceType: input.sourceType,
      daysBefore: input.daysBefore,
      enabled: input.enabled !== false,
      createdAt: context.occurredAt
    });
  }
}

export class ToggleAutomationRuleUseCase {
  public constructor(private readonly port: AutomationPort) {}

  public async execute(
    context: AutomationApplicationContext,
    id: string,
    enabled: boolean
  ): Promise<Result<void, AppError>> {
    const result = await this.port.setRuleEnabled(context, id, enabled);
    if (!result.ok) return result;
    return result.value
      ? ok(undefined)
      : err(createAppError({
          code: ERROR_CODES.RESOURCE_NOT_FOUND,
          message: 'Otomasyon kuralı bulunamadı.',
          category: 'not_found',
          correlationId: context.correlationId
        }));
  }
}

export class ListAutomationRunsUseCase {
  public constructor(private readonly port: AutomationPort) {}

  public async execute(
    context: AutomationApplicationContext,
    limit = 100
  ): Promise<Result<readonly AutomationRunView[], AppError>> {
    const result = await this.port.listRuns(context, Math.min(500, Math.max(1, Math.trunc(limit) || 100)));
    return result.ok ? ok(result.value.map(runView)) : result;
  }
}

export class RunAutomationRulesUseCase {
  public constructor(private readonly port: AutomationPort) {}

  public execute(
    context: AutomationApplicationContext,
    nowInput: string | undefined,
    identifiers: AutomationExecutionIdentifiers
  ): Promise<Result<number, AppError>> {
    const date = new Date(nowInput ?? context.occurredAt);
    if (Number.isNaN(date.getTime())) {
      return Promise.resolve(err(invalid(context, 'Otomasyon zamanı geçersiz.')));
    }
    return this.port.executeDueRules(context, date.toISOString() as IsoDateTime, identifiers);
  }
}
