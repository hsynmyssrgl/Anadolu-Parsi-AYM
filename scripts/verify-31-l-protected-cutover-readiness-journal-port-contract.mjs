import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const successorRegression = process.argv.includes('--successor-regression');
const paths = {
  port: 'apps/core-service/src/protected-cutover-readiness-journal-port.ts',
  tests: 'apps/core-service/tests/protected-cutover-readiness-journal-port.test.ts',
  index: 'apps/core-service/src/index.ts',
  ledger: 'apps/core-service/src/family-data-cutover-readiness-ledger.ts',
  runtime: 'apps/core-service/src/core-service-runtime.ts',
  contracts: 'packages/core-service-contracts/src/index.ts',
  decision: 'docs/decisions/DEC-173-protected-cutover-readiness-journal-port.md',
  predecessor: 'docs/decisions/DEC-172-monotonic-cutover-readiness-evidence.md',
  cutover: 'docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md',
  scope: 'config/31-l-protected-cutover-readiness-journal-port-scope.json',
  plan: 'config/work-segmentation-plan.json',
  governance: 'config/active-governance-ledger.json',
  authority: 'artifacts/authority/31-L_PROTECTED_READINESS_JOURNAL_PORT_AUTHORITY.json',
  audit: 'docs/audit/31-L_PROTECTED_CUTOVER_READINESS_JOURNAL_PORT.md'
};
const documents = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const failures = [];
const checks = [];
const check = (condition, name) => {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL' });
  if (!condition) failures.push(name);
};
const has = (key, markers) => {
  for (const marker of markers) check(documents[key].includes(marker), `${key} contains ${marker}`);
};

has('port', [
  'ProtectedCutoverReadinessAnchor',
  'ProtectedCutoverReadinessSnapshot',
  'ProtectedCutoverReadinessCommit',
  'ProtectedCutoverReadinessJournalPort',
  'ProtectedCutoverReadinessJournalError',
  "'JOURNAL_UNAVAILABLE'",
  "'ANCHOR_MISMATCH'",
  "'JOURNAL_INVALID'",
  'readonly schemaVersion: 1',
  'readonly epoch: number',
  'readonly entryCount: number',
  'readonly headHash: string',
  'load(): Promise<ProtectedCutoverReadinessSnapshot | null>',
  'compareAndSwap(commit: ProtectedCutoverReadinessCommit): Promise<void>',
  'seal(): Promise<void>',
  'DetachedProtectedCutoverReadinessJournal',
  'public readonly protectionId = null',
  'public readonly available = false',
  'public async load(): Promise<never>',
  'public async compareAndSwap(_commit: ProtectedCutoverReadinessCommit): Promise<never>',
  'public async seal(): Promise<never>',
  'throw unavailable()'
]);
for (const forbidden of [
  'node:fs', 'node:sqlite', 'better-sqlite', 'electron', 'process.env', 'databasePath', 'authenticationToken',
  'password', 'privateKey', 'Google Drive', 'console.log', 'console.error', 'C:\\', 'D:\\', 'G:\\'
]) check(!documents.port.includes(forbidden), `port excludes ${forbidden}`);
check(!documents.port.includes('return null'), 'detached load cannot return an empty success');
check(!documents.port.includes('return undefined'), 'detached seal cannot return a false success');
has('tests', [
  'satisfies the persistence port',
  'unavailability cannot masquerade as an empty journal',
  'rejects compare-and-swap without mutating',
  'detached persistence cannot report a false successful seal',
  "code: 'JOURNAL_UNAVAILABLE'",
  'protectionId: null',
  'available: false'
]);
check(documents.index.includes("export * from './protected-cutover-readiness-journal-port.js'"), 'Core Service exports the protected journal boundary');
check(!documents.ledger.includes('protected-cutover-readiness-journal-port'), 'readiness ledger does not attach the persistence port');
check(!documents.runtime.includes('ProtectedCutoverReadinessJournal'), 'Core Service runtime does not attach the persistence port');
check(documents.runtime.includes('new CoreServiceFamilyDataCutoverReadinessLedger({ clock: this.#clock })'), 'runtime retains the detached in-memory readiness composition');
check(!documents.contracts.includes("'family-data-cutover-readiness.append'"), 'local administration exposes no readiness mutation method');
check(!documents.contracts.includes('journalPath') && !documents.contracts.includes('protectionId'), 'local administration exposes no journal path or protection identity');
has('decision', [
  'The production composition remains detached',
  '`available` value is false',
  '`protectionId` is null',
  'every operational method rejects with `JOURNAL_UNAVAILABLE`',
  'does not wire it into the readiness ledger or Core Service runtime',
  'DEC-171 and DEC-172 are not replaced or weakened',
  'No requirement is declared COMPLETE'
]);
has('predecessor', ['Status: ACTIVE', 'durable protected readiness journal are not attached', 'DEC-171 is not replaced or weakened']);
has('cutover', ['Status: ACTIVE', 'No API in 31-J can enable cutover']);
has('audit', ['default-deny composition', 'No durable adapter', 'DEC-171 remains active']);

const scope = JSON.parse(documents.scope);
const plan = JSON.parse(documents.plan);
const governance = JSON.parse(documents.governance);
const authority = JSON.parse(documents.authority);
check(scope.step === '31-L' && scope.decision === 'DEC-173' && scope.predecessorDecision === 'DEC-172' && scope.cutoverDecision === 'DEC-171', 'scope identity and decisions');
check(scope.targets.journalPort === 'ASYNC_LOAD_COMPARE_AND_SWAP_SEAL_BOUNDARY', 'scope selects the exact port boundary');
check(scope.targets.defaultComposition === 'DETACHED_UNAVAILABLE_FAIL_CLOSED', 'scope requires detached default deny');
check(scope.targets.unavailableLoad === 'REJECT_JOURNAL_UNAVAILABLE_NOT_EMPTY_SUCCESS', 'scope forbids false empty load success');
check(scope.targets.productionAdapter === 'NOT_ATTACHED' && scope.targets.runtimeIntegration === 'NOT_WIRED', 'scope excludes adapter and runtime wiring');
check(scope.openBoundaries.realVaultTransfer === 'NOT_PERFORMED_BLOCKED' && scope.openBoundaries.sqliteOwnershipTransfer === 'NOT_PERFORMED_BLOCKED', 'real data and SQLite transfer remain blocked');
check(scope.openBoundaries.durableReadinessJournal === 'PORT_ONLY_NO_PRODUCTION_ADAPTER' && scope.openBoundaries.crashConsistency === 'NOT_PROVEN', 'durability and crash consistency remain open');
check(scope.requirementCompletionClaimed === false && scope.newBuildIssued === false, 'scope makes no requirement or Build claim');
check(authority.status === 'PASS' && authority.authority === 'EXPLICIT_USER_CONTINUATION_APPLY_31_L' && authority.reviewedStaging.treeSha256 === '942d11a1b2e18cd0fa58dfb8d3897d62756153b7c45ad4870019705990a13127', 'authority binds explicit user continuation and reviewed staging');
const step = plan.steps.find((item) => item.id === '31-L');
const active = plan.currentStep === '31-L' && step?.status === 'IN_PROGRESS' && governance.activeMicroStep === '31-L' && String(governance.libraryUploadStatus).startsWith('31-L_');
const complete = plan.currentStep === '31-L' && step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS' && governance.activeMicroStep === null && governance.libraryUploadStatus === '31-L_COMPLETED_RECEIPT_PASS';
const later = inspectAuthorizedSuccessorLifecycle({ plan, ledger: governance, predecessorId: '31-L' });
check(active || complete || (later.planValid && later.ledgerValid && later.nextTaskValid), '31-L has an active, completed, or authorized-successor lifecycle');

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '31-L',
  phase: 'PROTECTED_CUTOVER_READINESS_JOURNAL_PORT_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS',
  expected: checks.length,
  executed: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  failures,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: 'Bu PASS yalnız port ve detached varsayılan-ret sınırına aittir; üretim adaptörü, kalıcılık veya cutover PASS değildir.'
};
if (!successorRegression) {
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/31-L_PROTECTED_CUTOVER_READINESS_JOURNAL_PORT_CONTRACT.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failures.length) {
  console.error(`31-L contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`31-L contract: PASS (${checks.length}/${checks.length}).`);
