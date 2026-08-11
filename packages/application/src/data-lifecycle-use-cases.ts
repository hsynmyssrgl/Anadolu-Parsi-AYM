import { isAdministrativeRole } from '@ppt/security';
import {
  ERROR_CODES,
  asIsoDateTime,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type EventId,
  type FamilyId,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import type {
  ArchiveDataResourceInput,
  CancelDataPurgeInput,
  CreateDataRetentionPolicyInput,
  DataLifecycleRecordView,
  DataLifecycleResourceType,
  DataRetentionPolicyView,
  ExecuteDataPurgeInput,
  FamilyRole,
  RecordPrivacy,
  RequestDataPurgeInput,
  RestoreDataResourceInput,
  SetDataLegalHoldInput
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type { AuthorizationAction } from '@ppt/security';
import {
  EnforceSourceDeletionPropagationUseCase,
  type SourceDeletionPropagationWriteScope
} from './source-deletion-propagation-use-cases.js';

export interface DataLifecycleApplicationContext {
  readonly familyId:FamilyId;
  readonly actor:{readonly userId:UserId;readonly role:FamilyRole;readonly personId?:PersonId};
  readonly correlationId:CorrelationId;
}
export interface DataLifecycleResourceDescriptor {
  readonly resourceType:DataLifecycleResourceType;
  readonly resourceId:string;
  readonly title:string;
  readonly ownerPersonId:PersonId;
  readonly privacy:RecordPrivacy;
}
export interface DataRetentionPolicyRecord extends DataRetentionPolicyView { readonly createdAt:IsoDateTime; }
export interface DataLifecycleRecord {
  readonly resourceType:DataLifecycleResourceType;
  readonly resourceId:string;
  readonly ownerPersonId?:PersonId;
  readonly privacy?:RecordPrivacy;
  readonly state:'active'|'archived'|'purge_scheduled'|'purged';
  readonly policyId?:string;
  readonly archivedAt?:IsoDateTime;
  readonly purgeEligibleAt?:IsoDateTime;
  readonly purgeRequestedAt?:IsoDateTime;
  readonly purgeExecuteAfter?:IsoDateTime;
  readonly legalHold:boolean;
  readonly holdReason?:string;
  readonly purgedAt?:IsoDateTime;
  readonly updatedAt:IsoDateTime;
  readonly backupPropagationPending:boolean;
}
export interface DataLifecycleQueryPort {
  listPolicies(context:DataLifecycleApplicationContext):Result<readonly DataRetentionPolicyView[],AppError>;
  listLifecycle(context:DataLifecycleApplicationContext):Result<readonly DataLifecycleRecordView[],AppError>;
}
export interface DataLifecycleWriteScope extends SourceDeletionPropagationWriteScope {
  readonly occurredAt:IsoDateTime;
  findResource(resourceType:DataLifecycleResourceType,resourceId:string):Result<DataLifecycleResourceDescriptor|null,AppError>;
  findPolicy(policyId:string):Result<DataRetentionPolicyRecord|null,AppError>;
  findLifecycle(resourceType:DataLifecycleResourceType,resourceId:string):Result<DataLifecycleRecord|null,AppError>;
  authorize(input:{readonly action:AuthorizationAction;readonly resourceType:DataLifecycleResourceType;readonly resourceId:string;readonly ownerPersonId:PersonId;readonly privacy:RecordPrivacy}):Result<boolean,AppError>;
  insertPolicy(policy:DataRetentionPolicyRecord):Result<void,AppError>;
  upsertLifecycle(record:DataLifecycleRecord):Result<void,AppError>;
  appendAudit(input:{readonly id:string;readonly action:string;readonly resourceType:string;readonly resourceId:string;readonly occurredAt:IsoDateTime;readonly actorId:UserId}):Result<string,AppError>;
  enqueueEvent<T>(event:DomainEvent<T>):Result<void,AppError>;
}
export interface DataLifecycleUnitOfWork {
  execute<T>(context:DataLifecycleApplicationContext,operation:(scope:DataLifecycleWriteScope)=>Result<T,AppError>):Result<T,AppError>;
}
export interface StrongAuthenticationPort {
  verify(context:DataLifecycleApplicationContext,input:{readonly password:string;readonly code?:string}):Result<void,AppError>;
}

const invalid=(c:DataLifecycleApplicationContext,message:string)=>createAppError({code:ERROR_CODES.CORE_INVALID_ARGUMENT,message,category:'validation',correlationId:c.correlationId});
const denied=(c:DataLifecycleApplicationContext)=>createAppError({code:ERROR_CODES.AUTHORIZATION_DENIED,message:'Bu veri yaşam döngüsü işlemi için yetkiniz bulunmuyor.',category:'authorization',correlationId:c.correlationId});
const missing=(c:DataLifecycleApplicationContext,message:string)=>createAppError({code:ERROR_CODES.RESOURCE_NOT_FOUND,message,category:'not_found',correlationId:c.correlationId});
const conflict=(c:DataLifecycleApplicationContext,message:string)=>createAppError({code:ERROR_CODES.RESOURCE_CONFLICT,message,category:'conflict',correlationId:c.correlationId});
const addDays=(value:IsoDateTime,days:number):IsoDateTime=>asIsoDateTime(new Date(Date.parse(value)+days*86_400_000).toISOString());
const elapsed=(candidate:IsoDateTime,now:IsoDateTime):boolean=>Date.parse(candidate)<=Date.parse(now);
export const purgeRequestConfirmation=(resourceType:DataLifecycleResourceType,resourceId:string)=>`KALICI İMHA ${resourceType}/${resourceId}`;
export const purgeExecutionConfirmation=(resourceType:DataLifecycleResourceType,resourceId:string)=>`GERİ ALINAMAZ İMHA ${resourceType}/${resourceId}`;
const resolveLifecycle=(resource:DataLifecycleResourceDescriptor,current:DataLifecycleRecord|null,now:IsoDateTime):DataLifecycleRecord=>current??{
  resourceType:resource.resourceType,resourceId:resource.resourceId,ownerPersonId:resource.ownerPersonId,privacy:resource.privacy,
  state:'active',legalHold:false,updatedAt:now,backupPropagationPending:false
};
const ensureAuthorized=(scope:DataLifecycleWriteScope,context:DataLifecycleApplicationContext,resource:DataLifecycleResourceDescriptor,action:AuthorizationAction):Result<void,AppError>=>{
  const decision=scope.authorize({action,resourceType:resource.resourceType,resourceId:resource.resourceId,ownerPersonId:resource.ownerPersonId,privacy:resource.privacy});
  return decision.ok?(decision.value?ok(undefined):err(denied(context))):decision;
};

export class ListDataRetentionPoliciesUseCase { constructor(private readonly query:DataLifecycleQueryPort){} execute(context:DataLifecycleApplicationContext){return this.query.listPolicies(context);} }
export class ListDataLifecycleRecordsUseCase { constructor(private readonly query:DataLifecycleQueryPort){} execute(context:DataLifecycleApplicationContext){return this.query.listLifecycle(context);} }

export class CreateDataRetentionPolicyUseCase {
  constructor(private readonly unit:DataLifecycleUnitOfWork){}
  execute(input:{readonly context:DataLifecycleApplicationContext;readonly command:CreateDataRetentionPolicyInput;readonly identifiers:{policyId:string;auditId:string}}):Result<DataRetentionPolicyView,AppError>{
    if(!isAdministrativeRole(input.context.actor.role))return err(denied(input.context));
    const name=input.command.name.trim();
    const resourceTypes=[...new Set(input.command.resourceTypes)];
    if(name.length<3||name.length>100)return err(invalid(input.context,'Politika adı 3 ile 100 karakter arasında olmalıdır.'));
    if(resourceTypes.length===0)return err(invalid(input.context,'En az bir kayıt türü seçilmelidir.'));
    if(!Number.isInteger(input.command.retentionDays)||input.command.retentionDays<1||input.command.retentionDays>36500)return err(invalid(input.context,'Saklama süresi 1 ile 36500 gün arasında olmalıdır.'));
    if(!Number.isInteger(input.command.graceDays)||input.command.graceDays<1||input.command.graceDays>365)return err(invalid(input.context,'Geri alma süresi 1 ile 365 gün arasında olmalıdır.'));
    return this.unit.execute(input.context,scope=>{
      const policy:DataRetentionPolicyRecord={id:input.identifiers.policyId,name,resourceTypes,retentionDays:input.command.retentionDays,graceDays:input.command.graceDays,requiresStrongAuth:input.command.requiresStrongAuth!==false,createdAt:scope.occurredAt};
      const saved=scope.insertPolicy(policy);if(!saved.ok)return saved;
      const audit=scope.appendAudit({id:input.identifiers.auditId,action:'data.retention_policy_created',resourceType:'data_retention_policy',resourceId:policy.id,occurredAt:scope.occurredAt,actorId:input.context.actor.userId});
      return audit.ok?ok(policy):audit;
    });
  }
}

export class ArchiveDataResourceUseCase {
  constructor(private readonly unit:DataLifecycleUnitOfWork){}
  execute(input:{readonly context:DataLifecycleApplicationContext;readonly command:ArchiveDataResourceInput;readonly identifiers:{auditId:string;outboxEventId:EventId}}):Result<DataLifecycleRecord,AppError>{
    return this.unit.execute(input.context,scope=>{
      const resource=scope.findResource(input.command.resourceType,input.command.resourceId);if(!resource.ok)return resource;if(!resource.value)return err(missing(input.context,'Arşivlenecek kayıt bulunamadı.'));
      const authorized=ensureAuthorized(scope,input.context,resource.value,'delete');if(!authorized.ok)return authorized;
      const current=scope.findLifecycle(resource.value.resourceType,resource.value.resourceId);if(!current.ok)return current;
      if(current.value?.state==='purged')return err(conflict(input.context,'Kalıcı olarak imha edilmiş kayıt arşivlenemez.'));
      const policy=input.command.policyId?scope.findPolicy(input.command.policyId):ok(null);if(!policy.ok)return policy;
      if(input.command.policyId&&!policy.value)return err(missing(input.context,'Saklama politikası bulunamadı.'));
      if(policy.value&&!policy.value.resourceTypes.includes(resource.value.resourceType))return err(invalid(input.context,'Seçilen saklama politikası bu kayıt türünü kapsamıyor.'));
      const base=resolveLifecycle(resource.value,current.value,scope.occurredAt);
      const {purgeRequestedAt:_purgeRequestedAt,purgeExecuteAfter:_purgeExecuteAfter,purgedAt:_purgedAt,...archiveBase}=base;
      const next:DataLifecycleRecord={...archiveBase,state:'archived',...(policy.value?{policyId:policy.value.id}:{}),archivedAt:scope.occurredAt,...(policy.value?{purgeEligibleAt:addDays(scope.occurredAt,policy.value.retentionDays)}:{}),updatedAt:scope.occurredAt,backupPropagationPending:false};
      const saved=scope.upsertLifecycle(next);if(!saved.ok)return saved;
      const audit=scope.appendAudit({id:input.identifiers.auditId,action:'data.resource_archived',resourceType:resource.value.resourceType,resourceId:resource.value.resourceId,occurredAt:scope.occurredAt,actorId:input.context.actor.userId});if(!audit.ok)return audit;
      const event=scope.enqueueEvent({eventId:input.identifiers.outboxEventId,eventType:'data.resource.archived',eventVersion:1,aggregateType:resource.value.resourceType,aggregateId:resource.value.resourceId,occurredAt:scope.occurredAt,actorId:input.context.actor.userId,correlationId:input.context.correlationId,payload:{resourceType:resource.value.resourceType,resourceId:resource.value.resourceId,policyId:policy.value?.id}});
      return event.ok?ok(next):event;
    });
  }
}

export class RestoreDataResourceUseCase {
  constructor(private readonly unit:DataLifecycleUnitOfWork){}
  execute(input:{readonly context:DataLifecycleApplicationContext;readonly command:RestoreDataResourceInput;readonly identifiers:{auditId:string;outboxEventId:EventId}}):Result<DataLifecycleRecord,AppError>{
    return this.unit.execute(input.context,scope=>{
      const resource=scope.findResource(input.command.resourceType,input.command.resourceId);if(!resource.ok)return resource;if(!resource.value)return err(missing(input.context,'Geri yüklenecek kayıt bulunamadı.'));
      const authorized=ensureAuthorized(scope,input.context,resource.value,'update');if(!authorized.ok)return authorized;
      const current=scope.findLifecycle(resource.value.resourceType,resource.value.resourceId);if(!current.ok)return current;if(!current.value||current.value.state==='active')return err(conflict(input.context,'Kayıt zaten etkin.'));
      if(current.value.state==='purged')return err(conflict(input.context,'Kalıcı olarak imha edilmiş kayıt geri yüklenemez.'));
      const {archivedAt:_archivedAt,purgeEligibleAt:_purgeEligibleAt,purgeRequestedAt:_purgeRequestedAt,purgeExecuteAfter:_purgeExecuteAfter,purgedAt:_purgedAt,...restoreBase}=current.value;
      const next:DataLifecycleRecord={...restoreBase,state:'active',updatedAt:scope.occurredAt,backupPropagationPending:false};
      const saved=scope.upsertLifecycle(next);if(!saved.ok)return saved;
      const audit=scope.appendAudit({id:input.identifiers.auditId,action:'data.resource_restored',resourceType:resource.value.resourceType,resourceId:resource.value.resourceId,occurredAt:scope.occurredAt,actorId:input.context.actor.userId});if(!audit.ok)return audit;
      const event=scope.enqueueEvent({eventId:input.identifiers.outboxEventId,eventType:'data.resource.restored',eventVersion:1,aggregateType:resource.value.resourceType,aggregateId:resource.value.resourceId,occurredAt:scope.occurredAt,actorId:input.context.actor.userId,correlationId:input.context.correlationId,payload:{resourceType:resource.value.resourceType,resourceId:resource.value.resourceId}});
      return event.ok?ok(next):event;
    });
  }
}

export class RequestDataPurgeUseCase {
  constructor(private readonly unit:DataLifecycleUnitOfWork,private readonly strongAuth:StrongAuthenticationPort){}
  execute(input:{readonly context:DataLifecycleApplicationContext;readonly command:RequestDataPurgeInput;readonly identifiers:{auditId:string}}):Result<DataLifecycleRecord,AppError>{
    if(input.command.confirmation!==purgeRequestConfirmation(input.command.resourceType,input.command.resourceId))return err(invalid(input.context,'Kalıcı imha onay metni kayıt kimliğiyle birebir eşleşmelidir.'));
    const reauthenticated=this.strongAuth.verify(input.context,{password:input.command.password,...(input.command.code?{code:input.command.code}:{})});if(!reauthenticated.ok)return reauthenticated;
    return this.unit.execute(input.context,scope=>{
      const resource=scope.findResource(input.command.resourceType,input.command.resourceId);if(!resource.ok)return resource;if(!resource.value)return err(missing(input.context,'İmha talebi oluşturulacak kayıt bulunamadı.'));
      const authorized=ensureAuthorized(scope,input.context,resource.value,'delete');if(!authorized.ok)return authorized;
      const current=scope.findLifecycle(resource.value.resourceType,resource.value.resourceId);if(!current.ok)return current;if(!current.value||current.value.state!=='archived')return err(conflict(input.context,'Kalıcı imha talebi yalnız arşivlenmiş kayıt için oluşturulabilir.'));
      if(current.value.legalHold)return err(conflict(input.context,'Kayıtta hukuki/koruma bekletmesi bulunduğu için imha talebi oluşturulamaz.'));
      if(!current.value.policyId||!current.value.purgeEligibleAt)return err(conflict(input.context,'Kayıda saklama politikası atanmadığı için kalıcı imha planlanamaz.'));
      if(!elapsed(current.value.purgeEligibleAt,scope.occurredAt))return err(conflict(input.context,'Saklama süresi henüz dolmadı.'));
      const policy=scope.findPolicy(current.value.policyId);if(!policy.ok)return policy;if(!policy.value)return err(missing(input.context,'Kayıda bağlı saklama politikası bulunamadı.'));
      const next:DataLifecycleRecord={...current.value,state:'purge_scheduled',purgeRequestedAt:scope.occurredAt,purgeExecuteAfter:addDays(scope.occurredAt,policy.value.graceDays),updatedAt:scope.occurredAt};
      const saved=scope.upsertLifecycle(next);if(!saved.ok)return saved;
      const audit=scope.appendAudit({id:input.identifiers.auditId,action:'data.purge_requested',resourceType:resource.value.resourceType,resourceId:resource.value.resourceId,occurredAt:scope.occurredAt,actorId:input.context.actor.userId});
      return audit.ok?ok(next):audit;
    });
  }
}

export class CancelDataPurgeUseCase {
  constructor(private readonly unit:DataLifecycleUnitOfWork){}
  execute(input:{readonly context:DataLifecycleApplicationContext;readonly command:CancelDataPurgeInput;readonly identifiers:{auditId:string}}):Result<DataLifecycleRecord,AppError>{
    return this.unit.execute(input.context,scope=>{
      const resource=scope.findResource(input.command.resourceType,input.command.resourceId);if(!resource.ok)return resource;if(!resource.value)return err(missing(input.context,'İmha talebi iptal edilecek kayıt bulunamadı.'));
      const authorized=ensureAuthorized(scope,input.context,resource.value,'delete');if(!authorized.ok)return authorized;
      const current=scope.findLifecycle(resource.value.resourceType,resource.value.resourceId);if(!current.ok)return current;if(!current.value||current.value.state!=='purge_scheduled')return err(conflict(input.context,'Etkin kalıcı imha talebi bulunmuyor.'));
      const {purgeRequestedAt:_purgeRequestedAt,purgeExecuteAfter:_purgeExecuteAfter,...cancelBase}=current.value;
      const next:DataLifecycleRecord={...cancelBase,state:'archived',updatedAt:scope.occurredAt};
      const saved=scope.upsertLifecycle(next);if(!saved.ok)return saved;
      const audit=scope.appendAudit({id:input.identifiers.auditId,action:'data.purge_cancelled',resourceType:resource.value.resourceType,resourceId:resource.value.resourceId,occurredAt:scope.occurredAt,actorId:input.context.actor.userId});
      return audit.ok?ok(next):audit;
    });
  }
}

export class ExecuteDataPurgeUseCase {
  constructor(
    private readonly unit:DataLifecycleUnitOfWork,
    private readonly strongAuth:StrongAuthenticationPort,
    private readonly propagation:EnforceSourceDeletionPropagationUseCase
  ){}
  execute(input:{readonly context:DataLifecycleApplicationContext;readonly command:ExecuteDataPurgeInput;readonly identifiers:{auditId:string;outboxEventId:EventId}}):Result<DataLifecycleRecord,AppError>{
    if(input.command.confirmation!==purgeExecutionConfirmation(input.command.resourceType,input.command.resourceId))return err(invalid(input.context,'Geri alınamaz imha onay metni kayıt kimliğiyle birebir eşleşmelidir.'));
    const reauthenticated=this.strongAuth.verify(input.context,{password:input.command.password,...(input.command.code?{code:input.command.code}:{})});if(!reauthenticated.ok)return reauthenticated;
    return this.unit.execute(input.context,scope=>{
      const resource=scope.findResource(input.command.resourceType,input.command.resourceId);if(!resource.ok)return resource;if(!resource.value)return err(missing(input.context,'İmha edilecek kayıt bulunamadı.'));
      const authorized=ensureAuthorized(scope,input.context,resource.value,'delete');if(!authorized.ok)return authorized;
      const current=scope.findLifecycle(resource.value.resourceType,resource.value.resourceId);if(!current.ok)return current;if(!current.value||current.value.state!=='purge_scheduled'||!current.value.purgeExecuteAfter)return err(conflict(input.context,'Kayıt kalıcı imha için planlanmamış.'));
      if(current.value.legalHold)return err(conflict(input.context,'Kayıtta hukuki/koruma bekletmesi bulunduğu için imha gerçekleştirilemez.'));
      if(!elapsed(current.value.purgeExecuteAfter,scope.occurredAt))return err(conflict(input.context,'Geri alma süresi henüz dolmadı.'));
      const propagated=this.propagation.execute({
        scope,
        source:{familyId:input.context.familyId,resourceType:resource.value.resourceType,resourceId:resource.value.resourceId,purgedAt:scope.occurredAt},
        correlationId:input.context.correlationId
      });if(!propagated.ok)return propagated;
      const next:DataLifecycleRecord={resourceType:resource.value.resourceType,resourceId:resource.value.resourceId,ownerPersonId:resource.value.ownerPersonId,privacy:resource.value.privacy,state:'purged',...(current.value.policyId?{policyId:current.value.policyId}:{}),legalHold:false,purgedAt:scope.occurredAt,updatedAt:scope.occurredAt,backupPropagationPending:true};
      const saved=scope.upsertLifecycle(next);if(!saved.ok)return saved;
      const audit=scope.appendAudit({id:input.identifiers.auditId,action:'data.resource_purged',resourceType:resource.value.resourceType,resourceId:resource.value.resourceId,occurredAt:scope.occurredAt,actorId:input.context.actor.userId});if(!audit.ok)return audit;
      const event=scope.enqueueEvent({eventId:input.identifiers.outboxEventId,eventType:'data.resource.purged',eventVersion:1,aggregateType:resource.value.resourceType,aggregateId:resource.value.resourceId,occurredAt:scope.occurredAt,actorId:input.context.actor.userId,correlationId:input.context.correlationId,payload:{resourceType:resource.value.resourceType,resourceId:resource.value.resourceId,propagationPlanHash:propagated.value.plan.planHash,localPropagationComplete:propagated.value.evidence.localPropagationComplete,backupPropagationPending:propagated.value.evidence.backupPropagationPending,ownerOutcomes:propagated.value.plan.ownerOutcomes}});
      return event.ok?ok(next):event;
    });
  }
}

export class SetDataLegalHoldUseCase {
  constructor(private readonly unit:DataLifecycleUnitOfWork,private readonly strongAuth:StrongAuthenticationPort){}
  execute(input:{readonly context:DataLifecycleApplicationContext;readonly command:SetDataLegalHoldInput;readonly identifiers:{auditId:string}}):Result<DataLifecycleRecord,AppError>{
    const reason=input.command.reason.trim();if(input.command.enabled&&(reason.length<8||reason.length>500))return err(invalid(input.context,'Bekletme gerekçesi 8 ile 500 karakter arasında olmalıdır.'));
    const reauthenticated=this.strongAuth.verify(input.context,{password:input.command.password,...(input.command.code?{code:input.command.code}:{})});if(!reauthenticated.ok)return reauthenticated;
    return this.unit.execute(input.context,scope=>{
      const resource=scope.findResource(input.command.resourceType,input.command.resourceId);if(!resource.ok)return resource;if(!resource.value)return err(missing(input.context,'Bekletme uygulanacak kayıt bulunamadı.'));
      const authorized=ensureAuthorized(scope,input.context,resource.value,'delete');if(!authorized.ok)return authorized;
      const current=scope.findLifecycle(resource.value.resourceType,resource.value.resourceId);if(!current.ok)return current;
      const base=resolveLifecycle(resource.value,current.value,scope.occurredAt);if(base.state==='purged')return err(conflict(input.context,'İmha edilmiş kayda bekletme uygulanamaz.'));
      const {holdReason:_holdReason,...holdBase}=base;
      const next:DataLifecycleRecord={...holdBase,legalHold:input.command.enabled,...(input.command.enabled?{holdReason:reason}:{}),updatedAt:scope.occurredAt};
      const saved=scope.upsertLifecycle(next);if(!saved.ok)return saved;
      const audit=scope.appendAudit({id:input.identifiers.auditId,action:input.command.enabled?'data.legal_hold_enabled':'data.legal_hold_disabled',resourceType:resource.value.resourceType,resourceId:resource.value.resourceId,occurredAt:scope.occurredAt,actorId:input.context.actor.userId});
      return audit.ok?ok(next):audit;
    });
  }
}
