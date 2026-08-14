import type { FamilyId, IsoDateTime, PersonId, UserId } from '@ppt/core';
import type {
  AccessHistoryEntryView,
  AiMemoryRecordView,
  DataInventoryItemView,
  DataRightsRequestView,
  DerivedDataLineageView,
  EncryptedPrivacyExportView,
  LocalDeviceActivityView,
  LocalProcessingObservationView,
  PrivacyIncidentView,
  PrivacyOwnershipAggregateKey
} from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export type PrivacyOwnershipMutationKind =
  | 'ai_memory_correct'
  | 'ai_memory_restrict'
  | 'ai_memory_delete'
  | 'ai_memory_expire'
  | 'rights_request_create'
  | 'rights_request_update'
  | 'rights_export_finalize'
  | 'incident_create'
  | 'incident_update';

export interface PrivacyOwnershipMutationRow {
  readonly id: string;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly familyId: FamilyId;
  readonly accountId: UserId;
  readonly ownerPersonId: PersonId;
  readonly mutationKind: PrivacyOwnershipMutationKind;
  readonly resourceType: 'ai_memory_record' | 'data_rights_request' | 'privacy_incident';
  readonly resourceId: string;
  readonly previousRevision: number;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly createdAt: IsoDateTime;
}

export interface AiMemoryRecordRow extends AiMemoryRecordView {
  readonly familyId: FamilyId;
  readonly accountId: UserId;
  readonly ownerPersonId: PersonId;
  readonly lastMutationId: string;
  readonly stateFingerprint: string;
  readonly derivedBindingHash: string;
}

export interface DataRightsRequestRow extends DataRightsRequestView {
  readonly familyId: FamilyId;
  readonly accountId: UserId;
  readonly ownerPersonId: PersonId;
  readonly lastMutationId: string;
  readonly stateFingerprint: string;
}

export interface PrivacyIncidentRow extends PrivacyIncidentView {
  readonly familyId: FamilyId;
  readonly accountId: UserId;
  readonly ownerPersonId: PersonId;
  readonly lastMutationId: string;
  readonly stateFingerprint: string;
}

export interface EncryptedPrivacyExportRow extends EncryptedPrivacyExportView {
  readonly familyId: FamilyId;
  readonly accountId: UserId;
  readonly ownerPersonId: PersonId;
  readonly stateFingerprint: string;
}

export interface PrivacyOwnershipCenterSnapshotRow {
  readonly key: PrivacyOwnershipAggregateKey;
  readonly aiMemoryRecords: readonly AiMemoryRecordRow[];
  readonly dataInventory: readonly DataInventoryItemView[];
  readonly accessHistory: readonly AccessHistoryEntryView[];
  readonly localDeviceActivity: readonly LocalDeviceActivityView[];
  readonly localProcessingObservations: readonly LocalProcessingObservationView[];
  readonly derivedDataLineage: readonly DerivedDataLineageView[];
  readonly rightsRequests: readonly DataRightsRequestRow[];
  readonly encryptedExports: readonly EncryptedPrivacyExportRow[];
  readonly incidents: readonly PrivacyIncidentRow[];
  readonly generatedAt: IsoDateTime;
}

export interface PrivacyOwnershipPolicyResourceResolution {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly sensitivity: 'personal' | 'sensitive' | 'highly_sensitive';
}

export interface PrivacyIncidentRevocationWrite {
  readonly id: string;
  readonly incidentId: string;
  readonly key: PrivacyOwnershipAggregateKey;
  readonly targetKind: 'session' | 'trusted_device' | 'capability' | 'offline_lease' | 'consent';
  readonly targetFingerprint: string;
  readonly outcome: 'revoked' | 'already_revoked';
  readonly revokedAt: IsoDateTime;
}

export interface PrivacyIncidentQuarantineWrite {
  readonly id: string;
  readonly incidentId: string;
  readonly key: PrivacyOwnershipAggregateKey;
  readonly targetKind: 'device_state' | 'capability_state' | 'event_package' | 'derived_artifact';
  readonly targetFingerprint: string;
  readonly integritySha256: string;
  readonly quarantinedAt: IsoDateTime;
}

export interface PrivacyIncidentDerivedArtifactInspection {
  readonly integritySha256: string;
}

/**
 * Every method is called only inside the same active, policy-authorized
 * transaction. Implementations must enforce the exact family/account/person
 * key and must never return raw payload, receipt JSON, remote-presence claims,
 * or unobserved processing events.
 */
export interface PrivacyOwnershipDataRightsRepositoryPort {
  /** Metadata-only pre-authorization lookup. It must never expose title, statement or payload. */
  resolvePolicyResource(
    context: RepositoryExecutionContext,
    key: PrivacyOwnershipAggregateKey,
    resourceType: 'privacy_ownership_center' | 'ai_memory_record' | 'data_rights_request' | 'privacy_incident',
    resourceId: string
  ): RepositoryResult<PrivacyOwnershipPolicyResourceResolution | null>;

  loadCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: PrivacyOwnershipAggregateKey
  ): RepositoryResult<PrivacyOwnershipCenterSnapshotRow>;

  findAiMemoryRecord(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: PrivacyOwnershipAggregateKey,
    recordId: string
  ): RepositoryResult<AiMemoryRecordRow | null>;
  saveAiMemoryRecord(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: AiMemoryRecordRow,
    expectedRevision: number
  ): RepositoryResult<boolean>;

  findRightsRequest(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: PrivacyOwnershipAggregateKey,
    requestId: string
  ): RepositoryResult<DataRightsRequestRow | null>;
  insertRightsRequest(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: DataRightsRequestRow
  ): RepositoryResult<void>;
  saveRightsRequest(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: DataRightsRequestRow,
    expectedRevision: number
  ): RepositoryResult<boolean>;
  findIncident(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: PrivacyOwnershipAggregateKey,
    incidentId: string
  ): RepositoryResult<PrivacyIncidentRow | null>;
  insertIncident(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: PrivacyIncidentRow
  ): RepositoryResult<void>;
  saveIncident(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: PrivacyIncidentRow,
    expectedRevision: number
  ): RepositoryResult<boolean>;
  recordIncidentRevocation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: PrivacyIncidentRevocationWrite
  ): RepositoryResult<void>;
  quarantineIncidentItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: PrivacyIncidentQuarantineWrite
  ): RepositoryResult<void>;
  inspectLocalDerivedArtifactForIncident(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: PrivacyOwnershipAggregateKey,
    bindingHash: string
  ): RepositoryResult<PrivacyIncidentDerivedArtifactInspection | null>;
  recordEncryptedExport(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: EncryptedPrivacyExportRow
  ): RepositoryResult<void>;

  findMutationByClientOperationId(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: PrivacyOwnershipAggregateKey,
    clientOperationId: string
  ): RepositoryResult<PrivacyOwnershipMutationRow | null>;
  insertMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: PrivacyOwnershipMutationRow
  ): RepositoryResult<void>;
}
