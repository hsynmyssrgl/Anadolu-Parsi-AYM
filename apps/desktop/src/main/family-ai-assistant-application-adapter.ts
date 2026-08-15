import { ERROR_CODES, createAppError, err, ok, type AppError, type Result } from '@ppt/core';
import {
  familyAiAssistantReadIntent,
  type FamilyAiAssistantAuthorizedCandidate,
  type FamilyAiAssistantQueryPort,
  type FamilyAiAssistantSourcePort,
  type FamilyAiAssistantUnitOfWork,
  type FamilyAiAssistantWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent,
  type UnifiedAuthorizedSearchSourcePort
} from '@ppt/application';
import {
  familyAiAssistantCenterId,
  familyAiAssistantTruth,
  type AiConsentView,
  type FamilyAiAssistantCenterView,
  type FamilyAiAssistantModule,
  type FamilyAiAssistantPurpose,
  type FamilyAiAssistantSourceReferenceView,
  type HouseholdOperationsCenterView,
  type LocalGovernedOcrCenterView,
  type PlacesTravelCenterView,
  type SensitiveDataProfileView,
  type UnifiedAuthorizedSearchModule
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  AiConsentRepositoryPort,
  FamilyAiAssistantCenterKey,
  FamilyAiAssistantPolicyResourceRepositoryPort,
  FamilyAiAssistantRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext
} from '@ppt/repository-contracts';
import {
  RepositoryBackedLifePolicyTransactionRunner,
  type RepositoryBackedLifeApplicationDependencies
} from './life-application-adapter.js';

export interface RepositoryBackedFamilyAiAssistantDependencies extends RepositoryBackedLifeApplicationDependencies {
  readonly familyAiAssistantRepository:FamilyAiAssistantRepositoryPort;
  readonly familyAiAssistantPolicyResourceRepository:FamilyAiAssistantPolicyResourceRepositoryPort;
  readonly aiConsentRepository:AiConsentRepositoryPort;
}

export interface RepositoryBackedFamilyAiAssistantSourceDependencies {
  readonly unifiedSource:UnifiedAuthorizedSearchSourcePort;
  readonly loadOcrCenter:()=>Promise<LocalGovernedOcrCenterView>;
  readonly loadHouseholdCenter:()=>Promise<HouseholdOperationsCenterView>;
  readonly loadPlacesCenter:(ownerPersonId:string)=>Promise<PlacesTravelCenterView>;
  readonly listConsents:()=>Promise<readonly AiConsentView[]>;
  readonly listSensitiveProfiles:()=>Promise<readonly SensitiveDataProfileView[]>;
  readonly now:()=>string;
}

const standardModules=new Set<FamilyAiAssistantModule>(['family','event','archive','finance','health','life']);
const normalized=(value:string):string=>value.normalize('NFKC').toLocaleLowerCase('tr-TR');
const activeConsent=(consents:readonly AiConsentView[],purpose:FamilyAiAssistantPurpose,resourceType:string,
  resourceId:string,at:string):boolean=>consents.some((consent)=>consent.purpose===purpose&&consent.resourceType===resourceType
    &&(consent.resourceId===resourceId||consent.resourceId==='*')&&consent.status==='granted'
    &&Date.parse(consent.startsAt)<=Date.parse(at)&&(!consent.endsAt||Date.parse(consent.endsAt)>=Date.parse(at)));
const sensitiveAllowed=(profiles:readonly SensitiveDataProfileView[],resourceType:string):boolean=>{
  const category=resourceType==='finance_record'?'finance':resourceType==='health_record'?'health':undefined;
  return category===undefined||profiles.find((profile)=>profile.category===category)?.aiProcessing.effectiveStatus==='granted';
};

export class RepositoryBackedFamilyAiAssistantSourcePort implements FamilyAiAssistantSourcePort {
  public constructor(private readonly dependencies:RepositoryBackedFamilyAiAssistantSourceDependencies){}
  public async loadAuthorizedCandidates(context:LifeApplicationContext,input:{readonly purpose:FamilyAiAssistantPurpose;
    readonly modules:readonly FamilyAiAssistantModule[];readonly query?:string})
  :ReturnType<FamilyAiAssistantSourcePort['loadAuthorizedCandidates']>{
    try{
      const requestedStandard=input.modules.filter((module)=>standardModules.has(module)) as UnifiedAuthorizedSearchModule[];
      const [standard,consents,profiles,ocr,household,places]=await Promise.all([
        requestedStandard.length?this.dependencies.unifiedSource.loadAuthorizedCandidates(context,requestedStandard):Promise.resolve(ok([])),
        this.dependencies.listConsents(),this.dependencies.listSensitiveProfiles(),
        input.modules.includes('ocr')?this.dependencies.loadOcrCenter():Promise.resolve(undefined),
        input.modules.includes('household')?this.dependencies.loadHouseholdCenter():Promise.resolve(undefined),
        input.modules.includes('places')&&context.actor.personId?this.dependencies.loadPlacesCenter(context.actor.personId):Promise.resolve(undefined)
      ]);
      if(!standard.ok)return standard;
      const candidates:FamilyAiAssistantAuthorizedCandidate[]=[
        ...standard.value.map((candidate)=>({module:candidate.module,resourceType:candidate.resourceType,
          resourceId:candidate.resourceId,searchableText:candidate.searchableText,...(candidate.occurredAt?{occurredAt:candidate.occurredAt}:{})})),
        ...(ocr?.jobs.filter((job)=>job.status==='completed'&&job.resultAvailable).map((job)=>({module:'ocr' as const,
          resourceType:'local_ocr_job' as const,resourceId:job.id,searchableText:[job.id,job.source.resourceId,...job.languageHints],
          occurredAt:job.updatedAt}))??[]),
        ...(household?.items.filter((item)=>item.status!=='deleted').map((item)=>({module:'household' as const,
          resourceType:'household_operation_item' as const,resourceId:item.id,searchableText:[item.title,item.kind,item.area],
          occurredAt:item.updatedAt}))??[]),
        ...(places?.items.filter((item)=>item.status!=='deleted').map((item)=>({module:'places' as const,
          resourceType:'places_travel_item' as const,resourceId:item.id,searchableText:[item.title,item.kind,item.area],
          occurredAt:item.updatedAt}))??[])
      ];
      const at=this.dependencies.now();const queryTokens=input.query?.normalize('NFKC').trim().toLocaleLowerCase('tr-TR').split(/\s+/u)??[];
      return ok(Object.freeze(candidates.filter((candidate)=>activeConsent(consents,input.purpose,candidate.resourceType,candidate.resourceId,at)
        &&sensitiveAllowed(profiles,candidate.resourceType)
        &&(queryTokens.length===0||queryTokens.every((token)=>candidate.searchableText.some((text)=>normalized(text).includes(token)))))
        .sort((left,right)=>(right.occurredAt??'').localeCompare(left.occurredAt??'')
          ||left.resourceType.localeCompare(right.resourceType)||left.resourceId.localeCompare(right.resourceId))
        .slice(0,24)));
    }catch{return err(createAppError({code:ERROR_CODES.AUTHORIZATION_DENIED,
      message:'Aile asistanının izinli yerel kaynakları bütünüyle yüklenemedi.',category:'authorization',correlationId:context.correlationId}));}
  }
}

const keyFor=(context:LifeApplicationContext):FamilyAiAssistantCenterKey=>({familyId:context.familyId,
  accountId:context.actor.userId,actorPersonId:context.actor.personId!,ownerPersonId:context.actor.personId!,
  centerId:familyAiAssistantCenterId(context.familyId,context.actor.personId!)});
const sourceConsented=(consents:readonly AiConsentView[],purpose:FamilyAiAssistantPurpose,
  source:FamilyAiAssistantSourceReferenceView,at:string):boolean=>activeConsent(consents,purpose,source.resourceType,source.resourceId,at);
const sensitiveConsentActive=(consents:readonly AiConsentView[],source:FamilyAiAssistantSourceReferenceView,at:string):boolean=>{
  const category=source.resourceType==='finance_record'?'finance':source.resourceType==='health_record'?'health':undefined;
  return category===undefined||consents.some((consent)=>consent.purpose==='sensitive_processing'
    &&consent.resourceType==='sensitive_data_profile'&&consent.resourceId===category&&consent.status==='granted'
    &&Date.parse(consent.startsAt)<=Date.parse(at)&&(!consent.endsAt||Date.parse(consent.endsAt)>=Date.parse(at)));
};
const allConsented=(consents:readonly AiConsentView[],purpose:FamilyAiAssistantPurpose,
  sources:readonly FamilyAiAssistantSourceReferenceView[],at:string):boolean=>sources.every((source)=>
    sourceConsented(consents,purpose,source,at)&&sensitiveConsentActive(consents,source,at));

export class RepositoryBackedFamilyAiAssistantQueryPort implements FamilyAiAssistantQueryPort {
  readonly #runner:RepositoryBackedLifePolicyTransactionRunner;
  public constructor(private readonly dependencies:RepositoryBackedFamilyAiAssistantDependencies,runner?:RepositoryBackedLifePolicyTransactionRunner){
    this.#runner=runner??new RepositoryBackedLifePolicyTransactionRunner(dependencies);
  }
  public getCenter(context:LifeApplicationContext):ReturnType<FamilyAiAssistantQueryPort['getCenter']>{
    return this.#runner.execute(context,familyAiAssistantReadIntent(),({repository,occurredAt})=>{
      if(!context.actor.personId)return err(createAppError({code:ERROR_CODES.AUTHORIZATION_DENIED,
        message:'Aile asistanı kişi bağlı oturum gerektirir.',category:'authorization',correlationId:context.correlationId}));
      const snapshot=this.dependencies.familyAiAssistantRepository.loadCenter(repository,keyFor(context));if(!snapshot.ok)return snapshot;
      const listed=this.dependencies.aiConsentRepository.list(repository,context.actor.userId);if(!listed.ok)return listed;
      const visible=snapshot.value.suggestions.filter((suggestion)=>allConsented(listed.value,suggestion.purpose,suggestion.sources,repository.occurredAt));
      return ok(Object.freeze({schemaVersion:1 as const,centerId:keyFor(context).centerId,ownerPersonId:context.actor.personId,
        suggestions:Object.freeze(visible.map(({familyId:_family,stateFingerprint:_state,lastMutationId:_mutation,
          sourceFingerprint:_sourceFingerprint,...view})=>Object.freeze(view))),
        hiddenAfterConsentRevocationCount:snapshot.value.suggestions.length-visible.length,truth:familyAiAssistantTruth,generatedAt:occurredAt}));
    });
  }
}

class RepositoryBackedFamilyAiAssistantWriteScope implements FamilyAiAssistantWriteScope {
  public constructor(private readonly dependencies:RepositoryBackedFamilyAiAssistantDependencies,
    private readonly context:LifeApplicationContext,private readonly repository:PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt:FamilyAiAssistantWriteScope['occurredAt']){}
  public findSuggestion(key:FamilyAiAssistantCenterKey,suggestionId:string){return this.dependencies.familyAiAssistantRepository.findSuggestion(this.repository,key,suggestionId);}
  public findMutation(key:FamilyAiAssistantCenterKey,clientOperationId:string){return this.dependencies.familyAiAssistantRepository.findMutationByClientOperationId(this.repository,key,clientOperationId);}
  public revalidateSourceConsent(purpose:FamilyAiAssistantPurpose,sources:readonly FamilyAiAssistantSourceReferenceView[]){
    const consents=this.dependencies.aiConsentRepository.list(this.repository,this.context.actor.userId);
    return consents.ok?ok(allConsented(consents.value,purpose,sources,this.repository.occurredAt)):consents;
  }
  public insertMutation(row:Parameters<FamilyAiAssistantWriteScope['insertMutation']>[0]){return this.dependencies.familyAiAssistantRepository.insertMutation(this.repository,row);}
  public insertSuggestion(row:Parameters<FamilyAiAssistantWriteScope['insertSuggestion']>[0]){return this.dependencies.familyAiAssistantRepository.insertSuggestion(this.repository,row);}
  public saveSuggestion(row:Parameters<FamilyAiAssistantWriteScope['saveSuggestion']>[0],expectedRevision:number){return this.dependencies.familyAiAssistantRepository.saveSuggestion(this.repository,row,expectedRevision);}
  public appendAudit(input:Parameters<FamilyAiAssistantWriteScope['appendAudit']>[0]){return this.dependencies.auditRepository.append(this.repository,input);}
  public enqueueEvent<TPayload>(event:DomainEvent<TPayload>):Result<void,AppError>{return this.dependencies.outboxRepository.enqueue(this.repository,event);}
}

export class RepositoryBackedFamilyAiAssistantUnitOfWork implements FamilyAiAssistantUnitOfWork {
  readonly #runner:RepositoryBackedLifePolicyTransactionRunner;
  public constructor(private readonly dependencies:RepositoryBackedFamilyAiAssistantDependencies,runner?:RepositoryBackedLifePolicyTransactionRunner){
    this.#runner=runner??new RepositoryBackedLifePolicyTransactionRunner(dependencies);
  }
  public execute<T>(context:LifeApplicationContext,intent:LifePolicyIntent,
    operation:(scope:FamilyAiAssistantWriteScope)=>Result<T,AppError>):Promise<Result<T,AppError>>{
    return this.#runner.execute(context,intent,({repository,occurredAt})=>operation(
      new RepositoryBackedFamilyAiAssistantWriteScope(this.dependencies,context,repository,occurredAt)));
  }
}
