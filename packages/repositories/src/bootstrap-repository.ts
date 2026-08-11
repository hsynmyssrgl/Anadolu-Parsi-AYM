import type { BootstrapSeedData, BootstrapRepositoryPort } from '@ppt/repository-contracts';
import type { FamilyId, IsoDateTime } from '@ppt/core';
import type { RepositoryResult } from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';

export class SqliteBootstrapRepository extends SqliteRepository implements BootstrapRepositoryPort {
  public seedIfEmpty(
    context: RepositoryExecutionContext,
    seed: BootstrapSeedData,
    occurredAt: IsoDateTime
  ): RepositoryResult<boolean> {
    return this.execute(context, () => {
      const row = this.database(context).prepare('SELECT COUNT(*) AS total FROM families').get() as { total: number };
      if (Number(row.total) > 0) return false;
      if (seed.events.length > 0) {
        throw new Error('Bootstrap timeline events require a governed per-event policy receipt workflow');
      }

      this.database(context).prepare('INSERT INTO families (id,name,created_at) VALUES (?,?,?)')
        .run(seed.family.id, seed.family.name, occurredAt);
      const insertPerson = this.database(context).prepare(`
        INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at)
        VALUES(?,?,?,?,?,?,?,'active',?)
      `);
      for (const person of seed.people) {
        insertPerson.run(person.id, seed.family.id, person.displayName, person.birthDate ?? null, person.relationshipType, person.generation, person.branch, occurredAt);
      }
      const insertRelation = this.database(context).prepare(`
        INSERT INTO relations(id,family_id,from_person_id,to_person_id,relation_type) VALUES(?,?,?,?,?)
      `);
      for (const relation of seed.relations) {
        insertRelation.run(relation.id, seed.family.id, relation.fromPersonId, relation.toPersonId, relation.relationType);
      }
      const insertEvent = this.database(context).prepare(`
        INSERT INTO events(id,family_id,kind,title,description,start_at,location_id,location_label,visibility,participant_person_ids,invitation_text,notes,attachment_count,ai_processing_allowed,recurrence,reminder_days,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `);
      for (const event of seed.events) {
        insertEvent.run(
          event.id, seed.family.id, event.kind, event.title, event.description ?? null, event.startAt,
          event.locationId ?? null, event.locationLabel ?? null, event.visibility,
          JSON.stringify(event.participantPersonIds), event.invitationText ?? null, event.notes ?? null,
          event.attachmentCount, event.aiProcessingAllowed ? 1 : 0, event.recurrence,
          JSON.stringify(event.reminderDays), occurredAt
        );
      }
      return true;
    });
  }
}
