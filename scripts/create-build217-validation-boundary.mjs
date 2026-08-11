import { mkdir, readFile, writeFile } from 'node:fs/promises';

const reportPath = process.argv[2] ?? 'artifacts/validation/build217-validation-boundary.json';
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const [contract, runtime, packageTypes, desktopTypes] = await Promise.all([
  readJson('artifacts/validation/build217-open021-isolation-contract.json'),
  readJson('artifacts/validation/build217-open021-result-runtime.json'),
  readJson('artifacts/validation/package-source-typecheck.json'),
  readJson('artifacts/validation/desktop-main-source-typecheck.json')
]);

const results = [
  { id: 'open021-isolation-contract', status: contract.status, evidence: 'artifacts/validation/build217-open021-isolation-contract.json' },
  { id: 'open021-result-runtime', status: runtime.status, evidence: 'artifacts/validation/build217-open021-result-runtime.json' },
  { id: 'package-source-typecheck', status: packageTypes.status, evidence: 'artifacts/validation/package-source-typecheck.json' },
  { id: 'desktop-main-source-typecheck', status: desktopTypes.status, evidence: 'artifacts/validation/desktop-main-source-typecheck.json' },
  { id: 'open021-real-windows-execution', status: 'NOT_RUN', reason: `Requires real Windows; current platform=${process.platform}` },
  { id: 'open021-real-windows-evidence-intake', status: 'NOT_RUN', reason: 'No exact-source-bound Build217 Windows evidence bundle has returned.' },
  { id: 'open021-closure', status: 'IN_PROGRESS', reason: 'Cannot close before real Windows PASS evidence is governed into the master ledger.' },
  { id: 'open022-closure', status: 'IN_PROGRESS', reason: 'Build217 explicitly leaves OPEN-022 unchanged.' },
  { id: 'clean-npm-ci', status: 'NOT_RUN', reason: 'Reserved for execution environment / Silver validation; Build217 source preparation does not claim PASS.' },
  { id: 'full-root-tsc-no-emit', status: 'NOT_RUN', reason: 'Controlled source typechecks PASS; full dependency-backed root gate not run.' },
  { id: 'full-unit-integration-suite', status: 'NOT_RUN', reason: 'Not run in this environment.' },
  { id: 'electron-production-build', status: 'NOT_RUN', reason: 'Real Windows runner will build installer; not run here.' },
  { id: 'blocking-smoke', status: 'NOT_RUN', reason: 'Not run in this environment.' }
];
const counts = Object.fromEntries(['PASS','FAIL','NOT_RUN','IN_PROGRESS'].map((status) => [
  status, results.filter((item) => item.status === status).length
]));
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: '01.08.2026.217',
  packageVersion: '1.8.2026-217',
  build: 217,
  stage: 'Bronze RC2 Active Development',
  overallStatus: 'INCOMPLETE',
  interpretation: 'Build217 OPEN-021 close-runner source preparation is validated; OPEN-021 remains IN_PROGRESS until real Windows PASS evidence returns.',
  counts,
  results,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build217 validation boundary: ${report.overallStatus} — ${counts.PASS} PASS / ${counts.NOT_RUN} NOT_RUN / ${counts.IN_PROGRESS} IN_PROGRESS.`);
