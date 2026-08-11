import { mkdir, readFile, writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const option = (name, fallback = 'NOT_RUN') => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!['PASS', 'FAIL', 'NOT_RUN'].includes(value)) throw new Error(`${name} must be PASS, FAIL, or NOT_RUN.`);
  return value;
};
const evidenceStatus = async (path, field = 'status') => {
  try {
    return JSON.parse(await readFile(path, 'utf8'))[field] === 'PASS' ? 'PASS' : 'FAIL';
  } catch {
    return 'NOT_RUN';
  }
};

const results = [
  { id: 'source-preflight', status: await evidenceStatus('artifacts/validation/source-preflight.json') },
  { id: 'source-integrity', status: await evidenceStatus('artifacts/validation/build227-source-integrity.json') },
  { id: 'clean-npm-ci', status: option('--clean-npm-ci') },
  { id: 'full-root-tsc-no-emit', status: option('--full-root-tsc-no-emit') },
  { id: 'full-unit-integration-suite', status: option('--full-unit-integration-suite') },
  { id: 'electron-production-build', status: option('--electron-production-build') },
  { id: 'blocking-smoke', status: option('--blocking-smoke') },
  { id: 'unified-real-windows-execution', status: await evidenceStatus('artifacts/validation/build227-bronze-security-windows-closure-result.json') }
];
const passCount = results.filter((item) => item.status === 'PASS').length;
const failCount = results.filter((item) => item.status === 'FAIL').length;
const notRunCount = results.filter((item) => item.status === 'NOT_RUN').length;
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: '02.08.2026.227',
  packageVersion: '2.8.2026-227',
  build: 227,
  stage: 'Bronze RC2 Active Development',
  overallStatus: passCount === results.length ? 'PASS' : failCount > 0 ? 'FAIL' : 'INCOMPLETE',
  passCount,
  failCount,
  notRunCount,
  results,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build227-validation-boundary.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build227 validation boundary: ${report.overallStatus} — PASS ${passCount} / FAIL ${failCount} / NOT_RUN ${notRunCount}`);
if (report.overallStatus !== 'PASS') process.exitCode = 1;
