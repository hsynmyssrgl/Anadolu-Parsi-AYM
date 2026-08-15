import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  SUPPLY_CHAIN_ALLOWED_CANDIDATE_BLOCKERS,
  SUPPLY_CHAIN_EVIDENCE_MAX_FUTURE_SKEW_MS,
  SUPPLY_CHAIN_NPM_REGISTRY_TRUST_MODEL,
  SUPPLY_CHAIN_VULNERABILITY_MAX_AGE_MS,
  SupplyChainReleasePolicy,
  SupplyChainReleasePolicyError,
  isExactSupplyChainCandidateBlockerSet,
  type SupplyChainReleaseEvidence,
  type SupplyChainReleasePolicyOptions
} from './src/supply-chain-release-policy.js';
import {
  createSupplyChainReleasePolicyOptions,
  validatePpk025LocalGateReports
} from '../../scripts/lib/ppk025-software-supply-chain.mjs';

const NOW = '2026-08-12T08:00:00.000Z';
const ROOT_LOCK = '1'.repeat(64);
const PACKAGER_LOCK = '2'.repeat(64);
const SBOM = '3'.repeat(64);
const NOTICES_JSON = '4'.repeat(64);
const NOTICES_TEXT = '5'.repeat(64);
const ASSET_MANIFEST = '6'.repeat(64);
const INSTALLER = '7'.repeat(64);
const EXECUTABLE = '8'.repeat(64);
const SOURCE_COMMIT = '9'.repeat(40);
const SOURCE_TREE = 'a'.repeat(40);
const THUMBPRINT = 'B'.repeat(40);
const CERTIFICATE_SHA256 = 'c'.repeat(64);
const OBSERVED_AT = '2026-08-12T07:00:00.000Z';
const EXPIRES_AT = '2026-08-12T09:00:00.000Z';
const provenanceKeyPair = generateKeyPairSync('ed25519');
const provenancePublicKeyPem = provenanceKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
};

const signedProvenance = (subject: SupplyChainReleaseEvidence['provenance']['subject']): SupplyChainReleaseEvidence['provenance'] => {
  const payloadType = 'application/vnd.in-toto+json' as const;
  const payloadBytes = Buffer.from(canonicalize(subject), 'utf8');
  const pae = Buffer.concat([
    Buffer.from(`DSSEv1 ${Buffer.byteLength(payloadType)} ${payloadType} ${payloadBytes.length} `, 'utf8'),
    payloadBytes
  ]);
  return {
    envelope: 'DSSE',
    algorithm: 'Ed25519',
    trustedKeyId: 'release-key-2026',
    signatureCount: 1,
    payloadType,
    payload: payloadBytes.toString('base64'),
    signature: sign(null, pae, provenanceKeyPair.privateKey).toString('base64'),
    subject
  };
};

const materials = Object.freeze({
  rootPackageLockSha256: ROOT_LOCK,
  windowsPackagerLockSha256: PACKAGER_LOCK,
  sbomSha256: SBOM,
  thirdPartyNoticesJsonSha256: NOTICES_JSON,
  thirdPartyNoticesTextSha256: NOTICES_TEXT,
  licenseGateSha256: '7'.repeat(64),
  vulnerabilityGateSha256: '8'.repeat(64),
  registrySignatureGateSha256: '9'.repeat(64),
  externalAssetManifestSha256: ASSET_MANIFEST,
  externalAssetVerificationSha256: 'a'.repeat(64),
  buildToolchainSecuritySha256: 'b'.repeat(64)
});

const externalAssets = Object.freeze([
  { id: 'electron', version: '43.2.0', source: 'https://github.com/electron/electron/releases/download/v43.2.0/electron.zip', sha256: 'b'.repeat(64) },
  { id: '7zip', version: '1.0.0', source: 'https://github.com/electron-userland/electron-builder-binaries/releases/download/7zip@1.0.0/7zip-win-x64.tar.gz', sha256: '1'.repeat(64) },
  { id: 'nsis', version: '3.0.4.1', source: 'https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis/nsis.7z', sha256: 'c'.repeat(64) },
  { id: 'nsis-resources', version: '3.4.1', source: 'https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-resources/nsis-resources.7z', sha256: 'd'.repeat(64) },
  { id: 'winCodeSign', version: '2.6.0', source: 'https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign/winCodeSign.7z', sha256: 'e'.repeat(64) }
] as const);

const options = (): SupplyChainReleasePolicyOptions => ({
  expectedRelease: {
    version: '4.8.2026-29',
    channel: 'Bronze',
    releaseId: 'anadolu-parsi-aym-bronze-4.8.2026-29',
    sourceCommitId: SOURCE_COMMIT,
    sourceTreeId: SOURCE_TREE
  },
  expectedMaterials: materials,
  expectedCoverage: {
    workspaceCount: 18,
    sbomComponentCount: 417,
    dependencyNodeCount: 417,
    externalRegistryPackageCount: 377,
    licenseInventoryComponentCount: 358
  },
  expectedExternalAssets: externalAssets,
  trustedProvenanceKeys: [{ keyId: 'release-key-2026', publicKeyPem: provenancePublicKeyPem, status: 'ACTIVE' }],
  expectedPublisherSubject: 'CN=Panthera pardus tulliana',
  allowedCertificateThumbprints: [THUMBPRINT],
  allowedCertificateSha256: [CERTIFICATE_SHA256],
  registrySignatureTrustModel: SUPPLY_CHAIN_NPM_REGISTRY_TRUST_MODEL,
  localGateEvidenceVerified: true,
  clock: () => new Date(NOW)
});

const authenticode = (sha256: string) => ({
  status: 'Valid' as const,
  sha256,
  publisherSubject: 'CN=Panthera pardus tulliana',
  certificateThumbprint: THUMBPRINT,
  certificateSha256: CERTIFICATE_SHA256,
  codeSigningEku: true,
  trustedChain: true,
  trustedTimestamp: true,
  selfSigned: false,
  testCertificate: false
});

const evidence = (): SupplyChainReleaseEvidence => {
  const release = { ...options().expectedRelease };
  const coverage = { ...options().expectedCoverage };
  const vulnerabilities = [
    { scope: 'root-production' as const, status: 'PASS' as const, lockfileSha256: ROOT_LOCK, sbomSha256: SBOM, rawResponseSha256: 'f'.repeat(64), totalFindings: 0, observedAt: OBSERVED_AT, expiresAt: EXPIRES_AT },
    { scope: 'root-build-toolchain' as const, status: 'PASS' as const, lockfileSha256: ROOT_LOCK, sbomSha256: SBOM, rawResponseSha256: '0'.repeat(64), totalFindings: 0, observedAt: OBSERVED_AT, expiresAt: EXPIRES_AT },
    { scope: 'windows-packager' as const, status: 'PASS' as const, lockfileSha256: PACKAGER_LOCK, sbomSha256: SBOM, rawResponseSha256: 'a'.repeat(64), totalFindings: 0, observedAt: OBSERVED_AT, expiresAt: EXPIRES_AT }
  ];
  const registrySignatures = [
    { scope: 'root' as const, status: 'PASS' as const, lockfileSha256: ROOT_LOCK, sbomSha256: SBOM, invalidCount: 0, missingCount: 0, trustModel: SUPPLY_CHAIN_NPM_REGISTRY_TRUST_MODEL, verifiedByNpmCli: true as const, observedAt: OBSERVED_AT, expiresAt: EXPIRES_AT },
    { scope: 'windows-packager' as const, status: 'PASS' as const, lockfileSha256: PACKAGER_LOCK, sbomSha256: SBOM, invalidCount: 0, missingCount: 0, trustModel: SUPPLY_CHAIN_NPM_REGISTRY_TRUST_MODEL, verifiedByNpmCli: true as const, observedAt: OBSERVED_AT, expiresAt: EXPIRES_AT }
  ];
  const authenticodeEvidence = {
    signatureReportSha256: 'd'.repeat(64),
    productionCertificateProvisionedExternally: true,
    installer: authenticode(INSTALLER),
    mainExecutable: authenticode(EXECUTABLE)
  };
  const subject = {
    schemaVersion: 1 as const,
    release,
    materials: { ...materials },
    coverage,
    vulnerabilities,
    registrySignatures,
    externalAssets: externalAssets.map((asset) => ({ ...asset })),
    authenticode: authenticodeEvidence
  };
  return {
    schemaVersion: 1,
    release,
    materials: { ...materials },
    coverage,
    vulnerabilities,
    registrySignatures,
    externalAssets: subject.externalAssets,
    provenance: signedProvenance(subject),
    authenticode: authenticodeEvidence
  };
};

const resign = (candidate: SupplyChainReleaseEvidence): SupplyChainReleaseEvidence => {
  candidate.provenance = signedProvenance({
    schemaVersion: 1,
    release: candidate.release,
    materials: candidate.materials,
    coverage: candidate.coverage,
    vulnerabilities: candidate.vulnerabilities,
    registrySignatures: candidate.registrySignatures,
    externalAssets: candidate.externalAssets,
    authenticode: candidate.authenticode
  });
  return candidate;
};

const changed = (mutate: (candidate: SupplyChainReleaseEvidence) => void): SupplyChainReleaseEvidence => {
  const candidate = structuredClone(evidence());
  mutate(candidate);
  return candidate;
};

const changedAndResigned = (mutate: (candidate: SupplyChainReleaseEvidence) => void): SupplyChainReleaseEvidence =>
  resign(changed(mutate));

describe('32-U PPK-025 supply-chain release policy', () => {
  it('allows only an exactly covered, signed and trusted release fixture', () => {
    const policy = new SupplyChainReleasePolicy(options());
    const decision = policy.evaluate(evidence());
    expect(decision).toMatchObject({
      allowed: true,
      status: 'RELEASE_ELIGIBLE',
      reasons: ['ALLOW_VERIFIED_RELEASE'],
      releaseAuthority: 'external-signed-release-gate',
      checksumAloneGrantsReleaseAuthority: false,
      selfSignedCertificateGrantsProductionAuthority: false
    });
    expect(decision.evidenceSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(() => policy.assertReleaseEligible(decision)).not.toThrow();
  });

  it.each([
    ['missing SBOM material', (value: SupplyChainReleaseEvidence) => { delete (value.materials as unknown as Record<string, unknown>).sbomSha256; }, 'EVIDENCE_MALFORMED'],
    ['duplicate/unexpected SBOM coverage', (value: SupplyChainReleaseEvidence) => { (value.coverage as { sbomComponentCount: number }).sbomComponentCount += 1; }, 'SBOM_COVERAGE_MISMATCH'],
    ['root lock mismatch', (value: SupplyChainReleaseEvidence) => { (value.materials as { rootPackageLockSha256: string }).rootPackageLockSha256 = '0'.repeat(64); }, 'MATERIAL_HASH_MISMATCH'],
    ['windows packager lock mismatch', (value: SupplyChainReleaseEvidence) => { (value.materials as { windowsPackagerLockSha256: string }).windowsPackagerLockSha256 = '0'.repeat(64); }, 'MATERIAL_HASH_MISMATCH'],
    ['unknown license component', (value: SupplyChainReleaseEvidence) => { (value.coverage as { licenseInventoryComponentCount: number }).licenseInventoryComponentCount += 1; }, 'LICENSE_COVERAGE_MISMATCH'],
    ['missing license component', (value: SupplyChainReleaseEvidence) => { (value.coverage as { licenseInventoryComponentCount: number }).licenseInventoryComponentCount -= 1; }, 'LICENSE_COVERAGE_MISMATCH'],
    ['missing notices hash', (value: SupplyChainReleaseEvidence) => { delete (value.materials as unknown as Record<string, unknown>).thirdPartyNoticesTextSha256; }, 'EVIDENCE_MALFORMED']
  ] as const)('denies %s', (_name, mutate, reason) => {
    expect(new SupplyChainReleasePolicy(options()).evaluate(changed(mutate))).toMatchObject({
      allowed: false,
      status: 'BLOCKED',
      reasons: expect.arrayContaining([reason])
    });
  });

  it('denies missing, duplicate and unavailable vulnerability coverage', () => {
    const policy = new SupplyChainReleasePolicy(options());
    expect(policy.evaluate(changed((value) => { value.vulnerabilities.splice(0, 1); })).reasons)
      .toContain('VULNERABILITY_SCOPE_MISSING');
    expect(policy.evaluate(changed((value) => { value.vulnerabilities.push({ ...value.vulnerabilities[0]! }); })).reasons)
      .toContain('VULNERABILITY_SCOPE_MISSING');
    expect(policy.evaluate(changed((value) => {
      (value.vulnerabilities[0] as { status: 'PASS' | 'FAIL' }).status = 'FAIL';
    })).reasons).toContain('VULNERABILITY_FINDING_PRESENT');
  });

  it('denies any vulnerability finding and lock/SBOM coverage drift', () => {
    const policy = new SupplyChainReleasePolicy(options());
    expect(policy.evaluate(changed((value) => {
      (value.vulnerabilities[1] as { totalFindings: number }).totalFindings = 1;
    })).reasons).toContain('VULNERABILITY_FINDING_PRESENT');
    expect(policy.evaluate(changed((value) => {
      (value.vulnerabilities[2] as { lockfileSha256: string }).lockfileSha256 = ROOT_LOCK;
    })).reasons).toContain('VULNERABILITY_EVIDENCE_MISMATCH');
  });

  it('accepts the exact vulnerability age boundary and denies one millisecond beyond it', () => {
    const atBoundary = new Date(Date.parse(NOW) - SUPPLY_CHAIN_VULNERABILITY_MAX_AGE_MS).toISOString();
    const accepted = changedAndResigned((value) => {
      for (const item of value.vulnerabilities) {
        (item as { observedAt: string }).observedAt = atBoundary;
        (item as { expiresAt: string }).expiresAt = NOW;
      }
    });
    expect(new SupplyChainReleasePolicy(options()).evaluate(accepted).allowed).toBe(true);

    const stale = changed((value) => {
      const item = value.vulnerabilities[0]! as { observedAt: string; expiresAt: string };
      item.observedAt = new Date(Date.parse(NOW) - SUPPLY_CHAIN_VULNERABILITY_MAX_AGE_MS - 1).toISOString();
      item.expiresAt = NOW;
    });
    expect(new SupplyChainReleasePolicy(options()).evaluate(stale).reasons)
      .toContain('VULNERABILITY_EVIDENCE_STALE');
  });

  it('accepts the exact future skew boundary and denies one millisecond beyond it', () => {
    const atBoundary = new Date(Date.parse(NOW) + SUPPLY_CHAIN_EVIDENCE_MAX_FUTURE_SKEW_MS).toISOString();
    const accepted = changedAndResigned((value) => {
      (value.vulnerabilities[0] as { observedAt: string; expiresAt: string }).observedAt = atBoundary;
      (value.vulnerabilities[0] as { observedAt: string; expiresAt: string }).expiresAt = new Date(Date.parse(atBoundary) + 60_000).toISOString();
    });
    expect(new SupplyChainReleasePolicy(options()).evaluate(accepted).allowed).toBe(true);

    const future = changed((value) => {
      const item = value.vulnerabilities[0]! as { observedAt: string; expiresAt: string };
      item.observedAt = new Date(Date.parse(NOW) + SUPPLY_CHAIN_EVIDENCE_MAX_FUTURE_SKEW_MS + 1).toISOString();
      item.expiresAt = new Date(Date.parse(item.observedAt) + 60_000).toISOString();
    });
    expect(new SupplyChainReleasePolicy(options()).evaluate(future).reasons)
      .toContain('VULNERABILITY_EVIDENCE_FROM_FUTURE');
  });

  it('denies expired vulnerability evidence', () => {
    expect(new SupplyChainReleasePolicy(options()).evaluate(changed((value) => {
      const item = value.vulnerabilities[0]! as { expiresAt: string };
      item.expiresAt = '2026-08-12T07:59:59.999Z';
    })).reasons).toContain('VULNERABILITY_EVIDENCE_EXPIRED');
  });

  it('denies missing, invalid and lock-mismatched registry signature evidence', () => {
    const policy = new SupplyChainReleasePolicy(options());
    expect(policy.evaluate(changed((value) => { value.registrySignatures.splice(0, 1); })).reasons)
      .toContain('REGISTRY_SIGNATURE_SCOPE_MISSING');
    expect(policy.evaluate(changed((value) => {
      const item = value.registrySignatures[0]! as { status: 'PASS' | 'FAIL'; invalidCount: number };
      item.status = 'FAIL';
      item.invalidCount = 1;
    })).reasons).toContain('REGISTRY_SIGNATURE_EVIDENCE_INVALID');
    expect(policy.evaluate(changed((value) => {
      (value.registrySignatures[1] as { lockfileSha256: string }).lockfileSha256 = ROOT_LOCK;
    })).reasons).toContain('REGISTRY_SIGNATURE_EVIDENCE_INVALID');
  });

  it('denies a missing asset pin and an exact pin mismatch', () => {
    const policy = new SupplyChainReleasePolicy(options());
    expect(policy.evaluate(changed((value) => { value.externalAssets.splice(2, 1); })).reasons)
      .toContain('EXTERNAL_ASSET_MISSING');
    expect(policy.evaluate(changed((value) => {
      (value.externalAssets[0] as { sha256: string }).sha256 = '0'.repeat(64);
    })).reasons).toContain('EXTERNAL_ASSET_MISMATCH');
  });

  it('denies provenance tampering, an untrusted key and an invalid attestation signature', () => {
    const policy = new SupplyChainReleasePolicy(options());
    expect(policy.evaluate(changed((value) => {
      (value.provenance.subject.materials as { sbomSha256: string }).sbomSha256 = '0'.repeat(64);
    })).reasons).toContain('PROVENANCE_SUBJECT_MISMATCH');
    expect(policy.evaluate(changed((value) => {
      (value.provenance as { trustedKeyId: string }).trustedKeyId = 'attacker-key';
    })).reasons).toContain('PROVENANCE_KEY_UNTRUSTED');
    expect(policy.evaluate(changed((value) => {
      (value.provenance as { signature: string }).signature = Buffer.alloc(64).toString('base64');
    })).reasons).toContain('PROVENANCE_SIGNATURE_INVALID');
  });

  it.each([
    ['unsigned installer', (value: SupplyChainReleaseEvidence) => { (value.authenticode.installer as { status: 'NotSigned' }).status = 'NotSigned'; }, 'AUTHENTICODE_STATUS_INVALID'],
    ['invalid executable', (value: SupplyChainReleaseEvidence) => { (value.authenticode.mainExecutable as { status: 'HashMismatch' }).status = 'HashMismatch'; }, 'AUTHENTICODE_STATUS_INVALID'],
    ['wrong publisher', (value: SupplyChainReleaseEvidence) => { (value.authenticode.installer as { publisherSubject: string }).publisherSubject = 'CN=Attacker'; }, 'AUTHENTICODE_PUBLISHER_MISMATCH'],
    ['missing timestamp', (value: SupplyChainReleaseEvidence) => { (value.authenticode.installer as { trustedTimestamp: boolean }).trustedTimestamp = false; }, 'AUTHENTICODE_TIMESTAMP_MISSING'],
    ['self-signed production certificate', (value: SupplyChainReleaseEvidence) => { (value.authenticode.mainExecutable as { selfSigned: boolean }).selfSigned = true; }, 'SELF_SIGNED_OR_TEST_CERTIFICATE_REJECTED'],
    ['test production certificate', (value: SupplyChainReleaseEvidence) => { (value.authenticode.mainExecutable as { testCertificate: boolean }).testCertificate = true; }, 'SELF_SIGNED_OR_TEST_CERTIFICATE_REJECTED'],
    ['untrusted certificate thumbprint', (value: SupplyChainReleaseEvidence) => { (value.authenticode.installer as { certificateThumbprint: string }).certificateThumbprint = 'C'.repeat(40); }, 'AUTHENTICODE_CERTIFICATE_UNTRUSTED'],
    ['untrusted certificate SHA-256 pin', (value: SupplyChainReleaseEvidence) => { (value.authenticode.installer as { certificateSha256: string }).certificateSha256 = 'd'.repeat(64); }, 'AUTHENTICODE_CERTIFICATE_UNTRUSTED']
  ] as const)('denies %s', (_name, mutate, reason) => {
    expect(new SupplyChainReleasePolicy(options()).evaluate(changed(mutate)).reasons)
      .toContain(reason);
  });

  it('denies absent external production certificate provisioning', () => {
    expect(new SupplyChainReleasePolicy(options()).evaluate(changed((value) => {
      (value.authenticode as { productionCertificateProvisionedExternally: boolean }).productionCertificateProvisionedExternally = false;
    })).reasons).toContain('PRODUCTION_CERTIFICATE_NOT_PROVISIONED');
  });

  it('denies forged outer evidence that is not covered by the signed DSSE statement', () => {
    const forged = changed((value) => {
      (value.authenticode as { signatureReportSha256: string }).signatureReportSha256 = 'e'.repeat(64);
    });
    const decision = new SupplyChainReleasePolicy(options()).evaluate(forged);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('PROVENANCE_SUBJECT_MISMATCH');
  });

  it('derives expected release, materials, coverage and assets from trusted inputs instead of candidate evidence', () => {
    const independentlyDerived = createSupplyChainReleasePolicyOptions({
      policy: {
        release: options().expectedRelease,
        lockfiles: [{ scope: 'root', workspaceCount: 18 }],
        requiredSbomComponentCount: 417,
        requiredDependencyNodeCount: 417,
        requiredRegistryPackageCount: 377,
        requiredLicenseComponentCount: 358,
        vulnerability: {
          maxAgeMs: SUPPLY_CHAIN_VULNERABILITY_MAX_AGE_MS,
          maxFutureSkewMs: SUPPLY_CHAIN_EVIDENCE_MAX_FUTURE_SKEW_MS
        }
      },
      trust: {
        provenanceTrust: { trustedKeys: [{ keyId: 'release-key-2026', publicKeyPem: provenancePublicKeyPem, status: 'ACTIVE' }] },
        production: {
          expectedPublisherSubject: 'CN=Panthera pardus tulliana',
          allowedLeafCertificateThumbprints: [THUMBPRINT],
          allowedLeafCertificateSha256: [CERTIFICATE_SHA256]
        }
      },
      sourceIdentity: { sourceCommitId: SOURCE_COMMIT, sourceTreeId: SOURCE_TREE },
      currentMaterials: materials,
      externalAssetManifest: { assets: externalAssets },
      localGateEvidenceVerified: true,
      clock: () => new Date(NOW)
    });
    const forged = changedAndResigned((value) => {
      (value.coverage as { sbomComponentCount: number }).sbomComponentCount = 999;
      (value.release as { releaseId: string }).releaseId = 'attacker-controlled-release';
      (value.externalAssets[0] as { sha256: string }).sha256 = '0'.repeat(64);
    });
    const decision = new SupplyChainReleasePolicy(independentlyDerived).evaluate(forged);
    expect(independentlyDerived.expectedCoverage.sbomComponentCount).toBe(417);
    expect(independentlyDerived.expectedRelease.releaseId).toBe('anadolu-parsi-aym-bronze-4.8.2026-29');
    expect(independentlyDerived.expectedExternalAssets[0]?.sha256).toBe('b'.repeat(64));
    expect(decision.reasons).toEqual(expect.arrayContaining([
      'RELEASE_IDENTITY_MISMATCH',
      'SBOM_COVERAGE_MISMATCH',
      'EXTERNAL_ASSET_MISMATCH'
    ]));
  });

  it('denies production eligibility when current local gate validation is false', () => {
    const decision = new SupplyChainReleasePolicy({ ...options(), localGateEvidenceVerified: false }).evaluate(evidence());
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('LOCAL_GATE_EVIDENCE_INVALID');
  });

  it('rejects FAIL and stale local gate reports', () => {
    const freshDetails = (scope: string, lockfileSha256: string) => ({
      scope,
      status: 'PASS',
      commandExitCode: 0,
      lockfileSha256,
      sbomSha256: SBOM,
      vulnerabilities: { total: 0 },
      findingPackageCount: 0,
      findings: [],
      invalidCount: 0,
      missingCount: 0,
      invalid: [],
      missing: [],
      observedAt: OBSERVED_AT,
      expiresAt: EXPIRES_AT
    });
    const reports = {
      sbom: {
        status: 'FAIL', failed: 1, failures: ['FORGED_FAIL'], sbomSha256: SBOM,
        lockfiles: [{ scope: 'root', sha256: ROOT_LOCK }, { scope: 'windows-packager', sha256: PACKAGER_LOCK }]
      },
      license: {
        status: 'PASS', failed: 0, failures: [], sbomSha256: SBOM,
        noticesJsonSha256: NOTICES_JSON, noticesTextSha256: NOTICES_TEXT,
        licenseInventoryComponentCount: 358
      },
      vulnerability: { status: 'PASS', failed: 0, failures: [], sbomSha256: SBOM },
      registry: { status: 'PASS', failed: 0, failures: [] },
      externalAssets: {
        status: 'PASS', failed: 0, failures: [], manifestSha256: ASSET_MANIFEST,
        assetCount: externalAssets.length, assets: externalAssets
      },
      buildToolchain: {
        status: 'PASS', failed: 0, failures: [], packageVersion: '4.8.2026-29',
        generatedAt: '2026-08-10T00:00:00.000Z'
      },
      vulnerabilityDetails: [
        freshDetails('root-production', ROOT_LOCK),
        freshDetails('root-build-toolchain', ROOT_LOCK),
        freshDetails('windows-packager', PACKAGER_LOCK)
      ],
      registryDetails: [
        freshDetails('root', ROOT_LOCK),
        freshDetails('windows-packager', PACKAGER_LOCK)
      ]
    };
    const assessment = validatePpk025LocalGateReports({
      policy: {
        release: { version: '4.8.2026-29' },
        requiredLicenseComponentCount: 358,
        vulnerability: {
          scopes: ['root-production', 'root-build-toolchain', 'windows-packager'],
          maxAgeMs: SUPPLY_CHAIN_VULNERABILITY_MAX_AGE_MS,
          maxFutureSkewMs: SUPPLY_CHAIN_EVIDENCE_MAX_FUTURE_SKEW_MS
        },
        registrySignature: { scopes: ['root', 'windows-packager'] }
      },
      materials,
      externalAssetManifest: { assets: externalAssets },
      reports,
      now: new Date(NOW)
    });
    expect(assessment.valid).toBe(false);
    expect(assessment.failures).toEqual(expect.arrayContaining([
      'SBOM_GATE_NOT_PASS',
      'BUILD_TOOLCHAIN_GATE_STALE'
    ]));
  });

  it('accepts only the exact seven bounded candidate blockers and rejects any unexpected blocker', () => {
    expect(isExactSupplyChainCandidateBlockerSet(SUPPLY_CHAIN_ALLOWED_CANDIDATE_BLOCKERS)).toBe(true);
    expect(isExactSupplyChainCandidateBlockerSet([
      ...SUPPLY_CHAIN_ALLOWED_CANDIDATE_BLOCKERS,
      'LOCAL_GATE_EVIDENCE_INVALID'
    ])).toBe(false);
    expect(isExactSupplyChainCandidateBlockerSet(SUPPLY_CHAIN_ALLOWED_CANDIDATE_BLOCKERS.slice(1))).toBe(false);
  });

  it('rejects a broad waiver field instead of widening the exact evidence contract', () => {
    const wildcard = String.fromCharCode(42);
    const value = { ...evidence(), waivers: [{ component: wildcard, reason: 'all', approver: wildcard, expiresAt: '2099-01-01T00:00:00.000Z' }] };
    expect(new SupplyChainReleasePolicy(options()).evaluate(value)).toMatchObject({
      allowed: false,
      reasons: ['EVIDENCE_MALFORMED'],
      evidenceSha256: null
    });
  });

  it('publishes and verifies only a content-free snapshot', () => {
    const policy = new SupplyChainReleasePolicy(options());
    const snapshot = policy.snapshot(policy.evaluate(evidence()));
    expect(policy.verifySnapshot(snapshot)).toBe(true);
    expect(snapshot).toMatchObject({
      status: 'RELEASE_ELIGIBLE',
      releaseEligible: true,
      blockingReasonCount: 0,
      requiredLockfileCount: 2,
      requiredVulnerabilityScopeCount: 3,
      requiredRegistrySignatureScopeCount: 2,
      requiredExternalAssetCount: 5,
      installerAndMainExecutableAuthenticodeRequired: true,
      componentNamesExposed: false,
      vulnerabilityIdentifiersExposed: false,
      hashesExposed: false,
      certificateDetailsExposed: false,
      schemaMigrationRequired: false,
      latestDatabaseMigration: 77
    });
    expect(snapshot).not.toHaveProperty('evidenceSha256');
    expect(policy.verifySnapshot({ ...snapshot, hashesExposed: true })).toBe(false);
  });

  it('throws the exact fail-closed error for a blocked decision', () => {
    const policy = new SupplyChainReleasePolicy(options());
    expect(() => policy.assertReleaseEligible(policy.evaluate(undefined))).toThrowError(
      expect.objectContaining<Partial<SupplyChainReleasePolicyError>>({ code: 'SUPPLY_CHAIN_RELEASE_DENIED' })
    );
  });
});
