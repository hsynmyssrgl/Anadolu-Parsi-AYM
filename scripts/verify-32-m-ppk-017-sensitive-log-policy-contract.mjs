import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { scanSensitiveLogBoundary } from './verify-sensitive-log-boundary.mjs';

const checks = [];
const failures = [];
const check = (name, condition) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status });
  if (!condition) failures.push(name);
};

const files = Object.fromEntries(await Promise.all(Object.entries({
  policy: 'packages/platform-policy/src/sensitive-log-policy.ts',
  policyIndex: 'packages/platform-policy/src/index.ts',
  logging: 'packages/logging/src/index.ts',
  loggingPackage: 'packages/logging/package.json',
  domain: 'packages/domain/src/sensitive-logging.ts',
  domainIndex: 'packages/domain/src/index.ts',
  useCase: 'packages/application/src/sensitive-logging-use-cases.ts',
  applicationIndex: 'packages/application/src/index.ts',
  diagnosticUseCase: 'packages/application/src/operational-health-use-cases.ts',
  repository: 'packages/repositories/src/diagnostic-repository.ts',
  reportDomain: 'packages/domain/src/app-data.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  protectedLogger: 'apps/desktop/src/main/protected-side-artifact-logger.ts',
  runtimeBootstrap: 'apps/desktop/src/main/runtime-bootstrap.ts',
  coreMain: 'apps/core-service/src/main.ts',
  corePackage: 'apps/core-service/package.json',
  desktopMain: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  global: 'apps/desktop/src/renderer/global.d.ts',
  renderer: 'apps/desktop/src/renderer/App.tsx',
  ipcPolicy: 'apps/desktop/src/main/ipc-integration-policy.ts',
  ipcNoCache: 'apps/desktop/src/main/ipc-read-sharing.ts',
  targetTest: 'apps/desktop/tests/ppk017-sensitive-log-policy.test.ts',
  dataStoreTest: 'apps/desktop/tests/data-store.test.ts',
  loggingTest: 'packages/logging/tests/logging.test.ts',
  sourceGate: 'scripts/verify-sensitive-log-boundary.mjs',
  package: 'package.json',
  migrations: 'packages/database/src/family-database-migrations.ts',
  decision: 'docs/decisions/DEC-198-ppk-017-sensitive-log-policy.md',
  threat: 'docs/security/PPK-017_SENSITIVE_LOG_POLICY_THREAT_MODEL.md',
  audit: 'docs/audit/32-M_PPK-017_HASSAS_LOG_POLITIKASI_UST_KAPANIS.md'
}).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));

const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const requirement = registry.requirements.find((item) => item.id === 'PPK-017');
const successor = registry.requirements.find((item) => item.id === 'PPK-018');
const priorRequirements = ['PPK-012', 'PPK-013', 'PPK-014', 'PPK-015', 'PPK-016']
  .map((id) => registry.requirements.find((item) => item.id === id));
const scope = JSON.parse(await readFile('config/32-m-ppk-017-sensitive-log-policy-scope.json', 'utf8'));
const inventory = JSON.parse(await readFile('config/32-m-ppk-017-log-surface-inventory.json', 'utf8'));
const ledger = JSON.parse(await readFile('config/user-decision-ledger.json', 'utf8'));
const rootPackage = JSON.parse(files.package);
const loggingPackage = JSON.parse(files.loggingPackage);
const corePackage = JSON.parse(files.corePackage);
const scan = await scanSensitiveLogBoundary();

const reportViewStart = files.reportDomain.indexOf('export interface DiagnosticReportView');
const reportViewEnd = files.reportDomain.indexOf('export interface BackupInspectionCheckView', reportViewStart);
const reportView = reportViewStart >= 0 && reportViewEnd > reportViewStart
  ? files.reportDomain.slice(reportViewStart, reportViewEnd)
  : '';
const earlyFailureStart = files.desktopMain.indexOf('const writeEarlyStartupFailureEvidence');
const earlyFailureEnd = files.desktopMain.indexOf('let revocationSyncService', earlyFailureStart);
const earlyFailure = earlyFailureStart >= 0 && earlyFailureEnd > earlyFailureStart
  ? files.desktopMain.slice(earlyFailureStart, earlyFailureEnd)
  : '';
const migrationVersions = [...files.migrations.matchAll(/createMigrationDefinition\((\d+),/gu)].map((match) => Number(match[1]));
const latestMigration = Math.max(...migrationVersions);

check('central policy declares the eight accepted metadata classes', [
  'IDENTIFIER', 'SHA256', 'RESULT', 'CORRELATION', 'COUNTER', 'BOOLEAN', 'TIMESTAMP', 'VERSION'
].every((marker) => files.policy.includes(`'${marker}'`)));
check('policy is exported from the platform-policy package', files.policyIndex.includes("export * from './sensitive-log-policy.js'"));
check('policy snapshot is fail-closed and content-free', [
  "enforcement: 'fail-closed'", 'payloadAllowed: false', 'ocrTextAllowed: false',
  'arbitraryMessageAllowed: false', 'errorStackAllowed: false', 'persistentPathAllowed: false',
  'nestedMetadataAllowed: false', 'diagnosticTextStored: false', 'diagnosticSourceTextHashed: true'
].every((marker) => files.policy.includes(marker)));
check('metadata field and technical token limits are fixed', files.policy.includes('const MAXIMUM_METADATA_FIELDS = 48') && files.policy.includes('const MAXIMUM_TECHNICAL_TOKEN_LENGTH = 160'));
check('forbidden metadata key policy covers payload OCR text stack query credentials and paths', [
  'payload', 'text', 'ocr', 'transcript', 'message', 'detail', 'content', 'stack',
  'query', 'sql', 'password', 'secret', 'token', 'credential', 'file.?path', 'directory', 'title', 'note'
].every((marker) => files.policy.includes(marker)));
check('nested metadata is rejected and only bounded migration version arrays are accepted', files.policy.includes("reason: 'METADATA_NESTING_FORBIDDEN'") && files.policy.includes('const NUMBER_ARRAY_KEYS') && files.policy.includes('value.length > 128'));
check('diagnostic sanitizer stores a fixed technical message and SHA-256 source fingerprint', files.policy.includes('const diagnosticMessage') && files.policy.includes("createHash('sha256')") && files.policy.includes('sha256:${diagnosticSourceHash(input)}'));
check('diagnostic verifier accepts only the fixed message and hash envelope', files.policy.includes('input.message === diagnosticMessage(input.code)') && files.policy.includes('DIAGNOSTIC_DETAILS_HASH.test(input.details)'));
check('sensitive signal hashing includes error name message and stack without returning them', files.policy.includes("`${value.name}\\u0000${value.message}\\u0000${value.stack ?? ''}`") && files.policy.includes(".digest('hex')"));

check('logging serializer evaluates the central policy before JSON serialization', files.logging.includes('const decision = sensitiveLogPolicy.evaluate(event)') && files.logging.indexOf('sensitiveLogPolicy.evaluate(event)') < files.logging.indexOf('return JSON.stringify(safeEvent)'));
check('policy rejection exposes only a stable code and reason', files.logging.includes("super('SENSITIVE_LOG_POLICY_REJECTED')") && files.logging.includes('export interface SafeLogWriteFailure'));
check('memory logger drops unsafe events into content-free rejection evidence', files.logging.includes('readonly #rejections: SafeLogWriteFailure[]') && files.logging.includes('this.#rejections.push(toSafeLogWriteFailure(error))'));
check('central console writer serializes before bracket stream write', files.logging.includes('const line = `${serializeLogEvent(event)}\\n`') && files.logging.includes('process[stream].write(line)'));
check('logging package declares the platform policy dependency', loggingPackage.dependencies?.['@ppt/platform-policy'] === '4.8.2026-29');
check('foundation builds platform policy before logging', rootPackage.scripts?.['build:foundation']?.indexOf('@ppt/platform-policy') < rootPackage.scripts?.['build:foundation']?.indexOf('@ppt/logging'));

check('domain exposes a content-free sensitive logging boundary view', files.domain.includes('export interface SensitiveLoggingBoundaryView') && files.domain.includes('plaintextDesktopProductionSinkAllowed: false') && files.domain.includes('schemaMigrationRequired: false'));
check('domain and application roots export the PPK-017 contracts', files.domainIndex.includes("export * from './sensitive-logging.js'") && files.applicationIndex.includes("export * from './sensitive-logging-use-cases.js'"));
check('application boundary use case derives its view from SensitiveLogPolicy', files.useCase.includes('class GetSensitiveLoggingBoundaryUseCase') && files.useCase.includes('const snapshot = this.policy.snapshot()'));
check('boundary view records latest migration 77 and no payload path secret or cutover exposure', [
  'latestDatabaseMigration: 77', 'payloadExposed: false', 'persistentPathExposed: false',
  'secretMaterialExposed: false', 'cutoverAuthorityAttached: false'
].every((marker) => files.useCase.includes(marker)));

check('diagnostic application use case requires central policy and sanitizes before write', files.diagnosticUseCase.includes('private readonly sensitiveLogPolicy: SensitiveLogPolicy') && files.diagnosticUseCase.includes('this.sensitiveLogPolicy.sanitizeDiagnostic') && files.diagnosticUseCase.includes('this.write.insertDiagnostic(c, safe)'));
check('diagnostic repository sanitizes event ingestion independently', files.repository.includes('sensitiveLogPolicy.sanitizeDiagnostic') && files.repository.includes('insertIfAbsent'));
check('diagnostic repository rejects direct unsafe writes', files.repository.includes('verifyDiagnostic') && files.repository.includes('SENSITIVE_LOG_DIAGNOSTIC_WRITE_REJECTED'));
check('diagnostic repository read mapping is verified fail-closed', files.repository.includes('sensitiveLogPolicy.verifyDiagnostic(value)') && files.repository.includes('SENSITIVE_LOG_STORED_DIAGNOSTIC_INVALID') && files.repository.includes('.map(diagnostic)'));
check('DataStore injects central policy into RecordDiagnosticUseCase', files.dataStore.includes('new RecordDiagnosticUseCase(operationalHealthAdapter, new SensitiveLogPolicy())'));

check('diagnostic report projection retains only content-free result summaries', ['backupResults', 'notificationResults', 'queueResults'].every((marker) => reportView.includes(marker)));
check('diagnostic report projection excludes full backup target run notification and queue payload arrays', ['backupTargets', 'recentBackupRuns', 'healthNotifications', 'queue:QueuedTaskView'].every((marker) => !reportView.includes(marker)));
check('DataStore computes content-free diagnostic report counts', files.dataStore.includes('successfulRunCount:recentBackupRuns.filter') && files.dataStore.includes('notificationResults:{activeCount:') && files.dataStore.includes('deferredCount:queue.filter'));
check('protected desktop logger serializes centrally and writes only protected records', files.protectedLogger.includes('serializeLogEvent({ ...event, level })') && files.protectedLogger.includes("appendTextRecord(this.#filePath, 'log-event', serialized)") && files.protectedLogger.includes("'desktop-main.pplog'"));
check('runtime bootstrap composes protected logger and content-free write failure callback', files.runtimeBootstrap.includes('new ProtectedSideArtifactLogger') && files.runtimeBootstrap.includes('writeContentFreeConsoleEvent') && !files.runtimeBootstrap.includes('redactConfig'));

check('early startup evidence stores error name and fingerprint only', earlyFailure.includes('errorFingerprint = sensitiveLogPolicy.hashSensitiveSignal(error)') && earlyFailure.includes('errorName') && !/message:\s*error\.message|stack:\s*error\.stack/u.test(earlyFailure));
check('desktop fatal console fallback uses central content-free writer', earlyFailure.includes('writeContentFreeConsoleEvent') && earlyFailure.includes("event: 'application.startup_failed'"));
check('Core Service uses the central writer and has no console primitive', files.coreMain.includes('writeContentFreeConsoleEvent') && !/\bconsole\.(?:log|error|warn|info|debug)\s*\(/u.test(files.coreMain));
check('Core Service package declares core and logging dependencies', corePackage.dependencies?.['@ppt/core'] === '4.8.2026-29' && corePackage.dependencies?.['@ppt/logging'] === '4.8.2026-29');

check('main registers a typed zero-input sensitive logging status handler', files.desktopMain.includes("registerIpcHandler('system:getSensitiveLoggingBoundary', ():SensitiveLoggingBoundaryView => getSensitiveLoggingBoundaryUseCase.execute())"));
check('preload and renderer global expose the typed boundary method', files.preload.includes('getSensitiveLoggingBoundary:():Promise<SensitiveLoggingBoundaryView>') && files.global.includes('getSensitiveLoggingBoundary():Promise<SensitiveLoggingBoundaryView>'));
check('sensitive logging IPC is zero-argument in integration policy', files.ipcPolicy.includes("'system:getSensitiveLoggingBoundary'"));
check('sensitive logging IPC is policy-sensitive no-cache', files.ipcNoCache.includes("'system:getSensitiveLoggingBoundary'"));
check('renderer loads and displays PPK-017 fail-closed posture', files.renderer.includes('getSensitiveLoggingBoundary().then(setSensitiveLoggingBoundary)') && files.renderer.includes('PPK-017 · hassas log güvenliği'));
check('profile menu exposes the PPK-017 sensitive logging posture', files.renderer.includes('Hassas log güvenliği</button>'));

check('static gate scans all production source zones and forbids direct console and stream primitives', files.sourceGate.includes("for (const owner of ['apps', 'packages'])") && files.sourceGate.includes('DIRECT_CONSOLE_PRIMITIVE') && files.sourceGate.includes('DIRECT_PROCESS_STREAM_PRIMITIVE'));
check('static gate forbids plaintext logger serializer and diagnostic SQL bypasses', ['PLAINTEXT_LOGGER_IMPORT', 'SERIALIZER_BYPASS', 'DIAGNOSTIC_SQL_BYPASS'].every((marker) => files.sourceGate.includes(marker)));
check('static gate covers unsafe metadata raw errors spread and nesting', ['FORBIDDEN_METADATA_KEY', 'RAW_ERROR_SIGNAL', 'RAW_ERROR_METADATA', 'METADATA_SPREAD_FORBIDDEN', 'NESTED_METADATA_OBJECT_FORBIDDEN'].every((marker) => files.sourceGate.includes(marker)));
check('static source gate passes its malicious and benign self-tests with no finding', scan.status === 'PASS' && scan.maliciousSelfTestsPassed === scan.maliciousSelfTests && scan.benignSelfTestsPassed === scan.benignSelfTests && scan.findings.length === 0);
check('pretypecheck includes the PPK-017 source gate', rootPackage.scripts?.pretypecheck?.includes('verify-sensitive-log-boundary.mjs'));
check('root package exposes all four PPK-017 commands', [
  'verify:ppk017:log-boundary', 'verify:ppk017:targeted', 'verify:ppk017:contract', 'verify:ppk017:runtime'
].every((name) => typeof rootPackage.scripts?.[name] === 'string'));

check('targeted test covers central policy use case SQLite protected sink and IPC UI', [
  'SensitiveLogPolicy', 'GetSensitiveLoggingBoundaryUseCase', 'SqliteDiagnosticRepository',
  'ProtectedSideArtifactLogger', 'system:getSensitiveLoggingBoundary', 'IPC boundary no-cache'
].every((marker) => files.targetTest.includes(marker)));
check('targeted test includes payload OCR nested raw error and persistent path attacks', [
  "['payload key', { payload: CANARY }]", "['OCR text key', { ocrText: CANARY }]",
  "['arbitrary message', { message: CANARY }]", "['stack', { stack: `Error: ${CANARY}` }]",
  "['file path', { filePath: `C:\\\\private\\\\${CANARY}.txt` }]", "['nested object', { result: { payload: CANARY } }]"
].every((marker) => files.targetTest.includes(marker)));
check('targeted test proves direct diagnostic write and stored-row tamper fail closed', files.targetTest.includes("id: 'diag-unsafe'") && files.targetTest.includes("UPDATE diagnostic_entries SET message=?") && files.targetTest.includes('toMatchObject({ ok: false })'));
check('targeted test proves protected log decrypts without canary leakage', files.targetTest.includes("const plaintext = store.openEnvelope(envelopes[0]!).toString('utf8')") && files.targetTest.includes('expect(plaintext).not.toContain(CANARY)'));
check('DataStore regression carries a synthetic PPK-017 canary through report and archive', files.dataStoreTest.includes('PPK-017 tanı, rapor ve arşiv zincirinde') && files.dataStoreTest.includes("const canary='OCR sağlık finans gizli payload metni PPK017'") && files.dataStoreTest.includes('expect(JSON.stringify(archiveContent)).not.toContain(canary)'));
check('logging regression covers policy rejection and content-free error callback', files.loggingTest.includes('SensitiveLogPolicyViolation') && files.loggingTest.includes('SENSITIVE_LOG_POLICY_REJECTED'));

check('migration 77 baseline remains present with no PPK-017 migration', migrationVersions.includes(77) && latestMigration >= 77 && !files.migrations.includes('ppk017') && scope.boundaries?.schemaMigrationRequired === false);
check('scope records no transfer backfill ownership change or cutover', scope.realDataTransferPerformed === false && scope.realDataBackfillPerformed === false && scope.sqliteOwnershipTransferred === false && scope.cutoverAuthorityAttached === false);
check('scope explicitly leaves immutable decision audit to PPK-018', scope.boundaries?.auditDecisionChainCompletedByThisPackage === false && scope.boundaries?.auditDecisionChainRequirement === 'PPK-018');
check('production inventory has seven reviewed owners and zero open sensitive payload owner', inventory.productionInventory?.length === 7 && inventory.closureSummary?.reviewedOwners === 7 && inventory.closureSummary?.activeSensitiveLogPayloadOwners === 0 && inventory.closureSummary?.openBlockerCount === 0);
check('production inventory records zero direct console plaintext sink and diagnostic SQL exceptions', inventory.closureSummary?.directConsolePrimitiveExceptions === 0 && inventory.closureSummary?.plaintextDesktopProductionSinkExceptions === 0 && inventory.closureSummary?.diagnosticSqlWriteExceptions === 0);
check('production inventory keeps PPK-018 audit outside PPK-017 evidence', inventory.productionInventory?.find((item) => item.id === 'immutable-policy-decision-audit')?.disposition === 'EXCLUDED_TO_PPK_018');

check('DEC-198 records content-free metadata schema and no-migration truth', files.decision.includes('DEC-198') && files.decision.includes('Yeni migration eklenmez') && files.decision.includes('PPK-018'));
check('threat model records fail-closed read write report and protected sink controls', files.threat.includes('Repository read mapper') && files.threat.includes('ProtectedSideArtifactLogger') && files.threat.includes('PPK-018'));
check('audit records the complete final validation matrix', files.audit.includes('Durum: `COMPLETE / PASS`') && files.audit.includes('Final doğrulama'));
check('user decision ledger contains active DEC-198 and exact count', ledger.decisionCount === ledger.decisions.length && ledger.decisions.some((item) => item.id === 'DEC-198' && item.status === 'ACTIVE' && item.requirements?.includes('PPK-017')));
check('accepted registry closes the complete PPK-017 evidence chain', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true) && requirement.evidence?.length >= 5);
check('prior PPK-012 through PPK-016 packages remain complete', priorRequirements.every((item) => item?.status === 'COMPLETE'));
check('PPK-018 is not claimed complete by PPK-017', successor !== undefined && successor.status !== 'COMPLETE');
check('scope closes PPK-017 without schema migration backfill or cutover', scope.status === 'COMPLETED' && scope.validation?.state === 'COMPLETE' && scope.validation?.finalValidationRecorded === true && scope.requirementCompletionClaimed === true && scope.remainingClosureWork?.length === 0);
check('inventory closes only after final validation', inventory.status === 'COMPLETE' && inventory.completionClaimed === true && inventory.closureSummary?.finalValidationPending === false);

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-M',
  requirement: 'PPK-017',
  phase: 'SENSITIVE_LOG_POLICY_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS',
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  failures,
  sourceGate: scan,
  latestDatabaseMigration: latestMigration,
  schemaMigrationRequired: false,
  allowedMetadataClasses: scope.boundaries?.allowedMetadataClasses,
  payloadLoggingAllowed: false,
  ocrTextLoggingAllowed: false,
  plaintextDesktopProductionSinkAllowed: false,
  directConsolePrimitiveExceptions: 0,
  diagnosticSqlWriteExceptions: 0,
  auditDecisionChainCompletedByThisPackage: false,
  auditDecisionChainRequirement: 'PPK-018',
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  realDataTransferPerformed: false,
  realDataBackfillPerformed: false,
  cutoverAuthorityAttached: false,
  requirementCompletionClaimed: failures.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-M-ppk-017-sensitive-log-policy-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`PPK-017 contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log(`PPK-017 contract: PASS (${checks.length}/${checks.length}).`);
