import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const root = resolve(process.cwd());
const expectedRoot = resolve('C:\\PPT\\AYM', '06_KOD', 'app');
if (root !== expectedRoot) throw new Error(`Unsafe source root: ${root}`);

const paths = {
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  execution: 'artifacts/checkpoints/31-H_EXECUTION_RECORD.json',
  scopeConfig: 'config/31-h-core-service-family-data-session-ownership-control-plane-scope.json',
  contract: 'artifacts/validation/31-H_FAMILY_DATA_SESSION_OWNERSHIP_CONTROL_PLANE_CONTRACT.json',
  typecheck: 'artifacts/validation/31-H_ROOT_TYPESCRIPT.json',
  targeted: 'artifacts/validation/31-H_TARGETED_VITEST.json',
  runtime: 'artifacts/validation/31-H_CORE_SERVICE_RUNTIME.json',
  regression: 'artifacts/validation/31-H_FULL_VITEST_REGRESSION.json',
  build: 'artifacts/validation/31-H_PRODUCTION_BUILD.json',
  platform: 'artifacts/validation/platform-policy-gate.json',
  scope: 'artifacts/inventory/31-H_SCOPE_AND_STATUS_REPORT.json',
  audit: 'docs/audit/31-H_CORE_SERVICE_FAMILY_DATA_SESSION_OWNERSHIP_CONTROL_PLANE.md'
};
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => {
  await mkdir(dirname(full(path)), { recursive: true });
  await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const stripAnsi = (value) => value.replace(/\u001b\[[0-9;]*m/gu, '');
const tail = (value, lineCount = 24) => stripAnsi(value).trim().split(/\r?\n/u).slice(-lineCount).join('\n');
const run = (name, args, options = {}) => {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const result = spawnSync(process.execPath, args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    maxBuffer: 16 * 1024 * 1024
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  return {
    name,
    command: `node ${args.join(' ')}`,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    processExitCode: result.status ?? 1,
    durationSeconds: Number(((performance.now() - started) / 1000).toFixed(2)),
    startedAt,
    outputTail: tail(`${stdout}\n${stderr}`),
    stdout,
    stderr
  };
};
const publicResult = ({ stdout, stderr, ...result }) => result;
const assertPass = (result) => {
  if (result.status !== 'PASS') {
    console.error(result.outputTail);
    throw new Error(`${result.name} failed with exit code ${result.processExitCode}`);
  }
};
const count = (value, pattern, label) => {
  const match = stripAnsi(value).match(pattern);
  if (!match) throw new Error(`Could not parse ${label}`);
  return Number(match[1]);
};

const [plan, ledger, execution, scopeConfig] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.execution), readJson(paths.scopeConfig)
]);
const step = plan.steps.find((item) => item.id === '31-H');
if (!step || plan.currentStep !== '31-H' || step.status !== 'IN_PROGRESS') throw new Error('31-H is not the active work-plan step');
if (execution.status !== 'IN_PROGRESS_VALIDATION_PENDING' || scopeConfig.status !== 'IN_PROGRESS') throw new Error('31-H is not awaiting local validation');
await readFile(full(paths.audit), 'utf8');

const contractRun = run('31-H contract', ['scripts/verify-31-h-core-service-family-data-session-ownership-control-plane-contract.mjs']);
assertPass(contractRun);
const contract = await readJson(paths.contract);
if (contract.status !== 'PASS' || contract.failed !== 0 || contract.passed !== 44) throw new Error('31-H contract evidence is not 44/44 PASS');

const typecheckRun = run('Root TypeScript', ['node_modules/typescript/bin/tsc', '--noEmit']);
await writeJson(paths.typecheck, {
  schemaVersion: 1, release: plan.release, step: '31-H', phase: 'ROOT_TYPESCRIPT_NO_EMIT',
  ...publicResult(typecheckRun), diagnosticCount: typecheckRun.status === 'PASS' ? 0 : null, executedAt: new Date().toISOString()
});
assertPass(typecheckRun);

const packageBuildCommands = [
  ['Core Service contracts build', ['node_modules/typescript/bin/tsc', '-p', 'packages/core-service-contracts/tsconfig.json']],
  ['Core Service client build', ['node_modules/typescript/bin/tsc', '-p', 'packages/core-service-client/tsconfig.json']],
  ['Core Service build', ['node_modules/typescript/bin/tsc', '-p', 'apps/core-service/tsconfig.json']]
];
const packageBuildResults = [];
for (const [name, args] of packageBuildCommands) {
  const result = run(name, args);
  packageBuildResults.push(publicResult(result));
  assertPass(result);
}

const targetedRun = run('Targeted Vitest', [
  'node_modules/vitest/vitest.mjs', 'run',
  'apps/core-service/tests/core-service-method-dispatcher.test.ts',
  'apps/core-service/tests/family-data-ownership-runtime.test.ts'
]);
const targetedText = `${targetedRun.stdout}\n${targetedRun.stderr}`;
const targetedFiles = targetedRun.status === 'PASS' ? count(targetedText, /Test Files\s+(\d+) passed/u, 'targeted test-file count') : null;
const targetedTests = targetedRun.status === 'PASS' ? count(targetedText, /Tests\s+(\d+) passed/u, 'targeted test count') : null;
await writeJson(paths.targeted, {
  schemaVersion: 1, release: plan.release, step: '31-H', phase: 'TARGETED_VITEST',
  ...publicResult(targetedRun), testFilePassCount: targetedFiles, testFileFailCount: targetedRun.status === 'PASS' ? 0 : null,
  testPassCount: targetedTests, testFailCount: targetedRun.status === 'PASS' ? 0 : null, executedAt: new Date().toISOString()
});
assertPass(targetedRun);
if (targetedFiles !== 2 || targetedTests !== 5) throw new Error(`Unexpected targeted Vitest count: ${targetedFiles} files / ${targetedTests} tests`);

const runtimeCommands = [
  ['Core Service Local Admin contract', ['scripts/verify-core-service-local-admin-contract.mjs']],
  ['Core Service Local Admin runtime', ['scripts/verify-core-service-local-admin-runtime-wrapper.mjs']],
  ['Core Service boundary', ['scripts/verify-core-service-boundary.mjs']],
  ['Desktop Core Service startup contract', ['scripts/verify-desktop-core-service-startup-contract.mjs']],
  ['Desktop Core Service startup runtime', ['scripts/verify-desktop-core-service-startup-runtime-wrapper.mjs']],
  ['System Health Core Service IPC contract', ['scripts/verify-system-health-core-service-ipc-contract.mjs']],
  ['System Health Core Service IPC runtime', ['scripts/verify-system-health-core-service-ipc-runtime-wrapper.mjs']],
  ['Platform Policy gate', ['scripts/verify-platform-policy-gate.mjs']]
];
const runtimeResults = [];
for (const [name, args] of runtimeCommands) {
  const result = run(name, args);
  runtimeResults.push(publicResult(result));
  assertPass(result);
}
await writeJson(paths.runtime, {
  schemaVersion: 1, release: plan.release, step: '31-H', phase: 'CORE_SERVICE_FAMILY_DATA_OWNERSHIP_RUNTIME_GATES',
  status: 'PASS', expected: runtimeResults.length, executed: runtimeResults.length, passed: runtimeResults.length, failed: 0,
  checks: runtimeResults, executedAt: new Date().toISOString()
});
const platform = await readJson(paths.platform);
if (platform.status !== 'PASS' || platform.newBypassCount !== 0 || platform.runtimeStatus !== 'PASS') throw new Error('Platform Policy evidence is not clean PASS');

const regressionRun = run('Full Vitest regression', ['node_modules/vitest/vitest.mjs', 'run']);
const regressionText = `${regressionRun.stdout}\n${regressionRun.stderr}`;
const regressionFiles = regressionRun.status === 'PASS' ? count(regressionText, /Test Files\s+(\d+) passed/u, 'full test-file count') : null;
const regressionTests = regressionRun.status === 'PASS' ? count(regressionText, /Tests\s+(\d+) passed/u, 'full test count') : null;
await writeJson(paths.regression, {
  schemaVersion: 1, release: plan.release, step: '31-H', phase: 'FULL_VITEST_REGRESSION',
  ...publicResult(regressionRun), testFilePassCount: regressionFiles, testFileFailCount: regressionRun.status === 'PASS' ? 0 : null,
  testPassCount: regressionTests, testFailCount: regressionRun.status === 'PASS' ? 0 : null, executedAt: new Date().toISOString()
});
assertPass(regressionRun);
if (regressionFiles !== 34 || regressionTests !== 178) throw new Error(`Unexpected full Vitest count: ${regressionFiles} files / ${regressionTests} tests`);

const electronBuild = run('Electron production compile', ['scripts/build-electron.mjs'], { cwd: resolve(root, 'apps/desktop') });
assertPass(electronBuild);
const rendererBuild = run('Renderer production build', ['../../node_modules/vite/bin/vite.js', 'build'], { cwd: resolve(root, 'apps/desktop') });
assertPass(rendererBuild);
await writeJson(paths.build, {
  schemaVersion: 1, release: plan.release, step: '31-H', phase: 'PRODUCTION_BUILD', status: 'PASS', processExitCode: 0,
  affectedPackageBuilds: packageBuildResults, electronMain: 'PASS', renderer: 'PASS',
  commands: [publicResult(electronBuild), publicResult(rendererBuild)], executedAt: new Date().toISOString()
});

const validatedAt = new Date().toISOString();
const validation = {
  contract: 'PASS_44_OF_44', rootTypeScript: 'PASS_0_DIAGNOSTICS', affectedPackageBuilds: 'PASS_3_OF_3',
  targetedVitest: 'PASS_5_OF_5', coreServiceRuntimeGates: `PASS_${runtimeResults.length}_OF_${runtimeResults.length}`,
  fullVitest: 'PASS_178_OF_178', productionBuild: 'PASS',
  platformPolicy: `PASS_LEGACY_${platform.legacyBypassCount}_NEW_BYPASS_0_RUNTIME_PASS`
};
const evidence = [paths.contract, paths.typecheck, paths.targeted, paths.runtime, paths.regression, paths.build, paths.platform, paths.scope, paths.audit];
for (const path of evidence) if (!step.localEvidence.includes(path)) step.localEvidence.push(path);
step.validationStatus = 'PASS';
step.persistentReceiptStatus = 'PENDING';
plan.updatedAt = validatedAt;
plan.segmentationNote = '31-H protected family-data session ownership control plane is LOCAL_PASS_AWAITING_LIBRARY_RECEIPT after 44/44 contract, root TypeScript, three affected package builds, targeted 5/5, eight runtime/contract gates, full Vitest 178/178, production build and platform-policy PASS. Protected vault handoff and SQLite ownership remain open; no requirement is COMPLETE and no new Build is issued.';
await writeJson(paths.plan, plan);
ledger.libraryUploadStatus = '31-H_MAIN_STRUCTURE_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT';
ledger.updatedAt = validatedAt;
await writeJson(paths.ledger, ledger);
Object.assign(execution, {
  status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT',
  targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false,
  validation, evidence, requirementCompletionClaimed: false, newBuildIssued: false, validatedAt
});
await writeJson(paths.execution, execution);
Object.assign(scopeConfig, { status: 'IN_PROGRESS', targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING', validatedAt });
await writeJson(paths.scopeConfig, scopeConfig);
await writeJson(paths.scope, {
  schemaVersion: 1, release: plan.release, step: '31-H', primaryRequirement: 'DHA-001', requirements: scopeConfig.requirements,
  status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', targetSliceStatus: 'PASS',
  validationStatus: 'PASS', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, requirementCompletionClaimed: false,
  cleanEvidence: validation, deliveredFoundation: scopeConfig.targets, openBoundaries: scopeConfig.openBoundaries,
  requirementStatuses: Object.fromEntries(scopeConfig.requirements.map((id) => [id, 'OPEN_FOUNDATION_ONLY'])),
  newBuildIssued: false, generatedAt: validatedAt
});
console.log(`31-H local validation: PASS (44/44 contract; 5/5 targeted; ${runtimeResults.length}/${runtimeResults.length} runtime gates; 178/178 full); awaiting D: Library receipt.`);
