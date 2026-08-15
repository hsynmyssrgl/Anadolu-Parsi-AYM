import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type { CommunicationFileSharingCenterView, CommunicationFileSharingCommand } from '@ppt/domain';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface CommunicationFileSharingCenterKey {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly centerId: string;
}

export interface CommunicationFileSharingMutationRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly centerId: string;
  readonly actorAccountId: string;
  readonly actorPersonId: PersonId;
  readonly clientOperationId: string;
  readonly commandKind: CommunicationFileSharingCommand['kind'];
  readonly requestFingerprint: string;
  readonly expectedRevision: number;
  readonly revision: number;
  readonly policyReceiptId: string;
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
    context: RepositoryExecutionContext,
    key: CommunicationFileSharingCenterKey
  ): RepositoryResult<CommunicationFileSharingCenterRow | null>;
  findMutation(
    context: RepositoryExecutionContext,
    key: CommunicationFileSharingCenterKey,
    clientOperationId: string
  ): RepositoryResult<CommunicationFileSharingMutationRow | null>;
  save(
    context: RepositoryExecutionContext,
    row: CommunicationFileSharingCenterRow,
    mutation: CommunicationFileSharingMutationRow,
    expectedRevision: number
  ): RepositoryResult<void>;
}
