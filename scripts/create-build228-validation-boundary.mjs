import { mkdir, readFile, writeFile } from 'node:fs/promises';

const evidenceStatus = async (path, field = 'status') => {
  try { return JSON.parse(await readFile(path, 'utf8'))[field] ?? 'NOT_RUN'; }
  catch { return 'NOT_RUN'; }
};

const results = [
  { id: 'source-preflight', status: await evidenceStatus('artifacts/validation/source-preflight.json'), evidenceBuild: 228 },
  { id: 'source-integrity', status: await evidenceStatus('artifacts/validation/build228-source-integrity.json'), evidenceBuild: 228 },
  { id: 'clean-npm-ci', status: 'PASS', evidenceBuild: 227, carriedForward: true },
  { id: 'full-root-tsc-no-emit', status: 'FAIL', evidenceBuild: 227, carriedForward: true },
  { id: 'full-unit-integration-suite', status: 'FAIL', evidenceBuild: 227, carriedForward: true },
  { id: 'electron-production-build', status: 'PASS', evidenceBuild: 227, carriedForward: true },
  { id: 'blocking-smoke', status: 'FAIL', evidenceBuild: 227, carriedForward: true },
  { id: 'unified-real-windows-execution', status: await evidenceStatus('artifacts/validation/build228-open021-open022-closure-validation.json'), evidenceBuild: 227, carriedForward: true }
];
const passCount = results.filter((item) => item.status === 'PASS').length;
const failCount = results.filter((item) => item.status === 'FAIL').length;
const notRunCount = results.filter((item) => item.status === 'NOT_RUN').length;
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: '02.08.2026.228',
  packageVersion: '2.8.2026-228',
  build: 228,
  stage: 'Bronze RC2 Active Development',
  purpose: 'Governance-only closure boundary; Build227 Silver failures are preserved without rerun or promotion',
  overallStatus: failCount > 0 ? 'FAIL' : notRunCount > 0 ? 'INCOMPLETE' : 'PASS',
  passCount,
  failCount,
  notRunCount,
  results,
  nextOfficialWork: 'OPEN-002',
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build228-validation-boundary.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build228 validation boundary: ${report.overallStatus} — PASS ${passCount} / FAIL ${failCount} / NOT_RUN ${notRunCount}`);
if (report.overallStatus === 'INCOMPLETE') process.exitCode = 1;
