import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createInstalledFrontendReceipt,
  INSTALLED_EXECUTABLE_PATH,
  validateProvenanceReceipts,
} from '../../../scripts/run-installed-frontend-user-uat.mjs';

const sha = (character: string) => character.repeat(64);
const jsonSha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const commit = 'a'.repeat(40);

const fixture = (): any => {
  const installedIdentity = {
    fullPath: INSTALLED_EXECUTABLE_PATH,
    sizeBytes: 42_000,
    fileVersion: '22.8.2026-50',
    productVersion: '22.8.2026-50',
    sha256: sha('2'),
  };
  const packageProvenance = {
    schemaVersion: 2,
    id: 'PPT-WINDOWS-PACKAGE-PROVENANCE-V2',
    status: 'PASS',
    buildMode: 'LOCAL_UNSIGNED_NSIS',
    releaseId: 'bronze-2026-08-22-r50',
    release: 'Bronze 22.08.2026.50',
    parentRelease: 'Bronze 22.08.2026.49',
    previousPackageProvenance: null,
    sourceProvenance: {
      channel: 'Bronze',
      headCommit: commit,
      worktreeClean: true,
      governedSourceFingerprint: { sha256: sha('3') },
    },
    artifacts: {
      installer: { sha256: sha('1'), sizeBytes: 120_000 },
      packagedRuntime: { sha256: sha('2'), sizeBytes: 42_000 },
    },
  };
  const governedPreflight = {
    schemaVersion: 1,
    status: 'PASS',
    rulesSha256: sha('4'),
    sourceFingerprint: { sha256: sha('3'), fileCount: 2_700 },
  };
  const primaryInstallation = {
    status: 'PASS', classification: 'BOOTSTRAP_FRESH_INSTALL_SEQUENCE_50', installedEqualsPackaged: true,
    markerPreserved: true, allUserDataContentEqualityPreserved: true, otherChannelAndLegacyProgramMetadataPreserved: true,
    otherChannelWriteCount: 0, dataSelectionDialogObserved: false, bronzeRegistry: { exactSingleEntry: true }, installedRuntime: { sha256: sha('2') },
    fromFileVersion: null, toFileVersion: '22.8.2026-50', fromSequence: null, toSequence: 50,
    exactSuccessor: false, governedBootstrap: true, recoveryBootstrap: false, targetInstallRootAbsentBefore: true,
    targetExecutableAbsentBefore: true, bronzeUninstallRegistryAbsentBefore: true, packagePreviousProvenanceAbsent: true,
    before: { program: { bronze: { exists: false } }, uninstallRegistry: { bronze: { entryCount: 0 } } },
  };
  const installationPreservation = {
    schemaVersion: 3,
    id: 'PPT-WINDOWS-INSTALLED-RELEASE-UAT110-V3',
    evidenceKind: 'WINDOWS_INSTALLED_RELEASE_PRESERVATION',
    status: 'PASS',
    exitCode: 0,
    classification: 'LOCAL_UNSIGNED_INSTALLATION_PRESERVATION_ONLY',
    installationMode: 'BOOTSTRAP_FRESH_INSTALL',
    release: 'Bronze 22.08.2026.50',
    expectedReleaseId: 'bronze-2026-08-22-r50',
    sourceCommit: commit,
    packageProvenance: { sha256: sha('5') },
    governedPreflight: { sha256: sha('6') },
    installer: { sha256: sha('1'), fileVersion: '22.8.2026-50' },
    packagedRuntime: { sha256: sha('2'), sizeBytes: 42_000 },
    previousPackageProvenance: null,
    installedBefore: null,
    recoveryBootstrapAuthority: null,
    producer: { path: 'scripts/run-windows-installed-release-uat.ps1', sha256: sha('9'), sizeBytes: 1000 },
    cleanup: { markerDeleted: true, markerAbsentReadback: true, originalUserDataStateRestored: true },
    privacyBoundary: { existingUserFileContentsHashedForEquality: true, existingUserFileContentsRecorded: false, existingUserFileNamesRecorded: false, receiptContainsUserContent: false, contentEqualityMeasured: true },
    primaryInstallation,
    freshInstall: { ...primaryInstallation },
    upgrade: null,
    maintenance: {
      status: 'PASS', classification: 'SAME_VERSION_MAINTENANCE', installedEqualsPackaged: true,
      markerPreserved: true, allUserDataContentEqualityPreserved: true, otherChannelAndLegacyProgramMetadataPreserved: true,
      otherChannelWriteCount: 0, dataSelectionDialogObserved: false, bronzeRegistry: { exactSingleEntry: true }, installedRuntime: { sha256: sha('2') },
      beforeFileVersion: '22.8.2026-50', afterFileVersion: '22.8.2026-50', sameVersion: true,
      precedingPhase: 'BOOTSTRAP_FRESH_INSTALL_SEQUENCE_50',
    },
  };
  return { installedIdentity, packageProvenance, governedPreflight, installationPreservation };
};

const continuationFixture = (): any => {
  const input = fixture();
  input.installedIdentity.fileVersion = '27.8.2026-52';
  input.installedIdentity.productVersion = '27.8.2026-52';
  input.packageProvenance.releaseId = 'bronze-2026-08-27-r52';
  input.packageProvenance.release = 'Bronze 27.08.2026.52';
  input.packageProvenance.parentRelease = 'Bronze 26.08.2026.51';
  input.packageProvenance.previousPackageProvenance = {
    path: 'C:\\PPT\\AYM\\06_KOD\\app\\artifacts\\validation\\release-history\\bronze-26.08.2026.51-windows-package-provenance-bundle\\bundle.json',
    release: 'Bronze 26.08.2026.51', sha256: sha('8'), sizeBytes: 800,
    packagedRuntime: { sha256: sha('7'), sizeBytes: 41_000 },
  };
  input.installationPreservation.release = 'Bronze 27.08.2026.52';
  input.installationPreservation.expectedReleaseId = 'bronze-2026-08-27-r52';
  input.installationPreservation.installationMode = 'CONTINUATION_N_TO_N_PLUS_ONE';
  input.installationPreservation.installer.fileVersion = '27.8.2026-52';
  input.installationPreservation.previousPackageProvenance = {
    path: input.packageProvenance.previousPackageProvenance.path, sha256: sha('8'), sizeBytes: 800,
  };
  input.installationPreservation.installedBefore = { fileVersion: '26.8.2026-51', sha256: sha('7'), sizeBytes: 41_000 };
  const upgrade = {
    ...input.installationPreservation.primaryInstallation,
    classification: 'VERSION_UPGRADE_N_TO_N_PLUS_1',
    fromFileVersion: '26.8.2026-51', toFileVersion: '27.8.2026-52', fromSequence: 51, toSequence: 52,
    exactSuccessor: true, governedBootstrap: false, recoveryBootstrap: false, targetInstallRootAbsentBefore: false,
    targetExecutableAbsentBefore: false, bronzeUninstallRegistryAbsentBefore: false, packagePreviousProvenanceAbsent: false,
  };
  input.installationPreservation.primaryInstallation = upgrade;
  input.installationPreservation.freshInstall = null;
  input.installationPreservation.upgrade = { ...upgrade };
  input.installationPreservation.maintenance.beforeFileVersion = '27.8.2026-52';
  input.installationPreservation.maintenance.afterFileVersion = '27.8.2026-52';
  input.installationPreservation.maintenance.precedingPhase = 'VERSION_UPGRADE_N_TO_N_PLUS_1';
  return input;
};

const recoveryFixture = (): any => {
  const input = fixture();
  input.installedIdentity.fileVersion = '26.8.2026-51';
  input.installedIdentity.productVersion = '26.8.2026-51';
  input.packageProvenance.releaseId = 'bronze-2026-08-26-r51';
  input.packageProvenance.release = 'Bronze 26.08.2026.51';
  input.packageProvenance.parentRelease = 'Bronze 22.08.2026.50';
  const recoveryBootstrap = {
    decision: 'RECOVERY_BOOTSTRAP_AFTER_REJECTED_50', parentStatus: 'REJECTED_INVALID_PACKAGE',
    currentRelease: 'Bronze 26.08.2026.51', currentReleaseId: 'bronze-2026-08-26-r51',
    parentRelease: 'Bronze 22.08.2026.50', parentReleaseId: 'bronze-2026-08-22-r50',
    currentSequence: 51, parentSequence: 50,
    releaseLedger: { path: 'config/release-ledger.json', sizeBytes: 1000, sha256: sha('a') },
  };
  input.packageProvenance.previousPackageProvenance = {
    path: 'C:\\PPT\\AYM\\06_KOD\\app\\artifacts\\validation\\release-history\\bronze-22.08.2026.50-windows-package-provenance-bundle\\bundle.json',
    release: 'Bronze 22.08.2026.50', releaseId: 'bronze-2026-08-22-r50', sha256: sha('8'), sizeBytes: 800,
    packagedRuntime: { sha256: sha('7'), sizeBytes: 41_000 },
    lineageRole: 'REJECTED_PARENT_HISTORY_ANCHOR_ONLY', trustedInstalledPredecessor: false, recoveryBootstrap,
  };
  input.installationPreservation.release = input.packageProvenance.release;
  input.installationPreservation.expectedReleaseId = input.packageProvenance.releaseId;
  input.installationPreservation.installationMode = 'RECOVERY_BOOTSTRAP_FRESH_INSTALL';
  input.installationPreservation.installer.fileVersion = '26.8.2026-51';
  input.installationPreservation.previousPackageProvenance = {
    path: input.packageProvenance.previousPackageProvenance.path, sha256: sha('8'), sizeBytes: 800,
  };
  input.installationPreservation.installedBefore = null;
  input.installationPreservation.recoveryBootstrapAuthority = structuredClone(recoveryBootstrap);
  const recovery = {
    ...input.installationPreservation.primaryInstallation,
    classification: 'RECOVERY_BOOTSTRAP_FRESH_INSTALL_SEQUENCE_51',
    fromFileVersion: null, toFileVersion: '26.8.2026-51', fromSequence: null, toSequence: 51,
    exactSuccessor: false, governedBootstrap: false, recoveryBootstrap: true,
    packagePreviousProvenanceAbsent: false,
  };
  input.installationPreservation.primaryInstallation = recovery;
  input.installationPreservation.freshInstall = { ...recovery };
  input.installationPreservation.upgrade = null;
  input.installationPreservation.maintenance.beforeFileVersion = '26.8.2026-51';
  input.installationPreservation.maintenance.afterFileVersion = '26.8.2026-51';
  input.installationPreservation.maintenance.precedingPhase = 'RECOVERY_BOOTSTRAP_FRESH_INSTALL_SEQUENCE_51';
  return input;
};

describe('installed frontend UAT receipt schema and provenance', () => {
  it('accepts only an exact package/preflight/preservation/installed-runtime chain', () => {
    const input = fixture();
    const result = validateProvenanceReceipts({
      ...input,
      expectedReleaseId: 'bronze-2026-08-22-r50',
      packageProvenanceSha256: sha('5'),
      governedPreflightSha256: sha('6'),
    });
    expect(result).toMatchObject({
      release: 'Bronze 22.08.2026.50',
      releaseId: 'bronze-2026-08-22-r50',
      sourceCommit: commit,
      governedSourceFingerprintSha256: sha('3'),
      canonicalRuleRegistrySha256: sha('4'),
      installerSha256: sha('1'),
      packagedRuntimeSha256: sha('2'),
      packageBuildMode: 'LOCAL_UNSIGNED_NSIS',
    });
  });

  it('accepts exact recovery and 52+ continuation but rejects cross-mode bootstrap and upgrade claims', () => {
    const recovery = recoveryFixture();
    expect(() => validateProvenanceReceipts({
      ...recovery, expectedReleaseId: 'bronze-2026-08-26-r51',
      packageProvenanceSha256: sha('5'), governedPreflightSha256: sha('6'),
    })).not.toThrow();

    const continuation = continuationFixture();
    expect(() => validateProvenanceReceipts({
      ...continuation, expectedReleaseId: 'bronze-2026-08-27-r52',
      packageProvenanceSha256: sha('5'), governedPreflightSha256: sha('6'),
    })).not.toThrow();

    const bootstrapWithPrevious = fixture();
    bootstrapWithPrevious.packageProvenance.previousPackageProvenance = { release: 'Bronze 22.08.2026.49', sha256: sha('8'), sizeBytes: 800 };
    expect(() => validateProvenanceReceipts({ ...bootstrapWithPrevious, expectedReleaseId: 'bronze-2026-08-22-r50', packageProvenanceSha256: sha('5'), governedPreflightSha256: sha('6') })).toThrow(/bootstrap|null previous/u);

    const bootstrapAsUpgrade = fixture();
    bootstrapAsUpgrade.installationPreservation.installationMode = 'CONTINUATION_N_TO_N_PLUS_ONE';
    expect(() => validateProvenanceReceipts({ ...bootstrapAsUpgrade, expectedReleaseId: 'bronze-2026-08-22-r50', packageProvenanceSha256: sha('5'), governedPreflightSha256: sha('6') })).toThrow(/mod/u);

    const continuationWithoutPrevious = continuationFixture();
    continuationWithoutPrevious.packageProvenance.previousPackageProvenance = null;
    expect(() => validateProvenanceReceipts({ ...continuationWithoutPrevious, expectedReleaseId: 'bronze-2026-08-27-r52', packageProvenanceSha256: sha('5'), governedPreflightSha256: sha('6') })).toThrow(/parent package provenance/u);

    const trustedRejectedParent = recoveryFixture();
    trustedRejectedParent.packageProvenance.previousPackageProvenance.trustedInstalledPredecessor = true;
    expect(() => validateProvenanceReceipts({ ...trustedRejectedParent, expectedReleaseId: 'bronze-2026-08-26-r51', packageProvenanceSha256: sha('5'), governedPreflightSha256: sha('6') })).toThrow(/history-anchor-only/u);
  });

  it('rejects recovery flag or authority leakage across the exact sequence mode union', () => {
    const validate = (input: any, expectedReleaseId: string) => validateProvenanceReceipts({
      ...input, expectedReleaseId, packageProvenanceSha256: sha('5'), governedPreflightSha256: sha('6'),
    });

    const bootstrapFlagLeak = fixture();
    bootstrapFlagLeak.installationPreservation.primaryInstallation.recoveryBootstrap = true;
    bootstrapFlagLeak.installationPreservation.freshInstall.recoveryBootstrap = true;
    expect(() => validate(bootstrapFlagLeak, 'bronze-2026-08-22-r50')).toThrow(/recovery-false/u);

    const bootstrapAuthorityLeak = fixture();
    bootstrapAuthorityLeak.installationPreservation.recoveryBootstrapAuthority = { decision: 'FORGED' };
    expect(() => validate(bootstrapAuthorityLeak, 'bronze-2026-08-22-r50')).toThrow(/recovery-authority-null/u);

    const continuationFlagLeak = continuationFixture();
    continuationFlagLeak.installationPreservation.primaryInstallation.recoveryBootstrap = true;
    continuationFlagLeak.installationPreservation.upgrade.recoveryBootstrap = true;
    expect(() => validate(continuationFlagLeak, 'bronze-2026-08-27-r52')).toThrow(/recovery-authority-null/u);

    const continuationAuthorityLeak = continuationFixture();
    continuationAuthorityLeak.installationPreservation.recoveryBootstrapAuthority = { decision: 'FORGED' };
    expect(() => validate(continuationAuthorityLeak, 'bronze-2026-08-27-r52')).toThrow(/recovery-authority-null/u);

    const recoveryFlagMissing = recoveryFixture();
    recoveryFlagMissing.installationPreservation.primaryInstallation.recoveryBootstrap = false;
    recoveryFlagMissing.installationPreservation.freshInstall.recoveryBootstrap = false;
    expect(() => validate(recoveryFlagMissing, 'bronze-2026-08-26-r51')).toThrow(/recovery fresh-install/u);

    const recoveryAuthorityMissing = recoveryFixture();
    recoveryAuthorityMissing.installationPreservation.recoveryBootstrapAuthority = null;
    expect(() => validate(recoveryAuthorityMissing, 'bronze-2026-08-26-r51')).toThrow(/ledger authority/u);

    const recoveryAuthorityDrift = recoveryFixture();
    recoveryAuthorityDrift.installationPreservation.recoveryBootstrapAuthority.parentStatus = 'IN_PROGRESS';
    expect(() => validate(recoveryAuthorityDrift, 'bronze-2026-08-26-r51')).toThrow(/ledger authority/u);
  });

  it('fails closed for stale source, release, installer or installed binary bindings', () => {
    const make = () => fixture();
    const wrongRelease = make();
    expect(() => validateProvenanceReceipts({ ...wrongRelease, expectedReleaseId: 'bronze-2026-08-22-r51', packageProvenanceSha256: sha('5'), governedPreflightSha256: sha('6') })).toThrow(/releaseId/u);
    const wrongSource = make();
    wrongSource.governedPreflight.sourceFingerprint.sha256 = sha('9');
    expect(() => validateProvenanceReceipts({ ...wrongSource, expectedReleaseId: 'bronze-2026-08-22-r50', packageProvenanceSha256: sha('5'), governedPreflightSha256: sha('6') })).toThrow(/başka kaynak/u);
    const wrongInstaller = make();
    wrongInstaller.installationPreservation.installer.sha256 = sha('8');
    expect(() => validateProvenanceReceipts({ ...wrongInstaller, expectedReleaseId: 'bronze-2026-08-22-r50', packageProvenanceSha256: sha('5'), governedPreflightSha256: sha('6') })).toThrow(/başka installer/u);
    const wrongInstalledRuntime = make();
    wrongInstalledRuntime.installedIdentity.sha256 = sha('7');
    expect(() => validateProvenanceReceipts({ ...wrongInstalledRuntime, expectedReleaseId: 'bronze-2026-08-22-r50', packageProvenanceSha256: sha('5'), governedPreflightSha256: sha('6') })).toThrow(/byte-identical/u);
  });

  it('emits the final consumer schema-3 fields and no authentication material or audibility claim', () => {
    const input = fixture();
    const provenance = validateProvenanceReceipts({ ...input, expectedReleaseId: 'bronze-2026-08-22-r50', packageProvenanceSha256: sha('5'), governedPreflightSha256: sha('6') });
    const stateKey = sha('a');
    const loadingSnapshot = {
      visible: true,
      visibleSelector: '[aria-busy="true"],[data-async-state="loading"],.loading,.loading-state',
      textSha256: sha('d'),
      actionCorrelation: { kind: 'INITIAL_DOCUMENT_LOADING_OBSERVATION', pageSerial: 1, observationSha256: '' },
    };
    loadingSnapshot.actionCorrelation.observationSha256 = jsonSha({ visibleSelector: loadingSnapshot.visibleSelector, textSha256: loadingSnapshot.textSha256, pageSerial: 1 });
    const loadingRaw = {
      routeId: 'onboarding',
      controlIdentity: sha('c'),
      stateKey: sha('d'),
      outcomeKind: 'VISIBLE_LOADING_STATE',
      snapshot: loadingSnapshot,
      snapshotSha256: jsonSha(loadingSnapshot),
    };
    const receipt = createInstalledFrontendReceipt({
      provenance,
      receiptBindings: {
        startedAt: '2026-08-24T00:00:00.000Z',
        packageProvenanceSha256: sha('5'),
        installationPreservationSha256: sha('6'),
        governedPreflightSha256: sha('7'),
        screenshotReadbackVerified: true,
        screenshotRequiredSetVerified: true,
      },
      installedIdentity: input.installedIdentity,
      completedAt: '2026-08-24T01:00:00.000Z',
      status: 'PASS',
      checks: {
        navigationSurfaceCount: 22,
        moduleMenuCount: 4,
        interactionPasses: [{ routeId: 'dashboard', scenario: 'BASELINE', discoveredVisibleCount: 1, visibleStateKeys: [stateKey], visibleControlSetSha256: jsonSha([stateKey]), newStateCount: 1, newStateKeys: [stateKey], quietWindow: { status: 'PASS', quietForMs: 700, pageLifecycleStable: true, finalSerials: { pageSerial: 1, barrierFingerprint: sha('b') } } }],
        interactionMatrixStateKeys: [stateKey],
        interactionMatrixStateKeysSha256: jsonSha([stateKey]),
        fixedPointMatrixMembershipExact: true,
        accessibilityResults: [{ routeId: 'dashboard', status: 'PASS', enabledControlIdentities: [sha('f')], enabledControlStateKeys: [stateKey], forwardReachedControlIdentities: [sha('f')], forwardReachedStateKeys: [stateKey], reverseReachedControlIdentities: [sha('f')], reverseReachedStateKeys: [stateKey], modalForwardFocusIdentities: [], modalReverseFocusIdentities: [], scrollContainerCount: 1, expectedScrollContainerIds: ['scroll-0'], tooltipResults: [{ id: 'tip-0', targetIdentity: sha('c'), contentSha256: sha('c') }] }],
        applicationStateMatrix: [{ scenario: 'LOADING', status: 'PASS', evidence: [{ assertion: 'VISIBLE_LOADING_STATE_OBSERVED', sha256: jsonSha(loadingRaw), rawEvidence: loadingRaw }] }],
      },
      screenshots: [{ relativePath: 'artifacts/validation/run/normal-main.png' }],
      profileDisposition: { status: 'DELETED_AND_ABSENCE_READBACK_PASS', absenceReadbackVerified: true, profilePathRecorded: false },
      producer: { path: 'scripts/run-installed-frontend-user-uat.mjs', sha256: sha('8'), sizeBytes: 1000 },
      runId: '22222222-2222-4222-8222-222222222222',
      parentRunId: '11111111-1111-4111-8111-111111111111',
      evidenceRoot: 'C:\\PPT\\AYM\\06_KOD\\app\\artifacts\\validation\\windows-installed-release-uat\\run\\installed-frontend',
    });
    expect(receipt).toMatchObject({
      schemaVersion: 3,
      id: 'PPT-INSTALLED-FRONTEND-USER-UAT111-V3',
      parentRunId: '11111111-1111-4111-8111-111111111111',
      release: 'Bronze 22.08.2026.50',
      runtimeKind: 'INSTALLED_EXECUTABLE',
      executable: INSTALLED_EXECUTABLE_PATH,
      installedFileVersion: '22.8.2026-50',
      sourceCommit: commit,
      governedSourceFingerprintSha256: sha('3'),
      canonicalRuleRegistrySha256: sha('4'),
      packageProvenanceSha256: sha('5'),
      installationPreservationSha256: sha('6'),
      governedPreflightSha256: sha('7'),
      dataClassification: 'SYNTHETIC_TEST_ONLY',
      passwordRecorded: false,
      twoFactorSecretRecorded: false,
      recoveryCodesRecorded: false,
      containsUnredactedAuthenticationSecrets: false,
      physicalAudioAudibilityClaimed: false,
      status: 'PASS',
      checks: {
        interactionPasses: [{ visibleControlSetSha256: jsonSha([stateKey]) }],
        interactionMatrixStateKeys: [stateKey],
        fixedPointMatrixMembershipExact: true,
        accessibilityResults: [{ enabledControlIdentities: [sha('f')], enabledControlStateKeys: [stateKey], forwardReachedControlIdentities: [sha('f')], forwardReachedStateKeys: [stateKey], reverseReachedControlIdentities: [sha('f')], reverseReachedStateKeys: [stateKey], scrollContainerCount: 1, expectedScrollContainerIds: ['scroll-0'], tooltipResults: [{ targetIdentity: sha('c'), contentSha256: sha('c') }] }],
        applicationStateMatrix: [{ evidence: [{ assertion: 'VISIBLE_LOADING_STATE_OBSERVED', rawEvidence: loadingRaw }] }],
      },
      profileDisposition: { absenceReadbackVerified: true },
    });
    const serialized = JSON.stringify(receipt);
    expect(serialized).not.toMatch(/otpauth|recovery code|yerel parola|"profilePath"\s*:|[A-Z]:\\[^"\n]*parsyuva-installed-uat-|female voice heard/iu);
  });
});
