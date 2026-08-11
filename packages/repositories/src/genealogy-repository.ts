import type { GenealogyTimelineEventRecord, GenealogyRepositoryPort } from '@ppt/repository-contracts';
import type { FamilyId, PersonId } from '@ppt/core';
import type { RepositoryResult } from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';

const parsePersonIds = (value: unknown): PersonId[] => {
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').map((item) => item as PersonId)
      : [];
  } catch {
    return [];
  }
};

export class SqliteGenealogyRepository extends SqliteRepository implements GenealogyRepositoryPort {
  public listTimelineEvents(
    context: RepositoryExecutionContext,
    familyId: FamilyId
  ): RepositoryResult<readonly GenealogyTimelineEventRecord[]> {
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT id,family_id,start_at,title,participant_person_ids
        FROM governed_timeline_events WHERE family_id=? ORDER BY start_at,id
      `).all(familyId) as ReadonlyArray<Record<string, unknown>>
    ).map((row) => ({
      id: String(row.id),
      familyId: String(row.family_id) as FamilyId,
      date: String(row.start_at),
      title: String(row.title),
      participantPersonIds: parsePersonIds(row.participant_person_ids)
    })));
  }
}
