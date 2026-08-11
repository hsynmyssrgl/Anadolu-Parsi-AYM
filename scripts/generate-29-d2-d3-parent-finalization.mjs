import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const RELEASE = 'Bronze 04.08.2026.29';
const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const stableStringify = (value) => JSON.stringify(stable(value));

const paths = {
  d0Receipt: 'artifacts/checkpoints/29-D2-D0_LIBRARY_RECEIPT.json',
  d0Readback: 'artifacts/checkpoints/29-D2-D0_RECEIPT_READBACK_VERIFICATION.json',
  d1Receipt: 'artifacts/checkpoints/29-D2-D1_FINALIZATION_LIBRARY_RECEIPT.json',
  d1Readback: 'artifacts/validation/29-D2-D1-finalization-receipt-readback-verification.json',
  d2Receipt: 'artifacts/checkpoints/29-D2-D2_FINALIZATION_LIBRARY_RECEIPT.json',
  d2Readback: 'artifacts/validation/29-D2-D2_FINALIZATION_RECEIPT_READBACK_VERIFICATION.json',
  d2Completion: 'artifacts/checkpoints/29-D2-D2_COMPLETION_RECORD.json',
  gaps: 'artifacts/inventory/29-D2-C_GAP_REGISTER.json',
  contradictions: 'artifacts/inventory/29-D2-D2_CONTRADICTION_REGISTER.json'
};

const values = await Promise.all(Object.values(paths).map(async (path) => ({
  path,
  bytes: await readFile(path),
  json: await readJson(path)
})));
const byPath = Object.fromEntries(values.map((value) => [value.path, value]));
const d0Receipt = byPath[paths.d0Receipt].json;
const d0Readback = byPath[paths.d0Readback].json;
const d1Receipt = byPath[paths.d1Receipt].json;
const d1Readback = byPath[paths.d1Readback].json;
const d2Receipt = byPath[paths.d2Receipt].json;
const d2Readback = byPath[paths.d2Readback].json;
const d2Completion = byPath[paths.d2Completion].json;
const gaps = byPath[paths.gaps].json;
const contradictions = byPath[paths.contradictions].json;

if (d0Receipt.status !== 'PASS' || d0Receipt.persistentWriteStatus !== 'PASS' || d0Readback.status !== 'PASS') {
  throw new Error('29-D2-D0 persistent receipt chain is not PASS');
}
for (const [name, receipt, readback] of [
  ['29-D2-D1', d1Receipt, d1Readback],
  ['29-D2-D2', d2Receipt, d2Readback]
]) {
  if (receipt.status !== 'PASS' || receipt.validationStatus !== 'PASS' || receipt.persistentReceiptStatus !== 'PASS' || readback.status !== 'PASS') {
    throw new Error(`${name} finalization receipt chain is not PASS`);
  }
}
if (d2Completion.status !== 'PASS' || d2Completion.officialSubstepStatus !== 'COMPLETED') {
  throw new Error('29-D2-D2 completion record is not PASS');
}
if (gaps.unresolvedGapCount !== 12 || gaps.gaps.filter((gap) => gap.countedAsPass).length !== 0) {
  throw new Error('Open gap truth is not preserved');
}
if (contradictions.openContradictionCount !== 3 || contradictions.countedAsPass !== 0) {
  throw new Error('Open contradiction truth is not preserved');
}

const receiptChain = [
  { id: '29-D2-D0', receiptPath: paths.d0Receipt, receiptSha256: sha256(byPath[paths.d0Receipt].bytes), readbackPath: paths.d0Readback, readbackSha256: sha256(byPath[paths.d0Readback].bytes), status: 'PASS' },
  { id: '29-D2-D1', receiptPath: paths.d1Receipt, receiptSha256: sha256(byPath[paths.d1Receipt].bytes), readbackPath: paths.d1Readback, readbackSha256: sha256(byPath[paths.d1Readback].bytes), status: 'PASS' },
  { id: '29-D2-D2', receiptPath: paths.d2Receipt, receiptSha256: sha256(byPath[paths.d2Receipt].bytes), readbackPath: paths.d2Readback, readbackSha256: sha256(byPath[paths.d2Readback].bytes), completionPath: paths.d2Completion, completionSha256: sha256(byPath[paths.d2Completion].bytes), status: 'PASS' }
];
const openTruth = {
  openGapCount: 12,
  openGapsCountedAsPass: 0,
  openContradictionCount: 3,
  contradictionsCountedAsPass: 0,
  routedTo29D3: 6,
  externalOrPlatformUnavailable: 4,
  historicalEvidenceRemediation: 2
};
const preservedFailures = [
  { path: 'artifacts/checkpoints/29-D2-D2_FIRST_COMBINED_VALIDATION_FAILURE.json', status: 'FAIL', result: '8/10', countedAsPass: false },
  { path: 'artifacts/checkpoints/29-D2-D1_FINALIZATION_FIRST_ATTEMPT_FAILURE.json', status: 'FAIL', countedAsPass: false },
  { path: 'artifacts/checkpoints/29-D2-D2_FINALIZATION_FIRST_ATTEMPT_FAILURE.json', status: 'FAIL', countedAsPass: false },
  { path: 'artifacts/checkpoints/29-D2-D2_FINALIZATION_GOVERNED_PREFLIGHT_WINDOWS_FAILURE.json', status: 'FAIL_PRESERVED_THEN_CORRECTED', countedAsPass: false },
  { path: 'artifacts/checkpoints/29-D2-D2_FINALIZATION_READBACK_FIRST_ATTEMPT_DIAGNOSTIC.json', status: 'DIAGNOSTIC_INVALID_NOT_PASS', countedAsPass: false },
  { path: 'artifacts/checkpoints/29-D2-D3_LOCAL_REVALIDATION_STATE_SYNC_FAILURE.json', status: 'FAIL', countedAsPass: false }
];
const fingerprintBasis = {
  release: RELEASE,
  step: '29-D2-D3',
  receiptChain,
  openTruth,
  preservedFailures,
  nextOfficialStep: '29-D3'
};
const record = {
  schemaVersion: 1,
  release: RELEASE,
  step: '29-D2-D3',
  parentStep: '29-D2-D',
  phase: 'PARENT_FINALIZATION_LOCAL_CHECKPOINT',
  title: 'Parent 29-D2-D finalization and authorization of 29-D3',
  status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT',
  validationStatus: 'PENDING',
  persistentReceiptStatus: 'PENDING',
  persistentReceiptPath: null,
  parentCompletionClaimed: false,
  parentStepStatus: 'IN_PROGRESS',
  receiptChain,
  openTruth,
  preservedFailures,
  nextOfficialStep: '29-D3',
  nextOfficialStepStatus: 'PENDING_AWAITING_29-D2-D_RECEIPT',
  nextOfficialStepAuthorized: false,
  bronzeCompletedPercent: 25.0,
  bronzeRemainingPercent: 75.0,
  silverStatus: 'BLOCKED_NOT_READY',
  goldStatus: 'BLOCKED_NOT_READY',
  conversationCapacity: 'UNAVAILABLE',
  recordFingerprintSha256: sha256(Buffer.from(stableStringify(fingerprintBasis))),
  generatedAt: d2Completion.completedAt,
  mandatoryTruthSentence: TRUTH
};

const statusDocument = `# 29-D2-D3 — 29-D2-D Üst Adım Finalizasyonu\n\n- Yerel doğrulama durumu: **PENDING**\n- Kalıcı Library receipt: **PENDING**\n- 29-D2-D üst adımı: **IN_PROGRESS; tamamlanma iddiası yok**\n- Sonraki resmî adım 29-D3: **PENDING; receipt ve geri okuma olmadan yetkili değil**\n- Açık boşluk: **12; PASS sayılan: 0**\n- Açık çelişki: **3; PASS sayılan: 0**\n- Bronze doğrulanmış ilerleme: **%25,0**\n- Silver / Gold: **YASAK / HAZIR DEĞİL**\n\nBu kayıt yalnız 29-D2-D3 yerel checkpoint başlangıcıdır. Kalıcı Library receipt ve receipt geri okuması PASS olmadan 29-D2-D tamamlanmış sayılmaz ve 29-D3 başlatılmaz.\n\n${TRUTH}\n`;

await mkdir('artifacts/checkpoints', { recursive: true });
await mkdir('docs/audit', { recursive: true });
await writeFile('artifacts/checkpoints/29-D2-D3_PARENT_FINALIZATION_RECORD.json', JSON.stringify(record, null, 2) + '\n');
await writeFile('docs/audit/29-D2-D3_29-D2-D_UST_ADIM_FINALIZASYONU.md', statusDocument);
console.log(`29-D2-D3 parent finalization checkpoint generated: ${record.recordFingerprintSha256}.`);
