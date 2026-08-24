import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_PRODUCT_NAVIGATION_AUTHORITY,
  PRODUCT_NAVIGATION_GROUPS,
  PRODUCT_NAVIGATION_ROUTES,
  parseCanonicalProductNavigationSource
} from '../../../scripts/lib/canonical-product-navigation.mjs';

const root = resolve(import.meta.dirname, '../../..');

describe('tracked canonical product navigation authority', () => {
  it('loads exact tracked HEAD TypeScript source as 4 groups and 22 routes', () => {
    expect(PRODUCT_NAVIGATION_GROUPS).toHaveLength(4);
    expect(PRODUCT_NAVIGATION_ROUTES).toHaveLength(22);
    expect(CANONICAL_PRODUCT_NAVIGATION_AUTHORITY.sourcePath).toBe('packages/domain/src/product-surface-governance.ts');
    expect(CANONICAL_PRODUCT_NAVIGATION_AUTHORITY.sha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('rejects spread route authority instead of evaluating code', async () => {
    const source = await readFile(resolve(root, 'packages/domain/src/product-surface-governance.ts'), 'utf8');
    const forged = source.replace("kind: 'product-module' })", "kind: 'product-module', ...extra })");
    expect(() => parseCanonicalProductNavigationSource(forged)).toThrow(/spread/u);
  });

  it('rejects duplicate canonical declarations', async () => {
    const source = await readFile(resolve(root, 'packages/domain/src/product-surface-governance.ts'), 'utf8');
    expect(() => parseCanonicalProductNavigationSource(`${source}\nexport const PRODUCT_NAVIGATION_GROUPS = [] as const;\n`))
      .toThrow(/parse edilemedi|yinelenen declaration/u);
  });

  it('keeps installed runner and final producer off ignored dist authority', async () => {
    for (const path of ['scripts/run-installed-frontend-user-uat.mjs', 'scripts/create-bronze-final-local-test-delivery.mjs']) {
      const source = await readFile(resolve(root, path), 'utf8');
      expect(source).toContain("from './lib/canonical-product-navigation.mjs'");
      expect(source).not.toContain('packages/domain/dist/renderer.js');
    }
  });
});
