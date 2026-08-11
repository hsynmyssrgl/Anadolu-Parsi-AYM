import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const reportPath = resolve(option('--report', 'artifacts/validation/build151-validation-boundary.json'));
const logRoot = resolve(option('--log-root', 'artifacts/validation/build151-logs'));
const read = (path) => readFile(path, 'utf8');
const exists = async (path) => { try { await stat(path); return true; } catch { return false; } };
const requiredLog = async (name, markers) => {
  const path = resolve(logRoot, name);
  if (!await exists(path)) throw new Error(`Required Build 151 gate log is missing: ${path}`);
  const content = await read(path);
  for (const marker of markers) if (!content.includes(marker)) throw new Error(`Gate log ${name} is missing evidence marker: ${marker}`);
  return { path, content };
};
const sourcePreflight = JSON.parse(await read('artifacts/validation/build151-source-preflight-final.json'));
const sourceIntegrity = JSON.parse(await read('artifacts/validation/build151-source-integrity-final.json'));
const cleanEvidence = JSON.parse(await read('artifacts/validation/build151-clean-npm-ci-final.json'));
const acquisition = JSON.parse(await read('artifacts/validation/build151-npm-dependency-acquisition-attempt.json'));
if (cleanEvidence.status !== 'FAIL' || cleanEvidence.classification !== 'EXTERNAL_DEPENDENCY_SERVICE_UNAVAILABLE') {
  throw new Error('Build 151 clean install evidence must preserve the external dependency service failure.');
}
if (acquisition.status !== 'FAIL' || acquisition.classification !== 'EAI_AGAIN') {
  throw new Error('Build 151 acquisition evidence must preserve EAI_AGAIN.');
}
const typecheck = await requiredLog('root-typecheck.log', ['error TS2688', "Cannot find type definition file for 'node'", "Cannot find type definition file for 'vite/client'"]);
const tests = await requiredLog('all-tests.log', ['vitest: not found']);
const production = await requiredLog('electron-production-build.log', ['@ppt/core', "Cannot find type definition file for 'node'"]);
const smoke = await requiredLog('blocking-smoke.log', ['verify:dispatcher', "Cannot find type definition file for 'node'"]);
const results = [
  { id: 'source-preflight', status: sourcePreflight.status, command: 'node scripts/run-source-preflight.mjs', evidence: 'artifacts/validation/build151-source-preflight-final.json' },
  { id: 'source-integrity', status: sourceIntegrity.status, command: 'node scripts/verify-source-integrity.mjs', evidence: 'artifacts/validation/build151-source-integrity-final.json' },
  { id: 'clean-npm-ci', status: 'FAIL', command: 'node scripts/run-clean-npm-ci.mjs', reason: cleanEvidence.classification, evidence: 'artifacts/validation/build151-clean-npm-ci-final.json' },
  { id: 'tsc-no-emit', status: 'FAIL', command: 'npm run typecheck', reason: 'DEPENDENCY_BOOTSTRAP_UNAVAILABLE', evidence: typecheck.path },
  { id: 'unit-tests', status: 'FAIL', command: 'npm run test', reason: 'DEPENDENCY_BOOTSTRAP_UNAVAILABLE', evidence: tests.path },
  { id: 'electron-production-build', status: 'FAIL', command: 'npm run build', reason: 'DEPENDENCY_BOOTSTRAP_UNAVAILABLE', evidence: production.path },
  { id: 'smoke-tests', status: 'FAIL', command: 'npm run verify:bronze', reason: 'DEPENDENCY_BOOTSTRAP_UNAVAILABLE', evidence: smoke.path },
  { id: 'windows-runtime', status: 'NOT_RUN', reason: `Platform ${process.platform} is not Windows.` }
];
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: '29.07.2026.151',
  packageVersion: '29.7.2026-151',
  build: 151,
  stage: 'Bronze RC2 Active Development',
  platform: process.platform,
  nodeVersion: process.version,
  dependencyAcquisition: {
    plan: 'PASS',
    requiredTarballCount: 117,
    realAttemptStatus: acquisition.status,
    realAttemptClassification: acquisition.classification
  },
  overallStatus: results.every((result) => result.status === 'PASS') ? 'PASS' : 'INCOMPLETE',
  results,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 151 validation boundary: ${report.overallStatus} — ${results.filter((result) => result.status === 'PASS').length} PASS / ${results.filter((result) => result.status === 'FAIL').length} FAIL / ${results.filter((result) => result.status === 'NOT_RUN').length} NOT_RUN`);
