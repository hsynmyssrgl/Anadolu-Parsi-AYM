import { describe, expect, it, vi } from 'vitest';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId, asUserId } from '@ppt/core';
import { RepositoryBackedUnifiedAuthorizedSearchSourcePort } from '../src/main/unified-authorized-search-application-adapter.js';

const context = Object.freeze({
  familyId: asFamilyId('family-33-r'),
  actor: { userId: asUserId('account-33-r'), role: 'family_admin' as const, personId: asPersonId('person-33-r') },
  correlationId: asCorrelationId('unified-search-adapter')
});

const dependencies = () => ({
  loadFamilyAndEvents: vi.fn(async () => ({
    family: { id: 'family-33-r', name: 'Aile' },
    people: [{ id: 'person-1', displayName: 'Ayşe', relationshipType: 'anne', generation: 1, branch: 'ana', status: 'active' as const, initials: 'AY' }],
    events: [{ id: 'event-1', kind: 'important_day', title: 'Kontrol', startAt: '2026-08-15T10:00:00.000Z', visibility: 'family' as const, participantPersonIds: [], attachmentCount: 0, aiProcessingAllowed: false, recurrence: 'none' as const, reminderDays: [], createdAt: '2026-08-15T09:00:00.000Z' }],
    loadedSections: ['graph', 'timeline'] as const,
    lastUpdatedAt: '2026-08-15T10:00:00.000Z'
  })),
  listArchive: vi.fn(async () => [{ id: 'archive-1', title: 'Rapor', originalName: 'rapor.pdf', mimeType: 'application/pdf', sizeBytes: 10, sha256: 'a'.repeat(64), createdAt: '2026-08-15T10:00:00.000Z' }]),
  listFinance: vi.fn(async () => [{ id: 'finance-1', ownerPersonId: 'person-1', title: 'Ödeme', kind: 'expense' as const, amount: 10, currency: 'TRY', privacy: 'private' as const, notes: 'renderer sonucuna çıkmamalı', occurredAt: '2026-08-15T10:00:00.000Z', createdAt: '2026-08-15T10:00:00.000Z' }]),
  listHealth: vi.fn(async () => []),
  listLife: vi.fn(async () => []),
  now: () => asIsoDateTime('2026-08-15T11:00:00.000Z')
});

describe('RepositoryBackedUnifiedAuthorizedSearchSourcePort', () => {
  it('loads only selected governed sources and projects bounded search-only candidates', async () => {
    const deps = dependencies();
    const result = await new RepositoryBackedUnifiedAuthorizedSearchSourcePort(deps)
      .loadAuthorizedCandidates(context, ['family', 'finance']);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((item) => item.module)).toEqual(['family', 'finance']);
    expect(deps.loadFamilyAndEvents).toHaveBeenCalledOnce();
    expect(deps.listFinance).toHaveBeenCalledOnce();
    expect(deps.listArchive).not.toHaveBeenCalled();
    expect(deps.listHealth).not.toHaveBeenCalled();
    expect(deps.listLife).not.toHaveBeenCalled();
    expect(JSON.stringify(result.value)).not.toContain('renderer sonucuna çıkmamalı');
  });

  it('fails the whole source load when any governed dependency rejects', async () => {
    const deps = dependencies();
    deps.listHealth.mockRejectedValueOnce(new Error('permission denied'));
    const result = await new RepositoryBackedUnifiedAuthorizedSearchSourcePort(deps)
      .loadAuthorizedCandidates(context, ['archive', 'health']);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.category).toBe('authorization');
  });
});
