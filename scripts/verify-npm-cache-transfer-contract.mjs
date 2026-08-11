import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { assessNpmOfflineCache, npmCacheContentPath } from './lib/npm-offline-cache.mjs';
import { createNpmCacheTransferBundle, importNpmCacheTransferBundle, verifyNpmCacheTransferBundle } from './lib/npm-cache-transfer.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const reportPath = resolve(option('--report', 'artifacts/validation/npm-cache-transfer-contract.json'));
let assertions = 0;
const failures = [];
const verify = (condition, message) => { assertions += 1; if (!condition) failures.push(message); };
const sha512 = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;

const writeFixtureCache = async ({ cacheRoot, entries }) => {
  const indexPath = join(cacheRoot, '_cacache/index-v5/aa/bb/fixture');
  await mkdir(dirname(indexPath), { recursive: true });
  const lines = [];
  for (const [index, entry] of entries.entries()) {
    const contentPath = npmCacheContentPath(cacheRoot, entry.integrity);
    await mkdir(dirname(contentPath), { recursive: true });
    await writeFile(contentPath, entry.content);
    const record = { key: `make-fetch-happen:request-cache:${entry.url}`, integrity: entry.integrity, time: index + 1, size: entry.content.length };
    lines.push(`${String(index).padStart(40, '0')}\t${JSON.stringify(record)}`);
  }
  await writeFile(indexPath, `${lines.join('\n')}\n`);
};

const fixture = await mkdtemp(join(tmpdir(), 'ppt-build117-cache-transfer-'));
try {
  const contentA = Buffer.from('fixture-package-a');
  const contentB = Buffer.from('fixture-package-b');
  const urlA = 'https://registry.npmjs.org/package-a/-/package-a-1.0.0.tgz';
  const urlB = 'https://registry.npmjs.org/package-b/-/package-b-2.0.0.tgz';
  const integrityA = sha512(contentA);
  const integrityB = sha512(contentB);
  const lock = { name: 'fixture', version: '1.0.0', lockfileVersion: 3, packages: {
    '': { name: 'fixture', version: '1.0.0' },
    'node_modules/package-a': { version: '1.0.0', resolved: urlA, integrity: integrityA },
    'node_modules/package-b': { version: '2.0.0', resolved: urlB, integrity: integrityB }
  }};
  const lockBytes = Buffer.from(`${JSON.stringify(lock, null, 2)}\n`);
  const cacheRoot = join(fixture, 'source-cache');
  await writeFixtureCache({ cacheRoot, entries: [
    { url: urlA, integrity: integrityA, content: contentA },
    { url: urlB, integrity: integrityB, content: contentB }
  ] });
  const archiveA = join(fixture, 'bundle-a.zip');
  const archiveB = join(fixture, 'bundle-b.zip');
  const createdA = await createNpmCacheTransferBundle({ lock, lockBytes, packageVersion: '1.0.0', cacheRoot, outputPath: archiveA });
  const createdB = await createNpmCacheTransferBundle({ lock, lockBytes, packageVersion: '1.0.0', cacheRoot, outputPath: archiveB });
  verify(createdA.status === 'PASS', `bundle creation A=${createdA.status}`);
  verify(createdB.status === 'PASS', `bundle creation B=${createdB.status}`);
  verify(createdA.archiveCreated === true, 'bundle A was not created');
  verify(createdA.includedTarballCount === 2, `included=${createdA.includedTarballCount}`);
  verify(createdA.archiveEntryCount === 3, `archive entries=${createdA.archiveEntryCount}`);
  verify(createdA.archiveSha256 === createdB.archiveSha256, 'independent bundle hashes differ');
  verify((await readFile(archiveA)).equals(await readFile(archiveB)), 'independent bundle bytes differ');

  const verified = await verifyNpmCacheTransferBundle({ lock, lockBytes, packageVersion: '1.0.0', archivePath: archiveA });
  verify(verified.status === 'PASS', `bundle verification=${verified.status}: ${verified.failures.join('; ')}`);
  verify(verified.requiredTarballCount === 2, `required=${verified.requiredTarballCount}`);
  verify(verified.archiveEntryCount === 3, `verified archive entries=${verified.archiveEntryCount}`);
  verify(verified.officialRegistryOnly === true, 'official registry flag missing');
  verify(verified.deterministicArchiveStatus === 'PASS', `deterministic=${verified.deterministicArchiveStatus}`);

  const targetCache = join(fixture, 'imported-cache');
  const imported = await importNpmCacheTransferBundle({ lock, lockBytes, packageVersion: '1.0.0', archivePath: archiveA, targetCacheRoot: targetCache });
  verify(imported.status === 'PASS', `import=${imported.status}`);
  verify(imported.importStatus === 'PASS', `importStatus=${imported.importStatus}`);
  verify(imported.importedTarballCount === 2, `imported=${imported.importedTarballCount}`);
  verify(imported.readinessStatus === 'PASS', `readiness=${imported.readinessStatus}`);
  const importedReadiness = await assessNpmOfflineCache({ lock, cacheRoot: targetCache });
  verify(importedReadiness.status === 'PASS', `imported cache readiness=${importedReadiness.status}`);
  verify(importedReadiness.readyTarballCount === 2, `imported ready=${importedReadiness.readyTarballCount}`);

  let existingTargetRejected = false;
  try { await importNpmCacheTransferBundle({ lock, lockBytes, packageVersion: '1.0.0', archivePath: archiveA, targetCacheRoot: targetCache }); }
  catch (error) { existingTargetRejected = /must not already exist/.test(error.message); }
  verify(existingTargetRejected, 'existing target cache was not rejected');

  const tampered = Buffer.from(await readFile(archiveA));
  tampered[Math.floor(tampered.length / 3)] ^= 0xff;
  const tamperedResult = await verifyNpmCacheTransferBundle({ lock, lockBytes, packageVersion: '1.0.0', archiveBytes: tampered });
  verify(tamperedResult.status === 'FAIL', 'tampered archive was accepted');
  verify(tamperedResult.failures.length > 0, 'tampered archive failure evidence missing');

  const wrongLock = structuredClone(lock);
  wrongLock.packages['node_modules/package-b'].integrity = integrityA;
  const wrongLockBytes = Buffer.from(`${JSON.stringify(wrongLock, null, 2)}\n`);
  const wrongLockResult = await verifyNpmCacheTransferBundle({ lock: wrongLock, lockBytes: wrongLockBytes, packageVersion: '1.0.0', archivePath: archiveA });
  verify(wrongLockResult.status === 'FAIL', 'lockfile mismatch was accepted');
  verify(wrongLockResult.failures.some((item) => /package-lock SHA-256 mismatch|Integrity mismatch/.test(item)), 'lock mismatch reason missing');

  const wrongVersion = await verifyNpmCacheTransferBundle({ lock, lockBytes, packageVersion: '9.9.9', archivePath: archiveA });
  verify(wrongVersion.status === 'FAIL', 'package version mismatch was accepted');
  verify(wrongVersion.failures.some((item) => item.includes('Package version mismatch')), 'package version mismatch reason missing');

  const incompleteCache = join(fixture, 'incomplete-cache');
  await writeFixtureCache({ cacheRoot: incompleteCache, entries: [{ url: urlA, integrity: integrityA, content: contentA }] });
  const incompleteOutput = join(fixture, 'incomplete.zip');
  const incomplete = await createNpmCacheTransferBundle({ lock, lockBytes, packageVersion: '1.0.0', cacheRoot: incompleteCache, outputPath: incompleteOutput });
  verify(incomplete.status === 'INCOMPLETE', `incomplete creation=${incomplete.status}`);
  verify(incomplete.archiveCreated === false, 'incomplete cache created an archive');
  verify(incomplete.readyTarballCount === 1, `incomplete ready=${incomplete.readyTarballCount}`);
  verify(incomplete.missingOrInvalidTarballCount === 1, `incomplete missing=${incomplete.missingOrInvalidTarballCount}`);

  const nonOfficialLock = structuredClone(lock);
  nonOfficialLock.packages['node_modules/package-a'].resolved = 'https://mirror.invalid/package-a-1.0.0.tgz';
  let nonOfficialRejected = false;
  try { await createNpmCacheTransferBundle({ lock: nonOfficialLock, lockBytes: Buffer.from(JSON.stringify(nonOfficialLock)), packageVersion: '1.0.0', cacheRoot, outputPath: join(fixture, 'mirror.zip') }); }
  catch (error) { nonOfficialRejected = /Non-official registry/.test(error.message); }
  verify(nonOfficialRejected, 'non-official registry lockfile was not rejected');

  verify(createdA.packageLockSha256 === verified.packageLockSha256, 'creation/verification lock hashes differ');
  verify(createdA.archiveSha256 === verified.archiveSha256, 'creation/verification archive hashes differ');
  verify(imported.archiveSha256 === verified.archiveSha256, 'import/verification archive hashes differ');
} finally {
  await rm(fixture, { recursive: true, force: true });
}

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: '25.07.2026.117',
  packageVersion: '25.7.2026-117',
  stage: 'Bronze RC2 Active Development',
  assertions,
  failures,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Npm cache transfer contract: ${report.status} — ${assertions} assertions.`);
for (const failure of failures) console.error(`- ${failure}`);
if (report.status !== 'PASS') process.exitCode = 1;
