import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  ERROR_CODES,
  asCorrelationId,
  asEventId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  createAppError,
  err,
  ok,
  type Clock
} from '@ppt/core';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord,
  type PlatformPolicyReceiptSink,
  type PlatformPolicyTransactionContext
} from '@ppt/platform-policy';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  TransactionContext
} from '@ppt/repository-contracts';
import {
  SqliteArchiveRepository,
  SqliteAuditRepository,
  SqliteOutboxRepository,
  SqlitePlatformPolicyTransactionRepository,
  canonicalPlatformPolicyJson,
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '@ppt/repositories';
import { SqliteFamilyDatabaseRuntime } from '../src/main/family-database-runtime.js';
import { PlatformPolicyReceiptFileSink } from '../src/main/platform-policy-receipt-file-sink.js';
import { ProtectedSideArtifactStore } from '../src/main/protected-side-artifact-store.js';
import { createArchiveProductionPolicyEnforcementPointResolver } from '../src/main/archive-production-policy-runtime.js';

const NOW = asIsoDateTime('2026-08-06T12:00:00.000Z');
const FAMILY_ID = asFamilyId('family-30p-transaction');
const ACCOUNT_ID = asUserId('account-30p-transaction');
const PERSON_ID = asPersonId('person-30p-transaction');
const POLICY_VERSION = '30-p-durable-policy-test-v1';
const FENCE_NAME = 'archive-write';
const clock: Clock = Object.freeze({ now: () => NOW });
const temporaryDirectories: string[] = [];
const activeRuntimes: SqliteFamilyDatabaseRuntime[] = [];
const controlledMonotonicAuthority = Object.freeze({
  checkpointPolicyJournal: async (input: { journalSequence: number; journalHeadHash: string; journalSizeBytes: number }) => Object.freeze({
    schemaVersion: 1 as const,
    authorityEpoch: Math.max(1, input.journalSequence),
    ...input,
    checkpointHash: 'a'.repeat(64),
    acceptedAt: NOW
  })
});

class ControlledSecretProtector {
  public readonly protectionId = '30-p-controlled-secret-protector';
  public readonly required = true;

  public isAvailable(): boolean { return true; }
  public protect(secret: string): string {
    return Buffer.from(`30-p:${secret}`, 'utf8').toString('base64url');
  }
  public unprotect(protectedValue: string): string {
    const opened = Buffer.from(protectedValue, 'base64url').toString('utf8');
    if (!opened.startsWith('30-p:')) throw new Error('CONTROLLED_PROTECTOR_INVALID');
    return opened.slice('30-p:'.length);
  }
}

interface Harness {
  readonly directory: string;
  readonly runtime: SqliteFamilyDatabaseRuntime;
  readonly policyRepository: SqlitePlatformPolicyTransactionRepository;
  readonly archiveRepository: SqliteArchiveRepository;
  readonly auditRepository: SqliteAuditRepository;
  readonly outboxRepository: SqliteOutboxRepository;
}

const repositoryContext = (
  transaction: TransactionContext,
  correlationId = transaction.correlationId
): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: { userId: ACCOUNT_ID, roles: ['family_admin'], personId: PERSON_ID },
  correlationId,
  occurredAt: transaction.occurredAt
});

const governedContext = (
  transaction: TransactionContext,
  authorization: PlatformPolicyTransactionContext
): PolicyAuthorizedRepositoryExecutionContext => ({
  ...repositoryContext(transaction, asCorrelationId(authorization.correlationId)),
  policyAuthorization: authorization
});

const mustValue = <T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown }): T => {
  if (!result.ok) throw new Error(`Unexpected repository failure: ${JSON.stringify(result.error)}`);
  return result.value;
};

const controlledProjectionProof = (
  record: PlatformPolicyReceiptRecord,
  sequence = 1
): PlatformPolicyJournalProjectionProof => Object.freeze({
  schemaVersion: 1,
  receiptHash: computePlatformPolicyReceiptHash(record.receipt),
  recordHash: computePlatformPolicyReceiptRecordHash(record),
  receiptNonce: record.receipt.nonce,
  entrySequence: sequence,
  entryHash: 'b'.repeat(64),
  headSequence: sequence,
  headHash: 'b'.repeat(64),
  journalSizeBytes: 512,
  issuedAt: NOW,
  proofMac: 'c'.repeat(64)
});

const makeHarness = (epoch = 30, writable = true): Harness => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-30p-durable-policy-'));
  temporaryDirectories.push(directory);
  const runtime = new SqliteFamilyDatabaseRuntime({
    databasePath: join(directory, 'family.db'),
    applicationVersion: '30-p-vitest',
    clock,
    skipFileMigrationSafetyBackup: true,
    databaseConfig: { busyTimeoutMs: 5_000, journalMode: 'WAL', synchronous: 'FULL' }
  });
  activeRuntimes.push(runtime);
  const policyRepository = new SqlitePlatformPolicyTransactionRepository();
  const synchronized = runtime.transactionExecutor.execute(
    asCorrelationId('30-p-fence-initialization'),
    (transaction) => policyRepository.synchronizeFence(repositoryContext(transaction), {
      fenceName: FENCE_NAME,
      epoch,
      writable,
      synchronizedAt: NOW
    })
  );
  mustValue(synchronized);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)')
    .run(FAMILY_ID, '30-P Durable Policy Family', NOW);
  return {
    directory,
    runtime,
    policyRepository,
    archiveRepository: new SqliteArchiveRepository(),
    auditRepository: new SqliteAuditRepository(),
    outboxRepository: new SqliteOutboxRepository()
  };
};

const policyKernel = (): PlatformPolicyKernel => new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('30-p-durable-policy-signing-key-for-controlled-tests', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['archive.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

interface PepOptions {
  readonly harness: Harness;
  readonly nonce: string;
  readonly correlationId: string;
  readonly resourceId: string;
  readonly fenceEpoch?: number;
  readonly fenceWritable?: boolean;
  readonly receiptSink?: PlatformPolicyReceiptSink;
  readonly deferAllowedReceiptPersistence?: boolean;
}

const makePep = (options: PepOptions): PlatformPolicyEnforcementPoint => {
  const fenceEpoch = options.fenceEpoch ?? 30;
  const fenceWritable = options.fenceWritable ?? true;
  const sink = options.receiptSink ?? Object.freeze({
    append: (_record: PlatformPolicyReceiptRecord) => undefined,
    ensure: (record: PlatformPolicyReceiptRecord) => controlledProjectionProof(record),
    verifyProjectionProof: () => true
  });
  return new PlatformPolicyEnforcementPoint({
    kernel: policyKernel(),
    authorityResolver: {
      resolve: () => ({
        policyVersion: POLICY_VERSION,
        accountId: ACCOUNT_ID,
        personId: PERSON_ID,
        deviceId: 'device-30p-transaction',
        applicationId: 'windows-desktop',
        deviceTrusted: true,
        membershipActive: true,
        roles: ['family_admin'],
        familyIds: [FAMILY_ID],
        online: true,
        grants: [{
          id: `grant-${options.resourceId}`,
          subjectAccountId: ACCOUNT_ID,
          resourceType: 'archive_item',
          resourceId: options.resourceId,
          actions: ['create'],
          purposes: ['archive'],
          effect: 'allow',
          startsAt: '2026-01-01T00:00:00.000Z'
        }],
        expiresAt: '2026-08-06T12:05:00.000Z'
      })
    },
    resourceResolver: {
      resolve: () => ({
        type: 'archive_item',
        id: options.resourceId,
        familyId: FAMILY_ID,
        ownerPersonId: PERSON_ID,
        sensitivity: 'personal'
      })
    },
    receiptSink: sink,
    replayStore: {
      reserve: (reservation) => {
        const reserved = options.harness.runtime.transactionExecutor.execute(
          asCorrelationId(`${options.correlationId}-replay-reservation`),
          (transaction) => options.harness.policyRepository.reserveReplayNonce(
            repositoryContext(transaction),
            reservation
          )
        );
        return mustValue(reserved);
      }
    },
    clock: () => NOW,
    nonceFactory: () => options.nonce,
    deferAllowedReceiptPersistence: options.deferAllowedReceiptPersistence ?? true
  });
};

interface GovernedWriteOptions {
  readonly nonce: string;
  readonly correlationId: string;
  readonly resourceId: string;
  readonly fenceEpoch?: number;
  readonly rollback?: boolean;
  readonly receiptTransform?: (record: PlatformPolicyReceiptRecord) => PlatformPolicyReceiptRecord;
}

const runGovernedWrite = async (harness: Harness, options: GovernedWriteOptions) => {
  const pep = makePep({
    harness,
    nonce: options.nonce,
    correlationId: options.correlationId,
    resourceId: options.resourceId,
    fenceEpoch: options.fenceEpoch
  });
  return pep.execute({
    correlationId: options.correlationId,
    action: 'create',
    capability: 'archive.write',
    resourceType: 'archive_item',
    resourceId: options.resourceId,
    purpose: 'archive'
  }, () => ({ writable: true, epoch: options.fenceEpoch ?? 30 }), (authorization) =>
    harness.runtime.transactionExecutor.execute(asCorrelationId(options.correlationId), (transaction) => {
      const execution = governedContext(transaction, authorization);
      const record = options.receiptTransform?.(authorization.receiptRecord) ?? authorization.receiptRecord;
      const persisted = harness.policyRepository.recordAuthorizedTransaction(execution, {
        record,
        fenceName: FENCE_NAME,
        fenceEpoch: authorization.fenceEpoch,
        fenceWritable: true
      });
      if (!persisted.ok) return persisted;
      const archive = harness.archiveRepository.insert(execution, {
        id: options.resourceId,
        familyId: FAMILY_ID,
        title: `Archive ${options.resourceId}`,
        originalName: `${options.resourceId}.txt`,
        storedName: `${options.resourceId}.vault`,
        mimeType: 'text/plain',
        sizeBytes: 12,
        sha256: 'a'.repeat(64),
        sensitivity: 'personal',
        aiProcessingAllowed: false,
        createdAt: NOW
      });
      if (!archive.ok) return archive;
      const audit = harness.auditRepository.append(execution, {
        id: `audit-${options.resourceId}`,
        action: 'archive.item.created',
        resourceType: 'archive_item',
        resourceId: options.resourceId,
        occurredAt: NOW,
        actorId: ACCOUNT_ID
      });
      if (!audit.ok) return audit;
      const outbox = harness.outboxRepository.enqueue(execution, {
        eventId: asEventId(`event-${options.resourceId}`),
        eventType: 'archive.item-created',
        eventVersion: 1,
        aggregateType: 'archive_item',
        aggregateId: options.resourceId,
        occurredAt: NOW,
        actorId: ACCOUNT_ID,
        correlationId: asCorrelationId(options.correlationId),
        payload: { archiveItemId: options.resourceId }
      });
      if (!outbox.ok) return outbox;
      if (options.rollback) {
        return err(createAppError({
          code: ERROR_CODES.DATABASE_INTEGRITY_FAILED,
          message: 'Controlled rollback after all governed writes',
          category: 'infrastructure',
          correlationId: asCorrelationId(options.correlationId)
        }));
      }
      return ok({ receiptHash: persisted.value.receiptHash });
    })
  );
};

const counts = (harness: Harness, resourceId: string) => ({
  receipt: Number(harness.runtime.database.prepare(
    'SELECT COUNT(*) AS count FROM platform_policy_transaction_receipts WHERE resource_id=?'
  ).get(resourceId)?.count ?? 0),
  archive: Number(harness.runtime.database.prepare(
    'SELECT COUNT(*) AS count FROM archive_items WHERE id=?'
  ).get(resourceId)?.count ?? 0),
  audit: Number(harness.runtime.database.prepare(
    'SELECT COUNT(*) AS count FROM audit_log WHERE resource_type=? AND resource_id=?'
  ).get('archive_item', resourceId)?.count ?? 0),
  outbox: Number(harness.runtime.database.prepare(
    'SELECT COUNT(*) AS count FROM event_outbox WHERE aggregate_type=? AND aggregate_id=?'
  ).get('archive_item', resourceId)?.count ?? 0),
  projection: Number(harness.runtime.database.prepare(`
    SELECT COUNT(*) AS count FROM platform_policy_journal_projection_outbox projection
    JOIN platform_policy_transaction_receipts receipt USING(receipt_hash)
    WHERE receipt.resource_id=?
  `).get(resourceId)?.count ?? 0)
});

afterEach(() => {
  for (const runtime of activeRuntimes.splice(0)) runtime.close();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('30-P durable archive policy transaction', () => {
  it('persists replay reservations across a real SQLite close and restart', () => {
    const harness = makeHarness();
    const first = harness.runtime.transactionExecutor.execute(
      asCorrelationId('30-p-restart-first'),
      (transaction) => harness.policyRepository.reserveReplayNonce(repositoryContext(transaction), {
        nonce: 'nonce-30p-restart',
        reservedAtMs: Date.parse(NOW),
        expiresAtMs: Date.parse(NOW) + 60_000
      })
    );
    expect(mustValue(first)).toBe(true);
    harness.runtime.close();
    activeRuntimes.splice(activeRuntimes.indexOf(harness.runtime), 1);

    const restarted = new SqliteFamilyDatabaseRuntime({
      databasePath: join(harness.directory, 'family.db'),
      applicationVersion: '30-p-vitest-restart',
      clock,
      skipFileMigrationSafetyBackup: true
    });
    activeRuntimes.push(restarted);
    const repository = new SqlitePlatformPolicyTransactionRepository();
    const replayed = restarted.transactionExecutor.execute(
      asCorrelationId('30-p-restart-second'),
      (transaction) => repository.reserveReplayNonce(repositoryContext(transaction), {
        nonce: 'nonce-30p-restart',
        reservedAtMs: Date.parse(NOW),
        expiresAtMs: Date.parse(NOW) + 60_000
      })
    );
    expect(mustValue(replayed)).toBe(false);
  });

  it('rejects a duplicate durable nonce before a second operation opens', async () => {
    const harness = makeHarness();
    const first = makePep({
      harness,
      nonce: 'nonce-30p-duplicate',
      correlationId: 'corr-30p-duplicate-a',
      resourceId: 'archive-30p-duplicate-a'
    });
    await expect(first.execute({
      correlationId: 'corr-30p-duplicate-a', action: 'create', capability: 'archive.write',
      resourceType: 'archive_item', resourceId: 'archive-30p-duplicate-a', purpose: 'archive'
    }, () => ({ writable: true, epoch: 30 }), () => 'first')).resolves.toBe('first');
    let secondOpened = false;
    const second = makePep({
      harness,
      nonce: 'nonce-30p-duplicate',
      correlationId: 'corr-30p-duplicate-b',
      resourceId: 'archive-30p-duplicate-b'
    });
    await expect(second.execute({
      correlationId: 'corr-30p-duplicate-b', action: 'create', capability: 'archive.write',
      resourceType: 'archive_item', resourceId: 'archive-30p-duplicate-b', purpose: 'archive'
    }, () => ({ writable: true, epoch: 30 }), () => { secondOpened = true; }))
      .rejects.toMatchObject({ code: 'RECEIPT_REPLAYED' });
    expect(secondOpened).toBe(false);
  });

  it('never prunes a replay reservation consumed by a durable receipt', async () => {
    const harness = makeHarness();
    const written = await runGovernedWrite(harness, {
      nonce: 'nonce-30v-consumed',
      correlationId: 'corr-30v-consumed',
      resourceId: 'archive-30v-consumed'
    });
    expect(written.ok).toBe(true);

    const pruned = harness.runtime.transactionExecutor.execute(
      asCorrelationId('30-v-consumed-pruning'),
      (transaction) => harness.policyRepository.pruneExpiredUnusedReplayReservations(
        repositoryContext(transaction),
        { cutoffMs: Date.parse(NOW) + 120_000, limit: 100 }
      )
    );
    expect(mustValue(pruned)).toEqual({
      cutoffMs: Date.parse(NOW) + 120_000,
      prunedCount: 0,
      hasMore: false
    });
    expect(Number(harness.runtime.database.prepare(
      'SELECT COUNT(*) AS count FROM platform_policy_replay_reservations WHERE nonce=?'
    ).get('nonce-30v-consumed')?.count)).toBe(1);
    expect(() => harness.runtime.database.prepare(
      'DELETE FROM platform_policy_replay_reservations WHERE nonce=?'
    ).run('nonce-30v-consumed')).toThrow(/not expired and unused/u);
  });

  it('serializes duplicate correlations at the durable receipt table', async () => {
    const harness = makeHarness();
    const first = await runGovernedWrite(harness, {
      nonce: 'nonce-30p-correlation-a',
      correlationId: 'corr-30p-shared',
      resourceId: 'archive-30p-correlation-a'
    });
    const second = await runGovernedWrite(harness, {
      nonce: 'nonce-30p-correlation-b',
      correlationId: 'corr-30p-shared',
      resourceId: 'archive-30p-correlation-b'
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(Number(harness.runtime.database.prepare(
      'SELECT COUNT(*) AS count FROM platform_policy_transaction_receipts WHERE correlation_id=?'
    ).get('corr-30p-shared')?.count)).toBe(1);
    expect(counts(harness, 'archive-30p-correlation-b')).toEqual({
      receipt: 0, archive: 0, audit: 0, outbox: 0, projection: 0
    });
  });

  it('rejects a stale transaction fence and a same-epoch writable widening', async () => {
    const harness = makeHarness(31, true);
    const stale = await runGovernedWrite(harness, {
      nonce: 'nonce-30p-stale-fence',
      correlationId: 'corr-30p-stale-fence',
      resourceId: 'archive-30p-stale-fence',
      fenceEpoch: 30
    });
    expect(stale.ok).toBe(false);
    expect(counts(harness, 'archive-30p-stale-fence')).toEqual({
      receipt: 0, archive: 0, audit: 0, outbox: 0, projection: 0
    });

    const narrowed = harness.runtime.transactionExecutor.execute(
      asCorrelationId('30-p-fence-narrow'),
      (transaction) => harness.policyRepository.synchronizeFence(repositoryContext(transaction), {
        fenceName: FENCE_NAME,
        epoch: 31,
        writable: false,
        synchronizedAt: asIsoDateTime('2026-08-06T12:00:01.000Z')
      })
    );
    expect(narrowed.ok).toBe(true);
    const widened = harness.runtime.transactionExecutor.execute(
      asCorrelationId('30-p-fence-widen'),
      (transaction) => harness.policyRepository.synchronizeFence(repositoryContext(transaction), {
        fenceName: FENCE_NAME,
        epoch: 31,
        writable: true,
        synchronizedAt: asIsoDateTime('2026-08-06T12:00:02.000Z')
      })
    );
    expect(widened.ok).toBe(false);
  });

  it('commits receipt, archive mutation, immutable audit, outbox and projection atomically', async () => {
    const harness = makeHarness();
    const result = await runGovernedWrite(harness, {
      nonce: 'nonce-30p-atomic-commit',
      correlationId: 'corr-30p-atomic-commit',
      resourceId: 'archive-30p-atomic-commit'
    });
    expect(result.ok).toBe(true);
    expect(counts(harness, 'archive-30p-atomic-commit')).toEqual({
      receipt: 1, archive: 1, audit: 1, outbox: 1, projection: 1
    });
    const binding = harness.runtime.database.prepare(`
      SELECT receipt.receipt_hash,receipt.obligation_execution_hash,
        json_extract(receipt.record_json,'$.obligationExecution.attestationHash') AS record_obligation_execution_hash,
        audit.policy_receipt_hash AS audit_hash,outbox.policy_receipt_hash AS outbox_hash
      FROM platform_policy_transaction_receipts receipt
      JOIN audit_log audit ON audit.resource_type=receipt.resource_type AND audit.resource_id=receipt.resource_id
      JOIN event_outbox outbox ON outbox.aggregate_type=receipt.resource_type AND outbox.aggregate_id=receipt.resource_id
      WHERE receipt.resource_id=?
    `).get('archive-30p-atomic-commit');
    expect(binding?.audit_hash).toBe(binding?.receipt_hash);
    expect(binding?.outbox_hash).toBe(binding?.receipt_hash);
    expect(binding?.obligation_execution_hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(binding?.record_obligation_execution_hash).toBe(binding?.obligation_execution_hash);
  });

  it('rolls back receipt, business mutation, audit, outbox and projection together', async () => {
    const harness = makeHarness();
    const result = await runGovernedWrite(harness, {
      nonce: 'nonce-30p-atomic-rollback',
      correlationId: 'corr-30p-atomic-rollback',
      resourceId: 'archive-30p-atomic-rollback',
      rollback: true
    });
    expect(result.ok).toBe(false);
    expect(counts(harness, 'archive-30p-atomic-rollback')).toEqual({
      receipt: 0, archive: 0, audit: 0, outbox: 0, projection: 0
    });
    expect(Number(harness.runtime.database.prepare(
      'SELECT COUNT(*) AS count FROM platform_policy_replay_reservations WHERE nonce=?'
    ).get('nonce-30p-atomic-rollback')?.count)).toBe(1);
  });

  it('rejects a receipt record whose policy binding was tampered after authorization', async () => {
    const harness = makeHarness();
    const tampered = await runGovernedWrite(harness, {
      nonce: 'nonce-30p-binding-tamper',
      correlationId: 'corr-30p-binding-tamper',
      resourceId: 'archive-30p-binding-tamper',
      receiptTransform: (record) => ({ ...record, resourceId: 'archive-30p-forged-resource' })
    });
    expect(tampered.ok).toBe(false);
    expect(counts(harness, 'archive-30p-binding-tamper')).toEqual({
      receipt: 0, archive: 0, audit: 0, outbox: 0, projection: 0
    });
  });

  it('rejects incomplete or forged audit and outbox policy bindings at SQLite triggers', async () => {
    const harness = makeHarness();
    const committed = await runGovernedWrite(harness, {
      nonce: 'nonce-30p-trigger-binding',
      correlationId: 'corr-30p-trigger-binding',
      resourceId: 'archive-30p-trigger-binding'
    });
    expect(committed.ok).toBe(true);
    const receiptHash = committed.ok ? committed.value.receiptHash : '';
    expect(() => harness.runtime.database.prepare(`
      INSERT INTO audit_log(
        id,action,resource_type,resource_id,occurred_at,
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce
      ) VALUES(?,?,?,?,?,?,?,?)
    `).run(
      'audit-30p-incomplete', 'archive.item.created', 'archive_item', 'archive-30p-incomplete', NOW,
      receiptHash, 1, 'nonce-30p-trigger-binding'
    )).toThrow(/audit policy receipt binding is incomplete or invalid/u);
    expect(() => harness.runtime.database.prepare(`
      INSERT INTO event_outbox(
        id,event_type,event_version,aggregate_type,aggregate_id,payload_json,headers_json,
        occurred_at,available_at,status,attempt_count,
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
        policy_resource_type,policy_resource_id,policy_action,policy_capability
      ) VALUES(?,?,?,?,?,?,?,?,?,'pending',0,?,?,?,?,?,?,?)
    `).run(
      'event-30p-forged', 'archive.item-created', 1, 'archive_item', 'archive-30p-forged', '{}',
      '{"correlationId":"corr-30p-forged"}', NOW, NOW,
      receiptHash, 1, 'nonce-30p-trigger-binding', 'archive_item', 'archive-30p-forged', 'create', 'archive.write'
    )).toThrow(/event outbox policy receipt binding is incomplete or invalid/u);
  });

  it('blocks direct SQL bypass for missing or expired reservations, stale/read-only fences and correlation mismatch', async () => {
    const harness = makeHarness();
    const committed = await runGovernedWrite(harness, {
      nonce: 'nonce-30p-direct-baseline',
      correlationId: 'corr-30p-direct-baseline',
      resourceId: 'archive-30p-direct-baseline'
    });
    expect(committed.ok).toBe(true);
    const base = harness.runtime.database.prepare(
      'SELECT * FROM platform_policy_transaction_receipts WHERE nonce=?'
    ).get('nonce-30p-direct-baseline') as Record<string, unknown>;
    const insert = harness.runtime.database.prepare(`
      INSERT INTO platform_policy_transaction_receipts(
        receipt_hash,receipt_version,request_hash,context_hash,data_classes_json,obligation_execution_hash,nonce,correlation_id,policy_version,
        resource_type,resource_id,action,capability,fence_name,fence_epoch,fence_writable,
        issued_at,recorded_at,record_json
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    const makeCandidate = (suffix: string, overrides: Record<string, unknown> = {}) => {
      const nonce = String(overrides.nonce ?? `nonce-30p-direct-${suffix}`);
      const correlationId = String(overrides.correlation_id ?? `corr-30p-direct-${suffix}`);
      const record = JSON.parse(String(base.record_json)) as PlatformPolicyReceiptRecord;
      const rebound = {
        ...record,
        correlationId,
        request: { ...record.request, correlationId },
        receipt: { ...record.receipt, nonce },
        obligationExecution: record.obligationExecution
          ? { ...record.obligationExecution, receiptNonce: nonce }
          : undefined
      };
      return {
        receipt_hash: String(overrides.receipt_hash ?? createHash('sha256').update(`30-p-${suffix}`).digest('hex')),
        receipt_version: 1,
        request_hash: rebound.receipt.requestHash,
        context_hash: rebound.contextHash,
        data_classes_json: JSON.stringify(rebound.dataClasses),
        obligation_execution_hash: rebound.obligationExecution?.attestationHash,
        nonce,
        correlation_id: correlationId,
        policy_version: rebound.decision.policyVersion,
        resource_type: rebound.resourceType,
        resource_id: rebound.resourceId,
        action: rebound.action,
        capability: rebound.capability,
        fence_name: String(overrides.fence_name ?? FENCE_NAME),
        fence_epoch: Number(overrides.fence_epoch ?? 30),
        fence_writable: Number(overrides.fence_writable ?? 1),
        issued_at: rebound.receipt.issuedAt,
        recorded_at: rebound.recordedAt,
        record_json: String(overrides.record_json ?? JSON.stringify(rebound))
      };
    };
    const executeInsert = (candidate: ReturnType<typeof makeCandidate>) => insert.run(
      candidate.receipt_hash, candidate.receipt_version, candidate.request_hash, candidate.context_hash,
      candidate.data_classes_json, candidate.obligation_execution_hash, candidate.nonce,
      candidate.correlation_id, candidate.policy_version, candidate.resource_type, candidate.resource_id,
      candidate.action, candidate.capability, candidate.fence_name, candidate.fence_epoch,
      candidate.fence_writable, candidate.issued_at, candidate.recorded_at, candidate.record_json
    );

    const missingClassification = makeCandidate('missing-classification');
    expect(() => harness.runtime.database.prepare(`
      INSERT INTO platform_policy_transaction_receipts(
        receipt_hash,receipt_version,request_hash,context_hash,obligation_execution_hash,nonce,correlation_id,policy_version,
        resource_type,resource_id,action,capability,fence_name,fence_epoch,fence_writable,
        issued_at,recorded_at,record_json
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      missingClassification.receipt_hash, missingClassification.receipt_version,
      missingClassification.request_hash, missingClassification.context_hash,
      missingClassification.obligation_execution_hash,
      missingClassification.nonce, missingClassification.correlation_id,
      missingClassification.policy_version, missingClassification.resource_type,
      missingClassification.resource_id, missingClassification.action,
      missingClassification.capability, missingClassification.fence_name,
      missingClassification.fence_epoch, missingClassification.fence_writable,
      missingClassification.issued_at, missingClassification.recorded_at,
      missingClassification.record_json
    )).toThrow(/platform policy data classification is missing or inconsistent/u);

    const missingObligationExecution = makeCandidate('missing-obligation-execution');
    expect(() => harness.runtime.database.prepare(`
      INSERT INTO platform_policy_transaction_receipts(
        receipt_hash,receipt_version,request_hash,context_hash,data_classes_json,nonce,correlation_id,policy_version,
        resource_type,resource_id,action,capability,fence_name,fence_epoch,fence_writable,
        issued_at,recorded_at,record_json
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      missingObligationExecution.receipt_hash, missingObligationExecution.receipt_version,
      missingObligationExecution.request_hash, missingObligationExecution.context_hash,
      missingObligationExecution.data_classes_json, missingObligationExecution.nonce,
      missingObligationExecution.correlation_id, missingObligationExecution.policy_version,
      missingObligationExecution.resource_type, missingObligationExecution.resource_id,
      missingObligationExecution.action, missingObligationExecution.capability,
      missingObligationExecution.fence_name, missingObligationExecution.fence_epoch,
      missingObligationExecution.fence_writable, missingObligationExecution.issued_at,
      missingObligationExecution.recorded_at, missingObligationExecution.record_json
    )).toThrow(/platform policy obligation execution is missing or inconsistent/u);

    expect(() => executeInsert(makeCandidate('missing-reservation'))).toThrow();

    harness.runtime.database.prepare(`
      INSERT INTO platform_policy_replay_reservations(nonce,reserved_at_ms,expires_at_ms)
      VALUES(?,?,?)
    `).run('nonce-30p-direct-expired', Date.parse(NOW) - 20_000, Date.parse(NOW) - 10_000);
    expect(() => executeInsert(makeCandidate('expired')))
      .toThrow(/platform policy receipt, context or database fence mismatch/u);

    harness.runtime.database.prepare(`
      INSERT INTO platform_policy_replay_reservations(nonce,reserved_at_ms,expires_at_ms)
      VALUES(?,?,?)
    `).run('nonce-30p-direct-stale', Date.parse(NOW), Date.parse(NOW) + 60_000);
    expect(() => executeInsert(makeCandidate('stale', { fence_epoch: 29 })))
      .toThrow(/platform policy receipt, context or database fence mismatch/u);

    harness.runtime.database.prepare(`
      INSERT INTO platform_policy_database_fences(fence_name,epoch,writable,synchronized_at)
      VALUES('archive-read-only',30,0,?)
    `).run(NOW);
    harness.runtime.database.prepare(`
      INSERT INTO platform_policy_replay_reservations(nonce,reserved_at_ms,expires_at_ms)
      VALUES(?,?,?)
    `).run('nonce-30p-direct-read-only', Date.parse(NOW), Date.parse(NOW) + 60_000);
    expect(() => executeInsert(makeCandidate('read-only', { fence_name: 'archive-read-only' })))
      .toThrow(/platform policy receipt, context or database fence mismatch/u);

    harness.runtime.database.prepare(`
      INSERT INTO platform_policy_replay_reservations(nonce,reserved_at_ms,expires_at_ms)
      VALUES(?,?,?)
    `).run('nonce-30p-direct-correlation', Date.parse(NOW), Date.parse(NOW) + 60_000);
    const mismatch = makeCandidate('correlation');
    const mismatchRecord = JSON.parse(mismatch.record_json) as PlatformPolicyReceiptRecord;
    expect(() => executeInsert({
      ...mismatch,
      correlation_id: 'corr-30p-direct-column-mismatch',
      record_json: JSON.stringify(mismatchRecord)
    })).toThrow(/platform policy (receipt, context or database fence mismatch|context binding is missing or inconsistent)/u);
  });

  it('lists and acknowledges journal projections idempotently', async () => {
    const harness = makeHarness();
    const committed = await runGovernedWrite(harness, {
      nonce: 'nonce-30p-projection-idempotent',
      correlationId: 'corr-30p-projection-idempotent',
      resourceId: 'archive-30p-projection-idempotent'
    });
    expect(committed.ok).toBe(true);
    const receiptHash = committed.ok ? committed.value.receiptHash : '';
    const pending = harness.runtime.transactionExecutor.execute(
      asCorrelationId('corr-30p-projection-list'),
      (transaction) => harness.policyRepository.listPendingJournalProjections(repositoryContext(transaction))
    );
    expect(mustValue(pending).map((item) => item.receiptHash)).toEqual([receiptHash]);
    const proof = controlledProjectionProof(mustValue(pending)[0]!.record);
    const rejected = harness.runtime.transactionExecutor.execute(
      asCorrelationId('corr-30q-projection-proof-rejected'),
      (transaction) => harness.policyRepository.acknowledgeJournalProjection(repositoryContext(transaction), {
        receiptHash,
        projectedAt: asIsoDateTime('2026-08-06T12:00:00.500Z'),
        proof: { ...proof, recordHash: '0'.repeat(64) }
      })
    );
    expect(rejected.ok).toBe(false);
    expect(() => harness.runtime.database.prepare(`
      UPDATE platform_policy_journal_projection_outbox
      SET status='projected',projected_at=?
      WHERE receipt_hash=?
    `).run('2026-08-06T12:00:00.750Z', receiptHash)).toThrow(/invalid or unbound platform policy journal projection proof/u);
    const first = harness.runtime.transactionExecutor.execute(
      asCorrelationId('corr-30p-projection-ack-a'),
      (transaction) => harness.policyRepository.acknowledgeJournalProjection(repositoryContext(transaction), {
        receiptHash,
        projectedAt: asIsoDateTime('2026-08-06T12:00:01.000Z'),
        proof
      })
    );
    const second = harness.runtime.transactionExecutor.execute(
      asCorrelationId('corr-30p-projection-ack-b'),
      (transaction) => harness.policyRepository.acknowledgeJournalProjection(repositoryContext(transaction), {
        receiptHash,
        projectedAt: asIsoDateTime('2026-08-06T12:00:02.000Z'),
        proof
      })
    );
    expect(mustValue(first)).toBe(true);
    expect(mustValue(second)).toBe(false);
    const anchor = harness.runtime.transactionExecutor.execute(
      asCorrelationId('corr-30q-projection-anchor-read'),
      (transaction) => harness.policyRepository.readJournalAnchor(repositoryContext(transaction))
    );
    expect(mustValue(anchor)).toEqual({
      anchorName: 'archive-protected-receipt-journal',
      proof,
      anchoredAt: '2026-08-06T12:00:01.000Z'
    });
    const remaining = harness.runtime.transactionExecutor.execute(
      asCorrelationId('corr-30p-projection-list-after'),
      (transaction) => harness.policyRepository.listPendingJournalProjections(repositoryContext(transaction))
    );
    expect(mustValue(remaining)).toEqual([]);
  });

  it('keeps allowed receipt persistence deferred until exact ensure projection', async () => {
    const harness = makeHarness();
    const appended: PlatformPolicyReceiptRecord[] = [];
    const ensured: PlatformPolicyReceiptRecord[] = [];
    const sink: PlatformPolicyReceiptSink = {
      append: (record) => { appended.push(record); },
      ensure: (record) => {
        ensured.push(record);
        return controlledProjectionProof(record);
      },
      verifyProjectionProof: () => true
    };
    const pep = makePep({
      harness,
      nonce: 'nonce-30p-deferred',
      correlationId: 'corr-30p-deferred',
      resourceId: 'archive-30p-deferred',
      receiptSink: sink,
      deferAllowedReceiptPersistence: true
    });
    let authorizedRecord: PlatformPolicyReceiptRecord | undefined;
    await pep.execute({
      correlationId: 'corr-30p-deferred', action: 'create', capability: 'archive.write',
      resourceType: 'archive_item', resourceId: 'archive-30p-deferred', purpose: 'archive'
    }, () => ({ writable: true, epoch: 30 }), (authorization) => {
      authorizedRecord = authorization.receiptRecord;
      return 'committed';
    });
    expect(appended).toEqual([]);
    expect(ensured).toEqual([]);
    expect(authorizedRecord).toBeDefined();
    await sink.ensure!(authorizedRecord!);
    expect(ensured).toEqual([authorizedRecord]);
  });

  it('recovers a crash-left pending projection before attempting new production authority', async () => {
    const harness = makeHarness();
    const committed = await runGovernedWrite(harness, {
      nonce: 'nonce-30p-crash-recovery',
      correlationId: 'corr-30p-crash-recovery',
      resourceId: 'archive-30p-crash-recovery'
    });
    expect(committed.ok).toBe(true);
    const ensured: PlatformPolicyReceiptRecord[] = [];
    const unavailable = err(createAppError({
      code: ERROR_CODES.AUTHORIZATION_DENIED,
      message: 'Controlled authority stop after pending projection recovery',
      category: 'authorization',
      correlationId: asCorrelationId('corr-30p-recovery-resolve')
    }));
    const resolver = createArchiveProductionPolicyEnforcementPointResolver({
      transactionExecutor: harness.runtime.transactionExecutor,
      accountRepository: { findById: () => unavailable } as never,
      permissionRepository: { listActiveForSubject: () => unavailable } as never,
      trustedDeviceRepository: { findActive: () => unavailable } as never,
      archiveRepository: { findForPolicyResolution: () => unavailable } as never,
      personRepository: { findById: () => unavailable } as never,
      deviceIdentityProvider: {
        snapshot: () => ({
          deviceId: 'device-30p-recovery',
          fingerprint: 'fingerprint-30p-recovery',
          publicKeyPem: '-----BEGIN PUBLIC KEY-----\n30-P\n-----END PUBLIC KEY-----'
        })
      } as never,
      authorizationProvider: {
        authorize: () => { throw new Error('NOT_REACHED'); },
        verify: () => true
      },
      receiptSink: {
        append: () => { throw new Error('ALLOWED_RECEIPT_MUST_STAY_DEFERRED'); },
        ensure: (record) => {
          ensured.push(record);
          return controlledProjectionProof(record);
        },
        verifyProjectionProof: () => true
      },
      policyTransactionRepository: harness.policyRepository,
      clusterFence: () => ({ writable: true, epoch: 30 }),
      policyVersion: POLICY_VERSION,
      clock
    });
    await expect(resolver.resolve({
      familyId: FAMILY_ID,
      actor: { userId: ACCOUNT_ID, personId: PERSON_ID, role: 'family_admin' },
      correlationId: asCorrelationId('corr-30p-recovery-resolve')
    })).rejects.toMatchObject({ code: 'AUTHORITY_RESOLUTION_FAILED' });
    expect(ensured).toHaveLength(1);
    expect(ensured[0]?.receipt.nonce).toBe('nonce-30p-crash-recovery');
    const remaining = harness.runtime.transactionExecutor.execute(
      asCorrelationId('corr-30p-recovery-check'),
      (transaction) => harness.policyRepository.listPendingJournalProjections(repositoryContext(transaction))
    );
    expect(mustValue(remaining)).toEqual([]);
  });

  it('keeps startup projection pending and fails closed when trusted receipt verification is false or throws', async () => {
    for (const scenario of ['false', 'throw'] as const) {
      const harness = makeHarness();
      const nonce = `nonce-30p-recovery-verification-${scenario}`;
      const committed = await runGovernedWrite(harness, {
        nonce,
        correlationId: `corr-30p-recovery-verification-${scenario}`,
        resourceId: `archive-30p-recovery-verification-${scenario}`
      });
      expect(committed.ok, scenario).toBe(true);
      let ensureCalls = 0;
      const resolver = createArchiveProductionPolicyEnforcementPointResolver({
        transactionExecutor: harness.runtime.transactionExecutor,
        accountRepository: { findById: () => { throw new Error('NOT_REACHED'); } } as never,
        permissionRepository: { listActiveForSubject: () => { throw new Error('NOT_REACHED'); } } as never,
        trustedDeviceRepository: { findActive: () => { throw new Error('NOT_REACHED'); } } as never,
        archiveRepository: { findForPolicyResolution: () => { throw new Error('NOT_REACHED'); } } as never,
        personRepository: { findById: () => { throw new Error('NOT_REACHED'); } } as never,
        deviceIdentityProvider: { snapshot: () => { throw new Error('NOT_REACHED'); } } as never,
        authorizationProvider: {
          authorize: () => { throw new Error('NOT_REACHED'); },
          verify: () => {
            if (scenario === 'throw') throw new Error('CONTROLLED_TRUSTED_VERIFY_FAILURE');
            return false;
          }
        },
        receiptSink: {
          append: () => { throw new Error('NOT_REACHED'); },
          ensure: (record) => {
            ensureCalls += 1;
            return controlledProjectionProof(record);
          },
          verifyProjectionProof: () => true
        },
        policyTransactionRepository: harness.policyRepository,
        clusterFence: () => ({ writable: true, epoch: 30 }),
        policyVersion: POLICY_VERSION,
        clock
      });
      await expect(resolver.resolve({
        familyId: FAMILY_ID,
        actor: { userId: ACCOUNT_ID, personId: PERSON_ID, role: 'family_admin' },
        correlationId: asCorrelationId(`corr-30p-recovery-verify-${scenario}`)
      }), scenario).rejects.toMatchObject({ code: 'RECEIPT_PERSISTENCE_FAILED' });
      expect(ensureCalls, scenario).toBe(0);
      const pending = harness.runtime.transactionExecutor.execute(
        asCorrelationId(`corr-30p-recovery-pending-${scenario}`),
        (transaction) => harness.policyRepository.listPendingJournalProjections(repositoryContext(transaction))
      );
      expect(mustValue(pending).map((item) => item.record.receipt.nonce), scenario).toContain(nonce);
    }
  });

  it('makes protected journal ensure exact-idempotent and rejects same-nonce tamper', async () => {
    const harness = makeHarness();
    const firstPep = makePep({
      harness,
      nonce: 'nonce-30p-journal-exact',
      correlationId: 'corr-30p-journal-exact',
      resourceId: 'archive-30p-journal-exact'
    });
    let record: PlatformPolicyReceiptRecord | undefined;
    await firstPep.execute({
      correlationId: 'corr-30p-journal-exact', action: 'create', capability: 'archive.write',
      resourceType: 'archive_item', resourceId: 'archive-30p-journal-exact', purpose: 'archive'
    }, () => ({ writable: true, epoch: 30 }), (authorization) => { record = authorization.receiptRecord; });
    const protector = new ControlledSecretProtector();
    const protectedStore = new ProtectedSideArtifactStore({
      keyPath: join(harness.directory, 'keys', 'journal-data-key.json'),
      applicationVersion: '4.8.2026-29',
      protector,
      now: () => NOW
    });
    const sink = new PlatformPolicyReceiptFileSink({
      filePath: join(harness.directory, 'journal', 'receipts.jsonl'),
      macKeyPath: join(harness.directory, 'keys', 'journal-mac-key.json'),
      macKeyProtector: protector,
      protectedArtifactStore: protectedStore,
      monotonicAuthority: controlledMonotonicAuthority
    });
    try {
      const firstProof = await sink.ensure(record!);
      const secondProof = await sink.ensure(record!);
      expect(firstProof.receiptHash).toBe(computePlatformPolicyReceiptHash(record!.receipt));
      expect(firstProof.recordHash).toBe(computePlatformPolicyReceiptRecordHash(record!));
      expect(firstProof.entrySequence).toBe(1);
      expect(firstProof.headSequence).toBe(1);
      expect(firstProof.proofMac).toMatch(/^[0-9a-f]{64}$/u);
      expect(sink.verifyProjectionProof(firstProof)).toBe(true);
      expect(sink.verifyProjectionProof(secondProof)).toBe(true);
      expect(sink.verifyProjectionProof({ ...firstProof, proofMac: '0'.repeat(64) })).toBe(false);
      expect(sink.verifyProjectionProof({ ...firstProof, recordHash: '0'.repeat(64) })).toBe(false);
      expect(sink.inspectForControlledTest().entryCount).toBe(1);
      await expect(sink.ensure({
        ...record!,
        decision: { ...record!.decision, obligations: [{ type: 'no_export' }] },
        receipt: {
          ...record!.receipt,
          decision: { ...record!.receipt.decision, obligations: [{ type: 'no_export' }] }
        }
      })).rejects.toThrow(/POLICY_RECEIPT_JOURNAL_NONCE_REPLAY/u);
      expect(computePlatformPolicyReceiptHash(record!.receipt)).toMatch(/^[0-9a-f]{64}$/u);
      const unicodeReceipt = {
        ...record!.receipt,
        signature: `imza-İ-🚀-${String.fromCharCode(0xd800)}-${record!.receipt.signature}`
      };
      expect(computePlatformPolicyReceiptHash(unicodeReceipt)).toBe(
        createHash('sha256').update(canonicalPlatformPolicyJson(unicodeReceipt), 'utf8').digest('hex')
      );
      expect(sink.inspectForControlledTest().entryCount).toBe(1);
    } finally {
      sink.dispose();
      protectedStore.dispose();
    }
  });

  it('recovers a dead projection lock and only an incomplete journal tail with forensic evidence', async () => {
    const harness = makeHarness();
    const records: PlatformPolicyReceiptRecord[] = [];
    for (const suffix of ['first', 'second']) {
      const pep = makePep({
        harness,
        nonce: `nonce-30p-journal-crash-${suffix}`,
        correlationId: `corr-30p-journal-crash-${suffix}`,
        resourceId: `archive-30p-journal-crash-${suffix}`
      });
      await pep.execute({
        correlationId: `corr-30p-journal-crash-${suffix}`,
        action: 'create',
        capability: 'archive.write',
        resourceType: 'archive_item',
        resourceId: `archive-30p-journal-crash-${suffix}`,
        purpose: 'archive'
      }, () => ({ writable: true, epoch: 30 }), (authorization) => {
        records.push(authorization.receiptRecord);
      });
    }

    const protector = new ControlledSecretProtector();
    const protectedStore = new ProtectedSideArtifactStore({
      keyPath: join(harness.directory, 'keys', 'journal-crash-data-key.json'),
      applicationVersion: '4.8.2026-29',
      protector,
      now: () => NOW
    });
    const journalDirectory = join(harness.directory, 'journal-crash');
    const journalPath = join(journalDirectory, 'receipts.jsonl');
    const sink = new PlatformPolicyReceiptFileSink({
      filePath: journalPath,
      macKeyPath: join(harness.directory, 'keys', 'journal-crash-mac-key.json'),
      macKeyProtector: protector,
      protectedArtifactStore: protectedStore,
      monotonicAuthority: controlledMonotonicAuthority
    });
    try {
      await sink.ensure(records[0]!);
      appendFileSync(journalPath, '{"schemaVersion":2,"sequence":2', 'utf8');
      writeFileSync(`${journalPath}.lock`, `2147483646:${'a'.repeat(32)}\n`, 'utf8');

      await sink.ensure(records[1]!);

      expect(sink.inspectForControlledTest().entryCount).toBe(2);
      expect(readdirSync(journalDirectory).some((name) => (
        name.startsWith('receipts.jsonl.partial-tail.') && name.endsWith('.recovery')
      ))).toBe(true);
    } finally {
      sink.dispose();
      protectedStore.dispose();
    }
  });

  it('detects rollback to an older internally valid complete journal tail from the SQLite anchor', async () => {
    const harness = makeHarness();
    for (const suffix of ['first', 'second']) {
      const committed = await runGovernedWrite(harness, {
        nonce: `nonce-30q-complete-tail-${suffix}`,
        correlationId: `corr-30q-complete-tail-${suffix}`,
        resourceId: `archive-30q-complete-tail-${suffix}`
      });
      expect(committed.ok, suffix).toBe(true);
    }
    const pending = harness.runtime.transactionExecutor.execute(
      asCorrelationId('corr-30q-complete-tail-pending'),
      (transaction) => harness.policyRepository.listPendingJournalProjections(repositoryContext(transaction))
    );
    const projections = mustValue(pending);
    expect(projections).toHaveLength(2);

    const protector = new ControlledSecretProtector();
    const protectedStore = new ProtectedSideArtifactStore({
      keyPath: join(harness.directory, 'keys', 'journal-rollback-data-key.json'),
      applicationVersion: '4.8.2026-29',
      protector,
      now: () => NOW
    });
    const journalPath = join(harness.directory, 'journal-rollback', 'receipts.jsonl');
    const sink = new PlatformPolicyReceiptFileSink({
      filePath: journalPath,
      macKeyPath: join(harness.directory, 'keys', 'journal-rollback-mac-key.json'),
      macKeyProtector: protector,
      protectedArtifactStore: protectedStore,
      monotonicAuthority: controlledMonotonicAuthority
    });
    try {
      const firstProof = await sink.ensure(projections[0]!.record);
      const firstCompleteTail = readFileSync(journalPath);
      const firstAck = harness.runtime.transactionExecutor.execute(
        asCorrelationId('corr-30q-complete-tail-ack-first'),
        (transaction) => harness.policyRepository.acknowledgeJournalProjection(repositoryContext(transaction), {
          receiptHash: projections[0]!.receiptHash,
          projectedAt: NOW,
          proof: firstProof
        })
      );
      expect(mustValue(firstAck)).toBe(true);

      const secondProof = await sink.ensure(projections[1]!.record);
      const secondAck = harness.runtime.transactionExecutor.execute(
        asCorrelationId('corr-30q-complete-tail-ack-second'),
        (transaction) => harness.policyRepository.acknowledgeJournalProjection(repositoryContext(transaction), {
          receiptHash: projections[1]!.receiptHash,
          projectedAt: NOW,
          proof: secondProof
        })
      );
      expect(mustValue(secondAck)).toBe(true);
      const anchored = harness.runtime.transactionExecutor.execute(
        asCorrelationId('corr-30q-complete-tail-anchor'),
        (transaction) => harness.policyRepository.readJournalAnchor(repositoryContext(transaction))
      );
      expect(mustValue(anchored)?.proof).toEqual(secondProof);
      expect(sink.verifyProjectionProof(secondProof)).toBe(true);

      writeFileSync(journalPath, firstCompleteTail);
      expect(sink.inspectForControlledTest()).toMatchObject({ valid: true, entryCount: 1 });
      expect(sink.verifyProjectionProof(firstProof)).toBe(true);
      expect(sink.verifyProjectionProof(secondProof)).toBe(false);

      const resolver = createArchiveProductionPolicyEnforcementPointResolver({
        transactionExecutor: harness.runtime.transactionExecutor,
        accountRepository: { findById: () => { throw new Error('NOT_REACHED'); } } as never,
        permissionRepository: { listActiveForSubject: () => { throw new Error('NOT_REACHED'); } } as never,
        trustedDeviceRepository: { findActive: () => { throw new Error('NOT_REACHED'); } } as never,
        archiveRepository: { findForPolicyResolution: () => { throw new Error('NOT_REACHED'); } } as never,
        personRepository: { findById: () => { throw new Error('NOT_REACHED'); } } as never,
        deviceIdentityProvider: { snapshot: () => { throw new Error('NOT_REACHED'); } } as never,
        authorizationProvider: {
          authorize: () => { throw new Error('NOT_REACHED'); },
          verify: () => true
        },
        receiptSink: sink,
        policyTransactionRepository: harness.policyRepository,
        clusterFence: () => ({ writable: true, epoch: 30 }),
        policyVersion: POLICY_VERSION,
        clock
      });
      await expect(resolver.resolve({
        familyId: FAMILY_ID,
        actor: { userId: ACCOUNT_ID, personId: PERSON_ID, role: 'family_admin' },
        correlationId: asCorrelationId('corr-30q-complete-tail-restart')
      })).rejects.toMatchObject({ code: 'RECEIPT_PERSISTENCE_FAILED' });
    } finally {
      sink.dispose();
      protectedStore.dispose();
    }
  });
});
