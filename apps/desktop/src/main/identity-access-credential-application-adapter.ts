import {
  ERROR_CODES,
  asIsoDateTime,
  createAppError,
  err,
  ok,
  type AppError,
  type Result,
  type UserId
} from '@ppt/core';
import type {
  EncryptedCompanionSnapshotPort,
  FederatedAuthorizationCeremonyPort,
  FederatedAuthorizationCodeVerifierPort,
  IdentityAccessApplicationContext,
  IdentityAccessCredentialUnitOfWork,
  IdentityAccessCredentialWriteScope,
  IdentityAccessPolicyIntent,
  PasskeyCeremonyVerifierPort,
  PasskeySessionPort,
  StrongPasskeyRecoveryVerifierPort,
  TemporaryCredentialEnvelopePort,
  TimelineApplicationContext,
  TimelinePolicyIntent
} from '@ppt/application';
import type { IdentityAccessAggregateKey } from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  AccountRepositoryPort,
  AuditRepositoryPort,
  IdentityAccessCredentialRepositoryPort,
  OutboxRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext,
  TrustedDeviceRepositoryPort
} from '@ppt/repository-contracts';
import type { GovernedTimelinePolicyTransactionScope } from './timeline-application-adapter.js';

export type IdentityAccessTimelinePolicyIntent = Omit<TimelinePolicyIntent, 'resourceType'> & {
  readonly resourceType: IdentityAccessPolicyIntent['resourceType'];
};

export interface IdentityAccessPolicyTransactionRunner {
  execute<T>(
    context: TimelineApplicationContext,
    intent: IdentityAccessTimelinePolicyIntent,
    operation: (scope: GovernedTimelinePolicyTransactionScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

/** Transaction-bound encrypted-vault mutation. Implementations stage or roll back with the governed transaction. */
export interface IdentityAccessFederatedVaultControlPort {
  revokeEntry(
    context: PolicyAuthorizedRepositoryExecutionContext,
    encryptedVaultEntryId: string
  ): Result<void, AppError>;
}

export interface IdentityAccessCredentialQuotaPort {
  countTemporaryCredentials(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: IdentityAccessAggregateKey
  ): Result<number, AppError>;
}

/** Called only after the security-epoch transaction commits successfully. */
export interface LocalIdentitySessionRevocationPort {
  clearForAccount(accountId: UserId): Result<void, AppError>;
}

/**
 * Crypto/provider/envelope implementations are injected by production
 * composition. This adapter never implements or inspects token, private-key,
 * biometric, WebAuthn response, QR claim, or companion plaintext bytes.
 */
export interface IdentityAccessExternalSecurityPorts {
  readonly passkeyCeremonyVerifier: PasskeyCeremonyVerifierPort;
  readonly passkeySession: PasskeySessionPort;
  readonly passkeyRecoveryVerifier: StrongPasskeyRecoveryVerifierPort;
  readonly federatedAuthorizationCeremony: FederatedAuthorizationCeremonyPort;
  readonly federatedAuthorizationCodeVerifier: FederatedAuthorizationCodeVerifierPort;
  readonly temporaryCredentialEnvelope: TemporaryCredentialEnvelopePort;
  readonly encryptedCompanionSnapshot: EncryptedCompanionSnapshotPort;
}

export interface RepositoryBackedIdentityAccessCredentialDependencies {
  readonly policyTransactionRunner: IdentityAccessPolicyTransactionRunner;
  readonly identityRepository: IdentityAccessCredentialRepositoryPort;
  readonly accountRepository: AccountRepositoryPort;
  readonly trustedDeviceRepository: TrustedDeviceRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly outboxRepository: OutboxRepositoryPort;
  readonly federatedVaultControl: IdentityAccessFederatedVaultControlPort;
  readonly quota: IdentityAccessCredentialQuotaPort;
  readonly localSessionRevocation: LocalIdentitySessionRevocationPort;
  readonly externalSecurityPorts: IdentityAccessExternalSecurityPorts;
}

const applicationError = (
  context: IdentityAccessApplicationContext,
  message: string
): AppError => createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  category: 'security',
  message,
  correlationId: context.correlationId
});

const timelineContext = (context: IdentityAccessApplicationContext): TimelineApplicationContext => ({
  familyId: context.familyId,
  actor: {
    userId: context.actor.userId,
    roles: [context.actor.role],
    ...(context.actor.personId ? { personId: context.actor.personId } : {})
  },
  correlationId: context.correlationId
});

const timelineIntent = (
  context: IdentityAccessApplicationContext,
  intent: IdentityAccessPolicyIntent
): Result<IdentityAccessTimelinePolicyIntent, AppError> => {
  if (intent.purpose !== 'administration' || intent.familyId !== context.familyId
    || intent.ownerPersonId !== context.actor.personId
    || (intent.action === 'read' ? intent.capability !== 'family.read' : intent.capability !== 'family.write')) {
    return err(applicationError(context, 'Identity access policy intent is not exact'));
  }
  return ok({
    action: intent.action,
    capability: intent.capability,
    resourceType: intent.resourceType,
    resourceId: intent.resourceId,
    purpose: 'administration',
    ownerPersonId: intent.ownerPersonId,
    targetSensitivity: intent.sensitivity,
    ...(intent.action === 'create'
      ? { sourceResourceMode: 'replace' as const }
      : intent.action === 'update'
        ? { sourceResourceMode: 'preserve' as const }
        : {})
  });
};

const exactKey = (
  context: IdentityAccessApplicationContext,
  intent: IdentityAccessPolicyIntent,
  repository: PolicyAuthorizedRepositoryExecutionContext
): Result<IdentityAccessAggregateKey, AppError> => {
  const personId = context.actor.personId;
  const authorization = repository.policyAuthorization;
  if (!personId
    || repository.actor.userId !== context.actor.userId
    || repository.actor.personId !== personId
    || authorization.subject.accountId !== context.actor.userId
    || authorization.subject.personId !== personId
    || authorization.subject.deviceId !== context.currentDevice.deviceId
    || authorization.resourceFamilyId !== context.familyId
    || intent.familyId !== context.familyId
    || intent.ownerPersonId !== personId) {
    return err(applicationError(context, 'Identity access governed transaction subject, device or family changed'));
  }
  return ok({ familyId: context.familyId, accountId: context.actor.userId, ownerPersonId: personId });
};

class RepositoryBackedIdentityAccessCredentialWriteScope implements IdentityAccessCredentialWriteScope {
  public readonly occurredAt;
  public sessionRevocationRequested = false;
  readonly #key: IdentityAccessAggregateKey;

  public constructor(
    private readonly dependencies: RepositoryBackedIdentityAccessCredentialDependencies,
    private readonly repository: PolicyAuthorizedRepositoryExecutionContext,
    private readonly applicationContext: IdentityAccessApplicationContext,
    key: IdentityAccessAggregateKey
  ) {
    // Identity row clocks are bound to the durable PEP receipt, not a later
    // transaction-open timestamp that can drift by milliseconds.
    this.occurredAt = asIsoDateTime(repository.policyAuthorization.receiptRecord.receipt.issuedAt);
    this.#key = key;
  }

  public loadCenter(key: IdentityAccessAggregateKey): ReturnType<IdentityAccessCredentialWriteScope['loadCenter']> {
    return this.dependencies.identityRepository.loadCenter(this.repository, key);
  }
  public findTrustedDevice(key: IdentityAccessAggregateKey, trustedDeviceId: string): ReturnType<IdentityAccessCredentialWriteScope['findTrustedDevice']> {
    return this.dependencies.identityRepository.findTrustedDevice(this.repository, key, trustedDeviceId);
  }
  public insertChallenge(row: Parameters<IdentityAccessCredentialWriteScope['insertChallenge']>[0]): ReturnType<IdentityAccessCredentialWriteScope['insertChallenge']> {
    return this.dependencies.identityRepository.insertChallenge(this.repository, row);
  }
  public findChallenge(key: IdentityAccessAggregateKey, challengeId: string): ReturnType<IdentityAccessCredentialWriteScope['findChallenge']> {
    return this.dependencies.identityRepository.findChallenge(this.repository, key, challengeId);
  }
  public consumeChallenge(
    key: IdentityAccessAggregateKey,
    challengeId: string,
    consumedAt: Parameters<IdentityAccessCredentialWriteScope['consumeChallenge']>[2],
    mutationId: string
  ): ReturnType<IdentityAccessCredentialWriteScope['consumeChallenge']> {
    return this.dependencies.identityRepository.consumeChallenge(this.repository, key, challengeId, consumedAt, mutationId);
  }
  public listPasskeys(key: IdentityAccessAggregateKey): ReturnType<IdentityAccessCredentialWriteScope['listPasskeys']> {
    return this.dependencies.identityRepository.listPasskeys(this.repository, key);
  }
  public findPasskey(key: IdentityAccessAggregateKey, passkeyId: string): ReturnType<IdentityAccessCredentialWriteScope['findPasskey']> {
    return this.dependencies.identityRepository.findPasskey(this.repository, key, passkeyId);
  }
  public findPasskeyByCredentialIdSha256(
    key: IdentityAccessAggregateKey,
    credentialIdSha256: string
  ): ReturnType<IdentityAccessCredentialWriteScope['findPasskeyByCredentialIdSha256']> {
    return this.dependencies.identityRepository.findPasskeyByCredentialIdSha256(this.repository, key, credentialIdSha256);
  }
  public insertPasskey(row: Parameters<IdentityAccessCredentialWriteScope['insertPasskey']>[0]): ReturnType<IdentityAccessCredentialWriteScope['insertPasskey']> {
    return this.dependencies.identityRepository.insertPasskey(this.repository, row);
  }
  public savePasskey(
    row: Parameters<IdentityAccessCredentialWriteScope['savePasskey']>[0],
    expectedRevision: number
  ): ReturnType<IdentityAccessCredentialWriteScope['savePasskey']> {
    return this.dependencies.identityRepository.savePasskey(this.repository, row, expectedRevision);
  }
  public listConfiguredFederatedProviders(): ReturnType<IdentityAccessCredentialWriteScope['listConfiguredFederatedProviders']> {
    return this.dependencies.identityRepository.listConfiguredFederatedProviders(this.repository);
  }
  public findFederatedLink(
    key: IdentityAccessAggregateKey,
    linkId: string
  ): ReturnType<IdentityAccessCredentialWriteScope['findFederatedLink']> {
    return this.dependencies.identityRepository.findFederatedLink(this.repository, key, linkId);
  }
  public findFederatedLinkByProvider(
    key: IdentityAccessAggregateKey,
    provider: Parameters<IdentityAccessCredentialWriteScope['findFederatedLinkByProvider']>[1]
  ): ReturnType<IdentityAccessCredentialWriteScope['findFederatedLinkByProvider']> {
    return this.dependencies.identityRepository.findFederatedLinkByProvider(this.repository, key, provider);
  }
  public insertFederatedLink(
    row: Parameters<IdentityAccessCredentialWriteScope['insertFederatedLink']>[0]
  ): ReturnType<IdentityAccessCredentialWriteScope['insertFederatedLink']> {
    return this.dependencies.identityRepository.insertFederatedLink(this.repository, row);
  }
  public saveFederatedLink(
    row: Parameters<IdentityAccessCredentialWriteScope['saveFederatedLink']>[0],
    expectedRevision: number
  ): ReturnType<IdentityAccessCredentialWriteScope['saveFederatedLink']> {
    return this.dependencies.identityRepository.saveFederatedLink(this.repository, row, expectedRevision);
  }
  public revokeFederatedVaultEntry(encryptedVaultEntryId: string): ReturnType<IdentityAccessCredentialWriteScope['revokeFederatedVaultEntry']> {
    return this.dependencies.federatedVaultControl.revokeEntry(this.repository, encryptedVaultEntryId);
  }
  public findTemporaryCredential(
    key: IdentityAccessAggregateKey,
    credentialId: string
  ): ReturnType<IdentityAccessCredentialWriteScope['findTemporaryCredential']> {
    return this.dependencies.identityRepository.findTemporaryCredential(this.repository, key, credentialId);
  }
  public insertTemporaryCredential(
    row: Parameters<IdentityAccessCredentialWriteScope['insertTemporaryCredential']>[0]
  ): ReturnType<IdentityAccessCredentialWriteScope['insertTemporaryCredential']> {
    return this.dependencies.identityRepository.insertTemporaryCredential(this.repository, row);
  }
  public saveTemporaryCredential(
    row: Parameters<IdentityAccessCredentialWriteScope['saveTemporaryCredential']>[0],
    expectedRevision: number
  ): ReturnType<IdentityAccessCredentialWriteScope['saveTemporaryCredential']> {
    return this.dependencies.identityRepository.saveTemporaryCredential(this.repository, row, expectedRevision);
  }
  public countTemporaryCredentials(key: IdentityAccessAggregateKey): ReturnType<IdentityAccessCredentialWriteScope['countTemporaryCredentials']> {
    return this.dependencies.quota.countTemporaryCredentials(this.repository, key);
  }
  public loadCompanionSourceProjection(key: IdentityAccessAggregateKey): ReturnType<IdentityAccessCredentialWriteScope['loadCompanionSourceProjection']> {
    return this.dependencies.identityRepository.loadCompanionSourceProjection(this.repository, key);
  }
  public recordCompanionSnapshot(
    row: Parameters<IdentityAccessCredentialWriteScope['recordCompanionSnapshot']>[0]
  ): ReturnType<IdentityAccessCredentialWriteScope['recordCompanionSnapshot']> {
    return this.dependencies.identityRepository.recordCompanionSnapshot(this.repository, row);
  }
  public findMutationByClientOperationId(
    key: IdentityAccessAggregateKey,
    clientOperationId: string
  ): ReturnType<IdentityAccessCredentialWriteScope['findMutationByClientOperationId']> {
    return this.dependencies.identityRepository.findMutationByClientOperationId(this.repository, key, clientOperationId);
  }
  public insertMutation(
    row: Parameters<IdentityAccessCredentialWriteScope['insertMutation']>[0]
  ): ReturnType<IdentityAccessCredentialWriteScope['insertMutation']> {
    return this.dependencies.identityRepository.insertMutation(this.repository, row);
  }
  public advanceSecurityEpochAndRevokeLocalSessions(
    accountId: UserId
  ): ReturnType<IdentityAccessCredentialWriteScope['advanceSecurityEpochAndRevokeLocalSessions']> {
    if (accountId !== this.#key.accountId) {
      return err(applicationError(this.applicationContext, 'Security epoch target is outside the governed identity account'));
    }
    const account = this.dependencies.accountRepository.findById(this.repository, accountId);
    if (!account.ok) return account;
    if (!account.value || account.value.personId !== this.#key.ownerPersonId || account.value.status !== 'active') {
      return err(applicationError(this.applicationContext, 'Security epoch account is not the active governed owner'));
    }
    const advanced = this.dependencies.accountRepository.advanceSecurityEpoch(this.repository, accountId);
    if (!advanced.ok) return advanced;
    if (!Number.isSafeInteger(advanced.value) || advanced.value <= account.value.securityEpoch) {
      return err(applicationError(this.applicationContext, 'Security epoch did not advance monotonically'));
    }
    const revokedDevices = this.dependencies.trustedDeviceRepository.revokeAll(this.repository, accountId, this.occurredAt);
    if (!revokedDevices.ok) return revokedDevices;
    this.sessionRevocationRequested = true;
    return ok({ securityEpoch: advanced.value });
  }
  public appendAudit(
    input: Parameters<IdentityAccessCredentialWriteScope['appendAudit']>[0]
  ): ReturnType<IdentityAccessCredentialWriteScope['appendAudit']> {
    return this.dependencies.auditRepository.append(this.repository, input);
  }
  public enqueueEvent<T>(event: DomainEvent<T>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.repository, event);
  }
}

export class RepositoryBackedIdentityAccessCredentialUnitOfWork implements IdentityAccessCredentialUnitOfWork {
  public constructor(private readonly dependencies: RepositoryBackedIdentityAccessCredentialDependencies) {}

  public async execute<T>(
    context: IdentityAccessApplicationContext,
    intent: IdentityAccessPolicyIntent,
    operation: (scope: IdentityAccessCredentialWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    const mappedIntent = timelineIntent(context, intent);
    if (!mappedIntent.ok) return mappedIntent;
    let writeScope: RepositoryBackedIdentityAccessCredentialWriteScope | undefined;
    const result = await this.dependencies.policyTransactionRunner.execute(
      timelineContext(context),
      mappedIntent.value,
      (governed) => {
        const key = exactKey(context, intent, governed.repository);
        if (!key.ok) return key;
        writeScope = new RepositoryBackedIdentityAccessCredentialWriteScope(
          this.dependencies,
          governed.repository,
          context,
          key.value
        );
        return operation(writeScope);
      }
    );
    if (result.ok && writeScope?.sessionRevocationRequested) {
      const cleared = this.dependencies.localSessionRevocation.clearForAccount(context.actor.userId);
      if (!cleared.ok) return cleared;
    }
    return result;
  }
}
