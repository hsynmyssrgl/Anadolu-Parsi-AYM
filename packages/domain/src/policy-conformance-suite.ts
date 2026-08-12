export type PolicyConformancePlatformGroup =
  | 'WINDOWS'
  | 'MACOS'
  | 'IOS'
  | 'IPADOS'
  | 'APPLE_ADJACENT'
  | 'SERVICE'
  | 'PLUGIN';

export interface PolicyConformanceTargetBoundaryView {
  readonly applicationId: string;
  readonly platformGroup: PolicyConformancePlatformGroup;
  readonly deploymentState: 'DEPLOYED' | 'NOT_DEPLOYED';
  readonly nativeRuntimeExecution: 'CURRENT_RUNTIME' | 'PROFILE_ONLY';
}

export interface PolicyConformanceSuiteBoundaryView {
  readonly schemaVersion: 1;
  readonly status: 'build-verified';
  readonly enforcement: 'fail-closed';
  readonly suiteVersion: 'PPK-020-V1';
  readonly targetProfiles: readonly PolicyConformanceTargetBoundaryView[];
  readonly targetCount: 14;
  readonly caseCount: 22;
  readonly totalMatrixAssertions: 308;
  readonly deployedRuntimeTargets: 2;
  readonly profileOnlyTargets: 12;
  readonly identicalCaseSetRequired: true;
  readonly signedPolicyPackageRequired: true;
  readonly strictContextRequired: true;
  readonly deviceCertificateRequired: true;
  readonly referenceHarnessGrantsRuntimeAuthority: false;
  readonly nativeAppleRuntimeExecutionClaimed: false;
  readonly nativeRuntimeValidationRequiredBeforeDeployment: true;
  readonly payloadExposedToClient: false;
  readonly schemaMigrationRequired: false;
  readonly latestDatabaseMigration: 77;
}
