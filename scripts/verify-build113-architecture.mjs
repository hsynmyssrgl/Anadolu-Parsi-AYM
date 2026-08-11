import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, copyFile, mkdir, mkdtemp, readFile, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDeterministicZip, inspectDeterministicZip, writeDeterministicZip } from './lib/deterministic-zip.mjs';

const failures = [];
let checks = 0;
const verify = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const read = (path) => readFile(path, 'utf8');
const packageJson = JSON.parse(await read('package.json'));
const sourcePreflight = JSON.parse(await read('config/source-preflight-checks.json'));
const createScript = await read('scripts/create-source-archive.mjs');
const verifyScript = await read('scripts/verify-source-archive.mjs');
const reproScript = await read('scripts/verify-source-archive-reproducibility.mjs');
const zipLibrary = await read('scripts/lib/deterministic-zip.mjs');
const ciWorkflow = await read('.github/workflows/ci.yml');
const windowsWorkflow = await read('.github/workflows/windows-rc2-validation.yml');

verify(packageJson.version === '25.7.2026-113', `root package version=${packageJson.version}`);
verify(packageJson.scripts?.['source:archive'] === 'node scripts/create-source-archive.mjs', 'source:archive script is missing');
verify(packageJson.scripts?.['verify:source-archive'] === 'node scripts/verify-source-archive.mjs', 'verify:source-archive script is missing');
verify(packageJson.scripts?.['verify:source-archive:reproducibility'] === 'node scripts/verify-source-archive-reproducibility.mjs', 'reproducibility script is missing');
verify(packageJson.scripts?.['verify:build113:architecture'] === 'node scripts/verify-build113-architecture.mjs', 'Build 113 architecture script is missing');
verify(sourcePreflight.checks?.[0]?.id === 'source-integrity', 'source-integrity must remain the first source preflight check');
verify(sourcePreflight.checks?.[1]?.id === 'source-archive-reproducibility', 'archive reproducibility must be the second source preflight check');
verify(sourcePreflight.checks?.[1]?.script === 'scripts/verify-source-archive-reproducibility.mjs', 'archive reproducibility check script mismatch');
verify(sourcePreflight.checks?.[1]?.args?.includes('artifacts/validation/source-archive-reproducibility.json'), 'archive reproducibility evidence path mismatch');
verify(createScript.includes('verifySourceManifestIntegrity'), 'archive creator does not require source integrity');
verify(createScript.includes('SOURCE_MANIFEST_FILE') && createScript.includes('SOURCE_SHA256_FILE'), 'archive creator does not include manifest and SHA list');
verify(createScript.includes('writeDeterministicZip'), 'archive creator does not use deterministic ZIP writer');
verify(verifyScript.includes('verifyDeterministicZipFile'), 'archive verifier does not inspect deterministic ZIP metadata');
verify(verifyScript.includes('Archive contains unexpected path'), 'archive verifier does not reject unexpected files');
verify(reproScript.includes('first.archive.equals(second.archive)'), 'reproducibility verifier does not compare exact archive bytes');
verify(zipLibrary.includes('const STORE_METHOD = 0'), 'ZIP writer is not using deterministic STORE mode');
verify(zipLibrary.includes('const FIXED_DOS_DATE = 0x0021'), 'ZIP writer does not fix the DOS timestamp');
verify(zipLibrary.includes('const FIXED_UNIX_MODE = 0o100644'), 'ZIP writer does not normalize file permissions');
verify(zipLibrary.includes('const UTF8_FLAG = 0x0800'), 'ZIP writer does not require UTF-8 paths');
verify(!zipLibrary.includes("node:zlib"), 'ZIP writer must not depend on zlib implementation details');
verify(zipLibrary.includes('Archive paths must be strictly sorted'), 'ZIP writer does not require canonical order');
verify(zipLibrary.includes('Archive paths must be unique'), 'ZIP writer does not reject duplicate paths');
verify(ciWorkflow.includes('source-archive-reproducibility.json'), 'Linux CI does not preserve archive reproducibility evidence');
verify(windowsWorkflow.includes('source-archive-reproducibility.json'), 'Windows workflow does not preserve archive reproducibility evidence');

const fixture = await mkdtemp(join(tmpdir(), 'ppt-build113-'));
await mkdir(join(fixture, 'nested'), { recursive: true });
await writeFile(join(fixture, 'alpha.txt'), 'alpha\n');
await writeFile(join(fixture, 'nested', 'beta.txt'), 'beta\n');
const paths = ['alpha.txt', 'nested/beta.txt'];
const firstPath = join(fixture, 'first.zip');
const secondPath = join(fixture, 'second.zip');
const first = await writeDeterministicZip({ root: fixture, paths, outputPath: firstPath });
await chmod(join(fixture, 'alpha.txt'), 0o600);
await utimes(join(fixture, 'alpha.txt'), new Date('2025-01-01T12:34:56Z'), new Date('2025-01-01T12:34:56Z'));
await chmod(join(fixture, 'nested', 'beta.txt'), 0o755);
await utimes(join(fixture, 'nested', 'beta.txt'), new Date('2024-04-02T03:04:05Z'), new Date('2024-04-02T03:04:05Z'));
const second = await writeDeterministicZip({ root: fixture, paths, outputPath: secondPath });
verify(first.archiveSha256 === second.archiveSha256, 'mtime/mode changes altered archive hash');
verify((await readFile(firstPath)).equals(await readFile(secondPath)), 'repeated archives are not byte-identical');
const inspection = inspectDeterministicZip(await readFile(firstPath));
verify(inspection.status === 'PASS', `deterministic archive inspection=${inspection.failures.join('; ')}`);
verify(inspection.entryCount === 2, `fixture archive entry count=${inspection.entryCount}`);
verify(inspection.entries.map((entry) => entry.path).join(',') === paths.join(','), 'fixture archive order is not canonical');
verify(inspection.entries[0]?.bytes === 6 && inspection.entries[1]?.bytes === 5, 'fixture archive sizes are wrong');
verify(inspection.entries.every((entry) => /^[0-9a-f]{8}$/.test(entry.crc32)), 'fixture archive CRC values are invalid');

const copiedPath = join(fixture, 'copied.zip');
await copyFile(firstPath, copiedPath);
const mutated = await readFile(copiedPath);
const alphaOffset = mutated.indexOf(Buffer.from('alpha\n'));
verify(alphaOffset > 0, 'fixture payload offset was not found');
mutated[alphaOffset] ^= 0x01;
await writeFile(copiedPath, mutated);
const mutatedInspection = inspectDeterministicZip(mutated);
verify(mutatedInspection.status === 'FAIL', 'mutated archive unexpectedly passed');
verify(mutatedInspection.failures.some((failure) => failure.includes('CRC-32')), 'mutated archive did not fail CRC validation');

const truncatedInspection = inspectDeterministicZip((await readFile(firstPath)).subarray(0, 12));
verify(truncatedInspection.status === 'FAIL', 'truncated archive unexpectedly passed');
verify(truncatedInspection.failures.some((failure) => failure.includes('too short')), `truncated archive failure=${truncatedInspection.failures.join('; ')}`);
const appendedInspection = inspectDeterministicZip(Buffer.concat([await readFile(firstPath), Buffer.from([0]) ]));
verify(appendedInspection.status === 'FAIL', 'archive with trailing byte unexpectedly passed');
verify(appendedInspection.failures.some((failure) => failure.includes('Unexpected bytes')), `trailing-byte failure=${appendedInspection.failures.join('; ')}`);
const timestampMutation = Buffer.from(await readFile(firstPath));
timestampMutation.writeUInt16LE(1, 10);
const timestampInspection = inspectDeterministicZip(timestampMutation);
verify(timestampInspection.status === 'FAIL', 'archive with mutated local timestamp unexpectedly passed');
verify(timestampInspection.failures.some((failure) => failure.includes('local/central metadata mismatch')), 'timestamp mutation was not detected');

for (const [label, candidatePaths, expectedMessage] of [
  ['unsorted', ['nested/beta.txt', 'alpha.txt'], 'strictly sorted'],
  ['duplicate', ['alpha.txt', 'alpha.txt'], 'unique'],
  ['unsafe', ['../alpha.txt'], 'canonical']
]) {
  let message = '';
  try { await buildDeterministicZip(fixture, candidatePaths); } catch (error) { message = error.message; }
  verify(message.includes(expectedMessage), `${label} path rejection message=${message}`);
}

const unzipProbe = spawnSync('unzip', ['-t', firstPath], { encoding: 'utf8' });
if (unzipProbe.error?.code === 'ENOENT') {
  verify(true, 'system unzip unavailable; Node parser remains authoritative');
} else {
  verify(unzipProbe.status === 0, `system unzip compatibility failed: ${unzipProbe.stderr || unzipProbe.stdout}`);
}

const evidence = {
  schemaVersion: 1,
  product: 'Panthera pardus tulliana Aile',
  version: '25.07.2026.113',
  packageVersion: '25.7.2026-113',
  build: 113,
  checks,
  fixtureArchiveSha256: first.archiveSha256,
  byteIdenticalAfterMetadataChanges: first.archiveSha256 === second.archiveSha256,
  systemUnzipAvailable: unzipProbe.error?.code !== 'ENOENT',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build113-architecture.json', `${JSON.stringify(evidence, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`Build 113 architecture validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 113 architecture validation passed: ${checks} assertions.`);
