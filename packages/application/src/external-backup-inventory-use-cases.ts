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
  AttestExternalBackupCopyDestroyedInput,
  ExternalBackupCopyView,
  ExternalBackupInventorySummaryView,
  FamilyRole,
  RegisterExternalBackupCopyInput,
  ReviewExternalBackupCopyInput,
  SetExternalBackupCopyLegalHoldInput
} from '@ppt/domain';
import type { StrongAuthenticationPort } from './data-lifecycle-use-cases.js';

export interface ExternalBackupInventoryApplicationContext {
  readonly familyId:FamilyId;
  readonly actor:{readonly userId:UserId;readonly role:FamilyRole;readonly personId?:PersonId};
  readonly correlationId:CorrelationId;
}
export interface ExternalBackupInventoryQueryPort {
  listCopies(context:ExternalBackupInventoryApplicationContext,limit:number):Result<readonly ExternalBackupCopyView[],AppError>;
  findCopy(context:ExternalBackupInventoryApplicationContext,id:string):Result<ExternalBackupCopyView|null,AppError>;
}
export interface ExternalBackupInventoryWritePort {
  insertCopy(context:ExternalBackupInventoryApplicationContext,row:ExternalBackupCopyView,attestation:{readonly id:string;readonly note:string;readonly actorId:string;readonly occurredAt:string}):Result<void,AppError>;
  reviewCopy(context:ExternalBackupInventoryApplicationContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly status:'active'|'unreachable'|'retired';readonly containsHistoricalDataRisk:boolean;readonly reviewIntervalDays:number;readonly note:string;readonly reviewedAt:string;readonly nextReviewAt:string;readonly actorId:string;readonly attestationId:string}):Result<ExternalBackupCopyView|null,AppError>;
  setLegalHold(context:ExternalBackupInventoryApplicationContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly enabled:boolean;readonly reason?:string;readonly updatedAt:string;readonly actorId:string;readonly attestationId:string}):Result<ExternalBackupCopyView|null,AppError>;
  attestDestroyed(context:ExternalBackupInventoryApplicationContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly note:string;readonly evidenceSha256?:string;readonly destroyedAt:string;readonly actorId:string;readonly attestationId:string}):Result<ExternalBackupCopyView|null,AppError>;
}

const denied=(context:ExternalBackupInventoryApplicationContext)=>createAppError({code:ERROR_CODES.AUTHORIZATION_DENIED,message:'Uygulama dışı yedek envanterini yalnız aile yöneticisi kullanabilir.',category:'authorization',correlationId:context.correlationId});
const invalid=(context:ExternalBackupInventoryApplicationContext,message:string)=>createAppError({code:ERROR_CODES.CORE_INVALID_ARGUMENT,message,category:'validation',correlationId:context.correlationId});
const missing=(context:ExternalBackupInventoryApplicationContext,message:string)=>createAppError({code:ERROR_CODES.RESOURCE_NOT_FOUND,message,category:'not_found',correlationId:context.correlationId});
const conflict=(context:ExternalBackupInventoryApplicationContext,message:string)=>createAppError({code:ERROR_CODES.RESOURCE_CONFLICT,message,category:'conflict',correlationId:context.correlationId});
const requireAdmin=<T>(context:ExternalBackupInventoryApplicationContext,operation:()=>Result<T,AppError>):Result<T,AppError>=>isAdministrativeRole(context.actor.role)?operation():err(denied(context));
const addDays=(iso:string,days:number)=>new Date(Date.parse(iso)+days*86_400_000).toISOString();
const validInterval=(value:number)=>Number.isInteger(value)&&value>=1&&value<=3650;
const validSha256=(value:string)=>/^[a-f0-9]{64}$/i.test(value);
export const externalBackupReviewConfirmation=(id:string)=>`HARİCİ YEDEK TEYİT ${id}`;
export const externalBackupDestructionConfirmation=(id:string)=>`HARİCİ YEDEK İMHA ${id}`;

export class ListExternalBackupCopiesUseCase {
  constructor(private readonly query:ExternalBackupInventoryQueryPort){}
  execute(context:ExternalBackupInventoryApplicationContext,limit=100){return requireAdmin(context,()=>this.query.listCopies(context,Math.max(1,Math.min(500,Math.trunc(limit)))));}
}
export class GetExternalBackupInventorySummaryUseCase {
  constructor(private readonly query:ExternalBackupInventoryQueryPort){}
  execute(context:ExternalBackupInventoryApplicationContext,generatedAt:string):Result<ExternalBackupInventorySummaryView,AppError>{
    return requireAdmin(context,()=>{
      const listed=this.query.listCopies(context,500);if(!listed.ok)return listed;
      const values=listed.value;
      const count=(status:ExternalBackupCopyView['status'])=>values.filter(item=>item.status===status).length;
      const overdue=values.filter(item=>item.status!=='destroyed'&&Date.parse(item.nextReviewAt)<Date.parse(generatedAt)).length;
      const historicalDataRisk=values.filter(item=>item.status!=='destroyed'&&item.containsHistoricalDataRisk).length;
      return ok({total:values.length,active:count('active'),unreachable:count('unreachable'),retired:count('retired'),destroyed:count('destroyed'),overdue,legalHold:values.filter(item=>item.legalHold).length,historicalDataRisk,reviewRequired:overdue>0||historicalDataRisk>0||count('unreachable')>0,generatedAt});
    });
  }
}
export class RegisterExternalBackupCopyUseCase {
  constructor(private readonly write:ExternalBackupInventoryWritePort){}
  execute(context:ExternalBackupInventoryApplicationContext,input:RegisterExternalBackupCopyInput,identifiers:{readonly copyId:string;readonly attestationId:string},createdAt:string):Result<ExternalBackupCopyView,AppError>{
    return requireAdmin(context,()=>{
      const label=input.label.trim(),locationHint=input.locationHint.trim(),custodian=input.custodian.trim();
      if(label.length<3||label.length>120)return err(invalid(context,'Yedek kopya adı 3 ile 120 karakter arasında olmalıdır.'));
      if(locationHint.length<2||locationHint.length>500)return err(invalid(context,'Kopya konum açıklaması 2 ile 500 karakter arasında olmalıdır.'));
      if(custodian.length<2||custodian.length>120)return err(invalid(context,'Kopyadan sorumlu kişi veya birim 2 ile 120 karakter arasında olmalıdır.'));
      if(!validInterval(input.reviewIntervalDays))return err(invalid(context,'Teyit aralığı 1 ile 3650 gün arasında olmalıdır.'));
      if(Number.isNaN(Date.parse(createdAt)))return err(invalid(context,'Kayıt zamanı geçersizdir.'));
      const row:ExternalBackupCopyView={id:identifiers.copyId,label,kind:input.kind,locationHint,custodian,status:'active',containsHistoricalDataRisk:input.containsHistoricalDataRisk??true,reviewIntervalDays:input.reviewIntervalDays,nextReviewAt:addDays(createdAt,input.reviewIntervalDays),legalHold:false,evidenceVerificationStatus:'none',createdAt,updatedAt:createdAt};
      const inserted=this.write.insertCopy(context,row,{id:identifiers.attestationId,note:'Uygulama dışı yedek kopya envantere kaydedildi; fiziksel içerik otomatik doğrulanmadı.',actorId:context.actor.userId,occurredAt:createdAt});
      return inserted.ok?ok(row):inserted;
    });
  }
}
export class ReviewExternalBackupCopyUseCase {
  constructor(private readonly query:ExternalBackupInventoryQueryPort,private readonly write:ExternalBackupInventoryWritePort,private readonly strongAuth:StrongAuthenticationPort){}
  execute(context:ExternalBackupInventoryApplicationContext,input:ReviewExternalBackupCopyInput,attestationId:string,reviewedAt:string):Result<ExternalBackupCopyView,AppError>{
    return requireAdmin(context,()=>{
      if(input.confirmation!==externalBackupReviewConfirmation(input.id))return err(invalid(context,`Kopya teyidi için tam olarak “${externalBackupReviewConfirmation(input.id)}” yazılmalıdır.`));
      const note=input.note.trim();if(note.length<8||note.length>1000)return err(invalid(context,'Teyit notu 8 ile 1000 karakter arasında olmalıdır.'));
      if(!validInterval(input.reviewIntervalDays))return err(invalid(context,'Teyit aralığı 1 ile 3650 gün arasında olmalıdır.'));
      const current=this.query.findCopy(context,input.id);if(!current.ok)return current;if(!current.value)return err(missing(context,'Uygulama dışı yedek kopya bulunamadı.'));
      if(current.value.status==='destroyed')return err(conflict(context,'İmha edilmiş kopya yeniden teyit edilemez; yeni fiziksel kopya ayrı kayıt olmalıdır.'));
      const verified=this.strongAuth.verify(context,{password:input.password,...(input.code?{code:input.code}:{})});if(!verified.ok)return verified;
      const updated=this.write.reviewCopy(context,{id:input.id,expectedUpdatedAt:current.value.updatedAt,status:input.status,containsHistoricalDataRisk:input.containsHistoricalDataRisk,reviewIntervalDays:input.reviewIntervalDays,note,reviewedAt,nextReviewAt:addDays(reviewedAt,input.reviewIntervalDays),actorId:context.actor.userId,attestationId});
      if(!updated.ok)return updated;return updated.value?ok(updated.value):err(conflict(context,'Kopya kaydı eşzamanlı değişti; teyit kaydedilmedi.'));
    });
  }
}
export class SetExternalBackupCopyLegalHoldUseCase {
  constructor(private readonly query:ExternalBackupInventoryQueryPort,private readonly write:ExternalBackupInventoryWritePort,private readonly strongAuth:StrongAuthenticationPort){}
  execute(context:ExternalBackupInventoryApplicationContext,input:SetExternalBackupCopyLegalHoldInput,attestationId:string,updatedAt:string):Result<ExternalBackupCopyView,AppError>{
    return requireAdmin(context,()=>{
      const reason=input.reason?.trim();if(input.enabled&&(!reason||reason.length<8||reason.length>500))return err(invalid(context,'Bekletme gerekçesi 8 ile 500 karakter arasında olmalıdır.'));
      const current=this.query.findCopy(context,input.id);if(!current.ok)return current;if(!current.value)return err(missing(context,'Uygulama dışı yedek kopya bulunamadı.'));
      if(current.value.status==='destroyed')return err(conflict(context,'İmha edilmiş kopyanın bekletmesi değiştirilemez.'));
      const verified=this.strongAuth.verify(context,{password:input.password,...(input.code?{code:input.code}:{})});if(!verified.ok)return verified;
      const updated=this.write.setLegalHold(context,{id:input.id,expectedUpdatedAt:current.value.updatedAt,enabled:input.enabled,...(input.enabled&&reason?{reason}:{}),updatedAt,actorId:context.actor.userId,attestationId});
      if(!updated.ok)return updated;return updated.value?ok(updated.value):err(conflict(context,'Kopya kaydı eşzamanlı değişti; bekletme güncellenmedi.'));
    });
  }
}
export class AttestExternalBackupCopyDestroyedUseCase {
  constructor(private readonly query:ExternalBackupInventoryQueryPort,private readonly write:ExternalBackupInventoryWritePort,private readonly strongAuth:StrongAuthenticationPort){}
  execute(context:ExternalBackupInventoryApplicationContext,input:AttestExternalBackupCopyDestroyedInput,attestationId:string,destroyedAt:string):Result<ExternalBackupCopyView,AppError>{
    return requireAdmin(context,()=>{
      if(input.confirmation!==externalBackupDestructionConfirmation(input.id))return err(invalid(context,`İmha teyidi için tam olarak “${externalBackupDestructionConfirmation(input.id)}” yazılmalıdır.`));
      const note=input.note.trim();if(note.length<12||note.length>1000)return err(invalid(context,'İmha teyit notu 12 ile 1000 karakter arasında olmalıdır.'));
      const evidence=input.evidenceSha256?.trim().toLowerCase();if(evidence&&!validSha256(evidence))return err(invalid(context,'Kanıt SHA-256 değeri 64 onaltılık karakter olmalıdır.'));
      const current=this.query.findCopy(context,input.id);if(!current.ok)return current;if(!current.value)return err(missing(context,'Uygulama dışı yedek kopya bulunamadı.'));
      if(current.value.status==='destroyed')return err(conflict(context,'Bu kopya için daha önce imha teyidi kaydedilmiş.'));
      if(current.value.legalHold)return err(conflict(context,'Hukuki veya koruma bekletmesi bulunan kopya imha edilmiş olarak işaretlenemez.'));
      const verified=this.strongAuth.verify(context,{password:input.password,...(input.code?{code:input.code}:{})});if(!verified.ok)return verified;
      const updated=this.write.attestDestroyed(context,{id:input.id,expectedUpdatedAt:current.value.updatedAt,note,...(evidence?{evidenceSha256:evidence}:{}),destroyedAt,actorId:context.actor.userId,attestationId});
      if(!updated.ok)return updated;return updated.value?ok(updated.value):err(conflict(context,'Kopya kaydı eşzamanlı değişti; imha teyidi kaydedilmedi.'));
    });
  }
}
