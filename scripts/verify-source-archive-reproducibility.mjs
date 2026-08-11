import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { SOURCE_MANIFEST_FILE, SOURCE_SHA256_FILE, verifySourceManifestIntegrity } from './lib/source-manifest.mjs';
import { buildDeterministicZip, inspectDeterministicZip, sha256 } from './lib/deterministic-zip.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const reportPath = resolve(option('--report', 'artifacts/validation/source-archive-reproducibility.json'));
const failures = [];
const integrity = await verifySourceManifestIntegrity('.');
if (integrity.status !== 'PASS') failures.push(...integrity.failures.map((failure) => `source-integrity: ${failure}`));
const manifest = JSON.parse(await readFile(SOURCE_MANIFEST_FILE, 'utf8'));
const paths = [...manifest.files.map((entry) => entry.path), SOURCE_MANIFEST_FILE, SOURCE_SHA256_FILE]
  .sort((left, right) => left.localeCompare(right, 'en'));
let first = null;
let second = null;
let inspection = null;
if (failures.length === 0) {
  first = await buildDeterministicZip('.', paths);
  second = await buildDeterministicZip('.', paths);
  inspection = inspectDeterministicZip(first.archive);
  if (!first.archive.equals(second.archive)) failures.push('Two archive generations from the same source tree produced different bytes.');
  if (inspection.status !== 'PASS') failures.push(...inspection.failures.map((failure) => `archive-inspection: ${failure}`));
  if (inspection.entries.length !== paths.length) failures.push(`archive entry count=${inspection.entries.length}; expected=${paths.length}`);
  for (let index = 0; index < paths.length; index += 1) {
    if (inspection.entries[index]?.path !== paths[index]) failures.push(`archive path order mismatch at ${index}: ${inspection.entries[index]?.path} / ${paths[index]}`);
  }
}
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  packageVersion: manifest.packageVersion ?? null,
  sourceIntegrityStatus: integrity.status,
  format: 'ZIP32',
  compression: 'STORE',
  canonicalTimestamp: '1980-01-01T00:00:00Z',
  canonicalUnixMode: '100644',
  generationCount: 2,
  byteIdentical: first && second ? first.archive.equals(second.archive) : false,
  entryCount: inspection?.entries.length ?? 0,
  archiveBytes: first?.archive.length ?? 0,
  archiveSha256: first ? sha256(first.archive) : null,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Source archive reproducibility: ${report.status} — ${report.entryCount} entries, byteIdentical=${report.byteIdentical}`);
for (const failure of failures.slice(0, 50)) console.error(`- ${failure}`);
if (report.status !== 'PASS') process.exitCode = 1;
