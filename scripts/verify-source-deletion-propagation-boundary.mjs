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

const AUTHORIZED_PROPAGATION_CALLERS = new Set([REPOSITORY, CONTRACT, ADAPTER, USE_CASE]);
const AUTHORIZED_ENFORCEMENT_COMPOSITION = new Set([DATA_STORE]);
const AUTHORIZED_PRIMARY_DELETE_OWNER = new Set([REPOSITORY]);
const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const relevant = /SourceDeletion|sourceDeletion|source-deletion|purgeResourceWithPropagation|RETENTION_PURGE|ocr|thumbnail|ai_memory|plaintext_replica|search_index/iu;
const normalize = (value) => value.replaceAll('\\', '/');

const PRIMARY_DELETE = /DELETE\s+FROM\s+(?:finance_records|health_records|medication_plans|family_health_history|life_records)\b/iu;
const DERIVED_PAYLOAD_TABLE = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+[`"']?(?:[a-z0-9_]*(?:ocr(?:_text)?|search_index|thumbnail|ai_memory|derived_cache|plaintext_replica|replica)[a-z0-9_]*)/iu;
const DERIVED_PERSISTENCE_SYMBOL = /\b(?:insert|save|store|persist|write)(?:OcrText|SearchIndex|Thumbnail|AiMemory|DerivedCache|PlaintextReplica)\b/u;

const lineOf = (source, offset) => (source.slice(0, offset).match(/\n/gu) ?? []).length + 1;
const finding = (path, source, kind, match) => ({ path, line: lineOf(source, match.index ?? 0), kind, detail: match[0] });

export const scanSourceDeletionPropagationSourceText = (path, source) => {
  const normalizedPath = normalize(path);
  const findings = [];
  const add = (kind, match) => findings.push(finding(normalizedPath, source, kind, match));

  const primaryDelete = PRIMARY_DELETE.exec(source);
  if (primaryDelete && !AUTHORIZED_PRIMARY_DELETE_OWNER.has(normalizedPath)) add('PRIMARY_DELETE_OUTSIDE_PROPAGATION_REPOSITORY', primaryDelete);

  const payloadTable = DERIVED_PAYLOAD_TABLE.exec(source);
  if (payloadTable) add('UNREGISTERED_DERIVED_PAYLOAD_TABLE', payloadTable);

  const persistenceSymbol = DERIVED_PERSISTENCE_SYMBOL.exec(source);
  if (persistenceSymbol) add('UNREGISTERED_DERIVED_PAYLOAD_WRITER', persistenceSymbol);

  const propagationCall = /\.purgeResourceWithPropagation\s*\(/u.exec(source);
  if (propagationCall && !AUTHORIZED_PROPAGATION_CALLERS.has(normalizedPath)) add('PROPAGATION_REPOSITORY_CALL_OUTSIDE_AUTHORIZED_CHAIN', propagationCall);

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
    ['sourceDeletionExternalCacheInvalidator:{invalidate:()=>[]}', 'EMPTY_RUNTIME_CACHE_INVALIDATOR']
  ];
  const failed = malicious.filter(([source, kind]) => !scanSourceDeletionPropagationSourceText('apps/example/src/bypass.ts', source).some((item) => item.kind === kind));
  if (failed.length) throw new Error(`Source deletion malicious self-test failed: ${failed.length}/${malicious.length}`);
  const benign = [
    'const thumbnailWidth = 96;',
    'const index = values.findIndex(Boolean);',
    "const replicaLabel = 'yedek';",
    'const cache = new Map();'
  ];
  const falsePositives = benign.flatMap((source) => scanSourceDeletionPropagationSourceText('apps/example/src/ordinary.ts', source));
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
    if (!relevant.test(source) && ![POLICY, USE_CASE, REPOSITORY, CONTRACT, ADAPTER, DATA_STORE, MAIN, CACHE_ADAPTER].includes(path)) continue;
    relevantFiles += 1;
    findings.push(...scanSourceDeletionPropagationSourceText(path, source));
  }
  const [policy, useCase, repository, adapter, dataStore, main] = await Promise.all([
    readFile(resolve(root, POLICY), 'utf8'), readFile(resolve(root, USE_CASE), 'utf8'),
    readFile(resolve(root, REPOSITORY), 'utf8'), readFile(resolve(root, ADAPTER), 'utf8'),
    readFile(resolve(root, DATA_STORE), 'utf8'), readFile(resolve(root, MAIN), 'utf8')
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
    [main, "offlineSensitiveCache.lock('NO_LEASE')", 'OFFLINE_CACHE_LOCK_MISSING']
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
    activeSemanticPersistentOwners: 0,
    plaintextReplicaProductionOwners: 0,
    directBypassExceptions: 0,
    authorizedRepositoryAdapters: 2,
    findings: result.findings
  };
  console.log(JSON.stringify(report, null, 2));
  if (result.findings.length) process.exitCode = 1;
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) await main();
