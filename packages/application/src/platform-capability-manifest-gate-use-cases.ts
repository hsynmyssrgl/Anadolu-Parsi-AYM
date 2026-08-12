import type { PlatformCapabilityManifestGateBoundaryView } from '@ppt/domain';
import { PlatformCapabilityManifestPolicy } from '@ppt/platform-policy';

export class GetPlatformCapabilityManifestGateBoundaryUseCase {
  public constructor(private readonly policy: PlatformCapabilityManifestPolicy) {}

  public execute(): PlatformCapabilityManifestGateBoundaryView {
    const snapshot = this.policy.snapshot();
    if (!this.policy.verifySnapshot(snapshot)) throw new Error('PLATFORM_CAPABILITY_MANIFEST_GATE_SNAPSHOT_INVALID');
    return Object.freeze({
      schemaVersion: 1,
      status: 'build-runtime-verified',
      gateVersion: snapshot.gateVersion,
      enforcement: snapshot.enforcement,
      defaultDecision: snapshot.defaultDecision,
      protectedCapabilityFamilies: snapshot.protectedCapabilityFamilies,
      protectedCapabilityCount: snapshot.protectedCapabilityCount,
      canonicalApplicationCount: snapshot.canonicalApplicationCount,
      applicationsWithRuntimeCapabilities: snapshot.applicationsWithRuntimeCapabilities,
      exactAstSurfaceCount: snapshot.exactAstSurfaceCount,
      signedManifestHashBindingRequired: snapshot.signedManifestHashBindingRequired,
      authenticatedRuntimeAuthorityRequired: snapshot.authenticatedRuntimeAuthorityRequired,
      exactRuntimeCoverageRequired: snapshot.exactRuntimeCoverageRequired,
      undeclaredCapabilityDenied: snapshot.undeclaredCapabilityDenied,
      unexpectedCapabilityDenied: snapshot.unexpectedCapabilityDenied,
      bootstrapFileCapabilityPinned: snapshot.bootstrapFileCapabilityPinned,
      bootstrapNetworkCapabilityPinned: snapshot.bootstrapNetworkCapabilityPinned,
      buildManifestAloneGrantsRuntimeAuthority: snapshot.buildManifestAloneGrantsRuntimeAuthority,
      sourcePathsExposedToClient: false,
      manifestHashesExposedToClient: false,
      schemaMigrationRequired: false,
      latestDatabaseMigration: 77
    });
  }
}
