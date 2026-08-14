import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { runPlatformPolicyAstGate } from './verify-platform-policy-ast-gate.mjs';
import { runPlatformCapabilityManifestGate } from './verify-platform-capability-manifest-gate.mjs';

const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));

export const verifyB4BankingFoundationBoundary = async () => {
  const [
    scope, inventory, domain, bankingSecurity, application, repositoryContract,
    repository, aiRepository, personLifecycleRepository, migrations, adapter,
    dataStore, main, ipcPolicy, preload, declarations, renderer, rootPackage,
    applicationTest, ipcTest, dataStoreTest, decision, threatModel, auditDocument,
    astAllowlist, astGate, capabilityGate
  ] = await Promise.all([
    json('config/32-z-b4-banking-foundation-scope.json'),
    json('config/32-z-b4-banking-foundation-inventory.json'),
    text('packages/domain/src/app-data.ts'),
    text('packages/application/src/banking-security.ts'),
    text('packages/application/src/finance-use-cases.ts'),
    text('packages/repository-contracts/src/finance-repository.ts'),
    text('packages/repositories/src/finance-repository.ts'),
    text('packages/repositories/src/ai-consent-repository.ts'),
    text('packages/repositories/src/person-lifecycle-repository.ts'),
    text('packages/database/src/family-database-migrations.ts'),
    text('apps/desktop/src/main/finance-application-adapter.ts'),
    text('apps/desktop/src/main/data-store.ts'),
    text('apps/desktop/src/main/main.ts'),
    text('apps/desktop/src/main/ipc-integration-policy.ts'),
    text('apps/desktop/src/main/preload.ts'),
    text('apps/desktop/src/renderer/global.d.ts'),
    text('apps/desktop/src/renderer/App.tsx'),
    json('package.json'),
    text('packages/application/tests/banking-foundation.test.ts'),
    text('apps/desktop/tests/b4-banking-ipc-integration.test.ts'),
    text('apps/desktop/tests/data-store.test.ts'),
    text('docs/decisions/DEC-211-b4-banking-foundation.md'),
    text('docs/security/B4_BANKING_FOUNDATION_THREAT_MODEL.md'),
    text('docs/audit/32-Z_B4_BANKING_FOUNDATION_UST_KAPANIS.md'),
    json('config/32-q-ppk-021-platform-policy-ast-allowlist.json'),
    runPlatformPolicyAstGate(),
    runPlatformCapabilityManifestGate()
  ]);

  const checks = [];
  const failures = [];
  const check = (name, condition) => {
    const passed = Boolean(condition);
    checks.push({ name, passed });
    if (!passed) failures.push(name);
  };
  const migrationVersions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)]
    .map((match) => Number.parseInt(match[1], 10));
  const bankingStart = migrations.indexOf('const bankingFoundationSql =');
  const bankingEnd = migrations.indexOf('export const FAMILY_DATABASE_MIGRATIONS');
  const bankingMigration = bankingStart >= 0 && bankingEnd > bankingStart
    ? migrations.slice(bankingStart, bankingEnd)
    : '';
  const catalogRows = bankingMigration.match(/\('\d{4}','\d{5}','/gu) ?? [];
  const bankAccountSchema = bankingMigration.match(/CREATE TABLE bank_accounts\(([\s\S]*?)\n\);/u)?.[1] ?? '';
  const channels = ['finance:listBankInstitutions', 'finance:listBankAccounts', 'finance:validateIban', 'finance:createBankAccount'];
  const methods = ['listBankInstitutions', 'listBankAccounts', 'validateIban', 'createBankAccount'];
  const astKeys = new Set(astAllowlist.allowedSurfaceKeys ?? []);

  check('scope closes exactly five B4 requirements under DEC-211', scope.status === 'COMPLETE'
    && scope.decision === 'DEC-211'
    && scope.requirements?.join(',') === 'B4-01,B4-02,B4-03,B4-04,B4-07');
  check('inventory has no open package blocker and leaves card requirements open', inventory.status === 'COMPLETE'
    && inventory.openBlockers?.length === 0
    && inventory.openRequirements?.join(',') === 'B4-05,B4-06');
  check('catalog source is TCMB 2026 with 71 participants and local icons', scope.catalog?.publisher === 'Türkiye Cumhuriyet Merkez Bankası'
    && scope.catalog?.sourceVersion === '2026'
    && scope.catalog?.participantCount === 71
    && scope.catalog?.remoteLogoFetchAllowed === false
    && scope.catalog?.iconSource === 'local_lettermark');
  check('domain exposes institution account and IBAN truth contracts', includesAll(domain, [
    'BankInstitutionView', 'BankAccountView', 'CreateBankAccountInput', 'IbanStructuralValidationView',
    "accountVerification:'not_performed'", "ownershipVerification:'not_performed'"
  ]));
  check('domain fixes account types statuses and ownership fields', includesAll(domain, [
    'BANK_ACCOUNT_TYPES', 'BANK_ACCOUNT_STATUSES', 'ownershipBasisPoints:number', 'ibanMasked:string', 'ibanLast4:string'
  ]));
  check('IBAN normalization and streaming MOD 97-10 are implemented locally', includesAll(bankingSecurity, [
    'normalizeIban', 'mod97Valid', 'remainder = ((remainder * 10) + Number(digit)) % 97', 'TR: 26'
  ]) && !/\bfetch\s*\(/u.test(bankingSecurity));
  check('TR provider reserved field and institution match fail closed', includesAll(bankingSecurity, [
    "normalized.slice(4, 9)", "normalized[9] === '0'", 'TR_INSTITUTION_NOT_FOUND', 'institutionMatched'
  ]));
  check('bank account contract rejects canonical secret fields and Luhn-valid PAN', includesAll(bankingSecurity, [
    'PROHIBITED_BANKING_SECRET_FIELDS', 'containsLikelyFullPan', 'luhnValid', 'inspectBankAccountDataContract'
  ]));
  check('legacy finance record and valuation use cases reject banking secrets', includesAll(application, [
    "inspectProhibitedBankingSecrets(input.command, [", "inspectProhibitedBankingSecrets(input.command, ['provider'])",
    'internet bankacılığı parolası finans kaydında kabul edilmez', 'internet bankacılığı parolası finans değerlemesinde kabul edilmez'
  ]));
  check('create account validates person institution authorization and policy write', includesAll(application, [
    'class CreateBankAccountUseCase', 'scope.findPerson', 'scope.findBankInstitution', 'validateIbanStructure',
    "action: 'create'", "resourceType: 'finance_record'", 'scope.authorize', 'scope.insertBankAccount'
  ]));
  check('account audit and outbox omit IBAN', includesAll(application, [
    "action: 'finance.bank_account.created'", "eventType: 'finance.bank_account.created'", 'institutionCode', 'accountType'
  ]) && !/payload:\s*\{[\s\S]{0,500}\biban\b/iu.test(application.slice(application.indexOf("eventType: 'finance.bank_account.created'"))));
  check('repository contract carries protected write value and masked public view', includesAll(repositoryContract, [
    'BankAccountRow', 'NewBankAccountRow', 'normalizedIban', 'listBankAccounts', 'insertBankAccount'
  ]));
  check('repository masks persisted IBAN before returning it', includesAll(repository, [
    'maskPersistedIban', 'ibanMasked: maskPersistedIban(normalizedIban)', 'ibanLast4: normalizedIban.slice(-4)'
  ]));
  check('sensitive inventory counts bank accounts without naming IBAN', aiRepository.includes('SELECT COUNT(*) FROM bank_accounts')
    && aiRepository.includes('Banka hesabı (maskeli)')
    && !/fieldNames:\[[^\]]*IBAN/iu.test(aiRepository));
  check('person lifecycle reference inspection includes bank accounts', personLifecycleRepository.includes('bankAccounts: `SELECT COUNT(*) AS total FROM bank_accounts WHERE owner_person_id=?`'));
  check('migration 78 remains the exact banking foundation baseline', migrationVersions.includes(78)
    && Math.max(...migrationVersions) >= 78
    && migrations.includes("createMigrationDefinition(78, 'b4_banking_foundation', bankingFoundationSql)"));
  check('migration seeds exactly 71 TCMB catalog rows', catalogRows.length === 71
    && bankingMigration.includes('CREATE TABLE bank_institutions(')
    && bankingMigration.includes("icon_source TEXT NOT NULL CHECK(icon_source='local_lettermark')"));
  check('bank account schema contains no prohibited secret columns', bankAccountSchema.length > 0
    && !/\b(?:pan|card_number|cvv|cvc|pin|password|internet_banking_password)\b/iu.test(bankAccountSchema));
  check('bank account schema fixes TR length provider reserve privacy and ownership constraints', includesAll(bankAccountSchema, [
    'length(normalized_iban)=26', "substr(normalized_iban,1,2)='TR'", "substr(normalized_iban,10,1)='0'",
    'ownership_basis_points BETWEEN 1 AND 10000', "privacy IN ('private','selected_members','family')"
  ]));
  check('migration requires an unused exact durable finance receipt', includesAll(bankingMigration, [
    'trg_b4_bank_account_insert_policy_receipt', "receipt.resource_type='finance_record'", "receipt.action='create'",
    "receipt.capability='finance.write'", 'unused exact durable finance policy receipt'
  ]));
  check('migration blocks receipt replay mutation and deletion', includesAll(bankingMigration, [
    'trg_b4_finance_record_bank_receipt_reuse', 'trg_b4_finance_valuation_bank_receipt_reuse',
    'trg_b4_bank_account_immutable', 'trg_b4_bank_account_delete_guard'
  ]));
  check('production finance adapter composes governed catalog account and IBAN operations', includesAll(adapter, [
    'listBankInstitutions', 'listBankAccounts', 'validateIban', 'findBankInstitution', 'insertBankAccount',
    'executeGoverned', 'governedRepositoryContext'
  ]));
  check('DataStore composes all four banking use cases', includesAll(dataStore, [
    'ListBankInstitutionsUseCase', 'ListBankAccountsUseCase', 'ValidateIbanUseCase', 'CreateBankAccountUseCase'
  ]));
  check('main and preload bind the four exact banking channels', channels.every((channel) => main.includes(channel) && preload.includes(channel)));
  check('IPC policy validates exact payloads and rejects secret fields and values', includesAll(ipcPolicy, [
    'bankAccountInput', 'financeRecordInput', 'financeValuationInput', 'BANKING_SECRET_FIELD_PROHIBITED',
    'BANKING_SECRET_VALUE_PROHIBITED', 'hasOnlyKeys(value, BANK_ACCOUNT_INPUT_KEYS)'
  ]));
  check('renderer declarations expose all four typed methods', methods.every((method) => declarations.includes(method)));
  check('finance UI exposes account entry masked list and separated verification truth', includesAll(renderer, [
    'TCMB kataloglu · güvenli banka hesabı', 'IBAN yapısal kontrolü', 'Gerçek hesap doğrulaması: Yapılmadı',
    'Sahiplik doğrulaması: Yapılmadı', 'account.ibanMasked', 'Güvenli ikon kaynağı: yerel harf simgesi'
  ]));
  check('targeted tests cover structure IPC secrets masking receipts and no-IBAN payload', includesAll(applicationTest, [
    'MOD 97-10', 'TR_RESERVED_FIELD_INVALID', 'Luhn-valid full PAN'
  ]) && includesAll(ipcTest, ['BANKING_SECRET_FIELD_PROHIBITED', 'legacy finance record and valuation'])
    && includesAll(dataStoreTest, ['B4-01/B4-02/B4-03/B4-04/B4-07', 'unused exact durable finance policy receipt', 'payload_json']));
  check('decision and threat model preserve structural-only truth', includesAll(decision, [
    'DEC-211', 'varlığı ve hesap sahipliği', 'B4-05', 'B4-06'
  ]) && includesAll(threatModel, ['not_performed', 'Luhn', 'Eski finans kanalından bypass']));
  check('audit document binds exact evidence triplet and excluded claims', includesAll(auditDocument, [
    '32-Z-b4-banking-foundation-boundary.json', '32-Z-b4-banking-foundation-contract.json',
    '32-Z-b4-banking-foundation-runtime.json', 'B4-05', 'B4-06'
  ]));
  check('PPK-021 exact ratchet reviews the four new compositions', [
    'CreateBankAccountUseCase', 'ListBankAccountsUseCase', 'ListBankInstitutionsUseCase', 'ValidateIbanUseCase'
  ].every((symbol) => astKeys.has(`USE_CASE_COMPOSITION|apps/desktop/src/main/data-store.ts|${symbol}`))
    && astGate.status === 'PASS' && astGate.exactAllowlistEntries === 680
    && astGate.directRoleAuthorizationBypasses === 0 && astGate.findings.length === 0);
  check('PPK-022 successor capability ratchet remains exact and green', capabilityGate.status === 'PASS'
    && capabilityGate.capabilitySurfaces === 339
    && capabilityGate.exactManifestSurfaces === 339
    && capabilityGate.findings.length === 0);
  check('root lifecycle and explicit package scripts bind 32-Z', ['pretypecheck', 'prebuild'].every((name) =>
    rootPackage.scripts?.[name]?.includes('verify-b4-banking-foundation-boundary.mjs'))
    && ['verify:b4-banking:boundary', 'verify:b4-banking:targeted', 'verify:b4-banking:contract', 'verify:b4-banking:runtime']
      .every((name) => typeof rootPackage.scripts?.[name] === 'string'));

  return Object.freeze({
    schemaVersion: 1,
    step: '32-Z',
    requirements: Object.freeze(['B4-01', 'B4-02', 'B4-03', 'B4-04', 'B4-07']),
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checksPassed: checks.filter((item) => item.passed).length,
    checksFailed: failures.length,
    checks: Object.freeze(checks),
    failures: Object.freeze(failures),
    latestDatabaseMigration: Math.max(...migrationVersions),
    catalogRows: catalogRows.length,
    ppk021ExactAllowlistEntries: astGate.exactAllowlistEntries,
    ppk022CapabilitySurfaces: capabilityGate.capabilitySurfaces,
    networkVerificationPerformed: false,
    generatedAt: new Date().toISOString()
  });
};

const report = await verifyB4BankingFoundationBoundary();
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-Z-b4-banking-foundation-boundary.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`B4 banking foundation boundary: ${report.status} (${report.checksPassed}/${report.checks.length} checks).`);
if (report.status !== 'PASS') {
  console.error(report.failures.join('\n'));
  process.exitCode = 1;
}
