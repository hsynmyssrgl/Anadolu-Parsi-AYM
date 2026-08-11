import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { importNpmCacheTransferBundle } from './lib/npm-cache-transfer.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const archivePath = option('--archive');
const targetCacheRoot = option('--target-cache');
if (!archivePath) throw new Error('--archive is required.');
if (!targetCacheRoot) throw new Error('--target-cache is required.');
const reportPath = resolve(option('--report', 'artifacts/validation/npm-cache-transfer-import.json'));
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
let evidence;
try {
  evidence = await importNpmCacheTransferBundle({ packageVersion: packageJson.version, archivePath: resolve(archivePath), targetCacheRoot: resolve(targetCacheRoot) });
} catch (error) {
  evidence = { schemaVersion: 1, status: 'FAIL', importStatus: 'FAIL', targetCacheRoot: resolve(targetCacheRoot), failures: [error.message] };
}
evidence = { ...evidence, product: 'Anadolu Parsı Aile Yaşam Merkezi', stage: 'Bronze RC2 Active Development', generatedAt: new Date().toISOString() };
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Npm cache transfer import: ${evidence.status} — ${evidence.importedTarballCount ?? 0} tarballs.`);
for (const failure of (evidence.failures ?? []).slice(0, 50)) console.error(`- ${failure}`);
if (evidence.status !== 'PASS') process.exitCode = 1;
