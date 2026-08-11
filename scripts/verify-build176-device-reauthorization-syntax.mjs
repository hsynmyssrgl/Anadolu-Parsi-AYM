import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
const out = process.argv[2] ?? 'artifacts/validation/build176-device-reauthorization-syntax.json';
const checks = [];
const run = (name, args) => { const result = spawnSync(process.execPath, args, { encoding: 'utf8' }); checks.push({ name, status: result.status === 0 ? 'PASS' : 'FAIL', ...(result.status === 0 ? {} : { error: `${result.stdout}\n${result.stderr}`.trim() }) }); };
run('package source controlled TypeScript', ['scripts/verify-package-source-types.mjs']);
run('desktop main controlled TypeScript', ['scripts/verify-desktop-main-source-types.mjs']);
const sources = {
  domain: await readFile('packages/domain/src/app-data.ts', 'utf8'),
  application: await readFile('packages/application/src/auth-use-cases.ts', 'utf8'),
  dataStore: await readFile('apps/desktop/src/main/data-store.ts', 'utf8'),
  main: await readFile('apps/desktop/src/main/main.ts', 'utf8'),
  preload: await readFile('apps/desktop/src/main/preload.ts', 'utf8'),
  global: await readFile('apps/desktop/src/renderer/global.d.ts', 'utf8'),
  renderer: await readFile('apps/desktop/src/renderer/App.tsx', 'utf8'),
  securityNavigation: await readFile('apps/desktop/src/renderer/security-center-navigation.ts', 'utf8')
};
const check = (name, condition) => checks.push({ name, status: condition ? 'PASS' : 'FAIL' });
check('domain input imported by main', sources.main.includes('ReauthorizeCurrentDeviceInput'));
check('domain result imported by preload', sources.preload.includes('ReauthorizeCurrentDeviceResultView'));
check('domain input imported by renderer declaration', sources.global.includes('ReauthorizeCurrentDeviceInput'));
check('domain result imported by renderer declaration', sources.global.includes('ReauthorizeCurrentDeviceResultView'));
check('application use case imported by data store', sources.dataStore.includes('ReauthorizeCurrentDeviceAfterRecoveryUseCase'));
check('receipt factory imported by data store', sources.dataStore.includes("from './security-event-receipt.js'"));
check('IPC channel matches preload channel', sources.main.includes("'auth:reauthorizeCurrentDeviceAfterRecovery'") && sources.preload.includes("'auth:reauthorizeCurrentDeviceAfterRecovery'"));
check('renderer calls declared preload method', sources.renderer.includes('window.pardus.reauthorizeCurrentDeviceAfterRecovery') && sources.global.includes('reauthorizeCurrentDeviceAfterRecovery'));
check('receipt type is declared before result type', sources.domain.indexOf('SecurityEventReceiptView') < sources.domain.indexOf('ReauthorizeCurrentDeviceResultView'));
check('session epoch state is optional at API boundary', sources.domain.includes('sessionSecurityEpoch?: number'));
check('explicit confirmation is compile-time literal', sources.domain.includes("confirmation: 'GÜVENLİ CİHAZI YENİDEN YETKİLENDİR'"));
check('renderer confirmation gate uses exact literal', sources.renderer.includes('DEVICE_REAUTHORIZATION_CONFIRMATION') && sources.securityNavigation.includes("DEVICE_REAUTHORIZATION_CONFIRMATION = 'GÜVENLİ CİHAZI YENİDEN YETKİLENDİR'"));
const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', build: 176, status: failures.length ? 'FAIL' : 'PASS', checks: checks.length, passed: checks.length - failures.length, failures, scenarios: checks, generatedAt: new Date().toISOString() };
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) { console.error(JSON.stringify(report, null, 2)); process.exit(1); }
console.log(`Build 176 device reauthorization syntax: PASS (${checks.length}/${checks.length})`);
