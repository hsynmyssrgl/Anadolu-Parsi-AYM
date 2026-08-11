import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type Result
} from '@ppt/core';
import type {
  BackupPropagationRunView,
  BackupRunView,
  BackupTargetView
} from '@ppt/domain';
import type {
  BackupPurgeQuarantineResult,
  BackupPurgeTombstoneFingerprint
} from './backup-purge-propagation-file-use-cases.js';
import type { PendingBackupPropagationRecord } from './backup-propagation-use-cases.js';

export interface ManagedBackupPropagationOperations {
  listSuccessfulRuns(targetId: string): Result<readonly BackupRunView[], AppError>;
  createVerifiedBackup(targetId: string): Result<BackupRunView, AppError>;
  quarantineManagedArtifacts(input: {
    readonly targetPath: string;
    readonly excludeFilePath: string;
    readonly artifactPaths: readonly string[];
    readonly batchId: string;
    readonly quarantinedAt: string;
    readonly tombstones: readonly BackupPurgeTombstoneFingerprint[];
  }): Result<BackupPurgeQuarantineResult, AppError>;
  deleteManagedRun(runId: string): Result<void, AppError>;
  listArtifacts(targetPath: string): Result<readonly string[], AppError>;
  completePending(
    records: readonly PendingBackupPropagationRecord[],
    completedAt: string
  ): Result<number, AppError>;
}

export interface ExecuteManagedBackupPropagationInput {
  readonly correlationId: CorrelationId;
  readonly runId: string;
  readonly pending: readonly PendingBackupPropagationRecord[];
  readonly targets: readonly BackupTargetView[];
  readonly tombstones: readonly BackupPurgeTombstoneFingerprint[];
  readonly startedAt: string;
  readonly startedMonotonicMs: number;
  readonly monotonicNowMs: () => number;
  readonly operations: ManagedBackupPropagationOperations;
}

const invalid = (input: ExecuteManagedBackupPropagationInput, message: string): AppError =>
  createAppError({
    code: ERROR_CODES.CORE_INVALID_ARGUMENT,
    message,
    category: 'validation',
    correlationId: input.correlationId
  });

const failureMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const executeManagedBackupPropagation = (
  input: ExecuteManagedBackupPropagationInput
): Result<BackupPropagationRunView, AppError> => {
  if (!input.runId.trim()) return err(invalid(input, 'Yedek yayılım çalışma kimliği zorunludur.'));
  const startedAtMs = Date.parse(input.startedAt);
  if (Number.isNaN(startedAtMs)) {
    return err(invalid(input, 'Yedek yayılım başlangıç zamanı geçersizdir.'));
  }
  if (!Number.isFinite(input.startedMonotonicMs) || input.startedMonotonicMs < 0 || typeof input.monotonicNowMs !== 'function') {
    return err(invalid(input, 'Yedek yayılım monotonik saat başlangıcı geçersizdir.'));
  }
  let lastMonotonicMs = input.startedMonotonicMs;
  const captureChronology = (label: string): Result<string, AppError> => {
    let currentMonotonicMs: number;
    try {
      currentMonotonicMs = input.monotonicNowMs();
    } catch (error) {
      return err(invalid(input, `Yedek yayılım ${label} monotonik saati okunamadı: ${failureMessage(error)}`));
    }
    if (!Number.isFinite(currentMonotonicMs) || currentMonotonicMs < lastMonotonicMs) {
      return err(invalid(input, `Yedek yayılım ${label} monotonik saati geriye gitti veya geçersizdir.`));
    }
    lastMonotonicMs = currentMonotonicMs;
    return ok(new Date(startedAtMs + currentMonotonicMs - input.startedMonotonicMs).toISOString());
  };
  if (input.pending.length !== input.tombstones.length) {
    return err(invalid(input, 'İmha tombstone parmak izi sayısı bekleyen kayıt sayısıyla uyuşmuyor.'));
  }

  const targetIds = new Set(input.targets.map((target) => target.id));
  if (targetIds.size !== input.targets.length) {
    return err(invalid(input, 'Yedek yayılım hedef listesinde yinelenen hedef bulunuyor.'));
  }

  const targets = input.pending.length === 0
    ? []
    : input.targets.filter((target) => target.enabled);
  const targetResults: BackupPropagationRunView['targetResults'] = [];
  let quarantinedArtifacts = 0;

  for (const target of targets) {
    const priorResult = input.operations.listSuccessfulRuns(target.id);
    if (!priorResult.ok) {
      targetResults.push({
        targetId: target.id,
        targetName: target.name,
        success: false,
        quarantinedArtifacts: 0,
        unmanagedArtifacts: 0,
        error: priorResult.error.message
      });
      continue;
    }

    try {
      const refreshedResult = input.operations.createVerifiedBackup(target.id);
      if (!refreshedResult.ok) throw new Error(refreshedResult.error.message);
      const refreshed = refreshedResult.value;
      if (refreshed.status !== 'success' || !refreshed.filePath || !refreshed.sha256) {
        throw new Error(refreshed.error ?? 'İmha sonrası temiz yedek doğrulanamadı.');
      }

      const priorRuns = priorResult.value.filter((old) => old.id !== refreshed.id);
      const artifactPaths = priorRuns
        .map((run) => run.filePath)
        .filter((filePath): filePath is string => Boolean(filePath));
      const quarantinedAt = captureChronology(`karantina/${target.id}`);
      if (!quarantinedAt.ok) return quarantinedAt;
      const quarantine = input.operations.quarantineManagedArtifacts({
        targetPath: target.path,
        excludeFilePath: refreshed.filePath,
        artifactPaths,
        batchId: input.runId,
        quarantinedAt: quarantinedAt.value,
        tombstones: input.tombstones
      });
      if (!quarantine.ok) throw new Error(quarantine.error.message);

      for (const old of priorRuns) {
        const removedRun = input.operations.deleteManagedRun(old.id);
        if (!removedRun.ok) throw new Error(removedRun.error.message);
      }

      const listed = input.operations.listArtifacts(target.path);
      if (!listed.ok) throw new Error(listed.error.message);
      const unmanaged = listed.value.filter((filePath) => filePath !== refreshed.filePath).length;
      const moved = quarantine.value.artifacts.length;
      quarantinedArtifacts += moved;
      targetResults.push({
        targetId: target.id,
        targetName: target.name,
        success: unmanaged === 0,
        refreshedRunId: refreshed.id,
        freshBackupPath: refreshed.filePath,
        freshBackupSha256: refreshed.sha256,
        quarantineDirectory: quarantine.value.quarantineDirectory,
        quarantineManifestPath: quarantine.value.manifestPath,
        quarantinedArtifacts: moved,
        unmanagedArtifacts: unmanaged,
        ...(unmanaged > 0
          ? { error: 'Yedek hedefinde yönetilmeyen aktif .pptbackup dosyası kaldı.' }
          : {})
      });
    } catch (error) {
      targetResults.push({
        targetId: target.id,
        targetName: target.name,
        success: false,
        quarantinedArtifacts: 0,
        unmanagedArtifacts: 0,
        error: failureMessage(error)
      });
    }
  }

  const completedAtResult = captureChronology('tamamlama');
  if (!completedAtResult.ok) return completedAtResult;
  const completedAt = completedAtResult.value;
  const refreshedTargets = targetResults.filter((result) => result.success).length;
  const allTargetsRefreshed = targets.length > 0 && refreshedTargets === targets.length;
  let completedRecords = 0;
  if (input.pending.length > 0 && allTargetsRefreshed) {
    const completed = input.operations.completePending(input.pending, completedAt);
    if (!completed.ok) return completed;
    completedRecords = completed.value;
  }

  const pendingRemaining = Math.max(0, input.pending.length - completedRecords);
  const status: BackupPropagationRunView['status'] =
    input.pending.length === 0
      ? 'success'
      : targets.length === 0
        ? 'attention'
        : pendingRemaining === 0
          ? 'success'
          : refreshedTargets > 0
            ? 'partial'
            : 'failed';
  const errors = targetResults
    .filter((result) => !result.success)
    .map((result) => `${result.targetName}: ${result.error ?? 'başarısız'}`);
  const unmanagedCount = targetResults.reduce(
    (sum, result) => sum + result.unmanagedArtifacts,
    0
  );

  return ok({
    id: input.runId,
    status,
    pendingRecords: input.pending.length,
    targetCount: targets.length,
    refreshedTargets,
    quarantinedArtifacts,
    pendingRemaining,
    manualBackupWarning: unmanagedCount > 0 || input.pending.length > 0,
    targetResults,
    ...(errors.length > 0 ? { error: errors.join(' | ') } : {}),
    startedAt: input.startedAt,
    completedAt
  });
};
