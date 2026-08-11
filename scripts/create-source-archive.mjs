import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { SOURCE_MANIFEST_FILE, SOURCE_SHA256_FILE, verifySourceManifestIntegrity } from './lib/source-manifest.mjs';
import { writeDeterministicZip } from './lib/deterministic-zip.mjs';

const args = process.argv.slice(2);
const option = (name, fallback = undefined) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})-(\d+)$/.exec(packageJson.version ?? '');
if (!match) throw new Error(`Unsupported package version: ${packageJson.version}`);
const [, day, month, year, build] = match;
const displayVersion = `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}.${build}`;
const defaultName = `Anadolu_Parsi_Aile_Yasam_Merkezi_Bronze_RC2_Gelistirme_Build${build}_Kaynak_Kod_${displayVersion}.zip`;
const outputPath = resolve(option('--output', resolve('artifacts', 'validation', defaultName)));
const reportPath = resolve(option('--report', resolve('artifacts', 'validation', 'source-archive.json')));

const integrity = await verifySourceManifestIntegrity('.');
if (integrity.status !== 'PASS') throw new Error(`Source integrity must pass before archive creation: ${integrity.failures.join('; ')}`);
const manifest = JSON.parse(await readFile(SOURCE_MANIFEST_FILE, 'utf8'));
const paths = [...manifest.files.map((entry) => entry.path), SOURCE_MANIFEST_FILE, SOURCE_SHA256_FILE]
  .sort((left, right) => left.localeCompare(right, 'en'));
const report = await writeDeterministicZip({ root: '.', paths, outputPath });
const evidence = {
  ...report,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: displayVersion,
  packageVersion: packageJson.version,
  archiveFileName: basename(outputPath),
  sourceManifestFileCount: manifest.fileCount,
  status: 'PASS',
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Deterministic source archive: PASS — ${report.entryCount} entries, ${report.archiveBytes} bytes`);
console.log(`Archive: ${outputPath}`);
console.log(`SHA-256: ${report.archiveSha256}`);
