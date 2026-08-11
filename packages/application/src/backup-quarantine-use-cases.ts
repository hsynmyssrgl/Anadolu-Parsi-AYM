import { isAdministrativeRole } from '@ppt/security';
import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type FamilyId,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import type {
  BackupQuarantineBatchView,
  BackupQuarantineDestructionResultView,
  BackupQuarantinePolicyView,
  DestroyBackupQuarantineBatchInput,
  FamilyRole,
  SetBackupQuarantineLegalHoldInput,
  UpdateBackupQuarantinePolicyInput
} from '@ppt/domain';
import type { StrongAuthenticationPort } from './data-lifecycle-use-cases.js';

export interface BackupQuarantineApplicationContext {
  readonly familyId:FamilyId;
  readonly actor:{readonly userId:UserId;readonly role:FamilyRole;readonly personId?:PersonId};
  readonly correlationId:CorrelationId;
}
export interface RegisterBackupQuarantineBatchInput {
  readonly id:string;
  readonly propagationRunId:string;
  readonly targetId:string;
  readonly targetName:string;
  readonly quarantineDirectory:string;
  readonly manifestPath:string;
  readonly quarantinedArtifacts:number;
  readonly quarantinedAt:string;
}
export interface BackupQuarantineQueryPort {
  getPolicy(context:BackupQuarantineApplicationContext):Result<BackupQuarantinePolicyView,AppError>;
  listBatches(context:BackupQuarantineApplicationContext,limit:number):Result<readonly BackupQuarantineBatchView[],AppError>;
  findBatch(context:BackupQuarantineApplicationContext,id:string):Result<BackupQuarantineBatchView|null,AppError>;
}
export interface BackupQuarantineWritePort {
  updatePolicy(context:BackupQuarantineApplicationContext,retentionDays:number,updatedAt:string):Result<BackupQuarantinePolicyView,AppError>;
  insertBatch(context:BackupQuarantineApplicationContext,row:BackupQuarantineBatchView):Result<void,AppError>;
  setLegalHold(context:BackupQuarantineApplicationContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly enabled:boolean;readonly reason?:string;readonly updatedAt:string}):Result<BackupQuarantineBatchView|null,AppError>;
  beginDestruction(context:BackupQuarantineApplicationContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly updatedAt:string}):Result<BackupQuarantineBatchView|null,AppError>;
  completeDestruction(context:BackupQuarantineApplicationContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly destroyedAt:string;readonly destroyedArtifacts:number;readonly destroyedBytes:number}):Result<BackupQuarantineBatchView|null,AppError>;
}
export interface BackupQuarantineDestructionFilePort {
  destroy(input:{readonly batchId:string;readonly quarantineDirectory:string;readonly manifestPath:string;readonly destroyedAt:string},correlationId:CorrelationId):Result<{readonly destroyedArtifacts:number;readonly destroyedBytes:number;readonly resumed:boolean;readonly receiptPath:string},AppError>;
}

const denied=(context:BackupQuarantineApplicationContext)=>createAppError({code:ERROR_CODES.AUTHORIZATION_DENIED,message:'Yedek karantina yönetişimini yalnız aile yöneticisi kullanabilir.',category:'authorization',correlationId:context.correlationId});
const invalid=(context:BackupQuarantineApplicationContext,message:string)=>createAppError({code:ERROR_CODES.CORE_INVALID_ARGUMENT,message,category:'validation',correlationId:context.correlationId});
const missing=(context:BackupQuarantineApplicationContext,message:string)=>createAppError({code:ERROR_CODES.RESOURCE_NOT_FOUND,message,category:'not_found',correlationId:context.correlationId});
const conflict=(context:BackupQuarantineApplicationContext,message:string)=>createAppError({code:ERROR_CODES.RESOURCE_CONFLICT,message,category:'conflict',correlationId:context.correlationId});
const requireAdmin=<T>(context:BackupQuarantineApplicationContext,operation:()=>Result<T,AppError>):Result<T,AppError>=>isAdministrativeRole(context.actor.role)?operation():err(denied(context));
const addDays=(iso:string,days:number)=>new Date(Date.parse(iso)+days*86_400_000).toISOString();
export const backupQuarantineDestructionConfirmation=(batchId:string)=>`KARANTİNA İMHA ${batchId}`;

export class GetBackupQuarantinePolicyUseCase {
  constructor(private readonly query:BackupQuarantineQueryPort){}
  execute(context:BackupQuarantineApplicationContext){return requireAdmin(context,()=>this.query.getPolicy(context));}
}
export class ListBackupQuarantineBatchesUseCase {
  constructor(private readonly query:BackupQuarantineQueryPort){}
  execute(context:BackupQuarantineApplicationContext,limit=100){return requireAdmin(context,()=>this.query.listBatches(context,Math.max(1,Math.min(500,Math.trunc(limit)))));}
}
export class RegisterBackupQuarantineBatchUseCase {
  constructor(private readonly query:BackupQuarantineQueryPort,private readonly write:BackupQuarantineWritePort){}
  execute(context:BackupQuarantineApplicationContext,input:RegisterBackupQuarantineBatchInput):Result<BackupQuarantineBatchView,AppError>{
    return requireAdmin(context,()=>{
      if(!input.id.trim()||!input.propagationRunId.trim()||!input.targetId.trim())return err(invalid(context,'Yedek karantina kayıt kimlikleri zorunludur.'));
      if(!input.quarantineDirectory.trim()||!input.manifestPath.trim())return err(invalid(context,'Yedek karantina dosya yolları zorunludur.'));
      if(!Number.isInteger(input.quarantinedArtifacts)||input.quarantinedArtifacts<1)return err(invalid(context,'Karantina kaydı en az bir yönetilen yedek içermelidir.'));
      if(Number.isNaN(Date.parse(input.quarantinedAt)))return err(invalid(context,'Karantina zamanı geçersizdir.'));
      const policy=this.query.getPolicy(context);if(!policy.ok)return policy;
      const row:BackupQuarantineBatchView={id:input.id,propagationRunId:input.propagationRunId,targetId:input.targetId,targetName:input.targetName,quarantineDirectory:input.quarantineDirectory,manifestPath:input.manifestPath,status:'retained',quarantinedArtifacts:input.quarantinedArtifacts,quarantinedAt:input.quarantinedAt,retainUntil:addDays(input.quarantinedAt,policy.value.retentionDays),legalHold:false,updatedAt:input.quarantinedAt};
      const inserted=this.write.insertBatch(context,row);return inserted.ok?ok(row):inserted;
    });
  }
}
export class UpdateBackupQuarantinePolicyUseCase {
  constructor(private readonly write:BackupQuarantineWritePort,private readonly strongAuth:StrongAuthenticationPort){}
  execute(context:BackupQuarantineApplicationContext,input:UpdateBackupQuarantinePolicyInput,updatedAt:string):Result<BackupQuarantinePolicyView,AppError>{
    return requireAdmin(context,()=>{
      if(!Number.isInteger(input.retentionDays)||input.retentionDays<1||input.retentionDays>3650)return err(invalid(context,'Karantina saklama süresi 1 ile 3650 gün arasında olmalıdır.'));
      if(Number.isNaN(Date.parse(updatedAt)))return err(invalid(context,'Politika güncelleme zamanı geçersizdir.'));
      const verified=this.strongAuth.verify(context,{password:input.password,...(input.code?{code:input.code}:{})});if(!verified.ok)return verified;
      return this.write.updatePolicy(context,input.retentionDays,updatedAt);
    });
  }
}
export class SetBackupQuarantineLegalHoldUseCase {
  constructor(private readonly query:BackupQuarantineQueryPort,private readonly write:BackupQuarantineWritePort,private readonly strongAuth:StrongAuthenticationPort){}
  execute(context:BackupQuarantineApplicationContext,input:SetBackupQuarantineLegalHoldInput,updatedAt:string):Result<BackupQuarantineBatchView,AppError>{
    return requireAdmin(context,()=>{
      const reason=input.reason?.trim();
      if(input.enabled&&(!reason||reason.length<5||reason.length>500))return err(invalid(context,'Karantina bekletme gerekçesi 5 ile 500 karakter arasında olmalıdır.'));
      const current=this.query.findBatch(context,input.batchId);if(!current.ok)return current;if(!current.value)return err(missing(context,'Yedek karantina kaydı bulunamadı.'));
      if(current.value.status!=='retained')return err(conflict(context,'İmha sürecindeki veya imha edilmiş karantina kaydının bekletmesi değiştirilemez.'));
      const verified=this.strongAuth.verify(context,{password:input.password,...(input.code?{code:input.code}:{})});if(!verified.ok)return verified;
      const updated=this.write.setLegalHold(context,{id:current.value.id,expectedUpdatedAt:current.value.updatedAt,enabled:input.enabled,...(input.enabled&&reason?{reason}:{}),updatedAt});
      if(!updated.ok)return updated;
      return updated.value?ok(updated.value):err(conflict(context,'Yedek karantina kaydı eşzamanlı değişti; bekletme güncellenmedi.'));
    });
  }
}
export class DestroyBackupQuarantineBatchUseCase {
  constructor(private readonly query:BackupQuarantineQueryPort,private readonly write:BackupQuarantineWritePort,private readonly files:BackupQuarantineDestructionFilePort,private readonly strongAuth:StrongAuthenticationPort){}
  execute(context:BackupQuarantineApplicationContext,input:DestroyBackupQuarantineBatchInput,destroyedAt:string):Result<BackupQuarantineDestructionResultView,AppError>{
    return requireAdmin(context,()=>{
      if(input.confirmation!==backupQuarantineDestructionConfirmation(input.batchId))return err(invalid(context,`Nihai imha için tam olarak “${backupQuarantineDestructionConfirmation(input.batchId)}” yazılmalıdır.`));
      if(Number.isNaN(Date.parse(destroyedAt)))return err(invalid(context,'Karantina imha zamanı geçersizdir.'));
      const found=this.query.findBatch(context,input.batchId);if(!found.ok)return found;if(!found.value)return err(missing(context,'Yedek karantina kaydı bulunamadı.'));
      if(found.value.status==='destroyed')return err(conflict(context,'Yedek karantina kaydı daha önce imha edilmiş.'));
      if(found.value.legalHold)return err(conflict(context,'Hukuki veya koruma bekletmesi bulunan yedek karantinası imha edilemez.'));
      if(found.value.status==='retained'&&Date.parse(found.value.retainUntil)>Date.parse(destroyedAt))return err(conflict(context,`Karantina saklama süresi ${found.value.retainUntil} tarihinde tamamlanacaktır.`));
      const verified=this.strongAuth.verify(context,{password:input.password,...(input.code?{code:input.code}:{})});if(!verified.ok)return verified;
      const resumed=found.value.status==='destroying';
      let destroying=found.value;
      if(found.value.status==='retained'){
        const begun=this.write.beginDestruction(context,{id:found.value.id,expectedUpdatedAt:found.value.updatedAt,updatedAt:destroyedAt});if(!begun.ok)return begun;
        if(!begun.value)return err(conflict(context,'Yedek karantina kaydı eşzamanlı değişti; imha başlatılmadı.'));
        destroying=begun.value;
      }
      const destroyed=this.files.destroy({batchId:destroying.id,quarantineDirectory:destroying.quarantineDirectory,manifestPath:destroying.manifestPath,destroyedAt},context.correlationId);if(!destroyed.ok)return destroyed;
      const completed=this.write.completeDestruction(context,{id:destroying.id,expectedUpdatedAt:destroying.updatedAt,destroyedAt,destroyedArtifacts:destroyed.value.destroyedArtifacts,destroyedBytes:destroyed.value.destroyedBytes});if(!completed.ok)return completed;
      if(!completed.value)return err(conflict(context,'Karantina dosyaları imha edildi ancak denetim kaydı eşzamanlı değişti; işlem yeniden uzlaştırılmalıdır.'));
      return ok({batch:completed.value,destroyedArtifacts:destroyed.value.destroyedArtifacts,destroyedBytes:destroyed.value.destroyedBytes,resumed:resumed||destroyed.value.resumed});
    });
  }
}
