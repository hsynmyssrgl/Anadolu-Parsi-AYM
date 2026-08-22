import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';

describe('sonlu izin veren nesne yetkisi veritabanı sözleşmesi', () => {
  let database: DatabaseSync | undefined;
  afterEach(() => database?.close());

  it('eski süresiz politika iznini güvenli biçimde sona erdirir ve yenisini engeller', () => {
    database = new DatabaseSync(':memory:');
    database.exec(`
      CREATE TABLE object_permissions(
        id TEXT PRIMARY KEY,
        resource_type TEXT NOT NULL,
        actions TEXT NOT NULL,
        effect TEXT NOT NULL,
        purpose TEXT NOT NULL,
        starts_at TEXT NOT NULL,
        ends_at TEXT
      );
      CREATE TABLE database_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
      INSERT INTO database_metadata VALUES('schema_generation','before','2026-08-23T00:00:00.000Z');
      INSERT INTO object_permissions VALUES(
        'legacy-event','event','["read"]','allow','general','2026-08-22T00:00:00.000Z',NULL
      );
      INSERT INTO object_permissions VALUES(
        'archive-policy','archive_retention_policy','["read"]','allow','archive','2026-08-22T00:00:00.000Z',NULL
      );
    `);
    const migration = FAMILY_DATABASE_MIGRATIONS.find(({ version }) => version === 119);
    expect(migration).toBeDefined();
    database.exec(migration!.sql);

    expect(database.prepare('SELECT ends_at FROM object_permissions WHERE id=?').get('legacy-event')).toEqual({
      ends_at: '2026-08-22T00:00:01.000Z'
    });
    expect(database.prepare('SELECT ends_at FROM object_permissions WHERE id=?').get('archive-policy')).toEqual({ ends_at: null });
    expect(() => database!.exec(`
      INSERT INTO object_permissions VALUES(
        'new-event','event','["read"]','allow','general','2026-08-23T00:00:00.000Z',NULL
      );
    `)).toThrow(/finite ends_at/u);
  });
});
