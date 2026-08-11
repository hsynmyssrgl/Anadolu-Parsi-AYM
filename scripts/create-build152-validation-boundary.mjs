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
const reportPath = resolve(option('--report', 'artifacts/validation/build152-validation-boundary.json'));
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sourcePreflight = await readJson('artifacts/validation/build152-source-preflight-final.json');
const sourceIntegrity = await readJson('artifacts/validation/build152-source-integrity-final.json');
const acceptance = await readJson('artifacts/validation/build152-cache-bundle-acceptance.json');
if (sourcePreflight.status !== 'PASS') throw new Error('Build 152 source preflight must be PASS.');
if (sourceIntegrity.status !== 'PASS') throw new Error('Build 152 source integrity must be PASS.');
if (acceptance.status !== 'PASS' || acceptance.assertions !== 26) throw new Error('Build 152 acceptance contract must be PASS 26/26.');
const results = [
  { id: 'source-preflight', status: 'PASS', evidence: 'artifacts/validation/build152-source-preflight-final.json' },
  { id: 'source-integrity', status: 'PASS', evidence: 'artifacts/validation/build152-source-integrity-final.json' },
  { id: 'clean-npm-ci', status: 'NOT_RUN', reason: 'REAL_117_TARBALL_BUNDLE_NOT_PROVIDED' },
  { id: 'tsc-no-emit', status: 'NOT_RUN' },
  { id: 'unit-tests', status: 'NOT_RUN' },
  { id: 'electron-production-build', status: 'NOT_RUN' },
  { id: 'smoke-tests', status: 'NOT_RUN' },
  { id: 'windows-runtime', status: 'NOT_RUN', reason: `Platform ${process.platform} is not Windows.` }
];
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: '29.07.2026.152',
  packageVersion: '29.7.2026-152',
  build: 152,
  stage: 'Bronze RC2 Active Development',
  platform: process.platform,
  nodeVersion: process.version,
  acceptanceContract: { status: acceptance.status, assertions: acceptance.assertions },
  overallStatus: results.every((result) => result.status === 'PASS') ? 'PASS' : 'INCOMPLETE',
  results,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 152 validation boundary: ${report.overallStatus} — ${results.filter((x) => x.status === 'PASS').length} PASS / ${results.filter((x) => x.status === 'FAIL').length} FAIL / ${results.filter((x) => x.status === 'NOT_RUN').length} NOT_RUN`);
