import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createNpmCacheTransferBundle } from './lib/npm-cache-transfer.mjs';
import { resolveNpmCacheRoot } from './lib/npm-offline-cache.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const outputPath = resolve(option('--output', 'artifacts/validation/npm-cache-transfer-bundle.zip'));
const reportPath = resolve(option('--report', 'artifacts/validation/npm-cache-transfer-bundle-creation.json'));
const cacheRoot = resolveNpmCacheRoot(option('--cache', undefined));
const report = await createNpmCacheTransferBundle({ packageVersion: packageJson.version, cacheRoot, outputPath });
const evidence = { ...report, product: 'Anadolu Parsı Aile Yaşam Merkezi', stage: 'Bronze RC2 Active Development', generatedAt: new Date().toISOString() };
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Npm cache transfer bundle creation: ${evidence.status} — ${evidence.readyTarballCount}/${evidence.requiredTarballCount} tarballs ready.`);
if (evidence.archiveCreated) console.log(`Archive: ${evidence.archivePath}\nSHA-256: ${evidence.archiveSha256}`);
if (evidence.status !== 'PASS') process.exitCode = 1;
