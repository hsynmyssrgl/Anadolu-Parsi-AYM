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
const reportPath = resolve(option('--report', 'artifacts/validation/build153-validation-boundary.json'));
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sourcePreflight = await readJson('artifacts/validation/build153-source-preflight-final.json');
const sourceIntegrity = await readJson('artifacts/validation/build153-source-integrity-final.json');
const orchestrationContract = await readJson('artifacts/validation/build153-accepted-cache-validation-contract.json');
const orchestrationBlock = await readJson('artifacts/validation/build153-accepted-cache-rc2-validation.json');
if (sourcePreflight.status !== 'PASS') throw new Error('Build 153 source preflight must be PASS.');
if (sourceIntegrity.status !== 'PASS') throw new Error('Build 153 source integrity must be PASS.');
if (orchestrationContract.status !== 'PASS' || orchestrationContract.assertions !== 20) throw new Error('Build 153 accepted-cache orchestration contract must be PASS 20/20.');
if (orchestrationBlock.status !== 'FAIL' || orchestrationBlock.gatesStarted !== false || orchestrationBlock.classification !== 'ACCEPTANCE_POINTER_MISSING') {
  throw new Error('Build 153 real orchestration evidence must fail closed before gates because no accepted 117-tarball bundle is present.');
}
const results = [
  { id: 'source-preflight', status: 'PASS', evidence: 'artifacts/validation/build153-source-preflight-final.json' },
  { id: 'source-integrity', status: 'PASS', evidence: 'artifacts/validation/build153-source-integrity-final.json' },
  { id: 'clean-npm-ci', status: 'NOT_RUN', reason: 'VERIFIED_ACCEPTED_117_TARBALL_BUNDLE_NOT_PRESENT', blockedEvidence: 'artifacts/validation/build153-accepted-cache-rc2-validation.json' },
  { id: 'tsc-no-emit', status: 'NOT_RUN', blockedBy: 'clean-npm-ci' },
  { id: 'unit-tests', status: 'NOT_RUN', blockedBy: 'clean-npm-ci' },
  { id: 'electron-production-build', status: 'NOT_RUN', blockedBy: 'clean-npm-ci' },
  { id: 'smoke-tests', status: 'NOT_RUN', blockedBy: 'clean-npm-ci' },
  { id: 'windows-runtime', status: 'NOT_RUN', reason: `Platform ${process.platform} is not Windows and dependency gates are incomplete.` }
];
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: '29.07.2026.153',
  packageVersion: '29.7.2026-153',
  build: 153,
  stage: 'Bronze RC2 Active Development',
  platform: process.platform,
  nodeVersion: process.version,
  acceptedCacheOrchestrationContract: { status: orchestrationContract.status, assertions: orchestrationContract.assertions },
  realAcceptedCacheState: { status: orchestrationBlock.status, classification: orchestrationBlock.classification, gatesStarted: orchestrationBlock.gatesStarted },
  overallStatus: results.every((result) => result.status === 'PASS') ? 'PASS' : 'INCOMPLETE',
  results,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 153 validation boundary: ${report.overallStatus} — ${results.filter((x) => x.status === 'PASS').length} PASS / ${results.filter((x) => x.status === 'FAIL').length} FAIL / ${results.filter((x) => x.status === 'NOT_RUN').length} NOT_RUN`);
