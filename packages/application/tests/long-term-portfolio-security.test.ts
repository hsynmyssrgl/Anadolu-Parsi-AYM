import { describe, expect, it } from 'vitest';
import { buildDefaultLongTermPortfolioBootstrap, type RecordLongTermPortfolioItemInput } from '@ppt/domain';
import {
  RecordLongTermPortfolioItemUseCase,
  buildLongTermPortfolioWorkspace,
  type LongTermPortfolioApplicationContext,
  type LongTermPortfolioPolicyIntent,
  type LongTermPortfolioUnitOfWork,
  type LongTermPortfolioWriteScope,
  type RecordLongTermPortfolioIdentifiers
} from '../src/long-term-portfolio-use-cases.js';

const NOW = '2026-08-13T09:00:00.000Z';
const context: LongTermPortfolioApplicationContext = {
  familyId: 'family-ltp-a' as never,
  actor: {
    userId: 'account-ltp-a' as never,
    role: 'family_admin',
    personId: 'person-ltp-a' as never
  },
  correlationId: 'correlation-ltp-a' as never
};

const ok = <T>(value: T) => ({ ok: true as const, value });

const baseScope = (overrides: Partial<LongTermPortfolioWriteScope> = {}): LongTermPortfolioWriteScope => ({
  occurredAt: NOW as never,
  findPerson: (id) => ok({ id, familyId: context.familyId }),
  findMutationByClientOperationId: () => ok(null),
  listPortfolios: () => ok([]),
  findPortfolio: () => ok(null),
  listInstrumentRevisions: () => ok([]),
  findInstrument: () => ok(null),
  findInstrumentRevision: () => ok(null),
  listPlanVersions: () => ok([]),
  listAllocations: () => ok([]),
  listLedgerEvents: () => ok([]),
  findLedgerEvent: () => ok(null),
  listPriceObservations: () => ok([]),
  authorize: () => ok(true),
  insertMutation: () => ok(undefined),
  insertInstrument: () => ok(undefined),
  insertInstrumentRevision: () => ok(undefined),
  insertPortfolio: () => ok(undefined),
  insertPlanVersion: () => ok(undefined),
  insertAllocation: () => ok(undefined),
  insertPlanSeal: () => ok(undefined),
  insertLedgerEvent: () => ok(undefined),
  insertPriceObservation: () => ok(undefined),
  appendAudit: () => ok('audit-chain-hash'),
  enqueueEvent: () => ok(undefined),
  ...overrides
});

const identifiers = (overrides: Partial<RecordLongTermPortfolioIdentifiers> = {}): RecordLongTermPortfolioIdentifiers => ({
  mutationId: 'mutation-ltp-1',
  requestFingerprint: 'a'.repeat(64),
  auditId: 'audit-ltp-1',
  outboxEventId: 'outbox-ltp-1' as never,
  ...overrides
});

const instrumentCommand: RecordLongTermPortfolioItemInput = {
  itemType: 'instrument_revision',
  clientOperationId: 'operation-instrument-1',
  assetClass: 'domestic_equity',
  groupLabel: 'Hisse',
  code: 'ASELS',
  name: 'Aselsan',
  currency: 'TRY',
  effectiveFrom: NOW,
  status: 'active'
};

const bootstrapIdentifiers = (): RecordLongTermPortfolioIdentifiers => {
  const seed = buildDefaultLongTermPortfolioBootstrap();
  return identifiers({
    portfolioId: 'portfolio-ltp-1',
    planVersionId: 'plan-ltp-1',
    instrumentIds: seed.instruments.map((_, index) => `instrument-ltp-${index + 1}`),
    instrumentRevisionIds: seed.instruments.map((_, index) => `instrument-revision-ltp-${index + 1}`),
    allocationIds: seed.allocations.map((_, index) => `allocation-ltp-${index + 1}`)
  });
};

const bootstrapCommand = (
  ownerPersonId = 'person-ltp-a',
  privacy: 'private' | 'selected_members' | 'family' = 'private'
): RecordLongTermPortfolioItemInput => ({
  itemType: 'bootstrap_default',
  clientOperationId: 'operation-bootstrap-1',
  ownerPersonId,
  portfolioName: '2032 Uzun Vadeli Birikim Portfoyu',
  effectiveMonth: '2026-08',
  targetDate: '2032-08-13T00:00:00.000Z',
  privacy
});

const unitOfWork = (
  scope: LongTermPortfolioWriteScope,
  captureIntent?: (intent: LongTermPortfolioPolicyIntent) => void
): LongTermPortfolioUnitOfWork => ({
  execute: async (_context, intent, operation) => {
    captureIntent?.(intent);
    return operation(scope);
  }
});

describe('33-L long-term portfolio application security invariants', () => {
  it('keeps audit and outbox bindings on the exact mutation receipt scope', async () => {
    let intent: LongTermPortfolioPolicyIntent | undefined;
    let audit: Parameters<LongTermPortfolioWriteScope['appendAudit']>[0] | undefined;
    let event: Parameters<LongTermPortfolioWriteScope['enqueueEvent']>[0] | undefined;
    const scope = baseScope({
      appendAudit: (input) => {
        audit = input;
        return ok('audit-chain-hash');
      },
      enqueueEvent: (input) => {
        event = input;
        return ok(undefined);
      }
    });

    const result = await new RecordLongTermPortfolioItemUseCase(
      unitOfWork(scope, (value) => { intent = value; })
    ).execute({
      context,
      command: instrumentCommand,
      identifiers: identifiers({
        instrumentId: 'instrument-ltp-new',
        instrumentRevisionId: 'instrument-revision-ltp-new'
      })
    });

    expect(result).toEqual({ ok: true, value: 'instrument-ltp-new' });
    expect(intent).toMatchObject({
      resourceType: 'finance_record',
      resourceId: 'mutation-ltp-1',
      action: 'create',
      capability: 'finance.write',
      purpose: 'finance'
    });
    expect(audit).toMatchObject({
      resourceType: 'finance_record',
      resourceId: 'mutation-ltp-1'
    });
    expect(event).toMatchObject({
      aggregateType: 'finance_record',
      aggregateId: 'mutation-ltp-1',
      payload: {
        mutationId: 'mutation-ltp-1',
        aggregateId: 'instrument-ltp-new'
      }
    });
    expect(JSON.stringify(event)).not.toContain('Aselsan');
  });

  it('rolls back the staged mutation when a plan does not total exactly 10,000 basis points', async () => {
    const committed: string[] = [];
    let staged: string[] = [];
    const portfolio = {
      id: 'portfolio-ltp-1',
      mutationId: 'bootstrap-mutation',
      familyId: context.familyId,
      ownerPersonId: context.actor.personId!,
      name: 'Uzun Vadeli',
      baseCurrency: 'TRY',
      privacy: 'private' as const,
      targetDate: '2032-08-13T00:00:00.000Z',
      purpose: 'Birikim',
      createdAt: NOW as never
    };
    const scope = baseScope({
      insertMutation: (row) => {
        staged.push(`mutation:${row.id}`);
        return ok(undefined);
      },
      findPortfolio: () => ok(portfolio),
      insertPlanVersion: (row) => {
        staged.push(`plan:${row.id}`);
        return ok(undefined);
      }
    });
    const transactionalUnitOfWork: LongTermPortfolioUnitOfWork = {
      execute: async (_applicationContext, _intent, operation) => {
        staged = [];
        const result = operation(scope);
        if (result.ok) committed.push(...staged);
        return result;
      }
    };
    const command: RecordLongTermPortfolioItemInput = {
      itemType: 'plan_version',
      clientOperationId: 'operation-plan-1',
      portfolioId: portfolio.id,
      effectiveMonth: '2026-09',
      monthlyContribution: 20_000,
      contributionCurrency: 'TRY',
      contributionChangeReason: 'Guvenlik regresyonu',
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
      allocations: [
        { instrumentId: 'instrument-ltp-1', sleeve: 'core', targetBasisPoints: 5_000, displayOrder: 1 },
        { instrumentId: 'instrument-ltp-2', sleeve: 'growth', targetBasisPoints: 4_999, displayOrder: 2 }
      ]
    };

    const result = await new RecordLongTermPortfolioItemUseCase(transactionalUnitOfWork).execute({
      context,
      command,
      identifiers: identifiers({
        planVersionId: 'plan-ltp-invalid',
        allocationIds: ['allocation-ltp-invalid-1', 'allocation-ltp-invalid-2']
      })
    });

    expect(result).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(staged).toEqual(['mutation:mutation-ltp-1']);
    expect(committed).toEqual([]);
  });

  it('rejects a bootstrap owner resolved outside the active family', async () => {
    const scope = baseScope({
      findPerson: (id) => ok({ id, familyId: 'family-ltp-b' } as never)
    });
    const result = await new RecordLongTermPortfolioItemUseCase(unitOfWork(scope)).execute({
      context,
      command: bootstrapCommand('person-ltp-b'),
      identifiers: bootstrapIdentifiers()
    });

    expect(result).toMatchObject({ ok: false, error: { category: 'authorization' } });
  });

  it('authorizes and persists bootstrap privacy without widening the PEP scope', async () => {
    let intent: LongTermPortfolioPolicyIntent | undefined;
    let mutationPrivacy: string | undefined;
    let portfolioPrivacy: string | undefined;
    const scope = baseScope({
      findPerson: (id) => ok({ id, familyId: context.familyId } as never),
      insertMutation: (row) => {
        mutationPrivacy = row.privacy;
        return ok(undefined);
      },
      insertPortfolio: (row) => {
        portfolioPrivacy = row.privacy;
        return ok(undefined);
      }
    });

    const result = await new RecordLongTermPortfolioItemUseCase(
      unitOfWork(scope, (value) => { intent = value; })
    ).execute({
      context,
      command: bootstrapCommand('person-ltp-a', 'family'),
      identifiers: bootstrapIdentifiers()
    });

    expect(result.ok).toBe(true);
    expect(intent?.privacy).toBe('family');
    expect(mutationPrivacy).toBe('family');
    expect(portfolioPrivacy).toBe('family');
  });

  it('enforces single, same-portfolio, non-reversal targets before appending a reversal', async () => {
    const portfolio = {
      id: 'portfolio-ltp-1', mutationId: 'bootstrap-mutation', familyId: context.familyId,
      ownerPersonId: context.actor.personId!, name: 'Uzun Vadeli', baseCurrency: 'TRY',
      privacy: 'private' as const, targetDate: '2032-08-13T00:00:00.000Z', purpose: 'Birikim',
      createdAt: NOW as never
    };
    const original = {
      id: 'ledger-original', portfolioId: 'portfolio-ltp-other', instrumentId: 'instrument-ltp-1',
      mutationId: 'mutation-original', familyId: context.familyId, ownerPersonId: context.actor.personId!,
      privacy: 'private' as const, eventType: 'buy' as const, direction: 'cash_out' as const,
      currency: 'TRY', orderAt: NOW, executedAt: NOW, settlementAt: NOW, quantity: 1, unitPrice: 100,
      grossAmount: 100, feeAmount: 0, taxAmount: 0, netCashAmount: -100,
      sourceLabel: 'Dekont', dataSource: 'user_entered' as const,
      externalVerification: 'not_performed' as const, createdAt: NOW as never
    };
    let ledgerInsertCalled = false;
    const scope = baseScope({
      findPortfolio: () => ok(portfolio),
      findLedgerEvent: () => ok(original),
      listLedgerEvents: () => ok([]),
      insertLedgerEvent: () => {
        ledgerInsertCalled = true;
        return ok(undefined);
      }
    });
    const command: RecordLongTermPortfolioItemInput = {
      itemType: 'ledger_event',
      clientOperationId: 'operation-ledger-1',
      portfolioId: portfolio.id,
      eventType: 'reversal',
      direction: 'non_cash',
      currency: 'TRY',
      executedAt: NOW,
      grossAmount: 0,
      feeAmount: 0,
      taxAmount: 0,
      netCashAmount: 0,
      reversalOfEventId: original.id,
      correctionReason: 'Yanlis kayit',
      sourceLabel: 'Duzeltme'
    };

    const result = await new RecordLongTermPortfolioItemUseCase(unitOfWork(scope)).execute({
      context,
      command,
      identifiers: identifiers({ ledgerEventId: 'ledger-reversal' })
    });

    expect(result).toMatchObject({ ok: false, error: { category: 'not_found' } });
    expect(ledgerInsertCalled).toBe(false);
  });

  it('removes a reversed event from positions and contribution analytics without mutating history', () => {
    const workspace = buildLongTermPortfolioWorkspace({
      portfolios: [{
        id: 'portfolio-ltp-1', mutationId: 'bootstrap-mutation', familyId: context.familyId,
        ownerPersonId: context.actor.personId!, name: 'Uzun Vadeli', baseCurrency: 'TRY',
        privacy: 'private', targetDate: '2032-08-13T00:00:00.000Z', purpose: 'Birikim',
        createdAt: NOW as never
      }],
      instrumentRevisions: [{
        revisionId: 'revision-ltp-1', instrumentId: 'instrument-ltp-1', mutationId: 'bootstrap-mutation',
        familyId: context.familyId, ownerPersonId: context.actor.personId!, privacy: 'private',
        assetClass: 'domestic_equity', groupLabel: 'Hisse', code: 'ASELS', name: 'Aselsan',
        currency: 'TRY', effectiveFrom: NOW, status: 'active', dataSource: 'user_entered',
        externalVerification: 'not_performed', createdAt: NOW as never
      }],
      planVersions: [],
      allocations: [],
      ledgerEvents: [
        {
          id: 'ledger-original', portfolioId: 'portfolio-ltp-1', instrumentId: 'instrument-ltp-1',
          mutationId: 'mutation-original', familyId: context.familyId, ownerPersonId: context.actor.personId!,
          privacy: 'private', eventType: 'buy', direction: 'cash_out', currency: 'TRY', orderAt: NOW,
          executedAt: NOW, settlementAt: NOW, quantity: 2, unitPrice: 100, grossAmount: 200,
          feeAmount: 5, taxAmount: 1, netCashAmount: -206, sourceLabel: 'Dekont',
          dataSource: 'user_entered', externalVerification: 'not_performed', createdAt: NOW as never
        },
        {
          id: 'ledger-reversal', portfolioId: 'portfolio-ltp-1', mutationId: 'mutation-reversal',
          familyId: context.familyId, ownerPersonId: context.actor.personId!, privacy: 'private',
          eventType: 'reversal', direction: 'non_cash', currency: 'TRY', executedAt: NOW,
          grossAmount: 0, feeAmount: 0, taxAmount: 0, netCashAmount: 0,
          reversalOfEventId: 'ledger-original', correctionReason: 'Yanlis kayit', sourceLabel: 'Duzeltme',
          dataSource: 'user_entered', externalVerification: 'not_performed', createdAt: NOW as never
        }
      ] as never,
      priceObservations: [{
        id: 'price-ltp-1', portfolioId: 'portfolio-ltp-1', instrumentId: 'instrument-ltp-1',
        mutationId: 'mutation-price', familyId: context.familyId, ownerPersonId: context.actor.personId!,
        privacy: 'private', observedAt: NOW, unitPrice: 125, currency: 'TRY', sourceLabel: 'Manuel',
        dataSource: 'user_entered', externalVerification: 'not_performed', createdAt: NOW as never
      }],
      generatedAt: NOW
    });

    expect(workspace.ledgerEvents).toHaveLength(2);
    expect(workspace.analytics?.positions[0]).toMatchObject({
      quantity: 0,
      contributedAmount: 0,
      realizedCashAmount: 0,
      feeAmount: 0,
      taxAmount: 0,
      marketValue: 0,
      netProfitLoss: 0
    });
    expect(workspace.analytics?.totalContributed).toBe(0);
  });

  it('publishes a valid plan only after all allocations are followed by an exact 10,000 basis-point seal', async () => {
    const portfolio = {
      id: 'portfolio-ltp-1', mutationId: 'bootstrap-mutation', familyId: context.familyId,
      ownerPersonId: context.actor.personId!, name: 'Uzun Vadeli', baseCurrency: 'TRY',
      privacy: 'private' as const, targetDate: '2032-08-13T00:00:00.000Z', purpose: 'Birikim',
      createdAt: NOW as never
    };
    const sequence: string[] = [];
    let seal: Parameters<LongTermPortfolioWriteScope['insertPlanSeal']>[0] | undefined;
    const scope = baseScope({
      findPortfolio: () => ok(portfolio),
      findInstrument: (id) => ok({
        id, mutationId: 'bootstrap-mutation', familyId: context.familyId,
        ownerPersonId: context.actor.personId!, privacy: 'private', createdAt: NOW as never
      }),
      insertPlanVersion: (row) => {
        sequence.push(`plan:${row.id}`);
        return ok(undefined);
      },
      insertAllocation: (row) => {
        sequence.push(`allocation:${row.id}:${row.targetBasisPoints}`);
        return ok(undefined);
      },
      insertPlanSeal: (row) => {
        seal = row;
        sequence.push(`seal:${row.planVersionId}`);
        return ok(undefined);
      }
    });
    const result = await new RecordLongTermPortfolioItemUseCase(unitOfWork(scope)).execute({
      context,
      command: {
        itemType: 'plan_version',
        clientOperationId: 'operation-plan-sealed-1',
        portfolioId: portfolio.id,
        effectiveMonth: '2026-09',
        monthlyContribution: 20_000,
        contributionCurrency: 'TRY',
        contributionChangeReason: 'Yeni plan',
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
        allocations: [{
          instrumentId: 'instrument-ltp-1', sleeve: 'core', targetBasisPoints: 10_000, displayOrder: 1
        }]
      },
      identifiers: identifiers({
        mutationId: 'mutation-plan-sealed-1',
        planVersionId: 'plan-ltp-sealed-1',
        allocationIds: ['allocation-ltp-sealed-1']
      })
    });

    expect(result).toEqual({ ok: true, value: 'plan-ltp-sealed-1' });
    expect(sequence).toEqual([
      'plan:plan-ltp-sealed-1',
      'allocation:allocation-ltp-sealed-1:10000',
      'seal:plan-ltp-sealed-1'
    ]);
    expect(seal).toMatchObject({
      planVersionId: 'plan-ltp-sealed-1',
      mutationId: 'mutation-plan-sealed-1',
      allocationCount: 1,
      totalBasisPoints: 10_000
    });
  });

  it('uses only revisions, ledger events and prices effective at generatedAt for analytics', () => {
    const workspace = buildLongTermPortfolioWorkspace({
      portfolios: [{
        id: 'portfolio-as-of', mutationId: 'mutation-bootstrap', familyId: context.familyId,
        ownerPersonId: context.actor.personId!, name: 'As-of Portfoy', baseCurrency: 'TRY',
        privacy: 'private', targetDate: '2032-08-13T00:00:00.000Z', purpose: 'Birikim',
        createdAt: '2026-01-01T00:00:00.000Z'
      }],
      instrumentRevisions: [
        {
          revisionId: 'revision-current', instrumentId: 'instrument-as-of', mutationId: 'mutation-current',
          familyId: context.familyId, ownerPersonId: context.actor.personId!, privacy: 'private',
          assetClass: 'domestic_equity', groupLabel: 'Hisse', code: 'NOW', name: 'Current revision',
          currency: 'TRY', effectiveFrom: '2026-08-01T00:00:00.000Z', status: 'active',
          dataSource: 'user_entered', externalVerification: 'not_performed', createdAt: '2026-08-01T00:00:00.000Z'
        },
        {
          revisionId: 'revision-future', instrumentId: 'instrument-as-of', mutationId: 'mutation-future',
          familyId: context.familyId, ownerPersonId: context.actor.personId!, privacy: 'private',
          assetClass: 'foreign_equity', groupLabel: 'Future', code: 'FUTURE', name: 'Future revision',
          currency: 'USD', effectiveFrom: '2026-08-14T00:00:00.000Z', status: 'active',
          replacesRevisionId: 'revision-current', dataSource: 'user_entered',
          externalVerification: 'not_performed', createdAt: '2026-08-14T00:00:00.000Z'
        }
      ],
      planVersions: [],
      allocations: [],
      ledgerEvents: [
        {
          id: 'event-current', portfolioId: 'portfolio-as-of', instrumentId: 'instrument-as-of',
          mutationId: 'mutation-event-current', familyId: context.familyId,
          ownerPersonId: context.actor.personId!, privacy: 'private', eventType: 'buy', direction: 'cash_out',
          currency: 'TRY', orderAt: '2026-08-12T08:00:00.000Z', executedAt: '2026-08-12T09:00:00.000Z',
          settlementAt: '2026-08-13T09:00:00.000Z', quantity: 2, unitPrice: 100,
          grossAmount: 200, feeAmount: 5, taxAmount: 1, netCashAmount: -206,
          sourceLabel: 'Current event', dataSource: 'user_entered', externalVerification: 'not_performed',
          createdAt: '2026-08-12T09:00:00.000Z'
        },
        {
          id: 'event-future', portfolioId: 'portfolio-as-of', instrumentId: 'instrument-as-of',
          mutationId: 'mutation-event-future', familyId: context.familyId,
          ownerPersonId: context.actor.personId!, privacy: 'private', eventType: 'buy', direction: 'cash_out',
          currency: 'TRY', orderAt: '2026-08-14T08:00:00.000Z', executedAt: '2026-08-14T09:00:00.000Z',
          settlementAt: '2026-08-16T09:00:00.000Z', quantity: 100, unitPrice: 1_000,
          grossAmount: 100_000, feeAmount: 0, taxAmount: 0, netCashAmount: -100_000,
          sourceLabel: 'Future event', dataSource: 'user_entered', externalVerification: 'not_performed',
          createdAt: '2026-08-14T09:00:00.000Z'
        }
      ],
      priceObservations: [
        {
          id: 'price-current', portfolioId: 'portfolio-as-of', instrumentId: 'instrument-as-of',
          mutationId: 'mutation-price-current', familyId: context.familyId,
          ownerPersonId: context.actor.personId!, privacy: 'private', observedAt: '2026-08-12T12:00:00.000Z',
          unitPrice: 125, currency: 'TRY', sourceLabel: 'Current price', dataSource: 'user_entered',
          externalVerification: 'not_performed', createdAt: '2026-08-12T12:00:00.000Z'
        },
        {
          id: 'price-future', portfolioId: 'portfolio-as-of', instrumentId: 'instrument-as-of',
          mutationId: 'mutation-price-future', familyId: context.familyId,
          ownerPersonId: context.actor.personId!, privacy: 'private', observedAt: '9999-12-31T23:59:59.000Z',
          unitPrice: 999_999, currency: 'TRY', sourceLabel: 'Future price', dataSource: 'user_entered',
          externalVerification: 'not_performed', createdAt: '2026-08-14T12:00:00.000Z'
        }
      ],
      generatedAt: NOW
    } as never);

    expect(workspace.currentInstruments).toHaveLength(1);
    expect(workspace.currentInstruments[0]).toMatchObject({ revisionId: 'revision-current', currency: 'TRY' });
    expect(workspace.analytics?.positions[0]).toMatchObject({
      quantity: 2,
      contributedAmount: 206,
      latestUnitPrice: 125,
      marketValue: 250
    });
    expect(workspace.analytics?.marketValue).toBe(250);
  });

  it('rejects invalid ledger chronology, event direction and net-cash arithmetic before persistence', async () => {
    const portfolio = {
      id: 'portfolio-ledger-validation', mutationId: 'bootstrap-mutation', familyId: context.familyId,
      ownerPersonId: context.actor.personId!, name: 'Uzun Vadeli', baseCurrency: 'TRY',
      privacy: 'private' as const, targetDate: '2032-08-13T00:00:00.000Z', purpose: 'Birikim',
      createdAt: NOW as never
    };
    const baseCommand: Extract<RecordLongTermPortfolioItemInput, { itemType: 'ledger_event' }> = {
      itemType: 'ledger_event',
      clientOperationId: 'operation-ledger-validation-base',
      portfolioId: portfolio.id,
      instrumentId: 'instrument-ltp-1',
      eventType: 'buy',
      direction: 'cash_out',
      currency: 'TRY',
      orderAt: '2026-08-13T08:00:00.000Z',
      executedAt: '2026-08-13T09:00:00.000Z',
      settlementAt: '2026-08-15T09:00:00.000Z',
      quantity: 2,
      unitPrice: 100,
      grossAmount: 200,
      feeAmount: 5,
      taxAmount: 1,
      netCashAmount: -206,
      sourceLabel: 'Dekont'
    };
    const invalidCases: ReadonlyArray<{
      name: string;
      overrides: Partial<typeof baseCommand>;
    }> = [
      {
        name: 'chronology',
        overrides: { orderAt: '2026-08-13T10:00:00.000Z' }
      },
      {
        name: 'direction',
        overrides: { direction: 'cash_in', netCashAmount: 194 }
      },
      {
        name: 'net arithmetic',
        overrides: { netCashAmount: -999 }
      }
    ];

    for (const [index, invalidCase] of invalidCases.entries()) {
      let inserted = false;
      const scope = baseScope({
        findPortfolio: () => ok(portfolio),
        findInstrument: (id) => ok({
          id, mutationId: 'bootstrap-mutation', familyId: context.familyId,
          ownerPersonId: context.actor.personId!, privacy: 'private', createdAt: NOW as never
        }),
        insertLedgerEvent: () => {
          inserted = true;
          return ok(undefined);
        }
      });
      const result = await new RecordLongTermPortfolioItemUseCase(unitOfWork(scope)).execute({
        context,
        command: {
          ...baseCommand,
          clientOperationId: `operation-ledger-validation-${index + 1}`,
          ...invalidCase.overrides
        },
        identifiers: identifiers({
          mutationId: `mutation-ledger-validation-${index + 1}`,
          ledgerEventId: `ledger-validation-${index + 1}`
        })
      });

      expect(result, invalidCase.name).toMatchObject({ ok: false, error: { category: 'validation' } });
      expect(inserted, invalidCase.name).toBe(false);
    }
  });

  it('fails closed for mixed-currency portfolio aggregates while preserving native positions', () => {
    const revision = (instrumentId: string, code: string, currency: string) => ({
      revisionId: `revision-${instrumentId}`, instrumentId, mutationId: `mutation-${instrumentId}`,
      familyId: context.familyId, ownerPersonId: context.actor.personId!, privacy: 'private',
      assetClass: 'foreign_equity', groupLabel: 'Hisse', code, name: code, currency,
      effectiveFrom: '2026-08-01T00:00:00.000Z', status: 'active', dataSource: 'user_entered',
      externalVerification: 'not_performed', createdAt: '2026-08-01T00:00:00.000Z'
    });
    const event = (instrumentId: string, currency: string) => ({
      id: `event-${instrumentId}`, portfolioId: 'portfolio-mixed', instrumentId,
      mutationId: `mutation-event-${instrumentId}`, familyId: context.familyId,
      ownerPersonId: context.actor.personId!, privacy: 'private', eventType: 'buy', direction: 'cash_out',
      currency, orderAt: '2026-08-12T08:00:00.000Z', executedAt: '2026-08-12T09:00:00.000Z',
      settlementAt: '2026-08-13T09:00:00.000Z', quantity: 1, unitPrice: 100,
      grossAmount: 100, feeAmount: 0, taxAmount: 0, netCashAmount: -100,
      sourceLabel: 'Dekont', dataSource: 'user_entered', externalVerification: 'not_performed',
      createdAt: '2026-08-12T09:00:00.000Z'
    });
    const price = (instrumentId: string, currency: string) => ({
      id: `price-${instrumentId}`, portfolioId: 'portfolio-mixed', instrumentId,
      mutationId: `mutation-price-${instrumentId}`, familyId: context.familyId,
      ownerPersonId: context.actor.personId!, privacy: 'private', observedAt: '2026-08-12T12:00:00.000Z',
      unitPrice: 125, currency, sourceLabel: 'Manuel', dataSource: 'user_entered',
      externalVerification: 'not_performed', createdAt: '2026-08-12T12:00:00.000Z'
    });
    const workspace = buildLongTermPortfolioWorkspace({
      portfolios: [{
        id: 'portfolio-mixed', mutationId: 'mutation-bootstrap', familyId: context.familyId,
        ownerPersonId: context.actor.personId!, name: 'Karma para', baseCurrency: 'TRY', privacy: 'private',
        targetDate: '2032-08-13T00:00:00.000Z', purpose: 'Birikim', createdAt: NOW
      }],
      instrumentRevisions: [revision('instrument-try', 'TRYI', 'TRY'), revision('instrument-usd', 'USDI', 'USD')],
      planVersions: [],
      allocations: [],
      ledgerEvents: [event('instrument-try', 'TRY'), event('instrument-usd', 'USD')],
      priceObservations: [price('instrument-try', 'TRY'), price('instrument-usd', 'USD')],
      generatedAt: NOW
    } as never);

    expect(workspace.analytics).toMatchObject({
      currency: 'TRY',
      aggregateValuationStatus: 'mixed_currency_requires_fx',
      excludedCurrencyInstrumentIds: ['instrument-usd']
    });
    expect(workspace.analytics?.positions).toEqual(expect.arrayContaining([
      expect.objectContaining({ instrumentId: 'instrument-try', currency: 'TRY', marketValue: 125 }),
      expect.objectContaining({ instrumentId: 'instrument-usd', currency: 'USD', marketValue: 125 })
    ]));
    expect(workspace.analytics).not.toHaveProperty('totalContributed');
    expect(workspace.analytics).not.toHaveProperty('marketValue');
    expect(workspace.analytics).not.toHaveProperty('netProfitLoss');
    expect(workspace.analytics?.monthlySeries).toEqual([]);
  });

  it('replays the committed aggregate for the same client operation and fingerprint without a second write', async () => {
    let writes = 0;
    const scope = baseScope({
      findMutationByClientOperationId: () => ok({
        id: 'mutation-original', clientOperationId: instrumentCommand.clientOperationId,
        requestFingerprint: 'a'.repeat(64), familyId: context.familyId,
        ownerPersonId: context.actor.personId!, privacy: 'private', operation: 'instrument_revision',
        resourceId: 'instrument-original', createdAt: NOW as never
      }),
      insertMutation: () => { writes += 1; return ok(undefined); },
      insertInstrument: () => { writes += 1; return ok(undefined); },
      appendAudit: () => { writes += 1; return ok('audit'); }
    });

    const result = await new RecordLongTermPortfolioItemUseCase(unitOfWork(scope)).execute({
      context,
      command: instrumentCommand,
      identifiers: identifiers({ instrumentId: 'instrument-new-attempt', instrumentRevisionId: 'revision-new-attempt' })
    });

    expect(result).toEqual({ ok: true, value: 'instrument-original' });
    expect(writes).toBe(0);
  });

  it('carries each monthly budget to the same instrument and calculates weighted-average cost', () => {
    const workspace = buildLongTermPortfolioWorkspace({
      portfolios: [{
        id: 'portfolio-budget', mutationId: 'mutation-bootstrap', familyId: context.familyId,
        ownerPersonId: context.actor.personId!, name: 'Bütçe', baseCurrency: 'TRY', privacy: 'private',
        targetDate: '2032-08-13T00:00:00.000Z', purpose: 'Birikim', createdAt: '2026-08-01T00:00:00.000Z'
      }],
      instrumentRevisions: [{
        revisionId: 'revision-budget', instrumentId: 'instrument-budget', mutationId: 'mutation-instrument',
        familyId: context.familyId, ownerPersonId: context.actor.personId!, privacy: 'private',
        assetClass: 'domestic_equity', groupLabel: 'Hisse', code: 'BUD', name: 'Bütçe Hissesi', currency: 'TRY',
        effectiveFrom: '2026-08-01T00:00:00.000Z', status: 'active', dataSource: 'user_entered',
        externalVerification: 'not_performed', createdAt: '2026-08-01T00:00:00.000Z'
      }],
      planVersions: [{
        id: 'plan-budget', portfolioId: 'portfolio-budget', mutationId: 'mutation-plan', familyId: context.familyId,
        ownerPersonId: context.actor.personId!, privacy: 'private', version: 1, effectiveMonth: '2026-08',
        monthlyContribution: 1_000, contributionCurrency: 'TRY', contributionChangeReason: 'Başlangıç',
        rebalanceIntervalMonths: 6, inflationAdjustment: 'manual_realized_inflation', targetDate: '2032-08-13T00:00:00.000Z',
        assumptions: { pessimisticAnnualReturnBasisPoints: 0, baseAnnualReturnBasisPoints: 500, optimisticAnnualReturnBasisPoints: 1_000, annualInflationBasisPoints: 500, annualContributionGrowthBasisPoints: 500 },
        createdAt: '2026-08-01T00:00:00.000Z'
      }],
      allocations: [{
        id: 'allocation-budget', portfolioId: 'portfolio-budget', planVersionId: 'plan-budget', instrumentId: 'instrument-budget',
        mutationId: 'mutation-plan', familyId: context.familyId, ownerPersonId: context.actor.personId!, privacy: 'private',
        sleeve: 'core', targetBasisPoints: 10_000, carryoverPolicy: 'same_instrument', displayOrder: 1,
        createdAt: '2026-08-01T00:00:00.000Z'
      }],
      ledgerEvents: [{
        id: 'event-budget-buy', portfolioId: 'portfolio-budget', instrumentId: 'instrument-budget', mutationId: 'mutation-event',
        familyId: context.familyId, ownerPersonId: context.actor.personId!, privacy: 'private', eventType: 'buy', direction: 'cash_out',
        currency: 'TRY', orderAt: '2026-08-13T08:00:00.000Z', executedAt: '2026-08-13T09:00:00.000Z', settlementAt: '2026-08-14T09:00:00.000Z',
        quantity: 2, unitPrice: 100, grossAmount: 200, feeAmount: 10, taxAmount: 0, netCashAmount: -210,
        costLayerMethod: 'weighted_average', sourceLabel: 'Dekont', dataSource: 'user_entered', externalVerification: 'not_performed', createdAt: '2026-08-13T09:00:00.000Z'
      }],
      priceObservations: [{
        id: 'price-budget', portfolioId: 'portfolio-budget', instrumentId: 'instrument-budget', mutationId: 'mutation-price',
        familyId: context.familyId, ownerPersonId: context.actor.personId!, privacy: 'private', observedAt: '2026-09-30T10:00:00.000Z',
        unitPrice: 120, currency: 'TRY', sourceLabel: 'Manuel', dataSource: 'user_entered', externalVerification: 'not_performed', createdAt: '2026-09-30T10:00:00.000Z'
      }],
      generatedAt: '2026-09-30T12:00:00.000Z'
    } as never);

    expect(workspace.analytics?.monthlyBudgetCarryovers.filter(item => item.instrumentId === 'instrument-budget')).toEqual([
      expect.objectContaining({ month: '2026-08', plannedAmount: 1_000, actualContributionAmount: 210, closingCarryoverAmount: 790, complete: true }),
      expect.objectContaining({ month: '2026-09', openingCarryoverAmount: 790, plannedAmount: 1_000, actualContributionAmount: 0, closingCarryoverAmount: 1_790, complete: true })
    ]);
    expect(workspace.analytics?.positions[0]).toMatchObject({
      costBasisStatus: 'calculated_weighted_average', costBasisAmount: 210, averageUnitCost: 105,
      grossPurchaseAmount: 200, marketValue: 240, unrealizedProfitLoss: 30, netProfitLoss: 30
    });
    expect(workspace.projections[0]).toMatchObject({ startingValue: 240, startingValueSource: 'current_market_value' });
  });

  it('records cross-instrument budget transfer atomically without creating or removing security quantity', async () => {
    const portfolio = {
      id: 'portfolio-budget-transfer', mutationId: 'bootstrap-mutation', familyId: context.familyId,
      ownerPersonId: context.actor.personId!, name: 'Bütçe', baseCurrency: 'TRY', privacy: 'private' as const,
      targetDate: '2032-08-13T00:00:00.000Z', purpose: 'Birikim', createdAt: '2026-08-01T00:00:00.000Z' as never
    };
    const revisions = ['source','target'].map((suffix, index) => ({
      revisionId: `revision-${suffix}`, instrumentId: `instrument-${suffix}`, mutationId: 'bootstrap-mutation',
      familyId: context.familyId, ownerPersonId: context.actor.personId!, privacy: 'private' as const,
      assetClass: 'domestic_equity' as const, groupLabel: 'Hisse', code: index === 0 ? 'SRC' : 'DST',
      name: index === 0 ? 'Kaynak' : 'Hedef', currency: 'TRY', effectiveFrom: '2026-08-01T00:00:00.000Z',
      status: 'active' as const, dataSource: 'user_entered' as const, externalVerification: 'not_performed' as const,
      createdAt: '2026-08-01T00:00:00.000Z' as never
    }));
    const plan = {
      id: 'plan-budget-transfer', portfolioId: portfolio.id, mutationId: 'mutation-plan', familyId: context.familyId,
      ownerPersonId: context.actor.personId!, privacy: 'private' as const, version: 1, effectiveMonth: '2026-08',
      monthlyContribution: 1_000, contributionCurrency: 'TRY', contributionChangeReason: 'Başlangıç',
      rebalanceIntervalMonths: 6, inflationAdjustment: 'manual_realized_inflation' as const,
      targetDate: '2032-08-13T00:00:00.000Z',
      assumptions: { pessimisticAnnualReturnBasisPoints: 0, baseAnnualReturnBasisPoints: 500, optimisticAnnualReturnBasisPoints: 1_000, annualInflationBasisPoints: 500, annualContributionGrowthBasisPoints: 500 },
      createdAt: '2026-08-01T00:00:00.000Z' as never
    };
    const allocations = revisions.map((revision, index) => ({
      id: `allocation-${index}`, portfolioId: portfolio.id, planVersionId: plan.id, instrumentId: revision.instrumentId,
      mutationId: 'mutation-plan', familyId: context.familyId, ownerPersonId: context.actor.personId!, privacy: 'private' as const,
      sleeve: 'core' as const, targetBasisPoints: 5_000, carryoverPolicy: 'same_instrument' as const,
      displayOrder: index + 1, createdAt: '2026-08-01T00:00:00.000Z' as never
    }));
    let inserted: Parameters<LongTermPortfolioWriteScope['insertLedgerEvent']>[0] | undefined;
    const scope = baseScope({
      findPortfolio: () => ok(portfolio), listInstrumentRevisions: () => ok(revisions),
      findInstrument: (id) => ok({ id, mutationId: 'bootstrap-mutation', familyId: context.familyId, ownerPersonId: context.actor.personId!, privacy: 'private', createdAt: NOW as never }),
      listPlanVersions: () => ok([plan]), listAllocations: () => ok(allocations), listLedgerEvents: () => ok([]),
      insertLedgerEvent: (row) => { inserted = row; return ok(undefined); }
    });
    const command: Extract<RecordLongTermPortfolioItemInput,{itemType:'ledger_event'}> = {
      itemType: 'ledger_event', clientOperationId: 'operation-budget-transfer-1', portfolioId: portfolio.id,
      instrumentId: 'instrument-source', eventType: 'transfer_out', direction: 'non_cash', currency: 'TRY',
      executedAt: NOW, grossAmount: 200, feeAmount: 0, taxAmount: 0, netCashAmount: 0,
      transferCounterpartyInstrumentId: 'instrument-target', sourceLabel: 'Açık bütçe virmanı'
    };
    const result = await new RecordLongTermPortfolioItemUseCase(unitOfWork(scope)).execute({
      context, command, identifiers: identifiers({ mutationId: 'mutation-budget-transfer', ledgerEventId: 'event-budget-transfer' })
    });

    expect(result).toEqual({ ok: true, value: 'event-budget-transfer' });
    expect(inserted).toMatchObject({ eventType: 'transfer_out', direction: 'non_cash', grossAmount: 200, transferCounterpartyInstrumentId: 'instrument-target' });
    expect(inserted).not.toHaveProperty('quantity');
    const workspace = buildLongTermPortfolioWorkspace({ portfolios: [portfolio], instrumentRevisions: revisions, planVersions: [plan], allocations, ledgerEvents: [inserted!], priceObservations: [], generatedAt: NOW } as never);
    expect(workspace.analytics?.positions.map(item => [item.instrumentId,item.quantity])).toEqual([['instrument-source',0],['instrument-target',0]]);
    expect(workspace.analytics?.monthlyBudgetCarryovers).toEqual(expect.arrayContaining([
      expect.objectContaining({ instrumentId: 'instrument-source', closingCarryoverAmount: 300 }),
      expect.objectContaining({ instrumentId: 'instrument-target', closingCarryoverAmount: 700 })
    ]));
  });

  it('rejects sales and malformed one-sided transfers that exceed their governed balance', async () => {
    const portfolio = {
      id: 'portfolio-negative-balance', mutationId: 'bootstrap-mutation', familyId: context.familyId,
      ownerPersonId: context.actor.personId!, name: 'Uzun Vadeli', baseCurrency: 'TRY',
      privacy: 'private' as const, targetDate: '2032-08-13T00:00:00.000Z', purpose: 'Birikim',
      createdAt: NOW as never
    };
    const existingBuy = {
      id: 'ledger-balance-buy', portfolioId: portfolio.id, instrumentId: 'instrument-ltp-1',
      mutationId: 'mutation-balance-buy', familyId: context.familyId,
      ownerPersonId: context.actor.personId!, privacy: 'private' as const,
      eventType: 'buy' as const, direction: 'cash_out' as const, currency: 'TRY',
      orderAt: '2026-08-13T06:59:00.000Z', executedAt: '2026-08-13T07:00:00.000Z',
      settlementAt: '2026-08-13T07:30:00.000Z', quantity: 5, unitPrice: 100,
      grossAmount: 500, feeAmount: 0, taxAmount: 0, netCashAmount: -500,
      sourceLabel: 'Alim dekontu', dataSource: 'user_entered' as const,
      externalVerification: 'not_performed' as const, createdAt: '2026-08-13T07:00:00.000Z' as never
    };
    const revisions = [
      {
        revisionId: 'revision-balance-source', instrumentId: 'instrument-ltp-1',
        mutationId: 'bootstrap-mutation', familyId: context.familyId,
        ownerPersonId: context.actor.personId!, privacy: 'private', assetClass: 'domestic_equity',
        groupLabel: 'Hisse', code: 'ASELS', name: 'Aselsan', currency: 'TRY',
        effectiveFrom: '2026-08-12T00:00:00.000Z', status: 'active', dataSource: 'user_entered',
        externalVerification: 'not_performed', createdAt: '2026-08-12T00:00:00.000Z'
      },
      {
        revisionId: 'revision-balance-target', instrumentId: 'instrument-ltp-2',
        mutationId: 'bootstrap-mutation', familyId: context.familyId,
        ownerPersonId: context.actor.personId!, privacy: 'private', assetClass: 'domestic_equity',
        groupLabel: 'Hisse', code: 'THYAO', name: 'Turk Hava Yollari', currency: 'TRY',
        effectiveFrom: '2026-08-12T00:00:00.000Z', status: 'active', dataSource: 'user_entered',
        externalVerification: 'not_performed', createdAt: '2026-08-12T00:00:00.000Z'
      }
    ];
    const commands: ReadonlyArray<Extract<RecordLongTermPortfolioItemInput, { itemType: 'ledger_event' }>> = [
      {
        itemType: 'ledger_event', clientOperationId: 'operation-oversell-1', portfolioId: portfolio.id,
        instrumentId: 'instrument-ltp-1', eventType: 'sell', direction: 'cash_in', currency: 'TRY',
        orderAt: '2026-08-13T07:59:00.000Z', executedAt: '2026-08-13T08:00:00.000Z',
        settlementAt: '2026-08-13T08:30:00.000Z', quantity: 6, unitPrice: 100,
        grossAmount: 600, feeAmount: 0, taxAmount: 0, netCashAmount: 600,
        sourceLabel: 'Satis dekontu'
      },
      {
        itemType: 'ledger_event', clientOperationId: 'operation-overtransfer-1', portfolioId: portfolio.id,
        instrumentId: 'instrument-ltp-1', eventType: 'transfer_out', direction: 'security_out',
        currency: 'TRY', executedAt: '2026-08-13T08:00:00.000Z', quantity: 6,
        grossAmount: 0, feeAmount: 0, taxAmount: 0, netCashAmount: 0,
        transferCounterpartyInstrumentId: 'instrument-ltp-2', sourceLabel: 'Virman dekontu'
      }
    ];

    for (const [index, command] of commands.entries()) {
      let inserted = false;
      const scope = baseScope({
        findPortfolio: () => ok(portfolio),
        listLedgerEvents: () => ok([existingBuy] as never),
        listInstrumentRevisions: () => ok(revisions as never),
        findInstrument: (id) => ok({
          id, mutationId: 'bootstrap-mutation', familyId: context.familyId,
          ownerPersonId: context.actor.personId!, privacy: 'private', createdAt: NOW as never
        }),
        insertLedgerEvent: () => {
          inserted = true;
          return ok(undefined);
        }
      });
      const result = await new RecordLongTermPortfolioItemUseCase(unitOfWork(scope)).execute({
        context,
        command,
        identifiers: identifiers({
          mutationId: `mutation-negative-exit-${index + 1}`,
          ledgerEventId: `ledger-negative-exit-${index + 1}`
        })
      });

      expect(result, command.eventType).toMatchObject({ ok: false, error: { category: 'validation' } });
      expect(inserted, command.eventType).toBe(false);
    }
  });

  it('rejects reversing a positive-quantity event when later exits would leave a negative balance', async () => {
    const portfolio = {
      id: 'portfolio-reversal-balance', mutationId: 'bootstrap-mutation', familyId: context.familyId,
      ownerPersonId: context.actor.personId!, name: 'Uzun Vadeli', baseCurrency: 'TRY',
      privacy: 'private' as const, targetDate: '2032-08-13T00:00:00.000Z', purpose: 'Birikim',
      createdAt: NOW as never
    };
    const originalBuy = {
      id: 'ledger-positive-original', portfolioId: portfolio.id, instrumentId: 'instrument-ltp-1',
      mutationId: 'mutation-positive-original', familyId: context.familyId,
      ownerPersonId: context.actor.personId!, privacy: 'private' as const,
      eventType: 'buy' as const, direction: 'cash_out' as const, currency: 'TRY',
      orderAt: '2026-08-13T06:59:00.000Z', executedAt: '2026-08-13T07:00:00.000Z',
      settlementAt: '2026-08-13T07:30:00.000Z', quantity: 10, unitPrice: 100,
      grossAmount: 1_000, feeAmount: 0, taxAmount: 0, netCashAmount: -1_000,
      sourceLabel: 'Alim dekontu', dataSource: 'user_entered' as const,
      externalVerification: 'not_performed' as const, createdAt: '2026-08-13T07:00:00.000Z' as never
    };
    const laterSale = {
      id: 'ledger-later-sale', portfolioId: portfolio.id, instrumentId: 'instrument-ltp-1',
      mutationId: 'mutation-later-sale', familyId: context.familyId,
      ownerPersonId: context.actor.personId!, privacy: 'private' as const,
      eventType: 'sell' as const, direction: 'cash_in' as const, currency: 'TRY',
      orderAt: '2026-08-13T07:59:00.000Z', executedAt: '2026-08-13T08:00:00.000Z',
      settlementAt: '2026-08-13T08:30:00.000Z', quantity: 6, unitPrice: 100,
      grossAmount: 600, feeAmount: 0, taxAmount: 0, netCashAmount: 600,
      sourceLabel: 'Satis dekontu', dataSource: 'user_entered' as const,
      externalVerification: 'not_performed' as const, createdAt: '2026-08-13T08:00:00.000Z' as never
    };
    let inserted = false;
    const scope = baseScope({
      findPortfolio: () => ok(portfolio),
      findInstrument: (id) => ok({
        id, mutationId: 'bootstrap-mutation', familyId: context.familyId,
        ownerPersonId: context.actor.personId!, privacy: 'private', createdAt: NOW as never
      }),
      listLedgerEvents: () => ok([originalBuy, laterSale] as never),
      findLedgerEvent: () => ok(originalBuy as never),
      listInstrumentRevisions: () => ok([{
        revisionId: 'revision-reversal-balance', instrumentId: 'instrument-ltp-1',
        mutationId: 'bootstrap-mutation', familyId: context.familyId,
        ownerPersonId: context.actor.personId!, privacy: 'private', assetClass: 'domestic_equity',
        groupLabel: 'Hisse', code: 'ASELS', name: 'Aselsan', currency: 'TRY',
        effectiveFrom: '2026-08-12T00:00:00.000Z', status: 'active', dataSource: 'user_entered',
        externalVerification: 'not_performed', createdAt: '2026-08-12T00:00:00.000Z'
      }] as never),
      insertLedgerEvent: () => {
        inserted = true;
        return ok(undefined);
      }
    });
    const result = await new RecordLongTermPortfolioItemUseCase(unitOfWork(scope)).execute({
      context,
      command: {
        itemType: 'ledger_event', clientOperationId: 'operation-negative-reversal-1',
        portfolioId: portfolio.id, eventType: 'reversal', direction: 'non_cash', currency: 'TRY',
        executedAt: NOW, grossAmount: 0, feeAmount: 0, taxAmount: 0, netCashAmount: 0,
        reversalOfEventId: originalBuy.id, correctionReason: 'Hatali alim kaydi', sourceLabel: 'Duzeltme'
      },
      identifiers: identifiers({
        mutationId: 'mutation-negative-reversal-1',
        ledgerEventId: 'ledger-negative-reversal-1'
      })
    });

    expect(result).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(inserted).toBe(false);
  });

  it('rejects a backdated sale or transfer that makes a later timeline pivot negative', async () => {
    const portfolio = {
      id: 'portfolio-temporal-exit', mutationId: 'bootstrap-mutation', familyId: context.familyId,
      ownerPersonId: context.actor.personId!, name: 'Zaman Cizelgesi', baseCurrency: 'TRY',
      privacy: 'private' as const, targetDate: '2032-08-13T00:00:00.000Z', purpose: 'Birikim',
      createdAt: NOW as never
    };
    const revisions = ['instrument-ltp-1', 'instrument-ltp-2'].map((instrumentId, index) => ({
      revisionId: `revision-temporal-${index + 1}`, instrumentId, mutationId: 'bootstrap-mutation',
      familyId: context.familyId, ownerPersonId: context.actor.personId!, privacy: 'private',
      assetClass: 'domestic_equity', groupLabel: 'Hisse', code: `TMP${index + 1}`,
      name: `Temporal ${index + 1}`, currency: 'TRY', effectiveFrom: '2026-08-12T00:00:00.000Z',
      status: 'active', dataSource: 'user_entered', externalVerification: 'not_performed',
      createdAt: '2026-08-12T00:00:00.000Z'
    }));
    const events = [
      {
        id: 'temporal-buy-opening', portfolioId: portfolio.id, instrumentId: 'instrument-ltp-1',
        mutationId: 'mutation-temporal-buy-opening', familyId: context.familyId,
        ownerPersonId: context.actor.personId!, privacy: 'private', eventType: 'buy', direction: 'cash_out',
        currency: 'TRY', executedAt: '2026-08-13T07:00:00.000Z', quantity: 10,
        grossAmount: 1_000, feeAmount: 0, taxAmount: 0, netCashAmount: -1_000,
        sourceLabel: 'Opening buy', dataSource: 'user_entered', externalVerification: 'not_performed',
        createdAt: '2026-08-13T07:00:00.000Z'
      },
      {
        id: 'temporal-sale-later', portfolioId: portfolio.id, instrumentId: 'instrument-ltp-1',
        mutationId: 'mutation-temporal-sale-later', familyId: context.familyId,
        ownerPersonId: context.actor.personId!, privacy: 'private', eventType: 'sell', direction: 'cash_in',
        currency: 'TRY', executedAt: '2026-08-13T08:00:00.000Z', quantity: 8,
        grossAmount: 800, feeAmount: 0, taxAmount: 0, netCashAmount: 800,
        sourceLabel: 'Later sale', dataSource: 'user_entered', externalVerification: 'not_performed',
        createdAt: '2026-08-13T08:00:00.000Z'
      },
      {
        id: 'temporal-buy-recovery', portfolioId: portfolio.id, instrumentId: 'instrument-ltp-1',
        mutationId: 'mutation-temporal-buy-recovery', familyId: context.familyId,
        ownerPersonId: context.actor.personId!, privacy: 'private', eventType: 'buy', direction: 'cash_out',
        currency: 'TRY', executedAt: '2026-08-13T08:30:00.000Z', quantity: 10,
        grossAmount: 1_000, feeAmount: 0, taxAmount: 0, netCashAmount: -1_000,
        sourceLabel: 'Recovery buy', dataSource: 'user_entered', externalVerification: 'not_performed',
        createdAt: '2026-08-13T08:30:00.000Z'
      }
    ];
    const commands: ReadonlyArray<Extract<RecordLongTermPortfolioItemInput, { itemType: 'ledger_event' }>> = [
      {
        itemType: 'ledger_event', clientOperationId: 'operation-temporal-sale', portfolioId: portfolio.id,
        instrumentId: 'instrument-ltp-1', eventType: 'sell', direction: 'cash_in', currency: 'TRY',
        orderAt: '2026-08-13T07:29:00.000Z', executedAt: '2026-08-13T07:30:00.000Z',
        settlementAt: '2026-08-13T07:45:00.000Z', quantity: 5, unitPrice: 100,
        grossAmount: 500, feeAmount: 0, taxAmount: 0, netCashAmount: 500, sourceLabel: 'Backdated sale'
      },
      {
        itemType: 'ledger_event', clientOperationId: 'operation-temporal-transfer', portfolioId: portfolio.id,
        instrumentId: 'instrument-ltp-1', eventType: 'transfer_out', direction: 'security_out', currency: 'TRY',
        executedAt: '2026-08-13T07:30:00.000Z', quantity: 5, grossAmount: 0,
        feeAmount: 0, taxAmount: 0, netCashAmount: 0,
        transferCounterpartyInstrumentId: 'instrument-ltp-2', sourceLabel: 'Backdated transfer'
      }
    ];

    for (const [index, command] of commands.entries()) {
      let inserted = false;
      const scope = baseScope({
        findPortfolio: () => ok(portfolio),
        findInstrument: (id) => ok({
          id, mutationId: 'bootstrap-mutation', familyId: context.familyId,
          ownerPersonId: context.actor.personId!, privacy: 'private', createdAt: NOW as never
        }),
        listInstrumentRevisions: () => ok(revisions as never),
        listLedgerEvents: () => ok(events as never),
        insertLedgerEvent: () => { inserted = true; return ok(undefined); }
      });
      const result = await new RecordLongTermPortfolioItemUseCase(unitOfWork(scope)).execute({
        context,
        command,
        identifiers: identifiers({
          mutationId: `mutation-temporal-exit-${index + 1}`,
          ledgerEventId: `ledger-temporal-exit-${index + 1}`
        })
      });

      expect(result, command.eventType).toMatchObject({ ok: false, error: { category: 'validation' } });
      expect(inserted, command.eventType).toBe(false);
    }
  });

  it('rejects a positive-event reversal when only a later recovery hides a negative intermediate pivot', async () => {
    const portfolio = {
      id: 'portfolio-temporal-reversal', mutationId: 'bootstrap-mutation', familyId: context.familyId,
      ownerPersonId: context.actor.personId!, name: 'Zaman Cizelgesi', baseCurrency: 'TRY',
      privacy: 'private' as const, targetDate: '2032-08-13T00:00:00.000Z', purpose: 'Birikim',
      createdAt: NOW as never
    };
    const originalBuy = {
      id: 'temporal-reversal-original', portfolioId: portfolio.id, instrumentId: 'instrument-ltp-1',
      mutationId: 'mutation-temporal-reversal-original', familyId: context.familyId,
      ownerPersonId: context.actor.personId!, privacy: 'private' as const,
      eventType: 'buy' as const, direction: 'cash_out' as const, currency: 'TRY',
      executedAt: '2026-08-13T07:00:00.000Z', quantity: 10, grossAmount: 1_000,
      feeAmount: 0, taxAmount: 0, netCashAmount: -1_000, sourceLabel: 'Opening buy',
      dataSource: 'user_entered' as const, externalVerification: 'not_performed' as const,
      createdAt: '2026-08-13T07:00:00.000Z' as never
    };
    const events = [
      originalBuy,
      {
        id: 'temporal-reversal-sale', portfolioId: portfolio.id, instrumentId: 'instrument-ltp-1',
        mutationId: 'mutation-temporal-reversal-sale', familyId: context.familyId,
        ownerPersonId: context.actor.personId!, privacy: 'private', eventType: 'sell', direction: 'cash_in',
        currency: 'TRY', executedAt: '2026-08-13T08:00:00.000Z', quantity: 8,
        grossAmount: 800, feeAmount: 0, taxAmount: 0, netCashAmount: 800,
        sourceLabel: 'Intermediate sale', dataSource: 'user_entered', externalVerification: 'not_performed',
        createdAt: '2026-08-13T08:00:00.000Z'
      },
      {
        id: 'temporal-reversal-recovery', portfolioId: portfolio.id, instrumentId: 'instrument-ltp-1',
        mutationId: 'mutation-temporal-reversal-recovery', familyId: context.familyId,
        ownerPersonId: context.actor.personId!, privacy: 'private', eventType: 'buy', direction: 'cash_out',
        currency: 'TRY', executedAt: '2026-08-13T08:30:00.000Z', quantity: 10,
        grossAmount: 1_000, feeAmount: 0, taxAmount: 0, netCashAmount: -1_000,
        sourceLabel: 'Recovery buy', dataSource: 'user_entered', externalVerification: 'not_performed',
        createdAt: '2026-08-13T08:30:00.000Z'
      }
    ];
    let inserted = false;
    const scope = baseScope({
      findPortfolio: () => ok(portfolio),
      listLedgerEvents: () => ok(events as never),
      findLedgerEvent: () => ok(originalBuy),
      insertLedgerEvent: () => { inserted = true; return ok(undefined); }
    });
    const result = await new RecordLongTermPortfolioItemUseCase(unitOfWork(scope)).execute({
      context,
      command: {
        itemType: 'ledger_event', clientOperationId: 'operation-temporal-reversal',
        portfolioId: portfolio.id, eventType: 'reversal', direction: 'non_cash', currency: 'TRY',
        executedAt: NOW, grossAmount: 0, feeAmount: 0, taxAmount: 0, netCashAmount: 0,
        reversalOfEventId: originalBuy.id, correctionReason: 'Hatali ilk alim', sourceLabel: 'Duzeltme'
      },
      identifiers: identifiers({
        mutationId: 'mutation-temporal-reversal',
        ledgerEventId: 'ledger-temporal-reversal'
      })
    });

    expect(result).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(inserted).toBe(false);
  });
});
