import type {
  AppError,
  CorrelationId,
  IsoDateTime,
  PersonId,
  Result,
  UserId
} from '@ppt/core';
import type { RepositoryTransaction } from '@ppt/contracts';
import {
  PlatformPolicyEnforcementError,
  assertActivePlatformPolicyTransactionContext,
  type PlatformPolicyTransactionContext,
  type PlatformPolicyTransactionExpectation
} from '@ppt/platform-policy';

export interface ActorContext {
  readonly userId: UserId;
  readonly roles: readonly string[];
  readonly personId?: PersonId;
}

export interface RepositoryContext<TTransaction = unknown> {
  readonly transaction: TTransaction;
  readonly actor: ActorContext;
  readonly correlationId: CorrelationId;
  readonly occurredAt: IsoDateTime;
}

export type RepositoryExecutionContext = RepositoryContext<RepositoryTransaction>;

export interface PolicyAuthorizedRepositoryExecutionContext extends RepositoryExecutionContext {
  readonly policyAuthorization: PlatformPolicyTransactionContext;
}

export interface RepositoryPolicyAuthorizationExpectation extends PlatformPolicyTransactionExpectation {
  readonly correlationId?: CorrelationId;
}

export function assertPolicyAuthorizedRepositoryContext(
  context: RepositoryExecutionContext,
  expectation?: RepositoryPolicyAuthorizationExpectation
): asserts context is PolicyAuthorizedRepositoryExecutionContext {
  const policyAuthorization = (context as Partial<PolicyAuthorizedRepositoryExecutionContext>).policyAuthorization;
  const policyExpectation = expectation ? {
    resourceType: expectation.resourceType,
    resourceId: expectation.resourceId,
    action: expectation.action,
    capability: expectation.capability,
    ...(expectation.resourceFamilyId === undefined ? {} : { resourceFamilyId: expectation.resourceFamilyId }),
    ...(expectation.resourceHouseholdId === undefined ? {} : { resourceHouseholdId: expectation.resourceHouseholdId }),
    ...(expectation.resourceFamilyBranchId === undefined ? {} : { resourceFamilyBranchId: expectation.resourceFamilyBranchId }),
    ...(expectation.resourceOwnerPersonId === undefined ? {} : { resourceOwnerPersonId: expectation.resourceOwnerPersonId }),
    ...(expectation.purpose === undefined ? {} : { purpose: expectation.purpose }),
    ...(expectation.occurredAt === undefined ? {} : { occurredAt: expectation.occurredAt }),
    ...(expectation.contextHash === undefined ? {} : { contextHash: expectation.contextHash }),
    ...(expectation.fenceEpoch === undefined ? {} : { fenceEpoch: expectation.fenceEpoch }),
    ...(expectation.fenceWritable === undefined ? {} : { fenceWritable: expectation.fenceWritable })
  } : undefined;

  assertActivePlatformPolicyTransactionContext(policyAuthorization, policyExpectation);

  const expectedCorrelationId = expectation?.correlationId ?? context.correlationId;
  if (
    policyAuthorization.correlationId !== context.correlationId ||
    policyAuthorization.correlationId !== expectedCorrelationId
  ) {
    throw new PlatformPolicyEnforcementError(
      'TRANSACTION_CONTEXT_MISMATCH',
      'Policy-authorized transaction context does not match the repository correlation boundary'
    );
  }
}

export type RepositoryResult<TValue> = Result<TValue, AppError>;

export interface RepositoryHealth {
  readonly name: string;
  readonly available: boolean;
  readonly checkedAt: IsoDateTime;
  readonly error?: AppError;
}
