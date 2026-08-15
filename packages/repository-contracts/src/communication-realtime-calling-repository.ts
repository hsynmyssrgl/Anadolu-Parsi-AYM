import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type {
  CommunicationCallBackgroundEffect,
  CommunicationCallDeviceCheck,
  CommunicationCallMediaMode,
  CommunicationCallNetworkState,
  CommunicationCallParticipantRole,
  CommunicationCallParticipantState,
  CommunicationCallState,
  CommunicationCallTopology,
  CommunicationRealtimeCallingMutationKind,
  CommunicationRealtimeCallingResourceType
} from '@ppt/domain';
import type { CommunicationRoomMembershipRow, CommunicationRoomRow } from './communication-security-repository.js';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface CommunicationRealtimeCallingCenterKey {
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly actorPersonId: PersonId;
  readonly ownerPersonId: PersonId;
  readonly centerId: string;
}

export interface CommunicationCallSessionRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly roomId: string;
  readonly topology: CommunicationCallTopology;
  readonly requestedMediaMode: CommunicationCallMediaMode;
  readonly state: CommunicationCallState;
  readonly networkState: CommunicationCallNetworkState;
  readonly waitingRoomEnabled: boolean;
  readonly meetingLocked: boolean;
  readonly audioOnly: boolean;
  readonly automaticAudioFallbackEnabled: boolean;
  readonly backgroundEffect: CommunicationCallBackgroundEffect;
  readonly captionsRequested: boolean;
  readonly realtimeTextRequested: boolean;
  readonly screenShareRequested: boolean;
  readonly localHandRaised: boolean;
  readonly pinnedPersonId?: PersonId;
  readonly signLanguagePinnedPersonId?: PersonId;
  readonly reactionCode?: string;
  readonly microphoneCheck: CommunicationCallDeviceCheck;
  readonly cameraCheck: CommunicationCallDeviceCheck;
  readonly speakerCheck: CommunicationCallDeviceCheck;
  readonly noiseReductionRequested: boolean;
  readonly echoCancellationRequested: boolean;
  readonly automaticGainControlRequested: boolean;
  readonly preflightProviderId?: string;
  readonly preflightEvidenceSha256?: string;
  readonly preflightObservedAt?: IsoDateTime;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly endedAt?: IsoDateTime;
}

export interface CommunicationCallParticipantRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly sessionId: string;
  readonly personId: PersonId;
  readonly role: CommunicationCallParticipantRole;
  readonly state: CommunicationCallParticipantState;
  readonly handRaised: boolean;
  readonly pinnedLocally: boolean;
  readonly signLanguageSpeakerPinnedLocally: boolean;
  readonly reactionCode?: string;
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationCallPreferencesRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly simpleMode: boolean;
  readonly favoritePersonId?: PersonId;
  readonly largePersonCards: boolean;
  readonly captionScalePercent: number;
  readonly screenReaderAnnouncements: boolean;
  readonly keyboardShortcuts: boolean;
  readonly automaticAudioFallbackEnabled: boolean;
  readonly noiseReductionRequested: boolean;
  readonly echoCancellationRequested: boolean;
  readonly automaticGainControlRequested: boolean;
  readonly backgroundEffect: CommunicationCallBackgroundEffect;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationCallQualityObservationRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly sessionId: string;
  readonly roundTripMs: number;
  readonly packetLossPermille: number;
  readonly jitterMs: number;
  readonly uplinkKbps: number;
  readonly downlinkKbps: number;
  readonly providerId: string;
  readonly providerEvidenceSha256: string;
  readonly mutationId: string;
  readonly observedAt: IsoDateTime;
}

export interface CommunicationCallEventRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly sessionId: string;
  readonly eventKind: CommunicationRealtimeCallingMutationKind;
  readonly sessionRevision: number;
  readonly stateFingerprint: string;
  readonly mutationId: string;
  readonly occurredAt: IsoDateTime;
}

export interface CommunicationRealtimeCallingMutationRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly resourceType: CommunicationRealtimeCallingResourceType;
  readonly resourceId: string;
  readonly actorAccountId: string;
  readonly actorPersonId: PersonId;
  readonly mutationKind: CommunicationRealtimeCallingMutationKind;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly expectedRevision: number;
  readonly revision: number;
  readonly resourceStateFingerprint: string;
  readonly occurredAt: IsoDateTime;
}

export interface CommunicationRealtimeCallingSessionSnapshotRow {
  readonly session: CommunicationCallSessionRow;
  readonly participants: readonly CommunicationCallParticipantRow[];
}

export interface CommunicationRealtimeCallingCenterSnapshotRow {
  readonly sessions: readonly CommunicationRealtimeCallingSessionSnapshotRow[];
  readonly preferences: CommunicationCallPreferencesRow | null;
  readonly qualityObservations: readonly CommunicationCallQualityObservationRow[];
}

export interface CommunicationRealtimeCallingRoomGuardRow {
  readonly room: CommunicationRoomRow;
  readonly memberships: readonly CommunicationRoomMembershipRow[];
}

export interface CommunicationRealtimeCallingRepositoryPort {
  loadCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationRealtimeCallingCenterKey
  ): RepositoryResult<CommunicationRealtimeCallingCenterSnapshotRow>;
  findRoomGuard(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationRealtimeCallingCenterKey,
    roomId: string
  ): RepositoryResult<CommunicationRealtimeCallingRoomGuardRow | null>;
  findSession(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationRealtimeCallingCenterKey,
    sessionId: string
  ): RepositoryResult<CommunicationRealtimeCallingSessionSnapshotRow | null>;
  findPreferences(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationRealtimeCallingCenterKey
  ): RepositoryResult<CommunicationCallPreferencesRow | null>;
  findMutationByClientOperationId(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationRealtimeCallingCenterKey,
    clientOperationId: string
  ): RepositoryResult<CommunicationRealtimeCallingMutationRow | null>;
  insertMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationRealtimeCallingMutationRow
  ): RepositoryResult<void>;
  insertSession(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationCallSessionRow
  ): RepositoryResult<void>;
  saveSession(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationCallSessionRow,
    expectedRevision: number
  ): RepositoryResult<void>;
  insertParticipants(
    context: PolicyAuthorizedRepositoryExecutionContext,
    rows: readonly CommunicationCallParticipantRow[]
  ): RepositoryResult<void>;
  appendEvent(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationCallEventRow
  ): RepositoryResult<void>;
  savePreferences(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationCallPreferencesRow,
    expectedRevision: number
  ): RepositoryResult<void>;
  appendQualityObservation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationCallQualityObservationRow
  ): RepositoryResult<void>;
}

export interface CommunicationRealtimeCallingPolicyResourceResolution {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly revision: number;
  readonly status: string;
  readonly stateFingerprint: string;
}

export interface CommunicationRealtimeCallingPolicyResourceRepositoryPort {
  resolvePolicyResource(
    context: RepositoryExecutionContext,
    resourceType: CommunicationRealtimeCallingResourceType,
    resourceId: string
  ): RepositoryResult<CommunicationRealtimeCallingPolicyResourceResolution | null>;
}
