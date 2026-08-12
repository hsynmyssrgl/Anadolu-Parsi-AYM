import type {
  CoreServiceHealthContract,
  PlatformPolicyAuthorizationProvider,
  PlatformPolicyClusterFence,
  PlatformPolicyClusterFenceSnapshot,
  PlatformPolicyPackage,
  PlatformPolicyProviderAuthorizationInput,
  PlatformPolicyProviderAuthorizationResult,
  PlatformPolicyProviderVerificationInput,
  PolicyServiceAvailabilityObservation
} from '@ppt/core-service-contracts';
import type { GeneratedPolicyServiceClient } from './generated-policy-client.js';

export type CoreServicePolicySdkErrorCode =
  | 'POLICY_STATE_UNOBSERVED'
  | 'POLICY_PACKAGE_INVALID'
  | 'POLICY_FENCE_INVALID'
  | 'POLICY_FENCE_REGRESSION'
  | 'POLICY_RESPONSE_INVALID'
  | 'POLICY_AVAILABILITY_OBSERVER_ALREADY_BOUND';

export class CoreServicePolicySdkError extends Error {
  public readonly code: CoreServicePolicySdkErrorCode;

  public constructor(code: CoreServicePolicySdkErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CoreServicePolicySdkError';
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const freezeFence = (value: PlatformPolicyClusterFenceSnapshot): PlatformPolicyClusterFenceSnapshot =>
  Object.freeze({ writable: value.writable, epoch: value.epoch });

export class CoreServicePolicySdk {
  readonly #client: GeneratedPolicyServiceClient;
  #fence: PlatformPolicyClusterFenceSnapshot | undefined;
  #policyPackage: PlatformPolicyPackage | undefined;
  #observePolicyServiceAvailability: (() => Promise<PolicyServiceAvailabilityObservation | undefined>) | undefined;

  public readonly clusterFence: PlatformPolicyClusterFence = () => {
    if (!this.#fence) {
      throw new CoreServicePolicySdkError(
        'POLICY_STATE_UNOBSERVED',
        'Core Service cluster fence has not been verified and observed'
      );
    }
    return this.#fence;
  };

  public readonly policyProvider: PlatformPolicyAuthorizationProvider;

  public constructor(client: GeneratedPolicyServiceClient) {
    if (!client || typeof client.authorize !== 'function' || typeof client.verify !== 'function') {
      throw new TypeError('Generated Core Service policy client is unavailable');
    }
    this.#client = client;
    this.policyProvider = Object.freeze({
      decisionAuthority: 'windows-core-service' as const,
      observePolicyServiceAvailability: () => this.#observePolicyServiceAvailability?.(),
      resolvePolicyPackage: () => {
        if (!this.#policyPackage) {
          throw new CoreServicePolicySdkError(
            'POLICY_STATE_UNOBSERVED',
            'Core Service signed policy package has not been verified and observed'
          );
        }
        return this.#policyPackage;
      },
      authorize: (input: PlatformPolicyProviderAuthorizationInput) => this.#authorize(input),
      verify: (input: PlatformPolicyProviderVerificationInput) => this.#verify(input)
    });
  }

  public observeHealth(health: CoreServiceHealthContract): void {
    if (!isRecord(health) || health.policyPackageVerified !== true) {
      this.#clearObservedState();
      return;
    }
    if (!isRecord(health.policyPackage) || !isRecord(health.policyPackage.payload)) {
      this.#clearObservedState();
      throw new CoreServicePolicySdkError('POLICY_PACKAGE_INVALID', 'Core Service returned an invalid signed policy package');
    }
    try {
      this.#cacheFence({ writable: health.writable, epoch: health.writeFenceEpoch });
    } catch (error) {
      this.#clearObservedState();
      throw error;
    }
    this.#policyPackage = health.policyPackage;
  }

  public bindPolicyServiceAvailabilityObserver(
    observer: () => Promise<PolicyServiceAvailabilityObservation | undefined>
  ): void {
    if (typeof observer !== 'function') throw new TypeError('Core Service policy availability observer is required');
    if (this.#observePolicyServiceAvailability) {
      throw new CoreServicePolicySdkError(
        'POLICY_AVAILABILITY_OBSERVER_ALREADY_BOUND',
        'Core Service policy availability observer is already bound'
      );
    }
    this.#observePolicyServiceAvailability = observer;
  }

  async #authorize(input: PlatformPolicyProviderAuthorizationInput): Promise<PlatformPolicyProviderAuthorizationResult> {
    this.#assertObservedState();
    const result = await this.#client.authorize(Object.freeze({ request: input.request, nonce: input.nonce }));
    if (!isRecord(result) || !isRecord(result.effectiveRequest) || !isRecord(result.authorization)) {
      this.#clearObservedState();
      throw new CoreServicePolicySdkError('POLICY_RESPONSE_INVALID', 'Core Service returned an invalid policy authorization result');
    }
    try {
      this.#cacheFence(result.fence);
    } catch (error) {
      this.#clearObservedState();
      throw error;
    }
    return Object.freeze({
      effectiveRequest: result.effectiveRequest,
      authorization: result.authorization
    });
  }

  async #verify(input: PlatformPolicyProviderVerificationInput): Promise<boolean> {
    this.#assertObservedState();
    const result = await this.#client.verify(Object.freeze({ request: input.request, receipt: input.receipt }));
    if (!isRecord(result) || typeof result.valid !== 'boolean') {
      this.#clearObservedState();
      throw new CoreServicePolicySdkError('POLICY_RESPONSE_INVALID', 'Core Service returned an invalid policy receipt verification result');
    }
    try {
      this.#cacheFence(result.fence);
    } catch (error) {
      this.#clearObservedState();
      throw error;
    }
    return result.valid;
  }

  #assertObservedState(): void {
    if (!this.#fence || !this.#policyPackage) {
      throw new CoreServicePolicySdkError(
        'POLICY_STATE_UNOBSERVED',
        'Verified Core Service policy package and cluster fence must be observed before policy evaluation'
      );
    }
  }

  #cacheFence(value: PlatformPolicyClusterFenceSnapshot): void {
    if (!value || typeof value.writable !== 'boolean' || !Number.isSafeInteger(value.epoch) || value.epoch < 0) {
      throw new CoreServicePolicySdkError('POLICY_FENCE_INVALID', 'Core Service returned an invalid cluster fence');
    }
    const previous = this.#fence;
    if (
      previous
      && (value.epoch < previous.epoch || (value.epoch === previous.epoch && value.writable !== previous.writable))
    ) {
      throw new CoreServicePolicySdkError(
        'POLICY_FENCE_REGRESSION',
        'Core Service cluster fence regressed or changed without a new epoch'
      );
    }
    this.#fence = freezeFence(value);
  }

  #clearObservedState(): void {
    this.#fence = undefined;
    this.#policyPackage = undefined;
  }
}
