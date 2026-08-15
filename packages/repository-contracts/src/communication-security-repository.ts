import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type {
  CommunicationDeviceCredentialStatus,
  CommunicationHistoryAccessMode,
  CommunicationMembershipRole,
  CommunicationMembershipStatus,
  CommunicationMlsCipherSuite,
  CommunicationMlsEpochReason,
  CommunicationRoomStatus,
  CommunicationRoomType,
  CommunicationSecurityMutationKind,
  CommunicationSecurityResourceType
} from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface CommunicationSecurityCenterKey {
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly actorPersonId: PersonId;
  readonly ownerPersonId: PersonId;
  readonly centerId: string;
}

export interface CommunicationDeviceCredentialRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly ownerPersonId: PersonId;
  readonly trustedDeviceId: string;
  readonly deviceCredentialSha256: string;
  readonly keyPackageSha256: string;
  readonly sealedCredentialReference: string;
  readonly providerId: string;
  readonly providerImplementation: string;
  readonly providerAttestationSha256: string;
  readonly providerEvidenceVerified: true;
  readonly status: CommunicationDeviceCredentialStatus;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly revokedAt?: IsoDateTime;
}

export interface CommunicationRoomRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly ownerPersonId: PersonId;
  readonly displayName: string;
  readonly roomType: CommunicationRoomType;
  readonly scopeResourceType?: 'family' | 'household' | 'family_branch' | 'event' | 'care_context';
  readonly scopeResourceId?: string;
  readonly maskedRoomRefSha256: string;
  readonly providerGroupIdSha256: string;
  readonly status: CommunicationRoomStatus;
  readonly historyAccessMode: CommunicationHistoryAccessMode;
  readonly currentEpoch: number;
  readonly currentEpochId: string;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationRoomMembershipRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly roomId: string;
  readonly memberPersonId: PersonId;
  readonly deviceCredentialId: string;
  readonly role: CommunicationMembershipRole;
  readonly status: CommunicationMembershipStatus;
  readonly joinedAtEpoch: number;
  readonly historyVisibleFromEpoch: number;
  readonly removedAtEpoch?: number;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationMlsEpochRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly roomId: string;
  readonly epoch: number;
  readonly cipherSuite: CommunicationMlsCipherSuite;
  readonly groupIdSha256: string;
  readonly commitSha256: string;
  readonly confirmedTranscriptHashSha256: string;
  readonly groupContextSha256: string;
  readonly membershipDigestSha256: string;
  readonly sealedStateReference: string;
  readonly providerId: string;
  readonly providerImplementation: string;
  readonly providerAttestationSha256: string;
  readonly providerEvidenceVerified: true;
  readonly activeDeviceCredentialCount: number;
  readonly reason: CommunicationMlsEpochReason;
  readonly mutationId: string;
  readonly createdAt: IsoDateTime;
}

export interface CommunicationSecurityMutationRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly resourceType: CommunicationSecurityResourceType;
  readonly resourceId: string;
  readonly actorAccountId: string;
  readonly actorPersonId: PersonId;
  readonly mutationKind: CommunicationSecurityMutationKind;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly expectedRevision: number;
  readonly revision: number;
  readonly resourceStateFingerprint: string;
  readonly occurredAt: IsoDateTime;
}

export interface CommunicationRoomSnapshotRow {
  readonly room: CommunicationRoomRow;
  readonly memberships: readonly CommunicationRoomMembershipRow[];
  readonly currentEpoch: CommunicationMlsEpochRow;
}

export interface CommunicationSecurityCenterSnapshotRow {
  readonly deviceCredentials: readonly CommunicationDeviceCredentialRow[];
  readonly rooms: readonly CommunicationRoomSnapshotRow[];
}

export interface CommunicationSecurityRepositoryPort {
  loadCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationSecurityCenterKey
  ): RepositoryResult<CommunicationSecurityCenterSnapshotRow>;
  findDeviceCredential(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationSecurityCenterKey,
    credentialId: string
  ): RepositoryResult<CommunicationDeviceCredentialRow | null>;
  findDeviceCredentialByTrustedDeviceId(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationSecurityCenterKey,
    trustedDeviceId: string
  ): RepositoryResult<CommunicationDeviceCredentialRow | null>;
  findFamilyDeviceCredentialForRoom(
    context: PolicyAuthorizedRepositoryExecutionContext,
    familyId: FamilyId,
    credentialId: string
  ): RepositoryResult<CommunicationDeviceCredentialRow | null>;
  findRoom(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationSecurityCenterKey,
    roomId: string
  ): RepositoryResult<CommunicationRoomRow | null>;
  listMemberships(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationSecurityCenterKey,
    roomId: string
  ): RepositoryResult<readonly CommunicationRoomMembershipRow[]>;
  findMembership(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationSecurityCenterKey,
    membershipId: string
  ): RepositoryResult<CommunicationRoomMembershipRow | null>;
  findEpoch(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationSecurityCenterKey,
    roomId: string,
    epoch: number
  ): RepositoryResult<CommunicationMlsEpochRow | null>;
  findMutationByClientOperationId(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationSecurityCenterKey,
    clientOperationId: string
  ): RepositoryResult<CommunicationSecurityMutationRow | null>;
  insertMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationSecurityMutationRow
  ): RepositoryResult<void>;
  insertDeviceCredential(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationDeviceCredentialRow
  ): RepositoryResult<void>;
  saveDeviceCredential(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationDeviceCredentialRow,
    expectedRevision: number
  ): RepositoryResult<void>;
  insertEpoch(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationMlsEpochRow
  ): RepositoryResult<void>;
  insertRoom(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationRoomRow
  ): RepositoryResult<void>;
  saveRoom(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationRoomRow,
    expectedRevision: number
  ): RepositoryResult<void>;
  insertMembership(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationRoomMembershipRow
  ): RepositoryResult<void>;
  saveMembership(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationRoomMembershipRow,
    expectedRevision: number
  ): RepositoryResult<void>;
}

/** Payload-free metadata resolver used before the central policy transaction. */
export interface CommunicationSecurityPolicyResourceRepositoryPort {
  resolvePolicyResource(
    context: RepositoryExecutionContext,
    resourceType: CommunicationSecurityResourceType,
    resourceId: string
  ): RepositoryResult<{
    readonly id: string;
    readonly familyId: FamilyId;
    readonly ownerPersonId: PersonId;
    readonly revision: number;
    readonly status: CommunicationDeviceCredentialStatus | CommunicationRoomStatus;
    readonly stateFingerprint: string;
  } | null>;
}
