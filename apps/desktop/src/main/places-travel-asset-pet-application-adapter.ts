import { ERROR_CODES, createAppError, err, type AppError, type Result } from '@ppt/core';
import {
  emptyPlacesTravelCounts,
  placesTravelReadIntent,
  placesTravelTruth,
  type LifeApplicationContext,
  type LifePolicyIntent,
  type PlacesTravelAssetPetQueryPort,
  type PlacesTravelAssetPetUnitOfWork,
  type PlacesTravelAssetPetWriteScope
} from '@ppt/application';
import { placesTravelCenterId, type PlacesTravelCenterView, type PlacesTravelItemView } from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  AccountRow,
  ObjectPermissionRow,
  PlacesTravelAssetPetRepositoryPort,
  PlacesTravelCenterKey,
  PlacesTravelPolicyResourceRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext
} from '@ppt/repository-contracts';
import { placesTravelVisibilityPrivacy } from '@ppt/repository-contracts';
import { CentralAuthorizationService, type AuthorizationAction, type AuthorizationGrant } from '@ppt/security';
import {
  RepositoryBackedLifePolicyTransactionRunner,
  type RepositoryBackedLifeApplicationDependencies
} from './life-application-adapter.js';

export interface RepositoryBackedPlacesTravelDependencies extends RepositoryBackedLifeApplicationDependencies {
  readonly placesTravelRepository: PlacesTravelAssetPetRepositoryPort;
  readonly placesTravelPolicyResourceRepository: PlacesTravelPolicyResourceRepositoryPort;
}

const keyFor=(context:LifeApplicationContext,ownerPersonId:string):PlacesTravelCenterKey=>({
  familyId:context.familyId,accountId:context.actor.userId,actorPersonId:context.actor.personId!,
  ownerPersonId:ownerPersonId as PlacesTravelCenterKey['ownerPersonId'],centerId:placesTravelCenterId(context.familyId,ownerPersonId)
});
const activeAccount=(account:AccountRow,at:string):boolean=>account.status==='active'
  &&Date.parse(account.startsAt)<=Date.parse(at)&&(!account.endsAt||Date.parse(account.endsAt)>=Date.parse(at));
const toGrant=(row:ObjectPermissionRow):AuthorizationGrant=>({id:row.id,subjectAccountId:row.subjectAccountId,
  resourceType:row.resourceType,resourceId:row.resourceId,actions:row.actions as readonly AuthorizationAction[],effect:row.effect,
  purpose:row.purpose,...(row.familyBranchId?{familyBranchId:row.familyBranchId}:{}),
  ...(row.ownershipBasisPoints===undefined?{}:{ownershipBasisPoints:row.ownershipBasisPoints}),
  ...(row.denialReason?{denialReason:row.denialReason}:{}),startsAt:row.startsAt,...(row.endsAt?{endsAt:row.endsAt}:{})});
const loadAuthorization=(dependencies:RepositoryBackedPlacesTravelDependencies,context:LifeApplicationContext,
  repository:RepositoryExecutionContext):Result<{readonly account:AccountRow;readonly grants:readonly AuthorizationGrant[]},AppError>=>{
  const account=dependencies.accountRepository.findById(repository,context.actor.userId);if(!account.ok)return account;
  if(!account.value||!activeAccount(account.value,repository.occurredAt))return err(createAppError({code:ERROR_CODES.AUTHORIZATION_DENIED,
    message:'Yer ve seyahat verileri için etkin üyelik zorunludur.',category:'authorization',correlationId:context.correlationId}));
  const grants=dependencies.permissionRepository.listActiveForSubject(repository,context.actor.userId,repository.occurredAt);
  return grants.ok?{ok:true,value:{account:account.value,grants:grants.value.map(toGrant)}}:grants;
};
const privacyFor=(item:PlacesTravelItemView)=>placesTravelVisibilityPrivacy(item.visibility);

export class RepositoryBackedPlacesTravelQueryPort implements PlacesTravelAssetPetQueryPort {
  readonly #runner:RepositoryBackedLifePolicyTransactionRunner;
  readonly #authorization=new CentralAuthorizationService();
  public constructor(private readonly dependencies:RepositoryBackedPlacesTravelDependencies,runner?:RepositoryBackedLifePolicyTransactionRunner){
    this.#runner=runner??new RepositoryBackedLifePolicyTransactionRunner(dependencies);
  }
  public getCenter(context:LifeApplicationContext,ownerPersonId:string):ReturnType<PlacesTravelAssetPetQueryPort['getCenter']>{
    return this.#runner.execute<PlacesTravelCenterView>(context,placesTravelReadIntent(),({repository,occurredAt})=>{
      if(!context.actor.personId)return err(createAppError({code:ERROR_CODES.AUTHORIZATION_DENIED,
        message:'Yer ve seyahat merkezi kişi bağlı oturum gerektirir.',category:'authorization',correlationId:context.correlationId}));
      const loaded=this.dependencies.placesTravelRepository.loadCenter(repository,keyFor(context,ownerPersonId));if(!loaded.ok)return loaded;
      if(loaded.value.owner.status!=='active')return err(createAppError({code:ERROR_CODES.RESOURCE_NOT_FOUND,
        message:'Etkin yer ve seyahat sahibi bulunamadı.',category:'not_found',correlationId:context.correlationId}));
      const auth=loadAuthorization(this.dependencies,context,repository);if(!auth.ok)return auth;
      const items=Object.freeze(loaded.value.items.filter((item)=>this.#authorization.authorize({
        accountId:auth.value.account.id,role:auth.value.account.role as LifeApplicationContext['actor']['role'],action:'read',
        resourceType:'places_travel_item',resourceId:item.id,occurredAt:repository.occurredAt,
        ...(auth.value.account.personId?{actorPersonId:auth.value.account.personId}:{}),ownerPersonId:item.ownerPersonId,
        privacy:privacyFor(item),sensitiveDomain:'life',grants:auth.value.grants
      }).allowed).map(({familyId:_family,stateFingerprint:_state,lastMutationId:_mutation,...view})=>Object.freeze(view)));
      const counts=emptyPlacesTravelCounts();for(const item of items)if(item.status!=='deleted')counts[item.area]+=1;
      return {ok:true,value:Object.freeze({schemaVersion:1 as const,centerId:keyFor(context,ownerPersonId).centerId,
        ownerPersonId,items,countsByArea:Object.freeze(counts),truth:placesTravelTruth,generatedAt:occurredAt})};
    });
  }
}

class RepositoryBackedPlacesTravelWriteScope implements PlacesTravelAssetPetWriteScope {
  readonly #authorization=new CentralAuthorizationService();
  readonly #snapshot:ReturnType<typeof loadAuthorization>;
  public constructor(private readonly dependencies:RepositoryBackedPlacesTravelDependencies,
    private readonly context:LifeApplicationContext,private readonly repository:PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt:PlacesTravelAssetPetWriteScope['occurredAt']){
    this.#snapshot=loadAuthorization(dependencies,context,repository);
  }
  public findPerson(personId:string):ReturnType<PlacesTravelAssetPetWriteScope['findPerson']>{
    const found=this.dependencies.personRepository.findById(this.repository,personId as Parameters<typeof this.dependencies.personRepository.findById>[1]);
    return found.ok?{ok:true,value:found.value?{id:found.value.id,familyId:found.value.familyId,status:found.value.status}:null}:found;
  }
  public authorize(input:Parameters<PlacesTravelAssetPetWriteScope['authorize']>[0]):ReturnType<PlacesTravelAssetPetWriteScope['authorize']>{
    if(!this.#snapshot.ok)return this.#snapshot;
    return {ok:true,value:this.#authorization.authorize({accountId:this.#snapshot.value.account.id,
      role:this.#snapshot.value.account.role as LifeApplicationContext['actor']['role'],action:input.action,
      resourceType:input.resourceType,resourceId:input.resourceId,occurredAt:this.repository.occurredAt,
      ...(this.#snapshot.value.account.personId?{actorPersonId:this.#snapshot.value.account.personId}:{}),
      ownerPersonId:input.ownerPersonId,privacy:input.privacy,sensitiveDomain:'life',grants:this.#snapshot.value.grants}).allowed};
  }
  public findItem(key:PlacesTravelCenterKey,itemId:string){return this.dependencies.placesTravelRepository.findItem(this.repository,key,itemId);}
  public findMutation(key:PlacesTravelCenterKey,clientOperationId:string){return this.dependencies.placesTravelRepository.findMutationByClientOperationId(this.repository,key,clientOperationId);}
  public insertMutation(row:Parameters<PlacesTravelAssetPetWriteScope['insertMutation']>[0]){return this.dependencies.placesTravelRepository.insertMutation(this.repository,row);}
  public insertItem(row:Parameters<PlacesTravelAssetPetWriteScope['insertItem']>[0]){return this.dependencies.placesTravelRepository.insertItem(this.repository,row);}
  public saveItem(row:Parameters<PlacesTravelAssetPetWriteScope['saveItem']>[0],expectedRevision:number){return this.dependencies.placesTravelRepository.saveItem(this.repository,row,expectedRevision);}
  public appendAudit(input:Parameters<PlacesTravelAssetPetWriteScope['appendAudit']>[0]){return this.dependencies.auditRepository.append(this.repository,input);}
  public enqueueEvent<TPayload>(event:DomainEvent<TPayload>):Result<void,AppError>{return this.dependencies.outboxRepository.enqueue(this.repository,event);}
}

export class RepositoryBackedPlacesTravelAssetPetUnitOfWork implements PlacesTravelAssetPetUnitOfWork {
  readonly #runner:RepositoryBackedLifePolicyTransactionRunner;
  public constructor(private readonly dependencies:RepositoryBackedPlacesTravelDependencies,runner?:RepositoryBackedLifePolicyTransactionRunner){
    this.#runner=runner??new RepositoryBackedLifePolicyTransactionRunner(dependencies);
  }
  public execute<T>(context:LifeApplicationContext,intent:LifePolicyIntent,
    operation:(scope:PlacesTravelAssetPetWriteScope)=>Result<T,AppError>):Promise<Result<T,AppError>>{
    return this.#runner.execute(context,intent,({repository,occurredAt})=>operation(
      new RepositoryBackedPlacesTravelWriteScope(this.dependencies,context,repository,occurredAt)));
  }
}
