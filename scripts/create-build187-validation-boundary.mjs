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
const reportPath = resolve(option('--report', 'artifacts/validation/build187-validation-boundary.json'));
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const [preflight, integrity, contract, runtime, sqliteRuntime, syntax, packageTypes, desktopTypes, request, response] = await Promise.all([
  readJson('artifacts/validation/build187-source-preflight-final.json'),
  readJson('artifacts/validation/build187-source-integrity-final.json'),
  readJson('artifacts/validation/build187-clean-rewrite-recovery-chronology-contract.json'),
  readJson('artifacts/validation/build187-clean-rewrite-recovery-chronology-runtime.json'),
  readJson('artifacts/validation/build187-clean-rewrite-recovery-chronology-sqlite-runtime.json'),
  readJson('artifacts/validation/build187-clean-rewrite-recovery-chronology-syntax.json'),
  readJson('artifacts/validation/package-source-typecheck.json'),
  readJson('artifacts/validation/desktop-main-source-typecheck.json'),
  readJson('artifacts/validation/build154-handoff-request-creation.json'),
  readJson('artifacts/validation/build154-handoff-response-status.json')
]);

if (preflight.status !== 'PASS' || preflight.configuredCheckCount !== 181 || preflight.executedCheckCount !== 181 || preflight.passedCheckCount !== 181 || preflight.failedCheckCount !== 0 || preflight.notRunCheckCount !== 0) {
  throw new Error('Build 187 source preflight must be PASS 181/181.');
}
if (integrity.status !== 'PASS') throw new Error('Build 187 source integrity must be PASS.');
if (contract.status !== 'PASS' || contract.assertions !== 85 || contract.failures?.length !== 0) throw new Error('Build 187 contract must be PASS 85/85.');
if (runtime.status !== 'PASS' || runtime.checks !== 20) throw new Error('Build 187 runtime must be PASS 20/20.');
if (sqliteRuntime.status !== 'PASS' || sqliteRuntime.checks !== 22) throw new Error('Build 187 SQLite runtime must be PASS 22/22.');
if (syntax.status !== 'PASS' || syntax.checks !== 3) throw new Error('Build 187 syntax must be PASS 3/3.');
if (packageTypes.status !== 'PASS' || desktopTypes.status !== 'PASS') throw new Error('Controlled TypeScript must pass.');
if (request.status !== 'PASS' || response.status !== 'WAITING' || response.requestId !== request.requestId) throw new Error('Bound dependency handoff state mismatch.');

const results = [
  { id: 'source-preflight', status: 'PASS', evidence: 'artifacts/validation/build187-source-preflight-final.json' },
  { id: 'source-integrity', status: 'PASS', evidence: 'artifacts/validation/build187-source-integrity-final.json' },
  { id: 'clean-npm-ci', status: 'NOT_RUN', reason: 'RESERVED_FOR_SILVER_VALIDATION', requestId: request.requestId },
  { id: 'tsc-no-emit', status: 'NOT_RUN', reason: 'RESERVED_FOR_SILVER_VALIDATION' },
  { id: 'unit-tests', status: 'NOT_RUN', reason: 'RESERVED_FOR_SILVER_VALIDATION' },
  { id: 'electron-production-build', status: 'NOT_RUN', reason: 'RESERVED_FOR_SILVER_VALIDATION' },
  { id: 'smoke-tests', status: 'NOT_RUN', reason: 'RESERVED_FOR_SILVER_VALIDATION' },
  { id: 'windows-runtime', status: 'NOT_RUN', reason: `RESERVED_FOR_SILVER_VALIDATION_ON_WINDOWS; current platform=${process.platform}` }
];
const counts = Object.fromEntries(['PASS', 'FAIL', 'NOT_RUN'].map((status) => [status, results.filter((item) => item.status === status).length]));
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: '30.07.2026.187',
  packageVersion: '30.7.2026-187',
  build: 187,
  stage: 'Bronze RC2 Active Development',
  policyId: 'PPT-LIFECYCLE-STRICT-V1',
  overallStatus: 'INCOMPLETE',
  interpretation: 'Bronze product-development source validation passed; Silver is reserved for infrastructure improvement and the full test campaign.',
  requestId: request.requestId,
  counts,
  results,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 187 validation boundary: ${report.overallStatus} — ${counts.PASS} PASS / ${counts.FAIL} FAIL / ${counts.NOT_RUN} NOT_RUN.`);
