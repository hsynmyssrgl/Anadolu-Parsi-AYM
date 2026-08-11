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
const reportPath = resolve(option('--report', 'artifacts/validation/build177-validation-boundary.json'));
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const [sourcePreflight, sourceIntegrity, contract, runtime, syntax, build176Contract, build176Runtime, build176Syntax, packageSourceTypes, desktopMainTypes, requestCreation, responseStatus] = await Promise.all([
  readJson('artifacts/validation/build177-source-preflight-final.json'),
  readJson('artifacts/validation/build177-source-integrity-final.json'),
  readJson('artifacts/validation/build177-security-center-menu-contract.json'),
  readJson('artifacts/validation/build177-security-center-menu-runtime.json'),
  readJson('artifacts/validation/build177-security-center-menu-syntax.json'),
  readJson('artifacts/validation/build177-build176-device-reauthorization-contract-continuity.json'),
  readJson('artifacts/validation/build177-build176-device-reauthorization-runtime-continuity.json'),
  readJson('artifacts/validation/build177-build176-device-reauthorization-syntax-continuity.json'),
  readJson('artifacts/validation/package-source-typecheck.json'),
  readJson('artifacts/validation/desktop-main-source-typecheck.json'),
  readJson('artifacts/validation/build154-handoff-request-creation.json'),
  readJson('artifacts/validation/build154-handoff-response-status.json')
]);
if (sourcePreflight.status !== 'PASS' || sourcePreflight.results?.length !== 147) throw new Error('Build 177 source preflight must be PASS 147/147.');
if (sourceIntegrity.status !== 'PASS') throw new Error('Build 177 source integrity must be PASS.');
if (contract.status !== 'PASS' || contract.checks !== 31) throw new Error('Build 177 contract must be PASS 31/31.');
if (runtime.status !== 'PASS' || runtime.checks !== 13) throw new Error('Build 177 runtime must be PASS 13/13.');
if (syntax.status !== 'PASS' || syntax.checks !== 10) throw new Error('Build 177 syntax must be PASS 10/10.');
if (build176Contract.status !== 'PASS' || build176Contract.checks !== 52) throw new Error('Build 176 contract continuity must be PASS 52/52.');
if (build176Runtime.status !== 'PASS' || build176Runtime.checks !== 23) throw new Error('Build 176 runtime continuity must be PASS 23/23.');
if (build176Syntax.status !== 'PASS' || build176Syntax.checks !== 14) throw new Error('Build 176 syntax continuity must be PASS 14/14.');
if (packageSourceTypes.status !== 'PASS' || desktopMainTypes.status !== 'PASS') throw new Error('Controlled TypeScript checks must be PASS.');
if (requestCreation.status !== 'PASS' || requestCreation.verificationStatus !== 'PASS') throw new Error('Dependency handoff request must remain verified.');
if (responseStatus.status !== 'WAITING' || responseStatus.classification !== 'BOUND_RESPONSE_NOT_PRESENT' || responseStatus.requestId !== requestCreation.requestId) throw new Error('Bound dependency response must remain WAITING for the same request.');
const results = [
  { id: 'source-preflight', status: 'PASS', evidence: 'artifacts/validation/build177-source-preflight-final.json' },
  { id: 'source-integrity', status: 'PASS', evidence: 'artifacts/validation/build177-source-integrity-final.json' },
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
  applicationVersion: '30.07.2026.177',
  packageVersion: '30.7.2026-177',
  build: 177,
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
console.log(`Build 177 validation boundary: ${report.overallStatus} — ${counts.PASS} PASS / ${counts.FAIL} FAIL / ${counts.NOT_RUN} NOT_RUN.`);
