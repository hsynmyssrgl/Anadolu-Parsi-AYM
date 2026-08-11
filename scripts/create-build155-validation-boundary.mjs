import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const reportPath = resolve(option('--report', 'artifacts/validation/build155-validation-boundary.json'));
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const [
  sourcePreflight,
  sourceIntegrity,
  bootstrapContract,
  dashboardRuntime,
  bridgeSyntax,
  packageSourceTypes,
  desktopMainTypes,
  requestCreation,
  responseStatus
] = await Promise.all([
  readJson('artifacts/validation/build155-source-preflight-final.json'),
  readJson('artifacts/validation/build155-source-integrity-final.json'),
  readJson('artifacts/validation/build155-bounded-bootstrap-contract.json'),
  readJson('artifacts/validation/build155-dashboard-sql-runtime.json'),
  readJson('artifacts/validation/build155-renderer-bridge-syntax.json'),
  readJson('artifacts/validation/package-source-typecheck.json'),
  readJson('artifacts/validation/desktop-main-source-typecheck.json'),
  readJson('artifacts/validation/build154-handoff-request-creation.json'),
  readJson('artifacts/validation/build154-handoff-response-status.json')
]);

if (sourcePreflight.status !== 'PASS') throw new Error('Build 155 source preflight must be PASS.');
if (sourceIntegrity.status !== 'PASS') throw new Error('Build 155 source integrity must be PASS.');
if (bootstrapContract.status !== 'PASS' || bootstrapContract.assertions !== 33) throw new Error('Build 155 bounded bootstrap contract must be PASS 33/33.');
if (dashboardRuntime.status !== 'PASS' || dashboardRuntime.checks !== 9) throw new Error('Build 155 dashboard SQL runtime must be PASS 9/9.');
if (bridgeSyntax.status !== 'PASS' || bridgeSyntax.fileCount !== 5) throw new Error('Build 155 renderer bridge syntax must be PASS 5/5.');
if (packageSourceTypes.status !== 'PASS' || desktopMainTypes.status !== 'PASS') throw new Error('Build 155 controlled TypeScript checks must be PASS.');
if (requestCreation.status !== 'PASS' || requestCreation.verificationStatus !== 'PASS') throw new Error('Build 154 bound dependency request evidence must remain PASS.');
if (responseStatus.status !== 'WAITING' || responseStatus.classification !== 'BOUND_RESPONSE_NOT_PRESENT' || responseStatus.requestId !== requestCreation.requestId) {
  throw new Error('Bound dependency response status must remain WAITING for the same request.');
}

const results = [
  { id: 'source-preflight', status: 'PASS', evidence: 'artifacts/validation/build155-source-preflight-final.json' },
  { id: 'source-integrity', status: 'PASS', evidence: 'artifacts/validation/build155-source-integrity-final.json' },
  { id: 'clean-npm-ci', status: 'NOT_RUN', reason: 'BOUND_HANDOFF_RESPONSE_NOT_RETURNED', requestId: requestCreation.requestId, blockedEvidence: 'artifacts/validation/build154-handoff-response-status.json' },
  { id: 'tsc-no-emit', status: 'NOT_RUN', blockedBy: 'clean-npm-ci' },
  { id: 'unit-tests', status: 'NOT_RUN', blockedBy: 'clean-npm-ci' },
  { id: 'electron-production-build', status: 'NOT_RUN', blockedBy: 'clean-npm-ci' },
  { id: 'smoke-tests', status: 'NOT_RUN', blockedBy: 'clean-npm-ci' },
  { id: 'windows-runtime', status: 'NOT_RUN', reason: `Platform ${process.platform} is not Windows and the bound dependency response has not returned.` }
];
const counts = Object.fromEntries(['PASS', 'FAIL', 'NOT_RUN'].map((status) => [status, results.filter((item) => item.status === status).length]));
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: '29.07.2026.155',
  packageVersion: '29.7.2026-155',
  build: 155,
  stage: 'Bronze RC2 Active Development',
  overallStatus: 'INCOMPLETE',
  requestId: requestCreation.requestId,
  requestArchivePath: requestCreation.archivePath,
  expectedResponseFileName: responseStatus.expectedResponseFileName,
  counts,
  results,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 155 validation boundary: ${report.overallStatus} — ${counts.PASS} PASS / ${counts.FAIL} FAIL / ${counts.NOT_RUN} NOT_RUN.`);
