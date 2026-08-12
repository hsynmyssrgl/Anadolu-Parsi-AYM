import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const allChainTrue = (requirement) => requirement && Object.values(requirement.chain ?? {}).length === 13
  && Object.values(requirement.chain).every((value) => value === true);

const [
  registry, ledger, scope, inventory, boundary, migrations, rootPackage,
  decision, threatModel, auditDocument, applicationTest, ipcTest, dataStoreTest
] = await Promise.all([
  json('config/accepted-scope-registry.json'),
  json('config/user-decision-ledger.json'),
  json('config/32-z-b4-banking-foundation-scope.json'),
  json('config/32-z-b4-banking-foundation-inventory.json'),
  json('artifacts/validation/32-Z-b4-banking-foundation-boundary.json'),
  text('packages/database/src/family-database-migrations.ts'),
  json('package.json'),
  text('docs/decisions/DEC-211-b4-banking-foundation.md'),
  text('docs/security/B4_BANKING_FOUNDATION_THREAT_MODEL.md'),
  text('docs/audit/32-Z_B4_BANKING_FOUNDATION_UST_KAPANIS.md'),
  text('packages/application/tests/banking-foundation.test.ts'),
  text('apps/desktop/tests/b4-banking-ipc-integration.test.ts'),
  text('apps/desktop/tests/data-store.test.ts')
]);

const checks = [];
const failures = [];
const check = (name, condition) => {
  const passed = Boolean(condition);
  checks.push({ name, passed });
  if (!passed) failures.push(name);
};
const ids = ['B4-01', 'B4-02', 'B4-03', 'B4-04', 'B4-07'];
const requirements = ids.map((id) => registry.requirements?.find((item) => item.id === id));
const expectedEvidence = [
  'artifacts/validation/32-Z-b4-banking-foundation-boundary.json',
  'artifacts/validation/32-Z-b4-banking-foundation-contract.json',
  'artifacts/validation/32-Z-b4-banking-foundation-runtime.json'
];
const migrationVersions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)]
  .map((match) => Number.parseInt(match[1], 10));
const latestMigration = Math.max(...migrationVersions);

check('all five requirements are complete with exact 13-link chains', requirements.every((item) => item?.status === 'COMPLETE' && allChainTrue(item)));
check('all five requirements bind the exact 32-Z evidence triplet', requirements.every((item) => expectedEvidence.every((path) => item?.evidence?.includes(path))));
check('all five requirements bind DEC-211 and package implementation areas', requirements.every((item) => item?.evidence?.includes('docs/decisions/DEC-211-b4-banking-foundation.md')
  && item?.codeAreas?.includes('packages/application/src/banking-security.ts')
  && item?.codeAreas?.includes('apps/desktop/src/renderer/App.tsx')));
check('B4-05 and B4-06 remain honestly open', ['B4-05', 'B4-06'].every((id) => {
  const item = registry.requirements?.find((candidate) => candidate.id === id);
  return item?.status !== 'COMPLETE' && !allChainTrue(item);
}));
check('scope and inventory bind DEC-211 migration 78 and no network channel', scope.status === 'COMPLETE'
  && scope.decision === 'DEC-211'
  && inventory.latestDatabaseMigration === 78
  && inventory.networkChannels?.length === 0);
check('boundary evidence is exact green', boundary.status === 'PASS'
  && boundary.checksFailed === 0
  && boundary.catalogRows === 71
  && boundary.latestDatabaseMigration === 78
  && boundary.ppk021ExactAllowlistEntries === 535
  && boundary.ppk022CapabilitySurfaces === 238
  && boundary.networkVerificationPerformed === false);
check('DEC-211 is active in the user decision ledger', ledger.decisionCount === ledger.decisions?.length
  && ledger.decisions?.some((item) => item.id === 'DEC-211' && item.status === 'ACTIVE'
    && item.requirements?.join(',') === ids.join(',')));
check('migration 78 remains latest and exact', latestMigration === 78
  && migrations.includes("createMigrationDefinition(78, 'b4_banking_foundation', bankingFoundationSql)"));
check('decision states structural-only truth and open card scope', includesAll(decision, [
  'varlığı ve hesap sahipliği', 'B4-05', 'B4-06', "531'den 535'e"
]));
check('threat model covers masking receipts legacy bypass and no bank query', includesAll(threatModel, [
  'Tam IBAN sızıntısı', "receipt'siz yazma", 'Eski finans kanalından bypass', 'banka ağına bağlanmaz'
]));
check('audit document binds all five IDs and evidence triplet', ids.every((id) => auditDocument.includes(id))
  && expectedEvidence.every((path) => auditDocument.includes(path)));
check('targeted tests exist and name all security boundaries', includesAll(applicationTest, ['MOD 97-10', 'Luhn-valid full PAN'])
  && includesAll(ipcTest, ['BANKING_SECRET_FIELD_PROHIBITED', 'BANKING_SECRET_VALUE_PROHIBITED'])
  && includesAll(dataStoreTest, ['maskeleme ve sır reddiyle uygular', 'payload_json']));
check('root lifecycle and explicit package scripts bind 32-Z', ['pretypecheck', 'prebuild'].every((name) =>
  rootPackage.scripts?.[name]?.includes('verify-b4-banking-foundation-boundary.mjs'))
  && ['verify:b4-banking:boundary', 'verify:b4-banking:targeted', 'verify:b4-banking:contract', 'verify:b4-banking:runtime']
    .every((name) => typeof rootPackage.scripts?.[name] === 'string'));
check('all contract prerequisites exist', [
  'config/32-z-b4-banking-foundation-scope.json',
  'config/32-z-b4-banking-foundation-inventory.json',
  'docs/decisions/DEC-211-b4-banking-foundation.md',
  'docs/security/B4_BANKING_FOUNDATION_THREAT_MODEL.md',
  'docs/audit/32-Z_B4_BANKING_FOUNDATION_UST_KAPANIS.md',
  expectedEvidence[0]
].every(existsSync));

const report = Object.freeze({
  schemaVersion: 1,
  step: '32-Z',
  requirements: Object.freeze(ids),
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: checks.filter((item) => item.passed).length,
  checksFailed: failures.length,
  checks: Object.freeze(checks),
  failures: Object.freeze(failures),
  latestDatabaseMigration: latestMigration,
  catalogRows: boundary.catalogRows,
  ppk021ExactAllowlistEntries: boundary.ppk021ExactAllowlistEntries,
  ppk022CapabilitySurfaces: boundary.ppk022CapabilitySurfaces,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-Z-b4-banking-foundation-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`B4 banking foundation contract: ${report.status} (${report.checksPassed}/${checks.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
