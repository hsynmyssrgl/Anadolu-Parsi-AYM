import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { acquireDependencyBundle, createDependencyAcquisitionPlan } from './lib/npm-dependency-acquisition.mjs';
import { acceptNpmCacheTransferBundle } from './lib/npm-cache-bundle-acceptance.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const reportPath = resolve(option('--report', 'artifacts/validation/build153-accepted-cache-validation-contract.json'));
const failures = [];
let assertions = 0;
const verify = (condition, message) => { assertions += 1; if (!condition) failures.push(message); };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sha512 = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const fixture = await mkdtemp(join(tmpdir(), 'ppt-build153-orchestrator-'));
const orchestrator = resolve('scripts/run-accepted-cache-rc2-validation.mjs');
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

const writeRunner = async ({ path, mode, markerPath }) => {
  const results = [
    ['source-preflight', 'source-preflight'], ['clean-npm-ci', 'dependency-bootstrap'], ['tsc-no-emit', 'compile'],
    ['unit-tests', 'test'], ['electron-production-build', 'build'], ['smoke-tests', 'smoke'],
    ['windows-real-launch', 'windows-runtime'], ['windows-installer', 'windows-installer']
  ].map(([id, phase], index) => {
    if (mode === 'platform-pass' && index >= 6) return { id, phase, status: 'NOT_RUN', reason: `Platform ${process.platform} is not eligible; required: win32.` };
    if (mode === 'fail' && id === 'unit-tests') return { id, phase, status: 'FAIL', reason: 'FIXTURE_FAILURE' };
    return { id, phase, status: 'PASS' };
  });
  const source = `
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const args = process.argv.slice(2);
const option = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const reportPath = resolve(option('--report'));
const archive = process.env.PPT_NPM_CACHE_BUNDLE;
const receipt = process.env.PPT_NPM_CACHE_ACCEPTANCE_RECEIPT;
if (!archive || !receipt) throw new Error('accepted cache environment was not propagated');
if (!(await stat(archive)).isFile() || !(await stat(receipt)).isFile()) throw new Error('accepted artifacts are missing');
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(${JSON.stringify(markerPath)}, JSON.stringify({ archive, receipt }) + '\\n');
const results = ${JSON.stringify(results)};
const report = { schemaVersion: 4, stage: 'Bronze RC2 Active Development', platform: process.platform, nodeVersion: process.version, sourcePreflightStatus: results[0].status, dependencyBootstrapStatus: results[1].status, overallStatus: results.every((x) => x.status === 'PASS') ? 'PASS' : 'INCOMPLETE', results };
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\\n');
${mode === 'fail' ? 'process.exitCode = 1;' : ''}
`;
  await writeFile(path, source);
};

try {
  const project = join(fixture, 'project');
  await mkdir(project, { recursive: true });
  const names = ['ppt-orchestrator-a', 'ppt-orchestrator-b'];
  const tarballByUrl = new Map();
  const lockEntries = {};
  for (const name of names) {
    const bytes = await createPackedPackage(name);
    const url = `https://registry.npmjs.org/${name}/-/${name}-1.0.0.tgz`;
    tarballByUrl.set(url, bytes);
    lockEntries[`node_modules/${name}`] = { version: '1.0.0', resolved: url, integrity: sha512(bytes), dev: true };
  }
  const dependencies = Object.fromEntries(names.map((name) => [name, '1.0.0']));
  const packageJson = { name: 'ppt-build153-fixture', version: '1.0.0', private: true, devDependencies: dependencies };
  const lock = { name: packageJson.name, version: packageJson.version, lockfileVersion: 3, requires: true, packages: { '': { name: packageJson.name, version: packageJson.version, devDependencies: dependencies }, ...lockEntries } };
  const lockBytes = Buffer.from(`${JSON.stringify(lock, null, 2)}\n`);
  await writeFile(join(project, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  await writeFile(join(project, 'package-lock.json'), lockBytes);
  const plan = await createDependencyAcquisitionPlan({ lock, lockBytes, packageVersion: packageJson.version });
  const bundlePath = join(project, 'incoming.zip');
  const acquisition = await acquireDependencyBundle({
    plan, lock, lockBytes, packageVersion: packageJson.version,
    policy: {
      schemaVersion: 1, registry: 'https://registry.npmjs.org/', officialRegistryOnly: true, concurrency: 2, maxAttempts: 1,
      baseDelayMs: 0, maxDelayMs: 0, requestTimeoutMs: 30_000, maxTarballBytes: 10_000_000, maxBundleBytes: 100_000_000,
      retryableHttpStatuses: [408, 429, 500, 502, 503, 504], retryableNetworkCodes: ['EAI_AGAIN'], redirectPolicy: 'SAME_ORIGIN_ONLY', userAgent: 'PPT-Build153-Fixture/1'
    },
    stagingRoot: join(project, 'staging'), outputPath: bundlePath, fetchTarball: async ({ url }) => tarballByUrl.get(url)
  });
  verify(acquisition.status === 'PASS', `acquisition=${acquisition.status}`);
  const bundleBytes = await readFile(bundlePath);
  const bundleChecksumPath = `${bundlePath}.sha256`;
  await writeFile(bundleChecksumPath, `${sha256(bundleBytes)}  ${basename(bundlePath)}\n`);
  const acceptancePolicy = {
    schemaVersion: 1, maxArchiveBytes: 100_000_000, maxChecksumBytes: 4096,
    acceptedRoot: join(project, 'accepted'), quarantineRoot: join(project, 'quarantine'), receiptRoot: join(project, 'receipts'), cacheRoot: join(project, 'cache'),
    requireChecksumSidecar: true, importVerifiedBundle: true, replaceExistingCache: false
  };
  await mkdir(join(project, 'config'), { recursive: true });
  await writeFile(join(project, 'config', 'acceptance.json'), `${JSON.stringify(acceptancePolicy, null, 2)}\n`);
  const accepted = await acceptNpmCacheTransferBundle({ archivePath: bundlePath, checksumPath: bundleChecksumPath, packageVersion: packageJson.version, lockBytes, policy: acceptancePolicy });
  verify(accepted.status === 'PASS' && accepted.cacheReadiness?.status === 'PASS', `acceptance=${accepted.status}/${accepted.cacheReadiness?.status}`);
  const dummyGateConfig = join(project, 'config', 'gates.json');
  await writeFile(dummyGateConfig, '{}\n');

  const runScenario = async ({ name, mode }) => {
    const runner = join(project, `${name}-runner.mjs`);
    const marker = join(project, `${name}-runner-marker.json`);
    const gateReport = join(project, `${name}-gate-report.json`);
    const orchestrationReport = join(project, `${name}-orchestration-report.json`);
    await writeRunner({ path: runner, mode, markerPath: marker });
    const policy = {
      schemaVersion: 1,
      acceptancePolicyPath: 'config/acceptance.json', validationGatesPath: 'config/gates.json', gateRunnerScript: runner,
      gateReportPath: gateReport, acceptedBundleEnvironmentVariable: 'PPT_NPM_CACHE_BUNDLE', acceptedReceiptEnvironmentVariable: 'PPT_NPM_CACHE_ACCEPTANCE_RECEIPT',
      requireCompleteImportedCache: true, verifyBundlePayloadBeforeGates: true, runnerTimeoutMs: 120_000
    };
    const policyPath = join(project, `${name}-policy.json`);
    await writeFile(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
    const run = spawnSync(process.execPath, [orchestrator, '--project-root', project, '--policy', policyPath, '--report', orchestrationReport], { cwd: resolve('.'), encoding: 'utf8', shell: false });
    return { run, report: JSON.parse(await readFile(orchestrationReport, 'utf8')), marker, gateReport };
  };

  const platformPass = await runScenario({ name: 'platform-pass', mode: 'platform-pass' });
  verify(platformPass.run.status === 0, `platform-pass exit=${platformPass.run.status}: ${platformPass.run.stderr}`);
  verify(platformPass.report.status === 'PASS' && platformPass.report.platformValidationStatus === 'PASS', `platform status=${platformPass.report.status}/${platformPass.report.platformValidationStatus}`);
  verify(platformPass.report.releaseReadinessStatus === 'INCOMPLETE', `platform release=${platformPass.report.releaseReadinessStatus}`);
  verify(platformPass.report.acceptedCacheValidation?.classification === 'ACCEPTED_CACHE_VERIFIED_FOR_RC2', `validation classification=${platformPass.report.acceptedCacheValidation?.classification}`);
  verify(platformPass.report.acceptedCacheValidation?.verifiedTarballCount === 2, `verified tarballs=${platformPass.report.acceptedCacheValidation?.verifiedTarballCount}`);
  verify(await exists(platformPass.marker) && await exists(platformPass.gateReport), 'platform runner evidence missing');
  const propagated = JSON.parse(await readFile(platformPass.marker, 'utf8'));
  verify(propagated.archive === accepted.acceptedArchivePath && propagated.receipt === accepted.receiptPath, 'accepted artifact environment mismatch');

  const fullPass = await runScenario({ name: 'full-pass', mode: 'full-pass' });
  verify(fullPass.run.status === 0 && fullPass.report.releaseReadinessStatus === 'PASS', `full pass=${fullPass.run.status}/${fullPass.report.releaseReadinessStatus}`);
  verify(fullPass.report.gateReport?.results?.every((item) => item.status === 'PASS'), 'full-pass gate results are not all PASS');

  const gateFail = await runScenario({ name: 'gate-fail', mode: 'fail' });
  verify(gateFail.run.status !== 0, 'gate failure did not fail the orchestrator');
  verify(gateFail.report.status === 'FAIL' && gateFail.report.gatesStarted === true, `gate fail report=${gateFail.report.status}/${gateFail.report.gatesStarted}`);
  verify(gateFail.report.classification === 'GATE_RUNNER_FAILED', `gate fail classification=${gateFail.report.classification}`);

  const pointerPath = join(project, 'receipts', 'current-accepted.json');
  const originalPointer = await readFile(pointerPath);
  const tamperedPointer = JSON.parse(originalPointer.toString('utf8'));
  tamperedPointer.receiptSha256 = '0'.repeat(64);
  await writeFile(pointerPath, `${JSON.stringify(tamperedPointer, null, 2)}\n`);
  const blockedRunner = join(project, 'blocked-runner.mjs');
  const blockedMarker = join(project, 'blocked-marker');
  await writeFile(blockedRunner, `import { writeFile } from 'node:fs/promises'; await writeFile(${JSON.stringify(blockedMarker)}, 'ran'); process.exitCode = 99;\n`);
  const blockedPolicy = {
    schemaVersion: 1, acceptancePolicyPath: 'config/acceptance.json', validationGatesPath: 'config/gates.json', gateRunnerScript: blockedRunner,
    gateReportPath: join(project, 'blocked-gate-report.json'), acceptedBundleEnvironmentVariable: 'PPT_NPM_CACHE_BUNDLE', acceptedReceiptEnvironmentVariable: 'PPT_NPM_CACHE_ACCEPTANCE_RECEIPT',
    requireCompleteImportedCache: true, verifyBundlePayloadBeforeGates: true, runnerTimeoutMs: 120_000
  };
  const blockedPolicyPath = join(project, 'blocked-policy.json');
  const blockedReportPath = join(project, 'blocked-report.json');
  await writeFile(blockedPolicyPath, `${JSON.stringify(blockedPolicy, null, 2)}\n`);
  const blocked = spawnSync(process.execPath, [orchestrator, '--project-root', project, '--policy', blockedPolicyPath, '--report', blockedReportPath], { cwd: resolve('.'), encoding: 'utf8', shell: false });
  const blockedReport = JSON.parse(await readFile(blockedReportPath, 'utf8'));
  verify(blocked.status !== 0 && blockedReport.gatesStarted === false, `tampered pointer did not block gates=${blocked.status}/${blockedReport.gatesStarted}`);
  verify(blockedReport.classification === 'RECEIPT_SHA256_MISMATCH', `tampered pointer classification=${blockedReport.classification}`);
  verify(!(await exists(blockedMarker)), 'gate runner executed after pointer tamper');
  await writeFile(pointerPath, originalPointer);

  const archiveBytes = await readFile(accepted.acceptedArchivePath);
  const tamperedArchive = Buffer.from(archiveBytes);
  tamperedArchive[Math.max(0, tamperedArchive.length - 20)] ^= 0xff;
  await writeFile(accepted.acceptedArchivePath, tamperedArchive);
  const archiveBlockedReport = join(project, 'archive-blocked-report.json');
  const archiveBlocked = spawnSync(process.execPath, [orchestrator, '--project-root', project, '--policy', blockedPolicyPath, '--report', archiveBlockedReport], { cwd: resolve('.'), encoding: 'utf8', shell: false });
  const archiveBlockedJson = JSON.parse(await readFile(archiveBlockedReport, 'utf8'));
  verify(archiveBlocked.status !== 0 && archiveBlockedJson.gatesStarted === false, 'tampered archive did not block gates');
  verify(archiveBlockedJson.classification === 'ACCEPTED_ARCHIVE_SHA256_MISMATCH', `tampered archive classification=${archiveBlockedJson.classification}`);
  verify(!(await exists(blockedMarker)), 'gate runner executed after archive tamper');
} catch (error) {
  failures.push(`Unhandled fixture error: ${error.stack ?? error.message}`);
} finally {
  await rm(fixture, { recursive: true, force: true });
}

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  featureBuild: 153,
  stage: 'Bronze RC2 Active Development',
  scope: 'Accepted npm cache pointer/receipt/archive/cache revalidation and fail-closed RC2 gate orchestration',
  assertions,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 153 accepted-cache validation contract: ${report.status} (${assertions - failures.length}/${assertions}).`);
for (const failure of failures) console.error(`- ${failure}`);
if (failures.length) process.exitCode = 1;
