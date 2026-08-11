import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json',
  execution: 'artifacts/checkpoints/31-T_EXECUTION_RECORD.json', failures: 'artifacts/checkpoints/31-T_INITIAL_VALIDATION_FAILURES.json',
  scopeConfig: 'config/31-t-family-import-governed-rollback-receipt-fence-scope.json',
  contract: 'artifacts/validation/31-T_FAMILY_IMPORT_GOVERNED_ROLLBACK_RECEIPT_FENCE_CONTRACT.json',
  typecheck: 'artifacts/validation/31-T_ROOT_TYPESCRIPT.json', targeted: 'artifacts/validation/31-T_TARGETED_VITEST.json',
  migrations: 'artifacts/validation/31-T_DATABASE_MIGRATION_68.json', policy: 'artifacts/validation/31-T_PLATFORM_POLICY.json',
  decisions: 'artifacts/validation/31-T_USER_DECISION_LEDGER.json', regression: 'artifacts/validation/31-T_FULL_VITEST_REGRESSION.json',
  build: 'artifacts/validation/31-T_PRODUCTION_BUILD.json', platform: 'artifacts/validation/platform-policy-gate.json',
  scope: 'artifacts/inventory/31-T_SCOPE_AND_STATUS_REPORT.json', audit: 'docs/audit/31-T_PPK-002_FAMILY_IMPORT_GOVERNED_ROLLBACK_RECEIPT_FENCE.md'
};
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => { await mkdir(dirname(full(path)), { recursive: true }); await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); };
const stripAnsi = (value) => value.replace(/\u001b\[[0-9;]*m/gu, '');
const tail = (value) => stripAnsi(value).trim().split(/\r?\n/u).slice(-35).join('\n');
const run = (name, args, cwd = root) => {
  const started = performance.now();
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
  return { name, command: `node ${args.join(' ')}`, status: result.status === 0 ? 'PASS' : 'FAIL', processExitCode: result.status ?? 1,
    durationSeconds: Number(((performance.now() - started) / 1000).toFixed(2)), outputTail: tail(`${result.stdout ?? ''}\n${result.stderr ?? ''}`), stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
};
const publicResult = ({ stdout, stderr, ...result }) => result;
const pass = (result) => { if (result.status !== 'PASS') { console.error(result.outputTail); throw new Error(`${result.name} failed`); } };
const count = (text, pattern, label) => { const match = stripAnsi(text).match(pattern); if (!match) throw new Error(`Could not parse ${label}`); return Number(match[1]); };

const [plan, ledger, execution, scopeConfig, initialFailures] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.execution), readJson(paths.scopeConfig), readJson(paths.failures)
]);
const step = plan.steps.find((item) => item.id === '31-T');
if (!step || plan.currentStep !== '31-T' || step.status !== 'IN_PROGRESS' || ledger.activeMicroStep !== '31-T') throw new Error('31-T is not active');
const validationPending = execution.status === 'IN_PROGRESS_VALIDATION_PENDING' && scopeConfig.status === 'IN_PROGRESS';
const cleanRerun = execution.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT' && execution.validationStatus === 'PASS' && execution.persistentReceiptStatus === 'PENDING';
if (!validationPending && !cleanRerun) throw new Error('31-T is not awaiting local validation');
if (initialFailures.countsAsPass !== false || !initialFailures.failures.every((failure) => String(failure.rerunStatus).startsWith('PASS') || failure.rerunStatus === 'REMEDIATED_AWAITING_CLEAN_RERUN')) throw new Error('31-T failed attempts are not truthfully retained');

const contractRun = run('31-T contract', ['scripts/verify-31-t-family-import-governed-rollback-receipt-fence-contract.mjs']); pass(contractRun);
const contract = await readJson(paths.contract); if (contract.status !== 'PASS' || contract.failed !== 0) throw new Error('31-T contract report is not clean PASS');
const typecheck = run('Root TypeScript', ['node_modules/typescript/bin/tsc', '--noEmit']);
await writeJson(paths.typecheck, { schemaVersion: 1, release: plan.release, step: '31-T', phase: 'ROOT_TYPESCRIPT_NO_EMIT', ...publicResult(typecheck), diagnosticCount: typecheck.status === 'PASS' ? 0 : null, executedAt: new Date().toISOString() }); pass(typecheck);

const buildProjects = [
  'packages/application/tsconfig.json', 'packages/repository-contracts/tsconfig.json', 'packages/database/tsconfig.json', 'packages/repositories/tsconfig.json'
];
const packageBuilds = buildProjects.map((project) => run(`Build ${project}`, ['node_modules/typescript/bin/tsc', '-p', project])); packageBuilds.forEach(pass);
const targeted = run('Targeted Vitest', ['node_modules/vitest/vitest.mjs', 'run',
  'apps/desktop/tests/family-data-import-governed-rollback-runtime.test.ts',
  'apps/desktop/tests/location-cross-surface-privacy-runtime.test.ts',
  'apps/desktop/tests/family-data-import-policy-batch-runtime.test.ts',
  'apps/desktop/tests/family-data-import-location-read-receipt-runtime.test.ts'
]);
const targetedText = `${targeted.stdout}\n${targeted.stderr}`;
const targetedFiles = targeted.status === 'PASS' ? count(targetedText, /Test Files\s+(\d+) passed/u, 'targeted files') : null;
const targetedTests = targeted.status === 'PASS' ? count(targetedText, /Tests\s+(\d+) passed/u, 'targeted tests') : null;
await writeJson(paths.targeted, { schemaVersion: 1, release: plan.release, step: '31-T', phase: 'TARGETED_VITEST', ...publicResult(targeted), testFilePassCount: targetedFiles, testPassCount: targetedTests, testFileFailCount: targeted.status === 'PASS' ? 0 : null, testFailCount: targeted.status === 'PASS' ? 0 : null, executedAt: new Date().toISOString() }); pass(targeted);

const migration = run('Database migrations', ['scripts/verify-database-migrations.mjs']); pass(migration);
const migration68Present = /"version":\s*68[\s\S]{0,200}"name":\s*"ppk002_family_import_governed_rollback_receipt_fence"/u.test(`${migration.stdout}\n${migration.stderr}`);
if (!migration68Present) throw new Error('Migration verifier did not expose migration 68');
await writeJson(paths.migrations, { schemaVersion: 1, release: plan.release, step: '31-T', phase: 'DATABASE_MIGRATION_68', ...publicResult(migration), migration: 68, name: 'ppk002_family_import_governed_rollback_receipt_fence', registeredAndExecutable: true, executedAt: new Date().toISOString() });

const policy = run('Platform Policy gate', ['scripts/verify-platform-policy-gate.mjs']); pass(policy);
const platform = await readJson(paths.platform); if (platform.status !== 'PASS' || platform.newBypassCount !== 0 || platform.runtimeStatus !== 'PASS') throw new Error('Platform Policy is not clean PASS');
await writeJson(paths.policy, { schemaVersion: 1, release: plan.release, step: '31-T', phase: 'PLATFORM_POLICY', ...publicResult(policy), legacyBypassCount: platform.legacyBypassCount, newBypassCount: 0, runtimeStatus: platform.runtimeStatus, executedAt: new Date().toISOString() });
const decisionGate = run('User decision ledger', ['scripts/verify-user-decision-ledger.mjs']); pass(decisionGate);
await writeJson(paths.decisions, { schemaVersion: 1, release: plan.release, step: '31-T', phase: 'USER_DECISION_LEDGER', ...publicResult(decisionGate), decision: 'DEC-181', executedAt: new Date().toISOString() });

const regression = run('Full Vitest regression', ['node_modules/vitest/vitest.mjs', 'run']);
const regressionText = `${regression.stdout}\n${regression.stderr}`;
const fullFiles = regression.status === 'PASS' ? count(regressionText, /Test Files\s+(\d+) passed/u, 'full files') : null;
const fullTests = regression.status === 'PASS' ? count(regressionText, /Tests\s+(\d+) passed/u, 'full tests') : null;
await writeJson(paths.regression, { schemaVersion: 1, release: plan.release, step: '31-T', phase: 'FULL_VITEST_REGRESSION', ...publicResult(regression), testFilePassCount: fullFiles, testPassCount: fullTests, testFileFailCount: regression.status === 'PASS' ? 0 : null, testFailCount: regression.status === 'PASS' ? 0 : null, executedAt: new Date().toISOString() }); pass(regression);

const electron = run('Electron production compile', ['scripts/build-electron.mjs'], resolve(root, 'apps/desktop')); pass(electron);
const renderer = run('Renderer production build', ['../../node_modules/vite/bin/vite.js', 'build'], resolve(root, 'apps/desktop')); pass(renderer);
await writeJson(paths.build, { schemaVersion: 1, release: plan.release, step: '31-T', phase: 'PRODUCTION_BUILD', status: 'PASS', affectedPackageBuilds: packageBuilds.map(publicResult), commands: [publicResult(electron), publicResult(renderer)], executedAt: new Date().toISOString() });

const validatedAt = new Date().toISOString();
const validation = {
  contract: `PASS_${contract.passed}_OF_${contract.expected}`, rootTypeScript: 'PASS_0_DIAGNOSTICS', affectedPackageBuilds: `PASS_${packageBuilds.length}_OF_${packageBuilds.length}`,
  targetedVitest: `PASS_${targetedTests}_OF_${targetedTests}_IN_${targetedFiles}_FILES`, migration68: 'PASS_REGISTERED_AND_EXECUTABLE',
  platformPolicy: `PASS_LEGACY_${platform.legacyBypassCount}_NEW_BYPASS_0_RUNTIME_PASS`, userDecisionLedger: 'PASS_DEC_181',
  fullVitest: `PASS_${fullTests}_OF_${fullTests}_IN_${fullFiles}_FILES`, productionBuild: 'PASS'
};
const evidence = [paths.contract, paths.typecheck, paths.targeted, paths.migrations, paths.policy, paths.decisions, paths.regression, paths.build, paths.failures, paths.scope, paths.audit];
evidence.forEach((path) => { if (!step.localEvidence.includes(path)) step.localEvidence.push(path); });
Object.assign(step, { validationStatus: 'PASS', persistentReceiptStatus: 'PENDING' });
plan.updatedAt = validatedAt;
plan.segmentationNote = `31-T is LOCAL_PASS_AWAITING_LIBRARY_RECEIPT after ${contract.passed}/${contract.expected} contract checks, ${targetedTests}/${targetedTests} targeted tests and ${fullTests}/${fullTests} full tests. PPK-002 remains PARTIAL; universal repository enforcement, obligation execution and external monotonic rollback authority remain open.`;
await writeJson(paths.plan, plan);
ledger.libraryUploadStatus = '31-T_FAMILY_IMPORT_GOVERNED_ROLLBACK_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'; ledger.updatedAt = validatedAt; await writeJson(paths.ledger, ledger);
Object.assign(execution, { status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, validation, evidence, PPK002: 'PARTIAL', requirementCompletionClaimed: false, newBuildIssued: false, validatedAt }); await writeJson(paths.execution, execution);
Object.assign(scopeConfig, { status: 'IN_PROGRESS', targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING', validatedAt }); await writeJson(paths.scopeConfig, scopeConfig);
await writeJson(paths.scope, { schemaVersion: 1, release: plan.release, step: '31-T', primaryRequirement: 'PPK-002', requirements: ['PPK-002'], status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, requirementCompletionClaimed: false, cleanEvidence: validation, deliveredBoundary: scopeConfig.targets, openBoundaries: scopeConfig.openBoundaries, requirementStatuses: { 'PPK-002': 'PARTIAL' }, newBuildIssued: false, generatedAt: validatedAt });
const audit = `# 31-T PPK-002 family import governed rollback receipt fence\n\nStatus: \`LOCAL_PASS_AWAITING_LIBRARY_RECEIPT\`\n\n## Teslim edilen sınır\n\n- Import batch ile yaratılmış governed event ve location satırları için satır başına taze, exact delete policy receipt zorunludur.\n- Create receipt, batch/family/owner, canlı policy fence ve journal projection bağları veritabanında doğrulanır.\n- Yetki, tombstone, iş satırı silme, batch durumu ve audit tek SQLite transaction içinde yürür.\n- Tombstone değiştirilemez, silinemez ve tek kullanımlıdır; completion fence bütün satırların yokluğunu ve bütün governed tombstone'ların tüketimini ister.\n- Eski NULL-receipt import satırlarının kontrollü rollback uyumluluğu korunur.\n\n## Temiz doğrulama\n\n- Contract: ${contract.passed}/${contract.expected} PASS.\n- Root TypeScript: 0 diagnostic.\n- Targeted Vitest: ${targetedTests}/${targetedTests}, ${targetedFiles} dosya.\n- Migration 68, Platform Policy ve DEC-181 ledger: PASS.\n- Full Vitest: ${fullTests}/${fullTests}, ${fullFiles} dosya.\n- Affected package, Electron ve renderer production build: PASS.\n\n## Açık sınırlar\n\nPPK-002 halen PARTIAL'dır. Universal repository enforcement, obligation execution ve external monotonic rollback authority bu dilimde tamamlanmamıştır. Yeni Build verilmemiştir. İlk başarısız deneme \`artifacts/checkpoints/31-T_INITIAL_VALIDATION_FAILURES.json\` içinde PASS sayılmadan saklanır.\n`;
await mkdir(dirname(full(paths.audit)), { recursive: true }); await writeFile(full(paths.audit), audit, 'utf8');
initialFailures.failures.forEach((failure) => { if (failure.rerunStatus === 'REMEDIATED_AWAITING_CLEAN_RERUN') failure.rerunStatus = `PASS_WITH_FINAL_CLEAN_VALIDATION_${contract.passed}_OF_${contract.expected}`; });
await writeJson(paths.failures, initialFailures);
console.log(`31-T local validation: PASS (${contract.passed}/${contract.expected} contract; ${targetedTests}/${targetedTests} targeted; ${fullTests}/${fullTests} full); awaiting D: Library receipt.`);
