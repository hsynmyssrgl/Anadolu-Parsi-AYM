import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (path) => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/u, ''));
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const stableStringify = (value) => JSON.stringify(stable(value));
const percent = (part, whole) => whole === 0 ? 0 : Number(((part / whole) * 100).toFixed(4));
const groupCounts = (items, key) => Object.fromEntries(
  [...new Set(items.map((item) => item[key]))].sort().map((value) => [value, items.filter((item) => item[key] === value).length])
);

await mkdir('artifacts/inventory/snapshots', { recursive: true });
for (const [source, snapshot] of [
  ['config/work-segmentation-plan.json', 'artifacts/inventory/snapshots/29-D5_WORK_PLAN_AT_GENERATION.json'],
  ['artifacts/validation/feature-reality-gate.json', 'artifacts/inventory/snapshots/29-D5_FEATURE_REALITY_AT_GENERATION.json'],
  ['artifacts/validation/conversation-capacity.json', 'artifacts/inventory/snapshots/29-D5_CONVERSATION_CAPACITY_AT_GENERATION.json'],
  ['artifacts/validation/governed-preflight.json', 'artifacts/inventory/snapshots/29-D5_GOVERNED_PREFLIGHT_AT_GENERATION.json']
]) await writeFile(snapshot, await readFile(source));

const bindingPaths = [
  ['officialProgressBaseline', 'artifacts/authority/29-D5_OFFICIAL_PROGRESS_BASELINE.json'],
  ['acceptedScopeRegistry', 'config/accepted-scope-registry.json'],
  ['projectProgressModel', 'config/project-progress-model.json'],
  ['deliveryReportContract', 'config/delivery-report-contract.json'],
  ['masterBuildLedger', 'config/master-build-ledger.json'],
  ['d3Analysis', 'artifacts/inventory/29-D3_RULE_GAP_AND_CONFLICT_ANALYSIS.json'],
  ['d4Assessment', 'artifacts/inventory/29-D4_PROFESSIONAL_TECHNICAL_ASSESSMENT.json'],
  ['prepackageExecutionPolicyFailure', 'artifacts/checkpoints/29-D5_PREPACKAGE_EXECUTION_POLICY_FAILURE.json'],
  ['prepackageStartProcessEnvironmentFailure', 'artifacts/checkpoints/29-D5_PREPACKAGE_START_PROCESS_ENVIRONMENT_FAILURE.json'],
  ['workPlanSnapshot', 'artifacts/inventory/snapshots/29-D5_WORK_PLAN_AT_GENERATION.json'],
  ['featureRealitySnapshot', 'artifacts/inventory/snapshots/29-D5_FEATURE_REALITY_AT_GENERATION.json'],
  ['conversationCapacitySnapshot', 'artifacts/inventory/snapshots/29-D5_CONVERSATION_CAPACITY_AT_GENERATION.json'],
  ['governedPreflightSnapshot', 'artifacts/inventory/snapshots/29-D5_GOVERNED_PREFLIGHT_AT_GENERATION.json']
];
const sourceBindings = [];
for (const [id, path] of bindingPaths) {
  const bytes = await readFile(path);
  sourceBindings.push({ id, path, sizeBytes: bytes.length, sha256: sha256(bytes) });
}

const baseline = await readJson('artifacts/authority/29-D5_OFFICIAL_PROGRESS_BASELINE.json');
const registry = await readJson('config/accepted-scope-registry.json');
const progressModel = await readJson('config/project-progress-model.json');
const deliveryContract = await readJson('config/delivery-report-contract.json');
const masterLedger = await readJson('config/master-build-ledger.json');
const d3 = await readJson('artifacts/inventory/29-D3_RULE_GAP_AND_CONFLICT_ANALYSIS.json');
const d4 = await readJson('artifacts/inventory/29-D4_PROFESSIONAL_TECHNICAL_ASSESSMENT.json');
const plan = await readJson('artifacts/inventory/snapshots/29-D5_WORK_PLAN_AT_GENERATION.json');
const featureReality = await readJson('artifacts/inventory/snapshots/29-D5_FEATURE_REALITY_AT_GENERATION.json');
const conversation = await readJson('artifacts/inventory/snapshots/29-D5_CONVERSATION_CAPACITY_AT_GENERATION.json');
const preflight = await readJson('artifacts/inventory/snapshots/29-D5_GOVERNED_PREFLIGHT_AT_GENERATION.json');

const requirements = registry.requirements ?? [];
const complete = requirements.filter((item) => item.status === 'COMPLETE' && Object.values(item.chain ?? {}).every((value) => value === true));
const incomplete = requirements.filter((item) => !complete.includes(item));
const promotionRequired = requirements.filter((item) => ['P0', 'P1'].includes(item.priority));
const promotionComplete = promotionRequired.filter((item) => complete.includes(item));
const promotionIncomplete = promotionRequired.filter((item) => !complete.includes(item));
const chainEntries = requirements.flatMap((item) => Object.entries(item.chain ?? {}));
const chainTrue = chainEntries.filter(([, value]) => value === true).length;
const latestHistoricalProgressBuild = [...(masterLedger.builds ?? [])].reverse().find((item) => item.projectProgressAssessment);
const weights = progressModel.codingScope ?? {};
const weightTotal = Object.values(weights).reduce((sum, value) => sum + value, 0);
const planCounts = {
  totalTopLevelSteps: plan.steps.length,
  completedTopLevelSteps: plan.steps.filter((item) => item.status === 'COMPLETED').length,
  inProgressTopLevelSteps: plan.steps.filter((item) => item.status === 'IN_PROGRESS').length,
  pendingTopLevelSteps: plan.steps.filter((item) => item.status === 'PENDING').length
};

const scopeMetrics = {
  acceptedRequirementCount: requirements.length,
  strictCompleteCount: complete.length,
  strictIncompleteCount: incomplete.length,
  strictOverallCompletionPercent: percent(complete.length, requirements.length),
  strictOverallRemainingPercent: percent(incomplete.length, requirements.length),
  statusCounts: groupCounts(requirements, 'status'),
  priorityCounts: groupCounts(requirements, 'priority'),
  sourceCounts: groupCounts(requirements, 'source'),
  promotionRequired: {
    priorities: ['P0', 'P1'],
    total: promotionRequired.length,
    complete: promotionComplete.length,
    incomplete: promotionIncomplete.length,
    completionPercent: percent(promotionComplete.length, promotionRequired.length),
    remainingPercent: percent(promotionIncomplete.length, promotionRequired.length)
  },
  p2AcceptedButNotPromotionGate: {
    total: requirements.filter((item) => item.priority === 'P2').length,
    complete: requirements.filter((item) => item.priority === 'P2' && complete.includes(item)).length,
    incomplete: requirements.filter((item) => item.priority === 'P2' && !complete.includes(item)).length,
    countedAsComplete: false
  },
  completeRequirementIds: complete.map((item) => item.id).sort(),
  chainEvidenceCoverage: {
    totalBooleanFields: chainEntries.length,
    trueFields: chainTrue,
    falseFields: chainEntries.length - chainTrue,
    truePercent: percent(chainTrue, chainEntries.length),
    classification: 'EVIDENCE_DENSITY_NOT_REQUIREMENT_COMPLETION'
  }
};

const progressTruth = {
  officialValidatedProgress: {
    completedPercent: baseline.officialFields.bronzeCompletedPercent,
    remainingPercent: baseline.officialFields.bronzeRemainingPercent,
    source: 'artifacts/authority/29-D5_OFFICIAL_PROGRESS_BASELINE.json',
    method: 'AUTHORITY_LOCKED_VALIDATED_PROGRESS_NOT_RECALCULATED',
    status: 'CURRENT_OFFICIAL'
  },
  strictAcceptedScopeCompletion: {
    completedPercent: scopeMetrics.strictOverallCompletionPercent,
    remainingPercent: scopeMetrics.strictOverallRemainingPercent,
    numerator: complete.length,
    denominator: requirements.length,
    method: 'COMPLETE_WITH_ALL_CHAIN_FIELDS_TRUE_DIVIDED_BY_ALL_ACCEPTED_REQUIREMENTS',
    status: 'CURRENT_SCOPE_REALITY_METRIC_NOT_OFFICIAL_BRONZE_PERCENT'
  },
  promotionGateCompletion: {
    completedPercent: scopeMetrics.promotionRequired.completionPercent,
    remainingPercent: scopeMetrics.promotionRequired.remainingPercent,
    numerator: promotionComplete.length,
    denominator: promotionRequired.length,
    incomplete: promotionIncomplete.length,
    method: 'P0_P1_COMPLETE_DIVIDED_BY_ALL_P0_P1_REQUIREMENTS',
    status: 'CURRENT_SILVER_GATE_METRIC_NOT_OFFICIAL_BRONZE_PERCENT'
  },
  historicalEstimate: {
    build: latestHistoricalProgressBuild?.build ?? null,
    version: latestHistoricalProgressBuild?.version ?? null,
    completedPercent: latestHistoricalProgressBuild?.projectProgressAssessment?.codingCompletionPercent ?? null,
    remainingPercent: latestHistoricalProgressBuild?.projectProgressAssessment?.codingRemainingPercent ?? null,
    method: latestHistoricalProgressBuild?.projectProgressAssessment?.method ?? null,
    assessedAt: latestHistoricalProgressBuild?.projectProgressAssessment?.assessedAt ?? null,
    classification: 'HISTORICAL_WEIGHTED_ESTIMATE_NOT_CURRENT_OFFICIAL_PROGRESS',
    countedAsCurrentProgress: false
  },
  weightedModel: {
    weights,
    weightTotal,
    estimationRule: progressModel.estimationRule,
    acceptedScopeToWeightMappingStatus: 'UNAVAILABLE_NOT_DEFINED',
    currentRecalculationStatus: 'NOT_CALCULATED_NOT_PASS',
    rationale: 'The model defines category weights but contains no evidence-backed mapping from the 350 accepted requirements to achieved category weights.'
  },
  reconciliationVerdict: 'METRICS_ARE_NOT_INTERCHANGEABLE_AND_MUST_NOT_BE_AVERAGED_OR_SUBSTITUTED'
};

const preservedFailures = [{
  path: 'artifacts/checkpoints/29-D5_PREPACKAGE_EXECUTION_POLICY_FAILURE.json',
  status: 'FAIL',
  processExitCode: 1,
  executedValidationCommands: 0,
  countedAsPass: false,
  correctionScope: 'PROCESS_SCOPED_EXECUTION_POLICY_BYPASS_FOR_SIGNED_LOCAL_WORKFLOW_SCRIPT_ONLY'
}, {
  path: 'artifacts/checkpoints/29-D5_PREPACKAGE_START_PROCESS_ENVIRONMENT_FAILURE.json',
  status: 'FAIL',
  processExitCode: 1,
  executedValidationCommands: 0,
  countedAsPass: false,
  correctionScope: 'REPLACE_START_PROCESS_WITH_DIRECT_NODE_INVOCATION_AND_PRESERVE_EXIT_CODE_LOGGING'
}];

const deliveryReport = {
  visibleRelease: registry.release,
  workCompleted: '29-D5 scope authority reconciliation, accepted-scope measurement and real-progress report generation',
  completedRequirementIds: [],
  completedDecisionIds: [],
  changedSourceAreas: [
    'artifacts/authority/29-D5_OFFICIAL_PROGRESS_BASELINE.json',
    'artifacts/checkpoints/29-D5_PREPACKAGE_EXECUTION_POLICY_FAILURE.json',
    'artifacts/checkpoints/29-D5_PREPACKAGE_START_PROCESS_ENVIRONMENT_FAILURE.json',
    'artifacts/inventory/29-D5_SCOPE_AND_REAL_PROGRESS_REPORT.json',
    'artifacts/validation/29-D5-scope-real-progress-report.json',
    'docs/audit/29-D5_KAPSAM_VE_GERCEK_ILERLEME_RAPORU.md',
    'scripts/generate-29-d5-scope-real-progress-report.mjs',
    'scripts/verify-29-d5-scope-real-progress-report.mjs',
    'package.json'
  ],
  validationResults: {
    reportValidation: 'PENDING',
    governedPreflight: preflight.status,
    featureRealityHonestyGate: featureReality.status,
    dependencyBackedTypecheck: 'NOT_RUN_NOT_PASS',
    unitAndIntegrationTests: 'NOT_RUN_NOT_PASS',
    productionBuild: 'NOT_RUN_NOT_PASS',
    installerBuild: 'NOT_RUN_NOT_PASS'
  },
  openErrorsAndRisks: {
    governanceGaps: d3.summary.openGapCount,
    governanceContradictions: d3.summary.openContradictionCount,
    technicalFindings: d4.findingSummary.open,
    acceptedScopeIncomplete: incomplete.length,
    promotionRequiredIncomplete: promotionIncomplete.length,
    countedAsPass: 0
  },
  bronzeCompletionPercent: baseline.officialFields.bronzeCompletedPercent,
  bronzeRemainingPercent: baseline.officialFields.bronzeRemainingPercent,
  estimatedBronzeCompletion: 'UNAVAILABLE_NO_CURRENT_EVIDENCE_BACKED_VELOCITY',
  estimatedSilverTransition: 'UNAVAILABLE_NOT_READY',
  estimatedGoldTransition: 'UNAVAILABLE_NOT_READY',
  estimateConfidence: 'UNAVAILABLE_FAIL_CLOSED',
  conversationCapacity: conversation.status,
  handoffPromptStatus: conversation.handoff,
  sourceArchive: baseline.sourceAuthorityArchive,
  sourceSha256: baseline.sourceAuthorityArchiveSha256,
  manifest: 'artifacts/manifests/ALL_DOCUMENTS_INDEX.json',
  persistentLibraryPath: "Panthera pardus tulliana/Anadolu Parsı Aile Yaşam Merkezi/Bronze 04.08.2026.29/checkpoints/29-D5_Kapsam_Ve_Gercek_Ilerleme_Raporu",
  persistentLibraryUploadStatus: 'PENDING',
  completeDocumentIndex: 'artifacts/manifests/ALL_DOCUMENTS_INDEX.json',
  nextOfficialTask: '29-D5 scope and real progress report Library finalization',
  mandatoryTruthSentence: TRUTH
};

const fingerprintBasis = { sourceBindings, scopeMetrics, progressTruth, planCounts, deliveryReport, preservedFailures };
const reportFingerprintSha256 = sha256(Buffer.from(stableStringify(fingerprintBasis)));
const report = {
  schemaVersion: 1,
  release: registry.release,
  step: '29-D5',
  title: 'Scope and real progress report',
  phase: 'LOCAL_REPORT_AWAITING_LIBRARY_RECEIPT',
  status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT',
  validationStatus: 'PENDING',
  persistentReceiptStatus: 'PENDING',
  persistentReceiptPath: null,
  sourceBindings,
  authorityVerdict: {
    officialProgressSourceStatus: 'BOUND',
    historicalEstimateSupersedesCurrentAuthority: false,
    strictScopeMetricSupersedesCurrentAuthority: false,
    evidenceBackedRecalculationAvailable: false
  },
  scopeMetrics,
  progressTruth,
  workSegmentation: {
    ...planCounts,
    currentStep: plan.currentStep,
    activeSteps: plan.steps.filter((item) => item.status === 'IN_PROGRESS').map((item) => item.id),
    completedSteps: plan.steps.filter((item) => item.status === 'COMPLETED').map((item) => item.id),
    pendingSteps: plan.steps.filter((item) => item.status === 'PENDING').map((item) => item.id),
    classification: 'WORKFLOW_PROGRESS_NOT_PRODUCT_COMPLETION_PERCENT'
  },
  unresolvedTruth: {
    governanceGaps: { open: d3.summary.openGapCount, countedAsPass: d3.summary.gapsCountedAsPass },
    governanceContradictions: { open: d3.summary.openContradictionCount, countedAsPass: d3.summary.contradictionsCountedAsPass },
    technicalFindings: { open: d4.findingSummary.open, countedAsPass: d4.findingSummary.countedAsPass },
    dependencyBackedExecution: {
      typecheck: d4.executionEvidence.dependencyBackedTypecheck.status,
      tests: d4.executionEvidence.unitAndIntegrationTests.status,
      productionBuild: d4.executionEvidence.productionBuild.status,
      installerBuild: d4.executionEvidence.installerBuild.status,
      countedAsPass: false
    }
  },
  preservedFailures,
  featureRealityGate: {
    status: featureReality.status,
    classification: 'HONESTY_GATE_PASS_NOT_SCOPE_COMPLETION_PASS',
    requirementsReported: featureReality.requirements,
    incompletePromotionRequired: featureReality.incompleteRequired,
    silverReady: featureReality.silverReady,
    countedAsScopePass: false
  },
  readiness: {
    bronzeContinuation: 'AUTHORIZED_WITH_OPEN_SCOPE',
    bronzeCompletion: 'NOT_COMPLETE',
    silver: baseline.officialFields.silverStatus,
    gold: baseline.officialFields.goldStatus,
    releasePromotionAuthorized: false
  },
  deliveryReport,
  reportFingerprintSha256,
  nextOfficialStep: '29-D5',
  nextOfficialStepStatus: 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT',
  nextOfficialStepAuthorized: false,
  conversationCapacity: conversation.status,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};

await mkdir('artifacts/inventory', { recursive: true });
await mkdir('docs/audit', { recursive: true });
await writeFile('artifacts/inventory/29-D5_SCOPE_AND_REAL_PROGRESS_REPORT.json', JSON.stringify(report, null, 2) + '\n');
const statusRows = Object.entries(scopeMetrics.statusCounts).map(([status, count]) => `| ${status} | ${count} |`).join('\n');
const sourceRows = Object.entries(scopeMetrics.sourceCounts).map(([source, count]) => `| ${source} | ${count} |`).join('\n');
const markdown = `# 29-D5 — Kapsam ve Gerçek İlerleme Raporu\n\n- Rapor doğrulaması: **PENDING**\n- Resmî doğrulanmış Bronze ilerleme: **%${progressTruth.officialValidatedProgress.completedPercent.toFixed(1)}**\n- Resmî kalan: **%${progressTruth.officialValidatedProgress.remainingPercent.toFixed(1)}**\n- Katı kabul edilmiş kapsam tamlığı: **${complete.length}/${requirements.length} — %${scopeMetrics.strictOverallCompletionPercent.toFixed(4)}**\n- Silver kapısı P0/P1 tamlığı: **${promotionComplete.length}/${promotionRequired.length} — %${scopeMetrics.promotionRequired.completionPercent.toFixed(4)}**\n- P0/P1 açık: **${promotionIncomplete.length}; feature-reality honesty gate PASS, kapsam PASS değil**\n- P2 kabul edilmiş açık kapsam: **${scopeMetrics.p2AcceptedButNotPromotionGate.incomplete}**\n- Tarihsel Build ${latestHistoricalProgressBuild?.build ?? 'UNAVAILABLE'} tahmini: **%${latestHistoricalProgressBuild?.projectProgressAssessment?.codingCompletionPercent ?? 'UNAVAILABLE'}; CURRENT DEĞİL, kullanılmadı**\n- Güncel ETA: **UNAVAILABLE — kanıta bağlı güncel hız ve kapsam→ağırlık eşlemesi yok**\n- Açık yönetişim boşluğu: **${d3.summary.openGapCount}; PASS sayılan: 0**\n- Açık teknik bulgu: **${d4.findingSummary.open}; PASS sayılan: 0**\n- Typecheck/test/build/installer: **NOT_RUN / PASS DEĞİL**\n- Silver/Gold: **YASAK / HAZIR DEĞİL**\n- Sohbet kapasitesi: **${conversation.status}**\n\n## Metrik ayrımı\n\n1. **%25,0**, güncel resmî paket tarafından kilitlenen doğrulanmış Bronze ilerlemesidir.\n2. **${complete.length}/${requirements.length}**, yalnız COMPLETE ve bütün zincir alanları true olan kabul edilmiş kapsam oranıdır; resmî Bronze yüzdesinin yerine geçmez.\n3. Tarihsel **%${latestHistoricalProgressBuild?.projectProgressAssessment?.codingCompletionPercent ?? 'UNAVAILABLE'}**, eski ağırlıklı mühendislik tahminidir; güncel otoriteyi geçersiz kılamaz.\n4. Bu metrikler ortalanamaz, birbirinin yerine kullanılamaz ve kanıtsız ilerleme artışı üretemez.\n\n## Durum dağılımı\n\n| Durum | Adet |\n|---|---:|\n${statusRows}\n\n## Kaynak dağılımı\n\n| Kapsam kaynağı | Adet |\n|---|---:|\n${sourceRows}\n\n${TRUTH}\n`;
await writeFile('docs/audit/29-D5_KAPSAM_VE_GERCEK_ILERLEME_RAPORU.md', markdown);
console.log(`29-D5 scope/progress report generated: official ${baseline.officialFields.bronzeCompletedPercent}% / strict ${complete.length}/${requirements.length} / validation PENDING.`);
