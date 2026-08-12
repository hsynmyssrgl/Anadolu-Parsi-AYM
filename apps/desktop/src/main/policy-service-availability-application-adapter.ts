import type { PolicyServiceAvailabilityObservationPort } from '@ppt/application';
import type { CoreServiceHealthContract } from '@ppt/core-service-contracts';
import type { PolicyServiceAvailabilityObservation } from '@ppt/platform-policy';
import type { CoreServiceApplicationAdapter } from './core-service-application-adapter.js';

export interface PolicyServiceAvailabilityApplicationAdapterOptions {
  readonly adapter: CoreServiceApplicationAdapter;
  readonly startupHealth: CoreServiceHealthContract;
  readonly clock: () => string;
}

/**
 * Produces a fresh, content-free runtime posture from the authenticated Core
 * Service health API. The startup package is the process-lifetime pin; runtime
 * rotation requires a new trusted startup handshake instead of silent trust.
 */
export class PolicyServiceAvailabilityApplicationAdapter implements PolicyServiceAvailabilityObservationPort {
  readonly #adapter: CoreServiceApplicationAdapter;
  readonly #expectedPolicyVersion: string;
  readonly #expectedPolicyPackageVersion: number;
  readonly #expectedPolicyPackageSha256: string;
  readonly #clock: () => string;

  public constructor(options: PolicyServiceAvailabilityApplicationAdapterOptions) {
    this.#adapter = options.adapter;
    this.#expectedPolicyVersion = options.startupHealth.policyVersion;
    this.#expectedPolicyPackageVersion = options.startupHealth.policyPackage.payload.packageVersion;
    this.#expectedPolicyPackageSha256 = options.startupHealth.policyPackage.payloadSha256;
    this.#clock = options.clock;
  }

  public async observe(): Promise<PolicyServiceAvailabilityObservation | undefined> {
    try {
      const health = await this.#adapter.getHealth();
      return Object.freeze({
        schemaVersion: 1,
        lifecycle: health.lifecycle,
        writable: health.writable,
        safeMode: health.safeMode,
        policyPackageVerified: health.policyPackageVerified,
        policyVersion: health.policyVersion,
        policyPackageVersion: health.policyPackage.payload.packageVersion,
        policyPackageSha256: health.policyPackage.payloadSha256,
        expectedPolicyVersion: this.#expectedPolicyVersion,
        expectedPolicyPackageVersion: this.#expectedPolicyPackageVersion,
        expectedPolicyPackageSha256: this.#expectedPolicyPackageSha256,
        observedAt: health.observedAt,
        checkedAt: this.#clock()
      });
    } catch {
      return undefined;
    }
  }
}
