import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type {
  CommunicationRecordingAgeCategory,
  CommunicationRecordingConsentState,
  CommunicationRecordingMutationKind,
  CommunicationRecordingRequestState,
  CommunicationRecordingResourceType,
  CommunicationRecordingSegmentMode
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type CommunicationRecordingCallGuardRow,
  type CommunicationRecordingCenterKey,
  type CommunicationRecordingCenterSnapshotRow,
  type CommunicationRecordingConsentRow,
  type CommunicationRecordingEventRow,
  type CommunicationRecordingMutationRow,
  type CommunicationRecordingPolicyResourceRepositoryPort,
  type CommunicationRecordingRepositoryPort,
  type CommunicationRecordingRequestRow,
  type CommunicationRecordingRequestSnapshotRow,
  type CommunicationRecordingRetentionRow,
  type CommunicationRecordingSegmentRow,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const requestSelect = `SELECT id,family_id,owner_person_id,call_session_id,state,notice_version,revision,state_fingerprint,
  last_mutation_id,created_at,updated_at FROM communication_recording_requests`;
const consentSelect = `SELECT id,family_id,owner_person_id,request_id,participant_person_id,state,notice_version,
  explicit_consent,age_category,age_appropriate_notice_acknowledged,guardian_policy_verified,revision,last_mutation_id,
  created_at,updated_at,decided_at FROM communication_recording_consents`;
const retentionSelect = `SELECT id,family_id,owner_person_id,request_id,audio_days,video_days,transcript_days,translation_days,
  persist_transcript,persist_translation,secure_deletion_requested,revision,last_mutation_id,created_at,updated_at
  FROM communication_recording_retention`;
const segmentSelect = `SELECT id,family_id,owner_person_id,request_id,mode,capture_started,transcript_persisted,
  translation_persisted,request_revision,mutation_id,occurred_at FROM communication_recording_segments`;
const mutationSelect = `SELECT id,family_id,owner_person_id,resource_type,resource_id,actor_account_id,actor_person_id,
  mutation_kind,client_operation_id,request_fingerprint,expected_revision,revision,resource_state_fingerprint,occurred_at
  FROM communication_recording_mutations`;

const mapRequest = (row: Record<string, unknown>): CommunicationRecordingRequestRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  callSessionId: String(row.call_session_id), state: String(row.state) as CommunicationRecordingRequestState,
  noticeVersion: String(row.notice_version), revision: Number(row.revision), stateFingerprint: String(row.state_fingerprint),
  lastMutationId: String(row.last_mutation_id), createdAt: asIsoDateTime(String(row.created_at)),
  updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapConsent = (row: Record<string, unknown>): CommunicationRecordingConsentRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  requestId: String(row.request_id), participantPersonId: asPersonId(String(row.participant_person_id)),
  state: String(row.state) as CommunicationRecordingConsentState, noticeVersion: String(row.notice_version),
  explicitConsent: Number(row.explicit_consent) === 1, ageCategory: String(row.age_category) as CommunicationRecordingAgeCategory,
  ageAppropriateNoticeAcknowledged: Number(row.age_appropriate_notice_acknowledged) === 1,
  guardianPolicyVerified: false, revision: Number(row.revision), lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)), updatedAt: asIsoDateTime(String(row.updated_at)),
  ...(row.decided_at ? { decidedAt: asIsoDateTime(String(row.decided_at)) } : {})
});
const mapRetention = (row: Record<string, unknown>): CommunicationRecordingRetentionRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  requestId: String(row.request_id), audioDays: Number(row.audio_days), videoDays: Number(row.video_days),
  transcriptDays: Number(row.transcript_days), translationDays: Number(row.translation_days),
  persistTranscript: Number(row.persist_transcript) === 1, persistTranslation: Number(row.persist_translation) === 1,
  secureDeletionRequested: Number(row.secure_deletion_requested) === 1, revision: Number(row.revision),
  lastMutationId: String(row.last_mutation_id), createdAt: asIsoDateTime(String(row.created_at)),
  updatedAt: asIsoDateTime(String(row.updated_at))
});
const mapSegment = (row: Record<string, unknown>): CommunicationRecordingSegmentRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  requestId: String(row.request_id), mode: String(row.mode) as CommunicationRecordingSegmentMode,
  captureStarted: false, transcriptPersisted: false, translationPersisted: false,
  requestRevision: Number(row.request_revision), mutationId: String(row.mutation_id),
  occurredAt: asIsoDateTime(String(row.occurred_at))
});
const mapMutation = (row: Record<string, unknown>): CommunicationRecordingMutationRow => Object.freeze({
  id: String(row.id), familyId: asFamilyId(String(row.family_id)), ownerPersonId: asPersonId(String(row.owner_person_id)),
  resourceType: String(row.resource_type) as CommunicationRecordingResourceType, resourceId: String(row.resource_id),
  actorAccountId: String(row.actor_account_id), actorPersonId: asPersonId(String(row.actor_person_id)),
  mutationKind: String(row.mutation_kind) as CommunicationRecordingMutationKind,
  clientOperationId: String(row.client_operation_id), requestFingerprint: String(row.request_fingerprint),
  expectedRevision: Number(row.expected_revision), revision: Number(row.revision),
  resourceStateFingerprint: String(row.resource_state_fingerprint), occurredAt: asIsoDateTime(String(row.occurred_at))
});

const assertKey = (context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationRecordingCenterKey, mode: 'read' | 'write'): void => {
  assertPolicyAuthorizedRepositoryContext(context, { resourceType: mode === 'read' ? 'communication_recording_center' : 'communication_recording_request',
    resourceId: mode === 'read' ? '*' : context.policyAuthorization.resourceId, action: context.policyAuthorization.action,
    capability: mode === 'read' ? 'family.read' : 'family.write', correlationId: context.correlationId,
    resourceFamilyId: key.familyId });
  const authorization = context.policyAuthorization;
  if (authorization.purpose !== 'general' || authorization.subject.accountId !== key.accountId
    || authorization.subject.personId !== key.actorPersonId || !authorization.subject.familyIds.includes(key.familyId)
    || authorization.resourceFamilyId !== key.familyId
    || authorization.receiptRecord.request.resource.ownerPersonId !== key.ownerPersonId
    || authorization.receiptRecord.request.resource.sensitivity !== 'highly_sensitive'
    || key.centerId !== `communication-recording:${key.familyId}:${key.ownerPersonId}`
    || (mode === 'read' && (authorization.action !== 'read' || key.actorPersonId !== key.ownerPersonId))
    || (mode === 'write' && !['create','update','delete'].includes(authorization.action)))
    throw new Error('Communication recording key does not match the exact policy receipt');
};
const assertAccess = (context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationRecordingCenterKey): void =>
  assertKey(context, key, context.policyAuthorization.resourceType === 'communication_recording_center' ? 'read' : 'write');
const expectedAction = (row: CommunicationRecordingMutationRow): 'create' | 'update' | 'delete' =>
  row.mutationKind === 'recording_request_create' ? 'create'
    : row.mutationKind === 'recording_delete_request' ? 'delete' : 'update';
const writeBinding = (context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationRecordingMutationRow) => {
  const binding = platformPolicyPersistenceBinding(context, row.resourceType, row.resourceId);
  if (!binding || binding.resourceFamilyId !== row.familyId || binding.purpose !== 'general'
    || binding.capability !== 'family.write' || binding.occurredAt !== row.occurredAt || binding.action !== expectedAction(row))
    throw new Error('Communication recording mutation requires an exact durable policy receipt');
  return binding;
};
const currentBinding = (context: PolicyAuthorizedRepositoryExecutionContext, requestId: string, familyId: string) => {
  assertPolicyAuthorizedRepositoryContext(context, { resourceType: 'communication_recording_request', resourceId: requestId,
    action: context.policyAuthorization.action, capability: 'family.write', correlationId: context.correlationId,
    resourceFamilyId: asFamilyId(familyId) });
  const binding = platformPolicyPersistenceBinding(context, 'communication_recording_request', requestId);
  if (!binding || binding.purpose !== 'general' || binding.capability !== 'family.write')
    throw new Error('Communication recording current-row receipt is missing');
  return binding;
};

export class SqliteCommunicationRecordingRepository extends SqliteRepository implements
  CommunicationRecordingRepositoryPort, CommunicationRecordingPolicyResourceRepositoryPort {
  public resolvePolicyResource(context: RepositoryExecutionContext, resourceType: CommunicationRecordingResourceType, resourceId: string)
  : ReturnType<CommunicationRecordingPolicyResourceRepositoryPort['resolvePolicyResource']> {
    return this.execute(context, () => {
      if (resourceType !== 'communication_recording_request') throw new Error('Communication recording resource type is unsupported');
      const row = this.database(context).prepare(`SELECT id,family_id,owner_person_id,revision,state status,state_fingerprint
        FROM communication_recording_requests WHERE id=?`).get(resourceId) as Record<string, unknown> | undefined;
      return row ? Object.freeze({ id: String(row.id), familyId: asFamilyId(String(row.family_id)),
        ownerPersonId: asPersonId(String(row.owner_person_id)), revision: Number(row.revision),
        status: String(row.status), stateFingerprint: String(row.state_fingerprint) }) : null;
    });
  }

  private snapshot(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationRecordingCenterKey,
    request: CommunicationRecordingRequestRow): CommunicationRecordingRequestSnapshotRow {
    const consentRows = this.database(context).prepare(`${consentSelect} WHERE family_id=? AND owner_person_id=? AND request_id=?
      ORDER BY participant_person_id,id LIMIT 17`).all(key.familyId,key.ownerPersonId,request.id) as Record<string,unknown>[];
    if (consentRows.length < 2 || consentRows.length > 16) throw new Error('Communication recording participant bound is invalid');
    const retentionRow = this.database(context).prepare(`${retentionSelect} WHERE family_id=? AND owner_person_id=? AND request_id=?`)
      .get(key.familyId,key.ownerPersonId,request.id) as Record<string,unknown>|undefined;
    if (!retentionRow) throw new Error('Communication recording retention row is missing');
    const segmentRows = this.database(context).prepare(`${segmentSelect} WHERE family_id=? AND owner_person_id=? AND request_id=?
      ORDER BY request_revision,id LIMIT 129`).all(key.familyId,key.ownerPersonId,request.id) as Record<string,unknown>[];
    if (segmentRows.length > 128) throw new Error('Communication recording segment bound exceeded');
    return Object.freeze({ request, consents: Object.freeze(consentRows.map(mapConsent)),
      retention: mapRetention(retentionRow), segments: Object.freeze(segmentRows.map(mapSegment)) });
  }

  public loadCenter(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationRecordingCenterKey)
  : RepositoryResult<CommunicationRecordingCenterSnapshotRow> {
    assertKey(context,key,'read');
    return this.execute(context, () => {
      const rows = this.database(context).prepare(`${requestSelect} WHERE family_id=? AND owner_person_id=?
        ORDER BY updated_at DESC,id LIMIT 257`).all(key.familyId,key.ownerPersonId) as Record<string,unknown>[];
      if (rows.length > 256) throw new Error('Communication recording request bound exceeded');
      return Object.freeze({ requests: Object.freeze(rows.map(mapRequest).map((request) => this.snapshot(context,key,request))) });
    });
  }

  public findRequest(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationRecordingCenterKey, requestId: string)
  : RepositoryResult<CommunicationRecordingRequestSnapshotRow|null> {
    assertAccess(context,key);
    return this.execute(context, () => {
      const row=this.database(context).prepare(`${requestSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
        .get(requestId,key.familyId,key.ownerPersonId) as Record<string,unknown>|undefined;
      return row ? this.snapshot(context,key,mapRequest(row)) : null;
    });
  }

  public findCallGuard(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationRecordingCenterKey, callSessionId: string)
  : RepositoryResult<CommunicationRecordingCallGuardRow|null> {
    assertAccess(context,key);
    return this.execute(context, () => {
      const session=this.database(context).prepare(`SELECT id,family_id,owner_person_id,state FROM communication_call_sessions
        WHERE id=? AND family_id=? AND owner_person_id=?`).get(callSessionId,key.familyId,key.ownerPersonId) as Record<string,unknown>|undefined;
      if(!session)return null;
      const participants=this.database(context).prepare(`SELECT person_id FROM communication_call_participants
        WHERE session_id=? AND family_id=? AND owner_person_id=? AND state<>'left' ORDER BY person_id LIMIT 17`)
        .all(callSessionId,key.familyId,key.ownerPersonId) as Array<{person_id:string}>;
      if(participants.length<2||participants.length>16)throw new Error('Communication call participant guard is invalid');
      return Object.freeze({id:String(session.id),familyId:asFamilyId(String(session.family_id)),
        ownerPersonId:asPersonId(String(session.owner_person_id)),state:String(session.state),
        participantPersonIds:Object.freeze(participants.map((row)=>asPersonId(String(row.person_id))))});
    });
  }

  public isEligibleLateJoiner(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationRecordingCenterKey,
    callSessionId: string, participantPersonId: CommunicationRecordingCallGuardRow['ownerPersonId']): RepositoryResult<boolean> {
    assertAccess(context,key);
    return this.execute(context, () => Boolean(this.database(context).prepare(`SELECT 1 present
      FROM communication_call_sessions session
      JOIN communication_room_memberships membership ON membership.room_id=session.room_id
        AND membership.family_id=session.family_id AND membership.owner_person_id=session.owner_person_id
        AND membership.member_person_id=? AND membership.status='active'
      JOIN people participant ON participant.id=membership.member_person_id AND participant.family_id=session.family_id
        AND participant.status='active'
      WHERE session.id=? AND session.family_id=? AND session.owner_person_id=?
        AND session.state NOT IN ('ended','cancelled') LIMIT 1`)
      .get(participantPersonId,callSessionId,key.familyId,key.ownerPersonId)));
  }

  public findMutationByClientOperationId(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationRecordingCenterKey,
    clientOperationId: string): RepositoryResult<CommunicationRecordingMutationRow|null> {
    assertAccess(context,key);
    return this.execute(context,()=>{const row=this.database(context).prepare(`${mutationSelect}
      WHERE family_id=? AND actor_account_id=? AND client_operation_id=?`).get(key.familyId,key.accountId,clientOperationId) as
      Record<string,unknown>|undefined;return row?mapMutation(row):null;});
  }

  public insertMutation(context: PolicyAuthorizedRepositoryExecutionContext, row: CommunicationRecordingMutationRow): RepositoryResult<void> {
    const binding=writeBinding(context,row);
    if(row.actorAccountId!==context.policyAuthorization.subject.accountId||row.actorPersonId!==context.policyAuthorization.subject.personId
      ||row.ownerPersonId!==context.policyAuthorization.receiptRecord.request.resource.ownerPersonId||row.revision!==row.expectedRevision+1)
      throw new Error('Communication recording mutation identity or revision is invalid');
    return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO communication_recording_mutations(
      id,family_id,owner_person_id,resource_type,resource_id,actor_account_id,actor_person_id,mutation_kind,
      client_operation_id,request_fingerprint,expected_revision,revision,resource_state_fingerprint,occurred_at,
      policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,policy_resource_type,
      policy_resource_id,policy_action,policy_capability) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      row.id,row.familyId,row.ownerPersonId,row.resourceType,row.resourceId,row.actorAccountId,row.actorPersonId,row.mutationKind,
      row.clientOperationId,row.requestFingerprint,row.expectedRevision,row.revision,row.resourceStateFingerprint,row.occurredAt,
      binding.receiptHash,binding.receiptVersion,binding.nonce,context.correlationId,binding.resourceType,binding.resourceId,
      binding.action,binding.capability);});
  }

  public insertRequest(context: PolicyAuthorizedRepositoryExecutionContext,row:CommunicationRecordingRequestRow):RepositoryResult<void>{
    const binding=currentBinding(context,row.id,row.familyId);
    return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO communication_recording_requests(
      id,family_id,owner_person_id,call_session_id,state,notice_version,revision,state_fingerprint,last_mutation_id,
      created_at,updated_at,policy_receipt_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,
      row.callSessionId,row.state,row.noticeVersion,row.revision,row.stateFingerprint,row.lastMutationId,row.createdAt,row.updatedAt,binding.receiptHash);});
  }
  public saveRequest(context:PolicyAuthorizedRepositoryExecutionContext,row:CommunicationRecordingRequestRow,expectedRevision:number):RepositoryResult<void>{
    const binding=currentBinding(context,row.id,row.familyId);
    return this.execute(context,()=>{const result=this.database(context).prepare(`UPDATE communication_recording_requests SET
      state=?,revision=?,state_fingerprint=?,last_mutation_id=?,updated_at=?,policy_receipt_hash=?
      WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`).run(row.state,row.revision,row.stateFingerprint,
      row.lastMutationId,row.updatedAt,binding.receiptHash,row.id,row.familyId,row.ownerPersonId,expectedRevision) as {changes?:number};
      if(Number(result.changes)!==1)throw new Error('Communication recording request optimistic revision conflict');});
  }
  private insertConsentRows(context:PolicyAuthorizedRepositoryExecutionContext,rows:readonly CommunicationRecordingConsentRow[]):RepositoryResult<void>{
    return this.execute(context,()=>{const statement=this.database(context).prepare(`INSERT INTO communication_recording_consents(
      id,family_id,owner_person_id,request_id,participant_person_id,state,notice_version,explicit_consent,age_category,
      age_appropriate_notice_acknowledged,guardian_policy_verified,revision,last_mutation_id,created_at,updated_at,decided_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);for(const row of rows){currentBinding(context,row.requestId,row.familyId);statement.run(
      row.id,row.familyId,row.ownerPersonId,row.requestId,row.participantPersonId,row.state,row.noticeVersion,row.explicitConsent?1:0,
      row.ageCategory,row.ageAppropriateNoticeAcknowledged?1:0,0,row.revision,row.lastMutationId,row.createdAt,row.updatedAt,row.decidedAt??null);}});
  }
  public insertConsents(context:PolicyAuthorizedRepositoryExecutionContext,rows:readonly CommunicationRecordingConsentRow[]):RepositoryResult<void>{
    if(rows.length<2||rows.length>16)throw new Error('Communication recording consent batch is invalid');return this.insertConsentRows(context,rows);
  }
  public insertLateJoinerConsent(context:PolicyAuthorizedRepositoryExecutionContext,row:CommunicationRecordingConsentRow):RepositoryResult<void>{
    return this.insertConsentRows(context,[row]);
  }
  public saveConsent(context:PolicyAuthorizedRepositoryExecutionContext,row:CommunicationRecordingConsentRow,expectedRevision:number):RepositoryResult<void>{
    currentBinding(context,row.requestId,row.familyId);
    return this.execute(context,()=>{const result=this.database(context).prepare(`UPDATE communication_recording_consents SET
      state=?,explicit_consent=?,age_category=?,age_appropriate_notice_acknowledged=?,guardian_policy_verified=0,
      revision=?,last_mutation_id=?,updated_at=?,decided_at=? WHERE id=? AND family_id=? AND owner_person_id=? AND request_id=? AND revision=?`)
      .run(row.state,row.explicitConsent?1:0,row.ageCategory,row.ageAppropriateNoticeAcknowledged?1:0,row.revision,row.lastMutationId,
        row.updatedAt,row.decidedAt??null,row.id,row.familyId,row.ownerPersonId,row.requestId,expectedRevision) as {changes?:number};
      if(Number(result.changes)!==1)throw new Error('Communication recording consent optimistic revision conflict');});
  }
  public saveRetention(context:PolicyAuthorizedRepositoryExecutionContext,row:CommunicationRecordingRetentionRow,expectedRevision:number):RepositoryResult<void>{
    currentBinding(context,row.requestId,row.familyId);
    return this.execute(context,()=>{if(expectedRevision===0){this.database(context).prepare(`INSERT INTO communication_recording_retention(
      id,family_id,owner_person_id,request_id,audio_days,video_days,transcript_days,translation_days,persist_transcript,
      persist_translation,secure_deletion_requested,revision,last_mutation_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(row.id,row.familyId,row.ownerPersonId,row.requestId,row.audioDays,row.videoDays,row.transcriptDays,row.translationDays,
        row.persistTranscript?1:0,row.persistTranslation?1:0,row.secureDeletionRequested?1:0,row.revision,row.lastMutationId,row.createdAt,row.updatedAt);return;}
      const result=this.database(context).prepare(`UPDATE communication_recording_retention SET audio_days=?,video_days=?,transcript_days=?,
        translation_days=?,persist_transcript=?,persist_translation=?,secure_deletion_requested=?,revision=?,last_mutation_id=?,updated_at=?
        WHERE id=? AND family_id=? AND owner_person_id=? AND request_id=? AND revision=?`).run(row.audioDays,row.videoDays,row.transcriptDays,
        row.translationDays,row.persistTranscript?1:0,row.persistTranslation?1:0,row.secureDeletionRequested?1:0,row.revision,row.lastMutationId,
        row.updatedAt,row.id,row.familyId,row.ownerPersonId,row.requestId,expectedRevision) as {changes?:number};
      if(Number(result.changes)!==1)throw new Error('Communication recording retention optimistic revision conflict');});
  }
  public appendSegment(context:PolicyAuthorizedRepositoryExecutionContext,row:CommunicationRecordingSegmentRow):RepositoryResult<void>{
    currentBinding(context,row.requestId,row.familyId);return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO communication_recording_segments(
      id,family_id,owner_person_id,request_id,mode,capture_started,transcript_persisted,translation_persisted,request_revision,mutation_id,occurred_at)
      VALUES(?,?,?,?,?,0,0,0,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.requestId,row.mode,row.requestRevision,row.mutationId,row.occurredAt);});
  }
  public appendEvent(context:PolicyAuthorizedRepositoryExecutionContext,row:CommunicationRecordingEventRow):RepositoryResult<void>{
    currentBinding(context,row.requestId,row.familyId);return this.execute(context,()=>{this.database(context).prepare(`INSERT INTO communication_recording_events(
      id,family_id,owner_person_id,request_id,event_kind,request_revision,state_fingerprint,mutation_id,occurred_at) VALUES(?,?,?,?,?,?,?,?,?)`)
      .run(row.id,row.familyId,row.ownerPersonId,row.requestId,row.eventKind,row.requestRevision,row.stateFingerprint,row.mutationId,row.occurredAt);});
  }
}
