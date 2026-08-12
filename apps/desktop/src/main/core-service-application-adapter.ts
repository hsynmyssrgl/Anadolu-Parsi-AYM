import {
  CoreServiceLocalAdminClient,
  CoreServicePolicySdk,
  GeneratedPolicyServiceClient
} from '@ppt/core-service-client';
import type {
  CoreServiceApiBoundaryStatusContract,
  CoreServiceArchitectureContract,
  CoreServiceDeviceSecretProtectionStatusContract,
  CoreServiceFamilyDataCutoverReadinessStatusContract,
  CoreServiceFamilyDataCutoverStatusContract,
  CoreServiceHealthContract,
  CoreServiceFamilyDataStatusContract,
  PlatformPolicyAuthorizationProvider,
  PlatformPolicyClusterFence,
  PolicyJournalCheckpointContractPayload,
  PolicyJournalCheckpointContractResult,
  PolicyServiceAvailabilityObservation
} from '@ppt/core-service-contracts';

export interface CoreServiceConnectionAuthority {
  readonly endpoint: string;
  readonly authenticationToken: string;
}

export class CoreServiceApplicationAdapter {
  readonly #client: CoreServiceLocalAdminClient;
  readonly #policySdk: CoreServicePolicySdk;

  public readonly clusterFence: PlatformPolicyClusterFence;
  public readonly policyProvider: PlatformPolicyAuthorizationProvider;

  public constructor(authority: CoreServiceConnectionAuthority) {
    this.#client = new CoreServiceLocalAdminClient({
      endpoint: authority.endpoint,
      authenticationToken: authority.authenticationToken
    });
    this.#policySdk = new CoreServicePolicySdk(new GeneratedPolicyServiceClient(this.#client));
    this.clusterFence = this.#policySdk.clusterFence;
    this.policyProvider = this.#policySdk.policyProvider;
  }

  public async getHealth(): Promise<CoreServiceHealthContract> {
    const health = await this.#client.health();
    this.#policySdk.observeHealth(health);
    return health;
  }

  public bindPolicyServiceAvailabilityObserver(
    observer: () => Promise<PolicyServiceAvailabilityObservation | undefined>
  ): void {
    this.#policySdk.bindPolicyServiceAvailabilityObserver(observer);
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

  public checkpointPolicyJournal(
    input: PolicyJournalCheckpointContractPayload
  ): Promise<PolicyJournalCheckpointContractResult> {
    return this.#client.checkpointPolicyJournal(input);
  }

}
