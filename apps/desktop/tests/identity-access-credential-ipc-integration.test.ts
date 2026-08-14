import { describe, expect, it } from 'vitest';
import {
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy
} from '../src/main/ipc-integration-policy.js';
import {
  IpcRequestLifecycleRegistry,
  resolveIpcRequestAdmissionPolicy,
  resolveIpcRequestLifecyclePolicy,
  resolveIpcRequestRatePolicy
} from '../src/main/ipc-request-lifecycle.js';
import { evaluateIpcPayloadSecurity } from '../src/main/ipc-payload-security.js';
import { createZeroIpcTransportRevisions } from '../src/main/ipc-transport-context.js';

const occurredAt = '2026-08-14T08:00:00.000Z';
const expiresAt = '2026-08-14T09:00:00.000Z';
const sha = 'a'.repeat(64);
const key = { familyId: 'family-main', accountId: 'account-main', ownerPersonId: 'person-main' } as const;
const registrationResponse = {
  credentialId: 'Y3JlZGVudGlhbC0x',
  clientDataJsonBase64url: 'Y2xpZW50LWRhdGE',
  attestationObjectBase64url: 'YXR0ZXN0YXRpb24',
  transports: ['internal']
} as const;
const authenticationResponse = {
  credentialId: 'Y3JlZGVudGlhbC0x',
  clientDataJsonBase64url: 'Y2xpZW50LWRhdGE',
  authenticatorDataBase64url: 'YXV0aGVudGljYXRvcg',
  signatureBase64url: 'c2lnbmF0dXJl'
} as const;
const qrPayload = `pptvc1.${'a'.repeat(96)}.${'b'.repeat(86)}`;

const channels = [
  'identityAccess:getCenter',
  'identityAccess:issueOperationToken',
  'identityAccess:beginPasskeyRegistration',
  'identityAccess:beginPasskeyAuthentication',
  'identityAccess:completePasskeyRegistration',
  'identityAccess:authenticateWithPasskey',
  'identityAccess:revokePasskey',
  'identityAccess:recoverLostPasskey',
  'identityAccess:beginFederatedIdentityLink',
  'identityAccess:completeFederatedIdentityLink',
  'identityAccess:unlinkFederatedIdentity',
  'identityAccess:issueTemporaryCredential',
  'identityAccess:revokeTemporaryCredential',
  'identityAccess:verifyTemporaryCredential',
  'identityAccess:createCompanionSnapshot'
] as const;
const reads = new Set(['identityAccess:getCenter', 'identityAccess:verifyTemporaryCredential']);

const operation = (suffix: string, expectedRevision = 0) => ({
  expectedRevision,
  clientOperationId: `operation-${suffix}`
});

const acceptedInputs: Readonly<Record<(typeof channels)[number], readonly unknown[]>> = {
  'identityAccess:getCenter': [],
  'identityAccess:issueOperationToken': [{ operationKind: 'passkey_register' }],
  'identityAccess:beginPasskeyRegistration': [{ clientOperationId: 'operation-passkey-registration-begin' }],
  'identityAccess:beginPasskeyAuthentication': [{ clientOperationId: 'operation-passkey-authentication-begin' }],
  'identityAccess:completePasskeyRegistration': [{
    ...operation('passkey-registration'),
    challengeId: 'challenge-registration',
    displayName: 'Bu cihaz',
    response: registrationResponse,
    confirmation: 'PASSKEY KAYDINI TAMAMLA'
  }],
  'identityAccess:authenticateWithPasskey': [{
    ...operation('passkey-authentication', 1),
    credentialId: 'passkey-credential-1',
    challengeId: 'challenge-authentication',
    response: authenticationResponse,
    confirmation: 'PASSKEY ILE DOGRULA'
  }],
  'identityAccess:revokePasskey': [{
    ...operation('passkey-revoke', 2), credentialId: 'passkey-credential-1', reason: 'lost',
    confirmation: 'PASSKEY YETKISINI IPTAL ET'
  }],
  'identityAccess:recoverLostPasskey': [{
    ...operation('passkey-recovery', 2), credentialId: 'passkey-credential-1',
    fallback: { password: 'Strong-local-password', secondFactorCode: '123456' },
    confirmation: 'KAYIP PASSKEY KURTARMASINI BASLAT'
  }],
  'identityAccess:beginFederatedIdentityLink': [{ clientOperationId: 'operation-federated-begin', provider: 'google' }],
  'identityAccess:completeFederatedIdentityLink': [{
    ...operation('federated-complete'), provider: 'google', flowId: 'federated-flow-1',
    confirmation: 'FEDERATED KIMLIGI BAGLA'
  }],
  'identityAccess:unlinkFederatedIdentity': [{
    ...operation('federated-unlink', 1), linkId: 'federated-link-1', confirmation: 'FEDERATED KIMLIK BAGINI KALDIR'
  }],
  'identityAccess:issueTemporaryCredential': [{
    ...operation('temporary-issue'), kind: 'school_pickup', purpose: 'school_pickup_authorization',
    audienceReference: 'Ankara Okulu',
    disclosedClaims: [
      { key: 'subject_display_name', value: 'Ada' },
      { key: 'authorized_person_display_name', value: 'Deniz' }
    ],
    notBefore: occurredAt, expiresAt, confirmation: 'GECICI YETKI BELGESI OLUSTUR'
  }],
  'identityAccess:revokeTemporaryCredential': [{
    ...operation('temporary-revoke', 1), credentialId: 'temporary-credential-1', reason: 'Yerel iptal',
    confirmation: 'GECICI YETKI BELGESINI IPTAL ET'
  }],
  'identityAccess:verifyTemporaryCredential': [{ qrPayload, expectedAudienceReference: 'authorized-person-33-p' }],
  'identityAccess:createCompanionSnapshot': [{
    clientOperationId: 'operation-companion-snapshot', trustedDeviceId: 'trusted-device-1',
    requestedMode: 'read_only', knownSourceVersion: 4, confirmation: 'SALT OKUNUR ESLIKCI KOPYASI OLUSTUR'
  }]
};

const receipt = (
  mutationKind: string,
  resourceType: string,
  resourceId: string,
  previousRevision = 0,
  replayed = false
) => ({
  clientOperationId: `receipt-operation-${mutationKind}`,
  mutationKind,
  resourceType,
  resourceId,
  previousRevision,
  revision: previousRevision + 1,
  stateFingerprint: sha,
  occurredAt,
  replayed
});

const passkey = {
  id: 'passkey-credential-1', key, revision: 1, displayName: 'Bu cihaz',
  credentialIdSha256: sha, publicKeySha256: sha, relyingPartyId: 'app.example', transports: ['internal'],
  signCount: 1, backupEligible: false, backupState: false, trustedDeviceId: 'trusted-device-1', securityEpoch: 1,
  status: 'active', createdAt: occurredAt, privateKeyStored: false, biometricDataStored: false,
  attestationPayloadStored: false
} as const;
const federatedLink = {
  id: 'federated-link-1', key, revision: 1, provider: 'google', providerSubjectSha256: sha,
  grantedScopes: ['openid'], status: 'linked', liveAccountTested: true, authorizationCodePkceVerified: true,
  stateVerified: true, nonceVerified: true, tokenBytesExposed: false, tokenStoredInEncryptedVault: true,
  providerAvailabilityGuaranteed: false, providerDeliveryGuaranteed: false, linkedAt: occurredAt,
  lastLocallyVerifiedAt: occurredAt
} as const;
const temporaryCredential = {
  id: 'temporary-credential-1', key, revision: 1, kind: 'school_pickup', purpose: 'school_pickup_authorization',
  audienceRefSha256: sha, disclosedClaimKeys: ['subject_display_name', 'authorized_person_display_name'],
  disclosureSha256: sha, payloadSha256: sha, signatureSha256: sha, issuerKeyId: sha,
  issuerPublicKeySha256: sha, signatureAlgorithm: 'Ed25519', qrPayloadBytes: new TextEncoder().encode(qrPayload).byteLength,
  status: 'active', notBefore: occurredAt, expiresAt, issuedAt: occurredAt, encryptedEnvelopeStored: true,
  offlineSignatureVerifiable: true, expiryOfflineVerifiable: true, minimumDisclosureEnforced: true,
  networkDeliveryGuaranteed: false, remoteRevocationFreshnessGuaranteed: false
} as const;
const companionMetadata = {
  id: 'companion-snapshot-1', key, trustedDeviceId: 'trusted-device-1', protocolVersion: 1,
  sourceVersion: 4, schemaVersion: 1, ciphertextSha256: sha, envelopeSha256: sha, envelopeBytes: 8,
  securityEpoch: 1, generatedAt: occurredAt, expiresAt, sourceAuthority: 'windows_single_writer', encrypted: true,
  readOnly: true, remoteWritesAccepted: false, conflictResolution: 'reject_remote_and_refresh',
  networkDeliveryGuaranteed: false
} as const;
const truth = {
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
} as const;
const center = {
  schemaVersion: 1, key, passkeys: [passkey], federatedLinks: [federatedLink],
  temporaryCredentials: [temporaryCredential], companionSnapshots: [companionMetadata], truth, generatedAt: occurredAt
} as const;
const registrationChallenge = {
  challengeId: 'challenge-registration', challenge: 'A'.repeat(43), purpose: 'passkey_registration',
  relyingPartyId: 'app.example', expiresAt, userVerification: 'required', residentKey: 'preferred',
  privateKeyLeavesAuthenticator: false, biometricDataRequestedByApplication: false, allowedCredentialIds: []
} as const;
const authenticationChallenge = {
  ...registrationChallenge, challengeId: 'challenge-authentication', purpose: 'passkey_authentication',
  allowedCredentialIds: ['Y3JlZGVudGlhbC0x']
} as const;
const federatedCeremony = {
  flowId: 'federated-flow-1', provider: 'google',
  authorizationUrl: `https://accounts.example/authorize?response_type=code&state=${'a'.repeat(32)}&nonce=${'b'.repeat(32)}&code_challenge=${'c'.repeat(43)}&code_challenge_method=S256`,
  expiresAt, responseType: 'code', pkceMethod: 'S256', stateBound: true, nonceBound: true,
  codeVerifierStoredInEncryptedVault: true, codeVerifierExposed: false, tokenBytesExposed: false,
  providerAvailabilityGuaranteed: false, providerDeliveryGuaranteed: false
} as const;

describe('33-P identity access credential IPC boundary', () => {
  it('accepts all 15 exact renderer inputs and fails closed for unknown channels', () => {
    for (const channel of channels) {
      expect(evaluateIpcIntegrationPolicy(channel, acceptedInputs[channel]), channel).toEqual({ accepted: true });
    }
    expect(evaluateIpcIntegrationPolicy('identityAccess:future', [])).toMatchObject({
      accepted: false, reason: 'UNKNOWN_IPC_CHANNEL'
    });
  });

  it('pins operation-token issuance kinds and the exact 160-character wire boundary', () => {
    expect(evaluateIpcIntegrationPolicy('identityAccess:issueOperationToken', [{ operationKind: 'passkey_register' }])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('identityAccess:issueOperationToken', [{ operationKind: 'future_mutation' }])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('identityAccess:issueOperationToken', [{ operationKind: 'passkey_register', accountId: 'forged' }])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('identityAccess:beginPasskeyRegistration', [{ clientOperationId: 'a'.repeat(160) }])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('identityAccess:beginPasskeyRegistration', [{ clientOperationId: 'a'.repeat(161) }])).toMatchObject({ accepted: false });
  });

  it('never accepts renderer-authored verification receipts or main-only proof identifiers', () => {
    const registration = acceptedInputs['identityAccess:completePasskeyRegistration'][0] as Record<string, unknown>;
    const authentication = acceptedInputs['identityAccess:authenticateWithPasskey'][0] as Record<string, unknown>;
    const federated = acceptedInputs['identityAccess:completeFederatedIdentityLink'][0] as Record<string, unknown>;
    const recovery = acceptedInputs['identityAccess:recoverLostPasskey'][0] as Record<string, unknown>;
    expect(evaluateIpcIntegrationPolicy('identityAccess:completePasskeyRegistration', [{ ...registration, ceremonyResponseId: 'forged-response-1' }])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('identityAccess:authenticateWithPasskey', [{ ...authentication, ceremonyResponseId: 'forged-response-2' }])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('identityAccess:completeFederatedIdentityLink', [{ ...federated, verifiedFlowId: 'federated-flow-1' }])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('identityAccess:recoverLostPasskey', [{ ...recovery, recoveryProofId: 'forged-proof-1' }])).toMatchObject({ accepted: false });
  });

  it('rejects nested unknowns, forged prototypes, secrets, paths, PAN values and oversized payloads', () => {
    const registration = acceptedInputs['identityAccess:completePasskeyRegistration'][0] as Record<string, unknown>;
    expect(evaluateIpcIntegrationPolicy('identityAccess:completePasskeyRegistration', [{
      ...registration, response: { ...registrationResponse, unknown: true }
    }])).toMatchObject({ accepted: false });
    const forgedResponse = Object.assign(Object.create({ inheritedSecret: 'x' }) as Record<string, unknown>, registrationResponse);
    expect(evaluateIpcIntegrationPolicy('identityAccess:completePasskeyRegistration', [{ ...registration, response: forgedResponse }]))
      .toMatchObject({ accepted: false, reason: 'NON_PLAIN_OBJECT_REJECTED' });
    expect(evaluateIpcIntegrationPolicy('identityAccess:completePasskeyRegistration', [{ ...registration, privateKey: 'raw-private-key' }]))
      .toMatchObject({ accepted: false, reason: 'CREDENTIAL_FIELD_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('identityAccess:completePasskeyRegistration', [{ ...registration, destinationPath: 'C:\\private\\credential.bin' }]))
      .toMatchObject({ accepted: false, reason: 'PATH_FIELD_PROHIBITED' });

    const issue = acceptedInputs['identityAccess:issueTemporaryCredential'][0] as Record<string, unknown>;
    expect(evaluateIpcIntegrationPolicy('identityAccess:issueTemporaryCredential', [{
      ...issue,
      disclosedClaims: [...(issue.disclosedClaims as readonly unknown[]), { key: 'contact_phone', value: '4111111111111111' }]
    }])).toMatchObject({ accepted: false, reason: 'BANKING_SECRET_VALUE_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('identityAccess:issueTemporaryCredential', [{ ...issue, audienceReference: 'C:\\private\\audience.txt' }]))
      .toMatchObject({ accepted: false, reason: 'PATH_VALUE_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('identityAccess:issueTemporaryCredential', [{
      ...issue, unknown: ['x'.repeat(30_000), 'y'.repeat(30_000), 'z'.repeat(30_000)]
    }])).toMatchObject({ accepted: false, reason: 'IDENTITY_ACCESS_PAYLOAD_TOO_LARGE' });
    expect(evaluateIpcPayloadSecurity([{ safe: { constructor: 'pollute' } }]))
      .toMatchObject({ accepted: false, reason: 'FORBIDDEN_KEY_REJECTED' });
  });

  it('enforces minimum disclosure, exact revisions, main-only callbacks and bounded QR compact payloads', () => {
    const issue = acceptedInputs['identityAccess:issueTemporaryCredential'][0] as Record<string, unknown>;
    expect(evaluateIpcIntegrationPolicy('identityAccess:issueTemporaryCredential', [{
      ...issue, disclosedClaims: [{ key: 'subject_display_name', value: 'Ada' }]
    }])).toMatchObject({ accepted: false, reason: 'IDENTITY_ACCESS_TEMPORARY_CLAIMS_INVALID' });
    const authentication = acceptedInputs['identityAccess:authenticateWithPasskey'][0] as Record<string, unknown>;
    for (const expectedRevision of [-1, 0.5, 2_147_483_647]) {
      expect(evaluateIpcIntegrationPolicy('identityAccess:authenticateWithPasskey', [{ ...authentication, expectedRevision }]))
        .toMatchObject({ accepted: false });
    }
    const federated = acceptedInputs['identityAccess:completeFederatedIdentityLink'][0] as Record<string, unknown>;
    expect(evaluateIpcIntegrationPolicy('identityAccess:completeFederatedIdentityLink', [{
      ...federated, callbackUrl: 'file:///C:/private/callback?code=x&state=y'
    }])).toMatchObject({ accepted: false, reason: 'PATH_VALUE_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('identityAccess:verifyTemporaryCredential', [{ qrPayload: `pptvc1.${'a'.repeat(4_100)}.b` }]))
      .toMatchObject({ accepted: false });
  });

  it('accepts exact safe results for metadata, ceremonies, receipts, offline verification and read-only snapshots', () => {
    const mutationResults = {
      'identityAccess:completePasskeyRegistration': receipt('passkey_register', 'passkey_credential', 'passkey-credential-1'),
      'identityAccess:authenticateWithPasskey': receipt('passkey_authenticate', 'passkey_credential', 'passkey-credential-1', 1),
      'identityAccess:revokePasskey': receipt('passkey_revoke', 'passkey_credential', 'passkey-credential-1', 2),
      'identityAccess:recoverLostPasskey': receipt('passkey_recover_lost', 'passkey_credential', 'passkey-credential-1', 2),
      'identityAccess:completeFederatedIdentityLink': receipt('federated_link', 'federated_identity_link', 'federated-flow-1'),
      'identityAccess:unlinkFederatedIdentity': receipt('federated_unlink', 'federated_identity_link', 'federated-link-1', 1),
      'identityAccess:revokeTemporaryCredential': receipt('temporary_credential_revoke', 'temporary_verifiable_credential', 'temporary-credential-1', 1)
    } as const;
    expect(evaluateIpcIntegrationResultPolicy('identityAccess:getCenter', center)).toEqual({ accepted: true });
    const issuedAtSeconds=Math.floor(Date.parse(occurredAt)/1_000);const operationExpiresAt=new Date((issuedAtSeconds+86_400)*1_000).toISOString();
    expect(evaluateIpcIntegrationResultPolicy('identityAccess:issueOperationToken', {
      clientOperationId:`iat1.${issuedAtSeconds.toString(36)}.${(issuedAtSeconds+86_400).toString(36)}.${'a'.repeat(22)}.${'b'.repeat(86)}`,
      operationKind:'passkey_register',issuedAt:occurredAt,expiresAt:operationExpiresAt
    })).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationResultPolicy('identityAccess:beginPasskeyRegistration', registrationChallenge)).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationResultPolicy('identityAccess:beginPasskeyAuthentication', authenticationChallenge)).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationResultPolicy('identityAccess:beginFederatedIdentityLink', federatedCeremony)).toEqual({ accepted: true });
    for (const [channel, result] of Object.entries(mutationResults)) {
      expect(evaluateIpcIntegrationResultPolicy(channel, result), channel).toEqual({ accepted: true });
    }
    const issueReceipt = receipt('temporary_credential_issue', 'temporary_verifiable_credential', 'temporary-credential-1');
    expect(evaluateIpcIntegrationResultPolicy('identityAccess:issueTemporaryCredential', {
      receipt: issueReceipt,
      issued: {
        credential: temporaryCredential, qrPayload, qrPayloadBytes: new TextEncoder().encode(qrPayload).byteLength,
        containsOnlySelectedClaims: true, privateSigningKeyExposed: false, networkDeliveryGuaranteed: false
      }
    })).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationResultPolicy('identityAccess:issueTemporaryCredential', {
      receipt: { ...issueReceipt, replayed: true }
    })).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationResultPolicy('identityAccess:verifyTemporaryCredential', {
      credentialId: 'temporary-credential-1', signatureValid: true, notYetValid: false, expired: false,
      disclosureValid: true, revocationStatus: 'not_revoked_locally', decision: 'accepted_locally', verifiedAt: occurredAt,
      audienceMatched: true, issuerIdentityCertified: false,
      offlineSignatureVerified: true, networkUsed: false, remoteRevocationFreshnessGuaranteed: false,
      providerDeliveryGuaranteed: false, disclosedClaimKeys: ['subject_display_name', 'authorized_person_display_name']
    })).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationResultPolicy('identityAccess:createCompanionSnapshot', {
      ...companionMetadata, status: 'snapshot_ready', encryptedEnvelopeBase64Url: 'ZW52ZWxvcGU'
    })).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationResultPolicy('identityAccess:createCompanionSnapshot', {
      status: 'write_forbidden', currentSourceVersion: 4, sourceAuthority: 'windows_single_writer',
      remoteWritesAccepted: false, conflictResolution: 'reject_remote_and_refresh', networkDeliveryGuaranteed: false
    })).toEqual({ accepted: true });
  });

  it('rejects unsafe results, raw key/token/path fields, PAN values, forged objects and unknown result channels', () => {
    const passkeyReceipt = receipt('passkey_register', 'passkey_credential', 'passkey-credential-1');
    expect(evaluateIpcIntegrationResultPolicy('identityAccess:completePasskeyRegistration', { ...passkeyReceipt, privateKey: 'raw' }))
      .toMatchObject({ accepted: false, reason: 'CREDENTIAL_FIELD_PROHIBITED' });
    expect(evaluateIpcIntegrationResultPolicy('identityAccess:getCenter', {
      ...center, passkeys: [{ ...passkey, credentialId: 'Y3JlZGVudGlhbC0x' }]
    })).toMatchObject({ accepted: false, reason: 'IDENTITY_ACCESS_RESULT_INVALID' });
    expect(evaluateIpcIntegrationResultPolicy('identityAccess:beginFederatedIdentityLink', { ...federatedCeremony, accessToken: 'raw-token' }))
      .toMatchObject({ accepted: false, reason: 'CREDENTIAL_FIELD_PROHIBITED' });
    expect(evaluateIpcIntegrationResultPolicy('identityAccess:createCompanionSnapshot', {
      ...companionMetadata, status: 'snapshot_ready', encryptedEnvelopeBase64Url: 'ZW52ZWxvcGU', absolutePath: 'C:\\private\\snapshot.bin'
    })).toMatchObject({ accepted: false, reason: 'PATH_FIELD_PROHIBITED' });
    expect(evaluateIpcIntegrationResultPolicy('identityAccess:getCenter', {
      ...center, passkeys: [{ ...passkey, displayName: '4111111111111111' }]
    })).toMatchObject({ accepted: false, reason: 'BANKING_SECRET_VALUE_PROHIBITED' });
    const forgedTruth = Object.assign(Object.create({ privateKey: 'raw' }) as Record<string, unknown>, truth);
    expect(evaluateIpcIntegrationResultPolicy('identityAccess:getCenter', { ...center, truth: forgedTruth }))
      .toMatchObject({ accepted: false, reason: 'NON_PLAIN_OBJECT_REJECTED' });
    expect(evaluateIpcIntegrationResultPolicy('identityAccess:future', {}))
      .toMatchObject({ accepted: false, reason: 'UNKNOWN_IPC_CHANNEL' });
  });

  it('applies bounded admission and distinct read/write lifecycle and rate policies to every channel', () => {
    for (const channel of channels) {
      expect(resolveIpcRequestAdmissionPolicy(channel)).toMatchObject({
        enabled: true, priority: 'interactive', maxConcurrentPerSender: 2, maxConcurrentPerChannel: 1,
        maxQueuedPerSender: 4, queueTimeoutMs: 2_500
      });
      if (reads.has(channel)) {
        expect(resolveIpcRequestLifecyclePolicy(channel)).toEqual({ cancellable: true, latestWins: true, timeoutMs: 10_000 });
        expect(resolveIpcRequestRatePolicy(channel)).toEqual({ enabled: true, maxRequestsPerWindow: 120, windowMs: 60_000 });
      } else {
        expect(resolveIpcRequestLifecyclePolicy(channel)).toEqual({ cancellable: false, latestWins: false, timeoutMs: 0 });
        expect(resolveIpcRequestRatePolicy(channel)).toEqual({ enabled: true, maxRequestsPerWindow: 16, windowMs: 60_000 });
      }
    }
    expect(resolveIpcRequestAdmissionPolicy('identityAccess:future')).toMatchObject({ enabled: false });
  });

  it('fails closed after 16 writes for one sender/channel and admits after the rolling window', async () => {
    let now = 10_000;
    const registry = new IpcRequestLifecycleRegistry({ now: () => now });
    const request = (index: number) => ({
      schemaVersion: 1 as const,
      rendererSessionId: '11111111-1111-4111-8111-111111111111',
      requestId: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
      sessionEpoch: 0,
      requestSequence: index,
      channel: 'identityAccess:revokePasskey',
      revisions: createZeroIpcTransportRevisions()
    });
    for (let index = 1; index <= 16; index += 1) {
      const lease = await registry.acquire(33, request(index));
      lease.complete();
    }
    await expect(registry.acquire(33, request(17))).rejects.toMatchObject({
      name: 'IpcRequestAdmissionError', kind: 'rate-limit', channel: 'identityAccess:revokePasskey'
    });
    now += 60_001;
    const retry = await registry.acquire(33, request(17));
    retry.complete();
  });
});
