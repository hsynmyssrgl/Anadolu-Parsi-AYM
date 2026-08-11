import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { SOURCE_MANIFEST_FILE, SOURCE_SHA256_FILE, sha256Buffer, verifySourceManifestIntegrity } from './lib/source-manifest.mjs';
import { verifyDeterministicZipFile } from './lib/deterministic-zip.mjs';

const args = process.argv.slice(2);
const option = (name, fallback = undefined) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const archivePath = option('--archive');
if (!archivePath) throw new Error('--archive is required.');
const reportPath = resolve(option('--report', 'artifacts/validation/source-archive-verification.json'));
const integrity = await verifySourceManifestIntegrity('.');
const manifest = JSON.parse(await readFile(SOURCE_MANIFEST_FILE, 'utf8'));
const expectedPaths = [...manifest.files.map((entry) => entry.path), SOURCE_MANIFEST_FILE, SOURCE_SHA256_FILE]
  .sort((left, right) => left.localeCompare(right, 'en'));
const manifestBytes = await readFile(SOURCE_MANIFEST_FILE);
const sumsBytes = await readFile(SOURCE_SHA256_FILE);
const expectedByPath = new Map([
  ...manifest.files.map((entry) => [entry.path, { bytes: entry.bytes, sha256: entry.sha256 }]),
  [SOURCE_MANIFEST_FILE, { bytes: manifestBytes.length, sha256: sha256Buffer(manifestBytes) }],
  [SOURCE_SHA256_FILE, { bytes: sumsBytes.length, sha256: sha256Buffer(sumsBytes) }]
]);
const archive = await verifyDeterministicZipFile(archivePath);
const failures = [...(integrity.status === 'PASS' ? [] : integrity.failures), ...archive.failures];
const archiveByPath = new Map(archive.entries.map((entry) => [entry.path, entry]));
if (archive.entries.length !== expectedPaths.length) failures.push(`Archive entry count=${archive.entries.length}; expected=${expectedPaths.length}`);
for (const path of expectedPaths) {
  const entry = archiveByPath.get(path);
  const expected = expectedByPath.get(path);
  if (!entry) failures.push(`Archive is missing path: ${path}`);
  else if (entry.bytes !== expected.bytes || entry.sha256 !== expected.sha256) failures.push(`Archive content mismatch: ${path}`);
}
for (const entry of archive.entries) if (!expectedByPath.has(entry.path)) failures.push(`Archive contains unexpected path: ${entry.path}`);
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  archiveFileName: basename(archivePath),
  archiveSha256: archive.archiveSha256,
  archiveBytes: archive.archiveBytes,
  entryCount: archive.entries.length,
  sourceIntegrityStatus: integrity.status,
  deterministicMetadataStatus: archive.status,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Deterministic source archive verification: ${report.status} — ${report.entryCount} entries`);
for (const failure of failures.slice(0, 50)) console.error(`- ${failure}`);
if (report.status !== 'PASS') process.exitCode = 1;
