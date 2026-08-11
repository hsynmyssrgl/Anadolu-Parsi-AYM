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
const reportPath = resolve(option('--report', 'artifacts/validation/build175-validation-boundary.json'));
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const [sourcePreflight, sourceIntegrity, contract, runtime, syntax, build174Contract, build174Runtime, packageSourceTypes, desktopMainTypes, requestCreation, responseStatus] = await Promise.all([
  readJson('artifacts/validation/build175-source-preflight-final.json'),
  readJson('artifacts/validation/build175-source-integrity-final.json'),
  readJson('artifacts/validation/build175-maintenance-recovery-security-epoch-contract.json'),
  readJson('artifacts/validation/build175-maintenance-recovery-security-epoch-runtime.json'),
  readJson('artifacts/validation/build175-maintenance-recovery-security-epoch-syntax.json'),
  readJson('artifacts/validation/build174-contract.json'),
  readJson('artifacts/validation/build174-runtime.json'),
  readJson('artifacts/validation/package-source-typecheck.json'),
  readJson('artifacts/validation/desktop-main-source-typecheck.json'),
  readJson('artifacts/validation/build154-handoff-request-creation.json'),
  readJson('artifacts/validation/build154-handoff-response-status.json')
]);
if (sourcePreflight.status !== 'PASS' || sourcePreflight.results?.length !== 141) throw new Error('Build 175 source preflight must be PASS 141/141.');
if (sourceIntegrity.status !== 'PASS') throw new Error('Build 175 source integrity must be PASS.');
if (contract.status !== 'PASS' || contract.assertions !== 50) throw new Error('Build 175 contract must be PASS 50/50.');
if (runtime.status !== 'PASS' || runtime.checks !== 15) throw new Error('Build 175 runtime must be PASS 15/15.');
if (syntax.status !== 'PASS' || syntax.checks !== 12) throw new Error('Build 175 syntax must be PASS 12/12.');
if (build174Contract.status !== 'PASS' || build174Contract.checks !== 10) throw new Error('Build 174 contract continuity must be PASS 10/10.');
if (build174Runtime.status !== 'PASS' || build174Runtime.checks !== 6) throw new Error('Build 174 runtime continuity must be PASS 6/6.');
if (packageSourceTypes.status !== 'PASS' || desktopMainTypes.status !== 'PASS') throw new Error('Controlled TypeScript checks must be PASS.');
if (requestCreation.status !== 'PASS' || requestCreation.verificationStatus !== 'PASS') throw new Error('Dependency handoff request must remain verified.');
if (responseStatus.status !== 'WAITING' || responseStatus.classification !== 'BOUND_RESPONSE_NOT_PRESENT' || responseStatus.requestId !== requestCreation.requestId) throw new Error('Bound dependency response must remain WAITING for the same request.');
const results = [
  { id: 'source-preflight', status: 'PASS', evidence: 'artifacts/validation/build175-source-preflight-final.json' },
  { id: 'source-integrity', status: 'PASS', evidence: 'artifacts/validation/build175-source-integrity-final.json' },
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
  applicationVersion: '29.07.2026.175',
  packageVersion: '29.7.2026-175',
  build: 175,
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
console.log(`Build 175 validation boundary: ${report.overallStatus} — ${counts.PASS} PASS / ${counts.FAIL} FAIL / ${counts.NOT_RUN} NOT_RUN.`);
