import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const reportPath = resolve(process.argv.includes('--report') ? process.argv[process.argv.indexOf('--report') + 1] : 'artifacts/validation/build117-architecture.json');
let assertions = 0;
const failures = [];
const verify = (condition, message) => { assertions += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const packageJson = await readJson('package.json');
const preflight = await readJson('config/source-preflight-checks.json');
const attestation = await readJson('config/delivery-attestation-contract.json');
const helper = await readFile('scripts/lib/npm-cache-transfer.mjs', 'utf8');
const creator = await readFile('scripts/create-npm-cache-transfer-bundle.mjs', 'utf8');
const verifier = await readFile('scripts/verify-npm-cache-transfer-bundle.mjs', 'utf8');
const importer = await readFile('scripts/import-npm-cache-transfer-bundle.mjs', 'utf8');
const runner = await readFile('scripts/run-clean-npm-ci.mjs', 'utf8');
const contract = await readFile('scripts/verify-npm-cache-transfer-contract.mjs', 'utf8');
const ci = await readFile('.github/workflows/ci.yml', 'utf8');
const windows = await readFile('.github/workflows/windows-rc2-validation.yml', 'utf8');

verify(packageJson.version === '25.7.2026-117', `package version=${packageJson.version}`);
for (const [name, command] of Object.entries({
  'npm-cache:bundle': 'node scripts/create-npm-cache-transfer-bundle.mjs',
  'npm-cache:verify-bundle': 'node scripts/verify-npm-cache-transfer-bundle.mjs',
  'npm-cache:import-bundle': 'node scripts/import-npm-cache-transfer-bundle.mjs',
  'verify:npm-cache-transfer-contract': 'node scripts/verify-npm-cache-transfer-contract.mjs',
  'verify:build117:architecture': 'node scripts/verify-build117-architecture.mjs'
})) verify(packageJson.scripts?.[name] === command, `package script ${name} missing`);
verify(preflight.checks?.some((item) => item.id === 'npm-cache-transfer-contract'), 'source preflight cache transfer contract missing');
verify(attestation.evidence?.some((item) => item.id === 'npm-cache-transfer-contract' && item.expectedStatus === 'PASS'), 'attestation cache transfer evidence missing');
verify(attestation.evidence?.some((item) => item.id === 'build117-architecture'), 'attestation Build 117 evidence missing');
verify(attestation.evidence?.some((item) => item.id === 'npm-cache-transfer-bundle-creation' && item.expectedStatus === 'INCOMPLETE'), 'attestation cache bundle creation evidence missing');
for (const marker of ['PPT_NPM_CACHE_TRANSFER_BUNDLE', 'packageLockSha256', 'officialRegistryOnly', 'complete: true', 'writeDeterministicZip', 'inspectDeterministicZip', 'readStoredZipEntry', 'Target cache root must not already exist', 'index-v5', 'npmCacheContentPath', 'sha512-']) verify(helper.includes(marker), `helper marker missing=${marker}`);
for (const [content, marker] of [[creator, '--cache'], [creator, '--output'], [verifier, '--archive'], [importer, '--target-cache'], [contract, 'tampered archive was accepted'], [contract, 'non-official registry lockfile was not rejected']]) verify(content.includes(marker), `script marker missing=${marker}`);
for (const marker of ['currentAttemptForceSettle', 'child.stdout?.destroy()', 'child.stderr?.destroy()', 'forcedSettlement: true']) verify(runner.includes(marker), `clean runner settlement marker missing=${marker}`);
verify(ci.includes('npm-cache-transfer-contract.json'), 'Linux CI transfer contract evidence missing');
verify(windows.includes('npm-cache-transfer-contract.json'), 'Windows workflow transfer contract evidence missing');

const report = { schemaVersion: 1, product: 'Panthera pardus tulliana Aile', applicationVersion: '25.07.2026.117', packageVersion: '25.7.2026-117', stage: 'Bronze RC2 Active Development', assertions, failures, status: failures.length === 0 ? 'PASS' : 'FAIL', generatedAt: new Date().toISOString() };
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 117 architecture verification: ${report.status} — ${assertions} assertions.`);
for (const failure of failures) console.error(`- ${failure}`);
if (report.status !== 'PASS') process.exitCode = 1;
