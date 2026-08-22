import type { FamilyId, IsoDateTime, PersonId, UserId } from '@ppt/core';

export const IDENTITY_ACCESS_MAX_PASSKEYS = 16 as const;
export const IDENTITY_ACCESS_MAX_FEDERATED_LINKS = 3 as const;
export const IDENTITY_ACCESS_MAX_TEMPORARY_CREDENTIALS = 256 as const;
export const IDENTITY_ACCESS_MAX_COMPANION_SNAPSHOTS = 256 as const;
export const IDENTITY_ACCESS_MAX_DISCLOSED_CLAIMS = 8 as const;
export const IDENTITY_ACCESS_MAX_QR_PAYLOAD_BYTES = 4_096 as const;
export const IDENTITY_ACCESS_MAX_COMPANION_ENVELOPE_BYTES = 8_388_608 as const;
export const IDENTITY_ACCESS_CHALLENGE_TTL_SECONDS = 300 as const;
export const IDENTITY_ACCESS_MAX_TEMPORARY_VALIDITY_SECONDS = 2_678_400 as const;

export interface IdentityAccessAggregateKey {
  readonly familyId: FamilyId;
  readonly accountId: UserId;
  readonly ownerPersonId: PersonId;
}

export type PasskeyTransport = 'internal' | 'usb' | 'nfc' | 'ble' | 'hybrid';
export type PasskeyStatus = 'active' | 'revoked';
export type PasskeyRevocationReason = 'manual' | 'lost' | 'recovery' | 'device_revoked' | 'security_epoch_changed';

/** Renderer-safe passkey metadata. Credential/public-key bytes remain main-process/repository-only. */
export interface PasskeyCredentialView {
  readonly id: string;
  readonly key: IdentityAccessAggregateKey;
  readonly revision: number;
  readonly displayName: string;
  readonly credentialIdSha256: string;
  readonly publicKeySha256: string;
  readonly relyingPartyId: string;
  readonly aaguid?: string;
  readonly transports: readonly PasskeyTransport[];
  readonly signCount: number;
  readonly backupEligible: boolean;
  readonly backupState: boolean;
  readonly trustedDeviceId: string;
  readonly securityEpoch: number;
  readonly status: PasskeyStatus;
  readonly createdAt: IsoDateTime;
  readonly lastUsedAt?: IsoDateTime;
  readonly revokedAt?: IsoDateTime;
  readonly revocationReason?: PasskeyRevocationReason;
  readonly privateKeyStored: false;
  readonly biometricDataStored: false;
  readonly attestationPayloadStored: false;
}

export type IdentityChallengePurpose = 'passkey_registration' | 'passkey_authentication';
export interface PasskeyChallengeView {
  readonly challengeId: string;
  readonly challenge: string;
  readonly purpose: IdentityChallengePurpose;
  readonly relyingPartyId: string;
  readonly expiresAt: IsoDateTime;
  readonly userVerification: 'required';
  readonly residentKey: 'preferred';
  readonly privateKeyLeavesAuthenticator: false;
  readonly biometricDataRequestedByApplication: false;
  readonly allowedCredentialIds: readonly string[];
}

export type FederatedIdentityProvider = 'apple' | 'google' | 'microsoft';
export interface FederatedAuthorizationCeremonyView {
  readonly flowId: string;
  readonly provider: FederatedIdentityProvider;
  readonly authorizationUrl: string;
  readonly expiresAt: IsoDateTime;
  readonly responseType: 'code';
  readonly pkceMethod: 'S256';
  readonly stateBound: true;
  readonly nonceBound: true;
  readonly codeVerifierStoredInEncryptedVault: true;
  readonly codeVerifierExposed: false;
  readonly tokenBytesExposed: false;
  readonly providerAvailabilityGuaranteed: false;
  readonly providerDeliveryGuaranteed: false;
}

export interface FederatedIdentityLinkView {
  readonly id: string;
  readonly key: IdentityAccessAggregateKey;
  readonly revision: number;
  readonly provider: FederatedIdentityProvider;
  readonly configurationId: string;
  readonly authorizationEndpointSha256: string;
  readonly clientConfigurationSha256: string;
  readonly providerSubjectSha256: string;
  readonly grantedScopes: readonly string[];
  readonly status: 'linked' | 'revoked';
  readonly liveAccountTested: true;
  readonly authorizationCodePkceVerified: true;
  readonly stateVerified: true;
  readonly nonceVerified: true;
  readonly tokenBytesExposed: false;
  readonly tokenStoredInEncryptedVault: true;
  readonly providerAvailabilityGuaranteed: false;
  readonly providerDeliveryGuaranteed: false;
  readonly linkedAt: IsoDateTime;
  readonly lastLocallyVerifiedAt: IsoDateTime;
  readonly revokedAt?: IsoDateTime;
}

export type TemporaryCredentialKind =
  | 'school_pickup'
  | 'temporary_caregiver'
  | 'pet_caregiver'
  | 'emergency_contact_health'
  | 'event_invitation'
  | 'temporary_home_access';

export type TemporaryCredentialPurpose =
  | 'school_pickup_authorization'
  | 'temporary_care_authorization'
  | 'pet_care_authorization'
  | 'emergency_contact_health_access'
  | 'event_invitation_access'
  | 'temporary_home_access';

export const TEMPORARY_CREDENTIAL_PURPOSE_BY_KIND = Object.freeze({
  school_pickup: 'school_pickup_authorization',
  temporary_caregiver: 'temporary_care_authorization',
  pet_caregiver: 'pet_care_authorization',
  emergency_contact_health: 'emergency_contact_health_access',
  event_invitation: 'event_invitation_access',
  temporary_home_access: 'temporary_home_access'
} satisfies Readonly<Record<TemporaryCredentialKind, TemporaryCredentialPurpose>>);

export type TemporaryCredentialClaimKey =
  | 'subject_display_name'
  | 'authorized_person_display_name'
  | 'caregiver_display_name'
  | 'pet_display_name'
  | 'school_name'
  | 'emergency_contact_name'
  | 'emergency_contact_phone'
  | 'allergy_summary'
  | 'critical_medication_summary'
  | 'event_title'
  | 'valid_location_label'
  | 'contact_phone';

export interface TemporaryCredentialDisclosedClaim {
  readonly key: TemporaryCredentialClaimKey;
  readonly value: string;
}

export const TEMPORARY_CREDENTIAL_DISCLOSURE_RULES = Object.freeze({
  school_pickup: Object.freeze({
    required: Object.freeze(['subject_display_name', 'authorized_person_display_name'] as const),
    allowed: Object.freeze(['subject_display_name', 'authorized_person_display_name', 'school_name', 'contact_phone'] as const)
  }),
  temporary_caregiver: Object.freeze({
    required: Object.freeze(['subject_display_name', 'caregiver_display_name'] as const),
    allowed: Object.freeze(['subject_display_name', 'caregiver_display_name', 'contact_phone'] as const)
  }),
  pet_caregiver: Object.freeze({
    required: Object.freeze(['pet_display_name', 'caregiver_display_name'] as const),
    allowed: Object.freeze(['pet_display_name', 'caregiver_display_name', 'contact_phone'] as const)
  }),
  emergency_contact_health: Object.freeze({
    required: Object.freeze(['subject_display_name', 'emergency_contact_name', 'emergency_contact_phone'] as const),
    allowed: Object.freeze(['subject_display_name', 'emergency_contact_name', 'emergency_contact_phone', 'allergy_summary', 'critical_medication_summary'] as const)
  }),
  event_invitation: Object.freeze({
    required: Object.freeze(['subject_display_name', 'event_title'] as const),
    allowed: Object.freeze(['subject_display_name', 'event_title', 'valid_location_label', 'contact_phone'] as const)
  }),
  temporary_home_access: Object.freeze({
    required: Object.freeze(['subject_display_name', 'valid_location_label'] as const),
    allowed: Object.freeze(['subject_display_name', 'valid_location_label', 'contact_phone'] as const)
  })
} satisfies Readonly<Record<TemporaryCredentialKind, {
  readonly required: readonly TemporaryCredentialClaimKey[];
  readonly allowed: readonly TemporaryCredentialClaimKey[];
}>>);

export interface TemporaryVerifiableCredentialView {
  readonly id: string;
  readonly key: IdentityAccessAggregateKey;
  readonly revision: number;
  readonly kind: TemporaryCredentialKind;
  readonly purpose: TemporaryCredentialPurpose;
  readonly audienceRefSha256: string;
  readonly disclosedClaimKeys: readonly TemporaryCredentialClaimKey[];
  readonly disclosureSha256: string;
  readonly payloadSha256: string;
  readonly signatureSha256: string;
  readonly issuerKeyId: string;
  readonly issuerPublicKeySha256: string;
  readonly signatureAlgorithm: 'Ed25519';
  readonly qrPayloadBytes: number;
  readonly status: 'active' | 'revoked';
  readonly notBefore: IsoDateTime;
  readonly expiresAt: IsoDateTime;
  readonly issuedAt: IsoDateTime;
  readonly revokedAt?: IsoDateTime;
  readonly revocationReason?: string;
  readonly encryptedEnvelopeStored: true;
  readonly offlineSignatureVerifiable: true;
  readonly expiryOfflineVerifiable: true;
  readonly minimumDisclosureEnforced: true;
  readonly networkDeliveryGuaranteed: false;
  readonly remoteRevocationFreshnessGuaranteed: false;
}

export interface IssuedTemporaryVerifiableCredentialView {
  readonly credential: TemporaryVerifiableCredentialView;
  readonly qrPayload: string;
  readonly qrPayloadBytes: number;
  readonly containsOnlySelectedClaims: true;
  readonly privateSigningKeyExposed: false;
  readonly networkDeliveryGuaranteed: false;
}

export interface TemporaryCredentialVerificationView {
  readonly credentialId: string;
  readonly signatureValid: boolean;
  readonly notYetValid: boolean;
  readonly expired: boolean;
  readonly disclosureValid: boolean;
  readonly revocationStatus: 'not_revoked_locally' | 'revoked_locally' | 'unknown_offline';
  readonly decision: 'accepted_locally' | 'rejected' | 'indeterminate_revocation' | 'indeterminate_issuer';
  readonly audienceMatched: boolean;
  readonly issuerIdentityCertified: false;
  readonly verifiedAt: IsoDateTime;
  readonly offlineSignatureVerified: boolean;
  readonly networkUsed: false;
  readonly remoteRevocationFreshnessGuaranteed: false;
  readonly providerDeliveryGuaranteed: false;
  readonly disclosedClaimKeys: readonly TemporaryCredentialClaimKey[];
}

export interface ReadOnlyCompanionSnapshotMetadataView {
  readonly id: string;
  readonly key: IdentityAccessAggregateKey;
  readonly trustedDeviceId: string;
  readonly protocolVersion: 1;
  readonly sourceVersion: number;
  readonly schemaVersion: number;
  readonly ciphertextSha256: string;
  readonly envelopeSha256: string;
  readonly envelopeBytes: number;
  readonly securityEpoch: number;
  readonly generatedAt: IsoDateTime;
  readonly expiresAt: IsoDateTime;
  readonly sourceAuthority: 'windows_single_writer';
  readonly encrypted: true;
  readonly readOnly: true;
  readonly remoteWritesAccepted: false;
  readonly conflictResolution: 'reject_remote_and_refresh';
  readonly networkDeliveryGuaranteed: false;
}

export interface ReadOnlyCompanionSnapshotView extends ReadOnlyCompanionSnapshotMetadataView {
  readonly status: 'snapshot_ready';
  readonly encryptedEnvelopeBase64Url: string;
}

/** Content-minimized Windows-authoritative projection; secrets and stable external identifiers are excluded. */
export interface IdentityAccessCompanionSourceProjection {
  readonly schemaVersion: 1;
  readonly sourceVersion: number;
  readonly passkeys: readonly Readonly<{ id: string; revision: number; displayName: string; relyingPartyId: string; transports: readonly PasskeyTransport[]; status: 'active' | 'revoked'; createdAt: IsoDateTime; lastUsedAt?: IsoDateTime; revokedAt?: IsoDateTime }>[];
  readonly federatedLinks: readonly Readonly<{ id: string; revision: number; provider: FederatedIdentityProvider; grantedScopes: readonly string[]; status: 'linked' | 'revoked'; linkedAt: IsoDateTime; lastLocallyVerifiedAt: IsoDateTime; revokedAt?: IsoDateTime }>[];
  readonly temporaryCredentials: readonly Readonly<{ id: string; revision: number; kind: TemporaryCredentialKind; purpose: TemporaryCredentialPurpose; disclosedClaimKeys: readonly TemporaryCredentialClaimKey[]; status: 'active' | 'revoked'; notBefore: IsoDateTime; expiresAt: IsoDateTime; issuedAt: IsoDateTime; revokedAt?: IsoDateTime }>[];
  readonly sourceAuthority: 'windows_single_writer';
  readonly remoteWritesAccepted: false;
}

export interface CompanionSyncDenialView {
  readonly status: 'write_forbidden' | 'version_conflict' | 'device_revoked' | 'security_epoch_stale';
  readonly currentSourceVersion: number;
  readonly sourceAuthority: 'windows_single_writer';
  readonly remoteWritesAccepted: false;
  readonly conflictResolution: 'reject_remote_and_refresh';
  readonly networkDeliveryGuaranteed: false;
}

export interface IdentityAccessTruthView {
  readonly passkeyPrivateKeyStored: false;
  readonly biometricDataStored: false;
  readonly passkeyVerificationScope: 'local_verified_ceremony_metadata_only';
  readonly unconfiguredFederatedProvidersVisible: false;
  readonly federatedProviderAvailabilityGuaranteed: false;
  readonly federatedProviderDeliveryGuaranteed: false;
  readonly tokenBytesExposed: false;
  readonly companionSourceAuthority: 'windows_single_writer';
  readonly companionRemoteWritesAccepted: false;
  readonly companionNetworkDeliveryGuaranteed: false;
  readonly credentialQrBounded: true;
  readonly credentialMinimumDisclosureEnforced: true;
  readonly offlineSignatureAndExpiryVerifiable: true;
  readonly remoteRevocationFreshnessGuaranteed: false;
}

export interface IdentityAccessCredentialCenterView {
  readonly schemaVersion: 1;
  readonly key: IdentityAccessAggregateKey;
  /** Exact trusted-device target with a locally configured and validated X25519 recipient key. */
  readonly companionRecipientTrustedDeviceId: string | null;
  readonly passkeys: readonly PasskeyCredentialView[];
  readonly federatedLinks: readonly FederatedIdentityLinkView[];
  readonly temporaryCredentials: readonly TemporaryVerifiableCredentialView[];
  readonly companionSnapshots: readonly ReadOnlyCompanionSnapshotMetadataView[];
  readonly truth: IdentityAccessTruthView;
  readonly generatedAt: IsoDateTime;
}

export interface IdentityAccessMutationIdentity {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
}

export type IdentityAccessOperationKind =
  | IdentityAccessMutationReceiptView['mutationKind']
  | 'companion_snapshot_create';

export interface IdentityAccessOperationTokenView {
  readonly clientOperationId: string;
  readonly operationKind: IdentityAccessOperationKind;
  readonly issuedAt: IsoDateTime;
  readonly expiresAt: IsoDateTime;
}

export interface IdentityAccessMutationReceiptView {
  readonly clientOperationId: string;
  readonly mutationKind:
    | 'passkey_register'
    | 'passkey_authenticate'
    | 'passkey_revoke'
    | 'passkey_recover_lost'
    | 'federated_link'
    | 'federated_unlink'
    | 'temporary_credential_issue'
    | 'temporary_credential_revoke';
  readonly resourceType: 'passkey_credential' | 'federated_identity_link' | 'temporary_verifiable_credential';
  readonly resourceId: string;
  readonly previousRevision: number;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly occurredAt: IsoDateTime;
  readonly replayed: boolean;
}

export interface CompletePasskeyRegistrationInput extends IdentityAccessMutationIdentity {
  readonly challengeId: string;
  readonly ceremonyResponseId: string;
  readonly displayName: string;
}

export interface AuthenticateWithPasskeyInput extends IdentityAccessMutationIdentity {
  readonly challengeId: string;
  readonly ceremonyResponseId: string;
}

export interface RevokePasskeyInput extends IdentityAccessMutationIdentity {
  readonly credentialId: string;
  readonly reason: 'manual' | 'lost';
}

export interface RecoverLostPasskeyInput extends IdentityAccessMutationIdentity {
  readonly credentialId: string;
  readonly recoveryProofId: string;
}

export interface LinkFederatedIdentityInput extends IdentityAccessMutationIdentity {
  readonly provider: FederatedIdentityProvider;
  readonly verifiedFlowId: string;
}

export interface UnlinkFederatedIdentityInput extends IdentityAccessMutationIdentity {
  readonly linkId: string;
}

export interface IssueTemporaryVerifiableCredentialInput extends IdentityAccessMutationIdentity {
  readonly kind: TemporaryCredentialKind;
  readonly purpose: TemporaryCredentialPurpose;
  readonly audienceReference: string;
  readonly disclosedClaims: readonly TemporaryCredentialDisclosedClaim[];
  readonly notBefore: IsoDateTime;
  readonly expiresAt: IsoDateTime;
}

export interface RevokeTemporaryVerifiableCredentialInput extends IdentityAccessMutationIdentity {
  readonly credentialId: string;
  readonly reason: string;
}

export interface VerifyTemporaryVerifiableCredentialInput {
  readonly qrPayload: string;
  readonly expectedAudienceReference: string;
}

export interface CreateReadOnlyCompanionSnapshotInput {
  readonly trustedDeviceId: string;
  readonly requestedMode: 'read_only' | 'write';
  readonly knownSourceVersion?: number;
}

export const canonicalTemporaryCredentialDisclosureJson = (input: {
  readonly id: string;
  readonly kind: TemporaryCredentialKind;
  readonly purpose: TemporaryCredentialPurpose;
  readonly audienceRefSha256: string;
  readonly claims: readonly TemporaryCredentialDisclosedClaim[];
  readonly notBefore: IsoDateTime;
  readonly expiresAt: IsoDateTime;
}): string => JSON.stringify([
  2,
  input.id,
  input.kind,
  input.purpose,
  input.audienceRefSha256,
  [...input.claims].sort((left, right) => left.key.localeCompare(right.key, 'en')).map(({ key, value }) => [key, value]),
  input.notBefore,
  input.expiresAt
]);

export const canonicalPasskeyStateJson = (value: PasskeyCredentialView): string => JSON.stringify([
  1, value.id, value.key.familyId, value.key.accountId, value.key.ownerPersonId, value.revision, value.displayName,
  value.credentialIdSha256, value.publicKeySha256, value.relyingPartyId, value.aaguid ?? null, value.transports,
  value.signCount, value.backupEligible, value.backupState, value.trustedDeviceId, value.securityEpoch, value.status,
  value.createdAt, value.lastUsedAt ?? null, value.revokedAt ?? null, value.revocationReason ?? null,
  false, false, false
]);

export const canonicalFederatedIdentityLinkStateJson = (value: FederatedIdentityLinkView): string => JSON.stringify([
  1, value.id, value.key.familyId, value.key.accountId, value.key.ownerPersonId, value.revision, value.provider,
  value.configurationId, value.authorizationEndpointSha256, value.clientConfigurationSha256,
  value.providerSubjectSha256, value.grantedScopes, value.status, true, true, true, true, false, true, false, false,
  value.linkedAt, value.lastLocallyVerifiedAt, value.revokedAt ?? null
]);

export const canonicalTemporaryCredentialStateJson = (value: TemporaryVerifiableCredentialView): string => JSON.stringify([
  1, value.id, value.key.familyId, value.key.accountId, value.key.ownerPersonId, value.revision, value.kind,
  value.purpose, value.audienceRefSha256, value.disclosedClaimKeys, value.disclosureSha256, value.payloadSha256, value.signatureSha256, value.issuerKeyId,
  value.issuerPublicKeySha256, 'Ed25519', value.qrPayloadBytes, value.status, value.notBefore, value.expiresAt,
  value.issuedAt, value.revokedAt ?? null, value.revocationReason ?? null, true, true, true, true, false, false
]);
