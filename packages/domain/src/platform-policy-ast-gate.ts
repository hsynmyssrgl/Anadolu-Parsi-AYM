export type PlatformPolicyAstGateRuleId =
  | 'DIRECT_SQL_SQLITE_DENIED'
  | 'DIRECT_REPOSITORY_DATABASE_DENIED'
  | 'DIRECT_CRYPTO_DENIED'
  | 'DIRECT_NETWORK_DENIED'
  | 'DIRECT_ROLE_AUTHORIZATION_DENIED'
  | 'UNAPPROVED_USE_CASE_COMPOSITION_DENIED';

export interface PlatformPolicyAstGateBoundaryView {
  readonly schemaVersion: 1;
  readonly status: 'build-verified';
  readonly gateVersion: 'PPK-021-V1';
  readonly parser: '@babel/parser';
  readonly parserVersion: '7.29.8';
  readonly syntaxModel: 'TYPESCRIPT_AST';
  readonly enforcement: 'fail-closed';
  readonly defaultDecision: 'DENY';
  readonly protectedRules: readonly PlatformPolicyAstGateRuleId[];
  readonly protectedRuleCount: 6;
  readonly productionSourceZones: 18;
  readonly exactAllowlistEntries: 679;
  readonly directRoleAuthorizationBypasses: 0;
  readonly wildcardsAllowed: false;
  readonly parseFailureDenied: true;
  readonly staleAllowanceDenied: true;
  readonly newSurfaceDenied: true;
  readonly dynamicImportAndRequireInspected: true;
  readonly aliasesAndComputedPropertiesInspected: true;
  readonly rendererRoleConditionGrantsAuthority: false;
  readonly allowlistMutationGrantsRuntimeAuthority: false;
  readonly buildGateReplacesRuntimePolicy: false;
  readonly sourcePathsExposedToClient: false;
  readonly allowlistHashExposedToClient: false;
  readonly schemaMigrationRequired: false;
  readonly latestDatabaseMigration: 77;
}
