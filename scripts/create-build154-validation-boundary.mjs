import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; const v = args[i + 1]; if (!v || v.startsWith('--')) throw new Error(`${name} requires a value.`); return v; };
const reportPath = resolve(option('--report', 'artifacts/validation/build154-validation-boundary.json'));
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const [sourcePreflight, sourceIntegrity, featureContract, requestCreation, requestVerification, responseStatus] = await Promise.all([
  readJson('artifacts/validation/build154-source-preflight-final.json'),
  readJson('artifacts/validation/build154-source-integrity-final.json'),
  readJson('artifacts/validation/build154-dependency-handoff-contract.json'),
  readJson('artifacts/validation/build154-handoff-request-creation.json'),
  readJson('artifacts/validation/build154-handoff-request-verification.json'),
  readJson('artifacts/validation/build154-handoff-response-status.json')
]);
if (sourcePreflight.status !== 'PASS') throw new Error('Build 154 source preflight must be PASS.');
if (sourceIntegrity.status !== 'PASS') throw new Error('Build 154 source integrity must be PASS.');
if (featureContract.status !== 'PASS' || featureContract.assertions !== 28) throw new Error('Build 154 dependency handoff contract must be PASS 28/28.');
if (requestCreation.status !== 'PASS' || requestCreation.verificationStatus !== 'PASS') throw new Error('Build 154 handoff request creation must be PASS.');
if (requestVerification.status !== 'PASS' || requestVerification.requestId !== requestCreation.requestId) throw new Error('Build 154 handoff request verification must match request creation.');
if (responseStatus.status !== 'WAITING' || responseStatus.classification !== 'BOUND_RESPONSE_NOT_PRESENT' || responseStatus.requestId !== requestCreation.requestId) throw new Error('Build 154 response status must be WAITING for the bound response.');
const results = [
  { id: 'source-preflight', status: 'PASS', evidence: 'artifacts/validation/build154-source-preflight-final.json' },
  { id: 'source-integrity', status: 'PASS', evidence: 'artifacts/validation/build154-source-integrity-final.json' },
  { id: 'clean-npm-ci', status: 'NOT_RUN', reason: 'BOUND_HANDOFF_RESPONSE_NOT_RETURNED', requestId: requestCreation.requestId, blockedEvidence: 'artifacts/validation/build154-handoff-response-status.json' },
  { id: 'tsc-no-emit', status: 'NOT_RUN', blockedBy: 'clean-npm-ci' },
  { id: 'unit-tests', status: 'NOT_RUN', blockedBy: 'clean-npm-ci' },
  { id: 'electron-production-build', status: 'NOT_RUN', blockedBy: 'clean-npm-ci' },
  { id: 'smoke-tests', status: 'NOT_RUN', blockedBy: 'clean-npm-ci' },
  { id: 'windows-runtime', status: 'NOT_RUN', reason: `Platform ${process.platform} is not Windows and the bound response has not returned.` }
];
const counts = Object.fromEntries(['PASS', 'FAIL', 'NOT_RUN'].map((status) => [status, results.filter((item) => item.status === status).length]));
const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', applicationVersion: '29.07.2026.154', packageVersion: '29.7.2026-154', build: 154, stage: 'Bronze RC2 Active Development', overallStatus: 'INCOMPLETE', requestId: requestCreation.requestId, requestArchivePath: requestCreation.archivePath, expectedResponseFileName: responseStatus.expectedResponseFileName, counts, results, generatedAt: new Date().toISOString() };
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 154 validation boundary: ${report.overallStatus} — ${counts.PASS} PASS / ${counts.FAIL} FAIL / ${counts.NOT_RUN} NOT_RUN.`);
