import { createHash } from 'node:crypto';
import type {
  LocalGovernedOcrApplicationContext,
  LocalGovernedOcrAuthorizationPlan,
  LocalGovernedOcrPolicyIntent,
  LocalGovernedOcrUnitOfWork,
  LocalGovernedOcrWriteScope
} from '@ppt/application';
import type { AsyncTransactionExecutor, TransactionContext } from '@ppt/contracts';
import {
  ERROR_CODES,
  asCorrelationId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type Result
} from '@ppt/core';
import type { LocalGovernedOcrAggregateKey } from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import {
  PlatformPolicyEnforcementError,
  assertActivePlatformPolicyTransactionContext,
  type PlatformPolicyClusterFence,
  type PlatformPolicyTransactionContext
} from '@ppt/platform-policy';
import type {
  AuditRepositoryPort,
  DerivedDataPolicyRepositoryPort,
  LocalGovernedOcrJobRow,
  LocalGovernedOcrRepositoryPort,
  OutboxRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext
} from '@ppt/repository-contracts';
import type {
  AuthorizedLocalGovernedOcrArchiveSource,
  AuthorizedLocalGovernedOcrJobBinding,
  LocalGovernedOcrMainAuthorityPort,
  LocalGovernedOcrRuntimeJobOperation
} from './local-governed-ocr-runtime-adapter.js';
import type {
  LocalGovernedOcrProductionPolicyEnforcementPoint,
  LocalGovernedOcrProductionPolicyEnforcementPointResolver
} from './timeline-production-policy-runtime.js';

export interface RepositoryBackedLocalGovernedOcrApplicationDependencies {
  readonly transactionExecutor: AsyncTransactionExecutor;
  readonly localGovernedOcrRepository: LocalGovernedOcrRepositoryPort;
  readonly derivedDataPolicyRepository: DerivedDataPolicyRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly outboxRepository: OutboxRepositoryPort;
  readonly policyEnforcementPointResolver: LocalGovernedOcrProductionPolicyEnforcementPointResolver;
  readonly clusterFence: PlatformPolicyClusterFence;
}

type AuthorizationSlot = 'primary' | 'source' | 'settings' | 'target';

interface ResolvedAuthorizationSlot {
  readonly slot: AuthorizationSlot;
  readonly intent: LocalGovernedOcrPolicyIntent;
  readonly policyContext: LocalGovernedOcrApplicationContext;
  readonly enforcementPoint: LocalGovernedOcrProductionPolicyEnforcementPoint;
}

interface EstablishedAuthorizationSlot extends ResolvedAuthorizationSlot {
  readonly authorization: PlatformPolicyTransactionContext;
  readonly repository: PolicyAuthorizedRepositoryExecutionContext;
}

interface ActiveLocalGovernedOcrAuthorityLease {
  readonly token: symbol;
  readonly context: LocalGovernedOcrApplicationContext;
  readonly key: LocalGovernedOcrAggregateKey;
  readonly bySlot: ReadonlyMap<AuthorizationSlot, EstablishedAuthorizationSlot>;
}

interface DetachedLocalGovernedOcrRunAuthorityLease {
  readonly token: symbol;
  readonly context: LocalGovernedOcrApplicationContext;
  readonly authority: {
    readonly operation: 'run';
    readonly runId: string;
    readonly jobId: string;
    readonly derivedResourceId: string;
    readonly sourceResourceId: string;
    readonly expectedInputSha256: string;
  };
  readonly source: AuthorizedLocalGovernedOcrArchiveSource;
}

const SHA256 = /^[0-9a-f]{64}$/u;
const LOCAL_OCR_MEDIA_TYPES = new Set(['image/png', 'image/jpeg', 'application/pdf']);
const validLocalOcrMediaType = (
  value: string
): value is AuthorizedLocalGovernedOcrArchiveSource['mimeType'] => LOCAL_OCR_MEDIA_TYPES.has(value);
const validVaultLeafName = (value: string): boolean => value === value.trim()
  && value.length >= 3
  && value.length <= 128
  && value !== '.'
  && value !== '..'
  && !/[\\/:\u0000-\u001f\u007f]/u.test(value)
  && !value.startsWith('.')
  && !value.endsWith('.')
  && !value.endsWith(' ');

const policySlotContext = (
  context: LocalGovernedOcrApplicationContext,
  slot: AuthorizationSlot,
  intent: LocalGovernedOcrPolicyIntent
): LocalGovernedOcrApplicationContext => {
  if (slot === 'primary') return context;
  const digest = createHash('sha256').update(JSON.stringify([
    'local-governed-ocr-policy-slot-v1',
    context.correlationId,
    slot,
    intent.resourceType,
    intent.resourceId,
    intent.action,
    intent.capability,
    intent.purpose,
    intent.familyId,
    intent.ownerPersonId,
    intent.sensitivity
  ]), 'utf8').digest('hex');
  return Object.freeze({
    ...context,
    correlationId: asCorrelationId(`local-ocr-${slot}-${digest}`)
  });
};

const exactKey = (
  context: LocalGovernedOcrApplicationContext,
  key: LocalGovernedOcrAggregateKey
): boolean => Boolean(context.actor.personId)
  && key.familyId === context.familyId
  && key.accountId === context.actor.userId
  && key.ownerPersonId === context.actor.personId;

const applicationError = (
  context: LocalGovernedOcrApplicationContext,
  message: string,
  options: { readonly code?: typeof ERROR_CODES[keyof typeof ERROR_CODES]; readonly enforcementCode?: string } = {}
): AppError => createAppError({
  code: options.code ?? ERROR_CODES.AUTHORIZATION_DENIED,
  message,
  category: options.code === ERROR_CODES.RESOURCE_CONFLICT ? 'conflict' : 'security',
  correlationId: context.correlationId,
  ...(options.enforcementCode ? { details: { enforcementCode: options.enforcementCode } } : {})
});

const policyFailure = (
  context: LocalGovernedOcrApplicationContext,
  error: unknown
): Result<never, AppError> => {
  const enforcementCode = error instanceof PlatformPolicyEnforcementError
    ? error.code
    : 'ENFORCEMENT_UNAVAILABLE';
  const message = error instanceof Error ? error.message : 'Local OCR central policy enforcement is unavailable';
  return err(applicationError(
    context,
    `Yerel OCR işlemi merkezi politika tarafından güvenli biçimde durduruldu: ${message}`,
    { enforcementCode }
  ));
};

const authorityDenied = <T>(correlationId: CorrelationId, message: string): Result<T, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message,
  category: 'security',
  correlationId
}));

const exactIntent = (
  slot: EstablishedAuthorizationSlot | undefined,
  expected: {
    readonly resourceType: LocalGovernedOcrPolicyIntent['resourceType'];
    readonly resourceId: string;
    readonly action: LocalGovernedOcrPolicyIntent['action'];
    readonly capability: LocalGovernedOcrPolicyIntent['capability'];
    readonly purpose: LocalGovernedOcrPolicyIntent['purpose'];
  }
): slot is EstablishedAuthorizationSlot => Boolean(slot)
  && slot!.intent.resourceType === expected.resourceType
  && slot!.intent.resourceId === expected.resourceId
  && slot!.intent.action === expected.action
  && slot!.intent.capability === expected.capability
  && slot!.intent.purpose === expected.purpose;

const exactJobRow = (
  lease: ActiveLocalGovernedOcrAuthorityLease,
  row: LocalGovernedOcrJobRow,
  jobId: string
): boolean => row.id === jobId
  && exactKey(lease.context, row.key)
  && row.processor === 'local_ocr'
  && row.networkUsed === false
  && row.cloudUsed === false
  && row.source.resourceType === 'archive_item'
  && typeof row.source.resourceId === 'string'
  && row.source.resourceId.length >= 1
  && typeof row.derivedResourceId === 'string'
  && row.derivedResourceId.length >= 1
  && SHA256.test(row.source.inputSha256)
  && (row.sealedResultId === undefined || SHA256.test(row.sealedResultId));

const repositoryContext = (
  context: LocalGovernedOcrApplicationContext,
  transaction: TransactionContext
): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: {
    userId: context.actor.userId,
    roles: [context.actor.role],
    ...(context.actor.personId ? { personId: context.actor.personId } : {})
  },
  correlationId: context.correlationId,
  occurredAt: transaction.occurredAt
});

const governedRepositoryContext = (
  context: LocalGovernedOcrApplicationContext,
  transaction: TransactionContext,
  intent: LocalGovernedOcrPolicyIntent,
  authorization: PlatformPolicyTransactionContext
): PolicyAuthorizedRepositoryExecutionContext => {
  const personId = context.actor.personId;
  if (!personId) throw new PlatformPolicyEnforcementError(
    'TRANSACTION_CONTEXT_MISMATCH',
    'Local OCR transaction requires an exact person identity'
  );
  assertActivePlatformPolicyTransactionContext(authorization, {
    resourceType: intent.resourceType,
    resourceId: intent.resourceId,
    action: intent.action,
    capability: intent.capability,
    resourceFamilyId: context.familyId,
    resourceOwnerPersonId: personId,
    purpose: intent.purpose,
    occurredAt: asIsoDateTime(authorization.occurredAt),
    correlationId: context.correlationId,
    fenceEpoch: authorization.fenceEpoch,
    fenceWritable: true
  });
  if (
    authorization.subject.accountId !== context.actor.userId
    || authorization.subject.personId !== personId
    || authorization.subject.roles.length !== 1
    || authorization.subject.roles[0] !== context.actor.role
    || authorization.subject.familyIds.length !== 1
    || authorization.subject.familyIds[0] !== context.familyId
    || authorization.resourceFamilyId !== context.familyId
    || authorization.resourceOwnerPersonId !== personId
  ) throw new PlatformPolicyEnforcementError(
    'TRANSACTION_CONTEXT_MISMATCH',
    'Local OCR receipt subject, owner, family, role or timestamp changed'
  );
  return {
    transaction: transaction.transaction,
    actor: {
      userId: asUserId(authorization.subject.accountId),
      roles: authorization.subject.roles,
      personId: asPersonId(authorization.subject.personId)
    },
    correlationId: context.correlationId,
    occurredAt: asIsoDateTime(authorization.occurredAt),
    policyAuthorization: authorization
  };
};

const intentMatchesContext = (
  context: LocalGovernedOcrApplicationContext,
  intent: LocalGovernedOcrPolicyIntent
): boolean => Boolean(context.actor.personId)
  && intent.familyId === context.familyId
  && intent.ownerPersonId === context.actor.personId
  && intent.privacy === 'private'
  && typeof intent.resourceId === 'string'
  && intent.resourceId.trim() === intent.resourceId
  && intent.resourceId.length >= 1
  && intent.resourceId.length <= 256;

const authorizationPlanIsCoherent = (
  context: LocalGovernedOcrApplicationContext,
  plan: LocalGovernedOcrAuthorizationPlan
): boolean => {
  const intents = [plan.primary, plan.source, plan.settings, plan.target]
    .filter((intent): intent is LocalGovernedOcrPolicyIntent => intent !== undefined);
  if (intents.some((intent) => !intentMatchesContext(context, intent))) return false;
  if (plan.primary.resourceType === 'local_ocr_job') {
    const sourceFreeAuthorizationReconciliation = plan.primary.action === 'delete'
      && plan.primary.capability === 'archive.write'
      && plan.primary.purpose === 'ocr_process'
      && !plan.source
      && !plan.settings
      && !plan.target;
    if (!sourceFreeAuthorizationReconciliation
      && (!plan.source || plan.source.resourceType !== 'archive_item')) return false;
    if (plan.target && plan.target.sourceJobId !== plan.primary.resourceId) return false;
  }
  if (plan.settings && plan.settings.resourceType !== 'local_ocr_settings') return false;
  if (plan.target && (!plan.source || plan.target.resourceType !== 'local_ocr_result')) return false;
  if (plan.primary.resourceType === 'archive_item' && (plan.source || plan.settings || plan.target)) return false;
  return true;
};

class RepositoryBackedLocalGovernedOcrWriteScope implements LocalGovernedOcrWriteScope {
  public readonly occurredAt: LocalGovernedOcrWriteScope['occurredAt'];
  private readonly bySlot: ReadonlyMap<AuthorizationSlot, EstablishedAuthorizationSlot>;

  public constructor(
    private readonly dependencies: RepositoryBackedLocalGovernedOcrApplicationDependencies,
    private readonly context: LocalGovernedOcrApplicationContext,
    slots: readonly EstablishedAuthorizationSlot[],
    occurredAt: LocalGovernedOcrWriteScope['occurredAt']
  ) {
    this.bySlot = new Map(slots.map((slot) => [slot.slot, slot]));
    this.occurredAt = occurredAt;
  }

  private missing<T>(message: string): Result<T, AppError> {
    return err(applicationError(this.context, message));
  }

  private slot(name: AuthorizationSlot): EstablishedAuthorizationSlot | undefined {
    return this.bySlot.get(name);
  }

  private exactResourceContext(resourceType: string, resourceId: string): PolicyAuthorizedRepositoryExecutionContext | undefined {
    for (const slot of this.bySlot.values()) {
      if (slot.authorization.resourceType === resourceType && slot.authorization.resourceId === resourceId) {
        return slot.repository;
      }
    }
    return undefined;
  }

  public loadCenter(key: LocalGovernedOcrAggregateKey): ReturnType<LocalGovernedOcrWriteScope['loadCenter']> {
    if (!exactKey(this.context, key)) return this.missing('OCR center key does not match the authenticated owner');
    const settings = this.slot('settings') ?? (
      this.slot('primary')?.intent.resourceType === 'local_ocr_settings' ? this.slot('primary') : undefined
    );
    return settings
      ? this.dependencies.localGovernedOcrRepository.loadCenter(settings.repository, key)
      : this.missing('OCR center read requires an exact settings receipt');
  }

  public findJob(
    key: LocalGovernedOcrAggregateKey,
    jobId: string
  ): ReturnType<LocalGovernedOcrWriteScope['findJob']> {
    const primary = this.slot('primary');
    if (!exactKey(this.context, key) || primary?.intent.resourceType !== 'local_ocr_job'
      || primary.intent.resourceId !== jobId) return this.missing('OCR job read exceeds the exact primary receipt');
    return this.dependencies.localGovernedOcrRepository.findJob(primary.repository, key, jobId);
  }

  public listJobsBySource(
    key: LocalGovernedOcrAggregateKey,
    resourceType: 'archive_item',
    resourceId: string
  ): ReturnType<LocalGovernedOcrWriteScope['listJobsBySource']> {
    const primary = this.slot('primary');
    if (!exactKey(this.context, key) || resourceType !== 'archive_item'
      || primary?.intent.resourceType !== 'archive_item' || primary.intent.resourceId !== resourceId
      || primary.intent.action !== 'delete') return this.missing('OCR source-deletion list exceeds the exact archive receipt');
    return this.dependencies.localGovernedOcrRepository.listJobsBySource(
      primary.repository,
      key,
      resourceType,
      resourceId
    );
  }

  public resolveArchiveSource(
    key: LocalGovernedOcrAggregateKey,
    resourceId: string
  ): ReturnType<LocalGovernedOcrWriteScope['resolveArchiveSource']> {
    const source = this.slot('source');
    if (!exactKey(this.context, key) || source?.intent.resourceType !== 'archive_item'
      || source.intent.resourceId !== resourceId) return this.missing('OCR archive source requires its distinct current receipt');
    return this.dependencies.localGovernedOcrRepository.resolveArchiveSource(source.repository, key, resourceId);
  }

  public resolveActiveSensitiveProcessingConsent(
    key: LocalGovernedOcrAggregateKey,
    resourceType: 'archive_item',
    resourceId: string,
    at: LocalGovernedOcrWriteScope['occurredAt']
  ): ReturnType<LocalGovernedOcrWriteScope['resolveActiveSensitiveProcessingConsent']> {
    const source = this.slot('source');
    if (!exactKey(this.context, key) || at !== this.occurredAt || resourceType !== 'archive_item'
      || source?.intent.resourceType !== 'archive_item' || source.intent.resourceId !== resourceId) {
      return this.missing('OCR sensitive-processing consent requires the exact source receipt and transaction time');
    }
    return this.dependencies.localGovernedOcrRepository.resolveActiveSensitiveProcessingConsent(
      source.repository,
      key,
      resourceType,
      resourceId,
      at
    );
  }

  public resolveAuthorizationRevocation(
    key: LocalGovernedOcrAggregateKey,
    jobId: string,
    at: LocalGovernedOcrWriteScope['occurredAt']
  ): ReturnType<LocalGovernedOcrWriteScope['resolveAuthorizationRevocation']> {
    const primary = this.slot('primary');
    if (!exactKey(this.context, key) || at !== this.occurredAt
      || primary?.intent.resourceType !== 'local_ocr_job'
      || primary.intent.resourceId !== jobId
      || primary.intent.action !== 'delete'
      || primary.intent.capability !== 'archive.write') {
      return this.missing('OCR authorization reconciliation requires the exact job-delete receipt');
    }
    return this.dependencies.localGovernedOcrRepository.resolveAuthorizationRevocation(
      primary.repository,
      key,
      jobId,
      at
    );
  }

  public findMutationByClientOperationId(
    key: LocalGovernedOcrAggregateKey,
    clientOperationId: string
  ): ReturnType<LocalGovernedOcrWriteScope['findMutationByClientOperationId']> {
    const primary = this.slot('primary');
    if (!exactKey(this.context, key) || !primary
      || (primary.intent.resourceType !== 'local_ocr_job' && primary.intent.resourceType !== 'local_ocr_settings')) {
      return this.missing('OCR mutation replay requires the exact primary receipt');
    }
    return this.dependencies.localGovernedOcrRepository.findMutationByClientOperationId(
      primary.repository,
      key,
      clientOperationId
    );
  }

  public findSourceDeletionMutationByClientOperationId(
    key: LocalGovernedOcrAggregateKey,
    sourceResourceId: string,
    clientOperationId: string
  ): ReturnType<LocalGovernedOcrWriteScope['findSourceDeletionMutationByClientOperationId']> {
    const primary = this.slot('primary');
    if (!exactKey(this.context, key) || primary?.intent.resourceType !== 'archive_item'
      || primary.intent.resourceId !== sourceResourceId || primary.intent.action !== 'delete') {
      return this.missing('OCR source-deletion replay requires the exact archive delete receipt');
    }
    return this.dependencies.localGovernedOcrRepository.findSourceDeletionMutationByClientOperationId(
      primary.repository,
      key,
      sourceResourceId,
      clientOperationId
    );
  }

  public insertJob(row: Parameters<LocalGovernedOcrWriteScope['insertJob']>[0]): ReturnType<LocalGovernedOcrWriteScope['insertJob']> {
    const primary = this.slot('primary');
    if (!exactKey(this.context, row.key) || primary?.intent.resourceType !== 'local_ocr_job'
      || primary.intent.resourceId !== row.id || primary.intent.action !== 'process') {
      return this.missing('OCR job insert exceeds the exact process receipt');
    }
    return this.dependencies.localGovernedOcrRepository.insertJob(primary.repository, row);
  }

  public saveJob(
    row: Parameters<LocalGovernedOcrWriteScope['saveJob']>[0],
    expectedRevision: number
  ): ReturnType<LocalGovernedOcrWriteScope['saveJob']> {
    const primary = this.slot('primary');
    if (!exactKey(this.context, row.key) || primary?.intent.resourceType !== 'local_ocr_job'
      || primary.intent.resourceId !== row.id) return this.missing('OCR job update exceeds the exact primary receipt');
    return this.dependencies.localGovernedOcrRepository.saveJob(primary.repository, row, expectedRevision);
  }

  public saveSettings(
    row: Parameters<LocalGovernedOcrWriteScope['saveSettings']>[0],
    expectedRevision: number
  ): ReturnType<LocalGovernedOcrWriteScope['saveSettings']> {
    const primary = this.slot('primary');
    if (!exactKey(this.context, row.key) || primary?.intent.resourceType !== 'local_ocr_settings'
      || primary.intent.action !== 'update') return this.missing('OCR settings update requires the exact primary receipt');
    return this.dependencies.localGovernedOcrRepository.saveSettings(primary.repository, row, expectedRevision);
  }

  public insertMutation(
    row: Parameters<LocalGovernedOcrWriteScope['insertMutation']>[0]
  ): ReturnType<LocalGovernedOcrWriteScope['insertMutation']> {
    const primary = this.slot('primary');
    if (!exactKey(this.context, row.key) || !primary
      || primary.intent.resourceType !== row.resourceType || primary.intent.resourceId !== row.resourceId) {
      return this.missing('OCR mutation ledger exceeds the exact primary receipt');
    }
    return this.dependencies.localGovernedOcrRepository.insertMutation(primary.repository, row);
  }

  public propagateSourceDeletion(
    batch: Parameters<LocalGovernedOcrWriteScope['propagateSourceDeletion']>[0]
  ): ReturnType<LocalGovernedOcrWriteScope['propagateSourceDeletion']> {
    const primary = this.slot('primary');
    if (primary?.intent.resourceType !== 'archive_item' || primary.intent.action !== 'delete'
      || primary.intent.resourceId !== batch.sourceResourceId) {
      return this.missing('OCR source-deletion batch exceeds the exact archive receipt');
    }
    return this.dependencies.localGovernedOcrRepository.propagateSourceDeletion(primary.repository, batch);
  }

  public insertDerivedBinding(
    binding: Parameters<LocalGovernedOcrWriteScope['insertDerivedBinding']>[0]
  ): ReturnType<LocalGovernedOcrWriteScope['insertDerivedBinding']> {
    const target = this.slot('target');
    const primary = this.slot('primary');
    const targetIntent = target?.intent as (LocalGovernedOcrPolicyIntent & { readonly sourceJobId?: string }) | undefined;
    if (!target || !primary || targetIntent?.resourceType !== 'local_ocr_result'
      || targetIntent.sourceJobId !== primary.intent.resourceId
      || binding.target.resourceType !== 'local_ocr_result'
      || binding.target.resourceId !== target.intent.resourceId
      || binding.target.familyId !== this.context.familyId) {
      return this.missing('PPK-016 binding requires the distinct exact derived-target receipt');
    }
    return this.dependencies.derivedDataPolicyRepository.insertSealed(target.repository, binding);
  }

  public appendAudit(
    input: Parameters<LocalGovernedOcrWriteScope['appendAudit']>[0]
  ): ReturnType<LocalGovernedOcrWriteScope['appendAudit']> {
    if (input.occurredAt !== this.occurredAt || input.actorId !== this.context.actor.userId) {
      return this.missing('OCR audit identity or transaction time changed');
    }
    const repository = this.exactResourceContext(input.resourceType, input.resourceId);
    return repository
      ? this.dependencies.auditRepository.append(repository, input)
      : this.missing('OCR audit resource has no exact receipt in this transaction');
  }

  public enqueueEvent<T>(event: DomainEvent<T>): ReturnType<LocalGovernedOcrWriteScope['enqueueEvent']> {
    if (event.occurredAt !== this.occurredAt || event.correlationId !== this.context.correlationId
      || event.actorId !== this.context.actor.userId) return this.missing('OCR outbox event escaped the transaction identity');
    const repository = this.exactResourceContext(event.aggregateType, event.aggregateId);
    return repository
      ? this.dependencies.outboxRepository.enqueue(repository, event)
      : this.missing('OCR outbox aggregate has no exact receipt in this transaction');
  }
}

const validateEnforcementPoint = (
  enforcementPoint: LocalGovernedOcrProductionPolicyEnforcementPoint
): void => {
  if (
    !enforcementPoint
    || typeof enforcementPoint.execute !== 'function'
    || enforcementPoint.requiresTransactionRevalidation !== true
    || typeof enforcementPoint.revalidateTransaction !== 'function'
    || enforcementPoint.requiresDurableTransactionReceipt !== true
    || typeof enforcementPoint.recordAuthorizedTransaction !== 'function'
    || typeof enforcementPoint.projectCommittedTransaction !== 'function'
  ) throw new PlatformPolicyEnforcementError(
    'ENFORCEMENT_UNAVAILABLE',
    'Local OCR durable central Policy Enforcement Point is incomplete'
  );
};

/** Production UoW: no bytes, paths or plaintext OCR payloads cross this metadata-only adapter. */
export class RepositoryBackedLocalGovernedOcrUnitOfWork
implements LocalGovernedOcrUnitOfWork, LocalGovernedOcrMainAuthorityPort {
  #activeAuthorityLease: ActiveLocalGovernedOcrAuthorityLease | undefined;
  #detachedRunAuthorityLease: DetachedLocalGovernedOcrRunAuthorityLease | undefined;
  #transactionTail: Promise<void> = Promise.resolve();

  public constructor(private readonly dependencies: RepositoryBackedLocalGovernedOcrApplicationDependencies) {}

  async #withTransactionTurn<T>(operation: () => Promise<Result<T, AppError>>): Promise<Result<T, AppError>> {
    const predecessor = this.#transactionTail;
    let release!: () => void;
    this.#transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await predecessor;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  public resolveAuthorizedArchiveSource(
    input: Parameters<LocalGovernedOcrMainAuthorityPort['resolveAuthorizedArchiveSource']>[0]
  ): Result<AuthorizedLocalGovernedOcrArchiveSource, AppError> {
    const detached = this.#detachedRunAuthorityLease;
    if (detached?.context.correlationId === input.correlationId) {
      const exact = input.operation === 'run'
        && SHA256.test(input.runId)
        && input.runId === detached.authority.runId
        && input.jobId === detached.authority.jobId
        && input.derivedResourceId === detached.authority.derivedResourceId
        && input.sourceResourceId === detached.authority.sourceResourceId
        && input.expectedInputSha256 === detached.authority.expectedInputSha256;
      return exact
        ? ok(detached.source)
        : authorityDenied(input.correlationId, 'Detached Local OCR run authority binding changed');
    }
    const lease = this.#lease(input.correlationId);
    if (!lease) return authorityDenied(input.correlationId, 'Local OCR archive authority lease is absent or expired');
    try {
      const primary = lease.bySlot.get('primary');
      const source = lease.bySlot.get('source');
      const settings = lease.bySlot.get('settings');
      const target = lease.bySlot.get('target');
      const targetIntent = target?.intent as (LocalGovernedOcrPolicyIntent & { readonly sourceJobId?: string }) | undefined;
      if (
        input.operation !== 'run'
        || !exactIntent(primary, {
          resourceType: 'local_ocr_job', resourceId: input.jobId, action: 'process',
          capability: 'archive.ocr', purpose: 'ocr_process'
        })
        || !exactIntent(source, {
          resourceType: 'archive_item', resourceId: input.sourceResourceId, action: 'process',
          capability: 'archive.ocr', purpose: 'ocr_process'
        })
        || !exactIntent(settings, {
          resourceType: 'local_ocr_settings', resourceId: `local-ocr-settings:${lease.key.ownerPersonId}`,
          action: 'read', capability: 'family.read', purpose: 'administration'
        })
        || !exactIntent(target, {
          resourceType: 'local_ocr_result', resourceId: input.derivedResourceId, action: 'process',
          capability: 'archive.ocr', purpose: 'ocr_process'
        })
        || targetIntent?.sourceJobId !== input.jobId
        || !SHA256.test(input.runId)
        || !SHA256.test(input.expectedInputSha256)
      ) return authorityDenied(input.correlationId, 'Local OCR run authority is not bound to every exact central receipt');

      const current = this.dependencies.localGovernedOcrRepository.findJob(primary.repository, lease.key, input.jobId);
      if (!current.ok) return current;
      if (!current.value || !exactJobRow(lease, current.value, input.jobId)
        || current.value.status !== 'running' || current.value.activeRunId !== input.runId
        || current.value.deletionPropagation !== 'active'
        || current.value.sourceDeletedAt !== undefined
        || current.value.resultAvailable
        || current.value.sealedResultId !== undefined
        || current.value.derivedResourceId !== input.derivedResourceId
        || current.value.source.resourceId !== input.sourceResourceId
        || current.value.source.inputSha256 !== input.expectedInputSha256) {
        return authorityDenied(input.correlationId, 'Local OCR run binding is foreign or stale');
      }

      const archiveSource = this.dependencies.localGovernedOcrRepository.resolveArchiveSource(
        source.repository,
        lease.key,
        input.sourceResourceId
      );
      if (!archiveSource.ok) return archiveSource;
      const locator = this.dependencies.localGovernedOcrRepository.resolveAuthorizedArchiveVaultLocator(
        source.repository,
        lease.key,
        input.sourceResourceId
      );
      if (!locator.ok) return locator;
      if (!archiveSource.value || !locator.value
        || !exactKey(lease.context, archiveSource.value.key)
        || !exactKey(lease.context, locator.value.key)
        || archiveSource.value.resourceType !== 'archive_item'
        || locator.value.resourceType !== 'archive_item'
        || archiveSource.value.resourceId !== input.sourceResourceId
        || locator.value.resourceId !== input.sourceResourceId
        || archiveSource.value.inputSha256 !== input.expectedInputSha256
        || locator.value.inputSha256 !== input.expectedInputSha256
        || archiveSource.value.sourcePolicy.resourceType !== 'archive_item'
        || archiveSource.value.sourcePolicy.resourceId !== input.sourceResourceId
        || archiveSource.value.sourcePolicy.familyId !== lease.key.familyId
        || archiveSource.value.sourcePolicy.contentSha256 !== input.expectedInputSha256
        || archiveSource.value.sourcePolicy.receiptActive !== true
        || !archiveSource.value.sourcePolicy.allowedCapabilities.includes('archive.ocr')
        || !archiveSource.value.sourcePolicy.allowedActions.includes('process')
        || !archiveSource.value.sourcePolicy.allowedPurposes.includes('ocr_process')
        || archiveSource.value.mimeType !== current.value.source.mimeType
        || locator.value.mimeType !== current.value.source.mimeType
        || archiveSource.value.sizeBytes !== current.value.source.sizeBytes
        || locator.value.sizeBytes !== current.value.source.sizeBytes
        || !validLocalOcrMediaType(locator.value.mimeType)
        || !Number.isSafeInteger(locator.value.sizeBytes)
        || locator.value.sizeBytes < 12
        || locator.value.sizeBytes > 16_777_216
        || !validVaultLeafName(locator.value.storedName)
        || !validVaultLeafName(locator.value.originalName)) {
        return authorityDenied(input.correlationId, 'Local OCR archive vault locator is foreign, stale or unsafe');
      }

      return ok(Object.freeze({
        authority: 'central_pep_authorized_archive_vault_read' as const,
        resourceType: 'archive_item' as const,
        familyId: lease.key.familyId,
        accountId: lease.key.accountId,
        ownerPersonId: lease.key.ownerPersonId,
        jobId: current.value.id,
        derivedResourceId: current.value.derivedResourceId,
        sourceResourceId: current.value.source.resourceId,
        inputSha256: current.value.source.inputSha256,
        storedName: locator.value.storedName,
        originalName: locator.value.originalName,
        mimeType: locator.value.mimeType,
        sizeBytes: locator.value.sizeBytes
      }));
    } catch {
      return authorityDenied(input.correlationId, 'Local OCR archive authority resolution failed closed');
    }
  }

  public resolveAuthorizedJobBinding(
    input: Parameters<LocalGovernedOcrMainAuthorityPort['resolveAuthorizedJobBinding']>[0]
  ): Result<AuthorizedLocalGovernedOcrJobBinding, AppError> {
    const lease = this.#lease(input.correlationId);
    if (!lease) return authorityDenied(input.correlationId, 'Local OCR job authority lease is absent or expired');
    if (input.operation === 'orphan_sweep') {
      return authorityDenied(input.correlationId, 'Local OCR orphan sweep requires a distinct maintenance authorization');
    }
    try {
      const current = this.#findCurrentJob(lease, input.jobId);
      if (!current.ok) return current;
      if (!this.#jobOperationIsAuthorized(lease, current.value, input.operation)
        || !this.#sealedResultMatches(current.value, input.operation, input.sealedResultId)) {
        return authorityDenied(input.correlationId, 'Local OCR job binding is foreign, stale or outside the exact operation receipt');
      }
      return ok(Object.freeze({
        authority: 'central_pep_authorized_local_ocr_job' as const,
        familyId: lease.key.familyId,
        accountId: lease.key.accountId,
        ownerPersonId: lease.key.ownerPersonId,
        jobId: current.value.id,
        derivedResourceId: current.value.derivedResourceId,
        sourceResourceId: current.value.source.resourceId,
        inputSha256: current.value.source.inputSha256,
        currentSealedResultId: current.value.sealedResultId ?? null
      }));
    } catch {
      return authorityDenied(input.correlationId, 'Local OCR job authority resolution failed closed');
    }
  }

  #lease(correlationId: CorrelationId): ActiveLocalGovernedOcrAuthorityLease | undefined {
    const lease = this.#activeAuthorityLease;
    return lease?.context.correlationId === correlationId ? lease : undefined;
  }

  #findCurrentJob(
    lease: ActiveLocalGovernedOcrAuthorityLease,
    jobId: string
  ): Result<LocalGovernedOcrJobRow, AppError> {
    const primary = lease.bySlot.get('primary');
    if (!primary) return authorityDenied(lease.context.correlationId, 'Local OCR primary authority is absent');
    if (primary.intent.resourceType === 'local_ocr_job' && primary.intent.resourceId === jobId) {
      const found = this.dependencies.localGovernedOcrRepository.findJob(primary.repository, lease.key, jobId);
      if (!found.ok) return found;
      return found.value && exactJobRow(lease, found.value, jobId)
        ? ok(found.value)
        : authorityDenied(lease.context.correlationId, 'Local OCR current job binding is absent or invalid');
    }
    if (exactIntent(primary, {
      resourceType: 'archive_item', resourceId: primary.intent.resourceId, action: 'delete',
      capability: 'archive.write', purpose: 'ocr_process'
    })) {
      const found = this.dependencies.localGovernedOcrRepository.listJobsBySource(
        primary.repository,
        lease.key,
        'archive_item',
        primary.intent.resourceId
      );
      if (!found.ok) return found;
      const matches = found.value.filter((row) => row.id === jobId);
      return matches.length === 1 && exactJobRow(lease, matches[0]!, jobId)
        && matches[0]!.source.resourceId === primary.intent.resourceId
        ? ok(matches[0]!)
        : authorityDenied(lease.context.correlationId, 'Local OCR source-deletion job binding is absent or ambiguous');
    }
    return authorityDenied(lease.context.correlationId, 'Local OCR job lookup exceeds the primary authority');
  }

  #jobOperationIsAuthorized(
    lease: ActiveLocalGovernedOcrAuthorityLease,
    row: LocalGovernedOcrJobRow,
    operation: Exclude<LocalGovernedOcrRuntimeJobOperation, 'orphan_sweep'>
  ): boolean {
    const primary = lease.bySlot.get('primary');
    const source = lease.bySlot.get('source');
    const settings = lease.bySlot.get('settings');
    const target = lease.bySlot.get('target');
    const targetIntent = target?.intent as (LocalGovernedOcrPolicyIntent & { readonly sourceJobId?: string }) | undefined;
    const exactSourceRead = exactIntent(source, {
      resourceType: 'archive_item', resourceId: row.source.resourceId, action: 'read',
      capability: 'archive.ocr', purpose: 'ocr_process'
    });

    if (operation === 'read') return row.status === 'completed'
      && row.resultAvailable
      && row.deletionPropagation === 'active'
      && row.sourceDeletedAt === undefined
      && exactIntent(primary, {
      resourceType: 'local_ocr_job', resourceId: row.id, action: 'read',
      capability: 'archive.ocr', purpose: 'ocr_process'
    }) && exactSourceRead && !settings && !target;

    if (operation === 'correct') return row.status === 'completed'
      && row.resultAvailable
      && row.deletionPropagation === 'active'
      && row.sourceDeletedAt === undefined
      && exactIntent(primary, {
      resourceType: 'local_ocr_job', resourceId: row.id, action: 'process',
      capability: 'archive.ocr', purpose: 'ocr_process'
    }) && exactSourceRead && !settings && exactIntent(target, {
      resourceType: 'local_ocr_result', resourceId: row.derivedResourceId, action: 'process',
      capability: 'archive.ocr', purpose: 'ocr_process'
    }) && targetIntent?.sourceJobId === row.id;

    if (operation === 'cancel') return row.status === 'running'
      && row.deletionPropagation === 'active'
      && row.sourceDeletedAt === undefined
      && exactIntent(primary, {
      resourceType: 'local_ocr_job', resourceId: row.id, action: 'process',
      capability: 'archive.ocr', purpose: 'ocr_process'
    }) && exactSourceRead && !settings && !target;

    if (row.deletionPropagation !== 'active' || row.sourceDeletedAt !== undefined) return false;

    if (primary?.intent.resourceType === 'archive_item') return exactIntent(primary, {
      resourceType: 'archive_item', resourceId: row.source.resourceId, action: 'delete',
      capability: 'archive.write', purpose: 'ocr_process'
    }) && !source && !settings && !target;

    const primaryAction = primary?.intent.action;
    const capability = primaryAction === 'delete' ? 'archive.write' : 'archive.ocr';
    const exactPrimary = (primaryAction === 'process' || primaryAction === 'delete')
      && exactIntent(primary, {
        resourceType: 'local_ocr_job', resourceId: row.id, action: primaryAction,
        capability, purpose: 'ocr_process'
      });
    if (primaryAction === 'delete') {
      return exactPrimary && (!source || exactSourceRead) && !settings && !target;
    }
    return exactPrimary && exactSourceRead && !settings && !target;
  }

  #sealedResultMatches(
    row: LocalGovernedOcrJobRow,
    operation: Exclude<LocalGovernedOcrRuntimeJobOperation, 'orphan_sweep'>,
    sealedResultId: string | null
  ): boolean {
    if (operation === 'cancel') return sealedResultId === null;
    return sealedResultId !== null
      && SHA256.test(sealedResultId)
      && row.sealedResultId === sealedResultId;
  }

  public resolvePolicyResource(
    context: LocalGovernedOcrApplicationContext,
    key: LocalGovernedOcrAggregateKey,
    resourceType: Parameters<LocalGovernedOcrUnitOfWork['resolvePolicyResource']>[2],
    resourceId: string
  ): ReturnType<LocalGovernedOcrUnitOfWork['resolvePolicyResource']> {
    if (!exactKey(context, key)) return err(applicationError(context, 'OCR metadata lookup key exceeds the authenticated owner'));
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) =>
      this.dependencies.localGovernedOcrRepository.resolvePolicyResource(
        repositoryContext(context, transaction),
        key,
        resourceType,
        resourceId
      ));
  }

  public resolveArchivePolicyResource(
    context: LocalGovernedOcrApplicationContext,
    key: LocalGovernedOcrAggregateKey,
    resourceId: string
  ): ReturnType<LocalGovernedOcrUnitOfWork['resolveArchivePolicyResource']> {
    if (!exactKey(context, key)) return err(applicationError(context, 'OCR archive metadata lookup exceeds the authenticated owner'));
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) =>
      this.dependencies.localGovernedOcrRepository.resolveArchivePolicyResource(
        repositoryContext(context, transaction),
        key,
        resourceId
      ));
  }

  public listAuthorizationReconciliationCandidates(
    context: LocalGovernedOcrApplicationContext,
    key: LocalGovernedOcrAggregateKey,
    limit: number
  ): ReturnType<LocalGovernedOcrUnitOfWork['listAuthorizationReconciliationCandidates']> {
    if (!exactKey(context, key)) {
      return err(applicationError(context, 'OCR authorization reconciliation key exceeds the authenticated owner'));
    }
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) =>
      this.dependencies.localGovernedOcrRepository.listAuthorizationReconciliationCandidates(
        repositoryContext(context, transaction),
        key,
        transaction.occurredAt,
        limit
      ));
  }

  public async executeDetached<TPrepared, TResult>(
    context: LocalGovernedOcrApplicationContext,
    plan: LocalGovernedOcrAuthorizationPlan,
    runtimeAuthority: (prepared: TPrepared) => {
      readonly operation: 'run';
      readonly runId: string;
      readonly jobId: string;
      readonly derivedResourceId: string;
      readonly sourceResourceId: string;
      readonly expectedInputSha256: string;
    },
    prepare: (scope: LocalGovernedOcrWriteScope) => Result<TPrepared, AppError> | Promise<Result<TPrepared, AppError>>,
    operation: (prepared: TPrepared) => Promise<Result<TResult, AppError>>
  ): Promise<Result<TResult, AppError>> {
    if (typeof runtimeAuthority !== 'function' || typeof prepare !== 'function' || typeof operation !== 'function'
      || this.#detachedRunAuthorityLease) {
      return err(applicationError(
        context,
        'Local OCR detached run authority cannot overlap or omit its callbacks',
        { code: ERROR_CODES.RESOURCE_CONFLICT }
      ));
    }
    const committed = await this.execute(context, plan, async (scope) => {
      const prepared = await prepare(scope);
      if (!prepared.ok) return prepared;
      let authority: ReturnType<typeof runtimeAuthority>;
      try {
        authority = runtimeAuthority(prepared.value);
      } catch {
        return err(applicationError(context, 'Local OCR detached run authority could not be derived'));
      }
      if (authority.operation !== 'run' || !SHA256.test(authority.runId)
        || !SHA256.test(authority.expectedInputSha256)
        || authority.jobId.length < 8 || authority.derivedResourceId.length < 8
        || authority.sourceResourceId.length < 8) {
        return err(applicationError(context, 'Local OCR detached run authority is malformed'));
      }
      const source = await this.resolveAuthorizedArchiveSource({
        ...authority,
        correlationId: context.correlationId
      });
      if (!source.ok) return source;
      return ok(Object.freeze({ prepared: prepared.value, authority: Object.freeze(authority), source: source.value }));
    });
    if (!committed.ok) return committed;
    if (this.#detachedRunAuthorityLease) {
      return err(applicationError(
        context,
        'Local OCR detached run authority overlapped after commit',
        { code: ERROR_CODES.RESOURCE_CONFLICT }
      ));
    }
    const token = Symbol('local-governed-ocr-detached-run-authority');
    this.#detachedRunAuthorityLease = Object.freeze({
      token,
      context,
      authority: committed.value.authority,
      source: committed.value.source
    });
    try {
      return await operation(committed.value.prepared);
    } finally {
      if (this.#detachedRunAuthorityLease?.token === token) this.#detachedRunAuthorityLease = undefined;
    }
  }

  public async execute<T>(
    context: LocalGovernedOcrApplicationContext,
    plan: LocalGovernedOcrAuthorizationPlan,
    operation: (scope: LocalGovernedOcrWriteScope) => Result<T, AppError> | Promise<Result<T, AppError>>
  ): Promise<Result<T, AppError>> {
    if (!authorizationPlanIsCoherent(context, plan) || typeof operation !== 'function') {
      return err(applicationError(context, 'OCR authorization plan is incomplete or cross-scope'));
    }
    return this.#withTransactionTurn(async () => {
      let transactionOccurredAt: TransactionContext['occurredAt'] | undefined;
      let authorizationTransaction: TransactionContext | undefined;
      const authorizationOccurredAt = (): TransactionContext['occurredAt'] => {
      if (!transactionOccurredAt) {
        throw new PlatformPolicyEnforcementError(
          'ENFORCEMENT_UNAVAILABLE',
          'Local OCR async transaction timestamp has not been established'
        );
      }
      return transactionOccurredAt;
    };
      const activeAuthorizationTransaction = (): TransactionContext => {
      if (!authorizationTransaction) {
        throw new PlatformPolicyEnforcementError(
          'ENFORCEMENT_UNAVAILABLE',
          'Local OCR async authorization transaction has not been established'
        );
      }
      return authorizationTransaction;
    };

      try {
      const requested: Array<readonly [AuthorizationSlot, LocalGovernedOcrPolicyIntent]> = [
        ['primary', plan.primary]
      ];
      if (plan.source) requested.push(['source', plan.source]);
      if (plan.settings) requested.push(['settings', plan.settings]);
      if (plan.target) requested.push(['target', plan.target]);
      const resolved: ResolvedAuthorizationSlot[] = [];
      for (const [slot, intent] of requested) {
        const policyContext = policySlotContext(context, slot, intent);
        const enforcementPoint = await this.dependencies.policyEnforcementPointResolver.resolve(
          policyContext,
          intent,
          {
            ...(slot === 'primary' && intent.resourceType === 'local_ocr_job' && plan.source
              ? { sourceResourceId: plan.source.resourceId }
              : {}),
            authorizationOccurredAt,
            authorizationTransaction: activeAuthorizationTransaction
          }
        );
        validateEnforcementPoint(enforcementPoint);
        resolved.push({ slot, intent, policyContext, enforcementPoint });
      }

      const established: EstablishedAuthorizationSlot[] = [];
      const result = await this.dependencies.transactionExecutor.executeAsync(
        context.correlationId,
        async (transaction) => {
          transactionOccurredAt = transaction.occurredAt;
          authorizationTransaction = transaction;
          const authorize = async (index: number): Promise<Result<T, AppError>> => {
            const current = resolved[index];
            if (!current) {
              for (const slot of established) {
                const revalidated = slot.enforcementPoint.revalidateTransaction({
                  context: slot.policyContext,
                  intent: slot.intent,
                  authorization: slot.authorization,
                  transaction
                });
                if (!revalidated.ok) return revalidated;
              }
              for (const slot of established) {
                const recorded = slot.enforcementPoint.recordAuthorizedTransaction({
                  context: slot.policyContext,
                  intent: slot.intent,
                  authorization: slot.authorization,
                  transaction
                });
                if (!recorded.ok) return recorded;
              }
              const scope = new RepositoryBackedLocalGovernedOcrWriteScope(
                this.dependencies,
                context,
                established,
                asIsoDateTime(established.find((slot) => slot.slot === 'primary')!.authorization.occurredAt)
              );
              const personId = context.actor.personId;
              if (!personId || this.#activeAuthorityLease) {
                return err(applicationError(
                  context,
                  'Local OCR main authority lease cannot overlap or omit the exact person identity',
                  { code: ERROR_CODES.RESOURCE_CONFLICT }
                ));
              }
              const token = Symbol('local-governed-ocr-main-authority');
              this.#activeAuthorityLease = Object.freeze({
                token,
                context,
                key: Object.freeze({
                  familyId: context.familyId,
                  accountId: context.actor.userId,
                  ownerPersonId: asPersonId(personId)
                }),
                bySlot: new Map(established.map((slot) => [slot.slot, slot]))
              });
              try {
                return await operation(scope);
              } finally {
                if (this.#activeAuthorityLease?.token === token) this.#activeAuthorityLease = undefined;
              }
            }
            try {
              return await current.enforcementPoint.execute(
                {
                  correlationId: current.policyContext.correlationId,
                  action: current.intent.action,
                  capability: current.intent.capability,
                  resourceType: current.intent.resourceType,
                  resourceId: current.intent.resourceId,
                  purpose: current.intent.purpose
                },
                this.dependencies.clusterFence,
                async (authorization) => {
                  const repository = governedRepositoryContext(
                    current.policyContext,
                    transaction,
                    current.intent,
                    authorization
                  );
                  established.push({ ...current, authorization, repository });
                  return authorize(index + 1);
                }
              );
            } catch (error) {
              return policyFailure(context, error);
            }
          };
          return authorize(0);
        }
      );
      if (!result.ok) return result;

      for (const slot of established) {
        const projected = await slot.enforcementPoint.projectCommittedTransaction({
          context: slot.policyContext,
          intent: slot.intent,
          authorization: slot.authorization
        });
        if (!projected.ok) {
          const committed = projected.error.details?.businessTransactionCommitted === true;
          const pending = projected.error.details?.durableProjectionPending === true;
          if (!committed || !pending) return projected;
        }
      }
      return result;
      } catch (error) {
        return policyFailure(context, error);
      } finally {
        transactionOccurredAt = undefined;
        authorizationTransaction = undefined;
      }
    });
  }
}
