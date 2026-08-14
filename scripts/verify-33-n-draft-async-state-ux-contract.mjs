import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
const output = 'artifacts/validation/33-N-draft-async-state-ux-contract.json';
const requirements = ['B3-02', 'B7-14', 'B7-15'];
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const [scope, inventory, routeStateInventory, registry, rootPackage, decision, threat] = await Promise.all([
  readJson('config/33-n-draft-async-state-ux-scope.json'),
  readJson('config/33-n-draft-async-state-ux-inventory.json'),
  readJson('config/33-n-b7-15-route-async-state-inventory.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('package.json'),
  readFile(resolve(root, 'docs/decisions/DEC-225-draft-async-state-ux.md'), 'utf8'),
  readFile(resolve(root, 'docs/security/THREAT_MODEL_33_N_DRAFT_ASYNC_STATE_UX.md'), 'utf8')
]);
const checks = [];
const check = (name, passed) => checks.push({ name, status: passed ? 'PASS' : 'FAIL' });
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const registryOpen = requirements.every((id) => registry.requirements?.some((item) => item.id === id && item.status !== 'COMPLETE'));
const registryComplete = requirements.every((id) => registry.requirements?.some((item) => item.id === id
  && item.status === 'COMPLETE' && Object.keys(item.chain ?? {}).length === 13 && Object.values(item.chain ?? {}).every(Boolean)));
const initial = scope.status === 'IN_PROGRESS' && inventory.status === 'IN_PROGRESS'
  && scope.persistentReceiptStatus === 'NOT_RUN' && inventory.persistentReceiptStatus === 'NOT_RUN';
const prepared = scope.status === 'COMPLETE' && inventory.status === 'COMPLETE'
  && scope.validation?.status === 'PASS' && inventory.validation?.status === 'PASS'
  && scope.persistentReceiptStatus === 'NOT_RUN' && inventory.persistentReceiptStatus === 'NOT_RUN'
  && scope.completionBlockers?.length === 1 && inventory.openBlockers?.length === 1;
const completed = scope.status === 'COMPLETE' && inventory.status === 'COMPLETE'
  && scope.validation?.status === 'PASS' && inventory.validation?.status === 'PASS'
  && scope.persistentReceiptStatus === 'PASS' && inventory.persistentReceiptStatus === 'PASS'
  && scope.completionBlockers?.length === 0 && inventory.openBlockers?.length === 0;
const governanceState = completed ? 'COMPLETED' : prepared ? 'VALIDATED_RECEIPT_PENDING' : initial ? 'IN_PROGRESS' : 'INVALID';

check('scope binds DEC-225 and exact B3-02 B7-14 B7-15', scope.id === '33-N-DRAFT-ASYNC-STATE-UX' && scope.decision === 'DEC-225' && exact(scope.requirements, requirements));
check('inventory binds exact step decision and requirements', inventory.step === '33-N' && inventory.decision === 'DEC-225' && exact(inventory.requirements, requirements));
check('scope lifecycle is fail-closed across initial prepared and completed phases', initial || prepared || completed);
check('inventory lifecycle is phase-consistent with scope and persistent receipt', governanceState !== 'INVALID');
check('registry requirements are open initially and exact complete only after preparation', initial ? registryOpen : (prepared || completed) && registryComplete);
check('migration 91 binds exact governed tables and form_draft authority', scope.model?.migration === 91 && exact(scope.model?.tables, ['governed_form_drafts', 'governed_form_draft_mutations']) && scope.model?.resourceType === 'form_draft');
check('personal central PEP UoW and immutable optimistic persistence are required', scope.model?.persistenceAuthority === 'central_pep_uow_personal_form_draft' && scope.model?.optimisticRevision === true && scope.model?.idempotentClientOperation === true && scope.model?.immutableMutationHistory === true);
check('save and undo are exact governed operations', exact(scope.model?.operations, ['save', 'undo']) && scope.model?.resourceIdShape === 'form_draft/{accountId}/{formKey}');
check('live validation preserves input announces summary and focuses invalid field', Object.values(scope.model?.liveValidation ?? {}).every(Boolean) && Object.keys(scope.model?.liveValidation ?? {}).length === 4);
check('screen state contract is exact', exact(scope.model?.screenStates, ['empty', 'loading', 'offline', 'error', 'retry']));
check('B7-15 route inventory binds exact 22 by 5 governed mappings', routeStateInventory.routeCount === 22 && routeStateInventory.governedStateMappings === 110 && routeStateInventory.routes?.every((route) => exact(route.states, scope.model?.screenStates)));
check('async stale duplicate and monotonic protections are exact', Object.values(scope.model?.asyncStateProtection ?? {}).every(Boolean) && Object.keys(scope.model?.asyncStateProtection ?? {}).length === 4);
check('inventory binds migration central PEP IPC renderer and tests', ['migration-91', 'central-pep-uow', 'composition-ipc-preload', 'renderer-form-ux', 'negative-and-runtime-tests'].every((id) => inventory.surfaces?.some((item) => item.id === id)));
check('no network or operating system write is introduced and root lifecycle enforces 33-N', inventory.networkChannels?.length === 0
  && inventory.operatingSystemWrites?.length === 0
  && ['pretypecheck', 'prebuild'].every((name) => rootPackage.scripts?.[name]?.includes('verify-33-n-draft-async-state-ux-boundary.mjs')));
check('decision binds PEP UoW migration undo IPC UX and fail closed completion', ['merkezi PEP', 'migration 91', 'undo', 'IPC', 'form-ux.tsx', 'fail-closed'].every((marker) => decision.includes(marker)));
check('threat model covers forged receipt fence race stale async and accessibility negatives', ['forged', 'fence yarışı', 'eski async sonuç', 'prototype', 'ilk geçersiz alan', 'retry'].every((marker) => threat.includes(marker)));

check('automated completion and manual certification truth are separated', scope.manualEvidence?.windowsNarrator === 'NOT_RUN' && scope.manualEvidence?.windowsMagnifier === 'NOT_RUN' && scope.manualEvidence?.realDevice === 'NOT_RUN' && scope.manualEvidence?.humanUat === 'NOT_RUN' && scope.manualEvidence?.certificationClaimed === false && decision.includes('otomatik uygulama kapanışı') && threat.includes('sertifikasyon iddiası kurulmaz'));

const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, step: '33-N', decision: 'DEC-225', requirements, status: failures.length ? 'FAIL' : 'PASS', checksPassed: checks.length - failures.length, checksFailed: failures.length, checks, governanceState, persistentReceiptStatus: scope.persistentReceiptStatus, generatedAt: new Date().toISOString() };
await mkdir(dirname(resolve(root, output)), { recursive: true });
await writeFile(resolve(root, output), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`33-N draft async-state UX contract: ${report.status} (${report.checksPassed}/${checks.length}).`);
if (failures.length) process.exitCode = 1;
