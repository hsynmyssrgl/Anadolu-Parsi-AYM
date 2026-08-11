import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const out = process.argv[2] ?? 'artifacts/validation/build174-contract.json';
const files = [
  'apps/desktop/src/main/ipc-adaptive-budget-maintenance-lock-recovery.ts',
  'apps/desktop/src/main/main.ts',
  'packages/domain/src/app-data.ts'
];
const text = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await readFile(file, 'utf8')])));
const ledger = JSON.parse(await readFile('artifacts/manifests/VERSION_LEDGER.json', 'utf8'));
const build174 = ledger.entries?.find((entry) => entry.sequence === 174);
const checks = [
  ['cooldown reason', text[files[0]].includes('RECOVERY_COOLDOWN_ACTIVE')],
  ['cooldown context key', text[files[0]].includes('recovery-cooldown')],
  ['15 minute duration', text[files[1]].includes('15 * 60_000')],
  ['persistent cooldown guard', text[files[1]].includes('ipcAdaptiveBudgetMaintenanceRecoveryCooldownGuard')],
  ['logout after recovery', text[files[1]].includes('store().logout()')],
  ['session clear before logout', text[files[1]].includes('ipcAdaptiveBudgetMaintenanceSessions.clearAll();\n    ipcAdaptiveBudgetMaintenanceReauthenticationGuard.clearAll();\n    ipcAdaptiveBudgetMaintenanceRecoveryCooldownGuard.recordFailure(recoveryContext.cooldownFingerprint);\n    store().logout();')],
  ['trust reevaluation flag', text[files[1]].includes('trustedDeviceReevaluationRequired: true')],
  ['domain cooldown fields', text[files[2]].includes('recoveryCooldownActive:boolean')],
  ['domain session termination', text[files[2]].includes('sessionTerminated?:boolean')],
  ['historical Build 174 ledger entry', build174?.version === '29.07.2026.174' && build174?.packageVersion === '29.7.2026-174']
];
const failures = checks.filter(([, ok]) => !ok).map(([name]) => name);
const report = { schemaVersion: 1, build: 174, status: failures.length ? 'FAIL' : 'PASS', checks: checks.length, passed: checks.length - failures.length, failures, generatedAt: new Date().toISOString() };
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) { console.error(report); process.exit(1); }
console.log(`Build 174 contract: PASS (${checks.length}/${checks.length})`);
