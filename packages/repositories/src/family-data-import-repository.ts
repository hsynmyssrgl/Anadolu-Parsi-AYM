import type {
  FamilyDataImportBatchRecord,
  FamilyDataImportItemRecord,
  FamilyDataImportRepositoryPort,
  FamilyDataImportRollbackInspection,
  FamilyDataImportRollbackPolicyTarget,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import type { FamilyId, IsoDateTime, UserId } from '@ppt/core';
import type { FamilyDataImportBatchStatus, FamilyDataImportEntitySummaryView, FamilyDataImportEntityType } from '@ppt/domain';
import { assertPolicyAuthorizedRepositoryContext } from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const rowText = (row: Record<string, unknown>, key: string): string => String(row[key] ?? '');
const optionalText = (row: Record<string, unknown>, key: string): string | undefined => {
  const value = row[key];
  return value === null || value === undefined || value === '' ? undefined : String(value);
};

const placeholders = (count: number): string => Array.from({ length: count }, () => '?').join(',');
const chunks = <T>(items: readonly T[], size = 300): readonly (readonly T[])[] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
};

const parseSummary = (value: unknown): readonly FamilyDataImportEntitySummaryView[] => {
  try {
    const parsed = JSON.parse(String(value ?? '[]')) as unknown;
    return Array.isArray(parsed) ? parsed as FamilyDataImportEntitySummaryView[] : [];
  } catch {
    return [];
  }
};

const mapBatch = (row: Record<string, unknown>): FamilyDataImportBatchRecord => ({
  id: rowText(row, 'id'),
  familyId: rowText(row, 'family_id') as FamilyId,
  sourceFileName: rowText(row, 'source_file_name'),
  sourceSha256: rowText(row, 'source_sha256'),
  sourceExportId: rowText(row, 'source_export_id'),
  sourceCreatedAt: rowText(row, 'source_created_at') as IsoDateTime,
  sourceFamilyName: rowText(row, 'source_family_name'),
  schemaVersion: 1,
  status: rowText(row, 'status') as FamilyDataImportBatchStatus,
  appliedAt: rowText(row, 'applied_at') as IsoDateTime,
  rollbackDeadline: rowText(row, 'rollback_deadline') as IsoDateTime,
  ...(optionalText(row, 'rolled_back_at') ? { rolledBackAt: optionalText(row, 'rolled_back_at') as IsoDateTime } : {}),
  actorId: rowText(row, 'actor_id') as UserId,
  summary: parseSummary(row.summary_json)
});

export class SqliteFamilyDataImportRepository extends SqliteRepository implements FamilyDataImportRepositoryPort {
  public loadExisting(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<{
    readonly people: readonly { readonly id: string; readonly displayName: string; readonly birthDate?: string }[];
    readonly events: readonly { readonly id: string; readonly title: string; readonly startAt: string }[];
    readonly relations: readonly { readonly id: string; readonly fromPersonId: string; readonly toPersonId: string; readonly relationType: string }[];
    readonly locations: readonly { readonly id: string; readonly label: string; readonly kind: string }[];
  }> {
    return this.execute(context, () => {
      const database = this.database(context);
      const people = database.prepare('SELECT id,display_name,birth_date FROM people WHERE family_id=?').all(familyId) as readonly Record<string, unknown>[];
      const events = database.prepare('SELECT id,title,start_at FROM events WHERE family_id=?').all(familyId) as readonly Record<string, unknown>[];
      const relations = database.prepare('SELECT id,from_person_id,to_person_id,relation_type FROM relations WHERE family_id=?').all(familyId) as readonly Record<string, unknown>[];
      const locations = database.prepare('SELECT id,label,kind FROM locations WHERE family_id=?').all(familyId) as readonly Record<string, unknown>[];
      return {
        people: people.map((row) => {
          const birthDate = optionalText(row, 'birth_date');
          return { id: rowText(row, 'id'), displayName: rowText(row, 'display_name'), ...(birthDate ? { birthDate } : {}) };
        }),
        events: events.map((row) => ({ id: rowText(row, 'id'), title: rowText(row, 'title'), startAt: rowText(row, 'start_at') })),
        relations: relations.map((row) => ({ id: rowText(row, 'id'), fromPersonId: rowText(row, 'from_person_id'), toPersonId: rowText(row, 'to_person_id'), relationType: rowText(row, 'relation_type') })),
        locations: locations.map((row) => ({ id: rowText(row, 'id'), label: rowText(row, 'label'), kind: rowText(row, 'kind') }))
      };
    });
  }

  public insertBatch(context: RepositoryExecutionContext, record: FamilyDataImportBatchRecord): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`INSERT INTO family_data_import_batches(
        id,family_id,source_file_name,source_sha256,source_export_id,source_created_at,source_family_name,schema_version,status,applied_at,rollback_deadline,rolled_back_at,actor_id,summary_json
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        record.id, record.familyId, record.sourceFileName, record.sourceSha256, record.sourceExportId,
        record.sourceCreatedAt, record.sourceFamilyName, record.schemaVersion, record.status, record.appliedAt,
        record.rollbackDeadline, record.rolledBackAt ?? null, record.actorId, JSON.stringify(record.summary)
      );
    });
  }

  public insertItem(context: RepositoryExecutionContext, record: FamilyDataImportItemRecord): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`INSERT INTO family_data_import_items(batch_id,entity_type,entity_id,source_id,resolution,created_at)
        VALUES(?,?,?,?,?,?)`).run(record.batchId, record.entityType, record.entityId, record.sourceId, record.resolution, record.createdAt);
    });
  }

  public listBatches(context: RepositoryExecutionContext, familyId: FamilyId, limit = 50): RepositoryResult<readonly FamilyDataImportBatchRecord[]> {
    return this.execute(context, () => {
      const rows = this.database(context).prepare(`SELECT * FROM family_data_import_batches WHERE family_id=? ORDER BY applied_at DESC LIMIT ?`).all(familyId, Math.max(1, Math.min(200, limit))) as readonly Record<string, unknown>[];
      return rows.map(mapBatch);
    });
  }

  public findBatch(context: RepositoryExecutionContext, batchId: string): RepositoryResult<FamilyDataImportBatchRecord | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare('SELECT * FROM family_data_import_batches WHERE id=?').get(batchId) as Record<string, unknown> | undefined;
      return row ? mapBatch(row) : null;
    });
  }

  public findActiveSource(context: RepositoryExecutionContext, familyId: FamilyId, sourceSha256: string, sourceExportId: string): RepositoryResult<FamilyDataImportBatchRecord | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`SELECT * FROM family_data_import_batches
        WHERE family_id=? AND status IN ('applied','rollback_blocked') AND (source_sha256=? OR source_export_id=?)
        ORDER BY applied_at DESC LIMIT 1`).get(familyId, sourceSha256, sourceExportId) as Record<string, unknown> | undefined;
      return row ? mapBatch(row) : null;
    });
  }

  public listItems(context: RepositoryExecutionContext, batchId: string): RepositoryResult<readonly FamilyDataImportItemRecord[]> {
    return this.execute(context, () => {
      const rows = this.database(context).prepare('SELECT * FROM family_data_import_items WHERE batch_id=? ORDER BY entity_type,source_id').all(batchId) as readonly Record<string, unknown>[];
      return rows.map((row) => ({
        batchId: rowText(row, 'batch_id'),
        entityType: rowText(row, 'entity_type') as FamilyDataImportEntityType,
        entityId: rowText(row, 'entity_id'),
        sourceId: rowText(row, 'source_id'),
        resolution: rowText(row, 'resolution') as 'created' | 'reused',
        createdAt: rowText(row, 'created_at') as IsoDateTime
      }));
    });
  }

  public inspectRollback(context: RepositoryExecutionContext, batchId: string): RepositoryResult<FamilyDataImportRollbackInspection> {
    return this.execute(context, () => {
      const database = this.database(context);
      const rows = database.prepare(`SELECT entity_type,entity_id FROM family_data_import_items WHERE batch_id=? AND resolution='created'`).all(batchId) as readonly Record<string, unknown>[];
      const ids = (type: FamilyDataImportEntityType): string[] => rows.filter((row) => rowText(row, 'entity_type') === type).map((row) => rowText(row, 'entity_id'));
      const personIds = ids('person');
      const relationIds = ids('relation');
      const locationIds = ids('location');
      const eventIds = ids('event');
      const blockers: string[] = [];

      const countReferences = (table: string, column: string, values: readonly string[], label: string, extra = ''): void => {
        for (const part of chunks(values)) {
          const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} IN (${placeholders(part.length)}) ${extra}`).get(...part) as Record<string, unknown>;
          if (Number(row.count ?? 0) > 0) { blockers.push(label); return; }
        }
      };

      if (personIds.length) {
        countReferences('accounts', 'person_id', personIds, 'İçe aktarılan kişilerden biri bir kullanıcı profiline bağlanmış.');
        countReferences('invitations', 'person_id', personIds, 'İçe aktarılan kişilerden biri bir davete bağlanmış.');
        countReferences('finance_records', 'owner_person_id', personIds, 'İçe aktarılan kişilerden biri finans kayıtlarında kullanılıyor.');
        countReferences('health_records', 'owner_person_id', personIds, 'İçe aktarılan kişilerden biri sağlık kayıtlarında kullanılıyor.');
        countReferences('medication_plans', 'owner_person_id', personIds, 'İçe aktarılan kişilerden biri ilaç planlarında kullanılıyor.');
        countReferences('family_health_history', 'related_person_id', personIds, 'İçe aktarılan kişilerden biri aile sağlık geçmişinde kullanılıyor.');
        countReferences('life_records', 'owner_person_id', personIds, 'İçe aktarılan kişilerden biri yaşam merkezi kayıtlarında kullanılıyor.');
        countReferences('digital_legacy_plans', 'owner_person_id', personIds, 'İçe aktarılan kişilerden biri dijital miras planlarında kullanılıyor.');
        countReferences('data_lifecycle', 'owner_person_id', personIds, 'İçe aktarılan kişilerden biri veri yaşam döngüsü kayıtlarında kullanılıyor.');
        for (const part of chunks(personIds)) {
          const relationExclusion = relationIds.length ? `AND id NOT IN (${placeholders(relationIds.length)})` : '';
          const row = database.prepare(`SELECT COUNT(*) AS count FROM relations WHERE (from_person_id IN (${placeholders(part.length)}) OR to_person_id IN (${placeholders(part.length)})) ${relationExclusion}`).get(...part, ...part, ...relationIds) as Record<string, unknown>;
          if (Number(row.count ?? 0) > 0) { blockers.push('İçe aktarılan kişilerden biri sonradan oluşturulmuş bir aile bağı içinde kullanılıyor.'); break; }
        }
        for (const personId of personIds) {
          const eventExclusion = eventIds.length ? `AND e.id NOT IN (${placeholders(eventIds.length)})` : '';
          const row = database.prepare(`SELECT 1 AS found FROM events e, json_each(e.participant_person_ids) participant WHERE participant.value=? ${eventExclusion} LIMIT 1`).get(personId, ...eventIds) as Record<string, unknown> | undefined;
          if (row) { blockers.push('İçe aktarılan kişilerden biri sonradan oluşturulmuş bir etkinlikte katılımcı.'); break; }
        }
      }

      if (locationIds.length) {
        const hasReceiptColumn = (database.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('locations') WHERE name='policy_receipt_hash'").get() as Record<string, unknown> | undefined);
        const hasGovernedRollbackFence = Number((database.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='family_data_import_rollback_deletions'").get() as Record<string, unknown> | undefined)?.count ?? 0) > 0;
        if (Number(hasReceiptColumn?.count ?? 0) > 0 && !hasGovernedRollbackFence) {
          for (const part of chunks(locationIds)) {
            const row = database.prepare(`SELECT COUNT(*) AS count FROM locations WHERE id IN (${placeholders(part.length)}) AND policy_receipt_hash IS NOT NULL`).get(...part) as Record<string, unknown>;
            if (Number(row.count ?? 0) > 0) {
              blockers.push('Governed policy receipt taşıyan içe aktarılmış konumlar için silme iş akışı tamamlanmadı.');
              break;
            }
          }
        }
        for (const part of chunks(locationIds)) {
          const exclusion = eventIds.length ? `AND id NOT IN (${placeholders(eventIds.length)})` : '';
          const row = database.prepare(`SELECT COUNT(*) AS count FROM events WHERE location_id IN (${placeholders(part.length)}) ${exclusion}`).get(...part, ...eventIds) as Record<string, unknown>;
          if (Number(row.count ?? 0) > 0) { blockers.push('İçe aktarılan konumlardan biri sonradan oluşturulmuş bir etkinlikte kullanılıyor.'); break; }
        }
      }

      if (eventIds.length) {
        countReferences('archive_items', 'linked_event_id', eventIds, 'İçe aktarılan etkinliklerden birine arşiv belgesi bağlanmış.');
        countReferences('automation_runs', 'source_id', eventIds, 'İçe aktarılan etkinliklerden biri otomasyon geçmişinde kullanılıyor.');
        for (const eventId of eventIds) {
          const row = database.prepare('SELECT created_at,updated_at FROM events WHERE id=?').get(eventId) as Record<string, unknown> | undefined;
          if (row && optionalText(row, 'updated_at') !== optionalText(row, 'created_at')) { blockers.push('İçe aktarılan etkinliklerden biri uygulandıktan sonra değiştirilmiş.'); break; }
        }
      }

      return { allowed: blockers.length === 0, blockers: [...new Set(blockers)] };
    });
  }

  public listRollbackPolicyTargets(
    context: RepositoryExecutionContext,
    batchId: string
  ): RepositoryResult<readonly FamilyDataImportRollbackPolicyTarget[]> {
    return this.execute(context, () => {
      const database = this.database(context);
      const rows = database.prepare(`
        SELECT item.entity_type,item.entity_id,
          CASE
            WHEN item.entity_type='event' AND event.timeline_policy_receipt_hash IS NOT NULL THEN 1
            WHEN item.entity_type='location' AND location.policy_receipt_hash IS NOT NULL THEN 1
            ELSE 0
          END AS governed
        FROM family_data_import_items item
        LEFT JOIN events event
          ON item.entity_type='event' AND event.id=item.entity_id
        LEFT JOIN locations location
          ON item.entity_type='location' AND location.id=item.entity_id
        WHERE item.batch_id=? AND item.resolution='created'
          AND item.entity_type IN ('event','location')
        ORDER BY item.entity_type,item.entity_id
      `).all(batchId) as readonly Record<string, unknown>[];
      return rows.map((row) => ({
        entityType: rowText(row, 'entity_type') as 'event' | 'location',
        entityId: rowText(row, 'entity_id'),
        governed: Number(row.governed ?? 0) === 1
      }));
    });
  }

  public deleteCreatedEntities(
    context: RepositoryExecutionContext,
    batchId: string,
    policyContexts: ReadonlyMap<string, PolicyAuthorizedRepositoryExecutionContext> = new Map()
  ): RepositoryResult<number> {
    return this.execute(context, () => {
      const database = this.database(context);
      const rows = database.prepare(`SELECT entity_type,entity_id FROM family_data_import_items WHERE batch_id=? AND resolution='created'`).all(batchId) as readonly Record<string, unknown>[];
      const deleteType = (entityType: FamilyDataImportEntityType, table: string, extraWhere = ''): number => {
        const ids = rows.filter((row) => rowText(row, 'entity_type') === entityType).map((row) => rowText(row, 'entity_id'));
        let deleted = 0;
        for (const part of chunks(ids)) {
          const result = database.prepare(`DELETE FROM ${table} WHERE id IN (${placeholders(part.length)}) ${extraWhere}`).run(...part);
          deleted += Number(result.changes);
        }
        return deleted;
      };
      let deleted = 0;
      deleted += deleteType('relation', 'relations');

      const governedTargets: Array<Readonly<{
        entityType: 'event' | 'location';
        entityId: string;
        familyId: string;
        ownerPersonId: string;
        createReceiptHash: string;
      }>> = [];
      const bindGovernedDelete = (target: (typeof governedTargets)[number]): void => {
        const policyContext = policyContexts.get(`${target.entityType}:${target.entityId}`);
        if (!policyContext || policyContext.transaction !== context.transaction) {
          throw new Error(`Governed ${target.entityType} rollback requires an exact same-transaction delete receipt`);
        }
        assertPolicyAuthorizedRepositoryContext(policyContext, {
          resourceType: target.entityType,
          resourceId: target.entityId,
          action: 'delete',
          capability: 'family.write',
          correlationId: policyContext.correlationId,
          resourceFamilyId: target.familyId as FamilyId
        });
        const authorization = policyContext.policyAuthorization;
        const request = authorization.receiptRecord.request;
        if (
          request.resource.familyId !== target.familyId
          || request.resource.ownerPersonId !== target.ownerPersonId
          || authorization.subject.accountId !== String(context.actor.userId)
          || authorization.subject.personId !== target.ownerPersonId
        ) throw new Error(`Governed ${target.entityType} rollback receipt subject or ownership is invalid`);
        const binding = platformPolicyPersistenceBinding(policyContext, target.entityType, target.entityId);
        if (!binding || binding.action !== 'delete' || binding.capability !== 'family.write') {
          throw new Error(`Governed ${target.entityType} rollback delete receipt binding is invalid`);
        }
        database.prepare(`INSERT INTO family_data_import_rollback_deletions(
          batch_id,entity_type,entity_id,family_id,owner_person_id,create_receipt_hash,
          delete_receipt_hash,delete_receipt_version,delete_receipt_nonce,
          delete_correlation_id,delete_resource_type,delete_resource_id,
          delete_action,delete_capability,authorized_at,consumed_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`).run(
          batchId,target.entityType,target.entityId,target.familyId,target.ownerPersonId,target.createReceiptHash,
          binding.receiptHash,binding.receiptVersion,binding.nonce,policyContext.correlationId,
          binding.resourceType,binding.resourceId,binding.action,binding.capability,
          authorization.receiptRecord.request.occurredAt
        );
      };

      for (const row of rows.filter((item) => rowText(item, 'entity_type') === 'event')) {
        const entityId = rowText(row, 'entity_id');
        const event = database.prepare(`SELECT timeline_policy_receipt_hash
          FROM events WHERE id=?`).get(entityId) as Record<string, unknown> | undefined;
        if (!event) continue;
        const createReceiptHash = optionalText(event, 'timeline_policy_receipt_hash');
        if (createReceiptHash) {
          const governedEvent = database.prepare(`SELECT family_id,owner_person_id
            FROM events WHERE id=?`).get(entityId) as Record<string, unknown>;
          const target = {
            entityType: 'event' as const,
            entityId,
            familyId: rowText(governedEvent, 'family_id'),
            ownerPersonId: rowText(governedEvent, 'owner_person_id'),
            createReceiptHash
          };
          bindGovernedDelete(target);
          governedTargets.push(target);
        }
        deleted += Number(database.prepare('DELETE FROM events WHERE id=?').run(entityId).changes);
      }

      for (const row of rows.filter((item) => rowText(item, 'entity_type') === 'location')) {
        const entityId = rowText(row, 'entity_id');
        const location = database.prepare(`SELECT policy_receipt_hash
          FROM locations WHERE id=?`).get(entityId) as Record<string, unknown> | undefined;
        if (!location) continue;
        const createReceiptHash = optionalText(location, 'policy_receipt_hash');
        if (createReceiptHash) {
          const governedLocation = database.prepare(`SELECT family_id,owner_person_id
            FROM locations WHERE id=?`).get(entityId) as Record<string, unknown>;
          const target = {
            entityType: 'location' as const,
            entityId,
            familyId: rowText(governedLocation, 'family_id'),
            ownerPersonId: rowText(governedLocation, 'owner_person_id'),
            createReceiptHash
          };
          bindGovernedDelete(target);
          governedTargets.push(target);
        }
        deleted += Number(database.prepare('DELETE FROM locations WHERE id=?').run(entityId).changes);
      }

      deleted += deleteType('person', 'people');

      for (const target of governedTargets) {
        const table = target.entityType === 'event' ? 'events' : 'locations';
        const remaining = database.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE id=?`).get(target.entityId) as Record<string, unknown>;
        if (Number(remaining.count ?? 0) !== 0) throw new Error(`Governed ${target.entityType} rollback completion fence failed`);
      }
      if (governedTargets.length > 0) {
        const consumed = database.prepare(`SELECT COUNT(*) AS count
          FROM family_data_import_rollback_deletions
          WHERE batch_id=? AND consumed_at IS NOT NULL`).get(batchId) as Record<string, unknown>;
        if (Number(consumed.count ?? 0) !== governedTargets.length) {
          throw new Error('Governed rollback deletion tombstone completion fence failed');
        }
      }
      return deleted;
    });
  }

  public markRollbackBlocked(context: RepositoryExecutionContext, batchId: string): RepositoryResult<void> {
    return this.execute(context, () => { this.database(context).prepare(`UPDATE family_data_import_batches SET status='rollback_blocked' WHERE id=? AND status IN ('applied','rollback_blocked')`).run(batchId); });
  }

  public markRolledBack(context: RepositoryExecutionContext, batchId: string, rolledBackAt: IsoDateTime): RepositoryResult<void> {
    return this.execute(context, () => { this.database(context).prepare(`UPDATE family_data_import_batches SET status='rolled_back',rolled_back_at=? WHERE id=? AND status IN ('applied','rollback_blocked')`).run(rolledBackAt, batchId); });
  }
}
