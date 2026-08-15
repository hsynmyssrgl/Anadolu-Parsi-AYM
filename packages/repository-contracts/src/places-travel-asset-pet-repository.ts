import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type {
  PlacesTravelItemView,
  PlacesTravelMutationKind,
  PlacesTravelVisibility
} from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface PlacesTravelCenterKey {
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly actorPersonId: PersonId;
  readonly ownerPersonId: PersonId;
  readonly centerId: string;
}

export interface PlacesTravelOwnerRow {
  readonly id: PersonId;
  readonly familyId: FamilyId;
  readonly status: 'active'|'inactive'|'deceased';
}

export interface PlacesTravelItemRow extends PlacesTravelItemView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
}

export interface PlacesTravelMutationRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly itemId: string;
  readonly actorAccountId: string;
  readonly actorPersonId: PersonId;
  readonly mutationKind: PlacesTravelMutationKind;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly expectedRevision: number;
  readonly revision: number;
  readonly itemStateFingerprint: string;
  readonly occurredAt: IsoDateTime;
}

export interface PlacesTravelCenterSnapshotRow {
  readonly owner: PlacesTravelOwnerRow;
  readonly items: readonly PlacesTravelItemRow[];
}

export interface PlacesTravelAssetPetRepositoryPort {
  loadCenter(context:PolicyAuthorizedRepositoryExecutionContext,key:PlacesTravelCenterKey):RepositoryResult<PlacesTravelCenterSnapshotRow>;
  findItem(context:PolicyAuthorizedRepositoryExecutionContext,key:PlacesTravelCenterKey,itemId:string):RepositoryResult<PlacesTravelItemRow|null>;
  findMutationByClientOperationId(context:PolicyAuthorizedRepositoryExecutionContext,key:PlacesTravelCenterKey,clientOperationId:string):RepositoryResult<PlacesTravelMutationRow|null>;
  insertMutation(context:PolicyAuthorizedRepositoryExecutionContext,row:PlacesTravelMutationRow):RepositoryResult<void>;
  insertItem(context:PolicyAuthorizedRepositoryExecutionContext,row:PlacesTravelItemRow):RepositoryResult<void>;
  saveItem(context:PolicyAuthorizedRepositoryExecutionContext,row:PlacesTravelItemRow,expectedRevision:number):RepositoryResult<void>;
}

/** Payload-free lookup used only before central policy authorization. */
export interface PlacesTravelPolicyResourceRepositoryPort {
  findItemForPolicyResolution(context:RepositoryExecutionContext,itemId:string):RepositoryResult<Pick<PlacesTravelItemRow,
    'id'|'familyId'|'ownerPersonId'|'revision'|'status'|'visibility'|'stateFingerprint'
  >|null>;
}

export const placesTravelVisibilityPrivacy = (
  visibility:PlacesTravelVisibility
):'family'|'selected_members'|'private' => visibility==='family_coordination'
  ? 'family'
  : visibility==='selected_members'
    ? 'selected_members'
    : 'private';
