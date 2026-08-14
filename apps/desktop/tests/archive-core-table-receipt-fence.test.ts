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
  ok,
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
  TransactionContext
} from '@ppt/repository-contracts';
import {
  SqliteArchiveRepository,
  SqlitePlatformPolicyTransactionRepository,
  computePlatformPolicyReceiptHash
} from '@ppt/repositories';
import { SqliteFamilyDatabaseRuntime } from '../src/main/family-database-runtime.js';

const NOW = asIsoDateTime('2026-08-06T18:00:00.000Z');
const FAMILY_ID = asFamilyId('family-30r-receipt-fence');
const ACCOUNT_ID = asUserId('account-30r-receipt-fence');
const PERSON_ID = asPersonId('person-30r-receipt-fence');
const POLICY_VERSION = '30-r-archive-core-receipt-fence-v1';
const FENCE_NAME = 'archive-write';
const clock: Clock = Object.freeze({ now: () => NOW });
const temporaryDirectories: string[] = [];
const activeRuntimes: SqliteFamilyDatabaseRuntime[] = [];

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

const makeHarness = (): Harness => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-30r-archive-receipt-fence-'));
  temporaryDirectories.push(directory);
  const runtime = new SqliteFamilyDatabaseRuntime({
    databasePath: join(directory, 'family.db'),
    applicationVersion: '30-r-vitest',
    clock,
    skipFileMigrationSafetyBackup: true,
    databaseConfig: { busyTimeoutMs: 5_000, journalMode: 'WAL', synchronous: 'FULL' }
  });
  activeRuntimes.push(runtime);
  const policyRepository = new SqlitePlatformPolicyTransactionRepository();
  const synchronized = runtime.transactionExecutor.execute(
    asCorrelationId('30-r-fence-initialization'),
    (transaction) => policyRepository.synchronizeFence(repositoryContext(transaction), {
      fenceName: FENCE_NAME,
      epoch: 30,
      writable: true,
      synchronizedAt: NOW
    })
  );
  expect(synchronized.ok).toBe(true);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)')
    .run(FAMILY_ID, '30-R Receipt Fence Family', NOW);
  runtime.database.prepare('INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(PERSON_ID,FAMILY_ID,'30-R Administrator',null,'self',0,'main','active',NOW);
  runtime.database.prepare('INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(ACCOUNT_ID,'30-R Administrator','30r@example.test','test-password-record',NOW,'family_admin','active',PERSON_ID,'2026-01-01T00:00:00.000Z');
  return {
    runtime,
    policyRepository,
    archiveRepository: new SqliteArchiveRepository()
  };
};

const policyKernel = (): PlatformPolicyKernel => new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('30-r-archive-core-receipt-fence-test-key', 'utf8'),
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
    readonly resourceType?: 'archive_item' | 'archive_retention_policy' | 'archive_category';
    readonly resourceId: string;
    readonly action: 'create' | 'update' | 'delete';
    readonly ownerPersonId?: typeof PERSON_ID | null;
  },
  operation: (context: PolicyAuthorizedRepositoryExecutionContext, binding: ReceiptBinding) => void
): Promise<ReceiptBinding> => {
  const resourceType = input.resourceType ?? 'archive_item';
  const pep = new PlatformPolicyEnforcementPoint({
    kernel: policyKernel(),
    authorityResolver: {
      resolve: () => ({
        policyVersion: POLICY_VERSION,
        accountId: ACCOUNT_ID,
        personId: PERSON_ID,
        deviceId: 'device-30r-receipt-fence',
        applicationId: 'windows-desktop',
        deviceTrusted: true,
        membershipActive: true,
        roles: ['family_admin'],
        familyIds: [FAMILY_ID],
        online: true,
        grants: [{
          id: `grant-${input.correlationId}`,
          subjectAccountId: ACCOUNT_ID,
          resourceType,
          resourceId: input.resourceId,
          actions: [input.action],
          purposes: ['archive'],
          effect: 'allow',
          startsAt: '2026-01-01T00:00:00.000Z'
        }],
        expiresAt: '2026-08-06T18:05:00.000Z'
      })
    },
    resourceResolver: {
      resolve: () => ({
        type: resourceType,
        id: input.resourceId,
        familyId: FAMILY_ID,
        ...(input.ownerPersonId===null?{}:{ownerPersonId:input.ownerPersonId??PERSON_ID}),
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
    resourceType,
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
      operation(context, captured);
      return ok(undefined);
    })
  );
  expect(result.ok).toBe(true);
  expect(captured).toBeDefined();
  return captured!;
};

const rawItemInsert = (
  harness: Harness,
  id: string,
  binding?: ReceiptBinding,
  nonceOverride?: string
) => harness.runtime.database.prepare(`
  INSERT INTO archive_items(
    id,family_id,title,original_name,stored_name,mime_type,size_bytes,sha256,
    linked_event_id,category_id,sensitivity,ai_processing_allowed,created_at,
    policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
    policy_correlation_id,policy_resource_type,policy_resource_id,policy_action,policy_capability
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`).run(
  id,FAMILY_ID,`Raw ${id}`,`${id}.txt`,`${id}.vault`,'text/plain',8,'d'.repeat(64),
  null,null,'standard',0,NOW,
  binding?.receiptHash ?? null,binding?.receiptVersion ?? null,nonceOverride ?? binding?.nonce ?? null,
  binding?.correlationId ?? null,binding?.resourceType ?? null,binding?.resourceId ?? null,
  binding?.action ?? null,binding?.capability ?? null
);

afterEach(() => {
  for (const runtime of activeRuntimes.splice(0)) runtime.close();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('30-R archive core-table receipt fence', () => {
  it('allows exactly one strong-authenticated legacy ownerless-to-actor transition and seals its ledger', async () => {
    const harness=makeHarness();
    const itemId='archive-legacy-ownerless';
    await withReceipt(harness,{correlationId:'corr-legacy-create',nonce:'nonce-legacy-create',resourceId:itemId,action:'create',ownerPersonId:null},(context)=>{
      const inserted=harness.archiveRepository.insert(context,{id:itemId,familyId:FAMILY_ID,title:'Legacy ownerless item',originalName:'legacy.txt',storedName:'legacy.vault',mimeType:'text/plain',sizeBytes:12,sha256:'9'.repeat(64),sensitivity:'personal',aiProcessingAllowed:false,createdAt:NOW});
      expect(inserted.ok).toBe(true);
    });
    const before=harness.runtime.transactionExecutor.execute(asCorrelationId('corr-legacy-before'),transaction=>harness.archiveRepository.findForPolicyResolution(repositoryContext(transaction),itemId));
    expect(before.ok&&before.value?.ownerPersonId).toBeUndefined();

    await withReceipt(harness,{correlationId:'corr-legacy-generic-update',nonce:'nonce-legacy-generic-update',resourceId:itemId,action:'update'},(_context,binding)=>{
      expect(()=>harness.runtime.database.prepare('UPDATE archive_items SET policy_receipt_hash=?,policy_receipt_version=?,policy_receipt_nonce=?,policy_correlation_id=?,policy_resource_type=?,policy_resource_id=?,policy_action=?,policy_capability=? WHERE id=?').run(binding.receiptHash,binding.receiptVersion,binding.nonce,binding.correlationId,binding.resourceType,binding.resourceId,binding.action,binding.capability,itemId)).toThrow(/ownership may only transition once/u);
    });

    await withReceipt(harness,{correlationId:'corr-legacy-reattest',nonce:'nonce-legacy-reattest',resourceId:itemId,action:'update'},(context)=>{
      const reattested=harness.archiveRepository.reattestLegacyOwnership(context,itemId,PERSON_ID);
      expect(reattested.ok).toBe(true);
    });
    const after=harness.runtime.transactionExecutor.execute(asCorrelationId('corr-legacy-after'),transaction=>harness.archiveRepository.findForPolicyResolution(repositoryContext(transaction),itemId));
    expect(after.ok&&after.value?.ownerPersonId).toBe(PERSON_ID);
    const ledger=harness.runtime.database.prepare('SELECT archive_item_id,family_id,actor_account_id,owner_person_id,confirmation_version,strong_authentication_verified FROM archive_legacy_ownership_reattestations WHERE archive_item_id=?').get(itemId) as Record<string,unknown>;
    expect(ledger).toMatchObject({archive_item_id:itemId,family_id:FAMILY_ID,actor_account_id:ACCOUNT_ID,owner_person_id:PERSON_ID,confirmation_version:1,strong_authentication_verified:1});
    expect(()=>harness.runtime.database.prepare('UPDATE archive_legacy_ownership_reattestations SET confirmation_version=confirmation_version WHERE archive_item_id=?').run(itemId)).toThrow(/reattestation is immutable/u);
    expect(()=>harness.runtime.database.prepare('DELETE FROM archive_legacy_ownership_reattestations WHERE archive_item_id=?').run(itemId)).toThrow(/reattestation is durable/u);
  });

  it('binds governed writes and rejects direct missing, mismatched, replayed and cross-resource SQL', async () => {
    const harness = makeHarness();
    const itemId = 'archive-30r-governed';

    const createBinding = await withReceipt(harness, {
      correlationId: 'corr-30r-create',
      nonce: 'nonce-30r-create',
      resourceId: itemId,
      action: 'create'
    }, (context, binding) => {
      const inserted = harness.archiveRepository.insert(context, {
        id: itemId,
        familyId: FAMILY_ID,
        title: 'Governed 30-R item',
        originalName: 'governed.txt',
        storedName: 'governed.vault',
        mimeType: 'text/plain',
        sizeBytes: 12,
        sha256: 'a'.repeat(64),
        sensitivity: 'personal',
        aiProcessingAllowed: false,
        createdAt: NOW
      });
      expect(inserted.ok).toBe(true);
      const version = harness.archiveRepository.insertVersion(context, {
        id: 'archive-version-30r-governed',
        archiveItemId: itemId,
        versionNo: 1,
        originalName: 'governed.txt',
        storedName: 'governed.vault',
        mimeType: 'text/plain',
        sizeBytes: 12,
        sha256: 'a'.repeat(64),
        createdAt: NOW,
        note: 'Initial governed version'
      });
      expect(version.ok).toBe(true);
      expect(() => harness.runtime.database.prepare(`
        INSERT INTO archive_versions(
          id,archive_item_id,version_no,original_name,stored_name,mime_type,size_bytes,sha256,created_at,note,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,
          policy_resource_type,policy_resource_id,policy_action,policy_capability
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        'archive-version-30r-replay',itemId,2,'replay.txt','replay.vault','text/plain',9,'b'.repeat(64),NOW,null,
        binding.receiptHash,binding.receiptVersion,binding.nonce,binding.correlationId,
        binding.resourceType,binding.resourceId,binding.action,binding.capability
      )).toThrow(/fresh exact parent create or update policy receipt/u);
    });

    expect(() => harness.runtime.database.prepare('UPDATE archive_items SET title=? WHERE id=?')
      .run('Receiptless update', itemId)).toThrow(/fresh exact policy receipt/u);
    expect(() => rawItemInsert(harness, 'archive-30r-missing')).toThrow(/fresh exact policy receipt/u);

    await withReceipt(harness, {
      correlationId: 'corr-30r-classification',
      nonce: 'nonce-30r-classification',
      resourceId: itemId,
      action: 'update'
    }, (context) => {
      const updated = harness.archiveRepository.updateClassification(context, {
        itemId,
        categoryId: null,
        sensitivity: 'high',
        aiProcessingAllowed: false,
        tags: []
      });
      expect(updated.ok).toBe(true);
    });

    await withReceipt(harness, {
      correlationId: 'corr-30r-retention-create',
      nonce: 'nonce-30r-retention-create',
      resourceType: 'archive_retention_policy',
      resourceId: 'retention-30r',
      action: 'create'
    }, (context) => {
      const inserted = harness.archiveRepository.insertRetentionPolicy(context, {
        id: 'retention-30r',
        name: '30-R retention',
        retentionDays: 30,
        secureDestroy: true,
        createdAt: NOW
      });
      expect(inserted.ok).toBe(true);
    });
    await withReceipt(harness, {
      correlationId: 'corr-30r-retention',
      nonce: 'nonce-30r-retention',
      resourceId: itemId,
      action: 'update'
    }, (context) => {
      const assigned = harness.archiveRepository.assignRetentionPolicy(context, itemId, 'retention-30r');
      expect(assigned.ok).toBe(true);
    });

    const crossResourceBinding = await withReceipt(harness, {
      correlationId: 'corr-30r-cross-resource',
      nonce: 'nonce-30r-cross-resource',
      resourceId: 'archive-30r-authorized-resource',
      action: 'create'
    }, (_context, binding) => {
      expect(() => rawItemInsert(harness, 'archive-30r-cross-target', binding))
        .toThrow(/fresh exact policy receipt/u);
      expect(() => rawItemInsert(
        harness,
        binding.resourceId,
        binding,
        'nonce-30r-mismatched'
      )).toThrow(/fresh exact policy receipt/u);
    });
    expect(crossResourceBinding.resourceId).toBe('archive-30r-authorized-resource');

    await withReceipt(harness, {
      correlationId: 'corr-30r-destroy',
      nonce: 'nonce-30r-destroy',
      resourceId: itemId,
      action: 'delete'
    }, (context) => {
      const destroyed = harness.archiveRepository.markDestroyed(context, itemId, NOW);
      expect(destroyed.ok).toBe(true);
    });

    const ledgerRows = harness.runtime.database.prepare(`
      SELECT table_name,operation,action,row_id,resource_id
      FROM platform_policy_archive_business_mutations
      ORDER BY rowid
    `).all() as Array<Record<string, unknown>>;
    expect(ledgerRows).toHaveLength(5);
    expect(ledgerRows.map((row) => `${row.table_name}:${row.operation}:${row.action}`)).toEqual([
      'archive_items:insert:create',
      'archive_versions:insert:create',
      'archive_items:update:update',
      'archive_items:update:update',
      'archive_items:destroy:delete'
    ]);
    expect(ledgerRows.every((row) => row.resource_id === itemId)).toBe(true);
    expect(() => harness.runtime.database.prepare(`
      UPDATE platform_policy_archive_business_mutations SET consumed_at=consumed_at
      WHERE receipt_hash=? AND table_name='archive_items' AND operation='insert'
    `).run(createBinding.receiptHash)).toThrow(/ledger is immutable/u);
    expect(() => harness.runtime.database.prepare(`
      DELETE FROM platform_policy_archive_business_mutations
      WHERE receipt_hash=? AND table_name='archive_items' AND operation='insert'
    `).run(createBinding.receiptHash)).toThrow(/ledger is immutable/u);
    expect(() => harness.runtime.database.prepare('UPDATE archive_versions SET note=? WHERE id=?')
      .run('tampered', 'archive-version-30r-governed')).toThrow(/version mutation is forbidden/u);
    expect(() => harness.runtime.database.prepare('DELETE FROM archive_versions WHERE id=?')
      .run('archive-version-30r-governed')).toThrow(/version deletion is forbidden/u);
    expect(() => harness.runtime.database.prepare('DELETE FROM archive_items WHERE id=?')
      .run(itemId)).toThrow(/physical deletion is forbidden/u);

    let staleBinding: ReceiptBinding | undefined;
    await withReceipt(harness, {
      correlationId: 'corr-30r-stale-fence',
      nonce: 'nonce-30r-stale-fence',
      resourceId: 'archive-30r-stale-fence',
      action: 'create'
    }, (_context, binding) => { staleBinding = binding; });
    const narrowed = harness.runtime.transactionExecutor.execute(
      asCorrelationId('corr-30r-fence-narrow'),
      (transaction) => harness.policyRepository.synchronizeFence(repositoryContext(transaction), {
        fenceName: FENCE_NAME,
        epoch: 31,
        writable: false,
        synchronizedAt: asIsoDateTime('2026-08-06T18:00:01.000Z')
      })
    );
    expect(narrowed.ok).toBe(true);
    expect(() => rawItemInsert(harness, staleBinding!.resourceId, staleBinding))
      .toThrow(/fresh exact policy receipt/u);
  });
});
