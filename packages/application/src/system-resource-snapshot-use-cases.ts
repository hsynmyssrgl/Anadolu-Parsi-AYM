import {
  ERROR_CODES,
  createAppError,
  err,
  type AppError,
  type CorrelationId,
  type Result
} from '@ppt/core';

export interface SystemResourceSnapshotView {
  readonly platform: string;
  readonly arch: string;
  readonly cpuModel: string;
  readonly cpuCores: number;
  readonly cpuLoadPercent: number;
  readonly totalMemoryBytes: number;
  readonly freeMemoryBytes: number;
  readonly memoryUsagePercent: number;
  readonly databaseBytes: number;
  readonly archiveBytes: number;
}

export interface SystemResourceSnapshotPort {
  inspect(
    input: { readonly databasePath: string; readonly archivePath: string },
    correlationId: CorrelationId
  ): Result<SystemResourceSnapshotView, AppError>;
}

const invalid = (correlationId: CorrelationId, message: string): AppError =>
  createAppError({
    code: ERROR_CODES.CORE_INVALID_ARGUMENT,
    message,
    category: 'validation',
    correlationId
  });

export class InspectSystemResourceSnapshotUseCase {
  public constructor(private readonly resources: SystemResourceSnapshotPort) {}

  public execute(
    correlationId: CorrelationId,
    input: { readonly databasePath: string; readonly archivePath: string }
  ): Result<SystemResourceSnapshotView, AppError> {
    if (!input.databasePath.trim()) return err(invalid(correlationId, 'Veritabanı yolu zorunludur.'));
    if (!input.archivePath.trim()) return err(invalid(correlationId, 'Arşiv yolu zorunludur.'));
    return this.resources.inspect(input, correlationId);
  }
}
