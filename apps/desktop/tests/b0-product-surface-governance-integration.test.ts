import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRODUCT_NAVIGATION_ROUTES } from '@ppt/domain';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';

const read = (path: string): string => readFileSync(path, 'utf8');
const app = read('apps/desktop/src/renderer/App.tsx');
const main = read('apps/desktop/src/main/main.ts');
const preload = read('apps/desktop/src/main/preload.ts');
const declarations = read('apps/desktop/src/renderer/global.d.ts');
const inventory = JSON.parse(read('config/32-w-b0-03-b0-04-product-surface-governance-inventory.json')) as {
  routes: Array<{ id: string }>;
  unusedRendererApis: Array<{ method: string; channel: string; classification: string }>;
};

describe('32-W B0-03/B0-04 desktop product surface integration', () => {
  it('derives menu items and groups from the shared domain navigation contract', () => {
    expect(PRODUCT_NAVIGATION_ROUTES).toHaveLength(22);
    expect(app).toContain('PRODUCT_NAVIGATION_ROUTES.map');
    expect(app).toContain('PRODUCT_NAVIGATION_GROUPS.map');
    expect(app).not.toMatch(/const navItems[^=]*=\s*\[/u);
    expect(inventory.routes.map((route) => route.id)).toEqual(PRODUCT_NAVIGATION_ROUTES.map((route) => route.id));
  });

  it('exposes one content-free and zero-argument governance IPC boundary', () => {
    expect(main).toContain("registerIpcHandler('system:getProductSurfaceGovernance'");
    expect(preload).toContain("getProductSurfaceGovernance:():Promise<ProductSurfaceGovernanceView>=>invoke('system:getProductSurfaceGovernance')");
    expect(declarations).toContain('getProductSurfaceGovernance():Promise<ProductSurfaceGovernanceView>');
    expect(evaluateIpcIntegrationPolicy('system:getProductSurfaceGovernance', [])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('system:getProductSurfaceGovernance', ['unexpected'])).toMatchObject({ accepted: false });
  });

  it('renders the verified counts and classifies the exact current 14 API set', () => {
    expect(app).toContain('B0-03 / B0-04 · ürün yüzeyi gerçeklik kapısı');
    expect(app).toContain('getProductSurfaceGovernance().then(setProductSurfaceGovernance)');
    expect(inventory.unusedRendererApis).toHaveLength(14);
    expect(new Set(inventory.unusedRendererApis.map((item) => `${item.method}:${item.channel}`)).size).toBe(14);
    expect(inventory.unusedRendererApis.every((item) => [
      'BACKGROUND_OPERATIONAL',
      'DIAGNOSTIC_OPERATOR_API',
      'SUPERSEDED_READ_MODEL'
    ].includes(item.classification))).toBe(true);
  });
});
