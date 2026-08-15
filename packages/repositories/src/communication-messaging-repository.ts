import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type {
  CommunicationMessageContentKind,
  CommunicationMessageDeliveryState,
  CommunicationMessageEventKind,
  CommunicationMessageRetentionMode,
  CommunicationMessageState,
  CommunicationMessagingMutationKind,
  CommunicationMessagingResourceType,
  CommunicationPresenceAudience,
  CommunicationPresenceStatus,
  CommunicationPublicAvailability,
  CommunicationHistoryAccessMode,
  CommunicationMembershipRole,
  CommunicationMembershipStatus,
  CommunicationRoomStatus,
  CommunicationRoomType,
  SearchCommunicationMessagesInput
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type CommunicationDeliveryQueueRow,
  type CommunicationMessageEventRow,
  type CommunicationMessageRow,
  type CommunicationMessagingCenterKey,
  type CommunicationMessagingCenterSnapshotRow,
  type CommunicationMessagingMutationRow,
  type CommunicationMessagingPolicyResourceRepositoryPort,
  type CommunicationMessagingRepositoryPort,
  type CommunicationMessagingRoomGuardRow,
  type CommunicationPresenceRow,
  type CommunicationRetentionPolicyRow,
  type CommunicationRoomMembershipRow,
  type CommunicationRoomRow,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const messageSelect = `SELECT id,family_id,owner_person_id,room_id,sender_account_id,sender_person_id,
  content_kind,content_mime,sealed_payload_reference,payload_sha256,payload_size_bytes,provider_id,
  provider_evidence_sha256,payload_revision,payload_created_at,reply_to_message_id,quoted_message_id,thread_root_message_id,state,
  delivery_state,scheduled_at,silent,pinned,bookmarked,reaction_code,edit_count,revision,state_fingerprint,
  last_mutation_id,created_at,updated_at,deleted_at,expires_at FROM communication_messages`;
const presenceSelect = `SELECT id,family_id,owner_person_id,person_id,status,public_availability,audience,
  last_seen_shared,typing_indicators_enabled,read_receipts_enabled,emergency_reachability_enabled,
  expires_at,revision,state_fingerprint,last_mutation_id,created_at,updated_at FROM communication_presence_profiles`;
const retentionSelect = `SELECT id,family_id,owner_person_id,room_id,mode,duration_days,legal_hold_reason_sha256,
  revision,state_fingerprint,last_mutation_id,created_at,updated_at FROM communication_retention_policies`;
const mutationSelect = `SELECT id,family_id,owner_person_id,resource_type,resource_id,actor_account_id,
  actor_person_id,mutation_kind,client_operation_id,request_fingerprint,expected_revision,revision,
  resource_state_fingerprint,occurred_at FROM communication_messaging_mutations`;
const deliverySelect = `SELECT message_id,family_id,owner_person_id,state,attempt_count,next_attempt_at,revision,
  last_mutation_id,created_at,updated_at FROM communication_delivery_queue`;
const roomSelect = `SELECT id,family_id,account_id,owner_person_id,display_name,room_type,scope_resource_type,
  scope_resource_id,masked_room_ref_sha256,provider_group_id_sha256,status,history_access_mode,current_epoch,
  current_epoch_id,revision,state_fingerprint,last_mutation_id,created_at,updated_at FROM communication_rooms`;
const membershipSelect = `SELECT id,family_id,owner_person_id,room_id,member_person_id,device_credential_id,
  role,status,joined_at_epoch,history_visible_from_epoch,removed_at_epoch,revision,state_fingerprint,
  last_mutation_id,created_at,updated_at FROM communication_room_memberships`;

const mapMessage = (row: Record<string, unknown>): CommunicationMessageRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  roomId: String(row.room_id), senderAccountId: String(row.sender_account_id),
  senderPersonId: asPersonId(String(row.sender_person_id)), contentKind: String(row.content_kind) as CommunicationMessageContentKind,
  contentMime: String(row.content_mime), sealedPayloadReference: String(row.sealed_payload_reference),
  payloadSha256: String(row.payload_sha256), payloadSizeBytes: Number(row.payload_size_bytes),
  providerId: String(row.provider_id), providerEvidenceSha256: String(row.provider_evidence_sha256),
  payloadRevision: Number(row.payload_revision), payloadCreatedAt: asIsoDateTime(String(row.payload_created_at)),
  ...(row.reply_to_message_id ? { replyToMessageId: String(row.reply_to_message_id) } : {}),
  ...(row.quoted_message_id ? { quotedMessageId: String(row.quoted_message_id) } : {}),
  ...(row.thread_root_message_id ? { threadRootMessageId: String(row.thread_root_message_id) } : {}),
  state: String(row.state) as CommunicationMessageState,
  deliveryState: String(row.delivery_state) as CommunicationMessageDeliveryState,
  ...(row.scheduled_at ? { scheduledAt: asIsoDateTime(String(row.scheduled_at)) } : {}),
  silent: Number(row.silent) === 1, pinned: Number(row.pinned) === 1, bookmarked: Number(row.bookmarked) === 1,
  ...(row.reaction_code ? { reactionCode: String(row.reaction_code) } : {}), editCount: Number(row.edit_count),
  revision: Number(row.revision), stateFingerprint: String(row.state_fingerprint), lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at)),
  ...(row.deleted_at ? { deletedAt: asIsoDateTime(String(row.deleted_at)) } : {}),
  ...(row.expires_at ? { expiresAt: asIsoDateTime(String(row.expires_at)) } : {})
});
const mapPresence = (row: Record<string, unknown>): CommunicationPresenceRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  personId: asPersonId(String(row.person_id)), status: String(row.status) as CommunicationPresenceStatus,
  publicAvailability: String(row.public_availability) as CommunicationPublicAvailability,
  audience: String(row.audience) as CommunicationPresenceAudience, lastSeenShared: Number(row.last_seen_shared) === 1,
  typingIndicatorsEnabled: Number(row.typing_indicators_enabled) === 1,
  readReceiptsEnabled: Number(row.read_receipts_enabled) === 1,
  emergencyReachabilityEnabled: Number(row.emergency_reachability_enabled) === 1,
  ...(row.expires_at ? { expiresAt: asIsoDateTime(String(row.expires_at)) } : {}), revision: Number(row.revision),
  stateFingerprint: String(row.state_fingerprint), lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapRetention = (row: Record<string, unknown>): CommunicationRetentionPolicyRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  roomId: String(row.room_id), mode: String(row.mode) as CommunicationMessageRetentionMode,
  ...(row.duration_days === null || row.duration_days === undefined ? {} : { durationDays: Number(row.duration_days) }),
  ...(row.legal_hold_reason_sha256 ? { legalHoldReasonSha256: String(row.legal_hold_reason_sha256) } : {}),
  revision: Number(row.revision), stateFingerprint: String(row.state_fingerprint), lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapMutation = (row: Record<string, unknown>): CommunicationMessagingMutationRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  resourceType: String(row.resource_type) as CommunicationMessagingResourceType, resourceId: String(row.resource_id),
  actorAccountId: String(row.actor_account_id), actorPersonId: asPersonId(String(row.actor_person_id)),
  mutationKind: String(row.mutation_kind) as CommunicationMessagingMutationKind,
  clientOperationId: String(row.client_operation_id), requestFingerprint: String(row.request_fingerprint),
  expectedRevision: Number(row.expected_revision), revision: Number(row.revision),
  resourceStateFingerprint: String(row.resource_state_fingerprint), occurredAt: asIsoDateTime(String(row.occurred_at))
});
const mapDelivery = (row: Record<string, unknown>): CommunicationDeliveryQueueRow => Object.freeze({
  messageId: String(row.message_id), familyId: asFamilyId(String(row.family_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)), state: String(row.state) as CommunicationMessageDeliveryState,
  attemptCount: Number(row.attempt_count), ...(row.next_attempt_at ? { nextAttemptAt: asIsoDateTime(String(row.next_attempt_at)) } : {}),
  revision: Number(row.revision), lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapRoom = (row: Record<string, unknown>): CommunicationRoomRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), accountId: String(row.account_id),
  ownerPersonId: asPersonId(String(row.owner_person_id)), displayName: String(row.display_name),
  roomType: String(row.room_type) as CommunicationRoomType,
  ...(row.scope_resource_type ? { scopeResourceType: String(row.scope_resource_type) as NonNullable<CommunicationRoomRow['scopeResourceType']> } : {}),
  ...(row.scope_resource_id ? { scopeResourceId: String(row.scope_resource_id) } : {}),
  maskedRoomRefSha256: String(row.masked_room_ref_sha256), providerGroupIdSha256: String(row.provider_group_id_sha256),
  status: String(row.status) as CommunicationRoomStatus, historyAccessMode: String(row.history_access_mode) as CommunicationHistoryAccessMode,
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

const assertKey = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  key: CommunicationMessagingCenterKey,
  mode: 'read' | 'write'
): void => {
  const resourceType = mode === 'read' ? 'communication_messaging_center' : context.policyAuthorization.resourceType;
  assertPolicyAuthorizedRepositoryContext(context, { resourceType, resourceId: mode === 'read' ? '*' : context.policyAuthorization.resourceId,
    action: context.policyAuthorization.action, capability: mode === 'read' ? 'family.read' : 'family.write',
    correlationId: context.correlationId, resourceFamilyId: key.familyId });
  const authorization = context.policyAuthorization;
  if (authorization.purpose !== 'general' || authorization.subject.accountId !== key.accountId
    || authorization.subject.personId !== key.actorPersonId || !authorization.subject.familyIds.includes(key.familyId)
    || authorization.resourceFamilyId !== key.familyId
    || authorization.receiptRecord.request.resource.ownerPersonId !== key.ownerPersonId
    || authorization.receiptRecord.request.resource.sensitivity !== 'highly_sensitive'
    || key.centerId !== `communication-messaging:${key.familyId}:${key.ownerPersonId}`
    || key.actorPersonId !== key.ownerPersonId
    || (mode === 'read' && authorization.action !== 'read')
    || (mode === 'write' && !['communication_message','communication_presence','communication_retention_policy'].includes(authorization.resourceType))
    || (mode === 'write' && !['create','update','delete'].includes(authorization.action))) {
    throw new Error('Communication messaging key does not match the exact owner policy receipt');
  }
};
const assertAccess = (context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationMessagingCenterKey): void =>
  assertKey(context, key, context.policyAuthorization.resourceType === 'communication_messaging_center' ? 'read' : 'write');
const expectedAction = (row: CommunicationMessagingMutationRow): 'create' | 'update' | 'delete' => {
  if (row.mutationKind === 'message_create' || (['presence_update','retention_update'].includes(row.mutationKind) && row.expectedRevision === 0)) return 'create';
  return row.mutationKind === 'message_delete' ? 'delete' : 'update';
};
const writeBinding = (context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationMessagingMutationRow) => {
  const binding = platformPolicyPersistenceBinding(context, row.resourceType, row.resourceId);
  if (!binding || binding.resourceFamilyId !== row.familyId || binding.purpose !== 'general'
    || binding.capability !== 'family.write' || binding.occurredAt !== row.occurredAt
    || binding.action !== expectedAction(row)) throw new Error('Communication messaging mutation requires an exact durable policy receipt');
  return binding;
};
const currentBinding = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  resourceType: CommunicationMessagingResourceType,
  resourceId: string,
  familyId: string
) => {
  assertPolicyAuthorizedRepositoryContext(context, { resourceType, resourceId, action: context.policyAuthorization.action,
    capability: 'family.write', correlationId: context.correlationId, resourceFamilyId: asFamilyId(familyId) });
  const binding = platformPolicyPersistenceBinding(context, resourceType, resourceId);
  if (!binding || binding.purpose !== 'general' || binding.capability !== 'family.write')
    throw new Error('Communication messaging current-row receipt is missing');
  return binding;
};

export class SqliteCommunicationMessagingRepository extends SqliteRepository implements
  CommunicationMessagingRepositoryPort, CommunicationMessagingPolicyResourceRepositoryPort {
  public resolvePolicyResource(
    context: RepositoryExecutionContext,
    resourceType: CommunicationMessagingResourceType,
    resourceId: string
  ): ReturnType<CommunicationMessagingPolicyResourceRepositoryPort['resolvePolicyResource']> {
    return this.execute(context, () => {
      const table = resourceType === 'communication_message' ? 'communication_messages'
        : resourceType === 'communication_presence' ? 'communication_presence_profiles' : 'communication_retention_policies';
      const status = resourceType === 'communication_message' ? 'state'
        : resourceType === 'communication_presence' ? 'status' : 'mode';
      const row = this.database(context).prepare(`SELECT id,family_id,owner_person_id,revision,${status} status,state_fingerprint
        FROM ${table} WHERE id=?`).get(resourceId) as Record<string, unknown> | undefined;
      return row ? Object.freeze({ id: String(row.id), familyId: asFamilyId(String(row.family_id)),
        ownerPersonId: asPersonId(String(row.owner_person_id)), revision: Number(row.revision),
        status: String(row.status), stateFingerprint: String(row.state_fingerprint) }) : null;
    });
  }

  public loadCenter(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationMessagingCenterKey)
  : RepositoryResult<CommunicationMessagingCenterSnapshotRow> {
    assertKey(context, key, 'read');
    return this.execute(context, () => {
      const messages = this.database(context).prepare(`${messageSelect} WHERE family_id=? AND owner_person_id=? ORDER BY updated_at DESC,id LIMIT 10001`)
        .all(key.familyId, key.ownerPersonId) as Record<string, unknown>[];
      const retention = this.database(context).prepare(`${retentionSelect} WHERE family_id=? AND owner_person_id=? ORDER BY updated_at DESC,id LIMIT 257`)
        .all(key.familyId, key.ownerPersonId) as Record<string, unknown>[];
      if (messages.length > 10_000 || retention.length > 256) throw new Error('Communication messaging center exceeds bounded metadata limits');
      const presence = this.database(context).prepare(`${presenceSelect} WHERE family_id=? AND owner_person_id=? AND person_id=?`)
        .get(key.familyId, key.ownerPersonId, key.ownerPersonId) as Record<string, unknown> | undefined;
      return Object.freeze({ messages: Object.freeze(messages.map(mapMessage)), presence: presence ? mapPresence(presence) : null,
        retentionPolicies: Object.freeze(retention.map(mapRetention)) });
    });
  }

  public searchMessages(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationMessagingCenterKey, input: SearchCommunicationMessagesInput) {
    assertKey(context, key, 'read');
    return this.execute(context, () => {
      const clauses = ['family_id=?', 'owner_person_id=?']; const parameters: unknown[] = [key.familyId, key.ownerPersonId];
      if (input.roomId) { clauses.push('room_id=?'); parameters.push(input.roomId); }
      if (input.senderPersonId) { clauses.push('sender_person_id=?'); parameters.push(input.senderPersonId); }
      if (input.contentKind) { clauses.push('content_kind=?'); parameters.push(input.contentKind); }
      if (input.from) { clauses.push('created_at>=?'); parameters.push(input.from); }
      if (input.to) { clauses.push('created_at<=?'); parameters.push(input.to); }
      if (input.includeDeleted !== true) clauses.push("state<>'deleted'");
      const limit = Number.isSafeInteger(input.limit) && Number(input.limit) >= 1 && Number(input.limit) <= 200 ? Number(input.limit) : 100;
      const rows = this.database(context).prepare(`${messageSelect} WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC,id LIMIT ?`)
        .all(...parameters, limit) as Record<string, unknown>[];
      return Object.freeze(rows.map(mapMessage));
    });
  }

  public findRoomGuard(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationMessagingCenterKey, roomId: string) {
    assertKey(context, key, 'write');
    return this.execute(context, () => {
      const raw = this.database(context).prepare(`${roomSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
        .get(roomId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined;
      if (!raw) return null;
      const members = this.database(context).prepare(`${membershipSelect} WHERE family_id=? AND owner_person_id=? AND room_id=? ORDER BY created_at,id LIMIT 129`)
        .all(key.familyId, key.ownerPersonId, roomId) as Record<string, unknown>[];
      if (members.length > 128) throw new Error('Communication room membership guard exceeds its bound');
      return Object.freeze({ room: mapRoom(raw), memberships: Object.freeze(members.map(mapMembership)) }) satisfies CommunicationMessagingRoomGuardRow;
    });
  }
  public findMessage(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationMessagingCenterKey, messageId: string) {
    assertAccess(context, key); return this.execute(context, () => {
      const row = this.database(context).prepare(`${messageSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
        .get(messageId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined;
      return row ? mapMessage(row) : null;
    });
  }
  public findPresence(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationMessagingCenterKey) {
    assertAccess(context, key); return this.execute(context, () => {
      const row = this.database(context).prepare(`${presenceSelect} WHERE family_id=? AND owner_person_id=? AND person_id=?`)
        .get(key.familyId, key.ownerPersonId, key.ownerPersonId) as Record<string, unknown> | undefined;
      return row ? mapPresence(row) : null;
    });
  }
  public findRetentionPolicy(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationMessagingCenterKey, roomId: string) {
    assertAccess(context, key); return this.execute(context, () => {
      const row = this.database(context).prepare(`${retentionSelect} WHERE family_id=? AND owner_person_id=? AND room_id=?`)
        .get(key.familyId, key.ownerPersonId, roomId) as Record<string, unknown> | undefined;
      return row ? mapRetention(row) : null;
    });
  }
  public findDeliveryQueue(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationMessagingCenterKey, messageId: string) {
    assertAccess(context, key); return this.execute(context, () => {
      const row = this.database(context).prepare(`${deliverySelect} WHERE message_id=? AND family_id=? AND owner_person_id=?`)
        .get(messageId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined;
      return row ? mapDelivery(row) : null;
    });
  }
  public findMutationByClientOperationId(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationMessagingCenterKey, clientOperationId: string) {
    assertKey(context, key, 'write'); return this.execute(context, () => {
      const row = this.database(context).prepare(`${mutationSelect} WHERE family_id=? AND actor_account_id=? AND client_operation_id=?`)
        .get(key.familyId, key.accountId, clientOperationId) as Record<string, unknown> | undefined;
      return row ? mapMutation(row) : null;
    });
  }

  public insertMutation(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationMessagingMutationRow): RepositoryResult<void> {
    const binding = writeBinding(context, row);
    if (row.actorAccountId !== context.policyAuthorization.subject.accountId || row.actorPersonId !== context.policyAuthorization.subject.personId
      || row.ownerPersonId !== context.policyAuthorization.receiptRecord.request.resource.ownerPersonId || row.revision !== row.expectedRevision + 1)
      throw new Error('Communication messaging mutation identity or revision is invalid');
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO communication_messaging_mutations(
      id,family_id,owner_person_id,resource_type,resource_id,actor_account_id,actor_person_id,mutation_kind,
      client_operation_id,request_fingerprint,expected_revision,revision,resource_state_fingerprint,occurred_at,
      policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,policy_resource_type,
      policy_resource_id,policy_action,policy_capability) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(row.id,row.familyId,row.ownerPersonId,row.resourceType,row.resourceId,row.actorAccountId,row.actorPersonId,row.mutationKind,
        row.clientOperationId,row.requestFingerprint,row.expectedRevision,row.revision,row.resourceStateFingerprint,row.occurredAt,
        binding.receiptHash,binding.receiptVersion,binding.nonce,context.correlationId,binding.resourceType,binding.resourceId,
        binding.action,binding.capability); });
  }
  public insertMessage(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationMessageRow) {
    const binding = currentBinding(context, 'communication_message', row.id, row.familyId);
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO communication_messages(
      id,family_id,owner_person_id,room_id,sender_account_id,sender_person_id,content_kind,content_mime,
      sealed_payload_reference,payload_sha256,payload_size_bytes,provider_id,provider_evidence_sha256,payload_revision,payload_created_at,reply_to_message_id,
      quoted_message_id,thread_root_message_id,state,delivery_state,scheduled_at,silent,pinned,bookmarked,reaction_code,
      edit_count,revision,state_fingerprint,last_mutation_id,created_at,updated_at,deleted_at,expires_at,policy_receipt_hash)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.roomId,
        row.senderAccountId,row.senderPersonId,row.contentKind,row.contentMime,row.sealedPayloadReference,row.payloadSha256,
        row.payloadSizeBytes,row.providerId,row.providerEvidenceSha256,row.payloadRevision,row.payloadCreatedAt,row.replyToMessageId??null,row.quotedMessageId??null,
        row.threadRootMessageId??null,row.state,row.deliveryState,row.scheduledAt??null,row.silent?1:0,row.pinned?1:0,
        row.bookmarked?1:0,row.reactionCode??null,row.editCount,row.revision,row.stateFingerprint,row.lastMutationId,row.createdAt,
        row.updatedAt,row.deletedAt??null,row.expiresAt??null,binding.receiptHash); });
  }
  public saveMessage(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationMessageRow, expectedRevision: number) {
    const binding = currentBinding(context, 'communication_message', row.id, row.familyId);
    return this.execute(context, () => {
      const result = this.database(context).prepare(`UPDATE communication_messages SET content_kind=?,content_mime=?,
        sealed_payload_reference=?,payload_sha256=?,payload_size_bytes=?,provider_id=?,provider_evidence_sha256=?,payload_revision=?,payload_created_at=?,
        reply_to_message_id=?,quoted_message_id=?,thread_root_message_id=?,state=?,delivery_state=?,scheduled_at=?,silent=?,
        pinned=?,bookmarked=?,reaction_code=?,edit_count=?,revision=?,state_fingerprint=?,last_mutation_id=?,updated_at=?,
        deleted_at=?,expires_at=?,policy_receipt_hash=? WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`)
        .run(row.contentKind,row.contentMime,row.sealedPayloadReference,row.payloadSha256,row.payloadSizeBytes,row.providerId,
          row.providerEvidenceSha256,row.payloadRevision,row.payloadCreatedAt,row.replyToMessageId??null,row.quotedMessageId??null,row.threadRootMessageId??null,row.state,
          row.deliveryState,row.scheduledAt??null,row.silent?1:0,row.pinned?1:0,row.bookmarked?1:0,row.reactionCode??null,
          row.editCount,row.revision,row.stateFingerprint,row.lastMutationId,row.updatedAt,row.deletedAt??null,row.expiresAt??null,
          binding.receiptHash,row.id,row.familyId,row.ownerPersonId,expectedRevision);
      if (Number(result.changes) !== 1) throw new Error('Communication message optimistic revision conflict');
    });
  }
  public appendMessageEvent(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationMessageEventRow) {
    currentBinding(context, 'communication_message', row.messageId, row.familyId);
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO communication_message_events(
      id,family_id,owner_person_id,message_id,room_id,actor_account_id,actor_person_id,event_kind,message_revision,
      state_fingerprint,mutation_id,occurred_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,
        row.messageId,row.roomId,row.actorAccountId,row.actorPersonId,row.eventKind,row.messageRevision,row.stateFingerprint,
        row.mutationId,row.occurredAt); });
  }
  public upsertDeliveryQueue(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationDeliveryQueueRow, expectedRevision: number) {
    const binding = currentBinding(context, 'communication_message', row.messageId, row.familyId);
    return this.execute(context, () => {
      if (expectedRevision === 0) {
        this.database(context).prepare(`INSERT INTO communication_delivery_queue(message_id,family_id,owner_person_id,state,
          attempt_count,next_attempt_at,revision,last_mutation_id,created_at,updated_at,policy_receipt_hash)
          VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(row.messageId,row.familyId,row.ownerPersonId,row.state,row.attemptCount,
            row.nextAttemptAt??null,row.revision,row.lastMutationId,row.createdAt,row.updatedAt,binding.receiptHash);
        return;
      }
      const result = this.database(context).prepare(`UPDATE communication_delivery_queue SET state=?,attempt_count=?,
        next_attempt_at=?,revision=?,last_mutation_id=?,updated_at=?,policy_receipt_hash=?
        WHERE message_id=? AND family_id=? AND owner_person_id=? AND revision<=?`).run(row.state,row.attemptCount,row.nextAttemptAt??null,
          row.revision,row.lastMutationId,row.updatedAt,binding.receiptHash,row.messageId,row.familyId,row.ownerPersonId,expectedRevision);
      if (Number(result.changes) !== 1) throw new Error('Communication delivery queue optimistic revision conflict');
    });
  }
  public savePresence(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationPresenceRow, expectedRevision: number) {
    const binding = currentBinding(context, 'communication_presence', row.id, row.familyId);
    return this.execute(context, () => {
      if (expectedRevision === 0) {
        this.database(context).prepare(`INSERT INTO communication_presence_profiles(id,family_id,owner_person_id,person_id,
          status,public_availability,audience,last_seen_shared,typing_indicators_enabled,read_receipts_enabled,
          emergency_reachability_enabled,expires_at,revision,state_fingerprint,last_mutation_id,created_at,updated_at,policy_receipt_hash)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.personId,row.status,
            row.publicAvailability,row.audience,row.lastSeenShared?1:0,row.typingIndicatorsEnabled?1:0,row.readReceiptsEnabled?1:0,
            row.emergencyReachabilityEnabled?1:0,row.expiresAt??null,row.revision,row.stateFingerprint,row.lastMutationId,row.createdAt,
            row.updatedAt,binding.receiptHash); return;
      }
      const result = this.database(context).prepare(`UPDATE communication_presence_profiles SET status=?,public_availability=?,
        audience=?,last_seen_shared=?,typing_indicators_enabled=?,read_receipts_enabled=?,emergency_reachability_enabled=?,
        expires_at=?,revision=?,state_fingerprint=?,last_mutation_id=?,updated_at=?,policy_receipt_hash=?
        WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`).run(row.status,row.publicAvailability,row.audience,
          row.lastSeenShared?1:0,row.typingIndicatorsEnabled?1:0,row.readReceiptsEnabled?1:0,row.emergencyReachabilityEnabled?1:0,
          row.expiresAt??null,row.revision,row.stateFingerprint,row.lastMutationId,row.updatedAt,binding.receiptHash,
          row.id,row.familyId,row.ownerPersonId,expectedRevision);
      if (Number(result.changes) !== 1) throw new Error('Communication presence optimistic revision conflict');
    });
  }
  public saveRetentionPolicy(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationRetentionPolicyRow, expectedRevision: number) {
    const binding = currentBinding(context, 'communication_retention_policy', row.id, row.familyId);
    return this.execute(context, () => {
      if (expectedRevision === 0) {
        this.database(context).prepare(`INSERT INTO communication_retention_policies(id,family_id,owner_person_id,room_id,
          mode,duration_days,legal_hold_reason_sha256,revision,state_fingerprint,last_mutation_id,created_at,updated_at,policy_receipt_hash)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.roomId,row.mode,row.durationDays??null,
            row.legalHoldReasonSha256??null,row.revision,row.stateFingerprint,row.lastMutationId,row.createdAt,row.updatedAt,binding.receiptHash);
        return;
      }
      const result = this.database(context).prepare(`UPDATE communication_retention_policies SET mode=?,duration_days=?,
        legal_hold_reason_sha256=?,revision=?,state_fingerprint=?,last_mutation_id=?,updated_at=?,policy_receipt_hash=?
        WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`).run(row.mode,row.durationDays??null,
          row.legalHoldReasonSha256??null,row.revision,row.stateFingerprint,row.lastMutationId,row.updatedAt,binding.receiptHash,
          row.id,row.familyId,row.ownerPersonId,expectedRevision);
      if (Number(result.changes) !== 1) throw new Error('Communication retention policy optimistic revision conflict');
    });
  }
}
