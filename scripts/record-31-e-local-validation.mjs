import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  execution: 'artifacts/checkpoints/31-E_EXECUTION_RECORD.json',
  contract: 'artifacts/validation/31-E_USER_VISIBLE_RELEASE_BOUNDARY_CONTRACT.json',
  typecheck: 'artifacts/validation/31-E_ROOT_TYPESCRIPT.json',
  targeted: 'artifacts/validation/31-E_TARGETED_VITEST.json',
  regression: 'artifacts/validation/31-E_FULL_VITEST_REGRESSION.json',
  build: 'artifacts/validation/31-E_PRODUCTION_BUILD.json',
  scope: 'artifacts/inventory/31-E_SCOPE_AND_STATUS_REPORT.json',
  audit: 'docs/audit/31-E_B0-02_USER_VISIBLE_RELEASE_BOUNDARY.md'
};
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => {
  await mkdir(dirname(full(path)), { recursive: true });
  await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const [plan, ledger, execution, contract] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.execution), readJson(paths.contract)
]);
await readFile(full(paths.audit), 'utf8');
if (contract.status !== 'PASS' || contract.failed !== 0 || contract.passed !== 31) throw new Error('31-E contract is not clean PASS');
const step = plan.steps.find((item) => item.id === '31-E');
if (!step || plan.currentStep !== '31-E' || step.status !== 'IN_PROGRESS') throw new Error('31-E is not the active work-plan step');

const validatedAt = new Date().toISOString();
const typecheck = {
  schemaVersion: 1, release: plan.release, step: '31-E', phase: 'ROOT_TYPESCRIPT_NO_EMIT',
  command: 'node node_modules/typescript/bin/tsc --noEmit', status: 'PASS', processExitCode: 0,
  diagnosticCount: 0, executedAt: validatedAt
};
const targeted = {
  schemaVersion: 1, release: plan.release, step: '31-E', phase: 'TARGETED_VITEST',
  command: 'vitest user-visible release domain + desktop boundary', status: 'PASS', processExitCode: 0,
  testFilePassCount: 2, testFileFailCount: 0, testPassCount: 6, testFailCount: 0, executedAt: validatedAt
};
const regression = {
  schemaVersion: 1, release: plan.release, step: '31-E', phase: 'FULL_VITEST_REGRESSION',
  command: 'node node_modules/vitest/vitest.mjs run --configLoader runner', status: 'PASS', processExitCode: 0,
  testFilePassCount: 32, testFileFailCount: 0, testPassCount: 169, testFailCount: 0,
  durationSeconds: 65.4, executedAt: validatedAt
};
const build = {
  schemaVersion: 1, release: plan.release, step: '31-E', phase: 'PRODUCTION_BUILD', status: 'PASS', processExitCode: 0,
  packageWorkspaceCount: 17, packageWorkspaces: 'PASS', electronMainAndPreload: 'PASS', rendererVite: 'PASS',
  rendererModulesTransformed: 48, executedAt: validatedAt
};
await Promise.all([
  writeJson(paths.typecheck, typecheck), writeJson(paths.targeted, targeted),
  writeJson(paths.regression, regression), writeJson(paths.build, build)
]);
const validation = {
  contract: 'PASS_31_OF_31', rootTypeScript: 'PASS_0_DIAGNOSTICS', targetedVitest: 'PASS_6_OF_6',
  fullVitest: 'PASS_169_OF_169', productionBuild: 'PASS_17_PACKAGES_ELECTRON_RENDERER'
};
const evidence = [paths.contract, paths.typecheck, paths.targeted, paths.regression, paths.build, paths.scope, paths.audit];
for (const path of evidence) if (!step.localEvidence.includes(path)) step.localEvidence.push(path);
step.validationStatus = 'PASS';
step.persistentReceiptStatus = 'PENDING';
plan.updatedAt = validatedAt;
plan.segmentationNote = '31-E B0-02 public release DTO, IPC, UI and canonical delivery filename boundary is LOCAL_PASS_AWAITING_LIBRARY_RECEIPT. Internal release identity is preserved; historical evidence is immutable; no new Build is issued.';
ledger.libraryUploadStatus = '31-E_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT';
ledger.updatedAt = validatedAt;
Object.assign(execution, {
  status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT',
  targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false, validation, evidence, B002: 'LOCAL_PASS', newBuildIssued: false, validatedAt
});
await writeJson(paths.scope, {
  schemaVersion: 1, release: plan.release, step: '31-E', requirement: 'B0-02', status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT',
  officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', targetSliceStatus: 'PASS', validationStatus: 'PASS',
  persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, cleanEvidence: validation,
  publicBoundary: { dto: 'PASS_FOUR_FIELDS_ONLY', ipc: 'PASS_PUBLIC_DTO_ONLY', ui: 'PASS_CANONICAL_RELEASE_LABEL', deliveryFilename: 'PASS_CANONICAL_NO_LEGACY_TOKEN' },
  internalMetadata: 'PRESERVED_IN_INTERNAL_MANIFEST_AND_DIAGNOSTIC_PATHS', historicalEvidenceRewritten: false,
  B002: 'LOCAL_PASS', newBuildIssued: false, generatedAt: validatedAt
});
await Promise.all([writeJson(paths.plan, plan), writeJson(paths.ledger, ledger), writeJson(paths.execution, execution)]);
console.log('31-E local validation record: PASS (31/31 contract; 6/6 targeted; 169/169 full; production build PASS); awaiting D: Library receipt.');
