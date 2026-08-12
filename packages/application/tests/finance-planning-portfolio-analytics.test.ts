import { describe, expect, it } from 'vitest';
import type { FinancePlanningLedgerItemView, RecordFinancePlanningItemInput } from '@ppt/domain';
import {
  RecordFinancePlanningItemUseCase,
  buildFinancePlanningWorkspace,
  type FinanceUnitOfWork
} from '../src/finance-use-cases.js';
import { inspectFinancePlanningDataContract } from '../src/banking-security.js';

const context = {
  familyId: 'family-1' as never,
  actor: { userId: 'user-1' as never, role: 'family_admin' as const, personId: 'person-1' as never },
  correlationId: 'corr-1' as never
};

const exactCommands: readonly RecordFinancePlanningItemInput[] = [
  { itemType: 'category', ownerPersonId: 'person-1', name: 'Market', kind: 'expense', privacy: 'private' },
  { itemType: 'cash_flow', categoryId: 'category-1', amount: 250, currency: 'TRY', occurredAt: '2026-08-01T00:00:00.000Z', status: 'realized', description: 'Haftalık alışveriş' },
  { itemType: 'budget', categoryId: 'category-1', periodMonth: '2026-08', plannedAmount: 1_000, currency: 'TRY' },
  { itemType: 'recurring_rule', categoryId: 'category-1', amount: 500, currency: 'TRY', frequency: 'monthly', intervalCount: 1, startsAt: '2026-08-01T00:00:00.000Z', nextOccurrenceAt: '2026-09-01T00:00:00.000Z', description: 'Düzenli gider' },
  { itemType: 'recurring_state', recurringRuleId: 'rule-1', status: 'paused', effectiveAt: '2026-08-10T00:00:00.000Z' },
  { itemType: 'goal', ownerPersonId: 'person-1', title: 'Acil durum fonu', kind: 'emergency_fund', targetAmount: 10_000, initialAmount: 1_000, currency: 'TRY', privacy: 'private' },
  { itemType: 'goal_progress', goalId: 'goal-1', currentAmount: 3_000, recordedAt: '2026-08-10T00:00:00.000Z', note: 'Manuel ilerleme' },
  { itemType: 'asset', ownerPersonId: 'person-1', name: 'Aile altını', assetClass: 'precious_metal_fx', currency: 'TRY', quantity: 2, unitValue: 5_000, valuedAt: '2026-08-10T00:00:00.000Z', privacy: 'private' },
  { itemType: 'asset_valuation', assetId: 'asset-1', quantity: 2, unitValue: 5_500, valuedAt: '2026-08-11T00:00:00.000Z', note: 'Manuel değer' }
];

describe('33-C B4-10/B4-11/B4-12 finance planning and portfolio analytics', () => {
  it('accepts all nine exact contracts and rejects unknown or secret-bearing inputs', async () => {
    for (const command of exactCommands) {
      expect(inspectFinancePlanningDataContract(command)).toMatchObject({
        accepted: true,
        prohibitedFields: [],
        unknownFields: [],
        panLikeValueDetected: false
      });
    }
    expect(inspectFinancePlanningDataContract({ ...exactCommands[0], futureField: true })).toMatchObject({
      accepted: false,
      unknownFields: ['futureField']
    });
    expect(inspectFinancePlanningDataContract({ ...exactCommands[5], title: 'Hedef 4111 1111 1111 1111' }))
      .toMatchObject({ accepted: false, panLikeValueDetected: true });
    expect(inspectFinancePlanningDataContract({ ...exactCommands[7], cvv: '123' }))
      .toMatchObject({ accepted: false, prohibitedFields: ['cvv'] });

    const unitOfWork: FinanceUnitOfWork = {
      execute: async () => { throw new Error('transaction must not start'); }
    };
    const result = await new RecordFinancePlanningItemUseCase(unitOfWork).execute({
      context,
      command: { ...exactCommands[0], password: 'secret' } as never,
      identifiers: { itemId: 'category-1', auditId: 'audit-1', outboxEventId: 'event-1' as never }
    });
    expect(result).toMatchObject({ ok: false, error: { category: 'validation' } });
  });

  it('inherits child ownership and privacy, writes append-only rows, and redacts event payloads', async () => {
    const parent = {
      id: 'category-1', itemType: 'category', ownerPersonId: 'person-1', privacy: 'private',
      dataSource: 'manual', externalVerification: 'not_performed', createdAt: '2026-08-01T00:00:00.000Z',
      familyId: 'family-1', name: 'Market', kind: 'expense'
    } as const;
    let saved: Record<string, unknown> | undefined;
    let event: Record<string, unknown> | undefined;
    let capturedIntent: Record<string, unknown> | undefined;
    const scope = {
      occurredAt: '2026-08-12T12:00:00.000Z',
      findPerson: () => ({ ok: true, value: { id: 'person-1' } }),
      findRecord: () => ({ ok: true, value: null }),
      findLoanAccount: () => ({ ok: true, value: null }),
      findPlanningItem: () => ({ ok: true, value: parent }),
      findBankInstitution: () => ({ ok: true, value: null }),
      authorize: () => ({ ok: true, value: true }),
      insertRecord: () => ({ ok: true, value: undefined }),
      insertValuation: () => ({ ok: true, value: undefined }),
      insertBankAccount: () => ({ ok: true, value: undefined }),
      insertPaymentCard: () => ({ ok: true, value: undefined }),
      insertLoanAccount: () => ({ ok: true, value: undefined }),
      insertLoanPayment: () => ({ ok: true, value: undefined }),
      insertPlanningItem: (row: Record<string, unknown>) => { saved = row; return { ok: true, value: undefined }; },
      appendAudit: () => ({ ok: true, value: 'audit-hash' }),
      enqueueEvent: (row: Record<string, unknown>) => { event = row; return { ok: true, value: undefined }; }
    };
    const unitOfWork: FinanceUnitOfWork = {
      execute: async (_applicationContext, intent, operation) => {
        capturedIntent = intent;
        return operation(scope as never);
      }
    };
    const result = await new RecordFinancePlanningItemUseCase(unitOfWork).execute({
      context,
      command: exactCommands[1]!,
      identifiers: { itemId: 'cash-flow-1', auditId: 'audit-1', outboxEventId: 'event-1' as never }
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        itemType: 'cash_flow', categoryId: 'category-1', ownerPersonId: 'person-1',
        privacy: 'private', direction: 'expense', dataSource: 'manual', externalVerification: 'not_performed'
      }
    });
    expect(capturedIntent).toMatchObject({ action: 'update', resourceId: 'category-1', purpose: 'finance' });
    expect(saved).toMatchObject({ familyId: 'family-1', ownerPersonId: 'person-1', amount: 250 });
    expect(JSON.stringify(event)).not.toMatch(/250|Haftalık alışveriş/u);
  });

  it('builds latest-state budgets, goals, portfolios, upcoming payments, and separate-currency summaries', () => {
    const common = { ownerPersonId: 'person-1', privacy: 'private' as const, dataSource: 'manual' as const, externalVerification: 'not_performed' as const };
    const planningItems: FinancePlanningLedgerItemView[] = [
      { ...common, id: 'cat-expense', itemType: 'category', name: 'Market', kind: 'expense', createdAt: '2026-08-01T00:00:00.000Z' },
      { ...common, id: 'budget-old', itemType: 'budget', categoryId: 'cat-expense', periodMonth: '2026-08', plannedAmount: 900, currency: 'TRY', createdAt: '2026-08-01T01:00:00.000Z' },
      { ...common, id: 'budget-new', itemType: 'budget', categoryId: 'cat-expense', periodMonth: '2026-08', plannedAmount: 1_000, currency: 'TRY', createdAt: '2026-08-02T01:00:00.000Z' },
      { ...common, id: 'cash-realized', itemType: 'cash_flow', categoryId: 'cat-expense', direction: 'expense', amount: 1_200, currency: 'TRY', occurredAt: '2026-08-05T00:00:00.000Z', status: 'realized', createdAt: '2026-08-05T00:00:00.000Z' },
      { ...common, id: 'cash-planned', itemType: 'cash_flow', categoryId: 'cat-expense', direction: 'expense', amount: 300, currency: 'TRY', occurredAt: '2026-08-20T00:00:00.000Z', status: 'planned', description: 'Planlı market', createdAt: '2026-08-06T00:00:00.000Z' },
      { ...common, id: 'rule-1', itemType: 'recurring_rule', categoryId: 'cat-expense', direction: 'expense', amount: 500, currency: 'TRY', frequency: 'monthly', intervalCount: 1, startsAt: '2026-08-01T00:00:00.000Z', nextOccurrenceAt: '2026-09-01T00:00:00.000Z', initialStatus: 'active', createdAt: '2026-08-01T00:00:00.000Z' },
      { ...common, id: 'rule-state', itemType: 'recurring_state', recurringRuleId: 'rule-1', status: 'paused', effectiveAt: '2026-08-10T00:00:00.000Z', createdAt: '2026-08-10T00:00:00.000Z' },
      { ...common, id: 'goal-1', itemType: 'goal', title: 'Acil fon', kind: 'emergency_fund', targetAmount: 1_000, initialAmount: 100, currency: 'TRY', createdAt: '2026-08-01T00:00:00.000Z' },
      { ...common, id: 'goal-progress', itemType: 'goal_progress', goalId: 'goal-1', currentAmount: 600, recordedAt: '2026-08-10T00:00:00.000Z', createdAt: '2026-08-10T00:00:00.000Z' },
      { ...common, id: 'asset-try', itemType: 'asset', name: 'Altın', assetClass: 'precious_metal_fx', currency: 'TRY', initialQuantity: 2, initialUnitValue: 100, initialMarketValue: 200, initiallyValuedAt: '2026-08-01T00:00:00.000Z', createdAt: '2026-08-01T00:00:00.000Z' },
      { ...common, id: 'asset-try-value', itemType: 'asset_valuation', assetId: 'asset-try', quantity: 2, unitValue: 150, marketValue: 300, valuedAt: '2026-08-11T00:00:00.000Z', createdAt: '2026-08-11T00:00:00.000Z' },
      { ...common, id: 'asset-usd', itemType: 'asset', name: 'Döviz', assetClass: 'precious_metal_fx', currency: 'USD', initialQuantity: 10, initialUnitValue: 20, initialMarketValue: 200, initiallyValuedAt: '2026-08-01T00:00:00.000Z', createdAt: '2026-08-01T00:00:00.000Z' }
    ];
    const workspace = buildFinancePlanningWorkspace({
      planningItems,
      financeRecords: [{ id: 'debt-1', ownerPersonId: 'person-1', title: 'Borç', kind: 'debt', amount: 300, remainingPrincipal: 300, currency: 'TRY', privacy: 'private', occurredAt: '2026-01-01T00:00:00.000Z', dueAt: '2026-08-25T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' }],
      financeValuations: [],
      paymentCards: [{ id: 'card-1', ownerPersonId: 'person-1', productName: 'Aile kartı', currentDebt: 200, statementBalance: 200, paymentDueAt: '2026-08-22T00:00:00.000Z', currency: 'TRY', status: 'active', privacy: 'private' } as never],
      loanAccounts: [{ id: 'loan-1', ownerPersonId: 'person-1', title: 'Aile kredisi', remainingPrincipal: 400, currency: 'TRY', status: 'active', privacy: 'private', paymentHistory: [], paymentSchedule: [{ sequence: 1, dueAt: '2026-08-23T00:00:00.000Z', scheduledAmount: 100 }] } as never],
      generatedAt: '2026-08-12T00:00:00.000Z'
    });
    expect(workspace.budgetVariances).toEqual([expect.objectContaining({
      budgetRevisionId: 'budget-new', plannedAmount: 1_000, realizedAmount: 1_200,
      varianceAmount: 200, overBudget: true
    })]);
    expect(workspace.recurringRules[0]).toMatchObject({ currentStatus: 'paused', stateHistory: [{ id: 'rule-state' }] });
    expect(workspace.goals[0]).toMatchObject({ currentAmount: 600, completionBasisPoints: 6_000, achieved: false });
    expect(workspace.portfolioAssets.find((item) => item.id === 'asset-try')).toMatchObject({ currentMarketValue: 300, currentUnitValue: 150 });
    expect(workspace.familySummary.currencySummaries).toEqual([
      expect.objectContaining({ currency: 'TRY', assetValue: 300, liabilityValue: 900, netWorth: -600, realizedExpense: 1_200 }),
      expect.objectContaining({ currency: 'USD', assetValue: 200, liabilityValue: 0, netWorth: 200 })
    ]);
    expect(workspace.familySummary.crossCurrencyAggregationPerformed).toBe(false);
    expect(workspace.upcomingPayments.map((item) => item.source)).toEqual(expect.arrayContaining([
      'planned_cash_flow', 'payment_card', 'loan', 'finance_record'
    ]));
    expect(workspace.upcomingPayments.some((item) => item.source === 'recurring_rule')).toBe(false);
    expect(workspace).toMatchObject({
      dataSource: 'manual', externalPricing: 'not_performed', bankSynchronization: 'not_performed', paymentExecution: 'not_performed'
    });
  });
});
