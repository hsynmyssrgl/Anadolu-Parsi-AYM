import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { exists, readJson } from './lib/governance-utils.mjs';

const failures = [];
let checks = 0;
const check = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};

const policy = await readJson('config/documentation-synchronization-policy.json');
const ledger = await readJson('config/user-decision-ledger.json');
const roadmap = await readJson('config/remaining-scope-package-roadmap.json');
const activeDocuments = await readJson('config/active-document-set.json');
const currentDecisionSummary = await readFile('docs/current/09_KULLANICI_KARARLARI_KAYDI.md', 'utf8');
const currentMasterSource = await readFile('docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md', 'utf8');

const decisionNumber = (id) => Number.parseInt(String(id).slice(4), 10);
const threshold = decisionNumber(policy.effectiveFromDecision);
const governedDecisions = ledger.decisions.filter((item) => decisionNumber(item.id) >= threshold);

check(policy.failClosed === true, 'policy must be fail closed');
check(policy.waiverAllowed === false, 'policy must forbid waiver');
check(ledger.decisionCount === ledger.decisions.length, 'decisionCount mismatch');
check(governedDecisions.length > 0, `no governed decision at or after ${policy.effectiveFromDecision}`);

for (const decision of governedDecisions) {
  for (const field of policy.mandatoryDecisionFields) {
    const value = decision[field];
    check(value !== undefined && value !== null && value !== '', `${decision.id} missing ${field}`);
  }
  check(policy.allowedSyncStatus.includes(decision.syncStatus), `${decision.id} invalid syncStatus ${decision.syncStatus}`);
  check(await exists(decision.document), `${decision.id} decision document missing ${decision.document}`);
  check(Array.isArray(decision.documents) && decision.documents.length > 0, `${decision.id} affected documents missing`);
  for (const path of decision.documents ?? []) check(await exists(path), `${decision.id} affected document missing ${path}`);
  check(currentDecisionSummary.includes(decision.id), `${decision.id} missing from current decision summary`);
  check(currentMasterSource.includes(decision.id), `${decision.id} missing from current master source`);
}

for (const item of roadmap.packages) {
  if (item.status === 'COMPLETED') continue;
  for (const field of policy.openWorkItemRequiredFields) {
    const value = item[field];
    const present = Array.isArray(value) ? true : value !== undefined && value !== null && value !== '';
    check(present, `${item.step} open work item missing ${field}`);
  }
  check(item.countsAsRequirementPass === false, `${item.step} open work item cannot count as requirement PASS`);
  check(String(item.openReason).trim().length >= 20, `${item.step} open reason is not explicit`);
}

for (const required of [
  'config/documentation-synchronization-policy.json',
  'docs/current/09_KULLANICI_KARARLARI_KAYDI.md',
  'docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md',
  'docs/current/12_TUM_BELGE_TURLERI_DENETIMI.md',
]) {
  check(activeDocuments.authorityOrder.includes(required), `active document set missing ${required}`);
}

const report = {
  schemaVersion: 1,
  policy: policy.id,
  release: policy.release,
  governedDecisionCount: governedDecisions.length,
  openWorkItemCount: roadmap.packages.filter((item) => item.status !== 'COMPLETED').length,
  checks,
  status: failures.length ? 'FAIL' : 'PASS',
  failures,
  generatedAt: new Date().toISOString(),
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(policy.evidence, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Documentation synchronization policy: PASS (${checks} checks / ${governedDecisions.length} governed decisions).`);
