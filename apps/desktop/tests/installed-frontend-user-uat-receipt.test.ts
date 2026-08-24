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

const fixture = () => {
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
    previousPackageProvenance: { release: 'Bronze 22.08.2026.49', sha256: sha('8'), sizeBytes: 800 },
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
  const installationPreservation = {
    schemaVersion: 2,
    id: 'PPT-WINDOWS-INSTALLED-RELEASE-UAT110-V2',
    evidenceKind: 'WINDOWS_INSTALLED_RELEASE_PRESERVATION',
    status: 'PASS',
    exitCode: 0,
    classification: 'LOCAL_UNSIGNED_INSTALLATION_PRESERVATION_ONLY',
    release: 'Bronze 22.08.2026.50',
    expectedReleaseId: 'bronze-2026-08-22-r50',
    sourceCommit: commit,
    packageProvenance: { sha256: sha('5') },
    governedPreflight: { sha256: sha('6') },
    installer: { sha256: sha('1'), fileVersion: '22.8.2026-50' },
    packagedRuntime: { sha256: sha('2'), sizeBytes: 42_000 },
    previousPackageProvenance: { sha256: sha('8'), sizeBytes: 800 },
    producer: { path: 'scripts/run-windows-installed-release-uat.ps1', sha256: sha('9'), sizeBytes: 1000 },
    cleanup: { markerDeleted: true, markerAbsentReadback: true, originalUserDataStateRestored: true },
    privacyBoundary: { existingUserFileContentsHashedForEquality: true, existingUserFileContentsRecorded: false, existingUserFileNamesRecorded: false, receiptContainsUserContent: false, contentEqualityMeasured: true },
    upgrade: {
      status: 'PASS', classification: 'VERSION_UPGRADE_N_TO_N_PLUS_1', installedEqualsPackaged: true,
      markerPreserved: true, allUserDataContentEqualityPreserved: true, otherChannelAndLegacyProgramMetadataPreserved: true,
      otherChannelWriteCount: 0, dataSelectionDialogObserved: false, bronzeRegistry: { exactSingleEntry: true }, installedRuntime: { sha256: sha('2') },
      fromFileVersion: '22.8.2026-49', toFileVersion: '22.8.2026-50', fromSequence: 49, toSequence: 50, exactSuccessor: true,
    },
    maintenance: {
      status: 'PASS', classification: 'SAME_VERSION_MAINTENANCE', installedEqualsPackaged: true,
      markerPreserved: true, allUserDataContentEqualityPreserved: true, otherChannelAndLegacyProgramMetadataPreserved: true,
      otherChannelWriteCount: 0, dataSelectionDialogObserved: false, bronzeRegistry: { exactSingleEntry: true }, installedRuntime: { sha256: sha('2') },
      beforeFileVersion: '22.8.2026-50', afterFileVersion: '22.8.2026-50', sameVersion: true,
    },
  };
  return { installedIdentity, packageProvenance, governedPreflight, installationPreservation };
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
