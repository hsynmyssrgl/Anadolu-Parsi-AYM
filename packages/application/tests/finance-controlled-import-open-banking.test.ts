import { describe, expect, it } from 'vitest';
import type { CommitFinanceImportBatchInput, FinancePlanningLedgerItemView } from '@ppt/domain';
import {
  CommitFinanceImportBatchUseCase,
  buildFinancePlanningWorkspace,
  type FinanceUnitOfWork
} from '../src/finance-use-cases.js';

const context = {
  familyId: 'family-1' as never,
  actor: { userId: 'user-1' as never, role: 'family_admin' as const, personId: 'person-1' as never },
  correlationId: 'corr-import-1' as never
};

const command = (duplicateStrategy: 'skip'|'reject' = 'skip'): CommitFinanceImportBatchInput => ({
  ownerPersonId: 'person-1',
  privacy: 'private',
  sourceMode: 'controlled_file',
  sourceFormat: 'csv',
  fileName: 'transactions.csv',
  fileSha256: 'f'.repeat(64),
  mapping: { dateColumn: 'date', amountColumn: 'amount', amountMode: 'signed' },
  defaultCurrency: 'TRY',
  duplicateStrategy,
  totalRows: 2,
  rows: [
    { categoryId: 'category-expense', direction: 'expense', amount: 100, currency: 'TRY', occurredAt: '2026-08-01T12:00:00.000Z', description: 'Market', sourceRowNumber: 2, rowFingerprint: 'a'.repeat(64) },
    { categoryId: 'category-expense', direction: 'expense', amount: 50, currency: 'TRY', occurredAt: '2026-08-02T12:00:00.000Z', description: 'Transport', sourceRowNumber: 3, rowFingerprint: 'b'.repeat(64) }
  ]
});

describe('33-D B4-13/B4-14 controlled import and local OHVPS boundary', () => {
  it('commits an exact append-only batch and skips a persistent duplicate atomically', async () => {
    const batches: Record<string, unknown>[] = [];
    const entries: Record<string, unknown>[] = [];
    let sealed = false;
    let event: Record<string, unknown> | undefined;
    const category = {
      id: 'category-expense', familyId: 'family-1', ownerPersonId: 'person-1', privacy: 'private',
      itemType: 'category', name: 'Expenses', kind: 'expense', dataSource: 'manual',
      externalVerification: 'not_performed', createdAt: '2026-07-01T00:00:00.000Z'
    } as const;
    const scope = {
      occurredAt: '2026-08-12T12:00:00.000Z',
      findPerson: () => ({ ok: true, value: { id: 'person-1' } }),
      findRecord: () => ({ ok: true, value: null }),
      findLoanAccount: () => ({ ok: true, value: null }),
      findPlanningItem: () => ({ ok: true, value: null }),
      findPlanningCategoryForImport: () => ({ ok: true, value: category }),
      hasImportedFingerprint: (fingerprint: string) => ({ ok: true, value: fingerprint === 'b'.repeat(64) }),
      findBankInstitution: () => ({ ok: true, value: null }),
      authorize: () => ({ ok: true, value: true }),
      insertRecord: () => ({ ok: true, value: undefined }),
      insertValuation: () => ({ ok: true, value: undefined }),
      insertBankAccount: () => ({ ok: true, value: undefined }),
      insertPaymentCard: () => ({ ok: true, value: undefined }),
      insertLoanAccount: () => ({ ok: true, value: undefined }),
      insertLoanPayment: () => ({ ok: true, value: undefined }),
      insertPlanningItem: () => ({ ok: true, value: undefined }),
      insertImportBatch: (row: Record<string, unknown>) => { batches.push(row); return { ok: true, value: undefined }; },
      insertImportedCashFlow: (row: Record<string, unknown>) => { entries.push(row); return { ok: true, value: undefined }; },
      sealImportBatch: () => { sealed = true; return { ok: true, value: undefined }; },
      appendAudit: () => ({ ok: true, value: 'audit-hash' }),
      enqueueEvent: (row: Record<string, unknown>) => { event = row; return { ok: true, value: undefined }; }
    };
    const unitOfWork: FinanceUnitOfWork = { execute: async (_context, _intent, operation) => operation(scope as never) };
    const useCase = new CommitFinanceImportBatchUseCase(unitOfWork);
    const result = await useCase.execute({
      context,
      command: command(),
      identifiers: {
        batchId: 'finance-import-batch-1',
        entryIds: ['finance-import-entry-1','finance-import-entry-2'],
        auditId: 'audit-1',
        outboxEventId: 'event-1' as never
      }
    });
    expect(result).toMatchObject({ ok: true, value: { status: 'committed', importedRows: 1, duplicateRows: 1 } });
    expect(batches).toEqual([expect.objectContaining({ status: 'staging', importedRows: 1, duplicateRows: 1 })]);
    expect(entries).toEqual([expect.objectContaining({ id: 'finance-import-entry-1', dataSource: 'file_import', amount: 100 })]);
    expect(sealed).toBe(true);
    expect(JSON.stringify(event)).not.toMatch(/Market|Transport|100/u);
  });

  it('rejects the whole batch when duplicate strategy is reject', async () => {
    let inserted = false;
    const scope = {
      occurredAt: '2026-08-12T12:00:00.000Z',
      findPerson: () => ({ ok: true, value: { id: 'person-1' } }),
      findPlanningCategoryForImport: () => ({ ok: true, value: { id: 'category-expense', itemType: 'category', kind: 'expense', ownerPersonId: 'person-1', privacy: 'private' } }),
      hasImportedFingerprint: () => ({ ok: true, value: true }),
      authorize: () => ({ ok: true, value: true }),
      insertImportBatch: () => { inserted = true; return { ok: true, value: undefined }; }
    };
    const unitOfWork: FinanceUnitOfWork = { execute: async (_context, _intent, operation) => operation(scope as never) };
    const useCase = new CommitFinanceImportBatchUseCase(unitOfWork);
    const result = await useCase.execute({
      context,
      command: command('reject'),
      identifiers: { batchId: 'finance-import-batch-2', entryIds: ['entry-1','entry-2'], auditId: 'audit-2', outboxEventId: 'event-2' as never }
    });
    expect(result).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(inserted).toBe(false);
    const invalidMapping = await useCase.execute({
      context,
      command: {
        ...command(),
        mapping: {
          dateColumn: 'date', amountColumn: 'date', amountMode: 'signed', futureColumn: 'unsafe'
        } as never
      },
      identifiers: { batchId: 'finance-import-batch-3', entryIds: ['entry-3','entry-4'], auditId: 'audit-3', outboxEventId: 'event-3' as never }
    });
    expect(invalidMapping).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(inserted).toBe(false);
  });

  it('includes imported realized flows in budgets and exposes an honest network-free adapter contract', () => {
    const common = { ownerPersonId: 'person-1', privacy: 'private' as const, dataSource: 'manual' as const, externalVerification: 'not_performed' as const };
    const planningItems: FinancePlanningLedgerItemView[] = [
      { ...common, id: 'category-expense', itemType: 'category', name: 'Expenses', kind: 'expense', createdAt: '2026-07-01T00:00:00.000Z' },
      { ...common, id: 'budget-1', itemType: 'budget', categoryId: 'category-expense', periodMonth: '2026-08', plannedAmount: 500, currency: 'TRY', createdAt: '2026-08-01T00:00:00.000Z' }
    ];
    const workspace = buildFinancePlanningWorkspace({
      planningItems,
      importedCashFlowEntries: [{
        id: 'entry-1', batchId: 'batch-1', ownerPersonId: 'person-1', categoryId: 'category-expense',
        direction: 'expense', amount: 200, currency: 'TRY', occurredAt: '2026-08-02T12:00:00.000Z',
        sourceRowNumber: 2, rowFingerprint: 'a'.repeat(64), privacy: 'private', dataSource: 'file_import',
        externalVerification: 'not_performed', createdAt: '2026-08-12T12:00:00.000Z'
      }],
      importBatches: [],
      financeRecords: [], financeValuations: [], paymentCards: [], loanAccounts: [],
      generatedAt: '2026-08-12T12:00:00.000Z'
    });
    expect(workspace.budgetVariances[0]).toMatchObject({ realizedAmount: 200, varianceAmount: -300 });
    expect(workspace.familySummary.currencySummaries[0]).toMatchObject({ realizedExpense: 200 });
    expect(workspace.openBankingBoundary).toEqual({
      adapterContract: 'ohvps-v1-local', supportedModes: ['sandbox','manual_fallback'],
      sandboxData: 'synthetic_local', manualFallback: 'controlled_file_import', liveBankConnection: 'not_implemented',
      networkAccess: 'not_performed', credentialCollection: 'prohibited', externalConsent: 'not_performed'
    });
  });
});
