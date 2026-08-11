import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { acquireDependencyBundle, createDependencyAcquisitionPlan } from './lib/npm-dependency-acquisition.mjs';
import { acceptNpmCacheTransferBundle, CACHE_BUNDLE_ACCEPTANCE_KIND } from './lib/npm-cache-bundle-acceptance.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const reportPath = resolve(option('--report', 'artifacts/validation/build152-cache-bundle-acceptance.json'));
const failures = [];
let assertions = 0;
const verify = (condition, message) => { assertions += 1; if (!condition) failures.push(message); };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sha512 = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const fixture = await mkdtemp(join(tmpdir(), 'ppt-build152-acceptance-'));
const exists = async (path) => { try { await stat(path); return true; } catch { return false; } };

const createPackedPackage = async (name) => {
  const directory = join(fixture, 'packages', name);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'package.json'), `${JSON.stringify({ name, version: '1.0.0', main: 'index.js' }, null, 2)}\n`);
  await writeFile(join(directory, 'index.js'), `module.exports = ${JSON.stringify(name)};\n`);
  const packed = spawnSync(npmCommand, ['pack', '--ignore-scripts', '--json', '--pack-destination', fixture], { cwd: directory, encoding: 'utf8', shell: false });
  if (packed.status !== 0) throw new Error(`npm pack failed for ${name}: ${packed.stderr}`);
  const metadata = JSON.parse(packed.stdout);
  return readFile(join(fixture, metadata[0].filename));
};

const acceptancePolicy = (root) => ({
  schemaVersion: 1,
  maxArchiveBytes: 100_000_000,
  maxChecksumBytes: 4096,
  acceptedRoot: join(root, 'accepted'),
  quarantineRoot: join(root, 'quarantine'),
  receiptRoot: join(root, 'receipts'),
  cacheRoot: join(root, 'cache'),
  requireChecksumSidecar: true,
  importVerifiedBundle: true,
  replaceExistingCache: false
});

try {
  const names = ['ppt-acceptance-a', 'ppt-acceptance-b'];
  const tarballByUrl = new Map();
  const lockEntries = {};
  for (const name of names) {
    const bytes = await createPackedPackage(name);
    const url = `https://registry.npmjs.org/${name}/-/${name}-1.0.0.tgz`;
    tarballByUrl.set(url, bytes);
    lockEntries[`node_modules/${name}`] = { version: '1.0.0', resolved: url, integrity: sha512(bytes), dev: true };
  }
  const dependencies = Object.fromEntries(names.map((name) => [name, '1.0.0']));
  const packageJson = { name: 'ppt-build152-fixture', version: '1.0.0', private: true, devDependencies: dependencies };
  const lock = { name: packageJson.name, version: packageJson.version, lockfileVersion: 3, requires: true, packages: { '': { name: packageJson.name, version: packageJson.version, devDependencies: dependencies }, ...lockEntries } };
  const lockBytes = Buffer.from(`${JSON.stringify(lock, null, 2)}\n`);
  const plan = await createDependencyAcquisitionPlan({ lock, lockBytes, packageVersion: packageJson.version });
  const acquisitionPolicy = {
    schemaVersion: 1, registry: 'https://registry.npmjs.org/', officialRegistryOnly: true,
    concurrency: 2, maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, requestTimeoutMs: 30_000,
    maxTarballBytes: 10_000_000, maxBundleBytes: 100_000_000,
    retryableHttpStatuses: [408, 429, 500, 502, 503, 504], retryableNetworkCodes: ['EAI_AGAIN'],
    redirectPolicy: 'SAME_ORIGIN_ONLY', userAgent: 'PPT-Build152-Fixture/1'
  };
  const bundlePath = join(fixture, 'npm-cache-transfer-bundle.zip');
  const acquisition = await acquireDependencyBundle({
    plan, lock, lockBytes, packageVersion: packageJson.version, policy: acquisitionPolicy,
    stagingRoot: join(fixture, 'staging'), outputPath: bundlePath,
    fetchTarball: async ({ url }) => tarballByUrl.get(url)
  });
  verify(acquisition.status === 'PASS' && acquisition.verificationStatus === 'PASS', `fixture bundle=${acquisition.status}/${acquisition.verificationStatus}`);
  const bundleBytes = await readFile(bundlePath);
  const bundleSha = sha256(bundleBytes);
  const checksumPath = `${bundlePath}.sha256`;
  await writeFile(checksumPath, `${bundleSha}  ${basename(bundlePath)}\n`);

  const validRoot = join(fixture, 'valid');
  const validPolicy = acceptancePolicy(validRoot);
  const accepted = await acceptNpmCacheTransferBundle({ archivePath: bundlePath, checksumPath, packageVersion: packageJson.version, lockBytes, policy: validPolicy });
  verify(accepted.kind === CACHE_BUNDLE_ACCEPTANCE_KIND, `receipt kind=${accepted.kind}`);
  verify(accepted.status === 'PASS' && accepted.disposition === 'ACCEPTED', `acceptance=${accepted.status}/${accepted.disposition}`);
  verify(accepted.classification === 'VERIFIED_AND_IMPORTED', `classification=${accepted.classification}`);
  verify(accepted.archiveSha256 === bundleSha && accepted.verifiedTarballCount === 2, `archive identity/tarballs=${accepted.archiveSha256}/${accepted.verifiedTarballCount}`);
  verify(accepted.cacheReadiness?.status === 'PASS', `cache readiness=${accepted.cacheReadiness?.status}`);
  verify(await exists(accepted.acceptedArchivePath), 'accepted archive missing');
  verify(await exists(accepted.acceptedChecksumPath), 'accepted checksum missing');
  verify(await exists(accepted.receiptPath) && await exists(accepted.receiptChecksumPath), 'acceptance receipt or checksum missing');
  verify(await exists(accepted.pointerPath), 'current accepted pointer missing');
  verify(sha256(await readFile(accepted.acceptedArchivePath)) === bundleSha, 'accepted archive SHA-256 mismatch');

  const offlineProject = join(fixture, 'offline-project');
  await mkdir(offlineProject, { recursive: true });
  await writeFile(join(offlineProject, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  await writeFile(join(offlineProject, 'package-lock.json'), lockBytes);
  const offline = spawnSync(npmCommand, ['ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', `--cache=${validPolicy.cacheRoot}`], { cwd: offlineProject, encoding: 'utf8', shell: false });
  verify(offline.status === 0, `offline npm ci failed: ${offline.stderr}`);
  for (const name of names) verify(await exists(join(offlineProject, 'node_modules', name, 'package.json')), `offline package missing=${name}`);

  const repeated = await acceptNpmCacheTransferBundle({ archivePath: bundlePath, checksumPath, packageVersion: packageJson.version, lockBytes, policy: validPolicy });
  verify(repeated.status === 'PASS' && repeated.disposition === 'ALREADY_ACCEPTED', `idempotent acceptance=${repeated.status}/${repeated.disposition}`);
  verify(repeated.receiptSha256 === accepted.receiptSha256, 'idempotent receipt SHA-256 changed');

  const badChecksumRoot = join(fixture, 'bad-checksum');
  const badChecksumPath = join(fixture, 'bad-checksum.sha256');
  await writeFile(badChecksumPath, `${'0'.repeat(64)}  ${basename(bundlePath)}\n`);
  const badChecksum = await acceptNpmCacheTransferBundle({ archivePath: bundlePath, checksumPath: badChecksumPath, packageVersion: packageJson.version, lockBytes, policy: acceptancePolicy(badChecksumRoot) });
  verify(badChecksum.status === 'FAIL' && badChecksum.classification === 'CHECKSUM_MISMATCH', `bad checksum=${badChecksum.status}/${badChecksum.classification}`);
  verify(await exists(badChecksum.quarantineArchivePath) && await exists(badChecksum.receiptPath), 'bad checksum was not quarantined with receipt');

  const malformedRoot = join(fixture, 'malformed');
  const malformedPath = join(fixture, 'malformed.sha256');
  await writeFile(malformedPath, 'not-a-checksum\n');
  const malformed = await acceptNpmCacheTransferBundle({ archivePath: bundlePath, checksumPath: malformedPath, packageVersion: packageJson.version, lockBytes, policy: acceptancePolicy(malformedRoot) });
  verify(malformed.status === 'FAIL' && malformed.classification === 'CHECKSUM_FORMAT_INVALID', `malformed checksum=${malformed.status}/${malformed.classification}`);

  const wrongNameRoot = join(fixture, 'wrong-name');
  const wrongNamePath = join(fixture, 'wrong-name.sha256');
  await writeFile(wrongNamePath, `${bundleSha}  another.zip\n`);
  const wrongName = await acceptNpmCacheTransferBundle({ archivePath: bundlePath, checksumPath: wrongNamePath, packageVersion: packageJson.version, lockBytes, policy: acceptancePolicy(wrongNameRoot) });
  verify(wrongName.status === 'FAIL' && wrongName.classification === 'CHECKSUM_FILENAME_MISMATCH', `wrong checksum filename=${wrongName.status}/${wrongName.classification}`);

  const tamperedPath = join(fixture, 'tampered.zip');
  const tamperedBytes = Buffer.from(bundleBytes);
  tamperedBytes[Math.max(0, tamperedBytes.length - 30)] ^= 0xff;
  await writeFile(tamperedPath, tamperedBytes);
  const tamperedChecksum = `${tamperedPath}.sha256`;
  await writeFile(tamperedChecksum, `${sha256(tamperedBytes)}  ${basename(tamperedPath)}\n`);
  const tampered = await acceptNpmCacheTransferBundle({ archivePath: tamperedPath, checksumPath: tamperedChecksum, packageVersion: packageJson.version, lockBytes, policy: acceptancePolicy(join(fixture, 'tampered-root')) });
  verify(tampered.status === 'FAIL' && tampered.classification === 'BUNDLE_VERIFICATION_FAILED', `tampered bundle=${tampered.status}/${tampered.classification}`);
  verify(await exists(tampered.quarantineArchivePath), 'tampered bundle was not quarantined');

  const wrongVersion = await acceptNpmCacheTransferBundle({ archivePath: bundlePath, checksumPath, packageVersion: '1.0.1', lockBytes, policy: acceptancePolicy(join(fixture, 'wrong-version')) });
  verify(wrongVersion.status === 'FAIL' && wrongVersion.classification === 'BUNDLE_VERIFICATION_FAILED', `wrong version=${wrongVersion.status}/${wrongVersion.classification}`);

  const invalidExtensionPath = join(fixture, 'bundle.bin');
  await writeFile(invalidExtensionPath, bundleBytes);
  const invalidExtensionChecksum = `${invalidExtensionPath}.sha256`;
  await writeFile(invalidExtensionChecksum, `${bundleSha}  ${basename(invalidExtensionPath)}\n`);
  const invalidExtension = await acceptNpmCacheTransferBundle({ archivePath: invalidExtensionPath, checksumPath: invalidExtensionChecksum, packageVersion: packageJson.version, lockBytes, policy: acceptancePolicy(join(fixture, 'invalid-extension')) });
  verify(invalidExtension.status === 'FAIL' && invalidExtension.classification === 'ARCHIVE_EXTENSION_INVALID', `invalid extension=${invalidExtension.status}/${invalidExtension.classification}`);

  const existingCachePolicy = acceptancePolicy(join(fixture, 'existing-cache'));
  await mkdir(existingCachePolicy.cacheRoot, { recursive: true });
  const existingCache = await acceptNpmCacheTransferBundle({ archivePath: bundlePath, checksumPath, packageVersion: packageJson.version, lockBytes, policy: existingCachePolicy });
  verify(existingCache.status === 'FAIL' && existingCache.classification === 'TARGET_CACHE_EXISTS', `existing cache=${existingCache.status}/${existingCache.classification}`);

  await writeFile(accepted.receiptPath, '{}\n');
  const receiptTamper = await acceptNpmCacheTransferBundle({ archivePath: bundlePath, checksumPath, packageVersion: packageJson.version, lockBytes, policy: validPolicy });
  verify(receiptTamper.status === 'FAIL' && receiptTamper.classification === 'RECEIPT_TAMPERED', `receipt tamper=${receiptTamper.status}/${receiptTamper.classification}`);
} catch (error) {
  failures.push(`Unhandled fixture error: ${error.stack ?? error.message}`);
} finally {
  await rm(fixture, { recursive: true, force: true });
}

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  featureBuild: 152,
  stage: 'Bronze RC2 Active Development',
  scope: 'Air-gapped npm bundle checksum intake, verification, atomic acceptance, quarantine, receipt integrity, idempotency and real offline npm ci fixture',
  assertions,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 152 cache bundle acceptance contract: ${report.status} (${assertions - failures.length}/${assertions}).`);
for (const failure of failures) console.error(`- ${failure}`);
if (failures.length) process.exitCode = 1;
