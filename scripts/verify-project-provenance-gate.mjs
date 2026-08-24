import { mkdir, readFile, writeFile } from 'node:fs/promises';

const failures = [];
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const constitution = await readJson('config/project-constitution.json');
const ledgerPolicy = await readJson('config/master-build-ledger-policy.json');
const ledger = await readJson('config/master-build-ledger.json');
const updater = await readFile('scripts/update-master-build-ledger.mjs', 'utf8');
const ruleSet = ledger.projectRules.versions.at(-1);
const ruleDocumentVersion = /V(\d+)$/.exec(ruleSet.version)?.[1];
if (!ruleDocumentVersion) throw new Error(`Cannot derive constitution document from ${ruleSet.version}`);
const documentPath = `docs/18_PROJECT_CONSTITUTION_V${ruleDocumentVersion}.md`;
const document = await readFile(documentPath, 'utf8');

check(constitution.projectStartDate === '2026-07-20', 'project constitution start date mismatch');
check(ledgerPolicy.rules?.projectSourceStartDate === constitution.projectStartDate, 'ledger policy source start date mismatch');
check(ledgerPolicy.rules?.preProjectSourcesForbidden === true, 'pre-project source ban disabled');
check(ledger.projectRules.currentVersion === ruleSet.version, 'current rule set does not match latest version');
check(Number.isInteger(ruleSet.effectiveBuild) && ruleSet.effectiveBuild <= ledger.currentBuild, 'latest rule set is not effective for current build');
check(ledger.projectRules.startupRequirement.includes('20.07.2026'), 'startup requirement lacks provenance boundary');
check(document.includes('20.07.2026'), 'constitution document lacks provenance date');
check(updater.includes('20.07.2026 öncesi sohbet'), 'handoff prompt does not preserve provenance ban');

const report = {
  schemaVersion: 2,
  build: ledger.currentBuild,
  ruleVersion: ruleSet.version,
  constitutionVersion: constitution.id,
  sourceStartDate: constitution.projectStartDate,
  checks,
  status: failures.length ? 'FAIL' : 'PASS',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(`artifacts/validation/build${ledger.currentBuild}-project-provenance.json`, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Project provenance gate: PASS (${checks} checks).`);
