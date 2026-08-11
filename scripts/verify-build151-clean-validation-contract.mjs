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
const reportPath = resolve(option('--report', 'artifacts/validation/build151-clean-validation-contract.json'));
const read = (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await read(path));
const exists = async (path) => { try { await stat(path); return true; } catch { return false; } };
const readJsonOptional = async (path) => await exists(path) ? readJson(path) : null;
const [rootPackage, lock, ledger, acquisitionPolicy, preflight, acquisitionLibrary, planCli, fetchCli, boundary, status, verification, planReport, attemptReport, cleanReport] = await Promise.all([
  readJson('package.json'),
  readJson('package-lock.json'),
  readJson('artifacts/manifests/VERSION_LEDGER.json'),
  readJson('config/npm-dependency-acquisition-policy.json'),
  readJson('config/source-preflight-checks.json'),
  read('scripts/lib/npm-dependency-acquisition.mjs'),
  read('scripts/create-npm-dependency-acquisition-plan.mjs'),
  read('scripts/fetch-npm-dependency-acquisition-bundle.mjs'),
  read('scripts/create-build151-validation-boundary.mjs'),
  read('BUILD_STATUS_BRONZE_RC2_BUILD151.md'),
  read('BUILD151_DELIVERY_VALIDATION_REPORT.md'),
  readJsonOptional('artifacts/validation/build151-npm-dependency-acquisition-plan-report.json'),
  readJsonOptional('artifacts/validation/build151-npm-dependency-acquisition-attempt.json'),
  readJsonOptional('artifacts/validation/build151-clean-npm-ci-final.json')
]);
const current = ledger.entries?.at(-1);
let assertions = 0;
const failures = [];
const verify = (condition, label) => { assertions += 1; if (!condition) failures.push(label); };

verify(current?.sequence >= 151, 'active build is Build 151 or later');
verify(/^\d{2}\.07\.2026\.\d+$/.test(current?.version ?? ''), 'active application version remains in the July 2026 sequence');
verify(/^\d{1,2}\.7\.2026-\d+$/.test(current?.packageVersion ?? ''), 'active package version remains in the July 2026 sequence');
verify(current?.packageVersion === rootPackage.version, 'ledger and root package versions align');
verify(lock.packages?.['']?.version === current?.packageVersion, 'root lock version follows active build');
verify(current?.stage === 'RC2 Aktif Geliştirme', 'Bronze RC2 Active Development is preserved');
verify(acquisitionPolicy.registry === 'https://registry.npmjs.org/', 'acquisition policy pins official npm registry');
verify(acquisitionPolicy.officialRegistryOnly === true, 'acquisition policy is official-registry-only');
verify(acquisitionPolicy.redirectPolicy === 'SAME_ORIGIN_ONLY', 'acquisition redirect policy is same-origin-only');
verify(acquisitionPolicy.concurrency >= 1 && acquisitionPolicy.concurrency <= 16, 'acquisition concurrency is bounded');
verify(acquisitionPolicy.maxTarballBytes <= 1_073_741_824, 'tarball size limit is bounded');
verify(acquisitionLibrary.includes("PPT_NPM_DEPENDENCY_ACQUISITION_PLAN"), 'acquisition plan kind exists');
verify(acquisitionLibrary.includes("requested.protocol !== 'https:'"), 'non-HTTPS tarballs are rejected');
verify(acquisitionLibrary.includes('requested.origin !== official.origin'), 'non-official tarballs are rejected');
verify(acquisitionLibrary.includes("redirect: 'manual'"), 'redirects are manually controlled');
verify(acquisitionLibrary.includes('SHA-512 integrity mismatch'), 'tarball SHA-512 mismatch is rejected');
verify(acquisitionLibrary.includes('isSymbolicLink()'), 'staged symlinks are rejected');
verify(acquisitionLibrary.includes('.partial-'), 'tarballs use partial atomic staging names');
verify(acquisitionLibrary.includes('error?.cause?.code'), 'nested fetch network codes are normalized');
verify(acquisitionLibrary.includes('writeDeterministicZip'), 'acquisition output is deterministic');
verify(acquisitionLibrary.includes('verifyNpmCacheTransferBundle'), 'created bundle is independently verified');
verify(planCli.includes('createDependencyAcquisitionPlan'), 'plan CLI uses the validated plan builder');
verify(fetchCli.includes('acquireDependencyBundle'), 'fetch CLI uses the acquisition service');
verify(await exists('scripts/fetch-npm-dependencies-connected-machine.ps1'), 'PowerShell connected-machine helper exists');
verify(await exists('scripts/fetch-npm-dependencies-connected-machine.sh'), 'shell connected-machine helper exists');
verify(await exists('tools/npm-dependency-acquisition/README_TR.md'), 'Turkish acquisition guide exists');
verify(rootPackage.scripts?.['npm-cache:acquisition-plan']?.includes('create-npm-dependency-acquisition-plan.mjs'), 'plan script is registered');
verify(rootPackage.scripts?.['npm-cache:fetch-bundle']?.includes('fetch-npm-dependency-acquisition-bundle.mjs'), 'fetch script is registered');
verify(rootPackage.scripts?.['verify:build151:dependency-acquisition']?.includes('verify-build151-dependency-acquisition.mjs'), 'Build 151 acquisition contract is registered');
verify(rootPackage.scripts?.['verify:build151:clean-validation']?.includes('verify-build151-clean-validation-contract.mjs'), 'Build 151 clean validation contract is registered');
verify(rootPackage.scripts?.['create:build151:validation-boundary']?.includes('create-build151-validation-boundary.mjs'), 'Build 151 boundary generator is registered');
const preflightIds = new Set(preflight.checks?.map((check) => check.id));
verify(preflightIds.has('build151-dependency-acquisition-contract'), 'source preflight contains Build 151 acquisition contract');
verify(preflightIds.has('build151-clean-validation-contract'), 'source preflight contains Build 151 clean validation contract');
verify(planReport === null || (planReport.status === 'PASS' && planReport.requiredTarballCount === 117), 'acquisition plan evidence, when retained, covers 117 official tarballs');
verify(attemptReport === null || (attemptReport.status === 'FAIL' && attemptReport.classification === 'EAI_AGAIN'), 'acquisition attempt evidence, when retained, preserves EAI_AGAIN');
verify(cleanReport === null || (cleanReport.status === 'FAIL' && cleanReport.classification === 'EXTERNAL_DEPENDENCY_SERVICE_UNAVAILABLE'), 'clean npm ci evidence, when retained, preserves external service failure');
verify(cleanReport === null || (cleanReport.offlineCacheReadiness?.readyTarballCount === 0 && cleanReport.offlineCacheReadiness?.requiredTarballCount === 117), 'clean npm ci evidence, when retained, records 0/117 cache readiness');
verify(boundary.includes("overallStatus: results.every((result) => result.status === 'PASS') ? 'PASS' : 'INCOMPLETE'"), 'validation boundary derives status from actual gates');
verify(boundary.includes("acquisition.classification !== 'EAI_AGAIN'"), 'validation boundary verifies real acquisition classification');
for (const [label, expected] of [
  ['Clean install gate', 'FAIL'],
  ['Full root `tsc --noEmit`', 'FAIL'],
  ['Unit and integration tests', 'FAIL'],
  ['Electron production build', 'FAIL'],
  ['Blocking smoke chain', 'FAIL'],
  ['Windows launch / installer', 'NOT_RUN']
]) {
  verify(status.includes(`- ${label}: **${expected}`), `Build 151 status records ${label}=${expected}`);
  verify(verification.includes(`- ${label}: **${expected}`), `verification report records ${label}=${expected}`);
}
verify(status.includes('Bronze RC2 Active Development'), 'status preserves Bronze RC2 Active Development');
verify(status.includes('final sorusu sorulamaz'), 'status prevents final question while gates fail');

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: current?.version,
  packageVersion: current?.packageVersion,
  build: current?.sequence,
  stage: 'Bronze RC2 Active Development',
  assertions,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 151 clean validation contract: ${report.status} (${assertions - failures.length}/${assertions}).`);
for (const failure of failures) console.error(`- ${failure}`);
if (failures.length) process.exitCode = 1;
