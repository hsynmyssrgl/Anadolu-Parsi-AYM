export type LongTermPortfolioAssetClass =
  | 'domestic_equity'
  | 'foreign_equity'
  | 'fund'
  | 'etf'
  | 'bond_note'
  | 'eurobond'
  | 'deposit'
  | 'foreign_currency'
  | 'gold'
  | 'silver'
  | 'commodity'
  | 'private_pension'
  | 'ipo_reserve'
  | 'cash_savings'
  | 'crypto_asset'
  | 'real_estate'
  | 'vehicle'
  | 'custom';

export type LongTermPortfolioLedgerEventType =
  | 'buy'
  | 'sell'
  | 'cash_dividend'
  | 'rights_issue_used'
  | 'rights_issue_sold'
  | 'rights_issue_expired'
  | 'bonus_shares'
  | 'split'
  | 'reverse_split'
  | 'coupon'
  | 'interest'
  | 'fund_distribution'
  | 'merger_exchange'
  | 'code_change'
  | 'transfer_in'
  | 'transfer_out'
  | 'fee'
  | 'tax'
  | 'cash_adjustment'
  | 'reversal';

export type LongTermPortfolioDataSource = 'user_entered' | 'manual' | 'csv_import';
export type LongTermPortfolioExternalVerification = 'not_performed' | 'user_confirmed' | 'source_document_checked';
export type LongTermPortfolioInstrumentStatus = 'active' | 'inactive' | 'matured' | 'merged';
export type LongTermPortfolioPrivacy = 'private' | 'selected_members' | 'family';

export interface LongTermPortfolioInstrumentRevisionView {
  readonly revisionId: string;
  readonly instrumentId: string;
  readonly assetClass: LongTermPortfolioAssetClass;
  readonly groupLabel: string;
  readonly code: string;
  readonly name: string;
  readonly currency: string;
  readonly effectiveFrom: string;
  readonly status: LongTermPortfolioInstrumentStatus;
  readonly isin?: string;
  readonly exchange?: string;
  readonly countryCode?: string;
  readonly priceSource?: string;
  readonly taxProfile?: string;
  readonly feeProfile?: string;
  readonly notes?: string;
  readonly replacesRevisionId?: string;
  readonly dataSource: LongTermPortfolioDataSource;
  readonly externalVerification: LongTermPortfolioExternalVerification;
  readonly createdAt?: string;
}

export interface LongTermPortfolioView {
  readonly id: string;
  readonly familyId?: string;
  readonly ownerPersonId: string;
  readonly name: string;
  readonly baseCurrency: string;
  readonly privacy: LongTermPortfolioPrivacy;
  readonly targetDate: string;
  readonly purpose: string;
  readonly createdAt: string;
}

export type LongTermPortfolioAllocationSleeve =
  | 'core'
  | 'growth'
  | 'opportunity'
  | 'ipo_reserve'
  | 'liquidity'
  | 'hedge'
  | 'custom';

export interface LongTermPortfolioAllocationView {
  readonly id: string;
  readonly planVersionId: string;
  readonly instrumentId: string;
  readonly sleeve: LongTermPortfolioAllocationSleeve;
  readonly targetBasisPoints: number;
  readonly carryoverPolicy: 'same_instrument';
  readonly displayOrder: number;
  readonly note?: string;
  readonly createdAt?: string;
}

export interface LongTermPortfolioProjectionAssumptions {
  readonly pessimisticAnnualReturnBasisPoints: number;
  readonly baseAnnualReturnBasisPoints: number;
  readonly optimisticAnnualReturnBasisPoints: number;
  readonly annualInflationBasisPoints: number;
  readonly annualContributionGrowthBasisPoints: number;
}

export interface LongTermPortfolioPlanVersionView {
  readonly id: string;
  readonly portfolioId: string;
  readonly version: number;
  readonly effectiveMonth: string;
  readonly monthlyContribution: number;
  readonly contributionCurrency: string;
  readonly contributionChangeReason: string;
  readonly rebalanceIntervalMonths: number;
  readonly inflationAdjustment: 'manual_realized_inflation' | 'fixed_assumption' | 'none';
  readonly targetDate: string;
  readonly assumptions: LongTermPortfolioProjectionAssumptions;
  readonly allocations: readonly LongTermPortfolioAllocationView[];
  readonly supersedesPlanVersionId?: string;
  readonly createdAt: string;
}

export interface LongTermPortfolioLedgerEventView {
  readonly id: string;
  readonly portfolioId: string;
  readonly instrumentId?: string;
  readonly eventType: LongTermPortfolioLedgerEventType;
  readonly direction: 'cash_in' | 'cash_out' | 'security_in' | 'security_out' | 'non_cash';
  readonly currency: string;
  readonly orderAt?: string;
  readonly executedAt: string;
  readonly settlementAt?: string;
  readonly entitlementAt?: string;
  readonly recordAt?: string;
  readonly paymentAt?: string;
  readonly quantity?: number;
  readonly unitPrice?: number;
  readonly grossAmount: number;
  readonly feeAmount: number;
  readonly taxAmount: number;
  readonly netCashAmount: number;
  readonly fxRate?: number;
  readonly broker?: string;
  readonly accountReference?: string;
  readonly orderReference?: string;
  readonly executionReference?: string;
  readonly partialFillSequence?: number;
  readonly lotReference?: string;
  readonly costLayerMethod?: 'fifo' | 'weighted_average' | 'specific_lot' | 'not_applicable';
  readonly corporateActionReference?: string;
  readonly ratioNumerator?: number;
  readonly ratioDenominator?: number;
  readonly cashCarryoverInstrumentId?: string;
  readonly transferCounterpartyInstrumentId?: string;
  readonly reversalOfEventId?: string;
  readonly correctionReason?: string;
  readonly sourceLabel: string;
  readonly sourceDocumentReference?: string;
  readonly notes?: string;
  readonly dataSource: LongTermPortfolioDataSource;
  readonly externalVerification: LongTermPortfolioExternalVerification;
  readonly createdAt: string;
}

export interface LongTermPortfolioPriceObservationView {
  readonly id: string;
  readonly instrumentId: string;
  readonly observedAt: string;
  readonly unitPrice: number;
  readonly currency: string;
  readonly sourceLabel: string;
  readonly dataSource: LongTermPortfolioDataSource;
  readonly externalVerification: LongTermPortfolioExternalVerification;
  readonly createdAt: string;
}

export interface LongTermPortfolioInstrumentPositionView {
  readonly instrumentId: string;
  readonly code: string;
  readonly name: string;
  readonly assetClass: LongTermPortfolioAssetClass;
  readonly currency: string;
  readonly quantity: number;
  readonly contributedAmount: number;
  readonly grossPurchaseAmount: number;
  readonly grossSaleAmount: number;
  readonly realizedCashAmount: number;
  readonly feeAmount: number;
  readonly taxAmount: number;
  readonly incomeAmount: number;
  readonly latestUnitPrice?: number;
  readonly costBasisAmount?: number;
  readonly averageUnitCost?: number;
  readonly realizedProfitLoss?: number;
  readonly unrealizedProfitLoss?: number;
  readonly marketValue?: number;
  readonly netProfitLoss?: number;
  readonly carryoverAmount: number;
  readonly priceFreshness: 'missing' | 'manual' | 'current_for_selected_period';
  readonly costBasisStatus: 'calculated_weighted_average' | 'unsupported_cost_layer' | 'incomplete_history';
}

export interface LongTermPortfolioAllocationDriftView {
  readonly allocationId: string;
  readonly instrumentId: string;
  readonly code: string;
  readonly targetBasisPoints: number;
  readonly actualBasisPoints?: number;
  readonly driftBasisPoints?: number;
  readonly rebalanceDue: boolean;
  readonly missingPrice: boolean;
}

export interface LongTermPortfolioMonthlySeriesPointView {
  readonly month: string;
  readonly contributedAmount: number;
  readonly marketValue?: number;
  readonly netProfitLoss?: number;
  readonly dividendCouponInterestAmount: number;
  readonly feeAmount: number;
  readonly taxAmount: number;
  readonly carryoverAmount: number;
}

export interface LongTermPortfolioMonthlyBudgetCarryoverView {
  readonly month: string;
  readonly instrumentId: string;
  readonly code: string;
  readonly currency: string;
  readonly plannedAmount: number;
  readonly openingCarryoverAmount?: number;
  readonly actualContributionAmount?: number;
  readonly reinvestedIncomeAmount?: number;
  readonly explicitTransferNetAmount?: number;
  readonly closingCarryoverAmount?: number;
  readonly complete: boolean;
}

export interface LongTermPortfolioProjectionPointView {
  readonly month: string;
  readonly nominalValue: number;
  readonly realValue: number;
  readonly contributedAmount: number;
}

export interface LongTermPortfolioProjectionScenarioView {
  readonly scenario: 'pessimistic' | 'base' | 'optimistic';
  readonly annualReturnBasisPoints: number;
  readonly startingValue: number;
  readonly startingValueSource: 'current_market_value' | 'contributed_principal' | 'zero_unavailable';
  readonly points: readonly LongTermPortfolioProjectionPointView[];
  readonly terminalNominalValue: number;
  readonly terminalRealValue: number;
}

export interface LongTermPortfolioAnalyticsView {
  readonly currency: string;
  readonly aggregateValuationStatus: 'complete' | 'missing_prices' | 'mixed_currency_requires_fx';
  readonly totalContributed?: number;
  readonly totalFees?: number;
  readonly totalTaxes?: number;
  readonly totalIncome?: number;
  readonly totalCarryover?: number;
  readonly marketValue?: number;
  readonly netProfitLoss?: number;
  readonly positions: readonly LongTermPortfolioInstrumentPositionView[];
  readonly allocationDrift: readonly LongTermPortfolioAllocationDriftView[];
  readonly monthlySeries: readonly LongTermPortfolioMonthlySeriesPointView[];
  readonly monthlyBudgetCarryovers: readonly LongTermPortfolioMonthlyBudgetCarryoverView[];
  readonly rebalanceDue: boolean;
  readonly nextRebalanceMonth?: string;
  readonly missingPriceInstrumentIds: readonly string[];
  readonly excludedCurrencyInstrumentIds: readonly string[];
  readonly missingFxEventIds: readonly string[];
  readonly missingSettlementEventIds: readonly string[];
}

export interface LongTermPortfolioWorkspaceView {
  readonly generatedAt: string;
  readonly portfolio?: LongTermPortfolioView;
  readonly instruments: readonly LongTermPortfolioInstrumentRevisionView[];
  readonly currentInstruments: readonly LongTermPortfolioInstrumentRevisionView[];
  readonly planVersions: readonly LongTermPortfolioPlanVersionView[];
  readonly activePlan?: LongTermPortfolioPlanVersionView;
  readonly ledgerEvents: readonly LongTermPortfolioLedgerEventView[];
  readonly priceObservations: readonly LongTermPortfolioPriceObservationView[];
  readonly analytics?: LongTermPortfolioAnalyticsView;
  readonly projections: readonly LongTermPortfolioProjectionScenarioView[];
  readonly truth: {
    readonly brokerOrderExecution: 'not_performed';
    readonly livePriceGuarantee: false;
    readonly investmentAdvice: false;
    readonly returnGuarantee: false;
    readonly taxLegalAccuracyGuarantee: false;
    readonly externalVerification: 'not_performed_unless_explicitly_recorded';
  };
}

export interface LongTermPortfolioAllocationInput {
  readonly instrumentId: string;
  readonly sleeve: LongTermPortfolioAllocationSleeve;
  readonly targetBasisPoints: number;
  readonly displayOrder: number;
  readonly note?: string;
}

export type RecordLongTermPortfolioItemInput =
  | {
      readonly itemType: 'bootstrap_default';
      readonly clientOperationId: string;
      readonly ownerPersonId: string;
      readonly portfolioName: string;
      readonly effectiveMonth: string;
      readonly targetDate: string;
      readonly privacy: LongTermPortfolioPrivacy;
    }
  | {
      readonly itemType: 'instrument_revision';
      readonly clientOperationId: string;
      readonly instrumentId?: string;
      readonly replacesRevisionId?: string;
      readonly assetClass: LongTermPortfolioAssetClass;
      readonly groupLabel: string;
      readonly code: string;
      readonly name: string;
      readonly currency: string;
      readonly effectiveFrom: string;
      readonly status: LongTermPortfolioInstrumentStatus;
      readonly isin?: string;
      readonly exchange?: string;
      readonly countryCode?: string;
      readonly priceSource?: string;
      readonly taxProfile?: string;
      readonly feeProfile?: string;
      readonly notes?: string;
    }
  | {
      readonly itemType: 'plan_version';
      readonly clientOperationId: string;
      readonly portfolioId: string;
      readonly effectiveMonth: string;
      readonly monthlyContribution: number;
      readonly contributionCurrency: string;
      readonly contributionChangeReason: string;
      readonly rebalanceIntervalMonths: number;
      readonly inflationAdjustment: LongTermPortfolioPlanVersionView['inflationAdjustment'];
      readonly targetDate: string;
      readonly assumptions: LongTermPortfolioProjectionAssumptions;
      readonly allocations: readonly LongTermPortfolioAllocationInput[];
    }
  | {
      readonly itemType: 'ledger_event';
      readonly clientOperationId: string;
      readonly portfolioId: string;
      readonly instrumentId?: string;
      readonly eventType: LongTermPortfolioLedgerEventType;
      readonly direction: LongTermPortfolioLedgerEventView['direction'];
      readonly currency: string;
      readonly orderAt?: string;
      readonly executedAt: string;
      readonly settlementAt?: string;
      readonly entitlementAt?: string;
      readonly recordAt?: string;
      readonly paymentAt?: string;
      readonly quantity?: number;
      readonly unitPrice?: number;
      readonly grossAmount: number;
      readonly feeAmount: number;
      readonly taxAmount: number;
      readonly netCashAmount: number;
      readonly fxRate?: number;
      readonly broker?: string;
      readonly accountReference?: string;
      readonly orderReference?: string;
      readonly executionReference?: string;
      readonly partialFillSequence?: number;
      readonly lotReference?: string;
      readonly costLayerMethod?: LongTermPortfolioLedgerEventView['costLayerMethod'];
      readonly corporateActionReference?: string;
      readonly ratioNumerator?: number;
      readonly ratioDenominator?: number;
      readonly cashCarryoverInstrumentId?: string;
      readonly transferCounterpartyInstrumentId?: string;
      readonly reversalOfEventId?: string;
      readonly correctionReason?: string;
      readonly sourceLabel: string;
      readonly sourceDocumentReference?: string;
      readonly notes?: string;
    }
  | {
      readonly itemType: 'price_observation';
      readonly clientOperationId: string;
      readonly instrumentId: string;
      readonly observedAt: string;
      readonly unitPrice: number;
      readonly currency: string;
      readonly sourceLabel: string;
    };

export interface LongTermPortfolioDefaultBootstrap {
  readonly portfolioName: string;
  readonly monthlyContribution: number;
  readonly contributionCurrency: 'TRY';
  readonly instruments: readonly LongTermPortfolioInstrumentRevisionView[];
  readonly allocations: readonly LongTermPortfolioAllocationInput[];
  readonly assumptions: LongTermPortfolioProjectionAssumptions;
  readonly rebalanceIntervalMonths: 6;
}

const catalogItem = (
  instrumentId: string,
  assetClass: LongTermPortfolioAssetClass,
  groupLabel: string,
  code: string,
  name: string
): LongTermPortfolioInstrumentRevisionView => Object.freeze({
  revisionId: `${instrumentId}-revision-1`,
  instrumentId,
  assetClass,
  groupLabel,
  code,
  name,
  currency: 'TRY',
  effectiveFrom: '2026-08-01T00:00:00.000Z',
  status: 'active',
  exchange: assetClass === 'domestic_equity' ? 'BIST' : 'Kullanıcı beyanı',
  priceSource: 'Manuel kullanıcı girişi',
  dataSource: 'user_entered',
  externalVerification: 'not_performed'
});

export const DEFAULT_LONG_TERM_PORTFOLIO_CATALOG: readonly LongTermPortfolioInstrumentRevisionView[] = Object.freeze([
  catalogItem('ltp-instrument-asels', 'domestic_equity', 'Hisse', 'ASELS', 'Aselsan'),
  catalogItem('ltp-instrument-tuprs', 'domestic_equity', 'Hisse', 'TUPRS', 'Tüpraş'),
  catalogItem('ltp-instrument-thyao', 'domestic_equity', 'Hisse', 'THYAO', 'Türk Hava Yolları'),
  catalogItem('ltp-instrument-kchol', 'domestic_equity', 'Hisse', 'KCHOL', 'Koç Holding'),
  catalogItem('ltp-instrument-bimas', 'domestic_equity', 'Hisse', 'BIMAS', 'BİM'),
  catalogItem('ltp-instrument-akbnk', 'domestic_equity', 'Hisse', 'AKBNK', 'Akbank'),
  catalogItem('ltp-instrument-eregl', 'domestic_equity', 'Hisse', 'EREGL', 'Ereğli Demir Çelik'),
  catalogItem('ltp-instrument-betae', 'fund', 'Büyüme', 'BETAE', 'Beta Enerji'),
  catalogItem('ltp-instrument-netcd', 'fund', 'Büyüme', 'NETCD', 'Netcad'),
  catalogItem('ltp-instrument-ti2', 'fund', 'Fon', 'TI2', 'İş Portföy Hisse Senedi (TL) Fonu'),
  catalogItem('ltp-instrument-aft', 'fund', 'Fon', 'AFT', 'Ak Portföy Yeni Teknolojiler Yabancı Hisse Senedi Fonu'),
  catalogItem('ltp-instrument-tte', 'fund', 'Fon', 'TTE', 'İş Portföy BIST Teknoloji Fonu'),
  catalogItem('ltp-instrument-kzl', 'gold', 'Altın', 'KZL', 'Kuveyt Türk Portföy Altın Katılım Fonu'),
  catalogItem('ltp-instrument-guf', 'silver', 'Gümüş', 'GUF', 'İş Portföy Gümüş Fon Sepeti Fonu'),
  catalogItem('ltp-instrument-ppn', 'cash_savings', 'Nakit', 'PPN', 'Nurol Portföy Para Piyasası (TL) Fonu')
]);

const defaultAllocation = (
  instrumentId: string,
  sleeve: LongTermPortfolioAllocationSleeve,
  targetBasisPoints: number,
  displayOrder: number,
  note?: string
): LongTermPortfolioAllocationInput => Object.freeze({
  instrumentId,
  sleeve,
  targetBasisPoints,
  displayOrder,
  ...(note ? { note } : {})
});

export const buildDefaultLongTermPortfolioBootstrap = (
  monthlyContribution = 20_000
): LongTermPortfolioDefaultBootstrap => {
  if (!Number.isFinite(monthlyContribution) || monthlyContribution <= 0) {
    throw new Error('Aylık yatırım tutarı pozitif ve sonlu olmalıdır.');
  }
  const allocations = Object.freeze([
    defaultAllocation('ltp-instrument-asels', 'core', 800, 1),
    defaultAllocation('ltp-instrument-tuprs', 'core', 600, 2),
    defaultAllocation('ltp-instrument-thyao', 'core', 500, 3),
    defaultAllocation('ltp-instrument-kchol', 'core', 400, 4),
    defaultAllocation('ltp-instrument-bimas', 'core', 400, 5),
    defaultAllocation('ltp-instrument-akbnk', 'core', 400, 6),
    defaultAllocation('ltp-instrument-eregl', 'core', 400, 7),
    defaultAllocation('ltp-instrument-betae', 'growth', 500, 8),
    defaultAllocation('ltp-instrument-netcd', 'growth', 300, 9),
    defaultAllocation('ltp-instrument-ppn', 'ipo_reserve', 200, 10, 'Uygun halka arz bulunana kadar PPN üzerinde bekler.'),
    defaultAllocation('ltp-instrument-ti2', 'core', 800, 11),
    defaultAllocation('ltp-instrument-aft', 'growth', 700, 12),
    defaultAllocation('ltp-instrument-tte', 'growth', 500, 13),
    defaultAllocation('ltp-instrument-kzl', 'hedge', 2_000, 14),
    defaultAllocation('ltp-instrument-guf', 'hedge', 1_000, 15),
    defaultAllocation('ltp-instrument-ppn', 'liquidity', 500, 16)
  ] satisfies readonly LongTermPortfolioAllocationInput[]);
  const totalBasisPoints = allocations.reduce((total, item) => total + item.targetBasisPoints, 0);
  if (totalBasisPoints !== 10_000) throw new Error('Varsayılan portföy dağılımı tam olarak %100 olmalıdır.');
  return Object.freeze({
    portfolioName: '2032 Uzun Vadeli Birikim Portföyü',
    monthlyContribution,
    contributionCurrency: 'TRY',
    instruments: DEFAULT_LONG_TERM_PORTFOLIO_CATALOG,
    allocations,
    assumptions: Object.freeze({
      pessimisticAnnualReturnBasisPoints: 500,
      baseAnnualReturnBasisPoints: 1_500,
      optimisticAnnualReturnBasisPoints: 2_500,
      annualInflationBasisPoints: 2_000,
      annualContributionGrowthBasisPoints: 2_000
    }),
    rebalanceIntervalMonths: 6
  });
};
