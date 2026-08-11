import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { assessNpmOfflineCache, resolveNpmCacheRoot } from './lib/npm-offline-cache.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};

const reportPath = resolve(option('--report', 'artifacts/validation/npm-offline-cache-readiness.json'));
const cacheRoot = resolveNpmCacheRoot(option('--cache', undefined));
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const startedAt = new Date().toISOString();
const assessment = await assessNpmOfflineCache({ lock, cacheRoot, includeReadyEntries: args.includes('--include-ready') });
const report = {
  ...assessment,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  stage: 'Bronze RC2 Active Development',
  startedAt,
  finishedAt: new Date().toISOString(),
  platform: process.platform,
  nodeVersion: process.version
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Npm offline cache readiness: ${report.status} (${report.readyTarballCount}/${report.requiredTarballCount} tarballs ready).`);
console.log(`Npm offline cache readiness report written: ${reportPath}`);
if (report.status !== 'PASS') process.exitCode = 1;
