import {
  ERROR_CODES,
  asPersonId,
  asUserId,
  createAppError,
  err,
  type AppError,
  type Result
} from '@ppt/core';
import type {
  FinanceApplicationContext,
  FinancePolicyIntent,
  FinanceQueryPort,
  FinanceUnitOfWork,
  FinanceWriteScope
} from '@ppt/application';
import { validateIbanStructure } from '@ppt/application';
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
  AuditRepositoryPort,
  FinanceRepositoryPort,
  ObjectPermissionRepositoryPort,
  ObjectPermissionRow,
  OutboxRepositoryPort,
  PersonRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';
import { CentralAuthorizationService, type AuthorizationAction, type AuthorizationGrant } from '@ppt/security';

export interface FinancePolicyTransactionRevalidationInput {
  readonly context: FinanceApplicationContext;
  readonly intent: FinancePolicyIntent;
  readonly authorization: PlatformPolicyTransactionContext;
  readonly transaction: TransactionContext;
}

export interface FinancePolicyCommittedTransactionInput {
  readonly context: FinanceApplicationContext;
  readonly intent: FinancePolicyIntent;
  readonly authorization: PlatformPolicyTransactionContext;
}

export type FinancePolicyEnforcementPoint = Pick<PlatformPolicyEnforcementPoint, 'execute'> & {
  readonly requiresTransactionRevalidation?: true;
  readonly revalidateTransaction?: (
    input: FinancePolicyTransactionRevalidationInput
  ) => Result<void, AppError>;
  readonly requiresDurableTransactionReceipt?: true;
  readonly recordAuthorizedTransaction?: (
    input: FinancePolicyTransactionRevalidationInput
  ) => Result<void, AppError>;
  readonly projectCommittedTransaction?: (
    input: FinancePolicyCommittedTransactionInput
  ) => Promise<Result<void, AppError>> | Result<void, AppError>;
};

export interface FinancePolicyEnforcementPointResolver {
  resolve(
    context: FinanceApplicationContext,
    intent: FinancePolicyIntent
  ): FinancePolicyEnforcementPoint | Promise<FinancePolicyEnforcementPoint>;
}

export interface RepositoryBackedFinanceApplicationDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly financeRepository: FinanceRepositoryPort;
  readonly accountRepository: AccountRepositoryPort;
  readonly permissionRepository: ObjectPermissionRepositoryPort;
  readonly personRepository: PersonRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly outboxRepository: OutboxRepositoryPort;
  readonly policyEnforcementPointResolver: FinancePolicyEnforcementPointResolver;
  readonly clusterFence: PlatformPolicyClusterFence;
}

export const failClosedFinancePolicyEnforcementPointResolver: FinancePolicyEnforcementPointResolver = Object.freeze({
  resolve(): never {
    throw new PlatformPolicyEnforcementError(
      'ENFORCEMENT_UNAVAILABLE',
      'Finance policy enforcement is not composed for this process'
    );
  }
});

export const nonWritableFinanceClusterFence: PlatformPolicyClusterFence = () => Object.freeze({
  writable: false,
  epoch: 0
});

const repositoryContext = (
  context: FinanceApplicationContext,
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
  context: FinanceApplicationContext,
  transaction: TransactionContext,
  authorization: PlatformPolicyTransactionContext,
  intent: FinancePolicyIntent
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
      'Trusted policy subject or family does not match the finance application boundary'
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

const accountIsActive = (account: AccountRow, occurredAt: string): boolean =>
  account.status === 'active'
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

interface AuthorizationSnapshot {
  readonly account: AccountRow;
  readonly grants: readonly AuthorizationGrant[];
}

const loadAuthorizationSnapshot = (
  dependencies: RepositoryBackedFinanceApplicationDependencies,
  context: FinanceApplicationContext,
  execution: RepositoryExecutionContext
): Result<AuthorizationSnapshot, AppError> => {
  const account = dependencies.accountRepository.findById(execution, context.actor.userId);
  if (!account.ok) return account;
  if (!account.value || !accountIsActive(account.value, execution.occurredAt)) {
    return err(createAppError({
      code: ERROR_CODES.AUTHORIZATION_DENIED,
      message: 'Finans verilerine erişim için etkin üyelik gereklidir.',
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

const legacyAllowed = (
  service: CentralAuthorizationService,
  snapshot: AuthorizationSnapshot,
  input: {
    action: AuthorizationAction;
    resourceType: string;
    resourceId: string;
    ownerPersonId: string;
    occurredAt: string;
    privacy: 'private' | 'selected_members' | 'family';
  }
): boolean => service.authorize({
  accountId: snapshot.account.id,
  role: snapshot.account.role as FinanceApplicationContext['actor']['role'],
  action: input.action,
  resourceType: input.resourceType,
  resourceId: input.resourceId,
  occurredAt: input.occurredAt,
  ...(snapshot.account.personId ? { actorPersonId: snapshot.account.personId } : {}),
  ownerPersonId: input.ownerPersonId,
  privacy: input.privacy,
  sensitiveDomain: 'finance',
  grants: snapshot.grants
}).allowed;

const policyFailure = (
  context: FinanceApplicationContext,
  error: unknown
): Result<never, AppError> => {
  const enforcementCode = error instanceof PlatformPolicyEnforcementError
    ? error.code
    : 'ENFORCEMENT_UNAVAILABLE';
  const message = error instanceof Error ? error.message : 'Finance policy enforcement is unavailable';
  return err(createAppError({
    code: ERROR_CODES.AUTHORIZATION_DENIED,
    message: `Finans işlemi merkezî politika tarafından kapalı durdu: ${message}`,
    category: enforcementCode === 'POLICY_DENIED' ? 'authorization' : 'security',
    correlationId: context.correlationId,
    details: { enforcementCode }
  }));
};

const establishGovernedTransaction = (
  enforcementPoint: FinancePolicyEnforcementPoint,
  input: FinancePolicyTransactionRevalidationInput
): Result<void, AppError> => {
  const revalidation = enforcementPoint.revalidateTransaction?.(input);
  if (revalidation && !revalidation.ok) return revalidation;
  const recorded = enforcementPoint.recordAuthorizedTransaction?.(input);
  return recorded && !recorded.ok ? recorded : { ok: true, value: undefined };
};

const executeGoverned = async <T>(
  dependencies: RepositoryBackedFinanceApplicationDependencies,
  context: FinanceApplicationContext,
  intent: FinancePolicyIntent,
  operation: (
    authorization: PlatformPolicyTransactionContext,
    enforcementPoint: FinancePolicyEnforcementPoint
  ) => Result<T, AppError> | Promise<Result<T, AppError>>
): Promise<Result<T, AppError>> => {
  try {
    const enforcementPoint = await dependencies.policyEnforcementPointResolver.resolve(context, intent);
    if (!enforcementPoint || typeof enforcementPoint.execute !== 'function') {
      throw new PlatformPolicyEnforcementError(
        'ENFORCEMENT_UNAVAILABLE',
        'Finance Policy Enforcement Point is missing'
      );
    }
    if (
      enforcementPoint.requiresTransactionRevalidation === true
      && typeof enforcementPoint.revalidateTransaction !== 'function'
    ) {
      throw new PlatformPolicyEnforcementError(
        'ENFORCEMENT_UNAVAILABLE',
        'Finance production policy transaction revalidation is missing'
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
        'Finance production durable policy receipt boundary is incomplete'
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
            'Trusted policy subject or family does not match the finance application context'
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

export class RepositoryBackedFinanceQueryPort implements FinanceQueryPort {
  readonly #authorization = new CentralAuthorizationService();

  public constructor(private readonly dependencies: RepositoryBackedFinanceApplicationDependencies) {}

  public async listRecords(
    context: FinanceApplicationContext
  ): ReturnType<FinanceQueryPort['listRecords']> {
    const intent: FinancePolicyIntent = {
      action: 'read',
      capability: 'finance.read',
      resourceType: 'finance_record',
      resourceId: '*',
      purpose: 'finance'
    };
    return executeGoverned(this.dependencies, context, intent, (authorization, enforcementPoint) =>
      this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
        const governedInput = { context, intent, authorization, transaction };
        const established = establishGovernedTransaction(enforcementPoint, governedInput);
        if (!established.ok) return established;
        const execution = governedRepositoryContext(context, transaction, authorization, intent);
        const snapshot = loadAuthorizationSnapshot(this.dependencies, context, execution);
        if (!snapshot.ok) return snapshot;
        const rows = this.dependencies.financeRepository.listRecords(execution);
        return rows.ok
          ? {
              ok: true,
              value: rows.value.filter((row) => legacyAllowed(this.#authorization, snapshot.value, {
                action: 'read',
                resourceType: 'finance_record',
                resourceId: row.id,
                ownerPersonId: row.ownerPersonId,
                occurredAt: execution.occurredAt,
                privacy: row.privacy
              }))
            }
          : rows;
      })
    );
  }

  public async listValuations(
    context: FinanceApplicationContext
  ): ReturnType<FinanceQueryPort['listValuations']> {
    const intent: FinancePolicyIntent = {
      action: 'read',
      capability: 'finance.read',
      resourceType: 'finance_record',
      resourceId: '*',
      purpose: 'finance'
    };
    return executeGoverned(this.dependencies, context, intent, (authorization, enforcementPoint) =>
      this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
        const governedInput = { context, intent, authorization, transaction };
        const established = establishGovernedTransaction(enforcementPoint, governedInput);
        if (!established.ok) return established;
        const execution = governedRepositoryContext(context, transaction, authorization, intent);
        const snapshot = loadAuthorizationSnapshot(this.dependencies, context, execution);
        if (!snapshot.ok) return snapshot;
        const valuations = this.dependencies.financeRepository.listValuations(execution);
        if (!valuations.ok) return valuations;
        const records = this.dependencies.financeRepository.listRecords(execution);
        if (!records.ok) return records;
        const byId = new Map(records.value.map((row) => [row.id, row]));
        return {
          ok: true,
          value: valuations.value.filter((valuation) => {
            const record = byId.get(valuation.financeRecordId);
            return !!record && legacyAllowed(this.#authorization, snapshot.value, {
              action: 'read',
              resourceType: 'finance_record',
              resourceId: record.id,
              ownerPersonId: record.ownerPersonId,
              occurredAt: execution.occurredAt,
              privacy: record.privacy
            });
          })
        };
      })
    );
  }

  public async listBankInstitutions(
    context: FinanceApplicationContext
  ): ReturnType<FinanceQueryPort['listBankInstitutions']> {
    const intent: FinancePolicyIntent = {
      action: 'read',
      capability: 'finance.read',
      resourceType: 'finance_record',
      resourceId: '*',
      purpose: 'finance'
    };
    return executeGoverned(this.dependencies, context, intent, (authorization, enforcementPoint) =>
      this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
        const governedInput = { context, intent, authorization, transaction };
        const established = establishGovernedTransaction(enforcementPoint, governedInput);
        if (!established.ok) return established;
        const execution = governedRepositoryContext(context, transaction, authorization, intent);
        const snapshot = loadAuthorizationSnapshot(this.dependencies, context, execution);
        if (!snapshot.ok) return snapshot;
        return this.dependencies.financeRepository.listBankInstitutions(execution);
      })
    );
  }

  public async listBankAccounts(
    context: FinanceApplicationContext
  ): ReturnType<FinanceQueryPort['listBankAccounts']> {
    const intent: FinancePolicyIntent = {
      action: 'read',
      capability: 'finance.read',
      resourceType: 'finance_record',
      resourceId: '*',
      purpose: 'finance'
    };
    return executeGoverned(this.dependencies, context, intent, (authorization, enforcementPoint) =>
      this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
        const governedInput = { context, intent, authorization, transaction };
        const established = establishGovernedTransaction(enforcementPoint, governedInput);
        if (!established.ok) return established;
        const execution = governedRepositoryContext(context, transaction, authorization, intent);
        const snapshot = loadAuthorizationSnapshot(this.dependencies, context, execution);
        if (!snapshot.ok) return snapshot;
        const accounts = this.dependencies.financeRepository.listBankAccounts(execution);
        return accounts.ok
          ? {
              ok: true,
              value: accounts.value.filter((account) => legacyAllowed(this.#authorization, snapshot.value, {
                action: 'read',
                resourceType: 'finance_record',
                resourceId: account.id,
                ownerPersonId: account.ownerPersonId,
                occurredAt: execution.occurredAt,
                privacy: account.privacy
              }))
            }
          : accounts;
      })
    );
  }

  public async validateIban(
    context: FinanceApplicationContext,
    iban: string
  ): ReturnType<FinanceQueryPort['validateIban']> {
    const intent: FinancePolicyIntent = {
      action: 'read',
      capability: 'finance.read',
      resourceType: 'finance_record',
      resourceId: '*',
      purpose: 'finance'
    };
    return executeGoverned(this.dependencies, context, intent, (authorization, enforcementPoint) =>
      this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
        const governedInput = { context, intent, authorization, transaction };
        const established = establishGovernedTransaction(enforcementPoint, governedInput);
        if (!established.ok) return established;
        const execution = governedRepositoryContext(context, transaction, authorization, intent);
        const snapshot = loadAuthorizationSnapshot(this.dependencies, context, execution);
        if (!snapshot.ok) return snapshot;
        const institutions = this.dependencies.financeRepository.listBankInstitutions(execution);
        return institutions.ok ? { ok: true, value: validateIbanStructure(iban, institutions.value) } : institutions;
      })
    );
  }
}

class GovernedFinanceWriteScope implements FinanceWriteScope {
  readonly #authorization = new CentralAuthorizationService();
  readonly #snapshot: Result<AuthorizationSnapshot, AppError>;

  public constructor(
    private readonly dependencies: RepositoryBackedFinanceApplicationDependencies,
    private readonly context: FinanceApplicationContext,
    private readonly execution: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: FinanceWriteScope['occurredAt']
  ) {
    this.#snapshot = loadAuthorizationSnapshot(dependencies, context, execution);
  }

  public findPerson(id: Parameters<FinanceWriteScope['findPerson']>[0]): ReturnType<FinanceWriteScope['findPerson']> {
    const person = this.dependencies.personRepository.findById(this.execution, id);
    return person.ok ? { ok: true, value: person.value ? { id: person.value.id } : null } : person;
  }

  public findRecord(id: string): ReturnType<FinanceWriteScope['findRecord']> {
    return this.dependencies.financeRepository.findRecord(this.execution, id);
  }

  public findBankInstitution(
    institutionCode: string
  ): ReturnType<FinanceWriteScope['findBankInstitution']> {
    return this.dependencies.financeRepository.findBankInstitution(this.execution, institutionCode);
  }

  public authorize(
    input: Parameters<FinanceWriteScope['authorize']>[0]
  ): ReturnType<FinanceWriteScope['authorize']> {
    if (!this.#snapshot.ok) return this.#snapshot;
    return {
      ok: true,
      value: legacyAllowed(this.#authorization, this.#snapshot.value, {
        ...input,
        occurredAt: this.execution.occurredAt
      })
    };
  }

  public insertRecord(input: Parameters<FinanceWriteScope['insertRecord']>[0]) {
    return this.dependencies.financeRepository.insertRecord(this.execution, input);
  }

  public insertValuation(input: Parameters<FinanceWriteScope['insertValuation']>[0]) {
    return this.dependencies.financeRepository.insertValuation(this.execution, input);
  }

  public insertBankAccount(input: Parameters<FinanceWriteScope['insertBankAccount']>[0]) {
    return this.dependencies.financeRepository.insertBankAccount(this.execution, input);
  }

  public appendAudit(input: Parameters<FinanceWriteScope['appendAudit']>[0]) {
    return this.dependencies.auditRepository.append(this.execution, input);
  }

  public enqueueEvent<T>(event: DomainEvent<T>) {
    return this.dependencies.outboxRepository.enqueue(this.execution, event);
  }
}

export class RepositoryBackedFinanceUnitOfWork implements FinanceUnitOfWork {
  public constructor(private readonly dependencies: RepositoryBackedFinanceApplicationDependencies) {}

  public execute<T>(
    context: FinanceApplicationContext,
    intent: FinancePolicyIntent,
    operation: (scope: FinanceWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    return executeGoverned(this.dependencies, context, intent, (authorization, enforcementPoint) =>
      this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
        const governedInput = { context, intent, authorization, transaction };
        const established = establishGovernedTransaction(enforcementPoint, governedInput);
        if (!established.ok) return established;
        const execution = governedRepositoryContext(context, transaction, authorization, intent);
        const result = operation(new GovernedFinanceWriteScope(
          this.dependencies,
          context,
          execution,
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
