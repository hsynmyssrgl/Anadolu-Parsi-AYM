import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  signDsseEnvelope,
  verifyDsseEnvelope
} from './lib/ppk025-software-supply-chain.mjs';
import { scanSoftwareSupplyChainBoundary } from './verify-software-supply-chain-boundary.mjs';

const candidateMode = process.argv.includes('--candidate');
const readText = async (path) => {
  try { return await readFile(path, 'utf8'); }
  catch { return ''; }
};
const readBytes = async (path) => {
  try { return await readFile(path); }
  catch { return undefined; }
};
const readJson = async (path) => {
  const source = await readText(path);
  if (!source) return undefined;
  try { return JSON.parse(source.replace(/^\uFEFF/u, '')); }
  catch { return undefined; }
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const hashFile = async (path) => {
  const bytes = await readBytes(path);
  return bytes === undefined ? undefined : sha256(bytes);
};
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const exactArray = (actual, expected) => Array.isArray(actual)
  && actual.length === expected.length
  && expected.every((item, index) => actual[index] === item);
const exactSet = (actual, expected) => Array.isArray(actual)
  && actual.length === expected.length
  && new Set(actual).size === actual.length
  && expected.every((item) => actual.includes(item));
const sha256Pattern = /^[a-f0-9]{64}$/u;

const paths = {
  scope: 'config/32-u-ppk-025-software-supply-chain-scope.json',
  inventory: 'config/32-u-ppk-025-software-supply-chain-inventory.json',
  policy: 'config/32-u-ppk-025-software-supply-chain-policy.json',
  signing: 'config/32-u-ppk-025-signing-trust-policy.json',
  externalAssets: 'config/32-u-ppk-025-external-build-assets.json',
  sbom: 'artifacts/manifests/32-U-ppk-025-cyclonedx-sbom.json',
  noticesJson: 'artifacts/manifests/32-U-ppk-025-third-party-notices.json',
  noticesText: 'artifacts/manifests/32-U-ppk-025-third-party-notices.txt',
  licenseGate: 'artifacts/validation/32-U-ppk-025-license-verification.json',
  vulnerabilityGate: 'artifacts/validation/32-U-ppk-025-vulnerability-gate.json',
  registryGate: 'artifacts/validation/32-U-ppk-025-registry-signature-gate.json',
  externalAssetGate: 'artifacts/validation/32-U-ppk-025-external-build-assets.json',
  buildToolchainGate: 'artifacts/validation/32-U-ppk-025-build-toolchain-security.json',
  releaseEvidence: 'artifacts/validation/32-U-ppk-025-release-evidence.json',
  releaseDecision: 'artifacts/validation/32-U-ppk-025-release-decision.json',
  windowsSignature: 'artifacts/validation/32-U-ppk-025-windows-signature.json',
  contract: 'artifacts/validation/32-U-ppk-025-software-supply-chain-contract.json'
};

const [
  scope, inventory, policyConfig, signingTrust, externalAssetManifest, registry, ledger,
  rootPackage, desktopPackage, rootLock, packagerLock, sbom, notices, licenseGate,
  vulnerabilityGate, registryGate, externalAssetGate, buildToolchainGate, releaseEvidence,
  releaseDecision, windowsSignature, policySource, policyIndex, domainSource, domainIndex,
  useCaseSource, applicationIndex, policyTest, applicationTest, desktopTest, sourceGateSource,
  cryptoLibrary, sbomGenerator, sbomVerifier, licenseGenerator, licenseVerifier,
  vulnerabilityRunner, vulnerabilityVerifier, registryRunner, registryVerifier,
  externalAssetVerifier, releaseEvidenceCreator, signedWindowsBuilder, authenticodeVerifier,
  decisionDocument, threatModel, auditDocument, masterRegister, migrations
] = await Promise.all([
  readJson(paths.scope),
  readJson(paths.inventory),
  readJson(paths.policy),
  readJson(paths.signing),
  readJson(paths.externalAssets),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/user-decision-ledger.json'),
  readJson('package.json'),
  readJson('apps/desktop/package.json'),
  readJson('package-lock.json'),
  readJson('tools/windows-packager/package-lock.json'),
  readJson(paths.sbom),
  readJson(paths.noticesJson),
  readJson(paths.licenseGate),
  readJson(paths.vulnerabilityGate),
  readJson(paths.registryGate),
  readJson(paths.externalAssetGate),
  readJson(paths.buildToolchainGate),
  readJson(paths.releaseEvidence),
  readJson(paths.releaseDecision),
  readJson(paths.windowsSignature),
  readText('packages/platform-policy/src/supply-chain-release-policy.ts'),
  readText('packages/platform-policy/src/index.ts'),
  readText('packages/domain/src/supply-chain-release.ts'),
  readText('packages/domain/src/index.ts'),
  readText('packages/application/src/supply-chain-release-use-cases.ts'),
  readText('packages/application/src/index.ts'),
  readText('packages/platform-policy/supply-chain-release-policy.test.ts'),
  readText('packages/application/tests/supply-chain-release-use-cases.test.ts'),
  readText('apps/desktop/tests/ppk025-software-supply-chain-gates.test.ts'),
  readText('scripts/verify-software-supply-chain-boundary.mjs'),
  readText('scripts/lib/ppk025-software-supply-chain.mjs'),
  readText('scripts/generate-ppk025-sbom.mjs'),
  readText('scripts/verify-ppk025-sbom.mjs'),
  readText('scripts/generate-ppk025-third-party-notices.mjs'),
  readText('scripts/verify-ppk025-license-policy.mjs'),
  readText('scripts/run-npm-audit-evidence.mjs'),
  readText('scripts/verify-ppk025-vulnerability-gate.mjs'),
  readText('scripts/run-ppk025-registry-signature-gate.mjs'),
  readText('scripts/verify-ppk025-registry-signature-evidence.mjs'),
  readText('scripts/verify-ppk025-external-build-assets.mjs'),
  readText('scripts/create-ppk025-release-evidence.mjs'),
  readText('apps/desktop/scripts/build-signed-windows-release.mjs'),
  readText('scripts/verify-ppk025-windows-package-signature.ps1'),
  readText('docs/decisions/DEC-206-ppk-025-software-supply-chain-gates.md'),
  readText('docs/security/PPK-025_SOFTWARE_SUPPLY_CHAIN_THREAT_MODEL.md'),
  readText('docs/audit/32-U_PPK-025_SOFTWARE_SUPPLY_CHAIN_UST_KAPANIS.md'),
  readText('docs/10_MASTER_DECISION_REGISTER.md'),
  readText('packages/database/src/family-database-migrations.ts')
]);

const sourceScan = await scanSoftwareSupplyChainBoundary();
const failures = [];
const checks = [];
const check = (name, condition, detail) => {
  const passed = Boolean(condition);
  checks.push({ name, passed, ...(detail === undefined ? {} : { detail }) });
  if (!passed) failures.push(name);
};

const requirement = registry?.requirements?.find((item) => item.id === 'PPK-025');
const predecessor = registry?.requirements?.find((item) => item.id === 'PPK-024');
const successor = registry?.requirements?.find((item) => item.id === 'PPK-026');
const decisionEntry = ledger?.decisions?.find((item) => item.id === 'DEC-206');
const rootPackages = Object.entries(rootLock?.packages ?? {});
const packagerPackages = Object.entries(packagerLock?.packages ?? {});
const combinedPackages = [...rootPackages, ...packagerPackages];
const rootWorkspaces = rootPackages.filter(([path]) => path && !path.startsWith('node_modules/'));
const registryPackages = combinedPackages.filter(([, entry]) => typeof entry?.resolved === 'string' && entry.resolved.endsWith('.tgz'));
const migrationVersions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)].map((match) => Number.parseInt(match[1], 10));
const latestMigration = migrationVersions.length ? Math.max(...migrationVersions) : null;
const vulnerabilityPaths = [
  'artifacts/validation/32-U-ppk-025-root-production-vulnerability.json',
  'artifacts/validation/32-U-ppk-025-root-build-vulnerability.json',
  'artifacts/validation/32-U-ppk-025-windows-packager-vulnerability.json'
];
const registrySignaturePaths = [
  'artifacts/validation/32-U-ppk-025-root-registry-signatures.json',
  'artifacts/validation/32-U-ppk-025-windows-packager-registry-signatures.json'
];
const vulnerabilityEvidence = await Promise.all(vulnerabilityPaths.map(readJson));
const registrySignatureEvidence = await Promise.all(registrySignaturePaths.map(readJson));
const materialPathBindings = {
  rootPackageLockSha256: 'package-lock.json',
  windowsPackagerLockSha256: 'tools/windows-packager/package-lock.json',
  sbomSha256: paths.sbom,
  thirdPartyNoticesJsonSha256: paths.noticesJson,
  thirdPartyNoticesTextSha256: paths.noticesText,
  licenseGateSha256: paths.licenseGate,
  vulnerabilityGateSha256: paths.vulnerabilityGate,
  registrySignatureGateSha256: paths.registryGate,
  externalAssetManifestSha256: paths.externalAssets,
  externalAssetVerificationSha256: paths.externalAssetGate,
  buildToolchainSecuritySha256: paths.buildToolchainGate
};
const currentMaterials = Object.fromEntries(await Promise.all(
  Object.entries(materialPathBindings).map(async ([name, path]) => [name, await hashFile(path)])
));
const expectedVulnerabilityScopes = ['root-production', 'root-build-toolchain', 'windows-packager'];
const expectedRegistrySignatureScopes = ['root', 'windows-packager'];
const expectedAssets = ['electron', '7zip', 'nsis', 'nsis-resources', 'winCodeSign'];
const expectedLicenses = [
  '0BSD', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MIT', 'MPL-2.0',
  'BlueOak-1.0.0', 'Python-2.0', 'WTFPL', '(MIT OR CC0-1.0)', '(WTFPL OR MIT)', 'WTFPL OR ISC'
];
const expectedCandidateReasons = [
  'AUTHENTICODE_ARTIFACT_MISSING',
  'AUTHENTICODE_CERTIFICATE_UNTRUSTED',
  'AUTHENTICODE_STATUS_INVALID',
  'AUTHENTICODE_TIMESTAMP_MISSING',
  'PRODUCTION_CERTIFICATE_NOT_PROVISIONED',
  'PROVENANCE_KEY_UNTRUSTED',
  'PROVENANCE_SIGNATURE_INVALID'
];
const targetedFiles = [
  'packages/platform-policy/supply-chain-release-policy.test.ts',
  'packages/application/tests/supply-chain-release-use-cases.test.ts',
  'apps/desktop/tests/ppk025-software-supply-chain-gates.test.ts'
];
const exactTargetedCommand = `vitest run ${targetedFiles.join(' ')} --maxWorkers=1`;

check('scope identity is exact', scope?.schemaVersion === 1 && scope.step === '32-U' && scope.requirement === 'PPK-025');
check('inventory identity is exact', inventory?.schemaVersion === 1 && inventory.step === '32-U' && inventory.requirement === 'PPK-025');
check('policy identity and default deny are exact', policyConfig?.schemaVersion === 1 && policyConfig.step === '32-U' && policyConfig.requirement === 'PPK-025' && policyConfig.defaultDecision === 'DENY');
check('signing trust identity and default deny are exact', signingTrust?.schemaVersion === 1 && signingTrust.step === '32-U' && signingTrust.requirement === 'PPK-025' && signingTrust.defaultDecision === 'DENY');
check('accepted registry contains PPK-025 after complete predecessor', requirement !== undefined && predecessor?.status === 'COMPLETE');
check('PPK-026 remains a separate independently evidenced successor', successor !== undefined && successor.id === 'PPK-026');
check('DEC-206 is active and ledger count is exact', ledger?.decisionCount === ledger?.decisions?.length && decisionEntry?.status === 'ACTIVE' && decisionEntry?.requirements?.includes('PPK-025'));
check('master register contains DEC-206 and exact decision path', masterRegister.includes('## DEC-206') && masterRegister.includes('DEC-206-ppk-025-software-supply-chain-gates.md'));

check('source boundary scan has no production finding', sourceScan.findings.length === 0, `${sourceScan.findings.length} finding(s)`);
check('source boundary has one canonical policy class', sourceScan.canonicalPolicyClassDefinitions === 1);
check('source gate detects six malicious escape classes', includesAll(sourceGateSource, [
  'CANONICAL_SUPPLY_CHAIN_AUTHORITY_OUTSIDE_EXACT_ALLOWLIST',
  'PARALLEL_SUPPLY_CHAIN_POLICY_AUTHORITY',
  'PRIVATE_SIGNING_MATERIAL_IN_SOURCE',
  'BROAD_VULNERABILITY_OR_LICENSE_WAIVER',
  'CHECKSUM_MISREPRESENTED_AS_SIGNATURE',
  'INVALID_AUTHENTICODE_ACCEPTED'
]));
check('root pretypecheck and prebuild include the source gate', rootPackage?.scripts?.pretypecheck?.includes('verify-software-supply-chain-boundary.mjs') && rootPackage?.scripts?.prebuild?.includes('verify-software-supply-chain-boundary.mjs'));
check('root source gate command is exact', rootPackage?.scripts?.['verify:ppk025:supply-chain-gate'] === 'node scripts/verify-software-supply-chain-boundary.mjs');

check('domain boundary is content-free and non-authoritative', includesAll(domainSource, [
  "status: 'RELEASE_ELIGIBLE' | 'BLOCKED'", 'requiredLockfileCount: 2',
  'requiredVulnerabilityScopeCount: 3', 'requiredRegistrySignatureScopeCount: 2',
  'requiredExternalAssetCount: 5', 'detailsExposedToClient: false',
  'grantsReleaseAuthority: false', 'schemaMigrationRequired: false', 'latestDatabaseMigration: 77'
]));
check('domain exports the canonical release boundary', domainIndex.includes("export * from './supply-chain-release.js'"));
check('application maps unavailable or malformed evidence to fail-closed evaluation', includesAll(useCaseSource, [
  'try { return this.policy.evaluate(await this.evidence.load()); }',
  'catch { return this.policy.evaluate(undefined); }'
]));
check('application authorizes before invoking release callback', useCaseSource.indexOf('this.policy.assertReleaseEligible(decision);') > 0 && useCaseSource.indexOf('this.policy.assertReleaseEligible(decision);') < useCaseSource.indexOf('return callback(decision);'));
check('application verifies and narrows the content-free snapshot', includesAll(useCaseSource, [
  'GetSupplyChainReleaseBoundaryUseCase', 'this.policy.verifySnapshot(snapshot)',
  'detailsExposedToClient: false', 'grantsReleaseAuthority: false'
]));
check('application exports canonical release use cases', applicationIndex.includes("export * from './supply-chain-release-use-cases.js'"));

check('platform policy pins exact scope and asset counts', includesAll(policySource, [
  "'root-production'", "'root-build-toolchain'", "'windows-packager'", "'root'",
  "'electron'", "'nsis'", "'nsis-resources'", "'winCodeSign'",
  'requiredLockfileCount: 2', 'requiredVulnerabilityScopeCount: 3',
  'requiredRegistrySignatureScopeCount: 2', 'requiredExternalAssetCount: 5'
]));
check('platform policy pins exact freshness thresholds', includesAll(policySource, [
  'SUPPLY_CHAIN_VULNERABILITY_MAX_AGE_MS = 86_400_000',
  'SUPPLY_CHAIN_EVIDENCE_MAX_FUTURE_SKEW_MS = 300_000'
]));
check('platform policy denies malformed identity material and coverage drift', includesAll(policySource, [
  'EVIDENCE_MALFORMED', 'RELEASE_IDENTITY_MISMATCH', 'SOURCE_IDENTITY_MISMATCH',
  'MATERIAL_HASH_MISMATCH', 'SBOM_COVERAGE_MISMATCH', 'LICENSE_COVERAGE_MISMATCH'
]));
check('platform policy denies vulnerability signature asset provenance and Authenticode failures', includesAll(policySource, [
  'VULNERABILITY_EVIDENCE_STALE', 'VULNERABILITY_FINDING_PRESENT',
  'REGISTRY_SIGNATURE_EVIDENCE_INVALID', 'EXTERNAL_ASSET_MISMATCH',
  'PROVENANCE_SIGNATURE_INVALID', 'PROVENANCE_KEY_UNTRUSTED',
  'PRODUCTION_CERTIFICATE_NOT_PROVISIONED', 'AUTHENTICODE_ARTIFACT_MISSING',
  'AUTHENTICODE_STATUS_INVALID', 'AUTHENTICODE_PUBLISHER_MISMATCH',
  'AUTHENTICODE_CERTIFICATE_UNTRUSTED', 'AUTHENTICODE_TIMESTAMP_MISSING',
  'SELF_SIGNED_OR_TEST_CERTIFICATE_REJECTED'
]));
check('platform policy requires exact evidence keys and cryptographic DSSE verification', includesAll(policySource, [
  "envelope: 'DSSE'", "algorithm: 'Ed25519'", "payloadType: 'application/vnd.in-toto+json'",
  'createPublicKey(trustedKey.publicKeyPem)', 'verifySignature(', 'dssePreAuthEncoding('
]));
check('platform snapshot exposes no component vulnerability hash or certificate details', includesAll(policySource, [
  'componentNamesExposed: false', 'vulnerabilityIdentifiersExposed: false',
  'hashesExposed: false', 'certificateDetailsExposed: false'
]));
check('platform policy exports the canonical release authority exactly once', (policyIndex.match(/supply-chain-release-policy\.js/gu) ?? []).length === 1);

check('root and packager lockfiles are npm lockfile version three', rootLock?.lockfileVersion === 3 && packagerLock?.lockfileVersion === 3);
check('two lock graphs contain exact 414 component nodes', combinedPackages.length === 414, String(combinedPackages.length));
check('root lock contains exact 18 workspaces', rootWorkspaces.length === 18, String(rootWorkspaces.length));
check('two lock graphs contain exact 374 registry tarballs', registryPackages.length === 374, String(registryPackages.length));
check('all external dependency tarballs use canonical HTTPS npm registry and SHA-512 integrity', registryPackages.every(([, entry]) => /^https:\/\/registry\.npmjs\.org\//u.test(entry.resolved) && /^sha512-[A-Za-z0-9+/]+={0,2}$/u.test(entry.integrity ?? '')));
check('policy declares exact two lock graphs and 18 workspaces', policyConfig?.lockfiles?.length === 2 && exactArray(policyConfig.lockfiles.map((item) => item.path), ['package-lock.json', 'tools/windows-packager/package-lock.json']) && policyConfig.lockfiles[0].workspaceCount === 18);
check('policy pins exact 414 374 and 357 coverage', policyConfig?.requiredSbomComponentCount === 414 && policyConfig.requiredDependencyNodeCount === 414 && policyConfig.requiredRegistryPackageCount === 374 && policyConfig.requiredLicenseComponentCount === 357);

const bomRefs = sbom?.components?.map((item) => item['bom-ref']) ?? [];
check('CycloneDX 1.6 SBOM has exact 414 unique components', sbom?.bomFormat === 'CycloneDX' && sbom.specVersion === '1.6' && bomRefs.length === 414 && new Set(bomRefs).size === 414);
check('SBOM has exact 414 dependency nodes with known refs', sbom?.dependencies?.length === 414 && sbom.dependencies.every((item) => bomRefs.includes(item.ref) && item.dependsOn.every((ref) => bomRefs.includes(ref))));
check('third-party notice inventory has exact 357 components', notices?.entries?.length === 357, String(notices?.entries?.length ?? 0));
check('third-party notice text is non-empty and separately material-bound', (await readText(paths.noticesText)).length > 1_000);
check('license verification is a real exact-coverage PASS artifact', licenseGate?.status === 'PASS' && licenseGate.licenseInventoryComponentCount === 357 && licenseGate.failed === 0);
check('approved licenses are exact and waivers remain forbidden', exactArray(policyConfig?.approvedLicenses, expectedLicenses) && policyConfig?.licenses?.unknownAllowed === false && policyConfig.licenses.missingAllowed === false && policyConfig.licenses.noticeMissingAllowed === false && policyConfig.waivers?.productionReleaseWaiversAllowed === false && policyConfig.waivers?.wildcardsAllowed === false);

check('policy has exact three vulnerability scopes and fail-closed feed rules', exactArray(policyConfig?.vulnerability?.scopes, expectedVulnerabilityScopes) && policyConfig.vulnerability.maxAgeMs === 86_400_000 && policyConfig.vulnerability.maxFutureSkewMs === 300_000 && policyConfig.vulnerability.zeroFindingsRequired === true && policyConfig.vulnerability.feedUnavailableDecision === 'DENY');
check('three current vulnerability evidence artifacts pass with zero findings', exactArray(vulnerabilityEvidence.map((item) => item?.scope), expectedVulnerabilityScopes) && vulnerabilityEvidence.every((item) => item?.status === 'PASS' && item.commandExitCode === 0 && item.vulnerabilities?.total === 0));
check('aggregate vulnerability gate records exact three-scope PASS', vulnerabilityGate?.status === 'PASS' && vulnerabilityGate.failed === 0 && exactArray(vulnerabilityGate.requiredScopes, expectedVulnerabilityScopes) && vulnerabilityGate.evidence?.length === 3);
check('policy has exact two registry signature graphs and zero missing or invalid tolerance', exactArray(policyConfig?.registrySignature?.scopes, expectedRegistrySignatureScopes) && policyConfig.registrySignature.maximumInvalidSignatures === 0 && policyConfig.registrySignature.maximumMissingSignatures === 0 && policyConfig.registrySignature.invalidDecision === 'DENY' && policyConfig.registrySignature.missingDecision === 'DENY');
check('two current registry signature evidence artifacts pass with zero missing or invalid signatures', exactArray(registrySignatureEvidence.map((item) => item?.scope), expectedRegistrySignatureScopes) && registrySignatureEvidence.every((item) => item?.status === 'PASS' && item.commandExitCode === 0 && item.invalidCount === 0 && item.missingCount === 0));
check('aggregate registry signature gate records exact two-graph PASS', registryGate?.status === 'PASS' && registryGate.failed === 0 && registryGate.evidence?.length === 2 && registryGate.rootEvidenceCoversProductionAndBuild === true);

check('external asset manifest has exact five ordered assets', exactArray(externalAssetManifest?.assets?.map((item) => item.id), expectedAssets));
check('external assets use exact HTTPS source and SHA-256 pins', externalAssetManifest?.assets?.every((item) => /^https:\/\/github\.com\//u.test(item.source) && sha256Pattern.test(item.sha256)));
check('external asset gate records exact five-asset PASS', externalAssetGate?.status === 'PASS' && externalAssetGate.failed === 0 && externalAssetGate.assetCount === 5 && exactArray(externalAssetGate.assets?.map((item) => item.id), expectedAssets));
check('build toolchain evidence is a real PASS artifact', buildToolchainGate?.status === 'PASS');

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
const cryptoFixture = { releaseId: 'ppk-025-contract-crypto-self-test', materialsSha256: 'a'.repeat(64) };
const cryptoEnvelope = signDsseEnvelope({
  payloadType: 'application/vnd.in-toto+json',
  statement: cryptoFixture,
  keyId: 'ppk-025-contract-ephemeral-key',
  privateKey: privateKeyPem
});
const cryptoVerified = verifyDsseEnvelope({
  envelope: cryptoEnvelope,
  trustedKeys: [{ keyId: 'ppk-025-contract-ephemeral-key', publicKeyPem, status: 'ACTIVE' }]
});
const cryptoTampered = verifyDsseEnvelope({
  envelope: { ...cryptoEnvelope, signatures: [{ ...cryptoEnvelope.signatures[0], sig: Buffer.alloc(64).toString('base64') }] },
  trustedKeys: [{ keyId: 'ppk-025-contract-ephemeral-key', publicKeyPem, status: 'ACTIVE' }]
});
check('DSSE Ed25519 helper completes a real ephemeral sign and verify round-trip', cryptoVerified.valid === true && cryptoVerified.reason === 'VERIFIED' && cryptoVerified.statement?.releaseId === cryptoFixture.releaseId && cryptoVerified.statement?.materialsSha256 === cryptoFixture.materialsSha256);
check('DSSE Ed25519 helper rejects a tampered signature', cryptoTampered.valid === false && cryptoTampered.reason === 'SIGNATURE_INVALID');
check('DSSE implementation uses node crypto and canonical pre-auth encoding', includesAll(cryptoLibrary, [
  "from 'node:crypto'", 'DSSEv1 ', 'sign(null, pae, privateKey)',
  'verify(null, pae, publicKey', 'PAYLOAD_NOT_CANONICAL'
]));
check('provenance policy requires trusted Ed25519 DSSE and exact subject hash set', policyConfig?.provenance?.required === true && policyConfig.provenance.envelope === 'DSSE' && policyConfig.provenance.signatureAlgorithm === 'Ed25519' && policyConfig.provenance.verifiedRequired === true && policyConfig.provenance.checksumOnlyAccepted === false && policyConfig.provenance.subjectHashes?.length === 15);

check('SBOM generator and verifier bind deterministic two-lock output', includesAll(sbomGenerator, ['buildDeterministicSbom', 'policy.lockfiles', 'componentCount', 'dependencyNodeCount']) && includesAll(sbomVerifier, ['buildDeterministicSbom', 'SBOM exactly matches both current lock graphs', 'both lockfile hashes are bound']));
check('license generator and verifier bind exact inventory and notice output', includesAll(licenseGenerator, ['policy.lockfiles', 'approvedLicenses', 'third-party-notices']) && includesAll(licenseVerifier, ['requiredLicenseComponentCount', 'notice inventory exactly covers external SBOM components', 'every license expression is explicit and approved']));
check('vulnerability scripts cover three live audit scopes and freshness bindings', includesAll(vulnerabilityRunner, ['root-production', 'root-build-toolchain', 'windows-packager', 'lockfileSha256', 'expiresAt']) && includesAll(vulnerabilityVerifier, expectedVulnerabilityScopes));
check('registry signature scripts cover exact root and packager evidence', includesAll(registryRunner, ["audit', 'signatures'", "root: { cwd: '.', lockfile: 'package-lock.json' }", "'windows-packager': { cwd: 'tools/windows-packager'"]) && includesAll(registryVerifier, expectedRegistrySignatureScopes));
check('external asset verifier binds installed upstream sources', includesAll(externalAssetVerifier, ['node_modules/electron/checksums.json', 'app-builder-lib/out/toolsets/windows.js', ...expectedAssets]));

check('Authenticode verifier evaluates both exact PE targets', includesAll(authenticodeVerifier, [
  'Get-AuthenticodeSignature', 'InstallerPath', 'ApplicationExecutablePath',
  'installed-main-executable', 'authenticodeStatus', 'applicationExecutable'
]));
check('Authenticode verifier requires Valid status publisher thumbprint and certificate SHA-256', includesAll(authenticodeVerifier, [
  '$signatureStatus -eq "Valid"', 'publisherSubjectExact', 'leafThumbprintAllowlisted',
  'certificateSha256Allowlisted', 'signerCertificateSha256'
]));
check('Authenticode verifier requires code-signing EKU trusted chain and timestamp', includesAll(authenticodeVerifier, [
  'Code Signing', 'statusValid', 'TimeStamperCertificate', 'timestampCertificatePresent',
  'timestampSignatureValid', 'timestampMessageImprintValid', 'timestampChainTrusted',
  'certificateValidAtSigningTime', 'signerChainTrustedAtSigningTime', 'trustedTimestampPresent',
  'timestampChainStatus'
]));
check('Authenticode verifier rejects self-signed and test fixtures for production', includesAll(authenticodeVerifier, [
  'selfSignedCertificateRejected', 'testFixtureNotProduction', '$selfSigned', '$TestFixture'
]));
check('signing trust forbids private material in repository artifacts and logs', signingTrust?.privateSigningMaterialInRepositoryAllowed === false && signingTrust.privateMaterialInRepositoryAllowed === false && signingTrust.privateMaterialInArtifactsAllowed === false && signingTrust.privateMaterialInLogsAllowed === false);
check('signing trust requires both final artifacts and rejects self-signed certificates', exactArray(signingTrust?.requiredArtifacts?.map((item) => item.id), ['windows-installer', 'installed-main-executable']) && signingTrust.requiredArtifacts.every((item) => item.expectedAuthenticodeStatus === 'Valid' && item.timestamped === true && item.productionTrusted === true && item.selfSigned === false));

const sourceGateIndex = signedWindowsBuilder.indexOf("await script('scripts/verify-software-supply-chain-boundary.mjs')");
const lockGateIndex = signedWindowsBuilder.indexOf("await script('scripts/verify-lockfile-integrity.mjs')");
const supplyGateIndex = signedWindowsBuilder.indexOf("await script('scripts/verify-dependency-supply.mjs')");
const workspaceGateIndex = signedWindowsBuilder.indexOf("await script('scripts/verify-workspace-dependencies.mjs')");
const toolchainGateIndex = signedWindowsBuilder.indexOf("await script('scripts/verify-build-toolchain-security-contract.mjs'");
const sbomIndex = signedWindowsBuilder.indexOf("await script('scripts/generate-ppk025-sbom.mjs')");
const vulnerabilityIndex = signedWindowsBuilder.indexOf("'root-production'");
const registryIndex = signedWindowsBuilder.indexOf("'scripts/run-ppk025-registry-signature-gate.mjs'");
const governedPreflightIndex = signedWindowsBuilder.indexOf("await script('scripts/run-governed-preflight.mjs')");
const sourceBoundarySuiteIndex = signedWindowsBuilder.indexOf("await npm('run', 'pretypecheck')");
const typeScriptIndex = signedWindowsBuilder.indexOf("args: ['node_modules/typescript/bin/tsc', '--noEmit']");
const buildIndex = signedWindowsBuilder.indexOf("await npm('run', 'build:packages')");
const signingPolicyIndex = signedWindowsBuilder.indexOf('codeSigningCertificateProvisionedExternally !== true');
const builderIndex = signedWindowsBuilder.indexOf("'run-electron-builder.mjs'");
const authenticodeIndex = signedWindowsBuilder.indexOf("'scripts/verify-ppk025-windows-package-signature.ps1'");
const installRootIndex = signedWindowsBuilder.indexOf("'aym-ppk025-install-'");
const installedExecutableIndex = signedWindowsBuilder.indexOf('installedExecutablePath', installRootIndex);
const finalAuthenticodeIndex = signedWindowsBuilder.indexOf("'-ApplicationExecutablePath', installedExecutablePath", installedExecutableIndex);
const releaseEvidenceIndex = signedWindowsBuilder.indexOf("'scripts/create-ppk025-release-evidence.mjs'");
check('package:win uses only the signed release orchestrator', desktopPackage?.scripts?.['package:win'] === 'node scripts/build-signed-windows-release.mjs' && !desktopPackage.scripts?.['package:win:dir']?.includes('build-signed-windows-release.mjs'));
check('Windows package config forces code signing', desktopPackage?.build?.forceCodeSigning === true);
check('signed orchestrator runs both-lock supply workspace and toolchain preflights before SBOM', sourceGateIndex >= 0 && sourceGateIndex < lockGateIndex && lockGateIndex < supplyGateIndex && supplyGateIndex < workspaceGateIndex && workspaceGateIndex < toolchainGateIndex && toolchainGateIndex < sbomIndex);
check('signed orchestrator runs governed and source preflights before supply gates', governedPreflightIndex >= 0 && governedPreflightIndex < sourceBoundarySuiteIndex && sourceBoundarySuiteIndex < sourceGateIndex);
check('signed orchestrator runs source SBOM audit registry TypeScript and build gates in order', sourceGateIndex >= 0 && sourceGateIndex < sbomIndex && sbomIndex < vulnerabilityIndex && vulnerabilityIndex < registryIndex && registryIndex < typeScriptIndex && typeScriptIndex < buildIndex);
check('signed orchestrator blocks before unsigned builder execution', buildIndex < signingPolicyIndex && signingPolicyIndex < builderIndex && signedWindowsBuilder.includes('No unsigned installer will be emitted by package:win'));
check('signed orchestrator installs and verifies both final PE files before release evidence', builderIndex < authenticodeIndex && authenticodeIndex < installRootIndex && installRootIndex < installedExecutableIndex && installedExecutableIndex < finalAuthenticodeIndex && finalAuthenticodeIndex < releaseEvidenceIndex && signedWindowsBuilder.includes("'-Mode', 'FINAL_PAIR'") && !signedWindowsBuilder.includes("'win-unpacked'"));
check('release evidence creator keeps candidate blocked and production fail-closed', includesAll(releaseEvidenceCreator, [
  "process.argv.includes('--candidate')", "status: 'BLOCKED'", "authenticodeStatus: 'NotSigned'",
  "mode: candidateMode ? 'CANDIDATE' : 'PRODUCTION_RELEASE'",
  "decision.status === 'BLOCKED'", "decision.status === 'RELEASE_ELIGIBLE'",
  'sourceWorktreeClean', 'privateSigningMaterialPersisted: false'
]));

check('root package has exact three-file targeted command', rootPackage?.scripts?.['verify:ppk025:targeted'] === exactTargetedCommand);
check('root package has exact contract and runtime commands', rootPackage?.scripts?.['verify:ppk025:contract'] === 'node scripts/verify-32-u-ppk-025-software-supply-chain-contract.mjs' && rootPackage?.scripts?.['verify:ppk025:runtime'] === 'node scripts/verify-32-u-ppk-025-software-supply-chain-runtime.mjs');
check('root package exposes exact SBOM license vulnerability and governance commands', rootPackage?.scripts?.['verify:ppk025:sbom'] === 'node scripts/generate-ppk025-sbom.mjs' && rootPackage?.scripts?.['verify:ppk025:licenses'] === 'node scripts/generate-ppk025-third-party-notices.mjs' && rootPackage?.scripts?.['audit:production:evidence']?.includes('--scope root-production') && rootPackage?.scripts?.['audit:toolchain:evidence']?.includes('--scope root-build-toolchain') && rootPackage?.scripts?.['audit:windows-packager:evidence']?.includes('--scope windows-packager'));
check('targeted tests cover policy application and Desktop packaging gates', (policyTest.match(/\bit\(/gu) ?? []).length >= 13 && (applicationTest.match(/\bit\(/gu) ?? []).length >= 3 && (desktopTest.match(/\bit\(/gu) ?? []).length >= 6);
check('targeted tests exercise 414 374 357 and signed happy path', includesAll(policyTest, ['414', '374', '357', 'allows only an exactly covered, signed and trusted release fixture']));
check('targeted tests exercise provenance tamper and fail-closed application callback', policyTest.includes('denies provenance tampering') && applicationTest.includes('blocks a tampered attestation before the callback'));
check('Desktop tests cover fail-before-unsigned and full Authenticode trust', includesAll(desktopTest, ['fails before packaging', 'No unsigned installer will be emitted by package:win', 'Valid Authenticode', 'TimeStamperCertificate', 'selfSignedCertificateRejected']));

check('all current release material hashes are valid and exact', Object.values(currentMaterials).every((value) => sha256Pattern.test(value ?? '')) && Object.entries(currentMaterials).every(([name, value]) => releaseEvidence?.materials?.[name] === value) && Object.keys(releaseEvidence?.materials ?? {}).length === Object.keys(currentMaterials).length);
check('release evidence has exact 18 414 414 374 357 coverage', releaseEvidence?.coverage?.workspaceCount === 18 && releaseEvidence.coverage.sbomComponentCount === 414 && releaseEvidence.coverage.dependencyNodeCount === 414 && releaseEvidence.coverage.externalRegistryPackageCount === 374 && releaseEvidence.coverage.licenseInventoryComponentCount === 357);
check('release evidence contains exact three vulnerability and two signature records', exactArray(releaseEvidence?.vulnerabilities?.map((item) => item.scope), expectedVulnerabilityScopes) && exactArray(releaseEvidence?.registrySignatures?.map((item) => item.scope), expectedRegistrySignatureScopes));
check('release evidence contains exact five external assets and DSSE shape', exactArray(releaseEvidence?.externalAssets?.map((item) => item.id), expectedAssets) && releaseEvidence?.provenance?.envelope === 'DSSE' && releaseEvidence.provenance.algorithm === 'Ed25519' && releaseEvidence.provenance.signatureCount === 1);
check('release decision is bound to exact evidence bytes', releaseDecision?.evidenceSha256 === await hashFile(paths.releaseEvidence));

check('scope preserves no migration data transfer cutover or ownership change', scope?.boundaries?.schemaMigrationRequired === false && scope.boundaries.latestDatabaseMigration === 77 && scope.boundaries.historicalBackfillPerformed === false && scope.boundaries.realDataTransferPerformed === false && scope.boundaries.cutoverPerformed === false && scope.boundaries.desktopVaultOwnershipPreserved === true && scope.boundaries.sqliteOwnershipTransferred === false);
check('production model preserves no migration and content-free status', latestMigration === 77 && policySource.includes('schemaMigrationRequired: false') && policySource.includes('latestDatabaseMigration: 77'));
check('decision and threat model record fail-closed truth boundary', includesAll(decisionDocument, ['DEC-206', 'DSSE', 'Ed25519', 'Authenticode', 'latest migration `77`']) && includesAll(threatModel, ['DSSE/Ed25519', 'Authenti', 'latest migration `77`']));

if (candidateMode) {
  check('candidate registry truthfully remains partial with only evidence open', requirement?.status === 'PARTIAL' && Object.entries(requirement.chain ?? {}).every(([name, value]) => value === (name !== 'evidence')));
  check('candidate scope records local validation PASS and external signing pending without completion', scope?.status === 'IN_PROGRESS' && scope.implementationState === 'GATES_IMPLEMENTED_LOCAL_VALIDATION_PASS' && scope.releaseState === 'EXTERNAL_SIGNING_PENDING' && scope.validation?.state === 'CANDIDATE_PASS_EXTERNAL_INPUT_BLOCKED' && scope.validation?.candidateValidationRecorded === true && scope.validation?.finalValidationRecorded === false && scope.validation?.passClaimed === false && scope.validation?.executedResults?.length === 8 && scope.requirementCompletionClaimed === false);
  check('candidate inventory records exact three external blockers after local validation', inventory?.status === 'IN_PROGRESS' && inventory.completionClaimed === false && inventory.release?.productionReleaseEligible === false && inventory.release?.blockingState === 'EXTERNAL_SIGNING_PENDING' && exactArray(inventory.openBlockers?.map((item) => item.id), ['production-code-signing-certificate', 'production-provenance-signing-key', 'signed-current-release-artifacts']) && inventory.closureSummary?.openBlockerCount === 3 && inventory.closureSummary?.finalValidationPending === false && inventory.closureSummary?.localCandidateValidationPass === true && inventory.closureSummary?.externalSigningPending === true && inventory.closureSummary?.passClaimed === false);
  check('candidate policy and signing trust remain externally blocked', policyConfig?.release?.productionReleaseEligible === false && policyConfig.release.blockingState === 'EXTERNAL_SIGNING_PENDING' && signingTrust?.status === 'EXTERNAL_SIGNING_PENDING' && signingTrust.production?.codeSigningCertificateProvisionedExternally === false && signingTrust.production?.expectedPublisherSubject === '' && signingTrust.production?.allowedLeafCertificateThumbprints?.length === 0 && signingTrust.production?.allowedLeafCertificateSha256?.length === 0 && signingTrust.provenanceTrust?.trustedKeys?.length === 0 && signingTrust.releaseDecision?.productionReleaseEligible === false);
  check('candidate release decision is exact current fail-closed BLOCKED truth', releaseDecision?.mode === 'CANDIDATE' && releaseDecision.status === 'BLOCKED' && releaseDecision.releaseEligible === false && exactArray(releaseDecision.reasons, expectedCandidateReasons) && releaseDecision.privateSigningMaterialPersisted === false, JSON.stringify(releaseDecision?.reasons ?? []));
  check('candidate release evidence contains no fake production signing authority', releaseEvidence?.provenance?.trustedKeyId === 'UNPROVISIONED' && releaseEvidence?.authenticode?.productionCertificateProvisionedExternally === false && [releaseEvidence?.authenticode?.installer, releaseEvidence?.authenticode?.mainExecutable].every((item) => ['NotSigned', 'UnknownError'].includes(item?.status) && /^0{64}$/u.test(item.sha256) && item.selfSigned === false && item.testCertificate === false));
  check('candidate documents record local validation without final completion claim', decisionDocument.includes('ACTIVE / PARTIAL') && threatModel.includes('LOCAL_CANDIDATE_VALIDATION_PASS') && auditDocument.includes('IN_PROGRESS / NOT_CLOSED / LOCAL_CANDIDATE_VALIDATION_PASS') && !auditDocument.includes('COMPLETE / PASS'));
} else {
  check('final registry closes the complete PPK-025 chain', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true));
  check('final scope closes only after recorded validation', scope?.status === 'COMPLETED' && scope.implementationState === 'VALIDATED_COMPLETE' && scope.releaseState === 'RELEASE_ELIGIBLE' && scope.validation?.state === 'COMPLETE' && scope.validation?.finalValidationRecorded === true && scope.validation?.passClaimed === true && scope.requirementCompletionClaimed === true && scope.remainingClosureWork?.length === 0);
  check('final inventory closes without blockers', inventory?.status === 'COMPLETE' && inventory.completionClaimed === true && inventory.release?.productionReleaseEligible === true && inventory.openBlockers?.length === 0 && inventory.closureSummary?.openBlockerCount === 0 && inventory.closureSummary?.externalSigningPending === false && inventory.closureSummary?.passClaimed === true);
  check('final trust config contains external production trust roots without private material', signingTrust?.status !== 'EXTERNAL_SIGNING_PENDING' && signingTrust.production?.codeSigningCertificateProvisionedExternally === true && signingTrust.production?.expectedPublisherSubject?.length > 0 && signingTrust.production?.allowedLeafCertificateThumbprints?.length > 0 && signingTrust.production?.allowedLeafCertificateSha256?.length > 0 && signingTrust.provenanceTrust?.trustedKeys?.some((item) => item.status === 'ACTIVE') && signingTrust.releaseDecision?.productionReleaseEligible === true && signingTrust.privateSigningMaterialInRepositoryAllowed === false);
  check('final Windows signature evidence passes both final PE targets', windowsSignature?.status === 'PASS' && windowsSignature.releaseEligible === true && windowsSignature.productionConfigurationReady === true && windowsSignature.testFixture === false && windowsSignature.installer?.status === 'PASS' && windowsSignature.applicationExecutable?.status === 'PASS');
  check('final release decision is exact eligible truth', releaseDecision?.mode === 'PRODUCTION_RELEASE' && releaseDecision.status === 'RELEASE_ELIGIBLE' && releaseDecision.releaseEligible === true && exactArray(releaseDecision.reasons, ['ALLOW_VERIFIED_RELEASE']) && releaseDecision.sourceWorktreeClean === true && releaseDecision.privateSigningMaterialPersisted === false);
  check('final audit records only real contract runtime and signing evidence', auditDocument.includes('COMPLETE / PASS') && /contract: `\d+\/\d+ PASS`/u.test(auditDocument) && /runtime.*`\d+\/\d+ PASS`/u.test(auditDocument) && auditDocument.includes('32-U-ppk-025-windows-signature.json'));
}

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-U',
  requirement: 'PPK-025',
  phase: candidateMode ? 'SOFTWARE_SUPPLY_CHAIN_CANDIDATE_CONTRACT' : 'SOFTWARE_SUPPLY_CHAIN_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS',
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  failures,
  checks,
  sourceScan: {
    zones: sourceScan.zones,
    files: sourceScan.files,
    canonicalReferencePaths: sourceScan.canonicalReferencePaths,
    canonicalPolicyClassDefinitions: sourceScan.canonicalPolicyClassDefinitions,
    findings: sourceScan.findings
  },
  coverage: {
    lockfiles: 2,
    workspaces: rootWorkspaces.length,
    sbomComponents: bomRefs.length,
    dependencyNodes: sbom?.dependencies?.length ?? 0,
    registryPackages: registryPackages.length,
    licenseComponents: notices?.entries?.length ?? 0,
    vulnerabilityScopes: vulnerabilityEvidence.length,
    registrySignatureScopes: registrySignatureEvidence.length,
    externalAssets: externalAssetManifest?.assets?.length ?? 0,
    authenticodeArtifacts: 2,
    targetedTestFiles: targetedFiles.length
  },
  candidateDecisionExpectedReasons: candidateMode ? expectedCandidateReasons : [],
  productionReleaseEligible: releaseDecision?.releaseEligible === true,
  productionPrivateMaterialPersisted: false,
  checksumAloneGrantsReleaseAuthority: false,
  selfSignedCertificateGrantsProductionAuthority: false,
  historicalEvidenceGrantsCurrentAuthority: false,
  schemaMigrationRequired: false,
  latestDatabaseMigration: latestMigration,
  historicalBackfillPerformed: false,
  realDataTransferPerformed: false,
  cutoverPerformed: false,
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  successorRequirementCompletedByThisPackage: false,
  requirementCompletionClaimed: !candidateMode && failures.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile(paths.contract, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`PPK-025${candidateMode ? ' candidate' : ''} contract: FAIL (${failures.length}/${checks.length}).`);
  failures.forEach((failure) => console.error(failure));
  process.exit(1);
}
console.log(`PPK-025${candidateMode ? ' candidate' : ''} contract: PASS (${checks.length}/${checks.length}).`);
