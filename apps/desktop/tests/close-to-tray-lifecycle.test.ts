import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const mainUrl = new URL('../src/main/main.ts', import.meta.url);
const buildUrl = new URL('../scripts/build-electron.mjs', import.meta.url);
const iconUrl = new URL('../build/icon.ico', import.meta.url);
const trayIconUrl = new URL('../build/tray-icon.png', import.meta.url);

describe('close-to-tray lifecycle', () => {
  it('hides the primary window on X or Alt+F4 and keeps an explicit quit path', async () => {
    const main = await readFile(mainUrl, 'utf8');
    for (const marker of [
      "new Tray(join(currentDir, 'tray-icon.png'))",
      "icon: join(currentDir, 'window-icon.ico')",
      "titleBarStyle: 'hidden'",
      "symbolColor: '#5B5148'",
      'roundedCorners: true',
      "label: mainText('Uygulamayı aç','Open application')",
      "label: mainText('Kilitle','Lock')",
      "label: mainText('Tamamen kapat','Quit completely')",
      "window.on('close', (event) =>",
      'event.preventDefault();',
      'window.hide();',
      "content: mainText('Uygulama tamamen kapanmadı; sistem tepsisinde çalışmaya devam ediyor.', 'The application did not quit; it is still running in the system tray.')"
    ]) expect(main).toContain(marker);
    expect(main).toMatch(/if \(result\.response !== 0\) return;\s+explicitApplicationQuit = true;\s+app\.quit\(\);/u);
    expect(main).toMatch(/app\.on\('before-quit',[\s\S]*explicitApplicationQuit = true;/u);
  });

  it('ships dedicated small-surface tray and multi-resolution window icons', async () => {
    const [build,icon,trayIcon] = await Promise.all([readFile(buildUrl,'utf8'),readFile(iconUrl),readFile(trayIconUrl)]);
    expect(build).toContain("resolve(desktopRoot, 'build/tray-icon.png')");
    expect(build).toContain("resolve(outputDirectory, 'tray-icon.png')");
    expect(build).toContain("resolve(desktopRoot, 'build/icon.ico')");
    expect(build).toContain("resolve(outputDirectory, 'window-icon.ico')");
    expect(icon.readUInt16LE(4)).toBe(8);
    const sizes=Array.from({length:icon.readUInt16LE(4)},(_,index)=>{
      const encoded=icon.readUInt8(6+(index*16));
      return encoded===0?256:encoded;
    });
    expect(sizes).toEqual([16,20,24,32,48,64,128,256]);
    expect(trayIcon.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(trayIcon.readUInt32BE(16)).toBe(64);
    expect(trayIcon.readUInt32BE(20)).toBe(64);
  });
});
