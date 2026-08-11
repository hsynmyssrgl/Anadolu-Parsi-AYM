import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { acquireDependencyBundle } from './lib/npm-dependency-acquisition.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const planPath = resolve(option('--plan', 'artifacts/validation/npm-dependency-acquisition-plan.json'));
const policyPath = resolve(option('--policy', 'config/npm-dependency-acquisition-policy.json'));
const stagingRoot = resolve(option('--staging', 'artifacts/npm-dependency-acquisition-staging'));
const outputPath = resolve(option('--output', 'artifacts/validation/npm-cache-transfer-bundle.zip'));
const reportPath = resolve(option('--report', 'artifacts/validation/npm-dependency-acquisition-report.json'));
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const plan = JSON.parse(await readFile(planPath, 'utf8'));
const policy = JSON.parse(await readFile(policyPath, 'utf8'));
let report;
try {
  report = await acquireDependencyBundle({
    plan,
    packageVersion: packageJson.version,
    policy,
    stagingRoot,
    outputPath,
    onProgress: (event) => {
      if (event.phase === 'downloaded' || event.phase === 'reused') {
        console.log(`[${event.index}/${event.total}] ${event.phase.toUpperCase()} ${event.url}`);
      }
    }
  });
} catch (error) {
  report = { schemaVersion: 1, status: 'FAIL', classification: error.code ?? 'ACQUISITION_ERROR', failures: [error.message] };
}
report = {
  ...report,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  stage: 'Bronze RC2 Active Development',
  planPath,
  policyPath,
  stagingRoot,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Npm dependency acquisition: ${report.status} — downloaded=${report.downloadedTarballCount ?? 0}, reused=${report.reusedTarballCount ?? 0}, retries=${report.retryCount ?? 0}.`);
if (report.archivePath) console.log(`Bundle: ${report.archivePath}\nSHA-256: ${report.archiveSha256}`);
for (const failure of report.failures ?? []) console.error(`- ${failure}`);
if (report.status !== 'PASS') process.exitCode = 1;
