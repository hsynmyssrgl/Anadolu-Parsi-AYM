import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { verifyWindowsEvidenceIntake } from './lib/windows-evidence-intake.mjs';

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const root = process.cwd();
const evidenceRoot = resolve(value('--evidence-root', 'artifacts/validation/windows-evidence-intake'));
const manifestPath = resolve(evidenceRoot, value('--manifest', 'build216-windows-evidence-manifest.json'));
const reportPath = resolve(value('--report', 'artifacts/validation/build216-windows-evidence-intake.json'));
const appMeta = await readFile(resolve(root, 'packages/domain/src/app-meta.ts'), 'utf8');
const applicationVersion = appMeta.match(/version: '([^']+)'/)?.[1];
const packageVersion = appMeta.match(/packageVersion: '([^']+)'/)?.[1];
if (applicationVersion !== '01.08.2026.216' || packageVersion !== '1.8.2026-216') {
  throw new Error(`Build216 intake verifier requires 01.08.2026.216 / 1.8.2026-216; actual=${applicationVersion} / ${packageVersion}`);
}

let report;
try {
  report = await verifyWindowsEvidenceIntake({
    evidenceRoot,
    manifestPath,
    expectedBuild: 216,
    expectedApplicationVersion: applicationVersion,
    expectedPackageVersion: packageVersion,
    sourceManifestPath: resolve(root, 'manifest.json'),
    sourceSha256SumsPath: resolve(root, 'SHA256SUMS.txt')
  });
} catch (error) {
  report = {
    schemaVersion: 1,
    product: 'Anadolu Parsı Aile Yaşam Merkezi',
    build: 216,
    applicationVersion,
    packageVersion,
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    closureReadiness: { open021: 'NOT_READY', open022: 'NOT_READY', ledgerMutationPerformed: false },
    generatedAt: new Date().toISOString()
  };
}
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build216 Windows evidence intake: ${report.status}${report.checks ? ` (${report.passed}/${report.checks})` : ''}.`);
if (report.status !== 'PASS') process.exitCode = 1;
