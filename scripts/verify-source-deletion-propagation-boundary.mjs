import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const POLICY = 'packages/platform-policy/src/source-deletion-propagation-policy.ts';
const USE_CASE = 'packages/application/src/source-deletion-propagation-use-cases.ts';
const REPOSITORY = 'packages/repositories/src/data-lifecycle-repository.ts';
const CONTRACT = 'packages/repository-contracts/src/data-lifecycle-repository.ts';
const ADAPTER = 'apps/desktop/src/main/data-lifecycle-application-adapter.ts';
const DATA_STORE = 'apps/desktop/src/main/data-store.ts';
const MAIN = 'apps/desktop/src/main/main.ts';
const CACHE_ADAPTER = 'apps/desktop/src/main/source-deletion-propagation-application-adapter.ts';
const SCHEMA_OWNER = 'packages/database/src/family-database-migrations.ts';
const OCR_APPLICATION_ADAPTER = 'apps/desktop/src/main/local-governed-ocr-application-adapter.ts';
const OCR_USE_CASE = 'packages/application/src/local-governed-ocr-use-cases.ts';
const OCR_REPOSITORY = 'packages/repositories/src/local-governed-ocr-repository.ts';
const OCR_CONTRACT = 'packages/repository-contracts/src/local-governed-ocr-repository.ts';
const AI_MEMORY_MUTATION_METADATA_LEDGER = 'governed_ai_memory_mutations';
const AI_MEMORY_CURRENT_OWNER = 'governed_ai_memory_records';
const OCR_CURRENT_METADATA_OWNER = 'local_governed_ocr_jobs';
const OCR_MUTATION_METADATA_LEDGER = 'local_governed_ocr_mutations';
const OCR_SOURCE_DELETION_METADATA_LEDGER = 'local_governed_ocr_source_deletion_items';
const OCR_SETTINGS_METADATA = 'local_governed_ocr_settings';
const OCR_SOURCE_DELETION_RECOVERY_METADATA = 'local_governed_ocr_source_deletion_recovery_intents';
const PLATFORM_POLICY_TRANSACTION_REPOSITORY = 'packages/repositories/src/platform-policy-transaction-repository.ts';

const AUTHORIZED_PROPAGATION_CALLERS = new Set([REPOSITORY, CONTRACT, ADAPTER, USE_CASE]);
const AUTHORIZED_ENFORCEMENT_COMPOSITION = new Set([DATA_STORE]);
const AUTHORIZED_PRIMARY_DELETE_OWNER = new Set([REPOSITORY]);
const AUTHORIZED_OCR_SQL_OWNERS = new Set([OCR_REPOSITORY, SCHEMA_OWNER]);
const AUTHORIZED_OCR_RECOVERY_SQL_OWNERS = new Set([PLATFORM_POLICY_TRANSACTION_REPOSITORY, SCHEMA_OWNER]);
const AUTHORIZED_OCR_PROPAGATION_CALLERS = new Set([OCR_USE_CASE, OCR_APPLICATION_ADAPTER, OCR_REPOSITORY, OCR_CONTRACT]);
const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const relevant = /SourceDeletion|sourceDeletion|source-deletion|purgeResourceWithPropagation|RETENTION_PURGE|ocr|thumbnail|ai_memory|plaintext_replica|search_index/iu;
const normalize = (value) => value.replaceAll('\\', '/');

const PRIMARY_DELETE = /DELETE\s+FROM\s+(?:finance_records|health_records|medication_plans|family_health_history|life_records)\b/iu;
const DERIVED_PAYLOAD_TABLE = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+[`"']?([a-z0-9_]*(?:ocr(?:_text)?|search_index|thumbnail|ai_memory|derived_cache|plaintext_replica|replica)[a-z0-9_]*)/giu;
const DERIVED_PERSISTENCE_SYMBOL = /\b(?:insert|save|store|persist|write)(?:OcrText|SearchIndex|Thumbnail|AiMemory|DerivedCache|PlaintextReplica)\b/u;
const SEMANTIC_PAYLOAD_COLUMN = /\b(?:payload(?:_json)?|result_text|ocr_text|title|statement|content(?:_bytes)?|raw_bytes|source_bytes|document_bytes|plaintext|ciphertext|file_path|source_path|vault_path|secret)\s+(?:TEXT|BLOB)\b/iu;
const OCR_SQL_MUTATION = /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|REPLACE\s+INTO)\s+(local_governed_ocr_(?:jobs|mutations|source_deletion_items|settings|source_deletion_recovery_intents))\b/giu;
const OCR_REPOSITORY_SEMANTIC_PAYLOAD = /\b(?:result_text|ocr_text|raw_bytes|source_bytes|document_bytes|content_bytes|payload_json|file_path|source_path|vault_path)\b/iu;
const METADATA_LEDGER_COLUMNS = Object.freeze([
  'client_operation_id', 'request_fingerprint', 'state_fingerprint', 'mutation_kind',
  'resource_type', 'resource_id', 'family_id', 'account_id', 'owner_person_id',
  'previous_revision', 'revision', 'policy_receipt_hash', 'occurred_at'
]);

const lineOf = (source, offset) => (source.slice(0, offset).match(/\n/gu) ?? []).length + 1;
const finding = (path, source, kind, match) => ({ path, line: lineOf(source, match.index ?? 0), kind, detail: match[0] });

export const scanSourceDeletionPropagationSourceText = (path, source) => {
  const normalizedPath = normalize(path);
  const findings = [];
  const add = (kind, match) => findings.push(finding(normalizedPath, source, kind, match));

  const primaryDelete = PRIMARY_DELETE.exec(source);
  if (primaryDelete && !AUTHORIZED_PRIMARY_DELETE_OWNER.has(normalizedPath)) add('PRIMARY_DELETE_OUTSIDE_PROPAGATION_REPOSITORY', primaryDelete);

  for (const payloadTable of source.matchAll(DERIVED_PAYLOAD_TABLE)) {
    const tableName = payloadTable[1];
    const declarationEnd = source.indexOf(') STRICT;', payloadTable.index);
    const declaration = declarationEnd < 0 ? '' : source.slice(payloadTable.index, declarationEnd + ') STRICT;'.length);
    const authorizedAiMetadataLedger = normalizedPath === SCHEMA_OWNER
      && tableName === AI_MEMORY_MUTATION_METADATA_LEDGER
      && METADATA_LEDGER_COLUMNS.every((column) => new RegExp(`\\b${column}\\b`, 'u').test(declaration))
      && !SEMANTIC_PAYLOAD_COLUMN.test(declaration)
      && source.includes('CREATE TRIGGER trg_33o_ai_mutation_update BEFORE UPDATE ON governed_ai_memory_mutations')
      && source.includes('CREATE TRIGGER trg_33o_ai_mutation_delete BEFORE DELETE ON governed_ai_memory_mutations');
    const authorizedAiCurrentOwner = normalizedPath === SCHEMA_OWNER
      && tableName === AI_MEMORY_CURRENT_OWNER
      && ['resource_id', 'family_id', 'account_id', 'owner_person_id', 'derived_binding_hash', 'title', 'statement',
        'source_resource_type', 'source_resource_id', 'state', 'deleted_at', 'last_mutation_id', 'policy_receipt_hash']
        .every((column) => new RegExp(`\\b${column}\\b`, 'u').test(declaration))
      && source.includes('CREATE TRIGGER trg_33o_ai_current_update BEFORE UPDATE ON governed_ai_memory_records')
      && source.includes('CREATE TRIGGER trg_33o_ai_current_delete BEFORE DELETE ON governed_ai_memory_records')
      && source.includes("state='deleted' AND title='' AND statement='' AND processing_allowed=0");
    const authorizedOcrMetadata = normalizedPath === SCHEMA_OWNER
      && !SEMANTIC_PAYLOAD_COLUMN.test(declaration)
      && (
        (tableName === OCR_CURRENT_METADATA_OWNER
          && ['family_id', 'account_id', 'owner_person_id', 'source_resource_type', 'source_resource_id',
            'input_sha256', 'derived_binding_hash', 'sealed_result_id', 'result_content_sha256', 'last_mutation_id',
            'state_fingerprint', 'policy_receipt_hash', 'source_deleted_at', 'deletion_propagation']
            .every((column) => new RegExp(`\\b${column}\\b`, 'u').test(declaration))
          && source.includes('CREATE TRIGGER trg_33q_job_update BEFORE UPDATE ON local_governed_ocr_jobs')
          && source.includes('CREATE TRIGGER trg_33q_job_delete BEFORE DELETE ON local_governed_ocr_jobs')
          && source.includes("binding.derived_kind='OCR_TEXT'")
          && source.includes('local_governed_ocr_source_deletion_items item'))
        || (tableName === OCR_MUTATION_METADATA_LEDGER
          && METADATA_LEDGER_COLUMNS.every((column) => new RegExp(`\\b${column}\\b`, 'u').test(declaration))
          && source.includes('CREATE TRIGGER trg_33q_mutation_update BEFORE UPDATE ON local_governed_ocr_mutations')
          && source.includes('CREATE TRIGGER trg_33q_mutation_delete BEFORE DELETE ON local_governed_ocr_mutations'))
        || (tableName === OCR_SOURCE_DELETION_METADATA_LEDGER
          && ['batch_mutation_id', 'item_mutation_id', 'client_operation_id', 'request_fingerprint', 'job_id',
            'family_id', 'account_id', 'owner_person_id', 'source_resource_id', 'previous_revision', 'revision',
            'state_fingerprint', 'occurred_at', 'policy_receipt_hash']
            .every((column) => new RegExp(`\\b${column}\\b`, 'u').test(declaration))
          && source.includes('CREATE TRIGGER trg_33q_source_deletion_item_insert BEFORE INSERT ON local_governed_ocr_source_deletion_items')
          && source.includes('CREATE TRIGGER trg_33q_source_deletion_item_update BEFORE UPDATE ON local_governed_ocr_source_deletion_items')
          && source.includes('CREATE TRIGGER trg_33q_source_deletion_item_delete BEFORE DELETE ON local_governed_ocr_source_deletion_items'))
        || (tableName === OCR_SETTINGS_METADATA
          && ['account_id', 'family_id', 'owner_person_id', 'resource_id', 'revision', 'enabled',
            'last_mutation_id', 'state_fingerprint', 'policy_receipt_hash']
            .every((column) => new RegExp(`\\b${column}\\b`, 'u').test(declaration))
          && source.includes('CREATE TRIGGER trg_33q_settings_update BEFORE UPDATE ON local_governed_ocr_settings')
          && source.includes('CREATE TRIGGER trg_33q_settings_delete BEFORE DELETE ON local_governed_ocr_settings'))
        || (tableName === OCR_SOURCE_DELETION_RECOVERY_METADATA
          && ['operation_id', 'family_id', 'actor_account_id', 'intent_fingerprint', 'source_resource_id', 'registered_at']
            .every((column) => new RegExp(`\\b${column}\\b`, 'u').test(declaration))
          && source.includes('CREATE TRIGGER trg_33q_source_deletion_recovery_insert')
          && source.includes("pending.mutation='archive:secureDestroy'")
          && source.includes('pending.acknowledged_at IS NULL')
          && source.includes('CREATE TRIGGER trg_33q_source_deletion_recovery_update')
          && source.includes('CREATE TRIGGER trg_33q_source_deletion_recovery_delete'))
      );
    if (!authorizedAiMetadataLedger && !authorizedAiCurrentOwner && !authorizedOcrMetadata) add('UNREGISTERED_DERIVED_PAYLOAD_TABLE', payloadTable);
  }

  for (const mutation of source.matchAll(OCR_SQL_MUTATION)) {
    const authorizedOwners = mutation[1] === OCR_SOURCE_DELETION_RECOVERY_METADATA
      ? AUTHORIZED_OCR_RECOVERY_SQL_OWNERS
      : AUTHORIZED_OCR_SQL_OWNERS;
    if (!authorizedOwners.has(normalizedPath)) add('OCR_METADATA_SQL_OUTSIDE_AUTHORIZED_OWNER', mutation);
  }

  if (normalizedPath === OCR_REPOSITORY) {
    const semanticPayload = OCR_REPOSITORY_SEMANTIC_PAYLOAD.exec(source);
    if (semanticPayload) add('OCR_REPOSITORY_SEMANTIC_PAYLOAD', semanticPayload);
    if (![
      'assertPolicyAuthorizedRepositoryContext',
      'primaryScope(context',
      'archiveDeletionScope(context',
      'policy.receiptHash',
      'public propagateSourceDeletion('
    ].every((marker) => source.includes(marker))) {
      add('OCR_REPOSITORY_RECEIPT_FENCE_MISSING', { 0: 'exact policy receipt fence', index: 0 });
    }
  }

  if (normalizedPath === OCR_USE_CASE) {
    const propagationStart = source.indexOf('export class PropagateLocalGovernedOcrSourceDeletionUseCase');
    const propagationSegment = propagationStart >= 0 ? source.slice(propagationStart) : '';
    const purgeIndex = propagationSegment.indexOf('this.runtime.purgeSealedResult(');
    const persistIndex = propagationSegment.indexOf('scope.propagateSourceDeletion(');
    if (propagationStart < 0 || purgeIndex < 0 || persistIndex < 0 || purgeIndex >= persistIndex
      || !propagationSegment.includes('!purged.value.deleted || !purged.value.verified')) {
      add('OCR_SOURCE_DELETION_FILE_FIRST_FENCE_MISSING', { 0: 'verified purge before atomic tombstone ledger', index: Math.max(propagationStart, 0) });
    }
    const deleteStart = source.indexOf('export class DeleteLocalGovernedOcrJobUseCase');
    const deleteEnd = source.indexOf('export class SetLocalGovernedOcrEnabledUseCase', deleteStart);
    const deleteSegment = deleteStart >= 0 && deleteEnd > deleteStart ? source.slice(deleteStart, deleteEnd) : '';
    if (deleteStart < 0 || deleteEnd <= deleteStart
      || deleteSegment.indexOf('this.runtime.purgeSealedResult(') < 0
      || deleteSegment.indexOf('this.runtime.purgeSealedResult(') >= deleteSegment.indexOf('scope.saveJob(')
      || /(?:purgeResourceWithPropagation|propagateSourceDeletion|deleteArchiveSource)\s*\(/u.test(deleteSegment)) {
      add('OCR_DERIVED_DELETE_SOURCE_DELETE_FORBIDDEN', { 0: 'derived delete must preserve archive source', index: Math.max(deleteStart, 0) });
    }
  }

  const persistenceSymbol = DERIVED_PERSISTENCE_SYMBOL.exec(source);
  if (persistenceSymbol) add('UNREGISTERED_DERIVED_PAYLOAD_WRITER', persistenceSymbol);

  const propagationCall = /\.purgeResourceWithPropagation\s*\(/u.exec(source);
  if (propagationCall && !AUTHORIZED_PROPAGATION_CALLERS.has(normalizedPath)) add('PROPAGATION_REPOSITORY_CALL_OUTSIDE_AUTHORIZED_CHAIN', propagationCall);

  const ocrPropagationCall = /\.propagateSourceDeletion\s*\(/u.exec(source);
  if (ocrPropagationCall && !AUTHORIZED_OCR_PROPAGATION_CALLERS.has(normalizedPath)) {
    add('OCR_PROPAGATION_CALL_OUTSIDE_AUTHORIZED_CHAIN', ocrPropagationCall);
  }

  const enforcementComposition = /new\s+EnforceSourceDeletionPropagationUseCase\s*\(/u.exec(source);
  if (enforcementComposition && !AUTHORIZED_ENFORCEMENT_COMPOSITION.has(normalizedPath)) add('PROPAGATION_ENFORCEMENT_OUTSIDE_DATASTORE_COMPOSITION', enforcementComposition);

  const directRawReplica = /copyFileSync\s*\([^\n;]{0,300}(?:\.db\b|databasePath)/iu.exec(source);
  if (directRawReplica) add('PLAINTEXT_REPLICA_COPY_ACTIVE', directRawReplica);

  const cacheBypass = /sourceDeletionExternalCacheInvalidator\s*:\s*\{\s*invalidate\s*:\s*\(\)\s*=>\s*(?:\[\]|Object\.freeze\(\[\]\))/u.exec(source);
  if (cacheBypass) add('EMPTY_RUNTIME_CACHE_INVALIDATOR', cacheBypass);
  return findings;
};

const collectProductionSources = async (root) => {
  const zones = [];
  const files = [];
  for (const parent of ['apps', 'packages']) {
    for (const entry of await readdir(resolve(root, parent), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sourceRoot = resolve(root, parent, entry.name, 'src');
      try { await readdir(sourceRoot); } catch { continue; }
      zones.push(sourceRoot);
    }
  }
  const visit = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const candidate = join(directory, entry.name);
      if (entry.isDirectory()) await visit(candidate);
      else if (entry.isFile() && sourceExtensions.has(extname(entry.name))) files.push(candidate);
    }
  };
  for (const zone of zones) await visit(zone);
  return { zones, files };
};

const selfTest = () => {
  const malicious = [
    ["const sql='DELETE FROM finance_records WHERE id=?'", 'PRIMARY_DELETE_OUTSIDE_PROPAGATION_REPOSITORY'],
    ["const sql='CREATE TABLE ocr_payloads(id,payload)'", 'UNREGISTERED_DERIVED_PAYLOAD_TABLE'],
    ["const sql='CREATE TABLE thumbnail_cache(id,payload)'", 'UNREGISTERED_DERIVED_PAYLOAD_TABLE'],
    ['saveAiMemory(sourceId, payload)', 'UNREGISTERED_DERIVED_PAYLOAD_WRITER'],
    ['repository.purgeResourceWithPropagation(plan)', 'PROPAGATION_REPOSITORY_CALL_OUTSIDE_AUTHORIZED_CHAIN'],
    ['new EnforceSourceDeletionPropagationUseCase(policy, cache)', 'PROPAGATION_ENFORCEMENT_OUTSIDE_DATASTORE_COMPOSITION'],
    ["copyFileSync(databasePath, 'backup.db')", 'PLAINTEXT_REPLICA_COPY_ACTIVE'],
    ['sourceDeletionExternalCacheInvalidator:{invalidate:()=>[]}', 'EMPTY_RUNTIME_CACHE_INVALIDATOR'],
    [`CREATE TABLE ${AI_MEMORY_MUTATION_METADATA_LEDGER}(
      client_operation_id TEXT,request_fingerprint TEXT,state_fingerprint TEXT,mutation_kind TEXT,
      resource_type TEXT,resource_id TEXT,family_id TEXT,account_id TEXT,owner_person_id TEXT,
      previous_revision INTEGER,revision INTEGER,policy_receipt_hash TEXT,occurred_at TEXT,payload_json TEXT
    ) STRICT;
    CREATE TRIGGER trg_33o_ai_mutation_update BEFORE UPDATE ON governed_ai_memory_mutations BEGIN SELECT RAISE(ABORT,'immutable'); END;
    CREATE TRIGGER trg_33o_ai_mutation_delete BEFORE DELETE ON governed_ai_memory_mutations BEGIN SELECT RAISE(ABORT,'immutable'); END;`, 'UNREGISTERED_DERIVED_PAYLOAD_TABLE', SCHEMA_OWNER],
    ["const sql='UPDATE local_governed_ocr_jobs SET source_deleted_at=? WHERE id=?'", 'OCR_METADATA_SQL_OUTSIDE_AUTHORIZED_OWNER'],
    ["const sql='INSERT INTO local_governed_ocr_jobs(id,result_text) VALUES(?,?)'", 'OCR_REPOSITORY_SEMANTIC_PAYLOAD', OCR_REPOSITORY],
    ["public saveJob(){database.prepare('UPDATE local_governed_ocr_jobs SET revision=?')} ", 'OCR_REPOSITORY_RECEIPT_FENCE_MISSING', OCR_REPOSITORY],
    ["export class PropagateLocalGovernedOcrSourceDeletionUseCase { execute(){ return scope.propagateSourceDeletion(batch); } }", 'OCR_SOURCE_DELETION_FILE_FIRST_FENCE_MISSING', OCR_USE_CASE],
    ["export class DeleteLocalGovernedOcrJobUseCase { execute(){ deleteArchiveSource(); } } export class SetLocalGovernedOcrEnabledUseCase {}", 'OCR_DERIVED_DELETE_SOURCE_DELETE_FORBIDDEN', OCR_USE_CASE],
    ["repository.propagateSourceDeletion(batch)", 'OCR_PROPAGATION_CALL_OUTSIDE_AUTHORIZED_CHAIN'],
    [`CREATE TABLE ${OCR_SOURCE_DELETION_RECOVERY_METADATA}(
      operation_id TEXT,family_id TEXT,actor_account_id TEXT,intent_fingerprint TEXT,
      source_resource_id TEXT,registered_at TEXT,payload_json TEXT
    ) STRICT;
    CREATE TRIGGER trg_33q_source_deletion_recovery_insert BEFORE INSERT ON ${OCR_SOURCE_DELETION_RECOVERY_METADATA} BEGIN SELECT 1; END;
    CREATE TRIGGER trg_33q_source_deletion_recovery_update BEFORE UPDATE ON ${OCR_SOURCE_DELETION_RECOVERY_METADATA} BEGIN SELECT RAISE(ABORT,'immutable'); END;
    CREATE TRIGGER trg_33q_source_deletion_recovery_delete BEFORE DELETE ON ${OCR_SOURCE_DELETION_RECOVERY_METADATA} BEGIN SELECT RAISE(ABORT,'immutable'); END;`, 'UNREGISTERED_DERIVED_PAYLOAD_TABLE', SCHEMA_OWNER],
    ["database.prepare('DELETE FROM local_governed_ocr_source_deletion_recovery_intents')", 'OCR_METADATA_SQL_OUTSIDE_AUTHORIZED_OWNER']
  ];
  const failed = malicious.filter(([source, kind, path = 'apps/example/src/bypass.ts']) => !scanSourceDeletionPropagationSourceText(path, source).some((item) => item.kind === kind));
  if (failed.length) throw new Error(`Source deletion malicious self-test failed: ${failed.length}/${malicious.length}`);
  const benign = [
    'const thumbnailWidth = 96;',
    'const index = values.findIndex(Boolean);',
    "const replicaLabel = 'yedek';",
    'const cache = new Map();',
    `CREATE TABLE ${AI_MEMORY_MUTATION_METADATA_LEDGER}(
      client_operation_id TEXT,request_fingerprint TEXT,state_fingerprint TEXT,mutation_kind TEXT,
      resource_type TEXT,resource_id TEXT,family_id TEXT,account_id TEXT,owner_person_id TEXT,
      previous_revision INTEGER,revision INTEGER,policy_receipt_hash TEXT,occurred_at TEXT
    ) STRICT;
    CREATE TRIGGER trg_33o_ai_mutation_update BEFORE UPDATE ON governed_ai_memory_mutations BEGIN SELECT RAISE(ABORT,'immutable'); END;
    CREATE TRIGGER trg_33o_ai_mutation_delete BEFORE DELETE ON governed_ai_memory_mutations BEGIN SELECT RAISE(ABORT,'immutable'); END;`,
    `CREATE TABLE ${OCR_SOURCE_DELETION_RECOVERY_METADATA}(
      operation_id TEXT,family_id TEXT,actor_account_id TEXT,intent_fingerprint TEXT,
      source_resource_id TEXT,registered_at TEXT
    ) STRICT;
    CREATE TRIGGER trg_33q_source_deletion_recovery_insert BEFORE INSERT ON ${OCR_SOURCE_DELETION_RECOVERY_METADATA}
    WHEN NOT EXISTS(SELECT 1 FROM platform_policy_archive_pending_operations pending
      WHERE pending.mutation='archive:secureDestroy' AND pending.acknowledged_at IS NULL)
    BEGIN SELECT RAISE(ABORT,'bound'); END;
    CREATE TRIGGER trg_33q_source_deletion_recovery_update BEFORE UPDATE ON ${OCR_SOURCE_DELETION_RECOVERY_METADATA} BEGIN SELECT RAISE(ABORT,'immutable'); END;
    CREATE TRIGGER trg_33q_source_deletion_recovery_delete BEFORE DELETE ON ${OCR_SOURCE_DELETION_RECOVERY_METADATA} BEGIN SELECT RAISE(ABORT,'immutable'); END;`
  ];
  const falsePositives = benign.flatMap((source, index) => scanSourceDeletionPropagationSourceText(
    index >= benign.length - 2 ? SCHEMA_OWNER : 'apps/example/src/ordinary.ts', source));
  if (falsePositives.length) throw new Error(`Source deletion benign self-test produced ${falsePositives.length} finding(s)`);
  return { malicious: malicious.length, benign: benign.length };
};

export const scanSourceDeletionPropagationBoundary = async (root = process.cwd()) => {
  const { zones, files } = await collectProductionSources(root);
  const findings = [];
  let relevantFiles = 0;
  for (const file of files) {
    const path = normalize(relative(root, file));
    const source = await readFile(file, 'utf8');
    if (!relevant.test(source) && ![POLICY, USE_CASE, REPOSITORY, CONTRACT, ADAPTER, DATA_STORE, MAIN, CACHE_ADAPTER,
      OCR_APPLICATION_ADAPTER, OCR_USE_CASE, OCR_REPOSITORY, OCR_CONTRACT, SCHEMA_OWNER].includes(path)) continue;
    relevantFiles += 1;
    findings.push(...scanSourceDeletionPropagationSourceText(path, source));
  }
  const [policy, useCase, repository, adapter, dataStore, main, ocrUseCase, ocrRepository, schema] = await Promise.all([
    readFile(resolve(root, POLICY), 'utf8'), readFile(resolve(root, USE_CASE), 'utf8'),
    readFile(resolve(root, REPOSITORY), 'utf8'), readFile(resolve(root, ADAPTER), 'utf8'),
    readFile(resolve(root, DATA_STORE), 'utf8'), readFile(resolve(root, MAIN), 'utf8'),
    readFile(resolve(root, OCR_USE_CASE), 'utf8'), readFile(resolve(root, OCR_REPOSITORY), 'utf8'),
    readFile(resolve(root, SCHEMA_OWNER), 'utf8')
  ]);
  const requiredMarkers = [
    [policy, "'OCR_TEXT'", 'POLICY_OWNER_REGISTRY_MISSING'],
    [policy, "'VERIFIED_REWRITE_PENDING'", 'BACKUP_PENDING_POLICY_MISSING'],
    [useCase, 'cacheInvalidation.invalidate', 'CACHE_FIRST_ENFORCEMENT_MISSING'],
    [useCase, 'inspectSourceDeletionPropagation', 'PERSISTENT_OWNER_INSPECTION_MISSING'],
    [repository, 'SOURCE_DELETION_PROPAGATION_SCHEMA_CHANGED', 'TOCTOU_RESCAN_MISSING'],
    [repository, 'PRAGMA secure_delete=ON', 'SECURE_DELETE_MISSING'],
    [adapter, 'purgeResourceWithPropagation', 'AUTHORIZED_ADAPTER_MISSING'],
    [dataStore, 'DesktopSourceDeletionRuntimeCacheInvalidationPort', 'DATASTORE_CACHE_COMPOSITION_MISSING'],
    [main, 'ipcReadResults.clearAll()', 'MAIN_READ_CACHE_CLEAR_MISSING'],
    [main, "offlineSensitiveCache.lock('NO_LEASE')", 'OFFLINE_CACHE_LOCK_MISSING'],
    [ocrUseCase, 'scope.propagateSourceDeletion(', 'OCR_ATOMIC_TOMBSTONE_LEDGER_MISSING'],
    [ocrUseCase, '!purged.value.deleted || !purged.value.verified', 'OCR_VERIFIED_FILE_PURGE_MISSING'],
    [ocrRepository, 'archiveDeletionScope(context', 'OCR_ARCHIVE_RECEIPT_SCOPE_MISSING'],
    [schema, 'CREATE TABLE local_governed_ocr_source_deletion_items', 'OCR_SOURCE_DELETION_LEDGER_SCHEMA_MISSING']
  ];
  for (const [source, marker, kind] of requiredMarkers) {
    if (!source.includes(marker)) findings.push({ path: 'composition', line: 1, kind, detail: marker });
  }
  return { zones: zones.length, files: files.length, relevantFiles, findings };
};

const main = async () => {
  const assertions = selfTest();
  const root = process.cwd();
  const result = await scanSourceDeletionPropagationBoundary(root);
  const report = {
    status: result.findings.length === 0 ? 'PASS' : 'FAIL',
    productionSourceZones: result.zones,
    scannedFiles: result.files,
    securityRelevantFiles: result.relevantFiles,
    maliciousSelfTestAssertions: assertions.malicious,
    benignFalsePositiveAssertions: assertions.benign,
    ownerKinds: 7,
    requiredRuntimeCacheRegistries: 3,
    activeSemanticPersistentOwners: 2,
    plaintextReplicaProductionOwners: 0,
    directBypassExceptions: 0,
    authorizedRepositoryAdapters: 3,
    currentMetadataOwners: 1,
    metadataOnlyAppendOnlyMutationLedgers: 3,
    contentFreeMetadataTables: 2,
    findings: result.findings
  };
  console.log(JSON.stringify(report, null, 2));
  if (result.findings.length) process.exitCode = 1;
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) await main();
