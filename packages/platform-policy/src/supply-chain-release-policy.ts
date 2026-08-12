import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';

export const SUPPLY_CHAIN_RELEASE_POLICY_VERSION = 'PPK-025-V1' as const;
export const SUPPLY_CHAIN_VULNERABILITY_MAX_AGE_MS = 86_400_000;
export const SUPPLY_CHAIN_EVIDENCE_MAX_FUTURE_SKEW_MS = 300_000;
export const SUPPLY_CHAIN_REQUIRED_VULNERABILITY_SCOPES = Object.freeze([
  'root-production',
  'root-build-toolchain',
  'windows-packager'
] as const);
export const SUPPLY_CHAIN_REQUIRED_REGISTRY_SIGNATURE_SCOPES = Object.freeze([
  'root',
  'windows-packager'
] as const);
export const SUPPLY_CHAIN_REQUIRED_EXTERNAL_ASSET_IDS = Object.freeze([
  'electron',
  '7zip',
  'nsis',
  'nsis-resources',
  'winCodeSign'
] as const);

export type SupplyChainVulnerabilityScope = typeof SUPPLY_CHAIN_REQUIRED_VULNERABILITY_SCOPES[number];
export type SupplyChainRegistrySignatureScope = typeof SUPPLY_CHAIN_REQUIRED_REGISTRY_SIGNATURE_SCOPES[number];
export type SupplyChainExternalAssetId = typeof SUPPLY_CHAIN_REQUIRED_EXTERNAL_ASSET_IDS[number];
export type SupplyChainReleaseStatus = 'RELEASE_ELIGIBLE' | 'BLOCKED';
export const SUPPLY_CHAIN_NPM_REGISTRY_TRUST_MODEL = 'npm-cli-managed-registry-keys' as const;
export const SUPPLY_CHAIN_ALLOWED_CANDIDATE_BLOCKERS = Object.freeze([
  'AUTHENTICODE_ARTIFACT_MISSING',
  'AUTHENTICODE_CERTIFICATE_UNTRUSTED',
  'AUTHENTICODE_STATUS_INVALID',
  'AUTHENTICODE_TIMESTAMP_MISSING',
  'PRODUCTION_CERTIFICATE_NOT_PROVISIONED',
  'PROVENANCE_KEY_UNTRUSTED',
  'PROVENANCE_SIGNATURE_INVALID'
] as const);
export type SupplyChainReleaseDenialReason =
  | 'ALLOW_VERIFIED_RELEASE'
  | 'EVIDENCE_MALFORMED'
  | 'RELEASE_IDENTITY_MISMATCH'
  | 'SOURCE_IDENTITY_MISMATCH'
  | 'MATERIAL_HASH_MISMATCH'
  | 'SBOM_COVERAGE_MISMATCH'
  | 'LICENSE_COVERAGE_MISMATCH'
  | 'VULNERABILITY_SCOPE_MISSING'
  | 'VULNERABILITY_EVIDENCE_STALE'
  | 'VULNERABILITY_EVIDENCE_FROM_FUTURE'
  | 'VULNERABILITY_EVIDENCE_EXPIRED'
  | 'VULNERABILITY_EVIDENCE_MISMATCH'
  | 'VULNERABILITY_FINDING_PRESENT'
  | 'REGISTRY_SIGNATURE_SCOPE_MISSING'
  | 'REGISTRY_SIGNATURE_EVIDENCE_INVALID'
  | 'LOCAL_GATE_EVIDENCE_INVALID'
  | 'EXTERNAL_ASSET_MISSING'
  | 'EXTERNAL_ASSET_MISMATCH'
  | 'PROVENANCE_SIGNATURE_INVALID'
  | 'PROVENANCE_KEY_UNTRUSTED'
  | 'PROVENANCE_SUBJECT_MISMATCH'
  | 'PRODUCTION_CERTIFICATE_NOT_PROVISIONED'
  | 'AUTHENTICODE_ARTIFACT_MISSING'
  | 'AUTHENTICODE_STATUS_INVALID'
  | 'AUTHENTICODE_PUBLISHER_MISMATCH'
  | 'AUTHENTICODE_CERTIFICATE_UNTRUSTED'
  | 'AUTHENTICODE_TIMESTAMP_MISSING'
  | 'SELF_SIGNED_OR_TEST_CERTIFICATE_REJECTED';

export interface SupplyChainMaterialHashes {
  readonly rootPackageLockSha256: string;
  readonly windowsPackagerLockSha256: string;
  readonly sbomSha256: string;
  readonly thirdPartyNoticesJsonSha256: string;
  readonly thirdPartyNoticesTextSha256: string;
  readonly licenseGateSha256: string;
  readonly vulnerabilityGateSha256: string;
  readonly registrySignatureGateSha256: string;
  readonly externalAssetManifestSha256: string;
  readonly externalAssetVerificationSha256: string;
  readonly buildToolchainSecuritySha256: string;
}

export interface SupplyChainReleaseEvidence {
  readonly schemaVersion: 1;
  readonly release: {
    readonly version: string;
    readonly channel: string;
    readonly releaseId: string;
    readonly sourceCommitId: string;
    readonly sourceTreeId: string;
  };
  readonly materials: SupplyChainMaterialHashes;
  readonly coverage: {
    readonly workspaceCount: number;
    readonly sbomComponentCount: number;
    readonly dependencyNodeCount: number;
    readonly externalRegistryPackageCount: number;
    readonly licenseInventoryComponentCount: number;
  };
  readonly vulnerabilities: readonly {
    readonly scope: SupplyChainVulnerabilityScope;
    readonly status: 'PASS' | 'FAIL';
    readonly lockfileSha256: string;
    readonly sbomSha256: string;
    readonly rawResponseSha256: string;
    readonly totalFindings: number;
    readonly observedAt: string;
    readonly expiresAt: string;
  }[];
  readonly registrySignatures: readonly {
    readonly scope: SupplyChainRegistrySignatureScope;
    readonly status: 'PASS' | 'FAIL';
    readonly lockfileSha256: string;
    readonly sbomSha256: string;
    readonly invalidCount: number;
    readonly missingCount: number;
    readonly trustModel: typeof SUPPLY_CHAIN_NPM_REGISTRY_TRUST_MODEL;
    readonly verifiedByNpmCli: true;
    readonly observedAt: string;
    readonly expiresAt: string;
  }[];
  readonly externalAssets: readonly {
    readonly id: SupplyChainExternalAssetId;
    readonly version: string;
    readonly source: string;
    readonly sha256: string;
  }[];
  readonly provenance: {
    readonly envelope: 'DSSE';
    readonly algorithm: 'Ed25519';
    readonly trustedKeyId: string;
    readonly signatureCount: number;
    readonly payloadType: 'application/vnd.in-toto+json';
    readonly payload: string;
    readonly signature: string;
    readonly subject: SupplyChainSignedReleaseStatement;
  };
  readonly authenticode: {
    readonly signatureReportSha256: string;
    readonly productionCertificateProvisionedExternally: boolean;
    readonly installer: SupplyChainAuthenticodeEvidence;
    readonly mainExecutable: SupplyChainAuthenticodeEvidence;
  };
}

export interface SupplyChainSignedReleaseStatement {
  readonly schemaVersion: 1;
  readonly release: SupplyChainReleaseEvidence['release'];
  readonly materials: SupplyChainMaterialHashes;
  readonly coverage: SupplyChainReleaseEvidence['coverage'];
  readonly vulnerabilities: SupplyChainReleaseEvidence['vulnerabilities'];
  readonly registrySignatures: SupplyChainReleaseEvidence['registrySignatures'];
  readonly externalAssets: SupplyChainReleaseEvidence['externalAssets'];
  readonly authenticode: SupplyChainReleaseEvidence['authenticode'];
}

export interface SupplyChainAuthenticodeEvidence {
  readonly status: 'Valid' | 'NotSigned' | 'HashMismatch' | 'NotTrusted' | 'UnknownError';
  readonly sha256: string;
  readonly publisherSubject: string;
  readonly certificateThumbprint: string;
  readonly certificateSha256: string;
  readonly codeSigningEku: boolean;
  readonly trustedChain: boolean;
  readonly trustedTimestamp: boolean;
  readonly selfSigned: boolean;
  readonly testCertificate: boolean;
}

export interface SupplyChainReleasePolicyOptions {
  readonly expectedRelease: {
    readonly version: string;
    readonly channel: string;
    readonly releaseId: string;
    readonly sourceCommitId: string;
    readonly sourceTreeId: string;
  };
  readonly expectedMaterials: SupplyChainMaterialHashes;
  readonly expectedCoverage: {
    readonly workspaceCount: number;
    readonly sbomComponentCount: number;
    readonly dependencyNodeCount: number;
    readonly externalRegistryPackageCount: number;
    readonly licenseInventoryComponentCount: number;
  };
  readonly expectedExternalAssets: readonly {
    readonly id: SupplyChainExternalAssetId;
    readonly version: string;
    readonly source: string;
    readonly sha256: string;
  }[];
  readonly trustedProvenanceKeys: readonly {
    readonly keyId: string;
    readonly publicKeyPem: string;
    readonly status: 'ACTIVE' | 'RETIRED';
  }[];
  readonly expectedPublisherSubject: string;
  readonly allowedCertificateThumbprints: readonly string[];
  readonly allowedCertificateSha256: readonly string[];
  readonly registrySignatureTrustModel: typeof SUPPLY_CHAIN_NPM_REGISTRY_TRUST_MODEL;
  readonly localGateEvidenceVerified: boolean;
  readonly clock?: () => Date;
  readonly vulnerabilityMaximumAgeMs?: number;
  readonly maximumFutureSkewMs?: number;
}

export interface SupplyChainReleaseDecision {
  readonly allowed: boolean;
  readonly status: SupplyChainReleaseStatus;
  readonly reasons: readonly SupplyChainReleaseDenialReason[];
  readonly evidenceSha256: string | null;
  readonly releaseAuthority: 'external-signed-release-gate';
  readonly checksumAloneGrantsReleaseAuthority: false;
  readonly selfSignedCertificateGrantsProductionAuthority: false;
}

export interface SupplyChainReleaseBoundarySnapshot {
  readonly schemaVersion: 1;
  readonly status: SupplyChainReleaseStatus;
  readonly gateVersion: typeof SUPPLY_CHAIN_RELEASE_POLICY_VERSION;
  readonly releaseEligible: boolean;
  readonly blockingReasonCount: number;
  readonly defaultDecision: 'DENY';
  readonly enforcement: 'fail-closed';
  readonly requiredLockfileCount: 2;
  readonly requiredVulnerabilityScopeCount: 3;
  readonly requiredRegistrySignatureScopeCount: 2;
  readonly requiredExternalAssetCount: 5;
  readonly installerAndMainExecutableAuthenticodeRequired: true;
  readonly productionCertificateExternal: true;
  readonly componentNamesExposed: false;
  readonly vulnerabilityIdentifiersExposed: false;
  readonly hashesExposed: false;
  readonly certificateDetailsExposed: false;
  readonly schemaMigrationRequired: false;
  readonly latestDatabaseMigration: 77;
}

export class SupplyChainReleasePolicyError extends Error {
  public readonly code: 'SUPPLY_CHAIN_RELEASE_DENIED' | 'SUPPLY_CHAIN_SNAPSHOT_INVALID';

  public constructor(code: 'SUPPLY_CHAIN_RELEASE_DENIED' | 'SUPPLY_CHAIN_SNAPSHOT_INVALID', message: string) {
    super(message);
    this.code = code;
    this.name = 'SupplyChainReleasePolicyError';
  }
}

const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_OBJECT_ID = /^[a-f0-9]{40}$/u;
const THUMBPRINT = /^[A-F0-9]{40,128}$/u;
const plainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length && actual.every((key, index) => key === canonical[index]);
};
const canonicalize = (value: unknown): string => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('SUPPLY_CHAIN_NON_FINITE_NUMBER');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (!plainRecord(value)) throw new TypeError('SUPPLY_CHAIN_UNSUPPORTED_VALUE');
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
};
const sameRecord = (left: unknown, right: unknown): boolean => {
  try { return canonicalize(left) === canonicalize(right); } catch { return false; }
};
const validIso = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const validHashRecord = (value: unknown): value is unknown & SupplyChainMaterialHashes => plainRecord(value)
  && exactKeys(value, ['rootPackageLockSha256', 'windowsPackagerLockSha256', 'sbomSha256', 'thirdPartyNoticesJsonSha256', 'thirdPartyNoticesTextSha256', 'licenseGateSha256', 'vulnerabilityGateSha256', 'registrySignatureGateSha256', 'externalAssetManifestSha256', 'externalAssetVerificationSha256', 'buildToolchainSecuritySha256'])
  && Object.values(value).every((item) => typeof item === 'string' && SHA256.test(item));
const uniqueExactScopes = <T extends string>(actual: readonly T[], expected: readonly T[]): boolean =>
  actual.length === expected.length && new Set(actual).size === actual.length && expected.every((item) => actual.includes(item));
const dssePreAuthEncoding = (payloadType: string, payload: Uint8Array): Buffer => Buffer.concat([
  Buffer.from(`DSSEv1 ${Buffer.byteLength(payloadType)} ${payloadType} ${payload.length} `, 'utf8'),
  Buffer.from(payload)
]);

export class SupplyChainReleasePolicy {
  readonly #options: Required<Omit<SupplyChainReleasePolicyOptions, 'clock' | 'vulnerabilityMaximumAgeMs' | 'maximumFutureSkewMs'>> & {
    readonly clock: () => Date;
    readonly vulnerabilityMaximumAgeMs: number;
    readonly maximumFutureSkewMs: number;
  };

  public constructor(options: SupplyChainReleasePolicyOptions) {
    this.#options = {
      ...options,
      expectedExternalAssets: [...options.expectedExternalAssets],
      trustedProvenanceKeys: options.trustedProvenanceKeys.map((item) => ({ ...item })),
      allowedCertificateThumbprints: options.allowedCertificateThumbprints.map((value) => value.toUpperCase()),
      allowedCertificateSha256: options.allowedCertificateSha256.map((value) => value.toLowerCase()),
      clock: options.clock ?? (() => new Date()),
      vulnerabilityMaximumAgeMs: options.vulnerabilityMaximumAgeMs ?? SUPPLY_CHAIN_VULNERABILITY_MAX_AGE_MS,
      maximumFutureSkewMs: options.maximumFutureSkewMs ?? SUPPLY_CHAIN_EVIDENCE_MAX_FUTURE_SKEW_MS
    };
  }

  public evaluate(value: unknown): SupplyChainReleaseDecision {
    const reasons = new Set<SupplyChainReleaseDenialReason>();
    if (!this.#validEvidenceShape(value)) return this.#decision(['EVIDENCE_MALFORMED'], null);
    const evidence = value as unknown as SupplyChainReleaseEvidence;
    if (!this.#options.localGateEvidenceVerified) reasons.add('LOCAL_GATE_EVIDENCE_INVALID');
    if (
      evidence.release.version !== this.#options.expectedRelease.version
      || evidence.release.channel !== this.#options.expectedRelease.channel
      || evidence.release.releaseId !== this.#options.expectedRelease.releaseId
    ) reasons.add('RELEASE_IDENTITY_MISMATCH');
    if (
      evidence.release.sourceCommitId !== this.#options.expectedRelease.sourceCommitId
      || evidence.release.sourceTreeId !== this.#options.expectedRelease.sourceTreeId
    ) reasons.add('SOURCE_IDENTITY_MISMATCH');
    if (!sameRecord(evidence.materials, this.#options.expectedMaterials)) reasons.add('MATERIAL_HASH_MISMATCH');
    const expectedCoverage = this.#options.expectedCoverage;
    if (
      evidence.coverage.workspaceCount !== expectedCoverage.workspaceCount
      || evidence.coverage.sbomComponentCount !== expectedCoverage.sbomComponentCount
      || evidence.coverage.dependencyNodeCount !== expectedCoverage.dependencyNodeCount
      || evidence.coverage.externalRegistryPackageCount !== expectedCoverage.externalRegistryPackageCount
    ) reasons.add('SBOM_COVERAGE_MISMATCH');
    if (evidence.coverage.licenseInventoryComponentCount !== expectedCoverage.licenseInventoryComponentCount) reasons.add('LICENSE_COVERAGE_MISMATCH');
    this.#evaluateVulnerabilities(evidence, reasons);
    this.#evaluateRegistrySignatures(evidence, reasons);
    this.#evaluateExternalAssets(evidence, reasons);
    this.#evaluateProvenance(evidence, reasons);
    this.#evaluateAuthenticode(evidence, reasons);
    return reasons.size === 0
      ? this.#decision(['ALLOW_VERIFIED_RELEASE'], evidence)
      : this.#decision([...reasons].sort(), evidence);
  }

  public assertReleaseEligible(decision: SupplyChainReleaseDecision): void {
    if (!decision.allowed || decision.status !== 'RELEASE_ELIGIBLE' || decision.reasons.length !== 1 || decision.reasons[0] !== 'ALLOW_VERIFIED_RELEASE') {
      throw new SupplyChainReleasePolicyError('SUPPLY_CHAIN_RELEASE_DENIED', `SUPPLY_CHAIN_RELEASE_DENIED:${decision.reasons.join(',')}`);
    }
  }

  public snapshot(decision: SupplyChainReleaseDecision): SupplyChainReleaseBoundarySnapshot {
    return Object.freeze({
      schemaVersion: 1,
      status: decision.status,
      gateVersion: SUPPLY_CHAIN_RELEASE_POLICY_VERSION,
      releaseEligible: decision.allowed,
      blockingReasonCount: decision.allowed ? 0 : decision.reasons.length,
      defaultDecision: 'DENY',
      enforcement: 'fail-closed',
      requiredLockfileCount: 2,
      requiredVulnerabilityScopeCount: 3,
      requiredRegistrySignatureScopeCount: 2,
      requiredExternalAssetCount: 5,
      installerAndMainExecutableAuthenticodeRequired: true,
      productionCertificateExternal: true,
      componentNamesExposed: false,
      vulnerabilityIdentifiersExposed: false,
      hashesExposed: false,
      certificateDetailsExposed: false,
      schemaMigrationRequired: false,
      latestDatabaseMigration: 77
    });
  }

  public verifySnapshot(value: unknown): value is SupplyChainReleaseBoundarySnapshot {
    if (!plainRecord(value) || !exactKeys(value, [
      'schemaVersion', 'status', 'gateVersion', 'releaseEligible', 'blockingReasonCount', 'defaultDecision', 'enforcement',
      'requiredLockfileCount', 'requiredVulnerabilityScopeCount', 'requiredRegistrySignatureScopeCount', 'requiredExternalAssetCount',
      'installerAndMainExecutableAuthenticodeRequired', 'productionCertificateExternal', 'componentNamesExposed',
      'vulnerabilityIdentifiersExposed', 'hashesExposed', 'certificateDetailsExposed', 'schemaMigrationRequired', 'latestDatabaseMigration'
    ])) return false;
    return value.schemaVersion === 1
      && (value.status === 'RELEASE_ELIGIBLE' || value.status === 'BLOCKED')
      && value.gateVersion === SUPPLY_CHAIN_RELEASE_POLICY_VERSION
      && value.releaseEligible === (value.status === 'RELEASE_ELIGIBLE')
      && Number.isInteger(value.blockingReasonCount) && Number(value.blockingReasonCount) >= 0
      && (value.releaseEligible ? value.blockingReasonCount === 0 : Number(value.blockingReasonCount) > 0)
      && value.defaultDecision === 'DENY' && value.enforcement === 'fail-closed'
      && value.requiredLockfileCount === 2 && value.requiredVulnerabilityScopeCount === 3
      && value.requiredRegistrySignatureScopeCount === 2 && value.requiredExternalAssetCount === 5
      && value.installerAndMainExecutableAuthenticodeRequired === true && value.productionCertificateExternal === true
      && value.componentNamesExposed === false && value.vulnerabilityIdentifiersExposed === false
      && value.hashesExposed === false && value.certificateDetailsExposed === false
      && value.schemaMigrationRequired === false && value.latestDatabaseMigration === 77;
  }

  #evaluateVulnerabilities(evidence: SupplyChainReleaseEvidence, reasons: Set<SupplyChainReleaseDenialReason>): void {
    const scopes = evidence.vulnerabilities.map((item) => item.scope);
    if (!uniqueExactScopes(scopes, SUPPLY_CHAIN_REQUIRED_VULNERABILITY_SCOPES)) {
      reasons.add('VULNERABILITY_SCOPE_MISSING');
      return;
    }
    const now = this.#options.clock().getTime();
    for (const item of evidence.vulnerabilities) {
      const observedAt = Date.parse(item.observedAt);
      const expiresAt = Date.parse(item.expiresAt);
      const ageMs = now - observedAt;
      if (ageMs < -this.#options.maximumFutureSkewMs) reasons.add('VULNERABILITY_EVIDENCE_FROM_FUTURE');
      if (ageMs > this.#options.vulnerabilityMaximumAgeMs) reasons.add('VULNERABILITY_EVIDENCE_STALE');
      if (expiresAt < now || expiresAt <= observedAt || expiresAt - observedAt > this.#options.vulnerabilityMaximumAgeMs) reasons.add('VULNERABILITY_EVIDENCE_EXPIRED');
      const expectedLockHash = item.scope === 'windows-packager'
        ? evidence.materials.windowsPackagerLockSha256
        : evidence.materials.rootPackageLockSha256;
      if (item.lockfileSha256 !== expectedLockHash || item.sbomSha256 !== evidence.materials.sbomSha256) reasons.add('VULNERABILITY_EVIDENCE_MISMATCH');
      if (item.status !== 'PASS' || item.totalFindings !== 0) reasons.add('VULNERABILITY_FINDING_PRESENT');
    }
  }

  #evaluateRegistrySignatures(evidence: SupplyChainReleaseEvidence, reasons: Set<SupplyChainReleaseDenialReason>): void {
    const scopes = evidence.registrySignatures.map((item) => item.scope);
    if (!uniqueExactScopes(scopes, SUPPLY_CHAIN_REQUIRED_REGISTRY_SIGNATURE_SCOPES)) {
      reasons.add('REGISTRY_SIGNATURE_SCOPE_MISSING');
      return;
    }
    const now = this.#options.clock().getTime();
    for (const item of evidence.registrySignatures) {
      const expectedLockHash = item.scope === 'windows-packager'
        ? evidence.materials.windowsPackagerLockSha256
        : evidence.materials.rootPackageLockSha256;
      const observedAt = Date.parse(item.observedAt);
      const expiresAt = Date.parse(item.expiresAt);
      if (
        item.status !== 'PASS' || item.invalidCount !== 0 || item.missingCount !== 0
        || item.trustModel !== SUPPLY_CHAIN_NPM_REGISTRY_TRUST_MODEL
        || item.trustModel !== this.#options.registrySignatureTrustModel
        || item.verifiedByNpmCli !== true
        || item.lockfileSha256 !== expectedLockHash || item.sbomSha256 !== evidence.materials.sbomSha256
        || now - observedAt < -this.#options.maximumFutureSkewMs
        || now - observedAt > this.#options.vulnerabilityMaximumAgeMs
        || expiresAt < now || expiresAt <= observedAt || expiresAt - observedAt > this.#options.vulnerabilityMaximumAgeMs
      ) reasons.add('REGISTRY_SIGNATURE_EVIDENCE_INVALID');
    }
  }

  #evaluateExternalAssets(evidence: SupplyChainReleaseEvidence, reasons: Set<SupplyChainReleaseDenialReason>): void {
    const ids = evidence.externalAssets.map((item) => item.id);
    if (!uniqueExactScopes(ids, SUPPLY_CHAIN_REQUIRED_EXTERNAL_ASSET_IDS)) {
      reasons.add('EXTERNAL_ASSET_MISSING');
      return;
    }
    for (const expected of this.#options.expectedExternalAssets) {
      const actual = evidence.externalAssets.find((item) => item.id === expected.id);
      if (!actual || !sameRecord(actual, expected)) reasons.add('EXTERNAL_ASSET_MISMATCH');
    }
  }

  #evaluateProvenance(evidence: SupplyChainReleaseEvidence, reasons: Set<SupplyChainReleaseDenialReason>): void {
    if (evidence.provenance.signatureCount !== 1) reasons.add('PROVENANCE_SIGNATURE_INVALID');
    const trustedKey = this.#options.trustedProvenanceKeys.find((item) => item.keyId === evidence.provenance.trustedKeyId && item.status === 'ACTIVE');
    if (!trustedKey) reasons.add('PROVENANCE_KEY_UNTRUSTED');
    const expectedSubject: SupplyChainSignedReleaseStatement = {
      schemaVersion: 1,
      release: evidence.release,
      materials: evidence.materials,
      coverage: evidence.coverage,
      vulnerabilities: evidence.vulnerabilities,
      registrySignatures: evidence.registrySignatures,
      externalAssets: evidence.externalAssets,
      authenticode: evidence.authenticode
    };
    if (!sameRecord(evidence.provenance.subject, expectedSubject)) reasons.add('PROVENANCE_SUBJECT_MISMATCH');
    try {
      const payload = Buffer.from(evidence.provenance.payload, 'base64');
      if (payload.toString('utf8') !== canonicalize(evidence.provenance.subject)) reasons.add('PROVENANCE_SUBJECT_MISMATCH');
      if (!trustedKey || !verifySignature(
        null,
        dssePreAuthEncoding(evidence.provenance.payloadType, payload),
        createPublicKey(trustedKey.publicKeyPem),
        Buffer.from(evidence.provenance.signature, 'base64')
      )) reasons.add('PROVENANCE_SIGNATURE_INVALID');
    } catch {
      reasons.add('PROVENANCE_SIGNATURE_INVALID');
    }
  }

  #evaluateAuthenticode(evidence: SupplyChainReleaseEvidence, reasons: Set<SupplyChainReleaseDenialReason>): void {
    if (!evidence.authenticode.productionCertificateProvisionedExternally) reasons.add('PRODUCTION_CERTIFICATE_NOT_PROVISIONED');
    for (const artifact of [evidence.authenticode.installer, evidence.authenticode.mainExecutable]) {
      if (!SHA256.test(artifact.sha256) || /^0{64}$/.test(artifact.sha256)) {
        reasons.add('AUTHENTICODE_ARTIFACT_MISSING');
      }
      if (artifact.status !== 'Valid') reasons.add('AUTHENTICODE_STATUS_INVALID');
      if (artifact.publisherSubject !== this.#options.expectedPublisherSubject) reasons.add('AUTHENTICODE_PUBLISHER_MISMATCH');
      if (!artifact.trustedChain || !artifact.codeSigningEku || !this.#options.allowedCertificateThumbprints.includes(artifact.certificateThumbprint.toUpperCase()) || !this.#options.allowedCertificateSha256.includes(artifact.certificateSha256.toLowerCase())) reasons.add('AUTHENTICODE_CERTIFICATE_UNTRUSTED');
      if (!artifact.trustedTimestamp) reasons.add('AUTHENTICODE_TIMESTAMP_MISSING');
      if (artifact.selfSigned || artifact.testCertificate) reasons.add('SELF_SIGNED_OR_TEST_CERTIFICATE_REJECTED');
    }
  }

  #validEvidenceShape(value: unknown): boolean {
    if (!plainRecord(value) || !exactKeys(value, ['schemaVersion', 'release', 'materials', 'coverage', 'vulnerabilities', 'registrySignatures', 'externalAssets', 'provenance', 'authenticode']) || value.schemaVersion !== 1) return false;
    if (!plainRecord(value.release) || !exactKeys(value.release, ['version', 'channel', 'releaseId', 'sourceCommitId', 'sourceTreeId'])) return false;
    if (![value.release.version, value.release.channel, value.release.releaseId].every((item) => typeof item === 'string' && item.length > 0)) return false;
    if (typeof value.release.sourceCommitId !== 'string' || !GIT_OBJECT_ID.test(value.release.sourceCommitId) || typeof value.release.sourceTreeId !== 'string' || !GIT_OBJECT_ID.test(value.release.sourceTreeId)) return false;
    if (!validHashRecord(value.materials)) return false;
    if (!plainRecord(value.coverage) || !exactKeys(value.coverage, ['workspaceCount', 'sbomComponentCount', 'dependencyNodeCount', 'externalRegistryPackageCount', 'licenseInventoryComponentCount']) || !Object.values(value.coverage).every((item) => Number.isInteger(item) && Number(item) >= 0)) return false;
    if (!Array.isArray(value.vulnerabilities) || !value.vulnerabilities.every((item) => plainRecord(item) && exactKeys(item, ['scope', 'status', 'lockfileSha256', 'sbomSha256', 'rawResponseSha256', 'totalFindings', 'observedAt', 'expiresAt']) && SUPPLY_CHAIN_REQUIRED_VULNERABILITY_SCOPES.includes(item.scope as SupplyChainVulnerabilityScope) && (item.status === 'PASS' || item.status === 'FAIL') && [item.lockfileSha256, item.sbomSha256, item.rawResponseSha256].every((hash) => typeof hash === 'string' && SHA256.test(hash)) && Number.isInteger(item.totalFindings) && Number(item.totalFindings) >= 0 && validIso(item.observedAt) && validIso(item.expiresAt))) return false;
    if (!Array.isArray(value.registrySignatures) || !value.registrySignatures.every((item) => plainRecord(item) && exactKeys(item, ['scope', 'status', 'lockfileSha256', 'sbomSha256', 'invalidCount', 'missingCount', 'trustModel', 'verifiedByNpmCli', 'observedAt', 'expiresAt']) && SUPPLY_CHAIN_REQUIRED_REGISTRY_SIGNATURE_SCOPES.includes(item.scope as SupplyChainRegistrySignatureScope) && (item.status === 'PASS' || item.status === 'FAIL') && [item.lockfileSha256, item.sbomSha256].every((hash) => typeof hash === 'string' && SHA256.test(hash)) && Number.isInteger(item.invalidCount) && Number(item.invalidCount) >= 0 && Number.isInteger(item.missingCount) && Number(item.missingCount) >= 0 && item.trustModel === SUPPLY_CHAIN_NPM_REGISTRY_TRUST_MODEL && item.verifiedByNpmCli === true && validIso(item.observedAt) && validIso(item.expiresAt))) return false;
    if (!Array.isArray(value.externalAssets) || !value.externalAssets.every((item) => plainRecord(item) && exactKeys(item, ['id', 'version', 'source', 'sha256']) && SUPPLY_CHAIN_REQUIRED_EXTERNAL_ASSET_IDS.includes(item.id as SupplyChainExternalAssetId) && typeof item.version === 'string' && item.version.length > 0 && typeof item.source === 'string' && /^https:\/\//u.test(item.source) && typeof item.sha256 === 'string' && SHA256.test(item.sha256))) return false;
    if (!plainRecord(value.provenance) || !exactKeys(value.provenance, ['envelope', 'algorithm', 'trustedKeyId', 'signatureCount', 'payloadType', 'payload', 'signature', 'subject']) || value.provenance.envelope !== 'DSSE' || value.provenance.algorithm !== 'Ed25519' || value.provenance.payloadType !== 'application/vnd.in-toto+json' || typeof value.provenance.trustedKeyId !== 'string' || !Number.isInteger(value.provenance.signatureCount) || typeof value.provenance.payload !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value.provenance.payload) || typeof value.provenance.signature !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value.provenance.signature) || !plainRecord(value.provenance.subject) || !exactKeys(value.provenance.subject, ['schemaVersion', 'release', 'materials', 'coverage', 'vulnerabilities', 'registrySignatures', 'externalAssets', 'authenticode']) || value.provenance.subject.schemaVersion !== 1) return false;
    if (!plainRecord(value.authenticode) || !exactKeys(value.authenticode, ['signatureReportSha256', 'productionCertificateProvisionedExternally', 'installer', 'mainExecutable']) || typeof value.authenticode.signatureReportSha256 !== 'string' || !SHA256.test(value.authenticode.signatureReportSha256) || typeof value.authenticode.productionCertificateProvisionedExternally !== 'boolean') return false;
    return this.#validAuthenticode(value.authenticode.installer) && this.#validAuthenticode(value.authenticode.mainExecutable);
  }

  #validAuthenticode(value: unknown): value is SupplyChainAuthenticodeEvidence {
    return plainRecord(value) && exactKeys(value, ['status', 'sha256', 'publisherSubject', 'certificateThumbprint', 'certificateSha256', 'codeSigningEku', 'trustedChain', 'trustedTimestamp', 'selfSigned', 'testCertificate'])
      && ['Valid', 'NotSigned', 'HashMismatch', 'NotTrusted', 'UnknownError'].includes(String(value.status))
      && typeof value.sha256 === 'string' && SHA256.test(value.sha256)
      && typeof value.publisherSubject === 'string'
      && typeof value.certificateThumbprint === 'string' && (value.certificateThumbprint === '' || THUMBPRINT.test(value.certificateThumbprint.toUpperCase()))
      && typeof value.certificateSha256 === 'string' && (value.certificateSha256 === '' || SHA256.test(value.certificateSha256.toLowerCase()))
      && [value.codeSigningEku, value.trustedChain, value.trustedTimestamp, value.selfSigned, value.testCertificate].every((item) => typeof item === 'boolean');
  }

  #decision(reasons: readonly SupplyChainReleaseDenialReason[], evidence: SupplyChainReleaseEvidence | null): SupplyChainReleaseDecision {
    const allowed = reasons.length === 1 && reasons[0] === 'ALLOW_VERIFIED_RELEASE';
    return Object.freeze({
      allowed,
      status: allowed ? 'RELEASE_ELIGIBLE' : 'BLOCKED',
      reasons: Object.freeze([...reasons]),
      evidenceSha256: evidence ? createHash('sha256').update(canonicalize(evidence), 'utf8').digest('hex') : null,
      releaseAuthority: 'external-signed-release-gate',
      checksumAloneGrantsReleaseAuthority: false,
      selfSignedCertificateGrantsProductionAuthority: false
    });
  }
}

export const isExactSupplyChainCandidateBlockerSet = (
  reasons: readonly SupplyChainReleaseDenialReason[]
): boolean => uniqueExactScopes(reasons, SUPPLY_CHAIN_ALLOWED_CANDIDATE_BLOCKERS);
