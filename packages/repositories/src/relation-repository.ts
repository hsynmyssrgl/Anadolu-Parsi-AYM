import type { RelationType, RelationRecord, RelationRepositoryPort } from '@ppt/repository-contracts';
import type { FamilyId, PersonId } from '@ppt/core';
import type { RepositoryResult } from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';

export class SqliteRelationRepository extends SqliteRepository implements RelationRepositoryPort {
  public insert(context: RepositoryExecutionContext, relation: RelationRecord): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO relations(id,family_id,from_person_id,to_person_id,relation_type)
        VALUES(?,?,?,?,?)
      `).run(
        relation.id,
        relation.familyId,
        relation.fromPersonId,
        relation.toPersonId,
        relation.relationType
      );
    });
  }

  public listByFamily(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<readonly RelationRecord[]> {
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT id,family_id,from_person_id,to_person_id,relation_type
        FROM relations WHERE family_id=? ORDER BY rowid,id
      `).all(familyId) as ReadonlyArray<Record<string, unknown>>
    ).map((row) => ({
      id: String(row.id),
      familyId: String(row.family_id) as FamilyId,
      fromPersonId: String(row.from_person_id) as PersonId,
      toPersonId: String(row.to_person_id) as PersonId,
      relationType: String(row.relation_type) as RelationType
    })));
  }

  public existsExact(context: RepositoryExecutionContext, input: {
    readonly familyId: FamilyId;
    readonly fromPersonId: PersonId;
    readonly toPersonId: PersonId;
    readonly relationType: RelationType;
  }): RepositoryResult<boolean> {
    return this.execute(context, () => Boolean(this.database(context).prepare(`
      SELECT 1 AS found FROM relations
      WHERE family_id=? AND from_person_id=? AND to_person_id=? AND relation_type=?
      LIMIT 1
    `).get(input.familyId, input.fromPersonId, input.toPersonId, input.relationType)));
  }
}
