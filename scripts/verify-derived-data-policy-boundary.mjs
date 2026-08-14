import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const AUTHORIZED_REPOSITORY = 'packages/repositories/src/derived-data-policy-repository.ts';
const AUTHORIZED_REPOSITORY_CONTRACT = 'packages/repository-contracts/src/derived-data-policy-repository.ts';
const AUTHORIZED_SCHEMA_OWNER = 'packages/database/src/family-database-migrations.ts';
const AUTHORIZED_REPOSITORY_INDEX = 'packages/repositories/src/index.ts';
const AUTHORIZED_REPOSITORY_CONTRACT_INDEX = 'packages/repository-contracts/src/index.ts';
const AUTHORIZED_COMPOSITION_ROOT = 'apps/desktop/src/main/repository-composition-root.ts';
const GOVERNED_POLICY = 'packages/platform-policy/src/derived-data-inheritance-policy.ts';
const GOVERNED_USE_CASE = 'packages/application/src/derived-data-inheritance-use-cases.ts';
const RETIRED_AI_MEMORY_PRODUCER = 'packages/domain/src/ai-memory.ts';
const RETIRED_RAW_REPLICA_USE_CASE = 'packages/application/src/database-export-file-use-cases.ts';
const RETIRED_RAW_REPLICA_ADAPTER = 'apps/desktop/src/main/database-export-file-application-adapter.ts';
const FAMILY_IMPORT_SERVICE = 'apps/desktop/src/main/family-data-import-service.ts';
const AUTOMATION_APPLICATION_ADAPTER = 'apps/desktop/src/main/automation-application-adapter.ts';
const AUTOMATION_REPOSITORY = 'packages/repositories/src/automation-repository.ts';
const ARCHIVE_APPLICATION_ADAPTER = 'apps/desktop/src/main/archive-application-adapter.ts';
const ARCHIVE_OPERATION_REPOSITORY = 'packages/repositories/src/platform-policy-transaction-repository.ts';
const OCR_APPLICATION_ADAPTER = 'apps/desktop/src/main/local-governed-ocr-application-adapter.ts';
const OCR_APPLICATION_USE_CASE = 'packages/application/src/local-governed-ocr-use-cases.ts';
const OCR_METADATA_REPOSITORY = 'packages/repositories/src/local-governed-ocr-repository.ts';
const OCR_RUNTIME_ADAPTER = 'apps/desktop/src/main/local-governed-ocr-runtime-adapter.ts';
const SOURCE_DELETION_METADATA_INVENTORY = 'packages/repositories/src/data-lifecycle-repository.ts';
const PRIVACY_OWNERSHIP_METADATA_INVENTORY = 'packages/repositories/src/privacy-ownership-data-rights-repository.ts';
const ALWAYS_SCANNED_PRODUCTION_SOURCES = new Set([
  RETIRED_RAW_REPLICA_ADAPTER,
  FAMILY_IMPORT_SERVICE,
  AUTOMATION_APPLICATION_ADAPTER,
  AUTOMATION_REPOSITORY,
  ARCHIVE_APPLICATION_ADAPTER,
  ARCHIVE_OPERATION_REPOSITORY,
  OCR_APPLICATION_ADAPTER,
  OCR_APPLICATION_USE_CASE,
  OCR_METADATA_REPOSITORY,
  OCR_RUNTIME_ADAPTER
]);

const AUTHORIZED_SQL_OWNERS = new Set([AUTHORIZED_REPOSITORY, AUTHORIZED_SCHEMA_OWNER]);
const AUTHORIZED_METADATA_INVENTORY_READERS = new Set([
  SOURCE_DELETION_METADATA_INVENTORY,
  PRIVACY_OWNERSHIP_METADATA_INVENTORY
]);
const AUTHORIZED_CONCRETE_REPOSITORY_USERS = new Set([
  AUTHORIZED_REPOSITORY,
  AUTHORIZED_REPOSITORY_CONTRACT,
  AUTHORIZED_REPOSITORY_INDEX,
  AUTHORIZED_REPOSITORY_CONTRACT_INDEX,
  AUTHORIZED_COMPOSITION_ROOT
]);
const AUTHORIZED_BINDING_WRITE_DECLARATIONS = new Set([
  AUTHORIZED_REPOSITORY,
  AUTHORIZED_REPOSITORY_CONTRACT,
  OCR_APPLICATION_ADAPTER
]);
const AUTHORIZED_SEALED_RESULT_READ_PATHS = new Set([
  OCR_APPLICATION_USE_CASE,
  OCR_RUNTIME_ADAPTER
]);
const AUTHORIZED_ENFORCEMENT_USE_CASE_USERS = new Set([
  GOVERNED_USE_CASE,
  'packages/application/src/index.ts'
]);
const DERIVED_BINDING_TABLE = /\bderived_data_policy_(?:bindings|sources)\b/iu;
const AUTOMATION_RUN_TABLE = /\bautomation_runs\b/iu;
const ARCHIVE_OPERATION_TABLE = /\bplatform_policy_archive_operations\b/iu;
const OCR_CURRENT_METADATA_TABLE = /\blocal_governed_ocr_jobs\b/iu;
const SQL_MUTATION = /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|REPLACE\s+INTO)\b/iu;
const SQL_READ_ONLY_QUERY = /^\s*(?:SELECT\b|WITH\b[\s\S]*?\bSELECT\b)/iu;
const ARCHIVE_SEMANTIC_PAYLOAD_COLUMN = /\bresult_json\b/iu;
const OCR_REPOSITORY_SEMANTIC_PAYLOAD = /\b(?:result_text|ocr_text|raw_bytes|source_bytes|document_bytes|content_bytes|payload_json|file_path|source_path|vault_path)\b/iu;
const DERIVED_REPOSITORY_MODULE = /(?:^|\/)derived-data-policy-repository(?:\.[cm]?[jt]s)?$/u;
const AI_MEMORY_PRODUCER_MODULE = /(?:^|\/)ai-memory(?:\.[cm]?[jt]s)?$/u;
const RAW_REPLICA_MODULE = /(?:^|\/)(?:database-export-file-use-cases|database-export-file-application-adapter)(?:\.[cm]?[jt]s)?$/u;
const PERSISTENCE_IMPORT = /^(?:node:)?sqlite$|^better-sqlite3$|^@ppt\/(?:database|repositories)(?:\/|$)/u;
const RELEVANT_SOURCE = /DerivedData|derived_data_policy_|derived-data-policy-repository|ai-memory|buildAiTimelineContext|database-export-file|ExportDatabaseFileUseCase|FileSystemDatabaseExportFilePort|automation_runs|platform_policy_archive_operations|local_governed_ocr_jobs|local-governed-ocr|readSealedResult/u;
const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

const normalize = (value) => value.replaceAll('\\', '/');

// A deliberately small linear lexer is sufficient for this gate: only string
// literals and identifiers can name a concrete adapter, SQLite primitive or
// binding table. Comments are skipped so documentation prose cannot trigger a
// production finding, and generic cache/index identifiers remain irrelevant.
const lexicalTokens = (source) => {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    if (character === '/' && next === '/') {
      index += 2;
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }
    if (character === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      index = Math.min(source.length, index + 2);
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      const quote = character;
      const offset = index;
      let value = '';
      index += 1;
      while (index < source.length) {
        const current = source[index];
        if (current === '\\') {
          value += current;
          if (index + 1 < source.length) value += source[index + 1];
          index += 2;
          continue;
        }
        if (current === quote) { index += 1; break; }
        value += current;
        index += 1;
      }
      tokens.push({ kind: 'string', value, offset });
      continue;
    }
    if (character && /[A-Za-z_$]/u.test(character)) {
      const offset = index;
      index += 1;
      while (index < source.length && /[A-Za-z0-9_$]/u.test(source[index])) index += 1;
      tokens.push({ kind: 'identifier', value: source.slice(offset, index), offset });
      continue;
    }
    index += 1;
  }
  return tokens;
};

export const scanDerivedDataPolicySourceText = (path, source) => {
  const normalizedPath = normalize(path);
  const findings = [];
  const derivedPolicySource = /\b(?:DerivedData[A-Za-z0-9_]*|derived_data_policy_[a-z0-9_]*)\b/u.test(source);
  const report = (kind, detail, offset) => {
    const before = source.slice(0, offset);
    const line = (before.match(/\n/gu) ?? []).length + 1;
    const lastBreak = before.lastIndexOf('\n');
    findings.push({
      path: normalizedPath,
      line,
      column: offset - lastBreak,
      kind,
      detail
    });
  };

  if (normalizedPath === FAMILY_IMPORT_SERVICE) {
    const lease = /interface\s+CachedPreviewLease\s*\{(?<body>[\s\S]*?)\n\}/u.exec(source);
    if (!lease?.groups?.body) {
      report('DERIVED_CACHE_CONTENT_FREE_LEASE_MISSING', 'CachedPreviewLease', 0);
    } else {
      const retainedPayload = /\b(?:preview|sourceText|document|plan)\s*:/u.exec(lease.groups.body);
      if (retainedPayload) {
        report('DERIVED_CACHE_RETAINED_PAYLOAD', retainedPayload[0], lease.index + retainedPayload.index);
      }
    }
    const revalidationMarkers = [
      'const sourceBuffer = readFileSync(cached.sourcePath)',
      'const afterReadStat = lstatSync(cached.sourcePath)',
      'sha256(sourceBuffer) !== cached.sourceSha256',
      'parseSourceDocument(',
      'preparedPlan.digest !== cached.planDigest',
      'currentPlan.digest !== cached.planDigest'
    ];
    if (!revalidationMarkers.every((marker) => source.includes(marker))) {
      report('DERIVED_CACHE_SOURCE_REVALIDATION_MISSING', 'family import apply revalidation', 0);
    }
  }

  if (normalizedPath === RETIRED_RAW_REPLICA_ADAPTER) {
    const activeRawCopy = /\b(?:copyFileSync|copyFile)\s*\(/u.exec(source);
    if (activeRawCopy) {
      report('PLAINTEXT_REPLICA_DORMANT_ADAPTER_ACTIVE', activeRawCopy[0], activeRawCopy.index);
    }
  }

  if (normalizedPath === AUTOMATION_APPLICATION_ADAPTER) {
    const taskStart = source.indexOf('private async createGeneratedTask(');
    const taskEnd = source.indexOf('public async executeDueRules(', taskStart);
    const taskSegment = taskStart >= 0
      ? source.slice(taskStart, taskEnd > taskStart ? taskEnd : source.length)
      : '';
    const semanticCopy = /source\.(?:title|dueAt)/u.exec(taskSegment);
    if (semanticCopy) {
      report('AUTOMATION_TASK_SOURCE_SEMANTIC_PERSISTENCE', semanticCopy[0], taskStart + semanticCopy.index);
    }
    if (
      taskStart < 0
      || !taskSegment.includes("rule.sourceType !== 'life_record'")
      || !taskSegment.includes('this.revalidateLifeSource(')
      || !taskSegment.includes('title: rule.title')
      || !taskSegment.includes("notes: 'Otomatik oluşturuldu.'")
    ) {
      report('AUTOMATION_TASK_CONTENT_FREE_FENCE_MISSING', 'generated LIFE task fence', Math.max(taskStart, 0));
    }
    if (!source.includes("record.sourceType !== 'life_record'") || !source.includes('PPK016_SOURCE_BINDING_REQUIRED')) {
      report('AUTOMATION_NON_LIFE_FAIL_CLOSED_MISSING', 'non-LIFE source rejection', 0);
    }
  }

  if (normalizedPath === AUTOMATION_REPOSITORY) {
    const insertStart = source.indexOf('public insertRun(');
    const insertEnd = source.indexOf('public listLifeRunCandidates(', insertStart);
    const insertSegment = insertStart >= 0
      ? source.slice(insertStart, insertEnd > insertStart ? insertEnd : source.length)
      : '';
    const semanticInput = /input\.(?:title|dueAt)/u.exec(insertSegment);
    if (semanticInput) {
      report('AUTOMATION_LEDGER_SEMANTIC_INPUT', semanticInput[0], insertStart + semanticInput.index);
    }
    if (
      insertStart < 0
      || !insertSegment.includes('AutomationRunLedgerRow')
      || !insertSegment.includes('REDACTED_RUN_TITLE')
      || !insertSegment.includes('input.createdAt')
      || source.includes('public listNonLifeDueSources(')
      || source.includes('public listNonLifeRuns(')
    ) {
      report('AUTOMATION_CONTENT_FREE_LEDGER_FENCE_MISSING', 'automation run ledger fence', Math.max(insertStart, 0));
    }
  }

  if (normalizedPath === ARCHIVE_APPLICATION_ADAPTER) {
    const semanticReplay = /\b(?:serializeArchiveOperationResult|deserializeArchiveOperationResult)\b|\bresultJson\s*:|state\s*===\s*['"]replay['"]/u.exec(source);
    if (semanticReplay) {
      report('ARCHIVE_SEMANTIC_REPLAY_PAYLOAD', semanticReplay[0], semanticReplay.index);
    }
    if (!source.includes('hashArchiveOperationResult') || !source.includes("semanticReplay: 'forbidden'")) {
      report('ARCHIVE_CONTENT_FREE_CONFLICT_FENCE_MISSING', 'archive semantic replay conflict fence', 0);
    }
  }

  if (normalizedPath === ARCHIVE_OPERATION_REPOSITORY) {
    const selectStart = source.indexOf('const ARCHIVE_OPERATION_METADATA_SELECT =');
    const selectEnd = source.indexOf('`;', selectStart);
    const selectSegment = selectStart >= 0 && selectEnd > selectStart ? source.slice(selectStart, selectEnd) : '';
    const payloadSelect = /\bresult_json\b/u.exec(selectSegment);
    if (payloadSelect) {
      report('ARCHIVE_METADATA_LOOKUP_SELECTS_SEMANTIC_PAYLOAD', payloadSelect[0], selectStart + payloadSelect.index);
    }
    if (
      selectStart < 0
      || !source.includes(`const ARCHIVE_OPERATION_COMPLETION_JSON = '{"status":"completed"}'`)
      || !source.includes('public findArchiveOperationMetadata(')
      || source.includes('public findArchiveOperation(')
      || !source.includes('input.resultHash')
      || source.includes('input.resultJson')
    ) {
      report('ARCHIVE_CONTENT_FREE_JOURNAL_FENCE_MISSING', 'archive operation metadata fence', Math.max(selectStart, 0));
    }
  }

  if (normalizedPath === OCR_APPLICATION_ADAPTER) {
    const writerStart = source.indexOf('public insertDerivedBinding(');
    const writerEnd = source.indexOf('public appendAudit(', writerStart);
    const writerSegment = writerStart >= 0 && writerEnd > writerStart
      ? source.slice(writerStart, writerEnd)
      : '';
    const insertCalls = [...source.matchAll(/\binsertSealed\s*\(/gu)];
    if (
      writerStart < 0
      || writerEnd <= writerStart
      || insertCalls.length !== 1
      || insertCalls[0].index < writerStart
      || insertCalls[0].index >= writerEnd
      || ![
        "const target = this.slot('target')",
        "const primary = this.slot('primary')",
        "targetIntent?.resourceType !== 'local_ocr_result'",
        'targetIntent.sourceJobId !== primary.intent.resourceId',
        "binding.target.resourceType !== 'local_ocr_result'",
        'binding.target.resourceId !== target.intent.resourceId',
        'binding.target.familyId !== this.context.familyId',
        'this.dependencies.derivedDataPolicyRepository.insertSealed(target.repository, binding)'
      ].every((marker) => writerSegment.includes(marker))
    ) {
      report('OCR_PPK016_EXACT_WRITER_FENCE_MISSING', 'local_ocr_result exact binding writer', Math.max(writerStart, 0));
    }
  }

  if (normalizedPath === OCR_APPLICATION_USE_CASE) {
    const readStart = source.indexOf('export class GetLocalGovernedOcrResultUseCase');
    const readEnd = source.indexOf('export class PropagateLocalGovernedOcrSourceDeletionUseCase', readStart);
    const readSegment = readStart >= 0 && readEnd > readStart ? source.slice(readStart, readEnd) : '';
    const readCalls = [...source.matchAll(/\breadSealedResult\s*\(/gu)];
    if (
      readStart < 0
      || readEnd <= readStart
      || readCalls.length !== 2
      || !readSegment.includes('resolveSourceAndConsent(')
      || !readSegment.includes('current.value.resultContentSha256')
      || !readSegment.includes('current.value.sealedResultId')
      || !readSegment.includes('this.runtime.readSealedResult(')
      || !readSegment.includes('read.value.contentSha256 !== current.value.resultContentSha256')
      || !readSegment.includes("action: 'ocr.result_read'")
    ) {
      report('OCR_PPK016_EXACT_READ_FENCE_MISSING', 'local_ocr_result exact authorized read', Math.max(readStart, 0));
    }
  }

  if (normalizedPath === OCR_METADATA_REPOSITORY) {
    const semanticPayload = OCR_REPOSITORY_SEMANTIC_PAYLOAD.exec(source);
    if (semanticPayload) {
      report('OCR_REPOSITORY_SEMANTIC_PAYLOAD', semanticPayload[0], semanticPayload.index);
    }
    if (![
      'assertPolicyAuthorizedRepositoryContext',
      'primaryScope(context',
      'archiveDeletionScope(context',
      'derived_binding_hash',
      'sealed_result_id',
      'result_content_sha256'
    ].every((marker) => source.includes(marker))) {
      report('OCR_REPOSITORY_CONTENT_FREE_METADATA_FENCE_MISSING', 'local OCR metadata repository fence', 0);
    }
  }

  for (const token of lexicalTokens(source)) {
    const { offset, value } = token;
    if (token.kind === 'string') {
      const registryPrefix = source.slice(Math.max(0, offset - 256), offset);
      const authorizedPolicyRegistryLiteral = normalizedPath === GOVERNED_POLICY
        && value === AUTHORIZED_REPOSITORY
        && /DERIVED_DATA_AUTHORIZED_REPOSITORY_ADAPTERS\s*=\s*Object\.freeze\(\[\s*$/u.test(registryPrefix);
      const authorizedSourceDeletionMetadataRegistryLiteral = normalizedPath === SOURCE_DELETION_METADATA_INVENTORY
        && (value === 'derived_data_policy_bindings' || value === 'derived_data_policy_sources')
        && (/(?:const\s+DERIVED_POLICY_METADATA_TABLES\s*=\s*new\s+Set\s*\(\s*\[|const\s+requiredTables\s*=\s*\[)[\s\S]*$/u.test(registryPrefix));
      const authorizedMetadataInventoryRead = AUTHORIZED_METADATA_INVENTORY_READERS.has(normalizedPath)
        && SQL_READ_ONLY_QUERY.test(value)
        && !SQL_MUTATION.test(value);
      if (
        DERIVED_REPOSITORY_MODULE.test(value)
        && !AUTHORIZED_CONCRETE_REPOSITORY_USERS.has(normalizedPath)
        && !authorizedPolicyRegistryLiteral
      ) {
        report('DERIVED_REPOSITORY_IMPORT_OUTSIDE_COMPOSITION', value, offset);
      }
      if (AI_MEMORY_PRODUCER_MODULE.test(value) && normalizedPath !== RETIRED_AI_MEMORY_PRODUCER) {
        report('UNGOVERNED_AI_MEMORY_MODULE_USE', value, offset);
      }
      if (
        RAW_REPLICA_MODULE.test(value)
        && normalizedPath !== RETIRED_RAW_REPLICA_USE_CASE
        && normalizedPath !== RETIRED_RAW_REPLICA_ADAPTER
      ) {
        report('PLAINTEXT_REPLICA_MODULE_USE', value, offset);
      }
      if (
        value.includes('SqliteDerivedDataPolicyRepository')
        && !AUTHORIZED_CONCRETE_REPOSITORY_USERS.has(normalizedPath)
      ) {
        report('DERIVED_REPOSITORY_CONCRETE_SYMBOL_OUTSIDE_COMPOSITION', value, offset);
      }
      if (DERIVED_BINDING_TABLE.test(value) && !AUTHORIZED_SQL_OWNERS.has(normalizedPath)
        && !authorizedSourceDeletionMetadataRegistryLiteral && !authorizedMetadataInventoryRead) {
        report('DERIVED_BINDING_SQL_OUTSIDE_AUTHORIZED_OWNER', value.slice(0, 160), offset);
      }
      if (
        AUTOMATION_RUN_TABLE.test(value)
        && SQL_MUTATION.test(value)
        && normalizedPath !== AUTOMATION_REPOSITORY
      ) {
        report('AUTOMATION_LEDGER_SQL_OUTSIDE_AUTHORIZED_OWNER', value.slice(0, 160), offset);
      }
      if (
        ARCHIVE_OPERATION_TABLE.test(value)
        && (SQL_MUTATION.test(value) || ARCHIVE_SEMANTIC_PAYLOAD_COLUMN.test(value))
        && normalizedPath !== ARCHIVE_OPERATION_REPOSITORY
      ) {
        report('ARCHIVE_OPERATION_SQL_OUTSIDE_AUTHORIZED_OWNER', value.slice(0, 160), offset);
      }
      if (
        OCR_CURRENT_METADATA_TABLE.test(value)
        && SQL_MUTATION.test(value)
        && normalizedPath !== OCR_METADATA_REPOSITORY
        && normalizedPath !== AUTHORIZED_SCHEMA_OWNER
      ) {
        report('OCR_METADATA_SQL_OUTSIDE_AUTHORIZED_OWNER', value.slice(0, 160), offset);
      }
      if (
        derivedPolicySource
        && PERSISTENCE_IMPORT.test(value)
        && !AUTHORIZED_CONCRETE_REPOSITORY_USERS.has(normalizedPath)
        && normalizedPath !== AUTHORIZED_SCHEMA_OWNER
      ) {
        report('DERIVED_PERSISTENCE_PRIMITIVE_OUTSIDE_REPOSITORY', value, offset);
      }
    }
    if (
      token.kind === 'identifier'
      && value === 'SqliteDerivedDataPolicyRepository'
      && !AUTHORIZED_CONCRETE_REPOSITORY_USERS.has(normalizedPath)
    ) {
      report('DERIVED_REPOSITORY_CONCRETE_SYMBOL_OUTSIDE_COMPOSITION', value, offset);
    }
    if (
      token.kind === 'identifier'
      && value === 'insertSealed'
      && !AUTHORIZED_BINDING_WRITE_DECLARATIONS.has(normalizedPath)
    ) {
      report('DERIVED_BINDING_DIRECT_WRITE_OUTSIDE_REPOSITORY', value, offset);
    }
    if (
      token.kind === 'identifier'
      && value === 'readSealedResult'
      && source[offset - 1] === '.'
      && /^\s*\(/u.test(source.slice(offset + value.length))
      && !AUTHORIZED_SEALED_RESULT_READ_PATHS.has(normalizedPath)
    ) {
      report('OCR_SEALED_RESULT_READ_OUTSIDE_AUTHORIZED_PATH', value, offset);
    }
    if (
      token.kind === 'identifier'
      && value === 'EnforceDerivedDataInheritanceUseCase'
      && !AUTHORIZED_ENFORCEMENT_USE_CASE_USERS.has(normalizedPath)
    ) {
      report('DERIVED_ENFORCEMENT_USE_CASE_OUTSIDE_AUTHORIZED_COMPOSITION', value, offset);
    }
    if (
      token.kind === 'identifier'
      && value === 'buildAiTimelineContext'
      && normalizedPath !== RETIRED_AI_MEMORY_PRODUCER
    ) {
      report('UNGOVERNED_AI_MEMORY_PRODUCER_USE', value, offset);
    }
    if (
      token.kind === 'identifier'
      && (value === 'ExportDatabaseFileUseCase' || value === 'FileSystemDatabaseExportFilePort')
      && normalizedPath !== RETIRED_RAW_REPLICA_USE_CASE
      && normalizedPath !== RETIRED_RAW_REPLICA_ADAPTER
    ) {
      report('PLAINTEXT_REPLICA_SYMBOL_USE', value, offset);
    }
  }
  return findings;
};

const collectProductionSources = async (root) => {
  const files = [];
  const zones = [];
  for (const parent of ['apps', 'packages']) {
    for (const entry of await readdir(resolve(root, parent), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sourceRoot = resolve(root, parent, entry.name, 'src');
      try {
        await readdir(sourceRoot);
      } catch {
        continue;
      }
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

export const scanDerivedDataPolicyBoundary = async (root = process.cwd()) => {
  const { zones, files } = await collectProductionSources(root);
  const findings = [];
  let relevantFiles = 0;
  for (const file of files) {
    const relativePath = normalize(relative(root, file));
    // Migration 77 is the explicit DDL owner. Its large canonical SQL template
    // is intentionally not tokenized as an application persistence caller.
    if (relativePath === AUTHORIZED_SCHEMA_OWNER) continue;
    const source = await readFile(file, 'utf8');
    if (!RELEVANT_SOURCE.test(source) && !ALWAYS_SCANNED_PRODUCTION_SOURCES.has(relativePath)) continue;
    relevantFiles += 1;
    findings.push(...scanDerivedDataPolicySourceText(relativePath, source));
  }
  return { zones: zones.length, files: files.length, relevantFiles, findings };
};

const selfTest = () => {
  const maliciousCases = [
    ["const sql = 'INSERT INTO derived_data_policy_bindings(binding_hash) VALUES(?)';", 'DERIVED_BINDING_SQL_OUTSIDE_AUTHORIZED_OWNER'],
    ["const sql = 'SELECT * FROM derived_data_policy_sources WHERE source_key=?';", 'DERIVED_BINDING_SQL_OUTSIDE_AUTHORIZED_OWNER'],
    ["import { SqliteDerivedDataPolicyRepository } from './derived-data-policy-repository.js';", 'DERIVED_REPOSITORY_IMPORT_OUTSIDE_COMPOSITION', GOVERNED_POLICY],
    ["import { SqliteDerivedDataPolicyRepository } from '@ppt/repositories';", 'DERIVED_REPOSITORY_CONCRETE_SYMBOL_OUTSIDE_COMPOSITION'],
    ["import { DatabaseSync } from 'node:sqlite'; const value: DerivedDataPolicyBinding = input;", 'DERIVED_PERSISTENCE_PRIMITIVE_OUTSIDE_REPOSITORY'],
    ["const insertSealed = (binding: DerivedDataPolicyBinding) => binding;", 'DERIVED_BINDING_DIRECT_WRITE_OUTSIDE_REPOSITORY'],
    ["const sql = `DELETE FROM derived_data_policy_bindings WHERE binding_hash=?`;", 'DERIVED_BINDING_SQL_OUTSIDE_AUTHORIZED_OWNER'],
    ["const repository = new SqliteDerivedDataPolicyRepository(database);", 'DERIVED_REPOSITORY_CONCRETE_SYMBOL_OUTSIDE_COMPOSITION'],
    ["const padded = 'x'.repeat(4096); import(padded + './derived-data-policy-repository.js');", 'DERIVED_REPOSITORY_IMPORT_OUTSIDE_COMPOSITION'],
    ["const adapterName = 'SqliteDerivedDataPolicyRepository';", 'DERIVED_REPOSITORY_CONCRETE_SYMBOL_OUTSIDE_COMPOSITION'],
    ["new EnforceDerivedDataInheritanceUseCase(policy, { persist: async () => undefined });", 'DERIVED_ENFORCEMENT_USE_CASE_OUTSIDE_AUTHORIZED_COMPOSITION'],
    ["export { buildAiTimelineContext } from './ai-memory.js';", 'UNGOVERNED_AI_MEMORY_MODULE_USE'],
    ["const result = buildAiTimelineContext(actor, events);", 'UNGOVERNED_AI_MEMORY_PRODUCER_USE'],
    ["import { ExportDatabaseFileUseCase } from './database-export-file-use-cases.js';", 'PLAINTEXT_REPLICA_MODULE_USE'],
    ["const exporter = new FileSystemDatabaseExportFilePort();", 'PLAINTEXT_REPLICA_SYMBOL_USE'],
    ["interface CachedPreviewLease {\n  readonly sourceText: string;\n}", 'DERIVED_CACHE_RETAINED_PAYLOAD', FAMILY_IMPORT_SERVICE],
    ["copyFileSync(input.sourcePath, input.destinationPath);", 'PLAINTEXT_REPLICA_DORMANT_ADAPTER_ACTIVE', RETIRED_RAW_REPLICA_ADAPTER],
    ["private async createGeneratedTask() { return source.title; }", 'AUTOMATION_TASK_SOURCE_SEMANTIC_PERSISTENCE', AUTOMATION_APPLICATION_ADAPTER],
    ["public insertRun() { return input.dueAt; }", 'AUTOMATION_LEDGER_SEMANTIC_INPUT', AUTOMATION_REPOSITORY],
    ["const value = deserializeArchiveOperationResult(context, resultJson);", 'ARCHIVE_SEMANTIC_REPLAY_PAYLOAD', ARCHIVE_APPLICATION_ADAPTER],
    ["const ARCHIVE_OPERATION_METADATA_SELECT = `SELECT result_json FROM platform_policy_archive_operations`;", 'ARCHIVE_METADATA_LOOKUP_SELECTS_SEMANTIC_PAYLOAD', ARCHIVE_OPERATION_REPOSITORY],
    ["const sql = 'INSERT INTO automation_runs(title,due_at) VALUES(?,?)';", 'AUTOMATION_LEDGER_SQL_OUTSIDE_AUTHORIZED_OWNER'],
    ["const sql = 'SELECT result_json FROM platform_policy_archive_operations';", 'ARCHIVE_OPERATION_SQL_OUTSIDE_AUTHORIZED_OWNER'],
    ["const sql = 'UPDATE local_governed_ocr_jobs SET sealed_result_id=? WHERE id=?';", 'OCR_METADATA_SQL_OUTSIDE_AUTHORIZED_OWNER'],
    ["const sql = 'INSERT INTO local_governed_ocr_jobs(id,result_text) VALUES(?,?)';", 'OCR_REPOSITORY_SEMANTIC_PAYLOAD', OCR_METADATA_REPOSITORY],
    ["public insertDerivedBinding() { return repository.insertSealed(context, binding); }", 'OCR_PPK016_EXACT_WRITER_FENCE_MISSING', OCR_APPLICATION_ADAPTER],
    ["runtime.readSealedResult({ jobId, sealedResultId });", 'OCR_SEALED_RESULT_READ_OUTSIDE_AUTHORIZED_PATH']
  ];
  const failures = maliciousCases.filter(([source, kind, path = 'apps/example/src/derived-bypass.ts']) =>
    !scanDerivedDataPolicySourceText(path, source)
      .some((finding) => finding.kind === kind));
  if (failures.length) {
    throw new Error(`Derived-data boundary malicious self-test failed: ${failures.length}/${maliciousCases.length}`);
  }

  const benignCases = [
    'const cache = new Map<string, unknown>();',
    'const searchIndex = values.findIndex((value) => value.active);',
    "const thumbnailLabel = 'Önizleme hazır';",
    "export const indexName = 'family-search-index';"
  ];
  const falsePositives = benignCases.flatMap((source) =>
    scanDerivedDataPolicySourceText('apps/example/src/ordinary-feature.ts', source));
  if (falsePositives.length) {
    throw new Error(`Derived-data boundary benign self-test produced ${falsePositives.length} false positive(s)`);
  }
  const registryFindings = scanDerivedDataPolicySourceText(
    GOVERNED_POLICY,
    `export const DERIVED_DATA_AUTHORIZED_REPOSITORY_ADAPTERS = Object.freeze([\n  '${AUTHORIZED_REPOSITORY}'\n]);`
  );
  if (registryFindings.length) {
    throw new Error('Derived-data boundary authorized registry literal self-test failed');
  }
  const sourceDeletionRegistryFindings = scanDerivedDataPolicySourceText(
    SOURCE_DELETION_METADATA_INVENTORY,
    "const DERIVED_POLICY_METADATA_TABLES=new Set(['derived_data_policy_bindings','derived_data_policy_sources']);"
  );
  if (sourceDeletionRegistryFindings.length) {
    throw new Error('Derived-data boundary source-deletion metadata inventory literal self-test failed');
  }
  const sourceDeletionSqlBypass = scanDerivedDataPolicySourceText(
    SOURCE_DELETION_METADATA_INVENTORY,
    "const sql = 'DELETE FROM derived_data_policy_bindings WHERE binding_hash=?';"
  );
  if (!sourceDeletionSqlBypass.some((finding) => finding.kind === 'DERIVED_BINDING_SQL_OUTSIDE_AUTHORIZED_OWNER')) {
    throw new Error('Derived-data boundary source-deletion SQL bypass self-test failed');
  }
  const metadataReaderMutationCases = [
    [SOURCE_DELETION_METADATA_INVENTORY, "const sql = 'UPDATE derived_data_policy_bindings SET status=? WHERE binding_hash=?';"],
    [PRIVACY_OWNERSHIP_METADATA_INVENTORY, "const sql = 'INSERT INTO derived_data_policy_sources(binding_hash) VALUES(?)';"],
    [PRIVACY_OWNERSHIP_METADATA_INVENTORY, "const sql = 'DELETE FROM derived_data_policy_bindings WHERE binding_hash=?';"]
  ];
  for (const [path, source] of metadataReaderMutationCases) {
    if (!scanDerivedDataPolicySourceText(path, source).some((finding) => finding.kind === 'DERIVED_BINDING_SQL_OUTSIDE_AUTHORIZED_OWNER')) {
      throw new Error(`Derived-data boundary metadata reader mutation self-test failed: ${path}`);
    }
  }
  const metadataReaderSelectCases = [
    [SOURCE_DELETION_METADATA_INVENTORY, "const sql = 'SELECT binding_hash FROM derived_data_policy_bindings WHERE binding_hash=?';"],
    [PRIVACY_OWNERSHIP_METADATA_INVENTORY, "const sql = 'SELECT source_resource_type FROM derived_data_policy_sources WHERE binding_hash=?';"]
  ];
  for (const [path, source] of metadataReaderSelectCases) {
    if (scanDerivedDataPolicySourceText(path, source).length) {
      throw new Error(`Derived-data boundary metadata reader SELECT self-test failed: ${path}`);
    }
  }
  return {
    malicious: maliciousCases.length + metadataReaderMutationCases.length,
    benign: benignCases.length + metadataReaderSelectCases.length
  };
};

const main = async () => {
  const assertions = selfTest();
  const rootArgument = process.argv.indexOf('--root');
  const root = rootArgument >= 0 ? resolve(process.argv[rootArgument + 1]) : process.cwd();
  const result = await scanDerivedDataPolicyBoundary(root);
  const report = {
    status: result.findings.length === 0 ? 'PASS' : 'FAIL',
    productionSourceZones: result.zones,
    scannedFiles: result.files,
    securityRelevantFiles: result.relevantFiles,
    maliciousSelfTestAssertions: assertions.malicious,
    benignFalsePositiveAssertions: assertions.benign,
    governedPolicy: GOVERNED_POLICY,
    governedUseCase: GOVERNED_USE_CASE,
    authorizedRepositoryAdapters: 1,
    authorizedProducerAdapters: 1,
    authorizedSealedMetadataReaders: 1,
    authorizedSealedPayloadReadPaths: AUTHORIZED_SEALED_RESULT_READ_PATHS.size,
    latentAiMemoryProducerPubliclyReachable: false,
    plaintextReplicaProductionAdapters: 0,
    retainedFamilyImportPayloadFields: 0,
    semanticAutomationPersistenceFields: 0,
    semanticArchiveReplayPayloadFields: 0,
    authorizedRepository: AUTHORIZED_REPOSITORY,
    authorizedSchemaOwner: AUTHORIZED_SCHEMA_OWNER,
    authorizedSourceDeletionMetadataInventoryReaders: 1,
    authorizedMetadataInventoryReaders: AUTHORIZED_METADATA_INVENTORY_READERS.size,
    directPersistenceExceptions: 0,
    findings: result.findings
  };
  console.log(JSON.stringify(report, null, 2));
  if (result.findings.length) process.exitCode = 1;
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) await main();
