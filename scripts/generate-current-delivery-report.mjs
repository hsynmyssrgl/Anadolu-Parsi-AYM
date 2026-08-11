import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const sourceRoot = resolve(process.cwd());
const aymRoot = resolve(sourceRoot, '..', '..');
if (sourceRoot !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${sourceRoot}`);

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const truth = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const [contract, release, scope, decisions, audit, capacity, receipt, manifestSummary, completion30Z, completion31A, completion31B, completion31C, completion31D, completion31E] = await Promise.all([
  readJson(resolve(sourceRoot, 'config', 'delivery-report-contract.json')),
  readJson(resolve(sourceRoot, 'config', 'release-ledger.json')),
  readJson(resolve(sourceRoot, 'config', 'accepted-scope-registry.json')),
  readJson(resolve(sourceRoot, 'config', 'user-decision-ledger.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'inventory', 'BRONZE_CURRENT_COMPLETION_AUDIT.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'validation', 'conversation-capacity.json')),
  readJson(resolve(aymRoot, '05_TEST', '30Z_LOCAL_RECEIPT', 'LATEST.json')),
  readJson(resolve(aymRoot, '00_PROJE', 'MANIFEST_OZETI.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '30-Z_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '31-A_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '31-B_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '31-C_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '31-D_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '31-E_COMPLETION_RECORD.json'))
]);

if (release.current.status !== 'IN_PROGRESS') throw new Error('Current release must remain IN_PROGRESS.');
if (receipt.externalLibraryReceiptStatus !== 'PASS' || receipt.officialCompletionClaimed !== true
  || receipt.externalReceipt?.storageBackend !== 'EXTERNAL_USB_D_DRIVE'
  || !String(receipt.externalReceipt?.externalPath ?? '').startsWith('D:\\AYM_LIBRARY\\')) {
  throw new Error('Current-source external protection truth boundary mismatch.');
}
if (completion31D.status !== 'PASS'
  || completion31D.officialStepStatus !== 'COMPLETED'
  || completion31D.persistentReceiptStatus !== 'PASS'
  || completion31D.officialCompletionClaimed !== true) {
  throw new Error('Focused 31-D external Library receipt truth boundary mismatch.');
}
if (completion31E.status !== 'PASS'
  || completion31E.officialStepStatus !== 'COMPLETED'
  || completion31E.persistentReceiptStatus !== 'PASS'
  || completion31E.officialCompletionClaimed !== true
  || completion31E.storageBackend !== 'EXTERNAL_USB_D_DRIVE') {
  throw new Error('Focused 31-E external Library receipt truth boundary mismatch.');
}
if (completion31B.status !== 'PASS'
  || completion31B.officialStepStatus !== 'COMPLETED'
  || completion31B.persistentReceiptStatus !== 'PASS'
  || completion31B.officialCompletionClaimed !== true) {
  throw new Error('Focused 31-B external Library receipt truth boundary mismatch.');
}
if (completion31C.status !== 'PASS'
  || completion31C.officialStepStatus !== 'COMPLETED'
  || completion31C.persistentReceiptStatus !== 'PASS'
  || completion31C.officialCompletionClaimed !== true) {
  throw new Error('Focused 31-C external Library receipt truth boundary mismatch.');
}
if (completion30Z.status !== 'PASS'
  || completion30Z.officialStepStatus !== 'COMPLETED'
  || completion30Z.persistentReceiptStatus !== 'PASS'
  || completion30Z.officialCompletionClaimed !== true) {
  throw new Error('Frozen 30-Z external Library receipt truth boundary mismatch.');
}
if (completion31A.status !== 'PASS'
  || completion31A.officialStepStatus !== 'COMPLETED'
  || completion31A.persistentReceiptStatus !== 'PASS'
  || completion31A.officialCompletionClaimed !== true) {
  throw new Error('Focused 31-A external Library receipt truth boundary mismatch.');
}
const completedRequirementIds = scope.requirements.filter((item) => item.status === 'COMPLETE').map((item) => item.id);
const completedDecisionIds = decisions.decisions.filter((item) => item.status === 'ACTIVE').map((item) => item.id);
const validationResults = [
  ...audit.gates.current.map((gate) => ({ name: gate.script, actualStatus: gate.status, reportedAs: gate.status })),
  { name: 'B2-01 native interactive Windows Hello', actualStatus: 'USER_DEFERRED_NOT_RUN', reportedAs: 'USER_DEFERRED_NOT_RUN', classification: 'NON_BLOCKING_HARDWARE_VALIDATION_DEC_162' },
  { name: 'Frozen 30-Z external persistent USB Library receipt', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Focused 31-A external persistent USB Library receipt', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Focused 31-B external persistent USB Library receipt', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Focused 31-C external persistent USB Library receipt', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Focused 31-D external persistent USB Library receipt', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Focused 31-E external persistent USB Library receipt', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Current authoritative source external protection', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Historical 29-D5 verifier', actualStatus: audit.gates.historical29D5.status, reportedAs: audit.gates.historical29D5.status, classification: 'HISTORICAL_ONLY' }
];
const nextTask = audit.remainingWork.find((item) => item.id !== 'GOV-004' && item.completionBlockers?.length === 0)
  ?? audit.remainingWork.find((item) => item.id !== 'GOV-004')
  ?? null;

const report = {
  schemaVersion: 2,
  id: `DELIVERY-STATUS-${release.current.version}`,
  generatedAt: new Date().toISOString(),
  visibleRelease: release.current.visibleRelease,
  userVisibleDeliveryFileName: `Anadolu_Parsi_Aile_Yasam_Merkezi_${release.current.visibleRelease.replaceAll(' ', '_')}.json`,
  releaseStatus: 'IN_PROGRESS',
  workCompleted: [
    'DEC-152 single authoritative source, local receipt and incremental governance binding',
    'DEC-153 B0-01 governance and feature-reality matrix closure',
    'DEC-154 GOV-004 current delivery report closure'
    ,'DEC-158 frozen 30-Z external USB Library receipt and official checkpoint completion',
    'DEC-159 focused 31-A timeline-event Policy Enforcement checkpoint completion',
    'DEC-160 focused 31-B family data import central authorization checkpoint completion',
    'DEC-161 focused 31-C family import multi-policy receipt atomic batch checkpoint completion'
    ,'DEC-162 Windows Hello hardware validation temporary non-blocking deferral'
    ,'DEC-163 focused 31-D reused-location exact read receipt checkpoint completion'
    ,'DEC-164 current authoritative source D: USB protection closure'
    ,'DEC-165 B0-02 public release DTO, UI and canonical delivery filename boundary closure'
  ],
  completedRequirementIds,
  completedDecisionIds,
  changedSourceAreas: [
    'config/accepted-scope-registry.json',
    'config/user-decision-ledger.json',
    'docs/decisions/DEC-152..DEC-154',
    'scripts/audit-bronze-current-state.mjs',
    'scripts/update-aym-governance-incrementally.mjs',
    'scripts/generate-current-delivery-report.mjs',
    'scripts/finalize-30-z-external-library-receipt.mjs',
    'artifacts/checkpoints/30-Z_LIBRARY_RECEIPT.json',
    'artifacts/checkpoints/31-A_LIBRARY_RECEIPT.json',
    'artifacts/checkpoints/31-B_LIBRARY_RECEIPT.json',
    'artifacts/checkpoints/31-C_LIBRARY_RECEIPT.json',
    'artifacts/checkpoints/31-D_LIBRARY_RECEIPT.json',
    'artifacts/checkpoints/31-E_LIBRARY_RECEIPT.json',
    'artifacts/deliveries/Anadolu_Parsi_Aile_Yasam_Merkezi_Bronze_04.08.2026.29.json',
    'artifacts/reports/DELIVERY_STATUS_04.08.2026.29.json'
  ],
  validationResults,
  openErrorsAndRisks: [
    'B2-01 is complete under DEC-162 with runtime code and password fallback preserved; native interactive Windows Hello remains USER_DEFERRED_NOT_RUN_NOT_PASS and no native PASS is claimed.',
    'Current authoritative C: source tree has a distinct D: external USB protection receipt.',
    `${audit.scope.incompleteCount} accepted requirements remain open after this report input audit.`,
    'Silver and Gold remain blocked.'
  ],
  bronzeCompletionPercent: audit.percentages.officialWeightedBronzePercent,
  bronzeRemainingPercent: Number((100 - audit.percentages.officialWeightedBronzePercent).toFixed(4)),
  strictRequirementCompletionPercent: audit.percentages.strictRequirementCompletionPercent,
  implementationChainCoveragePercent: audit.percentages.implementationChainCoveragePercent,
  governanceEvidenceChainCoveragePercent: audit.percentages.governanceEvidenceChainCoveragePercent,
  estimatedBronzeCompletion: {
    status: 'UNAVAILABLE_INSUFFICIENT_GOVERNED_VELOCITY_SERIES',
    confidence: 'LOW',
    reason: 'No current governed multi-sample completion velocity series supports a defensible calendar ETA.'
  },
  estimatedSilverTransition: { status: 'BLOCKED_NOT_READY', prerequisite: 'All Bronze P0/P1 scope complete plus mandatory Windows/UAT/security gates.' },
  estimatedGoldTransition: { status: 'BLOCKED_NOT_READY', prerequisite: 'All Silver gates PASS plus production operations readiness and explicit product-owner approval.' },
  estimateConfidence: 'LOW_INSUFFICIENT_GOVERNED_VELOCITY_SERIES',
  conversationCapacity: capacity,
  handoffPromptStatus: capacity.handoff ?? 'NOT_REQUIRED_WITHOUT_ACTUAL_HARD_STOP',
  sourceArchive: receipt.backup.path,
  sourceSha256: receipt.treeSha256,
  sourceReceiptBoundary: 'The focused official 30-Z through 31-E checkpoints and the latest editable C: source tree are independently externally bound on D:.',
  manifest: '00_PROJE/MASTER_MANIFEST.json',
  manifestSummary: {
    path: '00_PROJE/MANIFEST_OZETI.json',
    updateMode: manifestSummary.updateMode,
    liveFileCount: manifestSummary.liveFileCount
  },
  persistentLibraryPath: completion31E.libraryPath,
  persistentLibraryUploadStatus: 'PASS',
  completeDocumentIndex: 'artifacts/manifests/ALL_DOCUMENTS_INDEX.json',
  nextOfficialTask: nextTask,
  official30ZCompletionClaimed: true,
  official31ACompletionClaimed: true,
  official31BCompletionClaimed: true,
  official31CCompletionClaimed: true,
  official31DCompletionClaimed: true,
  official31ECompletionClaimed: true,
  currentSourceExternalProtectionStatus: 'PASS',
  newBuildAssigned: false,
  mandatoryTruthSentence: truth
};

for (const field of contract.requiredFields) {
  if (!Object.hasOwn(report, field)) throw new Error(`Generated report missing contract field: ${field}`);
}
const target = resolve(sourceRoot, 'artifacts', 'reports', `DELIVERY_STATUS_${release.current.version}.json`);
await mkdir(dirname(target), { recursive: true });
const content = `${JSON.stringify(report, null, 2)}\n`;
await writeFile(target, content, 'utf8');
if (await readFile(target, 'utf8') !== content) throw new Error('Delivery report readback mismatch.');
if (/\b(?:RC2?|MVP|Build)\b/iu.test(report.userVisibleDeliveryFileName)) {
  throw new Error(`User-visible delivery filename leaks an internal release token: ${report.userVisibleDeliveryFileName}`);
}
const userVisibleTarget = resolve(sourceRoot, 'artifacts', 'deliveries', report.userVisibleDeliveryFileName);
await mkdir(dirname(userVisibleTarget), { recursive: true });
await writeFile(userVisibleTarget, content, 'utf8');
if (await readFile(userVisibleTarget, 'utf8') !== content) throw new Error('User-visible delivery report readback mismatch.');
console.log(`Current delivery report: PASS (${contract.requiredFields.length} required fields; 30-Z through 31-E receipts PASS; current-source external protection PASS on D:; new Build false).`);
