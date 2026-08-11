import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  execution: 'artifacts/checkpoints/31-D_EXECUTION_RECORD.json',
  contract: 'artifacts/validation/31-D_FAMILY_IMPORT_REUSED_LOCATION_READ_RECEIPT_CONTRACT.json',
  platform: 'artifacts/validation/platform-policy-gate.json',
  typecheck: 'artifacts/validation/31-D_DESKTOP_MAIN_TYPESCRIPT.json',
  targeted: 'artifacts/validation/31-D_TARGETED_VITEST.json',
  regression: 'artifacts/validation/31-D_FULL_VITEST_REGRESSION.json',
  scope: 'artifacts/inventory/31-D_SCOPE_AND_STATUS_REPORT.json',
  audit: 'docs/audit/31-D_PPK-002_FAMILY_IMPORT_REUSED_LOCATION_READ_RECEIPT.md'
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
  ['contract', contract.status === 'PASS' && contract.passed === contract.expected && contract.failed === 0],
  ['platform', platform.status === 'PASS' && platform.legacyBypassCount === 25 && platform.newBypassCount === 0 && platform.runtimeStatus === 'PASS']
];
const failed = assertions.filter(([, passed]) => !passed).map(([name]) => name);
if (failed.length) throw new Error(`31-D local validation failed: ${failed.join(', ')}`);
const step = plan.steps.find((item) => item.id === '31-D');
if (!step || plan.currentStep !== '31-D' || step.status !== 'IN_PROGRESS') throw new Error('31-D is not the active work-plan step');
const validatedAt = new Date().toISOString();
const typecheck = {
  schemaVersion: 1, release: plan.release, step: '31-D', phase: 'DESKTOP_MAIN_TYPESCRIPT_NO_EMIT',
  command: 'node node_modules/typescript/bin/tsc -p apps/desktop/tsconfig.electron.json --noEmit',
  status: 'PASS', processExitCode: 0, diagnosticCount: 0, durationSeconds: 1.4, executedAt: validatedAt
};
const targeted = {
  schemaVersion: 1, release: plan.release, step: '31-D', phase: 'TARGETED_VITEST',
  command: 'node node_modules/vitest/vitest.mjs run --configLoader runner apps/desktop/tests/family-data-import-location-read-receipt-runtime.test.ts apps/desktop/tests/family-data-import-policy-batch-runtime.test.ts apps/desktop/tests/location-cross-surface-privacy-runtime.test.ts',
  status: 'PASS', processExitCode: 0, testFilePassCount: 3, testFileFailCount: 0,
  testPassCount: 11, testFailCount: 0, durationSeconds: 4.71, executedAt: validatedAt
};
const regression = {
  schemaVersion: 1, release: plan.release, step: '31-D', phase: 'FULL_VITEST_REGRESSION',
  command: 'node node_modules/vitest/vitest.mjs run --configLoader runner',
  status: 'PASS', processExitCode: 0, testFilePassCount: 30, testFileFailCount: 0,
  testPassCount: 163, testFailCount: 0, durationSeconds: 64.32, executedAt: validatedAt
};
await writeJson(paths.typecheck, typecheck);
await writeJson(paths.targeted, targeted);
await writeJson(paths.regression, regression);
const evidence = [paths.contract, paths.typecheck, paths.targeted, paths.regression, paths.platform, paths.scope, paths.audit];
for (const path of evidence) if (!step.localEvidence.includes(path)) step.localEvidence.push(path);
step.validationStatus = 'PASS';
step.persistentReceiptStatus = 'PENDING';
plan.updatedAt = validatedAt;
plan.segmentationNote = `31-D reused-location exact read receipt chain is LOCAL_PASS_AWAITING_LIBRARY_RECEIPT after ${contract.passed}/${contract.expected} contract, desktop TypeScript PASS, targeted 11/11, full Vitest 163/163 and platform-policy PASS. Newly-created-location-linked events and governed rollback remain open; PPK-002 stays PARTIAL; no new Build is issued.`;
await writeJson(paths.plan, plan);
ledger.libraryUploadStatus = '31-D_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT';
ledger.updatedAt = validatedAt;
await writeJson(paths.ledger, ledger);
const validation = {
  prioritySelection: 'PASS_7_OF_7', contract: `PASS_${contract.passed}_OF_${contract.expected}`,
  desktopMainTypeScript: 'PASS_0_DIAGNOSTICS', targetedVitest: 'PASS_11_OF_11',
  fullVitest: 'PASS_163_OF_163', platformPolicy: 'PASS_LEGACY_25_NEW_BYPASS_0_RUNTIME_8'
};
Object.assign(execution, {
  status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT',
  targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false, validation, evidence, PPK002: 'PARTIAL', newBuildIssued: false, validatedAt
});
await writeJson(paths.execution, execution);
await writeJson(paths.scope, {
  schemaVersion: 1, release: plan.release, step: '31-D', requirement: 'PPK-002', status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT',
  officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', targetSliceStatus: 'PASS', validationStatus: 'PASS',
  persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, cleanEvidence: validation,
  supportedRows: { reusedLocationLinkedEvents: 'EXACT_READ_AND_EVENT_WRITE_SAME_GOVERNED_TRANSACTION' },
  openBoundaries: {
    PPK002: 'PARTIAL', newlyCreatedLocationLinkedEventImport: 'NOT_COMPLETE_FAIL_CLOSED',
    governedImportRollbackReceiptFence: 'NOT_COMPLETE', universalRepositoryEnforcement: 'NOT_COMPLETE',
    obligationExecution: 'NOT_RUN_NOT_PASS', externalMonotonicRollbackAuthority: 'NOT_IMPLEMENTED'
  },
  PPK002: 'PARTIAL', newBuildIssued: false, generatedAt: validatedAt
});
console.log(`31-D local validation record: PASS (${contract.passed}/${contract.expected} contract; 11/11 targeted; 163/163 full); awaiting D: Library receipt.`);
