import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { csvEscape } from './lib/governance-utils.mjs';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const ROOT = 'artifacts/inventory/29-D2-C_inputs';
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sha256File = async (path) => sha256(await readFile(path));
const unique = (values) => [...new Set(values)];
const normalizePath = (value) => String(value ?? '').trim().replaceAll('\\', '/').replace(/^\.\//, '');

const inputManifestPath = `${ROOT}/29-D2-C_INPUT_SNAPSHOT_MANIFEST.json`;
const inputManifest = await readJson(inputManifestPath);
if (inputManifest.status !== 'LOCKED') throw new Error('29-D2-C input snapshot is not LOCKED');
for (const entry of inputManifest.entries ?? []) {
  const path = `${ROOT}/${entry.path}`;
  const bytes = await readFile(path);
  if (bytes.length !== entry.sizeBytes) throw new Error(`input size mismatch ${entry.path}`);
  if (sha256(bytes) !== entry.sha256) throw new Error(`input SHA mismatch ${entry.path}`);
}

const [d2aInputs, documentInventory, finalReceipt, decisionLedger, scopeRegistry, ruleRegistry, enforcementRegistry, releaseLedger, activeGovernance, startWorkPlan, activeDocumentSet, masterBuildLedger] = await Promise.all([
  readJson(`${ROOT}/prior/29-D2-A_INPUT_REGISTRY.json`),
  readJson(`${ROOT}/prior/29-D2-B_DOCUMENT_INVENTORY.json`),
  readJson(`${ROOT}/prior/29-D2-B_FINALIZATION_LIBRARY_RECEIPT.json`),
  readJson(`${ROOT}/governance/user-decision-ledger.json`),
  readJson(`${ROOT}/governance/accepted-scope-registry.json`),
  readJson(`${ROOT}/governance/canonical-rule-registry.json`),
  readJson(`${ROOT}/governance/rule-enforcement-registry.json`),
  readJson(`${ROOT}/governance/release-ledger.json`),
  readJson(`${ROOT}/governance/active-governance-ledger.json`),
  readJson(`${ROOT}/governance/work-segmentation-plan-at-start.json`),
  readJson(`${ROOT}/governance/active-document-set.json`),
  readJson(`${ROOT}/governance/master-build-ledger.json`)
]);
const currentWorkPlan = await readJson('config/work-segmentation-plan.json');
const currentD2cStep = (currentWorkPlan.steps ?? []).find((step) => step.id === '29-D2-C');
const crosswalkLifecycleStatus = currentD2cStep?.status === 'COMPLETED' && currentD2cStep?.persistentReceiptStatus === 'PASS' && currentD2cStep?.finalizationReceiptStatus === 'PASS'
  ? 'COMPLETED'
  : currentD2cStep?.status === 'IN_PROGRESS' && currentD2cStep?.persistentReceiptStatus === 'PASS' && currentD2cStep?.finalizationReceiptStatus === 'PENDING'
    ? 'IN_PROGRESS_MAIN_RECEIPT_PASS_AWAITING_FINALIZATION_RECEIPT'
    : currentD2cStep?.status === 'IN_PROGRESS' && currentD2cStep?.validationStatus === 'PASS'
      ? 'IN_PROGRESS_LOCAL_VALIDATION_PASS_AWAITING_LIBRARY_RECEIPT'
      : 'IN_PROGRESS_LOCAL_CROSSWALK_CREATED_AWAITING_VALIDATION_AND_LIBRARY_RECEIPT';

const [correspondenceText, chronologyText, handoffText, historicalContextText, historicalHandoffText, masterDecisionRegisterText] = await Promise.all([
  readFile(`${ROOT}/handoff/ERISILEBILEN_SOHBET_KAYITLARI_20.07-03.08.2026.md`, 'utf8'),
  readFile(`${ROOT}/handoff/BUILD_001_228_KRONOLOJIK_GECMIS.md`, 'utf8'),
  readFile(`${ROOT}/handoff/NEW_CHAT_HANDOFF_Bronze_04.08.2026.29.md`, 'utf8'),
  readFile(`${ROOT}/handoff/PROJECTS_CONTEXT_RULES_V7.md`, 'utf8'),
  readFile(`${ROOT}/handoff/Yapıştırılan metin.txt`, 'utf8'),
  readFile(`${ROOT}/decisions/10_MASTER_DECISION_REGISTER.md`, 'utf8')
]);

const documents = documentInventory.documents ?? [];
const documentByPath = new Map(documents.map((document) => [document.path, document]));
const documentsByBasename = new Map();
for (const document of documents) {
  const name = basename(document.path);
  if (!documentsByBasename.has(name)) documentsByBasename.set(name, []);
  documentsByBasename.get(name).push(document);
}
const resolveDocument = (reference) => {
  const normalized = normalizePath(reference);
  const exact = documentByPath.get(normalized);
  if (exact) return { reference, normalizedReference: normalized, status: 'FOUND_EXACT', matchedPaths: [exact.path], documentIds: [exact.id], classifications: [exact.governedClassification] };
  const candidates = documentsByBasename.get(basename(normalized)) ?? [];
  if (candidates.length === 1) return { reference, normalizedReference: normalized, status: 'FOUND_BASENAME_UNIQUE', matchedPaths: [candidates[0].path], documentIds: [candidates[0].id], classifications: [candidates[0].governedClassification] };
  if (candidates.length > 1) return { reference, normalizedReference: normalized, status: 'AMBIGUOUS_BASENAME', matchedPaths: candidates.map((entry) => entry.path), documentIds: candidates.map((entry) => entry.id), classifications: candidates.map((entry) => entry.governedClassification) };
  return { reference, normalizedReference: normalized, status: 'NOT_FOUND', matchedPaths: [], documentIds: [], classifications: [] };
};

let relationCounter = 0;
const relations = [];
const addRelation = (fromType, fromId, relationType, toType, toId, resolutionStatus, sourceMethod, note = '') => {
  relationCounter += 1;
  relations.push({ relationId: `REL-${String(relationCounter).padStart(5, '0')}`, fromType, fromId, relationType, toType, toId, resolutionStatus, sourceMethod, note });
};

// Correspondence events: explicit identifiers only; no semantic inference.
const correspondenceEvents = [];
let currentDate = null;
for (const line of correspondenceText.split(/\r?\n/)) {
  const dateMatch = line.match(/^## (\d{2}\.\d{2}\.\d{4})$/);
  if (dateMatch) { currentDate = dateMatch[1]; continue; }
  const eventMatch = line.match(/^- (?:(\d{2}:\d{2}:\d{2}) - )?(.*)$/);
  if (!eventMatch || !currentDate) continue;
  const description = eventMatch[2];
  const builds = new Set();
  for (const match of description.matchAll(/Build\s*(\d+)\s*[-–]\s*(\d+)/gi)) for (let n = Number(match[1]); n <= Number(match[2]); n += 1) builds.add(n);
  for (const match of description.matchAll(/Build\s*(\d+)\s*\/\s*(\d+)/gi)) { builds.add(Number(match[1])); builds.add(Number(match[2])); }
  for (const match of description.matchAll(/Build\s*(\d+)/gi)) builds.add(Number(match[1]));
  const explicitIdentifiers = unique([...description.matchAll(/\b(?:PR|DEC|OPEN)-\d+\b/g)].map((match) => match[0])).sort();
  const event = {
    id: `CORR-${String(correspondenceEvents.length + 1).padStart(3, '0')}`,
    date: currentDate,
    time: eventMatch[1] ?? null,
    description,
    explicitBuildIds: [...builds].sort((a, b) => a - b).map((number) => `BUILD-${String(number).padStart(3, '0')}`),
    explicitIdentifiers,
    sourceAvailability: 'PARTIAL',
    linkagePolicy: 'EXPLICIT_IDENTIFIER_ONLY_NO_SEMANTIC_INFERENCE'
  };
  correspondenceEvents.push(event);
  for (const buildId of event.explicitBuildIds) addRelation('CORRESPONDENCE_EVENT', event.id, 'EXPLICIT_BUILD_REFERENCE', 'BUILD', buildId, 'RESOLVED_EXPLICIT_ID', 'TEXT_EXACT_IDENTIFIER');
  for (const identifier of event.explicitIdentifiers) addRelation('CORRESPONDENCE_EVENT', event.id, 'EXPLICIT_IDENTIFIER_REFERENCE', identifier.startsWith('OPEN-') ? 'OPEN_ITEM' : identifier.split('-')[0], identifier, 'RECORDED_EXPLICIT_ID', 'TEXT_EXACT_IDENTIFIER');
}

// Chronology markdown and master build ledger cross-check.
const chronologyRegex = /^- \[x\] \*\*Build (\d+) — ([^*]+)\*\* · (.*?) · Durum: `([^`]+)`\s*\n(?:  - Yapılan: (.*?)\n)?(?:  - Kanıt: (.*?)\n)?/gm;
const chronologyByNumber = new Map();
for (const match of chronologyText.matchAll(chronologyRegex)) {
  chronologyByNumber.set(Number(match[1]), {
    build: Number(match[1]),
    version: match[2].trim(),
    stage: match[3].trim(),
    status: match[4].trim(),
    summary: (match[5] ?? '').trim(),
    evidence: [...(match[6] ?? '').matchAll(/`([^`]+)`/g)].map((entry) => entry[1])
  });
}
const builds = [];
const missingBuildEvidenceOccurrences = [];
for (const master of masterBuildLedger.builds ?? []) {
  const chronology = chronologyByNumber.get(master.build);
  const evidenceResolutions = (master.evidence ?? []).map((reference) => {
    const resolution = resolveDocument(reference);
    const buildId = `BUILD-${String(master.build).padStart(3, '0')}`;
    for (const path of resolution.matchedPaths) addRelation('BUILD', buildId, 'EVIDENCE_DOCUMENT', 'DOCUMENT', path, resolution.status, 'MASTER_BUILD_LEDGER_EVIDENCE');
    if (resolution.status === 'NOT_FOUND') {
      missingBuildEvidenceOccurrences.push({ build: master.build, buildId, reference: normalizePath(reference) });
      addRelation('BUILD', buildId, 'EVIDENCE_DOCUMENT', 'DOCUMENT', normalizePath(reference), 'NOT_FOUND', 'MASTER_BUILD_LEDGER_EVIDENCE');
    }
    return resolution;
  });
  const decisionIds = unique((master.evidence ?? []).flatMap((reference) => [...String(reference).matchAll(/DEC-(\d+)/g)].map((entry) => `DEC-${String(Number(entry[1])).padStart(3, '0')}`))).sort();
  for (const decisionId of decisionIds) addRelation('BUILD', `BUILD-${String(master.build).padStart(3, '0')}`, 'EXPLICIT_DECISION_EVIDENCE', 'DECISION', decisionId, 'RESOLVED_EXPLICIT_ID', 'EVIDENCE_PATH_IDENTIFIER');
  const summaryMatch = chronology?.summary === master.summary;
  const allowedContextCleanNormalization = master.build === 208 && !summaryMatch && master.summary.includes('20.07.2026 provenance sınırı') && !chronology.summary.includes('20.07.2026 provenance sınırı');
  builds.push({
    id: `BUILD-${String(master.build).padStart(3, '0')}`,
    build: master.build,
    version: master.version,
    date: master.date,
    channel: master.channel,
    stage: master.stage,
    statusFromHistoricalLedger: master.status,
    historicalClaimBoundary: 'HISTORICAL_RECORD_ONLY_DOES_NOT_CREATE_CURRENT_PASS',
    summary: master.summary,
    chronologyComparison: {
      chronologyPresent: Boolean(chronology),
      versionMatch: chronology?.version === master.version,
      stageMatch: chronology?.stage === master.stage,
      statusMatch: chronology?.status === master.status,
      evidenceMatch: JSON.stringify(chronology?.evidence ?? []) === JSON.stringify(master.evidence ?? []),
      summaryMatch,
      allowedDifference: allowedContextCleanNormalization ? 'BUILD_208_CONTEXT_CLEAN_SOURCE_BOUNDARY_TEXT_REMOVED' : null
    },
    evidenceReferenceCount: evidenceResolutions.length,
    evidenceFoundCount: evidenceResolutions.filter((entry) => entry.status.startsWith('FOUND_')).length,
    evidenceNotFoundCount: evidenceResolutions.filter((entry) => entry.status === 'NOT_FOUND').length,
    evidenceResolutions,
    explicitDecisionIds: decisionIds,
    rulesAcknowledgement: master.rulesAcknowledgement ?? null,
    conversationCapacityAssessment: master.conversationCapacityAssessment ?? null,
    projectProgressAssessment: master.projectProgressAssessment ?? null
  });
}

// Decision union: historical master register, standalone documents and active ledger.
const registerSections = new Map();
const registerHeadingRegex = /^## DEC-(\d+) — (.+)$/gm;
const registerMatches = [...masterDecisionRegisterText.matchAll(registerHeadingRegex)];
for (let index = 0; index < registerMatches.length; index += 1) {
  const match = registerMatches[index];
  const start = match.index + match[0].length;
  const end = index + 1 < registerMatches.length ? registerMatches[index + 1].index : masterDecisionRegisterText.length;
  const id = `DEC-${String(Number(match[1])).padStart(3, '0')}`;
  registerSections.set(id, { title: match[2].trim(), text: masterDecisionRegisterText.slice(start, end).trim() });
}
const decisionFiles = (await readdir(`${ROOT}/decisions`, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^DEC-\d+.*\.md$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort();
const standaloneDecisions = new Map();
for (const name of decisionFiles) {
  const idMatch = name.match(/^DEC-(\d+)/i);
  if (!idMatch) continue;
  const id = `DEC-${String(Number(idMatch[1])).padStart(3, '0')}`;
  const text = await readFile(`${ROOT}/decisions/${name}`, 'utf8');
  const title = text.match(/^# DEC-\d+\s+[—-]\s+(.+)$/m)?.[1]?.trim() ?? null;
  const release = text.match(/Bronze \d{2}\.\d{2}\.\d{4}\.\d+/)?.[0] ?? null;
  standaloneDecisions.set(id, { snapshotPath: `${ROOT}/decisions/${name}`, sourcePath: `docs/decisions/${name}`, title, release, sha256: sha256(Buffer.from(text)), sizeBytes: Buffer.byteLength(text), text });
}
const activeDecisionById = new Map((decisionLedger.decisions ?? []).map((decision) => [decision.id, decision]));
const rulesBySource = new Map();
for (const rule of ruleRegistry.rules ?? []) {
  if (!rulesBySource.has(rule.source)) rulesBySource.set(rule.source, []);
  rulesBySource.get(rule.source).push(rule.id);
}
const decisionIds = unique([...registerSections.keys(), ...standaloneDecisions.keys(), ...activeDecisionById.keys()]).sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));
const decisions = [];
for (const id of decisionIds) {
  const ledger = activeDecisionById.get(id) ?? null;
  const standalone = standaloneDecisions.get(id) ?? null;
  const register = registerSections.get(id) ?? null;
  const explicitRules = unique([...(ledger?.rules ?? []), ...(id === 'DEC-129' ? (rulesBySource.get('USER_DECISION_DEC-129') ?? []) : [])]).sort();
  for (const ruleId of explicitRules) addRelation('DECISION', id, 'EXPLICIT_RULE_LINK', 'RULE', ruleId, 'RESOLVED_EXPLICIT_ID', id === 'DEC-129' ? 'CANONICAL_RULE_SOURCE' : 'USER_DECISION_LEDGER');
  const authorityDocumentRefs = unique([...(ledger?.document ? [ledger.document] : []), ...(ledger?.documents ?? []), ...(ledger?.evidence ?? [])]);
  if (standalone && !authorityDocumentRefs.includes(standalone.sourcePath)) authorityDocumentRefs.unshift(standalone.sourcePath);
  const documentResolutions = authorityDocumentRefs.map((reference) => {
    const resolution = resolveDocument(reference);
    for (const path of resolution.matchedPaths) addRelation('DECISION', id, 'DOCUMENT_OR_EVIDENCE_REFERENCE', 'DOCUMENT', path, resolution.status, 'DECISION_LEDGER_OR_STANDALONE');
    if (resolution.status === 'NOT_FOUND') addRelation('DECISION', id, 'DOCUMENT_OR_EVIDENCE_REFERENCE', 'DOCUMENT', normalizePath(reference), 'NOT_FOUND', 'DECISION_LEDGER_OR_STANDALONE');
    return resolution;
  });
  const codeAreaChecks = [];
  for (const path of ledger?.codeAreas ?? []) {
    let exists = false;
    try { exists = (await stat(path)).isFile(); } catch { exists = false; }
    codeAreaChecks.push({ path, status: exists ? 'LIVE_FILE_FOUND_OUTSIDE_DOCUMENT_INVENTORY' : 'NOT_FOUND' });
    addRelation('DECISION', id, 'CODE_AREA_REFERENCE', 'SOURCE_OR_CONFIG', path, exists ? 'LIVE_FILE_FOUND_OUTSIDE_DOCUMENT_INVENTORY' : 'NOT_FOUND', 'USER_DECISION_LEDGER');
  }
  const sourceUsesCurrentConversation = /current user conversation|explicit user instruction in current conversation/i.test(ledger?.source ?? standalone?.text ?? '');
  decisions.push({
    id,
    title: ledger?.title ?? standalone?.title ?? register?.title ?? null,
    activeLedgerPresence: Boolean(ledger),
    activeStatus: ledger?.status ?? null,
    masterRegisterPresence: Boolean(register),
    standaloneDocumentPresence: Boolean(standalone),
    standaloneDocumentPath: standalone?.sourcePath ?? null,
    standaloneDocumentSha256: standalone?.sha256 ?? null,
    visibleRelease: standalone?.release ?? null,
    explicitRuleIds: explicitRules,
    documentResolutions,
    codeAreaChecks,
    rawConversationSourceAvailability: sourceUsesCurrentConversation ? 'UNAVAILABLE_RAW_TRANSCRIPT_AUTHORITY_PRESERVED_BY_LEDGER_AND_DECISION_DOCUMENT' : 'NOT_REQUIRED_OR_NOT_DECLARED',
    authorityClass: ledger ? 'ACTIVE_DECISION_LEDGER' : standalone ? 'HISTORICAL_STANDALONE_DECISION' : 'HISTORICAL_MASTER_REGISTER_ONLY'
  });
}

// Accepted-scope requirements and evidence links.
const requirementEvidenceMissing = [];
const requirements = (scopeRegistry.requirements ?? []).map((requirement) => {
  const evidenceResolutions = (requirement.evidence ?? []).map((reference) => {
    const resolution = resolveDocument(reference);
    for (const path of resolution.matchedPaths) addRelation('REQUIREMENT', requirement.id, 'EVIDENCE_DOCUMENT', 'DOCUMENT', path, resolution.status, 'ACCEPTED_SCOPE_REGISTRY');
    if (resolution.status === 'NOT_FOUND') {
      requirementEvidenceMissing.push({ requirementId: requirement.id, reference: normalizePath(reference) });
      addRelation('REQUIREMENT', requirement.id, 'EVIDENCE_DOCUMENT', 'DOCUMENT', normalizePath(reference), 'NOT_FOUND', 'ACCEPTED_SCOPE_REGISTRY');
    }
    return resolution;
  });
  return {
    id: requirement.id,
    source: requirement.source,
    area: requirement.area,
    title: requirement.title,
    priority: requirement.priority,
    status: requirement.status,
    classification: requirement.classification ?? null,
    decisionChainDeclared: requirement.chain?.decision === true,
    explicitDecisionIds: [],
    decisionLinkStatus: requirement.chain?.decision === true ? 'BOOLEAN_DECLARED_NO_EXPLICIT_DECISION_ID' : 'NOT_DECLARED',
    chain: requirement.chain,
    evidenceReferenceCount: evidenceResolutions.length,
    evidenceFoundCount: evidenceResolutions.filter((entry) => entry.status.startsWith('FOUND_')).length,
    evidenceNotFoundCount: evidenceResolutions.filter((entry) => entry.status === 'NOT_FOUND').length,
    evidenceResolutions
  };
});

// Rule, decision and enforcement crosswalk.
const enforcementByRule = new Map((enforcementRegistry.entries ?? []).map((entry) => [entry.ruleId, entry]));
const explicitDecisionByRule = new Map();
for (const decision of decisions) for (const ruleId of decision.explicitRuleIds) {
  if (!explicitDecisionByRule.has(ruleId)) explicitDecisionByRule.set(ruleId, []);
  explicitDecisionByRule.get(ruleId).push(decision.id);
}
const rules = (ruleRegistry.rules ?? []).map((rule) => {
  const enforcement = enforcementByRule.get(rule.id) ?? null;
  const explicitDecisionIdsForRule = unique(explicitDecisionByRule.get(rule.id) ?? []).sort();
  if (enforcement) addRelation('RULE', rule.id, 'ENFORCEMENT_ENTRY', 'ENFORCEMENT', rule.id, 'FOUND_EXACT', 'RULE_ENFORCEMENT_REGISTRY');
  return {
    id: rule.id,
    state: rule.state,
    text: rule.text,
    source: rule.source,
    sourceSha256: rule.sourceSha256 ?? null,
    effectiveRelease: rule.effectiveRelease ?? null,
    replacedBy: rule.replacedBy ?? null,
    explicitDecisionIds: explicitDecisionIdsForRule,
    specificDecisionLinkStatus: explicitDecisionIdsForRule.length > 0 ? 'EXPLICIT' : rule.source === 'USER_DECISIONS_2026-08-04' ? 'MISSING_SPECIFIC_DECISION_ID' : 'SOURCE_LINEAGE_ONLY',
    enforcementStatus: enforcement ? 'FOUND_EXACT' : rule.state === 'SUPERSEDED' ? 'NOT_REQUIRED_SUPERSEDED' : 'MISSING',
    enforcement: enforcement
  };
});

// Release records and authority discrepancies.
const releaseFiles = (await readdir(`${ROOT}/release`, { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
const releases = (releaseLedger.entries ?? []).map((entry) => {
  const visible = `Bronze ${entry.version}`;
  const documentsForRelease = releaseFiles.filter((name) => name.includes(entry.version)).map((name) => `release/${name}`);
  let handoffStatus = null;
  if (entry.monthlySequence === 28 && handoffText.includes('COMPLETED / SOURCE CLOSURE PASS')) handoffStatus = 'COMPLETED_SOURCE_CLOSURE_PASS';
  if (entry.monthlySequence === 29 && handoffText.includes('IN_PROGRESS / TAM BUILD KAPANIŞI YOK')) handoffStatus = 'IN_PROGRESS_NO_FULL_BUILD_CLOSURE';
  const decisionIdsForRelease = decisions.filter((decision) => decision.visibleRelease === visible).map((decision) => decision.id);
  for (const decisionId of decisionIdsForRelease) addRelation('RELEASE', visible, 'DECISION_RELEASE', 'DECISION', decisionId, 'RESOLVED_EXPLICIT_RELEASE', 'DECISION_DOCUMENT_RELEASE_FIELD');
  return {
    visibleRelease: visible,
    releaseId: entry.releaseId,
    ledgerStatus: entry.status,
    handoffStatus,
    statusComparison: entry.monthlySequence === 28 ? (entry.status === 'IN_PROGRESS' && handoffStatus === 'COMPLETED_SOURCE_CLOSURE_PASS' ? 'CONTRADICTION_STALE_LEDGER' : 'MATCH_OR_NOT_APPLICABLE') : entry.monthlySequence === 29 ? (entry.status === 'IN_PROGRESS' ? 'MATCH' : 'CONTRADICTION') : 'HISTORICAL_NO_HANDOFF_STATUS_ASSERTION',
    documents: documentsForRelease,
    decisionIds: decisionIdsForRelease
  };
});

const inputUnavailable = (d2aInputs.entries ?? []).filter((entry) => entry.availability !== 'AVAILABLE');
const buildMissingUnique = [...new Map(missingBuildEvidenceOccurrences.map((entry) => [entry.reference, entry])).keys()].sort();
const buildMissingByReference = buildMissingUnique.map((reference) => ({ reference, affectedBuildIds: unique(missingBuildEvidenceOccurrences.filter((entry) => entry.reference === reference).map((entry) => entry.buildId)).sort() }));
const requirementMissingUnique = unique(requirementEvidenceMissing.map((entry) => entry.reference)).sort();
const userDecisionRulesWithoutSpecificDecision = rules.filter((rule) => rule.state === 'ACTIVE' && rule.source === 'USER_DECISIONS_2026-08-04' && rule.explicitDecisionIds.length === 0).map((rule) => rule.id);
const requirementsWithDecisionBooleanNoId = requirements.filter((requirement) => requirement.decisionChainDeclared && requirement.explicitDecisionIds.length === 0).map((requirement) => requirement.id);
const currentConversationDecisions = decisions.filter((decision) => decision.activeLedgerPresence && decision.rawConversationSourceAvailability.startsWith('UNAVAILABLE')).map((decision) => decision.id);
const projectRulesV6Rules = rules.filter((rule) => rule.source === 'PROJECT-RULES-2026-08-02-V6').map((rule) => rule.id);

const gaps = [
  {
    id: 'D2C-GAP-001', category: 'CORRESPONDENCE', severity: 'BLOCKING_FOR_FULL_HISTORICAL_AUDIT', status: 'UNAVAILABLE', affectedCount: 1,
    source: 'INP-034', detail: 'Complete raw conversation export from 20.07.2026 through the current session is unavailable; only a verified partial summary exists.', nextAction: 'Keep UNAVAILABLE unless an immutable platform export is supplied.'
  },
  {
    id: 'D2C-GAP-002', category: 'CORRESPONDENCE', severity: 'BLOCKING_FOR_FULL_HISTORICAL_AUDIT', status: 'UNAVAILABLE', affectedCount: 1,
    source: 'INP-036', detail: 'Current-session raw transcript artifact is not exported as an immutable file.', nextAction: 'Do not invent missing transcript content.'
  },
  {
    id: 'D2C-GAP-003', category: 'PLATFORM_TELEMETRY', severity: 'TRUTH_GATE', status: 'UNAVAILABLE', affectedCount: 1,
    source: 'INP-035', detail: 'Previous-chat platform actual conversation capacity is unavailable; stale 9.4 percent records cannot be reused.', nextAction: 'Report UNAVAILABLE.'
  },
  {
    id: 'D2C-GAP-004', category: 'BUILD_EVIDENCE', severity: 'HISTORICAL_EVIDENCE_GAP', status: buildMissingUnique.length ? 'NOT_FOUND' : 'NONE', affectedCount: missingBuildEvidenceOccurrences.length,
    source: 'Build 001-228 evidence references vs D2-B document inventory', detail: `${missingBuildEvidenceOccurrences.length} evidence occurrences across ${buildMissingUnique.length} unique paths are absent from the frozen D2-B document inventory.`, nextAction: 'Preserve the references as historical claims; do not count missing evidence as PASS.', uniqueReferences: buildMissingByReference
  },
  {
    id: 'D2C-GAP-005', category: 'REQUIREMENT_EVIDENCE', severity: 'EVIDENCE_LINK_GAP', status: requirementEvidenceMissing.length ? 'NOT_FOUND' : 'NONE', affectedCount: requirementEvidenceMissing.length,
    source: 'Accepted-scope evidence references vs D2-B document inventory', detail: `${requirementEvidenceMissing.length} requirement evidence occurrences are absent from the frozen document inventory.`, nextAction: 'Resolve or replace the missing evidence reference before claiming the affected chain complete.', occurrences: requirementEvidenceMissing
  },
  {
    id: 'D2C-GAP-006', category: 'REQUIREMENT_DECISION_LINK', severity: 'REQUIRES_D3_REVIEW', status: 'MISSING_EXPLICIT_IDENTIFIER', affectedCount: requirementsWithDecisionBooleanNoId.length,
    source: 'accepted-scope-registry chain.decision', detail: `${requirementsWithDecisionBooleanNoId.length} requirements declare a decision-chain boolean but provide no explicit DEC identifier.`, nextAction: 'D3 must map or explicitly leave the decision link unavailable; no semantic inference here.', affectedRequirementIds: requirementsWithDecisionBooleanNoId
  },
  {
    id: 'D2C-GAP-007', category: 'RULE_DECISION_LINK', severity: 'REQUIRES_D3_REVIEW', status: 'MISSING_EXPLICIT_IDENTIFIER', affectedCount: userDecisionRulesWithoutSpecificDecision.length,
    source: 'canonical rules with USER_DECISIONS_2026-08-04 source', detail: `${userDecisionRulesWithoutSpecificDecision.length} active rules cite the collective user-decision source but are not linked to a specific DEC entry.`, nextAction: 'D3 must create or map explicit decision lineage without changing historical files.', affectedRuleIds: userDecisionRulesWithoutSpecificDecision
  },
  {
    id: 'D2C-GAP-008', category: 'RULE_SOURCE_PROVENANCE', severity: 'PROVENANCE_GAP', status: 'NOT_FOUND_AS_STANDALONE_INPUT', affectedCount: projectRulesV6Rules.length,
    source: 'PROJECT-RULES-2026-08-02-V6', detail: `${projectRulesV6Rules.length} rules retain source SHA metadata, but the standalone V6 source document is not present in the frozen D2-C input set.`, nextAction: 'Use the canonical registry as active authority; preserve the provenance gap for D3.', affectedRuleIds: projectRulesV6Rules
  },
  {
    id: 'D2C-GAP-009', category: 'RELEASE_LEDGER', severity: 'ACTIVE_AUTHORITY_STALENESS', status: 'CONTRADICTION', affectedCount: 1,
    source: 'release-ledger vs new-chat handoff', detail: 'Bronze 04.08.2026.28 is IN_PROGRESS in the frozen release ledger but COMPLETED / SOURCE CLOSURE PASS in the current recovery authority.', nextAction: 'D3 must record an explicit supersession/update; do not silently reinterpret the ledger.'
  },
  {
    id: 'D2C-GAP-010', category: 'ACTIVE_GOVERNANCE_LEDGER', severity: 'ACTIVE_AUTHORITY_STALENESS', status: 'STALE', affectedCount: 1,
    source: 'active-governance-ledger.nextOfficialTask', detail: `Frozen nextOfficialTask is "${activeGovernance.nextOfficialTask}" while the governed work plan current step is 29-D2-C.`, nextAction: 'Update through governed supersession/closure, not by historical rewrite.'
  },
  {
    id: 'D2C-GAP-011', category: 'ACTIVE_GOVERNANCE_LEDGER', severity: 'TRUTH_GATE', status: 'STALE_TELEMETRY', affectedCount: 1,
    source: 'active-governance-ledger.conversationCapacity', detail: `Frozen governance ledger records ${activeGovernance.conversationCapacity?.actualUsedPercent ?? 'UNKNOWN'} percent, while the authoritative handoff declares previous-chat capacity UNAVAILABLE.`, nextAction: 'Report UNAVAILABLE and supersede stale telemetry explicitly.'
  },
  {
    id: 'D2C-GAP-012', category: 'DECISION_SOURCE', severity: 'HISTORICAL_SOURCE_GAP', status: 'UNAVAILABLE_RAW_TRANSCRIPT', affectedCount: currentConversationDecisions.length,
    source: 'active decisions sourced from current user conversation', detail: `${currentConversationDecisions.length} active decisions have ledger/document authority, but their raw conversation source artifact is unavailable.`, nextAction: 'Retain decision authority and mark raw source UNAVAILABLE.', affectedDecisionIds: currentConversationDecisions
  }
];

const discrepancies = [
  {
    id: 'D2C-DISC-001', category: 'BUILD_CROSSCHECK', status: 'ALLOWED_NORMALIZATION', affectedIds: ['BUILD-208'],
    detail: 'Build 208 chronology intentionally omits a source-boundary phrase that the master build ledger retains; version, stage, status and evidence match.'
  },
  {
    id: 'D2C-DISC-002', category: 'HISTORICAL_PROGRESS_ESTIMATE', status: 'SUPERSEDED_BY_ACTIVE_SCOPE', affectedIds: ['BUILD-228'],
    detail: `Build 228 historical coding estimate ${masterBuildLedger.builds.at(-1)?.projectProgressAssessment?.codingCompletionPercent ?? 'UNKNOWN'} percent cannot override the active governed Bronze value 25.0 percent.`
  },
  {
    id: 'D2C-DISC-003', category: 'HISTORICAL_CONTEXT', status: 'HISTORICAL_ONLY_NO_OVERRIDE', affectedIds: ['PROJECTS_CONTEXT_RULES_V7', 'Yapıştırılan metin.txt'],
    detail: 'Historical context and handoff snapshots are preserved but cannot override the current recovery authority, canonical registries or work plan.'
  },
  {
    id: 'D2C-DISC-004', category: 'DECISION_DOCUMENTATION', status: 'REGISTER_ONLY', affectedIds: decisions.filter((decision) => decision.masterRegisterPresence && !decision.standaloneDocumentPresence).map((decision) => decision.id),
    detail: 'Some historical decisions are represented only in the master decision register; this is recorded without inventing standalone files.'
  }
];

const countBy = (values) => Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length]));
const buildEvidenceReferenceCount = builds.reduce((sum, build) => sum + build.evidenceReferenceCount, 0);
const buildEvidenceFoundCount = builds.reduce((sum, build) => sum + build.evidenceFoundCount, 0);
const requirementEvidenceReferenceCount = requirements.reduce((sum, requirement) => sum + requirement.evidenceReferenceCount, 0);
const requirementEvidenceFoundCount = requirements.reduce((sum, requirement) => sum + requirement.evidenceFoundCount, 0);
const activeDecisions = decisions.filter((decision) => decision.activeLedgerPresence);
const decisionReleaseCounts = countBy(activeDecisions.map((decision) => decision.visibleRelease ?? 'UNSPECIFIED'));
const summary = {
  inputSnapshotCount: inputManifest.inputCount,
  inputSnapshotFingerprintSha256: inputManifest.inputSetFingerprintSha256,
  correspondenceEventCount: correspondenceEvents.length,
  correspondenceSourceAvailability: 'PARTIAL',
  buildCount: builds.length,
  buildSequenceComplete: builds.map((build) => build.build).join(',') === Array.from({ length: 228 }, (_, index) => index + 1).join(','),
  buildCoreFieldExactMatchCount: builds.filter((build) => build.chronologyComparison.versionMatch && build.chronologyComparison.stageMatch && build.chronologyComparison.statusMatch && build.chronologyComparison.evidenceMatch).length,
  buildSummaryExactMatchCount: builds.filter((build) => build.chronologyComparison.summaryMatch).length,
  buildAllowedSummaryNormalizationCount: builds.filter((build) => Boolean(build.chronologyComparison.allowedDifference)).length,
  buildEvidenceReferenceCount,
  buildEvidenceFoundCount,
  buildEvidenceNotFoundCount: buildEvidenceReferenceCount - buildEvidenceFoundCount,
  buildEvidenceUniqueNotFoundCount: buildMissingUnique.length,
  decisionUnionCount: decisions.length,
  activeDecisionCount: activeDecisions.length,
  activeDecisionDocumentResolvedCount: activeDecisions.filter((decision) => decision.standaloneDocumentPresence && decision.documentResolutions.some((resolution) => resolution.normalizedReference === decision.standaloneDocumentPath && resolution.status.startsWith('FOUND_'))).length,
  decisionReleaseCounts,
  registerOnlyDecisionCount: decisions.filter((decision) => decision.masterRegisterPresence && !decision.standaloneDocumentPresence).length,
  requirementCount: requirements.length,
  requirementStatusCounts: countBy(requirements.map((requirement) => requirement.status)),
  requirementEvidenceReferenceCount,
  requirementEvidenceFoundCount,
  requirementEvidenceNotFoundCount: requirementEvidenceReferenceCount - requirementEvidenceFoundCount,
  requirementDecisionBooleanNoExplicitIdCount: requirementsWithDecisionBooleanNoId.length,
  ruleCount: rules.length,
  activeRuleCount: rules.filter((rule) => rule.state === 'ACTIVE').length,
  supersededRuleCount: rules.filter((rule) => rule.state === 'SUPERSEDED').length,
  enforcementEntryCount: enforcementRegistry.entries.length,
  activeRuleEnforcementFoundCount: rules.filter((rule) => rule.state === 'ACTIVE' && rule.enforcementStatus === 'FOUND_EXACT').length,
  explicitDecisionLinkedRuleCount: rules.filter((rule) => rule.explicitDecisionIds.length > 0).length,
  activeUserDecisionRuleMissingSpecificDecisionCount: userDecisionRulesWithoutSpecificDecision.length,
  documentInventoryCount: documents.length,
  activeAuthorityDocumentCount: documents.filter((document) => document.governedClassification === 'ACTIVE_AUTHORITY').length,
  releaseRecordCount: releases.length,
  unresolvedGapCount: gaps.filter((gap) => !['NONE', 'RESOLVED'].includes(gap.status)).length,
  relationCount: relations.length,
  unavailableOrPartialInputCount: inputUnavailable.length
};

const fingerprintPayload = { summary, correspondenceEvents, builds, decisions, requirements, rules, releases, discrepancies, gaps, relations };
const crosswalkFingerprintSha256 = sha256(Buffer.from(JSON.stringify(fingerprintPayload)));
const relationFingerprintSha256 = sha256(Buffer.from(JSON.stringify(relations)));
const gapFingerprintSha256 = sha256(Buffer.from(JSON.stringify(gaps)));

const sourceBindings = {
  inputSnapshotManifest: { path: inputManifestPath, sha256: await sha256File(inputManifestPath), inputCount: inputManifest.inputCount, inputSetFingerprintSha256: inputManifest.inputSetFingerprintSha256 },
  d2aInputRegistry: { path: `${ROOT}/prior/29-D2-A_INPUT_REGISTRY.json`, sha256: await sha256File(`${ROOT}/prior/29-D2-A_INPUT_REGISTRY.json`), inputSetFingerprintSha256: d2aInputs.inputSetFingerprintSha256 },
  d2bDocumentInventory: { path: `${ROOT}/prior/29-D2-B_DOCUMENT_INVENTORY.json`, sha256: await sha256File(`${ROOT}/prior/29-D2-B_DOCUMENT_INVENTORY.json`), inventoryFingerprintSha256: documentInventory.inventoryFingerprintSha256, documentCount: documents.length },
  d2bFinalizationReceipt: { path: `${ROOT}/prior/29-D2-B_FINALIZATION_LIBRARY_RECEIPT.json`, sha256: await sha256File(`${ROOT}/prior/29-D2-B_FINALIZATION_LIBRARY_RECEIPT.json`), status: finalReceipt.status, officialStepStatus: finalReceipt.officialStepStatus },
  correspondence: { path: `${ROOT}/handoff/ERISILEBILEN_SOHBET_KAYITLARI_20.07-03.08.2026.md`, sha256: await sha256File(`${ROOT}/handoff/ERISILEBILEN_SOHBET_KAYITLARI_20.07-03.08.2026.md`), availability: 'PARTIAL' },
  buildChronology: { path: `${ROOT}/handoff/BUILD_001_228_KRONOLOJIK_GECMIS.md`, sha256: await sha256File(`${ROOT}/handoff/BUILD_001_228_KRONOLOJIK_GECMIS.md`), parsedBuildCount: chronologyByNumber.size },
  masterBuildLedger: { path: `${ROOT}/governance/master-build-ledger.json`, sha256: await sha256File(`${ROOT}/governance/master-build-ledger.json`), buildCount: masterBuildLedger.builds.length },
  decisionLedger: { path: `${ROOT}/governance/user-decision-ledger.json`, sha256: await sha256File(`${ROOT}/governance/user-decision-ledger.json`), decisionCount: decisionLedger.decisions.length },
  acceptedScope: { path: `${ROOT}/governance/accepted-scope-registry.json`, sha256: await sha256File(`${ROOT}/governance/accepted-scope-registry.json`), requirementCount: scopeRegistry.requirements.length },
  canonicalRules: { path: `${ROOT}/governance/canonical-rule-registry.json`, sha256: await sha256File(`${ROOT}/governance/canonical-rule-registry.json`), ruleCount: ruleRegistry.rules.length, rulesSha256: ruleRegistry.rulesSha256 },
  ruleEnforcement: { path: `${ROOT}/governance/rule-enforcement-registry.json`, sha256: await sha256File(`${ROOT}/governance/rule-enforcement-registry.json`), entryCount: enforcementRegistry.entries.length },
  releaseLedger: { path: `${ROOT}/governance/release-ledger.json`, sha256: await sha256File(`${ROOT}/governance/release-ledger.json`), releaseCount: releaseLedger.entries.length },
  activeGovernanceLedger: { path: `${ROOT}/governance/active-governance-ledger.json`, sha256: await sha256File(`${ROOT}/governance/active-governance-ledger.json`) },
  workPlanAtStart: { path: `${ROOT}/governance/work-segmentation-plan-at-start.json`, sha256: await sha256File(`${ROOT}/governance/work-segmentation-plan-at-start.json`), currentStep: startWorkPlan.currentStep },
  activeDocumentSet: { path: `${ROOT}/governance/active-document-set.json`, sha256: await sha256File(`${ROOT}/governance/active-document-set.json`), authorityCount: activeDocumentSet.authorityOrder.length },
  currentRecoveryAuthority: { path: `${ROOT}/handoff/NEW_CHAT_HANDOFF_Bronze_04.08.2026.29.md`, sha256: await sha256File(`${ROOT}/handoff/NEW_CHAT_HANDOFF_Bronze_04.08.2026.29.md`) },
  historicalContext: { path: `${ROOT}/handoff/PROJECTS_CONTEXT_RULES_V7.md`, sha256: sha256(Buffer.from(historicalContextText)), authority: 'HISTORICAL_ONLY' },
  historicalHandoff: { path: `${ROOT}/handoff/Yapıştırılan metin.txt`, sha256: sha256(Buffer.from(historicalHandoffText)), authority: 'HISTORICAL_ONLY' }
};

const generatedOutputPaths = [
  'artifacts/inventory/29-D2-C_CROSSWALK.json',
  'artifacts/inventory/29-D2-C_CROSSWALK_RELATIONS.csv',
  'artifacts/inventory/29-D2-C_GAP_REGISTER.json',
  'artifacts/inventory/29-D2-C_GAP_REGISTER.csv',
  'docs/audit/29-D2-C_YAZISMA_BUILD_KARAR_CAPRAZ_ENVANTERI.md',
  'scripts/generate-29-d2-c-crosswalk.mjs',
  'scripts/verify-29-d2-c-crosswalk.mjs',
  'scripts/run-29-d2-c-validation.mjs'
];
const validationOutputPaths = [
  'artifacts/validation/29-D2-C-crosswalk.json',
  'artifacts/validation/29-D2-C-validation-evidence.json'
];

const crosswalk = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  workStep: '29-D2-C',
  parentStep: '29-D2',
  title: 'Correspondence, build, decision, requirement, rule and document crosswalk with explicit gaps',
  status: crosswalkLifecycleStatus,
  authorityPolicy: {
    currentRecoveryAuthorityOverridesHistoricalContext: true,
    activeRegistriesOverrideHistoricalDocuments: true,
    historicalBuildStatusDoesNotCreateCurrentPass: true,
    semanticLinksInferred: false,
    unavailableContentInvented: false,
    missingEvidenceCountedAsPass: false
  },
  sourceBindings,
  summary,
  crosswalkFingerprintSha256,
  relationFingerprintSha256,
  gapFingerprintSha256,
  correspondenceEvents,
  builds,
  decisions,
  requirements,
  rules,
  releases,
  activeGovernanceComparison: {
    frozenNextOfficialTask: activeGovernance.nextOfficialTask,
    governedCurrentStep: currentWorkPlan.currentStep,
    nextTaskStatus: activeGovernance.nextOfficialTask === '29-D2-C' ? 'MATCH' : 'STALE',
    frozenConversationCapacity: activeGovernance.conversationCapacity,
    authoritativePreviousChatCapacity: 'UNAVAILABLE',
    capacityStatus: 'STALE_TELEMETRY_MUST_NOT_OVERRIDE_HANDOFF'
  },
  discrepancies,
  gaps,
  generatedOutputPaths,
  validationOutputPaths,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};

const gapRegister = {
  schemaVersion: 1,
  release: crosswalk.release,
  workStep: crosswalk.workStep,
  title: '29-D2-C explicit gap register',
  status: 'OPEN_GAPS_RECORDED_NOT_PASS',
  gapCount: gaps.length,
  unresolvedGapCount: summary.unresolvedGapCount,
  gapFingerprintSha256,
  gaps,
  generatedAt: crosswalk.generatedAt,
  mandatoryTruthSentence: TRUTH
};

await mkdir('artifacts/inventory', { recursive: true });
await mkdir('docs/audit', { recursive: true });
await writeFile('artifacts/inventory/29-D2-C_CROSSWALK.json', `${JSON.stringify(crosswalk, null, 2)}\n`);
const relationFields = ['relationId','fromType','fromId','relationType','toType','toId','resolutionStatus','sourceMethod','note'];
await writeFile('artifacts/inventory/29-D2-C_CROSSWALK_RELATIONS.csv', `${relationFields.join(',')}\n${relations.map((relation) => relationFields.map((field) => csvEscape(relation[field])).join(',')).join('\n')}\n`);
await writeFile('artifacts/inventory/29-D2-C_GAP_REGISTER.json', `${JSON.stringify(gapRegister, null, 2)}\n`);
const gapFields = ['id','category','severity','status','affectedCount','source','detail','nextAction'];
await writeFile('artifacts/inventory/29-D2-C_GAP_REGISTER.csv', `${gapFields.join(',')}\n${gaps.map((gap) => gapFields.map((field) => csvEscape(gap[field])).join(',')).join('\n')}\n`);
const md = [
  '# 29-D2-C — Yazışma, Build ve Karar Çapraz Envanteri',
  '',
  `- Erişilebilen yazışma olayı: **${summary.correspondenceEventCount}** — kaynak PARTIAL`,
  `- Build kronolojisi: **${summary.buildCount}/228** — sıra tam`,
  `- Build kanıt referansı: **${summary.buildEvidenceReferenceCount}**; bulunan **${summary.buildEvidenceFoundCount}**; bulunamayan **${summary.buildEvidenceNotFoundCount}**`,
  `- Karar birleşimi: **${summary.decisionUnionCount}**; aktif karar **${summary.activeDecisionCount}**; aktif karar belgesi bulunan **${summary.activeDecisionDocumentResolvedCount}**`,
  `- Gereksinim: **${summary.requirementCount}**; kanıt referansı **${summary.requirementEvidenceReferenceCount}**; bulunamayan **${summary.requirementEvidenceNotFoundCount}**`,
  `- Kural: **${summary.ruleCount}**; ACTIVE **${summary.activeRuleCount}**; SUPERSEDED **${summary.supersededRuleCount}**; enforcement **${summary.activeRuleEnforcementFoundCount}/${summary.activeRuleCount}**`,
  `- D2-B belge envanteri: **${summary.documentInventoryCount}**`,
  `- Açık ve açıkça sınıflandırılmış boşluk: **${summary.unresolvedGapCount}**`,
  `- Çapraz envanter fingerprint SHA-256: \`${crosswalkFingerprintSha256}\``,
  '',
  'Bu adım semantik bağ uydurmaz; yalnız yapılandırılmış alanları, açık kimlikleri ve dosya referanslarını eşler. Eksik kaynaklar UNAVAILABLE veya NOT_FOUND kalır.',
  '',
  TRUTH,
  ''
].join('\n');
await writeFile('docs/audit/29-D2-C_YAZISMA_BUILD_KARAR_CAPRAZ_ENVANTERI.md', md);
console.log(`29-D2-C crosswalk generated: ${summary.correspondenceEventCount} correspondence events / ${summary.buildCount} builds / ${summary.activeDecisionCount} active decisions / ${summary.requirementCount} requirements / ${summary.ruleCount} rules / ${summary.unresolvedGapCount} explicit gaps.`);
