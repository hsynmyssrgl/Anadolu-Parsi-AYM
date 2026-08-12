import { CoreServiceLocalAdminClient } from '@ppt/core-service-client';
import type {
  CoreServiceApiBoundaryStatusContract,
  CoreServiceArchitectureContract,
  CoreServiceDeviceSecretProtectionStatusContract,
  CoreServiceFamilyDataCutoverReadinessStatusContract,
  CoreServiceFamilyDataCutoverStatusContract,
  CoreServiceHealthContract,
  CoreServiceFamilyDataStatusContract,
  PolicyAuthorizationContractResult,
  PolicyReceiptVerificationContractResult
  , PolicyJournalCheckpointContractPayload
  , PolicyJournalCheckpointContractResult
} from '@ppt/core-service-contracts';
import type {
  PlatformPolicyAuthorizationProvider,
  PlatformPolicyClusterFence,
  PlatformPolicyClusterFenceSnapshot,
  PlatformPolicyPackage,
  PlatformPolicyProviderAuthorizationInput,
  PlatformPolicyProviderVerificationInput,
  PlatformPolicyRequest,
  PolicyServiceAvailabilityObservation
} from '@ppt/platform-policy';

export interface CoreServiceConnectionAuthority {
  readonly endpoint: string;
  readonly authenticationToken: string;
}

export class CoreServiceApplicationAdapter {
  readonly #client: CoreServiceLocalAdminClient;
  #fence: PlatformPolicyClusterFenceSnapshot | undefined;
  #policyPackage: PlatformPolicyPackage | undefined;
  #observePolicyServiceAvailability: (() => Promise<PolicyServiceAvailabilityObservation | undefined>) | undefined;

  public readonly clusterFence: PlatformPolicyClusterFence = () => {
    if (!this.#fence) throw new Error('Core Service cluster fence has not been observed');
    return this.#fence;
  };

  public readonly policyProvider: PlatformPolicyAuthorizationProvider = Object.freeze({
    decisionAuthority: 'windows-core-service' as const,
    observePolicyServiceAvailability: () => this.#observePolicyServiceAvailability?.(),
    resolvePolicyPackage: () => {
      if (!this.#policyPackage) throw new Error('Core Service signed policy package has not been observed');
      return this.#policyPackage;
    },
    authorize: async (input: PlatformPolicyProviderAuthorizationInput) => {
      const result = await this.authorize(input.request, input.nonce);
      return Object.freeze({
        effectiveRequest: result.effectiveRequest,
        authorization: result.authorization
      });
    },
    verify: async (input: PlatformPolicyProviderVerificationInput) => {
      const result = await this.verify(input.request, input.receipt);
      return result.valid;
    }
  });

  public constructor(authority: CoreServiceConnectionAuthority) {
    this.#client = new CoreServiceLocalAdminClient({
      endpoint: authority.endpoint,
      authenticationToken: authority.authenticationToken
    });
  }

  public async getHealth(): Promise<CoreServiceHealthContract> {
    const health = await this.#client.health();
    if (health.policyPackageVerified === true) {
      this.#cacheFence({ writable: health.writable, epoch: health.writeFenceEpoch });
      this.#policyPackage = health.policyPackage;
    } else {
      this.#policyPackage = undefined;
    }
    return health;
  }

  public bindPolicyServiceAvailabilityObserver(
    observer: () => Promise<PolicyServiceAvailabilityObservation | undefined>
  ): void {
    if (this.#observePolicyServiceAvailability) {
      throw new Error('Core Service policy availability observer is already bound');
    }
    this.#observePolicyServiceAvailability = observer;
  }

  public getApiBoundaryStatus(): Promise<CoreServiceApiBoundaryStatusContract> {
    return this.#client.apiBoundaryStatus();
  }

  public getArchitecture(): Promise<CoreServiceArchitectureContract> {
    return this.#client.architecture();
  }

  public getFamilyDataStatus(): Promise<CoreServiceFamilyDataStatusContract> {
    return this.#client.familyDataStatus();
  }

  public getDeviceSecretProtectionStatus(): Promise<CoreServiceDeviceSecretProtectionStatusContract> {
    return this.#client.deviceSecretProtectionStatus();
  }

  public getFamilyDataCutoverStatus(): Promise<CoreServiceFamilyDataCutoverStatusContract> {
    return this.#client.familyDataCutoverStatus();
  }

  public getFamilyDataCutoverReadinessStatus(): Promise<CoreServiceFamilyDataCutoverReadinessStatusContract> {
    return this.#client.familyDataCutoverReadinessStatus();
  }

  public async authorize(request: PlatformPolicyRequest, nonce: string): Promise<PolicyAuthorizationContractResult> {
    const result = await this.#client.authorize({ request, nonce });
    this.#cacheFence(result.fence);
    return result;
  }

  public async verify(
    request: PlatformPolicyRequest,
    receipt: PlatformPolicyProviderVerificationInput['receipt']
  ): Promise<PolicyReceiptVerificationContractResult> {
    const result = await this.#client.verify({ request, receipt });
    this.#cacheFence(result.fence);
    return result;
  }

  public checkpointPolicyJournal(
    input: PolicyJournalCheckpointContractPayload
  ): Promise<PolicyJournalCheckpointContractResult> {
    return this.#client.checkpointPolicyJournal(input);
  }

  #cacheFence(value: PlatformPolicyClusterFenceSnapshot): void {
    if (!value || typeof value.writable !== 'boolean' || !Number.isSafeInteger(value.epoch) || value.epoch < 0) {
      throw new Error('Core Service returned an invalid cluster fence');
    }
    const previous = this.#fence;
    if (
      previous &&
      (value.epoch < previous.epoch || (value.epoch === previous.epoch && value.writable !== previous.writable))
    ) {
      throw new Error('Core Service cluster fence regressed or changed without a new epoch');
    }
    this.#fence = Object.freeze({ writable: value.writable, epoch: value.epoch });
  }
}
