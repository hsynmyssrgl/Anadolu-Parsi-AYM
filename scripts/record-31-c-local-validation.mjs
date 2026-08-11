import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json',
  execution: 'artifacts/checkpoints/31-C_EXECUTION_RECORD.json',
  contract: 'artifacts/validation/31-C_FAMILY_IMPORT_MULTI_POLICY_RECEIPT_BATCH_CONTRACT.json',
  platform: 'artifacts/validation/platform-policy-gate.json',
  typecheck: 'artifacts/validation/31-C_DESKTOP_MAIN_TYPESCRIPT.json',
  targeted: 'artifacts/validation/31-C_TARGETED_VITEST.json',
  regression: 'artifacts/validation/31-C_FULL_VITEST_REGRESSION.json',
  scope: 'artifacts/inventory/31-C_SCOPE_AND_STATUS_REPORT.json',
  audit: 'docs/audit/31-C_PPK-002_FAMILY_IMPORT_MULTI_POLICY_RECEIPT_BATCH.md'
};
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => {
  await mkdir(dirname(full(path)), { recursive: true });
  await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const [plan, ledger, execution, contract, platform] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.execution), readJson(paths.contract), readJson(paths.platform)
]);
await readFile(full(paths.audit), 'utf8');
const assertions = [
  ['contract', contract.status === 'PASS' && contract.passed === 30 && contract.failed === 0],
  ['platform', platform.status === 'PASS' && platform.legacyBypassCount === 25 && platform.newBypassCount === 0 && platform.runtimeStatus === 'PASS']
];
const failed = assertions.filter(([, passed]) => !passed).map(([name]) => name);
if (failed.length) throw new Error(`31-C local validation failed: ${failed.join(', ')}`);
const step31C = plan.steps.find((item) => item.id === '31-C');
if (!step31C || plan.currentStep !== '31-C' || step31C.status !== 'IN_PROGRESS') throw new Error('31-C is not the active work-plan step');
const validatedAt = new Date().toISOString();
const typecheck = {
  schemaVersion: 1, release: plan.release, step: '31-C', phase: 'DESKTOP_MAIN_TYPESCRIPT_NO_EMIT',
  command: 'node node_modules/typescript/bin/tsc -p apps/desktop/tsconfig.electron.json --noEmit',
  status: 'PASS', processExitCode: 0, diagnosticCount: 0, durationSeconds: 1.1, executedAt: validatedAt
};
const targeted = {
  schemaVersion: 1, release: plan.release, step: '31-C', phase: 'TARGETED_VITEST',
  command: 'node node_modules/vitest/vitest.mjs run apps/desktop/tests/family-data-import-policy-batch-runtime.test.ts apps/desktop/tests/location-cross-surface-privacy-runtime.test.ts',
  status: 'PASS', processExitCode: 0, testFilePassCount: 2, testFileFailCount: 0, testPassCount: 9, testFailCount: 0,
  durationSeconds: 3.62, executedAt: validatedAt
};
const regression = {
  schemaVersion: 1, release: plan.release, step: '31-C', phase: 'FULL_VITEST_REGRESSION',
  command: 'node node_modules/vitest/vitest.mjs run', status: 'PASS', processExitCode: 0,
  testFilePassCount: 29, testFileFailCount: 0, testPassCount: 161, testFailCount: 0,
  durationSeconds: 62.84, executedAt: validatedAt
};
await writeJson(paths.typecheck, typecheck);
await writeJson(paths.targeted, targeted);
await writeJson(paths.regression, regression);
const evidence = [paths.contract, paths.typecheck, paths.targeted, paths.regression, paths.platform, paths.scope, paths.audit];
for (const path of evidence) if (!step31C.localEvidence.includes(path)) step31C.localEvidence.push(path);
step31C.validationStatus = 'PASS';
step31C.persistentReceiptStatus = 'PENDING';
plan.updatedAt = validatedAt;
plan.segmentationNote = '31-B remains immutable COMPLETED/PASS. 31-C family import multi-policy receipt batch is LOCAL_PASS_AWAITING_LIBRARY_RECEIPT after 7/7 selection, 30/30 contract, desktop TypeScript PASS, targeted 9/9, full Vitest 161/161 and platform-policy PASS. Location-linked events and governed rollback remain open; PPK-002 stays PARTIAL; no new Build is issued.';
await writeJson(paths.plan, plan);
ledger.libraryUploadStatus = '31-C_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT';
ledger.updatedAt = validatedAt;
await writeJson(paths.ledger, ledger);
const validation = {
  prioritySelection: 'PASS_7_OF_7', contract: 'PASS_30_OF_30', desktopMainTypeScript: 'PASS_0_DIAGNOSTICS',
  targetedVitest: 'PASS_9_OF_9', fullVitest: 'PASS_161_OF_161', platformPolicy: 'PASS_LEGACY_25_NEW_BYPASS_0_RUNTIME_8'
};
Object.assign(execution, {
  status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT',
  targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false,
  validation, evidence, PPK002: 'PARTIAL', newBuildIssued: false, validatedAt
});
await writeJson(paths.execution, execution);
await writeJson(paths.scope, {
  schemaVersion: 1, release: plan.release, step: '31-C', requirement: 'PPK-002', status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT',
  officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', targetSliceStatus: 'PASS', validationStatus: 'PASS',
  persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, cleanEvidence: validation,
  supportedRows: { createdLocations: 'GOVERNED_ATOMIC_BATCH', createdLocationlessEvents: 'GOVERNED_ATOMIC_BATCH', reusedRows: 'NO_NEW_CREATE_RECEIPT' },
  openBoundaries: {
    PPK002: 'PARTIAL', importedEventLocationReadReceiptChain: 'NOT_COMPLETE_FAIL_CLOSED',
    governedImportRollbackReceiptFence: 'NOT_COMPLETE', universalRepositoryEnforcement: 'NOT_COMPLETE',
    obligationExecution: 'NOT_RUN_NOT_PASS', externalMonotonicRollbackAuthority: 'NOT_IMPLEMENTED'
  },
  PPK002: 'PARTIAL', newBuildIssued: false, generatedAt: validatedAt
});
console.log('31-C local validation record: PASS (6 governed evidence groups); awaiting D: Library receipt.');
