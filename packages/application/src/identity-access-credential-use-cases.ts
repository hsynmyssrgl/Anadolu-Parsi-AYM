import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type EventId,
  type FamilyId,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import {
  IDENTITY_ACCESS_CHALLENGE_TTL_SECONDS,
  IDENTITY_ACCESS_MAX_COMPANION_ENVELOPE_BYTES,
  IDENTITY_ACCESS_MAX_COMPANION_SNAPSHOTS,
  IDENTITY_ACCESS_MAX_DISCLOSED_CLAIMS,
  IDENTITY_ACCESS_MAX_FEDERATED_LINKS,
  IDENTITY_ACCESS_MAX_PASSKEYS,
  IDENTITY_ACCESS_MAX_QR_PAYLOAD_BYTES,
  IDENTITY_ACCESS_MAX_TEMPORARY_CREDENTIALS,
  IDENTITY_ACCESS_MAX_TEMPORARY_VALIDITY_SECONDS,
  TEMPORARY_CREDENTIAL_DISCLOSURE_RULES,
  TEMPORARY_CREDENTIAL_PURPOSE_BY_KIND,
  canonicalFederatedIdentityLinkStateJson,
  canonicalPasskeyStateJson,
  canonicalTemporaryCredentialDisclosureJson,
  canonicalTemporaryCredentialStateJson,
  type AuthenticateWithPasskeyInput,
  type CompanionSyncDenialView,
  type CompletePasskeyRegistrationInput,
  type CreateReadOnlyCompanionSnapshotInput,
  type FamilyRole,
  type FederatedAuthorizationCeremonyView,
  type FederatedIdentityLinkView,
  type FederatedIdentityProvider,
  type IdentityAccessAggregateKey,
  type IdentityAccessCredentialCenterView,
  type IdentityAccessCompanionSourceProjection,
  type IdentityAccessMutationReceiptView,
  type IssueTemporaryVerifiableCredentialInput,
  type IssuedTemporaryVerifiableCredentialView,
  type LinkFederatedIdentityInput,
  type PasskeyChallengeView,
  type PasskeyCredentialView,
  type PasskeyTransport,
  type ReadOnlyCompanionSnapshotView,
  type RecoverLostPasskeyInput,
  type RevokePasskeyInput,
  type RevokeTemporaryVerifiableCredentialInput,
  type TemporaryCredentialClaimKey,
  type TemporaryCredentialVerificationView,
  type TemporaryVerifiableCredentialView,
  type UnlinkFederatedIdentityInput,
  type VerifyTemporaryVerifiableCredentialInput
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  CompanionSyncSnapshotRow,
  FederatedIdentityLinkRow,
  FederatedProviderConfigurationRow,
  IdentityAccessCenterSnapshotRow,
  IdentityAccessMutationKind,
  IdentityAccessMutationRow,
  IdentityAccessResourceType,
  IdentityChallengeRow,
  IdentityTrustedDeviceState,
  PasskeyCredentialRow,
  TemporaryVerifiableCredentialRow
} from '@ppt/repository-contracts';

export interface IdentityAccessApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: {
    readonly userId: UserId;
    readonly role: FamilyRole;
    readonly personId?: PersonId;
  };
  readonly currentDevice: {
    readonly trustedDeviceId: string;
    readonly deviceId: string;
    readonly securityEpoch: number;
  };
  readonly correlationId: CorrelationId;
}

export interface IdentityAccessPolicyIntent {
  readonly action: 'read' | 'create' | 'update' | 'delete';
  readonly capability: 'family.read' | 'family.write';
  readonly resourceType: IdentityAccessResourceType;
  readonly resourceId: string;
  readonly purpose: 'administration';
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly privacy: 'private';
  readonly sensitivity: 'highly_sensitive';
}

export interface IdentityAccessCredentialWriteScope {
  readonly occurredAt: IsoDateTime;
  loadCenter(key: IdentityAccessAggregateKey): Result<IdentityAccessCenterSnapshotRow, AppError>;
  findTrustedDevice(key: IdentityAccessAggregateKey, trustedDeviceId: string): Result<IdentityTrustedDeviceState | null, AppError>;
  insertChallenge(row: IdentityChallengeRow): Result<void, AppError>;
  findChallenge(key: IdentityAccessAggregateKey, challengeId: string): Result<IdentityChallengeRow | null, AppError>;
  consumeChallenge(key: IdentityAccessAggregateKey, challengeId: string, consumedAt: IsoDateTime, mutationId: string): Result<boolean, AppError>;
  listPasskeys(key: IdentityAccessAggregateKey): Result<readonly PasskeyCredentialRow[], AppError>;
  findPasskey(key: IdentityAccessAggregateKey, passkeyId: string): Result<PasskeyCredentialRow | null, AppError>;
  findPasskeyByCredentialIdSha256(key: IdentityAccessAggregateKey, credentialIdSha256: string): Result<PasskeyCredentialRow | null, AppError>;
  insertPasskey(row: PasskeyCredentialRow): Result<void, AppError>;
  savePasskey(row: PasskeyCredentialRow, expectedRevision: number): Result<boolean, AppError>;
  listConfiguredFederatedProviders(): Result<readonly FederatedProviderConfigurationRow[], AppError>;
  findFederatedLink(key: IdentityAccessAggregateKey, linkId: string): Result<FederatedIdentityLinkRow | null, AppError>;
  findFederatedLinkByProvider(key: IdentityAccessAggregateKey, provider: FederatedIdentityProvider): Result<FederatedIdentityLinkRow | null, AppError>;
  insertFederatedLink(row: FederatedIdentityLinkRow): Result<void, AppError>;
  saveFederatedLink(row: FederatedIdentityLinkRow, expectedRevision: number): Result<boolean, AppError>;
  revokeFederatedVaultEntry(encryptedVaultEntryId: string): Result<void, AppError>;
  findTemporaryCredential(key: IdentityAccessAggregateKey, credentialId: string): Result<TemporaryVerifiableCredentialRow | null, AppError>;
  insertTemporaryCredential(row: TemporaryVerifiableCredentialRow): Result<void, AppError>;
  saveTemporaryCredential(row: TemporaryVerifiableCredentialRow, expectedRevision: number): Result<boolean, AppError>;
  countTemporaryCredentials(key: IdentityAccessAggregateKey): Result<number, AppError>;
  loadCompanionSourceProjection(key: IdentityAccessAggregateKey): Result<IdentityAccessCompanionSourceProjection, AppError>;
  recordCompanionSnapshot(row: CompanionSyncSnapshotRow): Result<void, AppError>;
  findMutationByClientOperationId(key: IdentityAccessAggregateKey, clientOperationId: string): Result<IdentityAccessMutationRow | null, AppError>;
  insertMutation(row: IdentityAccessMutationRow): Result<void, AppError>;
  advanceSecurityEpochAndRevokeLocalSessions(accountId: UserId): Result<{ readonly securityEpoch: number }, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: IdentityAccessResourceType;
    readonly resourceId: string;
    readonly occurredAt: IsoDateTime;
    readonly actorId: UserId;
  }): Result<string, AppError>;
  enqueueEvent<T>(event: DomainEvent<T>): Result<void, AppError>;
}

export interface IdentityAccessCredentialUnitOfWork {
  /** Policy receipt, metadata mutation, vault reference, audit and outbox commit together or roll back. */
  execute<T>(
    context: IdentityAccessApplicationContext,
    intent: IdentityAccessPolicyIntent,
    operation: (scope: IdentityAccessCredentialWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

export interface IdentityChallengeGeneratorPort { createChallenge(): string; }

export interface VerifiedPasskeyRegistration {
  readonly challengeSha256: string;
  readonly relyingPartyId: string;
  readonly credentialId: string;
  readonly publicKeyCoseBase64Url: string;
  readonly userHandleSha256: string;
  readonly aaguid?: string;
  readonly transports: readonly PasskeyTransport[];
  readonly signCount: number;
  readonly backupEligible: boolean;
  readonly backupState: boolean;
  readonly attestationVerified: true;
  readonly userPresent: true;
  readonly userVerified: true;
}

export interface VerifiedPasskeyAuthentication {
  readonly challengeSha256: string;
  readonly credentialIdSha256: string;
  readonly signCount: number;
  readonly signatureVerified: true;
  readonly userPresent: true;
  readonly userVerified: true;
}

export interface PasskeyCeremonyVerifierPort {
  verifyRegistration(input: {
    readonly ceremonyResponseId: string;
    readonly expectedChallengeSha256: string;
    readonly relyingPartyId: string;
    readonly accountId: UserId;
    readonly deviceId: string;
  }): Result<VerifiedPasskeyRegistration, AppError>;
  verifyAuthentication(input: {
    readonly ceremonyResponseId: string;
    readonly expectedChallengeSha256: string;
    readonly relyingPartyId: string;
    readonly credentialId: string;
    readonly publicKeyCoseBase64Url: string;
    readonly expectedUserHandleSha256: string;
    readonly previousSignCount: number;
    readonly accountId: UserId;
  }): Result<VerifiedPasskeyAuthentication, AppError>;
}

export interface PasskeySessionPort { start(accountId: UserId, securityEpoch: number): void; }
export interface StrongPasskeyRecoveryVerifierPort {
  verify(input: { readonly accountId: UserId; readonly recoveryProofId: string; readonly correlationId: CorrelationId }): Result<true, AppError>;
}

export interface VerifiedFederatedIdentityLink {
  readonly provider: FederatedIdentityProvider;
  readonly configurationId: string;
  readonly authorizationEndpointSha256: string;
  readonly clientConfigurationSha256: string;
  readonly providerSubjectSha256: string;
  readonly grantedScopes: readonly string[];
  readonly encryptedVaultEntryId: string;
  readonly liveAccountTested: true;
  readonly authorizationCodePkceVerified: true;
  readonly stateVerified: true;
  readonly nonceVerified: true;
}

export interface FederatedAuthorizationCodeVerifierPort {
  consumeVerifiedFlow(input: {
    readonly flowId: string;
    readonly expectedLinkId: string;
    readonly provider: FederatedIdentityProvider;
    readonly accountId: UserId;
    readonly correlationId: CorrelationId;
  }): Result<VerifiedFederatedIdentityLink, AppError>;
  discardVaultEntry(encryptedVaultEntryId: string): void;
}

export interface FederatedAuthorizationCeremonyPort {
  createAndStore(input: {
    readonly flowId: string;
    readonly provider: FederatedIdentityProvider;
    readonly configurationId: string;
    readonly accountId: UserId;
    readonly createdAt: IsoDateTime;
    readonly correlationId: CorrelationId;
  }): Result<FederatedAuthorizationCeremonyView, AppError>;
  discardCeremony(flowId: string): void;
}

export interface StoredTemporaryCredentialEnvelope {
  readonly qrPayload: string;
  readonly payloadSha256: string;
  readonly signatureSha256: string;
  readonly issuerKeyId: string;
  readonly issuerPublicKeySha256: string;
  readonly signatureAlgorithm: 'Ed25519';
  readonly disclosureSha256: string;
  readonly encryptedEnvelopeReference: string;
  readonly containsOnlyCanonicalDisclosure: true;
}

export interface OfflineTemporaryCredentialVerification {
  readonly credentialId: string;
  readonly kind: keyof typeof TEMPORARY_CREDENTIAL_DISCLOSURE_RULES;
  readonly payloadSha256: string;
  readonly issuerPublicKeySha256: string;
  readonly audienceRefSha256: string;
  readonly notBefore: IsoDateTime;
  readonly expiresAt: IsoDateTime;
  readonly disclosedClaimKeys: readonly TemporaryCredentialClaimKey[];
  readonly signatureValid: boolean;
  readonly disclosureValid: boolean;
  readonly audienceMatched: boolean;
  readonly issuerIdentityCertified: false;
  readonly networkUsed: false;
}

export interface TemporaryCredentialEnvelopePort {
  issueAndStore(input: {
    readonly credentialId: string;
    readonly canonicalDisclosureJson: string;
    readonly disclosureSha256: string;
    readonly ownerRefSha256: string;
    readonly issuedAt: IsoDateTime;
  }): Result<StoredTemporaryCredentialEnvelope, AppError>;
  /** Main-only, content-free inventory used for bounded crash-orphan repair. */
  listOwnedEnvelopeReferences?(ownerRefSha256: string): readonly {
    readonly encryptedEnvelopeReference: string;
    readonly createdAt: IsoDateTime;
  }[];
  discardEncryptedEnvelope(encryptedEnvelopeReference: string, expectedOwnerRefSha256?: string): void;
  verifyOffline(qrPayload: string, expectedAudienceRefSha256: string): Result<OfflineTemporaryCredentialVerification, AppError>;
}

export interface EncryptedCompanionSnapshotPort {
  create(input: {
    readonly key: IdentityAccessAggregateKey;
    readonly trustedDeviceId: string;
    readonly sourceVersion: number;
    readonly schemaVersion: number;
    readonly snapshot: IdentityAccessCompanionSourceProjection;
    readonly securityEpoch: number;
    readonly generatedAt: IsoDateTime;
  }): Result<{
    readonly encryptedEnvelopeBase64Url: string;
    readonly ciphertextSha256: string;
    readonly envelopeSha256: string;
    readonly sourceVersion: number;
    readonly schemaVersion: number;
    readonly expiresAt: IsoDateTime;
  }, AppError>;
}

export interface IdentityAccessOperationIdentifiers {
  readonly mutationId: string;
  readonly resourceId: string;
  readonly requestFingerprint: string;
  readonly auditId: string;
  readonly outboxEventId: EventId;
}

export interface IdentityChallengeIdentifiers {
  readonly challengeId: string;
  readonly auditId: string;
  readonly outboxEventId: EventId;
}

export interface FederatedCeremonyIdentifiers {
  readonly flowId: string;
  readonly auditId: string;
  readonly outboxEventId: EventId;
}

export interface CompanionSnapshotIdentifiers {
  readonly snapshotId: string;
  readonly auditId: string;
  readonly outboxEventId: EventId;
}

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const SHA256 = /^[0-9a-f]{64}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const IDENTIFIER = /^[A-Za-z0-9._:-]{8,160}$/u;
const nonEmpty = (value: unknown, maximum = 256): value is string => typeof value === 'string'
  && value === value.trim() && value.length > 0 && value.length <= maximum;
const validDate = (value: unknown): value is IsoDateTime => typeof value === 'string' && Number.isFinite(Date.parse(value));
const validRevision = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) < 2_147_483_647;

const applicationError = (
  context: IdentityAccessApplicationContext,
  code: typeof ERROR_CODES.CORE_INVALID_ARGUMENT | typeof ERROR_CODES.AUTHORIZATION_DENIED
    | typeof ERROR_CODES.RESOURCE_CONFLICT | typeof ERROR_CODES.RESOURCE_NOT_FOUND | typeof ERROR_CODES.CORE_UNEXPECTED,
  category: 'validation' | 'authorization' | 'conflict' | 'not_found' | 'unexpected',
  message: string
): AppError => createAppError({ code, category, message, correlationId: context.correlationId });
const invalid = (context: IdentityAccessApplicationContext, message: string) =>
  applicationError(context, ERROR_CODES.CORE_INVALID_ARGUMENT, 'validation', message);
const denied = (context: IdentityAccessApplicationContext, message: string) =>
  applicationError(context, ERROR_CODES.AUTHORIZATION_DENIED, 'authorization', message);
const conflict = (context: IdentityAccessApplicationContext, message: string) =>
  applicationError(context, ERROR_CODES.RESOURCE_CONFLICT, 'conflict', message);
const missing = (context: IdentityAccessApplicationContext, message: string) =>
  applicationError(context, ERROR_CODES.RESOURCE_NOT_FOUND, 'not_found', message);
const unexpected = (context: IdentityAccessApplicationContext, message: string) =>
  applicationError(context, ERROR_CODES.CORE_UNEXPECTED, 'unexpected', message);

const keyFor = (context: IdentityAccessApplicationContext): Result<IdentityAccessAggregateKey, AppError> =>
  context.actor.personId
    ? ok({ familyId: context.familyId, accountId: context.actor.userId, ownerPersonId: context.actor.personId })
    : err(denied(context, 'Kimlik ve erişim merkezi için kişi bağlı hesap gerekir.'));

const intent = (
  key: IdentityAccessAggregateKey,
  action: IdentityAccessPolicyIntent['action'],
  resourceType: IdentityAccessResourceType,
  resourceId: string
): IdentityAccessPolicyIntent => ({
  action,
  capability: action === 'read' ? 'family.read' : 'family.write',
  resourceType,
  resourceId,
  purpose: 'administration',
  familyId: key.familyId,
  ownerPersonId: key.ownerPersonId,
  privacy: 'private',
  sensitivity: 'highly_sensitive'
});

const exactKey = (left: IdentityAccessAggregateKey, right: IdentityAccessAggregateKey): boolean =>
  left.familyId === right.familyId && left.accountId === right.accountId && left.ownerPersonId === right.ownerPersonId;

const currentDevice = (
  scope: IdentityAccessCredentialWriteScope,
  context: IdentityAccessApplicationContext,
  key: IdentityAccessAggregateKey
): Result<IdentityTrustedDeviceState, AppError> => {
  const found = scope.findTrustedDevice(key, context.currentDevice.trustedDeviceId);
  if (!found.ok) return found;
  const device = found.value;
  if (!device || device.revokedAt || device.accountId !== key.accountId
    || device.deviceId !== context.currentDevice.deviceId
    || device.securityEpoch !== context.currentDevice.securityEpoch) {
    return err(denied(context, 'Yerel güvenilir cihaz veya security epoch doğrulanamadı.'));
  }
  return ok(device);
};

const identifiersValid = (value: IdentityAccessOperationIdentifiers): boolean =>
  IDENTIFIER.test(value.mutationId) && IDENTIFIER.test(value.resourceId) && IDENTIFIER.test(value.auditId)
  && nonEmpty(String(value.outboxEventId), 160) && SHA256.test(value.requestFingerprint);

const challengeIdentifiersValid = (value: IdentityChallengeIdentifiers): boolean =>
  IDENTIFIER.test(value.challengeId) && IDENTIFIER.test(value.auditId) && nonEmpty(String(value.outboxEventId), 160);

const mutationReceipt = (row: IdentityAccessMutationRow, replayed: boolean): IdentityAccessMutationReceiptView => ({
  clientOperationId: row.clientOperationId,
  mutationKind: row.mutationKind,
  resourceType: row.resourceType,
  resourceId: row.resourceId,
  previousRevision: row.previousRevision,
  revision: row.revision,
  stateFingerprint: row.stateFingerprint,
  occurredAt: row.createdAt,
  replayed
});

interface MutationState { readonly revision: number; readonly stateFingerprint: string }
interface PreparedMutation extends MutationState {
  readonly previousRevision: number;
  persist(): Result<void, AppError>;
}

const executeMutation = (
  unitOfWork: IdentityAccessCredentialUnitOfWork,
  input: {
    readonly context: IdentityAccessApplicationContext;
    readonly clientOperationId: string;
    readonly expectedRevision: number;
    readonly identifiers: IdentityAccessOperationIdentifiers;
  },
  specification: {
    readonly mutationKind: IdentityAccessMutationKind;
    readonly resourceType: 'passkey_credential' | 'federated_identity_link' | 'temporary_verifiable_credential';
    readonly action: 'create' | 'update' | 'delete';
    readonly auditAction: string;
    readonly eventType: `${string}.${string}`;
    loadCurrent(scope: IdentityAccessCredentialWriteScope, key: IdentityAccessAggregateKey): Result<MutationState | null, AppError>;
    prepare(scope: IdentityAccessCredentialWriteScope, key: IdentityAccessAggregateKey): Result<PreparedMutation, AppError>;
  }
): Promise<Result<IdentityAccessMutationReceiptView, AppError>> => {
  const key = keyFor(input.context);
  if (!key.ok) return Promise.resolve(key);
  if (!IDENTIFIER.test(input.clientOperationId) || !validRevision(input.expectedRevision) || !identifiersValid(input.identifiers)) {
    return Promise.resolve(err(invalid(input.context, 'İşlem kimliği, revizyon veya request fingerprint geçersiz.')));
  }
  return unitOfWork.execute(input.context, intent(key.value, specification.action, specification.resourceType, input.identifiers.resourceId), (scope) => {
    const replay = scope.findMutationByClientOperationId(key.value, input.clientOperationId);
    if (!replay.ok) return replay;
    if (replay.value) {
      if (replay.value.requestFingerprint !== input.identifiers.requestFingerprint
        || replay.value.resourceId !== input.identifiers.resourceId
        || replay.value.resourceType !== specification.resourceType
        || replay.value.mutationKind !== specification.mutationKind
        || replay.value.previousRevision !== input.expectedRevision
        || replay.value.familyId !== key.value.familyId || replay.value.accountId !== key.value.accountId
        || replay.value.ownerPersonId !== key.value.ownerPersonId) {
        return err(conflict(input.context, 'İstemci işlem kimliği farklı istek veya kimlik kapsamıyla tekrar kullanıldı.'));
      }
      const current = specification.loadCurrent(scope, key.value);
      if (!current.ok) return current;
      if (!current.value || current.value.revision !== replay.value.revision
        || current.value.stateFingerprint !== replay.value.stateFingerprint) {
        return err(conflict(input.context, 'İdempotent sonuç artık exact current state değil.'));
      }
      return ok(mutationReceipt(replay.value, true));
    }

    const prepared = specification.prepare(scope, key.value);
    if (!prepared.ok) return prepared;
    if (prepared.value.previousRevision !== input.expectedRevision) {
      return err(conflict(input.context, 'Kimlik kaynağının revizyonu güncel değil.'));
    }
    const mutation: IdentityAccessMutationRow = {
      id: input.identifiers.mutationId,
      clientOperationId: input.clientOperationId,
      requestFingerprint: input.identifiers.requestFingerprint,
      familyId: key.value.familyId,
      accountId: key.value.accountId,
      ownerPersonId: key.value.ownerPersonId,
      mutationKind: specification.mutationKind,
      resourceType: specification.resourceType,
      resourceId: input.identifiers.resourceId,
      previousRevision: prepared.value.previousRevision,
      revision: prepared.value.revision,
      stateFingerprint: prepared.value.stateFingerprint,
      createdAt: scope.occurredAt
    };
    const inserted = scope.insertMutation(mutation);
    if (!inserted.ok) return inserted;
    const persisted = prepared.value.persist();
    if (!persisted.ok) return persisted;
    const audited = scope.appendAudit({
      id: input.identifiers.auditId,
      action: specification.auditAction,
      resourceType: specification.resourceType,
      resourceId: input.identifiers.resourceId,
      occurredAt: scope.occurredAt,
      actorId: input.context.actor.userId
    });
    if (!audited.ok) return audited;
    const event: DomainEvent<{ readonly revision: number; readonly stateFingerprint: string }> = {
      eventId: input.identifiers.outboxEventId,
      eventType: specification.eventType,
      eventVersion: 1,
      aggregateType: specification.resourceType,
      aggregateId: input.identifiers.resourceId,
      occurredAt: scope.occurredAt,
      actorId: input.context.actor.userId,
      correlationId: input.context.correlationId,
      payload: { revision: mutation.revision, stateFingerprint: mutation.stateFingerprint }
    };
    const queued = scope.enqueueEvent(event);
    return queued.ok ? ok(mutationReceipt(mutation, false)) : queued;
  });
};

const passkeyView = (row: PasskeyCredentialRow): PasskeyCredentialView => {
  const { familyId: _family, accountId: _account, ownerPersonId: _owner, credentialId: _credential,
    publicKeyCoseBase64Url: _publicKey, userHandleSha256: _userHandle, lastMutationId: _mutation,
    stateFingerprint: _fingerprint, ...view } = row;
  return view;
};

const federatedView = (row: FederatedIdentityLinkRow): FederatedIdentityLinkView => {
  const { familyId: _family, accountId: _account, ownerPersonId: _owner, encryptedVaultEntryId: _vault,
    lastMutationId: _mutation, stateFingerprint: _fingerprint, ...view } = row;
  return view;
};

const temporaryView = (row: TemporaryVerifiableCredentialRow): TemporaryVerifiableCredentialView => {
  const { familyId: _family, accountId: _account, ownerPersonId: _owner, encryptedEnvelopeReference: _envelope,
    lastMutationId: _mutation, stateFingerprint: _fingerprint, ...view } = row;
  return view;
};

const companionView = (row: CompanionSyncSnapshotRow) => {
  const { familyId: _family, accountId: _account, ownerPersonId: _owner, ...view } = row;
  return view;
};

const rowKeyExact = (row: { readonly key: IdentityAccessAggregateKey; readonly familyId: FamilyId; readonly accountId: UserId; readonly ownerPersonId: PersonId }, key: IdentityAccessAggregateKey): boolean =>
  exactKey(row.key, key) && row.familyId === key.familyId && row.accountId === key.accountId && row.ownerPersonId === key.ownerPersonId;

export class GetIdentityAccessCredentialCenterUseCase {
  public constructor(private readonly unitOfWork: IdentityAccessCredentialUnitOfWork) {}
  public execute(context: IdentityAccessApplicationContext): Promise<Result<IdentityAccessCredentialCenterView, AppError>> {
    const key = keyFor(context);
    if (!key.ok) return Promise.resolve(key);
    return this.unitOfWork.execute(context, intent(key.value, 'read', 'identity_access_center', key.value.accountId), (scope) => {
      const snapshot = scope.loadCenter(key.value);
      if (!snapshot.ok) return snapshot;
      const configured = new Set(snapshot.value.configuredProviders);
      const valid = exactKey(snapshot.value.key, key.value)
        && snapshot.value.passkeys.length <= IDENTITY_ACCESS_MAX_PASSKEYS
        && snapshot.value.federatedLinks.length <= IDENTITY_ACCESS_MAX_FEDERATED_LINKS
        && snapshot.value.temporaryCredentials.length <= IDENTITY_ACCESS_MAX_TEMPORARY_CREDENTIALS
        && snapshot.value.companionSnapshots.length <= IDENTITY_ACCESS_MAX_COMPANION_SNAPSHOTS
        && configured.size === snapshot.value.configuredProviders.length
        && snapshot.value.passkeys.every((row) => rowKeyExact(row, key.value))
        && snapshot.value.federatedLinks.every((row) => rowKeyExact(row, key.value) && configured.has(row.provider))
        && snapshot.value.temporaryCredentials.every((row) => rowKeyExact(row, key.value))
        && snapshot.value.companionSnapshots.every((row) => rowKeyExact(row, key.value));
      if (!valid) return err(conflict(context, 'Kimlik merkezi snapshot kapsamı, provider görünürlüğü veya sınırı geçersiz.'));
      return ok({
        schemaVersion: 1,
        key: key.value,
        passkeys: snapshot.value.passkeys.map(passkeyView),
        federatedLinks: snapshot.value.federatedLinks.map(federatedView),
        temporaryCredentials: snapshot.value.temporaryCredentials.map(temporaryView),
        companionSnapshots: snapshot.value.companionSnapshots.map(companionView),
        truth: {
          passkeyPrivateKeyStored: false,
          biometricDataStored: false,
          passkeyVerificationScope: 'local_verified_ceremony_metadata_only',
          unconfiguredFederatedProvidersVisible: false,
          federatedProviderAvailabilityGuaranteed: false,
          federatedProviderDeliveryGuaranteed: false,
          tokenBytesExposed: false,
          companionSourceAuthority: 'windows_single_writer',
          companionRemoteWritesAccepted: false,
          companionNetworkDeliveryGuaranteed: false,
          credentialQrBounded: true,
          credentialMinimumDisclosureEnforced: true,
          offlineSignatureAndExpiryVerifiable: true,
          remoteRevocationFreshnessGuaranteed: false
        },
        generatedAt: snapshot.value.generatedAt
      });
    });
  }
}

abstract class BeginPasskeyChallengeUseCase {
  protected constructor(
    private readonly unitOfWork: IdentityAccessCredentialUnitOfWork,
    private readonly challengeGenerator: IdentityChallengeGeneratorPort,
    private readonly purpose: IdentityChallengeRow['purpose']
  ) {}

  protected begin(input: {
    readonly context: IdentityAccessApplicationContext;
    readonly relyingPartyId: string;
    readonly identifiers: IdentityChallengeIdentifiers;
  }): Promise<Result<PasskeyChallengeView, AppError>> {
    const key = keyFor(input.context);
    if (!key.ok) return Promise.resolve(key);
    if (!challengeIdentifiersValid(input.identifiers) || !nonEmpty(input.relyingPartyId, 253)) {
      return Promise.resolve(err(invalid(input.context, 'Passkey challenge kimliği veya relying party geçersiz.')));
    }
    let challenge: string;
    try { challenge = this.challengeGenerator.createChallenge(); }
    catch { return Promise.resolve(err(unexpected(input.context, 'Passkey challenge üretilemedi.'))); }
    if (challenge.length < 43 || challenge.length > 512 || !BASE64URL.test(challenge)) {
      return Promise.resolve(err(invalid(input.context, 'Passkey challenge en az 256 bit base64url olmalıdır.')));
    }
    return this.unitOfWork.execute(input.context, intent(key.value, 'create', 'identity_challenge', input.identifiers.challengeId), (scope) => {
      const device = currentDevice(scope, input.context, key.value);
      if (!device.ok) return device;
      const passkeys = scope.listPasskeys(key.value);
      if (!passkeys.ok) return passkeys;
      const active = passkeys.value.filter(({ status, securityEpoch }) => status === 'active' && securityEpoch === device.value.securityEpoch);
      if (this.purpose === 'passkey_registration' && active.length >= IDENTITY_ACCESS_MAX_PASSKEYS) {
        return err(conflict(input.context, 'Hesap için passkey üst sınırına ulaşıldı.'));
      }
      if (this.purpose === 'passkey_authentication' && active.length === 0) {
        return err(missing(input.context, 'Aktif passkey bulunamadı.'));
      }
      const expiresAt = new Date(Date.parse(scope.occurredAt) + IDENTITY_ACCESS_CHALLENGE_TTL_SECONDS * 1_000).toISOString() as IsoDateTime;
      const row: IdentityChallengeRow = {
        id: input.identifiers.challengeId,
        key: key.value,
        purpose: this.purpose,
        challengeSha256: sha256(challenge),
        relyingPartyId: input.relyingPartyId,
        trustedDeviceId: device.value.trustedDeviceId,
        deviceId: device.value.deviceId,
        securityEpoch: device.value.securityEpoch,
        createdAt: scope.occurredAt,
        expiresAt
      };
      const inserted = scope.insertChallenge(row);
      if (!inserted.ok) return inserted;
      const audited = scope.appendAudit({
        id: input.identifiers.auditId,
        action: `${this.purpose}.challenge_created`,
        resourceType: 'identity_challenge',
        resourceId: row.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audited.ok) return audited;
      const event: DomainEvent<{ readonly purpose: IdentityChallengeRow['purpose']; readonly challengeSha256: string }> = {
        eventId: input.identifiers.outboxEventId,
        eventType: 'identity.challenge_created',
        eventVersion: 1,
        aggregateType: 'identity_challenge',
        aggregateId: row.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: { purpose: row.purpose, challengeSha256: row.challengeSha256 }
      };
      const queued = scope.enqueueEvent(event);
      if (!queued.ok) return queued;
      return ok({
        challengeId: row.id,
        challenge,
        purpose: row.purpose,
        relyingPartyId: row.relyingPartyId,
        expiresAt,
        userVerification: 'required',
        residentKey: 'preferred',
        privateKeyLeavesAuthenticator: false,
        biometricDataRequestedByApplication: false,
        allowedCredentialIds: this.purpose === 'passkey_authentication' ? active.map(({ credentialId }) => credentialId) : []
      });
    });
  }
}

export class BeginPasskeyRegistrationUseCase extends BeginPasskeyChallengeUseCase {
  public constructor(unitOfWork: IdentityAccessCredentialUnitOfWork, challengeGenerator: IdentityChallengeGeneratorPort) {
    super(unitOfWork, challengeGenerator, 'passkey_registration');
  }
  public execute(input: { readonly context: IdentityAccessApplicationContext; readonly relyingPartyId: string; readonly identifiers: IdentityChallengeIdentifiers }) {
    return this.begin(input);
  }
}

export class BeginPasskeyAuthenticationUseCase extends BeginPasskeyChallengeUseCase {
  public constructor(unitOfWork: IdentityAccessCredentialUnitOfWork, challengeGenerator: IdentityChallengeGeneratorPort) {
    super(unitOfWork, challengeGenerator, 'passkey_authentication');
  }
  public execute(input: { readonly context: IdentityAccessApplicationContext; readonly relyingPartyId: string; readonly identifiers: IdentityChallengeIdentifiers }) {
    return this.begin(input);
  }
}

const activeChallenge = (
  scope: IdentityAccessCredentialWriteScope,
  context: IdentityAccessApplicationContext,
  key: IdentityAccessAggregateKey,
  challengeId: string,
  purpose: IdentityChallengeRow['purpose']
): Result<IdentityChallengeRow, AppError> => {
  const challenge = scope.findChallenge(key, challengeId);
  if (!challenge.ok) return challenge;
  const row = challenge.value;
  if (!row || row.purpose !== purpose || !exactKey(row.key, key)) return err(missing(context, 'Passkey challenge bulunamadı.'));
  if (row.consumedAt || Date.parse(row.expiresAt) <= Date.parse(scope.occurredAt)) {
    return err(conflict(context, 'Passkey challenge tüketilmiş veya süresi dolmuş.'));
  }
  if (row.trustedDeviceId !== context.currentDevice.trustedDeviceId || row.deviceId !== context.currentDevice.deviceId
    || row.securityEpoch !== context.currentDevice.securityEpoch) {
    return err(denied(context, 'Passkey challenge farklı cihaz veya security epoch ile bağlı.'));
  }
  return ok(row);
};

const registrationValid = (value: VerifiedPasskeyRegistration, challenge: IdentityChallengeRow): boolean =>
  value.challengeSha256 === challenge.challengeSha256 && value.relyingPartyId === challenge.relyingPartyId
  && value.credentialId.length >= 16 && value.credentialId.length <= 1_024 && BASE64URL.test(value.credentialId)
  && value.publicKeyCoseBase64Url.length >= 32 && value.publicKeyCoseBase64Url.length <= 8_192 && BASE64URL.test(value.publicKeyCoseBase64Url)
  && SHA256.test(value.userHandleSha256) && Number.isSafeInteger(value.signCount) && value.signCount >= 0
  && (value.aaguid === undefined || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value.aaguid))
  && value.transports.length <= 5 && new Set(value.transports).size === value.transports.length
  && value.transports.every((transport) => ['internal', 'usb', 'nfc', 'ble', 'hybrid'].includes(transport))
  && value.attestationVerified === true && value.userPresent === true && value.userVerified === true
  && typeof value.backupEligible === 'boolean' && typeof value.backupState === 'boolean'
  && (!value.backupState || value.backupEligible);

export class CompletePasskeyRegistrationUseCase {
  public constructor(
    private readonly unitOfWork: IdentityAccessCredentialUnitOfWork,
    private readonly verifier: PasskeyCeremonyVerifierPort
  ) {}

  public execute(input: {
    readonly context: IdentityAccessApplicationContext;
    readonly command: CompletePasskeyRegistrationInput;
    readonly identifiers: IdentityAccessOperationIdentifiers;
  }): Promise<Result<IdentityAccessMutationReceiptView, AppError>> {
    if (input.command.expectedRevision !== 0 || !nonEmpty(input.command.challengeId, 160)
      || !nonEmpty(input.command.ceremonyResponseId, 256) || !nonEmpty(input.command.displayName, 120)) {
      return Promise.resolve(err(invalid(input.context, 'Passkey kayıt girdisi geçersiz.')));
    }
    return executeMutation(this.unitOfWork, {
      context: input.context,
      clientOperationId: input.command.clientOperationId,
      expectedRevision: input.command.expectedRevision,
      identifiers: input.identifiers
    }, {
      mutationKind: 'passkey_register', resourceType: 'passkey_credential', action: 'create',
      auditAction: 'passkey.registered', eventType: 'identity.passkey_registered',
      loadCurrent: (scope, key) => {
        const row = scope.findPasskey(key, input.identifiers.resourceId);
        return row.ok ? ok(row.value ? { revision: row.value.revision, stateFingerprint: row.value.stateFingerprint } : null) : row;
      },
      prepare: (scope, key) => {
        const device = currentDevice(scope, input.context, key);
        if (!device.ok) return device;
        const challenge = activeChallenge(scope, input.context, key, input.command.challengeId, 'passkey_registration');
        if (!challenge.ok) return challenge;
        const verification = this.verifier.verifyRegistration({
          ceremonyResponseId: input.command.ceremonyResponseId,
          expectedChallengeSha256: challenge.value.challengeSha256,
          relyingPartyId: challenge.value.relyingPartyId,
          accountId: key.accountId,
          deviceId: device.value.deviceId
        });
        if (!verification.ok) return verification;
        if (!registrationValid(verification.value, challenge.value)) return err(denied(input.context, 'WebAuthn kayıt töreni doğrulanamadı.'));
        const existing = scope.findPasskeyByCredentialIdSha256(key, sha256(verification.value.credentialId));
        if (!existing.ok) return existing;
        if (existing.value) return err(conflict(input.context, 'Passkey credential daha önce kaydedilmiş.'));
        const passkeys = scope.listPasskeys(key);
        if (!passkeys.ok) return passkeys;
        if (passkeys.value.filter(({ status }) => status === 'active').length >= IDENTITY_ACCESS_MAX_PASSKEYS) {
          return err(conflict(input.context, 'Hesap için passkey üst sınırına ulaşıldı.'));
        }
        const provisional: PasskeyCredentialRow = {
          id: input.identifiers.resourceId,
          key,
          familyId: key.familyId,
          accountId: key.accountId,
          ownerPersonId: key.ownerPersonId,
          revision: 1,
          displayName: input.command.displayName,
          credentialId: verification.value.credentialId,
          credentialIdSha256: sha256(verification.value.credentialId),
          publicKeyCoseBase64Url: verification.value.publicKeyCoseBase64Url,
          publicKeySha256: sha256(verification.value.publicKeyCoseBase64Url),
          userHandleSha256: verification.value.userHandleSha256,
          relyingPartyId: verification.value.relyingPartyId,
          ...(verification.value.aaguid ? { aaguid: verification.value.aaguid } : {}),
          transports: Object.freeze([...verification.value.transports]),
          signCount: verification.value.signCount,
          backupEligible: verification.value.backupEligible,
          backupState: verification.value.backupState,
          trustedDeviceId: device.value.trustedDeviceId,
          securityEpoch: device.value.securityEpoch,
          status: 'active',
          createdAt: scope.occurredAt,
          privateKeyStored: false,
          biometricDataStored: false,
          attestationPayloadStored: false,
          lastMutationId: input.identifiers.mutationId,
          stateFingerprint: ''
        };
        const stateFingerprint = sha256(canonicalPasskeyStateJson(provisional));
        const row = { ...provisional, stateFingerprint };
        return ok({
          previousRevision: 0,
          revision: 1,
          stateFingerprint,
          persist: () => {
            const inserted = scope.insertPasskey(row);
            if (!inserted.ok) return inserted;
            const consumed = scope.consumeChallenge(key, challenge.value.id, scope.occurredAt, input.identifiers.mutationId);
            return consumed.ok && consumed.value ? ok(undefined) : consumed.ok
              ? err(conflict(input.context, 'Passkey challenge atomik tüketilemedi.')) : consumed;
          }
        });
      }
    });
  }
}

export class AuthenticateWithPasskeyUseCase {
  public constructor(
    private readonly unitOfWork: IdentityAccessCredentialUnitOfWork,
    private readonly verifier: PasskeyCeremonyVerifierPort,
    private readonly session: PasskeySessionPort
  ) {}

  public async execute(input: {
    readonly context: IdentityAccessApplicationContext;
    readonly command: AuthenticateWithPasskeyInput;
    readonly identifiers: IdentityAccessOperationIdentifiers;
  }): Promise<Result<IdentityAccessMutationReceiptView, AppError>> {
    const result = await executeMutation(this.unitOfWork, {
      context: input.context,
      clientOperationId: input.command.clientOperationId,
      expectedRevision: input.command.expectedRevision,
      identifiers: input.identifiers
    }, {
      mutationKind: 'passkey_authenticate', resourceType: 'passkey_credential', action: 'update',
      auditAction: 'passkey.authenticated', eventType: 'identity.passkey_authenticated',
      loadCurrent: (scope, key) => {
        const row = scope.findPasskey(key, input.identifiers.resourceId);
        return row.ok ? ok(row.value ? { revision: row.value.revision, stateFingerprint: row.value.stateFingerprint } : null) : row;
      },
      prepare: (scope, key) => {
        const device = currentDevice(scope, input.context, key);
        if (!device.ok) return device;
        const challenge = activeChallenge(scope, input.context, key, input.command.challengeId, 'passkey_authentication');
        if (!challenge.ok) return challenge;
        const found = scope.findPasskey(key, input.identifiers.resourceId);
        if (!found.ok) return found;
        const current = found.value;
        if (!current || current.status !== 'active') return err(missing(input.context, 'Aktif passkey bulunamadı.'));
        if (current.securityEpoch !== device.value.securityEpoch) return err(denied(input.context, 'Passkey security epoch güncel değil.'));
        const verification = this.verifier.verifyAuthentication({
          ceremonyResponseId: input.command.ceremonyResponseId,
          expectedChallengeSha256: challenge.value.challengeSha256,
          relyingPartyId: challenge.value.relyingPartyId,
          credentialId: current.credentialId,
          publicKeyCoseBase64Url: current.publicKeyCoseBase64Url,
          expectedUserHandleSha256: current.userHandleSha256,
          previousSignCount: current.signCount,
          accountId: key.accountId
        });
        if (!verification.ok) return verification;
        if (verification.value.challengeSha256 !== challenge.value.challengeSha256
          || verification.value.credentialIdSha256 !== current.credentialIdSha256
          || verification.value.signatureVerified !== true || verification.value.userPresent !== true
          || verification.value.userVerified !== true
          || !Number.isSafeInteger(verification.value.signCount) || verification.value.signCount < 0
          || (verification.value.signCount > 0 && current.signCount > 0 && verification.value.signCount <= current.signCount)) {
          return err(denied(input.context, 'WebAuthn assertion veya imza sayacı doğrulanamadı.'));
        }
        const provisional: PasskeyCredentialRow = {
          ...current,
          revision: current.revision + 1,
          signCount: Math.max(current.signCount, verification.value.signCount),
          lastUsedAt: scope.occurredAt,
          lastMutationId: input.identifiers.mutationId,
          stateFingerprint: ''
        };
        const stateFingerprint = sha256(canonicalPasskeyStateJson(provisional));
        const row = { ...provisional, stateFingerprint };
        return ok({
          previousRevision: current.revision,
          revision: row.revision,
          stateFingerprint,
          persist: () => {
            const saved = scope.savePasskey(row, current.revision);
            if (!saved.ok) return saved;
            if (!saved.value) return err(conflict(input.context, 'Passkey assertion revizyon çatışması.'));
            const consumed = scope.consumeChallenge(key, challenge.value.id, scope.occurredAt, input.identifiers.mutationId);
            return consumed.ok && consumed.value ? ok(undefined) : consumed.ok
              ? err(conflict(input.context, 'Passkey challenge atomik tüketilemedi.')) : consumed;
          }
        });
      }
    });
    if (result.ok) {
      try { this.session.start(input.context.actor.userId, input.context.currentDevice.securityEpoch); }
      catch { return err(unexpected(input.context, 'Passkey doğrulandı ancak yerel oturum başlatılamadı.')); }
    }
    return result;
  }
}

const revokedPasskey = (
  current: PasskeyCredentialRow,
  scope: IdentityAccessCredentialWriteScope,
  mutationId: string,
  reason: PasskeyCredentialView['revocationReason']
): PasskeyCredentialRow => {
  const provisional: PasskeyCredentialRow = {
    ...current,
    revision: current.revision + 1,
    status: 'revoked',
    revokedAt: scope.occurredAt,
    ...(reason ? { revocationReason: reason } : {}),
    lastMutationId: mutationId,
    stateFingerprint: ''
  };
  return { ...provisional, stateFingerprint: sha256(canonicalPasskeyStateJson(provisional)) };
};

export class RevokePasskeyUseCase {
  public constructor(private readonly unitOfWork: IdentityAccessCredentialUnitOfWork) {}
  public execute(input: { readonly context: IdentityAccessApplicationContext; readonly command: RevokePasskeyInput; readonly identifiers: IdentityAccessOperationIdentifiers }) {
    if (input.command.credentialId !== input.identifiers.resourceId) return Promise.resolve(err(invalid(input.context, 'Passkey resource kimliği uyuşmuyor.')));
    return executeMutation(this.unitOfWork, { context: input.context, clientOperationId: input.command.clientOperationId,
      expectedRevision: input.command.expectedRevision, identifiers: input.identifiers }, {
      mutationKind: 'passkey_revoke', resourceType: 'passkey_credential', action: 'delete',
      auditAction: 'passkey.revoked', eventType: 'identity.passkey_revoked',
      loadCurrent: (scope, key) => {
        const row = scope.findPasskey(key, input.command.credentialId);
        return row.ok ? ok(row.value ? { revision: row.value.revision, stateFingerprint: row.value.stateFingerprint } : null) : row;
      },
      prepare: (scope, key) => {
        const device = currentDevice(scope, input.context, key);
        if (!device.ok) return device;
        const found = scope.findPasskey(key, input.command.credentialId);
        if (!found.ok) return found;
        if (!found.value || found.value.status !== 'active') return err(missing(input.context, 'Aktif passkey bulunamadı.'));
        const row = revokedPasskey(found.value, scope, input.identifiers.mutationId, input.command.reason);
        return ok({ previousRevision: found.value.revision, revision: row.revision, stateFingerprint: row.stateFingerprint,
          persist: () => {
            const saved = scope.savePasskey(row, found.value!.revision);
            return saved.ok && saved.value ? ok(undefined) : saved.ok ? err(conflict(input.context, 'Passkey iptal revizyon çatışması.')) : saved;
          } });
      }
    });
  }
}

export class RecoverLostPasskeyUseCase {
  public constructor(
    private readonly unitOfWork: IdentityAccessCredentialUnitOfWork,
    private readonly recoveryVerifier: StrongPasskeyRecoveryVerifierPort
  ) {}
  public execute(input: { readonly context: IdentityAccessApplicationContext; readonly command: RecoverLostPasskeyInput; readonly identifiers: IdentityAccessOperationIdentifiers }) {
    if (input.command.credentialId !== input.identifiers.resourceId || !nonEmpty(input.command.recoveryProofId, 256)) {
      return Promise.resolve(err(invalid(input.context, 'Kayıp passkey kurtarma girdisi geçersiz.')));
    }
    return executeMutation(this.unitOfWork, { context: input.context, clientOperationId: input.command.clientOperationId,
      expectedRevision: input.command.expectedRevision, identifiers: input.identifiers }, {
      mutationKind: 'passkey_recover_lost', resourceType: 'passkey_credential', action: 'delete',
      auditAction: 'passkey.lost_recovery_completed', eventType: 'identity.passkey_lost_recovered',
      loadCurrent: (scope, key) => {
        const row = scope.findPasskey(key, input.command.credentialId);
        return row.ok ? ok(row.value ? { revision: row.value.revision, stateFingerprint: row.value.stateFingerprint } : null) : row;
      },
      prepare: (scope, key) => {
        const proof = this.recoveryVerifier.verify({ accountId: key.accountId, recoveryProofId: input.command.recoveryProofId,
          correlationId: input.context.correlationId });
        if (!proof.ok) return proof;
        const found = scope.findPasskey(key, input.command.credentialId);
        if (!found.ok) return found;
        if (!found.value || found.value.status !== 'active') return err(missing(input.context, 'Kayıp aktif passkey bulunamadı.'));
        const row = revokedPasskey(found.value, scope, input.identifiers.mutationId, 'recovery');
        return ok({ previousRevision: found.value.revision, revision: row.revision, stateFingerprint: row.stateFingerprint,
          persist: () => {
            const saved = scope.savePasskey(row, found.value!.revision);
            if (!saved.ok) return saved;
            if (!saved.value) return err(conflict(input.context, 'Kayıp passkey kurtarma revizyon çatışması.'));
            const rotated = scope.advanceSecurityEpochAndRevokeLocalSessions(key.accountId);
            return rotated.ok && rotated.value.securityEpoch > found.value!.securityEpoch ? ok(undefined)
              : rotated.ok ? err(conflict(input.context, 'Security epoch ilerletilemedi.')) : rotated;
          } });
      }
    });
  }
}

const scopesValid = (scopes: readonly string[]): boolean => scopes.length > 0 && scopes.length <= 16
  && new Set(scopes).size === scopes.length && scopes.every((scope) => nonEmpty(scope, 160));

export class BeginFederatedIdentityLinkUseCase {
  public constructor(
    private readonly unitOfWork: IdentityAccessCredentialUnitOfWork,
    private readonly ceremonyPort: FederatedAuthorizationCeremonyPort
  ) {}
  public async execute(input: {
    readonly context: IdentityAccessApplicationContext;
    readonly provider: FederatedIdentityProvider;
    readonly identifiers: FederatedCeremonyIdentifiers;
  }): Promise<Result<FederatedAuthorizationCeremonyView, AppError>> {
    const key = keyFor(input.context);
    if (!key.ok) return key;
    if (!IDENTIFIER.test(input.identifiers.flowId) || !IDENTIFIER.test(input.identifiers.auditId)
      || !nonEmpty(String(input.identifiers.outboxEventId), 160)) {
      return err(invalid(input.context, 'Federated authorization ceremony kimlikleri geçersiz.'));
    }
    let created = false;
    const result = await this.unitOfWork.execute(
      input.context,
      intent(key.value, 'create', 'federated_identity_link', input.identifiers.flowId),
      (scope): Result<FederatedAuthorizationCeremonyView, AppError> => {
        const device = currentDevice(scope, input.context, key.value);
        if (!device.ok) return device;
        const configurations = scope.listConfiguredFederatedProviders();
        if (!configurations.ok) return configurations;
        const configuration = configurations.value.find(({ provider, configured }) => provider === input.provider && configured);
        if (!configuration) return err(missing(input.context, 'Yapılandırılmamış federated sağlayıcı görünür değildir.'));
        const ceremony = this.ceremonyPort.createAndStore({
          flowId: input.identifiers.flowId,
          provider: input.provider,
          configurationId: configuration.configurationId,
          accountId: key.value.accountId,
          createdAt: scope.occurredAt,
          correlationId: input.context.correlationId
        });
        if (!ceremony.ok) return ceremony;
        created = true;
        let parsed: URL;
        try { parsed = new URL(ceremony.value.authorizationUrl); }
        catch { return err(denied(input.context, 'Federated authorization URL doğrulanamadı.')); }
        if (ceremony.value.flowId !== input.identifiers.flowId || ceremony.value.provider !== input.provider
          || parsed.protocol !== 'https:' || ceremony.value.authorizationUrl.length > 2_048
          || !validDate(ceremony.value.expiresAt) || Date.parse(ceremony.value.expiresAt) <= Date.parse(scope.occurredAt)
          || Date.parse(ceremony.value.expiresAt) - Date.parse(scope.occurredAt) > 600_000
          || ceremony.value.responseType !== 'code' || ceremony.value.pkceMethod !== 'S256'
          || ceremony.value.stateBound !== true || ceremony.value.nonceBound !== true
          || ceremony.value.codeVerifierStoredInEncryptedVault !== true || ceremony.value.codeVerifierExposed !== false
          || ceremony.value.tokenBytesExposed !== false || ceremony.value.providerAvailabilityGuaranteed !== false
          || ceremony.value.providerDeliveryGuaranteed !== false) {
          return err(denied(input.context, 'Federated ceremony PKCE/state/nonce/vault truth sözleşmesi geçersiz.'));
        }
        const audited = scope.appendAudit({
          id: input.identifiers.auditId,
          action: 'federated_identity.ceremony_started',
          resourceType: 'federated_identity_link',
          resourceId: input.identifiers.flowId,
          occurredAt: scope.occurredAt,
          actorId: input.context.actor.userId
        });
        if (!audited.ok) return audited;
        const event: DomainEvent<{ readonly provider: FederatedIdentityProvider }> = {
          eventId: input.identifiers.outboxEventId,
          eventType: 'identity.federated_ceremony_started',
          eventVersion: 1,
          aggregateType: 'federated_identity_link',
          aggregateId: input.identifiers.flowId,
          occurredAt: scope.occurredAt,
          actorId: input.context.actor.userId,
          correlationId: input.context.correlationId,
          payload: { provider: input.provider }
        };
        const queued = scope.enqueueEvent(event);
        return queued.ok ? ceremony : queued;
      }
    );
    if (!result.ok && created) {
      try { this.ceremonyPort.discardCeremony(input.identifiers.flowId); } catch { /* best-effort cleanup is reported by the original failure */ }
    }
    return result;
  }
}

export class LinkFederatedIdentityUseCase {
  public constructor(
    private readonly unitOfWork: IdentityAccessCredentialUnitOfWork,
    private readonly verifier: FederatedAuthorizationCodeVerifierPort
  ) {}
  public async execute(input: { readonly context: IdentityAccessApplicationContext; readonly command: LinkFederatedIdentityInput; readonly identifiers: IdentityAccessOperationIdentifiers }) {
    if (input.command.expectedRevision < 0 || !nonEmpty(input.command.verifiedFlowId, 256)) {
      return err(invalid(input.context, 'Federated link girdisi geçersiz.'));
    }
    let vaultEntryToDiscard: string | undefined;
    const result = await executeMutation(this.unitOfWork, { context: input.context, clientOperationId: input.command.clientOperationId,
      expectedRevision: input.command.expectedRevision, identifiers: input.identifiers }, {
      mutationKind: 'federated_link', resourceType: 'federated_identity_link', action: 'create',
      auditAction: 'federated_identity.linked', eventType: 'identity.federated_linked',
      loadCurrent: (scope, key) => {
        const row = scope.findFederatedLink(key, input.identifiers.resourceId);
        return row.ok ? ok(row.value ? { revision: row.value.revision, stateFingerprint: row.value.stateFingerprint } : null) : row;
      },
      prepare: (scope, key) => {
        const device = currentDevice(scope, input.context, key);
        if (!device.ok) return device;
        const configurations = scope.listConfiguredFederatedProviders();
        if (!configurations.ok) return configurations;
        const configuration = configurations.value.find(({ provider, configured }) => provider === input.command.provider && configured);
        if (!configuration) {
          return err(missing(input.context, 'Yapılandırılmamış federated sağlayıcı görünür veya bağlanabilir değildir.'));
        }
        const existing = scope.findFederatedLinkByProvider(key, input.command.provider);
        if (!existing.ok) return existing;
        if (existing.value?.status === 'linked') return err(conflict(input.context, 'Sağlayıcı hesabı zaten bağlı.'));
        if ((existing.value?.revision ?? 0) !== input.command.expectedRevision) return err(conflict(input.context, 'Federated link revizyonu uyuşmuyor.'));
        const verified = this.verifier.consumeVerifiedFlow({ flowId: input.command.verifiedFlowId,
          expectedLinkId: input.identifiers.resourceId, provider: input.command.provider,
          accountId: key.accountId, correlationId: input.context.correlationId });
        if (!verified.ok) return verified;
        vaultEntryToDiscard = verified.value.encryptedVaultEntryId;
        if (verified.value.provider !== input.command.provider
          || verified.value.configurationId !== configuration.configurationId
          || verified.value.authorizationEndpointSha256 !== configuration.authorizationEndpointSha256
          || verified.value.clientConfigurationSha256 !== configuration.clientConfigurationSha256
          || !SHA256.test(verified.value.authorizationEndpointSha256) || !SHA256.test(verified.value.clientConfigurationSha256)
          || !nonEmpty(verified.value.configurationId, 128) || !SHA256.test(verified.value.providerSubjectSha256)
          || !nonEmpty(verified.value.encryptedVaultEntryId, 256) || !scopesValid(verified.value.grantedScopes)
          || verified.value.liveAccountTested !== true || verified.value.authorizationCodePkceVerified !== true
          || verified.value.stateVerified !== true || verified.value.nonceVerified !== true) {
          return err(denied(input.context, 'Authorization Code + PKCE + state + nonce doğrulaması geçersiz.'));
        }
        const provisional: FederatedIdentityLinkRow = {
          id: input.identifiers.resourceId, key, familyId: key.familyId, accountId: key.accountId, ownerPersonId: key.ownerPersonId,
          revision: existing.value ? existing.value.revision + 1 : 1, provider: verified.value.provider,
          configurationId: verified.value.configurationId, authorizationEndpointSha256: verified.value.authorizationEndpointSha256,
          clientConfigurationSha256: verified.value.clientConfigurationSha256, providerSubjectSha256: verified.value.providerSubjectSha256,
          grantedScopes: Object.freeze([...verified.value.grantedScopes].sort((left, right) => left.localeCompare(right, 'en'))),
          status: 'linked', liveAccountTested: true, authorizationCodePkceVerified: true, stateVerified: true, nonceVerified: true,
          tokenBytesExposed: false, tokenStoredInEncryptedVault: true, providerAvailabilityGuaranteed: false, providerDeliveryGuaranteed: false,
          linkedAt: scope.occurredAt, lastLocallyVerifiedAt: scope.occurredAt,
          encryptedVaultEntryId: verified.value.encryptedVaultEntryId, lastMutationId: input.identifiers.mutationId, stateFingerprint: ''
        };
        const stateFingerprint = sha256(canonicalFederatedIdentityLinkStateJson(provisional));
        const row = { ...provisional, stateFingerprint };
        return ok({ previousRevision: existing.value?.revision ?? 0, revision: row.revision, stateFingerprint,
          persist: () => {
            if (!existing.value) return scope.insertFederatedLink(row);
            const saved = scope.saveFederatedLink(row, existing.value.revision);
            return saved.ok && saved.value ? ok(undefined) : saved.ok
              ? err(conflict(input.context, 'Federated relink revizyon çatışması.')) : saved;
          } });
      }
    });
    if (!result.ok && vaultEntryToDiscard) {
      try { this.verifier.discardVaultEntry(vaultEntryToDiscard); } catch { /* original transaction failure remains authoritative */ }
    }
    return result;
  }
}

export class UnlinkFederatedIdentityUseCase {
  public constructor(private readonly unitOfWork: IdentityAccessCredentialUnitOfWork) {}
  public execute(input: { readonly context: IdentityAccessApplicationContext; readonly command: UnlinkFederatedIdentityInput; readonly identifiers: IdentityAccessOperationIdentifiers }) {
    if (input.command.linkId !== input.identifiers.resourceId) return Promise.resolve(err(invalid(input.context, 'Federated link kimliği uyuşmuyor.')));
    return executeMutation(this.unitOfWork, { context: input.context, clientOperationId: input.command.clientOperationId,
      expectedRevision: input.command.expectedRevision, identifiers: input.identifiers }, {
      mutationKind: 'federated_unlink', resourceType: 'federated_identity_link', action: 'delete',
      auditAction: 'federated_identity.unlinked', eventType: 'identity.federated_unlinked',
      loadCurrent: (scope, key) => {
        const row = scope.findFederatedLink(key, input.command.linkId);
        return row.ok ? ok(row.value ? { revision: row.value.revision, stateFingerprint: row.value.stateFingerprint } : null) : row;
      },
      prepare: (scope, key) => {
        const found = scope.findFederatedLink(key, input.command.linkId);
        if (!found.ok) return found;
        if (!found.value || found.value.status !== 'linked') return err(missing(input.context, 'Aktif federated link bulunamadı.'));
        const provisional: FederatedIdentityLinkRow = { ...found.value, revision: found.value.revision + 1, status: 'revoked',
          revokedAt: scope.occurredAt, lastLocallyVerifiedAt: scope.occurredAt, lastMutationId: input.identifiers.mutationId, stateFingerprint: '' };
        const stateFingerprint = sha256(canonicalFederatedIdentityLinkStateJson(provisional));
        const row = { ...provisional, stateFingerprint };
        return ok({ previousRevision: found.value.revision, revision: row.revision, stateFingerprint,
          persist: () => {
            const vault = scope.revokeFederatedVaultEntry(row.encryptedVaultEntryId);
            if (!vault.ok) return vault;
            const saved = scope.saveFederatedLink(row, found.value!.revision);
            return saved.ok && saved.value ? ok(undefined) : saved.ok ? err(conflict(input.context, 'Federated unlink revizyon çatışması.')) : saved;
          } });
      }
    });
  }
}

const disclosureValid = (input: IssueTemporaryVerifiableCredentialInput): boolean => {
  if (!Array.isArray(input.disclosedClaims) || input.disclosedClaims.length < 1
    || input.disclosedClaims.length > IDENTITY_ACCESS_MAX_DISCLOSED_CLAIMS
    || input.purpose !== TEMPORARY_CREDENTIAL_PURPOSE_BY_KIND[input.kind]
    || !nonEmpty(input.audienceReference, 160)) return false;
  const rules = TEMPORARY_CREDENTIAL_DISCLOSURE_RULES[input.kind];
  const keys = input.disclosedClaims.map(({ key }) => key);
  return new Set(keys).size === keys.length
    && rules.required.every((key) => keys.includes(key))
    && keys.every((key) => (rules.allowed as readonly TemporaryCredentialClaimKey[]).includes(key))
    && input.disclosedClaims.every(({ value }) => nonEmpty(value, 256));
};

export class IssueTemporaryVerifiableCredentialUseCase {
  public constructor(
    private readonly unitOfWork: IdentityAccessCredentialUnitOfWork,
    private readonly envelope: TemporaryCredentialEnvelopePort
  ) {}
  public async execute(input: { readonly context: IdentityAccessApplicationContext; readonly command: IssueTemporaryVerifiableCredentialInput; readonly identifiers: IdentityAccessOperationIdentifiers }): Promise<Result<{
    readonly receipt: IdentityAccessMutationReceiptView;
    readonly issued?: IssuedTemporaryVerifiableCredentialView;
  }, AppError>> {
    const starts = Date.parse(input.command.notBefore); const ends = Date.parse(input.command.expiresAt);
    if (input.command.expectedRevision !== 0 || !validDate(input.command.notBefore) || !validDate(input.command.expiresAt)
      || ends <= starts || ends - starts > IDENTITY_ACCESS_MAX_TEMPORARY_VALIDITY_SECONDS * 1_000 || !disclosureValid(input.command)) {
      return err(invalid(input.context, 'Geçici credential süre veya minimum disclosure girdisi geçersiz.'));
    }
    let stored: StoredTemporaryCredentialEnvelope | undefined;
    let issuedView: IssuedTemporaryVerifiableCredentialView | undefined;
    const result = await executeMutation(this.unitOfWork, { context: input.context, clientOperationId: input.command.clientOperationId,
      expectedRevision: input.command.expectedRevision, identifiers: input.identifiers }, {
      mutationKind: 'temporary_credential_issue', resourceType: 'temporary_verifiable_credential', action: 'create',
      auditAction: 'temporary_credential.issued', eventType: 'identity.temporary_credential_issued',
      loadCurrent: (scope, key) => {
        const row = scope.findTemporaryCredential(key, input.identifiers.resourceId);
        return row.ok ? ok(row.value ? { revision: row.value.revision, stateFingerprint: row.value.stateFingerprint } : null) : row;
      },
      prepare: (scope, key) => {
        const device = currentDevice(scope, input.context, key);
        if (!device.ok) return device;
        const count = scope.countTemporaryCredentials(key);
        if (!count.ok) return count;
        if (count.value >= IDENTITY_ACCESS_MAX_TEMPORARY_CREDENTIALS) return err(conflict(input.context, 'Geçici credential kotası dolu.'));
        if (Date.parse(input.command.notBefore) < Date.parse(scope.occurredAt) - 60_000
          || Date.parse(input.command.expiresAt) <= Date.parse(scope.occurredAt)) {
          return err(invalid(input.context, 'Geçici credential yerel issuance zamanında geçerli olmalıdır.'));
        }
        const canonical = canonicalTemporaryCredentialDisclosureJson({ id: input.identifiers.resourceId, kind: input.command.kind,
          purpose: input.command.purpose, audienceRefSha256: sha256(input.command.audienceReference),
          claims: input.command.disclosedClaims, notBefore: input.command.notBefore, expiresAt: input.command.expiresAt });
        const disclosureSha256 = sha256(canonical);
        const generated = this.envelope.issueAndStore({ credentialId: input.identifiers.resourceId,
          canonicalDisclosureJson: canonical, disclosureSha256,
          ownerRefSha256: sha256(JSON.stringify([key.familyId, key.accountId, key.ownerPersonId])),
          issuedAt: scope.occurredAt });
        if (!generated.ok) return generated;
        const bytes = Buffer.byteLength(generated.value.qrPayload, 'utf8');
        if (bytes < 1 || bytes > IDENTITY_ACCESS_MAX_QR_PAYLOAD_BYTES || generated.value.payloadSha256 !== sha256(generated.value.qrPayload)
          || generated.value.disclosureSha256 !== disclosureSha256 || !SHA256.test(generated.value.signatureSha256)
          || !SHA256.test(generated.value.issuerPublicKeySha256) || !nonEmpty(generated.value.issuerKeyId, 160)
          || !nonEmpty(generated.value.encryptedEnvelopeReference, 256) || generated.value.signatureAlgorithm !== 'Ed25519'
          || generated.value.containsOnlyCanonicalDisclosure !== true) {
          try { this.envelope.discardEncryptedEnvelope(generated.value.encryptedEnvelopeReference); } catch { /* invalid envelope is never persisted */ }
          return err(denied(input.context, 'İmzalı QR envelope sınırı veya canonical disclosure binding geçersiz.'));
        }
        stored = generated.value;
        const claimKeys = Object.freeze([...input.command.disclosedClaims].sort((left, right) => left.key.localeCompare(right.key, 'en')).map(({ key }) => key));
        const provisional: TemporaryVerifiableCredentialRow = {
          id: input.identifiers.resourceId, key, familyId: key.familyId, accountId: key.accountId, ownerPersonId: key.ownerPersonId,
          revision: 1, kind: input.command.kind, purpose: input.command.purpose,
          audienceRefSha256: sha256(input.command.audienceReference), disclosedClaimKeys: claimKeys, disclosureSha256,
          payloadSha256: generated.value.payloadSha256, signatureSha256: generated.value.signatureSha256,
          issuerKeyId: generated.value.issuerKeyId, issuerPublicKeySha256: generated.value.issuerPublicKeySha256,
          signatureAlgorithm: 'Ed25519', qrPayloadBytes: bytes, status: 'active', notBefore: input.command.notBefore,
          expiresAt: input.command.expiresAt, issuedAt: scope.occurredAt, encryptedEnvelopeStored: true,
          offlineSignatureVerifiable: true, expiryOfflineVerifiable: true, minimumDisclosureEnforced: true,
          networkDeliveryGuaranteed: false, remoteRevocationFreshnessGuaranteed: false,
          encryptedEnvelopeReference: generated.value.encryptedEnvelopeReference,
          lastMutationId: input.identifiers.mutationId, stateFingerprint: ''
        };
        const stateFingerprint = sha256(canonicalTemporaryCredentialStateJson(provisional));
        const row = { ...provisional, stateFingerprint };
        issuedView = { credential: temporaryView(row), qrPayload: generated.value.qrPayload, qrPayloadBytes: bytes,
          containsOnlySelectedClaims: true, privateSigningKeyExposed: false, networkDeliveryGuaranteed: false };
        return ok({ previousRevision: 0, revision: 1, stateFingerprint, persist: () => scope.insertTemporaryCredential(row) });
      }
    });
    if (!result.ok) {
      if (stored) {
        try { this.envelope.discardEncryptedEnvelope(stored.encryptedEnvelopeReference); } catch { /* original failure remains authoritative */ }
      }
      return result;
    }
    return ok({ receipt: result.value, ...(result.value.replayed ? {} : issuedView ? { issued: issuedView } : {}) });
  }
}

export class RevokeTemporaryVerifiableCredentialUseCase {
  public constructor(private readonly unitOfWork: IdentityAccessCredentialUnitOfWork) {}
  public execute(input: { readonly context: IdentityAccessApplicationContext; readonly command: RevokeTemporaryVerifiableCredentialInput; readonly identifiers: IdentityAccessOperationIdentifiers }) {
    if (input.command.credentialId !== input.identifiers.resourceId || !nonEmpty(input.command.reason, 512)) {
      return Promise.resolve(err(invalid(input.context, 'Credential iptal girdisi geçersiz.')));
    }
    return executeMutation(this.unitOfWork, { context: input.context, clientOperationId: input.command.clientOperationId,
      expectedRevision: input.command.expectedRevision, identifiers: input.identifiers }, {
      mutationKind: 'temporary_credential_revoke', resourceType: 'temporary_verifiable_credential', action: 'delete',
      auditAction: 'temporary_credential.revoked', eventType: 'identity.temporary_credential_revoked',
      loadCurrent: (scope, key) => {
        const row = scope.findTemporaryCredential(key, input.command.credentialId);
        return row.ok ? ok(row.value ? { revision: row.value.revision, stateFingerprint: row.value.stateFingerprint } : null) : row;
      },
      prepare: (scope, key) => {
        const found = scope.findTemporaryCredential(key, input.command.credentialId);
        if (!found.ok) return found;
        if (!found.value || found.value.status !== 'active') return err(missing(input.context, 'Aktif geçici credential bulunamadı.'));
        const provisional: TemporaryVerifiableCredentialRow = { ...found.value, revision: found.value.revision + 1, status: 'revoked',
          revokedAt: scope.occurredAt, revocationReason: input.command.reason, lastMutationId: input.identifiers.mutationId, stateFingerprint: '' };
        const stateFingerprint = sha256(canonicalTemporaryCredentialStateJson(provisional));
        const row = { ...provisional, stateFingerprint };
        return ok({ previousRevision: found.value.revision, revision: row.revision, stateFingerprint,
          persist: () => {
            const saved = scope.saveTemporaryCredential(row, found.value!.revision);
            return saved.ok && saved.value ? ok(undefined) : saved.ok ? err(conflict(input.context, 'Credential iptal revizyon çatışması.')) : saved;
          } });
      }
    });
  }
}

export class VerifyTemporaryVerifiableCredentialUseCase {
  public constructor(
    private readonly unitOfWork: IdentityAccessCredentialUnitOfWork,
    private readonly envelope: TemporaryCredentialEnvelopePort
  ) {}
  public execute(input: { readonly context: IdentityAccessApplicationContext; readonly command: VerifyTemporaryVerifiableCredentialInput }): Promise<Result<TemporaryCredentialVerificationView, AppError>> {
    const bytes = Buffer.byteLength(input.command.qrPayload, 'utf8');
    if (bytes < 1 || bytes > IDENTITY_ACCESS_MAX_QR_PAYLOAD_BYTES || !nonEmpty(input.command.expectedAudienceReference, 160)) {
      return Promise.resolve(err(invalid(input.context, 'QR payload veya doğrulama zamanı geçersiz.')));
    }
    const expectedAudienceRefSha256 = sha256(input.command.expectedAudienceReference);
    const verification = this.envelope.verifyOffline(input.command.qrPayload, expectedAudienceRefSha256);
    if (!verification.ok) return Promise.resolve(verification);
    const value = verification.value;
    const rules = TEMPORARY_CREDENTIAL_DISCLOSURE_RULES[value.kind];
    const keysValid = value.disclosedClaimKeys.length > 0 && value.disclosedClaimKeys.length <= IDENTITY_ACCESS_MAX_DISCLOSED_CLAIMS
      && new Set(value.disclosedClaimKeys).size === value.disclosedClaimKeys.length
      && rules.required.every((key) => value.disclosedClaimKeys.includes(key))
      && value.disclosedClaimKeys.every((key) => (rules.allowed as readonly TemporaryCredentialClaimKey[]).includes(key));
    if (!nonEmpty(value.credentialId, 160) || value.payloadSha256 !== sha256(input.command.qrPayload)
      || !SHA256.test(value.issuerPublicKeySha256) || !SHA256.test(value.audienceRefSha256)
      || value.audienceMatched !== (value.audienceRefSha256 === expectedAudienceRefSha256)
      || !validDate(value.notBefore) || !validDate(value.expiresAt) || !keysValid || value.networkUsed !== false
      || value.issuerIdentityCertified !== false) {
      return Promise.resolve(err(denied(input.context, 'Offline credential doğrulama çıktısı payload ile bağlı değil.')));
    }
    const key = keyFor(input.context);
    if (!key.ok) return Promise.resolve(key);
    return this.unitOfWork.execute(input.context, intent(key.value, 'read', 'temporary_verifiable_credential', value.credentialId), (scope) => {
      const stored = scope.findTemporaryCredential(key.value, value.credentialId);
      if (!stored.ok) return stored;
      const notYetValid = Date.parse(scope.occurredAt) < Date.parse(value.notBefore);
      const expired = Date.parse(scope.occurredAt) >= Date.parse(value.expiresAt);
      const exactStored = stored.value && stored.value.payloadSha256 === value.payloadSha256
        && stored.value.issuerPublicKeySha256 === value.issuerPublicKeySha256
        && stored.value.audienceRefSha256 === value.audienceRefSha256
        && stored.value.kind === value.kind && JSON.stringify(stored.value.disclosedClaimKeys) === JSON.stringify(value.disclosedClaimKeys);
      const revocationStatus = !stored.value || !exactStored ? 'unknown_offline' as const
        : stored.value.status === 'revoked' ? 'revoked_locally' as const : 'not_revoked_locally' as const;
      const rejected = !value.signatureValid || !value.disclosureValid || !value.audienceMatched || !keysValid || notYetValid || expired || revocationStatus === 'revoked_locally';
      const issuerKnown = Boolean(stored.value && stored.value.issuerPublicKeySha256 === value.issuerPublicKeySha256);
      return ok({
        credentialId: value.credentialId,
        signatureValid: value.signatureValid,
        notYetValid,
        expired,
        disclosureValid: value.disclosureValid && keysValid,
        revocationStatus,
        decision: rejected ? 'rejected' : !issuerKnown ? 'indeterminate_issuer'
          : revocationStatus === 'unknown_offline' ? 'indeterminate_revocation' : 'accepted_locally',
        audienceMatched: value.audienceMatched,
        issuerIdentityCertified: false,
        verifiedAt: scope.occurredAt,
        offlineSignatureVerified: value.signatureValid,
        networkUsed: false,
        remoteRevocationFreshnessGuaranteed: false,
        providerDeliveryGuaranteed: false,
        disclosedClaimKeys: value.disclosedClaimKeys
      });
    });
  }
}

export class CreateReadOnlyCompanionSnapshotUseCase {
  public constructor(
    private readonly unitOfWork: IdentityAccessCredentialUnitOfWork,
    private readonly snapshotPort: EncryptedCompanionSnapshotPort
  ) {}
  public execute(input: { readonly context: IdentityAccessApplicationContext; readonly command: CreateReadOnlyCompanionSnapshotInput; readonly identifiers: CompanionSnapshotIdentifiers }): Promise<Result<ReadOnlyCompanionSnapshotView | CompanionSyncDenialView, AppError>> {
    const key = keyFor(input.context);
    if (!key.ok) return Promise.resolve(key);
    if (!IDENTIFIER.test(input.identifiers.snapshotId) || !IDENTIFIER.test(input.identifiers.auditId)
      || !nonEmpty(String(input.identifiers.outboxEventId), 160) || !IDENTIFIER.test(input.command.trustedDeviceId)
      || (input.command.knownSourceVersion !== undefined && !validRevision(input.command.knownSourceVersion))) {
      return Promise.resolve(err(invalid(input.context, 'Companion snapshot kimliği veya sürümü geçersiz.')));
    }
    return this.unitOfWork.execute<ReadOnlyCompanionSnapshotView | CompanionSyncDenialView>(
      input.context,
      intent(key.value, 'create', 'companion_sync_snapshot', input.identifiers.snapshotId),
      (scope) => {
      const source = scope.loadCompanionSourceProjection(key.value);
      if (!source.ok) return source;
      const denial = (status: CompanionSyncDenialView['status']): Result<CompanionSyncDenialView, AppError> => ok({
        status, currentSourceVersion: source.value.sourceVersion, sourceAuthority: 'windows_single_writer',
        remoteWritesAccepted: false, conflictResolution: 'reject_remote_and_refresh', networkDeliveryGuaranteed: false
      });
      const trusted = scope.findTrustedDevice(key.value, input.command.trustedDeviceId);
      if (!trusted.ok) return trusted;
      if (!trusted.value || trusted.value.revokedAt) return denial('device_revoked');
      if (trusted.value.accountId !== key.value.accountId || trusted.value.securityEpoch !== input.context.currentDevice.securityEpoch) {
        return denial('security_epoch_stale');
      }
      if (input.command.requestedMode === 'write') return denial('write_forbidden');
      if (input.command.knownSourceVersion !== undefined && input.command.knownSourceVersion !== source.value.sourceVersion) {
        return denial('version_conflict');
      }
      const generated = this.snapshotPort.create({ key: key.value, trustedDeviceId: trusted.value.trustedDeviceId,
        sourceVersion: source.value.sourceVersion, schemaVersion: source.value.schemaVersion,
        securityEpoch: trusted.value.securityEpoch, generatedAt: scope.occurredAt, snapshot: source.value });
      if (!generated.ok) return generated;
      const decodedEnvelope = Buffer.from(generated.value.encryptedEnvelopeBase64Url, 'base64url');
      const envelopeBytes = decodedEnvelope.byteLength;
      if (envelopeBytes < 1 || envelopeBytes > IDENTITY_ACCESS_MAX_COMPANION_ENVELOPE_BYTES
        || !BASE64URL.test(generated.value.encryptedEnvelopeBase64Url)
        || decodedEnvelope.toString('base64url') !== generated.value.encryptedEnvelopeBase64Url
        || !SHA256.test(generated.value.ciphertextSha256)
        || !SHA256.test(generated.value.envelopeSha256) || generated.value.sourceVersion !== source.value.sourceVersion
        || generated.value.schemaVersion !== source.value.schemaVersion || !validDate(generated.value.expiresAt)
        || Date.parse(generated.value.expiresAt) <= Date.parse(scope.occurredAt)) {
        return err(denied(input.context, 'Şifreli read-only companion envelope doğrulanamadı.'));
      }
      const metadata: CompanionSyncSnapshotRow = {
        id: input.identifiers.snapshotId, key: key.value, familyId: key.value.familyId, accountId: key.value.accountId,
        ownerPersonId: key.value.ownerPersonId, trustedDeviceId: trusted.value.trustedDeviceId, protocolVersion: 1,
        sourceVersion: source.value.sourceVersion, schemaVersion: source.value.schemaVersion,
        ciphertextSha256: generated.value.ciphertextSha256, envelopeSha256: generated.value.envelopeSha256,
        envelopeBytes, securityEpoch: trusted.value.securityEpoch, generatedAt: scope.occurredAt,
        expiresAt: generated.value.expiresAt, sourceAuthority: 'windows_single_writer', encrypted: true, readOnly: true,
        remoteWritesAccepted: false, conflictResolution: 'reject_remote_and_refresh', networkDeliveryGuaranteed: false
      };
      const recorded = scope.recordCompanionSnapshot(metadata);
      if (!recorded.ok) return recorded;
      const audited = scope.appendAudit({ id: input.identifiers.auditId, action: 'companion.snapshot_created',
        resourceType: 'companion_sync_snapshot', resourceId: metadata.id, occurredAt: scope.occurredAt, actorId: input.context.actor.userId });
      if (!audited.ok) return audited;
      const event: DomainEvent<{ readonly sourceVersion: number; readonly ciphertextSha256: string }> = {
        eventId: input.identifiers.outboxEventId, eventType: 'identity.companion_snapshot_created', eventVersion: 1,
        aggregateType: 'companion_sync_snapshot', aggregateId: metadata.id, occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId, correlationId: input.context.correlationId,
        payload: { sourceVersion: metadata.sourceVersion, ciphertextSha256: metadata.ciphertextSha256 }
      };
      const queued = scope.enqueueEvent(event);
      return queued.ok ? ok({ ...metadata, status: 'snapshot_ready', encryptedEnvelopeBase64Url: generated.value.encryptedEnvelopeBase64Url }) : queued;
      }
    );
  }
}
