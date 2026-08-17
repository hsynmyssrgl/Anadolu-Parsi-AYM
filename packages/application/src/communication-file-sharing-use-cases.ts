import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';
import {
  ERROR_CODES,
  asEventId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import {
  COMMUNICATION_FILE_CHUNK_BYTES,
  COMMUNICATION_FILE_MAX_ACCESS_GRANTS,
  COMMUNICATION_FILE_MAX_BYTES,
  COMMUNICATION_FILE_MAX_COMMENTS,
  COMMUNICATION_FILE_MAX_FILES_PER_OWNER,
  COMMUNICATION_FILE_LOCAL_STAGING_MAX_BYTES,
  COMMUNICATION_FILE_ORPHAN_GRACE_MS,
  COMMUNICATION_FILE_SAFE_PREVIEW_MAX_BYTES,
  COMMUNICATION_FILE_MAX_VERSIONS,
  communicationFileSharingCenterId,
  communicationFileSharingTruth,
  type CommunicationFileShareView,
  type CommunicationFileSafePreviewView,
  type CommunicationFilePayloadMaintenanceView,
  type CommunicationFileSharingCenterView,
  type CommunicationFileSharingCommand,
  type CommunicationFileSharingMutationReceiptView
} from '@ppt/domain';
import type {
  CommunicationFileSharingCenterKey,
  CommunicationFileSharingCenterRow,
  CommunicationFileSharingMutationRow,
  CommunicationFileSharingResourceType,
  RepositoryResult
} from '@ppt/repository-contracts';
import type { DomainEvent } from '@ppt/events';
import type { LifeApplicationContext, LifePolicyIntent } from './life-use-cases.js';

export interface CommunicationFileSharingQueryPort {
  getCenter(context: LifeApplicationContext): Promise<Result<CommunicationFileSharingCenterView, AppError>>;
  getFile(context: LifeApplicationContext, fileId: string): Promise<Result<CommunicationFileShareView, AppError>>;
  getMaintenanceState(context: LifeApplicationContext): Promise<Result<{
    readonly center: CommunicationFileSharingCenterView;
    readonly occurredAt: string;
  }, AppError>>;
}

export interface VerifiedCommunicationFilePayload {
  readonly sealedPayloadReference: string;
  readonly fullContentSha256: string;
  readonly totalBytes: number;
  readonly totalChunks: number;
  readonly providerId: 'protected-side-artifact-store-v1';
  readonly providerEvidenceSha256: string;
  readonly verifiedChunks: readonly { readonly chunkIndex: number; readonly offsetBytes: number;
    readonly sizeBytes: number; readonly sha256: string }[];
  readonly scanState: 'clean' | 'malicious' | 'provider_unavailable';
  readonly scanProviderId?: string;
  readonly scanEvidenceSha256?: string;
}

export interface CommunicationFilePayloadPort {
  seal(input: { readonly familyId: string; readonly ownerPersonId: string; readonly fileId: string;
    readonly displayName: string; readonly mimeType: string; readonly bytes: Uint8Array;
    readonly occurredAt: string; readonly correlationId: LifeApplicationContext['correlationId'] })
  : Result<VerifiedCommunicationFilePayload, AppError>;
  open(input: { readonly reference: string; readonly familyId: string; readonly ownerPersonId: string;
    readonly fileId: string; readonly displayName: string; readonly mimeType: string; readonly totalBytes: number;
    readonly fullContentSha256: string; readonly providerEvidenceSha256: string;
    readonly correlationId: LifeApplicationContext['correlationId'] }): Result<Uint8Array, AppError>;
  discard(reference: string, correlationId: LifeApplicationContext['correlationId']): Result<void, AppError>;
  sweepOrphans(input: { readonly familyId: string; readonly ownerPersonId: string;
    readonly referencedPayloads: readonly string[]; readonly completedBefore: string;
    readonly maximumCandidates: number; readonly correlationId: LifeApplicationContext['correlationId'] })
  : Result<{ readonly scannedFiles: number; readonly deletedFiles: number; readonly rejectedFiles: number }, AppError>;
}

export interface CommunicationFileSharingWriteScope {
  readonly key: CommunicationFileSharingCenterKey;
  readonly occurredAt: CommunicationFileSharingMutationRow['occurredAt'];
  findPerson(personId: string): RepositoryResult<{
    readonly id: string; readonly familyId: string; readonly status: string;
  } | null>;
  load(): RepositoryResult<CommunicationFileSharingCenterRow | null>;
  findMutation(clientOperationId: string): RepositoryResult<CommunicationFileSharingMutationRow | null>;
  save(
    row: CommunicationFileSharingCenterRow,
    mutation: CommunicationFileSharingMutationRow,
    expectedRevision: number
  ): RepositoryResult<void>;
  appendAudit(input: { readonly id: string; readonly action: string; readonly resourceType: string;
    readonly resourceId: string; readonly occurredAt: CommunicationFileSharingMutationRow['occurredAt'];
    readonly actorId: LifeApplicationContext['actor']['userId'] }): RepositoryResult<string>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): RepositoryResult<void>;
}

export interface CommunicationFileSharingUnitOfWork {
  execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: CommunicationFileSharingWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,255}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const SEALED_REFERENCE = /^comm-file-[0-9a-f]{64}\.pptshare$/u;
const MIME = /^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,127}$/u;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/u;
const CONTROL = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const COMMAND_KINDS = new Set<CommunicationFileSharingCommand['kind']>([
  'prepare_file','record_chunk','set_scan','add_version','add_comment','grant_access','revoke_share','link_archive',
  'update_album','set_notifications','announce_emergency','acknowledge_emergency','request_remote_assistance',
  'grant_remote_assistance','revoke_remote_assistance','plan_co_watch','prepare_voice_action','confirm_voice_action'
]);
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
const normalizedText = (value: unknown, minimum: number, maximum: number): string | null => {
  if (typeof value !== 'string') return null;
  const result = value.normalize('NFKC').trim();
  return result.length >= minimum && result.length <= maximum && !CONTROL.test(result) ? result : null;
};
const validIso = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) && Number.isFinite(Date.parse(value));
const invalid = (context: LifeApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_INVALID_ARGUMENT, message, category: 'validation', correlationId: context.correlationId
});
const conflict = (context: LifeApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_CONFLICT, message, category: 'conflict', correlationId: context.correlationId
});
const denied = (context: LifeApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED, message, category: 'authorization', correlationId: context.correlationId
});
const missing = (context: LifeApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_NOT_FOUND, message, category: 'not_found', correlationId: context.correlationId
});

export const communicationFileSharingReadIntent = (fileId?: string): LifePolicyIntent => ({
  action: 'read', capability: 'family.read',
  resourceType: fileId === undefined ? 'communication_file_sharing_center' : 'communication_file_sharing',
  resourceId: fileId ?? '*', purpose: 'general'
});

export const communicationFileSharingKey = (
  context: LifeApplicationContext,
  ownerPersonId: string
): CommunicationFileSharingCenterKey => ({
  familyId: asFamilyId(context.familyId), accountId: context.actor.userId,
  actorPersonId: asPersonId(context.actor.personId ?? ownerPersonId), ownerPersonId: asPersonId(ownerPersonId),
  centerId: communicationFileSharingCenterId(context.familyId, ownerPersonId)
});

const fileResourceKinds = new Set<CommunicationFileSharingCommand['kind']>([
  'prepare_file','record_chunk','set_scan','add_version','add_comment','grant_access','revoke_share','link_archive','update_album'
]);
const policyResource = (key: CommunicationFileSharingCenterKey, command: CommunicationFileSharingCommand) => Object.freeze({
  resourceType: (fileResourceKinds.has(command.kind)
    ? 'communication_file_sharing' : 'communication_file_sharing_center') as CommunicationFileSharingResourceType,
  resourceId: fileResourceKinds.has(command.kind) && 'fileId' in command ? command.fileId : key.centerId
});
export const communicationFileSharingWriteIntent = (
  key: CommunicationFileSharingCenterKey,
  command: CommunicationFileSharingCommand,
  expectedRevision: number
): LifePolicyIntent => {
  const resource = policyResource(key, command);
  const action = command.kind === 'prepare_file' ? 'create' as const
    : command.kind === 'revoke_share' ? 'delete' as const
      : resource.resourceType === 'communication_file_sharing_center' && expectedRevision === 0 ? 'create' as const : 'update' as const;
  return Object.freeze({ action, capability: 'family.write', resourceType: resource.resourceType,
    resourceId: resource.resourceId, purpose: 'general', ...(action === 'create'
      ? { ownerPersonId: key.ownerPersonId, privacy: 'private' as const } : {}) });
};

export const emptyCommunicationFileSharingCenter = (
  key: CommunicationFileSharingCenterKey,
  at: string
): CommunicationFileSharingCenterView => Object.freeze({
  schemaVersion: 1, centerId: key.centerId, ownerPersonId: key.ownerPersonId,
  files: Object.freeze([]),
  notificationProfile: Object.freeze({ quietHoursEnabled: false, quietHoursStart: '22:00', quietHoursEnd: '07:00',
    nonEmergencyDigestEnabled: true, roomOverrides: Object.freeze([]), personOverrides: Object.freeze([]) }),
  emergencyAnnouncements: Object.freeze([]), remoteAssistance: Object.freeze([]), coWatchSessions: Object.freeze([]),
  voiceActions: Object.freeze([]), truth: communicationFileSharingTruth, revision: 0, generatedAt: asIsoDateTime(at)
});

const replaceFile = (
  center: CommunicationFileSharingCenterView,
  file: CommunicationFileShareView
): readonly CommunicationFileShareView[] => Object.freeze([
  file, ...center.files.filter((candidate) => candidate.id !== file.id)
].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id)));
const resourceId = (command: CommunicationFileSharingCommand, ownerPersonId: string): string =>
  'fileId' in command ? command.fileId : 'announcementId' in command ? command.announcementId
    : 'sessionId' in command ? command.sessionId : 'actionId' in command ? command.actionId
      : `communication-file-sharing:${ownerPersonId}`;

const canonicalIds = (values: readonly string[], maximum: number): readonly string[] | null => {
  if (!Array.isArray(values) || values.length > maximum || values.some((value) => !SAFE_ID.test(value))) return null;
  const result = [...new Set(values)].sort();
  return result.length === values.length ? Object.freeze(result) : null;
};

const referencedPersonIds = (command: CommunicationFileSharingCommand): readonly string[] => {
  if (command.kind === 'grant_access') return Object.freeze([command.personId]);
  if (command.kind === 'update_album') return command.likedByPersonIds;
  if (command.kind === 'set_notifications') return Object.freeze(command.personOverrides.map((item) => item.personId));
  if (command.kind === 'request_remote_assistance') return Object.freeze([command.helperPersonId]);
  return Object.freeze([]);
};
const validateReferencedPersons = (
  context: LifeApplicationContext,
  scope: CommunicationFileSharingWriteScope,
  command: CommunicationFileSharingCommand
): Result<void, AppError> => {
  const ids = canonicalIds(referencedPersonIds(command), 256);
  if (!ids) return err(invalid(context, 'İletişim kişi başvuruları geçersiz veya yinelenmiştir.'));
  if (command.kind === 'request_remote_assistance' && command.helperPersonId === context.actor.personId)
    return err(denied(context, 'Uzaktan yardım isteyen kişi kendisini yardımcı olarak seçemez.'));
  for (const personId of ids) {
    const found = scope.findPerson(personId); if (!found.ok) return found;
    if (!found.value || found.value.familyId !== context.familyId || found.value.status !== 'active')
      return err(denied(context, 'İletişim kişi başvurusu aynı etkin aileye ait değildir.'));
  }
  return ok(undefined);
};

const reduce = (
  context: LifeApplicationContext,
  center: CommunicationFileSharingCenterView,
  command: CommunicationFileSharingCommand,
  at: CommunicationFileSharingMutationRow['occurredAt']
): Result<CommunicationFileSharingCenterView, AppError> => {
  const actorPersonId = context.actor.personId!;
  const file = 'fileId' in command ? center.files.find((candidate) => candidate.id === command.fileId) : undefined;
  let next: CommunicationFileSharingCenterView;
  if (command.kind === 'prepare_file') {
    const name = normalizedText(command.displayName, 1, 255);
    if (!SAFE_ID.test(command.fileId) || (!command.roomId && !command.meetingId) || (command.roomId && !SAFE_ID.test(command.roomId))
      || (command.meetingId && !SAFE_ID.test(command.meetingId)) || !name || !MIME.test(command.mimeType)
      || !Number.isSafeInteger(command.totalBytes) || command.totalBytes < 1 || command.totalBytes > COMMUNICATION_FILE_MAX_BYTES
      || !Number.isSafeInteger(command.totalChunks) || command.totalChunks < 1
      || command.totalChunks !== Math.ceil(command.totalBytes / COMMUNICATION_FILE_CHUNK_BYTES)
      || !SHA256.test(command.fullContentSha256) || !SEALED_REFERENCE.test(command.sealedPayloadReference)
      || command.providerId !== 'protected-side-artifact-store-v1' || !SHA256.test(command.providerEvidenceSha256)
      || center.files.length >= COMMUNICATION_FILE_MAX_FILES_PER_OWNER
      || center.files.some((candidate) => candidate.id === command.fileId))
      return err(invalid(context, 'Dosya paylaşım hazırlığı geçersizdir.'));
    const chunks = [...command.verifiedChunks].sort((left, right) => left.chunkIndex - right.chunkIndex);
    if (chunks.length !== command.totalChunks || chunks.some((chunk, index) => chunk.chunkIndex !== index
      || chunk.offsetBytes !== index * COMMUNICATION_FILE_CHUNK_BYTES || !Number.isSafeInteger(chunk.sizeBytes)
      || chunk.sizeBytes < 1 || chunk.sizeBytes > COMMUNICATION_FILE_CHUNK_BYTES || !SHA256.test(chunk.sha256)
      || (index < command.totalChunks - 1 && chunk.sizeBytes !== COMMUNICATION_FILE_CHUNK_BYTES)
      || (index === command.totalChunks - 1 && chunk.sizeBytes !== command.totalBytes - chunk.offsetBytes))
      || (command.scanState === 'provider_unavailable'
        ? command.scanProviderId !== undefined || command.scanEvidenceSha256 !== undefined
        : !normalizedText(command.scanProviderId, 2, 128) || !SHA256.test(command.scanEvidenceSha256 ?? '')))
      return err(invalid(context, 'Dosya paylaşım doğrulama veya tarama kanıtı geçersizdir.'));
    const state = command.scanState === 'clean' ? 'ready_local' as const
      : command.scanState === 'malicious' ? 'quarantined' as const : 'scan_required' as const;
    const prepared: CommunicationFileShareView = Object.freeze({ id: command.fileId,
      ...(command.roomId ? { roomId: command.roomId } : {}), ...(command.meetingId ? { meetingId: command.meetingId } : {}),
      ownerPersonId: actorPersonId, displayName: name, mimeType: command.mimeType, totalBytes: command.totalBytes,
      totalChunks: command.totalChunks, fullContentSha256: command.fullContentSha256,
      sealedPayloadReference: command.sealedPayloadReference, providerId: command.providerId,
      providerEvidenceSha256: command.providerEvidenceSha256, state, scanState: command.scanState,
      ...(command.scanProviderId === undefined ? {} : { scanProviderId: command.scanProviderId }),
      ...(command.scanEvidenceSha256 === undefined ? {} : { scanEvidenceSha256: command.scanEvidenceSha256 }),
      chunks: Object.freeze(chunks.map((chunk) => Object.freeze({ ...chunk, verifiedAt: at }))),
      versions: Object.freeze([{ version: 1, contentSha256: command.fullContentSha256,
        sizeBytes: command.totalBytes, sealedPayloadReference: command.sealedPayloadReference,
        providerId: command.providerId, providerEvidenceSha256: command.providerEvidenceSha256,
        createdByPersonId: actorPersonId, createdAt: at }]), comments: Object.freeze([]), accessGrants: Object.freeze([]),
      selectedForStory: false, likedByPersonIds: Object.freeze([]), externalLinkEnabled: false,
      externalLinkAccessCodeRequired: true, revision: 1, createdAt: at, updatedAt: at });
    next = Object.freeze({ ...center, files: replaceFile(center, prepared), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'record_chunk') {
    if (!file || file.state === 'revoked' || !Number.isSafeInteger(command.chunkIndex) || command.chunkIndex < 0
      || command.chunkIndex >= file.totalChunks || !Number.isSafeInteger(command.offsetBytes)
      || command.offsetBytes !== command.chunkIndex * COMMUNICATION_FILE_CHUNK_BYTES || !Number.isSafeInteger(command.sizeBytes)
      || command.sizeBytes < 1 || command.sizeBytes > COMMUNICATION_FILE_CHUNK_BYTES || !SHA256.test(command.sha256))
      return err(invalid(context, 'Dosya parça doğrulama kaydı geçersizdir.'));
    const existing = file.chunks.find((candidate) => candidate.chunkIndex === command.chunkIndex);
    if (existing && (existing.sha256 !== command.sha256 || existing.sizeBytes !== command.sizeBytes))
      return err(conflict(context, 'Aynı dosya parçası farklı hash veya boyutla yeniden sunuldu.'));
    if (existing) return err(conflict(context, 'Doğrulanmış dosya parçası aynı değerlerle yeniden kaydedilemez.'));
    const chunks = existing ? file.chunks : Object.freeze([...file.chunks, Object.freeze({ chunkIndex: command.chunkIndex,
      offsetBytes: command.offsetBytes, sizeBytes: command.sizeBytes, sha256: command.sha256, verifiedAt: at })]
      .sort((left, right) => left.chunkIndex - right.chunkIndex));
    const updated = Object.freeze({ ...file, chunks, state: chunks.length === file.totalChunks ? 'scan_required' as const
      : 'transferring_local' as const, revision: file.revision + 1, updatedAt: at });
    next = Object.freeze({ ...center, files: replaceFile(center, updated), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'set_scan') {
    if (!file || file.state !== 'scan_required' || file.chunks.length !== file.totalChunks)
      return err(conflict(context, 'Tüm parçalar doğrulanmadan tarama sonucu kaydedilemez.'));
    if (!['clean','malicious','provider_unavailable'].includes(command.scanState)
      || (command.scanState === 'provider_unavailable'
      ? command.scanProviderId !== undefined || command.scanEvidenceSha256 !== undefined
      : !normalizedText(command.scanProviderId, 2, 128) || !SHA256.test(command.scanEvidenceSha256 ?? '')))
      return err(invalid(context, 'Zararlı dosya tarama kanıtı geçersizdir.'));
    if (file.scanState === command.scanState && file.scanProviderId === command.scanProviderId
      && file.scanEvidenceSha256 === command.scanEvidenceSha256)
      return err(conflict(context, 'Aynı zararlı dosya tarama sonucu yeniden kaydedilemez.'));
    const state = command.scanState === 'clean' ? 'ready_local' as const
      : command.scanState === 'malicious' ? 'quarantined' as const : 'scan_required' as const;
    const updated = Object.freeze({ ...file, scanState: command.scanState, state,
      ...(command.scanProviderId === undefined ? {} : { scanProviderId: command.scanProviderId }),
      ...(command.scanEvidenceSha256 === undefined ? {} : { scanEvidenceSha256: command.scanEvidenceSha256 }),
      revision: file.revision + 1, updatedAt: at });
    next = Object.freeze({ ...center, files: replaceFile(center, updated), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'add_version') {
    if (!file || file.state === 'revoked' || file.versions.length >= COMMUNICATION_FILE_MAX_VERSIONS
      || !SHA256.test(command.contentSha256) || !SEALED_REFERENCE.test(command.sealedPayloadReference)
      || command.providerId !== 'protected-side-artifact-store-v1' || !SHA256.test(command.providerEvidenceSha256)
      || !Number.isSafeInteger(command.sizeBytes) || command.sizeBytes < 1 || command.sizeBytes > COMMUNICATION_FILE_MAX_BYTES
      || file.versions.some((version) => version.contentSha256 === command.contentSha256
        || version.sealedPayloadReference === command.sealedPayloadReference))
      return err(invalid(context, 'Dosya sürümü geçersizdir.'));
    const version = Object.freeze({ version: file.versions.length + 1, contentSha256: command.contentSha256,
      sizeBytes: command.sizeBytes, sealedPayloadReference: command.sealedPayloadReference,
      providerId: command.providerId, providerEvidenceSha256: command.providerEvidenceSha256,
      createdByPersonId: actorPersonId, createdAt: at });
    const updated = Object.freeze({ ...file, fullContentSha256: command.contentSha256,
      sealedPayloadReference: command.sealedPayloadReference, providerId: command.providerId,
      providerEvidenceSha256: command.providerEvidenceSha256, totalBytes: command.sizeBytes,
      totalChunks: Math.ceil(command.sizeBytes / COMMUNICATION_FILE_CHUNK_BYTES), chunks: Object.freeze([]),
      scanState: 'not_run' as const, state: 'prepared_local' as const,
      versions: Object.freeze([...file.versions, version]), revision: file.revision + 1, updatedAt: at });
    next = Object.freeze({ ...center, files: replaceFile(center, updated), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'add_comment') {
    const body = normalizedText(command.body, 1, 2_000);
    if (!file || file.comments.length >= COMMUNICATION_FILE_MAX_COMMENTS || !SAFE_ID.test(command.commentId)
      || !body || file.comments.some((candidate) => candidate.id === command.commentId))
      return err(invalid(context, 'Dosya yorumu geçersizdir.'));
    const updated = Object.freeze({ ...file, comments: Object.freeze([...file.comments,
      Object.freeze({ id: command.commentId, authorPersonId: actorPersonId, body, createdAt: at })]),
      revision: file.revision + 1, updatedAt: at });
    next = Object.freeze({ ...center, files: replaceFile(center, updated), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'grant_access') {
    if (!file || file.state !== 'ready_local' || file.accessGrants.length >= COMMUNICATION_FILE_MAX_ACCESS_GRANTS
      || !SAFE_ID.test(command.grantId) || !SAFE_ID.test(command.personId)
      || !validIso(command.startsAt) || !validIso(command.endsAt) || Date.parse(command.endsAt) <= Date.parse(command.startsAt)
      || !['preview_only','download'].includes(command.mode)
      || Date.parse(command.endsAt) - Date.parse(command.startsAt) > 31 * 86_400_000
      || file.accessGrants.some((candidate) => candidate.id === command.grantId))
      return err(invalid(context, 'Süreli dosya erişim izni geçersizdir.'));
    const updated = Object.freeze({ ...file, accessGrants: Object.freeze([...file.accessGrants,
      Object.freeze({ id: command.grantId, personId: command.personId, mode: command.mode,
        startsAt: asIsoDateTime(command.startsAt), endsAt: asIsoDateTime(command.endsAt) })]),
      revision: file.revision + 1, updatedAt: at });
    next = Object.freeze({ ...center, files: replaceFile(center, updated), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'revoke_share') {
    if (!file || file.state === 'revoked') return err(conflict(context, 'Dosya paylaşımı bulunamadı veya zaten iptal edildi.'));
    const updated = Object.freeze({ ...file, state: 'revoked' as const,
      accessGrants: Object.freeze(file.accessGrants.map((grant) => grant.revokedAt ? grant : Object.freeze({ ...grant, revokedAt: at }))),
      revision: file.revision + 1, updatedAt: at });
    next = Object.freeze({ ...center, files: replaceFile(center, updated), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'link_archive') {
    if (!file || !SAFE_ID.test(command.archiveItemId) || file.archiveItemId)
      return err(conflict(context, 'Dosya yalnız tek arşiv kopyasına bağlanabilir.'));
    const updated = Object.freeze({ ...file, archiveItemId: command.archiveItemId, revision: file.revision + 1, updatedAt: at });
    next = Object.freeze({ ...center, files: replaceFile(center, updated), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'update_album') {
    const likes = canonicalIds(command.likedByPersonIds, 128);
    if (!file || !SAFE_ID.test(command.albumId) || !likes) return err(invalid(context, 'Albüm ortak seçim kaydı geçersizdir.'));
    if (file.albumId === command.albumId && file.selectedForStory === command.selectedForStory
      && file.likedByPersonIds.length === likes.length && file.likedByPersonIds.every((personId,index)=>personId===likes[index]))
      return err(conflict(context, 'Albüm ortak seçim kaydı değişmemiştir.'));
    const updated = Object.freeze({ ...file, albumId: command.albumId, selectedForStory: command.selectedForStory,
      likedByPersonIds: likes, revision: file.revision + 1, updatedAt: at });
    next = Object.freeze({ ...center, files: replaceFile(center, updated), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'set_notifications') {
    if (!TIME.test(command.quietHoursStart) || !TIME.test(command.quietHoursEnd)
      || command.roomOverrides.length > 128 || command.personOverrides.length > 128
      || command.roomOverrides.some((item) => !SAFE_ID.test(item.roomId) || typeof item.muted !== 'boolean')
      || command.personOverrides.some((item) => !SAFE_ID.test(item.personId) || typeof item.muted !== 'boolean'))
      return err(invalid(context, 'Bildirim ve sessiz saat ayarı geçersizdir.'));
    const profileFingerprint=hash(center.notificationProfile);
    const nextProfile=Object.freeze({quietHoursEnabled:command.quietHoursEnabled,quietHoursStart:command.quietHoursStart,
      quietHoursEnd:command.quietHoursEnd,nonEmergencyDigestEnabled:command.nonEmergencyDigestEnabled,
      roomOverrides:Object.freeze([...command.roomOverrides]),personOverrides:Object.freeze([...command.personOverrides])});
    if(profileFingerprint===hash(nextProfile))return err(conflict(context,'Bildirim ve sessiz saat ayarı değişmemiştir.'));
    next = Object.freeze({ ...center, notificationProfile: Object.freeze({
      quietHoursEnabled: command.quietHoursEnabled, quietHoursStart: command.quietHoursStart,
      quietHoursEnd: command.quietHoursEnd, nonEmergencyDigestEnabled: command.nonEmergencyDigestEnabled,
      roomOverrides: Object.freeze([...command.roomOverrides]), personOverrides: Object.freeze([...command.personOverrides]) }),
      revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'announce_emergency') {
    const title = normalizedText(command.title, 2, 500);
    if (!SAFE_ID.test(command.announcementId) || !title || center.emergencyAnnouncements.length >= 128
      || center.emergencyAnnouncements.some((candidate) => candidate.id === command.announcementId))
      return err(invalid(context, 'Acil aile duyurusu geçersizdir.'));
    next = Object.freeze({ ...center, emergencyAnnouncements: Object.freeze([Object.freeze({ id: command.announcementId,
      title, createdByPersonId: actorPersonId, acknowledgedPersonIds: Object.freeze([actorPersonId]),
      emergencyServiceGuaranteed: false as const, localDeliveryOnly: true as const, createdAt: at }),
      ...center.emergencyAnnouncements]), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'acknowledge_emergency') {
    const announcement = center.emergencyAnnouncements.find((candidate) => candidate.id === command.announcementId);
    if (!announcement) return err(missing(context, 'Acil aile duyurusu bulunamadı.'));
    if (announcement.acknowledgedPersonIds.includes(actorPersonId))
      return err(conflict(context, 'Acil aile duyurusu daha önce onaylandı.'));
    const acknowledgedPersonIds = Object.freeze([...new Set([...announcement.acknowledgedPersonIds, actorPersonId])].sort());
    next = Object.freeze({ ...center, emergencyAnnouncements: Object.freeze(center.emergencyAnnouncements.map((candidate) =>
      candidate.id === announcement.id ? Object.freeze({ ...candidate, acknowledgedPersonIds }) : candidate)),
      revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'request_remote_assistance') {
    const controls = canonicalIds(command.allowedControls, 3) as readonly ('pointer'|'keyboard'|'annotate')[] | null;
    if (!SAFE_ID.test(command.sessionId) || !SAFE_ID.test(command.helperPersonId) || !controls || controls.length < 1
      || controls.some((control)=>!['pointer','keyboard','annotate'].includes(control))
      || !validIso(command.endsAt) || Date.parse(command.endsAt) <= Date.parse(at)
      || Date.parse(command.endsAt) - Date.parse(at) > 60 * 60_000 || center.remoteAssistance.length >= 64
      || center.remoteAssistance.some((candidate) => candidate.id === command.sessionId))
      return err(invalid(context, 'Uzaktan yardım isteği geçersizdir.'));
    next = Object.freeze({ ...center, remoteAssistance: Object.freeze([Object.freeze({ id: command.sessionId,
      requesterPersonId: actorPersonId, helperPersonId: command.helperPersonId, state: 'consent_pending' as const,
      singleUseConsent: true as const, visibleIndicatorRequired: true as const,
      secureDesktopAndPasswordsHidden: true as const, allowedControls: controls, endsAt: asIsoDateTime(command.endsAt),
      remoteTransportConfigured: false as const }), ...center.remoteAssistance]),
      revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'grant_remote_assistance') {
    const session = center.remoteAssistance.find((candidate) => candidate.id === command.sessionId);
    if (!session || session.requesterPersonId !== actorPersonId || session.state !== 'consent_pending'
      || command.explicitSingleUseConsent !== true) return err(denied(context, 'Tek kullanımlık açık uzaktan yardım rızası doğrulanamadı.'));
    next = Object.freeze({ ...center, remoteAssistance: Object.freeze(center.remoteAssistance.map((candidate) => candidate.id === session.id
      ? Object.freeze({ ...candidate, state: 'active_local_plan' as const }) : candidate)),
      revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'revoke_remote_assistance') {
    const session = center.remoteAssistance.find((candidate) => candidate.id === command.sessionId);
    if (!session || session.requesterPersonId !== actorPersonId || ['revoked','expired'].includes(session.state))
      return err(conflict(context, 'Uzaktan yardım oturumu bulunamadı veya zaten kapalı.'));
    next = Object.freeze({ ...center, remoteAssistance: Object.freeze(center.remoteAssistance.map((candidate) => candidate.id === session.id
      ? Object.freeze({ ...candidate, state: 'revoked' as const, revokedAt: at }) : candidate)),
      revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'plan_co_watch') {
    const reference = normalizedText(command.mediaReference, 2, 512);
    if (!SAFE_ID.test(command.sessionId) || !reference || center.coWatchSessions.length >= 128
      || center.coWatchSessions.some((candidate) => candidate.id === command.sessionId))
      return err(invalid(context, 'Birlikte izleme planı geçersizdir.'));
    next = Object.freeze({ ...center, coWatchSessions: Object.freeze([Object.freeze({ id: command.sessionId,
      mediaReference: reference, narrationEnabled: command.narrationEnabled, state: 'local_plan' as const,
      sharePlayAdapterConfigured: false as const }), ...center.coWatchSessions]), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'prepare_voice_action') {
    const target = normalizedText(command.targetReference, 2, 512);
    if (!SAFE_ID.test(command.actionId) || !['call','send_message','join_meeting'].includes(command.action) || !target || center.voiceActions.length >= 128
      || center.voiceActions.some((candidate) => candidate.id === command.actionId))
      return err(invalid(context, 'Sesli işlem hazırlığı geçersizdir.'));
    next = Object.freeze({ ...center, voiceActions: Object.freeze([Object.freeze({ id: command.actionId,
      action: command.action, targetReference: target, state: 'confirmation_required' as const,
      executedExternally: false as const }), ...center.voiceActions]), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'confirm_voice_action') {
    const action = center.voiceActions.find((candidate) => candidate.id === command.actionId);
    if (!action || action.state !== 'confirmation_required' || command.explicitConfirmation !== true)
      return err(denied(context, 'Sesli işlem açık onay olmadan ilerleyemez.'));
    next = Object.freeze({ ...center, voiceActions: Object.freeze(center.voiceActions.map((candidate) => candidate.id === action.id
      ? Object.freeze({ ...candidate, state: 'confirmed_local_only' as const }) : candidate)),
      revision: center.revision + 1, generatedAt: at });
  } else {
    return err(invalid(context, 'Dosya paylaşım komut türü geçersizdir.'));
  }
  return ok(next);
};

const receipt = (
  row: CommunicationFileSharingMutationRow,
  replayed: boolean
): CommunicationFileSharingMutationReceiptView => Object.freeze({
  resourceId: row.resourceId, commandKind: row.commandKind, previousRevision: row.expectedRevision,
  revision: row.revision, occurredAt: row.occurredAt, replayed,
  externalOperationPerformed: false, networkUsed: false
});

const finish = (
  context: LifeApplicationContext,
  scope: CommunicationFileSharingWriteScope,
  row: CommunicationFileSharingMutationRow
): Result<CommunicationFileSharingMutationReceiptView, AppError> => {
  const audit = scope.appendAudit({ id: hash({ audit: row.id }), action: `communication.file-sharing.${row.commandKind}`,
    resourceType: row.resourceType, resourceId: row.resourceId, occurredAt: row.occurredAt,
    actorId: context.actor.userId });
  if (!audit.ok) return audit;
  const queued = scope.enqueueEvent({ eventId: asEventId(hash({ event: row.id })),
    eventType: 'communication.file-sharing.changed', eventVersion: 1, aggregateType: row.resourceType,
    aggregateId: row.resourceId, occurredAt: row.occurredAt, correlationId: context.correlationId,
    payload: Object.freeze({ commandKind: row.commandKind, revision: row.revision }) });
  return queued.ok ? ok(receipt(row, false)) : queued;
};

export class GetCommunicationFileSharingCenterUseCase {
  public constructor(private readonly query: CommunicationFileSharingQueryPort) {}
  public execute(context: LifeApplicationContext) { return this.query.getCenter(context); }
}

const SAFE_PREVIEW_MIME_TYPES = new Set<CommunicationFileSafePreviewView['mimeType']>([
  'text/plain','text/markdown','text/csv','application/json'
]);
const UNSAFE_PREVIEW_TEXT = /[\p{Cf}\p{Cs}\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;

export class GetCommunicationFileSafePreviewUseCase {
  public constructor(
    private readonly query: CommunicationFileSharingQueryPort,
    private readonly payloads: CommunicationFilePayloadPort
  ) {}
  public async execute(context: LifeApplicationContext, fileId: string)
  : Promise<Result<CommunicationFileSafePreviewView, AppError>> {
    if (!context.actor.personId || !SAFE_ID.test(fileId))
      return err(denied(context, 'Güvenli dosya önizlemesi kişi bağlı ve geçerli dosya kimliği gerektirir.'));
    const loaded = await this.query.getFile(context, fileId);
    if (!loaded.ok) return loaded;
    const file = loaded.value;
    if (file.ownerPersonId !== context.actor.personId || file.state !== 'ready_local' || file.scanState !== 'clean')
      return err(denied(context, 'Dosya yalnız sahibi için temiz ve hazır durumda önizlenebilir.'));
    if (!SAFE_PREVIEW_MIME_TYPES.has(file.mimeType as CommunicationFileSafePreviewView['mimeType'])
      || file.totalBytes < 1 || file.totalBytes > COMMUNICATION_FILE_SAFE_PREVIEW_MAX_BYTES)
      return err(denied(context, 'Dosya türü veya boyutu güvenli düz metin önizlemesine uygun değildir.'));
    const opened = this.payloads.open({ reference: file.sealedPayloadReference, familyId: context.familyId,
      ownerPersonId: file.ownerPersonId, fileId: file.id, displayName: file.displayName, mimeType: file.mimeType,
      totalBytes: file.totalBytes, fullContentSha256: file.fullContentSha256,
      providerEvidenceSha256: file.providerEvidenceSha256, correlationId: context.correlationId });
    if (!opened.ok) return opened;
    try {
      if (opened.value.byteLength !== file.totalBytes || opened.value.byteLength > COMMUNICATION_FILE_SAFE_PREVIEW_MAX_BYTES)
        return err(denied(context, 'Önizleme payload boyutu doğrulanamadı.'));
      let text: string;
      try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(opened.value); }
      catch { return err(denied(context, 'Önizleme içeriği kesin UTF-8 olarak doğrulanamadı.')); }
      if (text.length > COMMUNICATION_FILE_SAFE_PREVIEW_MAX_BYTES || UNSAFE_PREVIEW_TEXT.test(text))
        return err(denied(context, 'Önizleme içeriği güvenli düz metin sınırına uymuyor.'));
      return ok(Object.freeze({ schemaVersion: 1, fileId: file.id, displayName: file.displayName,
        mimeType: file.mimeType as CommunicationFileSafePreviewView['mimeType'], text, totalBytes: file.totalBytes,
        scanState: 'clean', accessMode: 'owner', renderingMode: 'escaped_plain_text', truncated: false,
        payloadSource: 'local_protected_payload', networkUsed: false, cloudUsed: false }));
    } finally { opened.value.fill(0); }
  }
}

export class MaintainCommunicationFilePayloadVaultUseCase {
  public constructor(
    private readonly query: CommunicationFileSharingQueryPort,
    private readonly payloads: CommunicationFilePayloadPort
  ) {}
  public async execute(context: LifeApplicationContext): Promise<Result<CommunicationFilePayloadMaintenanceView, AppError>> {
    if (!context.actor.personId) return err(denied(context, 'Dosya payload bakımı kişi bağlı oturum gerektirir.'));
    const loaded = await this.query.getMaintenanceState(context);
    if (!loaded.ok) return loaded;
    const referencedPayloads = Object.freeze([...new Set(loaded.value.center.files.flatMap((file) => [
      file.sealedPayloadReference, ...file.versions.map((version) => version.sealedPayloadReference)
    ]))].sort((left, right) => left.localeCompare(right)));
    const completedBefore = new Date(Date.parse(loaded.value.occurredAt) - COMMUNICATION_FILE_ORPHAN_GRACE_MS).toISOString();
    const swept = this.payloads.sweepOrphans({ familyId: context.familyId, ownerPersonId: context.actor.personId,
      referencedPayloads, completedBefore, maximumCandidates: 64, correlationId: context.correlationId });
    return swept.ok ? ok(Object.freeze({ ...swept.value, completedAt: asIsoDateTime(loaded.value.occurredAt),
      networkUsed: false, cloudUsed: false })) : swept;
  }
}

export interface PrepareCommunicationFileInput {
  readonly context: LifeApplicationContext;
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly roomId?: string;
  readonly meetingId?: string;
  readonly displayName: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

export const communicationFileId = (context: LifeApplicationContext, clientOperationId: string): string =>
  `comm-file-${hash({ familyId: context.familyId, accountId: context.actor.userId, clientOperationId }).slice(0, 48)}`;

export class PrepareCommunicationFileUseCase {
  public constructor(
    private readonly uow: CommunicationFileSharingUnitOfWork,
    private readonly payloads: CommunicationFilePayloadPort
  ) {}
  public async execute(input: PrepareCommunicationFileInput): Promise<Result<CommunicationFileSharingMutationReceiptView, AppError>> {
    const { context } = input;
    if (!context.actor.personId) return err(denied(context, 'Dosya hazırlığı kişi bağlı oturum gerektirir.'));
    if (!SAFE_ID.test(input.clientOperationId) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0
      || (!input.roomId && !input.meetingId) || (input.roomId !== undefined && !SAFE_ID.test(input.roomId))
      || (input.meetingId !== undefined && !SAFE_ID.test(input.meetingId)) || !normalizedText(input.displayName, 1, 255)
      || !MIME.test(input.mimeType) || !(input.bytes instanceof Uint8Array) || input.bytes.byteLength < 1
      || input.bytes.byteLength > COMMUNICATION_FILE_LOCAL_STAGING_MAX_BYTES)
      return err(invalid(context, 'Yerel dosya hazırlama girdisi geçersizdir.'));
    const ownerPersonId = context.actor.personId;
    const key = communicationFileSharingKey(context, ownerPersonId);
    const fileId = communicationFileId(context, input.clientOperationId);
    const requestFingerprint = hash({ expectedRevision: input.expectedRevision, roomId: input.roomId ?? null,
      meetingId: input.meetingId ?? null, displayName: input.displayName.normalize('NFKC').trim(), mimeType: input.mimeType,
      totalBytes: input.bytes.byteLength, contentSha256: createHash('sha256').update(input.bytes).digest('hex') });
    const resource = Object.freeze({ resourceType: 'communication_file_sharing' as const, resourceId: fileId });
    const intent: LifePolicyIntent = Object.freeze({ action: 'create', capability: 'family.write',
      resourceType: resource.resourceType, resourceId: fileId, purpose: 'general',
      ownerPersonId: asPersonId(ownerPersonId), privacy: 'private' as const });
    let sealedReference: string | undefined;
    const result = await this.uow.execute(context, intent, (scope) => {
      const previous = scope.findMutation(input.clientOperationId); if (!previous.ok) return previous;
      if (previous.value) return previous.value.requestFingerprint === requestFingerprint
        && previous.value.expectedRevision === input.expectedRevision && previous.value.commandKind === 'prepare_file'
        && previous.value.resourceType === resource.resourceType && previous.value.resourceId === fileId
        ? ok(receipt(previous.value, true)) : err(conflict(context, 'Aynı clientOperationId farklı yerel dosya hazırlığına aittir.'));
      const loaded = scope.load(); if (!loaded.ok) return loaded;
      const current = loaded.value?.snapshot ?? emptyCommunicationFileSharingCenter(scope.key, scope.occurredAt);
      if (current.revision !== input.expectedRevision) return err(conflict(context, 'Dosya paylaşım merkezi sürümü değişti.'));
      const referencedPayloads = Object.freeze([...new Set(current.files.flatMap((file) => [
        file.sealedPayloadReference, ...file.versions.map((version) => version.sealedPayloadReference)
      ]))].sort((left, right) => left.localeCompare(right)));
      const completedBefore = new Date(Date.parse(scope.occurredAt) - COMMUNICATION_FILE_ORPHAN_GRACE_MS).toISOString();
      const swept = this.payloads.sweepOrphans({ familyId: context.familyId, ownerPersonId,
        referencedPayloads, completedBefore, maximumCandidates: 64, correlationId: context.correlationId });
      if (!swept.ok) return swept;
      const sealed = this.payloads.seal({ familyId: context.familyId, ownerPersonId, fileId,
        displayName: input.displayName, mimeType: input.mimeType, bytes: input.bytes,
        occurredAt: scope.occurredAt, correlationId: context.correlationId });
      if (!sealed.ok) return sealed;
      sealedReference = sealed.value.sealedPayloadReference;
      const command: CommunicationFileSharingCommand = Object.freeze({ kind: 'prepare_file', fileId,
        ...(input.roomId === undefined ? {} : { roomId: input.roomId }),
        ...(input.meetingId === undefined ? {} : { meetingId: input.meetingId }),
        displayName: input.displayName, mimeType: input.mimeType, totalBytes: sealed.value.totalBytes,
        totalChunks: sealed.value.totalChunks, fullContentSha256: sealed.value.fullContentSha256,
        sealedPayloadReference: sealed.value.sealedPayloadReference, providerId: sealed.value.providerId,
        providerEvidenceSha256: sealed.value.providerEvidenceSha256, verifiedChunks: sealed.value.verifiedChunks,
        scanState: sealed.value.scanState,
        ...(sealed.value.scanProviderId === undefined ? {} : { scanProviderId: sealed.value.scanProviderId }),
        ...(sealed.value.scanEvidenceSha256 === undefined ? {} : { scanEvidenceSha256: sealed.value.scanEvidenceSha256 }) });
      const reduced = reduce(context, current, command, scope.occurredAt); if (!reduced.ok) return reduced;
      const stateFingerprint = hash(reduced.value);
      const mutation: CommunicationFileSharingMutationRow = Object.freeze({ id: hash({ clientOperationId: input.clientOperationId,
        familyId: context.familyId, ownerPersonId, requestFingerprint }), familyId: asFamilyId(context.familyId),
        ownerPersonId: asPersonId(ownerPersonId), centerId: scope.key.centerId, resourceType: resource.resourceType,
        resourceId: fileId, actorAccountId: context.actor.userId, actorPersonId: asPersonId(ownerPersonId),
        clientOperationId: input.clientOperationId, commandKind: 'prepare_file', requestFingerprint,
        expectedRevision: input.expectedRevision, revision: input.expectedRevision + 1, stateFingerprint,
        occurredAt: scope.occurredAt });
      const row: CommunicationFileSharingCenterRow = Object.freeze({ key: scope.key, snapshot: reduced.value,
        stateFingerprint, lastMutationId: mutation.id, updatedAt: scope.occurredAt });
      const saved = scope.save(row, mutation, input.expectedRevision);
      return saved.ok ? finish(context, scope, mutation) : saved;
    });
    if (!result.ok && sealedReference !== undefined) this.payloads.discard(sealedReference, context.correlationId);
    return result;
  }
}

export class ApplyCommunicationFileSharingCommandUseCase {
  public constructor(private readonly uow: CommunicationFileSharingUnitOfWork) {}
  public execute(input: { readonly context: LifeApplicationContext; readonly clientOperationId: string;
    readonly expectedRevision: number; readonly command: CommunicationFileSharingCommand }) {
    const { context, clientOperationId, expectedRevision, command } = input;
    if (!context.actor.personId) return Promise.resolve(err(denied(context, 'İletişim dosya paylaşımı kişi bağlı oturum gerektirir.')));
    const actorPersonId = context.actor.personId;
    if (!command || typeof command !== 'object' || !COMMAND_KINDS.has(command.kind)
      || !SAFE_ID.test(clientOperationId) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
      return Promise.resolve(err(invalid(context, 'Dosya paylaşım işlem kimliği veya sürümü geçersizdir.')));
    const requestFingerprint = hash({ expectedRevision, command });
    const key = communicationFileSharingKey(context, actorPersonId);
    const intent = communicationFileSharingWriteIntent(key, command, expectedRevision);
    const resource = policyResource(key, command);
    return this.uow.execute(context, intent, (scope) => {
      const previous = scope.findMutation(clientOperationId); if (!previous.ok) return previous;
      if (previous.value) return previous.value.requestFingerprint === requestFingerprint
        && previous.value.expectedRevision === expectedRevision && previous.value.commandKind === command.kind
        && previous.value.resourceType === resource.resourceType && previous.value.resourceId === resource.resourceId
        ? ok(receipt(previous.value, true)) : err(conflict(context, 'Aynı clientOperationId farklı dosya paylaşım komutuna aittir.'));
      const loaded = scope.load(); if (!loaded.ok) return loaded;
      const current = loaded.value?.snapshot ?? emptyCommunicationFileSharingCenter(scope.key, scope.occurredAt);
      if (current.revision !== expectedRevision) return err(conflict(context, 'Dosya paylaşım merkezi sürümü değişti.'));
      const persons=validateReferencedPersons(context,scope,command);if(!persons.ok)return persons;
      const reduced = reduce(context, current, command, scope.occurredAt); if (!reduced.ok) return reduced;
      const stateFingerprint = hash(reduced.value);
      const mutation: CommunicationFileSharingMutationRow = Object.freeze({ id: hash({ clientOperationId,
        familyId: context.familyId, ownerPersonId: actorPersonId, requestFingerprint }),
        familyId: asFamilyId(context.familyId), ownerPersonId: asPersonId(actorPersonId), centerId: scope.key.centerId,
        resourceType: resource.resourceType, resourceId: resource.resourceId,
        actorAccountId: context.actor.userId, actorPersonId: asPersonId(actorPersonId), clientOperationId,
        commandKind: command.kind, requestFingerprint, expectedRevision, revision: expectedRevision + 1,
        stateFingerprint, occurredAt: scope.occurredAt });
      const row: CommunicationFileSharingCenterRow = Object.freeze({ key: scope.key, snapshot: reduced.value,
        stateFingerprint, lastMutationId: mutation.id, updatedAt: scope.occurredAt });
      const saved = scope.save(row, mutation, expectedRevision);
      return saved.ok ? finish(context, scope, mutation) : saved;
    });
  }
}
