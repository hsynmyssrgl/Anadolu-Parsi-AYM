import { describe, expect, it } from 'vitest';
import {
  ERROR_CODES,
  asCorrelationId,
  asIsoDateTime,
  createAppError,
  err,
  ok
} from '@ppt/core';
import type { DatabaseExecutor } from '@ppt/contracts';
import { SqliteTransactionExecutor } from './src/transaction.js';

const CORRELATION = asCorrelationId('transaction-async-test');
const NOW = asIsoDateTime('2026-08-14T11:00:00.000Z');

const databaseHarness = () => {
  const commands: string[] = [];
  const database: DatabaseExecutor = {
    exec: (sql) => { commands.push(sql); },
    prepare: () => { throw new Error('prepare is not used by this boundary test'); }
  };
  return { database, commands };
};

describe('SqliteTransactionExecutor asynchronous boundary', () => {
  it('keeps one context and commits only after the awaited operation succeeds', async () => {
    const harness = databaseHarness();
    const executor = new SqliteTransactionExecutor(harness.database, { now: () => NOW });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const operation = executor.executeAsync(CORRELATION, async (context) => {
      expect(context.occurredAt).toBe(NOW);
      expect(harness.commands).toEqual(['BEGIN IMMEDIATE']);
      await gate;
      return ok('committed');
    });
    await Promise.resolve();
    expect(harness.commands).toEqual(['BEGIN IMMEDIATE']);
    release();
    await expect(operation).resolves.toEqual(ok('committed'));
    expect(harness.commands).toEqual(['BEGIN IMMEDIATE', 'COMMIT']);
  });

  it('rolls back an application error and an exception without committing', async () => {
    const applicationFailure = createAppError({
      code: ERROR_CODES.RESOURCE_CONFLICT,
      category: 'conflict',
      message: 'forced application rollback',
      correlationId: CORRELATION
    });
    const first = databaseHarness();
    const firstExecutor = new SqliteTransactionExecutor(first.database, { now: () => NOW });
    await expect(firstExecutor.executeAsync(CORRELATION, async () => err(applicationFailure)))
      .resolves.toEqual(err(applicationFailure));
    expect(first.commands).toEqual(['BEGIN IMMEDIATE', 'ROLLBACK']);

    const second = databaseHarness();
    const secondExecutor = new SqliteTransactionExecutor(second.database, { now: () => NOW });
    const thrown = await secondExecutor.executeAsync(CORRELATION, async () => {
      throw new Error('forced asynchronous failure');
    });
    expect(thrown.ok).toBe(false);
    expect(second.commands).toEqual(['BEGIN IMMEDIATE', 'ROLLBACK']);
  });

  it('rejects overlapping sync or async use of the same connection without opening a nested transaction', async () => {
    const harness = databaseHarness();
    const executor = new SqliteTransactionExecutor(harness.database, { now: () => NOW });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const active = executor.executeAsync(CORRELATION, async () => {
      await gate;
      return ok(undefined);
    });
    await Promise.resolve();
    const overlappingSync = executor.execute(CORRELATION, () => ok(undefined));
    const overlappingAsync = await executor.executeAsync(CORRELATION, async () => ok(undefined));
    expect(overlappingSync.ok).toBe(false);
    expect(overlappingAsync.ok).toBe(false);
    expect(harness.commands).toEqual(['BEGIN IMMEDIATE']);
    release();
    await expect(active).resolves.toEqual(ok(undefined));
    expect(harness.commands).toEqual(['BEGIN IMMEDIATE', 'COMMIT']);
  });
});
