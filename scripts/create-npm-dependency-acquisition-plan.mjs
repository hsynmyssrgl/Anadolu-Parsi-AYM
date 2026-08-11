import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createDependencyAcquisitionPlan, verifyDependencyAcquisitionPlan } from './lib/npm-dependency-acquisition.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const outputPath = resolve(option('--output', 'artifacts/validation/npm-dependency-acquisition-plan.json'));
const reportPath = resolve(option('--report', 'artifacts/validation/npm-dependency-acquisition-plan-report.json'));
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const plan = await createDependencyAcquisitionPlan({ packageVersion: packageJson.version });
const verification = await verifyDependencyAcquisitionPlan({ plan, packageVersion: packageJson.version });
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`);
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  stage: 'Bronze RC2 Active Development',
  status: verification.status,
  outputPath,
  packageVersion: plan.packageVersion,
  packageLockSha256: plan.packageLockSha256,
  requiredTarballCount: plan.requiredTarballCount,
  failures: verification.failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Npm dependency acquisition plan: ${report.status} — ${report.requiredTarballCount} official tarballs.`);
console.log(`Plan: ${outputPath}`);
if (report.status !== 'PASS') process.exitCode = 1;
