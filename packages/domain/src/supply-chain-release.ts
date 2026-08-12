export interface SupplyChainReleaseBoundaryView {
  readonly schemaVersion: 1;
  readonly status: 'RELEASE_ELIGIBLE' | 'BLOCKED';
  readonly releaseEligible: boolean;
  readonly blockingReasonCount: number;
  readonly enforcement: 'fail-closed';
  readonly requiredLockfileCount: 2;
  readonly requiredVulnerabilityScopeCount: 3;
  readonly requiredRegistrySignatureScopeCount: 2;
  readonly requiredExternalAssetCount: 5;
  readonly installerAndMainExecutableAuthenticodeRequired: true;
  readonly productionCertificateExternal: true;
  readonly detailsExposedToClient: false;
  readonly grantsReleaseAuthority: false;
  readonly schemaMigrationRequired: false;
  readonly latestDatabaseMigration: 77;
}
