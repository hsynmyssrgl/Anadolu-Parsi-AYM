import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const REPORT_PATH = 'artifacts/validation/30-T-archive-operation-idempotency-contract.json';
const paths = {
  authority: 'artifacts/authority/30-T_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  selection: 'artifacts/validation/30-T_PRIORITY_SELECTION_VALIDATION.json',
  scope: 'config/30-t-new-correlation-operation-idempotency-scope.json',
  decision: 'docs/decisions/DEC-145-ppk-002-new-correlation-operation-idempotency.md',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  repositoryContract: 'packages/repository-contracts/src/platform-policy-transaction-repository.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  repository: 'packages/repositories/src/platform-policy-transaction-repository.ts',
  application: 'packages/application/src/archive-use-cases.ts',
  adapter: 'apps/desktop/src/main/archive-application-adapter.ts',
  productionRuntime: 'apps/desktop/src/main/archive-production-policy-runtime.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  vault: 'apps/desktop/src/main/archive-vault-file-application-adapter.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  main: 'apps/desktop/src/main/main.ts',
  focusedTest: 'apps/desktop/tests/archive-operation-idempotency-runtime.test.ts',
  runtimeVerifier: 'scripts/verify-30-t-archive-operation-idempotency-runtime.mjs',
  packageJson: 'package.json',
  firstFailure: 'artifacts/validation/30-T_RUNTIME_VALIDATION_FIRST_ATTEMPT_FAILURE.json',
  secondFailure: 'artifacts/validation/30-T_RUNTIME_VALIDATION_SECOND_ATTEMPT_FAILURE.json',
  dependencyFailure: 'artifacts/validation/30-T_DEPENDENCY_CONTRACT_DIAGNOSTIC_FAILURE.json',
  predecessorCompletion: 'artifacts/checkpoints/30-S_COMPLETION_RECORD.json',
  predecessorReceipt: 'artifacts/checkpoints/30-S_LIBRARY_RECEIPT.json',
  predecessorReadback: 'artifacts/validation/30-S_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json'
};

const source = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [
  key,
  await readFile(path, 'utf8')
])));
const json = (key) => JSON.parse(source[key]);
const checks = [];
const failures = [];
const check = (condition, name, details = undefined) => {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL', ...(details === undefined ? {} : { details }) });
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
const selection = json('selection');
const scope = json('scope');
const plan = json('plan');
const ledger = json('ledger');
const registry = json('registry');
const packageJson = json('packageJson');
const predecessorCompletion = json('predecessorCompletion');
const predecessorReceipt = json('predecessorReceipt');
const predecessorReadback = json('predecessorReadback');

check(authority.step === '30-T' && authority.requirement === 'PPK-002' && authority.status === 'PASS', 'priority authority binds PASS 30-T/PPK-002');
check(authority.selectedPriority === 'P0' && authority.targetedBoundary === 'newCorrelationRetryIdempotencyAfterUnknownCommitOutcome', 'priority authority fixes the selected P0 boundary');
check(authority.predecessor?.step === '30-S' && authority.predecessor?.persistentReceiptStatus === 'PASS', 'priority authority binds the completed persistent predecessor');
check(authority.mandatoryTruthSentence === TRUTH, 'priority authority preserves the truth sentence');
check(selection.status === 'PASS' && selection.semanticPassed === 12 && selection.semanticExpected === 12, 'priority selection is 12/12 semantic PASS');
check(selection.processPassed === 5 && selection.processExpected === 5 && selection.processNotRun === 0, 'priority selection is 5/5 process PASS');

check(scope.step === '30-T' && scope.scope === 'DURABLE_NEW_CORRELATION_OPERATION_IDEMPOTENCY_AFTER_UNKNOWN_COMMIT_OUTCOME', 'scope has the canonical 30-T identity');
check(scope.targets?.length === 6 && new Set(scope.targets.map((target) => target.id)).size === 6, 'scope declares six unique targets');
check(scope.requiredOrder?.join('|') === 'selection-and-scope-lock|migration-and-repository-contract|production-archive-application-integration|renderer-ipc-operation-identity|real-sqlite-runtime-and-regression|security-review', 'scope fixes the six-stage order');
check(scope.evidenceBoundary?.PPK002 === 'PARTIAL', 'scope keeps PPK-002 PARTIAL');
check(scope.evidenceBoundary?.newCorrelationRetryIdempotencyAfterUnknownCommitOutcome === 'TARGETED_NOT_YET_PASS', 'scope does not pre-claim the 30-T target');
check(scope.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', 'scope keeps universal enforcement open');
check(scope.evidenceBoundary?.secureFileDeletionAndDatabaseCommitAtomicity === 'NOT_IMPLEMENTED', 'scope keeps file/database atomicity open');
check(scope.evidenceBoundary?.requirementCompletionClaimed === false, 'scope does not claim requirement completion');
contains('decision', '# DEC-145', 'DEC-145 heading exists');
contains('decision', 'yeni correlation, nonce ve receipt', 'DEC-145 names independent retry credentials');
contains('decision', 'iş mutasyonu, audit, outbox ve bağlı etkinlik artışı yeniden çalıştırılmaz', 'DEC-145 forbids duplicate business effects');
contains('decision', 'PPK-002 `PARTIAL`', 'DEC-145 preserves the requirement boundary');

check(plan.steps.find((step) => step.id === '30-T')?.status === 'COMPLETED', 'work plan preserves completed 30-T history');
check(plan.steps.find((step) => step.id === '30-T')?.persistentReceiptStatus === 'PASS', 'work plan preserves the 30-T persistent receipt');
check(plan.steps.find((step) => step.id === '30-T')?.validationStatus === 'PASS', 'work plan preserves validated 30-T history');
check(plan.steps.find((step) => step.id === '30-S')?.persistentReceiptStatus === 'PASS', 'work plan preserves predecessor receipt PASS');
check(ledger.activeMicroStep !== '30-T' && typeof ledger.nextOfficialTask === 'string', 'active ledger has advanced beyond historical 30-T');
check(ledger.libraryUploadStatus !== '30-T_IN_PROGRESS_PREDECESSOR_30-S_RECEIPT_CHAIN_PASS', 'active ledger no longer presents 30-T as in progress');
check(registry.requirements?.find((item) => item.id === 'PPK-002')?.status === 'COMPLETE', 'accepted scope registry preserves the later PPK-002 top closure');

for (const marker of [
  'PlatformPolicyArchiveOperationIdentityInput',
  'PlatformPolicyArchiveOperationMetadataLookupInput',
  'PlatformPolicyArchiveOperationMetadata',
  'resolveArchiveOperation',
  'recordArchiveOperationResult',
  'findArchiveOperationMetadata'
]) contains('repositoryContract', marker, `repository contract declares ${marker}`);
check(!source.repositoryContract.includes('readonly resultJson: string'), 'repository contract exposes no semantic replay payload');

contains('migration', "createMigrationDefinition(60, 'archive_operation_idempotency'", 'migration 60 is registered');
contains('migration', 'CREATE TABLE platform_policy_archive_operations', 'migration creates the operation ledger');
contains('migration', 'CREATE TABLE platform_policy_archive_operation_retries', 'migration creates immutable retry evidence');
contains('migration', "substr(operation_id,1,1) GLOB '[A-Za-z0-9]'", 'database constrains the first operation-id character');
contains('migration', 'trg_platform_policy_archive_operation_insert', 'operation insert requires an exact receipt');
contains('migration', 'trg_platform_policy_archive_operation_retry_insert', 'retry insert requires an exact new receipt');
contains('migration', 'archive operation idempotency record is immutable', 'operation ledger updates are blocked');
contains('migration', 'archive operation retry evidence is durable', 'retry evidence deletion is blocked');
contains('migration', 'REVISION-30-T-PPK-002-ARCHIVE-OPERATION-IDEMPOTENCY', 'schema generation records 30-T');

contains('repository', 'const OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u', 'repository validates operation identifiers');
contains('repository', `const ARCHIVE_OPERATION_COMPLETION_JSON = '{"status":"completed"}'`, 'repository writes a fixed content-free completion envelope');
contains('repository', 'ARCHIVE_OPERATION_METADATA_SELECT', 'repository exposes only typed content-free metadata');
check(!source.repository.includes('SELECT operation.*'), 'repository has no full-row operation read');
check(!source.repository.includes('public findArchiveOperation('), 'repository has no generic full-result finder');
contains('repository', 'Archive operation identifier was reused with a different semantic mutation', 'repository fails closed on semantic reuse');
inOrder('repository', [
  'public resolveArchiveOperation(',
  'assertArchiveOperationResultAccessReceipt(context, currentReceiptRow)',
  'INSERT INTO platform_policy_archive_operation_retries',
  "state: 'conflict'"
], 'repository binds the current receipt and durably records retry evidence before content-free conflict');
inOrder('repository', [
  'public recordArchiveOperationResult(',
  'INSERT INTO platform_policy_archive_operations',
  'ARCHIVE_OPERATION_COMPLETION_JSON',
  'input.resultHash'
], 'repository persists only fixed completion status and one-way result hash');

contains('application', 'readonly operationId?:string', 'archive application context carries operation identity');
contains('application', 'readonly operationFingerprint?:string', 'archive application context carries operation fingerprint');
contains('adapter', 'requiresDurableOperationIdempotency?: true', 'adapter exposes the production idempotency marker');
inOrder('adapter', [
  'establishGovernedTransaction(enforcementPoint, governedInput)',
  'resolveAuthorizedOperation?.(governedInput)',
  "resolution.value.state === 'conflict'",
  'operation(new GovernedArchiveWriteScope',
  'recordAuthorizedOperationResult?.({'
], 'unit of work resolves committed conflict before business mutation and records content-free completion afterward');
contains('adapter', "semanticReplay: 'forbidden'", 'adapter returns a fail-closed reload-required conflict instead of semantic replay');
check(!source.adapter.includes('deserializeArchiveOperationResult'), 'adapter cannot deserialize a committed semantic result');

contains('productionRuntime', 'findMatchingCommittedCreateOperation', 'production resource resolver recognizes an exact completed create retry');
contains('productionRuntime', 'resolveAuthorizedProductionOperation', 'production runtime resolves a durable operation');
contains('productionRuntime', 'recordAuthorizedProductionOperationResult', 'production runtime records a durable successful result');
contains('productionRuntime', 'requiresDurableOperationIdempotency: true', 'production resolver requires the idempotency boundary');

contains('dataStore', '#archiveMutationContext(', 'DataStore derives mutation context independently from correlation');
contains('dataStore', 'deterministicArchiveIdentifier', 'DataStore derives deterministic business identifiers');
contains('dataStore', '#assertArchiveOperationIdentity(', 'DataStore checks committed identity before file side effects');
contains('dataStore', 'stored.value.createdNewFile && safeToRemoveNewFile', 'DataStore only removes a proven new uncommitted file');
contains('vault', "flag: 'wx'", 'vault storage uses exclusive creation');
contains('vault', 'existingSha256 !== metadata.sha256', 'vault retry compares existing plaintext content');
contains('vault', 'createdNewFile: false', 'vault reports a reused file distinctly');

contains('preload', 'archiveMutationRetries', 'preload retains retry state');
contains('preload', 'invokeArchiveMutation', 'preload centralizes archive mutation invocation');
contains('preload', 'if (state?.inflight) return state.inflight', 'preload coalesces concurrent identical mutations');
contains('preload', 'delete state.inflight', 'preload preserves the operation id after an unknown failure');
contains('main', 'ArchiveItemMutationInput', 'main IPC receives stable operation identity for primitive archive calls');
contains('main', 'openArchiveInSecurePreview(input.itemId, input.operationId)', 'main passes the operation id through secure preview');

check((source.focusedTest.match(/\bit\(/gu) ?? []).length === 5, 'focused runtime declares five 30-T tests');
for (const marker of [
  'content-free committed conflict under a new receipt',
  'real SQLite close and restart',
  'semantic identity reuse',
  'exact current receipt was not persisted',
  'content-idempotent for a stable item identifier',
  'BUSINESS_MUTATION_MUST_NOT_RUN_ON_CONFLICT'
]) contains('focusedTest', marker, `focused runtime covers ${marker}`);
contains('focusedTest', 'platform_policy_archive_operation_retries', 'focused runtime verifies durable retry evidence');
contains('focusedTest', 'toThrow(/immutable/u)', 'focused runtime verifies immutable ledgers');

for (const key of ['firstFailure', 'secondFailure']) {
  const failure = json(key);
  check(failure.status === 'FAIL' && failure.processExitCode === 1 && failure.passClaim === false, `${key} remains preserved FAIL and NOT_PASS`);
}
const dependencyFailure = json('dependencyFailure');
check(dependencyFailure.status === 'DIAGNOSTIC_FAIL' && dependencyFailure.passClaim === false, 'dependency diagnostic failures remain NOT_PASS');
check(predecessorCompletion.step === '30-S' && predecessorCompletion.officialStepStatus === 'COMPLETED', 'predecessor completion remains completed');
check(predecessorReceipt.status === 'PASS' && predecessorReadback.status === 'PASS', 'predecessor receipt and persistence readback remain PASS');
check(sha256(source.predecessorReceipt).length === 64 && sha256(source.predecessorReadback).length === 64, 'predecessor evidence has deterministic SHA-256 identities');
check(packageJson.scripts?.['verify:30-t:archive-operation-idempotency-contract'] === 'node scripts/verify-30-t-archive-operation-idempotency-contract.mjs', 'package exposes the 30-T contract gate');
check(packageJson.scripts?.['verify:30-t:archive-operation-idempotency-runtime'] === 'node scripts/verify-30-t-archive-operation-idempotency-runtime.mjs', 'package exposes the 30-T runtime gate');
contains('runtimeVerifier', 'archive-operation-idempotency-runtime.test.ts', 'runtime verifier invokes the focused 30-T test');

const status = failures.length === 0 ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-T',
  requirement: 'PPK-002',
  phase: 'ARCHIVE_OPERATION_IDEMPOTENCY_CONTRACT',
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
  console.error(`30-T archive operation idempotency contract: FAIL (${failures.length}/${checks.length}).`);
  console.error(failures.join('\n'));
  console.error(TRUTH);
  process.exit(1);
}
console.log(`30-T archive operation idempotency contract: PASS (${checks.length}/${checks.length}; PPK-002 remains PARTIAL).`);
console.log(TRUTH);
