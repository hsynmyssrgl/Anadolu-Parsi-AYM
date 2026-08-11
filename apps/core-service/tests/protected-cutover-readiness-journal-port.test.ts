import { CORE_SERVICE_CUTOVER_READINESS_GENESIS_HASH } from '@ppt/core-service-contracts';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  DetachedProtectedCutoverReadinessJournal,
  type ProtectedCutoverReadinessCommit,
  type ProtectedCutoverReadinessJournalPort
} from '../src/protected-cutover-readiness-journal-port.js';

const genesisCommit = (): ProtectedCutoverReadinessCommit => {
  const anchor = Object.freeze({
    schemaVersion: 1 as const,
    epoch: 0,
    entryCount: 0,
    headHash: CORE_SERVICE_CUTOVER_READINESS_GENESIS_HASH
  });
  return Object.freeze({
    expectedAnchor: anchor,
    nextSnapshot: Object.freeze({ schemaVersion: 1 as const, entries: Object.freeze([]), anchor })
  });
};

describe('31-L protected cutover-readiness journal port', () => {
  it('exports a detached implementation that satisfies the persistence port', () => {
    const journal = new DetachedProtectedCutoverReadinessJournal();
    expectTypeOf(journal).toMatchTypeOf<ProtectedCutoverReadinessJournalPort>();
    expect(journal).toMatchObject({ protectionId: null, available: false });
  });

  it('rejects load so unavailability cannot masquerade as an empty journal', async () => {
    const journal = new DetachedProtectedCutoverReadinessJournal();
    await expect(journal.load()).rejects.toMatchObject({
      name: 'ProtectedCutoverReadinessJournalError',
      code: 'JOURNAL_UNAVAILABLE'
    });
  });

  it('rejects compare-and-swap without mutating the supplied commit', async () => {
    const journal = new DetachedProtectedCutoverReadinessJournal();
    const commit = genesisCommit();
    await expect(journal.compareAndSwap(commit)).rejects.toMatchObject({ code: 'JOURNAL_UNAVAILABLE' });
    expect(commit).toEqual(genesisCommit());
  });

  it('rejects seal so detached persistence cannot report a false successful seal', async () => {
    const journal = new DetachedProtectedCutoverReadinessJournal();
    await expect(journal.seal()).rejects.toMatchObject({ code: 'JOURNAL_UNAVAILABLE' });
  });
});
