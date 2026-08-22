import { describe, expect, it } from 'vitest';
import { asCorrelationId, ok, type CorrelationId } from '@ppt/core';
import type {
  LargeFamilyReadModelRepositoryPort,
  RepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';
import { LargeFamilyReadModelService } from '../src/main/large-family-read-model-service.js';

const REQUEST_CORRELATION = asCorrelationId('ipc-large-family-read-model-regression');

describe('LargeFamilyReadModelService correlation boundary', () => {
  it('keeps the active IPC correlation for tree and archive repository work', () => {
    const executed: CorrelationId[] = [];
    const repositoryContexts: CorrelationId[] = [];
    const transactionExecutor = {
      execute: <TValue>(
        correlationId: CorrelationId,
        operation: (context: TransactionContext) => ReturnType<typeof ok<TValue>>
      ) => {
        executed.push(correlationId);
        return operation({
          transaction: {} as TransactionContext['transaction'],
          correlationId,
          occurredAt: '2026-08-22T00:00:00.000Z'
        } as TransactionContext);
      }
    } as unknown as TransactionExecutor;
    const record = (context: RepositoryExecutionContext): void => {
      repositoryContexts.push(context.correlationId);
    };
    const repository = {
      listTreePage: (context: RepositoryExecutionContext) => {
        record(context);
        return ok([]);
      },
      listArchivePage: (context: RepositoryExecutionContext) => {
        record(context);
        return ok([]);
      }
    } as unknown as LargeFamilyReadModelRepositoryPort;
    const service = new LargeFamilyReadModelService({
      transactionExecutor,
      repository,
      locationRepository: {} as never,
      locationPolicyTransactionRunner: {} as never,
      locationApplicationContext: () => { throw new Error('not used'); },
      currentAccountId: () => 'account-regression',
      currentCorrelationId: () => REQUEST_CORRELATION,
      canReadEvent: () => true,
      canReadArchiveItem: () => true
    });

    service.listTreePage();
    service.listArchivePage();

    expect(executed).toEqual([REQUEST_CORRELATION, REQUEST_CORRELATION]);
    expect(repositoryContexts).toEqual([REQUEST_CORRELATION, REQUEST_CORRELATION]);
  });
});
