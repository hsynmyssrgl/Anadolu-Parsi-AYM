import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  asPersonId,
  asUserId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import type {
  ArchiveApplicationContext,
  ArchivePolicyIntent,
  ArchiveQueryPort,
  ArchiveUnitOfWork,
  ArchiveWriteScope
} from '@ppt/application';
import type { DomainEvent } from '@ppt/events';
import {
  PlatformPolicyEnforcementError,
  assertActivePlatformPolicyTransactionContext,
  type PlatformPolicyClusterFence,
  type PlatformPolicyEnforcementPoint,
  type PlatformPolicyTransactionContext
} from '@ppt/platform-policy';
import type {
  AccountRepositoryPort,
  AccountRow,
  ArchiveRepositoryPort,
  ArchivePolicyResourceRepositoryPort,
  AuditRepositoryPort,
  ObjectPermissionRepositoryPort,
  ObjectPermissionRow,
  OutboxRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';
import { CentralAuthorizationService, type AuthorizationAction, type AuthorizationGrant } from '@ppt/security';

export interface ArchivePolicyTransactionRevalidationInput {
  readonly context: ArchiveApplicationContext;
  readonly intent: ArchivePolicyIntent;
  readonly authorization: PlatformPolicyTransactionContext;
  readonly transaction: TransactionContext;
}

export interface ArchivePolicyCommittedTransactionInput {
  readonly context: ArchiveApplicationContext;
  readonly intent: ArchivePolicyIntent;
  readonly authorization: PlatformPolicyTransactionContext;
}

export type ArchivePolicyOperationResolution =
  | Readonly<{ state: 'execute' }>
  | Readonly<{ state: 'conflict'; resultHash: string; completedAt: string }>;

export interface ArchivePolicyOperationResultInput extends ArchivePolicyTransactionRevalidationInput {
  readonly resultHash: string;
}

export type ArchivePolicyEnforcementPoint = Pick<PlatformPolicyEnforcementPoint, 'execute'> & {
  /**
   * Production resolvers set this marker so an accidentally incomplete
   * composition fails before a receipt can authorize a repository operation.
   * Lightweight test resolvers may omit both this marker and the hook.
   */
  readonly requiresTransactionRevalidation?: true;
  readonly revalidateTransaction?: (
    input: ArchivePolicyTransactionRevalidationInput
  ) => Result<void, AppError>;
  /** Production marker: the exact receipt and fence must be recorded in SQLite before mutation. */
  readonly requiresDurableTransactionReceipt?: true;
  readonly recordAuthorizedTransaction?: (
    input: ArchivePolicyTransactionRevalidationInput
  ) => Result<void, AppError>;
  /** Production marker: retry identity and result are durable in the business transaction. */
  readonly requiresDurableOperationIdempotency?: true;
  readonly resolveAuthorizedOperation?: (
    input: ArchivePolicyTransactionRevalidationInput
  ) => Result<ArchivePolicyOperationResolution, AppError>;
  readonly recordAuthorizedOperationResult?: (
    input: ArchivePolicyOperationResultInput
  ) => Result<void, AppError>;
  /** Projects and acknowledges the durable pending receipt only after SQLite COMMIT. */
  readonly projectCommittedTransaction?: (
    input: ArchivePolicyCommittedTransactionInput
  ) => Promise<Result<void, AppError>> | Result<void, AppError>;
};

export interface ArchivePolicyEnforcementPointResolver {
  resolve(context: ArchiveApplicationContext):
    | ArchivePolicyEnforcementPoint
    | Promise<ArchivePolicyEnforcementPoint>;
}

export interface RepositoryBackedArchiveApplicationDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly archiveRepository: ArchiveRepositoryPort & ArchivePolicyResourceRepositoryPort;
  readonly accountRepository: AccountRepositoryPort;
  readonly permissionRepository: ObjectPermissionRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly outboxRepository: OutboxRepositoryPort;
  readonly policyEnforcementPointResolver: ArchivePolicyEnforcementPointResolver;
  readonly clusterFence: PlatformPolicyClusterFence;
}

export const failClosedArchivePolicyEnforcementPointResolver: ArchivePolicyEnforcementPointResolver = Object.freeze({
  resolve(): never {
    throw new PlatformPolicyEnforcementError(
      'ENFORCEMENT_UNAVAILABLE',
      'Archive policy enforcement is not composed for this process'
    );
  }
});

export const nonWritableArchiveClusterFence: PlatformPolicyClusterFence = () => Object.freeze({ writable: false, epoch: 0 });

const repositoryContext = (
  context: ArchiveApplicationContext,
  transaction: TransactionContext
): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: {
    userId: context.actor.userId,
    roles: [context.actor.role],
    ...(context.actor.personId ? { personId: asPersonId(context.actor.personId) } : {})
  },
  correlationId: context.correlationId,
  occurredAt: transaction.occurredAt
});

const governedRepositoryContext = (
  context: ArchiveApplicationContext,
  transaction: TransactionContext,
  authorization: PlatformPolicyTransactionContext,
  intent: ArchivePolicyIntent
): PolicyAuthorizedRepositoryExecutionContext => {
  assertActivePlatformPolicyTransactionContext(authorization, {
    resourceType: intent.resourceType,
    resourceId: intent.resourceId,
    action: intent.action,
    capability: intent.capability,
    correlationId: context.correlationId,
    resourceFamilyId: context.familyId,
    fenceEpoch: authorization.fenceEpoch,
    fenceWritable: authorization.fenceWritable
  });
  if (
    authorization.subject.accountId !== context.actor.userId ||
    authorization.resourceFamilyId !== context.familyId ||
    (context.actor.personId !== undefined && authorization.subject.personId !== context.actor.personId)
  ) {
    throw new PlatformPolicyEnforcementError(
      'TRANSACTION_CONTEXT_MISMATCH',
      'Trusted policy subject or family does not match the archive application boundary'
    );
  }
  return {
    transaction: transaction.transaction,
    actor: {
      userId: asUserId(authorization.subject.accountId),
      roles: authorization.subject.roles,
      ...(authorization.subject.personId ? { personId: asPersonId(authorization.subject.personId) } : {})
    },
    correlationId: context.correlationId,
    occurredAt: transaction.occurredAt,
    policyAuthorization: authorization
  };
};

const accountIsActive = (account: AccountRow, occurredAt: string): boolean =>
  account.status === 'active' &&
  Date.parse(account.startsAt) <= Date.parse(occurredAt) &&
  (!account.endsAt || Date.parse(account.endsAt) >= Date.parse(occurredAt));

const toGrant = (row: ObjectPermissionRow): AuthorizationGrant => ({
  id: row.id,
  subjectAccountId: row.subjectAccountId,
  resourceType: row.resourceType,
  resourceId: row.resourceId,
  actions: row.actions as readonly AuthorizationAction[],
  effect: row.effect,
  purpose: row.purpose,
  ...(row.familyBranchId ? { familyBranchId: row.familyBranchId } : {}),
  ...(row.ownershipBasisPoints === undefined ? {} : { ownershipBasisPoints: row.ownershipBasisPoints }),
  ...(row.denialReason ? { denialReason: row.denialReason } : {}),
  startsAt: row.startsAt,
  ...(row.endsAt ? { endsAt: row.endsAt } : {})
});

interface AuthorizationSnapshot {
  readonly account: AccountRow;
  readonly grants: readonly AuthorizationGrant[];
}

const loadAuthorizationSnapshot = (
  dependencies: RepositoryBackedArchiveApplicationDependencies,
  context: ArchiveApplicationContext,
  execution: RepositoryExecutionContext
): Result<AuthorizationSnapshot, AppError> => {
  const account = dependencies.accountRepository.findById(execution, context.actor.userId);
  if (!account.ok) return account;
  if (!account.value || !accountIsActive(account.value, execution.occurredAt)) {
    return err(createAppError({
      code: ERROR_CODES.AUTHORIZATION_DENIED,
      message: 'Arşiv erişimi için etkin üyelik gereklidir.',
      category: 'authorization',
      correlationId: context.correlationId
    }));
  }
  const grants = dependencies.permissionRepository.listActiveForSubject(
    execution,
    context.actor.userId,
    execution.occurredAt
  );
  return grants.ok
    ? { ok: true, value: { account: account.value, grants: grants.value.map(toGrant) } }
    : grants;
};

const legacyReadAllowed = (
  service: CentralAuthorizationService,
  snapshot: AuthorizationSnapshot,
  input: { readonly action: AuthorizationAction; readonly resourceId: string; readonly occurredAt: string }
): boolean => service.authorize({
  accountId: snapshot.account.id,
  role: snapshot.account.role as ArchiveApplicationContext['actor']['role'],
  action: input.action,
  resourceType: 'archive_item',
  resourceId: input.resourceId,
  occurredAt: input.occurredAt,
  ...(snapshot.account.personId ? { actorPersonId: snapshot.account.personId } : {}),
  grants: snapshot.grants
}).allowed;

const policyFailure = (context: ArchiveApplicationContext, error: unknown): Result<never, AppError> => {
  const enforcementCode = error instanceof PlatformPolicyEnforcementError
    ? error.code
    : 'ENFORCEMENT_UNAVAILABLE';
  const message = error instanceof Error ? error.message : 'Archive policy enforcement is unavailable';
  return err(createAppError({
    code: ERROR_CODES.AUTHORIZATION_DENIED,
    message: `Arşiv işlemi merkezî politika tarafından kapalı durdu: ${message}`,
    category: enforcementCode === 'POLICY_DENIED' ? 'authorization' : 'security',
    correlationId: context.correlationId,
    details: { enforcementCode }
  }));
};

const ARCHIVE_OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

const canonicalArchiveOperationJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalArchiveOperationJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalArchiveOperationJson(record[key])}`).join(',')}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('Archive operation result is not JSON serializable');
  return serialized;
};

const hashArchiveOperationResult = (value: unknown): string => createHash('sha256')
  .update(canonicalArchiveOperationJson({
    hasValue: value !== undefined,
    value: value === undefined ? null : value
  }), 'utf8')
  .digest('hex');

type ArchiveOperationExecution<T> =
  | Readonly<{ state: 'value'; value: T }>
  | Readonly<{ state: 'conflict'; resultHash: string; completedAt: string }>;

const establishGovernedTransaction = (
  enforcementPoint: ArchivePolicyEnforcementPoint,
  input: ArchivePolicyTransactionRevalidationInput
): Result<void, AppError> => {
  const revalidation = enforcementPoint.revalidateTransaction?.(input);
  if (revalidation && !revalidation.ok) return revalidation;
  const recorded = enforcementPoint.recordAuthorizedTransaction?.(input);
  return recorded && !recorded.ok ? recorded : { ok: true, value: undefined };
};

const executeGoverned = async <T>(
  dependencies: RepositoryBackedArchiveApplicationDependencies,
  context: ArchiveApplicationContext,
  intent: ArchivePolicyIntent,
  operation: (
    authorization: PlatformPolicyTransactionContext,
    enforcementPoint: ArchivePolicyEnforcementPoint
  ) => Result<T, AppError> | Promise<Result<T, AppError>>
): Promise<Result<T, AppError>> => {
  try {
    const enforcementPoint = await dependencies.policyEnforcementPointResolver.resolve(context);
    if (!enforcementPoint || typeof enforcementPoint.execute !== 'function') {
      throw new PlatformPolicyEnforcementError('ENFORCEMENT_UNAVAILABLE', 'Archive Policy Enforcement Point is missing');
    }
    if (
      enforcementPoint.requiresTransactionRevalidation === true
      && typeof enforcementPoint.revalidateTransaction !== 'function'
    ) {
      throw new PlatformPolicyEnforcementError(
        'ENFORCEMENT_UNAVAILABLE',
        'Archive production policy transaction revalidation is missing'
      );
    }
    if (
      enforcementPoint.requiresDurableTransactionReceipt === true
      && (
        typeof enforcementPoint.recordAuthorizedTransaction !== 'function'
        || typeof enforcementPoint.projectCommittedTransaction !== 'function'
      )
    ) {
      throw new PlatformPolicyEnforcementError(
        'ENFORCEMENT_UNAVAILABLE',
        'Archive production durable policy receipt boundary is incomplete'
      );
    }
    if (
      intent.action !== 'read'
      &&
      enforcementPoint.requiresDurableOperationIdempotency === true
      && (
        typeof enforcementPoint.resolveAuthorizedOperation !== 'function'
        || typeof enforcementPoint.recordAuthorizedOperationResult !== 'function'
        || typeof context.operationId !== 'string'
        || !ARCHIVE_OPERATION_ID.test(context.operationId)
        || typeof context.operationFingerprint !== 'string'
        || !SHA256.test(context.operationFingerprint)
      )
    ) {
      throw new PlatformPolicyEnforcementError(
        'ENFORCEMENT_UNAVAILABLE',
        'Archive production operation idempotency boundary is incomplete'
      );
    }
    let committedAuthorization: PlatformPolicyTransactionContext | undefined;
    const result = await enforcementPoint.execute(
      {
        correlationId: context.correlationId,
        action: intent.action,
        capability: intent.capability,
        resourceType: intent.resourceType,
        resourceId: intent.resourceId,
        purpose: intent.purpose
      },
      dependencies.clusterFence,
      async (authorization) => {
        assertActivePlatformPolicyTransactionContext(authorization, {
          resourceType: intent.resourceType,
          resourceId: intent.resourceId,
          action: intent.action,
          capability: intent.capability,
          correlationId: context.correlationId,
          resourceFamilyId: context.familyId,
          fenceEpoch: authorization.fenceEpoch,
          fenceWritable: authorization.fenceWritable
        });
        if (
          authorization.subject.accountId !== context.actor.userId ||
          authorization.resourceFamilyId !== context.familyId ||
          (context.actor.personId !== undefined && authorization.subject.personId !== context.actor.personId)
        ) {
          throw new PlatformPolicyEnforcementError(
            'TRANSACTION_CONTEXT_MISMATCH',
            'Trusted policy subject or family does not match the archive application context'
          );
        }
        const operationResult = await operation(authorization, enforcementPoint);
        if (operationResult.ok) committedAuthorization = authorization;
        return operationResult;
      }
    );
    if (
      result.ok
      && committedAuthorization
      && enforcementPoint.requiresDurableTransactionReceipt === true
    ) {
      const projection = await enforcementPoint.projectCommittedTransaction!({
        context,
        intent,
        authorization: committedAuthorization
      });
      if (!projection.ok) return projection;
    }
    return result;
  } catch (error) {
    return policyFailure(context, error);
  }
};

const archiveReadIntent = (
  context: ArchiveApplicationContext,
  resourceType: 'archive_collection' | 'archive_item',
  resourceId: string
): ArchivePolicyIntent => ({ action: 'read', capability: 'archive.read', resourceType, resourceId, purpose: 'archive' });

const executeGovernedRead = <T>(
  dependencies: RepositoryBackedArchiveApplicationDependencies,
  context: ArchiveApplicationContext,
  intent: ArchivePolicyIntent,
  operation: (
    execution: PolicyAuthorizedRepositoryExecutionContext,
    snapshot: AuthorizationSnapshot
  ) => Result<T, AppError>
): Promise<Result<T, AppError>> => executeGoverned(dependencies, context, intent, (authorization, enforcementPoint) =>
  dependencies.transactionExecutor.execute<T>(context.correlationId, (transaction) => {
    const governedInput = { context, intent, authorization, transaction };
    const established = establishGovernedTransaction(enforcementPoint, governedInput);
    if (!established.ok) return established;
    const execution = governedRepositoryContext(context, transaction, authorization, intent);
    const snapshot = loadAuthorizationSnapshot(dependencies, context, execution);
    return snapshot.ok ? operation(execution, snapshot.value) : snapshot;
  })
);

/* Historical receiptless query adapter retained in source history only.
class RepositoryBackedArchiveQueryPort implements ArchiveQueryPort {
  readonly #authorization = new CentralAuthorizationService();

  public constructor(private readonly dependencies: RepositoryBackedArchiveApplicationDependencies) {}

  public getOpenPlan(context: ArchiveApplicationContext, itemId: string): ReturnType<ArchiveQueryPort['getOpenPlan']> {
    return this.dependencies.transactionExecutor.execute<{ storedName: string; sha256: string; originalName: string; mimeType: string; sizeBytes: number; sensitivity: 'standard' | 'personal' | 'high' }>(context.correlationId, (transaction) => {
      const execution = repositoryContext(context, transaction);
      const snapshot = loadAuthorizationSnapshot(this.dependencies, context, execution);
      if (!snapshot.ok) return snapshot;
      if (!legacyReadAllowed(this.#authorization, snapshot.value, { action: 'read', resourceId: itemId, occurredAt: execution.occurredAt })) {
        return err(createAppError({ code: ERROR_CODES.AUTHORIZATION_DENIED, message: 'Bu arşiv kaydını görüntüleme yetkiniz yok.', category: 'authorization', correlationId: context.correlationId }));
      }
      const row = this.dependencies.archiveRepository.find(execution, itemId);
      if (!row.ok) return row;
      if (!row.value) return err(createAppError({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: 'Arşiv kaydı bulunamadı.', category: 'not_found', correlationId: context.correlationId }));
      return { ok: true, value: { storedName: row.value.storedName, sha256: row.value.sha256, originalName: row.value.originalName, mimeType: row.value.mimeType, sizeBytes: row.value.sizeBytes, sensitivity: row.value.sensitivity } };
    });
  }

  public list(context: ArchiveApplicationContext): ReturnType<ArchiveQueryPort['list']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const execution = repositoryContext(context, transaction);
      const snapshot = loadAuthorizationSnapshot(this.dependencies, context, execution);
      if (!snapshot.ok) return snapshot;
      const rows = this.dependencies.archiveRepository.list(execution);
      return rows.ok
        ? { ok: true, value: rows.value.filter((row) => legacyReadAllowed(this.#authorization, snapshot.value, { action: 'read', resourceId: row.id, occurredAt: execution.occurredAt })) }
        : rows;
    });
  }

  public search(context: ArchiveApplicationContext, input: Parameters<ArchiveQueryPort['search']>[1]): ReturnType<ArchiveQueryPort['search']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const execution = repositoryContext(context, transaction);
      const snapshot = loadAuthorizationSnapshot(this.dependencies, context, execution);
      if (!snapshot.ok) return snapshot;
      const rows = this.dependencies.archiveRepository.search(execution, input);
      return rows.ok
        ? {
            ok: true,
            value: rows.value
              .filter((row) => legacyReadAllowed(this.#authorization, snapshot.value, { action: 'read', resourceId: row.id, occurredAt: execution.occurredAt }))
              .map(({ storedName: _storedName, familyId: _familyId, categoryId: _categoryId, sensitivity: _sensitivity, aiProcessingAllowed: _ai, ...view }) => view)
          }
        : rows;
    });
  }

  public listVersions(context: ArchiveApplicationContext, itemId: string): ReturnType<ArchiveQueryPort['listVersions']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const execution = repositoryContext(context, transaction);
      const snapshot = loadAuthorizationSnapshot(this.dependencies, context, execution);
      if (!snapshot.ok) return snapshot;
      if (!legacyReadAllowed(this.#authorization, snapshot.value, { action: 'read', resourceId: itemId, occurredAt: execution.occurredAt })) {
        return err(createAppError({ code: ERROR_CODES.AUTHORIZATION_DENIED, message: 'Bu arşiv kaydını görüntüleme yetkiniz yok.', category: 'authorization', correlationId: context.correlationId }));
      }
      return this.dependencies.archiveRepository.listVersions(execution, itemId);
    });
  }

  public listRetentionPolicies(context: ArchiveApplicationContext): ReturnType<ArchiveQueryPort['listRetentionPolicies']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const execution = repositoryContext(context, transaction);
      const snapshot = loadAuthorizationSnapshot(this.dependencies, context, execution);
      return snapshot.ok ? this.dependencies.archiveRepository.listRetentionPolicies(execution) : snapshot;
    });
  }

  public listRetentionStatus(context: ArchiveApplicationContext): ReturnType<ArchiveQueryPort['listRetentionStatus']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const execution = repositoryContext(context, transaction);
      const snapshot = loadAuthorizationSnapshot(this.dependencies, context, execution);
      if (!snapshot.ok) return snapshot;
      const rows = this.dependencies.archiveRepository.listRetentionStatus(execution);
      return rows.ok
        ? { ok: true, value: rows.value.filter((row) => legacyReadAllowed(this.#authorization, snapshot.value, { action: 'read', resourceId: row.itemId, occurredAt: execution.occurredAt })) }
        : rows;
    });
  }

  public async getDestructionPlan(context: ArchiveApplicationContext, itemId: string): ReturnType<ArchiveQueryPort['getDestructionPlan']> {
    const intent: ArchivePolicyIntent = { action: 'delete', capability: 'archive.write', resourceType: 'archive_item', resourceId: itemId, purpose: 'archive' };
    return executeGoverned(this.dependencies, context, intent, (authorization, enforcementPoint) =>
      this.dependencies.transactionExecutor.execute<{ storedName: string; secureDestroy: boolean }>(context.correlationId, (transaction) => {
        const established = establishGovernedTransaction(enforcementPoint, { context, intent, authorization, transaction });
        if (!established.ok) return established;
        const execution = governedRepositoryContext(context, transaction, authorization, intent);
        const plan = this.dependencies.archiveRepository.getDestructionPlan(execution, itemId);
        if (!plan.ok) return plan;
        return plan.value
          ? { ok: true, value: plan.value }
          : err(createAppError({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: 'Arşiv kaydı bulunamadı.', category: 'not_found', correlationId: context.correlationId }));
      })
    );
  }

  public listCategories(context: ArchiveApplicationContext): ReturnType<ArchiveQueryPort['listCategories']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const execution = repositoryContext(context, transaction);
      const snapshot = loadAuthorizationSnapshot(this.dependencies, context, execution);
      return snapshot.ok ? this.dependencies.archiveRepository.listCategories(execution) : snapshot;
    });
  }

  public listClassifications(context: ArchiveApplicationContext): ReturnType<ArchiveQueryPort['listClassifications']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const execution = repositoryContext(context, transaction);
      const snapshot = loadAuthorizationSnapshot(this.dependencies, context, execution);
      if (!snapshot.ok) return snapshot;
      const rows = this.dependencies.archiveRepository.listClassifications(execution);
      return rows.ok
        ? { ok: true, value: rows.value.filter((row) => legacyReadAllowed(this.#authorization, snapshot.value, { action: 'read', resourceId: row.itemId, occurredAt: execution.occurredAt })) }
        : rows;
    });
  }
}
*/

export class RepositoryBackedArchiveQueryPort implements ArchiveQueryPort {
  readonly #authorization = new CentralAuthorizationService();

  public constructor(private readonly dependencies: RepositoryBackedArchiveApplicationDependencies) {}

  public getOpenPlan(context: ArchiveApplicationContext, itemId: string): ReturnType<ArchiveQueryPort['getOpenPlan']> {
    return executeGovernedRead<{ storedName: string; sha256: string; originalName: string; mimeType: string; sizeBytes: number; sensitivity: 'standard' | 'personal' | 'high' }>(this.dependencies, context, archiveReadIntent(context, 'archive_item', itemId), (execution, snapshot) => {
      if (!legacyReadAllowed(this.#authorization, snapshot, { action: 'read', resourceId: itemId, occurredAt: execution.occurredAt })) {
        return err(createAppError({ code: ERROR_CODES.AUTHORIZATION_DENIED, message: 'Bu arşiv kaydını görüntüleme yetkiniz yok.', category: 'authorization', correlationId: context.correlationId }));
      }
      const row = this.dependencies.archiveRepository.find(execution, itemId);
      if (!row.ok) return row;
      if (!row.value) return err(createAppError({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: 'Arşiv kaydı bulunamadı.', category: 'not_found', correlationId: context.correlationId }));
      return { ok: true, value: { storedName: row.value.storedName, sha256: row.value.sha256, originalName: row.value.originalName, mimeType: row.value.mimeType, sizeBytes: row.value.sizeBytes, sensitivity: row.value.sensitivity } };
    });
  }

  public list(context: ArchiveApplicationContext): ReturnType<ArchiveQueryPort['list']> {
    return executeGovernedRead(this.dependencies, context, archiveReadIntent(context, 'archive_collection', String(context.familyId)), (execution, snapshot) => {
      const rows = this.dependencies.archiveRepository.list(execution);
      return rows.ok
        ? { ok: true, value: rows.value.filter((row) => legacyReadAllowed(this.#authorization, snapshot, { action: 'read', resourceId: row.id, occurredAt: execution.occurredAt })) }
        : rows;
    });
  }

  public search(context: ArchiveApplicationContext, input: Parameters<ArchiveQueryPort['search']>[1]): ReturnType<ArchiveQueryPort['search']> {
    return executeGovernedRead(this.dependencies, context, archiveReadIntent(context, 'archive_collection', String(context.familyId)), (execution, snapshot) => {
      const rows = this.dependencies.archiveRepository.search(execution, input);
      return rows.ok
        ? {
            ok: true,
            value: rows.value
              .filter((row) => legacyReadAllowed(this.#authorization, snapshot, { action: 'read', resourceId: row.id, occurredAt: execution.occurredAt }))
              .map(({ storedName: _storedName, familyId: _familyId, categoryId: _categoryId, sensitivity: _sensitivity, aiProcessingAllowed: _ai, ...view }) => view)
          }
        : rows;
    });
  }

  public listVersions(context: ArchiveApplicationContext, itemId: string): ReturnType<ArchiveQueryPort['listVersions']> {
    return executeGovernedRead(this.dependencies, context, archiveReadIntent(context, 'archive_item', itemId), (execution, snapshot) => {
      if (!legacyReadAllowed(this.#authorization, snapshot, { action: 'read', resourceId: itemId, occurredAt: execution.occurredAt })) {
        return err(createAppError({ code: ERROR_CODES.AUTHORIZATION_DENIED, message: 'Bu arşiv kaydını görüntüleme yetkiniz yok.', category: 'authorization', correlationId: context.correlationId }));
      }
      return this.dependencies.archiveRepository.listVersions(execution, itemId);
    });
  }

  public listRetentionPolicies(context: ArchiveApplicationContext): ReturnType<ArchiveQueryPort['listRetentionPolicies']> {
    return executeGovernedRead(this.dependencies, context, archiveReadIntent(context, 'archive_collection', String(context.familyId)), (execution) =>
      this.dependencies.archiveRepository.listRetentionPolicies(execution)
    );
  }

  public listRetentionStatus(context: ArchiveApplicationContext): ReturnType<ArchiveQueryPort['listRetentionStatus']> {
    return executeGovernedRead(this.dependencies, context, archiveReadIntent(context, 'archive_collection', String(context.familyId)), (execution, snapshot) => {
      const rows = this.dependencies.archiveRepository.listRetentionStatus(execution);
      return rows.ok
        ? { ok: true, value: rows.value.filter((row) => legacyReadAllowed(this.#authorization, snapshot, { action: 'read', resourceId: row.itemId, occurredAt: execution.occurredAt })) }
        : rows;
    });
  }

  public async getDestructionPlan(context: ArchiveApplicationContext, itemId: string): ReturnType<ArchiveQueryPort['getDestructionPlan']> {
    const intent: ArchivePolicyIntent = { action: 'delete', capability: 'archive.write', resourceType: 'archive_item', resourceId: itemId, purpose: 'archive' };
    return executeGoverned(this.dependencies, context, intent, (authorization, enforcementPoint) =>
      this.dependencies.transactionExecutor.execute<{ storedName: string; secureDestroy: boolean }>(context.correlationId, (transaction) => {
        const established = establishGovernedTransaction(enforcementPoint, { context, intent, authorization, transaction });
        if (!established.ok) return established;
        const execution = governedRepositoryContext(context, transaction, authorization, intent);
        const plan = this.dependencies.archiveRepository.getDestructionPlan(execution, itemId);
        if (!plan.ok) return plan;
        return plan.value
          ? { ok: true, value: plan.value }
          : err(createAppError({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: 'Arşiv kaydı bulunamadı.', category: 'not_found', correlationId: context.correlationId }));
      })
    );
  }

  public listCategories(context: ArchiveApplicationContext): ReturnType<ArchiveQueryPort['listCategories']> {
    return executeGovernedRead(this.dependencies, context, archiveReadIntent(context, 'archive_collection', String(context.familyId)), (execution) =>
      this.dependencies.archiveRepository.listCategories(execution)
    );
  }

  public listClassifications(context: ArchiveApplicationContext): ReturnType<ArchiveQueryPort['listClassifications']> {
    return executeGovernedRead(this.dependencies, context, archiveReadIntent(context, 'archive_collection', String(context.familyId)), (execution, snapshot) => {
      const rows = this.dependencies.archiveRepository.listClassifications(execution);
      return rows.ok
        ? { ok: true, value: rows.value.filter((row) => legacyReadAllowed(this.#authorization, snapshot, { action: 'read', resourceId: row.itemId, occurredAt: execution.occurredAt })) }
        : rows;
    });
  }
}

class GovernedArchiveWriteScope implements ArchiveWriteScope {
  public constructor(
    private readonly dependencies: RepositoryBackedArchiveApplicationDependencies,
    private readonly execution: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: ArchiveWriteScope['occurredAt']
  ) {}

  public findOpenPlan(itemId: string): ReturnType<ArchiveWriteScope['findOpenPlan']> {
    const row = this.dependencies.archiveRepository.findForPolicyResolution(this.execution, itemId);
    if (!row.ok || !row.value) return row;
    if (row.value.familyId !== this.execution.policyAuthorization.resourceFamilyId) return ok(null);
    return ok({
      storedName:row.value.storedName,
      sha256:row.value.sha256,
      originalName:row.value.originalName,
      mimeType:row.value.mimeType,
      sizeBytes:row.value.sizeBytes,
      sensitivity:row.value.sensitivity
    });
  }

  public insertRetentionPolicy(input: Parameters<ArchiveWriteScope['insertRetentionPolicy']>[0]) { return this.dependencies.archiveRepository.insertRetentionPolicy(this.execution, input); }
  public assignRetentionPolicy(itemId: string, policyId: string | null) { return this.dependencies.archiveRepository.assignRetentionPolicy(this.execution, itemId, policyId); }
  public markDestroyed(itemId: string, destroyedAt: ArchiveWriteScope['occurredAt']) { return this.dependencies.archiveRepository.markDestroyed(this.execution, itemId, destroyedAt); }
  public insertItem(input: Parameters<ArchiveWriteScope['insertItem']>[0]) { return this.dependencies.archiveRepository.insert(this.execution, input); }
  public insertVersion(input: Parameters<ArchiveWriteScope['insertVersion']>[0]) { return this.dependencies.archiveRepository.insertVersion(this.execution, input); }
  public incrementEventAttachment(eventId: string) { return this.dependencies.archiveRepository.incrementEventAttachment(this.execution, eventId); }
  public appendAudit(input: Parameters<ArchiveWriteScope['appendAudit']>[0]) { return this.dependencies.auditRepository.append(this.execution, input); }
  public enqueueEvent<T>(event: DomainEvent<T>) { return this.dependencies.outboxRepository.enqueue(this.execution, event); }
  public insertCategory(input: Parameters<ArchiveWriteScope['insertCategory']>[0]) { return this.dependencies.archiveRepository.insertCategory(this.execution, input); }
  public updateClassification(input: Parameters<ArchiveWriteScope['updateClassification']>[0]) { return this.dependencies.archiveRepository.updateClassification(this.execution, input); }
}

export class RepositoryBackedArchiveUnitOfWork implements ArchiveUnitOfWork {
  public constructor(private readonly dependencies: RepositoryBackedArchiveApplicationDependencies) {}

  public async execute<T>(
    context: ArchiveApplicationContext,
    intent: ArchivePolicyIntent,
    operation: (scope: ArchiveWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    const governed = await executeGoverned<ArchiveOperationExecution<T>>(
      this.dependencies,
      context,
      intent,
      (authorization, enforcementPoint) =>
      this.dependencies.transactionExecutor.execute<ArchiveOperationExecution<T>>(context.correlationId, (transaction) => {
        const governedInput = { context, intent, authorization, transaction };
        const established = establishGovernedTransaction(enforcementPoint, governedInput);
        if (!established.ok) return established;
        const resolution = enforcementPoint.resolveAuthorizedOperation?.(governedInput);
        if (resolution && !resolution.ok) return resolution;
        if (resolution?.ok && resolution.value.state === 'conflict') {
          return ok(Object.freeze({
            state: 'conflict' as const,
            resultHash: resolution.value.resultHash,
            completedAt: resolution.value.completedAt
          }));
        }
        const execution = governedRepositoryContext(context, transaction, authorization, intent);
        const result = operation(new GovernedArchiveWriteScope(this.dependencies, execution, transaction.occurredAt));
        if (!result.ok) return result;
        const idempotency = enforcementPoint.recordAuthorizedOperationResult?.({
          ...governedInput,
          resultHash: hashArchiveOperationResult(result.value)
        });
        if (idempotency && !idempotency.ok) return idempotency;
        // The exact receipt and monotonically synchronized database fence were
        // recorded before the mutation in this same SQLite transaction. This
        // final live assertion catches an in-process fence change before COMMIT;
        // database triggers reject any persisted fence mismatch. This archive
        // boundary does not claim universal enforcement for unrelated writes or
        // an external protected-journal complete-tail rollback.
        assertActivePlatformPolicyTransactionContext(authorization, {
          resourceType: intent.resourceType,
          resourceId: intent.resourceId,
          action: intent.action,
          capability: intent.capability,
          correlationId: context.correlationId,
          resourceFamilyId: context.familyId,
          fenceEpoch: authorization.fenceEpoch,
          fenceWritable: authorization.fenceWritable
        });
        return ok(Object.freeze({ state: 'value' as const, value: result.value }));
      })
    );
    if (!governed.ok) return governed;
    if (governed.value.state === 'conflict') {
      return err(createAppError({
        code: ERROR_CODES.RESOURCE_CONFLICT,
        message: 'Arşiv işlemi daha önce tamamlandı; semantik sonuç yeniden oynatılmadı. Güncel durumu yeniden yükleyin.',
        category: 'conflict',
        correlationId: context.correlationId,
        details: Object.freeze({
          operationId: context.operationId,
          status: 'completed',
          resultHash: governed.value.resultHash,
          completedAt: governed.value.completedAt,
          semanticReplay: 'forbidden',
          reloadRequired: true
        })
      }));
    }
    return ok(governed.value.value);
  }
}
