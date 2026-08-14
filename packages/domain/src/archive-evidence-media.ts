export type ArchiveRelationEvidenceConfidence = 'low' | 'medium' | 'high';
export type ArchiveRelationEvidenceStatus = 'active' | 'removed';
export type ArchiveRelationEvidenceMutationKind = 'evidence_create' | 'evidence_remove';

export interface ArchiveRelationEvidenceView {
  readonly id: string;
  readonly relationId: string;
  readonly archiveItemId: string;
  readonly documentTitle: string;
  readonly documentOriginalName: string;
  readonly documentMimeType: string;
  readonly evidenceDate: string;
  readonly confidence: ArchiveRelationEvidenceConfidence;
  readonly status: ArchiveRelationEvidenceStatus;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly removedAt?: string;
}

export interface ArchiveRelationEvidenceHistoryView {
  readonly mutationId: string;
  readonly evidenceId: string;
  readonly mutationKind: ArchiveRelationEvidenceMutationKind;
  readonly revision: number;
  readonly evidenceDate: string;
  readonly confidence: ArchiveRelationEvidenceConfidence;
  readonly status: ArchiveRelationEvidenceStatus;
  readonly occurredAt: string;
}

export interface AddArchiveRelationEvidenceInput {
  readonly relationId: string;
  readonly archiveItemId: string;
  readonly evidenceDate: string;
  readonly confidence: ArchiveRelationEvidenceConfidence;
}

export interface RemoveArchiveRelationEvidenceInput {
  readonly evidenceId: string;
  readonly archiveItemId: string;
  readonly expectedRevision: number;
}

export interface AddArchiveItemVersionInput {
  readonly itemId: string;
  readonly note?: string;
}
