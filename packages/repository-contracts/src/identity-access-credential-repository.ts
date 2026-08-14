import type { FamilyId, IsoDateTime, PersonId, UserId } from '@ppt/core';
import type {
  FederatedIdentityLinkView,
  FederatedIdentityProvider,
  IdentityAccessCompanionSourceProjection,
  IdentityAccessAggregateKey,
  PasskeyCredentialView,
  ReadOnlyCompanionSnapshotMetadataView,
  TemporaryVerifiableCredentialView
} from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export type IdentityAccessMutationKind =
  | 'passkey_register'
  | 'passkey_authenticate'
  | 'passkey_revoke'
  | 'passkey_recover_lost'
  | 'federated_link'
  | 'federated_unlink'
  | 'temporary_credential_issue'
  | 'temporary_credential_revoke';

export type IdentityAccessResourceType =
  | 'identity_access_center'
  | 'identity_challenge'
  | 'passkey_credential'
  | 'federated_identity_link'
  | 'temporary_verifiable_credential'
  | 'companion_sync_snapshot';

export interface IdentityAccessMutationRow {
  readonly id: string;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly familyId: FamilyId;
  readonly accountId: UserId;
  readonly ownerPersonId: PersonId;
  readonly mutationKind: IdentityAccessMutationKind;
  readonly resourceType: Exclude<IdentityAccessResourceType, 'identity_access_center' | 'identity_challenge' | 'companion_sync_snapshot'>;
  readonly resourceId: string;
  readonly previousRevision: number;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly createdAt: IsoDateTime;
}

export interface PasskeyCredentialRow extends PasskeyCredentialView {
  readonly familyId: FamilyId;
  readonly accountId: UserId;
  readonly ownerPersonId: PersonId;
  /** Base64url credential identifier needed only by the trusted WebAuthn adapter. */
  readonly credentialId: string;
  /** Verified COSE public key; never a private key or biometric template. */
  readonly publicKeyCoseBase64Url: string;
  readonly userHandleSha256: string;
  readonly lastMutationId: string;
  readonly stateFingerprint: string;
}

export interface FederatedIdentityLinkRow extends FederatedIdentityLinkView {
  readonly familyId: FamilyId;
  readonly accountId: UserId;
  readonly ownerPersonId: PersonId;
  readonly configurationId: string;
  readonly authorizationEndpointSha256: string;
  readonly clientConfigurationSha256: string;
  /** Opaque reference into the existing encrypted token vault; no token bytes. */
  readonly encryptedVaultEntryId: string;
  readonly lastMutationId: string;
  readonly stateFingerprint: string;
}

export interface TemporaryVerifiableCredentialRow extends TemporaryVerifiableCredentialView {
  readonly familyId: FamilyId;
  readonly accountId: UserId;
  readonly ownerPersonId: PersonId;
  /** Opaque encrypted-vault reference; QR/plain claim bytes are not stored in this row. */
  readonly encryptedEnvelopeReference: string;
  readonly lastMutationId: string;
  readonly stateFingerprint: string;
}

export interface IdentityChallengeRow {
  readonly id: string;
  readonly key: IdentityAccessAggregateKey;
  readonly purpose: 'passkey_registration' | 'passkey_authentication';
  readonly challengeSha256: string;
  readonly relyingPartyId: string;
  readonly trustedDeviceId: string;
  readonly deviceId: string;
  readonly securityEpoch: number;
  readonly createdAt: IsoDateTime;
  readonly expiresAt: IsoDateTime;
  readonly consumedAt?: IsoDateTime;
  readonly consumptionMutationId?: string;
}

export interface IdentityTrustedDeviceState {
  readonly trustedDeviceId: string;
  readonly accountId: UserId;
  readonly deviceId: string;
  readonly securityEpoch: number;
  readonly revokedAt?: IsoDateTime;
}

export interface FederatedProviderConfigurationRow {
  readonly provider: FederatedIdentityProvider;
  readonly configured: boolean;
  readonly configurationId: string;
  readonly authorizationEndpointSha256: string;
  readonly clientConfigurationSha256: string;
}

/** Deployment-owned, content-free provider configuration projection. */
export interface FederatedProviderProvisioningRow extends FederatedProviderConfigurationRow {}

export interface CompanionSyncSnapshotRow extends ReadOnlyCompanionSnapshotMetadataView {
  readonly familyId: FamilyId;
  readonly accountId: UserId;
  readonly ownerPersonId: PersonId;
}

export interface IdentityAccessCenterSnapshotRow {
  readonly key: IdentityAccessAggregateKey;
  readonly passkeys: readonly PasskeyCredentialRow[];
  /** Implementations return links only for locally configured providers. */
  readonly federatedLinks: readonly FederatedIdentityLinkRow[];
  readonly temporaryCredentials: readonly TemporaryVerifiableCredentialRow[];
  readonly companionSnapshots: readonly CompanionSyncSnapshotRow[];
  readonly configuredProviders: readonly FederatedIdentityProvider[];
  readonly generatedAt: IsoDateTime;
}

export interface IdentityAccessPolicyResourceResolution {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly sensitivity: 'highly_sensitive';
}

export interface IdentityAccessRetentionPruneResult {
  readonly mutationRowsPruned: number;
  readonly passkeyRowsCompacted: number;
  readonly passkeyTombstonesExpired: number;
  readonly temporaryRowsCompacted: number;
  readonly temporaryTombstonesExpired: number;
}

/**
 * Every payload-bearing method requires an exact PEP-authorized context. The
 * repository never returns passkey private keys, biometric data, token bytes,
 * provider availability claims, or plaintext temporary-credential envelopes.
 */
export interface IdentityAccessCredentialRepositoryPort {
  provisionFederatedProviderConfigurations(
    context: RepositoryExecutionContext,
    rows: readonly FederatedProviderProvisioningRow[]
  ): RepositoryResult<void>;
  pruneTerminalChallenges(
    context: RepositoryExecutionContext,
    cutoff: IsoDateTime
  ): RepositoryResult<number>;
  pruneTerminalCredentialMetadata(
    context: RepositoryExecutionContext,
    key: IdentityAccessAggregateKey,
    destroyedEnvelopeReferences?: readonly string[]
  ): RepositoryResult<IdentityAccessRetentionPruneResult>;
  listTerminalTemporaryCredentialEnvelopeReferences(
    context: RepositoryExecutionContext,
    key: IdentityAccessAggregateKey
  ): RepositoryResult<readonly string[]>;
  listReferencedTemporaryCredentialEnvelopeReferences(
    context: RepositoryExecutionContext,
    key: IdentityAccessAggregateKey
  ): RepositoryResult<readonly string[]>;

  resolvePolicyResource(
    context: RepositoryExecutionContext,
    key: IdentityAccessAggregateKey,
    resourceType: IdentityAccessResourceType,
    resourceId: string
  ): RepositoryResult<IdentityAccessPolicyResourceResolution | null>;

  loadCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: IdentityAccessAggregateKey
  ): RepositoryResult<IdentityAccessCenterSnapshotRow>;

  findTrustedDevice(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: IdentityAccessAggregateKey,
    trustedDeviceId: string
  ): RepositoryResult<IdentityTrustedDeviceState | null>;

  insertChallenge(context: PolicyAuthorizedRepositoryExecutionContext, row: IdentityChallengeRow): RepositoryResult<void>;
  findChallenge(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: IdentityAccessAggregateKey,
    challengeId: string
  ): RepositoryResult<IdentityChallengeRow | null>;
  consumeChallenge(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: IdentityAccessAggregateKey,
    challengeId: string,
    consumedAt: IsoDateTime,
    mutationId: string
  ): RepositoryResult<boolean>;

  listPasskeys(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: IdentityAccessAggregateKey
  ): RepositoryResult<readonly PasskeyCredentialRow[]>;
  findPasskey(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: IdentityAccessAggregateKey,
    passkeyId: string
  ): RepositoryResult<PasskeyCredentialRow | null>;
  findPasskeyByCredentialIdSha256(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: IdentityAccessAggregateKey,
    credentialIdSha256: string
  ): RepositoryResult<PasskeyCredentialRow | null>;
  insertPasskey(context: PolicyAuthorizedRepositoryExecutionContext, row: PasskeyCredentialRow): RepositoryResult<void>;
  savePasskey(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: PasskeyCredentialRow,
    expectedRevision: number
  ): RepositoryResult<boolean>;

  listConfiguredFederatedProviders(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly FederatedProviderConfigurationRow[]>;
  findFederatedLink(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: IdentityAccessAggregateKey,
    linkId: string
  ): RepositoryResult<FederatedIdentityLinkRow | null>;
  findFederatedLinkByProvider(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: IdentityAccessAggregateKey,
    provider: FederatedIdentityProvider
  ): RepositoryResult<FederatedIdentityLinkRow | null>;
  insertFederatedLink(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: FederatedIdentityLinkRow
  ): RepositoryResult<void>;
  saveFederatedLink(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: FederatedIdentityLinkRow,
    expectedRevision: number
  ): RepositoryResult<boolean>;

  findTemporaryCredential(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: IdentityAccessAggregateKey,
    credentialId: string
  ): RepositoryResult<TemporaryVerifiableCredentialRow | null>;
  countTemporaryCredentials(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: IdentityAccessAggregateKey
  ): RepositoryResult<number>;
  insertTemporaryCredential(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: TemporaryVerifiableCredentialRow
  ): RepositoryResult<void>;
  saveTemporaryCredential(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: TemporaryVerifiableCredentialRow,
    expectedRevision: number
  ): RepositoryResult<boolean>;

  recordCompanionSnapshot(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CompanionSyncSnapshotRow
  ): RepositoryResult<void>;
  loadCompanionSourceProjection(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: IdentityAccessAggregateKey
  ): RepositoryResult<IdentityAccessCompanionSourceProjection>;

  findMutationByClientOperationId(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: IdentityAccessAggregateKey,
    clientOperationId: string
  ): RepositoryResult<IdentityAccessMutationRow | null>;
  insertMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: IdentityAccessMutationRow
  ): RepositoryResult<void>;
}
