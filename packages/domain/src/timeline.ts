import type { PersonId } from './types.js';
import type { TimelineEvent } from './entities.js';
import type { ActorContext, ObjectGrant } from './permissions.js';
import { canAccessTimelineEvent } from './permissions.js';

export interface TimelineQuery {
  actor: ActorContext;
  events: TimelineEvent[];
  grants?: ObjectGrant[];
  personId?: PersonId;
  includeAiRestricted?: boolean;
}

const byDateAscending = (a: TimelineEvent, b: TimelineEvent): number =>
  a.startAt.localeCompare(b.startAt);

export function buildPersonalTimeline(query: TimelineQuery): TimelineEvent[] {
  const targetPersonId = query.personId ?? query.actor.personId;
  return query.events
    .filter((event) => event.participantPersonIds.includes(targetPersonId))
    .filter((event) => canAccessTimelineEvent({
      actor: query.actor,
      event,
      grants: query.grants ?? []
    }))
    .filter((event) => query.includeAiRestricted !== false || event.aiProcessingAllowed)
    .toSorted(byDateAscending);
}

export function buildFamilyTimeline(query: TimelineQuery): TimelineEvent[] {
  return query.events
    .filter((event) => canAccessTimelineEvent({
      actor: query.actor,
      event,
      grants: query.grants ?? []
    }))
    .filter((event) => query.includeAiRestricted !== false || event.aiProcessingAllowed)
    .toSorted(byDateAscending);
}
