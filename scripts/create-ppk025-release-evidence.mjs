import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  canonicalJson,
  createSupplyChainReleasePolicyOptions,
  PPK025_NPM_REGISTRY_TRUST_MODEL,
  prettyCanonicalJson,
  sha256Bytes,
  signDsseEnvelope,
  validatePpk025LocalGateReports
} from './lib/ppk025-software-supply-chain.mjs';

const candidateMode = process.argv.includes('--candidate');
const root = resolve('.');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const hashFile = async (path) => sha256Bytes(await readFile(path));
const git = (...args) => {
  const execution = spawnSync('C:\\Program Files\\Git\\cmd\\git.exe', ['-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', ...args], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (execution.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${execution.stderr}`);
  return execution.stdout.trim();
};
const sourceCommitId = git('rev-parse', 'HEAD');
const sourceTreeId = git('rev-parse', 'HEAD^{tree}');
const sourceWorktreeClean = git('status', '--short') === '';
const paths = {
  sbom: 'artifacts/manifests/32-U-ppk-025-cyclonedx-sbom.json',
  noticesJson: 'artifacts/manifests/32-U-ppk-025-third-party-notices.json',
  noticesText: 'artifacts/manifests/32-U-ppk-025-third-party-notices.txt',
  externalAssets: 'config/32-u-ppk-025-external-build-assets.json',
  sbomVerification: 'artifacts/validation/32-U-ppk-025-sbom-verification.json',
  licenseGate: 'artifacts/validation/32-U-ppk-025-license-verification.json',
  vulnerabilityGate: 'artifacts/validation/32-U-ppk-025-vulnerability-gate.json',
  registryGate: 'artifacts/validation/32-U-ppk-025-registry-signature-gate.json',
  externalAssetGate: 'artifacts/validation/32-U-ppk-025-external-build-assets.json',
  buildToolchainGate: 'artifacts/validation/32-U-ppk-025-build-toolchain-security.json',
  signature: 'artifacts/validation/32-U-ppk-025-windows-signature.json',
  output: 'artifacts/validation/32-U-ppk-025-release-evidence.json',
  decision: 'artifacts/validation/32-U-ppk-025-release-decision.json'
};
const [
  policyConfig, trust, sbom, notices, externalAssets,
  sbomVerification, licenseGate, vulnerabilityGate, registryGate, externalAssetGate, buildToolchainGate,
  vulnerabilityReports, registryReports
] = await Promise.all([
  readJson('config/32-u-ppk-025-software-supply-chain-policy.json'),
  readJson('config/32-u-ppk-025-signing-trust-policy.json'),
  readJson(paths.sbom),
  readJson(paths.noticesJson),
  readJson(paths.externalAssets),
  readJson(paths.sbomVerification),
  readJson(paths.licenseGate),
  readJson(paths.vulnerabilityGate),
  readJson(paths.registryGate),
  readJson(paths.externalAssetGate),
  readJson(paths.buildToolchainGate),
  Promise.all([
    readJson('artifacts/validation/32-U-ppk-025-root-production-vulnerability.json'),
    readJson('artifacts/validation/32-U-ppk-025-root-build-vulnerability.json'),
    readJson('artifacts/validation/32-U-ppk-025-windows-packager-vulnerability.json')
  ]),
  Promise.all([
    readJson('artifacts/validation/32-U-ppk-025-root-registry-signatures.json'),
    readJson('artifacts/validation/32-U-ppk-025-windows-packager-registry-signatures.json')
  ])
]);
let signatureReport;
let signatureReportBytes;
try {
  signatureReportBytes = await readFile(paths.signature);
  signatureReport = JSON.parse(signatureReportBytes.toString('utf8'));
}
catch {
  signatureReport = {
    status: 'BLOCKED',
    productionConfigurationReady: false,
    installer: { authenticodeStatus: 'NotSigned', sha256: '0'.repeat(64), signerSubject: '', signerThumbprint: '', checks: {} },
    applicationExecutable: { authenticodeStatus: 'NotSigned', sha256: '0'.repeat(64), signerSubject: '', signerThumbprint: '', checks: {} }
  };
}
const materials = {
  rootPackageLockSha256: await hashFile('package-lock.json'),
  windowsPackagerLockSha256: await hashFile('tools/windows-packager/package-lock.json'),
  sbomSha256: await hashFile(paths.sbom),
  thirdPartyNoticesJsonSha256: await hashFile(paths.noticesJson),
  thirdPartyNoticesTextSha256: await hashFile(paths.noticesText),
  licenseGateSha256: await hashFile(paths.licenseGate),
  vulnerabilityGateSha256: await hashFile(paths.vulnerabilityGate),
  registrySignatureGateSha256: await hashFile(paths.registryGate),
  externalAssetManifestSha256: await hashFile(paths.externalAssets),
  externalAssetVerificationSha256: await hashFile(paths.externalAssetGate),
  buildToolchainSecuritySha256: await hashFile(paths.buildToolchainGate)
};
const localGateAssessment = validatePpk025LocalGateReports({
  policy: policyConfig,
  materials,
  externalAssetManifest: externalAssets,
  reports: {
    sbom: sbomVerification,
    license: licenseGate,
    vulnerability: vulnerabilityGate,
    registry: registryGate,
    externalAssets: externalAssetGate,
    buildToolchain: buildToolchainGate,
    vulnerabilityDetails: vulnerabilityReports,
    registryDetails: registryReports
  }
});
const mapAuthenticode = (record) => ({
  status: ['Valid', 'NotSigned', 'HashMismatch', 'NotTrusted', 'UnknownError'].includes(record?.authenticodeStatus) ? record.authenticodeStatus : 'UnknownError',
  sha256: /^[a-f0-9]{64}$/u.test(String(record?.sha256 ?? '')) ? record.sha256 : '0'.repeat(64),
  publisherSubject: String(record?.signerSubject ?? ''),
  certificateThumbprint: String(record?.signerThumbprint ?? '').replaceAll(/[^A-Fa-f0-9]/gu, '').toUpperCase(),
  certificateSha256: String(record?.signerCertificateSha256 ?? '').toLowerCase(),
  codeSigningEku: record?.checks?.codeSigningEkuPresent === true,
  trustedChain: record?.checks?.statusValid === true,
  trustedTimestamp: record?.checks?.trustedTimestampPresent === true,
  selfSigned: record?.selfSigned === true,
  testCertificate: record?.checks?.testFixtureNotProduction === false
});
const installer = mapAuthenticode(signatureReport.installer);
const mainExecutable = mapAuthenticode(signatureReport.applicationExecutable);
const release = {
  version: policyConfig.release.version,
  channel: policyConfig.release.channel,
  releaseId: policyConfig.release.releaseId,
  sourceCommitId,
  sourceTreeId
};
const coverage = {
  workspaceCount: policyConfig.lockfiles.find((item) => item.scope === 'root').workspaceCount,
  sbomComponentCount: sbom.components.length,
  dependencyNodeCount: sbom.dependencies.length,
  externalRegistryPackageCount: policyConfig.requiredRegistryPackageCount,
  licenseInventoryComponentCount: notices.entries.length
};
const vulnerabilities = vulnerabilityReports.map((item) => ({
  scope: item.scope,
  status: item.status,
  lockfileSha256: item.lockfileSha256,
  sbomSha256: item.sbomSha256,
  rawResponseSha256: item.rawResponseSha256,
  totalFindings: item.vulnerabilities.total,
  observedAt: item.observedAt,
  expiresAt: item.expiresAt
}));
const registrySignatures = registryReports.map((item) => ({
  scope: item.scope,
  status: item.status,
  lockfileSha256: item.lockfileSha256,
  sbomSha256: item.sbomSha256,
  invalidCount: item.invalidCount,
  missingCount: item.missingCount,
  trustModel: PPK025_NPM_REGISTRY_TRUST_MODEL,
  verifiedByNpmCli: true,
  observedAt: item.observedAt,
  expiresAt: item.expiresAt
}));
const pinnedExternalAssets = externalAssets.assets.map(({ id, version, source, sha256 }) => ({ id, version, source, sha256 }));
const authenticode = {
  signatureReportSha256: sha256Bytes(signatureReportBytes ?? Buffer.from(prettyCanonicalJson(signatureReport), 'utf8')),
  productionCertificateProvisionedExternally: signatureReport.productionConfigurationReady === true,
  installer,
  mainExecutable
};
const subject = {
  schemaVersion: 1,
  release,
  materials,
  coverage,
  vulnerabilities,
  registrySignatures,
  externalAssets: pinnedExternalAssets,
  authenticode
};
const payloadType = 'application/vnd.in-toto+json';
const privateKeyBase64 = process.env.PPK025_PROVENANCE_PRIVATE_KEY_PEM_BASE64;
const requestedKeyId = process.env.PPK025_PROVENANCE_KEY_ID;
const envelope = privateKeyBase64 && requestedKeyId
  ? signDsseEnvelope({ payloadType, statement: subject, keyId: requestedKeyId, privateKey: Buffer.from(privateKeyBase64, 'base64').toString('utf8') })
  : { payloadType, payload: Buffer.from(canonicalJson(subject), 'utf8').toString('base64'), signatures: [{ keyid: 'UNPROVISIONED', sig: 'AA==' }] };
const evidence = {
  schemaVersion: 1,
  release,
  materials,
  coverage,
  vulnerabilities,
  registrySignatures,
  externalAssets: pinnedExternalAssets,
  provenance: {
    envelope: 'DSSE',
    algorithm: 'Ed25519',
    trustedKeyId: envelope.signatures[0].keyid,
    signatureCount: envelope.signatures.length,
    payloadType: envelope.payloadType,
    payload: envelope.payload,
    signature: envelope.signatures[0].sig,
    subject
  },
  authenticode
};
await mkdir(dirname(resolve(paths.output)), { recursive: true });
await writeFile(paths.output, prettyCanonicalJson(evidence));

const {
  SupplyChainReleasePolicy,
  isExactSupplyChainCandidateBlockerSet
} = await import('../packages/platform-policy/dist/index.js');
const evaluator = new SupplyChainReleasePolicy(createSupplyChainReleasePolicyOptions({
  policy: policyConfig,
  trust,
  sourceIdentity: { sourceCommitId, sourceTreeId },
  currentMaterials: materials,
  externalAssetManifest: externalAssets,
  localGateEvidenceVerified: localGateAssessment.valid
}));
const decision = evaluator.evaluate(evidence);
const report = {
  schemaVersion: 1,
  step: '32-U',
  requirement: 'PPK-025',
  mode: candidateMode ? 'CANDIDATE' : 'PRODUCTION_RELEASE',
  status: decision.status,
  releaseEligible: decision.allowed,
  reasons: decision.reasons,
  evidenceSha256: await hashFile(paths.output),
  sourceCommitId,
  sourceTreeId,
  sourceWorktreeClean,
  localGateEvidenceVerified: localGateAssessment.valid,
  localGateFailures: localGateAssessment.failures,
  privateSigningMaterialPersisted: false,
  generatedAt: new Date().toISOString()
};
await writeFile(paths.decision, prettyCanonicalJson(report));
const candidatePassed = candidateMode
  && localGateAssessment.valid
  && decision.status === 'BLOCKED'
  && decision.allowed === false
  && isExactSupplyChainCandidateBlockerSet(decision.reasons);
const productionPassed = !candidateMode && sourceWorktreeClean && decision.status === 'RELEASE_ELIGIBLE' && decision.allowed === true;
console.log(`PPK-025 ${candidateMode ? 'candidate' : 'production'} release decision: ${decision.status} (${decision.reasons.join(', ')}).`);
if (!(candidatePassed || productionPassed)) process.exitCode = 1;
