import type { PersonRecord, PersonRepositoryPort } from '@ppt/repository-contracts';
import type { FamilyId, IsoDate, IsoDateTime, PersonId } from '@ppt/core';
import type { RepositoryResult } from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';

export class SqlitePersonRepository extends SqliteRepository implements PersonRepositoryPort {
  public insert(context: RepositoryExecutionContext, person: PersonRecord): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO people(
          id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at
        ) VALUES(?,?,?,?,?,?,?,?,?)
      `).run(
        person.id,
        person.familyId,
        person.displayName,
        person.birthDate ?? null,
        person.relationshipType,
        person.generation,
        person.branch,
        person.status,
        person.createdAt
      );
    });
  }

  public findById(context: RepositoryExecutionContext, personId: PersonId): RepositoryResult<PersonRecord | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at
        FROM people WHERE id=?
      `).get(personId) as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        id: String(row.id) as PersonId,
        familyId: String(row.family_id) as FamilyId,
        displayName: String(row.display_name),
        ...(row.birth_date ? { birthDate: String(row.birth_date) as IsoDate } : {}),
        relationshipType: String(row.relationship_type),
        generation: Number(row.generation),
        branch: String(row.branch),
        status: String(row.status) as PersonRecord['status'],
        createdAt: String(row.created_at) as IsoDateTime
      };
    });
  }
  public listByFamily(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<readonly PersonRecord[]> {
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at
        FROM people WHERE family_id=? ORDER BY generation,display_name COLLATE NOCASE,id
      `).all(familyId) as ReadonlyArray<Record<string, unknown>>
    ).map((row) => ({
      id: String(row.id) as PersonId,
      familyId: String(row.family_id) as FamilyId,
      displayName: String(row.display_name),
      ...(row.birth_date ? { birthDate: String(row.birth_date) as IsoDate } : {}),
      relationshipType: String(row.relationship_type),
      generation: Number(row.generation),
      branch: String(row.branch),
      status: String(row.status) as PersonRecord['status'],
      createdAt: String(row.created_at) as IsoDateTime
    })));
  }

}
