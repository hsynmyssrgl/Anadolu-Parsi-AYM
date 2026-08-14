import { describe, expect, it, vi } from 'vitest';
import type { FamilyMutationResultView, FamilyMutationRevisionsView } from '@ppt/domain';
import { AsyncWriteGuard, MutationRevisionWatermark } from '../src/renderer/async-state-guard';

const revisions = (overrides: Partial<FamilyMutationRevisionsView> = {}): FamilyMutationRevisionsView => ({
  graph: 0,
  timeline: 0,
  personCatalog: 0,
  eventCatalog: 0,
  dashboard: 0,
  notifications: 0,
  archive: 0,
  ...overrides
});

const mutation = (
  mutationId: string,
  changedRevisions: FamilyMutationResultView['changedRevisions'],
  values: Partial<FamilyMutationRevisionsView>
): FamilyMutationResultView => ({
  mutationId,
  entityType: 'person',
  entityId: 'person-1',
  operation: 'updated',
  changedSections: ['graph'],
  changedRevisions,
  revisions: revisions(values),
  occurredAt: '2026-08-14T00:00:00.000Z'
});

describe('33-N async state guards', () => {
  it('accepts only the newest write in a scope and invalidates all tickets on session change', () => {
    const guard = new AsyncWriteGuard();
    const first = guard.start('screen:finance');
    const second = guard.start('screen:finance');
    const write = vi.fn();
    expect(guard.commit(first, write)).toBe(false);
    expect(guard.commit(second, write)).toBe(true);
    expect(write).toHaveBeenCalledOnce();
    guard.invalidateAll();
    expect(guard.isCurrent(second)).toBe(false);
  });

  it('isolates concurrent scopes and rejects blank scope identifiers', () => {
    const guard = new AsyncWriteGuard();
    const finance = guard.start('finance');
    const archive = guard.start('archive');
    guard.invalidate('finance');
    expect(guard.isCurrent(finance)).toBe(false);
    expect(guard.isCurrent(archive)).toBe(true);
    expect(() => guard.start('   ')).toThrow(/boş/i);
  });

  it('suppresses duplicate mutations and never regresses revision watermarks', () => {
    const watermark = new MutationRevisionWatermark();
    const first = mutation('mutation-1', ['graph'], { graph: 3 });
    expect(watermark.accept(first)).toMatchObject({ accepted: true, duplicate: false, advancedKeys: ['graph'] });
    expect(watermark.accept(first)).toMatchObject({ accepted: false, duplicate: true });
    expect(watermark.accept(mutation('mutation-2', ['graph'], { graph: 2 }))).toMatchObject({
      accepted: false,
      duplicate: false,
      revisions: { graph: 3 }
    });
  });

  it('fails closed for malformed or duplicated changed revision keys', () => {
    const watermark = new MutationRevisionWatermark();
    expect(() => watermark.accept(mutation('mutation-invalid', ['graph'], { graph: -1 }))).toThrow(/Geçersiz/i);
    expect(() => watermark.accept(mutation('mutation-duplicate', ['graph', 'graph'], { graph: 1 }))).toThrow(/yinelenemez/i);
  });
});
