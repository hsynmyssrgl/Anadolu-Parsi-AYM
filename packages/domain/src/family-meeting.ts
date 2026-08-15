import type { IsoDateTime } from '@ppt/core';

export type FamilyMeetingState = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type FamilyMeetingRecurrenceKind = 'once' | 'daily' | 'weekly' | 'monthly';
export type FamilyMeetingRole = 'host' | 'facilitator' | 'note_taker' | 'translator' | 'caregiver' | 'attendee';
export type FamilyMeetingAttendanceState = 'invited' | 'accepted' | 'tentative' | 'declined' | 'attended' | 'absent';
export type FamilyMeetingPollState = 'open' | 'closed';
export type FamilyMeetingTaskState = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type FamilyMeetingCollaborationKind = 'whiteboard' | 'photo_album' | 'document_annotation';
export type FamilyMeetingMinutesState =
  | 'not_prepared'
  | 'provider_unavailable'
  | 'pending_human_review'
  | 'dismissed'
  | 'sealed_local';

export interface FamilyMeetingPreReadReferenceView {
  readonly resourceType: 'archive_item' | 'communication_message' | 'memory_studio_record';
  readonly resourceId: string;
}

export interface FamilyMeetingParticipantView {
  readonly personId: string;
  readonly roles: readonly FamilyMeetingRole[];
  readonly attendance: FamilyMeetingAttendanceState;
  readonly reminderEnabled: boolean;
  readonly revision: number;
  readonly updatedAt: IsoDateTime;
}

export interface FamilyMeetingAgendaItemView {
  readonly id: string;
  readonly title: string;
  readonly note?: string;
  readonly order: number;
  readonly preRead: readonly FamilyMeetingPreReadReferenceView[];
  readonly carryForwardToNextMeeting: boolean;
  readonly revision: number;
  readonly updatedAt: IsoDateTime;
}

export interface FamilyMeetingPollOptionView {
  readonly id: string;
  readonly label: string;
}

export interface FamilyMeetingVoteView {
  readonly voterPersonId: string;
  readonly optionId?: string;
  readonly abstained: boolean;
  readonly opinionNote?: string;
  readonly castAt: IsoDateTime;
}

export interface FamilyMeetingPollView {
  readonly id: string;
  readonly question: string;
  readonly options: readonly FamilyMeetingPollOptionView[];
  readonly state: FamilyMeetingPollState;
  readonly votes: readonly FamilyMeetingVoteView[];
  readonly createdAt: IsoDateTime;
}

export interface FamilyMeetingDecisionView {
  readonly id: string;
  readonly statement: string;
  readonly sourcePollId?: string;
  readonly responsiblePersonIds: readonly string[];
  readonly ledgerReference: string;
  readonly recordedAt: IsoDateTime;
}

export interface FamilyMeetingTaskView {
  readonly id: string;
  readonly decisionId?: string;
  readonly title: string;
  readonly responsiblePersonId: string;
  readonly dueAt: IsoDateTime;
  readonly state: FamilyMeetingTaskState;
  readonly followUpNote?: string;
  readonly carryForwardToNextMeeting: boolean;
  readonly revision: number;
  readonly updatedAt: IsoDateTime;
}

export interface FamilyMeetingCollaborationView {
  readonly id: string;
  readonly kind: FamilyMeetingCollaborationKind;
  readonly resourceType: 'archive_item' | 'album' | 'whiteboard';
  readonly resourceId: string;
  readonly annotation?: string;
  readonly addedByPersonId: string;
  readonly addedAt: IsoDateTime;
}

export interface FamilyMeetingMinutesMetadataView {
  readonly id: string;
  readonly state: FamilyMeetingMinutesState;
  readonly recordingRequestId?: string;
  readonly transcriptConsentVerified: boolean;
  readonly aiSuggestionGenerated: boolean;
  readonly humanApprovalRecorded: boolean;
  readonly encryptedPackageAvailable: boolean;
  readonly participantAccessPersonIds: readonly string[];
  readonly selectedRecordingSegmentIds: readonly string[];
  readonly revision: number;
  readonly updatedAt: IsoDateTime;
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export interface FamilyMeetingMinutesContentView {
  readonly meetingId: string;
  readonly minutesRevision: number;
  readonly summary: string;
  readonly decisions: readonly string[];
  readonly tasks: readonly string[];
  readonly participantAccessPersonIds: readonly string[];
  readonly selectedRecordingSegmentIds: readonly string[];
  readonly payloadSource: 'local_sealed_store';
  readonly machineGeneratedSource: boolean;
  readonly humanApproved: true;
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export interface FamilyMeetingView {
  readonly id: string;
  readonly ownerPersonId: string;
  readonly title: string;
  readonly recurrenceKind: FamilyMeetingRecurrenceKind;
  readonly recurrenceInterval: number;
  readonly startsAt: IsoDateTime;
  readonly endsAt: IsoDateTime;
  readonly reminderMinutes: number;
  readonly state: FamilyMeetingState;
  readonly participants: readonly FamilyMeetingParticipantView[];
  readonly agenda: readonly FamilyMeetingAgendaItemView[];
  readonly polls: readonly FamilyMeetingPollView[];
  readonly decisions: readonly FamilyMeetingDecisionView[];
  readonly tasks: readonly FamilyMeetingTaskView[];
  readonly collaboration: readonly FamilyMeetingCollaborationView[];
  readonly minutes: FamilyMeetingMinutesMetadataView;
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface FamilyMeetingTruthView {
  readonly singleAndRecurringSchedulingModeled: true;
  readonly agendaPreReadAttendanceReminderModeled: true;
  readonly explicitMeetingRolesModeled: true;
  readonly pollVoteAbstentionOpinionModeled: true;
  readonly appendOnlyDecisionLedgerModeled: true;
  readonly taskFollowUpCarryForwardModeled: true;
  readonly collaborationReferencesModeled: true;
  readonly transcriptConsentGateModeled: true;
  readonly humanApprovalRequiredForAiMinutes: true;
  readonly encryptedMinutesPackageImplemented: true;
  readonly participantScopedMinutesReadImplemented: true;
  readonly productionAiMinutesProviderConfigured: false;
  readonly transcriptPayloadReadExecutedByCurrentImplementation: false;
  readonly externalCalendarDeliveryExecuted: false;
  readonly externalReminderDeliveryExecuted: false;
  readonly remoteCollaborationExecuted: false;
  readonly networkUsedByCurrentImplementation: false;
}

export interface FamilyMeetingCenterView {
  readonly schemaVersion: 1;
  readonly centerId: string;
  readonly ownerPersonId: string;
  readonly meetings: readonly FamilyMeetingView[];
  readonly truth: FamilyMeetingTruthView;
  readonly generatedAt: IsoDateTime;
}

export interface CreateFamilyMeetingInput {
  readonly clientOperationId: string;
  readonly expectedRevision: 0;
  readonly title: string;
  readonly recurrenceKind: FamilyMeetingRecurrenceKind;
  readonly recurrenceInterval: number;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly reminderMinutes: number;
  readonly participantPersonIds: readonly string[];
}

export interface UpdateFamilyMeetingPlanInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly meetingId: string;
  readonly title: string;
  readonly recurrenceKind: FamilyMeetingRecurrenceKind;
  readonly recurrenceInterval: number;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly reminderMinutes: number;
}

export interface SetFamilyMeetingStateInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly meetingId: string;
  readonly state: 'in_progress' | 'completed' | 'cancelled';
  readonly reason: string;
}

export interface UpsertFamilyMeetingParticipantInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly meetingId: string;
  readonly participantPersonId: string;
  readonly roles: readonly FamilyMeetingRole[];
  readonly attendance: FamilyMeetingAttendanceState;
  readonly reminderEnabled: boolean;
}

export interface UpsertFamilyMeetingAgendaItemInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly meetingId: string;
  readonly agendaItemId?: string;
  readonly title: string;
  readonly note?: string;
  readonly order: number;
  readonly preRead: readonly FamilyMeetingPreReadReferenceView[];
  readonly carryForwardToNextMeeting: boolean;
}

export interface CreateFamilyMeetingPollInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly meetingId: string;
  readonly question: string;
  readonly options: readonly string[];
}

export interface CastFamilyMeetingVoteInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly meetingId: string;
  readonly pollId: string;
  readonly optionId?: string;
  readonly abstain: boolean;
  readonly opinionNote?: string;
}

export interface RecordFamilyMeetingDecisionInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly meetingId: string;
  readonly statement: string;
  readonly sourcePollId?: string;
  readonly responsiblePersonIds: readonly string[];
}

export interface UpsertFamilyMeetingTaskInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly meetingId: string;
  readonly taskId?: string;
  readonly decisionId?: string;
  readonly title: string;
  readonly responsiblePersonId: string;
  readonly dueAt: string;
  readonly state: FamilyMeetingTaskState;
  readonly followUpNote?: string;
  readonly carryForwardToNextMeeting: boolean;
}

export interface AddFamilyMeetingCollaborationInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly meetingId: string;
  readonly kind: FamilyMeetingCollaborationKind;
  readonly resourceType: 'archive_item' | 'album' | 'whiteboard';
  readonly resourceId: string;
  readonly annotation?: string;
}

export interface PrepareFamilyMeetingAiMinutesInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly meetingId: string;
  readonly recordingRequestId: string;
}

export interface FinalizeFamilyMeetingMinutesInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly meetingId: string;
  readonly summary: string;
  readonly decisions: readonly string[];
  readonly tasks: readonly string[];
  readonly participantAccessPersonIds: readonly string[];
  readonly selectedRecordingSegmentIds: readonly string[];
  readonly explicitHumanApproval: true;
  readonly machineGeneratedSource: boolean;
}

export type FamilyMeetingMutationKind =
  | 'meeting_create'
  | 'meeting_plan_update'
  | 'meeting_state_update'
  | 'participant_upsert'
  | 'agenda_upsert'
  | 'poll_create'
  | 'vote_cast'
  | 'decision_record'
  | 'task_upsert'
  | 'collaboration_add'
  | 'ai_minutes_prepare'
  | 'minutes_finalize';

export type FamilyMeetingResourceType = 'family_meeting';

export interface FamilyMeetingMutationReceiptView {
  readonly resourceType: FamilyMeetingResourceType;
  readonly resourceId: string;
  readonly mutationKind: FamilyMeetingMutationKind;
  readonly previousRevision: number;
  readonly revision: number;
  readonly occurredAt: IsoDateTime;
  readonly replayed: boolean;
  readonly encryptedMinutesPackageWritten: boolean;
  readonly aiProviderConfigured: false;
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export const familyMeetingCenterId = (familyId: string, ownerPersonId: string): string =>
  `family-meetings:${familyId}:${ownerPersonId}`;

export const familyMeetingTruth = Object.freeze({
  singleAndRecurringSchedulingModeled: true as const,
  agendaPreReadAttendanceReminderModeled: true as const,
  explicitMeetingRolesModeled: true as const,
  pollVoteAbstentionOpinionModeled: true as const,
  appendOnlyDecisionLedgerModeled: true as const,
  taskFollowUpCarryForwardModeled: true as const,
  collaborationReferencesModeled: true as const,
  transcriptConsentGateModeled: true as const,
  humanApprovalRequiredForAiMinutes: true as const,
  encryptedMinutesPackageImplemented: true as const,
  participantScopedMinutesReadImplemented: true as const,
  productionAiMinutesProviderConfigured: false as const,
  transcriptPayloadReadExecutedByCurrentImplementation: false as const,
  externalCalendarDeliveryExecuted: false as const,
  externalReminderDeliveryExecuted: false as const,
  remoteCollaborationExecuted: false as const,
  networkUsedByCurrentImplementation: false as const
});
