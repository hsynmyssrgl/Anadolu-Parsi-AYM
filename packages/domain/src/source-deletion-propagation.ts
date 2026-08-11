export type SourceDeletionPropagationOwnerKind =
  | 'OCR_TEXT'
  | 'SEARCH_INDEX'
  | 'THUMBNAIL'
  | 'AI_MEMORY'
  | 'CACHE'
  | 'REPLICA'
  | 'BACKUP';

export type SourceDeletionCacheRegistryId =
  | 'family-import-preview'
  | 'ipc-main-read'
  | 'offline-sensitive';

export interface SourceDeletionPropagationBoundaryView {
  readonly schemaVersion: 1;
  readonly status: 'verified';
  readonly enforcement: 'fail-closed';
  readonly policyVersion: 'PPK-019-V1';
  readonly ownerKinds: readonly SourceDeletionPropagationOwnerKind[];
  readonly requiredCacheRegistries: readonly SourceDeletionCacheRegistryId[];
  readonly activeSemanticPersistentOwners: 0;
  readonly plaintextReplicaAllowed: false;
  readonly localPropagationMustPrecedeSourceDelete: true;
  readonly managedBackupVerifiedRewriteRequired: true;
  readonly unmanagedAndExternalBackupAttentionRequired: true;
  readonly historicalBackupQuarantineIsNotPhysicalDestruction: true;
  readonly sourceTombstoneRetainedUntilBackupCompletion: true;
  readonly payloadExposedToClient: false;
  readonly latestDatabaseMigration: 77;
}
