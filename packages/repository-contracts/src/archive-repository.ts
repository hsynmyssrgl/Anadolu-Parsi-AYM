import type { PersonId } from '@ppt/core';
import type { ArchiveItemView, ArchiveVersionView, ArchiveRetentionPolicyView, ArchiveRetentionStatusView, ArchiveCategoryView, ArchiveClassificationView, ArchiveSensitivity, ArchiveRelationEvidenceConfidence, ArchiveRelationEvidenceHistoryView, ArchiveRelationEvidenceView } from '@ppt/domain';
import type { PolicyAuthorizedRepositoryExecutionContext, RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface ArchiveItemRow extends ArchiveItemView { readonly storedName:string; readonly familyId:string; readonly ownerPersonId?:string; readonly categoryId?:string; readonly sensitivity:'standard'|'personal'|'high'; readonly aiProcessingAllowed:boolean; }

export interface ArchiveVersionRow extends ArchiveVersionView { readonly storedName:string; }

export interface ArchiveRepositoryPort {
    list(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly ArchiveItemRow[]>;
    search(context: PolicyAuthorizedRepositoryExecutionContext, input: {
        query: string;
        categoryId: string;
        sensitivity: string;
        tag: string;
        mimeType: string;
        linkedEventId: string;
    }): RepositoryResult<readonly ArchiveItemRow[]>;
    find(context: PolicyAuthorizedRepositoryExecutionContext, id: string): RepositoryResult<ArchiveItemRow | null>;
    insert(context: PolicyAuthorizedRepositoryExecutionContext, row: ArchiveItemRow): RepositoryResult<void>;
    insertVersion(context: PolicyAuthorizedRepositoryExecutionContext, row: ArchiveVersionRow): RepositoryResult<void>;
    replaceItemFile(context: PolicyAuthorizedRepositoryExecutionContext, input: {
        itemId: string;
        originalName: string;
        storedName: string;
        mimeType: string;
        sizeBytes: number;
        sha256: string;
    }): RepositoryResult<void>;
    listVersions(context: PolicyAuthorizedRepositoryExecutionContext, itemId: string): RepositoryResult<readonly ArchiveVersionRow[]>;
    listRelationEvidence(context: PolicyAuthorizedRepositoryExecutionContext, itemId: string): RepositoryResult<readonly ArchiveRelationEvidenceView[]>;
    listRelationEvidenceHistory(context: PolicyAuthorizedRepositoryExecutionContext, itemId: string): RepositoryResult<readonly ArchiveRelationEvidenceHistoryView[]>;
    insertRelationEvidence(context: PolicyAuthorizedRepositoryExecutionContext, input: {
        evidenceId: string;
        relationId: string;
        archiveItemId: string;
        evidenceDate: string;
        confidence: ArchiveRelationEvidenceConfidence;
        mutationId: string;
        clientOperationId: string;
        requestFingerprint: string;
        occurredAt: string;
    }): RepositoryResult<ArchiveRelationEvidenceView>;
    removeRelationEvidence(context: PolicyAuthorizedRepositoryExecutionContext, input: {
        evidenceId: string;
        archiveItemId: string;
        expectedRevision: number;
        mutationId: string;
        clientOperationId: string;
        requestFingerprint: string;
        occurredAt: string;
    }): RepositoryResult<ArchiveRelationEvidenceView | null>;
    listRetentionPolicies(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly ArchiveRetentionPolicyView[]>;
    insertRetentionPolicy(context: PolicyAuthorizedRepositoryExecutionContext, row: ArchiveRetentionPolicyView): RepositoryResult<void>;
    assignRetentionPolicy(context: PolicyAuthorizedRepositoryExecutionContext, itemId: string, policyId: string | null): RepositoryResult<void>;
    listRetentionStatus(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly ArchiveRetentionStatusView[]>;
    getDestructionPlan(context: PolicyAuthorizedRepositoryExecutionContext, itemId: string): RepositoryResult<{
        storedName: string;
        secureDestroy: boolean;
    } | null>;
    markDestroyed(context: PolicyAuthorizedRepositoryExecutionContext, itemId: string, destroyedAt: string): RepositoryResult<void>;
    listCategories(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly ArchiveCategoryView[]>;
    insertCategory(context: PolicyAuthorizedRepositoryExecutionContext, row: ArchiveCategoryView): RepositoryResult<void>;
    listClassifications(context: PolicyAuthorizedRepositoryExecutionContext): RepositoryResult<readonly ArchiveClassificationView[]>;
    updateClassification(context: PolicyAuthorizedRepositoryExecutionContext, input: {
        itemId: string;
        categoryId: string | null;
        sensitivity: ArchiveSensitivity;
        aiProcessingAllowed: boolean;
        tags: readonly {
            id: string;
            name: string;
        }[];
    }): RepositoryResult<void>;
    reattestLegacyOwnership(context: PolicyAuthorizedRepositoryExecutionContext, itemId: string, ownerPersonId: PersonId): RepositoryResult<void>;
    incrementEventAttachment(context: PolicyAuthorizedRepositoryExecutionContext, eventId: string): RepositoryResult<void>;
}

/** Narrow pre-authorization data used only by the production PEP resolver. */
export interface ArchivePolicyResourceRepositoryPort {
    listForPolicyResolution(context: RepositoryExecutionContext): RepositoryResult<readonly ArchiveItemRow[]>;
    findForPolicyResolution(context: RepositoryExecutionContext, id: string): RepositoryResult<ArchiveItemRow | null>;
    listVersionsForPolicyResolution(context: RepositoryExecutionContext, itemId: string): RepositoryResult<readonly ArchiveVersionRow[]>;
    listRetentionPoliciesForPolicyResolution(context: RepositoryExecutionContext): RepositoryResult<readonly ArchiveRetentionPolicyView[]>;
    listRetentionStatusForPolicyResolution(context: RepositoryExecutionContext): RepositoryResult<readonly ArchiveRetentionStatusView[]>;
    listCategoriesForPolicyResolution(context: RepositoryExecutionContext): RepositoryResult<readonly ArchiveCategoryView[]>;
    listClassificationsForPolicyResolution(context: RepositoryExecutionContext): RepositoryResult<readonly ArchiveClassificationView[]>;
}
