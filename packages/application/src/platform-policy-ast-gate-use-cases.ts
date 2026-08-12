import type { PlatformPolicyAstGateBoundaryView } from '@ppt/domain';
import { PlatformPolicyAstGatePolicy } from '@ppt/platform-policy';

export class GetPlatformPolicyAstGateBoundaryUseCase {
  public constructor(private readonly policy: PlatformPolicyAstGatePolicy) {}

  public execute(): PlatformPolicyAstGateBoundaryView {
    const snapshot = this.policy.snapshot();
    if (!this.policy.verify(snapshot)) throw new Error('PLATFORM_POLICY_AST_GATE_SNAPSHOT_INVALID');
    return Object.freeze({
      schemaVersion: 1,
      status: 'build-verified',
      gateVersion: snapshot.gateVersion,
      parser: snapshot.parser,
      parserVersion: snapshot.parserVersion,
      syntaxModel: snapshot.syntaxModel,
      enforcement: snapshot.enforcement,
      defaultDecision: snapshot.defaultDecision,
      protectedRules: snapshot.protectedRules,
      protectedRuleCount: snapshot.protectedRuleCount,
      productionSourceZones: snapshot.productionSourceZones,
      exactAllowlistEntries: snapshot.exactAllowlistEntries,
      directRoleAuthorizationBypasses: snapshot.directRoleAuthorizationBypasses,
      wildcardsAllowed: snapshot.wildcardsAllowed,
      parseFailureDenied: snapshot.parseFailureDenied,
      staleAllowanceDenied: snapshot.staleAllowanceDenied,
      newSurfaceDenied: snapshot.newSurfaceDenied,
      dynamicImportAndRequireInspected: snapshot.dynamicImportAndRequireInspected,
      aliasesAndComputedPropertiesInspected: snapshot.aliasesAndComputedPropertiesInspected,
      rendererRoleConditionGrantsAuthority: snapshot.rendererRoleConditionGrantsAuthority,
      allowlistMutationGrantsRuntimeAuthority: snapshot.allowlistMutationGrantsRuntimeAuthority,
      buildGateReplacesRuntimePolicy: snapshot.buildGateReplacesRuntimePolicy,
      sourcePathsExposedToClient: snapshot.sourcePathsExposedToClient,
      allowlistHashExposedToClient: snapshot.allowlistHashExposedToClient,
      schemaMigrationRequired: false,
      latestDatabaseMigration: 77
    });
  }
}
