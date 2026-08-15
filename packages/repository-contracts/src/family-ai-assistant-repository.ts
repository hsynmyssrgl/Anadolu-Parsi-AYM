import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type {
  FamilyAiAssistantPurpose,
  FamilyAiAssistantSourceReferenceView,
  FamilyAiSuggestionMutationKind,
  FamilyAiSuggestionView
} from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface FamilyAiAssistantCenterKey {
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly actorPersonId: PersonId;
  readonly ownerPersonId: PersonId;
  readonly centerId: string;
}

export interface FamilyAiSuggestionRow extends FamilyAiSuggestionView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly sourceFingerprint: string;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
}

export interface FamilyAiSuggestionMutationRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly suggestionId: string;
  readonly actorAccountId: string;
  readonly actorPersonId: PersonId;
  readonly mutationKind: FamilyAiSuggestionMutationKind;
  readonly purpose: FamilyAiAssistantPurpose;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly expectedRevision: number;
  readonly revision: number;
  readonly suggestionStateFingerprint: string;
  readonly sourceFingerprint: string;
  readonly sourceCount: number;
  readonly occurredAt: IsoDateTime;
}

export interface FamilyAiAssistantCenterSnapshotRow {
  readonly suggestions: readonly FamilyAiSuggestionRow[];
}

export interface FamilyAiAssistantRepositoryPort {
  loadCenter(
    context:PolicyAuthorizedRepositoryExecutionContext,
    key:FamilyAiAssistantCenterKey
  ):RepositoryResult<FamilyAiAssistantCenterSnapshotRow>;
  findSuggestion(
    context:PolicyAuthorizedRepositoryExecutionContext,
    key:FamilyAiAssistantCenterKey,
    suggestionId:string
  ):RepositoryResult<FamilyAiSuggestionRow|null>;
  findMutationByClientOperationId(
    context:PolicyAuthorizedRepositoryExecutionContext,
    key:FamilyAiAssistantCenterKey,
    clientOperationId:string
  ):RepositoryResult<FamilyAiSuggestionMutationRow|null>;
  insertMutation(
    context:PolicyAuthorizedRepositoryExecutionContext,
    row:FamilyAiSuggestionMutationRow
  ):RepositoryResult<void>;
  insertSuggestion(
    context:PolicyAuthorizedRepositoryExecutionContext,
    row:FamilyAiSuggestionRow
  ):RepositoryResult<void>;
  saveSuggestion(
    context:PolicyAuthorizedRepositoryExecutionContext,
    row:FamilyAiSuggestionRow,
    expectedRevision:number
  ):RepositoryResult<void>;
}

/** Payload-free metadata available before central policy authorization. */
export interface FamilyAiAssistantPolicyResourceRepositoryPort {
  findSuggestionForPolicyResolution(
    context:RepositoryExecutionContext,
    suggestionId:string
  ):RepositoryResult<Pick<FamilyAiSuggestionRow,
    'id'|'familyId'|'ownerPersonId'|'revision'|'status'|'stateFingerprint'
  >|null>;
}

export const canonicalFamilyAiAssistantSources = (
  sources:readonly FamilyAiAssistantSourceReferenceView[]
):readonly FamilyAiAssistantSourceReferenceView[] => Object.freeze([...sources]
  .map((source)=>Object.freeze({...source}))
  .sort((left,right)=>left.module.localeCompare(right.module)
    || left.resourceType.localeCompare(right.resourceType)
    || left.resourceId.localeCompare(right.resourceId)));
