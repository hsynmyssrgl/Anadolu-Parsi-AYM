import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId
} from '@ppt/core';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';
import { SqliteAutomationRepository, SqliteReportRepository } from '@ppt/repositories';

const databases: DatabaseSync[] = [];
const NOW = asIsoDateTime('2026-08-08T00:00:00.000Z');
const IN_30_DAYS = asIsoDateTime('2026-09-07T00:00:00.000Z');
const FAMILY_A = asFamilyId('family-a');

const makeDatabase = (): DatabaseSync => {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  database.exec(`
    CREATE TABLE people(id TEXT PRIMARY KEY,family_id TEXT NOT NULL,status TEXT NOT NULL);
    CREATE TABLE events(id TEXT PRIMARY KEY,family_id TEXT NOT NULL,title TEXT NOT NULL,start_at TEXT NOT NULL);
  CREATE VIEW governed_timeline_events AS SELECT * FROM events;
    CREATE TABLE life_records(id TEXT PRIMARY KEY,family_id TEXT NOT NULL,owner_person_id TEXT NOT NULL,category TEXT NOT NULL,title TEXT NOT NULL,status TEXT NOT NULL,due_at TEXT);
    CREATE TABLE finance_records(id TEXT PRIMARY KEY,family_id TEXT NOT NULL,owner_person_id TEXT NOT NULL,title TEXT NOT NULL,kind TEXT NOT NULL,amount REAL NOT NULL,currency TEXT NOT NULL,remaining_principal REAL,due_at TEXT);
    CREATE TABLE medication_plans(id TEXT PRIMARY KEY,family_id TEXT NOT NULL,owner_person_id TEXT NOT NULL,name TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT);
    CREATE TABLE data_lifecycle(resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,state TEXT NOT NULL);
    CREATE TABLE automation_rules(id TEXT PRIMARY KEY,title TEXT NOT NULL,source_type TEXT NOT NULL,days_before INTEGER NOT NULL,enabled INTEGER NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE automation_runs(id TEXT PRIMARY KEY,rule_id TEXT NOT NULL,source_type TEXT NOT NULL,source_id TEXT NOT NULL,title TEXT NOT NULL,due_at TEXT NOT NULL,status TEXT NOT NULL,generated_task_id TEXT,created_at TEXT NOT NULL);
  `);
  return database;
};

const context = (database: DatabaseSync, personId?: string): RepositoryExecutionContext => ({
  transaction: database as never,
  actor: {
    userId: asUserId('account-a'),
    roles: ['family_member'],
    ...(personId ? { personId: asPersonId(personId) } : {})
  },
  correlationId: asCorrelationId('health-cross-projection-test'),
  occurredAt: NOW
});

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe('30-X health cross-projection privacy boundaries', () => {
  it('keeps automation ledger writes content-free and exposes no generic non-LIFE source projection', () => {
    const database = makeDatabase();
    database.exec(`
      INSERT INTO people VALUES ('person-a','family-a','active'),('person-b','family-a','active');
      INSERT INTO automation_rules VALUES ('rule-med','İlaç hatırlatma','medication_plan',30,1,'2026-08-01T00:00:00.000Z');
    `);

    const repository = new SqliteAutomationRepository();
    const repositoryContext = context(database, 'person-a');
    const inserted = repository.insertRun(repositoryContext, {
      id: 'run-a',
      ruleId: 'rule-med',
      sourceType: 'medication_plan',
      sourceId: 'plan-a',
      status: 'generated',
      createdAt: NOW
    });
    expect(inserted.ok).toBe(true);
    expect(database.prepare('SELECT title,due_at,created_at FROM automation_runs WHERE id=?').get('run-a')).toEqual({
      title: '__PPK016_SOURCE_CONTENT_REDACTED__',
      due_at: NOW,
      created_at: NOW
    });
    expect('listNonLifeDueSources' in repository).toBe(false);
    expect('listNonLifeRuns' in repository).toBe(false);
  });

  it('scopes every report query to family and personal aggregates to actor ownership', () => {
    const database = makeDatabase();
    database.exec(`
      INSERT INTO people VALUES
        ('person-a','family-a','active'),('person-b','family-a','active'),('person-x','family-b','active');
      INSERT INTO events VALUES
        ('event-a','family-a','Aile A olayı','2026-08-10T00:00:00.000Z'),
        ('event-x','family-b','Aile B gizli olayı','2026-08-10T00:00:00.000Z');
      INSERT INTO life_records VALUES
        ('task-a','family-a','person-a','task','A görevi','active','2026-08-07T00:00:00.000Z'),
        ('task-b','family-a','person-b','task','B gizli görevi','active','2026-08-07T00:00:00.000Z'),
        ('insurance-a','family-a','person-a','insurance','A sigortası','active','2026-08-20T00:00:00.000Z'),
        ('task-x','family-b','person-x','task','Aile B gizli görevi','active','2026-08-07T00:00:00.000Z');
      INSERT INTO finance_records VALUES
        ('finance-a','family-a','person-a','A varlığı','asset',100,'TRY',NULL,'2026-08-20T00:00:00.000Z'),
        ('finance-b','family-a','person-b','B gizli varlığı','asset',900,'TRY',NULL,'2026-08-20T00:00:00.000Z'),
        ('finance-x','family-b','person-x','Aile B gizli varlığı','asset',7000,'TRY',NULL,'2026-08-20T00:00:00.000Z');
      INSERT INTO medication_plans VALUES
        ('active-a','family-a','person-a','A aktif ilacı','2026-08-01T00:00:00.000Z',NULL),
        ('closed-a','family-a','person-a','A kapanmış ilacı','2026-08-01T00:00:00.000Z','2026-08-07T23:59:59.000Z'),
        ('active-b','family-a','person-b','B gizli ilacı','2026-08-01T00:00:00.000Z',NULL),
        ('active-x','family-b','person-x','Aile B gizli ilacı','2026-08-01T00:00:00.000Z',NULL),
        ('archived-a','family-a','person-a','A arşivlenmiş ilacı','2026-08-01T00:00:00.000Z',NULL);
      INSERT INTO data_lifecycle VALUES ('medication_plan','archived-a','archived');
    `);

    const repository = new SqliteReportRepository();
    const summary = repository.getNonLifeSummary(context(database, 'person-a'), FAMILY_A, NOW, IN_30_DAYS);
    expect(summary.ok).toBe(true);
    expect(summary.ok && summary.value).toMatchObject({
      peopleCount: 2,
      upcomingEvents: 1,
      activeMedicationPlans: 1,
      financeByCurrency: [{ currency: 'TRY', assets: 100, debts: 0 }]
    });

    const personless = repository.getNonLifeSummary(context(database), FAMILY_A, NOW, IN_30_DAYS);
    expect(personless.ok).toBe(true);
    expect(personless.ok && personless.value).toMatchObject({
      peopleCount: 2,
      upcomingEvents: 1,
      activeMedicationPlans: 0,
      financeByCurrency: []
    });
  });
});
