import { describe, expect, it } from 'vitest';
import { asUserId } from '@ppt/domain';
import { InMemoryTimelineRepository } from './in-memory-timeline-repository.js';
import { demoEvents, demoFamily, demoPeople } from '@ppt/test-data';
import { FamilyTimelineService } from '../src/index.js';

describe('FamilyTimelineService', () => {
  it('returns the authorized family timeline', async () => {
    const service = new FamilyTimelineService(new InMemoryTimelineRepository(demoEvents));
    const result = await service.getFamilyTimeline(demoFamily.id, {
      userId: asUserId('demo-user-1'),
      personId: demoPeople[0]!.id,
      familyId: demoFamily.id,
      branchIds: ['demo-branch'],
      roles: ['family_admin'],
      now: '2026-07-20T00:00:00Z'
    });
    expect(result.map((event) => event.title)).toEqual([
      'Mezuniyet töreni',
      'Aile buluşması'
    ]);
  });
});
