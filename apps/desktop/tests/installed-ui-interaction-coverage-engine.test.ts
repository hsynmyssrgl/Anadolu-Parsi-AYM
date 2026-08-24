import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  INSTALLED_UI_ACTION_METHODS,
  INSTALLED_UI_ACTIONABLE_SELECTOR,
  INSTALLED_UI_ASSERTION_IDS,
  INSTALLED_UI_EVIDENCE_KINDS,
  INSTALLED_UI_KEYBOARD_PLAN,
  INSTALLED_UI_NATIVE_ASSERTION_IDS,
  INSTALLED_UI_NATIVE_EVIDENCE_KINDS,
  INSTALLED_UI_NATIVE_POSTCONDITION_KINDS,
  INSTALLED_UI_POSTCONDITION_KINDS,
  INSTALLED_UI_REQUIRED_STATE_SCENARIOS,
  INSTALLED_UI_SCROLL_PLAN,
  INSTALLED_UI_SEMANTIC_SURFACES,
  INSTALLED_UI_STATE_ASSERTIONS,
  INSTALLED_UI_STATE_OUTCOME_KINDS,
  INSTALLED_UI_USER_GESTURES,
  assertNoInstalledUiMainProcessExceptions,
  buildInstalledUiAccessibilityPlan,
  buildInstalledUiStateMatrixPlan,
  classifyInstalledUiActionSafety,
  classifyInstalledUiMainStderr,
  createInstalledUiInteractionCoverageEngine,
  createInstalledUiProcessOutputCollector,
  createSemanticControlIdentity,
  scanInstalledUiSecretBearingText,
  validateInstalledUiApplicationStateEvidence,
  validateInstalledUiOutcomeOracle,
  validateInstalledUiScrollEvidence,
} from '../../../scripts/lib/installed-ui-interaction-coverage.mjs';

const sha = (character: string) => character.repeat(64);
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stateBinding = (routeId = 'dashboard', logicalControlId = 'state-probe') => {
  const controlIdentity = digest({ routeId, logicalControlId });
  return { routeId, controlIdentity, stateKey: digest({ controlIdentity, logicalControlId }) };
};
const rawStateEvidence = (outcomeKind: string, snapshot: Record<string, unknown>, binding = stateBinding()) => ({
  ...binding,
  outcomeKind,
  snapshot,
  snapshotSha256: digest(snapshot),
});
const stateEntry = (scenario: string, assertion: string, rawEvidence: ReturnType<typeof rawStateEvidence>) => ({
  scenario,
  status: 'PASS',
  evidence: [{ assertion, sha256: digest(rawEvidence), rawEvidence }],
});
const evidence = (character = 'a') => [{ kind: 'CDP_ACTION_SPECIFIC_OUTCOME_READBACK', sha256: sha(character) }];
const quietWindow = (overrides: Record<string, unknown> = {}) => ({ status: 'PASS', quietForMs: 700, domStable: true, networkStable: true, ipcStable: true, pageLifecycleStable: true, networkInFlight: 0, ipcInFlight: 0, finalSerials: { domSerial: 1, networkSerial: 1, networkInFlight: 0, ipcSerial: 1, ipcInFlight: 0, pageSerial: 1, barrierFingerprint: sha('9') }, ...overrides });
const control = (overrides: Record<string, unknown> = {}) => ({
  routeId: 'dashboard',
  scenario: 'EMPTY',
  surfaceId: 'main',
  role: 'button',
  locator: '#main-content/button:first-of-type',
  label: 'Yenile',
  visible: true,
  enabled: true,
  ...overrides,
});
const gestureFor = (semantic: ReturnType<typeof createSemanticControlIdentity>) => ({
  routeId: semantic.routeId,
  runtimeId: 'installed-uat-test-control',
  activationMethod: 'POINTER_PRIMARY_BUTTON',
  expectedKeyboardActivation: 'ENTER',
  pointerSequence: 'MOUSE_MOVED_MOUSE_PRESSED_MOUSE_RELEASED',
  pointerTargetRuntimeId: 'installed-uat-test-control',
  mouseMoved: true,
  mousePressed: true,
  mouseReleased: true,
  button: 'left',
  clickCount: 1,
  modalFocusTrap: 'NOT_APPLICABLE_NO_OPEN_MODAL',
  hitTestPassed: true,
  focusVisible: true,
  x: 40,
  y: 60,
});
const stateChangeOracle = (semantic: ReturnType<typeof createSemanticControlIdentity>, overrides: Record<string, unknown> = {}) => {
  const gesture = gestureFor(semantic);
  return ({
  status: 'PASS',
  kind: 'STATE_CHANGE',
  settled: true,
  userGesture: 'POINTER_MOUSE_PRESS_RELEASE',
  beforeFingerprint: sha('1'),
  afterFingerprint: sha('2'),
  semanticStateChanged: true,
  actionSpecificReadback: true,
  actionCorrelation: { controlIdentity: semantic.identity, stateKey: semantic.stateKey, gestureSha256: createHash('sha256').update(JSON.stringify(gesture)).digest('hex'), gesture },
  postcondition: { status: 'PASS', actionSpecific: true, kind: 'TARGET_STATE_CHANGED' },
  keyboardActivation: { status: 'PASS', expected: 'ENTER', actual: 'ENTER', focusVisible: true },
  quietWindow: quietWindow(),
  evidence: evidence(),
  assertions: [{ id: 'VISIBLE_STATE_FINGERPRINT_CHANGED', status: 'PASS' }],
  ...overrides,
  });
};

const nativeTargetWindow = (overrides: Record<string, unknown> = {}) => {
  const identity = {
    className: '#32770',
    processId: 4242,
    creationTimeUtc: '2026-08-24T01:00:00.0000000Z',
    ownerProcessId: 0,
    ownerCreationTimeUtc: '',
    ownershipMode: 'DIRECT_TARGET_PROCESS',
    titleSha256: sha('a'),
    automationIdSha256: sha('b'),
    bounds: { left: 20, top: 30, width: 640, height: 480 },
    uiAutomationInvokePattern: true,
    printWindowTargetOnly: true,
    ...overrides,
  };
  return { ...identity, identitySha256: digest(identity) };
};

const nativeDecision = (
  semantic: ReturnType<typeof createSemanticControlIdentity>,
  decision: 'CANCEL' | 'ACCEPT',
  postconditionKind: string,
  overrides: Record<string, unknown> = {},
) => {
  const gesture = gestureFor(semantic);
  return {
    status: 'PASS',
    decision,
    targetObserved: true,
    targetClosed: true,
    dialogKind: 'OPEN',
    beforeFingerprint: sha('1'),
    afterFingerprint: decision === 'CANCEL' ? sha('1') : sha('2'),
    semanticStateChanged: decision === 'ACCEPT',
    actionCorrelation: {
      controlIdentity: semantic.identity,
      stateKey: semantic.stateKey,
      gestureSha256: digest(gesture),
      gesture,
    },
    targetWindow: nativeTargetWindow(),
    screenshot: {
      path: `artifacts/validation/native-${decision.toLowerCase()}.png`,
      sizeBytes: 4096,
      sha256: decision === 'CANCEL' ? sha('c') : sha('d'),
      width: 640,
      height: 480,
      readbackVerified: true,
      targetOnly: true,
    },
    selection: {
      kind: 'SAFE_JSON_IMPORT',
      synthetic: true,
      fileName: 'sentetik-aile.json',
      extension: '.json',
      existsAfterDecision: true,
      sizeBytes: 128,
      sha256: sha('e'),
      pathRecorded: false,
      withinDisposableProfile: true,
    },
    postcondition: {
      status: 'PASS',
      kind: postconditionKind,
      applicationReadbackVerified: true,
      selectedArtifactReadbackVerified: true,
    },
    quietWindow: quietWindow(),
    ...overrides,
  };
};

const nativeCancelAcceptOracle = (
  semantic: ReturnType<typeof createSemanticControlIdentity>,
  mutate?: (record: Record<string, any>) => void,
) => {
  const record: Record<string, any> = {
    routeId: semantic.routeId,
    controlIdentity: semantic.identity,
    stateKey: semantic.stateKey,
    labelClass: 'ARCHIVE_FILE_ADD',
    dialogKind: 'OPEN',
    status: 'PASS',
    cancel: nativeDecision(semantic, 'CANCEL', 'NATIVE_DIALOG_CANCELLED_WITHOUT_SELECTION_MUTATION'),
    accept: nativeDecision(semantic, 'ACCEPT', 'NATIVE_OPEN_SELECTION_AND_APPLICATION_READBACK_VERIFIED'),
  };
  mutate?.(record);
  return stateChangeOracle(semantic, {
    kind: 'NATIVE_DIALOG_ACCEPT',
    actionCorrelation: record.accept.actionCorrelation,
    postcondition: { ...record.accept.postcondition, actionSpecific: true },
    keyboardActivation: { status: 'PASS', expected: 'ENTER', actual: 'ENTER', focusVisible: true },
    evidence: [{ kind: 'WINDOWS_UIAUTOMATION_NATIVE_DIALOG_CANCEL_ACCEPT_READBACK', sha256: digest(record) }],
    assertions: [
      { id: 'OWNED_NATIVE_DIALOG_CANCEL_VERIFIED', status: 'PASS' },
      { id: 'OWNED_NATIVE_DIALOG_ACCEPT_AND_POSTCONDITION_VERIFIED', status: 'PASS' },
    ],
    quietWindow: record.accept.quietWindow,
    nativeDialog: record,
  });
};

const nativeRestoreOracle = (semantic: ReturnType<typeof createSemanticControlIdentity>) => {
  const process = {
    previousProcessId: 4242,
    previousCreationTimeUtc: '2026-08-24T01:00:00.0000000Z',
    previousRootAbsent: true,
    replacementProcessId: 4343,
    replacementCreationTimeUtc: '2026-08-24T01:01:00.0000000Z',
    replacementExecutableSha256: sha('f'),
    exactExecutablePathVerified: true,
    remoteDebuggingPortInherited: true,
    restoredAccountInitialized: true,
    authenticatedSessionRevoked: true,
  };
  const record: Record<string, any> = {
    routeId: semantic.routeId,
    controlIdentity: semantic.identity,
    stateKey: semantic.stateKey,
    labelClass: 'SECURITY_RESTORE_BACKUP',
    dialogKind: 'OPEN',
    status: 'PASS',
    cancel: nativeDecision(semantic, 'CANCEL', 'NATIVE_DIALOG_CANCELLED_WITHOUT_SELECTION_MUTATION'),
    accept: nativeDecision(semantic, 'ACCEPT', 'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK'),
  };
  record.accept.postcondition = { ...record.accept.postcondition, process };
  return stateChangeOracle(semantic, {
    kind: 'TERMINAL_DISPOSABLE_PROFILE',
    actionCorrelation: record.accept.actionCorrelation,
    postcondition: { status: 'PASS', actionSpecific: true, kind: 'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK' },
    keyboardActivation: { status: 'PASS', expected: 'ENTER', actual: 'ENTER', focusVisible: true },
    evidence: [{ kind: 'WINDOWS_UIAUTOMATION_NATIVE_RESTORE_TERMINAL_READBACK', sha256: digest(record) }],
    assertions: [
      { id: 'NATIVE_RESTORE_CANCEL_AND_ACCEPT_VERIFIED', status: 'PASS' },
      { id: 'OWNED_RELAUNCH_AND_SESSION_REVOCATION_VERIFIED', status: 'PASS' },
    ],
    quietWindow: record.accept.quietWindow,
    profileClassification: 'SYNTHETIC_DISPOSABLE_PROFILE',
    terminalDecision: 'ACCEPT',
    terminalPostcondition: {
      status: 'PASS',
      observed: true,
      decision: 'ACCEPT',
      kind: 'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK',
      controlIdentity: semantic.identity,
      stateKey: semantic.stateKey,
      beforeFingerprint: sha('1'),
      afterFingerprint: sha('2'),
      process,
    },
    nativeDialog: record,
  });
};

describe('installed UI semantic interaction coverage engine', () => {
  it('covers main, shell, overlays, menus and form semantics without button-only discovery', () => {
    expect(INSTALLED_UI_SEMANTIC_SURFACES.map((surface) => surface.id)).toEqual([
      'main', 'sidebar', 'topbar', 'dialog', 'popover', 'menu', 'form',
    ]);
    for (const selector of ['input:not([type="hidden"])', 'select', 'textarea', '[role="menuitem"]', '[role="switch"]', '[contenteditable="true"]']) {
      expect(INSTALLED_UI_ACTIONABLE_SELECTOR).toContain(selector);
    }
  });

  it('keeps control identity stable while treating disabled to enabled as a new state', () => {
    const disabled = createSemanticControlIdentity(control({ enabled: false }));
    const enabled = createSemanticControlIdentity(control({ enabled: true }));
    expect(disabled.identity).toBe(enabled.identity);
    expect(disabled.stateKey).not.toBe(enabled.stateKey);

    const plan = buildInstalledUiStateMatrixPlan(['dashboard'], { defaultScenarios: ['EMPTY'] });
    const engine = createInstalledUiInteractionCoverageEngine({ routeIds: ['dashboard'], stateMatrixPlan: plan, requiredStablePasses: 1 });
    engine.observePass({ routeId: 'dashboard', scenario: 'EMPTY', controls: [control({ enabled: false })], quietWindow: quietWindow() });
    engine.classify(disabled.stateKey, { disposition: 'BLOCKED_DISABLED', reason: 'Zorunlu alanlar henüz doldurulmadı.' });
    engine.observePass({ routeId: 'dashboard', scenario: 'EMPTY', controls: [control({ enabled: true })], quietWindow: quietWindow() });
    expect(engine.pending()).toEqual([expect.objectContaining({ stateKey: enabled.stateKey, enabled: true })]);
    expect(engine.report().disabledToEnabledTransitions).toHaveLength(1);
  });

  it('requires an outcome oracle instead of accepting a successful element.click call', () => {
    const semantic = createSemanticControlIdentity(control());
    expect(() => validateInstalledUiOutcomeOracle(semantic, stateChangeOracle(semantic, { settled: false }))).toThrow(/async-settle/u);
    expect(() => validateInstalledUiOutcomeOracle(semantic, stateChangeOracle(semantic, { afterFingerprint: sha('1') }))).toThrow(/durum değişimi/u);
    expect(() => validateInstalledUiOutcomeOracle(semantic, stateChangeOracle(semantic, { semanticStateChanged: false }))).toThrow(/odak/u);
    expect(validateInstalledUiOutcomeOracle(semantic, stateChangeOracle(semantic))).toEqual(expect.objectContaining({ status: 'PASS', kind: 'STATE_CHANGE' }));
  });

  it('requires real cancel/accept postconditions for disposable-profile terminal outcomes', () => {
    const destructive = createSemanticControlIdentity(control({ label: 'Nihai imha', actionHint: 'DESTRUCTIVE' }));
    expect(classifyInstalledUiActionSafety(destructive)).toEqual({
      classification: 'DISPOSABLE_PROFILE_SAFE_OUTCOME_REQUIRED',
      allowedOutcomeKinds: ['TERMINAL_DISPOSABLE_PROFILE'],
    });
    expect(() => validateInstalledUiOutcomeOracle(destructive, stateChangeOracle(destructive))).toThrow(/kabul edilmez/u);
    expect(() => validateInstalledUiOutcomeOracle(destructive, stateChangeOracle(destructive, {
      kind: 'TERMINAL_DISPOSABLE_PROFILE', profileClassification: 'SYNTHETIC_DISPOSABLE_PROFILE', terminalDecision: 'ACCEPT',
    }))).toThrow(/son-koşul/u);
    expect(validateInstalledUiOutcomeOracle(destructive, stateChangeOracle(destructive, {
      kind: 'TERMINAL_DISPOSABLE_PROFILE',
      profileClassification: 'SYNTHETIC_DISPOSABLE_PROFILE',
      terminalDecision: 'ACCEPT',
      terminalPostcondition: { status: 'PASS', observed: true, decision: 'ACCEPT', controlIdentity: destructive.identity, stateKey: destructive.stateKey },
    }))).toEqual(expect.objectContaining({ status: 'PASS', safetyClassification: 'DISPOSABLE_PROFILE_SAFE_OUTCOME_REQUIRED' }));
    const cancel = stateChangeOracle(destructive, {
      kind: 'TERMINAL_DISPOSABLE_PROFILE', beforeFingerprint: sha('1'), afterFingerprint: sha('1'), semanticStateChanged: false,
      profileClassification: 'SYNTHETIC_DISPOSABLE_PROFILE', terminalDecision: 'CANCEL',
      terminalPostcondition: { status: 'PASS', observed: true, decision: 'CANCEL', controlIdentity: destructive.identity, stateKey: destructive.stateKey },
    });
    expect(validateInstalledUiOutcomeOracle(destructive, cancel)).toEqual(expect.objectContaining({ terminalDecision: 'CANCEL' }));
    expect(() => validateInstalledUiOutcomeOracle(destructive, {
      ...cancel,
      terminalPostcondition: { ...cancel.terminalPostcondition, controlIdentity: sha('f') },
    })).toThrow(/son-koşul/u);
  });

  it('rejects a no-op backed only by generic health instead of an action-specific readback', () => {
    const semantic = createSemanticControlIdentity(control());
    const noOp = stateChangeOracle(semantic, {
      kind: 'IDEMPOTENT_READ_ONLY', beforeFingerprint: sha('1'), afterFingerprint: sha('1'), semanticStateChanged: false,
      actionSpecificReadback: false, postcondition: { status: 'PASS', actionSpecific: false, kind: 'CORE_HEALTH_OK' },
      assertions: [{ id: 'CORE_HEALTH_OK', status: 'PASS' }],
    });
    expect(() => validateInstalledUiOutcomeOracle(semantic, noOp)).toThrow(/eyleme özgü/u);
  });

  it('accepts a no-op only for the same canonical navigation control and route readback', () => {
    const navigation = createSemanticControlIdentity(control({
      role: 'button', locator: '[data-navigation-route="dashboard"]', actionHint: 'NAVIGATION_ROUTE',
      navigationRouteId: 'dashboard', dataRoute: 'dashboard', href: '',
    }));
    const readOnly = stateChangeOracle(navigation, {
      kind: 'IDEMPOTENT_READ_ONLY', beforeFingerprint: sha('1'), afterFingerprint: sha('1'), semanticStateChanged: false,
      actionSpecificReadback: true,
      postcondition: { status: 'PASS', actionSpecific: true, kind: 'NAVIGATION_ROUTE_CURRENT' },
      assertions: [{ id: 'ACTION_SPECIFIC_READBACK_VERIFIED', status: 'PASS' }],
      routeReadback: { status: 'PASS', expectedRouteId: 'dashboard', observedRouteId: 'dashboard', controlDataRoute: 'dashboard', controlHref: '', controlRole: 'button' },
    });
    expect(validateInstalledUiOutcomeOracle(navigation, readOnly)).toMatchObject({ status: 'PASS', kind: 'IDEMPOTENT_READ_ONLY' });
    expect(() => validateInstalledUiOutcomeOracle(createSemanticControlIdentity(control()), readOnly)).toThrow(/nedensel|geri-okuma/u);
  });

  it('allows native deferral only with an exact external evidence binding', () => {
    const plan = buildInstalledUiStateMatrixPlan(['archive'], { defaultScenarios: ['EMPTY'] });
    const engine = createInstalledUiInteractionCoverageEngine({ routeIds: ['archive'], stateMatrixPlan: plan, requiredStablePasses: 1 });
    const native = createSemanticControlIdentity(control({ routeId: 'archive', label: 'Dosya seç', actionHint: 'NATIVE_DIALOG' }));
    engine.observePass({ routeId: 'archive', scenario: 'EMPTY', controls: [control({ routeId: 'archive', label: 'Dosya seç', actionHint: 'NATIVE_DIALOG' })], quietWindow: quietWindow() });
    expect(() => engine.classify(native.stateKey, { disposition: 'DEFERRED_EXTERNAL_EVIDENCE', reason: 'NATIVE_OS_BOUNDARY', externalEvidence: [] })).toThrow(/kanıt bağı/u);

    const retry = createInstalledUiInteractionCoverageEngine({ routeIds: ['archive'], stateMatrixPlan: plan, requiredStablePasses: 1 });
    retry.observePass({ routeId: 'archive', scenario: 'EMPTY', controls: [control({ routeId: 'archive', label: 'Dosya seç', actionHint: 'NATIVE_DIALOG' })], quietWindow: quietWindow() });
    expect(() => retry.classify(native.stateKey, { disposition: 'DEFERRED_EXTERNAL_EVIDENCE', reason: 'NATIVE_OS_BOUNDARY', externalEvidence: evidence('b') })).toThrow(/hedef pencere/u);
    const boundEvidence = [{ ...evidence('b')[0], controlIdentity: native.identity, stateKey: native.stateKey, targetObserved: true, targetClosed: true, targetWindowSha256: sha('c') }];
    retry.classify(native.stateKey, { disposition: 'DEFERRED_EXTERNAL_EVIDENCE', reason: 'NATIVE_OS_BOUNDARY', externalEvidence: boundEvidence });
    retry.observePass({ routeId: 'archive', scenario: 'EMPTY', controls: [control({ routeId: 'archive', label: 'Dosya seç', actionHint: 'NATIVE_DIALOG' })], quietWindow: quietWindow() });
    expect(retry.assertComplete()).toEqual(expect.objectContaining({ status: 'PASS', deferredExternalEvidenceCount: 1 }));
  });

  it('classifies the real owned native CANCEL and ACCEPT runtime oracle and rejects forged bindings', () => {
    expect(INSTALLED_UI_NATIVE_POSTCONDITION_KINDS).toEqual([
      'NATIVE_DIALOG_CANCELLED_WITHOUT_SELECTION_MUTATION',
      'NATIVE_SAVE_ARTIFACT_READBACK_VERIFIED',
      'NATIVE_OPEN_SELECTION_AND_APPLICATION_READBACK_VERIFIED',
      'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK',
    ]);
    expect(INSTALLED_UI_NATIVE_EVIDENCE_KINDS).toEqual([
      'WINDOWS_UIAUTOMATION_NATIVE_DIALOG_CANCEL_ACCEPT_READBACK',
      'WINDOWS_UIAUTOMATION_NATIVE_RESTORE_TERMINAL_READBACK',
    ]);
    expect(INSTALLED_UI_NATIVE_ASSERTION_IDS).toEqual([
      'OWNED_NATIVE_DIALOG_CANCEL_VERIFIED',
      'OWNED_NATIVE_DIALOG_ACCEPT_AND_POSTCONDITION_VERIFIED',
      'NATIVE_RESTORE_CANCEL_AND_ACCEPT_VERIFIED',
      'OWNED_RELAUNCH_AND_SESSION_REVOCATION_VERIFIED',
    ]);

    const rawNative = control({ routeId: 'archive', label: 'Dosya seç', actionHint: 'NATIVE_DIALOG' });
    const native = createSemanticControlIdentity(rawNative);
    const classify = (outcome: ReturnType<typeof nativeCancelAcceptOracle>) => {
      const plan = buildInstalledUiStateMatrixPlan(['archive'], { defaultScenarios: ['EMPTY'] });
      const engine = createInstalledUiInteractionCoverageEngine({ routeIds: ['archive'], stateMatrixPlan: plan, requiredStablePasses: 1 });
      engine.observePass({ routeId: 'archive', scenario: 'EMPTY', controls: [rawNative], quietWindow: quietWindow() });
      engine.classify(native.stateKey, { disposition: 'CLICKED_OUTCOME_VERIFIED', outcome });
      engine.observePass({ routeId: 'archive', scenario: 'EMPTY', controls: [rawNative], quietWindow: quietWindow() });
      return engine.assertComplete();
    };
    expect(classify(nativeCancelAcceptOracle(native))).toMatchObject({ status: 'PASS', clickedOutcomeVerifiedCount: 1 });
    const ownerOwned = nativeCancelAcceptOracle(native, (record) => {
      for (const decision of [record.cancel, record.accept]) {
        decision.targetWindow = nativeTargetWindow({
          creationTimeUtc: '',
          ownerProcessId: 7777,
          ownerCreationTimeUtc: '2026-08-24T01:00:00.0000000Z',
          ownershipMode: 'OWNER_PROCESS',
        });
      }
    });
    expect(classify(ownerOwned)).toMatchObject({ status: 'PASS', clickedOutcomeVerifiedCount: 1 });

    const wrongOwner = nativeCancelAcceptOracle(native, (record) => {
      record.cancel.targetWindow = nativeTargetWindow({ creationTimeUtc: '', ownerProcessId: 0, ownerCreationTimeUtc: '' });
    });
    expect(() => classify(wrongOwner)).toThrow(/sahiplik\/kimlik/u);

    const wrongGesture = nativeCancelAcceptOracle(native, (record) => {
      const gesture = { ...record.cancel.actionCorrelation.gesture, hitTestPassed: false };
      record.cancel.actionCorrelation = { ...record.cancel.actionCorrelation, gesture, gestureSha256: digest(gesture) };
    });
    expect(() => classify(wrongGesture)).toThrow(/gerçek kullanıcı jesti/u);

    const wrongScreenshot = nativeCancelAcceptOracle(native, (record) => {
      record.cancel.screenshot = { ...record.cancel.screenshot, targetOnly: false };
    });
    expect(() => classify(wrongScreenshot)).toThrow(/screenshot\/readback/u);

    const wrongPostcondition = nativeCancelAcceptOracle(native, (record) => {
      record.accept.postcondition = { ...record.accept.postcondition, kind: 'NATIVE_SAVE_ARTIFACT_READBACK_VERIFIED' };
    });
    expect(() => classify(wrongPostcondition)).toThrow(/son-koşul/u);
  });

  it('classifies the real terminal native restore oracle with exact owned relaunch readback', () => {
    const rawRestore = control({ routeId: 'security', label: 'Yedeği geri yükle', actionHint: 'DESTRUCTIVE' });
    const restore = createSemanticControlIdentity(rawRestore);
    const plan = buildInstalledUiStateMatrixPlan(['security'], { defaultScenarios: ['EMPTY'] });
    const classify = (outcome: ReturnType<typeof nativeRestoreOracle>) => {
      const engine = createInstalledUiInteractionCoverageEngine({ routeIds: ['security'], stateMatrixPlan: plan, requiredStablePasses: 1 });
      engine.observePass({ routeId: 'security', scenario: 'EMPTY', controls: [rawRestore], quietWindow: quietWindow() });
      engine.classify(restore.stateKey, { disposition: 'CLICKED_OUTCOME_VERIFIED', outcome });
      engine.observePass({ routeId: 'security', scenario: 'EMPTY', controls: [rawRestore], quietWindow: quietWindow() });
      return engine.assertComplete();
    };
    expect(classify(nativeRestoreOracle(restore))).toMatchObject({ status: 'PASS', clickedOutcomeVerifiedCount: 1 });
    const mismatchedProcess = nativeRestoreOracle(restore);
    mismatchedProcess.terminalPostcondition.process = {
      ...mismatchedProcess.terminalPostcondition.process,
      replacementProcessId: 9999,
    };
    expect(() => classify(mismatchedProcess)).toThrow(/ham owned relaunch/u);
  });

  it('fails closed until every state context reaches fixed point with zero residuals', () => {
    const plan = buildInstalledUiStateMatrixPlan(['dashboard'], { defaultScenarios: ['EMPTY', 'POPULATED'] });
    const engine = createInstalledUiInteractionCoverageEngine({ routeIds: ['dashboard'], stateMatrixPlan: plan, requiredStablePasses: 2 });
    const emptyControl = createSemanticControlIdentity(control());
    engine.observePass({ routeId: 'dashboard', scenario: 'EMPTY', controls: [control()], quietWindow: quietWindow() });
    expect(engine.report()).toMatchObject({ status: 'FAIL', unclassifiedCount: 1, missingStateContextCount: 1, fixedPointReached: false });
    engine.classify(emptyControl.stateKey, { disposition: 'CLICKED_OUTCOME_VERIFIED', outcome: stateChangeOracle(emptyControl) });
    expect(engine.report().entries[0].outcome).toMatchObject({
      actionCorrelation: { controlIdentity: emptyControl.identity, stateKey: emptyControl.stateKey, gesture: { activationMethod: 'POINTER_PRIMARY_BUTTON' } },
      postcondition: { status: 'PASS', actionSpecific: true },
      quietWindow: { status: 'PASS', quietForMs: 700 },
      beforeFingerprint: sha('1'), afterFingerprint: sha('2'),
    });
    engine.observePass({ routeId: 'dashboard', scenario: 'EMPTY', controls: [control()], quietWindow: quietWindow() });
    engine.observePass({ routeId: 'dashboard', scenario: 'EMPTY', controls: [control()], quietWindow: quietWindow() });
    engine.observePass({ routeId: 'dashboard', scenario: 'POPULATED', controls: [], quietWindow: quietWindow() });
    engine.observePass({ routeId: 'dashboard', scenario: 'POPULATED', controls: [], quietWindow: quietWindow() });
    expect(engine.report()).toMatchObject({
      status: 'PASS', unclassifiedCount: 0, unexercisedEnabledCount: 0, missingStateContextCount: 0, fixedPointReached: true,
      fixedPointMatrixMembershipExact: true,
      stablePassesByContext: { 'dashboard:EMPTY': 2, 'dashboard:POPULATED': 2 },
    });
    expect(engine.report().matrixStateKeys).toEqual([emptyControl.stateKey]);
    expect(engine.report().matrixStateKeysSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(engine.assertComplete().status).toBe('PASS');
  });

  it('resets fixed-point progress when a delayed control appears and rejects a missing quiet window', () => {
    const plan = buildInstalledUiStateMatrixPlan(['dashboard'], { defaultScenarios: ['EMPTY'] });
    const engine = createInstalledUiInteractionCoverageEngine({ routeIds: ['dashboard'], stateMatrixPlan: plan, requiredStablePasses: 2 });
    expect(() => engine.observePass({ routeId: 'dashboard', scenario: 'EMPTY', controls: [] })).toThrow(/quiet-window/u);
    expect(() => engine.observePass({ routeId: 'dashboard', scenario: 'EMPTY', controls: [], quietWindow: quietWindow({ pageLifecycleStable: false }) })).toThrow(/quiet-window/u);
    expect(() => engine.observePass({ routeId: 'dashboard', scenario: 'EMPTY', controls: [], quietWindow: quietWindow({ finalSerials: { pageSerial: 1, barrierFingerprint: '' } }) })).toThrow(/quiet-window/u);
    engine.observePass({ routeId: 'dashboard', scenario: 'EMPTY', controls: [], quietWindow: quietWindow() });
    expect(engine.observePass({ routeId: 'dashboard', scenario: 'EMPTY', controls: [], quietWindow: quietWindow() }).stablePasses).toBe(2);
    const delayedRaw = control({ locator: '#main-content/button.delayed', label: 'Gecikmiş denetim' });
    const delayed = createSemanticControlIdentity(delayedRaw);
    const delayedPass = engine.observePass({ routeId: 'dashboard', scenario: 'EMPTY', controls: [delayedRaw], quietWindow: quietWindow() });
    expect(delayedPass).toMatchObject({ stablePasses: 0, visibleStateKeys: [delayed.stateKey], newStateKeys: [delayed.stateKey] });
    expect(delayedPass.visibleControlSetSha256).toMatch(/^[a-f0-9]{64}$/u);
    engine.classify(delayed.stateKey, { disposition: 'CLICKED_OUTCOME_VERIFIED', outcome: stateChangeOracle(delayed) });
    engine.observePass({ routeId: 'dashboard', scenario: 'EMPTY', controls: [delayedRaw], quietWindow: quietWindow() });
    expect(engine.report().fixedPointReached).toBe(false);
    engine.observePass({ routeId: 'dashboard', scenario: 'EMPTY', controls: [delayedRaw], quietWindow: quietWindow() });
    expect(engine.assertComplete()).toMatchObject({ status: 'PASS', stablePasses: 2 });
  });

  it('does not allow an ordinary control to claim an unrelated external deferral', () => {
    const plan = buildInstalledUiStateMatrixPlan(['dashboard'], { defaultScenarios: ['EMPTY'] });
    const engine = createInstalledUiInteractionCoverageEngine({ routeIds: ['dashboard'], stateMatrixPlan: plan, requiredStablePasses: 1 });
    const ordinary = createSemanticControlIdentity(control());
    engine.observePass({ routeId: 'dashboard', scenario: 'EMPTY', controls: [control()], quietWindow: quietWindow() });
    expect(() => engine.classify(ordinary.stateKey, {
      disposition: 'DEFERRED_EXTERNAL_EVIDENCE', reason: 'NATIVE_OS_BOUNDARY', externalEvidence: evidence('c'),
    })).toThrow(/semantiği/u);
  });

  it('does not let matrix arithmetic stand in for unclassified or unexercised controls', () => {
    const plan = buildInstalledUiStateMatrixPlan(['dashboard'], { defaultScenarios: ['EMPTY'] });
    const engine = createInstalledUiInteractionCoverageEngine({ routeIds: ['dashboard'], stateMatrixPlan: plan, requiredStablePasses: 1 });
    engine.observePass({ routeId: 'dashboard', scenario: 'EMPTY', controls: [control(), control({ locator: '#main-content/button:nth-of-type(2)', label: 'Kaydet' })], quietWindow: quietWindow() });
    engine.observePass({ routeId: 'dashboard', scenario: 'EMPTY', controls: [control(), control({ locator: '#main-content/button:nth-of-type(2)', label: 'Kaydet' })], quietWindow: quietWindow() });
    const first = engine.pending()[0];
    engine.classify(first.stateKey, { disposition: 'CLICKED_OUTCOME_VERIFIED', outcome: stateChangeOracle(first) });
    expect(engine.report()).toMatchObject({ status: 'FAIL', unclassifiedCount: 1, unexercisedEnabledCount: 1 });
    expect(() => engine.assertComplete()).toThrow(/sınıflandırılmadı/u);
  });

  it('classifies real main-process exception signatures and redacts paths and secrets', () => {
    const stderr = [
      'normal startup diagnostic',
      'UnhandledPromiseRejection: Error invoking remote method auth:setup',
      '    at boot (C:\\Users\\Alice\\secret\\main.js:42:7)',
      'token=super-secret-value',
      'warning: GPU fallback',
    ].join('\n');
    const result = classifyInstalledUiMainStderr(stderr);
    expect(result).toMatchObject({ status: 'FAIL', exceptionCount: 2, warningCount: 1 });
    expect(JSON.stringify(result)).not.toContain('C:\\Users\\Alice');
    expect(JSON.stringify(result)).not.toContain('super-secret-value');
    expect(() => assertNoInstalledUiMainProcessExceptions(stderr)).toThrow(/2 exception/u);
    expect(assertNoInstalledUiMainProcessExceptions('normal startup diagnostic')).toMatchObject({ status: 'PASS', exceptionCount: 0 });
  });

  it('fully drains and hashes both process streams while recording only sanitized bounded signatures', () => {
    const collector = createInstalledUiProcessOutputCollector({ sanitizeLine: (line) => String(line).replaceAll('top-secret', '[REDACTED]'), maximumRecordedSignatures: 2 });
    collector.addChunk('stdout', Buffer.from('startup top-secret\nnormal\n'));
    collector.addChunk('stderr', Buffer.from('warning: top-secret\nUnhandledPromiseRejection: failed\n'));
    expect(() => collector.report()).toThrow(/tam drain/u);
    collector.endChannel('stdout'); collector.endChannel('stderr');
    const result = collector.report();
    expect(result).toMatchObject({ status: 'FAIL', exceptionCount: 1, fullStreamHashed: true, rawOutputRecorded: false });
    expect(result.channels.stdout).toMatchObject({ fullyDrained: true, byteCount: 26, lineCount: 2 });
    expect(result.channels.stderr).toMatchObject({ fullyDrained: true, lineCount: 2, exceptionCount: 1 });
    expect(result.channels.stdout.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(result)).not.toContain('top-secret');
  });

  it('publishes explicit keyboard, tooltip, scroll and state-matrix plans', () => {
    expect(INSTALLED_UI_REQUIRED_STATE_SCENARIOS).toEqual(expect.arrayContaining(['EMPTY', 'POPULATED', 'LOADING', 'VALIDATION_ERROR', 'PERMISSION_DENIED', 'OFFLINE', 'ERROR', 'CONFIRM_CANCEL', 'CONFIRM_ACCEPT']));
    expect(INSTALLED_UI_KEYBOARD_PLAN.map((item) => item.id)).toEqual(expect.arrayContaining(['TAB_FORWARD_COMPLETE_CYCLE', 'TAB_REVERSE_COMPLETE_CYCLE', 'ENTER_ACTIVATION', 'SPACE_ACTIVATION', 'ESCAPE_DISMISSAL', 'MODAL_FOCUS_TRAP']));
    expect(INSTALLED_UI_SCROLL_PLAN.map((item) => item.position)).toEqual(['TOP', 'MIDDLE', 'BOTTOM']);
    expect(INSTALLED_UI_ACTION_METHODS).toContain('KEYBOARD_ENTER');
    expect(INSTALLED_UI_ACTION_METHODS).toContain('POINTER_PRIMARY_BUTTON');
    expect(INSTALLED_UI_USER_GESTURES).toContain('POINTER_MOUSE_PRESS_RELEASE');
    expect(INSTALLED_UI_EVIDENCE_KINDS).toEqual([
      'CDP_ACTION_SPECIFIC_OUTCOME_READBACK',
      ...INSTALLED_UI_NATIVE_EVIDENCE_KINDS,
    ]);
    expect(INSTALLED_UI_POSTCONDITION_KINDS).toContain('NAVIGATION_ROUTE_CURRENT');
    expect(INSTALLED_UI_ASSERTION_IDS).toContain('ACTION_SPECIFIC_READBACK_VERIFIED');
    expect(INSTALLED_UI_STATE_ASSERTIONS).toMatchObject({
      LOADING: ['VISIBLE_LOADING_STATE_OBSERVED'],
      PERMISSION_DENIED: ['VISIBLE_PERMISSION_DENIAL_AFTER_GESTURE'],
      OFFLINE: ['NETWORK_OFFLINE_LOCAL_SHELL_READBACK'],
      ERROR: ['FIRST_RUN_TWO_FACTOR_IPC_REJECTION_NATURAL_UI'],
    });
    expect(INSTALLED_UI_STATE_OUTCOME_KINDS).toMatchObject({
      EMPTY: ['FORM_EMPTY_READBACK'],
      POPULATED: ['FORM_POPULATED_READBACK'],
      LOADING: ['VISIBLE_LOADING_STATE'],
      VALIDATION_ERROR: ['VALIDATION_REJECTION'],
      PERMISSION_DENIED: ['VALIDATION_REJECTION'],
      OFFLINE: ['OFFLINE_LOCAL_OPERATION_READBACK'],
      ERROR: ['AUTHENTICATION_REJECTION'],
      SUCCESS: ['AUTHENTICATED_TRUSTED_DEVICE'],
      CONFIRM_CANCEL: ['CONFIRM_CANCEL', 'TERMINAL_DISPOSABLE_PROFILE'],
      CONFIRM_ACCEPT: ['CONFIRM_ACCEPT', 'TERMINAL_DISPOSABLE_PROFILE'],
    });
    expect(buildInstalledUiAccessibilityPlan()).toMatchObject({
      surfaces: ['main', 'sidebar', 'topbar', 'dialog', 'popover', 'menu', 'form'],
      tooltip: [
        { trigger: 'HOVER', assertion: 'TOOLTIP_VISIBLE_NAMED_AND_WITHIN_VIEWPORT' },
        { trigger: 'FOCUS', assertion: 'DESCRIPTION_RELATIONSHIP_AND_CONTENT_MATCH' },
      ],
    });
  });

  it('requires a complete real pointer press/release sequence for pointer outcome evidence', () => {
    const semantic = createSemanticControlIdentity(control());
    const valid = stateChangeOracle(semantic);
    expect(validateInstalledUiOutcomeOracle(semantic, valid)).toMatchObject({ userGesture: 'POINTER_MOUSE_PRESS_RELEASE' });
    const incompleteGesture = { ...valid.actionCorrelation.gesture, mouseReleased: false };
    const forged = {
      ...valid,
      actionCorrelation: {
        ...valid.actionCorrelation,
        gesture: incompleteGesture,
        gestureSha256: digest(incompleteGesture),
      },
    };
    expect(() => validateInstalledUiOutcomeOracle(semantic, forged)).toThrow(/pointer mouse press\/release/u);
  });

  it('does not accept onboarding field validation as the deterministic ERROR state', () => {
    const binding = stateBinding('onboarding', 'first-run-two-factor-rejection');
    const snapshot = {
      rejected: true,
      ipcAttempted: true,
      visibleAlertCount: 1,
      messageSha256: sha('6'),
      technicalLeakDetected: false,
      securityShellVisible: true,
      actionReenabled: true,
      twoFactorEnabled: false,
      trustedDevice: false,
      actionCorrelation: { controlIdentity: binding.controlIdentity, stateKey: binding.stateKey, gestureSha256: sha('7') },
    };
    const raw = rawStateEvidence('AUTHENTICATION_REJECTION', snapshot, binding);
    const valid = stateEntry('ERROR', 'FIRST_RUN_TWO_FACTOR_IPC_REJECTION_NATURAL_UI', raw);
    expect(validateInstalledUiApplicationStateEvidence(valid)).toMatchObject({ scenario: 'ERROR', status: 'PASS' });
    const familyValidationSnapshot = { rejected: true, invalidCount: 1, visibleAlertCount: 1, technicalLeakDetected: false };
    const familyValidationRaw = rawStateEvidence('AUTHENTICATION_REJECTION', familyValidationSnapshot, binding);
    const forged = stateEntry('ERROR', 'FIRST_RUN_TWO_FACTOR_IPC_REJECTION_NATURAL_UI', familyValidationRaw);
    expect(() => validateInstalledUiApplicationStateEvidence(forged)).toThrow(/2FA IPC reddi/u);
  });

  it('requires raw visible and action-correlated LOADING and PERMISSION_DENIED evidence', () => {
    const loadingSnapshot = {
      visible: true,
      visibleSelector: '[aria-busy="true"],[data-async-state="loading"],.loading,.loading-state',
      textSha256: sha('a'),
      actionCorrelation: { kind: 'INITIAL_DOCUMENT_LOADING_OBSERVATION', pageSerial: 4, observationSha256: '' },
    };
    loadingSnapshot.actionCorrelation.observationSha256 = digest({ visibleSelector: loadingSnapshot.visibleSelector, textSha256: loadingSnapshot.textSha256, pageSerial: 4 });
    const loadingRaw = rawStateEvidence('VISIBLE_LOADING_STATE', loadingSnapshot);
    const loading = stateEntry('LOADING', 'VISIBLE_LOADING_STATE_OBSERVED', loadingRaw);
    expect(validateInstalledUiApplicationStateEvidence(loading)).toMatchObject({ scenario: 'LOADING', status: 'PASS' });
    expect(() => validateInstalledUiApplicationStateEvidence({ ...loading, evidence: [{ ...loading.evidence[0], rawEvidence: { ...loadingRaw, snapshot: { ...loadingRaw.snapshot, visibleSelector: '.forged-loading' } } }] })).toThrow(/SHA-256|LOADING/u);

    const permissionBinding = stateBinding('security', 'permission-probe');
    const permissionRaw = rawStateEvidence('VALIDATION_REJECTION', { visible: true, visibleSelector: '[role="alert"],.async-state-panel[data-async-state="error"],.field-error', textSha256: sha('b'), actionCorrelation: { controlIdentity: permissionBinding.controlIdentity, stateKey: permissionBinding.stateKey, gestureSha256: sha('e') } }, permissionBinding);
    const permission = stateEntry('PERMISSION_DENIED', 'VISIBLE_PERMISSION_DENIAL_AFTER_GESTURE', permissionRaw);
    expect(validateInstalledUiApplicationStateEvidence(permission)).toMatchObject({ scenario: 'PERMISSION_DENIED', status: 'PASS' });
    const noGestureSnapshot = { ...permissionRaw.snapshot, actionCorrelation: {} };
    const noGesture = { ...permissionRaw, snapshot: noGestureSnapshot, snapshotSha256: digest(noGestureSnapshot) };
    expect(() => validateInstalledUiApplicationStateEvidence({ ...permission, evidence: [{ ...permission.evidence[0], sha256: digest(noGesture), rawEvidence: noGesture }] })).toThrow(/PERMISSION_DENIED/u);
  });

  it('requires exact route, control, outcome and raw snapshot bindings for every application state', () => {
    const before = sha('1');
    const cases = [
      stateEntry('EMPTY', 'FIRST_FAMILY_FORM_EMPTY', rawStateEvidence('FORM_EMPTY_READBACK', { allRequiredInputsEmpty: true })),
      stateEntry('POPULATED', 'FIRST_FAMILY_FORM_POPULATED', rawStateEvidence('FORM_POPULATED_READBACK', { allRequiredInputsPopulated: true })),
      stateEntry('VALIDATION_ERROR', 'EMPTY_FIRST_FAMILY_FORM_REJECTED', rawStateEvidence('VALIDATION_REJECTION', { rejected: true, invalidCount: 1, visibleAlertCount: 0 })),
      stateEntry('SUCCESS', 'AUTHENTICATED_TRUSTED_DEVICE_READBACK', rawStateEvidence('AUTHENTICATED_TRUSTED_DEVICE', { initialized: true, authenticated: true, twoFactorEnabled: true, trustedDevice: true })),
      stateEntry('OFFLINE', 'NETWORK_OFFLINE_LOCAL_SHELL_READBACK', rawStateEvidence('OFFLINE_LOCAL_OPERATION_READBACK', { navigatorOnLine: false, authenticatedShellVisible: true, canonicalRouteCount: 22, preloadIpcReadbackVerified: true, authIpcReadbackVerified: true, dashboardIpcReadbackVerified: true, beforeIpcSummarySha256: sha('3'), offlineIpcSummarySha256: sha('3') })),
      stateEntry('ERROR', 'FIRST_RUN_TWO_FACTOR_IPC_REJECTION_NATURAL_UI', rawStateEvidence('AUTHENTICATION_REJECTION', { rejected: true, ipcAttempted: true, visibleAlertCount: 1, messageSha256: sha('4'), technicalLeakDetected: false, securityShellVisible: true, actionReenabled: true, twoFactorEnabled: false, trustedDevice: false, actionCorrelation: { ...stateBinding(), gestureSha256: sha('5') } })),
      stateEntry('CONFIRM_CANCEL', 'JAVASCRIPT_CONFIRMATION_OBSERVED', rawStateEvidence('CONFIRM_CANCEL', { decision: 'CANCEL', beforeFingerprint: before, afterFingerprint: before })),
      stateEntry('CONFIRM_ACCEPT', 'JAVASCRIPT_CONFIRMATION_OBSERVED', rawStateEvidence('CONFIRM_ACCEPT', { decision: 'ACCEPT', beforeFingerprint: before, afterFingerprint: sha('2') })),
    ];
    for (const entry of cases) expect(validateInstalledUiApplicationStateEvidence(entry)).toMatchObject({ status: 'PASS' });
    const forged = structuredClone(cases[0]);
    forged.evidence[0].rawEvidence.snapshot.allRequiredInputsEmpty = false;
    forged.evidence[0].rawEvidence.snapshotSha256 = digest(forged.evidence[0].rawEvidence.snapshot);
    forged.evidence[0].sha256 = digest(forged.evidence[0].rawEvidence);
    expect(() => validateInstalledUiApplicationStateEvidence(forged)).toThrow(/EMPTY/u);
    const wrongOutcome = structuredClone(cases[1]);
    wrongOutcome.evidence[0].rawEvidence.outcomeKind = 'STATE_CHANGE';
    wrongOutcome.evidence[0].sha256 = digest(wrongOutcome.evidence[0].rawEvidence);
    expect(() => validateInstalledUiApplicationStateEvidence(wrongOutcome)).toThrow(/outcome/u);
  });

  it('requires genuine visible scroll-target counts and exact focus identity consistency', () => {
    const targetIdentity = sha('a');
    const valid = {
      containerId: 'scroll-0',
      position: 'MIDDLE',
      controlCount: 3,
      visibleTargetCount: 1,
      visibleTargetRequired: true,
      focusTargetFound: true,
      expectedTargetIdentity: targetIdentity,
      focusTargetIdentity: targetIdentity,
      horizontalOverflow: false,
      focusVisible: true,
      stickyOverlap: false,
      textClipping: false,
      scrollTop: 120,
    };
    expect(validateInstalledUiScrollEvidence(valid, { enabledControlIdentities: [targetIdentity] })).toMatchObject({ visibleTargetCount: 1, expectedTargetIdentity: targetIdentity });
    expect(() => validateInstalledUiScrollEvidence({ ...valid, visibleTargetCount: undefined }, { enabledControlIdentities: [targetIdentity] })).toThrow(/görünür hedef sayısı/u);
    expect(() => validateInstalledUiScrollEvidence({ ...valid, visibleTargetCount: 4 }, { enabledControlIdentities: [targetIdentity] })).toThrow(/görünür hedef sayısı/u);
    expect(() => validateInstalledUiScrollEvidence({ ...valid, focusTargetIdentity: sha('b') }, { enabledControlIdentities: [targetIdentity] })).toThrow(/exact görünür hedef/u);
    expect(validateInstalledUiScrollEvidence({
      ...valid,
      position: 'BOTTOM',
      controlCount: 0,
      visibleTargetCount: 0,
      visibleTargetRequired: false,
      focusTargetFound: false,
      expectedTargetIdentity: null,
      focusTargetIdentity: null,
    })).toMatchObject({ visibleTargetCount: 0, visibleTargetRequired: false });
  });

  it('rejects mismatched gestures and non-canonical outcome vocabulary', () => {
    const semantic = createSemanticControlIdentity(control());
    const valid = stateChangeOracle(semantic);
    expect(() => validateInstalledUiOutcomeOracle(semantic, { ...valid, actionCorrelation: { ...valid.actionCorrelation, gestureSha256: sha('f') } })).toThrow(/nedensel/u);
    expect(() => validateInstalledUiOutcomeOracle(semantic, { ...valid, postcondition: { status: 'PASS', actionSpecific: true, kind: 'CORE_HEALTH_OK' } })).toThrow(/eyleme özgü/u);
    expect(() => validateInstalledUiOutcomeOracle(semantic, { ...valid, evidence: [{ kind: 'SCREENSHOT_READBACK', sha256: sha('a') }] })).toThrow(/kanonik evidence/u);
  });

  it('fails closed for secret-bearing screenshot surface fixtures without returning raw secret text', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const unsafe = scanInstalledUiSecretBearingText(`Anahtar: ${secret}`, { sensitiveValues: [secret] });
    expect(unsafe).toMatchObject({ status: 'FAIL', findingCount: expect.any(Number) });
    expect(JSON.stringify(unsafe)).not.toContain(secret);
    expect(scanInstalledUiSecretBearingText('Anahtar: [UAT GİZLENDİ]', { sensitiveValues: [secret] })).toMatchObject({ status: 'PASS', findingCount: 0 });
    expect(scanInstalledUiSecretBearingText('ABCD-EFGH-IJKL')).toMatchObject({ status: 'FAIL' });
  });
});
