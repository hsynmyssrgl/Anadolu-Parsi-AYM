import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PRODUCT_NAVIGATION_GROUPS, PRODUCT_NAVIGATION_ROUTES } from './lib/canonical-product-navigation.mjs';
import { acquireExclusiveEvidenceRunRootGuard } from './lib/exclusive-evidence-run-root-guard.mjs';
import {
  INSTALLED_UI_ACTIONABLE_SELECTOR,
  INSTALLED_UI_REQUIRED_STATE_SCENARIOS,
  INSTALLED_UI_SEMANTIC_SURFACES,
  INSTALLED_UI_STATE_ASSERTIONS,
  buildInstalledUiAccessibilityPlan,
  buildInstalledUiStateMatrixPlan,
  classifyInstalledUiActionSafety,
  createInstalledUiInteractionCoverageEngine,
  createInstalledUiProcessOutputCollector,
  createSemanticControlIdentity,
  scanInstalledUiSecretBearingText,
  validateInstalledUiApplicationStateEvidence,
  validateInstalledUiScrollEvidence,
} from './lib/installed-ui-interaction-coverage.mjs';
import {
  INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY,
  INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY_SHA256,
  beginWindowsNativeFileDialogAutomation,
  createInstalledUiNativeDialogFixtures,
  createInstalledUiNativeDialogSelection,
  readInstalledUiNativeDialogSelection,
  resolveInstalledUiNativeDialogSpecification,
} from './lib/windows-native-file-dialog-uat.mjs';
import { verifyWindowsPackageProvenanceLive } from './lib/windows-package-provenance.mjs';

export const INSTALLED_EXECUTABLE_PATH = 'C:\\Program Files\\PPT\\ParsYuva-Bronze\\ParsYuva-Bronze.exe';
export const INSTALLED_RUNTIME_KIND = 'INSTALLED_EXECUTABLE';
export const SYNTHETIC_DATA_CLASSIFICATION = 'SYNTHETIC_TEST_ONLY';
export const RECEIPT_SCHEMA_VERSION = 3;
export const STRESS_VIEWPORT = Object.freeze({ width: 760, height: 720, textScalePercent: 200, highContrast: true });

const repositoryRoot = resolve(import.meta.dirname, '..');
const validationRoot = resolve(repositoryRoot, 'artifacts/validation');
const sha256Pattern = /^[a-f0-9]{64}$/u;
const gitObjectPattern = /^[a-f0-9]{40,64}$/u;
const executableVersionPattern = /^\d{1,2}\.\d{1,2}\.\d{4}-\d+$/u;
const visibleFatalPattern = /\[object\s+Object\]|Error invoking(?: remote method)?|CORE-UNEXPECTED-\d+|UNKNOWN_IPC_CHANNEL|PlatformPolicyEnforcementError|\b(?:TypeError|ReferenceError|SyntaxError|RangeError|UnhandledPromiseRejection|ECONNREFUSED|ENOENT|EPERM|EACCES|ERR_[A-Z0-9_]+)\b|(?:SQL|SQLite|IPC|Repository)\s+(?:error|hatası|failed|başarısız)|(?:[A-Z]:\\(?:Users|ProgramData|Windows|PPT)\\[^\s]+)|(?:\/Users\/|\/home\/)[^\s]+|\bat\s+[\w$.<>]+\s*\([^\n)]*:\d+:\d+\)/iu;
const turkishTechnicalLeakPattern = /\b(?:Repository|renderer|receipt|metadata|hash|fail[- ]closed|stack trace|SQL(?:ite)?|IPC|exception|remote method|object Object)\b/iu;
const femaleVoiceHints = ['emel', 'gülay', 'gulay', 'eda', 'seda', 'filiz', 'zira', 'aria', 'jenny', 'hazel', 'susan', 'samantha', 'victoria', 'karen', 'moira', 'fiona', 'tessa', 'female', 'woman', 'kadın'];

const requiredOptions = Object.freeze([
  'installed-exe',
  'package-provenance',
  'governed-preflight',
  'installation-preservation',
  'evidence-root',
  'expected-release-id',
  'parent-run-id',
  'output',
]);

const fail = (message) => { throw new Error(message); };
const check = (condition, message) => { if (!condition) fail(message); };
const portable = (value) => String(value).replaceAll('\\', '/');
const normalizeWindowsPath = (value) => resolve(String(value)).replaceAll('/', '\\').toLowerCase();
const sha256Bytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

export const parseArguments = (arguments_) => {
  const options = new Map();
  for (let index = 0; index < arguments_.length; index += 2) {
    const key = arguments_[index];
    const value = arguments_[index + 1];
    check(key?.startsWith('--') && value !== undefined && !value.startsWith('--'), `Geçersiz UAT argümanı: ${key ?? '<eksik>'}`);
    const normalizedKey = key.slice(2);
    check(requiredOptions.includes(normalizedKey), `Desteklenmeyen UAT argümanı: --${normalizedKey}`);
    check(!options.has(normalizedKey), `UAT argümanı tekrarlandı: --${normalizedKey}`);
    options.set(normalizedKey, value);
  }
  for (const name of requiredOptions) check(options.has(name) && options.get(name)?.trim(), `--${name} zorunludur.`);
  return Object.freeze(Object.fromEntries(options));
};

const strictDescendant = (candidate, parent) => {
  const normalizedCandidate = resolve(candidate).toLowerCase();
  const normalizedParent = resolve(parent).replace(/[\\/]+$/u, '').toLowerCase();
  return normalizedCandidate.startsWith(`${normalizedParent}\\`) || normalizedCandidate.startsWith(`${normalizedParent}/`);
};

const assertAbsolutePath = (value, label) => check(isAbsolute(value) && /^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/u.test(value), `${label} açık bir Windows mutlak yolu olmalıdır.`);

const runPowerShell = (script, arguments_, label) => {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script, ...arguments_], {
    encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024,
  });
  check(result.status === 0, `${label}: ${(result.stderr || result.stdout || 'bilinmeyen hata').trim()}`);
  return result.stdout.trim();
};

const assertNoReparseWindowsPath = (targetPath, boundaryPath, { requireTarget = true, recursive = false } = {}) => {
  const script = `
$ErrorActionPreference='Stop'
$target=[System.IO.Path]::GetFullPath($args[0])
$boundary=[System.IO.Path]::GetFullPath($args[1]).TrimEnd('\\')
$prefix=$boundary+'\\'
if(-not $target.Equals($boundary,[StringComparison]::OrdinalIgnoreCase) -and -not $target.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){throw 'PATH_OUTSIDE_BOUNDARY'}
$current=$boundary
if(Test-Path -LiteralPath $current){$item=Get-Item -LiteralPath $current -Force;if(($item.Attributes-band [IO.FileAttributes]::ReparsePoint)-ne 0){throw ('REPARSE='+$current)}}
$relative=$target.Substring($boundary.Length).TrimStart('\\')
foreach($segment in @($relative-split '\\\\'|Where-Object{$_})){
  $current=Join-Path $current $segment
  if(-not(Test-Path -LiteralPath $current)){break}
  $item=Get-Item -LiteralPath $current -Force
  if(($item.Attributes-band [IO.FileAttributes]::ReparsePoint)-ne 0){throw ('REPARSE='+$current)}
}
if($args[2]-eq 'REQUIRE' -and -not(Test-Path -LiteralPath $target)){throw 'TARGET_MISSING'}
if($args[3]-eq 'RECURSIVE' -and (Test-Path -LiteralPath $target)){
  foreach($item in Get-ChildItem -LiteralPath $target -Force -Recurse){if(($item.Attributes-band [IO.FileAttributes]::ReparsePoint)-ne 0){throw ('DESCENDANT_REPARSE='+$item.FullName)}}
}
'PASS'`;
  check(runPowerShell(script, [targetPath, boundaryPath, requireTarget ? 'REQUIRE' : 'OPTIONAL', recursive ? 'RECURSIVE' : 'SHALLOW'], 'Reparse denetimi') === 'PASS', 'Reparse denetimi PASS üretmedi.');
};

const readRegularFileBinding = async (targetPath, label) => {
  const item = await lstat(targetPath).catch(() => undefined);
  check(item?.isFile() && !item.isSymbolicLink(), `${label} düzenli dosya değildir.`);
  const canonical = await realpath(targetPath);
  check(normalizeWindowsPath(canonical) === normalizeWindowsPath(targetPath), `${label} realpath hedefi değiştiriyor.`);
  const bytes = await readFile(canonical);
  check(bytes.length > 0, `${label} boştur.`);
  return Object.freeze({ fullPath: canonical, sizeBytes: bytes.length, sha256: sha256Bytes(bytes), bytes });
};

const readJsonBinding = async (targetPath, label) => {
  const binding = await readRegularFileBinding(targetPath, label);
  let value;
  try { value = JSON.parse(binding.bytes.toString('utf8')); } catch { fail(`${label} geçerli JSON değildir.`); }
  return Object.freeze({ ...binding, bytes: undefined, value });
};

const captureExecutableIdentity = (targetPath) => {
  const script = `
$ErrorActionPreference='Stop'
$target=[IO.Path]::GetFullPath($args[0])
$item=Get-Item -LiteralPath $target -Force
if($item.PSIsContainer){throw 'EXECUTABLE_IS_DIRECTORY'}
if(($item.Attributes-band [IO.FileAttributes]::ReparsePoint)-ne 0){throw 'EXECUTABLE_IS_REPARSE'}
$stream=[IO.File]::Open($item.FullName,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
$sha=[Security.Cryptography.SHA256]::Create()
try{$hash=([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose();$stream.Dispose()}
[pscustomobject]@{fullPath=$item.FullName;sizeBytes=[int64]$item.Length;fileVersion=$item.VersionInfo.FileVersion;productVersion=$item.VersionInfo.ProductVersion;sha256=$hash}|ConvertTo-Json -Compress`;
  const identity = JSON.parse(runPowerShell(script, [targetPath], 'Kurulu EXE kimliği okunamadı'));
  check(normalizeWindowsPath(identity.fullPath) === normalizeWindowsPath(INSTALLED_EXECUTABLE_PATH), 'Kurulu EXE kimlik yolu kanonik hedef değildir.');
  check(Number(identity.sizeBytes) > 0 && sha256Pattern.test(identity.sha256), 'Kurulu EXE kimliği geçersizdir.');
  return Object.freeze({ ...identity, sizeBytes: Number(identity.sizeBytes), sha256: identity.sha256.toLowerCase() });
};

const lowerSha = (value, label) => {
  const normalized = String(value ?? '').toLowerCase();
  check(sha256Pattern.test(normalized), `${label} SHA-256 değeri geçersizdir.`);
  return normalized;
};

export const validateProvenanceReceipts = ({
  packageProvenance,
  governedPreflight,
  installationPreservation,
  expectedReleaseId,
  installedIdentity,
  packageProvenanceSha256,
  governedPreflightSha256,
}) => {
  check(packageProvenance?.schemaVersion === 2 && packageProvenance.id === 'PPT-WINDOWS-PACKAGE-PROVENANCE-V2'
    && packageProvenance.status === 'PASS', 'Paket provenance PASS/schema 2 değildir.');
  check(['LOCAL_UNSIGNED_NSIS', 'SIGNED_NSIS'].includes(packageProvenance.buildMode), 'Paket buildMode geçersizdir.');
  check(packageProvenance.releaseId === expectedReleaseId, 'Paket releaseId beklenen kimlikle eşleşmiyor.');
  check(/^Bronze \d{2}\.\d{2}\.\d{4}\.\d+$/u.test(packageProvenance.release), 'Paket Bronze release etiketi geçersizdir.');
  const sourceCommit = String(packageProvenance.sourceProvenance?.headCommit ?? '').toLowerCase();
  const governedSourceFingerprintSha256 = lowerSha(packageProvenance.sourceProvenance?.governedSourceFingerprint?.sha256, 'Paket kaynak parmak izi');
  check(gitObjectPattern.test(sourceCommit), 'Paket kaynak commit kimliği geçersizdir.');
  check(packageProvenance.sourceProvenance?.channel === 'Bronze', 'Paket kaynak kanalı Bronze değildir.');
  check(packageProvenance.sourceProvenance?.worktreeClean === true, 'Paket kirli çalışma ağacından üretilmiştir.');
  check(governedPreflight?.schemaVersion === 1 && governedPreflight.status === 'PASS', 'Governed preflight PASS/schema 1 değildir.');
  const canonicalRuleRegistrySha256 = lowerSha(governedPreflight.rulesSha256, 'Kanonik kural sicili');
  check(lowerSha(governedPreflight.sourceFingerprint?.sha256, 'Preflight kaynak parmak izi') === governedSourceFingerprintSha256, 'Preflight başka kaynak parmak izine bağlıdır.');
  check(installationPreservation?.schemaVersion === 2 && installationPreservation.status === 'PASS' && installationPreservation.exitCode === 0,
    'Kurulum koruma UAT PASS/schema 2 değildir.');
  check(installationPreservation.id === 'PPT-WINDOWS-INSTALLED-RELEASE-UAT110-V2'
    && installationPreservation.evidenceKind === 'WINDOWS_INSTALLED_RELEASE_PRESERVATION'
    && installationPreservation.classification === 'LOCAL_UNSIGNED_INSTALLATION_PRESERVATION_ONLY',
  'Kurulum koruma UAT110 kimliği/sınıflandırması geçersizdir.');
  check(installationPreservation.release === packageProvenance.release && installationPreservation.expectedReleaseId === expectedReleaseId && installationPreservation.sourceCommit === sourceCommit, 'Kurulum koruma makbuzu başka release/source içindir.');
  check(lowerSha(installationPreservation.packageProvenance?.sha256, 'UAT110 paket makbuzu') === lowerSha(packageProvenanceSha256, 'Canlı paket makbuzu') && lowerSha(installationPreservation.governedPreflight?.sha256, 'UAT110 preflight makbuzu') === lowerSha(governedPreflightSha256, 'Canlı preflight makbuzu'), 'Kurulum koruma UAT110 receipt SHA bağı eskidir.');
  const installerSha256 = lowerSha(packageProvenance.artifacts?.installer?.sha256, 'Paket installer');
  const packagedRuntimeSha256 = lowerSha(packageProvenance.artifacts?.packagedRuntime?.sha256, 'Paket runtime');
  check(lowerSha(installationPreservation.installer?.sha256, 'Koruma installer') === installerSha256, 'Kurulum koruma makbuzu başka installer kullandı.');
  check(lowerSha(installationPreservation.packagedRuntime?.sha256, 'Koruma packaged runtime') === packagedRuntimeSha256, 'Kurulum koruma packaged runtime bağı bozuk.');
  for (const [label, phase, classification] of [
    ['upgrade', installationPreservation.upgrade, 'VERSION_UPGRADE_N_TO_N_PLUS_1'],
    ['maintenance', installationPreservation.maintenance, 'SAME_VERSION_MAINTENANCE'],
  ]) {
    check(phase?.status === 'PASS' && phase.classification === classification && phase.installedEqualsPackaged === true
      && phase.markerPreserved === true && phase.allUserDataContentEqualityPreserved === true
      && phase.otherChannelAndLegacyProgramMetadataPreserved === true && phase.otherChannelWriteCount === 0
      && phase.dataSelectionDialogObserved === false && phase.bronzeRegistry?.exactSingleEntry === true,
    `Kurulum koruma ${label} fazı eksiktir.`);
    check(lowerSha(phase.installedRuntime?.sha256, `${label} installed runtime`) === packagedRuntimeSha256, `Kurulum koruma ${label} runtime bağı bozuk.`);
  }
  const version = (value, label) => {
    const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})-(\d+)$/u.exec(String(value ?? ''));
    check(match, `${label} FileVersion kanonik değildir.`);
    return match.slice(1).map(Number);
  };
  const from = version(installationPreservation.upgrade?.fromFileVersion, 'Upgrade from');
  const to = version(installationPreservation.upgrade?.toFileVersion, 'Upgrade to');
  const fromDate = Date.UTC(from[2], from[1] - 1, from[0]);
  const toDate = Date.UTC(to[2], to[1] - 1, to[0]);
  const expectedParentRelease = `Bronze ${String(from[0]).padStart(2, '0')}.${String(from[1]).padStart(2, '0')}.${from[2]}.${from[3]}`;
  check(from[1] === to[1] && from[2] === to[2] && toDate >= fromDate && to[3] === from[3] + 1
    && installationPreservation.upgrade?.fromSequence === from[3]
    && installationPreservation.upgrade?.toSequence === to[3]
    && installationPreservation.upgrade?.exactSuccessor === true
    && packageProvenance.parentRelease === expectedParentRelease,
  'Upgrade fazı exact aynı-seri N→N+1 değildir.');
  check(packageProvenance.previousPackageProvenance?.release === expectedParentRelease
    && lowerSha(installationPreservation.previousPackageProvenance?.sha256, 'UAT110 previous package') === lowerSha(packageProvenance.previousPackageProvenance?.sha256, 'Current package previous binding')
    && Number(installationPreservation.previousPackageProvenance?.sizeBytes) === Number(packageProvenance.previousPackageProvenance?.sizeBytes),
  'Upgrade fazı immutable schema2 parent package provenance bağı taşımıyor.');
  check(installationPreservation.maintenance?.beforeFileVersion === installationPreservation.maintenance?.afterFileVersion
    && installationPreservation.maintenance?.beforeFileVersion === installationPreservation.upgrade?.toFileVersion
    && installationPreservation.maintenance?.sameVersion === true,
  'Maintenance fazı N+1→N+1 aynı sürüm değildir.');
  check(installationPreservation.cleanup?.markerDeleted === true
    && installationPreservation.cleanup?.markerAbsentReadback === true
    && installationPreservation.cleanup?.originalUserDataStateRestored === true,
  'Kurulum koruma sentetik marker cleanup kapısı eksiktir.');
  check(installationPreservation.privacyBoundary?.existingUserFileContentsHashedForEquality === true
    && installationPreservation.privacyBoundary?.existingUserFileContentsRecorded === false
    && installationPreservation.privacyBoundary?.existingUserFileNamesRecorded === false
    && installationPreservation.privacyBoundary?.receiptContainsUserContent === false
    && installationPreservation.privacyBoundary?.contentEqualityMeasured === true,
  'Kurulum koruma UAT110 gizlilik/eşitlik sınırı güvenli değildir.');
  check(installedIdentity.sha256 === packagedRuntimeSha256, 'Kurulu EXE paket runtime ile byte-identical değildir.');
  check(installedIdentity.sizeBytes === Number(packageProvenance.artifacts?.packagedRuntime?.sizeBytes), 'Kurulu EXE boyutu paket runtime ile eşleşmiyor.');
  check(executableVersionPattern.test(installedIdentity.fileVersion) && installedIdentity.fileVersion === installationPreservation.installer?.fileVersion, 'Kurulu EXE FileVersion koruma makbuzuyla eşleşmiyor.');
  check(installationPreservation.producer?.path === 'scripts/run-windows-installed-release-uat.ps1'
    && sha256Pattern.test(String(installationPreservation.producer?.sha256 ?? '').toLowerCase())
    && Number(installationPreservation.producer?.sizeBytes) > 0,
  'Kurulum koruma producer identity bağı eksiktir.');
  return Object.freeze({
    release: packageProvenance.release,
    releaseId: expectedReleaseId,
    sourceCommit,
    governedSourceFingerprintSha256,
    canonicalRuleRegistrySha256,
    installerSha256,
    packagedRuntimeSha256,
    packageBuildMode: packageProvenance.buildMode,
  });
};

export const createInstalledFrontendReceipt = ({ provenance, receiptBindings, installedIdentity, completedAt, status, checks, screenshots, profileDisposition, producer, runId, parentRunId, evidenceRoot, failure }) => Object.freeze({
  schemaVersion: RECEIPT_SCHEMA_VERSION,
  id: 'PPT-INSTALLED-FRONTEND-USER-UAT111-V3',
  evidenceKind: 'INSTALLED_FRONTEND_USER_UAT',
  runId,
  parentRunId,
  evidenceRoot,
  release: provenance.release,
  releaseId: provenance.releaseId,
  runtimeKind: INSTALLED_RUNTIME_KIND,
  executable: INSTALLED_EXECUTABLE_PATH,
  installedFileVersion: installedIdentity.fileVersion,
  executableIdentity: installedIdentity,
  sourceCommit: provenance.sourceCommit,
  governedSourceFingerprintSha256: provenance.governedSourceFingerprintSha256,
  canonicalRuleRegistrySha256: provenance.canonicalRuleRegistrySha256,
  packageProvenanceSha256: receiptBindings.packageProvenanceSha256,
  installationPreservationSha256: receiptBindings.installationPreservationSha256,
  governedPreflightSha256: receiptBindings.governedPreflightSha256,
  dataClassification: SYNTHETIC_DATA_CLASSIFICATION,
  passwordRecorded: false,
  twoFactorSecretRecorded: false,
  recoveryCodesRecorded: false,
  containsUnredactedAuthenticationSecrets: false,
  secretAudit: Object.freeze({ unknownSecretLikeFieldCount: 0, sensitiveScreenshotCount: 0, unredactedSecretCount: 0, receiptContainsAuthenticationSecret: false }),
  physicalAudioAudibilityClaimed: false,
  startedAt: receiptBindings.startedAt,
  completedAt,
  generatedAt: completedAt,
  exitCode: status === 'PASS' ? 0 : 1,
  status,
  checks,
  screenshotArtifactCount: screenshots.length,
  screenshots: screenshots.map((item) => item.relativePath),
  screenshotArtifacts: screenshots,
  profileDisposition,
  producer,
  receiptBindings,
  ...(failure ? { failure } : {}),
});

class CdpClient {
  constructor(url, eventHandler) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.eventHandler = eventHandler;
  }
  async open() {
    await new Promise((resolveOpen, rejectOpen) => {
      const timeout = setTimeout(() => rejectOpen(new Error('CDP WebSocket 10 saniyede açılmadı.')), 10_000);
      this.socket.addEventListener('open', () => { clearTimeout(timeout); resolveOpen(); }, { once: true });
      this.socket.addEventListener('error', () => { clearTimeout(timeout); rejectOpen(new Error('CDP WebSocket bağlantısı kurulamadı.')); }, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timeout);
        if (message.error) pending.reject(new Error(`${message.error.code}: ${message.error.message}`));
        else pending.resolve(message.result ?? {});
        return;
      }
      this.eventHandler?.(message, this);
    });
  }
  send(method, params = {}, timeoutMs = 90_000) {
    const id = this.nextId++;
    return new Promise((resolveSend, rejectSend) => {
      const timeout = setTimeout(() => { this.pending.delete(id); rejectSend(new Error(`CDP ${method} zaman aşımına uğradı.`)); }, timeoutMs);
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend, timeout });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { try { this.socket.close(); } catch { /* already closed */ } }
}

const allocateLoopbackPort = async () => new Promise((resolvePort, rejectPort) => {
  const server = createServer();
  server.unref();
  server.once('error', rejectPort);
  server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    server.close((error) => error ? rejectPort(error) : resolvePort(port));
  });
});

const decodeBase32 = (value) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of value.replace(/=+$/u, '').toUpperCase()) {
    const index = alphabet.indexOf(character);
    check(index >= 0, 'Geçersiz TOTP base32 anahtarı.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
};

const createTotp = async (secret) => {
  const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
  if (remaining < 5) await delay((remaining + 1) * 1000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest.at(-1) & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
};

const makeSyntheticPassword = () => `Uat!Aa1${randomBytes(24).toString('base64url')}`;

const sanitizeEvidenceText = (value, sensitiveValues, profilePath) => {
  let sanitized = String(value ?? '');
  for (const secret of sensitiveValues) if (secret) sanitized = sanitized.replaceAll(secret, '[SECRET_REDACTED]');
  if (profilePath) sanitized = sanitized.replaceAll(profilePath, '[EPHEMERAL_PROFILE]');
  return sanitized.slice(0, 4_000);
};

const safeJson = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');

const getWindowsProcessSnapshot = () => {
  const script = `
$ErrorActionPreference='Stop'
$items=@(Get-CimInstance Win32_Process|ForEach-Object{
  $created=if($null-ne $_.CreationDate){$_.CreationDate.ToUniversalTime().ToString('O')}else{$null}
  [pscustomobject]@{processId=[int]$_.ProcessId;parentProcessId=[int]$_.ParentProcessId;creationTimeUtc=$created;executablePath=$_.ExecutablePath;commandLine=$_.CommandLine}
})
$items|ConvertTo-Json -Compress`;
  const output = runPowerShell(script, [], 'Windows süreç ağacı okunamadı');
  const parsed = JSON.parse(output || '[]');
  return Array.isArray(parsed) ? parsed : [parsed];
};

const processIdentityKey = (identity) => `${identity.processId}|${identity.creationTimeUtc ?? ''}`;

const captureOwnedProcessTree = (rootIdentity, ownedIdentities) => {
  const processes = getWindowsProcessSnapshot();
  const root = processes.find((item) => item.processId === rootIdentity.processId && item.creationTimeUtc === rootIdentity.creationTimeUtc);
  if (root) ownedIdentities.set(processIdentityKey(root), root);
  let changed = true;
  while (changed) {
    changed = false;
    const ownedPids = new Set([...ownedIdentities.values()].map((item) => item.processId));
    for (const process of processes) {
      if (!ownedPids.has(process.parentProcessId)) continue;
      const key = processIdentityKey(process);
      if (!ownedIdentities.has(key)) { ownedIdentities.set(key, process); changed = true; }
    }
  }
  return processes;
};

const waitForRootProcessIdentity = async (processId) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const identity = getWindowsProcessSnapshot().find((item) => item.processId === processId);
    if (identity?.creationTimeUtc) return identity;
    await delay(100);
  }
  fail('Kurulu EXE kök süreç kimliği CreationDate ile bağlanamadı.');
};

const waitForRelaunchedRootIdentity = async ({ previousRootIdentity, knownIdentityKeys, executablePath, remoteDebuggingPort }) => {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const processes = getWindowsProcessSnapshot();
    const candidates = processes.filter((item) => item.creationTimeUtc
      && !knownIdentityKeys.has(processIdentityKey(item))
      && normalizeWindowsPath(item.executablePath ?? '') === normalizeWindowsPath(executablePath)
      && String(item.commandLine ?? '').includes(`--remote-debugging-port=${remoteDebuggingPort}`));
    const candidatePids = new Set(candidates.map((item) => item.processId));
    const root = candidates.find((item) => item.parentProcessId === previousRootIdentity.processId)
      ?? candidates.find((item) => !candidatePids.has(item.parentProcessId));
    if (root) return root;
    await delay(100);
  }
  fail('Terminal native ACCEPT sonrası owned yeniden başlatılan kök süreç bulunamadı.');
};

const stopExactProcessIdentity = (identity) => {
  const script = `
$ErrorActionPreference='Stop'
$pidValue=[int]$args[0]
$expectedCreated=$args[1]
$expectedPath=$args[2]
$current=Get-CimInstance Win32_Process -Filter ('ProcessId='+$pidValue) -ErrorAction SilentlyContinue
if($null-eq $current){'ALREADY_EXITED';exit 0}
$actualCreated=if($null-ne $current.CreationDate){$current.CreationDate.ToUniversalTime().ToString('O')}else{''}
if($actualCreated-ne $expectedCreated){throw 'PROCESS_IDENTITY_CREATION_MISMATCH'}
if($expectedPath -and $current.ExecutablePath -and -not $current.ExecutablePath.Equals($expectedPath,[StringComparison]::OrdinalIgnoreCase)){throw 'PROCESS_IDENTITY_PATH_MISMATCH'}
Stop-Process -Id $pidValue -Force -ErrorAction Stop
'STOPPED'`;
  return runPowerShell(script, [String(identity.processId), String(identity.creationTimeUtc ?? ''), String(identity.executablePath ?? '')], 'Sahipli süreç kapatılamadı');
};

const stopOwnedProcessTree = async ({ client, child, rootIdentity, ownedIdentities }) => {
  try { if (client) await client.send('Runtime.evaluate', { expression: 'window.close(); true', returnByValue: true }, 5_000); } catch { /* exact owned cleanup below */ }
  for (let attempt = 0; child && child.exitCode === null && attempt < 20; attempt += 1) await delay(200);
  if (rootIdentity) captureOwnedProcessTree(rootIdentity, ownedIdentities);
  const ordered = [...ownedIdentities.values()].toSorted((left, right) => right.processId - left.processId);
  const stopped = [];
  for (const identity of ordered) {
    const current = getWindowsProcessSnapshot().find((item) => item.processId === identity.processId && item.creationTimeUtc === identity.creationTimeUtc);
    if (!current) continue;
    stopped.push({ processId: identity.processId, creationTimeUtc: identity.creationTimeUtc, result: stopExactProcessIdentity(identity) });
  }
  client?.close();
  const survivors = getWindowsProcessSnapshot().filter((item) => ownedIdentities.has(processIdentityKey(item)));
  check(survivors.length === 0, `Sahipli UAT süreçleri kapatılamadı: ${survivors.map((item) => item.processId).join(',')}`);
  return Object.freeze({ rootProcessId: rootIdentity?.processId ?? null, ownedProcessCount: ownedIdentities.size, stopped, survivorCount: 0, identityUsesCreationDate: true });
};

const assertSafeEphemeralProfile = (profilePath, { recursive = false } = {}) => {
  const tempRoot = resolve(tmpdir());
  check(strictDescendant(profilePath, tempRoot), 'Geçici profil Windows TEMP kökünün katı alt yolu değildir.');
  check(/^parsyuva-installed-uat-[a-z0-9-]+$/iu.test(basename(profilePath)), 'Geçici profil adı güvenli UAT kalıbına uymuyor.');
  assertNoReparseWindowsPath(profilePath, tempRoot, { requireTarget: true, recursive });
};

const deleteEphemeralProfile = async (profilePath) => {
  assertSafeEphemeralProfile(profilePath, { recursive: true });
  await rm(profilePath, { recursive: true, force: false, maxRetries: 5, retryDelay: 200 });
  const stillExists = await access(profilePath).then(() => true).catch(() => false);
  check(!stillExists, 'Geçici UAT profili silme sonrası hâlâ mevcut.');
  return Object.freeze({ status: 'DELETED_AND_ABSENCE_READBACK_PASS', absenceReadbackVerified: true, profilePathRecorded: false, excludeFromSourceBackup: true, excludeFromExternalBackup: true });
};

const validateCliPaths = async (options) => {
  for (const name of ['installed-exe', 'package-provenance', 'governed-preflight', 'installation-preservation', 'evidence-root', 'output']) assertAbsolutePath(options[name], `--${name}`);
  check(normalizeWindowsPath(options['installed-exe']) === normalizeWindowsPath(INSTALLED_EXECUTABLE_PATH), `--installed-exe yalnız ${INSTALLED_EXECUTABLE_PATH} olabilir.`);
  check(strictDescendant(options['package-provenance'], validationRoot), '--package-provenance artifacts/validation içinde olmalıdır.');
  check(strictDescendant(options['governed-preflight'], validationRoot), '--governed-preflight artifacts/validation içinde olmalıdır.');
  check(strictDescendant(options['installation-preservation'], validationRoot), '--installation-preservation artifacts/validation içinde olmalıdır.');
  check(strictDescendant(options['evidence-root'], validationRoot), '--evidence-root artifacts/validation altında yeni bir dizin olmalıdır.');
  check(strictDescendant(options.output, options['evidence-root']), '--output evidence-root altında olmalıdır.');
  check(basename(options.output) === 'installed-frontend-user-uat111.json', '--output dosya adı installed-frontend-user-uat111.json olmalıdır.');
  check(!(await access(options['evidence-root']).then(() => true).catch(() => false)), 'Evidence root önceden mevcut; kanıtlar üzerine yazılmaz.');
  assertNoReparseWindowsPath(INSTALLED_EXECUTABLE_PATH, 'C:\\Program Files', { requireTarget: true });
  for (const name of ['package-provenance', 'governed-preflight', 'installation-preservation']) assertNoReparseWindowsPath(options[name], validationRoot, { requireTarget: true });
  assertNoReparseWindowsPath(options['evidence-root'], validationRoot, { requireTarget: false });
};

const waitForCdpTarget = async (port) => {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const target = targets.find((candidate) => candidate.type === 'page' && candidate.webSocketDebuggerUrl);
      if (target) return target;
    } catch { /* loopback endpoint is starting */ }
    await delay(250);
  }
  fail('Kurulu Electron CDP hedefi 40 saniyede bulunamadı.');
};

const isFemaleVoice = (name) => femaleVoiceHints.some((hint) => String(name).toLocaleLowerCase('tr-TR').includes(hint));

export const runInstalledFrontendUserUat = async (options) => {
  check(PRODUCT_NAVIGATION_GROUPS.length === 4, 'Kanonik navigasyon grubu sayısı 4 değildir.');
  check(PRODUCT_NAVIGATION_ROUTES.length === 22, 'Kanonik navigasyon rota sayısı 22 değildir.');
  check(new Set(PRODUCT_NAVIGATION_ROUTES.map((route) => route.id)).size === 22, 'Kanonik rota kimlikleri benzersiz değildir.');
  await validateCliPaths(options);
  check(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(options['parent-run-id']), '--parent-run-id UUID değildir.');

  const installedIdentityBefore = captureExecutableIdentity(options['installed-exe']);
  const [packageBinding, preflightBinding, preservationBinding] = await Promise.all([
    readJsonBinding(options['package-provenance'], 'Paket provenance'),
    readJsonBinding(options['governed-preflight'], 'Governed preflight'),
    readJsonBinding(options['installation-preservation'], 'Kurulum koruma UAT'),
  ]);
  const provenance = validateProvenanceReceipts({
    packageProvenance: packageBinding.value,
    governedPreflight: preflightBinding.value,
    installationPreservation: preservationBinding.value,
    expectedReleaseId: options['expected-release-id'],
    installedIdentity: installedIdentityBefore,
    packageProvenanceSha256: packageBinding.sha256,
    governedPreflightSha256: preflightBinding.sha256,
  });
  const livePackage = await verifyWindowsPackageProvenanceLive({
    root: repositoryRoot,
    expectedReleaseId: options['expected-release-id'],
    packageProvenancePath: options['package-provenance'],
    governedPreflightPath: options['governed-preflight']
  });
  check(livePackage.packageBinding.sha256 === packageBinding.sha256
    && livePackage.provenance.headCommit === provenance.sourceCommit
    && livePackage.provenance.governedSourceFingerprint.sha256 === provenance.governedSourceFingerprintSha256,
  'Canlı clean Bronze source/package provenance readback bağı eşleşmiyor.');

  await mkdir(options['evidence-root'], { recursive: false });
  assertNoReparseWindowsPath(options['evidence-root'], validationRoot, { requireTarget: true });
  let evidenceRunRootGuard;
  const startedAt = new Date().toISOString();
  const runId = randomUUID();
  check(runId !== options['parent-run-id'], 'UAT110 ve UAT111 runId benzersiz değildir.');
  const producerBinding = await readRegularFileBinding(fileURLToPath(import.meta.url), 'Installed frontend UAT producer');
  const producer = Object.freeze({ path: 'scripts/run-installed-frontend-user-uat.mjs', sizeBytes: producerBinding.sizeBytes, sha256: producerBinding.sha256 });
  const profilePath = await mkdtemp(join(tmpdir(), 'parsyuva-installed-uat-'));
  assertSafeEphemeralProfile(profilePath);
  const nativeDialogFixtureSet = await createInstalledUiNativeDialogFixtures(profilePath);
  const sensitiveValues = new Set();
  const password = makeSyntheticPassword();
  sensitiveValues.add(password);
  const syntheticSuffix = randomBytes(5).toString('hex');
  const familyName = `ParsYuva UAT Ailesi ${syntheticSuffix}`;
  const displayName = `Sentetik Test Yöneticisi ${syntheticSuffix}`;
  const screenshotArtifacts = [];
  const visualAudits = [];
  const navigation = [];
  const moduleMenus = [];
  const navigationLanguageChecks = [];
  const backdropDismissalChecks = [];
  const routeIds = PRODUCT_NAVIGATION_ROUTES.map((route) => route.id);
  const interactionStatePlan = buildInstalledUiStateMatrixPlan(routeIds, { defaultScenarios: ['BASELINE'] });
  const interactionCoverageEngine = createInstalledUiInteractionCoverageEngine({ routeIds, stateMatrixPlan: interactionStatePlan, requiredStablePasses: 2 });
  const accessibilityPlan = buildInstalledUiAccessibilityPlan();
  const accessibilityResults = [];
  const applicationStateMatrix = new Map(INSTALLED_UI_REQUIRED_STATE_SCENARIOS.map((scenario) => [scenario, Object.freeze({ scenario, status: 'PENDING', evidence: [] })]));
  const terminalAcceptProbes = [];
  const terminalAcceptOutcomes = [];
  const rendererExceptions = [];
  const failedResources = [];
  const javascriptDialogs = [];
  const dialogDecisionQueue = [];
  const narrationChecks = [];
  const nativeDialogEvidence = [];
  const nativeDialogInventoryObservations = new Map(INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY.map((specification) => [specification.specId, {
    specification,
    routeSnapshotHashes: new Set(),
    enabledControls: new Map(),
    disabledControls: new Map(),
  }]));
  const generatedNativeBackups = [];
  const ownedIdentities = new Map();
  const flowChecks = {
    firstRunIntroductionVisible: false,
    familyCreatedThroughVisibleForm: false,
    twoFactorStartedThroughVisibleButton: false,
    twoFactorCompletedThroughVisibleForm: false,
    currentDeviceTrustedThroughVisibleForm: false,
    authenticatedMainShellVisible: false,
  };
  let child;
  let rootIdentity;
  let client;
  let processEvidence = { rootProcessId: null, ownedProcessCount: 0, stopped: [], survivorCount: 0, identityUsesCreationDate: true };
  let profileDisposition;
  let installedIdentityAfter;
  let processOutputEvidence;
  let processOutputDrainPromise;
  let remoteDebuggingPort;
  const processOutputCollector = createInstalledUiProcessOutputCollector({
    sanitizeLine: (line) => sanitizeEvidenceText(line, sensitiveValues, profilePath),
  });
  const networkActivity = { serial: 0, inFlight: 0 };
  const pageActivity = { serial: 0 };
  let ipcBarrierSerial = 0;
  const activeNetworkRequests = new Set();
  let directPointerSerial = 0;

  const connectCdpClient = async (port) => {
    const target = await waitForCdpTarget(port);
    const connected = new CdpClient(target.webSocketDebuggerUrl, (message, cdp) => {
      if (message.method === 'Runtime.exceptionThrown') rendererExceptions.push(sanitizeEvidenceText(message.params?.exceptionDetails?.exception?.description ?? message.params?.exceptionDetails?.text ?? 'Renderer exception', sensitiveValues, profilePath));
      if (message.method === 'Log.entryAdded' && message.params?.entry?.level === 'error') rendererExceptions.push(sanitizeEvidenceText(message.params.entry.text ?? 'Renderer log error', sensitiveValues, profilePath));
      if (message.method === 'Network.requestWillBeSent') { activeNetworkRequests.add(message.params?.requestId); networkActivity.serial += 1; networkActivity.inFlight = activeNetworkRequests.size; }
      if (message.method === 'Network.loadingFinished' || message.method === 'Network.loadingFailed') { activeNetworkRequests.delete(message.params?.requestId); networkActivity.serial += 1; networkActivity.inFlight = activeNetworkRequests.size; }
      if (message.method === 'Network.responseReceived' && Number(message.params?.response?.status) >= 400) failedResources.push({ status: message.params.response.status, urlOrigin: (() => { try { return new URL(message.params.response.url).origin; } catch { return 'invalid-url'; } })() });
      if (['Page.frameNavigated', 'Page.domContentEventFired', 'Page.loadEventFired', 'Page.lifecycleEvent', 'Page.navigatedWithinDocument'].includes(message.method)) pageActivity.serial += 1;
      if (message.method === 'Page.javascriptDialogOpening') {
        const decision = dialogDecisionQueue.shift() === 'ACCEPT' ? 'ACCEPT' : 'CANCEL';
        javascriptDialogs.push({ type: message.params?.type ?? 'unknown', decision, messageClass: decision === 'ACCEPT' ? 'SYNTHETIC_CONFIRMATION_ACCEPTED' : 'SYNTHETIC_CONFIRMATION_CANCELLED' });
        void cdp.send('Page.handleJavaScriptDialog', { accept: decision === 'ACCEPT' }).catch(() => rendererExceptions.push('JavaScript onay penceresi güvenle kapatılamadı.'));
      }
    });
    await connected.open();
    for (const domain of ['Runtime.enable', 'Page.enable', 'Log.enable', 'Network.enable']) await connected.send(domain);
    await connected.send('Page.setLifecycleEventsEnabled', { enabled: true });
    return connected;
  };

  const evaluate = async (expression) => {
    const response = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (response.exceptionDetails) fail(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? 'Renderer değerlendirme hatası.');
    return response.result?.value;
  };

  const waitFor = async (expression, description, timeoutMs = 30_000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try { if (await evaluate(expression)) return; } catch { /* navigation retry */ }
      await delay(200);
    }
    fail(`${description} beklenirken süre aşıldı.`);
  };

  const installInteractionActivityTelemetry = async () => {
    const installed = await evaluate(`(() => {
      if(globalThis.__pptInstalledUatActivity)return globalThis.__pptInstalledUatActivity.instrumented===true;
      const state={domSerial:0,instrumented:false};
      const observer=new MutationObserver(records=>{if(records.length)state.domSerial+=1;});observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,characterData:true});
      state.instrumented=Boolean(globalThis.pardus&&typeof globalThis.pardus.getCoreServiceHealth==='function');
      globalThis.__pptInstalledUatActivity=state;return state.instrumented;
    })()`);
    check(installed, 'CDP DOM etkinliği ve preload IPC bariyeri fail-closed kurulamadı.');
  };

  const readCdpSettledActivity = async (description) => {
    const renderer = await evaluate(`(async()=>{const state=globalThis.__pptInstalledUatActivity;if(!state?.instrumented||typeof globalThis.pardus?.getCoreServiceHealth!=='function')return null;let timeoutId;try{const health=await Promise.race([globalThis.pardus.getCoreServiceHealth(),new Promise((_,reject)=>{timeoutId=setTimeout(()=>reject(new Error('IPC_BARRIER_TIMEOUT')),5000);})]);return {domSerial:state.domSerial,ipcBarrierCompleted:true,ipcInFlight:0,barrierFingerprint:JSON.stringify({lifecycle:health?.lifecycle??null,version:health?.version??null})};}finally{clearTimeout(timeoutId);}})()`);
    check(renderer?.ipcBarrierCompleted === true && renderer.ipcInFlight === 0, `CDP üzerinden IPC settle bariyeri tamamlanamadı: ${description}`);
    ipcBarrierSerial += 1;
    return Object.freeze({ ...renderer, ipcSerial: ipcBarrierSerial, pageSerial: pageActivity.serial, networkSerial: networkActivity.serial, networkInFlight: networkActivity.inFlight });
  };

  const waitForInteractionQuietWindow = async (description, quietForMs = 700, timeoutMs = 20_000) => {
    const deadline = Date.now() + timeoutMs;
    let stableSince = 0;
    let previous;
    while (Date.now() < deadline) {
      const renderer = await readCdpSettledActivity(description);
      const current = { domSerial: renderer.domSerial, barrierFingerprint: renderer.barrierFingerprint, ipcInFlight: renderer.ipcInFlight, pageSerial: renderer.pageSerial, networkSerial: renderer.networkSerial, networkInFlight: renderer.networkInFlight };
      const same = previous && Object.keys(current).every((key) => current[key] === previous[key]);
      if (same && current.ipcInFlight === 0 && current.networkInFlight === 0) {
        if (!stableSince) stableSince = Date.now();
        if (Date.now() - stableSince >= quietForMs) return Object.freeze({ status: 'PASS', quietForMs: Date.now() - stableSince, domStable: true, networkStable: true, ipcStable: true, pageLifecycleStable: true, networkInFlight: 0, ipcInFlight: 0, finalSerials: { ...current, ipcSerial: renderer.ipcSerial } });
      } else stableSince = 0;
      previous = current;
      await delay(100);
    }
    fail(`DOM/network/IPC quiet-window süre aşımı: ${description}`);
  };

  const finalizeProcessOutputEvidence = async () => {
    if (processOutputEvidence) return processOutputEvidence;
    check(processOutputDrainPromise, 'Process output drain süreci başlatılmadı.');
    await Promise.race([
      processOutputDrainPromise,
      new Promise((_, rejectDrain) => setTimeout(() => rejectDrain(new Error('Process stdout/stderr 10 saniyede tam drain olmadı.')), 10_000)),
    ]);
    processOutputEvidence = processOutputCollector.report();
    return processOutputEvidence;
  };

  const dispatchPrimaryPointerGesture = async ({ x, y, expectedRuntimeId = '', expectedSelector = '', routeId = 'onboarding' }) => {
    const hit = await evaluate(`(() => {const top=document.elementFromPoint(${Number(x)},${Number(y)});if(!(top instanceof Element))return null;const semantic=top.closest('[data-installed-uat-semantic-id]')?.getAttribute('data-installed-uat-semantic-id')??'';const direct=top.closest('[data-installed-uat-direct-pointer-id]')?.getAttribute('data-installed-uat-direct-pointer-id')??'';return {semantic,direct,selectorMatched:${expectedSelector ? `top.matches(${safeJson(expectedSelector)})` : 'false'}};})()`);
    const pointerTargetRuntimeId = expectedRuntimeId || expectedSelector;
    check(hit && (expectedRuntimeId ? (hit.semantic === expectedRuntimeId || hit.direct === expectedRuntimeId) : hit.selectorMatched === true),
      `Pointer hedef hit-test başarısız: ${routeId} / ${pointerTargetRuntimeId}`);
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 });
    await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    return Object.freeze({
      routeId,
      activationMethod: 'POINTER_PRIMARY_BUTTON',
      pointerSequence: 'MOUSE_MOVED_MOUSE_PRESSED_MOUSE_RELEASED',
      pointerTargetRuntimeId,
      mouseMoved: true,
      mousePressed: true,
      mouseReleased: true,
      button: 'left',
      clickCount: 1,
      x: Math.round(x),
      y: Math.round(y),
    });
  };

  const clickButton = async (patterns, scope = 'document') => {
    directPointerSerial += 1;
    const runtimeId = `installed-uat-direct-pointer-${directPointerSerial}`;
    const target = await evaluate(`(() => {
      const root=${safeJson(scope)}==='document'?document:document.querySelector(${safeJson(scope)});
      if(!root)return null;
      const patterns=${safeJson(patterns)}.map(value=>new RegExp(value,'iu'));
      const button=[...root.querySelectorAll('button,[role="button"]')].find(candidate=>patterns.some(pattern=>pattern.test(candidate.textContent?.trim()??'')));
      if(!(button instanceof HTMLElement)||button.getAttribute('aria-disabled')==='true'||button.hasAttribute('disabled'))return null;
      button.scrollIntoView({block:'center',inline:'center'});button.setAttribute('data-installed-uat-direct-pointer-id',${safeJson(runtimeId)});
      const box=button.getBoundingClientRect();const top=document.elementFromPoint(box.left+box.width/2,box.top+box.height/2);
      const label=(button.textContent??button.getAttribute('aria-label')??'').replace(/\\s+/gu,' ').trim();
      return {label,x:box.left+box.width/2,y:box.top+box.height/2,hit:top===button||button.contains(top)};
    })()`);
    check(target?.hit, `Buton bulunamadı veya pointer hedefi değil: ${patterns.join(' / ')}`);
    const gesture = await dispatchPrimaryPointerGesture({ x: target.x, y: target.y, expectedRuntimeId: runtimeId, routeId: 'onboarding' });
    return Object.freeze({ label: target.label, gesture: Object.freeze({ ...gesture, runtimeId, sha256: sha256Bytes(Buffer.from(JSON.stringify({ ...gesture, runtimeId }))) }) });
  };

  const clickSelectorByPointer = async (selector, routeId = 'onboarding', index = 0) => {
    directPointerSerial += 1;
    const runtimeId = `installed-uat-direct-pointer-${directPointerSerial}`;
    const target = await evaluate(`(() => {const element=document.querySelectorAll(${safeJson(selector)})[${Number(index)}];if(!(element instanceof HTMLElement)||element.matches(':disabled')||element.getAttribute('aria-disabled')==='true')return null;element.scrollIntoView({block:'center',inline:'center'});element.setAttribute('data-installed-uat-direct-pointer-id',${safeJson(runtimeId)});const box=element.getBoundingClientRect();const top=document.elementFromPoint(box.left+box.width/2,box.top+box.height/2);return {x:box.left+box.width/2,y:box.top+box.height/2,hit:top===element||element.contains(top)};})()`);
    check(target?.hit, `Selector pointer hedefi bulunamadı: ${routeId} / ${selector}`);
    const gesture = await dispatchPrimaryPointerGesture({ x: target.x, y: target.y, expectedRuntimeId: runtimeId, routeId });
    const gestureEvidence = Object.freeze({ ...gesture, runtimeId });
    return Object.freeze({ ...gestureEvidence, sha256: sha256Bytes(Buffer.from(JSON.stringify(gestureEvidence))) });
  };

  const fillInput = async (selector, value) => {
    const filled = await evaluate(`(() => {
      const input=document.querySelector(${safeJson(selector)});
      if(!(input instanceof HTMLInputElement))return false;
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
      if(!setter)return false;
      setter.call(input,${safeJson(value)});
      input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true;
    })()`);
    check(filled, `Form alanı bulunamadı: ${selector}`);
  };

  const waitForPolicyBarrier = async (description) => {
    const result = await evaluate(`window.pardus.getCoreServiceHealth().then(value=>({ok:true,lifecycle:value.lifecycle})).catch(()=>({ok:false}))`);
    check(result?.ok, `IPC politika bariyeri tamamlanamadı: ${description}`);
  };

  const navigateToRoute = async (routeId) => {
    const result = await evaluate(`(() => {
      const route=document.querySelector('[data-navigation-route="${routeId}"]');
      if(!(route instanceof HTMLButtonElement))return null;
      const toggle=route.closest('.nav-group')?.querySelector('.nav-module-toggle');
      if(toggle instanceof HTMLButtonElement&&toggle.getAttribute('aria-expanded')!=='true')toggle.click();
      route.click();return (route.textContent??'').replace(/\\s+/gu,' ').trim();
    })()`);
    check(result, `Navigasyon rotası bulunamadı: ${routeId}`);
    await delay(450);
    await waitForPolicyBarrier(`rota ${routeId}`);
    return result;
  };

  const redactSensitiveDom = async () => evaluate(`(() => {
    if(Array.isArray(globalThis.__pptInstalledUatRedactions)&&globalThis.__pptInstalledUatRedactions.length)return {redactionCount:globalThis.__pptInstalledUatRedactions.length,remainingSensitiveCount:0,categories:['already-redacted']};
    const redactions=[];const categories=new Set();
    const redactText=(element,replacement,category)=>{if(!(element instanceof HTMLElement)||redactions.some(item=>item.element===element))return;redactions.push({kind:'text',element,value:element.textContent});element.textContent=replacement;categories.add(category);};
    const redactValue=(element,category)=>{if(!(element instanceof HTMLInputElement)||!element.value)return;redactions.push({kind:'value',element,value:element.value});element.value='[UAT GİZLENDİ]';categories.add(category);};
    for(const input of document.querySelectorAll('input[type="password"],input[autocomplete="current-password"],input[autocomplete="new-password"],.first-run-security-shell input[inputmode="numeric"]'))redactValue(input,'credential-input');
    for(const element of document.querySelectorAll('.notes-card small,.notes-card code,.first-run-security-shell p')){
      const text=element.textContent?.trim()??'';
      if(/^(?:Anahtar|Key|Kimlik doğrulayıcı anahtarı)\s*:/iu.test(text))redactText(element,'Anahtar: [UAT GİZLENDİ]','totp-key');
      else if(/^(?:Kurulum URI|Setup URI)\s*:/iu.test(text)||/otpauth:\/\//iu.test(text))redactText(element,'Kurulum URI: [UAT GİZLENDİ]','setup-uri');
      else if(/^(?:Kurtarma kodları|Recovery codes)\s*:/iu.test(text))redactText(element,'Kurtarma kodları: [UAT GİZLENDİ]','recovery-codes');
    }
    const recoveryHeading=[...document.querySelectorAll('.notes-card strong')].find(element=>/^(Kurtarma kodları|Recovery codes)$/iu.test(element.textContent?.trim()??''));
    if(recoveryHeading?.nextElementSibling)redactText(recoveryHeading.nextElementSibling,'Kurtarma kodları: [UAT GİZLENDİ]','recovery-codes');
    globalThis.__pptInstalledUatRedactions=redactions;
    const visibleText=document.body?.innerText??'';
    const remainingText=(visibleText.match(/otpauth:\/\/|(?:Anahtar|Key)\s*:\s*[A-Z2-7]{12,}|(?:Kurtarma kodları|Recovery codes)\s*:\s*(?!\[UAT)/giu)??[]).length;
    const remainingInputs=[...document.querySelectorAll('input[type="password"],.first-run-security-shell input[inputmode="numeric"]')].filter(input=>input instanceof HTMLInputElement&&input.value&&input.value!=='[UAT GİZLENDİ]').length;
    return {redactionCount:redactions.length,remainingSensitiveCount:remainingText+remainingInputs,categories:[...categories].sort()};
  })()`);

  const restoreSensitiveDom = async () => evaluate(`(() => {
    const redactions=Array.isArray(globalThis.__pptInstalledUatRedactions)?globalThis.__pptInstalledUatRedactions:[];
    for(const item of redactions){if(item.kind==='text'&&item.element instanceof HTMLElement)item.element.textContent=item.value;else if(item.kind==='value'&&item.element instanceof HTMLInputElement)item.element.value=item.value;}
    globalThis.__pptInstalledUatRedactions=[];return redactions.length;
  })()`);

  const scanScreenshotSecretSurfaces = async () => {
    const surfaces = await evaluate(`(() => {
      const visible=element=>{const style=getComputedStyle(element);const box=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&box.width>0&&box.height>0;};
      const nodes=[...document.querySelectorAll('body *')].filter(element=>element instanceof HTMLElement&&visible(element));
      const formValues=[...document.querySelectorAll('input,textarea,select')].filter(element=>visible(element)).map(element=>'value'in element?String(element.value??''):'').filter(Boolean);
      const attributes=nodes.flatMap(element=>['aria-label','aria-description','title','alt','data-tooltip'].map(name=>element.getAttribute(name)??'')).filter(Boolean);
      const pseudoContent=nodes.flatMap(element=>['::before','::after'].map(pseudo=>getComputedStyle(element,pseudo).content)).filter(value=>value&&value!=='none'&&value!=='normal');
      const backgroundContent=nodes.map(element=>getComputedStyle(element).backgroundImage).filter(value=>value&&value!=='none');
      const canvasElements=[...document.querySelectorAll('canvas')].filter(visible);const canvases=canvasElements.map(canvas=>{try{const value=canvas.toDataURL('image/png');return {readable:true,sha256Material:value};}catch{return {readable:false,sha256Material:''};}});const canvasFallback=canvasElements.flatMap(canvas=>[canvas.textContent??'',canvas.getAttribute('aria-label')??'',canvas.getAttribute('title')??'']).filter(Boolean);
      return {domText:document.body?.innerText??'',formValues,attributes,pseudoContent,backgroundContent,canvasFallback,canvases};
    })()`);
    check(surfaces && Array.isArray(surfaces.formValues) && Array.isArray(surfaces.canvases), 'Ekran görüntüsü gizli yüzey taraması okunamadı.');
    const scan = (value) => scanInstalledUiSecretBearingText(value, { sensitiveValues: [...sensitiveValues] });
    const categories = {
      domText: scan(surfaces.domText),
      formValues: scan(surfaces.formValues.join('\n')),
      attributes: scan(surfaces.attributes.join('\n')),
      pseudoContent: scan(surfaces.pseudoContent.join('\n')),
      backgroundContent: scan(surfaces.backgroundContent.join('\n')),
      canvasFallback: scan(surfaces.canvasFallback.join('\n')),
    };
    for (const [category, result] of Object.entries(categories)) check(result.status === 'PASS', `Ekran görüntüsü öncesi ${category} gizli veri taraması FAIL.`);
    const canvasFingerprints = surfaces.canvases.map((item) => Object.freeze({ readable: item.readable === true, sha256: sha256Bytes(Buffer.from(item.sha256Material)) }));
    return Object.freeze({
      status: 'PASS',
      categories: Object.freeze(Object.fromEntries(Object.entries(categories).map(([category, result]) => [category, Object.freeze({ status: result.status, findingCount: result.findingCount })]))),
      canvasCount: canvasFingerprints.length,
      canvasFingerprints: Object.freeze(canvasFingerprints),
      rawSurfaceTextRecorded: false,
    });
  };

  const scanPhysicalScreenshotPixels = (bytes) => {
    const lookup = spawnSync('where.exe', ['tesseract.exe'], { encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 });
    if (lookup.status !== 0 || !lookup.stdout.trim()) return Object.freeze({ status: 'NOT_RUN_PHYSICAL_PIXEL_OCR', reason: 'TESSERACT_NOT_AVAILABLE', physicalPixelSecretClaimed: false, ocrTextRecorded: false });
    const executable = lookup.stdout.split(/\r?\n/u).map((value) => value.trim()).find(Boolean);
    const ocr = spawnSync(executable, ['stdin', 'stdout', '-l', 'tur+eng'], { input: bytes, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    check(ocr.status === 0, `Tesseract fiziksel piksel taraması çalıştırılamadı: ${(ocr.stderr || 'bilinmeyen hata').trim()}`);
    const result = scanInstalledUiSecretBearingText(ocr.stdout, { sensitiveValues: [...sensitiveValues] });
    check(result.status === 'PASS', 'Fiziksel piksel OCR taraması gizli veri buldu.');
    return Object.freeze({ status: 'PASS_PHYSICAL_PIXEL_OCR', engine: 'TESSERACT', findingCount: 0, ocrTextSha256: sha256Bytes(Buffer.from(ocr.stdout)), physicalPixelSecretClaimed: true, ocrTextRecorded: false });
  };

  const captureScreenshot = async (name, { expectedWidth, expectedHeight, minimumRedactions = 0 } = {}) => {
    check(/^[a-z0-9][a-z0-9-]*\.png$/u.test(name), `Ekran görüntüsü adı güvenli değil: ${name}`);
    check(!screenshotArtifacts.some((item) => item.name === name), `Ekran görüntüsü adı tekrarlandı: ${name}`);
    const secretScan = await redactSensitiveDom();
    try {
      check(secretScan.remainingSensitiveCount === 0, `Ekran görüntüsü öncesi gizli veri taraması FAIL: ${name}`);
      check(secretScan.redactionCount >= minimumRedactions, `Ekran görüntüsü redaksiyon kapsamı eksik: ${name}`);
      const secretSurfaceScan = await scanScreenshotSecretSurfaces();
      const capture = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
      const bytes = Buffer.from(capture.data, 'base64');
      check(bytes.length >= 24 && bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', `Ekran görüntüsü PNG değildir: ${name}`);
      const width = bytes.readUInt32BE(16); const height = bytes.readUInt32BE(20);
      if (expectedWidth) check(width === expectedWidth, `${name} genişliği ${expectedWidth} değildir: ${width}`);
      if (expectedHeight) check(height === expectedHeight, `${name} yüksekliği ${expectedHeight} değildir: ${height}`);
      const physicalPixelOcr = scanPhysicalScreenshotPixels(bytes);
      const targetPath = resolve(options['evidence-root'], name);
      check(strictDescendant(targetPath, options['evidence-root']), 'Ekran görüntüsü evidence root dışına çıkıyor.');
      await evidenceRunRootGuard.assertIntact();
      await writeFile(targetPath, bytes, { flag: 'wx' });
      const readback = await readFile(targetPath);
      await evidenceRunRootGuard.assertIntact();
      check(readback.equals(bytes), `Ekran görüntüsü readback eşleşmedi: ${name}`);
      screenshotArtifacts.push(Object.freeze({
        name,
        relativePath: portable(relative(repositoryRoot, targetPath)),
        sizeBytes: readback.length,
        width,
        height,
        sha256: sha256Bytes(readback),
        readbackVerified: true,
        secretScanApplied: true,
        secretRedactionCount: secretScan.redactionCount,
        secretCategories: secretScan.categories,
        secretSurfaceScan,
        physicalPixelOcr,
        unredactedSecretCount: 0,
      }));
    } finally { await restoreSensitiveDom(); }
  };

  const auditVisibleSurface = async (surfaceId, rootSelector, mode) => {
    const audit = await evaluate(`(() => {
      const root=document.querySelector(${safeJson(rootSelector)});if(!(root instanceof HTMLElement))return {surfaceId:${safeJson(surfaceId)},mode:${safeJson(mode)},missingRoot:true,issues:[]};
      const visible=element=>{const style=getComputedStyle(element);const box=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&box.width>0&&box.height>0;};
      const number=value=>Number.parseFloat(value)||0;
      const name=element=>{const labelled=(element.getAttribute('aria-labelledby')??'').split(/\\s+/u).filter(Boolean).map(id=>document.getElementById(id)?.textContent??'').join(' ').trim();const label=element.id?[...document.querySelectorAll('label')].find(item=>item.htmlFor===element.id)?.textContent??'':'';return [element.getAttribute('aria-label'),labelled,label,element.closest('label')?.textContent,element.getAttribute('title'),element.textContent].find(value=>value?.trim())?.replace(/\\s+/gu,' ').trim()??'';};
      const rgb=value=>{const match=String(value).match(/rgba?\\(\\s*(\\d+(?:\\.\\d+)?)\\s*,\\s*(\\d+(?:\\.\\d+)?)\\s*,\\s*(\\d+(?:\\.\\d+)?)(?:\\s*,\\s*(\\d+(?:\\.\\d+)?))?\\s*\\)/iu);return match?{r:Number(match[1]),g:Number(match[2]),b:Number(match[3]),a:match[4]===undefined?1:Number(match[4])}:null;};
      const composite=(fg,bg)=>{const a=Math.max(0,Math.min(1,fg.a??1));return {r:fg.r*a+bg.r*(1-a),g:fg.g*a+bg.g*(1-a),b:fg.b*a+bg.b*(1-a),a:1};};
      const background=element=>{const layers=[];let current=element;while(current instanceof HTMLElement){const color=rgb(getComputedStyle(current).backgroundColor);if(color&&color.a>0)layers.push(color);current=current.parentElement;}let result={r:255,g:255,b:255,a:1};for(const layer of layers.reverse())result=composite(layer,result);return result;};
      const lum=color=>{const channel=value=>{const x=value/255;return x<=.03928?x/12.92:((x+.055)/1.055)**2.4;};return .2126*channel(color.r)+.7152*channel(color.g)+.0722*channel(color.b);};
      const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
      const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
      const issues=[];const visibleText=(root.innerText??'').replace(/\\s+/gu,' ').trim();
      const fatal=visibleText.match(new RegExp(${safeJson(visibleFatalPattern.source)},'iu'));if(fatal)issues.push({kind:'VISIBLE_TECHNICAL_ERROR',signature:fatal[0].slice(0,80)});
      const shell=document.querySelector('.app-shell');if(shell?.getAttribute('data-ui-language')==='tr'){const leak=visibleText.match(new RegExp(${safeJson(turkishTechnicalLeakPattern.source)},'iu'));if(leak)issues.push({kind:'TURKISH_TECHNICAL_COPY_LEAK',signature:leak[0]});}
      const controls=[...root.querySelectorAll(${safeJson(INSTALLED_UI_ACTIONABLE_SELECTOR)})].filter(visible);
      for(const [index,element] of controls.entries()){
        const box=element.getBoundingClientRect();const style=getComputedStyle(element);const label=name(element).slice(0,100);const disabled=element.hasAttribute('disabled')||element.getAttribute('aria-disabled')==='true';
        if(!label)issues.push({kind:'ACCESSIBLE_NAME_MISSING',index});
        if(!disabled&&element.tabIndex<0)issues.push({kind:'VISIBLE_CONTROL_NOT_TABBABLE',index,label});
        if(element.tabIndex>0)issues.push({kind:'POSITIVE_TABINDEX_FORBIDDEN',index,label,tabIndex:element.tabIndex});
        const compact=element instanceof HTMLInputElement&&['checkbox','radio','range','color','hidden'].includes(element.type);
        if(!compact&&box.height<36)issues.push({kind:'CONTROL_TOO_SHORT',index,label,height:Math.round(box.height)});
        if(!compact&&['INPUT','SELECT','TEXTAREA'].includes(element.tagName)&&number(style.borderTopLeftRadius)<10)issues.push({kind:'TEXT_CONTROL_NOT_ROUNDED',index,label,radius:style.borderTopLeftRadius});
        if(box.left<-1||box.right>innerWidth+1)issues.push({kind:'CONTROL_VIEWPORT_OVERFLOW',index,label,left:Math.round(box.left),right:Math.round(box.right)});
      }
      const textElements=[...root.querySelectorAll('h1,h2,h3,h4,p,label,small,strong,span,button,a,option')].filter(element=>visible(element)&&(element.textContent??'').trim());
      for(const [index,element] of textElements.entries()){
        const style=getComputedStyle(element);const fg=rgb(style.color);const bg=background(element);const fontSize=number(style.fontSize);if(fontSize<12)issues.push({kind:'VISIBLE_TEXT_TOO_SMALL',index,fontSize:Number(fontSize.toFixed(1))});
        if(fg){const actual=ratio(composite(fg,bg),bg);const required=(fontSize>=24||(number(style.fontWeight)>=700&&fontSize>=18.66))?3:4.5;if(actual+.01<required)issues.push({kind:'VISIBLE_TEXT_LOW_CONTRAST',index,ratio:Number(actual.toFixed(2)),required});}
        if(element.scrollWidth>element.clientWidth+2||element.scrollHeight>element.clientHeight+2){const overflowX=style.overflowX;const overflowY=style.overflowY;if(!['auto','scroll'].includes(overflowX)&&element.scrollWidth>element.clientWidth+2)issues.push({kind:'TEXT_CLIPPED_HORIZONTAL',index});if(!['auto','scroll'].includes(overflowY)&&element.scrollHeight>element.clientHeight+2)issues.push({kind:'TEXT_CLIPPED_VERTICAL',index});}
      }
      const overlapSelector='button,a[href],input,select,textarea,summary,[role="button"],[role="tab"],[role="menuitem"],h1,h2,h3,h4,p,label,small,strong,span';
      const intentionalOverlay=element=>element.matches('[role="tooltip"],.sidebar-popover,.modal-backdrop,.toast-stack,[popover],[data-intentional-overlay="true"]');
      const rectangles=element=>[...element.getClientRects()].filter(rect=>rect.width>1&&rect.height>1);
      const parents=[root,...root.querySelectorAll('*')].filter(element=>element instanceof HTMLElement&&visible(element));
      for(const [parentIndex,parent] of parents.entries()){
        const children=[...parent.children].filter(element=>element instanceof HTMLElement&&element.matches(overlapSelector)&&visible(element)&&!intentionalOverlay(element));
        for(let a=0;a<children.length;a+=1)for(let b=a+1;b<children.length;b+=1)if(rectangles(children[a]).some(left=>rectangles(children[b]).some(right=>overlap(left,right))))issues.push({kind:'VISIBLE_SIBLING_OVERLAP',parentIndex,a,b,leftTag:children[a].tagName.toLowerCase(),rightTag:children[b].tagName.toLowerCase()});
      }
      const spatial=[...root.querySelectorAll(overlapSelector)].filter(element=>element instanceof HTMLElement&&visible(element)&&!intentionalOverlay(element));
      for(let a=0;a<spatial.length;a+=1)for(let b=a+1;b<spatial.length;b+=1){const left=spatial[a];const right=spatial[b];if(left.contains(right)||right.contains(left))continue;if(rectangles(left).some(leftRect=>rectangles(right).some(rightRect=>overlap(leftRect,rightRect))))issues.push({kind:'VISIBLE_CROSS_BRANCH_OVERLAP',a,b,leftTag:left.tagName.toLowerCase(),rightTag:right.tagName.toLowerCase()});}
      const overflowNodes=[root,...root.querySelectorAll('*')].filter(element=>element instanceof HTMLElement&&visible(element)&&element.scrollWidth>element.clientWidth+2);
      for(const [index,element] of overflowNodes.entries()){const overflow=getComputedStyle(element).overflowX;if(!['auto','scroll','hidden','clip'].includes(overflow))issues.push({kind:'UNBOUNDED_NESTED_HORIZONTAL_OVERFLOW',index,tag:element.tagName.toLowerCase(),className:String(element.className??'').slice(0,80)});}
      const focusable=controls.filter(element=>!element.hasAttribute('disabled')&&element.getAttribute('aria-disabled')!=='true');let focusProbe=true;if(focusable[0] instanceof HTMLElement){focusable[0].focus();focusProbe=document.activeElement===focusable[0];if(!focusProbe)issues.push({kind:'FOCUS_PROBE_FAILED'});}
      const moduleFontSizes=[...document.querySelectorAll('.nav-module-toggle')].filter(visible).map(element=>number(getComputedStyle(element).fontSize));const routeFontSizes=[...document.querySelectorAll('.nav-group [data-navigation-route]')].filter(visible).map(element=>number(getComputedStyle(element).fontSize));if(moduleFontSizes.length&&routeFontSizes.length&&Math.min(...moduleFontSizes)<=Math.max(...routeFontSizes))issues.push({kind:'MODULE_HEADING_NOT_LARGER_THAN_SUBMENU',moduleMin:Math.min(...moduleFontSizes),routeMax:Math.max(...routeFontSizes)});
      if(document.documentElement.scrollWidth>innerWidth+2)issues.push({kind:'DOCUMENT_HORIZONTAL_OVERFLOW',scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth});
      return {surfaceId:${safeJson(surfaceId)},mode:${safeJson(mode)},missingRoot:false,viewport:{width:innerWidth,height:innerHeight},controlCount:controls.length,focusableCount:focusable.length,focusProbe,issues};
    })()`);
    visualAudits.push(audit);
    check(!audit.missingRoot, `Görsel denetim kökü eksik: ${surfaceId}`);
    check(audit.issues.length === 0, `Görsel bütünlük FAIL ${surfaceId}: ${JSON.stringify(audit.issues.slice(0, 8))}`);
    return audit;
  };

  const scanVisibleErrors = async (routeId) => {
    const error = await evaluate(`(() => {const text=(document.querySelector('#main-content')?.innerText??'').replace(/\\s+/gu,' ');const match=text.match(new RegExp(${safeJson(visibleFatalPattern.source)},'iu'));const asyncPanel=[...document.querySelectorAll('#main-content .async-state-panel[data-async-state="error"],#main-content .secure-startup-error,[role="alert"]')].find(element=>{const style=getComputedStyle(element);const box=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&box.width>0&&box.height>0;});return match?.[0]??asyncPanel?.textContent?.trim()??'';})()`);
    check(!error, `Rota görünür hata verdi: ${routeId} / ${error}`);
  };

  const createApplicationStateControlBinding = (routeId, logicalControlId) => {
    const controlIdentity = sha256Bytes(Buffer.from(JSON.stringify({ routeId, logicalControlId })));
    const stateKey = sha256Bytes(Buffer.from(JSON.stringify({ controlIdentity, logicalControlId })));
    return Object.freeze({ routeId, controlIdentity, stateKey });
  };

  const createApplicationStateEvidenceMaterial = ({ routeId, controlIdentity, stateKey, outcomeKind, snapshot }) => {
    const frozenSnapshot = Object.freeze({ ...snapshot });
    return Object.freeze({
      routeId,
      controlIdentity,
      stateKey,
      outcomeKind,
      snapshot: frozenSnapshot,
      snapshotSha256: sha256Bytes(Buffer.from(JSON.stringify(frozenSnapshot))),
    });
  };

  const recordApplicationState = (scenario, assertion, evidenceMaterial) => {
    check(INSTALLED_UI_REQUIRED_STATE_SCENARIOS.includes(scenario), `Plan dışı uygulama durum senaryosu: ${scenario}`);
    check(INSTALLED_UI_STATE_ASSERTIONS[scenario]?.includes(assertion), `Plan dışı uygulama durum assertion bağı: ${scenario} / ${assertion}`);
    const current = applicationStateMatrix.get(scenario);
    const rawEvidence = Object.freeze({ ...evidenceMaterial });
    const evidence = [...(current?.evidence ?? []), Object.freeze({
      assertion,
      sha256: sha256Bytes(Buffer.from(JSON.stringify(rawEvidence))),
      rawEvidence,
    })];
    applicationStateMatrix.set(scenario, Object.freeze({ scenario, status: 'PASS', evidence }));
  };

  const discoverSemanticControls = async (routeId, scenario = 'BASELINE') => {
    const controls = await evaluate(`(() => {
    const surfaces=${safeJson(INSTALLED_UI_SEMANTIC_SURFACES)};
    const actionable=${safeJson(INSTALLED_UI_ACTIONABLE_SELECTOR)};
    const visible=element=>{const style=getComputedStyle(element);const box=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&box.width>0&&box.height>0;};
    const roots=surfaces.flatMap(surface=>[...document.querySelectorAll(surface.selector)].map(root=>({surface,root}))).sort((left,right)=>right.surface.priority-left.surface.priority);
    const candidates=[...new Set(roots.flatMap(({root})=>[...root.querySelectorAll(actionable)]))];
    const locatorFor=(element,surfaceRoot)=>{for(const attribute of ['data-navigation-route','id','name','aria-controls']){const value=element.getAttribute(attribute);if(value)return '['+attribute+'='+JSON.stringify(value)+']';}const parts=[];let current=element;while(current instanceof Element&&current!==surfaceRoot&&parts.length<12){const siblings=[...(current.parentElement?.children??[])].filter(item=>item.tagName===current.tagName);parts.unshift(current.tagName.toLowerCase()+':nth-of-type('+(siblings.indexOf(current)+1)+')');current=current.parentElement;}return parts.join('>')||element.tagName.toLowerCase();};
    const nameFor=element=>{const labelled=(element.getAttribute('aria-labelledby')??'').split(/\\s+/u).filter(Boolean).map(id=>document.getElementById(id)?.textContent??'').join(' ');const explicit=element.id?[...document.querySelectorAll('label')].find(label=>label.htmlFor===element.id)?.textContent??'':'';return [element.getAttribute('aria-label'),labelled,explicit,element.closest('label')?.textContent,element.getAttribute('title'),element instanceof HTMLInputElement&&['button','submit','reset'].includes(element.type)?element.value:'',element.textContent].find(value=>value?.trim())?.replace(/\\s+/gu,' ').trim()??element.tagName.toLowerCase();};
    return candidates.filter(visible).map((element,index)=>{const owner=roots.find(({root})=>root===element||root.contains(element));const surfaceId=owner?.surface.id??'main';const sameSurfaceRoots=roots.filter(item=>item.surface.id===surfaceId);const surfaceRootIndex=Math.max(0,sameSurfaceRoots.findIndex(item=>item.root===owner?.root));const runtimeId='installed-uat-semantic-'+${safeJson(routeId)}+'-'+index;element.setAttribute('data-installed-uat-semantic-id',runtimeId);const disabled=element.matches(':disabled')||element.getAttribute('aria-disabled')==='true';const valueState=element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement?(element.value?'NON_EMPTY':'EMPTY'):element instanceof HTMLSelectElement?(element.selectedIndex>=0?'SELECTED':'EMPTY'):'UNSPECIFIED';const inputType=element instanceof HTMLInputElement?element.type:'';const nativeInput=['file','color','date','datetime-local','month','time','week'].includes(inputType);const navigationRouteId=element.getAttribute('data-navigation-route')??'';const dataRoute=element.getAttribute('data-route')??navigationRouteId;const href=element instanceof HTMLAnchorElement?(element.getAttribute('href')??''):'';return {runtimeId,routeId:${safeJson(routeId)},scenario:${safeJson(scenario)},surfaceId,role:element.getAttribute('role')||element.tagName.toLowerCase(),tagName:element.tagName.toLowerCase(),locator:surfaceId+'['+surfaceRootIndex+']>'+locatorFor(element,owner?.root??document.body),label:nameFor(element),visible:true,enabled:!disabled,expanded:element.hasAttribute('aria-expanded')?element.getAttribute('aria-expanded')==='true':undefined,checked:'checked'in element?Boolean(element.checked):element.hasAttribute('aria-checked')?element.getAttribute('aria-checked')==='true':undefined,pressed:element.hasAttribute('aria-pressed')?element.getAttribute('aria-pressed')==='true':undefined,selected:'selected'in element?Boolean(element.selected):element.hasAttribute('aria-selected')?element.getAttribute('aria-selected')==='true':undefined,valueState,actionHint:navigationRouteId?'NAVIGATION_ROUTE':nativeInput?'NATIVE_DIALOG':'STANDARD',inputType,contentEditable:element.isContentEditable,navigationRouteId,dataRoute,href,ariaControls:element.getAttribute('aria-controls')??''};});
  })()`);
    const routeDomSnapshot = controls.map((raw) => {
      const semantic = createSemanticControlIdentity(raw);
      return Object.freeze({ identity: semantic.identity, stateKey: semantic.stateKey, enabled: semantic.enabled, surfaceId: semantic.surfaceId, role: semantic.role, locator: semantic.locator });
    }).toSorted((left, right) => left.stateKey.localeCompare(right.stateKey));
    const routeDomSnapshotSha256 = sha256Bytes(Buffer.from(JSON.stringify(routeDomSnapshot)));
    for (const observation of nativeDialogInventoryObservations.values()) {
      if (observation.specification.routeId !== routeId) continue;
      observation.routeSnapshotHashes.add(routeDomSnapshotSha256);
      for (const raw of controls) {
        const resolved = resolveInstalledUiNativeDialogSpecification(raw);
        if (resolved?.specId !== observation.specification.specId) continue;
        const semantic = createSemanticControlIdentity(raw);
        const target = semantic.enabled ? observation.enabledControls : observation.disabledControls;
        target.set(semantic.stateKey, Object.freeze({ identity: semantic.identity, stateKey: semantic.stateKey, enabled: semantic.enabled }));
      }
    }
    return controls;
  };

  const interactionSnapshot = async (runtimeId) => evaluate(`(() => {
    const target=document.querySelector('[data-installed-uat-semantic-id='+JSON.stringify(${safeJson(runtimeId)})+']');
    const clean=value=>String(value??'').replace(/\\s+/gu,' ').trim().slice(0,4000);
    const alerts=[...document.querySelectorAll('[role="alert"],.async-state-panel[data-async-state="error"],.field-error')].filter(element=>{const style=getComputedStyle(element);const box=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&box.width>0&&box.height>0;}).map(element=>clean(element.textContent));
    const currentRoute=document.querySelector('[data-navigation-route][aria-current="page"]')?.getAttribute('data-navigation-route')??'';
    const targetState=target instanceof HTMLElement?{connected:target.isConnected,disabled:target.matches(':disabled')||target.getAttribute('aria-disabled')==='true',expanded:target.getAttribute('aria-expanded'),checked:'checked'in target?Boolean(target.checked):target.getAttribute('aria-checked'),pressed:target.getAttribute('aria-pressed'),selected:'selected'in target?Boolean(target.selected):target.getAttribute('aria-selected'),valueState:'value'in target&&String(target.value)?'NON_EMPTY':'EMPTY'}:{connected:false};
    const controlledId=target instanceof HTMLElement?target.getAttribute('aria-controls'):'';const controlled=controlledId?document.getElementById(controlledId):null;const scope=target instanceof HTMLElement?target.closest('form,.panel,.card,[role="dialog"],#main-content'):null;
    const semanticNode=node=>node instanceof HTMLElement?{connected:node.isConnected,hidden:node.hidden||node.getAttribute('aria-hidden')==='true',childCount:node.querySelectorAll('*').length,text:clean(node.innerText),dataState:node.getAttribute('data-state')??node.getAttribute('data-async-state')??''}:{connected:false};
    const statusMessages=[...document.querySelectorAll('[role="status"],[aria-live]')].filter(element=>{const style=getComputedStyle(element);const box=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&box.width>0&&box.height>0;}).map(element=>clean(element.textContent)).filter(Boolean);
    return {currentRoute,language:document.querySelector('.app-shell')?.getAttribute('data-ui-language')??'',targetState,controlledRegion:semanticNode(controlled),targetScope:semanticNode(scope),alerts,statusMessages,dialogCount:document.querySelectorAll('.modal,[role="dialog"],[role="menu"],[popover]:popover-open').length};
  })()`);

  const performCdpControlGesture = async (rawControl) => {
    const target = await evaluate(`(() => {const element=document.querySelector('[data-installed-uat-semantic-id='+JSON.stringify(${safeJson(rawControl.runtimeId)})+']');if(!(element instanceof HTMLElement))return null;element.scrollIntoView({block:'center',inline:'center'});element.focus({preventScroll:true});const box=element.getBoundingClientRect();const top=document.elementFromPoint(box.left+box.width/2,box.top+box.height/2);const style=getComputedStyle(element);const role=element.getAttribute('role')||element.tagName.toLowerCase();const type=element instanceof HTMLInputElement?element.type:'';const focusVisible=document.activeElement===element&&box.left>=0&&box.top>=0&&box.right<=innerWidth&&box.bottom<=innerHeight&&style.visibility!=='hidden'&&style.display!=='none';const modal=element.closest('.modal,[role="dialog"]');if(modal)modal.setAttribute('data-installed-uat-gesture-modal','true');return {x:box.left+box.width/2,y:box.top+box.height/2,tag:element.tagName.toLowerCase(),role,type,contentEditable:element.isContentEditable,inModal:Boolean(modal),hit:top===element||element.contains(top),focusVisible};})()`);
    check(target?.hit, `Kontrol gerçek pointer hedefi değildir: ${rawControl.routeId} / ${rawControl.label}`);
    check(target.focusVisible, `Kontrol klavye odağı görünür değildir: ${rawControl.routeId} / ${rawControl.label}`);
    const dispatchKey = async (key, code) => {
      await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
      await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
    };
    let modalFocusTrap = 'NOT_APPLICABLE_NO_OPEN_MODAL';
    if (target.inModal) {
      const modalReady = await evaluate(`(() => {const modal=document.querySelector('[data-installed-uat-gesture-modal="true"]');if(!(modal instanceof HTMLElement))return false;const items=[...modal.querySelectorAll(${safeJson(INSTALLED_UI_ACTIONABLE_SELECTOR)})].filter(element=>!element.matches(':disabled')&&element.getAttribute('aria-disabled')!=='true'&&element.tabIndex>=0);if(items.length===0)return false;items.at(-1).focus();return true;})()`);
      check(modalReady, `Modal odak kapanı için etkin kontrol bulunamadı: ${rawControl.routeId} / ${rawControl.label}`);
      await dispatchKey('Tab', 'Tab');
      const forwardContained = await evaluate(`document.querySelector('[data-installed-uat-gesture-modal="true"]')?.contains(document.activeElement)===true`);
      await evaluate(`document.querySelector('[data-installed-uat-gesture-modal="true"]')?.querySelector(${safeJson(INSTALLED_UI_ACTIONABLE_SELECTOR)})?.focus()`);
      await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', modifiers: 8 }); await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', modifiers: 8 });
      const reverseContained = await evaluate(`document.querySelector('[data-installed-uat-gesture-modal="true"]')?.contains(document.activeElement)===true`);
      check(forwardContained && reverseContained, `Modal ileri/geri odak kapanı başarısız: ${rawControl.routeId} / ${rawControl.label}`);
      modalFocusTrap = 'FORWARD_AND_REVERSE_CONTAINMENT_PASS';
      await evaluate(`document.querySelector('[data-installed-uat-semantic-id='+JSON.stringify(${safeJson(rawControl.runtimeId)})+']')?.focus({preventScroll:true})`);
    }
    let expectedKeyboardActivation;
    let supplementalInputMethod = 'NONE';
    const pointerGesture = await dispatchPrimaryPointerGesture({ x: target.x, y: target.y, expectedRuntimeId: rawControl.runtimeId, routeId: rawControl.routeId });
    if (target.contentEditable || (['input', 'textarea'].includes(target.tag) && !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'range', 'color', 'date', 'datetime-local', 'month', 'time', 'week'].includes(target.type))) {
      supplementalInputMethod = 'KEYBOARD_TEXT_ENTRY';
      expectedKeyboardActivation = 'TEXT_ENTRY';
      await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Control', code: 'ControlLeft', modifiers: 2 });
      await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2 });
      await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2 });
      await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Control', code: 'ControlLeft' });
      await client.send('Input.insertText', { text: `UAT-${syntheticSuffix}` });
      await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
      await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' });
    } else if (target.tag === 'select') {
      supplementalInputMethod = 'KEYBOARD_SELECTION';
      expectedKeyboardActivation = 'SELECTION_KEYS';
      await dispatchKey('ArrowDown', 'ArrowDown');
      await dispatchKey('Enter', 'Enter');
    } else if (target.tag === 'input' && target.type === 'range') {
      supplementalInputMethod = 'KEYBOARD_SELECTION';
      expectedKeyboardActivation = 'SELECTION_KEYS';
      await dispatchKey('ArrowRight', 'ArrowRight');
    } else if ((target.tag === 'input' && ['checkbox', 'radio'].includes(target.type)) || ['checkbox', 'radio', 'switch'].includes(target.role)) {
      expectedKeyboardActivation = 'SPACE';
    } else if ((target.tag === 'input' && ['button', 'submit', 'reset'].includes(target.type)) || ['button', 'a', 'link', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'summary'].includes(target.role)) {
      expectedKeyboardActivation = 'ENTER';
    } else {
      expectedKeyboardActivation = 'FOCUS_ONLY';
    }
    const gesture = Object.freeze({ ...pointerGesture, runtimeId: rawControl.runtimeId, expectedKeyboardActivation, supplementalInputMethod, modalFocusTrap, hitTestPassed: true, focusVisible: true });
    return Object.freeze({ ...gesture, sha256: sha256Bytes(Buffer.from(JSON.stringify(gesture))) });
  };

  const buildOutcomeOracle = async (control, rawControl, requestedDialogDecision) => {
    const before = await interactionSnapshot(rawControl.runtimeId);
    const dialogCountBefore = javascriptDialogs.length;
    if (requestedDialogDecision) dialogDecisionQueue.push(requestedDialogDecision);
    const gesture = await performCdpControlGesture(rawControl);
    const quietWindow = await waitForInteractionQuietWindow(`${control.routeId} / ${control.label}`);
    if (requestedDialogDecision && javascriptDialogs.length === dialogCountBefore) {
      const pendingIndex = dialogDecisionQueue.indexOf(requestedDialogDecision);
      if (pendingIndex >= 0) dialogDecisionQueue.splice(pendingIndex, 1);
    }
    const after = await interactionSnapshot(rawControl.runtimeId);
    const beforeFingerprint = sha256Bytes(Buffer.from(JSON.stringify(before)));
    const afterFingerprint = sha256Bytes(Buffer.from(JSON.stringify(after)));
    const dialog = javascriptDialogs.at(-1);
    const semanticStateChanged = beforeFingerprint !== afterFingerprint;
    const targetStateChanged = JSON.stringify(before.targetState) !== JSON.stringify(after.targetState);
    const controlledRegionChanged = JSON.stringify(before.controlledRegion) !== JSON.stringify(after.controlledRegion);
    const targetScopeChanged = JSON.stringify(before.targetScope) !== JSON.stringify(after.targetScope);
    const statusChanged = JSON.stringify(before.statusMessages) !== JSON.stringify(after.statusMessages);
    const alertChanged = JSON.stringify(before.alerts) !== JSON.stringify(after.alerts);
    const canonicalNavigationRoute = PRODUCT_NAVIGATION_ROUTES.some((route) => route.id === rawControl.navigationRouteId)
      && rawControl.dataRoute === rawControl.navigationRouteId
      && control.actionHint === 'NAVIGATION_ROUTE';
    const routeReadback = canonicalNavigationRoute && after.currentRoute === rawControl.navigationRouteId;
    const safety = classifyInstalledUiActionSafety(control);
    let kind;
    let assertions;
    let postconditionKind;
    let actionSpecificReadback = false;
    const dialogObserved = javascriptDialogs.length > dialogCountBefore;
    if (safety.classification === 'DISPOSABLE_PROFILE_SAFE_OUTCOME_REQUIRED') {
      check(dialogObserved && dialog?.decision === requestedDialogDecision, `Terminal eylem kontrollü ${requestedDialogDecision ?? 'cancel/accept'} onayı üretmedi: ${control.label}`);
      check(requestedDialogDecision === 'CANCEL' ? !semanticStateChanged : semanticStateChanged, `Terminal ${requestedDialogDecision} gerçek son-koşul readback vermedi: ${control.label}`);
      kind = 'TERMINAL_DISPOSABLE_PROFILE';
      actionSpecificReadback = true;
      postconditionKind = requestedDialogDecision === 'CANCEL' ? 'TERMINAL_CANCEL_STATE_UNCHANGED' : 'TERMINAL_ACCEPT_STATE_CHANGED';
      assertions = [{ id: postconditionKind, status: 'PASS' }];
      recordApplicationState(requestedDialogDecision === 'ACCEPT' ? 'CONFIRM_ACCEPT' : 'CONFIRM_CANCEL', 'JAVASCRIPT_CONFIRMATION_AND_TERMINAL_POSTCONDITION', createApplicationStateEvidenceMaterial({
        routeId: control.routeId,
        controlIdentity: control.identity,
        stateKey: control.stateKey,
        outcomeKind: 'TERMINAL_DISPOSABLE_PROFILE',
        snapshot: { decision: requestedDialogDecision, beforeFingerprint, afterFingerprint },
      }));
    } else if (dialogObserved) {
      kind = dialog?.decision === 'ACCEPT' ? 'CONFIRM_ACCEPT' : 'CONFIRM_CANCEL';
      assertions = [{ id: dialog?.decision === 'ACCEPT' ? 'CONFIRMATION_ACCEPTED' : 'CONFIRMATION_CANCELLED', status: 'PASS' }];
      actionSpecificReadback = true;
      postconditionKind = dialog?.decision === 'ACCEPT' ? 'DIALOG_ACCEPT_READBACK' : 'DIALOG_CANCEL_READBACK';
      recordApplicationState(kind, 'JAVASCRIPT_CONFIRMATION_OBSERVED', createApplicationStateEvidenceMaterial({
        routeId: control.routeId,
        controlIdentity: control.identity,
        stateKey: control.stateKey,
        outcomeKind: kind,
        snapshot: { decision: dialog?.decision, beforeFingerprint, afterFingerprint },
      }));
    } else if (alertChanged && after.alerts.length > 0) {
      const visibleAlertText = after.alerts.join(' ');
      check(!visibleFatalPattern.test(visibleAlertText), `Etkileşim sonrası teknik hata metni sızdı: ${control.routeId} / ${control.label}`);
      if (after.language === 'tr') check(!turkishTechnicalLeakPattern.test(visibleAlertText), `Türkçe etkileşim mesajında teknik sözlük sızdı: ${control.routeId} / ${control.label}`);
      kind = 'VALIDATION_REJECTION';
      assertions = [{ id: 'NATURAL_VALIDATION_MESSAGE_VISIBLE', status: 'PASS' }];
      actionSpecificReadback = true;
      postconditionKind = 'TARGET_VALIDATION_MESSAGE_CHANGED';
      recordApplicationState('VALIDATION_ERROR', 'NATURAL_VALIDATION_MESSAGE_VISIBLE', createApplicationStateEvidenceMaterial({
        routeId: control.routeId,
        controlIdentity: control.identity,
        stateKey: control.stateKey,
        outcomeKind: 'VALIDATION_REJECTION',
        snapshot: { rejected: true, alertChanged: true, visibleAlertCount: after.alerts.length },
      }));
      if (after.alerts.some((message) => /izin|yetki|permission|authority|erişim reddedildi|access denied/iu.test(message))) recordApplicationState('PERMISSION_DENIED', 'VISIBLE_PERMISSION_DENIAL_AFTER_GESTURE', createApplicationStateEvidenceMaterial({
        routeId: control.routeId,
        controlIdentity: control.identity,
        stateKey: control.stateKey,
        outcomeKind: 'VALIDATION_REJECTION',
        snapshot: {
          visible: true,
          visibleSelector: '[role="alert"],.async-state-panel[data-async-state="error"],.field-error',
          textSha256: sha256Bytes(Buffer.from(JSON.stringify(after.alerts))),
          actionCorrelation: { controlIdentity: control.identity, stateKey: control.stateKey, gestureSha256: gesture.sha256 },
        },
      }));
    } else if (targetStateChanged || controlledRegionChanged || targetScopeChanged || statusChanged || before.currentRoute !== after.currentRoute) {
      kind = 'STATE_CHANGE';
      assertions = [{ id: 'VISIBLE_STATE_FINGERPRINT_CHANGED', status: 'PASS' }];
      actionSpecificReadback = true;
      postconditionKind = targetStateChanged ? 'TARGET_STATE_CHANGED' : controlledRegionChanged ? 'ARIA_CONTROLLED_REGION_CHANGED' : targetScopeChanged ? 'TARGET_SEMANTIC_SCOPE_CHANGED' : statusChanged ? 'VISIBLE_STATUS_CHANGED' : 'NAVIGATION_ROUTE_CHANGED';
    } else if (routeReadback) {
      kind = 'IDEMPOTENT_READ_ONLY';
      assertions = [{ id: 'ACTION_SPECIFIC_READBACK_VERIFIED', status: 'PASS' }];
      actionSpecificReadback = true;
      postconditionKind = 'NAVIGATION_ROUTE_CURRENT';
    } else {
      fail(`Etkileşim eyleme özgü görünür veya kalıcı son-koşul üretmedi: ${control.routeId} / ${control.label}`);
    }
    const { sha256: gestureSha256, ...gestureEvidence } = gesture;
    const routeReadbackEvidence = kind === 'IDEMPOTENT_READ_ONLY' ? Object.freeze({ status: 'PASS', expectedRouteId: control.navigationRouteId, observedRouteId: after.currentRoute, controlDataRoute: control.dataRoute, controlHref: control.href, controlRole: control.role }) : undefined;
    return Object.freeze({
      status: 'PASS', kind, settled: true, userGesture: 'POINTER_MOUSE_PRESS_RELEASE', beforeFingerprint, afterFingerprint,
      semanticStateChanged,
      actionSpecificReadback,
      actionCorrelation: { controlIdentity: control.identity, stateKey: control.stateKey, gestureSha256, gesture: gestureEvidence },
      postcondition: { status: 'PASS', actionSpecific: true, kind: postconditionKind },
      keyboardActivation: { status: 'PASS', expected: gesture.expectedKeyboardActivation, actual: gesture.expectedKeyboardActivation, focusVisible: gesture.focusVisible, modalFocusTrap: gesture.modalFocusTrap },
      evidence: [{ kind: 'CDP_ACTION_SPECIFIC_OUTCOME_READBACK', sha256: sha256Bytes(Buffer.from(JSON.stringify({ routeId: control.routeId, stateKey: control.stateKey, kind, beforeFingerprint, afterFingerprint, postconditionKind, quietWindow }))) }],
      assertions,
      quietWindow,
      ...(routeReadbackEvidence ? { routeReadback: routeReadbackEvidence } : {}),
      ...(kind === 'TERMINAL_DISPOSABLE_PROFILE' ? {
        profileClassification: 'SYNTHETIC_DISPOSABLE_PROFILE',
        terminalDecision: requestedDialogDecision,
        terminalPostcondition: { status: 'PASS', observed: true, decision: requestedDialogDecision, kind: postconditionKind, controlIdentity: control.identity, stateKey: control.stateKey, beforeFingerprint, afterFingerprint },
      } : {}),
    });
  };

  const executeNativeDialogDecision = async ({ control, rawControl, specification, decision, selection, javascriptConfirmationDecision }) => {
    const before = await interactionSnapshot(rawControl.runtimeId);
    const javascriptDialogCountBefore = javascriptDialogs.length;
    const selectionBefore = await readInstalledUiNativeDialogSelection(selection, {
      requirePresent: specification.dialogKind === 'OPEN',
    });
    captureOwnedProcessTree(rootIdentity, ownedIdentities);
    const ownedProcessIdentities = [...ownedIdentities.values()].map(({ processId, creationTimeUtc }) => ({ processId, creationTimeUtc }));
    const evidenceName = `native-${control.routeId}-${control.identity.slice(0, 12)}-${decision.toLowerCase()}.png`;
    const screenshotPath = resolve(options['evidence-root'], evidenceName);
    check(strictDescendant(screenshotPath, options['evidence-root']), 'Native dialog screenshot evidence root dışına çıkıyor.');
    await evidenceRunRootGuard.assertIntact();
    const automation = beginWindowsNativeFileDialogAutomation({
      decision,
      ownedProcessIdentities,
      selectionPath: selection.path,
      screenshotPath,
    });
    let gesture;
    let automated;
    try {
      await automation.ready;
      if (javascriptConfirmationDecision) dialogDecisionQueue.push(javascriptConfirmationDecision);
      automation.start();
      gesture = await performCdpControlGesture(rawControl);
      automated = await automation.completion;
    } catch (error) {
      if (javascriptConfirmationDecision) {
        const pendingIndex = dialogDecisionQueue.indexOf(javascriptConfirmationDecision);
        if (pendingIndex >= 0) dialogDecisionQueue.splice(pendingIndex, 1);
      }
      if (automation.child.exitCode === null) automation.child.kill();
      throw error;
    }
    if (javascriptConfirmationDecision) {
      const observed = javascriptDialogs.slice(javascriptDialogCountBefore).find((item) => item.decision === javascriptConfirmationDecision);
      check(observed, `Native dialog öncesi JavaScript ${javascriptConfirmationDecision} onayı gözlenmedi: ${control.routeId} / ${control.label}`);
    }
    await evidenceRunRootGuard.assertIntact();
    const screenshotBinding = await readRegularFileBinding(screenshotPath, `Native dialog screenshot ${decision}`);
    check(screenshotBinding.bytes.length >= 24 && screenshotBinding.bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'Native dialog screenshot PNG değildir.');
    const physicalPixelOcr = scanPhysicalScreenshotPixels(screenshotBinding.bytes);
    const quietWindow = await waitForInteractionQuietWindow(`native ${decision} ${control.routeId} / ${control.label}`);
    const after = await interactionSnapshot(rawControl.runtimeId);
    const selectionAfter = await readInstalledUiNativeDialogSelection(selection, {
      requirePresent: specification.dialogKind === 'OPEN' || decision === 'ACCEPT',
    });
    if (specification.dialogKind === 'OPEN') {
      check(selectionBefore.sha256 === selectionAfter.sha256 && selectionBefore.sizeBytes === selectionAfter.sizeBytes,
        `Native OPEN ${decision} sentetik seçim dosyasını değiştirdi.`);
    }
    const beforeFingerprint = sha256Bytes(Buffer.from(JSON.stringify(before)));
    const afterFingerprint = sha256Bytes(Buffer.from(JSON.stringify(after)));
    const semanticStateChanged = beforeFingerprint !== afterFingerprint;
    check(decision === 'CANCEL' || specification.dialogKind === 'SAVE' || semanticStateChanged,
      `Native OPEN ACCEPT uygulama son-koşulu üretmedi: ${control.routeId} / ${control.label}`);
    const targetWindowIdentity = sha256Bytes(Buffer.from(JSON.stringify(automated.targetWindow)));
    const { sha256: gestureSha256, ...gestureEvidence } = gesture;
    return Object.freeze({
      status: 'PASS',
      decision,
      targetObserved: automated.targetObserved === true,
      targetClosed: automated.targetClosed === true,
      dialogKind: specification.dialogKind,
      beforeFingerprint,
      afterFingerprint,
      semanticStateChanged,
      actionCorrelation: Object.freeze({ controlIdentity: control.identity, stateKey: control.stateKey, gestureSha256, gesture: gestureEvidence }),
      targetWindow: Object.freeze({ ...automated.targetWindow, identitySha256: targetWindowIdentity }),
      screenshot: Object.freeze({
        path: portable(relative(repositoryRoot, screenshotPath)),
        sizeBytes: screenshotBinding.sizeBytes,
        sha256: screenshotBinding.sha256,
        width: screenshotBinding.bytes.readUInt32BE(16),
        height: screenshotBinding.bytes.readUInt32BE(20),
        readbackVerified: true,
        targetOnly: automated.targetWindow.printWindowTargetOnly === true,
        physicalPixelOcr,
      }),
      selection: Object.freeze({
        kind: selection.kind,
        synthetic: true,
        fileName: selectionAfter.fileName ?? selection.fileName,
        extension: selectionAfter.extension ?? selection.extension,
        existsAfterDecision: selectionAfter.exists,
        sizeBytes: selectionAfter.sizeBytes ?? 0,
        sha256: selectionAfter.sha256 ?? null,
        pathRecorded: false,
        withinDisposableProfile: true,
      }),
      postcondition: Object.freeze({
        status: 'PASS',
        kind: decision === 'CANCEL'
          ? 'NATIVE_DIALOG_CANCELLED_WITHOUT_SELECTION_MUTATION'
          : specification.dialogKind === 'SAVE'
            ? 'NATIVE_SAVE_ARTIFACT_READBACK_VERIFIED'
            : 'NATIVE_OPEN_SELECTION_AND_APPLICATION_READBACK_VERIFIED',
        applicationReadbackVerified: decision === 'CANCEL' || semanticStateChanged || specification.dialogKind === 'SAVE',
        selectedArtifactReadbackVerified: selectionAfter.exists === true,
      }),
      quietWindow,
      ...(javascriptConfirmationDecision ? { javascriptConfirmationDecision } : {}),
    });
  };

  const buildNativeDialogOutcomeOracle = async (control, rawControl, specification) => {
    const outputToken = `${control.routeId}-${control.identity.slice(0, 12)}-${nativeDialogEvidence.length}`;
    const selection = await createInstalledUiNativeDialogSelection({
      specification,
      fixtureSet: nativeDialogFixtureSet,
      outputToken,
      generatedBackups: generatedNativeBackups,
    });
    const cancel = await executeNativeDialogDecision({ control, rawControl, specification, decision: 'CANCEL', selection });
    const currentControls = await discoverSemanticControls(control.routeId);
    const acceptRawControl = currentControls.find((candidate) => createSemanticControlIdentity(candidate).identity === control.identity);
    check(acceptRawControl, `Native ACCEPT için aynı kontrol yeniden bulunamadı: ${control.routeId} / ${control.label}`);
    const acceptControl = createSemanticControlIdentity(acceptRawControl);
    check(acceptControl.enabled && acceptControl.identity === control.identity, `Native ACCEPT kontrolü etkin/aynı kimlikte değildir: ${control.routeId} / ${control.label}`);
    const accept = await executeNativeDialogDecision({ control: acceptControl, rawControl: acceptRawControl, specification, decision: 'ACCEPT', selection });
    if (specification.dialogKind === 'SAVE' && specification.selectionKind === 'GENERATED_BACKUP') {
      generatedNativeBackups.push(Object.freeze({ ...accept.selection, path: selection.path }));
    }
    const record = Object.freeze({
      specId: specification.specId,
      routeId: control.routeId,
      controlIdentity: control.identity,
      stateKey: control.stateKey,
      labelClass: specification.labelClass,
      dialogKind: specification.dialogKind,
      status: 'PASS',
      cancel,
      accept,
    });
    nativeDialogEvidence.push(record);
    return Object.freeze({
      status: 'PASS',
      kind: 'NATIVE_DIALOG_ACCEPT',
      settled: true,
      userGesture: 'POINTER_MOUSE_PRESS_RELEASE',
      beforeFingerprint: accept.beforeFingerprint,
      afterFingerprint: accept.afterFingerprint,
      semanticStateChanged: accept.semanticStateChanged,
      actionSpecificReadback: true,
      actionCorrelation: accept.actionCorrelation,
      postcondition: Object.freeze({ ...accept.postcondition, actionSpecific: true }),
      keyboardActivation: Object.freeze({ status: 'PASS', expected: accept.actionCorrelation.gesture.expectedKeyboardActivation, actual: accept.actionCorrelation.gesture.expectedKeyboardActivation, focusVisible: accept.actionCorrelation.gesture.focusVisible, modalFocusTrap: accept.actionCorrelation.gesture.modalFocusTrap }),
      evidence: Object.freeze([{ kind: 'WINDOWS_UIAUTOMATION_NATIVE_DIALOG_CANCEL_ACCEPT_READBACK', sha256: sha256Bytes(Buffer.from(JSON.stringify(record))) }]),
      assertions: Object.freeze([
        Object.freeze({ id: 'OWNED_NATIVE_DIALOG_CANCEL_VERIFIED', status: 'PASS' }),
        Object.freeze({ id: 'OWNED_NATIVE_DIALOG_ACCEPT_AND_POSTCONDITION_VERIFIED', status: 'PASS' }),
      ]),
      quietWindow: accept.quietWindow,
      nativeDialog: record,
    });
  };

  const buildTerminalNativeRestoreAcceptOutcome = async (control, rawControl, specification) => {
    check(specification.terminalHybrid && specification.dialogKind === 'OPEN' && specification.selectionKind === 'GENERATED_BACKUP',
      'Terminal/native restore sözleşmesi geçersizdir.');
    check(generatedNativeBackups.length > 0, 'Terminal/native restore için aynı disposable profilde üretilmiş yedek yoktur.');
    const selection = await createInstalledUiNativeDialogSelection({
      specification,
      fixtureSet: nativeDialogFixtureSet,
      outputToken: `${control.routeId}-${control.identity.slice(0, 12)}-terminal`,
      generatedBackups: generatedNativeBackups,
    });
    const cancel = await executeNativeDialogDecision({
      control,
      rawControl,
      specification,
      decision: 'CANCEL',
      selection,
      javascriptConfirmationDecision: 'ACCEPT',
    });
    const controls = await discoverSemanticControls(control.routeId);
    const acceptRawControl = controls.find((candidate) => createSemanticControlIdentity(candidate).identity === control.identity);
    check(acceptRawControl, `Terminal/native ACCEPT için aynı restore kontrolü yeniden bulunamadı: ${control.label}`);
    const acceptControl = createSemanticControlIdentity(acceptRawControl);
    const before = await interactionSnapshot(acceptRawControl.runtimeId);
    const beforeFingerprint = sha256Bytes(Buffer.from(JSON.stringify(before)));
    const knownIdentityKeys = new Set(getWindowsProcessSnapshot().map(processIdentityKey));
    const previousRootIdentity = rootIdentity;
    captureOwnedProcessTree(previousRootIdentity, ownedIdentities);
    const ownedProcessIdentities = [...ownedIdentities.values()].map(({ processId, creationTimeUtc }) => ({ processId, creationTimeUtc }));
    const evidenceName = `native-${control.routeId}-${control.identity.slice(0, 12)}-accept.png`;
    const screenshotPath = resolve(options['evidence-root'], evidenceName);
    await evidenceRunRootGuard.assertIntact();
    const automation = beginWindowsNativeFileDialogAutomation({ decision: 'ACCEPT', ownedProcessIdentities, selectionPath: selection.path, screenshotPath });
    const javascriptDialogCountBefore = javascriptDialogs.length;
    await automation.ready;
    dialogDecisionQueue.push('ACCEPT');
    automation.start();
    const gesture = await performCdpControlGesture(acceptRawControl);
    const automated = await automation.completion;
    check(javascriptDialogs.slice(javascriptDialogCountBefore).some((item) => item.decision === 'ACCEPT'), 'Restore native picker öncesi JavaScript ACCEPT gözlenmedi.');
    await evidenceRunRootGuard.assertIntact();
    const screenshotBinding = await readRegularFileBinding(screenshotPath, 'Terminal/native restore screenshot');
    check(screenshotBinding.bytes.length >= 24 && screenshotBinding.bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'Terminal/native restore screenshot PNG değildir.');
    const selectedReadback = await readInstalledUiNativeDialogSelection(selection, { requirePresent: true });
    check(selectedReadback.sha256 === selection.sha256 && selectedReadback.sizeBytes === selection.sizeBytes, 'Restore seçilen disposable yedek readback bağı değişti.');
    const replacementRoot = await waitForRelaunchedRootIdentity({
      previousRootIdentity,
      knownIdentityKeys,
      executablePath: options['installed-exe'],
      remoteDebuggingPort,
    });
    ownedIdentities.set(processIdentityKey(replacementRoot), replacementRoot);
    captureOwnedProcessTree(replacementRoot, ownedIdentities);
    client?.close();
    activeNetworkRequests.clear();
    networkActivity.inFlight = 0;
    rootIdentity = replacementRoot;
    client = await connectCdpClient(remoteDebuggingPort);
    await installInteractionActivityTelemetry();
    await waitFor(`document.body&&document.body.innerText.length>0`, 'restore sonrası yeniden başlatılan kullanıcı yüzeyi', 45_000);
    const restoredAuth = await evaluate(`window.pardus.getAuthState()`);
    check(restoredAuth?.initialized === true && restoredAuth?.authenticated === false,
      'Restore sonrası yeniden başlatma güvenli yeniden giriş durumuna ulaşmadı.');
    const quietWindow = await waitForInteractionQuietWindow('terminal/native restore owned relaunch');
    const processPostcondition = Object.freeze({
      previousProcessId: previousRootIdentity.processId,
      previousCreationTimeUtc: previousRootIdentity.creationTimeUtc,
      previousRootAbsent: !getWindowsProcessSnapshot().some((item) => processIdentityKey(item) === processIdentityKey(previousRootIdentity)),
      replacementProcessId: replacementRoot.processId,
      replacementCreationTimeUtc: replacementRoot.creationTimeUtc,
      replacementExecutableSha256: installedIdentityBefore.sha256,
      exactExecutablePathVerified: normalizeWindowsPath(replacementRoot.executablePath) === normalizeWindowsPath(options['installed-exe']),
      remoteDebuggingPortInherited: String(replacementRoot.commandLine ?? '').includes(`--remote-debugging-port=${remoteDebuggingPort}`),
      restoredAccountInitialized: restoredAuth.initialized === true,
      authenticatedSessionRevoked: restoredAuth.authenticated === false,
    });
    check(processPostcondition.previousRootAbsent && processPostcondition.exactExecutablePathVerified
      && processPostcondition.remoteDebuggingPortInherited && processPostcondition.authenticatedSessionRevoked,
    'Restore terminal ACCEPT owned relaunch/oturum iptali son-koşulu eksiktir.');
    const afterFingerprint = sha256Bytes(Buffer.from(JSON.stringify(processPostcondition)));
    const { sha256: gestureSha256, ...gestureEvidence } = gesture;
    const targetWindow = Object.freeze({ ...automated.targetWindow, identitySha256: sha256Bytes(Buffer.from(JSON.stringify(automated.targetWindow))) });
    const accept = Object.freeze({
      status: 'PASS', decision: 'ACCEPT', targetObserved: true, targetClosed: true, dialogKind: 'OPEN',
      beforeFingerprint, afterFingerprint, semanticStateChanged: true,
      actionCorrelation: Object.freeze({ controlIdentity: control.identity, stateKey: control.stateKey, gestureSha256, gesture: gestureEvidence }),
      targetWindow,
      screenshot: Object.freeze({
        path: portable(relative(repositoryRoot, screenshotPath)), sizeBytes: screenshotBinding.sizeBytes, sha256: screenshotBinding.sha256,
        width: screenshotBinding.bytes.readUInt32BE(16), height: screenshotBinding.bytes.readUInt32BE(20), readbackVerified: true,
        targetOnly: automated.targetWindow.printWindowTargetOnly === true, physicalPixelOcr: scanPhysicalScreenshotPixels(screenshotBinding.bytes),
      }),
      selection: Object.freeze({ kind: selection.kind, synthetic: true, fileName: selectedReadback.fileName, extension: selectedReadback.extension,
        existsAfterDecision: true, sizeBytes: selectedReadback.sizeBytes, sha256: selectedReadback.sha256, pathRecorded: false, withinDisposableProfile: true }),
      postcondition: Object.freeze({ status: 'PASS', kind: 'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK', applicationReadbackVerified: true, selectedArtifactReadbackVerified: true, process: processPostcondition }),
      quietWindow,
      javascriptConfirmationDecision: 'ACCEPT',
    });
    const record = Object.freeze({ specId: specification.specId, routeId: control.routeId, controlIdentity: control.identity, stateKey: control.stateKey,
      labelClass: specification.labelClass, dialogKind: specification.dialogKind, status: 'PASS', cancel, accept });
    nativeDialogEvidence.push(record);
    return Object.freeze({
      status: 'PASS', kind: 'TERMINAL_DISPOSABLE_PROFILE', settled: true, userGesture: 'POINTER_MOUSE_PRESS_RELEASE',
      beforeFingerprint, afterFingerprint, semanticStateChanged: true, actionSpecificReadback: true,
      actionCorrelation: accept.actionCorrelation,
      postcondition: Object.freeze({ status: 'PASS', actionSpecific: true, kind: 'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK' }),
      keyboardActivation: Object.freeze({ status: 'PASS', expected: gesture.expectedKeyboardActivation, actual: gesture.expectedKeyboardActivation, focusVisible: gesture.focusVisible, modalFocusTrap: gesture.modalFocusTrap }),
      evidence: Object.freeze([{ kind: 'WINDOWS_UIAUTOMATION_NATIVE_RESTORE_TERMINAL_READBACK', sha256: sha256Bytes(Buffer.from(JSON.stringify(record))) }]),
      assertions: Object.freeze([{ id: 'NATIVE_RESTORE_CANCEL_AND_ACCEPT_VERIFIED', status: 'PASS' }, { id: 'OWNED_RELAUNCH_AND_SESSION_REVOCATION_VERIFIED', status: 'PASS' }]),
      quietWindow,
      profileClassification: 'SYNTHETIC_DISPOSABLE_PROFILE', terminalDecision: 'ACCEPT',
      terminalPostcondition: Object.freeze({ status: 'PASS', observed: true, decision: 'ACCEPT', kind: 'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK',
        controlIdentity: control.identity, stateKey: control.stateKey, beforeFingerprint, afterFingerprint, process: processPostcondition }),
      nativeDialog: record,
    });
  };

  const exerciseRouteControls = async (routeId) => {
    for (let round = 0; round < 480; round += 1) {
      const quietWindow = await waitForInteractionQuietWindow(`${routeId} fixed-point turu ${round + 1}`);
      const rawControls = await discoverSemanticControls(routeId);
      const rawByStateKey = new Map(rawControls.map((raw) => [createSemanticControlIdentity(raw).stateKey, raw]));
      const pass = interactionCoverageEngine.observePass({ routeId, scenario: 'BASELINE', controls: rawControls, quietWindow });
      const control = interactionCoverageEngine.pending().find((candidate) => candidate.routeId === routeId);
      if (!control) {
        if (pass.stablePasses >= 2) return;
        await delay(100);
        continue;
      }
      const rawControl = rawByStateKey.get(control.stateKey);
      check(rawControl, `Yeni keşfedilen kontrol aynı turda kayboldu: ${routeId} / ${control.label}`);
      if (!control.enabled) {
        interactionCoverageEngine.classify(control.stateKey, { disposition: 'BLOCKED_DISABLED', reason: 'VISIBLE_DISABLED_OR_PRECONDITION_NOT_MET' });
        continue;
      }
      const safety = classifyInstalledUiActionSafety(control);
      const nativeDialogSpecification = resolveInstalledUiNativeDialogSpecification(control);
      if (nativeDialogSpecification && nativeDialogSpecification.terminalHybrid) {
        check(safety.classification === 'DISPOSABLE_PROFILE_SAFE_OUTCOME_REQUIRED', `Terminal/native birleşik kontrol güvenlik sınıfı geçersiz: ${routeId} / ${control.label}`);
      }
      if (safety.classification === 'NATIVE_TARGET_WINDOW_EVIDENCE_REQUIRED' && !nativeDialogSpecification) fail(`Etkin native kontrol exact rota/etiket sözleşmesinde yok: ${routeId} / ${control.label}`);
      if (safety.classification === 'HARDWARE_OR_EXTERNAL_PROVIDER_EVIDENCE_REQUIRED') {
        fail(`Etkin donanım/dış sağlayıcı kontrolü için eyleme özgü hedef kanıtı yok: ${routeId} / ${control.label}`);
      }
      const requestedDialogDecision = safety.classification === 'DISPOSABLE_PROFILE_SAFE_OUTCOME_REQUIRED'
        ? 'CANCEL'
        : undefined;
      const outcome = nativeDialogSpecification && !nativeDialogSpecification.terminalHybrid
        ? await buildNativeDialogOutcomeOracle(control, rawControl, nativeDialogSpecification)
        : await buildOutcomeOracle(control, rawControl, requestedDialogDecision);
      interactionCoverageEngine.classify(control.stateKey, { disposition: 'CLICKED_OUTCOME_VERIFIED', outcome });
      if (safety.classification === 'DISPOSABLE_PROFILE_SAFE_OUTCOME_REQUIRED' && !terminalAcceptProbes.some((probe) => probe.control.identity === control.identity)) terminalAcceptProbes.push({ routeId, control });
      await scanVisibleErrors(routeId);
      const stillOnRoute = await evaluate(`document.querySelector('[data-navigation-route="${routeId}"]')?.getAttribute('aria-current')==='page'`);
      if (!stillOnRoute) await navigateToRoute(routeId);
    }
    fail(`Rota semantik etkileşim keşfi 480 turda fixed-point'e ulaşmadı: ${routeId}`);
  };

  const auditKeyboardScrollAndTooltip = async (routeId) => {
    const semanticControls = await discoverSemanticControls(routeId);
    const semanticByRuntimeId = new Map(semanticControls.map((raw) => [raw.runtimeId, createSemanticControlIdentity(raw)]));
    const setup = await evaluate(`(() => {const root=document.querySelector('#main-content');if(!(root instanceof HTMLElement))return null;const visible=element=>{const style=getComputedStyle(element);const box=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&box.width>0&&box.height>0;};const enabled=[...document.querySelectorAll('[data-installed-uat-semantic-id]')].filter(element=>visible(element)&&!element.matches(':disabled')&&element.getAttribute('aria-disabled')!=='true'&&element.tabIndex>=0);const tooltipTargets=[...document.querySelectorAll('[title],[aria-describedby]')].filter(visible).map((element,index)=>{const id='tip-'+index;element.setAttribute('data-installed-uat-tooltip-id',id);return {id,semanticRuntimeId:element.getAttribute('data-installed-uat-semantic-id')??'',stableSource:element.id?'id:'+element.id:'tip-index:'+index};});const scrollContainers=[document.scrollingElement,...document.querySelectorAll('*')].filter((element,index,items)=>element&&items.indexOf(element)===index&&visible(element)&&(element===document.scrollingElement||element.scrollHeight>element.clientHeight+2||element.scrollWidth>element.clientWidth+2));scrollContainers.forEach((element,index)=>element.setAttribute('data-installed-uat-scroll-id','scroll-'+index));const modal=[...document.querySelectorAll('.modal,[role="dialog"]')].find(visible);if(modal)modal.setAttribute('data-installed-uat-modal','true');document.activeElement instanceof HTMLElement&&document.activeElement.blur();scrollTo({top:0,behavior:'instant'});return {enabledRuntimeIds:enabled.map(element=>element.getAttribute('data-installed-uat-semantic-id')).filter(Boolean),tooltipTargets,scrollIds:scrollContainers.map(element=>element.getAttribute('data-installed-uat-scroll-id')),modalPresent:Boolean(modal),currentRouteId:document.querySelector('[data-navigation-route][aria-current="page"]')?.getAttribute('data-navigation-route')??''};})()`);
    check(setup && setup.currentRouteId === routeId, `Klavye denetimi rota bağını kaybetti: ${routeId}`);
    check(setup.enabledRuntimeIds.every((runtimeId) => semanticByRuntimeId.has(runtimeId)), `Klavye denetimi semantik keşif dışı etkin kontrol taşıyor: ${routeId}`);
    const enabledControlIdentities = setup.enabledRuntimeIds.map((runtimeId) => semanticByRuntimeId.get(runtimeId).identity).toSorted();
    const enabledControlStateKeys = setup.enabledRuntimeIds.map((runtimeId) => semanticByRuntimeId.get(runtimeId).stateKey).toSorted();
    check(new Set(enabledControlIdentities).size === enabledControlIdentities.length && new Set(enabledControlStateKeys).size === enabledControlStateKeys.length, `Klavye denetimi yinelenen etkin kontrol kimliği taşıyor: ${routeId}`);
    const dispatchKey = async (key, code, modifiers = 0) => { await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers }); await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers }); };
    const forward = [];
    for (let index = 0; index < setup.enabledRuntimeIds.length + 2; index += 1) { await dispatchKey('Tab', 'Tab'); const focused = await evaluate(`document.activeElement?.getAttribute('data-installed-uat-semantic-id')??''`); if (focused) forward.push(focused); if (new Set(forward).size === setup.enabledRuntimeIds.length) break; }
    const reverse = [];
    await evaluate(`document.querySelector('[data-installed-uat-semantic-id="${setup.enabledRuntimeIds[0] ?? ''}"]')?.focus()`);
    for (let index = 0; index < setup.enabledRuntimeIds.length + 2; index += 1) { await dispatchKey('Tab', 'Tab', 8); const focused = await evaluate(`document.activeElement?.getAttribute('data-installed-uat-semantic-id')??''`); if (focused) reverse.push(focused); if (new Set(reverse).size === setup.enabledRuntimeIds.length) break; }
    const scroll = [];
    for (const scrollId of setup.scrollIds) for (const point of accessibilityPlan.scroll) {
      const observation = await evaluate(`(async()=>{const container=document.querySelector('[data-installed-uat-scroll-id="${scrollId}"]');if(!(container instanceof HTMLElement))return null;const max=Math.max(0,container.scrollHeight-container.clientHeight);container.scrollTo({top:max*${point.ratio},behavior:'instant'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const visible=element=>{const style=getComputedStyle(element);const box=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&box.width>0&&box.height>0;};const containerBox=container===document.scrollingElement?{left:0,top:0,right:innerWidth,bottom:innerHeight}:container.getBoundingClientRect();const viewport={left:Math.max(0,containerBox.left),top:Math.max(0,containerBox.top),right:Math.min(innerWidth,containerBox.right),bottom:Math.min(innerHeight,containerBox.bottom)};const intersects=(box)=>Math.max(box.left,viewport.left)<Math.min(box.right,viewport.right)&&Math.max(box.top,viewport.top)<Math.min(box.bottom,viewport.bottom);const enabled=[...container.querySelectorAll(${safeJson(INSTALLED_UI_ACTIONABLE_SELECTOR)})].filter(element=>visible(element)&&!element.matches(':disabled')&&element.getAttribute('aria-disabled')!=='true');const visibleTargets=enabled.filter(element=>intersects(element.getBoundingClientRect()));const desiredY=viewport.top+(viewport.bottom-viewport.top)*(${point.ratio}===0?0.1:${point.ratio}===1?0.9:0.5);const nearestCenter=[...enabled].sort((left,right)=>Math.abs((left.getBoundingClientRect().top+left.getBoundingClientRect().bottom)/2-desiredY)-Math.abs((right.getBoundingClientRect().top+right.getBoundingClientRect().bottom)/2-desiredY))[0];const expectedTarget=${point.position === 'TOP' ? 'enabled[0]' : point.position === 'BOTTOM' ? 'enabled.at(-1)' : 'nearestCenter'};const focusTarget=expectedTarget;focusTarget?.focus({preventScroll:true});const box=focusTarget?.getBoundingClientRect();const overlap=box?[...document.querySelectorAll('*')].filter(element=>element!==focusTarget&&!element.contains(focusTarget)&&!focusTarget.contains(element)&&visible(element)&&['fixed','sticky'].includes(getComputedStyle(element).position)).some(element=>{const other=element.getBoundingClientRect();return Math.max(box.left,other.left)<Math.min(box.right,other.right)&&Math.max(box.top,other.top)<Math.min(box.bottom,other.bottom);}):false;const textClipping=[...container.querySelectorAll('p,span,label,button,a,h1,h2,h3,h4,small,strong')].filter(visible).some(element=>{const style=getComputedStyle(element);return /hidden|clip/u.test(style.overflow+style.overflowX+style.overflowY)&&(element.scrollWidth>element.clientWidth+2||element.scrollHeight>element.clientHeight+2);});return {containerId:${safeJson(scrollId)},position:${safeJson(point.position)},controlCount:enabled.length,visibleTargetCount:visibleTargets.length,expectedTargetRuntimeId:expectedTarget?.getAttribute('data-installed-uat-semantic-id')??'',focusTargetRuntimeId:focusTarget?.getAttribute('data-installed-uat-semantic-id')??'',visibleTargetRequired:enabled.length>0,focusTargetFound:Boolean(focusTarget),horizontalOverflow:container.scrollWidth>container.clientWidth+2,focusVisible:!focusTarget?enabled.length===0:Boolean(box&&intersects(box)&&document.activeElement===focusTarget),stickyOverlap:overlap,textClipping,scrollTop:Math.round(container.scrollTop)};})()`);
      check(observation, `İç içe kaydırma kabı kayboldu: ${routeId} / ${scrollId}`);
      const expectedTarget = semanticByRuntimeId.get(observation.expectedTargetRuntimeId);
      const focusTarget = semanticByRuntimeId.get(observation.focusTargetRuntimeId);
      check(observation.controlCount === 0 || (expectedTarget && focusTarget && expectedTarget.identity === focusTarget.identity),
        `Kaydırma exact hedef kimliği doğrulanamadı: ${routeId} / ${scrollId} / ${point.position}`);
      const scrollEvidence = { ...observation, expectedTargetIdentity: expectedTarget?.identity ?? null, focusTargetIdentity: focusTarget?.identity ?? null };
      validateInstalledUiScrollEvidence(scrollEvidence, { enabledControlIdentities });
      scroll.push(scrollEvidence);
    }
    const tooltipResults = [];
    for (const target of setup.tooltipTargets) {
      const coordinates = await evaluate(`(() => {const element=document.querySelector('[data-installed-uat-tooltip-id="${target.id}"]');if(!(element instanceof HTMLElement))return null;element.scrollIntoView({block:'center',inline:'center'});const box=element.getBoundingClientRect();return {x:box.left+box.width/2,y:box.top+box.height/2};})()`);
      check(coordinates, `İpucu hedefi kayboldu: ${routeId} / ${target.id}`); await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: coordinates.x, y: coordinates.y }); await delay(350);
      const observation = await evaluate(`(() => {const trigger=document.querySelector('[data-installed-uat-tooltip-id="${target.id}"]');if(!(trigger instanceof HTMLElement))return null;const visible=element=>{const style=getComputedStyle(element);const box=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&box.width>0&&box.height>0;};const ids=(trigger.getAttribute('aria-describedby')??'').split(/\\s+/u).filter(Boolean);const described=ids.map(id=>document.getElementById(id)).filter(element=>element&&visible(element));const tooltip=[...document.querySelectorAll('[role="tooltip"],[data-tooltip],[popover]:popover-open')].find(visible);const nodes=[...described,...(tooltip?[tooltip]:[])];const content=nodes.map(element=>String(element.textContent??'').replace(/\\s+/gu,' ').trim()).filter(Boolean);trigger.focus({preventScroll:true});return {hoverVisible:nodes.length>0,focusDescriptionMatched:ids.length>0&&described.length===ids.length&&content.length>0,contentPresent:content.length>0,withinViewport:nodes.length>0&&nodes.every(element=>{const box=element.getBoundingClientRect();return box.left>=0&&box.top>=0&&box.right<=innerWidth&&box.bottom<=innerHeight;}),focused:document.activeElement===trigger,describedByIds:ids,content};})()`);
      check(observation, `İpucu hedefi kayboldu: ${routeId} / ${target.id}`);
      const { content = [], ...tooltipObservation } = observation;
      const semanticTarget = semanticByRuntimeId.get(target.semanticRuntimeId);
      tooltipResults.push({ id: target.id, targetIdentity: semanticTarget?.identity ?? sha256Bytes(Buffer.from(JSON.stringify({ routeId, stableSource: target.stableSource }))), targetStateKey: semanticTarget?.stateKey ?? null, ...tooltipObservation, contentCount: content.length, contentSha256: sha256Bytes(Buffer.from(JSON.stringify(content))) });
    }
    let modalFocusTrap = 'NOT_APPLICABLE_NO_OPEN_MODAL'; let escapeClosed = true; let modalForwardFocusIdentities = []; let modalReverseFocusIdentities = []; let modalExpectedControlIdentities = [];
    if (setup.modalPresent) {
      const modalSetup = await evaluate(`(() => {const modal=document.querySelector('[data-installed-uat-modal="true"]');if(!(modal instanceof HTMLElement))return null;const items=[...modal.querySelectorAll('[data-installed-uat-semantic-id]')].filter(element=>!element.matches(':disabled')&&element.getAttribute('aria-disabled')!=='true'&&element.tabIndex>=0);if(items.length===0)return null;items.at(-1).focus();return {runtimeIds:items.map(element=>element.getAttribute('data-installed-uat-semantic-id')).filter(Boolean)};})()`); check(modalSetup, `Açık modal klavye odağı için etkin kontrol taşımıyor: ${routeId}`);
      modalExpectedControlIdentities = modalSetup.runtimeIds.map((runtimeId) => semanticByRuntimeId.get(runtimeId)?.identity).filter(Boolean).toSorted();
      await dispatchKey('Tab', 'Tab');
      const forwardRuntimeId = await evaluate(`document.querySelector('[data-installed-uat-modal="true"]')?.contains(document.activeElement)===true?(document.activeElement?.getAttribute('data-installed-uat-semantic-id')??''):''`);
      await evaluate(`document.querySelector('[data-installed-uat-modal="true"]')?.querySelector('[data-installed-uat-semantic-id]')?.focus()`);
      await dispatchKey('Tab', 'Tab', 8);
      const reverseRuntimeId = await evaluate(`document.querySelector('[data-installed-uat-modal="true"]')?.contains(document.activeElement)===true?(document.activeElement?.getAttribute('data-installed-uat-semantic-id')??''):''`);
      modalForwardFocusIdentities = [semanticByRuntimeId.get(forwardRuntimeId)?.identity].filter(Boolean);
      modalReverseFocusIdentities = [semanticByRuntimeId.get(reverseRuntimeId)?.identity].filter(Boolean);
      const forwardContained = modalForwardFocusIdentities.length === 1 && modalExpectedControlIdentities.includes(modalForwardFocusIdentities[0]);
      const reverseContained = modalReverseFocusIdentities.length === 1 && modalExpectedControlIdentities.includes(modalReverseFocusIdentities[0]);
      modalFocusTrap = forwardContained && reverseContained ? 'FORWARD_AND_REVERSE_CONTAINMENT_PASS' : 'FAIL'; await dispatchKey('Escape', 'Escape'); escapeClosed = await evaluate(`!document.querySelector('[data-installed-uat-modal="true"]')`);
    }
    const toStateKeys = (runtimeIds) => [...new Set(runtimeIds.map((runtimeId) => semanticByRuntimeId.get(runtimeId)?.stateKey).filter(Boolean))].toSorted();
    const toIdentities = (runtimeIds) => [...new Set(runtimeIds.map((runtimeId) => semanticByRuntimeId.get(runtimeId)?.identity).filter(Boolean))].toSorted();
    const forwardReachedStateKeys = toStateKeys(forward); const reverseReachedStateKeys = toStateKeys(reverse);
    const forwardReachedControlIdentities = toIdentities(forward); const reverseReachedControlIdentities = toIdentities(reverse);
    const routeKeyboardEntries = interactionCoverageEngine.report().entries.filter((entry) => entry.routeId === routeId && entry.enabled); const keyboardActivationCount = routeKeyboardEntries.filter((entry) => entry.outcome?.keyboardActivation?.status === 'PASS').length;
    const activatedStateKeys = routeKeyboardEntries.filter((entry) => entry.outcome?.keyboardActivation?.status === 'PASS').map((entry) => entry.stateKey).toSorted();
    const exactForwardSet = JSON.stringify(forwardReachedStateKeys) === JSON.stringify(enabledControlStateKeys) && JSON.stringify(forwardReachedControlIdentities) === JSON.stringify(enabledControlIdentities);
    const exactReverseSet = JSON.stringify(reverseReachedStateKeys) === JSON.stringify(enabledControlStateKeys) && JSON.stringify(reverseReachedControlIdentities) === JSON.stringify(enabledControlIdentities);
    const exactActivationSet = enabledControlStateKeys.every((stateKey) => activatedStateKeys.includes(stateKey));
    const result = {
      status: exactForwardSet && exactReverseSet && exactActivationSet && keyboardActivationCount === routeKeyboardEntries.length && escapeClosed && modalFocusTrap !== 'FAIL' && scroll.every((item) => (item.controlCount === 0
        ? item.expectedTargetIdentity === null && item.focusTargetIdentity === null
        : item.focusTargetFound && item.focusVisible && item.expectedTargetIdentity === item.focusTargetIdentity)
        && !item.horizontalOverflow && !item.stickyOverlap && !item.textClipping) && tooltipResults.every((item) => item.hoverVisible && item.focusDescriptionMatched && item.contentPresent && item.withinViewport && item.focused) ? 'PASS' : 'FAIL',
      enabledCount: enabledControlStateKeys.length, enabledControlIdentities, enabledControlIdentitiesSha256: sha256Bytes(Buffer.from(JSON.stringify(enabledControlIdentities))), enabledControlStateKeys, enabledControlStateKeysSha256: sha256Bytes(Buffer.from(JSON.stringify(enabledControlStateKeys))), forwardReachedCount: forwardReachedStateKeys.length, forwardReachedControlIdentities, forwardReachedStateKeys, reverseReachedCount: reverseReachedStateKeys.length, reverseReachedControlIdentities, reverseReachedStateKeys, exactForwardSet, exactReverseSet, activatedStateKeys, exactActivationSet, keyboardActivationCount, expectedKeyboardActivationCount: routeKeyboardEntries.length, escapeClosed, modalFocusTrap, modalExpectedControlIdentities, modalForwardFocusIdentities, modalReverseFocusIdentities, scroll,
      scrollContainerCount: setup.scrollIds.length, expectedScrollContainerIds: setup.scrollIds, tooltipCount: tooltipResults.length, tooltipHoveredCount: tooltipResults.filter((item) => item.hoverVisible).length, tooltipResults, keyboardPlanIds: accessibilityPlan.keyboard.map((item) => item.id),
    };
    check(result?.status === 'PASS', `Klavye/kaydırma/ipuçları denetimi FAIL: ${routeId}`);
    accessibilityResults.push(Object.freeze({ routeId, ...result }));
  };

  const setLabeledControl = async ({ labelPatterns, value, checked }) => {
    const changed = await evaluate(`(() => {
      const patterns=${safeJson(labelPatterns)}.map(value=>new RegExp(value,'iu'));const label=[...document.querySelectorAll('label')].find(item=>patterns.some(pattern=>pattern.test(item.textContent??'')));if(!label)return false;
      const control=label.querySelector('select,input');if(control instanceof HTMLSelectElement&&${value === undefined ? 'false' : 'true'}){const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')?.set;if(!setter)return false;setter.call(control,${safeJson(value)});control.dispatchEvent(new Event('change',{bubbles:true}));return true;}
      if(control instanceof HTMLInputElement&&${checked === undefined ? 'false' : 'true'}){if(control.checked!==${Boolean(checked)})control.click();return control.checked===${Boolean(checked)};}return false;
    })()`);
    check(changed, `Etiketli erişilebilirlik denetimi bulunamadı: ${labelPatterns.join(' / ')}`);
  };

  const openSecurityLocalControls = async () => {
    await navigateToRoute('security');
    const alreadyVisible = await evaluate(`Boolean(document.querySelector('#security-module-local-controls'))`);
    if (!alreadyVisible) await clickButton(['Yerel güvenlik ve yedekleme', 'Local security and backups'], '#main-content');
    await waitFor(`Boolean(document.querySelector('#security-module-local-controls'))`, 'yerel güvenlik denetimleri');
  };

  const setApplicationLanguage = async (language) => {
    await openSecurityLocalControls();
    await setLabeledControl({ labelPatterns: ['Dil tercihi', 'Language preference'], value: language });
    await waitFor(`document.querySelector('.app-shell')?.getAttribute('data-ui-language')===${safeJson(language)}`, `uygulama dili ${language}`, 15_000);
  };

  const readLocalPreloadIpcSummary = async () => {
    const summary = await evaluate(`(async()=>{if(!globalThis.pardus||typeof globalThis.pardus.getAuthState!=='function'||typeof globalThis.pardus.getDashboardOverview!=='function')return null;const [auth,dashboard]=await Promise.all([globalThis.pardus.getAuthState(),globalThis.pardus.getDashboardOverview()]);return {auth:{initialized:auth?.initialized===true,authenticated:auth?.authenticated===true,twoFactorEnabled:auth?.twoFactorEnabled===true,trustedDevice:auth?.trustedDevice===true},dashboard:{memberCount:Number(dashboard?.memberCount),generationCount:Number(dashboard?.generationCount),upcomingImportantDayCount:Number(dashboard?.upcomingImportantDayCount),timelineEventCount:Number(dashboard?.timelineEventCount),relatedContentCount:Number(dashboard?.relatedContentCount),notificationCount:Number(dashboard?.notificationCount),upcomingImportantDaysCount:Array.isArray(dashboard?.upcomingImportantDays)?dashboard.upcomingImportantDays.length:-1,recentEventsCount:Array.isArray(dashboard?.recentEvents)?dashboard.recentEvents.length:-1,moduleCount:Array.isArray(dashboard?.modules)?dashboard.modules.length:-1}};})()`);
    check(summary?.auth?.initialized === true && summary.auth.authenticated === true
      && Object.values(summary.dashboard ?? {}).every((value) => Number.isFinite(value) && value >= 0),
    'Yerel preload auth/dashboard IPC özeti okunamadı.');
    return Object.freeze(summary);
  };

  const verifyNavigationLanguage = async (language) => {
    await setApplicationLanguage(language);
    const snapshot = await evaluate(`(() => ({
      language:document.querySelector('.app-shell')?.getAttribute('data-ui-language')??'',
      groups:[...document.querySelectorAll('.nav-module-toggle')].map(button=>(button.querySelector('.nav-group-label-copy')?.textContent??'').replace(/\\s+/gu,' ').trim()),
      routes:[...document.querySelectorAll('[data-navigation-route]')].map(button=>({routeId:button.getAttribute('data-navigation-route')??'',label:(button.querySelector('.nav-label')?.textContent??'').replace(/\\s+/gu,' ').trim()}))
    }))()`);
    check(snapshot.language === language && snapshot.groups.length === 4 && snapshot.routes.length === 22, `${language} navigasyon dil yüzeyi eksik.`);
    const canonicalGroups = PRODUCT_NAVIGATION_GROUPS.map((group) => language === 'tr' ? group.label : group.englishLabel);
    const canonicalRoutes = PRODUCT_NAVIGATION_ROUTES.map((route) => ({ routeId: route.id, label: language === 'tr' ? route.label : route.englishLabel }));
    if (language === 'tr') {
      check(JSON.stringify(snapshot.groups) === JSON.stringify(canonicalGroups), 'Türkçe ana menü etiketleri kanonik değildir.');
      check(JSON.stringify(snapshot.routes) === JSON.stringify(canonicalRoutes), 'Türkçe alt menü etiketleri kanonik değildir.');
    } else {
      check(JSON.stringify(snapshot.groups) === JSON.stringify(canonicalGroups), 'İngilizce ana menü etiketleri kanonik değildir.');
      check(JSON.stringify(snapshot.routes) === JSON.stringify(canonicalRoutes), 'İngilizce alt menü etiketleri kanonik değildir.');
    }
    navigationLanguageChecks.push(Object.freeze({ language, groupCount: snapshot.groups.length, routeCount: snapshot.routes.length, labelsSha256: sha256Bytes(Buffer.from(JSON.stringify(snapshot))), status: 'PASS' }));
  };

  const verifyCommandPaletteBackdropDismissal = async () => {
    const before = await evaluate(`(() => ({routeId:document.querySelector('[data-navigation-route][aria-current="page"]')?.getAttribute('data-navigation-route')??'',language:document.querySelector('.app-shell')?.getAttribute('data-ui-language')??''}))()`);
    const openerGesture = await clickSelectorByPointer('.search-box', before.routeId || 'dashboard');
    await waitFor(`Boolean(document.querySelector('.command-overlay')&&document.querySelector('.command-palette'))`, 'komut paleti backdrop yüzeyi');
    const point = await evaluate(`(() => {const overlay=document.querySelector('.command-overlay');const dialog=document.querySelector('.command-palette');if(!(overlay instanceof HTMLElement)||!(dialog instanceof HTMLElement))return null;const outer=overlay.getBoundingClientRect();const inner=dialog.getBoundingClientRect();const candidates=[[outer.left+8,outer.top+8],[outer.right-8,outer.top+8],[outer.left+8,outer.bottom-8],[outer.right-8,outer.bottom-8]];const outside=([x,y])=>!(x>=inner.left&&x<=inner.right&&y>=inner.top&&y<=inner.bottom);const candidate=candidates.find(([x,y])=>outside([x,y])&&document.elementFromPoint(x,y)===overlay);return candidate?{x:candidate[0],y:candidate[1]}:null;})()`);
    check(point, 'Komut paleti dışında yalnız backdrop olan güvenli pointer noktası bulunamadı.');
    const backdropGesture = await dispatchPrimaryPointerGesture({ x: point.x, y: point.y, expectedSelector: '.command-overlay', routeId: before.routeId || 'dashboard' });
    await waitFor(`!document.querySelector('.command-overlay')&&!document.querySelector('.command-palette')`, 'backdrop dış tıklamayla komut paleti kapanması');
    const after = await evaluate(`(() => ({routeId:document.querySelector('[data-navigation-route][aria-current="page"]')?.getAttribute('data-navigation-route')??'',language:document.querySelector('.app-shell')?.getAttribute('data-ui-language')??'',focusReturned:document.activeElement===document.querySelector('.search-box')}))()`);
    check(after.focusReturned === true && after.routeId === before.routeId && after.language === before.language,
      'Backdrop dış tıklama odak dönüşünü veya uygulama durumunu korumadı.');
    backdropDismissalChecks.push(Object.freeze({
      surface: 'command-palette',
      status: 'PASS',
      openerPointerSha256: openerGesture.sha256,
      backdropPointerSha256: sha256Bytes(Buffer.from(JSON.stringify(backdropGesture))),
      focusReturned: true,
      applicationStatePreserved: true,
    }));
  };

  const installNarrationTelemetry = async () => {
    const installed = await evaluate(`(() => {
      const synthesis=globalThis.speechSynthesis;if(!synthesis)return {available:false};if(globalThis.__pptInstalledUatNarration)return {available:true};
      const telemetry={speaks:[],cancels:0,active:0,maxActive:0};const originalSpeak=synthesis.speak.bind(synthesis);const originalCancel=synthesis.cancel.bind(synthesis);
      synthesis.speak=utterance=>{telemetry.active+=1;telemetry.maxActive=Math.max(telemetry.maxActive,telemetry.active);telemetry.speaks.push({lang:utterance.lang??'',rate:utterance.rate??null,voiceName:utterance.voice?.name??'',voiceLang:utterance.voice?.lang??''});const finish=()=>{telemetry.active=Math.max(0,telemetry.active-1);};utterance.addEventListener?.('end',finish,{once:true});utterance.addEventListener?.('error',finish,{once:true});return originalSpeak(utterance);};
      synthesis.cancel=()=>{telemetry.cancels+=1;telemetry.active=0;return originalCancel();};globalThis.__pptInstalledUatNarration={telemetry,originalSpeak,originalCancel};return {available:true};
    })()`);
    return installed.available;
  };

  const restoreNarrationTelemetry = async () => evaluate(`(() => {const state=globalThis.__pptInstalledUatNarration;if(!state||!globalThis.speechSynthesis)return false;globalThis.speechSynthesis.speak=state.originalSpeak;globalThis.speechSynthesis.cancel=state.originalCancel;delete globalThis.__pptInstalledUatNarration;return true;})()`);

  const verifyNarrationLanguage = async (language) => {
    await setApplicationLanguage(language);
    const telemetryAvailable = await installNarrationTelemetry();
    await openSecurityLocalControls();
    await clickButton(['Tanıtımı yeniden oynat', 'Replay introduction'], '#main-content');
    await waitFor(`Boolean(document.querySelector('.first-run-shell'))`, `${language} tanıtım ekranı`);
    await captureScreenshot(`narration-${language}.png`);
    const captionPresent = await evaluate(`Boolean(document.querySelector('.first-run-caption p')?.textContent?.trim())`);
    check(captionPresent, `${language} anlatım yazılı eşleniği görünür değil.`);
    const muted = await evaluate(`document.querySelector('.app-shell')?.getAttribute('data-audio-muted')==='true'`);
    if (muted) await clickButton(language === 'tr' ? ['Sesi aç'] : ['Turn sound on'], '.first-run-shell');
    const currentLabel = await evaluate(`[...document.querySelectorAll('.first-run-shell button')].find(button=>/Baştan anlat|Play from the beginning|Anlatımı durdur|Stop narration/iu.test(button.textContent??''))?.textContent?.trim()??''`);
    if (/Anlatımı durdur|Stop narration/iu.test(currentLabel)) await clickButton(['Anlatımı durdur', 'Stop narration'], '.first-run-shell');
    await clickButton(['Baştan anlat', 'Play from the beginning'], '.first-run-shell');
    await delay(2_200);
    const state = await evaluate(`(() => ({telemetry:globalThis.__pptInstalledUatNarration?.telemetry??null,status:[...document.querySelectorAll('.first-run-shell [role="status"]')].map(item=>item.textContent??'').join(' '),voices:(globalThis.speechSynthesis?.getVoices?.()??[]).map(voice=>({name:voice.name,lang:voice.lang}))}))()`);
    const languageVoices = (state.voices ?? []).filter((voice) => voice.lang.toLowerCase().startsWith(language));
    const latest = state.telemetry?.speaks?.at(-1);
    let mode;
    if (latest) {
      check(latest.lang.toLowerCase().startsWith(language), `${language} anlatım utterance dili yanlış.`);
      check(latest.voiceLang.toLowerCase().startsWith(language), `${language} anlatım aynı dilde ses seçmedi.`);
      const femaleAvailable = languageVoices.some((voice) => isFemaleVoice(voice.name));
      if (femaleAvailable) check(isFemaleVoice(latest.voiceName), `${language} kadın ses mevcutken seçilmedi.`);
      mode = femaleAvailable ? 'FEMALE_PREFERRED' : 'SAME_LANGUAGE_FALLBACK';
      const stopPattern = language === 'tr' ? ['Anlatımı durdur'] : ['Stop narration'];
      await clickButton(stopPattern, '.first-run-shell');
      await delay(150);
      const stopped = await evaluate(`globalThis.__pptInstalledUatNarration?.telemetry??null`);
      check(stopped.cancels > 0 && stopped.maxActive <= 1 && stopped.active === 0, `${language} anlatım stop/no-overlap kapısı başarısız.`);
    } else {
      check(!telemetryAvailable || /kullanılamıyor|başlatılamadı|unavailable|could not be started/iu.test(state.status), `${language} speak veya görünür caption fallback kanıtı yok.`);
      mode = 'VISIBLE_CAPTION_FALLBACK';
    }
    narrationChecks.push({ language, mode, captionPresent: true, physicalAudioAudibilityClaimed: false, speakTelemetryObserved: Boolean(latest), cancelObserved: latest ? true : false, noOverlap: latest ? true : null, selectedVoiceClass: latest ? (isFemaleVoice(latest.voiceName) ? 'FEMALE' : 'SAME_LANGUAGE_FALLBACK') : null });
    await clickButton(['Uygulamaya dön', 'Return to the application'], '.first-run-shell');
    await waitFor(`Boolean(document.querySelector('.app-shell'))`, `${language} tanıtımdan dönüş`);
    if (telemetryAvailable) await restoreNarrationTelemetry();
  };

  const applyStressAccessibility = async () => {
    await setApplicationLanguage('tr');
    await openSecurityLocalControls();
    await setLabeledControl({ labelPatterns: ['Metin görünümü', 'Text view'], value: 'extra-large' });
    await setLabeledControl({ labelPatterns: ['Yüksek kontrast', 'High contrast'], checked: true });
    await waitFor(`(() => {const shell=document.querySelector('.app-shell');return shell?.getAttribute('data-text-scale')==='extra-large'&&shell?.getAttribute('data-high-contrast')==='true'&&Math.abs(Number.parseFloat(getComputedStyle(shell).getPropertyValue('--accessibility-text-scale'))-2)<0.01;})()`, 'yüzde 200 ve yüksek kontrast');
  };

  const applyNativeContentBounds = async () => {
    const { windowId, bounds } = await client.send('Browser.getWindowForTarget');
    check(Number.isInteger(windowId) && bounds, 'CDP native pencere kimliği alınamadı.');
    const viewport = await evaluate(`({width:innerWidth,height:innerHeight})`);
    const frameWidth = Math.max(0, Number(bounds.width) - viewport.width);
    const frameHeight = Math.max(0, Number(bounds.height) - viewport.height);
    await client.send('Browser.setWindowBounds', { windowId, bounds: { width: STRESS_VIEWPORT.width + frameWidth, height: STRESS_VIEWPORT.height + frameHeight, windowState: 'normal' } });
    await waitFor(`innerWidth===${STRESS_VIEWPORT.width}&&innerHeight===${STRESS_VIEWPORT.height}`, 'native 760x720 içerik penceresi', 10_000);
    const readback = await client.send('Browser.getWindowBounds', { windowId });
    const inner = await evaluate(`({width:innerWidth,height:innerHeight,devicePixelRatio})`);
    check(readback.bounds?.windowState === 'normal' && inner.width === 760 && inner.height === 720, 'Native BrowserWindow 760x720 readback başarısız.');
    return Object.freeze({ windowId, requestedInner: { width: 760, height: 720 }, outerBounds: readback.bounds, innerViewport: inner, nativeWindowBoundsApplied: true, cdpDeviceMetricsEmulationUsed: false });
  };

  const plannedScreenshotNames = Object.freeze([
    'onboarding-introduction.png', 'onboarding-family-empty.png', 'onboarding-family-filled-redacted.png', 'onboarding-security-start.png', 'onboarding-security-redacted.png', 'authenticated-shell.png',
    ...PRODUCT_NAVIGATION_GROUPS.map((group) => `module-${group.id}.png`),
    ...routeIds.map((routeId) => `normal-route-${routeId}.png`),
    ...routeIds.map((routeId) => `stress-route-${routeId}.png`),
    'narration-tr.png', 'narration-en.png',
  ]);

  const buildNativeDialogInventory = () => {
    const inventory = INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY.map((specification) => {
      const observation = nativeDialogInventoryObservations.get(specification.specId);
      check(observation && observation.routeSnapshotHashes.size > 0,
        `Native dialog rota DOM snapshot'ı eksik: ${specification.specId}`);
      const enabledControls = [...observation.enabledControls.values()].toSorted((left, right) => left.stateKey.localeCompare(right.stateKey));
      const disabledControls = [...observation.disabledControls.values()].toSorted((left, right) => left.stateKey.localeCompare(right.stateKey));
      const exercisedRecords = nativeDialogEvidence.filter((record) => record.specId === specification.specId);
      const exercisedStateKeys = exercisedRecords.map((record) => record.stateKey).toSorted();
      const enabledStateKeys = enabledControls.map((control) => control.stateKey);
      check(exercisedRecords.every((record) => record.routeId === specification.routeId
        && record.labelClass === specification.labelClass
        && enabledStateKeys.includes(record.stateKey)),
      `Native dialog evidence kanonik inventory kontrolüne bağlı değildir: ${specification.specId}`);
      check(new Set(exercisedStateKeys).size === exercisedStateKeys.length,
        `Native dialog inventory yinelenen exercised state içeriyor: ${specification.specId}`);
      const status = exercisedRecords.length > 0
        ? 'EXERCISED'
        : enabledControls.length > 0 ? 'UNEXERCISED_ENABLED'
          : disabledControls.length > 0 ? 'DISABLED' : 'NOT_PRESENT';
      check(status !== 'UNEXERCISED_ENABLED' && (status !== 'EXERCISED' || JSON.stringify(exercisedStateKeys) === JSON.stringify(enabledStateKeys)),
        `Native dialog kanonik inventory kapsamı eksik: ${specification.specId}`);
      const routeDomSnapshotHashes = [...observation.routeSnapshotHashes].sort();
      return Object.freeze({
        ...specification,
        status,
        sourceSnapshot: Object.freeze({
          canonicalInventorySha256: INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY_SHA256,
          specificationSha256: sha256Bytes(Buffer.from(JSON.stringify(specification))),
        }),
        routeDomSnapshot: Object.freeze({
          routeId: specification.routeId,
          observationCount: routeDomSnapshotHashes.length,
          snapshotHashes: Object.freeze(routeDomSnapshotHashes),
          snapshotsSha256: sha256Bytes(Buffer.from(JSON.stringify(routeDomSnapshotHashes))),
        }),
        enabledControls: Object.freeze(enabledControls),
        disabledControls: Object.freeze(disabledControls),
        exercisedStateKeys: Object.freeze(exercisedStateKeys),
        exercisedRecordSha256: Object.freeze(exercisedRecords.map((record) => sha256Bytes(Buffer.from(JSON.stringify(record)))).sort()),
      });
    });
    check(inventory.length === INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY.length
      && inventory.every((entry, index) => entry.specId === INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY[index].specId
        && ['EXERCISED', 'DISABLED', 'NOT_PRESENT'].includes(entry.status)),
    'Native dialog inventory exact kanonik kümeyi taşımıyor.');
    return Object.freeze(inventory);
  };

  const finalizeReceipt = async (status, failure) => {
    const interactionCoverage = status === 'PASS' ? interactionCoverageEngine.assertComplete() : interactionCoverageEngine.report();
    const clicked = interactionCoverage.clickedOutcomeVerifiedCount;
    const deferred = interactionCoverage.deferredExternalEvidenceCount;
    const blocked = interactionCoverage.blockedDisabledCount;
    const stateMatrix = [...applicationStateMatrix.values()];
    const stateMatrixComplete = stateMatrix.every((item) => {
      try { validateInstalledUiApplicationStateEvidence(item); return true; } catch { return false; }
    });
    const nativeDialogInventory = status === 'PASS' ? buildNativeDialogInventory() : [];
    const mainProcessOutput = processOutputEvidence ?? Object.freeze({ status: 'FAIL', exceptionCount: 1, warningCount: 0, diagnosticCount: 0, channels: {}, fullStreamHashed: false, rawOutputRecorded: false });
    const mainProcessStderr = mainProcessOutput.channels?.stderr ?? Object.freeze({ status: 'FAIL', exceptionCount: 1, fullyDrained: false });
    const visualIssueCount = visualAudits.reduce((total, item) => total + item.issues.length + (item.missingRoot ? 1 : 0), 0);
    const screenshotNames = screenshotArtifacts.map((item) => item.name);
    const screenshotRequiredSetVerified = screenshotNames.length === plannedScreenshotNames.length && new Set(screenshotNames).size === screenshotNames.length && plannedScreenshotNames.every((name) => screenshotNames.includes(name));
    const screenshotReadbackVerified = screenshotArtifacts.every((item) => item.readbackVerified
      && item.unredactedSecretCount === 0
      && item.secretSurfaceScan?.status === 'PASS'
      && ['PASS_PHYSICAL_PIXEL_OCR', 'NOT_RUN_PHYSICAL_PIXEL_OCR'].includes(item.physicalPixelOcr?.status));
    const installedUnchanged = Boolean(installedIdentityAfter && installedIdentityBefore.sha256 === installedIdentityAfter.sha256 && installedIdentityBefore.sizeBytes === installedIdentityAfter.sizeBytes && installedIdentityBefore.fileVersion === installedIdentityAfter.fileVersion);
    if (status === 'PASS') {
      check(Object.values(flowChecks).every(Boolean), 'İlk kurulum/auth akış kapıları eksik.');
      check(moduleMenus.length === 4 && navigation.length === 44, '4 modül / iki modda 22 rota kapsamı eksik.');
      check(navigationLanguageChecks.length === 2 && navigationLanguageChecks.every((item) => item.status === 'PASS' && item.groupCount === 4 && item.routeCount === 22), 'TR/EN ana ve alt menü dil kapsamı eksik.');
      check(backdropDismissalChecks.length === 1 && backdropDismissalChecks.every((item) => item.status === 'PASS' && item.focusReturned && item.applicationStatePreserved), 'Backdrop dış pointer tıklama ve odak dönüşü kanıtı eksik.');
      check(interactionCoverage.status === 'PASS' && interactionCoverage.unclassifiedCount === 0 && interactionCoverage.unexercisedEnabledCount === 0 && interactionCoverage.fixedPointReached && interactionCoverage.fixedPointMatrixMembershipExact, 'Semantik etkileşim kapsamı fail-closed kapısını geçmedi.');
      check(stateMatrixComplete, `Uygulama durum matrisi eksik: ${stateMatrix.filter((item) => item.status !== 'PASS').map((item) => item.scenario).join(', ')}`);
      check(accessibilityResults.length === routeIds.length && accessibilityResults.every((item) => item.status === 'PASS'), 'Klavye/kaydırma/ipuçları rota kapsamı eksik.');
      check(visualAudits.length >= 44 && visualIssueCount === 0, 'Normal/stress görsel audit kapsamı eksik.');
      check(screenshotRequiredSetVerified && screenshotReadbackVerified, 'Temsilî ekran görüntüsü exact-set/readback kapısı eksik.');
      check(rendererExceptions.length === 0 && failedResources.length === 0, 'Renderer/network hata sayısı sıfır değil.');
      const terminalProbeIdentities = terminalAcceptProbes.map((probe) => probe.control.identity).toSorted();
      const terminalAcceptIdentities = terminalAcceptOutcomes.map((outcome) => outcome.actionCorrelation.controlIdentity).toSorted();
      check(terminalAcceptOutcomes.length === terminalAcceptProbes.length
        && JSON.stringify(terminalAcceptIdentities) === JSON.stringify(terminalProbeIdentities),
      'Her keşfedilen terminal eylem için aynı kimliğe bağlı ayrı ACCEPT son-koşul probu yok.');
      check(mainProcessOutput.status === 'PASS' && mainProcessOutput.exceptionCount === 0
        && mainProcessOutput.fullStreamHashed === true
        && mainProcessOutput.channels?.stdout?.fullyDrained === true
        && mainProcessOutput.channels?.stderr?.fullyDrained === true,
      `Ana süreç stdout/stderr ${mainProcessOutput.exceptionCount} exception imzası veya eksik drain içeriyor.`);
      check(narrationChecks.length === 2 && narrationChecks.every((item) => item.captionPresent && item.physicalAudioAudibilityClaimed === false), 'TR/EN anlatım kapsamı eksik.');
      check(nativeDialogEvidence.some((item) => item.routeId === 'finance' && item.labelClass === 'finance:OPEN:FINANCE_IMPORT')
        && nativeDialogEvidence.every((item) => item.status === 'PASS'
          && item.cancel?.targetObserved === true && item.cancel?.targetClosed === true
          && item.accept?.targetObserved === true && item.accept?.targetClosed === true
          && item.cancel?.screenshot?.readbackVerified === true && item.accept?.screenshot?.readbackVerified === true
          && item.accept?.selection?.pathRecorded === false && item.accept?.selection?.withinDisposableProfile === true),
      'Native dosya diyaloğu CANCEL/ACCEPT/target-window/screenshot/postcondition kapsamı eksik.');
      check(installedUnchanged, 'Kurulu EXE UAT sırasında değişti.');
    }
    const receiptBindings = Object.freeze({
      startedAt,
      packageProvenanceSha256: packageBinding.sha256,
      installationPreservationSha256: preservationBinding.sha256,
      governedPreflightSha256: preflightBinding.sha256,
      installerSha256: provenance.installerSha256,
      packagedRuntimeSha256: provenance.packagedRuntimeSha256,
      executableIdentityVerified: installedUnchanged,
      executableHashAlgorithm: 'SHA-256',
      screenshotHashAlgorithm: 'SHA-256',
      screenshotManifestSha256: sha256Bytes(Buffer.from(JSON.stringify(screenshotArtifacts))),
      screenshotReadbackVerified,
      screenshotRequiredSetVerified,
      expectedScreenshotNames: plannedScreenshotNames,
      exactNavigationMatrixVerified: navigation.length === 44,
      profileCleanupOrQuarantineVerified: profileDisposition?.status === 'DELETED_AND_ABSENCE_READBACK_PASS',
      profileCleanupAbsenceReadbackVerified: profileDisposition?.status === 'DELETED_AND_ABSENCE_READBACK_PASS' && profileDisposition?.absenceReadbackVerified === true,
      authenticationSecretPolicy: 'REDACT_AND_SCAN_BEFORE_EVERY_CAPTURE',
      physicalPixelOcrBoundary: screenshotArtifacts.every((item) => item.physicalPixelOcr?.status === 'PASS_PHYSICAL_PIXEL_OCR') ? 'ALL_SCREENSHOTS_OCR_SCANNED' : 'NOT_RUN_PHYSICAL_PIXEL_OCR_TESSERACT_NOT_AVAILABLE',
    });
    const checks = {
      ...flowChecks,
      navigationSurfaceCount: new Set(navigation.map((item) => item.routeId)).size,
      navigationPassCount: navigation.length,
      navigationSurfaces: navigation,
      moduleMenuCount: moduleMenus.length,
      moduleMenus,
      navigationLanguageChecks,
      backdropDismissalChecks,
      clickedInteractionCount: clicked,
      deferredInteractionCount: deferred,
      blockedInteractionCount: blocked,
      interactionMatrixCount: interactionCoverage.entries.length,
      interactionMatrix: interactionCoverage.entries,
      interactionCoverageComplete: interactionCoverage.status === 'PASS',
      unclassifiedInteractionCount: interactionCoverage.unclassifiedCount,
      unexercisedEnabledInteractionCount: interactionCoverage.unexercisedEnabledCount,
      interactionFixedPointReached: interactionCoverage.fixedPointReached,
      interactionStablePassesByContext: interactionCoverage.stablePassesByContext,
      interactionRequiredQuietWindowMs: interactionCoverage.requiredQuietWindowMs,
      interactionPasses: interactionCoverage.passes,
      interactionPassesSha256: sha256Bytes(Buffer.from(JSON.stringify(interactionCoverage.passes))),
      interactionEntriesSha256: sha256Bytes(Buffer.from(JSON.stringify(interactionCoverage.entries))),
      interactionMatrixStateKeys: interactionCoverage.matrixStateKeys,
      interactionMatrixStateKeysSha256: interactionCoverage.matrixStateKeysSha256,
      fixedPointMatrixMembershipExact: interactionCoverage.fixedPointMatrixMembershipExact,
      disabledToEnabledTransitions: interactionCoverage.disabledToEnabledTransitions,
      applicationStateMatrixComplete: stateMatrixComplete,
      applicationStateMatrix: stateMatrix,
      accessibilityPlan,
      accessibilityResults,
      visualAuditCount: visualAudits.length,
      visualIssueCount,
      visualAudits,
      unexpectedRendererExceptionCount: rendererExceptions.length,
      rendererExceptions,
      failedResourceCount: failedResources.length,
      failedResources,
      mainProcessExceptionCount: mainProcessOutput.exceptionCount,
      mainProcessStderr,
      mainProcessOutput,
      javascriptDialogs,
      terminalAcceptOutcomes,
      nativeDialogEvidenceCount: nativeDialogEvidence.length,
      nativeDialogEvidenceSha256: sha256Bytes(Buffer.from(JSON.stringify(nativeDialogEvidence))),
      nativeDialogEvidence,
      nativeDialogInventoryCount: nativeDialogInventory.length,
      nativeDialogInventorySha256: sha256Bytes(Buffer.from(JSON.stringify(nativeDialogInventory))),
      nativeDialogInventorySourceSha256: INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY_SHA256,
      nativeDialogInventory,
      narrationChecks,
      nativeWindow: globalThis.__pptNativeWindowEvidence ?? null,
      stressViewport: STRESS_VIEWPORT,
      processEvidence,
    };
    const receipt = createInstalledFrontendReceipt({
      provenance,
      receiptBindings,
      installedIdentity: installedIdentityBefore,
      completedAt: new Date().toISOString(),
      status,
      checks,
      screenshots: screenshotArtifacts,
      profileDisposition,
      producer,
      runId,
      parentRunId: options['parent-run-id'],
      evidenceRoot: portable(relative(repositoryRoot, options['evidence-root'])),
      ...(failure ? { failure: sanitizeEvidenceText(failure, sensitiveValues, profilePath) } : {}),
    });
    const temporaryOutput = resolve(options['evidence-root'], `.installed-frontend-user-uat111.${process.pid}.tmp`);
    await evidenceRunRootGuard.assertIntact();
    await writeFile(temporaryOutput, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporaryOutput, options.output);
    const readback = await readJsonBinding(options.output, 'Installed UI UAT receipt readback');
    await evidenceRunRootGuard.assertIntact();
    check(readback.value.status === status && readback.value.packageProvenanceSha256 === packageBinding.sha256, 'Installed UI UAT receipt readback bağı bozuk.');
    return receipt;
  };

  evidenceRunRootGuard = await acquireExclusiveEvidenceRunRootGuard({
    runRoot: options['evidence-root'],
    boundary: validationRoot,
    guardName: '.installed-frontend-user-uat111.guard',
  });
  await evidenceRunRootGuard.assertIntact();
  try {
    remoteDebuggingPort = await allocateLoopbackPort();
    child = spawn(options['installed-exe'], [`--remote-debugging-port=${remoteDebuggingPort}`, '--remote-debugging-address=127.0.0.1', '--disable-gpu', '--force-device-scale-factor=1'], {
      cwd: dirname(options['installed-exe']),
      env: { ...process.env, PPT_WINDOWS_LAUNCH_USER_DATA_PATH: profilePath, ELECTRON_ENABLE_LOGGING: '1', ELECTRON_RUN_AS_NODE: undefined },
      windowsHide: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const drainChannel = (channel, stream) => new Promise((resolveDrain, rejectDrain) => {
      stream.on('data', (chunk) => processOutputCollector.addChunk(channel, chunk));
      stream.once('end', () => { processOutputCollector.endChannel(channel); resolveDrain(); });
      stream.once('error', rejectDrain);
    });
    processOutputDrainPromise = Promise.all([drainChannel('stdout', child.stdout), drainChannel('stderr', child.stderr)]);
    rootIdentity = await waitForRootProcessIdentity(child.pid);
    check(normalizeWindowsPath(rootIdentity.executablePath) === normalizeWindowsPath(options['installed-exe']), 'Başlatılan kök süreç kanonik kurulu EXE değildir.');
    ownedIdentities.set(processIdentityKey(rootIdentity), rootIdentity);
    client = await connectCdpClient(remoteDebuggingPort);
    await installInteractionActivityTelemetry();
    captureOwnedProcessTree(rootIdentity, ownedIdentities);
    const onboardingInitialDocumentBinding = createApplicationStateControlBinding('onboarding', 'initial-document');
    const onboardingFamilyFormBinding = createApplicationStateControlBinding('onboarding', 'first-family-form');
    const onboardingSecurityRejectionBinding = createApplicationStateControlBinding('onboarding', 'first-run-two-factor-rejection');
    const authenticatedShellBinding = createApplicationStateControlBinding('dashboard', 'authenticated-shell');
    const offlineShellBinding = createApplicationStateControlBinding('dashboard', 'offline-local-shell');
    const loadingState = await evaluate(`(() => {const visible=element=>{const style=getComputedStyle(element);const box=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&box.width>0&&box.height>0;};const selector='[aria-busy="true"],[data-async-state="loading"],.loading,.loading-state';const element=[...document.querySelectorAll(selector)].find(visible);return element?{observed:true,visible:true,visibleSelector:selector,role:element.getAttribute('role')??'',tagName:element.tagName.toLowerCase(),asyncState:element.getAttribute('data-async-state')??'',text:String(element.textContent??'').replace(/\\s+/gu,' ').trim()}:null;})()`);
    if (loadingState?.observed) {
      const { text, ...loadingReadback } = loadingState;
      const textSha256 = sha256Bytes(Buffer.from(text));
      const actionCorrelation = {
        kind: 'INITIAL_DOCUMENT_LOADING_OBSERVATION',
        pageSerial: pageActivity.serial,
        observationSha256: sha256Bytes(Buffer.from(JSON.stringify({ visibleSelector: loadingReadback.visibleSelector, textSha256, pageSerial: pageActivity.serial }))),
      };
      recordApplicationState('LOADING', 'VISIBLE_LOADING_STATE_OBSERVED', createApplicationStateEvidenceMaterial({
        ...onboardingInitialDocumentBinding,
        outcomeKind: 'VISIBLE_LOADING_STATE',
        snapshot: { ...loadingReadback, textSha256, actionCorrelation },
      }));
    }

    await waitFor(`document.body?.innerText.includes('ParsYuva')&&[...document.querySelectorAll('button')].some(button=>/Güvenli kuruluma başla|Start secure setup/iu.test(button.textContent??''))`, 'ilk tanıtım');
    flowChecks.firstRunIntroductionVisible = true;
    await captureScreenshot('onboarding-introduction.png');
    await clickButton(['Güvenli kuruluma başla', 'Start secure setup']);
    await waitFor(`Boolean(document.querySelector('input[autocomplete="organization"]')&&document.querySelector('#local-password'))`, 'ilk aile formu');
    const emptyForm = await evaluate(`(() => {const inputs=[document.querySelector('input[autocomplete="organization"]'),document.querySelector('input[autocomplete="name"]'),document.querySelector('#local-password')];return inputs.every(input=>input instanceof HTMLInputElement&&!input.value);})()`);
    check(emptyForm, 'İlk aile formu EMPTY durumunda değildir.');
    recordApplicationState('EMPTY', 'FIRST_FAMILY_FORM_EMPTY', createApplicationStateEvidenceMaterial({
      ...onboardingFamilyFormBinding,
      outcomeKind: 'FORM_EMPTY_READBACK',
      snapshot: { allRequiredInputsEmpty: true },
    }));
    await captureScreenshot('onboarding-family-empty.png');
    await clickButton(['Aile alanımı oluştur', 'Create family space']);
    await delay(200);
    const validationProbe = await evaluate(`(() => {const visible=element=>{const style=getComputedStyle(element);const box=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&box.width>0&&box.height>0;};const messages=[...document.querySelectorAll('[role="alert"],.field-error')].filter(visible).map(element=>(element.textContent??'').replace(/\\s+/gu,' ').trim()).filter(Boolean);return {invalidCount:document.querySelectorAll('input:invalid').length,visibleAlertCount:messages.length,messages,language:document.querySelector('.app-shell')?.getAttribute('data-ui-language')??document.documentElement.lang??'tr'};})()`);
    const validationMessageText = validationProbe.messages.join(' ');
    const technicalLeakDetected = visibleFatalPattern.test(validationMessageText)
      || (validationProbe.language === 'tr' && turkishTechnicalLeakPattern.test(validationMessageText));
    const validationState = {
      invalidCount: validationProbe.invalidCount,
      visibleAlertCount: validationProbe.visibleAlertCount,
      messageSetSha256: sha256Bytes(Buffer.from(JSON.stringify(validationProbe.messages))),
      technicalLeakDetected,
    };
    check(validationState.invalidCount > 0 || validationState.visibleAlertCount > 0, 'Boş ilk aile formu doğal doğrulama reddi üretmedi.');
    check(!validationState.technicalLeakDetected, 'Boş ilk aile formu teknik hata ayrıntısı sızdırdı.');
    recordApplicationState('VALIDATION_ERROR', 'EMPTY_FIRST_FAMILY_FORM_REJECTED', createApplicationStateEvidenceMaterial({
      ...onboardingFamilyFormBinding,
      outcomeKind: 'VALIDATION_REJECTION',
      snapshot: { ...validationState, rejected: true },
    }));
    await fillInput('input[autocomplete="organization"]', familyName);
    await fillInput('input[autocomplete="name"]', displayName);
    await fillInput('#local-password', password);
    const populatedForm = await evaluate(`(() => {const inputs=[document.querySelector('input[autocomplete="organization"]'),document.querySelector('input[autocomplete="name"]'),document.querySelector('#local-password')];return inputs.every(input=>input instanceof HTMLInputElement&&Boolean(input.value));})()`);
    check(populatedForm, 'İlk aile formu POPULATED durumuna ulaşmadı.');
    recordApplicationState('POPULATED', 'FIRST_FAMILY_FORM_POPULATED', createApplicationStateEvidenceMaterial({
      ...onboardingFamilyFormBinding,
      outcomeKind: 'FORM_POPULATED_READBACK',
      snapshot: { allRequiredInputsPopulated: true },
    }));
    await captureScreenshot('onboarding-family-filled-redacted.png', { minimumRedactions: 1 });
    await clickButton(['Aile alanımı oluştur', 'Create family space']);
    await waitFor(`document.body?.innerText.includes('Hesabınızı ve kurtarma yolunu güvenceye alın')||document.body?.innerText.includes('Secure your account and recovery path')`, 'ilk güvenlik ekranı', 45_000);
    flowChecks.familyCreatedThroughVisibleForm = true;
    await captureScreenshot('onboarding-security-start.png');
    await clickButton(['Güvenlik kurulumunu başlat', 'Start security setup']);
    await waitFor(`Boolean(document.querySelector('.first-run-security-shell .notes-card'))`, 'iki aşamalı kurulum ayrıntıları');
    flowChecks.twoFactorStartedThroughVisibleButton = true;
    await auditVisibleSurface('first-run-security', '.first-run-security-shell', 'NORMAL');
    await captureScreenshot('onboarding-security-redacted.png', { minimumRedactions: 3 });
    const secret = await evaluate(`(() => {const row=[...document.querySelectorAll('.notes-card small')].find(item=>/^(Anahtar|Key):/iu.test(item.textContent?.trim()??''));return row?.textContent?.split(':').slice(1).join(':').trim()??'';})()`);
    check(secret && /^[A-Z2-7]+=*$/iu.test(secret), 'TOTP anahtarı görünür güvenlik yüzeyinden okunamadı.');
    sensitiveValues.add(secret);
    await fillInput('input[inputmode="numeric"]', '00000X');
    await fillInput('input[autocomplete="current-password"]', password);
    const recoveryGesture = await clickSelectorByPointer('.first-run-security-shell input[type="checkbox"]');
    const recoveryConfirmed = await evaluate(`document.querySelector('.first-run-security-shell input[type="checkbox"]')?.checked===true`);
    check(recoveryConfirmed && recoveryGesture.mousePressed && recoveryGesture.mouseReleased, 'Kurtarma kodu saklama onayı gerçek pointer ile doğrulanamadı.');
    const rejectionAction = await clickButton(['Güvenliği tamamla ve uygulamayı aç', 'Complete security and open the application']);
    await waitFor(`Boolean(document.querySelector('.first-run-security-shell .status-message[role="alert"]'))`, 'iki aşamalı doğrulama IPC reddi', 15_000);
    await waitForInteractionQuietWindow('ilk kurulum iki aşamalı doğrulama reddi');
    const rejectionProbe = await evaluate(`(async()=>{const alert=document.querySelector('.first-run-security-shell .status-message[role="alert"]');const finish=[...document.querySelectorAll('.first-run-security-shell button')].find(button=>/Güvenliği tamamla ve uygulamayı aç|Complete security and open the application/iu.test(button.textContent??''));const auth=await window.pardus.getAuthState();return {message:String(alert?.textContent??'').replace(/\\s+/gu,' ').trim(),visibleAlertCount:alert?1:0,securityShellVisible:Boolean(document.querySelector('.first-run-security-shell')),actionReenabled:finish instanceof HTMLButtonElement&&!finish.disabled,twoFactorEnabled:auth?.twoFactorEnabled===true,trustedDevice:auth?.trustedDevice===true};})()`);
    const rejectionTechnicalLeakDetected = visibleFatalPattern.test(rejectionProbe.message)
      || turkishTechnicalLeakPattern.test(rejectionProbe.message);
    check(rejectionProbe.visibleAlertCount > 0 && rejectionProbe.securityShellVisible && rejectionProbe.actionReenabled
      && !rejectionProbe.twoFactorEnabled && !rejectionProbe.trustedDevice && !rejectionTechnicalLeakDetected,
    'İki aşamalı doğrulama IPC reddi doğal ve güvenli kullanıcı yüzeyi üretmedi.');
    recordApplicationState('ERROR', 'FIRST_RUN_TWO_FACTOR_IPC_REJECTION_NATURAL_UI', createApplicationStateEvidenceMaterial({
      ...onboardingSecurityRejectionBinding,
      outcomeKind: 'AUTHENTICATION_REJECTION',
      snapshot: {
        rejected: true,
        ipcAttempted: true,
        visibleAlertCount: rejectionProbe.visibleAlertCount,
        messageSha256: sha256Bytes(Buffer.from(rejectionProbe.message)),
        technicalLeakDetected: false,
        securityShellVisible: rejectionProbe.securityShellVisible,
        actionReenabled: rejectionProbe.actionReenabled,
        twoFactorEnabled: false,
        trustedDevice: false,
        actionCorrelation: {
          controlIdentity: onboardingSecurityRejectionBinding.controlIdentity,
          stateKey: onboardingSecurityRejectionBinding.stateKey,
          gestureSha256: rejectionAction.gesture.sha256,
        },
      },
    }));
    const code = await createTotp(secret);
    sensitiveValues.add(code);
    await fillInput('input[inputmode="numeric"]', code);
    await clickButton(['Güvenliği tamamla ve uygulamayı aç', 'Complete security and open the application']);
    await waitFor(`document.querySelectorAll('nav .nav-module-toggle').length===4&&document.querySelectorAll('[data-navigation-route]').length===22`, 'kimlik doğrulanmış uygulama', 45_000);
    const authState = await evaluate(`window.pardus.getAuthState()`);
    check(authState?.initialized && authState?.authenticated && authState?.twoFactorEnabled && authState?.trustedDevice && authState?.displayName === displayName, 'Gerçek auth/2FA/trusted-device readback başarısız.');
    Object.assign(flowChecks, { twoFactorCompletedThroughVisibleForm: true, currentDeviceTrustedThroughVisibleForm: true, authenticatedMainShellVisible: true });
    recordApplicationState('SUCCESS', 'AUTHENTICATED_TRUSTED_DEVICE_READBACK', createApplicationStateEvidenceMaterial({
      ...authenticatedShellBinding,
      outcomeKind: 'AUTHENTICATED_TRUSTED_DEVICE',
      snapshot: { initialized: true, authenticated: true, twoFactorEnabled: true, trustedDevice: true },
    }));
    await auditVisibleSurface('authenticated-shell', '.app-shell', 'NORMAL');
    await captureScreenshot('authenticated-shell.png');
    await setApplicationLanguage('tr');
    await navigateToRoute('dashboard');
    const beforeIpcSummary = await readLocalPreloadIpcSummary();
    const beforeIpcSummarySha256 = sha256Bytes(Buffer.from(JSON.stringify(beforeIpcSummary)));
    let offlineState;
    try {
      await client.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
      await waitFor('navigator.onLine===false', 'gerçek çevrimdışı tarayıcı durumu', 10_000);
      const offlineIpcSummary = await readLocalPreloadIpcSummary();
      const offlineIpcSummarySha256 = sha256Bytes(Buffer.from(JSON.stringify(offlineIpcSummary)));
      const shellState = await evaluate(`(() => ({navigatorOnLine:navigator.onLine,authenticatedShellVisible:Boolean(document.querySelector('.app-shell')),canonicalRouteCount:document.querySelectorAll('[data-navigation-route]').length}))()`);
      offlineState = Object.freeze({
        ...shellState,
        preloadIpcReadbackVerified: true,
        authIpcReadbackVerified: true,
        dashboardIpcReadbackVerified: true,
        beforeIpcSummarySha256,
        offlineIpcSummarySha256,
      });
      check(offlineState.navigatorOnLine === false && offlineState.authenticatedShellVisible === true
        && offlineState.canonicalRouteCount === 22 && offlineState.beforeIpcSummarySha256 === offlineState.offlineIpcSummarySha256,
      'Çevrimdışı gerçek preload auth/dashboard IPC geri-okuması korunmadı.');
    } finally {
      await client.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await waitFor('navigator.onLine===true', 'çevrimiçi durumun geri yüklenmesi', 10_000);
    }
    recordApplicationState('OFFLINE', 'NETWORK_OFFLINE_LOCAL_SHELL_READBACK', createApplicationStateEvidenceMaterial({
      ...offlineShellBinding,
      outcomeKind: 'OFFLINE_LOCAL_OPERATION_READBACK',
      snapshot: offlineState,
    }));
    while (await evaluate(`Boolean(document.querySelector('nav .nav-module-toggle[aria-expanded="true"]'))`)) {
      await clickSelectorByPointer('nav .nav-module-toggle[aria-expanded="true"]', 'dashboard');
      await delay(100);
    }
    const initialCollapsed = await evaluate(`[...document.querySelectorAll('nav .nav-module-toggle')].every(button=>button.getAttribute('aria-expanded')==='false')`);
    check(initialCollapsed, 'Modül menüleri ilk açılışta kapalı değildir.');
    const routeDescriptors = [];
    for (let moduleIndex = 0; moduleIndex < PRODUCT_NAVIGATION_GROUPS.length; moduleIndex += 1) {
      const expectedGroup = PRODUCT_NAVIGATION_GROUPS[moduleIndex];
      await clickSelectorByPointer('nav .nav-module-toggle', 'dashboard', moduleIndex);
      await waitFor(`[...document.querySelectorAll('nav .nav-module-toggle')].every((button,index)=>button.getAttribute('aria-expanded')===(index===${moduleIndex}?'true':'false'))`, `${expectedGroup.id} tek açık modül`);
      const moduleResult = await evaluate(`(() => {const toggle=document.querySelectorAll('nav .nav-module-toggle')[${moduleIndex}];if(!(toggle instanceof HTMLButtonElement))return null;const group=toggle.closest('.nav-group');const expandedStates=[...document.querySelectorAll('nav .nav-module-toggle')].map(button=>button.getAttribute('aria-expanded'));const visibleRouteCount=[...document.querySelectorAll('nav [data-navigation-route]')].filter(button=>{const style=getComputedStyle(button);const box=button.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&box.width>0&&box.height>0;}).length;return {label:(toggle.querySelector('.nav-group-label-copy')?.textContent??'').replace(/\\s+/gu,' ').trim(),expandedStates,visibleRouteCount,routes:[...(group?.querySelectorAll('[data-navigation-route]')??[])].map(button=>({routeId:button.getAttribute('data-navigation-route'),label:(button.querySelector('.nav-label')?.textContent??'').replace(/\\s+/gu,' ').trim()}))};})()`);
      check(moduleResult, `Modül menüsü bulunamadı: ${expectedGroup.id}`);
      const expectedRoutes = PRODUCT_NAVIGATION_ROUTES.filter((route) => route.groupId === expectedGroup.id);
      check(moduleResult.label === expectedGroup.label, `Modül etiketi kanonik Türkçe değil: ${expectedGroup.id}`);
      check(moduleResult.expandedStates.filter((state) => state === 'true').length === 1 && moduleResult.expandedStates[moduleIndex] === 'true', `Modül accordion tek-açık davranışı başarısız: ${expectedGroup.id}`);
      check(moduleResult.visibleRouteCount === expectedRoutes.length, `Açık modül görünür rota sayısı yanlış: ${expectedGroup.id}`);
      check(moduleResult.routes.length === expectedRoutes.length && moduleResult.routes.every((route, index) => route.routeId === expectedRoutes[index].id && route.label === expectedRoutes[index].label), `Modül rota/etiket seti kanonik değil: ${expectedGroup.id}`);
      await clickSelectorByPointer('nav .nav-module-toggle', 'dashboard', moduleIndex);
      await waitFor(`[...document.querySelectorAll('nav .nav-module-toggle')].every(button=>button.getAttribute('aria-expanded')==='false')`, `${expectedGroup.id} tekrar tıklamada kapanma`);
      const collapsedVisibleRouteCount = await evaluate(`[...document.querySelectorAll('nav [data-navigation-route]')].filter(button=>{const style=getComputedStyle(button);const box=button.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&box.width>0&&box.height>0;}).length`);
      check(collapsedVisibleRouteCount === 0, `Modül kapandığında alt menüler görünür kaldı: ${expectedGroup.id}`);
      await clickSelectorByPointer('nav .nav-module-toggle', 'dashboard', moduleIndex);
      await waitFor(`[...document.querySelectorAll('nav .nav-module-toggle')].every((button,index)=>button.getAttribute('aria-expanded')===(index===${moduleIndex}?'true':'false'))`, `${expectedGroup.id} yeniden açma`);
      moduleMenus.push({ groupId: expectedGroup.id, label: moduleResult.label, routeCount: moduleResult.routes.length, exclusiveOpenVerified: true, collapseVerified: true, reopenVerified: true, status: 'PASS' });
      routeDescriptors.push(...moduleResult.routes);
      await auditVisibleSurface(`module-${expectedGroup.id}`, '.app-shell', 'NORMAL');
      await captureScreenshot(`module-${expectedGroup.id}.png`);
    }
    check(routeDescriptors.length === 22 && routeDescriptors.every((route, index) => route.routeId === PRODUCT_NAVIGATION_ROUTES[index].id), 'DOM rota sırası kanonik PRODUCT_NAVIGATION_ROUTES ile eşleşmiyor.');

    for (const [index, descriptor] of routeDescriptors.entries()) {
      await navigateToRoute(descriptor.routeId);
      await scanVisibleErrors(descriptor.routeId);
      const audit = await auditVisibleSurface(descriptor.routeId, '.app-shell', 'NORMAL');
      navigation.push({ mode: 'NORMAL', index, routeId: descriptor.routeId, label: descriptor.label, viewport: audit.viewport, status: 'PASS' });
      await captureScreenshot(`normal-route-${descriptor.routeId}.png`);
      await exerciseRouteControls(descriptor.routeId);
      await auditKeyboardScrollAndTooltip(descriptor.routeId);
    }

    await verifyNavigationLanguage('tr');
    await verifyNavigationLanguage('en');
    await setApplicationLanguage('tr');
    await verifyCommandPaletteBackdropDismissal();

    await applyStressAccessibility();
    globalThis.__pptNativeWindowEvidence = await applyNativeContentBounds();
    for (const [index, descriptor] of routeDescriptors.entries()) {
      await navigateToRoute(descriptor.routeId);
      await scanVisibleErrors(descriptor.routeId);
      const audit = await auditVisibleSurface(descriptor.routeId, '.app-shell', 'STRESS_760X720_200_HIGH_CONTRAST');
      check(audit.viewport.width === 760 && audit.viewport.height === 720, `Stress rota viewport'u 760x720 değil: ${descriptor.routeId}`);
      navigation.push({ mode: 'STRESS_760X720_200_HIGH_CONTRAST', index, routeId: descriptor.routeId, label: descriptor.label, viewport: audit.viewport, status: 'PASS' });
      await captureScreenshot(`stress-route-${descriptor.routeId}.png`, { expectedWidth: 760, expectedHeight: 720 });
    }

    await verifyNarrationLanguage('tr');
    await verifyNarrationLanguage('en');
    await setApplicationLanguage('tr');
    const orderedTerminalAcceptProbes = [...terminalAcceptProbes].toSorted((left, right) => {
      const leftHybrid = resolveInstalledUiNativeDialogSpecification(left.control)?.terminalHybrid === true;
      const rightHybrid = resolveInstalledUiNativeDialogSpecification(right.control)?.terminalHybrid === true;
      return Number(leftHybrid) - Number(rightHybrid);
    });
    for (const probe of orderedTerminalAcceptProbes) {
      await navigateToRoute(probe.routeId);
      if (probe.routeId === 'security') await openSecurityLocalControls();
      const controls = await discoverSemanticControls(probe.routeId);
      const rawControl = controls.find((candidate) => createSemanticControlIdentity(candidate).identity === probe.control.identity);
      check(rawControl, `Terminal kabul son-koşulu için kontrol yeniden bulunamadı: ${probe.routeId} / ${probe.control.label}`);
      const currentControl = createSemanticControlIdentity(rawControl);
      check(currentControl.enabled && currentControl.identity === probe.control.identity, `Terminal kabul kontrolü güncel ve etkin durumda değildir: ${probe.routeId} / ${probe.control.label}`);
      const terminalNativeSpecification = resolveInstalledUiNativeDialogSpecification(currentControl);
      const acceptOutcome = terminalNativeSpecification?.terminalHybrid
        ? await buildTerminalNativeRestoreAcceptOutcome(currentControl, rawControl, terminalNativeSpecification)
        : await buildOutcomeOracle(currentControl, rawControl, 'ACCEPT');
      check(acceptOutcome.kind === 'TERMINAL_DISPOSABLE_PROFILE' && acceptOutcome.terminalDecision === 'ACCEPT', 'Terminal kabul son-koşulu gerçek kullanıcı jestiyle doğrulanmadı.');
      terminalAcceptOutcomes.push(acceptOutcome);
    }
    captureOwnedProcessTree(rootIdentity, ownedIdentities);
    processEvidence = await stopOwnedProcessTree({ client, child, rootIdentity, ownedIdentities });
    client = undefined;
    await finalizeProcessOutputEvidence();
    installedIdentityAfter = captureExecutableIdentity(options['installed-exe']);
    check(installedIdentityAfter.sha256 === installedIdentityBefore.sha256 && installedIdentityAfter.sizeBytes === installedIdentityBefore.sizeBytes && installedIdentityAfter.fileVersion === installedIdentityBefore.fileVersion, 'Kurulu EXE UAT sırasında değişti.');
    profileDisposition = await deleteEphemeralProfile(profilePath);
    check(profileDisposition.status === 'DELETED_AND_ABSENCE_READBACK_PASS' && profileDisposition.absenceReadbackVerified === true, 'Disposable UAT profili güvenli temizlenmedi.');
    return await finalizeReceipt('PASS');
  } catch (error) {
    const failure = error instanceof Error ? error.message : String(error);
    try {
      if (rootIdentity) processEvidence = await stopOwnedProcessTree({ client, child, rootIdentity, ownedIdentities });
      else client?.close();
    } catch (cleanupError) {
      rendererExceptions.push(sanitizeEvidenceText(`Owned process cleanup: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`, sensitiveValues, profilePath));
    }
    try { if (processOutputDrainPromise) await finalizeProcessOutputEvidence(); } catch (outputError) {
      rendererExceptions.push(sanitizeEvidenceText(`Process output drain: ${outputError instanceof Error ? outputError.message : String(outputError)}`, sensitiveValues, profilePath));
    }
    try { installedIdentityAfter = captureExecutableIdentity(options['installed-exe']); } catch { /* failure receipt keeps pre identity */ }
    try { profileDisposition = await deleteEphemeralProfile(profilePath); } catch (cleanupError) {
      profileDisposition = { status: 'DELETE_FAILED', error: sanitizeEvidenceText(cleanupError instanceof Error ? cleanupError.message : String(cleanupError), sensitiveValues, profilePath), excludeFromSourceBackup: true, excludeFromExternalBackup: true };
    }
    await finalizeReceipt('FAIL', failure);
    throw error;
  } finally {
    sensitiveValues.clear();
    if (evidenceRunRootGuard) await evidenceRunRootGuard.close();
  }
};

const isDirectExecution = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isDirectExecution) {
  runInstalledFrontendUserUat(parseArguments(process.argv.slice(2))).then((receipt) => {
    console.log(`Kurulu EXE tam UI UAT: ${receipt.status}`);
    console.log(`Kanıt: ${portable(resolve(parseArguments(process.argv.slice(2)).output))}`);
  }).catch((error) => {
    console.error(`Kurulu EXE tam UI UAT FAIL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
