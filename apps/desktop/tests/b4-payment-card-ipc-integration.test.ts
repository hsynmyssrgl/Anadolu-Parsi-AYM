import { describe, expect, it } from 'vitest';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';

const safeCard = {
  ownerPersonId: 'person-1',
  institutionCode: '0046',
  productName: 'Aile kredi kartı',
  kind: 'credit',
  network: 'troy',
  formFactor: 'virtual',
  last4: '7392',
  currency: 'TRY',
  creditLimit: 50_000,
  availableLimit: 30_000,
  currentDebt: 20_000,
  statementBalance: 15_000,
  statementClosingAt: '2026-08-10T00:00:00.000Z',
  paymentDueAt: '2026-08-20T00:00:00.000Z',
  activeInstallmentCount: 3,
  installmentOutstandingAmount: 9_000,
  automaticPaymentMode: 'full',
  rewardPoints: 1_250,
  rewardMiles: 400,
  annualFeeAmount: 750,
  annualFeeDueAt: '2027-08-10T00:00:00.000Z',
  alertsEnabled: true,
  utilizationAlertBasisPoints: 8_000,
  paymentDueAlertDays: 3,
  status: 'active',
  privacy: 'private'
};

describe('33-A B4-05/B4-06 payment card IPC boundary', () => {
  it('accepts zero-argument listing and the exact typed create contract', () => {
    expect(evaluateIpcIntegrationPolicy('finance:listPaymentCards', [])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('finance:listPaymentCards', ['extra'])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('finance:createPaymentCard', [safeCard])).toEqual({ accepted: true });
  });

  it.each(['pan','cardNumber','cvv','cvc','pin','internetBankingPassword'])(
    'rejects prohibited %s fields before dispatch',
    (field) => {
      expect(evaluateIpcIntegrationPolicy('finance:createPaymentCard', [{ ...safeCard, [field]: 'secret' }]))
        .toMatchObject({ accepted: false, reason: 'BANKING_SECRET_FIELD_PROHIBITED' });
    }
  );

  it('rejects unknown fields and a full PAN hidden in the product name', () => {
    expect(evaluateIpcIntegrationPolicy('finance:createPaymentCard', [{ ...safeCard, futureField: true }]))
      .toMatchObject({ accepted: false, reason: 'UNKNOWN_OBJECT_FIELD' });
    expect(evaluateIpcIntegrationPolicy('finance:createPaymentCard', [{ ...safeCard, productName: 'Kart 4111 1111 1111 1111' }]))
      .toMatchObject({ accepted: false, reason: 'BANKING_SECRET_VALUE_PROHIBITED' });
  });

  it('rejects non-last-four identifiers and inconsistent finance summaries', () => {
    expect(evaluateIpcIntegrationPolicy('finance:createPaymentCard', [{ ...safeCard, last4: '4111111111111111' }]))
      .toMatchObject({ accepted: false, reason: 'PAYMENT_CARD_ARGUMENT_INVALID' });
    expect(evaluateIpcIntegrationPolicy('finance:createPaymentCard', [{ ...safeCard, availableLimit: 50_001 }]))
      .toMatchObject({ accepted: false, reason: 'PAYMENT_CARD_ARGUMENT_INVALID' });
    expect(evaluateIpcIntegrationPolicy('finance:createPaymentCard', [{ ...safeCard, activeInstallmentCount: 0 }]))
      .toMatchObject({ accepted: false, reason: 'PAYMENT_CARD_ARGUMENT_INVALID' });
  });
});
