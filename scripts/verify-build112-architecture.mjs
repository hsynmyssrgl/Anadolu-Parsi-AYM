import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  generateSourceManifest,
  normalizeSourcePath,
  parseSha256Sums,
  SOURCE_MANIFEST_SCHEMA_VERSION,
  verifySourceManifestIntegrity
} from './lib/source-manifest.mjs';
import { runNpmCiWithRetry } from './lib/clean-npm-ci.mjs';

const expectedDisplayVersion = '25.07.2026.112';
const expectedPackageVersion = '25.7.2026-112';
const expectedBuild = 112;
const failures = [];
let checks = 0;
const verify = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const temporaryRoot = await mkdtemp(join(tmpdir(), 'ppt-build112-verification-'));
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const waitForFile = async (path, timeoutMs = 5_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { await stat(path); return true; } catch { await sleep(50); }
  }
  return false;
};
const processIsAlive = async (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  if (process.platform === 'linux') {
    try {
      const state = (await readFile(`/proc/${pid}/stat`, 'utf8')).split(' ')[2];
      return state !== 'Z';
    } catch { return false; }
  }
  try { process.kill(pid, 0); return true; } catch { return false; }
};

try {
  const rootManifest = await readJson('package.json');
  verify(rootManifest.version === expectedPackageVersion, `root package version=${rootManifest.version}`);
  verify(rootManifest.scripts?.manifest === 'node scripts/generate-manifest.mjs', 'manifest generator script is missing');
  verify(rootManifest.scripts?.['verify:source-integrity'] === 'node scripts/verify-source-integrity.mjs', 'source integrity script is missing');
  verify(rootManifest.scripts?.['verify:source-preflight'] === 'node scripts/run-source-preflight.mjs', 'source preflight script is missing');
  verify(rootManifest.scripts?.['verify:build112:architecture'] === 'node scripts/verify-build112-architecture.mjs', 'Build 112 verifier is missing');

  const appMeta = await readFile('packages/domain/src/app-meta.ts', 'utf8');
  verify(appMeta.includes(`version: '${expectedDisplayVersion}'`), 'APP_META display version mismatch');
  verify(appMeta.includes(`packageVersion: '${expectedPackageVersion}'`), 'APP_META package version mismatch');
  verify(appMeta.includes(`Build ${expectedBuild}`), 'APP_META build mismatch');

  const sourceLibrary = await readFile('scripts/lib/source-manifest.mjs', 'utf8');
  for (const marker of [
    'SOURCE_MANIFEST_SCHEMA_VERSION = 3',
    "SOURCE_MANIFEST_FILE = 'manifest.json'",
    "SOURCE_SHA256_FILE = 'SHA256SUMS.txt'",
    "excludedRelativeDirectories = new Set(['artifacts/validation'])",
    'Symbolic links are not allowed in source delivery',
    'Source path escapes repository root',
    'manifest must not include self-managed file',
    'source tree contains unmanifested file',
    'SHA256SUMS.txt must not contain a hash for itself',
    'generateSourceManifest',
    'verifySourceManifestIntegrity'
  ]) verify(sourceLibrary.includes(marker), `source manifest library marker missing=${marker}`);

  const generatorSource = await readFile('scripts/generate-manifest.mjs', 'utf8');
  verify(generatorSource.includes("from './lib/source-manifest.mjs'"), 'manifest generator does not use shared source-manifest library');
  verify(generatorSource.includes('generateSourceManifest'), 'manifest generator does not call shared generator');
  verify(generatorSource.includes('SHA256SUMS.txt oluşturuldu'), 'manifest generator does not report SHA256SUMS output');
  verify(!generatorSource.includes("const excluded = new Set"), 'manifest generator still owns a duplicate exclusion policy');

  const verifierSource = await readFile('scripts/verify-source-integrity.mjs', 'utf8');
  verify(verifierSource.includes('verifySourceManifestIntegrity'), 'source integrity wrapper does not call shared verifier');
  verify(verifierSource.includes("artifacts/validation/source-integrity.json"), 'source integrity default evidence path is missing');
  verify(verifierSource.includes("if (report.status !== 'PASS') process.exitCode = 1"), 'source integrity failure does not set non-zero exit');

  const preflightConfig = await readJson('config/source-preflight-checks.json');
  verify(preflightConfig.schemaVersion === 1, `source preflight schema=${preflightConfig.schemaVersion}`);
  verify(preflightConfig.stage === 'Bronze RC2 Active Development', `source preflight stage=${preflightConfig.stage}`);
  verify(preflightConfig.checks?.length === 6, `source preflight check count=${preflightConfig.checks?.length}`);
  verify(preflightConfig.checks?.[0]?.id === 'source-integrity', `first source preflight check=${preflightConfig.checks?.[0]?.id}`);
  verify(preflightConfig.checks?.[0]?.script === 'scripts/verify-source-integrity.mjs', `source integrity script=${preflightConfig.checks?.[0]?.script}`);
  verify(preflightConfig.checks?.[0]?.args?.includes('artifacts/validation/source-integrity.json'), 'source integrity evidence path missing from preflight config');
  verify(new Set(preflightConfig.checks.map((check) => check.id)).size === preflightConfig.checks.length, 'source preflight check IDs are not unique');
  verify(preflightConfig.checks.every((check) => check.script.startsWith('scripts/') && check.script.endsWith('.mjs')), 'source preflight contains an unsafe script path');
  verify(preflightConfig.checks.every((check) => !check.script.includes('npm')), 'source preflight script path contains npm');

  const activeContractSource = await readFile('scripts/verify-active-version-contract.mjs', 'utf8');
  verify(activeContractSource.includes('sourceManifest.schemaVersion === 3'), 'active version contract does not require manifest schema 3');
  verify(activeContractSource.includes('sourceManifest.fileCount === sourceManifest.files?.length'), 'active version contract does not validate manifest fileCount');

  const cleanRunnerSource = await readFile('scripts/run-clean-npm-ci.mjs', 'utf8');
  for (const marker of [
    'let currentAttemptChild = null',
    'let interruptedSignal = null',
    "process.once('SIGINT'",
    "process.once('SIGTERM'",
    'terminateProcessTree(interruptedChild, false)',
    'interrupted: Boolean(interruptedSignal)',
    'interruptedSignal'
  ]) verify(cleanRunnerSource.includes(marker), `clean npm interruption marker missing=${marker}`);
  const cleanLibrarySource = await readFile('scripts/lib/clean-npm-ci.mjs', 'utf8');
  verify(cleanLibrarySource.includes("classification: 'RUNNER_INTERRUPTED'"), 'clean npm retry library lacks interruption classification');
  verify(cleanLibrarySource.includes('rawResult.interrupted'), 'clean npm retry library does not stop on interrupted attempts');

  let simulatedAttempts = 0;
  const simulatedInterrupt = await runNpmCiWithRetry({
    policy: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0 },
    executeAttempt: async () => {
      simulatedAttempts += 1;
      return { exitCode: null, interrupted: true, interruptedSignal: 'SIGTERM', timedOut: false, stdout: '', stderr: '' };
    },
    sleep: async () => {}
  });
  verify(simulatedInterrupt.status === 'FAIL', `simulated interrupt status=${simulatedInterrupt.status}`);
  verify(simulatedInterrupt.classification === 'RUNNER_INTERRUPTED', `simulated interrupt classification=${simulatedInterrupt.classification}`);
  verify(simulatedInterrupt.attempts.length === 1, `simulated interrupt attempts=${simulatedInterrupt.attempts.length}`);
  verify(simulatedAttempts === 1, `simulated interrupted executor calls=${simulatedAttempts}`);
  verify(simulatedInterrupt.attempts[0]?.retryable === false, 'simulated interruption remained retryable');

  if (process.platform !== 'win32') {
    const fakeNpmPath = join(temporaryRoot, 'fake-npm.mjs');
    const fakeChildPidPath = join(temporaryRoot, 'fake-npm-child.pid');
    const interruptPolicyPath = join(temporaryRoot, 'interrupt-policy.json');
    const interruptReportPath = join(temporaryRoot, 'interrupt-report.json');
    await writeFile(fakeNpmPath, `import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
writeFileSync(process.env.PPT_FAKE_NPM_CHILD_PID_FILE, String(child.pid));
setInterval(() => {}, 1000);
`);
    await writeFile(interruptPolicyPath, `${JSON.stringify({
      schemaVersion: 1,
      registry: 'https://registry.npmjs.org/',
      maxAttempts: 3,
      baseDelayMs: 0,
      maxDelayMs: 0,
      retryableHttpStatuses: [503],
      retryableNetworkCodes: ['EAI_AGAIN'],
      attemptTimeoutMs: 60_000
    }, null, 2)}
`);
    const output = { stdout: '', stderr: '' };
    const interruptRunner = spawn(process.execPath, [
      'scripts/run-clean-npm-ci.mjs', '--policy', interruptPolicyPath, '--report', interruptReportPath
    ], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        npm_execpath: fakeNpmPath,
        PPT_FAKE_NPM_CHILD_PID_FILE: fakeChildPidPath,
        NPM_CONFIG_CACHE: join(temporaryRoot, 'npm-cache')
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    interruptRunner.stdout.on('data', (chunk) => { output.stdout += chunk.toString(); });
    interruptRunner.stderr.on('data', (chunk) => { output.stderr += chunk.toString(); });
    const fakeChildStarted = await waitForFile(fakeChildPidPath, 5_000);
    verify(fakeChildStarted, `fake npm child did not start; stdout=${output.stdout}; stderr=${output.stderr}`);
    if (fakeChildStarted) interruptRunner.kill('SIGTERM');
    const interruptOutcome = await Promise.race([
      new Promise((resolve) => interruptRunner.once('close', (code, signal) => resolve({ code, signal, timedOut: false }))),
      sleep(10_000).then(() => ({ code: null, signal: null, timedOut: true }))
    ]);
    if (interruptOutcome.timedOut) {
      try { interruptRunner.kill('SIGKILL'); } catch { /* already exited */ }
    }
    verify(!interruptOutcome.timedOut, `interrupted clean npm runner did not exit; stdout=${output.stdout}; stderr=${output.stderr}`);
    verify(interruptOutcome.code === 1, `interrupted clean npm exit=${interruptOutcome.code}; signal=${interruptOutcome.signal}`);
    const interruptEvidence = await readJson(interruptReportPath);
    verify(interruptEvidence.status === 'FAIL', `interrupt evidence status=${interruptEvidence.status}`);
    verify(interruptEvidence.classification === 'RUNNER_INTERRUPTED', `interrupt evidence classification=${interruptEvidence.classification}`);
    verify(interruptEvidence.interruptedSignal === 'SIGTERM', `interrupt evidence signal=${interruptEvidence.interruptedSignal}`);
    verify(interruptEvidence.attempts?.length === 1, `interrupt evidence attempts=${interruptEvidence.attempts?.length}`);
    verify(interruptEvidence.attempts?.[0]?.interrupted === true, 'interrupt attempt is not marked interrupted');
    verify(interruptEvidence.partialInstallCleanup?.status === 'PASS', `interrupt cleanup status=${interruptEvidence.partialInstallCleanup?.status}`);
    if (fakeChildStarted) {
      const fakeChildPid = Number((await readFile(fakeChildPidPath, 'utf8')).trim());
      const deadline = Date.now() + 3_000;
      while (Date.now() < deadline && await processIsAlive(fakeChildPid)) await sleep(50);
      verify(!(await processIsAlive(fakeChildPid)), `nested fake npm child remained alive pid=${fakeChildPid}`);
    }
  }

  const currentManifest = await readJson('manifest.json');
  verify(currentManifest.schemaVersion === SOURCE_MANIFEST_SCHEMA_VERSION, `current manifest schema=${currentManifest.schemaVersion}`);
  verify(currentManifest.packageVersion === expectedPackageVersion, `current manifest package version=${currentManifest.packageVersion}`);
  verify(currentManifest.fileCount === currentManifest.files?.length, `current manifest fileCount=${currentManifest.fileCount}; entries=${currentManifest.files?.length}`);
  const currentIntegrity = await verifySourceManifestIntegrity('.');
  verify(currentIntegrity.status === 'PASS', `current source integrity failures=${currentIntegrity.failures.join(' | ')}`);
  verify(currentIntegrity.manifestFileCount === currentIntegrity.actualSourceFileCount, `current manifest/source counts=${currentIntegrity.manifestFileCount}/${currentIntegrity.actualSourceFileCount}`);
  verify(currentIntegrity.sha256EntryCount === currentIntegrity.manifestFileCount + 1, `current SHA entry count=${currentIntegrity.sha256EntryCount}`);

  const wrapperReport = join(temporaryRoot, 'wrapper-source-integrity.json');
  const wrapperResult = spawnSync(process.execPath, ['scripts/verify-source-integrity.mjs', '--report', wrapperReport], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 300_000
  });
  verify(wrapperResult.status === 0, `source integrity wrapper exit=${wrapperResult.status}; stderr=${wrapperResult.stderr}`);
  const wrapperEvidence = await readJson(wrapperReport);
  verify(wrapperEvidence.status === 'PASS', `source integrity wrapper status=${wrapperEvidence.status}`);
  verify(wrapperEvidence.packageVersion === expectedPackageVersion, `source integrity wrapper packageVersion=${wrapperEvidence.packageVersion}`);
  verify(Array.isArray(wrapperEvidence.failures) && wrapperEvidence.failures.length === 0, 'source integrity wrapper contains failures');

  const fixtureRoot = join(temporaryRoot, 'fixture');
  await mkdir(join(fixtureRoot, 'src'), { recursive: true });
  await mkdir(join(fixtureRoot, 'artifacts', 'validation'), { recursive: true });
  await writeFile(join(fixtureRoot, 'package.json'), `${JSON.stringify({ name: 'fixture', version: '1.2.3' }, null, 2)}\n`);
  await writeFile(join(fixtureRoot, 'src', 'alpha.txt'), 'alpha\n');
  await writeFile(join(fixtureRoot, 'src', 'beta.txt'), 'beta\n');
  await writeFile(join(fixtureRoot, 'artifacts', 'validation', 'ephemeral.json'), '{}\n');
  const generatedFixture = await generateSourceManifest(fixtureRoot, { generatedAt: '2026-07-25T00:00:00.000Z' });
  verify(generatedFixture.manifest.schemaVersion === 3, `fixture manifest schema=${generatedFixture.manifest.schemaVersion}`);
  verify(generatedFixture.manifest.packageVersion === '1.2.3', `fixture packageVersion=${generatedFixture.manifest.packageVersion}`);
  verify(generatedFixture.manifest.fileCount === 3, `fixture file count=${generatedFixture.manifest.fileCount}`);
  verify(!generatedFixture.manifest.files.some((entry) => entry.path.startsWith('artifacts/validation/')), 'ephemeral validation evidence entered fixture manifest');
  verify(generatedFixture.sumsEntries.length === 4, `fixture sums count=${generatedFixture.sumsEntries.length}`);
  verify(generatedFixture.sumsEntries.some((entry) => entry.path === 'manifest.json'), 'fixture SHA list does not include manifest.json');
  verify(!generatedFixture.sumsEntries.some((entry) => entry.path === 'SHA256SUMS.txt'), 'fixture SHA list hashes itself');
  const fixturePass = await verifySourceManifestIntegrity(fixtureRoot);
  verify(fixturePass.status === 'PASS', `fixture PASS failures=${fixturePass.failures.join(' | ')}`);

  await writeFile(join(fixtureRoot, 'src', 'alpha.txt'), 'tampered\n');
  const tamperedFile = await verifySourceManifestIntegrity(fixtureRoot);
  verify(tamperedFile.status === 'FAIL', 'tampered source file was accepted');
  verify(tamperedFile.failures.some((failure) => failure.includes('sha256 mismatch for src/alpha.txt')), `tampered source failure=${tamperedFile.failures.join(' | ')}`);
  verify(tamperedFile.failures.some((failure) => failure.includes('byte mismatch for src/alpha.txt')), 'tampered source byte mismatch was not reported');

  await writeFile(join(fixtureRoot, 'src', 'alpha.txt'), 'alpha\n');
  await generateSourceManifest(fixtureRoot, { generatedAt: '2026-07-25T00:00:00.000Z' });
  await writeFile(join(fixtureRoot, 'src', 'unmanifested.txt'), 'new\n');
  const unmanifested = await verifySourceManifestIntegrity(fixtureRoot);
  verify(unmanifested.status === 'FAIL', 'unmanifested source file was accepted');
  verify(unmanifested.failures.some((failure) => failure.includes('source tree contains unmanifested file: src/unmanifested.txt')), `unmanifested failure=${unmanifested.failures.join(' | ')}`);

  await rm(join(fixtureRoot, 'src', 'unmanifested.txt'));
  await generateSourceManifest(fixtureRoot, { generatedAt: '2026-07-25T00:00:00.000Z' });
  const fixtureManifest = await readJson(join(fixtureRoot, 'manifest.json'));
  fixtureManifest.packageVersion = '9.9.9';
  await writeFile(join(fixtureRoot, 'manifest.json'), `${JSON.stringify(fixtureManifest, null, 2)}\n`);
  const wrongVersion = await verifySourceManifestIntegrity(fixtureRoot);
  verify(wrongVersion.status === 'FAIL', 'manifest package-version drift was accepted');
  verify(wrongVersion.failures.some((failure) => failure.includes('manifest packageVersion=9.9.9; package.json=1.2.3')), `package drift failure=${wrongVersion.failures.join(' | ')}`);

  await generateSourceManifest(fixtureRoot, { generatedAt: '2026-07-25T00:00:00.000Z' });
  const sumsPath = join(fixtureRoot, 'SHA256SUMS.txt');
  const originalSums = await readFile(sumsPath, 'utf8');
  const sumsLines = originalSums.trimEnd().split('\n');
  sumsLines[0] = `${'0'.repeat(64)}${sumsLines[0].slice(64)}`;
  await writeFile(sumsPath, `${sumsLines.join('\n')}\n`);
  const wrongSums = await verifySourceManifestIntegrity(fixtureRoot);
  verify(wrongSums.status === 'FAIL', 'tampered SHA256SUMS was accepted');
  verify(wrongSums.failures.some((failure) => failure.includes('SHA256SUMS mismatch for')), `SHA mismatch failure=${wrongSums.failures.join(' | ')}`);

  await writeFile(sumsPath, originalSums);
  const duplicateLine = originalSums.trimEnd().split('\n')[0];
  await writeFile(sumsPath, `${originalSums.trimEnd()}\n${duplicateLine}\n`);
  const duplicateSums = await verifySourceManifestIntegrity(fixtureRoot);
  verify(duplicateSums.status === 'FAIL', 'duplicate SHA256SUMS path was accepted');
  verify(duplicateSums.failures.some((failure) => failure.includes('SHA256SUMS contains duplicate path')), `duplicate SHA failure=${duplicateSums.failures.join(' | ')}`);

  for (const unsafe of ['/absolute.txt', '../escape.txt', 'nested/../escape.txt', 'nested//file.txt', './file.txt']) {
    let rejected = false;
    try { normalizeSourcePath(unsafe); } catch { rejected = true; }
    verify(rejected, `unsafe source path was accepted: ${unsafe}`);
  }
  verify(normalizeSourcePath('nested\\file.txt') === 'nested/file.txt', 'Windows path separator was not normalized');

  let malformedSumsRejected = false;
  try { parseSha256Sums('not-a-sha  file.txt\n'); } catch { malformedSumsRejected = true; }
  verify(malformedSumsRejected, 'malformed SHA256SUMS line was accepted');

  const preflightReport = join(temporaryRoot, 'source-preflight.json');
  const preflightResult = spawnSync(process.execPath, ['scripts/run-source-preflight.mjs', '--report', preflightReport], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 300_000, env: { ...process.env, TERM: 'dumb' }
  });
  verify(preflightResult.status === 0, `source preflight exit=${preflightResult.status}; stderr=${preflightResult.stderr}`);
  const preflightEvidence = await readJson(preflightReport);
  verify(preflightEvidence.status === 'PASS', `source preflight status=${preflightEvidence.status}`);
  verify(preflightEvidence.results?.length === 6, `source preflight result count=${preflightEvidence.results?.length}`);
  verify(preflightEvidence.results?.[0]?.id === 'source-integrity', `source preflight first result=${preflightEvidence.results?.[0]?.id}`);
  verify(preflightEvidence.results?.[0]?.status === 'PASS', `source integrity preflight status=${preflightEvidence.results?.[0]?.status}`);
  verify(preflightEvidence.results?.every((result) => result.status === 'PASS'), 'not every source preflight result passed');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

const evidence = {
  schemaVersion: 1,
  product: 'Panthera pardus tulliana Aile',
  version: expectedDisplayVersion,
  packageVersion: expectedPackageVersion,
  build: expectedBuild,
  checks,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build112-architecture.json', `${JSON.stringify(evidence, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`Build 112 architecture validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 112 architecture validation passed: ${checks} assertions.`);
