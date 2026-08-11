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
const reportPath = resolve(option('--report', 'artifacts/validation/build153-clean-validation-contract.json'));
const read = (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await read(path));
const exists = async (path) => { try { await stat(path); return true; } catch { return false; } };
const [rootPackage, lock, ledger, policy, acceptancePolicy, preflight, library, orchestrator, verifier, boundary, status, verification, contractEvidence] = await Promise.all([
  readJson('package.json'), readJson('package-lock.json'), readJson('artifacts/manifests/VERSION_LEDGER.json'),
  readJson('config/accepted-cache-rc2-validation-policy.json'), readJson('config/npm-cache-bundle-acceptance-policy.json'), readJson('config/source-preflight-checks.json'),
  read('scripts/lib/accepted-cache-rc2-validation.mjs'), read('scripts/run-accepted-cache-rc2-validation.mjs'),
  read('scripts/verify-build153-accepted-cache-validation.mjs'), read('scripts/create-build153-validation-boundary.mjs'),
  read('BUILD_STATUS_BRONZE_RC2_BUILD153.md'), read('VERIFICATION_REPORT.md'),
  readJson('artifacts/validation/build153-accepted-cache-validation-contract.json')
]);
const current = ledger.entries?.at(-1);
let assertions = 0;
const failures = [];
const verify = (condition, label) => { assertions += 1; if (!condition) failures.push(label); };
verify(Number.isInteger(current?.sequence) && current.sequence >= 153, 'active build is Build 153 or later');
verify(new RegExp(`\.${current?.sequence}$`).test(current?.version ?? ''), 'active application version matches the active build sequence');
verify(new RegExp(`-${current?.sequence}$`).test(current?.packageVersion ?? ''), 'active package version matches the active build sequence');
verify(rootPackage.version === current?.packageVersion && lock.packages?.['']?.version === current?.packageVersion, 'root package and lock align');
verify(current?.stage === 'RC2 Aktif Geliştirme', 'Bronze RC2 Active Development is preserved');
verify(policy.schemaVersion === 1 && policy.requireCompleteImportedCache === true && policy.verifyBundlePayloadBeforeGates === true, 'orchestration policy requires complete cache and payload verification');
verify(policy.acceptedBundleEnvironmentVariable === 'PPT_NPM_CACHE_BUNDLE', 'accepted bundle environment variable is fixed');
verify(policy.acceptedReceiptEnvironmentVariable === 'PPT_NPM_CACHE_ACCEPTANCE_RECEIPT', 'accepted receipt environment variable is fixed');
verify(policy.runnerTimeoutMs === 1800000, 'gate runner timeout is controlled');
verify(acceptancePolicy.importVerifiedBundle === true && acceptancePolicy.replaceExistingCache === false, 'acceptance import remains fail-closed');
verify(library.includes('POINTER_LOCK_MISMATCH'), 'pointer/lock binding exists');
verify(library.includes('RECEIPT_SHA256_MISMATCH'), 'receipt checksum binding exists');
verify(library.includes('ACCEPTED_ARCHIVE_SHA256_MISMATCH'), 'accepted archive checksum binding exists');
verify(library.includes('ACCEPTED_CACHE_NOT_READY'), 'complete cache readiness is required');
verify(library.includes('verifyNpmCacheTransferBundle'), 'full accepted bundle verification is used');
verify(library.includes('assessNpmOfflineCache'), 'offline cache readiness is reassessed');
verify(orchestrator.includes('gatesStarted: false'), 'pre-gate failure report exists');
verify(orchestrator.includes('[policy.acceptedBundleEnvironmentVariable]'), 'verified bundle is propagated to the gate runner');
verify(orchestrator.includes('[policy.acceptedReceiptEnvironmentVariable]'), 'verified receipt is propagated to the gate runner');
verify(orchestrator.includes("scripts/run-rc2-validation-gates.mjs") || policy.gateRunnerScript === 'scripts/run-rc2-validation-gates.mjs', 'RC2 gate runner is configured');
verify(orchestrator.includes('ensureProjectFile'), 'runner, gate config and policy paths are constrained to project root');
verify(orchestrator.includes("releaseReadinessStatus"), 'platform and release status are separated');
verify(verifier.includes("mode: 'platform-pass'"), 'fixture covers platform-complete validation');
verify(verifier.includes("mode: 'full-pass'"), 'fixture covers full release-complete validation');
verify(verifier.includes("mode: 'fail'"), 'fixture covers downstream gate failure');
verify(verifier.includes("tamperedPointer.receiptSha256"), 'fixture covers receipt pointer tamper');
verify(verifier.includes('tamperedArchive'), 'fixture covers accepted archive tamper');
verify(contractEvidence.status === 'PASS' && contractEvidence.assertions === 20, 'accepted-cache orchestration fixture is PASS 20/20');
verify(await exists('config/accepted-cache-rc2-validation-policy.json'), 'orchestration policy exists');
verify(rootPackage.scripts?.['validate:rc2:accepted-cache']?.includes('run-accepted-cache-rc2-validation.mjs'), 'accepted-cache RC2 CLI is registered');
verify(rootPackage.scripts?.['verify:build153:accepted-cache-validation']?.includes('verify-build153-accepted-cache-validation.mjs'), 'Build 153 runtime contract is registered');
verify(rootPackage.scripts?.['verify:build153:clean-validation']?.includes('verify-build153-clean-validation-contract.mjs'), 'Build 153 clean contract is registered');
verify(rootPackage.scripts?.['create:build153:validation-boundary']?.includes('create-build153-validation-boundary.mjs'), 'Build 153 boundary generator is registered');
const ids = new Set(preflight.checks?.map((item) => item.id));
verify(ids.has('build153-accepted-cache-validation-contract'), 'source preflight contains accepted-cache orchestration contract');
verify(ids.has('build153-clean-validation-contract'), 'source preflight contains Build 153 clean contract');
verify(boundary.includes("VERIFIED_ACCEPTED_117_TARBALL_BUNDLE_NOT_PRESENT"), 'boundary preserves missing accepted bundle state');
verify(boundary.includes("orchestrationBlock.gatesStarted !== false"), 'boundary requires fail-closed pre-gate evidence');
for (const label of ['Clean install gate', 'Full root `tsc --noEmit`', 'Unit and integration tests', 'Electron production build', 'Blocking smoke chain', 'Windows launch / installer']) {
  verify(status.includes(`- ${label}: **NOT_RUN`), `Build 153 status records ${label}=NOT_RUN`);
  verify(verification.includes(`- ${label}: **NOT_RUN`), `verification report records ${label}=NOT_RUN`);
}
verify(status.includes('Bronze RC2 Active Development'), 'status preserves active development');
verify(status.includes('final sorusu sorulamaz'), 'status prevents final question');
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: current?.version,
  packageVersion: current?.packageVersion,
  build: current?.sequence,
  stage: 'Bronze RC2 Active Development',
  assertions,
  status: failures.length ? 'FAIL' : 'PASS',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 153 clean validation contract: ${report.status} (${assertions - failures.length}/${assertions}).`);
for (const failure of failures) console.error(`- ${failure}`);
if (failures.length) process.exitCode = 1;
