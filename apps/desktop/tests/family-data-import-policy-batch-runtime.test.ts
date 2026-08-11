import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ERROR_CODES,
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import type {
  DataLifecycleApplicationContext,
  LocationApplicationContext,
  TimelineApplicationContext
} from '@ppt/application';
import type {
  FamilyDataImportExistingData,
  PolicyAuthorizedRepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';
import { FamilyDataImportService } from '../src/main/family-data-import-service.js';
import {
  RepositoryBackedFamilyDataImportPolicyBatchRunner,
  type FamilyDataImportPolicyBatchRequest,
  type FamilyDataImportPolicyBatchScope,
  type FamilyDataImportPolicyBatchRunnerPort
} from '../src/main/family-data-import-policy-batch-runner.js';
import type {
  GovernedLocationPolicyAuthorizationLease,
  RepositoryBackedLocationPolicyTransactionRunner
} from '../src/main/location-application-adapter.js';
import type {
  GovernedTimelinePolicyAuthorizationLease,
  RepositoryBackedTimelinePolicyTransactionRunner
} from '../src/main/timeline-application-adapter.js';

const NOW = asIsoDateTime('2026-08-10T08:00:00.000Z');
const FAMILY_ID = asFamilyId('family-31-c');
const ACCOUNT_ID = asUserId('account-31-c');
const PERSON_ID = asPersonId('person-31-c');
const CORRELATION_ID = asCorrelationId('family-import-31-c');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const locationContext = (correlationId = asCorrelationId('family-import-31-c-location')): LocationApplicationContext => ({
  familyId: FAMILY_ID,
  actor: { userId: ACCOUNT_ID, role: 'family_admin', personId: PERSON_ID },
  correlationId
});

const timelineContext = (correlationId = asCorrelationId('family-import-31-c-event')): TimelineApplicationContext => ({
  familyId: FAMILY_ID,
  actor: { userId: ACCOUNT_ID, roles: ['family_admin'], personId: PERSON_ID },
  correlationId
});

const governedRepository = (
  transaction: TransactionContext['transaction'],
  correlationId: ReturnType<typeof asCorrelationId>,
  label: string
): PolicyAuthorizedRepositoryExecutionContext => ({
  transaction,
  correlationId,
  occurredAt: NOW,
  actor: { userId: ACCOUNT_ID, roles: ['family_admin'], personId: PERSON_ID },
  policyAuthorization: { receiptRecord: { receipt: { label } } } as never
});

const requests = (): readonly FamilyDataImportPolicyBatchRequest[] => [
  {
    key: 'location:location-created',
    kind: 'location',
    context: locationContext(),
    intent: {
      action: 'create',
      capability: 'family.write',
      resourceType: 'location',
      resourceId: 'location-created',
      purpose: 'general',
      ownerPersonId: PERSON_ID,
      sensitivity: 'highly_sensitive'
    }
  },
  {
    key: 'event:event-created',
    kind: 'event',
    context: timelineContext(),
    intent: {
      action: 'create',
      capability: 'family.write',
      resourceType: 'event',
      resourceId: 'event-created',
      purpose: 'general',
      ownerPersonId: PERSON_ID,
      targetSensitivity: 'personal',
      sourceResourceMode: 'replace'
    }
  }
];

const dependentRequests = (): readonly FamilyDataImportPolicyBatchRequest[] => [
  {
    key: 'location:location-created',
    kind: 'location',
    context: locationContext(asCorrelationId('family-import-31-f-location-create')),
    intent: {
      action: 'create',
      capability: 'family.write',
      resourceType: 'location',
      resourceId: 'location-created',
      purpose: 'general',
      ownerPersonId: PERSON_ID,
      sensitivity: 'highly_sensitive'
    }
  },
  {
    key: 'event-location-read:event-created',
    kind: 'created-location-read',
    createKey: 'location:location-created',
    context: locationContext(asCorrelationId('family-import-31-f-location-read')),
    intent: {
      action: 'read',
      capability: 'location.read',
      resourceType: 'location',
      resourceId: 'location-created',
      purpose: 'general',
      sensitivity: 'highly_sensitive'
    }
  },
  {
    key: 'event:event-created',
    kind: 'event',
    context: timelineContext(asCorrelationId('family-import-31-f-event-create')),
    intent: {
      action: 'create',
      capability: 'family.write',
      resourceType: 'event',
      resourceId: 'event-created',
      purpose: 'general',
      ownerPersonId: PERSON_ID,
      targetSensitivity: 'personal',
      sourceResourceId: 'location-created',
      sourceResourceMode: 'replace'
    }
  }
];

describe('31-C family import multi-policy receipt batch', () => {
  it('keeps the 15-minute preview lease content-free and reconstructs source payload only during apply', () => {
    const source = readFileSync(new URL('../src/main/family-data-import-service.ts', import.meta.url), 'utf8');
    const lease = /interface CachedPreviewLease \{(?<body>[\s\S]*?)\n\}/u.exec(source)?.groups?.body ?? '';

    expect(lease).toContain('sourceSha256');
    expect(lease).toContain('planDigest');
    expect(lease).not.toMatch(/\b(?:preview|sourceText|document|plan)\s*:/u);
    expect(source).toMatch(/const sourceBuffer = readFileSync\(cached\.sourcePath\);[\s\S]*?parseSourceDocument\([\s\S]*?decodeImportSource\(sourceBuffer\)/u);
  });

  it('authorizes every row first, establishes every receipt in one transaction, then runs the import operation', async () => {
    const trace: string[] = [];
    const transaction = { marker: 'single-sqlite-transaction' } as never;
    const transactionExecutor = {
      execute: <T>(_correlationId: unknown, operation: (scope: TransactionContext) => Result<T, AppError>) => {
        trace.push('transaction');
        return operation({ transaction, occurredAt: NOW });
      }
    } as TransactionExecutor;
    const locationRunner = {
      authorize: async <T>(
        context: LocationApplicationContext,
        _intent: unknown,
        operation: (lease: GovernedLocationPolicyAuthorizationLease) => Result<T, AppError> | Promise<Result<T, AppError>>
      ): Promise<Result<T, AppError>> => {
        trace.push('authorize:location');
        return operation({
          establish: (scope) => {
            trace.push('establish:location');
            return ok({
              repository: governedRepository(scope.transaction, context.correlationId, 'location'),
              occurredAt: scope.occurredAt,
              authorization: {} as never
            });
          }
        });
      }
    } as unknown as RepositoryBackedLocationPolicyTransactionRunner;
    const timelineRunner = {
      authorize: async <T>(
        context: TimelineApplicationContext,
        _intent: unknown,
        operation: (lease: GovernedTimelinePolicyAuthorizationLease) => Result<T, AppError> | Promise<Result<T, AppError>>
      ): Promise<Result<T, AppError>> => {
        trace.push('authorize:event');
        return operation({
          establish: (scope) => {
            trace.push('establish:event');
            return ok({
              repository: governedRepository(scope.transaction, context.correlationId, 'event'),
              occurredAt: scope.occurredAt,
              authorization: {} as never
            });
          }
        });
      }
    } as unknown as RepositoryBackedTimelinePolicyTransactionRunner;
    const runner = new RepositoryBackedFamilyDataImportPolicyBatchRunner({ transactionExecutor, locationRunner, timelineRunner });

    const result = await runner.execute(CORRELATION_ID, requests(), ({ transaction: scope, repositories }) => {
      trace.push('operation');
      expect(scope.transaction).toBe(transaction);
      expect(repositories.get('location:location-created')?.transaction).toBe(transaction);
      expect(repositories.get('event:event-created')?.transaction).toBe(transaction);
      expect(repositories.get('location:location-created')?.correlationId).not.toBe(
        repositories.get('event:event-created')?.correlationId
      );
      return ok('applied');
    });

    expect(result).toEqual(ok('applied'));
    expect(trace).toEqual([
      'authorize:location',
      'authorize:event',
      'transaction',
      'establish:location',
      'establish:event',
      'operation'
    ]);
  });

  it('fails closed before the import operation when any receipt cannot be established', async () => {
    const transaction = { marker: 'rollback-transaction' } as never;
    const operation = vi.fn(() => ok('must-not-run'));
    const transactionExecutor = {
      execute: <T>(_correlationId: unknown, callback: (scope: TransactionContext) => Result<T, AppError>) =>
        callback({ transaction, occurredAt: NOW })
    } as TransactionExecutor;
    const locationRunner = {
      authorize: async <T>(
        context: LocationApplicationContext,
        _intent: unknown,
        callback: (lease: GovernedLocationPolicyAuthorizationLease) => Result<T, AppError> | Promise<Result<T, AppError>>
      ) => callback({
        establish: (scope) => ok({
          repository: governedRepository(scope.transaction, context.correlationId, 'location'),
          occurredAt: scope.occurredAt,
          authorization: {} as never
        })
      })
    } as unknown as RepositoryBackedLocationPolicyTransactionRunner;
    const timelineRunner = {
      authorize: async <T>(
        _context: TimelineApplicationContext,
        _intent: unknown,
        callback: (lease: GovernedTimelinePolicyAuthorizationLease) => Result<T, AppError> | Promise<Result<T, AppError>>
      ) => callback({
        establish: () => err(createAppError({
          code: ERROR_CODES.AUTHORIZATION_DENIED,
          message: 'receipt revalidation denied',
          category: 'authorization',
          correlationId: CORRELATION_ID
        }))
      })
    } as unknown as RepositoryBackedTimelinePolicyTransactionRunner;
    const runner = new RepositoryBackedFamilyDataImportPolicyBatchRunner({ transactionExecutor, locationRunner, timelineRunner });

    const result = await runner.execute(CORRELATION_ID, requests(), operation);

    expect(result.ok).toBe(false);
    expect(operation).not.toHaveBeenCalled();
  });

  it('binds a created-location read to the exact prior create receipt and validates it before commit', async () => {
    const trace: string[] = [];
    const transaction = { marker: '31-f-dependent-read-transaction' } as never;
    const createReceiptHash = 'a'.repeat(64);
    let dependentIntent: Readonly<Record<string, unknown>> | undefined;
    const transactionExecutor = {
      execute: <T>(_correlationId: unknown, operation: (scope: TransactionContext) => Result<T, AppError>) => {
        trace.push('transaction');
        return operation({ transaction, occurredAt: NOW });
      }
    } as TransactionExecutor;
    const locationRunner = {
      authorize: async <T>(
        context: LocationApplicationContext,
        intent: Readonly<Record<string, unknown>>,
        operation: (lease: GovernedLocationPolicyAuthorizationLease) => Result<T, AppError> | Promise<Result<T, AppError>>
      ): Promise<Result<T, AppError>> => {
        const action = String(intent.action);
        trace.push(`authorize:location:${action}`);
        if (action === 'read') dependentIntent = intent;
        return operation({
          receiptHash: action === 'create' ? createReceiptHash : 'b'.repeat(64),
          establish: (scope) => {
            trace.push(`establish:location:${action}`);
            return ok({
              repository: governedRepository(scope.transaction, context.correlationId, `location-${action}`),
              occurredAt: scope.occurredAt,
              authorization: {} as never
            });
          },
          complete: () => {
            trace.push(`complete:location:${action}`);
            return ok(undefined);
          }
        });
      }
    } as unknown as RepositoryBackedLocationPolicyTransactionRunner;
    const timelineRunner = {
      authorize: async <T>(
        context: TimelineApplicationContext,
        _intent: unknown,
        operation: (lease: GovernedTimelinePolicyAuthorizationLease) => Result<T, AppError> | Promise<Result<T, AppError>>
      ): Promise<Result<T, AppError>> => {
        trace.push('authorize:event');
        return operation({
          establish: (scope) => {
            trace.push('establish:event');
            return ok({
              repository: governedRepository(scope.transaction, context.correlationId, 'event'),
              occurredAt: scope.occurredAt,
              authorization: {} as never
            });
          }
        });
      }
    } as unknown as RepositoryBackedTimelinePolicyTransactionRunner;
    const runner = new RepositoryBackedFamilyDataImportPolicyBatchRunner({ transactionExecutor, locationRunner, timelineRunner });

    const result = await runner.execute(CORRELATION_ID, dependentRequests(), ({ repositories }) => {
      trace.push('operation');
      expect(repositories.size).toBe(3);
      return ok('applied');
    });

    expect(result).toEqual(ok('applied'));
    expect(dependentIntent).toMatchObject({
      action: 'read',
      resourceId: 'location-created',
      anticipatedCreate: { ownerPersonId: PERSON_ID, receiptHash: createReceiptHash }
    });
    expect(trace).toEqual([
      'authorize:location:create',
      'authorize:location:read',
      'authorize:event',
      'transaction',
      'establish:location:create',
      'establish:location:read',
      'establish:event',
      'operation',
      'complete:location:read',
      'complete:location:create'
    ]);
  });

  it('returns a failed transaction when the created-location completion fence does not match', async () => {
    const transaction = { marker: '31-f-dependent-read-rollback' } as never;
    let rollback = false;
    const transactionExecutor = {
      execute: <T>(_correlationId: unknown, operation: (scope: TransactionContext) => Result<T, AppError>) => {
        const result = operation({ transaction, occurredAt: NOW });
        rollback = !result.ok;
        return result;
      }
    } as TransactionExecutor;
    const locationRunner = {
      authorize: async <T>(
        context: LocationApplicationContext,
        intent: Readonly<Record<string, unknown>>,
        operation: (lease: GovernedLocationPolicyAuthorizationLease) => Result<T, AppError> | Promise<Result<T, AppError>>
      ): Promise<Result<T, AppError>> => operation({
        receiptHash: String(intent.action) === 'create' ? 'c'.repeat(64) : 'd'.repeat(64),
        establish: (scope) => ok({
          repository: governedRepository(scope.transaction, context.correlationId, String(intent.action)),
          occurredAt: scope.occurredAt,
          authorization: {} as never
        }),
        complete: () => String(intent.action) === 'read'
          ? err(createAppError({
              code: ERROR_CODES.AUTHORIZATION_DENIED,
              message: 'created row receipt mismatch',
              category: 'security',
              correlationId: CORRELATION_ID
            }))
          : ok(undefined)
      })
    } as unknown as RepositoryBackedLocationPolicyTransactionRunner;
    const timelineRunner = {
      authorize: async <T>(
        context: TimelineApplicationContext,
        _intent: unknown,
        operation: (lease: GovernedTimelinePolicyAuthorizationLease) => Result<T, AppError> | Promise<Result<T, AppError>>
      ): Promise<Result<T, AppError>> => operation({
        establish: (scope) => ok({
          repository: governedRepository(scope.transaction, context.correlationId, 'event'),
          occurredAt: scope.occurredAt,
          authorization: {} as never
        })
      })
    } as unknown as RepositoryBackedTimelinePolicyTransactionRunner;
    const operation = vi.fn(() => ok('must-roll-back'));
    const runner = new RepositoryBackedFamilyDataImportPolicyBatchRunner({ transactionExecutor, locationRunner, timelineRunner });

    const result = await runner.execute(CORRELATION_ID, dependentRequests(), operation);

    expect(operation).toHaveBeenCalledOnce();
    expect(result.ok).toBe(false);
    expect(rollback).toBe(true);
  });

  it('rejects a created-location read before authorization when its exact create dependency is absent', async () => {
    const transactionExecutor = { execute: vi.fn() } as unknown as TransactionExecutor;
    const locationRunner = { authorize: vi.fn() } as unknown as RepositoryBackedLocationPolicyTransactionRunner;
    const timelineRunner = { authorize: vi.fn() } as unknown as RepositoryBackedTimelinePolicyTransactionRunner;
    const runner = new RepositoryBackedFamilyDataImportPolicyBatchRunner({ transactionExecutor, locationRunner, timelineRunner });
    const dependentRead = dependentRequests()[1]!;

    const result = await runner.execute(CORRELATION_ID, [dependentRead], vi.fn(() => ok('must-not-run')));

    expect(result.ok).toBe(false);
    expect(locationRunner.authorize).not.toHaveBeenCalled();
    expect(transactionExecutor.execute).not.toHaveBeenCalled();
  });

  it('imports created locations and locationless events with distinct governed repositories', async () => {
    const directory = mkdtempSync(join(tmpdir(), '31-c-family-import-'));
    temporaryDirectories.push(directory);
    const sourcePath = join(directory, 'family.json');
    writeFileSync(sourcePath, JSON.stringify({
      schemaVersion: 1,
      exportId: 'export-31-c',
      createdAt: NOW,
      family: { name: 'Aile' },
      people: [],
      relations: [],
      locations: [{ id: 'source-location', label: 'Yeni ev', address: 'Gizli adres', kind: 'residence' }],
      events: [{
        id: 'source-event',
        kind: 'important_day',
        title: 'Konumsuz etkinlik',
        startAt: '2026-08-11T08:00:00.000Z',
        visibility: 'family',
        participantPersonIds: [],
        aiProcessingAllowed: false,
        recurrence: 'none',
        reminderDays: [1]
      }]
    }), 'utf8');

    const transaction = { marker: 'service-single-transaction' } as never;
    const insertedLocations: Array<{ context: PolicyAuthorizedRepositoryExecutionContext; id: string }> = [];
    const insertedEvents: Array<{ context: PolicyAuthorizedRepositoryExecutionContext; id: string }> = [];
    const trackedTypes: string[] = [];
    let loadExistingCalls = 0;
    let existingData: FamilyDataImportExistingData = { people: [], relations: [], locations: [], events: [] };
    let capturedRequests: readonly FamilyDataImportPolicyBatchRequest[] = [];
    const transactionExecutor = {
      execute: <T>(_correlationId: unknown, operation: (scope: TransactionContext) => Result<T, AppError>) =>
        operation({ transaction, occurredAt: NOW })
    } as TransactionExecutor;
    const policyBatchRunner: FamilyDataImportPolicyBatchRunnerPort = {
      execute: async <T>(
        _correlationId: unknown,
        batchRequests: readonly FamilyDataImportPolicyBatchRequest[],
        operation: (scope: FamilyDataImportPolicyBatchScope) => Result<T, AppError>
      ): Promise<Result<T, AppError>> => {
        capturedRequests = batchRequests;
        const repositories = new Map<string, PolicyAuthorizedRepositoryExecutionContext>();
        for (const request of batchRequests) {
          repositories.set(request.key, governedRepository(transaction, request.context.correlationId, request.key));
        }
        return operation({ transaction: { transaction, occurredAt: NOW }, repositories }) as Result<T, AppError>;
      }
    } as FamilyDataImportPolicyBatchRunnerPort;
    const applicationContext = (): DataLifecycleApplicationContext => ({
      familyId: FAMILY_ID,
      actor: { userId: ACCOUNT_ID, role: 'family_admin', personId: PERSON_ID },
      correlationId: CORRELATION_ID
    });
    const service = new FamilyDataImportService({
      transactionExecutor,
      accountRepository: { findById: () => ok({ id: ACCOUNT_ID, role: 'family_admin', status: 'active', personId: PERSON_ID, startsAt: NOW }) } as never,
      permissionRepository: { listActiveForSubject: () => ok([]) } as never,
      importRepository: {
        loadExisting: () => (loadExistingCalls += 1, ok(existingData)),
        findActiveSource: () => ok(null),
        insertBatch: () => ok(undefined),
        insertItem: (_context: unknown, item: { entityType: string }) => (trackedTypes.push(item.entityType), ok(undefined))
      } as never,
      familyRepository: { findById: () => ok({ id: FAMILY_ID, name: 'Aile' }) } as never,
      personRepository: { insert: () => ok(undefined) } as never,
      relationRepository: { insert: () => ok(undefined) } as never,
      locationRepository: {
        insert: (context: PolicyAuthorizedRepositoryExecutionContext, record: { id: string }) =>
          (insertedLocations.push({ context, id: record.id }), ok(undefined))
      } as never,
      timelineRepository: {
        insert: (context: PolicyAuthorizedRepositoryExecutionContext, record: { id: string }) =>
          (insertedEvents.push({ context, id: record.id }), ok(undefined))
      } as never,
      auditRepository: { append: () => ok('audit-hash') } as never,
      strongAuthentication: { verify: () => ok(undefined) } as never,
      applicationContext,
      policyBatchRunner
    });

    const stalePreview = service.preview(sourcePath);
    existingData = {
      people: [],
      relations: [],
      locations: [{ id: 'location-created-after-preview', label: 'Yeni ev', kind: 'residence' }],
      events: []
    };
    await expect(service.apply({ previewId: stalePreview.previewId, password: 'correct horse battery staple' }))
      .rejects.toThrow('Aile verileri ön izlemeden sonra değişti');
    expect(capturedRequests).toEqual([]);

    existingData = { people: [], relations: [], locations: [], events: [] };
    const preview = service.preview(sourcePath);
    expect(preview.valid).toBe(true);
    const applied = await service.apply({ previewId: preview.previewId, password: 'correct horse battery staple' });

    expect(applied.status).toBe('applied');
    expect(capturedRequests.map((request) => request.kind)).toEqual(['location', 'event']);
    expect(new Set(capturedRequests.map((request) => request.context.correlationId)).size).toBe(2);
    expect(insertedLocations).toHaveLength(1);
    expect(insertedEvents).toHaveLength(1);
    expect(insertedLocations[0]?.context.correlationId).toBe(
      capturedRequests.find((request) => request.kind === 'location')?.context.correlationId
    );
    expect(insertedEvents[0]?.context.correlationId).toBe(
      capturedRequests.find((request) => request.kind === 'event')?.context.correlationId
    );
    expect(insertedLocations[0]?.context.transaction).toBe(transaction);
    expect(insertedEvents[0]?.context.transaction).toBe(transaction);
    expect(insertedLocations[0]?.context.correlationId).not.toBe(insertedEvents[0]?.context.correlationId);
    expect(trackedTypes).toEqual(['location', 'event']);
    expect(loadExistingCalls).toBe(5);
  });
});
