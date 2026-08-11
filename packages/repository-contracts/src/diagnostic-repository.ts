import type { IsoDateTime } from '@ppt/core';
import type { DiagnosticArchiveView, DiagnosticEntryView, DiagnosticReportHistoryView, ExportArtifactView, HealthNotificationView, MaintenanceHistoryFilterInput, MaintenanceHistoryView, MaintenancePolicyView, PerformanceSampleView, SystemHealthHistoryView } from '@ppt/domain';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface DiagnosticRecord { readonly id:string; readonly severity:'info'|'warning'|'error'; readonly code:string; readonly message:string; readonly details?:string; readonly occurredAt:IsoDateTime; }

export interface DiagnosticRepositoryPort {
    insertIfAbsent(c: RepositoryExecutionContext, r: DiagnosticRecord): RepositoryResult<void>;
    insertDiagnostic(c: RepositoryExecutionContext, r: DiagnosticEntryView): RepositoryResult<void>;
    listDiagnostics(c: RepositoryExecutionContext, limit: number): RepositoryResult<readonly DiagnosticEntryView[]>;
    insertPerformanceSample(c: RepositoryExecutionContext, r: PerformanceSampleView): RepositoryResult<void>;
    listPerformanceSamples(c: RepositoryExecutionContext, limit: number): RepositoryResult<readonly PerformanceSampleView[]>;
    listPerformanceSamplesSince(c: RepositoryExecutionContext, since: string): RepositoryResult<readonly PerformanceSampleView[]>;
    insertSystemHealthHistory(c: RepositoryExecutionContext, r: SystemHealthHistoryView): RepositoryResult<void>;
    listSystemHealthHistory(c: RepositoryExecutionContext, limit: number): RepositoryResult<readonly SystemHealthHistoryView[]>;
    listSystemHealthHistorySince(c: RepositoryExecutionContext, since: string): RepositoryResult<readonly SystemHealthHistoryView[]>;
    insertMaintenanceHistory(c: RepositoryExecutionContext, r: MaintenanceHistoryView): RepositoryResult<void>;
    listMaintenanceHistory(c: RepositoryExecutionContext, limit: number): RepositoryResult<readonly MaintenanceHistoryView[]>;
    searchMaintenanceHistory(c: RepositoryExecutionContext, input: MaintenanceHistoryFilterInput): RepositoryResult<readonly MaintenanceHistoryView[]>;
    getMaintenancePolicy(c: RepositoryExecutionContext): RepositoryResult<MaintenancePolicyView>;
    upsertMaintenancePolicy(c: RepositoryExecutionContext, p: MaintenancePolicyView): RepositoryResult<void>;
    updateMaintenanceSchedule(c: RepositoryExecutionContext, lastRunAt: string, nextRunAt: string): RepositoryResult<void>;
    countDiagnostics(c: RepositoryExecutionContext): RepositoryResult<number>;
    countPerformanceSamples(c: RepositoryExecutionContext): RepositoryResult<number>;
    deleteDiagnosticsBefore(c: RepositoryExecutionContext, cutoff: string): RepositoryResult<void>;
    deletePerformanceSamplesBefore(c: RepositoryExecutionContext, cutoff: string): RepositoryResult<void>;
    listHealthNotifications(c: RepositoryExecutionContext, limit: number): RepositoryResult<readonly HealthNotificationView[]>;
    findActiveHealthNotification(c: RepositoryExecutionContext, code: string): RepositoryResult<HealthNotificationView | undefined>;
    insertHealthNotification(c: RepositoryExecutionContext, e: HealthNotificationView): RepositoryResult<void>;
    attachHealthNotificationTask(c: RepositoryExecutionContext, id: string, taskId: string): RepositoryResult<void>;
    acknowledgeHealthNotification(c: RepositoryExecutionContext, id: string, at: string): RepositoryResult<void>;
    countFailedBackupsSince(c: RepositoryExecutionContext, since: string): RepositoryResult<number>;
    countDiagnosticsByCodeSince(c: RepositoryExecutionContext, code: string, since: string): RepositoryResult<number>;
    countActiveHealthNotifications(c: RepositoryExecutionContext): RepositoryResult<number>;
    insertExportArtifact(c: RepositoryExecutionContext, e: ExportArtifactView): RepositoryResult<void>;
    listExportArtifacts(c: RepositoryExecutionContext, limit: number): RepositoryResult<readonly ExportArtifactView[]>;
    findExportArtifact(c: RepositoryExecutionContext, id: string): RepositoryResult<ExportArtifactView | undefined>;
    insertDiagnosticReport(c: RepositoryExecutionContext, e: DiagnosticReportHistoryView): RepositoryResult<void>;
    listDiagnosticReports(c: RepositoryExecutionContext, limit: number): RepositoryResult<readonly DiagnosticReportHistoryView[]>;
    findDiagnosticReport(c: RepositoryExecutionContext, id: string): RepositoryResult<DiagnosticReportHistoryView | undefined>;
    insertDiagnosticArchive(c: RepositoryExecutionContext, e: DiagnosticArchiveView): RepositoryResult<void>;
    listDiagnosticArchives(c: RepositoryExecutionContext, limit: number): RepositoryResult<readonly DiagnosticArchiveView[]>;
    findDiagnosticArchive(c: RepositoryExecutionContext, id: string): RepositoryResult<DiagnosticArchiveView | undefined>;
    deleteDiagnosticsThrough(c: RepositoryExecutionContext, cutoff: string): RepositoryResult<void>;
}
