import { asFamilyId, asPersonId, type FamilyId, type PersonId } from '@ppt/core';
import type {
  EntityCatalogRepositoryPort,
  EventCatalogCursor,
  EventCatalogRow,
  PersonCatalogCursor,
  PersonCatalogRow,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';

const escapeLike = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');

const mapPerson = (row: Record<string, unknown>): PersonCatalogRow => ({
  id: asPersonId(String(row.id)),
  familyId: asFamilyId(String(row.family_id)),
  displayName: String(row.display_name),
  ...(row.birth_date ? { birthDate: String(row.birth_date) } : {}),
  relationshipType: String(row.relationship_type),
  generation: Number(row.generation),
  branch: String(row.branch),
  status: String(row.status) as PersonCatalogRow['status']
});

const mapEvent = (row: Record<string, unknown>): EventCatalogRow => ({
  id: String(row.id),
  familyId: asFamilyId(String(row.family_id)),
  title: String(row.title),
  kind: String(row.kind),
  startAt: String(row.start_at),
  ...(row.archived_at ? { archivedAt: String(row.archived_at) } : {})
});

const placeholders = (count: number): string => Array.from({ length: count }, () => '?').join(',');

export class SqliteEntityCatalogRepository extends SqliteRepository implements EntityCatalogRepositoryPort {
  public listPeoplePage(context: RepositoryExecutionContext, input: {
    readonly familyId: FamilyId;
    readonly limit: number;
    readonly query: string;
    readonly cursor?: PersonCatalogCursor;
  }): RepositoryResult<readonly PersonCatalogRow[]> {
    return this.execute(context, () => {
      const where = ['family_id=?', "status='active'"];
      const params: unknown[] = [input.familyId];
      if (input.query) {
        where.push("display_name LIKE ? ESCAPE '\\' COLLATE NOCASE");
        params.push(`%${escapeLike(input.query)}%`);
      }
      if (input.cursor) {
        where.push('(display_name COLLATE NOCASE>? COLLATE NOCASE OR (display_name COLLATE NOCASE=? COLLATE NOCASE AND id>?))');
        params.push(input.cursor.displayName, input.cursor.displayName, input.cursor.id);
      }
      params.push(input.limit);
      const rows = this.database(context).prepare(`
        SELECT id,family_id,display_name,birth_date,relationship_type,generation,branch,status
        FROM people
        WHERE ${where.join(' AND ')}
        ORDER BY display_name COLLATE NOCASE,id
        LIMIT ?
      `).all(...params) as Array<Record<string, unknown>>;
      return rows.map(mapPerson);
    });
  }

  public listEventsPage(context: RepositoryExecutionContext, input: {
    readonly familyId: FamilyId;
    readonly limit: number;
    readonly query: string;
    readonly personId?: PersonId;
    readonly kind: string;
    readonly archiveMode: 'active' | 'archived' | 'all';
    readonly cursor?: EventCatalogCursor;
  }): RepositoryResult<readonly EventCatalogRow[]> {
    return this.execute(context, () => {
      const where = ['family_id=?'];
      const params: unknown[] = [input.familyId];
      if (input.archiveMode === 'active') where.push('archived_at IS NULL');
      else if (input.archiveMode === 'archived') where.push('archived_at IS NOT NULL');
      if (input.query) {
        where.push("title LIKE ? ESCAPE '\\' COLLATE NOCASE");
        params.push(`%${escapeLike(input.query)}%`);
      }
      if (input.personId) {
        where.push('EXISTS (SELECT 1 FROM json_each(events.participant_person_ids) participant WHERE participant.value=?)');
        params.push(input.personId);
      }
      if (input.kind) {
        where.push('kind=?');
        params.push(input.kind);
      }
      if (input.cursor) {
        where.push('(start_at<? OR (start_at=? AND id<?))');
        params.push(input.cursor.startAt, input.cursor.startAt, input.cursor.id);
      }
      params.push(input.limit);
      const rows = this.database(context).prepare(`
        SELECT id,family_id,title,kind,start_at,archived_at
        FROM governed_timeline_events
        WHERE ${where.join(' AND ')}
        ORDER BY start_at DESC,id DESC
        LIMIT ?
      `).all(...params) as Array<Record<string, unknown>>;
      return rows.map(mapEvent);
    });
  }

  public findPeopleByIds(context: RepositoryExecutionContext, familyId: FamilyId, personIds: readonly PersonId[]): RepositoryResult<readonly PersonCatalogRow[]> {
    return this.execute(context, () => {
      if (personIds.length === 0) return [];
      const rows = this.database(context).prepare(`
        SELECT id,family_id,display_name,birth_date,relationship_type,generation,branch,status
        FROM people
        WHERE family_id=? AND id IN (${placeholders(personIds.length)})
        ORDER BY display_name COLLATE NOCASE,id
      `).all(familyId, ...personIds) as Array<Record<string, unknown>>;
      return rows.map(mapPerson);
    });
  }

  public findEventsByIds(context: RepositoryExecutionContext, familyId: FamilyId, eventIds: readonly string[]): RepositoryResult<readonly EventCatalogRow[]> {
    return this.execute(context, () => {
      if (eventIds.length === 0) return [];
      const rows = this.database(context).prepare(`
        SELECT id,family_id,title,kind,start_at,archived_at
        FROM governed_timeline_events
        WHERE family_id=? AND id IN (${placeholders(eventIds.length)})
        ORDER BY start_at DESC,id DESC
      `).all(familyId, ...eventIds) as Array<Record<string, unknown>>;
      return rows.map(mapEvent);
    });
  }
}
