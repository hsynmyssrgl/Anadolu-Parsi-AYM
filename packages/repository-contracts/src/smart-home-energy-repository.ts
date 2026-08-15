import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type {
  SmartHomeCameraConsentView,
  SmartHomeDeviceView,
  SmartHomeMutationKind,
  SmartHomeObservationView,
  SmartHomeResourceType,
  SmartHomeSettingsView
} from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface SmartHomeEnergyCenterKey {
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly actorPersonId: PersonId;
  readonly ownerPersonId: PersonId;
  readonly centerId: string;
}

export interface SmartHomeDeviceRow extends SmartHomeDeviceView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly localIdentifierSha256: string;
  readonly adapterManifestSha256: string;
  readonly adapterSignerKeyId: string;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
}

export interface SmartHomeObservationRow extends SmartHomeObservationView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly sourceManifestSha256: string;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
}

export interface SmartHomeCameraConsentRow extends SmartHomeCameraConsentView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
}

export interface SmartHomeSettingsRow extends SmartHomeSettingsView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
}

export interface SmartHomeMutationRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly resourceType: SmartHomeResourceType;
  readonly resourceId: string;
  readonly actorAccountId: string;
  readonly actorPersonId: PersonId;
  readonly mutationKind: SmartHomeMutationKind;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly expectedRevision: number;
  readonly revision: number;
  readonly resourceStateFingerprint: string;
  readonly occurredAt: IsoDateTime;
}

export interface SmartHomeEnergyCenterSnapshotRow {
  readonly devices: readonly SmartHomeDeviceRow[];
  readonly observations: readonly SmartHomeObservationRow[];
  readonly observationTotal: number;
  readonly cameraConsents: readonly SmartHomeCameraConsentRow[];
  readonly settings: SmartHomeSettingsRow | null;
}

export interface SmartHomeEnergyRepositoryPort {
  loadCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: SmartHomeEnergyCenterKey
  ): RepositoryResult<SmartHomeEnergyCenterSnapshotRow>;
  findDevice(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: SmartHomeEnergyCenterKey,
    deviceId: string
  ): RepositoryResult<SmartHomeDeviceRow | null>;
  findConsent(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: SmartHomeEnergyCenterKey,
    consentId: string
  ): RepositoryResult<SmartHomeCameraConsentRow | null>;
  findSettings(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: SmartHomeEnergyCenterKey
  ): RepositoryResult<SmartHomeSettingsRow | null>;
  findMutationByClientOperationId(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: SmartHomeEnergyCenterKey,
    clientOperationId: string
  ): RepositoryResult<SmartHomeMutationRow | null>;
  insertMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: SmartHomeMutationRow
  ): RepositoryResult<void>;
  insertDevice(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: SmartHomeDeviceRow
  ): RepositoryResult<void>;
  saveDevice(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: SmartHomeDeviceRow,
    expectedRevision: number
  ): RepositoryResult<void>;
  insertObservation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: SmartHomeObservationRow
  ): RepositoryResult<void>;
  insertConsent(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: SmartHomeCameraConsentRow
  ): RepositoryResult<void>;
  saveConsent(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: SmartHomeCameraConsentRow,
    expectedRevision: number
  ): RepositoryResult<void>;
  insertSettings(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: SmartHomeSettingsRow
  ): RepositoryResult<void>;
  saveSettings(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: SmartHomeSettingsRow,
    expectedRevision: number
  ): RepositoryResult<void>;
}

/** Payload-free current-row metadata used before central policy authorization. */
export interface SmartHomeEnergyPolicyResourceRepositoryPort {
  resolvePolicyResource(
    context: RepositoryExecutionContext,
    resourceType: SmartHomeResourceType,
    resourceId: string
  ): RepositoryResult<{
    readonly id: string;
    readonly familyId: FamilyId;
    readonly ownerPersonId: PersonId;
    readonly revision: number;
    readonly status: string;
    readonly stateFingerprint: string;
  } | null>;
}
