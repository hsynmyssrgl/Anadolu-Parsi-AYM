import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type {
  LongTermPortfolioAllocationSleeve,
  LongTermPortfolioAssetClass,
  LongTermPortfolioInstrumentStatus,
  LongTermPortfolioLedgerEventType,
  LongTermPortfolioPrivacy
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type LongTermPortfolioAllocationRow,
  type LongTermPortfolioInstrumentRevisionRow,
  type LongTermPortfolioInstrumentRow,
  type LongTermPortfolioLedgerEventRow,
  type LongTermPortfolioMutationRow,
  type LongTermPortfolioPlanVersionRow,
  type LongTermPortfolioPriceObservationRow,
  type LongTermPortfolioRepository,
  type LongTermPortfolioRow,
  type NewLongTermPortfolioAllocationRow,
  type NewLongTermPortfolioInstrumentRevisionRow,
  type NewLongTermPortfolioInstrumentRow,
  type NewLongTermPortfolioLedgerEventRow,
  type NewLongTermPortfolioMutationRow,
  type NewLongTermPortfolioPlanSealRow,
  type NewLongTermPortfolioPlanVersionRow,
  type NewLongTermPortfolioPriceObservationRow,
  type NewLongTermPortfolioRow,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';

const assertCollectionRead=(context:PolicyAuthorizedRepositoryExecutionContext):void=>assertPolicyAuthorizedRepositoryContext(context,{
  resourceType:'finance_record',resourceId:'*',action:'read',capability:'finance.read',correlationId:context.correlationId
});

type LongTermPortfolioScopedRow={readonly familyId:string;readonly ownerPersonId:string;readonly privacy:LongTermPortfolioPrivacy};

const sensitivityForPrivacy=(privacy:LongTermPortfolioPrivacy):'highly_sensitive'|'sensitive'|'personal'=>{
  if(privacy==='private')return 'highly_sensitive';
  if(privacy==='selected_members')return 'sensitive';
  return 'personal';
};

const assertMutationWrite=(context:PolicyAuthorizedRepositoryExecutionContext,mutationId:string,row?:LongTermPortfolioScopedRow):void=>{
  assertPolicyAuthorizedRepositoryContext(context,{
    resourceType:'finance_record',resourceId:mutationId,action:'create',capability:'finance.write',correlationId:context.correlationId,
    purpose:'finance',...(row?{resourceFamilyId:row.familyId,resourceOwnerPersonId:row.ownerPersonId}: {})
  });
  if(!row)return;
  const authorizedSensitivity=context.policyAuthorization.receiptRecord.request.resource.sensitivity;
  if(
    context.policyAuthorization.resourceFamilyId!==row.familyId
    || context.policyAuthorization.resourceOwnerPersonId!==row.ownerPersonId
    || context.policyAuthorization.purpose!=='finance'
    || authorizedSensitivity!==sensitivityForPrivacy(row.privacy)
  )throw new Error('Long-term portfolio row scope does not match the exact finance policy receipt');
};

const scope=(row:Record<string,unknown>)=>({
  familyId:asFamilyId(String(row.family_id)),ownerPersonId:asPersonId(String(row.owner_person_id)),privacy:String(row.privacy) as LongTermPortfolioPrivacy
});

const mapMutation=(row:Record<string,unknown>):LongTermPortfolioMutationRow=>({id:String(row.id),clientOperationId:String(row.client_operation_id),requestFingerprint:String(row.request_fingerprint),...scope(row),operation:String(row.operation) as LongTermPortfolioMutationRow['operation'],resourceId:String(row.resource_id),createdAt:asIsoDateTime(String(row.created_at))});
const mapInstrument=(row:Record<string,unknown>):LongTermPortfolioInstrumentRow=>({id:String(row.id),mutationId:String(row.mutation_id),...scope(row),createdAt:asIsoDateTime(String(row.created_at))});
const mapRevision=(row:Record<string,unknown>):LongTermPortfolioInstrumentRevisionRow=>({
  revisionId:String(row.revision_id),instrumentId:String(row.instrument_id),mutationId:String(row.mutation_id),...scope(row),
  assetClass:String(row.asset_class) as LongTermPortfolioAssetClass,groupLabel:String(row.group_label),code:String(row.code),name:String(row.name),currency:String(row.currency),effectiveFrom:asIsoDateTime(String(row.effective_from)),status:String(row.status) as LongTermPortfolioInstrumentStatus,
  ...(row.isin?{isin:String(row.isin)}:{}),...(row.exchange_name?{exchange:String(row.exchange_name)}:{}),...(row.country_code?{countryCode:String(row.country_code)}:{}),...(row.price_source?{priceSource:String(row.price_source)}:{}),...(row.tax_profile?{taxProfile:String(row.tax_profile)}:{}),...(row.fee_profile?{feeProfile:String(row.fee_profile)}:{}),...(row.notes?{notes:String(row.notes)}:{}),...(row.replaces_revision_id?{replacesRevisionId:String(row.replaces_revision_id)}:{}),
  dataSource:String(row.data_source) as LongTermPortfolioInstrumentRevisionRow['dataSource'],externalVerification:String(row.external_verification) as LongTermPortfolioInstrumentRevisionRow['externalVerification'],createdAt:asIsoDateTime(String(row.created_at))
});
const mapPortfolio=(row:Record<string,unknown>):LongTermPortfolioRow=>({id:String(row.id),mutationId:String(row.mutation_id),...scope(row),name:String(row.name),baseCurrency:String(row.base_currency),targetDate:asIsoDateTime(String(row.target_date)),purpose:String(row.purpose),createdAt:asIsoDateTime(String(row.created_at))});
const mapPlan=(row:Record<string,unknown>):LongTermPortfolioPlanVersionRow=>({
  id:String(row.id),portfolioId:String(row.portfolio_id),mutationId:String(row.mutation_id),...scope(row),version:Number(row.version),effectiveMonth:String(row.effective_month),monthlyContribution:Number(row.monthly_contribution),contributionCurrency:String(row.contribution_currency),contributionChangeReason:String(row.contribution_change_reason),rebalanceIntervalMonths:Number(row.rebalance_interval_months),inflationAdjustment:String(row.inflation_adjustment) as LongTermPortfolioPlanVersionRow['inflationAdjustment'],targetDate:asIsoDateTime(String(row.target_date)),
  assumptions:{pessimisticAnnualReturnBasisPoints:Number(row.pessimistic_return_bps),baseAnnualReturnBasisPoints:Number(row.base_return_bps),optimisticAnnualReturnBasisPoints:Number(row.optimistic_return_bps),annualInflationBasisPoints:Number(row.annual_inflation_bps),annualContributionGrowthBasisPoints:Number(row.annual_contribution_growth_bps)},
  ...(row.supersedes_plan_version_id?{supersedesPlanVersionId:String(row.supersedes_plan_version_id)}:{}),createdAt:asIsoDateTime(String(row.created_at))
});
const mapAllocation=(row:Record<string,unknown>):LongTermPortfolioAllocationRow=>({id:String(row.id),portfolioId:String(row.portfolio_id),planVersionId:String(row.plan_version_id),instrumentId:String(row.instrument_id),mutationId:String(row.mutation_id),...scope(row),sleeve:String(row.sleeve) as LongTermPortfolioAllocationSleeve,targetBasisPoints:Number(row.target_basis_points),carryoverPolicy:'same_instrument',displayOrder:Number(row.display_order),...(row.note?{note:String(row.note)}:{}),createdAt:asIsoDateTime(String(row.created_at))});
const mapEvent=(row:Record<string,unknown>):LongTermPortfolioLedgerEventRow=>({
  id:String(row.id),portfolioId:String(row.portfolio_id),...(row.instrument_id?{instrumentId:String(row.instrument_id)}:{}),mutationId:String(row.mutation_id),...scope(row),eventType:String(row.event_type) as LongTermPortfolioLedgerEventType,direction:String(row.direction) as LongTermPortfolioLedgerEventRow['direction'],currency:String(row.currency),...(row.order_at?{orderAt:asIsoDateTime(String(row.order_at))}:{}),executedAt:asIsoDateTime(String(row.executed_at)),...(row.settlement_at?{settlementAt:asIsoDateTime(String(row.settlement_at))}:{}),...(row.entitlement_at?{entitlementAt:asIsoDateTime(String(row.entitlement_at))}:{}),...(row.record_at?{recordAt:asIsoDateTime(String(row.record_at))}:{}),...(row.payment_at?{paymentAt:asIsoDateTime(String(row.payment_at))}:{}),
  ...(row.quantity===null||row.quantity===undefined?{}:{quantity:Number(row.quantity)}),...(row.unit_price===null||row.unit_price===undefined?{}:{unitPrice:Number(row.unit_price)}),grossAmount:Number(row.gross_amount),feeAmount:Number(row.fee_amount),taxAmount:Number(row.tax_amount),netCashAmount:Number(row.net_cash_amount),...(row.fx_rate===null||row.fx_rate===undefined?{}:{fxRate:Number(row.fx_rate)}),...(row.broker?{broker:String(row.broker)}:{}),...(row.account_reference?{accountReference:String(row.account_reference)}:{}),...(row.order_reference?{orderReference:String(row.order_reference)}:{}),...(row.execution_reference?{executionReference:String(row.execution_reference)}:{}),...(row.partial_fill_sequence===null||row.partial_fill_sequence===undefined?{}:{partialFillSequence:Number(row.partial_fill_sequence)}),...(row.lot_reference?{lotReference:String(row.lot_reference)}:{}),...(row.cost_layer_method?{costLayerMethod:String(row.cost_layer_method) as Exclude<LongTermPortfolioLedgerEventRow['costLayerMethod'],undefined>}:{}),...(row.corporate_action_reference?{corporateActionReference:String(row.corporate_action_reference)}:{}),...(row.ratio_numerator===null||row.ratio_numerator===undefined?{}:{ratioNumerator:Number(row.ratio_numerator)}),...(row.ratio_denominator===null||row.ratio_denominator===undefined?{}:{ratioDenominator:Number(row.ratio_denominator)}),...(row.cash_carryover_instrument_id?{cashCarryoverInstrumentId:String(row.cash_carryover_instrument_id)}:{}),...(row.transfer_counterparty_instrument_id?{transferCounterpartyInstrumentId:String(row.transfer_counterparty_instrument_id)}:{}),...(row.reversal_of_event_id?{reversalOfEventId:String(row.reversal_of_event_id)}:{}),...(row.correction_reason?{correctionReason:String(row.correction_reason)}:{}),sourceLabel:String(row.source_label),...(row.source_document_reference?{sourceDocumentReference:String(row.source_document_reference)}:{}),...(row.notes?{notes:String(row.notes)}:{}),dataSource:String(row.data_source) as LongTermPortfolioLedgerEventRow['dataSource'],externalVerification:String(row.external_verification) as LongTermPortfolioLedgerEventRow['externalVerification'],createdAt:asIsoDateTime(String(row.created_at))
});
const mapPrice=(row:Record<string,unknown>):LongTermPortfolioPriceObservationRow=>({id:String(row.id),portfolioId:String(row.portfolio_id),instrumentId:String(row.instrument_id),mutationId:String(row.mutation_id),...scope(row),observedAt:asIsoDateTime(String(row.observed_at)),unitPrice:Number(row.unit_price),currency:String(row.currency),sourceLabel:String(row.source_label),dataSource:String(row.data_source) as LongTermPortfolioPriceObservationRow['dataSource'],externalVerification:String(row.external_verification) as LongTermPortfolioPriceObservationRow['externalVerification'],createdAt:asIsoDateTime(String(row.created_at))});

const budgetTransferBalanceSql=`
WITH RECURSIVE
input(portfolio_id,family_id,source_instrument_id,target_instrument_id,executed_at,created_at,currency,fx_rate,gross_amount) AS (
  VALUES(?,?,?,?,?,?,?,?,?)
),
portfolio AS (
  SELECT portfolio.id,portfolio.base_currency
  FROM long_term_portfolios portfolio
  JOIN input ON input.portfolio_id=portfolio.id AND input.family_id=portfolio.family_id
),
bounds AS (
  SELECT
    (SELECT min(plan.effective_month)
     FROM long_term_portfolio_plan_versions plan
     JOIN long_term_portfolio_plan_seals seal ON seal.plan_version_id=plan.id
     WHERE plan.portfolio_id=input.portfolio_id
       AND plan.family_id=input.family_id
       AND plan.effective_month<=substr(input.created_at,1,7)) AS first_month,
    substr(input.executed_at,1,7) AS transfer_month,
    substr(input.created_at,1,7) AS through_month
  FROM input
),
months(month,ordinal) AS (
  SELECT first_month,0 FROM bounds WHERE first_month IS NOT NULL
  UNION ALL
  SELECT strftime('%Y-%m',date(month||'-01','+1 month')),ordinal+1
  FROM months,bounds
  WHERE month<through_month AND ordinal<599
),
active_plans AS (
  SELECT months.month,
    (SELECT plan.id
     FROM long_term_portfolio_plan_versions plan
     JOIN long_term_portfolio_plan_seals seal ON seal.plan_version_id=plan.id
     WHERE plan.portfolio_id=input.portfolio_id
       AND plan.family_id=input.family_id
       AND plan.effective_month<=months.month
     ORDER BY plan.effective_month DESC,plan.version DESC
     LIMIT 1) AS plan_version_id
  FROM months CROSS JOIN input
),
planned_budgets AS (
  SELECT active_plans.month,
    coalesce(sum(CASE WHEN allocation.instrument_id=input.source_instrument_id
      THEN plan.monthly_contribution*allocation.target_basis_points/10000.0 ELSE 0 END),0) AS planned_amount,
    max(CASE WHEN plan.contribution_currency=portfolio.base_currency THEN 0 ELSE 1 END) AS invalid
  FROM active_plans
  JOIN long_term_portfolio_plan_versions plan ON plan.id=active_plans.plan_version_id
  LEFT JOIN long_term_portfolio_allocations allocation ON allocation.plan_version_id=plan.id
  CROSS JOIN input CROSS JOIN portfolio
  GROUP BY active_plans.month
),
relevant_events AS (
  SELECT
    substr(CASE WHEN event.event_type IN ('cash_dividend','coupon','interest','fund_distribution')
      THEN coalesce(event.payment_at,event.executed_at) ELSE event.executed_at END,1,7) AS month,
    event.*,
    CASE WHEN event.currency=portfolio.base_currency THEN 1.0 ELSE event.fx_rate END AS base_rate
  FROM long_term_portfolio_ledger_events event
  CROSS JOIN input CROSS JOIN portfolio CROSS JOIN bounds
  WHERE event.portfolio_id=input.portfolio_id
    AND event.family_id=input.family_id
    AND event.executed_at<=input.created_at
    AND event.event_type<>'reversal'
    AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_ledger_events reversal WHERE reversal.reversal_of_event_id=event.id)
    AND substr(CASE WHEN event.event_type IN ('cash_dividend','coupon','interest','fund_distribution')
      THEN coalesce(event.payment_at,event.executed_at) ELSE event.executed_at END,1,7)
      BETWEEN bounds.first_month AND bounds.through_month
    AND (event.instrument_id=input.source_instrument_id
      OR event.cash_carryover_instrument_id=input.source_instrument_id
      OR event.transfer_counterparty_instrument_id=input.source_instrument_id)
),
event_budgets AS (
  SELECT month,
    sum(
      CASE WHEN event_type='buy' AND instrument_id=(SELECT source_instrument_id FROM input)
        THEN -max(0,-net_cash_amount)*base_rate ELSE 0 END
      +CASE WHEN cash_carryover_instrument_id=(SELECT source_instrument_id FROM input) AND net_cash_amount>0
        THEN net_cash_amount*base_rate ELSE 0 END
      +CASE WHEN event_type='transfer_out' AND instrument_id=(SELECT source_instrument_id FROM input)
        THEN -gross_amount*base_rate ELSE 0 END
      +CASE WHEN event_type='transfer_out' AND transfer_counterparty_instrument_id=(SELECT source_instrument_id FROM input)
        THEN gross_amount*base_rate ELSE 0 END
    ) AS net_amount,
    max(CASE WHEN base_rate IS NULL OR base_rate<=0 THEN 1 ELSE 0 END) AS invalid
  FROM relevant_events
  GROUP BY month
),
monthly AS (
  SELECT months.month,
    planned_budgets.planned_amount+coalesce(event_budgets.net_amount,0)
      -CASE WHEN months.month=bounds.transfer_month THEN input.gross_amount*
        CASE WHEN input.currency=portfolio.base_currency THEN 1.0 ELSE input.fx_rate END ELSE 0 END AS net_amount,
    CASE WHEN planned_budgets.invalid=1 OR coalesce(event_budgets.invalid,0)=1
      OR (months.month=bounds.transfer_month AND input.currency<>portfolio.base_currency AND (input.fx_rate IS NULL OR input.fx_rate<=0))
      THEN 1 ELSE 0 END AS invalid
  FROM months
  JOIN planned_budgets ON planned_budgets.month=months.month
  LEFT JOIN event_budgets ON event_budgets.month=months.month
  CROSS JOIN input CROSS JOIN portfolio CROSS JOIN bounds
),
timeline(month,closing_amount,invalid) AS (
  SELECT monthly.month,monthly.net_amount,
    CASE WHEN monthly.invalid=1 OR monthly.net_amount < -0.000001 THEN 1 ELSE 0 END
  FROM monthly,bounds WHERE monthly.month=bounds.first_month
  UNION ALL
  SELECT next.month,max(0.0,timeline.closing_amount)+next.net_amount,
    CASE WHEN timeline.invalid=1 OR next.invalid=1 OR max(0.0,timeline.closing_amount)+next.net_amount < -0.000001 THEN 1 ELSE 0 END
  FROM timeline
  JOIN monthly next ON next.month=strftime('%Y-%m',date(timeline.month||'-01','+1 month'))
),
semantic_scope AS (
  SELECT CASE WHEN
    input.source_instrument_id<>input.target_instrument_id
    AND EXISTS(SELECT 1 FROM long_term_portfolio_instrument_revisions revision
      WHERE revision.instrument_id=input.source_instrument_id AND revision.family_id=input.family_id
        AND revision.currency=input.currency AND revision.effective_from<=input.executed_at
        AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_instrument_revisions later
          WHERE later.instrument_id=revision.instrument_id AND later.effective_from<=input.executed_at
            AND later.effective_from>revision.effective_from))
    AND EXISTS(SELECT 1 FROM long_term_portfolio_instrument_revisions revision
      WHERE revision.instrument_id=input.target_instrument_id AND revision.family_id=input.family_id
        AND revision.currency=input.currency AND revision.effective_from<=input.executed_at
        AND NOT EXISTS(SELECT 1 FROM long_term_portfolio_instrument_revisions later
          WHERE later.instrument_id=revision.instrument_id AND later.effective_from<=input.executed_at
            AND later.effective_from>revision.effective_from))
    THEN 1 ELSE 0 END AS valid
  FROM input
)
SELECT CASE WHEN semantic_scope.valid=1
  AND bounds.first_month IS NOT NULL
  AND bounds.transfer_month BETWEEN bounds.first_month AND bounds.through_month
  AND (SELECT max(month) FROM timeline)=bounds.through_month
  AND coalesce((SELECT max(invalid) FROM timeline),1)=0
  THEN 1 ELSE 0 END AS valid
FROM input CROSS JOIN portfolio CROSS JOIN bounds CROSS JOIN semantic_scope
`;

export class SqliteLongTermPortfolioRepository extends SqliteRepository implements LongTermPortfolioRepository {
  public findMutationByClientOperationId(context:PolicyAuthorizedRepositoryExecutionContext,clientOperationId:string):RepositoryResult<LongTermPortfolioMutationRow|null>{return this.readForActiveContext(context,()=>{const row=this.database(context).prepare('SELECT * FROM long_term_portfolio_mutations WHERE family_id=? AND client_operation_id=?').get(context.policyAuthorization.resourceFamilyId,clientOperationId) as Record<string,unknown>|undefined;return row?mapMutation(row):null;});}
  public listPortfolios(context:PolicyAuthorizedRepositoryExecutionContext):RepositoryResult<readonly LongTermPortfolioRow[]>{return this.readForActiveContext(context,()=>(this.database(context).prepare('SELECT * FROM long_term_portfolios WHERE family_id=? ORDER BY created_at DESC,id').all(context.policyAuthorization.resourceFamilyId) as Record<string,unknown>[]).map(mapPortfolio));}
  public findPortfolio(context:PolicyAuthorizedRepositoryExecutionContext,id:string):RepositoryResult<LongTermPortfolioRow|null>{return this.readForActiveContext(context,()=>{const row=this.database(context).prepare('SELECT * FROM long_term_portfolios WHERE id=? AND family_id=?').get(id,context.policyAuthorization.resourceFamilyId) as Record<string,unknown>|undefined;return row?mapPortfolio(row):null;});}
  public listInstrumentRevisions(context:PolicyAuthorizedRepositoryExecutionContext):RepositoryResult<readonly LongTermPortfolioInstrumentRevisionRow[]>{return this.readForActiveContext(context,()=>(this.database(context).prepare('SELECT * FROM long_term_portfolio_instrument_revisions WHERE family_id=? ORDER BY effective_from DESC,created_at DESC,revision_id').all(context.policyAuthorization.resourceFamilyId) as Record<string,unknown>[]).map(mapRevision));}
  public findInstrument(context:PolicyAuthorizedRepositoryExecutionContext,id:string):RepositoryResult<LongTermPortfolioInstrumentRow|null>{return this.readForActiveContext(context,()=>{const row=this.database(context).prepare('SELECT * FROM long_term_portfolio_instruments WHERE id=? AND family_id=?').get(id,context.policyAuthorization.resourceFamilyId) as Record<string,unknown>|undefined;return row?mapInstrument(row):null;});}
  public findInstrumentRevision(context:PolicyAuthorizedRepositoryExecutionContext,id:string):RepositoryResult<LongTermPortfolioInstrumentRevisionRow|null>{return this.readForActiveContext(context,()=>{const row=this.database(context).prepare('SELECT * FROM long_term_portfolio_instrument_revisions WHERE revision_id=? AND family_id=?').get(id,context.policyAuthorization.resourceFamilyId) as Record<string,unknown>|undefined;return row?mapRevision(row):null;});}
  public listPlanVersions(context:PolicyAuthorizedRepositoryExecutionContext,portfolioId:string):RepositoryResult<readonly LongTermPortfolioPlanVersionRow[]>{return this.readForActiveContext(context,()=>(this.database(context).prepare('SELECT p.* FROM long_term_portfolio_plan_versions p INNER JOIN long_term_portfolio_plan_seals s ON s.plan_version_id=p.id WHERE p.family_id=? AND p.portfolio_id=? ORDER BY p.version DESC,p.id').all(context.policyAuthorization.resourceFamilyId,portfolioId) as Record<string,unknown>[]).map(mapPlan));}
  public listAllocations(context:PolicyAuthorizedRepositoryExecutionContext,portfolioId:string):RepositoryResult<readonly LongTermPortfolioAllocationRow[]>{return this.readForActiveContext(context,()=>(this.database(context).prepare('SELECT a.* FROM long_term_portfolio_allocations a INNER JOIN long_term_portfolio_plan_seals s ON s.plan_version_id=a.plan_version_id WHERE a.family_id=? AND a.portfolio_id=? ORDER BY a.plan_version_id,a.display_order,a.id').all(context.policyAuthorization.resourceFamilyId,portfolioId) as Record<string,unknown>[]).map(mapAllocation));}
  public listLedgerEvents(context:PolicyAuthorizedRepositoryExecutionContext,portfolioId:string):RepositoryResult<readonly LongTermPortfolioLedgerEventRow[]>{return this.readForActiveContext(context,()=>(this.database(context).prepare('SELECT * FROM long_term_portfolio_ledger_events WHERE family_id=? AND portfolio_id=? ORDER BY executed_at DESC,id').all(context.policyAuthorization.resourceFamilyId,portfolioId) as Record<string,unknown>[]).map(mapEvent));}
  public findLedgerEvent(context:PolicyAuthorizedRepositoryExecutionContext,id:string):RepositoryResult<LongTermPortfolioLedgerEventRow|null>{return this.readForActiveContext(context,()=>{const row=this.database(context).prepare('SELECT * FROM long_term_portfolio_ledger_events WHERE id=? AND family_id=?').get(id,context.policyAuthorization.resourceFamilyId) as Record<string,unknown>|undefined;return row?mapEvent(row):null;});}
  public listPriceObservations(context:PolicyAuthorizedRepositoryExecutionContext,portfolioId:string):RepositoryResult<readonly LongTermPortfolioPriceObservationRow[]>{return this.readForActiveContext(context,()=>(this.database(context).prepare('SELECT * FROM long_term_portfolio_price_observations WHERE family_id=? AND portfolio_id=? ORDER BY observed_at DESC,id').all(context.policyAuthorization.resourceFamilyId,portfolioId) as Record<string,unknown>[]).map(mapPrice));}

  private readForActiveContext<T>(context:PolicyAuthorizedRepositoryExecutionContext,operation:()=>T):RepositoryResult<T>{
    if(context.policyAuthorization.action==='read')assertCollectionRead(context);else assertMutationWrite(context,context.policyAuthorization.resourceId);
    return this.execute(context,operation);
  }
  private insertChild(context:PolicyAuthorizedRepositoryExecutionContext,row:LongTermPortfolioScopedRow&{readonly mutationId:string},sql:string,values:readonly unknown[]):RepositoryResult<void>{assertMutationWrite(context,row.mutationId,row);return this.execute(context,()=>{this.database(context).prepare(sql).run(...values);});}

  public insertMutation(context:PolicyAuthorizedRepositoryExecutionContext,row:NewLongTermPortfolioMutationRow):RepositoryResult<void>{
    assertMutationWrite(context,row.id,row); const policy=platformPolicyPersistenceBinding(context,'finance_record',row.id);if(!policy)throw new Error('Long-term portfolio mutation requires an active finance policy receipt');
    return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO long_term_portfolio_mutations(id,client_operation_id,request_fingerprint,family_id,owner_person_id,privacy,operation,resource_id,created_at,policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,policy_resource_type,policy_resource_id,policy_action,policy_capability) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.clientOperationId,row.requestFingerprint,row.familyId,row.ownerPersonId,row.privacy,row.operation,row.resourceId,row.createdAt,policy.receiptHash,policy.receiptVersion,policy.nonce,context.correlationId,policy.resourceType,policy.resourceId,policy.action,policy.capability);});
  }
  public insertInstrument(context:PolicyAuthorizedRepositoryExecutionContext,row:NewLongTermPortfolioInstrumentRow):RepositoryResult<void>{return this.insertChild(context,row,'INSERT INTO long_term_portfolio_instruments(id,mutation_id,family_id,owner_person_id,privacy,created_at) VALUES(?,?,?,?,?,?)',[row.id,row.mutationId,row.familyId,row.ownerPersonId,row.privacy,row.createdAt]);}
  public insertInstrumentRevision(context:PolicyAuthorizedRepositoryExecutionContext,row:NewLongTermPortfolioInstrumentRevisionRow):RepositoryResult<void>{return this.insertChild(context,row,`INSERT INTO long_term_portfolio_instrument_revisions(revision_id,instrument_id,mutation_id,family_id,owner_person_id,privacy,asset_class,group_label,code,name,currency,effective_from,status,isin,exchange_name,country_code,price_source,tax_profile,fee_profile,notes,replaces_revision_id,data_source,external_verification,created_at) VALUES(${Array.from({length:24},()=>'?').join(',')})`,[row.revisionId,row.instrumentId,row.mutationId,row.familyId,row.ownerPersonId,row.privacy,row.assetClass,row.groupLabel,row.code,row.name,row.currency,row.effectiveFrom,row.status,row.isin??null,row.exchange??null,row.countryCode??null,row.priceSource??null,row.taxProfile??null,row.feeProfile??null,row.notes??null,row.replacesRevisionId??null,row.dataSource,row.externalVerification,row.createdAt]);}
  public insertPortfolio(context:PolicyAuthorizedRepositoryExecutionContext,row:NewLongTermPortfolioRow):RepositoryResult<void>{return this.insertChild(context,row,'INSERT INTO long_term_portfolios(id,mutation_id,family_id,owner_person_id,name,base_currency,privacy,target_date,purpose,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[row.id,row.mutationId,row.familyId,row.ownerPersonId,row.name,row.baseCurrency,row.privacy,row.targetDate,row.purpose,row.createdAt]);}
  public insertPlanVersion(context:PolicyAuthorizedRepositoryExecutionContext,row:NewLongTermPortfolioPlanVersionRow):RepositoryResult<void>{return this.insertChild(context,row,`INSERT INTO long_term_portfolio_plan_versions(id,portfolio_id,mutation_id,family_id,owner_person_id,privacy,version,effective_month,monthly_contribution,contribution_currency,contribution_change_reason,rebalance_interval_months,inflation_adjustment,target_date,pessimistic_return_bps,base_return_bps,optimistic_return_bps,annual_inflation_bps,annual_contribution_growth_bps,supersedes_plan_version_id,created_at) VALUES(${Array.from({length:21},()=>'?').join(',')})`,[row.id,row.portfolioId,row.mutationId,row.familyId,row.ownerPersonId,row.privacy,row.version,row.effectiveMonth,row.monthlyContribution,row.contributionCurrency,row.contributionChangeReason,row.rebalanceIntervalMonths,row.inflationAdjustment,row.targetDate,row.assumptions.pessimisticAnnualReturnBasisPoints,row.assumptions.baseAnnualReturnBasisPoints,row.assumptions.optimisticAnnualReturnBasisPoints,row.assumptions.annualInflationBasisPoints,row.assumptions.annualContributionGrowthBasisPoints,row.supersedesPlanVersionId??null,row.createdAt]);}
  public insertAllocation(context:PolicyAuthorizedRepositoryExecutionContext,row:NewLongTermPortfolioAllocationRow):RepositoryResult<void>{return this.insertChild(context,row,'INSERT INTO long_term_portfolio_allocations(id,portfolio_id,plan_version_id,instrument_id,mutation_id,family_id,owner_person_id,privacy,sleeve,target_basis_points,carryover_policy,display_order,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[row.id,row.portfolioId,row.planVersionId,row.instrumentId,row.mutationId,row.familyId,row.ownerPersonId,row.privacy,row.sleeve,row.targetBasisPoints,row.carryoverPolicy,row.displayOrder,row.note??null,row.createdAt]);}
  public insertPlanSeal(context:PolicyAuthorizedRepositoryExecutionContext,row:NewLongTermPortfolioPlanSealRow):RepositoryResult<void>{return this.insertChild(context,row,'INSERT INTO long_term_portfolio_plan_seals(plan_version_id,mutation_id,family_id,owner_person_id,privacy,allocation_count,total_basis_points,created_at) VALUES(?,?,?,?,?,?,?,?)',[row.planVersionId,row.mutationId,row.familyId,row.ownerPersonId,row.privacy,row.allocationCount,row.totalBasisPoints,row.createdAt]);}
  public insertLedgerEvent(context:PolicyAuthorizedRepositoryExecutionContext,row:NewLongTermPortfolioLedgerEventRow):RepositoryResult<void>{
    assertMutationWrite(context,row.mutationId,row);
    return this.execute(context,()=>{
      const database=this.database(context);
      if(row.eventType==='transfer_out'){
        const shapeValid=row.direction==='non_cash'
          && row.instrumentId!==undefined
          && row.transferCounterpartyInstrumentId!==undefined
          && row.instrumentId!==row.transferCounterpartyInstrumentId
          && row.quantity===undefined
          && Number.isFinite(row.grossAmount)
          && row.grossAmount>0
          && Number.isFinite(row.netCashAmount)
          && Math.abs(row.netCashAmount)<=0.000001;
        if(!shapeValid)throw new Error('Budget transfer must be one non-cash, quantity-free event between different instruments');
        const balance=database.prepare(budgetTransferBalanceSql).get(
          row.portfolioId,row.familyId,row.instrumentId,row.transferCounterpartyInstrumentId,
          row.executedAt,row.createdAt,row.currency,row.fxRate??null,row.grossAmount
        ) as {valid:number}|undefined;
        if(balance?.valid!==1)throw new Error('Budget transfer exceeds the source instrument monthly plan and carryover balance');
      }
      database.prepare(`INSERT INTO long_term_portfolio_ledger_events(id,portfolio_id,instrument_id,mutation_id,family_id,owner_person_id,privacy,event_type,direction,currency,order_at,executed_at,settlement_at,entitlement_at,record_at,payment_at,quantity,unit_price,gross_amount,fee_amount,tax_amount,net_cash_amount,fx_rate,broker,account_reference,order_reference,execution_reference,partial_fill_sequence,lot_reference,cost_layer_method,corporate_action_reference,ratio_numerator,ratio_denominator,cash_carryover_instrument_id,transfer_counterparty_instrument_id,reversal_of_event_id,correction_reason,source_label,source_document_reference,notes,data_source,external_verification,created_at) VALUES(${Array.from({length:43},()=>'?').join(',')})`).run(row.id,row.portfolioId,row.instrumentId??null,row.mutationId,row.familyId,row.ownerPersonId,row.privacy,row.eventType,row.direction,row.currency,row.orderAt??null,row.executedAt,row.settlementAt??null,row.entitlementAt??null,row.recordAt??null,row.paymentAt??null,row.quantity??null,row.unitPrice??null,row.grossAmount,row.feeAmount,row.taxAmount,row.netCashAmount,row.fxRate??null,row.broker??null,row.accountReference??null,row.orderReference??null,row.executionReference??null,row.partialFillSequence??null,row.lotReference??null,row.costLayerMethod??null,row.corporateActionReference??null,row.ratioNumerator??null,row.ratioDenominator??null,row.cashCarryoverInstrumentId??null,row.transferCounterpartyInstrumentId??null,row.reversalOfEventId??null,row.correctionReason??null,row.sourceLabel,row.sourceDocumentReference??null,row.notes??null,row.dataSource,row.externalVerification,row.createdAt);
    });
  }
  public insertPriceObservation(context:PolicyAuthorizedRepositoryExecutionContext,row:NewLongTermPortfolioPriceObservationRow):RepositoryResult<void>{return this.insertChild(context,row,'INSERT INTO long_term_portfolio_price_observations(id,portfolio_id,instrument_id,mutation_id,family_id,owner_person_id,privacy,observed_at,unit_price,currency,source_label,data_source,external_verification,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[row.id,row.portfolioId,row.instrumentId,row.mutationId,row.familyId,row.ownerPersonId,row.privacy,row.observedAt,row.unitPrice,row.currency,row.sourceLabel,row.dataSource,row.externalVerification,row.createdAt]);}
}
