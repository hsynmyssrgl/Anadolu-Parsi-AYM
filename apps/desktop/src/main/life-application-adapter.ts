import {
  ERROR_CODES,
  asIsoDateTime,
  asPersonId,
  asUserId,
  createAppError,
  err,
  type AppError,
  type IsoDateTime,
  type Result
} from '@ppt/core';
import type {
  LifeApplicationContext,
  LifePolicyIntent,
  LifeQueryPort,
  LifeUnitOfWork,
  LifeWriteScope
} from '@ppt/application';
import { buildManagedLifeWorkspace } from '@ppt/application';
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
  LifeRepositoryPort,
  ObjectPermissionRepositoryPort,
  OutboxRepositoryPort,
  PersonRepositoryPort,
  AccountRow,
  ObjectPermissionRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  FamilyEmergencyCardPortabilityLedgerItemRow
} from '@ppt/repository-contracts';
import {
  CentralAuthorizationService,
  type AuthorizationAction,
  type AuthorizationGrant
} from '@ppt/security';
import { computePlatformPolicyReceiptHash } from '@ppt/repositories';

export interface LifePolicyTransactionRevalidationInput {
  readonly context: LifeApplicationContext;
  readonly intent: LifePolicyIntent;
  readonly authorization: PlatformPolicyTransactionContext;
  readonly transaction: TransactionContext;
}

export interface LifePolicyCommittedTransactionInput {
  readonly context: LifeApplicationContext;
  readonly intent: LifePolicyIntent;
  readonly authorization: PlatformPolicyTransactionContext;
}

export type LifePolicyEnforcementPoint = Pick<PlatformPolicyEnforcementPoint, 'execute'> & {
  readonly requiresTransactionRevalidation?: true;
  readonly revalidateTransaction?: (
    input: LifePolicyTransactionRevalidationInput
  ) => Result<void, AppError>;
  readonly requiresDurableTransactionReceipt?: true;
  readonly recordAuthorizedTransaction?: (
    input: LifePolicyTransactionRevalidationInput
  ) => Result<void, AppError>;
  readonly projectCommittedTransaction?: (
    input: LifePolicyCommittedTransactionInput
  ) => Promise<Result<void, AppError>> | Result<void, AppError>;
};

export interface LifePolicyEnforcementPointResolver {
  resolve(
    context: LifeApplicationContext,
    intent: LifePolicyIntent
  ): LifePolicyEnforcementPoint | Promise<LifePolicyEnforcementPoint>;
}

export interface RepositoryBackedLifeApplicationDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly lifeRepository: LifeRepositoryPort;
  readonly accountRepository: AccountRepositoryPort;
  readonly permissionRepository: ObjectPermissionRepositoryPort;
  readonly personRepository: PersonRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly outboxRepository: OutboxRepositoryPort;
  readonly policyEnforcementPointResolver: LifePolicyEnforcementPointResolver;
  readonly clusterFence: PlatformPolicyClusterFence;
}

export const failClosedLifePolicyEnforcementPointResolver: LifePolicyEnforcementPointResolver = Object.freeze({
  resolve(): never {
    throw new PlatformPolicyEnforcementError(
      'ENFORCEMENT_UNAVAILABLE',
      'Life policy enforcement is not composed for this process'
    );
  }
});

export const nonWritableLifeClusterFence: PlatformPolicyClusterFence = () => Object.freeze({
  writable: false,
  epoch: 0
});

const repositoryContext = (
  context: LifeApplicationContext,
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
  context: LifeApplicationContext,
  transaction: TransactionContext,
  authorization: PlatformPolicyTransactionContext,
  intent: LifePolicyIntent
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
      'Trusted policy subject or family does not match the life application boundary'
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
    occurredAt: asIsoDateTime(authorization.occurredAt),
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
  ...(row.ownershipBasisPoints === undefined ? {} : { ownershipBasisPoints: row.ownershipBasisPoints }),
  ...(row.denialReason ? { denialReason: row.denialReason } : {}),
  startsAt: row.startsAt,
  ...(row.endsAt ? { endsAt: row.endsAt } : {})
});

const authorizationError = (context: LifeApplicationContext): AppError => createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message: 'Yaşam verilerine erişim için etkin üyelik gereklidir.',
  category: 'authorization',
  correlationId: context.correlationId
});

interface AuthorizationSnapshot {
  readonly account: AccountRow;
  readonly grants: readonly AuthorizationGrant[];
}

const loadAuthorization = (
  dependencies: RepositoryBackedLifeApplicationDependencies,
  context: LifeApplicationContext,
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
  role: snapshot.account.role as LifeApplicationContext['actor']['role'],
  action: input.action,
  resourceType: input.resourceType,
  resourceId: input.resourceId,
  occurredAt: input.occurredAt,
  ...(snapshot.account.personId ? { actorPersonId: snapshot.account.personId } : {}),
  ownerPersonId: input.ownerPersonId,
  privacy: input.privacy,
  sensitiveDomain: 'life',
  grants: snapshot.grants
}).allowed;

const policyFailure = (
  context: LifeApplicationContext,
  error: unknown
): Result<never, AppError> => {
  const enforcementCode = error instanceof PlatformPolicyEnforcementError
    ? error.code
    : 'ENFORCEMENT_UNAVAILABLE';
  const message = error instanceof Error ? error.message : 'Life policy enforcement is unavailable';
  return err(createAppError({
    code: ERROR_CODES.AUTHORIZATION_DENIED,
    message: `Yaşam işlemi merkezi politika tarafından güvenli biçimde durduruldu: ${message}`,
    category: enforcementCode === 'POLICY_DENIED' ? 'authorization' : 'security',
    correlationId: context.correlationId,
    details: { enforcementCode }
  }));
};

const establishGovernedTransaction = (
  enforcementPoint: LifePolicyEnforcementPoint,
  input: LifePolicyTransactionRevalidationInput
): Result<void, AppError> => {
  const revalidation = enforcementPoint.revalidateTransaction?.(input);
  if (revalidation && !revalidation.ok) return revalidation;
  const recorded = enforcementPoint.recordAuthorizedTransaction?.(input);
  return recorded && !recorded.ok ? recorded : { ok: true, value: undefined };
};

const executeGoverned = async <T>(
  dependencies: RepositoryBackedLifeApplicationDependencies,
  context: LifeApplicationContext,
  intent: LifePolicyIntent,
  operation: (
    authorization: PlatformPolicyTransactionContext,
    enforcementPoint: LifePolicyEnforcementPoint
  ) => Result<T, AppError> | Promise<Result<T, AppError>>
): Promise<Result<T, AppError>> => {
  try {
    const enforcementPoint = await dependencies.policyEnforcementPointResolver.resolve(context, intent);
    if (!enforcementPoint || typeof enforcementPoint.execute !== 'function') {
      throw new PlatformPolicyEnforcementError(
        'ENFORCEMENT_UNAVAILABLE',
        'Life Policy Enforcement Point is missing'
      );
    }
    if (
      enforcementPoint.requiresTransactionRevalidation === true
      && typeof enforcementPoint.revalidateTransaction !== 'function'
    ) {
      throw new PlatformPolicyEnforcementError(
        'ENFORCEMENT_UNAVAILABLE',
        'Life production policy transaction revalidation is missing'
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
        'Life production durable policy receipt boundary is incomplete'
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
        purpose: intent.purpose,
        ...('requestedFields' in intent && intent.requestedFields
          ? { requestedFields:intent.requestedFields }
          : {})
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
            'Trusted policy subject or family does not match the life application context'
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

export interface GovernedLifePolicyTransactionScope {
  readonly repository: PolicyAuthorizedRepositoryExecutionContext;
  readonly occurredAt: IsoDateTime;
  readonly authorization: PlatformPolicyTransactionContext;
}

/**
 * The one reusable LIFE transaction boundary for primary LIFE, automation and
 * reporting. Policy resolution happens before SQLite work; revalidation and
 * the durable authorization receipt happen inside the same SQLite transaction
 * as the caller's repository writes.
 */
export class RepositoryBackedLifePolicyTransactionRunner {
  public constructor(private readonly dependencies: RepositoryBackedLifeApplicationDependencies) {}

  public execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: GovernedLifePolicyTransactionScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    return executeGoverned(this.dependencies, context, intent, (authorization, enforcementPoint) =>
      this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
        const governedInput = { context, intent, authorization, transaction };
        const established = establishGovernedTransaction(enforcementPoint, governedInput);
        if (!established.ok) return established;
        const repository = governedRepositoryContext(context, transaction, authorization, intent);
        const result = operation({
          repository,
          // Every governed LIFE row, audit entry and outbox event must bind to
          // the exact immutable timestamp in the durable authorization receipt.
          // A fresh transaction clock read can differ by milliseconds and is
          // correctly rejected by the SQLite receipt triggers.
          occurredAt: asIsoDateTime(authorization.occurredAt),
          authorization
        });
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

export class RepositoryBackedLifeQueryPort implements LifeQueryPort {
  readonly #authorization = new CentralAuthorizationService();
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;

  public constructor(
    private readonly dependencies: RepositoryBackedLifeApplicationDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) {
    this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies);
  }

  public async listLifeRecords(
    context: LifeApplicationContext
  ): ReturnType<LifeQueryPort['listLifeRecords']> {
    const intent: LifePolicyIntent = {
      action: 'read',
      capability: 'family.read',
      resourceType: 'life_record',
      resourceId: '*',
      purpose: 'general'
    };
    return this.#runner.execute(context, intent, ({ repository }) => {
      const auth = loadAuthorization(this.dependencies, context, repository);
      if (!auth.ok) return auth;
      const records = this.dependencies.lifeRepository.listLifeRecords(repository);
      return records.ok
        ? { ok: true, value: records.value.filter((record) => authorize(this.#authorization, auth.value, {
          action: 'read', resourceType: 'life_record', resourceId: record.id,
          ownerPersonId: record.ownerPersonId, occurredAt: repository.occurredAt, privacy: record.privacy
        })) }
        : records;
    });
  }

  public async getManagedLifeWorkspace(
    context: LifeApplicationContext
  ): ReturnType<LifeQueryPort['getManagedLifeWorkspace']> {
    const intent: LifePolicyIntent = {
      action: 'read',
      capability: 'family.read',
      resourceType: 'life_record',
      resourceId: '*',
      purpose: 'general'
    };
    return this.#runner.execute(context, intent, ({ repository }) => {
      const auth = loadAuthorization(this.dependencies, context, repository);
      if (!auth.ok) return auth;
      const items = this.dependencies.lifeRepository.listManagedLifeItems(repository);
      if (!items.ok) return items;
      const visible = items.value.filter((item) => authorize(this.#authorization, auth.value, {
        action: 'read',
        resourceType: 'life_record',
        resourceId: item.itemType === 'profile' ? item.id : item.recordId,
        ownerPersonId: item.ownerPersonId,
        occurredAt: repository.occurredAt,
        privacy: item.privacy
      }));
      const homeInventoryItems = this.dependencies.lifeRepository.listManagedHomeInventoryItems(repository);
      if (!homeInventoryItems.ok) return homeInventoryItems;
      const visibleHomeInventoryItems = homeInventoryItems.value.filter((item) => authorize(
        this.#authorization,
        auth.value,
        {
          action: 'read',
          resourceType: 'life_record',
          resourceId: item.recordId,
          ownerPersonId: item.ownerPersonId,
          occurredAt: repository.occurredAt,
          privacy: item.privacy
        }
      ));
      const emergencyItems = this.dependencies.lifeRepository.listFamilyEmergencyItems(repository);
      if (!emergencyItems.ok) return emergencyItems;
      const visibleEmergencyPlans = emergencyItems.value.filter((item) => item.itemType === 'emergency_plan'
        && authorize(this.#authorization, auth.value, {
          action: 'read',
          resourceType: 'life_record',
          resourceId: item.id,
          ownerPersonId: item.ownerPersonId,
          occurredAt: repository.occurredAt,
          privacy: item.privacy
        }));
      const visibleEmergencyPlanIds = new Set(visibleEmergencyPlans.map((item) => item.id));
      const visibleEmergencyItems = emergencyItems.value.filter((item) => item.itemType === 'emergency_plan'
        ? visibleEmergencyPlanIds.has(item.id)
        : visibleEmergencyPlanIds.has(item.planId));
      const preparednessItems = this.dependencies.lifeRepository.listFamilyEmergencyPreparednessItems(repository);
      if (!preparednessItems.ok) return preparednessItems;
      const visiblePreparednessItems = preparednessItems.value.filter((item) =>
        visibleEmergencyPlanIds.has(item.planId));
      const assistanceItems = this.dependencies.lifeRepository.listFamilyEmergencyAssistanceItems(repository);
      if (!assistanceItems.ok) return assistanceItems;
      const visibleAssistanceProfiles = assistanceItems.value.filter((item) =>
        item.itemType === 'emergency_profile'
        && authorize(this.#authorization, auth.value, {
          action: 'read',
          resourceType: 'life_record',
          resourceId: item.id,
          ownerPersonId: item.ownerPersonId,
          occurredAt: repository.occurredAt,
          privacy: item.privacy
        }));
      const visibleAssistanceProfileIds = new Set(visibleAssistanceProfiles.map((item) => item.id));
      const visibleAssistanceItems = assistanceItems.value.filter((item) => item.itemType === 'emergency_profile'
        ? visibleAssistanceProfileIds.has(item.id)
        : visibleAssistanceProfileIds.has(item.profileId));
      const portabilityItems: FamilyEmergencyCardPortabilityLedgerItemRow[] = [];
      for (const profileId of [...visibleAssistanceProfileIds].sort()) {
        const listed = this.dependencies.lifeRepository.listFamilyEmergencyCardPortabilityItems(
          repository,
          profileId
        );
        if (!listed.ok) return listed;
        portabilityItems.push(...listed.value);
      }
      return {
        ok: true,
        value: buildManagedLifeWorkspace({
          items: visible,
          homeInventoryItems: visibleHomeInventoryItems,
          emergencyItems: visibleEmergencyItems,
          preparednessItems: visiblePreparednessItems,
          assistanceItems: visibleAssistanceItems,
          portabilityItems,
          generatedAt: repository.occurredAt
        })
      };
    });
  }
}

class RepositoryBackedLifeWriteScope implements LifeWriteScope {
  readonly #authorization = new CentralAuthorizationService();
  readonly #authorizationSnapshot: Result<AuthorizationSnapshot, AppError>;
  public readonly authorizationReceiptHash:string;

  public constructor(
    private readonly dependencies: RepositoryBackedLifeApplicationDependencies,
    private readonly applicationContext: LifeApplicationContext,
    private readonly repository: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: LifeWriteScope['occurredAt']
  ) {
    this.#authorizationSnapshot = loadAuthorization(dependencies, applicationContext, repository);
    this.authorizationReceiptHash = computePlatformPolicyReceiptHash(
      repository.policyAuthorization.receiptRecord.receipt
    );
  }

  public findPerson(personId: Parameters<LifeWriteScope['findPerson']>[0]): ReturnType<LifeWriteScope['findPerson']> {
    const result = this.dependencies.personRepository.findById(this.repository, personId);
    return result.ok ? {
      ok: true,
      value: result.value ? {
        id: result.value.id,
        familyId: result.value.familyId,
        status: result.value.status
      } : null
    } : result;
  }

  public authorize(input: Parameters<LifeWriteScope['authorize']>[0]): ReturnType<LifeWriteScope['authorize']> {
    if (!this.#authorizationSnapshot.ok) return this.#authorizationSnapshot;
    return { ok: true, value: authorize(this.#authorization, this.#authorizationSnapshot.value, {
      ...input,
      occurredAt: this.repository.occurredAt
    }) };
  }

  public insertLifeRecord(record: Parameters<LifeWriteScope['insertLifeRecord']>[0]): ReturnType<LifeWriteScope['insertLifeRecord']> {
    return this.dependencies.lifeRepository.insertLifeRecord(this.repository, record);
  }

  public findManagedLifeProfile(
    id: Parameters<LifeWriteScope['findManagedLifeProfile']>[0]
  ): ReturnType<LifeWriteScope['findManagedLifeProfile']> {
    return this.dependencies.lifeRepository.findManagedLifeProfile(this.repository, id);
  }

  public insertManagedLifeItem(
    record: Parameters<LifeWriteScope['insertManagedLifeItem']>[0]
  ): ReturnType<LifeWriteScope['insertManagedLifeItem']> {
    return this.dependencies.lifeRepository.insertManagedLifeItem(this.repository, record);
  }

  public findManagedHomeInventoryItem(
    id: Parameters<LifeWriteScope['findManagedHomeInventoryItem']>[0]
  ): ReturnType<LifeWriteScope['findManagedHomeInventoryItem']> {
    return this.dependencies.lifeRepository.findManagedHomeInventoryItem(this.repository, id);
  }

  public findLatestManagedHomeMeterReading(
    recordId: Parameters<LifeWriteScope['findLatestManagedHomeMeterReading']>[0],
    meterId: Parameters<LifeWriteScope['findLatestManagedHomeMeterReading']>[1]
  ): ReturnType<LifeWriteScope['findLatestManagedHomeMeterReading']> {
    return this.dependencies.lifeRepository.findLatestManagedHomeMeterReading(
      this.repository,
      recordId,
      meterId
    );
  }

  public insertManagedHomeInventoryItem(
    record: Parameters<LifeWriteScope['insertManagedHomeInventoryItem']>[0]
  ): ReturnType<LifeWriteScope['insertManagedHomeInventoryItem']> {
    return this.dependencies.lifeRepository.insertManagedHomeInventoryItem(this.repository, record);
  }

  public findFamilyEmergencyPlan(
    id: Parameters<LifeWriteScope['findFamilyEmergencyPlan']>[0]
  ): ReturnType<LifeWriteScope['findFamilyEmergencyPlan']> {
    return this.dependencies.lifeRepository.findFamilyEmergencyPlan(this.repository, id);
  }

  public findFamilyEmergencyItem(
    id: Parameters<LifeWriteScope['findFamilyEmergencyItem']>[0]
  ): ReturnType<LifeWriteScope['findFamilyEmergencyItem']> {
    return this.dependencies.lifeRepository.findFamilyEmergencyItem(this.repository, id);
  }

  public insertFamilyEmergencyItem(
    record: Parameters<LifeWriteScope['insertFamilyEmergencyItem']>[0]
  ): ReturnType<LifeWriteScope['insertFamilyEmergencyItem']> {
    return this.dependencies.lifeRepository.insertFamilyEmergencyItem(this.repository, record);
  }

  public findFamilyEmergencyPreparednessItem(
    id: Parameters<LifeWriteScope['findFamilyEmergencyPreparednessItem']>[0]
  ): ReturnType<LifeWriteScope['findFamilyEmergencyPreparednessItem']> {
    return this.dependencies.lifeRepository.findFamilyEmergencyPreparednessItem(this.repository, id);
  }

  public insertFamilyEmergencyPreparednessItem(
    record: Parameters<LifeWriteScope['insertFamilyEmergencyPreparednessItem']>[0]
  ): ReturnType<LifeWriteScope['insertFamilyEmergencyPreparednessItem']> {
    return this.dependencies.lifeRepository.insertFamilyEmergencyPreparednessItem(this.repository, record);
  }

  public findFamilyEmergencyAssistanceProfile(
    id: Parameters<LifeWriteScope['findFamilyEmergencyAssistanceProfile']>[0]
  ): ReturnType<LifeWriteScope['findFamilyEmergencyAssistanceProfile']> {
    return this.dependencies.lifeRepository.findFamilyEmergencyAssistanceProfile(this.repository, id);
  }

  public findFamilyEmergencyAssistanceItem(
    id: Parameters<LifeWriteScope['findFamilyEmergencyAssistanceItem']>[0]
  ): ReturnType<LifeWriteScope['findFamilyEmergencyAssistanceItem']> {
    return this.dependencies.lifeRepository.findFamilyEmergencyAssistanceItem(this.repository, id);
  }

  public insertFamilyEmergencyAssistanceItem(
    record: Parameters<LifeWriteScope['insertFamilyEmergencyAssistanceItem']>[0]
  ): ReturnType<LifeWriteScope['insertFamilyEmergencyAssistanceItem']> {
    return this.dependencies.lifeRepository.insertFamilyEmergencyAssistanceItem(this.repository, record);
  }

  public findFamilyEmergencyCardConfiguration(
    id: Parameters<LifeWriteScope['findFamilyEmergencyCardConfiguration']>[0]
  ): ReturnType<LifeWriteScope['findFamilyEmergencyCardConfiguration']> {
    return this.dependencies.lifeRepository.findFamilyEmergencyCardConfiguration(this.repository, id);
  }

  public listFamilyEmergencyCardPortabilityItems(profileId: string) {
    return this.dependencies.lifeRepository.listFamilyEmergencyCardPortabilityItems(this.repository, profileId);
  }

  public findFamilyEmergencyCardPortabilityItem(
    id: Parameters<LifeWriteScope['findFamilyEmergencyCardPortabilityItem']>[0]
  ): ReturnType<LifeWriteScope['findFamilyEmergencyCardPortabilityItem']> {
    return this.dependencies.lifeRepository.findFamilyEmergencyCardPortabilityItem(this.repository, id);
  }

  public insertFamilyEmergencyCardPortabilityItem(
    record: Parameters<LifeWriteScope['insertFamilyEmergencyCardPortabilityItem']>[0]
  ): ReturnType<LifeWriteScope['insertFamilyEmergencyCardPortabilityItem']> {
    return this.dependencies.lifeRepository.insertFamilyEmergencyCardPortabilityItem(this.repository, record);
  }

  public appendAudit(input: Parameters<LifeWriteScope['appendAudit']>[0]): ReturnType<LifeWriteScope['appendAudit']> {
    return this.dependencies.auditRepository.append(this.repository, input);
  }

  public enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.repository, event);
  }
}

export class RepositoryBackedLifeUnitOfWork implements LifeUnitOfWork {
  readonly #runner: RepositoryBackedLifePolicyTransactionRunner;

  public constructor(
    private readonly dependencies: RepositoryBackedLifeApplicationDependencies,
    runner?: RepositoryBackedLifePolicyTransactionRunner
  ) {
    this.#runner = runner ?? new RepositoryBackedLifePolicyTransactionRunner(dependencies);
  }

  public execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: LifeWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    return this.#runner.execute(context, intent, ({ repository, occurredAt }) => {
      const result = operation(new RepositoryBackedLifeWriteScope(
        this.dependencies,
        context,
        repository,
        occurredAt
      ));
      return result;
    });
  }
}
