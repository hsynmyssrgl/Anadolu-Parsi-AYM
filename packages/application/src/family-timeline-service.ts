import {
  buildFamilyTimeline,
  buildPersonalTimeline,
  type ActorContext,
  type FamilyId,
  type PersonId,
  type TimelineEvent
} from '@ppt/domain';
import type { TimelineRepository } from './timeline-ports.js';

export class FamilyTimelineService {
  public constructor(private readonly repository: TimelineRepository) {}

  public async getFamilyTimeline(
    familyId: FamilyId,
    actor: ActorContext
  ): Promise<TimelineEvent[]> {
    const events = await this.repository.listByFamily(familyId);
    return buildFamilyTimeline({ actor, events });
  }

  public async getPersonalTimeline(
    familyId: FamilyId,
    personId: PersonId,
    actor: ActorContext
  ): Promise<TimelineEvent[]> {
    const events = await this.repository.listByFamily(familyId);
    return buildPersonalTimeline({ actor, events, personId });
  }
}
