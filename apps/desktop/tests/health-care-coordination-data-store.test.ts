import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import {
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '@ppt/repositories';
import { FamilyDataStore } from '../src/main/data-store.js';

const POLICY_VERSION = '33-s-health-care-data-store-v1';
const PASSWORD = 'Guclu33SSaglikBakimParolasi!';
const directories: string[] = [];
const stores: FamilyDataStore[] = [];
let projectionSequence = 0;

const kernel = new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('33-s-health-care-data-store-policy-key', 'utf8'),
  applicationCapabilities: {
    'windows-desktop': ['family.read','family.write','health.read','health.write']
  },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create','update','delete','record']
});
const provider: PlatformPolicyAuthorizationProvider = {
  resolvePolicyPackage: () => kernel.policyPackage,
  authorize: ({ request, nonce }) => ({
    effectiveRequest: request,
    authorization: kernel.authorizeWithReceipt(request, request.occurredAt, nonce)
  }),
  verify: ({ request, receipt }) => kernel.verifyReceiptForRequest(receipt, request)
};
const projectionProof = (record: PlatformPolicyReceiptRecord): PlatformPolicyJournalProjectionProof => ({
  schemaVersion: 1,
  receiptHash: computePlatformPolicyReceiptHash(record.receipt),
  recordHash: computePlatformPolicyReceiptRecordHash(record),
  receiptNonce: record.receipt.nonce,
  entrySequence: ++projectionSequence,
  entryHash: 'd'.repeat(64),
  headSequence: projectionSequence,
  headHash: 'd'.repeat(64),
  journalSizeBytes: projectionSequence * 512,
  issuedAt: record.recordedAt,
  proofMac: 'e'.repeat(64)
});

afterEach(() => {
  projectionSequence = 0;
  for (const store of stores.splice(0)) {
    try { store.close(); } catch { /* best-effort */ }
  }
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const makeStore = (governed: boolean) => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-33s-health-care-data-store-'));
  directories.push(directory);
  const databasePath = join(directory, 'family.db');
  const store = new FamilyDataStore({
    databasePath,
    seed: false,
    ...(governed ? {
      archivePolicyAuthorizationProvider: provider,
      archivePolicyReceiptSink: {
        append: () => undefined,
        ensure: projectionProof,
        verifyProjectionProof: () => true
      },
      archivePolicyVersion: POLICY_VERSION,
      archiveClusterFence: () => ({ writable: true, epoch: 97 })
    } : {})
  });
  stores.push(store);
  store.setupAdmin({
    familyName: '33-S Sağlık ve Bakım Ailesi',
    displayName: '33-S Sağlık Yöneticisi',
    email: 'health-care-33s@example.test',
    password: PASSWORD
  });
  return { directory, databasePath, store };
};

describe('33-S health care coordination DataStore integration', () => {
  it('fails closed before reads or writes when the production health PEP is absent', async () => {
    const { store } = makeStore(false);
    const ownerPersonId = store.listAccounts()[0]!.personId!;
    await expect(store.getHealthCareCoordinationCenter(ownerPersonId)).rejects.toThrow(/Health policy enforcement is not composed/u);
    await expect(store.recordHealthCareEntry({
      ownerPersonId,
      expectedRevision: 0,
      clientOperationId: 'operation-health-care-no-pep',
      kind: 'wellbeing_check',
      title: 'Günlük kontrol',
      status: 'completed',
      occurredAt: '2026-08-15T14:00:00.000Z'
    })).rejects.toThrow(/Health policy enforcement is not composed/u);
  });

  it('persists, replays, grants, revokes and atomically rolls back governed local care records', async () => {
    const { databasePath, store } = makeStore(true);
    const ownerAccount = store.listAccounts()[0]!;
    const ownerPersonId = ownerAccount.personId!;
    const caregiverPerson = store.createMember({
      displayName: '33-S Bakım Veren',
      relationshipType: 'Bakım Veren',
      generation: 1,
      branch: 'Ana Dal'
    });
    const caregiverAccountId = 'account-33-s-caregiver';
    const seed = new DatabaseSync(databasePath);
    try {
      seed.prepare('INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,person_id,starts_at) VALUES(?,?,?,?,?,?,?,?,?)')
        .run(caregiverAccountId, '33-S Bakım Veren', 'caregiver-33s@example.test', 'test-password-record', '2026-08-15T13:00:00.000Z', 'caregiver', 'active', caregiverPerson.entityId, '2026-01-01T00:00:00.000Z');
    } finally {
      seed.close();
    }

    const empty = await store.getHealthCareCoordinationCenter(ownerPersonId);
    expect(empty).toMatchObject({ revision: 0, entries: [], caregiverGrants: [], canRecord: true });
    const entryInput = {
      ownerPersonId,
      expectedRevision: 0,
      clientOperationId: 'operation-health-care-entry-33-s',
      kind: 'allergy' as const,
      title: 'Penisilin alerjisi',
      status: 'active' as const,
      occurredAt: '2026-08-15T14:00:00.000Z',
      note: '33-S-HEALTH-PLAINTEXT-CANARY acil kartta gösterilir.'
    };
    const created = await store.recordHealthCareEntry(entryInput);
    expect(created).toMatchObject({ previousRevision: 0, revision: 1, replayed: false, externalDelivery: 'not_performed' });
    expect(await store.recordHealthCareEntry(entryInput)).toMatchObject({ revision: 1, replayed: true });

    const granted = await store.upsertHealthCareAccessGrant({
      ownerPersonId,
      expectedRevision: 1,
      clientOperationId: 'operation-health-care-grant-33-s',
      grantId: 'grant-health-care-33-s',
      caregiverAccountId,
      allowedScopes: ['appointments','measurements'],
      actions: ['read','record'],
      startsAt: '2026-08-15T13:00:00.000Z'
    });
    expect(granted).toMatchObject({ previousRevision: 1, revision: 2, mutationKind: 'grant_upsert' });
    const center = await store.getHealthCareCoordinationCenter(ownerPersonId);
    expect(center).toMatchObject({
      revision: 2,
      entries: [{ kind: 'allergy', accessScope: 'emergency_summary' }],
      caregiverGrants: [{ id: 'grant-health-care-33-s', caregiverAccountId, state: 'active' }],
      truth: {
        localOnly: true,
        medicalVerification: 'not_performed',
        sensorIntegration: 'not_configured',
        emergencyServiceContact: 'not_performed'
      }
    });
    expect(JSON.stringify(center)).not.toContain('mutationId');
    expect(JSON.stringify(center)).not.toContain('recordedByAccountId');
    expect(JSON.stringify(center)).not.toContain('recordedByPersonId');

    const revoked = await store.revokeHealthCareAccessGrant({
      ownerPersonId,
      expectedRevision: 2,
      clientOperationId: 'operation-health-care-revoke-33-s',
      grantId: 'grant-health-care-33-s'
    });
    expect(revoked).toMatchObject({ previousRevision: 2, revision: 3, mutationKind: 'grant_revoke' });

    const injector = new DatabaseSync(databasePath);
    try {
      injector.exec(`
        CREATE TRIGGER test_33s_health_care_outbox_failure
        BEFORE INSERT ON event_outbox
        WHEN NEW.event_type='health_care.entry.recorded'
        BEGIN SELECT RAISE(ABORT,'controlled 33-S health care outbox failure'); END;
      `);
    } finally {
      injector.close();
    }
    await expect(store.recordHealthCareEntry({
      ownerPersonId,
      expectedRevision: 3,
      clientOperationId: 'operation-health-care-rollback-33-s',
      kind: 'help_request',
      title: 'Yerel yardım isteği',
      status: 'needs_help',
      occurredAt: '2026-08-15T14:05:00.000Z'
    })).rejects.toThrow(/SQLite|beklenmeyen/i);

    store.close();
    stores.splice(stores.indexOf(store), 1);
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      expect(database.prepare('SELECT revision FROM health_care_centers WHERE id=?').get(`health-care-center:${ownerPersonId}`))
        .toEqual({ revision: 3 });
      expect(database.prepare('SELECT COUNT(*) count FROM health_care_entries').get()).toEqual({ count: 1 });
      expect(database.prepare('SELECT COUNT(*) count FROM health_care_mutations').get()).toEqual({ count: 3 });
      expect(database.prepare("SELECT state,revision FROM health_care_access_grants WHERE id='grant-health-care-33-s'").get())
        .toEqual({ state: 'revoked', revision: 2 });
      expect(database.prepare("SELECT effect,purpose,denial_reason FROM object_permissions WHERE id='health-care-permission:grant-health-care-33-s'").get())
        .toMatchObject({ effect: 'deny', purpose: 'care' });
      expect(database.prepare("SELECT COUNT(*) count FROM audit_log WHERE action='health_care.entry_recorded'").get())
        .toEqual({ count: 1 });
      expect(database.prepare("SELECT COUNT(*) count FROM event_outbox WHERE event_type='health_care.entry.recorded'").get())
        .toEqual({ count: 1 });
      const metadata = JSON.stringify({
        audits: database.prepare("SELECT action,resource_type,resource_id FROM audit_log WHERE action LIKE 'health_care.%'").all(),
        events: database.prepare("SELECT event_type,aggregate_type,aggregate_id,payload_json FROM event_outbox WHERE event_type LIKE 'health_care.%'").all()
      });
      expect(metadata).not.toContain('33-S-HEALTH-PLAINTEXT-CANARY');
      expect(metadata).not.toContain('Penisilin');
    } finally {
      database.close();
    }
  });
});
