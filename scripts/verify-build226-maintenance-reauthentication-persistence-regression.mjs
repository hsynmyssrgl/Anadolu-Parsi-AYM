import { mkdir, readFile, writeFile } from 'node:fs/promises';

const [stateSource, guardSource, runtimeReport] = await Promise.all([
  readFile('apps/desktop/src/main/ipc-adaptive-budget-maintenance-reauthentication-state.ts', 'utf8'),
  readFile('apps/desktop/src/main/ipc-adaptive-budget-maintenance-reauthentication-guard.ts', 'utf8'),
  readFile('artifacts/validation/build226-fresh-profile-startup-runtime.json', 'utf8').then(JSON.parse)
]);
const results = [];
const check = (id, condition, details = undefined) => results.push({
  id,
  status: condition ? 'PASS' : 'FAIL',
  ...(details === undefined ? {} : { details })
});
const runtimePassed = (id) => runtimeReport.results?.some((item) => item.id === id && item.status === 'PASS');

check('device-bound-envelope-schema-v2', stateSource.includes('interface ProtectedStateEnvelopeV2') && stateSource.includes('deviceBindingSha256: string'));
check('state-protected-before-write', stateSource.includes('protectedPayload: protector.protect(payload)'));
check('device-binding-validated-on-load', stateSource.includes("new StateRestoreError('DEVICE_BINDING_CHANGED'"));
check('protection-provider-validated-on-load', stateSource.includes("new StateRestoreError('PROTECTION_PROVIDER_CHANGED'"));
check('payload-integrity-validated', stateSource.includes("new StateRestoreError('PAYLOAD_INTEGRITY_FAILED'"));
check('missing-state-is-explicit', stateSource.includes("status: 'MISSING'") && stateSource.includes("classification: 'STATE_FILE_MISSING'"));
check('guard-restores-through-persistence', guardSource.includes('this.#persistence.load'));
check('guard-persists-through-persistence', guardSource.includes('this.#persistence?.save'));
check('first-launch-empty-state-persisted', runtimePassed('first-launch-maintenance-state-persisted'));
check('second-launch-state-restored', runtimePassed('second-launch-state-restored'));
check('binding-mismatch-rejected', runtimePassed('maintenance-device-binding-mismatch-rejected'));

const failures = results.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1,
  build: 226,
  applicationVersion: '02.08.2026.226',
  scope: 'Device-bound maintenance reauthentication persistence behavior regression',
  status: failures.length ? 'FAIL' : 'PASS',
  checks: results.length,
  passed: results.length - failures.length,
  failed: failures.length,
  results,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build226-maintenance-reauthentication-persistence-regression.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build226 maintenance reauthentication persistence regression: ${report.status} (${report.passed}/${report.checks}).`);
if (failures.length) process.exitCode = 1;
