import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCT_NAVIGATION_GROUPS, PRODUCT_NAVIGATION_ROUTES } from '@ppt/domain';
import {
  cleanupFailedFinalDeliveryWrite,
  createFinalLocalTestDeliveryReceipt,
  FINAL_LOCAL_TEST_DELIVERY_SCHEMA_VERSION
} from '../../../scripts/create-bronze-final-local-test-delivery.mjs';
import { ELECTRON_FUSE_POLICY } from '../scripts/electron-fuse-policy.mjs';
import {
  createSemanticControlIdentity,
  INSTALLED_UI_KEYBOARD_PLAN,
  INSTALLED_UI_SCROLL_PLAN
} from '../../../scripts/lib/installed-ui-interaction-coverage.mjs';
import {
  CANONICAL_UNIVERSAL_AFFECTED_VITEST_FILES,
  CANONICAL_UNIVERSAL_DEPENDENT_RECORDS
} from '../../../scripts/lib/mutation-release-evidence.mjs';
import {
  INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY,
  INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY_SHA256
} from '../../../scripts/lib/windows-native-file-dialog-uat.mjs';

const sha = (value: string) => value.repeat(64);
const applicationVersion = '22.08.2026.50';
const packageVersion = '22.8.2026-50';
const checkoutRoot = resolve(process.cwd());
const installerPath = resolve(checkoutRoot, 'apps', 'desktop', 'release', 'ParsYuva-Bronze-22.08.2026.50.exe');
const packagedPath = resolve(checkoutRoot, 'apps', 'desktop', 'release', 'win-unpacked', 'ParsYuva-Bronze.exe');
const installedPath = 'C:\\Program Files\\PPT\\ParsYuva-Bronze\\ParsYuva-Bronze.exe';
const sourceCommit = 'a'.repeat(40);
const sourceTree = 'b'.repeat(40);
const expectedReleaseId = 'bronze-2026-08-22-r50';
const digest = (value: number) => value.toString(16).padStart(64, '0');
const jsonSha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sourceProvenance = {
  schemaVersion: 1,
  policyId: 'PPT-RELEASE-CHANNEL-WORKTREE-ISOLATION-V1',
  channel: 'Bronze',
  source: '06_KOD/kanallar/Bronze',
  worktreeDirectory: 'Bronze',
  branch: 'channel/bronze',
  headCommit: sourceCommit,
  headTree: sourceTree,
  objectFormat: 'sha1',
  worktreeClean: true,
  sharedGitObjectDatabaseVerified: true,
  trackedCommitFingerprint: { sha256: sha('a'), fileCount: 5000, totalBytes: 50_000_000 },
  governedSourceFingerprint: { sha256: sha('b'), fileCount: 4000 }
};

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

const baseInput = (mode: 'bootstrap' | 'recovery' | 'continuation' = 'bootstrap'): any => {
  const installerRunId = '10000000-0000-4000-8000-000000000001';
  const installationRunId = '20000000-0000-4000-8000-000000000002';
  const installedUiRunId = '30000000-0000-4000-8000-000000000003';
  const installerEvidenceRoot = resolve(checkoutRoot, 'artifacts', 'validation', 'installer-experience', installerRunId);
  const installationEvidenceRoot = resolve(checkoutRoot, 'artifacts', 'validation', 'windows-installed-release-uat', installationRunId);
  const installedUiEvidenceRoot = resolve(installationEvidenceRoot, 'installed-frontend');
  const installer = identity(installerPath, sha('1'), 120_000_000);
  const packagedRuntime = identity(packagedPath, sha('2'), 225_000_000);
  const installedRuntime = identity(installedPath, sha('2'), 225_000_000);
  const previousSourceProvenance = {
    ...sourceProvenance,
    headCommit: '9'.repeat(40), headTree: '8'.repeat(40),
    trackedCommitFingerprint: { sha256: digest(801), fileCount: 4_900, totalBytes: 49_000_000 },
    governedSourceFingerprint: { sha256: digest(802), fileCount: 3_900 }
  };
  const previousPackageReceipt = {
    schemaVersion: 2, id: 'PPT-WINDOWS-PACKAGE-PROVENANCE-V2', evidenceKind: 'WINDOWS_PACKAGE_PROVENANCE',
    status: 'PASS', buildMode: 'LOCAL_UNSIGNED_NSIS', release: 'Bronze 22.08.2026.50',
    releaseId: 'bronze-2026-08-22-r50', sourceProvenance: previousSourceProvenance,
    producer: { path: 'apps/desktop/scripts/run-electron-builder.mjs', sizeBytes: 2_001, sha256: digest(803) },
    artifacts: { packagedRuntime: { path: packagedPath, sizeBytes: 224_000_000, sha256: digest(804) } }
  };
  const previousPackageArchiveBinding = { sizeBytes: 1_600, sha256: digest(805) };
  const previousPackageHistoryBundleReceipt = {
    schemaVersion: 1, id: 'PPT-WINDOWS-PACKAGE-PROVENANCE-HISTORY-BUNDLE-V1', status: 'PASS',
    release: previousPackageReceipt.release, releaseId: previousPackageReceipt.releaseId,
    channel: 'Bronze', version: '22.08.2026.50', packageVersion: '22.8.2026-50',
    sourceCommit: previousSourceProvenance.headCommit, producer: { ...previousPackageReceipt.producer },
    packageProvenance: {
      sourcePath: 'artifacts/validation/windows-package-provenance.json',
      archivePath: 'windows-package-provenance.json', ...previousPackageArchiveBinding
    }
  };
  const installerScreenshots = [
    ['01-family-space.png', 3], ['02-local-privacy.png', 4], ['03-narrated-guidance.png', 5]
  ].map(([name, hashIndex], index) => ({
    path: `artifacts/validation/installer-experience/${installerRunId}/${name}`,
    sizeBytes: 1_000 + index, width: 900, height: 620, sha256: digest(Number(hashIndex)),
    expectedTitle: ['Ailenizi oluşturalım', 'Bilgileriniz bu bilgisayarda kalır', 'Rehberli ve erişilebilir bir karşılama'][index]
  }));
  const slides = ['family-space', 'local-privacy', 'narrated-guidance'].map((id, index) => ({
    id,
    title: installerScreenshots[index].expectedTitle,
    visibleProgressBarCount: 0,
    screenshot: installerScreenshots[index].path,
    screenshotSha256: installerScreenshots[index].sha256
  }));
  const routeIds = PRODUCT_NAVIGATION_ROUTES.map((route) => route.id);
  const navigationSurfaces = [
    ...PRODUCT_NAVIGATION_ROUTES.map((route, index) => ({ mode: 'NORMAL', index, routeId: route.id, label: route.label, viewport: { width: 1280, height: 900 }, status: 'PASS' })),
    ...PRODUCT_NAVIGATION_ROUTES.map((route, index) => ({ mode: 'STRESS_760X720_200_HIGH_CONTRAST', index, routeId: route.id, label: route.label, viewport: { width: 760, height: 720 }, status: 'PASS' }))
  ];
  const interactionMatrix = routeIds.map((routeId, index) => {
    const route = PRODUCT_NAVIGATION_ROUTES[index];
    const control = createSemanticControlIdentity({
      routeId, scenario: 'BASELINE', surfaceId: 'sidebar', role: 'button',
      locator: `sidebar[0]>[data-navigation-route=${JSON.stringify(routeId)}]`,
      navigationRouteId: routeId, dataRoute: routeId, href: '',
      label: route.label, visible: true, enabled: true, valueState: 'UNSPECIFIED', actionHint: 'NAVIGATION_ROUTE'
    });
    const fingerprint = digest(index + 101);
    const gesture = {
      routeId, runtimeId: `uat-control-${index + 1}`, activationMethod: 'KEYBOARD_ENTER',
      expectedKeyboardActivation: 'ENTER', modalFocusTrap: 'NOT_APPLICABLE_NO_OPEN_MODAL',
      hitTestPassed: true, focusVisible: true, x: 100 + index, y: 200 + index
    };
    return {
      ...control, navigationRouteId: routeId, ariaControls: '', disposition: 'CLICKED_OUTCOME_VERIFIED', reason: null,
      outcome: {
        status: 'PASS', kind: 'IDEMPOTENT_READ_ONLY', safetyClassification: 'STANDARD_SYNTHETIC_OUTCOME_REQUIRED',
        settled: true, userGesture: 'KEYBOARD_USER_GESTURE', beforeFingerprint: fingerprint, afterFingerprint: fingerprint,
        actionCorrelation: { controlIdentity: control.identity, stateKey: control.stateKey, gestureSha256: jsonSha(gesture), gesture },
        postcondition: { status: 'PASS', actionSpecific: true, kind: 'NAVIGATION_ROUTE_CURRENT' },
        routeReadback: {
          status: 'PASS', expectedRouteId: routeId, observedRouteId: routeId,
          controlDataRoute: routeId, controlHref: '', controlRole: 'button'
        },
        quietWindow: {
          status: 'PASS', domStable: true, networkStable: true, ipcStable: true,
          pageLifecycleStable: true, networkInFlight: 0, ipcInFlight: 0, quietForMs: 750,
          finalSerials: {
            domSerial: index + 1, ipcSerial: index + 2, ipcInFlight: 0,
            pageSerial: index + 3, networkSerial: index + 4, networkInFlight: 0,
            barrierFingerprint: JSON.stringify({ lifecycle: 'ready', version: applicationVersion })
          }
        },
        keyboardActivation: { status: 'PASS', expected: 'ENTER', actual: 'ENTER', focusVisible: true },
        actionSpecificReadback: true,
        evidence: [{ kind: 'CDP_ACTION_SPECIFIC_OUTCOME_READBACK', sha256: digest(index + 301) }],
        assertions: [{ id: 'ACTION_SPECIFIC_READBACK_VERIFIED', status: 'PASS' }]
      },
      externalEvidence: null
    };
  });
  const nativeScreenshotReadbacks: Array<{ path: string; sizeBytes: number; width: number; height: number; sha256: string }> = [];
  const ownedProcessIdentities: Array<{ processId: number; creationTimeUtc: string; result: string }> = [];
  const makeNativeDecision = ({
    control, recordIndex, decision, dialogKind, selectionKind, extension, terminalRestore = false
  }: {
    control: ReturnType<typeof createSemanticControlIdentity>;
    recordIndex: number;
    decision: 'CANCEL' | 'ACCEPT';
    dialogKind: 'OPEN' | 'SAVE';
    selectionKind: string;
    extension: string;
    terminalRestore?: boolean;
  }) => {
    const lowerDecision = decision.toLowerCase();
    const ownerProcessId = 5_000 + recordIndex;
    const ownerCreationTimeUtc = `2026-08-23T16:${String(40 + recordIndex).padStart(2, '0')}:00.000Z`;
    if (!ownedProcessIdentities.some((item) => item.processId === ownerProcessId && item.creationTimeUtc === ownerCreationTimeUtc)) {
      ownedProcessIdentities.push({ processId: ownerProcessId, creationTimeUtc: ownerCreationTimeUtc, result: 'STOPPED' });
    }
    const targetWindowMaterial = {
      className: '#32770', processId: 7_000 + recordIndex * 2 + (decision === 'ACCEPT' ? 1 : 0),
      creationTimeUtc: `2026-08-23T16:${String(40 + recordIndex).padStart(2, '0')}:${decision === 'ACCEPT' ? '02' : '01'}.000Z`,
      ownerProcessId, ownerCreationTimeUtc, titleSha256: digest(1_000 + recordIndex * 10 + (decision === 'ACCEPT' ? 1 : 0)),
      automationIdSha256: digest(1_100 + recordIndex * 10 + (decision === 'ACCEPT' ? 1 : 0)),
      ownershipMode: 'DIRECT_TARGET_PROCESS',
      bounds: { left: 100, top: 90, width: 780, height: 560 },
      uiAutomationInvokePattern: true, printWindowTargetOnly: true
    };
    ownedProcessIdentities.push({ processId: targetWindowMaterial.processId, creationTimeUtc: targetWindowMaterial.creationTimeUtc, result: 'STOPPED' });
    const gesture = {
      routeId: control.routeId, runtimeId: `native-${control.routeId}-${recordIndex}-${lowerDecision}`,
      activationMethod: control.role === 'input' ? 'KEYBOARD_TEXT_ENTRY' : 'KEYBOARD_ENTER',
      expectedKeyboardActivation: control.role === 'input' ? 'TEXT_ENTRY' : 'ENTER',
      modalFocusTrap: 'NOT_APPLICABLE_NO_OPEN_MODAL', hitTestPassed: true, focusVisible: true,
      x: 300 + recordIndex, y: 400 + recordIndex
    };
    const beforeFingerprint = digest(1_200 + recordIndex * 10);
    const afterFingerprint = decision === 'CANCEL' ? beforeFingerprint : digest(1_201 + recordIndex * 10);
    const screenshot = {
      path: `artifacts/validation/windows-installed-release-uat/${installationRunId}/installed-frontend/native-${control.routeId}-${control.identity.slice(0, 12)}-${lowerDecision}.png`,
      sizeBytes: 3_000 + recordIndex * 10 + (decision === 'ACCEPT' ? 1 : 0),
      width: 780, height: 560,
      sha256: digest(1_300 + recordIndex * 10 + (decision === 'ACCEPT' ? 1 : 0)),
      readbackVerified: true, targetOnly: true,
      physicalPixelOcr: { status: 'NOT_RUN_PHYSICAL_PIXEL_OCR', reason: 'TESSERACT_NOT_AVAILABLE', physicalPixelSecretClaimed: false, ocrTextRecorded: false }
    };
    nativeScreenshotReadbacks.push({ path: screenshot.path, sizeBytes: screenshot.sizeBytes, width: screenshot.width, height: screenshot.height, sha256: screenshot.sha256 });
    const existsAfterDecision = dialogKind === 'OPEN' || decision === 'ACCEPT';
    const postconditionKind = decision === 'CANCEL'
      ? 'NATIVE_DIALOG_CANCELLED_WITHOUT_SELECTION_MUTATION'
      : terminalRestore ? 'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK'
        : dialogKind === 'SAVE' ? 'NATIVE_SAVE_ARTIFACT_READBACK_VERIFIED'
          : 'NATIVE_OPEN_SELECTION_AND_APPLICATION_READBACK_VERIFIED';
    return {
      status: 'PASS', decision, targetObserved: true, targetClosed: true, dialogKind,
      beforeFingerprint, afterFingerprint, semanticStateChanged: decision === 'ACCEPT',
      actionCorrelation: { controlIdentity: control.identity, stateKey: control.stateKey, gestureSha256: jsonSha(gesture), gesture },
      targetWindow: { ...targetWindowMaterial, identitySha256: jsonSha(targetWindowMaterial) },
      screenshot,
      selection: {
        kind: selectionKind, synthetic: true, fileName: `synthetic-${recordIndex}${extension}`, extension,
        existsAfterDecision, sizeBytes: existsAfterDecision ? 4_000 + recordIndex : 0,
        sha256: existsAfterDecision ? digest(1_400 + recordIndex) : null,
        pathRecorded: false, withinDisposableProfile: true
      },
      postcondition: {
        status: 'PASS', kind: postconditionKind, applicationReadbackVerified: true,
        selectedArtifactReadbackVerified: existsAfterDecision,
        ...(terminalRestore ? { process: {
          previousProcessId: 6_000, previousCreationTimeUtc: '2026-08-23T16:44:00.000Z', previousRootAbsent: true,
          replacementProcessId: 6_001, replacementCreationTimeUtc: '2026-08-23T16:44:03.000Z',
          replacementExecutableSha256: installedRuntime.sha256, exactExecutablePathVerified: true,
          remoteDebuggingPortInherited: true, restoredAccountInitialized: true, authenticatedSessionRevoked: true
        } } : {})
      },
      quietWindow: {
        status: 'PASS', domStable: true, networkStable: true, ipcStable: true, pageLifecycleStable: true,
        networkInFlight: 0, ipcInFlight: 0, quietForMs: 750,
        finalSerials: { domSerial: recordIndex + 1, ipcSerial: recordIndex + 2, ipcInFlight: 0, pageSerial: recordIndex + 3, networkSerial: recordIndex + 4, networkInFlight: 0, barrierFingerprint: `native-ready-${recordIndex}-${lowerDecision}` }
      }
    };
  };
  const nativeRecords: Array<any> = [];
  const nativeControlsBySpecId = new Map<string, ReturnType<typeof createSemanticControlIdentity>>();
  const disabledNativeControlsBySpecId = new Map<string, ReturnType<typeof createSemanticControlIdentity>>();
  const addNativeControl = ({ specId, routeId, label, dialogKind, selectionKind, extension, terminalRestore = false, recordIndex }: {
    specId: string; routeId: string; label: string; dialogKind: 'OPEN' | 'SAVE'; selectionKind: string; extension: string; terminalRestore?: boolean; recordIndex: number;
  }) => {
    const control = createSemanticControlIdentity({
      routeId, scenario: 'BASELINE', surfaceId: 'main', role: terminalRestore ? 'button' : 'input',
      inputType: terminalRestore ? '' : 'file', locator: `main[0]>[data-native-uat=${JSON.stringify(`${routeId}-${recordIndex}`)}]`,
      label, visible: true, enabled: true, valueState: 'UNSPECIFIED', actionHint: terminalRestore ? 'TERMINAL' : 'NATIVE_DIALOG'
    });
    const cancel = makeNativeDecision({ control, recordIndex, decision: 'CANCEL', dialogKind, selectionKind, extension, terminalRestore });
    const accept = makeNativeDecision({ control, recordIndex, decision: 'ACCEPT', dialogKind, selectionKind, extension, terminalRestore });
    nativeControlsBySpecId.set(specId, control);
    const record = { specId, routeId, controlIdentity: control.identity, stateKey: control.stateKey, labelClass: `${routeId}:${dialogKind}:${selectionKind}`, dialogKind, status: 'PASS', cancel, accept };
    nativeRecords.push(record);
    const baseOutcome = {
      status: 'PASS', settled: true, userGesture: 'KEYBOARD_USER_GESTURE',
      beforeFingerprint: accept.beforeFingerprint, afterFingerprint: accept.afterFingerprint,
      semanticStateChanged: true, actionSpecificReadback: true, actionCorrelation: accept.actionCorrelation,
      postcondition: { ...accept.postcondition, actionSpecific: true },
      keyboardActivation: { status: 'PASS', expected: accept.actionCorrelation.gesture.expectedKeyboardActivation, actual: accept.actionCorrelation.gesture.expectedKeyboardActivation, focusVisible: true, modalFocusTrap: 'NOT_APPLICABLE_NO_OPEN_MODAL' },
      quietWindow: accept.quietWindow, nativeDialog: record
    };
    const cancelOutcome = terminalRestore ? {
      status: 'PASS', kind: 'TERMINAL_DISPOSABLE_PROFILE', safetyClassification: 'DISPOSABLE_PROFILE_SAFE_OUTCOME_REQUIRED',
      settled: true, userGesture: 'KEYBOARD_USER_GESTURE', beforeFingerprint: cancel.beforeFingerprint, afterFingerprint: cancel.beforeFingerprint,
      semanticStateChanged: false, actionSpecificReadback: true, actionCorrelation: cancel.actionCorrelation,
      postcondition: { status: 'PASS', actionSpecific: true, kind: 'TERMINAL_CANCEL_STATE_UNCHANGED' },
      keyboardActivation: { status: 'PASS', expected: 'ENTER', actual: 'ENTER', focusVisible: true, modalFocusTrap: 'NOT_APPLICABLE_NO_OPEN_MODAL' },
      evidence: [{ kind: 'CDP_ACTION_SPECIFIC_OUTCOME_READBACK', sha256: digest(1_500 + recordIndex) }],
      assertions: [{ id: 'TERMINAL_CANCEL_STATE_UNCHANGED', status: 'PASS' }], quietWindow: cancel.quietWindow,
      profileClassification: 'SYNTHETIC_DISPOSABLE_PROFILE', terminalDecision: 'CANCEL',
      terminalPostcondition: { status: 'PASS', observed: true, decision: 'CANCEL', kind: 'TERMINAL_CANCEL_STATE_UNCHANGED', controlIdentity: control.identity, stateKey: control.stateKey, beforeFingerprint: cancel.beforeFingerprint, afterFingerprint: cancel.beforeFingerprint }
    } : {
      ...baseOutcome, kind: 'NATIVE_DIALOG_ACCEPT', safetyClassification: 'NATIVE_TARGET_WINDOW_EVIDENCE_REQUIRED',
      evidence: [{ kind: 'WINDOWS_UIAUTOMATION_NATIVE_DIALOG_CANCEL_ACCEPT_READBACK', sha256: jsonSha(record) }],
      assertions: [{ id: 'OWNED_NATIVE_DIALOG_CANCEL_VERIFIED', status: 'PASS' }, { id: 'OWNED_NATIVE_DIALOG_ACCEPT_AND_POSTCONDITION_VERIFIED', status: 'PASS' }]
    };
    interactionMatrix.push({ ...control, ariaControls: '', disposition: 'CLICKED_OUTCOME_VERIFIED', reason: null, outcome: cancelOutcome, externalEvidence: null });
    return { control, record, acceptOutcome: terminalRestore ? {
      ...baseOutcome, kind: 'TERMINAL_DISPOSABLE_PROFILE', safetyClassification: 'DISPOSABLE_PROFILE_SAFE_OUTCOME_REQUIRED',
      evidence: [{ kind: 'WINDOWS_UIAUTOMATION_NATIVE_RESTORE_TERMINAL_READBACK', sha256: jsonSha(record) }],
      assertions: [{ id: 'NATIVE_RESTORE_CANCEL_AND_ACCEPT_VERIFIED', status: 'PASS' }, { id: 'OWNED_RELAUNCH_AND_SESSION_REVOCATION_VERIFIED', status: 'PASS' }],
      profileClassification: 'SYNTHETIC_DISPOSABLE_PROFILE', terminalDecision: 'ACCEPT',
      terminalPostcondition: { status: 'PASS', observed: true, decision: 'ACCEPT', kind: 'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK', controlIdentity: control.identity, stateKey: control.stateKey, beforeFingerprint: accept.beforeFingerprint, afterFingerprint: accept.afterFingerprint, process: accept.postcondition.process }
    } : null };
  };
  addNativeControl({ specId: 'finance-import', routeId: 'finance', label: 'Dosya seç ve önizle', dialogKind: 'OPEN', selectionKind: 'FINANCE_IMPORT', extension: '.csv', recordIndex: 0 });
  addNativeControl({ specId: 'security-device-backup', routeId: 'security', label: 'Cihaz korumalı tam yedek', dialogKind: 'SAVE', selectionKind: 'GENERATED_BACKUP', extension: '.pptbackup', recordIndex: 1 });
  const restoreNative = addNativeControl({ specId: 'security-restore-backup', routeId: 'security', label: 'Geri yükle', dialogKind: 'OPEN', selectionKind: 'GENERATED_BACKUP', extension: '.pptbackup', terminalRestore: true, recordIndex: 2 });
  const terminalAcceptOutcomes = [restoreNative.acceptOutcome];
  const disabledArchiveNative = createSemanticControlIdentity({
    routeId: 'archive', scenario: 'BASELINE', surfaceId: 'main', role: 'input', inputType: 'file',
    locator: 'main[0]>[data-installed-uat=archive-add-file-disabled]', label: 'Dosya ekle',
    visible: true, enabled: false, valueState: 'UNSPECIFIED', actionHint: 'NATIVE_DIALOG'
  });
  disabledNativeControlsBySpecId.set('archive-add-file', disabledArchiveNative);
  interactionMatrix.push({
    ...disabledArchiveNative, ariaControls: '', disposition: 'BLOCKED_DISABLED',
    reason: 'VISIBLE_DISABLED_OR_PRECONDITION_NOT_MET', outcome: null, externalEvidence: null
  });
  const permissionControl = createSemanticControlIdentity({
    routeId: 'permissions', scenario: 'BASELINE', surfaceId: 'main', role: 'button',
    locator: 'main[0]>[data-installed-uat=permission-denied]', label: 'Yetki iste',
    visible: true, enabled: true, valueState: 'UNSPECIFIED', actionHint: 'STANDARD'
  });
  const permissionGesture = {
    routeId: 'permissions', runtimeId: 'permission-denied-control', activationMethod: 'KEYBOARD_ENTER',
    expectedKeyboardActivation: 'ENTER', modalFocusTrap: 'NOT_APPLICABLE_NO_OPEN_MODAL',
    hitTestPassed: true, focusVisible: true, x: 610, y: 420
  };
  interactionMatrix.push({
    ...permissionControl, ariaControls: '', disposition: 'CLICKED_OUTCOME_VERIFIED', reason: null, externalEvidence: null,
    outcome: {
      status: 'PASS', kind: 'VALIDATION_REJECTION', safetyClassification: 'STANDARD_SYNTHETIC_OUTCOME_REQUIRED',
      settled: true, userGesture: 'KEYBOARD_USER_GESTURE', beforeFingerprint: digest(1_600), afterFingerprint: digest(1_601),
      semanticStateChanged: false, actionSpecificReadback: true,
      actionCorrelation: { controlIdentity: permissionControl.identity, stateKey: permissionControl.stateKey, gestureSha256: jsonSha(permissionGesture), gesture: permissionGesture },
      postcondition: { status: 'PASS', actionSpecific: true, kind: 'TARGET_VALIDATION_MESSAGE_CHANGED' },
      keyboardActivation: { status: 'PASS', expected: 'ENTER', actual: 'ENTER', focusVisible: true, modalFocusTrap: 'NOT_APPLICABLE_NO_OPEN_MODAL' },
      quietWindow: { status: 'PASS', domStable: true, networkStable: true, ipcStable: true, pageLifecycleStable: true, networkInFlight: 0, ipcInFlight: 0, quietForMs: 750,
        finalSerials: { domSerial: 30, ipcSerial: 31, ipcInFlight: 0, pageSerial: 32, networkSerial: 33, networkInFlight: 0, barrierFingerprint: 'permission-denied-ready' } },
      evidence: [{ kind: 'CDP_ACTION_SPECIFIC_OUTCOME_READBACK', sha256: digest(1_602) }],
      assertions: [{ id: 'NATURAL_VALIDATION_MESSAGE_VISIBLE', status: 'PASS' }]
    }
  });
  const interactionPasses = routeIds.flatMap((routeId, routeIndex) => {
    const routeStateKeys = interactionMatrix.filter((entry) => entry.routeId === routeId).map((entry) => entry.stateKey).sort();
    const visibleStateKeys = [...routeStateKeys];
    return [0, 1, 2].map((stablePasses) => ({
      routeId, scenario: 'BASELINE', discoveredVisibleCount: visibleStateKeys.length,
      visibleStateKeys, visibleControlSetSha256: jsonSha(visibleStateKeys),
      newStateCount: stablePasses === 0 ? routeStateKeys.length : 0,
      newStateKeys: stablePasses === 0 ? routeStateKeys : [], stablePasses,
      quietWindow: {
        status: 'PASS', domStable: true, networkStable: true, ipcStable: true,
        pageLifecycleStable: true, networkInFlight: 0, ipcInFlight: 0, quietForMs: 750 + routeIndex,
        finalSerials: {
          domSerial: routeIndex + stablePasses, ipcSerial: routeIndex + 10, ipcInFlight: 0,
          pageSerial: routeIndex + 15, networkSerial: routeIndex + 20, networkInFlight: 0,
          barrierFingerprint: JSON.stringify({ lifecycle: 'ready', routeId })
        }
      }
    }));
  });
  const stateAssertions = {
    EMPTY: 'FIRST_FAMILY_FORM_EMPTY', POPULATED: 'FIRST_FAMILY_FORM_POPULATED',
    LOADING: 'VISIBLE_LOADING_STATE_OBSERVED', VALIDATION_ERROR: 'EMPTY_FIRST_FAMILY_FORM_REJECTED',
    PERMISSION_DENIED: 'VISIBLE_PERMISSION_DENIAL_AFTER_GESTURE',
    OFFLINE: 'NETWORK_OFFLINE_LOCAL_SHELL_READBACK',
    ERROR: 'FIRST_RUN_TWO_FACTOR_IPC_REJECTION_NATURAL_UI',
    SUCCESS: 'AUTHENTICATED_TRUSTED_DEVICE_READBACK',
    CONFIRM_CANCEL: 'JAVASCRIPT_CONFIRMATION_AND_TERMINAL_POSTCONDITION',
    CONFIRM_ACCEPT: 'JAVASCRIPT_CONFIRMATION_AND_TERMINAL_POSTCONDITION'
  } as const;
  const logicalStateBinding = (routeId: string, logicalControlId: string) => {
    const controlIdentity = jsonSha({ routeId, logicalControlId });
    return { routeId, controlIdentity, stateKey: jsonSha({ controlIdentity, logicalControlId }) };
  };
  const rawStateEvidence = (binding: { routeId: string; controlIdentity: string; stateKey: string }, outcomeKind: string, snapshot: Record<string, unknown>) => ({
    ...binding, outcomeKind, snapshot, snapshotSha256: jsonSha(snapshot)
  });
  const firstRunTwoFactorBinding = logicalStateBinding('onboarding', 'first-run-two-factor-rejection');
  const firstRunTwoFactorGesture = {
    routeId: 'onboarding', runtimeId: 'first-run-two-factor-rejection', activationMethod: 'POINTER_MOUSE_PRESS_RELEASE',
    expectedPointerActivation: 'POINTER_CLICK', button: 'left', pointerSequence: ['mouseMoved', 'mousePressed', 'mouseReleased'],
    hitTestPassed: true, focusVisible: true, x: 640, y: 680
  };
  const applicationStateMatrix = Object.entries(stateAssertions).map(([scenario, assertion]) => {
    const rawEvidence = scenario === 'LOADING' ? (() => {
      const visibleSelector = '[aria-busy="true"],[data-async-state="loading"],.loading,.loading-state';
      const textSha256 = digest(480);
      const pageSerial = 4;
      const snapshot = {
        visible: true, visibleSelector, textSha256,
        actionCorrelation: {
          kind: 'INITIAL_DOCUMENT_LOADING_OBSERVATION', pageSerial,
          observationSha256: jsonSha({ visibleSelector, textSha256, pageSerial })
        }
      };
      return rawStateEvidence(logicalStateBinding('onboarding', 'initial-document'), 'VISIBLE_LOADING_STATE', snapshot);
    })() : scenario === 'EMPTY'
      ? rawStateEvidence(logicalStateBinding('onboarding', 'first-family-form'), 'FORM_EMPTY_READBACK', { allRequiredInputsEmpty: true })
      : scenario === 'POPULATED'
        ? rawStateEvidence(logicalStateBinding('onboarding', 'first-family-form'), 'FORM_POPULATED_READBACK', { allRequiredInputsPopulated: true })
        : scenario === 'VALIDATION_ERROR'
          ? rawStateEvidence(logicalStateBinding('onboarding', 'first-family-form'), 'VALIDATION_REJECTION', { rejected: true, invalidCount: 3, visibleAlertCount: 1 })
          : scenario === 'PERMISSION_DENIED'
            ? rawStateEvidence({ routeId: permissionControl.routeId, controlIdentity: permissionControl.identity, stateKey: permissionControl.stateKey }, 'VALIDATION_REJECTION', {
              visible: true,
              visibleSelector: '[role="alert"],.async-state-panel[data-async-state="error"],.field-error',
              textSha256: digest(481),
              actionCorrelation: {
                controlIdentity: permissionControl.identity,
                stateKey: permissionControl.stateKey,
                gestureSha256: jsonSha(permissionGesture)
              }
            })
            : scenario === 'OFFLINE'
              ? rawStateEvidence(logicalStateBinding('dashboard', 'offline-local-shell'), 'OFFLINE_LOCAL_OPERATION_READBACK', {
                navigatorOnLine: false,
                authenticatedShellVisible: true,
                canonicalRouteCount: 22,
                preloadIpcReadbackVerified: true,
                authIpcReadbackVerified: true,
                dashboardIpcReadbackVerified: true,
                beforeIpcSummarySha256: digest(482),
                offlineIpcSummarySha256: digest(482)
              })
              : scenario === 'ERROR'
                ? rawStateEvidence(firstRunTwoFactorBinding, 'AUTHENTICATION_REJECTION', {
                  rejected: true,
                  ipcAttempted: true,
                  securityShellVisible: true,
                  actionReenabled: true,
                  twoFactorEnabled: false,
                  trustedDevice: false,
                  visibleAlertCount: 1,
                  messageSha256: digest(483),
                  technicalLeakDetected: false,
                  actionCorrelation: {
                    controlIdentity: firstRunTwoFactorBinding.controlIdentity,
                    stateKey: firstRunTwoFactorBinding.stateKey,
                    gestureSha256: jsonSha(firstRunTwoFactorGesture)
                  }
                })
            : scenario === 'SUCCESS'
              ? rawStateEvidence(logicalStateBinding('dashboard', 'authenticated-shell'), 'AUTHENTICATED_TRUSTED_DEVICE', { initialized: true, authenticated: true, twoFactorEnabled: true, trustedDevice: true })
              : scenario === 'CONFIRM_CANCEL'
                ? rawStateEvidence({ routeId: restoreNative.control.routeId, controlIdentity: restoreNative.control.identity, stateKey: restoreNative.control.stateKey }, 'TERMINAL_DISPOSABLE_PROFILE', {
                  decision: 'CANCEL',
                  beforeFingerprint: restoreNative.control && interactionMatrix.find((entry) => entry.stateKey === restoreNative.control.stateKey)!.outcome.beforeFingerprint,
                  afterFingerprint: interactionMatrix.find((entry) => entry.stateKey === restoreNative.control.stateKey)!.outcome.afterFingerprint
                })
                : rawStateEvidence({ routeId: restoreNative.control.routeId, controlIdentity: restoreNative.control.identity, stateKey: restoreNative.control.stateKey }, 'TERMINAL_DISPOSABLE_PROFILE', {
                  decision: 'ACCEPT',
                  beforeFingerprint: restoreNative.acceptOutcome!.beforeFingerprint,
                  afterFingerprint: restoreNative.acceptOutcome!.afterFingerprint
                });
    return { scenario, status: 'PASS', evidence: [{ assertion, sha256: jsonSha(rawEvidence), rawEvidence }] };
  });
  const visualAudits = [
    { surfaceId: 'first-run-security', mode: 'NORMAL', viewport: { width: 1280, height: 900 } },
    { surfaceId: 'authenticated-shell', mode: 'NORMAL', viewport: { width: 1280, height: 900 } },
    ...PRODUCT_NAVIGATION_GROUPS.map((group) => ({ surfaceId: `module-${group.id}`, mode: 'NORMAL', viewport: { width: 1280, height: 900 } })),
    ...navigationSurfaces.map((entry) => ({ surfaceId: entry.routeId, mode: entry.mode, viewport: entry.viewport }))
  ].map((entry) => ({ ...entry, missingRoot: false, controlCount: 8, focusableCount: 6, focusProbe: true, issues: [] }));
  const nativeDialogInventory = INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY.map((specification, index) => {
    const control = nativeControlsBySpecId.get(specification.specId);
    const disabledControl = disabledNativeControlsBySpecId.get(specification.specId);
    const records = nativeRecords.filter((record) => record.specId === specification.specId);
    const snapshotHashes = [digest(1_700 + index)];
    const enabledControls = control ? [{ identity: control.identity, stateKey: control.stateKey, enabled: true }] : [];
    return {
      ...specification,
      status: control ? 'EXERCISED' : disabledControl ? 'DISABLED' : 'NOT_PRESENT',
      sourceSnapshot: {
        canonicalInventorySha256: INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY_SHA256,
        specificationSha256: jsonSha(specification)
      },
      routeDomSnapshot: {
        routeId: specification.routeId, observationCount: snapshotHashes.length,
        snapshotHashes, snapshotsSha256: jsonSha(snapshotHashes)
      },
      enabledControls,
      disabledControls: disabledControl ? [{ identity: disabledControl.identity, stateKey: disabledControl.stateKey, enabled: false }] : [],
      exercisedStateKeys: enabledControls.map((item) => item.stateKey),
      exercisedRecordSha256: records.map((record) => jsonSha(record)).sort()
    };
  });
  const installedScreenshots = [
    'onboarding-introduction.png', 'onboarding-family-empty.png', 'onboarding-family-filled-redacted.png',
    'onboarding-security-start.png', 'onboarding-security-redacted.png', 'authenticated-shell.png',
    ...PRODUCT_NAVIGATION_GROUPS.map((group) => `module-${group.id}.png`),
    ...PRODUCT_NAVIGATION_GROUPS.map((group) => `normal-${group.id}.png`),
    ...PRODUCT_NAVIGATION_GROUPS.map((group) => `stress-${group.id}.png`),
    'narration-tr.png', 'narration-en.png'
  ].map((name, index) => ({
    name, relativePath: `artifacts/validation/windows-installed-release-uat/${installationRunId}/installed-frontend/${name}`,
    sizeBytes: 2_000 + index, width: name.startsWith('stress-') ? 760 : 1280,
    height: name.startsWith('stress-') ? 720 : 900, sha256: digest(index + 501),
    readbackVerified: true, secretScanApplied: true, secretRedactionCount: 0,
    secretCategories: [],
    secretSurfaceScan: {
      status: 'PASS',
      categories: Object.fromEntries(['domText', 'formValues', 'attributes', 'pseudoContent', 'backgroundContent', 'canvasFallback']
        .map((category) => [category, { status: 'PASS', findingCount: 0 }])),
      canvasCount: 0, canvasFingerprints: [], rawSurfaceTextRecorded: false
    },
    physicalPixelOcr: {
      status: 'NOT_RUN_PHYSICAL_PIXEL_OCR', reason: 'TESSERACT_NOT_AVAILABLE',
      physicalPixelSecretClaimed: false, ocrTextRecorded: false
    },
    unredactedSecretCount: 0
  }));
  const input: any = {
    release: `Bronze ${applicationVersion}`,
    applicationVersion,
    packageVersion,
    sourceCommit,
    sourceProvenance,
    sourceProtection: {
      schemaVersion: 2,
      localReceiptStatus: 'LOCAL_RECEIPT_VERIFIED',
      externalLibraryReceiptStatus: 'PASS',
      officialCompletionClaimed: true,
      sourceProvenance,
      treeSha256: sourceProvenance.trackedCommitFingerprint.sha256,
      receipt: { path: 'receipt.json', sha256: sha('c') },
      backup: {
        scope: 'TRACKED_FILES_AT_EXACT_COMMIT',
        headCommit: sourceCommit,
        headTree: sourceTree,
        trackedCommitFingerprint: sourceProvenance.trackedCommitFingerprint,
        path: 'backup.zip', sha256: sha('d'), bytes: 10
      },
      externalReceipt: {
        path: 'external-receipt.json', sha256: sha('7'),
        readbackPath: 'external-readback.json', readbackSha256: sha('8'),
        storageBackend: 'EXTERNAL_USB_D_DRIVE', externalPath: 'D:\\AYM_LIBRARY\\Bronze', finalFileCount: 9
      }
    },
    sourceProtectionReadback: {
      status: 'PASS',
      verification: 'ACTUAL_LOCAL_RECEIPT_AND_BACKUP_SIZE_SHA256_READBACK',
      receipt: { path: 'receipt.json', sizeBytes: 1024, sha256: sha('c') },
      backup: { path: 'backup.zip', sizeBytes: 10, sha256: sha('d') }
    },
    externalSourceProtectionVerification: {
      status: 'PASS', requirement: 'PR-233', governanceRequirement: 'GOV-005', decision: 'DEC-267',
      treeSha256: sourceProvenance.trackedCommitFingerprint.sha256,
      externalPath: 'D:\\AYM_LIBRARY\\Bronze', files: 9
    },
    gitRemoteEquality: {
      status: 'PASS', branch: 'main', expectedCommit: sourceCommit, github: sourceCommit, backup: sourceCommit
    },
    governedPreflight: {
      status: 'PASS',
      sourceFingerprint: sourceProvenance.governedSourceFingerprint,
      rulesSha256: sha('e')
    },
    packageProvenance: {
      schemaVersion: 2,
      id: 'PPT-WINDOWS-PACKAGE-PROVENANCE-V2',
      evidenceKind: 'WINDOWS_PACKAGE_PROVENANCE',
      status: 'PASS',
      buildMode: 'LOCAL_UNSIGNED_NSIS',
      releaseId: expectedReleaseId,
      release: `Bronze ${applicationVersion}`,
      parentRelease: 'Bronze 22.08.2026.49',
      previousPackageProvenance: null,
      sourceProvenance,
      sourceProtection: {
        sha256: sha('f'), sizeBytes: 1024,
        localArtifactReadback: {
          status: 'PASS',
          receipt: { path: 'receipt.json', sizeBytes: 1024, sha256: sha('c') },
          backup: { path: 'backup.zip', sizeBytes: 10, sha256: sha('d') }
        }
      },
      mutationReleaseReadiness: {
        status: 'PASS', requirement: 'PR-235', decision: 'DEC-270', sourceCommit,
        strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275',
        baselineCommit: '9'.repeat(40), baselineReceiptSha256: '8'.repeat(64),
        governedSourceFingerprintSha256: sourceProvenance.governedSourceFingerprint.sha256,
        canonicalRuleRegistrySha256: sha('e'), changedFileCount: 12,
        targetedTestsPassed: 16, fullRegressionTestsPassed: 2280, sourceIntegrityFiles: 5000,
        dependencyClosure: {
          registry: {
            path: 'config/change-impact-dependency-registry.json', sizeBytes: 24_000, sha256: sha('7')
          },
          universalDependentRecords: [...CANONICAL_UNIVERSAL_DEPENDENT_RECORDS],
          universalAffectedVitestFiles: [...CANONICAL_UNIVERSAL_AFFECTED_VITEST_FILES],
          dependentRecords: [...CANONICAL_UNIVERSAL_DEPENDENT_RECORDS].sort((a,b)=>a.localeCompare(b,'en')),
          affectedVitestFiles: [...CANONICAL_UNIVERSAL_AFFECTED_VITEST_FILES].sort((a,b)=>a.localeCompare(b,'en')),
          dependentRecordBindingsSha256: sha('6'), affectedTestBindingsSha256: sha('5')
        }
      },
      artifacts: {
        installer: { sha256: installer.sha256, sizeBytes: installer.sizeBytes },
        packagedRuntime: { sha256: packagedRuntime.sha256, sizeBytes: packagedRuntime.sizeBytes }
      },
      generatedAt: '2026-08-23T16:34:00.000Z'
    },
    installer,
    packagedRuntime,
    installedRuntime,
    installerExperience: {
      schemaVersion: 2,
      id: 'PPT-WINDOWS-INSTALLER-EXPERIENCE-UAT-V2',
      evidenceKind: 'WINDOWS_INSTALLER_EXPERIENCE_UAT',
      status: 'PASS',
      exitCode: 0,
      runId: installerRunId,
      evidenceRoot: installerEvidenceRoot,
      release: `Bronze ${applicationVersion}`,
      releaseId: expectedReleaseId,
      sourceCommit,
      governedSourceFingerprintSha256: sourceProvenance.governedSourceFingerprint.sha256,
      canonicalRuleRegistrySha256: sha('e'),
      packageProvenance: { sha256: sha('9') },
      governedPreflight: { sha256: sha('0') },
      producer: { path: 'scripts/run-windows-installer-experience-uat.ps1', sha256: sha('1'), sizeBytes: 1_001 },
      installer: { sha256: installer.sha256, sizeBytes: installer.sizeBytes },
      window: { className: '#32770', slideCount: 3, noFakeProgress: true, slides },
      startedAt: '2026-08-23T16:35:00.000Z',
      completedAt: '2026-08-23T16:36:00.000Z',
      generatedAt: '2026-08-23T16:36:00.000Z',
      narration: { observed: true, language: 'tr' },
      cancellation: {
        requested: true,
        confirmationInvoked: true,
        processTreeExited: true,
        forcedCleanupRequired: false
      },
      installedPayloadSafety: { unchanged: true },
      screenshots: installerScreenshots
    },
    installationPreservation: {
      schemaVersion: 3,
      id: 'PPT-WINDOWS-INSTALLED-RELEASE-UAT110-V3',
      evidenceKind: 'WINDOWS_INSTALLED_RELEASE_PRESERVATION',
      status: 'PASS',
      exitCode: 0,
      runId: installationRunId,
      evidenceRoot: installationEvidenceRoot,
      startedAt: '2026-08-23T16:36:30.000Z',
      completedAt: '2026-08-23T16:36:34.000Z',
      classification: 'LOCAL_UNSIGNED_INSTALLATION_PRESERVATION_ONLY',
      installationMode: 'BOOTSTRAP_FRESH_INSTALL',
      release: `Bronze ${applicationVersion}`,
      expectedReleaseId,
      sourceCommit,
      generatedAt: '2026-08-23T16:36:35.000Z',
      installer: { sha256: installer.sha256, sizeBytes: installer.sizeBytes },
      packagedRuntime: { sha256: packagedRuntime.sha256, sizeBytes: packagedRuntime.sizeBytes },
      packageProvenance: { sha256: sha('9') },
      governedPreflight: { sha256: sha('0') },
      installerExperience: { sha256: sha('5') },
      previousPackageProvenance: null,
      installedBefore: null,
      recoveryBootstrapAuthority: null,
      producer: { path: 'scripts/run-windows-installed-release-uat.ps1', sha256: sha('2'), sizeBytes: 1_002 },
      syntheticMarker: { cleanupStatus: 'DELETED_AND_ABSENCE_READBACK_PASS' },
      cleanup: { markerDeleted: true, markerAbsentReadback: true, originalUserDataStateRestored: true },
      privacyBoundary: {
        existingUserFileContentsHashedForEquality: true,
        existingUserFileContentsRecorded: false,
        existingUserFileNamesRecorded: false,
        receiptContainsUserContent: false,
        contentEqualityMeasured: true
      },
      primaryInstallation: {
        status: 'PASS', classification: 'BOOTSTRAP_FRESH_INSTALL_SEQUENCE_50',
        installedEqualsPackaged: true, markerPreserved: true,
        allUserDataContentEqualityPreserved: true, otherChannelAndLegacyProgramMetadataPreserved: true,
        otherChannelWriteCount: 0, dataSelectionDialogObserved: false,
        bronzeRegistry: { exactSingleEntry: true },
        fromFileVersion: null, toFileVersion: packageVersion, fromSequence: null, toSequence: 50,
        exactSuccessor: false, governedBootstrap: true, recoveryBootstrap: false, targetInstallRootAbsentBefore: true,
        targetExecutableAbsentBefore: true, bronzeUninstallRegistryAbsentBefore: true,
        packagePreviousProvenanceAbsent: true,
        before: { program: { bronze: { exists: false } }, uninstallRegistry: { bronze: { entryCount: 0 } } }
      },
      freshInstall: {
        status: 'PASS', classification: 'BOOTSTRAP_FRESH_INSTALL_SEQUENCE_50',
        installedEqualsPackaged: true, markerPreserved: true,
        allUserDataContentEqualityPreserved: true, otherChannelAndLegacyProgramMetadataPreserved: true,
        otherChannelWriteCount: 0, dataSelectionDialogObserved: false,
        bronzeRegistry: { exactSingleEntry: true },
        fromFileVersion: null, toFileVersion: packageVersion, fromSequence: null, toSequence: 50,
        exactSuccessor: false, governedBootstrap: true, recoveryBootstrap: false, targetInstallRootAbsentBefore: true,
        targetExecutableAbsentBefore: true, bronzeUninstallRegistryAbsentBefore: true,
        packagePreviousProvenanceAbsent: true,
        before: { program: { bronze: { exists: false } }, uninstallRegistry: { bronze: { entryCount: 0 } } }
      },
      upgrade: null,
      maintenance: {
        status: 'PASS', classification: 'SAME_VERSION_MAINTENANCE',
        installedEqualsPackaged: true, markerPreserved: true,
        allUserDataContentEqualityPreserved: true, otherChannelAndLegacyProgramMetadataPreserved: true,
        otherChannelWriteCount: 0, dataSelectionDialogObserved: false,
        bronzeRegistry: { exactSingleEntry: true },
        beforeFileVersion: packageVersion, afterFileVersion: packageVersion, sameVersion: true,
        precedingPhase: 'BOOTSTRAP_FRESH_INSTALL_SEQUENCE_50'
      }
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
      schemaVersion: 3,
      id: 'PPT-INSTALLED-FRONTEND-USER-UAT111-V3',
      evidenceKind: 'INSTALLED_FRONTEND_USER_UAT',
      status: 'PASS',
      exitCode: 0,
      runId: installedUiRunId,
      parentRunId: installationRunId,
      evidenceRoot: `artifacts/validation/windows-installed-release-uat/${installationRunId}/installed-frontend`,
      producer: { path: 'scripts/run-installed-frontend-user-uat.mjs', sha256: sha('4'), sizeBytes: 1000 },
      release: `Bronze ${applicationVersion}`,
      runtimeKind: 'INSTALLED_EXECUTABLE',
      executable: installedPath,
      installedFileVersion: packageVersion,
      startedAt: '2026-08-23T16:38:27.000Z',
      completedAt: '2026-08-23T16:45:00.000Z',
      sourceCommit,
      releaseId: expectedReleaseId,
      governedSourceFingerprintSha256: sourceProvenance.governedSourceFingerprint.sha256,
      canonicalRuleRegistrySha256: sha('e'),
      packageProvenanceSha256: sha('9'),
      passwordRecorded: false,
      twoFactorSecretRecorded: false,
      recoveryCodesRecorded: false,
      containsUnredactedAuthenticationSecrets: false,
      secretAudit: {
        unknownSecretLikeFieldCount: 0, sensitiveScreenshotCount: 0,
        unredactedSecretCount: 0, receiptContainsAuthenticationSecret: false
      },
      executableIdentity: { sha256: installedRuntime.sha256, sizeBytes: installedRuntime.sizeBytes, fileVersion: packageVersion },
      checks: {
        firstRunIntroductionVisible: true,
        familyCreatedThroughVisibleForm: true,
        twoFactorStartedThroughVisibleButton: true,
        twoFactorCompletedThroughVisibleForm: true,
        currentDeviceTrustedThroughVisibleForm: true,
        authenticatedMainShellVisible: true,
        navigationSurfaceCount: 22,
        navigationPassCount: navigationSurfaces.length,
        navigationSurfaces,
        moduleMenuCount: 4,
        moduleMenus: PRODUCT_NAVIGATION_GROUPS.map((group) => ({
          groupId: group.id, label: group.label,
          routeCount: PRODUCT_NAVIGATION_ROUTES.filter((route) => route.groupId === group.id).length,
          status: 'PASS'
        })),
        clickedInteractionCount: interactionMatrix.filter((entry) => entry.disposition === 'CLICKED_OUTCOME_VERIFIED').length,
        deferredInteractionCount: 0,
        blockedInteractionCount: interactionMatrix.filter((entry) => entry.disposition === 'BLOCKED_DISABLED').length,
        interactionMatrixCount: interactionMatrix.length,
        interactionMatrix,
        interactionEntriesSha256: jsonSha(interactionMatrix),
        interactionMatrixStateKeys: interactionMatrix.map((entry) => entry.stateKey).sort(),
        interactionMatrixStateKeysSha256: jsonSha(interactionMatrix.map((entry) => entry.stateKey).sort()),
        fixedPointMatrixMembershipExact: true,
        interactionCoverageComplete: true,
        unclassifiedInteractionCount: 0,
        unexercisedEnabledInteractionCount: 0,
        interactionFixedPointReached: true,
        interactionStablePassesByContext: Object.fromEntries(routeIds.map((routeId) => [`${routeId}:BASELINE`, 2])),
        interactionRequiredQuietWindowMs: 600,
        interactionPasses,
        interactionPassesSha256: jsonSha(interactionPasses),
        disabledToEnabledTransitions: [],
        applicationStateMatrixComplete: true,
        applicationStateMatrix,
        accessibilityPlan: { keyboard: INSTALLED_UI_KEYBOARD_PLAN, scroll: INSTALLED_UI_SCROLL_PLAN },
        accessibilityResults: routeIds.map((routeId, routeIndex) => {
          const expectedScrollContainerIds = ['scroll-0', 'scroll-1'];
          const routeControls = interactionMatrix.filter((entry) => entry.routeId === routeId && entry.enabled === true)
            .sort((left, right) => left.stateKey.localeCompare(right.stateKey));
          const routeControl = routeControls[0];
          const enabledControlIdentities = routeControls.map((entry) => entry.identity).sort();
          const enabledControlStateKeys = routeControls.map((entry) => entry.stateKey).sort();
          const tooltipResults = [{
            id: 'tip-0', hoverVisible: true, focusDescriptionMatched: true,
            contentPresent: true, withinViewport: true, focused: true,
            targetIdentity: routeControl.identity, targetStateKey: routeControl.stateKey,
            describedByIds: ['tooltip-description'], contentCount: 1, contentSha256: digest(routeIndex + 850)
          }];
          return {
            routeId, status: 'PASS', enabledCount: enabledControlIdentities.length,
            enabledControlIdentities,
            enabledControlIdentitiesSha256: jsonSha(enabledControlIdentities),
            enabledControlStateKeys,
            enabledControlStateKeysSha256: jsonSha(enabledControlStateKeys),
            forwardReachedCount: enabledControlIdentities.length, reverseReachedCount: enabledControlIdentities.length,
            forwardReachedControlIdentities: enabledControlIdentities,
            forwardReachedStateKeys: enabledControlStateKeys,
            reverseReachedControlIdentities: enabledControlIdentities,
            reverseReachedStateKeys: enabledControlStateKeys,
            exactForwardSet: true, exactReverseSet: true,
            activatedStateKeys: enabledControlStateKeys, exactActivationSet: true,
            keyboardActivationCount: enabledControlStateKeys.length, expectedKeyboardActivationCount: enabledControlStateKeys.length, escapeClosed: true,
            modalFocusTrap: 'NOT_APPLICABLE_NO_OPEN_MODAL',
            modalExpectedControlIdentities: [], modalForwardFocusIdentities: [], modalReverseFocusIdentities: [],
            scrollContainerCount: expectedScrollContainerIds.length,
            expectedScrollContainerIds,
            scroll: expectedScrollContainerIds.flatMap((containerId, containerIndex) => INSTALLED_UI_SCROLL_PLAN.map((item, positionIndex) => ({
              containerId, position: item.position,
              controlCount: routeControls.length, visibleTargetCount: routeControls.length,
              visibleTargetRequired: true, focusTargetFound: true,
              expectedTargetIdentity: routeControl.identity, focusTargetIdentity: routeControl.identity, horizontalOverflow: false, focusVisible: true,
              stickyOverlap: false, textClipping: false, scrollTop: containerIndex * 100 + positionIndex * 50
            }))),
            tooltipCount: tooltipResults.length, tooltipHoveredCount: tooltipResults.length, tooltipResults,
            keyboardPlanIds: INSTALLED_UI_KEYBOARD_PLAN.map((item) => item.id)
          };
        }),
        visualAuditCount: visualAudits.length,
        visualIssueCount: 0,
        visualAudits,
        unexpectedRendererExceptionCount: 0,
        failedResourceCount: 0,
        mainProcessExceptionCount: 0,
        mainProcessStderr: {
          status: 'PASS', byteCount: 0, lineCount: 0, exceptionCount: 0, warningCount: 0, diagnosticCount: 0,
          exceptions: [], warnings: [], diagnostics: [], fullyDrained: true, rawOutputRecorded: false, sha256: digest(900)
        },
        mainProcessOutput: {
          status: 'PASS', exceptionCount: 0, warningCount: 0, diagnosticCount: 0, fullStreamHashed: true, rawOutputRecorded: false,
          channels: {
            stdout: { status: 'PASS', byteCount: 0, lineCount: 0, fullyDrained: true, rawOutputRecorded: false, exceptionCount: 0, warningCount: 0, diagnosticCount: 0, exceptions: [], warnings: [], diagnostics: [], sha256: digest(901) },
            stderr: { status: 'PASS', byteCount: 0, lineCount: 0, fullyDrained: true, rawOutputRecorded: false, exceptionCount: 0, warningCount: 0, diagnosticCount: 0, exceptions: [], warnings: [], diagnostics: [], sha256: digest(900) }
          }
        },
        terminalAcceptOutcomes,
        nativeDialogEvidenceCount: nativeRecords.length,
        nativeDialogEvidenceSha256: jsonSha(nativeRecords),
        nativeDialogEvidence: nativeRecords,
        nativeDialogInventoryCount: nativeDialogInventory.length,
        nativeDialogInventorySha256: jsonSha(nativeDialogInventory),
        nativeDialogInventorySourceSha256: INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY_SHA256,
        nativeDialogInventory,
        processEvidence: { rootProcessId: 5_000, ownedProcessCount: ownedProcessIdentities.length, stopped: ownedProcessIdentities, survivorCount: 0, identityUsesCreationDate: true }
      },
      receiptBindings: {
        installationPreservationSha256: sha('6'),
        packageProvenanceSha256: sha('9'),
        executableIdentityVerified: true,
        screenshotReadbackVerified: true,
        screenshotRequiredSetVerified: true,
        screenshotManifestSha256: jsonSha(installedScreenshots),
        expectedScreenshotNames: installedScreenshots.map((item) => item.name),
        profileCleanupOrQuarantineVerified: true,
        profileCleanupAbsenceReadbackVerified: true
      },
      screenshotArtifactCount: installedScreenshots.length,
      screenshots: installedScreenshots.map((item) => item.relativePath),
      screenshotArtifacts: installedScreenshots,
      profileDisposition: {
        status: 'DELETED_AND_ABSENCE_READBACK_PASS', profilePathRecorded: false,
        absenceReadbackVerified: true,
        excludeFromSourceBackup: true, excludeFromExternalBackup: true
      },
      generatedAt: '2026-08-23T16:45:00.000Z'
    },
    narrationTr: { status: 'PASS', language: 'tr', claimBoundary: 'OFFLINE_WAVE_SYNTHESIS_ONLY_NOT_AUDIBLE_OUTPUT' },
    narrationEn: { status: 'PASS', language: 'en', claimBoundary: 'OFFLINE_WAVE_SYNTHESIS_ONLY_NOT_AUDIBLE_OUTPUT' },
    packagedFuses: { policyId: 'B2-04-ELECTRON-FUSE-V1', version: '1', fuses: ELECTRON_FUSE_POLICY },
    installedFuses: { policyId: 'B2-04-ELECTRON-FUSE-V1', version: '1', fuses: ELECTRON_FUSE_POLICY },
    evidenceBindings: {
      installerExperienceUat: { path: `${installerEvidenceRoot}\\windows-installer-experience-uat.json`, sizeBytes: 1, sha256: sha('5') },
      installationPreservationUat110: { path: `${installationEvidenceRoot}\\windows-installed-release-uat110.json`, sizeBytes: 1, sha256: sha('6') },
      installedFrontendUat111: { path: `${installedUiEvidenceRoot}\\installed-frontend-user-uat111.json`, sizeBytes: 1, sha256: sha('7') },
      packagedLaunchProbe: { path: 'packaged-probe.json', sizeBytes: 1, sha256: sha('8') },
      sourceProtection: { path: 'source-protection.json', sizeBytes: 1024, sha256: sha('f') },
      packageProvenance: { path: 'package-provenance.json', sizeBytes: 2048, sha256: sha('9') },
      governedPreflight: { path: 'governed-preflight.json', sizeBytes: 2048, sha256: sha('0') }
    },
    screenshotReadbacks: {
      installer: installerScreenshots.map(({ path, sizeBytes, width, height, sha256 }) => ({ path, sizeBytes, width, height, sha256 })),
      installedUi: installedScreenshots.map(({ relativePath: path, sizeBytes, width, height, sha256 }) => ({ path, sizeBytes, width, height, sha256 })),
      nativeDialog: nativeScreenshotReadbacks
    },
    finalRunId: '40000000-0000-4000-8000-000000000004',
    finalEvidenceRoot: resolve(checkoutRoot, 'artifacts', 'validation', 'bronze-final-delivery', '40000000-0000-4000-8000-000000000004'),
    finalProducer: {
      final: { path: 'scripts/create-bronze-final-local-test-delivery.mjs', sizeBytes: 1000, sha256: sha('6') },
      installedUi: { path: 'scripts/run-installed-frontend-user-uat.mjs', sizeBytes: 1000, sha256: sha('4') },
      installerExperience: { path: 'scripts/run-windows-installer-experience-uat.ps1', sizeBytes: 1_001, sha256: sha('1') },
      installedRelease: { path: 'scripts/run-windows-installed-release-uat.ps1', sizeBytes: 1_002, sha256: sha('2') }
    },
    previousPackageHistoryBundle: null,
    previousPackageArchive: null,
    historicalPreviousSourceProvenance: null,
    previousPackageProducerReadback: null
  };
  if (mode !== 'bootstrap') {
    const isRecovery = mode === 'recovery';
    const nextApplicationVersion = isRecovery ? '26.08.2026.51' : '27.08.2026.52';
    const nextPackageVersion = isRecovery ? '26.8.2026-51' : '27.8.2026-52';
    const nextRelease = `Bronze ${nextApplicationVersion}`;
    const nextReleaseId = isRecovery ? 'bronze-2026-08-26-r51' : 'bronze-2026-08-27-r52';
    const lineagePackageReceipt = isRecovery ? previousPackageReceipt : {
      ...previousPackageReceipt,
      release: 'Bronze 26.08.2026.51',
      releaseId: 'bronze-2026-08-26-r51'
    };
    const lineagePackageVersion = isRecovery ? previousPackageHistoryBundleReceipt.packageVersion : '26.8.2026-51';
    const lineageHistoryBundle = {
      ...previousPackageHistoryBundleReceipt,
      release: lineagePackageReceipt.release,
      releaseId: lineagePackageReceipt.releaseId,
      version: lineagePackageReceipt.release.replace(/^Bronze /u, ''),
      packageVersion: lineagePackageVersion
    };
    const lineageVersion = lineagePackageReceipt.release.replace(/^Bronze /u, '');
    const recoveryBootstrap = {
      decision: 'RECOVERY_BOOTSTRAP_AFTER_REJECTED_50', parentStatus: 'REJECTED_INVALID_PACKAGE',
      currentRelease: 'Bronze 26.08.2026.51', currentReleaseId: 'bronze-2026-08-26-r51',
      parentRelease: 'Bronze 22.08.2026.50', parentReleaseId: 'bronze-2026-08-22-r50',
      currentSequence: 51, parentSequence: 50,
      releaseLedger: { path: 'config/release-ledger.json', sizeBytes: 1000, sha256: sha('a') }
    };
    input.release = nextRelease;
    input.applicationVersion = nextApplicationVersion;
    input.packageVersion = nextPackageVersion;
    input.installer.path = input.installer.path.replace(applicationVersion, nextApplicationVersion);
    input.installer.fullPath = input.installer.path;
    for (const runtime of [input.installer, input.packagedRuntime, input.installedRuntime]) {
      runtime.fileVersion = nextPackageVersion;
      runtime.productVersion = nextPackageVersion;
    }
    Object.assign(input.packageProvenance, {
      releaseId: nextReleaseId, release: nextRelease, parentRelease: lineagePackageReceipt.release,
      previousPackageProvenance: {
        path: resolve(checkoutRoot, 'artifacts', 'validation', 'release-history', `bronze-${lineageVersion}-windows-package-provenance-bundle`, 'bundle.json'),
        release: lineagePackageReceipt.release, releaseId: lineagePackageReceipt.releaseId,
        sourceCommit: previousSourceProvenance.headCommit, sha256: sha('4'), sizeBytes: 1000,
        packagedRuntime: lineagePackageReceipt.artifacts.packagedRuntime,
        ...(isRecovery ? {
          lineageRole: 'REJECTED_PARENT_HISTORY_ANCHOR_ONLY', trustedInstalledPredecessor: false, recoveryBootstrap
        } : {})
      }
    });
    input.installerExperience.release = nextRelease;
    input.installerExperience.releaseId = nextReleaseId;
    const primary = {
      status: 'PASS', classification: isRecovery ? 'RECOVERY_BOOTSTRAP_FRESH_INSTALL_SEQUENCE_51' : 'VERSION_UPGRADE_N_TO_N_PLUS_1',
      installedEqualsPackaged: true, markerPreserved: true,
      allUserDataContentEqualityPreserved: true, otherChannelAndLegacyProgramMetadataPreserved: true,
      otherChannelWriteCount: 0, dataSelectionDialogObserved: false,
      bronzeRegistry: { exactSingleEntry: true },
      fromFileVersion: isRecovery ? null : lineagePackageVersion,
      toFileVersion: nextPackageVersion,
      fromSequence: isRecovery ? null : 51, toSequence: isRecovery ? 51 : 52,
      exactSuccessor: !isRecovery, governedBootstrap: false, recoveryBootstrap: isRecovery,
      targetInstallRootAbsentBefore: isRecovery, targetExecutableAbsentBefore: isRecovery,
      bronzeUninstallRegistryAbsentBefore: isRecovery, packagePreviousProvenanceAbsent: false,
      ...(isRecovery ? { before: { program: { bronze: { exists: false } }, uninstallRegistry: { bronze: { entryCount: 0 } } } } : {})
    };
    Object.assign(input.installationPreservation, {
      release: nextRelease, expectedReleaseId: nextReleaseId,
      installationMode: isRecovery ? 'RECOVERY_BOOTSTRAP_FRESH_INSTALL' : 'CONTINUATION_N_TO_N_PLUS_ONE',
      installedBefore: isRecovery ? null : {
        path: installedPath, sizeBytes: previousPackageReceipt.artifacts.packagedRuntime.sizeBytes,
        sha256: lineagePackageReceipt.artifacts.packagedRuntime.sha256,
        fileVersion: lineagePackageVersion
      },
      previousPackageProvenance: {
        path: input.packageProvenance.previousPackageProvenance.path, sizeBytes: 1000, sha256: sha('4')
      },
      recoveryBootstrapAuthority: isRecovery ? structuredClone(recoveryBootstrap) : null,
      primaryInstallation: primary,
      freshInstall: isRecovery ? { ...primary } : null,
      upgrade: isRecovery ? null : { ...primary }
    });
    input.installationPreservation.maintenance.beforeFileVersion = nextPackageVersion;
    input.installationPreservation.maintenance.afterFileVersion = nextPackageVersion;
    input.installationPreservation.maintenance.precedingPhase = primary.classification;
    input.packagedProbe.applicationVersion = nextApplicationVersion;
    for (const run of input.packagedProbe.runs) run.applicationVersion = nextApplicationVersion;
    input.installedUi.release = nextRelease;
    input.installedUi.releaseId = nextReleaseId;
    input.installedUi.installedFileVersion = nextPackageVersion;
    input.installedUi.executableIdentity.fileVersion = nextPackageVersion;
    input.previousPackageHistoryBundle = { value: lineageHistoryBundle, sizeBytes: 1000, sha256: sha('4') };
    input.previousPackageArchive = { value: lineagePackageReceipt, ...previousPackageArchiveBinding };
    input.historicalPreviousSourceProvenance = previousSourceProvenance;
    input.previousPackageProducerReadback = { ...lineagePackageReceipt.producer };
  }
  return input;
};

const refreshInteractionBindings = (input: ReturnType<typeof baseInput>) => {
  input.installedUi.checks.interactionMatrixCount = input.installedUi.checks.interactionMatrix.length;
  input.installedUi.checks.interactionEntriesSha256 = jsonSha(input.installedUi.checks.interactionMatrix);
  input.installedUi.checks.interactionMatrixStateKeys = input.installedUi.checks.interactionMatrix.map((entry) => entry.stateKey).sort();
  input.installedUi.checks.interactionMatrixStateKeysSha256 = jsonSha(input.installedUi.checks.interactionMatrixStateKeys);
  input.installedUi.checks.interactionPassesSha256 = jsonSha(input.installedUi.checks.interactionPasses);
};

const refreshNativeBindings = (input: ReturnType<typeof baseInput>) => {
  input.installedUi.checks.nativeDialogEvidenceCount = input.installedUi.checks.nativeDialogEvidence.length;
  input.installedUi.checks.nativeDialogEvidenceSha256 = jsonSha(input.installedUi.checks.nativeDialogEvidence);
  for (const entry of input.installedUi.checks.interactionMatrix) {
    if (entry.outcome?.nativeDialog) entry.outcome.evidence[0].sha256 = jsonSha(entry.outcome.nativeDialog);
  }
  for (const outcome of input.installedUi.checks.terminalAcceptOutcomes) {
    if (outcome?.nativeDialog) outcome.evidence[0].sha256 = jsonSha(outcome.nativeDialog);
  }
  for (const inventoryEntry of input.installedUi.checks.nativeDialogInventory) {
    inventoryEntry.exercisedRecordSha256 = input.installedUi.checks.nativeDialogEvidence
      .filter((record) => record.specId === inventoryEntry.specId).map((record) => jsonSha(record)).sort();
  }
  input.installedUi.checks.nativeDialogInventorySha256 = jsonSha(input.installedUi.checks.nativeDialogInventory);
  refreshInteractionBindings(input);
};

describe('Bronze final local-test delivery receipt contract', () => {
  it('binds installer, maintenance, installed UI, narration and unsigned release blockers', () => {
    const receipt = createFinalLocalTestDeliveryReceipt(baseInput());
    expect(receipt).toMatchObject({
      schemaVersion: FINAL_LOCAL_TEST_DELIVERY_SCHEMA_VERSION,
      classification: 'UNSIGNED_LOCAL_TEST_ONLY',
      status: 'LOCAL_TEST_PASS_PRODUCTION_RELEASE_BLOCKED',
      windowsInstalledReleaseUat: {
        status: 'PASS',
        id: 'PPT-WINDOWS-INSTALLED-RELEASE-UAT110-V3',
        installationMode: 'BOOTSTRAP_FRESH_INSTALL',
        freshInstall: 'PASS',
        upgrade: 'NOT_APPLICABLE',
        sameVersionMaintenance: 'PASS',
        metadataOnlyUserDataInspection: true,
        otherChannelWrites: 0
      },
      installedFrontendUat: {
        status: 'PASS', navigationRoutes: 22, moduleMenus: 4,
        clickedInteractions: 26, blockedInteractions: 1, deferredInteractions: 0, visualAudits: 50
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
    expect(receipt.sourceProvenance).toMatchObject({
      source: '06_KOD/kanallar/Bronze', branch: 'channel/bronze', headCommit: sourceCommit
    });
  });

  it('accepts exact sequence-51 recovery fresh-install while preserving rejected sequence-50 only as immutable ancestry', () => {
    const receipt = createFinalLocalTestDeliveryReceipt(baseInput('recovery'));
    expect(receipt).toMatchObject({
      release: 'Bronze 26.08.2026.51',
      applicationVersion: '26.08.2026.51',
      windowsInstalledReleaseUat: {
        id: 'PPT-WINDOWS-INSTALLED-RELEASE-UAT110-V3',
        installationMode: 'RECOVERY_BOOTSTRAP_FRESH_INSTALL',
        freshInstall: 'PASS', upgrade: 'NOT_APPLICABLE', recoveryBootstrap: 'PASS', sameVersionMaintenance: 'PASS'
      }
    });
  });

  it('keeps sequence 52 and later on the normal exact N to N plus one continuation path', () => {
    const receipt = createFinalLocalTestDeliveryReceipt(baseInput('continuation'));
    expect(receipt).toMatchObject({
      release: 'Bronze 27.08.2026.52',
      applicationVersion: '27.08.2026.52',
      windowsInstalledReleaseUat: {
        installationMode: 'CONTINUATION_N_TO_N_PLUS_ONE',
        freshInstall: 'NOT_APPLICABLE', upgrade: 'PASS', recoveryBootstrap: 'NOT_APPLICABLE'
      }
    });
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
    input.installationPreservation.maintenance.otherChannelWriteCount = 1;
    expect(() => createFinalLocalTestDeliveryReceipt(input)).toThrow(/preservation is incomplete/u);
  });

  it('rejects wrong branch, stale governed fingerprint and package artifact drift', () => {
    const wrongBranch = baseInput();
    wrongBranch.sourceProvenance = { ...wrongBranch.sourceProvenance, branch: 'codex/local' };
    expect(() => createFinalLocalTestDeliveryReceipt(wrongBranch)).toThrow(/source protection|Bronze release worktree/u);

    const stalePreflight = baseInput();
    stalePreflight.governedPreflight.sourceFingerprint = { sha256: sha('9'), fileCount: 4000 };
    expect(() => createFinalLocalTestDeliveryReceipt(stalePreflight)).toThrow(/Governed preflight/u);

    const replacedInstaller = baseInput();
    replacedInstaller.packageProvenance.artifacts.installer.sha256 = sha('9');
    expect(() => createFinalLocalTestDeliveryReceipt(replacedInstaller)).toThrow(/package provenance/u);

    const replacedProtection = baseInput();
    replacedProtection.packageProvenance.sourceProtection.sha256 = sha('9');
    expect(() => createFinalLocalTestDeliveryReceipt(replacedProtection)).toThrow(/source-protection receipt/u);
  });

  it('rejects stale mutation readiness and pre-package installed EXE UAT', () => {
    const staleReadiness = baseInput();
    staleReadiness.packageProvenance.mutationReleaseReadiness.sourceCommit = '9'.repeat(40);
    expect(() => createFinalLocalTestDeliveryReceipt(staleReadiness)).toThrow(/PR-235 mutation readiness/u);

    const missingPr240 = baseInput();
    delete missingPr240.packageProvenance.mutationReleaseReadiness.strengthenedByRequirement;
    expect(() => createFinalLocalTestDeliveryReceipt(missingPr240)).toThrow(/PR-235 mutation readiness/u);

    const missingUniversalRecord = baseInput();
    missingUniversalRecord.packageProvenance.mutationReleaseReadiness.dependencyClosure.universalDependentRecords.pop();
    expect(() => createFinalLocalTestDeliveryReceipt(missingUniversalRecord)).toThrow(/PR-240 dependency record\/test closure/u);

    const staleInstalledUat = baseInput();
    staleInstalledUat.installedUi.startedAt = staleInstalledUat.packageProvenance.generatedAt;
    expect(() => createFinalLocalTestDeliveryReceipt(staleInstalledUat)).toThrow(/chronology/u);
  });

  it('rejects fabricated previous package evidence or an upgrade claim for sequence-50 bootstrap', () => {
    const fabricatedPrevious: any = baseInput();
    fabricatedPrevious.previousPackageHistoryBundle = { value: {}, sizeBytes: 1000, sha256: sha('4') };
    expect(() => createFinalLocalTestDeliveryReceipt(fabricatedPrevious)).toThrow(/fabricated previous package evidence/u);

    const bootstrapAsUpgrade = baseInput();
    bootstrapAsUpgrade.installationPreservation.installationMode = 'CONTINUATION_N_TO_N_PLUS_ONE';
    expect(() => createFinalLocalTestDeliveryReceipt(bootstrapAsUpgrade)).toThrow(/mode/u);

    const bootstrapWithRecoveryClaim = baseInput();
    bootstrapWithRecoveryClaim.installationPreservation.primaryInstallation.recoveryBootstrap = true;
    bootstrapWithRecoveryClaim.installationPreservation.freshInstall.recoveryBootstrap = true;
    expect(() => createFinalLocalTestDeliveryReceipt(bootstrapWithRecoveryClaim)).toThrow(/exclusive fresh-install|absence proof/u);

    const bootstrapWithRecoveryAuthority = baseInput();
    bootstrapWithRecoveryAuthority.installationPreservation.recoveryBootstrapAuthority = { decision: 'FORGED_RECOVERY' };
    expect(() => createFinalLocalTestDeliveryReceipt(bootstrapWithRecoveryAuthority)).toThrow(/exclusive fresh-install/u);
  });

  it('rejects continuation predecessor runtime or bundle binding drift', () => {
    const runtimeDrift = baseInput('continuation');
    runtimeDrift.installationPreservation.installedBefore.sha256 = sha('7');
    expect(() => createFinalLocalTestDeliveryReceipt(runtimeDrift)).toThrow(/lineage-bound/u);

    const bundlePathDrift = baseInput('continuation');
    bundlePathDrift.installationPreservation.previousPackageProvenance.path = 'C:\\forged\\bundle.json';
    expect(() => createFinalLocalTestDeliveryReceipt(bundlePathDrift)).toThrow(/lineage-bound/u);

    const continuationAsFresh = baseInput('continuation');
    continuationAsFresh.installationPreservation.installationMode = 'BOOTSTRAP_FRESH_INSTALL';
    expect(() => createFinalLocalTestDeliveryReceipt(continuationAsFresh)).toThrow(/mode/u);

    const continuationWithRecoveryClaim = baseInput('continuation');
    continuationWithRecoveryClaim.installationPreservation.primaryInstallation.recoveryBootstrap = true;
    continuationWithRecoveryClaim.installationPreservation.upgrade.recoveryBootstrap = true;
    expect(() => createFinalLocalTestDeliveryReceipt(continuationWithRecoveryClaim)).toThrow(/exclusive continuation/u);

    const continuationWithRecoveryAuthority = baseInput('continuation');
    continuationWithRecoveryAuthority.installationPreservation.recoveryBootstrapAuthority = { decision: 'FORGED_RECOVERY' };
    expect(() => createFinalLocalTestDeliveryReceipt(continuationWithRecoveryAuthority)).toThrow(/exclusive continuation/u);
  });

  it('rejects recovery bootstrap when sequence-50 is trusted as installed runtime or ledger authority drifts', () => {
    const trustedParent = baseInput('recovery');
    trustedParent.packageProvenance.previousPackageProvenance.trustedInstalledPredecessor = true;
    expect(() => createFinalLocalTestDeliveryReceipt(trustedParent)).toThrow(/authorized rejected-50 recovery/u);

    const ledgerDrift = baseInput('recovery');
    ledgerDrift.installationPreservation.recoveryBootstrapAuthority.parentStatus = 'IN_PROGRESS';
    expect(() => createFinalLocalTestDeliveryReceipt(ledgerDrift)).toThrow(/authorized rejected-50 recovery|ledger authority/u);
  });

  it('revalidates the raw installed UI interaction and state matrices instead of trusting summary counts', () => {
    const unknownDisposition = baseInput();
    unknownDisposition.installedUi.checks.interactionMatrix[0].disposition = 'CLICKED';
    refreshInteractionBindings(unknownDisposition);
    expect(() => createFinalLocalTestDeliveryReceipt(unknownDisposition)).toThrow(/unknown disposition/u);

    const incompleteStateMatrix = baseInput();
    incompleteStateMatrix.installedUi.checks.applicationStateMatrix.pop();
    expect(() => createFinalLocalTestDeliveryReceipt(incompleteStateMatrix)).toThrow(/state matrix/u);

    const forgedStderrSummary = baseInput();
    forgedStderrSummary.installedUi.checks.mainProcessStderr.exceptionCount = 1;
    expect(() => createFinalLocalTestDeliveryReceipt(forgedStderrSummary)).toThrow(/main-process evidence/u);

    const forgedStateControlLink = baseInput();
    const permissionStateEvidence = forgedStateControlLink.installedUi.checks.applicationStateMatrix[4].evidence[0];
    permissionStateEvidence.rawEvidence.controlIdentity = sha('f');
    permissionStateEvidence.rawEvidence.snapshot.actionCorrelation.controlIdentity = sha('f');
    permissionStateEvidence.rawEvidence.snapshotSha256 = jsonSha(permissionStateEvidence.rawEvidence.snapshot);
    permissionStateEvidence.sha256 = jsonSha(permissionStateEvidence.rawEvidence);
    expect(() => createFinalLocalTestDeliveryReceipt(forgedStateControlLink)).toThrow(/exact logical or interaction outcome control/u);

    const forgedStateSnapshot = baseInput();
    forgedStateSnapshot.installedUi.checks.applicationStateMatrix[0].evidence[0].rawEvidence.snapshot.allRequiredInputsEmpty = false;
    forgedStateSnapshot.installedUi.checks.applicationStateMatrix[0].evidence[0].sha256 = jsonSha(
      forgedStateSnapshot.installedUi.checks.applicationStateMatrix[0].evidence[0].rawEvidence
    );
    expect(() => createFinalLocalTestDeliveryReceipt(forgedStateSnapshot)).toThrow(/snapshot SHA|EMPTY form/u);
  });

  it('rejects self-derived routes, modules, fixed-point summaries and no-op clicked outcomes', () => {
    const fakeRoute = baseInput();
    fakeRoute.installedUi.checks.navigationSurfaces[0].routeId = 'route-01';
    expect(() => createFinalLocalTestDeliveryReceipt(fakeRoute)).toThrow(/built-domain 4\/22/u);

    const fakeModule = baseInput();
    fakeModule.installedUi.checks.moduleMenus[0].groupId = 'module-1';
    expect(() => createFinalLocalTestDeliveryReceipt(fakeModule)).toThrow(/canonical built-domain groups/u);

    const summaryOnlyFixedPoint = baseInput();
    delete (summaryOnlyFixedPoint.installedUi.checks as { interactionPasses?: unknown }).interactionPasses;
    expect(() => createFinalLocalTestDeliveryReceipt(summaryOnlyFixedPoint)).toThrow(/raw fixed-point/u);

    const noOpClicked = baseInput();
    noOpClicked.installedUi.checks.interactionMatrix[0].outcome.kind = 'STATE_CHANGE';
    refreshInteractionBindings(noOpClicked);
    expect(() => createFinalLocalTestDeliveryReceipt(noOpClicked)).toThrow(/durum değişimi|semantic|STATE_CHANGE/u);

    const reorderedPasses = baseInput();
    [reorderedPasses.installedUi.checks.interactionPasses[0], reorderedPasses.installedUi.checks.interactionPasses[3]] =
      [reorderedPasses.installedUi.checks.interactionPasses[3], reorderedPasses.installedUi.checks.interactionPasses[0]];
    refreshInteractionBindings(reorderedPasses);
    expect(() => createFinalLocalTestDeliveryReceipt(reorderedPasses)).toThrow(/pass order/u);

    const stalePassCount = baseInput();
    stalePassCount.installedUi.checks.interactionPasses[0].newStateCount = 0;
    refreshInteractionBindings(stalePassCount);
    expect(() => createFinalLocalTestDeliveryReceipt(stalePassCount)).toThrow(/raw fixed-point|sequence\/count/u);

    const duplicateVisibleState = baseInput();
    const duplicatePass = duplicateVisibleState.installedUi.checks.interactionPasses[0];
    duplicatePass.visibleStateKeys.push(duplicatePass.visibleStateKeys[0]);
    duplicatePass.discoveredVisibleCount = duplicatePass.visibleStateKeys.length;
    duplicatePass.visibleControlSetSha256 = jsonSha(duplicatePass.visibleStateKeys);
    refreshInteractionBindings(duplicateVisibleState);
    expect(() => createFinalLocalTestDeliveryReceipt(duplicateVisibleState)).toThrow(/raw fixed-point/u);

    const forgedSemanticRoute = baseInput();
    forgedSemanticRoute.installedUi.checks.interactionMatrix[0].navigationRouteId = PRODUCT_NAVIGATION_ROUTES[1].id;
    refreshInteractionBindings(forgedSemanticRoute);
    expect(() => createFinalLocalTestDeliveryReceipt(forgedSemanticRoute)).toThrow(/semantic identity|canonical semantic route/u);

    const fakeNativeDeferred = baseInput();
    const deferredEntry = fakeNativeDeferred.installedUi.checks.interactionMatrix[0];
    deferredEntry.disposition = 'DEFERRED_EXTERNAL_EVIDENCE';
    deferredEntry.reason = 'NATIVE_OS_BOUNDARY';
    deferredEntry.outcome = null as never;
    deferredEntry.externalEvidence = [{ kind: 'UNRELATED_PACKAGE_SHA', sha256: sha('3') }] as never;
    fakeNativeDeferred.installedUi.checks.clickedInteractionCount -= 1;
    fakeNativeDeferred.installedUi.checks.deferredInteractionCount = 1;
    refreshInteractionBindings(fakeNativeDeferred);
    expect(() => createFinalLocalTestDeliveryReceipt(fakeNativeDeferred)).toThrow(/safety classification|fail closed/u);

    const unrelatedOutcomeEvidence = baseInput();
    unrelatedOutcomeEvidence.installedUi.checks.interactionMatrix[0].outcome.evidence[0].kind = 'UNRELATED_PACKAGE_SHA';
    refreshInteractionBindings(unrelatedOutcomeEvidence);
    expect(() => createFinalLocalTestDeliveryReceipt(unrelatedOutcomeEvidence)).toThrow(/kanonik evidence/u);

    const wrongPostcondition = baseInput();
    wrongPostcondition.installedUi.checks.interactionMatrix[0].outcome.postcondition.kind = 'VISIBLE_STATUS_CHANGED';
    refreshInteractionBindings(wrongPostcondition);
    expect(() => createFinalLocalTestDeliveryReceipt(wrongPostcondition)).toThrow(/evidence\/postcondition|eyleme özgü geri-okuma/u);
  });

  it('rejects fake visual surfaces and forged native target, screenshot, postcondition or count evidence', () => {
    const fakeVisualSurface = baseInput();
    fakeVisualSurface.installedUi.checks.visualAudits[0].surfaceId = 'fake-first-run';
    expect(() => createFinalLocalTestDeliveryReceipt(fakeVisualSurface)).toThrow(/visual audit raw matrix/u);

    const forgedNativeOwner = baseInput();
    const ownerTarget = forgedNativeOwner.installedUi.checks.nativeDialogEvidence[0].accept.targetWindow;
    Object.assign(ownerTarget, { processId: null, creationTimeUtc: null, ownershipMode: 'OWNER_PROCESS', ownerProcessId: 99_999 });
    const { identitySha256: _oldOwnerIdentity, ...ownerMaterial } = ownerTarget;
    ownerTarget.identitySha256 = jsonSha(ownerMaterial);
    refreshNativeBindings(forgedNativeOwner);
    expect(() => createFinalLocalTestDeliveryReceipt(forgedNativeOwner)).toThrow(/owned process identity/u);

    const staleNativeScreenshot = baseInput();
    staleNativeScreenshot.installedUi.checks.nativeDialogEvidence[0].cancel.screenshot.sha256 = sha('f');
    refreshNativeBindings(staleNativeScreenshot);
    expect(() => createFinalLocalTestDeliveryReceipt(staleNativeScreenshot)).toThrow(/screenshot path\/hash\/live readback/u);

    const sharedHashAcrossDifferentControls = baseInput();
    const sharedHash = sharedHashAcrossDifferentControls.installedUi.checks.nativeDialogEvidence[0].cancel.screenshot.sha256;
    const secondControlScreenshot = sharedHashAcrossDifferentControls.installedUi.checks.nativeDialogEvidence[1].cancel.screenshot;
    secondControlScreenshot.sha256 = sharedHash;
    const secondControlReadback = sharedHashAcrossDifferentControls.screenshotReadbacks.nativeDialog
      .find((item) => item.path === secondControlScreenshot.path);
    secondControlReadback!.sha256 = sharedHash;
    refreshNativeBindings(sharedHashAcrossDifferentControls);
    expect(() => createFinalLocalTestDeliveryReceipt(sharedHashAcrossDifferentControls)).not.toThrow();

    const sameControlCancelAcceptHash = baseInput();
    const firstNativeRecord = sameControlCancelAcceptHash.installedUi.checks.nativeDialogEvidence[0];
    firstNativeRecord.accept.screenshot.sha256 = firstNativeRecord.cancel.screenshot.sha256;
    const firstAcceptReadback = sameControlCancelAcceptHash.screenshotReadbacks.nativeDialog
      .find((item) => item.path === firstNativeRecord.accept.screenshot.path);
    firstAcceptReadback!.sha256 = firstNativeRecord.cancel.screenshot.sha256;
    refreshNativeBindings(sameControlCancelAcceptHash);
    expect(() => createFinalLocalTestDeliveryReceipt(sameControlCancelAcceptHash)).toThrow(/CANCEL\/ACCEPT screenshots/u);

    const directProcessOwnership = baseInput();
    const directTarget = directProcessOwnership.installedUi.checks.nativeDialogEvidence[0].accept.targetWindow;
    const ownedIdentity = directProcessOwnership.installedUi.checks.processEvidence.stopped[0];
    directTarget.processId = ownedIdentity.processId;
    directTarget.creationTimeUtc = ownedIdentity.creationTimeUtc;
    directTarget.ownerProcessId = 99_999;
    const { identitySha256: _oldDirectIdentity, ...directMaterial } = directTarget;
    directTarget.identitySha256 = jsonSha(directMaterial);
    refreshNativeBindings(directProcessOwnership);
    expect(() => createFinalLocalTestDeliveryReceipt(directProcessOwnership)).not.toThrow();

    const genericNativePostcondition = baseInput();
    genericNativePostcondition.installedUi.checks.nativeDialogEvidence[0].accept.postcondition.kind = 'DIALOG_ACCEPT_READBACK';
    refreshNativeBindings(genericNativePostcondition);
    expect(() => createFinalLocalTestDeliveryReceipt(genericNativePostcondition)).toThrow(/Native ACCEPT|son-koşul|postcondition/u);

    const staleNativeCount = baseInput();
    staleNativeCount.installedUi.checks.nativeDialogEvidenceCount -= 1;
    expect(() => createFinalLocalTestDeliveryReceipt(staleNativeCount)).toThrow(/native-dialog raw evidence count/u);

    const omittedNativeInventorySpec = baseInput();
    omittedNativeInventorySpec.installedUi.checks.nativeDialogInventory.pop();
    omittedNativeInventorySpec.installedUi.checks.nativeDialogInventoryCount -= 1;
    omittedNativeInventorySpec.installedUi.checks.nativeDialogInventorySha256 = jsonSha(omittedNativeInventorySpec.installedUi.checks.nativeDialogInventory);
    expect(() => createFinalLocalTestDeliveryReceipt(omittedNativeInventorySpec)).toThrow(/inventory source\/count\/SHA/u);

    const forgedNotPresentInventory = baseInput();
    const exercisedInventory = forgedNotPresentInventory.installedUi.checks.nativeDialogInventory
      .find((entry) => entry.specId === 'finance-import')!;
    exercisedInventory.status = 'NOT_PRESENT';
    exercisedInventory.enabledControls = [];
    exercisedInventory.exercisedStateKeys = [];
    exercisedInventory.exercisedRecordSha256 = [];
    forgedNotPresentInventory.installedUi.checks.nativeDialogInventorySha256 = jsonSha(forgedNotPresentInventory.installedUi.checks.nativeDialogInventory);
    expect(() => createFinalLocalTestDeliveryReceipt(forgedNotPresentInventory)).toThrow(/exact canonical inventory/u);
  });

  it('rejects shallow accessibility, fake terminal, duplicate screenshots and secret values under benign keys', () => {
    const shallowAccessibility = baseInput();
    shallowAccessibility.installedUi.checks.accessibilityResults[0] = {
      routeId: PRODUCT_NAVIGATION_ROUTES[0].id, status: 'PASS'
    } as never;
    expect(() => createFinalLocalTestDeliveryReceipt(shallowAccessibility)).toThrow(/canonical plan/u);

    const noVisibleScrollTarget = baseInput();
    Object.assign(noVisibleScrollTarget.installedUi.checks.accessibilityResults[0].scroll[0], {
      controlCount: 0, visibleTargetCount: 0, visibleTargetRequired: false,
      focusTargetFound: false, expectedTargetIdentity: null, focusTargetIdentity: null
    });
    expect(() => createFinalLocalTestDeliveryReceipt(noVisibleScrollTarget)).not.toThrow();

    const forgedInvisibleScrollTarget = baseInput();
    Object.assign(forgedInvisibleScrollTarget.installedUi.checks.accessibilityResults[0].scroll[0], {
      controlCount: 0, visibleTargetCount: 0, visibleTargetRequired: false,
      focusTargetFound: true, expectedTargetIdentity: null, focusTargetIdentity: forgedInvisibleScrollTarget.installedUi.checks.interactionMatrix[0].identity
    });
    expect(() => createFinalLocalTestDeliveryReceipt(forgedInvisibleScrollTarget)).toThrow(/canonical plan/u);

    const forgedScrollTarget = baseInput();
    forgedScrollTarget.installedUi.checks.accessibilityResults[0].scroll[0].expectedTargetIdentity = sha('f');
    expect(() => createFinalLocalTestDeliveryReceipt(forgedScrollTarget)).toThrow(/canonical plan/u);

    const missingLoadingReadback = baseInput();
    delete (missingLoadingReadback.installedUi.checks.applicationStateMatrix[2].evidence[0] as { rawEvidence?: unknown }).rawEvidence;
    expect(() => createFinalLocalTestDeliveryReceipt(missingLoadingReadback)).toThrow(/state matrix|durum kanıtının ham geri-okuması/u);

    const forgedTooltipTarget = baseInput();
    forgedTooltipTarget.installedUi.checks.accessibilityResults[0].tooltipResults[0].targetIdentity = sha('f');
    expect(() => createFinalLocalTestDeliveryReceipt(forgedTooltipTarget)).toThrow(/canonical plan/u);

    const fakeTerminal = baseInput();
    fakeTerminal.installedUi.checks.interactionMatrix[0].outcome.kind = 'TERMINAL_DISPOSABLE_PROFILE';
    refreshInteractionBindings(fakeTerminal);
    expect(() => createFinalLocalTestDeliveryReceipt(fakeTerminal)).toThrow(/disposable|terminal/iu);

    const missingTerminalAccept = baseInput();
    const original = missingTerminalAccept.installedUi.checks.interactionMatrix[0];
    const terminalControl = createSemanticControlIdentity({
      routeId: original.routeId, scenario: 'BASELINE', surfaceId: 'main', role: 'button', locator: original.locator,
      label: 'Bu sentetik hesabı sil', visible: true, enabled: true, valueState: 'UNSPECIFIED', actionHint: 'TERMINAL'
    });
    missingTerminalAccept.installedUi.checks.interactionMatrix[0] = {
      ...terminalControl, disposition: 'CLICKED_OUTCOME_VERIFIED', reason: null, externalEvidence: null,
      outcome: {
        ...original.outcome,
        kind: 'TERMINAL_DISPOSABLE_PROFILE', safetyClassification: 'DISPOSABLE_PROFILE_SAFE_OUTCOME_REQUIRED',
        beforeFingerprint: digest(980), afterFingerprint: digest(980), semanticStateChanged: false,
        actionCorrelation: {
          controlIdentity: terminalControl.identity, stateKey: terminalControl.stateKey,
          gestureSha256: original.outcome.actionCorrelation.gestureSha256,
          gesture: original.outcome.actionCorrelation.gesture
        },
        postcondition: { status: 'PASS', actionSpecific: true, kind: 'TERMINAL_CANCEL_STATE_UNCHANGED' },
        assertions: [{ id: 'TERMINAL_CANCEL_STATE_UNCHANGED', status: 'PASS' }],
        profileClassification: 'SYNTHETIC_DISPOSABLE_PROFILE', terminalDecision: 'CANCEL',
        terminalPostcondition: {
          status: 'PASS', observed: true, decision: 'CANCEL',
          controlIdentity: terminalControl.identity, stateKey: terminalControl.stateKey
        }
      }
    } as never;
    refreshInteractionBindings(missingTerminalAccept);
    expect(() => createFinalLocalTestDeliveryReceipt(missingTerminalAccept)).toThrow(/CANCEL then ACCEPT/u);

    const duplicateScreenshot = baseInput();
    duplicateScreenshot.installedUi.screenshotArtifacts[1].relativePath = duplicateScreenshot.installedUi.screenshotArtifacts[0].relativePath;
    duplicateScreenshot.installedUi.screenshotArtifacts[1].sha256 = duplicateScreenshot.installedUi.screenshotArtifacts[0].sha256;
    expect(() => createFinalLocalTestDeliveryReceipt(duplicateScreenshot)).toThrow(/duplicated/u);

    const secretUnderBenignKey = baseInput();
    (secretUnderBenignKey.installedUi.checks as Record<string, unknown>).diagnosticNote = 'otpauth://totp/ParsYuva?secret=ABCDEF234567890';
    expect(() => createFinalLocalTestDeliveryReceipt(secretUnderBenignKey)).toThrow(/secret-like value/u);

    for (const secretValue of ['JBSWY3DPEHPK3PXP', '483920', 'ABCD-EFGH-IJKL-MNOP', 'LocalPass9!x']) {
      const secretVariant = baseInput();
      (secretVariant.installedUi.checks as Record<string, unknown>).benignDiagnostic = secretValue;
      expect(() => createFinalLocalTestDeliveryReceipt(secretVariant)).toThrow(/secret-like value/u);
    }

    const forgedOcrPass = baseInput();
    forgedOcrPass.installedUi.screenshotArtifacts[0].physicalPixelOcr = {
      status: 'PASS_PHYSICAL_PIXEL_OCR', engine: 'TESSERACT', findingCount: 0,
      physicalPixelSecretClaimed: true, ocrTextRecorded: false
    } as never;
    forgedOcrPass.installedUi.receiptBindings.screenshotManifestSha256 = jsonSha(forgedOcrPass.installedUi.screenshotArtifacts);
    expect(() => createFinalLocalTestDeliveryReceipt(forgedOcrPass)).toThrow(/secret-scan envelope/u);

    const staleSecretCategoryNames = baseInput();
    const staleCategories = staleSecretCategoryNames.installedUi.screenshotArtifacts[0].secretSurfaceScan.categories;
    staleCategories.text = staleCategories.domText;
    staleCategories.values = staleCategories.formValues;
    delete staleCategories.domText;
    delete staleCategories.formValues;
    staleSecretCategoryNames.installedUi.receiptBindings.screenshotManifestSha256 = jsonSha(staleSecretCategoryNames.installedUi.screenshotArtifacts);
    expect(() => createFinalLocalTestDeliveryReceipt(staleSecretCategoryNames)).toThrow(/secret-scan envelope/u);

    const missingProfileAbsenceReadback = baseInput();
    missingProfileAbsenceReadback.installedUi.receiptBindings.profileCleanupAbsenceReadbackVerified = false;
    expect(() => createFinalLocalTestDeliveryReceipt(missingProfileAbsenceReadback)).toThrow(/profile deletion/u);
  });

  it('rejects missing screenshots, duplicate evidence roots and stale chronology', () => {
    const oneScreenshot = baseInput();
    oneScreenshot.installedUi.screenshotArtifacts.splice(1);
    expect(() => createFinalLocalTestDeliveryReceipt(oneScreenshot)).toThrow(/screenshot count/u);

    const duplicateRoot = baseInput();
    duplicateRoot.installedUi.evidenceRoot = duplicateRoot.installerExperience.evidenceRoot;
    expect(() => createFinalLocalTestDeliveryReceipt(duplicateRoot)).toThrow(/canonical validation roots|duplicated/u);

    const copiedReceipt = baseInput();
    copiedReceipt.evidenceBindings.installedFrontendUat111.path = `${copiedReceipt.installationPreservation.evidenceRoot}\\copied-ui-receipt.json`;
    expect(() => createFinalLocalTestDeliveryReceipt(copiedReceipt)).toThrow(/copied, replayed/u);

    const incompleteStream = baseInput();
    incompleteStream.installedUi.checks.mainProcessOutput.channels.stdout.fullyDrained = false;
    expect(() => createFinalLocalTestDeliveryReceipt(incompleteStream)).toThrow(/main-process evidence/u);

    const stale = baseInput();
    stale.packageProvenance.generatedAt = '2025-08-23T16:34:00.000Z';
    expect(() => createFinalLocalTestDeliveryReceipt(stale)).toThrow(/stale|chronology/u);
  });

  it('rejects missing external readback, remote divergence and a stale package release label', () => {
    const externalPending = baseInput();
    externalPending.sourceProtection.externalLibraryReceiptStatus = 'PENDING';
    expect(() => createFinalLocalTestDeliveryReceipt(externalPending)).toThrow(/source protection/u);

    const externalReadbackDrift = baseInput();
    externalReadbackDrift.externalSourceProtectionVerification.treeSha256 = sha('9');
    expect(() => createFinalLocalTestDeliveryReceipt(externalReadbackDrift)).toThrow(/External source-protection/u);

    const remoteDivergence = baseInput();
    remoteDivergence.gitRemoteEquality.backup = sha('9').slice(0, 40);
    expect(() => createFinalLocalTestDeliveryReceipt(remoteDivergence)).toThrow(/GitHub and external Git backup/u);

    const stalePackageRelease = baseInput();
    stalePackageRelease.packageProvenance.release = 'Bronze 22.08.2026.49';
    expect(() => createFinalLocalTestDeliveryReceipt(stalePackageRelease)).toThrow(/package provenance/u);
  });

  it('rejects claimed local source protection without actual receipt and backup readback binding', () => {
    const missingReadback = baseInput();
    missingReadback.sourceProtectionReadback.status = 'PENDING';
    expect(() => createFinalLocalTestDeliveryReceipt(missingReadback)).toThrow(/Actual local source receipt/u);

    const packagedReadbackDrift = baseInput();
    packagedReadbackDrift.packageProvenance.sourceProtection.localArtifactReadback.backup.sha256 = sha('9');
    expect(() => createFinalLocalTestDeliveryReceipt(packagedReadbackDrift)).toThrow(/actual local receipt/u);
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
    expect(producer).toContain("options.get('source-protection')");
    expect(producer).toContain('readCanonicalChannelSourceProtection');
    expect(producer).toContain('suppliedPath: sourceProtectionPath');
    expect(producer).toContain("const aymRoot = resolve(root, '../..')");
    expect(producer).not.toContain("const aymRoot = resolve(root, '../../..')");
    expect(producer).not.toContain("readJsonBinding(sourceProtectionPath, 'sourceProtection'");
    expect(producer).toContain("requireOption(options, 'package-provenance')");
    expect(producer).toContain("requireOption(options, 'governed-preflight')");
    expect(producer).toContain("requireOption(options, 'installation-preservation-uat')");
    expect(producer).toContain("requireOption(options, 'installed-ui-uat')");
    expect(producer).toContain("requireOption(options, 'installer-experience-uat')");
    expect(producer).toContain("PRODUCT_NAVIGATION_GROUPS, PRODUCT_NAVIGATION_ROUTES } from './lib/canonical-product-navigation.mjs'");
    expect(producer).not.toContain('packages/domain/dist/renderer.js');
    expect(producer).toContain('root,\n    packageProvenancePath');
    expect(producer).toContain("readFile(resolve(root, 'scripts/run-windows-installed-release-uat.ps1'))");
    expect(producer).toContain("readFile(resolve(root, 'scripts/run-windows-installer-experience-uat.ps1'))");
    expect(producer).toContain('assertDirectoryChainNoReparse');
    expect(producer).toContain('acquireExclusiveEvidenceRunRootGuard');
    expect(producer).toContain('await runRootGuard.assertIntact()');
    expect(producer.indexOf('await runRootGuard.assertIntact();')).toBeLessThan(producer.indexOf("await open(temporary, 'wx')"));
    expect(producer.lastIndexOf('await runRootGuard.assertIntact();')).toBeLessThan(producer.indexOf('await runRootGuard.close();'));
    expect(producer).toContain('await cleanupFailedFinalDeliveryWrite({ handle, temporary, target, runRootGuard });');
    expect(producer).toContain('Final delivery UUID output root or receipt already exists; replay is forbidden.');
    expect(producer).toContain('Final delivery target appeared before atomic rename.');
    expect(producer).toContain('Final delivery receipt readback path is not a canonical regular file.');
    expect(producer).not.toContain("optionPath('maintenance-uat')");
    expect(producer).not.toContain("optionPath('installer')");
    expect(producer).not.toContain("optionPath('packaged-executable')");
    expect(producer).not.toContain("optionPath('installed-executable')");
    expect(producer).toContain('verifyElectronFuseBinary(packagedRuntime.fullPath)');
    expect(producer).toContain('verifyLocalSourceProtectionArtifacts');
    expect(producer).toContain("['scripts/protect-authoritative-source-external.mjs', 'verify']");
    expect(producer).toContain("readRemoteMain('github')");
    expect(producer).toContain("readRemoteMain('backup')");
    expect(producer).toContain("protectionEnabledSignedRetest: 'NOT_RUN'");
    expect(producer).not.toContain("spawnSync(process.execPath, ['apps/desktop/scripts/run-electron-builder.mjs'");
    expect(producer).not.toContain("'package:win");
    expect(producer).not.toContain("'clean-stale-windows-installers");
  });

  it('leaves partial evidence untouched when a dead guard permits a junction swap', async () => {
    if (process.platform !== 'win32') return;
    const sandbox = await mkdtemp(resolve(tmpdir(), 'parsyuva-final-cleanup-'));
    const externalRoot = resolve(sandbox, 'external-evidence');
    const swappedRunRoot = resolve(sandbox, 'swapped-run-root');
    const temporaryName = 'partial-receipt.tmp';
    const targetName = 'final-receipt.json';
    const externalTemporary = resolve(externalRoot, temporaryName);
    const externalTarget = resolve(externalRoot, targetName);
    await mkdir(externalRoot);
    await writeFile(externalTemporary, 'external-partial-evidence', 'utf8');
    await writeFile(externalTarget, 'external-final-evidence', 'utf8');
    await symlink(externalRoot, swappedRunRoot, 'junction');
    let closeAttemptCount = 0;
    try {
      const cleanup = await cleanupFailedFinalDeliveryWrite({
        handle: undefined,
        temporary: resolve(swappedRunRoot, temporaryName),
        target: resolve(swappedRunRoot, targetName),
        runRootGuard: {
          assertIntact: async () => { throw new Error('guard process is not alive'); },
          close: async () => { closeAttemptCount += 1; throw new Error('guard process terminated'); }
        }
      });
      expect(cleanup.cleanupAuthorized).toBe(false);
      expect(closeAttemptCount).toBe(1);
      await expect(readFile(externalTemporary, 'utf8')).resolves.toBe('external-partial-evidence');
      await expect(readFile(externalTarget, 'utf8')).resolves.toBe('external-final-evidence');
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});
