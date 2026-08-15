import type { IsoDateTime } from '@ppt/core';

export const COMMUNICATION_CALL_TOPOLOGIES = Object.freeze(['direct_p2p', 'family_group_sfu'] as const);
export type CommunicationCallTopology = (typeof COMMUNICATION_CALL_TOPOLOGIES)[number];

export const COMMUNICATION_CALL_MEDIA_MODES = Object.freeze(['audio', 'video'] as const);
export type CommunicationCallMediaMode = (typeof COMMUNICATION_CALL_MEDIA_MODES)[number];

export type CommunicationCallState = 'planned' | 'preflight_ready' | 'waiting_local' | 'ended' | 'cancelled';
export type CommunicationCallParticipantRole = 'host' | 'participant';
export type CommunicationCallParticipantState = 'invited' | 'local_ready' | 'left';
export type CommunicationCallBackgroundEffect = 'off' | 'blur' | 'virtual_background';
export type CommunicationCallDeviceCheck = 'not_run' | 'passed' | 'failed' | 'not_available';
export type CommunicationCallNetworkState = 'not_started' | 'local_waiting_only' | 'ended';

export interface CommunicationCallParticipantView {
  readonly personId: string;
  readonly role: CommunicationCallParticipantRole;
  readonly state: CommunicationCallParticipantState;
  readonly handRaised: boolean;
  readonly pinnedLocally: boolean;
  readonly signLanguageSpeakerPinnedLocally: boolean;
  readonly reactionCode?: string;
  readonly revision: number;
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationCallPreflightView {
  readonly microphone: CommunicationCallDeviceCheck;
  readonly camera: CommunicationCallDeviceCheck;
  readonly speaker: CommunicationCallDeviceCheck;
  readonly noiseReductionRequested: boolean;
  readonly echoCancellationRequested: boolean;
  readonly automaticGainControlRequested: boolean;
  readonly providerVerified: boolean;
  readonly networkUsed: false;
  readonly observedAt?: IsoDateTime;
}

export interface CommunicationCallSessionView {
  readonly id: string;
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
  readonly pinnedPersonId?: string;
  readonly signLanguagePinnedPersonId?: string;
  readonly preflight: CommunicationCallPreflightView;
  readonly participants: readonly CommunicationCallParticipantView[];
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly endedAt?: IsoDateTime;
}

export interface CommunicationCallPreferencesView {
  readonly simpleMode: boolean;
  readonly favoritePersonId?: string;
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
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationCallQualityObservationView {
  readonly sessionId: string;
  readonly roundTripMs: number;
  readonly packetLossPermille: number;
  readonly jitterMs: number;
  readonly uplinkKbps: number;
  readonly downlinkKbps: number;
  readonly providerVerified: true;
  readonly observedAt: IsoDateTime;
}

export interface CommunicationRealtimeCallingTruthView {
  readonly localCallPlanningMetadataImplemented: true;
  readonly appendOnlyLifecycleLedgerImplemented: true;
  readonly optimisticRevisionRequired: true;
  readonly accessibleCallPreferenceModelImplemented: true;
  readonly localPreflightEvidenceContractImplemented: true;
  readonly rendererMediaDeviceAuthority: false;
  readonly rendererNetworkAuthority: false;
  readonly productionMediaProviderConfigured: false;
  readonly webRtcPeerConnectionExecuted: false;
  readonly sfuServiceConfigured: false;
  readonly stunTurnServiceConfigured: false;
  readonly shortLivedRelayCredentialsIssued: false;
  readonly sframeMediaEncryptionExecuted: false;
  readonly mlsMediaKeyBindingVerified: false;
  readonly screenOrWindowCaptureImplemented: false;
  readonly localBackgroundProcessingImplemented: false;
  readonly liveCaptionProviderConfigured: false;
  readonly realtimeTextTransportImplemented: false;
  readonly callKitPushKitIntegrated: false;
  readonly windowsCallNotificationIntegrated: false;
  readonly doNotDisturbIntegrationImplemented: false;
  readonly realDevicePreflightExecuted: false;
  readonly realOneToOneCallPerformed: false;
  readonly realGroupCallPerformed: false;
  readonly networkUsedByCurrentImplementation: false;
}

export interface CommunicationRealtimeCallingCenterView {
  readonly schemaVersion: 1;
  readonly centerId: string;
  readonly ownerPersonId: string;
  readonly sessions: readonly CommunicationCallSessionView[];
  readonly preferences: CommunicationCallPreferencesView;
  readonly qualityObservations: readonly CommunicationCallQualityObservationView[];
  readonly truth: CommunicationRealtimeCallingTruthView;
  readonly generatedAt: IsoDateTime;
}

/** Main-process only evidence from a trusted local media-device adapter. */
export interface VerifiedCommunicationCallPreflightInput {
  readonly sessionId: string;
  readonly microphone: Exclude<CommunicationCallDeviceCheck, 'not_run'>;
  readonly camera: Exclude<CommunicationCallDeviceCheck, 'not_run'>;
  readonly speaker: Exclude<CommunicationCallDeviceCheck, 'not_run'>;
  readonly providerId: string;
  readonly providerEvidenceSha256: string;
  readonly providerVerified: true;
  readonly networkUsed: false;
  readonly observedAt: string;
}

/** Main-process only, content-free network quality evidence from a future trusted media provider. */
export interface VerifiedCommunicationCallQualityInput {
  readonly sessionId: string;
  readonly roundTripMs: number;
  readonly packetLossPermille: number;
  readonly jitterMs: number;
  readonly uplinkKbps: number;
  readonly downlinkKbps: number;
  readonly providerId: string;
  readonly providerEvidenceSha256: string;
  readonly providerVerified: true;
  readonly observedAt: string;
}

export interface CreateCommunicationCallInput {
  readonly clientOperationId: string;
  readonly expectedRevision: 0;
  readonly roomId: string;
  readonly topology: CommunicationCallTopology;
  readonly requestedMediaMode: CommunicationCallMediaMode;
  readonly invitedPersonIds: readonly string[];
  readonly waitingRoomEnabled: boolean;
  readonly automaticAudioFallbackEnabled: boolean;
}

export interface RunCommunicationCallPreflightInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly sessionId: string;
}

export interface UpdateCommunicationCallControlsInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly sessionId: string;
  readonly audioOnly?: boolean;
  readonly meetingLocked?: boolean;
  readonly backgroundEffect?: CommunicationCallBackgroundEffect;
  readonly captionsRequested?: boolean;
  readonly realtimeTextRequested?: boolean;
  readonly screenShareRequested?: boolean;
  readonly localHandRaised?: boolean;
  readonly pinnedPersonId?: string;
  readonly signLanguagePinnedPersonId?: string;
  readonly reactionCode?: string;
}

export interface AdvanceCommunicationCallInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly sessionId: string;
  readonly action: 'enter_local_waiting_room' | 'end' | 'cancel';
  readonly reason: string;
}

export interface SetCommunicationCallPreferencesInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly simpleMode: boolean;
  readonly favoritePersonId?: string;
  readonly largePersonCards: boolean;
  readonly captionScalePercent: number;
  readonly screenReaderAnnouncements: boolean;
  readonly keyboardShortcuts: boolean;
  readonly automaticAudioFallbackEnabled: boolean;
  readonly noiseReductionRequested: boolean;
  readonly echoCancellationRequested: boolean;
  readonly automaticGainControlRequested: boolean;
  readonly backgroundEffect: CommunicationCallBackgroundEffect;
}

/** Main-process only command; verifiedObservation must never originate from renderer IPC. */
export interface RecordCommunicationCallQualityInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly sessionId: string;
  readonly verifiedObservation: VerifiedCommunicationCallQualityInput;
}

export type CommunicationRealtimeCallingMutationKind =
  | 'call_create'
  | 'call_preflight_update'
  | 'call_controls_update'
  | 'call_lifecycle_update'
  | 'call_preferences_update'
  | 'call_quality_observation';

export type CommunicationRealtimeCallingResourceType = 'communication_call_session' | 'communication_call_preferences';

export interface CommunicationRealtimeCallingMutationReceiptView {
  readonly resourceType: CommunicationRealtimeCallingResourceType;
  readonly resourceId: string;
  readonly mutationKind: CommunicationRealtimeCallingMutationKind;
  readonly previousRevision: number;
  readonly revision: number;
  readonly occurredAt: IsoDateTime;
  readonly replayed: boolean;
  readonly mediaTransportStarted: false;
  readonly networkUsed: false;
}

export const communicationRealtimeCallingCenterId = (familyId: string, ownerPersonId: string): string =>
  `communication-calling:${familyId}:${ownerPersonId}`;

export const communicationCallPreferencesId = (ownerPersonId: string): string => `communication-call-preferences:${ownerPersonId}`;

export const communicationRealtimeCallingTruth = Object.freeze({
  localCallPlanningMetadataImplemented: true as const,
  appendOnlyLifecycleLedgerImplemented: true as const,
  optimisticRevisionRequired: true as const,
  accessibleCallPreferenceModelImplemented: true as const,
  localPreflightEvidenceContractImplemented: true as const,
  rendererMediaDeviceAuthority: false as const,
  rendererNetworkAuthority: false as const,
  productionMediaProviderConfigured: false as const,
  webRtcPeerConnectionExecuted: false as const,
  sfuServiceConfigured: false as const,
  stunTurnServiceConfigured: false as const,
  shortLivedRelayCredentialsIssued: false as const,
  sframeMediaEncryptionExecuted: false as const,
  mlsMediaKeyBindingVerified: false as const,
  screenOrWindowCaptureImplemented: false as const,
  localBackgroundProcessingImplemented: false as const,
  liveCaptionProviderConfigured: false as const,
  realtimeTextTransportImplemented: false as const,
  callKitPushKitIntegrated: false as const,
  windowsCallNotificationIntegrated: false as const,
  doNotDisturbIntegrationImplemented: false as const,
  realDevicePreflightExecuted: false as const,
  realOneToOneCallPerformed: false as const,
  realGroupCallPerformed: false as const,
  networkUsedByCurrentImplementation: false as const
});
