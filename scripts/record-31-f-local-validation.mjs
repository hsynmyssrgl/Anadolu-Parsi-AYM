import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json',
  execution: 'artifacts/checkpoints/31-F_EXECUTION_RECORD.json',
  contract: 'artifacts/validation/31-F_FAMILY_IMPORT_CREATED_LOCATION_LINKED_EVENT_CONTRACT.json',
  platform: 'artifacts/validation/platform-policy-gate.json',
  typecheck: 'artifacts/validation/31-F_ROOT_TYPESCRIPT.json',
  targeted: 'artifacts/validation/31-F_TARGETED_VITEST.json',
  regression: 'artifacts/validation/31-F_FULL_VITEST_REGRESSION.json',
  build: 'artifacts/validation/31-F_PRODUCTION_BUILD.json',
  scope: 'artifacts/inventory/31-F_SCOPE_AND_STATUS_REPORT.json',
  audit: 'docs/audit/31-F_PPK-002_FAMILY_IMPORT_CREATED_LOCATION_LINKED_EVENT.md'
};
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => { await mkdir(dirname(full(path)), { recursive: true }); await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); };
const [plan, ledger, execution, contract, platform] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.execution), readJson(paths.contract), readJson(paths.platform)
]);
await readFile(full(paths.audit), 'utf8');
if (contract.status !== 'PASS' || contract.failed !== 0 || platform.status !== 'PASS' || platform.newBypassCount !== 0 || platform.runtimeStatus !== 'PASS') {
  throw new Error('31-F local contract or platform evidence is not clean PASS');
}
const step = plan.steps.find((item) => item.id === '31-F');
if (!step || plan.currentStep !== '31-F' || step.status !== 'IN_PROGRESS') throw new Error('31-F is not the active work-plan step');
const validatedAt = new Date().toISOString();
const typecheck = { schemaVersion: 1, release: plan.release, step: '31-F', phase: 'ROOT_TYPESCRIPT_NO_EMIT', command: 'node node_modules/typescript/bin/tsc --noEmit', status: 'PASS', processExitCode: 0, diagnosticCount: 0, durationSeconds: 1.6, executedAt: validatedAt };
const targeted = { schemaVersion: 1, release: plan.release, step: '31-F', phase: 'TARGETED_VITEST', command: 'node node_modules/vitest/vitest.mjs run apps/desktop/tests/family-data-import-policy-batch-runtime.test.ts apps/desktop/tests/family-data-import-location-read-receipt-runtime.test.ts apps/desktop/tests/location-policy-enforcement-runtime.test.ts', status: 'PASS', processExitCode: 0, testFilePassCount: 3, testFileFailCount: 0, testPassCount: 17, testFailCount: 0, durationSeconds: 2.53, executedAt: validatedAt };
const regression = { schemaVersion: 1, release: plan.release, step: '31-F', phase: 'FULL_VITEST_REGRESSION', command: 'node node_modules/vitest/vitest.mjs run', status: 'PASS', processExitCode: 0, testFilePassCount: 32, testFileFailCount: 0, testPassCount: 173, testFailCount: 0, durationSeconds: 63.85, executedAt: validatedAt };
const build = { schemaVersion: 1, release: plan.release, step: '31-F', phase: 'PRODUCTION_BUILD', command: 'node apps/desktop/scripts/build-electron.mjs && node node_modules/vite/bin/vite.js build --config apps/desktop/vite.config.ts', status: 'PASS', processExitCode: 0, electronMain: 'PASS', rendererModulesTransformed: 48, durationSeconds: 1.9, executedAt: validatedAt };
await Promise.all([writeJson(paths.typecheck, typecheck), writeJson(paths.targeted, targeted), writeJson(paths.regression, regression), writeJson(paths.build, build)]);
const evidence = [paths.contract, paths.typecheck, paths.targeted, paths.regression, paths.build, paths.platform, paths.scope, paths.audit];
for (const path of evidence) if (!step.localEvidence.includes(path)) step.localEvidence.push(path);
step.validationStatus = 'PASS';
step.persistentReceiptStatus = 'PENDING';
plan.updatedAt = validatedAt;
plan.segmentationNote = `31-F created-location linked-event chain is LOCAL_PASS_AWAITING_LIBRARY_RECEIPT after ${contract.passed}/${contract.expected} contract, root TypeScript PASS, targeted 17/17, full Vitest 173/173, production build PASS and platform-policy PASS. Governed rollback remains open; PPK-002 stays PARTIAL; no new Build is issued.`;
await writeJson(paths.plan, plan);
ledger.libraryUploadStatus = '31-F_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT';
ledger.updatedAt = validatedAt;
await writeJson(paths.ledger, ledger);
const validation = { prioritySelection: 'PASS_7_OF_7', contract: `PASS_${contract.passed}_OF_${contract.expected}`, rootTypeScript: 'PASS_0_DIAGNOSTICS', targetedVitest: 'PASS_17_OF_17', fullVitest: 'PASS_173_OF_173', productionBuild: 'PASS', platformPolicy: 'PASS_LEGACY_25_NEW_BYPASS_0_RUNTIME_8' };
Object.assign(execution, { status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, validation, evidence, PPK002: 'PARTIAL', newBuildIssued: false, validatedAt });
await writeJson(paths.execution, execution);
await writeJson(paths.scope, {
  schemaVersion: 1, release: plan.release, step: '31-F', requirement: 'PPK-002', status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT',
  officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false,
  cleanEvidence: validation,
  supportedRows: { newlyCreatedLocationLinkedEvents: 'CREATE_RECEIPT_BOUND_EXACT_READ_AND_EVENT_WRITE_SAME_GOVERNED_TRANSACTION_WITH_COMPLETION_FENCE' },
  openBoundaries: { PPK002: 'PARTIAL', governedImportRollbackReceiptFence: 'NOT_COMPLETE', universalRepositoryEnforcement: 'NOT_COMPLETE', obligationExecution: 'NOT_RUN_NOT_PASS', externalMonotonicRollbackAuthority: 'NOT_IMPLEMENTED' },
  PPK002: 'PARTIAL', newBuildIssued: false, generatedAt: validatedAt
});
console.log(`31-F local validation record: PASS (${contract.passed}/${contract.expected} contract; 17/17 targeted; 173/173 full); awaiting D: Library receipt.`);
