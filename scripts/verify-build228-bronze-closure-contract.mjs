import { mkdir, readFile, writeFile } from 'node:fs/promises';

const expected = {
  build: 228,
  applicationVersion: '02.08.2026.228',
  packageVersion: '2.8.2026-228',
  closureEvidenceBuild: 227,
  closureEvidenceZipSha256: 'efa151bb35b4ea0a027327052f735d42048f3e3c1f809175abf0cd5015549564',
  exactSourceZipSha256: '131091a153cf3a7eaf78b62f1dc2696761b8bde79cd7e3206264e10cb672d2c0'
};

const status = JSON.parse(await readFile('config/bronze-open-closure-status.json', 'utf8'));
const ledger = JSON.parse(await readFile('config/master-build-ledger.json', 'utf8'));
const policy = JSON.parse(await readFile('config/master-build-ledger-policy.json', 'utf8'));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

for (const [field, value] of Object.entries(expected)) check(status[field] === value, `${field}=${status[field]}; expected=${value}`);
check(status.notRunIsPass === false, 'notRunIsPass must be false');
check(policy.allowedWorkStatuses?.includes('CLOSED'), 'ledger policy must allow CLOSED work status');

for (const id of ['OPEN-021', 'OPEN-022']) {
  const item = status.items?.find((entry) => entry.id === id);
  const ledgerItem = ledger.remainingWork?.find((entry) => entry.id === id);
  check(item?.status === 'CLOSED', `${id} machine status=${item?.status}`);
  check(item?.readinessInEvidence === 'READY_TO_CLOSE', `${id} evidence readiness=${item?.readinessInEvidence}`);
  check(item?.developmentWindowsProbe === 'PASS', `${id} development probe=${item?.developmentWindowsProbe}`);
  check(item?.installedWindowsProbe === 'PASS', `${id} installed probe=${item?.installedWindowsProbe}`);
  check(item?.closedByBuild === 228, `${id} closedByBuild=${item?.closedByBuild}`);
  check(ledgerItem?.status === 'CLOSED', `${id} ledger status=${ledgerItem?.status}`);
  check(ledgerItem?.closureEvidenceBuild === 227, `${id} ledger closureEvidenceBuild=${ledgerItem?.closureEvidenceBuild}`);
  check(ledgerItem?.closureEvidenceZipSha256 === expected.closureEvidenceZipSha256, `${id} ledger evidence SHA mismatch`);
  check(ledgerItem?.exactSourceZipSha256 === expected.exactSourceZipSha256, `${id} ledger source SHA mismatch`);
}

const silver = status.silverBoundary;
check(silver?.fullRootTscNoEmit === 'FAIL', `Silver root tsc status=${silver?.fullRootTscNoEmit}`);
check(silver?.unitIntegration === 'FAIL', `Silver unit/integration status=${silver?.unitIntegration}`);
check(silver?.blockingSmoke === 'FAIL', `Silver smoke status=${silver?.blockingSmoke}`);
check(silver?.unchangedByBuild228 === true, 'Build228 must not alter Silver results');
check(silver?.nextOfficialWork === 'OPEN-002', `next official work=${silver?.nextOfficialWork}`);

const report = {
  schemaVersion: 1,
  product: status.product,
  applicationVersion: expected.applicationVersion,
  packageVersion: expected.packageVersion,
  build: expected.build,
  contract: 'Build228 Bronze OPEN-021/OPEN-022 governance closure',
  checks: 29,
  passCount: 29 - failures.length,
  failCount: failures.length,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build228-bronze-closure-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Build228 Bronze closure contract: PASS (${report.passCount}/${report.checks})`);
}
