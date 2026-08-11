import { mkdir, readFile, writeFile } from 'node:fs/promises';

const successorRegression = process.argv.includes('--successor-regression');

const paths = {
  contracts: 'packages/core-service-contracts/src/index.ts', client: 'packages/core-service-client/src/local-admin-client.ts',
  guard: 'apps/core-service/src/family-data-cutover-guard.ts', ledger: 'apps/core-service/src/family-data-cutover-readiness-ledger.ts',
  runtime: 'apps/core-service/src/core-service-runtime.ts', dispatcher: 'apps/core-service/src/core-service-method-dispatcher.ts', index: 'apps/core-service/src/index.ts',
  ledgerTests: 'apps/core-service/tests/family-data-cutover-readiness-ledger.test.ts', dispatcherTests: 'apps/core-service/tests/core-service-method-dispatcher.test.ts',
  desktopTests: 'apps/desktop/tests/core-service-cutover-readiness-validation.test.ts',
  adapter: 'apps/desktop/src/main/core-service-application-adapter.ts', startup: 'apps/desktop/src/main/core-service-startup-connection.ts',
  decision: 'docs/decisions/DEC-172-monotonic-cutover-readiness-evidence.md', predecessor: 'docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md',
  scope: 'config/31-k-monotonic-cutover-readiness-evidence-scope.json'
};
const documents = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const failures = []; const checks = []; const check = (condition, name) => { checks.push({ name, status: condition ? 'PASS' : 'FAIL' }); if (!condition) failures.push(name); };
const has = (key, markers) => { for (const marker of markers) check(documents[key].includes(marker), `${key} contains ${marker}`); };

has('contracts', ['CoreServiceFamilyDataCutoverReadinessStatusContract','CoreServiceFamilyDataCutoverReadinessEntryContract','CORE_SERVICE_CUTOVER_READINESS_GENESIS_HASH','canonicalizeCoreServiceCutoverReadinessEntry',"'family-data-cutover-readiness.status'","decision: 'blocked'","cutoverAuthorityAttached: false","automaticActivationAllowed: false","persistentPathExposed: false","secretMaterialExposed: false"]);
has('ledger', ['EVIDENCE_VERIFIER_UNAVAILABLE','EVIDENCE_REJECTED','EPOCH_INVALID','STATE_REGRESSION','JOURNAL_TAMPERED','TRUSTED_ANCHOR_REQUIRED','claim.epoch !== expectedEpoch','this.#entries.some((entry) => entry.gateId === claim.gateId)','this.#verifier.verify','hashEntry(unsigned)','candidate.previousHash !== previousHash','hashEntry(unsigned) !== candidate.entryHash','anchor.headHash !== expectedHead',"decision: 'blocked'","all-gates-pass-cutover-still-blocked",'SEPARATE_VERSIONED_USER_DECISION_REQUIRED','hasExactKeys(candidate, ENTRY_KEYS)']);
for (const forbidden of ['node:fs','node:sqlite','databasePath','authenticationToken','password','Google Drive','console.log','console.error']) check(!documents.ledger.includes(forbidden), `ledger excludes ${forbidden}`);
has('runtime', ['familyDataCutoverReadiness?: CoreServiceFamilyDataCutoverReadinessLedger','new CoreServiceFamilyDataCutoverReadinessLedger({ clock: this.#clock })','familyDataCutoverReadinessStatus()','return this.#familyDataCutoverReadiness.status()']);
has('dispatcher', ["typedMethod === 'family-data-cutover-readiness.status'",'this.#runtime.familyDataCutoverReadinessStatus()','Family-data cutover readiness status request payload must be empty']);
has('client', ['familyDataCutoverReadinessStatus()',"this.request('family-data-cutover-readiness.status', {})"]);
has('adapter', ['getFamilyDataCutoverReadinessStatus()','this.#client.familyDataCutoverReadinessStatus()']);
has('startup', ['isSafeCoreServiceCutoverReadinessStatus','adapter.getFamilyDataCutoverReadinessStatus()','canonicalizeCoreServiceCutoverReadinessEntry','entry.epoch !== index + 1','accepted.has(entry.gateId)','entry.previousHash !== previousHash','entry.entryHash !== expectedHash','status.headHash !== previousHash','status.cutoverAuthorityAttached !== false','status.automaticActivationAllowed !== false','status.persistentPathExposed !== false','status.secretMaterialExposed !== false','status.allRequiredGatesPass === allRequiredGatesPass',"'ARCHITECTURE_MISMATCH'"]);
has('ledgerTests', ['cannot accept a fake PASS','epoch regression','journal deletion','missing anchors','all five independent gates pass','decision: \'blocked\'','SEPARATE_VERSIONED_USER_DECISION_REQUIRED','must-never-reach-status']);
has('dispatcherTests', ["'family-data-cutover-readiness.status'",'pass: true']);
has('desktopTests', ['accepts exact empty and complete chains','rejects deleted records','rejects authority','databasePath: \'forbidden\'']);
has('decision', ['DEC-171 is not replaced or weakened','trusted evidence verifier','separately trusted anchor','decision remains `blocked`','No real family data']);
has('predecessor', ['Status: ACTIVE','No API in 31-J can enable cutover']);
const scope = JSON.parse(documents.scope);
check(scope.step === '31-K' && scope.decision === 'DEC-172' && scope.predecessorDecision === 'DEC-171', 'scope identity and predecessor');
check(scope.requiredGates.length === 5 && new Set(scope.requiredGates).size === 5, 'five independent gates are exact and unique');
check(scope.acceptanceRules.epochAdvance === 'EXACTLY_ONE' && scope.acceptanceRules.completedGateReplacement === 'REJECT', 'monotonic transition rules');
check(scope.acceptanceRules.evidenceDeletion === 'REJECT_BY_TRUSTED_ANCHOR' && scope.acceptanceRules.evidenceMutation === 'REJECT_BY_HASH_CHAIN', 'deletion and mutation rules');
check(scope.acceptanceRules.allGatesPassEffect === 'CUTOVER_STILL_BLOCKED_SEPARATE_VERSIONED_DECISION_REQUIRED', 'all gates cannot activate cutover');
check(scope.openBoundaries.realVaultTransfer === 'NOT_PERFORMED_BLOCKED' && scope.openBoundaries.sqliteOwnershipTransfer === 'NOT_PERFORMED_BLOCKED', 'real data and SQLite transfer blocked');
check(scope.openBoundaries.productionEvidenceSigner === 'NOT_ATTACHED_DEFAULT_DENY' && scope.openBoundaries.durableReadinessJournal === 'NOT_ATTACHED_IN_MEMORY_CONTROL_PLANE_ONLY', 'unimplemented production boundaries are explicit');
check(scope.requirementCompletionClaimed === false && scope.newBuildIssued === false, 'no false completion or Build claim');
check(documents.guard.includes("decision: 'blocked'") && documents.guard.includes('assertSessionAttachmentAllowed(): never'), '31-J composition cutover guard remains blocked');
check(!documents.contracts.includes("'family-data-cutover-readiness.append'"), 'local administration exposes no readiness mutation method');
check(documents.index.includes("export * from './family-data-cutover-readiness-ledger.js'"), 'Core Service exports readiness ledger boundary');

const report = { schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '31-K', phase: 'MONOTONIC_CUTOVER_READINESS_EVIDENCE_CONTRACT', status: failures.length ? 'FAIL' : 'PASS', expected: checks.length, executed: checks.length, passed: checks.length - failures.length, failed: failures.length, checks, failures, generatedAt: new Date().toISOString(), mandatoryTruthSentence: 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.' };
if (!successorRegression) {
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/31-K_MONOTONIC_CUTOVER_READINESS_EVIDENCE_CONTRACT.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failures.length) { console.error(`31-K contract: FAIL (${failures.length}/${checks.length}).`); for (const failure of failures) console.error(`- ${failure}`); process.exit(1); }
console.log(`31-K contract: PASS (${checks.length}/${checks.length}).`);
