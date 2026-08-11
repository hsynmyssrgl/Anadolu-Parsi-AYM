import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type Result
} from '@ppt/core';
import type { SourceDeletionPropagationBoundaryView } from '@ppt/domain';
import {
  SourceDeletionPropagationPolicy,
  type SourceDeletionCacheInvalidation,
  type SourceDeletionIdentity,
  type SourceDeletionPersistentOwnerInspection,
  type SourceDeletionPropagationPlan
} from '@ppt/platform-policy';

export interface SourceDeletionPropagationEvidence {
  readonly schemaVersion: 1;
  readonly planHash: string;
  readonly sourceDeleted: true;
  readonly deletedAccessMetadataRows: number;
  readonly localPropagationComplete: true;
  readonly backupPropagationPending: true;
}
export interface SourceDeletionPropagationWriteScope {
  inspectSourceDeletionPropagation(inspectedAt: string): Result<SourceDeletionPersistentOwnerInspection, AppError>;
  purgeResourceWithPropagation(
    plan: SourceDeletionPropagationPlan
  ): Result<SourceDeletionPropagationEvidence, AppError>;
}

export interface SourceDeletionRuntimeCacheInvalidationPort {
  invalidate(input: SourceDeletionIdentity, correlationId: CorrelationId): Result<readonly SourceDeletionCacheInvalidation[], AppError>;
}

const propagationDenied = (
  correlationId: CorrelationId,
  reason: string
): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_CONFLICT,
  message: `Kaynak silme yayılımı fail-closed reddedildi: ${reason}`,
  category: 'conflict',
  correlationId
});

export class EnforceSourceDeletionPropagationUseCase {
  public constructor(
    private readonly policy: SourceDeletionPropagationPolicy,
    private readonly cacheInvalidation: SourceDeletionRuntimeCacheInvalidationPort
  ) {}

  public execute(input: {
    readonly scope: SourceDeletionPropagationWriteScope;
    readonly source: SourceDeletionIdentity;
    readonly correlationId: CorrelationId;
  }): Result<{ readonly plan: SourceDeletionPropagationPlan; readonly evidence: SourceDeletionPropagationEvidence }, AppError> {
    const cacheInvalidations = this.cacheInvalidation.invalidate(input.source, input.correlationId);
    if (!cacheInvalidations.ok) return cacheInvalidations;
    const inspection = input.scope.inspectSourceDeletionPropagation(input.source.purgedAt);
    if (!inspection.ok) return inspection;
    const decision = this.policy.evaluate({
      source: input.source,
      persistentInspection: inspection.value,
      cacheInvalidations: cacheInvalidations.value
    });
    if (!decision.allowed) return err(propagationDenied(input.correlationId, decision.reason));
    const persisted = input.scope.purgeResourceWithPropagation(decision.plan);
    if (!persisted.ok) return persisted;
    if (
      persisted.value.planHash !== decision.plan.planHash
      || !persisted.value.sourceDeleted
      || !persisted.value.localPropagationComplete
      || !persisted.value.backupPropagationPending
      || !Number.isSafeInteger(persisted.value.deletedAccessMetadataRows)
      || persisted.value.deletedAccessMetadataRows < 0
    ) return err(propagationDenied(input.correlationId, 'PROPAGATION_EVIDENCE_MISMATCH'));
    return ok(Object.freeze({ plan: decision.plan, evidence: Object.freeze({ ...persisted.value }) }));
  }
}

export class GetSourceDeletionPropagationBoundaryUseCase {
  public constructor(private readonly policy: SourceDeletionPropagationPolicy) {}

  public execute(): SourceDeletionPropagationBoundaryView {
    const snapshot = this.policy.snapshot();
    return Object.freeze({
      schemaVersion: 1,
      status: 'verified',
      enforcement: snapshot.enforcement,
      policyVersion: snapshot.policyVersion,
      ownerKinds: snapshot.ownerKinds,
      requiredCacheRegistries: snapshot.requiredCacheRegistries,
      activeSemanticPersistentOwners: snapshot.activeSemanticPersistentOwners,
      plaintextReplicaAllowed: snapshot.plaintextReplicaAllowed,
      localPropagationMustPrecedeSourceDelete: snapshot.localPropagationMustPrecedeSourceDelete,
      managedBackupVerifiedRewriteRequired: snapshot.managedBackupVerifiedRewriteRequired,
      unmanagedAndExternalBackupAttentionRequired: snapshot.unmanagedAndExternalBackupAttentionRequired,
      historicalBackupQuarantineIsNotPhysicalDestruction: snapshot.historicalBackupQuarantineIsNotPhysicalDestruction,
      sourceTombstoneRetainedUntilBackupCompletion: true,
      payloadExposedToClient: snapshot.payloadExposedToClient,
      latestDatabaseMigration: 77
    });
  }
}
