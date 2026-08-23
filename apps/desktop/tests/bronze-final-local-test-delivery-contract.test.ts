import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  createFinalLocalTestDeliveryReceipt,
  FINAL_LOCAL_TEST_DELIVERY_SCHEMA_VERSION
} from '../../../scripts/create-bronze-final-local-test-delivery.mjs';
import { ELECTRON_FUSE_POLICY } from '../scripts/electron-fuse-policy.mjs';

const sha = (value: string) => value.repeat(64);
const applicationVersion = '22.08.2026.50';
const packageVersion = '22.8.2026-50';
const installerPath = 'C:\\PPT\\AYM\\06_KOD\\app\\apps\\desktop\\release\\ParsYuva-Bronze-22.08.2026.50.exe';
const packagedPath = 'C:\\PPT\\AYM\\06_KOD\\app\\apps\\desktop\\release\\win-unpacked\\ParsYuva-Bronze.exe';
const installedPath = 'C:\\Program Files\\PPT\\ParsYuva\\Bronze\\ParsYuva-Bronze.exe';

const identity = (path: string, hash: string, sizeBytes: number) => ({
  path,
  fullPath: path,
  sizeBytes,
  sha256: hash,
  fileVersion: packageVersion,
  productVersion: packageVersion,
  authenticodeStatus: 'NotSigned',
  signerSubject: null
});

const baseInput = () => {
  const installer = identity(installerPath, sha('1'), 120_000_000);
  const packagedRuntime = identity(packagedPath, sha('2'), 225_000_000);
  const installedRuntime = identity(installedPath, sha('2'), 225_000_000);
  const slides = ['family-space', 'local-privacy', 'narrated-guidance'].map((id, index) => ({
    id,
    visibleProgressBarCount: 0,
    screenshotSha256: sha(String(index + 3))
  }));
  return {
    release: `Bronze ${applicationVersion}`,
    applicationVersion,
    packageVersion,
    sourceCommit: 'a'.repeat(40),
    installer,
    packagedRuntime,
    installedRuntime,
    installerExperience: {
      schemaVersion: 1,
      status: 'PASS',
      installer: { sha256: installer.sha256, sizeBytes: installer.sizeBytes },
      window: { className: '#32770', slideCount: 3, noFakeProgress: true, slides },
      narration: { observed: true, language: 'tr' },
      cancellation: {
        requested: true,
        confirmationInvoked: true,
        processTreeExited: true,
        forcedCleanupRequired: false
      },
      installedPayloadSafety: { unchanged: true }
    },
    maintenance: {
      schemaVersion: 1,
      status: 'PASS',
      classification: 'SAME_VERSION_MAINTENANCE_PRESERVATION',
      generatedAt: '2026-08-23T16:36:35.000Z',
      exitCode: 0,
      installer: { sha256: installer.sha256 },
      before: { markerSha256: sha('4') },
      after: {
        packagedSha256: packagedRuntime.sha256,
        installedSha256: installedRuntime.sha256,
        markerSha256: sha('4')
      },
      installedBinaryReplaced: true,
      packagedExactMatch: true,
      markerPreserved: true,
      bronzeDataUnchanged: true,
      otherChannelsUnchanged: true
    },
    packagedProbe: {
      schemaVersion: 3,
      status: 'PASS',
      mode: 'packaged',
      diagnosticMode: false,
      securityExceptions: [],
      applicationVersion,
      generatedAt: '2026-08-23T16:37:45.000Z',
      executableIdentity: {
        path: packagedPath,
        sizeBytes: packagedRuntime.sizeBytes,
        sha256: packagedRuntime.sha256,
        before: { path: packagedPath, sizeBytes: packagedRuntime.sizeBytes, sha256: packagedRuntime.sha256 },
        after: { path: packagedPath, sizeBytes: packagedRuntime.sizeBytes, sha256: packagedRuntime.sha256 },
        unchangedAcrossLaunches: true
      },
      sameUserDataAcrossRuns: true,
      dpapiCrossProcessPersistence: 'PASS',
      rendererSandboxPolicy: 'PASS',
      windowsEfsRuntime: 'PASS',
      windowsSafeStorageDpapiRuntime: 'PASS',
      protectedSideArtifactWindowsRuntime: 'PASS',
      runs: [1, 2].map(() => ({ status: 'PASS', applicationVersion }))
    },
    installedUi: {
      schemaVersion: 2,
      status: 'PASS',
      release: `Bronze ${applicationVersion}`,
      runtimeKind: 'INSTALLED_EXECUTABLE',
      executable: installedPath,
      installedFileVersion: packageVersion,
      startedAt: '2026-08-23T16:38:27.000Z',
      passwordRecorded: false,
      twoFactorSecretRecorded: false,
      recoveryCodesRecorded: false,
      containsUnredactedAuthenticationSecrets: false,
      checks: {
        firstRunIntroductionVisible: true,
        familyCreatedThroughVisibleForm: true,
        twoFactorStartedThroughVisibleButton: true,
        twoFactorCompletedThroughVisibleForm: true,
        currentDeviceTrustedThroughVisibleForm: true,
        authenticatedMainShellVisible: true,
        navigationSurfaceCount: 22,
        moduleMenuCount: 4,
        clickedInteractionCount: 235,
        visualAuditCount: 30,
        unexpectedRendererExceptionCount: 0,
        failedResourceCount: 0,
        mainProcessExceptionCount: 0
      },
      receiptBindings: {
        screenshotReadbackVerified: true,
        screenshotRequiredSetVerified: true
      }
    },
    narrationTr: { status: 'PASS', language: 'tr', claimBoundary: 'OFFLINE_WAVE_SYNTHESIS_ONLY_NOT_AUDIBLE_OUTPUT' },
    narrationEn: { status: 'PASS', language: 'en', claimBoundary: 'OFFLINE_WAVE_SYNTHESIS_ONLY_NOT_AUDIBLE_OUTPUT' },
    packagedFuses: { policyId: 'B2-04-ELECTRON-FUSE-V1', version: '1', fuses: ELECTRON_FUSE_POLICY },
    installedFuses: { policyId: 'B2-04-ELECTRON-FUSE-V1', version: '1', fuses: ELECTRON_FUSE_POLICY },
    evidenceBindings: {
      installerExperienceUat110: { path: 'installer-uat.json', sizeBytes: 1, sha256: sha('5') },
      sameVersionMaintenanceUat110: { path: 'maintenance-uat.json', sizeBytes: 1, sha256: sha('6') },
      installedFrontendUat111: { path: 'installed-ui.json', sizeBytes: 1, sha256: sha('7') },
      packagedLaunchProbe: { path: 'packaged-probe.json', sizeBytes: 1, sha256: sha('8') }
    }
  };
};

describe('Bronze final local-test delivery receipt contract', () => {
  it('binds installer, maintenance, installed UI, narration and unsigned release blockers', () => {
    const receipt = createFinalLocalTestDeliveryReceipt(baseInput());
    expect(receipt).toMatchObject({
      schemaVersion: FINAL_LOCAL_TEST_DELIVERY_SCHEMA_VERSION,
      classification: 'UNSIGNED_LOCAL_TEST_ONLY',
      status: 'LOCAL_TEST_PASS_PRODUCTION_RELEASE_BLOCKED',
      sameVersionMaintenance: {
        status: 'PASS',
        classification: 'SAME_VERSION_MAINTENANCE_PRESERVATION',
        markerPreserved: true,
        otherChannelsUnchanged: true
      },
      installedFrontendUat: {
        status: 'PASS', navigationRoutes: 22, moduleMenus: 4,
        clickedInteractions: 235, visualAudits: 30
      },
      narrationSynthesis: {
        status: 'PASS',
        claimBoundary: 'OFFLINE_WAVE_SYNTHESIS_ONLY_NOT_AUDIBLE_OUTPUT',
        humanAudibility: 'NOT_PROVEN_BY_AUTOMATION'
      },
      mainInspectorBoundary: {
        inspectorUsed: false,
        reason: 'PACKAGED_FUSE_DISABLES_CLI_INSPECT'
      },
      antivirusBoundary: {
        userReportedDetection: 'PDM:Trojan.Win32.Generic',
        detectedArtifactHashBound: false,
        falsePositiveConclusion: 'NOT_ESTABLISHED',
        resolutionStatus: 'UNRESOLVED_RELEASE_BLOCKER'
      },
      productionRelease: { eligible: false }
    });
    expect(receipt.packagedRuntime.sha256).toBe(receipt.installedRuntime.sha256);
  });

  it('rejects a stale schema-2 launch probe without executable hash binding', () => {
    const input = baseInput();
    input.packagedProbe.schemaVersion = 2;
    delete (input.packagedProbe as { executableIdentity?: unknown }).executableIdentity;
    expect(() => createFinalLocalTestDeliveryReceipt(input)).toThrow(/launch probe classification\/version/u);
  });

  it('rejects runtime replacement after the two packaged launches', () => {
    const input = baseInput();
    input.packagedProbe.executableIdentity.after.sha256 = sha('9');
    input.packagedProbe.executableIdentity.unchangedAcrossLaunches = false;
    expect(() => createFinalLocalTestDeliveryReceipt(input)).toThrow(/executable identity/u);
  });

  it('rejects a maintenance receipt that does not preserve the channel data boundary', () => {
    const input = baseInput();
    input.maintenance.otherChannelsUnchanged = false;
    expect(() => createFinalLocalTestDeliveryReceipt(input)).toThrow(/preservation is incomplete/u);
  });

  it('records the launch executable identity before and after both runtime probes', async () => {
    const source = await readFile(new URL('../../../scripts/windows-real-launch-test.mjs', import.meta.url), 'utf8');
    for (const marker of [
      "schemaVersion: 3",
      'captureExecutableIdentity',
      'executableIdentityBefore',
      'executableIdentityAfter',
      'unchangedAcrossLaunches',
      'executableIdentity: executableIdentityEvidence'
    ]) expect(source).toContain(marker);
  });

  it('exposes only the explicit final receipt producer command and does not package as a side effect', async () => {
    const [rawPackage, producer] = await Promise.all([
      readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
      readFile(new URL('../../../scripts/create-bronze-final-local-test-delivery.mjs', import.meta.url), 'utf8')
    ]);
    const packageJson = JSON.parse(rawPackage) as { scripts: Record<string, string> };
    expect(packageJson.scripts['create:bronze:final-local-test-delivery'])
      .toBe('node scripts/create-bronze-final-local-test-delivery.mjs');
    expect(producer).toContain("requireOption(options, 'narration-tr')");
    expect(producer).toContain("requireOption(options, 'narration-en')");
    expect(producer).toContain('verifyElectronFuseBinary(packagedRuntime.fullPath)');
    expect(producer).toContain("protectionEnabledSignedRetest: 'NOT_RUN'");
    expect(producer).not.toMatch(/electron-builder|package:win|clean-stale-windows-installers/u);
  });
});
