import type { IsoDateTime } from '@ppt/core';

export const COMMUNICATION_ROOM_TYPES = Object.freeze([
  'direct',
  'family',
  'household',
  'family_branch',
  'event',
  'care',
  'private_topic'
] as const);
export type CommunicationRoomType = (typeof COMMUNICATION_ROOM_TYPES)[number];

export type CommunicationRoomStatus = 'active' | 'frozen' | 'closed';
export type CommunicationMembershipRole = 'owner' | 'administrator' | 'member';
export type CommunicationMembershipStatus = 'active' | 'removed';
export type CommunicationDeviceCredentialStatus = 'active' | 'revoked';
export type CommunicationHistoryAccessMode = 'new_members_no_history' | 'explicit_snapshot_grant';
export type CommunicationMlsCipherSuite = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519';

export interface CommunicationDeviceCredentialView {
  readonly id: string;
  readonly trustedDeviceId: string;
  readonly status: CommunicationDeviceCredentialStatus;
  readonly providerVerified: true;
  readonly keyPackageStoredOutsideDatabase: true;
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly revokedAt?: IsoDateTime;
}

export interface CommunicationRoomMembershipView {
  readonly id: string;
  readonly memberPersonId: string;
  readonly deviceCredentialId: string;
  readonly role: CommunicationMembershipRole;
  readonly status: CommunicationMembershipStatus;
  readonly joinedAtEpoch: number;
  readonly historyVisibleFromEpoch: number;
  readonly removedAtEpoch?: number;
}

export interface CommunicationMlsEpochView {
  readonly epoch: number;
  readonly cipherSuite: CommunicationMlsCipherSuite;
  readonly providerEvidenceVerified: true;
  readonly sealedProviderStateStored: true;
  readonly activeDeviceCredentialCount: number;
  readonly createdAt: IsoDateTime;
  readonly reason: CommunicationMlsEpochReason;
}

export interface CommunicationRoomView {
  readonly id: string;
  readonly displayName: string;
  readonly roomType: CommunicationRoomType;
  readonly scopeResourceType?: 'family' | 'household' | 'family_branch' | 'event' | 'care_context';
  readonly scopeResourceId?: string;
  readonly status: CommunicationRoomStatus;
  readonly historyAccessMode: CommunicationHistoryAccessMode;
  readonly currentEpoch: number;
  readonly memberships: readonly CommunicationRoomMembershipView[];
  readonly currentEpochEvidence: CommunicationMlsEpochView;
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationSecurityTruthView {
  readonly centralPolicyKernelRequired: true;
  readonly localRoomAndEpochMetadataRegistryImplemented: true;
  readonly opaqueSealedMlsStateRequired: true;
  readonly verifiedProviderEvidenceRequired: true;
  readonly newMemberHistoryDefaultDenied: true;
  readonly revokedDeviceRekeyWorkflowImplemented: true;
  readonly revokedCredentialBlocksRoomEpochMutationUntilRekey: true;
  readonly automaticRoomRekeyOnCredentialRevocation: false;
  readonly contentFreeAuditRequired: true;
  readonly rendererKeyMaterialAuthority: false;
  readonly rendererRelayAuthority: false;
  readonly privateKeyPersistedInDatabase: false;
  readonly messagePlaintextPersistedByFoundation: false;
  readonly messageEventSignatureVerificationImplemented: false;
  readonly relayDeliveryServiceImplemented: false;
  readonly rfc9420ProviderConfigured: false;
  readonly rfc9420ConformanceVerified: false;
  readonly forwardSecrecyVerifiedInProduction: false;
  readonly postCompromiseSecurityVerifiedInProduction: false;
  readonly relayContentBlindnessVerifiedInProduction: false;
  readonly realMessageExchangePerformed: false;
  readonly networkUsedByCurrentImplementation: false;
}

export interface CommunicationSecurityCenterView {
  readonly schemaVersion: 1;
  readonly centerId: string;
  readonly ownerPersonId: string;
  readonly deviceCredentials: readonly CommunicationDeviceCredentialView[];
  readonly rooms: readonly CommunicationRoomView[];
  readonly truth: CommunicationSecurityTruthView;
  readonly generatedAt: IsoDateTime;
}

export type CommunicationMlsEpochReason =
  | 'room_created'
  | 'member_added'
  | 'member_removed'
  | 'device_revoked_recovery';

/** Main-process only evidence already verified against a separately trusted provider key. */
export interface VerifiedCommunicationDeviceCredentialInput {
  readonly trustedDeviceId: string;
  readonly deviceCredentialSha256: string;
  readonly keyPackageSha256: string;
  readonly sealedCredentialReference: string;
  readonly providerId: string;
  readonly providerImplementation: string;
  readonly providerAttestationSha256: string;
  readonly providerEvidenceVerified: true;
  readonly createdAt: string;
}

/** Main-process only. It contains hashes and an opaque provider reference, never MLS key material. */
export interface VerifiedCommunicationMlsEpochInput {
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
  readonly createdAt: string;
  readonly reason: CommunicationMlsEpochReason;
}

export interface RegisterCommunicationDeviceCredentialInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly trustedDeviceId: string;
}

export interface CreateCommunicationRoomInput {
  readonly clientOperationId: string;
  readonly expectedRevision: 0;
  readonly ownerDeviceCredentialId: string;
  readonly roomType: CommunicationRoomType;
  readonly displayName: string;
  readonly scopeResourceType?: CommunicationRoomView['scopeResourceType'];
  readonly scopeResourceId?: string;
}

export interface RevokeCommunicationDeviceCredentialInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly deviceCredentialId: string;
  readonly confirmation: 'ILETISIM CIHAZ KIMLIGINI IPTAL ET';
  readonly reason: string;
}

export interface AddCommunicationRoomMemberInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly roomId: string;
  readonly memberPersonId: string;
  readonly deviceCredentialId: string;
  readonly role: Exclude<CommunicationMembershipRole, 'owner'>;
}

export interface RemoveCommunicationRoomMemberInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly roomId: string;
  readonly membershipId: string;
  readonly reason: string;
}

export interface SetCommunicationHistoryAccessInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly roomId: string;
  readonly historyAccessMode: CommunicationHistoryAccessMode;
  readonly reason: string;
}

export interface RekeyCommunicationRoomAfterDeviceRevocationInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly roomId: string;
  readonly revokedDeviceCredentialId: string;
  readonly confirmation: 'KAYIP CIHAZ SONRASI ODAYI YENIDEN ANAHTARLA';
  readonly reason: string;
}

export interface FreezeCommunicationRoomInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly roomId: string;
  readonly confirmation: 'ILETISIM ODASINI DONDUR';
  readonly reason: string;
}

export type CommunicationSecurityMutationKind =
  | 'device_credential_register'
  | 'device_credential_revoke'
  | 'room_create'
  | 'member_add'
  | 'member_remove'
  | 'history_policy_update'
  | 'device_revocation_rekey'
  | 'room_freeze';

export type CommunicationSecurityResourceType = 'communication_device_credential' | 'communication_room';

export interface CommunicationSecurityMutationReceiptView {
  readonly resourceType: CommunicationSecurityResourceType;
  readonly resourceId: string;
  readonly mutationKind: CommunicationSecurityMutationKind;
  readonly previousRevision: number;
  readonly revision: number;
  readonly occurredAt: IsoDateTime;
  readonly replayed: boolean;
  readonly messageContentProcessed: false;
  readonly networkUsed: false;
}

export const communicationSecurityCenterId = (familyId: string, ownerPersonId: string): string =>
  `communication-security:${familyId}:${ownerPersonId}`;

export const communicationSecurityTruth = Object.freeze({
  centralPolicyKernelRequired: true as const,
  localRoomAndEpochMetadataRegistryImplemented: true as const,
  opaqueSealedMlsStateRequired: true as const,
  verifiedProviderEvidenceRequired: true as const,
  newMemberHistoryDefaultDenied: true as const,
  revokedDeviceRekeyWorkflowImplemented: true as const,
  revokedCredentialBlocksRoomEpochMutationUntilRekey: true as const,
  automaticRoomRekeyOnCredentialRevocation: false as const,
  contentFreeAuditRequired: true as const,
  rendererKeyMaterialAuthority: false as const,
  rendererRelayAuthority: false as const,
  privateKeyPersistedInDatabase: false as const,
  messagePlaintextPersistedByFoundation: false as const,
  messageEventSignatureVerificationImplemented: false as const,
  relayDeliveryServiceImplemented: false as const,
  rfc9420ProviderConfigured: false as const,
  rfc9420ConformanceVerified: false as const,
  forwardSecrecyVerifiedInProduction: false as const,
  postCompromiseSecurityVerifiedInProduction: false as const,
  relayContentBlindnessVerifiedInProduction: false as const,
  realMessageExchangePerformed: false as const,
  networkUsedByCurrentImplementation: false as const
});
