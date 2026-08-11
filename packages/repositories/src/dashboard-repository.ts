import type { DashboardRepositoryModuleId, DashboardRepositoryModuleCount, DashboardRepositorySummary, DashboardRepositoryPort, DashboardRepositoryVisibleLocation } from '@ppt/repository-contracts';
import type { DatabaseExecutor } from '@ppt/contracts';
import { asIsoDateTime, type FamilyId } from '@ppt/core';
import type { FamilyEventView } from '@ppt/domain';
import { isAdministrativeRole } from '@ppt/security';
import { SqliteRepository } from './sqlite-base.js';
import type { RepositoryExecutionContext, RepositoryResult } from '@ppt/repository-contracts';

const scalar = (database: DatabaseExecutor, sql: string, ...parameters: readonly unknown[]): number => {
  const row = database.prepare(sql).get(...parameters) as { value?: number } | undefined;
  return Number(row?.value ?? 0);
};

const parseStringArray = (value: unknown): string[] => {
  if (typeof value !== 'string') return [];
  try { const parsed:unknown=JSON.parse(value); return Array.isArray(parsed)?parsed.filter((item):item is string=>typeof item==='string'):[]; } catch { return []; }
};
const parseNumberArray = (value: unknown): number[] => {
  if (typeof value !== 'string') return [];
  try { const parsed:unknown=JSON.parse(value); return Array.isArray(parsed)?parsed.map(Number).filter((item)=>Number.isInteger(item)&&item>=0&&item<=365):[]; } catch { return []; }
};
const eventView = (row:Record<string,unknown>):FamilyEventView=>({
  id:String(row.id),kind:String(row.kind),title:String(row.title),
  ...(row.description?{description:String(row.description)}:{}),startAt:String(row.start_at),
  ...(row.location_id?{locationId:String(row.location_id)}:{}),...(row.location_label?{locationLabel:String(row.location_label)}:{}),
  visibility:String(row.visibility) as FamilyEventView['visibility'],participantPersonIds:parseStringArray(row.participant_person_ids),
  ...(row.invitation_text?{invitationText:String(row.invitation_text)}:{}),...(row.notes?{notes:String(row.notes)}:{}),
  attachmentCount:Number(row.attachment_count??0),aiProcessingAllowed:Number(row.ai_processing_allowed)===1,
  recurrence:String(row.recurrence??'none') as FamilyEventView['recurrence'],reminderDays:parseNumberArray(row.reminder_days),
  createdAt:String(row.created_at),...(row.updated_at?{updatedAt:String(row.updated_at)}:{}),...(row.archived_at?{archivedAt:String(row.archived_at)}:{})
});
const sanitizeEventLocations=(events:readonly FamilyEventView[],locations:readonly DashboardRepositoryVisibleLocation[]):readonly FamilyEventView[]=>{
  const visible=new Map(locations.map((location)=>[location.id,location]));
  return events.map((event)=>{
    if(!event.locationId)return event;
    const location=visible.get(event.locationId);
    if(location)return {...event,locationId:location.id,locationLabel:location.label};
    const {locationId:_locationId,locationLabel:_locationLabel,...redacted}=event;
    return redacted;
  });
};
const EVENT_COLUMNS=`e.id,e.kind,e.title,e.description,e.start_at,e.location_id,e.location_label,e.visibility,e.participant_person_ids,e.invitation_text,e.notes,e.attachment_count,e.ai_processing_allowed,e.recurrence,e.reminder_days,e.created_at,e.updated_at,e.archived_at`;

const visibilitySql = (isFamilyAdmin:boolean):string => isFamilyAdmin ? '1=1' : `(
  e.visibility='family'
  OR (? IS NOT NULL AND EXISTS (SELECT 1 FROM json_each(e.participant_person_ids) participant WHERE participant.value=?))
  OR (
    EXISTS (
      SELECT 1 FROM object_permissions permission, json_each(permission.actions) action
      WHERE permission.subject_account_id=? AND permission.resource_type='event'
        AND (permission.resource_id=e.id OR permission.resource_id='*')
        AND permission.effect='allow' AND action.value='read'
        AND permission.starts_at<=? AND (permission.ends_at IS NULL OR permission.ends_at>=?)
    )
    AND NOT EXISTS (
      SELECT 1 FROM object_permissions permission, json_each(permission.actions) action
      WHERE permission.subject_account_id=? AND permission.resource_type='event'
        AND (permission.resource_id=e.id OR permission.resource_id='*')
        AND permission.effect='deny' AND action.value='read'
        AND permission.starts_at<=? AND (permission.ends_at IS NULL OR permission.ends_at>=?)
    )
  )
)`;
const visibilityParams=(context:RepositoryExecutionContext,isFamilyAdmin:boolean):readonly unknown[]=>isFamilyAdmin?[]:[context.actor.personId??null,context.actor.personId??null,context.actor.userId,context.occurredAt,context.occurredAt,context.actor.userId,context.occurredAt,context.occurredAt];

export class SqliteDashboardRepository extends SqliteRepository implements DashboardRepositoryPort {
  public loadSummary(context: RepositoryExecutionContext, familyId: FamilyId, visibleLocations: readonly DashboardRepositoryVisibleLocation[]): RepositoryResult<DashboardRepositorySummary> {
    return this.execute(context, (): DashboardRepositorySummary => {
      const database = this.database(context);
      const isFamilyAdmin = context.actor.roles.some(isAdministrativeRole);
      const actorPersonId = context.actor.personId;
      const family = database.prepare('SELECT id,name FROM families WHERE id=?').get(familyId) as { id: string; name: string } | undefined;
      const memberCount = scalar(database, 'SELECT COUNT(*) AS value FROM people WHERE family_id=?', familyId);
      const generationCount = scalar(database, 'SELECT COUNT(DISTINCT generation) AS value FROM people WHERE family_id=?', familyId);
      const visibility=visibilitySql(isFamilyAdmin);const access=visibilityParams(context,isFamilyAdmin);
      const timelineEventCount=scalar(database,`SELECT COUNT(*) AS value FROM governed_timeline_events e WHERE e.family_id=? AND e.archived_at IS NULL AND ${visibility}`,familyId,...access);
      const importantDayCount=scalar(database,`SELECT COUNT(*) AS value FROM governed_timeline_events e WHERE e.family_id=? AND e.archived_at IS NULL AND e.kind='important_day' AND ${visibility}`,familyId,...access);
      const upcomingImportantDayCount=scalar(database,`SELECT COUNT(*) AS value FROM governed_timeline_events e WHERE e.family_id=? AND e.archived_at IS NULL AND e.kind='important_day' AND e.start_at>=? AND ${visibility}`,familyId,context.occurredAt,...access);
      const eventAttachments=scalar(database,`SELECT COALESCE(SUM(e.attachment_count),0) AS value FROM governed_timeline_events e WHERE e.family_id=? AND e.archived_at IS NULL AND ${visibility}`,familyId,...access);
      const upcomingImportantDays=sanitizeEventLocations((database.prepare(`SELECT ${EVENT_COLUMNS} FROM governed_timeline_events e WHERE e.family_id=? AND e.archived_at IS NULL AND e.kind='important_day' AND e.start_at>=? AND ${visibility} ORDER BY e.start_at ASC,e.id ASC LIMIT 6`).all(familyId,context.occurredAt,...access) as Record<string,unknown>[]).map(eventView),visibleLocations);
      const recentEvents=sanitizeEventLocations((database.prepare(`SELECT ${EVENT_COLUMNS} FROM governed_timeline_events e WHERE e.family_id=? AND e.archived_at IS NULL AND ${visibility} ORDER BY e.start_at DESC,e.id DESC LIMIT 4`).all(familyId,...access) as Record<string,unknown>[]).map(eventView),visibleLocations);
      const archiveCount = isFamilyAdmin ? scalar(database, 'SELECT COUNT(*) AS value FROM archive_items WHERE family_id=? AND destroyed_at IS NULL', familyId) : 0;
      const notificationCount = isFamilyAdmin ? scalar(database, 'SELECT COUNT(*) AS value FROM health_notifications WHERE acknowledged_at IS NULL') : 0;
      const failedBackupCount = scalar(database, "SELECT COUNT(*) AS value FROM backup_runs WHERE status='failed'");
      const lastAudit = database.prepare('SELECT occurred_at FROM audit_log ORDER BY occurred_at DESC LIMIT 1').get() as { occurred_at?: string } | undefined;
      const count = (sql: string, ...parameters: readonly unknown[]) => scalar(database, sql, ...parameters);
      const privateOwnerCount = (table: string, ownerColumn = 'owner_person_id'): number => {
        if (isFamilyAdmin) return count(`SELECT COUNT(*) AS value FROM ${table} WHERE family_id=?`, familyId);
        if (!actorPersonId) return 0;
        return count(`SELECT COUNT(*) AS value FROM ${table} WHERE family_id=? AND ${ownerColumn}=?`, familyId, actorPersonId);
      };
      const financeCount = privateOwnerCount('finance_records');
      const healthCount = privateOwnerCount('health_records') + privateOwnerCount('medication_plans') + privateOwnerCount('family_health_history', 'related_person_id');
      const lifeCount = privateOwnerCount('life_records');
      const legacyCount = isFamilyAdmin ? count('SELECT COUNT(*) AS value FROM digital_legacy_plans') : actorPersonId ? count('SELECT COUNT(*) AS value FROM digital_legacy_plans WHERE owner_person_id=?', actorPersonId) : 0;
      const permissionCount = isFamilyAdmin ? count('SELECT COUNT(*) AS value FROM accounts') + count('SELECT COUNT(*) AS value FROM object_permissions') : 1;
      const aiConsentCount = isFamilyAdmin ? count('SELECT COUNT(*) AS value FROM ai_consents') : count('SELECT COUNT(*) AS value FROM ai_consents WHERE account_id=?', context.actor.userId);
      const modules: DashboardRepositoryModuleCount[] = [
        { id:'family', label:'Aile', recordCount:memberCount, attentionCount:0, emptyDetail:'Henüz aile üyesi yok', readyDetail:`${memberCount} aile üyesi kayıtlı` },
        { id:'tree', label:'Soy Ağacı', recordCount:count('SELECT COUNT(*) AS value FROM relations WHERE family_id=?', familyId), attentionCount:0, emptyDetail:'İlişki bağlantısı bekleniyor', readyDetail:'Aile ilişkileri bağlı' },
        { id:'timeline', label:'Zaman Tüneli', recordCount:timelineEventCount, attentionCount:0, emptyDetail:'İlk yaşam olayını ekleyin', readyDetail:'Aile hafızası kayıtlı' },
        { id:'important-days', label:'Önemli Günler', recordCount:importantDayCount, attentionCount:0, emptyDetail:'Önemli gün kaydı yok', readyDetail:'Takvim kayıtları hazır' },
        { id:'archive', label:'Arşiv', recordCount:archiveCount, attentionCount:0, emptyDetail:'Arşiv dosyası bekleniyor', readyDetail:'Dijital arşiv hazır' },
        { id:'finance', label:'Finans', recordCount:financeCount, attentionCount:0, emptyDetail:'Finans kaydı yok', readyDetail:'Finans kayıtları hazır' },
        { id:'health', label:'Sağlık', recordCount:healthCount, attentionCount:notificationCount, emptyDetail:'Sağlık kaydı yok', readyDetail:'Sağlık merkezi hazır' },
        { id:'life-center', label:'Yaşam Merkezi', recordCount:lifeCount, attentionCount:0, emptyDetail:'Yaşam kaydı yok', readyDetail:'Yaşam kayıtları hazır' },
        { id:'automation', label:'Bildirim ve Otomasyon', recordCount:count('SELECT COUNT(*) AS value FROM automation_rules'), attentionCount:notificationCount, emptyDetail:'Otomasyon kuralı yok', readyDetail:'Otomasyon kuralları etkin' },
        { id:'reports', label:'Raporlama', recordCount:count('SELECT COUNT(*) AS value FROM audit_log'), attentionCount:0, emptyDetail:'Rapor üretmek için veri bekleniyor', readyDetail:'Rapor verisi hazır' },
        { id:'location', label:'Konum', recordCount:visibleLocations.length, attentionCount:0, emptyDetail:'Konum kaydı yok', readyDetail:'Aile konumları kayıtlı' },
        { id:'permissions', label:'Yetkiler', recordCount:permissionCount, attentionCount:0, emptyDetail:'Yetki kaydı bekleniyor', readyDetail:'Hesap ve yetkiler hazır' },
        { id:'ai', label:'Yapay Zekâ', recordCount:aiConsentCount, attentionCount:0, emptyDetail:'AI rızası tanımlanmadı', readyDetail:'AI izinleri kayıtlı' },
        { id:'legacy', label:'Dijital Miras', recordCount:legacyCount, attentionCount:0, emptyDetail:'Miras planı yok', readyDetail:'Miras planları hazır' },
        { id:'settings', label:'Ayarlar', recordCount:count('SELECT COUNT(*) AS value FROM backup_targets') + count('SELECT COUNT(*) AS value FROM diagnostic_entries'), attentionCount:failedBackupCount, emptyDetail:'Sistem ayarları başlangıç durumunda', readyDetail:'Sistem ve yedek ayarları hazır' }
      ];
      return { family:family??null,memberCount,generationCount,timelineEventCount,upcomingImportantDayCount,relatedContentCount:eventAttachments+archiveCount,notificationCount,upcomingImportantDays,recentEvents,modules,lastActivityAt:asIsoDateTime(lastAudit?.occurred_at??context.occurredAt) };
    });
  }
}
