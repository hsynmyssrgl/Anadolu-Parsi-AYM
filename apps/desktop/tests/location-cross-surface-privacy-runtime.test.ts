import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ERROR_CODES,
  asCorrelationId,
  asEventId,
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
import {
  CreateImportantDayUseCase,
  SeedDefaultFamilyUseCase,
  type DataLifecycleApplicationContext,
  type LocationApplicationContext,
  type LocationPolicyIntent,
  type TimelineApplicationContext,
  type TimelineEventRecord
} from '@ppt/application';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';
import {
  SqliteDashboardRepository,
  SqliteFamilyDataImportRepository
} from '@ppt/repositories';
import {
  RepositoryBackedLocationPolicyTransactionRunner
} from '../src/main/location-application-adapter.js';
import {
  RepositoryBackedTimelineApplicationUnitOfWork,
  RepositoryBackedTimelinePolicyTransactionRunner,
  RepositoryBackedTimelineQueryPort,
  type RepositoryBackedTimelineApplicationDependencies
} from '../src/main/timeline-application-adapter.js';
import {
  RepositoryBackedDashboardQueryPort
} from '../src/main/dashboard-application-adapter.js';
import { FamilyDataImportService } from '../src/main/family-data-import-service.js';

const NOW = asIsoDateTime('2026-08-08T05:00:00.000Z');
const FAMILY_ID = asFamilyId('family-a');
const ACCOUNT_ID = asUserId('account-a');
const PERSON_ID = asPersonId('person-a');
const CORRELATION_ID = asCorrelationId('location-cross-surface');
const temporaryDirectories: string[] = [];
const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const timelineContext: TimelineApplicationContext = {
  familyId: FAMILY_ID,
  actor: { userId: ACCOUNT_ID, roles: ['adult_member'], personId: PERSON_ID },
  correlationId: CORRELATION_ID
};

const locationRecord = {
  id: 'location-shared',
  familyId: FAMILY_ID,
  ownerPersonId: PERSON_ID,
  label: 'Governed ev',
  address: 'Gizli adres',
  kind: 'residence' as const,
  createdAt: NOW
};

const linkedEvent: TimelineEventRecord = {
  id: asEventId('event-linked'),
  familyId: FAMILY_ID,
  kind: 'important_day',
  title: 'Bağlı etkinlik',
  startAt: asIsoDateTime('2026-08-09T05:00:00.000Z'),
  locationId: locationRecord.id,
  locationLabel: 'Önbellekte kalmış gizli etiket',
  visibility: 'family',
  participantPersonIds: [PERSON_ID],
  attachmentCount: 0,
  aiProcessingAllowed: false,
  recurrence: 'none',
  reminderDays: [1],
  createdAt: NOW
};

interface FakeRunnerState {
  visible: boolean;
  denyExact: boolean;
  readonly intents: LocationPolicyIntent[];
}

const fakeGovernedContext = (transaction: unknown): PolicyAuthorizedRepositoryExecutionContext => ({
  transaction: transaction as never,
  actor: { userId: ACCOUNT_ID, roles: ['adult_member'], personId: PERSON_ID },
  correlationId: CORRELATION_ID,
  occurredAt: NOW,
  policyAuthorization: {
    subject: { accountId: ACCOUNT_ID, roles: ['adult_member'], personId: PERSON_ID },
    receiptRecord: { receipt: { fixture: 'location-cross-surface' } }
  } as never
});

const fakeRunner = (
  transaction: unknown,
  state: FakeRunnerState
): RepositoryBackedLocationPolicyTransactionRunner => ({
  execute: async <T>(
    _context: LocationApplicationContext,
    intent: LocationPolicyIntent,
    operation: (scope: {
      readonly repository: PolicyAuthorizedRepositoryExecutionContext;
      readonly occurredAt: typeof NOW;
      readonly authorization: never;
    }) => Result<T, AppError>
  ): Promise<Result<T, AppError>> => {
    state.intents.push(intent);
    if (state.denyExact && intent.resourceId !== '*') {
      return err(createAppError({
        code: ERROR_CODES.AUTHORIZATION_DENIED,
        message: 'Grant expired or revoked',
        category: 'authorization',
        correlationId: CORRELATION_ID
      }));
    }
    const repository = fakeGovernedContext(transaction);
    return operation({ repository, occurredAt: NOW, authorization: repository.policyAuthorization as never });
  }
} as unknown as RepositoryBackedLocationPolicyTransactionRunner);

const fakeTimelineRunner = (transaction: unknown): RepositoryBackedTimelinePolicyTransactionRunner => ({
  execute: async <T>(_context: unknown, _intent: unknown, operation: (scope: {
    readonly repository: PolicyAuthorizedRepositoryExecutionContext;
    readonly occurredAt: typeof NOW;
    readonly authorization: never;
  }) => Result<T, AppError>): Promise<Result<T, AppError>> => {
    const repository = fakeGovernedContext(transaction);
    return operation({ repository, occurredAt: NOW, authorization: repository.policyAuthorization as never });
  }
} as unknown as RepositoryBackedTimelinePolicyTransactionRunner);

describe('30-Z location cross-surface privacy', () => {
  it('uses governed collection/exact reads, redacts cached event location data after revocation, and keeps linked writes in the same SQLite transaction', async () => {
    const transaction = { marker: 'same-sqlite-transaction' };
    const state: FakeRunnerState = { visible: true, denyExact: false, intents: [] };
    const runner = fakeRunner(transaction, state);
    const timelineRunner = fakeTimelineRunner(transaction);
    const eventWriteContexts: RepositoryExecutionContext[] = [];
    const timelineReadContexts: PolicyAuthorizedRepositoryExecutionContext[] = [];
    const locationReadContexts: PolicyAuthorizedRepositoryExecutionContext[] = [];
    const permissionReadContexts: RepositoryExecutionContext[] = [];
    let genericTransactionCalls = 0;

    const locationRepository = {
      listByFamily: (context: PolicyAuthorizedRepositoryExecutionContext) => {
        locationReadContexts.push(context);
        return ok(state.visible ? [locationRecord] : []);
      },
      findById: (context: PolicyAuthorizedRepositoryExecutionContext) => {
        locationReadContexts.push(context);
        return ok(state.visible ? locationRecord : null);
      }
    };
    const timelineRepository = {
      listByFamily: (context: PolicyAuthorizedRepositoryExecutionContext) => {
        timelineReadContexts.push(context);
        return ok([linkedEvent]);
      },
      listArchivedByFamily: (context: PolicyAuthorizedRepositoryExecutionContext) => {
        timelineReadContexts.push(context);
        return ok([linkedEvent]);
      },
      findById: (context: PolicyAuthorizedRepositoryExecutionContext) => {
        timelineReadContexts.push(context);
        return ok(linkedEvent);
      },
      insert: (context: RepositoryExecutionContext) => {
        eventWriteContexts.push(context);
        return ok(undefined);
      }
    };
    const dependencies = {
      transactionExecutor: {
        execute: <T>(_correlationId: unknown, operation: (scope: { transaction: never; occurredAt: typeof NOW }) => Result<T, AppError>) =>
          (genericTransactionCalls += 1, operation({ transaction: transaction as never, occurredAt: NOW }))
      } as unknown as TransactionExecutor,
      familyRepository: { findById: () => ok({ id: FAMILY_ID }) },
      personRepository: { listByFamily: () => ok([{ id: PERSON_ID }]) },
      locationRepository,
      timelineRepository,
      notificationStateRepository: { listByNotificationIds: () => ok([]) },
      objectPermissionRepository: { listActiveForSubject: (context: RepositoryExecutionContext) => {
        permissionReadContexts.push(context);
        return ok([]);
      } },
      auditRepository: { append: () => ok('audit-hash') },
      outboxRepository: { enqueue: () => ok(undefined) },
      locationPolicyTransactionRunner: runner
    } as unknown as RepositoryBackedTimelineApplicationDependencies;

    const query = new RepositoryBackedTimelineQueryPort(dependencies, timelineRunner);
    const first = await query.load(timelineContext);
    expect(first.ok && first.value.events[0]).toMatchObject({
      locationId: locationRecord.id,
      locationLabel: locationRecord.label
    });
    expect(genericTransactionCalls).toBe(0);
    expect(timelineReadContexts.at(-1)?.transaction).toBe(transaction);
    expect(timelineReadContexts.at(-1)).toHaveProperty('policyAuthorization');
    expect(permissionReadContexts).toEqual([]);

    state.visible = false;
    state.denyExact = true;
    const revokedDetail = await query.findVisibleById(timelineContext, linkedEvent.id);
    expect(revokedDetail.ok).toBe(true);
    if (!revokedDetail.ok || !revokedDetail.value) throw new Error('redacted event detail missing');
    expect(revokedDetail.value).not.toHaveProperty('locationId');
    expect(revokedDetail.value).not.toHaveProperty('locationLabel');

    const revokedCollection = await query.load(timelineContext);
    expect(revokedCollection.ok).toBe(true);
    if (!revokedCollection.ok) throw new Error('redacted timeline missing');
    expect(revokedCollection.value.events[0]).not.toHaveProperty('locationId');
    expect(revokedCollection.value.events[0]).not.toHaveProperty('locationLabel');

    state.visible = true;
    state.denyExact = false;
    const create = new CreateImportantDayUseCase(new RepositoryBackedTimelineApplicationUnitOfWork(dependencies, timelineRunner));
    const created = await create.execute({
      context: timelineContext,
      command: {
        title: 'Governed bağlantı',
        startAt: '2026-08-10T05:00:00.000Z',
        locationId: locationRecord.id,
        visibility: 'family',
        participantPersonIds: [PERSON_ID],
        aiProcessingAllowed: false,
        recurrence: 'none',
        reminderDays: [1]
      },
      identifiers: {
        eventId: asEventId('event-created'),
        auditId: 'audit-created',
        outboxEventId: asEventId('outbox-created')
      }
    });
    expect(created.ok).toBe(true);
    expect(state.intents.some((intent) => intent.resourceId === locationRecord.id && intent.action === 'read' && intent.capability === 'location.read')).toBe(true);
    expect(locationReadContexts.at(-1)?.transaction).toBe(transaction);
    expect(eventWriteContexts.at(-1)?.transaction).toBe(transaction);
    expect(eventWriteContexts.at(-1)).toHaveProperty('policyAuthorization');
  });

  it('derives dashboard location count and cached-event redaction only from the governed visible-location set', async () => {
    const preparedSql: string[] = [];
    const eventRow = {
      id: linkedEvent.id,
      kind: linkedEvent.kind,
      title: linkedEvent.title,
      start_at: linkedEvent.startAt,
      location_id: linkedEvent.locationId,
      location_label: linkedEvent.locationLabel,
      visibility: 'family',
      participant_person_ids: JSON.stringify([PERSON_ID]),
      attachment_count: 0,
      ai_processing_allowed: 0,
      recurrence: 'none',
      reminder_days: '[1]',
      created_at: NOW
    };
    const database = {
      prepare: (sql: string) => {
        preparedSql.push(sql);
        return {
          get: () => sql.includes('SELECT id,name FROM families')
            ? { id: FAMILY_ID, name: 'Aile' }
            : sql.includes('SELECT occurred_at FROM audit_log') ? { occurred_at: NOW } : { value: 0 },
          all: () => sql.includes('SELECT e.id') ? [eventRow] : []
        };
      }
    };
    const state: FakeRunnerState = { visible: true, denyExact: false, intents: [] };
    const runner = fakeRunner(database, state);
    const query = new RepositoryBackedDashboardQueryPort({
      dashboardRepository: new SqliteDashboardRepository(),
      locationRepository: { listByFamily: () => ok([{ ...locationRecord, id: 'location-visible' }]) } as never,
      locationPolicyTransactionRunner: runner
    });
    const loaded = await query.load({
      familyId: FAMILY_ID,
      actor: timelineContext.actor,
      correlationId: CORRELATION_ID
    });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) throw new Error('dashboard missing');
    expect(loaded.value.modules.find((module) => module.id === 'location')?.recordCount).toBe(1);
    expect(loaded.value.recentEvents[0]).not.toHaveProperty('locationId');
    expect(loaded.value.recentEvents[0]).not.toHaveProperty('locationLabel');
    expect(preparedSql.some((sql) => /FROM\s+locations/iu.test(sql))).toBe(false);
  });
});

describe('30-Z bootstrap and import direct-write fences', () => {
  it('rejects non-empty bootstrap locations before opening a write transaction', () => {
    const execute = vi.fn();
    const useCase = new SeedDefaultFamilyUseCase({ execute } as never);
    const result = useCase.execute({
      context: { familyId: FAMILY_ID, actor: { userId: ACCOUNT_ID, roles: ['family_admin'] }, correlationId: CORRELATION_ID },
      seed: {
        family: { id: FAMILY_ID, name: 'Aile' },
        people: [],
        relations: [],
        locations: [{ id: 'raw-location', label: 'Ham', kind: 'other' }],
        events: []
      },
      auditId: 'bootstrap-audit'
    });
    expect(result.ok).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects bootstrap events that reference a saved location before opening a write transaction', () => {
    const execute = vi.fn();
    const useCase = new SeedDefaultFamilyUseCase({ execute } as never);
    const result = useCase.execute({
      context: { familyId: FAMILY_ID, actor: { userId: ACCOUNT_ID, roles: ['family_admin'] }, correlationId: CORRELATION_ID },
      seed: {
        family: { id: FAMILY_ID, name: 'Aile' },
        people: [],
        relations: [],
        locations: [],
        events: [{
          id: 'event-with-location',
          kind: 'important_day',
          title: 'Konumlu etkinlik',
          startAt: NOW,
          locationId: 'location-bootstrap-reference',
          visibility: 'family',
          participantPersonIds: [],
          attachmentCount: 0,
          aiProcessingAllowed: false,
          recurrence: 'none',
          reminderDays: []
        }]
      },
      auditId: 'audit-bootstrap-location-reference'
    });
    expect(result.ok).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects import documents containing locations or locationId without a raw location repository dependency', () => {
    const directory = mkdtempSync(join(tmpdir(), '30-z-import-'));
    temporaryDirectories.push(directory);
    const transactionExecutor = {
      execute: <T>(_correlationId: unknown, operation: (scope: { transaction: never; occurredAt: typeof NOW }) => Result<T, AppError>) =>
        operation({ transaction: {} as never, occurredAt: NOW })
    } as unknown as TransactionExecutor;
    let actorRole: DataLifecycleApplicationContext['actor']['role'] = 'family_admin';
    let permissionRows: readonly unknown[] = [];
    const applicationContext = (): DataLifecycleApplicationContext => ({
      familyId: FAMILY_ID,
      actor: { userId: ACCOUNT_ID, role: actorRole, personId: PERSON_ID },
      correlationId: CORRELATION_ID
    });
    const service = new FamilyDataImportService({
      transactionExecutor,
      accountRepository: {
        findById: () => ok({
          id: ACCOUNT_ID,
          role: actorRole,
          status: 'active',
          personId: PERSON_ID,
          startsAt: NOW
        })
      } as never,
      permissionRepository: {
        listActiveForSubject: () => ok(permissionRows)
      } as never,
      importRepository: { loadExisting: () => ok({ people: [], relations: [], events: [] }) } as never,
      familyRepository: { findById: () => ok({ id: FAMILY_ID, name: 'Aile' }) } as never,
      personRepository: {} as never,
      relationRepository: {} as never,
      timelineRepository: {} as never,
      auditRepository: {} as never,
      strongAuthentication: {} as never,
      applicationContext
    });
    const base = {
      schemaVersion: 1,
      exportId: 'export-30-z',
      createdAt: NOW,
      family: { name: 'Aile' },
      people: [],
      relations: [],
      locations: [],
      events: []
    };
    const locationsPath = join(directory, 'locations.json');
    writeFileSync(locationsPath, JSON.stringify({ ...base, locations: [{ id: 'l1', label: 'Ham', kind: 'other' }] }), 'utf8');
    const locationsPreview = service.preview(locationsPath);
    expect(locationsPreview.valid).toBe(false);
    expect(locationsPreview.issues.map((issue) => issue.code)).toContain('import.location_policy_batch_required');

    const locationIdPath = join(directory, 'location-id.json');
    writeFileSync(locationIdPath, JSON.stringify({
      ...base,
      exportId: 'export-30-z-event',
      events: [{
        id: 'e1', title: 'Etkinlik', startAt: NOW, locationId: 'l1', visibility: 'family',
        participantPersonIds: [], aiProcessingAllowed: false, recurrence: 'none', reminderDays: []
      }]
    }), 'utf8');
    const eventPreview = service.preview(locationIdPath);
    expect(eventPreview.valid).toBe(false);
    expect(eventPreview.issues.map((issue) => issue.code)).toContain('import.event_location_policy_batch_required');

    actorRole = 'adult_member';
    expect(() => service.preview(join(directory, 'missing.json'))).toThrow(/merkezi yetkilendirme/iu);
    actorRole = 'family_admin';
    permissionRows = [{
      id: 'deny-family-import-read',
      subjectAccountId: ACCOUNT_ID,
      resourceType: 'family_data_import',
      resourceId: FAMILY_ID,
      actions: ['read'],
      effect: 'deny',
      purpose: 'administration',
      denialReason: 'Test deny',
      startsAt: NOW,
      createdAt: NOW
    }];
    expect(() => service.preview(locationsPath)).toThrow(/merkezi yetkilendirme/iu);
  });

  it('blocks governed imported-location rollback while preserving eligible null-receipt legacy rollback', () => {
    const database = new DatabaseSync(':memory:');
    databases.push(database);
    database.exec(`
      CREATE TABLE family_data_import_items(
        batch_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
        source_id TEXT NOT NULL, resolution TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE locations(id TEXT PRIMARY KEY, policy_receipt_hash TEXT);
      CREATE TABLE events(id TEXT PRIMARY KEY, location_id TEXT);
    `);
    database.prepare('INSERT INTO locations(id,policy_receipt_hash) VALUES(?,?)').run('legacy-location', null);
    database.prepare('INSERT INTO locations(id,policy_receipt_hash) VALUES(?,?)').run('governed-location', 'a'.repeat(64));
    database.prepare("INSERT INTO family_data_import_items VALUES(?,?,?,?,?,?)").run('legacy-batch', 'location', 'legacy-location', 'source-legacy', 'created', NOW);
    database.prepare("INSERT INTO family_data_import_items VALUES(?,?,?,?,?,?)").run('governed-batch', 'location', 'governed-location', 'source-governed', 'created', NOW);
    const context: RepositoryExecutionContext = {
      transaction: database as never,
      actor: { userId: ACCOUNT_ID, roles: ['family_admin'], personId: PERSON_ID },
      correlationId: CORRELATION_ID,
      occurredAt: NOW
    };
    const repository = new SqliteFamilyDataImportRepository();
    const governed = repository.inspectRollback(context, 'governed-batch');
    expect(governed.ok && governed.value.allowed).toBe(false);
    expect(governed.ok && governed.value.blockers.join(' ')).toContain('Governed policy receipt');

    const legacy = repository.inspectRollback(context, 'legacy-batch');
    expect(legacy).toMatchObject({ ok: true, value: { allowed: true, blockers: [] } });
    expect(repository.deleteCreatedEntities(context, 'legacy-batch')).toMatchObject({ ok: true, value: 1 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM locations WHERE id=?').get('legacy-location')).toMatchObject({ count: 0 });
    expect(repository.deleteCreatedEntities(context, 'governed-batch')).toMatchObject({ ok: false });
    expect(database.prepare('SELECT COUNT(*) AS count FROM locations WHERE id=?').get('governed-location')).toMatchObject({ count: 1 });
  });
});
