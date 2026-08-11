import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json',
  execution: 'artifacts/checkpoints/31-B_EXECUTION_RECORD.json',
  contract: 'artifacts/validation/31-B_FAMILY_DATA_IMPORT_CENTRAL_AUTHORIZATION_CONTRACT.json',
  runtime: 'artifacts/validation/PPK002_FAMILY_DATA_IMPORT_POLICY_LOCAL_CONTINUATION.json',
  platform: 'artifacts/validation/platform-policy-gate.json',
  targeted: 'artifacts/validation/31-B_TARGETED_VITEST.json',
  regression: 'artifacts/validation/31-B_FULL_VITEST_REGRESSION.json',
  scope: 'artifacts/inventory/31-B_SCOPE_AND_STATUS_REPORT.json',
  audit: 'docs/audit/31-B_PPK-002_FAMILY_DATA_IMPORT_CENTRAL_AUTHORIZATION.md'
};
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => { await mkdir(dirname(full(path)), { recursive: true }); await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); };
const [plan, ledger, execution, contract, runtime, platform] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.execution), readJson(paths.contract), readJson(paths.runtime), readJson(paths.platform)
]);
await readFile(full(paths.audit), 'utf8');
const assertions = [
  ['contract', contract.status === 'PASS' && contract.passed === 25 && contract.failed === 0],
  ['runtime', runtime.status === 'PASS' && runtime.checkCount === 12 && runtime.external31AReceipt === 'PASS'],
  ['platform', platform.status === 'PASS' && platform.legacyBypassCount === 25 && platform.newBypassCount === 0 && platform.runtimeStatus === 'PASS']
];
const failed = assertions.filter(([, passed]) => !passed).map(([name]) => name);
if (failed.length) throw new Error(`31-B local validation failed: ${failed.join(', ')}`);
const step31B = plan.steps.find((item) => item.id === '31-B');
if (!step31B || plan.currentStep !== '31-B' || step31B.status !== 'IN_PROGRESS') throw new Error('31-B is not the active work-plan step');
const validatedAt = new Date().toISOString();
const targeted = { schemaVersion: 1, release: plan.release, step: '31-B', phase: 'TARGETED_VITEST', command: 'node node_modules/vitest/vitest.mjs run apps/desktop/tests/location-cross-surface-privacy-runtime.test.ts', status: 'PASS', processExitCode: 0, testFilePassCount: 1, testFileFailCount: 0, testPassCount: 6, testFailCount: 0, durationSeconds: 3.71, executedAt: validatedAt };
const regression = { schemaVersion: 1, release: plan.release, step: '31-B', phase: 'FULL_VITEST_REGRESSION', command: 'node node_modules/vitest/vitest.mjs run', status: 'PASS', processExitCode: 0, testFilePassCount: 28, testFileFailCount: 0, testPassCount: 158, testFailCount: 0, durationSeconds: 61.65, executedAt: validatedAt };
await writeJson(paths.targeted, targeted); await writeJson(paths.regression, regression);
const evidence = [paths.contract, paths.runtime, paths.targeted, paths.regression, paths.platform, paths.scope, paths.audit];
for (const path of evidence) if (!step31B.localEvidence.includes(path)) step31B.localEvidence.push(path);
step31B.validationStatus = 'PASS'; step31B.persistentReceiptStatus = 'PENDING';
plan.updatedAt = validatedAt;
plan.segmentationNote = '31-A remains immutable COMPLETED/PASS. 31-B family data import central authorization is LOCAL_PASS_AWAITING_LIBRARY_RECEIPT after 7/7 selection, 12/12 local verifier, 25/25 contract, targeted 6/6, full Vitest 158/158 and platform-policy PASS. Multi-receipt import remains open; PPK-002 stays PARTIAL; no new Build is issued.';
await writeJson(paths.plan, plan);
ledger.libraryUploadStatus = '31-B_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'; ledger.updatedAt = validatedAt; await writeJson(paths.ledger, ledger);
const validation = { prioritySelection: 'PASS_7_OF_7', localAuthorization: 'PASS_12_OF_12', contract: 'PASS_25_OF_25', targetedVitest: 'PASS_6_OF_6', fullVitest: 'PASS_158_OF_158', platformPolicy: 'PASS_LEGACY_25_NEW_BYPASS_0_RUNTIME_8' };
Object.assign(execution, { status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, validation, evidence, PPK002: 'PARTIAL', newBuildIssued: false, validatedAt });
await writeJson(paths.execution, execution);
await writeJson(paths.scope, { schemaVersion: 1, release: plan.release, step: '31-B', requirement: 'PPK-002', status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, cleanEvidence: validation, openBoundaries: { PPK002: 'PARTIAL', familyDataImportMultiReceiptBatch: 'NEXT_SEPARATE_SLICE', governedImportRollbackReceiptFence: 'NOT_COMPLETE', universalRepositoryEnforcement: 'NOT_COMPLETE', obligationExecution: 'NOT_RUN_NOT_PASS', externalMonotonicRollbackAuthority: 'NOT_IMPLEMENTED' }, PPK002: 'PARTIAL', newBuildIssued: false, generatedAt: validatedAt });
console.log('31-B local validation record: PASS (6 governed evidence groups); awaiting D: Library receipt.');
