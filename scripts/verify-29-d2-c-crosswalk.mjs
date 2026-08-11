import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { readJson } from './lib/governance-utils.mjs';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const EXPECTED_D2B_RECEIPT_SHA = '4bbc95633f15be5adf7ea79cdc8d939e1422bb8bdbdf8987d91d36bfcd9c725f';
const EXPECTED_INPUT_FINGERPRINT = '222b81c266ed6f2bb39a57808c065a55dfcf0567b146a23737157cf4a92a634e';
const BASE = 'artifacts/inventory/29-D2-C_inputs';
const failures = [];
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sha256File = async (path) => sha256(await readFile(path));
const existsFile = async (path) => { try { return (await stat(path)).isFile(); } catch { return false; } };
const countBy = (values) => Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((entry) => entry === value).length]));
const stableEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index += 1; }
        else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows.filter((entry) => !(entry.length === 1 && entry[0] === ''));
}

const manifest = await readJson(`${BASE}/29-D2-C_INPUT_SNAPSHOT_MANIFEST.json`);
const crosswalk = await readJson('artifacts/inventory/29-D2-C_CROSSWALK.json');
const gapRegister = await readJson('artifacts/inventory/29-D2-C_GAP_REGISTER.json');
const workPlan = await readJson('config/work-segmentation-plan.json');
const d2bReceipt = await readJson(`${BASE}/prior/29-D2-B_FINALIZATION_LIBRARY_RECEIPT.json`);
const startWrapperFailure = await readJson('artifacts/checkpoints/29-D2-C_START_STEP_GATE_WRAPPER_CONTRADICTION.json');
const snapshotFailure = await readJson('artifacts/checkpoints/29-D2-C_INPUT_SNAPSHOT_FIRST_ATTEMPT_FAILURE.json');
const supersededAttempt = await readJson('artifacts/checkpoints/29-D2-C_SUPERSEDED_LOCAL_ATTEMPT.json');

check(manifest.schemaVersion === 1, 'input manifest schema mismatch');
check(manifest.release === 'Bronze 04.08.2026.29', 'input manifest release mismatch');
check(manifest.workStep === '29-D2-C', 'input manifest step mismatch');
check(manifest.status === 'LOCKED', 'input snapshot manifest must be LOCKED');
check(manifest.inputCount === 76, `input snapshot count ${manifest.inputCount}/76`);
check(manifest.inputCount === (manifest.entries ?? []).length, 'input snapshot entry count mismatch');
check(manifest.inputSetFingerprintSha256 === EXPECTED_INPUT_FINGERPRINT, 'input snapshot declared fingerprint mismatch');
const inputMaterial = [];
for (const entry of manifest.entries ?? []) {
  const path = `${BASE}/${entry.path}`;
  let bytes;
  try { bytes = await readFile(path); check(true, `input exists ${entry.path}`); }
  catch { check(false, `input missing ${entry.path}`); continue; }
  check(bytes.length === entry.sizeBytes, `input size mismatch ${entry.path}`);
  check(sha256(bytes) === entry.sha256, `input SHA mismatch ${entry.path}`);
  inputMaterial.push(`${entry.path}|${entry.sizeBytes}|${entry.sha256}`);
}
check(sha256(Buffer.from(inputMaterial.join('\n'))) === EXPECTED_INPUT_FINGERPRINT, 'input snapshot recomputed fingerprint mismatch');

check(await sha256File(`${BASE}/prior/29-D2-B_FINALIZATION_LIBRARY_RECEIPT.json`) === EXPECTED_D2B_RECEIPT_SHA, 'D2-B final receipt SHA mismatch');
check(d2bReceipt.release === 'Bronze 04.08.2026.29' && d2bReceipt.step === '29-D2-B', 'D2-B receipt identity mismatch');
check(d2bReceipt.status === 'PASS', 'D2-B receipt status is not PASS');
check(d2bReceipt.officialStepStatus === 'COMPLETED', 'D2-B official status is not COMPLETED');
check(d2bReceipt.validationStatus === 'PASS', 'D2-B validation status is not PASS');
check(d2bReceipt.persistentReceiptStatus === 'PASS', 'D2-B persistent receipt status is not PASS');
check(d2bReceipt.nextStep === '29-D2-C' && d2bReceipt.nextStepAuthorized === true, 'D2-B did not authorize 29-D2-C');

const d2bStep = (workPlan.steps ?? []).find((step) => step.id === '29-D2-B');
const d2cStep = (workPlan.steps ?? []).find((step) => step.id === '29-D2-C');
check(workPlan.release === 'Bronze 04.08.2026.29', 'work plan release mismatch');
check(d2cStep?.status === 'COMPLETED' ? workPlan.currentStep === '29-D2-D' : workPlan.currentStep === '29-D2-C', d2cStep?.status === 'COMPLETED' ? '29-D2-D must be current after 29-D2-C completion' : '29-D2-C must remain current');
check(d2bStep?.status === 'COMPLETED' && d2bStep?.validationStatus === 'PASS', '29-D2-B prerequisite lifecycle mismatch');
check(d2bStep?.persistentReceiptStatus === 'PASS' && d2bStep?.finalizationReceiptStatus === 'PASS', '29-D2-B receipt prerequisite mismatch');
check(['IN_PROGRESS', 'COMPLETED'].includes(d2cStep?.status), `29-D2-C lifecycle status invalid ${d2cStep?.status}`);
if (d2cStep?.status === 'IN_PROGRESS') {
  check((workPlan.steps ?? []).filter((step) => step.status === 'IN_PROGRESS').length === 1, 'exactly one work step must be IN_PROGRESS');
  check(['PENDING', 'PASS'].includes(d2cStep.validationStatus), '29-D2-C main validation lifecycle value invalid');
  check(['PENDING', 'PASS'].includes(d2cStep.persistentReceiptStatus), '29-D2-C main receipt lifecycle value invalid');
  if (d2cStep.persistentReceiptStatus === 'PASS') {
    check(d2cStep.persistentReceiptPath === 'artifacts/checkpoints/29-D2-C_LIBRARY_RECEIPT.json', '29-D2-C main receipt path mismatch');
    check(d2cStep.finalizationReceiptStatus === 'PENDING', '29-D2-C finalization receipt must remain PENDING before finalization');
  }
} else {
  check(d2cStep.validationStatus === 'PASS', 'completed 29-D2-C validation is not PASS');
  check(d2cStep.persistentReceiptStatus === 'PASS', 'completed 29-D2-C persistent receipt is not PASS');
  check(d2cStep.persistentReceiptPath === 'artifacts/checkpoints/29-D2-C_LIBRARY_RECEIPT.json', 'completed 29-D2-C receipt path mismatch');
  check(d2cStep.finalizationReceiptStatus === 'PASS', 'completed 29-D2-C finalization receipt is not PASS');
  check(d2cStep.finalizationReceiptPath === 'artifacts/checkpoints/29-D2-C_FINALIZATION_LIBRARY_RECEIPT.json', 'completed 29-D2-C finalization receipt path mismatch');
}

check(crosswalk.schemaVersion === 1, 'crosswalk schema mismatch');
check(crosswalk.release === 'Bronze 04.08.2026.29', 'crosswalk release mismatch');
check(crosswalk.workStep === '29-D2-C' && crosswalk.parentStep === '29-D2', 'crosswalk step identity mismatch');
check(['IN_PROGRESS_LOCAL_CROSSWALK_CREATED_AWAITING_VALIDATION_AND_LIBRARY_RECEIPT', 'IN_PROGRESS_LOCAL_VALIDATION_PASS_AWAITING_LIBRARY_RECEIPT', 'IN_PROGRESS_MAIN_RECEIPT_PASS_AWAITING_FINALIZATION_RECEIPT', 'COMPLETED'].includes(crosswalk.status), `crosswalk status invalid ${crosswalk.status}`);
check(crosswalk.mandatoryTruthSentence === TRUTH, 'crosswalk truth sentence mismatch');
check(crosswalk.authorityPolicy?.currentRecoveryAuthorityOverridesHistoricalContext === true, 'current recovery authority policy mismatch');
check(crosswalk.authorityPolicy?.activeRegistriesOverrideHistoricalDocuments === true, 'active registry authority policy mismatch');
check(crosswalk.authorityPolicy?.historicalBuildStatusDoesNotCreateCurrentPass === true, 'historical build status must not create PASS');
check(crosswalk.authorityPolicy?.semanticLinksInferred === false, 'semantic links must not be inferred');
check(crosswalk.authorityPolicy?.unavailableContentInvented === false, 'unavailable content must not be invented');
check(crosswalk.authorityPolicy?.missingEvidenceCountedAsPass === false, 'missing evidence must not count as PASS');

for (const [name, binding] of Object.entries(crosswalk.sourceBindings ?? {})) {
  check(Boolean(binding.path), `source binding path missing ${name}`);
  if (!binding.path) continue;
  check(await existsFile(binding.path), `source binding file missing ${name}: ${binding.path}`);
  if (await existsFile(binding.path)) check(await sha256File(binding.path) === binding.sha256, `source binding SHA mismatch ${name}`);
}
check(crosswalk.sourceBindings?.inputSnapshotManifest?.inputCount === 76, 'input binding count mismatch');
check(crosswalk.sourceBindings?.inputSnapshotManifest?.inputSetFingerprintSha256 === EXPECTED_INPUT_FINGERPRINT, 'input binding fingerprint mismatch');
check(crosswalk.sourceBindings?.d2bFinalizationReceipt?.sha256 === EXPECTED_D2B_RECEIPT_SHA, 'D2-B binding receipt SHA mismatch');
check(crosswalk.sourceBindings?.d2bFinalizationReceipt?.status === 'PASS' && crosswalk.sourceBindings?.d2bFinalizationReceipt?.officialStepStatus === 'COMPLETED', 'D2-B binding receipt state mismatch');

const expectedSummary = {
  inputSnapshotCount: 76,
  inputSnapshotFingerprintSha256: EXPECTED_INPUT_FINGERPRINT,
  correspondenceEventCount: 25,
  correspondenceSourceAvailability: 'PARTIAL',
  buildCount: 228,
  buildSequenceComplete: true,
  buildCoreFieldExactMatchCount: 228,
  buildSummaryExactMatchCount: 227,
  buildAllowedSummaryNormalizationCount: 1,
  buildEvidenceReferenceCount: 1043,
  buildEvidenceFoundCount: 932,
  buildEvidenceNotFoundCount: 111,
  buildEvidenceUniqueNotFoundCount: 87,
  decisionUnionCount: 43,
  activeDecisionCount: 9,
  activeDecisionDocumentResolvedCount: 9,
  decisionReleaseCounts: { 'Bronze 04.08.2026.27': 2, 'Bronze 04.08.2026.28': 6, 'Bronze 04.08.2026.29': 1 },
  registerOnlyDecisionCount: 5,
  requirementCount: 350,
  requirementStatusCounts: { COMPLETE: 4, FOUNDATION_STARTED: 5, NOT_IMPLEMENTED: 295, PARTIAL: 46 },
  requirementEvidenceReferenceCount: 62,
  requirementEvidenceFoundCount: 47,
  requirementEvidenceNotFoundCount: 15,
  requirementDecisionBooleanNoExplicitIdCount: 106,
  ruleCount: 208,
  activeRuleCount: 194,
  supersededRuleCount: 14,
  enforcementEntryCount: 194,
  activeRuleEnforcementFoundCount: 194,
  explicitDecisionLinkedRuleCount: 29,
  activeUserDecisionRuleMissingSpecificDecisionCount: 7,
  documentInventoryCount: 1437,
  activeAuthorityDocumentCount: 22,
  releaseRecordCount: 3,
  unresolvedGapCount: 12,
  relationCount: 1448,
  unavailableOrPartialInputCount: 4
};
check(stableEqual(crosswalk.summary, expectedSummary), 'crosswalk summary does not match governed expected totals');

const correspondence = crosswalk.correspondenceEvents ?? [];
check(correspondence.length === 25, `correspondence count ${correspondence.length}/25`);
for (let index = 0; index < correspondence.length; index += 1) {
  const event = correspondence[index];
  check(event.id === `CORR-${String(index + 1).padStart(3, '0')}`, `correspondence id sequence mismatch ${event.id}`);
  check(/^\d{2}\.\d{2}\.\d{4}$/.test(event.date ?? ''), `${event.id} date invalid`);
  check(Boolean(event.description), `${event.id} description missing`);
  check(event.sourceAvailability === 'PARTIAL', `${event.id} availability must be PARTIAL`);
  check(event.linkagePolicy === 'EXPLICIT_IDENTIFIER_ONLY_NO_SEMANTIC_INFERENCE', `${event.id} linkage policy mismatch`);
  for (const id of event.explicitBuildIds ?? []) check(/^BUILD-(?:00[1-9]|0[1-9]\d|1\d\d|2[0-1]\d|22[0-8])$/.test(id), `${event.id} invalid build reference ${id}`);
  for (const id of event.explicitIdentifiers ?? []) check(/^(?:PR|DEC|OPEN)-\d+$/.test(id), `${event.id} invalid explicit identifier ${id}`);
}

const builds = crosswalk.builds ?? [];
check(builds.length === 228, `build count ${builds.length}/228`);
check(new Set(builds.map((entry) => entry.id)).size === 228, 'build IDs are not unique');
let buildEvidenceReferences = 0;
let buildEvidenceFound = 0;
let buildEvidenceMissing = 0;
const missingBuildReferences = new Set();
for (let number = 1; number <= 228; number += 1) {
  const build = builds[number - 1];
  check(build?.build === number, `build sequence mismatch at ${number}`);
  check(build?.id === `BUILD-${String(number).padStart(3, '0')}`, `build id mismatch at ${number}`);
  check(build?.historicalClaimBoundary === 'HISTORICAL_RECORD_ONLY_DOES_NOT_CREATE_CURRENT_PASS', `${build?.id} historical claim boundary mismatch`);
  check(build?.chronologyComparison?.chronologyPresent === true, `${build?.id} chronology missing`);
  check(build?.chronologyComparison?.versionMatch === true, `${build?.id} version mismatch`);
  check(build?.chronologyComparison?.stageMatch === true, `${build?.id} stage mismatch`);
  check(build?.chronologyComparison?.statusMatch === true, `${build?.id} status mismatch`);
  check(build?.chronologyComparison?.evidenceMatch === true, `${build?.id} evidence mismatch`);
  if (number === 208) {
    check(build.chronologyComparison.summaryMatch === false, 'Build 208 summary must preserve one recorded difference');
    check(build.chronologyComparison.allowedDifference === 'BUILD_208_CONTEXT_CLEAN_SOURCE_BOUNDARY_TEXT_REMOVED', 'Build 208 allowed difference classification mismatch');
  } else {
    check(build.chronologyComparison.summaryMatch === true, `${build.id} unexpected summary mismatch`);
    check(build.chronologyComparison.allowedDifference === null, `${build.id} unexpected allowed difference`);
  }
  const resolutions = build.evidenceResolutions ?? [];
  check(build.evidenceReferenceCount === resolutions.length, `${build.id} evidence reference count mismatch`);
  check(build.evidenceFoundCount === resolutions.filter((entry) => String(entry.status).startsWith('FOUND_')).length, `${build.id} evidence found count mismatch`);
  check(build.evidenceNotFoundCount === resolutions.filter((entry) => entry.status === 'NOT_FOUND').length, `${build.id} evidence missing count mismatch`);
  buildEvidenceReferences += resolutions.length;
  buildEvidenceFound += resolutions.filter((entry) => String(entry.status).startsWith('FOUND_')).length;
  buildEvidenceMissing += resolutions.filter((entry) => entry.status === 'NOT_FOUND').length;
  for (const resolution of resolutions) {
    check(!['PASS', 'DIAGNOSTIC_PASS', 'NOT_RUN', 'PENDING', 'BLOCKED'].includes(resolution.status), `${build.id} invalid evidence result ${resolution.status}`);
    if (resolution.status === 'NOT_FOUND') missingBuildReferences.add(resolution.normalizedReference);
  }
}
check(buildEvidenceReferences === 1043, `build evidence reference total ${buildEvidenceReferences}/1043`);
check(buildEvidenceFound === 932, `build evidence found total ${buildEvidenceFound}/932`);
check(buildEvidenceMissing === 111, `build evidence missing total ${buildEvidenceMissing}/111`);
check(missingBuildReferences.size === 87, `unique missing build evidence ${missingBuildReferences.size}/87`);

const decisions = crosswalk.decisions ?? [];
check(decisions.length === 43, `decision union ${decisions.length}/43`);
check(new Set(decisions.map((entry) => entry.id)).size === 43, 'decision IDs are not unique');
const expectedActiveDecisions = ['DEC-121','DEC-122','DEC-123','DEC-124','DEC-125','DEC-126','DEC-127','DEC-128','DEC-129'];
const activeDecisions = decisions.filter((entry) => entry.activeLedgerPresence).map((entry) => entry.id);
check(stableEqual(activeDecisions, expectedActiveDecisions), 'active decision ID set mismatch');
for (const id of expectedActiveDecisions) {
  const decision = decisions.find((entry) => entry.id === id);
  check(decision?.activeStatus === 'ACTIVE', `${id} active status mismatch`);
  check(decision?.standaloneDocumentPresence === true, `${id} standalone document missing`);
  check(decision?.authorityClass === 'ACTIVE_DECISION_LEDGER', `${id} authority class mismatch`);
  check(Boolean(decision?.standaloneDocumentSha256), `${id} standalone SHA missing`);
}
const decisionReleaseCounts = countBy(decisions.filter((entry) => entry.activeLedgerPresence).map((entry) => entry.visibleRelease));
check(stableEqual(decisionReleaseCounts, expectedSummary.decisionReleaseCounts), 'active decision release counts mismatch');
const registerOnly = decisions.filter((entry) => entry.masterRegisterPresence && !entry.standaloneDocumentPresence && !entry.activeLedgerPresence).map((entry) => entry.id);
check(stableEqual(registerOnly, ['DEC-083','DEC-087','DEC-088','DEC-095','DEC-096']), 'register-only decision set mismatch');

const requirements = crosswalk.requirements ?? [];
check(requirements.length === 350, `requirement count ${requirements.length}/350`);
check(new Set(requirements.map((entry) => entry.id)).size === 350, 'requirement IDs are not unique');
check(stableEqual(countBy(requirements.map((entry) => entry.status)), expectedSummary.requirementStatusCounts), 'requirement status counts mismatch');
const requirementResolutions = requirements.flatMap((entry) => entry.evidenceResolutions ?? []);
check(requirementResolutions.length === 62, `requirement evidence reference total ${requirementResolutions.length}/62`);
check(requirementResolutions.filter((entry) => String(entry.status).startsWith('FOUND_')).length === 47, 'requirement evidence found total mismatch');
const missingRequirementResolutions = requirementResolutions.filter((entry) => entry.status === 'NOT_FOUND');
check(missingRequirementResolutions.length === 15, `requirement evidence missing total ${missingRequirementResolutions.length}/15`);
check(stableEqual([...new Set(missingRequirementResolutions.map((entry) => entry.normalizedReference))], ['artifacts/validation/core-service-local-admin-runtime.json']), 'requirement missing evidence path mismatch');
check(requirements.filter((entry) => entry.decisionChainDeclared && entry.explicitDecisionIds.length === 0).length === 106, 'requirement decision boolean/no explicit ID count mismatch');
for (const entry of missingRequirementResolutions) check(!['PASS','DIAGNOSTIC_PASS','NOT_RUN','PENDING','BLOCKED'].includes(entry.status), 'missing requirement evidence improperly counted as PASS-like status');

const rules = crosswalk.rules ?? [];
check(rules.length === 208, `rule count ${rules.length}/208`);
check(new Set(rules.map((entry) => entry.id)).size === 208, 'rule IDs are not unique');
check(rules.filter((entry) => entry.state === 'ACTIVE').length === 194, 'ACTIVE rule count mismatch');
check(rules.filter((entry) => entry.state === 'SUPERSEDED').length === 14, 'SUPERSEDED rule count mismatch');
check(rules.filter((entry) => entry.state === 'ACTIVE' && entry.enforcementStatus === 'FOUND_EXACT').length === 194, 'ACTIVE rule enforcement mapping incomplete');
check(rules.filter((entry) => entry.explicitDecisionIds.length > 0).length === 29, 'explicit decision-linked rule count mismatch');
const unlinkedUserDecisionRules = rules.filter((entry) => entry.specificDecisionLinkStatus === 'MISSING_SPECIFIC_DECISION_ID').map((entry) => entry.id);
check(stableEqual(unlinkedUserDecisionRules, ['PR-176','PR-186','PR-189','PR-190','PR-191','PR-192','PR-193']), 'user-decision rules missing specific DEC set mismatch');
check(rules.filter((entry) => entry.source === 'PROJECT-RULES-2026-08-02-V6').length === 172, 'PROJECT-RULES V6 lineage count mismatch');
for (const rule of rules.filter((entry) => entry.state === 'ACTIVE')) check(Boolean(rule.enforcement), `${rule.id} ACTIVE enforcement object missing`);

const releases = crosswalk.releases ?? [];
check(releases.length === 3, `release record count ${releases.length}/3`);
const r27 = releases.find((entry) => entry.visibleRelease === 'Bronze 04.08.2026.27');
const r28 = releases.find((entry) => entry.visibleRelease === 'Bronze 04.08.2026.28');
const r29 = releases.find((entry) => entry.visibleRelease === 'Bronze 04.08.2026.29');
check(stableEqual(r27?.decisionIds, ['DEC-121','DEC-122']), '.27 decision set mismatch');
check(r27?.statusComparison === 'HISTORICAL_NO_HANDOFF_STATUS_ASSERTION', '.27 status comparison mismatch');
check(stableEqual(r28?.decisionIds, ['DEC-123','DEC-124','DEC-125','DEC-126','DEC-127','DEC-128']), '.28 decision set mismatch');
check(r28?.ledgerStatus === 'IN_PROGRESS' && r28?.handoffStatus === 'COMPLETED_SOURCE_CLOSURE_PASS' && r28?.statusComparison === 'CONTRADICTION_STALE_LEDGER', '.28 authority contradiction not preserved');
check(stableEqual(r29?.decisionIds, ['DEC-129']), '.29 decision set mismatch');
check(r29?.ledgerStatus === 'IN_PROGRESS' && r29?.handoffStatus === 'IN_PROGRESS_NO_FULL_BUILD_CLOSURE' && r29?.statusComparison === 'MATCH', '.29 release status comparison mismatch');

check(crosswalk.activeGovernanceComparison?.governedCurrentStep === workPlan.currentStep, 'active governance governed current step mismatch');
check(crosswalk.activeGovernanceComparison?.nextTaskStatus === 'STALE', 'stale next task must be explicit');
check(crosswalk.activeGovernanceComparison?.authoritativePreviousChatCapacity === 'UNAVAILABLE', 'previous chat capacity authority mismatch');
check(crosswalk.activeGovernanceComparison?.capacityStatus === 'STALE_TELEMETRY_MUST_NOT_OVERRIDE_HANDOFF', 'capacity staleness classification mismatch');
const expectedDiscrepancies = [
  ['D2C-DISC-001','ALLOWED_NORMALIZATION'],
  ['D2C-DISC-002','SUPERSEDED_BY_ACTIVE_SCOPE'],
  ['D2C-DISC-003','HISTORICAL_ONLY_NO_OVERRIDE'],
  ['D2C-DISC-004','REGISTER_ONLY']
];
check(stableEqual((crosswalk.discrepancies ?? []).map((entry) => [entry.id, entry.status]), expectedDiscrepancies), 'discrepancy register mismatch');

const expectedGaps = [
  ['D2C-GAP-001','UNAVAILABLE','BLOCKING_FOR_FULL_HISTORICAL_AUDIT',1],
  ['D2C-GAP-002','UNAVAILABLE','BLOCKING_FOR_FULL_HISTORICAL_AUDIT',1],
  ['D2C-GAP-003','UNAVAILABLE','TRUTH_GATE',1],
  ['D2C-GAP-004','NOT_FOUND','HISTORICAL_EVIDENCE_GAP',111],
  ['D2C-GAP-005','NOT_FOUND','EVIDENCE_LINK_GAP',15],
  ['D2C-GAP-006','MISSING_EXPLICIT_IDENTIFIER','REQUIRES_D3_REVIEW',106],
  ['D2C-GAP-007','MISSING_EXPLICIT_IDENTIFIER','REQUIRES_D3_REVIEW',7],
  ['D2C-GAP-008','NOT_FOUND_AS_STANDALONE_INPUT','PROVENANCE_GAP',172],
  ['D2C-GAP-009','CONTRADICTION','ACTIVE_AUTHORITY_STALENESS',1],
  ['D2C-GAP-010','STALE','ACTIVE_AUTHORITY_STALENESS',1],
  ['D2C-GAP-011','STALE_TELEMETRY','TRUTH_GATE',1],
  ['D2C-GAP-012','UNAVAILABLE_RAW_TRANSCRIPT','HISTORICAL_SOURCE_GAP',7]
];
const actualGaps = (crosswalk.gaps ?? []).map((entry) => [entry.id, entry.status, entry.severity, entry.affectedCount]);
check(stableEqual(actualGaps, expectedGaps), 'crosswalk gap register mismatch');
check(gapRegister.release === crosswalk.release && gapRegister.workStep === '29-D2-C', 'gap register identity mismatch');
check(gapRegister.status === 'OPEN_GAPS_RECORDED_NOT_PASS', 'gap register status mismatch');
check(gapRegister.gapCount === 12 && gapRegister.unresolvedGapCount === 12, 'gap count mismatch');
check(stableEqual(gapRegister.gaps, crosswalk.gaps), 'gap register/crosswalk gap content mismatch');
check(gapRegister.mandatoryTruthSentence === TRUTH, 'gap register truth sentence mismatch');
for (const gap of gapRegister.gaps ?? []) check(!['PASS','DIAGNOSTIC_PASS','NOT_RUN','PENDING','BLOCKED'].includes(gap.status), `${gap.id} invalid gap status ${gap.status}`);

const relationRows = parseCsv(await readFile('artifacts/inventory/29-D2-C_CROSSWALK_RELATIONS.csv', 'utf8'));
const relationHeader = ['relationId','fromType','fromId','relationType','toType','toId','resolutionStatus','sourceMethod','note'];
check(stableEqual(relationRows[0], relationHeader), 'relation CSV header mismatch');
const relations = relationRows.slice(1).map((row) => Object.fromEntries(relationHeader.map((field, index) => [field, row[index] ?? ''])));
check(relations.length === 1448, `relation CSV rows ${relations.length}/1448`);
for (let index = 0; index < relations.length; index += 1) {
  const relation = relations[index];
  check(relation.relationId === `REL-${String(index + 1).padStart(5, '0')}`, `relation sequence mismatch ${relation.relationId}`);
  check(Boolean(relation.fromType && relation.fromId && relation.relationType && relation.toType && relation.toId), `${relation.relationId} required field missing`);
  check(!/SEMANTIC/i.test(relation.sourceMethod), `${relation.relationId} semantic inference source method prohibited`);
}
const gapCsvRows = parseCsv(await readFile('artifacts/inventory/29-D2-C_GAP_REGISTER.csv', 'utf8'));
const gapHeader = ['id','category','severity','status','affectedCount','source','detail','nextAction'];
check(stableEqual(gapCsvRows[0], gapHeader), 'gap CSV header mismatch');
check(gapCsvRows.length - 1 === 12, `gap CSV rows ${gapCsvRows.length - 1}/12`);
for (let index = 0; index < 12; index += 1) {
  const row = gapCsvRows[index + 1];
  const gap = crosswalk.gaps[index];
  check(row[0] === gap.id && row[1] === gap.category && row[2] === gap.severity && row[3] === gap.status && Number(row[4]) === gap.affectedCount, `gap CSV mismatch ${gap.id}`);
}

const relationFingerprint = sha256(Buffer.from(JSON.stringify(relations)));
const gapFingerprint = sha256(Buffer.from(JSON.stringify(crosswalk.gaps)));
const fingerprintPayload = {
  summary: crosswalk.summary,
  correspondenceEvents: crosswalk.correspondenceEvents,
  builds: crosswalk.builds,
  decisions: crosswalk.decisions,
  requirements: crosswalk.requirements,
  rules: crosswalk.rules,
  releases: crosswalk.releases,
  discrepancies: crosswalk.discrepancies,
  gaps: crosswalk.gaps,
  relations
};
const crosswalkFingerprint = sha256(Buffer.from(JSON.stringify(fingerprintPayload)));
check(relationFingerprint === crosswalk.relationFingerprintSha256, 'relation fingerprint mismatch');
check(gapFingerprint === crosswalk.gapFingerprintSha256, 'crosswalk gap fingerprint mismatch');
check(gapFingerprint === gapRegister.gapFingerprintSha256, 'gap register fingerprint mismatch');
check(crosswalkFingerprint === crosswalk.crosswalkFingerprintSha256, 'crosswalk fingerprint mismatch');

for (const path of crosswalk.generatedOutputPaths ?? []) check(await existsFile(path), `generated output missing ${path}`);
check(stableEqual(crosswalk.validationOutputPaths, ['artifacts/validation/29-D2-C-crosswalk.json','artifacts/validation/29-D2-C-validation-evidence.json']), 'validation output path contract mismatch');
const auditText = await readFile('docs/audit/29-D2-C_YAZISMA_BUILD_KARAR_CAPRAZ_ENVANTERI.md', 'utf8');
check(auditText.includes('**25**') && auditText.includes('**228/228**') && auditText.includes('**12**'), 'audit summary totals missing');
check(auditText.includes(TRUTH), 'audit truth sentence missing');

for (const [name, evidence] of [['start wrapper', startWrapperFailure], ['input snapshot first attempt', snapshotFailure]]) {
  check(evidence.release === 'Bronze 04.08.2026.29' && evidence.workStep === '29-D2-C', `${name} failure identity mismatch`);
  check(evidence.status === 'FAIL', `${name} must remain FAIL`);
  check(evidence.countedAsPass === false, `${name} must not count as PASS`);
  check(evidence.mandatoryTruthSentence === TRUTH, `${name} truth sentence mismatch`);
}
check(supersededAttempt.status === 'SUPERSEDED_LOCAL_ATTEMPT', 'superseded local attempt classification mismatch');
check(supersededAttempt.countedAsPass === false, 'superseded local attempt must not count as PASS');
check(supersededAttempt.persistentLibraryReceiptStatus === 'NOT_CREATED', 'superseded local attempt receipt status mismatch');
check(supersededAttempt.supersededPackage?.sha256 === '097c058b8795beded6aae1c6b0ecedf67e2f7c945834001078a9309fa0bc8859', 'superseded package SHA mismatch');
check((supersededAttempt.archivedLocalArtifacts ?? []).length === 12, 'superseded local artifact archive count mismatch');
check(supersededAttempt.mandatoryTruthSentence === TRUTH, 'superseded local attempt truth sentence mismatch');
for (const obsolete of [
  'artifacts/inventory/29-D2-C_CORRESPONDENCE_BUILD_DECISION_CROSSWALK.json',
  'artifacts/inventory/29-D2-C_BUILD_CROSSWALK.csv',
  'artifacts/inventory/29-D2-C_CONVERSATION_CROSSWALK.csv',
  'artifacts/inventory/29-D2-C_DECISION_CROSSWALK.csv',
  'artifacts/inventory/29-D2-C_REQUIREMENT_TRACEABILITY.csv',
  'docs/audit/29-D2-C_YAZISMA_BUILD_KARAR_CAPRAZ_TABLOSU.md'
]) check(!(await existsFile(obsolete)), `obsolete ambiguous output still active ${obsolete}`);

const report = {
  schemaVersion: 1,
  release: crosswalk.release,
  workStep: crosswalk.workStep,
  phase: d2cStep?.status === 'COMPLETED' ? 'FINALIZATION_REVALIDATION' : 'MAIN_CHECKPOINT_VALIDATION',
  checks,
  inputSnapshotCount: manifest.inputCount,
  inputSetFingerprintSha256: manifest.inputSetFingerprintSha256,
  correspondenceEventCount: correspondence.length,
  buildCount: builds.length,
  buildEvidenceReferenceCount: buildEvidenceReferences,
  buildEvidenceFoundCount: buildEvidenceFound,
  buildEvidenceNotFoundCount: buildEvidenceMissing,
  buildEvidenceUniqueNotFoundCount: missingBuildReferences.size,
  decisionUnionCount: decisions.length,
  activeDecisionCount: activeDecisions.length,
  requirementCount: requirements.length,
  ruleCount: rules.length,
  activeRuleCount: rules.filter((entry) => entry.state === 'ACTIVE').length,
  activeRuleEnforcementCount: rules.filter((entry) => entry.state === 'ACTIVE' && entry.enforcementStatus === 'FOUND_EXACT').length,
  relationCount: relations.length,
  gapCount: crosswalk.gaps.length,
  unresolvedGapCount: gapRegister.unresolvedGapCount,
  crosswalkFingerprintSha256: crosswalkFingerprint,
  relationFingerprintSha256: relationFingerprint,
  gapFingerprintSha256: gapFingerprint,
  priorFailedOrSupersededAttemptCount: 3,
  priorFailedOrSupersededAttemptsCountedAsPass: 0,
  status: failures.length ? 'FAIL' : 'PASS',
  failures,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/29-D2-C-crosswalk.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`29-D2-C Crosswalk: PASS (${checks} checks / ${correspondence.length} correspondence / ${builds.length} builds / ${decisions.length} decisions / ${requirements.length} requirements / ${rules.length} rules / ${relations.length} relations / ${crosswalk.gaps.length} explicit gaps).`);
