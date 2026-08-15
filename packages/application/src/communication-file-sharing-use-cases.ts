import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
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
  COMMUNICATION_FILE_MAX_BYTES,
  communicationFileSharingCenterId,
  communicationFileSharingTruth,
  type CommunicationFileShareView,
  type CommunicationFileSharingCenterView,
  type CommunicationFileSharingCommand,
  type CommunicationFileSharingMutationReceiptView
} from '@ppt/domain';
import type {
  CommunicationFileSharingCenterKey,
  CommunicationFileSharingCenterRow,
  CommunicationFileSharingMutationRow,
  RepositoryResult
} from '@ppt/repository-contracts';
import type { LifeApplicationContext, LifePolicyIntent } from './life-use-cases.js';

export interface CommunicationFileSharingQueryPort {
  getCenter(context: LifeApplicationContext): Promise<Result<CommunicationFileSharingCenterView, AppError>>;
}

export interface CommunicationFileSharingWriteScope {
  readonly key: CommunicationFileSharingCenterKey;
  readonly occurredAt: CommunicationFileSharingMutationRow['occurredAt'];
  load(): RepositoryResult<CommunicationFileSharingCenterRow | null>;
  findMutation(clientOperationId: string): RepositoryResult<CommunicationFileSharingMutationRow | null>;
  save(
    row: CommunicationFileSharingCenterRow,
    mutation: CommunicationFileSharingMutationRow,
    expectedRevision: number
  ): RepositoryResult<void>;
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
const MIME = /^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,127}$/u;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/u;
const CONTROL = /[\p{Cc}\p{Cf}\p{Cs}]/u;
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

export const communicationFileSharingReadIntent = (): LifePolicyIntent => ({
  action: 'read', capability: 'family.read', resourceType: 'communication_file_sharing_center', resourceId: '*', purpose: 'general'
});
export const communicationFileSharingWriteIntent = (ownerPersonId: string): LifePolicyIntent => ({
  action: 'update', capability: 'family.write', resourceType: 'communication_file_sharing',
  resourceId: `communication-file-sharing:${ownerPersonId}`, purpose: 'general'
});

export const communicationFileSharingKey = (
  context: LifeApplicationContext,
  ownerPersonId: string
): CommunicationFileSharingCenterKey => ({
  familyId: asFamilyId(context.familyId), ownerPersonId: asPersonId(ownerPersonId),
  centerId: communicationFileSharingCenterId(context.familyId, ownerPersonId)
});

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
      || !SHA256.test(command.fullContentSha256) || !SAFE_ID.test(command.sealedPayloadReference)
      || center.files.some((candidate) => candidate.id === command.fileId))
      return err(invalid(context, 'Dosya paylaşım hazırlığı geçersizdir.'));
    const prepared: CommunicationFileShareView = Object.freeze({ id: command.fileId,
      ...(command.roomId ? { roomId: command.roomId } : {}), ...(command.meetingId ? { meetingId: command.meetingId } : {}),
      ownerPersonId: actorPersonId, displayName: name, mimeType: command.mimeType, totalBytes: command.totalBytes,
      totalChunks: command.totalChunks, fullContentSha256: command.fullContentSha256,
      sealedPayloadReference: command.sealedPayloadReference, state: 'prepared_local', scanState: 'not_run',
      chunks: Object.freeze([]), versions: Object.freeze([{ version: 1, contentSha256: command.fullContentSha256,
        sizeBytes: command.totalBytes, sealedPayloadReference: command.sealedPayloadReference,
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
    const chunks = existing ? file.chunks : Object.freeze([...file.chunks, Object.freeze({ chunkIndex: command.chunkIndex,
      offsetBytes: command.offsetBytes, sizeBytes: command.sizeBytes, sha256: command.sha256, verifiedAt: at })]
      .sort((left, right) => left.chunkIndex - right.chunkIndex));
    const updated = Object.freeze({ ...file, chunks, state: chunks.length === file.totalChunks ? 'scan_required' as const
      : 'transferring_local' as const, revision: file.revision + 1, updatedAt: at });
    next = Object.freeze({ ...center, files: replaceFile(center, updated), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'set_scan') {
    if (!file || file.state !== 'scan_required' || file.chunks.length !== file.totalChunks)
      return err(conflict(context, 'Tüm parçalar doğrulanmadan tarama sonucu kaydedilemez.'));
    const state = command.scanState === 'clean' ? 'ready_local' as const
      : command.scanState === 'malicious' ? 'quarantined' as const : 'scan_required' as const;
    const updated = Object.freeze({ ...file, scanState: command.scanState, state, revision: file.revision + 1, updatedAt: at });
    next = Object.freeze({ ...center, files: replaceFile(center, updated), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'add_version') {
    if (!file || file.state === 'revoked' || !SHA256.test(command.contentSha256) || !SAFE_ID.test(command.sealedPayloadReference)
      || !Number.isSafeInteger(command.sizeBytes) || command.sizeBytes < 1 || command.sizeBytes > COMMUNICATION_FILE_MAX_BYTES)
      return err(invalid(context, 'Dosya sürümü geçersizdir.'));
    const version = Object.freeze({ version: file.versions.length + 1, contentSha256: command.contentSha256,
      sizeBytes: command.sizeBytes, sealedPayloadReference: command.sealedPayloadReference,
      createdByPersonId: actorPersonId, createdAt: at });
    const updated = Object.freeze({ ...file, fullContentSha256: command.contentSha256,
      sealedPayloadReference: command.sealedPayloadReference, totalBytes: command.sizeBytes,
      totalChunks: Math.ceil(command.sizeBytes / COMMUNICATION_FILE_CHUNK_BYTES), chunks: Object.freeze([]),
      scanState: 'not_run' as const, state: 'prepared_local' as const,
      versions: Object.freeze([...file.versions, version]), revision: file.revision + 1, updatedAt: at });
    next = Object.freeze({ ...center, files: replaceFile(center, updated), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'add_comment') {
    const body = normalizedText(command.body, 1, 2_000);
    if (!file || !SAFE_ID.test(command.commentId) || !body || file.comments.some((candidate) => candidate.id === command.commentId))
      return err(invalid(context, 'Dosya yorumu geçersizdir.'));
    const updated = Object.freeze({ ...file, comments: Object.freeze([...file.comments,
      Object.freeze({ id: command.commentId, authorPersonId: actorPersonId, body, createdAt: at })]),
      revision: file.revision + 1, updatedAt: at });
    next = Object.freeze({ ...center, files: replaceFile(center, updated), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'grant_access') {
    if (!file || file.state !== 'ready_local' || !SAFE_ID.test(command.grantId) || !SAFE_ID.test(command.personId)
      || !validIso(command.startsAt) || !validIso(command.endsAt) || Date.parse(command.endsAt) <= Date.parse(command.startsAt)
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
    if (!file || !SAFE_ID.test(command.archiveItemId) || (file.archiveItemId && file.archiveItemId !== command.archiveItemId))
      return err(conflict(context, 'Dosya yalnız tek arşiv kopyasına bağlanabilir.'));
    const updated = Object.freeze({ ...file, archiveItemId: command.archiveItemId, revision: file.revision + 1, updatedAt: at });
    next = Object.freeze({ ...center, files: replaceFile(center, updated), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'update_album') {
    const likes = canonicalIds(command.likedByPersonIds, 128);
    if (!file || !SAFE_ID.test(command.albumId) || !likes) return err(invalid(context, 'Albüm ortak seçim kaydı geçersizdir.'));
    const updated = Object.freeze({ ...file, albumId: command.albumId, selectedForStory: command.selectedForStory,
      likedByPersonIds: likes, revision: file.revision + 1, updatedAt: at });
    next = Object.freeze({ ...center, files: replaceFile(center, updated), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'set_notifications') {
    if (!TIME.test(command.quietHoursStart) || !TIME.test(command.quietHoursEnd)
      || command.roomOverrides.length > 128 || command.personOverrides.length > 128
      || command.roomOverrides.some((item) => !SAFE_ID.test(item.roomId) || typeof item.muted !== 'boolean')
      || command.personOverrides.some((item) => !SAFE_ID.test(item.personId) || typeof item.muted !== 'boolean'))
      return err(invalid(context, 'Bildirim ve sessiz saat ayarı geçersizdir.'));
    next = Object.freeze({ ...center, notificationProfile: Object.freeze({ ...command,
      roomOverrides: Object.freeze([...command.roomOverrides]), personOverrides: Object.freeze([...command.personOverrides]) }),
      revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'announce_emergency') {
    const title = normalizedText(command.title, 2, 500);
    if (!SAFE_ID.test(command.announcementId) || !title
      || center.emergencyAnnouncements.some((candidate) => candidate.id === command.announcementId))
      return err(invalid(context, 'Acil aile duyurusu geçersizdir.'));
    next = Object.freeze({ ...center, emergencyAnnouncements: Object.freeze([Object.freeze({ id: command.announcementId,
      title, createdByPersonId: actorPersonId, acknowledgedPersonIds: Object.freeze([actorPersonId]),
      emergencyServiceGuaranteed: false as const, localDeliveryOnly: true as const, createdAt: at }),
      ...center.emergencyAnnouncements]), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'acknowledge_emergency') {
    const announcement = center.emergencyAnnouncements.find((candidate) => candidate.id === command.announcementId);
    if (!announcement) return err(missing(context, 'Acil aile duyurusu bulunamadı.'));
    const acknowledgedPersonIds = Object.freeze([...new Set([...announcement.acknowledgedPersonIds, actorPersonId])].sort());
    next = Object.freeze({ ...center, emergencyAnnouncements: Object.freeze(center.emergencyAnnouncements.map((candidate) =>
      candidate.id === announcement.id ? Object.freeze({ ...candidate, acknowledgedPersonIds }) : candidate)),
      revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'request_remote_assistance') {
    const controls = canonicalIds(command.allowedControls, 3) as readonly ('pointer'|'keyboard'|'annotate')[] | null;
    if (!SAFE_ID.test(command.sessionId) || !SAFE_ID.test(command.helperPersonId) || !controls || controls.length < 1
      || !validIso(command.endsAt) || Date.parse(command.endsAt) <= Date.parse(at)
      || Date.parse(command.endsAt) - Date.parse(at) > 60 * 60_000
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
    if (!SAFE_ID.test(command.sessionId) || !reference || center.coWatchSessions.some((candidate) => candidate.id === command.sessionId))
      return err(invalid(context, 'Birlikte izleme planı geçersizdir.'));
    next = Object.freeze({ ...center, coWatchSessions: Object.freeze([Object.freeze({ id: command.sessionId,
      mediaReference: reference, narrationEnabled: command.narrationEnabled, state: 'local_plan' as const,
      sharePlayAdapterConfigured: false as const }), ...center.coWatchSessions]), revision: center.revision + 1, generatedAt: at });
  } else if (command.kind === 'prepare_voice_action') {
    const target = normalizedText(command.targetReference, 2, 512);
    if (!SAFE_ID.test(command.actionId) || !target || center.voiceActions.some((candidate) => candidate.id === command.actionId))
      return err(invalid(context, 'Sesli işlem hazırlığı geçersizdir.'));
    next = Object.freeze({ ...center, voiceActions: Object.freeze([Object.freeze({ id: command.actionId,
      action: command.action, targetReference: target, state: 'confirmation_required' as const,
      executedExternally: false as const }), ...center.voiceActions]), revision: center.revision + 1, generatedAt: at });
  } else {
    const action = center.voiceActions.find((candidate) => candidate.id === command.actionId);
    if (!action || action.state !== 'confirmation_required' || command.explicitConfirmation !== true)
      return err(denied(context, 'Sesli işlem açık onay olmadan ilerleyemez.'));
    next = Object.freeze({ ...center, voiceActions: Object.freeze(center.voiceActions.map((candidate) => candidate.id === action.id
      ? Object.freeze({ ...candidate, state: 'confirmed_local_only' as const }) : candidate)),
      revision: center.revision + 1, generatedAt: at });
  }
  return ok(next);
};

const receipt = (
  row: CommunicationFileSharingMutationRow,
  replayed: boolean
): CommunicationFileSharingMutationReceiptView => Object.freeze({
  resourceId: row.centerId, commandKind: row.commandKind, previousRevision: row.expectedRevision,
  revision: row.revision, occurredAt: row.occurredAt, replayed,
  externalOperationPerformed: false, networkUsed: false
});

export class GetCommunicationFileSharingCenterUseCase {
  public constructor(private readonly query: CommunicationFileSharingQueryPort) {}
  public execute(context: LifeApplicationContext) { return this.query.getCenter(context); }
}

export class ApplyCommunicationFileSharingCommandUseCase {
  public constructor(private readonly uow: CommunicationFileSharingUnitOfWork) {}
  public execute(input: { readonly context: LifeApplicationContext; readonly clientOperationId: string;
    readonly expectedRevision: number; readonly command: CommunicationFileSharingCommand }) {
    const { context, clientOperationId, expectedRevision, command } = input;
    if (!context.actor.personId) return Promise.resolve(err(denied(context, 'İletişim dosya paylaşımı kişi bağlı oturum gerektirir.')));
    const actorPersonId = context.actor.personId;
    if (!SAFE_ID.test(clientOperationId) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
      return Promise.resolve(err(invalid(context, 'Dosya paylaşım işlem kimliği veya sürümü geçersizdir.')));
    const requestFingerprint = hash({ expectedRevision, command });
    return this.uow.execute(context, communicationFileSharingWriteIntent(actorPersonId), (scope) => {
      const previous = scope.findMutation(clientOperationId); if (!previous.ok) return previous;
      if (previous.value) return previous.value.requestFingerprint === requestFingerprint
        && previous.value.expectedRevision === expectedRevision && previous.value.commandKind === command.kind
        ? ok(receipt(previous.value, true)) : err(conflict(context, 'Aynı clientOperationId farklı dosya paylaşım komutuna aittir.'));
      const loaded = scope.load(); if (!loaded.ok) return loaded;
      const current = loaded.value?.snapshot ?? emptyCommunicationFileSharingCenter(scope.key, scope.occurredAt);
      if (current.revision !== expectedRevision) return err(conflict(context, 'Dosya paylaşım merkezi sürümü değişti.'));
      const reduced = reduce(context, current, command, scope.occurredAt); if (!reduced.ok) return reduced;
      const stateFingerprint = hash(reduced.value);
      const mutation: CommunicationFileSharingMutationRow = Object.freeze({ id: hash({ clientOperationId,
        familyId: context.familyId, ownerPersonId: actorPersonId, requestFingerprint }),
        familyId: asFamilyId(context.familyId), ownerPersonId: asPersonId(actorPersonId), centerId: scope.key.centerId,
        actorAccountId: context.actor.userId, actorPersonId: asPersonId(actorPersonId), clientOperationId,
        commandKind: command.kind, requestFingerprint, expectedRevision, revision: expectedRevision + 1,
        policyReceiptId: hash({ correlationId: context.correlationId, intent: communicationFileSharingWriteIntent(actorPersonId),
          familyId: context.familyId, actorAccountId: context.actor.userId }), stateFingerprint, occurredAt: scope.occurredAt });
      const row: CommunicationFileSharingCenterRow = Object.freeze({ key: scope.key, snapshot: reduced.value,
        stateFingerprint, lastMutationId: mutation.id, updatedAt: scope.occurredAt });
      const saved = scope.save(row, mutation, expectedRevision);
      return saved.ok ? ok(receipt(mutation, false)) : saved;
    });
  }
}
