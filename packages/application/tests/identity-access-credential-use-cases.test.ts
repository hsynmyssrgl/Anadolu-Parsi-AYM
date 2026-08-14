import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ERROR_CODES,
  asCorrelationId,
  asEventId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import type {
  FederatedIdentityProvider,
  TemporaryCredentialClaimKey,
  TemporaryCredentialKind
} from '@ppt/domain';
import type {
  CompanionSyncSnapshotRow,
  FederatedIdentityLinkRow,
  FederatedProviderConfigurationRow,
  IdentityAccessMutationRow,
  IdentityChallengeRow,
  PasskeyCredentialRow,
  TemporaryVerifiableCredentialRow
} from '@ppt/repository-contracts';
import {
  AuthenticateWithPasskeyUseCase,
  BeginFederatedIdentityLinkUseCase,
  BeginPasskeyAuthenticationUseCase,
  BeginPasskeyRegistrationUseCase,
  CompletePasskeyRegistrationUseCase,
  CreateReadOnlyCompanionSnapshotUseCase,
  GetIdentityAccessCredentialCenterUseCase,
  IssueTemporaryVerifiableCredentialUseCase,
  LinkFederatedIdentityUseCase,
  RecoverLostPasskeyUseCase,
  RevokePasskeyUseCase,
  RevokeTemporaryVerifiableCredentialUseCase,
  UnlinkFederatedIdentityUseCase,
  VerifyTemporaryVerifiableCredentialUseCase,
  type EncryptedCompanionSnapshotPort,
  type FederatedAuthorizationCodeVerifierPort,
  type FederatedAuthorizationCeremonyPort,
  type IdentityAccessApplicationContext,
  type IdentityAccessCredentialUnitOfWork,
  type IdentityAccessCredentialWriteScope,
  type IdentityAccessOperationIdentifiers,
  type IdentityAccessPolicyIntent,
  type OfflineTemporaryCredentialVerification,
  type PasskeyCeremonyVerifierPort,
  type PasskeySessionPort,
  type StoredTemporaryCredentialEnvelope,
  type StrongPasskeyRecoveryVerifierPort,
  type TemporaryCredentialEnvelopePort,
  type VerifiedFederatedIdentityLink,
  type VerifiedPasskeyAuthentication,
  type VerifiedPasskeyRegistration
} from '../src/identity-access-credential-use-cases.js';

const NOW = asIsoDateTime('2026-08-14T08:00:00.000Z');
const TOMORROW = asIsoDateTime('2026-08-15T08:00:00.000Z');
const FAMILY_ID = asFamilyId('family-33-p-test');
const ACCOUNT_ID = asUserId('account-33-p-test');
const PERSON_ID = asPersonId('person-33-p-test');
const KEY = { familyId: FAMILY_ID, accountId: ACCOUNT_ID, ownerPersonId: PERSON_ID };
const CHALLENGE = 'A'.repeat(43);
const hash = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const context = (): IdentityAccessApplicationContext => ({
  familyId: FAMILY_ID,
  actor: { userId: ACCOUNT_ID, role: 'family_admin', personId: PERSON_ID },
  currentDevice: { trustedDeviceId: 'trusted-device-current', deviceId: 'device-current', securityEpoch: 7 },
  correlationId: asCorrelationId('correlation-33-p-test')
});

const identifiers = (resourceId: string, suffix: string, requestFingerprint = hash(`request:${suffix}`)): IdentityAccessOperationIdentifiers => ({
  mutationId: `mutation-${suffix}`,
  resourceId,
  requestFingerprint,
  auditId: `audit-${suffix}`,
  outboxEventId: asEventId(`event-${suffix}`)
});

const failure = (message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_UNEXPECTED,
  category: 'unexpected',
  message,
  correlationId: context().correlationId
});

class MemoryUnitOfWork implements IdentityAccessCredentialUnitOfWork {
  public readonly passkeys = new Map<string, PasskeyCredentialRow>();
  public readonly links = new Map<string, FederatedIdentityLinkRow>();
  public readonly temporary = new Map<string, TemporaryVerifiableCredentialRow>();
  public readonly challenges = new Map<string, IdentityChallengeRow>();
  public readonly mutations = new Map<string, IdentityAccessMutationRow>();
  public readonly snapshots = new Map<string, CompanionSyncSnapshotRow>();
  public readonly audits: string[] = [];
  public readonly events: string[] = [];
  public readonly revokedVaultEntries: string[] = [];
  public configuredProviders: FederatedProviderConfigurationRow[] = [];
  public trustedDeviceRevoked = false;
  public securityEpoch = 7;
  public sourceVersion = 4;
  public schemaVersion = 92;
  public failAudit = false;
  public lastIntent?: IdentityAccessPolicyIntent;

  readonly #scope: IdentityAccessCredentialWriteScope = {
    occurredAt: NOW,
    loadCenter: (key) => ok({
      key,
      passkeys: [...this.passkeys.values()],
      federatedLinks: [...this.links.values()],
      temporaryCredentials: [...this.temporary.values()],
      companionSnapshots: [...this.snapshots.values()],
      configuredProviders: this.configuredProviders.filter(({ configured }) => configured).map(({ provider }) => provider),
      generatedAt: NOW
    }),
    findTrustedDevice: (_key, trustedDeviceId) => ok(trustedDeviceId === 'trusted-device-current' || trustedDeviceId === 'trusted-device-companion' ? {
      trustedDeviceId,
      accountId: ACCOUNT_ID,
      deviceId: trustedDeviceId === 'trusted-device-current' ? 'device-current' : 'device-companion',
      securityEpoch: this.securityEpoch,
      ...(this.trustedDeviceRevoked ? { revokedAt: NOW } : {})
    } : null),
    insertChallenge: (row) => { if (this.challenges.has(row.id)) return err(failure('duplicate challenge')); this.challenges.set(row.id, row); return ok(undefined); },
    findChallenge: (_key, id) => ok(this.challenges.get(id) ?? null),
    consumeChallenge: (_key, id, consumedAt, mutationId) => {
      const row = this.challenges.get(id);
      if (!row || row.consumedAt) return ok(false);
      this.challenges.set(id, { ...row, consumedAt, consumptionMutationId: mutationId });
      return ok(true);
    },
    listPasskeys: () => ok([...this.passkeys.values()]),
    findPasskey: (_key, id) => ok(this.passkeys.get(id) ?? null),
    findPasskeyByCredentialIdSha256: (_key, digest) => ok([...this.passkeys.values()].find(({ credentialIdSha256 }) => credentialIdSha256 === digest) ?? null),
    insertPasskey: (row) => { if (this.passkeys.has(row.id)) return err(failure('duplicate passkey')); this.passkeys.set(row.id, row); return ok(undefined); },
    savePasskey: (row, expectedRevision) => {
      const current = this.passkeys.get(row.id);
      if (!current || current.revision !== expectedRevision) return ok(false);
      this.passkeys.set(row.id, row); return ok(true);
    },
    listConfiguredFederatedProviders: () => ok(this.configuredProviders),
    findFederatedLink: (_key, id) => ok(this.links.get(id) ?? null),
    findFederatedLinkByProvider: (_key, provider) => ok([...this.links.values()].find((row) => row.provider === provider) ?? null),
    insertFederatedLink: (row) => { if (this.links.has(row.id)) return err(failure('duplicate link')); this.links.set(row.id, row); return ok(undefined); },
    saveFederatedLink: (row, expectedRevision) => {
      const current = this.links.get(row.id); if (!current || current.revision !== expectedRevision) return ok(false);
      this.links.set(row.id, row); return ok(true);
    },
    revokeFederatedVaultEntry: (entry) => { this.revokedVaultEntries.push(entry); return ok(undefined); },
    findTemporaryCredential: (_key, id) => ok(this.temporary.get(id) ?? null),
    insertTemporaryCredential: (row) => { if (this.temporary.has(row.id)) return err(failure('duplicate credential')); this.temporary.set(row.id, row); return ok(undefined); },
    saveTemporaryCredential: (row, expectedRevision) => {
      const current = this.temporary.get(row.id); if (!current || current.revision !== expectedRevision) return ok(false);
      this.temporary.set(row.id, row); return ok(true);
    },
    countTemporaryCredentials: () => ok(this.temporary.size),
    loadCompanionSourceProjection: () => ok({ sourceVersion: this.sourceVersion, schemaVersion: 1 as const,
      passkeys: [], federatedLinks: [], temporaryCredentials: [], sourceAuthority: 'windows_single_writer' as const,
      remoteWritesAccepted: false as const }),
    recordCompanionSnapshot: (row) => { this.snapshots.set(row.id, row); return ok(undefined); },
    findMutationByClientOperationId: (_key, id) => ok(this.mutations.get(id) ?? null),
    insertMutation: (row) => { if (this.mutations.has(row.clientOperationId)) return err(failure('duplicate operation')); this.mutations.set(row.clientOperationId, row); return ok(undefined); },
    advanceSecurityEpochAndRevokeLocalSessions: () => { this.securityEpoch += 1; return ok({ securityEpoch: this.securityEpoch }); },
    appendAudit: ({ action }) => { if (this.failAudit) return err(failure('audit failure')); this.audits.push(action); return ok(hash(action)); },
    enqueueEvent: (event) => { this.events.push(String(event.eventType)); return ok(undefined); }
  };

  public async execute<T>(
    _context: IdentityAccessApplicationContext,
    intent: IdentityAccessPolicyIntent,
    operation: (scope: IdentityAccessCredentialWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    this.lastIntent = intent;
    const checkpoint = {
      passkeys: new Map(this.passkeys), links: new Map(this.links), temporary: new Map(this.temporary),
      challenges: new Map(this.challenges), mutations: new Map(this.mutations), snapshots: new Map(this.snapshots),
      audits: this.audits.length, events: this.events.length, vault: this.revokedVaultEntries.length, epoch: this.securityEpoch
    };
    const restore = () => {
      this.passkeys.clear(); checkpoint.passkeys.forEach((value, key) => this.passkeys.set(key, value));
      this.links.clear(); checkpoint.links.forEach((value, key) => this.links.set(key, value));
      this.temporary.clear(); checkpoint.temporary.forEach((value, key) => this.temporary.set(key, value));
      this.challenges.clear(); checkpoint.challenges.forEach((value, key) => this.challenges.set(key, value));
      this.mutations.clear(); checkpoint.mutations.forEach((value, key) => this.mutations.set(key, value));
      this.snapshots.clear(); checkpoint.snapshots.forEach((value, key) => this.snapshots.set(key, value));
      this.audits.length = checkpoint.audits; this.events.length = checkpoint.events;
      this.revokedVaultEntries.length = checkpoint.vault; this.securityEpoch = checkpoint.epoch;
    };
    try {
      const result = operation(this.#scope);
      if (!result.ok) restore();
      return result;
    } catch (error) {
      restore();
      return err(failure(error instanceof Error ? error.message : 'unexpected'));
    }
  }
}

class PasskeyVerifier implements PasskeyCeremonyVerifierPort {
  public registration?: VerifiedPasskeyRegistration;
  public authentication?: VerifiedPasskeyAuthentication;
  public registrationCalls = 0;
  public authenticationCalls = 0;
  public verifyRegistration(): Result<VerifiedPasskeyRegistration, AppError> {
    this.registrationCalls += 1;
    return this.registration ? ok(this.registration) : err(failure('registration unavailable'));
  }
  public verifyAuthentication(): Result<VerifiedPasskeyAuthentication, AppError> {
    this.authenticationCalls += 1;
    return this.authentication ? ok(this.authentication) : err(failure('authentication unavailable'));
  }
}

class FederatedVerifier implements FederatedAuthorizationCodeVerifierPort {
  public calls = 0;
  public discarded: string[] = [];
  public result?: VerifiedFederatedIdentityLink;
  public consumeVerifiedFlow(): Result<VerifiedFederatedIdentityLink, AppError> {
    this.calls += 1; return this.result ? ok(this.result) : err(failure('flow unavailable'));
  }
  public discardVaultEntry(value: string): void { this.discarded.push(value); }
}

class EnvelopePort implements TemporaryCredentialEnvelopePort {
  public readonly discarded: string[] = [];
  public readonly verifications = new Map<string, OfflineTemporaryCredentialVerification>();
  public issueCalls = 0;
  public issueAndStore(input: Parameters<TemporaryCredentialEnvelopePort['issueAndStore']>[0]): Result<StoredTemporaryCredentialEnvelope, AppError> {
    this.issueCalls += 1;
    const parsed = JSON.parse(input.canonicalDisclosureJson) as [number, string, TemporaryCredentialKind, string, string, [TemporaryCredentialClaimKey, string][], string, string];
    const qrPayload = Buffer.from(input.canonicalDisclosureJson, 'utf8').toString('base64url');
    const envelope = {
      qrPayload,
      payloadSha256: hash(qrPayload),
      signatureSha256: hash(`signature:${input.credentialId}`),
      issuerKeyId: 'issuer-key-33-p',
      issuerPublicKeySha256: hash('issuer-public-key'),
      signatureAlgorithm: 'Ed25519' as const,
      disclosureSha256: input.disclosureSha256,
      encryptedEnvelopeReference: `vault-envelope-${input.credentialId}`,
      containsOnlyCanonicalDisclosure: true as const
    };
    this.verifications.set(qrPayload, {
      credentialId: input.credentialId,
      kind: parsed[2],
      payloadSha256: envelope.payloadSha256,
      issuerPublicKeySha256: envelope.issuerPublicKeySha256,
      audienceRefSha256: parsed[4],
      notBefore: asIsoDateTime(parsed[6]),
      expiresAt: asIsoDateTime(parsed[7]),
      disclosedClaimKeys: parsed[5].map(([key]) => key),
      signatureValid: true,
      disclosureValid: true,
      audienceMatched: true,
      issuerIdentityCertified: false,
      networkUsed: false
    });
    return ok(envelope);
  }
  public discardEncryptedEnvelope(value: string): void { this.discarded.push(value); }
  public verifyOffline(payload: string, expectedAudienceRefSha256: string): Result<OfflineTemporaryCredentialVerification, AppError> {
    const value = this.verifications.get(payload); return value ? ok({ ...value,
      audienceMatched: value.audienceRefSha256 === expectedAudienceRefSha256 }) : err(failure('unknown qr'));
  }
}

const registerPasskey = async (uow: MemoryUnitOfWork, verifier: PasskeyVerifier, suffix = 'one') => {
  const challengeId = `challenge-register-${suffix}`;
  const begin = await new BeginPasskeyRegistrationUseCase(uow, { createChallenge: () => CHALLENGE }).execute({
    context: context(), relyingPartyId: 'local.pardus.test', identifiers: {
      challengeId, auditId: `audit-challenge-${suffix}`, outboxEventId: asEventId(`event-challenge-${suffix}`)
    }
  });
  expect(begin.ok).toBe(true);
  verifier.registration = {
    challengeSha256: hash(CHALLENGE), relyingPartyId: 'local.pardus.test', credentialId: `credentialRaw_${suffix}_0123456789`,
    publicKeyCoseBase64Url: `publicKeyCose_${suffix}_${'x'.repeat(32)}`, userHandleSha256: hash(`user:${suffix}`),
    transports: ['internal'], signCount: 1, backupEligible: false, backupState: false,
    attestationVerified: true, userPresent: true, userVerified: true
  };
  const resourceId = `passkey-${suffix}`;
  const operation = identifiers(resourceId, `register-${suffix}`);
  const command = { challengeId, ceremonyResponseId: `ceremony-register-${suffix}`, displayName: `Passkey ${suffix}`,
    clientOperationId: `operation-register-${suffix}`, expectedRevision: 0 } as const;
  const result = await new CompletePasskeyRegistrationUseCase(uow, verifier).execute({ context: context(), command, identifiers: operation });
  expect(result.ok).toBe(true);
  return { resourceId, operation, command, result };
};

describe('33-P identity access credential application core', () => {
  it('registers multiple locally verified passkeys, stores no private/biometric data and replays idempotently', async () => {
    const uow = new MemoryUnitOfWork(); const verifier = new PasskeyVerifier();
    const first = await registerPasskey(uow, verifier, 'one');
    await registerPasskey(uow, verifier, 'two');
    expect(uow.passkeys).toHaveLength(2);
    expect(uow.passkeys.get(first.resourceId)).toMatchObject({ privateKeyStored: false, biometricDataStored: false,
      attestationPayloadStored: false, status: 'active', securityEpoch: 7 });
    const calls = verifier.registrationCalls;
    const replay = await new CompletePasskeyRegistrationUseCase(uow, verifier).execute({ context: context(), command: first.command, identifiers: first.operation });
    expect(replay).toMatchObject({ ok: true, value: { replayed: true } });
    expect(verifier.registrationCalls).toBe(calls);
    const mismatch = await new CompletePasskeyRegistrationUseCase(uow, verifier).execute({ context: context(), command: first.command,
      identifiers: { ...first.operation, requestFingerprint: hash('different-request') } });
    expect(mismatch.ok).toBe(false);
    expect(uow.mutations).toHaveLength(2);
  });

  it('authenticates with an exact challenge, advances sign count and rejects a cloned counter', async () => {
    const uow = new MemoryUnitOfWork(); const verifier = new PasskeyVerifier();
    const registered = await registerPasskey(uow, verifier, 'auth');
    const sessionStarts: Array<[string, number]> = [];
    const session: PasskeySessionPort = { start: (accountId, epoch) => sessionStarts.push([accountId, epoch]) };
    const begin = await new BeginPasskeyAuthenticationUseCase(uow, { createChallenge: () => CHALLENGE }).execute({
      context: context(), relyingPartyId: 'local.pardus.test', identifiers: {
        challengeId: 'challenge-authentication-one', auditId: 'audit-authentication-one', outboxEventId: asEventId('event-authentication-one')
      }
    });
    expect(begin).toMatchObject({ ok: true, value: { allowedCredentialIds: [expect.stringContaining('credentialRaw_auth')] } });
    verifier.authentication = { challengeSha256: hash(CHALLENGE), credentialIdSha256: uow.passkeys.get(registered.resourceId)!.credentialIdSha256,
      signCount: 2, signatureVerified: true, userPresent: true, userVerified: true };
    const authenticated = await new AuthenticateWithPasskeyUseCase(uow, verifier, session).execute({ context: context(),
      command: { challengeId: 'challenge-authentication-one', ceremonyResponseId: 'ceremony-authentication-one',
        clientOperationId: 'operation-authentication-one', expectedRevision: 1 },
      identifiers: identifiers(registered.resourceId, 'authentication-one') });
    expect(authenticated.ok).toBe(true);
    expect(uow.passkeys.get(registered.resourceId)).toMatchObject({ revision: 2, signCount: 2, lastUsedAt: NOW });
    expect(sessionStarts).toEqual([[ACCOUNT_ID, 7]]);

    await new BeginPasskeyAuthenticationUseCase(uow, { createChallenge: () => `${CHALLENGE}B` }).execute({ context: context(), relyingPartyId: 'local.pardus.test',
      identifiers: { challengeId: 'challenge-authentication-clone', auditId: 'audit-authentication-clone', outboxEventId: asEventId('event-authentication-clone') } });
    verifier.authentication = { ...verifier.authentication, challengeSha256: hash(`${CHALLENGE}B`), signCount: 2 };
    const cloned = await new AuthenticateWithPasskeyUseCase(uow, verifier, session).execute({ context: context(),
      command: { challengeId: 'challenge-authentication-clone', ceremonyResponseId: 'ceremony-authentication-clone',
        clientOperationId: 'operation-authentication-clone', expectedRevision: 2 },
      identifiers: identifiers(registered.resourceId, 'authentication-clone') });
    expect(cloned.ok).toBe(false);
    expect(uow.passkeys.get(registered.resourceId)?.revision).toBe(2);
  });

  it('revokes a passkey and performs lost-key recovery with atomic security epoch/session invalidation', async () => {
    const uow = new MemoryUnitOfWork(); const verifier = new PasskeyVerifier();
    const manual = await registerPasskey(uow, verifier, 'manual');
    const revoked = await new RevokePasskeyUseCase(uow).execute({ context: context(),
      command: { credentialId: manual.resourceId, reason: 'manual', clientOperationId: 'operation-revoke-manual', expectedRevision: 1 },
      identifiers: identifiers(manual.resourceId, 'revoke-manual') });
    expect(revoked.ok).toBe(true);
    expect(uow.passkeys.get(manual.resourceId)).toMatchObject({ status: 'revoked', revocationReason: 'manual' });

    const lost = await registerPasskey(uow, verifier, 'lost');
    const recovery: StrongPasskeyRecoveryVerifierPort = { verify: () => ok(true) };
    const recovered = await new RecoverLostPasskeyUseCase(uow, recovery).execute({ context: context(),
      command: { credentialId: lost.resourceId, recoveryProofId: 'strong-recovery-proof', clientOperationId: 'operation-recovery-lost', expectedRevision: 1 },
      identifiers: identifiers(lost.resourceId, 'recovery-lost') });
    expect(recovered.ok).toBe(true);
    expect(uow.passkeys.get(lost.resourceId)).toMatchObject({ status: 'revoked', revocationReason: 'recovery' });
    expect(uow.securityEpoch).toBe(8);
  });

  it('keeps unconfigured federated providers invisible and persists only live-tested vault metadata', async () => {
    const uow = new MemoryUnitOfWork(); const verifier = new FederatedVerifier();
    verifier.result = { provider: 'google', configurationId: 'provider-config-google', authorizationEndpointSha256: hash('endpoint'),
      clientConfigurationSha256: hash('client'), providerSubjectSha256: hash('google-subject'), grantedScopes: ['openid', 'profile'],
      encryptedVaultEntryId: 'vault-entry-google', liveAccountTested: true, authorizationCodePkceVerified: true, stateVerified: true, nonceVerified: true };
    const command = { provider: 'google' as const, verifiedFlowId: 'verified-google-flow', clientOperationId: 'operation-link-google', expectedRevision: 0 };
    const operation = identifiers('federated-link-google', 'link-google');
    const hidden = await new LinkFederatedIdentityUseCase(uow, verifier).execute({ context: context(), command, identifiers: operation });
    expect(hidden.ok).toBe(false); expect(verifier.calls).toBe(0);

    uow.configuredProviders = [{ provider: 'google', configured: true, configurationId: 'provider-config-google',
      authorizationEndpointSha256: hash('endpoint'), clientConfigurationSha256: hash('client') }];
    const linked = await new LinkFederatedIdentityUseCase(uow, verifier).execute({ context: context(), command, identifiers: operation });
    expect(linked.ok).toBe(true);
    const center = await new GetIdentityAccessCredentialCenterUseCase(uow).execute(context());
    expect(center).toMatchObject({ ok: true, value: { federatedLinks: [{ provider: 'google', liveAccountTested: true,
      tokenBytesExposed: false, tokenStoredInEncryptedVault: true, providerAvailabilityGuaranteed: false, providerDeliveryGuaranteed: false }] } });
    expect(JSON.stringify(center)).not.toContain('vault-entry-google');
    const unlinked = await new UnlinkFederatedIdentityUseCase(uow).execute({ context: context(),
      command: { linkId: 'federated-link-google', clientOperationId: 'operation-unlink-google', expectedRevision: 1 },
      identifiers: identifiers('federated-link-google', 'unlink-google') });
    expect(unlinked.ok).toBe(true);
    expect(uow.revokedVaultEntries).toEqual(['vault-entry-google']);

    verifier.result = { ...verifier.result!, configurationId: 'provider-config-google-v2', encryptedVaultEntryId: 'vault-entry-stale' };
    const stale = await new LinkFederatedIdentityUseCase(uow, verifier).execute({ context: context(),
      command: { ...command, verifiedFlowId: 'stale-old-flow', clientOperationId: 'operation-relink-stale', expectedRevision: 2 },
      identifiers: identifiers('federated-link-google', 'relink-stale') });
    expect(stale.ok).toBe(false);
    expect(verifier.discarded).toContain('vault-entry-stale');

    verifier.result = { ...verifier.result!, configurationId: 'provider-config-google', encryptedVaultEntryId: 'vault-entry-google-fresh' };
    const relinked = await new LinkFederatedIdentityUseCase(uow, verifier).execute({ context: context(),
      command: { ...command, verifiedFlowId: 'verified-google-flow-fresh', clientOperationId: 'operation-relink-google', expectedRevision: 2 },
      identifiers: identifiers('federated-link-google', 'relink-google') });
    expect(relinked.ok).toBe(true);
    expect(uow.links.get('federated-link-google')).toMatchObject({ status: 'linked', revision: 3,
      encryptedVaultEntryId: 'vault-entry-google-fresh', configurationId: 'provider-config-google' });
  });

  it('begins only configured Authorization Code + PKCE + state + nonce ceremonies without availability claims', async () => {
    const uow = new MemoryUnitOfWork(); let calls = 0; const discarded: string[] = [];
    const ceremony: FederatedAuthorizationCeremonyPort = {
      createAndStore: ({ flowId, provider }) => {
        calls += 1;
        return ok({ flowId, provider, authorizationUrl: 'https://accounts.example.test/authorize?response_type=code&code_challenge=abc',
          expiresAt: asIsoDateTime('2026-08-14T08:05:00.000Z'), responseType: 'code', pkceMethod: 'S256',
          stateBound: true, nonceBound: true, codeVerifierStoredInEncryptedVault: true, codeVerifierExposed: false,
          tokenBytesExposed: false, providerAvailabilityGuaranteed: false, providerDeliveryGuaranteed: false });
      },
      discardCeremony: (flowId) => discarded.push(flowId)
    };
    const useCase = new BeginFederatedIdentityLinkUseCase(uow, ceremony);
    const ids = { flowId: 'federated-flow-microsoft', auditId: 'audit-flow-microsoft', outboxEventId: asEventId('event-flow-microsoft') };
    const hidden = await useCase.execute({ context: context(), provider: 'microsoft', identifiers: ids });
    expect(hidden.ok).toBe(false); expect(calls).toBe(0);
    uow.configuredProviders = [{ provider: 'microsoft', configured: true, configurationId: 'provider-config-microsoft',
      authorizationEndpointSha256: hash('endpoint-microsoft'), clientConfigurationSha256: hash('client-microsoft') }];
    const started = await useCase.execute({ context: context(), provider: 'microsoft', identifiers: ids });
    expect(started).toMatchObject({ ok: true, value: { responseType: 'code', pkceMethod: 'S256', stateBound: true,
      nonceBound: true, codeVerifierExposed: false, tokenBytesExposed: false,
      providerAvailabilityGuaranteed: false, providerDeliveryGuaranteed: false } });
    expect(discarded).toEqual([]);
  });

  it.each([
    ['configuration id', { configurationId: 'reused-foreign-id' }],
    ['authorization endpoint hash', { authorizationEndpointSha256: hash('foreign-endpoint') }],
    ['client configuration hash', { clientConfigurationSha256: hash('foreign-client') }]
  ])('fails closed on verified-flow %s drift and revokes the new vault entry', async (_label, override) => {
    const uow = new MemoryUnitOfWork(); const verifier = new FederatedVerifier();
    const slug = String(_label).replaceAll(' ', '-');
    uow.configuredProviders = [{ provider: 'google', configured: true, configurationId: 'provider-config-google',
      authorizationEndpointSha256: hash('endpoint'), clientConfigurationSha256: hash('client') }];
    verifier.result = { provider: 'google', configurationId: 'provider-config-google', authorizationEndpointSha256: hash('endpoint'),
      clientConfigurationSha256: hash('client'), providerSubjectSha256: hash('subject'), grantedScopes: ['openid'],
      encryptedVaultEntryId: `vault-${slug}`, liveAccountTested: true,
      authorizationCodePkceVerified: true, stateVerified: true, nonceVerified: true, ...override };
    const result = await new LinkFederatedIdentityUseCase(uow, verifier).execute({ context: context(),
      command: { provider: 'google', verifiedFlowId: 'verified-flow', clientOperationId: `operation-${slug}`, expectedRevision: 0 },
      identifiers: identifiers(`link-${slug}`, `drift-${slug}`) });
    expect(result.ok).toBe(false);
    expect(uow.links).toHaveLength(0);
    expect(verifier.discarded).toEqual([verifier.result.encryptedVaultEntryId]);
  });

  it('compensates the encrypted token vault when the central transaction rolls back', async () => {
    const uow = new MemoryUnitOfWork(); const verifier = new FederatedVerifier();
    uow.configuredProviders = [{ provider: 'apple', configured: true, configurationId: 'provider-config-apple',
      authorizationEndpointSha256: hash('endpoint-apple'), clientConfigurationSha256: hash('client-apple') }];
    verifier.result = { provider: 'apple', configurationId: 'provider-config-apple', authorizationEndpointSha256: hash('endpoint-apple'),
      clientConfigurationSha256: hash('client-apple'), providerSubjectSha256: hash('apple-subject'), grantedScopes: ['openid'],
      encryptedVaultEntryId: 'vault-entry-apple', liveAccountTested: true, authorizationCodePkceVerified: true, stateVerified: true, nonceVerified: true };
    uow.failAudit = true;
    const result = await new LinkFederatedIdentityUseCase(uow, verifier).execute({ context: context(),
      command: { provider: 'apple', verifiedFlowId: 'verified-apple-flow', clientOperationId: 'operation-link-apple', expectedRevision: 0 },
      identifiers: identifiers('federated-link-apple', 'link-apple') });
    expect(result.ok).toBe(false);
    expect(uow.links).toHaveLength(0);
    expect(uow.mutations).toHaveLength(0);
    expect(verifier.discarded).toEqual(['vault-entry-apple']);
  });

  it('issues bounded minimum-disclosure QR credentials, verifies expiry/revocation and never claims remote freshness', async () => {
    const uow = new MemoryUnitOfWork(); const envelope = new EnvelopePort();
    const issued = await new IssueTemporaryVerifiableCredentialUseCase(uow, envelope).execute({ context: context(),
      command: { kind: 'school_pickup', purpose: 'school_pickup_authorization', audienceReference: 'authorized-person-33-p', disclosedClaims: [
        { key: 'subject_display_name', value: 'Çocuk A' }, { key: 'authorized_person_display_name', value: 'Veli B' }
      ], notBefore: NOW, expiresAt: TOMORROW, clientOperationId: 'operation-issue-school', expectedRevision: 0 },
      identifiers: identifiers('temporary-credential-school', 'issue-school') });
    expect(issued).toMatchObject({ ok: true, value: { receipt: { replayed: false }, issued: {
      containsOnlySelectedClaims: true, privateSigningKeyExposed: false, networkDeliveryGuaranteed: false,
      credential: { qrPayloadBytes: expect.any(Number), minimumDisclosureEnforced: true, remoteRevocationFreshnessGuaranteed: false }
    } } });
    if (!issued.ok || !issued.value.issued) return;
    expect(issued.value.issued.qrPayloadBytes).toBeLessThanOrEqual(4_096);
    expect(JSON.stringify(uow.temporary.get('temporary-credential-school'))).not.toContain('Çocuk A');
    const verified = await new VerifyTemporaryVerifiableCredentialUseCase(uow, envelope).execute({ context: context(),
      command: { qrPayload: issued.value.issued.qrPayload, expectedAudienceReference: 'authorized-person-33-p' } });
    expect(verified).toMatchObject({ ok: true, value: { decision: 'accepted_locally', revocationStatus: 'not_revoked_locally',
      audienceMatched: true, issuerIdentityCertified: false, networkUsed: false, remoteRevocationFreshnessGuaranteed: false } });
    const wrongAudience = await new VerifyTemporaryVerifiableCredentialUseCase(uow, envelope).execute({ context: context(),
      command: { qrPayload: issued.value.issued.qrPayload, expectedAudienceReference: 'foreign-audience' } });
    expect(wrongAudience).toMatchObject({ ok: true, value: { decision: 'rejected', audienceMatched: false } });
    const localVerification = envelope.verifications.get(issued.value.issued.qrPayload)!;
    envelope.verifications.set(issued.value.issued.qrPayload, { ...localVerification, issuerPublicKeySha256: hash('foreign-issuer') });
    const foreignIssuer = await new VerifyTemporaryVerifiableCredentialUseCase(uow, envelope).execute({ context: context(),
      command: { qrPayload: issued.value.issued.qrPayload, expectedAudienceReference: 'authorized-person-33-p' } });
    expect(foreignIssuer).toMatchObject({ ok: true, value: { decision: 'indeterminate_issuer', issuerIdentityCertified: false } });
    envelope.verifications.set(issued.value.issued.qrPayload, localVerification);

    const invalidDisclosure = await new IssueTemporaryVerifiableCredentialUseCase(uow, envelope).execute({ context: context(),
      command: { kind: 'school_pickup', purpose: 'school_pickup_authorization', audienceReference: 'authorized-person-33-p', disclosedClaims: [
        { key: 'subject_display_name', value: 'Çocuk' }, { key: 'authorized_person_display_name', value: 'Veli' },
        { key: 'allergy_summary', value: 'Gereksiz sağlık verisi' }
      ], notBefore: NOW, expiresAt: TOMORROW, clientOperationId: 'operation-issue-invalid', expectedRevision: 0 },
      identifiers: identifiers('temporary-credential-invalid', 'issue-invalid') });
    expect(invalidDisclosure.ok).toBe(false);
    const wrongPurpose = await new IssueTemporaryVerifiableCredentialUseCase(uow, envelope).execute({ context: context(),
      command: { kind: 'school_pickup', purpose: 'event_invitation_access', audienceReference: 'authorized-person-33-p', disclosedClaims: [
        { key: 'subject_display_name', value: 'Cocuk' }, { key: 'authorized_person_display_name', value: 'Veli' }
      ], notBefore: NOW, expiresAt: TOMORROW, clientOperationId: 'operation-issue-wrong-purpose', expectedRevision: 0 },
      identifiers: identifiers('temporary-credential-wrong-purpose', 'issue-wrong-purpose') });
    expect(wrongPurpose.ok).toBe(false);

    const revoked = await new RevokeTemporaryVerifiableCredentialUseCase(uow).execute({ context: context(),
      command: { credentialId: 'temporary-credential-school', reason: 'Yetki geri alındı', clientOperationId: 'operation-revoke-school', expectedRevision: 1 },
      identifiers: identifiers('temporary-credential-school', 'revoke-school') });
    expect(revoked.ok).toBe(true);
    const afterRevocation = await new VerifyTemporaryVerifiableCredentialUseCase(uow, envelope).execute({ context: context(),
      command: { qrPayload: issued.value.issued.qrPayload, expectedAudienceReference: 'authorized-person-33-p' } });
    expect(afterRevocation).toMatchObject({ ok: true, value: { decision: 'rejected', revocationStatus: 'revoked_locally' } });
    envelope.verifications.set(issued.value.issued.qrPayload, {
      ...envelope.verifications.get(issued.value.issued.qrPayload)!,
      expiresAt: asIsoDateTime('2026-08-13T08:00:00.000Z')
    });
    const expired = await new VerifyTemporaryVerifiableCredentialUseCase(uow, envelope).execute({ context: context(),
      command: { qrPayload: issued.value.issued.qrPayload, expectedAudienceReference: 'authorized-person-33-p' } });
    expect(expired).toMatchObject({ ok: true, value: { decision: 'rejected', expired: true } });
  });

  it('cleans an issued encrypted QR envelope when audit/outbox persistence fails', async () => {
    const uow = new MemoryUnitOfWork(); const envelope = new EnvelopePort(); uow.failAudit = true;
    const result = await new IssueTemporaryVerifiableCredentialUseCase(uow, envelope).execute({ context: context(),
      command: { kind: 'event_invitation', purpose: 'event_invitation_access', audienceReference: 'guest-33-p', disclosedClaims: [
        { key: 'subject_display_name', value: 'Misafir' }, { key: 'event_title', value: 'Aile Etkinliği' }
      ], notBefore: NOW, expiresAt: TOMORROW, clientOperationId: 'operation-issue-rollback', expectedRevision: 0 },
      identifiers: identifiers('temporary-credential-rollback', 'issue-rollback') });
    expect(result.ok).toBe(false);
    expect(uow.temporary).toHaveLength(0);
    expect(uow.mutations).toHaveLength(0);
    expect(envelope.discarded).toEqual(['vault-envelope-temporary-credential-rollback']);
  });

  it('enforces Windows single-writer companion sync, conflicts and trusted-device revocation before envelope creation', async () => {
    const uow = new MemoryUnitOfWork(); let creates = 0;
    const snapshotPort: EncryptedCompanionSnapshotPort = { create: (input) => {
      expect(input.snapshot).toMatchObject({ sourceVersion: input.sourceVersion, schemaVersion: 1,
        sourceAuthority: 'windows_single_writer', remoteWritesAccepted: false });
      expect(JSON.stringify(input.snapshot)).not.toMatch(/credentialId|publicKeyCose|userHandle|providerSubject|vault|qrPayload|audienceRef|token|privateKey/iu);
      creates += 1; const envelope = Buffer.from(`encrypted:${input.sourceVersion}`).toString('base64url');
      return ok({ encryptedEnvelopeBase64Url: envelope, ciphertextSha256: hash('ciphertext'), envelopeSha256: hash(envelope),
        sourceVersion: input.sourceVersion, schemaVersion: input.schemaVersion, expiresAt: TOMORROW });
    } };
    const useCase = new CreateReadOnlyCompanionSnapshotUseCase(uow, snapshotPort);
    const ids = { snapshotId: 'companion-snapshot-one', auditId: 'audit-companion-one', outboxEventId: asEventId('event-companion-one') };
    const write = await useCase.execute({ context: context(), command: { trustedDeviceId: 'trusted-device-companion', requestedMode: 'write' }, identifiers: ids });
    expect(write).toMatchObject({ ok: true, value: { status: 'write_forbidden', remoteWritesAccepted: false } });
    const conflictResult = await useCase.execute({ context: context(), command: { trustedDeviceId: 'trusted-device-companion', requestedMode: 'read_only', knownSourceVersion: 3 }, identifiers: ids });
    expect(conflictResult).toMatchObject({ ok: true, value: { status: 'version_conflict', currentSourceVersion: 4 } });
    uow.trustedDeviceRevoked = true;
    const revoked = await useCase.execute({ context: context(), command: { trustedDeviceId: 'trusted-device-companion', requestedMode: 'read_only' }, identifiers: ids });
    expect(revoked).toMatchObject({ ok: true, value: { status: 'device_revoked' } });
    expect(creates).toBe(0);
    uow.trustedDeviceRevoked = false;
    const ready = await useCase.execute({ context: context(), command: { trustedDeviceId: 'trusted-device-companion', requestedMode: 'read_only', knownSourceVersion: 4 }, identifiers: ids });
    expect(ready).toMatchObject({ ok: true, value: { status: 'snapshot_ready', sourceAuthority: 'windows_single_writer',
      encrypted: true, readOnly: true, remoteWritesAccepted: false, networkDeliveryGuaranteed: false } });
    expect(creates).toBe(1);
    expect(uow.snapshots).toHaveLength(1);
  });
});
