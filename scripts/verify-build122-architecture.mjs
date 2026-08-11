import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};

const reportPath = resolve(option('--report', 'artifacts/validation/build122-architecture.json'));
const failures = [];
let assertions = 0;
const verify = (condition, message) => {
  assertions += 1;
  if (!condition) failures.push(message);
};
const text = async (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));

const [
  rootPackage,
  desktopPackage,
  packagerPackage,
  packagerLock,
  rootTypeScript,
  domainPackage,
  toolchainContract,
  gateConfig,
  attestationContract,
  electronBuilder,
  rc2Runner,
  vitestConfig,
  dataStore,
  aiConsent,
  domainRenderer,
  rendererApp,
  rendererUi,
  launchRunner,
  releaseLifecycle,
  finalWindowsRunner,
  finalWindowsCommand,
  electronBuilderRunner,
  installerVerifier,
  nsisLicense
] = await Promise.all([
  json('package.json'),
  json('apps/desktop/package.json'),
  json('tools/windows-packager/package.json'),
  json('tools/windows-packager/package-lock.json'),
  json('tsconfig.json'),
  json('packages/domain/package.json'),
  json('config/build-toolchain-security.json'),
  json('config/rc2-validation-gates.json'),
  json('config/delivery-attestation-contract.json'),
  text('apps/desktop/scripts/build-electron.mjs'),
  text('scripts/run-rc2-validation-gates.mjs'),
  text('vitest.config.ts'),
  text('apps/desktop/src/main/data-store.ts'),
  text('packages/application/src/ai-consent-use-cases.ts'),
  text('packages/domain/src/renderer.ts'),
  text('apps/desktop/src/renderer/App.tsx'),
  text('apps/desktop/src/renderer/ui.tsx'),
  text('scripts/windows-real-launch-test.mjs'),
  text('scripts/windows-release-validation.ps1'),
  text('scripts/run-bronze-final-windows-validation.ps1'),
  text('BRONZE_FINAL_WINDOWS_DOGRULAMA.cmd'),
  text('apps/desktop/scripts/run-electron-builder.mjs'),
  text('apps/desktop/scripts/verify-installer.mjs'),
  text('apps/desktop/build/LICENSE_TR.rtf')
]);

verify(Number(rootPackage.version.split('-').at(-1)) >= 122, `root package build is older than 122: ${rootPackage.version}`);
verify(
  rootPackage.scripts?.['verify:build122:architecture'] === 'node scripts/verify-build122-architecture.mjs',
  'Build 122 architecture command is missing'
);
verify(desktopPackage.devDependencies?.esbuild === undefined, 'obsolete direct esbuild dependency is still present');
verify(rootPackage.allowScripts?.['esbuild@0.25.12'] === undefined, 'obsolete esbuild install script remains approved');
verify(rootPackage.allowScripts?.['electron-winstaller@5.4.0'] === undefined, 'unused electron-winstaller install script remains approved');
verify(
  rootPackage.scripts?.['verify:build-toolchain-security'] === 'node scripts/verify-build-toolchain-security-contract.mjs',
  'Build toolchain security command is missing'
);
verify(desktopPackage.devDependencies?.['electron-builder'] === undefined, 'electron-builder leaked into root desktop dependency graph');
verify(packagerPackage.devDependencies?.['electron-builder'] === '26.15.6', 'isolated electron-builder security patch is not pinned');
verify(packagerLock.packages?.['node_modules/electron-builder']?.version === '26.15.6', 'isolated electron-builder lock pin is missing');
verify(desktopPackage.devDependencies?.electron === '43.2.0', 'Electron Windows graphics fix is not pinned');
verify(
  JSON.stringify(packagerPackage.overrides) === JSON.stringify(toolchainContract.safeOverrides),
  'isolated build toolchain overrides differ from the security contract'
);
verify(
  JSON.stringify(desktopPackage.build?.win?.target) === JSON.stringify(['nsis']),
  'Windows build target is not NSIS-only'
);
verify(
  desktopPackage.scripts?.['package:win']?.includes('node scripts/run-electron-builder.mjs'),
  'Windows package command does not use the controlled Electron builder runner'
);
verify(
  electronBuilderRunner.includes('tools/windows-packager/node_modules/electron-builder/cli.js') &&
    electronBuilderRunner.includes('electron_config_cache: cacheRoot') &&
    electronBuilderRunner.includes('ELECTRON_CACHE: cacheRoot'),
  'Electron builder runner does not support both cache contracts'
);
verify(
  desktopPackage.build?.electronDownload?.cache === '../../artifacts/validation/electron-cache',
  'Electron builder configuration does not pin its writable artifact cache'
);
verify(
  desktopPackage.build?.nsis?.license === 'build/LICENSE_TR.rtf',
  'NSIS installer does not use the encoding-safe RTF license'
);
verify(
  /^[\x00-\x7f]*$/.test(nsisLicense) && nsisLicense.includes('\\u304?') && nsisLicense.includes('\\u305?'),
  'NSIS license is not ASCII-only RTF with explicit Turkish Unicode escapes'
);
verify(
  installerVerifier.includes('NSIS lisans RTF dosyası UTF-8 lisans kaynağıyla eşleşmiyor.'),
  'installer verification does not compare the RTF license with its canonical UTF-8 source'
);

verify(electronBuilder.includes("node_modules/typescript/bin/tsc"), 'Electron build does not use the TypeScript compiler');
verify(!electronBuilder.includes("node_modules/esbuild/bin/esbuild"), 'Electron build still invokes the esbuild binary');
verify(electronBuilder.includes("preload.cts"), 'Electron build does not compile preload through a CommonJS TypeScript source');
verify(electronBuilder.includes("main.mjs"), 'Electron build does not emit the ESM main artifact');

verify(vitestConfig.includes("'@ppt/application'"), 'Vitest application source alias is missing');
verify(vitestConfig.includes("'@ppt/repositories'"), 'Vitest repository source alias is missing');
verify(vitestConfig.includes("'@ppt/core'"), 'Vitest core source alias is missing');

const unitTestGate = gateConfig.gates?.find((gate) => gate.id === 'unit-tests');
verify(Boolean(unitTestGate), 'RC2 unit test gate is missing');
verify(rc2Runner.includes("'test'"), 'RC2 runner does not support the test phase');
verify(unitTestGate?.command === 'npm', `unit test gate command=${unitTestGate?.command}`);
verify(JSON.stringify(unitTestGate?.args) === JSON.stringify(['run', 'test']), 'unit test gate arguments are invalid');
verify(gateConfig.gates?.findIndex((gate) => gate.id === 'unit-tests') > gateConfig.gates?.findIndex((gate) => gate.id === 'tsc-no-emit'), 'unit test gate must run after typecheck');
verify(gateConfig.gates?.findIndex((gate) => gate.id === 'unit-tests') < gateConfig.gates?.findIndex((gate) => gate.id === 'electron-production-build'), 'unit test gate must run before production build');

verify(dataStore.includes('#authorizationDecision('), 'central object authorization decision helper is missing');
verify(dataStore.includes("decision.reason === 'explicit_allow'"), 'object access does not require an explicit allow decision');
verify(aiConsent.includes('requestedStartsAt ?? scope.occurredAt'), 'AI consent default time does not use the trusted transaction clock');

verify(domainPackage.exports?.['./renderer'] === './dist/renderer.js', 'browser-safe domain export is missing');
verify(
  JSON.stringify(rootTypeScript.compilerOptions?.paths?.['@ppt/domain/renderer']) ===
    JSON.stringify(['./packages/domain/src/renderer.ts']),
  'root TypeScript source mapping for the browser-safe domain export is missing'
);
verify(domainRenderer.includes("from './app-meta.js'"), 'browser-safe domain export does not expose app metadata');
verify(domainRenderer.includes("from './validation.js'"), 'browser-safe domain export does not expose validation helpers');
verify(!domainRenderer.includes('@ppt/core'), 'browser-safe domain export depends on core');
verify(rendererApp.includes("from '@ppt/domain/renderer'"), 'renderer app does not use the browser-safe domain export');
verify(rendererUi.includes("from '@ppt/domain/renderer'"), 'renderer UI does not use the browser-safe domain export');

verify(launchRunner.includes("mode: packaged ? 'packaged' : 'development'"), 'Windows launch failure evidence does not identify launch mode');
verify(
  launchRunner.includes("status: diagnosticMode ? 'DIAGNOSTIC_FAIL' : 'FAIL'"),
  'Windows launch runner does not keep diagnostic failures separate from official failed evidence'
);
verify(launchRunner.includes("launchArguments.push(appRoot)"), 'Electron flags are not placed before the development app path');
verify(
  launchRunner.includes('electron_config_cache: electronCachePath'),
  'Electron 43 runtime bootstrap does not use the writable validation cache'
);
verify(releaseLifecycle.includes('PSObject.Properties["ArgumentList"]'), 'Windows release lifecycle does not detect PowerShell 5.1 argument support');
verify(releaseLifecycle.includes('$processInfo.Arguments = $quotedArguments -join " "'), 'Windows release lifecycle lacks a PowerShell 5.1 argument fallback');
verify(releaseLifecycle.includes('[System.Text.UTF8Encoding]::new($false)'), 'Windows lifecycle evidence is not written as BOM-free UTF-8');
verify(releaseLifecycle.includes('[switch]$DiagnosticNoSandbox'), 'Windows lifecycle diagnostic mode is missing');
verify(
  releaseLifecycle.includes('"windows-release-lifecycle-diagnostic-no-sandbox.json"'),
  'Windows lifecycle diagnostic evidence is not isolated from official evidence'
);
verify(
  releaseLifecycle.includes('if ($failure) { "DIAGNOSTIC_FAIL" } else { "DIAGNOSTIC_PASS" }'),
  'Windows lifecycle diagnostic status is not fail-closed'
);
verify(
  releaseLifecycle.includes('officialGateStatus = if ($DiagnosticNoSandbox)'),
  'Windows lifecycle diagnostic evidence can be confused with the official gate'
);
verify(
  releaseLifecycle.includes('-Id "windows-installer-build" -FilePath "cmd.exe"'),
  'Windows lifecycle does not use the compatible command host for npm.cmd'
);
verify(
  releaseLifecycle.includes('@("/S", "/currentuser", "--no-desktop-shortcut", "/D=$installRoot")'),
  'Windows lifecycle installation is not isolated from an existing per-machine installation'
);
verify(
  releaseLifecycle.includes('A current-user Panthera installation already exists'),
  'Windows lifecycle can overwrite an existing current-user installation'
);
verify(
  releaseLifecycle.includes('.tmp\\windows-release-validation\\$runId'),
  'Windows lifecycle does not use its isolated workspace test directory'
);
verify(
  releaseLifecycle.includes('Current-user uninstall registry entry remained after uninstall.'),
  'Windows lifecycle does not verify uninstall registry cleanup'
);
verify(
  releaseLifecycle.includes('$uninstallDeadline = [DateTimeOffset]::UtcNow.AddSeconds(30)'),
  'Windows lifecycle does not wait for the detached uninstaller to settle'
);
verify(
  finalWindowsCommand.includes('run-bronze-final-windows-validation.ps1'),
  'one-click Bronze Final Windows command does not invoke the validation runner'
);
verify(
  finalWindowsRunner.includes('diagnosticResultsAcceptedAsOfficial = $false'),
  'Bronze Final Windows runner can accept diagnostic evidence as official'
);
verify(
  finalWindowsRunner.includes('$env:PPT_NPM_CACHE_PATH = $npmCacheRoot') &&
    finalWindowsRunner.includes('$env:npm_config_cache = $npmCacheRoot') &&
    finalWindowsRunner.includes('$env:NPM_CONFIG_CACHE = $npmCacheRoot'),
  'Bronze Final Windows runner does not pin npm cache writes to validation artifacts'
);
verify(
  finalWindowsRunner.includes('-Id "complete-rc2-gates"'),
  'Bronze Final Windows runner does not execute the complete RC2 gate chain'
);
verify(
  finalWindowsRunner.includes('-Id "official-windows-lifecycle"'),
  'Bronze Final Windows runner does not execute the official install lifecycle'
);
verify(
  finalWindowsRunner.includes('-Id "production-dependency-audit"') &&
    finalWindowsRunner.includes('-Id "build-toolchain-dependency-audit"'),
  'Bronze Final Windows runner does not execute both dependency audits'
);
verify(
  finalWindowsRunner.includes('Bronze_Final_Windows_Kanitlari_$runId.zip'),
  'Bronze Final Windows runner does not produce a portable evidence bundle'
);

verify(
  attestationContract.evidence?.some((item) => item.id === 'build122-architecture' && item.expectedStatus === 'PASS'),
  'delivery attestation does not require Build 122 architecture evidence'
);
verify(
  attestationContract.evidence?.some((item) => item.id === 'build-toolchain-dependency-audit' && item.expectedStatus === 'PASS'),
  'delivery attestation does not require a clean build-toolchain audit'
);
verify(
  attestationContract.evidence?.some((item) => item.id === 'build-toolchain-security-contract' && item.expectedStatus === 'PASS'),
  'delivery attestation does not require the reviewed toolchain contract'
);
verify(
  attestationContract.evidence?.some(
    (item) => item.id === 'windows-release-lifecycle-official' && item.expectedStatus === 'FAIL'
  ),
  'delivery attestation does not preserve the official Windows lifecycle failure'
);
verify(
  attestationContract.evidence?.some(
    (item) => item.id === 'windows-release-lifecycle-diagnostic' && item.expectedStatus === 'DIAGNOSTIC_PASS'
  ),
  'delivery attestation does not require the separated diagnostic Windows lifecycle evidence'
);
verify(
  attestationContract.evidence?.some(
    (item) => item.id === 'bronze-final-windows-one-click' && item.expectedStatus === 'FAIL'
  ),
  'delivery attestation does not preserve the actual one-click Windows Final attempt'
);
verify(
  attestationContract.gateClaims?.some((item) => item.label === 'Unit and integration tests' && item.resultId === 'unit-tests'),
  'delivery attestation does not claim the unit test gate'
);

const report = {
  schemaVersion: 1,
  product: 'Panthera pardus tulliana Aile',
  applicationVersion: '26.07.2026.122',
  packageVersion: '26.7.2026-122',
  build: 122,
  stage: 'Bronze RC2 Active Development',
  assertions,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Build 122 architecture verification: PASS — ${assertions} assertions.`);
}
