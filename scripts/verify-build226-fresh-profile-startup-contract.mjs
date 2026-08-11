import { mkdir, readFile, writeFile } from 'node:fs/promises';

const [main, identity, runtime, packageJson, preflight] = await Promise.all([
  readFile('apps/desktop/src/main/main.ts', 'utf8'),
  readFile('apps/desktop/src/main/device-identity.ts', 'utf8'),
  readFile('scripts/verify-build226-fresh-profile-startup-runtime.mjs', 'utf8'),
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('config/source-preflight-checks.json', 'utf8').then(JSON.parse)
]);
const results = [];
const check = (id, condition, details = undefined) => results.push({ id, status: condition ? 'PASS' : 'FAIL', ...(details === undefined ? {} : { details }) });

check('build226-version', packageJson.version === '2.8.2026-226', packageJson.version);
check('production-provider-imported', main.includes("import { FileDeviceIdentityProvider } from './device-identity.js';"));
check('device-initialization-stage-declared', main.includes("| 'DEVICE_IDENTITY_INITIALIZATION'"));
check('protected-provider-used', main.includes('new FileDeviceIdentityProvider(identityPath, runtime().clock, secretProtector()).snapshot()'));
check('binding-derived-from-validated-identity', main.includes(".update(`${identity.deviceId}\\u0000${identity.fingerprint}`, 'utf8')"));
check('binding-not-ready-fails-closed', main.includes("throw new Error('Bakım yeniden doğrulama cihaz bağı güvenli cihaz kimliğinden başlatılmadı.')"));
check('raw-identity-json-assumption-removed', !main.includes("JSON.parse(readFileSync(identityPath, 'utf8'))"));
check('protected-envelope-retained', identity.includes('privateKeyCiphertextBase64: protector.protect(identity.privateKeyPem)'));
check('required-os-protection-retained', identity.includes('this.secretProtector?.required') && identity.includes('işletim sistemi sırrı koruması zorunludur'));
check('wrong-provider-fails-closed', identity.includes('protector.protectionId !== expectedProtectionId'));

const preflightIndex = main.indexOf('startupSecurityReport = runStartupSecurityPreflight');
const stageIndex = main.indexOf("startupStage = 'DEVICE_IDENTITY_INITIALIZATION'");
const initializeIndex = main.indexOf('initializeMaintenanceReauthenticationDeviceBinding();');
const probeIndex = Math.min(main.indexOf("startupStage = 'WINDOWS_SECURITY_PROBE'"), main.indexOf("startupStage = 'OPEN021_EFS_PROBE'"), main.indexOf("startupStage = 'OPEN022_SIDE_ARTIFACT_PROBE'"));
const restoreIndex = main.indexOf('ipcAdaptiveBudgetMaintenanceReauthenticationGuard.restore(Date.now())');
check('preflight-before-device-identity', preflightIndex >= 0 && stageIndex > preflightIndex, { preflightIndex, stageIndex });
check('device-identity-before-probes', initializeIndex > stageIndex && probeIndex > initializeIndex, { initializeIndex, probeIndex });
check('device-identity-before-maintenance-restore', restoreIndex > initializeIndex, { initializeIndex, restoreIndex });

check('runtime-empty-userdata', runtime.includes("const firstRoot = join(temp, 'fresh-user-data')") && runtime.includes('assert.equal(existsSync(identityPath), false)'));
check('runtime-production-provider-creates-file', runtime.includes('new FileDeviceIdentityProvider(identityPath, clock, protector)'));
check('runtime-first-launch-persists-state', runtime.includes("check('first-launch-maintenance-state-persisted'"));
check('runtime-second-launch', runtime.includes("check('second-launch-state-restored'"));
check('runtime-corrupt-identity-tamper', runtime.includes("check('corrupt-device-identity-fails-closed'"));
check('runtime-wrong-provider-tamper', runtime.includes("check('wrong-device-protection-provider-fails-closed'"));
check('runtime-undecipherable-tamper', runtime.includes("check('undecipherable-device-ciphertext-fails-closed'"));
check('runtime-unavailable-protection-tamper', runtime.includes("check('unavailable-os-protection-fails-closed'"));
check('runtime-device-binding-mismatch', runtime.includes("check('maintenance-device-binding-mismatch-rejected'"));
check('runtime-does-not-seed-fake-identity', !runtime.includes('fake-device-identity') && !runtime.includes('writeFile(identityPath'));

const packageCommand = packageJson.scripts?.['verify:build226:fresh-profile-startup-runtime'];
check('package-runtime-command', packageCommand === 'node scripts/verify-build226-fresh-profile-startup-runtime.mjs', packageCommand);
const preflightCheck = preflight.checks?.find((item) => item.id === 'build226-fresh-profile-startup-runtime');
check('preflight-runtime-registered', preflightCheck?.script === 'scripts/verify-build226-fresh-profile-startup-runtime.mjs', preflightCheck);

const failures = results.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, build: 226, applicationVersion: '02.08.2026.226', status: failures.length ? 'FAIL' : 'PASS', checks: results.length, passed: results.length - failures.length, failed: failures.length, results, generatedAt: new Date().toISOString() };
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build226-fresh-profile-startup-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build226 fresh-profile startup contract: ${report.status} (${report.passed}/${report.checks}).`);
if (failures.length) process.exitCode = 1;
