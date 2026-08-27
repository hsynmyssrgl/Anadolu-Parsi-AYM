import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { runPlatformPolicyAstGate } from './verify-platform-policy-ast-gate.mjs';
import { runPlatformCapabilityManifestGate } from './verify-platform-capability-manifest-gate.mjs';

const cliArguments = process.argv.slice(2);
if (cliArguments.length > 1 || cliArguments.some((argument) => argument !== '--no-write')) {
  throw new Error('Unsupported B4 finance planning portfolio analytics boundary argument.');
}
const noWrite = process.argv.includes('--no-write');
const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const allChainTrue = (requirement) => Object.values(requirement?.chain ?? {}).length === 13
  && Object.values(requirement.chain).every((value) => value === true);

export const verifyB4FinancePlanningPortfolioAnalyticsBoundary = async () => {
  const [
    scope, inventory, registry, domain, bankingSecurity, application, repositoryContract,
    repository, aiRepository, personLifecycleRepository, migrations, policyRuntime,
    adapter, dataStore, main, ipcPolicy, preload, declarations, appRenderer,
    planningRenderer, rootPackage, applicationTest, ipcTest, dataStoreTest, decision,
    threatModel, auditDocument, astAllowlist, astGate, capabilityGate
  ] = await Promise.all([
    json('config/33-c-b4-finance-planning-portfolio-analytics-scope.json'),
    json('config/33-c-b4-finance-planning-portfolio-analytics-inventory.json'),
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
    text('apps/desktop/src/renderer/FinancePlanningPanel.tsx'),
    json('package.json'),
    text('packages/application/tests/finance-planning-portfolio-analytics.test.ts'),
    text('apps/desktop/tests/b4-finance-planning-ipc-integration.test.ts'),
    text('apps/desktop/tests/data-store.test.ts'),
    text('docs/decisions/DEC-214-b4-finance-planning-portfolio-analytics.md'),
    text('docs/security/THREAT_MODEL_33_C_B4_FINANCE_PLANNING_PORTFOLIO_ANALYTICS.md'),
    text('docs/audit/33-C_B4_FINANCE_PLANNING_PORTFOLIO_ANALYTICS_UST_KAPANIS.md'),
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
  const migrationStart = migrations.indexOf('const financePlanningLedgerSql =');
  const migrationEnd = migrations.indexOf('export const FAMILY_DATABASE_MIGRATIONS');
  const planningMigration = migrationStart >= 0 && migrationEnd > migrationStart
    ? migrations.slice(migrationStart, migrationEnd)
    : '';
  const tableDefinition = planningMigration.match(/CREATE TABLE finance_planning_ledger\(([\s\S]*?)\n\);/u)?.[1] ?? '';
  const persistedColumns = [...tableDefinition.matchAll(/^\s*([a-z_]+)\s+(?:TEXT|INTEGER|REAL)\b/gmu)]
    .map((match) => match[1]);
  const prohibitedNames = new Set(['pan','full_pan','card_number','cvv','cvc','pin','password','internet_banking_password']);
  const prohibitedSecretColumns = persistedColumns.filter((name) => prohibitedNames.has(name)).length;
  const astKeys = new Set(astAllowlist.allowedSurfaceKeys ?? []);
  const itemTypes = ['category','cash_flow','budget','recurring_rule','recurring_state','goal','goal_progress','asset','asset_valuation'];
  const assetClasses = ['cash','deposit','precious_metal_fx','investment','pension','real_estate','vehicle'];
  const channels = ['finance:getPlanningWorkspace', 'finance:recordPlanningItem'];
  const methods = ['getFinancePlanningWorkspace', 'recordFinancePlanningItem'];

  check('scope closes exactly B4-10 B4-11 and B4-12 under DEC-214', scope.status === 'COMPLETE'
    && scope.decision === 'DEC-214' && scope.requirements?.join(',') === 'B4-10,B4-11,B4-12');
  check('inventory preserves historical-at-closure B4-13/B4-14 scope and 33-D completes the current successors', inventory.status === 'COMPLETE'
    && inventory.openBlockers?.length === 0 && inventory.openRequirements?.join(',') === 'B4-13,B4-14'
    && inventory.successorCompletion?.step === '33-D' && inventory.successorCompletion?.status === 'COMPLETE'
    && inventory.openRequirements.every((id) => {
      const requirement = registry.requirements?.find((item) => item.id === id);
      return requirement?.status === 'COMPLETE' && allChainTrue(requirement);
    }));
  check('scope preserves manual no-FX no-price no-sync no-execution truth', scope.planningLedger?.dataSource === 'manual'
    && scope.planningLedger?.externalVerification === 'not_performed'
    && scope.planningLedger?.remoteSynchronizationPerformed === false
    && scope.portfolio?.externalPricing === 'not_performed'
    && scope.analytics?.crossCurrencyAggregationPerformed === false
    && scope.analytics?.paymentExecution === 'not_performed');
  check('domain exposes all nine planning ledger discriminants', includesAll(domain, [
    'FINANCE_PLANNING_ITEM_TYPES', 'FinancePlanningLedgerItemView', 'RecordFinancePlanningItemInput'
  ]) && itemTypes.every((itemType) => domain.includes(`'${itemType}'`)));
  check('domain covers categories cash flow budgets recurrence and goals', includesAll(domain, [
    'FinanceCategoryView', 'FinanceCashFlowEntryView', 'FinanceBudgetRevisionView',
    'FinanceRecurringRuleView', 'FinanceGoalView', 'completionBasisPoints:number'
  ]));
  check('domain covers all seven portfolio classes and append-only valuations', includesAll(domain, [
    'FinancePortfolioAssetLedgerView', 'FinancePortfolioValuationView', 'valuationHistory:readonly FinancePortfolioValuationView[]'
  ]) && assetClasses.every((assetClass) => domain.includes(`'${assetClass}'`)));
  check('domain exposes per-currency family person analytics and honest truth fields', includesAll(domain, [
    'FinanceCurrencySummaryView', 'FinanceBudgetVarianceView', 'FinanceUpcomingPaymentView',
    "scope:'family'|'person'", 'crossCurrencyAggregationPerformed:false', "externalPricing:'not_performed'",
    "bankSynchronization:'not_performed'", "paymentExecution:'not_performed'"
  ]));
  check('all planning commands use exact discriminated key sets', includesAll(bankingSecurity, [
    'FINANCE_PLANNING_INPUT_KEYS', 'financePlanningPanSearchFields', 'inspectFinancePlanningDataContract'
  ]) && itemTypes.every((itemType) => bankingSecurity.includes(`${itemType}: Object.freeze(`)));
  check('planning contracts reject canonical secrets and Luhn-valid PAN text', includesAll(bankingSecurity, [
    'PROHIBITED_BANKING_SECRET_FIELDS', 'containsLikelyFullPan', "goal_progress: Object.freeze(['note'])",
    "asset: Object.freeze(['name','note'])"
  ]));
  check('workspace derives latest state progress valuation and latest budget revision', includesAll(application, [
    'stateHistory[0]?.status', 'progressHistory[0]?.currentAmount', 'valuationHistory[0]',
    'latestBudgetByKey', 'budgetVariances'
  ]));
  check('workspace computes separate-currency net worth debt ratio and cash flow', includesAll(application, [
    'const summarize = (ownerPersonId?: string)', 'netWorth: roundMoney(assetValue - liabilityValue)',
    'debtRatioBasisPoints', 'cashFlowBalance', 'crossCurrencyAggregationPerformed: false'
  ]));
  check('workspace combines all five upcoming sources without executing payments', includesAll(application, [
    "source: 'payment_card'", "source: 'loan'", "source: 'finance_record'", "source: 'recurring_rule'",
    "source: 'planned_cash_flow'", "paymentExecution: 'not_performed'", '.slice(0, 250)'
  ]));
  check('write use case validates every discriminant before the transaction', includesAll(application, [
    'class RecordFinancePlanningItemUseCase', 'const contractError = financePlanningContractError',
    "case 'category':", "case 'cash_flow':", "case 'budget':", "case 'recurring_rule':",
    "case 'recurring_state':", "case 'goal':", "case 'goal_progress':", "case 'asset':", "case 'asset_valuation':"
  ]));
  check('child records require exact parent type and inherit owner privacy', includesAll(application, [
    'scope.findPlanningItem(parentId!)', 'ownerPersonId = found.value.ownerPersonId',
    'privacy = found.value.privacy', 'found.value.itemType !== expectedParent'
  ]));
  check('planning writes require central finance authorization and persisted insert', includesAll(application, [
    "capability: 'finance.write'", "resourceType: 'finance_record'", 'scope.authorize({',
    'scope.insertPlanningItem(item)'
  ]));
  const planningEventSlice = application.slice(
    application.indexOf("eventType: 'finance.planning.item_recorded'"),
    application.indexOf('export class CommitFinanceImportBatchUseCase')
  );
  check('planning audit and outbox redact amounts descriptions notes and values', includesAll(application, [
    "action: `finance.planning.${item.itemType}.recorded`", "eventType: 'finance.planning.item_recorded'"
  ]) && !/(?:amount|description|note|targetAmount|currentAmount|unitValue|marketValue)\s*:/u.test(planningEventSlice));
  check('repository contract exposes planning read write and policy resolution ports', includesAll(repositoryContract, [
    'FinancePlanningLedgerItemRow', 'NewFinancePlanningLedgerItemRow', 'listPlanningItems',
    'findPlanningItem', 'insertPlanningItem', 'findPlanningItemForPolicyResolution'
  ]));
  check('repository maps all nine rows and persists the exact 39-column ledger', includesAll(repository, [
    'const mapFinancePlanningItem', 'FROM finance_planning_ledger', 'INSERT INTO finance_planning_ledger(',
    'Array.from({ length: 39 }', 'financeWriteBinding(context, parentItemId ?? row.id, action)'
  ]) && itemTypes.every((itemType) => repository.includes(`case '${itemType}':`)));
  check('sensitive inventory and person lifecycle include planning rows', aiRepository.includes('SELECT COUNT(*) FROM finance_planning_ledger')
    && personLifecycleRepository.includes('financePlanningItems: `SELECT COUNT(*) AS total FROM finance_planning_ledger'));
  check('migration 81 remains present and exact under its successor', Math.max(...migrationVersions) >= 81
    && migrations.includes("createMigrationDefinition(81, 'b4_finance_planning_portfolio_analytics', financePlanningLedgerSql)"));
  check('migration creates one 39-column planning ledger without secret columns', planningMigration.includes('CREATE TABLE finance_planning_ledger(')
    && persistedColumns.length === 39 && prohibitedSecretColumns === 0);
  check('schema fixes item kinds money currency recurrence goals and market value coherence', includesAll(planningMigration, [
    'item_type TEXT NOT NULL CHECK(item_type IN (', "'category','cash_flow','budget','recurring_rule','recurring_state'",
    "frequency IN ('weekly','monthly','quarterly','yearly')", "asset_class IN ('cash','deposit','precious_metal_fx','investment','pension','real_estate','vehicle')",
    'abs(market_value-(quantity*unit_value))<0.005'
  ]));
  check('schema enforces exact compatible parents and inherited family owner privacy', includesAll(planningMigration, [
    'trg_b4_finance_planning_parent_guard', 'parent.family_id=NEW.family_id',
    'parent.owner_person_id=NEW.owner_person_id', 'parent.privacy=NEW.privacy',
    "NEW.item_type='asset_valuation' AND parent.item_type='asset'"
  ]));
  check('migration requires exact create/update finance receipts and rejects cross-finance replay', includesAll(planningMigration, [
    'trg_b4_finance_planning_insert_policy_receipt', "receipt.action=CASE WHEN NEW.parent_item_id IS NULL THEN 'create' ELSE 'update' END",
    "receipt.capability='finance.write'", 'FROM finance_records WHERE policy_receipt_hash=NEW.policy_receipt_hash',
    'FROM payment_cards WHERE policy_receipt_hash=NEW.policy_receipt_hash',
    'FROM loan_payment_history WHERE policy_receipt_hash=NEW.policy_receipt_hash'
  ]));
  check('migration adds reverse replay guards and append-only deletion fences', includesAll(planningMigration, [
    'trg_b4_finance_record_planning_receipt_reuse', 'trg_b4_bank_account_planning_receipt_reuse',
    'trg_b4_payment_card_planning_receipt_reuse', 'trg_b4_loan_account_planning_receipt_reuse',
    'trg_b4_loan_payment_planning_receipt_reuse', 'trg_b4_finance_planning_immutable',
    'trg_b4_finance_planning_delete_guard'
  ]));
  check('production policy resolves planning create collisions and update ownership', includesAll(policyRuntime, [
    'findPlanningItemForPolicyResolution', 'existingPlanningItem.value',
    'const resourceRecord = record.value ?? loan.value ?? planningItem.value'
  ]));
  check('production adapter applies one governed transaction and legacy row filtering', includesAll(adapter, [
    'public async getPlanningWorkspace', 'listPlanningItems(execution)',
    'const visiblePlanningItems = planningItems.value.filter(allowed)', 'buildFinancePlanningWorkspace({',
    'public findPlanningItem', 'public insertPlanningItem'
  ]));
  check('DataStore composes both reviewed planning use cases', includesAll(dataStore, [
    'GetFinancePlanningWorkspaceUseCase', 'RecordFinancePlanningItemUseCase',
    '#getFinancePlanningWorkspaceUseCase', '#recordFinancePlanningItemUseCase',
    'finance-planning-workspace', 'finance-planning-${input.itemType}'
  ]));
  check('main preload and declaration bind the two exact planning methods', channels.every((channel) =>
    main.includes(channel) && preload.includes(channel)) && methods.every((method) => declarations.includes(method)));
  check('IPC uses zero-argument read and exact nine-way write validation', includesAll(ipcPolicy, [
    "case 'finance:getPlanningWorkspace':", 'return zeroArguments(args);',
    "case 'finance:recordPlanningItem':", 'return financePlanningInput(args);',
    'FINANCE_PLANNING_ITEM_TYPE_INVALID', 'UNKNOWN_OBJECT_FIELD', 'FINANCE_PLANNING_ARGUMENT_INVALID'
  ]));
  check('App loads and refreshes the planning workspace inside the existing Finance menu', includesAll(appRenderer, [
    'getFinancePlanningWorkspace()', 'recordFinancePlanningItem(input)', '<FinancePlanningPanel'
  ]));
  check('planning UI exposes all B4-10 budget recurrence and goal modules', includesAll(planningRenderer, [
    'Gelir / gider kategorisi', 'Nakit akışı', 'Aylık bütçe revizyonu', 'Yinelenen işlem',
    'Finansal hedef', 'Bütçe gerçekleşme analizi', 'Kategoriler ve nakit akışı'
  ]));
  check('planning UI exposes all B4-11 portfolio classes and valuation history', includesAll(planningRenderer, [
    'Nakit', 'Mevduat', 'Altın / döviz', 'Yatırım', 'Bireysel emeklilik',
    'Gayrimenkul', 'Araç', 'Portföy değerlemesi', 'Portföy görünümü'
  ]));
  check('planning UI exposes B4-12 family person net debt budget and upcoming views', includesAll(planningRenderer, [
    'Analiz kapsamı', 'Tüm aile', 'Net değer', 'Borç oranı', 'Yaklaşan ödemeler',
    'Bütçe gerçekleşme analizi'
  ]));
  check('UI states manual separate-currency no-price no-sync no-execution truth', includesAll(planningRenderer, [
    'Her para birimi ayrı hesaplanır', 'yapay kur dönüşümü yapılmaz', 'Veri kaynağı manuel',
    'Banka eşitlemesi yapılmadı', 'Dış fiyat doğrulaması yapılmadı', 'Ödeme icrası yapılmadı'
  ]));
  check('targeted tests cover exact contracts inheritance analytics IPC persistence and receipts', includesAll(applicationTest, [
    '33-C B4-10/B4-11/B4-12 finance planning and portfolio analytics',
    'all nine exact contracts', 'inherits child ownership and privacy', 'separate-currency summaries'
  ]) && includesAll(ipcTest, [
    '33-C B4-10/B4-11/B4-12 finance planning IPC boundary', 'all nine exact write contracts',
    'UNKNOWN_OBJECT_FIELD', 'Luhn-valid PAN'
  ]) && includesAll(dataStoreTest, [
    'B4-10/B4-11/B4-12 finans planlama zincirini', 'PRAGMA table_info(finance_planning_ledger)',
    'finance.planning.item_recorded', 'unused exact durable finance policy receipt'
  ]));
  check('decision threat model and audit preserve the exact honesty boundary', includesAll(decision, [
    'DEC-214', 'kaynağı manueldir', 'Para birimleri birbirine çevrilmez', "540'tan 542'ye", "272'den 274'e"
  ]) && includesAll(threatModel, [
    'Bilinmeyen alan veya bankacılık sırrı girişi', 'Üst kayıt ve sahiplik sahteciliği',
    "Receipt'siz veya replay yazma", 'Yanlış kur dönüşümü veya yanıltıcı toplam',
    'Dış fiyat, banka eşitlemesi veya ödeme iddiası'
  ]) && includesAll(auditDocument, [
    'B4-10', 'B4-11', 'B4-12', 'B4-13', 'B4-14',
    '33-C-b4-finance-planning-portfolio-analytics-boundary.json',
    '33-C-b4-finance-planning-portfolio-analytics-contract.json',
    '33-C-b4-finance-planning-portfolio-analytics-runtime.json'
  ]));
  check('PPK-021 exact ratchet reviews both new compositions', [
    'GetFinancePlanningWorkspaceUseCase', 'RecordFinancePlanningItemUseCase'
  ].every((symbol) => astKeys.has(`USE_CASE_COMPOSITION|apps/desktop/src/main/data-store.ts|${symbol}`))
    && astGate.status === 'PASS' && astGate.exactAllowlistEntries === 897
    && astGate.surfaceCounts?.USE_CASE_COMPOSITION === 435
    && astGate.directRoleAuthorizationBypasses === 0 && astGate.findings.length === 0);
  check('PPK-022 capability ratchet remains unchanged and green', capabilityGate.status === 'PASS'
    && capabilityGate.capabilitySurfaces > 0
    && capabilityGate.capabilitySurfaces === capabilityGate.exactManifestSurfaces
    && capabilityGate.findings.length === 0);
  check('root lifecycle and explicit package scripts bind 33-C', ['pretypecheck', 'prebuild'].every((name) =>
    rootPackage.scripts?.[name]?.includes('verify-b4-finance-planning-portfolio-analytics-boundary.mjs'))
    && ['verify:b4-planning:boundary', 'verify:b4-planning:targeted', 'verify:b4-planning:contract', 'verify:b4-planning:runtime']
      .every((name) => typeof rootPackage.scripts?.[name] === 'string'));

  return Object.freeze({
    schemaVersion: 1,
    step: '33-C',
    requirements: Object.freeze(['B4-10', 'B4-11', 'B4-12']),
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checksPassed: checks.filter((item) => item.passed).length,
    checksFailed: failures.length,
    checks: Object.freeze(checks),
    failures: Object.freeze(failures),
    latestDatabaseMigration: Math.max(...migrationVersions),
    financePlanningLedgerColumns: persistedColumns.length,
    ppk021ExactAllowlistEntries: astGate.exactAllowlistEntries,
    ppk021UseCaseCompositionSurfaces: astGate.surfaceCounts?.USE_CASE_COMPOSITION,
    ppk022CapabilitySurfaces: capabilityGate.capabilitySurfaces,
    prohibitedSecretColumns,
    crossCurrencyAggregationPerformed: false,
    externalPricingPerformed: false,
    bankSynchronizationPerformed: false,
    paymentExecutionPerformed: false,
    generatedAt: new Date().toISOString()
  });
};

const report = await verifyB4FinancePlanningPortfolioAnalyticsBoundary();
if (!noWrite) {
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/33-C-b4-finance-planning-portfolio-analytics-boundary.json', `${JSON.stringify(report, null, 2)}\n`);
}
console.log(`B4 finance planning portfolio analytics boundary: ${report.status} (${report.checksPassed}/${report.checks.length} checks).`);
if (report.failures.length) {
  console.error(report.failures.join('\n'));
  process.exitCode = 1;
}
