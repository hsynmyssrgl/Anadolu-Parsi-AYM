import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const RELEASE = 'Bronze 04.08.2026.29';
const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const stableStringify = (value) => JSON.stringify(stable(value));

const paths = {
  gaps: 'artifacts/inventory/29-D2-C_GAP_REGISTER.json',
  contradictions: 'artifacts/inventory/29-D2-D2_CONTRADICTION_REGISTER.json',
  recoveryAuthority: 'artifacts/authority/29-D3_RECOVERY_AUTHORITY_SNAPSHOT.json',
  releaseLedger: 'config/release-ledger.json',
  governanceLedger: 'config/active-governance-ledger.json',
  canonicalRules: 'config/canonical-rule-registry.json',
  acceptedScope: 'config/accepted-scope-registry.json',
  workPlan: 'config/work-segmentation-plan.json',
  parentCompletion: 'artifacts/checkpoints/29-D2-D_PARENT_COMPLETION_RECORD.json'
};
const loaded = await Promise.all(Object.entries(paths).map(async ([id, path]) => {
  const bytes = await readFile(path);
  return [id, { path, bytes, json: JSON.parse(bytes.toString('utf8')), sizeBytes: bytes.length, sha256: sha256(bytes) }];
}));
const source = Object.fromEntries(loaded);
const gaps = source.gaps.json;
const contradictions = source.contradictions.json;
const authority = source.recoveryAuthority.json;
const releaseLedger = source.releaseLedger.json;
const governance = source.governanceLedger.json;
const canonical = source.canonicalRules.json;
const acceptedScope = source.acceptedScope.json;
const plan = source.workPlan.json;
const parentCompletion = source.parentCompletion.json;
const workPlanSnapshotPath = 'artifacts/inventory/snapshots/29-D3_WORK_PLAN_AT_GENERATION.json';
const workPlanSnapshotBytes = Buffer.from(JSON.stringify(plan, null, 2) + '\n');
await mkdir('artifacts/inventory/snapshots', { recursive: true });
await writeFile(workPlanSnapshotPath, workPlanSnapshotBytes);

if (gaps.gapCount !== 12 || gaps.unresolvedGapCount !== 12 || gaps.gaps.length !== 12) throw new Error('D2 gap baseline mismatch');
if (contradictions.openContradictionCount !== 3 || contradictions.contradictions.filter((item) => item.status === 'OPEN_EXPLICIT').length !== 3) throw new Error('D2 contradiction baseline mismatch');
if (authority.boundFields.lastFullClosedSourceRelease !== 'Bronze 04.08.2026.28' || authority.boundFields.conversationCapacity !== 'UNAVAILABLE') throw new Error('Recovery authority binding mismatch');
if (parentCompletion.status !== 'PASS' || parentCompletion.officialStepStatus !== 'COMPLETED') throw new Error('29-D2-D is not durably complete');
if (plan.currentStep !== '29-D3' || plan.steps.find((step) => step.id === '29-D3')?.status !== 'IN_PROGRESS') throw new Error('29-D3 is not the active step');

const dispositions = {
  'D2C-GAP-001': { resolutionStatus: 'OPEN_EXPLICIT_NOT_PASS', resolutionKind: 'UNAVAILABLE_EXTERNAL_OR_PLATFORM', evidence: [] },
  'D2C-GAP-002': { resolutionStatus: 'OPEN_EXPLICIT_NOT_PASS', resolutionKind: 'UNAVAILABLE_EXTERNAL_OR_PLATFORM', evidence: [] },
  'D2C-GAP-003': { resolutionStatus: 'OPEN_EXPLICIT_NOT_PASS', resolutionKind: 'UNAVAILABLE_EXTERNAL_OR_PLATFORM', evidence: ['artifacts/authority/29-D3_RECOVERY_AUTHORITY_SNAPSHOT.json'] },
  'D2C-GAP-004': { resolutionStatus: 'OPEN_EXPLICIT_NOT_PASS', resolutionKind: 'MISSING_HISTORICAL_EVIDENCE', evidence: [] },
  'D2C-GAP-005': { resolutionStatus: 'OPEN_EXPLICIT_NOT_PASS', resolutionKind: 'MISSING_HISTORICAL_EVIDENCE', evidence: [] },
  'D2C-GAP-006': { resolutionStatus: 'OPEN_EXPLICIT_NOT_PASS', resolutionKind: 'EXPLICIT_REQUIREMENT_DECISION_IDENTIFIER_UNAVAILABLE_NO_INFERENCE', evidence: ['config/accepted-scope-registry.json'] },
  'D2C-GAP-007': { resolutionStatus: 'OPEN_EXPLICIT_NOT_PASS', resolutionKind: 'EXPLICIT_RULE_DECISION_IDENTIFIER_UNAVAILABLE_NO_INFERENCE', evidence: ['config/canonical-rule-registry.json', 'config/user-decision-ledger.json'] },
  'D2C-GAP-008': { resolutionStatus: 'OPEN_EXPLICIT_NOT_PASS', resolutionKind: 'STANDALONE_PROVENANCE_SOURCE_NOT_FOUND_CANONICAL_REGISTRY_REMAINS_ACTIVE', evidence: ['config/canonical-rule-registry.json'] },
  'D2C-GAP-009': { resolutionStatus: 'RESOLVED_WITH_EVIDENCE_NOT_PASS', resolutionKind: 'EXPLICIT_RELEASE_LEDGER_SUPERSESSION', evidence: ['config/release-ledger.json', 'artifacts/authority/29-D3_RECOVERY_AUTHORITY_SNAPSHOT.json'] },
  'D2C-GAP-010': { resolutionStatus: 'RESOLVED_WITH_EVIDENCE_NOT_PASS', resolutionKind: 'ACTIVE_GOVERNANCE_TASK_SUPERSESSION', evidence: ['config/active-governance-ledger.json', 'config/work-segmentation-plan.json'] },
  'D2C-GAP-011': { resolutionStatus: 'RESOLVED_WITH_EVIDENCE_NOT_PASS', resolutionKind: 'STALE_TELEMETRY_SUPERSEDED_BY_UNAVAILABLE', evidence: ['config/active-governance-ledger.json', 'artifacts/authority/29-D3_RECOVERY_AUTHORITY_SNAPSHOT.json'] },
  'D2C-GAP-012': { resolutionStatus: 'OPEN_EXPLICIT_NOT_PASS', resolutionKind: 'UNAVAILABLE_RAW_TRANSCRIPT', evidence: ['config/user-decision-ledger.json'] }
};
const gapAnalyses = gaps.gaps.map((gap) => ({
  ...gap,
  ...dispositions[gap.id],
  countedAsPass: false,
  sourceRecordPreserved: true
}));
const gap006 = gaps.gaps.find((gap) => gap.id === 'D2C-GAP-006');
const gap007 = gaps.gaps.find((gap) => gap.id === 'D2C-GAP-007');
const gap008 = gaps.gaps.find((gap) => gap.id === 'D2C-GAP-008');
const ruleIds = new Set(canonical.rules.map((rule) => rule.id));
const requirementIds = new Set(acceptedScope.requirements.map((requirement) => requirement.id));
const requirementDecisionLineage = gap006.affectedRequirementIds.map((id) => ({
  requirementId: id,
  requirementExists: requirementIds.has(id),
  explicitDecisionId: null,
  status: 'UNAVAILABLE_NO_EXPLICIT_IDENTIFIER_NO_INFERENCE',
  countedAsPass: false
}));
const ruleDecisionLineage = gap007.affectedRuleIds.map((id) => ({
  ruleId: id,
  ruleExists: ruleIds.has(id),
  explicitDecisionId: null,
  status: 'UNAVAILABLE_NO_EXPLICIT_IDENTIFIER_NO_INFERENCE',
  countedAsPass: false
}));
const ruleSourceProvenance = gap008.affectedRuleIds.map((id) => ({
  ruleId: id,
  ruleExists: ruleIds.has(id),
  activeAuthority: 'config/canonical-rule-registry.json',
  standaloneV6Source: 'NOT_FOUND_AS_STANDALONE_INPUT',
  status: 'OPEN_PROVENANCE_GAP_CANONICAL_RULE_REMAINS_ACTIVE',
  countedAsPass: false
}));
const contradictionAnalyses = contradictions.contradictions.map((item) => {
  if (item.status === 'RESOLVED_WITH_EVIDENCE') return { ...item, d3Status: 'PRESERVED_PRIOR_RESOLUTION', countedAsPass: false };
  const gap = gapAnalyses.find((entry) => entry.id === item.sourceGapId);
  return {
    ...item,
    d3Status: gap?.resolutionStatus === 'RESOLVED_WITH_EVIDENCE_NOT_PASS' ? 'RESOLVED_WITH_EVIDENCE_NOT_PASS' : 'OPEN_EXPLICIT_NOT_PASS',
    d3ResolutionKind: gap?.resolutionKind ?? 'UNAVAILABLE',
    evidence: gap?.evidence ?? [],
    countedAsPass: false
  };
});
const sourceBindings = Object.entries(source)
  .filter(([id]) => id !== 'workPlan')
  .map(([id, item]) => ({ id, path: item.path, sizeBytes: item.sizeBytes, sha256: item.sha256 }));
sourceBindings.push({ id: 'workPlanSnapshot', path: workPlanSnapshotPath, sizeBytes: workPlanSnapshotBytes.length, sha256: sha256(workPlanSnapshotBytes) });
const summary = {
  originalGapCount: 12,
  resolvedGapCount: gapAnalyses.filter((item) => item.resolutionStatus === 'RESOLVED_WITH_EVIDENCE_NOT_PASS').length,
  openGapCount: gapAnalyses.filter((item) => item.resolutionStatus === 'OPEN_EXPLICIT_NOT_PASS').length,
  gapsCountedAsPass: gapAnalyses.filter((item) => item.countedAsPass).length,
  originalOpenContradictionCount: 3,
  resolvedIn29D3ContradictionCount: contradictionAnalyses.filter((item) => item.d3Status === 'RESOLVED_WITH_EVIDENCE_NOT_PASS').length,
  openContradictionCount: contradictionAnalyses.filter((item) => item.d3Status === 'OPEN_EXPLICIT_NOT_PASS').length,
  contradictionsCountedAsPass: contradictionAnalyses.filter((item) => item.countedAsPass).length,
  requirementDecisionLinksUnavailable: requirementDecisionLineage.length,
  ruleDecisionLinksUnavailable: ruleDecisionLineage.length,
  standaloneRuleProvenanceLinksUnavailable: ruleSourceProvenance.length
};
const fingerprintBasis = { release: RELEASE, sourceBindings, gapAnalyses, contradictionAnalyses, requirementDecisionLineage, ruleDecisionLineage, ruleSourceProvenance, summary };
const analysis = {
  schemaVersion: 1,
  release: RELEASE,
  step: '29-D3',
  title: 'Rule gap and conflict analysis',
  phase: 'LOCAL_ANALYSIS_AWAITING_LIBRARY_RECEIPT',
  status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT',
  validationStatus: 'PENDING',
  persistentReceiptStatus: 'PENDING',
  persistentReceiptPath: null,
  sourceBindings,
  gapAnalyses,
  contradictionAnalyses,
  requirementDecisionLineage,
  ruleDecisionLineage,
  ruleSourceProvenance,
  summary,
  authorityUpdates: {
    releaseLedgerSupersession: 'REL-SUP-29-D3-001',
    governanceTaskSupersession: 'GOV-SUP-29-D3-001',
    conversationTelemetrySupersession: 'GOV-SUP-29-D3-002',
    historicalSourceFilesRewritten: false
  },
  preservedFailures: [
    {
      path: 'artifacts/checkpoints/29-D3_PARENT_REGRESSION_FORWARD_STATE_FAILURE.json',
      status: 'FAIL',
      processExitCode: 1,
      countedAsPass: false,
      correctionScope: 'FORWARD_STATE_COMPATIBILITY_ONLY'
    }
  ],
  nextOfficialStep: '29-D4',
  nextOfficialStepStatus: 'PENDING_AWAITING_29-D3_RECEIPT',
  nextOfficialStepAuthorized: false,
  bronzeCompletedPercent: 25.0,
  bronzeRemainingPercent: 75.0,
  silverStatus: 'BLOCKED_NOT_READY',
  goldStatus: 'BLOCKED_NOT_READY',
  conversationCapacity: 'UNAVAILABLE',
  analysisFingerprintSha256: sha256(Buffer.from(stableStringify(fingerprintBasis))),
  generatedAt: parentCompletion.completedAt,
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/inventory', { recursive: true });
await mkdir('docs/audit', { recursive: true });
await writeFile('artifacts/inventory/29-D3_RULE_GAP_AND_CONFLICT_ANALYSIS.json', JSON.stringify(analysis, null, 2) + '\n');
const markdown = `# 29-D3 — Kural Boşluğu ve Çelişki Analizi\n\n- Yerel analiz: **PENDING VALIDATION**\n- Kaynak boşluk: **12**\n- Kanıtla çözülen boşluk: **${summary.resolvedGapCount}; PASS sayılan: 0**\n- Açık kalan boşluk: **${summary.openGapCount}; PASS sayılan: 0**\n- Kaynak açık çelişki: **3**\n- Kanıtla çözülen çelişki: **${summary.resolvedIn29D3ContradictionCount}; PASS sayılan: 0**\n- Açık kalan çelişki: **${summary.openContradictionCount}**\n- Açık gereksinim→DEC bağı: **${summary.requirementDecisionLinksUnavailable}**\n- Açık kural→DEC bağı: **${summary.ruleDecisionLinksUnavailable}**\n- Standalone V6 provenance boşluğu: **${summary.standaloneRuleProvenanceLinksUnavailable} kural**\n- Kalıcı Library receipt: **PENDING**\n- 29-D4: **PENDING**\n- Bronze doğrulanmış ilerleme: **%25,0**\n\nÇözülmemiş kimlik ve kaynak bağları için semantik çıkarım yapılmadı. Tarihsel D2 registerları değiştirilmedi.\n\n${TRUTH}\n`;
await writeFile('docs/audit/29-D3_KURAL_BOSLUGU_VE_CELISKI_ANALIZI.md', markdown);
console.log(`29-D3 analysis generated: ${analysis.analysisFingerprintSha256} / ${summary.openGapCount} open gaps / ${summary.openContradictionCount} open contradictions.`);
