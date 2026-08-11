import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const reportPath = process.argv[2] ?? 'artifacts/validation/build205-master-build-ledger-contract.json';
const failures = [];
let checks = 0;
const verify = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const exists = async (path) => { try { await stat(path); return true; } catch { return false; } };
const read = (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await read(path));

for (const path of [
  'config/master-build-ledger.json',
  'config/master-build-ledger-policy.json',
  'docs/17_MASTER_BUILD_LEDGER.md',
  'scripts/lib/master-build-ledger.mjs',
  'scripts/generate-master-build-ledger.mjs',
  'scripts/update-master-build-ledger.mjs',
  'scripts/verify-master-build-ledger.mjs'
]) verify(await exists(path), `required file missing=${path}`);

const ledger = await readJson('config/master-build-ledger.json');
const policy = await readJson('config/master-build-ledger-policy.json');
verify(ledger.currentBuild === 205, `currentBuild=${ledger.currentBuild}`);
verify(ledger.currentVersion === '01.08.2026.205', `currentVersion=${ledger.currentVersion}`);
verify(ledger.builds.length === 205, `build count=${ledger.builds.length}`);
verify(ledger.builds.every((entry, index) => entry.build === index + 1), 'build sequence is not continuous 1..205');
verify(ledger.builds.at(-1)?.status === 'COMPLETED', `Build 205 status=${ledger.builds.at(-1)?.status}`);
verify(ledger.lastStatusNotification?.build === 205, `status notification build=${ledger.lastStatusNotification?.build}`);
verify(policy.rules?.ledgerUpdateRequiredEveryBuild === true, 'every-build ledger update rule missing');
verify(policy.rules?.statusNotificationRequiredAfterEveryBuild === true, 'post-build notification rule missing');
verify(policy.rules?.sourceArchiveBlockedWhenLedgerIsStale === true, 'stale-ledger delivery block rule missing');
verify(ledger.remainingWork.some((item) => item.id === 'OPEN-001' && item.plannedBuild === 206), 'explicit Build 206 next action missing');

const packageJson = await readJson('package.json');
for (const script of ['build-ledger:generate','build-ledger:update','verify:build-ledger']) verify(typeof packageJson.scripts?.[script] === 'string', `package script missing=${script}`);
verify(packageJson.scripts?.['verify:version']?.includes('verify:build-ledger'), 'verify:version does not enforce master ledger');
const preflight = await readJson('config/source-preflight-checks.json');
verify(preflight.checks?.some((check) => check.id === 'master-build-ledger'), 'source preflight master-build-ledger check missing');
const updater = await read('scripts/set-workspace-version.mjs');
verify(updater.includes('master-build-ledger'), 'version updater does not update master build ledger');
for (const path of ['README.md','START_HERE_TR.md','CONTRIBUTING.md','BUILD_STATUS.md']) {
  const content = await read(path);
  verify(content.includes('17_MASTER_BUILD_LEDGER.md'), `${path} does not reference the master ledger`);
}

const evidence = { schemaVersion: 1, product: ledger.product, version: ledger.currentVersion, build: 205, checks, status: failures.length === 0 ? 'PASS' : 'FAIL', failures, generatedAt: new Date().toISOString() };
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`Build 205 contract failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 205 master build ledger contract verified: ${checks} assertions.`);
