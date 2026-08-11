import { createHash } from 'node:crypto';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const failures = [];
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/u, ''));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const stableStringify = (value) => JSON.stringify(stable(value));

const inventoryPath = 'artifacts/inventory/29-E1_TARGETED_TEST_SECURITY_GATE_INVENTORY.json';
const readinessPath = 'artifacts/checkpoints/29-E1_DEPENDENCY_READINESS.json';
const inventory = await readJson(inventoryPath);
const readiness = await readJson(readinessPath);
const officialCompletion = inventory.status === 'PASS' && inventory.persistentReceiptStatus === 'PASS';
const packageJson = await readJson('package.json');
const packageJsonBytes = await readFile('package.json');
let e3Execution = null;
let e3BuildOrderCorrection = null;
try {
  e3Execution = await readJson('artifacts/validation/29-E3_DEPENDENCY_BACKED_CAPABILITY_EXECUTION_RAW.json');
  e3BuildOrderCorrection = await readJson('artifacts/checkpoints/29-E3_PRODUCTION_BUILD_ORDER_CORRECTION.json');
} catch {}
const e3EvidenceActive = officialCompletion
  && e3Execution?.status === 'PASS'
  && e3Execution?.packageLock?.sha256 === '228e72333a8fb370907a9b1bad879bb16cd6a86f020679a0819d73b21b763e6a'
  && e3Execution?.packageJson?.sha256 === sha256(packageJsonBytes)
  && e3BuildOrderCorrection?.status === 'CORRECTION_APPLIED_LOCAL_RECHECK_PASS';
for (const binding of inventory.sourceBindings ?? []) {
  if (officialCompletion && (binding.id === 'packageJson' || (binding.id === 'packageLock' && e3EvidenceActive))) {
    check(binding.sizeBytes > 0 && /^[a-f0-9]{64}$/u.test(binding.sha256), `${binding.id} generation binding malformed`);
    continue;
  }
  try {
    const bytes = await readFile(binding.path);
    check(bytes.length === binding.sizeBytes, `${binding.id} size mismatch`);
    check(sha256(bytes) === binding.sha256, `${binding.id} SHA mismatch`);
  } catch { check(false, `${binding.id} source missing`); }
}
check(inventory.release === 'Bronze 04.08.2026.29' && inventory.step === '29-E1', 'release/step mismatch');
check(inventory.validationStatus === 'PASS', 'inventory validation mismatch');
if (officialCompletion) {
  check(inventory.persistentReceiptPath === 'artifacts/checkpoints/29-E1_LIBRARY_RECEIPT.json', 'inventory receipt binding mismatch');
  check(inventory.libraryReadbackVerificationPath === 'artifacts/validation/29-E1_LIBRARY_READBACK_VERIFICATION.json', 'inventory Library readback binding mismatch');
  check(inventory.receiptReadbackVerificationPath === 'artifacts/validation/29-E1_RECEIPT_READBACK_VERIFICATION.json', 'inventory receipt readback binding mismatch');
  check(inventory.completionRecordPath === 'artifacts/checkpoints/29-E1_COMPLETION_RECORD.json', 'inventory completion binding mismatch');
} else {
  check(inventory.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT' && inventory.persistentReceiptStatus === 'PENDING', 'inventory lifecycle mismatch');
}
const packageScripts = Object.entries(packageJson.scripts ?? {});
check(
  officialCompletion
    ? packageScripts.length >= inventory.scripts.length && inventory.classificationSummary.packageScriptCount === inventory.scripts.length
    : inventory.scripts.length === packageScripts.length && inventory.classificationSummary.packageScriptCount === packageScripts.length,
  'package script count mismatch',
);
check(new Set(inventory.scripts.map((item) => item.name)).size === inventory.scripts.length, 'duplicate script names');
for (const item of inventory.scripts) {
  const command = packageJson.scripts?.[item.name];
  check(typeof command === 'string', `script missing=${item.name}`);
  if (typeof command === 'string') {
    const historicalBindingMatches = item.command === command && item.commandSha256 === sha256(Buffer.from(command));
    const governedE3BuildOrderChange = item.name === 'build:packages' && e3EvidenceActive
      && command.includes('@ppt/core-service-contracts') && command.includes('@ppt/core-service-client');
    check(historicalBindingMatches || governedE3BuildOrderChange, `script binding mismatch=${item.name}`);
  }
}
const classTotal = Object.values(inventory.classificationSummary.classCounts).reduce((sum, value) => sum + value, 0);
check(classTotal === inventory.scripts.length, 'classification total mismatch');
check(inventory.classificationSummary.dependencyFreeCandidateCount > 0, 'no dependency-free candidates');
check(inventory.classificationSummary.securityCandidateCount > 0, 'no security candidates');
check(inventory.classificationSummary.targetedTestCandidateCount > 0, 'no targeted test candidates');
check(inventory.gateSets.dependencyFreeCandidates.length === inventory.classificationSummary.dependencyFreeCandidateCount, 'dependency-free set mismatch');
check(inventory.gateSets.securityCandidates.length === inventory.classificationSummary.securityCandidateCount, 'security set mismatch');
check(inventory.gateSets.targetedTestCandidates.length === inventory.classificationSummary.targetedTestCandidateCount, 'targeted set mismatch');
for (const item of inventory.scripts.filter((candidate) => candidate.executionClass === 'DEPENDENCY_FREE_NODE')) {
  check(item.targetExists === true && item.directExternalImports.length === 0 && item.readiness === 'READY_FOR_ISOLATED_EXECUTION', `dependency-free classification invalid=${item.name}`);
}
check(inventory.toolchain.node.status === 'AVAILABLE' && /^v24\./u.test(inventory.toolchain.node.version), 'Node toolchain mismatch');
check(inventory.toolchain.packageLock.status === 'AVAILABLE' && inventory.toolchain.packageLock.exists === true && inventory.toolchain.packageLock.lockfileVersion === 3, 'package lock mismatch');
check(inventory.toolchain.npm.status === 'NOT_FOUND' && inventory.toolchain.npm.executable === null, 'npm availability must reflect observed state');
check(inventory.toolchain.nodeModules.exists === false && inventory.toolchain.nodeModules.status === 'NOT_FOUND', 'node_modules availability must reflect observed state');
check(inventory.toolchain.dependencyInstall.status === 'NOT_RUN_NOT_PASS' && inventory.toolchain.dependencyInstall.networkUsed === false, 'dependency install overclaimed');
check(Object.values(inventory.toolchain.dependencyBackedExecution).every((value) => value === 'NOT_RUN_NOT_PASS'), 'dependency-backed execution overclaimed');
check(inventory.executionClaims.executedTestOrSecurityGateCommands.length === 0, 'unexecuted gates claimed');
check(Object.values(inventory.executionClaims).filter((value) => typeof value === 'string').every((value) => value === 'PASS' || value === 'NOT_RUN_NOT_PASS'), 'invalid execution claim');
check(readiness.status === 'DEPENDENCY_FREE_READY_DEPENDENCY_BACKED_BLOCKED_NOT_PASS' && readiness.countedAsPass === false, 'readiness truth mismatch');
check(readiness.npm.status === 'NOT_FOUND' && readiness.nodeModules.status === 'NOT_FOUND', 'readiness toolchain mismatch');
check(readiness.dependencyFreeCandidateCount === inventory.classificationSummary.dependencyFreeCandidateCount, 'readiness candidate count mismatch');
check(inventory.unresolvedTruth.governanceGapsOpen === 9 && inventory.unresolvedTruth.governanceContradictionsOpen === 0, 'governance truth mismatch');
check(inventory.unresolvedTruth.technicalFindingsOpen === 8 && inventory.unresolvedTruth.acceptedScopeIncomplete === 346 && inventory.unresolvedTruth.promotionRequiredIncomplete === 341, 'open technical/scope truth mismatch');
check(inventory.unresolvedTruth.countedAsPass === 0, 'open truth counted as PASS');
check(inventory.bronzeCompletedPercent === 25 && inventory.silverStatus === 'FORBIDDEN_NOT_READY' && inventory.goldStatus === 'FORBIDDEN_NOT_READY', 'release state overclaim');
check(inventory.conversationCapacity === 'UNAVAILABLE', 'conversation capacity invented');
const plan = await readJson('config/work-segmentation-plan.json');
const e = plan.steps.find((item) => item.id === '29-E');
const e1 = e?.substeps?.find((item) => item.id === '29-E1');
const e2 = e?.substeps?.find((item) => item.id === '29-E2');
const e3 = e?.substeps?.find((item) => item.id === '29-E3');
const e4 = e?.substeps?.find((item) => item.id === '29-E4');
const f = plan.steps.find((item) => item.id === '29-F');
const workflowClosed = plan.workflowStatus === 'COMPLETED' && f?.status === 'COMPLETED' && f.validationStatus === 'PASS' && f.persistentReceiptStatus === 'PASS';
const eClosedForward = plan.currentStep === '29-F' && e?.status === 'COMPLETED' && e.validationStatus === 'PASS' && e.persistentReceiptStatus === 'PASS' && (f?.status === 'IN_PROGRESS' || workflowClosed);
check(((plan.currentStep === '29-E' && e?.status === 'IN_PROGRESS') || eClosedForward) && plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === (workflowClosed ? 0 : 1), '29-E top-level state mismatch');
if (officialCompletion) {
  check(e1?.status === 'COMPLETED' && e1.validationStatus === 'PASS' && e1.persistentReceiptStatus === 'PASS', '29-E1 durable micro-step state mismatch');
  check(e1.persistentReceiptPath === inventory.persistentReceiptPath && e1.receiptReadbackVerificationPath === inventory.receiptReadbackVerificationPath, '29-E1 plan binding mismatch');
  if (eClosedForward) {
    check(e.substeps.every((item) => item.status === 'COMPLETED' && item.validationStatus === 'PASS' && item.persistentReceiptStatus === 'PASS'), '29-E durable substep closure mismatch');
    check(e.substeps.filter((item) => item.status === 'IN_PROGRESS').length === 0, 'closed 29-E has active micro-step');
  } else if (e.activeMicroStep === '29-E2') {
    check(e2?.status === 'IN_PROGRESS' && ['PENDING', 'PASS'].includes(e2.validationStatus) && e2.persistentReceiptStatus === 'PENDING', '29-E2 active state mismatch');
    check(e3?.status === 'PENDING', '29-E3 premature state');
  } else if (e.activeMicroStep === '29-E3') {
    check(e2?.status === 'COMPLETED' && e2.validationStatus === 'PASS' && e2.persistentReceiptStatus === 'PASS', '29-E2 durable state mismatch');
    check(e3?.status === 'IN_PROGRESS' && ['PENDING', 'PASS'].includes(e3.validationStatus) && e3.persistentReceiptStatus === 'PENDING', '29-E3 active state mismatch');
  } else {
    check(e2?.status === 'COMPLETED' && e2.validationStatus === 'PASS' && e2.persistentReceiptStatus === 'PASS', '29-E2 durable state mismatch');
    check(e3?.status === 'COMPLETED' && e3.validationStatus === 'PASS' && e3.persistentReceiptStatus === 'PASS', '29-E3 durable state mismatch');
    check(e4?.status === 'IN_PROGRESS' && e4.validationStatus === 'PENDING' && e4.persistentReceiptStatus === 'PENDING', '29-E4 active state mismatch');
  }
  if (!eClosedForward) check(e.substeps.filter((item) => item.status === 'IN_PROGRESS').length === 1, 'multiple 29-E micro-steps');
} else {
  check(e?.activeMicroStep === '29-E1' && e1?.status === 'IN_PROGRESS' && ['PENDING', 'PASS'].includes(e1.validationStatus) && e1.persistentReceiptStatus === 'PENDING', '29-E1 micro-step state mismatch');
  check(e.substeps.filter((item) => item.status === 'IN_PROGRESS').length === 1 && e.substeps.filter((item) => item.id !== '29-E1').every((item) => item.status === 'PENDING'), 'multiple or premature 29-E micro-steps');
}
const governance = await readJson('config/active-governance-ledger.json');
const expectedGovernanceMicroStep = workflowClosed
  ? null
  : eClosedForward
  ? '29-F documents, deterministic package, exact-source and Library closure'
  : !officialCompletion
  ? '29-E1 executable targeted-test/security-gate inventory and dependency readiness'
  : e.activeMicroStep === '29-E4'
    ? '29-E4 governed 29-E closure and durable receipt chain'
  : e.activeMicroStep === '29-E3'
    ? '29-E3 dependency-backed typecheck, tests and build capability execution'
    : '29-E2 dependency-free targeted contract/runtime and security gates';
check(governance.nextOfficialTask === (workflowClosed ? 'UNAVAILABLE_REQUIRES_NEW_OFFICIAL_AUTHORITY_AFTER_29-F' : eClosedForward ? '29-F documents, deterministic package, exact-source and Library closure' : '29-E targeted tests and security gates') && governance.activeMicroStep === expectedGovernanceMicroStep, 'active governance mismatch');
const basis = {
  sourceBindings: inventory.sourceBindings,
  classificationSummary: inventory.classificationSummary,
  toolchain: inventory.toolchain,
  gateSets: inventory.gateSets,
  executionClaims: inventory.executionClaims,
  unresolvedTruth: inventory.unresolvedTruth,
};
check(inventory.inventoryFingerprintSha256 === sha256(Buffer.from(stableStringify(basis))), 'inventory fingerprint mismatch');
check(inventory.nextMicroStep === '29-E2' && inventory.nextMicroStepStatus === (officialCompletion ? 'IN_PROGRESS' : 'PENDING_AWAITING_29-E1_LIBRARY_RECEIPT'), 'next micro-step lifecycle mismatch');
check(inventory.mandatoryTruthSentence === TRUTH && readiness.mandatoryTruthSentence === TRUTH, 'truth sentence mismatch');
for (const path of [inventoryPath, readinessPath, 'docs/audit/29-E1_HEDEFLI_TEST_GUVENLIK_KAPISI_ENVANTERI.md', ...(officialCompletion ? ['artifacts/checkpoints/29-E1_RECEIPT_READBACK_PERSISTENCE_FIRST_ATTEMPT_FAILURE.json', 'artifacts/checkpoints/29-E1_COMPLETION_RECORD.json'] : [])]) {
  try { await stat(path); check(true, `${path} exists`); } catch { check(false, `${path} missing`); }
}
if (officialCompletion) {
  const receiptPath = 'artifacts/checkpoints/29-E1_LIBRARY_RECEIPT.json';
  const libraryReadbackPath = 'artifacts/validation/29-E1_LIBRARY_READBACK_VERIFICATION.json';
  const receiptReadbackPath = 'artifacts/validation/29-E1_RECEIPT_READBACK_VERIFICATION.json';
  const completionPath = 'artifacts/checkpoints/29-E1_COMPLETION_RECORD.json';
  const [receipt, libraryReadback, receiptReadback, completion, failure] = await Promise.all([
    readJson(receiptPath), readJson(libraryReadbackPath), readJson(receiptReadbackPath), readJson(completionPath),
    readJson('artifacts/checkpoints/29-E1_RECEIPT_READBACK_PERSISTENCE_FIRST_ATTEMPT_FAILURE.json'),
  ]);
  const [receiptBytes, libraryBytes, receiptReadbackBytes] = await Promise.all([readFile(receiptPath), readFile(libraryReadbackPath), readFile(receiptReadbackPath)]);
  check(receipt.status === 'PASS' && receipt.validationStatus === 'PASS' && receipt.persistentReceiptStatus === 'PASS', 'receipt semantic mismatch');
  check(receipt.roundTripVerification.executed === 20 && receipt.roundTripVerification.matched === 20 && receipt.roundTripVerification.failed === 0, 'receipt payload roundtrip mismatch');
  check(receipt.zipReadbackVerification.executed === 3 && receipt.zipReadbackVerification.pass === 3 && receipt.zipReadbackVerification.fail === 0, 'receipt ZIP roundtrip mismatch');
  check(receipt.executedTestOrSecurityGateCommands.length === 0 && receipt.dependencyBackedExecution === 'NOT_RUN_NOT_PASS', 'receipt test execution overclaim');
  check(libraryReadback.status === 'PASS' && libraryReadback.executed === 20 && libraryReadback.matched === 20 && libraryReadback.failed === 0 && libraryReadback.zipPassed === 3, 'Library readback mismatch');
  check(receiptReadback.status === 'PASS' && receiptReadback.executed === 4 && receiptReadback.matched === 4 && receiptReadback.failed === 0, 'receipt readback mismatch');
  check(failure.status === 'FAIL' && failure.processExitCode === 1 && failure.countedAsPass === false, 'persistence failure not preserved');
  check(completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED' && completion.nextMicroStep === '29-E2' && completion.nextMicroStepStatus === 'IN_PROGRESS', 'completion lifecycle mismatch');
  check(completion.inventory.fingerprintSha256 === inventory.inventoryFingerprintSha256, 'completion inventory fingerprint mismatch');
  check(completion.receipt.sizeBytes === receiptBytes.length && completion.receipt.sha256 === sha256(receiptBytes), 'completion receipt binding mismatch');
  check(completion.libraryReadback.sizeBytes === libraryBytes.length && completion.libraryReadback.sha256 === sha256(libraryBytes), 'completion Library binding mismatch');
  check(completion.receiptReadback.sizeBytes === receiptReadbackBytes.length && completion.receiptReadback.sha256 === sha256(receiptReadbackBytes), 'completion receipt-readback binding mismatch');
  check(completion.receiptReadback.persistenceExecuted === 2 && completion.receiptReadback.persistenceMatched === 2 && completion.receiptReadback.persistenceStatus === 'PASS', 'receipt-readback persistence mismatch');
  check(completion.preservedFailureCount === 1 && completion.failuresCountedAsPass === 0, 'completion failure truth mismatch');
  check([receipt, libraryReadback, receiptReadback, completion].every((item) => item.mandatoryTruthSentence === TRUTH), 'official truth sentence mismatch');
}
const validation = {
  schemaVersion: 1,
  release: inventory.release,
  step: '29-E1',
  phase: officialCompletion ? 'EXECUTABLE_TEST_SECURITY_GATE_INVENTORY_OFFICIAL_VALIDATION' : 'EXECUTABLE_TEST_SECURITY_GATE_INVENTORY_LOCAL_VALIDATION',
  checks,
  failures,
  packageScripts: inventory.scripts.length,
  dependencyFreeCandidates: inventory.classificationSummary.dependencyFreeCandidateCount,
  controlledRuntimeCandidates: inventory.classificationSummary.controlledRuntimeCandidateCount,
  dependencyBackedCandidates: inventory.classificationSummary.dependencyBackedCount,
  securityCandidates: inventory.classificationSummary.securityCandidateCount,
  targetedTestCandidates: inventory.classificationSummary.targetedTestCandidateCount,
  npmStatus: inventory.toolchain.npm.status,
  nodeModulesStatus: inventory.toolchain.nodeModules.status,
  dependencyBackedExecution: 'NOT_RUN_NOT_PASS',
  persistentReceiptStatus: officialCompletion ? 'PASS' : 'PENDING',
  nextMicroStep: '29-E2',
  nextMicroStepStatus: officialCompletion ? 'IN_PROGRESS' : 'PENDING_AWAITING_29-E1_LIBRARY_RECEIPT',
  bronzeCompletedPercent: 25,
  conversationCapacity: 'UNAVAILABLE',
  status: failures.length ? 'FAIL' : 'PASS',
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH,
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/29-E1-test-security-inventory.json', JSON.stringify(validation, null, 2) + '\n');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`29-E1 Test/Security Inventory: ${officialCompletion ? 'OFFICIAL' : 'LOCAL'} PASS (${checks} checks / ${inventory.scripts.length} scripts / npm ${inventory.toolchain.npm.status} / dependency-backed NOT_RUN).`);
