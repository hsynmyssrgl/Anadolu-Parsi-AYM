import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const RELEASE = 'Bronze 04.08.2026.29';

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
};
const stableStringify = (value) => JSON.stringify(stable(value));
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const bind = async (id, path) => {
  const bytes = await readFile(path);
  return { id, path, sizeBytes: bytes.length, sha256: sha256(bytes) };
};
const csvEscape = (value) => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const paths = {
  d2aRegistry: 'artifacts/inventory/29-D2-A_INPUT_REGISTRY.json',
  d2bInventory: 'artifacts/inventory/29-D2-B_DOCUMENT_INVENTORY.json',
  d2cCrosswalk: 'artifacts/inventory/29-D2-C_CROSSWALK.json',
  d2cGaps: 'artifacts/inventory/29-D2-C_GAP_REGISTER.json',
  d2aReceipt: 'artifacts/checkpoints/29-D2-A_FINALIZATION_LIBRARY_RECEIPT.json',
  d2bReceipt: 'artifacts/checkpoints/29-D2-B_FINALIZATION_LIBRARY_RECEIPT.json',
  d2cReceipt: 'artifacts/checkpoints/29-D2-C_FINALIZATION_LIBRARY_RECEIPT.json',
  d2d0Receipt: 'artifacts/checkpoints/29-D2-D0_LIBRARY_RECEIPT.json',
  d2d0Readback: 'artifacts/checkpoints/29-D2-D0_RECEIPT_READBACK_VERIFICATION.json',
  workPlan: 'artifacts/inventory/snapshots/29-D2-D1_WORK_PLAN_AT_GENERATION.json'
};
const livePlanPath = 'config/work-segmentation-plan.json';

const [d2a, d2b, d2c, gaps, aReceipt, bReceipt, cReceipt, d0Receipt, d0Readback, plan] = await Promise.all([
  readJson(paths.d2aRegistry), readJson(paths.d2bInventory), readJson(paths.d2cCrosswalk), readJson(paths.d2cGaps),
  readJson(paths.d2aReceipt), readJson(paths.d2bReceipt), readJson(paths.d2cReceipt),
  readJson(paths.d2d0Receipt), readJson(paths.d2d0Readback), readJson(livePlanPath)
]);

const bindings = [];
for (const [id, path] of Object.entries(paths)) bindings.push(await bind(id, path));

const preservedGaps = (gaps.gaps ?? []).map((gap) => ({ ...gap, countedAsPass: false }));
const gapStatusCounts = preservedGaps.reduce((acc, gap) => {
  acc[gap.status] = (acc[gap.status] ?? 0) + 1;
  return acc;
}, {});
const d3ReviewGapIds = preservedGaps
  .filter((gap) => String(gap.severity).includes('D3') || String(gap.nextAction).startsWith('D3'))
  .map((gap) => gap.id);

const consolidatedSummary = {
  authoritativeInputs: {
    inputCount: d2a.summary.inputCount,
    availabilityCounts: d2a.summary.availabilityCounts,
    activeAuthorityPathCount: d2a.summary.activeAuthorityPathCount,
    inputSetFingerprintSha256: d2a.inputSetFingerprintSha256
  },
  documents: {
    documentCount: d2b.summary.documentCount,
    governedClassificationCounts: d2b.summary.governedClassificationCounts,
    authorityGroupCounts: d2b.summary.authorityGroupCounts,
    activeAuthorityCount: d2b.summary.activeAuthorityCount,
    activeReferenceCount: d2b.summary.activeReferenceCount,
    historicalDocumentCount: d2b.summary.historicalDocumentCount,
    supportDocumentCount: d2b.summary.supportDocumentCount,
    externalRecordLimitationCount: d2b.summary.externalRecordLimitationCount,
    sourceClassificationCorrectionCount: d2b.summary.sourceClassificationCorrectionCount,
    inventoryFingerprintSha256: d2b.inventoryFingerprintSha256
  },
  crosswalk: {
    ...d2c.summary,
    crosswalkFingerprintSha256: d2c.crosswalkFingerprintSha256,
    relationFingerprintSha256: d2c.relationFingerprintSha256,
    gapFingerprintSha256: d2c.gapFingerprintSha256
  },
  gaps: {
    total: preservedGaps.length,
    unresolved: preservedGaps.filter((gap) => gap.status !== 'RESOLVED').length,
    statusCounts: gapStatusCounts,
    countedAsPass: preservedGaps.filter((gap) => gap.countedAsPass).length,
    d3ReviewGapIds,
    fingerprintSha256: gaps.gapFingerprintSha256
  }
};

const fingerprintBasis = {
  release: RELEASE,
  sourceBindings: Object.fromEntries(bindings.map((entry) => [entry.id, entry.sha256])),
  consolidatedSummary,
  gaps: preservedGaps
};

const output = {
  schemaVersion: 1,
  release: RELEASE,
  workStep: '29-D2-D1',
  parentStep: '29-D2-D',
  parentOfficialStep: '29-D2',
  title: 'Consolidated 29-D2 inventory closure draft',
  status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT',
  validationStatus: 'PENDING',
  persistentReceiptStatus: 'PENDING',
  parentCompletionClaimed: false,
  parentStepStatus: 'IN_PROGRESS',
  nextSubstepOnPass: '29-D2-D2',
  authorityPolicy: {
    d2aD2bD2cAreImmutableInputs: true,
    historicalFilesModified: false,
    failed29DAttemptOverlayApplied: false,
    unavailableContentInvented: false,
    openGapsCountedAsPass: false,
    d3MayResolveOnlyThroughGovernedSupersession: true
  },
  recoveryBinding: {
    baseCheckpoint: '29-D2-D0',
    baseExactSourceArchiveSha256: 'ccf4aa3b520bd444e5399af82201100cc2b52bcfab9a990bf5840bfa0f57eae6',
    d2d0ReceiptStatus: d0Receipt.status,
    d2d0ReceiptSha256: (await bind('d2d0Receipt', paths.d2d0Receipt)).sha256,
    d2d0ReadbackStatus: d0Readback.status,
    workPlanCurrentStep: plan.currentStep
  },
  sourceBindings: bindings,
  completedSubsteps: [
    { id: '29-D2-A', status: aReceipt.officialStepStatus, validationStatus: aReceipt.validationStatus, persistentReceiptStatus: aReceipt.persistentReceiptStatus, archiveSha256: aReceipt.mainCheckpoint.archiveSha256 },
    { id: '29-D2-B', status: bReceipt.officialStepStatus, validationStatus: bReceipt.validationStatus, persistentReceiptStatus: bReceipt.persistentReceiptStatus, archiveSha256: bReceipt.mainCheckpoint.archiveSha256 },
    { id: '29-D2-C', status: cReceipt.officialStepStatus, validationStatus: cReceipt.validationStatus, persistentReceiptStatus: cReceipt.persistentReceiptStatus, archiveSha256: cReceipt.mainCheckpoint.archiveSha256 }
  ],
  consolidatedSummary,
  gaps: preservedGaps,
  consolidatedFingerprintSha256: sha256(Buffer.from(stableStringify(fingerprintBasis))),
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};

await mkdir('artifacts/inventory', { recursive: true });
await mkdir('docs/audit', { recursive: true });
await writeFile('artifacts/inventory/29-D2-D1_CONSOLIDATED_INVENTORY.json', JSON.stringify(output, null, 2) + '\n');

const csvRows = [
  ['id','category','severity','status','affectedCount','source','detail','nextAction','countedAsPass'],
  ...preservedGaps.map((gap) => [gap.id,gap.category,gap.severity,gap.status,gap.affectedCount,gap.source,gap.detail,gap.nextAction,gap.countedAsPass])
];
await writeFile('artifacts/inventory/29-D2-D1_GAP_REGISTER.csv', csvRows.map((row) => row.map(csvEscape).join(',')).join('\n') + '\n');

const req = consolidatedSummary.crosswalk.requirementStatusCounts;
const md = `# 29-D2-D1 — Birleşik Envanter Kapanış Taslağı\n\n` +
`- Görünür sürüm: **${RELEASE}**\n` +
`- Alt adım: **29-D2-D1**\n` +
`- Durum: **LOCAL_PASS_AWAITING_LIBRARY_RECEIPT**\n` +
`- Üst adım 29-D2-D: **IN_PROGRESS / TAMAMLANMA İDDİASI YOK**\n` +
`- Sonraki alt adım: **29-D2-D2**\n\n` +
`## Birleştirilen doğrulanmış kaynaklar\n\n` +
`- 29-D2-A: ${d2a.summary.inputCount} girdi; ${d2a.summary.availabilityCounts.AVAILABLE} AVAILABLE, ${d2a.summary.availabilityCounts.PARTIAL} PARTIAL, ${d2a.summary.availabilityCounts.UNAVAILABLE} UNAVAILABLE.\n` +
`- 29-D2-B: ${d2b.summary.documentCount} belge; ${d2b.summary.activeAuthorityCount} aktif otorite, ${d2b.summary.historicalDocumentCount} tarihsel belge.\n` +
`- 29-D2-C: ${d2c.summary.correspondenceEventCount} yazışma olayı, ${d2c.summary.buildCount} build, ${d2c.summary.decisionUnionCount} karar, ${d2c.summary.requirementCount} gereksinim, ${d2c.summary.ruleCount} kural ve ${d2c.summary.relationCount} ilişki.\n\n` +
`## Gereksinim gerçekliği\n\n` +
`- COMPLETE: ${req.COMPLETE}\n- FOUNDATION_STARTED: ${req.FOUNDATION_STARTED}\n- PARTIAL: ${req.PARTIAL}\n- NOT_IMPLEMENTED: ${req.NOT_IMPLEMENTED}\n\n` +
`## Açık boşluklar\n\n` +
`- Toplam açık boşluk: **${preservedGaps.length}**\n` +
`- PASS sayılan açık boşluk: **0**\n` +
`- Tam sohbet dışa aktarımı: **UNAVAILABLE**\n` +
`- Önceki sohbet kapasitesi: **UNAVAILABLE**\n` +
`- D3 incelemesine taşınan boşluklar: **${d3ReviewGapIds.join(', ') || 'YOK'}**\n\n` +
`Birleşik envanter, 29-D2-A/B/C kanıtlarını değiştirmez; yalnız exact SHA bağlarıyla tek görünümde toplar.\n\n` +
`**${TRUTH}**\n`;
await writeFile('docs/audit/29-D2-D1_BIRLESIK_ENVANTER_TASLAGI.md', md);
console.log(`29-D2-D1 consolidated inventory generated: ${preservedGaps.length} gaps / fingerprint ${output.consolidatedFingerprintSha256}.`);
