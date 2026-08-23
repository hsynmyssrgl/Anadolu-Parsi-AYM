import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  unlink
} from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyElectronFuseBinary } from '../apps/desktop/scripts/apply-electron-fuses.mjs';
import { ELECTRON_FUSE_POLICY } from '../apps/desktop/scripts/electron-fuse-policy.mjs';

export const FINAL_LOCAL_TEST_DELIVERY_SCHEMA_VERSION = 2;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const LOCAL_TEST_STATUS = 'LOCAL_TEST_PASS_PRODUCTION_RELEASE_BLOCKED';
const LOCAL_TEST_CLASSIFICATION = 'UNSIGNED_LOCAL_TEST_ONLY';
const MAINTENANCE_CLASSIFICATION = 'SAME_VERSION_MAINTENANCE_PRESERVATION';
const NARRATION_CLAIM_BOUNDARY = 'OFFLINE_WAVE_SYNTHESIS_ONLY_NOT_AUDIBLE_OUTPUT';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const validationRoot = resolve(root, 'artifacts/validation');

const fail = (message) => { throw new Error(message); };
const check = (condition, message) => { if (!condition) fail(message); };
const lowerSha256 = (value, label) => {
  const normalized = String(value ?? '').toLowerCase();
  check(SHA256_PATTERN.test(normalized), `${label} is not a SHA-256 digest.`);
  return normalized;
};
const samePath = (left, right) => resolve(String(left)).toLowerCase() === resolve(String(right)).toLowerCase();
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

const readJsonBinding = async (path, id) => {
  const fullPath = resolve(path);
  const item = await lstat(fullPath);
  check(item.isFile() && !item.isSymbolicLink(), `${id} evidence must be a regular non-link file.`);
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

export const createFinalLocalTestDeliveryReceipt = (input) => {
  const {
    release, applicationVersion, packageVersion, sourceCommit,
    installer, packagedRuntime, installedRuntime,
    installerExperience, maintenance, installedUi, packagedProbe,
    narrationTr, narrationEn, packagedFuses, installedFuses,
    evidenceBindings
  } = input;
  check(release === `Bronze ${applicationVersion}`, 'Release/application version mismatch.');
  check(/^22\.8\.2026-\d+$/u.test(packageVersion), 'Desktop package version is invalid.');
  check(/^[a-f0-9]{40}$/u.test(sourceCommit), 'Source commit is invalid.');
  for (const [label, identity] of Object.entries({ installer, packagedRuntime, installedRuntime })) {
    lowerSha256(identity.sha256, `${label} executable`);
    check(identity.sizeBytes > 0, `${label} executable is empty.`);
    check(identity.authenticodeStatus === 'NotSigned', `${label} must remain explicitly NotSigned in this local-test flow.`);
    check(identity.fileVersion === packageVersion, `${label} file version mismatch.`);
  }
  check(packagedRuntime.sha256 === installedRuntime.sha256 && packagedRuntime.sizeBytes === installedRuntime.sizeBytes,
    'Packaged and installed runtime are not byte-identical.');

  check(installerExperience?.schemaVersion === 1 && installerExperience.status === 'PASS', 'Installer experience UAT did not PASS.');
  check(installerExperience.installer?.sha256?.toLowerCase() === installer.sha256
    && Number(installerExperience.installer?.sizeBytes) === installer.sizeBytes,
  'Installer experience UAT is bound to another installer.');
  check(installerExperience.window?.className === '#32770' && installerExperience.window?.slideCount === 3
    && installerExperience.window?.noFakeProgress === true
    && installerExperience.window?.slides?.length === 3
    && installerExperience.window.slides.every((slide) => slide.visibleProgressBarCount === 0 && SHA256_PATTERN.test(String(slide.screenshotSha256))),
  'Installer transition/progress evidence is incomplete.');
  check(installerExperience.narration?.observed === true && installerExperience.narration?.language === 'tr',
    'Installer narration child/language evidence is incomplete.');
  check(installerExperience.cancellation?.requested === true
    && installerExperience.cancellation?.confirmationInvoked === true
    && installerExperience.cancellation?.processTreeExited === true
    && installerExperience.cancellation?.forcedCleanupRequired === false,
  'Installer safe-cancellation evidence is incomplete.');
  check(installerExperience.installedPayloadSafety?.unchanged === true, 'Installer UAT changed the installed payload.');

  check(maintenance?.schemaVersion === 1 && maintenance.status === 'PASS'
    && maintenance.classification === MAINTENANCE_CLASSIFICATION && maintenance.exitCode === 0,
  'Same-version maintenance UAT classification/status mismatch.');
  check(maintenance.installer?.sha256?.toLowerCase() === installer.sha256, 'Maintenance UAT used another installer.');
  check(maintenance.after?.packagedSha256?.toLowerCase() === packagedRuntime.sha256
    && maintenance.after?.installedSha256?.toLowerCase() === installedRuntime.sha256,
  'Maintenance UAT runtime hash binding mismatch.');
  check(maintenance.installedBinaryReplaced === true && maintenance.packagedExactMatch === true
    && maintenance.markerPreserved === true && maintenance.bronzeDataUnchanged === true
    && maintenance.otherChannelsUnchanged === true
    && maintenance.before?.markerSha256 === maintenance.after?.markerSha256,
  'Same-version maintenance preservation is incomplete.');

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

  check(installedUi?.schemaVersion === 2 && installedUi.status === 'PASS'
    && installedUi.release === release && installedUi.runtimeKind === 'INSTALLED_EXECUTABLE'
    && samePath(installedUi.executable, installedRuntime.fullPath)
    && installedUi.installedFileVersion === packageVersion,
  'Installed UI UAT identity/version mismatch.');
  check(installedUi.passwordRecorded === false && installedUi.twoFactorSecretRecorded === false
    && installedUi.recoveryCodesRecorded === false
    && installedUi.containsUnredactedAuthenticationSecrets === false,
  'Installed UI UAT contains or records authentication secrets.');
  const uiChecks = installedUi.checks ?? {};
  check(uiChecks.firstRunIntroductionVisible === true && uiChecks.familyCreatedThroughVisibleForm === true
    && uiChecks.twoFactorStartedThroughVisibleButton === true && uiChecks.twoFactorCompletedThroughVisibleForm === true
    && uiChecks.currentDeviceTrustedThroughVisibleForm === true && uiChecks.authenticatedMainShellVisible === true,
  'Installed UI first-family/security journey is incomplete.');
  check(uiChecks.navigationSurfaceCount === 22 && uiChecks.moduleMenuCount === 4
    && uiChecks.clickedInteractionCount >= 235 && uiChecks.visualAuditCount >= 30
    && uiChecks.unexpectedRendererExceptionCount === 0 && uiChecks.failedResourceCount === 0
    && uiChecks.mainProcessExceptionCount === 0,
  'Installed UI coverage or error counts are incomplete.');
  check(installedUi.receiptBindings?.screenshotReadbackVerified === true
    && installedUi.receiptBindings?.screenshotRequiredSetVerified === true,
  'Installed UI screenshot readback is incomplete.');

  const maintenanceAt = isoMillis(maintenance.generatedAt, 'maintenance.generatedAt');
  const packagedProbeAt = isoMillis(packagedProbe.generatedAt, 'packagedProbe.generatedAt');
  const installedUiStartedAt = isoMillis(installedUi.startedAt, 'installedUi.startedAt');
  check(maintenanceAt <= packagedProbeAt && packagedProbeAt <= installedUiStartedAt,
    'Final UAT chronology is invalid.');

  check(packagedFuses.fuses.EnableNodeCliInspectArguments === false
    && installedFuses.fuses.EnableNodeCliInspectArguments === false,
  'CLI inspector fuse must remain disabled.');

  return Object.freeze({
    schemaVersion: FINAL_LOCAL_TEST_DELIVERY_SCHEMA_VERSION,
    release,
    applicationVersion,
    packageVersion,
    sourceCommit,
    classification: LOCAL_TEST_CLASSIFICATION,
    status: LOCAL_TEST_STATUS,
    generatedAt: new Date().toISOString(),
    installer: { ...installer, fullPath: undefined, productionReleaseEligible: false },
    packagedRuntime: { ...packagedRuntime, fullPath: undefined },
    installedRuntime: { ...installedRuntime, fullPath: undefined, exactPackagedMatch: true },
    evidenceBindings,
    installerExperience: {
      status: 'PASS', slideCount: 3, noFakeProgress: true,
      narrationChildObserved: true, narrationLanguage: 'tr', safeCancellation: 'PASS', payloadUnchanged: true
    },
    sameVersionMaintenance: {
      status: 'PASS', classification: MAINTENANCE_CLASSIFICATION,
      installedBinaryReplaced: true, packagedExactMatch: true, markerPreserved: true,
      bronzeDataUnchanged: true, otherChannelsUnchanged: true
    },
    packagedLaunch: {
      status: 'PASS', runs: 2, executableSha256: packagedRuntime.sha256,
      executableUnchangedAcrossLaunches: true, dpapiCrossProcessPersistence: 'PASS',
      windowsEfsRuntime: 'PASS', rendererSandboxPolicy: 'PASS'
    },
    installedFrontendUat: {
      status: 'PASS', navigationRoutes: uiChecks.navigationSurfaceCount,
      moduleMenus: uiChecks.moduleMenuCount, clickedInteractions: uiChecks.clickedInteractionCount,
      visualAudits: uiChecks.visualAuditCount, unexpectedRendererExceptions: 0,
      failedResources: 0, mainProcessExceptionsReported: 0, screenshotReadback: 'PASS'
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
  const [appMeta, desktopPackageBytes] = await Promise.all([
    readFile(resolve(root, 'packages/domain/src/app-meta.ts'), 'utf8'),
    readFile(resolve(root, 'apps/desktop/package.json'), 'utf8')
  ]);
  const applicationVersion = /version: '([^']+)'/u.exec(appMeta)?.[1];
  const packageVersion = JSON.parse(desktopPackageBytes).version;
  check(applicationVersion && packageVersion, 'Application/package version could not be resolved.');
  return { applicationVersion, packageVersion };
};

const readSourceCommit = () => {
  const result = spawnSync('git', ['-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', 'rev-parse', 'HEAD'], {
    cwd: root, encoding: 'utf8', windowsHide: true
  });
  check(result.status === 0, `Source commit could not be resolved: ${result.stderr}`);
  return result.stdout.trim().toLowerCase();
};

const readWaveIdentity = async (binding, id) => {
  const wavePath = binding.value?.wave?.path;
  check(typeof wavePath === 'string' && isAbsolute(wavePath), `${id} wave path must be absolute.`);
  const item = await lstat(wavePath);
  check(item.isFile() && !item.isSymbolicLink(), `${id} wave must be a regular non-link file.`);
  const bytes = await readFile(wavePath);
  return Object.freeze({ path: portablePath(wavePath), sizeBytes: bytes.length, sha256: sha256Bytes(bytes) });
};

const atomicWriteJson = async (outputPath, value) => {
  const target = resolve(outputPath);
  const prefix = `${validationRoot}${sep}`.toLowerCase();
  check(target.toLowerCase().startsWith(prefix), 'Final delivery output must remain under artifacts/validation.');
  await mkdir(resolve(target, '..'), { recursive: true });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  let handle;
  try {
    handle = await open(temporary, 'wx');
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, target);
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
  const readback = await readFile(target);
  check(readback.equals(bytes), 'Final delivery receipt atomic readback mismatch.');
  return { path: portablePath(target), sizeBytes: bytes.length, sha256: sha256Bytes(bytes) };
};

const main = async () => {
  const options = parseOptions(process.argv.slice(2));
  const { applicationVersion, packageVersion } = await readSourceVersion();
  const release = `Bronze ${applicationVersion}`;
  const defaults = {
    installer: resolve(root, `apps/desktop/release/ParsYuva-Bronze-${applicationVersion}.exe`),
    'packaged-executable': resolve(root, 'apps/desktop/release/win-unpacked/ParsYuva-Bronze.exe'),
    'installed-executable': 'C:\\Program Files\\PPT\\ParsYuva\\Bronze\\ParsYuva-Bronze.exe',
    'installer-uat': resolve(validationRoot, `bronze-${applicationVersion}-installer-experience-uat110/windows-installer-experience-uat.json`),
    'maintenance-uat': resolve(validationRoot, `bronze-${applicationVersion}-installation-preservation-uat110.json`),
    'installed-ui-uat': resolve(validationRoot, 'installed-frontend-user-uat111.json'),
    'packaged-probe': resolve(validationRoot, 'windows-packaged-launch-probe.json'),
    output: resolve(validationRoot, `bronze-${applicationVersion}-final-local-test-delivery.json`)
  };
  const optionPath = (name) => options.get(name) ?? defaults[name];
  const narrationTrPath = requireOption(options, 'narration-tr');
  const narrationEnPath = requireOption(options, 'narration-en');

  const [installer, packagedRuntime, installedRuntime] = await Promise.all([
    readExecutableIdentity(optionPath('installer')),
    readExecutableIdentity(optionPath('packaged-executable')),
    readExecutableIdentity(optionPath('installed-executable'))
  ]);
  const bindings = await Promise.all([
    readJsonBinding(optionPath('installer-uat'), 'installerExperienceUat110'),
    readJsonBinding(optionPath('maintenance-uat'), 'sameVersionMaintenanceUat110'),
    readJsonBinding(optionPath('installed-ui-uat'), 'installedFrontendUat111'),
    readJsonBinding(optionPath('packaged-probe'), 'packagedLaunchProbe'),
    readJsonBinding(narrationTrPath, 'narrationSynthesisTr'),
    readJsonBinding(narrationEnPath, 'narrationSynthesisEn')
  ]);
  const byId = Object.fromEntries(bindings.map((binding) => [binding.id, binding]));
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
  const receipt = createFinalLocalTestDeliveryReceipt({
    release, applicationVersion, packageVersion, sourceCommit: readSourceCommit(),
    installer, packagedRuntime, installedRuntime,
    installerExperience: byId.installerExperienceUat110.value,
    maintenance: byId.sameVersionMaintenanceUat110.value,
    installedUi: byId.installedFrontendUat111.value,
    packagedProbe: byId.packagedLaunchProbe.value,
    narrationTr, narrationEn, packagedFuses, installedFuses, evidenceBindings
  });
  const output = await atomicWriteJson(optionPath('output'), receipt);
  process.stdout.write(`${JSON.stringify({ status: receipt.status, release, output })}\n`);
};

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
