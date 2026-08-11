import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json',
  execution: 'artifacts/checkpoints/31-J_EXECUTION_RECORD.json', scopeConfig: 'config/31-j-family-data-coexistence-default-deny-cutover-gate-scope.json',
  contract: 'artifacts/validation/31-J_FAMILY_DATA_COEXISTENCE_DEFAULT_DENY_CUTOVER_GATE_CONTRACT.json',
  typecheck: 'artifacts/validation/31-J_ROOT_TYPESCRIPT.json', targeted: 'artifacts/validation/31-J_TARGETED_VITEST.json',
  runtime: 'artifacts/validation/31-J_CORE_SERVICE_RUNTIME.json', security: 'artifacts/validation/31-J_SECURITY_REGRESSION.json',
  regression: 'artifacts/validation/31-J_FULL_VITEST_REGRESSION.json', build: 'artifacts/validation/31-J_PRODUCTION_BUILD.json',
  platform: 'artifacts/validation/platform-policy-gate.json', scope: 'artifacts/inventory/31-J_SCOPE_AND_STATUS_REPORT.json',
  audit: 'docs/audit/31-J_FAMILY_DATA_COEXISTENCE_DEFAULT_DENY_CUTOVER_GATE.md'
};
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => { await mkdir(dirname(full(path)), { recursive: true }); await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); };
const stripAnsi = (value) => value.replace(/\u001b\[[0-9;]*m/gu, '');
const tail = (value) => stripAnsi(value).trim().split(/\r?\n/u).slice(-24).join('\n');
const run = (name, args, cwd = root) => {
  const started = performance.now();
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }, maxBuffer: 16 * 1024 * 1024 });
  return { name, command: `node ${args.join(' ')}`, status: result.status === 0 ? 'PASS' : 'FAIL', processExitCode: result.status ?? 1, durationSeconds: Number(((performance.now() - started) / 1000).toFixed(2)), outputTail: tail(`${result.stdout ?? ''}\n${result.stderr ?? ''}`), stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
};
const publicResult = ({ stdout, stderr, ...result }) => result;
const pass = (result) => { if (result.status !== 'PASS') { console.error(result.outputTail); throw new Error(`${result.name} failed`); } };
const count = (text, pattern, label) => { const match = stripAnsi(text).match(pattern); if (!match) throw new Error(`Could not parse ${label}`); return Number(match[1]); };

const [plan, ledger, execution, scopeConfig] = await Promise.all([readJson(paths.plan), readJson(paths.ledger), readJson(paths.execution), readJson(paths.scopeConfig)]);
const step = plan.steps.find((item) => item.id === '31-J');
if (!step || plan.currentStep !== '31-J' || step.status !== 'IN_PROGRESS') throw new Error('31-J is not active');
if (execution.status !== 'IN_PROGRESS_VALIDATION_PENDING' || scopeConfig.status !== 'IN_PROGRESS') throw new Error('31-J is not awaiting validation');
await readFile(full(paths.audit), 'utf8');

const contractRun = run('31-J contract', ['scripts/verify-31-j-family-data-coexistence-default-deny-cutover-gate-contract.mjs']); pass(contractRun);
const contract = await readJson(paths.contract);
if (contract.status !== 'PASS' || contract.failed !== 0 || contract.passed !== contract.expected || contract.expected !== 59) throw new Error('31-J contract is not 59/59 PASS');
const typecheck = run('Root TypeScript', ['node_modules/typescript/bin/tsc', '--noEmit']);
await writeJson(paths.typecheck, { schemaVersion: 1, release: plan.release, step: '31-J', phase: 'ROOT_TYPESCRIPT_NO_EMIT', ...publicResult(typecheck), diagnosticCount: typecheck.status === 'PASS' ? 0 : null, executedAt: new Date().toISOString() }); pass(typecheck);

const buildProjects = ['packages/core-service-contracts/tsconfig.json', 'packages/core-service-client/tsconfig.json', 'apps/core-service/tsconfig.json'];
const packageBuilds = buildProjects.map((project) => run(`Build ${project}`, ['node_modules/typescript/bin/tsc', '-p', project]));
packageBuilds.forEach(pass);
const targeted = run('Targeted Vitest', ['node_modules/vitest/vitest.mjs', 'run', 'apps/core-service/tests/core-service-method-dispatcher.test.ts', 'apps/core-service/tests/family-data-ownership-runtime.test.ts', 'apps/core-service/tests/device-secret-protection-runtime.test.ts', 'apps/core-service/tests/family-data-cutover-guard.test.ts']);
const targetedText = `${targeted.stdout}\n${targeted.stderr}`;
const targetedFiles = targeted.status === 'PASS' ? count(targetedText, /Test Files\s+(\d+) passed/u, 'targeted files') : null;
const targetedTests = targeted.status === 'PASS' ? count(targetedText, /Tests\s+(\d+) passed/u, 'targeted tests') : null;
await writeJson(paths.targeted, { schemaVersion: 1, release: plan.release, step: '31-J', phase: 'TARGETED_VITEST', ...publicResult(targeted), testFilePassCount: targetedFiles, testPassCount: targetedTests, testFileFailCount: targeted.status === 'PASS' ? 0 : null, testFailCount: targeted.status === 'PASS' ? 0 : null, executedAt: new Date().toISOString() }); pass(targeted);
if (targetedFiles !== 4 || targetedTests !== 11) throw new Error(`Unexpected targeted count ${targetedFiles}/${targetedTests}`);

const runtimeCommands = [
  ['Core Service Local Admin contract', 'scripts/verify-core-service-local-admin-contract.mjs'], ['Core Service Local Admin runtime', 'scripts/verify-core-service-local-admin-runtime-wrapper.mjs'],
  ['Core Service boundary', 'scripts/verify-core-service-boundary.mjs'], ['Desktop startup contract', 'scripts/verify-desktop-core-service-startup-contract.mjs'],
  ['Desktop startup runtime', 'scripts/verify-desktop-core-service-startup-runtime-wrapper.mjs'], ['System Health contract', 'scripts/verify-system-health-core-service-ipc-contract.mjs'],
  ['System Health runtime', 'scripts/verify-system-health-core-service-ipc-runtime-wrapper.mjs'], ['Platform Policy gate', 'scripts/verify-platform-policy-gate.mjs']
];
const runtimeResults = runtimeCommands.map(([name, script]) => run(name, [script])); runtimeResults.forEach(pass);
await writeJson(paths.runtime, { schemaVersion: 1, release: plan.release, step: '31-J', phase: 'CORE_SERVICE_DEFAULT_DENY_CUTOVER_RUNTIME_GATES', status: 'PASS', expected: 8, executed: 8, passed: 8, failed: 0, checks: runtimeResults.map(publicResult), executedAt: new Date().toISOString() });
const platform = await readJson(paths.platform); if (platform.status !== 'PASS' || platform.newBypassCount !== 0 || platform.runtimeStatus !== 'PASS') throw new Error('Platform Policy is not clean PASS');

const securityCommands = [
  ['31-H family-data ownership contract', 'scripts/verify-31-h-core-service-family-data-session-ownership-control-plane-contract.mjs'],
  ['31-I device-secret protection contract', 'scripts/verify-31-i-headless-device-secret-protection-boundary-contract.mjs'],
  ['Device secret protector runtime', 'scripts/verify-device-secret-protector-runtime.mjs'], ['User data vault runtime', 'scripts/verify-build209-user-data-vault-runtime.mjs'],
  ['Volatile user data runtime', 'scripts/verify-build213-volatile-user-data-runtime.mjs'], ['DPAPI root-cause contract', 'scripts/verify-build227-root-cause-contract.mjs']
];
const securityResults = securityCommands.map(([name, script]) => run(name, [script])); securityResults.forEach(pass);
await writeJson(paths.security, { schemaVersion: 1, release: plan.release, step: '31-J', phase: 'COEXISTENCE_CUTOVER_SECURITY_REGRESSION', status: 'PASS', expected: 6, executed: 6, passed: 6, failed: 0, checks: securityResults.map(publicResult), executedAt: new Date().toISOString() });

const regression = run('Full Vitest regression', ['node_modules/vitest/vitest.mjs', 'run']);
const regressionText = `${regression.stdout}\n${regression.stderr}`;
const fullFiles = regression.status === 'PASS' ? count(regressionText, /Test Files\s+(\d+) passed/u, 'full files') : null;
const fullTests = regression.status === 'PASS' ? count(regressionText, /Tests\s+(\d+) passed/u, 'full tests') : null;
await writeJson(paths.regression, { schemaVersion: 1, release: plan.release, step: '31-J', phase: 'FULL_VITEST_REGRESSION', ...publicResult(regression), testFilePassCount: fullFiles, testPassCount: fullTests, testFileFailCount: regression.status === 'PASS' ? 0 : null, testFailCount: regression.status === 'PASS' ? 0 : null, executedAt: new Date().toISOString() }); pass(regression);
if (fullFiles !== 36 || fullTests !== 184) throw new Error(`Unexpected full count ${fullFiles}/${fullTests}`);

const electron = run('Electron production compile', ['scripts/build-electron.mjs'], resolve(root, 'apps/desktop')); pass(electron);
const renderer = run('Renderer production build', ['../../node_modules/vite/bin/vite.js', 'build'], resolve(root, 'apps/desktop')); pass(renderer);
await writeJson(paths.build, { schemaVersion: 1, release: plan.release, step: '31-J', phase: 'PRODUCTION_BUILD', status: 'PASS', affectedPackageBuilds: packageBuilds.map(publicResult), electronMain: 'PASS', renderer: 'PASS', commands: [publicResult(electron), publicResult(renderer)], executedAt: new Date().toISOString() });

const validatedAt = new Date().toISOString();
const validation = { contract: 'PASS_59_OF_59', rootTypeScript: 'PASS_0_DIAGNOSTICS', affectedPackageBuilds: 'PASS_3_OF_3', targetedVitest: 'PASS_11_OF_11', runtimeGates: 'PASS_8_OF_8', securityRegression: 'PASS_6_OF_6', fullVitest: 'PASS_184_OF_184', productionBuild: 'PASS', platformPolicy: `PASS_LEGACY_${platform.legacyBypassCount}_NEW_BYPASS_0_RUNTIME_PASS` };
const evidence = [paths.contract, paths.typecheck, paths.targeted, paths.runtime, paths.security, paths.regression, paths.build, paths.platform, paths.scope, paths.audit];
for (const path of evidence) if (!step.localEvidence.includes(path)) step.localEvidence.push(path);
step.validationStatus = 'PASS'; step.persistentReceiptStatus = 'PENDING'; plan.updatedAt = validatedAt;
plan.segmentationNote = '31-J coexistence and default-deny cutover safety gate is LOCAL_PASS_AWAITING_LIBRARY_RECEIPT after 59/59 contract, root TypeScript, three package builds, targeted 11/11, eight runtime gates, six security regressions, full Vitest 184/184 and production build PASS. Existing Desktop vault remains authoritative; real cutover remains blocked.';
await writeJson(paths.plan, plan); ledger.libraryUploadStatus = '31-J_MAIN_STRUCTURE_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'; ledger.updatedAt = validatedAt; await writeJson(paths.ledger, ledger);
Object.assign(execution, { status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, validation, evidence, requirementCompletionClaimed: false, newBuildIssued: false, validatedAt }); await writeJson(paths.execution, execution);
Object.assign(scopeConfig, { status: 'IN_PROGRESS', targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING', validatedAt }); await writeJson(paths.scopeConfig, scopeConfig);
await writeJson(paths.scope, { schemaVersion: 1, release: plan.release, step: '31-J', primaryRequirement: 'DHA-001', requirements: scopeConfig.requirements, status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, requirementCompletionClaimed: false, cleanEvidence: validation, deliveredFoundation: scopeConfig.targets, requiredFutureGates: scopeConfig.requiredFutureGates, openBoundaries: scopeConfig.openBoundaries, requirementStatuses: Object.fromEntries(scopeConfig.requirements.map((id) => [id, 'OPEN_FOUNDATION_ONLY'])), newBuildIssued: false, generatedAt: validatedAt });
console.log('31-J local validation: PASS (59/59 contract; 11/11 targeted; 8/8 runtime; 6/6 security; 184/184 full); awaiting D: Library receipt.');
