import type { FamilyId, IsoDateTime, PersonId, UserId } from '@ppt/core';
import type { FormDraftOperation, FormDraftView } from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface FormDraftMutationRow {
  readonly id: string;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly familyId: FamilyId;
  readonly accountId: UserId;
  readonly ownerPersonId: PersonId;
  readonly formKey: string;
  readonly resourceId: string;
  readonly operation: FormDraftOperation;
  readonly previousRevision: number;
  readonly revision: number;
  readonly payloadJson: string;
  readonly payloadFingerprint: string;
  readonly restoredFromRevision: number | null;
  readonly createdAt: IsoDateTime;
}

export interface FormDraftRow extends FormDraftView {
  readonly familyId: FamilyId;
  readonly accountId: UserId;
  readonly ownerPersonId: PersonId;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly lastMutationId: string;
}

export interface FormDraftRepositoryPort {
  find(context: PolicyAuthorizedRepositoryExecutionContext, accountId: UserId, formKey: string): RepositoryResult<FormDraftRow | null>;
  findForPolicyResolution(context: RepositoryExecutionContext, accountId: UserId, formKey: string): RepositoryResult<FormDraftRow | null>;
  findMutationByClientOperationId(context: PolicyAuthorizedRepositoryExecutionContext, accountId: UserId, formKey: string, clientOperationId: string): RepositoryResult<FormDraftMutationRow | null>;
  findMutationByRevision(context: PolicyAuthorizedRepositoryExecutionContext, accountId: UserId, formKey: string, revision: number): RepositoryResult<FormDraftMutationRow | null>;
  listMutations(context: PolicyAuthorizedRepositoryExecutionContext, accountId: UserId, formKey: string, limit: number): RepositoryResult<readonly FormDraftMutationRow[]>;
  insertMutation(context: PolicyAuthorizedRepositoryExecutionContext, row: FormDraftMutationRow): RepositoryResult<void>;
  saveCurrent(context: PolicyAuthorizedRepositoryExecutionContext, row: FormDraftRow, expectedRevision: number): RepositoryResult<boolean>;
}
