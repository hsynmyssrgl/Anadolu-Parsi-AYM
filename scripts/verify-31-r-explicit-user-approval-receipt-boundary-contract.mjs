import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const successorRegression = process.argv.includes('--successor-regression');
const paths = {
  intake: 'apps/core-service/src/explicit-user-cutover-approval-receipt.ts',
  tests: 'apps/core-service/tests/explicit-user-cutover-approval-receipt.test.ts',
  index: 'apps/core-service/src/index.ts',
  runtime: 'apps/core-service/src/core-service-runtime.ts',
  ledgerSource: 'apps/core-service/src/family-data-cutover-readiness-ledger.ts',
  contracts: 'packages/core-service-contracts/src/index.ts',
  decision: 'docs/decisions/DEC-179-explicit-user-approval-receipt-boundary.md',
  predecessor: 'docs/decisions/DEC-178-end-to-end-security-evidence-aggregator-boundary.md',
  readiness: 'docs/decisions/DEC-172-monotonic-cutover-readiness-evidence.md',
  cutover: 'docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md',
  scope: 'config/31-r-explicit-user-approval-receipt-boundary-scope.json',
  plan: 'config/work-segmentation-plan.json',
  governance: 'config/active-governance-ledger.json',
  authority: 'artifacts/authority/31-R_EXPLICIT_USER_APPROVAL_RECEIPT_BOUNDARY_AUTHORITY.json',
  audit: 'docs/audit/31-R_EXPLICIT_USER_APPROVAL_RECEIPT_BOUNDARY.md'
};
const documents = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const checks = [];
const failures = [];
const check = (condition, name) => {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL' });
  if (!condition) failures.push(name);
};
const has = (key, markers) => {
  for (const marker of markers) check(documents[key].includes(marker), `${key} contains ${marker}`);
};

has('intake', [
  'EXPLICIT_USER_APPROVAL_MAX_LIFETIME_MS', 'TECHNICAL_CUTOVER_GATES', 'TechnicalCutoverGateState',
  'ExplicitUserCutoverApprovalReceipt', 'ExplicitUserCutoverApprovalVerifier', 'ExplicitUserApprovalEvaluationInput',
  'ExplicitUserApprovalEvaluation', 'ExplicitUserApprovalReceiptIntake',
  "mode: 'explicit-user-approval-evidence-intake-no-cutover'", "modeledGate: 'EXPLICIT_USER_CUTOVER_APPROVAL'",
  "decision: 'blocked'", 'technicalGatesSatisfied', 'verifierAttached', 'approvalEvidenceAccepted',
  'eligibleForReadinessLedgerSubmission', 'approvalEvidenceDigest', 'approvalReceiptCreatedByBoundary: false',
  'readinessLedgerSubmissionPerformed: false', 'receiptConsumed: false', 'productionRuntimeWiring: false',
  'realDataAccessed: false', 'cutoverAuthorityAttached: false', 'automaticActivationAllowed: false',
  'isPlainDataObjectWithExactKeys', 'Object.getOwnPropertyDescriptors', "descriptor.enumerable === true && 'value' in descriptor",
  'isNonGenesisSha256', 'EXPLICIT_USER_APPROVAL_MAX_LIFETIME_MS', 'observedAt < expiresAt',
  "this.#verifier.verify(verifierInput) === true", "'PPT-EXPLICIT-USER-CUTOVER-APPROVAL-RECEIPT-V1'",
  "'EXPLICIT_USER_APPROVAL_EVIDENCE_ELIGIBLE'", "'DEC_171_CUTOVER_REMAINS_BLOCKED'",
  "'SEPARATE_VERSIONED_SUCCESSOR_DECISION_REQUIRED'"
]);
for (const gate of ['END_TO_END_SECURITY_VALIDATION', 'KEY_LIFECYCLE_PROOF', 'SINGLE_WRITER_PROOF', 'ROLLBACK_DRILL']) {
  check(documents.intake.includes(`'${gate}'`), `intake contains technical gate ${gate}`);
}
for (const forbidden of ['node:fs', 'node:sqlite', 'better-sqlite', 'electron', 'node:net', 'node:http', 'child_process', 'process.env', 'setTimeout', 'databasePath', 'authenticationToken', 'password', 'privateKey', 'safeStorage', 'DPAPI', 'Google Drive', 'console.log', 'console.error', 'C:\\', 'D:\\', 'G:\\']) {
  check(!documents.intake.includes(forbidden), `intake excludes ${forbidden}`);
}
check(!documents.intake.includes('gateId'), 'intake exposes no production-like gateId');
has('tests', [
  'is default-deny when no verifier is attached',
  'accepts only synthetic verified evidence as ledger-eligible while cutover stays blocked',
  'refuses incomplete, duplicate, unknown, or polluted technical gates before verifier execution',
  'requires a receipt after all four technical gates pass',
  'rejects extra receipt fields and accessor-backed receipt properties',
  'binds the receipt to non-genesis authoritative-source and readiness-ledger hashes',
  'requires canonical timestamps, a live interval, and a bounded lifetime',
  'fails closed when the clock is invalid or throws',
  'fails closed when verification rejects, throws, or returns a non-boolean truthy value',
  'rejects malformed decision identity, version, action, subject, and verification binding',
  'produces a deterministic digest that changes with any verification binding change'
]);
check(documents.index.includes("export * from './explicit-user-cutover-approval-receipt.js'"), 'Core Service exports the receipt boundary');
check(!documents.runtime.includes('ExplicitUserApprovalReceiptIntake'), 'Core Service runtime does not attach the receipt intake');
check(!documents.ledgerSource.includes('explicit-user-cutover-approval-receipt'), 'readiness ledger does not attach the receipt intake');
check(!documents.contracts.includes('ExplicitUserApprovalReceiptIntake') && !documents.contracts.includes('explicit-user-cutover-approval'), 'local administration contract exposes no receipt-intake method');

has('decision', [
  'Explicit user approval receipt detached no-cutover boundary',
  'it is not user consent to transfer family data',
  'exactly four distinct technical gates',
  'User approval cannot bypass',
  'default composition has no approval verifier',
  'exact plain-data key set',
  'non-genesis lowercase SHA-256 bindings',
  'lifetime of no more than fifteen minutes',
  'Successful evaluation means only',
  '`modeledGate: EXPLICIT_USER_CUTOVER_APPROVAL`',
  'performs no ledger submission or receipt consumption',
  'No production-like `gateId`',
  'creates no approval receipt and records no real user consent',
  'DEC-171 through DEC-178 are not replaced or weakened'
]);
has('predecessor', ['Status: ACTIVE', 'exactly seven canonical controls', 'does not attach it to family-data runtime']);
has('readiness', ['Status: ACTIVE', 'trusted evidence verifier', 'DEC-171 is not replaced or weakened']);
has('cutover', ['Status: ACTIVE', 'User approval alone does not bypass the technical gates', 'No API in 31-J can enable cutover']);
has('audit', ['default-deny intake for a future explicit user cutover approval receipt', '31-R application instruction is not cutover consent', 'DEC-171 remains active and blocked']);

const scope = JSON.parse(documents.scope);
const plan = JSON.parse(documents.plan);
const governance = JSON.parse(documents.governance);
const authority = JSON.parse(documents.authority);
check(scope.step === '31-R' && scope.decision === 'DEC-179' && scope.predecessorDecision === 'DEC-178', 'scope identity and predecessor');
check(scope.targets.receiptBoundary === 'PURE_EXPLICIT_USER_APPROVAL_RECEIPT_INTAKE_ONLY', 'scope selects pure receipt intake');
check(scope.targets.technicalGateSet === 'EXACT_FOUR_CANONICAL_TECHNICAL_GATES' && scope.targets.technicalGatePrecondition === 'ALL_FOUR_EXACT_DISTINCT_PASS_BEFORE_VERIFIER', 'scope fixes technical gate precondition');
check(scope.targets.defaultVerifier === 'NOT_ATTACHED_DEFAULT_DENY', 'scope keeps verifier detached');
check(scope.targets.receiptShape === 'EXACT_PLAIN_DATA_KEYS_ONLY_ACCESSORS_AND_EXTRA_FIELDS_REJECTED', 'scope fixes receipt shape');
check(scope.targets.sourceBinding === 'LOWERCASE_SHA256_NON_GENESIS_EXACT_MATCH' && scope.targets.ledgerBinding === 'LOWERCASE_SHA256_NON_GENESIS_EXACT_MATCH', 'scope binds source and ledger hashes');
check(scope.targets.timeRule === 'CANONICAL_LIVE_INTERVAL_MAX_FIFTEEN_MINUTES' && scope.targets.verifierFailureRule === 'REJECTION_EXCEPTION_NON_BOOLEAN_AND_CLOCK_FAILURE_DEFAULT_DENY', 'scope fixes time and failure rules');
check(scope.targets.digestRule === 'ALL_RECEIPT_FIELDS_BOUND_RAW_RECEIPT_NOT_EXPOSED', 'scope binds digest without raw exposure');
check(scope.targets.evaluationClassification === 'MODELED_GATE_ONLY_NO_GATE_ID_LEDGER_ELIGIBILITY_ONLY', 'scope forbids production gateId and submission');
check(scope.targets.receiptCreation === 'NOT_PERFORMED' && scope.targets.readinessLedgerSubmission === 'NOT_PERFORMED' && scope.targets.successorDecision === 'NOT_CREATED', 'scope excludes receipt creation, submission, and successor decision');
check(scope.targets.runtimeIntegration === 'NOT_WIRED' && scope.targets.realExplicitUserApprovalGate === 'NOT_SATISFIED' && scope.targets.automaticActivation === 'NOT_ALLOWED', 'scope excludes runtime, real approval gate, and activation');
check(scope.openBoundaries.productionApprovalVerifier === 'NOT_ATTACHED_DEFAULT_DENY' && scope.openBoundaries.realUserApprovalReceipt === 'NOT_CREATED_NOT_VERIFIED', 'production verifier and real receipt remain absent');
check(scope.requirementCompletionClaimed === false && scope.newBuildIssued === false, 'scope makes no requirement or Build claim');
check(authority.status === 'PASS' && authority.authority === 'EXPLICIT_USER_CONTINUATION_APPLY_31_R_BOUNDARY_ONLY_NOT_CUTOVER_CONSENT', 'authority binds code-only application instruction');
check(authority.realUserCutoverConsentGranted === false, 'authority does not claim user cutover consent');
check(authority.authoritativeSourceAtStart.treeSha256 === 'e236b374b54e0bdee8aefc45eedd487ff25a354215c1def88f9b07dafab2dde8' && authority.authoritativeSourceAtStart.fileCount === 4365, 'authority binds 31-Q source');
check(authority.preparedPackage.inventorySha256 === 'c460e8a99f31b90f44873b92f058729ff4b4c799b0731288bff51771fecc70a5' && authority.preparedPackage.validationSha256 === '95c50c7fa4dfa111d5c05d37d2da081543532328797bdbc4b8eb7557277d0ac8', 'authority binds prepared package');
const step = plan.steps.find((item) => item.id === '31-R');
const active = plan.currentStep === '31-R' && step?.status === 'IN_PROGRESS' && governance.activeMicroStep === '31-R' && String(governance.libraryUploadStatus).startsWith('31-R_');
const complete = plan.currentStep === '31-R' && step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS' && governance.activeMicroStep === null && governance.libraryUploadStatus === '31-R_COMPLETED_RECEIPT_PASS';
const later = inspectAuthorizedSuccessorLifecycle({ plan, ledger: governance, predecessorId: '31-R' });
check(active || complete || (later.planValid && later.ledgerValid && later.nextTaskValid), '31-R has an active, completed, or authorized-successor lifecycle');

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '31-R',
  phase: 'EXPLICIT_USER_APPROVAL_RECEIPT_BOUNDARY_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS',
  expected: checks.length,
  executed: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  failures,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: 'Bu PASS yalnız ayrık ve varsayılan-ret kullanıcı onayı makbuzu sınırına aittir; gerçek kullanıcı onayı, production verifier, readiness-ledger submission, otomatik aktivasyon veya cutover PASS değildir.'
};
if (!successorRegression) {
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/31-R_EXPLICIT_USER_APPROVAL_RECEIPT_BOUNDARY_CONTRACT.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failures.length) {
  console.error(`31-R contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`31-R contract: PASS (${checks.length}/${checks.length}).`);
