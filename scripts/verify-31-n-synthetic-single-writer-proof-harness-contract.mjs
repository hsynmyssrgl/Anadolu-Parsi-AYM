import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const successorRegression = process.argv.includes('--successor-regression');
const paths = {
  harness: 'apps/core-service/src/synthetic-single-writer-proof-harness.ts',
  tests: 'apps/core-service/tests/synthetic-single-writer-proof-harness.test.ts',
  index: 'apps/core-service/src/index.ts',
  runtime: 'apps/core-service/src/core-service-runtime.ts',
  ledgerSource: 'apps/core-service/src/family-data-cutover-readiness-ledger.ts',
  contracts: 'packages/core-service-contracts/src/index.ts',
  decision: 'docs/decisions/DEC-175-synthetic-single-writer-proof-harness-boundary.md',
  predecessor: 'docs/decisions/DEC-174-signed-cutover-readiness-evidence-verifier-boundary.md',
  readiness: 'docs/decisions/DEC-172-monotonic-cutover-readiness-evidence.md',
  cutover: 'docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md',
  scope: 'config/31-n-synthetic-single-writer-proof-harness-scope.json',
  plan: 'config/work-segmentation-plan.json',
  governance: 'config/active-governance-ledger.json',
  authority: 'artifacts/authority/31-N_SYNTHETIC_SINGLE_WRITER_PROOF_HARNESS_AUTHORITY.json',
  audit: 'docs/audit/31-N_SYNTHETIC_SINGLE_WRITER_PROOF_HARNESS.md'
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
  'SyntheticSingleWriterSnapshot',
  'SyntheticSingleWriterTransfer',
  'SyntheticSingleWriterProofError',
  'SyntheticSingleWriterProofHarness',
  "'MALFORMED_TRANSFER'",
  "'STALE_EPOCH'",
  "'STALE_PROOF'",
  "'OWNER_MISMATCH'",
  "'DUAL_WRITER'",
  "'PROOF_INVALID'",
  "evidenceClass: 'synthetic-single-writer-non-authoritative'",
  'syntheticOnly: true',
  'realGateSatisfied: false',
  'cutoverAuthorityAttached: false',
  'realDataAccessed: false',
  "owner: 'desktop'",
  'desktopWritable: true',
  'coreServiceWritable: false',
  'hasExactTransferKeys',
  'Number.isSafeInteger(value.expectedEpoch)',
  'value.expectedEpoch !== this.#state.epoch',
  'value.previousProofDigest !== this.#state.proofDigest',
  'value.desktopWritable === value.coreServiceWritable',
  'value.proofDigest === value.previousProofDigest',
  'freezeSnapshot'
]);
for (const forbidden of [
  'node:fs', 'node:sqlite', 'better-sqlite', 'electron', 'node:net', 'node:http', 'child_process', 'process.env',
  'setTimeout', 'databasePath', 'authenticationToken', 'password', 'privateKey', 'verificationBinding',
  'Google Drive', 'console.log', 'console.error', 'C:\\', 'D:\\', 'G:\\'
]) check(!documents.harness.includes(forbidden), `harness excludes ${forbidden}`);
has('tests', [
  'starts from an immutable Desktop-only synthetic state with no real authority',
  'accepts an exact chained transfer while preserving single-writer state',
  'rejects stale epochs and stale proof-chain heads without changing state',
  'rejects both dual-writer and zero-writer proposals without changing state',
  'rejects owner/flag mismatches, invalid digests, and proof reuse',
  'rejects unknown or extra transfer fields and never partially mutates'
]);
check(documents.index.includes("export * from './synthetic-single-writer-proof-harness.js'"), 'Core Service exports only the harness boundary');
check(!documents.runtime.includes('SyntheticSingleWriterProofHarness'), 'Core Service runtime does not attach the harness');
check(!documents.ledgerSource.includes('synthetic-single-writer-proof-harness'), 'readiness ledger does not attach the harness');
check(!documents.contracts.includes('single-writer-proof') && !documents.contracts.includes('syntheticOnly'), 'local administration contract exposes no synthetic proof method');
has('decision', [
  'pure synthetic state machine',
  'Dual-writer and zero-writer proposals fail closed',
  'A rejected transition leaves the immutable current snapshot unchanged',
  '`syntheticOnly: true`',
  '`realGateSatisfied: false`',
  'can never by itself satisfy the real `SINGLE_WRITER_PROOF` readiness gate',
  'does not wire it into the Core Service runtime',
  'No production writer lease',
  'DEC-171, DEC-172, DEC-173, and DEC-174 are not replaced or weakened',
  'No production readiness gate is marked PASS'
]);
has('predecessor', ['Status: ACTIVE', 'does not attach it to the readiness ledger or Core Service runtime', 'DEC-171, DEC-172, and DEC-173 are not replaced or weakened']);
has('readiness', ['Status: ACTIVE', 'trusted evidence verifier', 'DEC-171 is not replaced or weakened']);
has('cutover', ['Status: ACTIVE', 'No API in 31-J can enable cutover']);
has('audit', ['Pure synthetic', 'real family-data', 'DEC-171 remains active and blocked']);

const scope = JSON.parse(documents.scope);
const plan = JSON.parse(documents.plan);
const governance = JSON.parse(documents.governance);
const authority = JSON.parse(documents.authority);
check(scope.step === '31-N' && scope.decision === 'DEC-175' && scope.predecessorDecision === 'DEC-174', 'scope identity and predecessor');
check(scope.readinessDecision === 'DEC-172' && scope.cutoverDecision === 'DEC-171', 'scope readiness and cutover decisions');
check(scope.targets.stateMachine === 'PURE_SYNTHETIC_SINGLE_WRITER_ONLY', 'scope selects pure synthetic harness');
check(scope.targets.initialOwner === 'DESKTOP_ONLY_MATCHES_DEC_171_DEFAULT', 'scope preserves Desktop initial authority');
check(scope.targets.writerExclusivity === 'EXACTLY_ONE_WRITABLE_DUAL_AND_ZERO_WRITER_REJECTED', 'scope rejects dual and zero writer');
check(scope.targets.rejectionAtomicity === 'FAILED_TRANSITION_LEAVES_STATE_UNCHANGED', 'scope requires rejection atomicity');
check(scope.targets.evidenceClassification === 'SYNTHETIC_NON_AUTHORITATIVE_REAL_GATE_FALSE', 'scope forbids real gate claim');
check(scope.targets.runtimeIntegration === 'NOT_WIRED' && scope.targets.realSingleWriterGate === 'NOT_SATISFIED', 'scope excludes runtime and real gate');
check(scope.openBoundaries.realVaultTransfer === 'NOT_PERFORMED_BLOCKED' && scope.openBoundaries.sqliteOwnershipTransfer === 'NOT_PERFORMED_BLOCKED', 'real data and SQLite remain blocked');
check(scope.openBoundaries.productionWriterLease === 'NOT_ATTACHED' && scope.openBoundaries.processCrashEvidence === 'NOT_PROVEN', 'production lease and crash proof remain open');
check(scope.requirementCompletionClaimed === false && scope.newBuildIssued === false, 'scope makes no requirement or Build claim');
check(authority.status === 'PASS' && authority.authority === 'EXPLICIT_USER_CONTINUATION_APPLY_31_N', 'authority binds explicit user instruction');
check(authority.authoritativeSourceAtStart.treeSha256 === '7a5e1f41a78906c804119e7f8ebebed0d86f028b31e47248fd171d3637f416e5', 'authority binds exact 31-M source');
check(authority.preparedPackage.inventorySha256 === '94629a14455c511618a32b1efb66043dd3f4e5e948db15e9e3e4742d457af426', 'authority binds prepared inventory');
const step = plan.steps.find((item) => item.id === '31-N');
const active = plan.currentStep === '31-N' && step?.status === 'IN_PROGRESS' && governance.activeMicroStep === '31-N' && String(governance.libraryUploadStatus).startsWith('31-N_');
const complete = plan.currentStep === '31-N' && step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS' && governance.activeMicroStep === null && governance.libraryUploadStatus === '31-N_COMPLETED_RECEIPT_PASS';
const later = inspectAuthorizedSuccessorLifecycle({ plan, ledger: governance, predecessorId: '31-N' });
check(active || complete || (later.planValid && later.ledgerValid && later.nextTaskValid), '31-N has an active, completed, or authorized-successor lifecycle');

const report = {
  schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '31-N', phase: 'SYNTHETIC_SINGLE_WRITER_PROOF_HARNESS_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS', expected: checks.length, executed: checks.length,
  passed: checks.length - failures.length, failed: failures.length, checks, failures, generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: 'Bu PASS yalnız sentetik ve yetkisiz düzeneğe aittir; gerçek SINGLE_WRITER_PROOF, üretim lease, runtime bağlantısı veya cutover PASS değildir.'
};
if (!successorRegression) {
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/31-N_SYNTHETIC_SINGLE_WRITER_PROOF_HARNESS_CONTRACT.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failures.length) {
  console.error(`31-N contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`31-N contract: PASS (${checks.length}/${checks.length}).`);
