import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  execution: 'artifacts/checkpoints/31-A_EXECUTION_RECORD.json',
  contract: 'artifacts/validation/31-A_TIMELINE_EVENT_POLICY_ENFORCEMENT_CONTRACT.json',
  runtime: 'artifacts/validation/PPK002_TIMELINE_POLICY_LOCAL_CONTINUATION.json',
  timeline: 'artifacts/manifests/TIMELINE_USE_CASE_VERIFICATION_MVP56.json',
  migrations: 'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
  regression: 'artifacts/validation/31-A_FULL_VITEST_REGRESSION.json',
  platform: 'artifacts/validation/platform-policy-gate.json',
  scopeReport: 'artifacts/inventory/31-A_SCOPE_AND_STATUS_REPORT.json',
  audit: 'docs/audit/31-A_PPK-002_TIMELINE_EVENT_POLICY_ENFORCEMENT.md'
};
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => {
  await mkdir(dirname(full(path)), { recursive: true });
  await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const [plan, ledger, execution, contract, runtime, timeline, migrations, regression, platform] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.execution), readJson(paths.contract),
  readJson(paths.runtime), readJson(paths.timeline), readJson(paths.migrations), readJson(paths.regression), readJson(paths.platform)
]);
await readFile(full(paths.audit), 'utf8');
const migration67 = migrations.migrationVersions?.find((item) => item.version === 67);
const assertions = [
  ['contract', contract.status === 'PASS' && contract.failed === 0 && contract.passed === 38],
  ['runtime', runtime.status === 'PASS' && runtime.checkCount === 14 && runtime.external30ZReceipt === 'PASS'],
  ['timeline use cases', timeline.status === 'passed' && timeline.checks === 19],
  ['database migrations', migrations.status === 'passed' && migrations.checkCount === 9],
  ['migration 67', migration67?.name === 'local_ppk002_timeline_event_policy_receipt_fence' && migration67.checksum === 'a67f9807f2a2bb00ada3768d06882a0ca2648d91b19eacb2becf46cf9ef2b528'],
  ['full Vitest', regression.status === 'PASS' && regression.processExitCode === 0 && regression.testFilePassCount === 28 && regression.testPassCount === 158],
  ['platform policy', platform.status === 'PASS' && platform.newBypassCount === 0 && platform.runtimeStatus === 'PASS']
];
const failed = assertions.filter(([, passed]) => !passed).map(([name]) => name);
if (failed.length > 0) throw new Error(`31-A local validation failed: ${failed.join(', ')}`);

const step31A = plan.steps.find((step) => step.id === '31-A');
if (!step31A || plan.currentStep !== '31-A' || step31A.status !== 'IN_PROGRESS') throw new Error('31-A is not the sole active work-plan step');
const evidence = [paths.contract, paths.runtime, paths.timeline, paths.migrations, paths.regression, paths.platform, paths.scopeReport, paths.audit];
for (const path of evidence) if (!step31A.localEvidence.includes(path)) step31A.localEvidence.push(path);
step31A.validationStatus = 'PASS';
step31A.persistentReceiptStatus = 'PENDING';
plan.updatedAt = new Date().toISOString();
plan.segmentationNote = '30-Z remains immutable COMPLETED/PASS. 31-A timeline-event Policy Enforcement is LOCAL_PASS_AWAITING_LIBRARY_RECEIPT after fresh 7/7 selection, 14/14 runtime, 38/38 contract, 19/19 timeline, 9/9 migrations, 158/158 full Vitest and platform-policy PASS. PPK-002 remains PARTIAL; no new Build is issued.';
await writeJson(paths.plan, plan);

ledger.libraryUploadStatus = '31-A_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT';
ledger.updatedAt = new Date().toISOString();
await writeJson(paths.ledger, ledger);

const validatedAt = new Date().toISOString();
Object.assign(execution, {
  status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT',
  officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT',
  targetSliceStatus: 'PASS',
  validationStatus: 'PASS',
  persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false,
  validation: {
    prioritySelection: 'PASS_7_OF_7', controlledRuntime: 'PASS_14_OF_14', contract: 'PASS_38_OF_38',
    timelineUseCases: 'PASS_19_OF_19', databaseMigrations: 'PASS_9_OF_9_WITH_MIGRATION_67',
    fullVitest: 'PASS_158_OF_158', platformPolicy: 'PASS_LEGACY_25_NEW_BYPASS_0_RUNTIME_8'
  },
  evidence,
  PPK002: 'PARTIAL', newBuildIssued: false, validatedAt
});
await writeJson(paths.execution, execution);

await writeJson(paths.scopeReport, {
  schemaVersion: 1, release: plan.release, step: '31-A', requirement: 'PPK-002',
  status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', officialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT',
  targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false, migration67: migration67,
  cleanEvidence: execution.validation,
  openBoundaries: {
    PPK002: 'PARTIAL', familyDataImportCentralAuthorizationOfficialCheckpoint: 'NEXT_SEPARATE_SLICE',
    timelineDeleteClaimRepairWorkflow: 'NOT_COMPLETE', universalRepositoryEnforcement: 'NOT_COMPLETE',
    obligationExecution: 'NOT_RUN_NOT_PASS', externalMonotonicRollbackAuthority: 'NOT_IMPLEMENTED',
    secureFileDeletionAndDatabaseCommitAtomicity: 'NOT_IMPLEMENTED', installedCoreServiceScmLifecycle: 'NOT_RUN_NOT_PASS'
  },
  PPK002: 'PARTIAL', newBuildIssued: false, generatedAt: validatedAt
});

console.log('31-A local validation record: PASS (7 governed evidence groups); awaiting D: Library receipt.');
