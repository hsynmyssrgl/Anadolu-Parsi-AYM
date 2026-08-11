import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json',
  execution: 'artifacts/checkpoints/31-I_EXECUTION_RECORD.json', scopeConfig: 'config/31-i-headless-device-secret-protection-boundary-scope.json',
  contract: 'artifacts/validation/31-I_HEADLESS_DEVICE_SECRET_PROTECTION_CONTRACT.json',
  typecheck: 'artifacts/validation/31-I_ROOT_TYPESCRIPT.json', targeted: 'artifacts/validation/31-I_TARGETED_VITEST.json',
  runtime: 'artifacts/validation/31-I_CORE_SERVICE_RUNTIME.json', legacy: 'artifacts/validation/31-I_DEVICE_SECRET_REGRESSION.json',
  regression: 'artifacts/validation/31-I_FULL_VITEST_REGRESSION.json', build: 'artifacts/validation/31-I_PRODUCTION_BUILD.json',
  platform: 'artifacts/validation/platform-policy-gate.json', scope: 'artifacts/inventory/31-I_SCOPE_AND_STATUS_REPORT.json',
  audit: 'docs/audit/31-I_HEADLESS_DEVICE_SECRET_PROTECTION_BOUNDARY.md'
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
const step = plan.steps.find((item) => item.id === '31-I');
if (!step || plan.currentStep !== '31-I' || step.status !== 'IN_PROGRESS') throw new Error('31-I is not active');
if (execution.status !== 'IN_PROGRESS_VALIDATION_PENDING' || scopeConfig.status !== 'IN_PROGRESS') throw new Error('31-I is not awaiting validation');
await readFile(full(paths.audit), 'utf8');

const contractRun = run('31-I contract', ['scripts/verify-31-i-headless-device-secret-protection-boundary-contract.mjs']); pass(contractRun);
const contract = await readJson(paths.contract);
if (contract.status !== 'PASS' || contract.failed !== 0 || contract.passed !== 49) throw new Error('31-I contract is not 49/49 PASS');
const typecheck = run('Root TypeScript', ['node_modules/typescript/bin/tsc', '--noEmit']);
await writeJson(paths.typecheck, { schemaVersion: 1, release: plan.release, step: '31-I', phase: 'ROOT_TYPESCRIPT_NO_EMIT', ...publicResult(typecheck), diagnosticCount: typecheck.status === 'PASS' ? 0 : null, executedAt: new Date().toISOString() }); pass(typecheck);

const buildProjects = ['packages/security/tsconfig.json', 'packages/core-service-contracts/tsconfig.json', 'packages/core-service-client/tsconfig.json', 'apps/core-service/tsconfig.json'];
const packageBuilds = buildProjects.map((project) => run(`Build ${project}`, ['node_modules/typescript/bin/tsc', '-p', project]));
packageBuilds.forEach(pass);
const targeted = run('Targeted Vitest', ['node_modules/vitest/vitest.mjs', 'run', 'apps/core-service/tests/core-service-method-dispatcher.test.ts', 'apps/core-service/tests/family-data-ownership-runtime.test.ts', 'apps/core-service/tests/device-secret-protection-runtime.test.ts']);
const targetedText = `${targeted.stdout}\n${targeted.stderr}`;
const targetedFiles = targeted.status === 'PASS' ? count(targetedText, /Test Files\s+(\d+) passed/u, 'targeted files') : null;
const targetedTests = targeted.status === 'PASS' ? count(targetedText, /Tests\s+(\d+) passed/u, 'targeted tests') : null;
await writeJson(paths.targeted, { schemaVersion: 1, release: plan.release, step: '31-I', phase: 'TARGETED_VITEST', ...publicResult(targeted), testFilePassCount: targetedFiles, testPassCount: targetedTests, testFileFailCount: targeted.status === 'PASS' ? 0 : null, testFailCount: targeted.status === 'PASS' ? 0 : null, executedAt: new Date().toISOString() }); pass(targeted);
if (targetedFiles !== 3 || targetedTests !== 9) throw new Error(`Unexpected targeted count ${targetedFiles}/${targetedTests}`);

const runtimeCommands = [
  ['Core Service Local Admin contract', 'scripts/verify-core-service-local-admin-contract.mjs'], ['Core Service Local Admin runtime', 'scripts/verify-core-service-local-admin-runtime-wrapper.mjs'],
  ['Core Service boundary', 'scripts/verify-core-service-boundary.mjs'], ['Desktop startup contract', 'scripts/verify-desktop-core-service-startup-contract.mjs'],
  ['Desktop startup runtime', 'scripts/verify-desktop-core-service-startup-runtime-wrapper.mjs'], ['System Health contract', 'scripts/verify-system-health-core-service-ipc-contract.mjs'],
  ['System Health runtime', 'scripts/verify-system-health-core-service-ipc-runtime-wrapper.mjs'], ['Platform Policy gate', 'scripts/verify-platform-policy-gate.mjs']
];
const runtimeResults = runtimeCommands.map(([name, script]) => run(name, [script])); runtimeResults.forEach(pass);
await writeJson(paths.runtime, { schemaVersion: 1, release: plan.release, step: '31-I', phase: 'CORE_SERVICE_DEVICE_SECRET_RUNTIME_GATES', status: 'PASS', expected: 8, executed: 8, passed: 8, failed: 0, checks: runtimeResults.map(publicResult), executedAt: new Date().toISOString() });
const platform = await readJson(paths.platform); if (platform.status !== 'PASS' || platform.newBypassCount !== 0 || platform.runtimeStatus !== 'PASS') throw new Error('Platform Policy is not clean PASS');

const legacyCommands = [
  ['Device secret protector runtime', 'scripts/verify-device-secret-protector-runtime.mjs'], ['User data vault runtime', 'scripts/verify-build209-user-data-vault-runtime.mjs'],
  ['Volatile user data runtime', 'scripts/verify-build213-volatile-user-data-runtime.mjs'], ['DPAPI root-cause contract', 'scripts/verify-build227-root-cause-contract.mjs']
];
const legacyResults = legacyCommands.map(([name, script]) => run(name, [script])); legacyResults.forEach(pass);
await writeJson(paths.legacy, { schemaVersion: 1, release: plan.release, step: '31-I', phase: 'DEVICE_SECRET_AND_VAULT_REGRESSION', status: 'PASS', expected: 4, executed: 4, passed: 4, failed: 0, checks: legacyResults.map(publicResult), executedAt: new Date().toISOString() });

const regression = run('Full Vitest regression', ['node_modules/vitest/vitest.mjs', 'run']);
const regressionText = `${regression.stdout}\n${regression.stderr}`;
const fullFiles = regression.status === 'PASS' ? count(regressionText, /Test Files\s+(\d+) passed/u, 'full files') : null;
const fullTests = regression.status === 'PASS' ? count(regressionText, /Tests\s+(\d+) passed/u, 'full tests') : null;
await writeJson(paths.regression, { schemaVersion: 1, release: plan.release, step: '31-I', phase: 'FULL_VITEST_REGRESSION', ...publicResult(regression), testFilePassCount: fullFiles, testPassCount: fullTests, testFileFailCount: regression.status === 'PASS' ? 0 : null, testFailCount: regression.status === 'PASS' ? 0 : null, executedAt: new Date().toISOString() }); pass(regression);
if (fullFiles !== 35 || fullTests !== 182) throw new Error(`Unexpected full count ${fullFiles}/${fullTests}`);

const electron = run('Electron production compile', ['scripts/build-electron.mjs'], resolve(root, 'apps/desktop')); pass(electron);
const renderer = run('Renderer production build', ['../../node_modules/vite/bin/vite.js', 'build'], resolve(root, 'apps/desktop')); pass(renderer);
await writeJson(paths.build, { schemaVersion: 1, release: plan.release, step: '31-I', phase: 'PRODUCTION_BUILD', status: 'PASS', affectedPackageBuilds: packageBuilds.map(publicResult), electronMain: 'PASS', renderer: 'PASS', commands: [publicResult(electron), publicResult(renderer)], executedAt: new Date().toISOString() });

const validatedAt = new Date().toISOString();
const validation = { contract: 'PASS_49_OF_49', rootTypeScript: 'PASS_0_DIAGNOSTICS', affectedPackageBuilds: 'PASS_4_OF_4', targetedVitest: 'PASS_9_OF_9', runtimeGates: 'PASS_8_OF_8', deviceSecretRegression: 'PASS_4_OF_4', fullVitest: 'PASS_182_OF_182', productionBuild: 'PASS', platformPolicy: `PASS_LEGACY_${platform.legacyBypassCount}_NEW_BYPASS_0_RUNTIME_PASS` };
const evidence = [paths.contract, paths.typecheck, paths.targeted, paths.runtime, paths.legacy, paths.regression, paths.build, paths.platform, paths.scope, paths.audit];
for (const path of evidence) if (!step.localEvidence.includes(path)) step.localEvidence.push(path);
step.validationStatus = 'PASS'; step.persistentReceiptStatus = 'PENDING'; plan.updatedAt = validatedAt;
plan.segmentationNote = '31-I headless shared device-secret protection boundary is LOCAL_PASS_AWAITING_LIBRARY_RECEIPT after 49/49 contract, root TypeScript, four package builds, targeted 9/9, eight runtime gates, four device-secret/vault regressions, full Vitest 182/182 and production build PASS. Vault and SQLite ownership remain open; no requirement is COMPLETE and no new Build is issued.';
await writeJson(paths.plan, plan); ledger.libraryUploadStatus = '31-I_MAIN_STRUCTURE_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'; ledger.updatedAt = validatedAt; await writeJson(paths.ledger, ledger);
Object.assign(execution, { status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, validation, evidence, requirementCompletionClaimed: false, newBuildIssued: false, validatedAt }); await writeJson(paths.execution, execution);
Object.assign(scopeConfig, { status: 'IN_PROGRESS', targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING', validatedAt }); await writeJson(paths.scopeConfig, scopeConfig);
await writeJson(paths.scope, { schemaVersion: 1, release: plan.release, step: '31-I', primaryRequirement: 'DHA-001', requirements: scopeConfig.requirements, status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, requirementCompletionClaimed: false, cleanEvidence: validation, deliveredFoundation: scopeConfig.targets, openBoundaries: scopeConfig.openBoundaries, requirementStatuses: Object.fromEntries(scopeConfig.requirements.map((id) => [id, 'OPEN_FOUNDATION_ONLY'])), newBuildIssued: false, generatedAt: validatedAt });
console.log('31-I local validation: PASS (49/49 contract; 9/9 targeted; 8/8 runtime; 4/4 legacy; 182/182 full); awaiting D: Library receipt.');
