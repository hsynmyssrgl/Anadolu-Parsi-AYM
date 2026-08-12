export type ApplicationSecurityStandardId = 'OWASP-ASVS' | 'OWASP-MASVS' | 'NIST-SSDF';

export interface ApplicationSecurityProfileGateBoundaryView {
  readonly schemaVersion: 1;
  readonly status: 'build-mapping-verified';
  readonly gateVersion: 'PPK-023-V1';
  readonly enforcement: 'fail-closed';
  readonly defaultDecision: 'DENY';
  readonly canonicalApplicationCount: 14;
  readonly mappedApplicationCount: 14;
  readonly assuranceProfileCount: 2;
  readonly threatModelCount: 14;
  readonly mobileMasvsApplicationCount: 4;
  readonly asvsVersion: '5.0.0';
  readonly masvsVersion: '2.1.0';
  readonly ssdfVersion: '1.1';
  readonly newApplicationWithoutMappingDenied: true;
  readonly threatModelHashRequired: true;
  readonly workspaceOwnerCoverageRequired: true;
  readonly mappingClaimsCompliance: false;
  readonly nativeRuntimeValidationClaimed: false;
  readonly sourcePathsExposedToClient: false;
  readonly threatModelHashesExposedToClient: false;
  readonly schemaMigrationRequired: false;
  readonly latestDatabaseMigration: 77;
}
