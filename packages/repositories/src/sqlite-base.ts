import { err, ok, type AppError, type Result } from '@ppt/core';
import type { DatabaseExecutor } from '@ppt/contracts';
import { mapSqliteError } from '@ppt/database';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';



export abstract class SqliteRepository {

  protected database(context: RepositoryExecutionContext): DatabaseExecutor {
    return context.transaction as unknown as DatabaseExecutor;
  }

  protected execute<TValue>(
    context: RepositoryExecutionContext,
    operation: () => TValue
  ): Result<TValue, AppError> {
    try {
      return ok(operation());
    } catch (error) {
      return err(mapSqliteError(error, context.correlationId));
    }
  }
}
