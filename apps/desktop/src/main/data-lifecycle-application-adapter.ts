import { ERROR_CODES, createAppError, err, ok, type AppError, type Result } from '@ppt/core';
import type {
  AuthApplicationUnitOfWork,
  AuthSessionPort,
  DataLifecycleApplicationContext,
  DataLifecycleQueryPort,
  DataLifecycleUnitOfWork,
  DataLifecycleWriteScope,
  PasswordService,
  SecondFactorService,
  StrongAuthenticationPort
} from '@ppt/application';
import type { DataLifecycleRecordView, DataRetentionPolicyView } from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  AccountRepositoryPort,
  AuditRepositoryPort,
  DataLifecycleRepositoryPort,
  ObjectPermissionRepositoryPort,
  OutboxRepositoryPort,
  RepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor,
  AccountRow,
  ObjectPermissionRow
} from '@ppt/repository-contracts';
import { CentralAuthorizationService, type AuthorizationAction, type AuthorizationGrant } from '@ppt/security';

export interface RepositoryBackedDataLifecycleDependencies {
  readonly transactionExecutor:TransactionExecutor;
  readonly dataLifecycleRepository:DataLifecycleRepositoryPort;
  readonly accountRepository:AccountRepositoryPort;
  readonly permissionRepository:ObjectPermissionRepositoryPort;
  readonly auditRepository:AuditRepositoryPort;
  readonly outboxRepository:OutboxRepositoryPort;
}
const repositoryContext=(context:DataLifecycleApplicationContext,transaction:TransactionContext):RepositoryExecutionContext=>({
  transaction:transaction.transaction,
  actor:{userId:context.actor.userId,roles:[context.actor.role],...(context.actor.personId?{personId:context.actor.personId}:{})},
  correlationId:context.correlationId,occurredAt:transaction.occurredAt
});
const activeAccount=(account:AccountRow,occurredAt:string)=>account.status==='active'&&Date.parse(account.startsAt)<=Date.parse(occurredAt)&&(!account.endsAt||Date.parse(account.endsAt)>=Date.parse(occurredAt));
const toGrant=(row:ObjectPermissionRow):AuthorizationGrant=>({id:row.id,subjectAccountId:row.subjectAccountId,resourceType:row.resourceType,resourceId:row.resourceId,actions:row.actions as readonly AuthorizationAction[],effect:row.effect,purpose:row.purpose,...(row.familyBranchId?{familyBranchId:row.familyBranchId}:{}),...(row.denialReason?{denialReason:row.denialReason}:{}),startsAt:row.startsAt,...(row.endsAt?{endsAt:row.endsAt}:{})});
interface Snapshot { readonly account:AccountRow; readonly grants:readonly AuthorizationGrant[]; }
const load=(dependencies:RepositoryBackedDataLifecycleDependencies,context:DataLifecycleApplicationContext,repository:RepositoryExecutionContext):Result<Snapshot,AppError>=>{
  const account=dependencies.accountRepository.findById(repository,context.actor.userId);if(!account.ok)return account;
  if(!account.value||!activeAccount(account.value,repository.occurredAt))return err(createAppError({code:ERROR_CODES.AUTHORIZATION_DENIED,message:'Veri yaşam döngüsü işlemleri için etkin üyelik gereklidir.',category:'authorization',correlationId:context.correlationId}));
  const grants=dependencies.permissionRepository.listActiveForSubject(repository,context.actor.userId,repository.occurredAt);
  return grants.ok?ok({account:account.value,grants:grants.value.map(toGrant)}):grants;
};
const allowed=(service:CentralAuthorizationService,snapshot:Snapshot,input:{action:AuthorizationAction;resourceType:string;resourceId:string;ownerPersonId:string;privacy:'private'|'selected_members'|'family';occurredAt:string})=>service.authorize({
  accountId:snapshot.account.id,role:snapshot.account.role as DataLifecycleApplicationContext['actor']['role'],action:input.action,
  resourceType:input.resourceType,resourceId:input.resourceId,occurredAt:input.occurredAt,
  ...(snapshot.account.personId?{actorPersonId:snapshot.account.personId}:{}),ownerPersonId:input.ownerPersonId,privacy:input.privacy,
  sensitiveDomain:input.resourceType==='finance_record'?'finance':'health',grants:snapshot.grants
}).allowed;

export class RepositoryBackedDataLifecycleQueryPort implements DataLifecycleQueryPort {
  readonly #authorization=new CentralAuthorizationService();
  constructor(private readonly dependencies:RepositoryBackedDataLifecycleDependencies){}
  listPolicies(context:DataLifecycleApplicationContext):ReturnType<DataLifecycleQueryPort['listPolicies']>{
    return this.dependencies.transactionExecutor.execute(context.correlationId,transaction=>{
      const repository=repositoryContext(context,transaction);const auth=load(this.dependencies,context,repository);if(!auth.ok)return auth;
      const policies=this.dependencies.dataLifecycleRepository.listPolicies(repository);
      return policies.ok?ok(policies.value.map((policy):DataRetentionPolicyView=>({...policy,resourceTypes:[...policy.resourceTypes]}))):policies;
    });
  }
  listLifecycle(context:DataLifecycleApplicationContext):ReturnType<DataLifecycleQueryPort['listLifecycle']>{
    return this.dependencies.transactionExecutor.execute(context.correlationId,transaction=>{
      const repository=repositoryContext(context,transaction);const auth=load(this.dependencies,context,repository);if(!auth.ok)return auth;
      const lifecycle=this.dependencies.dataLifecycleRepository.listLifecycle(repository);if(!lifecycle.ok)return lifecycle;
      const policies=this.dependencies.dataLifecycleRepository.listPolicies(repository);if(!policies.ok)return policies;
      const policyNames=new Map(policies.value.map(policy=>[policy.id,policy.name]));
      const output:DataLifecycleRecordView[]=[];
      for(const row of lifecycle.value){
        const descriptor=this.dependencies.dataLifecycleRepository.findResource(repository,row.resourceType,row.resourceId);if(!descriptor.ok)return descriptor;
        const ownerPersonId=descriptor.value?.ownerPersonId??row.ownerPersonId;
        const privacy=descriptor.value?.privacy??row.privacy;
        if(!ownerPersonId||!privacy)continue;
        if(!allowed(this.#authorization,auth.value,{action:'read',resourceType:row.resourceType,resourceId:row.resourceId,ownerPersonId,privacy,occurredAt:repository.occurredAt}))continue;
        const policyName=row.policyId?policyNames.get(row.policyId):undefined;
        output.push({resourceType:row.resourceType,resourceId:row.resourceId,title:descriptor.value?.title??'Kalıcı olarak imha edilmiş kayıt',ownerPersonId,privacy,state:row.state,
          ...(row.policyId?{policyId:row.policyId}:{}),...(policyName?{policyName}:{}),...(row.archivedAt?{archivedAt:row.archivedAt}:{}),...(row.purgeEligibleAt?{purgeEligibleAt:row.purgeEligibleAt}:{}),
          ...(row.purgeRequestedAt?{purgeRequestedAt:row.purgeRequestedAt}:{}),...(row.purgeExecuteAfter?{purgeExecuteAfter:row.purgeExecuteAfter}:{}),legalHold:row.legalHold,
          ...(row.holdReason?{holdReason:row.holdReason}:{}),...(row.purgedAt?{purgedAt:row.purgedAt}:{}),updatedAt:row.updatedAt,backupPropagationPending:row.backupPropagationPending});
      }
      return ok(output);
    });
  }
}

class Scope implements DataLifecycleWriteScope {
  readonly #authorization=new CentralAuthorizationService();
  readonly #snapshot:Result<Snapshot,AppError>;
  constructor(private readonly dependencies:RepositoryBackedDataLifecycleDependencies,private readonly context:DataLifecycleApplicationContext,private readonly repository:RepositoryExecutionContext,public readonly occurredAt:DataLifecycleWriteScope['occurredAt']){this.#snapshot=load(dependencies,context,repository);}
  findResource(resourceType:Parameters<DataLifecycleWriteScope['findResource']>[0],resourceId:string):ReturnType<DataLifecycleWriteScope['findResource']>{return this.dependencies.dataLifecycleRepository.findResource(this.repository,resourceType,resourceId);}
  findPolicy(policyId:string):ReturnType<DataLifecycleWriteScope['findPolicy']>{const result=this.dependencies.dataLifecycleRepository.findPolicy(this.repository,policyId);return result.ok?ok(result.value?{...result.value,resourceTypes:[...result.value.resourceTypes]}:null):result;}
  findLifecycle(resourceType:Parameters<DataLifecycleWriteScope['findLifecycle']>[0],resourceId:string):ReturnType<DataLifecycleWriteScope['findLifecycle']>{return this.dependencies.dataLifecycleRepository.findLifecycle(this.repository,resourceType,resourceId);}
  authorize(input:Parameters<DataLifecycleWriteScope['authorize']>[0]):ReturnType<DataLifecycleWriteScope['authorize']>{
    if(!this.#snapshot.ok)return this.#snapshot;
    return ok(allowed(this.#authorization,this.#snapshot.value,{...input,occurredAt:this.repository.occurredAt}));
  }
  insertPolicy(policy:Parameters<DataLifecycleWriteScope['insertPolicy']>[0]):ReturnType<DataLifecycleWriteScope['insertPolicy']>{return this.dependencies.dataLifecycleRepository.insertPolicy(this.repository,policy);}
  upsertLifecycle(record:Parameters<DataLifecycleWriteScope['upsertLifecycle']>[0]):ReturnType<DataLifecycleWriteScope['upsertLifecycle']>{return this.dependencies.dataLifecycleRepository.upsertLifecycle(this.repository,record);}
  purgeResource(resourceType:Parameters<DataLifecycleWriteScope['purgeResource']>[0],resourceId:string):ReturnType<DataLifecycleWriteScope['purgeResource']>{return this.dependencies.dataLifecycleRepository.purgeResource(this.repository,resourceType,resourceId);}
  appendAudit(input:Parameters<DataLifecycleWriteScope['appendAudit']>[0]):ReturnType<DataLifecycleWriteScope['appendAudit']>{return this.dependencies.auditRepository.append(this.repository,input);}
  enqueueEvent<T>(event:DomainEvent<T>):Result<void,AppError>{return this.dependencies.outboxRepository.enqueue(this.repository,event);}
}
export class RepositoryBackedDataLifecycleUnitOfWork implements DataLifecycleUnitOfWork {
  constructor(private readonly dependencies:RepositoryBackedDataLifecycleDependencies){}
  execute<T>(context:DataLifecycleApplicationContext,operation:(scope:DataLifecycleWriteScope)=>Result<T,AppError>):Result<T,AppError>{
    return this.dependencies.transactionExecutor.execute(context.correlationId,transaction=>operation(new Scope(this.dependencies,context,repositoryContext(context,transaction),transaction.occurredAt)));
  }
}

export class RepositoryBackedStrongAuthenticationPort implements StrongAuthenticationPort {
  constructor(private readonly authUnit:AuthApplicationUnitOfWork,private readonly passwordService:PasswordService,private readonly secondFactorService:SecondFactorService,private readonly session:AuthSessionPort){}
  verify(context:DataLifecycleApplicationContext,input:{readonly password:string;readonly code?:string}):Result<void,AppError>{
    const session=this.session.snapshot();
    const accountId=this.session.currentAccountId();
    if(!accountId)return err(createAppError({code:ERROR_CODES.AUTHENTICATION_REQUIRED,message:'Bu işlem için yeniden oturum açılmalıdır.',category:'authentication',correlationId:context.correlationId}));
    return this.authUnit.execute({correlationId:context.correlationId},accountId,scope=>{
      const account=scope.findAccountById(accountId);if(!account.ok)return account;
      if(!account.value||session.securityEpoch!==account.value.securityEpoch){this.session.clear();return err(createAppError({code:ERROR_CODES.AUTHENTICATION_REQUIRED,message:'Oturum güvenlik dönemi değişti. Lütfen yeniden giriş yapın.',category:'authentication',correlationId:context.correlationId}));}
      if(!this.passwordService.verify(input.password,account.value.passwordRecord))return err(createAppError({code:ERROR_CODES.AUTH_INVALID_CREDENTIALS,message:'Kritik işlem için parola doğrulanamadı.',category:'authentication',correlationId:context.correlationId}));
      if(account.value.totpSecret){
        if(!input.code)return err(createAppError({code:ERROR_CODES.AUTH_SECOND_FACTOR_REQUIRED,message:'Kritik işlem için iki aşamalı doğrulama kodu gereklidir.',category:'authentication',correlationId:context.correlationId}));
        if(!this.secondFactorService.verifyTotp(account.value.totpSecret,input.code,scope.occurredAt))return err(createAppError({code:ERROR_CODES.AUTH_SECOND_FACTOR_INVALID,message:'İki aşamalı doğrulama kodu geçersiz.',category:'authentication',correlationId:context.correlationId}));
      }
      return ok(undefined);
    });
  }
}
