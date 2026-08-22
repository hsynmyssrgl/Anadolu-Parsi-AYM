import { describe, expect, it } from 'vitest';
import { asCorrelationId, ok, type CorrelationId } from '@ppt/core';
import type {
  EntityCatalogRepositoryPort,
  RepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';
import { EntityCatalogService } from '../src/main/entity-catalog-service.js';

const REQUEST_CORRELATION = asCorrelationId('ipc-entity-catalog-regression');

describe('EntityCatalogService correlation boundary', () => {
  it('keeps the active IPC correlation for people, event and lookup repository work', () => {
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
      listPeoplePage: (context: RepositoryExecutionContext) => {
        record(context);
        return ok([]);
      },
      listEventsPage: (context: RepositoryExecutionContext) => {
        record(context);
        return ok([]);
      },
      findPeopleByIds: (context: RepositoryExecutionContext) => {
        record(context);
        return ok([]);
      },
      findEventsByIds: (context: RepositoryExecutionContext) => {
        record(context);
        return ok([]);
      }
    } as unknown as EntityCatalogRepositoryPort;
    const service = new EntityCatalogService({
      transactionExecutor,
      repository,
      currentAccountId: () => 'account-regression',
      currentCorrelationId: () => REQUEST_CORRELATION,
      canReadEvent: () => true
    });

    service.listPeople();
    service.listEvents();
    service.lookup({ personIds: [], eventIds: [] });

    expect(executed).toEqual([
      REQUEST_CORRELATION,
      REQUEST_CORRELATION,
      REQUEST_CORRELATION
    ]);
    expect(repositoryContexts).toEqual([
      REQUEST_CORRELATION,
      REQUEST_CORRELATION,
      REQUEST_CORRELATION,
      REQUEST_CORRELATION
    ]);
  });
});
