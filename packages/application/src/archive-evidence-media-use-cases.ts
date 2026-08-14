import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type EventId,
  type Result
} from '@ppt/core';
import type {
  ArchiveRelationEvidenceConfidence,
  ArchiveRelationEvidenceHistoryView,
  ArchiveRelationEvidenceView,
  ArchiveVersionView
} from '@ppt/domain';
import type {
  ArchiveApplicationContext,
  ArchiveQueryPort,
  ArchiveUnitOfWork
} from './archive-use-cases.js';

const invalid = (context: ArchiveApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_INVALID_ARGUMENT,
  message,
  category: 'validation',
  correlationId: context.correlationId
});

const missing = (context: ArchiveApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_NOT_FOUND,
  message,
  category: 'not_found',
  correlationId: context.correlationId
});

const conflict = (context: ArchiveApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_CONFLICT,
  message,
  category: 'conflict',
  correlationId: context.correlationId
});

const validId = (value: string): boolean => {
  const normalized = value.trim();
  return normalized.length >= 1 && normalized.length <= 128 && !/[\u0000-\u001f\u007f]/u.test(normalized);
};

const validEvidenceDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
};

const requireOperationIdentity = (
  context: ArchiveApplicationContext
): Result<Readonly<{ clientOperationId: string; requestFingerprint: string }>, AppError> => {
  if (!context.operationId || !validId(context.operationId) || !context.operationFingerprint
    || !/^[a-f0-9]{64}$/u.test(context.operationFingerprint)) {
    return err(invalid(context, 'Arşiv kanıtı mutasyonu geçerli işlem kimliği ve fingerprint gerektirir.'));
  }
  return ok(Object.freeze({
    clientOperationId: context.operationId,
    requestFingerprint: context.operationFingerprint
  }));
};

export class ListArchiveRelationEvidenceUseCase {
  public constructor(private readonly queries: ArchiveQueryPort) {}

  public execute(
    context: ArchiveApplicationContext,
    archiveItemId: string
  ): Promise<Result<readonly ArchiveRelationEvidenceView[], AppError>> | Result<never, AppError> {
    const id = archiveItemId.trim();
    if (!validId(id)) return err(invalid(context, 'Kanıt belgesi kimliği geçersizdir.'));
    return this.queries.listRelationEvidence(context, id);
  }
}

export class ListArchiveRelationEvidenceHistoryUseCase {
  public constructor(private readonly queries: ArchiveQueryPort) {}

  public execute(
    context: ArchiveApplicationContext,
    archiveItemId: string
  ): Promise<Result<readonly ArchiveRelationEvidenceHistoryView[], AppError>> | Result<never, AppError> {
    const id = archiveItemId.trim();
    if (!validId(id)) return err(invalid(context, 'Kanıt geçmişi belge kimliği geçersizdir.'));
    return this.queries.listRelationEvidenceHistory(context, id);
  }
}

export class AddArchiveRelationEvidenceUseCase {
  public constructor(private readonly unitOfWork: ArchiveUnitOfWork) {}

  public async execute(input: {
    readonly context: ArchiveApplicationContext;
    readonly command: {
      readonly relationId: string;
      readonly archiveItemId: string;
      readonly evidenceDate: string;
      readonly confidence: ArchiveRelationEvidenceConfidence;
    };
    readonly identifiers: {
      readonly evidenceId: string;
      readonly mutationId: string;
      readonly auditId: string;
      readonly outboxEventId: EventId;
    };
  }): Promise<Result<ArchiveRelationEvidenceView, AppError>> {
    const relationId = input.command.relationId.trim();
    const archiveItemId = input.command.archiveItemId.trim();
    if (!validId(relationId) || !validId(archiveItemId)) {
      return err(invalid(input.context, 'İlişki veya kanıt belgesi kimliği geçersizdir.'));
    }
    if (!validEvidenceDate(input.command.evidenceDate)) {
      return err(invalid(input.context, 'Kanıt tarihi YYYY-AA-GG biçiminde gerçek bir tarih olmalıdır.'));
    }
    if (!(['low', 'medium', 'high'] as const).includes(input.command.confidence)) {
      return err(invalid(input.context, 'Kanıt güven düzeyi geçersizdir.'));
    }
    const identity = requireOperationIdentity(input.context);
    if (!identity.ok) return identity;
    return this.unitOfWork.execute(input.context, {
      action: 'update', capability: 'archive.write', resourceType: 'archive_item',
      resourceId: archiveItemId, purpose: 'archive'
    }, (scope) => {
      if (Date.parse(`${input.command.evidenceDate}T00:00:00.000Z`) > Date.parse(scope.occurredAt)) {
        return err(invalid(input.context, 'Kanıt tarihi gelecekte olamaz.'));
      }
      const saved = scope.insertRelationEvidence({
        evidenceId: input.identifiers.evidenceId,
        relationId,
        archiveItemId,
        evidenceDate: input.command.evidenceDate,
        confidence: input.command.confidence,
        mutationId: input.identifiers.mutationId,
        clientOperationId: identity.value.clientOperationId,
        requestFingerprint: identity.value.requestFingerprint,
        occurredAt: scope.occurredAt
      });
      if (!saved.ok) return saved;
      const audited = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'archive.relation_evidence_created',
        resourceType: 'archive_item',
        resourceId: archiveItemId,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audited.ok) return audited;
      const queued = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'archive.relation_evidence.created',
        eventVersion: 1,
        aggregateType: 'archive_item',
        aggregateId: archiveItemId,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: { evidenceId: saved.value.id, revision: saved.value.revision, status: saved.value.status }
      });
      return queued.ok ? ok(saved.value) : queued;
    });
  }
}

export class RemoveArchiveRelationEvidenceUseCase {
  public constructor(private readonly unitOfWork: ArchiveUnitOfWork) {}

  public async execute(input: {
    readonly context: ArchiveApplicationContext;
    readonly command: {
      readonly evidenceId: string;
      readonly archiveItemId: string;
      readonly expectedRevision: number;
    };
    readonly identifiers: {
      readonly mutationId: string;
      readonly auditId: string;
      readonly outboxEventId: EventId;
    };
  }): Promise<Result<ArchiveRelationEvidenceView, AppError>> {
    const evidenceId = input.command.evidenceId.trim();
    const archiveItemId = input.command.archiveItemId.trim();
    if (!validId(evidenceId) || !validId(archiveItemId)
      || !Number.isInteger(input.command.expectedRevision) || input.command.expectedRevision < 1) {
      return err(invalid(input.context, 'Kaldırılacak kanıt kimliği veya revizyonu geçersizdir.'));
    }
    const identity = requireOperationIdentity(input.context);
    if (!identity.ok) return identity;
    return this.unitOfWork.execute(input.context, {
      action: 'update', capability: 'archive.write', resourceType: 'archive_item',
      resourceId: archiveItemId, purpose: 'archive'
    }, (scope) => {
      const saved = scope.removeRelationEvidence({
        evidenceId,
        archiveItemId,
        expectedRevision: input.command.expectedRevision,
        mutationId: input.identifiers.mutationId,
        clientOperationId: identity.value.clientOperationId,
        requestFingerprint: identity.value.requestFingerprint,
        occurredAt: scope.occurredAt
      });
      if (!saved.ok) return saved;
      if (!saved.value) return err(conflict(input.context, 'Kanıt bulunamadı, kaldırılmış veya revizyonu değişmiştir.'));
      const audited = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'archive.relation_evidence_removed',
        resourceType: 'archive_item',
        resourceId: archiveItemId,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audited.ok) return audited;
      const queued = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'archive.relation_evidence.removed',
        eventVersion: 1,
        aggregateType: 'archive_item',
        aggregateId: archiveItemId,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: { evidenceId: saved.value.id, revision: saved.value.revision, status: saved.value.status }
      });
      return queued.ok ? ok(saved.value) : queued;
    });
  }
}

export class AddArchiveItemVersionUseCase {
  public constructor(private readonly unitOfWork: ArchiveUnitOfWork) {}

  public async execute(input: {
    readonly context: ArchiveApplicationContext;
    readonly command: {
      readonly itemId: string;
      readonly originalName: string;
      readonly storedName: string;
      readonly mimeType: string;
      readonly sizeBytes: number;
      readonly sha256: string;
      readonly note?: string;
    };
    readonly identifiers: {
      readonly versionId: string;
      readonly auditId: string;
      readonly outboxEventId: EventId;
    };
  }): Promise<Result<ArchiveVersionView, AppError>> {
    const itemId = input.command.itemId.trim();
    const note = input.command.note?.trim();
    if (!validId(itemId) || !input.command.originalName.trim() || !input.command.storedName.trim()
      || !input.command.mimeType.trim() || !Number.isInteger(input.command.sizeBytes)
      || input.command.sizeBytes < 1 || input.command.sizeBytes > 250 * 1024 * 1024
      || !/^[a-f0-9]{64}$/iu.test(input.command.sha256)
      || (note !== undefined && note.length > 500)) {
      return err(invalid(input.context, 'Yeni arşiv sürümü metadata alanları geçersizdir.'));
    }
    return this.unitOfWork.execute(input.context, {
      action: 'update', capability: 'archive.write', resourceType: 'archive_item',
      resourceId: itemId, purpose: 'archive'
    }, (scope) => {
      const current = scope.findOpenPlan(itemId);
      if (!current.ok) return current;
      if (!current.value) return err(missing(input.context, 'Sürümlenecek arşiv kaydı bulunamadı.'));
      const versions = scope.listVersions(itemId);
      if (!versions.ok) return versions;
      if (versions.value.some((version) => version.sha256.toLowerCase() === input.command.sha256.toLowerCase())) {
        return err(conflict(input.context, 'Aynı dosya özeti bu arşiv kaydında zaten sürüm olarak bulunuyor.'));
      }
      const versionNo = versions.value.reduce((maximum, version) => Math.max(maximum, version.versionNo), 0) + 1;
      if (versionNo < 2 || versionNo > 1_000) {
        return err(conflict(input.context, 'Arşiv sürüm sınırı aşıldı.'));
      }
      const version: ArchiveVersionView & { readonly storedName: string } = {
        id: input.identifiers.versionId,
        archiveItemId: itemId,
        versionNo,
        originalName: input.command.originalName,
        storedName: input.command.storedName,
        mimeType: input.command.mimeType,
        sizeBytes: input.command.sizeBytes,
        sha256: input.command.sha256.toLowerCase(),
        createdAt: scope.occurredAt,
        ...(note ? { note } : {})
      };
      const inserted = scope.insertVersion(version);
      if (!inserted.ok) return inserted;
      const replaced = scope.replaceItemFile({
        itemId,
        originalName: version.originalName,
        storedName: version.storedName,
        mimeType: version.mimeType,
        sizeBytes: version.sizeBytes,
        sha256: version.sha256
      });
      if (!replaced.ok) return replaced;
      const audited = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'archive.version_added',
        resourceType: 'archive_item',
        resourceId: itemId,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audited.ok) return audited;
      const queued = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'archive.item.version_added',
        eventVersion: 1,
        aggregateType: 'archive_item',
        aggregateId: itemId,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: { versionId: version.id, versionNo: version.versionNo }
      });
      return queued.ok ? ok(version) : queued;
    });
  }
}
