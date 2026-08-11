import { ERROR_CODES, createAppError, err, ok, type AppError, type CorrelationId, type Result, type UserId } from '@ppt/core';
import type { BackupRunView, BackupTargetView, UpsertBackupTargetInput } from '@ppt/domain';

export interface BackupApplicationContext { readonly actorId:UserId; readonly correlationId:CorrelationId; }
export interface BackupQueryPort {
  listTargets(context:BackupApplicationContext):Result<readonly BackupTargetView[],AppError>;
  findTarget(context:BackupApplicationContext,id:string):Result<BackupTargetView|undefined,AppError>;
  listRuns(context:BackupApplicationContext,limit:number):Result<readonly BackupRunView[],AppError>;
  listSuccessfulRuns(context:BackupApplicationContext,targetId:string):Result<readonly BackupRunView[],AppError>;
  listEnabledTargetIds(context:BackupApplicationContext):Result<readonly string[],AppError>;
  listDueTargetIds(context:BackupApplicationContext,at:string):Result<readonly string[],AppError>;
}
export interface BackupWritePort {
  upsertTarget(context:BackupApplicationContext,target:BackupTargetView):Result<void,AppError>;
  insertRun(context:BackupApplicationContext,run:BackupRunView):Result<void,AppError>;
  markTargetSuccess(context:BackupApplicationContext,id:string,completedAt:string,nextRunAt?:string):Result<void,AppError>;
  markTargetFailure(context:BackupApplicationContext,id:string,error:string):Result<void,AppError>;
  deleteRun(context:BackupApplicationContext,id:string):Result<void,AppError>;
}
const invalid=(c:BackupApplicationContext,m:string)=>createAppError({code:ERROR_CODES.CORE_INVALID_ARGUMENT,message:m,category:'validation',correlationId:c.correlationId});
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(Math.trunc(n),max));
export class ListBackupTargetsUseCase {constructor(private readonly q:BackupQueryPort){}execute(c:BackupApplicationContext){return this.q.listTargets(c);}}
export class FindBackupTargetUseCase {constructor(private readonly q:BackupQueryPort){}execute(c:BackupApplicationContext,id:string){if(!id.trim())return err(invalid(c,'Yedek hedefi kimliği zorunludur.'));return this.q.findTarget(c,id);}}
export class UpsertBackupTargetUseCase {constructor(private readonly w:BackupWritePort){}execute(c:BackupApplicationContext,input:UpsertBackupTargetInput,id:string,createdAt:string,nextRunAt?:string):Result<BackupTargetView,AppError>{const name=input.name.trim(),path=input.path.trim();if(name.length<2)return err(invalid(c,'Yedek hedefi adı en az 2 karakter olmalıdır.'));if(!path)return err(invalid(c,'Yedek hedefi yolu zorunludur.'));const target:BackupTargetView={id,name,kind:input.kind,path,enabled:input.enabled!==false,schedule:input.schedule??'manual',retentionCount:clamp(input.retentionCount??10,1,365),retryCount:clamp(input.retryCount??2,0,5),createdAt,...(nextRunAt?{nextRunAt}:{})};const saved=this.w.upsertTarget(c,target);return saved.ok?ok(target):saved;}}
export class ListBackupRunsUseCase {constructor(private readonly q:BackupQueryPort){}execute(c:BackupApplicationContext,limit=100){return this.q.listRuns(c,clamp(limit,1,500));}}
export class ListSuccessfulBackupRunsUseCase {constructor(private readonly q:BackupQueryPort){}execute(c:BackupApplicationContext,targetId:string){return this.q.listSuccessfulRuns(c,targetId);}}
export class ListEnabledBackupTargetIdsUseCase {constructor(private readonly q:BackupQueryPort){}execute(c:BackupApplicationContext){return this.q.listEnabledTargetIds(c);}}
export class ListDueBackupTargetIdsUseCase {constructor(private readonly q:BackupQueryPort){}execute(c:BackupApplicationContext,at:string){return this.q.listDueTargetIds(c,at);}}
export class RecordBackupRunUseCase {constructor(private readonly w:BackupWritePort){}execute(c:BackupApplicationContext,run:BackupRunView){return this.w.insertRun(c,run);}}
export class MarkBackupTargetSuccessUseCase {constructor(private readonly w:BackupWritePort){}execute(c:BackupApplicationContext,id:string,completedAt:string,nextRunAt?:string){return this.w.markTargetSuccess(c,id,completedAt,nextRunAt);}}
export class MarkBackupTargetFailureUseCase {constructor(private readonly w:BackupWritePort){}execute(c:BackupApplicationContext,id:string,error:string){return this.w.markTargetFailure(c,id,error);}}
export class DeleteBackupRunUseCase {constructor(private readonly w:BackupWritePort){}execute(c:BackupApplicationContext,id:string){return this.w.deleteRun(c,id);}}
