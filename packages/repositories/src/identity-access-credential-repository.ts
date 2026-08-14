import { createHash } from 'node:crypto';
import { asFamilyId, asIsoDateTime, asPersonId, asUserId } from '@ppt/core';
import {
  canonicalFederatedIdentityLinkStateJson,
  canonicalPasskeyStateJson,
  canonicalTemporaryCredentialStateJson,
  TEMPORARY_CREDENTIAL_DISCLOSURE_RULES,
  TEMPORARY_CREDENTIAL_PURPOSE_BY_KIND
} from '@ppt/domain';
import type { IdentityAccessAggregateKey, IdentityAccessCompanionSourceProjection } from '@ppt/domain';
import type {
  CompanionSyncSnapshotRow,
  FederatedIdentityLinkRow,
  FederatedProviderConfigurationRow,
  IdentityAccessCenterSnapshotRow,
  IdentityAccessCredentialRepositoryPort,
  IdentityAccessMutationRow,
  IdentityAccessPolicyResourceResolution,
  IdentityChallengeRow,
  IdentityTrustedDeviceState,
  PasskeyCredentialRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult,
  TemporaryVerifiableCredentialRow
} from '@ppt/repository-contracts';
import { assertPolicyAuthorizedRepositoryContext } from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const SHA256 = /^[0-9a-f]{64}$/u;
const OPAQUE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;
const MAX_PASSKEYS = 16;
const MAX_LINKS = 3;
const MAX_TEMPORARY_CREDENTIALS = 256;
const MAX_SNAPSHOTS = 256;

const parseStringArray = <T extends string>(value: unknown, maximum: number): readonly T[] => {
  const parsed: unknown = JSON.parse(String(value));
  if (!Array.isArray(parsed) || parsed.length > maximum || parsed.some((entry) => typeof entry !== 'string')) {
    throw new Error('Identity access stored array is invalid');
  }
  return Object.freeze(parsed as T[]);
};

const keyFrom = (row: Record<string, unknown>): IdentityAccessAggregateKey => Object.freeze({
  familyId: asFamilyId(String(row.family_id)),
  accountId: asUserId(String(row.account_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id))
});

const mapMutation = (row: Record<string, unknown>): IdentityAccessMutationRow => Object.freeze({
  id: String(row.id), clientOperationId: String(row.client_operation_id), requestFingerprint: String(row.request_fingerprint),
  stateFingerprint: String(row.state_fingerprint), familyId: asFamilyId(String(row.family_id)), accountId: asUserId(String(row.account_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)), mutationKind: String(row.mutation_kind) as IdentityAccessMutationRow['mutationKind'],
  resourceType: String(row.resource_type) as IdentityAccessMutationRow['resourceType'], resourceId: String(row.resource_id),
  previousRevision: Number(row.previous_revision), revision: Number(row.revision), createdAt: asIsoDateTime(String(row.occurred_at))
});

const mapPasskey = (row: Record<string, unknown>): PasskeyCredentialRow => {
  const key = keyFrom(row);
  return Object.freeze({
    id: String(row.id), key, familyId: key.familyId, accountId: key.accountId, ownerPersonId: key.ownerPersonId,
    revision: Number(row.revision), displayName: String(row.display_name), credentialId: String(row.credential_id),
    credentialIdSha256: String(row.credential_id_sha256), publicKeyCoseBase64Url: String(row.public_key_cose_base64url),
    publicKeySha256: String(row.public_key_sha256), userHandleSha256: String(row.user_handle_sha256), relyingPartyId: String(row.relying_party_id),
    ...(row.aaguid ? { aaguid: String(row.aaguid) } : {}),
    transports: parseStringArray<PasskeyCredentialRow['transports'][number]>(row.transports_json, 5), signCount: Number(row.sign_count),
    backupEligible: Number(row.backup_eligible) === 1, backupState: Number(row.backup_state) === 1,
    trustedDeviceId: String(row.trusted_device_id), securityEpoch: Number(row.security_epoch), status: String(row.status) as PasskeyCredentialRow['status'],
    createdAt: asIsoDateTime(String(row.created_at)), ...(row.last_used_at ? { lastUsedAt: asIsoDateTime(String(row.last_used_at)) } : {}),
    ...(row.revoked_at ? { revokedAt: asIsoDateTime(String(row.revoked_at)) } : {}),
    ...(row.revocation_reason ? { revocationReason: String(row.revocation_reason) as NonNullable<PasskeyCredentialRow['revocationReason']> } : {}),
    privateKeyStored: false, biometricDataStored: false, attestationPayloadStored: false,
    lastMutationId: String(row.last_mutation_id), stateFingerprint: String(row.state_fingerprint)
  });
};

const mapFederatedLink = (row: Record<string, unknown>): FederatedIdentityLinkRow => {
  const key = keyFrom(row);
  if (Number(row.live_account_tested) !== 1 || Number(row.authorization_code_pkce_verified) !== 1
    || Number(row.state_verified) !== 1 || Number(row.nonce_verified) !== 1
    || Number(row.token_bytes_exposed) !== 0 || Number(row.token_stored_in_encrypted_vault) !== 1
    || Number(row.provider_availability_guaranteed) !== 0 || Number(row.provider_delivery_guaranteed) !== 0) {
    throw new Error('Federated identity persisted verification truth is invalid');
  }
  return Object.freeze({
    id: String(row.id), key, familyId: key.familyId, accountId: key.accountId, ownerPersonId: key.ownerPersonId,
    revision: Number(row.revision), provider: String(row.provider) as FederatedIdentityLinkRow['provider'],
    configurationId: String(row.configuration_id), authorizationEndpointSha256: String(row.authorization_endpoint_sha256),
    clientConfigurationSha256: String(row.client_configuration_sha256),
    providerSubjectSha256: String(row.provider_subject_sha256), grantedScopes: parseStringArray<string>(row.granted_scopes_json, 32),
    status: String(row.status) as FederatedIdentityLinkRow['status'], encryptedVaultEntryId: String(row.encrypted_vault_entry_id),
    liveAccountTested: true, authorizationCodePkceVerified: true, stateVerified: true, nonceVerified: true,
    tokenBytesExposed: false, tokenStoredInEncryptedVault: true, providerAvailabilityGuaranteed: false, providerDeliveryGuaranteed: false,
    linkedAt: asIsoDateTime(String(row.linked_at)), lastLocallyVerifiedAt: asIsoDateTime(String(row.last_locally_verified_at)),
    ...(row.revoked_at ? { revokedAt: asIsoDateTime(String(row.revoked_at)) } : {}),
    lastMutationId: String(row.last_mutation_id), stateFingerprint: String(row.state_fingerprint)
  });
};

const mapTemporaryCredential = (row: Record<string, unknown>): TemporaryVerifiableCredentialRow => {
  const key = keyFrom(row);
  return Object.freeze({
    id: String(row.id), key, familyId: key.familyId, accountId: key.accountId, ownerPersonId: key.ownerPersonId,
    revision: Number(row.revision), kind: String(row.kind) as TemporaryVerifiableCredentialRow['kind'],
    purpose: String(row.purpose) as TemporaryVerifiableCredentialRow['purpose'], audienceRefSha256: String(row.audience_ref_sha256),
    disclosedClaimKeys: parseStringArray<TemporaryVerifiableCredentialRow['disclosedClaimKeys'][number]>(row.disclosed_claim_keys_json, 8),
    disclosureSha256: String(row.disclosure_sha256), payloadSha256: String(row.payload_sha256), signatureSha256: String(row.signature_sha256),
    issuerKeyId: String(row.issuer_key_id), issuerPublicKeySha256: String(row.issuer_public_key_sha256), signatureAlgorithm: 'Ed25519',
    qrPayloadBytes: Number(row.qr_payload_bytes), status: String(row.status) as TemporaryVerifiableCredentialRow['status'],
    notBefore: asIsoDateTime(String(row.not_before)), expiresAt: asIsoDateTime(String(row.expires_at)), issuedAt: asIsoDateTime(String(row.issued_at)),
    ...(row.revoked_at ? { revokedAt: asIsoDateTime(String(row.revoked_at)) } : {}),
    ...(row.revocation_reason ? { revocationReason: String(row.revocation_reason) } : {}), encryptedEnvelopeReference: String(row.encrypted_envelope_reference),
    encryptedEnvelopeStored: true, offlineSignatureVerifiable: true, expiryOfflineVerifiable: true, minimumDisclosureEnforced: true,
    networkDeliveryGuaranteed: false, remoteRevocationFreshnessGuaranteed: false,
    lastMutationId: String(row.last_mutation_id), stateFingerprint: String(row.state_fingerprint)
  });
};

const mapChallenge = (row: Record<string, unknown>): IdentityChallengeRow => Object.freeze({
  id: String(row.id), key: keyFrom(row), purpose: String(row.purpose) as IdentityChallengeRow['purpose'],
  challengeSha256: String(row.challenge_sha256), relyingPartyId: String(row.relying_party_id), trustedDeviceId: String(row.trusted_device_id),
  deviceId: String(row.device_id), securityEpoch: Number(row.security_epoch), createdAt: asIsoDateTime(String(row.created_at)),
  expiresAt: asIsoDateTime(String(row.expires_at)), ...(row.consumed_at ? { consumedAt: asIsoDateTime(String(row.consumed_at)) } : {}),
  ...(row.consumption_mutation_id ? { consumptionMutationId: String(row.consumption_mutation_id) } : {})
});

const mapSnapshot = (row: Record<string, unknown>): CompanionSyncSnapshotRow => {
  const key = keyFrom(row);
  return Object.freeze({
    id: String(row.id), key, familyId: key.familyId, accountId: key.accountId, ownerPersonId: key.ownerPersonId,
    trustedDeviceId: String(row.trusted_device_id), protocolVersion: 1, sourceVersion: Number(row.source_version), schemaVersion: Number(row.schema_version),
    ciphertextSha256: String(row.ciphertext_sha256), envelopeSha256: String(row.envelope_sha256), envelopeBytes: Number(row.envelope_bytes),
    securityEpoch: Number(row.security_epoch), generatedAt: asIsoDateTime(String(row.generated_at)), expiresAt: asIsoDateTime(String(row.expires_at)),
    sourceAuthority: 'windows_single_writer', encrypted: true, readOnly: true, remoteWritesAccepted: false,
    conflictResolution: 'reject_remote_and_refresh', networkDeliveryGuaranteed: false
  });
};

export const computeIdentityAccessStateFingerprint = (row: PasskeyCredentialRow | FederatedIdentityLinkRow | TemporaryVerifiableCredentialRow): string => createHash('sha256').update(
  'credentialId' in row ? canonicalPasskeyStateJson(row)
    : 'provider' in row ? canonicalFederatedIdentityLinkStateJson(row) : canonicalTemporaryCredentialStateJson(row), 'utf8').digest('hex');

const assertFingerprint = (row: PasskeyCredentialRow | FederatedIdentityLinkRow | TemporaryVerifiableCredentialRow): void => {
  if (!SHA256.test(row.stateFingerprint) || computeIdentityAccessStateFingerprint(row) !== row.stateFingerprint) throw new Error('Identity access state fingerprint mismatch');
};

const assertOpaqueReference = (value: string): void => {
  if(!OPAQUE_REFERENCE.test(value)||/^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(value)||/token=|bearer/i.test(value))
    throw new Error('Identity access requires an opaque encrypted-vault reference, never token plaintext');
};

const assertTemporaryDisclosure = (row:TemporaryVerifiableCredentialRow):void=>{
  const keys=row.disclosedClaimKeys;const rule=TEMPORARY_CREDENTIAL_DISCLOSURE_RULES[row.kind];const unique=new Set(keys);
  if(row.purpose!==TEMPORARY_CREDENTIAL_PURPOSE_BY_KIND[row.kind]||!SHA256.test(row.audienceRefSha256)
    ||keys.length===0||keys.length>8||unique.size!==keys.length||rule.required.some((key)=>!unique.has(key))||keys.some((key)=>!rule.allowed.includes(key as never)))
    throw new Error('Temporary credential minimum disclosure is invalid');
};

const assertKey = (context: RepositoryExecutionContext, key: IdentityAccessAggregateKey): void => {
  if (String(context.actor.userId) !== key.accountId || context.actor.personId !== key.ownerPersonId) {
    throw new Error('Identity access repository requires the exact account/person actor');
  }
};

const policyScope = (context: PolicyAuthorizedRepositoryExecutionContext, key: IdentityAccessAggregateKey, resourceType: string,
  resourceId: string, actions: readonly ('read' | 'create' | 'update' | 'delete')[]) => {
  assertKey(context, key);
  const authorization = context.policyAuthorization;
  const request = authorization.receiptRecord.request;
  if (!actions.includes(authorization.action as never) || authorization.subject.accountId !== key.accountId || authorization.subject.personId !== key.ownerPersonId
    || authorization.resourceFamilyId !== key.familyId || authorization.resourceOwnerPersonId !== key.ownerPersonId || !authorization.subject.familyIds.includes(key.familyId)
    || authorization.resourceType !== resourceType || authorization.resourceId !== resourceId || authorization.capability !== (authorization.action === 'read' ? 'family.read' : 'family.write')
    || request.subject.accountId !== key.accountId || request.subject.personId !== key.ownerPersonId || request.resource.familyId !== key.familyId
    || request.resource.ownerPersonId !== key.ownerPersonId || request.resource.sensitivity !== 'highly_sensitive' || request.purpose !== 'administration') {
    throw new Error('Identity access policy subject, resource, purpose or sensitivity mismatch');
  }
  assertPolicyAuthorizedRepositoryContext(context, { resourceType, resourceId, action: authorization.action,
    capability: authorization.capability, correlationId: context.correlationId, resourceFamilyId: key.familyId,
    resourceOwnerPersonId: key.ownerPersonId, purpose: 'administration' });
  const policy = platformPolicyPersistenceBinding(context, resourceType, resourceId);
  if (!policy) throw new Error('Identity access operation requires a durable policy receipt');
  return policy;
};

const operationScope = (context: PolicyAuthorizedRepositoryExecutionContext, key: IdentityAccessAggregateKey,
  allowedResourceTypes: readonly string[], allowedActions: readonly ('read' | 'create' | 'update' | 'delete')[]) => {
  const authorization=context.policyAuthorization;
  if(!allowedResourceTypes.includes(authorization.resourceType)||!allowedActions.includes(authorization.action as never))
    throw new Error('Identity access helper is outside the authorized parent operation');
  return policyScope(context,key,authorization.resourceType,authorization.resourceId,[authorization.action as 'read'|'create'|'update'|'delete']);
};

const keyOfRow = (row: { familyId: IdentityAccessAggregateKey['familyId']; accountId: IdentityAccessAggregateKey['accountId']; ownerPersonId: IdentityAccessAggregateKey['ownerPersonId'] }): IdentityAccessAggregateKey =>
  Object.freeze({ familyId: row.familyId, accountId: row.accountId, ownerPersonId: row.ownerPersonId });

export class SqliteIdentityAccessCredentialRepository extends SqliteRepository implements IdentityAccessCredentialRepositoryPort {
  public provisionFederatedProviderConfigurations(context:RepositoryExecutionContext,rows:Parameters<IdentityAccessCredentialRepositoryPort['provisionFederatedProviderConfigurations']>[1]):RepositoryResult<void>{
    const SHA=/^[0-9a-f]{64}$/u;const providers=['apple','google','microsoft'] as const;
    if(rows.length>providers.length||new Set(rows.map((row)=>row.provider)).size!==rows.length
      ||rows.some((row)=>!providers.includes(row.provider)||row.configured!==true||row.configurationId.trim()!==row.configurationId
        ||row.configurationId.length<2||row.configurationId.length>128||!SHA.test(row.authorizationEndpointSha256)||!SHA.test(row.clientConfigurationSha256)))
      throw new Error('Federated provider deployment configuration is invalid');
    return this.execute(context,()=>{const db=this.database(context);const configured=new Map(rows.map((row)=>[row.provider,row]));
      const statement=db.prepare(`INSERT INTO identity_federated_provider_configurations(provider,configured,configuration_id,authorization_endpoint_sha256,client_configuration_sha256) VALUES(?,?,?,?,?) ON CONFLICT(provider) DO UPDATE SET configured=excluded.configured,configuration_id=excluded.configuration_id,authorization_endpoint_sha256=excluded.authorization_endpoint_sha256,client_configuration_sha256=excluded.client_configuration_sha256`);
      for(const provider of providers){const row=configured.get(provider);statement.run(provider,row?1:0,row?.configurationId??`unconfigured-${provider}`,row?.authorizationEndpointSha256??'0'.repeat(64),row?.clientConfigurationSha256??'0'.repeat(64));}
    });
  }

  public pruneTerminalChallenges(context:RepositoryExecutionContext,cutoff:IdentityChallengeRow['createdAt']):RepositoryResult<number>{
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(cutoff)||new Date(cutoff).toISOString()!==cutoff)throw new Error('Challenge retention cutoff is invalid');
    return this.execute(context,()=>Number(this.database(context).prepare(`WITH terminal AS (SELECT id,created_at,row_number() OVER(PARTITION BY account_id ORDER BY created_at DESC,id DESC) AS ordinal FROM identity_passkey_challenges WHERE consumed_at IS NOT NULL OR julianday(expires_at)<=julianday(?)) DELETE FROM identity_passkey_challenges WHERE id IN (SELECT id FROM terminal WHERE julianday(created_at)<julianday(?) OR ordinal>512)`).run(context.occurredAt,cutoff).changes));
  }

  public listTerminalTemporaryCredentialEnvelopeReferences(context:RepositoryExecutionContext,key:IdentityAccessAggregateKey):ReturnType<IdentityAccessCredentialRepositoryPort['listTerminalTemporaryCredentialEnvelopeReferences']>{
    assertKey(context,key);
    return this.execute(context,()=>{const rows=this.database(context).prepare(`SELECT encrypted_envelope_reference FROM identity_temporary_credentials WHERE family_id=? AND account_id=? AND owner_person_id=? AND julianday(expires_at)<=julianday(?)-7 ORDER BY expires_at,id LIMIT 256`).all(key.familyId,key.accountId,key.ownerPersonId,context.occurredAt) as {encrypted_envelope_reference:unknown}[];const references=rows.map((row)=>String(row.encrypted_envelope_reference));if(new Set(references).size!==references.length||references.some((reference)=>!/^temporary-credential-envelope:[0-9a-f]{64}$/u.test(reference)))throw new Error('Terminal temporary credential contains a noncanonical envelope reference');return Object.freeze(references);});
  }

  public listReferencedTemporaryCredentialEnvelopeReferences(context:RepositoryExecutionContext,key:IdentityAccessAggregateKey):ReturnType<IdentityAccessCredentialRepositoryPort['listReferencedTemporaryCredentialEnvelopeReferences']>{
    assertKey(context,key);
    return this.execute(context,()=>{const rows=this.database(context).prepare(`SELECT encrypted_envelope_reference FROM identity_temporary_credentials WHERE family_id=? AND account_id=? AND owner_person_id=? ORDER BY id LIMIT 2049`).all(key.familyId,key.accountId,key.ownerPersonId) as {encrypted_envelope_reference:unknown}[];const references=rows.map((row)=>String(row.encrypted_envelope_reference));if(references.length>2048||new Set(references).size!==references.length||references.some((reference)=>!/^temporary-credential-envelope:[0-9a-f]{64}$/u.test(reference)))throw new Error('Referenced temporary credential envelope inventory is invalid or exceeds its absolute bound');return Object.freeze(references);});
  }

  public pruneTerminalCredentialMetadata(context:RepositoryExecutionContext,key:IdentityAccessAggregateKey,destroyedEnvelopeReferences:readonly string[]=[]):ReturnType<IdentityAccessCredentialRepositoryPort['pruneTerminalCredentialMetadata']>{
    assertKey(context,key);
    if(!Array.isArray(destroyedEnvelopeReferences)||destroyedEnvelopeReferences.length>256||new Set(destroyedEnvelopeReferences).size!==destroyedEnvelopeReferences.length||destroyedEnvelopeReferences.some((reference)=>!/^temporary-credential-envelope:[0-9a-f]{64}$/u.test(reference)))throw new Error('Destroyed temporary envelope reference list is invalid');
    return this.execute(context,()=>{
      const db=this.database(context);
      db.prepare(`INSERT OR IGNORE INTO identity_passkey_credential_tombstones(
        credential_id_sha256,family_id,account_id,owner_person_id,terminal_status,revocation_reason,revoked_at,retain_until,
        final_revision,final_state_fingerprint,final_mutation_id,policy_receipt_hash,recorded_at)
        SELECT credential_id_sha256,family_id,account_id,owner_person_id,'revoked',revocation_reason,revoked_at,
          strftime('%Y-%m-%dT%H:%M:%fZ',revoked_at,'+365 days'),revision,state_fingerprint,last_mutation_id,policy_receipt_hash,?
        FROM identity_passkey_credentials WHERE family_id=? AND account_id=? AND owner_person_id=? AND status='revoked' AND revoked_at IS NOT NULL`).run(context.occurredAt,key.familyId,key.accountId,key.ownerPersonId);
      const passkeyRowsCompacted=Number(db.prepare(`DELETE FROM identity_passkey_credentials
        WHERE family_id=? AND account_id=? AND owner_person_id=? AND status='revoked' AND julianday(revoked_at)<=julianday(?)-2 AND EXISTS(
          SELECT 1 FROM identity_passkey_credential_tombstones tombstone
          WHERE tombstone.credential_id_sha256=identity_passkey_credentials.credential_id_sha256
            AND tombstone.final_revision=identity_passkey_credentials.revision
            AND tombstone.final_state_fingerprint=identity_passkey_credentials.state_fingerprint
            AND tombstone.final_mutation_id=identity_passkey_credentials.last_mutation_id
            AND tombstone.policy_receipt_hash=identity_passkey_credentials.policy_receipt_hash)`).run(key.familyId,key.accountId,key.ownerPersonId,context.occurredAt).changes);
      const passkeyTombstonesExpired=Number(db.prepare(`DELETE FROM identity_passkey_credential_tombstones
        WHERE family_id=? AND account_id=? AND owner_person_id=? AND julianday(retain_until)<=julianday(?) AND NOT EXISTS(
          SELECT 1 FROM identity_passkey_credentials current WHERE current.credential_id_sha256=identity_passkey_credential_tombstones.credential_id_sha256)`).run(key.familyId,key.accountId,key.ownerPersonId,context.occurredAt).changes);
      const destroyedReferencesJson=JSON.stringify(destroyedEnvelopeReferences);
      db.prepare(`INSERT OR IGNORE INTO identity_temporary_credential_tombstones(
        credential_id,family_id,account_id,owner_person_id,payload_sha256,terminal_status,expires_at,revoked_at,retain_until,
        final_revision,final_state_fingerprint,final_mutation_id,policy_receipt_hash,pruned_at)
        SELECT id,family_id,account_id,owner_person_id,payload_sha256,CASE status WHEN 'revoked' THEN 'revoked' ELSE 'expired' END,
          expires_at,revoked_at,strftime('%Y-%m-%dT%H:%M:%fZ',expires_at,'+365 days'),revision,state_fingerprint,last_mutation_id,
          policy_receipt_hash,? FROM identity_temporary_credentials WHERE family_id=? AND account_id=? AND owner_person_id=? AND julianday(expires_at)<=julianday(?)-7
          AND encrypted_envelope_reference IN (SELECT value FROM json_each(?))`).run(context.occurredAt,key.familyId,key.accountId,key.ownerPersonId,context.occurredAt,destroyedReferencesJson);
      const temporaryRowsCompacted=Number(db.prepare(`DELETE FROM identity_temporary_credentials
        WHERE family_id=? AND account_id=? AND owner_person_id=? AND julianday(expires_at)<=julianday(?)-7 AND encrypted_envelope_reference IN (SELECT value FROM json_each(?)) AND EXISTS(
          SELECT 1 FROM identity_temporary_credential_tombstones tombstone WHERE tombstone.credential_id=identity_temporary_credentials.id
            AND tombstone.payload_sha256=identity_temporary_credentials.payload_sha256
            AND tombstone.final_revision=identity_temporary_credentials.revision
            AND tombstone.final_state_fingerprint=identity_temporary_credentials.state_fingerprint
            AND tombstone.final_mutation_id=identity_temporary_credentials.last_mutation_id
            AND tombstone.policy_receipt_hash=identity_temporary_credentials.policy_receipt_hash)`).run(key.familyId,key.accountId,key.ownerPersonId,context.occurredAt,destroyedReferencesJson).changes);
      const temporaryTombstonesExpired=Number(db.prepare(`DELETE FROM identity_temporary_credential_tombstones
        WHERE family_id=? AND account_id=? AND owner_person_id=? AND julianday(retain_until)<=julianday(?) AND NOT EXISTS(
          SELECT 1 FROM identity_temporary_credentials current WHERE current.id=identity_temporary_credential_tombstones.credential_id)`).run(key.familyId,key.accountId,key.ownerPersonId,context.occurredAt).changes);
      const mutationRowsPruned=Number(db.prepare(`DELETE FROM identity_access_mutations WHERE family_id=? AND account_id=? AND owner_person_id=? AND julianday(occurred_at)<=julianday(?)-7
        AND NOT EXISTS(SELECT 1 FROM identity_passkey_challenges challenge WHERE challenge.consumption_mutation_id=identity_access_mutations.id)
        AND NOT EXISTS(SELECT 1 FROM identity_passkey_credentials current WHERE current.last_mutation_id=identity_access_mutations.id)
        AND NOT EXISTS(SELECT 1 FROM identity_federated_links current WHERE current.last_mutation_id=identity_access_mutations.id)
        AND NOT EXISTS(SELECT 1 FROM identity_temporary_credentials current WHERE current.last_mutation_id=identity_access_mutations.id)
        AND NOT EXISTS(SELECT 1 FROM identity_passkey_credential_tombstones tombstone WHERE tombstone.final_mutation_id=identity_access_mutations.id)
        AND NOT EXISTS(SELECT 1 FROM identity_temporary_credential_tombstones tombstone WHERE tombstone.final_mutation_id=identity_access_mutations.id)`).run(key.familyId,key.accountId,key.ownerPersonId,context.occurredAt).changes);
      return Object.freeze({mutationRowsPruned,passkeyRowsCompacted,passkeyTombstonesExpired,temporaryRowsCompacted,temporaryTombstonesExpired});
    });
  }

  public resolvePolicyResource(context: RepositoryExecutionContext, key: IdentityAccessAggregateKey, resourceType: Parameters<IdentityAccessCredentialRepositoryPort['resolvePolicyResource']>[2], resourceId: string): RepositoryResult<IdentityAccessPolicyResourceResolution | null> {
    assertKey(context, key);
    return this.execute(context, () => {
      const db = this.database(context);
      const active = db.prepare(`SELECT 1 FROM accounts a JOIN people p ON p.id=a.person_id WHERE a.id=? AND a.person_id=? AND a.status='active' AND p.family_id=? AND p.status='active'`).get(key.accountId, key.ownerPersonId, key.familyId);
      if (!active) return null;
      if (resourceType === 'identity_access_center') return Object.freeze({ familyId: key.familyId, ownerPersonId: key.ownerPersonId, revision: 0,
        stateFingerprint: createHash('sha256').update(JSON.stringify([1,key.familyId,key.accountId,key.ownerPersonId])).digest('hex'), sensitivity: 'highly_sensitive' as const });
      const selection = resourceType === 'identity_challenge' ? ['identity_passkey_challenges','id','0 AS revision','challenge_sha256 AS state_fingerprint']
        : resourceType === 'passkey_credential' ? ['identity_passkey_credentials','id','revision','state_fingerprint']
          : resourceType === 'federated_identity_link' ? ['identity_federated_links','id','revision','state_fingerprint']
            : resourceType === 'temporary_verifiable_credential' ? ['identity_temporary_credentials','id','revision','state_fingerprint']
              : ['identity_companion_snapshots','id','source_version AS revision','envelope_sha256 AS state_fingerprint'];
      const row = db.prepare(`SELECT ${selection[2]},${selection[3]} FROM ${selection[0]} WHERE ${selection[1]}=? AND family_id=? AND account_id=? AND owner_person_id=?`)
        .get(resourceId,key.familyId,key.accountId,key.ownerPersonId) as Record<string,unknown>|undefined;
      return row ? Object.freeze({ familyId:key.familyId,ownerPersonId:key.ownerPersonId,revision:Number(row.revision),stateFingerprint:String(row.state_fingerprint),sensitivity:'highly_sensitive' as const }) : null;
    });
  }

  public loadCenter(context: PolicyAuthorizedRepositoryExecutionContext, key: IdentityAccessAggregateKey): RepositoryResult<IdentityAccessCenterSnapshotRow> {
    policyScope(context,key,'identity_access_center',key.accountId,['read']);
    return this.execute(context,()=>{const db=this.database(context);return Object.freeze({key,
      passkeys:(db.prepare(`SELECT * FROM identity_passkey_credentials WHERE family_id=? AND account_id=? AND owner_person_id=? ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END,created_at DESC LIMIT ?`).all(key.familyId,key.accountId,key.ownerPersonId,MAX_PASSKEYS) as Record<string,unknown>[]).map(mapPasskey),
      federatedLinks:(db.prepare(`SELECT link.* FROM identity_federated_links link JOIN identity_federated_provider_configurations config ON config.provider=link.provider AND config.configured=1 AND config.configuration_id=link.configuration_id AND config.authorization_endpoint_sha256=link.authorization_endpoint_sha256 AND config.client_configuration_sha256=link.client_configuration_sha256 WHERE link.family_id=? AND link.account_id=? AND link.owner_person_id=? ORDER BY link.linked_at DESC LIMIT ?`).all(key.familyId,key.accountId,key.ownerPersonId,MAX_LINKS) as Record<string,unknown>[]).map(mapFederatedLink),
      temporaryCredentials:(db.prepare(`SELECT * FROM identity_temporary_credentials WHERE family_id=? AND account_id=? AND owner_person_id=? ORDER BY CASE WHEN status='active' AND julianday(expires_at)>julianday(?) THEN 0 ELSE 1 END,issued_at DESC LIMIT ?`).all(key.familyId,key.accountId,key.ownerPersonId,context.occurredAt,MAX_TEMPORARY_CREDENTIALS) as Record<string,unknown>[]).map(mapTemporaryCredential),
      companionSnapshots:(db.prepare(`SELECT * FROM identity_companion_snapshots WHERE family_id=? AND account_id=? AND owner_person_id=? ORDER BY generated_at DESC LIMIT ?`).all(key.familyId,key.accountId,key.ownerPersonId,MAX_SNAPSHOTS) as Record<string,unknown>[]).map(mapSnapshot),
      configuredProviders:(db.prepare(`SELECT provider FROM identity_federated_provider_configurations WHERE configured=1 ORDER BY provider`).all() as Record<string,unknown>[]).map((row)=>String(row.provider) as FederatedProviderConfigurationRow['provider']),generatedAt:context.occurredAt});});
  }

  public findTrustedDevice(context:PolicyAuthorizedRepositoryExecutionContext,key:IdentityAccessAggregateKey,trustedDeviceId:string):RepositoryResult<IdentityTrustedDeviceState|null>{
    operationScope(context,key,['identity_access_center','identity_challenge','passkey_credential','federated_identity_link','temporary_verifiable_credential','companion_sync_snapshot'],['read','create','update','delete']);return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT d.id,d.account_id,d.device_id,d.security_epoch,d.revoked_at FROM trusted_devices d JOIN accounts a ON a.id=d.account_id JOIN people p ON p.id=a.person_id WHERE d.id=? AND d.account_id=? AND a.person_id=? AND p.family_id=?`).get(trustedDeviceId,key.accountId,key.ownerPersonId,key.familyId) as Record<string,unknown>|undefined;return row?Object.freeze({trustedDeviceId:String(row.id),accountId:asUserId(String(row.account_id)),deviceId:String(row.device_id),securityEpoch:Number(row.security_epoch),...(row.revoked_at?{revokedAt:asIsoDateTime(String(row.revoked_at))}:{})}):null;});
  }

  public insertChallenge(context:PolicyAuthorizedRepositoryExecutionContext,row:IdentityChallengeRow):RepositoryResult<void>{
    if(!SHA256.test(row.challengeSha256)||Date.parse(row.expiresAt)<=Date.parse(row.createdAt)||Date.parse(row.expiresAt)-Date.parse(row.createdAt)>300_000)throw new Error('Identity challenge hash or expiry is invalid');
    const policy=policyScope(context,row.key,'identity_challenge',row.id,['create']);return this.execute(context,()=>{const db=this.database(context);db.prepare(`WITH terminal AS (SELECT id,created_at,row_number() OVER(ORDER BY created_at DESC,id DESC) AS ordinal FROM identity_passkey_challenges WHERE account_id=? AND (consumed_at IS NOT NULL OR julianday(expires_at)<=julianday(?))) DELETE FROM identity_passkey_challenges WHERE id IN (SELECT id FROM terminal WHERE julianday(created_at)<=julianday(?)-7 OR ordinal>512)`).run(row.key.accountId,row.createdAt,row.createdAt);db.prepare(`INSERT INTO identity_passkey_challenges(id,family_id,account_id,owner_person_id,purpose,challenge_sha256,relying_party_id,trusted_device_id,device_id,security_epoch,created_at,expires_at,consumed_at,consumption_mutation_id,policy_receipt_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.key.familyId,row.key.accountId,row.key.ownerPersonId,row.purpose,row.challengeSha256,row.relyingPartyId,row.trustedDeviceId,row.deviceId,row.securityEpoch,row.createdAt,row.expiresAt,row.consumedAt??null,row.consumptionMutationId??null,policy.receiptHash);});
  }
  public findChallenge(context:PolicyAuthorizedRepositoryExecutionContext,key:IdentityAccessAggregateKey,challengeId:string):RepositoryResult<IdentityChallengeRow|null>{operationScope(context,key,['identity_challenge','passkey_credential'],['read','create','update']);return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT * FROM identity_passkey_challenges WHERE id=? AND family_id=? AND account_id=? AND owner_person_id=?`).get(challengeId,key.familyId,key.accountId,key.ownerPersonId) as Record<string,unknown>|undefined;return row?mapChallenge(row):null;});}
  public consumeChallenge(context:PolicyAuthorizedRepositoryExecutionContext,key:IdentityAccessAggregateKey,challengeId:string,consumedAt:IdentityChallengeRow['createdAt'],mutationId:string):RepositoryResult<boolean>{operationScope(context,key,['passkey_credential'],['create','update']);return this.execute(context,()=>this.database(context).prepare(`UPDATE identity_passkey_challenges SET consumed_at=?,consumption_mutation_id=? WHERE id=? AND family_id=? AND account_id=? AND owner_person_id=? AND consumed_at IS NULL AND julianday(expires_at)>=julianday(?)`).run(consumedAt,mutationId,challengeId,key.familyId,key.accountId,key.ownerPersonId,consumedAt).changes===1);}

  public listPasskeys(context:PolicyAuthorizedRepositoryExecutionContext,key:IdentityAccessAggregateKey):RepositoryResult<readonly PasskeyCredentialRow[]>{operationScope(context,key,['identity_access_center','identity_challenge','passkey_credential'],['read','create','update','delete']);return this.execute(context,()=>Object.freeze((this.database(context).prepare(`SELECT * FROM identity_passkey_credentials WHERE family_id=? AND account_id=? AND owner_person_id=? ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END,created_at DESC LIMIT ?`).all(key.familyId,key.accountId,key.ownerPersonId,MAX_PASSKEYS) as Record<string,unknown>[]).map(mapPasskey)));}
  public findPasskey(context:PolicyAuthorizedRepositoryExecutionContext,key:IdentityAccessAggregateKey,credentialId:string):RepositoryResult<PasskeyCredentialRow|null>{policyScope(context,key,'passkey_credential',credentialId,['read','create','update','delete']);return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT * FROM identity_passkey_credentials WHERE id=? AND family_id=? AND account_id=? AND owner_person_id=?`).get(credentialId,key.familyId,key.accountId,key.ownerPersonId) as Record<string,unknown>|undefined;return row?mapPasskey(row):null;});}
  public findPasskeyByCredentialIdSha256(context:PolicyAuthorizedRepositoryExecutionContext,key:IdentityAccessAggregateKey,value:string):RepositoryResult<PasskeyCredentialRow|null>{if(!SHA256.test(value))throw new Error('Credential identifier fingerprint is invalid');operationScope(context,key,['passkey_credential'],['create']);return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT * FROM identity_passkey_credentials WHERE credential_id_sha256=? AND family_id=? AND account_id=? AND owner_person_id=?`).get(value,key.familyId,key.accountId,key.ownerPersonId) as Record<string,unknown>|undefined;return row?mapPasskey(row):null;});}
  public insertPasskey(context:PolicyAuthorizedRepositoryExecutionContext,row:PasskeyCredentialRow):RepositoryResult<void>{assertFingerprint(row);const policy=policyScope(context,row.key,'passkey_credential',row.id,['create']);return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO identity_passkey_credentials(id,family_id,account_id,owner_person_id,revision,display_name,credential_id,credential_id_sha256,public_key_cose_base64url,public_key_sha256,user_handle_sha256,relying_party_id,aaguid,transports_json,sign_count,backup_eligible,backup_state,trusted_device_id,security_epoch,status,created_at,last_used_at,revoked_at,revocation_reason,last_mutation_id,state_fingerprint,policy_receipt_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.accountId,row.ownerPersonId,row.revision,row.displayName,row.credentialId,row.credentialIdSha256,row.publicKeyCoseBase64Url,row.publicKeySha256,row.userHandleSha256,row.relyingPartyId,row.aaguid??null,JSON.stringify(row.transports),row.signCount,row.backupEligible?1:0,row.backupState?1:0,row.trustedDeviceId,row.securityEpoch,row.status,row.createdAt,row.lastUsedAt??null,row.revokedAt??null,row.revocationReason??null,row.lastMutationId,row.stateFingerprint,policy.receiptHash);});}
  public savePasskey(context:PolicyAuthorizedRepositoryExecutionContext,row:PasskeyCredentialRow,expectedRevision:number):RepositoryResult<boolean>{assertFingerprint(row);const action=row.status==='revoked'?'delete':'update';const policy=policyScope(context,row.key,'passkey_credential',row.id,[action]);return this.execute(context,()=>{const db=this.database(context);const changed=db.prepare(`UPDATE identity_passkey_credentials SET revision=?,display_name=?,transports_json=?,sign_count=?,backup_eligible=?,backup_state=?,trusted_device_id=?,security_epoch=?,status=?,last_used_at=?,revoked_at=?,revocation_reason=?,last_mutation_id=?,state_fingerprint=?,policy_receipt_hash=? WHERE id=? AND family_id=? AND account_id=? AND owner_person_id=? AND revision=?`).run(row.revision,row.displayName,JSON.stringify(row.transports),row.signCount,row.backupEligible?1:0,row.backupState?1:0,row.trustedDeviceId,row.securityEpoch,row.status,row.lastUsedAt??null,row.revokedAt??null,row.revocationReason??null,row.lastMutationId,row.stateFingerprint,policy.receiptHash,row.id,row.familyId,row.accountId,row.ownerPersonId,expectedRevision).changes===1;if(changed&&row.status==='revoked'){if(!row.revokedAt||!row.revocationReason)throw new Error('Revoked passkey tombstone requires exact terminal metadata');const retainUntil=new Date(Date.parse(row.revokedAt)+365*86_400_000).toISOString();db.prepare(`INSERT INTO identity_passkey_credential_tombstones(credential_id_sha256,family_id,account_id,owner_person_id,terminal_status,revocation_reason,revoked_at,retain_until,final_revision,final_state_fingerprint,final_mutation_id,policy_receipt_hash,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.credentialIdSha256,row.familyId,row.accountId,row.ownerPersonId,'revoked',row.revocationReason,row.revokedAt,retainUntil,row.revision,row.stateFingerprint,row.lastMutationId,policy.receiptHash,context.occurredAt);}return changed;});}

  public listConfiguredFederatedProviders(context:PolicyAuthorizedRepositoryExecutionContext):RepositoryResult<readonly FederatedProviderConfigurationRow[]>{const auth=context.policyAuthorization;if(!auth.subject.personId)throw new Error('Federated provider listing requires an exact owner');const key:IdentityAccessAggregateKey=Object.freeze({familyId:asFamilyId(auth.resourceFamilyId),accountId:asUserId(auth.subject.accountId),ownerPersonId:asPersonId(auth.subject.personId)});operationScope(context,key,['identity_access_center','federated_identity_link'],['read','create']);return this.execute(context,()=>Object.freeze((this.database(context).prepare(`SELECT * FROM identity_federated_provider_configurations WHERE configured=1 ORDER BY provider`).all() as Record<string,unknown>[]).map((row)=>Object.freeze({provider:String(row.provider) as FederatedProviderConfigurationRow['provider'],configured:true,configurationId:String(row.configuration_id),authorizationEndpointSha256:String(row.authorization_endpoint_sha256),clientConfigurationSha256:String(row.client_configuration_sha256)}))));}
  public findFederatedLink(context:PolicyAuthorizedRepositoryExecutionContext,key:IdentityAccessAggregateKey,linkId:string):RepositoryResult<FederatedIdentityLinkRow|null>{policyScope(context,key,'federated_identity_link',linkId,['read','create','delete']);return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT link.* FROM identity_federated_links link JOIN identity_federated_provider_configurations config ON config.provider=link.provider AND config.configured=1 AND config.configuration_id=link.configuration_id AND config.authorization_endpoint_sha256=link.authorization_endpoint_sha256 AND config.client_configuration_sha256=link.client_configuration_sha256 WHERE link.id=? AND link.family_id=? AND link.account_id=? AND link.owner_person_id=?`).get(linkId,key.familyId,key.accountId,key.ownerPersonId) as Record<string,unknown>|undefined;return row?mapFederatedLink(row):null;});}
  public findFederatedLinkByProvider(context:PolicyAuthorizedRepositoryExecutionContext,key:IdentityAccessAggregateKey,provider:FederatedIdentityLinkRow['provider']):RepositoryResult<FederatedIdentityLinkRow|null>{operationScope(context,key,['identity_access_center','federated_identity_link'],['read','create']);return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT * FROM identity_federated_links WHERE provider=? AND family_id=? AND account_id=? AND owner_person_id=?`).get(provider,key.familyId,key.accountId,key.ownerPersonId) as Record<string,unknown>|undefined;return row?mapFederatedLink(row):null;});}
  public insertFederatedLink(context:PolicyAuthorizedRepositoryExecutionContext,row:FederatedIdentityLinkRow):RepositoryResult<void>{assertFingerprint(row);assertOpaqueReference(row.encryptedVaultEntryId);if(row.grantedScopes.length===0||row.grantedScopes.length>16||new Set(row.grantedScopes).size!==row.grantedScopes.length||row.grantedScopes.some((scope)=>scope.trim().length===0||scope.length>160))throw new Error('Federated identity scopes are invalid');const policy=policyScope(context,row.key,'federated_identity_link',row.id,['create']);return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO identity_federated_links(id,family_id,account_id,owner_person_id,revision,provider,configuration_id,authorization_endpoint_sha256,client_configuration_sha256,provider_subject_sha256,granted_scopes_json,status,encrypted_vault_entry_id,live_account_tested,authorization_code_pkce_verified,state_verified,nonce_verified,token_bytes_exposed,token_stored_in_encrypted_vault,provider_availability_guaranteed,provider_delivery_guaranteed,linked_at,last_locally_verified_at,revoked_at,last_mutation_id,state_fingerprint,policy_receipt_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1,1,1,1,0,1,0,0,?,?,?,?,?,?)`).run(row.id,row.familyId,row.accountId,row.ownerPersonId,row.revision,row.provider,row.configurationId,row.authorizationEndpointSha256,row.clientConfigurationSha256,row.providerSubjectSha256,JSON.stringify(row.grantedScopes),row.status,row.encryptedVaultEntryId,row.linkedAt,row.lastLocallyVerifiedAt,row.revokedAt??null,row.lastMutationId,row.stateFingerprint,policy.receiptHash);});}
  public saveFederatedLink(context:PolicyAuthorizedRepositoryExecutionContext,row:FederatedIdentityLinkRow,expectedRevision:number):RepositoryResult<boolean>{assertFingerprint(row);assertOpaqueReference(row.encryptedVaultEntryId);const policy=policyScope(context,row.key,'federated_identity_link',row.id,row.status==='linked'?['create']:['delete']);return this.execute(context,()=>this.database(context).prepare(`UPDATE identity_federated_links SET revision=?,configuration_id=?,authorization_endpoint_sha256=?,client_configuration_sha256=?,provider_subject_sha256=?,granted_scopes_json=?,status=?,encrypted_vault_entry_id=?,linked_at=?,last_locally_verified_at=?,revoked_at=?,last_mutation_id=?,state_fingerprint=?,policy_receipt_hash=? WHERE id=? AND family_id=? AND account_id=? AND owner_person_id=? AND revision=?`).run(row.revision,row.configurationId,row.authorizationEndpointSha256,row.clientConfigurationSha256,row.providerSubjectSha256,JSON.stringify(row.grantedScopes),row.status,row.encryptedVaultEntryId,row.linkedAt,row.lastLocallyVerifiedAt,row.revokedAt??null,row.lastMutationId,row.stateFingerprint,policy.receiptHash,row.id,row.familyId,row.accountId,row.ownerPersonId,expectedRevision).changes===1);}

  public findTemporaryCredential(context:PolicyAuthorizedRepositoryExecutionContext,key:IdentityAccessAggregateKey,credentialId:string):RepositoryResult<TemporaryVerifiableCredentialRow|null>{policyScope(context,key,'temporary_verifiable_credential',credentialId,['read','create','delete']);return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT * FROM identity_temporary_credentials WHERE id=? AND family_id=? AND account_id=? AND owner_person_id=?`).get(credentialId,key.familyId,key.accountId,key.ownerPersonId) as Record<string,unknown>|undefined;return row?mapTemporaryCredential(row):null;});}
  public countTemporaryCredentials(context:PolicyAuthorizedRepositoryExecutionContext,key:IdentityAccessAggregateKey):RepositoryResult<number>{operationScope(context,key,['temporary_verifiable_credential'],['create']);return this.execute(context,()=>{const row=this.database(context).prepare(`SELECT count(*) AS count FROM identity_temporary_credentials WHERE family_id=? AND account_id=? AND owner_person_id=? AND status='active' AND julianday(expires_at)>julianday(?)`).get(key.familyId,key.accountId,key.ownerPersonId,context.occurredAt) as {count:number};const count=Number(row.count);if(!Number.isSafeInteger(count)||count<0||count>MAX_TEMPORARY_CREDENTIALS)throw new Error('Active temporary credential count is outside quota');return count;});}
  public insertTemporaryCredential(context:PolicyAuthorizedRepositoryExecutionContext,row:TemporaryVerifiableCredentialRow):RepositoryResult<void>{assertFingerprint(row);assertOpaqueReference(row.encryptedEnvelopeReference);assertTemporaryDisclosure(row);const policy=policyScope(context,row.key,'temporary_verifiable_credential',row.id,['create']);return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO identity_temporary_credentials(id,family_id,account_id,owner_person_id,revision,kind,purpose,audience_ref_sha256,disclosed_claim_keys_json,disclosure_sha256,payload_sha256,signature_sha256,issuer_key_id,issuer_public_key_sha256,signature_algorithm,qr_payload_bytes,status,not_before,expires_at,issued_at,revoked_at,revocation_reason,encrypted_envelope_reference,last_mutation_id,state_fingerprint,policy_receipt_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.accountId,row.ownerPersonId,row.revision,row.kind,row.purpose,row.audienceRefSha256,JSON.stringify(row.disclosedClaimKeys),row.disclosureSha256,row.payloadSha256,row.signatureSha256,row.issuerKeyId,row.issuerPublicKeySha256,'Ed25519',row.qrPayloadBytes,row.status,row.notBefore,row.expiresAt,row.issuedAt,row.revokedAt??null,row.revocationReason??null,row.encryptedEnvelopeReference,row.lastMutationId,row.stateFingerprint,policy.receiptHash);});}
  public saveTemporaryCredential(context:PolicyAuthorizedRepositoryExecutionContext,row:TemporaryVerifiableCredentialRow,expectedRevision:number):RepositoryResult<boolean>{assertFingerprint(row);assertOpaqueReference(row.encryptedEnvelopeReference);assertTemporaryDisclosure(row);const policy=policyScope(context,row.key,'temporary_verifiable_credential',row.id,['delete']);return this.execute(context,()=>this.database(context).prepare(`UPDATE identity_temporary_credentials SET revision=?,status=?,revoked_at=?,revocation_reason=?,last_mutation_id=?,state_fingerprint=?,policy_receipt_hash=? WHERE id=? AND family_id=? AND account_id=? AND owner_person_id=? AND revision=?`).run(row.revision,row.status,row.revokedAt??null,row.revocationReason??null,row.lastMutationId,row.stateFingerprint,policy.receiptHash,row.id,row.familyId,row.accountId,row.ownerPersonId,expectedRevision).changes===1);}

  public loadCompanionSourceProjection(context:PolicyAuthorizedRepositoryExecutionContext,key:IdentityAccessAggregateKey):RepositoryResult<IdentityAccessCompanionSourceProjection>{policyScope(context,key,'companion_sync_snapshot',context.policyAuthorization.resourceId,['create']);return this.execute(context,()=>{const db=this.database(context);const clock=db.prepare(`SELECT source_version FROM identity_access_source_clocks WHERE account_id=?`).get(key.accountId) as {source_version:number}|undefined;const sourceVersion=clock?Number(clock.source_version):0;if(!Number.isSafeInteger(sourceVersion)||sourceVersion<0)throw new Error('Companion source clock is invalid');const passkeys=(db.prepare(`SELECT id,revision,display_name,relying_party_id,transports_json,status,created_at,last_used_at,revoked_at FROM identity_passkey_credentials WHERE family_id=? AND account_id=? AND owner_person_id=? ORDER BY id LIMIT ?`).all(key.familyId,key.accountId,key.ownerPersonId,MAX_PASSKEYS) as Record<string,unknown>[]).map((row)=>Object.freeze({id:String(row.id),revision:Number(row.revision),displayName:String(row.display_name),relyingPartyId:String(row.relying_party_id),transports:parseStringArray<PasskeyCredentialRow['transports'][number]>(row.transports_json,5),status:String(row.status) as 'active'|'revoked',createdAt:asIsoDateTime(String(row.created_at)),...(row.last_used_at?{lastUsedAt:asIsoDateTime(String(row.last_used_at))}:{}),...(row.revoked_at?{revokedAt:asIsoDateTime(String(row.revoked_at))}:{})}));const federatedLinks=(db.prepare(`SELECT link.id,link.revision,link.provider,link.granted_scopes_json,link.status,link.linked_at,link.last_locally_verified_at,link.revoked_at FROM identity_federated_links link JOIN identity_federated_provider_configurations config ON config.provider=link.provider AND config.configured=1 AND config.configuration_id=link.configuration_id AND config.authorization_endpoint_sha256=link.authorization_endpoint_sha256 AND config.client_configuration_sha256=link.client_configuration_sha256 WHERE link.family_id=? AND link.account_id=? AND link.owner_person_id=? ORDER BY link.id LIMIT ?`).all(key.familyId,key.accountId,key.ownerPersonId,MAX_LINKS) as Record<string,unknown>[]).map((row)=>Object.freeze({id:String(row.id),revision:Number(row.revision),provider:String(row.provider) as FederatedIdentityLinkRow['provider'],grantedScopes:parseStringArray<string>(row.granted_scopes_json,16),status:String(row.status) as 'linked'|'revoked',linkedAt:asIsoDateTime(String(row.linked_at)),lastLocallyVerifiedAt:asIsoDateTime(String(row.last_locally_verified_at)),...(row.revoked_at?{revokedAt:asIsoDateTime(String(row.revoked_at))}:{})}));const temporaryCredentials=(db.prepare(`SELECT id,revision,kind,purpose,disclosed_claim_keys_json,status,not_before,expires_at,issued_at,revoked_at FROM identity_temporary_credentials WHERE family_id=? AND account_id=? AND owner_person_id=? ORDER BY id LIMIT ?`).all(key.familyId,key.accountId,key.ownerPersonId,MAX_TEMPORARY_CREDENTIALS) as Record<string,unknown>[]).map((row)=>Object.freeze({id:String(row.id),revision:Number(row.revision),kind:String(row.kind) as TemporaryVerifiableCredentialRow['kind'],purpose:String(row.purpose) as TemporaryVerifiableCredentialRow['purpose'],disclosedClaimKeys:parseStringArray<TemporaryVerifiableCredentialRow['disclosedClaimKeys'][number]>(row.disclosed_claim_keys_json,8),status:String(row.status) as 'active'|'revoked',notBefore:asIsoDateTime(String(row.not_before)),expiresAt:asIsoDateTime(String(row.expires_at)),issuedAt:asIsoDateTime(String(row.issued_at)),...(row.revoked_at?{revokedAt:asIsoDateTime(String(row.revoked_at))}:{})}));return Object.freeze({schemaVersion:1,sourceVersion,passkeys:Object.freeze(passkeys),federatedLinks:Object.freeze(federatedLinks),temporaryCredentials:Object.freeze(temporaryCredentials),sourceAuthority:'windows_single_writer',remoteWritesAccepted:false});});}
  public recordCompanionSnapshot(context:PolicyAuthorizedRepositoryExecutionContext,row:CompanionSyncSnapshotRow):RepositoryResult<void>{if(!SHA256.test(row.ciphertextSha256)||!SHA256.test(row.envelopeSha256)||row.envelopeBytes>8_388_608||!row.encrypted||!row.readOnly||row.remoteWritesAccepted)throw new Error('Companion snapshot must be bounded encrypted read-only metadata');const policy=policyScope(context,row.key,'companion_sync_snapshot',row.id,['create']);return this.execute(context,()=>{const db=this.database(context);db.prepare(`DELETE FROM identity_companion_snapshots WHERE account_id=? AND julianday(expires_at)<=julianday(?) AND julianday(expires_at)<=julianday('now')`).run(row.accountId,context.occurredAt);db.prepare(`INSERT INTO identity_companion_snapshots(id,family_id,account_id,owner_person_id,trusted_device_id,protocol_version,source_version,schema_version,ciphertext_sha256,envelope_sha256,envelope_bytes,security_epoch,generated_at,expires_at,policy_receipt_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.accountId,row.ownerPersonId,row.trustedDeviceId,1,row.sourceVersion,row.schemaVersion,row.ciphertextSha256,row.envelopeSha256,row.envelopeBytes,row.securityEpoch,row.generatedAt,row.expiresAt,policy.receiptHash);});}
  public findMutationByClientOperationId(context:PolicyAuthorizedRepositoryExecutionContext,key:IdentityAccessAggregateKey,clientOperationId:string):RepositoryResult<IdentityAccessMutationRow|null>{operationScope(context,key,['passkey_credential','federated_identity_link','temporary_verifiable_credential'],['create','update','delete']);return this.execute(context,()=>{const auth=context.policyAuthorization;const row=this.database(context).prepare(`SELECT * FROM identity_access_mutations WHERE family_id=? AND account_id=? AND owner_person_id=? AND client_operation_id=? AND resource_type=? AND resource_id=?`).get(key.familyId,key.accountId,key.ownerPersonId,clientOperationId,auth.resourceType,auth.resourceId) as Record<string,unknown>|undefined;return row?mapMutation(row):null;});}
  public insertMutation(context:PolicyAuthorizedRepositoryExecutionContext,row:IdentityAccessMutationRow):RepositoryResult<void>{if(!SHA256.test(row.requestFingerprint)||!SHA256.test(row.stateFingerprint)||row.revision!==row.previousRevision+1||row.clientOperationId.length>160)throw new Error('Identity access mutation fingerprint, operation token or revision is invalid');const key=keyOfRow(row);const action=row.mutationKind.endsWith('_revoke')||row.mutationKind==='federated_unlink'||row.mutationKind==='passkey_recover_lost'?'delete':row.previousRevision===0?'create':'update';const policy=policyScope(context,key,row.resourceType,row.resourceId,[action]);return this.execute(context,()=>{const db=this.database(context);db.prepare(`DELETE FROM identity_access_mutations WHERE account_id=? AND julianday(occurred_at)<=julianday(?)-7
        AND NOT EXISTS(SELECT 1 FROM identity_passkey_challenges challenge WHERE challenge.consumption_mutation_id=identity_access_mutations.id)
        AND NOT EXISTS(SELECT 1 FROM identity_passkey_credentials current WHERE current.last_mutation_id=identity_access_mutations.id)
        AND NOT EXISTS(SELECT 1 FROM identity_federated_links current WHERE current.last_mutation_id=identity_access_mutations.id)
        AND NOT EXISTS(SELECT 1 FROM identity_temporary_credentials current WHERE current.last_mutation_id=identity_access_mutations.id)
        AND NOT EXISTS(SELECT 1 FROM identity_passkey_credential_tombstones tombstone WHERE tombstone.final_mutation_id=identity_access_mutations.id)
        AND NOT EXISTS(SELECT 1 FROM identity_temporary_credential_tombstones tombstone WHERE tombstone.final_mutation_id=identity_access_mutations.id)`).run(row.accountId,row.createdAt);db.prepare(`INSERT INTO identity_access_mutations(id,client_operation_id,request_fingerprint,state_fingerprint,family_id,account_id,owner_person_id,mutation_kind,resource_type,resource_id,previous_revision,revision,policy_receipt_hash,occurred_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.clientOperationId,row.requestFingerprint,row.stateFingerprint,row.familyId,row.accountId,row.ownerPersonId,row.mutationKind,row.resourceType,row.resourceId,row.previousRevision,row.revision,policy.receiptHash,row.createdAt);});}
}
