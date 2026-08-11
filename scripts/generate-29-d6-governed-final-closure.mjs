import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (path) => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/u, ''));
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const stableStringify = (value) => JSON.stringify(stable(value));

await mkdir('artifacts/inventory/snapshots', { recursive: true });
for (const [source, snapshot] of [
  ['config/work-segmentation-plan.json', 'artifacts/inventory/snapshots/29-D6_WORK_PLAN_AT_GENERATION.json'],
  ['config/active-governance-ledger.json', 'artifacts/inventory/snapshots/29-D6_GOVERNANCE_AT_GENERATION.json'],
  ['artifacts/validation/governed-preflight.json', 'artifacts/inventory/snapshots/29-D6_GOVERNED_PREFLIGHT_AT_GENERATION.json']
]) await writeFile(snapshot, await readFile(source));

const bindingPaths = [
  ['officialProgressBaseline', 'artifacts/authority/29-D5_OFFICIAL_PROGRESS_BASELINE.json'],
  ['d2dParentCompletion', 'artifacts/checkpoints/29-D2-D_PARENT_COMPLETION_RECORD.json'],
  ['d3Completion', 'artifacts/checkpoints/29-D3_COMPLETION_RECORD.json'],
  ['d4Completion', 'artifacts/checkpoints/29-D4_COMPLETION_RECORD.json'],
  ['d5Completion', 'artifacts/checkpoints/29-D5_COMPLETION_RECORD.json'],
  ['d3Analysis', 'artifacts/inventory/29-D3_RULE_GAP_AND_CONFLICT_ANALYSIS.json'],
  ['d4Assessment', 'artifacts/inventory/29-D4_PROFESSIONAL_TECHNICAL_ASSESSMENT.json'],
  ['d5ProgressReport', 'artifacts/inventory/29-D5_SCOPE_AND_REAL_PROGRESS_REPORT.json'],
  ['workPlanSnapshot', 'artifacts/inventory/snapshots/29-D6_WORK_PLAN_AT_GENERATION.json'],
  ['governanceSnapshot', 'artifacts/inventory/snapshots/29-D6_GOVERNANCE_AT_GENERATION.json'],
  ['governedPreflightSnapshot', 'artifacts/inventory/snapshots/29-D6_GOVERNED_PREFLIGHT_AT_GENERATION.json']
];
const sourceBindings = [];
for (const [id, path] of bindingPaths) {
  const bytes = await readFile(path);
  sourceBindings.push({ id, path, sizeBytes: bytes.length, sha256: sha256(bytes) });
}

const plan = await readJson('artifacts/inventory/snapshots/29-D6_WORK_PLAN_AT_GENERATION.json');
const governance = await readJson('artifacts/inventory/snapshots/29-D6_GOVERNANCE_AT_GENERATION.json');
const preflight = await readJson('artifacts/inventory/snapshots/29-D6_GOVERNED_PREFLIGHT_AT_GENERATION.json');
const d3 = await readJson('artifacts/inventory/29-D3_RULE_GAP_AND_CONFLICT_ANALYSIS.json');
const d4 = await readJson('artifacts/inventory/29-D4_PROFESSIONAL_TECHNICAL_ASSESSMENT.json');
const d5 = await readJson('artifacts/inventory/29-D5_SCOPE_AND_REAL_PROGRESS_REPORT.json');
const priorIds = ['29-D1', '29-D2-A', '29-D2-B', '29-D2-C', '29-D2-D', '29-D3', '29-D4', '29-D5'];
const priorSteps = priorIds.map((id) => plan.steps.find((item) => item.id === id));
const priorStepClosures = priorSteps.map((item) => ({
  id: item?.id ?? null,
  title: item?.title ?? null,
  status: item?.status ?? 'NOT_FOUND',
  validationStatus: item?.validationStatus ?? 'NOT_FOUND',
  persistentReceiptStatus: item?.persistentReceiptStatus ?? 'NOT_FOUND',
  persistentReceiptPath: item?.persistentReceiptPath ?? null,
  durableClosure: item?.status === 'COMPLETED' && item?.validationStatus === 'PASS' && item?.persistentReceiptStatus === 'PASS'
}));
const allPriorDurable = priorStepClosures.every((item) => item.durableClosure);
const d6Step = plan.steps.find((item) => item.id === '29-D6');
const eStep = plan.steps.find((item) => item.id === '29-E');
const fStep = plan.steps.find((item) => item.id === '29-F');

const unresolvedTruth = {
  governanceGaps: { open: d3.summary.openGapCount, countedAsPass: d3.summary.gapsCountedAsPass },
  governanceContradictions: { open: d3.summary.openContradictionCount, countedAsPass: d3.summary.contradictionsCountedAsPass },
  technicalFindings: { open: d4.findingSummary.open, countedAsPass: d4.findingSummary.countedAsPass },
  acceptedScope: {
    total: d5.scopeMetrics.acceptedRequirementCount,
    complete: d5.scopeMetrics.strictCompleteCount,
    incomplete: d5.scopeMetrics.strictIncompleteCount,
    promotionRequiredIncomplete: d5.scopeMetrics.promotionRequired.incomplete,
    countedAsPass: 0
  },
  dependencyBackedExecution: {
    typecheck: d4.executionEvidence.dependencyBackedTypecheck.status,
    tests: d4.executionEvidence.unitAndIntegrationTests.status,
    productionBuild: d4.executionEvidence.productionBuild.status,
    installerBuild: d4.executionEvidence.installerBuild.status,
    countedAsPass: false
  }
};

const closureBasis = {
  sourceBindings,
  priorStepClosures,
  allPriorDurable,
  unresolvedTruth,
  officialProgress: d5.progressTruth.officialValidatedProgress,
  currentStep: plan.currentStep,
  nextCandidateStep: eStep?.id,
  governanceNextTask: governance.nextOfficialTask
};
const closureFingerprintSha256 = sha256(Buffer.from(stableStringify(closureBasis)));
const closure = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '29-D6',
  title: 'Governed final closure of 29-D',
  phase: 'LOCAL_CLOSURE_AWAITING_LIBRARY_RECEIPT',
  status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT',
  validationStatus: 'PENDING',
  persistentReceiptStatus: 'PENDING',
  persistentReceiptPath: null,
  sourceBindings,
  closureScope: {
    phase: '29-D',
    includedPriorSteps: priorIds,
    excludedFutureSteps: ['29-E', '29-F'],
    productCompletionClaimed: false,
    releasePromotionClaimed: false,
    historicalCheckpointRewritten: false
  },
  priorStepClosures,
  eligibility: {
    allPriorStepsDurablyClosed: allPriorDurable,
    priorStepCount: priorStepClosures.length,
    durablePriorStepCount: priorStepClosures.filter((item) => item.durableClosure).length,
    currentStep: plan.currentStep,
    d6Status: d6Step?.status,
    d6ValidationStatus: d6Step?.validationStatus,
    d6PersistentReceiptStatus: d6Step?.persistentReceiptStatus,
    exactlyOneInProgress: plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 1,
    stepEStatus: eStep?.status,
    stepFStatus: fStep?.status,
    localClosureEligible: allPriorDurable && plan.currentStep === '29-D6' && d6Step?.status === 'IN_PROGRESS' && eStep?.status === 'PENDING' && fStep?.status === 'PENDING'
  },
  executionEvidence: {
    governedPreflight: {
      status: preflight.status,
      executed: preflight.results.length,
      failed: preflight.results.filter((item) => item.exitCode !== 0).length,
      sourceFingerprint: preflight.sourceFingerprint
    },
    dependencyBackedTypecheck: 'NOT_RUN_NOT_PASS',
    unitAndIntegrationTests: 'NOT_RUN_NOT_PASS',
    productionBuild: 'NOT_RUN_NOT_PASS',
    installerBuild: 'NOT_RUN_NOT_PASS'
  },
  unresolvedTruth,
  progressTruth: {
    officialBronzeCompletedPercent: 25,
    officialBronzeRemainingPercent: 75,
    strictAcceptedScopeComplete: d5.scopeMetrics.strictCompleteCount,
    strictAcceptedScopeTotal: d5.scopeMetrics.acceptedRequirementCount,
    historicalEstimateCountedAsCurrent: false,
    currentEta: 'UNAVAILABLE_NO_CURRENT_EVIDENCE_BACKED_VELOCITY'
  },
  readiness: {
    phase29DLocalClosureValidation: 'PENDING',
    bronzeCompletion: 'NOT_COMPLETE',
    silver: 'FORBIDDEN_NOT_READY',
    gold: 'FORBIDDEN_NOT_READY',
    releasePromotionAuthorized: false
  },
  deliveryReport: {
    visibleRelease: 'Bronze 04.08.2026.29',
    workCompleted: '29-D1 through 29-D5 durable receipt-chain reconciliation and governed 29-D closure evidence generation',
    completedRequirementIds: [],
    completedDecisionIds: [],
    changedSourceAreas: [
      'artifacts/checkpoints/29-D6_29-D_GOVERNED_FINAL_CLOSURE.json',
      'artifacts/validation/29-D6-governed-final-closure.json',
      'docs/audit/29-D6_29-D_GOVERNED_FINAL_KAPANIS.md',
      'scripts/generate-29-d6-governed-final-closure.mjs',
      'scripts/verify-29-d6-governed-final-closure.mjs',
      'package.json'
    ],
    validationResults: { closureValidation: 'PENDING', governedPreflight: preflight.status, dependencyBackedExecution: 'NOT_RUN_NOT_PASS' },
    openErrorsAndRisks: unresolvedTruth,
    bronzeCompletionPercent: 25,
    bronzeRemainingPercent: 75,
    estimatedBronzeCompletion: 'UNAVAILABLE_NO_CURRENT_EVIDENCE_BACKED_VELOCITY',
    estimatedSilverTransition: 'UNAVAILABLE_NOT_READY',
    estimatedGoldTransition: 'UNAVAILABLE_NOT_READY',
    estimateConfidence: 'UNAVAILABLE_FAIL_CLOSED',
    conversationCapacity: 'UNAVAILABLE',
    handoffPromptStatus: 'NOT_REQUIRED_WITHOUT_ACTUAL_HARD_STOP',
    sourceArchive: 'Anadolu_Parsi_Aile_Yasam_Merkezi_Bronze_04.08.2026.29_Resmi_Kodlama_Kaynagi_29-D2-D2_Ana_Checkpoint.zip',
    sourceSha256: 'd52a4ad2f1ff700dd260a1bb77f4145febf0ccbec85ca3f479aa85c016d57701',
    manifest: 'artifacts/manifests/ALL_DOCUMENTS_INDEX.json',
    persistentLibraryPath: 'Panthera pardus tulliana/Anadolu Parsı Aile Yaşam Merkezi/Bronze 04.08.2026.29/checkpoints/29-D6_29-D_Governed_Final_Kapanis',
    persistentLibraryUploadStatus: 'PENDING',
    completeDocumentIndex: 'artifacts/manifests/ALL_DOCUMENTS_INDEX.json',
    nextOfficialTask: '29-D6 governed final closure Library finalization',
    mandatoryTruthSentence: TRUTH
  },
  closureFingerprintSha256,
  nextOfficialStep: '29-E',
  nextOfficialStepStatus: 'PENDING_AWAITING_29-D6_RECEIPT',
  nextOfficialStepAuthorized: false,
  conversationCapacity: 'UNAVAILABLE',
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};

await mkdir('artifacts/checkpoints', { recursive: true });
await mkdir('docs/audit', { recursive: true });
await writeFile('artifacts/checkpoints/29-D6_29-D_GOVERNED_FINAL_CLOSURE.json', JSON.stringify(closure, null, 2) + '\n');
const rows = priorStepClosures.map((item) => `| ${item.id} | ${item.status} | ${item.validationStatus} | ${item.persistentReceiptStatus} | ${item.durableClosure ? 'PASS' : 'FAIL'} |`).join('\n');
const markdown = `# 29-D6 — 29-D Governed Final Kapanış\n\n- Yerel kapanış doğrulaması: **PENDING**\n- Önceki kalıcı adımlar: **${priorStepClosures.filter((item) => item.durableClosure).length}/${priorStepClosures.length} durable PASS**\n- Governed preflight: **${preflight.status}; ${preflight.results.length} süreç; ${preflight.results.filter((item) => item.exitCode !== 0).length} fail**\n- Resmî Bronze ilerleme: **%25,0; değişmedi**\n- Katı kabul edilmiş kapsam: **${d5.scopeMetrics.strictCompleteCount}/${d5.scopeMetrics.acceptedRequirementCount}**\n- Açık yönetişim boşluğu: **${d3.summary.openGapCount}; PASS sayılmadı**\n- Açık teknik bulgu: **${d4.findingSummary.open}; PASS sayılmadı**\n- Typecheck/test/build/installer: **NOT_RUN / PASS DEĞİL**\n- 29-E: **PENDING / 29-D6 Library receipt sonrası**\n- Silver/Gold: **YASAK / HAZIR DEĞİL**\n- Sohbet kapasitesi: **UNAVAILABLE**\n\n| Adım | Durum | Doğrulama | Receipt | Kalıcı kapanış |\n|---|---|---|---|---|\n${rows}\n\nBu kapanış yalnız 29-D çalışma fazının yönetişim kapanışıdır; ürün veya sürüm tamamlanması değildir.\n\n${TRUTH}\n`;
await writeFile('docs/audit/29-D6_29-D_GOVERNED_FINAL_KAPANIS.md', markdown);
console.log(`29-D6 governed closure generated: ${priorStepClosures.filter((item) => item.durableClosure).length}/${priorStepClosures.length} prior durable steps / validation PENDING.`);
