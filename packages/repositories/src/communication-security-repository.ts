import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import {
  COMMUNICATION_SECURITY_STORAGE_LIMITS,
  type CommunicationDeviceCredentialStatus,
  type CommunicationHistoryAccessMode,
  type CommunicationMembershipRole,
  type CommunicationMembershipStatus,
  type CommunicationMlsEpochReason,
  type CommunicationRoomStatus,
  type CommunicationRoomType,
  type CommunicationSecurityMutationKind,
  type CommunicationSecurityResourceType
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type CommunicationDeviceCredentialRow,
  type CommunicationMlsEpochRow,
  type CommunicationRoomMembershipRow,
  type CommunicationRoomRow,
  type CommunicationRoomSnapshotRow,
  type CommunicationSecurityCenterKey,
  type CommunicationSecurityCenterSnapshotRow,
  type CommunicationSecurityMutationRow,
  type CommunicationSecurityStorageUsageRow,
  type CommunicationSecurityPolicyResourceRepositoryPort,
  type CommunicationSecurityRepositoryPort,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const deviceSelect = `SELECT id,family_id,account_id,owner_person_id,trusted_device_id,device_credential_sha256,
  key_package_sha256,sealed_credential_reference,provider_id,provider_implementation,provider_attestation_sha256,
  provider_evidence_verified,status,revision,state_fingerprint,last_mutation_id,created_at,updated_at,revoked_at
  FROM communication_device_credentials`;
const roomSelect = `SELECT id,family_id,account_id,owner_person_id,display_name,room_type,scope_resource_type,
  scope_resource_id,masked_room_ref_sha256,provider_group_id_sha256,status,history_access_mode,current_epoch,
  current_epoch_id,revision,state_fingerprint,last_mutation_id,created_at,updated_at FROM communication_rooms`;
const membershipSelect = `SELECT id,family_id,owner_person_id,room_id,member_person_id,device_credential_id,role,status,
  joined_at_epoch,history_visible_from_epoch,removed_at_epoch,revision,state_fingerprint,last_mutation_id,created_at,updated_at
  FROM communication_room_memberships`;
const epochSelect = `SELECT id,family_id,owner_person_id,room_id,epoch,cipher_suite,group_id_sha256,commit_sha256,
  confirmed_transcript_hash_sha256,group_context_sha256,membership_digest_sha256,sealed_state_reference,provider_id,
  provider_implementation,provider_attestation_sha256,provider_evidence_verified,active_device_credential_count,
  reason,previous_epoch,previous_commit_sha256,previous_confirmed_transcript_hash_sha256,mutation_id,created_at
  FROM communication_mls_epochs`;
const mutationSelect = `SELECT id,family_id,owner_person_id,resource_type,resource_id,actor_account_id,actor_person_id,
  mutation_kind,client_operation_id,request_fingerprint,expected_revision,revision,resource_state_fingerprint,occurred_at
  FROM communication_security_mutations`;

const mapDevice = (row: Record<string, unknown>): CommunicationDeviceCredentialRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), accountId: String(row.account_id),
  ownerPersonId: asPersonId(String(row.owner_person_id)), trustedDeviceId: String(row.trusted_device_id),
  deviceCredentialSha256: String(row.device_credential_sha256), keyPackageSha256: String(row.key_package_sha256),
  sealedCredentialReference: String(row.sealed_credential_reference), providerId: String(row.provider_id),
  providerImplementation: String(row.provider_implementation), providerAttestationSha256: String(row.provider_attestation_sha256),
  providerEvidenceVerified: true, status: String(row.status) as CommunicationDeviceCredentialStatus,
  revision: Number(row.revision), stateFingerprint: String(row.state_fingerprint), lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at)),
  ...(row.revoked_at ? { revokedAt: asIsoDateTime(String(row.revoked_at)) } : {})
});
const mapRoom = (row: Record<string, unknown>): CommunicationRoomRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), accountId: String(row.account_id),
  ownerPersonId: asPersonId(String(row.owner_person_id)), displayName: String(row.display_name),
  roomType: String(row.room_type) as CommunicationRoomType,
  ...(row.scope_resource_type ? { scopeResourceType: String(row.scope_resource_type) as NonNullable<CommunicationRoomRow['scopeResourceType']> } : {}),
  ...(row.scope_resource_id ? { scopeResourceId: String(row.scope_resource_id) } : {}),
  maskedRoomRefSha256: String(row.masked_room_ref_sha256), providerGroupIdSha256: String(row.provider_group_id_sha256),
  status: String(row.status) as CommunicationRoomStatus,
  historyAccessMode: String(row.history_access_mode) as CommunicationHistoryAccessMode,
  currentEpoch: Number(row.current_epoch), currentEpochId: String(row.current_epoch_id), revision: Number(row.revision),
  stateFingerprint: String(row.state_fingerprint), lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapMembership = (row: Record<string, unknown>): CommunicationRoomMembershipRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  roomId: String(row.room_id), memberPersonId: asPersonId(String(row.member_person_id)),
  deviceCredentialId: String(row.device_credential_id), role: String(row.role) as CommunicationMembershipRole,
  status: String(row.status) as CommunicationMembershipStatus, joinedAtEpoch: Number(row.joined_at_epoch),
  historyVisibleFromEpoch: Number(row.history_visible_from_epoch),
  ...(row.removed_at_epoch === null || row.removed_at_epoch === undefined ? {} : { removedAtEpoch: Number(row.removed_at_epoch) }),
  revision: Number(row.revision), stateFingerprint: String(row.state_fingerprint), lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapEpoch = (row: Record<string, unknown>): CommunicationMlsEpochRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  roomId: String(row.room_id), epoch: Number(row.epoch), cipherSuite: 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519',
  groupIdSha256: String(row.group_id_sha256), commitSha256: String(row.commit_sha256),
  confirmedTranscriptHashSha256: String(row.confirmed_transcript_hash_sha256), groupContextSha256: String(row.group_context_sha256),
  membershipDigestSha256: String(row.membership_digest_sha256), sealedStateReference: String(row.sealed_state_reference),
  providerId: String(row.provider_id), providerImplementation: String(row.provider_implementation),
  providerAttestationSha256: String(row.provider_attestation_sha256), providerEvidenceVerified: true,
  activeDeviceCredentialCount: Number(row.active_device_credential_count), reason: String(row.reason) as CommunicationMlsEpochReason,
  ...(row.previous_epoch === null || row.previous_epoch === undefined ? {} : { previousEpoch: Number(row.previous_epoch) }),
  ...(row.previous_commit_sha256 ? { previousCommitSha256: String(row.previous_commit_sha256) } : {}),
  ...(row.previous_confirmed_transcript_hash_sha256
    ? { previousConfirmedTranscriptHashSha256: String(row.previous_confirmed_transcript_hash_sha256) } : {}),
  mutationId: String(row.mutation_id), createdAt: asIsoDateTime(String(row.created_at))
});
const mapMutation = (row: Record<string, unknown>): CommunicationSecurityMutationRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  resourceType: String(row.resource_type) as CommunicationSecurityResourceType, resourceId: String(row.resource_id),
  actorAccountId: String(row.actor_account_id), actorPersonId: asPersonId(String(row.actor_person_id)),
  mutationKind: String(row.mutation_kind) as CommunicationSecurityMutationKind,
  clientOperationId: String(row.client_operation_id), requestFingerprint: String(row.request_fingerprint),
  expectedRevision: Number(row.expected_revision), revision: Number(row.revision),
  resourceStateFingerprint: String(row.resource_state_fingerprint), occurredAt: asIsoDateTime(String(row.occurred_at))
});

const assertKey = (context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationSecurityCenterKey, mode: 'read' | 'write'): void => {
  const resourceType = mode === 'read' ? 'communication_security_center' : context.policyAuthorization.resourceType;
  assertPolicyAuthorizedRepositoryContext(context, { resourceType, resourceId: mode === 'read' ? '*' : context.policyAuthorization.resourceId,
    action: context.policyAuthorization.action, capability: mode === 'read' ? 'family.read' : 'family.write',
    correlationId: context.correlationId, resourceFamilyId: key.familyId });
  const authorization = context.policyAuthorization;
  if (authorization.purpose !== 'general' || authorization.subject.accountId !== key.accountId
    || authorization.subject.personId !== key.actorPersonId || !authorization.subject.familyIds.includes(key.familyId)
    || authorization.resourceFamilyId !== key.familyId
    || authorization.receiptRecord.request.resource.ownerPersonId !== key.ownerPersonId
    || authorization.receiptRecord.request.resource.sensitivity !== 'highly_sensitive'
    || key.centerId !== `communication-security:${key.familyId}:${key.ownerPersonId}`
    || (mode === 'read' && (authorization.action !== 'read' || key.actorPersonId !== key.ownerPersonId))
    || (mode === 'write' && !['communication_device_credential','communication_room'].includes(authorization.resourceType))
    || (mode === 'write' && !['create','update','delete'].includes(authorization.action))) {
    throw new Error('Communication security key does not match the exact owner policy receipt');
  }
};
const expectedAction = (kind: CommunicationSecurityMutationKind): 'create' | 'update' | 'delete' => {
  if (kind === 'device_credential_register' || kind === 'room_create') return 'create';
  if (kind === 'device_credential_revoke' || kind === 'room_freeze') return 'delete';
  return 'update';
};
const writeBinding = (context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationSecurityMutationRow) => {
  const binding = platformPolicyPersistenceBinding(context, row.resourceType, row.resourceId);
  if (!binding || binding.resourceFamilyId !== row.familyId || binding.purpose !== 'general'
    || binding.capability !== 'family.write' || binding.occurredAt !== row.occurredAt
    || binding.action !== expectedAction(row.mutationKind)) throw new Error('Communication mutation requires an exact durable policy receipt');
  return binding;
};
const currentBinding = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  resourceType: CommunicationSecurityResourceType,
  resourceId: string,
  familyId: string
) => {
  assertPolicyAuthorizedRepositoryContext(context, { resourceType, resourceId, action: context.policyAuthorization.action,
    capability: 'family.write', correlationId: context.correlationId, resourceFamilyId: asFamilyId(familyId) });
  const binding = platformPolicyPersistenceBinding(context, resourceType, resourceId);
  if (!binding || binding.purpose !== 'general') throw new Error('Communication current row receipt is missing');
  return binding;
};

export class SqliteCommunicationSecurityRepository extends SqliteRepository implements
  CommunicationSecurityRepositoryPort, CommunicationSecurityPolicyResourceRepositoryPort {
  public resolvePolicyResource(
    context: RepositoryExecutionContext,
    resourceType: CommunicationSecurityResourceType,
    resourceId: string
  ): ReturnType<CommunicationSecurityPolicyResourceRepositoryPort['resolvePolicyResource']> {
    return this.execute(context, () => {
      const table = resourceType === 'communication_room' ? 'communication_rooms' : 'communication_device_credentials';
      const statusColumn = resourceType === 'communication_room' ? 'status' : 'status';
      const row = this.database(context).prepare(`SELECT id,family_id,owner_person_id,revision,${statusColumn} status,state_fingerprint
        FROM ${table} WHERE id=?`).get(resourceId) as Record<string, unknown> | undefined;
      return row ? Object.freeze({ id: String(row.id), familyId: asFamilyId(String(row.family_id)),
        ownerPersonId: asPersonId(String(row.owner_person_id)), revision: Number(row.revision),
        status: String(row.status) as CommunicationDeviceCredentialStatus | CommunicationRoomStatus,
        stateFingerprint: String(row.state_fingerprint) }) : null;
    });
  }

  public getStorageUsage(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationSecurityCenterKey,
    roomId?: string
  ): RepositoryResult<CommunicationSecurityStorageUsageRow> {
    assertKey(context, key, 'write');
    if (roomId !== undefined && context.policyAuthorization.resourceType !== 'communication_room') {
      throw new Error('Communication room storage usage requires an exact room receipt');
    }
    return this.execute(context, () => {
      const database = this.database(context);
      const count = (table: string, suffix = '', parameters: readonly unknown[] = []): number => Number(
        (database.prepare(`SELECT COUNT(*) count FROM ${table} WHERE family_id=? AND owner_person_id=?${suffix}`)
          .get(key.familyId, key.ownerPersonId, ...parameters) as { count: number }).count
      );
      return Object.freeze({
        deviceCredentialCount: count('communication_device_credentials'),
        roomCount: count('communication_rooms'),
        mutationCount: count('communication_security_mutations'),
        membershipCount: roomId === undefined ? 0 : count('communication_room_memberships', ' AND room_id=?', [roomId]),
        epochCount: roomId === undefined ? 0 : count('communication_mls_epochs', ' AND room_id=?', [roomId])
      });
    });
  }

  public loadCenter(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationSecurityCenterKey)
  : RepositoryResult<CommunicationSecurityCenterSnapshotRow> {
    assertKey(context, key, 'read');
    return this.execute(context, () => {
      const limits = COMMUNICATION_SECURITY_STORAGE_LIMITS;
      const deviceRows = this.database(context).prepare(`${deviceSelect} WHERE family_id=? AND owner_person_id=? ORDER BY updated_at DESC,id LIMIT ${limits.deviceCredentialsPerOwner + 1}`)
        .all(key.familyId, key.ownerPersonId) as Record<string, unknown>[];
      const roomRows = this.database(context).prepare(`${roomSelect} WHERE family_id=? AND owner_person_id=? ORDER BY updated_at DESC,id LIMIT ${limits.roomsPerOwner + 1}`)
        .all(key.familyId, key.ownerPersonId) as Record<string, unknown>[];
      if (deviceRows.length > limits.deviceCredentialsPerOwner || roomRows.length > limits.roomsPerOwner)
        throw new Error('Communication center exceeds its bounded metadata contract');
      const rooms: CommunicationRoomSnapshotRow[] = roomRows.map((raw) => {
        const room = mapRoom(raw);
        const membershipsRaw = this.database(context).prepare(`${membershipSelect} WHERE family_id=? AND owner_person_id=? AND room_id=? ORDER BY created_at,id LIMIT ${limits.membershipsPerRoom + 1}`)
          .all(key.familyId, key.ownerPersonId, room.id) as Record<string, unknown>[];
        if (membershipsRaw.length > limits.membershipsPerRoom) throw new Error('Communication room membership contract is exceeded');
        const epochRaw = this.database(context).prepare(`${epochSelect} WHERE id=? AND family_id=? AND owner_person_id=? AND room_id=? AND epoch=?`)
          .get(room.currentEpochId, key.familyId, key.ownerPersonId, room.id, room.currentEpoch) as Record<string, unknown> | undefined;
        if (!epochRaw) throw new Error('Communication current epoch binding is missing');
        const epochCount = Number((this.database(context).prepare(`SELECT COUNT(*) count FROM communication_mls_epochs
          WHERE family_id=? AND owner_person_id=? AND room_id=?`).get(key.familyId, key.ownerPersonId, room.id) as { count: number }).count);
        if (epochCount > limits.epochsPerRoom) throw new Error('Communication room epoch contract is exceeded');
        return Object.freeze({ room, memberships: Object.freeze(membershipsRaw.map(mapMembership)),
          currentEpoch: mapEpoch(epochRaw), epochCount });
      });
      const mutationCount = Number((this.database(context).prepare(`SELECT COUNT(*) count FROM communication_security_mutations
        WHERE family_id=? AND owner_person_id=?`).get(key.familyId, key.ownerPersonId) as { count: number }).count);
      if (mutationCount > limits.mutationsPerOwner) throw new Error('Communication mutation contract is exceeded');
      return Object.freeze({ deviceCredentials: Object.freeze(deviceRows.map(mapDevice)), rooms: Object.freeze(rooms), mutationCount });
    });
  }

  public findDeviceCredential(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationSecurityCenterKey, credentialId: string) {
    assertKey(context, key, 'write');
    return this.execute(context, () => {
      const row = this.database(context).prepare(`${deviceSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
        .get(credentialId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined;
      return row ? mapDevice(row) : null;
    });
  }
  public findDeviceCredentialByTrustedDeviceId(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationSecurityCenterKey, trustedDeviceId: string) {
    assertKey(context, key, 'write');
    return this.execute(context, () => {
      const row = this.database(context).prepare(`${deviceSelect} WHERE family_id=? AND owner_person_id=? AND trusted_device_id=?`)
        .get(key.familyId, key.ownerPersonId, trustedDeviceId) as Record<string, unknown> | undefined;
      return row ? mapDevice(row) : null;
    });
  }
  public findFamilyDeviceCredentialForRoom(context: PolicyAuthorizedRepositoryExecutionContext, familyId: CommunicationSecurityCenterKey['familyId'], credentialId: string) {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType: 'communication_room', resourceId: context.policyAuthorization.resourceId,
      action: context.policyAuthorization.action, capability: 'family.write', correlationId: context.correlationId, resourceFamilyId: familyId });
    if (context.policyAuthorization.purpose !== 'general' || context.policyAuthorization.receiptRecord.request.resource.sensitivity !== 'highly_sensitive')
      throw new Error('Family device credential lookup requires an exact communication room receipt');
    return this.execute(context, () => {
      const row = this.database(context).prepare(`${deviceSelect} WHERE id=? AND family_id=?`).get(credentialId, familyId) as Record<string, unknown> | undefined;
      return row ? mapDevice(row) : null;
    });
  }
  public findRoom(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationSecurityCenterKey, roomId: string) {
    assertKey(context, key, 'write');
    return this.execute(context, () => {
      const row = this.database(context).prepare(`${roomSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
        .get(roomId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined;
      return row ? mapRoom(row) : null;
    });
  }
  public listMemberships(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationSecurityCenterKey, roomId: string) {
    assertKey(context, key, 'write');
    return this.execute(context, () => {
      const rows = this.database(context).prepare(`${membershipSelect} WHERE family_id=? AND owner_person_id=? AND room_id=? ORDER BY created_at,id LIMIT ${COMMUNICATION_SECURITY_STORAGE_LIMITS.membershipsPerRoom + 1}`)
        .all(key.familyId, key.ownerPersonId, roomId) as Record<string, unknown>[];
      if (rows.length > COMMUNICATION_SECURITY_STORAGE_LIMITS.membershipsPerRoom)
        throw new Error('Communication membership read exceeds its bound');
      return Object.freeze(rows.map(mapMembership));
    });
  }
  public findMembership(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationSecurityCenterKey, membershipId: string) {
    assertKey(context, key, 'write');
    return this.execute(context, () => {
      const row = this.database(context).prepare(`${membershipSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
        .get(membershipId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined;
      return row ? mapMembership(row) : null;
    });
  }
  public findEpoch(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationSecurityCenterKey, roomId: string, epoch: number) {
    assertKey(context, key, 'write');
    return this.execute(context, () => {
      const row = this.database(context).prepare(`${epochSelect} WHERE family_id=? AND owner_person_id=? AND room_id=? AND epoch=?`)
        .get(key.familyId, key.ownerPersonId, roomId, epoch) as Record<string, unknown> | undefined;
      return row ? mapEpoch(row) : null;
    });
  }
  public findMutationByClientOperationId(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationSecurityCenterKey, clientOperationId: string) {
    assertKey(context, key, 'write');
    return this.execute(context, () => {
      const row = this.database(context).prepare(`${mutationSelect} WHERE family_id=? AND actor_account_id=? AND client_operation_id=?`)
        .get(key.familyId, key.accountId, clientOperationId) as Record<string, unknown> | undefined;
      return row ? mapMutation(row) : null;
    });
  }

  public insertMutation(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationSecurityMutationRow): RepositoryResult<void> {
    const binding = writeBinding(context, row);
    if (row.actorAccountId !== context.policyAuthorization.subject.accountId || row.actorPersonId !== context.policyAuthorization.subject.personId
      || row.ownerPersonId !== context.policyAuthorization.receiptRecord.request.resource.ownerPersonId || row.revision !== row.expectedRevision + 1)
      throw new Error('Communication mutation identity or revision is invalid');
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO communication_security_mutations(
      id,family_id,owner_person_id,resource_type,resource_id,actor_account_id,actor_person_id,mutation_kind,
      client_operation_id,request_fingerprint,expected_revision,revision,resource_state_fingerprint,occurred_at,
      policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,policy_resource_type,
      policy_resource_id,policy_action,policy_capability) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(row.id,row.familyId,row.ownerPersonId,row.resourceType,row.resourceId,row.actorAccountId,row.actorPersonId,row.mutationKind,
        row.clientOperationId,row.requestFingerprint,row.expectedRevision,row.revision,row.resourceStateFingerprint,row.occurredAt,
        binding.receiptHash,binding.receiptVersion,binding.nonce,context.correlationId,binding.resourceType,binding.resourceId,
        binding.action,binding.capability); });
  }
  public insertDeviceCredential(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationDeviceCredentialRow) {
    const binding = currentBinding(context, 'communication_device_credential', row.id, row.familyId);
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO communication_device_credentials(
      id,family_id,account_id,owner_person_id,trusted_device_id,device_credential_sha256,key_package_sha256,
      sealed_credential_reference,provider_id,provider_implementation,provider_attestation_sha256,provider_evidence_verified,
      status,revision,state_fingerprint,last_mutation_id,created_at,updated_at,revoked_at,policy_receipt_hash)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.accountId,row.ownerPersonId,row.trustedDeviceId,
        row.deviceCredentialSha256,row.keyPackageSha256,row.sealedCredentialReference,row.providerId,row.providerImplementation,
        row.providerAttestationSha256,1,row.status,row.revision,row.stateFingerprint,row.lastMutationId,row.createdAt,row.updatedAt,
        row.revokedAt??null,binding.receiptHash); });
  }
  public saveDeviceCredential(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationDeviceCredentialRow, expectedRevision: number) {
    const binding = currentBinding(context, 'communication_device_credential', row.id, row.familyId);
    return this.execute(context, () => {
      const result = this.database(context).prepare(`UPDATE communication_device_credentials SET status=?,revision=?,state_fingerprint=?,
        last_mutation_id=?,updated_at=?,revoked_at=?,policy_receipt_hash=? WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`)
        .run(row.status,row.revision,row.stateFingerprint,row.lastMutationId,row.updatedAt,row.revokedAt??null,binding.receiptHash,
          row.id,row.familyId,row.ownerPersonId,expectedRevision);
      if (Number(result.changes) !== 1) throw new Error('Communication device credential optimistic revision conflict');
    });
  }
  public insertEpoch(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationMlsEpochRow) {
    const binding = currentBinding(context, 'communication_room', row.roomId, row.familyId);
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO communication_mls_epochs(
      id,family_id,owner_person_id,room_id,epoch,cipher_suite,group_id_sha256,commit_sha256,
      confirmed_transcript_hash_sha256,group_context_sha256,membership_digest_sha256,sealed_state_reference,
      provider_id,provider_implementation,provider_attestation_sha256,provider_evidence_verified,
      active_device_credential_count,reason,previous_epoch,previous_commit_sha256,previous_confirmed_transcript_hash_sha256,
      mutation_id,created_at,policy_receipt_hash)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.roomId,row.epoch,
        row.cipherSuite,row.groupIdSha256,row.commitSha256,row.confirmedTranscriptHashSha256,row.groupContextSha256,
        row.membershipDigestSha256,row.sealedStateReference,row.providerId,row.providerImplementation,row.providerAttestationSha256,
        1,row.activeDeviceCredentialCount,row.reason,row.previousEpoch??null,row.previousCommitSha256??null,
        row.previousConfirmedTranscriptHashSha256??null,row.mutationId,row.createdAt,binding.receiptHash); });
  }
  public insertRoom(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationRoomRow) {
    const binding = currentBinding(context, 'communication_room', row.id, row.familyId);
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO communication_rooms(
      id,family_id,account_id,owner_person_id,display_name,room_type,scope_resource_type,scope_resource_id,
      masked_room_ref_sha256,provider_group_id_sha256,status,history_access_mode,current_epoch,current_epoch_id,
      revision,state_fingerprint,last_mutation_id,created_at,updated_at,policy_receipt_hash)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.accountId,row.ownerPersonId,row.displayName,
        row.roomType,row.scopeResourceType??null,row.scopeResourceId??null,row.maskedRoomRefSha256,row.providerGroupIdSha256,
        row.status,row.historyAccessMode,row.currentEpoch,row.currentEpochId,row.revision,row.stateFingerprint,row.lastMutationId,
        row.createdAt,row.updatedAt,binding.receiptHash); });
  }
  public saveRoom(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationRoomRow, expectedRevision: number) {
    const binding = currentBinding(context, 'communication_room', row.id, row.familyId);
    return this.execute(context, () => {
      const result = this.database(context).prepare(`UPDATE communication_rooms SET status=?,history_access_mode=?,current_epoch=?,
        current_epoch_id=?,revision=?,state_fingerprint=?,last_mutation_id=?,updated_at=?,policy_receipt_hash=?
        WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`).run(row.status,row.historyAccessMode,row.currentEpoch,
          row.currentEpochId,row.revision,row.stateFingerprint,row.lastMutationId,row.updatedAt,binding.receiptHash,
          row.id,row.familyId,row.ownerPersonId,expectedRevision);
      if (Number(result.changes) !== 1) throw new Error('Communication room optimistic revision conflict');
    });
  }
  public insertMembership(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationRoomMembershipRow) {
    const binding = currentBinding(context, 'communication_room', row.roomId, row.familyId);
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO communication_room_memberships(
      id,family_id,owner_person_id,room_id,member_person_id,device_credential_id,role,status,joined_at_epoch,
      history_visible_from_epoch,removed_at_epoch,revision,state_fingerprint,last_mutation_id,created_at,updated_at,policy_receipt_hash)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.roomId,row.memberPersonId,
        row.deviceCredentialId,row.role,row.status,row.joinedAtEpoch,row.historyVisibleFromEpoch,row.removedAtEpoch??null,
        row.revision,row.stateFingerprint,row.lastMutationId,row.createdAt,row.updatedAt,binding.receiptHash); });
  }
  public saveMembership(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationRoomMembershipRow, expectedRevision: number) {
    const binding = currentBinding(context, 'communication_room', row.roomId, row.familyId);
    return this.execute(context, () => {
      const result = this.database(context).prepare(`UPDATE communication_room_memberships SET role=?,status=?,joined_at_epoch=?,
        history_visible_from_epoch=?,removed_at_epoch=?,revision=?,state_fingerprint=?,last_mutation_id=?,updated_at=?,policy_receipt_hash=?
        WHERE id=? AND family_id=? AND owner_person_id=? AND room_id=? AND revision=?`).run(row.role,row.status,row.joinedAtEpoch,
          row.historyVisibleFromEpoch,row.removedAtEpoch??null,row.revision,row.stateFingerprint,row.lastMutationId,row.updatedAt,binding.receiptHash,
          row.id,row.familyId,row.ownerPersonId,row.roomId,expectedRevision);
      if (Number(result.changes) !== 1) throw new Error('Communication membership optimistic revision conflict');
    });
  }
}
