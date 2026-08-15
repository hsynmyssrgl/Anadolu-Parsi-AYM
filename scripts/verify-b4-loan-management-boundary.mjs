import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { runPlatformPolicyAstGate } from './verify-platform-policy-ast-gate.mjs';
import { runPlatformCapabilityManifestGate } from './verify-platform-capability-manifest-gate.mjs';

const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const allChainTrue = (requirement) => Object.values(requirement?.chain ?? {}).length === 13
  && Object.values(requirement.chain).every((value) => value === true);

export const verifyB4LoanManagementBoundary = async () => {
  const [
    scope, inventory, registry, domain, bankingSecurity, application, repositoryContract,
    repository, aiRepository, personLifecycleRepository, migrations, policyRuntime,
    adapter, dataStore, main, ipcPolicy, preload, declarations, renderer, rootPackage,
    applicationTest, ipcTest, dataStoreTest, decision, threatModel, auditDocument,
    astAllowlist, astGate, capabilityGate
  ] = await Promise.all([
    json('config/33-b-b4-loan-management-scope.json'),
    json('config/33-b-b4-loan-management-inventory.json'),
    json('config/accepted-scope-registry.json'),
    text('packages/domain/src/app-data.ts'),
    text('packages/application/src/banking-security.ts'),
    text('packages/application/src/finance-use-cases.ts'),
    text('packages/repository-contracts/src/finance-repository.ts'),
    text('packages/repositories/src/finance-repository.ts'),
    text('packages/repositories/src/ai-consent-repository.ts'),
    text('packages/repositories/src/person-lifecycle-repository.ts'),
    text('packages/database/src/family-database-migrations.ts'),
    text('apps/desktop/src/main/finance-production-policy-runtime.ts'),
    text('apps/desktop/src/main/finance-application-adapter.ts'),
    text('apps/desktop/src/main/data-store.ts'),
    text('apps/desktop/src/main/main.ts'),
    text('apps/desktop/src/main/ipc-integration-policy.ts'),
    text('apps/desktop/src/main/preload.ts'),
    text('apps/desktop/src/renderer/global.d.ts'),
    text('apps/desktop/src/renderer/App.tsx'),
    json('package.json'),
    text('packages/application/tests/loan-management.test.ts'),
    text('apps/desktop/tests/b4-loan-management-ipc-integration.test.ts'),
    text('apps/desktop/tests/data-store.test.ts'),
    text('docs/decisions/DEC-213-b4-loan-management.md'),
    text('docs/security/B4_LOAN_MANAGEMENT_THREAT_MODEL.md'),
    text('docs/audit/33-B_B4_LOAN_MANAGEMENT_UST_KAPANIS.md'),
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
  const migrationStart = migrations.indexOf('const loanManagementSql =');
  const migrationEnd = migrations.indexOf('export const FAMILY_DATABASE_MIGRATIONS');
  const loanMigration = migrationStart >= 0 && migrationEnd > migrationStart
    ? migrations.slice(migrationStart, migrationEnd)
    : '';
  const astKeys = new Set(astAllowlist.allowedSurfaceKeys ?? []);
  const channels = ['finance:listLoanAccounts', 'finance:createLoanAccount', 'finance:recordLoanPayment'];
  const methods = ['listLoanAccounts', 'createLoanAccount', 'recordLoanPayment'];

  check('scope closes exactly B4-08 and B4-09 under DEC-213', scope.status === 'COMPLETE'
    && scope.decision === 'DEC-213' && scope.requirements?.join(',') === 'B4-08,B4-09');
  check('inventory preserves historical-at-closure B4-10 through B4-14 scope and current successors complete it', inventory.status === 'COMPLETE'
    && inventory.openBlockers?.length === 0
    && inventory.openRequirements?.join(',') === 'B4-10,B4-11,B4-12,B4-13,B4-14'
    && inventory.openRequirements.every((id) => {
      const requirement = registry.requirements?.find((item) => item.id === id);
      return requirement?.status === 'COMPLETE' && allChainTrue(requirement);
    }));
  check('scope preserves manual unverified non-executing truth', scope.loan?.dataSource === 'manual'
    && scope.loan?.bankVerification === 'not_performed'
    && scope.loan?.paymentExecution === 'not_performed'
    && scope.loan?.remoteSynchronizationPerformed === false
    && scope.paymentHistory?.bankTransferPerformed === false
    && scope.paymentHistory?.automaticallyChangesRemainingPrincipal === false);
  check('domain exposes exact loan enums and aggregate contracts', includesAll(domain, [
    'LOAN_KINDS', 'LOAN_RATE_TYPES', 'LOAN_STATUSES', 'LOAN_INSURANCE_STATUSES',
    'LOAN_COLLATERAL_TYPES', 'LoanAccountView', 'CreateLoanAccountInput',
    'LoanPaymentScheduleItemView', 'LoanPaymentHistoryItemView', 'RecordLoanPaymentInput'
  ]));
  check('domain covers B4-08 rate term principal installment and schedule', includesAll(domain, [
    'annualRateBasisPoints:number', 'termMonths:number', 'originalPrincipal:number',
    'installmentAmount:number', 'remainingPrincipal:number', 'paymentSchedule:readonly LoanPaymentScheduleItemView[]'
  ]));
  check('domain covers B4-09 settlement overdue insurance collateral and history', includesAll(domain, [
    'earlySettlementAmount:number', 'overdueInstallmentCount:number', 'overdueAmount:number',
    'daysPastDue:number', 'insuranceStatus:LoanInsuranceStatus', 'collateralType:LoanCollateralType',
    'paymentHistory:readonly LoanPaymentHistoryItemView[]'
  ]));
  check('loan and payment contracts use exact top-level field sets', includesAll(bankingSecurity, [
    'LOAN_ACCOUNT_INPUT_KEYS', 'LOAN_PAYMENT_INPUT_KEYS', 'allowedLoanAccountFieldNames',
    'allowedLoanPaymentFieldNames', 'inspectLoanAccountDataContract', 'inspectLoanPaymentDataContract'
  ]));
  check('contracts reject canonical secrets and Luhn-valid PAN values', includesAll(bankingSecurity, [
    'PROHIBITED_BANKING_SECRET_FIELDS', 'isProhibitedBankingSecretField',
    'containsLikelyFullPan', "'title'", "'insuranceProvider'", "'insurancePolicyReference'",
    "'collateralDescription'", "inspectProhibitedBankingSecrets(record, ['notes'])"
  ]));
  check('application rejects invalid rate term amount status and overdue coherence', includesAll(application, [
    'class CreateLoanAccountUseCase', 'annualRateBasisPoints > 100_000',
    'termMonths > 600', 'moneyValues.every(finiteMoney)', "status === 'overdue'", 'hasOverdue'
  ]));
  check('application validates settlement insurance collateral and date relationships', includesAll(application, [
    'earlySettlementQuotedAt', "insuranceStatus === 'none'", "collateralType === 'none'",
    'firstPaymentAt.value < disbursedAt.value', 'addCalendarMonths(firstPaymentAt.value, input.command.termMonths - 1)'
  ]));
  check('application generates a month-end-safe bounded local schedule', includesAll(application, [
    'const addCalendarMonths', 'target.setUTCDate(1)', 'Math.min(originalDay, lastDay)',
    'Array.from({ length: input.command.termMonths }', 'scheduledAmount: input.command.installmentAmount'
  ]));
  check('payment history enforces component-exact total chronology and term bounds', includesAll(application, [
    'class RecordLoanPaymentUseCase', 'equalMoney(input.command.amount',
    'paidAt.value < loan.value.disbursedAt', 'scheduledInstallmentSequence > loan.value.termMonths'
  ]));
  check('loan writes require owner institution authorization and finance policy', includesAll(application, [
    'scope.findPerson(ownerPersonId)', 'scope.findBankInstitution(institutionCode)',
    "capability: 'finance.write'", "resourceType: 'finance_record'", 'scope.authorize',
    'scope.insertLoanAccount(loan)', 'scope.insertLoanPayment(payment)'
  ]));
  const loanEventSlice = application.slice(application.indexOf("eventType: 'finance.loan.created'"),
    application.indexOf('export class RecordLoanPaymentUseCase'));
  const paymentEventSlice = application.slice(
    application.indexOf("eventType: 'finance.loan.payment_recorded'"),
    application.indexOf('export class RecordFinancePlanningItemUseCase')
  );
  check('audit and outbox redact money insurance collateral and payment notes', includesAll(application, [
    "action: 'finance.loan.created'", "action: 'finance.loan.payment_recorded'",
    "eventType: 'finance.loan.created'", "eventType: 'finance.loan.payment_recorded'"
  ]) && !/payload:\s*\{[\s\S]*?(?:originalPrincipal|installmentAmount|remainingPrincipal|earlySettlementAmount|insurancePolicyReference|collateralDescription)/u.test(loanEventSlice)
    && !/payload:\s*\{[\s\S]*?(?:amount|principalAmount|interestAmount|lateFeeAmount|notes)/u.test(paymentEventSlice));
  check('repository contract exposes loan query write and policy resolution ports', includesAll(repositoryContract, [
    'LoanAccountRow', 'LoanPaymentHistoryRow', 'listLoanAccounts', 'findLoanAccount',
    'insertLoanAccount', 'insertLoanPayment', 'findLoanAccountForPolicyResolution'
  ]));
  check('repository loads nested schedule and history and persists both writes', includesAll(repository, [
    'mapLoanPaymentScheduleItem', 'mapLoanPaymentHistoryItem', 'mapLoanAccount',
    'FROM loan_payment_schedule', 'FROM loan_payment_history', 'INSERT INTO loan_accounts(',
    'INSERT INTO loan_payment_schedule(', 'INSERT INTO loan_payment_history('
  ]));
  check('finance production policy resolves loan create collisions and update ownership', includesAll(policyRuntime, [
    'findLoanAccountForPolicyResolution', 'existing.value || existingLoan.value',
    'const resourceRecord = record.value ?? loan.value'
  ]));
  check('sensitive inventory and person lifecycle include loan records', aiRepository.includes('SELECT COUNT(*) FROM loan_accounts')
    && aiRepository.includes('SELECT COUNT(*) FROM loan_payment_history')
    && personLifecycleRepository.includes('loanAccounts: `SELECT COUNT(*) AS total FROM loan_accounts')
    && personLifecycleRepository.includes('loanPayments: `SELECT COUNT(*) AS total FROM loan_payment_history'));
  check('migration 80 remains an exact predecessor baseline', migrationVersions.includes(80)
    && Math.max(...migrationVersions) >= 80
    && migrations.includes("createMigrationDefinition(80, 'b4_loan_management', loanManagementSql)"));
  check('migration creates all three loan tables without prohibited secret columns', includesAll(loanMigration, [
    'CREATE TABLE loan_accounts(', 'CREATE TABLE loan_payment_schedule(', 'CREATE TABLE loan_payment_history('
  ]) && !/\b(?:pan|full_pan|card_number|cvv|cvc|pin|password|internet_banking_password)\b/iu.test(loanMigration));
  check('schema fixes loan status insurance collateral and payment component coherence', includesAll(loanMigration, [
    "kind IN ('consumer','mortgage','vehicle','other')", "rate_type IN ('fixed','variable','profit_share','interest_free')",
    "status IN ('active','overdue','restructured','closed')", "insurance_status IN ('none','active','expired','cancelled')",
    "collateral_type IN ('none','vehicle','real_estate','deposit','guarantee','other')",
    'CHECK(abs(amount-(principal_amount+interest_amount+late_fee_amount))<0.005)'
  ]));
  check('schedule rows are parent-bound and all aggregates are immutable or append-only', includesAll(loanMigration, [
    'trg_b4_loan_schedule_parent_guard', 'trg_b4_loan_account_immutable',
    'trg_b4_loan_schedule_immutable', 'trg_b4_loan_payment_immutable',
    'trg_b4_loan_account_delete_guard', 'trg_b4_loan_schedule_delete_guard', 'trg_b4_loan_payment_delete_guard'
  ]));
  check('migration requires exact create and update finance receipts', includesAll(loanMigration, [
    'trg_b4_loan_account_insert_policy_receipt', 'trg_b4_loan_payment_insert_policy_receipt',
    "receipt.action='create'", "receipt.action='update'", "receipt.capability='finance.write'",
    'unused exact durable finance policy receipt'
  ]));
  check('migration prevents receipt replay across finance records cards and loans', includesAll(loanMigration, [
    'FROM finance_records WHERE policy_receipt_hash=NEW.policy_receipt_hash',
    'FROM finance_valuations WHERE policy_receipt_hash=NEW.policy_receipt_hash',
    'FROM bank_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash',
    'FROM payment_cards WHERE policy_receipt_hash=NEW.policy_receipt_hash',
    'FROM loan_accounts WHERE policy_receipt_hash=NEW.policy_receipt_hash',
    'FROM loan_payment_history WHERE policy_receipt_hash=NEW.policy_receipt_hash'
  ]));
  check('production adapter applies governed list filtering and both inserts', includesAll(adapter, [
    'listLoanAccounts', 'insertLoanAccount', 'insertLoanPayment', 'executeGoverned',
    'governedRepositoryContext', 'loans.value.filter'
  ]));
  check('DataStore composes all three reviewed loan use cases', includesAll(dataStore, [
    'ListLoanAccountsUseCase', 'CreateLoanAccountUseCase', 'RecordLoanPaymentUseCase',
    '#listLoanAccountsUseCase', '#createLoanAccountUseCase', '#recordLoanPaymentUseCase',
    'loan-account-create', 'loan-payment-record'
  ]));
  check('main and preload bind the three exact loan channels', channels.every((channel) =>
    main.includes(channel) && preload.includes(channel)));
  check('IPC validates exact loan and payment payloads before dispatch', includesAll(ipcPolicy, [
    'loanAccountInput', 'loanPaymentInput', 'LOAN_ACCOUNT_INPUT_KEYS', 'LOAN_PAYMENT_INPUT_KEYS',
    'BANKING_SECRET_FIELD_PROHIBITED', 'BANKING_SECRET_VALUE_PROHIBITED',
    'LOAN_ACCOUNT_ARGUMENT_INVALID', 'LOAN_PAYMENT_ARGUMENT_INVALID'
  ]));
  check('renderer declaration exposes all typed loan methods', methods.every((method) => declarations.includes(method)));
  check('finance UI covers B4-08 loan profile rate term principal and schedule', includesAll(renderer, [
    'Yeni kredi profili', 'Kredi türü', 'Oran türü', 'Yıllık oran', 'Vade',
    'İlk anapara', 'Aylık taksit', 'Kalan anapara', 'ödeme planı'
  ]));
  check('finance UI covers B4-09 settlement overdue insurance collateral and history', includesAll(renderer, [
    'Erken kapama', 'Gecikmiş taksit', 'Gecikmiş tutar', 'Sigorta', 'Teminat',
    'ödeme geçmişi', 'Ödeme geçmişine ekle'
  ]));
  check('UI states manual unverified no-bank-execution truth', includesAll(renderer, [
    'manuel takip', 'banka tarafından doğrulanmaz', 'bankaya para göndermez',
    'kalan anaparayı otomatik değiştirmez'
  ]));
  check('targeted tests cover contracts IPC plan persistence receipts and redaction', includesAll(applicationTest, [
    '33-B B4-08/B4-09 loan management', 'Luhn-valid PAN', 'month-end-safe plan',
    'component-exact total', 'before opening a transaction'
  ]) && includesAll(ipcTest, ['33-B B4-08/B4-09 loan IPC boundary', 'UNKNOWN_OBJECT_FIELD',
    'LOAN_ACCOUNT_ARGUMENT_INVALID', 'LOAN_PAYMENT_ARGUMENT_INVALID'])
    && includesAll(dataStoreTest, ['B4-08/B4-09 kredi zincirini', 'PRAGMA table_info(loan_accounts)',
      'loan_payment_schedule', 'finance.loan.payment_recorded', 'unused exact durable finance policy receipt']));
  check('decision and threat model preserve no-bank-execution truth', includesAll(decision, [
    'DEC-213', 'kaynağı manueldir', 'ödeme göndermez', "537'den 540'a"
  ]) && includesAll(threatModel, ['Bilinmeyen alan veya bankacılık sırrı girişi',
    "Receipt'siz veya replay yazma", 'Geçmişin değiştirilmesi', 'Banka işlemi yapıldığı iddiası']));
  check('audit binds exact evidence triplet and successor scope', includesAll(auditDocument, [
    '33-B-b4-loan-management-boundary.json', '33-B-b4-loan-management-contract.json',
    '33-B-b4-loan-management-runtime.json', 'B4-10', 'bankaya para göndermez'
  ]));
  check('PPK-021 exact ratchet reviews all three new compositions', [
    'CreateLoanAccountUseCase', 'ListLoanAccountsUseCase', 'RecordLoanPaymentUseCase'
  ].every((symbol) => astKeys.has(`USE_CASE_COMPOSITION|apps/desktop/src/main/data-store.ts|${symbol}`))
    && astGate.status === 'PASS' && astGate.exactAllowlistEntries === 699
    && astGate.surfaceCounts?.USE_CASE_COMPOSITION === 337
    && astGate.directRoleAuthorizationBypasses === 0 && astGate.findings.length === 0);
  check('PPK-022 capability ratchet remains unchanged and green', capabilityGate.status === 'PASS'
    && capabilityGate.capabilitySurfaces === 345
    && capabilityGate.exactManifestSurfaces === 345
    && capabilityGate.findings.length === 0);
  check('root lifecycle and explicit package scripts bind 33-B', ['pretypecheck', 'prebuild'].every((name) =>
    rootPackage.scripts?.[name]?.includes('verify-b4-loan-management-boundary.mjs'))
    && ['verify:b4-loans:boundary', 'verify:b4-loans:targeted', 'verify:b4-loans:contract', 'verify:b4-loans:runtime']
      .every((name) => typeof rootPackage.scripts?.[name] === 'string'));

  return Object.freeze({
    schemaVersion: 1,
    step: '33-B',
    requirements: Object.freeze(['B4-08', 'B4-09']),
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checksPassed: checks.filter((item) => item.passed).length,
    checksFailed: failures.length,
    checks: Object.freeze(checks),
    failures: Object.freeze(failures),
    latestDatabaseMigration: Math.max(...migrationVersions),
    ppk021ExactAllowlistEntries: astGate.exactAllowlistEntries,
    ppk021UseCaseCompositionSurfaces: astGate.surfaceCounts?.USE_CASE_COMPOSITION,
    ppk022CapabilitySurfaces: capabilityGate.capabilitySurfaces,
    prohibitedSecretColumns: 0,
    bankVerificationPerformed: false,
    bankExecutionPerformed: false,
    generatedAt: new Date().toISOString()
  });
};

const report = await verifyB4LoanManagementBoundary();
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/33-B-b4-loan-management-boundary.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`B4 loan management boundary: ${report.status} (${report.checksPassed}/${report.checks.length} checks).`);
if (report.failures.length) {
  console.error(report.failures.join('\n'));
  process.exitCode = 1;
}
