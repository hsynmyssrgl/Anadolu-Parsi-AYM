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
const reportPath = resolve(option('--report', 'artifacts/validation/build152-clean-validation-contract.json'));
const read = (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await read(path));
const exists = async (path) => { try { await stat(path); return true; } catch { return false; } };
const [rootPackage, lock, ledger, policy, preflight, library, cli, verifier, boundary, status, verification, acceptance] = await Promise.all([
  readJson('package.json'), readJson('package-lock.json'), readJson('artifacts/manifests/VERSION_LEDGER.json'),
  readJson('config/npm-cache-bundle-acceptance-policy.json'), readJson('config/source-preflight-checks.json'),
  read('scripts/lib/npm-cache-bundle-acceptance.mjs'), read('scripts/accept-npm-cache-transfer-bundle.mjs'),
  read('scripts/verify-build152-cache-bundle-acceptance.mjs'), read('scripts/create-build152-validation-boundary.mjs'),
  read('BUILD_STATUS_BRONZE_RC2_BUILD152.md'), read('VERIFICATION_REPORT.md'),
  readJson('artifacts/validation/build152-cache-bundle-acceptance.json')
]);
const current = ledger.entries?.at(-1);
let assertions = 0;
const failures = [];
const verify = (condition, label) => { assertions += 1; if (!condition) failures.push(label); };
verify(Number.isInteger(current?.sequence) && current.sequence >= 152, 'active build is Build 152 or later');
verify(new RegExp(`\\.${current?.sequence}$`).test(current?.version ?? ''), 'active application version matches the active build sequence');
verify(new RegExp(`-${current?.sequence}$`).test(current?.packageVersion ?? ''), 'active package version matches the active build sequence');
verify(rootPackage.version === current?.packageVersion && lock.packages?.['']?.version === current?.packageVersion, 'root package and lock align');
verify(current?.stage === 'RC2 Aktif Geliştirme', 'Bronze RC2 Active Development is preserved');
verify(policy.requireChecksumSidecar === true && policy.importVerifiedBundle === true, 'acceptance policy requires checksum and cache import');
verify(policy.replaceExistingCache === false, 'existing cache replacement is fail-closed');
verify(library.includes('SOURCE_SYMLINK_REJECTED'), 'source symlink rejection exists');
verify(library.includes('CHECKSUM_FILENAME_MISMATCH'), 'checksum filename binding exists');
verify(library.includes('verifyNpmCacheTransferBundle'), 'full transfer bundle verification is used');
verify(library.includes('TARGET_CACHE_EXISTS'), 'existing cache overwrite is rejected');
verify(library.includes('ALREADY_ACCEPTED'), 'idempotent acceptance exists');
verify(library.includes('rejectionReceiptPaths'), 'rejection receipts are separated from accepted receipts');
verify(library.includes('quarantine'), 'rejection quarantine exists');
verify(cli.includes('acceptNpmCacheTransferBundle'), 'acceptance CLI uses validated service');
verify(verifier.includes("spawnSync(npmCommand, ['ci', '--offline'"), 'fixture runs real offline npm ci');
verify(await exists('scripts/accept-npm-dependencies-offline-machine.ps1'), 'PowerShell offline acceptance helper exists');
verify(await exists('scripts/accept-npm-dependencies-offline-machine.sh'), 'shell offline acceptance helper exists');
verify(await exists('tools/npm-dependency-acquisition/ACCEPTANCE_TR.md'), 'Turkish acceptance guide exists');
verify(rootPackage.scripts?.['npm-cache:accept-bundle']?.includes('accept-npm-cache-transfer-bundle.mjs'), 'acceptance CLI is registered');
verify(rootPackage.scripts?.['verify:build152:cache-bundle-acceptance']?.includes('verify-build152-cache-bundle-acceptance.mjs'), 'Build 152 runtime contract is registered');
verify(rootPackage.scripts?.['verify:build152:clean-validation']?.includes('verify-build152-clean-validation-contract.mjs'), 'Build 152 validation contract is registered');
verify(rootPackage.scripts?.['create:build152:validation-boundary']?.includes('create-build152-validation-boundary.mjs'), 'Build 152 boundary generator is registered');
const ids = new Set(preflight.checks?.map((x) => x.id));
verify(ids.has('build152-cache-bundle-acceptance-contract'), 'source preflight contains acceptance contract');
verify(ids.has('build152-clean-validation-contract'), 'source preflight contains Build 152 validation contract');
verify(acceptance.status === 'PASS' && acceptance.assertions === 26, 'acceptance fixture is PASS 26/26');
verify(boundary.includes("status: 'NOT_RUN', reason: 'REAL_117_TARBALL_BUNDLE_NOT_PROVIDED'"), 'boundary preserves real bundle absence');
for (const label of ['Clean install gate', 'Full root `tsc --noEmit`', 'Unit and integration tests', 'Electron production build', 'Blocking smoke chain', 'Windows launch / installer']) {
  verify(status.includes(`- ${label}: **NOT_RUN`), `Build 152 status records ${label}=NOT_RUN`);
  verify(verification.includes(`- ${label}: **NOT_RUN`), `verification report records ${label}=NOT_RUN`);
}
verify(status.includes('Bronze RC2 Active Development'), 'status preserves active development');
verify(status.includes('final sorusu sorulamaz'), 'status prevents final question');
const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', applicationVersion: current?.version, packageVersion: current?.packageVersion, build: current?.sequence, stage: 'Bronze RC2 Active Development', assertions, status: failures.length ? 'FAIL' : 'PASS', failures, generatedAt: new Date().toISOString() };
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 152 clean validation contract: ${report.status} (${assertions - failures.length}/${assertions}).`);
for (const failure of failures) console.error(`- ${failure}`);
if (failures.length) process.exitCode = 1;
