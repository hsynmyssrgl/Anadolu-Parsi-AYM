import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { verifyNpmCacheTransferBundle } from './lib/npm-cache-transfer.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const archivePath = option('--archive');
if (!archivePath) throw new Error('--archive is required.');
const reportPath = resolve(option('--report', 'artifacts/validation/npm-cache-transfer-bundle-verification.json'));
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const report = await verifyNpmCacheTransferBundle({ packageVersion: packageJson.version, archivePath: resolve(archivePath) });
const evidence = { ...report, product: 'Anadolu Parsı Aile Yaşam Merkezi', stage: 'Bronze RC2 Active Development', generatedAt: new Date().toISOString() };
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Npm cache transfer bundle verification: ${evidence.status} — ${evidence.requiredTarballCount} required tarballs.`);
for (const failure of evidence.failures.slice(0, 50)) console.error(`- ${failure}`);
if (evidence.status !== 'PASS') process.exitCode = 1;
