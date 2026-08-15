import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type {
  FamilyMeetingAttendanceState,
  FamilyMeetingCollaborationKind,
  FamilyMeetingMinutesState,
  FamilyMeetingMutationKind,
  FamilyMeetingPollState,
  FamilyMeetingRecurrenceKind,
  FamilyMeetingRole,
  FamilyMeetingState,
  FamilyMeetingTaskState
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type FamilyMeetingAgendaItemRow,
  type FamilyMeetingCenterKey,
  type FamilyMeetingCenterSnapshotRow,
  type FamilyMeetingCollaborationRow,
  type FamilyMeetingDecisionRow,
  type FamilyMeetingEventRow,
  type FamilyMeetingMinutesRow,
  type FamilyMeetingMutationRow,
  type FamilyMeetingParticipantRow,
  type FamilyMeetingPolicyResourceRepositoryPort,
  type FamilyMeetingPollRow,
  type FamilyMeetingRepositoryPort,
  type FamilyMeetingRow,
  type FamilyMeetingSnapshotRow,
  type FamilyMeetingTaskRow,
  type FamilyMeetingVoteRow,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const meetingSelect = `SELECT id,family_id,owner_person_id,title,recurrence_kind,recurrence_interval,starts_at,ends_at,
  reminder_minutes,state,revision,state_fingerprint,last_mutation_id,created_at,updated_at FROM family_meetings`;
const participantSelect = `SELECT id,family_id,owner_person_id,meeting_id,participant_person_id,roles_json,attendance,
  reminder_enabled,revision,last_mutation_id,created_at,updated_at FROM family_meeting_participants`;
const agendaSelect = `SELECT id,family_id,owner_person_id,meeting_id,title,note_text,item_order,pre_read_json,
  carry_forward,revision,last_mutation_id,created_at,updated_at FROM family_meeting_agenda_items`;
const pollSelect = `SELECT id,family_id,owner_person_id,meeting_id,question,options_json,state,mutation_id,created_at
  FROM family_meeting_polls`;
const voteSelect = `SELECT id,family_id,owner_person_id,meeting_id,poll_id,voter_person_id,option_id,abstained,
  opinion_note,mutation_id,cast_at FROM family_meeting_votes`;
const decisionSelect = `SELECT id,family_id,owner_person_id,meeting_id,statement,source_poll_id,
  responsible_person_ids_json,ledger_reference,mutation_id,recorded_at FROM family_meeting_decisions`;
const taskSelect = `SELECT id,family_id,owner_person_id,meeting_id,decision_id,title,responsible_person_id,due_at,state,
  follow_up_note,carry_forward,revision,last_mutation_id,created_at,updated_at FROM family_meeting_tasks`;
const collaborationSelect = `SELECT id,family_id,owner_person_id,meeting_id,kind,resource_type,resource_id,annotation,
  added_by_person_id,mutation_id,added_at FROM family_meeting_collaboration_items`;
const minutesSelect = `SELECT id,family_id,owner_person_id,meeting_id,state,recording_request_id,
  transcript_consent_verified,consent_evidence_sha256,ai_suggestion_generated,human_approval_recorded,
  sealed_payload_reference,payload_sha256,payload_size_bytes,provider_id,provider_evidence_sha256,payload_revision,
  payload_created_at,participant_access_json,selected_recording_segments_json,network_used,cloud_used,revision,
  state_fingerprint,last_mutation_id,created_at,updated_at FROM family_meeting_minutes`;
const mutationSelect = `SELECT id,family_id,owner_person_id,resource_type,resource_id,actor_account_id,actor_person_id,
  mutation_kind,client_operation_id,request_fingerprint,expected_revision,revision,resource_state_fingerprint,occurred_at
  FROM family_meeting_mutations`;

const parseArray = <T extends string>(value: unknown, maximum: number, label: string): readonly T[] => {
  const parsed = JSON.parse(String(value)) as unknown;
  if (!Array.isArray(parsed) || parsed.length > maximum || parsed.some((item) => typeof item !== 'string'))
    throw new Error(`Family meeting ${label} is invalid`);
  return Object.freeze([...parsed] as T[]);
};
const parseObjects = <T>(value: unknown, maximum: number, valid: (item: unknown) => item is T, label: string): readonly T[] => {
  const parsed = JSON.parse(String(value)) as unknown;
  if (!Array.isArray(parsed) || parsed.length > maximum || parsed.some((item) => !valid(item)))
    throw new Error(`Family meeting ${label} is invalid`);
  return Object.freeze(parsed.map((item) => Object.freeze({ ...(item as object) }) as T));
};
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const mapMeeting = (row: Record<string, unknown>): FamilyMeetingRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  title: String(row.title), recurrenceKind: String(row.recurrence_kind) as FamilyMeetingRecurrenceKind,
  recurrenceInterval: Number(row.recurrence_interval), startsAt: asIsoDateTime(String(row.starts_at)),
  endsAt: asIsoDateTime(String(row.ends_at)), reminderMinutes: Number(row.reminder_minutes),
  state: String(row.state) as FamilyMeetingState, revision: Number(row.revision),
  stateFingerprint: String(row.state_fingerprint), lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapParticipant = (row: Record<string, unknown>): FamilyMeetingParticipantRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  meetingId: String(row.meeting_id), participantPersonId: asPersonId(String(row.participant_person_id)),
  roles: parseArray<FamilyMeetingRole>(row.roles_json, 6, 'roles'),
  attendance: String(row.attendance) as FamilyMeetingAttendanceState,
  reminderEnabled: Number(row.reminder_enabled) === 1, revision: Number(row.revision),
  lastMutationId: String(row.last_mutation_id), createdAt: asIsoDateTime(String(row.created_at)),
  updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapAgenda = (row: Record<string, unknown>): FamilyMeetingAgendaItemRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  meetingId: String(row.meeting_id), title: String(row.title), ...(row.note_text ? { note: String(row.note_text) } : {}),
  order: Number(row.item_order), preRead: parseObjects(row.pre_read_json, 16, (item): item is FamilyMeetingAgendaItemRow['preRead'][number] =>
    record(item) && ['archive_item','communication_message','memory_studio_record'].includes(String(item.resourceType))
      && typeof item.resourceId === 'string', 'pre-read'),
  carryForwardToNextMeeting: Number(row.carry_forward) === 1, revision: Number(row.revision),
  lastMutationId: String(row.last_mutation_id), createdAt: asIsoDateTime(String(row.created_at)),
  updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapPoll = (row: Record<string, unknown>): FamilyMeetingPollRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  meetingId: String(row.meeting_id), question: String(row.question),
  options: parseObjects(row.options_json, 12, (item): item is FamilyMeetingPollRow['options'][number] =>
    record(item) && typeof item.id === 'string' && typeof item.label === 'string', 'poll options'),
  state: String(row.state) as FamilyMeetingPollState, mutationId: String(row.mutation_id),
  createdAt: asIsoDateTime(String(row.created_at))
});
const mapVote = (row: Record<string, unknown>): FamilyMeetingVoteRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  meetingId: String(row.meeting_id), pollId: String(row.poll_id), voterPersonId: asPersonId(String(row.voter_person_id)),
  ...(row.option_id ? { optionId: String(row.option_id) } : {}), abstained: Number(row.abstained) === 1,
  ...(row.opinion_note ? { opinionNote: String(row.opinion_note) } : {}), mutationId: String(row.mutation_id),
  castAt: asIsoDateTime(String(row.cast_at))
});
const mapDecision = (row: Record<string, unknown>): FamilyMeetingDecisionRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  meetingId: String(row.meeting_id), statement: String(row.statement),
  ...(row.source_poll_id ? { sourcePollId: String(row.source_poll_id) } : {}),
  responsiblePersonIds: parseArray<string>(row.responsible_person_ids_json, 32, 'decision responsibility'),
  ledgerReference: String(row.ledger_reference), mutationId: String(row.mutation_id),
  recordedAt: asIsoDateTime(String(row.recorded_at))
});
const mapTask = (row: Record<string, unknown>): FamilyMeetingTaskRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  meetingId: String(row.meeting_id), ...(row.decision_id ? { decisionId: String(row.decision_id) } : {}),
  title: String(row.title), responsiblePersonId: asPersonId(String(row.responsible_person_id)),
  dueAt: asIsoDateTime(String(row.due_at)), state: String(row.state) as FamilyMeetingTaskState,
  ...(row.follow_up_note ? { followUpNote: String(row.follow_up_note) } : {}),
  carryForwardToNextMeeting: Number(row.carry_forward) === 1, revision: Number(row.revision),
  lastMutationId: String(row.last_mutation_id), createdAt: asIsoDateTime(String(row.created_at)),
  updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapCollaboration = (row: Record<string, unknown>): FamilyMeetingCollaborationRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  meetingId: String(row.meeting_id), kind: String(row.kind) as FamilyMeetingCollaborationKind,
  resourceType: String(row.resource_type) as FamilyMeetingCollaborationRow['resourceType'], resourceId: String(row.resource_id),
  ...(row.annotation ? { annotation: String(row.annotation) } : {}), addedByPersonId: asPersonId(String(row.added_by_person_id)),
  mutationId: String(row.mutation_id), addedAt: asIsoDateTime(String(row.added_at))
});
const mapMinutes = (row: Record<string, unknown>): FamilyMeetingMinutesRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  meetingId: String(row.meeting_id), state: String(row.state) as FamilyMeetingMinutesState,
  ...(row.recording_request_id ? { recordingRequestId: String(row.recording_request_id) } : {}),
  transcriptConsentVerified: Number(row.transcript_consent_verified) === 1,
  ...(row.consent_evidence_sha256 ? { consentEvidenceSha256: String(row.consent_evidence_sha256) } : {}),
  aiSuggestionGenerated: Number(row.ai_suggestion_generated) === 1,
  humanApprovalRecorded: Number(row.human_approval_recorded) === 1,
  ...(row.sealed_payload_reference ? { sealedPayloadReference: String(row.sealed_payload_reference),
    payloadSha256: String(row.payload_sha256), payloadSizeBytes: Number(row.payload_size_bytes),
    providerId: String(row.provider_id), providerEvidenceSha256: String(row.provider_evidence_sha256),
    payloadRevision: Number(row.payload_revision), payloadCreatedAt: asIsoDateTime(String(row.payload_created_at)) } : {}),
  participantAccessPersonIds: Object.freeze(parseArray<string>(row.participant_access_json, 32, 'minutes access').map(asPersonId)),
  selectedRecordingSegmentIds: parseArray<string>(row.selected_recording_segments_json, 64, 'recording segments'),
  networkUsed: false, cloudUsed: false, revision: Number(row.revision), stateFingerprint: String(row.state_fingerprint),
  lastMutationId: String(row.last_mutation_id), createdAt: asIsoDateTime(String(row.created_at)),
  updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapMutation = (row: Record<string, unknown>): FamilyMeetingMutationRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  resourceType: 'family_meeting', resourceId: String(row.resource_id), actorAccountId: String(row.actor_account_id),
  actorPersonId: asPersonId(String(row.actor_person_id)), mutationKind: String(row.mutation_kind) as FamilyMeetingMutationKind,
  clientOperationId: String(row.client_operation_id), requestFingerprint: String(row.request_fingerprint),
  expectedRevision: Number(row.expected_revision), revision: Number(row.revision),
  resourceStateFingerprint: String(row.resource_state_fingerprint), occurredAt: asIsoDateTime(String(row.occurred_at))
});

const assertKey = (context: PolicyAuthorizedRepositoryExecutionContext, key: FamilyMeetingCenterKey, mode: 'read'|'write'): void => {
  const resourceType = mode === 'read' ? 'family_meeting_center' : 'family_meeting';
  const resourceId = mode === 'read' ? '*' : context.policyAuthorization.resourceId;
  assertPolicyAuthorizedRepositoryContext(context, { resourceType, resourceId,
    action: context.policyAuthorization.action, capability: mode === 'read' ? 'family.read' : 'family.write',
    correlationId: context.correlationId, resourceFamilyId: key.familyId });
  const authorization = context.policyAuthorization;
  if (authorization.purpose !== 'general' || authorization.subject.accountId !== key.accountId
    || authorization.subject.personId !== key.actorPersonId || !authorization.subject.familyIds.includes(key.familyId)
    || authorization.resourceFamilyId !== key.familyId
    || authorization.receiptRecord.request.resource.ownerPersonId !== key.ownerPersonId
    || authorization.receiptRecord.request.resource.sensitivity !== 'personal'
    || key.centerId !== `family-meetings:${key.familyId}:${key.actorPersonId}`
    || (mode === 'read' && (authorization.action !== 'read' || key.ownerPersonId !== key.actorPersonId))
    || (mode === 'write' && !['create','update','delete'].includes(authorization.action)))
    throw new Error('Family meeting key does not match the exact policy receipt');
};
const assertAccess = (context: PolicyAuthorizedRepositoryExecutionContext, key: FamilyMeetingCenterKey): void =>
  assertKey(context, key, context.policyAuthorization.resourceType === 'family_meeting_center' ? 'read' : 'write');
const writeBinding = (context: PolicyAuthorizedRepositoryExecutionContext, row: FamilyMeetingMutationRow) => {
  const binding = platformPolicyPersistenceBinding(context, 'family_meeting', row.resourceId);
  const expectedAction = row.expectedRevision === 0 ? 'create' : context.policyAuthorization.action;
  if (!binding || binding.resourceFamilyId !== row.familyId || binding.purpose !== 'general'
    || binding.capability !== 'family.write' || binding.occurredAt !== row.occurredAt || binding.action !== expectedAction
    || (expectedAction === 'delete' && row.mutationKind !== 'meeting_state_update')
    || (expectedAction === 'create' && row.mutationKind !== 'meeting_create'))
    throw new Error('Family meeting mutation requires an exact durable policy receipt');
  return binding;
};
const currentBinding = (context: PolicyAuthorizedRepositoryExecutionContext, meetingId: string, familyId: string) => {
  assertPolicyAuthorizedRepositoryContext(context, { resourceType: 'family_meeting', resourceId: meetingId,
    action: context.policyAuthorization.action, capability: 'family.write', correlationId: context.correlationId,
    resourceFamilyId: asFamilyId(familyId) });
  const binding = platformPolicyPersistenceBinding(context, 'family_meeting', meetingId);
  if (!binding || binding.purpose !== 'general' || binding.capability !== 'family.write')
    throw new Error('Family meeting current-row receipt is missing');
  return binding;
};

export class SqliteFamilyMeetingRepository extends SqliteRepository implements
  FamilyMeetingRepositoryPort, FamilyMeetingPolicyResourceRepositoryPort {
  public resolvePolicyResource(context: RepositoryExecutionContext, _resourceType: 'family_meeting', resourceId: string)
  : ReturnType<FamilyMeetingPolicyResourceRepositoryPort['resolvePolicyResource']> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`${meetingSelect} WHERE id=?`).get(resourceId) as Record<string, unknown>|undefined;
      return row ? Object.freeze({ id: String(row.id), familyId: asFamilyId(String(row.family_id)),
        ownerPersonId: asPersonId(String(row.owner_person_id)), revision: Number(row.revision),
        status: String(row.state) as FamilyMeetingState, stateFingerprint: String(row.state_fingerprint) }) : null;
    });
  }

  public loadCenter(context: PolicyAuthorizedRepositoryExecutionContext, key: FamilyMeetingCenterKey)
  : RepositoryResult<FamilyMeetingCenterSnapshotRow> {
    assertKey(context,key,'read');
    return this.execute(context, () => {
      const rows=this.database(context).prepare(`${meetingSelect} WHERE family_id=? AND (owner_person_id=? OR EXISTS(
        SELECT 1 FROM family_meeting_participants participant WHERE participant.meeting_id=family_meetings.id
          AND participant.family_id=family_meetings.family_id AND participant.participant_person_id=?
          AND participant.attendance<>'declined')) ORDER BY updated_at DESC,id LIMIT 65`)
        .all(key.familyId,key.actorPersonId,key.actorPersonId) as Record<string,unknown>[];
      if(rows.length>64)throw new Error('Family meeting center bound exceeded');
      return Object.freeze({meetings:Object.freeze(rows.map((row)=>this.#snapshot(context,mapMeeting(row))))});
    });
  }

  public findMeeting(context:PolicyAuthorizedRepositoryExecutionContext,key:FamilyMeetingCenterKey,meetingId:string)
  :RepositoryResult<FamilyMeetingSnapshotRow|null>{
    assertAccess(context,key);
    if(context.policyAuthorization.resourceType==='family_meeting'&&context.policyAuthorization.resourceId!==meetingId)
      throw new Error('Family meeting lookup requires exact meeting receipt');
    return this.execute(context,()=>{
      const row=this.database(context).prepare(`${meetingSelect} WHERE id=? AND family_id=?`).get(meetingId,key.familyId) as Record<string,unknown>|undefined;
      if(!row)return null;const meeting=mapMeeting(row);
      if(context.policyAuthorization.resourceType==='family_meeting_center'&&meeting.ownerPersonId!==key.actorPersonId){
        const visible=this.database(context).prepare(`SELECT 1 ok FROM family_meeting_participants WHERE meeting_id=? AND family_id=?
          AND participant_person_id=? AND attendance<>'declined'`).get(meetingId,key.familyId,key.actorPersonId);
        if(!visible)return null;
      }
      return this.#snapshot(context,meeting);
    });
  }
  public findMutationByClientOperationId(context:PolicyAuthorizedRepositoryExecutionContext,key:FamilyMeetingCenterKey,clientOperationId:string)
  :RepositoryResult<FamilyMeetingMutationRow|null>{
    assertAccess(context,key);return this.execute(context,()=>{const row=this.database(context).prepare(`${mutationSelect}
      WHERE family_id=? AND actor_account_id=? AND client_operation_id=?`).get(key.familyId,key.accountId,clientOperationId) as Record<string,unknown>|undefined;
      return row?mapMutation(row):null;});
  }

  public insertMutation(context:PolicyAuthorizedRepositoryExecutionContext,row:FamilyMeetingMutationRow):RepositoryResult<void>{
    const binding=writeBinding(context,row);
    if(row.actorAccountId!==context.policyAuthorization.subject.accountId||row.actorPersonId!==context.policyAuthorization.subject.personId
      ||row.ownerPersonId!==context.policyAuthorization.receiptRecord.request.resource.ownerPersonId||row.revision!==row.expectedRevision+1)
      throw new Error('Family meeting mutation identity or revision is invalid');
    return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO family_meeting_mutations(
      id,family_id,owner_person_id,resource_type,resource_id,actor_account_id,actor_person_id,mutation_kind,
      client_operation_id,request_fingerprint,expected_revision,revision,resource_state_fingerprint,occurred_at,
      policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,policy_resource_type,
      policy_resource_id,policy_action,policy_capability) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      row.id,row.familyId,row.ownerPersonId,row.resourceType,row.resourceId,row.actorAccountId,row.actorPersonId,row.mutationKind,
      row.clientOperationId,row.requestFingerprint,row.expectedRevision,row.revision,row.resourceStateFingerprint,row.occurredAt,
      binding.receiptHash,binding.receiptVersion,binding.nonce,context.correlationId,binding.resourceType,binding.resourceId,
      binding.action,binding.capability);});
  }
  public insertMeeting(context:PolicyAuthorizedRepositoryExecutionContext,row:FamilyMeetingRow):RepositoryResult<void>{
    const binding=currentBinding(context,row.id,row.familyId);return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO family_meetings(
      id,family_id,owner_person_id,title,recurrence_kind,recurrence_interval,starts_at,ends_at,reminder_minutes,state,
      revision,state_fingerprint,last_mutation_id,created_at,updated_at,policy_receipt_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      row.id,row.familyId,row.ownerPersonId,row.title,row.recurrenceKind,row.recurrenceInterval,row.startsAt,row.endsAt,row.reminderMinutes,
      row.state,row.revision,row.stateFingerprint,row.lastMutationId,row.createdAt,row.updatedAt,binding.receiptHash);});
  }
  public saveMeeting(context:PolicyAuthorizedRepositoryExecutionContext,row:FamilyMeetingRow,expectedRevision:number):RepositoryResult<void>{
    const binding=currentBinding(context,row.id,row.familyId);return this.execute(context,()=>{const result=this.database(context).prepare(`UPDATE family_meetings SET
      title=?,recurrence_kind=?,recurrence_interval=?,starts_at=?,ends_at=?,reminder_minutes=?,state=?,revision=?,state_fingerprint=?,
      last_mutation_id=?,updated_at=?,policy_receipt_hash=? WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`).run(
      row.title,row.recurrenceKind,row.recurrenceInterval,row.startsAt,row.endsAt,row.reminderMinutes,row.state,row.revision,row.stateFingerprint,
      row.lastMutationId,row.updatedAt,binding.receiptHash,row.id,row.familyId,row.ownerPersonId,expectedRevision) as {changes?:number};
      if(Number(result.changes)!==1)throw new Error('Family meeting optimistic revision conflict');});
  }

  public upsertParticipant(context:PolicyAuthorizedRepositoryExecutionContext,row:FamilyMeetingParticipantRow,expectedRevision:number):RepositoryResult<void>{
    currentBinding(context,row.meetingId,row.familyId);return this.execute(context,()=>{
      if(expectedRevision===0)this.database(context).prepare(`INSERT INTO family_meeting_participants(
        id,family_id,owner_person_id,meeting_id,participant_person_id,roles_json,attendance,reminder_enabled,revision,
        last_mutation_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,
        row.meetingId,row.participantPersonId,JSON.stringify(row.roles),row.attendance,row.reminderEnabled?1:0,row.revision,
        row.lastMutationId,row.createdAt,row.updatedAt);
      else {const result=this.database(context).prepare(`UPDATE family_meeting_participants SET roles_json=?,attendance=?,reminder_enabled=?,
        revision=?,last_mutation_id=?,updated_at=? WHERE id=? AND family_id=? AND owner_person_id=? AND meeting_id=? AND revision=?`).run(
        JSON.stringify(row.roles),row.attendance,row.reminderEnabled?1:0,row.revision,row.lastMutationId,row.updatedAt,row.id,row.familyId,
        row.ownerPersonId,row.meetingId,expectedRevision) as {changes?:number};if(Number(result.changes)!==1)throw new Error('Meeting participant revision conflict');}
    });
  }
  public upsertAgendaItem(context:PolicyAuthorizedRepositoryExecutionContext,row:FamilyMeetingAgendaItemRow,expectedRevision:number):RepositoryResult<void>{
    currentBinding(context,row.meetingId,row.familyId);return this.execute(context,()=>{
      if(expectedRevision===0)this.database(context).prepare(`INSERT INTO family_meeting_agenda_items(
        id,family_id,owner_person_id,meeting_id,title,note_text,item_order,pre_read_json,carry_forward,revision,last_mutation_id,
        created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.meetingId,row.title,
        row.note??null,row.order,JSON.stringify(row.preRead),row.carryForwardToNextMeeting?1:0,row.revision,row.lastMutationId,row.createdAt,row.updatedAt);
      else {const result=this.database(context).prepare(`UPDATE family_meeting_agenda_items SET title=?,note_text=?,item_order=?,pre_read_json=?,
        carry_forward=?,revision=?,last_mutation_id=?,updated_at=? WHERE id=? AND family_id=? AND owner_person_id=? AND meeting_id=? AND revision=?`).run(
        row.title,row.note??null,row.order,JSON.stringify(row.preRead),row.carryForwardToNextMeeting?1:0,row.revision,row.lastMutationId,row.updatedAt,
        row.id,row.familyId,row.ownerPersonId,row.meetingId,expectedRevision) as {changes?:number};if(Number(result.changes)!==1)throw new Error('Meeting agenda revision conflict');}
    });
  }
  public insertPoll(context:PolicyAuthorizedRepositoryExecutionContext,row:FamilyMeetingPollRow):RepositoryResult<void>{
    currentBinding(context,row.meetingId,row.familyId);return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO family_meeting_polls(
      id,family_id,owner_person_id,meeting_id,question,options_json,state,mutation_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).run(
      row.id,row.familyId,row.ownerPersonId,row.meetingId,row.question,JSON.stringify(row.options),row.state,row.mutationId,row.createdAt);});
  }
  public insertVote(context:PolicyAuthorizedRepositoryExecutionContext,row:FamilyMeetingVoteRow):RepositoryResult<void>{
    currentBinding(context,row.meetingId,row.familyId);return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO family_meeting_votes(
      id,family_id,owner_person_id,meeting_id,poll_id,voter_person_id,option_id,abstained,opinion_note,mutation_id,cast_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.meetingId,row.pollId,row.voterPersonId,row.optionId??null,
      row.abstained?1:0,row.opinionNote??null,row.mutationId,row.castAt);});
  }
  public insertDecision(context:PolicyAuthorizedRepositoryExecutionContext,row:FamilyMeetingDecisionRow):RepositoryResult<void>{
    currentBinding(context,row.meetingId,row.familyId);return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO family_meeting_decisions(
      id,family_id,owner_person_id,meeting_id,statement,source_poll_id,responsible_person_ids_json,ledger_reference,mutation_id,recorded_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.meetingId,row.statement,row.sourcePollId??null,
      JSON.stringify(row.responsiblePersonIds),row.ledgerReference,row.mutationId,row.recordedAt);});
  }
  public upsertTask(context:PolicyAuthorizedRepositoryExecutionContext,row:FamilyMeetingTaskRow,expectedRevision:number):RepositoryResult<void>{
    currentBinding(context,row.meetingId,row.familyId);return this.execute(context,()=>{
      if(expectedRevision===0)this.database(context).prepare(`INSERT INTO family_meeting_tasks(
        id,family_id,owner_person_id,meeting_id,decision_id,title,responsible_person_id,due_at,state,follow_up_note,carry_forward,
        revision,last_mutation_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,
        row.meetingId,row.decisionId??null,row.title,row.responsiblePersonId,row.dueAt,row.state,row.followUpNote??null,
        row.carryForwardToNextMeeting?1:0,row.revision,row.lastMutationId,row.createdAt,row.updatedAt);
      else {const result=this.database(context).prepare(`UPDATE family_meeting_tasks SET decision_id=?,title=?,responsible_person_id=?,due_at=?,state=?,
        follow_up_note=?,carry_forward=?,revision=?,last_mutation_id=?,updated_at=? WHERE id=? AND family_id=? AND owner_person_id=? AND meeting_id=? AND revision=?`).run(
        row.decisionId??null,row.title,row.responsiblePersonId,row.dueAt,row.state,row.followUpNote??null,row.carryForwardToNextMeeting?1:0,
        row.revision,row.lastMutationId,row.updatedAt,row.id,row.familyId,row.ownerPersonId,row.meetingId,expectedRevision) as {changes?:number};
        if(Number(result.changes)!==1)throw new Error('Meeting task revision conflict');}
    });
  }
  public insertCollaboration(context:PolicyAuthorizedRepositoryExecutionContext,row:FamilyMeetingCollaborationRow):RepositoryResult<void>{
    currentBinding(context,row.meetingId,row.familyId);return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO family_meeting_collaboration_items(
      id,family_id,owner_person_id,meeting_id,kind,resource_type,resource_id,annotation,added_by_person_id,mutation_id,added_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.meetingId,row.kind,row.resourceType,row.resourceId,
      row.annotation??null,row.addedByPersonId,row.mutationId,row.addedAt);});
  }
  public upsertMinutes(context:PolicyAuthorizedRepositoryExecutionContext,row:FamilyMeetingMinutesRow,expectedRevision:number):RepositoryResult<void>{
    currentBinding(context,row.meetingId,row.familyId);return this.execute(context,()=>{
      const values=[row.state,row.recordingRequestId??null,row.transcriptConsentVerified?1:0,row.consentEvidenceSha256??null,
        row.aiSuggestionGenerated?1:0,row.humanApprovalRecorded?1:0,row.sealedPayloadReference??null,row.payloadSha256??null,
        row.payloadSizeBytes??null,row.providerId??null,row.providerEvidenceSha256??null,row.payloadRevision??null,row.payloadCreatedAt??null,
        JSON.stringify(row.participantAccessPersonIds),JSON.stringify(row.selectedRecordingSegmentIds),row.revision,row.stateFingerprint,
        row.lastMutationId,row.updatedAt];
      if(expectedRevision===0)this.database(context).prepare(`INSERT INTO family_meeting_minutes(
        id,family_id,owner_person_id,meeting_id,state,recording_request_id,transcript_consent_verified,consent_evidence_sha256,
        ai_suggestion_generated,human_approval_recorded,sealed_payload_reference,payload_sha256,payload_size_bytes,provider_id,
        provider_evidence_sha256,payload_revision,payload_created_at,participant_access_json,selected_recording_segments_json,
        network_used,cloud_used,revision,state_fingerprint,last_mutation_id,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.meetingId,
        ...values.slice(0,15),row.revision,row.stateFingerprint,row.lastMutationId,row.createdAt,row.updatedAt);
      else {const result=this.database(context).prepare(`UPDATE family_meeting_minutes SET state=?,recording_request_id=?,transcript_consent_verified=?,
        consent_evidence_sha256=?,ai_suggestion_generated=?,human_approval_recorded=?,sealed_payload_reference=?,payload_sha256=?,payload_size_bytes=?,
        provider_id=?,provider_evidence_sha256=?,payload_revision=?,payload_created_at=?,participant_access_json=?,selected_recording_segments_json=?,
        network_used=0,cloud_used=0,revision=?,state_fingerprint=?,last_mutation_id=?,updated_at=?
        WHERE id=? AND family_id=? AND owner_person_id=? AND meeting_id=? AND revision=?`).run(...values,row.id,row.familyId,row.ownerPersonId,row.meetingId,expectedRevision) as {changes?:number};
        if(Number(result.changes)!==1)throw new Error('Meeting minutes revision conflict');}
    });
  }
  public appendEvent(context:PolicyAuthorizedRepositoryExecutionContext,row:FamilyMeetingEventRow):RepositoryResult<void>{
    currentBinding(context,row.meetingId,row.familyId);return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO family_meeting_events(
      id,family_id,owner_person_id,meeting_id,event_kind,meeting_revision,state_fingerprint,mutation_id,occurred_at)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.meetingId,row.eventKind,row.meetingRevision,
      row.stateFingerprint,row.mutationId,row.occurredAt);});
  }

  #snapshot(context:PolicyAuthorizedRepositoryExecutionContext,meeting:FamilyMeetingRow):FamilyMeetingSnapshotRow{
    const db=this.database(context);const args=[meeting.familyId,meeting.ownerPersonId,meeting.id] as const;
    const participants=db.prepare(`${participantSelect} WHERE family_id=? AND owner_person_id=? AND meeting_id=? ORDER BY participant_person_id LIMIT 33`).all(...args) as Record<string,unknown>[];
    const agenda=db.prepare(`${agendaSelect} WHERE family_id=? AND owner_person_id=? AND meeting_id=? ORDER BY item_order,id LIMIT 257`).all(...args) as Record<string,unknown>[];
    const polls=db.prepare(`${pollSelect} WHERE family_id=? AND owner_person_id=? AND meeting_id=? ORDER BY created_at,id LIMIT 65`).all(...args) as Record<string,unknown>[];
    const votes=db.prepare(`${voteSelect} WHERE family_id=? AND owner_person_id=? AND meeting_id=? ORDER BY cast_at,id LIMIT 513`).all(...args) as Record<string,unknown>[];
    const decisions=db.prepare(`${decisionSelect} WHERE family_id=? AND owner_person_id=? AND meeting_id=? ORDER BY recorded_at,id LIMIT 257`).all(...args) as Record<string,unknown>[];
    const tasks=db.prepare(`${taskSelect} WHERE family_id=? AND owner_person_id=? AND meeting_id=? ORDER BY due_at,id LIMIT 257`).all(...args) as Record<string,unknown>[];
    const collaboration=db.prepare(`${collaborationSelect} WHERE family_id=? AND owner_person_id=? AND meeting_id=? ORDER BY added_at,id LIMIT 257`).all(...args) as Record<string,unknown>[];
    if(participants.length>32||agenda.length>256||polls.length>64||votes.length>512||decisions.length>256||tasks.length>256||collaboration.length>256)
      throw new Error('Family meeting child collection bound exceeded');
    const minutesRow=db.prepare(`${minutesSelect} WHERE family_id=? AND owner_person_id=? AND meeting_id=?`).get(...args) as Record<string,unknown>|undefined;
    return Object.freeze({meeting,participants:Object.freeze(participants.map(mapParticipant)),agenda:Object.freeze(agenda.map(mapAgenda)),
      polls:Object.freeze(polls.map(mapPoll)),votes:Object.freeze(votes.map(mapVote)),decisions:Object.freeze(decisions.map(mapDecision)),
      tasks:Object.freeze(tasks.map(mapTask)),collaboration:Object.freeze(collaboration.map(mapCollaboration)),
      minutes:minutesRow?mapMinutes(minutesRow):null});
  }
}
