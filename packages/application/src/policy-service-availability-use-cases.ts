import type { PolicyServiceAvailabilityBoundaryView } from '@ppt/domain';
import {
  PolicyServiceAvailabilityPolicy,
  type PolicyServiceAvailabilityDecision,
  type PolicyServiceAvailabilityObservation,
  type PolicyServiceSensitiveOperation
} from '@ppt/platform-policy';

export interface PolicyServiceAvailabilityObservationPort {
  observe(): Promise<PolicyServiceAvailabilityObservation | undefined> | PolicyServiceAvailabilityObservation | undefined;
}

export class EvaluatePolicyServiceAvailabilityUseCase {
  public constructor(
    private readonly policy: PolicyServiceAvailabilityPolicy,
    private readonly observation: PolicyServiceAvailabilityObservationPort
  ) {}

  public async execute(): Promise<PolicyServiceAvailabilityDecision> {
    try {
      return this.policy.evaluate(await this.observation.observe());
    } catch {
      return this.policy.evaluate(undefined);
    }
  }
}

export class EnforcePolicyServiceAvailabilityUseCase {
  readonly #evaluate: EvaluatePolicyServiceAvailabilityUseCase;

  public constructor(
    private readonly policy: PolicyServiceAvailabilityPolicy,
    observation: PolicyServiceAvailabilityObservationPort
  ) {
    this.#evaluate = new EvaluatePolicyServiceAvailabilityUseCase(policy, observation);
  }

  public async execute<T>(input: {
    readonly operation: PolicyServiceSensitiveOperation;
    readonly callback: (decision: PolicyServiceAvailabilityDecision) => Promise<T> | T;
  }): Promise<T> {
    const availability = await this.#evaluate.execute();
    this.policy.assertOperationAllowed(input.operation, availability);
    return input.callback(availability);
  }
}

export class GetPolicyServiceAvailabilityBoundaryUseCase {
  readonly #evaluate: EvaluatePolicyServiceAvailabilityUseCase;

  public constructor(
    private readonly policy: PolicyServiceAvailabilityPolicy,
    observation: PolicyServiceAvailabilityObservationPort
  ) {
    this.#evaluate = new EvaluatePolicyServiceAvailabilityUseCase(policy, observation);
  }

  public async execute(): Promise<PolicyServiceAvailabilityBoundaryView> {
    const snapshot = this.policy.snapshot(await this.#evaluate.execute());
    if (!this.policy.verifySnapshot(snapshot)) throw new Error('POLICY_SERVICE_AVAILABILITY_SNAPSHOT_INVALID');
    return Object.freeze({
      schemaVersion: snapshot.schemaVersion,
      status: snapshot.status,
      enforcement: snapshot.enforcement,
      mode: snapshot.mode,
      reason: snapshot.reason,
      sensitiveReadAllowed: snapshot.sensitiveReadAllowed,
      sensitiveMutationAllowed: snapshot.sensitiveMutationAllowed,
      policyPackageVerified: snapshot.policyPackageVerified,
      observationFresh: snapshot.observationFresh,
      maximumObservationAgeMs: snapshot.maximumObservationAgeMs,
      maximumFutureSkewMs: snapshot.maximumFutureSkewMs,
      mappingGrantsRuntimeAuthority: snapshot.mappingGrantsRuntimeAuthority,
      historicalReceiptGrantsCurrentAuthority: snapshot.historicalReceiptGrantsCurrentAuthority,
      sourcePathsExposedToClient: snapshot.sourcePathsExposedToClient,
      policyPackageHashesExposedToClient: snapshot.policyPackageHashesExposedToClient,
      schemaMigrationRequired: snapshot.schemaMigrationRequired,
      latestDatabaseMigration: snapshot.latestDatabaseMigration
    });
  }
}
