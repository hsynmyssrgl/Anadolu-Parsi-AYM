import { DatabaseSync } from 'node:sqlite';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  asCorrelationId,
  asIsoDateTime,
  asUserId
} from '@ppt/core';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import type { PolicyAuthorizedRepositoryExecutionContext } from '@ppt/repository-contracts';
import {
  SqliteHealthRepository,
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '@ppt/repositories';
import { FamilyDataStore } from '../src/main/data-store.js';

const POLICY_VERSION = '30-x-health-policy-test-v1';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const temporaryDirectories: string[] = [];
const openStores: FamilyDataStore[] = [];

const kernel = new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('30-x-health-policy-controlled-signing-key-v1', 'utf8'),
  applicationCapabilities: {
    'windows-desktop': ['family.read', 'family.write', 'health.read', 'health.write', 'finance.read', 'finance.write', 'location.read', 'archive.write']
  },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

const provider: PlatformPolicyAuthorizationProvider = Object.freeze({
  resolvePolicyPackage: () => kernel.policyPackage,
  authorize({ request, nonce }) {
    return Object.freeze({
      effectiveRequest: request,
      authorization: kernel.authorizeWithReceipt(request, request.occurredAt, nonce)
    });
  },
  verify({ request, receipt }) {
    return kernel.verifyReceiptForRequest(receipt, request);
  }
});

const projectionProof = (
  record: PlatformPolicyReceiptRecord
): PlatformPolicyJournalProjectionProof => Object.freeze({
  schemaVersion: 1,
  receiptHash: computePlatformPolicyReceiptHash(record.receipt),
  recordHash: computePlatformPolicyReceiptRecordHash(record),
  receiptNonce: record.receipt.nonce,
  entrySequence: 1,
  entryHash: '9'.repeat(64),
  headSequence: 1,
  headHash: '9'.repeat(64),
  journalSizeBytes: 512,
  issuedAt: record.recordedAt,
  proofMac: 'a'.repeat(64)
});

const decodeBase32 = (value: string): Buffer => {
  let bits = '';
  for (const character of value) {
    bits += BASE32_ALPHABET.indexOf(character).toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
};

const currentTotp = (secret: string): string => {
  const counter = Math.floor(Date.now() / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary = ((digest[offset]! & 0x7f) << 24)
    | ((digest[offset + 1]! & 0xff) << 16)
    | ((digest[offset + 2]! & 0xff) << 8)
    | (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
};

const makeDirectory = (prefix: string): string => {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
};

const trackStore = (store: FamilyDataStore): FamilyDataStore => {
  openStores.push(store);
  return store;
};

const closeStore = (store: FamilyDataStore): void => {
  const index = openStores.indexOf(store);
  if (index >= 0) openStores.splice(index, 1);
  store.close();
};

const makeProductionStore = (writable = true) => {
  const directory = makeDirectory('ppt-30x-health-policy-');
  const store = trackStore(new FamilyDataStore({
    databasePath: join(directory, 'family.db'),
    seed: false,
    archivePolicyAuthorizationProvider: provider,
    archivePolicyReceiptSink: {
      append: () => undefined,
      ensure: projectionProof,
      verifyProjectionProof: () => true
    },
    archivePolicyVersion: POLICY_VERSION,
    archiveClusterFence: () => ({ writable, epoch: 31 })
  }));
  store.setupAdmin({
    familyName: '30-X Sağlık Ailesi',
    displayName: '30-X Sağlık Yöneticisi',
    email: 'health-30x@example.com',
    password: 'Saglik30XGucluParola!'
  });
  return { directory, store };
};

afterEach(() => {
  for (const store of openStores.splice(0)) {
    try { store.close(); } catch { /* best-effort test cleanup */ }
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('30-X governed health policy enforcement', () => {
  it('fails closed when no health PEP is composed', async () => {
    const directory = makeDirectory('ppt-30x-health-fail-closed-');
    const store = trackStore(new FamilyDataStore({
      databasePath: join(directory, 'family.db'),
      seed: false
    }));
    store.setupAdmin({
      familyName: 'Kapalı Sağlık Ailesi',
      displayName: 'Kapalı Sağlık Yöneticisi',
      password: 'KapaliSaglik30XParola!'
    });

    const ownerPersonId = store.listAccounts()[0]!.personId!;
    await expect(store.listHealthRecords()).rejects.toThrow(/Health policy enforcement is not composed/u);
    await expect(store.listMedicationPlans()).rejects.toThrow(/Health policy enforcement is not composed/u);
    await expect(store.listFamilyHealthHistory()).rejects.toThrow(/Health policy enforcement is not composed/u);
    await expect(store.createHealthRecord({
      ownerPersonId,
      title: 'PEP olmadan sağlık kaydı',
      kind: 'appointment',
      privacy: 'private',
      occurredAt: '2026-08-08T00:00:00.000Z'
    })).rejects.toThrow(/Health policy enforcement is not composed/u);
    await expect(store.createMedicationPlan({
      ownerPersonId,
      name: 'PEP olmadan ilaç',
      dosage: '1 tablet',
      schedule: 'Günde bir',
      startsAt: '2026-08-08T00:00:00.000Z',
      privacy: 'private'
    })).rejects.toThrow(/Health policy enforcement is not composed/u);
    await expect(store.createFamilyHealthHistory({
      relatedPersonId: ownerPersonId,
      condition: 'PEP olmadan aile öyküsü',
      privacy: 'private'
    })).rejects.toThrow(/Health policy enforcement is not composed/u);
    closeStore(store);
  });

  it('rejects a forged repository context before any health SQL executes', () => {
    const forged = {
      transaction: Object.freeze({}),
      actor: { userId: asUserId('forged-health-account'), roles: ['family_admin'] },
      correlationId: asCorrelationId('forged-health-context'),
      occurredAt: asIsoDateTime('2026-08-08T00:00:00.000Z'),
      policyAuthorization: Object.freeze({})
    } as unknown as PolicyAuthorizedRepositoryExecutionContext;
    const repository = new SqliteHealthRepository();

    expect(() => repository.listHealthRecords(forged)).toThrow(/transaction context.*forged/i);
    expect(() => repository.listMedicationPlans(forged)).toThrow(/transaction context.*forged/i);
    expect(() => repository.listFamilyHealthHistory(forged)).toThrow(/transaction context.*forged/i);
  });

  it('rejects health access when the live production fence is not writable', async () => {
    const { store } = makeProductionStore(false);

    await expect(store.listHealthRecords()).rejects.toThrow(/writable|fence/i);
    closeStore(store);
  });

  it('rejects an authority-to-transaction fence race during revalidation', async () => {
    const directory = makeDirectory('ppt-30x-health-fence-race-');
    let writable = true;
    const racingProvider: PlatformPolicyAuthorizationProvider = Object.freeze({
      resolvePolicyPackage: (applicationId) => provider.resolvePolicyPackage!(applicationId),
      authorize(input) {
        const authorization = provider.authorize(input);
        writable = false;
        return authorization;
      },
      verify(input) {
        return provider.verify(input);
      }
    });
    const store = trackStore(new FamilyDataStore({
      databasePath: join(directory, 'family.db'),
      seed: false,
      archivePolicyAuthorizationProvider: racingProvider,
      archivePolicyReceiptSink: {
        append: () => undefined,
        ensure: projectionProof,
        verifyProjectionProof: () => true
      },
      archivePolicyVersion: POLICY_VERSION,
      archiveClusterFence: () => ({ writable, epoch: 31 })
    }));
    store.setupAdmin({
      familyName: '30-X Fence Race Ailesi',
      displayName: '30-X Fence Race Yoneticisi',
      email: 'health-30x-fence-race@example.com',
      password: 'FenceRace30XGucluParola!'
    });

    await expect(store.listHealthRecords()).rejects.toThrow(/writable|fence|revalidation/i);
    closeStore(store);
  });

  it('returns a committed create once and recovers its pending journal projection', async () => {
    const directory = makeDirectory('ppt-30x-health-projection-recovery-');
    let ensureCalls = 0;
    const store = trackStore(new FamilyDataStore({
      databasePath: join(directory, 'family.db'),
      seed: false,
      archivePolicyAuthorizationProvider: provider,
      archivePolicyReceiptSink: {
        append: () => undefined,
        ensure: (record) => {
          ensureCalls += 1;
          if (ensureCalls === 2) throw new Error('controlled first write projection failure');
          return projectionProof(record);
        },
        verifyProjectionProof: () => true
      },
      archivePolicyVersion: POLICY_VERSION,
      archiveClusterFence: () => ({ writable: true, epoch: 31 })
    }));
    store.setupAdmin({
      familyName: '30-X Recovery Ailesi',
      displayName: '30-X Recovery Yoneticisi',
      email: 'health-30x-recovery@example.com',
      password: 'Recovery30XGucluParola!'
    });
    const ownerPersonId = store.listAccounts()[0]!.personId!;

    const created = await store.createHealthRecord({
      ownerPersonId,
      title: 'Projeksiyon sonrasi tek kayit',
      kind: 'appointment',
      privacy: 'private',
      occurredAt: '2026-08-08T00:40:00.000Z'
    });
    expect(created.filter((record) => record.title === 'Projeksiyon sonrasi tek kayit')).toHaveLength(1);
    expect(ensureCalls).toBe(2);

    const recovered = await store.listHealthRecords();
    expect(recovered.filter((record) => record.title === 'Projeksiyon sonrasi tek kayit')).toHaveLength(1);
    expect(ensureCalls).toBeGreaterThanOrEqual(4);
    closeStore(store);

    const database = new DatabaseSync(join(directory, 'family.db'), { readOnly: true });
    try {
      expect(Number(database.prepare(
        "SELECT COUNT(*) AS count FROM health_records WHERE title='Projeksiyon sonrasi tek kayit'"
      ).get()!.count)).toBe(1);
      expect(Number(database.prepare(
        "SELECT COUNT(*) AS count FROM platform_policy_journal_projection_outbox WHERE status='pending'"
      ).get()!.count)).toBe(0);
    } finally {
      database.close();
    }
  });

  it('rolls back health data, receipt, audit and outbox when the domain outbox write fails', async () => {
    const { directory, store } = makeProductionStore();
    const owner = (await store.getSnapshot()).people[0]!;
    const databasePath = join(directory, 'family.db');
    const faultInjector = new DatabaseSync(databasePath);
    try {
      faultInjector.exec(`
        CREATE TRIGGER test_30x_health_outbox_failure
        BEFORE INSERT ON event_outbox
        WHEN NEW.event_type='health.record.created'
        BEGIN
          SELECT RAISE(ABORT,'controlled health outbox failure');
        END;
      `);
    } finally {
      faultInjector.close();
    }

    await expect(store.createHealthRecord({
      ownerPersonId: owner.id,
      title: 'Atomik geri alma kaydi',
      kind: 'note',
      privacy: 'private',
      occurredAt: '2026-08-08T00:50:00.000Z'
    })).rejects.toThrow(/SQLite|beklenmeyen/i);
    closeStore(store);

    const probe = new DatabaseSync(databasePath, { readOnly: true });
    try {
      expect(Number(probe.prepare(
        "SELECT COUNT(*) AS count FROM health_records WHERE title='Atomik geri alma kaydi'"
      ).get()!.count)).toBe(0);
      expect(Number(probe.prepare(
        "SELECT COUNT(*) AS count FROM audit_log WHERE action='health.created'"
      ).get()!.count)).toBe(0);
      expect(Number(probe.prepare(
        "SELECT COUNT(*) AS count FROM event_outbox WHERE event_type='health.record.created'"
      ).get()!.count)).toBe(0);
      expect(Number(probe.prepare(`
        SELECT COUNT(*) AS count
        FROM platform_policy_transaction_receipts
        WHERE resource_type='health_record' AND action='create'
      `).get()!.count)).toBe(0);
    } finally {
      probe.close();
    }
  });

  it('does not leak another person medication details through reports or automation', async () => {
    const { store } = makeProductionStore();
    const administrator = (await store.getSnapshot()).people[0]!;
    const invitedPerson = store.createMember({
      displayName: '30-X Davetli Uye',
      relationshipType: 'Yetiskin uye',
      generation: 1,
      branch: 'Ana Dal'
    }).person!;

    const administratorPlans = await store.createMedicationPlan({
      ownerPersonId: administrator.id,
      name: 'Yonetici gizli ilac adi',
      dosage: '1 tablet',
      schedule: 'Her gun 09:00',
      startsAt: '2026-08-07T00:00:00.000Z',
      privacy: 'private'
    });
    const administratorPlan = administratorPlans.find(
      (row) => row.name === 'Yonetici gizli ilac adi'
    )!;
    const invitation = store.createInvitation({
      email: 'health-30x-invited@example.com',
      role: 'adult_member',
      personId: invitedPerson.id
    });

    store.logout();
    store.acceptInvitation({
      token: invitation.token,
      displayName: '30-X Davetli Uye',
      password: 'Davetli30XGucluParola!'
    });
    const twoFactor = store.beginTwoFactorSetup();
    store.enableTwoFactor({ code: currentTotp(twoFactor.secret) });
    store.trustCurrentDevice({
      password: 'Davetli30XGucluParola!',
      code: twoFactor.recoveryCodes[0]!,
      displayName: '30-X health privacy test device'
    });
    const invitedPlans = await store.createMedicationPlan({
      ownerPersonId: invitedPerson.id,
      name: 'Davetli gizli ilac adi',
      dosage: '1 tablet',
      schedule: 'Her gun 10:00',
      startsAt: '2026-08-07T00:00:00.000Z',
      privacy: 'private'
    });
    const invitedPlan = invitedPlans.find((row) => row.name === 'Davetli gizli ilac adi')!;
    await store.createAutomationRule({
      title: 'Ilac zamani',
      sourceType: 'medication_plan',
      daysBefore: 7
    });

    expect((await store.getReportSummary()).activeMedicationPlans).toBe(1);
    const generatedRuns = (await store.runAutomationRules({
      now: '2026-08-06T00:00:00.000Z'
    })).filter((run) => run.status === 'generated');
    expect(generatedRuns).toHaveLength(1);
    expect(generatedRuns[0]!.sourceId).toBe(invitedPlan.id);
    expect(generatedRuns[0]!.sourceId).not.toBe(administratorPlan.id);
    expect(generatedRuns[0]!.title).not.toContain('Yonetici gizli ilac adi');
    expect(generatedRuns[0]!.title).not.toContain('Davetli gizli ilac adi');
    closeStore(store);
  });

  it('persists exact receipts and rejects missing, copied, stale and deletion writes', async () => {
    const { directory, store } = makeProductionStore();
    const owner = (await store.getSnapshot()).people[0]!;
    const records = await store.createHealthRecord({
      ownerPersonId: owner.id,
      title: '30-X korumalı kontrol',
      kind: 'appointment',
      privacy: 'private',
      occurredAt: '2026-08-08T00:10:00.000Z'
    });
    const record = records.find((row) => row.title === '30-X korumalı kontrol')!;
    const plans = await store.createMedicationPlan({
      ownerPersonId: owner.id,
      name: '30-X korumalı ilaç',
      dosage: '1 tablet',
      schedule: 'Her gün 08:00',
      startsAt: '2026-08-08T00:20:00.000Z',
      privacy: 'private'
    });
    const plan = plans.find((row) => row.name === '30-X korumalı ilaç')!;
    const histories = await store.createFamilyHealthHistory({
      relatedPersonId: owner.id,
      condition: '30-X korumalı aile öyküsü',
      diagnosedAt: '2026-08-08T00:30:00.000Z',
      privacy: 'private'
    });
    const history = histories.find((row) => row.condition === '30-X korumalı aile öyküsü')!;
    closeStore(store);

    const database = new DatabaseSync(join(directory, 'family.db'));
    try {
      const receiptColumns = `
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
        policy_correlation_id,policy_resource_type,policy_resource_id,
        policy_action,policy_capability
      `;
      const persistedRecord = database.prepare(
        `SELECT ${receiptColumns} FROM health_records WHERE id=?`
      ).get(record.id) as Record<string, unknown>;
      const persistedPlan = database.prepare(
        `SELECT ${receiptColumns} FROM medication_plans WHERE id=?`
      ).get(plan.id) as Record<string, unknown>;
      const persistedHistory = database.prepare(
        `SELECT ${receiptColumns} FROM family_health_history WHERE id=?`
      ).get(history.id) as Record<string, unknown>;

      for (const [persisted, resourceType, resourceId] of [
        [persistedRecord, 'health_record', record.id],
        [persistedPlan, 'medication_plan', plan.id],
        [persistedHistory, 'family_health_history', history.id]
      ] as const) {
        expect(persisted).toMatchObject({
          policy_receipt_version: 1,
          policy_resource_type: resourceType,
          policy_resource_id: resourceId,
          policy_action: 'create',
          policy_capability: 'health.write'
        });
        expect(String(persisted.policy_receipt_hash)).toMatch(/^[0-9a-f]{64}$/u);
        expect(String(persisted.policy_receipt_nonce).length).toBeGreaterThan(0);
        expect(String(persisted.policy_correlation_id).length).toBeGreaterThan(0);
      }

      const projected = Number(database.prepare(`
        SELECT COUNT(*) AS count
        FROM platform_policy_journal_projection_outbox
        WHERE receipt_hash IN (?,?,?) AND status='projected'
      `).get(
        persistedRecord.policy_receipt_hash,
        persistedPlan.policy_receipt_hash,
        persistedHistory.policy_receipt_hash
      )!.count);
      expect(projected).toBe(3);

      expect(() => database.prepare(`
        INSERT INTO health_records(
          id,family_id,owner_person_id,title,kind,privacy,occurred_at,created_at
        ) VALUES(?,?,?,?,?,?,?,?)
      `).run(
        'health-direct-no-receipt', 'family-main', owner.id, 'Doğrudan sağlık',
        'appointment', 'private', '2026-08-08T01:00:00.000Z', '2026-08-08T01:00:00.000Z'
      )).toThrow(/exact durable policy receipt/u);

      expect(() => database.prepare(`
        INSERT INTO medication_plans(
          id,family_id,owner_person_id,name,dosage,schedule,starts_at,privacy,created_at
        ) VALUES(?,?,?,?,?,?,?,?,?)
      `).run(
        'medication-direct-no-receipt', 'family-main', owner.id, 'Doğrudan ilaç',
        '1 tablet', 'Günde bir', '2026-08-08T01:00:00.000Z', 'private', '2026-08-08T01:00:00.000Z'
      )).toThrow(/exact durable policy receipt/u);

      expect(() => database.prepare(`
        INSERT INTO family_health_history(
          id,family_id,related_person_id,condition,privacy,created_at
        ) VALUES(?,?,?,?,?,?)
      `).run(
        'history-direct-no-receipt', 'family-main', owner.id, 'Doğrudan öykü',
        'private', '2026-08-08T01:00:00.000Z'
      )).toThrow(/exact durable policy receipt/u);

      expect(() => database.prepare(`
        INSERT INTO health_records(
          id,family_id,owner_person_id,title,kind,privacy,provider,notes,occurred_at,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        )
        SELECT ?,family_id,owner_person_id,title,kind,privacy,provider,notes,occurred_at,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        FROM health_records WHERE id=?
      `).run('health-copied-receipt', record.id)).toThrow(/exact durable policy receipt/u);

      expect(() => database.prepare(
        'UPDATE medication_plans SET dosage=? WHERE id=?'
      ).run('2 tablet', plan.id)).toThrow(/fresh exact durable policy receipt/u);
      expect(() => database.prepare(
        'DELETE FROM family_health_history WHERE id=?'
      ).run(history.id)).toThrow(/governed deletion workflow/u);
      expect(() => database.prepare(
        'DELETE FROM health_records WHERE id=?'
      ).run(record.id)).toThrow(/governed deletion workflow/u);
      expect(() => database.prepare(
        'DELETE FROM medication_plans WHERE id=?'
      ).run(plan.id)).toThrow(/governed deletion workflow/u);

      database.exec(`
        DROP TRIGGER trg_platform_policy_health_record_delete;
        DROP TRIGGER trg_platform_policy_medication_plan_delete;
        DROP TRIGGER trg_platform_policy_family_health_history_delete;
      `);
      database.prepare('DELETE FROM health_records WHERE id=?').run(record.id);
      database.prepare('DELETE FROM medication_plans WHERE id=?').run(plan.id);
      database.prepare('DELETE FROM family_health_history WHERE id=?').run(history.id);

      expect(() => database.prepare(`
        INSERT INTO health_records(
          id,family_id,owner_person_id,title,kind,privacy,occurred_at,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        record.id, 'family-main', owner.id, record.title, record.kind, 'family',
        record.occurredAt, record.createdAt,
        persistedRecord.policy_receipt_hash, persistedRecord.policy_receipt_version,
        persistedRecord.policy_receipt_nonce, persistedRecord.policy_correlation_id,
        persistedRecord.policy_resource_type, persistedRecord.policy_resource_id,
        persistedRecord.policy_action, persistedRecord.policy_capability
      )).toThrow(/exact durable policy receipt/u);

      expect(() => database.prepare(`
        INSERT INTO medication_plans(
          id,family_id,owner_person_id,name,dosage,schedule,starts_at,privacy,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        plan.id, 'family-main', owner.id, plan.name, plan.dosage, plan.schedule,
        plan.startsAt, 'family', plan.createdAt,
        persistedPlan.policy_receipt_hash, persistedPlan.policy_receipt_version,
        persistedPlan.policy_receipt_nonce, persistedPlan.policy_correlation_id,
        persistedPlan.policy_resource_type, persistedPlan.policy_resource_id,
        persistedPlan.policy_action, persistedPlan.policy_capability
      )).toThrow(/exact durable policy receipt/u);

      expect(() => database.prepare(`
        INSERT INTO family_health_history(
          id,family_id,related_person_id,condition,privacy,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        history.id, 'family-main', owner.id, history.condition, 'family', history.createdAt,
        persistedHistory.policy_receipt_hash, persistedHistory.policy_receipt_version,
        persistedHistory.policy_receipt_nonce, persistedHistory.policy_correlation_id,
        persistedHistory.policy_resource_type, persistedHistory.policy_resource_id,
        persistedHistory.policy_action, persistedHistory.policy_capability
      )).toThrow(/exact durable policy receipt/u);
    } finally {
      database.close();
    }
  });
});
