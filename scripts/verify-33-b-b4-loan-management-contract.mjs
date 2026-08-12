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
  json('config/33-b-b4-loan-management-scope.json'),
  json('config/33-b-b4-loan-management-inventory.json'),
  json('artifacts/validation/33-B-b4-loan-management-boundary.json'),
  text('packages/database/src/family-database-migrations.ts'),
  json('package.json'),
  text('docs/decisions/DEC-213-b4-loan-management.md'),
  text('docs/security/B4_LOAN_MANAGEMENT_THREAT_MODEL.md'),
  text('docs/audit/33-B_B4_LOAN_MANAGEMENT_UST_KAPANIS.md'),
  text('packages/application/tests/loan-management.test.ts'),
  text('apps/desktop/tests/b4-loan-management-ipc-integration.test.ts'),
  text('apps/desktop/tests/data-store.test.ts')
]);

const checks = [];
const failures = [];
const check = (name, condition) => {
  const passed = Boolean(condition);
  checks.push({ name, passed });
  if (!passed) failures.push(name);
};
const ids = ['B4-08', 'B4-09'];
const requirements = ids.map((id) => registry.requirements?.find((item) => item.id === id));
const expectedEvidence = [
  'artifacts/validation/33-B-b4-loan-management-boundary.json',
  'artifacts/validation/33-B-b4-loan-management-contract.json',
  'artifacts/validation/33-B-b4-loan-management-runtime.json'
];
const migrationVersions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)]
  .map((match) => Number.parseInt(match[1], 10));
const latestMigration = Math.max(...migrationVersions);

check('both requirements are complete with exact 13-link chains', requirements.every((item) =>
  item?.status === 'COMPLETE' && allChainTrue(item)));
check('both requirements bind the exact 33-B evidence triplet', requirements.every((item) =>
  expectedEvidence.every((path) => item?.evidence?.includes(path))));
check('both requirements bind DEC-213 application security and UI areas', requirements.every((item) =>
  item?.evidence?.includes('docs/decisions/DEC-213-b4-loan-management.md')
  && item?.codeAreas?.includes('packages/application/src/banking-security.ts')
  && item?.codeAreas?.includes('apps/desktop/src/renderer/App.tsx')));
check('historical successor scope is preserved while later packages complete B4-13 and B4-14',
  inventory.openRequirements?.join(',') === 'B4-10,B4-11,B4-12,B4-13,B4-14'
  && ['B4-13', 'B4-14'].every((id) => {
    const item = registry.requirements?.find((candidate) => candidate.id === id);
    return item?.status === 'COMPLETE' && allChainTrue(item);
  }));
check('scope and inventory bind DEC-213 migration 80 with no network channel', scope.status === 'COMPLETE'
  && scope.decision === 'DEC-213' && inventory.latestDatabaseMigration === 80
  && inventory.networkChannels?.length === 0);
check('boundary evidence is exact green and truth preserving', boundary.status === 'PASS'
  && boundary.checksFailed === 0 && boundary.latestDatabaseMigration >= 80
  && boundary.ppk021ExactAllowlistEntries === 543
  && boundary.ppk021UseCaseCompositionSurfaces === 275
  && boundary.ppk022CapabilitySurfaces === 242
  && boundary.prohibitedSecretColumns === 0
  && boundary.bankVerificationPerformed === false && boundary.bankExecutionPerformed === false);
check('DEC-213 is active in the user decision ledger', ledger.decisionCount === ledger.decisions?.length
  && ledger.decisions?.some((item) => item.id === 'DEC-213' && item.status === 'ACTIVE'
    && item.requirements?.join(',') === ids.join(',')));
check('migration 80 remains an exact predecessor baseline', latestMigration >= 80
  && migrations.includes("createMigrationDefinition(80, 'b4_loan_management', loanManagementSql)"));
check('decision states manual no-payment truth and exact ratchets', includesAll(decision, [
  'kaynağı manueldir', 'ödeme göndermez', "537'den 540'a", "269'dan 272'ye", 'PPK-022 238'
]));
check('threat model covers secrets coherence receipts append-only and no-bank claims', includesAll(threatModel, [
  'Bilinmeyen alan veya bankacılık sırrı girişi', 'Tutarsız kredi profili',
  "Receipt'siz veya replay yazma", 'Geçmişin değiştirilmesi', 'Audit/outbox sızıntısı',
  'Banka işlemi yapıldığı iddiası'
]));
check('audit binds both IDs exact evidence and open successor scope', ids.every((id) => auditDocument.includes(id))
  && expectedEvidence.every((path) => auditDocument.includes(path))
  && auditDocument.includes('B4-10'));
check('targeted tests name all security persistence and honesty boundaries', includesAll(applicationTest, [
  'month-end-safe plan', 'component-exact total', 'Luhn-valid PAN'
]) && includesAll(ipcTest, ['BANKING_SECRET_FIELD_PROHIBITED', 'LOAN_ACCOUNT_ARGUMENT_INVALID',
  'LOAN_PAYMENT_ARGUMENT_INVALID'])
  && includesAll(dataStoreTest, ['PRAGMA table_info(loan_accounts)', 'finance.loan.payment_recorded',
    'unused exact durable finance policy receipt']));
check('root lifecycle and explicit package scripts bind 33-B', ['pretypecheck', 'prebuild'].every((name) =>
  rootPackage.scripts?.[name]?.includes('verify-b4-loan-management-boundary.mjs'))
  && ['verify:b4-loans:boundary', 'verify:b4-loans:targeted', 'verify:b4-loans:contract', 'verify:b4-loans:runtime']
    .every((name) => typeof rootPackage.scripts?.[name] === 'string'));
check('all contract prerequisites exist', [
  'config/33-b-b4-loan-management-scope.json',
  'config/33-b-b4-loan-management-inventory.json',
  'docs/decisions/DEC-213-b4-loan-management.md',
  'docs/security/B4_LOAN_MANAGEMENT_THREAT_MODEL.md',
  'docs/audit/33-B_B4_LOAN_MANAGEMENT_UST_KAPANIS.md',
  'scripts/verify-b4-loan-management-boundary.mjs',
  'scripts/verify-33-b-b4-loan-management-runtime.mjs'
].every(existsSync));

const report = Object.freeze({
  schemaVersion: 1,
  step: '33-B',
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
await writeFile('artifacts/validation/33-B-b4-loan-management-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`B4 loan management contract: ${report.status} (${report.checksPassed}/${checks.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
