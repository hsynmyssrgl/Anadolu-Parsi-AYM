import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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

const PASSWORD = 'GucluRollbackParolasi!2026';
const temporaryDirectories: string[] = [];
const stores: FamilyDataStore[] = [];

const policyKernel = new PlatformPolicyKernel({
  policyVersion: '31-t-governed-rollback-test-v1',
  signingKey: Buffer.from('31-t-governed-rollback-test-signing-key', 'utf8'),
  applicationCapabilities: {
    'windows-desktop': [
      'family.read', 'family.write', 'finance.read', 'finance.write',
      'health.read', 'health.write', 'location.read', 'archive.write'
    ]
  },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

const authorizationProvider: PlatformPolicyAuthorizationProvider = Object.freeze({
  resolvePolicyPackage: () => policyKernel.policyPackage,
  authorize({ request, nonce }) {
    return Object.freeze({
      effectiveRequest: request,
      authorization: policyKernel.authorizeWithReceipt(request, request.occurredAt, nonce)
    });
  },
  verify({ request, receipt }) {
    return policyKernel.verifyReceiptForRequest(receipt, request);
  }
});

const projectionProof = (record: PlatformPolicyReceiptRecord): PlatformPolicyJournalProjectionProof =>
  Object.freeze({
    schemaVersion: 1,
    receiptHash: computePlatformPolicyReceiptHash(record.receipt),
    recordHash: computePlatformPolicyReceiptRecordHash(record),
    receiptNonce: record.receipt.nonce,
    entrySequence: 1,
    entryHash: createHash('sha256').update(record.receipt.nonce).digest('hex'),
    headSequence: 1,
    headHash: createHash('sha256').update(record.receipt.nonce).digest('hex'),
    journalSizeBytes: 512,
    issuedAt: record.recordedAt,
    proofMac: createHash('sha256').update(`proof:${record.receipt.nonce}`).digest('hex')
  });

const policyOptions = {
  archivePolicyAuthorizationProvider: authorizationProvider,
  archivePolicyReceiptSink: {
    append: () => undefined,
    ensure: projectionProof,
    verifyProjectionProof: () => true
  },
  archivePolicyVersion: '31-t-governed-rollback-test-v1',
  archiveClusterFence: () => ({ writable: true, epoch: 31 })
} as const;

const sourceDocument = Object.freeze({
  schemaVersion: 1,
  exportId: '31-t-governed-rollback-export',
  createdAt: '2026-08-11T07:00:00.000Z',
  family: { name: 'Kaynak Aile' },
  people: [
    {
      id: 'source-person-31t',
      displayName: 'Aktarılan Kişi 31-T',
      relationshipType: 'Akraba',
      generation: 1,
      branch: '31-T Dalı',
      status: 'active'
    }
  ],
  relations: [],
  locations: [
    {
      id: 'source-location-31t',
      label: 'Aktarılan Konum 31-T',
      address: 'Ankara',
      kind: 'residence'
    }
  ],
  events: [
    {
      id: 'source-event-31t',
      kind: 'important_day',
      title: 'Aktarılan Etkinlik 31-T',
      startAt: '2026-09-01T10:00:00.000Z',
      locationId: 'source-location-31t',
      visibility: 'family',
      participantPersonIds: ['source-person-31t'],
      aiProcessingAllowed: false,
      recurrence: 'none',
      reminderDays: []
    }
  ]
});

afterEach(() => {
  for (const store of stores.splice(0)) {
    try { store.close(); } catch { /* store already closed */ }
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('31-T governed family import rollback receipt fence', () => {
  it('requires exact delete receipts, consumes immutable tombstones and rolls back atomically', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'aym-31t-rollback-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'family.db');
    const sourcePath = join(directory, 'family-import.json');
    writeFileSync(sourcePath, JSON.stringify(sourceDocument), 'utf8');

    const store = new FamilyDataStore({ databasePath, seed: false, ...policyOptions });
    stores.push(store);
    store.setupAdmin({
      familyName: 'Hedef Aile',
      displayName: 'Rollback Yöneticisi',
      email: 'rollback@example.com',
      password: PASSWORD
    });

    const preview = store.previewFamilyDataImport(sourcePath);
    expect(preview.valid).toBe(true);
    const applied = await store.applyFamilyDataImport({ previewId: preview.previewId, password: PASSWORD });
    expect(applied.status).toBe('applied');

    const probe = new DatabaseSync(databasePath);
    try {
      const tracked = probe.prepare(`SELECT item.entity_type,item.entity_id,item.create_policy_receipt_hash
        FROM family_data_import_items item
        WHERE item.batch_id=? AND item.entity_type IN ('event','location')
        ORDER BY item.entity_type`).all(applied.id) as Array<Record<string, unknown>>;
      expect(tracked).toHaveLength(2);
      expect(tracked.every((row) => /^[0-9a-f]{64}$/u.test(String(row.create_policy_receipt_hash)))).toBe(true);

      const eventId = String(tracked.find((row) => row.entity_type === 'event')?.entity_id);
      expect(() => probe.prepare('DELETE FROM events WHERE id=?').run(eventId)).toThrow(/GOVERNED_TIMELINE_EVENT_DELETION_WORKFLOW_REQUIRED/u);
      expect(() => probe.prepare(`INSERT INTO family_data_import_rollback_deletions(
        batch_id,entity_type,entity_id,family_id,owner_person_id,create_receipt_hash,
        delete_receipt_hash,delete_receipt_version,delete_receipt_nonce,delete_correlation_id,
        delete_resource_type,delete_resource_id,delete_action,delete_capability,authorized_at
      ) SELECT ?, 'event', event.id, event.family_id, event.owner_person_id,
        event.timeline_policy_receipt_hash,event.timeline_policy_receipt_hash,1,
        'forged-nonce','forged-correlation','event',event.id,'delete','family.write',?
        FROM events event WHERE event.id=?`).run(applied.id, new Date().toISOString(), eventId)).toThrow(/exact create and delete receipts|UNIQUE/u);
    } finally {
      probe.close();
    }

    const rolledBack = await store.rollbackFamilyDataImport({ batchId: applied.id, password: PASSWORD });
    expect(rolledBack.status).toBe('rolled_back');

    const verification = new DatabaseSync(databasePath);
    try {
      const liveCreatedRows = verification.prepare(`SELECT COUNT(*) AS count
        FROM family_data_import_items item
        WHERE item.batch_id=? AND item.resolution='created' AND (
          (item.entity_type='person' AND EXISTS(SELECT 1 FROM people WHERE id=item.entity_id))
          OR (item.entity_type='relation' AND EXISTS(SELECT 1 FROM relations WHERE id=item.entity_id))
          OR (item.entity_type='location' AND EXISTS(SELECT 1 FROM locations WHERE id=item.entity_id))
          OR (item.entity_type='event' AND EXISTS(SELECT 1 FROM events WHERE id=item.entity_id))
        )`).get(applied.id) as Record<string, unknown>;
      expect(Number(liveCreatedRows.count)).toBe(0);

      const tombstones = verification.prepare(`SELECT entity_type,entity_id,create_receipt_hash,
        delete_receipt_hash,delete_action,delete_capability,consumed_at
        FROM family_data_import_rollback_deletions WHERE batch_id=? ORDER BY entity_type`).all(applied.id) as Array<Record<string, unknown>>;
      expect(tombstones).toHaveLength(2);
      expect(tombstones.every((row) => row.delete_action === 'delete' && row.delete_capability === 'family.write')).toBe(true);
      expect(tombstones.every((row) => row.create_receipt_hash !== row.delete_receipt_hash)).toBe(true);
      expect(tombstones.every((row) => typeof row.consumed_at === 'string')).toBe(true);
      expect(() => verification.prepare(`UPDATE family_data_import_rollback_deletions
        SET consumed_at=? WHERE entity_type=? AND entity_id=?`).run(
        new Date().toISOString(), tombstones[0]!.entity_type, tombstones[0]!.entity_id
      )).toThrow(/immutable and consume-only/u);
      expect(() => verification.prepare(`DELETE FROM family_data_import_rollback_deletions
        WHERE entity_type=? AND entity_id=?`).run(tombstones[0]!.entity_type, tombstones[0]!.entity_id)).toThrow(/cannot be deleted/u);
    } finally {
      verification.close();
    }

    await expect(store.rollbackFamilyDataImport({ batchId: applied.id, password: PASSWORD }))
      .rejects.toThrow(/daha önce geri alınmış/u);
  });
});
