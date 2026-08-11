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
const reportPath = resolve(option('--report', 'artifacts/validation/build176-validation-boundary.json'));
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const [sourcePreflight, sourceIntegrity, contract, runtime, syntax, build175Contract, build175Runtime, build175Syntax, packageSourceTypes, desktopMainTypes, requestCreation, responseStatus] = await Promise.all([
  readJson('artifacts/validation/build176-source-preflight-final.json'),
  readJson('artifacts/validation/build176-source-integrity-final.json'),
  readJson('artifacts/validation/build176-device-reauthorization-contract.json'),
  readJson('artifacts/validation/build176-device-reauthorization-runtime.json'),
  readJson('artifacts/validation/build176-device-reauthorization-syntax.json'),
  readJson('artifacts/validation/build176-build175-security-epoch-continuity.json'),
  readJson('artifacts/validation/build176-build175-security-epoch-runtime-continuity.json'),
  readJson('artifacts/validation/build176-build175-security-epoch-syntax-continuity.json'),
  readJson('artifacts/validation/package-source-typecheck.json'),
  readJson('artifacts/validation/desktop-main-source-typecheck.json'),
  readJson('artifacts/validation/build154-handoff-request-creation.json'),
  readJson('artifacts/validation/build154-handoff-response-status.json')
]);
if (sourcePreflight.status !== 'PASS' || sourcePreflight.results?.length !== 144) throw new Error('Build 176 source preflight must be PASS 144/144.');
if (sourceIntegrity.status !== 'PASS') throw new Error('Build 176 source integrity must be PASS.');
if (contract.status !== 'PASS' || contract.checks !== 52) throw new Error('Build 176 contract must be PASS 52/52.');
if (runtime.status !== 'PASS' || runtime.checks !== 23) throw new Error('Build 176 runtime must be PASS 23/23.');
if (syntax.status !== 'PASS' || syntax.checks !== 14) throw new Error('Build 176 syntax must be PASS 14/14.');
if (build175Contract.status !== 'PASS' || build175Contract.assertions !== 50) throw new Error('Build 175 contract continuity must be PASS 50/50.');
if (build175Runtime.status !== 'PASS' || build175Runtime.checks !== 15) throw new Error('Build 175 runtime continuity must be PASS 15/15.');
if (build175Syntax.status !== 'PASS' || build175Syntax.checks !== 12) throw new Error('Build 175 syntax continuity must be PASS 12/12.');
if (packageSourceTypes.status !== 'PASS' || desktopMainTypes.status !== 'PASS') throw new Error('Controlled TypeScript checks must be PASS.');
if (requestCreation.status !== 'PASS' || requestCreation.verificationStatus !== 'PASS') throw new Error('Dependency handoff request must remain verified.');
if (responseStatus.status !== 'WAITING' || responseStatus.classification !== 'BOUND_RESPONSE_NOT_PRESENT' || responseStatus.requestId !== requestCreation.requestId) throw new Error('Bound dependency response must remain WAITING for the same request.');
const results = [
  { id: 'source-preflight', status: 'PASS', evidence: 'artifacts/validation/build176-source-preflight-final.json' },
  { id: 'source-integrity', status: 'PASS', evidence: 'artifacts/validation/build176-source-integrity-final.json' },
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
  applicationVersion: '30.07.2026.176',
  packageVersion: '30.7.2026-176',
  build: 176,
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
console.log(`Build 176 validation boundary: ${report.overallStatus} — ${counts.PASS} PASS / ${counts.FAIL} FAIL / ${counts.NOT_RUN} NOT_RUN.`);
