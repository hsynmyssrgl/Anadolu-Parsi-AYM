import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  type Clock
} from '@ppt/core';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  type PlatformPolicyTransactionContext,
  type PolicyAction
} from '@ppt/platform-policy';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult,
  TransactionContext
} from '@ppt/repository-contracts';
import {
  SqliteArchiveRepository,
  SqlitePlatformPolicyTransactionRepository,
  computePlatformPolicyReceiptHash
} from '@ppt/repositories';
import { SqliteFamilyDatabaseRuntime } from '../src/main/family-database-runtime.js';

const NOW = asIsoDateTime('2026-08-07T00:20:00.000Z');
const FAMILY_ID = asFamilyId('family-30s-accessory-fence');
const ACCOUNT_ID = asUserId('account-30s-accessory-fence');
const PERSON_ID = asPersonId('person-30s-accessory-fence');
const POLICY_VERSION = '30-s-archive-accessory-receipt-fence-v1';
const FENCE_NAME = 'archive-write';
const clock: Clock = Object.freeze({ now: () => NOW });
const temporaryDirectories: string[] = [];
const activeRuntimes: SqliteFamilyDatabaseRuntime[] = [];

type ArchivePolicyResourceType = 'archive_item' | 'archive_retention_policy' | 'archive_category';

interface Harness {
  readonly runtime: SqliteFamilyDatabaseRuntime;
  readonly policyRepository: SqlitePlatformPolicyTransactionRepository;
  readonly archiveRepository: SqliteArchiveRepository;
}

interface ReceiptBinding {
  readonly receiptHash: string;
  readonly receiptVersion: 1;
  readonly nonce: string;
  readonly correlationId: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly action: PolicyAction;
  readonly capability: string;
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

const bindingOf = (authorization: PlatformPolicyTransactionContext): ReceiptBinding => ({
  receiptHash: computePlatformPolicyReceiptHash(authorization.receipt),
  receiptVersion: authorization.receipt.receiptVersion,
  nonce: authorization.receipt.nonce,
  correlationId: authorization.correlationId,
  resourceType: authorization.resourceType,
  resourceId: authorization.resourceId,
  action: authorization.action,
  capability: authorization.capability
});

const insertEvent = (
  harness: Harness,
  eventId: string,
  attachmentCount = 0
): void => {
  harness.runtime.database.prepare(`
    INSERT INTO events(
      id,family_id,kind,title,start_at,visibility,participant_person_ids,
      attachment_count,ai_processing_allowed,recurrence,reminder_days,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    eventId,FAMILY_ID,'family','30-S event',NOW,'family','[]',attachmentCount,0,
    'none','[]',NOW,NOW
  );
};

const makeHarness = (): Harness => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-30s-archive-accessory-fence-'));
  temporaryDirectories.push(directory);
  const runtime = new SqliteFamilyDatabaseRuntime({
    databasePath: join(directory, 'family.db'),
    applicationVersion: '30-s-vitest',
    clock,
    skipFileMigrationSafetyBackup: true,
    databaseConfig: { busyTimeoutMs: 5_000, journalMode: 'WAL', synchronous: 'FULL' }
  });
  activeRuntimes.push(runtime);
  const policyRepository = new SqlitePlatformPolicyTransactionRepository();
  const synchronized = runtime.transactionExecutor.execute(
    asCorrelationId('30-s-fence-initialization'),
    (transaction) => policyRepository.synchronizeFence(repositoryContext(transaction), {
      fenceName: FENCE_NAME,
      epoch: 30,
      writable: true,
      synchronizedAt: NOW
    })
  );
  expect(synchronized.ok).toBe(true);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)')
    .run(FAMILY_ID, '30-S Accessory Fence Family', NOW);
  return {
    runtime,
    policyRepository,
    archiveRepository: new SqliteArchiveRepository()
  };
};

const policyKernel = (): PlatformPolicyKernel => new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('30-s-archive-accessory-receipt-fence-test-key', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['archive.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

const withReceipt = async (
  harness: Harness,
  input: {
    readonly correlationId: string;
    readonly nonce: string;
    readonly resourceType: ArchivePolicyResourceType;
    readonly resourceId: string;
    readonly action: 'create' | 'update';
  },
  operation: (
    context: PolicyAuthorizedRepositoryExecutionContext,
    binding: ReceiptBinding
  ) => RepositoryResult<void>
): Promise<ReceiptBinding> => {
  const pep = new PlatformPolicyEnforcementPoint({
    kernel: policyKernel(),
    authorityResolver: {
      resolve: () => ({
        policyVersion: POLICY_VERSION,
        accountId: ACCOUNT_ID,
        personId: PERSON_ID,
        deviceId: 'device-30s-accessory-fence',
        applicationId: 'windows-desktop',
        deviceTrusted: true,
        membershipActive: true,
        roles: ['family_admin'],
        familyIds: [FAMILY_ID],
        online: true,
        grants: [{
          id: `grant-${input.correlationId}`,
          subjectAccountId: ACCOUNT_ID,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          actions: [input.action],
          purposes: ['archive'],
          effect: 'allow',
          startsAt: '2026-01-01T00:00:00.000Z'
        }],
        expiresAt: '2026-08-07T00:25:00.000Z'
      })
    },
    resourceResolver: {
      resolve: () => ({
        type: input.resourceType,
        id: input.resourceId,
        familyId: FAMILY_ID,
        ownerPersonId: PERSON_ID,
        sensitivity: 'personal'
      })
    },
    receiptSink: { append: () => undefined, ensure: () => undefined },
    replayStore: {
      reserve: (reservation) => {
        const reserved = harness.runtime.transactionExecutor.execute(
          asCorrelationId(`${input.correlationId}-reservation`),
          (transaction) => harness.policyRepository.reserveReplayNonce(
            repositoryContext(transaction),
            reservation
          )
        );
        if (!reserved.ok) throw new Error(reserved.error.message);
        return reserved.value;
      }
    },
    clock: () => NOW,
    nonceFactory: () => input.nonce,
    deferAllowedReceiptPersistence: true
  });
  let captured: ReceiptBinding | undefined;
  const result = await pep.execute({
    correlationId: input.correlationId,
    action: input.action,
    capability: 'archive.write',
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    purpose: 'archive'
  }, () => ({ writable: true, epoch: 30 }), (authorization) =>
    harness.runtime.transactionExecutor.execute(asCorrelationId(input.correlationId), (transaction) => {
      const context = governedContext(transaction, authorization);
      const persisted = harness.policyRepository.recordAuthorizedTransaction(context, {
        record: authorization.receiptRecord,
        fenceName: FENCE_NAME,
        fenceEpoch: authorization.fenceEpoch,
        fenceWritable: true
      });
      if (!persisted.ok) return persisted;
      captured = bindingOf(authorization);
      return operation(context, captured);
    })
  );
  expect(result.ok).toBe(true);
  expect(captured).toBeDefined();
  return captured!;
};

afterEach(() => {
  for (const runtime of activeRuntimes.splice(0)) runtime.close();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('30-S archive accessory-table and event attachment receipt fence', () => {
  it('binds all governed accessory writes and rejects direct SQL bypass and replay', async () => {
    const harness = makeHarness();

    const retentionBinding = await withReceipt(harness, {
      correlationId: 'corr-30s-retention',
      nonce: 'nonce-30s-retention',
      resourceType: 'archive_retention_policy',
      resourceId: 'retention-30s',
      action: 'create'
    }, (context) => harness.archiveRepository.insertRetentionPolicy(context, {
      id: 'retention-30s',
      name: '30-S retention',
      retentionDays: 365,
      secureDestroy: true,
      createdAt: NOW
    }));

    const categoryBinding = await withReceipt(harness, {
      correlationId: 'corr-30s-category',
      nonce: 'nonce-30s-category',
      resourceType: 'archive_category',
      resourceId: 'category-30s',
      action: 'create'
    }, (context) => harness.archiveRepository.insertCategory(context, {
      id: 'category-30s',
      name: '30-S category',
      description: 'Governed category',
      createdAt: NOW
    }));

    const itemId = 'archive-30s-classification';
    await withReceipt(harness, {
      correlationId: 'corr-30s-item-create',
      nonce: 'nonce-30s-item-create',
      resourceType: 'archive_item',
      resourceId: itemId,
      action: 'create'
    }, (context) => harness.archiveRepository.insert(context, {
      id: itemId,
      familyId: FAMILY_ID,
      title: '30-S classified item',
      originalName: 'classification.txt',
      storedName: 'classification.vault',
      mimeType: 'text/plain',
      sizeBytes: 16,
      sha256: 'a'.repeat(64),
      sensitivity: 'personal',
      aiProcessingAllowed: false,
      createdAt: NOW
    }));

    await withReceipt(harness, {
      correlationId: 'corr-30s-classification-one',
      nonce: 'nonce-30s-classification-one',
      resourceType: 'archive_item',
      resourceId: itemId,
      action: 'update'
    }, (context) => harness.archiveRepository.updateClassification(context, {
      itemId,
      categoryId: 'category-30s',
      sensitivity: 'personal',
      aiProcessingAllowed: false,
      tags: [{ id: 'tag-30s-existing', name: 'Family' }]
    }));

    const secondClassificationBinding = await withReceipt(harness, {
      correlationId: 'corr-30s-classification-two',
      nonce: 'nonce-30s-classification-two',
      resourceType: 'archive_item',
      resourceId: itemId,
      action: 'update'
    }, (context) => harness.archiveRepository.updateClassification(context, {
      itemId,
      categoryId: 'category-30s',
      sensitivity: 'high',
      aiProcessingAllowed: false,
      tags: [
        { id: 'tag-30s-proposed-existing', name: 'Family' },
        { id: 'tag-30s-new', name: 'Archive' }
      ]
    }));

    const tags = harness.runtime.database.prepare(`
      SELECT tag.id,tag.name,relation.policy_receipt_hash
      FROM archive_item_tags relation
      JOIN archive_tags tag ON tag.id=relation.tag_id
      WHERE relation.archive_item_id=?
      ORDER BY tag.name
    `).all(itemId) as Array<Record<string, unknown>>;
    expect(tags.map((row) => `${row.id}:${row.name}`)).toEqual([
      'tag-30s-new:Archive',
      'tag-30s-existing:Family'
    ]);
    expect(tags.every((row) => row.policy_receipt_hash === secondClassificationBinding.receiptHash)).toBe(true);
    const batches = harness.runtime.database.prepare(`
      SELECT status,count(*) count FROM platform_policy_archive_classification_batches GROUP BY status
    `).all() as Array<Record<string, unknown>>;
    expect(batches).toEqual([{ status: 'sealed', count: 2 }]);

    insertEvent(harness, 'event-30s-linked');
    insertEvent(harness, 'event-30s-cross-target');
    const linkedItemId = 'archive-30s-linked';
    const linkedBinding = await withReceipt(harness, {
      correlationId: 'corr-30s-linked-item',
      nonce: 'nonce-30s-linked-item',
      resourceType: 'archive_item',
      resourceId: linkedItemId,
      action: 'create'
    }, (context) => {
      const inserted = harness.archiveRepository.insert(context, {
        id: linkedItemId,
        familyId: FAMILY_ID,
        title: '30-S linked item',
        originalName: 'linked.txt',
        storedName: 'linked.vault',
        mimeType: 'text/plain',
        sizeBytes: 12,
        sha256: 'b'.repeat(64),
        linkedEventId: 'event-30s-linked',
        sensitivity: 'standard',
        aiProcessingAllowed: false,
        createdAt: NOW
      });
      return inserted.ok
        ? harness.archiveRepository.incrementEventAttachment(context, 'event-30s-linked')
        : inserted;
    });
    const linkedEvent = harness.runtime.database.prepare(`
      SELECT attachment_count,policy_receipt_hash,policy_resource_id FROM events WHERE id=?
    `).get('event-30s-linked') as Record<string, unknown>;
    expect(linkedEvent).toMatchObject({
      attachment_count: 1,
      policy_receipt_hash: linkedBinding.receiptHash,
      policy_resource_id: linkedItemId
    });

    expect(() => harness.runtime.database.prepare(`
      INSERT INTO archive_retention_policies(id,name,retention_days,secure_destroy,created_at)
      VALUES(?,?,?,?,?)
    `).run('retention-30s-direct', 'Direct retention', 30, 1, NOW))
      .toThrow(/fresh exact policy receipt/u);
    expect(() => harness.runtime.database.prepare(`
      INSERT INTO archive_categories(id,name,description,created_at) VALUES(?,?,?,?)
    `).run('category-30s-direct', 'Direct category', null, NOW))
      .toThrow(/fresh exact policy receipt/u);
    expect(() => harness.runtime.database.prepare(`
      INSERT INTO archive_tags(id,name,created_at) VALUES(?,?,?)
    `).run('tag-30s-direct', 'Direct tag', NOW))
      .toThrow(/open exact classification receipt batch/u);
    expect(() => harness.runtime.database.prepare(`
      INSERT INTO archive_item_tags(archive_item_id,tag_id) VALUES(?,?)
    `).run(itemId, 'tag-30s-existing'))
      .toThrow(/desired relation in an open exact classification receipt batch/u);
    expect(() => harness.runtime.database.prepare(`
      DELETE FROM archive_item_tags WHERE archive_item_id=? AND tag_id=?
    `).run(itemId, 'tag-30s-existing'))
      .toThrow(/open exact classification receipt batch/u);
    expect(() => harness.runtime.database.prepare(`
      UPDATE events SET attachment_count=attachment_count+1 WHERE id=?
    `).run('event-30s-linked'))
      .toThrow(/fresh exact linked archive item receipt/u);
    expect(() => insertEvent(harness, 'event-30s-nonzero', 1))
      .toThrow(/initial attachment count must be zero/u);

    expect(() => harness.runtime.database.prepare(`
      INSERT INTO archive_categories(
        id,name,description,created_at,policy_receipt_hash,policy_receipt_version,
        policy_receipt_nonce,policy_correlation_id,policy_resource_type,
        policy_resource_id,policy_action,policy_capability
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      'category-30s-cross-resource','Cross-resource category',null,NOW,
      categoryBinding.receiptHash,categoryBinding.receiptVersion,categoryBinding.nonce,
      categoryBinding.correlationId,categoryBinding.resourceType,categoryBinding.resourceId,
      categoryBinding.action,categoryBinding.capability
    )).toThrow(/fresh exact policy receipt/u);
    expect(() => harness.runtime.database.prepare(`
      UPDATE events SET attachment_count=attachment_count+1,
        policy_receipt_hash=?,policy_receipt_version=?,policy_receipt_nonce=?,
        policy_correlation_id=?,policy_resource_type=?,policy_resource_id=?,
        policy_action=?,policy_capability=? WHERE id=?
    `).run(
      linkedBinding.receiptHash,linkedBinding.receiptVersion,linkedBinding.nonce,
      linkedBinding.correlationId,linkedBinding.resourceType,linkedBinding.resourceId,
      linkedBinding.action,linkedBinding.capability,'event-30s-cross-target'
    )).toThrow(/fresh exact linked archive item receipt/u);

    const unrelatedTimelineUpdate = harness.runtime.database.prepare(`
      UPDATE events SET title=? WHERE id=?
    `).run('Timeline update remains independent', 'event-30s-linked');
    expect(unrelatedTimelineUpdate.changes).toBe(1);

    const accessoryLedger = harness.runtime.database.prepare(`
      SELECT table_name,operation,row_id,related_row_id
      FROM platform_policy_archive_accessory_mutations
      ORDER BY rowid
    `).all() as Array<Record<string, unknown>>;
    expect(accessoryLedger).toHaveLength(13);
    expect(accessoryLedger.some((row) => row.table_name === 'archive_retention_policies')).toBe(true);
    expect(accessoryLedger.some((row) => row.table_name === 'archive_categories')).toBe(true);
    expect(accessoryLedger.filter((row) => row.table_name === 'archive_tags')).toHaveLength(2);
    expect(accessoryLedger.filter((row) => row.table_name === 'archive_item_tags' && row.operation === 'delete')).toHaveLength(1);
    expect(accessoryLedger.filter((row) => row.table_name === 'archive_item_tags' && row.operation === 'insert')).toHaveLength(3);
    expect(accessoryLedger.filter((row) => row.table_name === 'archive_classification_batches')).toHaveLength(4);
    expect(accessoryLedger.filter((row) => row.table_name === 'events')).toHaveLength(1);
    expect(() => harness.runtime.database.prepare(`
      UPDATE platform_policy_archive_accessory_mutations SET consumed_at=consumed_at
      WHERE receipt_hash=? AND table_name='archive_retention_policies'
    `).run(retentionBinding.receiptHash)).toThrow(/ledger is immutable/u);
    expect(() => harness.runtime.database.prepare(`
      DELETE FROM platform_policy_archive_accessory_mutations
      WHERE receipt_hash=? AND table_name='archive_categories'
    `).run(categoryBinding.receiptHash)).toThrow(/ledger is immutable/u);
    expect(() => harness.runtime.database.prepare(`
      DELETE FROM platform_policy_archive_classification_batches WHERE receipt_hash=?
    `).run(secondClassificationBinding.receiptHash)).toThrow(/batch is durable/u);
  });
});
