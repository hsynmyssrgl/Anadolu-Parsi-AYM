import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AuthorizeSupplyChainReleaseUseCase,
  EvaluateSupplyChainReleaseUseCase,
  GetSupplyChainReleaseBoundaryUseCase
} from '../src/supply-chain-release-use-cases.js';
import {
  SUPPLY_CHAIN_NPM_REGISTRY_TRUST_MODEL,
  SupplyChainReleasePolicy,
  type SupplyChainReleaseEvidence,
  type SupplyChainReleasePolicyOptions
} from '@ppt/platform-policy';

const NOW = '2026-08-12T08:00:00.000Z';
const hashes = {
  rootPackageLockSha256: '1'.repeat(64),
  windowsPackagerLockSha256: '2'.repeat(64),
  sbomSha256: '3'.repeat(64),
  thirdPartyNoticesJsonSha256: '4'.repeat(64),
  thirdPartyNoticesTextSha256: '5'.repeat(64),
  licenseGateSha256: '7'.repeat(64),
  vulnerabilityGateSha256: '8'.repeat(64),
  registrySignatureGateSha256: '9'.repeat(64),
  externalAssetManifestSha256: '6'.repeat(64),
  externalAssetVerificationSha256: 'a'.repeat(64),
  buildToolchainSecuritySha256: 'b'.repeat(64)
};
const commit = '7'.repeat(40);
const tree = '8'.repeat(40);
const installer = '9'.repeat(64);
const executable = 'a'.repeat(64);
const thumbprint = 'B'.repeat(40);
const certificateSha256 = 'c'.repeat(64);
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
  const pae = Buffer.concat([Buffer.from(`DSSEv1 ${Buffer.byteLength(payloadType)} ${payloadType} ${payloadBytes.length} `, 'utf8'), payloadBytes]);
  return {
    envelope: 'DSSE', algorithm: 'Ed25519', trustedKeyId: 'trusted-release-key', signatureCount: 1,
    payloadType, payload: payloadBytes.toString('base64'), signature: sign(null, pae, provenanceKeyPair.privateKey).toString('base64'), subject
  };
};
const assets = [
  { id: 'electron' as const, version: '43.2.0', source: 'https://example.invalid/electron', sha256: 'b'.repeat(64) },
  { id: '7zip' as const, version: '1.0.0', source: 'https://example.invalid/7zip', sha256: '1'.repeat(64) },
  { id: 'nsis' as const, version: '3.0.4.1', source: 'https://example.invalid/nsis', sha256: 'c'.repeat(64) },
  { id: 'nsis-resources' as const, version: '3.4.1', source: 'https://example.invalid/nsis-resources', sha256: 'd'.repeat(64) },
  { id: 'winCodeSign' as const, version: '2.6.0', source: 'https://example.invalid/win-code-sign', sha256: 'e'.repeat(64) }
];
const policyOptions = (): SupplyChainReleasePolicyOptions => ({
  expectedRelease: { version: '4.8.2026-29', channel: 'Bronze', releaseId: 'release-29', sourceCommitId: commit, sourceTreeId: tree },
  expectedMaterials: hashes,
  expectedCoverage: { workspaceCount: 18, sbomComponentCount: 414, dependencyNodeCount: 414, externalRegistryPackageCount: 374, licenseInventoryComponentCount: 357 },
  expectedExternalAssets: assets,
  trustedProvenanceKeys: [{ keyId: 'trusted-release-key', publicKeyPem: provenancePublicKeyPem, status: 'ACTIVE' }],
  expectedPublisherSubject: 'CN=Panthera pardus tulliana',
  allowedCertificateThumbprints: [thumbprint],
  allowedCertificateSha256: [certificateSha256],
  registrySignatureTrustModel: SUPPLY_CHAIN_NPM_REGISTRY_TRUST_MODEL,
  localGateEvidenceVerified: true,
  clock: () => new Date(NOW)
});
const signedArtifact = (sha256: string) => ({
  status: 'Valid' as const, sha256, publisherSubject: 'CN=Panthera pardus tulliana', certificateThumbprint: thumbprint, certificateSha256,
  codeSigningEku: true, trustedChain: true, trustedTimestamp: true, selfSigned: false, testCertificate: false
});
const validEvidence = (): SupplyChainReleaseEvidence => {
  const release = { ...policyOptions().expectedRelease };
  const coverage = { ...policyOptions().expectedCoverage };
  const vulnerabilities: SupplyChainReleaseEvidence['vulnerabilities'] = [
    { scope: 'root-production', status: 'PASS', lockfileSha256: hashes.rootPackageLockSha256, sbomSha256: hashes.sbomSha256, rawResponseSha256: '0'.repeat(64), totalFindings: 0, observedAt: '2026-08-12T07:00:00.000Z', expiresAt: '2026-08-12T09:00:00.000Z' },
    { scope: 'root-build-toolchain', status: 'PASS', lockfileSha256: hashes.rootPackageLockSha256, sbomSha256: hashes.sbomSha256, rawResponseSha256: '1'.repeat(64), totalFindings: 0, observedAt: '2026-08-12T07:00:00.000Z', expiresAt: '2026-08-12T09:00:00.000Z' },
    { scope: 'windows-packager', status: 'PASS', lockfileSha256: hashes.windowsPackagerLockSha256, sbomSha256: hashes.sbomSha256, rawResponseSha256: '2'.repeat(64), totalFindings: 0, observedAt: '2026-08-12T07:00:00.000Z', expiresAt: '2026-08-12T09:00:00.000Z' }
  ];
  const registrySignatures: SupplyChainReleaseEvidence['registrySignatures'] = [
    { scope: 'root', status: 'PASS', lockfileSha256: hashes.rootPackageLockSha256, sbomSha256: hashes.sbomSha256, invalidCount: 0, missingCount: 0, trustModel: SUPPLY_CHAIN_NPM_REGISTRY_TRUST_MODEL, verifiedByNpmCli: true, observedAt: '2026-08-12T07:00:00.000Z', expiresAt: '2026-08-12T09:00:00.000Z' },
    { scope: 'windows-packager', status: 'PASS', lockfileSha256: hashes.windowsPackagerLockSha256, sbomSha256: hashes.sbomSha256, invalidCount: 0, missingCount: 0, trustModel: SUPPLY_CHAIN_NPM_REGISTRY_TRUST_MODEL, verifiedByNpmCli: true, observedAt: '2026-08-12T07:00:00.000Z', expiresAt: '2026-08-12T09:00:00.000Z' }
  ];
  const authenticode: SupplyChainReleaseEvidence['authenticode'] = {
    signatureReportSha256: 'f'.repeat(64),
    productionCertificateProvisionedExternally: true,
    installer: signedArtifact(installer),
    mainExecutable: signedArtifact(executable)
  };
  const subject: SupplyChainReleaseEvidence['provenance']['subject'] = {
    schemaVersion: 1,
    release,
    materials: { ...hashes },
    coverage,
    vulnerabilities,
    registrySignatures,
    externalAssets: assets,
    authenticode
  };
  return {
    schemaVersion: 1,
    release,
    materials: { ...hashes },
    coverage,
    vulnerabilities,
    registrySignatures,
    externalAssets: assets,
    provenance: signedProvenance(subject),
    authenticode
  };
};

describe('32-U PPK-025 supply-chain release use cases', () => {
  it('evaluates valid evidence and invokes the release callback exactly once', async () => {
    const policy = new SupplyChainReleasePolicy(policyOptions());
    const evaluator = new EvaluateSupplyChainReleaseUseCase(policy, { load: async () => validEvidence() });
    const authorize = new AuthorizeSupplyChainReleaseUseCase(evaluator, policy);
    let callbacks = 0;
    await expect(authorize.execute(async (decision) => {
      callbacks += 1;
      expect(decision.reasons).toEqual(['ALLOW_VERIFIED_RELEASE']);
      return 'signed-release';
    })).resolves.toBe('signed-release');
    expect(callbacks).toBe(1);
  });

  it.each([
    ['missing evidence', async () => undefined],
    ['malformed evidence', async () => ({ schemaVersion: 1, waivers: [String.fromCharCode(42)] })],
    ['unavailable evidence port', async () => { throw new Error('feed unavailable'); }]
  ])('fails closed for %s and never calls the release callback', async (_name, load) => {
    const policy = new SupplyChainReleasePolicy(policyOptions());
    const evaluator = new EvaluateSupplyChainReleaseUseCase(policy, { load });
    const authorize = new AuthorizeSupplyChainReleaseUseCase(evaluator, policy);
    let callbacks = 0;
    await expect(authorize.execute(async () => { callbacks += 1; return 'must-not-run'; }))
      .rejects.toMatchObject({ code: 'SUPPLY_CHAIN_RELEASE_DENIED' });
    expect(callbacks).toBe(0);
  });

  it('blocks a tampered attestation before the callback', async () => {
    const policy = new SupplyChainReleasePolicy(policyOptions());
    const tampered = structuredClone(validEvidence());
    (tampered.provenance.subject.authenticode.installer as { sha256: string }).sha256 = 'e'.repeat(64);
    const authorize = new AuthorizeSupplyChainReleaseUseCase(
      new EvaluateSupplyChainReleaseUseCase(policy, { load: async () => tampered }),
      policy
    );
    let callbacks = 0;
    await expect(authorize.execute(async () => { callbacks += 1; return false; }))
      .rejects.toMatchObject({ code: 'SUPPLY_CHAIN_RELEASE_DENIED' });
    expect(callbacks).toBe(0);
  });

  it('requires the pinned 7zip asset together with all five external build assets before invoking the callback', async () => {
    const policy = new SupplyChainReleasePolicy(policyOptions());
    const missing7zip = structuredClone(validEvidence());
    const sevenZipIndex = missing7zip.externalAssets.findIndex((asset) => asset.id === '7zip');
    expect(sevenZipIndex).toBeGreaterThan(-1);
    missing7zip.externalAssets.splice(sevenZipIndex, 1);
    const evaluator = new EvaluateSupplyChainReleaseUseCase(policy, { load: async () => missing7zip });
    const decision = await evaluator.execute();
    expect(decision).toMatchObject({ allowed: false, status: 'BLOCKED' });
    expect(decision.reasons).toContain('EXTERNAL_ASSET_MISSING');

    let callbacks = 0;
    await expect(new AuthorizeSupplyChainReleaseUseCase(evaluator, policy).execute(async () => {
      callbacks += 1;
      return 'must-not-run';
    })).rejects.toMatchObject({ code: 'SUPPLY_CHAIN_RELEASE_DENIED' });
    expect(callbacks).toBe(0);
  });

  it('maps a content-free blocked boundary without granting release authority', async () => {
    const policy = new SupplyChainReleasePolicy(policyOptions());
    const evaluator = new EvaluateSupplyChainReleaseUseCase(policy, { load: async () => undefined });
    const view = await new GetSupplyChainReleaseBoundaryUseCase(evaluator, policy).execute();
    expect(view).toEqual({
      schemaVersion: 1,
      status: 'BLOCKED',
      releaseEligible: false,
      blockingReasonCount: 1,
      enforcement: 'fail-closed',
      requiredLockfileCount: 2,
      requiredVulnerabilityScopeCount: 3,
      requiredRegistrySignatureScopeCount: 2,
      requiredExternalAssetCount: 5,
      installerAndMainExecutableAuthenticodeRequired: true,
      productionCertificateExternal: true,
      detailsExposedToClient: false,
      grantsReleaseAuthority: false,
      schemaMigrationRequired: false,
      latestDatabaseMigration: 77
    });
    expect(view).not.toHaveProperty('hashes');
    expect(view).not.toHaveProperty('publisherSubject');
  });
});
