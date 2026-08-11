import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import type { DataLifecycleApplicationContext } from '@ppt/application';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';
import { computePlatformPolicyReceiptHash } from '@ppt/repositories';
import { FamilyDataImportService } from '../src/main/family-data-import-service.js';
import type {
  FamilyDataImportPolicyBatchRequest,
  FamilyDataImportPolicyBatchRunnerPort,
  FamilyDataImportPolicyBatchScope
} from '../src/main/family-data-import-policy-batch-runner.js';

const NOW = asIsoDateTime('2026-08-10T10:00:00.000Z');
const FAMILY_ID = asFamilyId('family-31-d');
const ACCOUNT_ID = asUserId('account-31-d');
const PERSON_ID = asPersonId('person-31-d');
const CORRELATION_ID = asCorrelationId('family-import-31-d');
const TARGET_LOCATION_ID = 'existing-location-31-d';
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const repositoryContext = (
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

const sourceDocument = (locationLabel: string) => ({
  schemaVersion: 1,
  exportId: `export-31-d-${locationLabel}`,
  createdAt: NOW,
  family: { name: 'Aile' },
  people: [],
  relations: [],
  locations: [{ id: 'source-location', label: locationLabel, kind: 'residence' }],
  events: [{
    id: 'source-event',
    kind: 'important_day',
    title: 'Konumlu etkinlik',
    startAt: '2026-08-12T10:00:00.000Z',
    locationId: 'source-location',
    locationLabel: 'Kaynak dosyadaki güvenilmez etiket',
    visibility: 'family',
    participantPersonIds: [],
    aiProcessingAllowed: false,
    recurrence: 'none',
    reminderDays: [1]
  }]
});

describe('31-D family import reused-location exact read receipt', () => {
  it('binds an exact location.read receipt and authoritative location snapshot to the imported event in one transaction', async () => {
    const directory = mkdtempSync(join(tmpdir(), '31-d-family-import-'));
    temporaryDirectories.push(directory);
    const sourcePath = join(directory, 'family.json');
    writeFileSync(sourcePath, JSON.stringify(sourceDocument('Mevcut ev')), 'utf8');

    const transaction = { marker: '31-d-single-transaction' } as never;
    const existingLocation = {
      id: TARGET_LOCATION_ID,
      familyId: FAMILY_ID,
      ownerPersonId: PERSON_ID,
      label: 'Mevcut ev',
      kind: 'residence' as const,
      createdAt: NOW
    };
    let capturedRequests: readonly FamilyDataImportPolicyBatchRequest[] = [];
    let locationReadContext: PolicyAuthorizedRepositoryExecutionContext | undefined;
    let eventWriteContext: PolicyAuthorizedRepositoryExecutionContext | undefined;
    let insertedEvent: Readonly<Record<string, unknown>> | undefined;
    const transactionExecutor = {
      execute: <T>(_correlationId: unknown, operation: (scope: TransactionContext) => Result<T, AppError>) =>
        operation({ transaction, occurredAt: NOW })
    } as TransactionExecutor;
    const policyBatchRunner: FamilyDataImportPolicyBatchRunnerPort = {
      execute: async <T>(
        _correlationId: unknown,
        requests: readonly FamilyDataImportPolicyBatchRequest[],
        operation: (scope: FamilyDataImportPolicyBatchScope) => Result<T, AppError>
      ): Promise<Result<T, AppError>> => {
        capturedRequests = requests;
        const repositories = new Map<string, PolicyAuthorizedRepositoryExecutionContext>();
        for (const request of requests) {
          repositories.set(request.key, repositoryContext(transaction, request.context.correlationId, request.key));
        }
        return operation({ transaction: { transaction, occurredAt: NOW }, repositories });
      }
    };
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
        loadExisting: () => ok({ people: [], relations: [], locations: [{ id: TARGET_LOCATION_ID, label: 'Mevcut ev', kind: 'residence' }], events: [] }),
        findActiveSource: () => ok(null),
        insertBatch: () => ok(undefined),
        insertItem: () => ok(undefined)
      } as never,
      familyRepository: { findById: () => ok({ id: FAMILY_ID, name: 'Aile' }) } as never,
      personRepository: { insert: () => ok(undefined) } as never,
      relationRepository: { insert: () => ok(undefined) } as never,
      locationRepository: {
        findById: (context: PolicyAuthorizedRepositoryExecutionContext, familyId: string, locationId: string) => {
          locationReadContext = context;
          return ok(familyId === FAMILY_ID && locationId === TARGET_LOCATION_ID ? existingLocation : null);
        },
        insert: vi.fn()
      } as never,
      timelineRepository: {
        insert: (context: PolicyAuthorizedRepositoryExecutionContext, record: Readonly<Record<string, unknown>>) => {
          eventWriteContext = context;
          insertedEvent = record;
          return ok(undefined);
        }
      } as never,
      auditRepository: { append: () => ok('audit-hash') } as never,
      strongAuthentication: { verify: () => ok(undefined) } as never,
      applicationContext,
      policyBatchRunner
    });

    const preview = service.preview(sourcePath);
    expect(preview.valid).toBe(true);
    await service.apply({ previewId: preview.previewId, password: 'correct horse battery staple' });

    expect(capturedRequests.map((request) => request.key)).toEqual([
      expect.stringMatching(/^event-location-read:/u),
      expect.stringMatching(/^event:/u)
    ]);
    expect(capturedRequests[0]).toMatchObject({
      kind: 'location',
      intent: { action: 'read', capability: 'location.read', resourceType: 'location', resourceId: TARGET_LOCATION_ID }
    });
    expect(capturedRequests[1]).toMatchObject({
      kind: 'event',
      intent: { action: 'create', capability: 'family.write', resourceType: 'event', sourceResourceId: TARGET_LOCATION_ID }
    });
    expect(new Set(capturedRequests.map((request) => request.context.correlationId)).size).toBe(2);
    expect(locationReadContext?.transaction).toBe(transaction);
    expect(eventWriteContext?.transaction).toBe(transaction);
    expect(insertedEvent).toMatchObject({ locationId: TARGET_LOCATION_ID, locationLabel: 'Mevcut ev' });
    expect(insertedEvent?.sourceLocationReceiptHash).toBe(
      computePlatformPolicyReceiptHash(locationReadContext!.policyAuthorization.receiptRecord.receipt)
    );
  });

  it('binds a newly-created import location to its dependent exact read and event in one transaction', async () => {
    const directory = mkdtempSync(join(tmpdir(), '31-d-new-location-'));
    temporaryDirectories.push(directory);
    const sourcePath = join(directory, 'family.json');
    writeFileSync(sourcePath, JSON.stringify(sourceDocument('Yeni ev')), 'utf8');
    const transaction = { marker: '31-f-created-location-single-transaction' } as never;
    const locations = new Map<string, Readonly<Record<string, unknown>>>();
    let capturedRequests: readonly FamilyDataImportPolicyBatchRequest[] = [];
    let locationReadContext: PolicyAuthorizedRepositoryExecutionContext | undefined;
    let eventWriteContext: PolicyAuthorizedRepositoryExecutionContext | undefined;
    let insertedEvent: Readonly<Record<string, unknown>> | undefined;
    const transactionExecutor = {
      execute: <T>(_correlationId: unknown, operation: (scope: TransactionContext) => Result<T, AppError>) =>
        operation({ transaction, occurredAt: NOW })
    } as TransactionExecutor;
    const policyBatchRunner: FamilyDataImportPolicyBatchRunnerPort = {
      execute: async <T>(
        _correlationId: unknown,
        requests: readonly FamilyDataImportPolicyBatchRequest[],
        operation: (scope: FamilyDataImportPolicyBatchScope) => Result<T, AppError>
      ): Promise<Result<T, AppError>> => {
        capturedRequests = requests;
        const repositories = new Map<string, PolicyAuthorizedRepositoryExecutionContext>();
        for (const request of requests) {
          repositories.set(request.key, repositoryContext(transaction, request.context.correlationId, request.key));
        }
        return operation({ transaction: { transaction, occurredAt: NOW }, repositories });
      }
    };
    const service = new FamilyDataImportService({
      transactionExecutor,
      accountRepository: { findById: () => ok({ id: ACCOUNT_ID, role: 'family_admin', status: 'active', personId: PERSON_ID, startsAt: NOW }) } as never,
      permissionRepository: { listActiveForSubject: () => ok([]) } as never,
      importRepository: {
        loadExisting: () => ok({ people: [], relations: [], locations: [], events: [] }),
        findActiveSource: () => ok(null),
        insertBatch: () => ok(undefined),
        insertItem: () => ok(undefined)
      } as never,
      familyRepository: { findById: () => ok({ id: FAMILY_ID, name: 'Aile' }) } as never,
      personRepository: { insert: () => ok(undefined) } as never,
      relationRepository: { insert: () => ok(undefined) } as never,
      locationRepository: {
        insert: (_context: PolicyAuthorizedRepositoryExecutionContext, record: Readonly<Record<string, unknown>>) => {
          locations.set(String(record.id), record);
          return ok(undefined);
        },
        findById: (context: PolicyAuthorizedRepositoryExecutionContext, familyId: string, locationId: string) => {
          locationReadContext = context;
          const location = locations.get(locationId);
          return ok(location?.familyId === familyId ? location : null);
        }
      } as never,
      timelineRepository: {
        insert: (context: PolicyAuthorizedRepositoryExecutionContext, record: Readonly<Record<string, unknown>>) => {
          eventWriteContext = context;
          insertedEvent = record;
          return ok(undefined);
        }
      } as never,
      auditRepository: { append: () => ok('audit-hash') } as never,
      strongAuthentication: { verify: () => ok(undefined) } as never,
      applicationContext: () => ({ familyId: FAMILY_ID, actor: { userId: ACCOUNT_ID, role: 'family_admin', personId: PERSON_ID }, correlationId: CORRELATION_ID }),
      policyBatchRunner
    });

    const preview = service.preview(sourcePath);
    expect(preview.valid).toBe(true);
    await service.apply({ previewId: preview.previewId, password: 'correct horse battery staple' });

    expect(capturedRequests.map((request) => request.kind)).toEqual([
      'location',
      'created-location-read',
      'event'
    ]);
    const createRequest = capturedRequests[0];
    const dependentRead = capturedRequests[1];
    expect(createRequest).toMatchObject({
      kind: 'location',
      intent: { action: 'create', capability: 'family.write', resourceType: 'location' }
    });
    expect(dependentRead).toMatchObject({
      kind: 'created-location-read',
      createKey: createRequest?.key,
      intent: {
        action: 'read',
        capability: 'location.read',
        resourceType: 'location',
        resourceId: createRequest?.intent.resourceId
      }
    });
    expect(capturedRequests[2]).toMatchObject({
      kind: 'event',
      intent: { action: 'create', capability: 'family.write', sourceResourceId: createRequest?.intent.resourceId }
    });
    expect(locationReadContext?.transaction).toBe(transaction);
    expect(eventWriteContext?.transaction).toBe(transaction);
    expect(insertedEvent).toMatchObject({
      locationId: createRequest?.intent.resourceId,
      locationLabel: 'Yeni ev'
    });
    expect(insertedEvent?.sourceLocationReceiptHash).toBe(
      computePlatformPolicyReceiptHash(locationReadContext!.policyAuthorization.receiptRecord.receipt)
    );
  });
});
