import { describe, expect, it } from 'vitest';
import type { CreateLoanAccountInput, RecordLoanPaymentInput } from '@ppt/domain';
import {
  CreateLoanAccountUseCase,
  RecordLoanPaymentUseCase,
  type FinanceUnitOfWork
} from '../src/finance-use-cases.js';
import {
  inspectLoanAccountDataContract,
  inspectLoanPaymentDataContract
} from '../src/banking-security.js';

const safeLoan: CreateLoanAccountInput = {
  ownerPersonId: 'person-1',
  institutionCode: '0046',
  title: 'Aile konut kredisi',
  kind: 'mortgage',
  rateType: 'fixed',
  annualRateBasisPoints: 3_250,
  termMonths: 3,
  currency: 'TRY',
  originalPrincipal: 300_000,
  installmentAmount: 110_000,
  remainingPrincipal: 300_000,
  disbursedAt: '2026-01-01T00:00:00.000Z',
  firstPaymentAt: '2026-01-31T00:00:00.000Z',
  earlySettlementAmount: 0,
  overdueInstallmentCount: 0,
  overdueAmount: 0,
  daysPastDue: 0,
  insuranceStatus: 'none',
  insurancePremiumAmount: 0,
  collateralType: 'real_estate',
  collateralDescription: 'Aile konutu',
  collateralEstimatedValue: 1_500_000,
  status: 'active',
  privacy: 'private'
};

const context = {
  familyId: 'family-1' as never,
  actor: { userId: 'user-1' as never, role: 'family_admin' as const },
  correlationId: 'corr-1' as never
};

describe('33-B B4-08/B4-09 loan management', () => {
  it('accepts the exact manual loan and payment contracts', () => {
    expect(inspectLoanAccountDataContract(safeLoan)).toMatchObject({
      accepted: true,
      prohibitedFields: [],
      unknownFields: [],
      panLikeValueDetected: false
    });
    expect(inspectLoanPaymentDataContract({
      loanId: 'loan-1',
      paidAt: '2026-02-01T00:00:00.000Z',
      scheduledInstallmentSequence: 1,
      amount: 110_000,
      principalAmount: 90_000,
      interestAmount: 20_000,
      lateFeeAmount: 0,
      notes: 'Manuel dekont özeti'
    })).toMatchObject({ accepted: true, unknownFields: [] });
  });

  it.each(['pan','cardNumber','cvv','cvc','pin','internetBankingPassword'])(
    'rejects prohibited %s fields before a transaction',
    async (field) => {
      expect(inspectLoanAccountDataContract({ ...safeLoan, [field]: 'secret' })).toMatchObject({
        accepted: false,
        prohibitedFields: [field]
      });
      const unitOfWork: FinanceUnitOfWork = {
        execute: async () => { throw new Error('transaction must not start'); }
      };
      const result = await new CreateLoanAccountUseCase(unitOfWork).execute({
        context,
        command: { ...safeLoan, [field]: 'secret' } as never,
        identifiers: { loanId: 'loan-1', auditId: 'audit-1', outboxEventId: 'event-1' as never }
      });
      expect(result).toMatchObject({ ok: false, error: { category: 'validation' } });
    }
  );

  it('rejects unknown fields and a Luhn-valid PAN hidden in loan descriptions', () => {
    expect(inspectLoanAccountDataContract({ ...safeLoan, futureField: true })).toMatchObject({
      accepted: false,
      unknownFields: ['futureField']
    });
    expect(inspectLoanAccountDataContract({ ...safeLoan, collateralDescription: 'Teminat 4111 1111 1111 1111' }))
      .toMatchObject({ accepted: false, panLikeValueDetected: true });
    expect(inspectLoanPaymentDataContract({
      loanId: 'loan-1', paidAt: '2026-02-01T00:00:00.000Z', amount: 1,
      principalAmount: 1, interestAmount: 0, lateFeeAmount: 0, notes: '4111 1111 1111 1111'
    })).toMatchObject({ accepted: false, panLikeValueDetected: true });
  });

  it('generates a month-end-safe plan and redacts money from the creation event', async () => {
    let savedLoan: Record<string, unknown> | undefined;
    let creationEvent: Record<string, unknown> | undefined;
    const scope = {
      occurredAt: '2026-08-12T12:00:00.000Z',
      findPerson: () => ({ ok: true, value: { id: 'person-1' } }),
      findRecord: () => ({ ok: true, value: null }),
      findLoanAccount: () => ({ ok: true, value: savedLoan ?? null }),
      findBankInstitution: () => ({ ok: true, value: {
        institutionCode: '0046', ibanProviderCode: '00046', officialName: 'AKBANK T.A.Ş.', countryCode: 'TR',
        kind: 'bank', supportsCustomerAccounts: true, iconKey: 'AK', iconSource: 'local_lettermark',
        sourceName: 'TCMB Ödeme Sistemleri Katılımcıları', sourceVersion: '2026', sourceUrl: 'https://example.test',
        sourceRetrievedAt: '2026-08-10T00:00:00.000Z', status: 'active'
      } }),
      authorize: () => ({ ok: true, value: true }),
      insertRecord: () => ({ ok: true, value: undefined }),
      insertValuation: () => ({ ok: true, value: undefined }),
      insertBankAccount: () => ({ ok: true, value: undefined }),
      insertPaymentCard: () => ({ ok: true, value: undefined }),
      insertLoanAccount: (row: Record<string, unknown>) => { savedLoan = row; return { ok: true, value: undefined }; },
      insertLoanPayment: () => ({ ok: true, value: undefined }),
      appendAudit: () => ({ ok: true, value: 'audit-hash' }),
      enqueueEvent: (event: Record<string, unknown>) => { creationEvent = event; return { ok: true, value: undefined }; }
    };
    const unitOfWork: FinanceUnitOfWork = {
      execute: async (_applicationContext, _intent, operation) => operation(scope as never)
    };
    const result = await new CreateLoanAccountUseCase(unitOfWork).execute({
      context,
      command: safeLoan,
      identifiers: { loanId: 'loan-1', auditId: 'audit-1', outboxEventId: 'event-1' as never }
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.paymentSchedule.map((item) => item.dueAt)).toEqual([
      '2026-01-31T00:00:00.000Z',
      '2026-02-28T00:00:00.000Z',
      '2026-03-31T00:00:00.000Z'
    ]);
    expect(result.value).toMatchObject({ dataSource: 'manual', bankVerification: 'not_performed', paymentExecution: 'not_performed' });
    expect(JSON.stringify(creationEvent)).not.toMatch(/300000|110000|1500000|Aile konutu/u);
  });

  it('records append-only payment history with a component-exact total and a redacted event', async () => {
    const loan = {
      id: 'loan-1', ownerPersonId: 'person-1', privacy: 'private', termMonths: 3,
      disbursedAt: '2026-01-01T00:00:00.000Z'
    };
    let savedPayment: Record<string, unknown> | undefined;
    let paymentEvent: Record<string, unknown> | undefined;
    const scope = {
      occurredAt: '2026-08-12T12:00:00.000Z',
      findPerson: () => ({ ok: true, value: { id: 'person-1' } }),
      findRecord: () => ({ ok: true, value: null }),
      findLoanAccount: () => ({ ok: true, value: loan }),
      findBankInstitution: () => ({ ok: true, value: null }),
      authorize: () => ({ ok: true, value: true }),
      insertRecord: () => ({ ok: true, value: undefined }),
      insertValuation: () => ({ ok: true, value: undefined }),
      insertBankAccount: () => ({ ok: true, value: undefined }),
      insertPaymentCard: () => ({ ok: true, value: undefined }),
      insertLoanAccount: () => ({ ok: true, value: undefined }),
      insertLoanPayment: (row: Record<string, unknown>) => { savedPayment = row; return { ok: true, value: undefined }; },
      appendAudit: () => ({ ok: true, value: 'audit-hash' }),
      enqueueEvent: (event: Record<string, unknown>) => { paymentEvent = event; return { ok: true, value: undefined }; }
    };
    const unitOfWork: FinanceUnitOfWork = {
      execute: async (_applicationContext, _intent, operation) => operation(scope as never)
    };
    const command: RecordLoanPaymentInput = {
      loanId: 'loan-1',
      paidAt: '2026-02-01T00:00:00.000Z',
      scheduledInstallmentSequence: 1,
      amount: 110_000,
      principalAmount: 90_000,
      interestAmount: 20_000,
      lateFeeAmount: 0,
      notes: 'Manuel ödeme özeti'
    };
    const result = await new RecordLoanPaymentUseCase(unitOfWork).execute({
      context,
      command,
      identifiers: { paymentId: 'payment-1', auditId: 'audit-2', outboxEventId: 'event-2' as never }
    });
    expect(result).toMatchObject({ ok: true, value: { id: 'payment-1', amount: 110_000 } });
    expect(savedPayment).toMatchObject({ loanId: 'loan-1', principalAmount: 90_000, interestAmount: 20_000 });
    expect(JSON.stringify(paymentEvent)).not.toMatch(/110000|90000|20000|Manuel ödeme/u);
  });

  it('rejects inconsistent overdue state and payment components before opening a transaction', async () => {
    const unitOfWork: FinanceUnitOfWork = {
      execute: async () => { throw new Error('transaction must not start'); }
    };
    const loanResult = await new CreateLoanAccountUseCase(unitOfWork).execute({
      context,
      command: { ...safeLoan, status: 'overdue', overdueInstallmentCount: 0, overdueAmount: 0, daysPastDue: 0 },
      identifiers: { loanId: 'loan-1', auditId: 'audit-1', outboxEventId: 'event-1' as never }
    });
    expect(loanResult).toMatchObject({ ok: false, error: { category: 'validation' } });
    const paymentResult = await new RecordLoanPaymentUseCase(unitOfWork).execute({
      context,
      command: {
        loanId: 'loan-1', paidAt: '2026-02-01T00:00:00.000Z', amount: 100,
        principalAmount: 80, interestAmount: 10, lateFeeAmount: 0
      },
      identifiers: { paymentId: 'payment-1', auditId: 'audit-2', outboxEventId: 'event-2' as never }
    });
    expect(paymentResult).toMatchObject({ ok: false, error: { category: 'validation' } });
  });
});
