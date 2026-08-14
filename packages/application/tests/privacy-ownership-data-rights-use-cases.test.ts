import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ERROR_CODES,
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asUserId,
  createAppError,
  err,
  ok,
  type AppError,
  type EventId,
  type PersonId,
  type Result
} from '@ppt/core';
import {
  canonicalAiMemoryStateJson,
  canonicalDataRightsRequestStateJson,
  canonicalEncryptedPrivacyExportStateJson,
  canonicalPrivacyIncidentStateJson,
  type AiMemoryRecordView,
  type PermissionSimulationTarget,
  type PrivacyIncidentActionIntent
} from '@ppt/domain';
import type {
  AiMemoryRecordRow,
  DataRightsRequestRow,
  EncryptedPrivacyExportRow,
  PrivacyIncidentRow,
  PrivacyOwnershipMutationRow
} from '@ppt/repository-contracts';
import {
  GetPrivacyOwnershipControlCenterUseCase,
  FinalizeEncryptedPrivacyExportUseCase,
  ManageAiMemoryUseCase,
  ManageDataRightsRequestUseCase,
  ManagePrivacyIncidentUseCase,
  SimulatePermissionVisibilityUseCase,
  type PrivacyOwnershipApplicationContext,
  type PrivacyOwnershipMutationIdentifiers,
  type PrivacyOwnershipPolicyIntent,
  type PrivacyOwnershipUnitOfWork,
  type PrivacyOwnershipWriteScope
} from '../src/privacy-ownership-data-rights-use-cases.js';

const NOW = asIsoDateTime('2026-08-14T09:00:00.000Z');
const FAMILY = asFamilyId('family-33-o');
const ACCOUNT = asUserId('account-33-o');
const PERSON = 'person-33-o' as PersonId;
const context: PrivacyOwnershipApplicationContext = {
  familyId: FAMILY,
  actor: { userId: ACCOUNT, role: 'family_admin', personId: PERSON },
  correlationId: asCorrelationId('privacy-ownership-33-o-test')
};
const key = { familyId: FAMILY, accountId: ACCOUNT, ownerPersonId: PERSON };
const hash = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

const identifiers = (resourceId: string, suffix: string): PrivacyOwnershipMutationIdentifiers => ({
  mutationId: `mutation-${suffix}`,
  resourceId,
  requestFingerprint: suffix.padEnd(64, 'a').slice(0, 64).replace(/[^0-9a-f]/gu, 'a'),
  auditId: `audit-${suffix}`,
  outboxEventId: `event-${suffix}` as EventId
});

const aiSeed = (): AiMemoryRecordRow => {
  const view: AiMemoryRecordView = {
    id: 'memory-1', key, revision: 1, title: 'Tercih', statement: 'Eski kayıt',
    sourceResourceType: 'event', sourceResourceId: 'event-1',
    restriction: { visibility: 'owner_only', selectedAccountIds: [], allowedPurposes: ['general'], processingAllowed: false },
    status: 'active', retentionUntil: asIsoDateTime('2027-08-14T09:00:00.000Z'),
    createdAt: NOW, updatedAt: NOW
  };
  return { ...view, familyId: FAMILY, accountId: ACCOUNT, ownerPersonId: PERSON,
    lastMutationId: 'trusted-ingestion-1', stateFingerprint: hash(canonicalAiMemoryStateJson(view)),
    derivedBindingHash: 'b'.repeat(64) };
};

class Unit implements PrivacyOwnershipUnitOfWork {
  public ai: AiMemoryRecordRow | null = aiSeed();
  public rights: DataRightsRequestRow | null = null;
  public incident: PrivacyIncidentRow | null = null;
  public encryptedExports: EncryptedPrivacyExportRow[] = [];
  public mutations: PrivacyOwnershipMutationRow[] = [];
  public intents: PrivacyOwnershipPolicyIntent[] = [];
  public audits = 0;
  public events = 0;
  public propagationCalls = 0;
  public incidentActions: PrivacyIncidentActionIntent[] = [];
  public operationOrder: string[] = [];
  public failIncidentAction = false;
  public failRightsSave = false;
  public failExportRecord = false;

  public async execute<T>(
    _context: PrivacyOwnershipApplicationContext,
    intent: PrivacyOwnershipPolicyIntent,
    operation: (scope: PrivacyOwnershipWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    this.intents.push(intent);
    const snapshot = {
      ai: this.ai, rights: this.rights, incident: this.incident,
      encryptedExports: [...this.encryptedExports], mutations: [...this.mutations],
      audits: this.audits, events: this.events, incidentActions: [...this.incidentActions]
    };
    const failure = () => err(createAppError({ code: ERROR_CODES.RESOURCE_CONFLICT,
      message: 'forced transaction failure', category: 'conflict', correlationId: context.correlationId }));
    const result = operation({
      occurredAt: NOW,
      loadCenter: () => ok({ key, aiMemoryRecords: this.ai ? [this.ai] : [],
        dataInventory: [], accessHistory: [], localDeviceActivity: [],
        localProcessingObservations: [], derivedDataLineage: [],
        rightsRequests: this.rights ? [this.rights] : [], encryptedExports: this.encryptedExports,
        incidents: this.incident ? [this.incident] : [], generatedAt: NOW }),
      findAiMemoryRecord: (_key, id) => ok(this.ai?.id === id ? this.ai : null),
      saveAiMemoryRecord: (row, expected) => {
        if (!this.ai || this.ai.revision !== expected) return ok(false);
        this.ai = row;
        return ok(true);
      },
      propagateAiMemoryDeletion: () => { this.propagationCalls += 1; return ok({ locallyCompleted: true }); },
      findRightsRequest: (_key, id) => ok(this.rights?.id === id ? this.rights : null),
      insertRightsRequest: (row) => { this.rights = row; return ok(undefined); },
      recordEncryptedExport: (row) => { this.operationOrder.push('export.record'); if (this.failExportRecord) return failure(); this.encryptedExports.push(row); return ok(undefined); },
      saveRightsRequest: (row, expected) => {
        this.operationOrder.push('rights.save');
        if (this.failRightsSave) return failure();
        if (!this.rights || this.rights.revision !== expected) return ok(false);
        this.rights = row;
        return ok(true);
      },
      findIncident: (_key, id) => ok(this.incident?.id === id ? this.incident : null),
      insertIncident: (row) => { this.operationOrder.push('incident.insert'); this.incident = row; return ok(undefined); },
      saveIncident: (row, expected) => {
        if (!this.incident || this.incident.revision !== expected) return ok(false);
        this.incident = row;
        return ok(true);
      },
      findMutationByClientOperationId: (_key, operationId) =>
        ok(this.mutations.find((item) => item.clientOperationId === operationId) ?? null),
      insertMutation: (row) => { this.operationOrder.push('mutation.insert'); this.mutations.push(row); return ok(undefined); },
      advanceSecurityEpochAndRevokeLocalSessions: (targetId) => { this.operationOrder.push('incident.action'); if (this.failIncidentAction) return failure(); this.incidentActions.push({ action: 'revoke_local_session_authority', targetId }); return ok({ securityEpoch: 2 }); },
      revokeTrustedDevice: (targetId) => { this.operationOrder.push('incident.action'); if (this.failIncidentAction) return failure(); this.incidentActions.push({ action: 'revoke_trusted_device', targetId }); return ok(undefined); },
      revokeOfflineCapability: (targetId) => { this.operationOrder.push('incident.action'); if (this.failIncidentAction) return failure(); this.incidentActions.push({ action: 'revoke_offline_capability', targetId }); return ok(undefined); },
      revokeConsent: (targetId) => { this.operationOrder.push('incident.action'); if (this.failIncidentAction) return failure(); this.incidentActions.push({ action: 'revoke_consent', targetId }); return ok(undefined); },
      revokeCapability: (targetId) => { this.operationOrder.push('incident.action'); if (this.failIncidentAction) return failure(); this.incidentActions.push({ action: 'revoke_capability', targetId }); return ok(undefined); },
      quarantineLocalDerivedData: (targetId) => { this.operationOrder.push('incident.action'); if (this.failIncidentAction) return failure(); this.incidentActions.push({ action: 'quarantine_local_derived_data', targetId }); return ok(undefined); },
      evaluatePermission: (target) => ok({ allowed: target.resourceId === 'visible', reason: target.resourceId === 'visible' ? 'ALLOW_POLICY' : 'EXPLICIT_DENY', obligations: [] }),
      appendAudit: () => { this.operationOrder.push('audit.append'); this.audits += 1; return ok('audit-hash'); },
      enqueueEvent: () => { this.operationOrder.push('outbox.enqueue'); this.events += 1; return ok(undefined); }
    });
    if (!result.ok) {
      this.ai = snapshot.ai; this.rights = snapshot.rights; this.incident = snapshot.incident;
      this.encryptedExports = snapshot.encryptedExports; this.mutations = snapshot.mutations;
      this.audits = snapshot.audits; this.events = snapshot.events; this.incidentActions = snapshot.incidentActions;
    }
    return result;
  }
}

describe('33-O privacy ownership and data rights application', () => {
  it('loads one exact center and hard-codes local-only truth', async () => {
    const unit = new Unit();
    const result = await new GetPrivacyOwnershipControlCenterUseCase(unit).execute(context);
    expect(result.ok && result.value.truth).toEqual({
      scope: 'local_observation_and_authority_only', remoteWipeAvailable: false, mdmAvailable: false,
      networkDeliveryGuaranteed: false, processingShownOnlyWhenLocallyObserved: true,
      trustedDeviceDoesNotMeanOpenSession: true, simulationCreatesNoGrant: true,
      simulationPerformsNoAccess: true, externalCopiesErasureGuaranteed: false, derivedPayloadExposed: false
    });
    expect(result.ok && result.value.aiMemoryRecords[0]?.statement).toBe('Eski kayıt');
    expect(unit.intents[0]).toEqual({ action: 'read', capability: 'family.read',
      resourceType: 'privacy_ownership_center', resourceId: ACCOUNT, purpose: 'administration',
      familyId: FAMILY, ownerPersonId: PERSON, privacy: 'private', sensitivity: 'highly_sensitive' });
  });

  it('corrects only an existing sealed AI-memory row with family.write and a canonical state seal', async () => {
    const unit = new Unit();
    const ids = identifiers('memory-1', 'a1');
    const useCase = new ManageAiMemoryUseCase(unit);
    const result = await useCase.execute({ context, identifiers: ids, command: { operation: 'correct', input: {
      recordId: 'memory-1', expectedRevision: 1, clientOperationId: 'memory-op-0001',
      title: 'Düzeltilen tercih', statement: 'Yeni kayıt'
    } } });
    expect(result.ok && result.value).toMatchObject({ revision: 2, previousRevision: 1, replayed: false });
    expect(unit.ai).toMatchObject({ revision: 2, title: 'Düzeltilen tercih', statement: 'Yeni kayıt', derivedBindingHash: 'b'.repeat(64) });
    expect(unit.ai?.stateFingerprint).toBe(hash(canonicalAiMemoryStateJson(unit.ai!)));
    expect(unit.intents[0]).toMatchObject({ action: 'update', capability: 'family.write', purpose: 'ai_processing', resourceType: 'ai_memory_record' });
    expect(unit.audits).toBe(1);
    expect(unit.events).toBe(1);

    const replay = await useCase.execute({ context, identifiers: ids, command: { operation: 'correct', input: {
      recordId: 'memory-1', expectedRevision: 1, clientOperationId: 'memory-op-0001',
      title: 'Düzeltilen tercih', statement: 'Yeni kayıt'
    } } });
    expect(replay.ok && replay.value.replayed).toBe(true);
    expect(unit.audits).toBe(1);

    const empty = new Unit();
    empty.ai = null;
    const missing = await new ManageAiMemoryUseCase(empty).execute({ context, identifiers: identifiers('memory-2', 'a2'),
      command: { operation: 'correct', input: { recordId: 'memory-2', expectedRevision: 0,
        clientOperationId: 'memory-op-0002', title: 'Yeni', statement: 'Kullanıcı create edemez' } } });
    expect(missing.ok).toBe(false);
    expect(!missing.ok && missing.error.code).toBe(ERROR_CODES.RESOURCE_NOT_FOUND);
  });

  it('deletes AI memory only after local PPK-019 propagation and emits a content-free receipt', async () => {
    const unit = new Unit();
    const result = await new ManageAiMemoryUseCase(unit).execute({ context, identifiers: identifiers('memory-1', 'd1'),
      command: { operation: 'delete', input: { recordId: 'memory-1', expectedRevision: 1,
        clientOperationId: 'memory-delete-1', reason: 'Kullanıcı silme talebi' } } });
    expect(result.ok).toBe(true);
    expect(unit.propagationCalls).toBe(1);
    expect(unit.ai).toMatchObject({ status: 'deleted', title: '', statement: '', deletedAt: NOW,
      restriction: { visibility: 'owner_only', processingAllowed: false } });
    expect(JSON.stringify(unit.mutations[0])).not.toContain('Kullanıcı silme talebi');
  });

  it('persists encrypted/export rights truth and performs every incident action locally in the same UoW', async () => {
    const unit = new Unit();
    const rights = await new ManageDataRightsRequestUseCase(unit).execute({ context,
      identifiers: identifiers('rights-1', 'e1'),
      command: { operation: 'create', input: { expectedRevision: 0, clientOperationId: 'rights-op-0001',
        kind: 'encrypted_export', scopeResourceType: 'privacy_inventory', scopeResourceId: PERSON, reason: 'Kendi verimi almak istiyorum' } } });
    expect(rights.ok).toBe(true);
    expect(unit.rights).toMatchObject({ encryptedExportRequired: true, externalCopiesErasureGuaranteed: false, status: 'requested' });
    expect(unit.rights?.stateFingerprint).toBe(hash(canonicalDataRightsRequestStateJson(unit.rights!)));
    expect(unit.intents[0]).toMatchObject({ action: 'create', capability: 'family.write', purpose: 'administration' });

    const invalidScopeUnit = new Unit();
    const invalidScope = await new ManageDataRightsRequestUseCase(invalidScopeUnit).execute({ context,
      identifiers: identifiers('rights-invalid-scope', 'e2'),
      command: { operation: 'create', input: { expectedRevision: 0, clientOperationId: 'rights-invalid-scope-op',
        kind: 'encrypted_export', scopeResourceType: 'family_data', scopeResourceId: FAMILY,
        reason: 'Kapsam dışı şifreli dışa aktarım' } } });
    expect(invalidScope.ok).toBe(false);
    expect(invalidScopeUnit.rights).toBeNull();

    const actions: PrivacyIncidentActionIntent[] = [
      { action: 'revoke_local_session_authority', targetId: ACCOUNT },
      { action: 'revoke_trusted_device', targetId: 'device-1' },
      { action: 'revoke_offline_capability', targetId: 'lease-1' },
      { action: 'revoke_consent', targetId: 'consent-1' },
      { action: 'revoke_capability', targetId: 'ai.process' }
    ];
    const incident = await new ManagePrivacyIncidentUseCase(unit).execute({ context,
      identifiers: identifiers('incident-1', 'f1'),
      command: { operation: 'create', input: { expectedRevision: 0, clientOperationId: 'incident-op-0001',
        title: 'Şüpheli politika ihlali', severity: 'high', suspectedAt: NOW, actions,
        evidenceReferenceIds: ['receipt-1'] } } });
    expect(incident.ok).toBe(true);
    expect(unit.incidentActions).toEqual(actions);
    expect(unit.incident).toMatchObject({ status: 'contained_locally', remoteWipePerformed: false,
      mdmOperationPerformed: false, networkDeliveryGuaranteed: false });
    expect(unit.incident?.stateFingerprint).toBe(hash(canonicalPrivacyIncidentStateJson(unit.incident!)));
    expect(unit.intents.at(-1)).toMatchObject({ action: 'create', capability: 'family.write', purpose: 'administration', resourceType: 'privacy_incident' });
    expect(unit.operationOrder.indexOf('incident.insert')).toBeLessThan(unit.operationOrder.indexOf('incident.action'));
  });

  it('finalizes a readback-verified encrypted export atomically without path or passphrase metadata', async () => {
    const unit = new Unit();
    await new ManageDataRightsRequestUseCase(unit).execute({ context, identifiers: identifiers('export-request-1', 'c1'),
      command: { operation: 'create', input: { expectedRevision: 0, clientOperationId: 'export-request-create',
        kind: 'encrypted_export', scopeResourceType: 'privacy_inventory', scopeResourceId: PERSON, reason: 'Şifreli dışa aktarım' } } });
    const useCase = new FinalizeEncryptedPrivacyExportUseCase(unit);
    const command = { requestId: 'export-request-1', expectedRevision: 1, clientOperationId: 'export-finalize-0001',
      artifactSha256: '1'.repeat(64), envelopeSha256: '2'.repeat(64), lineageSha256: '3'.repeat(64),
      itemCount: 12, plaintextSizeBytes: 3072, sizeBytes: 4096 } as const;
    const finalizeIds = { mutationId: 'mutation-export-finalize', exportId: 'encrypted-export-1',
      requestFingerprint: '4'.repeat(64), auditId: 'audit-export-finalize', outboxEventId: 'event-export-finalize' as EventId };
    const finalized = await useCase.execute({ context, command, identifiers: finalizeIds });
    expect(finalized.ok && finalized.value).toMatchObject({ revision: 2, replayed: false, mutationKind: 'rights_export_finalize' });
    expect(unit.rights).toMatchObject({ status: 'locally_completed', revision: 2 });
    expect(unit.encryptedExports).toHaveLength(1);
    expect(unit.operationOrder.indexOf('rights.save')).toBeLessThan(unit.operationOrder.indexOf('export.record'));
    expect(unit.encryptedExports[0]?.stateFingerprint)
      .toBe(hash(canonicalEncryptedPrivacyExportStateJson(unit.encryptedExports[0]!)));
    expect(unit.encryptedExports[0]).not.toHaveProperty('artifactPath');
    expect(unit.encryptedExports[0]).not.toHaveProperty('passphrase');

    const replay = await useCase.execute({ context, command, identifiers: finalizeIds });
    expect(replay.ok && replay.value.replayed).toBe(true);
    expect(unit.encryptedExports).toHaveLength(1);
    const mismatch = await useCase.execute({ context, command,
      identifiers: { ...finalizeIds, requestFingerprint: '5'.repeat(64) } });
    expect(mismatch.ok).toBe(false);
    expect(!mismatch.ok && mismatch.error.code).toBe(ERROR_CODES.RESOURCE_CONFLICT);

    const wrongKind = new Unit();
    wrongKind.rights = null;
    await new ManageDataRightsRequestUseCase(wrongKind).execute({ context, identifiers: identifiers('erasure-request', 'c2'),
      command: { operation: 'create', input: { expectedRevision: 0, clientOperationId: 'erasure-request-create',
        kind: 'erasure', scopeResourceType: 'archive_item', scopeResourceId: '*', reason: 'Silme' } } });
    const wrong = await new FinalizeEncryptedPrivacyExportUseCase(wrongKind).execute({ context,
      command: { ...command, requestId: 'erasure-request', clientOperationId: 'wrong-export-finalize' },
      identifiers: { ...finalizeIds, mutationId: 'wrong-export-mutation', exportId: 'wrong-export',
        requestFingerprint: '6'.repeat(64), auditId: 'wrong-export-audit', outboxEventId: 'wrong-export-event' as EventId } });
    expect(wrong.ok).toBe(false);

    const rollback = new Unit();
    rollback.rights = null;
    await new ManageDataRightsRequestUseCase(rollback).execute({ context, identifiers: identifiers('rollback-request', 'c3'),
      command: { operation: 'create', input: { expectedRevision: 0, clientOperationId: 'rollback-request-create',
        kind: 'legacy_export', scopeResourceType: 'digital_legacy', scopeResourceId: PERSON, reason: 'Miras paketi' } } });
    rollback.failExportRecord = true;
    const before = { mutations: rollback.mutations.length, audits: rollback.audits, events: rollback.events };
    const failed = await new FinalizeEncryptedPrivacyExportUseCase(rollback).execute({ context,
      command: { ...command, requestId: 'rollback-request', clientOperationId: 'rollback-export-finalize' },
      identifiers: { ...finalizeIds, mutationId: 'rollback-export-mutation', exportId: 'rollback-export',
        requestFingerprint: '7'.repeat(64), auditId: 'rollback-export-audit', outboxEventId: 'rollback-export-event' as EventId } });
    expect(failed.ok).toBe(false);
    expect(rollback.encryptedExports).toHaveLength(0);
    expect({ mutations: rollback.mutations.length, audits: rollback.audits, events: rollback.events }).toEqual(before);
  });

  it('fails closed on illegal rights/incident transitions and more than five containment actions', async () => {
    const unit = new Unit();
    const rightsUseCase = new ManageDataRightsRequestUseCase(unit);
    await rightsUseCase.execute({ context, identifiers: identifiers('rights-transition', 'b1'),
      command: { operation: 'create', input: { expectedRevision: 0, clientOperationId: 'rights-transition-create',
        kind: 'erasure', scopeResourceType: 'archive_item', scopeResourceId: '*', reason: 'Silme talebi' } } });
    const skippedReview = await rightsUseCase.execute({ context, identifiers: identifiers('rights-transition', 'b2'),
      command: { operation: 'update', input: { requestId: 'rights-transition', expectedRevision: 1,
        clientOperationId: 'rights-transition-skip', status: 'locally_completed', resolutionNote: 'Yerel işlem tamamlandı' } } });
    expect(skippedReview.ok).toBe(false);
    expect(!skippedReview.ok && skippedReview.error.code).toBe(ERROR_CODES.RESOURCE_CONFLICT);
    const review = await rightsUseCase.execute({ context, identifiers: identifiers('rights-transition', 'b3'),
      command: { operation: 'update', input: { requestId: 'rights-transition', expectedRevision: 1,
        clientOperationId: 'rights-transition-review', status: 'in_review' } } });
    expect(review.ok).toBe(true);

    const sixActions: PrivacyIncidentActionIntent[] = [
      { action: 'revoke_local_session_authority', targetId: ACCOUNT },
      { action: 'revoke_trusted_device', targetId: 'd1' },
      { action: 'revoke_offline_capability', targetId: 'l1' },
      { action: 'revoke_consent', targetId: 'c1' },
      { action: 'revoke_capability', targetId: 'ai.process' },
      { action: 'quarantine_local_derived_data', targetId: 'derived-1' }
    ];
    const tooMany = await new ManagePrivacyIncidentUseCase(unit).execute({ context,
      identifiers: identifiers('incident-too-many', 'b4'),
      command: { operation: 'create', input: { expectedRevision: 0, clientOperationId: 'incident-too-many-op',
        title: 'Fazla aksiyon', severity: 'high', suspectedAt: NOW, actions: sixActions, evidenceReferenceIds: [] } } });
    expect(tooMany.ok).toBe(false);
    expect(unit.incidentActions).toHaveLength(0);

    const rollback = new Unit();
    rollback.ai = null;
    rollback.failIncidentAction = true;
    const failed = await new ManagePrivacyIncidentUseCase(rollback).execute({ context,
      identifiers: identifiers('incident-rollback', 'b5'),
      command: { operation: 'create', input: { expectedRevision: 0, clientOperationId: 'incident-rollback-op',
        title: 'Rollback olayı', severity: 'critical', suspectedAt: NOW,
        actions: [{ action: 'revoke_local_session_authority', targetId: ACCOUNT }], evidenceReferenceIds: [] } } });
    expect(failed.ok).toBe(false);
    expect(rollback.incident).toBeNull();
    expect(rollback.mutations).toHaveLength(0);
    expect(rollback.audits).toBe(0);
    expect(rollback.events).toBe(0);
    expect(rollback.operationOrder.indexOf('incident.insert')).toBeLessThan(rollback.operationOrder.indexOf('incident.action'));
  });

  it('simulates the real PEP projection without grants, access or access-audit side effects', async () => {
    const unit = new Unit();
    const targets: PermissionSimulationTarget[] = [
      { subjectAccountId: ACCOUNT, resourceType: 'privacy_inventory', resourceId: PERSON, action: 'read', purpose: 'general', occurredAt: NOW }
    ];
    const result = await new SimulatePermissionVisibilityUseCase(unit).execute({ context, targets });
    expect(result.ok && result.value.items.map((item) => item.visible)).toEqual([false]);
    expect(result.ok && result.value).toMatchObject({ grantsCreated: false, accessPerformed: false, auditAccessRecorded: false });
    expect(unit.mutations).toHaveLength(0);
    expect(unit.audits).toBe(0);
    expect(unit.events).toBe(0);
  });
});
