import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const expectedRoot = 'C:\\PPT\\AYM\\06_KOD\\app';
const root = resolve(process.cwd());
if (root.toLocaleLowerCase('en-US') !== expectedRoot.toLocaleLowerCase('en-US')) {
  throw new Error(`PPK-002 compilation repair must run from ${expectedRoot}; received ${root}`);
}

const replaceOnce = (relativePath, before, after) => {
  const path = resolve(root, relativePath);
  const source = readFileSync(path, 'utf8');
  if (source.includes(after)) return false;
  const first = source.indexOf(before);
  if (first < 0 || first !== source.lastIndexOf(before)) {
    throw new Error(`${relativePath}: expected exactly one repair anchor`);
  }
  writeFileSync(path, source.replace(before, after), 'utf8');
  return true;
};

const changes = [];
const patch = (path, before, after) => {
  if (replaceOnce(path, before, after)) changes.push(path);
};

patch(
  'apps/desktop/src/main/repository-composition-root.ts',
  '  TimelineRepositoryPort,\n  TrustedDeviceRepositoryPort,',
  '  TimelineEventPolicyResourceRepositoryPort,\n  TimelineRepositoryPort,\n  TrustedDeviceRepositoryPort,'
);
patch(
  'apps/desktop/src/main/repository-composition-root.ts',
  '  readonly timelineRepository: TimelineRepositoryPort;',
  '  readonly timelineRepository: TimelineRepositoryPort & TimelineEventPolicyResourceRepositoryPort;'
);

patch(
  'apps/desktop/src/main/family-data-import-service.ts',
  "      if (currentPlan.digest !== cached.planDigest) return err(createAppError({ code: ERROR_CODES.RESOURCE_CONFLICT, message: 'Aile verileri ön izlemeden sonra değişti. Çakışma planını yenilemek için dosyayı yeniden ön izleyin.', category: 'conflict', correlationId: context.correlationId }));\n      const now = transaction.occurredAt;",
  "      if (currentPlan.digest !== cached.planDigest) return err(createAppError({ code: ERROR_CODES.RESOURCE_CONFLICT, message: 'Aile verileri ön izlemeden sonra değişti. Çakışma planını yenilemek için dosyayı yeniden ön izleyin.', category: 'conflict', correlationId: context.correlationId }));\n      if (currentPlan.events.length > 0) return err(createAppError({ code: ERROR_CODES.RESOURCE_CONFLICT, message: 'Etkinlik içe aktarma, kalıcı platform-policy receipt batch akışı tamamlanana kadar fail-closed durumdadır.', category: 'conflict', correlationId: context.correlationId }));\n      const now = transaction.occurredAt;"
);
patch(
  'apps/desktop/src/main/family-data-import-service.ts',
  `      for (const row of currentPlan.events) {
        if (row.resolution === 'created') {
          const inserted = this.dependencies.timelineRepository.insert(repository, {
            id: asEventId(row.targetId), familyId: context.familyId, kind: row.record.kind, title: row.record.title,
            ...(row.record.description ? { description: row.record.description } : {}), startAt: asIsoDateTime(row.record.startAt),
            ...(row.record.locationLabel ? { locationLabel: row.record.locationLabel } : {}),
            visibility: row.record.visibility, participantPersonIds: row.participantTargetIds.map((personId) => asPersonId(personId)),
            ...(row.record.invitationText ? { invitationText: row.record.invitationText } : {}), ...(row.record.notes ? { notes: row.record.notes } : {}),
            attachmentCount: 0, aiProcessingAllowed: row.record.aiProcessingAllowed, recurrence: row.record.recurrence, reminderDays: row.record.reminderDays, createdAt: now
          });
          if (!inserted.ok) return inserted;
        }
        const tracked = this.dependencies.importRepository.insertItem(repository, { batchId, entityType: 'event', entityId: row.targetId, sourceId: row.sourceId, resolution: row.resolution, createdAt: now });
        if (!tracked.ok) return tracked;
      }
`,
  ''
);

patch(
  'apps/desktop/src/main/timeline-application-adapter.ts',
  "import type { DomainEvent } from '@ppt/events';",
  "import type { DomainEvent } from '@ppt/events';\nimport { computePlatformPolicyReceiptHash } from '@ppt/repositories';"
);
patch(
  'apps/desktop/src/main/timeline-application-adapter.ts',
  `  public updateEvent(event: TimelineEventRecord): ReturnType<TimelineWriteScope['updateEvent']> {
    const locationReceipt = event.locationId && this.locationProof?.location.id === event.locationId
      ? this.locationProof.receiptHash
      : event.locationId ? event.sourceLocationReceiptHash : undefined;
    const governed = {
      ...event,
      ...(locationReceipt ? { sourceLocationReceiptHash: locationReceipt } : { sourceLocationReceiptHash: undefined })
    };
    return this.dependencies.timelineRepository.update(this.repository, governed);
  }`,
  `  public updateEvent(event: TimelineEventRecord): ReturnType<TimelineWriteScope['updateEvent']> {
    const locationReceipt = event.locationId && this.locationProof?.location.id === event.locationId
      ? this.locationProof.receiptHash
      : event.locationId ? event.sourceLocationReceiptHash : undefined;
    const { sourceLocationReceiptHash: _previousLocationReceipt, ...withoutLocationReceipt } = event;
    const governed: TimelineEventRecord = locationReceipt
      ? { ...withoutLocationReceipt, sourceLocationReceiptHash: locationReceipt }
      : withoutLocationReceipt;
    return this.dependencies.timelineRepository.update(this.repository, governed);
  }`
);
patch(
  'apps/desktop/src/main/timeline-application-adapter.ts',
  '          receiptHash: authorization.receiptRecord.receipt.receiptHash',
  '          receiptHash: computePlatformPolicyReceiptHash(authorization.receiptRecord.receipt)'
);

patch(
  'apps/desktop/src/main/timeline-production-policy-runtime.ts',
  '  ERROR_CODES,\n  asIsoDateTime,',
  '  ERROR_CODES,\n  asEventId,\n  asIsoDateTime,'
);
patch(
  'apps/desktop/src/main/timeline-production-policy-runtime.ts',
  '    execution,\n    resourceId\n  );',
  '    execution,\n    asEventId(resourceId)\n  );'
);

patch(
  'packages/repositories/src/timeline-repository.ts',
  `    return this.updatePartial(context, eventId, (event) => ({
      ...event,
      ...(archivedAt ? { archivedAt } : { archivedAt: undefined }),
      updatedAt: context.occurredAt
    }));`,
  `    return this.updatePartial(context, eventId, (event) => {
      const { archivedAt: _previousArchivedAt, ...withoutArchivedAt } = event;
      return archivedAt
        ? { ...withoutArchivedAt, archivedAt, updatedAt: context.occurredAt }
        : { ...withoutArchivedAt, updatedAt: context.occurredAt };
    });`
);
patch(
  'packages/repositories/src/timeline-repository.ts',
  `    return this.updatePartial(context, eventId, (event) => ({
      ...event,
      ...(invitationText ? { invitationText } : { invitationText: undefined }),
      updatedAt: context.occurredAt
    }));`,
  `    return this.updatePartial(context, eventId, (event) => {
      const { invitationText: _previousInvitationText, ...withoutInvitationText } = event;
      return invitationText
        ? { ...withoutInvitationText, invitationText, updatedAt: context.occurredAt }
        : { ...withoutInvitationText, updatedAt: context.occurredAt };
    });`
);
patch(
  'packages/repositories/src/timeline-repository.ts',
  `    return this.updatePartial(context, eventId, (event) => ({
      ...event,
      ...(notes ? { notes } : { notes: undefined }),
      updatedAt: context.occurredAt
    }));`,
  `    return this.updatePartial(context, eventId, (event) => {
      const { notes: _previousNotes, ...withoutNotes } = event;
      return notes
        ? { ...withoutNotes, notes, updatedAt: context.occurredAt }
        : { ...withoutNotes, updatedAt: context.occurredAt };
    });`
);

console.log(`PPK-002 compilation repair applied (${changes.length} files changed; unauthorized import write removed).`);
