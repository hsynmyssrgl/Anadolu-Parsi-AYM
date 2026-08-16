import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type {
  CommunicationMessageContentKind,
  CommunicationMessageDeliveryState,
  CommunicationMessageEventKind,
  CommunicationMessageRetentionMode,
  CommunicationMessageState,
  CommunicationMessagingMutationKind,
  CommunicationMessagingResourceType,
  CommunicationPresenceAudience,
  CommunicationPresenceStatus,
  CommunicationPublicAvailability,
  SearchCommunicationMessagesInput
} from '@ppt/domain';
import type {
  CommunicationRoomMembershipRow,
  CommunicationRoomRow
} from './communication-security-repository.js';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface CommunicationMessagingCenterKey {
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly actorPersonId: PersonId;
  readonly ownerPersonId: PersonId;
  readonly centerId: string;
}

export interface CommunicationMessageRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly roomId: string;
  readonly senderAccountId: string;
  readonly senderPersonId: PersonId;
  readonly contentKind: CommunicationMessageContentKind;
  readonly contentMime: string;
  readonly sealedPayloadReference: string;
  readonly payloadSha256: string;
  readonly payloadSizeBytes: number;
  readonly providerId: string;
  readonly providerEvidenceSha256: string;
  readonly payloadRevision: number;
  readonly payloadCreatedAt: IsoDateTime;
  readonly replyToMessageId?: string;
  readonly quotedMessageId?: string;
  readonly threadRootMessageId?: string;
  readonly state: CommunicationMessageState;
  readonly deliveryState: CommunicationMessageDeliveryState;
  readonly scheduledAt?: IsoDateTime;
  readonly silent: boolean;
  readonly pinned: boolean;
  readonly bookmarked: boolean;
  readonly reactionCode?: string;
  readonly editCount: number;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt?: IsoDateTime;
  readonly expiresAt?: IsoDateTime;
}

export interface CommunicationPresenceRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly personId: PersonId;
  readonly status: CommunicationPresenceStatus;
  readonly publicAvailability: CommunicationPublicAvailability;
  readonly audience: CommunicationPresenceAudience;
  readonly lastSeenShared: boolean;
  readonly typingIndicatorsEnabled: boolean;
  readonly readReceiptsEnabled: boolean;
  readonly emergencyReachabilityEnabled: boolean;
  readonly expiresAt?: IsoDateTime;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationRetentionPolicyRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly roomId: string;
  readonly mode: CommunicationMessageRetentionMode;
  readonly durationDays?: number;
  readonly legalHoldReasonSha256?: string;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationMessageEventRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly messageId: string;
  readonly roomId: string;
  readonly actorAccountId: string;
  readonly actorPersonId: PersonId;
  readonly eventKind: CommunicationMessageEventKind;
  readonly messageRevision: number;
  readonly stateFingerprint: string;
  readonly mutationId: string;
  readonly occurredAt: IsoDateTime;
}

export interface CommunicationDeliveryQueueRow {
  readonly messageId: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly state: CommunicationMessageDeliveryState;
  readonly attemptCount: number;
  readonly nextAttemptAt?: IsoDateTime;
  readonly revision: number;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationMessagingMutationRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly resourceType: CommunicationMessagingResourceType;
  readonly resourceId: string;
  readonly actorAccountId: string;
  readonly actorPersonId: PersonId;
  readonly mutationKind: CommunicationMessagingMutationKind;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly expectedRevision: number;
  readonly revision: number;
  readonly resourceStateFingerprint: string;
  readonly occurredAt: IsoDateTime;
}

export interface CommunicationMessagingCenterSnapshotRow {
  readonly messages: readonly CommunicationMessageRow[];
  readonly presence: CommunicationPresenceRow | null;
  readonly retentionPolicies: readonly CommunicationRetentionPolicyRow[];
}

export interface CommunicationMessagingRoomGuardRow {
  readonly room: CommunicationRoomRow;
  readonly memberships: readonly CommunicationRoomMembershipRow[];
}

export interface CommunicationMessagingAttachmentGuardRow {
  readonly id: string;
  readonly ownerPersonId: PersonId;
  readonly roomId: string;
  readonly mimeType: string;
  readonly totalBytes: number;
  readonly state: 'prepared_local' | 'transferring_local' | 'paused' | 'scan_required' | 'ready_local' | 'quarantined' | 'revoked';
  readonly scanState: 'not_run' | 'clean' | 'malicious' | 'provider_unavailable';
}

export interface CommunicationMessagingRepositoryPort {
  loadCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationMessagingCenterKey
  ): RepositoryResult<CommunicationMessagingCenterSnapshotRow>;
  searchMessages(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationMessagingCenterKey,
    input: SearchCommunicationMessagesInput
  ): RepositoryResult<readonly CommunicationMessageRow[]>;
  findRoomGuard(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationMessagingCenterKey,
    roomId: string
  ): RepositoryResult<CommunicationMessagingRoomGuardRow | null>;
  findAttachmentGuard(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationMessagingCenterKey,
    fileId: string
  ): RepositoryResult<CommunicationMessagingAttachmentGuardRow | null>;
  findMessage(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationMessagingCenterKey,
    messageId: string
  ): RepositoryResult<CommunicationMessageRow | null>;
  findPresence(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationMessagingCenterKey
  ): RepositoryResult<CommunicationPresenceRow | null>;
  findRetentionPolicy(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationMessagingCenterKey,
    roomId: string
  ): RepositoryResult<CommunicationRetentionPolicyRow | null>;
  findDeliveryQueue(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationMessagingCenterKey,
    messageId: string
  ): RepositoryResult<CommunicationDeliveryQueueRow | null>;
  findMutationByClientOperationId(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationMessagingCenterKey,
    clientOperationId: string
  ): RepositoryResult<CommunicationMessagingMutationRow | null>;
  insertMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationMessagingMutationRow
  ): RepositoryResult<void>;
  insertMessage(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationMessageRow
  ): RepositoryResult<void>;
  saveMessage(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationMessageRow,
    expectedRevision: number
  ): RepositoryResult<void>;
  appendMessageEvent(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationMessageEventRow
  ): RepositoryResult<void>;
  upsertDeliveryQueue(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationDeliveryQueueRow,
    expectedRevision: number
  ): RepositoryResult<void>;
  savePresence(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationPresenceRow,
    expectedRevision: number
  ): RepositoryResult<void>;
  saveRetentionPolicy(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationRetentionPolicyRow,
    expectedRevision: number
  ): RepositoryResult<void>;
}

/** Payload-free metadata resolver used before the central policy transaction. */
export interface CommunicationMessagingPolicyResourceRepositoryPort {
  resolvePolicyResource(
    context: RepositoryExecutionContext,
    resourceType: CommunicationMessagingResourceType,
    resourceId: string
  ): RepositoryResult<{
    readonly id: string;
    readonly familyId: FamilyId;
    readonly ownerPersonId: PersonId;
    readonly revision: number;
    readonly status: string;
    readonly stateFingerprint: string;
  } | null>;
}
