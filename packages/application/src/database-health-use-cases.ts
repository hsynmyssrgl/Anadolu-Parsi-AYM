import type { AppError, CorrelationId, Result } from '@ppt/core';

export interface DatabaseRuntimeHealthView {
  readonly integrityOk: boolean;
  readonly journalMode: string;
}

export interface DatabaseRuntimeHealthQueryPort {
  inspect(correlationId: CorrelationId): Result<DatabaseRuntimeHealthView, AppError>;
}

export class InspectDatabaseRuntimeHealthUseCase {
  public constructor(private readonly query: DatabaseRuntimeHealthQueryPort) {}
  public execute(correlationId: CorrelationId): Result<DatabaseRuntimeHealthView, AppError> {
    return this.query.inspect(correlationId);
  }
}
