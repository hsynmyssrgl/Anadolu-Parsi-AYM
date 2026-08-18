import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const mainUrl = new URL('../src/main/main.ts', import.meta.url);
const buildUrl = new URL('../scripts/build-electron.mjs', import.meta.url);

describe('close-to-tray lifecycle', () => {
  it('hides the primary window on X or Alt+F4 and keeps an explicit quit path', async () => {
    const main = await readFile(mainUrl, 'utf8');
    for (const marker of [
      "new Tray(join(currentDir, 'tray-icon.png'))",
      "label: 'Uygulamayı aç'",
      "label: 'Kilitle'",
      "label: 'Tamamen kapat'",
      "window.on('close', (event) =>",
      'event.preventDefault();',
      'window.hide();',
      "content: 'Uygulama tamamen kapanmadı; sistem tepsisinde çalışmaya devam ediyor.'"
    ]) expect(main).toContain(marker);
    expect(main).toMatch(/if \(result\.response !== 0\) return;\s+explicitApplicationQuit = true;\s+app\.quit\(\);/u);
    expect(main).toMatch(/app\.on\('before-quit',[\s\S]*explicitApplicationQuit = true;/u);
  });

  it('copies the trusted brand mark into the packaged main runtime', async () => {
    const build = await readFile(buildUrl, 'utf8');
    expect(build).toContain("resolve(desktopRoot, 'src/renderer/assets/brand-mark.png')");
    expect(build).toContain("resolve(outputDirectory, 'tray-icon.png')");
  });
});
