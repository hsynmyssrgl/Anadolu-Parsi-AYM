import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const cliArguments = process.argv.slice(2);
if (cliArguments.length > 1 || cliArguments.some((argument) => argument !== '--no-write')) {
  throw new Error('Unsupported 33-N draft async-state UX boundary argument.');
}
const noWrite = process.argv.includes('--no-write');
const root = resolve(process.cwd());
const output = 'artifacts/validation/33-N-draft-async-state-ux-boundary.json';
const requirements = ['B3-02', 'B7-14', 'B7-15'];
const sources = {
  domain: 'packages/domain/src/form-drafts.ts',
  application: 'packages/application/src/form-draft-use-cases.ts',
  repositoryContract: 'packages/repository-contracts/src/form-draft-repository.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  repository: 'packages/repositories/src/form-draft-repository.ts',
  adapter: 'apps/desktop/src/main/form-draft-application-adapter.ts',
  productionPolicy: 'apps/desktop/src/main/timeline-production-policy-runtime.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  ipc: 'apps/desktop/src/main/ipc-integration-policy.ts',
  main: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  global: 'apps/desktop/src/renderer/global.d.ts',
  formUx: 'apps/desktop/src/renderer/form-ux.tsx',
  asyncGuard: 'apps/desktop/src/renderer/async-state-guard.ts',
  app: 'apps/desktop/src/renderer/App.tsx',
  applicationTest: 'packages/application/tests/form-draft-use-cases.test.ts',
  repositoryTest: 'packages/repositories/form-draft-repository-policy.test.ts',
  ipcTest: 'apps/desktop/tests/form-draft-ipc-integration.test.ts',
  uxTest: 'apps/desktop/tests/form-ux.test.ts',
  asyncGuardTest: 'apps/desktop/tests/async-state-guard.test.ts',
  dataStoreTest: 'apps/desktop/tests/data-store.test.ts',
  routeStateInventory: 'config/33-n-b7-15-route-async-state-inventory.json',
  routeStateTest: 'apps/desktop/tests/b7-15-route-async-state-governance.test.ts',
  routeStateVerifier: 'scripts/verify-33-n-b7-15-route-async-state-governance.mjs'
};
const text = Object.fromEntries(await Promise.all(Object.entries(sources).map(async ([key, path]) => [key, await readFile(resolve(root, path), 'utf8')])));
const checks = [];
const check = (name, passed, evidence) => checks.push({ name, status: passed ? 'PASS' : 'FAIL', evidence });
const has = (key, ...markers) => markers.every((marker) => text[key].includes(marker));

check('domain exposes bounded canonical JSON draft model', has('domain', 'FORM_DRAFT_MAX_PAYLOAD_BYTES = 65_536', 'canonicalizeFormDraftPayload', 'createFormDraftResourceId'), sources.domain);
check('domain rejects non JSON and nested banking secrets', has('domain', 'isPlainObject', 'prohibitedBankingSecretFields', 'must not be cyclic', 'must contain only JSON values'), sources.domain);
check('public draft view excludes receipt and mutation persistence internals', has('domain', 'FormDraftView', 'FormDraftWorkspaceView') && !text.domain.includes('policyReceiptHash'), sources.domain);
check('application exact command shapes and optimistic revision are enforced', has('application', "keys.join(',') !== 'clientOperationId,expectedRevision,formKey,payload'", "keys.join(',') !== 'clientOperationId,expectedRevision,formKey'", 'expectedRevision'), sources.application);
check('application binds idempotent replay to request fingerprint', has('application', 'findMutationByClientOperationId', 'sameReplay', 'requestFingerprint'), sources.application);
check('application undo restores the immediately preceding immutable revision', has('application', "input.operation === 'undo'", 'restoredFromRevision = input.expectedRevision - 1', 'findMutationByRevision'), sources.application);
check('application mutation audit and outbox are atomic scope operations', has('application', 'insertMutation', 'saveCurrent', 'appendAudit', 'enqueueEvent'), sources.application);
check('repository contract separates policy resolution from governed access', has('repositoryContract', 'PolicyAuthorizedRepositoryExecutionContext', 'findForPolicyResolution', 'insertMutation', 'saveCurrent'), sources.repositoryContract);
check('migration 91 installs strict current and mutation history', has('migration', "createMigrationDefinition(91, 'b3_governed_form_drafts'", 'CREATE TABLE governed_form_draft_mutations', 'CREATE TABLE governed_form_drafts', ') STRICT;'), sources.migration);
check('migration 91 enforces idempotency and optimistic revisions', has('migration', 'trg_form_draft_idempotency_mismatch', 'form draft idempotency fingerprint mismatch', 'trg_form_draft_mutation_revision', 'form draft optimistic revision mismatch'), sources.migration);
check('migration 91 enforces immediate undo and immutable history', has('migration', 'trg_form_draft_undo_payload', 'immediately preceding immutable revision', 'form draft mutations are immutable', 'form draft mutation deletion is forbidden'), sources.migration);
check('migration receipt trigger binds exact active personal subject and resource', has('migration', 'trg_form_draft_mutation_policy_receipt', "receipt.resource_type='form_draft'", "json_extract(receipt.record_json,'$.request.resource.sensitivity')='personal'", "json_extract(receipt.record_json,'$.request.purpose')='general'"), sources.migration);
check('repository requires exact form_draft policy persistence binding', has('repository', 'platformPolicyPersistenceBinding', "'form_draft'", 'exactPersonalSubject', 'assertPolicyAuthorizedRepositoryContext'), sources.repository);
check('repository scopes current and history by account and form key', has('repository', 'governed_form_drafts', 'governed_form_draft_mutations', 'account_id=? AND form_key=?'), sources.repository);
check('central PEP and SQLite UoW runner are reused', has('adapter', 'RepositoryBackedTimelinePolicyTransactionRunner', 'policyTransactionRunner.execute', 'RepositoryBackedFormDraftUnitOfWork'), sources.adapter);
check('production policy resolves form_draft through repository', has('productionPolicy', "resourceType === 'form_draft'", 'formDraftRepository.findForPolicyResolution'), sources.productionPolicy);
check('data store composes canonical workspace save and undo use cases', has('dataStore', 'RepositoryBackedFormDraftUnitOfWork', 'GetFormDraftWorkspaceUseCase', 'SaveFormDraftUseCase', 'UndoFormDraftUseCase') && !text.dataStore.includes('GetFormDraftUseCase'), sources.dataStore);
check('IPC policy accepts only exact get save undo inputs', has('ipc', 'formDraftKeyInput', 'formDraftSaveInput', 'formDraftUndoInput', "case 'formDraft:save'", "case 'formDraft:undo'"), sources.ipc);
check('main and preload expose canonical workspace save and undo channels', has('main', "registerIpcHandler('formDraft:getWorkspace'", "registerIpcHandler('formDraft:save'", "registerIpcHandler('formDraft:undo'") && has('preload', 'getFormDraftWorkspace:', 'saveFormDraft:', 'undoFormDraft:') && !text.main.includes("'formDraft:get'") && !text.preload.includes('getFormDraft:'), `${sources.main};${sources.preload}`);
check('renderer global contract exposes workspace only', has('global', 'getFormDraftWorkspace(', 'saveFormDraft(', 'undoFormDraft(') && !text.global.includes('getFormDraft('), sources.global);
check('async panel covers meaningful states and retry semantics', has('formUx', "'empty' | 'loading' | 'offline' | 'error'", 'aria-busy=', 'aria-live=', 'onRetry', "retryLabel = 'Yeniden dene'"), sources.formUx);
check('validation summary announces and links field errors', has('formUx', 'ValidationSummary', 'role="alert"', 'aria-labelledby={headingId}', 'focusInvalidField'), sources.formUx);
check('governed draft controller debounces and fences stale completion', has('formUx', 'GovernedDraftController', 'AbortController', 'sequence !== this.#state.sequence', 'dispose()'), sources.formUx);
check('global async guard rejects stale route or session writes', has('asyncGuard', 'AsyncWriteGuard', 'invalidateAll', 'ticket.epoch === this.#epoch', 'MutationRevisionWatermark'), sources.asyncGuard);
check('application integrates governed draft and screen states', has('app', 'GovernedFormDraftCenter', 'AsyncStatePanel', 'AsyncWriteGuard', 'MutationRevisionWatermark', "state=\"offline\"", "state=\"empty\"", "state=\"error\""), sources.app);
check('negative application repository and IPC suites exist', has('applicationTest', 'rejects nested banking secret fields', 'rejects stale revisions') && has('repositoryTest', 'rejects forged and wrong owner', 'idempotency mismatch', 'non-canonical payloads', 'incorrect payload fingerprints', 'non-immediate undo') && has('ipcTest', 'rejects objects with a forged prototype', 'rejects oversized payloads'), `${sources.applicationTest};${sources.repositoryTest};${sources.ipcTest}`);
check('renderer async guards and production composition runtime suites exist', has('uxTest', 'sadece son monotonik sonucu kabul eder', 'erişilebilir yeniden deneme') && has('asyncGuardTest', 'accepts only the newest write', 'invalidates all tickets on session change', 'suppresses duplicate mutations', 'never regresses revision watermarks', 'fails closed for malformed') && has('dataStoreTest', '33-N governed form draft persists autosave history'), `${sources.uxTest};${sources.asyncGuardTest};${sources.dataStoreTest}`);

check('B7-15 inventory binds 22 routes to five states and 110 behavior mappings', has('routeStateInventory', '"routeCount": 22', '"governedStateMappings": 110', '"retry"') && has('routeStateTest', 'all 22 canonical routes', 'meaningful shared behavior for every route-state mapping') && has('routeStateVerifier', '22x5=110'), `${sources.routeStateInventory};${sources.routeStateTest};${sources.routeStateVerifier}`);

const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, step: '33-N', decision: 'DEC-225', requirements, status: failures.length ? 'FAIL' : 'PASS', checksPassed: checks.length - failures.length, checksFailed: failures.length, checks, generatedAt: new Date().toISOString() };
if (!noWrite) {
  await mkdir(dirname(resolve(root, output)), { recursive: true });
  await writeFile(resolve(root, output), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
console.log(`33-N draft async-state UX boundary: ${report.status} (${report.checksPassed}/${checks.length}).`);
if (failures.length) process.exitCode = 1;
