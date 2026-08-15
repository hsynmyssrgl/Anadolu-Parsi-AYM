import type { IsoDateTime } from '@ppt/core';

export type CommunicationAuditEventKind =
  | 'room_joined'
  | 'room_left'
  | 'call_started'
  | 'call_ended'
  | 'file_shared'
  | 'permission_changed'
  | 'message_created'
  | 'message_deleted'
  | 'recording_consent_changed';

export interface CommunicationAuditEventView {
  readonly id: string;
  readonly familyId: string;
  readonly ownerPersonId: string;
  readonly actorPersonId: string;
  readonly actorDeviceId: string;
  readonly eventKind: CommunicationAuditEventKind;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly resourceVersion: number;
  readonly resourceFingerprint: string;
  readonly previousHash: string;
  readonly eventHash: string;
  readonly sequence: number;
  readonly occurredAt: IsoDateTime;
  readonly contentCopiedToAudit: false;
}

export interface CommunicationArchiveIntegrityCheckpointView {
  readonly id: string;
  readonly familyId: string;
  readonly archiveGeneration: number;
  readonly vaultManifestSha256: string;
  readonly databaseManifestSha256: string;
  readonly backupManifestSha256: string;
  readonly replicaManifestSha256?: string;
  readonly restoreManifestSha256?: string;
  readonly vaultVerified: boolean;
  readonly backupVerified: boolean;
  readonly replicaVerified: boolean;
  readonly restoreVerified: boolean;
  readonly externalBackupProviderVerified: false;
  readonly remoteReplicationVerified: false;
  readonly createdAt: IsoDateTime;
}

export interface CommunicationAuditArchiveTruthView {
  readonly appendOnlyHashChainedAuditImplemented: true;
  readonly membershipCallFileAndPermissionEventsModeled: true;
  readonly contentExcludedFromAuditByConstruction: true;
  readonly identityHashAndVersionMetadataOnly: true;
  readonly vaultDatabaseBackupRestoreCheckpointModeled: true;
  readonly mutationAndCheckpointDeleteBlocked: true;
  readonly productionRemoteReplicationConfigured: false;
  readonly externalBackupProviderVerified: false;
  readonly realRestoreDrillPerformed: false;
  readonly networkUsedByCurrentImplementation: false;
}

export interface CommunicationAuditArchiveCenterView {
  readonly schemaVersion: 1;
  readonly events: readonly CommunicationAuditEventView[];
  readonly checkpoints: readonly CommunicationArchiveIntegrityCheckpointView[];
  readonly chainValid: boolean;
  readonly truth: CommunicationAuditArchiveTruthView;
  readonly generatedAt: IsoDateTime;
}

export interface AppendCommunicationAuditEventInput {
  readonly clientOperationId: string;
  readonly actorDeviceId: string;
  readonly eventKind: CommunicationAuditEventKind;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly resourceVersion: number;
  readonly resourceFingerprint: string;
}

export interface RegisterCommunicationArchiveCheckpointInput {
  readonly clientOperationId: string;
  readonly archiveGeneration: number;
  readonly vaultManifestSha256: string;
  readonly databaseManifestSha256: string;
  readonly backupManifestSha256: string;
  readonly replicaManifestSha256?: string;
  readonly restoreManifestSha256?: string;
  readonly vaultVerified: boolean;
  readonly backupVerified: boolean;
  readonly replicaVerified: boolean;
  readonly restoreVerified: boolean;
}

export const communicationAuditArchiveTruth = Object.freeze({
  appendOnlyHashChainedAuditImplemented: true as const,
  membershipCallFileAndPermissionEventsModeled: true as const,
  contentExcludedFromAuditByConstruction: true as const,
  identityHashAndVersionMetadataOnly: true as const,
  vaultDatabaseBackupRestoreCheckpointModeled: true as const,
  mutationAndCheckpointDeleteBlocked: true as const,
  productionRemoteReplicationConfigured: false as const,
  externalBackupProviderVerified: false as const,
  realRestoreDrillPerformed: false as const,
  networkUsedByCurrentImplementation: false as const
});
