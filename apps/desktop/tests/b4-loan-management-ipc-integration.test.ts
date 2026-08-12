import { describe, expect, it } from 'vitest';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';

const safeLoan = {
  ownerPersonId: 'person-1', institutionCode: '0046', title: 'Aile konut kredisi',
  kind: 'mortgage', rateType: 'fixed', annualRateBasisPoints: 3_250, termMonths: 120,
  currency: 'TRY', originalPrincipal: 1_000_000, installmentAmount: 12_000,
  remainingPrincipal: 900_000, disbursedAt: '2026-01-01T00:00:00.000Z',
  firstPaymentAt: '2026-02-01T00:00:00.000Z', earlySettlementAmount: 880_000,
  earlySettlementQuotedAt: '2026-08-01T00:00:00.000Z', overdueInstallmentCount: 0,
  overdueAmount: 0, daysPastDue: 0, insuranceStatus: 'active',
  insuranceProvider: 'Aile Sigorta', insurancePolicyReference: 'POL-2026-01',
  insurancePremiumAmount: 5_000, insuranceEndsAt: '2027-01-01T00:00:00.000Z',
  collateralType: 'real_estate', collateralDescription: 'Aile konutu',
  collateralEstimatedValue: 2_000_000, status: 'active', privacy: 'private'
};

const safePayment = {
  loanId: 'loan-1', paidAt: '2026-08-01T00:00:00.000Z', scheduledInstallmentSequence: 7,
  amount: 12_000, principalAmount: 9_000, interestAmount: 3_000, lateFeeAmount: 0,
  notes: 'Manuel ödeme özeti'
};

describe('33-B B4-08/B4-09 loan IPC boundary', () => {
  it('accepts zero-argument listing and exact create/payment contracts', () => {
    expect(evaluateIpcIntegrationPolicy('finance:listLoanAccounts', [])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('finance:listLoanAccounts', ['extra'])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('finance:createLoanAccount', [safeLoan])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('finance:recordLoanPayment', [safePayment])).toEqual({ accepted: true });
  });

  it.each(['pan','cardNumber','cvv','cvc','pin','internetBankingPassword'])(
    'rejects prohibited %s fields before dispatch',
    (field) => {
      expect(evaluateIpcIntegrationPolicy('finance:createLoanAccount', [{ ...safeLoan, [field]: 'secret' }]))
        .toMatchObject({ accepted: false, reason: 'BANKING_SECRET_FIELD_PROHIBITED' });
    }
  );

  it('rejects unknown fields and full PAN values in descriptions or notes', () => {
    expect(evaluateIpcIntegrationPolicy('finance:createLoanAccount', [{ ...safeLoan, futureField: true }]))
      .toMatchObject({ accepted: false, reason: 'UNKNOWN_OBJECT_FIELD' });
    expect(evaluateIpcIntegrationPolicy('finance:createLoanAccount', [{ ...safeLoan, collateralDescription: '4111 1111 1111 1111' }]))
      .toMatchObject({ accepted: false, reason: 'BANKING_SECRET_VALUE_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('finance:recordLoanPayment', [{ ...safePayment, notes: '4111 1111 1111 1111' }]))
      .toMatchObject({ accepted: false, reason: 'BANKING_SECRET_VALUE_PROHIBITED' });
  });

  it('rejects incoherent status, insurance, collateral and payment totals', () => {
    expect(evaluateIpcIntegrationPolicy('finance:createLoanAccount', [{ ...safeLoan, status: 'overdue' }]))
      .toMatchObject({ accepted: false, reason: 'LOAN_ACCOUNT_ARGUMENT_INVALID' });
    expect(evaluateIpcIntegrationPolicy('finance:createLoanAccount', [{ ...safeLoan, insuranceStatus: 'none' }]))
      .toMatchObject({ accepted: false, reason: 'LOAN_ACCOUNT_ARGUMENT_INVALID' });
    expect(evaluateIpcIntegrationPolicy('finance:createLoanAccount', [{ ...safeLoan, collateralType: 'none' }]))
      .toMatchObject({ accepted: false, reason: 'LOAN_ACCOUNT_ARGUMENT_INVALID' });
    expect(evaluateIpcIntegrationPolicy('finance:recordLoanPayment', [{ ...safePayment, amount: 11_999 }]))
      .toMatchObject({ accepted: false, reason: 'LOAN_PAYMENT_ARGUMENT_INVALID' });
  });
});
