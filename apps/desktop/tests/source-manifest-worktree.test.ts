import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectSourceFilePaths } from '../../../scripts/lib/source-manifest.mjs';

describe('source manifest worktree compatibility', () => {
  it('excludes the Git administrative file used by linked worktrees', async () => {
    const root = mkdtempSync(join(tmpdir(), 'parsyuva-source-manifest-worktree-'));
    try {
      writeFileSync(join(root, '.git'), 'gitdir: C:/example/.git/worktrees/Bronze\n');
      writeFileSync(join(root, 'package.json'), '{"version":"1.0.0"}\n');
      writeFileSync(join(root, 'source.txt'), 'governed source\n');
      expect(await collectSourceFilePaths(root)).toEqual(['package.json', 'source.txt']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
