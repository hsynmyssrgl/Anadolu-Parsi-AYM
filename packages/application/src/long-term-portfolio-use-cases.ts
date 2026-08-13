import {
  ERROR_CODES,
  asIsoDateTime,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type EventId,
  type FamilyId,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import {
  buildDefaultLongTermPortfolioBootstrap,
  type FamilyRole,
  type LongTermPortfolioAllocationDriftView,
  type LongTermPortfolioAnalyticsView,
  type LongTermPortfolioInstrumentPositionView,
  type LongTermPortfolioLedgerEventType,
  type LongTermPortfolioMonthlyBudgetCarryoverView,
  type LongTermPortfolioMonthlySeriesPointView,
  type LongTermPortfolioPlanVersionView,
  type LongTermPortfolioPrivacy,
  type LongTermPortfolioProjectionPointView,
  type LongTermPortfolioProjectionScenarioView,
  type LongTermPortfolioWorkspaceView,
  type RecordLongTermPortfolioItemInput
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  LongTermPortfolioAllocationRow,
  LongTermPortfolioInstrumentRevisionRow,
  LongTermPortfolioInstrumentRow,
  LongTermPortfolioLedgerEventRow,
  LongTermPortfolioMutationRow,
  LongTermPortfolioPlanSealRow,
  LongTermPortfolioPlanVersionRow,
  LongTermPortfolioPriceObservationRow,
  LongTermPortfolioRow
} from '@ppt/repository-contracts';
import type { AuthorizationAction } from '@ppt/security';

export interface LongTermPortfolioApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: { readonly userId: UserId; readonly role: FamilyRole; readonly personId?: PersonId };
  readonly correlationId: CorrelationId;
}

export interface LongTermPortfolioPolicyIntent {
  readonly action: 'read'|'create';
  readonly capability: 'finance.read'|'finance.write';
  readonly resourceType: 'finance_record';
  readonly resourceId: string;
  readonly purpose: 'finance';
  readonly ownerPersonId?: PersonId;
  readonly privacy?: LongTermPortfolioPrivacy;
}

export interface LongTermPortfolioQueryPort {
  getWorkspace(context:LongTermPortfolioApplicationContext):Promise<Result<LongTermPortfolioWorkspaceView,AppError>>;
}

export interface LongTermPortfolioWriteScope {
  readonly occurredAt: IsoDateTime;
  findPerson(id:PersonId):Result<{readonly id:PersonId;readonly familyId:FamilyId}|null,AppError>;
  findMutationByClientOperationId(clientOperationId:string):Result<LongTermPortfolioMutationRow|null,AppError>;
  listPortfolios():Result<readonly LongTermPortfolioRow[],AppError>;
  findPortfolio(id:string):Result<LongTermPortfolioRow|null,AppError>;
  listInstrumentRevisions():Result<readonly LongTermPortfolioInstrumentRevisionRow[],AppError>;
  findInstrument(id:string):Result<LongTermPortfolioInstrumentRow|null,AppError>;
  findInstrumentRevision(id:string):Result<LongTermPortfolioInstrumentRevisionRow|null,AppError>;
  listPlanVersions(portfolioId:string):Result<readonly LongTermPortfolioPlanVersionRow[],AppError>;
  listAllocations(portfolioId:string):Result<readonly LongTermPortfolioAllocationRow[],AppError>;
  listLedgerEvents(portfolioId:string):Result<readonly LongTermPortfolioLedgerEventRow[],AppError>;
  findLedgerEvent(id:string):Result<LongTermPortfolioLedgerEventRow|null,AppError>;
  listPriceObservations(portfolioId:string):Result<readonly LongTermPortfolioPriceObservationRow[],AppError>;
  authorize(input:{readonly action:AuthorizationAction;readonly resourceType:'finance_record';readonly resourceId:string;readonly ownerPersonId:PersonId;readonly privacy:LongTermPortfolioPrivacy}):Result<boolean,AppError>;
  insertMutation(row:LongTermPortfolioMutationRow):Result<void,AppError>;
  insertInstrument(row:LongTermPortfolioInstrumentRow):Result<void,AppError>;
  insertInstrumentRevision(row:LongTermPortfolioInstrumentRevisionRow):Result<void,AppError>;
  insertPortfolio(row:LongTermPortfolioRow):Result<void,AppError>;
  insertPlanVersion(row:LongTermPortfolioPlanVersionRow):Result<void,AppError>;
  insertAllocation(row:LongTermPortfolioAllocationRow):Result<void,AppError>;
  insertPlanSeal(row:LongTermPortfolioPlanSealRow):Result<void,AppError>;
  insertLedgerEvent(row:LongTermPortfolioLedgerEventRow):Result<void,AppError>;
  insertPriceObservation(row:LongTermPortfolioPriceObservationRow):Result<void,AppError>;
  appendAudit(input:{readonly id:string;readonly action:string;readonly resourceType:string;readonly resourceId:string;readonly occurredAt:IsoDateTime;readonly actorId:UserId}):Result<string,AppError>;
  enqueueEvent<T>(event:DomainEvent<T>):Result<void,AppError>;
}

export interface LongTermPortfolioUnitOfWork {
  resolvePolicyScope?(context:LongTermPortfolioApplicationContext,command:RecordLongTermPortfolioItemInput):Promise<Result<{readonly ownerPersonId:PersonId;readonly privacy:LongTermPortfolioPrivacy},AppError>>;
  execute<T>(context:LongTermPortfolioApplicationContext,intent:LongTermPortfolioPolicyIntent,operation:(scope:LongTermPortfolioWriteScope)=>Result<T,AppError>):Promise<Result<T,AppError>>;
}

export interface RecordLongTermPortfolioIdentifiers {
  readonly mutationId:string;
  readonly requestFingerprint:string;
  readonly portfolioId?:string;
  readonly instrumentId?:string;
  readonly instrumentRevisionId?:string;
  readonly instrumentIds?:readonly string[];
  readonly instrumentRevisionIds?:readonly string[];
  readonly planVersionId?:string;
  readonly allocationIds?:readonly string[];
  readonly ledgerEventId?:string;
  readonly priceObservationId?:string;
  readonly auditId:string;
  readonly outboxEventId:EventId;
}

const invalid=(context:LongTermPortfolioApplicationContext,message:string)=>createAppError({code:ERROR_CODES.CORE_INVALID_ARGUMENT,message,category:'validation',correlationId:context.correlationId});
const missing=(context:LongTermPortfolioApplicationContext,message:string)=>createAppError({code:ERROR_CODES.RESOURCE_NOT_FOUND,message,category:'not_found',correlationId:context.correlationId});
const denied=(context:LongTermPortfolioApplicationContext)=>createAppError({code:ERROR_CODES.AUTHORIZATION_DENIED,message:'Bu uzun vadeli portföy işlemi için yetkiniz bulunmuyor.',category:'authorization',correlationId:context.correlationId});
const normalizedCurrency=(value:string):string=>value.normalize('NFKC').trim().toUpperCase();
const validCurrency=(value:string):boolean=>/^[A-Z]{3}$/u.test(value);
const finite=(value:number):boolean=>Number.isFinite(value);
const asDate=(value:string,context:LongTermPortfolioApplicationContext,label:string):Result<IsoDateTime,AppError>=>{
  const parsed=new Date(value);return Number.isNaN(parsed.getTime())?err(invalid(context,`${label} geçersiz.`)):ok(asIsoDateTime(parsed.toISOString()));
};
const monthValid=(value:string):boolean=>/^\d{4}-(0[1-9]|1[0-2])$/u.test(value);
const validAssumptions=(value:LongTermPortfolioPlanVersionView['assumptions']):boolean=>{
  const values=[value.pessimisticAnnualReturnBasisPoints,value.baseAnnualReturnBasisPoints,value.optimisticAnnualReturnBasisPoints,value.annualInflationBasisPoints,value.annualContributionGrowthBasisPoints];
  return values.every(item=>Number.isInteger(item)&&item>=-10000&&item<=100000)
    && value.pessimisticAnnualReturnBasisPoints<=value.baseAnnualReturnBasisPoints
    && value.baseAnnualReturnBasisPoints<=value.optimisticAnnualReturnBasisPoints;
};
const corporateEventTypes=new Set<LongTermPortfolioLedgerEventType>(['rights_issue_used','rights_issue_sold','rights_issue_expired','bonus_shares','split','reverse_split','merger_exchange','code_change']);
const incomeEventTypes=new Set<LongTermPortfolioLedgerEventType>(['cash_dividend','coupon','interest','fund_distribution']);
const directionForEvent=(eventType:LongTermPortfolioLedgerEventType):LongTermPortfolioLedgerEventRow['direction']|undefined=>{
  if(new Set<LongTermPortfolioLedgerEventType>(['buy','rights_issue_used','fee','tax']).has(eventType))return 'cash_out';
  if(new Set<LongTermPortfolioLedgerEventType>(['sell','cash_dividend','rights_issue_sold','coupon','interest','fund_distribution']).has(eventType))return 'cash_in';
  if(new Set<LongTermPortfolioLedgerEventType>(['bonus_shares','transfer_in']).has(eventType))return 'security_in';
  if(eventType==='rights_issue_expired')return 'security_out';
  if(new Set<LongTermPortfolioLedgerEventType>(['split','reverse_split','merger_exchange','code_change','transfer_out','reversal']).has(eventType))return 'non_cash';
  return undefined;
};
const expectedNetCash=(direction:LongTermPortfolioLedgerEventRow['direction'],gross:number,fees:number,taxes:number):number=>direction==='cash_out'?-(gross+fees+taxes):direction==='cash_in'?gross-fees-taxes:0;
const eventEffectiveAt=(event:LongTermPortfolioLedgerEventRow):string=>incomeEventTypes.has(event.eventType)?event.paymentAt??event.executedAt:event.executedAt;
const currentRevisionByInstrument=(rows:readonly LongTermPortfolioInstrumentRevisionRow[])=>{
  const result=new Map<string,LongTermPortfolioInstrumentRevisionRow>();
  for(const row of [...rows].sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom)||b.createdAt.localeCompare(a.createdAt)))if(!result.has(row.instrumentId))result.set(row.instrumentId,row);
  return result;
};

const quantityDeltaForEvent=(eventType:LongTermPortfolioLedgerEventType,quantity:number):number=>eventType==='buy'||eventType==='transfer_in'||eventType==='bonus_shares'||eventType==='rights_issue_used'||eventType==='split'?quantity:eventType==='sell'||eventType==='rights_issue_sold'||eventType==='rights_issue_expired'||eventType==='reverse_split'?-quantity:0;

const quantityTimelineRemainsNonNegative=(events:readonly LongTermPortfolioLedgerEventRow[],instrumentId:string,reversed:Set<string>,candidate?:Readonly<{eventType:LongTermPortfolioLedgerEventType;quantity:number;executedAt:string}>):boolean=>{
  const deltasByTimestamp=new Map<string,number>();
  for(const event of events){
    if(event.instrumentId!==instrumentId||event.eventType==='reversal'||reversed.has(event.id))continue;
    deltasByTimestamp.set(event.executedAt,(deltasByTimestamp.get(event.executedAt)??0)+quantityDeltaForEvent(event.eventType,event.quantity??0));
  }
  if(candidate)deltasByTimestamp.set(candidate.executedAt,(deltasByTimestamp.get(candidate.executedAt)??0)+quantityDeltaForEvent(candidate.eventType,candidate.quantity));
  let balance=0;
  for(const timestamp of [...deltasByTimestamp.keys()].sort()){
    balance+=deltasByTimestamp.get(timestamp)??0;
    if(balance< -0.000001)return false;
  }
  return true;
};

const signedEvent=(event:LongTermPortfolioLedgerEventRow,reversed:Set<string>):{quantity:number;cash:number;fees:number;taxes:number;income:number;contribution:number}=>{
  if(reversed.has(event.id)||event.eventType==='reversal')return {quantity:0,cash:0,fees:0,taxes:0,income:0,contribution:0};
  const quantity=event.quantity??0;
  const quantityDelta=quantityDeltaForEvent(event.eventType,quantity);
  const incomeEvents=new Set<LongTermPortfolioLedgerEventType>(['cash_dividend','coupon','interest','fund_distribution']);
  return {quantity:quantityDelta,cash:event.netCashAmount,fees:event.feeAmount,taxes:event.taxAmount,income:incomeEvents.has(event.eventType)?Math.max(0,event.netCashAmount):0,contribution:event.eventType==='buy'?Math.max(0,-event.netCashAmount):0};
};

const weightedAverageCost=(events:readonly LongTermPortfolioLedgerEventRow[],reversed:Set<string>)=>{
  let quantity=0,costBasis=0,grossPurchases=0,grossSales=0,realized=0;
  let status:'calculated_weighted_average'|'unsupported_cost_layer'|'incomplete_history'='calculated_weighted_average';
  for(const event of [...events].sort((a,b)=>a.executedAt.localeCompare(b.executedAt)||a.id.localeCompare(b.id))){
    if(reversed.has(event.id)||event.eventType==='reversal')continue;
    if((event.eventType==='sell'||event.eventType==='rights_issue_sold')&&(event.costLayerMethod==='fifo'||event.costLayerMethod==='specific_lot'))status='unsupported_cost_layer';
    const amount=event.quantity??0;
    if(event.eventType==='buy'||event.eventType==='rights_issue_used'){
      if(amount<=0){status='incomplete_history';continue;}
      quantity+=amount;costBasis+=event.grossAmount+event.feeAmount+event.taxAmount;grossPurchases+=event.grossAmount;
      continue;
    }
    if(event.eventType==='bonus_shares'||event.eventType==='split'){
      if(amount<=0)status='incomplete_history';else quantity+=amount;
      continue;
    }
    if(event.eventType==='transfer_in'){
      if(amount<=0)status='incomplete_history';else {quantity+=amount;costBasis+=event.grossAmount;}
      continue;
    }
    if(event.eventType==='reverse_split'){
      if(amount<=0||amount>quantity+0.000001)status='incomplete_history';else quantity=Math.max(0,quantity-amount);
      continue;
    }
    if(event.eventType==='sell'||event.eventType==='rights_issue_sold'||event.eventType==='rights_issue_expired'){
      if(amount<=0||amount>quantity+0.000001){status='incomplete_history';continue;}
      const removedCost=quantity>0?costBasis*(amount/quantity):0;quantity-=amount;costBasis=Math.max(0,costBasis-removedCost);
      if(event.eventType==='sell'||event.eventType==='rights_issue_sold'){grossSales+=event.grossAmount;realized+=event.netCashAmount-removedCost;}
      else if(event.eventType==='rights_issue_expired')realized-=removedCost;
      continue;
    }
    if(incomeEventTypes.has(event.eventType)||event.eventType==='fee'||event.eventType==='tax'||event.eventType==='cash_adjustment')realized+=event.netCashAmount;
  }
  const averageUnitCost=quantity>0?costBasis/quantity:undefined;
  return {status,quantity,costBasis,averageUnitCost,grossPurchases,grossSales,realized};
};

const monthRange=(start:string,end:string):readonly string[]=>{
  const result:string[]=[];const cursor=new Date(`${start}-01T00:00:00.000Z`);const terminal=new Date(`${end}-01T00:00:00.000Z`);
  while(cursor<=terminal&&result.length<600){result.push(cursor.toISOString().slice(0,7));cursor.setUTCMonth(cursor.getUTCMonth()+1);}return result;
};

const addMonths=(month:string,amount:number):string=>{
  const cursor=new Date(`${month}-01T00:00:00.000Z`);cursor.setUTCMonth(cursor.getUTCMonth()+amount);return cursor.toISOString().slice(0,7);
};

const budgetTransferTimelineRemainsNonNegative=(input:Readonly<{
  portfolio:LongTermPortfolioRow;
  plans:readonly LongTermPortfolioPlanVersionRow[];
  allocations:readonly LongTermPortfolioAllocationRow[];
  events:readonly LongTermPortfolioLedgerEventRow[];
  sourceInstrumentId:string;
  executedAt:string;
  grossAmount:number;
  currency:string;
  fxRate:number|undefined;
  through:string;
}>):boolean=>{
  const throughMonth=input.through.slice(0,7);const transferMonth=input.executedAt.slice(0,7);
  const plans=input.plans.filter(item=>item.effectiveMonth<=throughMonth).toSorted((a,b)=>a.effectiveMonth.localeCompare(b.effectiveMonth)||a.version-b.version);
  const firstMonth=plans[0]?.effectiveMonth;if(!firstMonth||transferMonth<firstMonth||transferMonth>throughMonth)return false;
  const reversed=new Set(input.events.filter(item=>item.eventType==='reversal'&&item.reversalOfEventId).map(item=>item.reversalOfEventId!));
  let carry=0;
  for(const month of monthRange(firstMonth,throughMonth)){
    const plan=plans.filter(item=>item.effectiveMonth<=month).toSorted((a,b)=>b.effectiveMonth.localeCompare(a.effectiveMonth)||b.version-a.version)[0];
    if(!plan)continue;
    const planned=input.allocations.filter(item=>item.planVersionId===plan.id&&item.instrumentId===input.sourceInstrumentId).reduce((sum,item)=>sum+plan.monthlyContribution*item.targetBasisPoints/10000,0);
    let actual=0,income=0,transfer=month===transferMonth?-input.grossAmount*(input.currency===input.portfolio.baseCurrency?1:input.fxRate??Number.NaN):0;
    for(const event of input.events){
      if(reversed.has(event.id)||event.eventType==='reversal'||eventEffectiveAt(event).slice(0,7)!==month)continue;
      const rate=event.currency===input.portfolio.baseCurrency?1:event.fxRate;if(rate===undefined||!finite(rate)||rate<=0)return false;
      if(event.eventType==='buy'&&event.instrumentId===input.sourceInstrumentId)actual+=Math.max(0,-event.netCashAmount)*rate;
      if(event.cashCarryoverInstrumentId===input.sourceInstrumentId&&event.netCashAmount>0)income+=event.netCashAmount*rate;
      if(event.eventType==='transfer_out'&&event.instrumentId===input.sourceInstrumentId)transfer-=event.grossAmount*rate;
      if(event.eventType==='transfer_out'&&event.transferCounterpartyInstrumentId===input.sourceInstrumentId)transfer+=event.grossAmount*rate;
    }
    const closing=carry+planned+income+transfer-actual;if(!finite(closing)||closing< -0.000001)return false;carry=Math.max(0,closing);
  }
  return true;
};

const buildProjections=(plan:LongTermPortfolioPlanVersionView|undefined,generatedAt:string,startingValue:number,startingValueSource:LongTermPortfolioProjectionScenarioView['startingValueSource']):readonly LongTermPortfolioProjectionScenarioView[]=>{
  if(!plan)return Object.freeze([]);const generatedMonth=generatedAt.slice(0,7);const startMonth=startingValueSource==='zero_unavailable'?generatedMonth:addMonths(generatedMonth,1);const endMonth=plan.targetDate.slice(0,7);const months=monthRange(startMonth,endMonth);
  const annualRates={pessimistic:plan.assumptions.pessimisticAnnualReturnBasisPoints,base:plan.assumptions.baseAnnualReturnBasisPoints,optimistic:plan.assumptions.optimisticAnnualReturnBasisPoints} as const;
  return Object.freeze((Object.entries(annualRates) as Array<[LongTermPortfolioProjectionScenarioView['scenario'],number]>).map(([scenario,annualReturnBasisPoints])=>{
    let nominal=startingValue,contributed=0;const points:LongTermPortfolioProjectionPointView[]=[];
    const startYear=Number(startMonth.slice(0,4));
    for(let index=0;index<months.length;index++){const calendarYear=Math.max(0,Number(months[index]!.slice(0,4))-startYear);const contributionGrowth=plan.inflationAdjustment==='manual_realized_inflation'?Math.max(plan.assumptions.annualContributionGrowthBasisPoints,plan.assumptions.annualInflationBasisPoints):plan.assumptions.annualContributionGrowthBasisPoints;const contribution=plan.monthlyContribution*Math.pow(1+contributionGrowth/10000,calendarYear);nominal=(nominal+contribution)*Math.pow(1+annualReturnBasisPoints/10000,1/12);contributed+=contribution;const inflationFactor=Math.pow(1+plan.assumptions.annualInflationBasisPoints/10000,(index+1)/12);points.push(Object.freeze({month:months[index]!,nominalValue:nominal,realValue:inflationFactor>0?nominal/inflationFactor:nominal,contributedAmount:contributed}));}
    const terminal=points.at(-1);return Object.freeze({scenario,annualReturnBasisPoints,startingValue,startingValueSource,points:Object.freeze(points),terminalNominalValue:terminal?.nominalValue??startingValue,terminalRealValue:terminal?.realValue??startingValue});
  }));
};

export const buildLongTermPortfolioWorkspace=(input:{readonly portfolios:readonly LongTermPortfolioRow[];readonly instrumentRevisions:readonly LongTermPortfolioInstrumentRevisionRow[];readonly planVersions:readonly LongTermPortfolioPlanVersionRow[];readonly allocations:readonly LongTermPortfolioAllocationRow[];readonly ledgerEvents:readonly LongTermPortfolioLedgerEventRow[];readonly priceObservations:readonly LongTermPortfolioPriceObservationRow[];readonly generatedAt:string}):LongTermPortfolioWorkspaceView=>{
  const portfolio=input.portfolios[0];
  const effectiveRevisions=input.instrumentRevisions.filter(item=>item.effectiveFrom<=input.generatedAt);
  const effectiveEvents=input.ledgerEvents.filter(item=>eventEffectiveAt(item)<=input.generatedAt);
  const effectivePrices=input.priceObservations.filter(item=>item.observedAt<=input.generatedAt);
  const currentMap=currentRevisionByInstrument(effectiveRevisions);
  const currentInstruments=[...currentMap.values()];
  const planVersions:LongTermPortfolioPlanVersionView[]=input.planVersions.map(plan=>Object.freeze({...plan,allocations:Object.freeze(input.allocations.filter(item=>item.planVersionId===plan.id).sort((a,b)=>a.displayOrder-b.displayOrder))}));
  const generatedMonth=input.generatedAt.slice(0,7);const activePlan=planVersions.filter(item=>item.effectiveMonth<=generatedMonth).toSorted((a,b)=>b.effectiveMonth.localeCompare(a.effectiveMonth)||b.version-a.version)[0];
  let analytics:LongTermPortfolioAnalyticsView|undefined;
  if(portfolio){
    const reversed=new Set(effectiveEvents.filter(item=>item.eventType==='reversal'&&item.reversalOfEventId).map(item=>item.reversalOfEventId!));
    const prices=new Map<string,LongTermPortfolioPriceObservationRow>();for(const price of [...effectivePrices].sort((a,b)=>b.observedAt.localeCompare(a.observedAt)))if(!prices.has(price.instrumentId))prices.set(price.instrumentId,price);
    const positions:LongTermPortfolioInstrumentPositionView[]=currentInstruments.map(instrument=>{
      const events=effectiveEvents.filter(item=>item.instrumentId===instrument.instrumentId&&item.currency===instrument.currency);
      const sums=events.reduce((total,event)=>{
        const signed=signedEvent(event,reversed);
        return {quantity:total.quantity+signed.quantity,contributed:total.contributed+signed.contribution,cash:total.cash+signed.cash,fees:total.fees+signed.fees,taxes:total.taxes+signed.taxes,income:total.income+signed.income};
      },{quantity:0,contributed:0,cash:0,fees:0,taxes:0,income:0});
      const price=prices.get(instrument.instrumentId);
      const marketValue=price?.currency===instrument.currency?price.unitPrice*sums.quantity:undefined;
      const cost=weightedAverageCost(events,reversed);
      const carryover=Math.max(0,effectiveEvents.filter(event=>event.currency===instrument.currency&&!reversed.has(event.id)&&event.eventType!=='reversal').reduce((total,event)=>{
        if(event.eventType==='transfer_out'&&event.transferCounterpartyInstrumentId){if(event.instrumentId===instrument.instrumentId)return total-event.grossAmount;if(event.transferCounterpartyInstrumentId===instrument.instrumentId)return total+event.grossAmount;}
        return event.cashCarryoverInstrumentId===instrument.instrumentId?total+event.netCashAmount:total;
      },0));
      const costValues=cost.status==='calculated_weighted_average'?{costBasisAmount:cost.costBasis,...(cost.averageUnitCost===undefined?{}:{averageUnitCost:cost.averageUnitCost}),realizedProfitLoss:cost.realized,...(marketValue===undefined?{}:{unrealizedProfitLoss:marketValue-cost.costBasis})}:{};
      return Object.freeze({instrumentId:instrument.instrumentId,code:instrument.code,name:instrument.name,assetClass:instrument.assetClass,currency:instrument.currency,quantity:sums.quantity,contributedAmount:sums.contributed,grossPurchaseAmount:cost.grossPurchases,grossSaleAmount:cost.grossSales,realizedCashAmount:sums.cash,feeAmount:sums.fees,taxAmount:sums.taxes,incomeAmount:sums.income,...costValues,...(price?{latestUnitPrice:price.unitPrice}:{}),...(marketValue===undefined?{}:{marketValue,netProfitLoss:marketValue+sums.cash}),carryoverAmount:carryover,priceFreshness:price?'manual':'missing',costBasisStatus:cost.status});
    });
    const missingFxEventIds=new Set<string>();
    const monthlyBudgetCarryovers:LongTermPortfolioMonthlyBudgetCarryoverView[]=[];
    const budgetPlans=planVersions.filter(item=>item.effectiveMonth<=generatedMonth).toSorted((a,b)=>a.effectiveMonth.localeCompare(b.effectiveMonth)||a.version-b.version);
    const firstBudgetMonth=budgetPlans[0]?.effectiveMonth;
    const carriedByInstrument=new Map<string,number|undefined>();
    if(firstBudgetMonth){
      for(const month of monthRange(firstBudgetMonth,generatedMonth)){
        const plan=budgetPlans.filter(item=>item.effectiveMonth<=month).toSorted((a,b)=>b.effectiveMonth.localeCompare(a.effectiveMonth)||b.version-a.version)[0];
        if(!plan)continue;
        const plannedByInstrument=new Map<string,number>();
        for(const allocation of plan.allocations)plannedByInstrument.set(allocation.instrumentId,(plannedByInstrument.get(allocation.instrumentId)??0)+plan.monthlyContribution*allocation.targetBasisPoints/10000);
        const monthEvents=effectiveEvents.filter(event=>!reversed.has(event.id)&&event.eventType!=='reversal'&&eventEffectiveAt(event).slice(0,7)===month);
        const instrumentIds=new Set<string>([...plannedByInstrument.keys(),...carriedByInstrument.keys()]);
        for(const event of monthEvents){if(event.instrumentId)instrumentIds.add(event.instrumentId);if(event.transferCounterpartyInstrumentId)instrumentIds.add(event.transferCounterpartyInstrumentId);if(event.cashCarryoverInstrumentId)instrumentIds.add(event.cashCarryoverInstrumentId);}
        for(const instrumentId of instrumentIds){
          const opening=carriedByInstrument.has(instrumentId)?carriedByInstrument.get(instrumentId):0;
          const planned=plannedByInstrument.get(instrumentId)??0;
          let actual=0,reinvestedIncome=0,explicitTransfer=0,complete=opening!==undefined&&plan.contributionCurrency===portfolio.baseCurrency;
          for(const event of monthEvents){
            const relevant=event.instrumentId===instrumentId||event.cashCarryoverInstrumentId===instrumentId||event.transferCounterpartyInstrumentId===instrumentId;
            if(!relevant)continue;
            const rate=event.currency===portfolio.baseCurrency?1:event.fxRate;
            if(rate===undefined||!finite(rate)||rate<=0){missingFxEventIds.add(event.id);complete=false;continue;}
            if(event.eventType==='buy'&&event.instrumentId===instrumentId)actual+=Math.max(0,-event.netCashAmount)*rate;
            if(event.cashCarryoverInstrumentId===instrumentId&&event.netCashAmount>0)reinvestedIncome+=event.netCashAmount*rate;
            if(event.eventType==='transfer_out'&&event.instrumentId===instrumentId)explicitTransfer-=event.grossAmount*rate;
            if(event.eventType==='transfer_out'&&event.transferCounterpartyInstrumentId===instrumentId)explicitTransfer+=event.grossAmount*rate;
          }
          const closing=complete?Math.max(0,(opening??0)+planned+reinvestedIncome+explicitTransfer-actual):undefined;
          carriedByInstrument.set(instrumentId,closing);
          const code=currentMap.get(instrumentId)?.code??instrumentId;
          monthlyBudgetCarryovers.push(Object.freeze({month,instrumentId,code,currency:portfolio.baseCurrency,plannedAmount:planned,...(opening===undefined?{}:{openingCarryoverAmount:opening}),...(closing===undefined?{}:{actualContributionAmount:actual,reinvestedIncomeAmount:reinvestedIncome,explicitTransferNetAmount:explicitTransfer,closingCarryoverAmount:closing}),complete}));
        }
      }
    }
    const activePositions=positions.filter(item=>item.quantity!==0||item.contributedAmount!==0||item.realizedCashAmount!==0||item.feeAmount!==0||item.taxAmount!==0||item.incomeAmount!==0||item.carryoverAmount!==0);
    const excludedCurrencyInstrumentIds=activePositions.filter(item=>item.currency!==portfolio.baseCurrency).map(item=>item.instrumentId);
    const missingPriceInstrumentIds=activePositions.filter(item=>item.currency===portfolio.baseCurrency&&item.marketValue===undefined).map(item=>item.instrumentId);
    const aggregateValuationStatus:LongTermPortfolioAnalyticsView['aggregateValuationStatus']=excludedCurrencyInstrumentIds.length>0?'mixed_currency_requires_fx':missingPriceInstrumentIds.length>0?'missing_prices':'complete';
    const marketValue=aggregateValuationStatus==='complete'?activePositions.reduce((sum,item)=>sum+(item.marketValue??0),0):undefined;
    const allocationDrift:LongTermPortfolioAllocationDriftView[]=(activePlan?.allocations??[]).map(allocation=>{
      const position=positions.find(item=>item.instrumentId===allocation.instrumentId);const revision=currentMap.get(allocation.instrumentId);
      const actualBasisPoints=marketValue!==undefined&&marketValue>0&&position?.marketValue!==undefined?Math.round(position.marketValue/marketValue*10000):undefined;
      const driftBasisPoints=actualBasisPoints===undefined?undefined:actualBasisPoints-allocation.targetBasisPoints;
      return Object.freeze({allocationId:allocation.id,instrumentId:allocation.instrumentId,code:revision?.code??allocation.instrumentId,targetBasisPoints:allocation.targetBasisPoints,...(actualBasisPoints===undefined||driftBasisPoints===undefined?{}:{actualBasisPoints,driftBasisPoints}),rebalanceDue:driftBasisPoints!==undefined&&Math.abs(driftBasisPoints)>=500,missingPrice:position?.marketValue===undefined});
    });
    const aggregateEvents=effectiveEvents.filter(event=>event.currency===portfolio.baseCurrency&&(event.instrumentId===undefined||currentMap.get(event.instrumentId)?.currency===portfolio.baseCurrency));
    const monthly=new Map<string,{contributed:number;income:number;fees:number;taxes:number;carryover:number}>();
    for(const event of aggregateEvents){if(reversed.has(event.id)||event.eventType==='reversal')continue;const key=eventEffectiveAt(event).slice(0,7);const value=monthly.get(key)??{contributed:0,income:0,fees:0,taxes:0,carryover:0};const signed=signedEvent(event,reversed);value.contributed+=signed.contribution;value.income+=signed.income;value.fees+=signed.fees;value.taxes+=signed.taxes;monthly.set(key,value);}
    for(const row of monthlyBudgetCarryovers){const value=monthly.get(row.month)??{contributed:0,income:0,fees:0,taxes:0,carryover:0};if(row.closingCarryoverAmount!==undefined)value.carryover+=row.closingCarryoverAmount;monthly.set(row.month,value);}
    let cumulative=0;
    const monthlySeries:LongTermPortfolioMonthlySeriesPointView[]=excludedCurrencyInstrumentIds.length>0?[]:[...monthly.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([month,value])=>{cumulative+=value.contributed;return Object.freeze({month,contributedAmount:cumulative,...(month===input.generatedAt.slice(0,7)&&marketValue!==undefined?{marketValue,netProfitLoss:marketValue-cumulative}:{}),dividendCouponInterestAmount:value.income,feeAmount:value.fees,taxAmount:value.taxes,carryoverAmount:value.carryover});});
    const currentBudgetRows=monthlyBudgetCarryovers.filter(row=>row.month===generatedMonth);const budgetCarryover=currentBudgetRows.length>0&&currentBudgetRows.every(row=>row.closingCarryoverAmount!==undefined)?currentBudgetRows.reduce((sum,row)=>sum+row.closingCarryoverAmount!,0):undefined;
    const aggregateTotals=excludedCurrencyInstrumentIds.length===0?{totalContributed:positions.reduce((sum,item)=>sum+item.contributedAmount,0),totalFees:positions.reduce((sum,item)=>sum+item.feeAmount,0),totalTaxes:positions.reduce((sum,item)=>sum+item.taxAmount,0),totalIncome:positions.reduce((sum,item)=>sum+item.incomeAmount,0),totalCarryover:budgetCarryover??positions.reduce((sum,item)=>sum+item.carryoverAmount,0)}:undefined;
    const nextRebalanceMonth=activePlan?addMonths(activePlan.effectiveMonth,activePlan.rebalanceIntervalMonths):undefined;const timedRebalanceDue=nextRebalanceMonth!==undefined&&generatedMonth>=nextRebalanceMonth;
    analytics=Object.freeze({currency:portfolio.baseCurrency,aggregateValuationStatus,...(aggregateTotals??{}),...(marketValue===undefined||aggregateTotals===undefined?{}:{marketValue,netProfitLoss:marketValue-aggregateTotals.totalContributed}),positions:Object.freeze(positions),allocationDrift:Object.freeze(allocationDrift),monthlySeries:Object.freeze(monthlySeries),monthlyBudgetCarryovers:Object.freeze(monthlyBudgetCarryovers),rebalanceDue:timedRebalanceDue||allocationDrift.some(item=>item.rebalanceDue),...(nextRebalanceMonth?{nextRebalanceMonth}:{}),missingPriceInstrumentIds:Object.freeze(missingPriceInstrumentIds),excludedCurrencyInstrumentIds:Object.freeze(excludedCurrencyInstrumentIds),missingFxEventIds:Object.freeze([...missingFxEventIds]),missingSettlementEventIds:Object.freeze(effectiveEvents.filter(event=>(event.eventType==='buy'||event.eventType==='sell')&&!event.settlementAt).map(event=>event.id))});
  }
  const projectionStartingValue=analytics?.marketValue??analytics?.totalContributed??0;
  const projectionStartingValueSource:LongTermPortfolioProjectionScenarioView['startingValueSource']=analytics?.marketValue!==undefined?'current_market_value':analytics?.totalContributed!==undefined?'contributed_principal':'zero_unavailable';
  return Object.freeze({generatedAt:input.generatedAt,...(portfolio?{portfolio}:{}),instruments:Object.freeze([...input.instrumentRevisions]),currentInstruments:Object.freeze(currentInstruments),planVersions:Object.freeze(planVersions),...(activePlan?{activePlan}:{}),ledgerEvents:Object.freeze([...input.ledgerEvents]),priceObservations:Object.freeze([...input.priceObservations]),...(analytics?{analytics}:{}),projections:buildProjections(activePlan,input.generatedAt,projectionStartingValue,projectionStartingValueSource),truth:Object.freeze({brokerOrderExecution:'not_performed',livePriceGuarantee:false,investmentAdvice:false,returnGuarantee:false,taxLegalAccuracyGuarantee:false,externalVerification:'not_performed_unless_explicitly_recorded'})});
};

export class GetLongTermPortfolioWorkspaceUseCase {
  public constructor(private readonly query:LongTermPortfolioQueryPort){}
  public execute(context:LongTermPortfolioApplicationContext){return this.query.getWorkspace(context);}
}

const requireOk=<T>(result:Result<T,AppError>):T=>{if(!result.ok)throw result.error;return result.value;};

export class RecordLongTermPortfolioItemUseCase {
  public constructor(private readonly unitOfWork:LongTermPortfolioUnitOfWork){}
  public async execute(input:{readonly context:LongTermPortfolioApplicationContext;readonly command:RecordLongTermPortfolioItemInput;readonly identifiers:RecordLongTermPortfolioIdentifiers}):Promise<Result<string,AppError>>{
    const fallbackOwner=input.command.itemType==='bootstrap_default'?asPersonId(input.command.ownerPersonId):input.context.actor.personId;
    if(!fallbackOwner)return err(invalid(input.context,'Portföy işlemi için kişi kimliği gereklidir.'));
    const resolved=this.unitOfWork.resolvePolicyScope
      ? await this.unitOfWork.resolvePolicyScope(input.context,input.command)
      : ok({ownerPersonId:fallbackOwner,privacy:input.command.itemType==='bootstrap_default'?input.command.privacy:'private' as const});
    if(!resolved.ok)return resolved;
    const ownerId=resolved.value.ownerPersonId,privacy=resolved.value.privacy;
    const intent:LongTermPortfolioPolicyIntent={action:'create',capability:'finance.write',resourceType:'finance_record',resourceId:input.identifiers.mutationId,purpose:'finance',ownerPersonId:ownerId,privacy};
    return this.unitOfWork.execute(input.context,intent,scope=>{
      try{
        const person=requireOk(scope.findPerson(ownerId));if(!person)return err(missing(input.context,'Portföy sahibi bulunamadı.'));if(person.familyId!==input.context.familyId)return err(denied(input.context));
        const allowed=requireOk(scope.authorize({action:'create',resourceType:'finance_record',resourceId:input.identifiers.mutationId,ownerPersonId:ownerId,privacy}));if(!allowed)return err(denied(input.context));
        const requestFingerprint=input.identifiers.requestFingerprint;if(!/^[0-9a-f]{64}$/u.test(requestFingerprint))return err(invalid(input.context,'İşlem parmak izi geçersiz.'));
        const expectedResourceId=input.command.itemType==='bootstrap_default'?input.identifiers.portfolioId:input.command.itemType==='instrument_revision'?input.identifiers.instrumentId:input.command.itemType==='plan_version'?input.identifiers.planVersionId:input.command.itemType==='ledger_event'?input.identifiers.ledgerEventId:input.identifiers.priceObservationId;
        const existingMutation=requireOk(scope.findMutationByClientOperationId(input.command.clientOperationId));
        if(existingMutation){if(existingMutation.requestFingerprint!==requestFingerprint)return err(invalid(input.context,'Aynı istemci işlem kimliği farklı içerikle yeniden kullanılamaz.'));return ok(existingMutation.resourceId);}
        const mutation:LongTermPortfolioMutationRow={id:input.identifiers.mutationId,clientOperationId:input.command.clientOperationId,requestFingerprint,familyId:input.context.familyId,ownerPersonId:ownerId,privacy,operation:input.command.itemType,resourceId:expectedResourceId??input.identifiers.mutationId,createdAt:scope.occurredAt};requireOk(scope.insertMutation(mutation));
        let aggregateId=input.identifiers.mutationId;
        switch(input.command.itemType){
          case 'bootstrap_default':{
            const existing=requireOk(scope.listPortfolios());if(existing.length>0)return err(invalid(input.context,'Bu aile için uzun vadeli portföy zaten kurulmuş.'));
            if(!input.identifiers.portfolioId||!input.identifiers.planVersionId||!input.identifiers.instrumentIds||!input.identifiers.instrumentRevisionIds||!input.identifiers.allocationIds)return err(invalid(input.context,'Başlangıç kimlikleri eksik.'));
            const target=asDate(input.command.targetDate,input.context,'Hedef tarihi');if(!target.ok)return target;
            const seed=buildDefaultLongTermPortfolioBootstrap();if(input.identifiers.instrumentIds.length!==seed.instruments.length||input.identifiers.instrumentRevisionIds.length!==seed.instruments.length||input.identifiers.allocationIds.length!==seed.allocations.length)return err(invalid(input.context,'Başlangıç katalog veya dağılım kimliği sayısı uyuşmuyor.'));
            const idByTemplate=new Map(seed.instruments.map((item,index)=>[item.instrumentId,input.identifiers.instrumentIds![index]!]));
            for(const [index,item] of seed.instruments.entries()){
              const instrumentId=input.identifiers.instrumentIds[index]!,revisionId=input.identifiers.instrumentRevisionIds[index]!;
              requireOk(scope.insertInstrument({id:instrumentId,mutationId:mutation.id,familyId:input.context.familyId,ownerPersonId:ownerId,privacy,createdAt:scope.occurredAt}));
              requireOk(scope.insertInstrumentRevision({...item,instrumentId,revisionId,mutationId:mutation.id,familyId:input.context.familyId,ownerPersonId:ownerId,privacy,effectiveFrom:scope.occurredAt,createdAt:scope.occurredAt}));
            }
            const portfolio:LongTermPortfolioRow={id:input.identifiers.portfolioId,mutationId:mutation.id,familyId:input.context.familyId,ownerPersonId:ownerId,name:input.command.portfolioName.normalize('NFKC').trim(),baseCurrency:'TRY',privacy,targetDate:target.value,purpose:'2032 hedefli uzun vadeli birikim ve yatırım takibi',createdAt:scope.occurredAt};requireOk(scope.insertPortfolio(portfolio));
            const plan:LongTermPortfolioPlanVersionRow={id:input.identifiers.planVersionId,portfolioId:portfolio.id,mutationId:mutation.id,familyId:input.context.familyId,ownerPersonId:ownerId,privacy:portfolio.privacy,version:1,effectiveMonth:input.command.effectiveMonth,monthlyContribution:seed.monthlyContribution,contributionCurrency:'TRY',contributionChangeReason:'Kullanıcı tarafından verilen başlangıç dağılımı',rebalanceIntervalMonths:6,inflationAdjustment:'manual_realized_inflation',targetDate:target.value,assumptions:seed.assumptions,createdAt:scope.occurredAt};if(!monthValid(plan.effectiveMonth)||target.value.slice(0,7)<plan.effectiveMonth)return err(invalid(input.context,'Başlangıç ayı veya hedef tarihi geçersiz.'));requireOk(scope.insertPlanVersion(plan));
            seed.allocations.forEach((allocation,index)=>requireOk(scope.insertAllocation({id:input.identifiers.allocationIds![index]!,portfolioId:portfolio.id,planVersionId:plan.id,instrumentId:idByTemplate.get(allocation.instrumentId)!,mutationId:mutation.id,familyId:input.context.familyId,ownerPersonId:ownerId,privacy:portfolio.privacy,sleeve:allocation.sleeve,targetBasisPoints:allocation.targetBasisPoints,carryoverPolicy:'same_instrument',displayOrder:allocation.displayOrder,...(allocation.note?{note:allocation.note}:{}),createdAt:scope.occurredAt})));requireOk(scope.insertPlanSeal({planVersionId:plan.id,mutationId:mutation.id,familyId:input.context.familyId,ownerPersonId:ownerId,privacy:portfolio.privacy,allocationCount:seed.allocations.length,totalBasisPoints:10000,createdAt:scope.occurredAt}));
            aggregateId=portfolio.id;break;
          }
          case 'instrument_revision':{
            if(!input.identifiers.instrumentId||!input.identifiers.instrumentRevisionId)return err(invalid(input.context,'Enstrüman kimlikleri eksik.'));
            const effective=asDate(input.command.effectiveFrom,input.context,'Geçerlilik tarihi');if(!effective.ok)return effective;
            const currency=normalizedCurrency(input.command.currency);if(!validCurrency(currency)||effective.value>scope.occurredAt)return err(invalid(input.context,'Para birimi veya gelecekteki geçerlilik tarihi geçersiz.'));
            if(input.command.replacesRevisionId){
              const previous=requireOk(scope.findInstrumentRevision(input.command.replacesRevisionId));
              const revisions=requireOk(scope.listInstrumentRevisions()).filter(item=>item.instrumentId===input.identifiers.instrumentId).toSorted((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom)||b.createdAt.localeCompare(a.createdAt));
              if(!previous||previous.instrumentId!==input.identifiers.instrumentId)return err(missing(input.context,'Önceki enstrüman sürümü bulunamadı.'));
              if(revisions[0]?.revisionId!==previous.revisionId||effective.value<=previous.effectiveFrom)return err(invalid(input.context,'Yeni sürüm yalnız son sürümü, daha ileri bir geçerlilik tarihiyle izleyebilir.'));
            }else requireOk(scope.insertInstrument({id:input.identifiers.instrumentId,mutationId:mutation.id,familyId:input.context.familyId,ownerPersonId:ownerId,privacy,createdAt:scope.occurredAt}));
            requireOk(scope.insertInstrumentRevision({revisionId:input.identifiers.instrumentRevisionId,instrumentId:input.identifiers.instrumentId,mutationId:mutation.id,familyId:input.context.familyId,ownerPersonId:ownerId,privacy,assetClass:input.command.assetClass,groupLabel:input.command.groupLabel.normalize('NFKC').trim(),code:input.command.code.normalize('NFKC').trim().toUpperCase(),name:input.command.name.normalize('NFKC').trim(),currency,effectiveFrom:effective.value,status:input.command.status,...(input.command.isin?{isin:input.command.isin}:{}),...(input.command.exchange?{exchange:input.command.exchange}:{}),...(input.command.countryCode?{countryCode:input.command.countryCode}:{}),...(input.command.priceSource?{priceSource:input.command.priceSource}:{}),...(input.command.taxProfile?{taxProfile:input.command.taxProfile}:{}),...(input.command.feeProfile?{feeProfile:input.command.feeProfile}:{}),...(input.command.notes?{notes:input.command.notes}:{}),...(input.command.replacesRevisionId?{replacesRevisionId:input.command.replacesRevisionId}:{}),dataSource:'user_entered',externalVerification:'not_performed',createdAt:scope.occurredAt}));aggregateId=input.identifiers.instrumentId;break;
          }
          case 'plan_version':{
            const command=input.command;
            if(!input.identifiers.planVersionId||!input.identifiers.allocationIds||command.allocations.length<1||input.identifiers.allocationIds.length!==command.allocations.length)return err(invalid(input.context,'Plan veya dağılım kimlikleri eksik.'));
            const portfolio=requireOk(scope.findPortfolio(command.portfolioId));if(!portfolio)return err(missing(input.context,'Portföy bulunamadı.'));
            const plans=requireOk(scope.listPlanVersions(portfolio.id));
            const allocationKeys=command.allocations.map(item=>`${item.instrumentId}:${item.sleeve}`);
            if(!monthValid(command.effectiveMonth)||command.allocations.reduce((sum,item)=>sum+item.targetBasisPoints,0)!==10000||!validAssumptions(command.assumptions)||new Set(allocationKeys).size!==allocationKeys.length||command.allocations.some(item=>!Number.isInteger(item.targetBasisPoints)||item.targetBasisPoints<0||item.targetBasisPoints>10000||!Number.isInteger(item.displayOrder)||item.displayOrder<1||item.displayOrder>10000))return err(invalid(input.context,'Plan ayı, varsayımlar ve tam %100 dağılım geçerli olmalıdır.'));
            if(plans.some(item=>item.effectiveMonth===command.effectiveMonth))return err(invalid(input.context,'Aynı geçerlilik ayı için plan sürümü zaten var.'));
            for(const item of command.allocations)if(!requireOk(scope.findInstrument(item.instrumentId)))return err(missing(input.context,'Dağılımdaki enstrüman bulunamadı.'));
            const target=asDate(command.targetDate,input.context,'Hedef tarihi');if(!target.ok)return target;
            const currency=normalizedCurrency(command.contributionCurrency);
            if(!validCurrency(currency)||currency!==portfolio.baseCurrency||target.value.slice(0,7)<command.effectiveMonth||!finite(command.monthlyContribution)||command.monthlyContribution<=0||!Number.isInteger(command.rebalanceIntervalMonths)||command.rebalanceIntervalMonths<1||command.rebalanceIntervalMonths>60)return err(invalid(input.context,'Aylık tutar, hedef tarihi, dengeleme aralığı veya baz para birimi geçersiz.'));
            const previous=plans.toSorted((a,b)=>b.version-a.version)[0];
            if(previous&&command.effectiveMonth<=previous.effectiveMonth)return err(invalid(input.context,'Yeni planın geçerlilik ayı son plan sürümünden ileri olmalıdır.'));
            if(previous&&command.effectiveMonth.endsWith('-01')&&command.inflationAdjustment==='manual_realized_inflation'){
              const inflationFloor=previous.monthlyContribution*(1+command.assumptions.annualInflationBasisPoints/10000);
              if(command.monthlyContribution+0.000001<inflationFloor)return err(invalid(input.context,'Ocak planı aylık katkıyı girilen gerçekleşmiş enflasyonun altında artıramaz.'));
            }
            const plan:LongTermPortfolioPlanVersionRow={id:input.identifiers.planVersionId,portfolioId:portfolio.id,mutationId:mutation.id,familyId:input.context.familyId,ownerPersonId:portfolio.ownerPersonId,privacy:portfolio.privacy,version:(previous?.version??0)+1,effectiveMonth:command.effectiveMonth,monthlyContribution:command.monthlyContribution,contributionCurrency:currency,contributionChangeReason:command.contributionChangeReason.normalize('NFKC').trim(),rebalanceIntervalMonths:command.rebalanceIntervalMonths,inflationAdjustment:command.inflationAdjustment,targetDate:target.value,assumptions:command.assumptions,...(previous?{supersedesPlanVersionId:previous.id}:{}),createdAt:scope.occurredAt};
            requireOk(scope.insertPlanVersion(plan));
            command.allocations.forEach((allocation,index)=>requireOk(scope.insertAllocation({id:input.identifiers.allocationIds![index]!,portfolioId:portfolio.id,planVersionId:plan.id,instrumentId:allocation.instrumentId,mutationId:mutation.id,familyId:input.context.familyId,ownerPersonId:portfolio.ownerPersonId,privacy:portfolio.privacy,sleeve:allocation.sleeve,targetBasisPoints:allocation.targetBasisPoints,carryoverPolicy:'same_instrument',displayOrder:allocation.displayOrder,...(allocation.note?{note:allocation.note}:{}),createdAt:scope.occurredAt})));
            requireOk(scope.insertPlanSeal({planVersionId:plan.id,mutationId:mutation.id,familyId:input.context.familyId,ownerPersonId:portfolio.ownerPersonId,privacy:portfolio.privacy,allocationCount:command.allocations.length,totalBasisPoints:10000,createdAt:scope.occurredAt}));
            aggregateId=plan.id;break;
          }
          case 'ledger_event':{
            if(!input.identifiers.ledgerEventId)return err(invalid(input.context,'Defter olayı kimliği eksik.'));
            const command=input.command;const portfolio=requireOk(scope.findPortfolio(command.portfolioId));if(!portfolio)return err(missing(input.context,'Portföy bulunamadı.'));
            const portfolioEvents=requireOk(scope.listLedgerEvents(portfolio.id));
            if(command.instrumentId&&!requireOk(scope.findInstrument(command.instrumentId)))return err(missing(input.context,'Enstrüman bulunamadı.'));
            const allRevisions=requireOk(scope.listInstrumentRevisions());
            const executed=asDate(command.executedAt,input.context,'Gerçekleşme tarihi');if(!executed.ok)return executed;
            const revisions=currentRevisionByInstrument(allRevisions.filter(item=>item.effectiveFrom<=executed.value));
            const instrumentRevision=command.instrumentId?revisions.get(command.instrumentId):undefined;
            const order=command.orderAt?asDate(command.orderAt,input.context,'Sipariş tarihi'):undefined;if(order&&!order.ok)return order;
            const settlement=command.settlementAt?asDate(command.settlementAt,input.context,'Takas tarihi'):undefined;if(settlement&&!settlement.ok)return settlement;
            const entitlement=command.entitlementAt?asDate(command.entitlementAt,input.context,'Hak kazanım tarihi'):undefined;if(entitlement&&!entitlement.ok)return entitlement;
            const record=command.recordAt?asDate(command.recordAt,input.context,'Kayıt tarihi'):undefined;if(record&&!record.ok)return record;
            const payment=command.paymentAt?asDate(command.paymentAt,input.context,'Ödeme tarihi'):undefined;if(payment&&!payment.ok)return payment;
            if(executed.value>scope.occurredAt||order?.ok&&order.value>executed.value||settlement?.ok&&settlement.value<executed.value||entitlement?.ok&&record?.ok&&entitlement.value>record.value||entitlement?.ok&&payment?.ok&&entitlement.value>payment.value||record?.ok&&payment?.ok&&record.value>payment.value)return err(invalid(input.context,'İşlem tarihleri gelecekte olamaz; sipariş, gerçekleşme, takas ve hak tarihleri kronolojik olmalıdır.'));
            const trade=command.eventType==='buy'||command.eventType==='sell';
            if(trade&&(!command.instrumentId||!order?.ok||!settlement?.ok||!command.quantity||command.unitPrice===undefined))return err(invalid(input.context,'Alım/satım için kıymet, sipariş, gerçekleşme, takas, adet ve fiyat zorunludur.'));
            if(trade&&command.quantity!==undefined&&command.unitPrice!==undefined&&Math.abs(command.grossAmount-command.quantity*command.unitPrice)>0.01)return err(invalid(input.context,'Alım/satım brüt tutarı adet ile birim fiyat çarpımına eşit olmalıdır.'));
            const quantityEvents=new Set<LongTermPortfolioLedgerEventType>(['buy','sell','rights_issue_used','rights_issue_sold','rights_issue_expired','bonus_shares','split','reverse_split','transfer_in']);
            if(quantityEvents.has(command.eventType)&&(!command.instrumentId||command.quantity===undefined))return err(invalid(input.context,'Bu kıymet olayı pozitif bir adet gerektirir.'));
            if((command.eventType==='split'||command.eventType==='reverse_split'||command.eventType==='merger_exchange')&&(command.ratioNumerator===undefined||command.ratioDenominator===undefined))return err(invalid(input.context,'Bölünme veya değişim işlemi pay/payda oranı gerektirir.'));
            if(command.instrumentId&&command.quantity!==undefined&&new Set<LongTermPortfolioLedgerEventType>(['sell','rights_issue_sold','rights_issue_expired','reverse_split']).has(command.eventType)){
              const reversedExisting=new Set(portfolioEvents.filter(item=>item.eventType==='reversal'&&item.reversalOfEventId).map(item=>item.reversalOfEventId!));
              if(!quantityTimelineRemainsNonNegative(portfolioEvents,command.instrumentId,reversedExisting,{eventType:command.eventType,quantity:command.quantity,executedAt:executed.value}))return err(invalid(input.context,'Kıymet çıkış adedi işlem zaman çizelgesindeki kullanılabilir adedi aşamaz.'));
            }
            if(incomeEventTypes.has(command.eventType)&&(!record?.ok||!payment?.ok||!command.instrumentId||command.cashCarryoverInstrumentId!==command.instrumentId))return err(invalid(input.context,'Gelir işlemi kayıt/ödeme tarihleriyle aynı kıymete devredilmelidir.'));
            if(corporateEventTypes.has(command.eventType)&&(!command.instrumentId||!command.corporateActionReference))return err(invalid(input.context,'Kurumsal işlem için kıymet ve kaynak referansı zorunludur.'));
            if(command.cashCarryoverInstrumentId&&command.cashCarryoverInstrumentId!==command.instrumentId)return err(invalid(input.context,'Kalan nakit yalnız aynı kıymete devredilebilir; başka kıymet için açık virman gerekir.'));
            const currency=normalizedCurrency(command.currency);
            if(command.eventType==='transfer_out'){
              const counterparty=command.transferCounterpartyInstrumentId?requireOk(scope.findInstrument(command.transferCounterpartyInstrumentId)):null;
              const counterpartyRevision=command.transferCounterpartyInstrumentId?revisions.get(command.transferCounterpartyInstrumentId):undefined;
              if(!command.instrumentId||!command.transferCounterpartyInstrumentId||command.transferCounterpartyInstrumentId===command.instrumentId||!counterparty||!counterpartyRevision||counterpartyRevision.currency!==currency||command.quantity!==undefined||command.grossAmount<=0)return err(invalid(input.context,'Kıymetler arası bütçe virmanı aynı para birimindeki farklı iki kıymeti, pozitif tutarı ve adetsiz tek atomik kaydı gerektirir.'));
            }else if(command.transferCounterpartyInstrumentId)return err(invalid(input.context,'Virman hedefi yalnız kıymetler arası bütçe virmanında kullanılabilir.'));
            if(command.eventType==='transfer_in'&&!command.sourceDocumentReference?.trim())return err(invalid(input.context,'Haricî kıymet virman girişi kaynak belge veya dekont referansı gerektirir.'));
            const reversal=command.eventType==='reversal';
            if(reversal!==Boolean(command.reversalOfEventId)||reversal&&(!command.correctionReason||command.correctionReason.trim().length<3))return err(invalid(input.context,'Düzeltme yalnız gerekçeli ve referanslı ters kayıtla yapılır.'));
            if(command.reversalOfEventId){const original=requireOk(scope.findLedgerEvent(command.reversalOfEventId));if(!original||original.portfolioId!==portfolio.id||original.eventType==='reversal')return err(missing(input.context,'Ters çevrilecek asıl kayıt bulunamadı.'));if(portfolioEvents.some(item=>item.reversalOfEventId===original.id))return err(invalid(input.context,'Bu kayıt daha önce ters çevrilmiş.'));if(original.instrumentId&&signedEvent(original,new Set()).quantity>0){const reversedExisting=new Set([...portfolioEvents.filter(item=>item.eventType==='reversal'&&item.reversalOfEventId).map(item=>item.reversalOfEventId!),original.id]);if(!quantityTimelineRemainsNonNegative(portfolioEvents,original.instrumentId,reversedExisting))return err(invalid(input.context,'Bu ters kayıt kıymet bakiyesini zaman çizelgesinde eksiye düşürür.'));}}
            const numeric=[command.grossAmount,command.feeAmount,command.taxAmount,command.netCashAmount,command.quantity,command.unitPrice,command.fxRate,command.ratioNumerator,command.ratioDenominator].filter((value):value is number=>value!==undefined);
            const expectedDirection=directionForEvent(command.eventType);
            const validDirection=command.eventType==='cash_adjustment'?(command.direction==='cash_in'||command.direction==='cash_out'):command.direction===expectedDirection;
            const calculatedNet=expectedNetCash(command.direction,command.grossAmount,command.feeAmount,command.taxAmount);
            if(!validCurrency(currency)||currency!==(instrumentRevision?.currency??portfolio.baseCurrency)||currency!==portfolio.baseCurrency&&command.fxRate===undefined||!numeric.every(finite)||!validDirection||Math.abs(command.netCashAmount-calculatedNet)>0.000001||command.grossAmount<0||command.feeAmount<0||command.taxAmount<0||command.quantity!==undefined&&command.quantity<=0||command.unitPrice!==undefined&&command.unitPrice<0||command.fxRate!==undefined&&command.fxRate<=0||command.ratioNumerator!==undefined&&command.ratioNumerator<=0||command.ratioDenominator!==undefined&&command.ratioDenominator<=0||command.partialFillSequence!==undefined&&(!Number.isInteger(command.partialFillSequence)||command.partialFillSequence<1))return err(invalid(input.context,'Tutar, yön, net nakit, kur, oran, sıra veya para birimi geçersiz.'));
            if(command.eventType==='transfer_out'&&command.instrumentId&&!budgetTransferTimelineRemainsNonNegative({portfolio,plans:requireOk(scope.listPlanVersions(portfolio.id)),allocations:requireOk(scope.listAllocations(portfolio.id)),events:portfolioEvents,sourceInstrumentId:command.instrumentId,executedAt:executed.value,grossAmount:command.grossAmount,currency,fxRate:command.fxRate,through:scope.occurredAt}))return err(invalid(input.context,'Bütçe virmanı kaynak kıymetin aylık kullanılabilir ve devreden tutarını aşamaz.'));
            const event:LongTermPortfolioLedgerEventRow={id:input.identifiers.ledgerEventId,portfolioId:portfolio.id,...(command.instrumentId?{instrumentId:command.instrumentId}:{}),mutationId:mutation.id,familyId:input.context.familyId,ownerPersonId:portfolio.ownerPersonId,privacy:portfolio.privacy,eventType:command.eventType,direction:command.direction,currency,...(order?.ok?{orderAt:order.value}:{}),executedAt:executed.value,...(settlement?.ok?{settlementAt:settlement.value}:{}),...(entitlement?.ok?{entitlementAt:entitlement.value}:{}),...(record?.ok?{recordAt:record.value}:{}),...(payment?.ok?{paymentAt:payment.value}:{}),...(command.quantity===undefined?{}:{quantity:command.quantity}),...(command.unitPrice===undefined?{}:{unitPrice:command.unitPrice}),grossAmount:command.grossAmount,feeAmount:command.feeAmount,taxAmount:command.taxAmount,netCashAmount:command.netCashAmount,...(command.fxRate===undefined?{}:{fxRate:command.fxRate}),...(command.broker?{broker:command.broker}:{}),...(command.accountReference?{accountReference:command.accountReference}:{}),...(command.orderReference?{orderReference:command.orderReference}:{}),...(command.executionReference?{executionReference:command.executionReference}:{}),...(command.partialFillSequence===undefined?{}:{partialFillSequence:command.partialFillSequence}),...(command.lotReference?{lotReference:command.lotReference}:{}),...(command.costLayerMethod?{costLayerMethod:command.costLayerMethod}:{}),...(command.corporateActionReference?{corporateActionReference:command.corporateActionReference}:{}),...(command.ratioNumerator===undefined?{}:{ratioNumerator:command.ratioNumerator}),...(command.ratioDenominator===undefined?{}:{ratioDenominator:command.ratioDenominator}),...(command.cashCarryoverInstrumentId?{cashCarryoverInstrumentId:command.cashCarryoverInstrumentId}:{}),...(command.transferCounterpartyInstrumentId?{transferCounterpartyInstrumentId:command.transferCounterpartyInstrumentId}:{}),...(command.reversalOfEventId?{reversalOfEventId:command.reversalOfEventId}:{}),...(command.correctionReason?{correctionReason:command.correctionReason}:{}),sourceLabel:command.sourceLabel,...(command.sourceDocumentReference?{sourceDocumentReference:command.sourceDocumentReference}:{}),...(command.notes?{notes:command.notes}:{}),dataSource:'user_entered',externalVerification:'not_performed',createdAt:scope.occurredAt};
            requireOk(scope.insertLedgerEvent(event));aggregateId=event.id;break;
          }
          case 'price_observation':{
            if(!input.identifiers.priceObservationId)return err(invalid(input.context,'Fiyat gözlemi kimliği eksik.'));
            const instrument=requireOk(scope.findInstrument(input.command.instrumentId));if(!instrument)return err(missing(input.context,'Enstrüman bulunamadı.'));
            const portfolios=requireOk(scope.listPortfolios());const portfolio=portfolios[0];if(!portfolio)return err(missing(input.context,'Portföy bulunamadı.'));
            const observed=asDate(input.command.observedAt,input.context,'Fiyat tarihi');if(!observed.ok)return observed;
            const revision=currentRevisionByInstrument(requireOk(scope.listInstrumentRevisions()).filter(item=>item.effectiveFrom<=observed.value)).get(instrument.id);
            const currency=normalizedCurrency(input.command.currency);
            if(!revision||observed.value>scope.occurredAt||!validCurrency(currency)||currency!==revision.currency||!finite(input.command.unitPrice)||input.command.unitPrice<=0)return err(invalid(input.context,'Birim fiyat, para birimi veya gelecekteki gözlem tarihi geçersiz.'));
            const price:LongTermPortfolioPriceObservationRow={id:input.identifiers.priceObservationId,portfolioId:portfolio.id,instrumentId:instrument.id,mutationId:mutation.id,familyId:input.context.familyId,ownerPersonId:portfolio.ownerPersonId,privacy:portfolio.privacy,observedAt:observed.value,unitPrice:input.command.unitPrice,currency,sourceLabel:input.command.sourceLabel,dataSource:'user_entered',externalVerification:'not_performed',createdAt:scope.occurredAt};requireOk(scope.insertPriceObservation(price));aggregateId=price.id;break;
          }
        }
        requireOk(scope.appendAudit({id:input.identifiers.auditId,action:`long_term_portfolio.${input.command.itemType}.recorded`,resourceType:'finance_record',resourceId:mutation.id,occurredAt:scope.occurredAt,actorId:input.context.actor.userId}));requireOk(scope.enqueueEvent({eventId:input.identifiers.outboxEventId,eventType:`long_term_portfolio.${input.command.itemType}.recorded`,eventVersion:1,aggregateType:'finance_record',aggregateId:mutation.id,occurredAt:scope.occurredAt,actorId:input.context.actor.userId,correlationId:input.context.correlationId,payload:{mutationId:mutation.id,itemType:input.command.itemType,aggregateId}}));return ok(aggregateId);
      }catch(error){if(error&&typeof error==='object'&&'code' in error)return err(error as AppError);throw error;}
    });
  }
}
