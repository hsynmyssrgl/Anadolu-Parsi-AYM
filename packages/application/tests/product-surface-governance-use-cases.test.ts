import { describe, expect, it } from 'vitest';
import {
  CLASSIFIED_UNUSED_RENDERER_APIS,
  PRODUCT_NAVIGATION_ROUTES,
  createProductSurfaceGovernanceView,
  type ProductSurfaceGovernanceView
} from '@ppt/domain';
import { GetProductSurfaceGovernanceUseCase } from '../src/product-surface-governance-use-cases.js';

const query = { read: createProductSurfaceGovernanceView };

describe('32-W B0-03/B0-04 product surface governance use case', () => {
  it('returns the exact 17 product + 5 governance = 22 surface contract', () => {
    const view = new GetProductSurfaceGovernanceUseCase(query).execute();

    expect(view).toMatchObject({
      enforcement: 'fail-closed',
      productModuleCount: 17,
      governanceSurfaceCount: 5,
      navigationRouteCount: 22,
      menuEntryCount: 22,
      renderedScreenCount: 22,
      classifiedUnusedRendererApiCount: 14,
      unresolvedUnusedRendererApiCount: 0,
      historicalSixteenModuleClaimSuperseded: true,
      databaseMigrationRequired: false
    });
    expect(new Set(view.routes.map((route) => route.id)).size).toBe(22);
    expect(view.routes.filter((route) => route.kind === 'product-module')).toHaveLength(17);
    expect(view.routes.filter((route) => route.kind === 'governance-surface')).toHaveLength(5);
    expect(view.routes).toBe(PRODUCT_NAVIGATION_ROUTES);
    expect(view.unusedRendererApis).toBe(CLASSIFIED_UNUSED_RENDERER_APIS);
  });

  it('fails closed when route, menu and screen counts diverge', () => {
    const valid = createProductSurfaceGovernanceView();
    const inconsistent = { ...valid, menuEntryCount: 21 } as unknown as ProductSurfaceGovernanceView;
    const useCase = new GetProductSurfaceGovernanceUseCase({ read: () => inconsistent });
    expect(() => useCase.execute()).toThrowError(/tutarsızdır/u);
  });

  it('fails closed when an unused renderer API remains unresolved', () => {
    const valid = createProductSurfaceGovernanceView();
    const inconsistent = { ...valid, unresolvedUnusedRendererApiCount: 1 } as unknown as ProductSurfaceGovernanceView;
    const useCase = new GetProductSurfaceGovernanceUseCase({ read: () => inconsistent });
    expect(() => useCase.execute()).toThrowError(/tutarsızdır/u);
  });
});
