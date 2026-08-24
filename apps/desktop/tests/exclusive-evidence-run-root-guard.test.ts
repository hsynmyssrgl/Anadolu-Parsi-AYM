import { mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { acquireExclusiveEvidenceRunRootGuard } from '../../../scripts/lib/exclusive-evidence-run-root-guard.mjs';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('exclusive evidence run-root guard', () => {
  it('uses a Windows FileStream without delete sharing and holds it until explicit close', async () => {
    const source = await readFile(new URL('../../../scripts/lib/exclusive-evidence-run-root-guard.mjs', import.meta.url), 'utf8');
    expect(source).toContain('[IO.FileShare]::Read');
    expect(source).not.toContain('[IO.FileShare]::Delete');
    expect(source).toContain("await open(guardPath, 'wx')");
    expect(source).toContain('assertEvidenceRunRootNoReparse');
    expect(source.indexOf('await readGuardBytes(guardPath, guardBytes);')).toBeLessThan(source.indexOf("child.stdin.end('\\n')"));
  });

  it('prevents a live run root from being renamed on Windows and releases it only after readback', async () => {
    if (process.platform !== 'win32') return;
    const category = await mkdtemp(resolve(tmpdir(), 'parsyuva-evidence-category-'));
    roots.push(category);
    const runRoot = resolve(category, '2d68d677-f984-4c3f-900d-e562ab85ea8a');
    const movedRoot = resolve(category, 'moved-run-root');
    await mkdir(runRoot);
    const guard = await acquireExclusiveEvidenceRunRootGuard({ runRoot, boundary: category });
    await expect(rename(runRoot, movedRoot)).rejects.toBeDefined();
    await guard.assertIntact();
    await guard.close();
    await expect(rename(runRoot, movedRoot)).resolves.toBeUndefined();
  });

  it('fails closed without hanging when the READY guard process is killed', async () => {
    if (process.platform !== 'win32') return;
    const category = await mkdtemp(resolve(tmpdir(), 'parsyuva-evidence-category-'));
    roots.push(category);
    const runRoot = resolve(category, '853369a4-e812-44de-a97f-a867a44106ea');
    await mkdir(runRoot);
    const guard = await acquireExclusiveEvidenceRunRootGuard({ runRoot, boundary: category });
    expect(guard.guardProcessId).toBeTypeOf('number');
    process.kill(guard.guardProcessId);
    const deadline = Date.now() + 5_000;
    let terminationObserved = false;
    while (Date.now() < deadline && !terminationObserved) {
      terminationObserved = await guard.assertIntact().then(() => false, () => true);
      if (!terminationObserved) await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
    expect(terminationObserved).toBe(true);
    await expect(Promise.race([
      guard.close(),
      new Promise((_, rejectTimeout) => setTimeout(() => rejectTimeout(new Error('close timeout')), 1_000)),
    ])).rejects.toThrow(/not alive|unexpectedly/u);
  });
});
