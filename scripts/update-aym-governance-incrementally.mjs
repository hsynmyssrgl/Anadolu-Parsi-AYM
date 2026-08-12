import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';

const sourceRoot = resolve(process.cwd());
const aymRoot = resolve(sourceRoot, '..', '..');
const expectedRoot = 'C:\\PPT\\AYM';
const generatedUtc = new Date().toISOString();
const truth = 'Bu teslim, yukaridaki kanitlarla sinirlidir; calistirilmayan hicbir kontrol PASS sayilmamistir.';

if (sourceRoot !== resolve(expectedRoot, '06_KOD', 'app') || aymRoot !== resolve(expectedRoot)) {
  throw new Error(`Unsafe workspace root: source=${sourceRoot}; root=${aymRoot}`);
}

const paths = {
  manifest: resolve(aymRoot, '00_PROJE', 'MASTER_MANIFEST.json'),
  manifestCsv: resolve(aymRoot, '00_PROJE', 'MASTER_MANIFEST.csv'),
  manifestSummary: resolve(aymRoot, '00_PROJE', 'MANIFEST_OZETI.json'),
  incrementalEvidence: resolve(aymRoot, '00_PROJE', 'ARTIMLI_MANIFEST_GUNCELLEME_KANITI.json'),
  decisionRegister: resolve(aymRoot, '01_YONETIM', 'KARAR_SICILI.json'),
  decisionCsv: resolve(aymRoot, '01_YONETIM', 'KARAR_SICILI.csv'),
  ruleSource: resolve(sourceRoot, 'config', 'canonical-rule-registry.json'),
  ruleRegister: resolve(aymRoot, '01_YONETIM', 'KURAL_SICILI.json'),
  ruleCsv: resolve(aymRoot, '01_YONETIM', 'KURAL_SICILI.csv'),
  audit: resolve(sourceRoot, 'artifacts', 'inventory', 'BRONZE_CURRENT_COMPLETION_AUDIT.json'),
  completion30Z: resolve(sourceRoot, 'artifacts', 'checkpoints', '30-Z_COMPLETION_RECORD.json'),
  completion31A: resolve(sourceRoot, 'artifacts', 'checkpoints', '31-A_COMPLETION_RECORD.json'),
  completion31B: resolve(sourceRoot, 'artifacts', 'checkpoints', '31-B_COMPLETION_RECORD.json'),
  completion31C: resolve(sourceRoot, 'artifacts', 'checkpoints', '31-C_COMPLETION_RECORD.json'),
  completion31D: resolve(sourceRoot, 'artifacts', 'checkpoints', '31-D_COMPLETION_RECORD.json'),
  completion31E: resolve(sourceRoot, 'artifacts', 'checkpoints', '31-E_COMPLETION_RECORD.json'),
  completion31S: resolve(sourceRoot, 'artifacts', 'checkpoints', '31-S_COMPLETION_RECORD.json'),
  completion31T: resolve(sourceRoot, 'artifacts', 'checkpoints', '31-T_COMPLETION_RECORD.json'),
  receipt: resolve(aymRoot, '05_TEST', '30Z_LOCAL_RECEIPT', 'LATEST.json'),
  localReceiptRoot: resolve(aymRoot, '05_TEST', '30Z_LOCAL_RECEIPT'),
  activeSource: resolve(aymRoot, '06_KOD', 'AKTIF_KAYNAK.json'),
  backupRegister: resolve(aymRoot, '10_YEDEK', 'YEDEK_SICILI.json')
};

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hashFile = async (path) => sha256(await readFile(path));
const toPosix = (path) => path.split(sep).join('/');
const toWindows = (path) => path.replaceAll('/', '\\');
const rootRelative = (path) => toPosix(relative(aymRoot, path));

const writeChecked = async (path, content) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
  if (await readFile(path, 'utf8') !== content) throw new Error(`Readback mismatch: ${path}`);
};
const writeJson = async (path, value) => writeChecked(path, `${JSON.stringify(value, null, 2)}\n`);
const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value) ? value.join(' | ') : String(value);
  return `"${text.replaceAll('"', '""').replaceAll(/\r?\n/gu, ' ')}"`;
};
const toCsv = (rows, columns) => `\uFEFF${columns.map(csvCell).join(',')}\r\n${rows
  .map((row) => columns.map((column) => csvCell(row[column])).join(','))
  .join('\r\n')}\r\n`;
const exists = async (path) => {
  try { await access(path); return true; } catch { return false; }
};

const reconcileAuthoritativeSourceBackups = async (registeredBackups) => {
  const backups = [...registeredBackups];
  const knownPaths = new Set(backups.map((item) => String(item.path ?? '').replaceAll('\\', '/')));
  const protectionFiles = (await readdir(paths.localReceiptRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /^PROTECTION_[a-f0-9]{64}\.json$/u.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name, 'en'));

  for (const entry of protectionFiles) {
    const protection = await readJson(resolve(paths.localReceiptRoot, entry.name));
    const backupPath = String(protection.backup?.path ?? '').replaceAll('\\', '/');
    if (knownPaths.has(backupPath)) continue;
    if (protection.source !== '06_KOD/app'
      || !/^[a-f0-9]{64}$/u.test(String(protection.treeSha256 ?? ''))
      || !/^10_YEDEK\/AYM_AKTIF_KOD_[a-f0-9]{16}\.zip$/u.test(backupPath)
      || protection.localReceiptStatus !== 'LOCAL_RECEIPT_VERIFIED'
      || protection.readbackStatus !== 'PASS') {
      throw new Error(`Malformed immutable source-protection record: ${entry.name}`);
    }

    const backupAbsolute = resolve(aymRoot, ...backupPath.split('/'));
    if (!backupAbsolute.startsWith(`${resolve(aymRoot, '10_YEDEK')}${sep}`)) {
      throw new Error(`Unsafe historical backup path: ${backupPath}`);
    }
    const receiptPath = String(protection.receipt?.path ?? '').replaceAll('\\', '/');
    const receiptAbsolute = resolve(aymRoot, ...receiptPath.split('/'));
    if (!receiptAbsolute.startsWith(`${paths.localReceiptRoot}${sep}`)) {
      throw new Error(`Unsafe historical receipt path: ${receiptPath}`);
    }

    const [backupInfo, backupDigest, backupSidecar, receiptDigest, sourceReceipt] = await Promise.all([
      stat(backupAbsolute),
      hashFile(backupAbsolute),
      readFile(`${backupAbsolute}.sha256`, 'utf8'),
      hashFile(receiptAbsolute),
      readJson(receiptAbsolute)
    ]);
    const sidecarDigest = backupSidecar.trim().split(/\s+/u)[0]?.toLowerCase();
    if (backupInfo.size !== protection.backup.bytes
      || backupDigest !== protection.backup.sha256
      || sidecarDigest !== protection.backup.sha256
      || receiptDigest !== protection.receipt.sha256
      || sourceReceipt.treeSha256 !== protection.treeSha256
      || sourceReceipt.fileCount !== protection.fileCount
      || sourceReceipt.totalBytes !== protection.totalBytes) {
      throw new Error(`Historical source-protection readback mismatch: ${backupPath}`);
    }
    backups.push({
      path: backupPath,
      role: 'DETERMINISTIC_AUTHORITATIVE_SOURCE_LOCAL_PROTECTION',
      bytes: protection.backup.bytes,
      sha256: String(protection.backup.sha256).toUpperCase(),
      entries: protection.fileCount,
      sourceTreeSha256: protection.treeSha256,
      localReceiptStatus: protection.localReceiptStatus,
      externalLibraryReceiptStatus: protection.externalLibraryReceiptStatus,
      officialCompletionClaimed: protection.officialCompletionClaimed,
      coverage: 'Exact 06_KOD/app authoritative source tree; deterministic fixed-timestamp ZIP.'
    });
    knownPaths.add(backupPath);
  }
  return backups;
};

const snapshotTargets = [
  '00_PROJE/DURUM.json', '00_PROJE/DURUM.md', '00_PROJE/KAPSAM.json', '00_PROJE/YONETISIM_SICILI.json',
  '01_YONETIM/KARAR_SICILI.json', '01_YONETIM/KARAR_SICILI.csv',
  '01_YONETIM/KURAL_SICILI.json', '01_YONETIM/KURAL_SICILI.csv',
  '01_YONETIM/TEK_PLAN.json', '01_YONETIM/TEK_PLAN.md',
  '06_KOD/AKTIF_KAYNAK.json', '06_KOD/AKTIF_KAYNAK.md', '10_YEDEK/YEDEK_SICILI.json'
];

const createInitialSnapshot = async () => {
  const snapshotRoot = resolve(aymRoot, '09_ARSIV', 'YONETIM_GECMISI', '20260809_DEC152_ARTIMLI_BAGLAMA_ONCESI');
  const ledgerPath = resolve(snapshotRoot, 'ARSIV_KAYDI.json');
  if (await exists(ledgerPath)) return;
  const files = [];
  for (const rel of snapshotTargets) {
    const source = resolve(aymRoot, rel);
    if (!(await exists(source))) continue;
    const target = resolve(snapshotRoot, rel);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
    const info = await stat(target);
    files.push({ path: rel, bytes: info.size, sha256: await hashFile(target) });
  }
  await writeJson(ledgerPath, {
    schemaVersion: 1,
    id: 'DEC152-INCREMENTAL-GOVERNANCE-PRECHANGE-SNAPSHOT',
    createdUtc: generatedUtc,
    reason: 'DEC-152 root-register binding before safe incremental governance updates.',
    decision: 'DEC-152',
    deletionPerformed: false,
    files
  });
};

const normalizeEvidencePath = (value) => {
  const cleaned = value.replaceAll('\\', '/').replace(/^\.\.\/\.\.\//u, '');
  if (/^(00_PROJE|01_YONETIM|02_GEREKSINIM|03_TASARIM|04_UYGULAMA|05_TEST|06_KOD|07_DOKUMAN|08_VERI|09_ARSIV|10_YEDEK)\//u.test(cleaned)) return cleaned;
  if (/^(apps|artifacts|config|database|docs|packages|scripts|tests)\//u.test(cleaned)) return `06_KOD/app/${cleaned}`;
  return null;
};

const updateDecisionRegister = async (receipt) => {
  const register = await readJson(paths.decisionRegister);
  const records = Array.isArray(register.records) ? [...register.records] : [];
  const existing = new Set(records.map((record) => record.Id));
  const decisionsDir = resolve(sourceRoot, 'docs', 'decisions');
  const entries = (await readdir(decisionsDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /^DEC-\d{3}.*\.md$/u.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name, 'en'));
  for (const entry of entries) {
    const id = entry.name.match(/^(DEC-\d{3})/u)?.[1];
    if (!id) continue;
    const absolute = resolve(decisionsDir, entry.name);
    const content = await readFile(absolute, 'utf8');
    const title = content.match(/^#\s+(.+)$/mu)?.[1]?.trim() ?? entry.name.replace(/\.md$/u, '');
    const embeddedPaths = [...content.matchAll(/`([^`]+)`/gu)]
      .map((match) => normalizeEvidencePath(match[1]))
      .filter(Boolean);
    const canonicalPath = `06_KOD/app/docs/decisions/${entry.name}`;
    const evidencePaths = [...new Set([
      canonicalPath, '06_KOD/app/config/user-decision-ledger.json', ...embeddedPaths,
      receipt.receipt.path, receipt.backup.path
    ])];
    const digest = await hashFile(absolute);
    const refreshed = {
      Id: id,
      Title: title,
      DecisionText: null,
      EvidenceStatus: 'ACTIVE_STANDALONE_DOCUMENT',
      AuthorityClass: 'ACTIVE_SOURCE_DECISION_DOCUMENT',
      IndependentStandaloneDocument: true,
      EvidenceDate: '2026-08-09',
      Build: null,
      DateBasis: 'SOURCE_DOCUMENT',
      DateNature: 'EXPLICIT_CURRENT_USER_INSTRUCTION',
      CanonicalEvidencePath: canonicalPath,
      CanonicalEvidenceSha256: digest.toUpperCase(),
      SourceSectionSha256: null,
      Sources: [{ path: canonicalPath, sha256: digest.toUpperCase(), role: 'FULL_STANDALONE_DECISION_DOCUMENT' }],
      EvidenceFileCount: evidencePaths.length,
      EvidencePaths: evidencePaths,
      Context: content.replaceAll(/\s+/gu, ' ').slice(0, 320),
      WebAuditPath: null
    };
    const index = records.findIndex((record) => record.Id === id);
    if (index >= 0) records[index] = { ...records[index], ...refreshed };
    else records.push(refreshed);
    existing.add(id);
  }
  records.sort((left, right) => Number(left.Id.slice(4)) - Number(right.Id.slice(4)));
  const highest = Math.max(...records.map((record) => Number(record.Id.slice(4))));
  const present = new Set(records.map((record) => Number(record.Id.slice(4))));
  const missingIds = Array.from({ length: highest }, (_, index) => index + 1)
    .filter((number) => !present.has(number))
    .map((number) => `DEC-${String(number).padStart(3, '0')}`);
  const updated = {
    ...register,
    generatedUtc,
    authority: 'Explicit current user instruction + 06_KOD/app decision documents',
    range: `DEC-001..DEC-${String(highest).padStart(3, '0')}`,
    rangeSize: highest,
    evidencedDecisionIds: records.length,
    fullDecisionEvidenceIds: records.length,
    missingIds,
    activeStandaloneDocuments: records.filter((record) => record.IndependentStandaloneDocument).length,
    referenceOnlyDecisionIds: 0,
    records,
    structureDecisionsWithoutNewDecisionIds: [
      'C:\\PPT\\AYM is the sole project workspace root.',
      '06_KOD/app is the sole authoritative and editable source tree.',
      '09_ARSIV and 10_YEDEK are evidence and recovery surfaces, not editable sources.',
      'The frozen official 30-Z checkpoint is complete only through the DEC-158 external USB Library receipt chain.',
      'The focused official 31-A timeline-event checkpoint is complete only through the DEC-159 external USB Library receipt chain.',
      'The focused official 31-B family data import authorization checkpoint is complete only through the DEC-160 external USB Library receipt chain.',
      'The focused official 31-C family import multi-policy receipt batch checkpoint is complete only through the DEC-161 external USB Library receipt chain.',
      'The focused official 31-D reused-location exact read receipt checkpoint is complete only through the DEC-163 external USB Library receipt chain.',
      'The focused official 31-E B0-02 user-visible release boundary is complete only through the DEC-165 external USB Library receipt chain.',
      'The current editable source is externally protected on D: through the DEC-164 exact readback receipt.'
    ]
  };
  await writeJson(paths.decisionRegister, updated);
  const columns = [
    'Id', 'Title', 'EvidenceStatus', 'AuthorityClass', 'IndependentStandaloneDocument',
    'EvidenceDate', 'Build', 'DateBasis', 'CanonicalEvidencePath', 'CanonicalEvidenceSha256',
    'SourceSectionSha256', 'EvidencePaths', 'DecisionText'
  ];
  await writeChecked(paths.decisionCsv, toCsv(records, columns));
  return updated;
};

const updateRuleRegister = async () => {
  const source = await readJson(paths.ruleSource);
  const rules = Array.isArray(source.rules) ? source.rules : [];
  const activeRules = rules.filter((rule) => rule.state === 'ACTIVE').length;
  const supersededRules = rules.filter((rule) => rule.state === 'SUPERSEDED').length;
  const updated = {
    schemaVersion: 3,
    generatedUtc,
    authority: 'AYM/06_KOD/app/config/canonical-rule-registry.json',
    sourceSha256: (await hashFile(paths.ruleSource)).toUpperCase(),
    totalRules: rules.length,
    activeRules,
    supersededRules,
    rules
  };
  await writeJson(paths.ruleRegister, updated);
  await writeChecked(paths.ruleCsv, toCsv(rules, ['id', 'text', 'state', 'source', 'effectiveRelease']));
  return updated;
};

const selectNextWork = (audit) => {
  const remaining = Array.isArray(audit.remainingWork) ? audit.remainingWork : [];
  return remaining.find((item) => !Array.isArray(item.completionBlockers) || item.completionBlockers.length === 0)
    ?? remaining[0]
    ?? null;
};

const updateManagementRecords = async ({ audit, receipt, completion30Z, completion31A, completion31B, completion31C, completion31D, completion31E, completion31S, completion31T, decisions, rules }) => {
  if (receipt.localReceiptStatus !== 'LOCAL_RECEIPT_VERIFIED' || receipt.readbackStatus !== 'PASS') {
    throw new Error('Current authoritative source receipt is not locally verified.');
  }
  if (receipt.externalLibraryReceiptStatus !== 'PASS' || receipt.officialCompletionClaimed !== true
    || receipt.externalReceipt?.storageBackend !== 'EXTERNAL_USB_D_DRIVE'
    || !String(receipt.externalReceipt?.externalPath ?? '').startsWith('D:\\AYM_LIBRARY\\')) {
    throw new Error('Current-source external protection truth boundary is inconsistent.');
  }
  if (completion30Z.status !== 'PASS'
    || completion30Z.officialStepStatus !== 'COMPLETED'
    || completion30Z.persistentReceiptStatus !== 'PASS'
    || completion30Z.officialCompletionClaimed !== true) {
    throw new Error('Frozen 30-Z checkpoint external receipt is not a completed PASS chain.');
  }
  if (completion31A.status !== 'PASS'
    || completion31A.officialStepStatus !== 'COMPLETED'
    || completion31A.persistentReceiptStatus !== 'PASS'
    || completion31A.officialCompletionClaimed !== true) {
    throw new Error('Focused 31-A checkpoint external receipt is not a completed PASS chain.');
  }
  if (completion31B.status !== 'PASS'
    || completion31B.officialStepStatus !== 'COMPLETED'
    || completion31B.persistentReceiptStatus !== 'PASS'
    || completion31B.officialCompletionClaimed !== true) {
    throw new Error('Focused 31-B checkpoint external receipt is not a completed PASS chain.');
  }
  if (completion31C.status !== 'PASS'
    || completion31C.officialStepStatus !== 'COMPLETED'
    || completion31C.persistentReceiptStatus !== 'PASS'
    || completion31C.officialCompletionClaimed !== true) {
    throw new Error('Focused 31-C checkpoint external receipt is not a completed PASS chain.');
  }
  if (completion31D.status !== 'PASS'
    || completion31D.officialStepStatus !== 'COMPLETED'
    || completion31D.persistentReceiptStatus !== 'PASS'
    || completion31D.officialCompletionClaimed !== true) {
    throw new Error('Focused 31-D checkpoint external receipt is not a completed PASS chain.');
  }
  if (completion31E.status !== 'PASS'
    || completion31E.officialStepStatus !== 'COMPLETED'
    || completion31E.persistentReceiptStatus !== 'PASS'
    || completion31E.officialCompletionClaimed !== true
    || completion31E.storageBackend !== 'EXTERNAL_USB_D_DRIVE') {
    throw new Error('Focused 31-E checkpoint external receipt is not a completed PASS chain.');
  }
  if (completion31S.status !== 'PASS'
    || completion31S.officialStepStatus !== 'COMPLETED'
    || completion31S.persistentReceiptStatus !== 'PASS'
    || completion31S.officialCompletionClaimed !== true
    || completion31S.storageBackend !== 'EXTERNAL_USB_D_DRIVE'
    || audit.checkpoint31S?.officialCompletionClaimed !== true) {
    throw new Error('31-S checkpoint and Bronze audit are not a completed PASS chain.');
  }
  if (completion31T.status !== 'PASS'
    || completion31T.officialStepStatus !== 'COMPLETED'
    || completion31T.persistentReceiptStatus !== 'PASS'
    || completion31T.officialCompletionClaimed !== true
    || completion31T.storageBackend !== 'EXTERNAL_USB_D_DRIVE'
    || completion31T.PPK002 !== 'PARTIAL'
    || !['31-T', '33-D', '33-E'].includes(audit.currentStep)
    || audit.checkpoint31T?.officialCompletionClaimed !== true) {
    throw new Error('31-T checkpoint and Bronze audit are not a completed PASS chain.');
  }
  const nextWork = selectNextWork(audit);
  const statusCounts = audit.scope.statusCounts;
  const progress = audit.percentages;
  const decisionSummary = {
    range: decisions.range,
    fullDecisionEvidenceIds: decisions.fullDecisionEvidenceIds,
    missingIds: decisions.missingIds,
    path: '01_YONETIM/KARAR_SICILI.json'
  };
  const sourceSummary = {
    path: '06_KOD/app', files: receipt.fileCount, bytes: receipt.totalBytes,
    treeSha256: receipt.treeSha256, localReceiptStatus: receipt.localReceiptStatus,
    externalLibraryReceiptStatus: receipt.externalLibraryReceiptStatus,
    externalReceipt: receipt.externalReceipt, officialCompletionClaimed: true
  };
  const checkpointSummary = {
    step: '30-Z', status: completion30Z.officialStepStatus,
    persistentReceiptStatus: completion30Z.persistentReceiptStatus,
    officialCompletionClaimed: completion30Z.officialCompletionClaimed,
    receipt: completion30Z.persistentReceiptPath,
    libraryPath: completion30Z.libraryPath,
    storageBackend: completion30Z.storageBackend
  };
  const checkpoint31ASummary = {
    step: '31-A', status: completion31A.officialStepStatus,
    persistentReceiptStatus: completion31A.persistentReceiptStatus,
    officialCompletionClaimed: completion31A.officialCompletionClaimed,
    receipt: completion31A.persistentReceiptPath,
    libraryPath: completion31A.libraryPath,
    storageBackend: completion31A.storageBackend
  };
  const checkpoint31BSummary = {
    step: '31-B', status: completion31B.officialStepStatus,
    persistentReceiptStatus: completion31B.persistentReceiptStatus,
    officialCompletionClaimed: completion31B.officialCompletionClaimed,
    receipt: completion31B.persistentReceiptPath,
    libraryPath: completion31B.libraryPath,
    storageBackend: completion31B.storageBackend
  };
  const checkpoint31CSummary = {
    step: '31-C', status: completion31C.officialStepStatus,
    persistentReceiptStatus: completion31C.persistentReceiptStatus,
    officialCompletionClaimed: completion31C.officialCompletionClaimed,
    receipt: completion31C.persistentReceiptPath,
    libraryPath: completion31C.libraryPath,
    storageBackend: completion31C.storageBackend
  };
  const checkpoint31DSummary = {
    step: '31-D', status: completion31D.officialStepStatus,
    persistentReceiptStatus: completion31D.persistentReceiptStatus,
    officialCompletionClaimed: completion31D.officialCompletionClaimed,
    receipt: completion31D.persistentReceiptPath,
    libraryPath: completion31D.libraryPath,
    storageBackend: completion31D.storageBackend
  };
  const checkpoint31ESummary = {
    step: '31-E', status: completion31E.officialStepStatus,
    persistentReceiptStatus: completion31E.persistentReceiptStatus,
    officialCompletionClaimed: completion31E.officialCompletionClaimed,
    receipt: completion31E.persistentReceiptPath,
    libraryPath: completion31E.libraryPath,
    storageBackend: completion31E.storageBackend
  };
  const checkpoint31SSummary = {
    step: '31-S', status: completion31S.officialStepStatus,
    persistentReceiptStatus: completion31S.persistentReceiptStatus,
    officialCompletionClaimed: completion31S.officialCompletionClaimed,
    receipt: completion31S.persistentReceiptPath,
    libraryPath: completion31S.libraryPath,
    storageBackend: completion31S.storageBackend,
    boundary: 'VERSIONED_CUTOVER_DECISION_PREFLIGHT_READ_ONLY_NON_AUTHORITATIVE',
    successorDecisionCreated: completion31S.successorDecisionCreated,
    realUserCutoverConsentGranted: completion31S.realUserCutoverConsentGranted,
    newBuildIssued: completion31S.newBuildIssued
  };
  const checkpoint31TSummary = {
    step: '31-T', status: completion31T.officialStepStatus,
    persistentReceiptStatus: completion31T.persistentReceiptStatus,
    officialCompletionClaimed: completion31T.officialCompletionClaimed,
    receipt: completion31T.persistentReceiptPath,
    libraryPath: completion31T.libraryPath,
    storageBackend: completion31T.storageBackend,
    boundary: 'PPK002_FAMILY_IMPORT_GOVERNED_ROLLBACK_EXACT_DELETE_RECEIPT_FENCE',
    PPK002: completion31T.PPK002,
    requirementCompletionClaimed: completion31T.requirementCompletionClaimed,
    newBuildIssued: completion31T.newBuildIssued
  };
  const status = {
    schemaVersion: 3,
    generatedUtc,
    workspaceRoot: expectedRoot,
    organizationStatus: 'COMPLETED',
    projectStatus: 'BRONZE_ACTIVE_OPEN_SCOPE_31T_COMPLETED_CURRENT_SOURCE_EXTERNAL_PROTECTION_PASS',
    activeSource: sourceSummary,
    currentCheckpoint: '31-T',
    newBuildAssigned: false,
    lastClosedBuild: 228,
    officialStepCompletionClaimed: true,
    external30ZReceiptStatus: 'PASS',
    checkpoint30Z: checkpointSummary,
    external31AReceiptStatus: 'PASS',
    checkpoint31A: checkpoint31ASummary,
    external31BReceiptStatus: 'PASS',
    checkpoint31B: checkpoint31BSummary,
    external31CReceiptStatus: 'PASS',
    checkpoint31C: checkpoint31CSummary,
    external31DReceiptStatus: 'PASS',
    checkpoint31D: checkpoint31DSummary,
    external31EReceiptStatus: 'PASS',
    checkpoint31E: checkpoint31ESummary,
    external31SReceiptStatus: 'PASS',
    checkpoint31S: checkpoint31SSummary,
    external31TReceiptStatus: 'PASS',
    checkpoint31T: checkpoint31TSummary,
    currentSourceExternalProtectionStatus: 'PASS',
    bronzeAudit: {
      status: audit.status,
      officialWeightedPercent: progress.officialWeightedBronzePercent,
      strictRequirementPercent: progress.strictRequirementCompletionPercent,
      implementationChainPercent: progress.implementationChainCoveragePercent,
      statusCounts
    },
    rules: { total: rules.totalRules, active: rules.activeRules, superseded: rules.supersededRules },
    decisions: decisionSummary,
    nextCodingWork: nextWork,
    immutableEvidence: ['09_ARSIV', '10_YEDEK'],
    mandatoryTruthSentence: truth
  };
  await writeJson(resolve(aymRoot, '00_PROJE', 'DURUM.json'), status);
  await writeChecked(resolve(aymRoot, '00_PROJE', 'DURUM.md'), `# DURUM\n\nGuncelleme (UTC): ${generatedUtc}\n\n- Calisma koku: \`${expectedRoot}\`\n- Tek yetkili kaynak: \`06_KOD/app\`\n- Kaynak dosyasi: ${receipt.fileCount}\n- Kaynak agac SHA-256: \`${receipt.treeSha256}\`\n- Yerel kaynak receipt: **${receipt.localReceiptStatus}**\n- Dondurulmus 30-Z ve 31-A..31-T checkpoint zinciri: **PASS / COMPLETED**\n- Guncel checkpoint: **31-T**\n- 31-T siniri: **PPK-002 governed family import rollback exact delete receipt fence; PPK-002 PARTIAL**\n- Guncel C kaynak agaci harici D: korumasi: **PASS**\n- Yeni Build: **Verilmedi**\n- Resmi agirlikli Bronze: **%${progress.officialWeightedBronzePercent}**\n- Kati gereksinim kapanisi: **%${progress.strictRequirementCompletionPercent}** (${audit.scope.strictComplete}/${audit.scope.total})\n- Uygulama zinciri kapsami: **%${progress.implementationChainCoveragePercent}**\n- Siradaki eyleme uygun is: **${nextWork?.id ?? 'UNAVAILABLE'}**\n\n${truth}\n`);
  await writeJson(resolve(aymRoot, '00_PROJE', 'KAPSAM.json'), {
    schemaVersion: 3,
    generatedUtc,
    workspaceRoot: expectedRoot,
    projectRoot: expectedRoot,
    rootPolicy: 'C:\\PPT\\AYM is the sole project workspace root.',
    activeSource: sourceSummary,
    release: 'Bronze 04.08.2026.29',
    currentCheckpoint: '31-T',
    requirements: {
      total: audit.scope.total, statusCounts, priorityCounts: audit.scope.priorityCounts,
      strictComplete: audit.scope.strictComplete, incomplete: audit.scope.incompleteCount,
      implementationCoverage: audit.scope.implementationCoverage,
      governanceCoverage: audit.scope.governanceCoverage
    },
    governance: {
      singlePlan: '01_YONETIM/TEK_PLAN.md', rules: rules.totalRules,
      activeRules: rules.activeRules, supersededRules: rules.supersededRules, decisions: decisionSummary
    },
    historicalEvidencePolicy: 'IMMUTABLE_ARCHIVE_ONLY',
    officialCompletionClaimed: true,
    checkpoint30Z: checkpointSummary,
    checkpoint31A: checkpoint31ASummary,
    checkpoint31B: checkpoint31BSummary,
    checkpoint31C: checkpoint31CSummary,
    checkpoint31D: checkpoint31DSummary,
    checkpoint31E: checkpoint31ESummary,
    checkpoint31S: checkpoint31SSummary,
    checkpoint31T: checkpoint31TSummary,
    currentSourceExternalProtectionStatus: 'PASS',
    newBuildAssigned: false
  });
  await writeJson(resolve(aymRoot, '00_PROJE', 'YONETISIM_SICILI.json'), {
    schemaVersion: 3,
    generatedUtc,
    workspaceRoot: expectedRoot,
    precedence: [
      { rank: 1, authority: 'Explicit current user instruction', scope: 'Current AYM work and truth boundary' },
      { rank: 2, authority: '00_PROJE/KURAL.json and 01_YONETIM active registers', scope: 'Governance and structure' },
      { rank: 3, authority: '06_KOD/app source-native config and decisions', scope: 'Product source and accepted scope' },
      { rank: 4, authority: 'DEC-164 external USB source receipt', scope: 'Current authoritative source exact D: protection' },
      { rank: 5, authority: 'DEC-180 / 31-S external USB Library receipt', scope: 'Read-only non-authoritative versioned cutover decision preflight checkpoint only' },
      { rank: 6, authority: 'DEC-181 / 31-T external USB Library receipt', scope: 'PPK-002 family import governed rollback exact delete receipt fence checkpoint only' },
      { rank: 7, authority: 'DEC-165 external USB Library receipt', scope: 'Focused official 31-E B0-02 checkpoint only' },
      { rank: 8, authority: 'DEC-163 external USB Library receipt', scope: 'Focused official 31-D checkpoint only' },
      { rank: 9, authority: 'DEC-161 external USB Library receipt', scope: 'Focused official 31-C checkpoint only' },
      { rank: 10, authority: 'DEC-160/159/158 external USB receipts', scope: '31-B, 31-A and frozen 30-Z checkpoints' },
      { rank: 11, authority: 'Latest locally verified source receipt', scope: 'Current source local integrity bound to DEC-164 D: receipt' },
      { rank: 12, authority: '09_ARSIV and 10_YEDEK', scope: 'Immutable evidence and recovery only' }
    ],
    release: 'Bronze 04.08.2026.29',
    lastClosedBuild: 228,
    currentCheckpoint: '31-T',
    latestWorkingStatus: '31T_COMPLETED_CURRENT_SOURCE_EXTERNAL_PROTECTION_PASS',
    officialStepCompletionClaimed: true,
    checkpoint30Z: checkpointSummary,
    checkpoint31A: checkpoint31ASummary,
    checkpoint31B: checkpoint31BSummary,
    checkpoint31C: checkpoint31CSummary,
    checkpoint31D: checkpoint31DSummary,
    checkpoint31E: checkpoint31ESummary,
    checkpoint31S: checkpoint31SSummary,
    checkpoint31T: checkpoint31TSummary,
    currentSourceExternalProtectionStatus: 'PASS',
    newBuildAssigned: false,
    activeSource: sourceSummary,
    decisionRegister: decisionSummary,
    ruleRegister: { total: rules.totalRules, active: rules.activeRules, path: '01_YONETIM/KURAL_SICILI.json' },
    nextCodingWork: nextWork
  });

  const structureRulesPath = resolve(aymRoot, '00_PROJE', 'KURAL.json');
  const structureRules = await readJson(structureRulesPath);
  await writeJson(structureRulesPath, {
    ...structureRules,
    schema_version: 3,
    generated_utc: generatedUtc,
    workspace_root: expectedRoot,
    root_rule: 'C:/PPT/AYM is the sole project workspace root',
    active_source_policy: '06_KOD/app is the sole authoritative and editable source tree',
    manifest_policy: 'Reuse prior hashes only when path, size and mtime are unchanged; rehash new, moved and changed files.',
    deletion_policy: 'No file deletion; unnecessary copies may only move under 09_ARSIV with explanation and hashes.',
    receipt_policy: '30-Z through 31-T receipts close only their focused checkpoints; DEC-164 separately binds the current authoritative source to exact D: USB readback.',
    build_policy: 'No new Build number before every mandatory current gate and external receipt pass.'
  });

  const plan = {
    schemaVersion: 3,
    generatedUtc,
    release: 'Bronze 04.08.2026.29',
    lastClosedBuild: 228,
    current: {
      workingCheckpoint: '31-T', codingMode: 'DEC137_CLOSE_STARTED_THEN_P0_P1_P2',
      officialCompletionClaimed: true, localReceiptStatus: receipt.localReceiptStatus,
      external30ZReceiptStatus: 'PASS', currentSourceExternalProtectionStatus: 'PASS',
      external31AReceiptStatus: 'PASS',
      external31BReceiptStatus: 'PASS',
      external31CReceiptStatus: 'PASS',
      external31DReceiptStatus: 'PASS',
      external31EReceiptStatus: 'PASS',
      external31SReceiptStatus: 'PASS',
      external31TReceiptStatus: 'PASS',
      newBuildAssigned: false, nextCodingWork: nextWork
    },
    phases: [
      { order: 1, id: 'AYM-GOV', title: 'Single-root and single-source governance', status: 'COMPLETED_INCREMENTALLY' },
      { order: 2, id: 'BRONZE-INCOMPLETE-CLOSURE', title: 'Close PARTIAL and FOUNDATION_STARTED vertical slices', status: 'IN_PROGRESS' },
      { order: 3, id: 'P0-P1-P2', title: 'Continue new work in P0, P1 and P2 order after started slices', status: 'PENDING_PREVIOUS' },
      { order: 4, id: '30-Z-EXTERNAL-RECEIPT', title: 'External persistent USB Library receipt for the frozen official 30-Z checkpoint', status: 'COMPLETED' },
      { order: 5, id: '31-A-EXTERNAL-RECEIPT', title: 'External persistent USB Library receipt for the focused timeline-event checkpoint', status: 'COMPLETED' },
      { order: 6, id: '31-B-EXTERNAL-RECEIPT', title: 'External persistent USB Library receipt for the focused family data import authorization checkpoint', status: 'COMPLETED' },
      { order: 7, id: '31-C-EXTERNAL-RECEIPT', title: 'External persistent USB Library receipt for the focused family import multi-policy receipt batch checkpoint', status: 'COMPLETED' },
      { order: 8, id: '31-D-EXTERNAL-RECEIPT', title: 'External persistent USB Library receipt for reused-location exact read chain', status: 'COMPLETED' },
      { order: 9, id: '31-E-EXTERNAL-RECEIPT', title: 'External persistent USB Library receipt for B0-02 user-visible release boundary', status: 'COMPLETED' },
      { order: 10, id: '31-F-THROUGH-31-T-EXTERNAL-RECEIPTS', title: 'External persistent USB Library receipts through the 31-T PPK-002 governed rollback fence', status: 'COMPLETED' },
      { order: 11, id: 'CURRENT-SOURCE-EXTERNAL-PROTECTION', title: 'Exact current authoritative source protection on D:', status: 'COMPLETED' },
      { order: 12, id: 'BRONZE-BUILD-CANDIDATE', title: 'Prepare a new Bronze Build candidate only after all mandatory gates', status: 'BLOCKED_NOT_READY' }
    ],
    progress: {
      officialWeightedBronzePercent: progress.officialWeightedBronzePercent,
      strictRequirementCompletionPercent: progress.strictRequirementCompletionPercent,
      implementationChainCoveragePercent: progress.implementationChainCoveragePercent,
      statusCounts, silver: 'BLOCKED_NOT_READY', gold: 'BLOCKED_NOT_READY'
    },
    decisionRegister: decisionSummary,
    mandatoryTruthSentence: truth
  };
  await writeJson(resolve(aymRoot, '01_YONETIM', 'TEK_PLAN.json'), plan);
  await writeChecked(resolve(aymRoot, '01_YONETIM', 'TEK_PLAN.md'), `# AYM TEK PLAN\n\nGuncelleme (UTC): ${generatedUtc}\n\n## Baglayici sinir\n\n- Tek calisma koku: \`${expectedRoot}\`\n- Tek yetkili ve duzenlenebilir kaynak: \`06_KOD/app\`\n- Arsiv ve yedekler: salt-okunur kanit/geri donus yuzeyleri\n- Son kapali Build: **228**; yeni Build verilmedi\n- Dondurulmus 30-Z ve 31-A..31-T USB Library receipts: **PASS / COMPLETED**\n- Guncel checkpoint: **31-T**\n- 31-T PPK-002 governed family import rollback exact delete receipt fence dilimini kapatir; PPK-002 PARTIAL kalir.\n- Guncel C kaynak agaci harici D: korumasi: **PASS**\n\n## Gercek ilerleme\n\n- Resmi agirlikli Bronze: **%${progress.officialWeightedBronzePercent}**\n- Kati gereksinim kapanisi: **%${progress.strictRequirementCompletionPercent}** (${audit.scope.strictComplete}/${audit.scope.total})\n- Uygulama zinciri kapsami: **%${progress.implementationChainCoveragePercent}**\n- Durumlar: ${Object.entries(statusCounts).map(([key, value]) => `${key}=${value}`).join(', ')}\n\n## Uygulama sirasi\n\n1. PARTIAL ve FOUNDATION_STARTED yarim dilimleri kapat.\n2. Baslanmis isler bittikce P0, P1 ve P2 sirasina gec.\n3. Her guvenli gruptan sonra guncel denetim, yerel receipt, deterministik yedek ve artimli manifest uret.\n4. Checkpoint ve guncel kaynak makbuzlarini kendi kesin kapsamlarinda kullan.\n\nSiradaki eyleme uygun is: **${nextWork?.id ?? 'UNAVAILABLE'} - ${nextWork?.title ?? 'UNAVAILABLE'}**\n\n${truth}\n`);

  const currentActive = await readJson(paths.activeSource);
  await writeJson(paths.activeSource, {
    ...currentActive,
    schemaVersion: 3,
    generatedUtc,
    path: '06_KOD/app',
    sourceFiles: receipt.fileCount,
    sourceBytes: receipt.totalBytes,
    sourceTreeSha256: receipt.treeSha256,
    latestStatus: 'CURRENT_SOURCE_EXTERNAL_USB_PROTECTION_PASS',
    officialStepCompletionClaimed: true,
    official30ZCheckpointStatus: 'COMPLETED',
    official30ZPersistentReceiptStatus: 'PASS',
    official31ACheckpointStatus: 'COMPLETED',
    official31APersistentReceiptStatus: 'PASS',
    official31BCheckpointStatus: 'COMPLETED',
    official31BPersistentReceiptStatus: 'PASS',
    official31CCheckpointStatus: 'COMPLETED',
    official31CPersistentReceiptStatus: 'PASS',
    official31DCheckpointStatus: 'COMPLETED',
    official31DPersistentReceiptStatus: 'PASS',
    official31ECheckpointStatus: 'COMPLETED',
    official31EPersistentReceiptStatus: 'PASS',
    official31SCheckpointStatus: 'COMPLETED',
    official31SPersistentReceiptStatus: 'PASS',
    official31TCheckpointStatus: 'COMPLETED',
    official31TPersistentReceiptStatus: 'PASS',
    currentSourceExternalProtectionStatus: 'PASS',
    persistentReceiptStatus: 'PASS',
    localProtection: receipt
  });
  await writeChecked(resolve(aymRoot, '06_KOD', 'AKTIF_KAYNAK.md'), `# AKTIF KAYNAK\n\n- Tek yetkili yol: \`06_KOD/app\`\n- Dosya: ${receipt.fileCount}\n- Bayt: ${receipt.totalBytes}\n- Agac SHA-256: \`${receipt.treeSha256}\`\n- Yerel receipt: **${receipt.localReceiptStatus}**\n- Deterministik yedek: \`${receipt.backup.path}\`\n- Dondurulmus 30-Z ve 31-A..31-T harici receipts: **PASS / COMPLETED**\n- Guncel checkpoint: **31-T**\n- PPK-002: **PARTIAL**\n- Guncel C kaynak agaci harici D: korumasi: **PASS**\n- Yeni Build: **Verilmedi**\n\n${truth}\n`);

  const backupRegister = await readJson(paths.backupRegister);
  const backups = await reconcileAuthoritativeSourceBackups(Array.isArray(backupRegister.backups) ? backupRegister.backups : []);
  const currentBackup = {
    path: receipt.backup.path,
    role: 'DETERMINISTIC_AUTHORITATIVE_SOURCE_LOCAL_PROTECTION',
    bytes: receipt.backup.bytes,
    sha256: receipt.backup.sha256.toUpperCase(),
    entries: receipt.fileCount,
    sourceTreeSha256: receipt.treeSha256,
    localReceiptStatus: receipt.localReceiptStatus,
    externalLibraryReceiptStatus: receipt.externalLibraryReceiptStatus,
    officialCompletionClaimed: receipt.officialCompletionClaimed,
    coverage: 'Exact 06_KOD/app authoritative source tree; deterministic fixed-timestamp ZIP.'
  };
  const currentBackupIndex = backups.findIndex((item) => item.path === currentBackup.path);
  if (currentBackupIndex >= 0) backups[currentBackupIndex] = { ...backups[currentBackupIndex], ...currentBackup };
  else backups.push(currentBackup);
  backups.sort((left, right) => String(left.path).localeCompare(String(right.path), 'en'));
  await writeJson(paths.backupRegister, {
    ...backupRegister,
    schemaVersion: 6,
    generatedUtc,
    latestAuthoritativeSourceBackup: receipt.backup.path,
    backups
  });
};

const manifestOutputs = [
  '00_PROJE/ENVANTER.csv', '00_PROJE/ESLEME.csv', '00_PROJE/HASH_OZETI.csv',
  '00_PROJE/AYM_Master.csv', '00_PROJE/MASTER_MANIFEST.csv',
  '00_PROJE/MASTER_MANIFEST.json', '00_PROJE/MANIFEST_OZETI.json'
];
const roleFor = (rel) => {
  if (rel.startsWith('00_PROJE/')) return 'CURRENT_PROJECT_GOVERNANCE';
  if (rel.startsWith('01_YONETIM/')) return 'CURRENT_MANAGEMENT_GOVERNANCE';
  if (rel.startsWith('06_KOD/app/')) return 'ACTIVE_AUTHORITATIVE_SOURCE';
  if (rel.startsWith('09_ARSIV/')) return 'IMMUTABLE_ARCHIVE_EVIDENCE';
  if (rel.startsWith('10_YEDEK/')) return 'BACKUP';
  if (rel.includes('/DOSYALAR/')) return 'CLASSIFIED_CONTENT_REFERENCE';
  return 'SECTION_REFERENCE';
};
const scanMetadata = async () => {
  const files = [];
  const excluded = new Set([...manifestOutputs, rootRelative(paths.incrementalEvidence)]);
  const activeSourceEphemeral = new Set([
    '.git', '.cache', '.tmp', '.turbo', 'coverage', 'dist', 'node_modules', 'temp', 'tmp'
  ]);
  const visit = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const absolute = resolve(directory, entry.name);
      const rel = rootRelative(absolute);
      if (excluded.has(rel)) continue;
      if (rel.startsWith('06_KOD/app/')
        && entry.isDirectory()
        && activeSourceEphemeral.has(entry.name)) continue;
      if (entry.isSymbolicLink()) throw new Error(`Symbolic link is forbidden in live manifest: ${rel}`);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) {
        const info = await stat(absolute);
        files.push({ absolute, rel, size: info.size, mtimeMs: info.mtimeMs, mtime: info.mtime.toISOString() });
      }
    }
  };
  await visit(aymRoot);
  files.sort((left, right) => left.rel.localeCompare(right.rel, 'en'));
  return files;
};

const updateManifestIncrementally = async ({ audit, decisions, receipt, completion30Z, completion31A, completion31B, completion31C, completion31D, completion31E, completion31S, completion31T }) => {
  const baseline = await readJson(paths.manifest);
  const baselineRecords = Array.isArray(baseline.files) ? baseline.files : [];
  const baselineMap = new Map(baselineRecords.map((record) => [toPosix(record.RelativePath), record]));
  const metadata = await scanMetadata();
  const currentPaths = new Set(metadata.map((file) => file.rel));
  const removedRecords = baselineRecords.filter((record) => {
    const rel = toPosix(record.RelativePath);
    return !currentPaths.has(rel) && !manifestOutputs.includes(rel) && rel !== rootRelative(paths.incrementalEvidence);
  });
  const removedByHash = new Map();
  for (const record of removedRecords) {
    const key = String(record.Sha256).toLowerCase();
    if (!removedByHash.has(key)) removedByHash.set(key, []);
    removedByHash.get(key).push(toPosix(record.RelativePath));
  }
  const records = [];
  const stats = { unchangedHashesReused: 0, changedFilesRehashed: 0, newFilesRehashed: 0, movedFilesRehashed: 0, removedPaths: removedRecords.length };
  const hashedPaths = [];
  const moves = [];
  for (const file of metadata) {
    const old = baselineMap.get(file.rel);
    const sameMetadata = old && Number(old.Size) === file.size && Math.abs(Date.parse(old.LastWriteUtc) - file.mtimeMs) < 1.1;
    let digest;
    if (sameMetadata) {
      digest = String(old.Sha256).toLowerCase();
      stats.unchangedHashesReused += 1;
    } else {
      digest = await hashFile(file.absolute);
      hashedPaths.push(file.rel);
      if (old) {
        stats.changedFilesRehashed += 1;
      } else {
        const candidates = removedByHash.get(digest) ?? [];
        const movedFromIndex = candidates.findIndex((candidate) => basename(candidate) === basename(file.rel));
        if (movedFromIndex >= 0) {
          const [movedFrom] = candidates.splice(movedFromIndex, 1);
          stats.movedFilesRehashed += 1;
          moves.push({ from: movedFrom, to: file.rel, sha256: digest });
        } else {
          stats.newFilesRehashed += 1;
        }
      }
    }
    records.push({
      RelativePath: toWindows(file.rel),
      Section: file.rel.split('/')[0],
      Role: roleFor(file.rel),
      Size: file.size,
      LastWriteUtc: file.mtime,
      Sha256: digest.toUpperCase(),
      CanonicalPath: null,
      IsDuplicate: false,
      Status: 'PRESENT'
    });
  }
  const evidence = {
    schemaVersion: 1,
    id: 'AYM-INCREMENTAL-LIVE-MANIFEST-UPDATE',
    generatedUtc,
    workspaceRoot: expectedRoot,
    baselineManifestGeneratedUtc: baseline.generatedUtc,
    algorithm: 'Reuse SHA-256 only when normalized path, byte size and mtime are unchanged; rehash new, moved and changed files.',
    fullContentRehashPerformed: false,
    forbiddenRebuildScriptExecuted: false,
    stats,
    hashedPaths,
    moves,
    traceability: {
      decisions: ['DEC-152'], rules: ['PR-092', 'PR-094', 'PR-095', 'PR-208'],
      requirements: ['GOV-003', 'B9-03'],
      test: '06_KOD/app/scripts/verify-aym-governance-incremental-contract.mjs'
    },
    sourceTreeSha256: receipt.treeSha256,
    sourceFileCount: receipt.fileCount,
    localReceiptStatus: receipt.localReceiptStatus,
    external30ZReceiptStatus: completion30Z.persistentReceiptStatus,
    external31AReceiptStatus: completion31A.persistentReceiptStatus,
    external31BReceiptStatus: completion31B.persistentReceiptStatus,
    external31CReceiptStatus: completion31C.persistentReceiptStatus,
    external31DReceiptStatus: completion31D.persistentReceiptStatus,
    external31EReceiptStatus: completion31E.persistentReceiptStatus,
    external31SReceiptStatus: completion31S.persistentReceiptStatus,
    external31TReceiptStatus: completion31T.persistentReceiptStatus,
    officialCompletionClaimed: completion30Z.officialCompletionClaimed,
    currentSourceExternalProtectionStatus: receipt.externalLibraryReceiptStatus,
    newBuildAssigned: false
  };
  await writeJson(paths.incrementalEvidence, evidence);
  const evidenceInfo = await stat(paths.incrementalEvidence);
  records.push({
    RelativePath: toWindows(rootRelative(paths.incrementalEvidence)),
    Section: '00_PROJE',
    Role: 'CURRENT_PROJECT_GOVERNANCE',
    Size: evidenceInfo.size,
    LastWriteUtc: evidenceInfo.mtime.toISOString(),
    Sha256: (await hashFile(paths.incrementalEvidence)).toUpperCase(),
    CanonicalPath: null,
    IsDuplicate: false,
    Status: 'PRESENT'
  });
  records.sort((left, right) => left.RelativePath.localeCompare(right.RelativePath, 'en'));
  const canonicalByHash = new Map();
  for (const record of records) {
    const canonical = canonicalByHash.get(record.Sha256) ?? record.RelativePath;
    if (!canonicalByHash.has(record.Sha256)) canonicalByHash.set(record.Sha256, canonical);
    record.CanonicalPath = canonical;
    record.IsDuplicate = canonical !== record.RelativePath;
  }
  const sectionMap = new Map();
  for (const record of records) {
    const current = sectionMap.get(record.Section) ?? { section: record.Section, files: 0, bytes: 0 };
    current.files += 1;
    current.bytes += record.Size;
    sectionMap.set(record.Section, current);
  }
  const sections = [...sectionMap.values()].sort((left, right) => left.section.localeCompare(right.section, 'en'));
  const uniqueSha256 = canonicalByHash.size;
  const liveBytes = records.reduce((sum, record) => sum + record.Size, 0);
  const manifest = {
    schemaVersion: 6,
    generatedUtc,
    root: expectedRoot,
    updateMode: 'INCREMENTAL_METADATA_COMPARE_SELECTIVE_REHASH',
    baselineManifestGeneratedUtc: baseline.generatedUtc,
    fileCount: records.length,
    uniqueSha256,
    duplicatePaths: records.length - uniqueSha256,
    bytes: liveBytes,
    sections,
    selfExcluded: manifestOutputs.map(toWindows),
    incrementalEvidence: '00_PROJE\\ARTIMLI_MANIFEST_GUNCELLEME_KANITI.json',
    files: records
  };
  const manifestColumns = ['RelativePath', 'Section', 'Role', 'Size', 'LastWriteUtc', 'Sha256', 'CanonicalPath', 'IsDuplicate', 'Status'];
  const mappingColumns = ['RelativePath', 'Section', 'Role', 'CanonicalPath', 'Sha256', 'IsDuplicate', 'Status'];
  await writeChecked(resolve(aymRoot, '00_PROJE', 'ENVANTER.csv'), toCsv(records, manifestColumns));
  await writeChecked(resolve(aymRoot, '00_PROJE', 'ESLEME.csv'), toCsv(records, mappingColumns));
  await writeChecked(resolve(aymRoot, '00_PROJE', 'AYM_Master.csv'), toCsv(records, manifestColumns));
  await writeChecked(paths.manifestCsv, toCsv(records, manifestColumns));
  const hashRows = [...canonicalByHash.entries()].map(([digest, canonical]) => ({
    Sha256: digest,
    Size: records.find((record) => record.Sha256 === digest)?.Size ?? 0,
    PathCount: records.filter((record) => record.Sha256 === digest).length,
    CanonicalPath: canonical
  }));
  await writeChecked(resolve(aymRoot, '00_PROJE', 'HASH_OZETI.csv'), toCsv(hashRows, ['Sha256', 'Size', 'PathCount', 'CanonicalPath']));
  await writeJson(paths.manifest, manifest);
  await writeJson(paths.manifestSummary, {
    schemaVersion: 6,
    generatedUtc,
    workspaceRoot: expectedRoot,
    updateMode: manifest.updateMode,
    baselineManifestGeneratedUtc: baseline.generatedUtc,
    liveFileCount: records.length,
    liveUniqueSha256: uniqueSha256,
    liveDuplicatePaths: records.length - uniqueSha256,
    liveBytes,
    incrementalStats: stats,
    manifestSelfExcluded: manifest.selfExcluded,
    decisionEvidence: {
      range: decisions.range, fullDecisionEvidence: decisions.fullDecisionEvidenceIds,
      missing: decisions.missingIds, referenceOnly: decisions.referenceOnlyDecisionIds
    },
    bronzeProgress: audit.percentages,
    sourceProtection: {
      treeSha256: receipt.treeSha256, files: receipt.fileCount,
      localReceiptStatus: receipt.localReceiptStatus,
      external30ZReceiptStatus: completion30Z.persistentReceiptStatus,
      external31AReceiptStatus: completion31A.persistentReceiptStatus,
      external31BReceiptStatus: completion31B.persistentReceiptStatus,
      external31CReceiptStatus: completion31C.persistentReceiptStatus,
      external31DReceiptStatus: completion31D.persistentReceiptStatus,
      external31EReceiptStatus: completion31E.persistentReceiptStatus,
      external31SReceiptStatus: completion31S.persistentReceiptStatus,
      external31TReceiptStatus: completion31T.persistentReceiptStatus,
      currentSourceExternalProtectionStatus: receipt.externalLibraryReceiptStatus
    },
    officialCompletionClaimed: completion30Z.officialCompletionClaimed,
    newBuildAssigned: false
  });
  return { manifest, evidence };
};

await createInitialSnapshot();
const [audit, receipt, completion30Z, completion31A, completion31B, completion31C, completion31D, completion31E, completion31S, completion31T] = await Promise.all([
  readJson(paths.audit),
  readJson(paths.receipt),
  readJson(paths.completion30Z),
  readJson(paths.completion31A),
  readJson(paths.completion31B),
  readJson(paths.completion31C),
  readJson(paths.completion31D),
  readJson(paths.completion31E),
  readJson(paths.completion31S),
  readJson(paths.completion31T)
]);
const decisions = await updateDecisionRegister(receipt);
const rules = await updateRuleRegister();
await updateManagementRecords({ audit, receipt, completion30Z, completion31A, completion31B, completion31C, completion31D, completion31E, completion31S, completion31T, decisions, rules });
const { manifest, evidence } = await updateManifestIncrementally({ audit, decisions, receipt, completion30Z, completion31A, completion31B, completion31C, completion31D, completion31E, completion31S, completion31T });

console.log(`AYM incremental governance update: PASS; files=${manifest.fileCount}; reused=${evidence.stats.unchangedHashesReused}; rehashed=${evidence.hashedPaths.length}; moved=${evidence.stats.movedFilesRehashed}; source=${receipt.treeSha256}.`);
console.log(truth);
