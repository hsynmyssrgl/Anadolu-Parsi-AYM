import type { ProductSurfaceGovernanceView } from '@ppt/domain';

export interface ProductSurfaceGovernanceQueryPort {
  read(): ProductSurfaceGovernanceView;
}

export class GetProductSurfaceGovernanceUseCase {
  public constructor(private readonly query: ProductSurfaceGovernanceQueryPort) {}

  public execute(): ProductSurfaceGovernanceView {
    const view = this.query.read();
    if (
      view.enforcement !== 'fail-closed'
      || view.navigationRouteCount !== view.menuEntryCount
      || view.menuEntryCount !== view.renderedScreenCount
      || view.productModuleCount + view.governanceSurfaceCount !== view.navigationRouteCount
      || view.classifiedUnusedRendererApiCount !== view.unusedRendererApis.length
      || view.unresolvedUnusedRendererApiCount !== 0
    ) throw new Error('Ürün yüzeyi yönetişim sözleşmesi tutarsızdır.');
    return view;
  }
}
