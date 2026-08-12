import type { ProductSurfaceGovernanceView } from '@ppt/domain';

export interface ProductSurfaceGovernanceRepositoryPort {
  read(): ProductSurfaceGovernanceView;
}
