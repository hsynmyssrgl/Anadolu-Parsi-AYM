export const PLATFORM_POLICY_AST_GATE_VERSION = 'PPK-021-V1' as const;

export const PLATFORM_POLICY_AST_GATE_RULE_IDS = Object.freeze([
  'DIRECT_SQL_SQLITE_DENIED',
  'DIRECT_REPOSITORY_DATABASE_DENIED',
  'DIRECT_CRYPTO_DENIED',
  'DIRECT_NETWORK_DENIED',
  'DIRECT_ROLE_AUTHORIZATION_DENIED',
  'UNAPPROVED_USE_CASE_COMPOSITION_DENIED'
] as const);

export type PlatformPolicyAstGateRuleId = (typeof PLATFORM_POLICY_AST_GATE_RULE_IDS)[number];

export interface PlatformPolicyAstGateSnapshot {
  readonly schemaVersion: 1;
  readonly gateVersion: typeof PLATFORM_POLICY_AST_GATE_VERSION;
  readonly parser: '@babel/parser';
  readonly parserVersion: '7.29.8';
  readonly syntaxModel: 'TYPESCRIPT_AST';
  readonly enforcement: 'fail-closed';
  readonly defaultDecision: 'DENY';
  readonly protectedRules: readonly PlatformPolicyAstGateRuleId[];
  readonly protectedRuleCount: 6;
  readonly productionSourceZones: 18;
  readonly exactAllowlistEntries: 657;
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

const exactSnapshot = (): PlatformPolicyAstGateSnapshot => Object.freeze({
  schemaVersion: 1,
  gateVersion: PLATFORM_POLICY_AST_GATE_VERSION,
  parser: '@babel/parser',
  parserVersion: '7.29.8',
  syntaxModel: 'TYPESCRIPT_AST',
  enforcement: 'fail-closed',
  defaultDecision: 'DENY',
  protectedRules: PLATFORM_POLICY_AST_GATE_RULE_IDS,
  protectedRuleCount: 6,
  productionSourceZones: 18,
  exactAllowlistEntries: 657,
  directRoleAuthorizationBypasses: 0,
  wildcardsAllowed: false,
  parseFailureDenied: true,
  staleAllowanceDenied: true,
  newSurfaceDenied: true,
  dynamicImportAndRequireInspected: true,
  aliasesAndComputedPropertiesInspected: true,
  rendererRoleConditionGrantsAuthority: false,
  allowlistMutationGrantsRuntimeAuthority: false,
  buildGateReplacesRuntimePolicy: false,
  sourcePathsExposedToClient: false,
  allowlistHashExposedToClient: false,
  schemaMigrationRequired: false,
  latestDatabaseMigration: 77
});

export class PlatformPolicyAstGatePolicy {
  public snapshot(): PlatformPolicyAstGateSnapshot {
    return exactSnapshot();
  }

  public verify(snapshot: PlatformPolicyAstGateSnapshot): boolean {
    const expected = exactSnapshot();
    return snapshot.schemaVersion === expected.schemaVersion
      && snapshot.gateVersion === expected.gateVersion
      && snapshot.parser === expected.parser
      && snapshot.parserVersion === expected.parserVersion
      && snapshot.syntaxModel === expected.syntaxModel
      && snapshot.enforcement === expected.enforcement
      && snapshot.defaultDecision === expected.defaultDecision
      && snapshot.protectedRuleCount === expected.protectedRuleCount
      && snapshot.protectedRules.length === expected.protectedRules.length
      && snapshot.protectedRules.every((rule, index) => rule === expected.protectedRules[index])
      && snapshot.productionSourceZones === expected.productionSourceZones
      && snapshot.exactAllowlistEntries === expected.exactAllowlistEntries
      && snapshot.directRoleAuthorizationBypasses === 0
      && snapshot.wildcardsAllowed === false
      && snapshot.parseFailureDenied === true
      && snapshot.staleAllowanceDenied === true
      && snapshot.newSurfaceDenied === true
      && snapshot.dynamicImportAndRequireInspected === true
      && snapshot.aliasesAndComputedPropertiesInspected === true
      && snapshot.rendererRoleConditionGrantsAuthority === false
      && snapshot.allowlistMutationGrantsRuntimeAuthority === false
      && snapshot.buildGateReplacesRuntimePolicy === false
      && snapshot.sourcePathsExposedToClient === false
      && snapshot.allowlistHashExposedToClient === false
      && snapshot.schemaMigrationRequired === false
      && snapshot.latestDatabaseMigration === 77;
  }
}
