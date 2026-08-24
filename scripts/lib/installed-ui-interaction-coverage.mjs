import { createHash } from 'node:crypto';

export const INSTALLED_UI_SEMANTIC_SURFACES = Object.freeze([
  Object.freeze({ id: 'main', selector: '#main-content', priority: 10 }),
  Object.freeze({ id: 'sidebar', selector: '.sidebar', priority: 20 }),
  Object.freeze({ id: 'topbar', selector: '.topbar', priority: 30 }),
  Object.freeze({ id: 'dialog', selector: '.modal,[role="dialog"]', priority: 40 }),
  Object.freeze({ id: 'popover', selector: '.sidebar-popover,[popover],[data-popover]', priority: 50 }),
  Object.freeze({ id: 'menu', selector: '[role="menu"],[role="listbox"]', priority: 60 }),
  Object.freeze({ id: 'form', selector: 'form', priority: 70 }),
]);

export const INSTALLED_UI_ACTIONABLE_SELECTOR = [
  'button',
  'a[href]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="tab"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const INSTALLED_UI_REQUIRED_STATE_SCENARIOS = Object.freeze([
  'EMPTY',
  'POPULATED',
  'LOADING',
  'VALIDATION_ERROR',
  'PERMISSION_DENIED',
  'OFFLINE',
  'ERROR',
  'SUCCESS',
  'CONFIRM_CANCEL',
  'CONFIRM_ACCEPT',
]);

export const INSTALLED_UI_OUTCOME_KINDS = Object.freeze([
  'STATE_CHANGE',
  'IDEMPOTENT_READ_ONLY',
  'VALIDATION_REJECTION',
  'AUTHENTICATION_REJECTION',
  'CONFIRM_CANCEL',
  'CONFIRM_ACCEPT',
  'NATIVE_DIALOG_CANCEL',
  'NATIVE_DIALOG_ACCEPT',
  'TERMINAL_DISPOSABLE_PROFILE',
]);

export const INSTALLED_UI_USER_GESTURES = Object.freeze(['KEYBOARD_USER_GESTURE', 'POINTER_MOUSE_PRESS_RELEASE']);
export const INSTALLED_UI_ACTION_METHODS = Object.freeze([
  'POINTER_PRIMARY_BUTTON',
  'KEYBOARD_TEXT_ENTRY', 'KEYBOARD_SELECTION', 'KEYBOARD_SPACE', 'KEYBOARD_ENTER', 'KEYBOARD_FOCUS_ONLY',
]);
export const INSTALLED_UI_NATIVE_EVIDENCE_KINDS = Object.freeze([
  'WINDOWS_UIAUTOMATION_NATIVE_DIALOG_CANCEL_ACCEPT_READBACK',
  'WINDOWS_UIAUTOMATION_NATIVE_RESTORE_TERMINAL_READBACK',
]);
export const INSTALLED_UI_EVIDENCE_KINDS = Object.freeze([
  'CDP_ACTION_SPECIFIC_OUTCOME_READBACK',
  ...INSTALLED_UI_NATIVE_EVIDENCE_KINDS,
]);
export const INSTALLED_UI_NATIVE_POSTCONDITION_KINDS = Object.freeze([
  'NATIVE_DIALOG_CANCELLED_WITHOUT_SELECTION_MUTATION',
  'NATIVE_SAVE_ARTIFACT_READBACK_VERIFIED',
  'NATIVE_OPEN_SELECTION_AND_APPLICATION_READBACK_VERIFIED',
  'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK',
]);
export const INSTALLED_UI_POSTCONDITION_KINDS = Object.freeze([
  'TERMINAL_CANCEL_STATE_UNCHANGED', 'TERMINAL_ACCEPT_STATE_CHANGED',
  'DIALOG_ACCEPT_READBACK', 'DIALOG_CANCEL_READBACK', 'TARGET_VALIDATION_MESSAGE_CHANGED',
  'TARGET_STATE_CHANGED', 'ARIA_CONTROLLED_REGION_CHANGED', 'TARGET_SEMANTIC_SCOPE_CHANGED',
  'VISIBLE_STATUS_CHANGED', 'NAVIGATION_ROUTE_CHANGED', 'NAVIGATION_ROUTE_CURRENT',
  ...INSTALLED_UI_NATIVE_POSTCONDITION_KINDS,
]);
export const INSTALLED_UI_NATIVE_ASSERTION_IDS = Object.freeze([
  'OWNED_NATIVE_DIALOG_CANCEL_VERIFIED',
  'OWNED_NATIVE_DIALOG_ACCEPT_AND_POSTCONDITION_VERIFIED',
  'NATIVE_RESTORE_CANCEL_AND_ACCEPT_VERIFIED',
  'OWNED_RELAUNCH_AND_SESSION_REVOCATION_VERIFIED',
]);
export const INSTALLED_UI_ASSERTION_IDS = Object.freeze([
  'TERMINAL_CANCEL_STATE_UNCHANGED', 'TERMINAL_ACCEPT_STATE_CHANGED',
  'CONFIRMATION_ACCEPTED', 'CONFIRMATION_CANCELLED', 'NATURAL_VALIDATION_MESSAGE_VISIBLE',
  'VISIBLE_STATE_FINGERPRINT_CHANGED', 'ACTION_SPECIFIC_READBACK_VERIFIED',
  ...INSTALLED_UI_NATIVE_ASSERTION_IDS,
]);
export const INSTALLED_UI_STATE_ASSERTIONS = Object.freeze({
  EMPTY: Object.freeze(['FIRST_FAMILY_FORM_EMPTY']),
  POPULATED: Object.freeze(['FIRST_FAMILY_FORM_POPULATED']),
  LOADING: Object.freeze(['VISIBLE_LOADING_STATE_OBSERVED']),
  VALIDATION_ERROR: Object.freeze(['EMPTY_FIRST_FAMILY_FORM_REJECTED', 'NATURAL_VALIDATION_MESSAGE_VISIBLE']),
  PERMISSION_DENIED: Object.freeze(['VISIBLE_PERMISSION_DENIAL_AFTER_GESTURE']),
  OFFLINE: Object.freeze(['NETWORK_OFFLINE_LOCAL_SHELL_READBACK']),
  ERROR: Object.freeze(['FIRST_RUN_TWO_FACTOR_IPC_REJECTION_NATURAL_UI']),
  SUCCESS: Object.freeze(['AUTHENTICATED_TRUSTED_DEVICE_READBACK']),
  CONFIRM_CANCEL: Object.freeze(['JAVASCRIPT_CONFIRMATION_AND_TERMINAL_POSTCONDITION', 'JAVASCRIPT_CONFIRMATION_OBSERVED']),
  CONFIRM_ACCEPT: Object.freeze(['JAVASCRIPT_CONFIRMATION_AND_TERMINAL_POSTCONDITION', 'JAVASCRIPT_CONFIRMATION_OBSERVED']),
});
export const INSTALLED_UI_STATE_OUTCOME_KINDS = Object.freeze({
  EMPTY: Object.freeze(['FORM_EMPTY_READBACK']),
  POPULATED: Object.freeze(['FORM_POPULATED_READBACK']),
  LOADING: Object.freeze(['VISIBLE_LOADING_STATE']),
  VALIDATION_ERROR: Object.freeze(['VALIDATION_REJECTION']),
  PERMISSION_DENIED: Object.freeze(['VALIDATION_REJECTION']),
  OFFLINE: Object.freeze(['OFFLINE_LOCAL_OPERATION_READBACK']),
  ERROR: Object.freeze(['AUTHENTICATION_REJECTION']),
  SUCCESS: Object.freeze(['AUTHENTICATED_TRUSTED_DEVICE']),
  CONFIRM_CANCEL: Object.freeze(['CONFIRM_CANCEL', 'TERMINAL_DISPOSABLE_PROFILE']),
  CONFIRM_ACCEPT: Object.freeze(['CONFIRM_ACCEPT', 'TERMINAL_DISPOSABLE_PROFILE']),
});

export const INSTALLED_UI_DISPOSITIONS = Object.freeze([
  'CLICKED_OUTCOME_VERIFIED',
  'BLOCKED_DISABLED',
  'DEFERRED_EXTERNAL_EVIDENCE',
]);

export const INSTALLED_UI_KEYBOARD_PLAN = Object.freeze([
  Object.freeze({ id: 'TAB_FORWARD_COMPLETE_CYCLE', key: 'Tab', shiftKey: false, assertion: 'EVERY_ENABLED_CONTROL_REACHED_ONCE' }),
  Object.freeze({ id: 'TAB_REVERSE_COMPLETE_CYCLE', key: 'Tab', shiftKey: true, assertion: 'REVERSE_ORDER_AND_NO_ESCAPE' }),
  Object.freeze({ id: 'ENTER_ACTIVATION', key: 'Enter', shiftKey: false, assertion: 'OUTCOME_ORACLE_REQUIRED' }),
  Object.freeze({ id: 'SPACE_ACTIVATION', key: ' ', shiftKey: false, assertion: 'OUTCOME_ORACLE_REQUIRED' }),
  Object.freeze({ id: 'ESCAPE_DISMISSAL', key: 'Escape', shiftKey: false, assertion: 'DIALOG_OR_POPOVER_CLOSES_AND_FOCUS_RETURNS' }),
  Object.freeze({ id: 'MODAL_FOCUS_TRAP', key: 'Tab', shiftKey: false, assertion: 'FOCUS_REMAINS_IN_MODAL_UNTIL_DISMISSAL' }),
]);

export const INSTALLED_UI_SCROLL_PLAN = Object.freeze([
  Object.freeze({ position: 'TOP', ratio: 0, assertions: ['NO_HORIZONTAL_OVERFLOW', 'NO_FIXED_OVERLAP', 'FOCUS_VISIBLE'] }),
  Object.freeze({ position: 'MIDDLE', ratio: 0.5, assertions: ['NO_HORIZONTAL_OVERFLOW', 'NO_STICKY_OVERLAP', 'TEXT_NOT_CLIPPED'] }),
  Object.freeze({ position: 'BOTTOM', ratio: 1, assertions: ['LAST_CONTROL_REACHABLE', 'NO_BOTTOM_CLIPPING', 'FOCUS_VISIBLE'] }),
]);

const sha256Pattern = /^[a-f0-9]{64}$/u;
const routePattern = /^[a-z0-9][a-z0-9-]*$/u;
const scenarioPattern = /^[A-Z][A-Z0-9_]*$/u;
const terminalActionPattern = /(?:fabrika|factory reset|oturumu kilitle|lock session|oturumu kapat|sign out|çıkış|logout|hesabı sil|delete account|nihai imha|permanent(?:ly)? delete|kalıcı sil|remove profile|profili kaldır)/iu;
const destructiveActionPattern = /(?:^|\s)(?:sil|delete|kaldır|remove|geri yükle|restore|sıfırla|reset|imha|destroy)(?:\s|$)/iu;
const nativeDialogPattern = /(?:dosya|file).*(?:seç|select)|(?:seç|select).*(?:dosya|file)|içe aktar|\bimport\b|dışa aktar|\bexport\b|yedeği incele|inspect backup|json seç|pdf raporu oluştur|create pdf report/iu;
const stderrExceptionPatterns = Object.freeze([
  /uncaught\s+(?:exception|error)/iu,
  /unhandled(?:promiserejection|\s+promise\s+rejection)/iu,
  /\b(?:TypeError|ReferenceError|SyntaxError|RangeError|AggregateError)\s*:/u,
  /\bFATAL\b|\bfatal error\b/iu,
  /\[(?:\d+:\d+:\d+\/)?ERROR(?::[^\]]+)?\]/u,
  /Error invoking(?: remote method)?/iu,
  /\[object\s+Object\]/iu,
  /\b(?:CORE-UNEXPECTED-\d+|UNKNOWN_IPC_CHANNEL|PlatformPolicyEnforcementError)\b/u,
  /\bat\s+(?:async\s+)?[\w$.<>]+\s*\([^\n)]*:\d+:\d+\)/u,
]);
const stderrWarningPattern = /\bwarn(?:ing)?\b/iu;
const secretTextPatterns = Object.freeze([
  Object.freeze({ kind: 'OTP_AUTH_URI', pattern: /otpauth:\/\//iu }),
  Object.freeze({ kind: 'LABELED_SECRET_VALUE', pattern: /(?:anahtar|key|secret|token|password|parola|kurtarma kodu|recovery code|otp|doğrulama kodu)\s*[:=]\s*(?!\[(?:UAT\s+)?(?:GİZLENDİ|REDACTED)\])[^\s]{6,}/iu }),
  Object.freeze({ kind: 'BARE_BASE32_SECRET', pattern: /(?:^|[^A-Z2-7])([A-Z2-7]{16,}={0,6})(?:$|[^A-Z2-7=])/u }),
  Object.freeze({ kind: 'RECOVERY_CODE_SEQUENCE', pattern: /(?:^|\s)[A-Z0-9]{4}(?:-[A-Z0-9]{4}){2,}(?:$|\s)/iu }),
]);
const loadingEvidenceSelector = '[aria-busy="true"],[data-async-state="loading"],.loading,.loading-state';
const permissionEvidenceSelector = '[role="alert"],.async-state-panel[data-async-state="error"],.field-error';

const fail = (message) => { throw new Error(message); };
const check = (condition, message) => { if (!condition) fail(message); };
const normalizeText = (value) => String(value ?? '').normalize('NFKC').trim().replace(/\s+/gu, ' ');
const hash = (value) => createHash('sha256').update(String(value)).digest('hex');
const frozen = (value) => Object.freeze(value);

export const scanInstalledUiSecretBearingText = (value, { sensitiveValues = [] } = {}) => {
  const text = String(value ?? '').normalize('NFKC');
  const findings = [];
  for (const sensitive of sensitiveValues) {
    const normalized = String(sensitive ?? '').normalize('NFKC');
    if (normalized.length >= 4 && text.includes(normalized)) findings.push(frozen({ kind: 'KNOWN_RUNTIME_SECRET', sha256: hash(normalized) }));
  }
  for (const descriptor of secretTextPatterns) if (descriptor.pattern.test(text)) findings.push(frozen({ kind: descriptor.kind, sha256: hash(text) }));
  return frozen({ status: findings.length === 0 ? 'PASS' : 'FAIL', findingCount: findings.length, findings: frozen(findings) });
};

const validateRoute = (routeId) => {
  const value = normalizeText(routeId);
  check(routePattern.test(value), `Geçersiz rota kimliği: ${value || '<boş>'}`);
  return value;
};

const validateScenario = (scenario) => {
  const value = normalizeText(scenario);
  check(scenarioPattern.test(value), `Geçersiz durum senaryosu: ${value || '<boş>'}`);
  return value;
};

const normalizeSurfaceId = (surfaceId) => {
  const value = normalizeText(surfaceId).toLowerCase();
  check(INSTALLED_UI_SEMANTIC_SURFACES.some((surface) => surface.id === value), `Kapsam dışı semantik yüzey: ${value || '<boş>'}`);
  return value;
};

const normalizeBooleanState = (value) => value === true ? 'true' : value === false ? 'false' : 'unset';

export const createSemanticControlIdentity = (input) => {
  const routeId = validateRoute(input.routeId);
  const scenario = validateScenario(input.scenario);
  const surfaceId = normalizeSurfaceId(input.surfaceId);
  const role = normalizeText(input.role || input.tagName).toLowerCase();
  const locator = normalizeText(input.locator);
  const navigationRouteId = normalizeText(input.navigationRouteId);
  const dataRoute = normalizeText(input.dataRoute);
  const href = normalizeText(input.href);
  check(role, 'Semantik kontrol rolü zorunludur.');
  check(locator && locator.length <= 512, 'Kontrol için kararlı ve sınırlı locator zorunludur.');
  check(!navigationRouteId || routePattern.test(navigationRouteId), 'Navigasyon kontrolü geçersiz rota kimliği taşıyor.');
  check(dataRoute.length <= 180 && href.length <= 512, 'Kontrol route/href bağı sınırı aşıyor.');
  const identityMaterial = JSON.stringify({ routeId, surfaceId, role, locator, navigationRouteId, dataRoute, href });
  const identity = hash(identityMaterial);
  const enabled = input.enabled === true;
  const state = frozen({
    enabled,
    expanded: normalizeBooleanState(input.expanded),
    checked: normalizeBooleanState(input.checked),
    pressed: normalizeBooleanState(input.pressed),
    selected: normalizeBooleanState(input.selected),
    valueState: normalizeText(input.valueState || 'UNSPECIFIED').toUpperCase(),
  });
  const stateKey = hash(JSON.stringify({ identity, scenario, state }));
  return frozen({
    identity,
    stateKey,
    routeId,
    scenario,
    surfaceId,
    role,
    locator,
    navigationRouteId,
    dataRoute,
    href,
    label: normalizeText(input.label).slice(0, 180),
    visible: input.visible === true,
    enabled,
    state,
    actionHint: normalizeText(input.actionHint).toUpperCase() || 'STANDARD',
    inputType: normalizeText(input.inputType).toLowerCase(),
    contentEditable: input.contentEditable === true,
  });
};

export const expectedInstalledUiKeyboardActivation = (control) => {
  if (control.role === 'input' && ['checkbox', 'radio'].includes(control.inputType)) return 'SPACE';
  if (control.role === 'input' && ['button', 'submit', 'reset'].includes(control.inputType)) return 'ENTER';
  if (control.role === 'input' && control.inputType === 'range') return 'SELECTION_KEYS';
  if (control.contentEditable || control.role === 'input' || ['textarea', 'textbox'].includes(control.role)) return 'TEXT_ENTRY';
  if (control.role === 'select' || control.role === 'listbox') return 'SELECTION_KEYS';
  if (['checkbox', 'radio', 'switch'].includes(control.role)) return 'SPACE';
  if (['button', 'a', 'link', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'summary'].includes(control.role)) return 'ENTER';
  return 'FOCUS_ONLY';
};

export const classifyInstalledUiActionSafety = (control) => {
  const label = normalizeText(control.label);
  const hint = normalizeText(control.actionHint).toUpperCase();
  if (hint === 'TERMINAL' || hint === 'DESTRUCTIVE' || terminalActionPattern.test(label) || destructiveActionPattern.test(label)) {
    return frozen({ classification: 'DISPOSABLE_PROFILE_SAFE_OUTCOME_REQUIRED', allowedOutcomeKinds: ['TERMINAL_DISPOSABLE_PROFILE'] });
  }
  if (hint === 'NATIVE_DIALOG' || nativeDialogPattern.test(label)) {
    return frozen({ classification: 'NATIVE_TARGET_WINDOW_EVIDENCE_REQUIRED', allowedOutcomeKinds: ['NATIVE_DIALOG_CANCEL', 'NATIVE_DIALOG_ACCEPT'] });
  }
  if (hint === 'HARDWARE' || hint === 'EXTERNAL_PROVIDER') {
    return frozen({ classification: 'HARDWARE_OR_EXTERNAL_PROVIDER_EVIDENCE_REQUIRED', allowedOutcomeKinds: ['STATE_CHANGE', 'IDEMPOTENT_READ_ONLY'] });
  }
  return frozen({ classification: 'STANDARD_SYNTHETIC_OUTCOME_REQUIRED', allowedOutcomeKinds: ['STATE_CHANGE', 'IDEMPOTENT_READ_ONLY', 'VALIDATION_REJECTION', 'AUTHENTICATION_REJECTION', 'CONFIRM_CANCEL', 'CONFIRM_ACCEPT'] });
};

const validateEvidenceBindings = (bindings, label) => {
  check(Array.isArray(bindings) && bindings.length > 0, `${label} için en az bir kanıt bağı zorunludur.`);
  for (const binding of bindings) {
    check(binding && sha256Pattern.test(String(binding.sha256 ?? '')), `${label} kanıt SHA-256 bağı geçersizdir.`);
    check(normalizeText(binding.kind), `${label} kanıt türü zorunludur.`);
  }
};

const validateExactStringSet = (actual, expected, label) => {
  check(Array.isArray(actual)
    && actual.length === expected.length
    && new Set(actual).size === actual.length
    && JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()),
  `${label} exact allowlist ile eşleşmiyor.`);
};

const validateOwnedNativeDecision = (control, decision, expectedDecision, expectedPostconditionKind) => {
  check(decision?.status === 'PASS' && decision.decision === expectedDecision
    && decision.targetObserved === true && decision.targetClosed === true,
  `Native ${expectedDecision} hedef pencere sonucu PASS değildir.`);
  const targetWindow = decision.targetWindow;
  const { identitySha256, ...targetWindowIdentity } = targetWindow ?? {};
  const directOwned = Number.isInteger(targetWindow?.processId) && targetWindow.processId > 0
    && normalizeText(targetWindow.creationTimeUtc) && !Number.isNaN(Date.parse(targetWindow.creationTimeUtc));
  const ownerOwned = Number.isInteger(targetWindow?.ownerProcessId) && targetWindow.ownerProcessId > 0
    && normalizeText(targetWindow.ownerCreationTimeUtc) && !Number.isNaN(Date.parse(targetWindow.ownerCreationTimeUtc));
  check(targetWindow?.className === '#32770' && (directOwned || ownerOwned)
    && targetWindow.ownershipMode === (directOwned ? 'DIRECT_TARGET_PROCESS' : 'OWNER_PROCESS')
    && targetWindow.uiAutomationInvokePattern === true && targetWindow.printWindowTargetOnly === true
    && sha256Pattern.test(String(targetWindow.titleSha256 ?? ''))
    && sha256Pattern.test(String(targetWindow.automationIdSha256 ?? ''))
    && sha256Pattern.test(String(identitySha256 ?? ''))
    && identitySha256 === hash(JSON.stringify(targetWindowIdentity)),
  `Native ${expectedDecision} hedef pencere exact sahiplik/kimlik bağı geçersizdir.`);
  const gesture = decision.actionCorrelation?.gesture;
  check(decision.actionCorrelation?.controlIdentity === control.identity
    && decision.actionCorrelation?.stateKey === control.stateKey
    && gesture?.routeId === control.routeId
    && normalizeText(gesture?.runtimeId)
    && INSTALLED_UI_ACTION_METHODS.includes(gesture?.activationMethod)
    && gesture?.hitTestPassed === true && gesture?.focusVisible === true
    && Number.isFinite(gesture?.x) && Number.isFinite(gesture?.y)
    && sha256Pattern.test(String(decision.actionCorrelation?.gestureSha256 ?? ''))
    && decision.actionCorrelation.gestureSha256 === hash(JSON.stringify(gesture)),
  `Native ${expectedDecision} gerçek kullanıcı jestiyle bağlı değildir.`);
  if (gesture.activationMethod === 'POINTER_PRIMARY_BUTTON') {
    check(gesture.pointerSequence === 'MOUSE_MOVED_MOUSE_PRESSED_MOUSE_RELEASED'
      && gesture.mouseMoved === true && gesture.mousePressed === true && gesture.mouseReleased === true
      && gesture.button === 'left' && gesture.clickCount === 1
      && gesture.pointerTargetRuntimeId === gesture.runtimeId,
    `Native ${expectedDecision} gerçek pointer press/release kanıtı taşımıyor.`);
  }
  const screenshot = decision.screenshot;
  check(normalizeText(screenshot?.path) && !/^(?:[a-z]:[\\/]|[\\/]{2})/iu.test(screenshot.path)
    && Number.isSafeInteger(screenshot?.sizeBytes) && screenshot.sizeBytes >= 24
    && Number.isSafeInteger(screenshot?.width) && screenshot.width > 0
    && Number.isSafeInteger(screenshot?.height) && screenshot.height > 0
    && sha256Pattern.test(String(screenshot?.sha256 ?? ''))
    && screenshot.readbackVerified === true && screenshot.targetOnly === true,
  `Native ${expectedDecision} target-only screenshot/readback kanıtı geçersizdir.`);
  check(decision.selection?.synthetic === true && decision.selection?.pathRecorded === false
    && decision.selection?.withinDisposableProfile === true
    && normalizeText(decision.selection?.fileName) && normalizeText(decision.selection?.extension),
  `Native ${expectedDecision} disposable seçim/path redaksiyon bağı geçersizdir.`);
  if (expectedDecision === 'ACCEPT') {
    check(decision.selection.existsAfterDecision === true
      && Number.isSafeInteger(decision.selection.sizeBytes) && decision.selection.sizeBytes > 0
      && sha256Pattern.test(String(decision.selection.sha256 ?? '')),
    'Native ACCEPT seçilen/üretilen dosyanın hash geri-okumasını taşımıyor.');
  }
  check(decision.postcondition?.status === 'PASS'
    && decision.postcondition.kind === expectedPostconditionKind
    && decision.postcondition.applicationReadbackVerified === true,
  `Native ${expectedDecision} eyleme özgü son-koşul türü/readback geçersizdir.`);
};

const validateNativeRuntimeOracle = (control, oracle) => {
  const nativeDialog = oracle.nativeDialog;
  check(nativeDialog?.status === 'PASS'
    && nativeDialog.routeId === control.routeId
    && nativeDialog.controlIdentity === control.identity
    && nativeDialog.stateKey === control.stateKey
    && ['OPEN', 'SAVE'].includes(nativeDialog.dialogKind),
  'Native outcome ham dialog kaydı aynı kontrol/rota/durum ile bağlı değildir.');
  validateOwnedNativeDecision(control, nativeDialog.cancel, 'CANCEL', 'NATIVE_DIALOG_CANCELLED_WITHOUT_SELECTION_MUTATION');
  const restore = oracle.postcondition?.kind === 'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK';
  const acceptPostconditionKind = restore
    ? 'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK'
    : nativeDialog.dialogKind === 'SAVE'
      ? 'NATIVE_SAVE_ARTIFACT_READBACK_VERIFIED'
      : 'NATIVE_OPEN_SELECTION_AND_APPLICATION_READBACK_VERIFIED';
  validateOwnedNativeDecision(control, nativeDialog.accept, 'ACCEPT', acceptPostconditionKind);
  check(oracle.postcondition?.kind === nativeDialog.accept.postcondition.kind,
    'Native outcome üst/ham son-koşul türü exact eşleşmiyor.');
  const expectedEvidenceKinds = restore
    ? ['WINDOWS_UIAUTOMATION_NATIVE_RESTORE_TERMINAL_READBACK']
    : ['WINDOWS_UIAUTOMATION_NATIVE_DIALOG_CANCEL_ACCEPT_READBACK'];
  validateExactStringSet(oracle.evidence.map((entry) => entry.kind), expectedEvidenceKinds, 'Native evidence türleri');
  check(oracle.evidence[0].sha256 === hash(JSON.stringify(nativeDialog)), 'Native evidence SHA ham dialog kaydıyla bağlı değildir.');
  const expectedAssertionIds = restore
    ? ['NATIVE_RESTORE_CANCEL_AND_ACCEPT_VERIFIED', 'OWNED_RELAUNCH_AND_SESSION_REVOCATION_VERIFIED']
    : ['OWNED_NATIVE_DIALOG_CANCEL_VERIFIED', 'OWNED_NATIVE_DIALOG_ACCEPT_AND_POSTCONDITION_VERIFIED'];
  validateExactStringSet(oracle.assertions.map((entry) => entry.id), expectedAssertionIds, 'Native assertion türleri');
  if (restore) {
    const process = nativeDialog.accept.postcondition?.process;
    check(process?.previousRootAbsent === true && process?.exactExecutablePathVerified === true
      && process?.remoteDebuggingPortInherited === true && process?.restoredAccountInitialized === true
      && process?.authenticatedSessionRevoked === true
      && Number.isInteger(process?.previousProcessId) && process.previousProcessId > 0
      && Number.isInteger(process?.replacementProcessId) && process.replacementProcessId > 0
      && normalizeText(process?.previousCreationTimeUtc) && normalizeText(process?.replacementCreationTimeUtc)
      && sha256Pattern.test(String(process?.replacementExecutableSha256 ?? '')),
    'Native restore exact owned relaunch/oturum iptali geri-okuması geçersizdir.');
    check(oracle.terminalPostcondition?.kind === 'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK'
      && hash(JSON.stringify(oracle.terminalPostcondition.process)) === hash(JSON.stringify(process)),
    'Native restore terminal son-koşulu ham owned relaunch geri-okumasıyla bağlı değildir.');
  }
};

export const validateInstalledUiOutcomeOracle = (control, oracle) => {
  check(control?.enabled === true, 'Yalnız etkin kontrol için CLICKED outcome doğrulanabilir.');
  check(oracle && oracle.status === 'PASS', 'CLICKED için PASS outcome oracle zorunludur.');
  check(INSTALLED_UI_OUTCOME_KINDS.includes(oracle.kind), `Desteklenmeyen outcome oracle türü: ${oracle?.kind ?? '<eksik>'}`);
  check(oracle.settled === true, 'Outcome oracle async-settle kanıtı taşımıyor.');
  check(INSTALLED_UI_USER_GESTURES.includes(oracle.userGesture), 'Outcome oracle kanonik gerçek kullanıcı jesti sınıfı taşımıyor.');
  check(sha256Pattern.test(String(oracle.beforeFingerprint ?? '')) && sha256Pattern.test(String(oracle.afterFingerprint ?? '')), 'Outcome oracle önce/sonra parmak izi geçersizdir.');
  const gesture = oracle.actionCorrelation?.gesture;
  const expectedActivation = expectedInstalledUiKeyboardActivation(control);
  check(oracle.actionCorrelation?.controlIdentity === control.identity
    && oracle.actionCorrelation?.stateKey === control.stateKey
    && sha256Pattern.test(String(oracle.actionCorrelation?.gestureSha256 ?? ''))
    && gesture?.routeId === control.routeId
    && normalizeText(gesture?.runtimeId)
    && INSTALLED_UI_ACTION_METHODS.includes(gesture?.activationMethod)
    && gesture?.expectedKeyboardActivation === expectedActivation
    && gesture?.hitTestPassed === true && gesture?.focusVisible === true
    && Number.isFinite(gesture?.x) && Number.isFinite(gesture?.y)
    && hash(JSON.stringify(gesture)) === oracle.actionCorrelation.gestureSha256,
  'Outcome oracle kontrol durumu ve gerçek jestle nedensel olarak bağlı değildir.');
  if (oracle.userGesture === 'POINTER_MOUSE_PRESS_RELEASE') {
    check(gesture?.activationMethod === 'POINTER_PRIMARY_BUTTON'
      && gesture?.pointerSequence === 'MOUSE_MOVED_MOUSE_PRESSED_MOUSE_RELEASED'
      && gesture?.mouseMoved === true && gesture?.mousePressed === true && gesture?.mouseReleased === true
      && gesture?.button === 'left' && gesture?.clickCount === 1
      && gesture?.pointerTargetRuntimeId === gesture?.runtimeId,
    'Outcome oracle gerçek pointer mouse press/release dizisi taşımıyor.');
  }
  check(oracle.postcondition?.status === 'PASS'
    && oracle.postcondition?.actionSpecific === true
    && INSTALLED_UI_POSTCONDITION_KINDS.includes(oracle.postcondition?.kind),
  'Outcome oracle eyleme özgü son-koşul geri-okuması taşımıyor.');
  check(oracle.quietWindow?.status === 'PASS'
    && oracle.quietWindow?.domStable === true
    && oracle.quietWindow?.networkStable === true
    && oracle.quietWindow?.ipcStable === true
    && oracle.quietWindow?.pageLifecycleStable === true
    && oracle.quietWindow?.networkInFlight === 0
    && oracle.quietWindow?.ipcInFlight === 0
    && Number.isSafeInteger(oracle.quietWindow?.finalSerials?.pageSerial)
    && oracle.quietWindow.finalSerials.pageSerial >= 0
    && normalizeText(oracle.quietWindow?.finalSerials?.barrierFingerprint)
    && Number(oracle.quietWindow?.quietForMs) >= 600,
  'Outcome oracle en az 600 ms DOM/network/IPC quiet-window taşımıyor.');
  check(oracle.keyboardActivation?.status === 'PASS'
    && oracle.keyboardActivation?.expected === expectedActivation
    && oracle.keyboardActivation?.actual === expectedActivation
    && oracle.keyboardActivation?.focusVisible === true,
  `Kontrol için gerçek ve uygun klavye aktivasyonu doğrulanmadı: ${expectedActivation}`);
  if (control.surfaceId === 'dialog') check(oracle.keyboardActivation?.modalFocusTrap === 'FORWARD_AND_REVERSE_CONTAINMENT_PASS', 'Modal kontrol gerçek ileri/geri odak kapanı kanıtı taşımıyor.');
  validateEvidenceBindings(oracle.evidence, 'Outcome oracle');
  check(oracle.evidence.every((binding) => INSTALLED_UI_EVIDENCE_KINDS.includes(binding.kind)), 'Outcome oracle kanonik evidence türü taşımıyor.');
  check(Array.isArray(oracle.assertions) && oracle.assertions.length > 0 && oracle.assertions.every((assertion) => assertion?.status === 'PASS' && INSTALLED_UI_ASSERTION_IDS.includes(assertion.id)), 'Outcome oracle PASS assertion kümesi eksiktir veya kanonik değildir.');

  const safety = classifyInstalledUiActionSafety(control);
  check(safety.allowedOutcomeKinds.includes(oracle.kind), `${safety.classification} için ${oracle.kind} outcome türü kabul edilmez.`);
  if (oracle.kind === 'STATE_CHANGE' || oracle.kind === 'CONFIRM_ACCEPT') {
    check(oracle.beforeFingerprint !== oracle.afterFingerprint, `${oracle.kind} sonucu görünür veya kalıcı durum değişimi taşımıyor.`);
    check(oracle.semanticStateChanged === true, `${oracle.kind} yalnız odak/işaretçi değişimine dayanamaz.`);
  }
  if (oracle.kind === 'IDEMPOTENT_READ_ONLY') {
    check(oracle.beforeFingerprint === oracle.afterFingerprint
      && oracle.actionSpecificReadback === true
      && oracle.assertions.some((assertion) => assertion.id === 'ACTION_SPECIFIC_READBACK_VERIFIED')
      && control.actionHint === 'NAVIGATION_ROUTE'
      && routePattern.test(control.navigationRouteId)
      && control.dataRoute === control.navigationRouteId
      && oracle.postcondition?.kind === 'NAVIGATION_ROUTE_CURRENT'
      && oracle.routeReadback?.status === 'PASS'
      && oracle.routeReadback?.expectedRouteId === control.navigationRouteId
      && oracle.routeReadback?.observedRouteId === control.navigationRouteId
      && oracle.routeReadback?.controlDataRoute === control.dataRoute
      && oracle.routeReadback?.controlHref === control.href
      && oracle.routeReadback?.controlRole === control.role,
    'Salt-okunur tıklama eyleme özgü geri-okuma kanıtı taşımıyor.');
  }
  if (oracle.kind === 'VALIDATION_REJECTION') {
    check(oracle.assertions.some((assertion) => assertion.id === 'NATURAL_VALIDATION_MESSAGE_VISIBLE'), 'Doğrulama reddi doğal görünür mesaj kanıtı taşımıyor.');
  }
  if (oracle.kind.startsWith('NATIVE_DIALOG_')) {
    validateNativeRuntimeOracle(control, oracle);
  }
  if (oracle.kind === 'TERMINAL_DISPOSABLE_PROFILE') {
    check(oracle.profileClassification === 'SYNTHETIC_DISPOSABLE_PROFILE', 'Terminal outcome disposable sentetik profile bağlı değildir.');
    check(['CANCEL', 'ACCEPT'].includes(oracle.terminalDecision)
      && oracle.terminalPostcondition?.status === 'PASS'
      && oracle.terminalPostcondition?.observed === true
      && oracle.terminalPostcondition?.decision === oracle.terminalDecision
      && oracle.terminalPostcondition?.controlIdentity === control.identity
      && oracle.terminalPostcondition?.stateKey === control.stateKey,
    'Terminal outcome gerçek cancel/accept son-koşul geri-okuması taşımıyor.');
    if (oracle.terminalDecision === 'CANCEL') check(oracle.beforeFingerprint === oracle.afterFingerprint, 'Terminal cancel uygulama durumunu değiştirdi.');
    if (oracle.terminalDecision === 'ACCEPT') check(oracle.beforeFingerprint !== oracle.afterFingerprint && oracle.semanticStateChanged === true, 'Terminal accept gerçek son-koşul değişimi taşımıyor.');
    if (oracle.postcondition?.kind === 'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK') validateNativeRuntimeOracle(control, oracle);
  }
  return frozen({
    ...oracle,
    safetyClassification: safety.classification,
    actionCorrelation: frozen({ ...oracle.actionCorrelation, gesture: frozen({ ...oracle.actionCorrelation.gesture }) }),
    postcondition: frozen({ ...oracle.postcondition }),
    keyboardActivation: frozen({ ...oracle.keyboardActivation }),
    evidence: frozen(oracle.evidence.map((binding) => frozen({ ...binding }))),
    assertions: frozen(oracle.assertions.map((assertion) => frozen({ ...assertion }))),
    quietWindow: oracle.quietWindow ? frozen({ ...oracle.quietWindow }) : undefined,
    terminalPostcondition: oracle.terminalPostcondition ? frozen({ ...oracle.terminalPostcondition }) : undefined,
    routeReadback: oracle.routeReadback ? frozen({ ...oracle.routeReadback }) : undefined,
  });
};

export const validateInstalledUiApplicationStateEvidence = (entry) => {
  const scenario = validateScenario(entry?.scenario);
  check(entry?.status === 'PASS' && Array.isArray(entry.evidence) && entry.evidence.length > 0, `${scenario} durum kanıtı PASS değildir.`);
  for (const evidence of entry.evidence) {
    check(INSTALLED_UI_STATE_ASSERTIONS[scenario]?.includes(evidence?.assertion), `${scenario} durum kanıtı kanonik assertion taşımıyor.`);
    check(evidence?.rawEvidence && typeof evidence.rawEvidence === 'object' && !Array.isArray(evidence.rawEvidence), `${scenario} durum kanıtının ham geri-okuması eksiktir.`);
    check(sha256Pattern.test(String(evidence.sha256 ?? '')) && evidence.sha256 === hash(JSON.stringify(evidence.rawEvidence)), `${scenario} durum kanıtının ham geri-okuma SHA-256 bağı geçersizdir.`);
    const raw = evidence.rawEvidence;
    check(routePattern.test(String(raw.routeId ?? ''))
      && sha256Pattern.test(String(raw.controlIdentity ?? ''))
      && sha256Pattern.test(String(raw.stateKey ?? ''))
      && INSTALLED_UI_STATE_OUTCOME_KINDS[scenario]?.includes(raw.outcomeKind)
      && raw.snapshot && typeof raw.snapshot === 'object' && !Array.isArray(raw.snapshot)
      && sha256Pattern.test(String(raw.snapshotSha256 ?? ''))
      && raw.snapshotSha256 === hash(JSON.stringify(raw.snapshot)),
    `${scenario} durum kanıtı rota/kontrol/outcome/ham snapshot SHA bağı taşımıyor.`);
    if (scenario === 'EMPTY') check(raw.snapshot.allRequiredInputsEmpty === true, 'EMPTY form geri-okuması eksiktir.');
    if (scenario === 'POPULATED') check(raw.snapshot.allRequiredInputsPopulated === true, 'POPULATED form geri-okuması eksiktir.');
    if (scenario === 'VALIDATION_ERROR') check(raw.snapshot.rejected === true
      && (Number(raw.snapshot.invalidCount) > 0 || Number(raw.snapshot.visibleAlertCount) > 0 || raw.snapshot.alertChanged === true),
    'VALIDATION_ERROR doğal ret snapshotı eksiktir.');
    if (scenario === 'SUCCESS') check(raw.snapshot.initialized === true && raw.snapshot.authenticated === true
      && raw.snapshot.twoFactorEnabled === true && raw.snapshot.trustedDevice === true,
    'SUCCESS auth/trusted-device snapshotı eksiktir.');
    if (scenario === 'CONFIRM_CANCEL' || scenario === 'CONFIRM_ACCEPT') {
      const expectedDecision = scenario === 'CONFIRM_ACCEPT' ? 'ACCEPT' : 'CANCEL';
      check(raw.snapshot.decision === expectedDecision
        && sha256Pattern.test(String(raw.snapshot.beforeFingerprint ?? ''))
        && sha256Pattern.test(String(raw.snapshot.afterFingerprint ?? ''))
        && (expectedDecision !== 'CANCEL' || raw.snapshot.beforeFingerprint === raw.snapshot.afterFingerprint),
      `${scenario} karar/snapshot son-koşul bağı geçersizdir.`);
    }
    if (scenario === 'LOADING') {
      const correlation = raw.snapshot.actionCorrelation;
      const expectedObservationSha256 = hash(JSON.stringify({
        visibleSelector: raw.snapshot.visibleSelector,
        textSha256: raw.snapshot.textSha256,
        pageSerial: correlation?.pageSerial,
      }));
      check(evidence.assertion === 'VISIBLE_LOADING_STATE_OBSERVED'
        && raw.snapshot.visible === true
        && raw.snapshot.visibleSelector === loadingEvidenceSelector
        && sha256Pattern.test(String(raw.snapshot.textSha256 ?? ''))
        && correlation?.kind === 'INITIAL_DOCUMENT_LOADING_OBSERVATION'
        && Number.isSafeInteger(correlation?.pageSerial)
        && correlation.pageSerial >= 0
        && correlation.observationSha256 === expectedObservationSha256,
      'LOADING kanıtı görünür hedef, metin özeti ve sayfa olayı bağı taşımıyor.');
    }
    if (scenario === 'PERMISSION_DENIED') {
      const correlation = raw.snapshot.actionCorrelation;
      check(evidence.assertion === 'VISIBLE_PERMISSION_DENIAL_AFTER_GESTURE'
        && raw.snapshot.visible === true
        && raw.snapshot.visibleSelector === permissionEvidenceSelector
        && sha256Pattern.test(String(raw.snapshot.textSha256 ?? ''))
        && correlation?.controlIdentity === raw.controlIdentity
        && correlation?.stateKey === raw.stateKey
        && sha256Pattern.test(String(correlation?.gestureSha256 ?? '')),
      'PERMISSION_DENIED kanıtı görünür hedef, metin özeti ve eylem bağı taşımıyor.');
    }
    if (scenario === 'OFFLINE') check(raw.snapshot.navigatorOnLine === false
      && raw.snapshot.authenticatedShellVisible === true
      && Number(raw.snapshot.canonicalRouteCount) === 22
      && raw.snapshot.preloadIpcReadbackVerified === true
      && raw.snapshot.authIpcReadbackVerified === true
      && raw.snapshot.dashboardIpcReadbackVerified === true
      && sha256Pattern.test(String(raw.snapshot.beforeIpcSummarySha256 ?? ''))
      && raw.snapshot.beforeIpcSummarySha256 === raw.snapshot.offlineIpcSummarySha256,
    'OFFLINE yerel çalışma geri-okuması eksiktir.');
    if (scenario === 'ERROR') {
      const correlation = raw.snapshot.actionCorrelation;
      check(evidence.assertion === 'FIRST_RUN_TWO_FACTOR_IPC_REJECTION_NATURAL_UI'
        && raw.outcomeKind === 'AUTHENTICATION_REJECTION'
        && raw.snapshot.rejected === true && raw.snapshot.ipcAttempted === true
        && raw.snapshot.securityShellVisible === true && raw.snapshot.actionReenabled === true
        && raw.snapshot.twoFactorEnabled === false && raw.snapshot.trustedDevice === false
        && Number(raw.snapshot.visibleAlertCount) > 0
        && sha256Pattern.test(String(raw.snapshot.messageSha256 ?? ''))
        && raw.snapshot.technicalLeakDetected === false
        && correlation?.controlIdentity === raw.controlIdentity
        && correlation?.stateKey === raw.stateKey
        && sha256Pattern.test(String(correlation?.gestureSha256 ?? '')),
      'ERROR gerçek 2FA IPC reddi, görünür doğal hata ve teknik sızıntısızlık geri-okuması taşımıyor.');
    }
  }
  return frozen({ ...entry, evidence: frozen(entry.evidence.map((evidence) => frozen({ ...evidence, rawEvidence: frozen({ ...evidence.rawEvidence }) }))) });
};

export const buildInstalledUiStateMatrixPlan = (routeIds, options = {}) => {
  const routes = [...new Set(routeIds.map(validateRoute))];
  check(routes.length > 0, 'Durum matrisi için en az bir rota zorunludur.');
  const defaultScenarios = options.defaultScenarios ?? INSTALLED_UI_REQUIRED_STATE_SCENARIOS;
  const perRoute = options.perRoute ?? {};
  return frozen(routes.flatMap((routeId) => {
    const scenarios = perRoute[routeId] ?? defaultScenarios;
    check(Array.isArray(scenarios) && scenarios.length > 0, `${routeId} için durum senaryosu eksiktir.`);
    return [...new Set(scenarios.map(validateScenario))].map((scenario) => frozen({ routeId, scenario, key: `${routeId}:${scenario}` }));
  }));
};

export const buildInstalledUiAccessibilityPlan = (surfaceIds = INSTALLED_UI_SEMANTIC_SURFACES.map((surface) => surface.id)) => frozen({
  surfaces: frozen([...new Set(surfaceIds.map(normalizeSurfaceId))]),
  keyboard: INSTALLED_UI_KEYBOARD_PLAN,
  scroll: INSTALLED_UI_SCROLL_PLAN,
  tooltip: frozen([
    frozen({ trigger: 'HOVER', assertion: 'TOOLTIP_VISIBLE_NAMED_AND_WITHIN_VIEWPORT' }),
    frozen({ trigger: 'FOCUS', assertion: 'DESCRIPTION_RELATIONSHIP_AND_CONTENT_MATCH' }),
  ]),
});

export const validateInstalledUiScrollEvidence = (entry, { enabledControlIdentities = [] } = {}) => {
  check(entry && /^scroll-\d+$/u.test(String(entry.containerId ?? ''))
    && INSTALLED_UI_SCROLL_PLAN.some((item) => item.position === entry.position),
  'Kaydırma kanıtı kanonik kap/konum kimliği taşımıyor.');
  check(Number.isInteger(entry.controlCount) && entry.controlCount >= 0
    && Number.isInteger(entry.visibleTargetCount) && entry.visibleTargetCount >= 0
    && entry.visibleTargetCount <= entry.controlCount
    && entry.visibleTargetRequired === (entry.controlCount > 0),
  'Kaydırma görünür hedef sayısı kontrol toplamıyla tutarlı değildir.');
  check(Array.isArray(enabledControlIdentities)
    && enabledControlIdentities.every((identity) => sha256Pattern.test(String(identity))),
  'Kaydırma etkin kontrol kimlik kümesi geçersizdir.');
  if (entry.visibleTargetRequired) {
    check(entry.visibleTargetCount > 0
      && entry.focusTargetFound === true && entry.focusVisible === true
      && sha256Pattern.test(String(entry.expectedTargetIdentity ?? ''))
      && entry.focusTargetIdentity === entry.expectedTargetIdentity
      && enabledControlIdentities.includes(entry.expectedTargetIdentity),
    'Kaydırma exact görünür hedef/odak kimliği doğrulanmadı.');
  } else {
    check(entry.visibleTargetCount === 0 && entry.focusTargetFound === false
      && entry.expectedTargetIdentity === null && entry.focusTargetIdentity === null,
    'Kontrolsüz kaydırma kabı beklenmedik hedef kimliği taşıyor.');
  }
  check(entry.horizontalOverflow === false && entry.stickyOverlap === false
    && entry.textClipping === false && Number.isInteger(entry.scrollTop) && entry.scrollTop >= 0,
  'Kaydırma görsel bütünlük geri-okuması PASS değildir.');
  return frozen({ ...entry });
};

const sanitizeStderrSignature = (line) => normalizeText(line)
  .replace(/[A-Za-z]:[\\/][^\s"']+/gu, '[PATH]')
  .replace(/(?:https?:\/\/[^\s?#]+)[^\s]*/giu, '[URL]')
  .replace(/(token|secret|password|code)=([^\s&]+)/giu, '$1=[REDACTED]')
  .slice(0, 180);

export const classifyInstalledUiMainStderr = (stderr) => {
  const exceptions = [];
  const warnings = [];
  const diagnostics = [];
  const seen = new Set();
  for (const [index, rawLine] of String(stderr ?? '').split(/\r?\n/u).entries()) {
    const line = normalizeText(rawLine);
    if (!line) continue;
    const signature = sanitizeStderrSignature(line);
    const entry = frozen({ lineNumber: index + 1, sha256: hash(line), signature });
    const target = stderrExceptionPatterns.some((pattern) => pattern.test(line))
      ? exceptions
      : stderrWarningPattern.test(line) ? warnings : diagnostics;
    const key = `${target === exceptions ? 'E' : target === warnings ? 'W' : 'D'}:${entry.sha256}`;
    if (!seen.has(key)) { seen.add(key); target.push(entry); }
  }
  return frozen({
    status: exceptions.length === 0 ? 'PASS' : 'FAIL',
    exceptionCount: exceptions.length,
    warningCount: warnings.length,
    diagnosticCount: diagnostics.length,
    exceptions: frozen(exceptions),
    warnings: frozen(warnings),
    diagnostics: frozen(diagnostics),
  });
};

export const assertNoInstalledUiMainProcessExceptions = (stderr) => {
  const classification = classifyInstalledUiMainStderr(stderr);
  check(classification.exceptionCount === 0, `Ana süreç stderr ${classification.exceptionCount} exception imzası içeriyor.`);
  return classification;
};

export const createInstalledUiProcessOutputCollector = ({ sanitizeLine = (value) => String(value), maximumRecordedSignatures = 200 } = {}) => {
  check(typeof sanitizeLine === 'function', 'Process output sanitizer zorunludur.');
  check(Number.isInteger(maximumRecordedSignatures) && maximumRecordedSignatures >= 1 && maximumRecordedSignatures <= 1_000, 'Process output imza sınırı geçersizdir.');
  const channels = new Map(['stdout', 'stderr'].map((channel) => [channel, {
    hash: createHash('sha256'), byteCount: 0, lineCount: 0, remainder: '', exceptions: [], warnings: [], diagnostics: [], ended: false,
  }]));
  const acceptLine = (channel, rawLine) => {
    const state = channels.get(channel);
    const sanitized = sanitizeLine(rawLine);
    const classified = classifyInstalledUiMainStderr(sanitized);
    state.lineCount += 1;
    for (const [source, target] of [[classified.exceptions, state.exceptions], [classified.warnings, state.warnings], [classified.diagnostics, state.diagnostics]]) {
      if (target.length < maximumRecordedSignatures) target.push(...source.slice(0, maximumRecordedSignatures - target.length).map((entry) => frozen({ ...entry, channel })));
    }
    state.exceptionCount = (state.exceptionCount ?? 0) + classified.exceptionCount;
    state.warningCount = (state.warningCount ?? 0) + classified.warningCount;
    state.diagnosticCount = (state.diagnosticCount ?? 0) + classified.diagnosticCount;
  };
  const addChunk = (channel, chunk) => {
    const state = channels.get(channel);
    check(state && state.ended === false, `Kapalı process output kanalına veri yazılamaz: ${channel}`);
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    state.hash.update(bytes);
    state.byteCount += bytes.length;
    const pieces = `${state.remainder}${bytes.toString('utf8')}`.split(/\r?\n/u);
    state.remainder = pieces.pop() ?? '';
    for (const line of pieces) acceptLine(channel, line);
  };
  const endChannel = (channel) => {
    const state = channels.get(channel);
    check(state, `Bilinmeyen process output kanalı: ${channel}`);
    if (state.ended) return;
    if (state.remainder) acceptLine(channel, state.remainder);
    state.remainder = '';
    state.ended = true;
  };
  const report = () => {
    check([...channels.values()].every((state) => state.ended), 'Process output kanalları tam drain edilmedi.');
    const output = Object.fromEntries([...channels].map(([channel, state]) => [channel, frozen({
      status: (state.exceptionCount ?? 0) === 0 ? 'PASS' : 'FAIL',
      byteCount: state.byteCount,
      lineCount: state.lineCount,
      sha256: state.hash.digest('hex'),
      exceptionCount: state.exceptionCount ?? 0,
      warningCount: state.warningCount ?? 0,
      diagnosticCount: state.diagnosticCount ?? 0,
      exceptions: frozen(state.exceptions),
      warnings: frozen(state.warnings),
      diagnostics: frozen(state.diagnostics),
      fullyDrained: true,
      rawOutputRecorded: false,
    })]));
    const exceptionCount = output.stdout.exceptionCount + output.stderr.exceptionCount;
    return frozen({
      status: exceptionCount === 0 ? 'PASS' : 'FAIL',
      exceptionCount,
      warningCount: output.stdout.warningCount + output.stderr.warningCount,
      diagnosticCount: output.stdout.diagnosticCount + output.stderr.diagnosticCount,
      channels: frozen(output),
      fullStreamHashed: true,
      rawOutputRecorded: false,
    });
  };
  return frozen({ addChunk, endChannel, report });
};

export const createInstalledUiInteractionCoverageEngine = ({ routeIds, stateMatrixPlan, requiredStablePasses = 2, requiredQuietWindowMs = 600 } = {}) => {
  const routes = [...new Set((routeIds ?? []).map(validateRoute))];
  check(routes.length > 0, 'Etkileşim kapsam motoru için rota kümesi zorunludur.');
  check(Number.isInteger(requiredStablePasses) && requiredStablePasses >= 1 && requiredStablePasses <= 5, 'Kararlı tur sayısı 1..5 aralığında olmalıdır.');
  check(Number.isInteger(requiredQuietWindowMs) && requiredQuietWindowMs >= 250 && requiredQuietWindowMs <= 5_000, 'Quiet-window süresi 250..5000 ms aralığında olmalıdır.');
  const plan = stateMatrixPlan ?? buildInstalledUiStateMatrixPlan(routes);
  const expectedContexts = new Set(plan.map((item) => `${validateRoute(item.routeId)}:${validateScenario(item.scenario)}`));
  const observedContexts = new Set();
  const entries = new Map();
  const statesByIdentity = new Map();
  const transitions = [];
  const passes = [];
  const stablePassesByContext = new Map([...expectedContexts].map((context) => [context, 0]));

  const observePass = ({ routeId, scenario, controls, quietWindow }) => {
    const route = validateRoute(routeId);
    const stateScenario = validateScenario(scenario);
    const contextKey = `${route}:${stateScenario}`;
    check(expectedContexts.has(contextKey), `Plan dışı rota/durum gözlemi: ${contextKey}`);
    check(Array.isArray(controls), 'Keşif turu kontrol dizisi taşımıyor.');
    check(quietWindow?.status === 'PASS'
      && quietWindow.domStable === true
      && quietWindow.networkStable === true
      && quietWindow.ipcStable === true
      && quietWindow.pageLifecycleStable === true
      && quietWindow.networkInFlight === 0
      && quietWindow.ipcInFlight === 0
      && Number.isSafeInteger(quietWindow.finalSerials?.pageSerial)
      && quietWindow.finalSerials.pageSerial >= 0
      && normalizeText(quietWindow.finalSerials?.barrierFingerprint)
      && Number(quietWindow.quietForMs) >= requiredQuietWindowMs,
    `Keşif turu ${requiredQuietWindowMs} ms DOM/network/IPC quiet-window taşımıyor.`);
    observedContexts.add(contextKey);
    let added = 0;
    const visibleStateKeys = new Set();
    const newStateKeys = new Set();
    for (const raw of controls) {
      const control = createSemanticControlIdentity({ ...raw, routeId: route, scenario: stateScenario });
      if (!control.visible) continue;
      visibleStateKeys.add(control.stateKey);
      if (!entries.has(control.stateKey)) {
        entries.set(control.stateKey, { control, disposition: null, reason: null, outcome: null, externalEvidence: null });
        added += 1;
        newStateKeys.add(control.stateKey);
      }
      const previous = statesByIdentity.get(control.identity);
      if (previous && previous.enabled !== control.enabled) {
        const key = `${control.identity}:${previous.enabled}->${control.enabled}`;
        if (!transitions.some((transition) => transition.key === key)) transitions.push(frozen({ key, identity: control.identity, fromEnabled: previous.enabled, toEnabled: control.enabled }));
      }
      statesByIdentity.set(control.identity, control);
    }
    const sortedVisibleStateKeys = [...visibleStateKeys].sort();
    const sortedNewStateKeys = [...newStateKeys].sort();
    const contextStablePasses = added === 0 ? (stablePassesByContext.get(contextKey) ?? 0) + 1 : 0;
    stablePassesByContext.set(contextKey, contextStablePasses);
    const pass = frozen({
      routeId: route,
      scenario: stateScenario,
      discoveredVisibleCount: sortedVisibleStateKeys.length,
      visibleStateKeys: frozen(sortedVisibleStateKeys),
      visibleControlSetSha256: hash(JSON.stringify(sortedVisibleStateKeys)),
      newStateCount: added,
      newStateKeys: frozen(sortedNewStateKeys),
      stablePasses: contextStablePasses,
      quietWindow: frozen({ ...quietWindow }),
    });
    passes.push(pass);
    return pass;
  };

  const pending = () => frozen([...entries.values()].filter((entry) => entry.disposition === null).map((entry) => entry.control));

  const classify = (stateKey, classification) => {
    const entry = entries.get(stateKey);
    check(entry, `Bilinmeyen kontrol durumu sınıflandırılamaz: ${stateKey}`);
    check(entry.disposition === null, `Kontrol durumu ikinci kez sınıflandırılamaz: ${stateKey}`);
    check(INSTALLED_UI_DISPOSITIONS.includes(classification.disposition), `Geçersiz etkileşim disposition: ${classification.disposition}`);
    if (classification.disposition === 'CLICKED_OUTCOME_VERIFIED') {
      entry.outcome = validateInstalledUiOutcomeOracle(entry.control, classification.outcome);
    } else if (classification.disposition === 'BLOCKED_DISABLED') {
      check(entry.control.enabled === false, 'Etkin kontrol BLOCKED_DISABLED sayılamaz.');
      check(normalizeText(classification.reason), 'Disabled kontrol için görünür/precondition gerekçesi zorunludur.');
      entry.reason = normalizeText(classification.reason);
    } else {
      check(entry.control.enabled === true, 'Yalnız etkin kontrol external-evidence ile ertelenebilir.');
      check(['NATIVE_OS_BOUNDARY', 'HARDWARE_OR_EXTERNAL_PROVIDER'].includes(classification.reason), 'Deferred gerekçesi dar external boundary allowlistinde değildir.');
      const safety = classifyInstalledUiActionSafety(entry.control);
      check(
        (classification.reason === 'NATIVE_OS_BOUNDARY' && safety.classification === 'NATIVE_TARGET_WINDOW_EVIDENCE_REQUIRED')
          || (classification.reason === 'HARDWARE_OR_EXTERNAL_PROVIDER' && safety.classification === 'HARDWARE_OR_EXTERNAL_PROVIDER_EVIDENCE_REQUIRED'),
        'Kontrol semantiği bildirilen external deferral sınırını doğrulamıyor.',
      );
      validateEvidenceBindings(classification.externalEvidence, 'Deferred control');
      check(classification.externalEvidence.every((binding) => binding.controlIdentity === entry.control.identity
        && binding.stateKey === entry.control.stateKey
        && binding.targetObserved === true
        && binding.targetClosed === true
        && sha256Pattern.test(String(binding.targetWindowSha256 ?? ''))),
      'Deferred control kanıtı eyleme özgü açılan/kapanan hedef pencereyle bağlı değildir.');
      entry.reason = classification.reason;
      entry.externalEvidence = frozen(classification.externalEvidence.map((binding) => frozen({
        kind: normalizeText(binding.kind),
        sha256: binding.sha256,
        controlIdentity: binding.controlIdentity,
        stateKey: binding.stateKey,
        targetObserved: true,
        targetClosed: true,
        targetWindowSha256: binding.targetWindowSha256,
      })));
    }
    entry.disposition = classification.disposition;
    return frozen({ stateKey, disposition: entry.disposition });
  };

  const report = () => {
    const values = [...entries.values()];
    const unclassified = values.filter((entry) => entry.disposition === null);
    const unexercisedEnabled = values.filter((entry) => entry.control.enabled && !['CLICKED_OUTCOME_VERIFIED', 'DEFERRED_EXTERNAL_EVIDENCE'].includes(entry.disposition));
    const missingContexts = [...expectedContexts].filter((context) => !observedContexts.has(context));
    const contextStability = Object.fromEntries([...stablePassesByContext].sort(([left], [right]) => left.localeCompare(right)));
    const stablePasses = Math.min(...Object.values(contextStability));
    const fixedPointReached = Object.values(contextStability).every((count) => count >= requiredStablePasses);
    const matrixStateKeys = values.map((entry) => entry.control.stateKey).sort();
    const observedNewStateKeys = passes.flatMap((pass) => pass.newStateKeys).sort();
    const passBindingsValid = passes.every((pass) => pass.discoveredVisibleCount === pass.visibleStateKeys.length
      && pass.newStateCount === pass.newStateKeys.length
      && new Set(pass.visibleStateKeys).size === pass.visibleStateKeys.length
      && new Set(pass.newStateKeys).size === pass.newStateKeys.length
      && [...pass.visibleStateKeys].sort().every((key, index) => key === pass.visibleStateKeys[index])
      && [...pass.newStateKeys].sort().every((key, index) => key === pass.newStateKeys[index])
      && pass.newStateKeys.every((key) => pass.visibleStateKeys.includes(key))
      && pass.visibleControlSetSha256 === hash(JSON.stringify(pass.visibleStateKeys)));
    const matrixMembershipExact = passBindingsValid
      && new Set(observedNewStateKeys).size === observedNewStateKeys.length
      && matrixStateKeys.length === observedNewStateKeys.length
      && matrixStateKeys.every((key, index) => key === observedNewStateKeys[index]);
    return frozen({
      status: unclassified.length === 0 && unexercisedEnabled.length === 0 && missingContexts.length === 0 && fixedPointReached && matrixMembershipExact ? 'PASS' : 'FAIL',
      discoveredStateCount: values.length,
      discoveredIdentityCount: new Set(values.map((entry) => entry.control.identity)).size,
      clickedOutcomeVerifiedCount: values.filter((entry) => entry.disposition === 'CLICKED_OUTCOME_VERIFIED').length,
      blockedDisabledCount: values.filter((entry) => entry.disposition === 'BLOCKED_DISABLED').length,
      deferredExternalEvidenceCount: values.filter((entry) => entry.disposition === 'DEFERRED_EXTERNAL_EVIDENCE').length,
      unclassifiedCount: unclassified.length,
      unexercisedEnabledCount: unexercisedEnabled.length,
      missingStateContextCount: missingContexts.length,
      missingStateContexts: frozen(missingContexts),
      fixedPointReached,
      stablePasses,
      stablePassesByContext: frozen(contextStability),
      requiredStablePasses,
      requiredQuietWindowMs,
      disabledToEnabledTransitions: frozen([...transitions]),
      matrixStateKeys: frozen(matrixStateKeys),
      matrixStateKeysSha256: hash(JSON.stringify(matrixStateKeys)),
      fixedPointMatrixMembershipExact: matrixMembershipExact,
      passes: frozen([...passes]),
      entries: frozen(values.map((entry) => frozen({
        ...entry.control,
        disposition: entry.disposition,
        reason: entry.reason,
        outcome: entry.outcome,
        externalEvidence: entry.externalEvidence,
      }))),
    });
  };

  const assertComplete = () => {
    const result = report();
    check(result.missingStateContextCount === 0, `Durum matrisi ${result.missingStateContextCount} eksik bağlam içeriyor.`);
    check(result.fixedPointReached, `Etkileşim keşfi ${requiredStablePasses} kararlı tura ulaşmadı.`);
    check(result.unclassifiedCount === 0, `${result.unclassifiedCount} kontrol durumu sınıflandırılmadı.`);
    check(result.unexercisedEnabledCount === 0, `${result.unexercisedEnabledCount} etkin kontrol outcome kanıtı olmadan kaldı.`);
    check(result.fixedPointMatrixMembershipExact, 'Fixed-point ham kontrol kümeleri interaction matrix üyeliğiyle exact eşleşmiyor.');
    return result;
  };

  return frozen({ observePass, pending, classify, report, assertComplete });
};
