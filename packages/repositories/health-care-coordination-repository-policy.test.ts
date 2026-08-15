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
  type Clock,
  type PersonId,
  type UserId
} from '@ppt/core';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel
} from '@ppt/platform-policy';
import type {
  HealthCareCenterKey,
  HealthCareCenterRow,
  HealthCareEntryRow,
  HealthCareMutationRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult,
  TransactionContext
} from '@ppt/repository-contracts';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';
import { SqliteHealthRepository } from './src/health-repository.js';
import { SqliteObjectPermissionRepository } from './src/object-permission-repository.js';
import { SqlitePlatformPolicyTransactionRepository } from './src/platform-policy-transaction-repository.js';

const NOW = asIsoDateTime('2026-08-15T13:00:00.000Z');
const FAMILY = asFamilyId('family-33-s-repository');
const OWNER_ACCOUNT = asUserId('account-33-s-owner');
const OWNER_PERSON = asPersonId('person-33-s-owner');
const CAREGIVER_ACCOUNT = asUserId('account-33-s-caregiver');
const CAREGIVER_PERSON = asPersonId('person-33-s-caregiver');
const CENTER_ID = `health-care-center:${OWNER_PERSON}`;
const FENCE_NAME = 'health-care-write';
const FENCE_EPOCH = 97;
const clock: Clock = { now: () => NOW };
const runtimes: SqliteFamilyDatabaseRuntime[] = [];
const directories: string[] = [];

afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

interface Actor {
  readonly accountId: UserId;
  readonly personId: PersonId;
  readonly roles: readonly string[];
}

const owner: Actor = { accountId: OWNER_ACCOUNT, personId: OWNER_PERSON, roles: ['family_admin'] };
const caregiver: Actor = { accountId: CAREGIVER_ACCOUNT, personId: CAREGIVER_PERSON, roles: ['caregiver'] };

const repositoryContext = (transaction: TransactionContext, actor: Actor): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: { userId: actor.accountId, roles: actor.roles, personId: actor.personId },
  correlationId: transaction.correlationId,
  occurredAt: transaction.occurredAt
});

const openHarness = () => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-33s-health-care-repository-'));
  directories.push(directory);
  const runtime = new SqliteFamilyDatabaseRuntime({
    databasePath: join(directory, 'family.db'),
    applicationVersion: '33-s-vitest',
    clock,
    skipFileMigrationSafetyBackup: true,
    databaseConfig: { busyTimeoutMs: 5_000, journalMode: 'WAL', synchronous: 'FULL' }
  });
  runtimes.push(runtime);
  const policyRepository = new SqlitePlatformPolicyTransactionRepository();
  const fence = runtime.transactionExecutor.execute(asCorrelationId('33-s-health-care-fence'), (transaction) =>
    policyRepository.synchronizeFence(repositoryContext(transaction, owner), {
      fenceName: FENCE_NAME,
      epoch: FENCE_EPOCH,
      writable: true,
      synchronizedAt: NOW
    })
  );
  expect(fence.ok).toBe(true);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run(FAMILY, '33-S Family', NOW);
  const insertPerson = runtime.database.prepare('INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
  insertPerson.run(OWNER_PERSON, FAMILY, 'Health Owner', null, 'self', 0, 'main', 'active', NOW);
  insertPerson.run(CAREGIVER_PERSON, FAMILY, 'Caregiver', null, 'caregiver', 1, 'main', 'active', NOW);
  const insertAccount = runtime.database.prepare('INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at) VALUES(?,?,?,?,?,?,?,?,?)');
  insertAccount.run(OWNER_ACCOUNT, 'Health Owner', 'owner-33s@example.test', 'test-password-record', NOW, 'family_admin', 'active', OWNER_PERSON, '2026-01-01T00:00:00.000Z');
  insertAccount.run(CAREGIVER_ACCOUNT, 'Caregiver', 'caregiver-33s@example.test', 'test-password-record', NOW, 'caregiver', 'active', CAREGIVER_PERSON, '2026-01-01T00:00:00.000Z');
  return {
    runtime,
    repository: new SqliteHealthRepository(),
    permissionRepository: new SqliteObjectPermissionRepository(),
    policyRepository
  };
};

type Harness = ReturnType<typeof openHarness>;
let sequence = 0;
const kernel = new PlatformPolicyKernel({
  policyVersion: '33-s-health-care-policy-v1',
  signingKey: Buffer.from('33-s-health-care-policy-test-key', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['health.read', 'health.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

const withReceipt = async <T>(
  harness: Harness,
  input: {
    readonly actor: Actor;
    readonly action: 'read' | 'update';
    readonly resourceId?: string;
  },
  operation: (
    repository: SqliteHealthRepository,
    permissionRepository: SqliteObjectPermissionRepository,
    context: PolicyAuthorizedRepositoryExecutionContext
  ) => RepositoryResult<T>
) => {
  sequence += 1;
  const correlationId = asCorrelationId(`health-care-33-s-${input.action}-${sequence}`);
  const resourceId = input.resourceId ?? CENTER_ID;
  const capability = input.action === 'read' ? 'health.read' : 'health.write';
  const pep = new PlatformPolicyEnforcementPoint({
    kernel,
    authorityResolver: {
      resolve: () => ({
        policyVersion: '33-s-health-care-policy-v1',
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        deviceId: 'device-33-s',
        applicationId: 'windows-desktop',
        deviceTrusted: true,
        membershipActive: true,
        roles: input.actor.roles,
        familyIds: [FAMILY],
        grants: [{
          id: `grant-${sequence}`,
          subjectAccountId: input.actor.accountId,
          resourceType: 'health_care_center',
          resourceId,
          actions: [input.action],
          purposes: ['care'],
          effect: 'allow',
          startsAt: '2026-01-01T00:00:00.000Z'
        }],
        online: true,
        expiresAt: '2026-12-31T23:59:59.999Z'
      })
    },
    resourceResolver: {
      resolve: () => ({
        type: 'health_care_center',
        id: resourceId,
        familyId: FAMILY,
        ownerPersonId: OWNER_PERSON,
        sensitivity: 'highly_sensitive'
      })
    },
    receiptSink: { append: () => undefined, ensure: () => undefined },
    replayStore: {
      reserve: (reservation) => {
        const reserved = harness.runtime.transactionExecutor.execute(
          asCorrelationId(`health-care-33-s-reserve-${sequence}`),
          (transaction) => harness.policyRepository.reserveReplayNonce(repositoryContext(transaction, input.actor), reservation)
        );
        if (!reserved.ok) throw new Error(reserved.error.message);
        return reserved.value;
      }
    },
    clock: () => NOW,
    nonceFactory: () => `nonce-health-care-33-s-${sequence}`,
    deferAllowedReceiptPersistence: true
  });
  return pep.execute({
    correlationId,
    action: input.action,
    capability,
    resourceType: 'health_care_center',
    resourceId,
    purpose: 'care'
  }, () => ({ writable: true, epoch: FENCE_EPOCH }), (authorization) =>
    harness.runtime.transactionExecutor.execute(correlationId, (transaction) => {
      const context: PolicyAuthorizedRepositoryExecutionContext = {
        ...repositoryContext(transaction, input.actor),
        correlationId,
        policyAuthorization: authorization
      };
      const recorded = harness.policyRepository.recordAuthorizedTransaction(context, {
        record: authorization.receiptRecord,
        fenceName: FENCE_NAME,
        fenceEpoch: FENCE_EPOCH,
        fenceWritable: true
      });
      return recorded.ok
        ? operation(harness.repository, harness.permissionRepository, context)
        : recorded;
    })
  );
};

const key = (actor: Actor): HealthCareCenterKey => ({
  familyId: FAMILY,
  accountId: actor.accountId,
  ownerPersonId: OWNER_PERSON,
  centerId: CENTER_ID
});

const mutation = (input: {
  readonly actor: Actor;
  readonly id: string;
  readonly clientOperationId: string;
  readonly targetId: string;
  readonly kind: 'entry_record' | 'grant_upsert' | 'grant_revoke';
  readonly expectedRevision: number;
}): HealthCareMutationRow => ({
  id: input.id,
  centerId: CENTER_ID,
  familyId: FAMILY,
  ownerPersonId: OWNER_PERSON,
  actorAccountId: input.actor.accountId,
  actorPersonId: input.actor.personId,
  mutationKind: input.kind,
  clientOperationId: input.clientOperationId,
  requestFingerprint: String(input.expectedRevision + 1).repeat(64).slice(0, 64),
  expectedRevision: input.expectedRevision,
  revision: input.expectedRevision + 1,
  stateFingerprint: String(input.expectedRevision + 2).repeat(64).slice(0, 64),
  targetId: input.targetId,
  occurredAt: NOW
});

const center = (row: HealthCareMutationRow, createdAt = NOW): HealthCareCenterRow => ({
  id: CENTER_ID,
  familyId: FAMILY,
  ownerPersonId: OWNER_PERSON,
  revision: row.revision,
  stateFingerprint: row.stateFingerprint,
  lastMutationId: row.id,
  createdAt,
  updatedAt: NOW
});

const insertEntry = (
  repository: SqliteHealthRepository,
  context: PolicyAuthorizedRepositoryExecutionContext,
  row: HealthCareMutationRow,
  kind: 'allergy' | 'blood_pressure',
  accessScope: 'emergency_summary' | 'measurements'
) => {
  const entry: HealthCareEntryRow = {
    id: row.targetId,
    centerId: CENTER_ID,
    familyId: FAMILY,
    ownerPersonId: OWNER_PERSON,
    kind,
    accessScope,
    title: kind === 'allergy' ? 'Penisilin alerjisi' : 'Tansiyon ölçümü',
    status: kind === 'allergy' ? 'active' : 'observed',
    occurredAt: NOW,
    ...(kind === 'blood_pressure' ? { measurement: { value: 125, secondaryValue: 78, unit: 'mmHg' } } : {}),
    recordedBy: row.actorPersonId === OWNER_PERSON ? 'owner' : 'caregiver',
    recordedByAccountId: row.actorAccountId,
    recordedByPersonId: row.actorPersonId,
    source: 'manual_local',
    mutationId: row.id,
    createdAt: NOW
  };
  return repository.insertHealthCareEntry(context, entry);
};

const createCenterWithEntry = async (harness: Harness) => withReceipt(
  harness,
  { actor: owner, action: 'update' },
  (repository, _permissions, context) => {
    const row = mutation({ actor: owner, id: 'mutation-owner-allergy', clientOperationId: 'operation-owner-allergy', targetId: 'entry-owner-allergy', kind: 'entry_record', expectedRevision: 0 });
    const insertedMutation = repository.insertHealthCareMutation(context, row);
    if (!insertedMutation.ok) return insertedMutation;
    const insertedCenter = repository.insertHealthCareCenter(context, center(row));
    return insertedCenter.ok ? insertEntry(repository, context, row, 'allergy', 'emergency_summary') : insertedCenter;
  }
);

describe('33-S health care coordination repository policy', () => {
  it('persists exact owner-bound immutable entry and mutation state', async () => {
    const harness = openHarness();
    const created = await createCenterWithEntry(harness);
    expect(created, JSON.stringify(created)).toMatchObject({ ok: true });
    expect(harness.runtime.database.prepare('SELECT revision,last_mutation_id FROM health_care_centers WHERE id=?').get(CENTER_ID))
      .toEqual({ revision: 1, last_mutation_id: 'mutation-owner-allergy' });
    expect(harness.runtime.database.prepare('SELECT kind,access_scope,recorded_by_role FROM health_care_entries WHERE id=?').get('entry-owner-allergy'))
      .toEqual({ kind: 'allergy', access_scope: 'emergency_summary', recorded_by_role: 'owner' });
    expect(() => harness.runtime.database.prepare("UPDATE health_care_entries SET title='forged' WHERE id='entry-owner-allergy'").run()).toThrow(/immutable/u);
    expect(() => harness.runtime.database.prepare("DELETE FROM health_care_mutations WHERE id='mutation-owner-allergy'").run()).toThrow(/durable/u);
  });

  it('filters caregiver reads to the active minimum-necessary scopes', async () => {
    const harness = openHarness();
    expect((await createCenterWithEntry(harness)).ok).toBe(true);
    const grantCreated = await withReceipt(harness, { actor: owner, action: 'update' }, (repository, permissions, context) => {
      const row = mutation({ actor: owner, id: 'mutation-grant-create', clientOperationId: 'operation-grant-create', targetId: 'grant-33-s', kind: 'grant_upsert', expectedRevision: 1 });
      const inserted = repository.insertHealthCareMutation(context, row);
      if (!inserted.ok) return inserted;
      const saved = repository.saveHealthCareCenter(context, center(row), 1);
      if (!saved.ok) return saved;
      const permission = permissions.upsert(context, {
        id: 'health-care-permission:grant-33-s',
        subjectAccountId: CAREGIVER_ACCOUNT,
        resourceType: 'health_care_center',
        resourceId: CENTER_ID,
        actions: ['read', 'update', 'record'],
        effect: 'allow',
        purpose: 'care',
        startsAt: NOW,
        createdAt: NOW
      });
      return permission.ok ? repository.upsertHealthCareAccessGrant(context, {
        id: 'grant-33-s', centerId: CENTER_ID, familyId: FAMILY, ownerPersonId: OWNER_PERSON,
        caregiverAccountId: CAREGIVER_ACCOUNT, caregiverPersonId: CAREGIVER_PERSON,
        allowedScopes: ['measurements'], actions: ['read', 'record'], state: 'active', startsAt: NOW,
        revision: 1, mutationId: row.id, createdAt: NOW, updatedAt: NOW
      }, null) : permission;
    });
    expect(grantCreated, JSON.stringify(grantCreated)).toMatchObject({ ok: true });

    const measurementCreated = await withReceipt(harness, { actor: caregiver, action: 'update' }, (repository, _permissions, context) => {
      const row = mutation({ actor: caregiver, id: 'mutation-caregiver-measurement', clientOperationId: 'operation-caregiver-measurement', targetId: 'entry-caregiver-measurement', kind: 'entry_record', expectedRevision: 2 });
      const inserted = repository.insertHealthCareMutation(context, row);
      if (!inserted.ok) return inserted;
      const saved = repository.saveHealthCareCenter(context, center(row), 2);
      return saved.ok ? insertEntry(repository, context, row, 'blood_pressure', 'measurements') : saved;
    });
    expect(measurementCreated, JSON.stringify(measurementCreated)).toMatchObject({ ok: true });

    const caregiverView = await withReceipt(harness, { actor: caregiver, action: 'read' }, (repository, _permissions, context) =>
      repository.loadHealthCareCenter(context, key(caregiver))
    );
    expect(caregiverView).toMatchObject({
      ok: true,
      value: {
        visibleScopes: ['measurements'],
        canRecord: true,
        entries: [{ kind: 'blood_pressure', accessScope: 'measurements' }],
        grants: [{ id: 'grant-33-s', caregiverAccountId: CAREGIVER_ACCOUNT }]
      }
    });
    if (caregiverView.ok) expect(caregiverView.value.entries.some((entry) => entry.kind === 'allergy')).toBe(false);
  });

  it('atomically revokes caregiver authority and then denies the caregiver center read', async () => {
    const harness = openHarness();
    expect((await createCenterWithEntry(harness)).ok).toBe(true);
    const grantCreated = await withReceipt(harness, { actor: owner, action: 'update' }, (repository, permissions, context) => {
      const row = mutation({ actor: owner, id: 'mutation-grant-create', clientOperationId: 'operation-grant-create', targetId: 'grant-33-s', kind: 'grant_upsert', expectedRevision: 1 });
      const inserted = repository.insertHealthCareMutation(context, row);
      if (!inserted.ok) return inserted;
      const saved = repository.saveHealthCareCenter(context, center(row), 1);
      if (!saved.ok) return saved;
      const permission = permissions.upsert(context, { id: 'health-care-permission:grant-33-s', subjectAccountId: CAREGIVER_ACCOUNT, resourceType: 'health_care_center', resourceId: CENTER_ID, actions: ['read', 'update', 'record'], effect: 'allow', purpose: 'care', startsAt: NOW, createdAt: NOW });
      return permission.ok ? repository.upsertHealthCareAccessGrant(context, { id: 'grant-33-s', centerId: CENTER_ID, familyId: FAMILY, ownerPersonId: OWNER_PERSON, caregiverAccountId: CAREGIVER_ACCOUNT, caregiverPersonId: CAREGIVER_PERSON, allowedScopes: ['measurements'], actions: ['read', 'record'], state: 'active', startsAt: NOW, revision: 1, mutationId: row.id, createdAt: NOW, updatedAt: NOW }, null) : permission;
    });
    expect(grantCreated.ok).toBe(true);

    const revoked = await withReceipt(harness, { actor: owner, action: 'update' }, (repository, permissions, context) => {
      const row = mutation({ actor: owner, id: 'mutation-grant-revoke', clientOperationId: 'operation-grant-revoke', targetId: 'grant-33-s', kind: 'grant_revoke', expectedRevision: 2 });
      const inserted = repository.insertHealthCareMutation(context, row);
      if (!inserted.ok) return inserted;
      const saved = repository.saveHealthCareCenter(context, center(row), 2);
      if (!saved.ok) return saved;
      const permission = permissions.upsert(context, { id: 'health-care-permission:grant-33-s', subjectAccountId: CAREGIVER_ACCOUNT, resourceType: 'health_care_center', resourceId: CENTER_ID, actions: ['read', 'update', 'record'], effect: 'deny', purpose: 'care', denialReason: 'Bakım veren erişimi veri sahibi tarafından iptal edildi.', startsAt: NOW, createdAt: NOW });
      return permission.ok ? repository.upsertHealthCareAccessGrant(context, { id: 'grant-33-s', centerId: CENTER_ID, familyId: FAMILY, ownerPersonId: OWNER_PERSON, caregiverAccountId: CAREGIVER_ACCOUNT, caregiverPersonId: CAREGIVER_PERSON, allowedScopes: ['measurements'], actions: ['read', 'record'], state: 'revoked', startsAt: NOW, revision: 2, mutationId: row.id, createdAt: NOW, updatedAt: NOW, revokedAt: NOW }, 1) : permission;
    });
    expect(revoked, JSON.stringify(revoked)).toMatchObject({ ok: true });
    expect(harness.runtime.database.prepare("SELECT state,revision FROM health_care_access_grants WHERE id='grant-33-s'").get())
      .toEqual({ state: 'revoked', revision: 2 });

    const denied = await withReceipt(harness, { actor: caregiver, action: 'read' }, (repository, _permissions, context) =>
      repository.loadHealthCareCenter(context, key(caregiver))
    );
    expect(denied.ok).toBe(false);
  });

  it('rejects a receipt for another center before any mutation can persist', async () => {
    const harness = openHarness();
    const forged = await withReceipt(harness, { actor: owner, action: 'update', resourceId: 'health-care-center:other-person' }, (repository, _permissions, context) => {
      const row = mutation({ actor: owner, id: 'mutation-forged', clientOperationId: 'operation-forged', targetId: 'entry-forged', kind: 'entry_record', expectedRevision: 0 });
      return repository.insertHealthCareMutation(context, row);
    });
    expect(forged.ok).toBe(false);
    expect((harness.runtime.database.prepare('SELECT COUNT(*) count FROM health_care_mutations').get() as { count: number }).count).toBe(0);
  });
});
