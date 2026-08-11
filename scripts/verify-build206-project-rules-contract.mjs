import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { calculateRuleSetHash, getRuleSetForBuild } from './lib/master-build-ledger.mjs';

const reportPath = process.argv[2] ?? 'artifacts/validation/build206-project-rules-contract.json';
const failures = [];
let checks = 0;
const verify = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const exists = async (path) => { try { await stat(path); return true; } catch { return false; } };
const read = (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await read(path));

for (const path of [
  'config/master-build-ledger.json',
  'config/master-build-ledger-policy.json',
  'docs/17_MASTER_BUILD_LEDGER.md',
  'scripts/lib/master-build-ledger.mjs',
  'scripts/update-master-build-ledger.mjs',
  'scripts/set-workspace-version.mjs',
  'scripts/verify-master-build-ledger.mjs'
]) verify(await exists(path), `required file missing=${path}`);

const ledger = await readJson('config/master-build-ledger.json');
const policy = await readJson('config/master-build-ledger-policy.json');
const rules = getRuleSetForBuild(ledger, 206);
verify(ledger.currentBuild === 206, `currentBuild=${ledger.currentBuild}`);
verify(ledger.currentVersion === '01.08.2026.206', `currentVersion=${ledger.currentVersion}`);
verify(ledger.builds.length === 206, `build count=${ledger.builds.length}`);
verify(ledger.builds.every((entry, index) => entry.build === index + 1), 'build sequence is not continuous 1..206');
verify(Boolean(rules), 'effective Build 206 project rule set missing');
verify(rules?.version === 'PROJECT-RULES-2026-08-01-V1', `rule version=${rules?.version}`);
verify(rules?.rules?.length === 105, `rule count=${rules?.rules?.length}`);
verify(rules?.sha256 === calculateRuleSetHash(rules), 'project rule set SHA-256 mismatch');
verify(policy.rules?.newConversationMustReadAuthoritativeLedgerFirst === true, 'new-conversation read rule missing');
verify(policy.rules?.buildStartRequiresCurrentRuleHashAcknowledgement === true, 'build-start rules acknowledgement missing');
verify(policy.rules?.projectRuleSetMustBeRenderedInAuthoritativeLedger === true, 'rule-set render policy missing');
const build206 = ledger.builds.find((entry) => entry.build === 206);
verify(build206?.rulesAcknowledgement?.version === rules?.version, 'Build 206 rule version acknowledgement mismatch');
verify(build206?.rulesAcknowledgement?.sha256 === rules?.sha256, 'Build 206 rule hash acknowledgement mismatch');
const document = await read('docs/17_MASTER_BUILD_LEDGER.md');
verify(document.includes('BAĞLAYICI PROJE KURAL SETİ'), 'authoritative ledger does not render project rules section');
verify(document.includes(rules?.sha256 ?? 'missing'), 'authoritative ledger does not render current rule hash');
for (const rule of rules?.rules ?? []) verify(document.includes(`${rule.id}. ${rule.text}`), `authoritative ledger missing ${rule.id}`);
const updater = await read('scripts/update-master-build-ledger.mjs');
verify(updater.includes("option('--rules-ack', true)"), 'ledger updater does not require --rules-ack');
verify(updater.includes('Project rules acknowledgement mismatch'), 'ledger updater does not reject wrong rule hash');
const versionUpdater = await read('scripts/set-workspace-version.mjs');
verify(versionUpdater.includes('ruleAckText'), 'workspace version updater does not accept rule hash acknowledgement');
verify(versionUpdater.includes('version update blocked'), 'workspace version updater does not block missing/wrong rule hash');
const preflight = await readJson('config/source-preflight-checks.json');
verify(preflight.checks?.some((check) => check.id === 'build206-project-rules-contract'), 'source preflight project-rules contract check missing');

const evidence = {
  schemaVersion: 1,
  product: ledger.product,
  version: ledger.currentVersion,
  build: 206,
  ruleSetVersion: rules?.version ?? null,
  ruleSetSha256: rules?.sha256 ?? null,
  ruleCount: rules?.rules?.length ?? 0,
  checks,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`Build 206 project rules contract failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 206 project rules contract verified: ${checks} assertions / ${evidence.ruleCount} rules.`);
