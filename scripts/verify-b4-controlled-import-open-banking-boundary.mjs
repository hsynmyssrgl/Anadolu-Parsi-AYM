import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { runPlatformPolicyAstGate } from './verify-platform-policy-ast-gate.mjs';
import { runPlatformCapabilityManifestGate } from './verify-platform-capability-manifest-gate.mjs';

const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));

export const verifyB4ControlledImportOpenBankingBoundary = async () => {
  const [
    scope, inventory, domain, application, repositoryContract, repository,
    aiRepository, personLifecycleRepository, migrations, adapter, dataStore,
    parser, main, ipcPolicy, preload, declarations, appRenderer, planningRenderer,
    importRenderer, applicationTest, parserTest, ipcTest, dataStoreTest,
    decision, threatModel, auditDocument, masterRegister, astAllowlist,
    astGate, capabilityGate, rootPackage
  ] = await Promise.all([
    json('config/33-d-b4-controlled-import-open-banking-scope.json'),
    json('config/33-d-b4-controlled-import-open-banking-inventory.json'),
    text('packages/domain/src/app-data.ts'),
    text('packages/application/src/finance-use-cases.ts'),
    text('packages/repository-contracts/src/finance-repository.ts'),
    text('packages/repositories/src/finance-repository.ts'),
    text('packages/repositories/src/ai-consent-repository.ts'),
    text('packages/repositories/src/person-lifecycle-repository.ts'),
    text('packages/database/src/family-database-migrations.ts'),
    text('apps/desktop/src/main/finance-application-adapter.ts'),
    text('apps/desktop/src/main/data-store.ts'),
    text('apps/desktop/src/main/finance-import-file-session.ts'),
    text('apps/desktop/src/main/main.ts'),
    text('apps/desktop/src/main/ipc-integration-policy.ts'),
    text('apps/desktop/src/main/preload.ts'),
    text('apps/desktop/src/renderer/global.d.ts'),
    text('apps/desktop/src/renderer/App.tsx'),
    text('apps/desktop/src/renderer/FinancePlanningPanel.tsx'),
    text('apps/desktop/src/renderer/FinanceImportPanel.tsx'),
    text('packages/application/tests/finance-controlled-import-open-banking.test.ts'),
    text('apps/desktop/tests/finance-import-file-session.test.ts'),
    text('apps/desktop/tests/b4-finance-import-ipc-integration.test.ts'),
    text('apps/desktop/tests/data-store.test.ts'),
    text('docs/decisions/DEC-215-b4-controlled-import-open-banking.md'),
    text('docs/security/THREAT_MODEL_33_D_B4_CONTROLLED_IMPORT_OPEN_BANKING.md'),
    text('docs/audit/33-D_B4_CONTROLLED_IMPORT_OPEN_BANKING_UST_KAPANIS.md'),
    text('docs/10_MASTER_DECISION_REGISTER.md'),
    json('config/32-q-ppk-021-platform-policy-ast-allowlist.json'),
    runPlatformPolicyAstGate(),
    runPlatformCapabilityManifestGate(),
    json('package.json')
  ]);

  const checks = [];
  const failures = [];
  const check = (name, condition) => {
    const passed = Boolean(condition);
    checks.push({ name, passed });
    if (!passed) failures.push(name);
  };
  const migrationVersions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)]
    .map((match) => Number.parseInt(match[1], 10));
  const migrationStart = migrations.indexOf('const financeControlledImportOpenBankingSql =');
  const migrationEnd = migrations.indexOf('export const FAMILY_DATABASE_MIGRATIONS');
  const importMigration = migrationStart >= 0 && migrationEnd > migrationStart
    ? migrations.slice(migrationStart, migrationEnd)
    : '';
  const tableDefinitions = [...importMigration.matchAll(/CREATE TABLE finance_import_(?:batches|entries)\(([\s\S]*?)\n\);/gu)]
    .map((match) => match[1]);
  const persistedColumns = tableDefinitions.flatMap((definition) =>
    [...definition.matchAll(/^\s*([a-z_]+)\s+(?:TEXT|INTEGER|REAL)\b/gmu)].map((match) => match[1]));
  const prohibited = new Set(inventory.prohibitedPersistedColumns ?? []);
  const prohibitedPersistedColumns = persistedColumns.filter((column) => prohibited.has(column));
  const astKeys = new Set(astAllowlist.allowedSurfaceKeys ?? []);
  const channels = ['finance:selectImportFile','finance:previewOpenBankingSandbox','finance:commitImportPreview'];
  const methods = ['selectFinanceImportFile','previewOpenBankingSandbox','commitFinanceImportPreview'];
  const importEventSlice = application.slice(
    application.indexOf("eventType: 'finance.import.batch_committed'"),
    application.indexOf('return event.ok ? ok(', application.indexOf("eventType: 'finance.import.batch_committed'"))
  );

  check('scope closes exactly B4-13 and B4-14 under DEC-215', scope.status === 'COMPLETE'
    && scope.decision === 'DEC-215' && scope.requirements?.join(',') === 'B4-13,B4-14');
  check('inventory has no blocker or remaining B4 import requirement', inventory.status === 'COMPLETE'
    && inventory.openBlockers?.length === 0 && inventory.openRequirements?.length === 0);
  check('scope fixes bounded formats preview mapping and atomic commit', scope.controlledImport?.sourceFormats?.join(',') === 'csv,tsv,xlsx,ofx,qfx'
    && scope.controlledImport?.maximumFileBytes === 5_242_880
    && scope.controlledImport?.maximumRows === 5_000
    && scope.controlledImport?.maximumColumns === 64
    && scope.controlledImport?.previewTtlMinutes === 15
    && scope.controlledImport?.workflow?.includes('atomic-commit'));
  check('scope preserves network-free synthetic and manual fallback truth', scope.openBanking?.adapterContract === 'ohvps-v1-local'
    && scope.openBanking?.sandboxData === 'synthetic_local'
    && scope.openBanking?.liveBankConnection === 'not_implemented'
    && scope.openBanking?.networkAccess === 'not_performed'
    && scope.openBanking?.credentialCollection === 'prohibited'
    && scope.openBanking?.externalConsent === 'not_performed');
  check('domain exposes preview mapping normalized rows batch entry and workspace surfaces', includesAll(domain, [
    'FINANCE_IMPORT_SOURCE_FORMATS', 'FinanceImportColumnMappingInput', 'FinanceImportPreviewView',
    'CommitFinanceImportPreviewInput', 'CommitFinanceImportBatchInput', 'FinanceImportBatchView',
    'FinanceImportedCashFlowView', 'importedCashFlowEntries:readonly FinanceImportedCashFlowView[]',
    'importBatches:readonly FinanceImportBatchView[]'
  ]));
  check('domain makes raw retention and path exposure impossible in successful previews', includesAll(domain, [
    'rawFileRetained:false', 'filePathExposed:false', "FinanceImportDuplicateStrategy = 'skip'|'reject'",
    "FinanceImportAmountMode = 'signed'|'absolute_with_direction'|'debit_credit_columns'"
  ]));
  check('domain exposes explicit honest open banking boundary fields', includesAll(domain, [
    'FinanceOpenBankingBoundaryView', "adapterContract:'ohvps-v1-local'", "sandboxData:'synthetic_local'",
    "manualFallback:'controlled_file_import'", "liveBankConnection:'not_implemented'",
    "networkAccess:'not_performed'", "credentialCollection:'prohibited'", "externalConsent:'not_performed'"
  ]));
  check('application validates source mapping ownership money dates currencies and PAN-like text', includesAll(application, [
    'export class CommitFinanceImportBatchUseCase', "['csv','tsv','xlsx','ofx','qfx'].includes(command.sourceFormat)",
    'allowedMappingKeys', 'Object.keys(mappingRecord).every', 'new Set(selectedColumns).size === selectedColumns.length',
    "mappingRecord.amountMode === 'debit_credit_columns'", "mappingRecord.amountMode !== 'absolute_with_direction'",
    'command.totalRows > 5_000', 'finiteMoney(row.amount)', 'validPlanningCurrency(row.currency)',
    'containsLikelyFullPan(row.description)', 'containsLikelyFullPan(row.externalId)', 'scope.findPerson(ownerPersonId)',
    'scope.findPlanningCategoryForImport(categoryId)', 'category.kind !== row.direction'
  ]));
  check('application requires central exact finance create authorization', includesAll(application, [
    "action: 'create'", "capability: 'finance.write'", "resourceType: 'finance_record'",
    'scope.authorize({', 'resourceId: input.identifiers.batchId'
  ]));
  check('application enforces in-batch and persistent duplicate skip or reject', includesAll(application, [
    'const seenFingerprints = new Set<string>()', 'seenFingerprints.has(row.rowFingerprint)',
    'scope.hasImportedFingerprint(row.rowFingerprint)', "command.duplicateStrategy === 'reject'", 'else acceptedRows.push(row)'
  ]));
  check('application performs staging entries exact seal in one governed unit of work', includesAll(application, [
    "scope.insertImportBatch({ ...batchCommon, status: 'staging' })", 'scope.insertImportedCashFlow({',
    'scope.sealImportBatch(input.identifiers.batchId)', 'return this.unitOfWork.execute(input.context, intent'
  ]));
  check('application import event contains counts but no financial content or fingerprints', includesAll(importEventSlice, [
    'batchId:', 'ownerPersonId', 'sourceMode:', 'importedRows:', 'duplicateRows,', 'privacy:'
  ]) && !/(?:amount|description|externalId|rowFingerprint|fileSha256)\s*:/u.test(importEventSlice));
  check('repository contract binds batch entry category duplicate and exact seal ports', includesAll(repositoryContract, [
    'FinanceImportBatchRow', 'FinanceImportedCashFlowRow', 'listImportBatches', 'listImportedCashFlows',
    'findPlanningCategoryForImport', 'hasImportedFingerprint', 'insertImportBatch',
    'insertImportedCashFlow', 'sealImportBatch'
  ]));
  check('repository persists and reads only committed batches with exact write binding', includesAll(repository, [
    'const mapFinanceImportBatch', 'FROM finance_import_batches', "WHERE status='committed' AND family_id=?",
    'JOIN finance_import_batches batch ON batch.id=entry.batch_id', 'INSERT INTO finance_import_batches(',
    'INSERT INTO finance_import_entries(', "UPDATE finance_import_batches SET status='committed'",
    "financeWriteBinding(context, row.id, 'create')"
  ]));
  check('persistent duplicate lookup is scoped to the authorized family', includesAll(repository, [
    'WHERE family_id=? AND row_fingerprint=?', 'get(context.policyAuthorization.resourceFamilyId, fingerprint)'
  ]));
  check('sensitive inventory and person lifecycle include both import tables', includesAll(aiRepository, [
    'SELECT COUNT(*) FROM finance_import_batches', 'SELECT COUNT(*) FROM finance_import_entries'
  ]) && includesAll(personLifecycleRepository, ['financeImportBatches:', 'financeImportEntries:']));
  check('historical migration 82 remains exact through authorized successor migrations', Math.max(...migrationVersions) >= 83
    && migrations.includes("createMigrationDefinition(82, 'b4_controlled_import_open_banking', financeControlledImportOpenBankingSql)")
    && migrations.includes("createMigrationDefinition(83, 'b5_life_home_vehicle_managed_ledger'"));
  check('migration creates exactly two import tables with no prohibited columns', tableDefinitions.length === 2
    && persistedColumns.length > 30 && prohibitedPersistedColumns.length === 0);
  check('migration fixes supported sources duplicate strategy counts and synthetic truth', includesAll(importMigration, [
    "source_mode IN ('controlled_file','sandbox')", "source_format IN ('csv','tsv','xlsx','ofx','qfx','sandbox')",
    "duplicate_strategy IN ('skip','reject')", 'imported_rows+duplicate_rows=total_rows',
    "adapter_contract='ohvps-v1-local'", "network_access='not_performed'",
    "credential_exchange='not_performed'", "external_consent='not_performed'"
  ]));
  check('migration enforces persistent fingerprint uniqueness and category inheritance', includesAll(importMigration, [
    'UNIQUE(family_id,row_fingerprint)', 'trg_b4_finance_import_entry_parent_guard',
    'batch.owner_person_id=NEW.owner_person_id', 'batch.privacy=NEW.privacy',
    "category.item_type='category'", 'category.category_kind=NEW.direction'
  ]));
  check('migration requires exact receipt and rejects bidirectional finance replay', includesAll(importMigration, [
    'trg_b4_finance_import_batch_policy_receipt', "receipt.action='create'", "receipt.capability='finance.write'",
    "json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE NEW.privacy",
    'FROM finance_records WHERE policy_receipt_hash=NEW.policy_receipt_hash',
    'trg_b4_finance_record_import_receipt_reuse', 'trg_b4_finance_planning_import_receipt_reuse'
  ]));
  check('migration enforces complete exact seal and append-only entries', includesAll(importMigration, [
    'trg_b4_finance_import_batch_staging_guard', "NEW.status<>'staging'",
    'trg_b4_finance_import_batch_seal_guard', "OLD.status='staging' AND NEW.status='committed'",
    'finance_import_entries WHERE batch_id=OLD.id)=OLD.imported_rows',
    'trg_b4_finance_import_entry_immutable', 'trg_b4_finance_import_entry_delete_guard',
    'trg_b4_finance_import_batch_delete_guard'
  ]));
  check('parser applies file row column cell session and zip expansion bounds', includesAll(parser, [
    'MAX_FILE_BYTES = 5 * 1024 * 1024', 'MAX_ROWS = 5_000', 'MAX_COLUMNS = 64',
    'MAX_CELL_CHARACTERS = 2_000', 'SESSION_TTL_MS = 15 * 60 * 1_000', 'MAX_SESSIONS = 8',
    'entryCount > 128', 'uncompressedSize > 10 * 1024 * 1024', 'totalUncompressed > 20 * 1024 * 1024'
  ]));
  check('parser supports quoted CSV TSV XLSX CRC32 and OFX STMTTRN', includesAll(parser, [
    'const parseDelimited', 'const detectDelimiter', 'const crc32', 'const readZipEntries',
    'const parseXlsx', 'crc32(content) !== expectedCrc', 'const parseOfx', '<STMTTRN>'
  ]));
  check('XLSX parser fail-closes encryption formulas macros external links connections and XML entities', includesAll(parser, [
    '(flags & 1) !== 0', "![0,8].includes(method)", '/<!DOCTYPE|<!ENTITY/',
    'vbaProject\\.bin|externalLinks\\/|connections\\.xml', '/<f(?:\\s|\\/?>)/'
  ]));
  check('parser defines an explicit local adapter port with no network client', includesAll(parser, [
    'export interface FinanceOpenBankingAdapterPort', 'export class LocalOhvpsSandboxAdapter',
    "adapterContract = 'ohvps-v1-local'", "networkAccess = 'not_performed'",
    "credentialCollection = 'prohibited'", "externalConsent = 'not_performed'"
  ]) && !/(?:from ['"](?:node:)?https?|from ['"]undici|\bfetch\s*\()/u.test(parser));
  check('preview registry keeps file bytes main-only and returns bounded samples with truth flags', includesAll(parser, [
    'createFilePreview(input:', 'this.#sessions.set(previewId, session)', 'table.rows.slice(0, 20)',
    'rawFileRetained: false', 'filePathExposed: false', 'parsedRowsRetainedUntilExpiry: true',
    'sampleCellValuesExposed: true', 'public consume(previewId: string, ownerToken?: string)',
    'setTimeout(() => this.#deleteSession(previewId)', 'public dispose(): void'
  ]));
  check('production adapter filters import batches and entries through existing read policy', includesAll(adapter, [
    'listImportBatches(execution)', 'listImportedCashFlows(execution)', 'visibleImportBatches',
    'visibleImportedCashFlows', 'visibleImportBatchIds', 'row.familyId === context.familyId'
  ]));
  check('DataStore composes one shared import use case and stable family-owner row fingerprint', includesAll(dataStore, [
    'CommitFinanceImportBatchUseCase', '#commitFinanceImportBatchUseCase', 'public async commitFinanceImport(',
    "createHash('sha256').update(JSON.stringify({", 'familyId: context.familyId', 'ownerPersonId: input.ownerPersonId',
    'sourceFileSha256: input.fileSha256', 'sourceRowNumber: row.sourceRowNumber',
    'externalId: normalizeFingerprintText(row.externalId)', 'description: normalizeFingerprintText(row.description)'
  ]));
  check('main owns bounded file descriptor read path basename preview resolution and session consumption', includesAll(main, [
    "registerIpcHandler('finance:selectImportFile'", 'dialog.showOpenDialog({', 'const filePath = result.filePaths[0]',
    "openSync(filePath, 'r')", 'fstatSync(descriptor)', 'metadata.size > maximumBytes',
    'readSync(descriptor, bytes', 'closeSync(descriptor)', 'fileName: basename(filePath)',
    'ownerToken: financeImportSessionOwnerToken(event)', "registerIpcHandler('finance:previewOpenBankingSandbox'",
    "registerIpcHandler('finance:commitImportPreview'", 'financeImportFileSessions.resolve(input, new Date(), ownerToken)',
    'financeImportFileSessions.consume(input.previewId, ownerToken)', 'financeImportFileSessions.clear()',
    'financeImportFileSessions.dispose()'
  ]));
  check('IPC policy keeps selection and sandbox zero-argument and commit exact', includesAll(ipcPolicy, [
    "case 'finance:selectImportFile':", "case 'finance:previewOpenBankingSandbox':",
    'return zeroArguments(args);', "case 'finance:commitImportPreview':", 'return financeImportCommitInput(args);',
    'hasOnlyKeys(value', "['previewId','ownerPersonId','privacy','mapping','defaultCurrency','incomeCategoryId','expenseCategoryId','duplicateStrategy']"
  ]));
  check('preload and renderer declarations expose exactly three typed import methods', channels.every((channel) =>
    preload.includes(channel)) && methods.every((method) => declarations.includes(method)));
  check('Finance menu composes the import panel and refreshable workspace', includesAll(appRenderer, [
    'getFinancePlanningWorkspace()', '<FinancePlanningPanel'
  ]) && planningRenderer.includes('<FinanceImportPanel'));
  check('UI exposes all mappings duplicate policies categories preview and history', includesAll(importRenderer, [
    'FinanceImportPanel', 'selectFinanceImportFile()', 'previewOpenBankingSandbox()', 'commitFinanceImportPreview({',
    'dateColumn', 'descriptionColumn', 'amountColumn', 'debitColumn', 'creditColumn', 'directionColumn',
    'currencyColumn', 'externalIdColumn', "value=\"skip\"", "value=\"reject\"",
    'preview.sampleRows', 'workspace?.importBatches', 'workspace?.importedCashFlowEntries'
  ]));
  check('UI states synthetic local fallback and no live credentials consent or network truth', includesAll(importRenderer, [
    'Canlı banka bağlantısı yok', 'kimlik bilgisi, token veya harici onay toplanmaz',
    'Sentetik OHVPS sandbox', 'UTF-8 CSV/TSV/OFX/QFX ve XLSX', 'Ağ erişimi yapılmadı'
  ]));
  check('targeted tests cover application parser IPC persistence and duplicate paths', includesAll(applicationTest, [
    '33-D B4-13/B4-14 controlled import and local OHVPS boundary',
    'commits an exact append-only batch', 'rejects the whole batch', 'honest network-free adapter contract'
  ]) && includesAll(parserTest, [
    '33-D controlled finance import file session', 'reads OFX', 'bounded XLSX worksheet', 'rejects formulas'
  ]) && includesAll(ipcTest, [
    '33-D B4-13/B4-14 finance import IPC boundary', 'zero-argument', 'exact mapping contract'
  ]) && includesAll(dataStoreTest, [
    'B4-13/B4-14', 'finance_import_entries'
  ]));
  check('decision threat model audit and master register bind exact honesty boundary', includesAll(decision, [
    'DEC-215', 'FinanceOpenBankingAdapterPort', 'LocalOhvpsSandboxAdapter', 'Migration 82',
    "542'den 543'e", "274'ten 275'e", "PPK-022 238'den 242'ye"
  ]) && includesAll(threatModel, [
    'Dosya yolu veya ham banka ekstresinin renderer', 'zip-bomb', 'XLSX makro',
    'Aynı hareketin yeniden içe alınması', "Receipt'siz", 'Sentetik sandbox', 'Kimlik bilgisi/token'
  ]) && includesAll(auditDocument, [
    'B4-13', 'B4-14', '33-D-b4-controlled-import-open-banking-boundary.json',
    '33-D-b4-controlled-import-open-banking-contract.json', '33-D-b4-controlled-import-open-banking-runtime.json'
  ]) && includesAll(masterRegister, ['## DEC-215', 'DEC-215-b4-controlled-import-open-banking.md']));
  check('PPK-021 preserves the historical shared composition under the current exact 779 and 379 successor ratchet',
    astKeys.has('USE_CASE_COMPOSITION|apps/desktop/src/main/data-store.ts|CommitFinanceImportBatchUseCase')
    && astGate.status === 'PASS' && astGate.privilegedSurfaces === 873
    && astGate.exactAllowlistEntries === 873 && astGate.surfaceCounts?.USE_CASE_COMPOSITION === 431
    && astGate.directRoleAuthorizationBypasses === 0 && astGate.findings.length === 0);
  check('PPK-022 preserves historical bounded-read surfaces under current exact 345 successor ratchet', capabilityGate.status === 'PASS'
    && capabilityGate.capabilitySurfaces === 392 && capabilityGate.exactManifestSurfaces === 392
    && capabilityGate.findings.length === 0 && inventory.networkChannels?.length === 0);
  check('root lifecycle and explicit package scripts bind 33-D', ['pretypecheck','prebuild'].every((name) =>
    rootPackage.scripts?.[name]?.includes('verify-b4-controlled-import-open-banking-boundary.mjs'))
    && ['verify:b4-import:boundary','verify:b4-import:targeted','verify:b4-import:contract','verify:b4-import:runtime']
      .every((name) => typeof rootPackage.scripts?.[name] === 'string'));

  return Object.freeze({
    schemaVersion: 1,
    step: '33-D',
    requirements: Object.freeze(['B4-13','B4-14']),
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checksPassed: checks.filter((item) => item.passed).length,
    checksFailed: failures.length,
    checks: Object.freeze(checks),
    failures: Object.freeze(failures),
    latestDatabaseMigration: Math.max(...migrationVersions),
    importTables: tableDefinitions.length,
    persistedImportColumns: persistedColumns.length,
    prohibitedPersistedColumns: prohibitedPersistedColumns.length,
    supportedFileFormats: scope.controlledImport?.sourceFormats?.length ?? 0,
    liveBankConnectionImplemented: false,
    networkAccessPerformed: false,
    credentialsCollected: false,
    externalConsentPerformed: false,
    ppk021ExactAllowlistEntries: astGate.exactAllowlistEntries,
    ppk021UseCaseCompositionSurfaces: astGate.surfaceCounts?.USE_CASE_COMPOSITION,
    ppk022CapabilitySurfaces: capabilityGate.capabilitySurfaces,
    generatedAt: new Date().toISOString()
  });
};

const report = await verifyB4ControlledImportOpenBankingBoundary();
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/33-D-b4-controlled-import-open-banking-boundary.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`B4 controlled import open banking boundary: ${report.status} (${report.checksPassed}/${report.checks.length} checks).`);
if (report.failures.length) {
  console.error(report.failures.join('\n'));
  process.exitCode = 1;
}
