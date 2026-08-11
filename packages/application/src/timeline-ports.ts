import type { FamilyId, TimelineEvent } from '@ppt/domain';

export interface TimelineRepository {
  listByFamily(familyId: FamilyId): Promise<TimelineEvent[]>;
  save(event: TimelineEvent): Promise<void>;
}
