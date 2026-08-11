import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const reportPath = resolve(option('--report', 'artifacts/validation/build150-clean-validation-contract.json'));
const read = (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await read(path));
const exists = async (path) => { try { await stat(path); return true; } catch { return false; } };
const [rootPackage, desktopPackage, rootLock, packagerPackage, packagerLock, ledger, policy, preflight, runner, boundary, status, verification] = await Promise.all([
  readJson('package.json'),
  readJson('apps/desktop/package.json'),
  readJson('package-lock.json'),
  readJson('tools/windows-packager/package.json'),
  readJson('tools/windows-packager/package-lock.json'),
  readJson('artifacts/manifests/VERSION_LEDGER.json'),
  readJson('config/npm-ci-policy.json'),
  readJson('config/source-preflight-checks.json'),
  read('scripts/run-clean-npm-ci.mjs'),
  read('scripts/create-build150-validation-boundary.mjs'),
  read('BUILD_STATUS_BRONZE_RC2_BUILD150.md'),
  read('BUILD150_DELIVERY_VALIDATION_REPORT.md')
]);
const current = ledger.entries?.at(-1);
let assertions = 0;
const failures = [];
const verify = (condition, label) => { assertions += 1; if (!condition) failures.push(label); };

verify(Number(current?.sequence) >= 150, 'active build preserves Build 150 or later');
verify(/^\d{2}\.\d{2}\.\d{4}\.\d+$/.test(current?.version ?? ''), 'active application version format is valid');
verify(/^\d{1,2}\.\d{1,2}\.\d{4}-\d+$/.test(current?.packageVersion ?? ''), 'active package version format is valid');
verify(current?.packageVersion === rootPackage.version, 'ledger and root package versions align');
verify(current?.stage === 'RC2 Aktif Geliştirme', 'Bronze RC2 Active Development is preserved');
verify(policy.ignoreScripts === true, 'clean npm ci policy disables lifecycle scripts');
verify(policy.registry === 'https://registry.npmjs.org/', 'clean npm ci policy pins the official registry');
verify(runner.includes("PPT_NPM_CACHE_BUNDLE"), 'clean runner supports the cache bundle environment variable');
verify(runner.includes("--cache-bundle"), 'clean runner supports the cache bundle CLI option');
verify(runner.includes('importNpmCacheTransferBundle'), 'clean runner verifies and imports cache transfer bundles');
verify(runner.includes("CACHE_BUNDLE_REJECTED"), 'clean runner rejects mismatched cache bundles fail-closed');
verify(runner.includes("'--ignore-scripts'"), 'clean runner passes --ignore-scripts');
verify(runner.includes("'--offline'"), 'clean runner supports a fully offline install');
verify(rootPackage.scripts?.['verify:build150:dependency-bootstrap']?.includes('verify-build150-dependency-bootstrap.mjs'), 'dependency bootstrap contract is registered');
verify(rootPackage.scripts?.['verify:build150:windows-packager-split']?.includes('verify-windows-packager-split.mjs'), 'Windows packager split contract is registered');
verify(rootPackage.scripts?.['verify:build150:clean-validation']?.includes('verify-build150-clean-validation-contract.mjs'), 'Build 150 clean validation contract is registered');
verify(rootPackage.scripts?.['create:build150:validation-boundary']?.includes('create-build150-validation-boundary.mjs'), 'Build 150 validation boundary generator is registered');
verify(!desktopPackage.devDependencies?.['electron-builder'], 'desktop workspace no longer directly installs electron-builder');
verify(!rootPackage.devDependencies?.['electron-builder'], 'root workspace does not install electron-builder');
verify(!rootLock.packages?.['node_modules/electron-builder'], 'root lock excludes electron-builder');
verify(!Object.keys(rootLock.packages ?? {}).some((key) => key.includes('app-builder-lib')), 'root lock excludes app-builder-lib');
verify(!Object.keys(rootLock.packages ?? {}).some((key) => key.endsWith('/yargs-parser')), 'root lock excludes the previous yargs-parser blocker');
verify(packagerPackage.devDependencies?.['electron-builder'] === '26.15.6', 'isolated Windows toolchain pins electron-builder');
verify(packagerLock.packages?.['node_modules/electron-builder']?.version === '26.15.6', 'isolated Windows toolchain lock pins electron-builder');
verify(packagerLock.packages?.['']?.version === current?.packageVersion, 'isolated Windows toolchain lock version follows active build');
verify(await exists('tools/electron-builder-squirrel-windows-stub/package.json'), 'fail-closed Squirrel compatibility stub exists');
const preflightIds = new Set(preflight.checks?.map((check) => check.id));
verify(preflightIds.has('build150-dependency-bootstrap-contract'), 'source preflight contains dependency bootstrap contract');
verify(preflightIds.has('build150-windows-packager-split'), 'source preflight contains Windows packager split contract');
verify(preflightIds.has('build150-clean-validation-contract'), 'source preflight contains Build 150 clean validation contract');
verify(boundary.includes("overallStatus: results.every((result) => result.status === 'PASS') ? 'PASS' : 'INCOMPLETE'"), 'validation boundary derives status from actual gates');
verify(boundary.includes("EXTERNAL_DEPENDENCY_SERVICE_UNAVAILABLE"), 'validation boundary preserves external dependency failure classification');
verify(boundary.includes("DEPENDENCY_BOOTSTRAP_UNAVAILABLE"), 'validation boundary preserves downstream dependency failure classification');
for (const [label, expected] of [
  ['Clean install gate', 'FAIL'],
  ['Full root `tsc --noEmit`', 'FAIL'],
  ['Unit and integration tests', 'FAIL'],
  ['Electron production build', 'FAIL'],
  ['Blocking smoke chain', 'FAIL'],
  ['Windows launch / installer', 'NOT_RUN']
]) {
  verify(status.includes(`- ${label}: **${expected}`), `Build 150 status honestly records ${label}=${expected}`);
  verify(verification.includes(`- ${label}: **${expected}`), `verification report honestly records ${label}=${expected}`);
}
verify(!/Bronze RC2 Final|Code Freeze|\bSilver\b|\bGold\b/.test(status.replace('Bronze RC2 Final, Code Freeze, Silver veya\nGold aşamasına geçilmemiştir.', '')), 'status does not claim a promoted stage');

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: current?.version,
  packageVersion: current?.packageVersion,
  featureBuild: 150,
  activeBuild: current?.sequence,
  stage: 'Bronze RC2 Active Development',
  assertions,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`Build 150 clean validation contract failed: ${failures.length} issue(s) / ${assertions} assertions.`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 150 clean validation contract verified: ${assertions}/${assertions}.`);
