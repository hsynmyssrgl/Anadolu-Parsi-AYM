import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { copyFile, cp, lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { renderLicenseRtf } from './license-rtf-lib.mjs';
import { applyLegacyUpgradeDataPreservation } from './legacy-upgrade-data-preservation.mjs';
import { assertPreallocatedReleaseIdentity } from '../../../scripts/lib/monthly-release-version.mjs';
import {
  assertMatchingReleaseSourceProvenance,
  captureReleaseSourceProvenance,
  listChangedPathsForImpactAnalysis,
  validateMutationReleaseEvidence,
  verifyLocalSourceProtectionArtifacts
} from '../../../scripts/lib/release-source-provenance.mjs';
import {
  loadCanonicalProducerBindings, loadMutationEvidencePolicy, readEvidenceBinding, readExternalBaselineFromPointer,
  readRepoFileBinding, snapshotMutationEvidenceAndToolchain, validateImpactAssessment
} from '../../../scripts/lib/mutation-release-evidence.mjs';
import {
  verifyPreviousWindowsPackageProvenance,
  writeWindowsPackageProvenanceTransaction
} from '../../../scripts/lib/windows-package-provenance.mjs';
import { readCanonicalChannelSourceProtection } from '../../../scripts/lib/aym-source-authority.mjs';

const root = resolve(import.meta.dirname, '../../..');
const cacheRoot = resolve(root, 'artifacts/validation/electron-cache');
const windowsPackagerRoot = resolve(root, 'tools/windows-packager');
const builderCli = resolve(root, 'tools/windows-packager/node_modules/electron-builder/cli.js');
const directoryMode = ['--win', 'dir', '--config.forceCodeSigning=false'];
const signedInstallerMode = ['--win', 'nsis'];
const isDirectoryMode = process.argv.includes('--dir');
const isLocalUnsignedMode = process.argv.includes('--local-unsigned');
const sourceProtectionArgument = process.argv.find((argument) => argument.startsWith('--source-protection='));
const sourceProtectionPath = sourceProtectionArgument?.slice('--source-protection='.length)
  || process.env.PPT_SOURCE_PROTECTION_RECEIPT;
const expectedReleaseIdArgument = process.argv.find((argument) => argument.startsWith('--expected-release-id='));
const previousPackageProvenancePath = process.env.PPT_PREVIOUS_PACKAGE_PROVENANCE_RECEIPT;
if (isDirectoryMode && isLocalUnsignedMode) {
  console.error('Directory-only and local unsigned NSIS modes cannot be selected together.');
  process.exit(1);
}
const [releaseLedger, rootManifest, desktopManifest, repositoryMetadata, appMeta] = await Promise.all([
  readFile(resolve(root, 'config/release-ledger.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'package.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'apps/desktop/package.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'repository-metadata.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'packages/domain/src/app-meta.ts'), 'utf8')
]);
const preallocatedRelease = assertPreallocatedReleaseIdentity({
  expectedReleaseId: expectedReleaseIdArgument?.slice('--expected-release-id='.length)
    || process.env.PPT_EXPECTED_RELEASE_ID
    || releaseLedger.current?.releaseId,
  ledger: releaseLedger,
  rootManifest,
  desktopManifest,
  repositoryMetadata,
  appMeta
});
if (!existsSync(builderCli)) {
  console.error('Windows paketleme bağımlılıkları kurulmamış. Önce kökte `npm run windows-packager:install` komutunu çalıştırın.');
  process.exit(1);
}
mkdirSync(cacheRoot, { recursive: true });

const desktopPackage = desktopManifest;
const releaseArtifactTemplate = desktopPackage.build?.win?.artifactName ?? desktopPackage.build?.artifactName;
if (typeof releaseArtifactTemplate !== 'string') {
  console.error('Windows artifact template is missing.');
  process.exit(1);
}
// The governed public filename is intentionally identical in signed and local
// build modes. Trust classification comes from Authenticode/evidence, never
// from a filename suffix that can be forged or become stale.
const localUnsignedArtifactTemplate = releaseArtifactTemplate;
const localUnsignedMode = [
  '--win',
  'nsis',
  '--config.forceCodeSigning=false',
  `--config.artifactName=${localUnsignedArtifactTemplate}`,
  `--config.win.artifactName=${localUnsignedArtifactTemplate}`
];
const packageMode = isDirectoryMode
  ? directoryMode
  : isLocalUnsignedMode
    ? localUnsignedMode
    : signedInstallerMode;

const sha256Bytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readRegularFile = async (path, label) => {
  const fullPath = resolve(root, path);
  const item = await lstat(fullPath);
  if (!item.isFile() || item.isSymbolicLink()) throw new Error(`${label} must be a regular non-link file.`);
  const bytes = await readFile(fullPath);
  return { fullPath, bytes, sizeBytes: bytes.length, sha256: sha256Bytes(bytes) };
};
const restoreLicenseSource = async () => {
  const licenseSource = await readFile(resolve(root, 'apps/desktop/docs/LISANS_TR_KAYNAK.txt'), 'utf8');
  await writeFile(
    resolve(root, 'apps/desktop/build/LICENSE_TR.rtf'),
    renderLicenseRtf(licenseSource),
    'ascii'
  );
};

let sourceProtectionBinding;
let sourceCaptureBefore;
let localSourceProtectionReadback;
let mutationReleaseReadiness;
let mutationEvidenceBindings;
let builderProducerBinding;
let previousPackageProvenanceBinding = null;
if (!isDirectoryMode) {
  sourceCaptureBefore = await captureReleaseSourceProvenance({ root, expectedChannel: 'Bronze' });
  const canonicalSourceProtection = await readCanonicalChannelSourceProtection({
    aymRoot: dirname(sourceCaptureBefore.policy.codeRoot),
    expectedChannel: 'Bronze',
    suppliedPath: sourceProtectionPath
  });
  sourceProtectionBinding = canonicalSourceProtection.binding;
  const sourceProtection = canonicalSourceProtection.value;
  if (sourceProtection.schemaVersion !== 2
    || sourceProtection.localReceiptStatus !== 'LOCAL_RECEIPT_VERIFIED'
    || sourceProtection.backup?.scope !== 'TRACKED_FILES_AT_EXACT_COMMIT') {
    throw new Error('Source protection receipt is not a verified tracked-only exact-commit receipt.');
  }
  assertMatchingReleaseSourceProvenance(sourceCaptureBefore.provenance, sourceProtection.sourceProvenance, 'package source protection');
  localSourceProtectionReadback = await verifyLocalSourceProtectionArtifacts({
    aymRoot: dirname(sourceCaptureBefore.policy.codeRoot),
    protection: sourceProtection,
    expectedProvenance: sourceCaptureBefore.provenance,
    expectedChannel: 'Bronze'
  });
  const [{ policy: mutationPolicy, dependencyRegistry, dependencyRegistryBinding }, canonicalRegistry] = await Promise.all([
    loadMutationEvidencePolicy(root),
    readFile(resolve(root, 'config/canonical-rule-registry.json'), 'utf8').then(JSON.parse)
  ]);
  const evidenceSpecs = [
    ['baseline', mutationPolicy.defaultEvidence.baseline],
    ['impactAnalysis', mutationPolicy.defaultEvidence.impactAnalysis],
    ['targetedTest', mutationPolicy.defaultEvidence.targetedTest],
    ['fullRegression', mutationPolicy.defaultEvidence.fullRegression],
    ['sourceIntegrity', mutationPolicy.defaultEvidence.sourceIntegrity]
  ];
  const evidenceFiles = await Promise.all(evidenceSpecs.map(async ([id, path]) => {
    const binding = await readEvidenceBinding(root, path, `${id} evidence`);
    return { id, ...binding };
  }));
  const byId = Object.fromEntries(evidenceFiles.map((binding) => [binding.id, binding]));
  const [externalBaseline, assessment, producerBindings, manifest, sha256Sums, evidenceSnapshot] = await Promise.all([
    readExternalBaselineFromPointer({ pointer: byId.baseline.value }),
    readEvidenceBinding(root, mutationPolicy.defaultInput.impactAssessment, 'mutation impact assessment'),
    loadCanonicalProducerBindings(root, mutationPolicy),
    readRepoFileBinding(root, 'manifest.json', 'package manifest'),
    readRepoFileBinding(root, 'SHA256SUMS.txt', 'package SHA256SUMS'),
    snapshotMutationEvidenceAndToolchain(root)
  ]);
  const changedFiles = listChangedPathsForImpactAnalysis({
    runGit: sourceCaptureBefore.runGit,
    baselineReceipt: externalBaseline.record.value,
    baselinePointer: byId.baseline.value,
    headCommit: sourceCaptureBefore.provenance.headCommit,
    currentProvenance: sourceCaptureBefore.provenance
  });
  const assessed = validateImpactAssessment({
    policy: mutationPolicy, assessment: assessment.value, changedFiles,
    dependencyRegistry, dependencyRegistryBinding,
    expectedSourceCommit: sourceCaptureBefore.provenance.headCommit,
    expectedBaselineCommit: externalBaseline.record.value.sourceProvenance.headCommit
  });
  const impactEvidencePaths = [...new Set(Object.values(assessed.impactAreas).flatMap((area) => area.evidencePaths ?? []))].sort();
  const impactEvidenceBindings = Object.fromEntries(await Promise.all(impactEvidencePaths.map(async (path) => {
    const binding = await readRepoFileBinding(root, path, `impact evidence ${path}`);
    return [path, { path: binding.path, sizeBytes: binding.sizeBytes, sha256: binding.sha256 }];
  })));
  const dependencyRecordBindings = Object.fromEntries(await Promise.all(assessed.dependencyPlan.dependentRecords.map(async (path) => {
    const binding = await readRepoFileBinding(root, path, `dependent record ${path}`);
    return [path, { path: binding.path, sizeBytes: binding.sizeBytes, sha256: binding.sha256 }];
  })));
  const affectedTestBindings = Object.fromEntries(await Promise.all(assessed.dependencyPlan.affectedVitestFiles.map(async (path) => {
    const binding = await readRepoFileBinding(root, path, `affected test ${path}`);
    return [path, { path: binding.path, sizeBytes: binding.sizeBytes, sha256: binding.sha256 }];
  })));
  mutationReleaseReadiness = validateMutationReleaseEvidence({
    policy: mutationPolicy,
    canonicalRulesSha256: canonicalRegistry.rulesSha256,
    provenance: sourceCaptureBefore.provenance,
    changedFiles,
    mutationBaselinePointer: byId.baseline.value,
    mutationBaselinePointerSha256: byId.baseline.sha256,
    mutationBaseline: externalBaseline.record.value,
    mutationBaselineExternalSha256: externalBaseline.record.sha256,
    impactAssessment: assessment.value,
    impactAssessmentSha256: assessment.sha256,
    impactAnalysis: byId.impactAnalysis.value,
    targetedTest: byId.targetedTest.value,
    fullRegression: byId.fullRegression.value,
    sourceIntegrity: byId.sourceIntegrity.value,
    evidenceHashes: {
      impactAnalysis: byId.impactAnalysis.sha256,
      targetedTest: byId.targetedTest.sha256,
      fullRegression: byId.fullRegression.sha256
    },
    producerBindings,
    manifestBindings: {
      manifest: { path: manifest.path, sizeBytes: manifest.sizeBytes, sha256: manifest.sha256 },
      sha256Sums: { path: sha256Sums.path, sizeBytes: sha256Sums.sizeBytes, sha256: sha256Sums.sha256 }
    },
    impactEvidenceBindings,
    toolchainBindings: evidenceSnapshot.toolchain,
    dependencyRegistry,
    dependencyRegistryBinding,
    dependencyRecordBindings,
    affectedTestBindings
  });
  mutationEvidenceBindings = {
    ...Object.fromEntries(evidenceFiles.map((binding) => [binding.id, {
      path: binding.fullPath, sizeBytes: binding.sizeBytes, sha256: binding.sha256
    }])),
    baselineExternal: {
      path: externalBaseline.record.fullPath,
      sizeBytes: externalBaseline.record.sizeBytes,
      sha256: externalBaseline.record.sha256,
      chainTipSha256: externalBaseline.chain.tipSha256
    },
    impactAssessment: { path: assessment.fullPath, sizeBytes: assessment.sizeBytes, sha256: assessment.sha256 }
  };
  const builderProducer = await readRegularFile('apps/desktop/scripts/run-electron-builder.mjs', 'Windows package provenance producer');
  builderProducerBinding = {
    path: 'apps/desktop/scripts/run-electron-builder.mjs',
    sizeBytes: builderProducer.sizeBytes,
    sha256: builderProducer.sha256
  };
  previousPackageProvenanceBinding = await verifyPreviousWindowsPackageProvenance({
    root,
    preallocatedRelease,
    bundlePath: previousPackageProvenancePath,
    currentProvenance: sourceCaptureBefore.provenance,
    runGit: sourceCaptureBefore.runGit
  });
}

let temporaryTemplateRoot;
let childArgs = [builderCli, ...packageMode];
if (!isDirectoryMode) {
  const packagerPackage = JSON.parse(await readFile(resolve(windowsPackagerRoot, 'package.json'), 'utf8'));
  if (packagerPackage.devDependencies?.['electron-builder'] !== '26.15.6') {
    console.error('Real-progress NSIS template override supports only the reviewed electron-builder 26.15.6 toolchain.');
    process.exit(1);
  }
  const upstreamTemplateRoot = resolve(windowsPackagerRoot, 'node_modules/app-builder-lib/templates/nsis');
  const upstreamExtractorPath = resolve(upstreamTemplateRoot, 'include/extractAppPackage.nsh');
  const upstreamInstallUtilPath = resolve(upstreamTemplateRoot, 'include/installUtil.nsh');
  const governedExtractorPath = resolve(root, 'apps/desktop/build/extractAppPackage.nsh');
  const [upstreamExtractor, governedExtractor, upstreamInstallUtil] = await Promise.all([
    readFile(upstreamExtractorPath, 'utf8'),
    readFile(governedExtractorPath, 'utf8'),
    readFile(upstreamInstallUtilPath, 'utf8')
  ]);
  if ((upstreamExtractor.match(/Nsis7z::Extract "\$\{FILE\}"/gu) ?? []).length !== 2
    || upstreamExtractor.includes('AymInstallPayloadStageBegin')
    || !upstreamExtractor.includes('!macro extractEmbeddedAppPackage')) {
    console.error('The installed electron-builder NSIS extraction template drifted from the reviewed 26.15.6 shape.');
    process.exit(1);
  }
  if ((governedExtractor.match(/Nsis7z::ExtractWithDetails/gu) ?? []).length !== 2
    || (governedExtractor.match(/Call AymInstallPayloadStageBegin/gu) ?? []).length !== 3
    || (governedExtractor.match(/Call AymInstallPayloadStageEnd/gu) ?? []).length !== 3) {
    console.error('The governed single-progress NSIS extraction template is incomplete.');
    process.exit(1);
  }
  let governedInstallUtil;
  try {
    governedInstallUtil = applyLegacyUpgradeDataPreservation(upstreamInstallUtil);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  temporaryTemplateRoot = await mkdtemp(join(tmpdir(), 'parsyuva-nsis-template-'));
  const temporaryNsisRoot = resolve(temporaryTemplateRoot, 'nsis');
  await cp(upstreamTemplateRoot, temporaryNsisRoot, { recursive: true, force: false, errorOnExist: true });
  await Promise.all([
    copyFile(governedExtractorPath, resolve(temporaryNsisRoot, 'include/extractAppPackage.nsh')),
    writeFile(resolve(temporaryNsisRoot, 'include/installUtil.nsh'), governedInstallUtil, 'utf8')
  ]);

  // Load electron-builder in a fresh child process, replace only its exported
  // template root, then run the normal CLI. No dependency file is modified.
  const nsisUtilPath = resolve(windowsPackagerRoot, 'node_modules/app-builder-lib/out/targets/nsis/nsisUtil.js');
  const templateBootstrap = [
    "const path = require('node:path');",
    'const [builderCli, nsisUtilPath, expectedRoot, governedRoot, ...builderArgs] = process.argv.slice(1);',
    'const nsisUtil = require(nsisUtilPath);',
    "if (path.resolve(nsisUtil.nsisTemplatesDir) !== path.resolve(expectedRoot)) throw new Error('electron-builder NSIS template root drifted');",
    'nsisUtil.nsisTemplatesDir = governedRoot;',
    'process.argv = [process.execPath, builderCli, ...builderArgs];',
    'require(builderCli);'
  ].join('');
  childArgs = ['-e', templateBootstrap, builderCli, nsisUtilPath, upstreamTemplateRoot, temporaryNsisRoot, ...packageMode];
}

try {
  const exitCode = await new Promise((resolveExit) => {
    const child = spawn(process.execPath, childArgs, {
      cwd: resolve(root, 'apps/desktop'),
      env: {
        ...process.env,
        ELECTRON_CACHE: cacheRoot,
        electron_config_cache: cacheRoot
      },
      shell: false,
      windowsHide: true,
      stdio: 'inherit'
    });
    child.on('error', (error) => {
      console.error(`Electron builder could not start: ${error.message}`);
      resolveExit(1);
    });
    child.on('close', (code, signal) => {
      if (signal) {
        console.error(`Electron builder was terminated by signal ${signal}.`);
        resolveExit(1);
        return;
      }
      resolveExit(code ?? 1);
    });
  });
  process.exitCode = exitCode;
  if (exitCode === 0 && !isDirectoryMode) {
    await restoreLicenseSource();
    const sourceCaptureAfter = await captureReleaseSourceProvenance({ root, expectedChannel: 'Bronze' });
    assertMatchingReleaseSourceProvenance(sourceCaptureAfter.provenance, sourceCaptureBefore.provenance, 'package source post-build');
    const installerName = releaseArtifactTemplate.replace('${ext}', 'exe');
    const [installer, packagedRuntime] = await Promise.all([
      readRegularFile(resolve(root, 'apps/desktop/release', installerName), 'Packaged installer'),
      readRegularFile(resolve(root, 'apps/desktop/release/win-unpacked/ParsYuva-Bronze.exe'), 'Packaged runtime')
    ]);
    const packageProvenanceReceipt = {
      schemaVersion: 2,
      id: 'PPT-WINDOWS-PACKAGE-PROVENANCE-V2',
      evidenceKind: 'WINDOWS_PACKAGE_PROVENANCE',
      status: 'PASS',
      buildMode: isLocalUnsignedMode ? 'LOCAL_UNSIGNED_NSIS' : 'SIGNED_NSIS',
      releaseId: preallocatedRelease.releaseId,
      release: releaseArtifactTemplate.replace(/^ParsYuva-|\.\$\{ext\}$/gu, '').replace('-', ' '),
      channel: preallocatedRelease.channel,
      version: preallocatedRelease.version,
      packageVersion: preallocatedRelease.packageVersion,
      parentRelease: preallocatedRelease.parentRelease,
      previousPackageProvenance: previousPackageProvenanceBinding,
      sourceProvenance: sourceCaptureAfter.provenance,
      sourceProvenanceBefore: sourceCaptureBefore.provenance,
      sourceProvenanceAfter: sourceCaptureAfter.provenance,
      producer: builderProducerBinding,
      sourceProtection: {
        path: sourceProtectionBinding.fullPath,
        sizeBytes: sourceProtectionBinding.sizeBytes,
        sha256: sourceProtectionBinding.sha256,
        localArtifactReadback: localSourceProtectionReadback
      },
      mutationReleaseReadiness: {
        ...mutationReleaseReadiness,
        evidenceBindings: mutationEvidenceBindings
      },
      pr235EvidenceBindings: mutationEvidenceBindings,
      artifacts: {
        installer: { path: installer.fullPath, sizeBytes: installer.sizeBytes, sha256: installer.sha256 },
        packagedRuntime: { path: packagedRuntime.fullPath, sizeBytes: packagedRuntime.sizeBytes, sha256: packagedRuntime.sha256 }
      },
      generatedAt: new Date().toISOString()
    };
    await writeWindowsPackageProvenanceTransaction({ root, receipt: packageProvenanceReceipt });
  }
} finally {
  if (temporaryTemplateRoot) {
    await rm(temporaryTemplateRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  // electron-builder adds a UTF-8 BOM to localized RTF inputs while compiling.
  // Restore the governed ASCII source form so packaging never dirties the tree.
  await restoreLicenseSource();
}
