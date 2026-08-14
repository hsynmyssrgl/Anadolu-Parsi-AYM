import type { FamilyId, IsoDateTime, PersonId, UserId } from '@ppt/core';

export const PRIVACY_OWNERSHIP_MAX_AI_MEMORY_RECORDS = 500 as const;
export const PRIVACY_OWNERSHIP_MAX_INVENTORY_ITEMS = 1_000 as const;
export const PRIVACY_OWNERSHIP_MAX_ACCESS_HISTORY_ITEMS = 500 as const;
export const PRIVACY_OWNERSHIP_MAX_PROCESSING_OBSERVATIONS = 500 as const;
export const PRIVACY_OWNERSHIP_MAX_LINEAGE_ITEMS = 512 as const;
export const PRIVACY_OWNERSHIP_MAX_RIGHTS_REQUESTS = 100 as const;
export const PRIVACY_OWNERSHIP_MAX_ENCRYPTED_EXPORTS = 100 as const;
export const PRIVACY_OWNERSHIP_MAX_INCIDENTS = 100 as const;
export const PRIVACY_OWNERSHIP_MAX_SELECTED_ACCOUNTS = 32 as const;
export const PRIVACY_OWNERSHIP_MAX_TEXT_LENGTH = 4_096 as const;

export interface PrivacyOwnershipAggregateKey {
  readonly familyId: FamilyId;
  readonly accountId: UserId;
  readonly ownerPersonId: PersonId;
}

export type AiMemoryRecordStatus = 'active' | 'restricted' | 'expired' | 'pending_deletion' | 'deleted';
export type AiMemoryVisibility = 'owner_only' | 'selected_accounts' | 'family';
export type AiMemoryPurpose = 'general' | 'care' | 'finance' | 'health' | 'archive' | 'legacy' | 'ai_processing';

export interface AiMemoryRestrictionView {
  readonly visibility: AiMemoryVisibility;
  readonly selectedAccountIds: readonly UserId[];
  readonly allowedPurposes: readonly AiMemoryPurpose[];
  readonly processingAllowed: boolean;
}

export interface AiMemoryRecordView {
  readonly id: string;
  readonly key: PrivacyOwnershipAggregateKey;
  readonly revision: number;
  readonly title: string;
  readonly statement: string;
  readonly sourceResourceType: string;
  readonly sourceResourceId: string;
  readonly sourceOccurredAt?: IsoDateTime;
  readonly restriction: AiMemoryRestrictionView;
  readonly status: AiMemoryRecordStatus;
  readonly retentionUntil?: IsoDateTime;
  readonly expiredAt?: IsoDateTime;
  readonly deletionRequestedAt?: IsoDateTime;
  readonly deletedAt?: IsoDateTime;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export type PrivacyDataCategory =
  | 'identity' | 'family' | 'health' | 'finance' | 'location' | 'communication'
  | 'archive' | 'ai_memory' | 'ocr' | 'translation' | 'legacy' | 'security' | 'other';

export interface DataInventoryItemView {
  readonly id: string;
  readonly key: PrivacyOwnershipAggregateKey;
  readonly category: PrivacyDataCategory;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly displayName: string;
  readonly recordCount: number;
  readonly storageScope: 'local_encrypted' | 'managed_backup' | 'external_copy_declared';
  readonly sensitivity: 'personal' | 'sensitive' | 'highly_sensitive';
  readonly retentionUntil?: IsoDateTime;
  readonly lastAccessedAt?: IsoDateTime;
  readonly derivedDataCount: number;
}

export interface AccessHistoryEntryView {
  readonly id: string;
  readonly key: PrivacyOwnershipAggregateKey;
  readonly actorAccountId: UserId;
  readonly actorPersonId?: PersonId;
  readonly actorDisplayName: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly action: 'read' | 'create' | 'update' | 'delete' | 'share' | 'process' | 'record' | 'administer';
  readonly purpose: string;
  readonly decision: 'allowed' | 'denied';
  readonly decisionReason: string;
  readonly occurredAt: IsoDateTime;
  readonly deviceId?: string;
  readonly correlationId: string;
  readonly source: 'immutable_policy_receipt' | 'audit_chain';
}

export interface LocalDeviceActivityView {
  readonly id: string;
  readonly key: PrivacyOwnershipAggregateKey;
  readonly deviceId: string;
  readonly displayName: string;
  readonly currentDevice: boolean;
  readonly trustStatus: 'trusted' | 'revoked';
  readonly locallyObservedSession: 'current_session' | 'recently_seen' | 'not_observed';
  readonly observedAt?: IsoDateTime;
  readonly lastSeenAt: IsoDateTime;
  readonly securityEpoch: number;
  readonly appleSyncStatus: 'not_configured' | 'unsupported' | 'locally_observed';
  readonly observationSource: 'local_runtime';
}

export type LocalProcessingKind = 'ai' | 'ocr' | 'translation';
export interface LocalProcessingObservationView {
  readonly id: string;
  readonly key: PrivacyOwnershipAggregateKey;
  readonly kind: LocalProcessingKind;
  readonly status: 'started' | 'completed' | 'failed' | 'cancelled';
  readonly resourceType: string;
  readonly resourceId: string;
  readonly purpose: string;
  readonly processor: 'local_ai' | 'local_ocr' | 'local_translation';
  readonly observedAt: IsoDateTime;
  readonly completedAt?: IsoDateTime;
  readonly observationSource: 'local_runtime';
  readonly networkDeliveryObserved: false;
}

export interface DerivedDataLineageView {
  readonly id: string;
  readonly key: PrivacyOwnershipAggregateKey;
  readonly derivedKind: 'OCR_TEXT' | 'SEARCH_INDEX' | 'THUMBNAIL' | 'AI_MEMORY' | 'SUMMARY'
    | 'EMBEDDING' | 'TRANSLATION' | 'TRANSCRIPT' | 'CACHE' | 'REPLICA';
  readonly sourceResourceType: string;
  readonly sourceResourceId: string;
  readonly derivedResourceId: string;
  readonly depth: number;
  readonly retentionUntil?: IsoDateTime;
  readonly deletionPropagation: 'not_requested' | 'pending' | 'locally_completed' | 'attention_required';
  readonly payloadExposed: false;
}

export type DataRightsRequestKind = 'encrypted_export' | 'retention_change' | 'erasure' | 'legacy_export';
export type DataRightsRequestStatus = 'requested' | 'in_review' | 'locally_completed' | 'rejected' | 'cancelled';
export interface DataRightsRequestView {
  readonly id: string;
  readonly key: PrivacyOwnershipAggregateKey;
  readonly revision: number;
  readonly kind: DataRightsRequestKind;
  readonly scopeResourceType: string;
  readonly scopeResourceId: string;
  readonly requestedRetentionUntil?: IsoDateTime;
  readonly status: DataRightsRequestStatus;
  readonly reason: string;
  readonly resolutionNote?: string;
  readonly encryptedExportRequired: boolean;
  readonly externalCopiesErasureGuaranteed: false;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface EncryptedPrivacyExportView {
  readonly id: string;
  readonly key: PrivacyOwnershipAggregateKey;
  readonly requestId: string;
  readonly requestKind: 'encrypted_export' | 'legacy_export';
  readonly requestRevision: number;
  readonly artifactSha256: string;
  readonly envelopeSha256: string;
  readonly lineageSha256: string;
  readonly itemCount: number;
  readonly plaintextSizeBytes: number;
  readonly sizeBytes: number;
  readonly readbackVerified: true;
  readonly encrypted: true;
  readonly localUserSelected: true;
  readonly networkDeliveryGuaranteed: false;
  readonly recipientReadGuaranteed: false;
  readonly localArtifactPathExposed: false;
  readonly passphraseExposed: false;
  readonly createdAt: IsoDateTime;
}

export type PrivacyIncidentStatus = 'open' | 'contained_locally' | 'resolved' | 'cancelled';
export type PrivacyIncidentAction =
  | 'revoke_local_session_authority'
  | 'revoke_trusted_device'
  | 'revoke_offline_capability'
  | 'revoke_consent'
  | 'revoke_capability'
  | 'quarantine_local_derived_data';

export interface PrivacyIncidentActionIntent {
  readonly action: PrivacyIncidentAction;
  readonly targetId: string;
}

export interface PrivacyIncidentView {
  readonly id: string;
  readonly key: PrivacyOwnershipAggregateKey;
  readonly revision: number;
  readonly title: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly status: PrivacyIncidentStatus;
  readonly suspectedAt: IsoDateTime;
  readonly actions: readonly PrivacyIncidentActionIntent[];
  readonly evidenceReferenceIds: readonly string[];
  readonly resolutionNote?: string;
  readonly remoteWipePerformed: false;
  readonly mdmOperationPerformed: false;
  readonly networkDeliveryGuaranteed: false;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface PermissionSimulationTarget {
  readonly subjectAccountId: UserId;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly action: 'read' | 'share' | 'process';
  readonly purpose: 'general' | 'care' | 'finance' | 'health' | 'archive' | 'legacy' | 'ai_processing' | 'administration';
  readonly occurredAt: IsoDateTime;
}

export interface PermissionSimulationItemView extends PermissionSimulationTarget {
  readonly visible: boolean;
  readonly reason: string;
  readonly obligations: readonly string[];
}

export interface PermissionSimulationView {
  readonly key: PrivacyOwnershipAggregateKey;
  readonly items: readonly PermissionSimulationItemView[];
  readonly simulatedAt: IsoDateTime;
  readonly grantsCreated: false;
  readonly accessPerformed: false;
  readonly auditAccessRecorded: false;
}

export interface PrivacyOwnershipTruthView {
  readonly scope: 'local_observation_and_authority_only';
  readonly remoteWipeAvailable: false;
  readonly mdmAvailable: false;
  readonly networkDeliveryGuaranteed: false;
  readonly processingShownOnlyWhenLocallyObserved: true;
  readonly trustedDeviceDoesNotMeanOpenSession: true;
  readonly simulationCreatesNoGrant: true;
  readonly simulationPerformsNoAccess: true;
  readonly externalCopiesErasureGuaranteed: false;
  readonly derivedPayloadExposed: false;
}

export interface PrivacyOwnershipControlCenterView {
  readonly schemaVersion: 1;
  readonly key: PrivacyOwnershipAggregateKey;
  readonly aiMemoryRecords: readonly AiMemoryRecordView[];
  readonly dataInventory: readonly DataInventoryItemView[];
  readonly accessHistory: readonly AccessHistoryEntryView[];
  readonly localDeviceActivity: readonly LocalDeviceActivityView[];
  readonly localProcessingObservations: readonly LocalProcessingObservationView[];
  readonly derivedDataLineage: readonly DerivedDataLineageView[];
  readonly rightsRequests: readonly DataRightsRequestView[];
  readonly encryptedExports: readonly EncryptedPrivacyExportView[];
  readonly incidents: readonly PrivacyIncidentView[];
  readonly truth: PrivacyOwnershipTruthView;
  readonly generatedAt: IsoDateTime;
}

export interface PrivacyOwnershipMutationIdentity {
  readonly expectedRevision: number;
  readonly clientOperationId: string;
}

export interface PrivacyOwnershipMutationReceiptView {
  readonly clientOperationId: string;
  readonly mutationKind:
    | 'ai_memory_correct' | 'ai_memory_restrict' | 'ai_memory_delete' | 'ai_memory_expire'
    | 'rights_request_create' | 'rights_request_update' | 'rights_export_finalize'
    | 'incident_create' | 'incident_update';
  readonly resourceType: 'ai_memory_record' | 'data_rights_request' | 'privacy_incident';
  readonly resourceId: string;
  readonly previousRevision: number;
  readonly revision: number;
  readonly occurredAt: IsoDateTime;
  readonly stateFingerprint: string;
  readonly replayed: boolean;
}

export interface CorrectAiMemoryInput extends PrivacyOwnershipMutationIdentity {
  readonly recordId: string;
  readonly title: string;
  readonly statement: string;
}

export interface RestrictAiMemoryInput extends PrivacyOwnershipMutationIdentity {
  readonly recordId: string;
  readonly restriction: AiMemoryRestrictionView;
}

export interface DeleteAiMemoryInput extends PrivacyOwnershipMutationIdentity {
  readonly recordId: string;
  readonly reason: string;
}

export interface ExpireAiMemoryInput extends PrivacyOwnershipMutationIdentity {
  readonly recordId: string;
  readonly retentionUntil: IsoDateTime;
}

export interface CreateDataRightsRequestInput extends PrivacyOwnershipMutationIdentity {
  readonly kind: DataRightsRequestKind;
  readonly scopeResourceType: string;
  readonly scopeResourceId: string;
  readonly reason: string;
  readonly requestedRetentionUntil?: IsoDateTime;
}

export interface UpdateDataRightsRequestInput extends PrivacyOwnershipMutationIdentity {
  readonly requestId: string;
  readonly status: DataRightsRequestStatus;
  readonly resolutionNote?: string;
}

export interface FinalizeEncryptedPrivacyExportInput extends PrivacyOwnershipMutationIdentity {
  readonly requestId: string;
  readonly artifactSha256: string;
  readonly envelopeSha256: string;
  readonly lineageSha256: string;
  readonly itemCount: number;
  readonly plaintextSizeBytes: number;
  readonly sizeBytes: number;
}

export interface CreatePrivacyIncidentInput extends PrivacyOwnershipMutationIdentity {
  readonly title: string;
  readonly severity: PrivacyIncidentView['severity'];
  readonly suspectedAt: IsoDateTime;
  readonly actions: readonly PrivacyIncidentActionIntent[];
  readonly evidenceReferenceIds: readonly string[];
}

export interface UpdatePrivacyIncidentInput extends PrivacyOwnershipMutationIdentity {
  readonly incidentId: string;
  readonly status: PrivacyIncidentStatus;
  readonly resolutionNote?: string;
}

export interface SimulatePermissionVisibilityInput {
  readonly targets: readonly PermissionSimulationTarget[];
}

const canonicalKey = (key: PrivacyOwnershipAggregateKey) => ({
  familyId: key.familyId,
  accountId: key.accountId,
  ownerPersonId: key.ownerPersonId
});

/** Byte-exact semantic projection shared by application and repositories. */
export const canonicalAiMemoryStateJson = (row: AiMemoryRecordView): string => JSON.stringify({
  id: row.id, key: canonicalKey(row.key), revision: row.revision, title: row.title,
  statement: row.statement, sourceResourceType: row.sourceResourceType,
  sourceResourceId: row.sourceResourceId, sourceOccurredAt: row.sourceOccurredAt ?? null,
  restriction: {
    visibility: row.restriction.visibility,
    selectedAccountIds: [...row.restriction.selectedAccountIds],
    allowedPurposes: [...row.restriction.allowedPurposes],
    processingAllowed: row.restriction.processingAllowed
  },
  status: row.status, retentionUntil: row.retentionUntil ?? null,
  expiredAt: row.expiredAt ?? null, deletionRequestedAt: row.deletionRequestedAt ?? null,
  deletedAt: row.deletedAt ?? null, createdAt: row.createdAt, updatedAt: row.updatedAt
});

export const canonicalDataRightsRequestStateJson = (row: DataRightsRequestView): string => JSON.stringify({
  id: row.id, key: canonicalKey(row.key), revision: row.revision, kind: row.kind,
  scopeResourceType: row.scopeResourceType, scopeResourceId: row.scopeResourceId,
  requestedRetentionUntil: row.requestedRetentionUntil ?? null, status: row.status,
  reason: row.reason, resolutionNote: row.resolutionNote ?? null,
  encryptedExportRequired: row.encryptedExportRequired,
  externalCopiesErasureGuaranteed: row.externalCopiesErasureGuaranteed,
  createdAt: row.createdAt, updatedAt: row.updatedAt
});

export const canonicalPrivacyIncidentStateJson = (row: PrivacyIncidentView): string => JSON.stringify({
  id: row.id, key: canonicalKey(row.key), revision: row.revision, title: row.title,
  severity: row.severity, status: row.status, suspectedAt: row.suspectedAt,
  actions: row.actions.map((item) => ({ action: item.action, targetId: item.targetId })),
  evidenceReferenceIds: [...row.evidenceReferenceIds], resolutionNote: row.resolutionNote ?? null,
  remoteWipePerformed: row.remoteWipePerformed, mdmOperationPerformed: row.mdmOperationPerformed,
  networkDeliveryGuaranteed: row.networkDeliveryGuaranteed,
  createdAt: row.createdAt, updatedAt: row.updatedAt
});

export const canonicalEncryptedPrivacyExportStateJson = (row: EncryptedPrivacyExportView): string => JSON.stringify({
  id: row.id, key: canonicalKey(row.key), requestId: row.requestId, requestKind: row.requestKind,
  requestRevision: row.requestRevision, artifactSha256: row.artifactSha256,
  envelopeSha256: row.envelopeSha256, lineageSha256: row.lineageSha256,
  itemCount: row.itemCount, plaintextSizeBytes: row.plaintextSizeBytes, sizeBytes: row.sizeBytes,
  readbackVerified: row.readbackVerified,
  encrypted: row.encrypted, localUserSelected: row.localUserSelected,
  networkDeliveryGuaranteed: row.networkDeliveryGuaranteed,
  recipientReadGuaranteed: row.recipientReadGuaranteed,
  localArtifactPathExposed: row.localArtifactPathExposed,
  passphraseExposed: row.passphraseExposed, createdAt: row.createdAt
});
