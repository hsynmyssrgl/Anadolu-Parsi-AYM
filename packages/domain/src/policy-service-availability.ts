export interface PolicyServiceAvailabilityBoundaryView {
  readonly schemaVersion: 1;
  readonly status: 'policy-service-availability-evaluated';
  readonly enforcement: 'fail-closed';
  readonly mode: 'read-write' | 'read-only' | 'deny';
  readonly reason: string;
  readonly sensitiveReadAllowed: boolean;
  readonly sensitiveMutationAllowed: boolean;
  readonly policyPackageVerified: boolean;
  readonly observationFresh: boolean;
  readonly maximumObservationAgeMs: 30_000;
  readonly maximumFutureSkewMs: 5_000;
  readonly mappingGrantsRuntimeAuthority: false;
  readonly historicalReceiptGrantsCurrentAuthority: false;
  readonly sourcePathsExposedToClient: false;
  readonly policyPackageHashesExposedToClient: false;
  readonly schemaMigrationRequired: false;
  readonly latestDatabaseMigration: 77;
}
