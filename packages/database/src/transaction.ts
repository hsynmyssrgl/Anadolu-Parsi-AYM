import {
  err,
  type AppError,
  type Clock,
  type CorrelationId,
  type Result
} from '@ppt/core';
import type {
  DatabaseExecutor,
  AsyncTransactionExecutor,
  RepositoryTransaction,
  TransactionContext,
  TransactionExecutor
} from '@ppt/contracts';
import { mapSqliteError } from './sqlite-error.js';

export class SqliteTransactionExecutor implements TransactionExecutor, AsyncTransactionExecutor {
  private active = false;

  public constructor(
    private readonly database: DatabaseExecutor,
    private readonly clock: Clock
  ) {}

  public execute<TValue>(
    correlationId: CorrelationId,
    operation: (context: TransactionContext) => Result<TValue, AppError>
  ): Result<TValue, AppError> {
    if (this.active) return err(mapSqliteError(new Error('SQLITE_TRANSACTION_ALREADY_ACTIVE'), correlationId));
    this.active = true;
    try {
      this.database.exec('BEGIN IMMEDIATE');
      const result = operation({
        transaction: this.database as unknown as RepositoryTransaction,
        correlationId,
        occurredAt: this.clock.now()
      });
      if (!result.ok) {
        this.database.exec('ROLLBACK');
        return result;
      }
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        this.database.exec('ROLLBACK');
      } catch {
        // İlk SQLite hatası korunur; rollback hatası ana hatayı gölgelememelidir.
      }
      return err(mapSqliteError(error, correlationId));
    } finally {
      this.active = false;
    }
  }

  public async executeAsync<TValue>(
    correlationId: CorrelationId,
    operation: (context: TransactionContext) => Promise<Result<TValue, AppError>>
  ): Promise<Result<TValue, AppError>> {
    if (this.active) return err(mapSqliteError(new Error('SQLITE_TRANSACTION_ALREADY_ACTIVE'), correlationId));
    this.active = true;
    try {
      this.database.exec('BEGIN IMMEDIATE');
      const occurredAt = this.clock.now();
      const result = await operation({
        transaction: this.database as unknown as RepositoryTransaction,
        correlationId,
        occurredAt
      });
      if (!result.ok) {
        this.database.exec('ROLLBACK');
        return result;
      }
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        this.database.exec('ROLLBACK');
      } catch {
        // İlk SQLite/işlem hatası korunur; rollback hatası ana hatayı gölgelememelidir.
      }
      return err(mapSqliteError(error, correlationId));
    } finally {
      this.active = false;
    }
  }
}
