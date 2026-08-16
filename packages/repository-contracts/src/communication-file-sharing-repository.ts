import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type { CommunicationFileSharingCenterView, CommunicationFileSharingCommand } from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export type CommunicationFileSharingResourceType =
  | 'communication_file_sharing_center'
  | 'communication_file_sharing';

export interface CommunicationFileSharingCenterKey {
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly actorPersonId: PersonId;
  readonly ownerPersonId: PersonId;
  readonly centerId: string;
}

export interface CommunicationFileSharingMutationRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly centerId: string;
  readonly resourceType: CommunicationFileSharingResourceType;
  readonly resourceId: string;
  readonly actorAccountId: string;
  readonly actorPersonId: PersonId;
  readonly clientOperationId: string;
  readonly commandKind: CommunicationFileSharingCommand['kind'];
  readonly requestFingerprint: string;
  readonly expectedRevision: number;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly occurredAt: IsoDateTime;
}

export interface CommunicationFileSharingCenterRow {
  readonly key: CommunicationFileSharingCenterKey;
  readonly snapshot: CommunicationFileSharingCenterView;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
  readonly updatedAt: IsoDateTime;
}

export interface CommunicationFileSharingRepositoryPort {
  load(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationFileSharingCenterKey
  ): RepositoryResult<CommunicationFileSharingCenterRow | null>;
  findMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: CommunicationFileSharingCenterKey,
    clientOperationId: string
  ): RepositoryResult<CommunicationFileSharingMutationRow | null>;
  save(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: CommunicationFileSharingCenterRow,
    mutation: CommunicationFileSharingMutationRow,
    expectedRevision: number
  ): RepositoryResult<void>;
}

export interface CommunicationFileSharingPolicyResourceResolution {
  readonly id: string;
  readonly resourceType: CommunicationFileSharingResourceType;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly revision: number;
  readonly state: string;
  readonly stateFingerprint: string;
}

export interface CommunicationFileSharingPolicyResourceRepositoryPort {
  resolvePolicyResource(
    context: RepositoryExecutionContext,
    resourceType: CommunicationFileSharingResourceType,
    resourceId: string
  ): RepositoryResult<CommunicationFileSharingPolicyResourceResolution | null>;
}
