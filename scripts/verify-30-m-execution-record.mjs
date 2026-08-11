import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const record = JSON.parse(await readFile('artifacts/checkpoints/30-M_EXECUTION_RECORD.json', 'utf8'));
const contract = JSON.parse(await readFile('artifacts/validation/30-M-ppk-002-policy-enforcement-contract.json', 'utf8'));
const runtime = JSON.parse(await readFile('artifacts/validation/30-M-ppk-002-policy-enforcement-runtime.json', 'utf8'));
const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const plan = JSON.parse(await readFile('config/work-segmentation-plan.json', 'utf8'));
const failures = (await readdir('artifacts/checkpoints')).filter((name) => /^30-M_.*FAILURE\.json$/u.test(name));
const checks = [];
const failed = [];
const check = (condition, label) => {
  checks.push(label);
  if (!condition) failed.push(label);
};

check(record.step === '30-M' && record.requirement === 'PPK-002', 'record binds 30-M to PPK-002');
check(record.status === 'PASS', 'local execution record is PASS');
check(record.officialStepStatus === 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', 'official step remains awaiting persistent receipt');
check(record.scopeStatus === 'PARTIAL_POLICY_ENFORCEMENT_FOUNDATION_UNIVERSAL_MIGRATION_PENDING', 'scope status remains partial foundation');
check(record.persistentReceiptStatus === 'PENDING', 'persistent receipt remains pending');
check(record.officialCompletionClaimed === false, 'official completion is not claimed');
check(record.evidenceBoundary?.scopedFoundation === 'PASS', 'scoped foundation is PASS');
check(record.evidenceBoundary?.PPK002 === 'PARTIAL', 'PPK-002 remains PARTIAL');
check(record.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', 'universal repository enforcement remains incomplete');
check(record.evidenceBoundary?.productionStartupPepWired === false, 'production startup PEP is not falsely claimed');
check(record.evidenceBoundary?.durableMultiProcessReplayProtection === 'NOT_RUN_NOT_PASS', 'durable replay protection is not PASS');
check(record.evidenceBoundary?.receiptAndBusinessCommitAtomicity === 'NOT_RUN_NOT_PASS', 'business commit atomicity is not PASS');
check(record.evidenceBoundary?.obligationExecution === 'NOT_RUN_NOT_PASS', 'obligation execution is not PASS');
check(record.evidenceBoundary?.requirementCompletionClaimed === false, 'requirement completion is not claimed');
check(record.validation?.directProcessChecks === 23 && record.validation?.directProcessPass === 23, 'direct validation is 23 of 23');
check(record.validation?.policyEnforcementContractChecks === 34, 'contract evidence is 34 checks');
check(record.validation?.policyEnforcementRuntimeChecks === 43, 'controlled runtime evidence is 43 checks');
check(record.validation?.legacyDirectRoleDebt === 34 && record.validation?.newDirectRoleBypasses === 0, 'legacy role debt remains 34 with zero new bypass');
check(record.validation?.vitestFiles === 8 && record.validation?.vitestTests === 61, 'Vitest evidence is 8 files and 61 tests');
check(record.validation?.productionBuild === 'PASS', 'production build is PASS');
check(record.failedAttemptsCountedAsPass === 0, 'no failed attempt is counted as PASS');
check(record.preservedFailedAttempts === failures.length && failures.length === 7, 'all seven failed attempts are preserved');
check(contract.status === 'PASS' && contract.checkCount === 34, 'current contract artifact is PASS 34');
check(runtime.status === 'PASS' && runtime.checkCount === 43, 'current runtime artifact is PASS 43');
check(contract.evidenceBoundary?.requirementCompletionClaimed === false, 'contract does not claim requirement completion');
check(runtime.evidenceBoundary?.requirementCompletionClaimed === false, 'runtime does not claim requirement completion');
const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
check(ppk002?.status === 'PARTIAL', 'accepted-scope PPK-002 is still PARTIAL');
check(ppk002?.chain?.targetedTest === true && ppk002?.chain?.evidence === true, 'targeted test and evidence links are recorded');
const step = plan.steps.find((item) => item.id === '30-M');
check(plan.currentStep === '30-M' && step?.status === 'IN_PROGRESS', '30-M remains the sole active work step');
check(step?.persistentReceiptStatus === 'PENDING' && step?.persistentReceiptPath === null, 'work plan receipt is still pending');
check(record.bronzeCompletedPercent === 25 && record.silverStatus === 'FORBIDDEN_NOT_READY' && record.goldStatus === 'FORBIDDEN_NOT_READY', 'official progress and tier locks remain unchanged');
check(record.installerBuild === 'NOT_RUN_NOT_PASS', 'installer is not PASS');

const report = {
  schemaVersion: 1,
  release: record.release,
  step: '30-M',
  requirement: 'PPK-002',
  status: failed.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  checks,
  failures: failed,
  scopeStatus: 'PARTIAL',
  persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/30-M-execution-record-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length > 0) {
  console.error(failed.join('\n'));
  process.exit(1);
}
console.log(`30-M execution record contract: PASS (${checks.length} checks; receipt PENDING).`);
