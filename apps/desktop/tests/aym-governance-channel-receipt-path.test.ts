import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canonicalChannelSourceProtectionPath,
  readCanonicalChannelSourceProtection
} from '../../../scripts/lib/aym-source-authority.mjs';

const treeSha256 = 'a'.repeat(64);
const protection = {
  schemaVersion: 2,
  source: '06_KOD/kanallar/Bronze',
  treeSha256
};
const protectionBytes = Buffer.from(`${JSON.stringify(protection, null, 2)}\n`);

const createCanonicalProtection = async (aymRoot: string) => {
  const receiptRoot = join(aymRoot, '05_TEST', '30Z_LOCAL_RECEIPT', 'Bronze');
  await mkdir(receiptRoot, { recursive: true });
  await writeFile(join(receiptRoot, 'LATEST.json'), protectionBytes);
  await writeFile(join(receiptRoot, `PROTECTION_${treeSha256}.json`), protectionBytes);
  return receiptRoot;
};

describe('AYM governance channel receipt path', () => {
  it('gates the updater before its first write and makes the verifier recapture live authority', () => {
    const updater = readFileSync('scripts/update-aym-governance-incrementally.mjs', 'utf8');
    const verifier = readFileSync('scripts/verify-aym-governance-incremental-contract.mjs', 'utf8');
    const gate = 'verifyAymGovernanceSourceAuthority({ sourceRoot, aymRoot })';
    expect(updater).toContain(gate);
    expect(updater.indexOf(gate)).toBeLessThan(updater.indexOf('await createInitialSnapshot()'));
    expect(updater).not.toContain('mainHeadCommit()');
    expect(verifier).toContain(gate);
    expect(verifier).toContain('sourceAuthority.appDiskReadback.sha256 === sourceAuthority.bronzeDiskReadback.sha256');
    expect(verifier).not.toContain("readJson(resolve(aymRoot, '05_TEST', '30Z_LOCAL_RECEIPT', 'Bronze', 'LATEST.json'))");
  });

  it('accepts only canonical Bronze LATEST bytes that equal the immutable protection record', async () => {
    const aymRoot = await mkdtemp(join(tmpdir(), 'parsyuva-canonical-latest-'));
    try {
      const receiptRoot = await createCanonicalProtection(aymRoot);
      const canonicalPath = canonicalChannelSourceProtectionPath({ aymRoot, expectedChannel: 'Bronze' });
      await expect(readCanonicalChannelSourceProtection({
        aymRoot,
        expectedChannel: 'Bronze',
        suppliedPath: canonicalPath
      })).resolves.toMatchObject({
        value: protection,
        binding: { fullPath: canonicalPath, noReparseReadbackVerified: true }
      });

      const copiedPath = join(receiptRoot, 'COPIED-LATEST.json');
      await writeFile(copiedPath, protectionBytes);
      await expect(readCanonicalChannelSourceProtection({
        aymRoot,
        expectedChannel: 'Bronze',
        suppliedPath: copiedPath
      })).rejects.toThrow(/exact canonical Bronze LATEST path/u);

      await writeFile(join(receiptRoot, `PROTECTION_${treeSha256}.json`), Buffer.from('{}\n'));
      await expect(readCanonicalChannelSourceProtection({ aymRoot, expectedChannel: 'Bronze' }))
        .rejects.toThrow(/does not equal its immutable protection record/u);

      await writeFile(join(receiptRoot, `PROTECTION_${treeSha256}.json`), protectionBytes);
      const externalReceiptSha256 = 'b'.repeat(64);
      const completedProtection = {
        ...protection,
        externalLibraryReceiptStatus: 'PASS',
        officialCompletionClaimed: true,
        externalReceipt: { sha256: externalReceiptSha256 }
      };
      const completedBytes = Buffer.from(`${JSON.stringify(completedProtection, null, 2)}\n`);
      const completedPath = join(receiptRoot, `PROTECTION_${treeSha256}_${externalReceiptSha256}.json`);
      await writeFile(completedPath, completedBytes);
      await writeFile(join(receiptRoot, 'LATEST.json'), completedBytes);
      await expect(readCanonicalChannelSourceProtection({ aymRoot, expectedChannel: 'Bronze' }))
        .resolves.toMatchObject({ value: completedProtection, binding: { immutablePath: completedPath } });
      expect(readFileSync(join(receiptRoot, `PROTECTION_${treeSha256}.json`))).toEqual(protectionBytes);

      await writeFile(completedPath, Buffer.from('{}\n'));
      await expect(readCanonicalChannelSourceProtection({ aymRoot, expectedChannel: 'Bronze' }))
        .rejects.toThrow(/does not equal its immutable protection record/u);
    } finally {
      await rm(aymRoot, { recursive: true, force: true });
    }
  });

  it('rejects a junction/reparse AYM evidence root', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'parsyuva-canonical-junction-'));
    const realRoot = join(fixtureRoot, 'real');
    const junctionRoot = join(fixtureRoot, 'junction');
    try {
      await createCanonicalProtection(realRoot);
      await symlink(realRoot, junctionRoot, 'junction');
      await expect(readCanonicalChannelSourceProtection({ aymRoot: junctionRoot, expectedChannel: 'Bronze' }))
        .rejects.toThrow(/reparse|realpath drifted/u);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});
