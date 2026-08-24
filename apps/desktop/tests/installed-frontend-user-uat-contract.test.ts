import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { PRODUCT_NAVIGATION_GROUPS, PRODUCT_NAVIGATION_ROUTES } from '@ppt/domain';
import {
  INSTALLED_EXECUTABLE_PATH,
  STRESS_VIEWPORT,
  parseArguments,
} from '../../../scripts/run-installed-frontend-user-uat.mjs';

const runnerUrl = new URL('../../../scripts/run-installed-frontend-user-uat.mjs', import.meta.url);
const interactionHelperUrl = new URL('../../../scripts/lib/installed-ui-interaction-coverage.mjs', import.meta.url);
const nativeDialogHelperUrl = new URL('../../../scripts/lib/windows-native-file-dialog-uat.mjs', import.meta.url);
const rendererAppUrl = new URL('../src/renderer/App.tsx', import.meta.url);

describe('canonical installed-only full UI UAT runner contract', () => {
  it('has one exact installed runtime and the wrapper-aligned mandatory CLI', () => {
    expect(INSTALLED_EXECUTABLE_PATH).toBe('C:\\Program Files\\PPT\\ParsYuva-Bronze\\ParsYuva-Bronze.exe');
    const options = parseArguments([
      '--installed-exe', INSTALLED_EXECUTABLE_PATH,
      '--package-provenance', 'C:\\PPT\\AYM\\06_KOD\\app\\artifacts\\validation\\windows-package-provenance.json',
      '--governed-preflight', 'C:\\PPT\\AYM\\06_KOD\\app\\artifacts\\validation\\governed-preflight.json',
      '--installation-preservation', 'C:\\PPT\\AYM\\06_KOD\\app\\artifacts\\validation\\bronze-installation-preservation.json',
      '--evidence-root', 'C:\\PPT\\AYM\\06_KOD\\app\\artifacts\\validation\\installed-uat-run',
      '--expected-release-id', 'bronze-2026-08-22-r50',
      '--parent-run-id', '11111111-1111-4111-8111-111111111111',
      '--output', 'C:\\PPT\\AYM\\06_KOD\\app\\artifacts\\validation\\installed-uat-run\\installed-frontend-user-uat111.json',
    ]);
    expect(options['installation-preservation']).toContain('installation-preservation');
    expect(() => parseArguments(['--installed-exe', INSTALLED_EXECUTABLE_PATH])).toThrow(/package-provenance/u);
    expect(() => parseArguments([...Object.entries(options).flatMap(([key, value]) => [`--${key}`, value]), '--app-path', 'source'])).toThrow(/Desteklenmeyen/u);
  });

  it('uses the canonical 4-module/22-route source and does not duplicate a source-Electron mode', async () => {
    const source = await readFile(runnerUrl, 'utf8');
    expect(PRODUCT_NAVIGATION_GROUPS).toHaveLength(4);
    expect(PRODUCT_NAVIGATION_ROUTES).toHaveLength(22);
    expect(source).toContain("PRODUCT_NAVIGATION_GROUPS, PRODUCT_NAVIGATION_ROUTES } from './lib/canonical-product-navigation.mjs'");
    expect(source).toContain("check(PRODUCT_NAVIGATION_GROUPS.length === 4");
    expect(source).toContain("check(PRODUCT_NAVIGATION_ROUTES.length === 22");
    expect(source).not.toContain('PPT_UAT_APP_PATH');
    expect(source).not.toContain('SOURCE_ELECTRON');
    expect(source).not.toContain('applicationPath ?');
  });

  it('binds exact provenance, receipt readback and installed executable identity', async () => {
    const source = await readFile(runnerUrl, 'utf8');
    for (const marker of [
      'packageProvenanceSha256',
      'installationPreservationSha256',
      'governedPreflightSha256',
      'sourceCommit',
      'governedSourceFingerprintSha256',
      'canonicalRuleRegistrySha256',
      'packagedRuntimeSha256',
      'Kurulu EXE paket runtime ile byte-identical değildir.',
      'Canlı clean Bronze source/package provenance readback bağı eşleşmiyor.',
      'Installed UI UAT receipt readback',
    ]) expect(source).toContain(marker);
    expect(source).toContain('RECEIPT_SCHEMA_VERSION = 3');
    expect(source).toContain('PPT-INSTALLED-FRONTEND-USER-UAT111-V3');
    expect(source).toContain("runtimeKind: INSTALLED_RUNTIME_KIND");
  });

  it('fails closed on path/reparse/process ownership and requires real profile-deletion readback', async () => {
    const source = await readFile(runnerUrl, 'utf8');
    for (const marker of [
      'assertNoReparseWindowsPath',
      'DESCENDANT_REPARSE',
      'realpath(targetPath)',
      'CreationDate',
      'processIdentityKey',
      'stopExactProcessIdentity',
      'identityUsesCreationDate: true',
      'deleteEphemeralProfile',
      'DELETED_AND_ABSENCE_READBACK_PASS',
      'absenceReadbackVerified: true',
      'profileCleanupAbsenceReadbackVerified',
      'excludeFromSourceBackup: true',
      'excludeFromExternalBackup: true',
    ]) expect(source).toContain(marker);
    expect(source).toContain("profileDisposition?.status === 'DELETED_AND_ABSENCE_READBACK_PASS'");
    expect(source).not.toContain('quarantineEphemeralProfile');
    expect(source).not.toContain("taskkill.exe");
    expect(source).not.toContain("Remove-Item -Recurse");
  });

  it('covers every route in normal and native 760x720 + 200% + high-contrast modes', async () => {
    const source = await readFile(runnerUrl, 'utf8');
    expect(STRESS_VIEWPORT).toEqual({ width: 760, height: 720, textScalePercent: 200, highContrast: true });
    expect(source).toContain("Browser.setWindowBounds");
    expect(source).toContain("cdpDeviceMetricsEmulationUsed: false");
    expect(source).not.toContain('Emulation.setDeviceMetricsOverride');
    expect(source).toContain("value: 'extra-large'");
    expect(source).toContain("labelPatterns: ['Yüksek kontrast', 'High contrast']");
    expect(source).toContain("for (const [index, descriptor] of routeDescriptors.entries())");
    expect(source).toContain("navigation.length === 44");
    expect(source).toContain('STRESS_760X720_200_HIGH_CONTRAST');
    expect(source).toContain("auditVisibleSurface(descriptor.routeId, '.app-shell', 'NORMAL')");
    expect(source).toContain("auditVisibleSurface(descriptor.routeId, '.app-shell', 'STRESS_760X720_200_HIGH_CONTRAST')");
    expect(source).not.toContain('auditVisibleSurface(`normal-${descriptor.routeId}`');
    expect(source).not.toContain('auditVisibleSurface(`stress-${descriptor.routeId}`');
    for (const marker of [
      'DOCUMENT_HORIZONTAL_OVERFLOW',
      'UNBOUNDED_NESTED_HORIZONTAL_OVERFLOW',
      'VISIBLE_SIBLING_OVERLAP',
      'VISIBLE_TEXT_LOW_CONTRAST',
      'VISIBLE_TEXT_TOO_SMALL',
      'VISIBLE_CONTROL_NOT_TABBABLE',
      'POSITIVE_TABINDEX_FORBIDDEN',
      'TEXT_CONTROL_NOT_ROUNDED',
    ]) expect(source).toContain(marker);
  });

  it('holds the evidence root and proves owned native file dialogs through cancel and accept', async () => {
    const source = `${await readFile(runnerUrl, 'utf8')}\n${await readFile(nativeDialogHelperUrl, 'utf8')}`;
    for (const marker of [
      'acquireExclusiveEvidenceRunRootGuard',
      'evidenceRunRootGuard.assertIntact()',
      'evidenceRunRootGuard.close()',
      'resolveInstalledUiNativeDialogSpecification',
      'createInstalledUiNativeDialogFixtures',
      'beginWindowsNativeFileDialogAutomation',
      "decision: 'CANCEL'",
      "decision: 'ACCEPT'",
      'finance:OPEN:FINANCE_IMPORT',
      'nativeDialogEvidenceCount',
      'nativeDialogEvidenceSha256',
      'INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY',
      'INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY_SHA256',
      'nativeDialogInventoryCount',
      'nativeDialogInventorySha256',
      'nativeDialogInventorySourceSha256',
      'nativeDialogInventory',
      "'EXERCISED', 'DISABLED', 'NOT_PRESENT'",
      'routeDomSnapshot',
      'sourceSnapshot',
      'printWindowTargetOnly',
      'pathRecorded: false',
      'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK',
      'remoteDebuggingPortInherited',
      'authenticatedSessionRevoked',
    ]) expect(source).toContain(marker);
  });

  it('uses semantic fixed-point discovery and outcome evidence without a brittle fixed interaction count', async () => {
    const source = `${await readFile(runnerUrl, 'utf8')}\n${await readFile(interactionHelperUrl, 'utf8')}`;
    for (const marker of [
      'createInstalledUiInteractionCoverageEngine',
      'INSTALLED_UI_SEMANTIC_SURFACES',
      'INSTALLED_UI_ACTIONABLE_SELECTOR',
      'CLICKED_OUTCOME_VERIFIED',
      'BLOCKED_DISABLED',
      'CDP_ACTION_SPECIFIC_OUTCOME_READBACK',
      'unclassifiedInteractionCount',
      'unexercisedEnabledInteractionCount',
      'interactionFixedPointReached',
      'disabledToEnabledTransitions',
      'interactionPasses',
      'interactionPassesSha256',
      'interactionEntriesSha256',
      'interactionMatrixStateKeys',
      'interactionMatrixStateKeysSha256',
      'fixedPointMatrixMembershipExact',
      'visibleControlSetSha256',
      'visibleStateKeys',
      'newStateKeys',
      'interactionRequiredQuietWindowMs',
      'applicationStateMatrixComplete',
      'auditKeyboardScrollAndTooltip',
      'createInstalledUiProcessOutputCollector',
      'waitForInteractionQuietWindow',
      'readCdpSettledActivity',
      'Page.setLifecycleEventsEnabled',
      'gestureSha256',
      'gesture: gestureEvidence',
      "type: 'mousePressed'",
      "type: 'mouseReleased'",
      "userGesture: 'POINTER_MOUSE_PRESS_RELEASE'",
      "activationMethod: 'POINTER_PRIMARY_BUTTON'",
      "Input.dispatchKeyEvent",
      'fullStreamHashed',
      'terminalAcceptOutcomes',
      'terminalAcceptOutcomes.length === terminalAcceptProbes.length',
      'for (const probe of orderedTerminalAcceptProbes)',
      'navigationRouteId',
      'controlDataRoute',
      'controlHref',
      'controlRole',
      'pageLifecycleStable',
      'barrierFingerprint',
    ]) expect(source).toContain(marker);
    expect(source).toContain("defaultScenarios: ['BASELINE']");
    expect(source).toContain("interactionCoverageEngine.assertComplete()");
    expect(source).not.toContain('MINIMUM_CLICKED_INTERACTIONS');
    expect(source).not.toContain("disposition: 'DEFERRED_EXTERNAL_EVIDENCE'");
    expect(source).not.toContain('mainProcessExceptionCount: 0');
    expect(source).not.toContain('element.click();return true');
    expect(source).not.toContain('new Proxy(original');
    expect(source).not.toContain("Object.defineProperty(globalThis,'pardus'");
    expect(source).not.toMatch(/interactions\.length\s*[!=]==?\s*235/u);
  });

  it('redacts and scans every screenshot while retaining only hashes/readback metadata', async () => {
    const source = await readFile(runnerUrl, 'utf8');
    for (const marker of [
      'redactSensitiveDom',
      'restoreSensitiveDom',
      'REDACT_AND_SCAN_BEFORE_EVERY_CAPTURE',
      'remainingSensitiveCount === 0',
      'scanScreenshotSecretSurfaces',
      'canvasFallback',
      'pseudoContent',
      'backgroundContent',
      'PASS_PHYSICAL_PIXEL_OCR',
      'NOT_RUN_PHYSICAL_PIXEL_OCR',
      'secretScanApplied: true',
      'unredactedSecretCount: 0',
      'readbackVerified: true',
      'screenshotManifestSha256',
      'randomBytes(24)',
      'sensitiveValues.clear()',
    ]) expect(source).toContain(marker);
    expect(source).not.toContain('UatYerel50!Guvenli');
    expect(source).not.toMatch(/passwordRecorded:\s*true/u);
    expect(source).not.toMatch(/twoFactorSecretRecorded:\s*true/u);
  });

  it('retains lossless tooltip, nested-scroll and real state assertion evidence', async () => {
    const source = await readFile(runnerUrl, 'utf8');
    for (const marker of [
      'scrollContainerCount',
      'expectedScrollContainerIds',
      'focusTargetFound',
      'expectedTargetIdentity',
      'focusTargetIdentity',
      'visibleTargetCount:visibleTargets.length',
      'validateInstalledUiScrollEvidence(scrollEvidence',
      'item.expectedTargetIdentity === item.focusTargetIdentity',
      '!element.contains(focusTarget)',
      '!focusTarget.contains(element)',
      'tooltipResults',
      'targetIdentity',
      'contentSha256',
      'enabledControlStateKeys',
      'enabledControlIdentities',
      'forwardReachedControlIdentities',
      'reverseReachedControlIdentities',
      'forwardReachedStateKeys',
      'reverseReachedStateKeys',
      'modalForwardFocusIdentities',
      'modalReverseFocusIdentities',
      'VISIBLE_LOADING_STATE_OBSERVED',
      'VISIBLE_PERMISSION_DENIAL_AFTER_GESTURE',
      'visibleSelector',
      'textSha256',
      'actionCorrelation',
      'JAVASCRIPT_CONFIRMATION_AND_TERMINAL_POSTCONDITION',
      'createApplicationStateEvidenceMaterial',
      'snapshotSha256',
      "outcomeKind: 'VISIBLE_LOADING_STATE'",
      "outcomeKind: 'VALIDATION_REJECTION'",
      "outcomeKind: 'AUTHENTICATED_TRUSTED_DEVICE'",
    ]) expect(source).toContain(marker);
    expect(source).not.toContain('terminalAcceptProbes[0]');
    expect(source).not.toContain("style.whiteSpace!=='normal'");
    expect(source).toContain('domText: scan(surfaces.domText)');
    expect(source).toContain("formValues: scan(surfaces.formValues.join('\\n'))");
  });

  it('records TR/EN narration invocation, voice fallback, stop/no-overlap and captions without audibility claims', async () => {
    const source = await readFile(runnerUrl, 'utf8');
    for (const marker of [
      "verifyNarrationLanguage('tr')",
      "verifyNarrationLanguage('en')",
      'FEMALE_PREFERRED',
      'SAME_LANGUAGE_FALLBACK',
      'VISIBLE_CAPTION_FALLBACK',
      'femaleAvailable',
      'cancels > 0',
      'maxActive <= 1',
      'captionPresent',
      'physicalAudioAudibilityClaimed: false',
    ]) expect(source).toContain(marker);
  });

  it('scans the required technical error families and does not launch on module import', async () => {
    const source = await readFile(runnerUrl, 'utf8');
    for (const marker of ['Error invoking', 'object\\s+Object', 'SQL|SQLite|IPC|Repository', 'stack trace', 'VISIBLE_TECHNICAL_ERROR']) expect(source).toContain(marker);
    expect(source).toContain('const isDirectExecution =');
    expect(source).toContain('if (isDirectExecution)');
  });

  it('records real offline and natural error states in the installed application matrix', async () => {
    const source = await readFile(runnerUrl, 'utf8');
    const renderer = await readFile(rendererAppUrl, 'utf8');
    expect(source).toContain("client.send('Network.emulateNetworkConditions', { offline: true");
    expect(source).toContain("waitFor('navigator.onLine===false'");
    expect(source).toContain('readLocalPreloadIpcSummary');
    expect(source).toContain('beforeIpcSummarySha256 === offlineState.offlineIpcSummarySha256');
    expect(source).toContain('authIpcReadbackVerified: true');
    expect(source).toContain('dashboardIpcReadbackVerified: true');
    expect(source).toContain("recordApplicationState('OFFLINE', 'NETWORK_OFFLINE_LOCAL_SHELL_READBACK'");
    expect(source).toContain("outcomeKind: 'OFFLINE_LOCAL_OPERATION_READBACK'");
    expect(source).toContain("fillInput('input[inputmode=\"numeric\"]', '00000X')");
    expect(source).toContain("recordApplicationState('ERROR', 'FIRST_RUN_TWO_FACTOR_IPC_REJECTION_NATURAL_UI'");
    expect(source).toContain("outcomeKind: 'AUTHENTICATION_REJECTION'");
    expect(source).toContain('technicalLeakDetected');
    expect(source).toContain('messageSha256');
    expect(renderer).toContain("setMessageTone('danger')");
    expect(renderer).toContain('<StatusMessage tone={messageTone}>');
  });

  it('uses exact canonical English labels, starts in Turkish and proves backdrop pointer dismissal with focus return', async () => {
    const source = await readFile(runnerUrl, 'utf8');
    expect(source).toContain("const canonicalGroups = PRODUCT_NAVIGATION_GROUPS.map((group) => language === 'tr' ? group.label : group.englishLabel)");
    expect(source).toContain("const canonicalRoutes = PRODUCT_NAVIGATION_ROUTES.map((route) => ({ routeId: route.id, label: language === 'tr' ? route.label : route.englishLabel }))");
    expect(source.indexOf("await setApplicationLanguage('tr');")).toBeLessThan(source.indexOf("const initialCollapsed = await evaluate"));
    expect(source).toContain('verifyCommandPaletteBackdropDismissal');
    expect(source).toContain("expectedSelector: '.command-overlay'");
    expect(source).toContain('focusReturned: true');
  });
});
