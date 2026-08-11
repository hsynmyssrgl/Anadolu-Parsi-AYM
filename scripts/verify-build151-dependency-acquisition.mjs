import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  DEPENDENCY_ACQUISITION_PLAN_KIND,
  acquireDependencyBundle,
  createDependencyAcquisitionPlan,
  fetchOfficialNpmTarball,
  verifyDependencyAcquisitionPlan
} from './lib/npm-dependency-acquisition.mjs';
import {
  cacheTransferArchivePath,
  importNpmCacheTransferBundle,
  verifyNpmCacheTransferBundle
} from './lib/npm-cache-transfer.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const reportPath = resolve(option('--report', 'artifacts/validation/build151-dependency-acquisition.json'));
const failures = [];
let assertions = 0;
const verify = (condition, message) => {
  assertions += 1;
  if (!condition) failures.push(message);
};
const sha512 = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const fixture = await mkdtemp(join(tmpdir(), 'ppt-build151-acquisition-'));

const createPackedPackage = async (name) => {
  const directory = join(fixture, 'packages', name);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'package.json'), `${JSON.stringify({ name, version: '1.0.0', main: 'index.js' }, null, 2)}\n`);
  await writeFile(join(directory, 'index.js'), `module.exports = ${JSON.stringify(name)};\n`);
  const packed = spawnSync(npmCommand, ['pack', '--ignore-scripts', '--json', '--pack-destination', fixture], {
    cwd: directory,
    encoding: 'utf8',
    shell: false
  });
  if (packed.status !== 0) throw new Error(`npm pack failed for ${name}: ${packed.stderr}`);
  const metadata = JSON.parse(packed.stdout);
  const tarballPath = join(fixture, metadata[0].filename);
  return readFile(tarballPath);
};

try {
  const names = ['ppt-acquisition-a', 'ppt-acquisition-b', 'ppt-acquisition-c'];
  const tarballByUrl = new Map();
  const lockEntries = {};
  for (const name of names) {
    const bytes = await createPackedPackage(name);
    const url = `https://registry.npmjs.org/${name}/-/${name}-1.0.0.tgz`;
    tarballByUrl.set(url, bytes);
    lockEntries[`node_modules/${name}`] = {
      version: '1.0.0',
      resolved: url,
      integrity: sha512(bytes),
      dev: true
    };
  }
  const dependencies = Object.fromEntries(names.map((name) => [name, '1.0.0']));
  const fixturePackage = { name: 'ppt-build151-fixture', version: '1.0.0', private: true, devDependencies: dependencies };
  const lock = {
    name: fixturePackage.name,
    version: fixturePackage.version,
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': { name: fixturePackage.name, version: fixturePackage.version, devDependencies: dependencies },
      ...lockEntries
    }
  };
  const lockBytes = Buffer.from(`${JSON.stringify(lock, null, 2)}\n`);
  const plan = await createDependencyAcquisitionPlan({ lock, lockBytes, packageVersion: fixturePackage.version });
  verify(plan.kind === DEPENDENCY_ACQUISITION_PLAN_KIND, `plan kind=${plan.kind}`);
  verify(plan.registry === 'https://registry.npmjs.org/' && plan.officialRegistryOnly === true, 'plan registry policy mismatch');
  verify(plan.packageVersion === fixturePackage.version, `plan packageVersion=${plan.packageVersion}`);
  verify(plan.packageLockSha256 === sha256(lockBytes), 'plan lock SHA-256 mismatch');
  verify(plan.requiredTarballCount === 3 && plan.entries.length === 3, `plan tarball count=${plan.requiredTarballCount}/${plan.entries.length}`);
  verify(plan.entries.every((entry, index) => index === 0 || plan.entries[index - 1].url.localeCompare(entry.url, 'en') < 0), 'plan URLs are not strictly sorted');
  verify(plan.entries.every((entry) => entry.archivePath === cacheTransferArchivePath(entry.integrity)), 'plan archive paths are not integrity-addressed');
  verify(plan.entries.every((entry) => entry.packagePaths.length === 1), 'plan package paths were not preserved');

  const planVerification = await verifyDependencyAcquisitionPlan({ plan, lock, lockBytes, packageVersion: fixturePackage.version });
  verify(planVerification.status === 'PASS', `plan verification=${planVerification.status}: ${planVerification.failures.join('; ')}`);
  const wrongVersion = structuredClone(plan);
  wrongVersion.packageVersion = '1.0.1';
  const wrongVersionVerification = await verifyDependencyAcquisitionPlan({ plan: wrongVersion, lock, lockBytes, packageVersion: fixturePackage.version });
  verify(wrongVersionVerification.status === 'FAIL' && wrongVersionVerification.failures.some((item) => item.includes('Package version mismatch')), 'package version tamper was not rejected');
  const wrongOrigin = structuredClone(plan);
  wrongOrigin.entries[0].url = 'https://example.com/evil.tgz';
  const wrongOriginVerification = await verifyDependencyAcquisitionPlan({ plan: wrongOrigin, lock, lockBytes, packageVersion: fixturePackage.version });
  verify(wrongOriginVerification.status === 'FAIL' && wrongOriginVerification.failures.some((item) => item.includes('Non-official')), 'non-official plan URL was not rejected');
  const wrongIntegrity = structuredClone(plan);
  wrongIntegrity.entries[0].integrity = `sha512-${Buffer.alloc(64).toString('base64')}`;
  const wrongIntegrityVerification = await verifyDependencyAcquisitionPlan({ plan: wrongIntegrity, lock, lockBytes, packageVersion: fixturePackage.version });
  verify(wrongIntegrityVerification.status === 'FAIL' && wrongIntegrityVerification.failures.some((item) => item.includes('Integrity mismatch')), 'integrity tamper was not rejected');

  const policy = {
    schemaVersion: 1,
    registry: 'https://registry.npmjs.org/',
    officialRegistryOnly: true,
    concurrency: 2,
    maxAttempts: 3,
    baseDelayMs: 0,
    maxDelayMs: 0,
    requestTimeoutMs: 30_000,
    maxTarballBytes: 10_000_000,
    maxBundleBytes: 100_000_000,
    retryableHttpStatuses: [408, 429, 500, 502, 503, 504],
    retryableNetworkCodes: ['EAI_AGAIN'],
    redirectPolicy: 'SAME_ORIGIN_ONLY',
    userAgent: 'PPT-Build151-Fixture/1'
  };
  const staging = join(fixture, 'staging');
  await mkdir(staging, { recursive: true });
  const reusedEntry = plan.entries[0];
  const corruptEntry = plan.entries[2];
  const reusedTarget = join(staging, reusedEntry.archivePath);
  const corruptTarget = join(staging, corruptEntry.archivePath);
  await mkdir(dirname(reusedTarget), { recursive: true });
  await writeFile(reusedTarget, tarballByUrl.get(reusedEntry.url));
  await mkdir(dirname(corruptTarget), { recursive: true });
  await writeFile(corruptTarget, Buffer.from('corrupt'));
  const attemptCounts = new Map();
  const fetchTarball = async ({ url }) => {
    const attempt = (attemptCounts.get(url) ?? 0) + 1;
    attemptCounts.set(url, attempt);
    if (url.includes('acquisition-b') && attempt === 1) throw Object.assign(new Error('temporary DNS failure'), { code: 'EAI_AGAIN' });
    return tarballByUrl.get(url);
  };
  const bundlePath = join(fixture, 'bundle.zip');
  const progress = [];
  const acquisition = await acquireDependencyBundle({
    plan,
    lock,
    lockBytes,
    packageVersion: fixturePackage.version,
    policy,
    stagingRoot: staging,
    outputPath: bundlePath,
    fetchTarball,
    onProgress: (event) => progress.push(event)
  });
  verify(acquisition.status === 'PASS', `acquisition=${acquisition.status}: ${(acquisition.failures ?? []).join('; ')}`);
  verify(acquisition.requiredTarballCount === 3, `acquisition required=${acquisition.requiredTarballCount}`);
  verify(acquisition.reusedTarballCount === 1, `acquisition reused=${acquisition.reusedTarballCount}`);
  verify(acquisition.downloadedTarballCount === 2, `acquisition downloaded=${acquisition.downloadedTarballCount}`);
  verify(acquisition.retryCount === 1, `acquisition retries=${acquisition.retryCount}`);
  verify(acquisition.archiveEntryCount === 4, `bundle entries=${acquisition.archiveEntryCount}`);
  verify(acquisition.verificationStatus === 'PASS', `bundle verification=${acquisition.verificationStatus}`);
  verify((await stat(bundlePath)).isFile(), 'dependency bundle was not created');
  verify(progress.some((event) => event.phase === 'reused') && progress.some((event) => event.phase === 'downloaded'), 'progress did not expose reuse and download phases');
  verify(attemptCounts.get(reusedEntry.url) === undefined, 'verified staged tarball was fetched again');
  verify(attemptCounts.get(corruptEntry.url) === 1, `corrupt staged tarball fetch count=${attemptCounts.get(corruptEntry.url)}`);
  verify(attemptCounts.get(plan.entries[1].url) === 2, `retry tarball attempt count=${attemptCounts.get(plan.entries[1].url)}`);

  const bundleVerification = await verifyNpmCacheTransferBundle({ lock, lockBytes, packageVersion: fixturePackage.version, archivePath: bundlePath });
  verify(bundleVerification.status === 'PASS', `cache bundle verification=${bundleVerification.status}: ${bundleVerification.failures.join('; ')}`);
  const secondBundle = join(fixture, 'bundle-second.zip');
  const second = await acquireDependencyBundle({
    plan,
    lock,
    lockBytes,
    packageVersion: fixturePackage.version,
    policy,
    stagingRoot: staging,
    outputPath: secondBundle,
    fetchTarball: async () => { throw new Error('network should not run for a complete staging area'); }
  });
  verify(second.status === 'PASS' && second.reusedTarballCount === 3 && second.downloadedTarballCount === 0, `second acquisition reuse=${second.reusedTarballCount}/${second.downloadedTarballCount}`);
  verify((await readFile(bundlePath)).equals(await readFile(secondBundle)), 'dependency bundle is not deterministic');

  const cacheRoot = join(fixture, 'imported-cache');
  const imported = await importNpmCacheTransferBundle({ lock, lockBytes, packageVersion: fixturePackage.version, archivePath: bundlePath, targetCacheRoot: cacheRoot });
  verify(imported.status === 'PASS' && imported.importStatus === 'PASS', `bundle import=${imported.status}/${imported.importStatus}`);
  verify(imported.importedTarballCount === 3 && imported.readinessStatus === 'PASS', `imported tarballs/readiness=${imported.importedTarballCount}/${imported.readinessStatus}`);

  const project = join(fixture, 'offline-project');
  await mkdir(project, { recursive: true });
  await writeFile(join(project, 'package.json'), `${JSON.stringify(fixturePackage, null, 2)}\n`);
  await writeFile(join(project, 'package-lock.json'), lockBytes);
  const offline = spawnSync(npmCommand, ['ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', `--cache=${cacheRoot}`], {
    cwd: project,
    encoding: 'utf8',
    shell: false
  });
  verify(offline.status === 0, `offline npm ci failed: ${offline.stderr}`);
  for (const name of names) {
    const installed = JSON.parse(await readFile(join(project, 'node_modules', name, 'package.json'), 'utf8'));
    verify(installed.name === name && installed.version === '1.0.0', `offline installed identity mismatch for ${name}`);
  }

  const badStaging = join(fixture, 'bad-staging');
  let integrityRejected = false;
  try {
    await acquireDependencyBundle({
      plan,
      lock,
      lockBytes,
      packageVersion: fixturePackage.version,
      policy,
      stagingRoot: badStaging,
      outputPath: join(fixture, 'bad-bundle.zip'),
      fetchTarball: async () => Buffer.from('wrong tarball')
    });
  } catch (error) {
    integrityRejected = error.message.includes('integrity mismatch');
  }
  verify(integrityRejected, 'downloaded tarball integrity mismatch was not rejected');

  let originRejected = false;
  try {
    await fetchOfficialNpmTarball({ url: 'https://example.com/not-allowed.tgz', policy });
  } catch (error) {
    originRejected = error.code === 'NON_OFFICIAL_REGISTRY';
  }
  verify(originRejected, 'direct non-official tarball fetch was not rejected before network access');
} catch (error) {
  failures.push(`Unhandled fixture error: ${error.stack ?? error.message}`);
} finally {
  await rm(fixture, { recursive: true, force: true });
}

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  featureBuild: 151,
  stage: 'Bronze RC2 Active Development',
  scope: 'Official npm acquisition plan, integrity-addressed resume, retry, deterministic bundle, cache import and real offline npm ci fixture',
  assertions,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 151 dependency acquisition contract: ${report.status} (${assertions - failures.length}/${assertions}).`);
for (const failure of failures) console.error(`- ${failure}`);
if (failures.length) process.exitCode = 1;
