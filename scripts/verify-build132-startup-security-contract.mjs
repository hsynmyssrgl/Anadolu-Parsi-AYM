import { mkdir, readFile, writeFile } from 'node:fs/promises';

const files = {
  preflight: 'apps/desktop/src/main/startup-security-preflight.ts',
  rendererPolicy: 'apps/desktop/src/main/renderer-window-security.ts',
  protector: 'apps/desktop/src/main/device-secret-protector.ts',
  main: 'apps/desktop/src/main/main.ts',
  windowsLaunch: 'scripts/windows-real-launch-test.mjs',
  windowsRelease: 'scripts/windows-release-validation.ps1',
  electronDiagnostic: 'scripts/verify-electron-sandbox-environment.mjs',
  package: 'package.json',
  meta: 'packages/domain/src/app-meta.ts',
  decision: 'docs/10_MASTER_DECISION_REGISTER.md',
  adr: 'docs/adr/ADR-017-startup-security-preflight-and-windows-dpapi-proof.md',
  openItems: 'docs/06_OPEN_ITEMS_AFTER_CODING_START.md',
  traceability: 'docs/07_BRONZE_REQUIREMENTS_TRACEABILITY.md'
};
const source = Object.fromEntries(
  await Promise.all(Object.entries(files).map(async ([key, path]) => [key, await readFile(path, 'utf8')]))
);
const ledger = JSON.parse(await readFile('artifacts/manifests/VERSION_LEDGER.json', 'utf8'));
const current = ledger.entries?.at(-1);
if (!current) throw new Error('Active version ledger entry is missing.');
const activeDisplayVersion = current.version;
const activePackageVersion = current.packageVersion;
const activeBuild = current.sequence;
const assertions = [
  ['preflight', "SENTINEL_SCHEMA_VERSION = 1", 'sentinel schema'],
  ['preflight', "EVIDENCE_SCHEMA_VERSION = 1", 'evidence schema'],
  ['preflight', "'--no-sandbox'", 'no-sandbox rejection'],
  ['preflight', "'--disable-gpu-sandbox'", 'GPU sandbox rejection'],
  ['preflight', "'--single-process'", 'single-process rejection'],
  ['preflight', "'RendererCodeIntegrity'", 'renderer code integrity protection'],
  ['preflight', "'RendererAppContainer'", 'renderer app container protection'],
  ['preflight', 'findUnsafeElectronSwitches', 'unsafe switch scanner'],
  ['preflight', "return 'windows-dpapi'", 'Windows DPAPI provider'],
  ['preflight', "return 'macos-keychain'", 'macOS Keychain provider'],
  ['preflight', "return 'linux-secret-service'", 'Linux secret provider'],
  ['preflight', 'fsyncSync(descriptor)', 'durable evidence write'],
  ['preflight', "openSync(temporaryPath, 'wx', 0o600)", 'exclusive evidence temp file'],
  ['preflight', 'renameSync(temporaryPath, path)', 'atomic evidence rename'],
  ['preflight', 'timingSafeEqual', 'constant-time comparison'],
  ['preflight', 'verifyEncryptionRoundTrip', 'safeStorage round trip'],
  ['preflight', 'verifyOrCreateSentinel', 'persistent sentinel'],
  ['preflight', "return 'created'", 'first launch state'],
  ['preflight', "return 'verified'", 'second launch state'],
  ['preflight', 'farklı bir koruma sağlayıcısına ait', 'provider mismatch fail closed'],
  ['preflight', 'Güvensiz Electron başlatma anahtarları reddedildi', 'unsafe launch fail closed'],
  ['preflight', 'Zorunlu işletim sistemi sır koruması', 'required protector fail closed'],
  ['preflight', "status: diagnosticOnly ? 'DIAGNOSTIC_PASS' : 'PASS'", 'diagnostic classification'],
  ['rendererPolicy', 'createSecureRendererPreferences', 'secure preference factory'],
  ['rendererPolicy', 'nodeIntegration: false', 'Node integration disabled'],
  ['rendererPolicy', 'contextIsolation: true', 'context isolation'],
  ['rendererPolicy', 'sandbox: true', 'renderer sandbox'],
  ['rendererPolicy', 'webSecurity: true', 'web security'],
  ['rendererPolicy', 'allowRunningInsecureContent: false', 'insecure content disabled'],
  ['rendererPolicy', 'webviewTag: false', 'webview disabled'],
  ['rendererPolicy', 'navigateOnDragDrop: false', 'drag navigation disabled'],
  ['rendererPolicy', 'assertSecureRendererPreferences', 'renderer policy assertion'],
  ['protector', "protectionId = 'electron-safe-storage-v1'", 'stable protector envelope id'],
  ['protector', "backend !== 'basic_text'", 'Linux plaintext backend rejected'],
  ['main', 'app.enableSandbox();', 'global renderer sandbox'],
  ['main', 'runStartupSecurityPreflight({', 'startup preflight composition'],
  ['main', "startup-security-sentinel.json", 'startup sentinel path'],
  ['main', "startup-security-preflight.json", 'startup evidence path'],
  ['main', "PPT_ALLOW_UNSAFE_ELECTRON_DIAGNOSTIC === '1'", 'diagnostic environment guard'],
  ['main', 'createSecureRendererPreferences(', 'window uses secure preferences'],
  ['main', 'startupSecurity: startupSecurityReport', 'launch probe includes startup evidence'],
  ['main', 'protectionProvider: startupSecurityReport?.protectionProvider', 'startup log provider'],
  ['windowsLaunch', 'expectedSentinelState: \'created\'', 'first Windows launch'],
  ['windowsLaunch', 'expectedSentinelState: \'verified\'', 'second Windows launch'],
  ['windowsLaunch', 'sameUserDataAcrossRuns: true', 'same user data proof'],
  ['windowsLaunch', "dpapiCrossProcessPersistence: 'PASS'", 'DPAPI persistence proof'],
  ['windowsLaunch', "startup.protectionProvider !== 'windows-dpapi'", 'provider assertion'],
  ['windowsLaunch', "startup.encryptionRoundTrip !== 'PASS'", 'roundtrip assertion'],
  ['windowsLaunch', 'policy.sandbox !== true', 'sandbox probe assertion'],
  ['windowsLaunch', "PPT_ALLOW_UNSAFE_ELECTRON_DIAGNOSTIC: '1'", 'diagnostic launch classification'],
  ['package', 'verify:build132:startup-security', 'Build 132 contract script'],
  ['package', 'verify:startup-security:runtime', 'Build 132 runtime script'],
  ['meta', `version: '${activeDisplayVersion}'`, 'application version'],
  ['meta', `packageVersion: '${activePackageVersion}'`, 'package version'],
  ['meta', `Build ${activeBuild}`, 'active build'],
  ['decision', 'DEC-046', 'decision record'],
  ['adr', 'ADR-017', 'architecture decision'],
  ['openItems', 'gerçek Windows geliştirme ve paketli uygulama kanıtı', 'Windows proof remains tracked'],
  ['traceability', 'Build 132 başlangıç güvenlik kapısı', 'traceability updated']
];
const failures = [];
for (const [key, needle, label] of assertions) {
  if (!source[key].includes(needle)) failures.push(`${label}: ${needle}`);
}
const evidence = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: activeDisplayVersion,
  packageVersion: activePackageVersion,
  assertions: assertions.length,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(
  'artifacts/validation/build132-startup-security-contract.json',
  `${JSON.stringify(evidence, null, 2)}\n`
);
if (failures.length > 0) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 132 startup security contract verified: ${assertions.length}/${assertions.length} PASS.`);
