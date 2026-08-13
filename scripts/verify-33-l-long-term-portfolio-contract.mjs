import { mkdir, readFile, writeFile } from 'node:fs/promises';

const readText=(path)=>readFile(path,'utf8');
const readJson=async(path)=>JSON.parse(await readText(path));
const includesAll=(source,markers)=>markers.every((marker)=>source.includes(marker));
const chainComplete=(item)=>item?.status==='COMPLETE'
  && Object.keys(item.chain??{}).length===13
  && Object.values(item.chain).every((value)=>value===true);
const ids=Object.freeze(['LTP-001','LTP-002','LTP-003','LTP-004','LTP-005','LTP-006','LTP-007','LTP-008']);
const evidence=Object.freeze([
  'artifacts/validation/33-L-long-term-portfolio-boundary.json',
  'artifacts/validation/33-L-long-term-portfolio-contract.json',
  'artifacts/validation/33-L-long-term-portfolio-runtime.json'
]);
const [registry,ledger,scope,inventory,boundary,decision,threat,audit,master,rootPackage,
  domain,application,repository,migration,adapter,panel]=await Promise.all([
  readJson('config/accepted-scope-registry.json'),readJson('config/user-decision-ledger.json'),
  readJson('config/33-l-long-term-portfolio-scope.json'),readJson('config/33-l-long-term-portfolio-inventory.json'),
  readJson(evidence[0]),readText('docs/decisions/DEC-223-long-term-portfolio-center.md'),
  readText('docs/security/THREAT_MODEL_33_L_LONG_TERM_PORTFOLIO.md'),
  readText('docs/audit/33-L_LONG_TERM_PORTFOLIO_UST_KAPANIS.md'),readText('docs/10_MASTER_DECISION_REGISTER.md'),
  readJson('package.json'),readText('packages/domain/src/long-term-portfolio.ts'),
  readText('packages/application/src/long-term-portfolio-use-cases.ts'),
  readText('packages/repositories/src/long-term-portfolio-repository.ts'),
  readText('packages/database/src/family-database-migrations.ts'),
  readText('apps/desktop/src/main/long-term-portfolio-application-adapter.ts'),
  readText('apps/desktop/src/renderer/LongTermPortfolioPanel.tsx')
]);
const checks=[];const failures=[];
const check=(name,condition)=>{const passed=Boolean(condition);checks.push({name,passed});if(!passed)failures.push(name);};
const requirements=ids.map((id)=>registry.requirements?.find((item)=>item.id===id));

check('all eight requirements are COMPLETE with exact 13-link chains',requirements.every(chainComplete));
check('all eight requirements bind the exact 33-L evidence triplet',requirements.every((item)=>evidence.every((path)=>item?.evidence?.includes(path))));
check('DEC-223 is active with exact requirement cardinality',ledger.decisionCount===ledger.decisions?.length
  && ledger.decisions?.some((item)=>item.id==='DEC-223'&&item.status==='ACTIVE'&&item.requirements?.join(',')===ids.join(',')));
check('scope and inventory are COMPLETE without blockers',scope.status==='COMPLETE'&&scope.validation?.status==='PASS'
  && scope.requirements?.join(',')===ids.join(',')&&inventory.status==='COMPLETE'
  && inventory.openRequirements?.length===0&&inventory.openBlockers?.length===0);
check('boundary is exact green with current platform ratchets',boundary.status==='PASS'&&boundary.checksFailed===0
  && boundary.ppk021ExactAllowlistEntries===562&&boundary.ppk021UseCaseCompositionSurfaces===286
  && boundary.ppk022CapabilitySurfaces===246&&boundary.latestDatabaseMigration===89&&boundary.networkChannels===0);
check('initial 20000 TRY is an editable default and exact user allocation is contractual',scope.model?.initialMonthlyContribution===20000
  && scope.model?.initialMonthlyContributionRole==='editable_default'
  && scope.model?.monthlyContributionPolicy==='positive_user_defined_versioned_per_effective_month'
  && scope.model?.fixedMonthlyContribution===false
  && scope.model?.allocationTotalBasisPoints===10000&&scope.model?.targetDate==='2032-08-13'
  && includesAll(domain,["'ASELS'","'TUPRS'","'THYAO'","'KZL'","'GUF'","'PPN'"]));
check('plan versions carryover and January inflation floor are contractual',includesAll(application,[
  'insertPlanSeal','monthlyBudgetCarryovers',"command.effectiveMonth.endsWith('-01')",'annualInflationBasisPoints'
]));
check('atomic budget transfer truth is exact in scope application repository and migration',
  scope.transferTruth?.atomicSingleRecord===true&&scope.transferTruth?.quantityForbidden===true
  && scope.transferTruth?.holdingsChanged===false&&scope.transferTruth?.sourceBudgetMayBecomeNegative===false
  && [application,repository,migration].every((source)=>source.includes('transfer_out')));
check('central PEP one UoW receipt audit and outbox own writes',includesAll(`${adapter}\n${application}`,[
  'CentralAuthorizationService','transactionExecutor.execute','appendAudit','enqueueEvent','finance_record'
]));
check('ledger analytics and UI bind all detailed user workflows',includesAll(`${domain}\n${application}\n${panel}`,[
  'partialFillSequence','cash_dividend','rights_issue_used','bonus_shares','weightedAverageCost',
  'realizedProfitLoss','Aylık plan','Temettü ve haklar','Grafik ve 2032'
]));
check('truthful no-execution no-advice no-guarantee boundary is exact',scope.truth?.brokerExecutionPerformed===false
  && scope.truth?.moneyMovementPerformed===false&&scope.truth?.livePriceDelivery==='not_performed'
  && scope.truth?.investmentAdviceProvided===false&&scope.truth?.returnGuaranteed===false
  && scope.truth?.taxOrLegalAccuracyGuaranteed===false&&scope.truth?.projectionOutcomeGuaranteed===false);
check('decision threat audit and master register bind DEC-223', [decision,threat,audit,master].every((source)=>source.includes('DEC-223')));
check('root lifecycle exposes boundary targeted contract runtime and completion commands',
  ['pretypecheck','prebuild'].every((name)=>rootPackage.scripts?.[name]?.includes('verify-long-term-portfolio-boundary.mjs'))
  && ['verify:b4-long-term-portfolio:boundary','verify:b4-long-term-portfolio:targeted',
    'verify:b4-long-term-portfolio:contract','verify:b4-long-term-portfolio:runtime',
    'finalize:33-l:external-receipt','verify:33-l:completion']
    .every((name)=>typeof rootPackage.scripts?.[name]==='string'));

const report=Object.freeze({schemaVersion:1,step:'33-L',decision:'DEC-223',requirements:ids,
  status:failures.length===0?'PASS':'FAIL',checksPassed:checks.filter((item)=>item.passed).length,
  checksFailed:failures.length,checks:Object.freeze(checks),failures:Object.freeze(failures),
  latestDatabaseMigration:89,ppk021ExactAllowlistEntries:boundary.ppk021ExactAllowlistEntries,
  ppk021UseCaseCompositionSurfaces:boundary.ppk021UseCaseCompositionSurfaces,
  ppk022CapabilitySurfaces:boundary.ppk022CapabilitySurfaces,networkChannels:0,
  generatedAt:new Date().toISOString()});
await mkdir('artifacts/validation',{recursive:true});
await writeFile(evidence[1],`${JSON.stringify(report,null,2)}\n`);
console.log(`Long-term portfolio contract: ${report.status} (${report.checksPassed}/${checks.length} checks).`);
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
