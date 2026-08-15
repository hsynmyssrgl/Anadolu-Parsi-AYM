import {
  ERROR_CODES,
  createAppError,
  err,
  type AppError,
  type Result
} from '@ppt/core';
import {
  childEducationReadIntent,
  childEducationTruth,
  emptyChildEducationCounts,
  type ChildEducationCoordinationQueryPort,
  type ChildEducationCoordinationUnitOfWork,
  type ChildEducationCoordinationWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '@ppt/application';
import {
  childEducationCenterId,
  type ChildEducationAgeBand,
  type ChildEducationCenterView,
  type ChildEducationItemView
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  AccountRow,
  ChildEducationCenterKey,
  ChildEducationCoordinationRepositoryPort,
  ChildEducationPolicyResourceRepositoryPort,
  ObjectPermissionRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext
} from '@ppt/repository-contracts';
import {
  CentralAuthorizationService,
  type AuthorizationAction,
  type AuthorizationGrant
} from '@ppt/security';
import {
  RepositoryBackedLifePolicyTransactionRunner,
  type RepositoryBackedLifeApplicationDependencies
} from './life-application-adapter.js';

export interface RepositoryBackedChildEducationDependencies extends RepositoryBackedLifeApplicationDependencies {
  readonly childEducationRepository: ChildEducationCoordinationRepositoryPort;
  readonly childEducationPolicyResourceRepository: ChildEducationPolicyResourceRepositoryPort;
}

const keyFor=(context:LifeApplicationContext,childPersonId:string):ChildEducationCenterKey=>({
  familyId:context.familyId,accountId:context.actor.userId,actorPersonId:context.actor.personId!,
  childPersonId:childPersonId as ChildEducationCenterKey['childPersonId'],
  centerId:childEducationCenterId(context.familyId,childPersonId)
});

const activeAccount=(account:AccountRow,at:string):boolean=>account.status==='active'
  &&Date.parse(account.startsAt)<=Date.parse(at)&&(!account.endsAt||Date.parse(account.endsAt)>=Date.parse(at));

const toGrant=(row:ObjectPermissionRow):AuthorizationGrant=>({id:row.id,subjectAccountId:row.subjectAccountId,
  resourceType:row.resourceType,resourceId:row.resourceId,actions:row.actions as readonly AuthorizationAction[],
  effect:row.effect,purpose:row.purpose,...(row.familyBranchId?{familyBranchId:row.familyBranchId}:{}),
  ...(row.ownershipBasisPoints===undefined?{}:{ownershipBasisPoints:row.ownershipBasisPoints}),
  ...(row.denialReason?{denialReason:row.denialReason}:{}),startsAt:row.startsAt,...(row.endsAt?{endsAt:row.endsAt}:{})});

const loadAuthorization=(dependencies:RepositoryBackedChildEducationDependencies,context:LifeApplicationContext,
  repository:RepositoryExecutionContext):Result<{readonly account:AccountRow;readonly grants:readonly AuthorizationGrant[]},AppError>=>{
  const account=dependencies.accountRepository.findById(repository,context.actor.userId);
  if(!account.ok)return account;
  if(!account.value||!activeAccount(account.value,repository.occurredAt))return err(createAppError({
    code:ERROR_CODES.AUTHORIZATION_DENIED,message:'Çocuk eğitim verileri için etkin üyelik zorunludur.',
    category:'authorization',correlationId:context.correlationId}));
  const grants=dependencies.permissionRepository.listActiveForSubject(repository,context.actor.userId,repository.occurredAt);
  return grants.ok?{ok:true,value:{account:account.value,grants:grants.value.map(toGrant)}}:grants;
};

const ageBand=(birthDate:string|undefined,at:string):ChildEducationAgeBand|null=>{
  if(!birthDate)return null;
  const birth=new Date(`${birthDate}T00:00:00.000Z`);const now=new Date(at);
  let age=now.getUTCFullYear()-birth.getUTCFullYear();
  if(now.getUTCMonth()<birth.getUTCMonth()||(now.getUTCMonth()===birth.getUTCMonth()&&now.getUTCDate()<birth.getUTCDate()))age-=1;
  return age>=0&&age<18?(age<13?'under_13':'teen'):null;
};

const privacyFor=(item:ChildEducationItemView):'family'|'selected_members'|'private'=>
  item.visibility==='family_coordination'?'family':item.visibility==='child_and_selected_guardians'?'selected_members':'private';

export class RepositoryBackedChildEducationQueryPort implements ChildEducationCoordinationQueryPort {
  readonly #runner:RepositoryBackedLifePolicyTransactionRunner;
  readonly #authorization=new CentralAuthorizationService();
  public constructor(private readonly dependencies:RepositoryBackedChildEducationDependencies,runner?:RepositoryBackedLifePolicyTransactionRunner){
    this.#runner=runner??new RepositoryBackedLifePolicyTransactionRunner(dependencies);
  }
  public getCenter(context:LifeApplicationContext,childPersonId:string):ReturnType<ChildEducationCoordinationQueryPort['getCenter']>{
    return this.#runner.execute<ChildEducationCenterView>(context,childEducationReadIntent(),({repository,occurredAt})=>{
      if(!context.actor.personId)return err(createAppError({code:ERROR_CODES.AUTHORIZATION_DENIED,
        message:'Çocuk eğitim merkezi kişi bağlı oturum gerektirir.',category:'authorization',correlationId:context.correlationId}));
      const loaded=this.dependencies.childEducationRepository.loadCenter(repository,keyFor(context,childPersonId));
      if(!loaded.ok)return loaded;
      const band=ageBand(loaded.value.child.birthDate,occurredAt);
      if(loaded.value.child.status!=='active'||!band)return err(createAppError({code:ERROR_CODES.RESOURCE_NOT_FOUND,
        message:'Etkin 18 yaş altı çocuk eğitim profili bulunamadı.',category:'not_found',correlationId:context.correlationId}));
      const auth=loadAuthorization(this.dependencies,context,repository);if(!auth.ok)return auth;
      const items=Object.freeze(loaded.value.items.filter((item)=>this.#authorization.authorize({
        accountId:auth.value.account.id,role:auth.value.account.role as LifeApplicationContext['actor']['role'],action:'read',resourceType:'child_education_item',
        resourceId:item.id,occurredAt:repository.occurredAt,...(auth.value.account.personId?{actorPersonId:auth.value.account.personId}:{}),
        ownerPersonId:item.childPersonId,privacy:privacyFor(item),sensitiveDomain:'life',grants:auth.value.grants
      }).allowed).map(({familyId:_family,stateFingerprint:_state,lastMutationId:_mutation,...view})=>Object.freeze(view)));
      const counts=emptyChildEducationCounts();for(const item of items)if(item.status!=='deleted')counts[item.area]+=1;
      return {ok:true,value:Object.freeze({schemaVersion:1 as const,centerId:keyFor(context,childPersonId).centerId,
        childPersonId,ageBand:band,viewMode:band==='under_13'?'guided_child' as const:'teen_standard' as const,
        items,countsByArea:Object.freeze(counts),truth:childEducationTruth,generatedAt:occurredAt})};
    });
  }
}

class RepositoryBackedChildEducationWriteScope implements ChildEducationCoordinationWriteScope {
  readonly #authorization=new CentralAuthorizationService();
  readonly #snapshot:ReturnType<typeof loadAuthorization>;
  public constructor(private readonly dependencies:RepositoryBackedChildEducationDependencies,
    private readonly context:LifeApplicationContext,private readonly repository:PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt:ChildEducationCoordinationWriteScope['occurredAt']){
    this.#snapshot=loadAuthorization(dependencies,context,repository);
  }
  public findPerson(personId:string):ReturnType<ChildEducationCoordinationWriteScope['findPerson']>{
    const found=this.dependencies.personRepository.findById(this.repository,personId as Parameters<typeof this.dependencies.personRepository.findById>[1]);
    return found.ok?{ok:true,value:found.value?{id:found.value.id,familyId:found.value.familyId,status:found.value.status,
      ...(found.value.birthDate?{birthDate:found.value.birthDate}:{})}:null}:found;
  }
  public authorize(input:Parameters<ChildEducationCoordinationWriteScope['authorize']>[0]):ReturnType<ChildEducationCoordinationWriteScope['authorize']>{
    if(!this.#snapshot.ok)return this.#snapshot;
    return {ok:true,value:this.#authorization.authorize({accountId:this.#snapshot.value.account.id,
      role:this.#snapshot.value.account.role as LifeApplicationContext['actor']['role'],action:input.action,resourceType:input.resourceType,resourceId:input.resourceId,
      occurredAt:this.repository.occurredAt,...(this.#snapshot.value.account.personId?{actorPersonId:this.#snapshot.value.account.personId}:{}),
      ownerPersonId:input.ownerPersonId,privacy:input.privacy,sensitiveDomain:'life',grants:this.#snapshot.value.grants}).allowed};
  }
  public findItem(key:ChildEducationCenterKey,itemId:string){return this.dependencies.childEducationRepository.findItem(this.repository,key,itemId);}
  public findMutation(key:ChildEducationCenterKey,clientOperationId:string){return this.dependencies.childEducationRepository.findMutationByClientOperationId(this.repository,key,clientOperationId);}
  public insertMutation(row:Parameters<ChildEducationCoordinationWriteScope['insertMutation']>[0]){return this.dependencies.childEducationRepository.insertMutation(this.repository,row);}
  public insertItem(row:Parameters<ChildEducationCoordinationWriteScope['insertItem']>[0]){return this.dependencies.childEducationRepository.insertItem(this.repository,row);}
  public saveItem(row:Parameters<ChildEducationCoordinationWriteScope['saveItem']>[0],expectedRevision:number){return this.dependencies.childEducationRepository.saveItem(this.repository,row,expectedRevision);}
  public appendAudit(input:Parameters<ChildEducationCoordinationWriteScope['appendAudit']>[0]){return this.dependencies.auditRepository.append(this.repository,input);}
  public enqueueEvent<TPayload>(event:DomainEvent<TPayload>):Result<void,AppError>{return this.dependencies.outboxRepository.enqueue(this.repository,event);}
}

export class RepositoryBackedChildEducationCoordinationUnitOfWork implements ChildEducationCoordinationUnitOfWork {
  readonly #runner:RepositoryBackedLifePolicyTransactionRunner;
  public constructor(private readonly dependencies:RepositoryBackedChildEducationDependencies,runner?:RepositoryBackedLifePolicyTransactionRunner){
    this.#runner=runner??new RepositoryBackedLifePolicyTransactionRunner(dependencies);
  }
  public execute<T>(context:LifeApplicationContext,intent:LifePolicyIntent,
    operation:(scope:ChildEducationCoordinationWriteScope)=>Result<T,AppError>):Promise<Result<T,AppError>>{
    return this.#runner.execute(context,intent,({repository,occurredAt})=>operation(
      new RepositoryBackedChildEducationWriteScope(this.dependencies,context,repository,occurredAt)));
  }
}
