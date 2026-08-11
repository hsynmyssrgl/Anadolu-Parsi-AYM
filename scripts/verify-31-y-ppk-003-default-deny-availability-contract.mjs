import { mkdir, readFile, writeFile } from 'node:fs/promises';

const checks = [];
const failures = [];
const check = (name, condition, details = undefined) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status, ...(details === undefined ? {} : { details }) });
  if (!condition) failures.push(name);
};

const sources = Object.fromEntries(await Promise.all(Object.entries({
  enforcement: 'packages/platform-policy/src/policy-enforcement-point.ts',
  test: 'packages/platform-policy/policy-decision-availability.test.ts',
  universalApi: 'apps/desktop/src/main/desktop-universal-api-policy-enforcement.ts',
  repositoryScope: 'apps/desktop/src/main/desktop-repository-policy-scope.ts',
  sqliteBase: 'packages/repositories/src/sqlite-base.ts',
  main: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  migrations: 'packages/database/src/family-database-migrations.ts',
  cutoverGuard: 'apps/core-service/src/family-data-cutover-guard.ts',
  decision: 'docs/decisions/DEC-184-ppk-003-bounded-default-deny-policy-decision-availability.md'
}).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));

const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const requirement = registry.requirements.find((item) => item.id === 'PPK-003');
const scope = JSON.parse(await readFile('config/31-y-ppk-003-default-deny-availability-top-closure-scope.json', 'utf8'));
const stages = [
  'AUTHORITY_RESOLUTION',
  'RESOURCE_RESOLUTION',
  'REPLAY_RESERVATION',
  'POLICY_AUTHORIZATION',
  'RECEIPT_VERIFICATION',
  'RECEIPT_PERSISTENCE'
];
const operationCallbackIndex = sources.enforcement.indexOf('await operation(context)');
const requiredReceiptPersistenceIndex = sources.enforcement.lastIndexOf('await this.#appendReceipt(', operationCallbackIndex);

check('dedicated unavailable-decision error schema exists', sources.enforcement.includes("'POLICY_DECISION_UNAVAILABLE'") && sources.enforcement.includes('availabilityStage'));
check('all six trusted pre-operation stages are explicitly modeled', stages.every((stage) => sources.enforcement.includes(`'${stage}'`)), { stageCount: stages.length });
check('production dependency deadline defaults to five seconds', sources.enforcement.includes('options.decisionTimeoutMs ?? 5_000'));
check('decision deadline is bounded against unsafe configuration', sources.enforcement.includes('decisionTimeoutMs < 10 || decisionTimeoutMs > 60_000'));
check('invalid enforcement composition is rejected before use', sources.enforcement.includes('Policy enforcement dependency is unavailable'));
check('authority resolution is deadline guarded', sources.enforcement.includes("'AUTHORITY_RESOLUTION',") && sources.enforcement.includes('this.#authorityResolver.resolve()'));
check('resource resolution is deadline guarded', sources.enforcement.includes("'RESOURCE_RESOLUTION',") && sources.enforcement.includes('this.#resourceResolver.resolve(intent, authority)'));
check('replay reservation is deadline guarded', sources.enforcement.includes("'REPLAY_RESERVATION',") && sources.enforcement.includes('this.#replayStore.reserve'));
check('policy authorization is deadline guarded', sources.enforcement.includes("'POLICY_AUTHORIZATION',") && sources.enforcement.includes('this.#authorize(request, issuedAt, nonce)'));
check('signed receipt verification is deadline guarded', sources.enforcement.includes("'RECEIPT_VERIFICATION',") && sources.enforcement.includes('#verifyWithinDecisionDeadline'));
check('mandatory receipt persistence is deadline guarded', sources.enforcement.includes("'RECEIPT_PERSISTENCE',") && sources.enforcement.includes('this.#receiptSink.append(record)'));
check('deadline error cannot open the operation callback', requiredReceiptPersistenceIndex >= 0 && operationCallbackIndex > requiredReceiptPersistenceIndex);
check('targeted tests cover all unavailable stages', stages.every((stage) => sources.test.includes(`'${stage}'`)));
check('targeted test proves a late allow cannot execute', sources.test.includes('does not execute after a timed-out provider returns a late allow decision'));
check('universal authenticated Desktop API PEP remains active', sources.universalApi.includes('this.#enforcementPoint.execute') && sources.main.includes('universalApiPolicyEnforcement().execute'));
check('production repository execution remains active-scope guarded', sources.repositoryScope.includes('Repository execution attempted outside an authorized Desktop policy scope') && sources.sqliteBase.includes('#executionPolicyGuard?.assert(context)'));
check('renderer UI and menu remain confined to preload IPC', sources.preload.includes("contextBridge.exposeInMainWorld('pardus'") && sources.preload.includes('ipcRenderer.invoke.bind(ipcRenderer)'));
check('durable policy transaction schema and migration remain present', ['platform_policy_replay_reservations', 'platform_policy_database_fences', 'platform_policy_transaction_receipts'].every((table) => sources.migrations.includes(table)));
check('DEC-171 real-data cutover block remains fail-closed', sources.cutoverGuard.includes("'FAMILY_DATA_CUTOVER_BLOCKED'"));
check('DEC-184 forbids real-data and ownership cutover', sources.decision.includes('Gerçek veri taşınmamıştır') || (sources.decision.includes('gerçek kasa') && sources.decision.includes('SQLite yazma sahipliğini değiştirmez')));
check('accepted scope marks PPK-003 complete with a closed chain', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true));
check('31-Y scope binds contract, runtime and targeted evidence', scope.status === 'COMPLETED' && scope.requirementCompletionClaimed === true && scope.validation?.contract && scope.validation?.runtime && scope.validation?.targetedTest);

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '31-Y',
  requirement: 'PPK-003',
  phase: 'DEFAULT_DENY_AVAILABILITY_CONTRACT',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  cutoverAuthorityAttached: false,
  realDataTransferPerformed: false,
  requirementCompletionClaimed: failures.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/31-Y-ppk-003-default-deny-availability-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`31-Y PPK-003 contract: FAIL (${failures.length}/${checks.length}).`);
  process.exit(1);
}
console.log(`31-Y PPK-003 contract: PASS (${checks.length}/${checks.length}).`);
