import { describe, expect, it } from 'vitest';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';

const exactInputs = [
  { itemType: 'category', ownerPersonId: 'person-1', name: 'Market', kind: 'expense', privacy: 'private' },
  { itemType: 'cash_flow', categoryId: 'category-1', amount: 250, currency: 'TRY', occurredAt: '2026-08-01T00:00:00.000Z', status: 'realized', description: 'Market harcaması' },
  { itemType: 'budget', categoryId: 'category-1', periodMonth: '2026-08', plannedAmount: 1_000, currency: 'TRY' },
  { itemType: 'recurring_rule', categoryId: 'category-1', amount: 500, currency: 'TRY', frequency: 'monthly', intervalCount: 1, startsAt: '2026-08-01T00:00:00.000Z', nextOccurrenceAt: '2026-09-01T00:00:00.000Z', description: 'Düzenli gider' },
  { itemType: 'recurring_state', recurringRuleId: 'rule-1', status: 'paused', effectiveAt: '2026-08-10T00:00:00.000Z' },
  { itemType: 'goal', ownerPersonId: 'person-1', title: 'Acil fon', kind: 'emergency_fund', targetAmount: 10_000, initialAmount: 1_000, currency: 'TRY', privacy: 'private' },
  { itemType: 'goal_progress', goalId: 'goal-1', currentAmount: 2_500, recordedAt: '2026-08-10T00:00:00.000Z', note: 'Manuel ilerleme' },
  { itemType: 'asset', ownerPersonId: 'person-1', name: 'Aile altını', assetClass: 'precious_metal_fx', currency: 'TRY', quantity: 2, unitValue: 5_000, valuedAt: '2026-08-10T00:00:00.000Z', privacy: 'private' },
  { itemType: 'asset_valuation', assetId: 'asset-1', quantity: 2, unitValue: 5_500, valuedAt: '2026-08-11T00:00:00.000Z', note: 'Manuel değer' }
] as const;

describe('33-C B4-10/B4-11/B4-12 finance planning IPC boundary', () => {
  it('accepts the zero-argument workspace read and all nine exact write contracts', () => {
    expect(evaluateIpcIntegrationPolicy('finance:getPlanningWorkspace', [])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('finance:getPlanningWorkspace', ['extra'])).toMatchObject({ accepted: false });
    for (const input of exactInputs) {
      expect(evaluateIpcIntegrationPolicy('finance:recordPlanningItem', [input])).toEqual({ accepted: true });
    }
  });

  it.each(['pan', 'cardNumber', 'cvv', 'cvc', 'pin', 'internetBankingPassword'])(
    'rejects prohibited %s fields before dispatch',
    (field) => {
      expect(evaluateIpcIntegrationPolicy('finance:recordPlanningItem', [{ ...exactInputs[7], [field]: 'secret' }]))
        .toMatchObject({ accepted: false, reason: 'BANKING_SECRET_FIELD_PROHIBITED' });
    }
  );

  it('rejects unknown fields, Luhn-valid PAN values, invalid item types, and unsafe numeric values', () => {
    expect(evaluateIpcIntegrationPolicy('finance:recordPlanningItem', [{ ...exactInputs[0], futureField: true }]))
      .toMatchObject({ accepted: false, reason: 'UNKNOWN_OBJECT_FIELD' });
    expect(evaluateIpcIntegrationPolicy('finance:recordPlanningItem', [{ ...exactInputs[5], title: 'Hedef 4111 1111 1111 1111' }]))
      .toMatchObject({ accepted: false, reason: 'BANKING_SECRET_VALUE_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('finance:recordPlanningItem', [{ itemType: 'bank_sync' }]))
      .toMatchObject({ accepted: false, reason: 'FINANCE_PLANNING_ITEM_TYPE_INVALID' });
    expect(evaluateIpcIntegrationPolicy('finance:recordPlanningItem', [{ ...exactInputs[8], quantity: Number.POSITIVE_INFINITY }]))
      .toMatchObject({ accepted: false, reason: 'FINANCE_PLANNING_ARGUMENT_INVALID' });
  });
});
