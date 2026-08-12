import { describe, expect, it } from 'vitest';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';

const safeAccount = {
  ownerPersonId: 'person-1',
  institutionCode: '0046',
  iban: 'TR470000100100000350930001',
  accountType: 'checking',
  currency: 'TRY',
  alias: 'Aile bütçesi',
  ownershipBasisPoints: 10_000,
  status: 'active',
  privacy: 'private'
};

describe('32-Z B4 banking IPC boundary', () => {
  it('enforces exact list and IBAN validation channel arguments', () => {
    expect(evaluateIpcIntegrationPolicy('finance:listBankInstitutions', [])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('finance:listBankAccounts', [])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('finance:listBankAccounts', ['extra'])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('finance:validateIban', [{ iban: safeAccount.iban }])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('finance:validateIban', [{ iban: safeAccount.iban, extra: true }])).toMatchObject({ accepted: false });
  });

  it.each(['pan','cardNumber','cvv','cvc','pin','internetBankingPassword'])(
    'rejects the prohibited %s field before application dispatch',
    (field) => {
      expect(evaluateIpcIntegrationPolicy('finance:createBankAccount', [{ ...safeAccount, [field]: 'secret' }]))
        .toMatchObject({ accepted: false, reason: 'BANKING_SECRET_FIELD_PROHIBITED' });
    }
  );

  it('accepts only the exact typed bank account contract', () => {
    expect(evaluateIpcIntegrationPolicy('finance:createBankAccount', [safeAccount])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('finance:createBankAccount', [{ ...safeAccount, unexpected: true }]))
      .toMatchObject({ accepted: false, reason: 'UNKNOWN_OBJECT_FIELD' });
    expect(evaluateIpcIntegrationPolicy('finance:createBankAccount', [{ ...safeAccount, ownershipBasisPoints: 10_001 }]))
      .toMatchObject({ accepted: false, reason: 'BANK_ACCOUNT_ARGUMENT_INVALID' });
  });

  it('closes legacy finance record and valuation channels against banking secrets', () => {
    const safeFinanceRecord = {
      ownerPersonId: 'person-1',
      title: 'Aile bütçesi',
      kind: 'asset',
      amount: 1_000,
      currency: 'TRY',
      privacy: 'private',
      occurredAt: '2026-08-12T10:00:00.000Z'
    };
    expect(evaluateIpcIntegrationPolicy('finance:create', [safeFinanceRecord])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('finance:create', [{ ...safeFinanceRecord, cvv: '123' }]))
      .toMatchObject({ accepted: false, reason: 'BANKING_SECRET_FIELD_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('finance:create', [{ ...safeFinanceRecord, title: 'Kart 4111 1111 1111 1111' }]))
      .toMatchObject({ accepted: false, reason: 'BANKING_SECRET_VALUE_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('finance:createValuation', [{
      financeRecordId: 'finance-1',
      valueDate: '2026-08-12T10:00:00.000Z',
      unitPrice: 1,
      quantity: 1,
      provider: '4111-1111-1111-1111'
    }])).toMatchObject({ accepted: false, reason: 'BANKING_SECRET_VALUE_PROHIBITED' });
  });
});
