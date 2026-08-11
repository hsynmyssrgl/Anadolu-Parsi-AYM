import {
  VersionedCoreServiceApiBoundaryPolicy,
  type VersionedCoreServiceApiAuthoritativeContext,
  type VersionedCoreServiceApiDenialReason
} from '@ppt/platform-policy';

export class VersionedCoreServiceApiDeniedError extends Error {
  public readonly reason: VersionedCoreServiceApiDenialReason;

  public constructor(reason: VersionedCoreServiceApiDenialReason) {
    super(`Versioned Core Service API request denied: ${reason}`);
    this.name = 'VersionedCoreServiceApiDeniedError';
    this.reason = reason;
  }
}

export class EnforceVersionedCoreServiceApiUseCase {
  readonly #policy: VersionedCoreServiceApiBoundaryPolicy;
  readonly #resolveAuthoritativeContext: () => VersionedCoreServiceApiAuthoritativeContext;

  public constructor(
    policy: VersionedCoreServiceApiBoundaryPolicy,
    resolveAuthoritativeContext: () => VersionedCoreServiceApiAuthoritativeContext
  ) {
    this.#policy = policy;
    this.#resolveAuthoritativeContext = resolveAuthoritativeContext;
  }

  public execute<T>(request: unknown, operation: () => T): T {
    const decision = this.#policy.authorize(request, this.#resolveAuthoritativeContext());
    if (!decision.allowed) throw new VersionedCoreServiceApiDeniedError(decision.reason);
    return operation();
  }
}
