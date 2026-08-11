import {
  ERROR_CODES,
  asPersonId,
  asUserId,
  createAppError,
  err,
  type AppError,
  type Result,
  type UserId
} from '@ppt/core';
import type {
  HealthApplicationContext,
  HealthPolicyIntent,
  HealthQueryPort,
  HealthUnitOfWork,
  HealthWriteScope
} from '@ppt/application';
import {
  PlatformPolicyEnforcementError,
  assertActivePlatformPolicyTransactionContext,
  type PlatformPolicyClusterFence,
  type PlatformPolicyEnforcementPoint,
  type PlatformPolicyTransactionContext
} from '@ppt/platform-policy';
import type { TransactionExecutor, TransactionContext } from '@ppt/repository-contracts';
import type { DomainEvent } from '@ppt/events';
import type {
  AccountRepositoryPort,
  AuditRepositoryPort,
  HealthRepositoryPort,
  ObjectPermissionRepositoryPort,
  OutboxRepositoryPort,
  PersonRepositoryPort,
  AccountRow,
  ObjectPermissionRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext
} from '@ppt/repository-contracts';
import {
  CentralAuthorizationService,
  type AuthorizationAction,
  type AuthorizationGrant
} from '@ppt/security';

export interface HealthPolicyTransactionRevalidationInput {
  readonly context: HealthApplicationContext;
  readonly intent: HealthPolicyIntent;
  readonly authorization: PlatformPolicyTransactionContext;
  readonly transaction: TransactionContext;
}

export interface HealthPolicyCommittedTransactionInput {
  readonly context: HealthApplicationContext;
  readonly intent: HealthPolicyIntent;
  readonly authorization: PlatformPolicyTransactionContext;
}

export type HealthPolicyEnforcementPoint = Pick<PlatformPolicyEnforcementPoint, 'execute'> & {
  readonly requiresTransactionRevalidation?: true;
  readonly revalidateTransaction?: (
    input: HealthPolicyTransactionRevalidationInput
  ) => Result<void, AppError>;
  readonly requiresDurableTransactionReceipt?: true;
  readonly recordAuthorizedTransaction?: (
    input: HealthPolicyTransactionRevalidationInput
  ) => Result<void, AppError>;
  readonly projectCommittedTransaction?: (
    input: HealthPolicyCommittedTransactionInput
  ) => Promise<Result<void, AppError>> | Result<void, AppError>;
};

export interface HealthPolicyEnforcementPointResolver {
  resolve(
    context: HealthApplicationContext,
    intent: HealthPolicyIntent
  ): HealthPolicyEnforcementPoint | Promise<HealthPolicyEnforcementPoint>;
}

export interface RepositoryBackedHealthApplicationDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly healthRepository: HealthRepositoryPort;
  readonly accountRepository: AccountRepositoryPort;
  readonly permissionRepository: ObjectPermissionRepositoryPort;
  readonly personRepository: PersonRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly outboxRepository: OutboxRepositoryPort;
  readonly policyEnforcementPointResolver: HealthPolicyEnforcementPointResolver;
  readonly clusterFence: PlatformPolicyClusterFence;
}

export const failClosedHealthPolicyEnforcementPointResolver: HealthPolicyEnforcementPointResolver = Object.freeze({
  resolve(): never {
    throw new PlatformPolicyEnforcementError(
      'ENFORCEMENT_UNAVAILABLE',
      'Health policy enforcement is not composed for this process'
    );
  }
});

export const nonWritableHealthClusterFence: PlatformPolicyClusterFence = () => Object.freeze({
  writable: false,
  epoch: 0
});

const repositoryContext = (
  context: HealthApplicationContext,
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
  context: HealthApplicationContext,
  transaction: TransactionContext,
  authorization: PlatformPolicyTransactionContext,
  intent: HealthPolicyIntent
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
    authorization.subject.accountId !== context.actor.userId
    || authorization.resourceFamilyId !== context.familyId
    || (context.actor.personId !== undefined && authorization.subject.personId !== context.actor.personId)
  ) {
    throw new PlatformPolicyEnforcementError(
      'TRANSACTION_CONTEXT_MISMATCH',
      'Trusted policy subject or family does not match the health application boundary'
    );
  }
  return {
    transaction: transaction.transaction,
    actor: {
      userId: asUserId(authorization.subject.accountId),
      roles: authorization.subject.roles,
      ...(authorization.subject.personId
        ? { personId: asPersonId(authorization.subject.personId) }
        : {})
    },
    correlationId: context.correlationId,
    occurredAt: transaction.occurredAt,
    policyAuthorization: authorization
  };
};

const activeAccount = (account: AccountRow, occurredAt: string): boolean => account.status === 'active'
  && Date.parse(account.startsAt) <= Date.parse(occurredAt)
  && (!account.endsAt || Date.parse(account.endsAt) >= Date.parse(occurredAt));

const toGrant = (row: ObjectPermissionRow): AuthorizationGrant => ({
  id: row.id,
  subjectAccountId: row.subjectAccountId,
  resourceType: row.resourceType,
  resourceId: row.resourceId,
  actions: row.actions as readonly AuthorizationAction[],
  effect: row.effect,
  purpose: row.purpose,
  ...(row.familyBranchId ? { familyBranchId: row.familyBranchId } : {}),
  ...(row.denialReason ? { denialReason: row.denialReason } : {}),
  startsAt: row.startsAt,
  ...(row.endsAt ? { endsAt: row.endsAt } : {})
});

const authorizationError = (context: HealthApplicationContext): AppError => createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message: 'Sağlık verilerine erişim için etkin üyelik gereklidir.',
  category: 'authorization',
  correlationId: context.correlationId
});

interface AuthorizationSnapshot {
  readonly account: AccountRow;
  readonly grants: readonly AuthorizationGrant[];
}

const loadAuthorization = (
  dependencies: RepositoryBackedHealthApplicationDependencies,
  context: HealthApplicationContext,
  repository: RepositoryExecutionContext
): Result<AuthorizationSnapshot, AppError> => {
  const account = dependencies.accountRepository.findById(repository, context.actor.userId);
  if (!account.ok) return account;
  if (!account.value || !activeAccount(account.value, repository.occurredAt)) {
    return err(authorizationError(context));
  }
  const grants = dependencies.permissionRepository.listActiveForSubject(
    repository,
    context.actor.userId,
    repository.occurredAt
  );
  return grants.ok
    ? { ok: true, value: { account: account.value, grants: grants.value.map(toGrant) } }
    : grants;
};

const authorize = (
  service: CentralAuthorizationService,
  snapshot: AuthorizationSnapshot,
  input: {
    readonly action: AuthorizationAction;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly ownerPersonId: string;
    readonly occurredAt: string;
    readonly privacy: 'private' | 'selected_members' | 'family';
  }
): boolean => service.authorize({
  accountId: snapshot.account.id,
  role: snapshot.account.role as HealthApplicationContext['actor']['role'],
  action: input.action,
  resourceType: input.resourceType,
  resourceId: input.resourceId,
  occurredAt: input.occurredAt,
  ...(snapshot.account.personId ? { actorPersonId: snapshot.account.personId } : {}),
  ownerPersonId: input.ownerPersonId,
  privacy: input.privacy,
  sensitiveDomain: 'health',
  grants: snapshot.grants
}).allowed;

const policyFailure = (
  context: HealthApplicationContext,
  error: unknown
): Result<never, AppError> => {
  const enforcementCode = error instanceof PlatformPolicyEnforcementError
    ? error.code
    : 'ENFORCEMENT_UNAVAILABLE';
  const message = error instanceof Error ? error.message : 'Health policy enforcement is unavailable';
  return err(createAppError({
    code: ERROR_CODES.AUTHORIZATION_DENIED,
    message: `SaÄŸlÄ±k iÅŸlemi merkezÃ® politika tarafÄ±ndan kapalÄ± durdu: ${message}`,
    category: enforcementCode === 'POLICY_DENIED' ? 'authorization' : 'security',
    correlationId: context.correlationId,
    details: { enforcementCode }
  }));
};

const establishGovernedTransaction = (
  enforcementPoint: HealthPolicyEnforcementPoint,
  input: HealthPolicyTransactionRevalidationInput
): Result<void, AppError> => {
  const revalidation = enforcementPoint.revalidateTransaction?.(input);
  if (revalidation && !revalidation.ok) return revalidation;
  const recorded = enforcementPoint.recordAuthorizedTransaction?.(input);
  return recorded && !recorded.ok ? recorded : { ok: true, value: undefined };
};

const executeGoverned = async <T>(
  dependencies: RepositoryBackedHealthApplicationDependencies,
  context: HealthApplicationContext,
  intent: HealthPolicyIntent,
  operation: (
    authorization: PlatformPolicyTransactionContext,
    enforcementPoint: HealthPolicyEnforcementPoint
  ) => Result<T, AppError> | Promise<Result<T, AppError>>
): Promise<Result<T, AppError>> => {
  try {
    const enforcementPoint = await dependencies.policyEnforcementPointResolver.resolve(context, intent);
    if (!enforcementPoint || typeof enforcementPoint.execute !== 'function') {
      throw new PlatformPolicyEnforcementError(
        'ENFORCEMENT_UNAVAILABLE',
        'Health Policy Enforcement Point is missing'
      );
    }
    if (
      enforcementPoint.requiresTransactionRevalidation === true
      && typeof enforcementPoint.revalidateTransaction !== 'function'
    ) {
      throw new PlatformPolicyEnforcementError(
        'ENFORCEMENT_UNAVAILABLE',
        'Health production policy transaction revalidation is missing'
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
        'Health production durable policy receipt boundary is incomplete'
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
          authorization.subject.accountId !== context.actor.userId
          || authorization.resourceFamilyId !== context.familyId
          || (context.actor.personId !== undefined && authorization.subject.personId !== context.actor.personId)
        ) {
          throw new PlatformPolicyEnforcementError(
            'TRANSACTION_CONTEXT_MISMATCH',
            'Trusted policy subject or family does not match the health application context'
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
      if (!projection.ok) {
        const committed = projection.error.details?.businessTransactionCommitted === true;
        const durablePending = projection.error.details?.durableProjectionPending === true;
        if (!committed || !durablePending) return projection;
        // The business transaction and its exact SQLite receipt are already durable.
        // Report the business result once; the next governed operation must recover
        // the pending protected-journal projection before it can authorize anything.
        return result;
      }
    }
    return result;
  } catch (error) {
    return policyFailure(context, error);
  }
};

export class RepositoryBackedHealthQueryPort implements HealthQueryPort {
  readonly #authorization = new CentralAuthorizationService();
  public constructor(private readonly dependencies: RepositoryBackedHealthApplicationDependencies) {}

  public async listHealthRecords(
    context: HealthApplicationContext
  ): ReturnType<HealthQueryPort['listHealthRecords']> {
    const intent: HealthPolicyIntent = {
      action: 'read',
      capability: 'health.read',
      resourceType: 'health_record',
      resourceId: '*',
      purpose: 'health'
    };
    return executeGoverned(this.dependencies, context, intent, (authorization, enforcementPoint) =>
      this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
        const governedInput = { context, intent, authorization, transaction };
        const established = establishGovernedTransaction(enforcementPoint, governedInput);
        if (!established.ok) return established;
        const repository = governedRepositoryContext(context, transaction, authorization, intent);
        const auth = loadAuthorization(this.dependencies, context, repository);
        if (!auth.ok) return auth;
        const records = this.dependencies.healthRepository.listHealthRecords(repository);
        return records.ok
          ? { ok: true, value: records.value.filter((record) => authorize(this.#authorization, auth.value, {
            action: 'read', resourceType: 'health_record', resourceId: record.id,
            ownerPersonId: record.ownerPersonId, occurredAt: repository.occurredAt, privacy: record.privacy
          })) }
          : records;
      })
    );
  }

  public async listMedicationPlans(
    context: HealthApplicationContext
  ): ReturnType<HealthQueryPort['listMedicationPlans']> {
    const intent: HealthPolicyIntent = {
      action: 'read',
      capability: 'health.read',
      resourceType: 'medication_plan',
      resourceId: '*',
      purpose: 'health'
    };
    return executeGoverned(this.dependencies, context, intent, (authorization, enforcementPoint) =>
      this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
        const governedInput = { context, intent, authorization, transaction };
        const established = establishGovernedTransaction(enforcementPoint, governedInput);
        if (!established.ok) return established;
        const repository = governedRepositoryContext(context, transaction, authorization, intent);
        const auth = loadAuthorization(this.dependencies, context, repository);
        if (!auth.ok) return auth;
        const plans = this.dependencies.healthRepository.listMedicationPlans(repository);
        return plans.ok
          ? { ok: true, value: plans.value.filter((plan) => authorize(this.#authorization, auth.value, {
            action: 'read', resourceType: 'medication_plan', resourceId: plan.id,
            ownerPersonId: plan.ownerPersonId, occurredAt: repository.occurredAt, privacy: plan.privacy
          })) }
          : plans;
      })
    );
  }

  public async listFamilyHealthHistory(
    context: HealthApplicationContext
  ): ReturnType<HealthQueryPort['listFamilyHealthHistory']> {
    const intent: HealthPolicyIntent = {
      action: 'read',
      capability: 'health.read',
      resourceType: 'family_health_history',
      resourceId: '*',
      purpose: 'health'
    };
    return executeGoverned(this.dependencies, context, intent, (authorization, enforcementPoint) =>
      this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
        const governedInput = { context, intent, authorization, transaction };
        const established = establishGovernedTransaction(enforcementPoint, governedInput);
        if (!established.ok) return established;
        const repository = governedRepositoryContext(context, transaction, authorization, intent);
        const auth = loadAuthorization(this.dependencies, context, repository);
        if (!auth.ok) return auth;
        const records = this.dependencies.healthRepository.listFamilyHealthHistory(repository);
        return records.ok
          ? { ok: true, value: records.value.filter((record) => authorize(this.#authorization, auth.value, {
            action: 'read', resourceType: 'family_health_history', resourceId: record.id,
            ownerPersonId: record.relatedPersonId, occurredAt: repository.occurredAt, privacy: record.privacy
          })) }
          : records;
      })
    );
  }
}

class RepositoryBackedHealthWriteScope implements HealthWriteScope {
  readonly #authorization = new CentralAuthorizationService();
  readonly #authorizationSnapshot: Result<AuthorizationSnapshot, AppError>;

  public constructor(
    private readonly dependencies: RepositoryBackedHealthApplicationDependencies,
    private readonly applicationContext: HealthApplicationContext,
    private readonly repository: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: HealthWriteScope['occurredAt']
  ) {
    this.#authorizationSnapshot = loadAuthorization(dependencies, applicationContext, repository);
  }

  public findPerson(personId: Parameters<HealthWriteScope['findPerson']>[0]): ReturnType<HealthWriteScope['findPerson']> {
    const result = this.dependencies.personRepository.findById(this.repository, personId);
    return result.ok ? { ok: true, value: result.value ? { id: result.value.id } : null } : result;
  }

  public authorize(input: Parameters<HealthWriteScope['authorize']>[0]): ReturnType<HealthWriteScope['authorize']> {
    if (!this.#authorizationSnapshot.ok) return this.#authorizationSnapshot;
    return { ok: true, value: authorize(this.#authorization, this.#authorizationSnapshot.value, {
      ...input,
      occurredAt: this.repository.occurredAt
    }) };
  }

  public insertHealthRecord(record: Parameters<HealthWriteScope['insertHealthRecord']>[0]): ReturnType<HealthWriteScope['insertHealthRecord']> {
    return this.dependencies.healthRepository.insertHealthRecord(this.repository, record);
  }

  public insertMedicationPlan(plan: Parameters<HealthWriteScope['insertMedicationPlan']>[0]): ReturnType<HealthWriteScope['insertMedicationPlan']> {
    return this.dependencies.healthRepository.insertMedicationPlan(this.repository, plan);
  }

  public insertFamilyHealthHistory(record: Parameters<HealthWriteScope['insertFamilyHealthHistory']>[0]): ReturnType<HealthWriteScope['insertFamilyHealthHistory']> {
    return this.dependencies.healthRepository.insertFamilyHealthHistory(this.repository, record);
  }

  public appendAudit(input: Parameters<HealthWriteScope['appendAudit']>[0]): ReturnType<HealthWriteScope['appendAudit']> {
    return this.dependencies.auditRepository.append(this.repository, input);
  }

  public enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.repository, event);
  }
}

export class RepositoryBackedHealthUnitOfWork implements HealthUnitOfWork {
  public constructor(private readonly dependencies: RepositoryBackedHealthApplicationDependencies) {}

  public execute<T>(
    context: HealthApplicationContext,
    intent: HealthPolicyIntent,
    operation: (scope: HealthWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    return executeGoverned(this.dependencies, context, intent, (authorization, enforcementPoint) =>
      this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
        const governedInput = { context, intent, authorization, transaction };
        const established = establishGovernedTransaction(enforcementPoint, governedInput);
        if (!established.ok) return established;
        const repository = governedRepositoryContext(context, transaction, authorization, intent);
        const result = operation(new RepositoryBackedHealthWriteScope(
          this.dependencies,
          context,
          repository,
          transaction.occurredAt
        ));
        if (!result.ok) return result;
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
        return result;
      })
    );
  }
}
