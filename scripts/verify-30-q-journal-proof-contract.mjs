import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const REPORT_PATH = 'artifacts/validation/30-Q-journal-proof-contract.json';
const paths = {
  authority: 'artifacts/authority/30-Q_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  scope: 'config/30-q-journal-proof-and-rollback-anchor-scope.json',
  decision: 'docs/decisions/DEC-142-ppk-002-journal-proof-and-rollback-anchor.md',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  policy: 'packages/platform-policy/src/policy-enforcement-point.ts',
  repositoryContract: 'packages/repository-contracts/src/platform-policy-transaction-repository.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  repository: 'packages/repositories/src/platform-policy-transaction-repository.ts',
  sink: 'apps/desktop/src/main/platform-policy-receipt-file-sink.ts',
  runtime: 'apps/desktop/src/main/archive-production-policy-runtime.ts',
  focusedTest: 'apps/desktop/tests/archive-durable-policy-transaction-runtime.test.ts',
  packageJson: 'package.json',
  predecessorCompletion: 'artifacts/checkpoints/30-P_COMPLETION_RECORD.json',
  predecessorReceipt: 'artifacts/checkpoints/30-P_LIBRARY_RECEIPT.json',
  predecessorReceiptReadback: 'artifacts/validation/30-P_RECEIPT_READBACK_VERIFICATION.json'
};

const source = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [
  key,
  await readFile(path, 'utf8')
])));
const json = (key) => JSON.parse(source[key]);
const checks = [];
const failures = [];
const check = (condition, name, details = undefined) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status, ...(details === undefined ? {} : { details }) });
  if (!condition) failures.push(name);
};
const contains = (key, marker, name) => check(source[key].includes(marker), name, { path: paths[key], marker });
const inOrder = (key, markers, name) => {
  let cursor = -1;
  for (const marker of markers) {
    cursor = source[key].indexOf(marker, cursor + 1);
    if (cursor < 0) break;
  }
  check(cursor >= 0, name, { path: paths[key], markers });
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const authority = json('authority');
const scope = json('scope');
const plan = json('plan');
const ledger = json('ledger');
const packageJson = json('packageJson');
const completion = json('predecessorCompletion');
const receipt = json('predecessorReceipt');
const receiptReadback = json('predecessorReceiptReadback');

check(authority.step === '30-Q' && authority.requirement === 'PPK-002' && authority.status === 'PASS', 'priority authority binds PASS 30-Q/PPK-002');
check(authority.authority === 'DEC-137_FULL_AUTO_PRIORITY_SELECTION', 'priority authority derives from DEC-137');
check(authority.predecessor?.step === '30-P' && authority.predecessor?.persistentReceiptStatus === 'PASS', 'priority authority binds the completed persistent predecessor');
check(authority.selectedOpenFindings?.includes('30-P-REAUDIT-07-JOURNAL-ACK-PROOF-TOKEN'), 'priority authority selects the acknowledgement proof finding');
check(authority.selectedOpenFindings?.includes('30-P-REAUDIT-10-VALID-COMPLETE-TAIL-ROLLBACK'), 'priority authority selects the complete-tail rollback finding');
check(authority.mandatoryTruthSentence === TRUTH, 'priority authority preserves the truth sentence');

check(scope.step === '30-Q' && scope.scope === 'PROTECTED_JOURNAL_CRYPTOGRAPHIC_ACKNOWLEDGEMENT_PROOF_AND_SQLITE_ROLLBACK_ANCHOR', 'scope has the canonical 30-Q identity');
check(scope.targets?.length === 5 && new Set(scope.targets.map((item) => item.id)).size === 5, 'scope declares five unique targets');
check(scope.requiredOrder?.join('|') === 'trusted-journal-readback|cryptographic-proof-issuance|cryptographic-proof-verification|sqlite-proof-bound-acknowledgement|monotonic-anchor-update|pre-authorization-anchor-verification', 'scope fixes the six-stage security order');
check(scope.evidenceBoundary?.PPK002 === 'PARTIAL', 'scope keeps PPK-002 PARTIAL');
check(scope.evidenceBoundary?.externalMonotonicAuthorityAgainstCoordinatedDatabaseAndJournalRollback === 'NOT_IMPLEMENTED', 'scope preserves coordinated rollback as NOT_IMPLEMENTED');
check(scope.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', 'scope preserves universal repository enforcement');
check(scope.evidenceBoundary?.requirementCompletionClaimed === false, 'scope does not claim requirement completion');
check(scope.mandatoryTruthSentence === TRUTH, 'scope preserves the truth sentence');
contains('decision', '# DEC-142', 'DEC-142 heading exists');
contains('decision', 'does not claim protection when an attacker rolls back the database and journal together', 'DEC-142 states the coordinated rollback boundary');
contains('decision', TRUTH, 'DEC-142 preserves the truth sentence');

check(plan.currentStep === '30-Q', 'work plan selects 30-Q');
check(plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 1, 'work plan contains exactly one active step');
check(plan.steps.find((item) => item.id === '30-Q')?.persistentReceiptStatus === 'PENDING', 'work plan keeps 30-Q receipt PENDING');
check(ledger.nextOfficialTask?.startsWith('30-Q PPK-002'), 'active ledger selects 30-Q');
check(ledger.libraryUploadStatus === '30-Q_IN_PROGRESS_PREDECESSOR_30-P_RECEIPT_CHAIN_PASS', 'active ledger distinguishes predecessor receipt from current pending work');

contains('policy', 'export interface PlatformPolicyJournalProjectionProof', 'platform policy exports the proof contract');
for (const field of ['receiptHash', 'recordHash', 'receiptNonce', 'entrySequence', 'entryHash', 'headSequence', 'headHash', 'journalSizeBytes', 'issuedAt', 'proofMac']) {
  contains('policy', `readonly ${field}:`, `proof contract contains ${field}`);
}
contains('policy', 'Promise<PlatformPolicyJournalProjectionProof> | PlatformPolicyJournalProjectionProof', 'receipt ensure must return a projection proof');
contains('policy', 'verifyProjectionProof?', 'receipt sink exposes proof verification');

contains('repositoryContract', 'readonly proof: PlatformPolicyJournalProjectionProof;', 'acknowledgement input requires the proof');
contains('repositoryContract', 'export interface PlatformPolicyJournalAnchor', 'repository contract exposes the journal anchor');
contains('repositoryContract', 'readJournalAnchor(', 'repository contract exposes anchor readback');

contains('migration', "createMigrationDefinition(57, 'protected_journal_projection_proof'", 'migration 57 is registered');
contains('migration', 'ADD COLUMN proof_mac TEXT', 'projection outbox stores the proof MAC');
contains('migration', 'trg_platform_policy_projection_insert_proof_empty', 'pending rows reject premature proof data');
contains('migration', 'invalid or unbound platform policy journal projection proof', 'projection update fails closed without a bound proof');
contains('migration', 'CREATE TABLE platform_policy_journal_anchors', 'migration creates the SQLite journal anchor');
contains('migration', 'CHECK(head_sequence>=entry_sequence)', 'anchor head cannot precede its receipt entry');
contains('migration', 'trg_platform_policy_journal_anchor_update', 'anchor update has a monotonic trigger');
contains('migration', 'NEW.head_sequence<=OLD.head_sequence', 'anchor rejects non-increasing replacement');
contains('migration', 'trg_platform_policy_journal_anchor_delete', 'anchor deletion is blocked');
contains('migration', 'REVISION-30-Q-PPK-002-JOURNAL-PROOF-ROLLBACK-ANCHOR', 'schema generation records 30-Q');

contains('repository', 'computePlatformPolicyReceiptRecordHash', 'repository computes the canonical record hash');
contains('repository', 'assertProjectionProof', 'repository validates proof shape and binding');
contains('repository', 'proof.recordHash !== computePlatformPolicyReceiptRecordHash(record)', 'repository binds proof to exact canonical record');
contains('repository', "SET status='projected',projected_at=?,", 'repository changes projection status with proof fields');
contains('repository', 'INSERT INTO platform_policy_journal_anchors(', 'repository anchors a successful acknowledgement');
contains('repository', 'WHERE excluded.head_sequence>platform_policy_journal_anchors.head_sequence', 'repository advances only to a newer head');
contains('repository', 'public readJournalAnchor(', 'repository implements anchor readback');
inOrder('repository', ['assertProjectionProof(input.proof', "SET status='projected'", 'INSERT INTO platform_policy_journal_anchors('], 'repository validates, acknowledges and anchors in order');

contains('sink', 'projectionProofPayload', 'sink defines the canonical proof payload');
contains('sink', "PROJECTION_PROOF_MAC_DOMAIN = 'ppt.platform-policy.journal-projection-proof.v1\\0'", 'sink domain-separates projection proof MACs');
contains('sink', 'projectionProofMac(this.#macKey, payload)', 'sink authenticates proof with its protected MAC key');
contains('sink', '#createProjectionProof(', 'sink creates proof only from a verified entry');
contains('sink', 'return this.#createProjectionProof(verified, verifiedEntries, readback.byteLength);', 'new append returns proof after exact readback');
contains('sink', 'return this.#createProjectionProof(existing, entries, before.byteLength);', 'idempotent ensure returns proof for exact existing record');
contains('sink', 'public verifyProjectionProof(', 'sink implements proof verification');
contains('sink', 'journalPrefixSize(bytes, proof.headSequence) === proof.journalSizeBytes', 'proof verification binds the exact anchored byte prefix');
contains('sink', 'head.entryHash === proof.headHash', 'proof verification binds the anchored head hash');
contains('sink', 'sha256(canonicalize(entry.record)) === proof.recordHash', 'proof verification binds exact canonical record content');

contains('runtime', 'policyTransactionRepository.readJournalAnchor(', 'runtime loads the SQLite anchor');
contains('runtime', 'verifyProjectionProof.call(', 'runtime invokes cryptographic proof verification');
contains('runtime', 'journal no longer contains its SQLite-anchored complete head', 'runtime fails closed on complete-tail rollback');
contains('runtime', 'returned an invalid projection proof', 'runtime leaves invalid projection proof pending');
contains('runtime', 'proof\n          }', 'runtime passes proof into acknowledgement');
inOrder('runtime', ['readJournalAnchor(', 'anchored.value.proof', 'listPendingJournalProjections('], 'runtime verifies the existing anchor before reading pending projections');
inOrder('runtime', ['ensureReceipt.call', 'verifyProjectionProof.call', 'acknowledgeJournalProjection('], 'runtime ensures, verifies and only then acknowledges');
contains('runtime', "typeof dependencies.receiptSink?.verifyProjectionProof !== 'function'", 'production composition requires proof verification');
contains('runtime', "typeof dependencies.policyTransactionRepository?.readJournalAnchor !== 'function'", 'production composition requires anchor readback');

check((source.focusedTest.match(/\bit\(/gu) ?? []).length === 16, 'focused runtime declares exactly sixteen tests');
contains('focusedTest', 'rejects same-nonce tamper', 'focused runtime retains exact-record tamper coverage');
contains('focusedTest', 'proofMac: \'0\'.repeat(64)', 'focused runtime rejects proof MAC tamper');
contains('focusedTest', 'invalid or unbound platform policy journal projection proof', 'focused runtime exercises the SQLite missing-proof trigger');
contains('focusedTest', 'detects rollback to an older internally valid complete journal tail from the SQLite anchor', 'focused runtime covers complete-tail rollback');
contains('focusedTest', 'expect(sink.verifyProjectionProof(secondProof)).toBe(false)', 'focused runtime observes rollback proof failure');
contains('focusedTest', "code: 'RECEIPT_PERSISTENCE_FAILED'", 'focused runtime proves authorization fails closed after rollback');

check(completion.step === '30-P' && completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED', 'predecessor completion remains PASS/COMPLETED');
check(completion.persistentReceiptStatus === 'PASS', 'predecessor completion binds a PASS receipt');
check(receipt.status === 'PASS', 'predecessor Library receipt remains PASS');
check(receiptReadback.status === 'PASS', 'predecessor receipt readback remains PASS');
check(sha256(source.predecessorReceipt).length === 64 && sha256(source.predecessorReceiptReadback).length === 64, 'predecessor receipt evidence has deterministic SHA-256 identities');

check(packageJson.scripts?.['verify:30-q:journal-proof-contract'] === 'node scripts/verify-30-q-journal-proof-contract.mjs', 'package exposes the 30-Q contract gate');
check(packageJson.scripts?.['verify:30-q:journal-proof-runtime'] === 'node scripts/verify-30-q-journal-proof-runtime.mjs', 'package exposes the 30-Q runtime gate');

const status = failures.length === 0 ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-Q',
  requirement: 'PPK-002',
  phase: 'JOURNAL_PROOF_AND_ROLLBACK_ANCHOR_CONTRACT',
  status,
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  evidenceBoundary: scope.evidenceBoundary,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (status !== 'PASS') {
  console.error(`30-Q journal proof contract: FAIL (${failures.length}/${checks.length}).`);
  console.error(failures.join('\n'));
  console.error(TRUTH);
  process.exit(1);
}
console.log(`30-Q journal proof contract: PASS (${checks.length}/${checks.length}; PPK-002 remains PARTIAL).`);
console.log(TRUTH);
