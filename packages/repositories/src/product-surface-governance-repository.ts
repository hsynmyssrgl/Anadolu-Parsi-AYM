import { createProductSurfaceGovernanceView, type ProductSurfaceGovernanceView } from '@ppt/domain';
import type { ProductSurfaceGovernanceRepositoryPort } from '@ppt/repository-contracts';

export class StaticProductSurfaceGovernanceRepository implements ProductSurfaceGovernanceRepositoryPort {
  public read(): ProductSurfaceGovernanceView {
    return createProductSurfaceGovernanceView();
  }
}
