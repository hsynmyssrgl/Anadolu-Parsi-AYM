import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreServicePolicyJournalMonotonicAuthority } from '../src/policy-journal-monotonic-authority.js';

const roots: string[] = [];
const NOW = '2026-08-11T08:00:00.000Z';

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('31-W Core Service external monotonic journal authority', () => {
  it('survives process reconstruction, is idempotent and rejects coordinated database+journal rollback', () => {
    const root = mkdtempSync(join(tmpdir(), 'ppt-policy-monotonic-authority-'));
    roots.push(root);
    const filePath = join(root, 'core-service-authority', 'policy-journal.json');
    const key = randomBytes(32);
    const first = new CoreServicePolicyJournalMonotonicAuthority({ filePath, authorityKey: key, clock: () => NOW });
    const genesis = first.checkpoint({ journalSequence: 0, journalHeadHash: '0'.repeat(64), journalSizeBytes: 0 });
    expect(genesis).toMatchObject({ authorityEpoch: 1, journalSequence: 0 });
    const one = first.checkpoint({ journalSequence: 1, journalHeadHash: '1'.repeat(64), journalSizeBytes: 1024 });
    expect(one).toMatchObject({ authorityEpoch: 2, journalSequence: 1, journalSizeBytes: 1024 });
    expect(first.checkpoint({ journalSequence: 1, journalHeadHash: '1'.repeat(64), journalSizeBytes: 1024 })).toEqual(one);
    first.dispose();

    const restarted = new CoreServicePolicyJournalMonotonicAuthority({ filePath, authorityKey: key, clock: () => NOW });
    expect(() => restarted.checkpoint({ journalSequence: 0, journalHeadHash: '0'.repeat(64), journalSizeBytes: 0 }))
      .toThrow(/POLICY_JOURNAL_ROLLBACK_DETECTED/u);
    expect(() => restarted.checkpoint({ journalSequence: 1, journalHeadHash: '2'.repeat(64), journalSizeBytes: 1024 }))
      .toThrow(/POLICY_JOURNAL_EQUIVOCATION_DETECTED/u);
    const two = restarted.checkpoint({ journalSequence: 2, journalHeadHash: '2'.repeat(64), journalSizeBytes: 2048 });
    expect(two).toMatchObject({ authorityEpoch: 3, journalSequence: 2 });
    restarted.dispose();
  });
});
