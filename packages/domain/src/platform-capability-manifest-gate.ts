export type PlatformCapabilityFamily =
  | 'camera'
  | 'microphone'
  | 'file'
  | 'ocr'
  | 'ai'
  | 'location'
  | 'network';

export interface PlatformCapabilityManifestGateBoundaryView {
  readonly schemaVersion: 1;
  readonly status: 'build-runtime-verified';
  readonly gateVersion: 'PPK-022-V1';
  readonly enforcement: 'build-and-runtime-fail-closed';
  readonly defaultDecision: 'DENY';
  readonly protectedCapabilityFamilies: readonly PlatformCapabilityFamily[];
  readonly protectedCapabilityCount: 7;
  readonly canonicalApplicationCount: 14;
  readonly applicationsWithRuntimeCapabilities: 2;
  readonly exactAstSurfaceCount: 282;
  readonly signedManifestHashBindingRequired: true;
  readonly authenticatedRuntimeAuthorityRequired: true;
  readonly exactRuntimeCoverageRequired: true;
  readonly undeclaredCapabilityDenied: true;
  readonly unexpectedCapabilityDenied: true;
  readonly bootstrapFileCapabilityPinned: true;
  readonly bootstrapNetworkCapabilityPinned: true;
  readonly buildManifestAloneGrantsRuntimeAuthority: false;
  readonly sourcePathsExposedToClient: false;
  readonly manifestHashesExposedToClient: false;
  readonly schemaMigrationRequired: false;
  readonly latestDatabaseMigration: 77;
}
