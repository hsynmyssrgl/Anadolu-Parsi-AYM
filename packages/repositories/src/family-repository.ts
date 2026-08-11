import type { FamilyRecord, FamilyRepositoryPort } from '@ppt/repository-contracts';
import type { FamilyId, IsoDateTime } from '@ppt/core';
import type { RepositoryResult } from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';

export class SqliteFamilyRepository extends SqliteRepository implements FamilyRepositoryPort {
  public findById(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<FamilyRecord | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,name,created_at FROM families WHERE id=?
      `).get(familyId) as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        id: String(row.id) as FamilyId,
        name: String(row.name),
        createdAt: String(row.created_at) as IsoDateTime
      };
    });
  }
}
