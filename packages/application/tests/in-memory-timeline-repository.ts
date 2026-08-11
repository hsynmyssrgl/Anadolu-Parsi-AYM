import type { FamilyId, TimelineEvent } from '@ppt/domain';
import type { TimelineRepository } from '../src/timeline-ports.js';

export class InMemoryTimelineRepository implements TimelineRepository {
  readonly #events = new Map<string, TimelineEvent>();

  public constructor(initialEvents: readonly TimelineEvent[] = []) {
    for (const event of initialEvents) this.#events.set(event.id, structuredClone(event));
  }

  public async listByFamily(familyId: FamilyId): Promise<TimelineEvent[]> {
    return [...this.#events.values()]
      .filter((event) => event.familyId === familyId)
      .map((event) => structuredClone(event));
  }

  public async save(event: TimelineEvent): Promise<void> {
    this.#events.set(event.id, structuredClone(event));
  }
}
