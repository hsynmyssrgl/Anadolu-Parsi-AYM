import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const read = (path) => readFile(path, 'utf8');
const [rootPackageText, desktopPackageText, lockText, ledgerText, preflightText, gatesText, attestationText, boundaryScript, buildStatus, verification, historicalBuild149Status] = await Promise.all([
  read('package.json'),
  read('apps/desktop/package.json'),
  read('package-lock.json'),
  read('artifacts/manifests/VERSION_LEDGER.json'),
  read('config/source-preflight-checks.json'),
  read('config/rc2-validation-gates.json'),
  read('config/delivery-attestation-contract.json'),
  read('scripts/create-build149-validation-boundary.mjs'),
  read('BUILD_STATUS.md'),
  read('VERIFICATION_REPORT.md'),
  read('BUILD_STATUS_BRONZE_RC2_BUILD149.md')
]);
const rootPackage = JSON.parse(rootPackageText);
const desktopPackage = JSON.parse(desktopPackageText);
const lock = JSON.parse(lockText);
const ledger = JSON.parse(ledgerText);
const preflight = JSON.parse(preflightText);
const gates = JSON.parse(gatesText);
const attestation = JSON.parse(attestationText);
const current = ledger.entries?.at(-1);
let assertions = 0;
const failures = [];
const verify = (condition, label) => { assertions += 1; if (!condition) failures.push(label); };

verify(Number(current?.sequence) >= 149, 'Build 149 continuity is evaluated on Build 149 or later');
verify(current?.version?.endsWith(`.${current?.sequence}`), 'active application version and sequence align');
verify(current?.packageVersion === rootPackage.version, 'active package version and root package align');
verify(rootPackage.version === current?.packageVersion, 'root package and ledger version alignment');
verify(current?.stage === 'RC2 Aktif Geliştirme', 'Bronze RC2 Active Development preserved');
verify(!desktopPackage.devDependencies?.esbuild, 'obsolete direct desktop esbuild dependency removed');
verify(!rootPackage.allowScripts || !Object.keys(rootPackage.allowScripts).some((key) => key.startsWith('esbuild@0.25.12')), 'obsolete esbuild install approval removed');
verify(!lock.packages?.['apps/desktop/node_modules/esbuild'], 'obsolete desktop esbuild lock entry removed');
verify(!Object.values(lock.packages ?? {}).some((entry) => entry?.version === '0.25.12' && typeof entry?.resolved === 'string' && entry.resolved.includes('/esbuild')), 'obsolete esbuild 0.25.12 supply entries removed');
verify(rootPackage.scripts?.['verify:lockfile']?.includes('verify-lockfile-integrity.mjs'), 'lockfile integrity gate available');
verify(rootPackage.scripts?.['verify:dependency-supply']?.includes('verify-dependency-supply.mjs'), 'dependency supply gate available');

const preflightIds = new Set(preflight.checks?.map((check) => check.id));
for (const build of [143, 144, 145, 146, 147, 148, 149]) {
  verify([...preflightIds].some((id) => id.startsWith(`build${build}-`)), `source preflight contains Build ${build} continuity checks`);
}
const expectedGateIds = ['source-preflight', 'clean-npm-ci', 'tsc-no-emit', 'unit-tests', 'electron-production-build', 'smoke-tests', 'windows-real-launch', 'windows-installer'];
verify(gates.stopOnFailure === true, 'RC2 validation gates stop on first blocking failure');
verify(JSON.stringify(gates.gates?.map((gate) => gate.id)) === JSON.stringify(expectedGateIds), 'RC2 gate order is unchanged');
verify(gates.gates?.find((gate) => gate.id === 'clean-npm-ci')?.command === 'node', 'clean npm ci uses controlled runner');
verify(gates.gates?.find((gate) => gate.id === 'tsc-no-emit')?.args?.includes('typecheck'), 'full root typecheck gate retained');
verify(gates.gates?.find((gate) => gate.id === 'electron-production-build')?.args?.includes('build'), 'Electron production build gate retained');
verify(gates.gates?.find((gate) => gate.id === 'smoke-tests')?.args?.includes('verify:bronze'), 'blocking smoke gate retained');
verify(rootPackage.scripts?.['create:build149:validation-boundary']?.includes('create-build149-validation-boundary.mjs'), 'Build 149 validation boundary generator registered');
verify(boundaryScript.includes("overallStatus: results.every((result) => result.status === 'PASS') ? 'PASS' : 'INCOMPLETE'"), 'validation boundary derives incomplete status from actual results');
const attestationEvidence = new Map(attestation.evidence?.map((item) => [item.id, item]));
if (Number(current?.sequence) === 149) {
  verify(attestationEvidence.get('source-preflight')?.path === 'artifacts/validation/build149-source-preflight-final.json', 'delivery attestation uses Build 149 source preflight evidence');
  verify(attestationEvidence.get('source-integrity')?.path === 'artifacts/validation/build149-source-integrity-final.json', 'delivery attestation uses Build 149 source integrity evidence');
  verify(attestationEvidence.get('validation-boundary')?.path === 'artifacts/validation/build149-validation-boundary.json', 'delivery attestation uses Build 149 validation boundary');
  verify(attestationEvidence.get('package-source-typecheck')?.expectedStatus === 'FAIL' && attestationEvidence.get('desktop-main-source-typecheck')?.expectedStatus === 'FAIL', 'delivery attestation preserves failed controlled typechecks');
} else {
  verify(attestationEvidence.get('source-preflight')?.path === `artifacts/validation/build${current?.sequence}-source-preflight-final.json`, 'active delivery attestation follows the current source preflight evidence');
  verify(attestationEvidence.get('source-integrity')?.path === `artifacts/validation/build${current?.sequence}-source-integrity-final.json`, 'active delivery attestation follows the current source integrity evidence');
  verify(attestationEvidence.get('validation-boundary')?.path === `artifacts/validation/build${current?.sequence}-validation-boundary.json`, 'active delivery attestation follows the current validation boundary');
  verify(['PASS', 'FAIL'].includes(attestationEvidence.get('package-source-typecheck')?.expectedStatus) && ['PASS', 'FAIL'].includes(attestationEvidence.get('desktop-main-source-typecheck')?.expectedStatus), 'active delivery attestation records controlled typecheck outcomes explicitly');
}

const build149StatusEvidence = Number(current?.sequence) === 149 ? buildStatus : historicalBuild149Status;
const build149VerificationEvidence = Number(current?.sequence) === 149 ? verification : historicalBuild149Status;
for (const [label, expected] of [
  ['Clean install gate', 'FAIL'],
  ['Full root `tsc --noEmit`', 'FAIL'],
  ['Unit and integration tests', 'FAIL'],
  ['Electron production build', 'FAIL'],
  ['Blocking smoke chain', 'FAIL']
]) {
  verify(new RegExp(`^- ${label.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}: \\*\\*${expected}`, 'm').test(build149StatusEvidence), `Build 149 status honestly records ${label}=${expected}`);
  verify(new RegExp(`^- ${label.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}: \\*\\*${expected}\\*\\*`, 'm').test(build149VerificationEvidence), `Build 149 verification evidence honestly records ${label}=${expected}`);
}
verify(!/Clean install gate: \*\*PASS/i.test(build149StatusEvidence), 'clean install is not falsely reported PASS');
verify(!/Full root `tsc --noEmit`: \*\*PASS/i.test(build149StatusEvidence), 'full typecheck is not falsely reported PASS');
verify(!/Electron production build: \*\*PASS/i.test(build149StatusEvidence), 'production build is not falsely reported PASS');
verify(!/Blocking smoke chain: \*\*PASS/i.test(build149StatusEvidence), 'smoke chain is not falsely reported PASS');

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  featureBuild: 149,
  applicationVersion: current?.version ?? null,
  packageVersion: current?.packageVersion ?? null,
  stage: 'Bronze RC2 Active Development',
  scope: 'Clean validation orchestration, dependency bootstrap evidence, historical feature continuity coverage and honest gate reporting',
  assertions,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
const reportPath = 'artifacts/validation/build149-clean-validation-contract.json';
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`Build 149 clean validation contract: FAIL (${assertions - failures.length}/${assertions})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Build 149 clean validation contract: PASS (${assertions}/${assertions}).`);
}
