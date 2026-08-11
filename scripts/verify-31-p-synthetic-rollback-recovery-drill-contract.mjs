import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const successorRegression = process.argv.includes('--successor-regression');
const paths = {
  drill: 'apps/core-service/src/synthetic-rollback-recovery-drill.ts',
  tests: 'apps/core-service/tests/synthetic-rollback-recovery-drill.test.ts',
  index: 'apps/core-service/src/index.ts',
  runtime: 'apps/core-service/src/core-service-runtime.ts',
  ledgerSource: 'apps/core-service/src/family-data-cutover-readiness-ledger.ts',
  contracts: 'packages/core-service-contracts/src/index.ts',
  decision: 'docs/decisions/DEC-177-synthetic-rollback-recovery-drill-boundary.md',
  predecessor: 'docs/decisions/DEC-176-synthetic-key-lifecycle-proof-harness-boundary.md',
  readiness: 'docs/decisions/DEC-172-monotonic-cutover-readiness-evidence.md',
  cutover: 'docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md',
  scope: 'config/31-p-synthetic-rollback-recovery-drill-scope.json',
  plan: 'config/work-segmentation-plan.json',
  governance: 'config/active-governance-ledger.json',
  authority: 'artifacts/authority/31-P_SYNTHETIC_ROLLBACK_RECOVERY_DRILL_AUTHORITY.json',
  audit: 'docs/audit/31-P_SYNTHETIC_ROLLBACK_RECOVERY_DRILL.md'
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

has('drill', [
  'SyntheticRollbackSnapshot', 'SyntheticRollbackEvidenceCandidate', 'SyntheticRollbackTransitionInput',
  'SyntheticRollbackDrillError', 'SyntheticRollbackRecoveryDrill',
  "'MALFORMED_INPUT'", "'STALE_EPOCH'", "'STATE_INVALID'", "'PROOF_INVALID'", "'PROOF_REUSED'", "'DRILL_INCOMPLETE'",
  "evidenceClass: 'synthetic-rollback-recovery-non-authoritative'", "modeledGate: 'ROLLBACK_DRILL'",
  'desktopWritable: true', 'coreServiceWritable: false', 'syntheticOnly: true', 'realDataTouched: false',
  'actualProcessCrashPerformed: false', 'realBackupRestorePerformed: false', 'productionGateSatisfied: false',
  'productionSubmissionAllowed: false', 'cutoverAuthorityAttached: false', "stage: 'idle'", 'hasExactKeys',
  'Number.isSafeInteger(value.expectedEpoch)', 'value.expectedEpoch !== this.#state.epoch',
  'this.#seenProofDigests.has(value.proofDigest)', 'freezeSnapshot'
]);
for (const forbidden of [
  'node:fs', 'node:sqlite', 'better-sqlite', 'electron', 'node:net', 'node:http', 'child_process', 'process.env',
  'setTimeout', 'databasePath', 'authenticationToken', 'password', 'privateKey', 'verificationBinding', 'safeStorage',
  'DPAPI', 'Google Drive', 'console.log', 'console.error', 'C:\\', 'D:\\', 'G:\\'
]) check(!documents.drill.includes(forbidden), `drill excludes ${forbidden}`);
has('tests', [
  'starts immutable, Desktop-only, synthetic, and without real recovery authority',
  'runs the exact synthetic drill while Desktop remains the only writer',
  'produces only a non-submittable modeled candidate with no gateId',
  'rejects candidate creation before recovery and out-of-order transitions',
  'rejects stale epochs and extra fields without mutation',
  'rejects malformed and genesis proof digests without partial mutation',
  'rejects proof reuse and keeps the accepted snapshot unchanged',
  'closes the drill after recovery and rejects every post-recovery transition'
]);
check(documents.index.includes("export * from './synthetic-rollback-recovery-drill.js'"), 'Core Service exports the drill boundary');
check(!documents.runtime.includes('SyntheticRollbackRecoveryDrill'), 'Core Service runtime does not attach the drill');
check(!documents.ledgerSource.includes('synthetic-rollback-recovery-drill'), 'readiness ledger does not attach the drill');
check(!documents.contracts.includes('synthetic-rollback-recovery') && !documents.contracts.includes('productionSubmissionAllowed'), 'local administration contract exposes no synthetic drill method');
has('decision', [
  'pure synthetic rollback and recovery state machine',
  'Desktop remains the only modeled writer',
  'Core Service never becomes writable',
  'exact `expectedEpoch` and `proofDigest` key set',
  'Invalid or rejected transitions leave the immutable current snapshot unchanged',
  'Failure injection does not crash a process',
  'does not restore a real backup',
  'does not expose production-like `gateId`',
  '`modeledGate: ROLLBACK_DRILL`',
  '`productionSubmissionAllowed: false`',
  'does not attach it to family-data runtime',
  'No production readiness gate is marked PASS'
]);
has('predecessor', ['Status: ACTIVE', 'never generates, loads, accepts, exports, or stores real key material', 'does not attach it to device-secret runtime']);
has('readiness', ['Status: ACTIVE', 'trusted evidence verifier', 'DEC-171 is not replaced or weakened']);
has('cutover', ['Status: ACTIVE', 'No API in 31-J can enable cutover']);
has('audit', ['synthetic', 'Real process crash', 'DEC-171 remains active and blocked']);

const scope = JSON.parse(documents.scope);
const plan = JSON.parse(documents.plan);
const governance = JSON.parse(documents.governance);
const authority = JSON.parse(documents.authority);
check(scope.step === '31-P' && scope.decision === 'DEC-177' && scope.predecessorDecision === 'DEC-176', 'scope identity and predecessor');
check(scope.readinessDecision === 'DEC-172' && scope.cutoverDecision === 'DEC-171', 'scope readiness and cutover decisions');
check(scope.targets.stateMachine === 'PURE_SYNTHETIC_ROLLBACK_RECOVERY_ONLY', 'scope selects pure synthetic drill');
check(scope.targets.drillSequence === 'BASELINE_SEALED_CANDIDATE_READ_ONLY_FAILURE_INJECTED_ROLLBACK_ACTIVE_DESKTOP_RESTORED_RECOVERY_VERIFIED', 'scope fixes drill order');
check(scope.targets.inputShape === 'EXACT_KEYS_ONLY_EXTRA_FIELDS_REJECTED', 'scope requires exact input shape');
check(scope.targets.proofRule === 'LOWERCASE_SHA256_NON_GENESIS_NEVER_REUSED', 'scope forbids proof reuse');
check(scope.targets.writerInvariant === 'DESKTOP_ONLY_CORE_SERVICE_NEVER_WRITABLE', 'scope preserves Desktop-only writer');
check(scope.targets.failureMode === 'SYNTHETIC_EVENT_ONLY_NO_PROCESS_CRASH' && scope.targets.recoveryMode === 'MODELED_ONLY_NO_BACKUP_RESTORE', 'scope excludes real crash and restore');
check(scope.targets.rejectionAtomicity === 'FAILED_TRANSITION_LEAVES_STATE_UNCHANGED', 'scope requires rejection atomicity');
check(scope.targets.candidateClassification === 'MODELED_GATE_ONLY_NO_GATE_ID_NON_SUBMITTABLE', 'scope forbids production submission');
check(scope.targets.runtimeIntegration === 'NOT_WIRED' && scope.targets.realRollbackDrillGate === 'NOT_SATISFIED', 'scope excludes runtime and real gate');
check(scope.openBoundaries.realProcessCrash === 'NOT_PERFORMED_NOT_PROVEN' && scope.openBoundaries.realBackupRestore === 'NOT_PERFORMED_NOT_PROVEN', 'real crash and backup restore remain open');
check(scope.openBoundaries.rollbackRecovery === 'SYNTHETIC_ONLY_REAL_NOT_PROVEN' && scope.openBoundaries.protectedJournalRecovery === 'NOT_PROVEN', 'real recovery remains unproven');
check(scope.requirementCompletionClaimed === false && scope.newBuildIssued === false, 'scope makes no requirement or Build claim');
check(authority.status === 'PASS' && authority.authority === 'EXPLICIT_USER_CONTINUATION_APPLY_31_P', 'authority binds explicit user continuation');
check(authority.authoritativeSourceAtStart.treeSha256 === '87806d9b9c0fde676cbd280e151e6fa6ae5951662171d3e7183f99a5981d6318', 'authority binds exact 31-O source');
check(authority.preparedPackage.inventorySha256 === '30885370716b2c225aadc6de36e3b2ec272685f0e2d89df7c3dc61f15690fbe4', 'authority binds prepared inventory');
check(authority.preparedPackage.validationSha256 === '9caa49ec35fa5346dd6fd7489f892fd079f84232119fa1a69d4a297554a89aa4', 'authority binds prepared validation');
const step = plan.steps.find((item) => item.id === '31-P');
const active = plan.currentStep === '31-P' && step?.status === 'IN_PROGRESS' && governance.activeMicroStep === '31-P' && String(governance.libraryUploadStatus).startsWith('31-P_');
const complete = plan.currentStep === '31-P' && step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS' && governance.activeMicroStep === null && governance.libraryUploadStatus === '31-P_COMPLETED_RECEIPT_PASS';
const later = inspectAuthorizedSuccessorLifecycle({ plan, ledger: governance, predecessorId: '31-P' });
check(active || complete || (later.planValid && later.ledgerValid && later.nextTaskValid), '31-P has an active, completed, or authorized-successor lifecycle');

const report = {
  schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '31-P', phase: 'SYNTHETIC_ROLLBACK_RECOVERY_DRILL_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS', expected: checks.length, executed: checks.length,
  passed: checks.length - failures.length, failed: failures.length, checks, failures, generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: 'Bu PASS yalnız sentetik ve gönderilemez tatbikata aittir; gerçek ROLLBACK_DRILL, süreç çökmesi, yedek geri yükleme, runtime bağlantısı veya cutover PASS değildir.'
};
if (!successorRegression) {
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/31-P_SYNTHETIC_ROLLBACK_RECOVERY_DRILL_CONTRACT.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failures.length) {
  console.error(`31-P contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`31-P contract: PASS (${checks.length}/${checks.length}).`);
