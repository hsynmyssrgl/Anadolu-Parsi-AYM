import type { IsoDateTime } from '@ppt/core';

export const MEMORY_STUDIO_RECORD_KINDS = Object.freeze([
  'voice_story',
  'transcript',
  'photo_book',
  'annual_album',
  'on_this_day',
  'duplicate_photo_review',
  'face_group',
  'genealogy_media_link',
  'recipe',
  'tradition',
  'letter',
  'future_message',
  'family_documentary',
  'printable_book'
] as const);
export type MemoryStudioRecordKind = (typeof MEMORY_STUDIO_RECORD_KINDS)[number];

export type MemoryStudioRecordStatus = 'active' | 'deleted';
export type MemoryTimeCapsuleStatus =
  | 'awaiting_approvals'
  | 'sealed'
  | 'released'
  | 'cancelled'
  | 'rolled_back';

export interface MemoryStudioRecordView {
  readonly id: string;
  readonly ownerPersonId: string;
  readonly kind: MemoryStudioRecordKind;
  readonly status: MemoryStudioRecordStatus;
  readonly title: string;
  readonly summary?: string;
  readonly archiveItemIds: readonly string[];
  readonly personIds: readonly string[];
  readonly ocrJobId?: string;
  readonly eventDate?: IsoDateTime;
  readonly manualFaceGroupingApproved: boolean;
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt?: IsoDateTime;
}

export interface MemoryTimeCapsuleApprovalView {
  readonly accountId: string;
  readonly personId: string;
  readonly approvedAt: IsoDateTime;
}

export interface MemoryTimeCapsuleView {
  readonly id: string;
  readonly ownerPersonId: string;
  readonly title: string;
  readonly status: MemoryTimeCapsuleStatus;
  readonly archiveItemIds: readonly string[];
  readonly memoryRecordIds: readonly string[];
  readonly unlockAt: IsoDateTime;
  readonly minimumApprovals: 2;
  readonly approvals: readonly MemoryTimeCapsuleApprovalView[];
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly sealedAt?: IsoDateTime;
  readonly releasedAt?: IsoDateTime;
  readonly cancelledAt?: IsoDateTime;
  readonly rolledBackAt?: IsoDateTime;
}

export interface MemoryStudioTruthView {
  readonly localOnly: true;
  readonly linkedArchiveContentRemainsProtected: true;
  readonly newBinaryPayloadStored: false;
  readonly transcriptionPerformed: false;
  readonly faceRecognitionPerformed: false;
  readonly duplicateDetectionPerformed: false;
  readonly documentaryRendered: false;
  readonly printableBookRendered: false;
  readonly printingPerformed: false;
  readonly networkUsed: false;
  readonly cloudUsed: false;
  readonly manualCurationOnly: true;
  readonly manualFaceGroupingOnly: true;
  readonly minimumCapsuleApprovals: 2;
  readonly waitingPeriodEnforced: true;
  readonly externalDeliveryPerformed: 'not_performed';
}

export interface MemoryStudioCenterView {
  readonly schemaVersion: 1;
  readonly centerId: string;
  readonly ownerPersonId: string;
  readonly records: readonly MemoryStudioRecordView[];
  readonly capsules: readonly MemoryTimeCapsuleView[];
  readonly truth: MemoryStudioTruthView;
  readonly generatedAt: IsoDateTime;
}

export interface CreateMemoryStudioRecordInput {
  readonly clientOperationId: string;
  readonly recordId: string;
  readonly kind: MemoryStudioRecordKind;
  readonly title: string;
  readonly summary?: string;
  readonly archiveItemIds?: readonly string[];
  readonly personIds?: readonly string[];
  readonly ocrJobId?: string;
  readonly eventDate?: string;
  readonly manualFaceGroupingApproved?: boolean;
}

export interface DeleteMemoryStudioRecordInput {
  readonly clientOperationId: string;
  readonly recordId: string;
  readonly expectedRevision: number;
}

export interface CreateMemoryTimeCapsuleInput {
  readonly clientOperationId: string;
  readonly capsuleId: string;
  readonly title: string;
  readonly archiveItemIds?: readonly string[];
  readonly memoryRecordIds?: readonly string[];
  readonly unlockAt: string;
}

export interface ReviewMemoryTimeCapsuleInput {
  readonly clientOperationId: string;
  readonly capsuleId: string;
  readonly expectedRevision: number;
  readonly decision: 'approve' | 'revoke_approval';
}

export interface TransitionMemoryTimeCapsuleInput {
  readonly clientOperationId: string;
  readonly capsuleId: string;
  readonly expectedRevision: number;
  readonly transition: 'seal' | 'release' | 'cancel' | 'rollback';
}

export type MemoryStudioMutationKind =
  | 'record_create'
  | 'record_delete'
  | 'capsule_create'
  | 'capsule_approve'
  | 'capsule_revoke_approval'
  | 'capsule_seal'
  | 'capsule_release'
  | 'capsule_cancel'
  | 'capsule_rollback';

export interface MemoryStudioMutationReceiptView {
  readonly resourceType: 'memory_studio_record' | 'memory_time_capsule';
  readonly resourceId: string;
  readonly mutationKind: MemoryStudioMutationKind;
  readonly previousRevision: number;
  readonly revision: number;
  readonly occurredAt: IsoDateTime;
  readonly replayed: boolean;
  readonly networkUsed: false;
  readonly cloudUsed: false;
  readonly externalDeliveryPerformed: 'not_performed';
}

export const memoryStudioCenterId = (familyId: string, ownerPersonId: string): string =>
  `memory-studio:${familyId}:${ownerPersonId}`;

export const memoryStudioTruth = Object.freeze({
  localOnly: true as const,
  linkedArchiveContentRemainsProtected: true as const,
  newBinaryPayloadStored: false as const,
  transcriptionPerformed: false as const,
  faceRecognitionPerformed: false as const,
  duplicateDetectionPerformed: false as const,
  documentaryRendered: false as const,
  printableBookRendered: false as const,
  printingPerformed: false as const,
  networkUsed: false as const,
  cloudUsed: false as const,
  manualCurationOnly: true as const,
  manualFaceGroupingOnly: true as const,
  minimumCapsuleApprovals: 2 as const,
  waitingPeriodEnforced: true as const,
  externalDeliveryPerformed: 'not_performed' as const
});
