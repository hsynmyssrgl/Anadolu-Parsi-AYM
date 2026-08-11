import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; const v = args[i + 1]; if (!v || v.startsWith('--')) throw new Error(`${name} requires a value.`); return v; };
const reportPath = resolve(option('--report', 'artifacts/validation/build154-clean-validation-contract.json'));
const read = (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await read(path));
const exists = async (path) => { try { await stat(path); return true; } catch { return false; } };
const [rootPackage, lock, ledger, preflight, handoffLib, acquisitionLib, transferLib, acceptanceLib, creator, verifier, inspector, featureEvidence, requestCreation, requestVerification, responseStatus, status, verification] = await Promise.all([
  readJson('package.json'), readJson('package-lock.json'), readJson('artifacts/manifests/VERSION_LEDGER.json'), readJson('config/source-preflight-checks.json'),
  read('scripts/lib/npm-dependency-handoff.mjs'), read('scripts/lib/npm-dependency-acquisition.mjs'), read('scripts/lib/npm-cache-transfer.mjs'), read('scripts/lib/npm-cache-bundle-acceptance.mjs'),
  read('scripts/create-npm-dependency-handoff-request.mjs'), read('scripts/verify-npm-dependency-handoff-request.mjs'), read('scripts/inspect-npm-dependency-handoff-response.mjs'),
  readJson('artifacts/validation/build154-dependency-handoff-contract.json'), readJson('artifacts/validation/build154-handoff-request-creation.json'), readJson('artifacts/validation/build154-handoff-request-verification.json'), readJson('artifacts/validation/build154-handoff-response-status.json'),
  read('BUILD_STATUS_BRONZE_RC2_BUILD154.md'), read('VERIFICATION_REPORT.md')
]);
const current = ledger.entries?.at(-1);
let assertions = 0;
const failures = [];
const verify = (condition, label) => { assertions += 1; if (!condition) failures.push(label); };
const displayVersionMatch = current?.version?.match(/^(\d{2})\.(\d{2})\.(\d{4})\.(\d+)$/);
const packageVersionMatch = current?.packageVersion?.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})-(\d+)$/);
verify(Number.isInteger(current?.sequence) && current.sequence >= 154, 'active build is Build 154 or later');
verify(Boolean(displayVersionMatch) && Number(displayVersionMatch[4]) === current?.sequence, 'active application version build suffix matches the active build');
verify(Boolean(packageVersionMatch) && Number(packageVersionMatch[4]) === current?.sequence && Number(packageVersionMatch[1]) === Number(displayVersionMatch?.[1]) && Number(packageVersionMatch[2]) === Number(displayVersionMatch?.[2]) && Number(packageVersionMatch[3]) === Number(displayVersionMatch?.[3]), 'active package version date and build suffix match the application version');
verify(rootPackage.version === current?.packageVersion && lock.packages?.['']?.version === current?.packageVersion, 'root package and lock align');
verify(current?.stage === 'RC2 Aktif Geliştirme', 'Bronze RC2 Active Development is preserved');
verify(handoffLib.includes("PPT_NPM_DEPENDENCY_HANDOFF_REQUEST"), 'handoff request kind exists');
verify(handoffLib.includes('requestIdFrom'), 'content-addressed request identity exists');
verify(handoffLib.includes('payloads: payloadEntries'), 'request payload hash inventory exists');
verify(handoffLib.includes('responseBundleMustDeclareRequestId: true'), 'response request identity is mandatory');
verify(handoffLib.includes('FETCH_DEPENDENCIES.sh') && handoffLib.includes('FETCH_DEPENDENCIES.ps1'), 'cross-platform connected-machine helpers exist');
verify(handoffLib.includes('officialRegistryOnly: true'), 'official registry only policy is embedded');
verify(handoffLib.includes('verifyDependencyAcquisitionPlan'), 'embedded acquisition plan is reverified');
verify(acquisitionLib.includes('handoffRequestId: plan.handoffRequestId'), 'response manifest propagates request identity');
verify(transferLib.includes('expectedHandoffRequestId'), 'response verifier supports expected request identity');
verify(transferLib.includes('Handoff request mismatch'), 'response mismatch has explicit evidence');
verify(acceptanceLib.includes('expectedHandoffRequestId'), 'acceptance boundary receives expected request identity');
verify(acceptanceLib.includes('receipt.handoffRequestId'), 'acceptance receipt preserves request identity');
verify(acceptanceLib.includes('pointer.handoffRequestId') || acceptanceLib.includes('handoffRequestId: receipt.handoffRequestId'), 'active pointer preserves request identity');
verify(creator.includes('createDependencyHandoffRequest') && creator.includes('verifyDependencyHandoffRequest'), 'request creator self-verifies');
verify(verifier.includes('Request checksum sidecar verification failed'), 'request checksum verification exists');
verify(inspector.includes("BOUND_RESPONSE_NOT_PRESENT"), 'missing response is represented as WAITING');
verify(inspector.includes('expectedHandoffRequestId: request.requestId'), 'response inspector binds response to request');
verify(featureEvidence.status === 'PASS' && featureEvidence.assertions === 28, 'Build 154 fixture is PASS 28/28');
verify(requestCreation.status === 'PASS' && requestCreation.verificationStatus === 'PASS', 'actual request creation is PASS');
verify(requestVerification.status === 'PASS', 'actual request verification is PASS');
verify(requestVerification.requestId === requestCreation.requestId, 'actual request identity is stable');
verify(responseStatus.status === 'WAITING' && responseStatus.classification === 'BOUND_RESPONSE_NOT_PRESENT', 'actual response state is WAITING');
verify(responseStatus.requestId === requestCreation.requestId, 'response state is bound to actual request');
verify(responseStatus.requiredTarballCount === 117, 'actual request contains 117 lockfile tarballs');
verify(await exists(requestCreation.archivePath), 'actual handoff request archive exists');
verify(await exists(requestCreation.checksumPath), 'actual handoff request checksum exists');
for (const name of ['npm-cache:create-handoff-request', 'npm-cache:verify-handoff-request', 'npm-cache:inspect-handoff-response', 'verify:build154:dependency-handoff', 'verify:build154:clean-validation', 'create:build154:validation-boundary']) verify(Boolean(rootPackage.scripts?.[name]), `package script exists: ${name}`);
const ids = new Set(preflight.checks?.map((item) => item.id));
for (const id of ['build154-dependency-handoff-contract', 'build154-handoff-request-create', 'build154-handoff-request-verify', 'build154-handoff-response-status', 'build154-clean-validation-contract']) verify(ids.has(id), `source preflight contains ${id}`);
for (const label of ['Clean install gate', 'Full root `tsc --noEmit`', 'Unit and integration tests', 'Electron production build', 'Blocking smoke chain', 'Windows launch / installer']) {
  verify(status.includes(`- ${label}: **NOT_RUN`), `Build 154 status records ${label}=NOT_RUN`);
  verify(verification.includes(`- ${label}: **NOT_RUN`), `verification report records ${label}=NOT_RUN`);
}
verify(status.includes('Bronze RC2 Active Development'), 'status preserves active development');
verify(status.includes('final sorusu sorulamaz'), 'status prevents final question');
const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', applicationVersion: current?.version, packageVersion: current?.packageVersion, build: current?.sequence, stage: 'Bronze RC2 Active Development', assertions, status: failures.length ? 'FAIL' : 'PASS', failures, generatedAt: new Date().toISOString() };
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 154 clean validation contract: ${report.status} (${assertions - failures.length}/${assertions}).`);
for (const failure of failures) console.error(`- ${failure}`);
if (failures.length) process.exitCode = 1;
