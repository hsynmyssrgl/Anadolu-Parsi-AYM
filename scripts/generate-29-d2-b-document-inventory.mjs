import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { csvEscape } from './lib/governance-utils.mjs';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sha256File = async (path) => sha256(await readFile(path));

const base = 'artifacts/inventory/29-D2-B_inputs';
const documentIndexPath = `${base}/ALL_DOCUMENTS_INDEX_AT_START.json`;
const artifactIndexPath = `${base}/PROJECT_ARTIFACT_INDEX_AT_START.json`;
const activeSetPath = `${base}/ACTIVE_DOCUMENT_SET_AT_START.json`;
const policyPath = `${base}/DOCUMENT_INVENTORY_POLICY_AT_START.json`;
const d2aInputsPath = `${base}/29-D2-A_INPUT_REGISTRY_AT_START.json`;
const d2aFinalReceiptPath = `${base}/29-D2-A_FINALIZATION_LIBRARY_RECEIPT_AT_START.json`;

const [documentIndex, artifactIndex, activeSet, policy, d2aInputs, d2aFinalReceipt] = await Promise.all([
  readJson(documentIndexPath), readJson(artifactIndexPath), readJson(activeSetPath), readJson(policyPath), readJson(d2aInputsPath), readJson(d2aFinalReceiptPath)
]);
const activeAuthority = new Set(activeSet.authorityOrder ?? []);
const authorityRank = new Map((activeSet.authorityOrder ?? []).map((path, index) => [path, index + 1]));

const governedClass = (path, sourceClass) => {
  if (activeAuthority.has(path)) return 'ACTIVE_AUTHORITY';
  if (sourceClass === 'ACTIVE_REFERENCE') return 'ACTIVE_REFERENCE';
  if (sourceClass === 'HISTORICAL') return 'HISTORICAL_ONLY';
  if (sourceClass === 'EVIDENCE') return 'EVIDENCE_ONLY';
  if (sourceClass === 'GENERATED') return 'GENERATED_RECORD';
  if (sourceClass === 'TEST_OR_GATE') return 'TEST_OR_GATE';
  return sourceClass;
};
const authorityGroup = (classification) => {
  if (classification === 'ACTIVE_AUTHORITY' || classification === 'ACTIVE_REFERENCE') return 'ACTIVE';
  if (classification === 'HISTORICAL_ONLY') return 'HISTORICAL';
  return 'SUPPORT';
};

const entries = (documentIndex.documents ?? []).map((document, index) => {
  const classification = governedClass(document.path, document.classification);
  return {
    id: `DOC-${String(index + 1).padStart(4, '0')}`,
    path: document.path,
    extension: document.extension,
    bytes: document.bytes,
    sha256: document.sha256,
    sourceIndexClassification: document.classification,
    governedClassification: classification,
    authorityGroup: authorityGroup(classification),
    authorityRank: authorityRank.get(document.path) ?? null,
    canOverrideActiveAuthority: classification === 'ACTIVE_AUTHORITY',
    historicalOverrideProhibited: classification === 'HISTORICAL_ONLY',
    availability: 'AVAILABLE',
    integrityRepresentation: document.sha256 === 'SELF_GENERATED_AFTER_INVENTORY' ? 'SELF_GENERATED_PLACEHOLDER' : 'SHA256_AT_INVENTORY_START'
  };
});

const counts = (key) => Object.fromEntries([...new Set(entries.map((entry) => entry[key]))].sort().map((value) => [value, entries.filter((entry) => entry[key] === value).length]));
const sourceClassificationCorrections = entries
  .filter((entry) => entry.governedClassification === 'ACTIVE_AUTHORITY' && entry.sourceIndexClassification !== 'ACTIVE_AUTHORITY')
  .map((entry) => ({
    path: entry.path,
    from: entry.sourceIndexClassification,
    to: entry.governedClassification,
    reason: 'active-document-set authority order overrides self-generated index classification'
  }));

const fingerprintMaterial = entries.map((entry) => [
  entry.id,
  entry.path,
  entry.sourceIndexClassification,
  entry.governedClassification,
  entry.authorityGroup,
  String(entry.authorityRank ?? ''),
  String(entry.bytes ?? ''),
  entry.sha256
].join('|')).join('\n');

const activeAuthoritySnapshots = await Promise.all((activeSet.authorityOrder ?? []).map(async (path, index) => {
  const snapshotPath = `${base}/active_authority_snapshot/${path}`;
  const bytes = await readFile(snapshotPath);
  return { originalPath: path, snapshotPath, authorityRank: index + 1, sizeBytes: bytes.length, sha256: sha256(bytes) };
}));

const externalRecordLimitations = (d2aInputs.entries ?? [])
  .filter((entry) => entry.availability !== 'AVAILABLE')
  .map((entry) => ({
    inputId: entry.id,
    title: entry.title,
    availability: entry.availability,
    limitation: entry.limitation,
    representedAsDocumentPath: entry.sourcePath ?? null
  }));

const generatedOutputPaths = [
  'artifacts/inventory/29-D2-B_DOCUMENT_INVENTORY.json',
  'artifacts/inventory/29-D2-B_DOCUMENT_INVENTORY.csv',
  'docs/audit/29-D2-B_AKTIF_TARIHSEL_BELGE_ENVANTERI.md',
  'scripts/generate-29-d2-b-document-inventory.mjs',
  'scripts/verify-29-d2-b-document-inventory.mjs',
  'scripts/run-29-d2-b-validation.mjs'
];
const validationOutputPaths = [
  'artifacts/validation/29-D2-B-document-inventory.json',
  'artifacts/validation/29-D2-B-validation-evidence.json'
];

const registry = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  workStep: '29-D2-B',
  title: 'Machine-readable active and historical document inventory',
  status: 'IN_PROGRESS_LOCAL_INVENTORY_CREATED_AWAITING_VALIDATION_AND_LIBRARY_RECEIPT',
  snapshotPolicy: 'INVENTORY_IS_BOUND_TO_29-D2-B_START_INDEX_SNAPSHOTS; STEP_OUTPUTS_ARE_DECLARED_SEPARATELY_TO_AVOID_SELF_HASH_RECURSION',
  authorityPolicy: {
    authorityOrderSource: activeSetPath,
    activeAuthorityCount: activeSet.authorityOrder.length,
    historicalCanOverrideActive: false,
    generatedOrEvidenceCanOverrideActive: false,
    unavailableRecordsInvented: false
  },
  sourceBindings: {
    documentIndexSnapshot: { path: documentIndexPath, sha256: await sha256File(documentIndexPath), documentCount: documentIndex.documentCount },
    artifactIndexSnapshot: { path: artifactIndexPath, sha256: await sha256File(artifactIndexPath), fileCount: artifactIndex.summary.totalFiles },
    activeDocumentSetSnapshot: { path: activeSetPath, sha256: await sha256File(activeSetPath), authorityCount: activeSet.authorityOrder.length },
    documentInventoryPolicySnapshot: { path: policyPath, sha256: await sha256File(policyPath) },
    d2aInputRegistrySnapshot: { path: d2aInputsPath, sha256: await sha256File(d2aInputsPath), inputSetFingerprintSha256: d2aInputs.inputSetFingerprintSha256 },
    d2aFinalizationReceiptSnapshot: { path: d2aFinalReceiptPath, sha256: await sha256File(d2aFinalReceiptPath), status: d2aFinalReceipt.status, officialStepStatus: d2aFinalReceipt.officialStepStatus }
  },
  summary: {
    documentCount: entries.length,
    governedClassificationCounts: counts('governedClassification'),
    authorityGroupCounts: counts('authorityGroup'),
    sourceClassificationCounts: counts('sourceIndexClassification'),
    activeAuthorityCount: entries.filter((entry) => entry.governedClassification === 'ACTIVE_AUTHORITY').length,
    activeReferenceCount: entries.filter((entry) => entry.governedClassification === 'ACTIVE_REFERENCE').length,
    historicalDocumentCount: entries.filter((entry) => entry.governedClassification === 'HISTORICAL_ONLY').length,
    supportDocumentCount: entries.filter((entry) => entry.authorityGroup === 'SUPPORT').length,
    externalRecordLimitationCount: externalRecordLimitations.length,
    sourceClassificationCorrectionCount: sourceClassificationCorrections.length
  },
  inventoryFingerprintSha256: sha256(Buffer.from(fingerprintMaterial)),
  sourceClassificationCorrections,
  activeAuthoritySnapshots,
  externalRecordLimitations,
  generatedOutputPaths,
  validationOutputPaths,
  documents: entries,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.'
};

await mkdir('artifacts/inventory', { recursive: true });
await writeFile('artifacts/inventory/29-D2-B_DOCUMENT_INVENTORY.json', `${JSON.stringify(registry, null, 2)}\n`);
const fields = ['id','path','extension','bytes','sha256','sourceIndexClassification','governedClassification','authorityGroup','authorityRank','canOverrideActiveAuthority','historicalOverrideProhibited','availability','integrityRepresentation'];
const csv = [fields.join(','), ...entries.map((entry) => fields.map((field) => csvEscape(entry[field])).join(','))].join('\n') + '\n';
await writeFile('artifacts/inventory/29-D2-B_DOCUMENT_INVENTORY.csv', csv);
await mkdir('docs/audit', { recursive: true });
const md = [
  '# 29-D2-B — Aktif ve Tarihsel Belge Envanteri',
  '',
  `- Snapshot belge sayısı: **${entries.length}**`,
  `- Aktif otorite: **${registry.summary.activeAuthorityCount}**`,
  `- Aktif referans: **${registry.summary.activeReferenceCount}**`,
  `- Tarihsel belge: **${registry.summary.historicalDocumentCount}**`,
  `- Destek/kanıt/üretilmiş/test belgesi: **${registry.summary.supportDocumentCount}**`,
  `- PARTIAL/UNAVAILABLE dış kayıt sınırlaması: **${externalRecordLimitations.length}**`,
  `- Kaynak sınıflandırma düzeltmesi: **${sourceClassificationCorrections.length}**`,
  `- Envanter fingerprint SHA-256: \`${registry.inventoryFingerprintSha256}\``,
  '',
  'Tarihsel, kanıt, test ve üretilmiş kayıtlar aktif otorite belgelerini geçersiz kılamaz.',
  '',
  registry.mandatoryTruthSentence,
  ''
].join('\n');
await writeFile('docs/audit/29-D2-B_AKTIF_TARIHSEL_BELGE_ENVANTERI.md', md);
console.log(`29-D2-B inventory generated: ${entries.length} documents / ${registry.summary.activeAuthorityCount} active authority / ${registry.summary.historicalDocumentCount} historical.`);
