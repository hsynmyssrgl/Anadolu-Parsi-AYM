import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const reportPath = resolve(process.argv.includes('--report') ? process.argv[process.argv.indexOf('--report') + 1] : 'artifacts/validation/build119-architecture.json');
let assertions = 0;
const failures = [];
const verify = (condition, message) => { assertions += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const contractReportPath = resolve('artifacts/validation/renderer-session-security-contract.json');
const contractRun = spawnSync(process.execPath, ['scripts/verify-renderer-session-security-contract.mjs', '--report', contractReportPath], {
  cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, TERM: 'dumb' }
});
verify(contractRun.status === 0, `renderer session security contract subprocess failed: ${contractRun.stderr || contractRun.stdout}`);
const contractReport = await readJson(contractReportPath);
verify(contractReport.status === 'PASS', `renderer session security contract status=${contractReport.status}`);
verify(contractReport.assertions >= 30, `renderer session security assertion count too low=${contractReport.assertions}`);

const packageJson = await readJson('package.json');
const preflight = await readJson('config/source-preflight-checks.json');
const attestation = await readJson('config/delivery-attestation-contract.json');
const mainSource = await readFile('apps/desktop/src/main/main.ts', 'utf8');
const policySource = await readFile('apps/desktop/src/main/renderer-session-security.ts', 'utf8');

verify(packageJson.version === '25.7.2026-119', `package version=${packageJson.version}`);
verify(packageJson.scripts?.['verify:renderer-session-security'] === 'node scripts/verify-renderer-session-security-contract.mjs', 'verify:renderer-session-security script missing');
verify(packageJson.scripts?.['verify:build119:architecture'] === 'node scripts/verify-build119-architecture.mjs', 'verify:build119:architecture script missing');
verify(preflight.checks?.some((item) => item.id === 'renderer-session-security-contract'), 'source preflight renderer session security check missing');
verify(preflight.checks?.length === 12, `source preflight check count=${preflight.checks?.length}`);
verify(attestation.evidence?.some((item) => item.id === 'renderer-session-security-contract' && item.expectedStatus === 'PASS'), 'delivery attestation renderer session evidence missing');
verify(attestation.evidence?.some((item) => item.id === 'build119-architecture' && item.expectedStatus === 'PASS'), 'delivery attestation Build 119 evidence missing');
verify(attestation.evidence?.length === 17, `delivery attestation evidence count=${attestation.evidence?.length}`);

for (const marker of [
  'installRendererSessionSecurity',
  'renderer.session.violation',
  'webSecurity: true',
  'allowRunningInsecureContent: false',
  'webviewTag: false',
  'navigateOnDragDrop: false'
]) verify(mainSource.includes(marker), `main renderer session hardening marker missing=${marker}`);
for (const marker of [
  'setPermissionRequestHandler',
  'setPermissionCheckHandler',
  "'will-download'",
  "'will-redirect'",
  "'will-attach-webview'",
  'downloadProtectedSessions',
  'isTrustedRendererDocument'
]) verify(policySource.includes(marker), `renderer session policy marker missing=${marker}`);
verify(!mainSource.includes("window.webContents.on('will-navigate'"), 'standalone navigation listener remains outside central policy');
verify(!policySource.includes('callback(true)'), 'permission allow path exists');
verify(!policySource.includes("return true"), 'permission check allow path exists');

const report = {
  schemaVersion: 1,
  product: 'Panthera pardus tulliana Aile',
  applicationVersion: '25.07.2026.119',
  packageVersion: '25.7.2026-119',
  stage: 'Bronze RC2 Active Development',
  assertions,
  delegatedAssertions: contractReport.assertions,
  failures,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 119 architecture verification: ${report.status} — ${assertions} integration assertions + ${contractReport.assertions} contract assertions.`);
for (const failure of failures) console.error(`- ${failure}`);
if (report.status !== 'PASS') process.exitCode = 1;
