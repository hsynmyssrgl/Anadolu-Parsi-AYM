import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { runPlatformPolicyAstGate } from './verify-platform-policy-ast-gate.mjs';
import { runPlatformCapabilityManifestGate } from './verify-platform-capability-manifest-gate.mjs';

const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const allChainTrue = (requirement) => Object.values(requirement?.chain ?? {}).length === 13
  && Object.values(requirement.chain).every((value) => value === true);

export const verifyB4PaymentCardManagementBoundary = async () => {
  const [
    scope, inventory, registry, domain, bankingSecurity, application, repositoryContract,
    repository, aiRepository, personLifecycleRepository, migrations, adapter,
    dataStore, main, ipcPolicy, preload, declarations, renderer, rootPackage,
    applicationTest, ipcTest, dataStoreTest, decision, threatModel, auditDocument,
    astAllowlist, astGate, capabilityGate
  ] = await Promise.all([
    json('config/33-a-b4-payment-card-management-scope.json'),
    json('config/33-a-b4-payment-card-management-inventory.json'),
    json('config/accepted-scope-registry.json'),
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
    text('packages/application/tests/payment-card-management.test.ts'),
    text('apps/desktop/tests/b4-payment-card-ipc-integration.test.ts'),
    text('apps/desktop/tests/data-store.test.ts'),
    text('docs/decisions/DEC-212-b4-payment-card-management.md'),
    text('docs/security/B4_PAYMENT_CARD_MANAGEMENT_THREAT_MODEL.md'),
    text('docs/audit/33-A_B4_PAYMENT_CARD_MANAGEMENT_UST_KAPANIS.md'),
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
  const migrationStart = migrations.indexOf('const paymentCardManagementSql =');
  const migrationEnd = migrations.indexOf('export const FAMILY_DATABASE_MIGRATIONS');
  const cardMigration = migrationStart >= 0 && migrationEnd > migrationStart
    ? migrations.slice(migrationStart, migrationEnd)
    : '';
  const cardSchema = cardMigration.match(/CREATE TABLE payment_cards\(([\s\S]*?)\n\);/u)?.[1] ?? '';
  const astKeys = new Set(astAllowlist.allowedSurfaceKeys ?? []);
  const channels = ['finance:listPaymentCards', 'finance:createPaymentCard'];
  const methods = ['listPaymentCards', 'createPaymentCard'];

  check('scope closes exactly B4-05 and B4-06 under DEC-212', scope.status === 'COMPLETE'
    && scope.decision === 'DEC-212' && scope.requirements?.join(',') === 'B4-05,B4-06');
  check('inventory preserves historical-at-closure successor scope and the current registry completes it', inventory.status === 'COMPLETE'
    && inventory.openBlockers?.length === 0
    && inventory.openRequirements?.join(',') === 'B4-08,B4-09,B4-10,B4-11,B4-12,B4-13,B4-14'
    && inventory.openRequirements.every((id) => {
      const requirement = registry.requirements?.find((item) => item.id === id);
      return requirement?.status === 'COMPLETE' && allChainTrue(requirement);
    }));
  check('scope is last-four-only and claims no bank execution', scope.card?.fullPanStored === false
    && scope.card?.onlyLastFourStored === true
    && scope.card?.bankPaymentExecutionPerformed === false
    && scope.card?.automaticPaymentModeIsTrackingOnly === true);
  check('domain exposes exact payment-card types and create/view contracts', includesAll(domain, [
    'PAYMENT_CARD_KINDS', 'PAYMENT_CARD_NETWORKS', 'PAYMENT_CARD_FORM_FACTORS',
    'PAYMENT_CARD_AUTOMATIC_PAYMENT_MODES', 'PAYMENT_CARD_STATUSES',
    'PaymentCardView', 'CreatePaymentCardInput'
  ]));
  check('domain covers B4-05 limit debt statement and due fields', includesAll(domain, [
    'institutionCode:string', 'productName:string', 'network:PaymentCardNetwork', 'last4:string',
    'creditLimit:number', 'availableLimit:number', 'currentDebt:number', 'statementBalance:number',
    'statementClosingAt:string', 'paymentDueAt:string'
  ]));
  check('domain covers B4-06 installment form factor payment reward fee and alerts', includesAll(domain, [
    'formFactor:PaymentCardFormFactor', 'activeInstallmentCount:number', 'installmentOutstandingAmount:number',
    'automaticPaymentMode:PaymentCardAutomaticPaymentMode', 'rewardPoints:number', 'rewardMiles:number',
    'annualFeeAmount:number', 'alertsEnabled:boolean', 'utilizationAlertBasisPoints:number', 'paymentDueAlertDays:number'
  ]));
  check('card contract has an exact field set and repeats secret inspection', includesAll(bankingSecurity, [
    'PAYMENT_CARD_INPUT_KEYS', 'allowedPaymentCardFieldNames', 'inspectPaymentCardDataContract',
    "inspectProhibitedBankingSecrets(record, ['productName'])"
  ]));
  check('card contract rejects canonical secret fields and Luhn-valid PAN values', includesAll(bankingSecurity, [
    'PROHIBITED_BANKING_SECRET_FIELDS', 'isProhibitedBankingSecretField', 'containsLikelyFullPan', 'luhnValid'
  ]));
  check('application validates last four and never accepts a complete PAN', includesAll(application, [
    'class CreatePaymentCardUseCase', "!/^\\d{4}$/u.test(input.command.last4)",
    'Tam PAN, kart numarası, CVV/CVC, PIN ve internet bankacılığı parolası kart sözleşmesinde kesinlikle kabul edilmez.'
  ]));
  check('application validates finite summaries limit relation installment pairing and dates', includesAll(application, [
    'finiteMoney', 'availableLimit > input.command.creditLimit', 'activeInstallmentCount === 0',
    'paymentDueAt.value < statementClosingAt.value', 'Yıllık ücret pozitifse ücret tarihi zorunludur.'
  ]));
  check('application requires person institution authorization and finance policy write', includesAll(application, [
    'scope.findPerson(ownerPersonId)', 'scope.findBankInstitution(institutionCode)',
    "capability: 'finance.write'", "resourceType: 'finance_record'", 'scope.authorize', 'scope.insertPaymentCard(card)'
  ]));
  const eventSlice = application.slice(application.indexOf("eventType: 'finance.payment_card.created'"));
  check('card audit and outbox omit last four and financial summaries', includesAll(application, [
    "action: 'finance.payment_card.created'", "eventType: 'finance.payment_card.created'"
  ]) && !/payload:\s*\{[\s\S]{0,600}\b(?:last4|creditLimit|availableLimit|currentDebt|statementBalance)\b/u.test(eventSlice));
  check('repository contract carries typed payment-card rows and operations', includesAll(repositoryContract, [
    'PaymentCardRow', 'NewPaymentCardRow', 'listPaymentCards', 'insertPaymentCard'
  ]));
  check('repository maps all B4-05 and B4-06 tracked values', includesAll(repository, [
    'mapPaymentCard', 'creditLimit: Number(row.credit_limit)', 'statementBalance: Number(row.statement_balance)',
    'activeInstallmentCount: Number(row.active_installment_count)', 'automaticPaymentMode:',
    'rewardPoints: Number(row.reward_points)', 'annualFeeAmount: Number(row.annual_fee_amount)',
    'utilizationAlertBasisPoints: Number(row.utilization_alert_basis_points)'
  ]));
  check('sensitive inventory counts cards as last-four-only', aiRepository.includes('SELECT COUNT(*) FROM payment_cards')
    && aiRepository.includes('Kart (son dört hane)')
    && !/fieldNames:\[[^\]]*(?:PAN|CVV|PIN)/iu.test(aiRepository));
  check('person lifecycle deletion inspection includes payment cards', personLifecycleRepository.includes(
    'paymentCards: `SELECT COUNT(*) AS total FROM payment_cards WHERE owner_person_id=?`'));
  check('migration 79 remains the exact payment-card predecessor baseline', migrationVersions.includes(79)
    && Math.max(...migrationVersions) >= 79
    && migrations.includes("createMigrationDefinition(79, 'b4_payment_card_management', paymentCardManagementSql)"));
  check('payment-card schema contains only last four and no prohibited secret columns', cardSchema.length > 0
    && cardSchema.includes('last4 TEXT NOT NULL')
    && !/\b(?:pan|full_pan|card_number|cvv|cvc|pin|password|internet_banking_password)\b/iu.test(cardSchema));
  check('schema fixes card kind network form factor status and privacy enums', includesAll(cardSchema, [
    "kind IN ('credit','debit','prepaid')", "form_factor IN ('physical','virtual','supplementary')",
    "automatic_payment_mode IN ('none','minimum','full')", "status IN ('active','frozen','closed')",
    "privacy IN ('private','selected_members','family')"
  ]));
  check('schema constrains finance summaries, dates, installments, fees and alerts', includesAll(cardSchema, [
    'available_limit<=credit_limit', 'datetime(payment_due_at)>=datetime(statement_closing_at)',
    'active_installment_count BETWEEN 0 AND 999', 'annual_fee_amount>0',
    'utilization_alert_basis_points BETWEEN 1 AND 10000', 'payment_due_alert_days BETWEEN 0 AND 365'
  ]));
  check('migration requires an unused exact durable finance receipt', includesAll(cardMigration, [
    'trg_b4_payment_card_insert_policy_receipt', "receipt.resource_type='finance_record'",
    "receipt.action='create'", "receipt.capability='finance.write'",
    'payment card write requires an unused exact durable finance policy receipt'
  ]));
  check('migration prevents receipt reuse across all finance owners', includesAll(cardMigration, [
    'FROM finance_records WHERE policy_receipt_hash=NEW.policy_receipt_hash',
    'FROM finance_valuations WHERE policy_receipt_hash=NEW.policy_receipt_hash',
    'FROM bank_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash',
    'trg_b4_finance_record_card_receipt_reuse', 'trg_b4_finance_valuation_card_receipt_reuse',
    'trg_b4_bank_account_card_receipt_reuse'
  ]));
  check('migration blocks direct mutation and deletion', includesAll(cardMigration, [
    'trg_b4_payment_card_immutable', 'trg_b4_payment_card_delete_guard'
  ]));
  check('production adapter applies governed list filtering and insert', includesAll(adapter, [
    'listPaymentCards', 'insertPaymentCard', 'executeGoverned', 'governedRepositoryContext',
    'cards.value.filter', "resourceType: 'finance_record'"
  ]));
  check('DataStore composes both reviewed payment-card use cases', includesAll(dataStore, [
    'ListPaymentCardsUseCase', 'CreatePaymentCardUseCase', '#listPaymentCardsUseCase',
    '#createPaymentCardUseCase', 'payment-card-create'
  ]));
  check('main and preload bind the two exact payment-card channels', channels.every((channel) =>
    main.includes(channel) && preload.includes(channel)));
  check('IPC validates exact card payload and secret values before dispatch', includesAll(ipcPolicy, [
    'paymentCardInput', 'PAYMENT_CARD_INPUT_KEYS', 'BANKING_SECRET_FIELD_PROHIBITED',
    'BANKING_SECRET_VALUE_PROHIBITED', "['productName']", 'PAYMENT_CARD_ARGUMENT_INVALID'
  ]));
  check('renderer declaration exposes both typed payment-card methods', methods.every((method) => declarations.includes(method)));
  check('finance UI covers B4-05 tracked card fields and last-four truth', includesAll(renderer, [
    'Yeni kart profili', 'Son dört hane', 'Toplam limit', 'Kullanılabilir limit',
    'Güncel borç', 'Ekstre borcu', 'Son ödeme tarihi', '•••• {card.last4}'
  ]));
  check('finance UI covers B4-06 installments forms rewards fees and alerts', includesAll(renderer, [
    'Aktif taksit sayısı', 'Kalan taksit tutarı', 'Sanal', 'Ek kart', 'Otomatik ödeme',
    'Puan', 'Mil', 'Yıllık ücret', 'Limit kullanım uyarısı', 'Son ödeme uyarısı'
  ]));
  check('UI states automatic payment is tracking only and no bank execution occurs', includesAll(renderer, [
    'Otomatik ödeme alanı yalnız takip modudur', 'banka talimatı veya ödeme işlemi başlatmaz',
    'banka tarafında ödeme işlemi başlatılmadı'
  ]));
  check('targeted tests cover contract IPC persistence receipts and no-card-data payload', includesAll(applicationTest, [
    'last-four-only aggregate contract', 'Luhn-valid full PAN', 'before opening a finance transaction'
  ]) && includesAll(ipcTest, ['exact typed create contract', 'BANKING_SECRET_FIELD_PROHIBITED', 'PAYMENT_CARD_ARGUMENT_INVALID'])
    && includesAll(dataStoreTest, ['B4-05/B4-06 kart zincirini', 'PRAGMA table_info(payment_cards)',
      'finance.payment_card.created', 'unused exact durable finance policy receipt']));
  check('decision and threat model preserve no-bank-execution truth', includesAll(decision, [
    'DEC-212', 'yalnız son dört hane', 'banka talimatı, ödeme veya para', 'transferi başlatmaz'
  ]) && includesAll(threatModel, ['Tam kart numarası veya sır girişi', 'Receipt\'siz veya replay yazma',
    'Otomatik ödeme iddiası']));
  check('audit document binds exact evidence triplet and successor scope', includesAll(auditDocument, [
    '33-A-b4-payment-card-management-boundary.json', '33-A-b4-payment-card-management-contract.json',
    '33-A-b4-payment-card-management-runtime.json', 'B4-08', 'banka talimatı veya ödeme işlemi yapılmaz'
  ]));
  check('PPK-021 exact ratchet reviews both new compositions', [
    'CreatePaymentCardUseCase', 'ListPaymentCardsUseCase'
  ].every((symbol) => astKeys.has(`USE_CASE_COMPOSITION|apps/desktop/src/main/data-store.ts|${symbol}`))
    && astGate.status === 'PASS' && astGate.exactAllowlistEntries === 740
    && astGate.directRoleAuthorizationBypasses === 0 && astGate.findings.length === 0);
  check('PPK-022 capability ratchet remains unchanged and green', capabilityGate.status === 'PASS'
    && capabilityGate.capabilitySurfaces === 345
    && capabilityGate.exactManifestSurfaces === 345
    && capabilityGate.findings.length === 0);
  check('root lifecycle and explicit package scripts bind 33-A', ['pretypecheck', 'prebuild'].every((name) =>
    rootPackage.scripts?.[name]?.includes('verify-b4-payment-card-management-boundary.mjs'))
    && ['verify:b4-cards:boundary', 'verify:b4-cards:targeted', 'verify:b4-cards:contract', 'verify:b4-cards:runtime']
      .every((name) => typeof rootPackage.scripts?.[name] === 'string'));

  return Object.freeze({
    schemaVersion: 1,
    step: '33-A',
    requirements: Object.freeze(['B4-05', 'B4-06']),
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checksPassed: checks.filter((item) => item.passed).length,
    checksFailed: failures.length,
    checks: Object.freeze(checks),
    failures: Object.freeze(failures),
    latestDatabaseMigration: Math.max(...migrationVersions),
    ppk021ExactAllowlistEntries: astGate.exactAllowlistEntries,
    ppk022CapabilitySurfaces: capabilityGate.capabilitySurfaces,
    prohibitedSecretColumns: 0,
    bankExecutionPerformed: false,
    generatedAt: new Date().toISOString()
  });
};

const report = await verifyB4PaymentCardManagementBoundary();
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/33-A-b4-payment-card-management-boundary.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`B4 payment card management boundary: ${report.status} (${report.checksPassed}/${report.checks.length} checks).`);
if (report.failures.length) {
  console.error(report.failures.join('\n'));
  process.exitCode = 1;
}
