import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(process.cwd());
const readSource = (path: string): Promise<string> => readFile(resolve(sourceRoot, path), 'utf8');

describe('desktop user-visible release boundary', () => {
  it('exposes only the public release DTO through app:getInfo', async () => {
    const [main, preload, globalType] = await Promise.all([
      readSource('apps/desktop/src/main/main.ts'),
      readSource('apps/desktop/src/main/preload.ts'),
      readSource('apps/desktop/src/renderer/global.d.ts')
    ]);

    expect(main).toContain("registerIpcHandler('app:getInfo', () => USER_VISIBLE_APP_INFO)");
    expect(main).not.toContain("registerIpcHandler('app:getInfo', () => APP_META)");
    expect(preload).toContain('export type AppInfo = UserVisibleAppInfo;');
    expect(globalType).toContain('getAppInfo(): Promise<UserVisibleAppInfo>;');
  });

  it('renders the public release label without internal version fields', async () => {
    const [app, ui] = await Promise.all([
      readSource('apps/desktop/src/renderer/App.tsx'),
      readSource('apps/desktop/src/renderer/ui.tsx')
    ]);

    expect(app).toContain('appInfo.releaseLabel');
    expect(app).toContain('formatUserVisibleReleaseSummary(USER_VISIBLE_APP_INFO');
    expect(app).not.toContain("'Bronze · Active Development'");
    expect(app).not.toContain("{appInfo.channel} · {t('shell.version')} {appInfo.releaseLabel}");
    expect(app).not.toContain('APP_META.version');
    expect(app).not.toContain('appInfo.version');
    expect(app).not.toContain('appInfo.edition');
    expect(ui).toContain('USER_VISIBLE_APP_INFO.releaseLabel');
    expect(ui).not.toContain('APP_META.stage');
  });

  it('generates a canonical public delivery file in the deliveries directory', async () => {
    const generator = await readSource('scripts/generate-current-delivery-report.mjs');
    expect(generator).toContain('userVisibleDeliveryFileName');
    expect(generator).toContain("'artifacts', 'deliveries'");
    expect(generator).toContain('ParsYuva_Aile_Yasam_Merkezi_');
    expect(generator).toContain('RC2?|MVP|Build');
  });
});
