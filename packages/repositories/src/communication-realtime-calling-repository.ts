import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type {
  CommunicationCallBackgroundEffect,
  CommunicationCallDeviceCheck,
  CommunicationCallMediaMode,
  CommunicationCallNetworkState,
  CommunicationCallParticipantRole,
  CommunicationCallParticipantState,
  CommunicationCallState,
  CommunicationCallTopology,
  CommunicationHistoryAccessMode,
  CommunicationMembershipRole,
  CommunicationMembershipStatus,
  CommunicationRealtimeCallingMutationKind,
  CommunicationRealtimeCallingResourceType,
  CommunicationRoomStatus,
  CommunicationRoomType
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type CommunicationCallEventRow,
  type CommunicationCallParticipantRow,
  type CommunicationCallPreferencesRow,
  type CommunicationCallQualityObservationRow,
  type CommunicationCallSessionRow,
  type CommunicationRealtimeCallingCenterKey,
  type CommunicationRealtimeCallingCenterSnapshotRow,
  type CommunicationRealtimeCallingMutationRow,
  type CommunicationRealtimeCallingPolicyResourceRepositoryPort,
  type CommunicationRealtimeCallingRepositoryPort,
  type CommunicationRealtimeCallingRoomGuardRow,
  type CommunicationRealtimeCallingSessionSnapshotRow,
  type CommunicationRoomMembershipRow,
  type CommunicationRoomRow,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const sessionSelect = `SELECT id,family_id,owner_person_id,room_id,topology,requested_media_mode,state,network_state,
  waiting_room_enabled,meeting_locked,audio_only,automatic_audio_fallback_enabled,background_effect,captions_requested,
  realtime_text_requested,screen_share_requested,local_hand_raised,pinned_person_id,sign_language_pinned_person_id,
  reaction_code,microphone_check,camera_check,speaker_check,noise_reduction_requested,echo_cancellation_requested,
  automatic_gain_control_requested,preflight_provider_id,preflight_evidence_sha256,preflight_observed_at,
  revision,state_fingerprint,last_mutation_id,created_at,updated_at,ended_at FROM communication_call_sessions`;
const participantSelect = `SELECT id,family_id,owner_person_id,session_id,person_id,role,state,hand_raised,
  pinned_locally,sign_language_speaker_pinned_locally,reaction_code,revision,created_at,updated_at
  FROM communication_call_participants`;
const preferencesSelect = `SELECT id,family_id,owner_person_id,simple_mode,favorite_person_id,large_person_cards,
  caption_scale_percent,screen_reader_announcements,keyboard_shortcuts,automatic_audio_fallback_enabled,
  noise_reduction_requested,echo_cancellation_requested,automatic_gain_control_requested,background_effect,
  revision,state_fingerprint,last_mutation_id,created_at,updated_at FROM communication_call_preferences`;
const qualitySelect = `SELECT id,family_id,owner_person_id,session_id,round_trip_ms,packet_loss_permille,jitter_ms,
  uplink_kbps,downlink_kbps,provider_id,provider_evidence_sha256,mutation_id,observed_at
  FROM communication_call_quality_observations`;
const mutationSelect = `SELECT id,family_id,owner_person_id,resource_type,resource_id,actor_account_id,
  actor_person_id,mutation_kind,client_operation_id,request_fingerprint,expected_revision,revision,
  resource_state_fingerprint,occurred_at FROM communication_call_mutations`;
const roomSelect = `SELECT id,family_id,account_id,owner_person_id,display_name,room_type,scope_resource_type,
  scope_resource_id,masked_room_ref_sha256,provider_group_id_sha256,status,history_access_mode,current_epoch,
  current_epoch_id,revision,state_fingerprint,last_mutation_id,created_at,updated_at FROM communication_rooms`;
const membershipSelect = `SELECT id,family_id,owner_person_id,room_id,member_person_id,device_credential_id,
  role,status,joined_at_epoch,history_visible_from_epoch,removed_at_epoch,revision,state_fingerprint,
  last_mutation_id,created_at,updated_at FROM communication_room_memberships`;

const mapSession = (row: Record<string, unknown>): CommunicationCallSessionRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  roomId: String(row.room_id), topology: String(row.topology) as CommunicationCallTopology,
  requestedMediaMode: String(row.requested_media_mode) as CommunicationCallMediaMode,
  state: String(row.state) as CommunicationCallState, networkState: String(row.network_state) as CommunicationCallNetworkState,
  waitingRoomEnabled: Number(row.waiting_room_enabled) === 1, meetingLocked: Number(row.meeting_locked) === 1,
  audioOnly: Number(row.audio_only) === 1, automaticAudioFallbackEnabled: Number(row.automatic_audio_fallback_enabled) === 1,
  backgroundEffect: String(row.background_effect) as CommunicationCallBackgroundEffect,
  captionsRequested: Number(row.captions_requested) === 1, realtimeTextRequested: Number(row.realtime_text_requested) === 1,
  screenShareRequested: Number(row.screen_share_requested) === 1, localHandRaised: Number(row.local_hand_raised) === 1,
  ...(row.pinned_person_id ? { pinnedPersonId: asPersonId(String(row.pinned_person_id)) } : {}),
  ...(row.sign_language_pinned_person_id ? { signLanguagePinnedPersonId: asPersonId(String(row.sign_language_pinned_person_id)) } : {}),
  ...(row.reaction_code ? { reactionCode: String(row.reaction_code) } : {}),
  microphoneCheck: String(row.microphone_check) as CommunicationCallDeviceCheck,
  cameraCheck: String(row.camera_check) as CommunicationCallDeviceCheck,
  speakerCheck: String(row.speaker_check) as CommunicationCallDeviceCheck,
  noiseReductionRequested: Number(row.noise_reduction_requested) === 1,
  echoCancellationRequested: Number(row.echo_cancellation_requested) === 1,
  automaticGainControlRequested: Number(row.automatic_gain_control_requested) === 1,
  ...(row.preflight_provider_id ? { preflightProviderId: String(row.preflight_provider_id) } : {}),
  ...(row.preflight_evidence_sha256 ? { preflightEvidenceSha256: String(row.preflight_evidence_sha256) } : {}),
  ...(row.preflight_observed_at ? { preflightObservedAt: asIsoDateTime(String(row.preflight_observed_at)) } : {}),
  revision: Number(row.revision), stateFingerprint: String(row.state_fingerprint), lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at)),
  ...(row.ended_at ? { endedAt: asIsoDateTime(String(row.ended_at)) } : {})
});
const mapParticipant = (row: Record<string, unknown>): CommunicationCallParticipantRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  sessionId: String(row.session_id), personId: asPersonId(String(row.person_id)),
  role: String(row.role) as CommunicationCallParticipantRole, state: String(row.state) as CommunicationCallParticipantState,
  handRaised: Number(row.hand_raised) === 1, pinnedLocally: Number(row.pinned_locally) === 1,
  signLanguageSpeakerPinnedLocally: Number(row.sign_language_speaker_pinned_locally) === 1,
  ...(row.reaction_code ? { reactionCode: String(row.reaction_code) } : {}), revision: Number(row.revision),
  createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapPreferences = (row: Record<string, unknown>): CommunicationCallPreferencesRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  simpleMode: Number(row.simple_mode) === 1,
  ...(row.favorite_person_id ? { favoritePersonId: asPersonId(String(row.favorite_person_id)) } : {}),
  largePersonCards: Number(row.large_person_cards) === 1, captionScalePercent: Number(row.caption_scale_percent),
  screenReaderAnnouncements: Number(row.screen_reader_announcements) === 1,
  keyboardShortcuts: Number(row.keyboard_shortcuts) === 1,
  automaticAudioFallbackEnabled: Number(row.automatic_audio_fallback_enabled) === 1,
  noiseReductionRequested: Number(row.noise_reduction_requested) === 1,
  echoCancellationRequested: Number(row.echo_cancellation_requested) === 1,
  automaticGainControlRequested: Number(row.automatic_gain_control_requested) === 1,
  backgroundEffect: String(row.background_effect) as CommunicationCallBackgroundEffect,
  revision: Number(row.revision), stateFingerprint: String(row.state_fingerprint), lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapQuality = (row: Record<string, unknown>): CommunicationCallQualityObservationRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  sessionId: String(row.session_id), roundTripMs: Number(row.round_trip_ms),
  packetLossPermille: Number(row.packet_loss_permille), jitterMs: Number(row.jitter_ms),
  uplinkKbps: Number(row.uplink_kbps), downlinkKbps: Number(row.downlink_kbps), providerId: String(row.provider_id),
  providerEvidenceSha256: String(row.provider_evidence_sha256), mutationId: String(row.mutation_id),
  observedAt: asIsoDateTime(String(row.observed_at))
});
const mapMutation = (row: Record<string, unknown>): CommunicationRealtimeCallingMutationRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  resourceType: String(row.resource_type) as CommunicationRealtimeCallingResourceType, resourceId: String(row.resource_id),
  actorAccountId: String(row.actor_account_id), actorPersonId: asPersonId(String(row.actor_person_id)),
  mutationKind: String(row.mutation_kind) as CommunicationRealtimeCallingMutationKind,
  clientOperationId: String(row.client_operation_id), requestFingerprint: String(row.request_fingerprint),
  expectedRevision: Number(row.expected_revision), revision: Number(row.revision),
  resourceStateFingerprint: String(row.resource_state_fingerprint), occurredAt: asIsoDateTime(String(row.occurred_at))
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

const assertKey = (context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationRealtimeCallingCenterKey, mode: 'read' | 'write'): void => {
  const resourceType = mode === 'read' ? 'communication_call_center' : context.policyAuthorization.resourceType;
  assertPolicyAuthorizedRepositoryContext(context, { resourceType, resourceId: mode === 'read' ? '*' : context.policyAuthorization.resourceId,
    action: context.policyAuthorization.action, capability: mode === 'read' ? 'family.read' : 'family.write',
    correlationId: context.correlationId, resourceFamilyId: key.familyId });
  const authorization = context.policyAuthorization;
  if (authorization.purpose !== 'general' || authorization.subject.accountId !== key.accountId
    || authorization.subject.personId !== key.actorPersonId || !authorization.subject.familyIds.includes(key.familyId)
    || authorization.resourceFamilyId !== key.familyId
    || authorization.receiptRecord.request.resource.ownerPersonId !== key.ownerPersonId
    || authorization.receiptRecord.request.resource.sensitivity !== 'highly_sensitive'
    || key.centerId !== `communication-calling:${key.familyId}:${key.ownerPersonId}`
    || key.actorPersonId !== key.ownerPersonId || (mode === 'read' && authorization.action !== 'read')
    || (mode === 'write' && !['communication_call_session', 'communication_call_preferences'].includes(authorization.resourceType))
    || (mode === 'write' && !['create', 'update', 'delete'].includes(authorization.action)))
    throw new Error('Communication calling key does not match the exact owner policy receipt');
};
const assertAccess = (context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationRealtimeCallingCenterKey): void =>
  assertKey(context, key, context.policyAuthorization.resourceType === 'communication_call_center' ? 'read' : 'write');
const expectedAction = (context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationRealtimeCallingMutationRow) => {
  if (row.mutationKind === 'call_create' || (row.mutationKind === 'call_preferences_update' && row.expectedRevision === 0)) return 'create';
  if (row.mutationKind === 'call_lifecycle_update' && context.policyAuthorization.action === 'delete') return 'delete';
  return 'update';
};
const writeBinding = (context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationRealtimeCallingMutationRow) => {
  const binding = platformPolicyPersistenceBinding(context, row.resourceType, row.resourceId);
  if (!binding || binding.resourceFamilyId !== row.familyId || binding.purpose !== 'general'
    || binding.capability !== 'family.write' || binding.occurredAt !== row.occurredAt
    || binding.action !== expectedAction(context, row)) throw new Error('Communication calling mutation requires an exact durable policy receipt');
  return binding;
};
const currentBinding = (context: PolicyAuthorizedRepositoryExecutionContext, resourceType: CommunicationRealtimeCallingResourceType,
  resourceId: string, familyId: string) => {
  assertPolicyAuthorizedRepositoryContext(context, { resourceType, resourceId, action: context.policyAuthorization.action,
    capability: 'family.write', correlationId: context.correlationId, resourceFamilyId: asFamilyId(familyId) });
  const binding = platformPolicyPersistenceBinding(context, resourceType, resourceId);
  if (!binding || binding.purpose !== 'general' || binding.capability !== 'family.write')
    throw new Error('Communication calling current-row receipt is missing');
  return binding;
};

export class SqliteCommunicationRealtimeCallingRepository extends SqliteRepository implements
  CommunicationRealtimeCallingRepositoryPort, CommunicationRealtimeCallingPolicyResourceRepositoryPort {
  public resolvePolicyResource(context: RepositoryExecutionContext, resourceType: CommunicationRealtimeCallingResourceType, resourceId: string)
  : ReturnType<CommunicationRealtimeCallingPolicyResourceRepositoryPort['resolvePolicyResource']> {
    return this.execute(context, () => {
      const table = resourceType === 'communication_call_session' ? 'communication_call_sessions' : 'communication_call_preferences';
      const status = resourceType === 'communication_call_session' ? 'state' : "'configured'";
      const row = this.database(context).prepare(`SELECT id,family_id,owner_person_id,revision,${status} status,state_fingerprint
        FROM ${table} WHERE id=?`).get(resourceId) as Record<string, unknown> | undefined;
      return row ? Object.freeze({ id: String(row.id), familyId: asFamilyId(String(row.family_id)),
        ownerPersonId: asPersonId(String(row.owner_person_id)), revision: Number(row.revision),
        status: String(row.status), stateFingerprint: String(row.state_fingerprint) }) : null;
    });
  }

  public loadCenter(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationRealtimeCallingCenterKey)
  : RepositoryResult<CommunicationRealtimeCallingCenterSnapshotRow> {
    assertKey(context, key, 'read');
    return this.execute(context, () => {
      const sessionsRaw = this.database(context).prepare(`${sessionSelect} WHERE family_id=? AND owner_person_id=? ORDER BY updated_at DESC,id LIMIT 257`)
        .all(key.familyId, key.ownerPersonId) as Record<string, unknown>[];
      if (sessionsRaw.length > 256) throw new Error('Communication call session bound exceeded');
      const sessions = sessionsRaw.map((raw) => {
        const session = mapSession(raw);
        const participantsRaw = this.database(context).prepare(`${participantSelect} WHERE family_id=? AND owner_person_id=? AND session_id=? ORDER BY person_id,id LIMIT 17`)
          .all(key.familyId, key.ownerPersonId, session.id) as Record<string, unknown>[];
        if (participantsRaw.length > 16) throw new Error('Communication call participant bound exceeded');
        return Object.freeze({ session, participants: Object.freeze(participantsRaw.map(mapParticipant)) });
      });
      const preferencesRaw = this.database(context).prepare(`${preferencesSelect} WHERE family_id=? AND owner_person_id=?`)
        .get(key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined;
      const qualityRaw = this.database(context).prepare(`${qualitySelect} WHERE family_id=? AND owner_person_id=? ORDER BY observed_at DESC,id LIMIT 513`)
        .all(key.familyId, key.ownerPersonId) as Record<string, unknown>[];
      if (qualityRaw.length > 512) throw new Error('Communication call quality observation bound exceeded');
      return Object.freeze({ sessions: Object.freeze(sessions), preferences: preferencesRaw ? mapPreferences(preferencesRaw) : null,
        qualityObservations: Object.freeze(qualityRaw.map(mapQuality)) });
    });
  }
  public findRoomGuard(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationRealtimeCallingCenterKey, roomId: string) {
    assertKey(context, key, 'write'); return this.execute(context, () => {
      const raw = this.database(context).prepare(`${roomSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
        .get(roomId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined;
      if (!raw) return null;
      const members = this.database(context).prepare(`${membershipSelect} WHERE family_id=? AND owner_person_id=? AND room_id=? ORDER BY created_at,id LIMIT 129`)
        .all(key.familyId, key.ownerPersonId, roomId) as Record<string, unknown>[];
      if (members.length > 128) throw new Error('Communication call room guard exceeds its bound');
      return Object.freeze({ room: mapRoom(raw), memberships: Object.freeze(members.map(mapMembership)) }) satisfies CommunicationRealtimeCallingRoomGuardRow;
    });
  }
  public findSession(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationRealtimeCallingCenterKey, sessionId: string) {
    assertAccess(context, key); return this.execute(context, () => {
      const raw = this.database(context).prepare(`${sessionSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
        .get(sessionId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined;
      if (!raw) return null;
      const participantsRaw = this.database(context).prepare(`${participantSelect} WHERE family_id=? AND owner_person_id=? AND session_id=? ORDER BY person_id,id LIMIT 17`)
        .all(key.familyId, key.ownerPersonId, sessionId) as Record<string, unknown>[];
      if (participantsRaw.length > 16) throw new Error('Communication call participant bound exceeded');
      return Object.freeze({ session: mapSession(raw), participants: Object.freeze(participantsRaw.map(mapParticipant)) }) satisfies CommunicationRealtimeCallingSessionSnapshotRow;
    });
  }
  public findPreferences(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationRealtimeCallingCenterKey) {
    assertAccess(context, key); return this.execute(context, () => {
      const row = this.database(context).prepare(`${preferencesSelect} WHERE family_id=? AND owner_person_id=?`)
        .get(key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined;
      return row ? mapPreferences(row) : null;
    });
  }
  public findMutationByClientOperationId(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationRealtimeCallingCenterKey, clientOperationId: string) {
    assertKey(context, key, 'write'); return this.execute(context, () => {
      const row = this.database(context).prepare(`${mutationSelect} WHERE family_id=? AND actor_account_id=? AND client_operation_id=?`)
        .get(key.familyId, key.accountId, clientOperationId) as Record<string, unknown> | undefined;
      return row ? mapMutation(row) : null;
    });
  }
  public insertMutation(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationRealtimeCallingMutationRow): RepositoryResult<void> {
    const binding = writeBinding(context, row);
    if (row.actorAccountId !== context.policyAuthorization.subject.accountId || row.actorPersonId !== context.policyAuthorization.subject.personId
      || row.ownerPersonId !== context.policyAuthorization.receiptRecord.request.resource.ownerPersonId || row.revision !== row.expectedRevision + 1)
      throw new Error('Communication calling mutation identity or revision is invalid');
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO communication_call_mutations(
      id,family_id,owner_person_id,resource_type,resource_id,actor_account_id,actor_person_id,mutation_kind,
      client_operation_id,request_fingerprint,expected_revision,revision,resource_state_fingerprint,occurred_at,
      policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,policy_resource_type,
      policy_resource_id,policy_action,policy_capability) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(row.id,row.familyId,row.ownerPersonId,row.resourceType,row.resourceId,row.actorAccountId,row.actorPersonId,row.mutationKind,
        row.clientOperationId,row.requestFingerprint,row.expectedRevision,row.revision,row.resourceStateFingerprint,row.occurredAt,
        binding.receiptHash,binding.receiptVersion,binding.nonce,context.correlationId,binding.resourceType,binding.resourceId,
        binding.action,binding.capability); });
  }
  public insertSession(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationCallSessionRow) {
    const binding = currentBinding(context, 'communication_call_session', row.id, row.familyId);
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO communication_call_sessions(
      id,family_id,owner_person_id,room_id,topology,requested_media_mode,state,network_state,waiting_room_enabled,
      meeting_locked,audio_only,automatic_audio_fallback_enabled,background_effect,captions_requested,realtime_text_requested,
      screen_share_requested,local_hand_raised,pinned_person_id,sign_language_pinned_person_id,reaction_code,microphone_check,
      camera_check,speaker_check,noise_reduction_requested,echo_cancellation_requested,automatic_gain_control_requested,
      preflight_provider_id,preflight_evidence_sha256,preflight_observed_at,revision,state_fingerprint,last_mutation_id,
      created_at,updated_at,ended_at,policy_receipt_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(row.id,row.familyId,row.ownerPersonId,row.roomId,row.topology,row.requestedMediaMode,row.state,row.networkState,
        row.waitingRoomEnabled?1:0,row.meetingLocked?1:0,row.audioOnly?1:0,row.automaticAudioFallbackEnabled?1:0,row.backgroundEffect,
        row.captionsRequested?1:0,row.realtimeTextRequested?1:0,row.screenShareRequested?1:0,row.localHandRaised?1:0,
        row.pinnedPersonId??null,row.signLanguagePinnedPersonId??null,row.reactionCode??null,row.microphoneCheck,row.cameraCheck,
        row.speakerCheck,row.noiseReductionRequested?1:0,row.echoCancellationRequested?1:0,row.automaticGainControlRequested?1:0,
        row.preflightProviderId??null,row.preflightEvidenceSha256??null,row.preflightObservedAt??null,row.revision,row.stateFingerprint,
        row.lastMutationId,row.createdAt,row.updatedAt,row.endedAt??null,binding.receiptHash); });
  }
  public saveSession(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationCallSessionRow, expectedRevision: number) {
    const binding = currentBinding(context, 'communication_call_session', row.id, row.familyId);
    return this.execute(context, () => {
      const result = this.database(context).prepare(`UPDATE communication_call_sessions SET state=?,network_state=?,waiting_room_enabled=?,
        meeting_locked=?,audio_only=?,automatic_audio_fallback_enabled=?,background_effect=?,captions_requested=?,realtime_text_requested=?,
        screen_share_requested=?,local_hand_raised=?,pinned_person_id=?,sign_language_pinned_person_id=?,reaction_code=?,microphone_check=?,
        camera_check=?,speaker_check=?,noise_reduction_requested=?,echo_cancellation_requested=?,automatic_gain_control_requested=?,
        preflight_provider_id=?,preflight_evidence_sha256=?,preflight_observed_at=?,revision=?,state_fingerprint=?,last_mutation_id=?,
        updated_at=?,ended_at=?,policy_receipt_hash=? WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`)
        .run(row.state,row.networkState,row.waitingRoomEnabled?1:0,row.meetingLocked?1:0,row.audioOnly?1:0,
          row.automaticAudioFallbackEnabled?1:0,row.backgroundEffect,row.captionsRequested?1:0,row.realtimeTextRequested?1:0,
          row.screenShareRequested?1:0,row.localHandRaised?1:0,row.pinnedPersonId??null,row.signLanguagePinnedPersonId??null,
          row.reactionCode??null,row.microphoneCheck,row.cameraCheck,row.speakerCheck,row.noiseReductionRequested?1:0,
          row.echoCancellationRequested?1:0,row.automaticGainControlRequested?1:0,row.preflightProviderId??null,
          row.preflightEvidenceSha256??null,row.preflightObservedAt??null,row.revision,row.stateFingerprint,row.lastMutationId,
          row.updatedAt,row.endedAt??null,binding.receiptHash,row.id,row.familyId,row.ownerPersonId,expectedRevision);
      if (Number(result.changes) !== 1) throw new Error('Communication call optimistic revision conflict');
    });
  }
  public insertParticipants(context: PolicyAuthorizedRepositoryExecutionContext, rows: readonly CommunicationCallParticipantRow[]) {
    if (rows.length < 2 || rows.length > 16) throw new Error('Communication call participant write bound is invalid');
    const first = rows[0]!; currentBinding(context, 'communication_call_session', first.sessionId, first.familyId);
    return this.execute(context, () => {
      const statement = this.database(context).prepare(`INSERT INTO communication_call_participants(id,family_id,owner_person_id,
        session_id,person_id,role,state,hand_raised,pinned_locally,sign_language_speaker_pinned_locally,reaction_code,
        revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const row of rows) {
        if (row.sessionId !== first.sessionId || row.familyId !== first.familyId || row.ownerPersonId !== first.ownerPersonId)
          throw new Error('Communication call participants do not share the session identity');
        statement.run(row.id,row.familyId,row.ownerPersonId,row.sessionId,row.personId,row.role,row.state,row.handRaised?1:0,
          row.pinnedLocally?1:0,row.signLanguageSpeakerPinnedLocally?1:0,row.reactionCode??null,row.revision,row.createdAt,row.updatedAt);
      }
    });
  }
  public appendEvent(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationCallEventRow) {
    currentBinding(context, 'communication_call_session', row.sessionId, row.familyId);
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO communication_call_events(
      id,family_id,owner_person_id,session_id,event_kind,session_revision,state_fingerprint,mutation_id,occurred_at)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.sessionId,row.eventKind,row.sessionRevision,
        row.stateFingerprint,row.mutationId,row.occurredAt); });
  }
  public savePreferences(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationCallPreferencesRow, expectedRevision: number) {
    const binding = currentBinding(context, 'communication_call_preferences', row.id, row.familyId);
    return this.execute(context, () => {
      if (expectedRevision === 0) {
        this.database(context).prepare(`INSERT INTO communication_call_preferences(id,family_id,owner_person_id,simple_mode,
          favorite_person_id,large_person_cards,caption_scale_percent,screen_reader_announcements,keyboard_shortcuts,
          automatic_audio_fallback_enabled,noise_reduction_requested,echo_cancellation_requested,automatic_gain_control_requested,
          background_effect,revision,state_fingerprint,last_mutation_id,created_at,updated_at,policy_receipt_hash)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.simpleMode?1:0,
            row.favoritePersonId??null,row.largePersonCards?1:0,row.captionScalePercent,row.screenReaderAnnouncements?1:0,
            row.keyboardShortcuts?1:0,row.automaticAudioFallbackEnabled?1:0,row.noiseReductionRequested?1:0,
            row.echoCancellationRequested?1:0,row.automaticGainControlRequested?1:0,row.backgroundEffect,row.revision,
            row.stateFingerprint,row.lastMutationId,row.createdAt,row.updatedAt,binding.receiptHash); return;
      }
      const result = this.database(context).prepare(`UPDATE communication_call_preferences SET simple_mode=?,favorite_person_id=?,
        large_person_cards=?,caption_scale_percent=?,screen_reader_announcements=?,keyboard_shortcuts=?,
        automatic_audio_fallback_enabled=?,noise_reduction_requested=?,echo_cancellation_requested=?,automatic_gain_control_requested=?,
        background_effect=?,revision=?,state_fingerprint=?,last_mutation_id=?,updated_at=?,policy_receipt_hash=?
        WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`).run(row.simpleMode?1:0,row.favoritePersonId??null,
          row.largePersonCards?1:0,row.captionScalePercent,row.screenReaderAnnouncements?1:0,row.keyboardShortcuts?1:0,
          row.automaticAudioFallbackEnabled?1:0,row.noiseReductionRequested?1:0,row.echoCancellationRequested?1:0,
          row.automaticGainControlRequested?1:0,row.backgroundEffect,row.revision,row.stateFingerprint,row.lastMutationId,
          row.updatedAt,binding.receiptHash,row.id,row.familyId,row.ownerPersonId,expectedRevision);
      if (Number(result.changes) !== 1) throw new Error('Communication call preference optimistic revision conflict');
    });
  }
  public appendQualityObservation(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationCallQualityObservationRow) {
    currentBinding(context, 'communication_call_session', row.sessionId, row.familyId);
    return this.execute(context, () => { this.database(context).prepare(`INSERT INTO communication_call_quality_observations(
      id,family_id,owner_person_id,session_id,round_trip_ms,packet_loss_permille,jitter_ms,uplink_kbps,downlink_kbps,
      provider_id,provider_evidence_sha256,mutation_id,observed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(row.id,row.familyId,row.ownerPersonId,row.sessionId,row.roundTripMs,row.packetLossPermille,row.jitterMs,
        row.uplinkKbps,row.downlinkKbps,row.providerId,row.providerEvidenceSha256,row.mutationId,row.observedAt); });
  }
}
