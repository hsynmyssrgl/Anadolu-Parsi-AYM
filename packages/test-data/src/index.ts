import {
  asEventId,
  asFamilyId,
  asPersonId,
  asUserId,
  type Family,
  type Person,
  type TimelineEvent
} from '@ppt/domain';

export const demoFamily: Family = {
  id: asFamilyId('demo-family'),
  name: 'Deneme Ailesi',
  createdAt: '2026-07-20T00:00:00Z'
};

export const demoPeople: Person[] = [
  { id: asPersonId('demo-person-1'), displayName: 'Test Kişisi 1', birthDate: '1985-03-15' },
  { id: asPersonId('demo-person-2'), displayName: 'Test Kişisi 2', birthDate: '1982-09-05' },
  { id: asPersonId('demo-person-3'), displayName: 'Elif Deneme', birthDate: '2012-06-11' }
];

export const demoEvents: TimelineEvent[] = [
  {
    id: asEventId('demo-event-1'),
    familyId: demoFamily.id,
    kind: 'important_day',
    title: 'Aile buluşması',
    description: 'Fotoğraflar, davetiye ve konum bilgisiyle sentetik etkinlik.',
    startAt: '2026-06-21T11:00:00Z',
    participantPersonIds: demoPeople.map((person) => person.id),
    visibility: 'family',
    allowedPersonIds: [],
    location: { label: 'Deneme Bahçesi', address: 'Örnek Mahallesi' },
    attachmentIds: [],
    sensitivity: 'normal',
    aiProcessingAllowed: true,
    createdBy: asUserId('demo-user-1'),
    createdAt: '2026-05-01T10:00:00Z'
  },
  {
    id: asEventId('demo-event-2'),
    familyId: demoFamily.id,
    kind: 'education',
    title: 'Mezuniyet töreni',
    description: 'Kişisel zaman tüneli örneği.',
    startAt: '2025-06-14T14:00:00Z',
    participantPersonIds: [demoPeople[2]!.id],
    ownerPersonId: demoPeople[2]!.id,
    visibility: 'family',
    allowedPersonIds: [],
    attachmentIds: [],
    sensitivity: 'normal',
    aiProcessingAllowed: true,
    createdBy: asUserId('demo-user-1'),
    createdAt: '2025-06-14T16:00:00Z'
  }
];
