import { AsyncLocalStorage, AsyncResource } from 'node:async_hooks';
import type { CorrelationId } from '@ppt/core';
import {
  PlatformPolicyEnforcementError,
  assertActivePlatformPolicyTransactionContext,
  type PlatformPolicyTransactionContext
} from '@ppt/platform-policy';
import {
  assertPolicyAuthorizedRepositoryContext,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext
} from '@ppt/repository-contracts';
import type { RepositoryExecutionPolicyGuard } from '@ppt/repositories';
import { resolveIpcRequestAdmissionPolicy } from './ipc-request-lifecycle.js';

type RepositoryPolicyScope =
  | {
      readonly kind: 'AUTHORIZED';
      readonly correlationId: CorrelationId;
      readonly authorization: PlatformPolicyTransactionContext;
    }
  | {
      readonly kind: 'BOOTSTRAP';
      readonly correlationId: CorrelationId;
      readonly channel: string;
    }
  | {
      readonly kind: 'POLICY_RESOLUTION';
      readonly correlationId: CorrelationId;
      readonly boundary: string;
    };

export interface DesktopRepositoryPolicyBoundaryInput {
  readonly correlationId: CorrelationId;
  readonly boundary: string;
}

interface PendingExclusiveOperation {
  readonly priorityWeight: number;
  readonly sequence: number;
  readonly operation: () => Promise<unknown>;
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason: unknown) => void;
}

const INTERACTIVE_EXCLUSIVE_PRIORITY_WEIGHT =
  resolveIpcRequestAdmissionPolicy('dashboard:getOverview').priorityWeight;

const REPOSITORY_BOOTSTRAP_BOUNDARIES = new Set([
  'app:getInfo',
  'app:getLocalizationBootstrap',
  'app:setLanguagePreference',
  'app:getFirstRunExperience',
  'app:markFirstRunNarrationOffered',
  'app:completeFirstRunIntroduction',
  'auth:getExternalIdentityProviders',
  'auth:getState',
  'auth:getSessionLockState',
  'auth:recordSessionActivity',
  'auth:lockSession',
  'auth:unlockSession',
  'auth:getWindowsHelloState',
  'auth:login',
  'auth:loginWithWindowsHello',
  'auth:setup',
  'auth:beginTwoFactorSetup',
  'auth:enableTwoFactor',
  'auth:trustCurrentDevice',
  'invitations:accept',
  'invitations:inspect'
]);

const AUTHORIZED_INTERNAL_CHILD_CORRELATION_SUFFIXES = new Set([
  'timeline-location-proof',
  'timeline-location-collection',
  'timeline-location-exact',
  'life-report'
]);

const isRegisteredAuthorizedChildCorrelation = (
  scope: RepositoryPolicyScope,
  correlationId: CorrelationId
): boolean => {
  if (scope.kind !== 'AUTHORIZED') return false;
  const prefix = `${scope.correlationId}:`;
  if (!correlationId.startsWith(prefix)) return false;
  return AUTHORIZED_INTERNAL_CHILD_CORRELATION_SUFFIXES.has(
    correlationId.slice(prefix.length)
  );
};

const hasPolicyAuthorization = (
  context: RepositoryExecutionContext
): context is PolicyAuthorizedRepositoryExecutionContext =>
  'policyAuthorization' in context && context.policyAuthorization !== undefined;

/**
 * Process-local fail-closed scope for production SQLite access. The scope is
 * async-safe, so repository work cannot escape the signed PEP callback that
 * authorized it. Bootstrap and authority-resolution exceptions are explicit
 * and correlation-bound.
 */
export class DesktopRepositoryPolicyScope {
  readonly #storage = new AsyncLocalStorage<RepositoryPolicyScope>();
  readonly #exclusiveQueue: PendingExclusiveOperation[] = [];
  #exclusiveActive = false;
  #exclusiveSequence = 0;

  public readonly guard: RepositoryExecutionPolicyGuard = Object.freeze({
    assert: (context: RepositoryExecutionContext): void => this.#assert(context)
  });

  public runAuthorized<T>(
    authorization: PlatformPolicyTransactionContext,
    operation: () => T
  ): T {
    assertActivePlatformPolicyTransactionContext(authorization);
    return this.#storage.run(Object.freeze({
      kind: 'AUTHORIZED' as const,
      correlationId: authorization.correlationId as CorrelationId,
      authorization
    }), operation);
  }

  public runBootstrap<T>(
    input: DesktopRepositoryPolicyBoundaryInput,
    operation: () => T
  ): T {
    if (!REPOSITORY_BOOTSTRAP_BOUNDARIES.has(input.boundary)) {
      throw new PlatformPolicyEnforcementError(
        'INTENT_INVALID',
        'Repository bootstrap scope is not registered for this Desktop boundary'
      );
    }
    return this.#storage.run(Object.freeze({
      kind: 'BOOTSTRAP' as const,
      correlationId: input.correlationId,
      channel: input.boundary
    }), operation);
  }

  public runBootstrapExclusive<T>(
    input: DesktopRepositoryPolicyBoundaryInput,
    operation: () => T | Promise<T>
  ): Promise<T> {
    return this.#runExclusive(
      INTERACTIVE_EXCLUSIVE_PRIORITY_WEIGHT,
      async () => await this.runBootstrap(input, operation)
    );
  }

  public runAdmissionExclusive<T>(
    input: DesktopRepositoryPolicyBoundaryInput,
    operation: () => T | Promise<T>
  ): Promise<T> {
    const priorityWeight = REPOSITORY_BOOTSTRAP_BOUNDARIES.has(input.boundary)
      ? INTERACTIVE_EXCLUSIVE_PRIORITY_WEIGHT
      : resolveIpcRequestAdmissionPolicy(input.boundary).priorityWeight;
    return this.#runExclusive(priorityWeight, async () => await operation());
  }

  public runPolicyResolution<T>(
    input: DesktopRepositoryPolicyBoundaryInput,
    operation: () => T
  ): T {
    if (!input.boundary.includes(':') || REPOSITORY_BOOTSTRAP_BOUNDARIES.has(input.boundary)) {
      throw new PlatformPolicyEnforcementError(
        'INTENT_INVALID',
        'Repository policy-resolution scope requires a protected Desktop boundary'
      );
    }
    return this.#storage.run(Object.freeze({
      kind: 'POLICY_RESOLUTION' as const,
      correlationId: input.correlationId,
      boundary: input.boundary
    }), operation);
  }

  public runPolicyResolutionExclusive<T>(
    input: DesktopRepositoryPolicyBoundaryInput,
    operation: () => T | Promise<T>
  ): Promise<T> {
    return this.#runExclusive(
      resolveIpcRequestAdmissionPolicy(input.boundary).priorityWeight,
      async () => await this.runPolicyResolution(input, operation)
    );
  }

  #runExclusive<T>(priorityWeight: number, operation: () => Promise<T>): Promise<T> {
    const boundOperation = AsyncResource.bind(operation);
    return new Promise<T>((resolve, reject) => {
      const sequence = this.#exclusiveSequence;
      this.#exclusiveSequence += 1;
      this.#exclusiveQueue.push({
        priorityWeight,
        sequence,
        operation: boundOperation,
        resolve: (value) => resolve(value as T),
        reject
      });
      this.#exclusiveQueue.sort((left, right) =>
        right.priorityWeight - left.priorityWeight || left.sequence - right.sequence
      );
      void this.#drainExclusiveQueue();
    });
  }

  async #drainExclusiveQueue(): Promise<void> {
    if (this.#exclusiveActive) return;
    const pending = this.#exclusiveQueue.shift();
    if (!pending) return;
    this.#exclusiveActive = true;
    try {
      pending.resolve(await pending.operation());
    } catch (error) {
      pending.reject(error);
    } finally {
      this.#exclusiveActive = false;
      void this.#drainExclusiveQueue();
    }
  }

  #assert(context: RepositoryExecutionContext): void {
    if (hasPolicyAuthorization(context)) {
      assertPolicyAuthorizedRepositoryContext(context);
      return;
    }

    const scope = this.#storage.getStore();
    if (!scope) {
      throw new PlatformPolicyEnforcementError(
        'TRANSACTION_CONTEXT_INVALID',
        'Repository execution attempted outside an authorized Desktop policy scope'
      );
    }
    if (
      scope.correlationId !== context.correlationId
      && !isRegisteredAuthorizedChildCorrelation(scope, context.correlationId)
    ) {
      throw new PlatformPolicyEnforcementError(
        'TRANSACTION_CONTEXT_MISMATCH',
        'Repository execution correlation does not match the active Desktop policy scope'
      );
    }
    if (scope.kind === 'AUTHORIZED') {
      assertActivePlatformPolicyTransactionContext(scope.authorization);
    }
  }
}
