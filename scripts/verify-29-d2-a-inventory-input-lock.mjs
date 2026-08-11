import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';

const failures = [];
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

const registry = await readJson('artifacts/inventory/29-D2-A_INPUT_REGISTRY.json');
check(registry.release === 'Bronze 04.08.2026.29', 'release mismatch');
check(registry.workStep === '29-D2-A', 'work step mismatch');
check(registry.authorityPolicy?.failed29DAttemptOverlayApplied === false, 'failed 29-D attempt must not be applied');
check(Array.isArray(registry.entries) && registry.entries.length > 0, 'input entries missing');

const ids = new Set();
const availabilityCounts = new Map();
for (const entry of registry.entries ?? []) {
  check(!ids.has(entry.id), `duplicate input id ${entry.id}`); ids.add(entry.id);
  check(['AVAILABLE', 'PARTIAL', 'UNAVAILABLE'].includes(entry.availability), `${entry.id} invalid availability ${entry.availability}`);
  availabilityCounts.set(entry.availability, (availabilityCounts.get(entry.availability) ?? 0) + 1);
  if (entry.availability === 'UNAVAILABLE' || entry.availability === 'PARTIAL') {
    check(Boolean(entry.limitation), `${entry.id} ${entry.availability} limitation missing`);
  }
  if (entry.sourcePath) {
    try {
      const data = await readFile(entry.sourcePath);
      const info = await stat(entry.sourcePath);
      check(info.isFile(), `${entry.id} source is not a file`);
      check(info.size === entry.sizeBytes, `${entry.id} size mismatch`);
      check(sha256(data) === entry.sha256, `${entry.id} SHA-256 mismatch`);
    } catch (error) {
      check(false, `${entry.id} source unavailable: ${error.message}`);
    }
  }
  if (entry.library) {
    check(entry.library.readbackStatus === 'PASS', `${entry.id} Library readback is not PASS`);
    check(/^[0-9a-f]{64}$/.test(entry.library.sha256 ?? ''), `${entry.id} Library SHA invalid`);
    check(Number.isInteger(entry.library.sizeBytes) && entry.library.sizeBytes > 0, `${entry.id} Library size invalid`);
  }
}
for (const [key, value] of Object.entries(registry.summary?.availabilityCounts ?? {})) {
  check((availabilityCounts.get(key) ?? 0) === value, `availability count mismatch for ${key}`);
}
check(registry.summary?.inputCount === registry.entries.length, 'input count mismatch');

const material = registry.entries.map((entry) => [
  entry.id,
  entry.authorityClass,
  entry.availability,
  entry.sourcePath ?? '',
  entry.sha256 ?? '',
  String(entry.sizeBytes ?? ''),
  entry.library?.sha256 ?? ''
].join('|')).join('\n');
check(sha256(Buffer.from(material)) === registry.inputSetFingerprintSha256, 'input set fingerprint mismatch');

const handoff = await readFile('artifacts/inventory/29-D2-A_inputs/NEW_CHAT_HANDOFF_Bronze_04.08.2026.29.md');
const handoffSidecar = (await readFile('artifacts/inventory/29-D2-A_inputs/NEW_CHAT_HANDOFF_Bronze_04.08.2026.29.md.sha256', 'utf8')).trim().split(/\s+/)[0];
check(sha256(handoff) === handoffSidecar, 'handoff sidecar mismatch');

const buildText = await readFile('artifacts/inventory/29-D2-A_inputs/BUILD_001_228_KRONOLOJIK_GECMIS.md', 'utf8');
const buildNumbers = [...buildText.matchAll(/^- \[x\] \*\*Build (\d+)\b/gm)].map((m) => Number(m[1]));
const buildSet = new Set(buildNumbers);
check(buildNumbers.length === 228, `build entry count ${buildNumbers.length}, expected 228`);
check(buildSet.size === 228, `unique build count ${buildSet.size}, expected 228`);
for (let i = 1; i <= 228; i += 1) check(buildSet.has(i), `Build ${i} missing from chronology`);

const chatText = await readFile('artifacts/inventory/29-D2-A_inputs/ERISILEBILEN_SOHBET_KAYITLARI_20.07-03.08.2026.md', 'utf8');
check(chatText.includes('tam sohbet dışa aktarımı değildir'), 'partial conversation disclaimer missing');
const chatEntry = registry.entries.find((entry) => entry.id === 'INP-003');
check(chatEntry?.availability === 'PARTIAL', 'accessible conversation summary must remain PARTIAL');

const v7Text = await readFile('artifacts/inventory/29-D2-A_inputs/PROJECTS_CONTEXT_RULES_V7.md', 'utf8');
check(v7Text.includes('Build228'), 'V7 context does not identify Build228');
const legacyText = await readFile('artifacts/inventory/29-D2-A_inputs/Yapıştırılan metin.txt', 'utf8');
check(legacyText.includes('BUILD214') || legacyText.includes('Build214'), 'historical handoff Build214 marker missing');
check(registry.entries.find((entry) => entry.id === 'INP-006')?.authorityClass === 'HISTORICAL_ONLY', 'historical handoff authority classification invalid');

const activeSet = await readJson('config/active-document-set.json');
const activeEntries = registry.entries.filter((entry) => entry.authorityClass === 'ACTIVE_AUTHORITY');
check(activeEntries.length === activeSet.authorityOrder.length, 'active authority count mismatch');
for (const authorityPath of activeSet.authorityOrder) {
  check(activeEntries.some((entry) => entry.originalPath === authorityPath && entry.availability === 'AVAILABLE'), `active authority missing from registry: ${authorityPath}`);
  try { check((await stat(authorityPath)).isFile(), `active authority is not a file: ${authorityPath}`); }
  catch { check(false, `active authority unavailable: ${authorityPath}`); }
}

const canonical = await readJson('config/canonical-rule-registry.json');
const enforcement = await readJson('config/rule-enforcement-registry.json');
const activeRules = canonical.rules.filter((rule) => rule.state === 'ACTIVE');
const supersededRules = canonical.rules.filter((rule) => rule.state === 'SUPERSEDED');
check(canonical.ruleCount === 208 && canonical.rules.length === 208, 'canonical rule count mismatch');
check(activeRules.length === 194 && canonical.activeRuleCount === 194, 'active rule count mismatch');
check(supersededRules.length === 14 && canonical.supersededRuleCount === 14, 'superseded rule count mismatch');
check(canonical.rulesSha256 === '5e7e45b7c2ae9f3c7465866a58d9d389ef6a793dab855a68a1434e003eade081', 'canonical rule SHA mismatch');
check(enforcement.canonicalRulesSha256 === canonical.rulesSha256, 'enforcement rule SHA mismatch');
check(enforcement.entries.length === 194 && enforcement.activeRuleCount === 194, 'enforcement entry count mismatch');
const enforcementIds = new Set(enforcement.entries.map((entry) => entry.ruleId));
for (const rule of activeRules) check(enforcementIds.has(rule.id), `active rule lacks enforcement: ${rule.id}`);
for (const entry of enforcement.entries) {
  check(entry.failClosed === true, `${entry.ruleId} is not fail-closed`);
  check(entry.waiverAllowed === false, `${entry.ruleId} permits waiver`);
  check(entry.skipAllowed === false, `${entry.ruleId} permits skip`);
}

const scope = await readJson('config/accepted-scope-registry.json');
check(scope.requirementCount === 350 && scope.requirements.length === 350, 'accepted scope count mismatch');
const decisions = await readJson('config/user-decision-ledger.json');
check(decisions.decisionCount === decisions.decisions.length && decisions.decisionCount === 9, 'decision ledger count mismatch');
const baselineArtifactIndex = await readJson('artifacts/inventory/29-D2-A_inputs/index_snapshot/PROJECT_ARTIFACT_INDEX.json');
const baselineDocumentIndex = await readJson('artifacts/inventory/29-D2-A_inputs/index_snapshot/ALL_DOCUMENTS_INDEX.json');
check(baselineArtifactIndex.summary.totalFiles === registry.summary.baselineArtifactIndexFiles, 'baseline artifact snapshot count mismatch');
check(baselineDocumentIndex.documentCount === registry.summary.baselineDocumentIndexDocuments, 'baseline document snapshot count mismatch');
const artifactIndex = await readJson('artifacts/manifests/PROJECT_ARTIFACT_INDEX.json');
const documentIndex = await readJson('artifacts/manifests/ALL_DOCUMENTS_INDEX.json');
check(artifactIndex.summary.totalFiles === artifactIndex.files.length, 'artifact index total mismatch');
check(documentIndex.documentCount === documentIndex.documents.length, 'document index total mismatch');
check(artifactIndex.summary.totalDocuments === documentIndex.documentCount, 'artifact/document index cross-count mismatch');

const mainReceipt = await readJson('artifacts/checkpoints/29-D1_LIBRARY_RECEIPT.json');
const finalReceipt = await readJson('artifacts/checkpoints/29-D1_FINALIZATION_LIBRARY_RECEIPT.json');
check(mainReceipt.status === 'PASS' && mainReceipt.persistentReceiptStatus === 'PASS', '29-D1 main receipt invalid');
check(finalReceipt.status === 'PASS' && finalReceipt.officialStepStatus === 'COMPLETED', '29-D1 finalization receipt invalid');

const preflight = await readJson('artifacts/validation/governed-preflight.json');
check(preflight.status === 'PASS', 'governed preflight is not PASS');
check((preflight.results ?? []).length >= 18, 'governed preflight command count below baseline');
check((preflight.results ?? []).every((result) => result.exitCode === 0), 'governed preflight contains non-zero exit code');

const unavailable = registry.entries.filter((entry) => entry.availability === 'UNAVAILABLE');
check(unavailable.length === 3, `UNAVAILABLE count ${unavailable.length}, expected 3`);
check(unavailable.some((entry) => entry.title.includes('Complete raw conversation export')), 'complete raw conversation export unavailability missing');
check(unavailable.some((entry) => entry.title.includes('Platform actual conversation capacity')), 'conversation capacity unavailability missing');
check(!registry.entries.some((entry) => ['NOT_RUN', 'BLOCKED', 'PENDING', 'DIAGNOSTIC_PASS'].includes(entry.availability)), 'non-availability execution status used as availability');

const report = {
  schemaVersion: 1,
  release: registry.release,
  workStep: registry.workStep,
  checks,
  inputSetFingerprintSha256: registry.inputSetFingerprintSha256,
  inputCount: registry.entries.length,
  availabilityCounts: Object.fromEntries([...availabilityCounts.entries()].sort()),
  buildCoverage: { first: 1, last: 228, entries: buildNumbers.length, unique: buildSet.size },
  activeAuthorityCount: activeSet.authorityOrder.length,
  artifactIndexFiles: artifactIndex.summary.totalFiles,
  documentIndexDocuments: documentIndex.documentCount,
  status: failures.length ? 'FAIL' : 'PASS',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/29-D2-A-input-lock.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`29-D2-A Inventory Input Lock: PASS (${checks} checks / ${registry.entries.length} inputs / Build 1-228 complete).`);
