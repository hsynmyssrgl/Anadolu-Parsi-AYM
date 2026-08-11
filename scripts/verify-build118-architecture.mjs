import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const reportPath = resolve(process.argv.includes('--report') ? process.argv[process.argv.indexOf('--report') + 1] : 'artifacts/validation/build118-architecture.json');
let assertions = 0;
const failures = [];
const verify = (condition, message) => { assertions += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const contractReportPath = resolve('artifacts/validation/ipc-sender-trust-contract.json');
const contractRun = spawnSync(process.execPath, ['scripts/verify-ipc-sender-trust-contract.mjs', '--report', contractReportPath], {
  cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, TERM: 'dumb' }
});
verify(contractRun.status === 0, `IPC sender trust contract subprocess failed: ${contractRun.stderr || contractRun.stdout}`);
const contractReport = await readJson(contractReportPath);
verify(contractReport.status === 'PASS', `IPC sender trust contract status=${contractReport.status}`);
verify(contractReport.assertions >= 35, `IPC sender trust assertion count too low=${contractReport.assertions}`);

const packageJson = await readJson('package.json');
const preflight = await readJson('config/source-preflight-checks.json');
const attestation = await readJson('config/delivery-attestation-contract.json');
const desktopTypecheck = await readFile('scripts/verify-desktop-main-source-types.mjs', 'utf8');
const smokeStub = await readFile('tests/smoke/electron-stub.d.ts', 'utf8');

verify(packageJson.version === '25.7.2026-118', `package version=${packageJson.version}`);
verify(packageJson.scripts?.['verify:ipc-sender-trust'] === 'node scripts/verify-ipc-sender-trust-contract.mjs', 'verify:ipc-sender-trust script missing');
verify(packageJson.scripts?.['verify:build118:architecture'] === 'node scripts/verify-build118-architecture.mjs', 'verify:build118:architecture script missing');
verify(preflight.checks?.some((item) => item.id === 'ipc-sender-trust-contract'), 'source preflight IPC sender trust check missing');
verify(attestation.evidence?.some((item) => item.id === 'ipc-sender-trust-contract' && item.expectedStatus === 'PASS'), 'delivery attestation IPC trust evidence missing');
verify(attestation.evidence?.some((item) => item.id === 'build118-architecture' && item.expectedStatus === 'PASS'), 'delivery attestation Build 118 evidence missing');
for (const marker of ['mainFrame', 'senderFrame', "'closed'", 'id: number']) verify(desktopTypecheck.includes(marker), `controlled Electron type shell marker missing=${marker}`);
for (const marker of ['mainFrame', 'senderFrame', "'closed'", 'id: number']) verify(smokeStub.includes(marker), `smoke Electron stub marker missing=${marker}`);

const report = {
  schemaVersion: 1,
  product: 'Panthera pardus tulliana Aile',
  applicationVersion: '25.07.2026.118',
  packageVersion: '25.7.2026-118',
  stage: 'Bronze RC2 Active Development',
  assertions,
  delegatedAssertions: contractReport.assertions,
  failures,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 118 architecture verification: ${report.status} — ${assertions} integration assertions + ${contractReport.assertions} contract assertions.`);
for (const failure of failures) console.error(`- ${failure}`);
if (report.status !== 'PASS') process.exitCode = 1;
