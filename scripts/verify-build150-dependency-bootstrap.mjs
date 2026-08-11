import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createNpmCacheTransferBundle } from './lib/npm-cache-transfer.mjs';
import { npmCacheContentPath } from './lib/npm-offline-cache.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const reportPath = resolve(option('--report', 'artifacts/validation/build150-dependency-bootstrap-contract.json'));
const repositoryRoot = resolve(import.meta.dirname, '..');
let assertions = 0;
const failures = [];
const verify = (condition, message) => { assertions += 1; if (!condition) failures.push(message); };
const integrity = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
const cacheIndexPath = (cacheRoot, key) => {
  const digest = createHash('sha256').update(key).digest('hex');
  return join(cacheRoot, '_cacache', 'index-v5', digest.slice(0, 2), digest.slice(2, 4), digest.slice(4));
};

const fixture = await mkdtemp(join(tmpdir(), 'ppt-build150-bootstrap-'));
try {
  const packageSource = join(fixture, 'fixture-package');
  await mkdir(packageSource, { recursive: true });
  await writeFile(join(packageSource, 'package.json'), `${JSON.stringify({
    name: 'ppt-bootstrap-fixture',
    version: '1.0.0',
    main: 'index.js',
    license: 'UNLICENSED'
  }, null, 2)}\n`);
  await writeFile(join(packageSource, 'index.js'), "module.exports = 'bootstrap-ok';\n");
  const pack = spawnSync('npm', ['pack', packageSource, '--pack-destination', fixture, '--ignore-scripts', '--json'], {
    cwd: fixture,
    encoding: 'utf8',
    shell: false
  });
  verify(pack.status === 0, `fixture npm pack failed: ${pack.stderr}`);
  const packed = pack.status === 0 ? JSON.parse(pack.stdout)[0] : undefined;
  const tarballPath = packed ? join(fixture, packed.filename) : undefined;
  const tarball = tarballPath ? await readFile(tarballPath) : Buffer.alloc(0);
  const tarballIntegrity = integrity(tarball);
  const tarballUrl = 'https://registry.npmjs.org/ppt-bootstrap-fixture/-/ppt-bootstrap-fixture-1.0.0.tgz';

  const project = join(fixture, 'project');
  await mkdir(project, { recursive: true });
  const projectPackage = {
    name: 'ppt-bootstrap-project',
    version: '1.0.0',
    private: true,
    dependencies: { 'ppt-bootstrap-fixture': '1.0.0' }
  };
  const lock = {
    name: projectPackage.name,
    version: projectPackage.version,
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': { name: projectPackage.name, version: projectPackage.version, dependencies: projectPackage.dependencies },
      'node_modules/ppt-bootstrap-fixture': {
        version: '1.0.0',
        resolved: tarballUrl,
        integrity: tarballIntegrity,
        license: 'UNLICENSED'
      }
    }
  };
  const lockBytes = Buffer.from(`${JSON.stringify(lock, null, 2)}\n`);
  await writeFile(join(project, 'package.json'), `${JSON.stringify(projectPackage, null, 2)}\n`);
  await writeFile(join(project, 'package-lock.json'), lockBytes);

  const sourceCache = join(fixture, 'source-cache');
  const contentPath = npmCacheContentPath(sourceCache, tarballIntegrity);
  await mkdir(dirname(contentPath), { recursive: true });
  await writeFile(contentPath, tarball);
  const key = `make-fetch-happen:request-cache:${tarballUrl}`;
  const indexPath = cacheIndexPath(sourceCache, key);
  await mkdir(dirname(indexPath), { recursive: true });
  await writeFile(indexPath, `\n${'0'.repeat(40)}\t${JSON.stringify({ key, integrity: tarballIntegrity, time: 1, size: tarball.length })}`);

  const bundlePath = join(fixture, 'dependency-cache.zip');
  const bundle = await createNpmCacheTransferBundle({
    lock,
    lockBytes,
    packageVersion: projectPackage.version,
    cacheRoot: sourceCache,
    outputPath: bundlePath
  });
  verify(bundle.status === 'PASS', `fixture bundle status=${bundle.status}`);
  verify(bundle.archiveCreated === true, 'fixture dependency bundle was not created');
  verify(bundle.includedTarballCount === 1, `fixture bundle tarball count=${bundle.includedTarballCount}`);

  const policyPath = join(fixture, 'policy.json');
  await writeFile(policyPath, `${JSON.stringify({
    schemaVersion: 2,
    registry: 'https://registry.npmjs.org/',
    maxAttempts: 1,
    baseDelayMs: 0,
    maxDelayMs: 0,
    retryableHttpStatuses: [408, 429, 500, 502, 503, 504],
    retryableNetworkCodes: ['EAI_AGAIN'],
    attemptTimeoutMs: 30_000,
    offlineCache: { enabled: true, attemptWhenComplete: true, preferOfflineForOnlineAttempts: true },
    ignoreScripts: true
  }, null, 2)}\n`);
  const bootstrapReport = join(fixture, 'bootstrap-report.json');
  const run = spawnSync(process.execPath, [
    join(repositoryRoot, 'scripts/run-clean-npm-ci.mjs'),
    '--policy', policyPath,
    '--report', bootstrapReport,
    '--cache-bundle', bundlePath
  ], {
    cwd: project,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, PPT_NPM_CI_ATTEMPT_TIMEOUT_OVERRIDE_MS: '30000' }
  });
  verify(run.status === 0, `offline bootstrap runner failed: ${run.stderr}`);
  const evidence = JSON.parse(await readFile(bootstrapReport, 'utf8'));
  verify(evidence.status === 'PASS', `bootstrap evidence status=${evidence.status}`);
  verify(evidence.classification === 'NONE', `bootstrap classification=${evidence.classification}`);
  verify(evidence.installMode === 'VERIFIED_OFFLINE_CACHE', `bootstrap mode=${evidence.installMode}`);
  verify(evidence.cacheBundleImport?.status === 'PASS', `bundle import=${evidence.cacheBundleImport?.status}`);
  verify(evidence.offlineCacheReadiness?.status === 'PASS', `cache readiness=${evidence.offlineCacheReadiness?.status}`);
  verify(evidence.offlineAttempt?.status === 'PASS', `offline attempt=${evidence.offlineAttempt?.status}`);
  verify(evidence.requestedArgs?.includes('--offline'), 'offline npm ci flag missing');
  verify(evidence.requestedArgs?.includes('--ignore-scripts'), 'ignore-scripts policy missing');
  verify(!evidence.attempts?.some((attempt) => attempt.mode === 'OFFICIAL_REGISTRY_ONLINE'), 'online fallback ran despite complete verified cache');
  verify((await stat(join(project, 'node_modules/ppt-bootstrap-fixture/package.json'))).isFile(), 'fixture dependency was not installed');
  const installed = JSON.parse(await readFile(join(project, 'node_modules/ppt-bootstrap-fixture/package.json'), 'utf8'));
  verify(installed.name === 'ppt-bootstrap-fixture' && installed.version === '1.0.0', 'installed fixture identity mismatch');

  const alteredLock = structuredClone(lock);
  alteredLock.packages[''].version = '1.0.1';
  const alteredProject = join(fixture, 'altered-project');
  await mkdir(alteredProject, { recursive: true });
  await writeFile(join(alteredProject, 'package.json'), `${JSON.stringify({ ...projectPackage, version: '1.0.1' }, null, 2)}\n`);
  await writeFile(join(alteredProject, 'package-lock.json'), `${JSON.stringify(alteredLock, null, 2)}\n`);
  const rejectedReport = join(fixture, 'rejected-report.json');
  const rejected = spawnSync(process.execPath, [
    join(repositoryRoot, 'scripts/run-clean-npm-ci.mjs'),
    '--policy', policyPath,
    '--report', rejectedReport,
    '--cache-bundle', bundlePath
  ], { cwd: alteredProject, encoding: 'utf8', shell: false });
  verify(rejected.status !== 0, 'mismatched dependency bundle was accepted');
  const rejection = JSON.parse(await readFile(rejectedReport, 'utf8'));
  verify(rejection.classification === 'CACHE_BUNDLE_REJECTED', `rejection classification=${rejection.classification}`);
  verify(rejection.cacheBundleImport?.status === 'FAIL', `rejection import status=${rejection.cacheBundleImport?.status}`);
} finally {
  await rm(fixture, { recursive: true, force: true });
}

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  featureBuild: 150,
  stage: 'Bronze RC2 Active Development',
  scope: 'Verified cache bundle import, offline npm ci, scripts-disabled installation and lock/package mismatch rejection',
  assertions,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 150 dependency bootstrap contract: ${report.status} (${assertions - failures.length}/${assertions}).`);
for (const failure of failures) console.error(`- ${failure}`);
if (failures.length) process.exitCode = 1;
