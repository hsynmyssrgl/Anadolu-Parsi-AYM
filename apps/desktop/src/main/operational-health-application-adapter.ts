import { asIsoDateTime, type AppError, type Result } from '@ppt/core';
import type { OperationalHealthApplicationContext, OperationalHealthQueryPort, OperationalHealthWritePort } from '@ppt/application';
import type { TransactionExecutor, TransactionContext } from '@ppt/repository-contracts';
import type { DiagnosticRepositoryPort, RepositoryExecutionContext } from '@ppt/repository-contracts';
export interface RepositoryBackedOperationalHealthDependencies { readonly transactionExecutor:TransactionExecutor; readonly diagnosticRepository:DiagnosticRepositoryPort; }
const rc=(c:OperationalHealthApplicationContext,t:TransactionContext):RepositoryExecutionContext=>({transaction:t.transaction,actor:{userId:c.actorId,roles:['system_operator']},correlationId:c.correlationId,occurredAt:t.occurredAt});
export class RepositoryBackedOperationalHealthAdapter implements OperationalHealthQueryPort,OperationalHealthWritePort {
  constructor(private readonly d:RepositoryBackedOperationalHealthDependencies){}
  private read<T>(c:OperationalHealthApplicationContext,op:(r:RepositoryExecutionContext)=>Result<T,AppError>):Result<T,AppError>{return this.d.transactionExecutor.execute(c.correlationId,t=>op(rc(c,t)));}
  listPerformanceSamples(c:OperationalHealthApplicationContext,l:number){return this.read(c,r=>this.d.diagnosticRepository.listPerformanceSamples(r,l));}
  listPerformanceSamplesSince(c:OperationalHealthApplicationContext,s:string){return this.read(c,r=>this.d.diagnosticRepository.listPerformanceSamplesSince(r,s));}
  listDiagnostics(c:OperationalHealthApplicationContext,l:number){return this.read(c,r=>this.d.diagnosticRepository.listDiagnostics(r,l));}
  listSystemHealthHistory(c:OperationalHealthApplicationContext,l:number){return this.read(c,r=>this.d.diagnosticRepository.listSystemHealthHistory(r,l));}
  listSystemHealthHistorySince(c:OperationalHealthApplicationContext,s:string){return this.read(c,r=>this.d.diagnosticRepository.listSystemHealthHistorySince(r,s));}
  listMaintenanceHistory(c:OperationalHealthApplicationContext,l:number){return this.read(c,r=>this.d.diagnosticRepository.listMaintenanceHistory(r,l));}
  searchMaintenanceHistory(c:OperationalHealthApplicationContext,i:Parameters<OperationalHealthQueryPort['searchMaintenanceHistory']>[1]){return this.read(c,r=>this.d.diagnosticRepository.searchMaintenanceHistory(r,i));}
  insertPerformanceSample(c:OperationalHealthApplicationContext,s:Parameters<OperationalHealthWritePort['insertPerformanceSample']>[1]){return this.read(c,r=>this.d.diagnosticRepository.insertPerformanceSample(r,s));}
  insertDiagnostic(c:OperationalHealthApplicationContext,e:Parameters<OperationalHealthWritePort['insertDiagnostic']>[1]){return this.read(c,r=>this.d.diagnosticRepository.insertDiagnostic(r,e));}
  insertSystemHealthHistory(c:OperationalHealthApplicationContext,e:Parameters<OperationalHealthWritePort['insertSystemHealthHistory']>[1]){return this.read(c,r=>this.d.diagnosticRepository.insertSystemHealthHistory(r,e));}
  insertMaintenanceHistory(c:OperationalHealthApplicationContext,e:Parameters<OperationalHealthWritePort['insertMaintenanceHistory']>[1]){return this.read(c,r=>this.d.diagnosticRepository.insertMaintenanceHistory(r,e));}

  getMaintenancePolicy(c:OperationalHealthApplicationContext){return this.read(c,r=>this.d.diagnosticRepository.getMaintenancePolicy(r));}
  listHealthNotifications(c:OperationalHealthApplicationContext,l:number){return this.read(c,r=>this.d.diagnosticRepository.listHealthNotifications(r,l));}
  findActiveHealthNotification(c:OperationalHealthApplicationContext,code:string){return this.read(c,r=>this.d.diagnosticRepository.findActiveHealthNotification(r,code));}
  countDiagnostics(c:OperationalHealthApplicationContext){return this.read(c,r=>this.d.diagnosticRepository.countDiagnostics(r));}
  countPerformanceSamples(c:OperationalHealthApplicationContext){return this.read(c,r=>this.d.diagnosticRepository.countPerformanceSamples(r));}
  countFailedBackupsSince(c:OperationalHealthApplicationContext,since:string){return this.read(c,r=>this.d.diagnosticRepository.countFailedBackupsSince(r,since));}
  countDiagnosticsByCodeSince(c:OperationalHealthApplicationContext,code:string,since:string){return this.read(c,r=>this.d.diagnosticRepository.countDiagnosticsByCodeSince(r,code,since));}
  countActiveHealthNotifications(c:OperationalHealthApplicationContext){return this.read(c,r=>this.d.diagnosticRepository.countActiveHealthNotifications(r));}
  listExportArtifacts(c:OperationalHealthApplicationContext,l:number){return this.read(c,r=>this.d.diagnosticRepository.listExportArtifacts(r,l));}
  findExportArtifact(c:OperationalHealthApplicationContext,id:string){return this.read(c,r=>this.d.diagnosticRepository.findExportArtifact(r,id));}
  listDiagnosticReports(c:OperationalHealthApplicationContext,l:number){return this.read(c,r=>this.d.diagnosticRepository.listDiagnosticReports(r,l));}
  findDiagnosticReport(c:OperationalHealthApplicationContext,id:string){return this.read(c,r=>this.d.diagnosticRepository.findDiagnosticReport(r,id));}
  listDiagnosticArchives(c:OperationalHealthApplicationContext,l:number){return this.read(c,r=>this.d.diagnosticRepository.listDiagnosticArchives(r,l));}
  findDiagnosticArchive(c:OperationalHealthApplicationContext,id:string){return this.read(c,r=>this.d.diagnosticRepository.findDiagnosticArchive(r,id));}
  upsertMaintenancePolicy(c:OperationalHealthApplicationContext,p:Parameters<OperationalHealthWritePort['upsertMaintenancePolicy']>[1]){return this.read(c,r=>this.d.diagnosticRepository.upsertMaintenancePolicy(r,p));}
  updateMaintenanceSchedule(c:OperationalHealthApplicationContext,last:string,next:string){return this.read(c,r=>this.d.diagnosticRepository.updateMaintenanceSchedule(r,last,next));}
  deleteDiagnosticsBefore(c:OperationalHealthApplicationContext,cutoff:string){return this.read(c,r=>this.d.diagnosticRepository.deleteDiagnosticsBefore(r,cutoff));}
  deletePerformanceSamplesBefore(c:OperationalHealthApplicationContext,cutoff:string){return this.read(c,r=>this.d.diagnosticRepository.deletePerformanceSamplesBefore(r,cutoff));}
  insertHealthNotification(c:OperationalHealthApplicationContext,e:Parameters<OperationalHealthWritePort['insertHealthNotification']>[1]){return this.read(c,r=>this.d.diagnosticRepository.insertHealthNotification(r,e));}
  attachHealthNotificationTask(c:OperationalHealthApplicationContext,id:string,taskId:string){return this.read(c,r=>this.d.diagnosticRepository.attachHealthNotificationTask(r,id,taskId));}
  acknowledgeHealthNotification(c:OperationalHealthApplicationContext,id:string,at:string){return this.read(c,r=>this.d.diagnosticRepository.acknowledgeHealthNotification(r,id,at));}
  insertExportArtifact(c:OperationalHealthApplicationContext,e:Parameters<OperationalHealthWritePort['insertExportArtifact']>[1]){return this.read(c,r=>this.d.diagnosticRepository.insertExportArtifact(r,e));}
  insertDiagnosticReport(c:OperationalHealthApplicationContext,e:Parameters<OperationalHealthWritePort['insertDiagnosticReport']>[1]){return this.read(c,r=>this.d.diagnosticRepository.insertDiagnosticReport(r,e));}
  insertDiagnosticArchive(c:OperationalHealthApplicationContext,e:Parameters<OperationalHealthWritePort['insertDiagnosticArchive']>[1]){return this.read(c,r=>this.d.diagnosticRepository.insertDiagnosticArchive(r,e));}
  deleteDiagnosticsThrough(c:OperationalHealthApplicationContext,cutoff:string){return this.read(c,r=>this.d.diagnosticRepository.deleteDiagnosticsThrough(r,cutoff));}
}

