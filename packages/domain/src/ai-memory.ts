import type { TimelineEvent } from './entities.js';
import type { ActorContext, ObjectGrant } from './permissions.js';
import { canAccessTimelineEvent } from './permissions.js';

export interface AiContextItem {
  sourceId: string;
  title: string;
  summary: string;
  occurredAt: string;
}

export function buildAiTimelineContext(
  actor: ActorContext,
  events: TimelineEvent[],
  grants: ObjectGrant[] = []
): AiContextItem[] {
  return events
    .filter((event) => event.aiProcessingAllowed)
    .filter((event) => canAccessTimelineEvent({ actor, event, grants }, 'ai_process'))
    .map((event) => ({
      sourceId: event.id,
      title: event.title,
      summary: event.description ?? event.title,
      occurredAt: event.startAt
    }));
}
