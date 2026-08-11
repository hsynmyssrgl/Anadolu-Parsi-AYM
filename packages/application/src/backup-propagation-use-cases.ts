import { isAdministrativeRole } from '@ppt/security';
import {
  ERROR_CODES,
  createAppError,
  err,
  type AppError,
  type CorrelationId,
  type FamilyId,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import type {
  BackupCleanRewriteOutcome,
  BackupCleanRewritePolicyView,
  BackupCleanRewriteRunStatus,
  BackupCleanRewriteRunView,
  BackupCleanRewriteState,
  BackupCleanRewriteTrigger,
  BackupPropagationRunView,
  DataLifecycleResourceType,
  FamilyRole,
  UpdateBackupCleanRewritePolicyInput
} from '@ppt/domain';
import type { StrongAuthenticationPort } from './data-lifecycle-use-cases.js';

export interface BackupPropagationApplicationContext {
  readonly familyId:FamilyId;
  readonly actor:{readonly userId:UserId;readonly role:FamilyRole;readonly personId?:PersonId};
  readonly correlationId:CorrelationId;
}
export interface PendingBackupPropagationRecord {
  readonly resourceType:DataLifecycleResourceType;
  readonly resourceId:string;
  readonly purgedAt?:string;
  readonly updatedAt:string;
}
export interface BackupPropagationQueryPort {
  listPending(context:BackupPropagationApplicationContext):Result<readonly PendingBackupPropagationRecord[],AppError>;
  listRuns(context:BackupPropagationApplicationContext,limit:number):Result<readonly BackupPropagationRunView[],AppError>;
  getCleanRewritePolicy(context:BackupPropagationApplicationContext):Result<BackupCleanRewritePolicyView,AppError>;
  listCleanRewriteRuns(context:BackupPropagationApplicationContext,limit:number):Result<readonly BackupCleanRewriteRunView[],AppError>;
}
export interface BackupPropagationWritePort {
  markCompleted(context:BackupPropagationApplicationContext,records:readonly PendingBackupPropagationRecord[],completedAt:string):Result<number,AppError>;
  insertRun(context:BackupPropagationApplicationContext,run:BackupPropagationRunView):Result<void,AppError>;
  updateCleanRewritePolicy(context:BackupPropagationApplicationContext,input:{readonly enabled:boolean;readonly retentionDays:number;readonly updatedAt:string}):Result<BackupCleanRewritePolicyView,AppError>;
  claimCleanRewrite(context:BackupPropagationApplicationContext,input:{readonly trigger:BackupCleanRewriteTrigger;readonly runId:string;readonly startedAt:string;readonly retentionCutoff:string;readonly dueRecords:number;readonly enabledTargets:number}):Result<BackupCleanRewritePolicyView|null,AppError>;
  completeCleanRewrite(context:BackupPropagationApplicationContext,input:{readonly runId:string;readonly state:BackupCleanRewriteState;readonly outcome:BackupCleanRewriteOutcome;readonly runStatus:Exclude<BackupCleanRewriteRunStatus,'running'|'interrupted'>;readonly completedAt:string;readonly nextAttemptAt?:string;readonly error?:string;readonly propagationRunId?:string;readonly success:boolean}):Result<{readonly policy:BackupCleanRewritePolicyView;readonly run:BackupCleanRewriteRunView}|null,AppError>;
  recoverInterruptedCleanRewrite(context:BackupPropagationApplicationContext,input:{readonly observedAt:string;readonly error:string}):Result<{readonly policy:BackupCleanRewritePolicyView;readonly run?:BackupCleanRewriteRunView},AppError>;
}
const denied=(context:BackupPropagationApplicationContext)=>createAppError({
  code:ERROR_CODES.AUTHORIZATION_DENIED,
  message:'Yedek imha yayılımını yalnız aile yöneticisi çalıştırabilir.',
  category:'authorization',
  correlationId:context.correlationId
});
const requireAdmin=<T>(context:BackupPropagationApplicationContext,operation:()=>Result<T,AppError>):Result<T,AppError>=>
  isAdministrativeRole(context.actor.role)?operation():err(denied(context));

export class ListPendingBackupPropagationUseCase {
  constructor(private readonly query:BackupPropagationQueryPort){}
  execute(context:BackupPropagationApplicationContext){return requireAdmin(context,()=>this.query.listPending(context));}
}
export class ListBackupPropagationRunsUseCase {
  constructor(private readonly query:BackupPropagationQueryPort){}
  execute(context:BackupPropagationApplicationContext,limit=20){return requireAdmin(context,()=>this.query.listRuns(context,Math.max(1,Math.min(100,Math.trunc(limit)))));}
}
export class CompleteBackupPropagationUseCase {
  constructor(private readonly write:BackupPropagationWritePort){}
  execute(context:BackupPropagationApplicationContext,records:readonly PendingBackupPropagationRecord[],completedAt:string):Result<number,AppError>{
    return requireAdmin(context,()=>{
      if(records.length===0)return err(createAppError({code:ERROR_CODES.CORE_INVALID_ARGUMENT,message:'Tamamlanacak yedek yayılım kaydı bulunmuyor.',category:'validation',correlationId:context.correlationId}));
      if(Number.isNaN(Date.parse(completedAt)))return err(createAppError({code:ERROR_CODES.CORE_INVALID_ARGUMENT,message:'Yedek yayılım tamamlanma zamanı geçersizdir.',category:'validation',correlationId:context.correlationId}));
      const unique=new Set(records.map(record=>`${record.resourceType}:${record.resourceId}`));
      if(unique.size!==records.length)return err(createAppError({code:ERROR_CODES.CORE_INVALID_ARGUMENT,message:'Yedek yayılım listesinde yinelenen kayıt bulunuyor.',category:'validation',correlationId:context.correlationId}));
      const completed=this.write.markCompleted(context,records,completedAt);
      if(!completed.ok)return completed;
      if(completed.value!==records.length)return err(createAppError({code:ERROR_CODES.RESOURCE_CONFLICT,message:'İmha tombstone kayıtları eşzamanlı değişti; yayılım tamamlanmadı.',category:'conflict',correlationId:context.correlationId,details:{expected:records.length,completed:completed.value}}));
      return completed;
    });
  }
}
export class RecordBackupPropagationRunUseCase {
  constructor(private readonly write:BackupPropagationWritePort){}
  execute(context:BackupPropagationApplicationContext,run:BackupPropagationRunView){return requireAdmin(context,()=>this.write.insertRun(context,run));}
}


export class GetBackupCleanRewritePolicyUseCase {
  constructor(private readonly query:BackupPropagationQueryPort){}
  execute(context:BackupPropagationApplicationContext){return requireAdmin(context,()=>this.query.getCleanRewritePolicy(context));}
}
export class ListBackupCleanRewriteRunsUseCase {
  constructor(private readonly query:BackupPropagationQueryPort){}
  execute(context:BackupPropagationApplicationContext,limit=20){return requireAdmin(context,()=>this.query.listCleanRewriteRuns(context,Math.max(1,Math.min(100,Math.trunc(limit)))));}
}
export class UpdateBackupCleanRewritePolicyUseCase {
  constructor(private readonly write:BackupPropagationWritePort,private readonly strongAuth:StrongAuthenticationPort){}
  execute(context:BackupPropagationApplicationContext,input:UpdateBackupCleanRewritePolicyInput,updatedAt:string):Result<BackupCleanRewritePolicyView,AppError>{
    return requireAdmin(context,()=>{
      if(!Number.isInteger(input.retentionDays)||input.retentionDays<1||input.retentionDays>3650)return err(createAppError({code:ERROR_CODES.CORE_INVALID_ARGUMENT,message:'Temiz yedek yeniden yazım saklama süresi 1 ile 3650 gün arasında olmalıdır.',category:'validation',correlationId:context.correlationId}));
      if(Number.isNaN(Date.parse(updatedAt)))return err(createAppError({code:ERROR_CODES.CORE_INVALID_ARGUMENT,message:'Politika güncelleme zamanı geçersizdir.',category:'validation',correlationId:context.correlationId}));
      const verified=this.strongAuth.verify(context,{password:input.password,...(input.code?{code:input.code}:{})});if(!verified.ok)return verified;
      return this.write.updateCleanRewritePolicy(context,{enabled:input.enabled,retentionDays:input.retentionDays,updatedAt});
    });
  }
}
export class ClaimBackupCleanRewriteUseCase {
  constructor(private readonly write:BackupPropagationWritePort){}
  execute(context:BackupPropagationApplicationContext,input:{readonly trigger:BackupCleanRewriteTrigger;readonly runId:string;readonly startedAt:string;readonly retentionCutoff:string;readonly dueRecords:number;readonly enabledTargets:number}){
    return requireAdmin(context,()=>this.write.claimCleanRewrite(context,input));
  }
}
export class CompleteBackupCleanRewriteUseCase {
  constructor(private readonly write:BackupPropagationWritePort){}
  execute(context:BackupPropagationApplicationContext,input:{readonly runId:string;readonly state:BackupCleanRewriteState;readonly outcome:BackupCleanRewriteOutcome;readonly runStatus:Exclude<BackupCleanRewriteRunStatus,'running'|'interrupted'>;readonly completedAt:string;readonly nextAttemptAt?:string;readonly error?:string;readonly propagationRunId?:string;readonly success:boolean}){
    return requireAdmin(context,()=>this.write.completeCleanRewrite(context,input));
  }
}
export class RecoverInterruptedBackupCleanRewriteUseCase {
  constructor(private readonly write:BackupPropagationWritePort){}
  execute(context:BackupPropagationApplicationContext,input:{readonly observedAt:string;readonly error:string}){
    return requireAdmin(context,()=>this.write.recoverInterruptedCleanRewrite(context,input));
  }
}
