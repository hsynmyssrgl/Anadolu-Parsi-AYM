import { createHash } from 'node:crypto';
import {
  POLICY_CONFORMANCE_TARGET_PROFILES,
  type PolicyConformanceTargetProfile
} from './policy-conformance-suite.js';
import { PLATFORM_APPLICATION_IDS, type PlatformApplicationId } from './policy-kernel.js';

export const APPLICATION_SECURITY_PROFILE_GATE_VERSION = 'PPK-023-V1' as const;
export const APPLICATION_SECURITY_STANDARD_VERSIONS = Object.freeze({
  asvs: '5.0.0',
  masvs: '2.1.0',
  ssdf: '1.1'
} as const);

export const APPLICATION_SECURITY_ASVS_BASELINE_CONTROLS = Object.freeze([
  'v5.0.0-1.2.4', 'v5.0.0-1.2.5', 'v5.0.0-2.2.2', 'v5.0.0-2.3.3',
  'v5.0.0-5.3.2', 'v5.0.0-6.8.2', 'v5.0.0-7.2.1', 'v5.0.0-7.4.1',
  'v5.0.0-8.2.1', 'v5.0.0-8.2.2', 'v5.0.0-8.3.1', 'v5.0.0-9.1.1',
  'v5.0.0-11.6.1', 'v5.0.0-12.3.1', 'v5.0.0-13.2.4', 'v5.0.0-14.1.1',
  'v5.0.0-14.2.4', 'v5.0.0-15.1.2', 'v5.0.0-15.4.2', 'v5.0.0-16.2.5',
  'v5.0.0-16.3.2'
] as const);

export const APPLICATION_SECURITY_MASVS_MOBILE_CONTROLS = Object.freeze([
  'MASVS-AUTH-1', 'MASVS-AUTH-2', 'MASVS-AUTH-3',
  'MASVS-CODE-1', 'MASVS-CODE-2', 'MASVS-CODE-3', 'MASVS-CODE-4',
  'MASVS-CRYPTO-1', 'MASVS-CRYPTO-2',
  'MASVS-NETWORK-1', 'MASVS-NETWORK-2',
  'MASVS-PLATFORM-1', 'MASVS-PLATFORM-2', 'MASVS-PLATFORM-3',
  'MASVS-PRIVACY-1', 'MASVS-PRIVACY-2', 'MASVS-PRIVACY-3', 'MASVS-PRIVACY-4',
  'MASVS-RESILIENCE-1', 'MASVS-RESILIENCE-2', 'MASVS-RESILIENCE-3', 'MASVS-RESILIENCE-4',
  'MASVS-STORAGE-1', 'MASVS-STORAGE-2'
] as const);

export const APPLICATION_SECURITY_SSDF_BASELINE_PRACTICES = Object.freeze([
  'PO.1', 'PO.2', 'PO.3', 'PO.4', 'PO.5',
  'PS.1', 'PS.2', 'PS.3',
  'PW.1', 'PW.2', 'PW.4', 'PW.5', 'PW.6', 'PW.7', 'PW.8', 'PW.9',
  'RV.1', 'RV.2', 'RV.3'
] as const);

export const APPLICATION_SECURITY_MOBILE_APPLICATION_IDS = Object.freeze([
  'ios-companion', 'ipados-companion', 'watchos-companion', 'visionos-companion'
] as const satisfies readonly PlatformApplicationId[]);

export type ApplicationSecurityAssuranceProfileId = 'GENERAL_APPLICATION' | 'MOBILE_COMPANION';
export type ApplicationSecurityProfileDenialReason =
  | 'ALLOW_MAPPED_PROFILE'
  | 'APPLICATION_UNKNOWN'
  | 'MALFORMED_MANIFEST'
  | 'MANIFEST_HASH_MISMATCH'
  | 'MAPPING_INCOMPLETE';

export interface ApplicationSecurityProfileDecision {
  readonly allowed: boolean;
  readonly reason: ApplicationSecurityProfileDenialReason;
  readonly applicationId: PlatformApplicationId | null;
  readonly assuranceProfileId: ApplicationSecurityAssuranceProfileId | null;
  readonly mappingClaimsCompliance: false;
  readonly grantsRuntimeAuthority: false;
}

export interface ApplicationSecurityProfileBoundarySnapshot {
  readonly schemaVersion: 1;
  readonly status: 'build-mapping-verified';
  readonly gateVersion: typeof APPLICATION_SECURITY_PROFILE_GATE_VERSION;
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
  readonly schemaMigrationRequired: false;
  readonly latestDatabaseMigration: 77;
}

const SHA256 = /^[a-f0-9]{64}$/u;
const GENERAL_NA_REASON = 'OWASP MASVS is mobile-specific; this profile records an explicit non-mobile applicability decision.';
const applicationSet = new Set<PlatformApplicationId>(PLATFORM_APPLICATION_IDS);
const mobileSet = new Set<PlatformApplicationId>(APPLICATION_SECURITY_MOBILE_APPLICATION_IDS);
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
const same = (left: readonly unknown[], right: readonly unknown[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);
const canonicalize = (value: unknown): string => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('APPLICATION_SECURITY_PROFILE_NON_FINITE_NUMBER');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (!plainRecord(value)) throw new TypeError('APPLICATION_SECURITY_PROFILE_UNSUPPORTED_VALUE');
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
};

export const applicationSecurityProfileManifestHash = (value: unknown): string => {
  if (!plainRecord(value)) throw new TypeError('APPLICATION_SECURITY_PROFILE_MANIFEST_INVALID');
  const { manifestSha256: _manifestSha256, ...payload } = value;
  return createHash('sha256').update(canonicalize(payload), 'utf8').digest('hex');
};

const validControlCatalog = (value: unknown): boolean => {
  if (!plainRecord(value) || !exactKeys(value, ['asvs', 'masvs', 'ssdf'])) return false;
  const specifications: ReadonlyArray<readonly [string, string, string, readonly string[]]> = [
    ['asvs', 'OWASP ASVS', APPLICATION_SECURITY_STANDARD_VERSIONS.asvs, APPLICATION_SECURITY_ASVS_BASELINE_CONTROLS],
    ['masvs', 'OWASP MASVS', APPLICATION_SECURITY_STANDARD_VERSIONS.masvs, APPLICATION_SECURITY_MASVS_MOBILE_CONTROLS],
    ['ssdf', 'NIST SSDF', APPLICATION_SECURITY_STANDARD_VERSIONS.ssdf, APPLICATION_SECURITY_SSDF_BASELINE_PRACTICES]
  ];
  return specifications.every(([key, name, version, controls]) => {
    const standard = value[key];
    return plainRecord(standard)
      && exactKeys(standard, ['name', 'version', 'publicationState', 'officialSource', 'controlIds'])
      && standard.name === name
      && standard.version === version
      && (standard.publicationState === 'STABLE' || standard.publicationState === 'FINAL')
      && typeof standard.officialSource === 'string'
      && /^https:\/\//u.test(standard.officialSource)
      && Array.isArray(standard.controlIds)
      && same(standard.controlIds, controls);
  });
};

const validAssuranceProfiles = (value: unknown): boolean => {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const general = value[0];
  const mobile = value[1];
  const validBase = (profile: unknown): profile is Record<string, unknown> => plainRecord(profile)
    && exactKeys(profile, ['id', 'asvsControlIds', 'masvs', 'ssdfPracticeIds']);
  if (!validBase(general) || !validBase(mobile)) return false;
  const validMasvs = (candidate: unknown, applicable: boolean): boolean => plainRecord(candidate)
    && exactKeys(candidate, ['applicability', 'controlIds', 'notApplicableReason'])
    && candidate.applicability === (applicable ? 'APPLICABLE' : 'NOT_APPLICABLE')
    && Array.isArray(candidate.controlIds)
    && same(candidate.controlIds, applicable ? APPLICATION_SECURITY_MASVS_MOBILE_CONTROLS : [])
    && candidate.notApplicableReason === (applicable ? null : GENERAL_NA_REASON);
  return general.id === 'GENERAL_APPLICATION'
    && mobile.id === 'MOBILE_COMPANION'
    && Array.isArray(general.asvsControlIds) && same(general.asvsControlIds, APPLICATION_SECURITY_ASVS_BASELINE_CONTROLS)
    && Array.isArray(mobile.asvsControlIds) && same(mobile.asvsControlIds, APPLICATION_SECURITY_ASVS_BASELINE_CONTROLS)
    && validMasvs(general.masvs, false) && validMasvs(mobile.masvs, true)
    && Array.isArray(general.ssdfPracticeIds) && same(general.ssdfPracticeIds, APPLICATION_SECURITY_SSDF_BASELINE_PRACTICES)
    && Array.isArray(mobile.ssdfPracticeIds) && same(mobile.ssdfPracticeIds, APPLICATION_SECURITY_SSDF_BASELINE_PRACTICES);
};

const validWorkspaceOwners = (value: unknown): boolean => {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const expected = [
    ['apps/core-service', 'windows-core-service'],
    ['apps/desktop', 'windows-desktop']
  ];
  return value.every((item, index) => plainRecord(item)
    && exactKeys(item, ['path', 'applicationId'])
    && item.path === expected[index]![0]
    && item.applicationId === expected[index]![1]);
};

const validTargetProfile = (value: unknown, target: PolicyConformanceTargetProfile): boolean => {
  if (!plainRecord(value) || !exactKeys(value, [
    'applicationId', 'platformGroup', 'deploymentState', 'nativeRuntimeExecution',
    'assuranceProfileId', 'threatModelId', 'threatModelSection', 'mappingState',
    'complianceClaimed', 'nativeRuntimeValidated'
  ])) return false;
  const expectedAssuranceProfile = mobileSet.has(target.applicationId) ? 'MOBILE_COMPANION' : 'GENERAL_APPLICATION';
  return value.applicationId === target.applicationId
    && value.platformGroup === target.platformGroup
    && value.deploymentState === target.deploymentState
    && value.nativeRuntimeExecution === target.nativeRuntimeExecution
    && value.assuranceProfileId === expectedAssuranceProfile
    && value.threatModelId === `APP-THREAT-${target.applicationId}`
    && value.threatModelSection === `## APP-THREAT-${target.applicationId}`
    && value.mappingState === 'MAPPED'
    && value.complianceClaimed === false
    && value.nativeRuntimeValidated === (target.nativeRuntimeExecution === 'CURRENT_RUNTIME');
};

const hasValidDeclaredHash = (value: Record<string, unknown>): boolean =>
  typeof value.manifestSha256 === 'string'
  && SHA256.test(value.manifestSha256)
  && applicationSecurityProfileManifestHash(value) === value.manifestSha256;

export class ApplicationSecurityProfilePolicy {
  public verifyManifest(value: unknown): boolean {
    if (!plainRecord(value) || !exactKeys(value, [
      'schemaVersion', 'gateVersion', 'defaultDecision', 'mappingState', 'complianceClaimed',
      'standards', 'threatModelDocument', 'workspaceOwners', 'assuranceProfiles', 'profiles', 'manifestSha256'
    ])) return false;
    if (
      value.schemaVersion !== 1
      || value.gateVersion !== APPLICATION_SECURITY_PROFILE_GATE_VERSION
      || value.defaultDecision !== 'DENY'
      || value.mappingState !== 'REQUIREMENTS_MAPPED_NOT_CERTIFIED'
      || value.complianceClaimed !== false
      || !validControlCatalog(value.standards)
      || !validWorkspaceOwners(value.workspaceOwners)
      || !validAssuranceProfiles(value.assuranceProfiles)
    ) return false;
    if (!plainRecord(value.threatModelDocument)
      || !exactKeys(value.threatModelDocument, ['path', 'sha256', 'modelCount', 'reviewState'])
      || value.threatModelDocument.path !== 'docs/security/PPK-023_APPLICATION_SECURITY_PROFILES_THREAT_MODEL.md'
      || typeof value.threatModelDocument.sha256 !== 'string'
      || !SHA256.test(value.threatModelDocument.sha256)
      || value.threatModelDocument.modelCount !== PLATFORM_APPLICATION_IDS.length
      || value.threatModelDocument.reviewState !== 'REVIEWED') return false;
    if (!Array.isArray(value.profiles) || value.profiles.length !== POLICY_CONFORMANCE_TARGET_PROFILES.length) return false;
    if (!value.profiles.every((profile, index) => validTargetProfile(profile, POLICY_CONFORMANCE_TARGET_PROFILES[index]!))) return false;
    return hasValidDeclaredHash(value);
  }

  public evaluate(applicationIdValue: unknown, manifestValue: unknown): ApplicationSecurityProfileDecision {
    const applicationId = applicationSet.has(applicationIdValue as PlatformApplicationId)
      ? applicationIdValue as PlatformApplicationId
      : null;
    if (!applicationId) return this.#decision(false, 'APPLICATION_UNKNOWN', null, null);
    if (!plainRecord(manifestValue)) return this.#decision(false, 'MALFORMED_MANIFEST', applicationId, null);
    if (!hasValidDeclaredHash(manifestValue)) return this.#decision(false, 'MANIFEST_HASH_MISMATCH', applicationId, null);
    if (!this.verifyManifest(manifestValue)) return this.#decision(false, 'MAPPING_INCOMPLETE', applicationId, null);
    const profile = (manifestValue.profiles as readonly Record<string, unknown>[])
      .find((candidate) => candidate.applicationId === applicationId)!;
    return this.#decision(true, 'ALLOW_MAPPED_PROFILE', applicationId, profile.assuranceProfileId as ApplicationSecurityAssuranceProfileId);
  }

  public snapshot(): ApplicationSecurityProfileBoundarySnapshot {
    return Object.freeze({
      schemaVersion: 1,
      status: 'build-mapping-verified',
      gateVersion: APPLICATION_SECURITY_PROFILE_GATE_VERSION,
      enforcement: 'fail-closed',
      defaultDecision: 'DENY',
      canonicalApplicationCount: 14,
      mappedApplicationCount: 14,
      assuranceProfileCount: 2,
      threatModelCount: 14,
      mobileMasvsApplicationCount: 4,
      asvsVersion: APPLICATION_SECURITY_STANDARD_VERSIONS.asvs,
      masvsVersion: APPLICATION_SECURITY_STANDARD_VERSIONS.masvs,
      ssdfVersion: APPLICATION_SECURITY_STANDARD_VERSIONS.ssdf,
      newApplicationWithoutMappingDenied: true,
      threatModelHashRequired: true,
      workspaceOwnerCoverageRequired: true,
      mappingClaimsCompliance: false,
      nativeRuntimeValidationClaimed: false,
      schemaMigrationRequired: false,
      latestDatabaseMigration: 77
    });
  }

  public verifySnapshot(value: unknown): value is ApplicationSecurityProfileBoundarySnapshot {
    if (!plainRecord(value) || !exactKeys(value, [
      'schemaVersion', 'status', 'gateVersion', 'enforcement', 'defaultDecision',
      'canonicalApplicationCount', 'mappedApplicationCount', 'assuranceProfileCount',
      'threatModelCount', 'mobileMasvsApplicationCount', 'asvsVersion', 'masvsVersion',
      'ssdfVersion', 'newApplicationWithoutMappingDenied', 'threatModelHashRequired',
      'workspaceOwnerCoverageRequired', 'mappingClaimsCompliance', 'nativeRuntimeValidationClaimed',
      'schemaMigrationRequired', 'latestDatabaseMigration'
    ])) return false;
    const snapshot = value as unknown as ApplicationSecurityProfileBoundarySnapshot;
    return snapshot.schemaVersion === 1
      && snapshot.status === 'build-mapping-verified'
      && snapshot.gateVersion === APPLICATION_SECURITY_PROFILE_GATE_VERSION
      && snapshot.enforcement === 'fail-closed'
      && snapshot.defaultDecision === 'DENY'
      && snapshot.canonicalApplicationCount === 14
      && snapshot.mappedApplicationCount === 14
      && snapshot.assuranceProfileCount === 2
      && snapshot.threatModelCount === 14
      && snapshot.mobileMasvsApplicationCount === 4
      && snapshot.asvsVersion === APPLICATION_SECURITY_STANDARD_VERSIONS.asvs
      && snapshot.masvsVersion === APPLICATION_SECURITY_STANDARD_VERSIONS.masvs
      && snapshot.ssdfVersion === APPLICATION_SECURITY_STANDARD_VERSIONS.ssdf
      && snapshot.newApplicationWithoutMappingDenied === true
      && snapshot.threatModelHashRequired === true
      && snapshot.workspaceOwnerCoverageRequired === true
      && snapshot.mappingClaimsCompliance === false
      && snapshot.nativeRuntimeValidationClaimed === false
      && snapshot.schemaMigrationRequired === false
      && snapshot.latestDatabaseMigration === 77;
  }

  #decision(
    allowed: boolean,
    reason: ApplicationSecurityProfileDenialReason,
    applicationId: PlatformApplicationId | null,
    assuranceProfileId: ApplicationSecurityAssuranceProfileId | null
  ): ApplicationSecurityProfileDecision {
    return Object.freeze({
      allowed,
      reason,
      applicationId,
      assuranceProfileId,
      mappingClaimsCompliance: false,
      grantsRuntimeAuthority: false
    });
  }
}

export { GENERAL_NA_REASON as APPLICATION_SECURITY_MASVS_NOT_APPLICABLE_REASON };
