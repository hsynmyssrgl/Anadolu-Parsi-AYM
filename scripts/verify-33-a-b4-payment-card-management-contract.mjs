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
  json('config/33-a-b4-payment-card-management-scope.json'),
  json('config/33-a-b4-payment-card-management-inventory.json'),
  json('artifacts/validation/33-A-b4-payment-card-management-boundary.json'),
  text('packages/database/src/family-database-migrations.ts'),
  json('package.json'),
  text('docs/decisions/DEC-212-b4-payment-card-management.md'),
  text('docs/security/B4_PAYMENT_CARD_MANAGEMENT_THREAT_MODEL.md'),
  text('docs/audit/33-A_B4_PAYMENT_CARD_MANAGEMENT_UST_KAPANIS.md'),
  text('packages/application/tests/payment-card-management.test.ts'),
  text('apps/desktop/tests/b4-payment-card-ipc-integration.test.ts'),
  text('apps/desktop/tests/data-store.test.ts')
]);

const checks = [];
const failures = [];
const check = (name, condition) => {
  const passed = Boolean(condition);
  checks.push({ name, passed });
  if (!passed) failures.push(name);
};
const ids = ['B4-05', 'B4-06'];
const requirements = ids.map((id) => registry.requirements?.find((item) => item.id === id));
const expectedEvidence = [
  'artifacts/validation/33-A-b4-payment-card-management-boundary.json',
  'artifacts/validation/33-A-b4-payment-card-management-contract.json',
  'artifacts/validation/33-A-b4-payment-card-management-runtime.json'
];
const migrationVersions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)]
  .map((match) => Number.parseInt(match[1], 10));
const latestMigration = Math.max(...migrationVersions);

check('both requirements are complete with exact 13-link chains', requirements.every((item) => item?.status === 'COMPLETE' && allChainTrue(item)));
check('both requirements bind the exact 33-A evidence triplet', requirements.every((item) => expectedEvidence.every((path) => item?.evidence?.includes(path))));
check('both requirements bind DEC-212 implementation and UI areas', requirements.every((item) =>
  item?.evidence?.includes('docs/decisions/DEC-212-b4-payment-card-management.md')
  && item?.codeAreas?.includes('packages/application/src/banking-security.ts')
  && item?.codeAreas?.includes('apps/desktop/src/renderer/App.tsx')));
const completedAfter33A = new Set(['B4-08', 'B4-09']);
check('33-A historical open scope remains truthful while 33-B successors may complete', inventory.openRequirements?.every((id) => {
  const item = registry.requirements?.find((candidate) => candidate.id === id);
  return completedAfter33A.has(id)
    ? item?.status === 'COMPLETE' && allChainTrue(item)
    : item?.status !== 'COMPLETE' && !allChainTrue(item);
}) && inventory.openRequirements?.length === 7);
check('scope and inventory bind DEC-212 migration 79 with no network channel', scope.status === 'COMPLETE'
  && scope.decision === 'DEC-212' && inventory.latestDatabaseMigration === 79
  && inventory.networkChannels?.length === 0);
check('boundary evidence is exact green', boundary.status === 'PASS'
  && boundary.checksFailed === 0 && boundary.latestDatabaseMigration >= 79
  && boundary.ppk021ExactAllowlistEntries === 540
  && boundary.ppk022CapabilitySurfaces === 238
  && boundary.prohibitedSecretColumns === 0 && boundary.bankExecutionPerformed === false);
check('DEC-212 is active in the user decision ledger', ledger.decisionCount === ledger.decisions?.length
  && ledger.decisions?.some((item) => item.id === 'DEC-212' && item.status === 'ACTIVE'
    && item.requirements?.join(',') === ids.join(',')));
check('migration 79 remains an exact predecessor baseline', latestMigration >= 79
  && migrations.includes("createMigrationDefinition(79, 'b4_payment_card_management', paymentCardManagementSql)"));
check('decision states last-four-only no-payment truth and ratchets', includesAll(decision, [
  'yalnız son dört hane', 'banka talimatı, ödeme veya para', 'transferi başlatmaz',
  "535'ten 537'ye", 'PPK-022 238'
]));
check('threat model covers secrets receipts payload limits and tracking-only automation', includesAll(threatModel, [
  'Tam kart numarası veya sır girişi', "Receipt'siz veya replay yazma", 'Audit/outbox sızıntısı',
  'Otomatik ödeme iddiası', 'Tutarsız finans özeti'
]));
check('audit binds both IDs exact evidence and open successor scope', ids.every((id) => auditDocument.includes(id))
  && expectedEvidence.every((path) => auditDocument.includes(path))
  && auditDocument.includes('B4-08'));
check('targeted tests name all security and persistence boundaries', includesAll(applicationTest, [
  'last-four-only aggregate contract', 'Luhn-valid full PAN'
]) && includesAll(ipcTest, ['BANKING_SECRET_FIELD_PROHIBITED', 'PAYMENT_CARD_ARGUMENT_INVALID'])
  && includesAll(dataStoreTest, ['PRAGMA table_info(payment_cards)', 'finance.payment_card.created']));
check('root lifecycle and explicit package scripts bind 33-A', ['pretypecheck', 'prebuild'].every((name) =>
  rootPackage.scripts?.[name]?.includes('verify-b4-payment-card-management-boundary.mjs'))
  && ['verify:b4-cards:boundary', 'verify:b4-cards:targeted', 'verify:b4-cards:contract', 'verify:b4-cards:runtime']
    .every((name) => typeof rootPackage.scripts?.[name] === 'string'));
check('all contract prerequisites exist', [
  'config/33-a-b4-payment-card-management-scope.json',
  'config/33-a-b4-payment-card-management-inventory.json',
  'docs/decisions/DEC-212-b4-payment-card-management.md',
  'docs/security/B4_PAYMENT_CARD_MANAGEMENT_THREAT_MODEL.md',
  'docs/audit/33-A_B4_PAYMENT_CARD_MANAGEMENT_UST_KAPANIS.md',
  'scripts/verify-b4-payment-card-management-boundary.mjs',
  'scripts/verify-33-a-b4-payment-card-management-runtime.mjs'
].every(existsSync));

const report = Object.freeze({
  schemaVersion: 1,
  step: '33-A',
  requirements: Object.freeze(ids),
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: checks.filter((item) => item.passed).length,
  checksFailed: failures.length,
  checks: Object.freeze(checks),
  failures: Object.freeze(failures),
  latestDatabaseMigration: latestMigration,
  ppk021ExactAllowlistEntries: boundary.ppk021ExactAllowlistEntries,
  ppk022CapabilitySurfaces: boundary.ppk022CapabilitySurfaces,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/33-A-b4-payment-card-management-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`B4 payment card management contract: ${report.status} (${report.checksPassed}/${checks.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
