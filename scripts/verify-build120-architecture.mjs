import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const reportPath = resolve(process.argv.includes('--report') ? process.argv[process.argv.indexOf('--report') + 1] : 'artifacts/validation/build120-architecture.json');
let assertions = 0;
const failures = [];
const verify = (condition, message) => { assertions += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const contractReportPath = resolve('artifacts/validation/ipc-payload-security-contract.json');
const contractRun = spawnSync(process.execPath, ['scripts/verify-ipc-payload-security-contract.mjs', '--report', contractReportPath], {
  cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, TERM: 'dumb' }
});
verify(contractRun.status === 0, `IPC payload security contract subprocess failed: ${contractRun.stderr || contractRun.stdout}`);
const contractReport = await readJson(contractReportPath);
verify(contractReport.status === 'PASS', `IPC payload security contract status=${contractReport.status}`);
verify(contractReport.assertions >= 90, `IPC payload security assertion count too low=${contractReport.assertions}`);

const packageJson = await readJson('package.json');
const preflight = await readJson('config/source-preflight-checks.json');
const attestation = await readJson('config/delivery-attestation-contract.json');
const runtimeSource = await readFile('apps/desktop/src/main/ipc-runtime.ts', 'utf8');
const policySource = await readFile('apps/desktop/src/main/ipc-payload-security.ts', 'utf8');

verify(packageJson.version === '25.7.2026-120', `package version=${packageJson.version}`);
verify(packageJson.scripts?.['verify:ipc-payload-security'] === 'node scripts/verify-ipc-payload-security-contract.mjs', 'verify:ipc-payload-security script missing');
verify(packageJson.scripts?.['verify:build120:architecture'] === 'node scripts/verify-build120-architecture.mjs', 'verify:build120:architecture script missing');
verify(preflight.checks?.some((item) => item.id === 'ipc-payload-security-contract'), 'source preflight IPC payload security check missing');
verify(preflight.checks?.length === 13, `source preflight check count=${preflight.checks?.length}`);
verify(attestation.evidence?.some((item) => item.id === 'ipc-payload-security-contract' && item.expectedStatus === 'PASS'), 'delivery attestation IPC payload evidence missing');
verify(attestation.evidence?.some((item) => item.id === 'build120-architecture' && item.expectedStatus === 'PASS'), 'delivery attestation Build 120 evidence missing');
verify(attestation.evidence?.length === 18, `delivery attestation evidence count=${attestation.evidence?.length}`);

for (const marker of [
  'evaluateIpcPayloadSecurity',
  'ipc.payload.rejected',
  'payloadEstimatedBytes',
  'payloadNodeCount',
  'CORE_INVALID_ARGUMENT'
]) verify(runtimeSource.includes(marker), `IPC runtime payload security marker missing=${marker}`);
for (const marker of [
  'maxArgumentCount',
  'maxDepth',
  'maxNodes',
  'maxEstimatedBytes',
  'maxStringBytes',
  'maxArrayLength',
  'maxObjectKeys',
  'Reflect.ownKeys',
  'Object.getOwnPropertyDescriptor',
  'WeakSet<object>',
  'FORBIDDEN_KEY_REJECTED',
  'DUPLICATE_REFERENCE_REJECTED',
  'NON_PLAIN_OBJECT_REJECTED'
]) verify(policySource.includes(marker), `IPC payload policy marker missing=${marker}`);
verify(runtimeSource.indexOf('evaluateIpcSenderTrust') < runtimeSource.indexOf('evaluateIpcPayloadSecurity'), 'IPC payload evaluated before sender trust');
verify(runtimeSource.indexOf('evaluateIpcPayloadSecurity') < runtimeSource.indexOf('input.handler'), 'IPC handler invoked before payload security');
verify(!policySource.includes('JSON.stringify(rawArguments)'), 'unsafe JSON serialization used as payload security boundary');
verify(!runtimeSource.includes('...(rawArguments as TArguments)\n      );'), 'legacy unguarded direct IPC handler invocation marker remains');

const report = {
  schemaVersion: 1,
  product: 'Panthera pardus tulliana Aile',
  applicationVersion: '25.07.2026.120',
  packageVersion: '25.7.2026-120',
  stage: 'Bronze RC2 Active Development',
  assertions,
  delegatedAssertions: contractReport.assertions,
  failures,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 120 architecture verification: ${report.status} — ${assertions} integration assertions + ${contractReport.assertions} contract assertions.`);
for (const failure of failures) console.error(`- ${failure}`);
if (report.status !== 'PASS') process.exitCode = 1;
