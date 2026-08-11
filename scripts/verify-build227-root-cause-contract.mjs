import { mkdir, readFile, writeFile } from 'node:fs/promises';

const files = Object.fromEntries(await Promise.all(Object.entries({
  preload: 'apps/desktop/src/main/preload.ts',
  policy: 'apps/desktop/src/main/renderer-window-security.ts',
  protector: 'packages/security/src/device-secret-protector.ts',
  protectorShim: 'apps/desktop/src/main/device-secret-protector.ts',
  main: 'apps/desktop/src/main/main.ts',
  sideProbe: 'apps/desktop/src/main/windows-open022-side-artifact-evidence-probe.ts',
  fullProbe: 'apps/desktop/src/main/windows-security-evidence-probe.ts',
  open022: 'scripts/windows-open022-launch-test.mjs',
  lifecycle: 'scripts/windows-bronze-security-release-validation-build227.ps1',
  result: 'scripts/verify-build227-bronze-security-windows-result.mjs'
}).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const results = [];
const check = (id, condition) => results.push({ id, status: condition ? 'PASS' : 'FAIL' });

check('preload-node-crypto-removed', !files.preload.includes("from 'node:crypto'") && !files.preload.includes('require("node:crypto")'));
check('preload-webcrypto-randomuuid', files.preload.includes('globalThis.crypto') && files.preload.includes('rendererCrypto.randomUUID()'));
check('renderer-sandbox-preserved', files.policy.includes('sandbox: true') && files.policy.includes('contextIsolation: true') && files.policy.includes('nodeIntegration: false'));
check('windows-current-user-dpapi-provider', files.protector.includes('ProtectedData]::Protect') && files.protector.includes('DataProtectionScope]::CurrentUser'));
check('dpapi-secrets-use-stdin', files.protector.includes('[Console]::In.ReadToEnd()') && files.protector.includes('input: JSON.stringify({ operation, value: valueBase64 })'));
check('dpapi-secret-not-command-argument', !files.protector.includes("'-Command', WINDOWS_DPAPI_SCRIPT") && files.protector.includes("'-EncodedCommand', WINDOWS_DPAPI_ENCODED_COMMAND"));
check('windows-production-provider-selected', files.main.includes('new WindowsDpapiDeviceSecretProtector({ required: true })'));
check('old-envelope-provider-mismatch-fails-closed', files.protector.includes("WINDOWS_DPAPI_PROTECTION_ID = 'windows-dpapi-current-user-v1'"));
check('desktop-provider-compatibility-shim', files.protectorShim.includes("from '@ppt/security'"));
check('open022-selected-backend-not-required', !files.open022.includes("selectedBackend !== 'dpapi'") && !files.fullProbe.includes("selectedStorageBackend !== 'dpapi'"));
check('open022-provider-contract', files.open022.includes("providerBasis !== 'windows-current-user-dpapi-platform-contract'") && files.open022.includes("crossProcessPersistence !== 'PASS'"));
check('open022-containers-retained', files.open022.includes('pplog') && files.open022.includes('pptdiag') && files.open022.includes('pptreport') && files.open022.includes('ciphertextHidesPlaintext'));
check('runtime-backend-not-faked', files.sideProbe.includes("selectedBackend: input.selectedStorageBackend") && files.sideProbe.includes("input.selectedStorageBackend !== 'unknown'"));
check('installer-short-temp-root', files.lifecycle.includes('[System.IO.Path]::GetTempPath()') && files.lifecycle.includes('PPTB227-'));
check('installer-bounded-polling', files.lifecycle.includes('AddSeconds(90)') && files.lifecycle.includes('Start-Sleep -Milliseconds 500'));
check('installer-dynamic-exe-discovery', files.lifecycle.includes('Find-InstallFiles') && files.lifecycle.includes('-Filter "*.exe"'));
check('installer-dynamic-registry-discovery', files.lifecycle.includes('Get-ApplicationUninstallEntries') && files.lifecycle.includes('uninstall-registry-found'));
check('installer-cleanup-required', files.lifecycle.includes('lifecycle-cleanup') && files.result.includes("'lifecycle-cleanup'"));
check('not-run-not-pass', files.lifecycle.includes('-Status "NOT_RUN"') && files.result.includes("row?.status === 'PASS'"));
check('open-items-independent', files.result.includes("open021: open021Pass ? 'READY_TO_CLOSE' : 'NOT_READY'") && files.result.includes("open022: open022Pass ? 'READY_TO_CLOSE' : 'NOT_READY'"));
check('fatal-startup-handler-preserved', files.main.includes("process.exitCode = 1") && files.main.includes("startupStage"));

const failures = results.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, build: 227, applicationVersion: '02.08.2026.227', status: failures.length ? 'FAIL' : 'PASS', checks: results.length, passed: results.length - failures.length, failed: failures.length, results, generatedAt: new Date().toISOString() };
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build227-root-cause-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build227 root-cause contract: ${report.status} (${report.passed}/${report.checks}).`);
if (failures.length) process.exitCode = 1;
