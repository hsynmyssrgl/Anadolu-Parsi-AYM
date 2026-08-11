import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { acceptNpmCacheTransferBundle } from './lib/npm-cache-bundle-acceptance.mjs';
import { acquireDependencyBundle } from './lib/npm-dependency-acquisition.mjs';
import { createDependencyHandoffRequest, verifyDependencyHandoffRequest } from './lib/npm-dependency-handoff.mjs';
import { readStoredZipEntry } from './lib/deterministic-zip.mjs';
import { verifyNpmCacheTransferBundle } from './lib/npm-cache-transfer.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; const v = args[i + 1]; if (!v || v.startsWith('--')) throw new Error(`${name} requires a value.`); return v; };
const reportPath = resolve(option('--report', 'artifacts/validation/build154-dependency-handoff.json'));
const failures = [];
let assertions = 0;
const verify = (condition, message) => { assertions += 1; if (!condition) failures.push(message); };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sha512 = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const fixture = await mkdtemp(join(tmpdir(), 'ppt-build154-handoff-'));
const exists = async (path) => { try { await stat(path); return true; } catch (error) { if (error?.code === 'ENOENT') return false; throw error; } };

const pack = async (name) => {
  const root = join(fixture, 'packages', name);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, 'package.json'), `${JSON.stringify({ name, version: '1.0.0', main: 'index.js' }, null, 2)}\n`);
  await writeFile(join(root, 'index.js'), `module.exports = ${JSON.stringify(name)};\n`);
  const result = spawnSync(npmCommand, ['pack', '--ignore-scripts', '--json', '--pack-destination', fixture], { cwd: root, encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error(`npm pack failed: ${result.stderr}`);
  return readFile(join(fixture, JSON.parse(result.stdout)[0].filename));
};
const acceptancePolicy = (root) => ({ schemaVersion: 1, maxArchiveBytes: 100_000_000, maxChecksumBytes: 4096, acceptedRoot: join(root, 'accepted'), quarantineRoot: join(root, 'quarantine'), receiptRoot: join(root, 'receipts'), cacheRoot: join(root, 'cache'), requireChecksumSidecar: true, importVerifiedBundle: true, replaceExistingCache: false });

try {
  const names = ['ppt-handoff-a', 'ppt-handoff-b'];
  const tarballs = new Map();
  const lockEntries = {};
  for (const name of names) {
    const bytes = await pack(name);
    const url = `https://registry.npmjs.org/${name}/-/${name}-1.0.0.tgz`;
    tarballs.set(url, bytes);
    lockEntries[`node_modules/${name}`] = { version: '1.0.0', resolved: url, integrity: sha512(bytes), dev: true };
  }
  const dependencies = Object.fromEntries(names.map((name) => [name, '1.0.0']));
  const packageJson = { name: 'ppt-build154-fixture', version: '1.0.0', private: true };
  const lock = { name: packageJson.name, version: packageJson.version, lockfileVersion: 3, requires: true, packages: { '': { name: packageJson.name, version: packageJson.version, devDependencies: dependencies }, ...lockEntries } };
  const lockBytes = Buffer.from(`${JSON.stringify(lock, null, 2)}\n`);
  const policy = { schemaVersion: 1, registry: 'https://registry.npmjs.org/', officialRegistryOnly: true, concurrency: 2, maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, requestTimeoutMs: 30_000, maxTarballBytes: 10_000_000, maxBundleBytes: 100_000_000, retryableHttpStatuses: [408, 429, 500, 502, 503, 504], retryableNetworkCodes: ['EAI_AGAIN'], redirectPolicy: 'SAME_ORIGIN_ONLY', userAgent: 'PPT-Build154-Fixture/1' };
  const policyBytes = Buffer.from(`${JSON.stringify(policy, null, 2)}\n`);
  const runtimePaths = ['scripts/fetch-npm-dependency-acquisition-bundle.mjs', 'scripts/verify-npm-cache-transfer-bundle.mjs', 'scripts/create-file-sha256-sidecar.mjs', 'scripts/lib/npm-dependency-acquisition.mjs', 'scripts/lib/npm-cache-transfer.mjs', 'scripts/lib/npm-offline-cache.mjs', 'scripts/lib/deterministic-zip.mjs', 'scripts/lib/source-manifest.mjs'];
  const requestPath = join(fixture, 'request.zip');
  const request = await createDependencyHandoffRequest({ packageName: packageJson.name, packageVersion: packageJson.version, lockBytes, policyBytes, runtimeRoot: '.', runtimePaths, outputPath: requestPath });
  verify(request.status === 'PASS', `request status=${request.status}`);
  verify(/^[a-f0-9]{64}$/.test(request.requestId), `requestId=${request.requestId}`);
  verify(request.requiredTarballCount === 2, `request tarballs=${request.requiredTarballCount}`);
  verify(request.archiveEntryCount === 16, `request entries=${request.archiveEntryCount}`);
  verify(await exists(requestPath), 'request archive missing');

  const requestVerification = await verifyDependencyHandoffRequest({ archivePath: requestPath, expectedPackageVersion: packageJson.version, expectedLockBytes: lockBytes });
  verify(requestVerification.status === 'PASS', `request verification=${requestVerification.status}: ${requestVerification.failures.join('; ')}`);
  verify(requestVerification.requestId === request.requestId, 'request identity changed during verification');
  verify(requestVerification.plan.handoffRequestId === request.requestId, 'plan is not bound to request identity');
  verify(requestVerification.plan.entries.length === 2, `request plan entries=${requestVerification.plan.entries.length}`);
  verify(readStoredZipEntry(await readFile(requestPath), 'FETCH_DEPENDENCIES.sh').includes(Buffer.from(request.requestId)), 'shell helper does not carry request identity');
  verify(readStoredZipEntry(await readFile(requestPath), 'README_TR.md').includes(Buffer.from(request.requestId)), 'README does not carry request identity');

  const requestSecondPath = join(fixture, 'request-second.zip');
  const requestSecond = await createDependencyHandoffRequest({ packageName: packageJson.name, packageVersion: packageJson.version, lockBytes, policyBytes, runtimeRoot: '.', runtimePaths, outputPath: requestSecondPath });
  verify(requestSecond.requestId === request.requestId, 'deterministic requestId changed');
  verify((await readFile(requestSecondPath)).equals(await readFile(requestPath)), 'request kit is not byte-identical across builds');

  const acquisitionPath = join(fixture, 'response.zip');
  const acquisition = await acquireDependencyBundle({ plan: requestVerification.plan, lockBytes, packageVersion: packageJson.version, policy, stagingRoot: join(fixture, 'staging'), outputPath: acquisitionPath, fetchTarball: async ({ url }) => tarballs.get(url) });
  verify(acquisition.status === 'PASS', `response acquisition=${acquisition.status}: ${(acquisition.failures ?? []).join('; ')}`);
  verify(acquisition.handoffRequestId === request.requestId, `response result request=${acquisition.handoffRequestId}`);
  const responseVerification = await verifyNpmCacheTransferBundle({ lockBytes, packageVersion: packageJson.version, archivePath: acquisitionPath, expectedHandoffRequestId: request.requestId });
  verify(responseVerification.status === 'PASS', `response verification=${responseVerification.status}: ${responseVerification.failures.join('; ')}`);
  verify(responseVerification.handoffRequestId === request.requestId, 'response manifest lost request identity');
  const wrongResponseVerification = await verifyNpmCacheTransferBundle({ lockBytes, packageVersion: packageJson.version, archivePath: acquisitionPath, expectedHandoffRequestId: '0'.repeat(64) });
  verify(wrongResponseVerification.status === 'FAIL' && wrongResponseVerification.failures.some((item) => item.includes('Handoff request mismatch')), 'wrong request identity did not reject response');

  const responseBytes = await readFile(acquisitionPath);
  const checksumPath = `${acquisitionPath}.sha256`;
  await writeFile(checksumPath, `${sha256(responseBytes)}  ${basename(acquisitionPath)}\n`);
  const accepted = await acceptNpmCacheTransferBundle({ archivePath: acquisitionPath, checksumPath, packageVersion: packageJson.version, lockBytes, expectedHandoffRequestId: request.requestId, policy: acceptancePolicy(join(fixture, 'accept-valid')) });
  verify(accepted.status === 'PASS' && accepted.disposition === 'ACCEPTED', `acceptance=${accepted.status}/${accepted.disposition}`);
  verify(accepted.handoffRequestId === request.requestId, `receipt request=${accepted.handoffRequestId}`);
  const pointer = JSON.parse(await readFile(accepted.pointerPath, 'utf8'));
  verify(pointer.handoffRequestId === request.requestId, 'active pointer lost request identity');
  verify(accepted.cacheReadiness.status === 'PASS', `accepted cache readiness=${accepted.cacheReadiness.status}`);

  const wrongAcceptance = await acceptNpmCacheTransferBundle({ archivePath: acquisitionPath, checksumPath, packageVersion: packageJson.version, lockBytes, expectedHandoffRequestId: 'f'.repeat(64), policy: acceptancePolicy(join(fixture, 'accept-wrong')) });
  verify(wrongAcceptance.status === 'FAIL' && wrongAcceptance.classification === 'BUNDLE_VERIFICATION_FAILED', `wrong request acceptance=${wrongAcceptance.status}/${wrongAcceptance.classification}`);
  verify(await exists(wrongAcceptance.quarantineArchivePath), 'wrong-request response was not quarantined');
  verify(wrongAcceptance.failures.some((item) => item.includes('Handoff request mismatch')), 'wrong-request receipt lacks mismatch evidence');

  const tampered = Buffer.from(await readFile(requestPath));
  tampered[Math.max(0, tampered.length - 25)] ^= 0xff;
  const tamperedVerification = await verifyDependencyHandoffRequest({ archiveBytes: tampered, expectedPackageVersion: packageJson.version, expectedLockBytes: lockBytes });
  verify(tamperedVerification.status === 'FAIL', 'tampered request kit was accepted');
  const wrongLock = Buffer.from(lockBytes); wrongLock[wrongLock.length - 2] ^= 1;
  const wrongLockVerification = await verifyDependencyHandoffRequest({ archivePath: requestPath, expectedPackageVersion: packageJson.version, expectedLockBytes: wrongLock });
  verify(wrongLockVerification.status === 'FAIL' && wrongLockVerification.failures.some((item) => item.includes('expected active lockfile')), 'request kit accepted against wrong active lockfile');
  const wrongVersionVerification = await verifyDependencyHandoffRequest({ archivePath: requestPath, expectedPackageVersion: '1.0.1', expectedLockBytes: lockBytes });
  verify(wrongVersionVerification.status === 'FAIL' && wrongVersionVerification.failures.some((item) => item.includes('Package version mismatch')), 'request kit accepted against wrong package version');
} catch (error) {
  failures.push(`Unhandled fixture error: ${error.stack ?? error.message}`);
} finally {
  await rm(fixture, { recursive: true, force: true });
}

const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', featureBuild: 154, stage: 'Bronze RC2 Active Development', scope: 'Deterministic dependency handoff request kit and cryptographic request-response-acceptance traceability', assertions, status: failures.length === 0 ? 'PASS' : 'FAIL', failures, generatedAt: new Date().toISOString() };
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 154 dependency handoff contract: ${report.status} (${assertions - failures.length}/${assertions}).`);
for (const failure of failures) console.error(`- ${failure}`);
if (failures.length) process.exitCode = 1;
