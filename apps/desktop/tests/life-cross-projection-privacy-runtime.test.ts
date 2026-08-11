import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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
  type CorrelationId
} from '@ppt/core';
import { SqliteTransactionExecutor } from '@ppt/database';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  type PlatformPolicyReplayStore
} from '@ppt/platform-policy';
import type {
  AutomationApplicationContext,
  LifeApplicationContext,
  LifePolicyIntent,
  ReportApplicationContext
} from '@ppt/application';
import type {
  OutboxRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  TransactionContext
} from '@ppt/repository-contracts';
import {
  SqliteAuditRepository,
  SqliteAutomationRepository,
  SqliteLifeRepository,
  SqliteOutboxRepository,
  SqlitePlatformPolicyTransactionRepository,
  SqliteReportRepository
} from '@ppt/repositories';
import { RepositoryBackedAutomationAdapter } from '../src/main/automation-application-adapter.js';
import { SqliteFamilyDatabaseRuntime } from '../src/main/family-database-runtime.js';
import {
  RepositoryBackedLifePolicyTransactionRunner,
  type LifePolicyEnforcementPoint
} from '../src/main/life-application-adapter.js';
import { RepositoryBackedReportQueryPort } from '../src/main/report-application-adapter.js';
import { FamilyDataStore } from '../src/main/data-store.js';

const NOW = asIsoDateTime('2026-08-08T03:00:00.000Z');
const FAMILY_A = asFamilyId('family-a');
const ACCOUNT_A = asUserId('account-a');
const PERSON_A = asPersonId('person-a');
const POLICY_VERSION = '30-y-life-cross-surface-test-v1';
const openDatabases: DatabaseSync[] = [];
const openRuntimes: SqliteFamilyDatabaseRuntime[] = [];
const temporaryDirectories: string[] = [];

const policyKernel = new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('30-y-life-cross-surface-controlled-test-key-v1', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

const makePep = (
  context: LifeApplicationContext,
  intent: LifePolicyIntent,
  replayStore?: PlatformPolicyReplayStore
): PlatformPolicyEnforcementPoint => new PlatformPolicyEnforcementPoint({
  kernel: policyKernel,
  authorityResolver: {
    resolve: () => ({
      policyVersion: POLICY_VERSION,
      accountId: context.actor.userId,
      ...(context.actor.personId ? { personId: context.actor.personId } : {}),
      deviceId: 'device-30-y-life-cross-surface',
      applicationId: 'windows-desktop',
      deviceTrusted: true,
      membershipActive: true,
      roles: [context.actor.role],
      familyIds: [context.familyId],
      grants: [{
        id: 'grant-30-y-life-cross-surface',
        subjectAccountId: context.actor.userId,
        resourceType: 'life_record',
        resourceId: intent.resourceId,
        actions: [intent.action],
        effect: 'allow',
        purpose: 'general',
        startsAt: '2026-08-08T00:00:00.000Z'
      }],
      online: true,
      expiresAt: '2026-08-08T04:00:00.000Z'
    })
  },
  resourceResolver: {
    resolve: () => ({
      type: 'life_record',
      id: intent.resourceId,
      familyId: context.familyId,
      ...(intent.ownerPersonId ? { ownerPersonId: intent.ownerPersonId } : {}),
      sensitivity: intent.privacy === 'private'
        ? 'highly_sensitive'
        : intent.privacy === 'selected_members' ? 'sensitive' : 'personal'
    })
  },
  receiptSink: { append: () => undefined, ensure: () => undefined },
  ...(replayStore ? { replayStore } : {}),
  deferAllowedReceiptPersistence: true,
  clock: () => NOW
});

const repositoryContext = (
  transaction: TransactionContext,
  input: {
    readonly accountId: string;
    readonly personId: string;
    readonly correlationId: CorrelationId;
  }
): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: {
    userId: asUserId(input.accountId),
    roles: ['adult_member'],
    personId: asPersonId(input.personId)
  },
  correlationId: input.correlationId,
  occurredAt: transaction.occurredAt
});

const createReadRunner = (
  database: DatabaseSync,
  lifeRepository: SqliteLifeRepository
): RepositoryBackedLifePolicyTransactionRunner => new RepositoryBackedLifePolicyTransactionRunner({
  transactionExecutor: new SqliteTransactionExecutor(database as never, { now: () => NOW }),
  lifeRepository,
  accountRepository: {} as never,
  permissionRepository: {} as never,
  personRepository: {} as never,
  auditRepository: {} as never,
  outboxRepository: {} as never,
  policyEnforcementPointResolver: {
    resolve: (context, intent) => makePep(context, intent)
  },
  clusterFence: () => ({ writable: true, epoch: 65 })
});

const crossSurfaceSchema = `
  CREATE TABLE people(id TEXT PRIMARY KEY,family_id TEXT NOT NULL,status TEXT NOT NULL);
  CREATE TABLE events(id TEXT PRIMARY KEY,family_id TEXT NOT NULL,title TEXT NOT NULL,start_at TEXT NOT NULL);
  CREATE VIEW governed_timeline_events AS SELECT * FROM events;
  CREATE TABLE finance_records(
    id TEXT PRIMARY KEY,family_id TEXT NOT NULL,owner_person_id TEXT NOT NULL,title TEXT NOT NULL,
    kind TEXT NOT NULL,amount REAL NOT NULL,currency TEXT NOT NULL,remaining_principal REAL,due_at TEXT
  );
  CREATE TABLE medication_plans(
    id TEXT PRIMARY KEY,family_id TEXT NOT NULL,owner_person_id TEXT NOT NULL,name TEXT NOT NULL,
    starts_at TEXT NOT NULL,ends_at TEXT
  );
  CREATE TABLE life_records(
    id TEXT PRIMARY KEY,family_id TEXT NOT NULL,owner_person_id TEXT NOT NULL,
    category TEXT NOT NULL,title TEXT NOT NULL,status TEXT NOT NULL,privacy TEXT NOT NULL,
    starts_at TEXT,due_at TEXT,provider TEXT,reference_no TEXT,amount REAL,currency TEXT,
    location TEXT,notes TEXT,created_at TEXT NOT NULL
  );
  CREATE TABLE data_lifecycle(
    resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,owner_person_id TEXT,
    privacy TEXT,state TEXT NOT NULL,updated_at TEXT NOT NULL,
    PRIMARY KEY(resource_type,resource_id)
  );
  CREATE TABLE object_permissions(
    id TEXT PRIMARY KEY,subject_account_id TEXT NOT NULL,resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,actions TEXT NOT NULL,effect TEXT NOT NULL,
    purpose TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT
  );
  CREATE TABLE automation_rules(
    id TEXT PRIMARY KEY,title TEXT NOT NULL,source_type TEXT NOT NULL,
    days_before INTEGER NOT NULL,enabled INTEGER NOT NULL,created_at TEXT NOT NULL
  );
  CREATE TABLE automation_runs(
    id TEXT PRIMARY KEY,rule_id TEXT NOT NULL,source_type TEXT NOT NULL,source_id TEXT NOT NULL,
    title TEXT NOT NULL,due_at TEXT NOT NULL,status TEXT NOT NULL,generated_task_id TEXT,
    created_at TEXT NOT NULL
  );
`;

const addLifeFixture = (
  database: DatabaseSync,
  input: {
    readonly id: string;
    readonly familyId: string;
    readonly ownerPersonId: string;
    readonly title: string;
    readonly privacy: 'private' | 'family';
    readonly lifecycle?: 'active' | 'archived';
  }
): void => {
  database.prepare(`
    INSERT INTO life_records(
      id,family_id,owner_person_id,category,title,status,privacy,due_at,created_at
    ) VALUES(?,?,?,'task',?,'active',?,'2026-08-07T03:00:00.000Z',?)
  `).run(input.id, input.familyId, input.ownerPersonId, input.title, input.privacy, NOW);
  database.prepare(`
    INSERT INTO data_lifecycle(resource_type,resource_id,owner_person_id,privacy,state,updated_at)
    VALUES('life_record',?,?,?,?,?)
  `).run(
    input.id,
    input.ownerPersonId,
    input.privacy,
    input.lifecycle ?? 'active',
    NOW
  );
};

const addLifeRun = (
  database: DatabaseSync,
  id: string,
  sourceId: string,
  createdAt: string
): void => {
  database.prepare(`
    INSERT INTO automation_runs(
      id,rule_id,source_type,source_id,title,due_at,status,generated_task_id,created_at
    ) VALUES(?,'rule-life','life_record',?,'UNTRUSTED_LEDGER_TITLE','2026-08-07T03:00:00.000Z','generated',NULL,?)
  `).run(id, sourceId, createdAt);
};

afterEach(() => {
  for (const runtime of openRuntimes.splice(0)) {
    try { runtime.close(); } catch { /* best-effort test cleanup */ }
  }
  for (const database of openDatabases.splice(0)) {
    try { database.close(); } catch { /* best-effort test cleanup */ }
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('30-Y LIFE cross-surface privacy and governed automation', () => {
  it('statically fences source semantic persistence and rejects unsupported producer rules', async () => {
    const adapterSource = readFileSync(
      new URL('../src/main/automation-application-adapter.ts', import.meta.url),
      'utf8'
    );
    const repositorySource = readFileSync(
      new URL('../../../packages/repositories/src/automation-repository.ts', import.meta.url),
      'utf8'
    );
    const taskInsertStart = adapterSource.indexOf('insertLifeRecord(repository, {');
    const taskInsertEnd = adapterSource.indexOf('const run =', taskInsertStart);
    const generatedTaskInsert = adapterSource.slice(taskInsertStart, taskInsertEnd);
    const runInsertStart = repositorySource.indexOf('public insertRun(');
    const runInsertEnd = repositorySource.indexOf('public listLifeRunCandidates(', runInsertStart);
    const runLedgerInsert = repositorySource.slice(runInsertStart, runInsertEnd);
    expect(taskInsertStart).toBeGreaterThan(-1);
    expect(taskInsertEnd).toBeGreaterThan(taskInsertStart);
    expect(runInsertStart).toBeGreaterThan(-1);
    expect(runInsertEnd).toBeGreaterThan(runInsertStart);
    expect(adapterSource).not.toContain('title: `${rule.title}: ${source.title}`');
    expect(generatedTaskInsert).not.toContain('source.title');
    expect(generatedTaskInsert).not.toContain('dueAt:');
    expect(adapterSource).toContain("title: rule.title");
    expect(runLedgerInsert).not.toContain('input.title');
    expect(runLedgerInsert).not.toContain('input.dueAt');
    expect(repositorySource).not.toContain('listNonLifeDueSources');
    expect(repositorySource).not.toContain('listNonLifeRuns');
    expect(repositorySource).toContain('__PPK016_SOURCE_CONTENT_REDACTED__');

    const adapter = new RepositoryBackedAutomationAdapter({
      transactionExecutor: {} as never,
      automationRepository: {} as never,
      lifeRepository: {} as never,
      auditRepository: {} as never,
      outboxRepository: {} as never,
      lifePolicyTransactionRunner: {} as never
    });
    const rejected = await adapter.insertRule({
      actorId: ACCOUNT_A,
      actorRole: 'adult_member',
      actorPersonId: PERSON_A,
      familyId: FAMILY_A,
      correlationId: asCorrelationId('ppk016-unsupported-automation-rule'),
      occurredAt: NOW
    }, {
      id: 'unsupported-rule',
      title: 'Desteklenmeyen kaynak',
      sourceType: 'medication_plan',
      daysBefore: 1,
      enabled: true,
      createdAt: NOW
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.error.code).toBe(ERROR_CODES.AUTHORIZATION_DENIED);
      expect(rejected.error.details?.automationBoundary).toBe('PPK016_SOURCE_BINDING_REQUIRED');
    }
  });

  it('does not leak cross-family, cross-person, archived or ungoverned ledger titles', async () => {
    const database = new DatabaseSync(':memory:');
    openDatabases.push(database);
    database.exec(crossSurfaceSchema);
    database.exec(`
      INSERT INTO people VALUES
        ('person-a','family-a','active'),('person-b','family-a','active'),('person-x','family-b','active');
      INSERT INTO automation_rules VALUES
        ('rule-life','LIFE hatırlatma','life_record',30,1,'2026-08-01T00:00:00.000Z');
    `);
    addLifeFixture(database, {
      id: 'life-visible', familyId: 'family-a', ownerPersonId: 'person-a',
      title: 'VISIBLE_OWNER_TITLE', privacy: 'private'
    });
    addLifeFixture(database, {
      id: 'life-other-person', familyId: 'family-a', ownerPersonId: 'person-b',
      title: 'OTHER_PERSON_SECRET', privacy: 'private'
    });
    addLifeFixture(database, {
      id: 'life-archived', familyId: 'family-a', ownerPersonId: 'person-a',
      title: 'ARCHIVED_SECRET', privacy: 'private', lifecycle: 'archived'
    });
    addLifeFixture(database, {
      id: 'life-foreign', familyId: 'family-b', ownerPersonId: 'person-x',
      title: 'FOREIGN_SECRET', privacy: 'family'
    });
    addLifeRun(database, 'run-visible', 'life-visible', '2026-08-08T01:00:00.000Z');
    addLifeRun(database, 'run-other-person', 'life-other-person', '2026-08-08T02:00:00.000Z');
    addLifeRun(database, 'run-archived', 'life-archived', '2026-08-08T02:30:00.000Z');
    // More than one old one-shot candidate limit: the authorized row must not starve.
    for (let index = 0; index < 600; index += 1) {
      addLifeRun(
        database,
        `run-foreign-${String(index).padStart(4, '0')}`,
        'life-foreign',
        '2026-08-09T00:00:00.000Z'
      );
    }

    const lifeRepository = new SqliteLifeRepository();
    const transactionExecutor = new SqliteTransactionExecutor(database as never, { now: () => NOW });
    const lifePolicyTransactionRunner = createReadRunner(database, lifeRepository);
    const automation = new RepositoryBackedAutomationAdapter({
      transactionExecutor,
      automationRepository: new SqliteAutomationRepository(),
      lifeRepository,
      auditRepository: {} as never,
      outboxRepository: {} as never,
      lifePolicyTransactionRunner
    });
    const report = new RepositoryBackedReportQueryPort({
      transactionExecutor,
      reportRepository: new SqliteReportRepository(),
      lifeProjectionRepository: lifeRepository,
      lifePolicyTransactionRunner
    });
    const automationContext: AutomationApplicationContext = {
      actorId: ACCOUNT_A,
      actorRole: 'adult_member',
      actorPersonId: PERSON_A,
      familyId: FAMILY_A,
      correlationId: asCorrelationId('30-y-life-cross-run-list'),
      occurredAt: NOW
    };
    const reportContext: ReportApplicationContext = {
      ...automationContext,
      correlationId: asCorrelationId('30-y-life-cross-report')
    };

    const runs = await automation.listRuns(automationContext, 100);
    expect(runs).toEqual({
      ok: true,
      value: [{
        id: 'run-visible',
        ruleId: 'rule-life',
        sourceType: 'life_record',
        sourceId: 'life-visible',
        title: 'VISIBLE_OWNER_TITLE',
        dueAt: '2026-08-07T03:00:00.000Z',
        status: 'generated',
        createdAt: '2026-08-08T01:00:00.000Z'
      }]
    });

    const summary = await report.getSummary(
      reportContext,
      NOW,
      asIsoDateTime('2026-09-07T03:00:00.000Z')
    );
    expect(summary.ok).toBe(true);
    if (summary.ok) {
      expect(summary.value.activeTasks).toBe(1);
      expect(summary.value.overdueItems).toEqual([{
        id: 'life-visible',
        title: 'VISIBLE_OWNER_TITLE',
        sourceType: 'life_record',
        dueAt: '2026-08-07T03:00:00.000Z'
      }]);
    }
    const serialized = JSON.stringify({ runs, summary });
    expect(serialized).not.toContain('FOREIGN_SECRET');
    expect(serialized).not.toContain('OTHER_PERSON_SECRET');
    expect(serialized).not.toContain('ARCHIVED_SECRET');
    expect(serialized).not.toContain('UNTRUSTED_LEDGER_TITLE');

    const forbiddenPersonlessPep = {
      execute(): never { throw new Error('personless LIFE PEP must not execute'); }
    } as never;
    const personlessAutomation = new RepositoryBackedAutomationAdapter({
      transactionExecutor,
      automationRepository: new SqliteAutomationRepository(),
      lifeRepository,
      auditRepository: {} as never,
      outboxRepository: {} as never,
      lifePolicyTransactionRunner: forbiddenPersonlessPep
    });
    const personlessReport = new RepositoryBackedReportQueryPort({
      transactionExecutor,
      reportRepository: new SqliteReportRepository(),
      lifeProjectionRepository: lifeRepository,
      lifePolicyTransactionRunner: forbiddenPersonlessPep
    });
    const personlessAutomationContext: AutomationApplicationContext = {
      actorId: automationContext.actorId,
      actorRole: automationContext.actorRole,
      familyId: automationContext.familyId,
      correlationId: automationContext.correlationId,
      occurredAt: automationContext.occurredAt
    };
    const personlessRuns = await personlessAutomation.listRuns(personlessAutomationContext, 100);
    expect(personlessRuns).toEqual({ ok: true, value: [] });
    const personlessReportContext: ReportApplicationContext = {
      actorId: reportContext.actorId,
      actorRole: reportContext.actorRole,
      familyId: reportContext.familyId,
      correlationId: reportContext.correlationId
    };
    const personlessSummary = await personlessReport.getSummary(
      personlessReportContext,
      NOW,
      asIsoDateTime('2026-09-07T03:00:00.000Z')
    );
    expect(personlessSummary).toMatchObject({
      ok: true,
      value: { activeTasks: 0, expiringInsurance: 0, overdueItems: [] }
    });
  });

  it('writes task, run, receipt, audit and outbox atomically with retry idempotency', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppt-30y-life-automation-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'family.db');
    const setupStore = new FamilyDataStore({ databasePath, seed: false });
    setupStore.setupAdmin({
      familyName: '30-Y LIFE Otomasyon Ailesi',
      displayName: '30-Y LIFE Yöneticisi',
      email: 'life-30y@example.com',
      password: 'Life30YGucluParola!'
    });
    setupStore.close();

    const runtime = new SqliteFamilyDatabaseRuntime({
      databasePath,
      applicationVersion: '4.8.2026-29',
      clock: { now: () => NOW },
      skipFileMigrationSafetyBackup: true
    });
    openRuntimes.push(runtime);
    const database = runtime.database;
    const account = database.prepare(
      'SELECT id,person_id,role FROM accounts WHERE person_id IS NOT NULL LIMIT 1'
    ).get() as { id: string; person_id: string; role: AutomationApplicationContext['actorRole'] };
    // The due-source seam is controlled below; no receiptless protected row is seeded.
    database.prepare(`
      INSERT INTO automation_rules(id,title,source_type,days_before,enabled,created_at)
      VALUES('rule-due','Otomatik görev','life_record',30,1,?)
    `).run(NOW);

    const platformRepository = new SqlitePlatformPolicyTransactionRepository();
    const fenceCorrelation = asCorrelationId('30-y-life-fence');
    const fence = runtime.transactionExecutor.execute(fenceCorrelation, (transaction) =>
      platformRepository.synchronizeFence(
        repositoryContext(transaction, {
          accountId: account.id,
          personId: account.person_id,
          correlationId: fenceCorrelation
        }),
        { fenceName: 'life-write', epoch: 65, writable: true, synchronizedAt: NOW }
      ));
    expect(fence.ok).toBe(true);

    const rawLifeRepository = new SqliteLifeRepository();
    let currentSourceReadCount = 0;
    const lifeRepository = new Proxy(rawLifeRepository, {
      get(target, property, receiver) {
        if (property === 'listAutomationDueLife') {
          return () => {
            currentSourceReadCount += 1;
            return ok([{
              id: 'source-due',
              title: 'Yönetişimli otomasyon kaynağı',
              dueAt: asIsoDateTime('2026-08-09T03:00:00.000Z')
            }]);
          };
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
    const durableResolver = {
      resolve(context: LifeApplicationContext, intent: LifePolicyIntent): LifePolicyEnforcementPoint {
        const pep = makePep(context, intent, {
          reserve: (reservation) => {
            const reservationCorrelation = asCorrelationId(`${context.correlationId}:replay-reservation`);
            const reserved = runtime.transactionExecutor.execute(
              reservationCorrelation,
              (transaction) => platformRepository.reserveReplayNonce(
                repositoryContext(transaction, {
                  accountId: account.id,
                  personId: account.person_id,
                  correlationId: reservationCorrelation
                }),
                reservation
              )
            );
            if (!reserved.ok) throw new Error(reserved.error.message);
            return reserved.value;
          }
        });
        return {
          execute: pep.execute.bind(pep) as LifePolicyEnforcementPoint['execute'],
          requiresTransactionRevalidation: true,
          revalidateTransaction: () => ok(undefined),
          requiresDurableTransactionReceipt: true,
          recordAuthorizedTransaction: (input) => {
            const authorization = input.authorization;
            const governed: PolicyAuthorizedRepositoryExecutionContext = {
              transaction: input.transaction.transaction,
              actor: {
                userId: asUserId(authorization.subject.accountId),
                roles: authorization.subject.roles,
                ...(authorization.subject.personId
                  ? { personId: asPersonId(authorization.subject.personId) }
                  : {})
              },
              correlationId: context.correlationId,
              occurredAt: input.transaction.occurredAt,
              policyAuthorization: authorization
            };
            const recorded = platformRepository.recordAuthorizedTransaction(governed, {
              record: authorization.receiptRecord,
              fenceName: 'life-write',
              fenceEpoch: authorization.fenceEpoch,
              fenceWritable: true
            });
            return recorded.ok ? ok(undefined) : recorded;
          },
          projectCommittedTransaction: () => ok(undefined)
        };
      }
    };
    const runner = new RepositoryBackedLifePolicyTransactionRunner({
      transactionExecutor: runtime.transactionExecutor,
      lifeRepository,
      accountRepository: {} as never,
      permissionRepository: {} as never,
      personRepository: {} as never,
      auditRepository: new SqliteAuditRepository(),
      outboxRepository: new SqliteOutboxRepository(),
      policyEnforcementPointResolver: durableResolver,
      clusterFence: () => ({ writable: true, epoch: 65 })
    });
    const automationRepository = new SqliteAutomationRepository();
    const auditRepository = new SqliteAuditRepository();
    const realOutbox = new SqliteOutboxRepository();
    const failingOutbox = {
      enqueue: () => err(createAppError({
        code: ERROR_CODES.DATABASE_BUSY,
        message: '30-Y controlled outbox failure',
        category: 'infrastructure',
        correlationId: asCorrelationId('30-y-controlled-outbox-failure')
      }))
    } as unknown as OutboxRepositoryPort;
    const dependencies = {
      transactionExecutor: runtime.transactionExecutor,
      automationRepository,
      lifeRepository,
      auditRepository,
      lifePolicyTransactionRunner: runner
    } as const;
    const failedAdapter = new RepositoryBackedAutomationAdapter({
      ...dependencies,
      outboxRepository: failingOutbox
    });
    const context: AutomationApplicationContext = {
      actorId: asUserId(account.id),
      actorRole: account.role,
      actorPersonId: asPersonId(account.person_id),
      familyId: asFamilyId('family-main'),
      correlationId: asCorrelationId('30-y-automation-root'),
      occurredAt: NOW
    };
    const failed = await failedAdapter.executeDueRules({
      ...context,
      correlationId: asCorrelationId('30-y-automation-failed')
    }, NOW, {
      nextRunId: () => 'run-failed',
      nextTaskId: () => 'task-failed',
      nextAuditId: () => 'audit-failed'
    });
    expect(failed.ok).toBe(false);
    for (const [table, id] of [
      ['life_records', 'task-failed'],
      ['automation_runs', 'run-failed'],
      ['audit_log', 'audit-failed'],
      ['event_outbox', 'automation-life-task-failed']
    ] as const) {
      expect(database.prepare(`SELECT COUNT(*) count FROM ${table} WHERE id=?`).get(id)).toEqual({ count: 0 });
    }
    expect(database.prepare(`
      SELECT COUNT(*) count FROM platform_policy_transaction_receipts WHERE resource_id='task-failed'
    `).get()).toEqual({ count: 0 });

    const adapter = new RepositoryBackedAutomationAdapter({
      ...dependencies,
      outboxRepository: realOutbox
    });
    const first = await adapter.executeDueRules({
      ...context,
      correlationId: asCorrelationId('30-y-automation-success')
    }, NOW, {
      nextRunId: () => 'run-success',
      nextTaskId: () => 'task-success',
      nextAuditId: () => 'audit-success'
    });
    expect(first).toEqual({ ok: true, value: 1 });
    const retry = await adapter.executeDueRules({
      ...context,
      correlationId: asCorrelationId('30-y-automation-retry')
    }, NOW, {
      nextRunId: () => 'run-retry',
      nextTaskId: () => 'task-retry',
      nextAuditId: () => 'audit-retry'
    });
    expect(retry).toEqual({ ok: true, value: 0 });

    const task = database.prepare(`
      SELECT family_id,owner_person_id,title,due_at,notes,privacy,policy_resource_type,policy_resource_id,
        policy_action,policy_capability,policy_correlation_id
      FROM life_records WHERE id='task-success'
    `).get() as Record<string, unknown>;
    expect(task).toMatchObject({
      family_id: 'family-main',
      owner_person_id: account.person_id,
      title: 'Otomatik görev',
      due_at: null,
      notes: 'Otomatik oluşturuldu.',
      privacy: 'private',
      policy_resource_type: 'life_record',
      policy_resource_id: 'task-success',
      policy_action: 'create',
      policy_capability: 'family.write',
      policy_correlation_id: '30-y-automation-success:life-task:task-success'
    });
    expect(database.prepare(`
      SELECT COUNT(*) count FROM automation_runs WHERE id='run-success'
    `).get()).toEqual({ count: 1 });
    expect(database.prepare(`
      SELECT title,due_at,created_at FROM automation_runs WHERE id='run-success'
    `).get()).toEqual({
      title: '__PPK016_SOURCE_CONTENT_REDACTED__',
      due_at: NOW,
      created_at: NOW
    });
    expect(currentSourceReadCount).toBe(5);
    expect(database.prepare(`
      SELECT COUNT(*) count FROM audit_log
      WHERE id='audit-success' AND resource_type='life_record' AND resource_id='task-success'
    `).get()).toEqual({ count: 1 });
    expect(database.prepare(`
      SELECT COUNT(*) count FROM event_outbox
      WHERE id='automation-life-task-success' AND aggregate_type='life_record' AND aggregate_id='task-success'
    `).get()).toEqual({ count: 1 });
    expect(database.prepare(`
      SELECT COUNT(*) count FROM life_records WHERE id IN ('task-success','task-retry')
    `).get()).toEqual({ count: 1 });
    expect(database.prepare(`
      SELECT COUNT(*) count FROM automation_runs WHERE id IN ('run-success','run-retry')
    `).get()).toEqual({ count: 1 });
    expect(database.prepare(`
      SELECT COUNT(*) count FROM platform_policy_transaction_receipts WHERE resource_id='task-retry'
    `).get()).toEqual({ count: 0 });
    expect(database.prepare(`
      SELECT COUNT(*) count FROM platform_policy_journal_projection_outbox projection
      JOIN platform_policy_transaction_receipts receipt ON receipt.receipt_hash=projection.receipt_hash
      WHERE receipt.resource_id='task-retry'
    `).get()).toEqual({ count: 0 });

    database.prepare(`
      INSERT INTO automation_runs(
        id,rule_id,source_type,source_id,title,due_at,status,generated_task_id,created_at
      ) VALUES
        ('run-clamp-a','rule-due','life_record','task-clamp-a','Yaşam kaydı','2026-08-09T03:00:00.000Z','created',NULL,'2026-08-08T03:00:02.000Z'),
        ('run-clamp-b','rule-due','life_record','task-clamp-b','Yaşam kaydı','2026-08-09T03:00:00.000Z','created',NULL,'2026-08-08T03:00:01.000Z')
    `).run();
    const clampCorrelation = asCorrelationId('30-y-negative-life-candidate-limit');
    const clampedCandidates = runtime.transactionExecutor.execute(clampCorrelation, (transaction) =>
      automationRepository.listLifeRunCandidates(
        repositoryContext(transaction, {
          accountId: account.id,
          personId: account.person_id,
          correlationId: clampCorrelation
        }),
        { limit: -1 }
      ));
    expect(clampedCandidates.ok).toBe(true);
    if (clampedCandidates.ok) expect(clampedCandidates.value).toHaveLength(1);
  });
});
