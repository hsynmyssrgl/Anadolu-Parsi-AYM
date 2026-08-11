import type { AppError, CorrelationId, Result } from '@ppt/core';

export interface AuditStorageProtectionCommandPort {
  install(correlationId: CorrelationId): Result<void, AppError>;
}

export class InstallAuditStorageProtectionUseCase {
  public constructor(private readonly command: AuditStorageProtectionCommandPort) {}

  public execute(correlationId: CorrelationId): Result<void, AppError> {
    return this.command.install(correlationId);
  }
}
