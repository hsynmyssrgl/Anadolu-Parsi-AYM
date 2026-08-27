import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  unlink
} from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { verifyElectronFuseBinary } from '../apps/desktop/scripts/apply-electron-fuses.mjs';
import { ELECTRON_FUSE_POLICY } from '../apps/desktop/scripts/electron-fuse-policy.mjs';
import { acquireExclusiveEvidenceRunRootGuard } from './lib/exclusive-evidence-run-root-guard.mjs';
import {
  CANONICAL_UNIVERSAL_AFFECTED_VITEST_FILES,
  CANONICAL_UNIVERSAL_DEPENDENT_RECORDS
} from './lib/mutation-release-evidence.mjs';
import { PRODUCT_NAVIGATION_GROUPS, PRODUCT_NAVIGATION_ROUTES } from './lib/canonical-product-navigation.mjs';
import { assertPreallocatedReleaseIdentity } from './lib/monthly-release-version.mjs';
import {
  classifyInstalledUiActionSafety,
  createSemanticControlIdentity,
  INSTALLED_UI_ASSERTION_IDS,
  INSTALLED_UI_EVIDENCE_KINDS,
  INSTALLED_UI_KEYBOARD_PLAN,
  INSTALLED_UI_POSTCONDITION_KINDS,
  INSTALLED_UI_REQUIRED_STATE_SCENARIOS,
  INSTALLED_UI_SCROLL_PLAN,
  INSTALLED_UI_STATE_ASSERTIONS,
  validateInstalledUiApplicationStateEvidence,
  validateInstalledUiOutcomeOracle,
  validateInstalledUiScrollEvidence
} from './lib/installed-ui-interaction-coverage.mjs';
import {
  INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY,
  INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY_SHA256,
  resolveInstalledUiNativeDialogSpecification
} from './lib/windows-native-file-dialog-uat.mjs';
import {
  assertMatchingReleaseSourceProvenance,
  captureReleaseSourceProvenance,
  verifyLocalSourceProtectionArtifacts
} from './lib/release-source-provenance.mjs';
import {
  verifyWindowsPackageHistoryBundle,
  verifyWindowsPackageProvenanceLive,
  windowsPackageHistoryBundleRelativePath
} from './lib/windows-package-provenance.mjs';
import { readCanonicalChannelSourceProtection } from './lib/aym-source-authority.mjs';

export const FINAL_LOCAL_TEST_DELIVERY_SCHEMA_VERSION = 3;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const LOCAL_TEST_STATUS = 'LOCAL_TEST_PASS_PRODUCTION_RELEASE_BLOCKED';
const LOCAL_TEST_CLASSIFICATION = 'UNSIGNED_LOCAL_TEST_ONLY';
const FINAL_LOCAL_TEST_DELIVERY_ID = 'PPT-BRONZE-FINAL-LOCAL-TEST-DELIVERY-V3';
const INSTALLER_EXPERIENCE_UAT_ID = 'PPT-WINDOWS-INSTALLER-EXPERIENCE-UAT-V2';
const INSTALLED_RELEASE_UAT_ID = 'PPT-WINDOWS-INSTALLED-RELEASE-UAT110-V3';
const INSTALLED_FRONTEND_UAT_ID = 'PPT-INSTALLED-FRONTEND-USER-UAT111-V3';
const TECHNICAL_PREDECESSOR_PREPARATION_ID = 'PPT-WINDOWS-TECHNICAL-PREDECESSOR-PREPARATION-V1';
const NARRATION_CLAIM_BOUNDARY = 'OFFLINE_WAVE_SYNTHESIS_ONLY_NOT_AUDIBLE_OUTPUT';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const validationRoot = resolve(root, 'artifacts/validation');
const narrationEvidenceRoot = resolve(tmpdir(), 'ParsYuvaInstallerEvidence');
const aymRoot = resolve(root, '../..');
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CANONICAL_ROUTE_IDS = Object.freeze(PRODUCT_NAVIGATION_ROUTES.map((route) => route.id));
const CANONICAL_GROUP_IDS = Object.freeze(PRODUCT_NAVIGATION_GROUPS.map((group) => group.id));
const INSTALLED_UI_SCREENSHOT_NAMES = Object.freeze([
  'onboarding-introduction.png', 'onboarding-family-empty.png', 'onboarding-family-filled-redacted.png',
  'onboarding-security-start.png', 'onboarding-security-redacted.png', 'authenticated-shell.png',
  ...CANONICAL_GROUP_IDS.map((groupId) => `module-${groupId}.png`),
  ...CANONICAL_GROUP_IDS.map((groupId) => `normal-${groupId}.png`),
  ...CANONICAL_GROUP_IDS.map((groupId) => `stress-${groupId}.png`),
  'narration-tr.png', 'narration-en.png'
]);
const INSTALLER_SCREENSHOT_NAMES = Object.freeze([
  '01-family-space.png', '02-local-privacy.png', '03-narrated-guidance.png'
]);
const fail = (message) => { throw new Error(message); };
const check = (condition, message) => { if (!condition) fail(message); };
check(PRODUCT_NAVIGATION_GROUPS.length === 4 && PRODUCT_NAVIGATION_ROUTES.length === 22,
  'Built-domain canonical navigation contract is not exact 4/22.');
const lowerSha256 = (value, label) => {
  const normalized = String(value ?? '').toLowerCase();
  check(SHA256_PATTERN.test(normalized), `${label} is not a SHA-256 digest.`);
  return normalized;
};
const samePath = (left, right) => resolve(String(left)).toLowerCase() === resolve(String(right)).toLowerCase();
const strictDescendant = (candidate, parent) => {
  const local = relative(resolve(parent), resolve(candidate));
  return local !== '' && local !== '..' && !local.startsWith(`..${sep}`) && !isAbsolute(local);
};
const exactArray = (actual, expected) => Array.isArray(actual)
  && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
const canonicalJsonSha256 = (value) => sha256Bytes(Buffer.from(JSON.stringify(value)));
const isoMillis = (value, label) => {
  const parsed = Date.parse(String(value ?? ''));
  check(Number.isFinite(parsed), `${label} is not an ISO timestamp.`);
  return parsed;
};
const portablePath = (path) => {
  const full = resolve(path);
  const local = relative(root, full);
  return local !== '' && local !== '..' && !local.startsWith(`..${sep}`) && !isAbsolute(local)
    ? local.replaceAll('\\', '/')
    : full;
};
const sha256Bytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sha256File = (path) => new Promise((resolvePromise, rejectPromise) => {
  const hasher = createHash('sha256');
  const stream = createReadStream(path);
  stream.on('error', rejectPromise);
  stream.on('data', (chunk) => hasher.update(chunk));
  stream.on('end', () => resolvePromise(hasher.digest('hex')));
});

const parseOptions = (arguments_) => {
  const options = new Map();
  for (let index = 0; index < arguments_.length; index += 1) {
    const token = arguments_[index];
    check(token.startsWith('--'), `Unexpected positional argument: ${token}`);
    const [rawName, inlineValue] = token.slice(2).split(/=(.*)/su, 2);
    const value = inlineValue ?? arguments_[index + 1];
    check(value !== undefined && !String(value).startsWith('--'), `Missing value for --${rawName}.`);
    check(!options.has(rawName), `Duplicate option: --${rawName}.`);
    options.set(rawName, value);
    if (inlineValue === undefined) index += 1;
  }
  return options;
};

const requireOption = (options, name) => {
  const value = options.get(name);
  check(typeof value === 'string' && value.trim() !== '', `Required option is missing: --${name}.`);
  return value;
};

const readJsonBinding = async (path, id, { boundary = validationRoot } = {}) => {
  const fullPath = resolve(path);
  const boundaryPath = resolve(boundary);
  const local = relative(boundaryPath, fullPath);
  check(local !== '' && local !== '..' && !local.startsWith(`..${sep}`) && !isAbsolute(local), `${id} evidence escapes its canonical boundary.`);
  let cursor = boundaryPath;
  for (const segment of local.split(/[\\/]/u).filter(Boolean)) {
    cursor = resolve(cursor, segment);
    const ancestor = await lstat(cursor);
    check(!ancestor.isSymbolicLink(), `${id} evidence contains a symlink/reparse ancestor.`);
  }
  const item = await lstat(fullPath);
  check(item.isFile() && !item.isSymbolicLink(), `${id} evidence must be a regular non-link file.`);
  check(samePath(await realpath(fullPath), fullPath), `${id} evidence realpath changed the canonical target.`);
  const bytes = await readFile(fullPath);
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); }
  catch (error) { fail(`${id} evidence is not valid JSON: ${error instanceof Error ? error.message : String(error)}`); }
  return Object.freeze({
    id,
    path: portablePath(fullPath),
    fullPath,
    sizeBytes: bytes.length,
    sha256: sha256Bytes(bytes),
    value
  });
};

const assertNoSecretBearingEvidence = (value, label, path = '$') => {
  const secretLikeKeyPattern = /(?:^|[_-])(?:password|secret|recovery.?codes?|authenticator|otp|token)(?:$|[_-])|(?:Password|Secret|RecoveryCodes?|Authenticator|Otp|OTP|Token)/u;
  const allowedSensitiveKeys = new Set([
    'passwordRecorded', 'twoFactorSecretRecorded', 'recoveryCodesRecorded',
    'containsUnredactedAuthenticationSecrets', 'receiptContainsAuthenticationSecret',
    'unknownSecretLikeFieldCount', 'sensitiveScreenshotCount', 'unredactedSecretCount',
    'authenticationSecretPolicy', 'secretScanApplied', 'secretRedactionCount', 'secretCategories',
    'physicalPixelSecretClaimed'
  ]);
  const allowedSensitiveContainerKeys = new Set(['secretAudit', 'secretSurfaceScan']);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretBearingEvidence(item, label, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'string') {
    const normalized = value.normalize('NFKC');
    const secretValuePattern = /(?:otpauth:\/\/|(?:anahtar|key|secret|token|password|parola|kurtarma kodu|recovery code)\s*[:=]\s*(?!\[(?:UAT\s+)?(?:GİZLENDİ|REDACTED)\])[A-Z0-9_+./=-]{6,})/iu;
    const structuralHash = /\.(?:[A-Za-z0-9]*Sha256|headCommit|headTree|gitBlob|sourceCommit)$/iu.test(path)
      && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/iu.test(normalized);
    const rawBase32 = !structuralHash && /^[A-Z2-7]{16,128}={0,6}$/u.test(normalized);
    const rawOtp = /^\d{6,8}$/u.test(normalized);
    const rawRecoveryCode = /^(?:[A-Z0-9]{4,8}[- ]){2,7}[A-Z0-9]{4,8}$/u.test(normalized)
      && !/^[A-F0-9]{8}(?:-[A-F0-9]{4}){3}-[A-F0-9]{12}$/iu.test(normalized);
    const passwordLike = normalized.length >= 10 && normalized.length <= 128 && !/[\s/\\]/u.test(normalized)
      && /[a-z]/u.test(normalized) && /[A-Z]/u.test(normalized) && /\d/u.test(normalized) && /[^A-Za-z0-9]/u.test(normalized);
    check(!secretValuePattern.test(normalized) && !rawBase32 && !rawOtp && !rawRecoveryCode && !passwordLike,
      `${label} contains a secret-like value at ${path}.`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (secretLikeKeyPattern.test(key)
      && !allowedSensitiveKeys.has(key) && !allowedSensitiveContainerKeys.has(key)) {
      fail(`${label} contains an unknown secret-like field: ${path}.${key}`);
    }
    if (allowedSensitiveKeys.has(key)) {
      const safe = item === false || item === 0 || item === null
        || (key === 'authenticationSecretPolicy' && item === 'REDACT_AND_SCAN_BEFORE_EVERY_CAPTURE')
        || (key === 'secretScanApplied' && item === true)
        || (key === 'secretRedactionCount' && Number.isInteger(item) && item >= 0)
        || (key === 'secretCategories' && Array.isArray(item))
        || (key === 'physicalPixelSecretClaimed' && typeof item === 'boolean');
      check(safe, `${label} contains unsafe secret evidence at ${path}.${key}.`);
    }
    assertNoSecretBearingEvidence(item, label, `${path}.${key}`);
  }
};

const verifyScreenshotArtifactsLive = async (receipt, label, { requireUniqueHashes = true } = {}) => {
  const evidenceRoot = resolve(String(receipt.evidenceRoot ?? ''));
  check(strictDescendant(evidenceRoot, validationRoot), `${label} evidence root is outside artifacts/validation.`);
  const artifacts = receipt.screenshotArtifacts ?? receipt.screenshots ?? [];
  check(Array.isArray(artifacts) && artifacts.length > 0, `${label} has no screenshot artifacts.`);
  const results = [];
  const seenPaths = new Set();
  const seenHashes = new Set();
  for (const artifact of artifacts) {
    const pathValue = typeof artifact === 'string' ? artifact : artifact.path ?? artifact.relativePath;
    check(typeof pathValue === 'string' && pathValue !== '' && !isAbsolute(pathValue), `${label} screenshot path must be repository-relative.`);
    const fullPath = resolve(root, pathValue);
    const local = relative(evidenceRoot, fullPath);
    check(local !== '' && local !== '..' && !local.startsWith(`..${sep}`) && !isAbsolute(local), `${label} screenshot escapes its evidence root.`);
    check(!seenPaths.has(fullPath.toLowerCase()), `${label} screenshot path is duplicated.`);
    seenPaths.add(fullPath.toLowerCase());
    let cursor = validationRoot;
    for (const segment of relative(validationRoot, fullPath).split(/[\\/]/u).filter(Boolean)) {
      cursor = resolve(cursor, segment);
      const ancestor = await lstat(cursor);
      check(!ancestor.isSymbolicLink(), `${label} screenshot contains a symlink/reparse ancestor.`);
    }
    const item = await lstat(fullPath);
    check(item.isFile() && !item.isSymbolicLink(), `${label} screenshot must be a regular non-link file.`);
    check(samePath(await realpath(fullPath), fullPath), `${label} screenshot realpath drifted.`);
    const bytes = await readFile(fullPath);
    const expectedSize = Number(artifact.sizeBytes);
    const expectedSha = lowerSha256(artifact.sha256 ?? artifact.screenshotSha256, `${label} screenshot`);
    check(bytes.length === expectedSize && sha256Bytes(bytes) === expectedSha, `${label} screenshot live readback mismatch.`);
    check(bytes.length >= 24 && bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', `${label} screenshot is not PNG.`);
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    check(width > 0 && height > 0 && width === Number(artifact.width) && height === Number(artifact.height), `${label} screenshot dimensions drifted.`);
    if (requireUniqueHashes) {
      check(!seenHashes.has(expectedSha), `${label} screenshot content hash is duplicated.`);
      seenHashes.add(expectedSha);
    }
    results.push({ name: artifact.name ?? local.replaceAll('\\', '/').split('/').at(-1), path: portablePath(fullPath), sizeBytes: bytes.length, width, height, sha256: expectedSha });
  }
  return Object.freeze(results);
};

const readWindowsMetadata = (path) => {
  check(process.platform === 'win32', 'Final Windows delivery evidence can run only on Windows.');
  const script = [
    '$ErrorActionPreference="Stop"',
    '$p=$env:PPT_FINAL_DELIVERY_EXECUTABLE',
    '$i=Get-Item -LiteralPath $p',
    '$s=Get-AuthenticodeSignature -LiteralPath $p',
    '[ordered]@{fileVersion=$i.VersionInfo.FileVersion;productVersion=$i.VersionInfo.ProductVersion;authenticodeStatus=$s.Status.ToString();signerSubject=if($null-ne $s.SignerCertificate){$s.SignerCertificate.Subject}else{$null}}|ConvertTo-Json -Compress'
  ].join(';');
  const result = spawnSync('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script
  ], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, PPT_FINAL_DELIVERY_EXECUTABLE: path }
  });
  check(result.status === 0, `Windows executable metadata failed for ${path}: ${result.stderr || result.stdout}`);
  try { return JSON.parse(result.stdout.trim()); }
  catch { fail(`Windows executable metadata returned invalid JSON for ${path}.`); }
};

const readExecutableIdentity = async (path) => {
  const fullPath = resolve(path);
  const item = await lstat(fullPath);
  check(item.isFile() && !item.isSymbolicLink(), `Executable must be a regular non-link file: ${fullPath}`);
  return Object.freeze({
    path: portablePath(fullPath),
    fullPath,
    sizeBytes: item.size,
    sha256: await sha256File(fullPath),
    ...readWindowsMetadata(fullPath)
  });
};

const validateNarration = ({ binding, waveIdentity, language, applicationVersion, packageVersion, scriptSha256 }) => {
  const evidence = binding.value;
  check(evidence?.schemaVersion === 1 && evidence.status === 'PASS', `${language} narration synthesis did not PASS.`);
  check(evidence.language === language, `${language} narration language mismatch.`);
  check(evidence.outputMode === 'WAVE_CAPTURE', `${language} narration must use WAVE_CAPTURE.`);
  check(evidence.claimBoundary === NARRATION_CLAIM_BOUNDARY, `${language} narration claim boundary is unsafe.`);
  check(evidence.promptCompleted === true && evidence.promptCancelled === false && evidence.stopFileObserved === false,
    `${language} narration completion state is invalid.`);
  check(evidence.completion?.eventObserved === true && evidence.completion?.cancelled === false
    && evidence.completion?.errorType === null && evidence.completion?.promptIsCompleted === true,
  `${language} narration async completion was not proven.`);
  check(['SYSTEM_SPEECH', 'WINRT_ONECORE'].includes(evidence.engine), `${language} narration engine is unsupported.`);
  const sameLanguageVoices = (evidence.voiceInventory ?? []).filter((voice) =>
    String(voice.culture ?? '').toLowerCase().startsWith(`${language}-`) && voice.enabled === true
  );
  check(sameLanguageVoices.length > 0, `${language} narration has no enabled same-language voice.`);
  const femalePresent = sameLanguageVoices.some((voice) => String(voice.gender).toLowerCase() === 'female');
  const malePresent = sameLanguageVoices.some((voice) => String(voice.gender).toLowerCase() === 'male');
  const expectedReason = femalePresent
    ? 'SAME_LANGUAGE_FEMALE_PREFERRED'
    : malePresent ? 'SAME_LANGUAGE_MALE_FALLBACK' : 'SAME_LANGUAGE_FIRST_VOICE_FALLBACK';
  check(evidence.selectionReason === expectedReason, `${language} narration did not obey the female/male fallback order.`);
  check(String(evidence.selectedVoice?.culture ?? '').toLowerCase().startsWith(`${language}-`),
    `${language} selected narration voice has the wrong culture.`);
  check(evidence.source?.applicationVersion === applicationVersion
    && evidence.source?.packageVersion === packageVersion,
  `${language} narration version binding mismatch.`);
  check(lowerSha256(evidence.source?.scriptSha256, `${language} narration script`) === scriptSha256,
    `${language} narration script hash is stale.`);
  const wave = evidence.wave;
  check(wave?.riffValidated === true && wave.completeFileConsumed === true && wave.finalOffset === wave.sizeBytes
    && wave.dataBytes > 0 && wave.durationMs > 0,
  `${language} narration RIFF/WAVE validation is incomplete.`);
  check(lowerSha256(wave.sha256, `${language} narration wave`) === waveIdentity.sha256
    && Number(wave.sizeBytes) === waveIdentity.sizeBytes,
  `${language} narration wave readback mismatch.`);
  return Object.freeze({
    status: 'PASS',
    language,
    engine: evidence.engine,
    selectedVoice: evidence.selectedVoice,
    selectionReason: evidence.selectionReason,
    outputMode: evidence.outputMode,
    claimBoundary: evidence.claimBoundary,
    wave: {
      path: waveIdentity.path,
      sizeBytes: waveIdentity.sizeBytes,
      sha256: waveIdentity.sha256,
      durationMs: wave.durationMs,
      riffValidated: true,
      completeFileConsumed: true
    },
    source: evidence.source,
    evidence: { path: binding.path, sizeBytes: binding.sizeBytes, sha256: binding.sha256 }
  });
};

const validateFuseResult = (result, executable, label) => {
  check(result?.policyId === 'B2-04-ELECTRON-FUSE-V1', `${label} fuse policy id mismatch.`);
  check(samePath(result.executablePath, executable.fullPath), `${label} fuse executable mismatch.`);
  check(JSON.stringify(result.fuses) === JSON.stringify(ELECTRON_FUSE_POLICY), `${label} fuse readback mismatch.`);
  return Object.freeze({ policyId: result.policyId, version: String(result.version), fuses: result.fuses });
};

const validateInstalledUiDynamicCoverage = (uiChecks, {
  installedUiEvidenceRoot,
  nativeScreenshotReadbacks,
  installedRuntimeSha256
} = {}) => {
  const navigation = uiChecks.navigationSurfaces;
  const expectedNavigation = [
    ...PRODUCT_NAVIGATION_ROUTES.map((route, index) => ({ route, index, mode: 'NORMAL' })),
    ...PRODUCT_NAVIGATION_ROUTES.map((route, index) => ({ route, index, mode: 'STRESS_760X720_200_HIGH_CONTRAST' }))
  ];
  check(Array.isArray(navigation) && navigation.length === expectedNavigation.length
    && navigation.every((entry, index) => {
      const expected = expectedNavigation[index];
      return entry?.status === 'PASS' && entry.routeId === expected.route.id
        && entry.label === expected.route.label && entry.index === expected.index && entry.mode === expected.mode
        && (entry.mode !== 'STRESS_760X720_200_HIGH_CONTRAST'
          || (entry.viewport?.width === 760 && entry.viewport?.height === 720));
    }),
  'Installed UI navigation is not the exact built-domain 4/22 normal/stress matrix.');
  check(uiChecks.navigationSurfaceCount === CANONICAL_ROUTE_IDS.length
    && uiChecks.navigationPassCount === expectedNavigation.length,
  'Installed UI navigation summary does not match the canonical raw matrix.');
  const routeIds = new Set(CANONICAL_ROUTE_IDS);
  check(Array.isArray(uiChecks.moduleMenus) && uiChecks.moduleMenus.length === PRODUCT_NAVIGATION_GROUPS.length
    && uiChecks.moduleMenuCount === PRODUCT_NAVIGATION_GROUPS.length
    && uiChecks.moduleMenus.every((entry, index) => {
      const expected = PRODUCT_NAVIGATION_GROUPS[index];
      return entry?.groupId === expected.id && entry.label === expected.label && entry.status === 'PASS'
        && entry.routeCount === PRODUCT_NAVIGATION_ROUTES.filter((route) => route.groupId === expected.id).length;
    }),
  'Installed UI module menus do not match canonical built-domain groups/routes.');

  const interactionMatrix = uiChecks.interactionMatrix;
  check(Array.isArray(interactionMatrix) && interactionMatrix.length > 0
    && interactionMatrix.length === uiChecks.interactionMatrixCount
    && uiChecks.interactionEntriesSha256 === canonicalJsonSha256(interactionMatrix),
  'Installed UI interaction matrix is missing or count-mismatched.');
  const stateKeys = new Set();
  const terminalSemantics = new Map();
  const nativeSemantics = new Map();
  const assertStrictOutcome = (entry, semantic, outcome) => {
    const verified = validateInstalledUiOutcomeOracle(semantic, outcome);
    const terminalPostcondition = verified.terminalDecision === 'CANCEL'
      ? 'TERMINAL_CANCEL_STATE_UNCHANGED'
      : 'TERMINAL_ACCEPT_STATE_CHANGED';
    const allowedPostconditions = verified.kind === 'STATE_CHANGE'
      ? ['TARGET_STATE_CHANGED', 'ARIA_CONTROLLED_REGION_CHANGED', 'TARGET_SEMANTIC_SCOPE_CHANGED', 'VISIBLE_STATUS_CHANGED', 'NAVIGATION_ROUTE_CHANGED']
      : verified.kind === 'IDEMPOTENT_READ_ONLY' ? ['NAVIGATION_ROUTE_CURRENT']
        : verified.kind === 'VALIDATION_REJECTION' ? ['TARGET_VALIDATION_MESSAGE_CHANGED']
          : verified.kind === 'CONFIRM_CANCEL' || verified.kind === 'NATIVE_DIALOG_CANCEL' ? ['DIALOG_CANCEL_READBACK']
            : verified.kind === 'CONFIRM_ACCEPT' ? ['DIALOG_ACCEPT_READBACK']
              : verified.kind === 'NATIVE_DIALOG_ACCEPT'
                ? ['NATIVE_SAVE_ARTIFACT_READBACK_VERIFIED', 'NATIVE_OPEN_SELECTION_AND_APPLICATION_READBACK_VERIFIED']
                : verified.kind === 'TERMINAL_DISPOSABLE_PROFILE'
                  ? [terminalPostcondition, 'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK'] : [];
    const expectedAssertionCount = verified.kind === 'NATIVE_DIALOG_ACCEPT'
      || verified.postcondition?.kind === 'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK' ? 2 : 1;
    check(allowedPostconditions.includes(verified.postcondition?.kind)
      && INSTALLED_UI_POSTCONDITION_KINDS.includes(verified.postcondition?.kind)
      && Array.isArray(verified.evidence) && verified.evidence.length === 1
      && INSTALLED_UI_EVIDENCE_KINDS.includes(verified.evidence[0]?.kind)
      && Array.isArray(verified.assertions) && verified.assertions.length === expectedAssertionCount
      && verified.assertions.every((assertion) => INSTALLED_UI_ASSERTION_IDS.includes(assertion?.id))
      && Number(verified.quietWindow?.quietForMs) >= 700
      && verified.quietWindow?.pageLifecycleStable === true
      && verified.quietWindow?.ipcInFlight === 0 && verified.quietWindow?.networkInFlight === 0
      && ['domSerial', 'ipcSerial', 'ipcInFlight', 'pageSerial', 'networkSerial', 'networkInFlight'].every((key) =>
        Number.isSafeInteger(verified.quietWindow?.finalSerials?.[key]) && verified.quietWindow.finalSerials[key] >= 0)
      && typeof verified.quietWindow.finalSerials.barrierFingerprint === 'string'
      && verified.quietWindow.finalSerials.barrierFingerprint.length > 0
      && verified.quietWindow.finalSerials.ipcInFlight === 0
      && verified.quietWindow.finalSerials.networkInFlight === 0,
    'Installed UI outcome evidence/postcondition/quiet-window envelope is not exact.');
    if (verified.postcondition.kind === 'NAVIGATION_ROUTE_CURRENT') {
      const descriptor = PRODUCT_NAVIGATION_ROUTES.find((route) => route.id === semantic.routeId);
      check(Boolean(descriptor)
        && entry.navigationRouteId === semantic.routeId
        && entry.dataRoute === semantic.routeId
        && entry.actionHint === 'NAVIGATION_ROUTE'
        && entry.surfaceId === 'sidebar'
        && ['button', 'a', 'link'].includes(entry.role)
        && entry.label === descriptor.label
        && entry.locator.startsWith('sidebar[')
        && entry.locator.endsWith(`[data-navigation-route=${JSON.stringify(semantic.routeId)}]`),
      'Installed UI current-route readback is not bound to the exact canonical semantic route control.');
    }
    return verified;
  };
  let clicked = 0;
  let blocked = 0;
  let deferred = 0;
  for (const entry of interactionMatrix) {
    const semantic = createSemanticControlIdentity({
      ...entry,
      expanded: entry?.state?.expanded === 'true' ? true : entry?.state?.expanded === 'false' ? false : undefined,
      checked: entry?.state?.checked === 'true' ? true : entry?.state?.checked === 'false' ? false : undefined,
      pressed: entry?.state?.pressed === 'true' ? true : entry?.state?.pressed === 'false' ? false : undefined,
      selected: entry?.state?.selected === 'true' ? true : entry?.state?.selected === 'false' ? false : undefined,
      valueState: entry?.state?.valueState
    });
    check(entry?.identity === semantic.identity && entry?.stateKey === semantic.stateKey,
      'Installed UI semantic identity/state key is not reproducible from raw control fields.');
    const nativeSpecification = resolveInstalledUiNativeDialogSpecification(semantic);
    if (nativeSpecification && semantic.enabled) {
      check(!nativeSemantics.has(semantic.identity), 'Installed UI native dialog control identity is duplicated.');
      nativeSemantics.set(semantic.identity, { entry, semantic, specification: nativeSpecification });
    }
    check(!stateKeys.has(entry.stateKey), 'Installed UI interaction state key is duplicated.');
    stateKeys.add(entry.stateKey);
    check(routeIds.has(entry.routeId) && entry.scenario === 'BASELINE'
      && typeof entry.surfaceId === 'string' && entry.visible === true,
    'Installed UI interaction is not bound to a discovered visible route/surface.');
    if (entry.disposition === 'CLICKED_OUTCOME_VERIFIED') {
      clicked += 1;
      const verifiedOutcome = assertStrictOutcome(entry, semantic, entry.outcome);
      check(entry.enabled === true && verifiedOutcome.status === 'PASS'
        && verifiedOutcome.kind === entry.outcome.kind
        && verifiedOutcome.safetyClassification === entry.outcome.safetyClassification,
      'Installed UI clicked interaction lacks a reproducible action-specific outcome oracle.');
      if (verifiedOutcome.kind === 'TERMINAL_DISPOSABLE_PROFILE') {
        check(verifiedOutcome.terminalDecision === 'CANCEL',
          'Installed UI interaction matrix terminal outcome must prove the safe CANCEL path first.');
        terminalSemantics.set(semantic.identity, { entry, semantic });
      }
    } else if (entry.disposition === 'BLOCKED_DISABLED') {
      blocked += 1;
      check(entry.enabled === false && typeof entry.reason === 'string' && entry.reason.length > 0,
        'Installed UI disabled interaction lacks a reason.');
    } else if (entry.disposition === 'DEFERRED_EXTERNAL_EVIDENCE') {
      deferred += 1;
      const safety = classifyInstalledUiActionSafety(semantic);
      check(entry.enabled === true
        && ((entry.reason === 'NATIVE_OS_BOUNDARY' && safety.classification === 'NATIVE_TARGET_WINDOW_EVIDENCE_REQUIRED')
          || (entry.reason === 'HARDWARE_OR_EXTERNAL_PROVIDER' && safety.classification === 'HARDWARE_OR_EXTERNAL_PROVIDER_EVIDENCE_REQUIRED')),
      'Installed UI deferred interaction reason does not match its control safety classification.');
      fail('Installed UI final PASS cannot defer an enabled native/hardware action; the live runner must fail closed.');
    } else {
      fail(`Installed UI interaction has an unknown disposition: ${entry.disposition ?? '<missing>'}.`);
    }
  }
  const sortedMatrixStateKeys = [...stateKeys].sort();
  check(exactArray(uiChecks.interactionMatrixStateKeys, sortedMatrixStateKeys)
    && uiChecks.interactionMatrixStateKeysSha256 === canonicalJsonSha256(sortedMatrixStateKeys)
    && uiChecks.fixedPointMatrixMembershipExact === true,
  'Installed UI interaction matrix state-key summary is stale or forged.');
  check(uiChecks.interactionCoverageComplete === true && uiChecks.interactionFixedPointReached === true
    && uiChecks.unclassifiedInteractionCount === 0 && uiChecks.unexercisedEnabledInteractionCount === 0
    && uiChecks.clickedInteractionCount === clicked && uiChecks.blockedInteractionCount === blocked
    && uiChecks.deferredInteractionCount === deferred && deferred === 0,
  'Installed UI dynamic interaction coverage summary is stale.');
  const terminalAcceptOutcomes = uiChecks.terminalAcceptOutcomes;
  check(Array.isArray(terminalAcceptOutcomes)
    && terminalAcceptOutcomes.length === terminalSemantics.size
    && new Set(terminalAcceptOutcomes.map((outcome) => outcome?.actionCorrelation?.controlIdentity)).size === terminalAcceptOutcomes.length
    && terminalAcceptOutcomes.every((outcome) => {
      const pair = terminalSemantics.get(outcome?.actionCorrelation?.controlIdentity);
      if (!pair) return false;
      const verified = assertStrictOutcome(pair.entry, pair.semantic, outcome);
      return verified.kind === 'TERMINAL_DISPOSABLE_PROFILE' && verified.terminalDecision === 'ACCEPT';
    }),
  'Installed UI terminal action does not prove the real CANCEL then ACCEPT sequence.');

  const nativeDialogEvidence = uiChecks.nativeDialogEvidence;
  check(Array.isArray(nativeDialogEvidence)
    && nativeDialogEvidence.length === nativeSemantics.size
    && uiChecks.nativeDialogEvidenceCount === nativeDialogEvidence.length
    && uiChecks.nativeDialogEvidenceSha256 === canonicalJsonSha256(nativeDialogEvidence)
    && nativeDialogEvidence.length > 0,
  'Installed UI native-dialog raw evidence count/SHA does not match the discovered native controls.');
  const nativeEvidenceIdentities = nativeDialogEvidence.map((record) => record?.controlIdentity);
  check(new Set(nativeEvidenceIdentities).size === nativeEvidenceIdentities.length
    && nativeEvidenceIdentities.every((identity) => nativeSemantics.has(identity))
    && nativeSemantics.has(nativeDialogEvidence.find((record) => record?.labelClass === 'finance:OPEN:FINANCE_IMPORT')?.controlIdentity),
  'Installed UI native-dialog evidence set lacks the exact finance import or contains an unknown control.');
  const nativeReadbacks = Array.isArray(nativeScreenshotReadbacks) ? nativeScreenshotReadbacks : [];
  check(nativeReadbacks.length === nativeDialogEvidence.length * 2
    && new Set(nativeReadbacks.map((item) => resolve(String(item.path)).toLowerCase())).size === nativeReadbacks.length,
  'Installed UI native-dialog target-only screenshot live readback path set is incomplete or duplicated.');
  const stoppedProcessIdentities = new Set((uiChecks.processEvidence?.stopped ?? [])
    .map((item) => `${item.processId}:${item.creationTimeUtc}`));
  const replacedProcessIdentities = new Set(nativeDialogEvidence
    .map((record) => record?.accept?.postcondition?.process)
    .filter((process) => process?.previousRootAbsent === true)
    .map((process) => `${process.previousProcessId}:${process.previousCreationTimeUtc}`));
  const validateNativeDecision = (record, pair, decisionName, decision) => {
    const expectedDecision = decisionName.toUpperCase();
    const expectedPostcondition = expectedDecision === 'CANCEL'
      ? 'NATIVE_DIALOG_CANCELLED_WITHOUT_SELECTION_MUTATION'
      : pair.specification.terminalHybrid
        ? 'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK'
        : pair.specification.dialogKind === 'SAVE'
          ? 'NATIVE_SAVE_ARTIFACT_READBACK_VERIFIED'
          : 'NATIVE_OPEN_SELECTION_AND_APPLICATION_READBACK_VERIFIED';
    check(decision?.status === 'PASS' && decision.decision === expectedDecision
      && decision.targetObserved === true && decision.targetClosed === true
      && decision.dialogKind === pair.specification.dialogKind,
    `Installed UI native ${expectedDecision} decision envelope is incomplete.`);
    const targetWindow = decision.targetWindow;
    const { identitySha256, ...targetWindowMaterial } = targetWindow ?? {};
    const directIdentity = Number.isInteger(targetWindow?.processId) && targetWindow.processId > 0
      && Number.isFinite(Date.parse(String(targetWindow.creationTimeUtc ?? '')))
      ? `${targetWindow.processId}:${targetWindow.creationTimeUtc}` : null;
    const ownerIdentity = Number.isInteger(targetWindow?.ownerProcessId) && targetWindow.ownerProcessId > 0
      && Number.isFinite(Date.parse(String(targetWindow.ownerCreationTimeUtc ?? '')))
      ? `${targetWindow.ownerProcessId}:${targetWindow.ownerCreationTimeUtc}` : null;
    const expectedOwnedIdentity = targetWindow?.ownershipMode === 'DIRECT_TARGET_PROCESS' ? directIdentity
      : targetWindow?.ownershipMode === 'OWNER_PROCESS' ? ownerIdentity : null;
    check(targetWindow?.className === '#32770' && expectedOwnedIdentity
      && SHA256_PATTERN.test(String(targetWindow.titleSha256 ?? ''))
      && SHA256_PATTERN.test(String(targetWindow.automationIdSha256 ?? ''))
      && targetWindow.uiAutomationInvokePattern === true && targetWindow.printWindowTargetOnly === true
      && Number.isFinite(targetWindow.bounds?.left) && Number.isFinite(targetWindow.bounds?.top)
      && Number(targetWindow.bounds?.width) > 0 && Number(targetWindow.bounds?.height) > 0
      && identitySha256 === canonicalJsonSha256(targetWindowMaterial)
      && (stoppedProcessIdentities.has(expectedOwnedIdentity) || replacedProcessIdentities.has(expectedOwnedIdentity)),
    `Installed UI native ${expectedDecision} target window is not bound to an exact owned process identity.`);
    const expectedName = `native-${record.routeId}-${record.controlIdentity.slice(0, 12)}-${decisionName}.png`;
    const screenshot = decision.screenshot;
    const screenshotPath = resolve(root, String(screenshot?.path ?? ''));
    const expectedScreenshotPath = resolve(installedUiEvidenceRoot, expectedName);
    const readback = nativeReadbacks.find((item) => samePath(item.path, screenshotPath));
    check(!isAbsolute(String(screenshot?.path ?? '')) && samePath(screenshotPath, expectedScreenshotPath)
      && screenshot?.targetOnly === true && screenshot.readbackVerified === true
      && Number(screenshot.sizeBytes) > 0 && Number(screenshot.width) > 0 && Number(screenshot.height) > 0
      && SHA256_PATTERN.test(String(screenshot.sha256 ?? ''))
      && readback && Number(readback.sizeBytes) === Number(screenshot.sizeBytes)
      && Number(readback.width) === Number(screenshot.width) && Number(readback.height) === Number(screenshot.height)
      && readback.sha256 === screenshot.sha256,
    `Installed UI native ${expectedDecision} screenshot path/hash/live readback is not exact.`);
    check(screenshot.physicalPixelOcr?.status === 'PASS_PHYSICAL_PIXEL_OCR'
      ? screenshot.physicalPixelOcr.engine === 'TESSERACT'
        && screenshot.physicalPixelOcr.findingCount === 0
        && screenshot.physicalPixelOcr.physicalPixelSecretClaimed === true
        && screenshot.physicalPixelOcr.ocrTextRecorded === false
        && SHA256_PATTERN.test(String(screenshot.physicalPixelOcr.ocrTextSha256 ?? ''))
      : screenshot.physicalPixelOcr?.status === 'NOT_RUN_PHYSICAL_PIXEL_OCR'
        && screenshot.physicalPixelOcr.reason === 'TESSERACT_NOT_AVAILABLE'
        && screenshot.physicalPixelOcr.physicalPixelSecretClaimed === false
        && screenshot.physicalPixelOcr.ocrTextRecorded === false,
    `Installed UI native ${expectedDecision} screenshot pixel-scan boundary is invalid.`);
    const selection = decision.selection;
    check(selection?.kind === pair.specification.selectionKind && selection.synthetic === true
      && selection.extension === pair.specification.extension
      && typeof selection.fileName === 'string' && selection.fileName !== ''
      && !/[\\/]/u.test(selection.fileName) && selection.pathRecorded === false
      && selection.withinDisposableProfile === true,
    `Installed UI native ${expectedDecision} synthetic selection is not bound to its canonical specification.`);
    if (expectedDecision === 'ACCEPT' || pair.specification.dialogKind === 'OPEN') {
      check(selection.existsAfterDecision === true && Number(selection.sizeBytes) > 0
        && SHA256_PATTERN.test(String(selection.sha256 ?? '')),
      `Installed UI native ${expectedDecision} selected artifact readback is missing.`);
    } else {
      check(selection.existsAfterDecision === false && selection.sizeBytes === 0 && selection.sha256 === null,
        'Installed UI native SAVE cancel unexpectedly produced an artifact.');
    }
    check(decision.postcondition?.status === 'PASS' && decision.postcondition.kind === expectedPostcondition
      && decision.postcondition.applicationReadbackVerified === true
      && decision.postcondition.selectedArtifactReadbackVerified === selection.existsAfterDecision,
    `Installed UI native ${expectedDecision} action-specific postcondition is not exact.`);
    if (pair.specification.terminalHybrid && expectedDecision === 'ACCEPT') {
      const process = decision.postcondition.process;
      check(process?.previousRootAbsent === true && process.exactExecutablePathVerified === true
        && process.remoteDebuggingPortInherited === true && process.restoredAccountInitialized === true
        && process.authenticatedSessionRevoked === true
        && lowerSha256(process.replacementExecutableSha256, 'Native restore relaunched executable') === installedRuntimeSha256,
      'Installed UI native restore does not prove exact owned relaunch and revoked authentication.');
    }
  };
  for (const record of nativeDialogEvidence) {
    const pair = nativeSemantics.get(record.controlIdentity);
    check(pair && record.status === 'PASS' && record.specId === pair.specification.specId && record.routeId === pair.semantic.routeId
      && record.stateKey === pair.semantic.stateKey && record.labelClass === pair.specification.labelClass
      && record.dialogKind === pair.specification.dialogKind,
    'Installed UI native-dialog record is not bound to its exact semantic control/specification.');
    validateNativeDecision(record, pair, 'cancel', record.cancel);
    validateNativeDecision(record, pair, 'accept', record.accept);
    check(!samePath(record.cancel.screenshot.path, record.accept.screenshot.path)
      && record.cancel.screenshot.sha256 !== record.accept.screenshot.sha256,
    'Installed UI native control CANCEL/ACCEPT screenshots must have distinct paths and pixel hashes.');
    const outcome = pair.specification.terminalHybrid
      ? terminalAcceptOutcomes.find((item) => item?.actionCorrelation?.controlIdentity === pair.semantic.identity)
      : pair.entry.outcome;
    check(outcome?.nativeDialog && canonicalJsonSha256(outcome.nativeDialog) === canonicalJsonSha256(record),
      'Installed UI native-dialog raw record is not bound to the matching verified outcome.');
  }
  const nativeInventory = uiChecks.nativeDialogInventory;
  check(uiChecks.nativeDialogInventorySourceSha256 === INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY_SHA256
    && Array.isArray(nativeInventory)
    && nativeInventory.length === INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY.length
    && uiChecks.nativeDialogInventoryCount === nativeInventory.length
    && uiChecks.nativeDialogInventorySha256 === canonicalJsonSha256(nativeInventory),
  'Installed UI native-dialog inventory source/count/SHA is not canonical.');
  const allInventoryStateKeys = new Set();
  check(nativeInventory.every((entry, index) => {
    const canonical = INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY[index];
    if (!canonical || !['specId', 'routeId', 'labelPatternSource', 'labelPatternFlags', 'labelClass', 'dialogKind', 'selectionKind', 'extension', 'terminalHybrid']
      .every((key) => entry?.[key] === canonical[key])) return false;
    if (!['EXERCISED', 'DISABLED', 'NOT_PRESENT'].includes(entry.status)
      || entry.sourceSnapshot?.canonicalInventorySha256 !== INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY_SHA256
      || entry.sourceSnapshot?.specificationSha256 !== canonicalJsonSha256(canonical)
      || entry.routeDomSnapshot?.routeId !== canonical.routeId
      || !Number.isInteger(entry.routeDomSnapshot?.observationCount) || entry.routeDomSnapshot.observationCount < 1
      || !Array.isArray(entry.routeDomSnapshot?.snapshotHashes)
      || entry.routeDomSnapshot.observationCount !== entry.routeDomSnapshot.snapshotHashes.length
      || !exactArray(entry.routeDomSnapshot.snapshotHashes, [...new Set(entry.routeDomSnapshot.snapshotHashes)].sort())
      || !entry.routeDomSnapshot.snapshotHashes.every((sha) => SHA256_PATTERN.test(String(sha)))
      || entry.routeDomSnapshot.snapshotsSha256 !== canonicalJsonSha256(entry.routeDomSnapshot.snapshotHashes)) return false;
    const enabledControls = entry.enabledControls;
    const disabledControls = entry.disabledControls;
    if (![enabledControls, disabledControls, entry.exercisedStateKeys, entry.exercisedRecordSha256].every(Array.isArray)
      || !exactArray(enabledControls.map((control) => control.stateKey), enabledControls.map((control) => control.stateKey).sort())
      || !exactArray(disabledControls.map((control) => control.stateKey), disabledControls.map((control) => control.stateKey).sort())
      || !exactArray(entry.exercisedStateKeys, [...new Set(entry.exercisedStateKeys)].sort())
      || !exactArray(entry.exercisedRecordSha256, [...new Set(entry.exercisedRecordSha256)].sort())) return false;
    for (const [controls, expectedEnabled] of [[enabledControls, true], [disabledControls, false]]) {
      for (const control of controls) {
        if (!SHA256_PATTERN.test(String(control?.identity ?? '')) || !SHA256_PATTERN.test(String(control?.stateKey ?? ''))
          || control.enabled !== expectedEnabled || allInventoryStateKeys.has(control.stateKey)
          || !interactionMatrix.some((candidate) => candidate.identity === control.identity
            && candidate.stateKey === control.stateKey && candidate.enabled === expectedEnabled)) return false;
        allInventoryStateKeys.add(control.stateKey);
      }
    }
    const records = nativeDialogEvidence.filter((record) => record.specId === canonical.specId);
    const enabledStateKeys = enabledControls.map((control) => control.stateKey);
    const expectedRecordHashes = records.map((record) => canonicalJsonSha256(record)).sort();
    if (entry.status === 'EXERCISED') return records.length > 0 && enabledControls.length > 0
      && exactArray(entry.exercisedStateKeys, enabledStateKeys)
      && exactArray(entry.exercisedRecordSha256, expectedRecordHashes)
      && records.every((record) => entry.exercisedStateKeys.includes(record.stateKey));
    if (entry.status === 'DISABLED') return records.length === 0 && enabledControls.length === 0
      && disabledControls.length > 0 && entry.exercisedStateKeys.length === 0 && entry.exercisedRecordSha256.length === 0;
    return records.length === 0 && enabledControls.length === 0 && disabledControls.length === 0
      && entry.exercisedStateKeys.length === 0 && entry.exercisedRecordSha256.length === 0;
  }) && nativeDialogEvidence.every((record) => INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY
    .some((specification) => specification.specId === record.specId)),
  'Installed UI native-dialog exact canonical inventory/spec/state coverage is incomplete or forged.');
  const stableContexts = uiChecks.interactionStablePassesByContext;
  const rawPasses = uiChecks.interactionPasses;
  check(uiChecks.interactionRequiredQuietWindowMs === 600
    && Array.isArray(rawPasses) && uiChecks.interactionPassesSha256 === canonicalJsonSha256(rawPasses)
    && rawPasses.length >= CANONICAL_ROUTE_IDS.length * 2
    && rawPasses.every((pass) => routeIds.has(pass?.routeId) && pass.scenario === 'BASELINE'
      && Number.isInteger(pass.discoveredVisibleCount) && pass.discoveredVisibleCount >= 0
      && Array.isArray(pass.visibleStateKeys)
      && exactArray(pass.visibleStateKeys, [...new Set(pass.visibleStateKeys)].sort())
      && pass.discoveredVisibleCount === pass.visibleStateKeys.length
      && pass.visibleControlSetSha256 === canonicalJsonSha256(pass.visibleStateKeys)
      && Number.isInteger(pass.newStateCount) && pass.newStateCount >= 0
      && Array.isArray(pass.newStateKeys)
      && exactArray(pass.newStateKeys, [...new Set(pass.newStateKeys)].sort())
      && pass.newStateCount === pass.newStateKeys.length
      && pass.newStateKeys.every((stateKey) => pass.visibleStateKeys.includes(stateKey))
      && Number.isInteger(pass.stablePasses) && pass.stablePasses >= 0
      && pass.quietWindow?.status === 'PASS' && pass.quietWindow.domStable === true
      && pass.quietWindow.networkStable === true && pass.quietWindow.ipcStable === true
      && pass.quietWindow.pageLifecycleStable === true
      && pass.quietWindow.networkInFlight === 0 && pass.quietWindow.ipcInFlight === 0
      && Number(pass.quietWindow.quietForMs) >= 700
      && ['domSerial', 'ipcSerial', 'ipcInFlight', 'pageSerial', 'networkSerial', 'networkInFlight'].every((key) =>
        Number.isSafeInteger(pass.quietWindow.finalSerials?.[key]) && pass.quietWindow.finalSerials[key] >= 0)
      && typeof pass.quietWindow.finalSerials.barrierFingerprint === 'string'
      && pass.quietWindow.finalSerials.barrierFingerprint.length > 0
      && pass.quietWindow.finalSerials.ipcInFlight === 0 && pass.quietWindow.finalSerials.networkInFlight === 0),
  'Installed UI raw fixed-point discovery passes/quiet windows are incomplete.');
  let lastRouteIndex = -1;
  check(rawPasses.every((pass) => {
    const routeIndex = CANONICAL_ROUTE_IDS.indexOf(pass.routeId);
    const ordered = routeIndex >= lastRouteIndex;
    lastRouteIndex = routeIndex;
    return ordered;
  }), 'Installed UI raw fixed-point pass order is not canonical.');
  check(CANONICAL_ROUTE_IDS.every((routeId) => {
    const passes = rawPasses.filter((pass) => pass.routeId === routeId && pass.scenario === 'BASELINE');
    const routeStateKeys = interactionMatrix.filter((entry) => entry.routeId === routeId && entry.scenario === 'BASELINE')
      .map((entry) => entry.stateKey).sort();
    const discoveredStateKeys = passes.flatMap((pass) => pass.newStateKeys).sort();
    let expectedStablePasses = 0;
    const sequenceValid = passes.every((pass) => {
      expectedStablePasses = pass.newStateCount > 0 ? 0 : expectedStablePasses + 1;
      return pass.stablePasses === expectedStablePasses && pass.discoveredVisibleCount >= pass.newStateCount;
    });
    const matrixCount = interactionMatrix.filter((entry) => entry.routeId === routeId && entry.scenario === 'BASELINE').length;
    return passes.length >= 2 && passes.length <= 480 && sequenceValid
      && passes.at(-2)?.stablePasses === 1 && passes.at(-1)?.stablePasses === 2
      && passes.slice(0, -1).every((pass) => pass.stablePasses < 2)
      && passes.reduce((sum, pass) => sum + pass.newStateCount, 0) === matrixCount
      && exactArray(discoveredStateKeys, routeStateKeys)
      && new Set(discoveredStateKeys).size === discoveredStateKeys.length
      && passes.every((pass) => pass.visibleStateKeys.every((stateKey) => routeStateKeys.includes(stateKey)));
  }) && rawPasses.reduce((sum, pass) => sum + pass.newStateCount, 0) === interactionMatrix.length,
  'Installed UI raw pass sequence/count does not reconcile with the interaction matrix.');
  check(stableContexts && typeof stableContexts === 'object'
    && CANONICAL_ROUTE_IDS.every((routeId) => {
      const passes = rawPasses.filter((pass) => pass.routeId === routeId && pass.scenario === 'BASELINE');
      const maximum = Math.max(...passes.map((pass) => pass.stablePasses));
      return maximum === 2 && Number(stableContexts[`${routeId}:BASELINE`]) === maximum;
    }),
  'Installed UI fixed-point summary is not derived from its raw passes.');
  check(Array.isArray(uiChecks.disabledToEnabledTransitions), 'Installed UI disabled/enabled transition evidence is missing.');

  const stateMatrix = uiChecks.applicationStateMatrix;
  check(uiChecks.applicationStateMatrixComplete === true && Array.isArray(stateMatrix)
    && stateMatrix.length === INSTALLED_UI_REQUIRED_STATE_SCENARIOS.length,
  'Installed UI application state matrix is incomplete.');
  check(stateMatrix.every((entry, index) => {
    if (entry?.scenario !== INSTALLED_UI_REQUIRED_STATE_SCENARIOS[index]) return false;
    const verified = validateInstalledUiApplicationStateEvidence(entry);
    return verified.status === 'PASS'
      && verified.evidence.every((evidence) => INSTALLED_UI_STATE_ASSERTIONS[entry.scenario].includes(evidence.assertion));
  }),
  'Installed UI application state matrix lacks scenario-specific raw PASS assertions.');
  const logicalStateBindings = new Map([
    ['FIRST_FAMILY_FORM_EMPTY', ['onboarding', 'first-family-form']],
    ['EMPTY_FIRST_FAMILY_FORM_REJECTED', ['onboarding', 'first-family-form']],
    ['FIRST_FAMILY_FORM_POPULATED', ['onboarding', 'first-family-form']],
    ['VISIBLE_LOADING_STATE_OBSERVED', ['onboarding', 'initial-document']],
    ['FIRST_RUN_TWO_FACTOR_IPC_REJECTION_NATURAL_UI', ['onboarding', 'first-run-two-factor-rejection']],
    ['NETWORK_OFFLINE_LOCAL_SHELL_READBACK', ['dashboard', 'offline-local-shell']],
    ['AUTHENTICATED_TRUSTED_DEVICE_READBACK', ['dashboard', 'authenticated-shell']]
  ].map(([assertion, [routeId, logicalControlId]]) => {
    const controlIdentity = canonicalJsonSha256({ routeId, logicalControlId });
    return [assertion, { routeId, controlIdentity, stateKey: canonicalJsonSha256({ controlIdentity, logicalControlId }) }];
  }));
  check(stateMatrix.every((entry) => entry.evidence.every((evidence) => {
    const raw = evidence.rawEvidence;
    const logical = logicalStateBindings.get(evidence.assertion);
    if (logical) return raw.routeId === logical.routeId && raw.controlIdentity === logical.controlIdentity && raw.stateKey === logical.stateKey;
    const matrixEntry = interactionMatrix.find((candidate) => candidate.routeId === raw.routeId
      && candidate.identity === raw.controlIdentity && candidate.stateKey === raw.stateKey);
    if (!matrixEntry) return false;
    const outcomes = [matrixEntry.outcome, ...terminalAcceptOutcomes]
      .filter((outcome) => outcome?.actionCorrelation?.controlIdentity === raw.controlIdentity
        && outcome?.actionCorrelation?.stateKey === raw.stateKey);
    const matchingOutcome = outcomes.find((outcome) => outcome.kind === raw.outcomeKind
      && (entry.scenario !== 'CONFIRM_CANCEL' && entry.scenario !== 'CONFIRM_ACCEPT'
        || (outcome.terminalDecision ?? outcome.kind.replace('CONFIRM_', '')) === raw.snapshot.decision));
    if (!matchingOutcome) return false;
    if (entry.scenario === 'PERMISSION_DENIED') {
      return raw.snapshot.actionCorrelation?.controlIdentity === raw.controlIdentity
        && raw.snapshot.actionCorrelation?.stateKey === raw.stateKey
        && raw.snapshot.actionCorrelation?.gestureSha256 === matchingOutcome.actionCorrelation.gestureSha256;
    }
    if (entry.scenario === 'CONFIRM_CANCEL' || entry.scenario === 'CONFIRM_ACCEPT') {
      return raw.snapshot.beforeFingerprint === matchingOutcome.beforeFingerprint
        && raw.snapshot.afterFingerprint === matchingOutcome.afterFingerprint;
    }
    return true;
  })), 'Installed UI application state evidence is not linked to its exact logical or interaction outcome control.');

  const accessibility = uiChecks.accessibilityResults;
  check(uiChecks.accessibilityPlan
    && exactArray(uiChecks.accessibilityPlan.keyboard?.map((item) => item.id), INSTALLED_UI_KEYBOARD_PLAN.map((item) => item.id))
    && exactArray(uiChecks.accessibilityPlan.scroll?.map((item) => item.position), INSTALLED_UI_SCROLL_PLAN.map((item) => item.position))
    && Array.isArray(accessibility) && accessibility.length === CANONICAL_ROUTE_IDS.length
    && accessibility.every((entry, index) => {
      const expectedRouteId = CANONICAL_ROUTE_IDS[index];
      const enabledEntries = interactionMatrix
        .filter((item) => item.routeId === expectedRouteId && item.enabled === true)
        .sort((left, right) => left.stateKey.localeCompare(right.stateKey));
      const enabledIdentities = enabledEntries.map((item) => item.identity).sort();
      const enabledStateKeys = enabledEntries.map((item) => item.stateKey).sort();
      if (entry?.routeId !== expectedRouteId || entry.status !== 'PASS'
        || !exactArray(entry.enabledControlIdentities, enabledIdentities)
        || entry.enabledControlIdentitiesSha256 !== canonicalJsonSha256(enabledIdentities)
        || !exactArray(entry.enabledControlStateKeys, enabledStateKeys)
        || entry.enabledControlStateKeysSha256 !== canonicalJsonSha256(enabledStateKeys)
        || Number(entry.enabledCount) !== enabledIdentities.length
        || entry.forwardReachedCount !== entry.enabledCount || entry.reverseReachedCount !== entry.enabledCount
        || !exactArray(entry.forwardReachedControlIdentities, enabledIdentities)
        || !exactArray(entry.forwardReachedStateKeys, enabledStateKeys)
        || !exactArray(entry.reverseReachedControlIdentities, enabledIdentities)
        || !exactArray(entry.reverseReachedStateKeys, enabledStateKeys)
        || entry.exactForwardSet !== true || entry.exactReverseSet !== true
        || !Number.isInteger(entry.keyboardActivationCount) || entry.keyboardActivationCount < 0
        || entry.keyboardActivationCount !== entry.expectedKeyboardActivationCount
        || !Array.isArray(entry.activatedStateKeys)
        || !entry.activatedStateKeys.every((stateKey) => enabledStateKeys.includes(stateKey))
        || entry.activatedStateKeys.length !== entry.keyboardActivationCount
        || entry.exactActivationSet !== true || entry.escapeClosed !== true
        || !['FORWARD_AND_REVERSE_CONTAINMENT_PASS', 'NOT_APPLICABLE_NO_OPEN_MODAL'].includes(entry.modalFocusTrap)
        || !exactArray(entry.keyboardPlanIds, INSTALLED_UI_KEYBOARD_PLAN.map((item) => item.id))) return false;
      const modalExpected = entry.modalExpectedControlIdentities;
      const modalForward = entry.modalForwardFocusIdentities;
      const modalReverse = entry.modalReverseFocusIdentities;
      if (!Array.isArray(modalExpected) || !Array.isArray(modalForward) || !Array.isArray(modalReverse)
        || !exactArray(modalExpected, [...new Set(modalExpected)].sort())) return false;
      if (entry.modalFocusTrap === 'NOT_APPLICABLE_NO_OPEN_MODAL') {
        if (modalExpected.length !== 0 || modalForward.length !== 0 || modalReverse.length !== 0) return false;
      } else if (modalExpected.length === 0 || modalForward.length !== 1 || modalReverse.length !== 1
        || !modalExpected.includes(modalForward[0]) || !modalExpected.includes(modalReverse[0])) return false;
      if (!Number.isInteger(entry.scrollContainerCount) || entry.scrollContainerCount < 1
        || !Array.isArray(entry.expectedScrollContainerIds) || entry.expectedScrollContainerIds.length !== entry.scrollContainerCount
        || new Set(entry.expectedScrollContainerIds).size !== entry.scrollContainerCount
        || !entry.expectedScrollContainerIds.every((id) => /^scroll-\d+$/u.test(id))
        || !Array.isArray(entry.scroll) || entry.scroll.length !== entry.scrollContainerCount * INSTALLED_UI_SCROLL_PLAN.length) return false;
      const scrollValid = entry.expectedScrollContainerIds.every((containerId, containerIndex) => {
        const containerEntries = entry.scroll.slice(
          containerIndex * INSTALLED_UI_SCROLL_PLAN.length,
          (containerIndex + 1) * INSTALLED_UI_SCROLL_PLAN.length
        );
        return exactArray(containerEntries.map((item) => item.position), INSTALLED_UI_SCROLL_PLAN.map((item) => item.position))
          && containerEntries.every((item) => {
            if (item.containerId !== containerId) return false;
            try {
              validateInstalledUiScrollEvidence(item, { enabledControlIdentities: enabledIdentities });
              return true;
            } catch {
              return false;
            }
          });
      });
      if (!scrollValid || !Number.isInteger(entry.tooltipCount) || entry.tooltipCount < 0
        || !Array.isArray(entry.tooltipResults) || entry.tooltipResults.length !== entry.tooltipCount
        || entry.tooltipHoveredCount !== entry.tooltipResults.filter((item) => item.hoverVisible === true).length
        || new Set(entry.tooltipResults.map((item) => item.id)).size !== entry.tooltipCount) return false;
      return entry.tooltipResults.every((item) => /^tip-\d+$/u.test(item.id)
        && SHA256_PATTERN.test(String(item.targetIdentity ?? ''))
        && (item.targetStateKey === null
          || interactionMatrix.some((candidate) => candidate.identity === item.targetIdentity && candidate.stateKey === item.targetStateKey))
        && item.hoverVisible === true && item.focusDescriptionMatched === true
        && item.contentPresent === true && item.withinViewport === true && item.focused === true
        && Array.isArray(item.describedByIds) && item.describedByIds.length > 0
        && item.describedByIds.every((id) => typeof id === 'string' && id.length > 0)
        && Number.isInteger(item.contentCount) && item.contentCount > 0
        && SHA256_PATTERN.test(String(item.contentSha256 ?? '')));
    }),
  'Installed UI keyboard/scroll/tooltip route evidence is not derived from the canonical plan.');

  const visualAudits = uiChecks.visualAudits;
  const navigationByKey = new Map(navigation.map((entry) => [`${entry.routeId}:${entry.mode}`, entry]));
  const expectedVisualAudits = [
    { surfaceId: 'first-run-security', mode: 'NORMAL', kind: 'EXTRA' },
    { surfaceId: 'authenticated-shell', mode: 'NORMAL', kind: 'EXTRA' },
    ...CANONICAL_GROUP_IDS.map((groupId) => ({ surfaceId: `module-${groupId}`, mode: 'NORMAL', kind: 'EXTRA' })),
    ...CANONICAL_ROUTE_IDS.map((routeId) => ({ surfaceId: routeId, mode: 'NORMAL', kind: 'ROUTE' })),
    ...CANONICAL_ROUTE_IDS.map((routeId) => ({ surfaceId: routeId, mode: 'STRESS_760X720_200_HIGH_CONTRAST', kind: 'ROUTE' }))
  ];
  check(Array.isArray(visualAudits) && visualAudits.length === expectedVisualAudits.length
    && visualAudits.length === uiChecks.visualAuditCount
    && uiChecks.visualIssueCount === visualAudits.reduce((sum, entry) => sum + (Array.isArray(entry?.issues) ? entry.issues.length : 1), 0)
    && uiChecks.visualIssueCount === 0
    && visualAudits.every((entry, index) => {
      const expected = expectedVisualAudits[index];
      if (entry?.surfaceId !== expected.surfaceId || entry.mode !== expected.mode
        || entry.missingRoot !== false || !Array.isArray(entry.issues) || entry.issues.length !== 0
        || !Number.isInteger(entry.controlCount) || entry.controlCount < 0
        || !Number.isInteger(entry.focusableCount) || entry.focusableCount < 0
        || entry.focusableCount > entry.controlCount || entry.focusProbe !== true
        || !Number.isInteger(entry.viewport?.width) || entry.viewport.width <= 0
        || !Number.isInteger(entry.viewport?.height) || entry.viewport.height <= 0) return false;
      if (expected.kind === 'EXTRA') return true;
      const navigationEntry = navigationByKey.get(`${entry.surfaceId}:${entry.mode}`);
      return Boolean(navigationEntry)
        && entry.viewport.width === navigationEntry.viewport?.width
        && entry.viewport.height === navigationEntry.viewport?.height
        && (entry.mode !== 'STRESS_760X720_200_HIGH_CONTRAST'
          || (entry.viewport.width === 760 && entry.viewport.height === 720));
    }),
  'Installed UI visual audit raw matrix is incomplete.');
  check(uiChecks.unexpectedRendererExceptionCount === 0 && uiChecks.failedResourceCount === 0
    && uiChecks.mainProcessExceptionCount === 0 && uiChecks.mainProcessStderr?.exceptionCount === 0
    && uiChecks.mainProcessStderr?.status === 'PASS' && uiChecks.mainProcessStderr?.fullyDrained === true
    && Number.isSafeInteger(uiChecks.mainProcessStderr?.byteCount) && uiChecks.mainProcessStderr.byteCount >= 0
    && Number.isSafeInteger(uiChecks.mainProcessStderr?.lineCount) && uiChecks.mainProcessStderr.lineCount >= 0
    && SHA256_PATTERN.test(String(uiChecks.mainProcessStderr?.sha256 ?? ''))
    && uiChecks.mainProcessOutput?.status === 'PASS' && uiChecks.mainProcessOutput?.exceptionCount === 0
    && uiChecks.mainProcessOutput?.fullStreamHashed === true && uiChecks.mainProcessOutput?.rawOutputRecorded === false
    && ['stdout', 'stderr'].every((channel) => {
      const stream = uiChecks.mainProcessOutput?.channels?.[channel];
      return stream?.status === 'PASS' && stream.fullyDrained === true && stream.rawOutputRecorded === false
        && stream.exceptionCount === 0 && Number.isSafeInteger(stream.warningCount) && stream.warningCount >= 0
        && Number.isSafeInteger(stream.diagnosticCount) && stream.diagnosticCount >= 0
        && Number.isSafeInteger(stream.byteCount) && stream.byteCount >= 0
        && Number.isSafeInteger(stream.lineCount) && stream.lineCount >= 0
        && Array.isArray(stream.exceptions) && stream.exceptions.length === 0
        && Array.isArray(stream.warnings) && stream.warnings.length <= stream.warningCount
        && Array.isArray(stream.diagnostics) && stream.diagnostics.length <= stream.diagnosticCount
        && SHA256_PATTERN.test(String(stream.sha256 ?? ''));
    })
    && uiChecks.mainProcessOutput.warningCount === ['stdout', 'stderr'].reduce((sum, channel) => sum + uiChecks.mainProcessOutput.channels[channel].warningCount, 0)
    && uiChecks.mainProcessOutput.diagnosticCount === ['stdout', 'stderr'].reduce((sum, channel) => sum + uiChecks.mainProcessOutput.channels[channel].diagnosticCount, 0)
    && uiChecks.mainProcessStderr.sha256 === uiChecks.mainProcessOutput.channels.stderr.sha256
    && uiChecks.mainProcessStderr.byteCount === uiChecks.mainProcessOutput.channels.stderr.byteCount
    && uiChecks.mainProcessStderr.lineCount === uiChecks.mainProcessOutput.channels.stderr.lineCount
    && uiChecks.processEvidence?.survivorCount === 0
    && uiChecks.processEvidence?.identityUsesCreationDate === true,
  'Installed UI renderer/resource/main-process evidence contains an error.');
  return Object.freeze({ routeCount: routeIds.size, clicked, blocked, deferred, visualAuditCount: visualAudits.length });
};

const assertExactScreenshotSet = ({ artifacts, expectedNames, readbacks, label, stressPrefix = null }) => {
  check(Array.isArray(artifacts) && artifacts.length === expectedNames.length,
    `${label} screenshot count is not canonical.`);
  const names = artifacts.map((artifact) => artifact.name ?? String(artifact.path ?? artifact.relativePath ?? '').replaceAll('\\', '/').split('/').at(-1));
  check(exactArray(names, expectedNames) && new Set(names).size === expectedNames.length,
    `${label} screenshot names/order are not canonical.`);
  const paths = artifacts.map((artifact) => artifact.path ?? artifact.relativePath);
  const hashes = artifacts.map((artifact) => lowerSha256(artifact.sha256 ?? artifact.screenshotSha256, `${label} screenshot`));
  check(new Set(paths.map((path) => String(path).toLowerCase())).size === artifacts.length
    && new Set(hashes).size === artifacts.length,
  `${label} screenshot paths/hashes are duplicated.`);
  check(artifacts.every((artifact, index) => Number(artifact.sizeBytes) > 0
    && Number(artifact.width) > 0 && Number(artifact.height) > 0
    && (!stressPrefix || !names[index].startsWith(stressPrefix)
      || (Number(artifact.width) === 760 && Number(artifact.height) === 720))),
  `${label} screenshot dimensions are invalid.`);
  check(Array.isArray(readbacks) && readbacks.length === artifacts.length
    && readbacks.every((readback, index) => samePath(readback.path, resolve(root, paths[index]))
      && Number(readback.sizeBytes) === Number(artifacts[index].sizeBytes)
      && Number(readback.width) === Number(artifacts[index].width)
      && Number(readback.height) === Number(artifacts[index].height)
      && readback.sha256 === hashes[index]),
  `${label} screenshot live readback does not match its exact raw set.`);
  return Object.freeze({ names, hashes });
};

const validateFinalEvidenceRoots = ({
  technicalPredecessorPreparation, installerExperience, installationPreservation, installedUi,
  finalRunId, finalEvidenceRoot, requireTechnicalPredecessorPreparation
}) => {
  const runIds = [installerExperience.runId, installationPreservation.runId, installedUi.runId, finalRunId];
  if (requireTechnicalPredecessorPreparation) runIds.unshift(technicalPredecessorPreparation?.runId);
  check(runIds.every((runId) => UUID_V4_PATTERN.test(String(runId ?? '')))
    && new Set(runIds).size === (requireTechnicalPredecessorPreparation ? 5 : 4),
  'Technical-predecessor/installer/UAT110/UAT111/final runId values are not unique UUID-v4 identities.');
  const resolveDeclaredRoot = (value) => isAbsolute(String(value ?? '')) ? resolve(String(value)) : resolve(root, String(value ?? ''));
  const installerRoot = resolveDeclaredRoot(installerExperience.evidenceRoot);
  const installationRoot = resolveDeclaredRoot(installationPreservation.evidenceRoot);
  const installedUiRoot = resolveDeclaredRoot(installedUi.evidenceRoot);
  const technicalPredecessorRoot = requireTechnicalPredecessorPreparation
    ? resolveDeclaredRoot(technicalPredecessorPreparation.evidenceRoot)
    : null;
  const expectedFinalRoot = resolve(validationRoot, 'bronze-final-delivery', finalRunId);
  check(samePath(installerRoot, resolve(validationRoot, 'installer-experience', installerExperience.runId))
    && samePath(installationRoot, resolve(validationRoot, 'windows-installed-release-uat', installationPreservation.runId))
    && samePath(installedUiRoot, resolve(installationRoot, 'installed-frontend'))
    && (!requireTechnicalPredecessorPreparation || samePath(technicalPredecessorRoot,
      resolve(validationRoot, 'windows-technical-predecessor-preparation', technicalPredecessorPreparation.runId)))
    && samePath(finalEvidenceRoot, expectedFinalRoot),
  'Final evidence roots are outside their fixed canonical validation roots.');
  const roots = [installerRoot, installationRoot, installedUiRoot, resolve(finalEvidenceRoot)];
  if (requireTechnicalPredecessorPreparation) roots.unshift(technicalPredecessorRoot);
  check(new Set(roots.map((path) => path.toLowerCase())).size === (requireTechnicalPredecessorPreparation ? 5 : 4),
    'Technical-predecessor/installer/UAT110/UAT111/final evidence roots are duplicated.');
  return Object.freeze({ technicalPredecessorRoot, installerRoot, installationRoot, installedUiRoot });
};

export const createFinalLocalTestDeliveryReceipt = (input) => {
  const {
    release, applicationVersion, packageVersion, sourceCommit, sourceProvenance,
    sourceProtection, sourceProtectionReadback, externalSourceProtectionVerification,
    gitRemoteEquality, packageProvenance, governedPreflight,
    installer, packagedRuntime, installedRuntime,
    technicalPredecessorPreparation, installerExperience, installationPreservation, installedUi, packagedProbe,
    narrationTr, narrationEn, packagedFuses, installedFuses,
    evidenceBindings, screenshotReadbacks, finalRunId, finalEvidenceRoot, finalProducer,
    technicalPredecessorReleaseLedger,
    previousPackageHistoryBundle, previousPackageArchive,
    historicalPreviousSourceProvenance, previousPackageProducerReadback
  } = input;
  check(release === `Bronze ${applicationVersion}`, 'Release/application version mismatch.');
  const versionMatch = /^(\d{2})\.(\d{2})\.(\d{4})\.(\d+)$/u.exec(applicationVersion);
  check(Boolean(versionMatch), 'Application version is invalid.');
  const [, day, month, year, sequence] = versionMatch;
  const currentSequence = Number(sequence);
  check(Number.isSafeInteger(currentSequence) && currentSequence >= 50,
    'Application sequence is outside the governed predecessor boundary.');
  const isGovernedBootstrap = currentSequence === 50;
  const isRecoveryBootstrap = currentSequence === 51;
  const isFreshInstallBootstrap = isGovernedBootstrap || isRecoveryBootstrap;
  const isTechnicalPredecessorConsumerRelease = release === 'Bronze 27.08.2026.53';
  const requiresTechnicalPredecessorPreparation = isTechnicalPredecessorConsumerRelease
    && packageVersion === '27.8.2026-53'
    && packageProvenance?.releaseId === 'bronze-2026-08-27-r53';
  check(!isTechnicalPredecessorConsumerRelease || requiresTechnicalPredecessorPreparation,
    'Technical predecessor consumer must be exact Bronze 27.08.2026.53/r53.');
  check(packageVersion === `${Number(day)}.${Number(month)}.${year}-${sequence}`,
    'Desktop package version is not bound to the application version.');
  check(/^[a-f0-9]{40,64}$/u.test(sourceCommit), 'Source commit is invalid.');
  check(sourceProtection?.schemaVersion === 2
    && sourceProtection.localReceiptStatus === 'LOCAL_RECEIPT_VERIFIED'
    && sourceProtection.backup?.scope === 'TRACKED_FILES_AT_EXACT_COMMIT'
    && sourceProtection.externalLibraryReceiptStatus === 'PASS'
    && sourceProtection.officialCompletionClaimed === true
    && sourceProtection.externalReceipt?.storageBackend === 'EXTERNAL_USB_D_DRIVE',
  'Tracked-only exact-commit source protection is not verified.');
  assertMatchingReleaseSourceProvenance(sourceProvenance, sourceProtection.sourceProvenance, 'source protection');
  check(sourceProvenance.channel === 'Bronze'
    && sourceProvenance.branch === 'channel/bronze'
    && sourceProvenance.worktreeDirectory === 'Bronze'
    && sourceProvenance.source === '06_KOD/kanallar/Bronze'
    && sourceProvenance.headCommit === sourceCommit,
  'Final delivery is not bound to the clean Bronze release worktree.');
  check(sourceProtection.backup.headCommit === sourceProvenance.headCommit
    && sourceProtection.backup.headTree === sourceProvenance.headTree
    && sourceProtection.backup.trackedCommitFingerprint?.sha256 === sourceProvenance.trackedCommitFingerprint.sha256,
  'Source backup exact-commit binding mismatch.');
  check(sourceProtectionReadback?.status === 'PASS'
    && sourceProtectionReadback.verification === 'ACTUAL_LOCAL_RECEIPT_AND_BACKUP_SIZE_SHA256_READBACK'
    && sourceProtectionReadback.receipt?.sha256 === sourceProtection.receipt.sha256
    && sourceProtectionReadback.backup?.sha256 === sourceProtection.backup.sha256
    && Number(sourceProtectionReadback.backup?.sizeBytes) === Number(sourceProtection.backup.bytes),
  'Actual local source receipt/backup readback is missing or stale.');
  check(externalSourceProtectionVerification?.status === 'PASS'
    && externalSourceProtectionVerification.requirement === 'PR-233'
    && externalSourceProtectionVerification.governanceRequirement === 'GOV-005'
    && externalSourceProtectionVerification.decision === 'DEC-267'
    && externalSourceProtectionVerification.treeSha256 === sourceProtection.treeSha256
    && samePath(externalSourceProtectionVerification.externalPath, sourceProtection.externalReceipt.externalPath)
    && Number(externalSourceProtectionVerification.files) === Number(sourceProtection.externalReceipt.finalFileCount),
  'External source-protection receipt/readback verification is missing or stale.');
  check(gitRemoteEquality?.status === 'PASS'
    && gitRemoteEquality.branch === 'main'
    && gitRemoteEquality.expectedCommit === sourceCommit
    && gitRemoteEquality.github === sourceCommit
    && gitRemoteEquality.backup === sourceCommit,
  'GitHub and external Git backup do not equal the protected source commit.');
  check(governedPreflight?.status === 'PASS'
    && governedPreflight.sourceFingerprint?.sha256 === sourceProvenance.governedSourceFingerprint.sha256
    && governedPreflight.sourceFingerprint?.fileCount === sourceProvenance.governedSourceFingerprint.fileCount,
  'Governed preflight source fingerprint is not bound to the protected commit.');
  check(packageProvenance?.schemaVersion === 2 && packageProvenance.id === 'PPT-WINDOWS-PACKAGE-PROVENANCE-V2'
    && packageProvenance.evidenceKind === 'WINDOWS_PACKAGE_PROVENANCE' && packageProvenance.status === 'PASS'
    && packageProvenance.buildMode === 'LOCAL_UNSIGNED_NSIS'
    && packageProvenance.release === release,
  'Windows package provenance is missing or invalid.');
  assertMatchingReleaseSourceProvenance(sourceProvenance, packageProvenance.sourceProvenance, 'package provenance');
  const mutationReadiness = packageProvenance.mutationReleaseReadiness;
  const dependencyClosure = mutationReadiness?.dependencyClosure;
  check(mutationReadiness?.status === 'PASS'
    && mutationReadiness.requirement === 'PR-235'
    && mutationReadiness.decision === 'DEC-270'
    && mutationReadiness.strengthenedByRequirement === 'PR-240'
    && mutationReadiness.strengthenedByDecision === 'DEC-275'
    && mutationReadiness.sourceCommit === sourceCommit
    && mutationReadiness.governedSourceFingerprintSha256 === sourceProvenance.governedSourceFingerprint.sha256
    && mutationReadiness.canonicalRuleRegistrySha256 === governedPreflight.rulesSha256
    && /^[a-f0-9]{40,64}$/u.test(mutationReadiness.baselineCommit ?? '')
    && /^[a-f0-9]{64}$/u.test(mutationReadiness.baselineReceiptSha256 ?? '')
    && Number(mutationReadiness.changedFileCount) > 0
    && Number(mutationReadiness.targetedTestsPassed) > 0
    && Number(mutationReadiness.fullRegressionTestsPassed) > 0
    && Number(mutationReadiness.sourceIntegrityFiles) > 0,
  'Package provenance has no exact-commit PR-235 mutation readiness PASS binding.');
  check(dependencyClosure?.registry?.path === 'config/change-impact-dependency-registry.json'
    && Number(dependencyClosure.registry.sizeBytes) > 0
    && SHA256_PATTERN.test(String(dependencyClosure.registry.sha256 ?? ''))
    && JSON.stringify(dependencyClosure.universalDependentRecords) === JSON.stringify(CANONICAL_UNIVERSAL_DEPENDENT_RECORDS)
    && JSON.stringify(dependencyClosure.universalAffectedVitestFiles) === JSON.stringify(CANONICAL_UNIVERSAL_AFFECTED_VITEST_FILES)
    && Array.isArray(dependencyClosure.dependentRecords)
    && Array.isArray(dependencyClosure.affectedVitestFiles)
    && JSON.stringify(dependencyClosure.dependentRecords) === JSON.stringify([...new Set(dependencyClosure.dependentRecords)].sort((a,b)=>a.localeCompare(b,'en')))
    && JSON.stringify(dependencyClosure.affectedVitestFiles) === JSON.stringify([...new Set(dependencyClosure.affectedVitestFiles)].sort((a,b)=>a.localeCompare(b,'en')))
    && CANONICAL_UNIVERSAL_DEPENDENT_RECORDS.every((path)=>dependencyClosure.dependentRecords.includes(path))
    && CANONICAL_UNIVERSAL_AFFECTED_VITEST_FILES.every((path)=>dependencyClosure.affectedVitestFiles.includes(path))
    && SHA256_PATTERN.test(String(dependencyClosure.dependentRecordBindingsSha256 ?? ''))
    && SHA256_PATTERN.test(String(dependencyClosure.affectedTestBindingsSha256 ?? '')),
  'Package provenance PR-240 dependency record/test closure is missing or weakened.');
  check(packageProvenance.sourceProtection?.sha256 === evidenceBindings?.sourceProtection?.sha256
    && Number(packageProvenance.sourceProtection?.sizeBytes) === Number(evidenceBindings?.sourceProtection?.sizeBytes),
  'Package provenance is bound to another source-protection receipt.');
  check(packageProvenance.sourceProtection?.localArtifactReadback?.status === 'PASS'
    && packageProvenance.sourceProtection.localArtifactReadback.receipt?.sha256 === sourceProtectionReadback.receipt.sha256
    && packageProvenance.sourceProtection.localArtifactReadback.backup?.sha256 === sourceProtectionReadback.backup.sha256
    && Number(packageProvenance.sourceProtection.localArtifactReadback.backup?.sizeBytes)
      === Number(sourceProtectionReadback.backup.sizeBytes),
  'Package provenance did not read back the actual local receipt and exact-commit backup.');
  for (const [label, identity] of Object.entries({ installer, packagedRuntime, installedRuntime })) {
    lowerSha256(identity.sha256, `${label} executable`);
    check(identity.sizeBytes > 0, `${label} executable is empty.`);
    check(identity.authenticodeStatus === 'NotSigned', `${label} must remain explicitly NotSigned in this local-test flow.`);
    check(identity.fileVersion === packageVersion, `${label} file version mismatch.`);
  }
  check(packagedRuntime.sha256 === installedRuntime.sha256 && packagedRuntime.sizeBytes === installedRuntime.sizeBytes,
    'Packaged and installed runtime are not byte-identical.');
  check(packageProvenance.artifacts?.installer?.sha256 === installer.sha256
    && Number(packageProvenance.artifacts?.installer?.sizeBytes) === installer.sizeBytes
    && packageProvenance.artifacts?.packagedRuntime?.sha256 === packagedRuntime.sha256
    && Number(packageProvenance.artifacts?.packagedRuntime?.sizeBytes) === packagedRuntime.sizeBytes,
  'Final executable identities are not bound to the package provenance receipt.');

  check(installerExperience?.schemaVersion === 2 && installerExperience.id === INSTALLER_EXPERIENCE_UAT_ID
    && installerExperience.evidenceKind === 'WINDOWS_INSTALLER_EXPERIENCE_UAT'
    && installerExperience.status === 'PASS' && installerExperience.exitCode === 0
    && installerExperience.release === release && installerExperience.releaseId === packageProvenance.releaseId
    && installerExperience.sourceCommit === sourceCommit
    && installerExperience.governedSourceFingerprintSha256 === sourceProvenance.governedSourceFingerprint.sha256
    && installerExperience.canonicalRuleRegistrySha256 === governedPreflight.rulesSha256,
  'Installer experience UAT exact package/source envelope is missing.');
  check(installerExperience.packageProvenance?.sha256 === evidenceBindings.packageProvenance.sha256
    && installerExperience.governedPreflight?.sha256 === evidenceBindings.governedPreflight.sha256
    && installerExperience.installer?.sha256 === installer.sha256
    && Number(installerExperience.installer?.sizeBytes) === installer.sizeBytes
    && installerExperience.window?.className === '#32770'
    && installerExperience.window?.slideCount === 3
    && installerExperience.window?.noFakeProgress === true
    && installerExperience.window?.visualContentVerified === true
    && installerExperience.cancellation?.processTreeExited === true
    && installerExperience.cancellation?.forcedCleanupRequired === false
    && installerExperience.installedPayloadSafety?.unchanged === true,
  'Installer experience behavior/cancel/payload proof is incomplete.');
  check(installerExperience.producer?.path === 'scripts/run-windows-installer-experience-uat.ps1'
    && Number(installerExperience.producer?.sizeBytes) === Number(finalProducer.installerExperience?.sizeBytes)
    && lowerSha256(installerExperience.producer?.sha256, 'Installer experience producer') === finalProducer.installerExperience?.sha256,
  'Installer experience producer identity is stale.');

  check(installationPreservation?.schemaVersion === 3 && installationPreservation.status === 'PASS'
    && installationPreservation.id === INSTALLED_RELEASE_UAT_ID
    && installationPreservation.evidenceKind === 'WINDOWS_INSTALLED_RELEASE_PRESERVATION'
    && installationPreservation.exitCode === 0
    && installationPreservation.classification === 'LOCAL_UNSIGNED_INSTALLATION_PRESERVATION_ONLY'
    && installationPreservation.release === release
    && installationPreservation.expectedReleaseId === packageProvenance.releaseId
    && installationPreservation.sourceCommit === sourceCommit,
  'Canonical Windows installed-release UAT110 identity/status mismatch.');
  if (requiresTechnicalPredecessorPreparation) {
    check(technicalPredecessorPreparation?.schemaVersion === 1
      && technicalPredecessorPreparation.id === TECHNICAL_PREDECESSOR_PREPARATION_ID
      && technicalPredecessorPreparation.evidenceKind === 'WINDOWS_TECHNICAL_PREDECESSOR_PREPARATION'
      && technicalPredecessorPreparation.status === 'PASS'
      && technicalPredecessorPreparation.exitCode === 0
      && technicalPredecessorPreparation.installationMode === 'TECHNICAL_PREDECESSOR_PREPARATION_ONLY'
      && technicalPredecessorPreparation.releaseAcceptanceClaimed === false
      && technicalPredecessorPreparation.deliveryEligible === false
      && technicalPredecessorPreparation.targetPackageDeliveryPassClaimed === false
      && technicalPredecessorPreparation.interactiveInstallerUiExercised === false
      && technicalPredecessorPreparation.applicationLaunchAttempted === false,
    'Technical predecessor preparation schema/status/false-claim boundary is stale.');
    check(technicalPredecessorPreparation.fromRelease === 'Bronze 26.08.2026.51'
      && technicalPredecessorPreparation.fromReleaseId === 'bronze-2026-08-26-r51'
      && technicalPredecessorPreparation.toRelease === 'Bronze 27.08.2026.52'
      && technicalPredecessorPreparation.toReleaseId === 'bronze-2026-08-27-r52'
      && technicalPredecessorPreparation.consumerRelease === release
      && technicalPredecessorPreparation.consumerReleaseId === packageProvenance.releaseId,
    'Technical predecessor preparation is not the exact Bronze 51/52/53 chain.');
    assertMatchingReleaseSourceProvenance(technicalPredecessorPreparation.currentSource, sourceProvenance,
      'technical predecessor current source');
    const canonicalTechnicalPredecessorProducerPath = resolve(root, 'scripts/run-windows-technical-predecessor-preparation.ps1');
    check(technicalPredecessorPreparation.currentSource?.headCommit === sourceCommit
      && isAbsolute(String(technicalPredecessorPreparation.producer?.path ?? ''))
      && samePath(technicalPredecessorPreparation.producer?.path, canonicalTechnicalPredecessorProducerPath)
      && isAbsolute(String(finalProducer.technicalPredecessor?.path ?? ''))
      && samePath(finalProducer.technicalPredecessor?.path, canonicalTechnicalPredecessorProducerPath)
      && Number(technicalPredecessorPreparation.producer?.sizeBytes) === Number(finalProducer.technicalPredecessor?.sizeBytes)
      && lowerSha256(technicalPredecessorPreparation.producer?.sha256, 'Technical predecessor producer')
        === lowerSha256(finalProducer.technicalPredecessor?.sha256, 'Live technical predecessor producer'),
    'Technical predecessor source commit or producer live readback is stale.');
    const installedSource = technicalPredecessorPreparation.installedSourceBundle;
    const targetPackage = technicalPredecessorPreparation.targetPackageBundle;
    const targetPrevious = targetPackage?.previousPackageProvenance;
    const currentPrevious = packageProvenance.previousPackageProvenance;
    check(installedSource?.release === 'Bronze 26.08.2026.51'
      && installedSource.releaseId === 'bronze-2026-08-26-r51'
      && installedSource.packageVersion === '26.8.2026-51'
      && targetPackage?.release === 'Bronze 27.08.2026.52'
      && targetPackage.releaseId === 'bronze-2026-08-27-r52'
      && targetPackage.packageVersion === '27.8.2026-52'
      && targetPrevious?.releaseId === installedSource.releaseId
      && targetPrevious?.sourceCommit === installedSource.sourceCommit
      && samePath(targetPrevious?.path, installedSource.bundle?.path)
      && Number(targetPrevious?.sizeBytes) === Number(installedSource.bundle?.sizeBytes)
      && targetPrevious?.sha256 === installedSource.bundle?.sha256,
    'Technical predecessor immutable Bronze 51/52 package lineage is stale.');
    check(currentPrevious?.release === targetPackage.release
      && currentPrevious?.releaseId === targetPackage.releaseId
      && currentPrevious?.sourceCommit === targetPackage.sourceCommit
      && samePath(currentPrevious?.path, targetPackage.bundle?.path)
      && Number(currentPrevious?.sizeBytes) === Number(targetPackage.bundle?.sizeBytes)
      && currentPrevious?.sha256 === targetPackage.bundle?.sha256,
    'Bronze 53 package is not bound to the exact technical predecessor target bundle.');
    check(technicalPredecessorPreparation.installedBefore?.fileVersion === installedSource.packageVersion
      && technicalPredecessorPreparation.installedBefore?.sha256 === installedSource.packagedRuntime?.sha256
      && Number(technicalPredecessorPreparation.installedBefore?.sizeBytes) === Number(installedSource.packagedRuntime?.sizeBytes)
      && technicalPredecessorPreparation.installer?.fileVersion === targetPackage.packageVersion
      && technicalPredecessorPreparation.installer?.sha256 === targetPackage.installer?.sha256
      && Number(technicalPredecessorPreparation.installer?.sizeBytes) === Number(targetPackage.installer?.sizeBytes)
      && technicalPredecessorPreparation.packagedRuntime?.fileVersion === targetPackage.packageVersion
      && technicalPredecessorPreparation.packagedRuntime?.sha256 === targetPackage.packagedRuntime?.sha256
      && Number(technicalPredecessorPreparation.packagedRuntime?.sizeBytes) === Number(targetPackage.packagedRuntime?.sizeBytes)
      && technicalPredecessorPreparation.installedAfter?.fileVersion === targetPackage.packageVersion
      && technicalPredecessorPreparation.installedAfter?.sha256 === targetPackage.packagedRuntime?.sha256
      && Number(technicalPredecessorPreparation.installedAfter?.sizeBytes) === Number(targetPackage.packagedRuntime?.sizeBytes),
    'Technical predecessor live Bronze 51 to Bronze 52 runtime readback is stale.');
    check(installationPreservation.installedBefore?.fileVersion === technicalPredecessorPreparation.installedAfter.fileVersion
      && installationPreservation.installedBefore?.sha256 === technicalPredecessorPreparation.installedAfter.sha256
      && Number(installationPreservation.installedBefore?.sizeBytes) === Number(technicalPredecessorPreparation.installedAfter.sizeBytes)
      && samePath(installationPreservation.installedBefore?.path, technicalPredecessorPreparation.installedAfter.path),
    'UAT110 did not begin from the exact Bronze 52 runtime prepared by the technical predecessor receipt.');
    check(technicalPredecessorPreparation.silentInstallation?.classification === 'TECHNICAL_PREDECESSOR_SILENT_INSTALL_ONLY'
      && exactArray(technicalPredecessorPreparation.silentInstallation?.arguments, ['/S'])
      && technicalPredecessorPreparation.silentInstallation?.exitCode === 0
      && technicalPredecessorPreparation.silentInstallation?.dataSelectionDialogObserved === false
      && technicalPredecessorPreparation.silentInstallation?.applicationProcessObserved === false
      && technicalPredecessorPreparation.preservation?.allUserDataContentEqualityPreserved === true
      && technicalPredecessorPreparation.preservation?.otherChannelWriteCount === 0
      && technicalPredecessorPreparation.syntheticMarker?.preservedDuringInstall === true
      && technicalPredecessorPreparation.syntheticMarker?.cleanupStatus === 'DELETED_AND_ABSENCE_READBACK_PASS'
      && technicalPredecessorPreparation.lifecycleAuthority?.targetStatus === 'REJECTED_INSTALLER_VISUAL_UAT_FAIL'
      && technicalPredecessorPreparation.lifecycleAuthority?.targetCountsAsDeliveryPass === false
      && technicalPredecessorPreparation.lifecycleAuthority?.immutablePackageHistoryRewritten === false
      && technicalPredecessorPreparation.lifecycleAuthority?.technicalPredecessorUse
        === 'SILENT_INSTALL_ONLY_NO_APPLICATION_LAUNCH_WITH_BEFORE_AFTER_DATA_AND_RUNTIME_READBACK'
      && technicalPredecessorPreparation.lifecycleAuthority?.rejectedCheckpoint === 'a5334c13'
      && isAbsolute(String(technicalPredecessorReleaseLedger?.path ?? ''))
      && samePath(technicalPredecessorReleaseLedger?.path, resolve(root, 'config/release-ledger.json'))
      && isAbsolute(String(technicalPredecessorPreparation.lifecycleAuthority?.releaseLedger?.path ?? ''))
      && samePath(technicalPredecessorPreparation.lifecycleAuthority?.releaseLedger?.path,
        technicalPredecessorReleaseLedger?.path)
      && Number(technicalPredecessorPreparation.lifecycleAuthority?.releaseLedger?.sizeBytes)
        === Number(technicalPredecessorReleaseLedger?.sizeBytes)
      && technicalPredecessorPreparation.lifecycleAuthority?.releaseLedger?.sha256
        === technicalPredecessorReleaseLedger?.sha256
      && technicalPredecessorPreparation.privacyBoundary?.existingUserFileContentsRecorded === false
      && technicalPredecessorPreparation.privacyBoundary?.existingUserFileNamesRecorded === false
      && technicalPredecessorPreparation.privacyBoundary?.receiptContainsUserContent === false
      && technicalPredecessorPreparation.knownRejectedInstallerExperience?.targetStatus
        === 'REJECTED_INSTALLER_VISUAL_UAT_FAIL'
      && technicalPredecessorPreparation.knownRejectedInstallerExperience?.checkpoint === 'a5334c13'
      && technicalPredecessorPreparation.knownRejectedInstallerExperience?.interactiveUiWasNotUsed === true
      && technicalPredecessorPreparation.knownRejectedInstallerExperience?.acceptanceOrDeliveryClaim === false
      && technicalPredecessorPreparation.handoff?.expectedConsumerReleaseId === packageProvenance.releaseId
      && technicalPredecessorPreparation.handoff?.installedRuntimeReadyForExactNormalUat110Readback === true
      && technicalPredecessorPreparation.handoff?.doesNotReplaceInstallerExperienceUat === true
      && technicalPredecessorPreparation.handoff?.doesNotReplaceInstalledReleaseUat110 === true
      && technicalPredecessorPreparation.handoff?.doesNotReplaceInstalledFrontendUat111 === true
      && technicalPredecessorPreparation.handoff?.doesNotReplaceFinalDeliveryReceipt === true,
    'Technical predecessor preservation/lifecycle/handoff proof is incomplete.');
    check(installationPreservation.technicalPredecessorPreparation?.sha256 === evidenceBindings.technicalPredecessorPreparation?.sha256
      && Number(installationPreservation.technicalPredecessorPreparation?.sizeBytes)
        === Number(evidenceBindings.technicalPredecessorPreparation?.sizeBytes)
      && samePath(installationPreservation.technicalPredecessorPreparation?.path,
        evidenceBindings.technicalPredecessorPreparation?.path),
    'UAT110 technical predecessor preparation binding is stale.');
    const technicalReadback = installationPreservation.technicalPredecessorReadback;
    const bindingMatches = (actual, expected) => samePath(actual?.path, expected?.path)
      && Number(actual?.sizeBytes) === Number(expected?.sizeBytes)
      && actual?.sha256 === expected?.sha256;
    check(technicalReadback?.status === 'PASS'
      && bindingMatches(technicalReadback.immediate?.receipt, evidenceBindings.technicalPredecessorPreparation)
      && bindingMatches(technicalReadback.final?.receipt, evidenceBindings.technicalPredecessorPreparation)
      && bindingMatches(technicalReadback.immediate?.producer, finalProducer.technicalPredecessor)
      && bindingMatches(technicalReadback.final?.producer, finalProducer.technicalPredecessor)
      && bindingMatches(technicalReadback.immediate?.releaseLedger, technicalPredecessorReleaseLedger)
      && bindingMatches(technicalReadback.final?.releaseLedger, technicalPredecessorReleaseLedger)
      && technicalReadback.immediate?.installedHandoff?.fileVersion === technicalPredecessorPreparation.installedAfter.fileVersion
      && technicalReadback.immediate?.installedHandoff?.sha256 === technicalPredecessorPreparation.installedAfter.sha256
      && Number(technicalReadback.immediate?.installedHandoff?.sizeBytes)
        === Number(technicalPredecessorPreparation.installedAfter.sizeBytes)
      && samePath(technicalReadback.immediate?.installedHandoff?.path, technicalPredecessorPreparation.installedAfter.path)
      && technicalReadback.installedHandoff?.fileVersion === technicalPredecessorPreparation.installedAfter.fileVersion
      && technicalReadback.installedHandoff?.sha256 === technicalPredecessorPreparation.installedAfter.sha256
      && Number(technicalReadback.installedHandoff?.sizeBytes)
        === Number(technicalPredecessorPreparation.installedAfter.sizeBytes)
      && samePath(technicalReadback.installedHandoff?.path, technicalPredecessorPreparation.installedAfter.path)
      && technicalReadback.consumerReleaseId === packageProvenance.releaseId
      && technicalReadback.verifiedImmediatelyBeforeInstaller === true
      && technicalReadback.verifiedAfterInstallationPhases === true,
    'UAT110 technical predecessor immediate/final live readback is stale.');
  } else {
    check((technicalPredecessorPreparation === null || technicalPredecessorPreparation === undefined)
      && (installationPreservation.technicalPredecessorPreparation === null
        || installationPreservation.technicalPredecessorPreparation === undefined)
      && (installationPreservation.technicalPredecessorReadback === null
        || installationPreservation.technicalPredecessorReadback === undefined)
      && evidenceBindings.technicalPredecessorPreparation === undefined,
    'Technical predecessor preparation evidence is allowed only for the exact Bronze 53 continuation.');
  }
  const {
    technicalPredecessorRoot: technicalPredecessorEvidenceRoot,
    installerRoot: installerEvidenceRoot,
    installationRoot: installationEvidenceRoot,
    installedUiRoot: installedUiEvidenceRoot
  } = validateFinalEvidenceRoots({
    technicalPredecessorPreparation, installerExperience, installationPreservation, installedUi,
    finalRunId, finalEvidenceRoot, requireTechnicalPredecessorPreparation: requiresTechnicalPredecessorPreparation
  });
  check(samePath(evidenceBindings.installerExperienceUat?.path, resolve(installerEvidenceRoot, 'windows-installer-experience-uat.json'))
    && samePath(evidenceBindings.installationPreservationUat110?.path, resolve(installationEvidenceRoot, 'windows-installed-release-uat110.json'))
    && samePath(evidenceBindings.installedFrontendUat111?.path, resolve(installedUiEvidenceRoot, 'installed-frontend-user-uat111.json'))
    && (!requiresTechnicalPredecessorPreparation || samePath(evidenceBindings.technicalPredecessorPreparation?.path,
      resolve(technicalPredecessorEvidenceRoot, 'windows-technical-predecessor-preparation.json'))),
  'Installer/UAT110/UAT111 receipts are copied, replayed, or outside their canonical run roots.');
  check(installationPreservation.packageProvenance?.sha256 === evidenceBindings.packageProvenance.sha256
    && installationPreservation.governedPreflight?.sha256 === evidenceBindings.governedPreflight.sha256,
  'Installed-release UAT110 package/preflight binding is stale.');
  check(installationPreservation.installerExperience?.sha256 === evidenceBindings.installerExperienceUat.sha256,
    'Installed-release UAT110 installer-experience binding is stale.');
  check(installationPreservation.producer?.path === 'scripts/run-windows-installed-release-uat.ps1'
    && Number(installationPreservation.producer?.sizeBytes) === Number(finalProducer.installedRelease?.sizeBytes)
    && lowerSha256(installationPreservation.producer?.sha256, 'Installed-release UAT110 producer') === finalProducer.installedRelease?.sha256,
  'Installed-release UAT110 producer identity is stale.');
  check(installationPreservation.installer?.sha256 === installer.sha256
    && Number(installationPreservation.installer?.sizeBytes) === installer.sizeBytes
    && installationPreservation.packagedRuntime?.sha256 === packagedRuntime.sha256
    && Number(installationPreservation.packagedRuntime?.sizeBytes) === packagedRuntime.sizeBytes,
  'Installed-release UAT110 executable identity is stale.');
  const expectedInstallationMode = isGovernedBootstrap ? 'BOOTSTRAP_FRESH_INSTALL'
    : isRecoveryBootstrap ? 'RECOVERY_BOOTSTRAP_FRESH_INSTALL' : 'CONTINUATION_N_TO_N_PLUS_ONE';
  const expectedPrimaryClassification = isGovernedBootstrap ? 'BOOTSTRAP_FRESH_INSTALL_SEQUENCE_50'
    : isRecoveryBootstrap ? 'RECOVERY_BOOTSTRAP_FRESH_INSTALL_SEQUENCE_51' : 'VERSION_UPGRADE_N_TO_N_PLUS_1';
  check(installationPreservation.installationMode === expectedInstallationMode,
    'Installed-release UAT110 mode does not match package provenance sequence semantics.');
  for (const [label, phase, classification] of [
    ['primaryInstallation', installationPreservation.primaryInstallation, expectedPrimaryClassification],
    ['maintenance', installationPreservation.maintenance, 'SAME_VERSION_MAINTENANCE']
  ]) {
    check(phase?.status === 'PASS' && phase.classification === classification
      && phase.installedEqualsPackaged === true && phase.markerPreserved === true
      && phase.allUserDataContentEqualityPreserved === true
      && phase.otherChannelAndLegacyProgramMetadataPreserved === true
      && phase.otherChannelWriteCount === 0 && phase.dataSelectionDialogObserved === false
      && phase.bronzeRegistry?.exactSingleEntry === true,
    `Canonical Windows ${label} preservation is incomplete.`);
  }
  const parseFileVersion = (value, label) => {
    const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})-(\d+)$/u.exec(String(value ?? ''));
    check(match, `${label} FileVersion is invalid.`);
    return match.slice(1).map(Number);
  };
  const to = parseFileVersion(installationPreservation.primaryInstallation?.toFileVersion, 'Primary installation to');
  check(to[3] === currentSequence && installationPreservation.primaryInstallation?.toSequence === currentSequence,
    'Installed-release UAT110 primary phase is not bound to the package sequence.');
  if (isGovernedBootstrap) {
    const parentMatch = /^Bronze (\d{2})\.(\d{2})\.(\d{4})\.(\d+)$/u.exec(String(packageProvenance.parentRelease ?? ''));
    check(parentMatch && Number(parentMatch[2]) === Number(month) && Number(parentMatch[3]) === Number(year)
      && Number(parentMatch[4]) === 49 && packageProvenance.previousPackageProvenance === null,
      'Bronze 50 package is not a governed bootstrap with null previous package provenance.');
    check(previousPackageHistoryBundle === null && previousPackageArchive === null
      && historicalPreviousSourceProvenance === null && previousPackageProducerReadback === null,
    'Bronze 50 final delivery must not receive fabricated previous package evidence.');
    check(installationPreservation.previousPackageProvenance === null
      && installationPreservation.recoveryBootstrapAuthority === null
      && installationPreservation.installedBefore === null
      && installationPreservation.upgrade === null
      && installationPreservation.freshInstall?.classification === expectedPrimaryClassification
      && installationPreservation.freshInstall?.recoveryBootstrap === false
      && JSON.stringify(installationPreservation.freshInstall) === JSON.stringify(installationPreservation.primaryInstallation),
    'Bronze 50 UAT110 does not carry the exclusive fresh-install union branch.');
    check(installationPreservation.primaryInstallation?.fromFileVersion === null
      && installationPreservation.primaryInstallation?.fromSequence === null
      && installationPreservation.primaryInstallation?.exactSuccessor === false
      && installationPreservation.primaryInstallation?.governedBootstrap === true
      && installationPreservation.primaryInstallation?.recoveryBootstrap === false
      && installationPreservation.primaryInstallation?.targetInstallRootAbsentBefore === true
      && installationPreservation.primaryInstallation?.targetExecutableAbsentBefore === true
      && installationPreservation.primaryInstallation?.bronzeUninstallRegistryAbsentBefore === true
      && installationPreservation.primaryInstallation?.packagePreviousProvenanceAbsent === true
      && installationPreservation.primaryInstallation?.before?.program?.bronze?.exists === false
      && Number(installationPreservation.primaryInstallation?.before?.uninstallRegistry?.bronze?.entryCount) === 0,
    'Bronze 50 UAT110 fresh-install absence proof is incomplete.');
  } else if (isRecoveryBootstrap) {
    const recovery = packageProvenance.previousPackageProvenance?.recoveryBootstrap;
    const parentRelease = 'Bronze 22.08.2026.50';
    check(release === 'Bronze 26.08.2026.51'
      && packageProvenance.releaseId === 'bronze-2026-08-26-r51'
      && packageProvenance.parentRelease === parentRelease
      && packageProvenance.previousPackageProvenance?.release === parentRelease
      && packageProvenance.previousPackageProvenance?.releaseId === 'bronze-2026-08-22-r50'
      && packageProvenance.previousPackageProvenance?.lineageRole === 'REJECTED_PARENT_HISTORY_ANCHOR_ONLY'
      && packageProvenance.previousPackageProvenance?.trustedInstalledPredecessor === false
      && recovery?.decision === 'RECOVERY_BOOTSTRAP_AFTER_REJECTED_50'
      && recovery?.parentStatus === 'REJECTED_INVALID_PACKAGE'
      && recovery?.currentRelease === release && recovery?.currentReleaseId === packageProvenance.releaseId
      && recovery?.parentRelease === parentRelease && recovery?.parentReleaseId === 'bronze-2026-08-22-r50'
      && Number(recovery?.currentSequence) === 51 && Number(recovery?.parentSequence) === 50
      && recovery?.releaseLedger?.path === 'config/release-ledger.json'
      && Number(recovery?.releaseLedger?.sizeBytes) > 0
      && SHA256_PATTERN.test(String(recovery?.releaseLedger?.sha256 ?? '')),
    'Bronze 51 package is not the exact authorized rejected-50 recovery bootstrap.');
    check(previousPackageHistoryBundle?.value?.schemaVersion === 1
      && previousPackageHistoryBundle.value.id === 'PPT-WINDOWS-PACKAGE-PROVENANCE-HISTORY-BUNDLE-V1'
      && previousPackageHistoryBundle.value.status === 'PASS'
      && previousPackageHistoryBundle.value.release === parentRelease
      && previousPackageHistoryBundle.value.releaseId === packageProvenance.previousPackageProvenance?.releaseId
      && previousPackageHistoryBundle.value.sourceCommit === packageProvenance.previousPackageProvenance?.sourceCommit
      && previousPackageHistoryBundle.value.channel === 'Bronze'
      && previousPackageHistoryBundle.value.version === '22.08.2026.50'
      && previousPackageHistoryBundle.value.packageVersion === '22.8.2026-50'
      && previousPackageHistoryBundle.value.producer?.path === previousPackageArchive?.value?.producer?.path
      && previousPackageHistoryBundle.value.producer?.sha256 === previousPackageArchive?.value?.producer?.sha256
      && Number(previousPackageHistoryBundle.value.producer?.sizeBytes) === Number(previousPackageArchive?.value?.producer?.sizeBytes)
      && previousPackageHistoryBundle.sha256 === packageProvenance.previousPackageProvenance?.sha256
      && Number(previousPackageHistoryBundle.sizeBytes) === Number(packageProvenance.previousPackageProvenance?.sizeBytes)
      && previousPackageHistoryBundle.value.packageProvenance?.archivePath === 'windows-package-provenance.json'
      && previousPackageHistoryBundle.value.packageProvenance?.sha256 === previousPackageArchive?.sha256
      && Number(previousPackageHistoryBundle.value.packageProvenance?.sizeBytes) === Number(previousPackageArchive?.sizeBytes),
    'Rejected Bronze 50 history bundle is not preserved as immutable recovery ancestry.');
    check(previousPackageArchive?.value?.schemaVersion === 2
      && previousPackageArchive.value.id === 'PPT-WINDOWS-PACKAGE-PROVENANCE-V2'
      && previousPackageArchive.value.evidenceKind === 'WINDOWS_PACKAGE_PROVENANCE'
      && previousPackageArchive.value.status === 'PASS'
      && previousPackageArchive.value.release === parentRelease
      && previousPackageArchive.value.releaseId === packageProvenance.previousPackageProvenance?.releaseId
      && previousPackageArchive.value.sourceProvenance?.headCommit === packageProvenance.previousPackageProvenance?.sourceCommit,
    'Rejected Bronze 50 package archive is not the exact schema-2 receipt inside its history bundle.');
    assertMatchingReleaseSourceProvenance(historicalPreviousSourceProvenance, previousPackageArchive.value.sourceProvenance,
      'recovery parent package archive source');
    check(previousPackageArchive.value.producer?.path === 'apps/desktop/scripts/run-electron-builder.mjs'
      && previousPackageArchive.value.producer?.sha256 === previousPackageProducerReadback?.sha256
      && Number(previousPackageArchive.value.producer?.sizeBytes) === Number(previousPackageProducerReadback?.sizeBytes),
    'Rejected Bronze 50 package producer blob does not match its exact historical source commit.');
    check(installationPreservation.installedBefore === null
      && installationPreservation.upgrade === null
      && installationPreservation.freshInstall?.classification === expectedPrimaryClassification
      && JSON.stringify(installationPreservation.freshInstall) === JSON.stringify(installationPreservation.primaryInstallation),
    'Bronze 51 UAT110 does not carry the exclusive recovery fresh-install union branch.');
    check(installationPreservation.previousPackageProvenance?.path === packageProvenance.previousPackageProvenance?.path
      && Number(installationPreservation.previousPackageProvenance?.sizeBytes) === Number(packageProvenance.previousPackageProvenance?.sizeBytes)
      && installationPreservation.previousPackageProvenance?.sha256 === packageProvenance.previousPackageProvenance?.sha256
      && JSON.stringify(installationPreservation.recoveryBootstrapAuthority) === JSON.stringify(recovery),
    'Bronze 51 UAT110 is not bound to the immutable rejected-parent bundle and release-ledger authority.');
    check(installationPreservation.primaryInstallation?.fromFileVersion === null
      && installationPreservation.primaryInstallation?.fromSequence === null
      && installationPreservation.primaryInstallation?.exactSuccessor === false
      && installationPreservation.primaryInstallation?.governedBootstrap === false
      && installationPreservation.primaryInstallation?.recoveryBootstrap === true
      && installationPreservation.primaryInstallation?.targetInstallRootAbsentBefore === true
      && installationPreservation.primaryInstallation?.targetExecutableAbsentBefore === true
      && installationPreservation.primaryInstallation?.bronzeUninstallRegistryAbsentBefore === true
      && installationPreservation.primaryInstallation?.packagePreviousProvenanceAbsent === false
      && installationPreservation.primaryInstallation?.before?.program?.bronze?.exists === false
      && Number(installationPreservation.primaryInstallation?.before?.uninstallRegistry?.bronze?.entryCount) === 0,
    'Bronze 51 UAT110 recovery fresh-install absence proof is incomplete.');
  } else {
    check(installationPreservation.recoveryBootstrapAuthority === null
      && installationPreservation.freshInstall === null
      && installationPreservation.upgrade?.classification === expectedPrimaryClassification
      && installationPreservation.primaryInstallation?.recoveryBootstrap === false
      && installationPreservation.upgrade?.recoveryBootstrap === false
      && JSON.stringify(installationPreservation.upgrade) === JSON.stringify(installationPreservation.primaryInstallation),
    'Bronze 52+ UAT110 does not carry the exclusive continuation union branch.');
    const from = parseFileVersion(installationPreservation.upgrade?.fromFileVersion, 'Upgrade from');
    const parentRelease = `Bronze ${String(from[0]).padStart(2, '0')}.${String(from[1]).padStart(2, '0')}.${from[2]}.${from[3]}`;
    check(previousPackageHistoryBundle?.value?.schemaVersion === 1
      && previousPackageHistoryBundle.value.id === 'PPT-WINDOWS-PACKAGE-PROVENANCE-HISTORY-BUNDLE-V1'
      && previousPackageHistoryBundle.value.status === 'PASS'
      && previousPackageHistoryBundle.value.release === parentRelease
      && previousPackageHistoryBundle.value.releaseId === packageProvenance.previousPackageProvenance?.releaseId
      && previousPackageHistoryBundle.value.sourceCommit === packageProvenance.previousPackageProvenance?.sourceCommit
      && previousPackageHistoryBundle.value.channel === 'Bronze'
      && previousPackageHistoryBundle.value.version === parentRelease.replace(/^Bronze /u, '')
      && previousPackageHistoryBundle.value.packageVersion === `${from[0]}.${from[1]}.${from[2]}-${from[3]}`
      && previousPackageHistoryBundle.value.producer?.path === previousPackageArchive?.value?.producer?.path
      && previousPackageHistoryBundle.value.producer?.sha256 === previousPackageArchive?.value?.producer?.sha256
      && Number(previousPackageHistoryBundle.value.producer?.sizeBytes) === Number(previousPackageArchive?.value?.producer?.sizeBytes)
      && previousPackageHistoryBundle.sha256 === packageProvenance.previousPackageProvenance?.sha256
      && Number(previousPackageHistoryBundle.sizeBytes) === Number(packageProvenance.previousPackageProvenance?.sizeBytes)
      && previousPackageHistoryBundle.value.packageProvenance?.archivePath === 'windows-package-provenance.json'
      && previousPackageHistoryBundle.value.packageProvenance?.sha256 === previousPackageArchive?.sha256
      && Number(previousPackageHistoryBundle.value.packageProvenance?.sizeBytes) === Number(previousPackageArchive?.sizeBytes),
    'Previous package provenance history bundle is not the immutable exact-parent binding.');
    check(previousPackageArchive?.value?.schemaVersion === 2
      && previousPackageArchive.value.id === 'PPT-WINDOWS-PACKAGE-PROVENANCE-V2'
      && previousPackageArchive.value.evidenceKind === 'WINDOWS_PACKAGE_PROVENANCE'
      && previousPackageArchive.value.status === 'PASS'
      && previousPackageArchive.value.release === parentRelease
      && previousPackageArchive.value.releaseId === packageProvenance.previousPackageProvenance?.releaseId
      && previousPackageArchive.value.sourceProvenance?.headCommit === packageProvenance.previousPackageProvenance?.sourceCommit
      && previousPackageArchive.value.artifacts?.packagedRuntime?.sha256 === packageProvenance.previousPackageProvenance?.packagedRuntime?.sha256
      && Number(previousPackageArchive.value.artifacts?.packagedRuntime?.sizeBytes) === Number(packageProvenance.previousPackageProvenance?.packagedRuntime?.sizeBytes),
    'Previous package provenance archive is not the exact schema-2 receipt inside its history bundle.');
    assertMatchingReleaseSourceProvenance(historicalPreviousSourceProvenance, previousPackageArchive.value.sourceProvenance, 'previous package archive source');
    check(previousPackageArchive.value.producer?.path === 'apps/desktop/scripts/run-electron-builder.mjs'
      && previousPackageArchive.value.producer?.sha256 === previousPackageProducerReadback?.sha256
      && Number(previousPackageArchive.value.producer?.sizeBytes) === Number(previousPackageProducerReadback?.sizeBytes),
    'Previous package provenance producer blob does not match its exact historical source commit.');
    check(from[1] === to[1] && from[2] === to[2]
      && Date.UTC(to[2], to[1] - 1, to[0]) >= Date.UTC(from[2], from[1] - 1, from[0])
      && to[3] === from[3] + 1 && packageProvenance.parentRelease === parentRelease
      && packageProvenance.previousPackageProvenance?.release === parentRelease
      && installationPreservation.installedBefore?.fileVersion === installationPreservation.upgrade?.fromFileVersion
      && installationPreservation.installedBefore?.fileVersion === previousPackageHistoryBundle.value.packageVersion
      && installationPreservation.installedBefore?.sha256 === previousPackageArchive.value.artifacts?.packagedRuntime?.sha256
      && Number(installationPreservation.installedBefore?.sizeBytes) === Number(previousPackageArchive.value.artifacts?.packagedRuntime?.sizeBytes)
      && installationPreservation.previousPackageProvenance?.path === packageProvenance.previousPackageProvenance?.path
      && Number(installationPreservation.previousPackageProvenance?.sizeBytes) === Number(packageProvenance.previousPackageProvenance?.sizeBytes)
      && installationPreservation.previousPackageProvenance?.sha256 === packageProvenance.previousPackageProvenance?.sha256,
    'Installed-release UAT110 is not a lineage-bound same-month N to N+1 upgrade.');
  }
  check(installationPreservation.maintenance?.sameVersion === true
    && installationPreservation.maintenance?.beforeFileVersion === installationPreservation.maintenance?.afterFileVersion
    && installationPreservation.maintenance?.beforeFileVersion === installationPreservation.primaryInstallation?.toFileVersion
    && installationPreservation.maintenance?.precedingPhase === expectedPrimaryClassification,
  'Installed-release UAT110 maintenance phase is not exact same-version maintenance after its primary phase.');
  check(installationPreservation.privacyBoundary?.existingUserFileContentsHashedForEquality === true
    && installationPreservation.privacyBoundary?.existingUserFileContentsRecorded === false
    && installationPreservation.privacyBoundary?.existingUserFileNamesRecorded === false
    && installationPreservation.privacyBoundary?.receiptContainsUserContent === false
    && installationPreservation.privacyBoundary?.contentEqualityMeasured === true,
  'Installed-release UAT110 privacy boundary is unsafe.');
  check(installationPreservation.cleanup?.markerDeleted === true
    && installationPreservation.cleanup?.markerAbsentReadback === true
    && installationPreservation.cleanup?.originalUserDataStateRestored === true
    && installationPreservation.syntheticMarker?.cleanupStatus === 'DELETED_AND_ABSENCE_READBACK_PASS',
  'Installed-release UAT110 marker cleanup/absence readback is incomplete.');

  check(packagedProbe?.schemaVersion === 3 && packagedProbe.status === 'PASS'
    && packagedProbe.mode === 'packaged' && packagedProbe.diagnosticMode === false
    && packagedProbe.securityExceptions?.length === 0 && packagedProbe.applicationVersion === applicationVersion,
  'Packaged launch probe classification/version mismatch.');
  check(packagedProbe.executableIdentity?.unchangedAcrossLaunches === true
    && samePath(packagedProbe.executableIdentity?.path, packagedRuntime.fullPath)
    && packagedProbe.executableIdentity?.sha256 === packagedRuntime.sha256
    && packagedProbe.executableIdentity?.sha256 === packagedProbe.executableIdentity?.before?.sha256
    && packagedProbe.executableIdentity?.sha256 === packagedProbe.executableIdentity?.after?.sha256
    && Number(packagedProbe.executableIdentity?.sizeBytes) === packagedRuntime.sizeBytes,
  'Packaged launch probe executable identity is not bound to the final runtime.');
  check(packagedProbe.runs?.length === 2 && packagedProbe.runs.every((run) =>
    run.status === 'PASS' && run.applicationVersion === applicationVersion
  ), 'Packaged launch probe did not complete two exact-version runs.');
  check(packagedProbe.sameUserDataAcrossRuns === true
    && packagedProbe.dpapiCrossProcessPersistence === 'PASS'
    && packagedProbe.rendererSandboxPolicy === 'PASS'
    && packagedProbe.windowsEfsRuntime === 'PASS'
    && packagedProbe.windowsSafeStorageDpapiRuntime === 'PASS'
    && packagedProbe.protectedSideArtifactWindowsRuntime === 'PASS',
  'Packaged runtime security persistence evidence is incomplete.');

  check(installedUi?.schemaVersion === 3 && installedUi.id === INSTALLED_FRONTEND_UAT_ID
    && installedUi.evidenceKind === 'INSTALLED_FRONTEND_USER_UAT'
    && installedUi.status === 'PASS' && installedUi.exitCode === 0
    && installedUi.release === release && installedUi.runtimeKind === 'INSTALLED_EXECUTABLE'
    && samePath(installedUi.executable, installedRuntime.fullPath)
    && installedUi.installedFileVersion === packageVersion,
  'Installed UI UAT identity/version mismatch.');
  check(installedUi.sourceCommit === sourceCommit
    && installedUi.governedSourceFingerprintSha256 === sourceProvenance.governedSourceFingerprint.sha256
    && installedUi.canonicalRuleRegistrySha256 === governedPreflight.rulesSha256
    && installedUi.packageProvenanceSha256 === evidenceBindings.packageProvenance.sha256,
  'Installed UI UAT is stale or not bound to the exact package/source commit.');
  check(installedUi.executableIdentity?.sha256 === installedRuntime.sha256
    && Number(installedUi.executableIdentity?.sizeBytes) === installedRuntime.sizeBytes
    && installedUi.executableIdentity?.fileVersion === installedRuntime.fileVersion
    && installedUi.receiptBindings?.executableIdentityVerified === true,
  'Installed UI UAT executable live identity is stale.');
  check(installedUi.releaseId === packageProvenance.releaseId
    && installedUi.receiptBindings?.installationPreservationSha256 === evidenceBindings.installationPreservationUat110.sha256
    && installedUi.receiptBindings?.packageProvenanceSha256 === evidenceBindings.packageProvenance.sha256,
  'Installed UI UAT is not bound to canonical UAT110/package release identity.');
  check(installedUi.parentRunId === installationPreservation.runId
    && installedUi.runId !== installationPreservation.runId
    && installedUi.producer?.path === 'scripts/run-installed-frontend-user-uat.mjs'
    && Number(installedUi.producer?.sizeBytes) === Number(finalProducer.installedUi?.sizeBytes)
    && lowerSha256(installedUi.producer?.sha256, 'Installed UI producer') === lowerSha256(finalProducer.installedUi?.sha256, 'Live installed UI producer'),
  'Installed UI UAT run/producer identity is stale.');
  check(installedUi.passwordRecorded === false && installedUi.twoFactorSecretRecorded === false
    && installedUi.recoveryCodesRecorded === false
    && installedUi.containsUnredactedAuthenticationSecrets === false
    && installedUi.secretAudit?.unknownSecretLikeFieldCount === 0
    && installedUi.secretAudit?.sensitiveScreenshotCount === 0
    && installedUi.secretAudit?.unredactedSecretCount === 0
    && installedUi.secretAudit?.receiptContainsAuthenticationSecret === false,
  'Installed UI UAT contains or records authentication secrets.');
  check(installedUi.generatedAt === installedUi.completedAt
    && installedUi.profileDisposition?.status === 'DELETED_AND_ABSENCE_READBACK_PASS'
    && installedUi.profileDisposition?.profilePathRecorded === false
    && installedUi.profileDisposition?.absenceReadbackVerified === true
    && installedUi.profileDisposition?.excludeFromSourceBackup === true
    && installedUi.profileDisposition?.excludeFromExternalBackup === true
    && installedUi.receiptBindings?.profileCleanupOrQuarantineVerified === true
    && installedUi.receiptBindings?.profileCleanupAbsenceReadbackVerified === true,
  'Installed UI disposable profile deletion/absence readback is incomplete.');
  const uiChecks = installedUi.checks ?? {};
  check(uiChecks.firstRunIntroductionVisible === true && uiChecks.familyCreatedThroughVisibleForm === true
    && uiChecks.twoFactorStartedThroughVisibleButton === true && uiChecks.twoFactorCompletedThroughVisibleForm === true
    && uiChecks.currentDeviceTrustedThroughVisibleForm === true && uiChecks.authenticatedMainShellVisible === true,
  'Installed UI first-family/security journey is incomplete.');
  const installedUiCoverage = validateInstalledUiDynamicCoverage(uiChecks, {
    installedUiEvidenceRoot,
    nativeScreenshotReadbacks: screenshotReadbacks?.nativeDialog,
    installedRuntimeSha256: installedRuntime.sha256
  });
  check(installedUi.receiptBindings?.screenshotReadbackVerified === true
    && installedUi.receiptBindings?.screenshotRequiredSetVerified === true,
  'Installed UI screenshot readback is incomplete.');
  const installerScreenshots = assertExactScreenshotSet({
    artifacts: installerExperience.screenshots,
    expectedNames: INSTALLER_SCREENSHOT_NAMES,
    readbacks: screenshotReadbacks?.installer,
    label: 'Installer experience'
  });
  const installerSlideSpecs = [
    ['family-space', 'Ailenizi oluşturalım'],
    ['local-privacy', 'Bilgileriniz bu bilgisayarda kalır'],
    ['narrated-guidance', 'Rehberli ve erişilebilir bir karşılama']
  ];
  check(installerExperience.screenshots.every((screenshot) => screenshot.visualContentStatus === 'PASS'
    && Number.isSafeInteger(screenshot.captureAttempts) && screenshot.captureAttempts >= 1 && screenshot.captureAttempts <= 3
    && Number.isSafeInteger(screenshot.printWindowFlags) && screenshot.printWindowFlags === 2
    && Number.isSafeInteger(screenshot.width) && screenshot.width > 0
    && Number.isSafeInteger(screenshot.height) && screenshot.height > 0
    && Number.isSafeInteger(screenshot.contentRegion?.left) && screenshot.contentRegion.left >= 0
    && Number.isSafeInteger(screenshot.contentRegion?.top) && screenshot.contentRegion.top >= 0
    && Number.isSafeInteger(screenshot.contentRegion?.width) && screenshot.contentRegion.width >= 24
    && Number.isSafeInteger(screenshot.contentRegion?.height) && screenshot.contentRegion.height >= 12
    && screenshot.contentRegion.left + screenshot.contentRegion.width <= screenshot.width
    && screenshot.contentRegion.top + screenshot.contentRegion.height <= screenshot.height
    && Number.isSafeInteger(screenshot.backgroundSampleCount) && screenshot.backgroundSampleCount === 8
    && Number.isSafeInteger(screenshot.contentContrastPixelCount) && screenshot.contentContrastPixelCount >= 40
    && Number.isSafeInteger(screenshot.contentOccupiedRows) && screenshot.contentOccupiedRows >= 6
    && Number.isSafeInteger(screenshot.contentOccupiedColumns) && screenshot.contentOccupiedColumns >= 12
    && Number.isSafeInteger(screenshot.contentDarkPixelCount) && screenshot.contentDarkPixelCount >= 40
    && Number.isSafeInteger(screenshot.contentDarkOccupiedRows) && screenshot.contentDarkOccupiedRows >= 6
    && Number.isSafeInteger(screenshot.contentDarkOccupiedColumns) && screenshot.contentDarkOccupiedColumns >= 12),
  'Installer screenshot title-region pixel proof is missing or visually blank.');
  check(Array.isArray(installerExperience.window?.slides)
    && installerExperience.window.slides.length === installerSlideSpecs.length
    && installerExperience.window.slides.every((slide, index) => slide.id === installerSlideSpecs[index][0]
      && slide.title === installerSlideSpecs[index][1]
      && slide.screenshot === installerExperience.screenshots[index].path
      && slide.screenshotSha256 === installerScreenshots.hashes[index]
      && slide.visibleProgressBarCount === 0),
  'Installer slide screenshot/title matrix is not canonical.');
  const installedUiScreenshots = assertExactScreenshotSet({
    artifacts: installedUi.screenshotArtifacts,
    expectedNames: INSTALLED_UI_SCREENSHOT_NAMES,
    readbacks: screenshotReadbacks?.installedUi,
    label: 'Installed UI',
    stressPrefix: 'stress-'
  });
  check(installedUi.screenshotArtifactCount === INSTALLED_UI_SCREENSHOT_NAMES.length
    && exactArray(installedUi.screenshots, installedUi.screenshotArtifacts.map((artifact) => artifact.relativePath))
    && exactArray(installedUi.receiptBindings?.expectedScreenshotNames, INSTALLED_UI_SCREENSHOT_NAMES)
    && installedUi.receiptBindings?.screenshotManifestSha256 === canonicalJsonSha256(installedUi.screenshotArtifacts)
    && installedUi.screenshotArtifacts.every((artifact) => artifact.readbackVerified === true
      && artifact.secretScanApplied === true && artifact.unredactedSecretCount === 0
      && Number.isSafeInteger(artifact.secretRedactionCount) && artifact.secretRedactionCount >= 0
      && Array.isArray(artifact.secretCategories)
      && artifact.secretSurfaceScan?.status === 'PASS'
      && artifact.secretSurfaceScan.rawSurfaceTextRecorded === false
      && Number.isInteger(artifact.secretSurfaceScan.canvasCount) && artifact.secretSurfaceScan.canvasCount >= 0
      && Array.isArray(artifact.secretSurfaceScan.canvasFingerprints)
      && artifact.secretSurfaceScan.canvasFingerprints.length === artifact.secretSurfaceScan.canvasCount
      && artifact.secretSurfaceScan.canvasFingerprints.every((item) => typeof item.readable === 'boolean'
        && SHA256_PATTERN.test(String(item.sha256 ?? '')))
      && ['domText', 'formValues', 'attributes', 'pseudoContent', 'backgroundContent', 'canvasFallback'].every((category) =>
        artifact.secretSurfaceScan.categories?.[category]?.status === 'PASS'
        && artifact.secretSurfaceScan.categories[category].findingCount === 0)
      && (artifact.physicalPixelOcr?.status === 'PASS_PHYSICAL_PIXEL_OCR'
        ? artifact.physicalPixelOcr.engine === 'TESSERACT'
          && artifact.physicalPixelOcr.findingCount === 0
          && artifact.physicalPixelOcr.physicalPixelSecretClaimed === true
          && artifact.physicalPixelOcr.ocrTextRecorded === false
          && SHA256_PATTERN.test(String(artifact.physicalPixelOcr.ocrTextSha256 ?? ''))
        : artifact.physicalPixelOcr?.status === 'NOT_RUN_PHYSICAL_PIXEL_OCR'
          && artifact.physicalPixelOcr.reason === 'TESSERACT_NOT_AVAILABLE'
          && artifact.physicalPixelOcr.physicalPixelSecretClaimed === false
          && artifact.physicalPixelOcr.ocrTextRecorded === false)),
  'Installed UI screenshot manifest/readback/secret-scan envelope is incomplete.');
  const physicalPixelOcrPassCount = installedUi.screenshotArtifacts.filter((artifact) =>
    artifact.physicalPixelOcr.status === 'PASS_PHYSICAL_PIXEL_OCR').length;
  const physicalPixelOcrNotRunCount = installedUi.screenshotArtifacts.length - physicalPixelOcrPassCount;
  if (requiresTechnicalPredecessorPreparation) {
    assertNoSecretBearingEvidence(technicalPredecessorPreparation, 'Technical predecessor preparation');
  }
  assertNoSecretBearingEvidence(installerExperience, 'Installer experience UAT');
  assertNoSecretBearingEvidence(installationPreservation, 'Installed-release UAT110');
  assertNoSecretBearingEvidence(installedUi, 'Installed UI UAT111');

  const installerStartedAt = isoMillis(installerExperience.startedAt, 'installerExperience.startedAt');
  const installerCompletedAt = isoMillis(installerExperience.completedAt, 'installerExperience.completedAt');
  const installationStartedAt = isoMillis(installationPreservation.startedAt, 'installationPreservation.startedAt');
  const installationAt = isoMillis(installationPreservation.generatedAt, 'installationPreservation.generatedAt');
  const packagedProbeAt = isoMillis(packagedProbe.generatedAt, 'packagedProbe.generatedAt');
  const installedUiStartedAt = isoMillis(installedUi.startedAt, 'installedUi.startedAt');
  const installedUiCompletedAt = isoMillis(installedUi.completedAt, 'installedUi.completedAt');
  const packageGeneratedAt = isoMillis(packageProvenance.generatedAt, 'packageProvenance.generatedAt');
  const finalGeneratedAt = new Date().toISOString();
  const finalGeneratedMillis = isoMillis(finalGeneratedAt, 'final.generatedAt');
  const technicalPredecessorStartedAt = requiresTechnicalPredecessorPreparation
    ? isoMillis(technicalPredecessorPreparation.startedAt, 'technicalPredecessorPreparation.startedAt')
    : null;
  const technicalPredecessorCompletedAt = requiresTechnicalPredecessorPreparation
    ? isoMillis(technicalPredecessorPreparation.completedAt, 'technicalPredecessorPreparation.completedAt')
    : null;
  check((!requiresTechnicalPredecessorPreparation
      || (technicalPredecessorStartedAt < technicalPredecessorCompletedAt
        && technicalPredecessorCompletedAt <= installationStartedAt))
    && packageGeneratedAt < installerStartedAt && installerStartedAt <= installerCompletedAt
    && installerCompletedAt < installationStartedAt && installationStartedAt <= installationAt
    && installationAt <= installedUiStartedAt && installedUiStartedAt <= installedUiCompletedAt
    && installedUiCompletedAt < finalGeneratedMillis
    && packageGeneratedAt <= packagedProbeAt && packagedProbeAt <= installedUiStartedAt,
    'Final UAT chronology is invalid.');
  check(installerExperience.generatedAt === installerExperience.completedAt
    && installationPreservation.startedAt !== installationPreservation.completedAt
    && installationAt >= isoMillis(installationPreservation.completedAt, 'installationPreservation.completedAt')
    && finalGeneratedMillis - packageGeneratedAt <= 7 * 24 * 60 * 60 * 1000,
  'Final UAT evidence is stale or has a self-inconsistent completion timestamp.');

  check(packagedFuses.fuses.EnableNodeCliInspectArguments === false
    && installedFuses.fuses.EnableNodeCliInspectArguments === false,
  'CLI inspector fuse must remain disabled.');

  return Object.freeze({
    schemaVersion: FINAL_LOCAL_TEST_DELIVERY_SCHEMA_VERSION,
    id: FINAL_LOCAL_TEST_DELIVERY_ID,
    evidenceKind: 'BRONZE_FINAL_LOCAL_TEST_DELIVERY',
    runId: finalRunId,
    evidenceRoot: finalEvidenceRoot,
    producer: finalProducer.final,
    release,
    applicationVersion,
    packageVersion,
    sourceCommit,
    sourceProvenance,
    sourceProtection: {
      status: 'PASS', schemaVersion: sourceProtection.schemaVersion,
      backupScope: sourceProtection.backup.scope,
      treeSha256: sourceProtection.treeSha256,
      receipt: sourceProtection.receipt,
      backup: sourceProtection.backup,
      localReadback: sourceProtectionReadback,
      externalReadback: {
        status: 'PASS',
        path: sourceProtection.externalReceipt.path,
        readbackPath: sourceProtection.externalReceipt.readbackPath,
        externalPath: sourceProtection.externalReceipt.externalPath,
        files: externalSourceProtectionVerification.files
      }
    },
    gitRemoteEquality,
    packageProvenance: {
      status: 'PASS', schemaVersion: packageProvenance.schemaVersion,
      buildMode: packageProvenance.buildMode,
      generatedAt: packageProvenance.generatedAt,
      mutationReleaseReadiness: mutationReadiness
    },
    governedPreflight: {
      status: 'PASS', sourceFingerprint: governedPreflight.sourceFingerprint,
      rulesSha256: governedPreflight.rulesSha256
    },
    classification: LOCAL_TEST_CLASSIFICATION,
    status: LOCAL_TEST_STATUS,
    generatedAt: finalGeneratedAt,
    installer: { ...installer, fullPath: undefined, productionReleaseEligible: false },
    packagedRuntime: { ...packagedRuntime, fullPath: undefined },
    installedRuntime: { ...installedRuntime, fullPath: undefined, exactPackagedMatch: true },
    evidenceBindings,
    screenshotReadbacks,
    ...(requiresTechnicalPredecessorPreparation ? {
      technicalPredecessorPreparation: {
        status: 'PASS', id: TECHNICAL_PREDECESSOR_PREPARATION_ID,
        runId: technicalPredecessorPreparation.runId,
        fromRelease: technicalPredecessorPreparation.fromRelease,
        toRelease: technicalPredecessorPreparation.toRelease,
        consumerRelease: technicalPredecessorPreparation.consumerRelease,
        sourceCommit: technicalPredecessorPreparation.currentSource.headCommit,
        producer: finalProducer.technicalPredecessor,
        receipt: evidenceBindings.technicalPredecessorPreparation,
        targetPackageBundle: technicalPredecessorPreparation.targetPackageBundle.bundle,
        installedAfter: technicalPredecessorPreparation.installedAfter,
        releaseAcceptanceClaimed: false,
        deliveryEligible: false,
        targetPackageDeliveryPassClaimed: false
      }
    } : {}),
    installerExperience: {
      status: 'PASS', id: INSTALLER_EXPERIENCE_UAT_ID, runId: installerExperience.runId,
      slideCount: 3, noFakeProgress: true, safeCancellation: 'PASS',
      receiptSha256: evidenceBindings.installerExperienceUat.sha256
    },
    windowsInstalledReleaseUat: {
      status: 'PASS', id: INSTALLED_RELEASE_UAT_ID,
      expectedReleaseId: installationPreservation.expectedReleaseId,
      installationMode: expectedInstallationMode,
       freshInstall: isFreshInstallBootstrap ? 'PASS' : 'NOT_APPLICABLE',
       upgrade: isFreshInstallBootstrap ? 'NOT_APPLICABLE' : 'PASS',
       recoveryBootstrap: isRecoveryBootstrap ? 'PASS' : 'NOT_APPLICABLE',
      sameVersionMaintenance: 'PASS', metadataOnlyUserDataInspection: true,
      markerPreserved: true, otherChannelWrites: 0,
      receiptSha256: evidenceBindings.installationPreservationUat110.sha256
    },
    packagedLaunch: {
      status: 'PASS', runs: 2, executableSha256: packagedRuntime.sha256,
      executableUnchangedAcrossLaunches: true, dpapiCrossProcessPersistence: 'PASS',
      windowsEfsRuntime: 'PASS', rendererSandboxPolicy: 'PASS'
    },
    installedFrontendUat: {
      status: 'PASS', navigationRoutes: installedUiCoverage.routeCount,
      moduleMenus: uiChecks.moduleMenuCount, clickedInteractions: installedUiCoverage.clicked,
      blockedInteractions: installedUiCoverage.blocked, deferredInteractions: installedUiCoverage.deferred,
      visualAudits: installedUiCoverage.visualAuditCount, unexpectedRendererExceptions: 0,
      failedResources: 0, mainProcessExceptionsReported: 0, screenshotReadback: 'PASS',
      sourceCommit, packageProvenanceSha256: evidenceBindings.packageProvenance.sha256,
      freshAfterPackage: true
    },
    screenshotSecretInspectionBoundary: {
      status: 'PASS',
      domRedactionAndReceiptValueScan: true,
      physicalPixelOcrPassCount,
      physicalPixelOcrNotRunCount,
      ocrCoverage: physicalPixelOcrNotRunCount === 0 ? 'ALL_SCREENSHOTS_PASS_PHYSICAL_PIXEL_OCR' : 'PARTIAL_OR_NOT_RUN',
      claimBoundary: physicalPixelOcrNotRunCount === 0
        ? 'ALL_SCREENSHOTS_OCR_SCANNED_ZERO_SECRET_FINDINGS'
        : 'NO_GLOBAL_PIXEL_LEVEL_SECRET_ABSENCE_CLAIM'
    },
    narrationSynthesis: {
      status: 'PASS', claimBoundary: NARRATION_CLAIM_BOUNDARY,
      humanAudibility: 'NOT_PROVEN_BY_AUTOMATION', tr: narrationTr, en: narrationEn
    },
    electronFuses: { status: 'PASS', packaged: packagedFuses, installed: installedFuses },
    mainInspectorBoundary: {
      inspectorUsed: false,
      reason: 'PACKAGED_FUSE_DISABLES_CLI_INSPECT',
      uatMainProcessExceptionClaim: 'HARNESS_REPORTED_ZERO_NOT_INSPECTOR_PROVEN'
    },
    antivirusBoundary: {
      product: 'Kaspersky Premium',
      userReportedDetection: 'PDM:Trojan.Win32.Generic',
      detectedArtifactHashBound: false,
      protectionEnabledSignedRetest: 'NOT_RUN',
      falsePositiveConclusion: 'NOT_ESTABLISHED',
      resolutionStatus: 'UNRESOLVED_RELEASE_BLOCKER'
    },
    productionRelease: {
      eligible: false,
      blockers: ['AUTHENTICODE_NOT_SIGNED', 'KASPERSKY_PROTECTION_ENABLED_SIGNED_RETEST_NOT_RUN']
    }
  });
};

const readSourceVersion = async () => {
  const [appMeta, rootManifest, desktopManifest, releaseLedger, repositoryMetadata] = await Promise.all([
    readFile(resolve(root, 'packages/domain/src/app-meta.ts'), 'utf8'),
    readFile(resolve(root, 'package.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, 'apps/desktop/package.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, 'config/release-ledger.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, 'repository-metadata.json'), 'utf8').then(JSON.parse)
  ]);
  const current = assertPreallocatedReleaseIdentity({
    expectedReleaseId: releaseLedger.current?.releaseId,
    ledger: releaseLedger,
    rootManifest,
    desktopManifest,
    repositoryMetadata,
    appMeta
  });
  return { applicationVersion: current.version, packageVersion: current.packageVersion };
};

const readWaveIdentity = async (binding, id) => {
  const wavePath = binding.value?.wave?.path;
  check(typeof wavePath === 'string' && isAbsolute(wavePath), `${id} wave path must be absolute.`);
  const item = await lstat(wavePath);
  check(item.isFile() && !item.isSymbolicLink(), `${id} wave must be a regular non-link file.`);
  const bytes = await readFile(wavePath);
  return Object.freeze({ path: portablePath(wavePath), sizeBytes: bytes.length, sha256: sha256Bytes(bytes) });
};

const runExternalSourceProtectionVerification = (sourceProvenance, sourceProtection) => {
  const result = spawnSync(process.execPath, ['scripts/protect-authoritative-source-external.mjs', 'verify'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });
  check(result.status === 0,
    `External source protection verification failed: ${result.stderr || result.stdout}`);
  let evidence;
  try { evidence = JSON.parse(result.stdout.trim()); }
  catch { fail('External source protection verification returned invalid JSON.'); }
  check(evidence.status === 'PASS'
    && evidence.treeSha256 === sourceProvenance.trackedCommitFingerprint.sha256
    && evidence.treeSha256 === sourceProtection.treeSha256,
  'External source protection verification is bound to another source tree.');
  return Object.freeze(evidence);
};

const readRemoteMain = (remote) => {
  const result = spawnSync('git', ['-c', `safe.directory=${root}`, 'ls-remote', '--heads', remote, 'main'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });
  check(result.status === 0, `${remote} main could not be read: ${result.stderr || result.stdout}`);
  const commit = /^([a-f0-9]{40,64})\s+refs\/heads\/main$/u.exec(result.stdout.trim())?.[1];
  check(Boolean(commit), `${remote} main identity is invalid or missing.`);
  return commit;
};

const verifyGitRemoteEquality = (sourceCommit) => {
  const github = readRemoteMain('github');
  const backup = readRemoteMain('backup');
  check(github === sourceCommit && backup === sourceCommit,
    'GitHub and external Git backup main must equal the protected source commit.');
  return Object.freeze({ status: 'PASS', branch: 'main', expectedCommit: sourceCommit, github, backup });
};

const pathIsAbsent = async (path) => {
  try {
    await lstat(path);
    return false;
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return true;
    throw error;
  }
};

const assertDirectoryChainNoReparse = async (boundary, target, label) => {
  const boundaryPath = resolve(boundary);
  const targetPath = resolve(target);
  const local = relative(boundaryPath, targetPath);
  check(local === '' || (local !== '..' && !local.startsWith(`..${sep}`) && !isAbsolute(local)),
    `${label} escapes its canonical boundary.`);
  let cursor = boundaryPath;
  for (const segment of ['', ...local.split(/[\\/]/u).filter(Boolean)]) {
    if (segment) cursor = resolve(cursor, segment);
    const item = await lstat(cursor);
    check(item.isDirectory() && !item.isSymbolicLink(), `${label} contains a non-directory or reparse ancestor.`);
    check(samePath(await realpath(cursor), cursor), `${label} ancestor realpath drifted.`);
  }
};

export const cleanupFailedFinalDeliveryWrite = async ({ handle, temporary, target, runRootGuard }) => {
  if (handle) await handle.close().catch(() => undefined);
  let cleanupAuthorized = false;
  try {
    await runRootGuard.assertIntact();
    cleanupAuthorized = true;
  } catch {
    // Guard kaybında yollar artık canonical run-root'a ait kabul edilemez.
    // Kısmi kanıtı yerinde bırak; yalnız guard kapanışını güvenle dene.
  }
  if (cleanupAuthorized) {
    await unlink(temporary).catch(() => undefined);
    await unlink(target).catch(() => undefined);
  }
  await runRootGuard.close().catch(() => undefined);
  return Object.freeze({ cleanupAuthorized });
};

const atomicWriteJson = async (outputPath, value) => {
  const target = resolve(outputPath);
  const runId = String(value?.runId ?? '');
  check(UUID_V4_PATTERN.test(runId), 'Final delivery output runId is not a UUID-v4 identity.');
  const deliveryParent = resolve(validationRoot, 'bronze-final-delivery');
  const runRoot = resolve(deliveryParent, runId);
  const expectedTarget = resolve(runRoot, `bronze-${value.applicationVersion}-final-local-test-delivery.json`);
  check(samePath(value.evidenceRoot, runRoot) && samePath(target, expectedTarget),
    'Final delivery output root/filename is not canonical for its UUID run.');
  await assertDirectoryChainNoReparse(root, validationRoot, 'Final delivery validation root');
  if (await pathIsAbsent(deliveryParent)) await mkdir(deliveryParent, { recursive: false });
  await assertDirectoryChainNoReparse(validationRoot, deliveryParent, 'Final delivery parent');
  check(await pathIsAbsent(runRoot) && await pathIsAbsent(target),
    'Final delivery UUID output root or receipt already exists; replay is forbidden.');
  await mkdir(runRoot, { recursive: false });
  await assertDirectoryChainNoReparse(deliveryParent, runRoot, 'Final delivery UUID root');
  const runRootGuard = await acquireExclusiveEvidenceRunRootGuard({ runRoot, boundary: deliveryParent });
  await runRootGuard.assertIntact();
  check(await pathIsAbsent(target), 'Final delivery target appeared before atomic write.');
  await runRootGuard.assertIntact();
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  let handle;
  try {
    await runRootGuard.assertIntact();
    handle = await open(temporary, 'wx');
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await runRootGuard.assertIntact();
    check(await pathIsAbsent(target), 'Final delivery target appeared before atomic rename.');
    await runRootGuard.assertIntact();
    await rename(temporary, target);
    await runRootGuard.assertIntact();
    const targetItem = await lstat(target);
    check(targetItem.isFile() && !targetItem.isSymbolicLink() && samePath(await realpath(target), target),
      'Final delivery receipt readback path is not a canonical regular file.');
    const readback = await readFile(target);
    check(readback.equals(bytes), 'Final delivery receipt atomic readback mismatch.');
    await runRootGuard.assertIntact();
    await runRootGuard.close();
    return { path: portablePath(target), sizeBytes: bytes.length, sha256: sha256Bytes(bytes) };
  } catch (error) {
    await cleanupFailedFinalDeliveryWrite({ handle, temporary, target, runRootGuard });
    throw error;
  }
};

const main = async () => {
  const options = parseOptions(process.argv.slice(2));
  const allowedOptions = new Set([
    'narration-tr', 'narration-en', 'source-protection', 'package-provenance',
    'governed-preflight', 'installation-preservation-uat', 'installed-ui-uat', 'installer-experience-uat'
  ]);
  check([...options.keys()].every((name) => allowedOptions.has(name)), 'Final delivery CLI contains a non-canonical option/override.');
  const { applicationVersion, packageVersion } = await readSourceVersion();
  const release = `Bronze ${applicationVersion}`;
  const finalRunId = randomUUID();
  const finalEvidenceRoot = resolve(validationRoot, 'bronze-final-delivery', finalRunId);
  const defaults = {
    installer: resolve(root, `apps/desktop/release/ParsYuva-Bronze-${applicationVersion}.exe`),
    'packaged-executable': resolve(root, 'apps/desktop/release/win-unpacked/ParsYuva-Bronze.exe'),
    'installed-executable': 'C:\\Program Files\\PPT\\ParsYuva-Bronze\\ParsYuva-Bronze.exe',
    'packaged-probe': resolve(validationRoot, 'windows-packaged-launch-probe.json'),
    output: resolve(finalEvidenceRoot, `bronze-${applicationVersion}-final-local-test-delivery.json`)
  };
  const narrationTrPath = requireOption(options, 'narration-tr');
  const narrationEnPath = requireOption(options, 'narration-en');
  const sourceProtectionPath = options.get('source-protection');
  const packageProvenancePath = requireOption(options, 'package-provenance');
  const governedPreflightPath = requireOption(options, 'governed-preflight');
  const installationPreservationPath = requireOption(options, 'installation-preservation-uat');
  const installedUiPath = requireOption(options, 'installed-ui-uat');
  const installerExperiencePath = requireOption(options, 'installer-experience-uat');

  const [installer, packagedRuntime, installedRuntime, liveSource] = await Promise.all([
    readExecutableIdentity(defaults.installer),
    readExecutableIdentity(defaults['packaged-executable']),
    readExecutableIdentity(defaults['installed-executable']),
    captureReleaseSourceProvenance({ root, expectedChannel: 'Bronze' })
  ]);
  const canonicalSourceProtection = await readCanonicalChannelSourceProtection({
    aymRoot,
    expectedChannel: 'Bronze',
    suppliedPath: sourceProtectionPath
  });
  const sourceProtectionBinding = Object.freeze({
    id: 'sourceProtection',
    path: portablePath(canonicalSourceProtection.binding.fullPath),
    fullPath: canonicalSourceProtection.binding.fullPath,
    sizeBytes: canonicalSourceProtection.binding.sizeBytes,
    sha256: canonicalSourceProtection.binding.sha256,
    value: canonicalSourceProtection.value
  });
  const primaryBindings = await Promise.all([
    readJsonBinding(installerExperiencePath, 'installerExperienceUat'),
    readJsonBinding(installationPreservationPath, 'installationPreservationUat110'),
    readJsonBinding(installedUiPath, 'installedFrontendUat111'),
    readJsonBinding(defaults['packaged-probe'], 'packagedLaunchProbe'),
    readJsonBinding(narrationTrPath, 'narrationSynthesisTr', { boundary: narrationEvidenceRoot }),
    readJsonBinding(narrationEnPath, 'narrationSynthesisEn', { boundary: narrationEvidenceRoot }),
    readJsonBinding(packageProvenancePath, 'packageProvenance'),
    readJsonBinding(governedPreflightPath, 'governedPreflight')
  ]);
  const installationPreservationBinding = primaryBindings.find((binding) => binding.id === 'installationPreservationUat110');
  const requiresTechnicalPredecessorPreparation = release === 'Bronze 27.08.2026.53';
  const technicalPredecessorClaim = installationPreservationBinding?.value?.technicalPredecessorPreparation;
  if (requiresTechnicalPredecessorPreparation) {
    check(typeof technicalPredecessorClaim?.path === 'string' && technicalPredecessorClaim.path.trim() !== ''
      && Number.isSafeInteger(Number(technicalPredecessorClaim.sizeBytes)) && Number(technicalPredecessorClaim.sizeBytes) > 0
      && SHA256_PATTERN.test(String(technicalPredecessorClaim.sha256 ?? '').toLowerCase()),
    'UAT110 technical predecessor preparation binding/path is missing or invalid.');
  } else {
    check(technicalPredecessorClaim === null || technicalPredecessorClaim === undefined,
      'UAT110 technical predecessor preparation binding is allowed only for the exact Bronze 53 continuation.');
  }
  const technicalPredecessorBinding = requiresTechnicalPredecessorPreparation
    ? await readJsonBinding(resolve(root, technicalPredecessorClaim.path), 'technicalPredecessorPreparation')
    : null;
  const bindings = [
    ...primaryBindings,
    ...(technicalPredecessorBinding ? [technicalPredecessorBinding] : []),
    sourceProtectionBinding
  ];
  const byId = Object.fromEntries(bindings.map((binding) => [binding.id, binding]));
  const previousReference = byId.packageProvenance.value?.previousPackageProvenance;
  const packageSequenceMatch = /\.(\d+)$/u.exec(String(byId.packageProvenance.value?.release ?? ''));
  check(packageSequenceMatch, 'Current package provenance release sequence is invalid.');
  const isGovernedBootstrap = Number(packageSequenceMatch[1]) === 50;
  let previousPackageHistoryBundle = null;
  let previousPackageArchive = null;
  let historicalPreviousSourceProvenance = null;
  let previousPackageProducerReadback = null;
  if (isGovernedBootstrap) {
    check(previousReference === null,
      'Bronze 50 governed bootstrap must not name a previous package archive.');
  } else {
    check(previousReference?.release === byId.packageProvenance.value?.parentRelease,
      'Current package provenance does not name its exact parent release archive.');
    const expectedPreviousPath = resolve(root, windowsPackageHistoryBundleRelativePath(previousReference.release));
    check(samePath(previousReference.path, expectedPreviousPath), 'Previous package provenance archive path is not canonical.');
    const previousHistory = await verifyWindowsPackageHistoryBundle({
      root,
      bundlePath: expectedPreviousPath,
      expectedRelease: previousReference.release,
      expectedReleaseId: previousReference.releaseId,
      currentProvenance: liveSource.provenance,
      runGit: liveSource.runGit,
      requireEarlierCommit: true
    });
    check(previousHistory.bundleBinding.sha256 === previousReference.sha256
      && previousHistory.bundleBinding.sizeBytes === Number(previousReference.sizeBytes),
    'Previous package provenance history bundle live readback mismatch.');
    previousPackageHistoryBundle = Object.freeze({
      value: previousHistory.bundle,
      sizeBytes: previousHistory.bundleBinding.sizeBytes,
      sha256: previousHistory.bundleBinding.sha256
    });
    previousPackageArchive = Object.freeze({
      value: previousHistory.receipt,
      sizeBytes: previousHistory.packageBinding.sizeBytes,
      sha256: previousHistory.packageBinding.sha256
    });
    historicalPreviousSourceProvenance = previousHistory.provenance;
    const previousProducerPath = 'apps/desktop/scripts/run-electron-builder.mjs';
    const previousProducerRaw = liveSource.runGit(['show', `${historicalPreviousSourceProvenance.headCommit}:${previousProducerPath}`]);
    const previousProducerBytes = Buffer.isBuffer(previousProducerRaw) ? previousProducerRaw : Buffer.from(previousProducerRaw);
    previousPackageProducerReadback = Object.freeze({
      path: previousProducerPath,
      sizeBytes: previousProducerBytes.length,
      sha256: sha256Bytes(previousProducerBytes)
    });
  }
  const verifiedPackage = await verifyWindowsPackageProvenanceLive({
    root,
    packageProvenancePath,
    governedPreflightPath,
    expectedReleaseId: byId.packageProvenance.value.releaseId
  });
  check(verifiedPackage.provenance.headCommit === liveSource.provenance.headCommit,
    'Live package provenance source commit drifted before final acceptance.');
  const sourceProtectionReadback = await verifyLocalSourceProtectionArtifacts({
    aymRoot: dirname(liveSource.policy.codeRoot),
    protection: byId.sourceProtection.value,
    expectedProvenance: liveSource.provenance,
    expectedChannel: 'Bronze'
  });
  const externalSourceProtectionVerification = runExternalSourceProtectionVerification(
    liveSource.provenance,
    byId.sourceProtection.value
  );
  const gitRemoteEquality = verifyGitRemoteEquality(liveSource.provenance.headCommit);
  const narrationScriptSha256 = sha256Bytes(await readFile(resolve(root, 'apps/desktop/build/installer-narration.ps1')));
  const [trWave, enWave, packagedFuseRaw, installedFuseRaw] = await Promise.all([
    readWaveIdentity(byId.narrationSynthesisTr, 'TR narration'),
    readWaveIdentity(byId.narrationSynthesisEn, 'EN narration'),
    verifyElectronFuseBinary(packagedRuntime.fullPath),
    verifyElectronFuseBinary(installedRuntime.fullPath)
  ]);
  const packagedFuses = validateFuseResult(packagedFuseRaw, packagedRuntime, 'Packaged runtime');
  const installedFuses = validateFuseResult(installedFuseRaw, installedRuntime, 'Installed runtime');
  const narrationTr = validateNarration({
    binding: byId.narrationSynthesisTr, waveIdentity: trWave, language: 'tr',
    applicationVersion, packageVersion, scriptSha256: narrationScriptSha256
  });
  const narrationEn = validateNarration({
    binding: byId.narrationSynthesisEn, waveIdentity: enWave, language: 'en',
    applicationVersion, packageVersion, scriptSha256: narrationScriptSha256
  });
  const evidenceBindings = Object.fromEntries(bindings.map((binding) => [binding.id, {
    path: binding.path, sizeBytes: binding.sizeBytes, sha256: binding.sha256
  }]));
  const nativeDialogScreenshotReceipt = {
    evidenceRoot: resolve(root, String(byId.installedFrontendUat111.value.evidenceRoot ?? '')),
    screenshotArtifacts: (byId.installedFrontendUat111.value.checks?.nativeDialogEvidence ?? [])
      .flatMap((record) => [record?.cancel?.screenshot, record?.accept?.screenshot])
  };
  const [installerScreenshots, installedUiScreenshots, nativeDialogScreenshots, finalProducerBinding, installedUiProducerBinding,
    installerExperienceProducerBinding, installedReleaseProducerBinding, technicalPredecessorProducerBinding,
    technicalPredecessorReleaseLedger] = await Promise.all([
    verifyScreenshotArtifactsLive(byId.installerExperienceUat.value, 'Installer experience UAT'),
    verifyScreenshotArtifactsLive(byId.installedFrontendUat111.value, 'Installed UI UAT111'),
    verifyScreenshotArtifactsLive(nativeDialogScreenshotReceipt, 'Installed UI native dialog UAT111', { requireUniqueHashes: false }),
    readFile(fileURLToPath(import.meta.url)).then((bytes) => ({ path: 'scripts/create-bronze-final-local-test-delivery.mjs', sizeBytes: bytes.length, sha256: sha256Bytes(bytes) })),
    readFile(resolve(root, 'scripts/run-installed-frontend-user-uat.mjs')).then((bytes) => ({ path: 'scripts/run-installed-frontend-user-uat.mjs', sizeBytes: bytes.length, sha256: sha256Bytes(bytes) })),
    readFile(resolve(root, 'scripts/run-windows-installer-experience-uat.ps1')).then((bytes) => ({ path: 'scripts/run-windows-installer-experience-uat.ps1', sizeBytes: bytes.length, sha256: sha256Bytes(bytes) })),
    readFile(resolve(root, 'scripts/run-windows-installed-release-uat.ps1')).then((bytes) => ({ path: 'scripts/run-windows-installed-release-uat.ps1', sizeBytes: bytes.length, sha256: sha256Bytes(bytes) })),
    readFile(resolve(root, 'scripts/run-windows-technical-predecessor-preparation.ps1')).then((bytes) => ({ path: portablePath(resolve(root, 'scripts/run-windows-technical-predecessor-preparation.ps1')), sizeBytes: bytes.length, sha256: sha256Bytes(bytes) })),
    readFile(resolve(root, 'config/release-ledger.json')).then((bytes) => ({ path: portablePath(resolve(root, 'config/release-ledger.json')), sizeBytes: bytes.length, sha256: sha256Bytes(bytes) }))
  ]);
  const finalProducer = Object.freeze({
    final: finalProducerBinding,
    installedUi: installedUiProducerBinding,
    installerExperience: installerExperienceProducerBinding,
    installedRelease: installedReleaseProducerBinding,
    technicalPredecessor: technicalPredecessorProducerBinding
  });
  const receipt = createFinalLocalTestDeliveryReceipt({
    release, applicationVersion, packageVersion,
    sourceCommit: liveSource.provenance.headCommit,
    sourceProvenance: liveSource.provenance,
    sourceProtection: byId.sourceProtection.value,
    sourceProtectionReadback,
    externalSourceProtectionVerification,
    gitRemoteEquality,
    packageProvenance: byId.packageProvenance.value,
    governedPreflight: byId.governedPreflight.value,
    installer, packagedRuntime, installedRuntime,
    technicalPredecessorPreparation: byId.technicalPredecessorPreparation?.value,
    installerExperience: byId.installerExperienceUat.value,
    installationPreservation: byId.installationPreservationUat110.value,
    installedUi: byId.installedFrontendUat111.value,
    packagedProbe: byId.packagedLaunchProbe.value,
    narrationTr, narrationEn, packagedFuses, installedFuses, evidenceBindings,
    screenshotReadbacks: { installer: installerScreenshots, installedUi: installedUiScreenshots, nativeDialog: nativeDialogScreenshots },
    finalRunId, finalEvidenceRoot, finalProducer, technicalPredecessorReleaseLedger,
    previousPackageHistoryBundle, previousPackageArchive,
    historicalPreviousSourceProvenance, previousPackageProducerReadback
  });
  const finalLiveSource = await captureReleaseSourceProvenance({ root, expectedChannel: 'Bronze' });
  assertMatchingReleaseSourceProvenance(finalLiveSource.provenance, liveSource.provenance, 'final receipt write');
  const output = await atomicWriteJson(defaults.output, receipt);
  process.stdout.write(`${JSON.stringify({ status: receipt.status, release, output })}\n`);
};

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
