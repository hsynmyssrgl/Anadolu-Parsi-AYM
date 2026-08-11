import type {
  AppError,
  CorrelationId,
  IsoDateTime,
  Result
} from '@ppt/core';

/**
 * Storage-engine-neutral statement result used by persistence adapters.
 * Concrete database packages implement this contract without exposing their
 * native driver types to application or repository contract consumers.
 */
export interface StatementRunResult {
  readonly changes: number | bigint;
  readonly lastInsertRowid: number | bigint;
}

/** Storage-engine-neutral prepared statement contract. */
export interface DatabaseStatement {
  run(...parameters: readonly unknown[]): StatementRunResult;
  get(...parameters: readonly unknown[]): unknown;
  all(...parameters: readonly unknown[]): readonly unknown[];
}

/** Minimal database execution boundary required by migrations and repositories. */
export interface DatabaseExecutor {
  prepare(sql: string): DatabaseStatement;
  exec(sql: string): void;
}

/** A closable database connection owned by the runtime composition layer. */
export interface DatabaseConnection extends DatabaseExecutor {
  close(): void;
}

/**
 * Opaque transaction capability passed across the application/repository boundary.
 * The native database executor is deliberately hidden so application adapters
 * cannot issue ad-hoc SQL even accidentally.
 */
declare const repositoryTransactionBrand: unique symbol;
export interface RepositoryTransaction {
  readonly [repositoryTransactionBrand]: 'RepositoryTransaction';
}

/** Transaction metadata passed to repository-backed application adapters. */
export interface TransactionContext {
  readonly transaction: RepositoryTransaction;
  readonly correlationId: CorrelationId;
  readonly occurredAt: IsoDateTime;
}

/** Application-facing transaction boundary. */
export interface TransactionExecutor {
  execute<TValue>(
    correlationId: CorrelationId,
    operation: (context: TransactionContext) => Result<TValue, AppError>
  ): Result<TValue, AppError>;
}
