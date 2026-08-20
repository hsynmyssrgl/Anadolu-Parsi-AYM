import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

describe('34-L teslimat calisma agaci envanteri', () => {
  it('deterministik anlik goruntuyu icerik sizdirmadan ve sahiplik iddiasi kurmadan dogrular', () => {
    const inventory = JSON.parse(readFileSync(
      resolve(root, 'artifacts/inventory/TESLIMAT_CALISMA_AGACI_ENVANTERI.json'),
      'utf8'
    )) as {
      sourceBaseHead: string;
      snapshotSha256: string;
      entries: Array<{ path: string; sha256: string | null; group: string }>;
      authorOrOwnerAttributionMade: boolean;
      finalCommitBindingEstablished: boolean;
      installerProducedByThisOperation: boolean;
      destructiveActionPerformed: boolean;
      excludedSelfGeneratedPaths: string[];
    };
    expect(inventory.entries.length).toBeGreaterThan(0);
    expect(inventory.entries.every((entry) => entry.path.length > 0 && entry.group.length > 0
      && (entry.sha256 === null || /^[0-9a-f]{64}$/u.test(entry.sha256)))).toBe(true);
    expect(inventory.authorOrOwnerAttributionMade).toBe(false);
    expect(inventory.finalCommitBindingEstablished).toBe(false);
    expect(inventory.installerProducedByThisOperation).toBe(false);
    expect(inventory.destructiveActionPerformed).toBe(false);
    expect(inventory.entries.some((entry) => inventory.excludedSelfGeneratedPaths.includes(entry.path))).toBe(false);
    expect(new Set(inventory.entries.map((entry) => entry.path)).size).toBe(inventory.entries.length);
    expect(inventory.entries.map((entry) => entry.path)).toEqual(
      [...inventory.entries.map((entry) => entry.path)].sort((left, right) => left.localeCompare(right, 'en'))
    );
    expect(createHash('sha256').update(Buffer.from(JSON.stringify({
      sourceBaseHead: inventory.sourceBaseHead,
      excludedSelfGeneratedPaths: inventory.excludedSelfGeneratedPaths,
      entries: inventory.entries
    }), 'utf8')).digest('hex')).toBe(inventory.snapshotSha256);
  });
});
