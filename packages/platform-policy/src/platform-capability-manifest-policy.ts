import {
  PLATFORM_APPLICATION_IDS,
  PLATFORM_RUNTIME_CAPABILITIES,
  platformCapabilityManifestHash,
  type PlatformApplicationId,
  type PlatformApplicationIdentityManifest,
  type PlatformRuntimeCapability
} from './policy-kernel.js';

export const PLATFORM_APPLICATION_RUNTIME_CAPABILITY_REQUIREMENTS: Readonly<Record<
  PlatformApplicationId,
  readonly PlatformRuntimeCapability[]
>> = Object.freeze({
  'windows-desktop': Object.freeze(['file.access', 'network.access'] as const),
  'windows-core-service': Object.freeze(['file.access', 'network.access'] as const),
  'windows-cluster-agent': Object.freeze([] as const),
  'macos-companion': Object.freeze([] as const),
  'ios-companion': Object.freeze([] as const),
  'ipados-companion': Object.freeze([] as const),
  'watchos-companion': Object.freeze([] as const),
  'visionos-companion': Object.freeze([] as const),
  'ocr-worker': Object.freeze([] as const),
  'ai-worker': Object.freeze([] as const),
  'translation-worker': Object.freeze([] as const),
  'communication-service': Object.freeze([] as const),
  'backup-worker': Object.freeze([] as const),
  'signed-plugin': Object.freeze([] as const)
});

export const PPK022_EXPECTED_AST_CAPABILITY_SURFACE_COUNT = 242 as const;

export type PlatformCapabilityManifestAuthoritySource =
  | 'core-service-kernel'
  | 'authenticated-core-service-health';

export type PlatformCapabilityManifestDenialReason =
  | 'ALLOW_CAPABILITY'
  | 'MALFORMED_REQUEST'
  | 'MALFORMED_AUTHORITY'
  | 'POLICY_PACKAGE_UNVERIFIED'
  | 'POLICY_PACKAGE_HASH_MISMATCH'
  | 'APPLICATION_NOT_REGISTERED'
  | 'APPLICATION_ID_MISMATCH'
  | 'APPLICATION_VERSION_MISMATCH'
  | 'CAPABILITY_MANIFEST_HASH_MISMATCH'
  | 'CAPABILITY_NOT_DECLARED'
  | 'CAPABILITY_REQUIREMENT_MISSING'
  | 'CAPABILITY_REQUIREMENT_UNEXPECTED';

export interface PlatformRuntimeCapabilityRequest {
  readonly schemaVersion: 1;
  readonly applicationId: PlatformApplicationId;
  readonly applicationVersion: string;
  readonly capabilityManifestSha256: string;
  readonly policyPackageSha256: string;
  readonly capability: PlatformRuntimeCapability;
  readonly occurredAt: string;
}

export interface PlatformCapabilityManifestAuthority {
  readonly schemaVersion: 1;
  readonly source: PlatformCapabilityManifestAuthoritySource;
  readonly policyPackageVerified: boolean;
  readonly policyPackageSha256: string;
  readonly manifest: PlatformApplicationIdentityManifest;
}

export interface PlatformRuntimeCapabilityDecision {
  readonly allowed: boolean;
  readonly reason: PlatformCapabilityManifestDenialReason;
  readonly applicationId: PlatformApplicationId | null;
  readonly capability: PlatformRuntimeCapability | null;
  readonly runtimeAuthorityRequired: true;
  readonly buildManifestAloneGrantsAuthority: false;
}

export interface PlatformCapabilityCoverageDecision {
  readonly allowed: boolean;
  readonly reason: PlatformCapabilityManifestDenialReason;
  readonly applicationId: PlatformApplicationId;
  readonly requiredCapabilities: readonly PlatformRuntimeCapability[];
  readonly declaredCapabilities: readonly PlatformRuntimeCapability[];
  readonly exactCoverageRequired: true;
}

export interface PlatformCapabilityManifestBoundarySnapshot {
  readonly schemaVersion: 1;
  readonly gateVersion: 'PPK-022-V1';
  readonly enforcement: 'build-and-runtime-fail-closed';
  readonly defaultDecision: 'DENY';
  readonly protectedCapabilityFamilies: readonly [
    'camera', 'microphone', 'file', 'ocr', 'ai', 'location', 'network'
  ];
  readonly protectedCapabilityCount: 7;
  readonly canonicalApplicationCount: 14;
  readonly applicationsWithRuntimeCapabilities: 2;
  readonly exactAstSurfaceCount: typeof PPK022_EXPECTED_AST_CAPABILITY_SURFACE_COUNT;
  readonly signedManifestHashBindingRequired: true;
  readonly authenticatedRuntimeAuthorityRequired: true;
  readonly exactRuntimeCoverageRequired: true;
  readonly undeclaredCapabilityDenied: true;
  readonly unexpectedCapabilityDenied: true;
  readonly bootstrapFileCapabilityPinned: true;
  readonly bootstrapNetworkCapabilityPinned: true;
  readonly buildManifestAloneGrantsRuntimeAuthority: false;
  readonly schemaMigrationRequired: false;
  readonly latestDatabaseMigration: 77;
}

const SHA256 = /^[a-f0-9]{64}$/u;
const capabilitySet = new Set<PlatformRuntimeCapability>(PLATFORM_RUNTIME_CAPABILITIES);
const applicationSet = new Set<PlatformApplicationId>(PLATFORM_APPLICATION_IDS);
const exactKeys = (value: object, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length && actual.every((key, index) => key === canonical[index]);
};
const plainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const strictIso = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
};
const validString = (value: unknown, maximum = 128): value is string =>
  typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= maximum;
const validCapabilities = (value: unknown): value is readonly PlatformRuntimeCapability[] =>
  Array.isArray(value)
  && value.length <= PLATFORM_RUNTIME_CAPABILITIES.length
  && value.every((item) => capabilitySet.has(item))
  && new Set(value).size === value.length
  && value.every((item, index) => index === 0 || String(value[index - 1]).localeCompare(item, 'en') < 0);
const sameCapabilities = (
  left: readonly PlatformRuntimeCapability[],
  right: readonly PlatformRuntimeCapability[]
): boolean => left.length === right.length && left.every((value, index) => value === right[index]);

const validManifest = (value: unknown): value is PlatformApplicationIdentityManifest => {
  if (!plainRecord(value) || !exactKeys(value, [
    'schemaVersion', 'applicationId', 'applicationVersion', 'capabilities',
    'runtimeCapabilities', 'deviceCertificateRequired', 'capabilityManifestSha256'
  ])) return false;
  const manifest = value as unknown as PlatformApplicationIdentityManifest;
  if (
    manifest.schemaVersion !== 1
    || !applicationSet.has(manifest.applicationId)
    || !validString(manifest.applicationVersion)
    || !Array.isArray(manifest.capabilities)
    || manifest.capabilities.some((item) => !validString(item))
    || new Set(manifest.capabilities).size !== manifest.capabilities.length
    || !validCapabilities(manifest.runtimeCapabilities)
    || typeof manifest.deviceCertificateRequired !== 'boolean'
    || !SHA256.test(manifest.capabilityManifestSha256)
  ) return false;
  return platformCapabilityManifestHash(manifest) === manifest.capabilityManifestSha256;
};

const validAuthority = (value: unknown): value is PlatformCapabilityManifestAuthority =>
  plainRecord(value)
  && exactKeys(value, ['schemaVersion', 'source', 'policyPackageVerified', 'policyPackageSha256', 'manifest'])
  && value.schemaVersion === 1
  && (value.source === 'core-service-kernel' || value.source === 'authenticated-core-service-health')
  && typeof value.policyPackageVerified === 'boolean'
  && typeof value.policyPackageSha256 === 'string'
  && SHA256.test(value.policyPackageSha256)
  && validManifest(value.manifest);

const validRequest = (value: unknown): value is PlatformRuntimeCapabilityRequest =>
  plainRecord(value)
  && exactKeys(value, [
    'schemaVersion', 'applicationId', 'applicationVersion', 'capabilityManifestSha256',
    'policyPackageSha256', 'capability', 'occurredAt'
  ])
  && value.schemaVersion === 1
  && applicationSet.has(value.applicationId as PlatformApplicationId)
  && validString(value.applicationVersion)
  && typeof value.capabilityManifestSha256 === 'string' && SHA256.test(value.capabilityManifestSha256)
  && typeof value.policyPackageSha256 === 'string' && SHA256.test(value.policyPackageSha256)
  && capabilitySet.has(value.capability as PlatformRuntimeCapability)
  && strictIso(value.occurredAt);

const runtimeDecision = (
  allowed: boolean,
  reason: PlatformCapabilityManifestDenialReason,
  request?: Partial<PlatformRuntimeCapabilityRequest>
): PlatformRuntimeCapabilityDecision => Object.freeze({
  allowed,
  reason,
  applicationId: applicationSet.has(request?.applicationId as PlatformApplicationId)
    ? request!.applicationId as PlatformApplicationId
    : null,
  capability: capabilitySet.has(request?.capability as PlatformRuntimeCapability)
    ? request!.capability as PlatformRuntimeCapability
    : null,
  runtimeAuthorityRequired: true,
  buildManifestAloneGrantsAuthority: false
});

export class PlatformCapabilityManifestPolicy {
  public authorize(requestValue: unknown, authorityValue: unknown): PlatformRuntimeCapabilityDecision {
    if (!validRequest(requestValue)) return runtimeDecision(false, 'MALFORMED_REQUEST');
    if (!validAuthority(authorityValue)) return runtimeDecision(false, 'MALFORMED_AUTHORITY', requestValue);
    if (!authorityValue.policyPackageVerified) return runtimeDecision(false, 'POLICY_PACKAGE_UNVERIFIED', requestValue);
    if (requestValue.policyPackageSha256 !== authorityValue.policyPackageSha256) {
      return runtimeDecision(false, 'POLICY_PACKAGE_HASH_MISMATCH', requestValue);
    }
    const manifest = authorityValue.manifest;
    if (requestValue.applicationId !== manifest.applicationId) {
      return runtimeDecision(false, 'APPLICATION_ID_MISMATCH', requestValue);
    }
    if (requestValue.applicationVersion !== manifest.applicationVersion) {
      return runtimeDecision(false, 'APPLICATION_VERSION_MISMATCH', requestValue);
    }
    if (requestValue.capabilityManifestSha256 !== manifest.capabilityManifestSha256) {
      return runtimeDecision(false, 'CAPABILITY_MANIFEST_HASH_MISMATCH', requestValue);
    }
    const coverage = this.evaluateCoverage(requestValue.applicationId, authorityValue);
    if (!coverage.allowed) return runtimeDecision(false, coverage.reason, requestValue);
    if (!manifest.runtimeCapabilities.includes(requestValue.capability)) {
      return runtimeDecision(false, 'CAPABILITY_NOT_DECLARED', requestValue);
    }
    return runtimeDecision(true, 'ALLOW_CAPABILITY', requestValue);
  }

  public evaluateCoverage(
    applicationId: PlatformApplicationId,
    authorityValue: unknown
  ): PlatformCapabilityCoverageDecision {
    const required = PLATFORM_APPLICATION_RUNTIME_CAPABILITY_REQUIREMENTS[applicationId];
    if (!validAuthority(authorityValue) || !authorityValue.policyPackageVerified) {
      return Object.freeze({
        allowed: false,
        reason: validAuthority(authorityValue) ? 'POLICY_PACKAGE_UNVERIFIED' : 'MALFORMED_AUTHORITY',
        applicationId,
        requiredCapabilities: required,
        declaredCapabilities: Object.freeze([]),
        exactCoverageRequired: true
      });
    }
    const manifest = authorityValue.manifest;
    if (manifest.applicationId !== applicationId) {
      return Object.freeze({
        allowed: false,
        reason: 'APPLICATION_ID_MISMATCH',
        applicationId,
        requiredCapabilities: required,
        declaredCapabilities: manifest.runtimeCapabilities,
        exactCoverageRequired: true
      });
    }
    const declared = manifest.runtimeCapabilities;
    const missing = required.some((capability) => !declared.includes(capability));
    const unexpected = declared.some((capability) => !required.includes(capability));
    return Object.freeze({
      allowed: !missing && !unexpected && sameCapabilities(declared, required),
      reason: missing
        ? 'CAPABILITY_REQUIREMENT_MISSING'
        : unexpected || !sameCapabilities(declared, required)
          ? 'CAPABILITY_REQUIREMENT_UNEXPECTED'
          : 'ALLOW_CAPABILITY',
      applicationId,
      requiredCapabilities: required,
      declaredCapabilities: declared,
      exactCoverageRequired: true
    });
  }

  public snapshot(): PlatformCapabilityManifestBoundarySnapshot {
    return Object.freeze({
      schemaVersion: 1,
      gateVersion: 'PPK-022-V1',
      enforcement: 'build-and-runtime-fail-closed',
      defaultDecision: 'DENY',
      protectedCapabilityFamilies: Object.freeze([
        'camera', 'microphone', 'file', 'ocr', 'ai', 'location', 'network'
      ] as const),
      protectedCapabilityCount: 7,
      canonicalApplicationCount: PLATFORM_APPLICATION_IDS.length,
      applicationsWithRuntimeCapabilities: 2,
      exactAstSurfaceCount: PPK022_EXPECTED_AST_CAPABILITY_SURFACE_COUNT,
      signedManifestHashBindingRequired: true,
      authenticatedRuntimeAuthorityRequired: true,
      exactRuntimeCoverageRequired: true,
      undeclaredCapabilityDenied: true,
      unexpectedCapabilityDenied: true,
      bootstrapFileCapabilityPinned: true,
      bootstrapNetworkCapabilityPinned: true,
      buildManifestAloneGrantsRuntimeAuthority: false,
      schemaMigrationRequired: false,
      latestDatabaseMigration: 77
    });
  }

  public verifySnapshot(value: unknown): value is PlatformCapabilityManifestBoundarySnapshot {
    if (!plainRecord(value) || !exactKeys(value, [
      'schemaVersion', 'gateVersion', 'enforcement', 'defaultDecision',
      'protectedCapabilityFamilies', 'protectedCapabilityCount', 'canonicalApplicationCount',
      'applicationsWithRuntimeCapabilities', 'exactAstSurfaceCount',
      'signedManifestHashBindingRequired', 'authenticatedRuntimeAuthorityRequired',
      'exactRuntimeCoverageRequired', 'undeclaredCapabilityDenied', 'unexpectedCapabilityDenied',
      'bootstrapFileCapabilityPinned', 'bootstrapNetworkCapabilityPinned',
      'buildManifestAloneGrantsRuntimeAuthority', 'schemaMigrationRequired', 'latestDatabaseMigration'
    ])) return false;
    const snapshot = value as unknown as PlatformCapabilityManifestBoundarySnapshot;
    return snapshot.schemaVersion === 1
      && snapshot.gateVersion === 'PPK-022-V1'
      && snapshot.enforcement === 'build-and-runtime-fail-closed'
      && snapshot.defaultDecision === 'DENY'
      && Array.isArray(snapshot.protectedCapabilityFamilies)
      && snapshot.protectedCapabilityFamilies.join('|') === 'camera|microphone|file|ocr|ai|location|network'
      && snapshot.protectedCapabilityCount === 7
      && snapshot.canonicalApplicationCount === 14
      && snapshot.applicationsWithRuntimeCapabilities === 2
      && snapshot.exactAstSurfaceCount === PPK022_EXPECTED_AST_CAPABILITY_SURFACE_COUNT
      && snapshot.signedManifestHashBindingRequired === true
      && snapshot.authenticatedRuntimeAuthorityRequired === true
      && snapshot.exactRuntimeCoverageRequired === true
      && snapshot.undeclaredCapabilityDenied === true
      && snapshot.unexpectedCapabilityDenied === true
      && snapshot.bootstrapFileCapabilityPinned === true
      && snapshot.bootstrapNetworkCapabilityPinned === true
      && snapshot.buildManifestAloneGrantsRuntimeAuthority === false
      && snapshot.schemaMigrationRequired === false
      && snapshot.latestDatabaseMigration === 77;
  }
}

export const createPlatformCapabilityManifestAuthority = (input: {
  readonly source: PlatformCapabilityManifestAuthoritySource;
  readonly policyPackageVerified: boolean;
  readonly policyPackageSha256: string;
  readonly manifest: PlatformApplicationIdentityManifest;
}): PlatformCapabilityManifestAuthority => Object.freeze({
  schemaVersion: 1,
  source: input.source,
  policyPackageVerified: input.policyPackageVerified,
  policyPackageSha256: input.policyPackageSha256,
  manifest: input.manifest
});

export const assertPinnedBootstrapRuntimeCapability = (
  applicationId: PlatformApplicationId,
  capability: PlatformRuntimeCapability
): void => {
  if (!PLATFORM_APPLICATION_RUNTIME_CAPABILITY_REQUIREMENTS[applicationId].includes(capability)) {
    throw new Error(`BOOTSTRAP_RUNTIME_CAPABILITY_NOT_DECLARED:${applicationId}:${capability}`);
  }
};
