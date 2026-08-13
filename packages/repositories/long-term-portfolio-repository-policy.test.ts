import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId
} from '@ppt/core';
import type { RepositoryTransaction } from '@ppt/contracts';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import type {
  LongTermPortfolioLedgerEventRow,
  LongTermPortfolioMutationRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteLongTermPortfolioRepository } from './src/long-term-portfolio-repository.js';
import { computePlatformPolicyReceiptHash } from './src/platform-policy-transaction-repository.js';

const NOW = '2026-08-13T09:00:00.000Z';
const FAMILY_A = asFamilyId('family-ltp-a');
const FAMILY_B = asFamilyId('family-ltp-b');
const PERSON_A = asPersonId('person-ltp-a');
const PERSON_B = asPersonId('person-ltp-b');
const ACCOUNT_A = asUserId('account-ltp-a');
const FENCE_NAME = 'long-term-portfolio-write';
const FENCE_EPOCH = 89;
const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

const fixtureSchema = `
  PRAGMA foreign_keys=ON;
  CREATE TABLE families(id TEXT PRIMARY KEY);
  CREATE TABLE people(
    id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES families(id),status TEXT NOT NULL
  );
  CREATE TABLE accounts(
    id TEXT PRIMARY KEY,person_id TEXT NOT NULL REFERENCES people(id),status TEXT NOT NULL
  );
  CREATE TABLE database_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
  CREATE TABLE platform_policy_database_fences(
    fence_name TEXT PRIMARY KEY,epoch INTEGER NOT NULL,writable INTEGER NOT NULL,
    synchronized_at TEXT NOT NULL
  );
  CREATE TABLE platform_policy_transaction_receipts(
    receipt_hash TEXT PRIMARY KEY,receipt_version INTEGER NOT NULL,request_hash TEXT NOT NULL,
    context_hash TEXT NOT NULL,data_classes_json TEXT NOT NULL,obligation_execution_hash TEXT NOT NULL,
    policy_package_version INTEGER NOT NULL,policy_package_sha256 TEXT NOT NULL,
    application_version TEXT NOT NULL,capability_manifest_sha256 TEXT,
    device_certificate_sha256 TEXT,decision_authority_id TEXT,nonce TEXT NOT NULL,
    correlation_id TEXT NOT NULL,policy_version TEXT NOT NULL,resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,action TEXT NOT NULL,capability TEXT NOT NULL,
    fence_name TEXT NOT NULL REFERENCES platform_policy_database_fences(fence_name),
    fence_epoch INTEGER NOT NULL,fence_writable INTEGER NOT NULL,
    issued_at TEXT NOT NULL,recorded_at TEXT NOT NULL,record_json TEXT NOT NULL
  );
  CREATE TABLE platform_policy_journal_projection_outbox(
    receipt_hash TEXT PRIMARY KEY REFERENCES platform_policy_transaction_receipts(receipt_hash),
    record_json TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,projected_at TEXT
  );
  CREATE TABLE finance_records(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE finance_valuations(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE bank_accounts(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE payment_cards(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE loan_accounts(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE loan_payment_history(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE finance_planning_ledger(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  CREATE TABLE finance_import_batches(id TEXT PRIMARY KEY,policy_receipt_hash TEXT);
  INSERT INTO families VALUES('${FAMILY_A}'),('${FAMILY_B}');
  INSERT INTO people VALUES('${PERSON_A}','${FAMILY_A}','active'),('${PERSON_B}','${FAMILY_B}','active');
  INSERT INTO accounts VALUES('${ACCOUNT_A}','${PERSON_A}','active');
  INSERT INTO database_metadata VALUES('schema_generation','before-33-l','${NOW}');
  INSERT INTO platform_policy_database_fences VALUES('${FENCE_NAME}',${FENCE_EPOCH},1,'${NOW}');
`;

const migration89 = FAMILY_DATABASE_MIGRATIONS.find(({ version }) => version === 89);
if (!migration89) throw new Error('MIGRATION_89_NOT_FOUND');

const openFixture = (): DatabaseSync => {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  database.exec(fixtureSchema);
  database.exec(migration89.sql);
  return database;
};

const policyKernel = new PlatformPolicyKernel({
  policyVersion: '33-l-long-term-portfolio-repository-test-v1',
  signingKey: Buffer.from('33-l-long-term-portfolio-controlled-test-key', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['finance.read', 'finance.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

let nonceSequence = 0;

const persistReceipt = (database: DatabaseSync, record: PlatformPolicyReceiptRecord): void => {
  const receiptHash = computePlatformPolicyReceiptHash(record.receipt);
  const recordJson = JSON.stringify(record);
  database.prepare(`
    INSERT INTO platform_policy_transaction_receipts(
      receipt_hash,receipt_version,request_hash,context_hash,data_classes_json,
      obligation_execution_hash,policy_package_version,policy_package_sha256,
      application_version,capability_manifest_sha256,device_certificate_sha256,
      decision_authority_id,nonce,correlation_id,policy_version,resource_type,resource_id,
      action,capability,fence_name,fence_epoch,fence_writable,issued_at,recorded_at,record_json
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    receiptHash,
    record.receipt.receiptVersion,
    record.receipt.requestHash,
    record.contextHash,
    JSON.stringify(record.dataClasses),
    record.obligationExecution!.attestationHash,
    record.policyPackageVersion,
    record.policyPackageSha256,
    record.applicationVersion,
    record.capabilityManifestSha256,
    record.deviceCertificateSha256 ?? null,
    record.decisionAuthorityId ?? null,
    record.receipt.nonce,
    record.correlationId,
    record.decision.policyVersion,
    record.resourceType,
    record.resourceId,
    record.action,
    record.capability,
    FENCE_NAME,
    FENCE_EPOCH,
    1,
    record.receipt.issuedAt,
    record.recordedAt,
    recordJson
  );
  database.prepare(`
    INSERT INTO platform_policy_journal_projection_outbox(
      receipt_hash,record_json,status,created_at,projected_at
    ) VALUES(?,?,'pending',?,NULL)
  `).run(receiptHash, recordJson, record.recordedAt);
};

const executeCreatePolicy = async <T>(
  database: DatabaseSync,
  resourceId: string,
  operation: (
    repository: SqliteLongTermPortfolioRepository,
    context: PolicyAuthorizedRepositoryExecutionContext
  ) => RepositoryResult<T>,
  occurredAt = NOW
): Promise<RepositoryResult<T>> => {
  const correlationId = asCorrelationId(`correlation-ltp-${++nonceSequence}`);
  const pep = new PlatformPolicyEnforcementPoint({
    kernel: policyKernel,
    authorityResolver: {
      resolve: () => ({
        policyVersion: '33-l-long-term-portfolio-repository-test-v1',
        accountId: ACCOUNT_A,
        personId: PERSON_A,
        deviceId: 'device-ltp-a',
        applicationId: 'windows-desktop',
        deviceTrusted: true,
        membershipActive: true,
        roles: ['family_admin'],
        familyIds: [FAMILY_A],
        grants: [{
          id: `grant-${correlationId}`,
          subjectAccountId: ACCOUNT_A,
          resourceType: 'finance_record',
          resourceId,
          actions: ['create'],
          effect: 'allow',
          purpose: 'finance',
          startsAt: '2026-08-13T00:00:00.000Z'
        }],
        online: true,
        expiresAt: '2026-08-13T10:00:00.000Z'
      })
    },
    resourceResolver: {
      resolve: () => ({
        type: 'finance_record',
        id: resourceId,
        familyId: FAMILY_A,
        ownerPersonId: PERSON_A,
        sensitivity: 'highly_sensitive'
      })
    },
    receiptSink: { append: (record) => persistReceipt(database, record) },
    replayStore: { reserve: () => true },
    clock: () => occurredAt,
    nonceFactory: () => `nonce-ltp-${nonceSequence}`
  });

  return pep.execute({
    correlationId,
    action: 'create',
    capability: 'finance.write',
    resourceType: 'finance_record',
    resourceId,
    purpose: 'finance'
  }, () => ({ writable: true, epoch: FENCE_EPOCH }), (policyAuthorization) => operation(
    new SqliteLongTermPortfolioRepository(),
    {
      transaction: database as unknown as RepositoryTransaction,
      actor: { userId: ACCOUNT_A, roles: ['family_admin'], personId: PERSON_A },
      correlationId,
      occurredAt: asIsoDateTime(occurredAt),
      policyAuthorization
    }
  ));
};

const mutation = (
  id: string,
  operation: LongTermPortfolioMutationRow['operation'],
  overrides: Partial<LongTermPortfolioMutationRow> = {}
): LongTermPortfolioMutationRow => ({
  id,
  clientOperationId: `operation-${id}`,
  requestFingerprint: 'a'.repeat(64),
  familyId: FAMILY_A,
  ownerPersonId: PERSON_A,
  privacy: 'private',
  operation,
  resourceId: id,
  createdAt: asIsoDateTime(NOW),
  ...overrides
});

const rejected = async (operation: () => Promise<RepositoryResult<unknown>>): Promise<boolean> => {
  try {
    return !(await operation()).ok;
  } catch {
    return true;
  }
};

const insertBootstrapRoot = async (database: DatabaseSync): Promise<void> => {
  const result = await executeCreatePolicy(database, 'mutation-bootstrap', (repository, context) => {
    const mutationResult = repository.insertMutation(context, mutation('mutation-bootstrap', 'bootstrap_default'));
    if (!mutationResult.ok) return mutationResult;
    const instrument = repository.insertInstrument(context, {
      id: 'instrument-ltp-1',
      mutationId: 'mutation-bootstrap',
      familyId: FAMILY_A,
      ownerPersonId: PERSON_A,
      privacy: 'private',
      createdAt: asIsoDateTime(NOW)
    });
    if (!instrument.ok) return instrument;
    const revision = repository.insertInstrumentRevision(context, {
      revisionId: 'instrument-revision-ltp-1',
      instrumentId: 'instrument-ltp-1',
      mutationId: 'mutation-bootstrap',
      familyId: FAMILY_A,
      ownerPersonId: PERSON_A,
      privacy: 'private',
      assetClass: 'domestic_equity',
      groupLabel: 'Hisse',
      code: 'ASELS',
      name: 'Aselsan',
      currency: 'TRY',
      effectiveFrom: asIsoDateTime(NOW),
      status: 'active',
      dataSource: 'user_entered',
      externalVerification: 'not_performed',
      createdAt: asIsoDateTime(NOW)
    });
    if (!revision.ok) return revision;
    return repository.insertPortfolio(context, {
      id: 'portfolio-ltp-1',
      mutationId: 'mutation-bootstrap',
      familyId: FAMILY_A,
      ownerPersonId: PERSON_A,
      name: '2032 Uzun Vadeli Portfoy',
      baseCurrency: 'TRY',
      privacy: 'private',
      targetDate: asIsoDateTime('2032-08-13T00:00:00.000Z'),
      purpose: 'Uzun vadeli birikim',
      createdAt: asIsoDateTime(NOW)
    });
  });
  expect(result).toEqual({ ok: true, value: undefined });
};

const appendInstrumentRevision = async (
  database: DatabaseSync,
  mutationId: string,
  revisionId: string,
  effectiveFrom: string,
  replacesRevisionId: string | undefined,
  occurredAt: string
): Promise<RepositoryResult<void>> => executeCreatePolicy(database, mutationId, (repository, policyContext) => {
  const inserted = repository.insertMutation(
    policyContext,
    mutation(mutationId, 'instrument_revision', { createdAt: asIsoDateTime(occurredAt) })
  );
  if (!inserted.ok) return inserted;
  return repository.insertInstrumentRevision(policyContext, {
    revisionId,
    instrumentId: 'instrument-ltp-1',
    mutationId,
    familyId: FAMILY_A,
    ownerPersonId: PERSON_A,
    privacy: 'private',
    assetClass: 'domestic_equity',
    groupLabel: 'Hisse',
    code: 'ASELS',
    name: 'Aselsan',
    currency: 'TRY',
    effectiveFrom: asIsoDateTime(effectiveFrom),
    status: 'active',
    ...(replacesRevisionId ? { replacesRevisionId } : {}),
    dataSource: 'user_entered',
    externalVerification: 'not_performed',
    createdAt: asIsoDateTime(occurredAt)
  });
}, occurredAt);

const appendLedgerEvent = async (
  database: DatabaseSync,
  mutationId: string,
  row: Omit<LongTermPortfolioLedgerEventRow, 'mutationId' | 'familyId' | 'ownerPersonId' | 'privacy' | 'createdAt'>,
  occurredAt: string
): Promise<RepositoryResult<void>> => executeCreatePolicy(database, mutationId, (repository, policyContext) => {
  const inserted = repository.insertMutation(
    policyContext,
    mutation(mutationId, 'ledger_event', { createdAt: asIsoDateTime(occurredAt) })
  );
  if (!inserted.ok) return inserted;
  return repository.insertLedgerEvent(policyContext, {
    ...row,
    mutationId,
    familyId: FAMILY_A,
    ownerPersonId: PERSON_A,
    privacy: 'private',
    createdAt: asIsoDateTime(occurredAt)
  });
}, occurredAt);

describe('33-L long-term portfolio repository and migration policy', () => {
  it('creates migration 89 with receipt fields, scope guards and immutable ledgers', () => {
    const database = openFixture();
    expect(migration89.name).toBe('b4_long_term_portfolio_ledger');
    expect(database.prepare(
      "SELECT value FROM database_metadata WHERE key='schema_generation'"
    ).get()).toEqual({ value: 'REVISION-33-L-LONG-TERM-PORTFOLIO' });
    expect((database.prepare("PRAGMA table_info('long_term_portfolio_mutations')").all() as Array<{ name: string }>)
      .map(({ name }) => name)).toEqual(expect.arrayContaining([
        'client_operation_id', 'request_fingerprint', 'family_id', 'owner_person_id', 'privacy', 'policy_receipt_hash',
        'policy_receipt_version', 'policy_receipt_nonce', 'policy_correlation_id',
        'policy_resource_type', 'policy_resource_id', 'policy_action', 'policy_capability'
      ]));
    expect((database.prepare(
      "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_ltp_%'"
    ).all() as Array<{ name: string }>).map(({ name }) => name)).toEqual(expect.arrayContaining([
      'trg_ltp_mutation_policy_receipt',
      'trg_ltp_revision_scope',
      'trg_ltp_portfolio_scope',
      'trg_ltp_plan_scope',
      'trg_ltp_allocation_scope',
      'trg_ltp_plan_seal_scope',
      'trg_ltp_plan_seal_update',
      'trg_ltp_plan_seal_delete',
      'trg_ltp_event_scope',
      'trg_ltp_event_quantity_balance',
      'trg_ltp_reversal_quantity_balance',
      'trg_ltp_price_scope',
      'trg_ltp_event_update',
      'trg_ltp_event_delete'
    ]));
    expect(database.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='long_term_portfolio_plan_seals'"
    ).get()).toEqual({ name: 'long_term_portfolio_plan_seals' });
  });

  it('allows family-filtered precondition reads inside the active create receipt transaction', async () => {
    const database = openFixture();
    const result = await executeCreatePolicy(
      database,
      'mutation-precondition-read',
      (repository, policyContext) => repository.listPortfolios(policyContext)
    );
    expect(result).toEqual({ ok: true, value: [] });
  });

  it('rejects a duplicate client operation id within the same family', async () => {
    const database = openFixture();
    const clientOperationId = 'operation-replayed-ledger-1';
    const first = await executeCreatePolicy(
      database,
      'mutation-idempotency-first',
      (repository, policyContext) => repository.insertMutation(policyContext, mutation(
        'mutation-idempotency-first',
        'ledger_event',
        { clientOperationId, requestFingerprint: 'b'.repeat(64) }
      ))
    );
    expect(first).toEqual({ ok: true, value: undefined });

    expect(await rejected(() => executeCreatePolicy(
      database,
      'mutation-idempotency-replay',
      (repository, policyContext) => repository.insertMutation(policyContext, mutation(
        'mutation-idempotency-replay',
        'ledger_event',
        { clientOperationId, requestFingerprint: 'b'.repeat(64) }
      ))
    ))).toBe(true);
    expect(database.prepare(
      'SELECT COUNT(*) AS count FROM long_term_portfolio_mutations WHERE family_id=? AND client_operation_id=?'
    ).get(FAMILY_A, clientOperationId)).toEqual({ count: 1 });
  });

  it('rejects binding a family-A PEP receipt to a family-B mutation row', async () => {
    const database = openFixture();
    expect(await rejected(() => executeCreatePolicy(
      database,
      'mutation-cross-family',
      (repository, policyContext) => repository.insertMutation(policyContext, mutation(
        'mutation-cross-family',
        'instrument_revision',
        { familyId: FAMILY_B, ownerPersonId: PERSON_B }
      ))
    ))).toBe(true);
  });

  it('rejects an owner whose person row belongs to another family', async () => {
    const database = openFixture();
    expect(await rejected(() => executeCreatePolicy(
      database,
      'mutation-cross-owner-family',
      (repository, policyContext) => repository.insertMutation(policyContext, mutation(
        'mutation-cross-owner-family',
        'instrument_revision',
        { ownerPersonId: PERSON_B }
      ))
    ))).toBe(true);
  });

  it('rejects stable-instrument family and owner drift from its mutation receipt', async () => {
    const database = openFixture();
    expect(await rejected(() => executeCreatePolicy(
      database,
      'mutation-instrument-scope',
      (repository, policyContext) => {
        const inserted = repository.insertMutation(
          policyContext,
          mutation('mutation-instrument-scope', 'instrument_revision')
        );
        if (!inserted.ok) return inserted;
        return repository.insertInstrument(policyContext, {
          id: 'instrument-cross-family',
          mutationId: 'mutation-instrument-scope',
          familyId: FAMILY_B,
          ownerPersonId: PERSON_B,
          privacy: 'family',
          createdAt: asIsoDateTime(NOW)
        });
      }
    ))).toBe(true);
  });

  it('rejects privacy drift between a bootstrap mutation and its portfolio', async () => {
    const database = openFixture();
    expect(await rejected(() => executeCreatePolicy(
      database,
      'mutation-privacy-drift',
      (repository, policyContext) => {
        const inserted = repository.insertMutation(
          policyContext,
          mutation('mutation-privacy-drift', 'bootstrap_default')
        );
        if (!inserted.ok) return inserted;
        return repository.insertPortfolio(policyContext, {
          id: 'portfolio-privacy-drift',
          mutationId: 'mutation-privacy-drift',
          familyId: FAMILY_A,
          ownerPersonId: PERSON_A,
          name: 'Privacy drift portfolio',
          baseCurrency: 'TRY',
          privacy: 'family',
          targetDate: asIsoDateTime('2032-08-13T00:00:00.000Z'),
          purpose: 'Uzun vadeli birikim',
          createdAt: asIsoDateTime(NOW)
        });
      }
    ))).toBe(true);
  });

  it('keeps unsealed plans invisible and publishes only an exact 10,000 basis-point allocation graph', async () => {
    const database = openFixture();
    await insertBootstrapRoot(database);
    let plansBeforeSeal = -1;
    let allocationsBeforeSeal = -1;
    let plansAfterSeal = -1;
    let allocationsAfterSeal = -1;

    const result = await executeCreatePolicy<void>(
      database,
      'mutation-plan-sealed',
      (repository, policyContext) => {
        const inserted = repository.insertMutation(
          policyContext,
          mutation('mutation-plan-sealed', 'plan_version')
        );
        if (!inserted.ok) return inserted;
        const plan = repository.insertPlanVersion(policyContext, {
          id: 'plan-sealed',
          portfolioId: 'portfolio-ltp-1',
          mutationId: 'mutation-plan-sealed',
          familyId: FAMILY_A,
          ownerPersonId: PERSON_A,
          privacy: 'private',
          version: 1,
          effectiveMonth: '2026-09',
          monthlyContribution: 20_000,
          contributionCurrency: 'TRY',
          contributionChangeReason: 'Yeni plan',
          rebalanceIntervalMonths: 6,
          inflationAdjustment: 'manual_realized_inflation',
          targetDate: asIsoDateTime('2032-08-13T00:00:00.000Z'),
          assumptions: {
            pessimisticAnnualReturnBasisPoints: 500,
            baseAnnualReturnBasisPoints: 1_500,
            optimisticAnnualReturnBasisPoints: 2_500,
            annualInflationBasisPoints: 2_000,
            annualContributionGrowthBasisPoints: 2_000
          },
          createdAt: asIsoDateTime(NOW)
        });
        if (!plan.ok) return plan;
        const allocation = repository.insertAllocation(policyContext, {
          id: 'allocation-sealed',
          portfolioId: 'portfolio-ltp-1',
          planVersionId: 'plan-sealed',
          instrumentId: 'instrument-ltp-1',
          mutationId: 'mutation-plan-sealed',
          familyId: FAMILY_A,
          ownerPersonId: PERSON_A,
          privacy: 'private',
          sleeve: 'core',
          targetBasisPoints: 10_000,
          carryoverPolicy: 'same_instrument',
          displayOrder: 1,
          createdAt: asIsoDateTime(NOW)
        });
        if (!allocation.ok) return allocation;
        const hiddenPlans = repository.listPlanVersions(policyContext, 'portfolio-ltp-1');
        if (!hiddenPlans.ok) return hiddenPlans;
        const hiddenAllocations = repository.listAllocations(policyContext, 'portfolio-ltp-1');
        if (!hiddenAllocations.ok) return hiddenAllocations;
        plansBeforeSeal = hiddenPlans.value.length;
        allocationsBeforeSeal = hiddenAllocations.value.length;

        const sealed = repository.insertPlanSeal(policyContext, {
          planVersionId: 'plan-sealed',
          mutationId: 'mutation-plan-sealed',
          familyId: FAMILY_A,
          ownerPersonId: PERSON_A,
          privacy: 'private',
          allocationCount: 1,
          totalBasisPoints: 10_000,
          createdAt: asIsoDateTime(NOW)
        });
        if (!sealed.ok) return sealed;
        const visiblePlans = repository.listPlanVersions(policyContext, 'portfolio-ltp-1');
        if (!visiblePlans.ok) return visiblePlans;
        const visibleAllocations = repository.listAllocations(policyContext, 'portfolio-ltp-1');
        if (!visibleAllocations.ok) return visibleAllocations;
        plansAfterSeal = visiblePlans.value.length;
        allocationsAfterSeal = visibleAllocations.value.length;
        return { ok: true as const, value: undefined };
      }
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect({ plansBeforeSeal, allocationsBeforeSeal }).toEqual({
      plansBeforeSeal: 0,
      allocationsBeforeSeal: 0
    });
    expect({ plansAfterSeal, allocationsAfterSeal }).toEqual({
      plansAfterSeal: 1,
      allocationsAfterSeal: 1
    });
  });

  it('rejects a plan seal when persisted allocations total 9,999 basis points', async () => {
    const database = openFixture();
    await insertBootstrapRoot(database);

    expect(await rejected(() => executeCreatePolicy(
      database,
      'mutation-plan-9999',
      (repository, policyContext) => {
        const inserted = repository.insertMutation(
          policyContext,
          mutation('mutation-plan-9999', 'plan_version')
        );
        if (!inserted.ok) return inserted;
        const plan = repository.insertPlanVersion(policyContext, {
          id: 'plan-9999', portfolioId: 'portfolio-ltp-1', mutationId: 'mutation-plan-9999',
          familyId: FAMILY_A, ownerPersonId: PERSON_A, privacy: 'private', version: 1,
          effectiveMonth: '2026-09', monthlyContribution: 20_000, contributionCurrency: 'TRY',
          contributionChangeReason: 'Eksik toplam regresyonu', rebalanceIntervalMonths: 6,
          inflationAdjustment: 'manual_realized_inflation',
          targetDate: asIsoDateTime('2032-08-13T00:00:00.000Z'),
          assumptions: {
            pessimisticAnnualReturnBasisPoints: 500, baseAnnualReturnBasisPoints: 1_500,
            optimisticAnnualReturnBasisPoints: 2_500, annualInflationBasisPoints: 2_000,
            annualContributionGrowthBasisPoints: 2_000
          },
          createdAt: asIsoDateTime(NOW)
        });
        if (!plan.ok) return plan;
        const allocation = repository.insertAllocation(policyContext, {
          id: 'allocation-9999', portfolioId: 'portfolio-ltp-1', planVersionId: 'plan-9999',
          instrumentId: 'instrument-ltp-1', mutationId: 'mutation-plan-9999', familyId: FAMILY_A,
          ownerPersonId: PERSON_A, privacy: 'private', sleeve: 'core', targetBasisPoints: 9_999,
          carryoverPolicy: 'same_instrument', displayOrder: 1, createdAt: asIsoDateTime(NOW)
        });
        if (!allocation.ok) return allocation;
        return repository.insertPlanSeal(policyContext, {
          planVersionId: 'plan-9999', mutationId: 'mutation-plan-9999', familyId: FAMILY_A,
          ownerPersonId: PERSON_A, privacy: 'private', allocationCount: 1,
          totalBasisPoints: 10_000, createdAt: asIsoDateTime(NOW)
        });
      }
    ))).toBe(true);
  });

  it('enforces a strictly forward, single-successor instrument revision chain', async () => {
    const database = openFixture();
    await insertBootstrapRoot(database);

    expect(await appendInstrumentRevision(
      database,
      'mutation-revision-2',
      'instrument-revision-ltp-2',
      '2026-08-13T09:10:00.000Z',
      'instrument-revision-ltp-1',
      '2026-08-13T09:20:00.000Z'
    )).toEqual({ ok: true, value: undefined });

    expect(await rejected(() => appendInstrumentRevision(
      database,
      'mutation-revision-fork',
      'instrument-revision-ltp-fork',
      '2026-08-13T09:30:00.000Z',
      'instrument-revision-ltp-1',
      '2026-08-13T09:40:00.000Z'
    ))).toBe(true);

    expect(await rejected(() => appendInstrumentRevision(
      database,
      'mutation-revision-detached',
      'instrument-revision-ltp-detached',
      '2026-08-13T09:31:00.000Z',
      undefined,
      '2026-08-13T09:41:00.000Z'
    ))).toBe(true);

    expect(await rejected(() => appendInstrumentRevision(
      database,
      'mutation-revision-backdated',
      'instrument-revision-ltp-backdated',
      '2026-08-13T09:05:00.000Z',
      'instrument-revision-ltp-2',
      '2026-08-13T09:42:00.000Z'
    ))).toBe(true);
  });

  it('rejects a backdated exit that is funded at execution time but makes a later pivot negative', async () => {
    const database = openFixture();
    await insertBootstrapRoot(database);

    expect(await appendLedgerEvent(database, 'mutation-timeline-opening-buy', {
      id: 'ledger-timeline-opening-buy', portfolioId: 'portfolio-ltp-1', instrumentId: 'instrument-ltp-1',
      eventType: 'buy', direction: 'cash_out', currency: 'TRY',
      orderAt: asIsoDateTime('2026-08-13T09:09:00.000Z'),
      executedAt: asIsoDateTime('2026-08-13T09:10:00.000Z'),
      settlementAt: asIsoDateTime('2026-08-13T09:11:00.000Z'),
      quantity: 10, unitPrice: 100, grossAmount: 1_000, feeAmount: 0, taxAmount: 0,
      netCashAmount: -1_000, sourceLabel: 'Opening buy', dataSource: 'user_entered',
      externalVerification: 'not_performed'
    }, '2026-08-13T09:12:00.000Z')).toEqual({ ok: true, value: undefined });

    expect(await appendLedgerEvent(database, 'mutation-timeline-later-sale', {
      id: 'ledger-timeline-later-sale', portfolioId: 'portfolio-ltp-1', instrumentId: 'instrument-ltp-1',
      eventType: 'sell', direction: 'cash_in', currency: 'TRY',
      orderAt: asIsoDateTime('2026-08-13T09:29:00.000Z'),
      executedAt: asIsoDateTime('2026-08-13T09:30:00.000Z'),
      settlementAt: asIsoDateTime('2026-08-13T09:31:00.000Z'),
      quantity: 8, unitPrice: 100, grossAmount: 800, feeAmount: 0, taxAmount: 0,
      netCashAmount: 800, sourceLabel: 'Later sale', dataSource: 'user_entered',
      externalVerification: 'not_performed'
    }, '2026-08-13T09:32:00.000Z')).toEqual({ ok: true, value: undefined });

    expect(await appendLedgerEvent(database, 'mutation-timeline-recovery-buy', {
      id: 'ledger-timeline-recovery-buy', portfolioId: 'portfolio-ltp-1', instrumentId: 'instrument-ltp-1',
      eventType: 'buy', direction: 'cash_out', currency: 'TRY',
      orderAt: asIsoDateTime('2026-08-13T09:39:00.000Z'),
      executedAt: asIsoDateTime('2026-08-13T09:40:00.000Z'),
      settlementAt: asIsoDateTime('2026-08-13T09:41:00.000Z'),
      quantity: 10, unitPrice: 100, grossAmount: 1_000, feeAmount: 0, taxAmount: 0,
      netCashAmount: -1_000, sourceLabel: 'Recovery buy', dataSource: 'user_entered',
      externalVerification: 'not_performed'
    }, '2026-08-13T09:42:00.000Z')).toEqual({ ok: true, value: undefined });

    expect(await rejected(() => appendLedgerEvent(database, 'mutation-timeline-backdated-sale', {
      id: 'ledger-timeline-backdated-sale', portfolioId: 'portfolio-ltp-1', instrumentId: 'instrument-ltp-1',
      eventType: 'sell', direction: 'cash_in', currency: 'TRY',
      orderAt: asIsoDateTime('2026-08-13T09:19:00.000Z'),
      executedAt: asIsoDateTime('2026-08-13T09:20:00.000Z'),
      settlementAt: asIsoDateTime('2026-08-13T09:21:00.000Z'),
      quantity: 5, unitPrice: 100, grossAmount: 500, feeAmount: 0, taxAmount: 0,
      netCashAmount: 500, sourceLabel: 'Backdated sale', dataSource: 'user_entered',
      externalVerification: 'not_performed'
    }, '2026-08-13T09:50:00.000Z'))).toBe(true);
    expect(database.prepare(
      "SELECT COUNT(*) AS count FROM long_term_portfolio_ledger_events WHERE id='ledger-timeline-backdated-sale'"
    ).get()).toEqual({ count: 0 });
  });

  it('rejects reversing an opening quantity when a later recovery masks a negative intermediate pivot', async () => {
    const database = openFixture();
    await insertBootstrapRoot(database);

    expect(await appendLedgerEvent(database, 'mutation-reversal-timeline-opening', {
      id: 'ledger-reversal-timeline-opening', portfolioId: 'portfolio-ltp-1', instrumentId: 'instrument-ltp-1',
      eventType: 'buy', direction: 'cash_out', currency: 'TRY',
      orderAt: asIsoDateTime('2026-08-13T09:09:00.000Z'),
      executedAt: asIsoDateTime('2026-08-13T09:10:00.000Z'),
      settlementAt: asIsoDateTime('2026-08-13T09:11:00.000Z'),
      quantity: 10, unitPrice: 100, grossAmount: 1_000, feeAmount: 0, taxAmount: 0,
      netCashAmount: -1_000, sourceLabel: 'Opening buy', dataSource: 'user_entered',
      externalVerification: 'not_performed'
    }, '2026-08-13T09:12:00.000Z')).toEqual({ ok: true, value: undefined });

    expect(await appendLedgerEvent(database, 'mutation-reversal-timeline-sale', {
      id: 'ledger-reversal-timeline-sale', portfolioId: 'portfolio-ltp-1', instrumentId: 'instrument-ltp-1',
      eventType: 'sell', direction: 'cash_in', currency: 'TRY',
      orderAt: asIsoDateTime('2026-08-13T09:29:00.000Z'),
      executedAt: asIsoDateTime('2026-08-13T09:30:00.000Z'),
      settlementAt: asIsoDateTime('2026-08-13T09:31:00.000Z'),
      quantity: 8, unitPrice: 100, grossAmount: 800, feeAmount: 0, taxAmount: 0,
      netCashAmount: 800, sourceLabel: 'Intermediate sale', dataSource: 'user_entered',
      externalVerification: 'not_performed'
    }, '2026-08-13T09:32:00.000Z')).toEqual({ ok: true, value: undefined });

    expect(await appendLedgerEvent(database, 'mutation-reversal-timeline-recovery', {
      id: 'ledger-reversal-timeline-recovery', portfolioId: 'portfolio-ltp-1', instrumentId: 'instrument-ltp-1',
      eventType: 'buy', direction: 'cash_out', currency: 'TRY',
      orderAt: asIsoDateTime('2026-08-13T09:39:00.000Z'),
      executedAt: asIsoDateTime('2026-08-13T09:40:00.000Z'),
      settlementAt: asIsoDateTime('2026-08-13T09:41:00.000Z'),
      quantity: 10, unitPrice: 100, grossAmount: 1_000, feeAmount: 0, taxAmount: 0,
      netCashAmount: -1_000, sourceLabel: 'Recovery buy', dataSource: 'user_entered',
      externalVerification: 'not_performed'
    }, '2026-08-13T09:42:00.000Z')).toEqual({ ok: true, value: undefined });

    expect(await rejected(() => appendLedgerEvent(database, 'mutation-reversal-timeline-attempt', {
      id: 'ledger-reversal-timeline-attempt', portfolioId: 'portfolio-ltp-1',
      eventType: 'reversal', direction: 'non_cash', currency: 'TRY',
      executedAt: asIsoDateTime('2026-08-13T09:50:00.000Z'), grossAmount: 0,
      feeAmount: 0, taxAmount: 0, netCashAmount: 0,
      reversalOfEventId: 'ledger-reversal-timeline-opening', correctionReason: 'Hatali ilk alim',
      sourceLabel: 'Duzeltme', dataSource: 'user_entered', externalVerification: 'not_performed'
    }, '2026-08-13T09:51:00.000Z'))).toBe(true);
    expect(database.prepare(
      "SELECT COUNT(*) AS count FROM long_term_portfolio_ledger_events WHERE id='ledger-reversal-timeline-attempt'"
    ).get()).toEqual({ count: 0 });
  });

  it('rejects a test-only two-month carryover transfer that would overdraw its variable source plan balance', async () => {
    const database = openFixture();
    await insertBootstrapRoot(database);

    expect(await executeCreatePolicy(database, 'mutation-budget-target', (repository, policyContext) => {
      const inserted = repository.insertMutation(
        policyContext,
        mutation('mutation-budget-target', 'instrument_revision')
      );
      if (!inserted.ok) return inserted;
      const instrument = repository.insertInstrument(policyContext, {
        id: 'instrument-ltp-2',
        mutationId: 'mutation-budget-target',
        familyId: FAMILY_A,
        ownerPersonId: PERSON_A,
        privacy: 'private',
        createdAt: asIsoDateTime(NOW)
      });
      if (!instrument.ok) return instrument;
      return repository.insertInstrumentRevision(policyContext, {
        revisionId: 'instrument-revision-ltp-target',
        instrumentId: 'instrument-ltp-2',
        mutationId: 'mutation-budget-target',
        familyId: FAMILY_A,
        ownerPersonId: PERSON_A,
        privacy: 'private',
        assetClass: 'domestic_equity',
        groupLabel: 'Hisse',
        code: 'THYAO',
        name: 'Turk Hava Yollari',
        currency: 'TRY',
        effectiveFrom: asIsoDateTime(NOW),
        status: 'active',
        dataSource: 'user_entered',
        externalVerification: 'not_performed',
        createdAt: asIsoDateTime(NOW)
      });
    })).toEqual({ ok: true, value: undefined });

    expect(await executeCreatePolicy(database, 'mutation-budget-plan', (repository, policyContext) => {
      const inserted = repository.insertMutation(
        policyContext,
        mutation('mutation-budget-plan', 'plan_version')
      );
      if (!inserted.ok) return inserted;
      const plan = repository.insertPlanVersion(policyContext, {
        id: 'plan-budget-transfer',
        portfolioId: 'portfolio-ltp-1',
        mutationId: 'mutation-budget-plan',
        familyId: FAMILY_A,
        ownerPersonId: PERSON_A,
        privacy: 'private',
        version: 1,
        effectiveMonth: '2026-07',
        monthlyContribution: 1_000,
        contributionCurrency: 'TRY',
        contributionChangeReason: 'Virman bakiye regresyonu',
        rebalanceIntervalMonths: 6,
        inflationAdjustment: 'manual_realized_inflation',
        targetDate: asIsoDateTime('2032-08-13T00:00:00.000Z'),
        assumptions: {
          pessimisticAnnualReturnBasisPoints: 500,
          baseAnnualReturnBasisPoints: 1_500,
          optimisticAnnualReturnBasisPoints: 2_500,
          annualInflationBasisPoints: 2_000,
          annualContributionGrowthBasisPoints: 2_000
        },
        createdAt: asIsoDateTime(NOW)
      });
      if (!plan.ok) return plan;
      const allocation = repository.insertAllocation(policyContext, {
        id: 'allocation-budget-transfer',
        portfolioId: 'portfolio-ltp-1',
        planVersionId: 'plan-budget-transfer',
        instrumentId: 'instrument-ltp-1',
        mutationId: 'mutation-budget-plan',
        familyId: FAMILY_A,
        ownerPersonId: PERSON_A,
        privacy: 'private',
        sleeve: 'core',
        targetBasisPoints: 10_000,
        carryoverPolicy: 'same_instrument',
        displayOrder: 1,
        createdAt: asIsoDateTime(NOW)
      });
      if (!allocation.ok) return allocation;
      return repository.insertPlanSeal(policyContext, {
        planVersionId: 'plan-budget-transfer',
        mutationId: 'mutation-budget-plan',
        familyId: FAMILY_A,
        ownerPersonId: PERSON_A,
        privacy: 'private',
        allocationCount: 1,
        totalBasisPoints: 10_000,
        createdAt: asIsoDateTime(NOW)
      });
    })).toEqual({ ok: true, value: undefined });

    expect(await appendLedgerEvent(database, 'mutation-budget-transfer-exact', {
      id: 'ledger-budget-transfer-exact',
      portfolioId: 'portfolio-ltp-1',
      instrumentId: 'instrument-ltp-1',
      transferCounterpartyInstrumentId: 'instrument-ltp-2',
      eventType: 'transfer_out',
      direction: 'non_cash',
      currency: 'TRY',
      executedAt: asIsoDateTime(NOW),
      grossAmount: 2_000,
      feeAmount: 0,
      taxAmount: 0,
      netCashAmount: 0,
      sourceLabel: 'Test fixture only: exact two-month variable-plan carryover transfer',
      dataSource: 'user_entered',
      externalVerification: 'not_performed'
    }, NOW)).toEqual({ ok: true, value: undefined });

    expect(database.prepare(`
      SELECT direction,quantity,gross_amount,net_cash_amount,instrument_id,transfer_counterparty_instrument_id
      FROM long_term_portfolio_ledger_events WHERE id='ledger-budget-transfer-exact'
    `).get()).toEqual({
      direction: 'non_cash',
      quantity: null,
      gross_amount: 2_000,
      net_cash_amount: 0,
      instrument_id: 'instrument-ltp-1',
      transfer_counterparty_instrument_id: 'instrument-ltp-2'
    });

    expect(await rejected(() => appendLedgerEvent(database, 'mutation-budget-transfer-overdraw', {
      id: 'ledger-budget-transfer-overdraw',
      portfolioId: 'portfolio-ltp-1',
      instrumentId: 'instrument-ltp-1',
      transferCounterpartyInstrumentId: 'instrument-ltp-2',
      eventType: 'transfer_out',
      direction: 'non_cash',
      currency: 'TRY',
      executedAt: asIsoDateTime(NOW),
      grossAmount: 0.01,
      feeAmount: 0,
      taxAmount: 0,
      netCashAmount: 0,
      sourceLabel: 'Overdrawn plan and carryover transfer',
      dataSource: 'user_entered',
      externalVerification: 'not_performed'
    }, NOW))).toBe(true);
    expect(database.prepare(
      "SELECT COUNT(*) AS count FROM long_term_portfolio_ledger_events WHERE event_type='transfer_out'"
    ).get()).toEqual({ count: 1 });
    expect(database.prepare(
      "SELECT COUNT(*) AS count FROM long_term_portfolio_ledger_events WHERE id='ledger-budget-transfer-overdraw'"
    ).get()).toEqual({ count: 0 });
  });

  it('keeps ledger rows append-only and permits only one non-reversal target reversal', async () => {
    const database = openFixture();
    await insertBootstrapRoot(database);

    const original = await executeCreatePolicy(database, 'mutation-ledger-original', (repository, policyContext) => {
      const inserted = repository.insertMutation(
        policyContext,
        mutation('mutation-ledger-original', 'ledger_event')
      );
      if (!inserted.ok) return inserted;
      return repository.insertLedgerEvent(policyContext, {
        id: 'ledger-original',
        portfolioId: 'portfolio-ltp-1',
        instrumentId: 'instrument-ltp-1',
        mutationId: 'mutation-ledger-original',
        familyId: FAMILY_A,
        ownerPersonId: PERSON_A,
        privacy: 'private',
        eventType: 'buy',
        direction: 'cash_out',
        currency: 'TRY',
        orderAt: asIsoDateTime(NOW),
        executedAt: asIsoDateTime(NOW),
        settlementAt: asIsoDateTime(NOW),
        quantity: 2,
        unitPrice: 100,
        grossAmount: 200,
        feeAmount: 5,
        taxAmount: 1,
        netCashAmount: -206,
        sourceLabel: 'Dekont',
        dataSource: 'user_entered',
        externalVerification: 'not_performed',
        createdAt: asIsoDateTime(NOW)
      });
    });
    expect(original).toEqual({ ok: true, value: undefined });

    const reversal = await executeCreatePolicy(database, 'mutation-ledger-reversal', (repository, policyContext) => {
      const inserted = repository.insertMutation(
        policyContext,
        mutation('mutation-ledger-reversal', 'ledger_event')
      );
      if (!inserted.ok) return inserted;
      return repository.insertLedgerEvent(policyContext, {
        id: 'ledger-reversal',
        portfolioId: 'portfolio-ltp-1',
        mutationId: 'mutation-ledger-reversal',
        familyId: FAMILY_A,
        ownerPersonId: PERSON_A,
        privacy: 'private',
        eventType: 'reversal',
        direction: 'non_cash',
        currency: 'TRY',
        executedAt: asIsoDateTime(NOW),
        grossAmount: 0,
        feeAmount: 0,
        taxAmount: 0,
        netCashAmount: 0,
        reversalOfEventId: 'ledger-original',
        correctionReason: 'Yanlis kayit',
        sourceLabel: 'Duzeltme',
        dataSource: 'user_entered',
        externalVerification: 'not_performed',
        createdAt: asIsoDateTime(NOW)
      });
    });
    expect(reversal).toEqual({ ok: true, value: undefined });

    expect(() => database.prepare(
      "UPDATE long_term_portfolio_ledger_events SET source_label='Degistirilemez' WHERE id='ledger-original'"
    ).run()).toThrow(/append-only/i);
    expect(() => database.prepare(
      "DELETE FROM long_term_portfolio_ledger_events WHERE id='ledger-original'"
    ).run()).toThrow(/deletion is forbidden/i);

    expect(await rejected(() => executeCreatePolicy(
      database,
      'mutation-ledger-duplicate-reversal',
      (repository, policyContext) => {
        const inserted = repository.insertMutation(
          policyContext,
          mutation('mutation-ledger-duplicate-reversal', 'ledger_event')
        );
        if (!inserted.ok) return inserted;
        return repository.insertLedgerEvent(policyContext, {
          id: 'ledger-duplicate-reversal', portfolioId: 'portfolio-ltp-1',
          mutationId: 'mutation-ledger-duplicate-reversal', familyId: FAMILY_A,
          ownerPersonId: PERSON_A, privacy: 'private', eventType: 'reversal', direction: 'non_cash',
          currency: 'TRY', executedAt: asIsoDateTime(NOW), grossAmount: 0, feeAmount: 0,
          taxAmount: 0, netCashAmount: 0, reversalOfEventId: 'ledger-original',
          correctionReason: 'Ikinci ters kayit', sourceLabel: 'Duzeltme', dataSource: 'user_entered',
          externalVerification: 'not_performed', createdAt: asIsoDateTime(NOW)
        });
      }
    ))).toBe(true);

    expect(await rejected(() => executeCreatePolicy(
      database,
      'mutation-ledger-reverse-reversal',
      (repository, policyContext) => {
        const inserted = repository.insertMutation(
          policyContext,
          mutation('mutation-ledger-reverse-reversal', 'ledger_event')
        );
        if (!inserted.ok) return inserted;
        return repository.insertLedgerEvent(policyContext, {
          id: 'ledger-reverse-reversal', portfolioId: 'portfolio-ltp-1',
          mutationId: 'mutation-ledger-reverse-reversal', familyId: FAMILY_A,
          ownerPersonId: PERSON_A, privacy: 'private', eventType: 'reversal', direction: 'non_cash',
          currency: 'TRY', executedAt: asIsoDateTime(NOW), grossAmount: 0, feeAmount: 0,
          taxAmount: 0, netCashAmount: 0, reversalOfEventId: 'ledger-reversal',
          correctionReason: 'Ters kaydi tersleme', sourceLabel: 'Duzeltme', dataSource: 'user_entered',
          externalVerification: 'not_performed', createdAt: asIsoDateTime(NOW)
        });
      }
    ))).toBe(true);
  });
});
