import type { AppError, CorrelationId, Result } from '@ppt/core';
import type { MaintenanceResultView } from '@ppt/domain';

export type DatabaseMaintenanceOperation = MaintenanceResultView['operation'];

export interface DatabaseMaintenanceCommandPort {
  execute(operation: DatabaseMaintenanceOperation, correlationId: CorrelationId): Result<void, AppError>;
}

export class RunDatabaseMaintenanceUseCase {
  public constructor(private readonly command: DatabaseMaintenanceCommandPort) {}

  public execute(
    correlationId: CorrelationId,
    operation: DatabaseMaintenanceOperation
  ): Result<void, AppError> {
    return this.command.execute(operation, correlationId);
  }
}
