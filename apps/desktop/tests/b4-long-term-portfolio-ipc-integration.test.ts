import { describe, expect, it } from 'vitest';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';

const bootstrap = {
  itemType: 'bootstrap_default',
  clientOperationId: 'operation-bootstrap-1',
  ownerPersonId: 'person-1',
  portfolioName: '2032 Portföyü',
  effectiveMonth: '2026-08',
  targetDate: '2032-08-13T00:00:00.000Z',
  privacy: 'private'
} as const;

const plan = {
  itemType: 'plan_version',
  clientOperationId: 'operation-plan-1',
  portfolioId: 'portfolio-1',
  effectiveMonth: '2027-01',
  monthlyContribution: 25_000,
  contributionCurrency: 'TRY',
  contributionChangeReason: 'Gerçekleşen enflasyon',
  rebalanceIntervalMonths: 6,
  inflationAdjustment: 'manual_realized_inflation',
  targetDate: '2032-08-13T00:00:00.000Z',
  assumptions: {
    pessimisticAnnualReturnBasisPoints: 500,
    baseAnnualReturnBasisPoints: 1_500,
    optimisticAnnualReturnBasisPoints: 2_500,
    annualInflationBasisPoints: 2_000,
    annualContributionGrowthBasisPoints: 2_000
  },
  allocations: [{ instrumentId: 'instrument-1', sleeve: 'core', targetBasisPoints: 10_000, displayOrder: 1 }]
} as const;

const trade = {
  itemType: 'ledger_event',
  clientOperationId: 'operation-trade-1',
  portfolioId: 'portfolio-1',
  instrumentId: 'instrument-1',
  eventType: 'buy',
  direction: 'cash_out',
  currency: 'TRY',
  orderAt: '2026-08-13T09:00:00.000Z',
  executedAt: '2026-08-13T09:01:00.000Z',
  settlementAt: '2026-08-15T09:01:00.000Z',
  quantity: 10,
  unitPrice: 100,
  grossAmount: 1_000,
  feeAmount: 5,
  taxAmount: 0,
  netCashAmount: -1_005,
  broker: 'Aracı',
  orderReference: 'order-1',
  executionReference: 'fill-1',
  partialFillSequence: 1,
  costLayerMethod: 'weighted_average',
  sourceLabel: 'Kullanıcı dekontu'
} as const;

describe('33-L uzun vadeli portföy IPC sınırı', () => {
  it('workspace okumasını ve ayrıştırılmış mutasyonları kabul eder', () => {
    expect(evaluateIpcIntegrationPolicy('finance:getLongTermPortfolioWorkspace', [])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('finance:recordLongTermPortfolioItem', [bootstrap])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('finance:recordLongTermPortfolioItem', [plan])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('finance:recordLongTermPortfolioItem', [trade])).toEqual({ accepted: true });
  });

  it('fazla alanı, bankacılık sırrını, sonsuz sayıyı ve yüzde 100 olmayan planı reddeder', () => {
    expect(evaluateIpcIntegrationPolicy('finance:recordLongTermPortfolioItem', [{ ...bootstrap, futureField: true }]))
      .toMatchObject({ accepted: false, reason: 'UNKNOWN_OBJECT_FIELD' });
    expect(evaluateIpcIntegrationPolicy('finance:recordLongTermPortfolioItem', [{ ...trade, cvv: '123' }]))
      .toMatchObject({ accepted: false, reason: 'BANKING_SECRET_FIELD_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('finance:recordLongTermPortfolioItem', [{ ...trade, grossAmount: Number.POSITIVE_INFINITY }]))
      .toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('finance:recordLongTermPortfolioItem', [{
      ...plan,
      allocations: [{ ...plan.allocations[0], targetBasisPoints: 9_999 }]
    }])).toMatchObject({ accepted: false });
  });

  it('okuma kanalında argüman ve yazmada bilinmeyen tür kabul etmez', () => {
    expect(evaluateIpcIntegrationPolicy('finance:getLongTermPortfolioWorkspace', ['extra'])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('finance:recordLongTermPortfolioItem', [{ itemType: 'broker_order' }]))
      .toMatchObject({ accepted: false, reason: 'LONG_TERM_PORTFOLIO_ITEM_TYPE_INVALID' });
  });

  it('iç içe bankacılık sırlarını nesne ve dizi içinde reddeder', () => {
    expect(evaluateIpcIntegrationPolicy('finance:recordLongTermPortfolioItem', [{
      ...plan,
      assumptions: { ...plan.assumptions, cvv: '123' }
    }])).toEqual({ accepted: false, reason: 'BANKING_SECRET_FIELD_PROHIBITED', path: '$[0].assumptions.cvv' });
    expect(evaluateIpcIntegrationPolicy('finance:recordLongTermPortfolioItem', [{
      ...plan,
      allocations: [{ ...plan.allocations[0], cvv: '123' }]
    }])).toEqual({ accepted: false, reason: 'BANKING_SECRET_FIELD_PROHIBITED', path: '$[0].allocations[0].cvv' });
  });

  it('sahte plan enum, tarih, dilim ve görüntüleme sırasını reddeder', () => {
    expect(evaluateIpcIntegrationPolicy('finance:recordLongTermPortfolioItem', [{
      ...plan,
      inflationAdjustment: 'forged',
      targetDate: 'not-a-date',
      allocations: [{ ...plan.allocations[0], sleeve: 'forged', displayOrder: -999 }]
    }])).toEqual({ accepted: false, reason: 'LONG_TERM_PORTFOLIO_PLAN_INVALID', path: '$[0]' });
  });

  it('sahte defter enum, tarih, sayı ve kimlik alanlarını reddeder', () => {
    expect(evaluateIpcIntegrationPolicy('finance:recordLongTermPortfolioItem', [{
      ...trade,
      eventType: 'forged',
      direction: 'forged',
      executedAt: 'not-a-date',
      quantity: 'not-number',
      unitPrice: Number.POSITIVE_INFINITY,
      fxRate: -1,
      partialFillSequence: -1,
      costLayerMethod: 'forged',
      ratioNumerator: -1,
      ratioDenominator: 0,
      cashCarryoverInstrumentId: {},
      transferCounterpartyInstrumentId: {}
    }])).toEqual({ accepted: false, reason: 'LONG_TERM_PORTFOLIO_LEDGER_INVALID', path: '$[0]' });
  });

  it('defter olayı kronolojisi, yönü ve net nakit aritmetiği sahteciliğini reddeder', () => {
    const invalidEvents = [
      {
        ...trade,
        clientOperationId: 'operation-trade-chronology',
        orderAt: '2026-08-13T10:00:00.000Z'
      },
      {
        ...trade,
        clientOperationId: 'operation-trade-direction',
        direction: 'cash_in',
        netCashAmount: 995
      },
      {
        ...trade,
        clientOperationId: 'operation-trade-net-arithmetic',
        netCashAmount: -999
      }
    ];

    for (const event of invalidEvents) {
      expect(evaluateIpcIntegrationPolicy('finance:recordLongTermPortfolioItem', [event]))
        .toEqual({ accepted: false, reason: 'LONG_TERM_PORTFOLIO_LEDGER_INVALID', path: '$[0]' });
    }
  });

  it('bütçe virmanını adetsiz tek kayıt ve haricî kıymet girişini kaynak belgeli kabul eder', () => {
    const budgetTransfer = {
      ...trade,
      clientOperationId: 'operation-budget-transfer',
      eventType: 'transfer_out',
      direction: 'non_cash',
      quantity: undefined,
      unitPrice: undefined,
      orderAt: undefined,
      settlementAt: undefined,
      grossAmount: 200,
      feeAmount: 0,
      netCashAmount: 0,
      transferCounterpartyInstrumentId: 'instrument-target'
    };
    expect(evaluateIpcIntegrationPolicy('finance:recordLongTermPortfolioItem', [budgetTransfer])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('finance:recordLongTermPortfolioItem', [{ ...budgetTransfer, quantity: 1 }]))
      .toEqual({ accepted: false, reason: 'LONG_TERM_PORTFOLIO_LEDGER_INVALID', path: '$[0]' });
    expect(evaluateIpcIntegrationPolicy('finance:recordLongTermPortfolioItem', [{ ...budgetTransfer, transferCounterpartyInstrumentId: undefined }]))
      .toEqual({ accepted: false, reason: 'LONG_TERM_PORTFOLIO_LEDGER_INVALID', path: '$[0]' });
    expect(evaluateIpcIntegrationPolicy('finance:recordLongTermPortfolioItem', [{
      ...trade,
      clientOperationId: 'operation-external-transfer-in',
      eventType: 'transfer_in',
      direction: 'security_in',
      orderAt: undefined,
      settlementAt: undefined,
      unitPrice: undefined,
      grossAmount: 0,
      feeAmount: 0,
      netCashAmount: 0,
      sourceDocumentReference: undefined
    }])).toEqual({ accepted: false, reason: 'LONG_TERM_PORTFOLIO_LEDGER_INVALID', path: '$[0]' });
  });
});
