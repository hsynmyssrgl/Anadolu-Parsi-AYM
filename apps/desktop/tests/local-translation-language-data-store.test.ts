import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import { computePlatformPolicyReceiptHash, computePlatformPolicyReceiptRecordHash } from '@ppt/repositories';
import { FamilyDataStore } from '../src/main/data-store.js';

const POLICY_VERSION = '34-e-local-translation-v1';
const ADMIN_PASSWORD = 'Guclu34ECeviriParolasi!';
const directories: string[] = [];
const stores: FamilyDataStore[] = [];
let projectionSequence = 0;

const kernel = new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('34-e-local-translation-policy-key-material', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write', 'location.read'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete']
});
const authorizationProvider: PlatformPolicyAuthorizationProvider = {
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
  entryHash: 'a'.repeat(64),
  headSequence: projectionSequence,
  headHash: 'a'.repeat(64),
  journalSizeBytes: projectionSequence * 512,
  issuedAt: record.recordedAt,
  proofMac: 'b'.repeat(64)
});

afterEach(() => {
  projectionSequence = 0;
  for (const store of stores.splice(0)) try { store.close(); } catch { /* best effort */ }
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const makeStore = (governed: boolean) => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-34e-translation-'));
  directories.push(directory);
  const databasePath = join(directory, 'family.db');
  const store = new FamilyDataStore({
    databasePath,
    seed: false,
    ...(governed ? {
      archivePolicyAuthorizationProvider: authorizationProvider,
      archivePolicyReceiptSink: { append: () => undefined, ensure: projectionProof, verifyProjectionProof: () => true },
      archivePolicyVersion: POLICY_VERSION,
      archiveClusterFence: () => ({ writable: true, epoch: 109 })
    } : {})
  });
  stores.push(store);
  store.setupAdmin({
    familyName: '34-E Translation Family',
    displayName: '34-E Family Admin',
    email: 'translation-34e-admin@example.test',
    password: ADMIN_PASSWORD
  });
  return { databasePath, store };
};

const allow = (store: FamilyDataStore) => {
  const account = store.listAccounts()[0]!;
  for (const [resourceType, actions] of [
    ['local_translation_center', ['read']],
    ['local_translation_profile', ['create', 'update']],
    ['local_translation_request', ['create', 'update']]
  ] as const) store.upsertPermission({
    subjectAccountId: account.id,
    resourceType,
    resourceId: '*',
    actions: [...actions],
    effect: 'allow',
    purpose: 'general'
  });
};

describe('34-E local translation DataStore production composition', () => {
  it('fails closed without central policy and writes no translation metadata', async () => {
    const value = makeStore(false);
    await expect(value.store.getLocalTranslationCenter()).rejects.toThrow(/policy enforcement is not composed/i);
    const database = new DatabaseSync(value.databasePath, { readOnly: true });
    try {
      for (const table of ['local_translation_profiles', 'local_translation_dictionary_entries',
        'local_translation_requests', 'local_translation_mutations', 'local_translation_events'])
        expect(database.prepare(`SELECT COUNT(*) count FROM ${table}`).get()).toEqual({ count: 0 });
    } finally { database.close(); }
  });

  it('persists owner-scoped settings and corrections while every provider and network execution stays false', async () => {
    const { databasePath, store } = makeStore(true);
    allow(store);
    expect(await store.getLocalTranslationCenter()).toMatchObject({
      profile: { preferredLanguage: 'tr', revision: 0 },
      dictionary: [],
      requests: [],
      truth: { productionTranslationProviderConfigured: false, translationExecuted: false,
        speechToTextExecuted: false, speakerSeparationExecuted: false,
        encryptedCrossDevicePreferenceSyncExecuted: false, networkUsedByCurrentImplementation: false }
    });

    const profileInput = { clientOperationId: 'profile-update-34-e', expectedRevision: 0,
      preferredLanguage: 'tr', secondaryLanguages: ['en', 'de'], liveCaptionTranslationEnabled: true,
      translatedSpeechEnabled: true, preserveOriginalAudio: true as const, externalProviderAllowed: true,
      encryptedSyncRequested: true };
    expect(await store.updateLocalTranslationProfile(profileInput)).toMatchObject({ revision: 1, replayed: false,
      providerConfigured: false, translationExecuted: false, networkUsed: false });
    expect(await store.updateLocalTranslationProfile(profileInput)).toMatchObject({ revision: 1, replayed: true });
    await expect(store.updateLocalTranslationProfile({ ...profileInput, translatedSpeechEnabled: false }))
      .rejects.toThrow(/clientOperationId|farkl/i);

    const added = await store.addLocalTranslationDictionaryEntry({ clientOperationId: 'dictionary-add-34-e',
      expectedRevision: 1, category: 'family_name', sourceLanguage: 'tr', targetLanguage: 'en',
      sourceTerm: 'Aile Takma Adi', preferredTerm: 'Family Nickname', explicitPermission: true });
    expect(added).toMatchObject({ mutationKind: 'dictionary_add', revision: 2, networkUsed: false });
    const withDictionary = await store.getLocalTranslationCenter();
    expect(withDictionary.dictionary).toEqual([expect.objectContaining({ sourceTerm: 'Aile Takma Adi',
      preferredTerm: 'Family Nickname', explicitPermissionRecorded: true })]);

    const prepared = await store.prepareLocalTranslationRequest({ clientOperationId: 'request-prepare-34-e',
      expectedRevision: 0, sourceKind: 'message', sourceResourceId: 'message-local-34-e', targetLanguage: 'en',
      providerMode: 'external_preview', externalPreviewAcknowledged: true, explicitExternalConsent: true });
    expect(prepared).toMatchObject({ mutationKind: 'request_prepare', revision: 1,
      providerConfigured: false, translationExecuted: false, networkUsed: false, cloudUsed: false });
    const correctedText = 'Human corrected translation';
    expect(await store.recordLocalTranslationCorrection({ clientOperationId: 'correction-34-e', expectedRevision: 1,
      requestId: prepared.resourceId, correctedText, explicitPermission: true })).toMatchObject({ revision: 2,
      mutationKind: 'correction_record', translationExecuted: false });
    expect(await store.cancelLocalTranslationRequest({ clientOperationId: 'cancel-34-e', expectedRevision: 2,
      requestId: prepared.resourceId, reason: 'Owner cancelled this metadata-only request.' })).toMatchObject({
      revision: 3, mutationKind: 'request_cancel', networkUsed: false });
    expect(await store.deleteLocalTranslationDictionaryEntry({ clientOperationId: 'dictionary-delete-34-e',
      expectedRevision: 2, entryId: withDictionary.dictionary[0]!.id, reason: 'Owner removed personal terminology.' }))
      .toMatchObject({ revision: 3, mutationKind: 'dictionary_delete' });

    const center = await store.getLocalTranslationCenter();
    expect(center).toMatchObject({
      profile: { revision: 3, encryptedSyncRequested: true, encryptedSyncExecuted: false },
      dictionary: [],
      requests: [{ id: prepared.resourceId, state: 'cancelled', correctionRecorded: true,
        correctionCharacterCount: correctedText.length, translationExecuted: false, networkUsed: false, cloudUsed: false }]
    });
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      expect(database.prepare(`SELECT state,source_term,preferred_term FROM local_translation_dictionary_entries`).get())
        .toEqual({ state: 'deleted', source_term: '', preferred_term: '' });
      expect(database.prepare(`SELECT state,translation_executed,network_used,cloud_used FROM local_translation_requests`).get())
        .toEqual({ state: 'cancelled', translation_executed: 0, network_used: 0, cloud_used: 0 });
      const durableMetadata = JSON.stringify({
        requests: database.prepare('SELECT * FROM local_translation_requests').all(),
        mutations: database.prepare('SELECT * FROM local_translation_mutations').all(),
        events: database.prepare('SELECT * FROM local_translation_events').all(),
        audit: database.prepare("SELECT * FROM audit_log WHERE resource_type LIKE 'local_translation_%'").all(),
        outbox: database.prepare("SELECT * FROM event_outbox WHERE event_type='local.translation.metadata.changed'").all()
      });
      expect(durableMetadata).not.toContain(correctedText);
      expect(durableMetadata).toContain(createHash('sha256').update(JSON.stringify(correctedText), 'utf8').digest('hex'));
    } finally { database.close(); }
  }, 30_000);

  it('rolls mutation, current row, event, audit and outbox back together on downstream failure', async () => {
    const { databasePath, store } = makeStore(true);
    allow(store);
    const injector = new DatabaseSync(databasePath);
    try {
      injector.exec(`CREATE TRIGGER test_34e_outbox_failure BEFORE INSERT ON event_outbox
        WHEN NEW.event_type='local.translation.metadata.changed'
        BEGIN SELECT RAISE(ABORT,'controlled 34-E outbox failure'); END;`);
    } finally { injector.close(); }
    await expect(store.updateLocalTranslationProfile({ clientOperationId: 'rollback-profile-34-e', expectedRevision: 0,
      preferredLanguage: 'tr', secondaryLanguages: ['en'], liveCaptionTranslationEnabled: false,
      translatedSpeechEnabled: false, preserveOriginalAudio: true, externalProviderAllowed: false,
      encryptedSyncRequested: false })).rejects.toThrow();
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      for (const table of ['local_translation_profiles', 'local_translation_mutations', 'local_translation_events'])
        expect(database.prepare(`SELECT COUNT(*) count FROM ${table}`).get()).toEqual({ count: 0 });
      expect(database.prepare("SELECT COUNT(*) count FROM audit_log WHERE resource_type LIKE 'local_translation_%'").get())
        .toEqual({ count: 0 });
      expect(database.prepare("SELECT COUNT(*) count FROM event_outbox WHERE event_type='local.translation.metadata.changed'").get())
        .toEqual({ count: 0 });
    } finally { database.close(); }
  }, 30_000);
});
