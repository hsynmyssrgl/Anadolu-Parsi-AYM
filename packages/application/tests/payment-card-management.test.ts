import { describe, expect, it } from 'vitest';
import type { CreatePaymentCardInput } from '@ppt/domain';
import { CreatePaymentCardUseCase, type FinanceUnitOfWork } from '../src/finance-use-cases.js';
import { inspectPaymentCardDataContract } from '../src/banking-security.js';

const safeCard: CreatePaymentCardInput = {
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

describe('33-A B4-05/B4-06 payment card management', () => {
  it('accepts the exact last-four-only aggregate contract', () => {
    expect(inspectPaymentCardDataContract(safeCard)).toMatchObject({
      accepted: true,
      prohibitedFields: [],
      unknownFields: [],
      panLikeValueDetected: false
    });
  });

  it.each(['pan','cardNumber','cvv','cvc','pin','internetBankingPassword'])(
    'rejects prohibited %s fields',
    (field) => {
      expect(inspectPaymentCardDataContract({ ...safeCard, [field]: 'secret' })).toMatchObject({
        accepted: false,
        prohibitedFields: [field]
      });
    }
  );

  it('rejects unknown fields and a Luhn-valid full PAN hidden in the product name', () => {
    expect(inspectPaymentCardDataContract({ ...safeCard, futureField: true })).toMatchObject({
      accepted: false,
      unknownFields: ['futureField']
    });
    expect(inspectPaymentCardDataContract({ ...safeCard, productName: 'Kart 4111 1111 1111 1111' })).toMatchObject({
      accepted: false,
      panLikeValueDetected: true
    });
  });

  it('fails closed in the application layer before opening a finance transaction', async () => {
    const unitOfWork: FinanceUnitOfWork = {
      execute: async () => { throw new Error('transaction must not start'); }
    };
    const useCase = new CreatePaymentCardUseCase(unitOfWork);
    const result = await useCase.execute({
      context: {
        familyId: 'family-1' as never,
        actor: { userId: 'user-1' as never, role: 'family_admin' },
        correlationId: 'corr-1' as never
      },
      command: { ...safeCard, cvv: '123' } as never,
      identifiers: { cardId: 'card-1', auditId: 'audit-1', outboxEventId: 'event-1' as never }
    });
    expect(result).toMatchObject({ ok: false, error: { category: 'validation' } });
  });
});
