import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { scanDerivedDataPolicyBoundary } from './verify-derived-data-policy-boundary.mjs';

const checks = [];
const failures = [];
const check = (name, condition) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status });
  if (!condition) failures.push(name);
};

const sources = Object.fromEntries(await Promise.all(Object.entries({
  policy: 'packages/platform-policy/src/derived-data-inheritance-policy.ts',
  policyIndex: 'packages/platform-policy/src/index.ts',
  domain: 'packages/domain/src/derived-data-policy.ts',
  domainIndex: 'packages/domain/src/index.ts',
  useCase: 'packages/application/src/derived-data-inheritance-use-cases.ts',
  applicationIndex: 'packages/application/src/index.ts',
  repositoryContract: 'packages/repository-contracts/src/derived-data-policy-repository.ts',
  repositoryContractIndex: 'packages/repository-contracts/src/index.ts',
  repository: 'packages/repositories/src/derived-data-policy-repository.ts',
  repositoryIndex: 'packages/repositories/src/index.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  composition: 'apps/desktop/src/main/repository-composition-root.ts',
  main: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  global: 'apps/desktop/src/renderer/global.d.ts',
  renderer: 'apps/desktop/src/renderer/App.tsx',
  ipcPolicy: 'apps/desktop/src/main/ipc-integration-policy.ts',
  sensitiveCache: 'apps/desktop/src/main/ipc-read-sharing.ts',
  scanner: 'scripts/verify-derived-data-policy-boundary.mjs',
  familyImport: 'apps/desktop/src/main/family-data-import-service.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  fullBackupUseCase: 'packages/application/src/full-backup-file-use-cases.ts',
  fullBackupAdapter: 'apps/desktop/src/main/full-backup-file-application-adapter.ts',
  databaseExportBoundary: 'scripts/verify-build96-database-export-file-boundary.mjs',
  automationAdapter: 'apps/desktop/src/main/automation-application-adapter.ts',
  automationRepository: 'packages/repositories/src/automation-repository.ts',
  automationContract: 'packages/repository-contracts/src/automation-repository.ts',
  archiveAdapter: 'apps/desktop/src/main/archive-application-adapter.ts',
  archiveRepository: 'packages/repositories/src/platform-policy-transaction-repository.ts',
  archiveContract: 'packages/repository-contracts/src/platform-policy-transaction-repository.ts',
  ocrApplicationAdapter: 'apps/desktop/src/main/local-governed-ocr-application-adapter.ts',
  ocrUseCase: 'packages/application/src/local-governed-ocr-use-cases.ts',
  ocrRepository: 'packages/repositories/src/local-governed-ocr-repository.ts',
  ocrRuntimeAdapter: 'apps/desktop/src/main/local-governed-ocr-runtime-adapter.ts',
  ocrResultVault: 'apps/desktop/src/main/local-governed-ocr-result-vault.ts',
  package: 'package.json',
  runtime: 'scripts/verify-32-l-ppk-016-derived-data-policy-inheritance-runtime.mjs',
  targetedTest: 'apps/desktop/tests/ppk016-derived-data-policy-inheritance.test.ts',
  threatModel: 'docs/security/PPK-016_DERIVED_DATA_POLICY_INHERITANCE_THREAT_MODEL.md',
  decision: 'docs/decisions/DEC-197-ppk-016-derived-data-policy-inheritance.md',
  audit: 'docs/audit/32-L_PPK-016_TURETILMIS_VERI_POLITIKA_MIRASI_UST_KAPANIS.md'
}).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));

const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const requirement = registry.requirements.find((item) => item.id === 'PPK-016');
const scope = JSON.parse(await readFile('config/32-l-ppk-016-derived-data-policy-inheritance-scope.json', 'utf8'));
const inventory = JSON.parse(await readFile('config/32-l-ppk-016-derived-data-production-inventory.json', 'utf8'));
const inventoryById = new Map(inventory.productionInventory?.map((item) => [item.id, item]) ?? []);
const ledger = JSON.parse(await readFile('config/user-decision-ledger.json', 'utf8'));
const rootPackage = JSON.parse(sources.package);
const sourceScan = await scanDerivedDataPolicyBoundary();
const migrationStart = sources.migration.indexOf('const derivedDataPolicyInheritanceSql');
const migrationEnd = sources.migration.indexOf('export const FAMILY_DATABASE_MIGRATIONS', migrationStart);
const migrationSegment = migrationStart >= 0 && migrationEnd > migrationStart
  ? sources.migration.slice(migrationStart, migrationEnd)
  : '';
const storedBindingStart = sources.repository.indexOf('const assertStoredBindingRows =');
const storedBindingEnd = sources.repository.indexOf('const parseStoredBinding =', storedBindingStart);
const storedBindingSegment = storedBindingStart >= 0 && storedBindingEnd > storedBindingStart
  ? sources.repository.slice(storedBindingStart, storedBindingEnd)
  : '';
const upstreamLineageStart = sources.repository.indexOf('const assertSourceLineageBindings =');
const upstreamLineageEnd = sources.repository.indexOf('export class SqliteDerivedDataPolicyRepository', upstreamLineageStart);
const upstreamLineageSegment = upstreamLineageStart >= 0 && upstreamLineageEnd > upstreamLineageStart
  ? sources.repository.slice(upstreamLineageStart, upstreamLineageEnd)
  : '';
const upstreamPolicyStart = sources.repository.indexOf('const sourcePolicyNoBroaderThanUpstream =');
const upstreamPolicyEnd = sources.repository.indexOf('const assertAuthorizedTarget =', upstreamPolicyStart);
const upstreamPolicySegment = upstreamPolicyStart >= 0 && upstreamPolicyEnd > upstreamPolicyStart
  ? sources.repository.slice(upstreamPolicyStart, upstreamPolicyEnd)
  : '';
const findByHashStart = sources.repository.indexOf('public findByHash(');
const findByHashEnd = sources.repository.indexOf('public listBindingHashesBySource(', findByHashStart);
const findByHashSegment = findByHashStart >= 0 && findByHashEnd > findByHashStart
  ? sources.repository.slice(findByHashStart, findByHashEnd)
  : '';
const sourceLookupSegment = findByHashEnd >= 0 ? sources.repository.slice(findByHashEnd) : '';

check('derived kinds cover the ten accepted materialization classes', [
  'OCR_TEXT', 'SEARCH_INDEX', 'THUMBNAIL', 'AI_MEMORY', 'SUMMARY',
  'EMBEDDING', 'TRANSLATION', 'TRANSCRIPT', 'CACHE', 'REPLICA'
].every((marker) => sources.policy.includes(`'${marker}'`)));
check('production inventory records validated complete controls with zero open owner', inventory.schemaVersion === 1 && inventory.requirement === 'PPK-016' && inventory.status === 'COMPLETE' && inventory.completionClaimed === true && inventory.closureSummary?.finalValidationPending === false);
check('production inventory defines the governed materialization and five adjacent ownership classes', [
  'governedDerivedMaterialization', 'liveProjection', 'transactionJournal',
  'primaryRecord', 'operationalArtifact', 'wholeVaultBackup'
].every((key) => typeof inventory.definition?.[key] === 'string' && inventory.definition[key].length > 40));
check('production inventory has fourteen unique reviewed owners and one governed OCR owner', inventory.productionInventory?.length === 14 && inventoryById.size === 14 && inventory.closureSummary?.activeUngovernedDerivedPayloadOwners === 0 && inventory.closureSummary?.activeGovernedDerivedPayloadOwners === 1 && inventory.closureSummary?.retiredOrPayloadEliminatedCandidates === 3 && inventory.closureSummary?.classifiedAdjacentOwners === 10 && inventory.closureSummary?.closedContentFreeOrCurrentPepOwners === 3 && inventory.closureSummary?.openBlockerCount === 0 && inventory.closureSummary?.openBlockers?.length === 0 && inventory.closureSummary?.directPersistenceExceptions === 0);
const ocrOwner = inventoryById.get('local-ocr-sealed-result');
check('local OCR owner inventory binds the only writer metadata owner and main-only read chain', ocrOwner?.classification === 'GOVERNED_DERIVED_MATERIALIZATION' && ocrOwner?.disposition === 'SEALED_LOCAL_RESULT_EXACT_PPK016_BINDING' && ocrOwner?.derivedKind === 'OCR_TEXT' && ocrOwner?.derivedResourceType === 'local_ocr_result' && ocrOwner?.authorizedBindingWriterPath === 'apps/desktop/src/main/local-governed-ocr-application-adapter.ts' && ocrOwner?.authorizedSealedMetadataReaderPath === 'packages/repositories/src/local-governed-ocr-repository.ts' && ocrOwner?.authorizedSealedPayloadReadChain?.length === 2 && ocrOwner?.repositorySemanticPayloadFieldsAllowed === false);
check('three unsafe materialization candidates are retired or payload-eliminated', [
  ['latent-ai-timeline-memory', 'RETIRED_FROM_PUBLIC_PRODUCTION_SURFACE'],
  ['family-import-preview-cache', 'PAYLOAD_RETENTION_ELIMINATED'],
  ['plaintext-database-export', 'PLAINTEXT_REPLICA_RETIRED']
].every(([id, disposition]) => inventoryById.get(id)?.classification === 'GOVERNED_DERIVED_MATERIALIZATION_CANDIDATE' && inventoryById.get(id)?.disposition === disposition));
check('production owners retain an explicit candidate or adjacent classification', [
  ['protected-full-backup', 'WHOLE_VAULT_BACKUP'],
  ['operational-diagnostic-report-and-archive', 'OPERATIONAL_ARTIFACT'],
  ['renderer-read-projections', 'LIVE_PROJECTION'],
  ['data-repair-before-after-state', 'TRANSACTION_JOURNAL'],
  ['person-lifecycle-operation-state', 'TRANSACTION_JOURNAL'],
  ['family-import-batch-summary', 'TRANSACTION_JOURNAL'],
  ['automation-generated-life-task', 'PRIMARY_RECORD'],
  ['automation-run-ledger', 'TRANSACTION_JOURNAL'],
  ['archive-operation-result-ledger', 'TRANSACTION_JOURNAL'],
  ['system-health-history', 'OPERATIONAL_ARTIFACT']
].every(([id, classification]) => inventoryById.get(id)?.classification === classification));
check('automation life task run ledger and archive journal carry closed dispositions', [
  ['automation-generated-life-task', 'CLOSED_CONTENT_FREE_PRIMARY_RECORD_CURRENT_LIFE_PEP_REVALIDATED'],
  ['automation-run-ledger', 'CLOSED_CONTENT_FREE_LIFE_ONLY_LEDGER'],
  ['archive-operation-result-ledger', 'CLOSED_CONTENT_FREE_CURRENT_RECEIPT_CONFLICT_METADATA']
].every(([id, disposition]) => inventoryById.get(id)?.disposition === disposition));
check('protected backup and diagnostics are separate cryptographic boundaries not inheritance evidence', [
  inventoryById.get('protected-full-backup')?.control,
  inventoryById.get('operational-diagnostic-report-and-archive')?.control
].every((control) => typeof control === 'string' && control.includes('kriptografik') && control.includes('PPK-016 inheritance kanıtı değildir')));
check('AI timeline helper is absent from public domain exports and production use is fail-closed', !sources.domainIndex.includes("export * from './ai-memory.js'") && sources.scanner.includes("const RETIRED_AI_MEMORY_PRODUCER = 'packages/domain/src/ai-memory.ts'") && sources.scanner.includes('UNGOVERNED_AI_MEMORY_MODULE_USE') && sources.scanner.includes('UNGOVERNED_AI_MEMORY_PRODUCER_USE') && sources.scanner.includes("export { buildAiTimelineContext } from './ai-memory.js';"));
const cachedPreviewLease = /interface\s+CachedPreviewLease\s*\{(?<body>[\s\S]*?)\n\}/u.exec(sources.familyImport)?.groups?.body ?? '';
check('family import lease retains identity and digests but no semantic payload', cachedPreviewLease.length > 0 && ['familyId', 'actorId', 'sourcePath', 'sourceSize', 'sourceModifiedMs', 'sourceSha256', 'expiresAt', 'valid', 'targetIdSeed', 'planDigest'].every((field) => cachedPreviewLease.includes(`readonly ${field}:`)) && !/\b(?:preview|sourceText|document|plan)\s*:/u.test(cachedPreviewLease));
check('family import apply re-reads and revalidates source stat hash parse and plan', [
  'const sourceBuffer = readFileSync(cached.sourcePath)',
  'const afterReadStat = lstatSync(cached.sourcePath)',
  'sha256(sourceBuffer) !== cached.sourceSha256',
  'const reparsed = parseSourceDocument(',
  'preparedPlan.digest !== cached.planDigest',
  'currentPlan.digest !== cached.planDigest'
].every((marker) => sources.familyImport.includes(marker)) && sources.scanner.includes('DERIVED_CACHE_RETAINED_PAYLOAD') && sources.scanner.includes('DERIVED_CACHE_SOURCE_REVALIDATION_MISSING'));
check('plaintext database replica is rejected and legacy export delegates only to protected backup', sources.dataStore.includes('Korumasız .db dışa aktarımı yasaktır; yedek hedefi .pptbackup olmalıdır.') && sources.dataStore.indexOf("endsWith('.pptbackup')", sources.dataStore.indexOf('public exportBackup(destinationPath: string): void')) < sources.dataStore.indexOf('this.exportFullBackup(destinationPath)', sources.dataStore.indexOf('public exportBackup(destinationPath: string): void')) && sources.databaseExportBoundary.includes('production datastore does not compose the raw database exporter') && sources.scanner.includes('PLAINTEXT_REPLICA_MODULE_USE') && sources.scanner.includes('PLAINTEXT_REPLICA_SYMBOL_USE') && sources.scanner.includes('PLAINTEXT_REPLICA_DORMANT_ADAPTER_ACTIVE'));
check('whole-vault backup is pptbackup-only and encrypts the complete database with vault archive', sources.fullBackupUseCase.includes("endsWith('.pptbackup')") && sources.fullBackupUseCase.includes('input.password.length < 12') && sources.fullBackupAdapter.includes('database: databaseBytes.toString(\'base64\')') && sources.fullBackupAdapter.includes('vaultKey: keyBytes.toString(\'base64\')') && sources.fullBackupAdapter.includes('archive: files') && sources.fullBackupAdapter.includes('encryptFullBackupPayloadV3(payload, input.password, input.createdAt)'));
check('automation accepts only LIFE and revalidates its current policy source before generation', [
  "record.sourceType !== 'life_record'",
  "sourceType !== 'life_record'",
  "rule.sourceType !== 'life_record'",
  'PPK016_SOURCE_BINDING_REQUIRED',
  'PPK016_CURRENT_SOURCE_REVALIDATION_REQUIRED',
  'this.revalidateLifeSource(',
  'this.dependencies.lifePolicyTransactionRunner.execute('
].every((marker) => sources.automationAdapter.includes(marker)));
const generatedTaskStart = sources.automationAdapter.indexOf('private async createGeneratedTask(');
const generatedTaskEnd = sources.automationAdapter.indexOf('public async executeDueRules(', generatedTaskStart);
const generatedTaskSegment = generatedTaskStart >= 0
  ? sources.automationAdapter.slice(generatedTaskStart, generatedTaskEnd > generatedTaskStart ? generatedTaskEnd : undefined)
  : '';
check('generated LIFE task persists no source title or due-at semantic payload', generatedTaskSegment.includes('title: rule.title') && generatedTaskSegment.includes("notes: 'Otomatik oluşturuldu.'") && !/source\.(?:title|dueAt)/u.test(generatedTaskSegment));
check('automation run persistence contract and list projection are content-free', sources.automationContract.includes('interface AutomationRunLedgerRow') && sources.automationContract.includes('interface AutomationLifeRunCandidateRow') && !/interface AutomationRunLedgerRow[^}]*\b(?:title|dueAt)\b/su.test(sources.automationContract) && !/interface AutomationLifeRunCandidateRow[^}]*\b(?:title|dueAt)\b/su.test(sources.automationContract) && sources.automationRepository.includes("const REDACTED_RUN_TITLE = '__PPK016_SOURCE_CONTENT_REDACTED__'") && sources.automationRepository.includes('REDACTED_RUN_TITLE') && sources.automationRepository.includes('input.createdAt') && sources.automationRepository.includes('public listLifeRunCandidates(') && !sources.automationRepository.includes('public listNonLifeRuns('));
check('archive journal persists fixed completion metadata and never exposes semantic result JSON', sources.archiveRepository.includes(`const ARCHIVE_OPERATION_COMPLETION_JSON = '{"status":"completed"}'`) && sources.archiveRepository.includes('input.resultHash') && !sources.archiveRepository.includes('input.resultJson') && sources.archiveRepository.includes('public findArchiveOperationMetadata(') && !sources.archiveRepository.includes('public findArchiveOperation(') && sources.archiveContract.includes('readonly resultHash: string') && sources.archiveContract.includes("readonly status: 'completed'") && sources.archiveContract.includes('Semantic result replay is deliberately forbidden'));
const archiveResolveStart = sources.archiveRepository.indexOf('public resolveArchiveOperation(');
const archiveResolveEnd = sources.archiveRepository.indexOf('public recordArchiveOperationResult(', archiveResolveStart);
const archiveResolveSegment = archiveResolveStart >= 0
  ? sources.archiveRepository.slice(archiveResolveStart, archiveResolveEnd > archiveResolveStart ? archiveResolveEnd : undefined)
  : '';
check('archive retry requires a current persisted receipt and returns content-free conflict', archiveResolveSegment.includes('assertArchiveOperationResultAccessReceipt(context, currentReceiptRow)') && archiveResolveSegment.indexOf('assertArchiveOperationResultAccessReceipt(context, currentReceiptRow)') < archiveResolveSegment.indexOf("state: 'conflict'") && sources.archiveAdapter.includes("semanticReplay: 'forbidden'") && sources.archiveAdapter.includes("status: 'completed'") && !/\b(?:serializeArchiveOperationResult|deserializeArchiveOperationResult)\b/u.test(sources.archiveAdapter));
check('direct derived-data persistence exception registry is frozen and empty', sources.policy.includes('DERIVED_DATA_DIRECT_ACCESS_EXCEPTIONS = Object.freeze([] as const)'));
check('exactly one authorized repository adapter is declared', sources.policy.includes('DERIVED_DATA_AUTHORIZED_REPOSITORY_ADAPTERS') && sources.policy.includes("'packages/repositories/src/derived-data-policy-repository.ts'"));
check('exactly one OCR producer metadata owner and two-component main-only read chain are declared', sources.policy.includes('DERIVED_DATA_AUTHORIZED_PRODUCER_ADAPTERS') && sources.policy.includes("'apps/desktop/src/main/local-governed-ocr-application-adapter.ts'") && sources.policy.includes('DERIVED_DATA_AUTHORIZED_SEALED_METADATA_READERS') && sources.policy.includes("'packages/repositories/src/local-governed-ocr-repository.ts'") && sources.policy.includes('DERIVED_DATA_AUTHORIZED_SEALED_PAYLOAD_READ_PATHS') && ['packages/application/src/local-governed-ocr-use-cases.ts', 'apps/desktop/src/main/local-governed-ocr-runtime-adapter.ts'].every((path) => sources.policy.includes(`'${path}'`)));
check('OCR writer uses exact target receipt and central insertSealed path', ["targetIntent?.resourceType !== 'local_ocr_result'", 'targetIntent.sourceJobId !== primary.intent.resourceId', "binding.target.resourceType !== 'local_ocr_result'", 'binding.target.resourceId !== target.intent.resourceId', 'derivedDataPolicyRepository.insertSealed(target.repository, binding)'].every((marker) => sources.ocrApplicationAdapter.includes(marker)));
check('OCR metadata repository owns no plaintext bytes or path semantic fields', ['derived_binding_hash', 'sealed_result_id', 'result_content_sha256', 'assertPolicyAuthorizedRepositoryContext'].every((marker) => sources.ocrRepository.includes(marker)) && !/\b(?:result_text|ocr_text|raw_bytes|source_bytes|document_bytes|content_bytes|payload_json|file_path|source_path|vault_path)\b/iu.test(sources.ocrRepository));
const ocrReadStart = sources.ocrUseCase.indexOf('export class GetLocalGovernedOcrResultUseCase');
const ocrReadEnd = sources.ocrUseCase.indexOf('export class PropagateLocalGovernedOcrSourceDeletionUseCase', ocrReadStart);
const ocrReadSegment = ocrReadStart >= 0 && ocrReadEnd > ocrReadStart ? sources.ocrUseCase.slice(ocrReadStart, ocrReadEnd) : '';
check('OCR plaintext read stays in current-source authorized hash-verified main chain', ['resolveSourceAndConsent(', 'this.runtime.readSealedResult(', 'read.value.contentSha256 !== current.value.resultContentSha256', "action: 'ocr.result_read'"].every((marker) => ocrReadSegment.includes(marker)) && sources.ocrRuntimeAdapter.includes('public async readSealedResult(') && sources.ocrResultVault.includes('public read('));
check('source count and lineage depth are fail-closed bounded', sources.policy.includes('DERIVED_DATA_MAX_SOURCE_COUNT = 32') && sources.policy.includes('DERIVED_DATA_MAX_LINEAGE_DEPTH = 16'));
check('canonical ancestor closure is bounded to 512 and exposed by the content-free boundary', sources.policy.includes('DERIVED_DATA_MAX_ANCESTOR_COUNT = 512') && sources.policy.includes('ancestorByKey.size > DERIVED_DATA_MAX_ANCESTOR_COUNT') && sources.policy.includes("return deny('ANCESTOR_COUNT_EXCEEDED')") && sources.policy.includes('maximumAncestorCount: DERIVED_DATA_MAX_ANCESTOR_COUNT') && sources.domain.includes('readonly maximumAncestorCount: 512'));
check('target source and binding use exact canonical field sets', sources.policy.includes("exactKeys(input, ['target', 'sources'])") && sources.policy.includes('exactKeys(value, TARGET_KEYS)') && sources.policy.includes('exactKeys(value, SOURCE_KEYS)') && sources.policy.includes('exactKeys(value, BINDING_KEYS)'));
check('source snapshot binds content receipt context request and policy package hashes', ['contentSha256', 'receiptHash', 'contextHash', 'requestHash', 'policyPackageSha256'].every((marker) => sources.policy.includes(marker)));
check('inactive receipt fails closed before policy inheritance', sources.policy.includes("return deny('SOURCE_RECEIPT_INACTIVE')") && sources.policy.indexOf('SOURCE_RECEIPT_INACTIVE') < sources.policy.indexOf('const effectivePolicy'));
check('duplicate self cyclic excessive lineage and ancestor fan-out fail closed', ['DUPLICATE_SOURCE', 'SELF_REFERENCE', 'CYCLIC_LINEAGE', 'LINEAGE_DEPTH_EXCEEDED', 'ANCESTOR_COUNT_EXCEEDED'].every((marker) => sources.policy.includes(`'${marker}'`)));
check('family policy version and package hash mismatches fail closed', ['FAMILY_MISMATCH', 'POLICY_VERSION_MISMATCH', 'POLICY_PACKAGE_HASH_MISMATCH'].every((marker) => sources.policy.includes(`'${marker}'`)));
check('effective sensitivity is the maximum source sensitivity', sources.policy.includes('SENSITIVITY_ORDER[source.sensitivity] > SENSITIVITY_ORDER[highest]'));
check('effective data classes are the source union', sources.policy.includes('unionDataClasses(sources)') && sources.policy.includes('new Set(sources.flatMap'));
check('all five access dimensions use source intersections', ['allowedAccountIds', 'allowedApplicationIds', 'allowedCapabilities', 'allowedActions', 'allowedPurposes'].every((marker) => sources.policy.includes(`${marker}: intersection(`)));
check('an empty source access intersection fails closed', sources.policy.includes("return deny('SOURCE_ACCESS_INTERSECTION_EMPTY')"));
check('effective obligations are the source union', sources.policy.includes('unionObligations(sources)') && sources.policy.includes('sources.flatMap((source) => source.obligations)'));
check('effective retention is the earliest finite source boundary', sources.policy.includes('earliestRetention(sources)') && sources.policy.includes("[...finite].sort()[0]"));
check('target sensitivity and data-class downgrades fail closed', sources.policy.includes("return deny('SENSITIVITY_DOWNGRADE')") && sources.policy.includes("return deny('DATA_CLASS_DOWNGRADE')"));
check('every target access broadening dimension fails closed', ['ACCOUNT_ACCESS_BROADENED', 'APPLICATION_ACCESS_BROADENED', 'CAPABILITY_ACCESS_BROADENED', 'ACTION_ACCESS_BROADENED', 'PURPOSE_ACCESS_BROADENED'].every((marker) => sources.policy.includes(`'${marker}'`)));
check('obligation and retention broadening fail closed', sources.policy.includes("return deny('OBLIGATION_DOWNGRADE')") && sources.policy.includes("return deny('RETENTION_BROADENED')"));
check('source-set and complete binding are SHA-256 bound', sources.policy.includes('const sourceSetHash = digest(') && sources.policy.includes('bindingHash: digest(bindingPayload)'));
check('binding verification recomputes and compares both hashes', sources.policy.includes("return deny('SOURCE_SET_HASH_MISMATCH')") && sources.policy.includes("return deny('BINDING_HASH_MISMATCH')"));
check('canonical binding ordering uses locale-independent text comparison', sources.policy.includes('const compareCanonicalText') && sources.policy.includes('left < right ? -1 : left > right ? 1 : 0') && !sources.policy.includes('.localeCompare(') && sources.repository.includes('const compareCanonicalText') && !sources.repository.includes('.localeCompare('));
check('boundary snapshot exposes fail-closed content-free truth only', ['sourcePolicyIntersectionRequired: true', 'sensitivityDowngradeAllowed: false', 'accessBroadeningAllowed: false', 'payloadExposed: false', 'persistentPathExposed: false', 'secretMaterialExposed: false', 'cutoverAuthorityAttached: false'].every((marker) => sources.policy.includes(marker)));
check('platform policy exports derived-data inheritance', sources.policyIndex.includes("export * from './derived-data-inheritance-policy.js'"));

check('domain defines a typed content-free PPK-016 boundary view', sources.domain.includes('interface DerivedDataPolicyBoundaryView') && sources.domain.includes("readonly enforcement: 'fail-closed'") && sources.domain.includes('readonly directAccessExceptionCount: 0'));
check('domain exports the derived-data policy view', sources.domainIndex.includes("export * from './derived-data-policy.js'"));
check('application use case requires a persistence port', sources.useCase.includes('DerivedDataInheritancePersistencePort') && sources.useCase.includes('private readonly persistence: DerivedDataInheritancePersistencePort'));
check('application use case evaluates and verifies before persistence', sources.useCase.indexOf('this.policy.evaluate') < sources.useCase.indexOf('this.policy.verify') && sources.useCase.indexOf('this.policy.verify') < sources.useCase.indexOf('this.persistence.persist'));
check('application use case persists before opening the producer operation', sources.useCase.indexOf('this.persistence.persist') < sources.useCase.indexOf('return input.operation'));
check('application use case has no optional persistence bypass', !/persist\??\s*:/u.test(sources.useCase) && !sources.useCase.includes('persist !== false'));
check('application exports inheritance and boundary use cases', sources.applicationIndex.includes("export * from './derived-data-inheritance-use-cases.js'"));

check('repository contract requires policy-authorized transaction context', sources.repositoryContract.includes('PolicyAuthorizedRepositoryExecutionContext') && sources.repositoryContract.includes('DerivedDataPolicyRepositoryPort'));
check('repository contract exposes sealed insert target-authorized full lookup and hash-only source lookup', ['insertSealed(', 'findByHash(', 'listBindingHashesBySource('].every((marker) => sources.repositoryContract.includes(marker)) && sources.repositoryContract.includes('RepositoryResult<readonly string[]>'));
check('repository contract and implementation are exported', sources.repositoryContractIndex.includes("export * from './derived-data-policy-repository.js'") && sources.repositoryIndex.includes("export * from './derived-data-policy-repository.js'"));
check('repository validates canonical binding and source-set hashes', sources.repository.includes('DERIVED_DATA_POLICY_BINDING_HASH_MISMATCH') && sources.repository.includes('DERIVED_DATA_POLICY_SOURCE_SET_HASH_MISMATCH'));
check('repository binds receipt context request and policy package metadata', ['snapshot.receiptHash', 'snapshot.contextHash', 'snapshot.requestHash', 'snapshot.policyPackageSha256'].every((marker) => sources.repository.includes(marker)));
check('repository rejects future or more than 30000 ms old source receipts at creation', sources.repository.includes('SOURCE_RECEIPT_MAX_AGE_MS = 30_000') && sources.repository.includes('ageMs < 0 || ageMs > SOURCE_RECEIPT_MAX_AGE_MS') && sources.repository.includes('DERIVED_DATA_POLICY_SOURCE_RECEIPT_STALE'));
check('repository revalidates complete producer and source receipt provenance at read time', [
  'const readVerifiedReceipt =',
  'computePlatformPolicyReceiptHash(',
  'computedReceiptHash !== receiptHash',
  "canonicalJson(receiptRecord) !== String(row.record_json)",
  'decision.allowed !== true',
  'const assertProducerReceipt =',
  'const assertSourceReceipt =',
  'assertProducerReceipt(database, target, row)',
  'const receiptIssuedAt = assertSourceReceipt(database, snapshot)'
].every((marker) => sources.repository.includes(marker)) && sources.repository.includes("label: 'source' | 'producer'") && sources.repository.includes('RECEIPT_ENVELOPE_MISMATCH'));
check('both read APIs require current PEP before returning recursively verified stored bindings', findByHashSegment.indexOf('assertAuthorizedTarget(context, normalized.binding.target)') >= 0 && findByHashSegment.indexOf('assertAuthorizedTarget(context, normalized.binding.target)') < findByHashSegment.indexOf('assertStoredBindingRows(database, normalized, row)') && sourceLookupSegment.indexOf('assertAuthorizedSourceLookup(context, source.snapshot)') >= 0 && sourceLookupSegment.indexOf('assertAuthorizedSourceLookup(context, source.snapshot)') < sourceLookupSegment.indexOf('assertStoredBindingRows(database, normalized, row)'));
check('read-back revalidates source-to-producer creation chronology without treating history as current authority', storedBindingSegment.includes('Date.parse(String(row.created_at)) - Date.parse(receiptIssuedAt)') && storedBindingSegment.includes('authorizationAgeMs < 0 || authorizationAgeMs > SOURCE_RECEIPT_MAX_AGE_MS') && storedBindingSegment.includes('DERIVED_DATA_POLICY_STORED_SOURCE_RECEIPT_STALE'));
check('repository resolves every derived source through exactly one sealed recursive upstream binding', [
  'derived_resource_type=?',
  'derived_resource_id=?',
  'derived_resource_version=?',
  'upstreamRows.length === 0',
  'upstreamRows.length !== 1',
  "upstreamRow.status !== 'sealed'",
  'upstreamRow.content_sha256 !== snapshot.contentSha256',
  'upstreamRow.family_id !== snapshot.familyId',
  'assertStoredBindingRows(database, upstream, upstreamRow, traversal)',
  'DERIVED_DATA_POLICY_PRIMARY_SOURCE_LINEAGE_MISMATCH',
  'DERIVED_DATA_POLICY_SOURCE_UPSTREAM_AMBIGUOUS',
  'DERIVED_DATA_POLICY_SOURCE_UPSTREAM_MISMATCH',
  'DERIVED_DATA_POLICY_SOURCE_UPSTREAM_TARGET_MISMATCH',
  'DERIVED_DATA_POLICY_SOURCE_LINEAGE_MISMATCH'
].every((marker) => upstreamLineageSegment.includes(marker)));
check('historical upstream policy rotation uses monotonic semantics rather than exact version equality', [
  'UPSTREAM_SENSITIVITY_ORDER[source.sensitivity] >= UPSTREAM_SENSITIVITY_ORDER[upstream.sensitivity]',
  'containsEveryString(source.dataClasses, upstream.dataClasses)',
  'containsEveryString(upstream.allowedAccountIds, source.allowedAccountIds)',
  'containsEveryString(upstream.allowedApplicationIds, source.allowedApplicationIds)',
  'containsEveryString(upstream.allowedCapabilities, source.allowedCapabilities)',
  'containsEveryString(upstream.allowedActions, source.allowedActions)',
  'containsEveryString(upstream.allowedPurposes, source.allowedPurposes)',
  'containsEveryObligation(source.obligations, upstream.obligations)',
  'retentionNoBroaderThanUpstream(source.retentionUntil, upstream.retentionUntil)'
].every((marker) => upstreamPolicySegment.includes(marker)) && !upstreamPolicySegment.includes('policyVersion') && !upstreamPolicySegment.includes('policyPackageSha256') && upstreamLineageSegment.includes('DERIVED_DATA_POLICY_SOURCE_UPSTREAM_POLICY_BROADENED'));
check('stored recursive lineage traversal is independently bounded to 512 distinct bindings', sources.repository.includes('DERIVED_DATA_MAX_ANCESTOR_COUNT') && storedBindingSegment.includes('...traversal.activePath') && storedBindingSegment.includes('...traversal.validated') && storedBindingSegment.includes('DERIVED_DATA_POLICY_STORED_ANCESTOR_COUNT_EXCEEDED'));
check('repository writes pending metadata sources then seals exactly once', sources.repository.indexOf("'pending'") < sources.repository.indexOf('INSERT INTO derived_data_policy_sources') && sources.repository.indexOf('INSERT INTO derived_data_policy_sources') < sources.repository.indexOf("SET status='sealed'") && sources.repository.includes('Number(sealed.changes) !== 1'));
check('repository never exposes or stores derived payload and vault paths', !/\b(?:payload|ocrText|filePath|vaultPath|secretMaterial)\b/u.test(sources.repository));
check('Desktop composition root owns the single concrete repository instance', sources.composition.includes('SqliteDerivedDataPolicyRepository') && sources.composition.includes('derivedDataPolicyRepository: new SqliteDerivedDataPolicyRepository(repositoryOptions)'));

check('migration 77 creates strict binding and source metadata tables', sources.migration.includes("createMigrationDefinition(77, 'ppk016_derived_data_policy_inheritance'") && migrationSegment.includes('CREATE TABLE derived_data_policy_bindings(') && migrationSegment.includes('CREATE TABLE derived_data_policy_sources(') && (migrationSegment.match(/\) STRICT;/gu)?.length ?? 0) >= 2);
check('migration 77 binds producer and source receipts with restrictive foreign keys', migrationSegment.includes('producer_receipt_hash') && migrationSegment.includes('policy_receipt_hash') && (migrationSegment.match(/REFERENCES platform_policy_transaction_receipts/gu)?.length ?? 0) >= 2 && migrationSegment.includes('ON DELETE RESTRICT'));
check('migration 77 receipt trigger binds exact source identity context request and package', ['receipt.resource_type=NEW.source_resource_type', 'receipt.resource_id=NEW.source_resource_id', 'receipt.request_hash=NEW.request_hash', 'receipt.context_hash=NEW.context_hash', 'receipt.policy_package_sha256=NEW.policy_package_sha256'].every((marker) => migrationSegment.includes(marker)));
check('migration 77 starts pending and seals only with a complete source set', migrationSegment.includes('trg_ppk016_derived_binding_pending_insert') && migrationSegment.includes('trg_ppk016_derived_binding_seal_complete') && migrationSegment.includes("source_count INTEGER NOT NULL"));
check('migration 77 independently binds producer time and the 30000 ms source receipt window', migrationSegment.includes('receipt.issued_at=NEW.created_at') && migrationSegment.includes('julianday(binding.created_at)>=julianday(NEW.authorized_at)') && migrationSegment.includes('86400000<=30000') && migrationSegment.includes('receipt.issued_at=NEW.authorized_at'));
check('migration 77 blocks sensitivity and data-class downgrade while sealing', migrationSegment.includes("WHEN 'highly_sensitive' THEN 4") && migrationSegment.includes('json_each(source.data_classes_json)'));
check('sealed binding and all source rows are immutable', ['trg_ppk016_derived_binding_sealed_update', 'trg_ppk016_derived_binding_sealed_delete', 'trg_ppk016_derived_source_update', 'trg_ppk016_derived_source_delete'].every((marker) => migrationSegment.includes(marker)));
check('migration 77 stores metadata only with no payload path or secret columns', !/\b(?:payload|file_path|vault_path|secret_material|private_key)\b/iu.test(migrationSegment));

check('main process exposes only the typed boundary snapshot', sources.main.includes("registerIpcHandler('system:getDerivedDataPolicyBoundary'") && sources.main.includes('getDerivedDataPolicyBoundaryUseCase.execute()'));
check('preload and renderer declaration expose typed status only', sources.preload.includes('getDerivedDataPolicyBoundary') && sources.global.includes('getDerivedDataPolicyBoundary():Promise<DerivedDataPolicyBoundaryView>'));
check('IPC integration policy requires zero arguments for PPK-016 status', sources.ipcPolicy.includes("case 'system:getDerivedDataPolicyBoundary':") && sources.ipcPolicy.includes('return zeroArguments(args)'));
check('PPK-016 status is security-posture no-cache', sources.sensitiveCache.includes('IPC_SECURITY_POSTURE_NO_CACHE_CHANNELS') && sources.sensitiveCache.includes("'system:getDerivedDataPolicyBoundary'"));
check('generic derived renderer projections are explicitly no-cache', sources.sensitiveCache.includes('IPC_DERIVED_DATA_NO_CACHE_CHANNELS') && ['catalog:listPeople', 'catalog:listEvents', 'catalog:lookup', 'largeData:tree', 'largeData:archive', 'genealogy:insights', 'archive:versions', 'archive:search'].every((marker) => sources.sensitiveCache.includes(`'${marker}'`)));
check('PPK-012 lease-controlled sensitive cache remains active', sources.sensitiveCache.includes('OfflineSensitiveCacheRegistry') && sources.sensitiveCache.includes('OfflineCapabilityLeasePolicy'));
check('System UI renders fail-closed PPK-016 posture without content', sources.renderer.includes('PPK-016 · türetilmiş veri güvenliği') && sources.renderer.includes('Fail-closed politika mirası etkin') && sources.renderer.includes('directAccessExceptionCount'));
check('profile menu exposes the derived-data security entry', sources.renderer.includes('Türetilmiş veri güvenliği'));

check('source gate scans every production app and package source zone', sources.scanner.includes("for (const parent of ['apps', 'packages'])") && sources.scanner.includes('scanDerivedDataPolicyBoundary'));
check('source gate blocks SQL adapter primitive and direct-write bypasses', ['DERIVED_BINDING_SQL_OUTSIDE_AUTHORIZED_OWNER', 'DERIVED_REPOSITORY_IMPORT_OUTSIDE_COMPOSITION', 'DERIVED_REPOSITORY_CONCRETE_SYMBOL_OUTSIDE_COMPOSITION', 'DERIVED_PERSISTENCE_PRIMITIVE_OUTSIDE_REPOSITORY', 'DERIVED_BINDING_DIRECT_WRITE_OUTSIDE_REPOSITORY'].every((marker) => sources.scanner.includes(marker)));
check('source gate exposes one exact OCR producer and blocks no-op enforcement composition', sources.scanner.includes('AUTHORIZED_ENFORCEMENT_USE_CASE_USERS') && sources.scanner.includes('DERIVED_ENFORCEMENT_USE_CASE_OUTSIDE_AUTHORIZED_COMPOSITION') && sources.scanner.includes('authorizedProducerAdapters: 1') && sources.scanner.includes('OCR_PPK016_EXACT_WRITER_FENCE_MISSING'));
check('source gate permits only the exact policy adapter registry literal and still rejects policy imports', sources.scanner.includes('authorizedPolicyRegistryLiteral') && sources.scanner.includes('normalizedPath === GOVERNED_POLICY') && sources.scanner.includes('value === AUTHORIZED_REPOSITORY') && sources.scanner.includes("'DERIVED_REPOSITORY_IMPORT_OUTSIDE_COMPOSITION', GOVERNED_POLICY"));
const maliciousSelfTestSegment = sources.scanner.slice(
  sources.scanner.indexOf('const maliciousCases = ['),
  sources.scanner.indexOf('const failures = maliciousCases', sources.scanner.indexOf('const maliciousCases = ['))
);
check('source gate carries twenty-seven malicious core cases plus metadata-reader cases and six benign cases', [
  'INSERT INTO derived_data_policy_bindings',
  'SELECT * FROM derived_data_policy_sources',
  "from './derived-data-policy-repository.js'",
  "from '@ppt/repositories'",
  "from 'node:sqlite'",
  'const insertSealed =',
  'DELETE FROM derived_data_policy_bindings',
  'new SqliteDerivedDataPolicyRepository',
  "padded + './derived-data-policy-repository.js'",
  "adapterName = 'SqliteDerivedDataPolicyRepository'",
  'new EnforceDerivedDataInheritanceUseCase',
  "export { buildAiTimelineContext } from './ai-memory.js';",
  'buildAiTimelineContext(actor, events)',
  'ExportDatabaseFileUseCase',
  'FileSystemDatabaseExportFilePort',
  'readonly sourceText: string',
  'copyFileSync(input.sourcePath, input.destinationPath)',
  'return source.title',
  'return input.dueAt',
  'deserializeArchiveOperationResult(context, resultJson)',
  'SELECT result_json FROM platform_policy_archive_operations',
  'INSERT INTO automation_runs(title,due_at) VALUES(?,?)',
  "const sql = 'SELECT result_json FROM platform_policy_archive_operations'",
  'UPDATE local_governed_ocr_jobs SET sealed_result_id',
  'INSERT INTO local_governed_ocr_jobs(id,result_text)',
  'public insertDerivedBinding()',
  'runtime.readSealedResult'
].every((marker) => sources.scanner.includes(marker)) && [
  'const cache = new Map',
  'values.findIndex',
  'Önizleme hazır',
  'family-search-index'
].every((marker) => sources.scanner.includes(marker)) && (maliciousSelfTestSegment.match(/^\s*\[/gmu)?.length ?? 0) === 27);
check('current production source includes OCR integration files and has zero boundary finding', sourceScan.relevantFiles >= 39 && sourceScan.findings.length === 0);
check('typecheck and build both execute the PPK-016 source gate', rootPackage.scripts?.pretypecheck?.includes('verify-derived-data-policy-boundary.mjs') && rootPackage.scripts?.prebuild?.includes('verify-derived-data-policy-boundary.mjs'));
check('targeted tests cover inheritance downgrade lineage tamper ancestor overflow and operation ordering', ['SENSITIVITY_DOWNGRADE', 'DATA_CLASS_DOWNGRADE', 'SOURCE_ACCESS_INTERSECTION_EMPTY', 'OBLIGATION_DOWNGRADE', 'RETENTION_BROADENED', 'FAMILY_MISMATCH', 'POLICY_PACKAGE_HASH_MISMATCH', 'SOURCE_RECEIPT_INACTIVE', 'DUPLICATE_SOURCE', 'SELF_REFERENCE', 'CYCLIC_LINEAGE', 'LINEAGE_DEPTH_EXCEEDED', 'ANCESTOR_COUNT_EXCEEDED', 'SOURCE_SET_HASH_MISMATCH', 'BINDING_HASH_MISMATCH', 'not.toHaveBeenCalled', "expect(order).toEqual(['persist', 'operation'])"].every((marker) => sources.targetedTest.includes(marker)));
check('targeted tests exercise real migration 77 repository sealing hash-only lookup and immutable reads', ['DatabaseSync', 'SqliteDerivedDataPolicyRepository', 'pending-source-sealed', 'listBindingHashesBySource', 'source hash lookup current policy context', 'sealed derived data policy binding is immutable', 'source JSON does not match structural metadata'].every((marker) => sources.targetedTest.includes(marker)));
check('targeted tests cover future stale exact-30000ms receipt boundaries and producer time mismatch', ['future issued-at', 'stale issued-at', 'tam 30.000 ms tazelik sınırını kabul eder', 'producer issued-at', "authorized_at: '2026-08-11T12:00:01.000Z'"].every((marker) => sources.targetedTest.includes(marker)));
check('runtime requires the expanded PPK-016 targeted tests', sources.runtime.includes("id: 'ppk-016-targeted-policy-use-case-schema'") && sources.runtime.includes('minimumTests: 77'));
check('targeted tests prove the exact 512 allow and 513 ancestor rejection boundary', sources.targetedTest.includes('birleşik ata kümesinde 512 kaydı kabul, 513 kaydı fail-closed reddeder') && sources.targetedTest.includes('ancestors(DERIVED_DATA_MAX_ANCESTOR_COUNT - 1)') && sources.targetedTest.includes('ancestors(DERIVED_DATA_MAX_ANCESTOR_COUNT)'));
check('targeted tests reject producer and source provenance tamper through both read APIs', ['producer hash işaretçisi', 'signed producer receipt hashı', 'producer allowed subject', 'producer created-at', 'diskte kaynak authorized-at/receipt zamanı pencere dışına taşınırsa read-back reddeder', 'expectRuntimeBindingReadRejected', 'expectRuntimeSourceLookupRejected'].every((marker) => sources.targetedTest.includes(marker)));
check('targeted tests prove exact upstream reset rejection and safe monotonic policy-package rotation', ['mühürlü upstream soyunu exact bağlar ve daha gevşek olmayan güncel politika paketi rotasyonuna izin verir', 'tarihsel upstream target effective politikadan daha sıkıysa current source gevşetmesini reddeder', 'geçerli PEP makbuzuyla historical offline no_export yükümlülüğünü current online kaynakta düşürmeyi reddeder', 'diskte downstream soy metadata reseti yapıldığında read-back upstream bağıyla yeniden doğrular'].every((marker) => sources.targetedTest.includes(marker)));
check('targeted tests prove Unicode input-order invariant source-set and binding hashes', ['deterministik canonical hash', 'Unicode kimlik ve amaçlarda giriş sırası değişse de aynı source-set ve binding hashini üretir', 'expect(second.binding.sourceSetHash).toBe(first.binding.sourceSetHash)', 'expect(second.binding.bindingHash).toBe(first.binding.bindingHash)'].every((marker) => sources.targetedTest.includes(marker)));
check('threat model records protected boundary threats controls exclusions and reality', ['Korunan sınır', 'Güven varsayımları', 'Tehditler ve kontroller', 'Kapsam dışı'].every((marker) => sources.threatModel.includes(marker)));
check('scope and accepted registry bind the canonical completed production inventory', scope.productionInventory === 'config/32-l-ppk-016-derived-data-production-inventory.json' && requirement?.status === 'COMPLETE' && !Object.hasOwn(requirement ?? {}, 'implementationState') && requirement?.evidence?.includes('config/32-l-ppk-016-derived-data-production-inventory.json'));
check('governance documents distinguish retained materialization from all five adjacent classes', [sources.decision, sources.threatModel, sources.audit].every((document) => [
  'retained/reusable semantic materialization',
  'LIVE_PROJECTION',
  'TRANSACTION_JOURNAL',
  'PRIMARY_RECORD',
  'OPERATIONAL_ARTIFACT',
  'WHOLE_VAULT_BACKUP'
].every((marker) => document.includes(marker))));
check('governance documents record AI import-cache raw-replica and protected-backup controls', [sources.decision, sources.threatModel, sources.audit].every((document) => ['buildAiTimelineContext', 'Family-import', '.db', '.pptbackup'].every((marker) => document.includes(marker))));
check('governance documents record content-free automation/archive closure and reject cryptographic boundary as inheritance proof', [sources.decision, sources.threatModel, sources.audit].every((document) => ['content-free', 'LIFE PEP', 'resultHash', 'PPK-016 inheritance kanıtı değildir'].every((marker) => document.includes(marker))) && scope.remediationState === 'VALIDATED_COMPLETE' && scope.knownOpenProductionPaths?.length === 0);
check('scope records validated read-time provenance exact lineage monotonic rotation and 512 traversal boundaries', scope.boundaries?.readTimeProducerReceiptProvenanceRequired === true && scope.boundaries?.readTimeSourceReceiptProvenanceRequired === true && scope.boundaries?.creationChronologyRevalidatedAtRead === true && scope.boundaries?.currentPepRequiredAtRead === true && scope.boundaries?.monotonicUpstreamPolicyRequired === true && scope.boundaries?.historicalPolicyVersionPackageExactMatchRequired === false && scope.boundaries?.exactRecursiveUpstreamLineageRequired === true && scope.boundaries?.ambiguousUpstreamRejected === true && scope.boundaries?.maximumAncestorCount === 512 && scope.boundaries?.maximumStoredLineageTraversalCount === 512 && scope.status === 'COMPLETED' && scope.validation?.state === 'COMPLETE' && scope.validation?.finalValidationRecorded === true && scope.validation?.finalEvidence?.targetedTestsPassed === 75 && scope.validation?.finalEvidence?.fullVitestFilesPassed === 66 && scope.validation?.finalEvidence?.fullVitestTestsPassed === 540 && scope.validation?.finalEvidence?.rootTypeScriptDiagnostics === 0 && scope.validation?.finalEvidence?.sourceGateFindings === 0 && scope.validation?.finalEvidence?.finalClosureEvidence === true && scope.remainingClosureWork?.length === 0 && scope.requirementCompletionClaimed === true);
check('decision threat model and audit distinguish historical provenance from current PEP and record validated exact upstream limits', [sources.decision, sources.threatModel, sources.audit].every((document) => ['producer', 'source receipt', 'exactly-one', 'current', '512'].every((marker) => document.includes(marker))) && sources.decision.includes('gereksinim `COMPLETE`') && sources.threatModel.includes('VALIDATED / COMPLETE') && sources.audit.includes('COMPLETE / PASS'));
check('audit records the complete executed validation matrix without expanding the reality boundary', ['75/75', '66/66 dosya', '540/540', '23/23 kötü niyetli', '4/4 iyi huylu', '0 bulgu', '18 workspace', '14/14', '83 tablo', '9/9', '6/6', '8/8', '37/37', '10/10', '90/90', '69/69', '9 dosya/105 test', '533 kontrol/18 workspace', '435/135', '499 kontrol/18 workspace', '278 kontrol/51 karar', 'diff-check temiz'].every((marker) => sources.audit.includes(marker)) && sources.audit.includes('gerçek veri taşıma/backfill') && sources.audit.includes('SQLite sahiplik aktarımı'));
check('runtime evidence plan names the new provenance lineage rotation and ancestor boundaries', ['READ_TIME_PRODUCER_SOURCE_RECEIPT_PROVENANCE', 'READ_TIME_CREATION_CHRONOLOGY_REVALIDATION', 'CURRENT_PEP_HISTORICAL_RECEIPT_NOT_GRANT', 'EXACT_RECURSIVE_UPSTREAM_LINEAGE', 'MONOTONIC_UPSTREAM_POLICY_ROTATION', 'MAXIMUM_512_ANCESTOR_AND_STORED_TRAVERSAL'].every((marker) => sources.runtime.includes(`'${marker}'`)));

check('accepted registry closes the complete PPK-016 evidence chain', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true));
check('scope preserves migration 77 foundation and integrates migration 94 OCR owner without transfer backfill or cutover', scope.status === 'COMPLETED' && scope.boundaries?.migrationVersion === 77 && scope.boundaries?.latestIntegratedMigrationVersion === 94 && scope.boundaries?.payloadPersistenceAllowed === true && scope.boundaries?.currentDerivedPayloadOwnerExists === true && scope.boundaries?.authorizedDerivedProducerAdapterCount === 1 && scope.boundaries?.authorizedSealedMetadataReaderCount === 1 && scope.boundaries?.authorizedSealedPayloadReadChainComponentCount === 2 && scope.boundaries?.localOcrDerivedResultBindingIntegrated === true && scope.requirementCompletionClaimed === true && scope.realDataTransferPerformed === false && scope.realDataBackfillPerformed === false && scope.sqliteOwnershipTransferred === false && scope.cutoverAuthorityAttached === false);
check('scope records the current OCR integration validation without rewriting historical closure evidence', scope.validation?.currentLocalOcrIntegrationEvidence?.sourceGateRelevantFiles >= 39 && scope.validation?.currentLocalOcrIntegrationEvidence?.sourceGateMaliciousSelfTests === 30 && scope.validation?.currentLocalOcrIntegrationEvidence?.sourceGateBenignSelfTests === 6 && scope.validation?.currentLocalOcrIntegrationEvidence?.sourceGateFindings === 0 && scope.validation?.currentLocalOcrIntegrationEvidence?.targetedTestsPassed === 77 && scope.validation?.currentLocalOcrIntegrationEvidence?.ocrIntegrationTestsPassed === 40 && scope.validation?.currentLocalOcrIntegrationEvidence?.runtimeBundleChecksPassed === 16 && scope.validation?.currentLocalOcrIntegrationEvidence?.runtimeBundleChecksFailed === 0);
check('DEC-197 remains active and binds PPK-016 evidence', ledger.decisions.some((item) => item.id === 'DEC-197' && item.status === 'ACTIVE' && item.requirements?.includes('PPK-016')) && ledger.decisionCount === ledger.decisions.length);
check('decision and audit preserve Desktop vault no-cache DEC-171 and zero real data', sources.decision.includes('SQLite sahipliği') && sources.decision.includes('DEC-171') && sources.audit.includes('no-cache') && sources.audit.includes('DEC-171') && /gerçek veri/iu.test(sources.audit));
check('decision and audit limit completion to metadata foundation and require future current-PEP payload binding', [sources.decision, sources.audit].every((document) => ['generic IPC', 'no-cache', 'güncel PEP yeniden değerlendirmesi', 'aynı policy-authorized transaction', 'Tarihsel receipt tek başına', 'metadata/enforcement foundation'].every((marker) => document.includes(marker))));
check('decision and audit record the fail-closed 30000 ms creation-time receipt window', [sources.decision, sources.audit].every((document) => document.includes('30.000 ms') && document.includes('producer transaction') && document.includes('fail-closed')));

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-L',
  requirement: 'PPK-016',
  phase: 'DERIVED_DATA_POLICY_INHERITANCE_CONTRACT',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  sourceScan,
  productionInventoryStatus: inventory.status,
  productionInventoryOwnerCount: inventory.productionInventory?.length ?? 0,
  productionInventoryCompletionClaimed: inventory.completionClaimed,
  activeUngovernedDerivedPayloadOwners: inventory.closureSummary?.activeUngovernedDerivedPayloadOwners,
  openProductionBlockers: inventory.closureSummary?.openBlockers ?? [],
  directDerivedDataPersistenceExceptions: 0,
  authorizedRepositoryAdapters: 1,
  authorizedDerivedProducerAdapters: 1,
  authorizedSealedMetadataReaders: 1,
  authorizedSealedPayloadReadChainComponents: 2,
  sourceReceiptMaximumAgeMsAtCreation: 30_000,
  futureSourceReceiptAllowedAtCreation: false,
  targetedTestMinimumTests: 77,
  readTimeProducerReceiptProvenanceRequired: true,
  readTimeSourceReceiptProvenanceRequired: true,
  creationChronologyRevalidatedAtRead: true,
  currentPepRequiredAtRead: true,
  monotonicUpstreamPolicyRequired: true,
  historicalPolicyVersionPackageExactMatchRequired: false,
  exactRecursiveUpstreamLineageRequired: true,
  ambiguousUpstreamRejected: true,
  maximumAncestorCount: 512,
  maximumStoredLineageTraversalCount: 512,
  migrationDecision: 'MIGRATION_77_POLICY_LINEAGE_PLUS_MIGRATION_94_SEALED_OCR_METADATA',
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  cutoverAuthorityAttached: false,
  realDataTransferPerformed: false,
  realDataBackfillPerformed: false,
  derivedPayloadPersistedByValidation: true,
  currentDerivedPayloadRepositoryOrReadPathExists: true,
  futureCurrentPepReevaluationRequired: true,
  historicalReceiptAloneCountsAsRevocationPropagationEvidence: false,
  policySensitiveIpcNoCacheWeakened: false,
  requirementCompletionClaimed: failures.length === 0,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-L-ppk-016-derived-data-policy-inheritance-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`32-L PPK-016 contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`32-L PPK-016 contract: PASS (${checks.length}/${checks.length}).`);
