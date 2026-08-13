import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { runPlatformPolicyAstGate } from './verify-platform-policy-ast-gate.mjs';
import { runPlatformCapabilityManifestGate } from './verify-platform-capability-manifest-gate.mjs';

const readText = (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const [domain, application, contracts, repository, migration, financeAdapter, adapter,
  dataStore, main, ipcPolicy, preload, declarations, app, panel, styles,
  applicationTest, repositoryTest, ipcTest, scope, inventory, decision, threatModel,
  audit, rootPackage, astGate, capabilityGate] = await Promise.all([
  readText('packages/domain/src/long-term-portfolio.ts'),
  readText('packages/application/src/long-term-portfolio-use-cases.ts'),
  readText('packages/repository-contracts/src/long-term-portfolio-repository.ts'),
  readText('packages/repositories/src/long-term-portfolio-repository.ts'),
  readText('packages/database/src/family-database-migrations.ts'),
  readText('apps/desktop/src/main/finance-application-adapter.ts'),
  readText('apps/desktop/src/main/long-term-portfolio-application-adapter.ts'),
  readText('apps/desktop/src/main/data-store.ts'),
  readText('apps/desktop/src/main/main.ts'),
  readText('apps/desktop/src/main/ipc-integration-policy.ts'),
  readText('apps/desktop/src/main/preload.ts'),
  readText('apps/desktop/src/renderer/global.d.ts'),
  readText('apps/desktop/src/renderer/App.tsx'),
  readText('apps/desktop/src/renderer/LongTermPortfolioPanel.tsx'),
  readText('apps/desktop/src/renderer/styles.css'),
  readText('packages/application/tests/long-term-portfolio-security.test.ts'),
  readText('packages/repositories/long-term-portfolio-repository-policy.test.ts'),
  readText('apps/desktop/tests/b4-long-term-portfolio-ipc-integration.test.ts'),
  readJson('config/33-l-long-term-portfolio-scope.json'),
  readJson('config/33-l-long-term-portfolio-inventory.json'),
  readText('docs/decisions/DEC-223-long-term-portfolio-center.md'),
  readText('docs/security/THREAT_MODEL_33_L_LONG_TERM_PORTFOLIO.md'),
  readText('docs/audit/33-L_LONG_TERM_PORTFOLIO_UST_KAPANIS.md'),
  readJson('package.json'),
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
const requirements = Object.freeze(['LTP-001','LTP-002','LTP-003','LTP-004','LTP-005','LTP-006','LTP-007','LTP-008']);
const ipcChannels = Object.freeze(['finance:getLongTermPortfolioWorkspace','finance:recordLongTermPortfolioItem']);

check('domain exposes the complete extensible asset-class catalog', includesAll(domain, [
  "'domestic_equity'", "'foreign_equity'", "'fund'", "'etf'", "'bond_note'",
  "'eurobond'", "'deposit'", "'foreign_currency'", "'gold'", "'silver'",
  "'private_pension'", "'ipo_reserve'", "'cash_savings'", "'crypto_asset'", "'custom'"
]));
check('default catalog and user allocation are exact and total 10000 basis points', includesAll(domain, [
  'DEFAULT_LONG_TERM_PORTFOLIO_CATALOG', "'ASELS'", "'TUPRS'", "'THYAO'", "'KCHOL'",
  "'BIMAS'", "'AKBNK'", "'EREGL'", "'BETAE'", "'NETCD'", "'TI2'", "'AFT'",
  "'TTE'", "'KZL'", "'GUF'", "'PPN'", "'ipo_reserve', 200", 'monthlyContribution = 20_000',
  'allocations.reduce((total, item) => total + item.targetBasisPoints, 0)',
  'totalBasisPoints !== 10_000'
]));
check('plans are immutable forward versions sealed at exactly 100 percent', includesAll(application, [
  'insertPlanSeal', 'totalBasisPoints:10000', 'command.effectiveMonth<=previous.effectiveMonth',
  "command.effectiveMonth.endsWith('-01')", 'annualInflationBasisPoints'
]) && includesAll(migration, [
  'long_term_portfolio_plan_seals', 'trg_ltp_plan_linear_history',
  'trg_ltp_allocation_after_seal', 'trg_ltp_plan_seal_scope', 'total_basis_points INTEGER NOT NULL CHECK(total_basis_points=10000)'
]));
check('same-instrument monthly carryover and six-month rebalance are computed', includesAll(application, [
  'monthlyBudgetCarryovers', "carryoverPolicy:'same_instrument'", 'rebalanceIntervalMonths',
  'nextRebalanceMonth', 'reinvestedIncomeAmount', 'explicitTransferNetAmount'
]));
check('budget transfer is one quantity-free atomic same-currency event', includesAll(application, [
  "command.eventType==='transfer_out'", 'command.transferCounterpartyInstrumentId===command.instrumentId',
  'counterpartyRevision.currency!==currency', 'command.quantity!==undefined',
  'budgetTransferTimelineRemainsNonNegative'
]) && includesAll(repository, [
  'budgetTransferBalanceSql', "row.eventType==='transfer_out'", "row.direction==='non_cash'",
  'row.instrumentId!==row.transferCounterpartyInstrumentId', 'row.quantity===undefined'
]));
check('external security transfer-in requires source evidence', includesAll(application, [
  "command.eventType==='transfer_in'", 'sourceDocumentReference?.trim()'
]) && migration.includes("CHECK(event_type<>'transfer_in' OR source_document_reference IS NOT NULL)"));
check('ledger captures trade chronology partial fills fees taxes fx broker account lot and source', includesAll(domain, [
  'orderAt?:', 'executedAt:', 'settlementAt?:', 'partialFillSequence?:', 'feeAmount:',
  'taxAmount:', 'fxRate?:', 'broker?:', 'accountReference?:', 'lotReference?:', 'sourceDocumentReference?:'
]) && includesAll(application, ['order.value>executed.value', 'settlement.value<executed.value',
  'grossAmount-command.quantity*command.unitPrice', 'expectedNetCash']));
check('corporate-action matrix and reversal-only corrections are append-only', includesAll(domain, [
  "'cash_dividend'", "'rights_issue_used'", "'rights_issue_sold'", "'rights_issue_expired'",
  "'bonus_shares'", "'split'", "'reverse_split'", "'coupon'", "'interest'",
  "'fund_distribution'", "'merger_exchange'", "'code_change'", "'reversal'"
]) && includesAll(migration, ['trg_ltp_event_update', 'trg_ltp_event_delete', 'reversal_of_event_id TEXT UNIQUE']));
check('quantity timeline cannot become negative at any historical pivot', includesAll(application, [
  'quantityTimelineRemainsNonNegative', 'Kıymet çıkış adedi işlem zaman çizelgesindeki kullanılabilir adedi aşamaz',
  'Bu ters kayıt kıymet bakiyesini zaman çizelgesinde eksiye düşürür'
]) && includesAll(migration, ['trg_ltp_event_quantity_balance', 'trg_ltp_reversal_quantity_balance']));
check('stable instrument and plan revision histories are linear and forward-only', includesAll(migration, [
  'UNIQUE(instrument_id,effective_from)', 'trg_ltp_revision_linear_history',
  'UNIQUE(portfolio_id,effective_month)', 'trg_ltp_plan_linear_history'
]));
check('as-of reads exclude future revisions events prices and plans', includesAll(application, [
  'item.effectiveFrom<=input.generatedAt', 'eventEffectiveAt(item)<=input.generatedAt',
  'item.observedAt<=input.generatedAt', 'item.effectiveMonth<=generatedMonth'
]) && includesAll(application, ['executed.value>scope.occurredAt', 'observed.value>scope.occurredAt']));
check('mutation replay is idempotent and payload-conflict safe', includesAll(application, [
  'findMutationByClientOperationId', 'existingMutation.requestFingerprint!==requestFingerprint',
  'return ok(existingMutation.resourceId)'
]) && includesAll(migration, ['client_operation_id TEXT NOT NULL', 'request_fingerprint TEXT NOT NULL',
  'UNIQUE(family_id,client_operation_id)']));
check('analytics provides cost pnl income fees taxes carryover and projections', includesAll(application, [
  'weightedAverageCost', 'realizedProfitLoss', 'unrealizedProfitLoss', 'totalIncome',
  'totalFees', 'totalTaxes', 'totalCarryover', 'buildProjections', 'terminalNominalValue', 'terminalRealValue'
]));
check('mixed currency and missing prices fail closed at aggregate level', includesAll(application, [
  "'mixed_currency_requires_fx'", "'missing_prices'", 'excludedCurrencyInstrumentIds',
  'missingPriceInstrumentIds', 'marketValue=aggregateValuationStatus===\'complete\''
]));
check('repository contracts expose policy-scoped query and write surfaces', includesAll(contracts, [
  'LongTermPortfolioRepository', 'PolicyAuthorizedRepositoryExecutionContext',
  'findMutationByClientOperationId', 'insertPlanSeal', 'insertLedgerEvent', 'insertPriceObservation'
]));
check('migration 89 scopes every aggregate and forbids mutation in place', includesAll(migration, [
  "createMigrationDefinition(89, 'b4_long_term_portfolio_ledger'", 'REVISION-33-L-LONG-TERM-PORTFOLIO',
  'trg_ltp_mutation_policy_receipt', 'trg_ltp_instrument_scope', 'trg_ltp_revision_scope',
  'trg_ltp_portfolio_scope', 'trg_ltp_plan_scope', 'trg_ltp_allocation_scope',
  'trg_ltp_event_scope', 'trg_ltp_price_scope', 'append-only'
]));
check('existing central finance PEP UoW durable receipt audit and outbox are reused', includesAll(`${financeAdapter}\n${adapter}`, [
  'CentralAuthorizationService', 'executeGovernedFinancePolicy', 'transactionExecutor.execute',
  'auditRepository', 'outboxRepository'
]) && repository.includes('platformPolicyPersistenceBinding')
  && includesAll(application, ['appendAudit', 'enqueueEvent', "resourceType:'finance_record'", "capability:'finance.write'"]));
check('desktop composition owns one repository-backed query and UoW', includesAll(dataStore, [
  'RepositoryBackedLongTermPortfolioQueryPort', 'RepositoryBackedLongTermPortfolioUnitOfWork',
  'GetLongTermPortfolioWorkspaceUseCase', 'RecordLongTermPortfolioItemUseCase'
]));
check('IPC exposes exactly two governed channels with recursive secret and exact nested validation',
  ipcChannels.every((channel) => main.includes(`'${channel}'`) && ipcPolicy.includes(`'${channel}'`))
  && includesAll(ipcPolicy, ['containsNestedProhibitedBankingSecret', 'BANKING_SECRET_FIELD_PROHIBITED',
    'LONG_TERM_PORTFOLIO_PLAN_INVALID', 'LONG_TERM_PORTFOLIO_LEDGER_INVALID', 'clientOperationId']));
check('typed preload and renderer declarations expose workspace and mutation', [preload,declarations].every((source) =>
  includesAll(source, ['getLongTermPortfolioWorkspace', 'recordLongTermPortfolioItem'])));
check('Finance menu UI exposes all portfolio workflows charts and truth warning', includesAll(`${app}\n${panel}\n${styles}`, [
  'Uzun Vadeli Portföy', 'Aylık plan', 'Ürün kataloğu', 'Alım / satım', 'Temettü ve haklar',
  'Grafik ve 2032', 'Kıymet bazında', 'Aynı kıymete otomatik devreden aylık bütçe',
  'yatırım emri veya tavsiye değildir', 'ltp-chart'
]));
check('renderer persists one operation id and blocks concurrent duplicate submission', includesAll(panel, [
  'recordingRef.current', 'retryOperationRef.current', 'storePendingOperation', 'crypto.randomUUID()',
  'if(recordingRef.current)return'
]));
check('negative tests cover IPC repository PEP timeline currency seal history and replay', includesAll(`${applicationTest}\n${repositoryTest}\n${ipcTest}`, [
  'clientOperationId', 'requestFingerprint', 'mixed-currency', 'generatedAt', '10,000 basis-point seal',
  'budget transfer', 'bankacılık sırlarını', 'reversal', 'backdated'
]));
check('scope inventory and governance documents bind DEC-223 and all requirements',
  scope.decision==='DEC-223' && scope.requirements?.join(',')===requirements.join(',')
  && inventory.requirements?.join(',')===requirements.join(',')
  && scope.reuse?.latestDatabaseMigration===89 && inventory.latestDatabaseMigration===89
  && [decision,threatModel,audit].every((source)=>source.includes('DEC-223')));
check('truth excludes execution advice guarantees live delivery and network channels',
  scope.truth?.brokerExecutionPerformed===false && scope.truth?.moneyMovementPerformed===false
  && scope.truth?.livePriceDelivery==='not_performed' && scope.truth?.investmentAdviceProvided===false
  && scope.truth?.returnGuaranteed===false && scope.truth?.taxOrLegalAccuracyGuaranteed===false
  && scope.truth?.projectionOutcomeGuaranteed===false && inventory.networkChannels?.length===0);
check('PPK-021 exact successor ratchet is green', astGate.status==='PASS'
  && astGate.privilegedSurfaces===562 && astGate.exactAllowlistEntries===562
  && astGate.surfaceCounts?.USE_CASE_COMPOSITION===286
  && astGate.directRoleAuthorizationBypasses===0 && astGate.findings.length===0);
check('PPK-022 exact capability ratchet remains green', capabilityGate.status==='PASS'
  && capabilityGate.capabilitySurfaces===246 && capabilityGate.exactManifestSurfaces===246
  && capabilityGate.findings.length===0);
check('root lifecycle executes 33-L boundary before typecheck and build', ['pretypecheck','prebuild'].every((name)=>
  rootPackage.scripts?.[name]?.includes('verify-long-term-portfolio-boundary.mjs')));

const report=Object.freeze({
  schemaVersion:1,step:'33-L',decision:'DEC-223',requirements,
  status:failures.length===0?'PASS':'FAIL',checksPassed:checks.filter((item)=>item.passed).length,
  checksFailed:failures.length,checks:Object.freeze(checks),failures:Object.freeze(failures),
  latestDatabaseMigration:89,ipcChannels:ipcChannels.length,networkChannels:0,
  ppk021ExactAllowlistEntries:astGate.exactAllowlistEntries,
  ppk021UseCaseCompositionSurfaces:astGate.surfaceCounts?.USE_CASE_COMPOSITION,
  ppk022CapabilitySurfaces:capabilityGate.exactManifestSurfaces,
  brokerExecutionPerformed:false,livePriceDelivery:'not_performed',investmentAdviceProvided:false,
  returnGuaranteed:false,taxOrLegalAccuracyGuaranteed:false,projectionOutcomeGuaranteed:false,
  generatedAt:new Date().toISOString()
});
await mkdir('artifacts/validation',{recursive:true});
await writeFile('artifacts/validation/33-L-long-term-portfolio-boundary.json',`${JSON.stringify(report,null,2)}\n`);
console.log(`Long-term portfolio boundary: ${report.status} (${report.checksPassed}/${checks.length} checks).`);
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
