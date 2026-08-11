import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type { FamilyLocationView } from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface LocationRecord {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly label: string;
  readonly address?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly kind: FamilyLocationView['kind'];
  readonly createdAt: IsoDateTime;
}

export interface LocationRepositoryPort {
  findById(
    context: PolicyAuthorizedRepositoryExecutionContext,
    familyId: FamilyId,
    locationId: string
  ): RepositoryResult<LocationRecord | null>;
  insert(
    context: PolicyAuthorizedRepositoryExecutionContext,
    location: LocationRecord
  ): RepositoryResult<void>;
  listByFamily(
    context: PolicyAuthorizedRepositoryExecutionContext,
    familyId: FamilyId
  ): RepositoryResult<readonly LocationRecord[]>;
}

export interface LocationPolicyResourceRecord {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly createReceiptHash: string;
}

export interface LocationPolicyResourceRepositoryPort {
  findLocationForPolicyResolution(
    context: RepositoryExecutionContext,
    locationId: string
  ): RepositoryResult<LocationPolicyResourceRecord | null>;
}
