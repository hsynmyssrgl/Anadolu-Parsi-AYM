import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';
const successorRegression = process.argv.includes('--successor-regression');
const paths = {
  aggregator: 'apps/core-service/src/end-to-end-security-evidence-aggregator.ts', tests: 'apps/core-service/tests/end-to-end-security-evidence-aggregator.test.ts',
  index: 'apps/core-service/src/index.ts', runtime: 'apps/core-service/src/core-service-runtime.ts', ledgerSource: 'apps/core-service/src/family-data-cutover-readiness-ledger.ts',
  contracts: 'packages/core-service-contracts/src/index.ts', decision: 'docs/decisions/DEC-178-end-to-end-security-evidence-aggregator-boundary.md',
  predecessor: 'docs/decisions/DEC-177-synthetic-rollback-recovery-drill-boundary.md', readiness: 'docs/decisions/DEC-172-monotonic-cutover-readiness-evidence.md',
  cutover: 'docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md', scope: 'config/31-q-end-to-end-security-evidence-aggregator-scope.json',
  plan: 'config/work-segmentation-plan.json', governance: 'config/active-governance-ledger.json', authority: 'artifacts/authority/31-Q_END_TO_END_SECURITY_EVIDENCE_AGGREGATOR_AUTHORITY.json',
  audit: 'docs/audit/31-Q_END_TO_END_SECURITY_EVIDENCE_AGGREGATOR.md'
};
const documents = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const checks = []; const failures = [];
const check = (condition, name) => { checks.push({ name, status: condition ? 'PASS' : 'FAIL' }); if (!condition) failures.push(name); };
const has = (key, markers) => { for (const marker of markers) check(documents[key].includes(marker), `${key} contains ${marker}`); };
has('aggregator', [
  'END_TO_END_SECURITY_CONTROLS', 'EndToEndSecurityObservation', 'EndToEndSecurityAggregationStatus', 'EndToEndSecurityEvidenceCandidate',
  'EndToEndSecurityAggregationError', 'EndToEndSecurityEvidenceAggregator', "'OBSERVATION_MALFORMED'", "'CONTROL_INVALID'", "'OBSERVATION_DUPLICATE'",
  "'EVIDENCE_INVALID'", "'EVIDENCE_REUSED'", "'EVIDENCE_UNBOUND'", "'AGGREGATION_INCOMPLETE'",
  "evidenceClass: 'synthetic-end-to-end-security-aggregation-non-authoritative'", "modeledGate: 'END_TO_END_SECURITY_VALIDATION'",
  'syntheticOnly: true', 'realSecurityExercisesPerformed: false', 'independentProcessEvidenceVerified: false', 'realDataAccessed: false',
  'automaticActivationAllowed: false', 'productionGateSatisfied: false', 'productionSubmissionAllowed: false', 'cutoverAuthorityAttached: false',
  'hasExactKeys', 'value.verifierBound !== true', 'this.#seenEvidenceDigests.has(value.evidenceDigest)', 'this.#observations.has(controlId)',
  "['PPT-SYNTHETIC-E2E-SECURITY-AGGREGATION-V1', canonical]"
]);
for (const control of ['LOCAL_ADMIN_AUTHENTICATION', 'PROTOCOL_DEFAULT_DENY', 'REPLAY_REJECTION', 'JOURNAL_TAMPER_REJECTION', 'SECRET_REDACTION', 'PERSISTENT_PATH_REDACTION', 'SHUTDOWN_SEALING']) check(documents.aggregator.includes(`'${control}'`), `aggregator contains control ${control}`);
for (const forbidden of ['node:fs', 'node:sqlite', 'better-sqlite', 'electron', 'node:net', 'node:http', 'child_process', 'process.env', 'setTimeout', 'databasePath', 'authenticationToken', 'password', 'privateKey', 'safeStorage', 'DPAPI', 'Google Drive', 'console.log', 'console.error', 'C:\\', 'D:\\', 'G:\\']) check(!documents.aggregator.includes(forbidden), `aggregator excludes ${forbidden}`);
has('tests', ['starts immutable, pending, synthetic, and without activation authority', 'accepts every exact verifier-bound PASS and emits only a non-submittable modeled candidate', 'locks a failed observation and rejects replacement without mutation', 'rejects unknown controls, invalid outcomes, and extra fields without mutation', 'rejects unbound observations before mutation', 'rejects malformed and genesis evidence digests before mutation', 'rejects evidence digest reuse across distinct controls', 'uses canonical control order so candidate digest is insertion-order independent']);
check(documents.index.includes("export * from './end-to-end-security-evidence-aggregator.js'"), 'Core Service exports the aggregator boundary');
check(!documents.runtime.includes('EndToEndSecurityEvidenceAggregator'), 'Core Service runtime does not attach the aggregator');
check(!documents.ledgerSource.includes('end-to-end-security-evidence-aggregator'), 'readiness ledger does not attach the aggregator');
check(!documents.contracts.includes('end-to-end-security-evidence') && !documents.contracts.includes('EndToEndSecurityEvidenceAggregator'), 'local administration contract exposes no synthetic aggregator method');
has('decision', ['pure synthetic end-to-end security evidence aggregator', 'exactly seven canonical controls', 'exact `controlId`, `outcome`, `evidenceDigest`, and `verifierBound` key set', '`verifierBound` must be true', 'globally unique across all controls', 'monotonic and non-replaceable', 'all seven controls have immutable PASS observations', 'independent of insertion order', 'does not run any security exercise', 'does not expose production-like `gateId`', '`modeledGate: END_TO_END_SECURITY_VALIDATION`', '`productionSubmissionAllowed: false`', 'does not attach it to family-data runtime', 'No production readiness gate is marked PASS']);
has('predecessor', ['Status: ACTIVE', 'Desktop remains the only modeled writer', 'does not attach it to family-data runtime']);
has('readiness', ['Status: ACTIVE', 'trusted evidence verifier', 'DEC-171 is not replaced or weakened']);
has('cutover', ['Status: ACTIVE', 'No API in 31-J can enable cutover']);
has('audit', ['synthetic', 'Real security exercises', 'DEC-171 remains active and blocked']);
const scope = JSON.parse(documents.scope); const plan = JSON.parse(documents.plan); const governance = JSON.parse(documents.governance); const authority = JSON.parse(documents.authority);
check(scope.step === '31-Q' && scope.decision === 'DEC-178' && scope.predecessorDecision === 'DEC-177', 'scope identity and predecessor');
check(scope.targets.aggregator === 'PURE_SYNTHETIC_END_TO_END_SECURITY_AGGREGATOR_ONLY', 'scope selects pure synthetic aggregator');
check(scope.targets.controlSet === 'EXACT_SEVEN_CANONICAL_CONTROLS' && scope.targets.observationShape === 'EXACT_KEYS_ONLY_EXTRA_FIELDS_REJECTED', 'scope fixes controls and observation shape');
check(scope.targets.verifierBinding === 'TRUE_REQUIRED_UNBOUND_REJECTED' && scope.targets.digestRule === 'LOWERCASE_SHA256_NON_GENESIS_GLOBALLY_UNIQUE', 'scope binds verifier and unique digest');
check(scope.targets.monotonicity === 'ONE_OBSERVATION_PER_CONTROL_NO_REPLACEMENT' && scope.targets.completionRule === 'ALL_SEVEN_CONTROLS_PASS_REQUIRED', 'scope requires monotonic all-pass controls');
check(scope.targets.canonicalization === 'FIXED_CONTROL_ORDER_INSERTION_INDEPENDENT', 'scope fixes canonical ordering');
check(scope.targets.candidateClassification === 'MODELED_GATE_ONLY_NO_GATE_ID_NON_SUBMITTABLE', 'scope forbids production submission');
check(scope.targets.realSecurityExercises === 'NOT_PERFORMED' && scope.targets.independentProcessEvidence === 'NOT_VERIFIED', 'scope excludes real exercises and process proof');
check(scope.targets.runtimeIntegration === 'NOT_WIRED' && scope.targets.realEndToEndSecurityGate === 'NOT_SATISFIED' && scope.targets.automaticActivation === 'NOT_ALLOWED', 'scope excludes runtime, real gate, and activation');
check(Object.values(scope.openBoundaries).filter((value) => value === 'NOT_PERFORMED_NOT_PROVEN').length === 7, 'all seven real control exercises remain unproven');
check(scope.requirementCompletionClaimed === false && scope.newBuildIssued === false, 'scope makes no requirement or Build claim');
check(authority.status === 'PASS' && authority.authority === 'EXPLICIT_USER_CONTINUATION_APPLY_31_Q', 'authority binds explicit user instruction');
check(authority.authoritativeSourceAtStart.treeSha256 === '269a8d6e93a8e9fcaeaa70c1d8d32cc00feafcbcc37ba1afd7d9478f7629803d', 'authority binds exact 31-P source');
check(authority.preparedPackage.inventorySha256 === '1308211b9cede28f953b82767b5b0717d9b33c1e0870a3f3114950578cdc76f2', 'authority binds prepared inventory');
check(authority.preparedPackage.validationSha256 === '8ef33ca4e86c9d34f3a95e6e9ad9e239d55c74c53626019acf6c37b64c8bad6f', 'authority binds prepared validation');
const step = plan.steps.find((item) => item.id === '31-Q');
const active = plan.currentStep === '31-Q' && step?.status === 'IN_PROGRESS' && governance.activeMicroStep === '31-Q' && String(governance.libraryUploadStatus).startsWith('31-Q_');
const complete = plan.currentStep === '31-Q' && step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS' && governance.activeMicroStep === null && governance.libraryUploadStatus === '31-Q_COMPLETED_RECEIPT_PASS';
const later = inspectAuthorizedSuccessorLifecycle({ plan, ledger: governance, predecessorId: '31-Q' });
check(active || complete || (later.planValid && later.ledgerValid && later.nextTaskValid), '31-Q has an active, completed, or authorized-successor lifecycle');
const report = { schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '31-Q', phase: 'END_TO_END_SECURITY_EVIDENCE_AGGREGATOR_CONTRACT', status: failures.length ? 'FAIL' : 'PASS', expected: checks.length, executed: checks.length, passed: checks.length - failures.length, failed: failures.length, checks, failures, generatedAt: new Date().toISOString(), mandatoryTruthSentence: 'Bu PASS yalnız sentetik ve gönderilemez birleştiriciye aittir; gerçek güvenlik tatbikatı, bağımsız süreç kanıtı, END_TO_END_SECURITY_VALIDATION veya cutover PASS değildir.' };
if (!successorRegression) { await mkdir('artifacts/validation', { recursive: true }); await writeFile('artifacts/validation/31-Q_END_TO_END_SECURITY_EVIDENCE_AGGREGATOR_CONTRACT.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8'); }
if (failures.length) { console.error(`31-Q contract: FAIL (${failures.length}/${checks.length}).`); for (const failure of failures) console.error(`- ${failure}`); process.exit(1); }
console.log(`31-Q contract: PASS (${checks.length}/${checks.length}).`);
