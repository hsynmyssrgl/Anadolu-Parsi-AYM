import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const successorRegression = process.argv.includes('--successor-regression');
const paths = {
  harness: 'apps/core-service/src/synthetic-key-lifecycle-proof-harness.ts',
  tests: 'apps/core-service/tests/synthetic-key-lifecycle-proof-harness.test.ts',
  index: 'apps/core-service/src/index.ts',
  runtime: 'apps/core-service/src/core-service-runtime.ts',
  ledgerSource: 'apps/core-service/src/family-data-cutover-readiness-ledger.ts',
  contracts: 'packages/core-service-contracts/src/index.ts',
  decision: 'docs/decisions/DEC-176-synthetic-key-lifecycle-proof-harness-boundary.md',
  predecessor: 'docs/decisions/DEC-175-synthetic-single-writer-proof-harness-boundary.md',
  readiness: 'docs/decisions/DEC-172-monotonic-cutover-readiness-evidence.md',
  cutover: 'docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md',
  scope: 'config/31-o-synthetic-key-lifecycle-proof-harness-scope.json',
  plan: 'config/work-segmentation-plan.json',
  governance: 'config/active-governance-ledger.json',
  authority: 'artifacts/authority/31-O_SYNTHETIC_KEY_LIFECYCLE_PROOF_HARNESS_AUTHORITY.json',
  audit: 'docs/audit/31-O_SYNTHETIC_KEY_LIFECYCLE_PROOF_HARNESS.md'
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

has('harness', [
  'SyntheticKeyLifecycleSnapshot',
  'SyntheticKeyLifecycleEvidenceCandidate',
  'SyntheticKeyLifecycleProofError',
  'SyntheticKeyLifecycleProofHarness',
  "'MALFORMED_INPUT'",
  "'STALE_EPOCH'",
  "'STATE_INVALID'",
  "'IDENTIFIER_INVALID'",
  "'PROOF_INVALID'",
  "'PROOF_REUSED'",
  "evidenceClass: 'synthetic-key-lifecycle-non-authoritative'",
  "modeledGate: 'KEY_LIFECYCLE_PROOF'",
  'syntheticOnly: true',
  'realKeyMaterialAccessed: false',
  'productionGateSatisfied: false',
  'productionSubmissionAllowed: false',
  'cutoverAuthorityAttached: false',
  "lifecycle: 'detached'",
  'hasExactKeys',
  'Number.isSafeInteger(value.expectedEpoch)',
  'value.expectedEpoch !== this.#state.epoch',
  'this.#seenProofDigests.has(value.proofDigest)',
  'plaintextLeaseCount: 1',
  'plaintextLeaseCount: 0',
  'freezeSnapshot'
]);
for (const forbidden of [
  'node:fs', 'node:sqlite', 'better-sqlite', 'electron', 'node:net', 'node:http', 'child_process', 'process.env',
  'setTimeout', 'databasePath', 'authenticationToken', 'password', 'privateKey', 'verificationBinding',
  'safeStorage', 'DPAPI', 'Google Drive', 'console.log', 'console.error', 'C:\\', 'D:\\', 'G:\\'
]) check(!documents.harness.includes(forbidden), `harness excludes ${forbidden}`);
has('tests', [
  'starts detached, immutable, synthetic, and without real key authority',
  'allows exactly one bounded lease and releases it before sealing',
  'produces only a non-submittable synthetic candidate after exact sealing',
  'rejects candidate creation before sealing and invalid transition order',
  'rejects stale epochs, malformed shapes, and ambiguous identifiers without mutation',
  'rejects malformed, genesis, and reused proof digests without partial mutation',
  'prevents a second lease and any transition after sealing',
  'rejects extra fields on every epoch/proof transition'
]);
check(documents.index.includes("export * from './synthetic-key-lifecycle-proof-harness.js'"), 'Core Service exports the harness boundary');
check(!documents.runtime.includes('SyntheticKeyLifecycleProofHarness'), 'Core Service runtime does not attach the harness');
check(!documents.ledgerSource.includes('synthetic-key-lifecycle-proof-harness'), 'readiness ledger does not attach the harness');
check(!documents.contracts.includes('synthetic-key-lifecycle') && !documents.contracts.includes('productionSubmissionAllowed'), 'local administration contract exposes no synthetic lifecycle method');
has('decision', [
  'pure synthetic key-lifecycle state machine',
  'detached, protected, session-open, sealing, and sealed states',
  'At most one synthetic plaintext lease',
  'Invalid or rejected transitions leave the immutable current snapshot unchanged',
  '`modeledGate: KEY_LIFECYCLE_PROOF`',
  'does not expose production-like `gateId`',
  '`productionSubmissionAllowed: false`',
  'does not attach it to device-secret runtime',
  'never generates, loads, accepts, exports, or stores real key material',
  'No production readiness gate is marked PASS'
]);
has('predecessor', ['Status: ACTIVE', 'does not wire it into the Core Service runtime', 'No production writer lease']);
has('readiness', ['Status: ACTIVE', 'trusted evidence verifier', 'DEC-171 is not replaced or weakened']);
has('cutover', ['Status: ACTIVE', 'No API in 31-J can enable cutover']);
has('audit', ['Pure synthetic', 'Real key material', 'DEC-171 remains active and blocked']);

const scope = JSON.parse(documents.scope);
const plan = JSON.parse(documents.plan);
const governance = JSON.parse(documents.governance);
const authority = JSON.parse(documents.authority);
check(scope.step === '31-O' && scope.decision === 'DEC-176' && scope.predecessorDecision === 'DEC-175', 'scope identity and predecessor');
check(scope.readinessDecision === 'DEC-172' && scope.cutoverDecision === 'DEC-171', 'scope readiness and cutover decisions');
check(scope.targets.stateMachine === 'PURE_SYNTHETIC_KEY_LIFECYCLE_ONLY', 'scope selects pure synthetic lifecycle harness');
check(scope.targets.lifecycle === 'DETACHED_PROTECTED_SESSION_OPEN_SEALING_SEALED', 'scope fixes lifecycle order');
check(scope.targets.inputShape === 'EXACT_KEYS_ONLY_EXTRA_FIELDS_REJECTED', 'scope requires exact input shape');
check(scope.targets.proofRule === 'LOWERCASE_SHA256_NON_GENESIS_NEVER_REUSED', 'scope forbids proof reuse');
check(scope.targets.leaseRule === 'AT_MOST_ONE_SYNTHETIC_PLAINTEXT_LEASE_RELEASED_BEFORE_SEALED', 'scope bounds plaintext lease');
check(scope.targets.rejectionAtomicity === 'FAILED_TRANSITION_LEAVES_STATE_UNCHANGED', 'scope requires rejection atomicity');
check(scope.targets.candidateClassification === 'MODELED_GATE_ONLY_NO_GATE_ID_NON_SUBMITTABLE', 'scope forbids production submission');
check(scope.targets.runtimeIntegration === 'NOT_WIRED' && scope.targets.realKeyMaterial === 'NOT_ACCESSED' && scope.targets.realKeyLifecycleGate === 'NOT_SATISFIED', 'scope excludes runtime, real material, and real gate');
check(scope.openBoundaries.productionProtectedProvider === 'NOT_ATTACHED' && scope.openBoundaries.realVaultTransfer === 'NOT_PERFORMED_BLOCKED', 'provider and real vault remain blocked');
check(scope.openBoundaries.processCrashEvidence === 'NOT_PROVEN' && scope.openBoundaries.staleLeaseRecovery === 'NOT_PROVEN', 'crash and stale-lease recovery remain open');
check(scope.requirementCompletionClaimed === false && scope.newBuildIssued === false, 'scope makes no requirement or Build claim');
check(authority.status === 'PASS' && authority.authority === 'EXPLICIT_USER_CONTINUATION_APPLY_31_O', 'authority binds explicit user continuation');
check(authority.authoritativeSourceAtStart.treeSha256 === 'f9c3d48a88d28679a36863c342d408668aefb84fbb59ac10ba17fe40926af90e', 'authority binds exact 31-N source');
check(authority.preparedPackage.inventorySha256 === '890711f1474fab7f157f94ae238fa0bde90a2473e332bd8f2bc0ea07c6251277', 'authority binds prepared inventory');
check(authority.preparedPackage.validationSha256 === '2b13ea22bd458c5f48d21a6f2538d9cd1685b5ccf91fee33a373b2e75007ad9a', 'authority binds prepared validation');
const step = plan.steps.find((item) => item.id === '31-O');
const active = plan.currentStep === '31-O' && step?.status === 'IN_PROGRESS' && governance.activeMicroStep === '31-O' && String(governance.libraryUploadStatus).startsWith('31-O_');
const complete = plan.currentStep === '31-O' && step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS' && governance.activeMicroStep === null && governance.libraryUploadStatus === '31-O_COMPLETED_RECEIPT_PASS';
const later = inspectAuthorizedSuccessorLifecycle({ plan, ledger: governance, predecessorId: '31-O' });
check(active || complete || (later.planValid && later.ledgerValid && later.nextTaskValid), '31-O has an active, completed, or authorized-successor lifecycle');

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '31-O',
  phase: 'SYNTHETIC_KEY_LIFECYCLE_PROOF_HARNESS_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS',
  expected: checks.length,
  executed: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  failures,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: 'Bu PASS yalnız sentetik ve gönderilemez düzeneğe aittir; gerçek KEY_LIFECYCLE_PROOF, korumalı sağlayıcı, runtime bağlantısı veya cutover PASS değildir.'
};
if (!successorRegression) {
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/31-O_SYNTHETIC_KEY_LIFECYCLE_PROOF_HARNESS_CONTRACT.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failures.length) {
  console.error(`31-O contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`31-O contract: PASS (${checks.length}/${checks.length}).`);
