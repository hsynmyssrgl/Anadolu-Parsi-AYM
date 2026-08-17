import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type {
  CommunicationRecordingAgeCategory,
  CommunicationRecordingConsentState,
  CommunicationRecordingMutationKind,
  CommunicationRecordingRequestState,
  CommunicationRecordingResourceType,
  CommunicationRecordingSegmentMode
} from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface CommunicationRecordingCenterKey {
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly actorPersonId: PersonId;
  readonly ownerPersonId: PersonId;
  readonly centerId: string;
}

export interface CommunicationRecordingRequestRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly callSessionId: string;
  readonly state: CommunicationRecordingRequestState;
  readonly noticeVersion: string;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationRecordingConsentRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly requestId: string;
  readonly participantPersonId: PersonId;
  readonly state: CommunicationRecordingConsentState;
  readonly noticeVersion: string;
  readonly explicitConsent: boolean;
  readonly ageCategory: CommunicationRecordingAgeCategory;
  readonly ageAppropriateNoticeAcknowledged: boolean;
  readonly guardianPolicyVerified: false;
  readonly revision: number;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly decidedAt?: IsoDateTime;
}

export interface CommunicationRecordingRetentionRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly requestId: string;
  readonly audioDays: number;
  readonly videoDays: number;
  readonly transcriptDays: number;
  readonly translationDays: number;
  readonly persistTranscript: boolean;
  readonly persistTranslation: boolean;
  readonly secureDeletionRequested: boolean;
  readonly revision: number;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationRecordingSegmentRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly requestId: string;
  readonly mode: CommunicationRecordingSegmentMode;
  readonly captureStarted: false;
  readonly transcriptPersisted: false;
  readonly translationPersisted: false;
  readonly requestRevision: number;
  readonly mutationId: string;
  readonly occurredAt: IsoDateTime;
}

export interface CommunicationRecordingMutationRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly resourceType: CommunicationRecordingResourceType;
  readonly resourceId: string;
  readonly actorAccountId: string;
  readonly actorPersonId: PersonId;
  readonly mutationKind: CommunicationRecordingMutationKind;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly expectedRevision: number;
  readonly revision: number;
  readonly resourceStateFingerprint: string;
  readonly occurredAt: IsoDateTime;
}

export interface CommunicationRecordingEventRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly requestId: string;
  readonly eventKind: CommunicationRecordingMutationKind;
  readonly requestRevision: number;
  readonly stateFingerprint: string;
  readonly mutationId: string;
  readonly occurredAt: IsoDateTime;
}

export interface CommunicationRecordingRequestSnapshotRow {
  readonly request: CommunicationRecordingRequestRow;
  readonly consents: readonly CommunicationRecordingConsentRow[];
  readonly retention: CommunicationRecordingRetentionRow;
  readonly segments: readonly CommunicationRecordingSegmentRow[];
}

export interface CommunicationRecordingCenterSnapshotRow {
  readonly requests: readonly CommunicationRecordingRequestSnapshotRow[];
}

export interface CommunicationRecordingCallGuardRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly state: string;
  readonly participantPersonIds: readonly PersonId[];
}

export interface CommunicationRecordingRepositoryPort {
  loadCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationRecordingCenterKey
  ): RepositoryResult<CommunicationRecordingCenterSnapshotRow>;
  findRequest(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationRecordingCenterKey,
    requestId: string
  ): RepositoryResult<CommunicationRecordingRequestSnapshotRow | null>;
  findCallGuard(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationRecordingCenterKey,
    callSessionId: string
  ): RepositoryResult<CommunicationRecordingCallGuardRow | null>;
  isEligibleLateJoiner(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationRecordingCenterKey,
    callSessionId: string,
    participantPersonId: PersonId
  ): RepositoryResult<boolean>;
  findMutationByClientOperationId(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationRecordingCenterKey,
    clientOperationId: string
  ): RepositoryResult<CommunicationRecordingMutationRow | null>;
  insertMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationRecordingMutationRow
  ): RepositoryResult<void>;
  insertRequest(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationRecordingRequestRow
  ): RepositoryResult<void>;
  saveRequest(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationRecordingRequestRow,
    expectedRevision: number
  ): RepositoryResult<void>;
  insertConsents(
    context: PolicyAuthorizedRepositoryExecutionContext,
    rows: readonly CommunicationRecordingConsentRow[]
  ): RepositoryResult<void>;
  insertLateJoinerConsent(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationRecordingConsentRow
  ): RepositoryResult<void>;
  saveConsent(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationRecordingConsentRow,
    expectedRevision: number
  ): RepositoryResult<void>;
  saveRetention(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationRecordingRetentionRow,
    expectedRevision: number
  ): RepositoryResult<void>;
  appendSegment(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationRecordingSegmentRow
  ): RepositoryResult<void>;
  appendEvent(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationRecordingEventRow
  ): RepositoryResult<void>;
}

export interface CommunicationRecordingPolicyResourceResolution {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly revision: number;
  readonly status: string;
  readonly stateFingerprint: string;
}

export interface CommunicationRecordingPolicyResourceRepositoryPort {
  resolvePolicyResource(
    context: RepositoryExecutionContext,
    resourceType: CommunicationRecordingResourceType,
    resourceId: string
  ): RepositoryResult<CommunicationRecordingPolicyResourceResolution | null>;
}
