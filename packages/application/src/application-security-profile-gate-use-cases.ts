import type { ApplicationSecurityProfileGateBoundaryView } from '@ppt/domain';
import { ApplicationSecurityProfilePolicy } from '@ppt/platform-policy';

export class GetApplicationSecurityProfileGateBoundaryUseCase {
  public constructor(private readonly policy: ApplicationSecurityProfilePolicy) {}

  public execute(): ApplicationSecurityProfileGateBoundaryView {
    const snapshot = this.policy.snapshot();
    if (!this.policy.verifySnapshot(snapshot)) throw new Error('APPLICATION_SECURITY_PROFILE_GATE_SNAPSHOT_INVALID');
    return Object.freeze({
      schemaVersion: 1,
      status: snapshot.status,
      gateVersion: snapshot.gateVersion,
      enforcement: snapshot.enforcement,
      defaultDecision: snapshot.defaultDecision,
      canonicalApplicationCount: snapshot.canonicalApplicationCount,
      mappedApplicationCount: snapshot.mappedApplicationCount,
      assuranceProfileCount: snapshot.assuranceProfileCount,
      threatModelCount: snapshot.threatModelCount,
      mobileMasvsApplicationCount: snapshot.mobileMasvsApplicationCount,
      asvsVersion: snapshot.asvsVersion,
      masvsVersion: snapshot.masvsVersion,
      ssdfVersion: snapshot.ssdfVersion,
      newApplicationWithoutMappingDenied: snapshot.newApplicationWithoutMappingDenied,
      threatModelHashRequired: snapshot.threatModelHashRequired,
      workspaceOwnerCoverageRequired: snapshot.workspaceOwnerCoverageRequired,
      mappingClaimsCompliance: false,
      nativeRuntimeValidationClaimed: false,
      sourcePathsExposedToClient: false,
      threatModelHashesExposedToClient: false,
      schemaMigrationRequired: false,
      latestDatabaseMigration: 77
    });
  }
}
