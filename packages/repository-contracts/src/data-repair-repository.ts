import type { FamilyId, IsoDateTime, UserId } from '@ppt/core';
import type { DataRepairIssue, DataRepairOperation } from '@ppt/domain';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface DataRepairRepositoryPort {
  scanIssues(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<readonly DataRepairIssue[]>;
  previewRepair(context: RepositoryExecutionContext, input: {
    readonly operationId: string;
    readonly familyId: FamilyId;
    readonly issueId: string;
    readonly reason: string;
    readonly createdBy: UserId;
    readonly createdAt: IsoDateTime;
  }): RepositoryResult<DataRepairOperation | null>;
  applyRepair(context: RepositoryExecutionContext, input: {
    readonly operationId: string;
    readonly expectedRevisionToken: string;
    readonly appliedAt: IsoDateTime;
  }): RepositoryResult<DataRepairOperation | null>;
  undoRepair(context: RepositoryExecutionContext, input: {
    readonly operationId: string;
    readonly undoneAt: IsoDateTime;
  }): RepositoryResult<DataRepairOperation | null>;
  findOperation(context: RepositoryExecutionContext, operationId: string): RepositoryResult<DataRepairOperation | null>;
  listOperations(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<readonly DataRepairOperation[]>;
}
