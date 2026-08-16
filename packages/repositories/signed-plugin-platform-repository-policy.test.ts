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
import { PlatformPolicyEnforcementPoint, PlatformPolicyKernel } from '@ppt/platform-policy';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult,
  SignedPluginInstallationRow,
  SignedPluginMutationRow,
  SignedPluginPlatformCenterKey,
  SignedPluginReleaseRow,
  TransactionContext
} from '@ppt/repository-contracts';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';
import { SqlitePlatformPolicyTransactionRepository } from './src/platform-policy-transaction-repository.js';
import { SqliteSignedPluginPlatformRepository } from './src/signed-plugin-platform-repository.js';

let now = asIsoDateTime('2026-08-15T12:00:00.000Z');
const FAMILY = asFamilyId('family-33-z-repository');
const ACCOUNT = asUserId('account-33-z-owner');
const OWNER = asPersonId('person-33-z-owner');
const OTHER = asPersonId('person-33-z-other');
const FENCE = 'signed-plugin-write';
const EPOCH = 104;
const clock: Clock = { now: () => now };
const runtimes: SqliteFamilyDatabaseRuntime[] = [];
const directories: string[] = [];

afterEach(() => {
  now = asIsoDateTime('2026-08-15T12:00:00.000Z');
  for (const runtime of runtimes.splice(0)) runtime.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const repositoryContext = (transaction: TransactionContext): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: { userId: ACCOUNT, personId: OWNER, roles: ['family_admin'] },
  correlationId: transaction.correlationId,
  occurredAt: transaction.occurredAt
});

const openHarness = () => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-33z-signed-plugin-'));
  directories.push(directory);
  const runtime = new SqliteFamilyDatabaseRuntime({
    databasePath: join(directory, 'family.db'),
    applicationVersion: '33-z-vitest',
    clock,
    skipFileMigrationSafetyBackup: true,
    databaseConfig: { busyTimeoutMs: 5000, journalMode: 'WAL', synchronous: 'FULL' }
  });
  runtimes.push(runtime);
  const policyRepository = new SqlitePlatformPolicyTransactionRepository();
  expect(runtime.transactionExecutor.execute(asCorrelationId('33-z-fence'), (transaction) =>
    policyRepository.synchronizeFence(repositoryContext(transaction), {
      fenceName: FENCE, epoch: EPOCH, writable: true, synchronizedAt: now
    })).ok).toBe(true);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run(FAMILY, '33-Z Family', now);
  const insertPerson = runtime.database.prepare(`INSERT INTO people(
    id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at
  ) VALUES(?,?,?,?,?,?,?,?,?)`);
  insertPerson.run(OWNER, FAMILY, 'Owner', '1985-01-01', 'self', 0, 'main', 'active', now);
  insertPerson.run(OTHER, FAMILY, 'Other', '1986-01-01', 'partner', 0, 'main', 'active', now);
  runtime.database.prepare(`INSERT INTO accounts(
    id,display_name,email,password_record,created_at,role,status,person_id,starts_at
  ) VALUES(?,?,?,?,?,?,?,?,?)`).run(
    ACCOUNT, 'Owner', 'owner-33z@example.test', 'test-password-record', now,
    'family_admin', 'active', OWNER, '2026-01-01T00:00:00.000Z'
  );
  return { runtime, repository: new SqliteSignedPluginPlatformRepository(), policyRepository };
};

type Harness = ReturnType<typeof openHarness>;
let sequence = 0;
const kernel = new PlatformPolicyKernel({
  policyVersion: '33-z-signed-plugin-policy-v1',
  signingKey: Buffer.from('33-z-signed-plugin-policy-key-material', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete']
});

type ResourceType = 'signed_plugin_platform_center' | 'signed_plugin_installation';
const withReceipt = async <T>(
  harness: Harness,
  input: {
    action: 'read' | 'create' | 'update' | 'delete';
    resourceType: ResourceType;
    resourceId: string;
    ownerPersonId?: string;
  },
  operation: (
    repository: SqliteSignedPluginPlatformRepository,
    context: PolicyAuthorizedRepositoryExecutionContext
  ) => RepositoryResult<T>
) => {
  sequence += 1;
  const correlationId = asCorrelationId(`signed-plugin-${input.action}-${sequence}`);
  const capability = input.action === 'read' ? 'family.read' : 'family.write';
  const pep = new PlatformPolicyEnforcementPoint({
    kernel,
    authorityResolver: { resolve: () => ({
      policyVersion: '33-z-signed-plugin-policy-v1',
      accountId: ACCOUNT,
      personId: OWNER,
      deviceId: 'device-33-z',
      applicationId: 'windows-desktop',
      deviceTrusted: true,
      membershipActive: true,
      roles: ['family_admin'],
      familyIds: [FAMILY],
      grants: [{
        id: `grant-${sequence}`,
        subjectAccountId: ACCOUNT,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        actions: [input.action],
        purposes: ['general'],
        effect: 'allow',
        startsAt: '2026-01-01T00:00:00.000Z'
      }],
      online: true,
      expiresAt: '2027-12-31T23:59:59.999Z'
    }) },
    resourceResolver: { resolve: () => ({
      type: input.resourceType,
      id: input.resourceId,
      familyId: FAMILY,
      ownerPersonId: input.ownerPersonId ?? OWNER,
      sensitivity: 'highly_sensitive',
      dataClasses: ['personal'] as const,
      classificationSource: 'declared' as const
    }) },
    receiptSink: { append: () => undefined, ensure: () => undefined },
    replayStore: { reserve: (reservation) => {
      const result = harness.runtime.transactionExecutor.execute(
        asCorrelationId(`signed-plugin-reserve-${sequence}`),
        (transaction) => harness.policyRepository.reserveReplayNonce(repositoryContext(transaction), reservation)
      );
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    } },
    clock: () => now,
    nonceFactory: () => `nonce-signed-plugin-${sequence}`,
    deferAllowedReceiptPersistence: true
  });
  return pep.execute({
    correlationId,
    action: input.action,
    capability,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    purpose: 'general'
  }, () => ({ writable: true, epoch: EPOCH }), (authorization) =>
    harness.runtime.transactionExecutor.execute(correlationId, (transaction) => {
      const context: PolicyAuthorizedRepositoryExecutionContext = {
        ...repositoryContext(transaction), correlationId, policyAuthorization: authorization
      };
      const recorded = harness.policyRepository.recordAuthorizedTransaction(context, {
        record: authorization.receiptRecord,
        fenceName: FENCE,
        fenceEpoch: EPOCH,
        fenceWritable: true
      });
      return recorded.ok ? operation(harness.repository, context) : recorded;
    }));
};

const key: SignedPluginPlatformCenterKey = {
  familyId: FAMILY,
  accountId: ACCOUNT,
  actorPersonId: OWNER,
  ownerPersonId: OWNER,
  centerId: `signed-plugin-platform:${FAMILY}:${OWNER}`
};

const createRows = () => {
  const mutation: SignedPluginMutationRow = {
    id: '1'.repeat(64), familyId: FAMILY, ownerPersonId: OWNER,
    resourceType: 'signed_plugin_installation', resourceId: 'local.bank-reader',
    actorAccountId: ACCOUNT, actorPersonId: OWNER, mutationKind: 'release_register',
    clientOperationId: 'register-local-bank-reader', requestFingerprint: '2'.repeat(64),
    expectedRevision: 0, revision: 1, resourceStateFingerprint: '3'.repeat(64), occurredAt: now
  };
  const release: SignedPluginReleaseRow = {
    id: '4'.repeat(64), familyId: FAMILY, ownerPersonId: OWNER, pluginId: mutation.resourceId,
    displayName: 'Yerel banka okuyucu', version: '1.0.0', minimumHostVersion: '4.8.2026-29', manifestSha256: '5'.repeat(64),
    packageSha256: '6'.repeat(64), entrypointSha256: '7'.repeat(64), sbomSha256: '8'.repeat(64),
    licenseInventorySha256: '9'.repeat(64), provenanceSha256: 'a'.repeat(64), signerKeyId: 'trusted-key-33-z',
    providerKinds: ['bank'], capabilityCodes: ['bank.read'], dataDeclarations: [{
      resourceType: 'finance_record', sensitivity: 'highly_sensitive', purpose: 'finance',
      access: 'read_metadata', retentionDays: 0
    }], egressMode: 'none', egressHosts: [], sandboxProfile: 'isolated_child_process', signatureVerified: true,
    verifiedAt: now, issuedAt: asIsoDateTime('2026-08-15T10:00:00.000Z'),
    expiresAt: asIsoDateTime('2026-09-01T00:00:00.000Z'), releaseFingerprint: 'b'.repeat(64),
    mutationId: mutation.id
  };
  const installation: SignedPluginInstallationRow = {
    id: mutation.resourceId, familyId: FAMILY, ownerPersonId: OWNER, displayName: release.displayName,
    currentVersion: release.version, currentReleaseId: release.id, desiredState: 'disabled',
    runtimeExecutionReady: false, externalProviderConnectionReady: false, revision: 1,
    stateFingerprint: mutation.resourceStateFingerprint, lastMutationId: mutation.id,
    createdAt: now, updatedAt: now
  };
  return { mutation, release, installation };
};

describe('33-Z signed plugin repository policy boundary', () => {
  it('persists immutable verified release evidence and loads an owner-bounded center', async () => {
    const harness = openHarness();
    const rows = createRows();
    const result = await withReceipt(harness, {
      action: 'create', resourceType: 'signed_plugin_installation', resourceId: rows.installation.id
    }, (repository, context) => {
      const ledger = repository.insertMutation(context, rows.mutation);
      if (!ledger.ok) return ledger;
      const release = repository.insertRelease(context, rows.release);
      return release.ok ? repository.insertInstallation(context, rows.installation) : release;
    });
    expect(result.ok).toBe(true);
    expect(await withReceipt(harness, {
      action: 'read', resourceType: 'signed_plugin_platform_center', resourceId: '*'
    }, (repository, context) => repository.loadCenter(context, key))).toMatchObject({
      ok: true,
      value: { installations: [{ installation: { id: 'local.bank-reader', desiredState: 'disabled' }, releaseCount: 1 }],
        installationTotal: 1, mutationCount: 1 }
    });
    expect(harness.runtime.transactionExecutor.execute(asCorrelationId('33-z-foreign-owner-resolver'), (transaction) =>
      harness.repository.resolvePolicyResource({ ...repositoryContext(transaction), actor: {
        userId: ACCOUNT, personId: OTHER, roles: ['family_admin']
      } }, 'signed_plugin_installation', 'local.bank-reader'))).toMatchObject({ ok: true, value: null });
  });

  it('updates desired state only through the exact revision-bound mutation', async () => {
    const harness = openHarness();
    const rows = createRows();
    await withReceipt(harness, {
      action: 'create', resourceType: 'signed_plugin_installation', resourceId: rows.installation.id
    }, (repository, context) => {
      const ledger = repository.insertMutation(context, rows.mutation);
      if (!ledger.ok) return ledger;
      const release = repository.insertRelease(context, rows.release);
      return release.ok ? repository.insertInstallation(context, rows.installation) : release;
    });
    const mutation: SignedPluginMutationRow = {
      ...rows.mutation, id: 'c'.repeat(64), mutationKind: 'desired_enable', clientOperationId: 'enable-local-bank-reader',
      requestFingerprint: 'd'.repeat(64), expectedRevision: 1, revision: 2,
      resourceStateFingerprint: 'e'.repeat(64)
    };
    const installation: SignedPluginInstallationRow = {
      ...rows.installation, desiredState: 'enabled', revision: 2, stateFingerprint: mutation.resourceStateFingerprint,
      lastMutationId: mutation.id, updatedAt: now
    };
    expect((await withReceipt(harness, {
      action: 'update', resourceType: 'signed_plugin_installation', resourceId: installation.id
    }, (repository, context) => {
      const ledger = repository.insertMutation(context, mutation);
      return ledger.ok ? repository.saveInstallation(context, installation, 1) : ledger;
    })).ok).toBe(true);
    expect(harness.runtime.database.prepare('SELECT desired_state,revision FROM signed_plugin_installations').get())
      .toEqual({ desired_state: 'enabled', revision: 2 });
  });

  it('rejects a forged owner receipt without leaving durable evidence', async () => {
    const harness = openHarness();
    const rows = createRows();
    expect((await withReceipt(harness, {
      action: 'create', resourceType: 'signed_plugin_installation', resourceId: rows.installation.id,
      ownerPersonId: OTHER
    }, (repository, context) => repository.insertMutation(context, rows.mutation))).ok).toBe(false);
    expect(harness.runtime.database.prepare('SELECT COUNT(*) count FROM signed_plugin_mutations').get()).toEqual({ count: 0 });
  });

  it('keeps release and mutation evidence immutable', async () => {
    const harness = openHarness();
    const rows = createRows();
    await withReceipt(harness, {
      action: 'create', resourceType: 'signed_plugin_installation', resourceId: rows.installation.id
    }, (repository, context) => {
      const ledger = repository.insertMutation(context, rows.mutation);
      if (!ledger.ok) return ledger;
      const release = repository.insertRelease(context, rows.release);
      return release.ok ? repository.insertInstallation(context, rows.installation) : release;
    });
    expect(() => harness.runtime.database.prepare('UPDATE signed_plugin_releases SET display_name=?').run('Degistirildi')).toThrow();
    expect(() => harness.runtime.database.prepare('DELETE FROM signed_plugin_mutations').run()).toThrow();
    expect(harness.runtime.database.prepare('SELECT COUNT(*) count FROM signed_plugin_releases').get()).toEqual({ count: 1 });
    expect(harness.runtime.database.prepare('SELECT COUNT(*) count FROM signed_plugin_mutations').get()).toEqual({ count: 1 });
  });

  it('keeps emergency disable locked until an exact higher signed release replaces it', async () => {
    const harness = openHarness();
    const rows = createRows();
    await withReceipt(harness, {
      action: 'create', resourceType: 'signed_plugin_installation', resourceId: rows.installation.id
    }, (repository, context) => {
      const ledger = repository.insertMutation(context, rows.mutation); if (!ledger.ok) return ledger;
      const inserted = repository.insertRelease(context, rows.release);
      return inserted.ok ? repository.insertInstallation(context, rows.installation) : inserted;
    });
    now = asIsoDateTime('2026-08-15T12:00:01.000Z');
    const emergencyMutation: SignedPluginMutationRow = { ...rows.mutation, id: 'c'.repeat(64),
      mutationKind: 'emergency_disable', clientOperationId: 'emergency-lock', requestFingerprint: 'd'.repeat(64),
      expectedRevision: 1, revision: 2, resourceStateFingerprint: 'e'.repeat(64), occurredAt: now };
    const emergency: SignedPluginInstallationRow = { ...rows.installation, desiredState: 'emergency_disabled',
      revision: 2, stateFingerprint: emergencyMutation.resourceStateFingerprint, lastMutationId: emergencyMutation.id,
      updatedAt: now, emergencyDisabledAt: now };
    expect((await withReceipt(harness, { action: 'delete', resourceType: 'signed_plugin_installation',
      resourceId: emergency.id }, (repository, policy) => {
      const ledger = repository.insertMutation(policy, emergencyMutation);
      return ledger.ok ? repository.saveInstallation(policy, emergency, 1) : ledger;
    })).ok).toBe(true);
    now = asIsoDateTime('2026-08-15T12:00:02.000Z');
    const bypassMutation: SignedPluginMutationRow = { ...emergencyMutation, id: 'f'.repeat(64),
      mutationKind: 'desired_disable', clientOperationId: 'bypass-emergency-lock', requestFingerprint: '1'.repeat(64),
      expectedRevision: 2, revision: 3, resourceStateFingerprint: '2'.repeat(64), occurredAt: now };
    const { emergencyDisabledAt: _emergencyDisabledAt, ...emergencyBase } = emergency;
    const bypass: SignedPluginInstallationRow = { ...emergencyBase, desiredState: 'disabled', revision: 3,
      stateFingerprint: bypassMutation.resourceStateFingerprint, lastMutationId: bypassMutation.id, updatedAt: now };
    expect((await withReceipt(harness, { action: 'update', resourceType: 'signed_plugin_installation',
      resourceId: bypass.id }, (repository, policy) => {
      const ledger = repository.insertMutation(policy, bypassMutation);
      return ledger.ok ? repository.saveInstallation(policy, bypass, 2) : ledger;
    })).ok).toBe(false);
    expect(harness.runtime.database.prepare('SELECT desired_state,revision FROM signed_plugin_installations').get())
      .toEqual({ desired_state: 'emergency_disabled', revision: 2 });
    expect(harness.runtime.database.prepare('SELECT COUNT(*) count FROM signed_plugin_mutations').get()).toEqual({ count: 2 });
  });
});
