import type { IsoDateTime } from '@ppt/core';

export const COMMUNICATION_FILE_MAX_BYTES = 2 * 1024 * 1024 * 1024;
export const COMMUNICATION_FILE_CHUNK_BYTES = 4 * 1024 * 1024;
export const COMMUNICATION_FILE_LOCAL_STAGING_MAX_BYTES = 64 * 1024 * 1024;
export const COMMUNICATION_FILE_SAFE_PREVIEW_MAX_BYTES = 256 * 1024;
export const COMMUNICATION_FILE_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1_000;
export const COMMUNICATION_FILE_MAX_FILES_PER_OWNER = 128;
export const COMMUNICATION_FILE_MAX_VERSIONS = 32;
export const COMMUNICATION_FILE_MAX_COMMENTS = 256;
export const COMMUNICATION_FILE_MAX_ACCESS_GRANTS = 256;

export type CommunicationFileShareState =
  | 'prepared_local'
  | 'transferring_local'
  | 'paused'
  | 'scan_required'
  | 'ready_local'
  | 'quarantined'
  | 'revoked';
export type CommunicationFileAccessMode = 'preview_only' | 'download';
export type CommunicationFileScanState = 'not_run' | 'clean' | 'malicious' | 'provider_unavailable';

export interface CommunicationFileChunkReceiptView {
  readonly chunkIndex: number;
  readonly offsetBytes: number;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly verifiedAt: IsoDateTime;
}

export interface CommunicationFileVersionView {
  readonly version: number;
  readonly contentSha256: string;
  readonly sizeBytes: number;
  readonly sealedPayloadReference: string;
  readonly providerId: 'protected-side-artifact-store-v1';
  readonly providerEvidenceSha256: string;
  readonly createdByPersonId: string;
  readonly createdAt: IsoDateTime;
}

export interface CommunicationFileCommentView {
  readonly id: string;
  readonly authorPersonId: string;
  readonly body: string;
  readonly createdAt: IsoDateTime;
}

export interface CommunicationFileAccessGrantView {
  readonly id: string;
  readonly personId: string;
  readonly mode: CommunicationFileAccessMode;
  readonly startsAt: IsoDateTime;
  readonly endsAt: IsoDateTime;
  readonly revokedAt?: IsoDateTime;
}

export interface CommunicationFileShareView {
  readonly id: string;
  readonly roomId?: string;
  readonly meetingId?: string;
  readonly ownerPersonId: string;
  readonly displayName: string;
  readonly mimeType: string;
  readonly totalBytes: number;
  readonly totalChunks: number;
  readonly fullContentSha256: string;
  readonly sealedPayloadReference: string;
  readonly providerId: 'protected-side-artifact-store-v1';
  readonly providerEvidenceSha256: string;
  readonly state: CommunicationFileShareState;
  readonly scanState: CommunicationFileScanState;
  readonly scanProviderId?: string;
  readonly scanEvidenceSha256?: string;
  readonly chunks: readonly CommunicationFileChunkReceiptView[];
  readonly versions: readonly CommunicationFileVersionView[];
  readonly comments: readonly CommunicationFileCommentView[];
  readonly accessGrants: readonly CommunicationFileAccessGrantView[];
  readonly archiveItemId?: string;
  readonly albumId?: string;
  readonly selectedForStory: boolean;
  readonly likedByPersonIds: readonly string[];
  readonly externalLinkEnabled: false;
  readonly externalLinkExpiresAt?: IsoDateTime;
  readonly externalLinkAccessCodeRequired: true;
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationNotificationProfileView {
  readonly quietHoursEnabled: boolean;
  readonly quietHoursStart: string;
  readonly quietHoursEnd: string;
  readonly nonEmergencyDigestEnabled: boolean;
  readonly roomOverrides: readonly { readonly roomId: string; readonly muted: boolean }[];
  readonly personOverrides: readonly { readonly personId: string; readonly muted: boolean }[];
}

export interface CommunicationEmergencyAnnouncementView {
  readonly id: string;
  readonly title: string;
  readonly createdByPersonId: string;
  readonly acknowledgedPersonIds: readonly string[];
  readonly emergencyServiceGuaranteed: false;
  readonly localDeliveryOnly: true;
  readonly createdAt: IsoDateTime;
}

export interface CommunicationRemoteAssistanceView {
  readonly id: string;
  readonly requesterPersonId: string;
  readonly helperPersonId: string;
  readonly state: 'consent_pending' | 'active_local_plan' | 'revoked' | 'expired';
  readonly singleUseConsent: true;
  readonly visibleIndicatorRequired: true;
  readonly secureDesktopAndPasswordsHidden: true;
  readonly allowedControls: readonly ('pointer' | 'keyboard' | 'annotate')[];
  readonly endsAt: IsoDateTime;
  readonly revokedAt?: IsoDateTime;
  readonly remoteTransportConfigured: false;
}

export interface CommunicationCoWatchView {
  readonly id: string;
  readonly mediaReference: string;
  readonly narrationEnabled: boolean;
  readonly state: 'local_plan' | 'cancelled';
  readonly sharePlayAdapterConfigured: false;
}

export interface CommunicationVoiceActionView {
  readonly id: string;
  readonly action: 'call' | 'send_message' | 'join_meeting';
  readonly targetReference: string;
  readonly state: 'confirmation_required' | 'confirmed_local_only' | 'cancelled';
  readonly executedExternally: false;
}

export interface CommunicationFileSharingTruthView {
  readonly e2eeEnvelopeMetadataRequired: true;
  readonly resumableChunkAndFullHashVerificationModeled: true;
  readonly versionCommentRelationAndSingleArchiveCopyModeled: true;
  readonly timeBoundPreviewAndDownloadGrantsModeled: true;
  readonly localMalwareQuarantineGateModeled: true;
  readonly albumSelectionLikesAndStoryTransferModeled: true;
  readonly externalLinksDefaultClosed: true;
  readonly externalLinksRequireExpiryAndAccessCode: true;
  readonly quietHoursAndNonEmergencyDigestModeled: true;
  readonly emergencyAnnouncementNotEmergencyService: true;
  readonly remoteAssistanceSingleUseConsentRequired: true;
  readonly remoteAssistanceSensitiveDesktopHidden: true;
  readonly voiceActionConfirmationRequired: true;
  readonly productionFileTransportConfigured: false;
  readonly productionMalwareScannerConfigured: false;
  readonly remoteAssistanceTransportConfigured: false;
  readonly sharePlayAdapterConfigured: false;
  readonly voiceExecutionProviderConfigured: false;
  readonly networkUsedByCurrentImplementation: false;
}

export interface CommunicationFileSharingCenterView {
  readonly schemaVersion: 1;
  readonly centerId: string;
  readonly ownerPersonId: string;
  readonly files: readonly CommunicationFileShareView[];
  readonly notificationProfile: CommunicationNotificationProfileView;
  readonly emergencyAnnouncements: readonly CommunicationEmergencyAnnouncementView[];
  readonly remoteAssistance: readonly CommunicationRemoteAssistanceView[];
  readonly coWatchSessions: readonly CommunicationCoWatchView[];
  readonly voiceActions: readonly CommunicationVoiceActionView[];
  readonly truth: CommunicationFileSharingTruthView;
  readonly revision: number;
  readonly generatedAt: IsoDateTime;
}

export type CommunicationFileSharingCommand =
  | { readonly kind: 'prepare_file'; readonly fileId: string; readonly roomId?: string; readonly meetingId?: string;
      readonly displayName: string; readonly mimeType: string; readonly totalBytes: number; readonly totalChunks: number;
      readonly fullContentSha256: string; readonly sealedPayloadReference: string;
      readonly providerId: 'protected-side-artifact-store-v1'; readonly providerEvidenceSha256: string;
      readonly verifiedChunks: readonly { readonly chunkIndex: number; readonly offsetBytes: number;
        readonly sizeBytes: number; readonly sha256: string }[];
      readonly scanState: Exclude<CommunicationFileScanState, 'not_run'>; readonly scanProviderId?: string;
      readonly scanEvidenceSha256?: string }
  | { readonly kind: 'record_chunk'; readonly fileId: string; readonly chunkIndex: number; readonly offsetBytes: number;
      readonly sizeBytes: number; readonly sha256: string }
  | { readonly kind: 'set_scan'; readonly fileId: string; readonly scanState: Exclude<CommunicationFileScanState, 'not_run'>;
      readonly scanProviderId?: string; readonly scanEvidenceSha256?: string }
  | { readonly kind: 'add_version'; readonly fileId: string; readonly contentSha256: string; readonly sizeBytes: number;
       readonly sealedPayloadReference: string; readonly providerId: 'protected-side-artifact-store-v1';
       readonly providerEvidenceSha256: string }
  | { readonly kind: 'add_comment'; readonly fileId: string; readonly commentId: string; readonly body: string }
  | { readonly kind: 'grant_access'; readonly fileId: string; readonly grantId: string; readonly personId: string;
      readonly mode: CommunicationFileAccessMode; readonly startsAt: string; readonly endsAt: string }
  | { readonly kind: 'revoke_share'; readonly fileId: string }
  | { readonly kind: 'link_archive'; readonly fileId: string; readonly archiveItemId: string }
  | { readonly kind: 'update_album'; readonly fileId: string; readonly albumId: string; readonly selectedForStory: boolean;
      readonly likedByPersonIds: readonly string[] }
  | { readonly kind: 'set_notifications'; readonly quietHoursEnabled: boolean; readonly quietHoursStart: string;
      readonly quietHoursEnd: string; readonly nonEmergencyDigestEnabled: boolean;
      readonly roomOverrides: readonly { readonly roomId: string; readonly muted: boolean }[];
      readonly personOverrides: readonly { readonly personId: string; readonly muted: boolean }[] }
  | { readonly kind: 'announce_emergency'; readonly announcementId: string; readonly title: string }
  | { readonly kind: 'acknowledge_emergency'; readonly announcementId: string }
  | { readonly kind: 'request_remote_assistance'; readonly sessionId: string; readonly helperPersonId: string;
      readonly allowedControls: readonly ('pointer' | 'keyboard' | 'annotate')[]; readonly endsAt: string }
  | { readonly kind: 'grant_remote_assistance'; readonly sessionId: string; readonly explicitSingleUseConsent: true }
  | { readonly kind: 'revoke_remote_assistance'; readonly sessionId: string }
  | { readonly kind: 'plan_co_watch'; readonly sessionId: string; readonly mediaReference: string; readonly narrationEnabled: boolean }
  | { readonly kind: 'prepare_voice_action'; readonly actionId: string; readonly action: CommunicationVoiceActionView['action'];
      readonly targetReference: string }
  | { readonly kind: 'confirm_voice_action'; readonly actionId: string; readonly explicitConfirmation: true };

export interface CommunicationFileSharingMutationReceiptView {
  readonly resourceId: string;
  readonly commandKind: CommunicationFileSharingCommand['kind'];
  readonly previousRevision: number;
  readonly revision: number;
  readonly occurredAt: IsoDateTime;
  readonly replayed: boolean;
  readonly externalOperationPerformed: false;
  readonly networkUsed: false;
}

export interface CommunicationFileShareRendererView {
  readonly id: string;
  readonly roomId?: string;
  readonly meetingId?: string;
  readonly displayName: string;
  readonly mimeType: string;
  readonly totalBytes: number;
  readonly totalChunks: number;
  readonly verifiedChunkCount: number;
  readonly state: CommunicationFileShareState;
  readonly scanState: CommunicationFileScanState;
  readonly versionCount: number;
  readonly comments: readonly CommunicationFileCommentView[];
  readonly accessGrants: readonly CommunicationFileAccessGrantView[];
  readonly archiveItemId?: string;
  readonly albumId?: string;
  readonly selectedForStory: boolean;
  readonly likedByPersonIds: readonly string[];
  readonly externalLinkEnabled: false;
  readonly externalLinkAccessCodeRequired: true;
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationFileSharingRendererCenterView {
  readonly schemaVersion: 1;
  readonly files: readonly CommunicationFileShareRendererView[];
  readonly notificationProfile: CommunicationNotificationProfileView;
  readonly emergencyAnnouncements: readonly CommunicationEmergencyAnnouncementView[];
  readonly remoteAssistance: readonly CommunicationRemoteAssistanceView[];
  readonly coWatchSessions: readonly CommunicationCoWatchView[];
  readonly voiceActions: readonly CommunicationVoiceActionView[];
  readonly truth: CommunicationFileSharingTruthView;
  readonly revision: number;
  readonly generatedAt: IsoDateTime;
}

export interface CommunicationFileSharingRendererMutationReceiptView {
  readonly commandKind: CommunicationFileSharingCommand['kind'];
  readonly previousRevision: number;
  readonly revision: number;
  readonly occurredAt: IsoDateTime;
  readonly replayed: boolean;
  readonly externalOperationPerformed: false;
  readonly networkUsed: false;
}

export interface CommunicationFileSafePreviewView {
  readonly schemaVersion: 1;
  readonly fileId: string;
  readonly displayName: string;
  readonly mimeType: 'text/plain' | 'text/markdown' | 'text/csv' | 'application/json';
  readonly text: string;
  readonly totalBytes: number;
  readonly scanState: 'clean';
  readonly accessMode: 'owner';
  readonly renderingMode: 'escaped_plain_text';
  readonly truncated: false;
  readonly payloadSource: 'local_protected_payload';
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export interface CommunicationFilePayloadMaintenanceView {
  readonly scannedFiles: number;
  readonly deletedFiles: number;
  readonly rejectedFiles: number;
  readonly completedAt: IsoDateTime;
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export const communicationFileSharingTruth = Object.freeze({
  e2eeEnvelopeMetadataRequired: true as const,
  resumableChunkAndFullHashVerificationModeled: true as const,
  versionCommentRelationAndSingleArchiveCopyModeled: true as const,
  timeBoundPreviewAndDownloadGrantsModeled: true as const,
  localMalwareQuarantineGateModeled: true as const,
  albumSelectionLikesAndStoryTransferModeled: true as const,
  externalLinksDefaultClosed: true as const,
  externalLinksRequireExpiryAndAccessCode: true as const,
  quietHoursAndNonEmergencyDigestModeled: true as const,
  emergencyAnnouncementNotEmergencyService: true as const,
  remoteAssistanceSingleUseConsentRequired: true as const,
  remoteAssistanceSensitiveDesktopHidden: true as const,
  voiceActionConfirmationRequired: true as const,
  productionFileTransportConfigured: false as const,
  productionMalwareScannerConfigured: false as const,
  remoteAssistanceTransportConfigured: false as const,
  sharePlayAdapterConfigured: false as const,
  voiceExecutionProviderConfigured: false as const,
  networkUsedByCurrentImplementation: false as const
});

export const communicationFileSharingCenterId = (familyId: string, ownerPersonId: string): string =>
  `communication-file-sharing:${familyId}:${ownerPersonId}`;
