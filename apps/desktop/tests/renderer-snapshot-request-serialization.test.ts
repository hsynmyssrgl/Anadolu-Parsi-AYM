import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('renderer snapshot istek serileştirmesi', () => {
  it('latest-wins snapshot kanalına aynı anda iki istek göndermez', () => {
    const source=readFileSync('apps/desktop/src/renderer/App.tsx','utf8');
    expect(source).toContain('for(const section of sections)await ensureSnapshotSection(section);');
    expect(source).toContain("getSnapshotSections({sections:['graph','timeline']})");
    expect(source).not.toContain('Promise.all(sections.map(section=>ensureSnapshotSection(section)))');
    expect(source).not.toMatch(/Promise\.all\(\[window\.pardus\.getSnapshotSections\(\{sections:\['graph'\]\}\),window\.pardus\.getSnapshotSections\(\{sections:\['timeline'\]\}\)/u);
  });
});
