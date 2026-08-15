import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId, asUserId, type Clock } from '@ppt/core';
import { PlatformPolicyEnforcementPoint, PlatformPolicyKernel } from '@ppt/platform-policy';
import type {
  MemoryStudioCenterKey,
  MemoryStudioMutationRow,
  MemoryStudioRecordRow,
  MemoryTimeCapsuleRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult,
  TransactionContext
} from '@ppt/repository-contracts';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';
import { SqliteMemoryStudioRepository } from './src/memory-studio-repository.js';
import { SqlitePlatformPolicyTransactionRepository } from './src/platform-policy-transaction-repository.js';

let now = asIsoDateTime('2026-08-15T12:00:00.000Z');
const FAMILY = asFamilyId('family-33-x-repository');
const FOREIGN = asFamilyId('family-33-x-foreign');
const ACCOUNT_A = asUserId('account-33-x-a');
const ACCOUNT_B = asUserId('account-33-x-b');
const OWNER = asPersonId('person-33-x-owner');
const OTHER = asPersonId('person-33-x-other');
const FENCE = 'memory-studio-write'; const EPOCH = 102;
const clock: Clock = { now: () => now };
const runtimes: SqliteFamilyDatabaseRuntime[] = []; const directories: string[] = [];
afterEach(() => { now = asIsoDateTime('2026-08-15T12:00:00.000Z'); for (const runtime of runtimes.splice(0)) runtime.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
const repositoryContext = (transaction: TransactionContext, accountId = ACCOUNT_A): RepositoryExecutionContext => ({
  transaction: transaction.transaction, actor: { userId: accountId, personId: OWNER, roles: ['family_admin'] },
  correlationId: transaction.correlationId, occurredAt: transaction.occurredAt
});
const openHarness = () => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-33x-memory-studio-')); directories.push(directory);
  const runtime = new SqliteFamilyDatabaseRuntime({ databasePath: join(directory, 'family.db'), applicationVersion: '33-x-vitest', clock,
    skipFileMigrationSafetyBackup: true, databaseConfig: { busyTimeoutMs: 5000, journalMode: 'WAL', synchronous: 'FULL' } }); runtimes.push(runtime);
  const policyRepository = new SqlitePlatformPolicyTransactionRepository();
  expect(runtime.transactionExecutor.execute(asCorrelationId('33-x-fence'), (transaction) => policyRepository.synchronizeFence(
    repositoryContext(transaction), { fenceName: FENCE, epoch: EPOCH, writable: true, synchronizedAt: now })).ok).toBe(true);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run(FAMILY, '33-X Family', now);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run(FOREIGN, 'Foreign Family', now);
  const person = runtime.database.prepare('INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
  person.run(OWNER, FAMILY, 'Owner', '1985-01-01', 'self', 0, 'main', 'active', now);
  person.run(OTHER, FAMILY, 'Other', '1987-01-01', 'partner', 0, 'main', 'active', now);
  const account = runtime.database.prepare('INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at) VALUES(?,?,?,?,?,?,?,?,?)');
  account.run(ACCOUNT_A, 'Owner A', 'owner-a-33x@example.test', 'test-password-record', now, 'family_admin', 'active', OWNER, '2026-01-01T00:00:00.000Z');
  account.run(ACCOUNT_B, 'Owner B', 'owner-b-33x@example.test', 'test-password-record', now, 'family_admin', 'active', OWNER, '2026-01-01T00:00:00.000Z');
  return { runtime, repository: new SqliteMemoryStudioRepository(), policyRepository };
};
type Harness = ReturnType<typeof openHarness>; let sequence = 0;
const kernel = new PlatformPolicyKernel({ policyVersion: '33-x-memory-studio-policy-v1',
  signingKey: Buffer.from('33-x-memory-studio-policy-test-key-material', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write'] }, consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [], writeActions: ['create', 'update', 'delete'] });
const withReceipt = async <T>(harness: Harness, input: { readonly action: 'read' | 'create' | 'update' | 'delete';
  readonly resourceType: 'memory_studio_center' | 'memory_studio_record' | 'memory_time_capsule'; readonly resourceId: string;
  readonly accountId?: typeof ACCOUNT_A; readonly ownerPersonId?: string; readonly familyId?: string },
  operation: (repository: SqliteMemoryStudioRepository, context: PolicyAuthorizedRepositoryExecutionContext) => RepositoryResult<T>) => {
  sequence += 1; const correlationId = asCorrelationId(`memory-studio-${input.action}-${sequence}`);
  const familyId = input.familyId ?? FAMILY; const accountId = input.accountId ?? ACCOUNT_A;
  const capability = input.action === 'read' ? 'family.read' : 'family.write';
  const pep = new PlatformPolicyEnforcementPoint({ kernel, authorityResolver: { resolve: () => ({
    policyVersion: '33-x-memory-studio-policy-v1', accountId, personId: OWNER, deviceId: 'device-33-x',
    applicationId: 'windows-desktop', deviceTrusted: true, membershipActive: true, roles: ['family_admin'], familyIds: [familyId],
    grants: [{ id: `grant-${sequence}`, subjectAccountId: accountId, resourceType: input.resourceType, resourceId: input.resourceId,
      actions: [input.action], purposes: ['general'], effect: 'allow', startsAt: '2026-01-01T00:00:00.000Z' }],
    online: true, expiresAt: '2027-12-31T23:59:59.999Z' }) }, resourceResolver: { resolve: () => ({
      type: input.resourceType, id: input.resourceId, familyId, ownerPersonId: input.ownerPersonId ?? OWNER,
      sensitivity: 'highly_sensitive', dataClasses: ['personal'] as const, classificationSource: 'declared' as const }) },
    receiptSink: { append: () => undefined, ensure: () => undefined }, replayStore: { reserve: (reservation) => {
      const result = harness.runtime.transactionExecutor.execute(asCorrelationId(`memory-studio-reserve-${sequence}`), (transaction) =>
        harness.policyRepository.reserveReplayNonce(repositoryContext(transaction, accountId), reservation));
      if (!result.ok) throw new Error(result.error.message); return result.value;
    } }, clock: () => now, nonceFactory: () => `nonce-memory-studio-${sequence}`, deferAllowedReceiptPersistence: true });
  return pep.execute({ correlationId, action: input.action, capability, resourceType: input.resourceType,
    resourceId: input.resourceId, purpose: 'general' }, () => ({ writable: true, epoch: EPOCH }), (authorization) =>
      harness.runtime.transactionExecutor.execute(correlationId, (transaction) => {
        const context: PolicyAuthorizedRepositoryExecutionContext = { ...repositoryContext(transaction, accountId), correlationId,
          policyAuthorization: authorization };
        const recorded = harness.policyRepository.recordAuthorizedTransaction(context, { record: authorization.receiptRecord,
          fenceName: FENCE, fenceEpoch: EPOCH, fenceWritable: true });
        return recorded.ok ? operation(harness.repository, context) : recorded;
      }));
};
const key = (accountId = ACCOUNT_A): MemoryStudioCenterKey => ({ familyId: FAMILY, accountId, actorPersonId: OWNER,
  ownerPersonId: OWNER, centerId: `memory-studio:${FAMILY}:${OWNER}` });
const mutation = (resourceType: MemoryStudioMutationRow['resourceType'], resourceId: string,
  overrides: Partial<MemoryStudioMutationRow> = {}): MemoryStudioMutationRow => ({ id: 'a'.repeat(64), familyId: FAMILY,
  ownerPersonId: OWNER, resourceType, resourceId, actorAccountId: ACCOUNT_A, actorPersonId: OWNER,
  mutationKind: resourceType === 'memory_studio_record' ? 'record_create' : 'capsule_create',
  clientOperationId: 'operation-memory-studio-33-x', requestFingerprint: 'b'.repeat(64), expectedRevision: 0, revision: 1,
  resourceStateFingerprint: 'c'.repeat(64), referenceFingerprint: 'd'.repeat(64), referenceCount: 0, occurredAt: now, ...overrides });
const record = (row: MemoryStudioMutationRow, overrides: Partial<MemoryStudioRecordRow> = {}): MemoryStudioRecordRow => ({
  id: row.resourceId, familyId: FAMILY, ownerPersonId: OWNER, kind: 'recipe', status: 'active', title: 'Aile tarifi',
  summary: 'Kullanıcının yerel açıklaması.', archiveItemIds: [], personIds: [], manualFaceGroupingApproved: false,
  referenceFingerprint: row.referenceFingerprint, revision: row.revision, stateFingerprint: row.resourceStateFingerprint,
  lastMutationId: row.id, createdAt: now, updatedAt: now, ...overrides
});
const capsule = (row: MemoryStudioMutationRow, recordId: string, overrides: Partial<MemoryTimeCapsuleRow> = {}): MemoryTimeCapsuleRow => ({
  id: row.resourceId, familyId: FAMILY, ownerPersonId: OWNER, title: 'Geleceğe mesaj', status: 'awaiting_approvals',
  archiveItemIds: [], memoryRecordIds: [recordId], unlockAt: asIsoDateTime('2026-08-23T12:00:00.000Z'),
  minimumApprovals: 2, approvals: [], referenceFingerprint: row.referenceFingerprint, revision: row.revision,
  stateFingerprint: row.resourceStateFingerprint, lastMutationId: row.id, createdAt: now, updatedAt: now, ...overrides
});

describe('33-X memory studio repository policy boundary', () => {
  it('persists owner-bound metadata and exposes only the exact center', async () => {
    const harness = openHarness(); const created = mutation('memory_studio_record', 'record-33-x');
    expect((await withReceipt(harness, { action: 'create', resourceType: 'memory_studio_record', resourceId: created.resourceId }, (repo, ctx) => {
      const ledger = repo.insertMutation(ctx, created); return ledger.ok ? repo.insertRecord(ctx, record(created)) : ledger;
    })).ok).toBe(true);
    const loaded = await withReceipt(harness, { action: 'read', resourceType: 'memory_studio_center', resourceId: '*' },
      (repo, ctx) => repo.loadCenter(ctx, key()));
    expect(loaded).toMatchObject({ ok: true, value: { records: [{ id: 'record-33-x', status: 'active' }], capsules: [] } });
    expect(JSON.stringify(loaded)).not.toContain('policy_receipt');
  });

  it('rejects forged owner receipts and keeps append-only evidence immutable', async () => {
    const harness = openHarness(); const forged = mutation('memory_studio_record', 'forged-33-x');
    expect((await withReceipt(harness, { action: 'create', resourceType: 'memory_studio_record', resourceId: forged.resourceId,
      ownerPersonId: OTHER }, (repo, ctx) => repo.insertMutation(ctx, forged))).ok).toBe(false);
    expect((harness.runtime.database.prepare('SELECT COUNT(*) count FROM memory_studio_mutations').get() as { count: number }).count).toBe(0);
  });

  it('validates same-owner memory references before capsule creation', async () => {
    const harness = openHarness(); const created = mutation('memory_studio_record', 'source-record-33-x');
    await withReceipt(harness, { action: 'create', resourceType: 'memory_studio_record', resourceId: created.resourceId }, (repo, ctx) => {
      const ledger = repo.insertMutation(ctx, created); return ledger.ok ? repo.insertRecord(ctx, record(created)) : ledger;
    });
    const capsuleMutation = mutation('memory_time_capsule', 'capsule-33-x', { id: 'e'.repeat(64), mutationKind: 'capsule_create',
      clientOperationId: 'operation-capsule-33-x', requestFingerprint: 'f'.repeat(64), resourceStateFingerprint: '1'.repeat(64),
      referenceFingerprint: '2'.repeat(64), referenceCount: 1 });
    expect((await withReceipt(harness, { action: 'create', resourceType: 'memory_time_capsule', resourceId: capsuleMutation.resourceId },
      (repo, ctx) => { const references = repo.validateOwnedReferences(ctx, key(), { archiveItemIds: [], personIds: [],
        memoryRecordIds: ['source-record-33-x'] }); if (!references.ok || !references.value) return references;
        const ledger = repo.insertMutation(ctx, capsuleMutation); return ledger.ok ? repo.insertCapsule(ctx, capsule(capsuleMutation, created.resourceId)) : ledger; })).ok).toBe(true);
    const loaded = await withReceipt(harness, { action: 'read', resourceType: 'memory_studio_center', resourceId: '*' },
      (repo, ctx) => repo.loadCenter(ctx, key()));
    expect(loaded).toMatchObject({ ok: true, value: { capsules: [{ id: 'capsule-33-x' }] } });
  });

  it('rejects a capsule approval forged for a different account than the receipt actor', async () => {
    const harness = openHarness(); const created = mutation('memory_studio_record', 'approval-source-33-x');
    await withReceipt(harness, { action: 'create', resourceType: 'memory_studio_record', resourceId: created.resourceId }, (repo, ctx) => {
      const ledger = repo.insertMutation(ctx, created); return ledger.ok ? repo.insertRecord(ctx, record(created)) : ledger;
    });
    const createdCapsule = mutation('memory_time_capsule', 'approval-capsule-33-x', { id: 'e'.repeat(64),
      mutationKind: 'capsule_create', clientOperationId: 'operation-approval-capsule-create', requestFingerprint: 'f'.repeat(64),
      resourceStateFingerprint: '1'.repeat(64), referenceFingerprint: '2'.repeat(64), referenceCount: 1 });
    await withReceipt(harness, { action: 'create', resourceType: 'memory_time_capsule', resourceId: createdCapsule.resourceId },
      (repo, ctx) => { const ledger = repo.insertMutation(ctx, createdCapsule);
        return ledger.ok ? repo.insertCapsule(ctx, capsule(createdCapsule, created.resourceId)) : ledger; });
    const forgedApproval = mutation('memory_time_capsule', createdCapsule.resourceId, { id: '3'.repeat(64),
      mutationKind: 'capsule_approve', clientOperationId: 'operation-forged-approval-33-x', requestFingerprint: '4'.repeat(64),
      expectedRevision: 1, revision: 2, resourceStateFingerprint: '5'.repeat(64), referenceFingerprint: '2'.repeat(64), referenceCount: 1 });
    const result = await withReceipt(harness, { action: 'update', resourceType: 'memory_time_capsule', resourceId: createdCapsule.resourceId },
      (repo, ctx) => { const ledger = repo.insertMutation(ctx, forgedApproval); if (!ledger.ok) return ledger;
        return repo.saveCapsule(ctx, capsule(forgedApproval, created.resourceId, { approvals: [{ accountId: ACCOUNT_B,
          personId: OWNER, approvedAt: now }] }), 1); });
    expect(result.ok).toBe(false);
    expect((harness.runtime.database.prepare("SELECT COUNT(*) count FROM memory_studio_mutations WHERE mutation_kind='capsule_approve'").get() as { count: number }).count).toBe(0);
  });

  it('returns payload-free metadata for central preauthorization', async () => {
    const harness = openHarness(); const created = mutation('memory_studio_record', 'preauth-record-33-x');
    await withReceipt(harness, { action: 'create', resourceType: 'memory_studio_record', resourceId: created.resourceId }, (repo, ctx) => {
      const ledger = repo.insertMutation(ctx, created); return ledger.ok ? repo.insertRecord(ctx, record(created,
        { summary: 'Bu açıklama preauthorization yüzeyine taşınmamalıdır.' })) : ledger;
    });
    const result = harness.runtime.transactionExecutor.execute(asCorrelationId('memory-studio-preauth-read'), (transaction) =>
      harness.repository.resolvePolicyResource(repositoryContext(transaction), 'memory_studio_record', created.resourceId));
    expect(result).toMatchObject({ ok: true, value: { id: created.resourceId, familyId: FAMILY, ownerPersonId: OWNER,
      revision: 1, status: 'active' } });
    expect(Object.keys(result.ok && result.value ? result.value : {}).sort()).toEqual(['familyId', 'id', 'ownerPersonId', 'revision', 'stateFingerprint', 'status']);
    expect(JSON.stringify(result)).not.toContain('preauthorization yüzeyine');
  });
});
