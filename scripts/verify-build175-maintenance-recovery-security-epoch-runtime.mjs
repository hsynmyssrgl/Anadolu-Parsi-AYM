import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const out = process.argv[2] ?? 'artifacts/validation/build175-maintenance-recovery-security-epoch-runtime.json';
const temp = resolve('.tmp/build175-security-epoch');
await rm(temp, { recursive: true, force: true });
await mkdir(temp, { recursive: true });
execFileSync('tsc', [
  'packages/application/src/security-epoch.ts',
  '--target', 'ES2024',
  '--module', 'NodeNext',
  '--moduleResolution', 'NodeNext',
  '--strict',
  '--skipLibCheck',
  '--outDir', temp
], { stdio: 'pipe' });
const modulePath = resolve(temp, 'security-epoch.js');
const epoch = await import(`${pathToFileURL(modulePath).href}?v=${Date.now()}`);
const checks = [];
const check = (name, fn) => {
  try { fn(); checks.push({ name, status: 'PASS' }); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error instanceof Error ? error.message : String(error) }); }
};
check('zero epoch is accepted', () => assert.equal(epoch.assertAccountSecurityEpoch(0), 0));
check('next epoch increments exactly once', () => assert.equal(epoch.nextAccountSecurityEpoch(7), 8));
check('negative epoch is rejected', () => assert.throws(() => epoch.assertAccountSecurityEpoch(-1)));
check('fractional epoch is rejected', () => assert.throws(() => epoch.assertAccountSecurityEpoch(1.5)));
check('unsafe epoch is rejected', () => assert.throws(() => epoch.assertAccountSecurityEpoch(Number.MAX_SAFE_INTEGER)));
check('maximum epoch is accepted for comparison', () => assert.equal(epoch.assertAccountSecurityEpoch(epoch.MAX_ACCOUNT_SECURITY_EPOCH), epoch.MAX_ACCOUNT_SECURITY_EPOCH));
check('maximum epoch cannot advance', () => assert.throws(() => epoch.nextAccountSecurityEpoch(epoch.MAX_ACCOUNT_SECURITY_EPOCH)));
check('same epoch trusts device', () => assert.equal(epoch.isTrustedDeviceSecurityEpochCurrent(3, 3), true));
check('older device epoch is rejected', () => assert.equal(epoch.isTrustedDeviceSecurityEpochCurrent(4, 3), false));
check('future device epoch is rejected', () => assert.equal(epoch.isTrustedDeviceSecurityEpochCurrent(4, 5), false));
check('rotation plan advances epoch', () => assert.deepEqual(epoch.createAccountSecurityEpochRotationPlan(9, 2), { previousSecurityEpoch: 9, securityEpoch: 10, revokedTrustedDeviceCount: 2 }));
check('rotation plan is immutable', () => assert.equal(Object.isFrozen(epoch.createAccountSecurityEpochRotationPlan(1, 0)), true));
check('rotation plan rejects negative device count', () => assert.throws(() => epoch.createAccountSecurityEpochRotationPlan(1, -1)));
check('rotation plan rejects fractional device count', () => assert.throws(() => epoch.createAccountSecurityEpochRotationPlan(1, 1.1)));
check('old trust cannot survive multiple rotations', () => {
  const first = epoch.createAccountSecurityEpochRotationPlan(0, 3);
  const second = epoch.createAccountSecurityEpochRotationPlan(first.securityEpoch, 0);
  assert.equal(epoch.isTrustedDeviceSecurityEpochCurrent(second.securityEpoch, 0), false);
  assert.equal(second.securityEpoch, 2);
});
const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', build: 175, status: failures.length ? 'FAIL' : 'PASS', checks: checks.length, passed: checks.length - failures.length, failures, scenarios: checks, generatedAt: new Date().toISOString() };
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) { console.error(JSON.stringify(report, null, 2)); process.exit(1); }
console.log(`Build 175 security epoch runtime: PASS (${checks.length}/${checks.length})`);
