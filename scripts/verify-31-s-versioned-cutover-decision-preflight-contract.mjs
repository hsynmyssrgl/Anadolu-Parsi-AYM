import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const successorRegression = process.argv.includes('--successor-regression');
const paths = {
  preflight: 'apps/core-service/src/versioned-cutover-decision-preflight.ts', tests: 'apps/core-service/tests/versioned-cutover-decision-preflight.test.ts',
  index: 'apps/core-service/src/index.ts', runtime: 'apps/core-service/src/core-service-runtime.ts', ledgerSource: 'apps/core-service/src/family-data-cutover-readiness-ledger.ts',
  contracts: 'packages/core-service-contracts/src/index.ts', decision: 'docs/decisions/DEC-180-versioned-cutover-decision-preflight-boundary.md',
  predecessor: 'docs/decisions/DEC-179-explicit-user-approval-receipt-boundary.md', readiness: 'docs/decisions/DEC-172-monotonic-cutover-readiness-evidence.md',
  cutover: 'docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md', scope: 'config/31-s-versioned-cutover-decision-preflight-scope.json',
  plan: 'config/work-segmentation-plan.json', governance: 'config/active-governance-ledger.json', authority: 'artifacts/authority/31-S_VERSIONED_CUTOVER_DECISION_PREFLIGHT_AUTHORITY.json',
  audit: 'docs/audit/31-S_VERSIONED_CUTOVER_DECISION_PREFLIGHT.md'
};
const documents = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const checks = []; const failures = [];
const check = (condition, name) => { checks.push({ name, status: condition ? 'PASS' : 'FAIL' }); if (!condition) failures.push(name); };
const has = (key, markers) => { for (const marker of markers) check(documents[key].includes(marker), `${key} contains ${marker}`); };

has('preflight', [
  'VERSIONED_CUTOVER_PREFLIGHT_REQUIRED_GATES', 'VersionedCutoverPreflightGateState', 'VersionedCutoverDecisionPreflightInput',
  'VersionedCutoverDecisionPreflight', 'VersionedCutoverDecisionPreflightError', 'evaluateVersionedCutoverDecisionPreflight',
  "preflightClass: 'read-only-successor-decision-preflight-non-authoritative'", "currentDecision: 'DEC-171'", "decision: 'blocked'",
  'preflightDigest', 'allRequiredGatesPass', 'authoritativeSourceSealVerified', 'readinessLedgerIntegrityVerified',
  'readinessLedgerTrustedAnchorAttached', 'readinessLedgerEvidenceReady', 'eligibleForSuccessorDecision',
  'successorDecisionRequired: true', 'successorDecisionCreated: false', 'versionedDecisionSubmissionPerformed: false',
  'productionRuntimeWiring: false', 'independentEvidenceVerificationPerformed: false', 'userConsentCreatedByBoundary: false',
  'cutoverAuthorityAttached: false', 'automaticActivationAllowed: false', 'realDataTransferAllowed: false', 'writeOwnershipTransferAllowed: false',
  'isPlainDataObjectWithExactKeys', 'Object.getOwnPropertyDescriptors', 'isNonGenesisSha256',
  "'INPUT_MALFORMED'", "'DIGEST_INVALID'", "'GATE_SET_INVALID'", "'GATE_DUPLICATE'", "'GATE_STATE_INVALID'", "'EVIDENCE_REUSED'", "'LEDGER_SNAPSHOT_INVALID'",
  'candidate.readinessLedgerEpoch !== candidate.readinessLedgerEntryCount', 'candidate.readinessLedgerEntryCount !== passCount',
  "'PPT-VERSIONED-CUTOVER-DECISION-PREFLIGHT-V1'", "'SEPARATE_VERSIONED_SUCCESSOR_DECISION_REQUIRED'",
  "'READINESS_LEDGER_TRUSTED_ANCHOR_REQUIRED'"
]);
for (const gate of ['END_TO_END_SECURITY_VALIDATION', 'KEY_LIFECYCLE_PROOF', 'SINGLE_WRITER_PROOF', 'ROLLBACK_DRILL', 'EXPLICIT_USER_CUTOVER_APPROVAL']) {
  check(documents.preflight.includes(`'${gate}'`), `preflight contains gate ${gate}`);
}
for (const forbidden of ['node:fs', 'node:sqlite', 'better-sqlite', 'electron', 'node:net', 'node:http', 'child_process', 'process.env', 'setTimeout', 'databasePath', 'authenticationToken', 'password', 'privateKey', 'safeStorage', 'DPAPI', 'Google Drive', 'console.log', 'console.error', 'C:\\', 'D:\\', 'G:\\']) {
  check(!documents.preflight.includes(forbidden), `preflight excludes ${forbidden}`);
}
check(!documents.preflight.includes('gateId'), 'preflight exposes no production-like gateId');
has('tests', [
  'remains blocked and non-authoritative even when successor-decision eligible',
  'uses canonical gate order so the digest is insertion-order independent',
  'is ineligible when one gate is pending without granting any authority',
  'reports source-seal, integrity, and trusted-anchor blockers independently',
  'rejects extra input fields and accessor-backed input before evaluation',
  'rejects missing, duplicate, unknown, and polluted gate sets',
  'rejects contradictory pending and PASS gate evidence states',
  'rejects malformed or genesis source, ledger-head, and evidence digests',
  'rejects evidence digest reuse across distinct gates',
  'rejects unsafe or inconsistent ledger epoch and entry counters',
  'does not expose gate evidence digests, source seals, or the ledger head',
  'does not mutate caller input or create a successor decision'
]);
check(documents.index.includes("export * from './versioned-cutover-decision-preflight.js'"), 'Core Service exports the preflight boundary');
check(!documents.runtime.includes('evaluateVersionedCutoverDecisionPreflight'), 'Core Service runtime does not attach the preflight');
check(!documents.ledgerSource.includes('versioned-cutover-decision-preflight'), 'readiness ledger does not attach the preflight');
check(!documents.contracts.includes('VersionedCutoverDecisionPreflight') && !documents.contracts.includes('versioned-cutover-decision-preflight'), 'local administration contract exposes no preflight method');

has('decision', [
  'Versioned cutover decision preflight detached no-authority boundary', 'does not create a successor decision',
  'exactly five canonical readiness gates', 'exact plain-data key sets', 'globally unique, non-genesis lowercase SHA-256 evidence',
  'epoch and entry count must be safe integers', 'Both readiness-ledger integrity and a trusted anchor',
  'fixed canonical gate order', 'does not expose raw gate evidence', '`currentDecision: DEC-171`', '`decision: blocked`',
  '`successorDecisionCreated: false`', '`versionedDecisionSubmissionPerformed: false`', 'Eligibility is informational only',
  'performs no independent evidence verification', 'DEC-171 through DEC-179 are not replaced or weakened'
]);
has('predecessor', ['Status: ACTIVE', 'default composition has no approval verifier', 'creates no approval receipt and records no real user consent']);
has('readiness', ['Status: ACTIVE', 'trusted evidence verifier', 'DEC-171 is not replaced or weakened']);
has('cutover', ['Status: ACTIVE', 'User approval alone does not bypass the technical gates', 'No API in 31-J can enable cutover']);
has('audit', ['detached read-only preflight boundary', 'not a successor cutover decision', 'DEC-171 remains active and blocked']);

const scope = JSON.parse(documents.scope); const plan = JSON.parse(documents.plan); const governance = JSON.parse(documents.governance); const authority = JSON.parse(documents.authority);
check(scope.step === '31-S' && scope.decision === 'DEC-180' && scope.predecessorDecision === 'DEC-179', 'scope identity and predecessor');
check(scope.targets.preflightBoundary === 'PURE_READ_ONLY_VERSIONED_SUCCESSOR_DECISION_PREFLIGHT_ONLY', 'scope selects pure read-only preflight');
check(scope.targets.gateSet === 'EXACT_FIVE_CANONICAL_READINESS_GATES' && scope.targets.inputShape === 'EXACT_PLAIN_DATA_KEYS_ONLY_ACCESSORS_AND_EXTRA_FIELDS_REJECTED', 'scope fixes gates and input shape');
check(scope.targets.gateStateRule === 'PASS_NON_GENESIS_SHA256_PENDING_NULL' && scope.targets.uniquenessRule === 'GATE_IDS_AND_EVIDENCE_DIGESTS_GLOBALLY_UNIQUE', 'scope fixes gate state and uniqueness');
check(scope.targets.ledgerCounterRule === 'EPOCH_ENTRY_COUNT_AND_PASS_COUNT_EXACT_MATCH', 'scope binds ledger counters');
check(scope.targets.sourceBinding === 'EXPECTED_OBSERVED_NON_GENESIS_SHA256_EXACT_MATCH' && scope.targets.ledgerHeadBinding === 'NON_GENESIS_LOWERCASE_SHA256_REQUIRED', 'scope binds source and ledger head');
check(scope.targets.ledgerEligibility === 'INTEGRITY_AND_TRUSTED_ANCHOR_BOTH_REQUIRED', 'scope requires integrity and trusted anchor');
check(scope.targets.canonicalization === 'FIXED_GATE_ORDER_INSERTION_INDEPENDENT' && scope.targets.outputRedaction === 'RAW_EVIDENCE_SOURCE_SEALS_AND_LEDGER_HEAD_NOT_EXPOSED', 'scope fixes canonical redaction');
check(scope.targets.preflightClassification === 'READ_ONLY_NON_AUTHORITATIVE_DEC_171_BLOCKED', 'scope keeps DEC-171 blocked');
check(scope.targets.successorDecision === 'NOT_CREATED' && scope.targets.versionedDecisionSubmission === 'NOT_PERFORMED', 'scope excludes successor decision and submission');
check(scope.targets.runtimeIntegration === 'NOT_WIRED' && scope.targets.independentEvidenceVerification === 'NOT_PERFORMED' && scope.targets.automaticActivation === 'NOT_ALLOWED', 'scope excludes runtime, independent verification, and activation');
check(scope.openBoundaries.versionedSuccessorDecision === 'NOT_CREATED' && scope.openBoundaries.successorDecisionSubmission === 'NOT_PERFORMED', 'successor decision remains absent');
check(scope.requirementCompletionClaimed === false && scope.newBuildIssued === false, 'scope makes no requirement or Build claim');
check(authority.status === 'PASS' && authority.authority === 'EXPLICIT_USER_CONTINUATION_APPLY_31_S_BOUNDARY_ONLY_NOT_SUCCESSOR_DECISION', 'authority binds boundary-only instruction');
check(authority.successorDecisionCreated === false && authority.realUserCutoverConsentGranted === false, 'authority creates no successor decision or consent');
check(authority.authoritativeSourceAtStart.treeSha256 === 'c946f9c031d76e16e199a649b500134800c54cbef074c6e760aecfce2d4649fd' && authority.authoritativeSourceAtStart.fileCount === 4399, 'authority binds 31-R source');
check(authority.preparedPackage.inventorySha256 === '538f4b8c8c07e83d22da6358301ffb5bc09942e3641e76dd3b5c1221e1e1f8e4' && authority.preparedPackage.validationSha256 === 'd4403fe5b2542d9f130a78d7329cda423bfbec62aa5210284cc385fac4432e03', 'authority binds prepared package');
const step = plan.steps.find((item) => item.id === '31-S');
const active = plan.currentStep === '31-S' && step?.status === 'IN_PROGRESS' && governance.activeMicroStep === '31-S' && String(governance.libraryUploadStatus).startsWith('31-S_');
const complete = plan.currentStep === '31-S' && step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS' && governance.activeMicroStep === null && governance.libraryUploadStatus === '31-S_COMPLETED_RECEIPT_PASS';
const later = inspectAuthorizedSuccessorLifecycle({ plan, ledger: governance, predecessorId: '31-S' });
check(active || complete || (later.planValid && later.ledgerValid && later.nextTaskValid), '31-S has an active, completed, or authorized-successor lifecycle');

const report = {
  schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '31-S', phase: 'VERSIONED_CUTOVER_DECISION_PREFLIGHT_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS', expected: checks.length, executed: checks.length, passed: checks.length - failures.length, failed: failures.length,
  checks, failures, generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: 'Bu PASS yalnız ayrık ve salt-okunur 31-S ön kontrol sınırına aittir; ardıl karar, gerçek kullanıcı onayı, production evidence verification, otomatik aktivasyon veya cutover PASS değildir.'
};
if (!successorRegression) { await mkdir('artifacts/validation', { recursive: true }); await writeFile('artifacts/validation/31-S_VERSIONED_CUTOVER_DECISION_PREFLIGHT_CONTRACT.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8'); }
if (failures.length) { console.error(`31-S contract: FAIL (${failures.length}/${checks.length}).`); for (const failure of failures) console.error(`- ${failure}`); process.exit(1); }
console.log(`31-S contract: PASS (${checks.length}/${checks.length}).`);
