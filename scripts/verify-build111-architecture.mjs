import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { cleanupFailedInstallResidue, resolveInstallResiduePaths } from './lib/clean-npm-ci.mjs';

const expectedDisplayVersion = '25.07.2026.111';
const expectedPackageVersion = '25.7.2026-111';
const expectedBuild = 111;
const failures = [];
let checks = 0;
const verify = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const exists = async (path) => { try { await stat(path); return true; } catch { return false; } };
const temporaryRoot = await mkdtemp(join(tmpdir(), 'ppt-build111-verification-'));

try {
  const rootManifest = await readJson('package.json');
  verify(rootManifest.version === expectedPackageVersion, `root package version=${rootManifest.version}`);
  verify(rootManifest.scripts?.['verify:source-preflight'] === 'node scripts/run-source-preflight.mjs', 'source preflight script is not registered');
  verify(rootManifest.scripts?.['verify:build111:architecture'] === 'node scripts/verify-build111-architecture.mjs', 'Build 111 verifier is not registered');

  const appMeta = await readFile('packages/domain/src/app-meta.ts', 'utf8');
  verify(appMeta.includes(`version: '${expectedDisplayVersion}'`), 'APP_META display version mismatch');
  verify(appMeta.includes(`packageVersion: '${expectedPackageVersion}'`), 'APP_META package version mismatch');
  verify(appMeta.includes(`Build ${expectedBuild}`), 'APP_META build mismatch');

  const preflightConfig = await readJson('config/source-preflight-checks.json');
  verify(preflightConfig.schemaVersion === 1, `source preflight schema=${preflightConfig.schemaVersion}`);
  verify(preflightConfig.stage === 'Bronze RC2 Active Development', `source preflight stage=${preflightConfig.stage}`);
  verify(Array.isArray(preflightConfig.checks) && preflightConfig.checks.length === 5, `source preflight check count=${preflightConfig.checks?.length}`);
  const expectedChecks = [
    ['lockfile-integrity', 'scripts/verify-lockfile-integrity.mjs'],
    ['dependency-supply', 'scripts/verify-dependency-supply.mjs'],
    ['workspace-dependencies', 'scripts/verify-workspace-dependencies.mjs'],
    ['version-sequence', 'scripts/verify-version-sequence.mjs'],
    ['active-version-contract', 'scripts/verify-active-version-contract.mjs']
  ];
  for (const [index, [id, script]] of expectedChecks.entries()) {
    verify(preflightConfig.checks?.[index]?.id === id, `source preflight check ${index} id=${preflightConfig.checks?.[index]?.id}`);
    verify(preflightConfig.checks?.[index]?.script === script, `source preflight check ${id} script=${preflightConfig.checks?.[index]?.script}`);
    verify(!preflightConfig.checks?.[index]?.script?.includes('npm'), `source preflight check ${id} must not invoke npm`);
  }
  verify(new Set(preflightConfig.checks.map((check) => check.id)).size === preflightConfig.checks.length, 'source preflight check ids are not unique');

  const preflightSource = await readFile('scripts/run-source-preflight.mjs', 'utf8');
  for (const marker of [
    "dependencyInstallationRequired: false",
    "sourceOnly: true",
    "spawn(process.execPath",
    "shell: false",
    "normalized.startsWith('scripts/')",
    "normalized.endsWith('.mjs')",
    "Duplicate source preflight check id",
    "blockedBy: blockingCheckId",
    "Source preflight report written"
  ]) verify(preflightSource.includes(marker), `source preflight runner marker missing=${marker}`);
  verify(!preflightSource.includes("command: 'npm'"), 'source preflight runner contains an npm command');
  verify(!preflightSource.includes('node_modules'), 'source preflight runner depends on node_modules');


  const cleanNpmSource = await readFile('scripts/run-clean-npm-ci.mjs', 'utf8');
  verify(cleanNpmSource.includes('cleanupFailedInstallResidue'), 'clean npm runner does not clean failed install residue');
  verify(cleanNpmSource.includes('partialInstallCleanup'), 'clean npm report does not preserve cleanup evidence');
  verify(cleanNpmSource.includes("outcome.status === 'PASS'"), 'clean npm residue cleanup is not failure-only');
  const cleanNpmLibrarySource = await readFile('scripts/lib/clean-npm-ci.mjs', 'utf8');
  verify(cleanNpmLibrarySource.includes("/^(?:apps|packages)\\/[^/]+$/"), 'workspace cleanup boundary regex missing');
  verify(cleanNpmLibrarySource.includes("candidates = ['node_modules']"), 'root node_modules cleanup target missing');
  verify(cleanNpmLibrarySource.includes('escapes repository root'), 'cleanup traversal rejection missing');

  const gateConfig = await readJson('config/rc2-validation-gates.json');
  verify(gateConfig.schemaVersion === 3, `RC2 config schema=${gateConfig.schemaVersion}`);
  verify(gateConfig.gates?.[0]?.id === 'source-preflight', `first gate=${gateConfig.gates?.[0]?.id}`);
  verify(gateConfig.gates?.[0]?.phase === 'source-preflight', `first gate phase=${gateConfig.gates?.[0]?.phase}`);
  verify(gateConfig.gates?.[0]?.command === 'node', `source preflight gate command=${gateConfig.gates?.[0]?.command}`);
  verify(gateConfig.gates?.[0]?.args?.[0] === 'scripts/run-source-preflight.mjs', `source preflight gate runner=${gateConfig.gates?.[0]?.args?.[0]}`);
  verify(gateConfig.gates?.[0]?.args?.includes('artifacts/validation/source-preflight.json'), 'source preflight gate report path missing');
  verify(gateConfig.gates?.[1]?.id === 'clean-npm-ci', `second gate=${gateConfig.gates?.[1]?.id}`);
  verify(gateConfig.gates?.[1]?.phase === 'dependency-bootstrap', `clean npm phase=${gateConfig.gates?.[1]?.phase}`);
  verify(!gateConfig.gates.some((gate) => gate.id === 'active-version-contract'), 'legacy standalone active-version gate remains in RC2 config');
  const expectedPhases = ['source-preflight', 'dependency-bootstrap', 'compile', 'build', 'smoke', 'windows-runtime', 'windows-installer'];
  verify(JSON.stringify(gateConfig.gates.map((gate) => gate.phase)) === JSON.stringify(expectedPhases), `gate phases=${gateConfig.gates.map((gate) => gate.phase).join(',')}`);

  const runnerSource = await readFile('scripts/run-rc2-validation-gates.mjs', 'utf8');
  for (const marker of [
    'schemaVersion: 4',
    'sourcePreflightStatus',
    'dependencyBootstrapStatus',
    'blockingGateId',
    'blockedBy: blockingGateId',
    "if (config.gates[0]?.phase !== 'source-preflight')",
    "if (config.gates[0]?.id !== 'source-preflight')",
    'violates the required RC2 phase order',
    'phase: gate.phase'
  ]) verify(runnerSource.includes(marker), `RC2 runner marker missing=${marker}`);
  verify(!runnerSource.includes('if (config.stopOnFailure) blocked = true;'), 'platform ineligibility still blocks later gates');

  const ciWorkflow = await readFile('.github/workflows/ci.yml', 'utf8');
  const ciPreflightIndex = ciWorkflow.indexOf('run-source-preflight.mjs');
  const ciInstallIndex = ciWorkflow.indexOf('run-clean-npm-ci.mjs');
  verify(ciPreflightIndex >= 0, 'CI source preflight step missing');
  verify(ciInstallIndex > ciPreflightIndex, 'CI dependency install does not follow source preflight');
  verify(ciWorkflow.includes('ci-source-preflight.json'), 'CI source preflight evidence path missing');
  verify(ciWorkflow.includes('ci-npm-ci-dependency-access.json'), 'CI dependency access evidence path missing');
  verify(ciWorkflow.includes('if: always()'), 'CI evidence upload is not unconditional');

  const windowsWorkflow = await readFile('.github/workflows/windows-rc2-validation.yml', 'utf8');
  verify(windowsWorkflow.includes('validate:rc2:gates'), 'Windows workflow bypasses the ordered RC2 runner');
  verify(windowsWorkflow.includes('artifacts/validation/source-preflight.json'), 'Windows workflow does not preserve source preflight evidence');
  verify(windowsWorkflow.includes('artifacts/validation/npm-ci-dependency-access.json'), 'Windows workflow does not preserve dependency access evidence');

  const actualPreflightReport = join(temporaryRoot, 'actual-source-preflight.json');
  const actualPreflight = spawnSync(process.execPath, ['scripts/run-source-preflight.mjs', '--report', actualPreflightReport], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, TERM: 'dumb' },
    timeout: 300_000
  });
  verify(actualPreflight.status === 0, `actual source preflight exit=${actualPreflight.status}; stderr=${actualPreflight.stderr}`);
  const actualPreflightEvidence = await readJson(actualPreflightReport);
  verify(actualPreflightEvidence.status === 'PASS', `actual source preflight status=${actualPreflightEvidence.status}`);
  verify(actualPreflightEvidence.sourceOnly === true, `actual sourceOnly=${actualPreflightEvidence.sourceOnly}`);
  verify(actualPreflightEvidence.dependencyInstallationRequired === false, `actual dependencyInstallationRequired=${actualPreflightEvidence.dependencyInstallationRequired}`);
  verify(actualPreflightEvidence.results?.length === 5, `actual source preflight result count=${actualPreflightEvidence.results?.length}`);
  verify(actualPreflightEvidence.results?.every((result) => result.status === 'PASS'), 'not every actual source preflight check passed');

  const cleanupRoot = join(temporaryRoot, 'cleanup-fixture');
  await mkdir(join(cleanupRoot, 'node_modules'), { recursive: true });
  await mkdir(join(cleanupRoot, 'apps', 'desktop', 'node_modules'), { recursive: true });
  await mkdir(join(cleanupRoot, 'packages', 'domain', 'node_modules'), { recursive: true });
  await writeFile(join(cleanupRoot, 'node_modules', 'root.txt'), 'partial');
  await writeFile(join(cleanupRoot, 'apps', 'desktop', 'node_modules', 'desktop.txt'), 'partial');
  await writeFile(join(cleanupRoot, 'packages', 'domain', 'node_modules', 'domain.txt'), 'partial');
  const cleanupEvidence = await cleanupFailedInstallResidue({
    root: cleanupRoot,
    workspacePackagePaths: ['apps/desktop', 'packages/domain']
  });
  verify(cleanupEvidence.status === 'PASS', `cleanup fixture status=${cleanupEvidence.status}`);
  verify(cleanupEvidence.paths?.filter((entry) => entry.removed).length === 3, `cleanup removed count=${cleanupEvidence.paths?.filter((entry) => entry.removed).length}`);
  verify(!(await exists(join(cleanupRoot, 'node_modules'))), 'root partial node_modules was not removed');
  verify(!(await exists(join(cleanupRoot, 'apps', 'desktop', 'node_modules'))), 'desktop partial node_modules was not removed');
  verify(!(await exists(join(cleanupRoot, 'packages', 'domain', 'node_modules'))), 'domain partial node_modules was not removed');
  let unsafeCleanupRejected = false;
  try { resolveInstallResiduePaths({ root: cleanupRoot, workspacePackagePaths: ['../escape'] }); }
  catch (error) { unsafeCleanupRejected = String(error.message).includes('Unsafe workspace path'); }
  verify(unsafeCleanupRejected, 'unsafe cleanup workspace path was accepted');

  const duplicateConfigPath = join(temporaryRoot, 'duplicate-source-preflight.json');
  await writeFile(duplicateConfigPath, `${JSON.stringify({
    schemaVersion: 1,
    stage: 'Bronze RC2 Active Development',
    checks: [
      { id: 'duplicate', label: 'one', script: 'scripts/verify-version-sequence.mjs', args: [], timeoutMs: 10000 },
      { id: 'duplicate', label: 'two', script: 'scripts/verify-version-sequence.mjs', args: [], timeoutMs: 10000 }
    ]
  }, null, 2)}\n`);
  const duplicateResult = spawnSync(process.execPath, ['scripts/run-source-preflight.mjs', '--config', duplicateConfigPath, '--report', join(temporaryRoot, 'duplicate-report.json')], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 30_000
  });
  verify(duplicateResult.status !== 0, 'duplicate source preflight ids were accepted');
  verify(`${duplicateResult.stdout}\n${duplicateResult.stderr}`.includes('Duplicate source preflight check id'), 'duplicate source preflight rejection reason missing');

  const blockedConfigPath = join(temporaryRoot, 'blocked-rc2.json');
  const blockedReportPath = join(temporaryRoot, 'blocked-rc2-report.json');
  await writeFile(blockedConfigPath, `${JSON.stringify({
    schemaVersion: 3,
    stage: 'Bronze RC2 Active Development',
    stopOnFailure: true,
    gates: [
      { id: 'source-preflight', label: 'source', phase: 'source-preflight', command: 'node', args: ['-e', 'process.exit(0)'], platforms: [process.platform], timeoutMs: 10000 },
      { id: 'clean-npm-ci', label: 'bootstrap', phase: 'dependency-bootstrap', command: 'node', args: ['-e', 'process.exit(7)'], platforms: [process.platform], timeoutMs: 10000 },
      { id: 'compile-after-failure', label: 'compile', phase: 'compile', command: 'node', args: ['-e', 'process.exit(0)'], platforms: [process.platform], timeoutMs: 10000 }
    ]
  }, null, 2)}\n`);
  const blockedResult = spawnSync(process.execPath, ['scripts/run-rc2-validation-gates.mjs', '--config', blockedConfigPath, '--report', blockedReportPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 60_000
  });
  verify(blockedResult.status !== 0, 'failing RC2 fixture unexpectedly passed');
  const blockedEvidence = await readJson(blockedReportPath);
  verify(blockedEvidence.schemaVersion === 4, `blocked fixture report schema=${blockedEvidence.schemaVersion}`);
  verify(blockedEvidence.sourcePreflightStatus === 'PASS', `blocked fixture source status=${blockedEvidence.sourcePreflightStatus}`);
  verify(blockedEvidence.dependencyBootstrapStatus === 'FAIL', `blocked fixture dependency status=${blockedEvidence.dependencyBootstrapStatus}`);
  verify(blockedEvidence.blockingGateId === 'clean-npm-ci', `blocked fixture blockingGateId=${blockedEvidence.blockingGateId}`);
  verify(blockedEvidence.results?.[2]?.status === 'NOT_RUN', `blocked fixture third status=${blockedEvidence.results?.[2]?.status}`);
  verify(blockedEvidence.results?.[2]?.blockedBy === 'clean-npm-ci', `blocked fixture third blockedBy=${blockedEvidence.results?.[2]?.blockedBy}`);

  const ineligiblePlatform = process.platform === 'win32' ? 'linux' : 'win32';
  const platformConfigPath = join(temporaryRoot, 'platform-rc2.json');
  const platformReportPath = join(temporaryRoot, 'platform-rc2-report.json');
  await writeFile(platformConfigPath, `${JSON.stringify({
    schemaVersion: 3,
    stage: 'Bronze RC2 Active Development',
    stopOnFailure: true,
    gates: [
      { id: 'source-preflight', label: 'source', phase: 'source-preflight', command: 'node', args: ['-e', 'process.exit(9)'], platforms: [ineligiblePlatform], timeoutMs: 10000 },
      { id: 'eligible-bootstrap', label: 'bootstrap', phase: 'dependency-bootstrap', command: 'node', args: ['-e', 'process.exit(0)'], platforms: [process.platform], timeoutMs: 10000 }
    ]
  }, null, 2)}\n`);
  const platformResult = spawnSync(process.execPath, ['scripts/run-rc2-validation-gates.mjs', '--config', platformConfigPath, '--report', platformReportPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 60_000
  });
  verify(platformResult.status !== 0, 'platform-incomplete RC2 fixture unexpectedly reported full PASS');
  const platformEvidence = await readJson(platformReportPath);
  verify(platformEvidence.results?.[0]?.status === 'NOT_RUN', `platform fixture source status=${platformEvidence.results?.[0]?.status}`);
  verify(platformEvidence.results?.[1]?.status === 'PASS', `platform fixture eligible gate status=${platformEvidence.results?.[1]?.status}`);
  verify(platformEvidence.blockingGateId === undefined, `platform fixture blockingGateId=${platformEvidence.blockingGateId}`);

  const buildStatus = await readFile('BUILD_STATUS_BRONZE_RC2_BUILD111.md', 'utf8');
  verify(buildStatus.includes(`Application Version: \`${expectedDisplayVersion}\``), 'Build 111 status display version mismatch');
  verify(buildStatus.includes(`Package Version: \`${expectedPackageVersion}\``), 'Build 111 status package version mismatch');
  verify(buildStatus.includes('Stage: **Bronze RC2 Active Development**'), 'Build 111 status stage mismatch');

  if (failures.length > 0) {
    console.error(`Build 111 architecture verification failed with ${failures.length} issue(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`Build 111 architecture verification completed: ${checks} targeted assertions.`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
