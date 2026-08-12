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
  json('config/33-c-b4-finance-planning-portfolio-analytics-scope.json'),
  json('config/33-c-b4-finance-planning-portfolio-analytics-inventory.json'),
  json('artifacts/validation/33-C-b4-finance-planning-portfolio-analytics-boundary.json'),
  text('packages/database/src/family-database-migrations.ts'),
  json('package.json'),
  text('docs/decisions/DEC-214-b4-finance-planning-portfolio-analytics.md'),
  text('docs/security/THREAT_MODEL_33_C_B4_FINANCE_PLANNING_PORTFOLIO_ANALYTICS.md'),
  text('docs/audit/33-C_B4_FINANCE_PLANNING_PORTFOLIO_ANALYTICS_UST_KAPANIS.md'),
  text('packages/application/tests/finance-planning-portfolio-analytics.test.ts'),
  text('apps/desktop/tests/b4-finance-planning-ipc-integration.test.ts'),
  text('apps/desktop/tests/data-store.test.ts')
]);

const checks = [];
const failures = [];
const check = (name, condition) => {
  const passed = Boolean(condition);
  checks.push({ name, passed });
  if (!passed) failures.push(name);
};
const ids = ['B4-10', 'B4-11', 'B4-12'];
const requirements = ids.map((id) => registry.requirements?.find((item) => item.id === id));
const expectedEvidence = [
  'artifacts/validation/33-C-b4-finance-planning-portfolio-analytics-boundary.json',
  'artifacts/validation/33-C-b4-finance-planning-portfolio-analytics-contract.json',
  'artifacts/validation/33-C-b4-finance-planning-portfolio-analytics-runtime.json'
];
const migrationVersions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)]
  .map((match) => Number.parseInt(match[1], 10));
const latestMigration = Math.max(...migrationVersions);

check('all three requirements are complete with exact 13-link chains', requirements.every((item) =>
  item?.status === 'COMPLETE' && allChainTrue(item)));
check('all three requirements bind the exact 33-C evidence triplet', requirements.every((item) =>
  expectedEvidence.every((path) => item?.evidence?.includes(path))));
check('all three requirements bind DEC-214 security repositories and dedicated UI', requirements.every((item) =>
  item?.evidence?.includes('docs/decisions/DEC-214-b4-finance-planning-portfolio-analytics.md')
  && item?.codeAreas?.includes('packages/repositories/src/ai-consent-repository.ts')
  && item?.codeAreas?.includes('packages/repositories/src/person-lifecycle-repository.ts')
  && item?.codeAreas?.includes('apps/desktop/src/renderer/FinancePlanningPanel.tsx')));
check('33-C inventory preserves its historical open scope and 33-D completes the successor requirements', inventory.openRequirements?.join(',') === 'B4-13,B4-14'
  && inventory.successorCompletion?.step === '33-D'
  && inventory.successorCompletion?.status === 'COMPLETE'
  && inventory.openRequirements.every((id) => {
    const item = registry.requirements?.find((candidate) => candidate.id === id);
    return item?.status === 'COMPLETE' && allChainTrue(item)
      && item?.evidence?.includes('artifacts/validation/33-D-b4-controlled-import-open-banking-boundary.json')
      && item?.evidence?.includes('docs/decisions/DEC-215-b4-controlled-import-open-banking.md');
  }));
check('scope and inventory bind DEC-214 migration 81 with no network channel', scope.status === 'COMPLETE'
  && scope.decision === 'DEC-214' && inventory.latestDatabaseMigration === 81
  && inventory.networkChannels?.length === 0);
check('boundary evidence is exact green and truth preserving', boundary.status === 'PASS'
  && boundary.checksFailed === 0 && boundary.latestDatabaseMigration === 83
  && boundary.financePlanningLedgerColumns === 39
  && boundary.ppk021ExactAllowlistEntries === 545
  && boundary.ppk021UseCaseCompositionSurfaces === 277
  && boundary.ppk022CapabilitySurfaces === 242
  && boundary.prohibitedSecretColumns === 0
  && boundary.crossCurrencyAggregationPerformed === false
  && boundary.externalPricingPerformed === false
  && boundary.bankSynchronizationPerformed === false
  && boundary.paymentExecutionPerformed === false);
check('DEC-214 is active in the user decision ledger', ledger.decisionCount === ledger.decisions?.length
  && ledger.decisions?.some((item) => item.id === 'DEC-214' && item.status === 'ACTIVE'
    && item.requirements?.join(',') === ids.join(',')));
check('migration 81 remains present and exact under migration 82 successor', latestMigration >= 81
  && migrations.includes("createMigrationDefinition(81, 'b4_finance_planning_portfolio_analytics', financePlanningLedgerSql)"));
check('decision states manual no-FX no-price no-sync no-payment truth and exact ratchets', includesAll(decision, [
  'kaynağı manueldir', 'Para birimleri birbirine çevrilmez', 'dış piyasa', 'fiyatı almaz',
  'banka eşitlemesi yapmaz', 'ödeme göndermez', "540'tan 542'ye", "272'den 274'e", 'PPK-022 238'
]));
check('threat model covers secrets parent receipts append-only FX and external claims', includesAll(threatModel, [
  'Bilinmeyen alan veya bankacılık sırrı girişi', 'Üst kayıt ve sahiplik sahteciliği',
  "Receipt'siz veya replay yazma", 'Geçmişin değiştirilmesi',
  'Yanlış kur dönüşümü veya yanıltıcı toplam', 'Dış fiyat, banka eşitlemesi veya ödeme iddiası',
  'Audit/outbox sızıntısı'
]));
check('audit binds all IDs exact evidence and open successor scope', ids.every((id) => auditDocument.includes(id))
  && expectedEvidence.every((path) => auditDocument.includes(path))
  && auditDocument.includes('B4-13') && auditDocument.includes('B4-14'));
check('targeted tests name exact contracts IPC persistence receipts and honesty boundaries', includesAll(applicationTest, [
  'all nine exact contracts', 'inherits child ownership and privacy', 'separate-currency summaries'
]) && includesAll(ipcTest, [
  'all nine exact write contracts', 'Luhn-valid PAN', 'unsafe numeric values'
]) && includesAll(dataStoreTest, [
  'PRAGMA table_info(finance_planning_ledger)', 'finance.planning.item_recorded',
  'unused exact durable finance policy receipt'
]));
check('root lifecycle and explicit package scripts bind 33-C', ['pretypecheck', 'prebuild'].every((name) =>
  rootPackage.scripts?.[name]?.includes('verify-b4-finance-planning-portfolio-analytics-boundary.mjs'))
  && ['verify:b4-planning:boundary', 'verify:b4-planning:targeted', 'verify:b4-planning:contract', 'verify:b4-planning:runtime']
    .every((name) => typeof rootPackage.scripts?.[name] === 'string'));
check('all contract prerequisites exist', [
  'config/33-c-b4-finance-planning-portfolio-analytics-scope.json',
  'config/33-c-b4-finance-planning-portfolio-analytics-inventory.json',
  'docs/decisions/DEC-214-b4-finance-planning-portfolio-analytics.md',
  'docs/security/THREAT_MODEL_33_C_B4_FINANCE_PLANNING_PORTFOLIO_ANALYTICS.md',
  'docs/audit/33-C_B4_FINANCE_PLANNING_PORTFOLIO_ANALYTICS_UST_KAPANIS.md',
  'scripts/verify-b4-finance-planning-portfolio-analytics-boundary.mjs',
  'scripts/verify-33-c-b4-finance-planning-portfolio-analytics-runtime.mjs'
].every(existsSync));

const report = Object.freeze({
  schemaVersion: 1,
  step: '33-C',
  requirements: Object.freeze(ids),
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: checks.filter((item) => item.passed).length,
  checksFailed: failures.length,
  checks: Object.freeze(checks),
  failures: Object.freeze(failures),
  latestDatabaseMigration: latestMigration,
  ppk021ExactAllowlistEntries: boundary.ppk021ExactAllowlistEntries,
  ppk021UseCaseCompositionSurfaces: boundary.ppk021UseCaseCompositionSurfaces,
  ppk022CapabilitySurfaces: boundary.ppk022CapabilitySurfaces,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/33-C-b4-finance-planning-portfolio-analytics-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`B4 finance planning portfolio analytics contract: ${report.status} (${report.checksPassed}/${checks.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
