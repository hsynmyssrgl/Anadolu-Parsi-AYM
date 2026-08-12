export const POLICY_SERVICE_OBSERVATION_MAX_AGE_MS = 30_000 as const;
export const POLICY_SERVICE_OBSERVATION_MAX_FUTURE_SKEW_MS = 5_000 as const;

export type PolicyServiceLifecycle =
  | 'starting'
  | 'ready'
  | 'degraded'
  | 'stopping'
  | 'stopped';

export type PolicyServiceAvailabilityMode = 'read-write' | 'read-only' | 'deny';
export type PolicyServiceSensitiveOperation = 'read' | 'mutation';
export type PolicyServiceAvailabilityReason =
  | 'FRESH_VERIFIED_READ_WRITE'
  | 'FRESH_VERIFIED_READ_ONLY'
  | 'SERVICE_UNAVAILABLE'
  | 'OBSERVATION_MALFORMED'
  | 'POLICY_PACKAGE_SIGNATURE_INVALID'
  | 'POLICY_VERSION_MISMATCH'
  | 'POLICY_PACKAGE_VERSION_MISMATCH'
  | 'POLICY_PACKAGE_HASH_MISMATCH'
  | 'OBSERVATION_STALE'
  | 'OBSERVATION_FROM_FUTURE'
  | 'SERVICE_NOT_READY'
  | 'UNSAFE_SERVICE_STATE'
  | 'READ_ONLY_MUTATION_DENIED';

export interface PolicyServiceAvailabilityObservation {
  readonly schemaVersion: 1;
  readonly lifecycle: PolicyServiceLifecycle;
  readonly writable: boolean;
  readonly safeMode: boolean;
  readonly policyPackageVerified: boolean;
  readonly policyVersion: string;
  readonly policyPackageVersion: number;
  readonly policyPackageSha256: string;
  readonly expectedPolicyVersion: string;
  readonly expectedPolicyPackageVersion: number;
  readonly expectedPolicyPackageSha256: string;
  readonly observedAt: string;
  readonly checkedAt: string;
}

export interface PolicyServiceAvailabilityDecision {
  readonly schemaVersion: 1;
  readonly mode: PolicyServiceAvailabilityMode;
  readonly reason: PolicyServiceAvailabilityReason;
  readonly sensitiveReadAllowed: boolean;
  readonly sensitiveMutationAllowed: boolean;
  readonly policyPackageVerified: boolean;
  readonly observationFresh: boolean;
  readonly observationAgeMs: number | null;
  readonly maximumObservationAgeMs: typeof POLICY_SERVICE_OBSERVATION_MAX_AGE_MS;
  readonly maximumFutureSkewMs: typeof POLICY_SERVICE_OBSERVATION_MAX_FUTURE_SKEW_MS;
  readonly mappingGrantsRuntimeAuthority: false;
  readonly historicalReceiptGrantsCurrentAuthority: false;
}

export interface PolicyServiceAvailabilityBoundarySnapshot extends PolicyServiceAvailabilityDecision {
  readonly enforcement: 'fail-closed';
  readonly status: 'policy-service-availability-evaluated';
  readonly sourcePathsExposedToClient: false;
  readonly policyPackageHashesExposedToClient: false;
  readonly schemaMigrationRequired: false;
  readonly latestDatabaseMigration: 77;
}

export class PolicyServiceAvailabilityError extends Error {
  public readonly code = 'POLICY_SERVICE_AVAILABILITY_DENIED' as const;
  public readonly reason: PolicyServiceAvailabilityReason;
  public readonly mode: PolicyServiceAvailabilityMode;

  public constructor(decision: PolicyServiceAvailabilityDecision, reason = decision.reason) {
    super(`Sensitive operation denied by policy-service availability gate: ${reason}`);
    this.name = 'PolicyServiceAvailabilityError';
    this.reason = reason as PolicyServiceAvailabilityReason;
    this.mode = decision.mode;
  }
}

const SHA256 = /^[a-f0-9]{64}$/u;
const plainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length && actual.every((key, index) => key === canonical[index]);
};
const strictTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
};
const nonEmpty = (value: unknown, maximum = 256): value is string =>
  typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= maximum;

const decision = (
  mode: PolicyServiceAvailabilityMode,
  reason: PolicyServiceAvailabilityReason,
  options: { readonly verified?: boolean; readonly fresh?: boolean; readonly ageMs?: number | null } = {}
): PolicyServiceAvailabilityDecision => Object.freeze({
  schemaVersion: 1,
  mode,
  reason,
  sensitiveReadAllowed: mode !== 'deny',
  sensitiveMutationAllowed: mode === 'read-write',
  policyPackageVerified: options.verified === true,
  observationFresh: options.fresh === true,
  observationAgeMs: options.ageMs ?? null,
  maximumObservationAgeMs: POLICY_SERVICE_OBSERVATION_MAX_AGE_MS,
  maximumFutureSkewMs: POLICY_SERVICE_OBSERVATION_MAX_FUTURE_SKEW_MS,
  mappingGrantsRuntimeAuthority: false,
  historicalReceiptGrantsCurrentAuthority: false
});

export class PolicyServiceAvailabilityPolicy {
  public evaluate(value: unknown): PolicyServiceAvailabilityDecision {
    if (value === undefined || value === null) return decision('deny', 'SERVICE_UNAVAILABLE');
    if (!plainRecord(value) || !exactKeys(value, [
      'schemaVersion', 'lifecycle', 'writable', 'safeMode', 'policyPackageVerified',
      'policyVersion', 'policyPackageVersion', 'policyPackageSha256', 'expectedPolicyVersion',
      'expectedPolicyPackageVersion', 'expectedPolicyPackageSha256', 'observedAt', 'checkedAt'
    ])) return decision('deny', 'OBSERVATION_MALFORMED');
    const observation = value as unknown as PolicyServiceAvailabilityObservation;
    if (
      observation.schemaVersion !== 1
      || !['starting', 'ready', 'degraded', 'stopping', 'stopped'].includes(observation.lifecycle)
      || typeof observation.writable !== 'boolean'
      || typeof observation.safeMode !== 'boolean'
      || typeof observation.policyPackageVerified !== 'boolean'
      || !nonEmpty(observation.policyVersion, 128)
      || !Number.isSafeInteger(observation.policyPackageVersion)
      || observation.policyPackageVersion < 1
      || !SHA256.test(observation.policyPackageSha256)
      || !nonEmpty(observation.expectedPolicyVersion, 128)
      || !Number.isSafeInteger(observation.expectedPolicyPackageVersion)
      || observation.expectedPolicyPackageVersion < 1
      || !SHA256.test(observation.expectedPolicyPackageSha256)
      || !strictTimestamp(observation.observedAt)
      || !strictTimestamp(observation.checkedAt)
    ) return decision('deny', 'OBSERVATION_MALFORMED');

    if (!observation.policyPackageVerified) return decision('deny', 'POLICY_PACKAGE_SIGNATURE_INVALID');
    if (observation.policyVersion !== observation.expectedPolicyVersion) {
      return decision('deny', 'POLICY_VERSION_MISMATCH', { verified: true });
    }
    if (observation.policyPackageVersion !== observation.expectedPolicyPackageVersion) {
      return decision('deny', 'POLICY_PACKAGE_VERSION_MISMATCH', { verified: true });
    }
    if (observation.policyPackageSha256 !== observation.expectedPolicyPackageSha256) {
      return decision('deny', 'POLICY_PACKAGE_HASH_MISMATCH', { verified: true });
    }

    const ageMs = Date.parse(observation.checkedAt) - Date.parse(observation.observedAt);
    if (ageMs < -POLICY_SERVICE_OBSERVATION_MAX_FUTURE_SKEW_MS) {
      return decision('deny', 'OBSERVATION_FROM_FUTURE', { verified: true, ageMs });
    }
    if (ageMs > POLICY_SERVICE_OBSERVATION_MAX_AGE_MS) {
      return decision('deny', 'OBSERVATION_STALE', { verified: true, ageMs });
    }
    if (observation.lifecycle !== 'ready' && observation.lifecycle !== 'degraded') {
      return decision('deny', 'SERVICE_NOT_READY', { verified: true, fresh: true, ageMs });
    }
    if (
      (observation.writable && observation.safeMode)
      || (observation.lifecycle === 'degraded' && (observation.writable || !observation.safeMode))
      || (observation.lifecycle === 'ready' && observation.safeMode)
    ) return decision('deny', 'UNSAFE_SERVICE_STATE', { verified: true, fresh: true, ageMs });
    if (!observation.writable) {
      return decision('read-only', 'FRESH_VERIFIED_READ_ONLY', { verified: true, fresh: true, ageMs });
    }
    return decision('read-write', 'FRESH_VERIFIED_READ_WRITE', { verified: true, fresh: true, ageMs });
  }

  public assertOperationAllowed(
    operation: PolicyServiceSensitiveOperation,
    availability: PolicyServiceAvailabilityDecision
  ): void {
    if (operation !== 'read' && operation !== 'mutation') {
      throw new PolicyServiceAvailabilityError(decision('deny', 'OBSERVATION_MALFORMED'));
    }
    if (availability.mode === 'deny') throw new PolicyServiceAvailabilityError(availability);
    if (operation === 'mutation' && !availability.sensitiveMutationAllowed) {
      throw new PolicyServiceAvailabilityError(availability, 'READ_ONLY_MUTATION_DENIED');
    }
    if (operation === 'read' && !availability.sensitiveReadAllowed) {
      throw new PolicyServiceAvailabilityError(availability);
    }
  }

  public snapshot(availability: PolicyServiceAvailabilityDecision): PolicyServiceAvailabilityBoundarySnapshot {
    return Object.freeze({
      ...availability,
      enforcement: 'fail-closed',
      status: 'policy-service-availability-evaluated',
      sourcePathsExposedToClient: false,
      policyPackageHashesExposedToClient: false,
      schemaMigrationRequired: false,
      latestDatabaseMigration: 77
    });
  }

  public verifySnapshot(value: unknown): value is PolicyServiceAvailabilityBoundarySnapshot {
    if (!plainRecord(value) || !exactKeys(value, [
      'schemaVersion', 'mode', 'reason', 'sensitiveReadAllowed', 'sensitiveMutationAllowed',
      'policyPackageVerified', 'observationFresh', 'observationAgeMs', 'maximumObservationAgeMs',
      'maximumFutureSkewMs', 'mappingGrantsRuntimeAuthority', 'historicalReceiptGrantsCurrentAuthority',
      'enforcement', 'status', 'sourcePathsExposedToClient', 'policyPackageHashesExposedToClient',
      'schemaMigrationRequired', 'latestDatabaseMigration'
    ])) return false;
    const snapshot = value as unknown as PolicyServiceAvailabilityBoundarySnapshot;
    return snapshot.schemaVersion === 1
      && ['read-write', 'read-only', 'deny'].includes(snapshot.mode)
      && typeof snapshot.reason === 'string'
      && snapshot.sensitiveReadAllowed === (snapshot.mode !== 'deny')
      && snapshot.sensitiveMutationAllowed === (snapshot.mode === 'read-write')
      && typeof snapshot.policyPackageVerified === 'boolean'
      && typeof snapshot.observationFresh === 'boolean'
      && (snapshot.observationAgeMs === null || Number.isFinite(snapshot.observationAgeMs))
      && snapshot.maximumObservationAgeMs === POLICY_SERVICE_OBSERVATION_MAX_AGE_MS
      && snapshot.maximumFutureSkewMs === POLICY_SERVICE_OBSERVATION_MAX_FUTURE_SKEW_MS
      && snapshot.mappingGrantsRuntimeAuthority === false
      && snapshot.historicalReceiptGrantsCurrentAuthority === false
      && snapshot.enforcement === 'fail-closed'
      && snapshot.status === 'policy-service-availability-evaluated'
      && snapshot.sourcePathsExposedToClient === false
      && snapshot.policyPackageHashesExposedToClient === false
      && snapshot.schemaMigrationRequired === false
      && snapshot.latestDatabaseMigration === 77;
  }
}
