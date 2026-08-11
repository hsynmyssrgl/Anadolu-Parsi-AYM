import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { assessNpmOfflineCache, npmCacheContentPath } from './lib/npm-offline-cache.mjs';

let checks = 0;
const failures = [];
const verify = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha512 = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;

const packageJson = await readJson('package.json');
const policy = await readJson('config/npm-ci-policy.json');
const contract = await readJson('config/delivery-attestation-contract.json');
const runner = await readFile('scripts/run-clean-npm-ci.mjs', 'utf8');
const helper = await readFile('scripts/lib/npm-offline-cache.mjs', 'utf8');
const verifier = await readFile('scripts/verify-npm-offline-cache-readiness.mjs', 'utf8');
const ci = await readFile('.github/workflows/ci.yml', 'utf8');
const windows = await readFile('.github/workflows/windows-rc2-validation.yml', 'utf8');

verify(packageJson.version === '25.7.2026-116', `package version=${packageJson.version}`);
verify(packageJson.scripts?.['verify:npm-offline-cache'] === 'node scripts/verify-npm-offline-cache-readiness.mjs', 'offline cache script missing');
verify(packageJson.scripts?.['verify:build116:architecture'] === 'node scripts/verify-build116-architecture.mjs', 'build116 script missing');
verify(policy.schemaVersion === 2, `policy schema=${policy.schemaVersion}`);
verify(policy.registry === 'https://registry.npmjs.org/', `registry=${policy.registry}`);
verify(policy.offlineCache?.enabled === true, 'offline cache policy disabled');
verify(policy.offlineCache?.attemptWhenComplete === true, 'offline first policy disabled');
verify(policy.offlineCache?.preferOfflineForOnlineAttempts === true, 'prefer-offline policy disabled');
verify(contract.evidence?.length === 13, `attestation evidence count=${contract.evidence?.length}`);
verify(contract.evidence?.some((item) => item.id === 'npm-offline-cache-readiness' && item.expectedStatus === 'INCOMPLETE'), 'offline readiness evidence missing');
verify(contract.evidence?.some((item) => item.id === 'build116-architecture'), 'Build 116 attestation evidence missing');
for (const marker of ['--offline', '--prefer-offline', 'offlineCacheReadiness', 'VERIFIED_OFFLINE_CACHE', 'cleanupBeforeOnline']) verify(runner.includes(marker), `runner marker missing=${marker}`);
for (const marker of ['INDEX_MISSING', 'CONTENT_HASH_MISMATCH', 'officialRegistryOnly', 'make-fetch-happen:request-cache:', 'PPT_NPM_CACHE_PATH']) verify(helper.includes(marker), `helper marker missing=${marker}`);
verify(verifier.includes('npm-offline-cache-readiness.json'), 'readiness report path missing');
verify(ci.includes('ci-npm-offline-cache-readiness.json'), 'Linux CI offline cache evidence missing');
verify(windows.includes('npm-offline-cache-readiness.json'), 'Windows workflow offline cache evidence missing');

const fixture = await mkdtemp(join(tmpdir(), 'ppt-build116-cache-'));
try {
  const cacheRoot = join(fixture, 'cache');
  const bodyA = Buffer.from('package-a');
  const bodyB = Buffer.from('package-b');
  const integrityA = sha512(bodyA);
  const integrityB = sha512(bodyB);
  const urlA = 'https://registry.npmjs.org/package-a/-/package-a-1.0.0.tgz';
  const urlB = 'https://registry.npmjs.org/package-b/-/package-b-1.0.0.tgz';
  const lock = { packages: {
    'node_modules/package-a': { resolved: urlA, integrity: integrityA },
    'node_modules/package-b': { resolved: urlB, integrity: integrityB }
  }};
  const indexPath = join(cacheRoot, '_cacache/index-v5/aa/bb/fixture');
  await mkdir(dirname(indexPath), { recursive: true });
  const records = [
    { key: `make-fetch-happen:request-cache:${urlA}`, integrity: integrityA, time: 1, size: bodyA.length },
    { key: `make-fetch-happen:request-cache:${urlB}`, integrity: integrityB, time: 2, size: bodyB.length }
  ];
  await writeFile(indexPath, records.map((record, index) => `${String(index).padStart(40, '0')}\t${JSON.stringify(record)}`).join('\n') + '\n');
  for (const [body, integrity] of [[bodyA, integrityA], [bodyB, integrityB]]) {
    const contentPath = npmCacheContentPath(cacheRoot, integrity);
    await mkdir(dirname(contentPath), { recursive: true });
    await writeFile(contentPath, body);
  }
  const complete = await assessNpmOfflineCache({ lock, cacheRoot });
  verify(complete.status === 'PASS', `complete status=${complete.status}`);
  verify(complete.requiredTarballCount === 2, `required count=${complete.requiredTarballCount}`);
  verify(complete.readyTarballCount === 2, `ready count=${complete.readyTarballCount}`);
  verify(complete.missingOrInvalidTarballCount === 0, `missing count=${complete.missingOrInvalidTarballCount}`);
  verify(complete.entries.length === 0, `ready entries leaked=${complete.entries.length}`);

  await writeFile(indexPath, `${'0'.repeat(40)}\t${JSON.stringify(records[0])}\n`);
  const missing = await assessNpmOfflineCache({ lock, cacheRoot });
  verify(missing.status === 'INCOMPLETE', `missing status=${missing.status}`);
  verify(missing.readyTarballCount === 1, `missing ready count=${missing.readyTarballCount}`);
  verify(missing.reasonCounts.INDEX_MISSING === 1, `index missing count=${missing.reasonCounts.INDEX_MISSING}`);
  verify(missing.entries[0]?.url === urlB, `missing url=${missing.entries[0]?.url}`);

  await writeFile(indexPath, records.map((record, index) => `${String(index).padStart(40, '0')}\t${JSON.stringify(record)}`).join('\n') + '\n');
  await writeFile(npmCacheContentPath(cacheRoot, integrityB), Buffer.from('tampered-b'));
  const corrupt = await assessNpmOfflineCache({ lock, cacheRoot });
  verify(corrupt.status === 'INCOMPLETE', `corrupt status=${corrupt.status}`);
  verify(corrupt.reasonCounts.SIZE_MISMATCH === 1 || corrupt.reasonCounts.CONTENT_HASH_MISMATCH === 1, `corrupt reason=${JSON.stringify(corrupt.reasonCounts)}`);

  let rejected = false;
  try {
    await assessNpmOfflineCache({ lock: { packages: { 'node_modules/x': { resolved: 'https://example.invalid/x.tgz', integrity: integrityA } } }, cacheRoot });
  } catch (error) {
    rejected = /Non-official registry origin/.test(error.message);
  }
  verify(rejected, 'non-official registry was accepted');
} finally {
  await rm(fixture, { recursive: true, force: true });
}

const actual = await readJson('artifacts/validation/npm-offline-cache-readiness.json');
verify(actual.status === 'INCOMPLETE' || actual.status === 'PASS', `actual readiness status=${actual.status}`);
verify(actual.officialRegistryOnly === true, 'actual readiness registry policy missing');
verify(actual.requiredTarballCount > 0, `actual required count=${actual.requiredTarballCount}`);
verify(actual.readyTarballCount <= actual.requiredTarballCount, 'actual ready count exceeds required');

const evidence = {
  schemaVersion: 1,
  product: 'Panthera pardus tulliana Aile',
  applicationVersion: '25.07.2026.116',
  packageVersion: packageJson.version,
  build: 116,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checks,
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build116-architecture.json', `${JSON.stringify(evidence, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`Build 116 architecture validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 116 architecture verified: ${checks} assertions.`);
