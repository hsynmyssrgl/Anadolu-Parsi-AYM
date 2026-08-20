import type { IsoDateTime } from '@ppt/core';

export const COMMUNICATION_MESSAGE_CONTENT_KINDS = Object.freeze([
  'text',
  'voice',
  'photo',
  'video',
  'location',
  'document'
] as const);
export type CommunicationMessageContentKind = (typeof COMMUNICATION_MESSAGE_CONTENT_KINDS)[number];

export type CommunicationMessageState = 'draft' | 'queued' | 'scheduled' | 'sealed_local' | 'deleted';
export type CommunicationMessageDeliveryState =
  | 'not_requested'
  | 'queued_offline'
  | 'retry_wait'
  | 'ready_local'
  | 'transport_not_configured'
  | 'cancelled';
export type CommunicationMessageRetentionMode = 'permanent' | 'duration' | 'auto_delete' | 'legal_hold';
export type CommunicationPresenceStatus =
  | 'online'
  | 'away'
  | 'busy'
  | 'in_meeting'
  | 'do_not_disturb'
  | 'invisible'
  | 'offline';
export type CommunicationPresenceAudience = 'nobody' | 'room_members' | 'selected_people';
export type CommunicationPublicAvailability = 'available' | 'unavailable' | 'hidden';

export type CommunicationMessageEventKind =
  | 'message_created'
  | 'message_edited'
  | 'message_deleted'
  | 'message_restored'
  | 'reaction_changed'
  | 'pin_changed'
  | 'bookmark_changed'
  | 'delivery_changed';

export interface CommunicationMessageView {
  readonly id: string;
  readonly roomId: string;
  readonly senderPersonId: string;
  readonly contentKind: CommunicationMessageContentKind;
  readonly contentMime: string;
  readonly payloadSizeBytes: number;
  readonly state: CommunicationMessageState;
  readonly deliveryState: CommunicationMessageDeliveryState;
  readonly replyToMessageId?: string;
  readonly quotedMessageId?: string;
  readonly threadRootMessageId?: string;
  readonly scheduledAt?: IsoDateTime;
  readonly silent: boolean;
  readonly pinned: boolean;
  readonly bookmarked: boolean;
  readonly reactionCode?: string;
  readonly edited: boolean;
  readonly deleted: boolean;
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly expiresAt?: IsoDateTime;
  readonly sealedPayloadStoredOutsideDatabase: true;
  readonly plaintextPersistedInDatabase: false;
}

export interface CommunicationMessageContentView {
  readonly messageId: string;
  readonly revision: number;
  readonly contentKind: CommunicationMessageContentKind;
  readonly contentMime: string;
  readonly text?: string;
  readonly opaqueAttachmentHandle?: string;
  readonly payloadSource: 'local_sealed_store';
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export interface CommunicationPresenceView {
  readonly personId: string;
  readonly status: CommunicationPresenceStatus;
  readonly publicAvailability: CommunicationPublicAvailability;
  readonly audience: CommunicationPresenceAudience;
  readonly lastSeenShared: boolean;
  readonly typingIndicatorsEnabled: boolean;
  readonly readReceiptsEnabled: boolean;
  readonly activeDeviceDisclosed: false;
  readonly preciseActivityDisclosed: false;
  readonly emergencyReachabilityEnabled: boolean;
  readonly expiresAt?: IsoDateTime;
  readonly revision: number;
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationRetentionPolicyView {
  readonly roomId: string;
  readonly mode: CommunicationMessageRetentionMode;
  readonly durationDays?: number;
  readonly legalHoldReasonRecorded: boolean;
  readonly automaticDeletionScheduled: boolean;
  readonly physicalSecureEraseGuaranteed: false;
  readonly backupPropagationGuaranteed: false;
  readonly revision: number;
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationMessagingTruthView {
  readonly appendOnlyMessageEventLedgerImplemented: true;
  readonly sealedPayloadReferenceOnlyInDatabase: true;
  readonly offlineOutboxMetadataImplemented: true;
  readonly localRetryStateMachineImplemented: true;
  readonly replyQuoteThreadReactionPinBookmarkMetadataImplemented: true;
  readonly editDeleteRestoreHistoryImplemented: true;
  readonly scheduledAndSilentMetadataImplemented: true;
  readonly privacyPreservingPresenceImplemented: true;
  readonly defaultPresenceIsAvailabilityOnly: true;
  readonly activeDeviceDisclosureDefaultDenied: true;
  readonly exactActivityDisclosureDefaultDenied: true;
  readonly contentSearchImplemented: true;
  readonly rendererMediaAttachmentSelectionImplemented: true;
  readonly effectivePresenceExpiryEnforced: true;
  readonly automaticRetentionExecutionImplemented: true;
  readonly payloadOrphanSweepImplemented: true;
  readonly reminderExecutionImplemented: true;
  readonly multiDevicePresenceAggregationImplemented: false;
  readonly selectedPeopleAudienceEnforcementImplemented: false;
  readonly relayDeliveryImplemented: false;
  readonly deliveryReceiptFromRemoteImplemented: false;
  readonly messageSignatureVerificationImplemented: false;
  readonly automaticPhysicalSecureEraseGuaranteed: false;
  readonly backupDeletionPropagationGuaranteed: false;
  readonly calendarPresenceSyncImplemented: false;
  readonly productionMlsPayloadProviderConfigured: false;
  readonly realMessageExchangePerformed: false;
  readonly networkUsedByCurrentImplementation: false;
}

export interface CommunicationMessagingCenterView {
  readonly schemaVersion: 1;
  readonly centerId: string;
  readonly ownerPersonId: string;
  readonly messages: readonly CommunicationMessageView[];
  readonly presence: CommunicationPresenceView;
  readonly retentionPolicies: readonly CommunicationRetentionPolicyView[];
  readonly truth: CommunicationMessagingTruthView;
  readonly generatedAt: IsoDateTime;
}

/** Main-process only. The payload has already been sealed and read back by a trusted local provider. */
export interface VerifiedSealedCommunicationPayloadInput {
  readonly sealedPayloadReference: string;
  readonly payloadSha256: string;
  readonly payloadSizeBytes: number;
  readonly contentKind: CommunicationMessageContentKind;
  readonly contentMime: string;
  readonly providerId: string;
  readonly providerEvidenceSha256: string;
  readonly verified: true;
  readonly createdAt: string;
}

export interface CreateCommunicationMessageInput {
  readonly clientOperationId: string;
  readonly expectedRevision: 0;
  readonly roomId: string;
  readonly contentKind: CommunicationMessageContentKind;
  readonly contentMime: string;
  readonly text?: string;
  readonly opaqueAttachmentHandle?: string;
  readonly replyToMessageId?: string;
  readonly quotedMessageId?: string;
  readonly threadRootMessageId?: string;
  readonly scheduledAt?: string;
  readonly silent?: boolean;
}

export interface EditCommunicationMessageInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly messageId: string;
  readonly text: string;
  readonly reason: string;
}

export interface SetCommunicationMessageLifecycleInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly messageId: string;
  readonly action: 'delete' | 'restore';
  readonly reason: string;
}

export interface AnnotateCommunicationMessageInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly messageId: string;
  readonly reactionCode?: string;
  readonly pinned?: boolean;
  readonly bookmarked?: boolean;
}

export interface UpdateCommunicationDeliveryInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly messageId: string;
  readonly action: 'queue_offline' | 'retry' | 'mark_ready_local' | 'cancel';
}

export interface SetCommunicationRetentionPolicyInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly roomId: string;
  readonly mode: CommunicationMessageRetentionMode;
  readonly durationDays?: number;
  readonly reason: string;
}

export interface SetCommunicationPresenceInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly status: CommunicationPresenceStatus;
  readonly audience: CommunicationPresenceAudience;
  readonly lastSeenShared: boolean;
  readonly typingIndicatorsEnabled: boolean;
  readonly readReceiptsEnabled: boolean;
  readonly emergencyReachabilityEnabled: boolean;
  readonly expiresAt?: string;
}

export interface SearchCommunicationMessagesInput {
  /** Main-process local sealed-content query. Plaintext is never returned by this search operation. */
  readonly queryText?: string;
  readonly roomId?: string;
  readonly senderPersonId?: string;
  readonly contentKind?: CommunicationMessageContentKind;
  readonly from?: string;
  readonly to?: string;
  readonly includeDeleted?: boolean;
  readonly limit?: number;
}

export interface CommunicationMessagingMaintenanceView {
  readonly scheduledMessagesReleased: number;
  readonly expiredMessagesDeleted: number;
  readonly expiredPresenceProfilesHidden: number;
  readonly scannedPayloadFiles: number;
  readonly deletedOrphanPayloadFiles: number;
  readonly rejectedPayloadFiles: number;
  readonly failedOperations: number;
  readonly completedAt: IsoDateTime;
  readonly physicalSecureEraseGuaranteed: false;
  readonly backupPropagationGuaranteed: false;
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export const COMMUNICATION_MESSAGE_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1_000;

export type CommunicationMessagingMutationKind =
  | 'message_create'
  | 'message_edit'
  | 'message_delete'
  | 'message_restore'
  | 'message_annotate'
  | 'delivery_update'
  | 'retention_update'
  | 'presence_update';

export type CommunicationMessagingResourceType =
  | 'communication_message'
  | 'communication_presence'
  | 'communication_retention_policy';

export interface CommunicationMessagingMutationReceiptView {
  readonly resourceType: CommunicationMessagingResourceType;
  readonly resourceId: string;
  readonly mutationKind: CommunicationMessagingMutationKind;
  readonly previousRevision: number;
  readonly revision: number;
  readonly occurredAt: IsoDateTime;
  readonly replayed: boolean;
  readonly payloadSealedLocally: boolean;
  readonly remoteDeliveryPerformed: false;
  readonly networkUsed: false;
}

export const communicationMessagingCenterId = (familyId: string, ownerPersonId: string): string =>
  `communication-messaging:${familyId}:${ownerPersonId}`;

export const communicationMessagingTruth = Object.freeze({
  appendOnlyMessageEventLedgerImplemented: true as const,
  sealedPayloadReferenceOnlyInDatabase: true as const,
  offlineOutboxMetadataImplemented: true as const,
  localRetryStateMachineImplemented: true as const,
  replyQuoteThreadReactionPinBookmarkMetadataImplemented: true as const,
  editDeleteRestoreHistoryImplemented: true as const,
  scheduledAndSilentMetadataImplemented: true as const,
  privacyPreservingPresenceImplemented: true as const,
  defaultPresenceIsAvailabilityOnly: true as const,
  activeDeviceDisclosureDefaultDenied: true as const,
  exactActivityDisclosureDefaultDenied: true as const,
  contentSearchImplemented: true as const,
  rendererMediaAttachmentSelectionImplemented: true as const,
  effectivePresenceExpiryEnforced: true as const,
  automaticRetentionExecutionImplemented: true as const,
  payloadOrphanSweepImplemented: true as const,
  reminderExecutionImplemented: true as const,
  multiDevicePresenceAggregationImplemented: false as const,
  selectedPeopleAudienceEnforcementImplemented: false as const,
  relayDeliveryImplemented: false as const,
  deliveryReceiptFromRemoteImplemented: false as const,
  messageSignatureVerificationImplemented: false as const,
  automaticPhysicalSecureEraseGuaranteed: false as const,
  backupDeletionPropagationGuaranteed: false as const,
  calendarPresenceSyncImplemented: false as const,
  productionMlsPayloadProviderConfigured: false as const,
  realMessageExchangePerformed: false as const,
  networkUsedByCurrentImplementation: false as const
});
