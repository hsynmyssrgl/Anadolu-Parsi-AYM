import { mkdir, readFile, writeFile } from 'node:fs/promises';

const evidenceStatus = async (path) => {
  try {
    return JSON.parse(await readFile(path, 'utf8')).status === 'PASS' ? 'PASS' : 'FAIL';
  } catch {
    return 'NOT_RUN';
  }
};

const results = [
  { id: 'source-preflight', status: await evidenceStatus('artifacts/validation/source-preflight.json') },
  { id: 'source-integrity', status: await evidenceStatus('artifacts/validation/build226-source-integrity.json') },
  { id: 'clean-npm-ci', status: 'PASS', details: 'npm ci completed with Node 24.18.0 and npm 10.9.2 in the clean Build226 development tree.' },
  { id: 'full-root-tsc-no-emit', status: 'NOT_RUN' },
  { id: 'full-unit-integration-suite', status: 'NOT_RUN' },
  { id: 'electron-production-build', status: 'NOT_RUN' },
  { id: 'blocking-smoke', status: 'NOT_RUN' },
  { id: 'unified-real-windows-execution', status: 'NOT_RUN' }
];
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: '02.08.2026.226',
  packageVersion: '2.8.2026-226',
  build: 226,
  stage: 'Bronze RC2 Active Development',
  overallStatus: 'INCOMPLETE',
  passCount: results.filter((item) => item.status === 'PASS').length,
  failCount: results.filter((item) => item.status === 'FAIL').length,
  notRunCount: results.filter((item) => item.status === 'NOT_RUN').length,
  results,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build226-validation-boundary.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build226 validation boundary: ${report.overallStatus} — PASS ${report.passCount} / FAIL ${report.failCount} / NOT_RUN ${report.notRunCount}`);
