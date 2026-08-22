import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId
} from '@ppt/core';
import type { RepositoryTransaction } from '@ppt/contracts';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';
import { SqliteEntityCatalogRepository } from './src/entity-catalog-repository.js';

const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

const openFixture = (): {
  readonly database: DatabaseSync;
  readonly context: RepositoryExecutionContext;
} => {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  database.exec(`
    CREATE TABLE governed_timeline_events(
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      start_at TEXT NOT NULL,
      archived_at TEXT,
      participant_person_ids TEXT NOT NULL
    ) STRICT;
  `);
  const insert = database.prepare(`
    INSERT INTO governed_timeline_events(
      id,family_id,title,kind,start_at,archived_at,participant_person_ids
    ) VALUES(?,?,?,?,?,?,?)
  `);
  insert.run(
    'event-visible',
    'family-catalog',
    'Görünür aile günü',
    'important_day',
    '2026-08-22T12:00:00.000Z',
    null,
    JSON.stringify(['person-selected'])
  );
  insert.run(
    'event-hidden',
    'family-catalog',
    'Başka kişinin günü',
    'important_day',
    '2026-08-21T12:00:00.000Z',
    null,
    JSON.stringify(['person-other'])
  );
  return {
    database,
    context: {
      transaction: database as unknown as RepositoryTransaction,
      actor: {
        userId: asUserId('account-catalog'),
        roles: ['family_admin'],
        personId: asPersonId('person-selected')
      },
      correlationId: asCorrelationId('entity-catalog-person-filter'),
      occurredAt: asIsoDateTime('2026-08-22T13:00:00.000Z')
    }
  };
};

describe('SqliteEntityCatalogRepository', () => {
  it('filters the governed event catalog by participant without referencing a missing table alias', () => {
    const { context } = openFixture();
    const result = new SqliteEntityCatalogRepository().listEventsPage(context, {
      familyId: asFamilyId('family-catalog'),
      limit: 10,
      query: '',
      personId: asPersonId('person-selected'),
      kind: '',
      archiveMode: 'active'
    });

    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.value).toEqual([
      expect.objectContaining({ id: 'event-visible', title: 'Görünür aile günü' })
    ]);
  });
});
