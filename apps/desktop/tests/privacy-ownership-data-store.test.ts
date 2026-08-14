import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { asIsoDateTime, type Clock } from '@ppt/core';
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
import { decryptPrivacyDataExport } from '@ppt/security';
import { FamilyDataStore } from '../src/main/data-store.js';

const POLICY_VERSION = '33-o-desktop-integration-policy-v1';
const PASSWORD = 'GucluTestParolasi123!';
const EMAIL = 'privacy-owner@example.com';
const temporaryDirectories: string[] = [];
const openStores = new Set<FamilyDataStore>();

const policyKernel = new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('33-o-desktop-integration-signing-key-v1', 'utf8'),
  applicationCapabilities: {
    'windows-desktop': [
      'family.read', 'family.write', 'finance.read', 'finance.write',
      'health.read', 'health.write', 'location.read',
      'archive.read', 'archive.write', 'ai.process'
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

const projectionProof = (record: PlatformPolicyReceiptRecord): PlatformPolicyJournalProjectionProof => Object.freeze({
  schemaVersion: 1,
  receiptHash: computePlatformPolicyReceiptHash(record.receipt),
  recordHash: computePlatformPolicyReceiptRecordHash(record),
  receiptNonce: record.receipt.nonce,
  entrySequence: 1,
  entryHash: 'd'.repeat(64),
  headSequence: 1,
  headHash: 'd'.repeat(64),
  journalSizeBytes: 512,
  issuedAt: record.recordedAt,
  proofMac: 'e'.repeat(64)
});

const monotonicClock = (): Clock => {
  let observed = Date.now();
  return Object.freeze({
    now: () => {
      observed = Math.max(observed, Date.now());
      return asIsoDateTime(new Date(observed).toISOString());
    }
  });
};

interface StoreFixture {
  readonly directory: string;
  readonly databasePath: string;
  readonly store: FamilyDataStore;
}

const makeStore = (): StoreFixture => {
  const directory = mkdtempSync(join(tmpdir(), 'panthera-privacy-33-o-'));
  temporaryDirectories.push(directory);
  const databasePath = join(directory, 'family.db');
  const store = new FamilyDataStore({
    databasePath,
    deviceIdentityPath: join(directory, 'device-identity.json'),
    archivePath: join(directory, 'archive'),
    archivePolicyAuthorizationProvider: authorizationProvider,
    archivePolicyReceiptSink: {
      append: () => undefined,
      ensure: projectionProof,
      verifyProjectionProof: () => true
    },
    archivePolicyVersion: POLICY_VERSION,
    archiveClusterFence: () => ({ writable: true, epoch: 33 }),
    clock: monotonicClock()
  });
  openStores.add(store);
  store.setupAdmin({
    familyName: 'Gizlilik Test Ailesi',
    displayName: 'Gizlilik Sahibi',
    email: EMAIL,
    password: PASSWORD
  });
  return { directory, databasePath, store };
};

const accountAndPerson = async (store: FamilyDataStore) => {
  const account = store.listAccounts().find((candidate) => candidate.email === EMAIL);
  if (!account?.personId) throw new Error('33-O test owner scope could not be resolved');
  return { account, person: { id: account.personId } };
};

const databaseValue = <T>(databasePath: string, sql: string, ...parameters: unknown[]): T => {
  const database = new DatabaseSync(databasePath);
  try {
    return database.prepare(sql).get(...parameters) as T;
  } finally {
    database.close();
  }
};

const operationalCounts = (databasePath: string) => databaseValue<{
  permissions: number;
  audit: number;
  outbox: number;
  accessObservations: number;
}>(databasePath, `SELECT
  (SELECT COUNT(*) FROM object_permissions) permissions,
  (SELECT COUNT(*) FROM audit_log) audit,
  (SELECT COUNT(*) FROM event_outbox) outbox,
  (SELECT COUNT(*) FROM privacy_access_observations) accessObservations`);

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const seedGovernedAiMemory = async (
  fixture: StoreFixture,
  input: { readonly recordId: string; readonly sourceId: string }
): Promise<{ readonly bindingHash: string; readonly sourceBefore: Record<string, unknown> }> => {
  const { account, person } = await accountAndPerson(fixture.store);
  const financeRecords = await fixture.store.createFinanceRecord({
    ownerPersonId: person.id,
    title: 'AI kaynak kaydı',
    kind: 'asset',
    amount: 3_300,
    currency: 'TRY',
    privacy: 'private',
    notes: 'SOURCE_BYTES_SENTINEL_33O',
    occurredAt: '2026-08-14T03:00:00.000Z'
  });
  const source = financeRecords.find((candidate) => candidate.title === 'AI kaynak kaydı');
  if (!source) throw new Error('AI memory source record was not created');
  input = { ...input, sourceId: source.id };

  // Create a durable, exact owner PEP receipt. The historical seed binding uses
  // this receipt only as its sealed producer identity; the deletion itself gets
  // a new exact delete receipt through the production DataStore path.
  await fixture.store.getPrivacyOwnershipCenter();
  const database = new DatabaseSync(fixture.databasePath);
  const bindingHash = sha256(`binding:${input.recordId}`);
  const sourceBefore = database.prepare('SELECT * FROM finance_records WHERE id=?').get(input.sourceId) as Record<string, unknown>;
  const receipt = database.prepare(`SELECT receipt_hash FROM platform_policy_transaction_receipts
    WHERE resource_type='privacy_ownership_center' AND resource_id=?
    ORDER BY recorded_at DESC LIMIT 1`).get(account.id) as { receipt_hash?: unknown } | undefined;
  if (!receipt?.receipt_hash) {
    database.close();
    throw new Error('Exact owner producer receipt was not persisted');
  }
  const receiptHash = String(receipt.receipt_hash);
  const occurredAt = '2026-08-13T03:05:00.000Z';
  const hash = (marker: string) => marker.repeat(64).slice(0, 64);
  const triggers = database.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND sql IS NOT NULL ORDER BY name")
    .all() as Array<{ name: string; sql: string }>;
  try {
    database.exec('PRAGMA foreign_keys=OFF');
    database.exec('BEGIN IMMEDIATE');
    for (const trigger of triggers) database.exec(`DROP TRIGGER "${trigger.name.replaceAll('"', '""')}"`);
    database.prepare(`INSERT INTO derived_data_policy_bindings(
      binding_hash,schema_version,derived_kind,derived_resource_type,derived_resource_id,derived_resource_version,
      content_sha256,family_id,policy_version,policy_package_sha256,sensitivity,data_classes_json,access_policy_json,
      access_policy_sha256,obligations_json,obligations_sha256,source_set_sha256,producer_receipt_hash,binding_json,
      source_count,lineage_depth,retention_until,status,created_at,sealed_at
    ) VALUES(?,1,'AI_MEMORY','ai_memory',?,'1',?,'family-main',?,?, 'personal','["personal"]','{}',?,
      '[]',?,?,?,'{}',1,1,NULL,'sealed',?,?)`)
      .run(bindingHash, input.recordId, hash('1'), POLICY_VERSION, hash('2'), hash('3'), hash('4'), hash('5'), receiptHash, occurredAt, occurredAt);
    database.prepare(`INSERT INTO derived_data_policy_sources(
      binding_hash,source_ordinal,source_key,source_resource_type,source_resource_id,source_resource_version,
      content_sha256,family_id,policy_version,policy_package_sha256,sensitivity,data_classes_json,policy_receipt_hash,
      context_hash,request_hash,source_snapshot_json,source_snapshot_sha256,lineage_depth,retention_until,authorized_at
    ) VALUES(?,0,?,'finance_record',?,'1',?,'family-main',?,?, 'personal','["personal"]',?,?,?,
      '{}',?,0,NULL,?)`)
      .run(bindingHash, hash('6'), input.sourceId, sha256(JSON.stringify(sourceBefore)), POLICY_VERSION, hash('2'), receiptHash,
        hash('7'), hash('8'), hash('9'), occurredAt);
    const mutationId = `seed-mutation-${input.recordId}`;
    const initialFingerprint = hash('a');
    database.prepare(`INSERT INTO governed_ai_memory_mutations(
      id,client_operation_id,request_fingerprint,state_fingerprint,mutation_kind,resource_type,resource_id,
      family_id,account_id,owner_person_id,previous_revision,revision,policy_receipt_hash,policy_resource_type,
      policy_resource_id,policy_action,policy_capability,policy_purpose,policy_sensitivity,occurred_at
    ) VALUES(?,?,?,?,'ai_memory_correct','ai_memory_record',?,'family-main',?,?,0,1,?,
      'ai_memory_record',?,'create','family.write','ai_processing','personal',?)`)
      .run(mutationId, `seed-operation-${input.recordId}`, hash('b'), initialFingerprint, input.recordId,
        account.id, person.id, receiptHash, input.recordId, occurredAt);
    database.prepare(`INSERT INTO governed_ai_memory_records(
      resource_id,family_id,account_id,owner_person_id,derived_binding_hash,title,statement,source_resource_type,
      source_resource_id,source_occurred_at,restriction_visibility,selected_account_ids_json,allowed_purposes_json,
      processing_allowed,state,retention_until,expired_at,deletion_requested_at,deleted_at,revision,state_fingerprint,
      last_mutation_id,created_at,updated_at,policy_receipt_hash
    ) VALUES(?,'family-main',?,?,?,'Kaynak hafıza','Kaynak kayıttan türetilmiş yerel hafıza',
      'finance_record',?,?,'owner_only','[]','["general","ai_processing"]',1,'active',NULL,NULL,NULL,NULL,1,?,?,?, ?,?)`)
      .run(input.recordId, account.id, person.id, bindingHash, input.sourceId, occurredAt, initialFingerprint,
        mutationId, occurredAt, occurredAt, receiptHash);
    database.exec('COMMIT');
    database.exec('BEGIN IMMEDIATE');
    for (const trigger of triggers) database.exec(trigger.sql);
    database.exec('COMMIT');
    database.exec('PRAGMA foreign_keys=ON');
  } catch (error) {
    try { database.exec('ROLLBACK'); } catch { /* transaction may already be closed */ }
    throw error;
  } finally {
    database.close();
  }

  fixture.store.upsertPermission({
    subjectAccountId: account.id,
    resourceType: 'ai_memory_record',
    resourceId: input.recordId,
    actions: ['read'],
    effect: 'allow',
    purpose: 'ai_processing',
    endsAt: '2027-08-14T03:00:00.000Z'
  });
  return { bindingHash, sourceBefore };
};

afterEach(() => {
  for (const store of openStores) {
    try { store.close(); } catch { /* store may already be closed */ }
  }
  openStores.clear();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('33-O FamilyDataStore privacy ownership integration', () => {
  it('keeps center rows in the exact session/account/person scope and reports only the runtime device as current', async () => {
    const fixture = makeStore();
    const { account, person } = await accountAndPerson(fixture.store);
    const database = new DatabaseSync(fixture.databasePath);
    try {
      database.prepare(`INSERT INTO trusted_devices(
        id,account_id,device_id,display_name,fingerprint,public_key_pem,trusted_at,last_seen_at,revoked_at,created_at,security_epoch
      ) SELECT 'trusted-secondary-33o',account_id,'device-secondary-33o','İkinci yerel cihaz',?,public_key_pem,
        trusted_at,last_seen_at,NULL,created_at,security_epoch FROM trusted_devices WHERE account_id=? LIMIT 1`)
        .run('f'.repeat(64), account.id);
    } finally {
      database.close();
    }

    const center = await fixture.store.getPrivacyOwnershipCenter();
    expect(center.key).toEqual({ familyId: 'family-main', accountId: account.id, ownerPersonId: person.id });
    for (const row of [
      ...center.aiMemoryRecords, ...center.dataInventory, ...center.accessHistory,
      ...center.localDeviceActivity, ...center.localProcessingObservations,
      ...center.derivedDataLineage, ...center.rightsRequests, ...center.encryptedExports, ...center.incidents
    ]) expect(row.key).toEqual(center.key);
    expect(center.localDeviceActivity.filter((device) => device.currentDevice)).toHaveLength(1);
    expect(center.localDeviceActivity.find((device) => device.deviceId === 'device-secondary-33o')).toMatchObject({
      currentDevice: false,
      trustStatus: 'trusted',
      locallyObservedSession: 'recently_seen',
      observationSource: 'local_runtime'
    });
    expect(center.truth).toMatchObject({
      scope: 'local_observation_and_authority_only',
      trustedDeviceDoesNotMeanOpenSession: true,
      remoteWipeAvailable: false,
      mdmAvailable: false,
      networkDeliveryGuaranteed: false,
      processingShownOnlyWhenLocallyObserved: true
    });

    fixture.store.logout();
    await expect(fixture.store.getPrivacyOwnershipCenter()).rejects.toThrow(/oturum/u);
  });

  it('creates, updates and replays an exact rights request, rejects mismatched replay, and simulates without grants or access writes', async () => {
    const fixture = makeStore();
    const { account, person } = await accountAndPerson(fixture.store);
    const create = {
      expectedRevision: 0,
      clientOperationId: '33-o-rights-create-replay',
      kind: 'retention_change' as const,
      scopeResourceType: 'family_data',
      scopeResourceId: 'family-main',
      reason: 'Yerel saklama süresini gözden geçir',
      requestedRetentionUntil: '2027-08-14T03:00:00.000Z' as const
    };
    const created = await fixture.store.createPrivacyRightsRequest(create);
    const replay = await fixture.store.createPrivacyRightsRequest(create);
    expect(created).toMatchObject({ previousRevision: 0, revision: 1, replayed: false, mutationKind: 'rights_request_create' });
    expect(replay).toEqual({ ...created, replayed: true });
    await expect(fixture.store.createPrivacyRightsRequest({ ...create, reason: 'Aynı id ile farklı istek' }))
      .rejects.toThrow(/CONFLICT|RESOURCE_CONFLICT/u);

    const update = {
      requestId: created.resourceId,
      expectedRevision: 1,
      clientOperationId: '33-o-rights-update-replay',
      status: 'in_review' as const
    };
    const updated = await fixture.store.updatePrivacyRightsRequest(update);
    const updateReplay = await fixture.store.updatePrivacyRightsRequest(update);
    expect(updated).toMatchObject({ previousRevision: 1, revision: 2, replayed: false, mutationKind: 'rights_request_update' });
    expect(updateReplay).toEqual({ ...updated, replayed: true });

    const before = operationalCounts(fixture.databasePath);
    const simulated = await fixture.store.simulatePrivacyPermission({ targets: [{
      subjectAccountId: account.id,
      resourceType: 'privacy_inventory',
      resourceId: person.id,
      action: 'read',
      purpose: 'general',
      occurredAt: asIsoDateTime(new Date().toISOString())
    }] });
    expect(simulated).toMatchObject({ grantsCreated: false, accessPerformed: false, auditAccessRecorded: false });
    expect(simulated.items).toHaveLength(1);
    expect(operationalCounts(fixture.databasePath)).toEqual(before);
  });

  it('rolls back a foreign containment target, then clears the local session only after committed containment', async () => {
    const fixture = makeStore();
    const { account } = await accountAndPerson(fixture.store);
    const epochBefore = fixture.store.getAuthState().securityEpoch;
    const durableBefore = databaseValue<{ incidents: number; mutations: number; revocations: number }>(fixture.databasePath, `SELECT
      (SELECT COUNT(*) FROM policy_incident_cases) incidents,
      (SELECT COUNT(*) FROM governed_ai_memory_mutations) mutations,
      (SELECT COUNT(*) FROM policy_incident_revocations) revocations`);

    await expect(fixture.store.createPrivacyIncident({
      expectedRevision: 0,
      clientOperationId: '33-o-incident-rollback',
      title: 'Kapsam dışı containment denemesi',
      severity: 'high',
      suspectedAt: asIsoDateTime(new Date().toISOString()),
      actions: [{ action: 'revoke_local_session_authority', targetId: 'foreign-account' }],
      evidenceReferenceIds: ['local-evidence-rollback']
    })).rejects.toThrow();
    expect(fixture.store.getAuthState().authenticated).toBe(true);
    expect(databaseValue(fixture.databasePath, `SELECT
      (SELECT COUNT(*) FROM policy_incident_cases) incidents,
      (SELECT COUNT(*) FROM governed_ai_memory_mutations) mutations,
      (SELECT COUNT(*) FROM policy_incident_revocations) revocations`)).toEqual(durableBefore);

    const committed = await fixture.store.createPrivacyIncident({
      expectedRevision: 0,
      clientOperationId: '33-o-incident-commit',
      title: 'Yerel oturum yetkisi containment',
      severity: 'critical',
      suspectedAt: asIsoDateTime(new Date().toISOString()),
      actions: [{ action: 'revoke_local_session_authority', targetId: account.id }],
      evidenceReferenceIds: ['local-evidence-commit']
    });
    expect(committed).toMatchObject({ mutationKind: 'incident_create', previousRevision: 0, revision: 1 });
    expect(fixture.store.getAuthState().authenticated).toBe(false);
    const state = databaseValue<{
      status: string;
      securityEpoch: number;
      activeDevices: number;
      revocations: number;
    }>(fixture.databasePath, `SELECT
      (SELECT status FROM policy_incident_cases WHERE id=?) status,
      (SELECT security_epoch FROM accounts WHERE id=?) securityEpoch,
      (SELECT COUNT(*) FROM trusted_devices WHERE account_id=? AND revoked_at IS NULL) activeDevices,
      (SELECT COUNT(*) FROM policy_incident_revocations WHERE incident_id=?) revocations`,
    committed.resourceId, account.id, account.id, committed.resourceId);
    expect(state.status).toBe('contained_locally');
    expect(state.securityEpoch).toBe((epochBefore ?? 0) + 1);
    expect(state.activeDevices).toBe(0);
    expect(state.revocations).toBeGreaterThan(0);
  });

  it('writes a verified encrypted file and finalizes the rights row plus export ledger atomically without exposing path or passphrase', async () => {
    const fixture = makeStore();
    const { account, person } = await accountAndPerson(fixture.store);
    const foreignMutation = fixture.store.createMember({
      displayName: 'Yabancı Export Sahibi', relationshipType: 'Kuzen', generation: 4, branch: 'Export Yabancı Dal'
    });
    if (!foreignMutation.person) throw new Error('foreign export owner seed failed');
    await fixture.store.createFinanceRecord({ ownerPersonId: person.id, title: 'OWNER_FINANCE_EXPORT_SENTINEL_33O',
      kind: 'asset', amount: 20_000, currency: 'TRY', privacy: 'private', occurredAt: '2026-08-01T00:00:00.000Z' });
    fixture.store.upsertPermission({ subjectAccountId: account.id, resourceType: 'finance_record', resourceId: '*',
      actions: ['create', 'read'], effect: 'allow', purpose: 'general' });
    await fixture.store.createFinanceRecord({ ownerPersonId: foreignMutation.person.id, title: 'FOREIGN_FINANCE_EXPORT_SENTINEL_33O',
      kind: 'asset', amount: 99_999, currency: 'TRY', privacy: 'private', occurredAt: '2026-08-01T00:00:00.000Z' });
    const passphrase = '33-O-Guclu-Export-Parolasi!';
    const destination = join(fixture.directory, 'owner-export.pptprivacy');
    const request = await fixture.store.createPrivacyRightsRequest({
      expectedRevision: 0,
      clientOperationId: '33-o-encrypted-export-request',
      kind: 'encrypted_export',
      scopeResourceType: 'privacy_inventory',
      scopeResourceId: person.id,
      reason: 'Şifreli yerel veri kopyası'
    });

    const result = await fixture.store.exportEncryptedPrivacyData({ requestId: request.resourceId, passphrase, destination });
    expect(existsSync(destination)).toBe(true);
    expect(readFileSync(destination).byteLength).toBeGreaterThan(0);
    expect(result).toMatchObject({
      fileName: basename(destination),
      delivery: 'not_performed'
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(destination);
    expect(serialized).not.toContain(passphrase);
    expect(serialized).not.toContain('absolutePath');
    const decrypted = decryptPrivacyDataExport(readFileSync(destination), passphrase);
    try {
      const payload = JSON.parse(decrypted.plaintext.toString('utf8')) as {
        exportType: string;
        request: { scopeResourceType: string; scopeResourceId: string };
        truth: { scopeApplied: boolean; archiveBinaryPayloadsIncluded: boolean; networkDelivery: string };
        ownerStructuredData: { financeRecords: Array<{ title: string }>; coverage: { ownerScoped: boolean; formDraftPayloadsIncluded: boolean } };
        digitalLegacy?: unknown;
      };
      expect(payload).toMatchObject({
        exportType: 'privacy_self_data',
        request: { scopeResourceType: 'privacy_inventory', scopeResourceId: person.id },
        truth: { scopeApplied: true, archiveBinaryPayloadsIncluded: false, networkDelivery: 'not_performed' }
      });
      expect(payload.digitalLegacy).toBeUndefined();
      expect(payload.ownerStructuredData.financeRecords.map((item) => item.title)).toContain('OWNER_FINANCE_EXPORT_SENTINEL_33O');
      expect(payload.ownerStructuredData.financeRecords.map((item) => item.title)).not.toContain('FOREIGN_FINANCE_EXPORT_SENTINEL_33O');
      expect(payload.ownerStructuredData.coverage).toMatchObject({ ownerScoped: true, formDraftPayloadsIncluded: false });
    } finally {
      decrypted.plaintext.fill(0);
    }

    const durable = databaseValue<{
      status: string;
      revision: number;
      exports: number;
      localUserSelected: number;
      deliveryGuaranteed: number;
      recipientReadGuaranteed: number;
    }>(fixture.databasePath, `SELECT
      (SELECT status FROM privacy_rights_requests WHERE id=?) status,
      (SELECT revision FROM privacy_rights_requests WHERE id=?) revision,
      (SELECT COUNT(*) FROM privacy_export_records WHERE rights_request_id=?) exports,
      (SELECT local_user_selected FROM privacy_export_records WHERE rights_request_id=?) localUserSelected,
      (SELECT delivery_guaranteed FROM privacy_export_records WHERE rights_request_id=?) deliveryGuaranteed,
      (SELECT recipient_read_guaranteed FROM privacy_export_records WHERE rights_request_id=?) recipientReadGuaranteed`,
    request.resourceId, request.resourceId, request.resourceId,
    request.resourceId, request.resourceId, request.resourceId);
    expect(durable).toEqual({
      status: 'locally_completed',
      revision: 2,
      exports: 1,
      localUserSelected: 1,
      deliveryGuaranteed: 0,
      recipientReadGuaranteed: 0
    });
    const center = await fixture.store.getPrivacyOwnershipCenter();
    expect(center.encryptedExports.find((item) => item.requestId === request.resourceId)).toMatchObject({
      encrypted: true,
      readbackVerified: true,
      localArtifactPathExposed: false,
      passphraseExposed: false,
      networkDeliveryGuaranteed: false,
      recipientReadGuaranteed: false
    });
  });

  it('exports only the current owner digital legacy scope and excludes unrelated privacy and foreign-owner records', async () => {
    const fixture = makeStore();
    const { account, person } = await accountAndPerson(fixture.store);
    const foreignMutation = fixture.store.createMember({
      displayName: 'Yabancı Miras Sahibi',
      relationshipType: 'Kuzen',
      generation: 4,
      branch: 'Yabancı Dal'
    });
    const foreignOwner = foreignMutation.person;
    if (!foreignOwner) throw new Error('foreign legacy owner seed failed');
    const ownerPlan = fixture.store.upsertDigitalLegacyPlan({
      ownerPersonId: person.id,
      title: 'OWNER_LEGACY_SENTINEL_33O',
      status: 'active',
      triggerType: 'death_confirmation',
      trusteeAccountId: account.id,
      instructions: 'Yalnız şifreli yerel miras paketine dahil edilir.'
    }).find((candidate) => candidate.title === 'OWNER_LEGACY_SENTINEL_33O');
    const foreignPlan = fixture.store.upsertDigitalLegacyPlan({
      ownerPersonId: foreignOwner.id,
      title: 'FOREIGN_LEGACY_SENTINEL_33O',
      status: 'active',
      triggerType: 'death_confirmation',
      trusteeAccountId: account.id
    }).find((candidate) => candidate.title === 'FOREIGN_LEGACY_SENTINEL_33O');
    if (!ownerPlan || !foreignPlan) throw new Error('legacy plan seed failed');
    fixture.store.upsertLegacyGrant({
      planId: ownerPlan.id,
      resourceType: 'archive_item',
      resourceId: 'OWNER_GRANT_SENTINEL_33O',
      actions: ['read']
    });
    fixture.store.upsertLegacyGrant({
      planId: foreignPlan.id,
      resourceType: 'archive_item',
      resourceId: 'FOREIGN_GRANT_SENTINEL_33O',
      actions: ['read']
    });
    fixture.store.executeDigitalLegacyPlan({
      planId: ownerPlan.id,
      confirmationNote: 'Yerel test doğrulaması yalnız owner approval sentinel üretir.'
    });
    const request = await fixture.store.createPrivacyRightsRequest({
      expectedRevision: 0,
      clientOperationId: '33-o-legacy-export-request',
      kind: 'legacy_export',
      scopeResourceType: 'digital_legacy',
      scopeResourceId: person.id,
      reason: 'Şifreli yerel dijital miras kopyası'
    });
    const passphrase = '33-O-Guclu-Miras-Parolasi!';
    const destination = join(fixture.directory, 'owner-legacy.pptprivacy');
    await fixture.store.exportEncryptedPrivacyData({ requestId: request.resourceId, passphrase, destination });
    const decrypted = decryptPrivacyDataExport(readFileSync(destination), passphrase);
    try {
      const payload = JSON.parse(decrypted.plaintext.toString('utf8')) as {
        exportType: string;
        request: { scopeResourceType: string; scopeResourceId: string };
        digitalLegacy: { plans: Array<{ id: string; title: string }>; grants: Array<{ resourceId: string }>; approvals: unknown[] };
        aiMemoryRecords?: unknown;
        incidents?: unknown;
        truth: { ownerFiltered: boolean; unrelatedPrivacyRecordsIncluded: boolean; networkDelivery: string };
      };
      expect(payload.exportType).toBe('privacy_digital_legacy');
      expect(payload.request).toMatchObject({ scopeResourceType: 'digital_legacy', scopeResourceId: person.id });
      expect(payload.digitalLegacy.plans.map((item) => item.title)).toContain('OWNER_LEGACY_SENTINEL_33O');
      expect(payload.digitalLegacy.plans.map((item) => item.title)).not.toContain('FOREIGN_LEGACY_SENTINEL_33O');
      expect(payload.digitalLegacy.grants.map((item) => item.resourceId)).toContain('OWNER_GRANT_SENTINEL_33O');
      expect(payload.digitalLegacy.grants.map((item) => item.resourceId)).not.toContain('FOREIGN_GRANT_SENTINEL_33O');
      expect(payload.digitalLegacy.approvals).toHaveLength(1);
      expect(payload.aiMemoryRecords).toBeUndefined();
      expect(payload.incidents).toBeUndefined();
      expect(payload.truth).toMatchObject({
        ownerFiltered: true,
        unrelatedPrivacyRecordsIncluded: false,
        networkDelivery: 'not_performed'
      });
    } finally {
      decrypted.plaintext.fill(0);
    }
  });

  it('tombstones only the derived AI memory and its grants while preserving the source row, source bytes and sealed lineage identity', async () => {
    const fixture = makeStore();
    const { account } = await accountAndPerson(fixture.store);
    const recordId = 'ai-memory-delete-boundary-33o';
    const sourceBytesPath = join(fixture.directory, 'source-bytes.bin');
    // A source-byte sentinel complements the governed finance source row. AI
    // memory deletion has no authority over either source owner.
    const sourceBytes = Buffer.from('SOURCE_BYTES_MUST_SURVIVE_AI_MEMORY_DELETE_33O', 'utf8');
    await import('node:fs/promises').then(({ writeFile }) => writeFile(sourceBytesPath, sourceBytes));
    const seeded = await seedGovernedAiMemory(fixture, { recordId, sourceId: 'resolved-by-helper' });
    expect(fixture.store.listPermissions().some((item) => item.resourceType === 'ai_memory_record' && item.resourceId === recordId)).toBe(true);

    const receipt = await fixture.store.deleteAiMemory({
      recordId,
      expectedRevision: 1,
      clientOperationId: '33-o-ai-memory-delete-boundary',
      reason: 'Yalnız türetilmiş yerel hafızayı kaldır'
    });
    expect(receipt).toMatchObject({ mutationKind: 'ai_memory_delete', previousRevision: 1, revision: 2, replayed: false });
    const row = databaseValue<Record<string, unknown>>(fixture.databasePath,
      'SELECT * FROM governed_ai_memory_records WHERE resource_id=?', recordId);
    expect(row).toMatchObject({
      state: 'deleted',
      title: '',
      statement: '',
      processing_allowed: 0,
      restriction_visibility: 'owner_only',
      source_resource_type: 'finance_record',
      derived_binding_hash: seeded.bindingHash,
      revision: 2
    });
    expect(databaseValue<{ count: number }>(fixture.databasePath,
      `SELECT COUNT(*) count FROM object_permissions WHERE subject_account_id=?
        AND resource_type IN ('ai_memory','ai_memory_record') AND resource_id=?`, account.id, recordId).count).toBe(0);
    const sourceAfter = databaseValue<Record<string, unknown>>(fixture.databasePath,
      'SELECT * FROM finance_records WHERE id=?', row.source_resource_id);
    expect(sourceAfter).toEqual(seeded.sourceBefore);
    expect(readFileSync(sourceBytesPath)).toEqual(sourceBytes);
    expect(databaseValue<{ count: number }>(fixture.databasePath,
      'SELECT COUNT(*) count FROM derived_data_policy_bindings WHERE binding_hash=? AND status=\'sealed\'', seeded.bindingHash).count).toBe(1);
    expect(databaseValue<{ count: number }>(fixture.databasePath,
      'SELECT COUNT(*) count FROM derived_data_policy_sources WHERE binding_hash=? AND source_resource_id=?',
      seeded.bindingHash, row.source_resource_id).count).toBe(1);
  });
});
