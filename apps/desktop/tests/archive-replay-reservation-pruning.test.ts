import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  asCorrelationId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  type Clock
} from '@ppt/core';
import type {
  RepositoryExecutionContext,
  TransactionContext
} from '@ppt/repository-contracts';
import { SqlitePlatformPolicyTransactionRepository } from '@ppt/repositories';
import { SqliteFamilyDatabaseRuntime } from '../src/main/family-database-runtime.js';

const NOW = asIsoDateTime('2026-08-07T10:00:00.000Z');
const clock: Clock = Object.freeze({ now: () => NOW });
const directories: string[] = [];
const runtimes: SqliteFamilyDatabaseRuntime[] = [];

const context = (transaction: TransactionContext): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: {
    userId: asUserId('account-30v-pruning'),
    roles: ['family_admin'],
    personId: asPersonId('person-30v-pruning')
  },
  correlationId: transaction.correlationId,
  occurredAt: transaction.occurredAt
});

const mustValue = <T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown }): T => {
  if (!result.ok) throw new Error(`Unexpected repository failure: ${JSON.stringify(result.error)}`);
  return result.value;
};

const makeRuntime = (databasePath?: string): {
  readonly runtime: SqliteFamilyDatabaseRuntime;
  readonly repository: SqlitePlatformPolicyTransactionRepository;
  readonly databasePath: string;
} => {
  const directory = databasePath ? undefined : mkdtempSync(join(tmpdir(), 'ppt-30v-replay-pruning-'));
  if (directory) directories.push(directory);
  const resolvedPath = databasePath ?? join(directory!, 'family.db');
  const runtime = new SqliteFamilyDatabaseRuntime({
    databasePath: resolvedPath,
    applicationVersion: '30-v-vitest',
    clock,
    skipFileMigrationSafetyBackup: true,
    databaseConfig: { busyTimeoutMs: 5_000, journalMode: 'WAL', synchronous: 'FULL' }
  });
  runtimes.push(runtime);
  return { runtime, repository: new SqlitePlatformPolicyTransactionRepository(), databasePath: resolvedPath };
};

const reserve = (
  runtime: SqliteFamilyDatabaseRuntime,
  repository: SqlitePlatformPolicyTransactionRepository,
  nonce: string,
  reservedAtMs: number,
  expiresAtMs: number
) => mustValue(runtime.transactionExecutor.execute(
  asCorrelationId(`30-v-reserve-${nonce}`),
  (transaction) => repository.reserveReplayNonce(context(transaction), { nonce, reservedAtMs, expiresAtMs })
));

const prune = (
  runtime: SqliteFamilyDatabaseRuntime,
  repository: SqlitePlatformPolicyTransactionRepository,
  cutoffMs: number,
  limit: number
) => runtime.transactionExecutor.execute(
  asCorrelationId(`30-v-prune-${cutoffMs}-${limit}`),
  (transaction) => repository.pruneExpiredUnusedReplayReservations(context(transaction), { cutoffMs, limit })
);

const nonces = (runtime: SqliteFamilyDatabaseRuntime): string[] => (
  runtime.database.prepare(
    'SELECT nonce FROM platform_policy_replay_reservations ORDER BY nonce'
  ).all() as ReadonlyArray<{ readonly nonce: string }>
).map((row) => row.nonce);

afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('30-V expired unused replay reservation pruning', () => {
  it('prunes deterministic bounded batches and reports whether eligible rows remain', () => {
    const { runtime, repository } = makeRuntime();
    expect(reserve(runtime, repository, 'nonce-30v-a', 100, 1_000)).toBe(true);
    expect(reserve(runtime, repository, 'nonce-30v-b', 200, 2_000)).toBe(true);
    expect(reserve(runtime, repository, 'nonce-30v-c', 300, 5_000)).toBe(true);

    const first = mustValue(prune(runtime, repository, 3_000, 1));
    expect(first).toEqual({ cutoffMs: 3_000, prunedCount: 1, hasMore: true });
    expect(nonces(runtime)).toEqual(['nonce-30v-b', 'nonce-30v-c']);

    const second = mustValue(prune(runtime, repository, 3_000, 10));
    expect(second).toEqual({ cutoffMs: 3_000, prunedCount: 1, hasMore: false });
    expect(nonces(runtime)).toEqual(['nonce-30v-c']);
  });

  it('keeps the cutoff exclusive and blocks direct deletion of an unexpired row', () => {
    const { runtime, repository } = makeRuntime();
    expect(reserve(runtime, repository, 'nonce-30v-boundary', 100, 3_000)).toBe(true);
    expect(mustValue(prune(runtime, repository, 3_000, 10))).toEqual({
      cutoffMs: 3_000,
      prunedCount: 0,
      hasMore: false
    });
    expect(() => runtime.database.prepare(
      'DELETE FROM platform_policy_replay_reservations WHERE nonce=?'
    ).run('nonce-30v-boundary')).toThrow(/not expired and unused/u);
    expect(mustValue(prune(runtime, repository, 3_001, 10)).prunedCount).toBe(1);
  });

  it('rejects regressing cutoffs and invalid or unbounded batch sizes without deleting rows', () => {
    const { runtime, repository } = makeRuntime();
    expect(reserve(runtime, repository, 'nonce-30v-validation', 100, 1_000)).toBe(true);
    expect(mustValue(prune(runtime, repository, 2_000, 1)).prunedCount).toBe(1);
    expect(reserve(runtime, repository, 'nonce-30v-validation-2', 100, 1_500)).toBe(true);

    expect(prune(runtime, repository, 1_999, 10).ok).toBe(false);
    expect(prune(runtime, repository, 2_000, 0).ok).toBe(false);
    expect(prune(runtime, repository, 2_000, 501).ok).toBe(false);
    expect(() => runtime.database.prepare(`
      UPDATE platform_policy_replay_pruning_state
      SET cutoff_ms=1999,updated_at='2026-08-07T10:00:01.000Z'
      WHERE scope='archive'
    `).run()).toThrow(/cannot regress/u);
    expect(nonces(runtime)).toEqual(['nonce-30v-validation-2']);
  });

  it('persists the monotonic cutoff across SQLite close and reopen', () => {
    const first = makeRuntime();
    expect(reserve(first.runtime, first.repository, 'nonce-30v-restart-a', 100, 1_000)).toBe(true);
    expect(mustValue(prune(first.runtime, first.repository, 2_000, 10)).prunedCount).toBe(1);
    first.runtime.close();
    runtimes.splice(runtimes.indexOf(first.runtime), 1);

    const reopened = makeRuntime(first.databasePath);
    expect(prune(reopened.runtime, reopened.repository, 1_999, 10).ok).toBe(false);
    expect(reserve(reopened.runtime, reopened.repository, 'nonce-30v-restart-b', 2_000, 3_000)).toBe(true);
    expect(mustValue(prune(reopened.runtime, reopened.repository, 3_001, 10))).toEqual({
      cutoffMs: 3_001,
      prunedCount: 1,
      hasMore: false
    });
  });
});
