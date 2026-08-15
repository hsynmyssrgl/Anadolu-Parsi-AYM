import type { IsoDateTime } from '@ppt/core';

export type CommunicationRecordingRequestState =
  | 'consent_pending'
  | 'ready_not_recording'
  | 'paused_for_joiner'
  | 'off_record'
  | 'stopped'
  | 'cancelled'
  | 'deletion_requested';

export type CommunicationRecordingConsentState = 'pending' | 'granted' | 'declined' | 'withdrawn';
export type CommunicationRecordingAgeCategory = 'adult' | 'minor_or_unknown';
export type CommunicationRecordingSegmentMode = 'on_record_requested' | 'off_record';
export type CommunicationRecordingMediaKind = 'audio' | 'video' | 'transcript' | 'translation';

export interface CommunicationRecordingParticipantConsentView {
  readonly personId: string;
  readonly state: CommunicationRecordingConsentState;
  readonly noticeVersion: string;
  readonly explicitConsent: boolean;
  readonly ageCategory: CommunicationRecordingAgeCategory;
  readonly ageAppropriateNoticeAcknowledged: boolean;
  readonly guardianPolicyVerified: false;
  readonly revision: number;
  readonly updatedAt: IsoDateTime;
  readonly decidedAt?: IsoDateTime;
}

export interface CommunicationRecordingRetentionView {
  readonly audioDays: number;
  readonly videoDays: number;
  readonly transcriptDays: number;
  readonly translationDays: number;
  readonly persistTranscript: boolean;
  readonly persistTranslation: boolean;
  readonly secureDeletionRequested: boolean;
  readonly revision: number;
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationRecordingSegmentView {
  readonly mode: CommunicationRecordingSegmentMode;
  readonly captureStarted: false;
  readonly transcriptPersisted: false;
  readonly translationPersisted: false;
  readonly revision: number;
  readonly occurredAt: IsoDateTime;
}

export interface CommunicationRecordingRequestView {
  readonly id: string;
  readonly callSessionId: string;
  readonly state: CommunicationRecordingRequestState;
  readonly noticeVersion: string;
  readonly lateJoinerPauseRequired: true;
  readonly anyDeclineKeepsCallOffRecord: true;
  readonly visibleRecordingIndicatorActive: false;
  readonly audibleRecordingAnnouncementExecuted: false;
  readonly recordingRoleBoundToE2eeGroup: false;
  readonly mediaCaptureStarted: false;
  readonly participants: readonly CommunicationRecordingParticipantConsentView[];
  readonly retention: CommunicationRecordingRetentionView;
  readonly segments: readonly CommunicationRecordingSegmentView[];
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationRecordingTruthView {
  readonly recordingDefaultOff: true;
  readonly separateExplicitParticipantConsentModeled: true;
  readonly lateJoinerPauseModeled: true;
  readonly declineContinuesCallOffRecordModeled: true;
  readonly futureRecordingWithdrawalModeled: true;
  readonly onRecordOffRecordSegmentsModeled: true;
  readonly perMediaRetentionModeled: true;
  readonly contentFreeConsentAuditModeled: true;
  readonly rendererMediaAuthority: false;
  readonly productionRecordingProviderConfigured: false;
  readonly actualAudioCaptureExecuted: false;
  readonly actualVideoCaptureExecuted: false;
  readonly actualTranscriptPersistenceExecuted: false;
  readonly actualTranslationPersistenceExecuted: false;
  readonly visibleRedIndicatorUatExecuted: false;
  readonly audibleAnnouncementUatExecuted: false;
  readonly e2eeRecorderRoleVerified: false;
  readonly encryptedMediaVaultConfigured: false;
  readonly mediaHashSignatureVerified: false;
  readonly securePhysicalDeletionVerified: false;
  readonly guardianLegalPolicyConfigured: false;
  readonly childRecordingLegalReviewCompleted: false;
  readonly networkUsedByCurrentImplementation: false;
}

export interface CommunicationRecordingCenterView {
  readonly schemaVersion: 1;
  readonly centerId: string;
  readonly ownerPersonId: string;
  readonly requests: readonly CommunicationRecordingRequestView[];
  readonly truth: CommunicationRecordingTruthView;
  readonly generatedAt: IsoDateTime;
}

export interface CreateCommunicationRecordingRequestInput {
  readonly clientOperationId: string;
  readonly expectedRevision: 0;
  readonly callSessionId: string;
  readonly participantPersonIds: readonly string[];
  readonly noticeVersion: string;
  readonly audioDays: number;
  readonly videoDays: number;
  readonly transcriptDays: number;
  readonly translationDays: number;
  readonly persistTranscript: boolean;
  readonly persistTranslation: boolean;
}

export interface DecideCommunicationRecordingConsentInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly requestId: string;
  readonly decision: 'grant' | 'decline';
  readonly explicitConsent: true;
  readonly noticeVersion: string;
  readonly ageCategory: CommunicationRecordingAgeCategory;
  readonly ageAppropriateNoticeAcknowledged: true;
}

export interface WithdrawCommunicationRecordingConsentInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly requestId: string;
  readonly reason: string;
}

export interface AddCommunicationRecordingLateJoinerInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly requestId: string;
  readonly participantPersonId: string;
}

export interface SetCommunicationRecordingSegmentInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly requestId: string;
  readonly mode: CommunicationRecordingSegmentMode;
  readonly reason: string;
}

export interface UpdateCommunicationRecordingRetentionInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly requestId: string;
  readonly audioDays: number;
  readonly videoDays: number;
  readonly transcriptDays: number;
  readonly translationDays: number;
  readonly persistTranscript: boolean;
  readonly persistTranslation: boolean;
  readonly secureDeletionRequested: boolean;
}

export interface RequestCommunicationRecordingDeletionInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly requestId: string;
  readonly reason: string;
}

export type CommunicationRecordingMutationKind =
  | 'recording_request_create'
  | 'participant_consent_decide'
  | 'participant_consent_withdraw'
  | 'late_joiner_add'
  | 'recording_segment_change'
  | 'recording_retention_update'
  | 'recording_delete_request';

export type CommunicationRecordingResourceType = 'communication_recording_request';

export interface CommunicationRecordingMutationReceiptView {
  readonly resourceType: CommunicationRecordingResourceType;
  readonly resourceId: string;
  readonly mutationKind: CommunicationRecordingMutationKind;
  readonly previousRevision: number;
  readonly revision: number;
  readonly occurredAt: IsoDateTime;
  readonly replayed: boolean;
  readonly mediaCaptureStarted: false;
  readonly mediaArtifactCreated: false;
  readonly networkUsed: false;
}

export const communicationRecordingCenterId = (familyId: string, ownerPersonId: string): string =>
  `communication-recording:${familyId}:${ownerPersonId}`;

export const communicationRecordingTruth = Object.freeze({
  recordingDefaultOff: true as const,
  separateExplicitParticipantConsentModeled: true as const,
  lateJoinerPauseModeled: true as const,
  declineContinuesCallOffRecordModeled: true as const,
  futureRecordingWithdrawalModeled: true as const,
  onRecordOffRecordSegmentsModeled: true as const,
  perMediaRetentionModeled: true as const,
  contentFreeConsentAuditModeled: true as const,
  rendererMediaAuthority: false as const,
  productionRecordingProviderConfigured: false as const,
  actualAudioCaptureExecuted: false as const,
  actualVideoCaptureExecuted: false as const,
  actualTranscriptPersistenceExecuted: false as const,
  actualTranslationPersistenceExecuted: false as const,
  visibleRedIndicatorUatExecuted: false as const,
  audibleAnnouncementUatExecuted: false as const,
  e2eeRecorderRoleVerified: false as const,
  encryptedMediaVaultConfigured: false as const,
  mediaHashSignatureVerified: false as const,
  securePhysicalDeletionVerified: false as const,
  guardianLegalPolicyConfigured: false as const,
  childRecordingLegalReviewCompleted: false as const,
  networkUsedByCurrentImplementation: false as const
});
