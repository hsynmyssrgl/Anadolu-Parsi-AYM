import {
  ERROR_CODES,
  asCorrelationId,
  asEventId,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type IsoDateTime,
  type Result
} from '@ppt/core';
import type {
  AutomationApplicationContext,
  AutomationExecutionIdentifiers,
  AutomationPort,
  AutomationRunRecord,
  LifeApplicationContext,
  LifePolicyIntent
} from '@ppt/application';
import type {
  AuditRepositoryPort,
  AutomationDueSourceRow,
  AutomationRepositoryPort,
  LifeProjectionRepositoryPort,
  LifeRepositoryPort,
  OutboxRepositoryPort,
  RepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';
import type { RepositoryBackedLifePolicyTransactionRunner } from './life-application-adapter.js';

type LifePolicyTransactionRunner = Pick<RepositoryBackedLifePolicyTransactionRunner, 'execute'>;

export interface RepositoryBackedAutomationDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly automationRepository: AutomationRepositoryPort;
  readonly lifeRepository: LifeRepositoryPort & LifeProjectionRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly outboxRepository: OutboxRepositoryPort;
  readonly lifePolicyTransactionRunner: LifePolicyTransactionRunner;
}

const repositoryContext = (
  context: AutomationApplicationContext,
  transaction: TransactionContext
): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: {
    userId: context.actorId,
    roles: [context.actorRole],
    ...(context.actorPersonId ? { personId: context.actorPersonId } : {})
  },
  correlationId: context.correlationId,
  occurredAt: transaction.occurredAt
});

const lifeContext = (
  context: AutomationApplicationContext,
  correlationId: CorrelationId
): LifeApplicationContext => ({
  familyId: context.familyId,
  actor: {
    userId: context.actorId,
    role: context.actorRole,
    ...(context.actorPersonId ? { personId: context.actorPersonId } : {})
  },
  correlationId
});

const readIntent: LifePolicyIntent = Object.freeze({
  action: 'read',
  capability: 'family.read',
  resourceType: 'life_record',
  resourceId: '*',
  purpose: 'general'
});

const missingOwner = (context: AutomationApplicationContext): Result<never, AppError> => ({
  ok: false,
  error: createAppError({
    code: ERROR_CODES.RESOURCE_NOT_FOUND,
    message: 'Otomasyon görevi için bağlı aile üyesi bulunamadı.',
    category: 'not_found',
    correlationId: context.correlationId
  })
});

const idempotentRace = (correlationId: CorrelationId): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_CONFLICT,
  message: 'Otomasyon kaynağı başka bir işlem tarafından zaten üretildi.',
  category: 'conflict',
  correlationId,
  details: { automationIdempotentNoop: true }
});

const unsupportedSemanticSource = (
  context: AutomationApplicationContext,
  sourceType: string
): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message: 'Kaynak semantiğini devralacak sealed policy binding bulunmadığı için bu otomasyon kaynağı kullanılamaz.',
  category: 'security',
  correlationId: context.correlationId,
  details: { automationBoundary: 'PPK016_SOURCE_BINDING_REQUIRED', sourceType }
}));

const sourceRevalidationFailed = (
  context: AutomationApplicationContext
): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message: 'Otomasyon kaynağı güncel LIFE yetkisi ve yaşam döngüsü altında yeniden doğrulanamadı.',
  category: 'security',
  correlationId: context.correlationId,
  details: { automationBoundary: 'PPK016_CURRENT_SOURCE_REVALIDATION_REQUIRED' }
}));

const byNewest = (left: AutomationRunRecord, right: AutomationRunRecord): number =>
  right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id);

export class RepositoryBackedAutomationAdapter implements AutomationPort {
  public constructor(private readonly dependencies: RepositoryBackedAutomationDependencies) {}

  private executeRepository<T>(
    context: AutomationApplicationContext,
    operation: (repository: RepositoryExecutionContext) => Result<T, AppError>
  ): Result<T, AppError> {
    return this.dependencies.transactionExecutor.execute(
      context.correlationId,
      (transaction) => operation(repositoryContext(context, transaction))
    );
  }

  public async listRules(context: AutomationApplicationContext): ReturnType<AutomationPort['listRules']> {
    return this.executeRepository(context, (repository) =>
      this.dependencies.automationRepository.listRules(repository));
  }

  public async insertRule(
    context: AutomationApplicationContext,
    record: Parameters<AutomationPort['insertRule']>[1]
  ): ReturnType<AutomationPort['insertRule']> {
    if (record.sourceType !== 'life_record') {
      return unsupportedSemanticSource(context, record.sourceType);
    }
    return this.executeRepository(context, (repository) =>
      this.dependencies.automationRepository.insertRule(repository, record));
  }

  public async setRuleEnabled(
    context: AutomationApplicationContext,
    id: string,
    enabled: boolean
  ): ReturnType<AutomationPort['setRuleEnabled']> {
    return this.executeRepository(context, (repository) =>
      this.dependencies.automationRepository.setRuleEnabled(repository, id, enabled));
  }

  public async listRuns(
    context: AutomationApplicationContext,
    limit: number
  ): ReturnType<AutomationPort['listRuns']> {
    if (!context.actorPersonId) {
      // A personless account has neither an exact LIFE subject nor a governed
      // source PEP for legacy non-LIFE ledgers.
      return ok([]);
    }
    const correlationId = asCorrelationId(`${context.correlationId}:life-runs`);
    return this.dependencies.lifePolicyTransactionRunner.execute(
      lifeContext(context, correlationId),
      readIntent,
      ({ repository }) => {
        const lifeRuns: AutomationRunRecord[] = [];
        let before: { readonly createdAt: IsoDateTime; readonly id: string } | undefined;
        const pageSize = 200;
        while (lifeRuns.length < limit) {
          const candidates = this.dependencies.automationRepository.listLifeRunCandidates(
            repository,
            { limit: pageSize, ...(before ? { before } : {}) }
          );
          if (!candidates.ok) return candidates;
          if (candidates.value.length === 0) break;
          const visible = this.dependencies.lifeRepository.listVisibleAutomationLifeRunSources(
            repository,
            candidates.value.map((candidate) => candidate.sourceId)
          );
          if (!visible.ok) return visible;
          const visibleById = new Map(visible.value.map((source) => [source.id, source] as const));
          for (const candidate of candidates.value) {
            const source = visibleById.get(candidate.sourceId);
            if (!source?.dueAt) continue;
            lifeRuns.push({
              id: candidate.id,
              ruleId: candidate.ruleId,
              sourceType: 'life_record',
              sourceId: candidate.sourceId,
              title: source.title,
              dueAt: source.dueAt,
              status: candidate.status,
              ...(candidate.generatedTaskId ? { generatedTaskId: candidate.generatedTaskId } : {}),
              createdAt: candidate.createdAt
            });
            if (lifeRuns.length >= limit) break;
          }
          const last = candidates.value.at(-1)!;
          before = { createdAt: last.createdAt, id: last.id };
          if (candidates.value.length < pageSize) break;
        }
        return ok(lifeRuns.sort(byNewest).slice(0, limit));
      }
    );
  }

  private async listDueSources(
    context: AutomationApplicationContext,
    ruleId: string,
    sourceType: string,
    fromAt: IsoDateTime,
    toAt: IsoDateTime
  ): Promise<Result<readonly AutomationDueSourceRow[], AppError>> {
    if (sourceType !== 'life_record') {
      return unsupportedSemanticSource(context, sourceType);
    }
    const correlationId = asCorrelationId(`${context.correlationId}:life-source:${ruleId}`);
    return this.dependencies.lifePolicyTransactionRunner.execute(
      lifeContext(context, correlationId),
      readIntent,
      ({ repository }) => this.dependencies.lifeRepository.listAutomationDueLife(
        repository,
        { fromAt, toAt }
      )
    );
  }

  private async revalidateLifeSource(
    context: AutomationApplicationContext,
    ruleId: string,
    source: AutomationDueSourceRow
  ): Promise<Result<void, AppError>> {
    const correlationId = asCorrelationId(`${context.correlationId}:life-source-revalidate:${ruleId}`);
    return this.dependencies.lifePolicyTransactionRunner.execute(
      lifeContext(context, correlationId),
      readIntent,
      ({ repository }) => {
        const current = this.dependencies.lifeRepository.listAutomationDueLife(repository, {
          fromAt: source.dueAt,
          toAt: source.dueAt
        });
        if (!current.ok) return current;
        return current.value.some((candidate) => candidate.id === source.id && candidate.dueAt === source.dueAt)
          ? ok(undefined)
          : sourceRevalidationFailed(context);
      }
    );
  }

  private async createGeneratedTask(
    context: AutomationApplicationContext,
    rule: { readonly id: string; readonly title: string; readonly sourceType: string },
    source: AutomationDueSourceRow,
    ownerPersonId: string,
    identifiers: AutomationExecutionIdentifiers
  ): Promise<Result<boolean, AppError>> {
    if (rule.sourceType !== 'life_record') {
      return unsupportedSemanticSource(context, rule.sourceType);
    }
    const revalidated = await this.revalidateLifeSource(context, rule.id, source);
    if (!revalidated.ok) return revalidated;
    const runId = identifiers.nextRunId();
    const taskId = identifiers.nextTaskId();
    const correlationId = asCorrelationId(`${context.correlationId}:life-task:${taskId}`);
    const owner = asPersonId(ownerPersonId);
    const policyContext = lifeContext(context, correlationId);
    const intent: LifePolicyIntent = {
      action: 'create',
      capability: 'family.write',
      resourceType: 'life_record',
      resourceId: taskId,
      purpose: 'general',
      ownerPersonId: owner,
      privacy: 'private'
    };
    const result = await this.dependencies.lifePolicyTransactionRunner.execute(
      policyContext,
      intent,
      ({ repository, occurredAt }) => {
        // Recheck inside the governed write transaction so retries cannot
        // duplicate either the task or its automation run.
        const existing = this.dependencies.automationRepository.runExists(
          repository,
          rule.id,
          rule.sourceType,
          source.id
        );
        if (!existing.ok) return existing;
        // A concurrent winner must roll back this task's just-recorded receipt.
        // The adapter converts this controlled rollback to an idempotent no-op.
        if (existing.value) return err(idempotentRace(correlationId));

        const task = this.dependencies.lifeRepository.insertLifeRecord(repository, {
          id: taskId,
          familyId: context.familyId,
          ownerPersonId: owner,
          category: 'task',
          // The rule is an independently governed primary record. Source title
          // and schedule remain transient and never enter the generated task.
          title: rule.title,
          status: 'planned',
          privacy: 'private',
          notes: 'Otomatik oluşturuldu.',
          createdAt: occurredAt
        });
        if (!task.ok) return err({
          ...task.error,
          details: { ...task.error.details, automationStage: 'life-insert' }
        });

        const run = this.dependencies.automationRepository.insertRun(repository, {
          id: runId,
          ruleId: rule.id,
          sourceType: rule.sourceType,
          sourceId: source.id,
          status: 'generated',
          generatedTaskId: taskId,
          createdAt: occurredAt
        });
        if (!run.ok) return err({
          ...run.error,
          details: { ...run.error.details, automationStage: 'automation-run-insert' }
        });

        const audit = this.dependencies.auditRepository.append(repository, {
          id: identifiers.nextAuditId(),
          action: 'life_record.created',
          resourceType: 'life_record',
          resourceId: taskId,
          occurredAt,
          actorId: context.actorId
        });
        if (!audit.ok) return err({
          ...audit.error,
          details: { ...audit.error.details, automationStage: 'audit-append' }
        });

        const event = this.dependencies.outboxRepository.enqueue(repository, {
          eventId: asEventId(`automation-life-${taskId}`),
          eventType: 'life.record.created',
          eventVersion: 1,
          aggregateType: 'life_record',
          aggregateId: taskId,
          occurredAt,
          actorId: context.actorId,
          correlationId,
          payload: {
            recordId: taskId,
            ownerPersonId: owner,
            category: 'task',
            status: 'planned',
            privacy: 'private',
            automationRunId: runId
          }
        });
        return event.ok
          ? ok(true)
          : err({
              ...event.error,
              details: { ...event.error.details, automationStage: 'outbox-enqueue' }
            });
      }
    );
    return !result.ok && result.error.details?.automationIdempotentNoop === true
      ? ok(false)
      : result;
  }

  public async executeDueRules(
    context: AutomationApplicationContext,
    now: Parameters<AutomationPort['executeDueRules']>[1],
    identifiers: AutomationExecutionIdentifiers
  ): ReturnType<AutomationPort['executeDueRules']> {
    const snapshot = this.executeRepository(context, (repository) => {
      const rules = this.dependencies.automationRepository.listEnabledRules(repository);
      if (!rules.ok) return rules;
      const owner = this.dependencies.automationRepository.resolveTaskOwnerPersonId(
        repository,
        context.actorId,
        context.familyId
      );
      return owner.ok ? ok({ rules: rules.value, ownerPersonId: owner.value }) : owner;
    });
    if (!snapshot.ok) return snapshot;
    if (
      !context.actorPersonId
      || !snapshot.value.ownerPersonId
      || snapshot.value.ownerPersonId !== context.actorPersonId
    ) {
      return missingOwner(context);
    }

    let generated = 0;
    for (const rule of snapshot.value.rules) {
      const toAt = new Date(new Date(now).getTime() + rule.daysBefore * 86400000).toISOString() as IsoDateTime;
      const sources = await this.listDueSources(context, rule.id, rule.sourceType, now, toAt);
      if (!sources.ok) return sources;
      for (const source of sources.value) {
        const existing = this.executeRepository(context, (repository) =>
          this.dependencies.automationRepository.runExists(
            repository,
            rule.id,
            rule.sourceType,
            source.id
          ));
        if (!existing.ok) return existing;
        if (existing.value) continue;
        const created = await this.createGeneratedTask(
          context,
          rule,
          source,
          snapshot.value.ownerPersonId,
          identifiers
        );
        if (!created.ok) return created;
        if (created.value) generated += 1;
      }
    }
    return ok(generated);
  }
}
