import { describe, expect, it } from 'vitest';
import {
  asEventId,
  asFamilyId,
  asPersonId,
  asUserId,
  buildFamilyTimeline,
  buildPersonalTimeline,
  type TimelineEvent
} from '../src/index.js';
import { buildAiTimelineContext } from '../src/ai-memory.js';

const familyId = asFamilyId('family-1');
const personA = asPersonId('person-a');
const personB = asPersonId('person-b');
const actor = {
  userId: asUserId('user-a'),
  personId: personA,
  familyId,
  branchIds: ['branch-1'],
  roles: ['family_member'],
  now: '2026-07-20T12:00:00Z'
};

const events: TimelineEvent[] = [
  {
    id: asEventId('event-family'), familyId, kind: 'important_day', title: 'Aile buluşması',
    startAt: '2025-07-20T10:00:00Z', participantPersonIds: [personA, personB],
    visibility: 'family', allowedPersonIds: [], attachmentIds: [], sensitivity: 'normal',
    aiProcessingAllowed: true, createdBy: actor.userId, createdAt: '2025-07-01T10:00:00Z'
  },
  {
    id: asEventId('event-private'), familyId, kind: 'health', title: 'Özel sağlık kaydı',
    startAt: '2026-01-01T10:00:00Z', participantPersonIds: [personB], ownerPersonId: personB,
    visibility: 'personal', allowedPersonIds: [], attachmentIds: [], sensitivity: 'highly_sensitive',
    aiProcessingAllowed: false, createdBy: asUserId('user-b'), createdAt: '2026-01-01T10:00:00Z'
  }
];

describe('timeline authorization', () => {
  it('shows family event but not another adult private event', () => {
    expect(buildFamilyTimeline({ actor, events })).toHaveLength(1);
  });

  it('builds a person timeline from shared events', () => {
    expect(buildPersonalTimeline({ actor, events, personId: personA })).toHaveLength(1);
  });

  it('excludes AI-disallowed records from AI context', () => {
    expect(buildAiTimelineContext(actor, events)).toEqual([
      expect.objectContaining({ sourceId: 'event-family' })
    ]);
  });
});
