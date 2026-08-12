import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { scanImmutablePolicyDecisionAuditBoundary } from './verify-immutable-policy-decision-audit-boundary.mjs';

const checks = [];
const failures = [];
const check = (name, condition) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status });
  if (!condition) failures.push(name);
};
const requireMarkers = (label, source, markers) => {
  for (const marker of markers) check(`${label}: ${marker}`, source.includes(marker));
};

const paths = {
  policy: 'packages/platform-policy/src/immutable-policy-decision-audit.ts',
  policyIndex: 'packages/platform-policy/src/index.ts',
  pep: 'packages/platform-policy/src/policy-enforcement-point.ts',
  domain: 'packages/domain/src/policy-decision-audit.ts',
  domainIndex: 'packages/domain/src/index.ts',
  useCase: 'packages/application/src/policy-decision-audit-use-cases.ts',
  applicationIndex: 'packages/application/src/index.ts',
  sink: 'apps/desktop/src/main/platform-policy-receipt-file-sink.ts',
  adapter: 'apps/desktop/src/main/policy-decision-audit-application-adapter.ts',
  desktopMain: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  global: 'apps/desktop/src/renderer/global.d.ts',
  renderer: 'apps/desktop/src/renderer/App.tsx',
  ipcPolicy: 'apps/desktop/src/main/ipc-integration-policy.ts',
  ipcNoCache: 'apps/desktop/src/main/ipc-read-sharing.ts',
  targetTest: 'apps/desktop/tests/ppk018-immutable-policy-decision-audit.test.ts',
  oldJournalRuntime: 'scripts/verify-30-o-protected-receipt-journal-runtime.mjs',
  sourceGate: 'scripts/verify-immutable-policy-decision-audit-boundary.mjs',
  package: 'package.json',
  migrations: 'packages/database/src/family-database-migrations.ts',
  scope: 'config/32-n-ppk-018-immutable-policy-decision-audit-scope.json',
  inventory: 'config/32-n-ppk-018-policy-decision-audit-inventory.json',
  registry: 'config/accepted-scope-registry.json',
  ledger: 'config/user-decision-ledger.json',
  decision: 'docs/decisions/DEC-199-ppk-018-immutable-policy-decision-audit.md',
  threat: 'docs/security/PPK-018_IMMUTABLE_POLICY_DECISION_AUDIT_THREAT_MODEL.md',
  audit: 'docs/audit/32-N_PPK-018_DEGISMEZ_POLICY_KARAR_AUDIT_UST_KAPANIS.md'
};
const files = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const scope = JSON.parse(files.scope);
const inventory = JSON.parse(files.inventory);
const registry = JSON.parse(files.registry);
const ledger = JSON.parse(files.ledger);
const rootPackage = JSON.parse(files.package);
const requirement = registry.requirements.find((item) => item.id === 'PPK-018');
const successor = registry.requirements.find((item) => item.id === 'PPK-019');
const priorRequirements = ['PPK-012', 'PPK-013', 'PPK-014', 'PPK-015', 'PPK-016', 'PPK-017']
  .map((id) => registry.requirements.find((item) => item.id === id));
const migrationVersions = [...files.migrations.matchAll(/createMigrationDefinition\((\d+),/gu)].map((match) => Number(match[1]));
const latestMigration = Math.max(...migrationVersions);
const scan = await scanImmutablePolicyDecisionAuditBoundary();

requireMarkers('central immutable audit policy', files.policy, [
  'IMMUTABLE_POLICY_DECISION_AUDIT_SCHEMA_VERSION = 1',
  'ImmutablePolicyDecisionAuditRecord',
  'decisionReason',
  'policyVersion',
  'policyPackageVersion',
  'policyPackageSha256',
  'obligations',
  'requestHash',
  'contextHash',
  'receiptHash',
  'recordHash',
  'auditHash',
  'assertObligationExecution(record)',
  "enforcement: 'fail-closed'",
  'allowedDecisionsRecorded: true',
  'deniedDecisionsRecorded: true',
  'payloadExposedToClient: false'
]);
check('audit required field registry includes decision policy obligations reason and cryptographic bindings', [
  'decision', 'decisionReason', 'policyVersion', 'policyPackageVersion', 'policyPackageSha256',
  'obligations', 'requestHash', 'contextHash', 'receiptHash', 'recordHash', 'auditHash'
].every((marker) => files.policy.includes(`'${marker}'`)));
check('audit policy is exported from platform-policy root', files.policyIndex.includes("export * from './immutable-policy-decision-audit.js'"));
check('audit hash binds the canonical unsigned record', files.policy.includes('auditHash: sha256(unsigned)'));
check('audit verification reconstructs and exact-compares the record', files.policy.includes('const expected = this.create(record)') && files.policy.includes('return same(expected, audit)'));
check('receipt request hash uses the platform request HMAC domain', files.policy.includes("createHmac('sha256', 'ppt-policy-request-v1')"));
check('allowed decision requires valid strict obligation execution attestation', files.policy.includes("executorId !== 'ppt.platform-policy.strict-obligation-executor.v1'") && files.policy.includes('execution.attestationHash !== sha256(obligationExecutionPayload(execution))'));
check('denied decision cannot claim obligation execution', files.policy.includes('Denied decision cannot claim obligation execution'));

const deniedStart = files.pep.indexOf('if (!authorization.decision.allowed)');
const allowedStart = files.pep.indexOf('if (!this.#deferAllowedReceiptPersistence)', deniedStart);
const operationStart = files.pep.indexOf('await operation(context)', allowedStart);
const deniedSegment = files.pep.slice(deniedStart, allowedStart);
const allowedSegment = files.pep.slice(allowedStart, operationStart);
check('PEP persists denied decision before returning POLICY_DENIED', deniedSegment.indexOf('await this.#appendReceipt') >= 0 && deniedSegment.indexOf('await this.#appendReceipt') < deniedSegment.indexOf("'POLICY_DENIED'"));
check('PEP persists non-deferred allowed decision before payload operation', allowedSegment.includes('await this.#appendReceipt'));
check('PEP fails closed with RECEIPT_PERSISTENCE_FAILED', files.pep.includes("'RECEIPT_PERSISTENCE_FAILED'") && files.pep.includes("'RECEIPT_PERSISTENCE'"));
check('PEP constructor requires a concrete append sink', files.pep.includes("typeof options.receiptSink.append !== 'function'"));
check('deferred receipt mode requires exact idempotent ensure', files.pep.includes("typeof options.receiptSink.ensure !== 'function'") && files.pep.includes('Deferred policy receipt persistence requires an idempotent exact receipt sink'));

requireMarkers('protected journal', files.sink, [
  'JOURNAL_SCHEMA_VERSION = 2',
  'PROTECTED_DECISION_AUDIT_ENVELOPE_SCHEMA_VERSION = 1',
  "PROTECTED_DECISION_AUDIT_ENVELOPE_KIND = 'immutable-policy-decision-audit'",
  'decisionAuditPolicy.create(record)',
  'decisionAuditPolicy.verify(receiptRecord, auditRecord)',
  'protectedArtifactStore.sealBuffer(RECEIPT_ARTIFACT_KIND, recordBytes)',
  'entryHash: entryHash(payload, this.#macKey)',
  'fsyncSync(journalDescriptor)',
  'canonicalize(verified.auditRecord) !== canonicalize(auditRecord)',
  'inspectWithTrustedProvider',
  'checkpointPolicyJournal',
  'POLICY_RECEIPT_JOURNAL_NONCE_REPLAY'
]);
check('new audit is created before protected sealing', files.sink.indexOf('decisionAuditPolicy.create(record)') < files.sink.indexOf('protectedArtifactStore.sealBuffer(RECEIPT_ARTIFACT_KIND, recordBytes)'));
check('legacy direct receipt payload remains readable without becoming an audit record', files.sink.includes('assertReceiptRecordShape(parsed as PlatformPolicyReceiptRecord)') && files.sink.includes('legacyReceiptEntryCount'));
check('journal inspection counts audited and legacy entries separately', files.sink.includes('auditedEntryCount') && files.sink.includes('legacyReceiptEntryCount'));
check('trusted restart re-verifies every receipt with provider', files.sink.includes('await provider.verify(Object.freeze({') && files.sink.includes("'POLICY_RECEIPT_JOURNAL_RECEIPT_VERIFICATION_FAILED'"));
check('projection proof binds exact receipt record and journal head', ['receiptHash', 'recordHash', 'entryHash', 'headHash', 'journalSizeBytes', 'proofMac'].every((marker) => files.sink.includes(marker)));

check('domain exposes only content-free policy audit boundary posture', files.domain.includes('PolicyDecisionAuditBoundaryView') && files.domain.includes('payloadExposedToClient: false'));
check('domain boundary does not expose receipt audit resource reason or obligations payload', !/\b(?:receiptRecord|auditRecord|correlationId|resourceId|decisionReason|obligations)\s*:/u.test(files.domain));
check('domain and application roots export the PPK-018 contracts', files.domainIndex.includes("export * from './policy-decision-audit.js'") && files.applicationIndex.includes("export * from './policy-decision-audit-use-cases.js'"));
check('application use case validates counts and hashes fail closed', files.useCase.includes('POLICY_DECISION_AUDIT_INSPECTION_FAILED') && files.useCase.includes('auditedEntryCount + inspection.legacyReceiptEntryCount !== inspection.entryCount') && files.useCase.includes('SHA256.test(inspection.headHash)'));
check('application adapter calls only content-free decision audit inspection', files.adapter.includes('this.sink.inspectDecisionAuditBoundary()') && !/inspectForControlledTest|inspectWithTrustedProvider/u.test(files.adapter));

check('main composes protected journal and trusted startup verification', files.desktopMain.includes('archivePolicyReceiptSink = new PlatformPolicyReceiptFileSink({') && files.desktopMain.includes('await archivePolicyReceiptSink.inspectWithTrustedProvider('));
check('main passes the verified journal to universal API and DataStore runtimes', files.desktopMain.includes('receiptSink: policyReceiptSink()') && files.desktopMain.includes('archivePolicyReceiptSink,'));
check('main registers typed content-free PPK-018 status handler', files.desktopMain.includes("registerIpcHandler('system:getPolicyDecisionAuditBoundary', ():PolicyDecisionAuditBoundaryView"));
check('preload and renderer global expose typed PPK-018 status only', files.preload.includes('getPolicyDecisionAuditBoundary:():Promise<PolicyDecisionAuditBoundaryView>') && files.global.includes('getPolicyDecisionAuditBoundary():Promise<PolicyDecisionAuditBoundaryView>'));
check('PPK-018 status IPC is zero argument', files.ipcPolicy.includes("case 'system:getPolicyDecisionAuditBoundary':") && files.ipcPolicy.includes('return zeroArguments(args);'));
check('PPK-018 status IPC is policy-sensitive no-cache', files.ipcNoCache.includes("'system:getPolicyDecisionAuditBoundary'"));
check('renderer loads and displays the PPK-018 posture without payload', files.renderer.includes('getPolicyDecisionAuditBoundary().then(setPolicyDecisionAuditBoundary)') && files.renderer.includes('PPK-018 · değişmez karar denetimi') && files.renderer.includes('istemciye payload verilmez'));

check('source gate passes all malicious and benign self-tests with no finding', scan.status === 'PASS' && scan.maliciousSelfTestsPassed === scan.maliciousSelfTests && scan.benignSelfTestsPassed === scan.benignSelfTests && scan.findings.length === 0);
check('source gate scans all production zones and all PEP compositions', scan.zones === 18 && scan.enforcementPointCompositions >= 7);
requireMarkers('source gate', files.sourceGate, [
  'PEP_RECEIPT_SINK_MISSING',
  'PEP_NOOP_RECEIPT_SINK',
  'DEFERRED_RECEIPT_ENSURE_MISSING',
  'DENIAL_AUDIT_NOT_PERSISTED_BEFORE_RETURN',
  'PLAINTEXT_POLICY_AUDIT_SERIALIZATION',
  'CLIENT_POLICY_AUDIT_PAYLOAD_EXPOSURE',
  'POLICY_AUDIT_STATUS_CHANNEL_CACHEABLE'
]);
check('pretypecheck and prebuild include PPK-018 audit gate', rootPackage.scripts?.pretypecheck?.includes('verify-immutable-policy-decision-audit-boundary.mjs') && rootPackage.scripts?.prebuild?.includes('verify-immutable-policy-decision-audit-boundary.mjs'));
check('root package exposes all four PPK-018 commands', [
  'verify:ppk018:audit-boundary', 'verify:ppk018:targeted', 'verify:ppk018:contract', 'verify:ppk018:runtime'
].every((name) => typeof rootPackage.scripts?.[name] === 'string'));

requireMarkers('targeted test', files.targetTest, [
  'ImmutablePolicyDecisionAuditPolicy',
  'PlatformPolicyReceiptFileSink',
  'GetPolicyDecisionAuditBoundaryUseCase',
  "captureRecord(true, 'nonce-018-policy-allow')",
  "captureRecord(false, 'nonce-018-policy-deny')",
  'tarihsel doğrudan receipt payloadını geriye uyumlu okur',
  'aynı nonce ile değişen kararın tek bir baytını bile eklemez',
  'journal bit değişikliğinde hiçbir durum projectionı döndürmez',
  "['izin', true]",
  "['ret', false]",
  'payloadExposedToClient: false'
]);
check('targeted tamper matrix covers package context resource reason obligations and execution', ['policy package', 'context hash', 'resource identity', 'decision reason', 'obligations', 'obligation execution'].every((marker) => files.targetTest.includes(marker)));
check('legacy protected journal runtime now creates canonical records through real PEP', files.oldJournalRuntime.includes('new PlatformPolicyEnforcementPoint({') && files.oldJournalRuntime.includes('assert.ok(capturedRecord)'));

check('latest database migration remains 77 and no PPK-018 migration exists', latestMigration === 77 && !files.migrations.toLowerCase().includes('ppk018'));
check('scope forbids migration backfill transfer ownership change and cutover', scope.boundaries?.schemaMigrationRequired === false && scope.realDataBackfillPerformed === false && scope.realDataTransferPerformed === false && scope.sqliteOwnershipTransferred === false && scope.cutoverAuthorityAttached === false);
check('scope records journal entry v2 and protected audit envelope v1', scope.boundaries?.journalEntrySchemaVersion === 2 && scope.boundaries?.protectedAuditEnvelopeSchemaVersion === 1);
check('scope distinguishes legacy read from new audited writes', scope.boundaries?.legacyDirectReceiptPayloadReadable === true && scope.boundaries?.newLegacyDirectReceiptPayloadWritable === false && scope.boundaries?.historicalBackfillPerformed === false);
check('scope rejects generic audit and allowed-only ledger as PPK-018 authority', scope.boundaries?.genericBusinessAuditLogCountsAsPolicyDecisionAudit === false && scope.boundaries?.sqliteAllowedReceiptLedgerCountsAsDeniedDecisionAudit === false);
check('inventory reviews seven owners with zero unaudited owner and zero bypass exception', inventory.productionInventory?.length === 7 && inventory.closureSummary?.reviewedOwners === 7 && inventory.closureSummary?.activeUnauditedPolicyDecisionOwners === 0 && inventory.closureSummary?.noOpReceiptSinkProductionExceptions === 0 && inventory.closureSummary?.plaintextPolicyAuditProductionExceptions === 0 && inventory.closureSummary?.clientAuditPayloadExposureExceptions === 0 && inventory.closureSummary?.openBlockerCount === 0);
check('inventory classifies protected journal as the immutable audit owner', inventory.productionInventory?.find((item) => item.id === 'desktop-protected-policy-journal')?.classification === 'IMMUTABLE_AUDIT_OWNER');
check('inventory keeps business audit and SQLite allowed receipts non-authoritative', inventory.productionInventory?.find((item) => item.id === 'generic-business-audit-and-sqlite-allowed-receipts')?.disposition === 'CLASSIFIED_SEPARATE_BOUNDARY');

check('DEC-199 records fail-closed ordering protected journal and no-migration truth', files.decision.includes('DEC-199') && files.decision.includes('RECEIPT_PERSISTENCE_FAILED') && files.decision.includes('AES-256-GCM') && files.decision.includes('Yeni database migration eklenmez'));
check('threat model records no-op sink tamper rollback legacy and client threats', ['no-op', 'tek bitinin oynanması', 'complete-tail rollback', 'Tarihsel direct receipt', 'renderer IPC'].every((marker) => files.threat.includes(marker)));
check('audit contains the exact final truth boundary and executed evidence', files.audit.includes('PPK-018 değişmez policy karar audit') && files.audit.includes('20/20 PASS') && files.audit.includes('14/14 PASS') && files.audit.includes('COMPLETE / PASS') && files.audit.includes('590/590 test PASS') && files.audit.includes('99/99 PASS') && files.audit.includes('15/15 PASS'));
check('user decision ledger contains active DEC-199 and exact count', ledger.decisionCount === ledger.decisions.length && ledger.decisions.some((item) => item.id === 'DEC-199' && item.status === 'ACTIVE' && item.requirements?.includes('PPK-018')));
check('accepted registry closes the complete PPK-018 evidence chain', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true) && requirement.evidence?.length >= 10);
check('prior PPK-012 through PPK-017 packages remain complete', priorRequirements.every((item) => item?.status === 'COMPLETE'));
check('PPK-019 remains a separate independently evidenced successor', successor !== undefined && successor.id === 'PPK-019');
check('scope closes PPK-018 with no migration transfer backfill or cutover', scope.status === 'COMPLETED' && scope.validation?.state === 'COMPLETE' && scope.validation?.finalValidationRecorded === true && scope.requirementCompletionClaimed === true && scope.remainingClosureWork?.length === 0);
check('inventory closes only after final validation', inventory.status === 'COMPLETE' && inventory.completionClaimed === true && inventory.closureSummary?.finalValidationPending === false);

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-N',
  requirement: 'PPK-018',
  phase: 'IMMUTABLE_POLICY_DECISION_AUDIT_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS',
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  failures,
  sourceGate: scan,
  latestDatabaseMigration: latestMigration,
  schemaMigrationRequired: false,
  journalEntrySchemaVersion: 2,
  protectedAuditEnvelopeSchemaVersion: 1,
  allowedDecisionsRecorded: true,
  deniedDecisionsRecorded: true,
  decisionReasonRequired: true,
  obligationsRecordedExactly: true,
  auditPersistenceFailureBlocksOperation: true,
  clientAuditPayloadExposureAllowed: false,
  historicalBackfillPerformed: false,
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  realDataTransferPerformed: false,
  cutoverAuthorityAttached: false,
  successorRequirementCompletedByThisPackage: false,
  requirementCompletionClaimed: failures.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-N-ppk-018-immutable-policy-decision-audit-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`PPK-018 contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log(`PPK-018 contract: PASS (${checks.length}/${checks.length}).`);
