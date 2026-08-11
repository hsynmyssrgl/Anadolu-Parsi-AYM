import { ERROR_CODES, createAppError, err, ok, type AppError, type CorrelationId, type Result, type UserId } from '@ppt/core';
import type { DiagnosticArchiveView, DiagnosticEntryView, DiagnosticReportHistoryView, ExportArtifactView, HealthNotificationView, MaintenanceHistoryFilterInput, MaintenanceHistoryView, MaintenancePolicyView, MaintenanceRecommendationView, PerformanceSampleView, PerformanceTrendView, SystemHealthHistoryView, SystemHealthView } from '@ppt/domain';
import { SensitiveLogPolicy } from '@ppt/platform-policy';

export interface OperationalHealthApplicationContext { readonly actorId: UserId; readonly correlationId: CorrelationId; }
export interface OperationalHealthQueryPort {
  listPerformanceSamples(context: OperationalHealthApplicationContext, limit: number): Result<readonly PerformanceSampleView[], AppError>;
  listPerformanceSamplesSince(context: OperationalHealthApplicationContext, since: string): Result<readonly PerformanceSampleView[], AppError>;
  listDiagnostics(context: OperationalHealthApplicationContext, limit: number): Result<readonly DiagnosticEntryView[], AppError>;
  listSystemHealthHistory(context: OperationalHealthApplicationContext, limit: number): Result<readonly SystemHealthHistoryView[], AppError>;
  listSystemHealthHistorySince(context: OperationalHealthApplicationContext, since: string): Result<readonly SystemHealthHistoryView[], AppError>;
  listMaintenanceHistory(context: OperationalHealthApplicationContext, limit: number): Result<readonly MaintenanceHistoryView[], AppError>;
  searchMaintenanceHistory(context: OperationalHealthApplicationContext, input: MaintenanceHistoryFilterInput): Result<readonly MaintenanceHistoryView[], AppError>;
  getMaintenancePolicy(context: OperationalHealthApplicationContext): Result<MaintenancePolicyView, AppError>;
  listHealthNotifications(context: OperationalHealthApplicationContext, limit: number): Result<readonly HealthNotificationView[], AppError>;
  findActiveHealthNotification(context: OperationalHealthApplicationContext, code: string): Result<HealthNotificationView | undefined, AppError>;
  countDiagnostics(context: OperationalHealthApplicationContext): Result<number, AppError>;
  countPerformanceSamples(context: OperationalHealthApplicationContext): Result<number, AppError>;
  countFailedBackupsSince(context: OperationalHealthApplicationContext, since: string): Result<number, AppError>;
  countDiagnosticsByCodeSince(context: OperationalHealthApplicationContext, code: string, since: string): Result<number, AppError>;
  countActiveHealthNotifications(context: OperationalHealthApplicationContext): Result<number, AppError>;
  listExportArtifacts(context: OperationalHealthApplicationContext, limit: number): Result<readonly ExportArtifactView[], AppError>;
  findExportArtifact(context: OperationalHealthApplicationContext, id: string): Result<ExportArtifactView | undefined, AppError>;
  listDiagnosticReports(context: OperationalHealthApplicationContext, limit: number): Result<readonly DiagnosticReportHistoryView[], AppError>;
  findDiagnosticReport(context: OperationalHealthApplicationContext, id: string): Result<DiagnosticReportHistoryView | undefined, AppError>;
  listDiagnosticArchives(context: OperationalHealthApplicationContext, limit: number): Result<readonly DiagnosticArchiveView[], AppError>;
  findDiagnosticArchive(context: OperationalHealthApplicationContext, id: string): Result<DiagnosticArchiveView | undefined, AppError>;
}
export interface OperationalHealthWritePort {
  insertPerformanceSample(context: OperationalHealthApplicationContext, sample: PerformanceSampleView): Result<void, AppError>;
  insertDiagnostic(context: OperationalHealthApplicationContext, entry: DiagnosticEntryView): Result<void, AppError>;
  insertSystemHealthHistory(context: OperationalHealthApplicationContext, entry: SystemHealthHistoryView): Result<void, AppError>;
  insertMaintenanceHistory(context: OperationalHealthApplicationContext, entry: MaintenanceHistoryView): Result<void, AppError>;
  upsertMaintenancePolicy(context: OperationalHealthApplicationContext, policy: MaintenancePolicyView): Result<void, AppError>;
  updateMaintenanceSchedule(context: OperationalHealthApplicationContext, lastRunAt: string, nextRunAt: string): Result<void, AppError>;
  deleteDiagnosticsBefore(context: OperationalHealthApplicationContext, cutoff: string): Result<void, AppError>;
  deletePerformanceSamplesBefore(context: OperationalHealthApplicationContext, cutoff: string): Result<void, AppError>;
  insertHealthNotification(context: OperationalHealthApplicationContext, entry: HealthNotificationView): Result<void, AppError>;
  attachHealthNotificationTask(context: OperationalHealthApplicationContext, id: string, taskId: string): Result<void, AppError>;
  acknowledgeHealthNotification(context: OperationalHealthApplicationContext, id: string, acknowledgedAt: string): Result<void, AppError>;
  insertExportArtifact(context: OperationalHealthApplicationContext, entry: ExportArtifactView): Result<void, AppError>;
  insertDiagnosticReport(context: OperationalHealthApplicationContext, entry: DiagnosticReportHistoryView): Result<void, AppError>;
  insertDiagnosticArchive(context: OperationalHealthApplicationContext, entry: DiagnosticArchiveView): Result<void, AppError>;
  deleteDiagnosticsThrough(context: OperationalHealthApplicationContext, cutoff: string): Result<void, AppError>;
}
const invalid=(c:OperationalHealthApplicationContext,message:string)=>createAppError({code:ERROR_CODES.CORE_INVALID_ARGUMENT,message,category:'validation',correlationId:c.correlationId});
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(value,max));

export interface MaintenanceRecommendationInput {
  readonly health: Pick<SystemHealthView, 'databaseBytes' | 'freeDiskBytes'>;
  readonly trend: Pick<PerformanceTrendView, 'databaseGrowthBytes'>;
}
export class GetMaintenanceRecommendationsUseCase {
  constructor(private readonly query: OperationalHealthQueryPort) {}
  execute(c: OperationalHealthApplicationContext, input: MaintenanceRecommendationInput): Result<readonly MaintenanceRecommendationView[], AppError> {
    const failed = this.query.countFailedBackupsSince(c, '1970-01-01T00:00:00.000Z');
    if (!failed.ok) return failed;
    const items: MaintenanceRecommendationView[] = [];
    if (input.health.databaseBytes > 536_870_912) items.push({code:'database.vacuum',priority:'normal',title:'Veritabanını sıkıştırın',message:'Veritabanı 512 MB sınırını geçti.',recommendedOperation:'vacuum'});
    if (input.trend.databaseGrowthBytes > 104_857_600) items.push({code:'database.analyze',priority:'normal',title:'Sorgu istatistiklerini yenileyin',message:'Veritabanında belirgin büyüme algılandı.',recommendedOperation:'analyze'});
    if (failed.value > 0) items.push({code:'backup.review',priority:'high',title:'Yedekleme hatalarını inceleyin',message:`${failed.value} başarısız yedekleme kaydı bulunuyor.`});
    if ((input.health.freeDiskBytes ?? Number.MAX_SAFE_INTEGER) < 2_147_483_648) items.push({code:'disk.cleanup',priority:'high',title:'Disk alanını boşaltın',message:'Kullanılabilir alan 2 GB altına düştü.'});
    if (!items.length) items.push({code:'system.healthy',priority:'low',title:'Bakım gerekmiyor',message:'Sistem ölçümleri normal aralıkta.'});
    return ok(items);
  }
}

export class RecordPerformanceSampleUseCase { constructor(private readonly write:OperationalHealthWritePort){} execute(c:OperationalHealthApplicationContext,s:PerformanceSampleView):Result<PerformanceSampleView,AppError>{ if([s.cpuLoadPercent,s.memoryUsagePercent,s.databaseBytes,s.archiveBytes].some(x=>!Number.isFinite(x)||x<0)) return err(invalid(c,'Performans örneği negatif veya geçersiz değer içeremez.')); const saved=this.write.insertPerformanceSample(c,s); return saved.ok?ok(s):saved; } }
export class ListPerformanceSamplesUseCase { constructor(private readonly query:OperationalHealthQueryPort){} execute(c:OperationalHealthApplicationContext,limit=100){return this.query.listPerformanceSamples(c,clamp(Math.trunc(limit),1,1000));} }
export class GetPerformanceTrendUseCase { constructor(private readonly query:OperationalHealthQueryPort){} execute(c:OperationalHealthApplicationContext,windowHours=24):Result<PerformanceTrendView,AppError>{ const hours=clamp(Math.trunc(windowHours),1,720),since=new Date(Date.now()-hours*3600_000).toISOString(); const rows=this.query.listPerformanceSamplesSince(c,since); if(!rows.ok)return rows; if(!rows.value.length)return ok({generatedAt:new Date().toISOString(),sampleCount:0,windowHours:hours,averageCpuPercent:0,averageMemoryPercent:0,peakCpuPercent:0,peakMemoryPercent:0,databaseGrowthBytes:0,archiveGrowthBytes:0,direction:'stable'}); const cpu=rows.value.map(r=>r.cpuLoadPercent),mem=rows.value.map(r=>r.memoryUsagePercent),first=rows.value[0]!,last=rows.value.at(-1)!; const averageCpuPercent=Math.round(cpu.reduce((a,b)=>a+b,0)/cpu.length*10)/10,averageMemoryPercent=Math.round(mem.reduce((a,b)=>a+b,0)/mem.length*10)/10,pressure=averageCpuPercent+averageMemoryPercent; return ok({generatedAt:new Date().toISOString(),sampleCount:rows.value.length,windowHours:hours,averageCpuPercent,averageMemoryPercent,peakCpuPercent:Math.max(...cpu),peakMemoryPercent:Math.max(...mem),databaseGrowthBytes:last.databaseBytes-first.databaseBytes,archiveGrowthBytes:last.archiveBytes-first.archiveBytes,direction:pressure>=145?'degrading':pressure<=80?'improving':'stable'}); } }
export class RecordDiagnosticUseCase {
  constructor(
    private readonly write: OperationalHealthWritePort,
    private readonly sensitiveLogPolicy: SensitiveLogPolicy
  ) {}

  execute(c: OperationalHealthApplicationContext, e: DiagnosticEntryView): Result<void, AppError> {
    if (!e.code.trim() || !e.message.trim()) return err(invalid(c, 'Tanılama kodu ve mesajı zorunludur.'));
    try {
      const safe = this.sensitiveLogPolicy.sanitizeDiagnostic({
        id: e.id,
        severity: e.severity,
        code: e.code.trim(),
        message: e.message,
        ...(e.details === undefined ? {} : { details: e.details }),
        occurredAt: e.occurredAt
      });
      return this.write.insertDiagnostic(c, safe);
    } catch {
      return err(invalid(c, 'Tanılama kaydı içeriksiz log politikasını karşılamıyor.'));
    }
  }
}
export class ListDiagnosticsUseCase { constructor(private readonly query:OperationalHealthQueryPort){} execute(c:OperationalHealthApplicationContext,limit=100){return this.query.listDiagnostics(c,clamp(Math.trunc(limit),1,500));} }
export class RecordSystemHealthHistoryUseCase { constructor(private readonly write:OperationalHealthWritePort){} execute(c:OperationalHealthApplicationContext,e:SystemHealthHistoryView):Result<SystemHealthHistoryView,AppError>{ if(!Number.isFinite(e.score)||e.score<0||e.score>100)return err(invalid(c,'Sistem sağlık puanı 0-100 aralığında olmalıdır.')); const saved=this.write.insertSystemHealthHistory(c,e);return saved.ok?ok(e):saved;} }
export class ListSystemHealthHistoryUseCase { constructor(private readonly query:OperationalHealthQueryPort){} execute(c:OperationalHealthApplicationContext,limit=500){return this.query.listSystemHealthHistory(c,clamp(Math.trunc(limit),1,2000));} }
export class ListSystemHealthHistorySinceUseCase { constructor(private readonly query:OperationalHealthQueryPort){} execute(c:OperationalHealthApplicationContext,since:string){if(!since.trim())return err(invalid(c,'Sağlık geçmişi başlangıç zamanı zorunludur.'));return this.query.listSystemHealthHistorySince(c,since.trim());} }
export class RecordMaintenanceHistoryUseCase { constructor(private readonly write:OperationalHealthWritePort){} execute(c:OperationalHealthApplicationContext,e:MaintenanceHistoryView):Result<void,AppError>{return this.write.insertMaintenanceHistory(c,e);} }
export class ListMaintenanceHistoryUseCase { constructor(private readonly query:OperationalHealthQueryPort){} execute(c:OperationalHealthApplicationContext,limit=100){return this.query.listMaintenanceHistory(c,clamp(Math.trunc(limit),1,1000));} }
export class SearchMaintenanceHistoryUseCase { constructor(private readonly query:OperationalHealthQueryPort){} execute(c:OperationalHealthApplicationContext,input:MaintenanceHistoryFilterInput={}){return this.query.searchMaintenanceHistory(c,{...input,limit:clamp(Math.trunc(input.limit??250),1,1000)});} }

export class GetMaintenancePolicyUseCase { constructor(private readonly query:OperationalHealthQueryPort){} execute(c:OperationalHealthApplicationContext){return this.query.getMaintenancePolicy(c);} }
export class UpsertMaintenancePolicyUseCase { constructor(private readonly write:OperationalHealthWritePort){} execute(c:OperationalHealthApplicationContext,p:MaintenancePolicyView):Result<MaintenancePolicyView,AppError>{if(!Number.isFinite(p.intervalHours)||p.intervalHours<1||p.intervalHours>720)return err(invalid(c,'Bakım aralığı 1-720 saat arasında olmalıdır.'));if(p.keepDiagnosticDays<1||p.keepPerformanceDays<1)return err(invalid(c,'Saklama günleri en az 1 olmalıdır.'));const r=this.write.upsertMaintenancePolicy(c,p);return r.ok?ok(p):r;} }
export class ListHealthNotificationsUseCase { constructor(private readonly query:OperationalHealthQueryPort){} execute(c:OperationalHealthApplicationContext,limit=100){return this.query.listHealthNotifications(c,clamp(Math.trunc(limit),1,500));} }
export class FindActiveHealthNotificationUseCase { constructor(private readonly query:OperationalHealthQueryPort){} execute(c:OperationalHealthApplicationContext,code:string){if(!code.trim())return err(invalid(c,'Bildirim kodu zorunludur.'));return this.query.findActiveHealthNotification(c,code.trim());} }
export class RecordHealthNotificationUseCase { constructor(private readonly write:OperationalHealthWritePort){} execute(c:OperationalHealthApplicationContext,e:HealthNotificationView):Result<HealthNotificationView,AppError>{if(!e.code.trim()||!e.title.trim()||!e.message.trim())return err(invalid(c,'Bildirim kodu, başlığı ve mesajı zorunludur.'));const r=this.write.insertHealthNotification(c,e);return r.ok?ok(e):r;} }
export class AttachHealthNotificationTaskUseCase { constructor(private readonly write:OperationalHealthWritePort){} execute(c:OperationalHealthApplicationContext,id:string,taskId:string){return this.write.attachHealthNotificationTask(c,id,taskId);} }
export class AcknowledgeHealthNotificationUseCase { constructor(private readonly write:OperationalHealthWritePort){} execute(c:OperationalHealthApplicationContext,id:string,at:string){return this.write.acknowledgeHealthNotification(c,id,at);} }
export class GetOperationalHealthCountsUseCase { constructor(private readonly query:OperationalHealthQueryPort){} execute(c:OperationalHealthApplicationContext,since:string,diagnosticCode='task.long_running'){const failed=this.query.countFailedBackupsSince(c,since);if(!failed.ok)return failed;const long=this.query.countDiagnosticsByCodeSince(c,diagnosticCode,since);if(!long.ok)return long;const active=this.query.countActiveHealthNotifications(c);if(!active.ok)return active;return ok({failedBackups:failed.value,matchingDiagnostics:long.value,activeNotifications:active.value});} }
export class CleanupOperationalHealthUseCase { constructor(private readonly query:OperationalHealthQueryPort,private readonly write:OperationalHealthWritePort){} execute(c:OperationalHealthApplicationContext,diagnosticCutoff:string,performanceCutoff:string,lastRunAt:string,nextRunAt:string){const db=this.query.countDiagnostics(c);if(!db.ok)return db;const pb=this.query.countPerformanceSamples(c);if(!pb.ok)return pb;for(const r of [this.write.deleteDiagnosticsBefore(c,diagnosticCutoff),this.write.deletePerformanceSamplesBefore(c,performanceCutoff),this.write.updateMaintenanceSchedule(c,lastRunAt,nextRunAt)])if(!r.ok)return r;const da=this.query.countDiagnostics(c);if(!da.ok)return da;const pa=this.query.countPerformanceSamples(c);if(!pa.ok)return pa;return ok({deletedDiagnostics:db.value-da.value,deletedPerformanceSamples:pb.value-pa.value});} }

export class RecordExportArtifactUseCase { constructor(private readonly write:OperationalHealthWritePort){} execute(c:OperationalHealthApplicationContext,e:ExportArtifactView):Result<ExportArtifactView,AppError>{if(!e.id.trim()||!e.filePath.trim()||!e.sha256.trim())return err(invalid(c,'Dışa aktarım kimliği, dosya yolu ve özeti zorunludur.'));if(!Number.isFinite(e.sizeBytes)||e.sizeBytes<0)return err(invalid(c,'Dışa aktarım boyutu geçersizdir.'));const r=this.write.insertExportArtifact(c,e);return r.ok?ok(e):r;} }
export class ListExportArtifactsUseCase { constructor(private readonly query:OperationalHealthQueryPort){} execute(c:OperationalHealthApplicationContext,limit=100){return this.query.listExportArtifacts(c,clamp(Math.trunc(limit),1,500));} }
export class FindExportArtifactUseCase { constructor(private readonly query:OperationalHealthQueryPort){} execute(c:OperationalHealthApplicationContext,id:string){if(!id.trim())return err(invalid(c,'Dışa aktarım kimliği zorunludur.'));return this.query.findExportArtifact(c,id.trim());} }
export class RecordDiagnosticReportUseCase { constructor(private readonly write:OperationalHealthWritePort){} execute(c:OperationalHealthApplicationContext,e:DiagnosticReportHistoryView):Result<DiagnosticReportHistoryView,AppError>{if(!e.id.trim()||!e.sha256.trim())return err(invalid(c,'Tanılama raporu kimliği ve özeti zorunludur.'));const r=this.write.insertDiagnosticReport(c,e);return r.ok?ok(e):r;} }
export class ListDiagnosticReportsUseCase { constructor(private readonly query:OperationalHealthQueryPort){} execute(c:OperationalHealthApplicationContext,limit=100){return this.query.listDiagnosticReports(c,clamp(Math.trunc(limit),1,500));} }
export class FindDiagnosticReportUseCase { constructor(private readonly query:OperationalHealthQueryPort){} execute(c:OperationalHealthApplicationContext,id:string){if(!id.trim())return err(invalid(c,'Tanılama raporu kimliği zorunludur.'));return this.query.findDiagnosticReport(c,id.trim());} }

export class RecordDiagnosticArchiveUseCase { constructor(private readonly write:OperationalHealthWritePort){} execute(c:OperationalHealthApplicationContext,e:DiagnosticArchiveView):Result<DiagnosticArchiveView,AppError>{if(!e.id.trim()||!e.filePath.trim()||!e.sha256.trim())return err(invalid(c,'Tanılama arşivi kimliği, dosya yolu ve özeti zorunludur.'));if(!Number.isFinite(e.entryCount)||e.entryCount<1||!Number.isFinite(e.sizeBytes)||e.sizeBytes<0)return err(invalid(c,'Tanılama arşivi sayaçları geçersizdir.'));const r=this.write.insertDiagnosticArchive(c,e);return r.ok?ok(e):r;} }
export class ListDiagnosticArchivesUseCase { constructor(private readonly query:OperationalHealthQueryPort){} execute(c:OperationalHealthApplicationContext,limit=100){return this.query.listDiagnosticArchives(c,clamp(Math.trunc(limit),1,500));} }
export class FindDiagnosticArchiveUseCase { constructor(private readonly query:OperationalHealthQueryPort){} execute(c:OperationalHealthApplicationContext,id:string){if(!id.trim())return err(invalid(c,'Tanılama arşivi kimliği zorunludur.'));return this.query.findDiagnosticArchive(c,id.trim());} }
export class DeleteDiagnosticsThroughUseCase { constructor(private readonly write:OperationalHealthWritePort){} execute(c:OperationalHealthApplicationContext,cutoff:string){if(!cutoff.trim())return err(invalid(c,'Tanılama arşivi kesim zamanı zorunludur.'));return this.write.deleteDiagnosticsThrough(c,cutoff.trim());} }
