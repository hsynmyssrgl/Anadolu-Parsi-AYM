import { verifySourceManifestIntegrity, writeIntegrityReport } from './lib/source-manifest.mjs';

const cliArgs = process.argv.slice(2);
const noReport = cliArgs.includes('--no-report');
const optionValue = (name, fallback) => {
  const index = cliArgs.indexOf(name);
  if (index < 0) return fallback;
  const value = cliArgs[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};

const reportPath = optionValue('--report', 'artifacts/validation/source-integrity.json');
let report;
try {
  report = await verifySourceManifestIntegrity('.');
} catch (error) {
  report = {
    schemaVersion: 1,
    product: 'Anadolu Parsı Aile Yaşam Merkezi',
    packageVersion: null,
    manifestSchemaVersion: null,
    manifestFileCount: 0,
    actualSourceFileCount: 0,
    sha256EntryCount: 0,
    symlinksAllowed: false,
    status: 'FAIL',
    failures: [error instanceof Error ? error.message : String(error)]
  };
}
if (!noReport) await writeIntegrityReport(reportPath, report);
console.log(`Source integrity: ${report.status} — manifest=${report.manifestFileCount}, source=${report.actualSourceFileCount}, sha256=${report.sha256EntryCount}`);
for (const failure of report.failures.slice(0, 50)) console.error(`- ${failure}`);
if (report.status !== 'PASS') process.exitCode = 1;
