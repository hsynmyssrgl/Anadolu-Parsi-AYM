import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type {
  FamilyMeetingAgendaItemView,
  FamilyMeetingAttendanceState,
  FamilyMeetingCollaborationKind,
  FamilyMeetingDecisionView,
  FamilyMeetingMinutesState,
  FamilyMeetingMutationKind,
  FamilyMeetingPollOptionView,
  FamilyMeetingPollState,
  FamilyMeetingPreReadReferenceView,
  FamilyMeetingRecurrenceKind,
  FamilyMeetingRole,
  FamilyMeetingState,
  FamilyMeetingTaskState
} from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface FamilyMeetingCenterKey {
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly actorPersonId: PersonId;
  readonly ownerPersonId: PersonId;
  readonly centerId: string;
}

export interface FamilyMeetingRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly title: string;
  readonly recurrenceKind: FamilyMeetingRecurrenceKind;
  readonly recurrenceInterval: number;
  readonly startsAt: IsoDateTime;
  readonly endsAt: IsoDateTime;
  readonly reminderMinutes: number;
  readonly state: FamilyMeetingState;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface FamilyMeetingParticipantRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly meetingId: string;
  readonly participantPersonId: PersonId;
  readonly roles: readonly FamilyMeetingRole[];
  readonly attendance: FamilyMeetingAttendanceState;
  readonly reminderEnabled: boolean;
  readonly revision: number;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface FamilyMeetingAgendaItemRow extends Omit<FamilyMeetingAgendaItemView, 'updatedAt'> {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly meetingId: string;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface FamilyMeetingPollRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly meetingId: string;
  readonly question: string;
  readonly options: readonly FamilyMeetingPollOptionView[];
  readonly state: FamilyMeetingPollState;
  readonly mutationId: string;
  readonly createdAt: IsoDateTime;
}

export interface FamilyMeetingVoteRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly meetingId: string;
  readonly pollId: string;
  readonly voterPersonId: PersonId;
  readonly optionId?: string;
  readonly abstained: boolean;
  readonly opinionNote?: string;
  readonly mutationId: string;
  readonly castAt: IsoDateTime;
}

export interface FamilyMeetingDecisionRow extends Omit<FamilyMeetingDecisionView, 'recordedAt'> {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly meetingId: string;
  readonly mutationId: string;
  readonly recordedAt: IsoDateTime;
}

export interface FamilyMeetingTaskRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly meetingId: string;
  readonly decisionId?: string;
  readonly title: string;
  readonly responsiblePersonId: PersonId;
  readonly dueAt: IsoDateTime;
  readonly state: FamilyMeetingTaskState;
  readonly followUpNote?: string;
  readonly carryForwardToNextMeeting: boolean;
  readonly revision: number;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface FamilyMeetingCollaborationRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly meetingId: string;
  readonly kind: FamilyMeetingCollaborationKind;
  readonly resourceType: 'archive_item' | 'album' | 'whiteboard';
  readonly resourceId: string;
  readonly annotation?: string;
  readonly addedByPersonId: PersonId;
  readonly mutationId: string;
  readonly addedAt: IsoDateTime;
}

export interface FamilyMeetingMinutesRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly meetingId: string;
  readonly state: FamilyMeetingMinutesState;
  readonly recordingRequestId?: string;
  readonly transcriptConsentVerified: boolean;
  readonly consentEvidenceSha256?: string;
  readonly aiSuggestionGenerated: boolean;
  readonly humanApprovalRecorded: boolean;
  readonly sealedPayloadReference?: string;
  readonly payloadSha256?: string;
  readonly payloadSizeBytes?: number;
  readonly providerId?: string;
  readonly providerEvidenceSha256?: string;
  readonly payloadRevision?: number;
  readonly payloadCreatedAt?: IsoDateTime;
  readonly participantAccessPersonIds: readonly PersonId[];
  readonly selectedRecordingSegmentIds: readonly string[];
  readonly networkUsed: false;
  readonly cloudUsed: false;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface FamilyMeetingMutationRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly resourceType: 'family_meeting';
  readonly resourceId: string;
  readonly actorAccountId: string;
  readonly actorPersonId: PersonId;
  readonly mutationKind: FamilyMeetingMutationKind;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly expectedRevision: number;
  readonly revision: number;
  readonly resourceStateFingerprint: string;
  readonly occurredAt: IsoDateTime;
}

export interface FamilyMeetingEventRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly meetingId: string;
  readonly eventKind: FamilyMeetingMutationKind;
  readonly meetingRevision: number;
  readonly stateFingerprint: string;
  readonly mutationId: string;
  readonly occurredAt: IsoDateTime;
}

export interface FamilyMeetingSnapshotRow {
  readonly meeting: FamilyMeetingRow;
  readonly participants: readonly FamilyMeetingParticipantRow[];
  readonly agenda: readonly FamilyMeetingAgendaItemRow[];
  readonly polls: readonly FamilyMeetingPollRow[];
  readonly votes: readonly FamilyMeetingVoteRow[];
  readonly decisions: readonly FamilyMeetingDecisionRow[];
  readonly tasks: readonly FamilyMeetingTaskRow[];
  readonly collaboration: readonly FamilyMeetingCollaborationRow[];
  readonly minutes: FamilyMeetingMinutesRow | null;
}

export interface FamilyMeetingCenterSnapshotRow {
  readonly meetings: readonly FamilyMeetingSnapshotRow[];
}

export interface FamilyMeetingRepositoryPort {
  loadCenter(context: PolicyAuthorizedRepositoryExecutionContext, key: FamilyMeetingCenterKey): RepositoryResult<FamilyMeetingCenterSnapshotRow>;
  findMeeting(context: PolicyAuthorizedRepositoryExecutionContext, key: FamilyMeetingCenterKey, meetingId: string): RepositoryResult<FamilyMeetingSnapshotRow | null>;
  findMutationByClientOperationId(context: PolicyAuthorizedRepositoryExecutionContext, key: FamilyMeetingCenterKey, clientOperationId: string): RepositoryResult<FamilyMeetingMutationRow | null>;
  insertMutation(context: PolicyAuthorizedRepositoryExecutionContext, row: FamilyMeetingMutationRow): RepositoryResult<void>;
  insertMeeting(context: PolicyAuthorizedRepositoryExecutionContext, row: FamilyMeetingRow): RepositoryResult<void>;
  saveMeeting(context: PolicyAuthorizedRepositoryExecutionContext, row: FamilyMeetingRow, expectedRevision: number): RepositoryResult<void>;
  upsertParticipant(context: PolicyAuthorizedRepositoryExecutionContext, row: FamilyMeetingParticipantRow, expectedRevision: number): RepositoryResult<void>;
  upsertAgendaItem(context: PolicyAuthorizedRepositoryExecutionContext, row: FamilyMeetingAgendaItemRow, expectedRevision: number): RepositoryResult<void>;
  insertPoll(context: PolicyAuthorizedRepositoryExecutionContext, row: FamilyMeetingPollRow): RepositoryResult<void>;
  insertVote(context: PolicyAuthorizedRepositoryExecutionContext, row: FamilyMeetingVoteRow): RepositoryResult<void>;
  insertDecision(context: PolicyAuthorizedRepositoryExecutionContext, row: FamilyMeetingDecisionRow): RepositoryResult<void>;
  upsertTask(context: PolicyAuthorizedRepositoryExecutionContext, row: FamilyMeetingTaskRow, expectedRevision: number): RepositoryResult<void>;
  insertCollaboration(context: PolicyAuthorizedRepositoryExecutionContext, row: FamilyMeetingCollaborationRow): RepositoryResult<void>;
  upsertMinutes(context: PolicyAuthorizedRepositoryExecutionContext, row: FamilyMeetingMinutesRow, expectedRevision: number): RepositoryResult<void>;
  appendEvent(context: PolicyAuthorizedRepositoryExecutionContext, row: FamilyMeetingEventRow): RepositoryResult<void>;
}

export interface FamilyMeetingPolicyResourceResolution {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly revision: number;
  readonly status: FamilyMeetingState;
  readonly stateFingerprint: string;
}

export interface FamilyMeetingPolicyResourceRepositoryPort {
  resolvePolicyResource(
    context: RepositoryExecutionContext,
    resourceType: 'family_meeting',
    resourceId: string
  ): RepositoryResult<FamilyMeetingPolicyResourceResolution | null>;
}

export const canonicalFamilyMeetingPreRead = (
  value: readonly FamilyMeetingPreReadReferenceView[]
): readonly FamilyMeetingPreReadReferenceView[] => Object.freeze([...value]
  .map((item) => Object.freeze({ resourceType: item.resourceType, resourceId: item.resourceId }))
  .sort((left, right) => `${left.resourceType}:${left.resourceId}`.localeCompare(`${right.resourceType}:${right.resourceId}`)));
