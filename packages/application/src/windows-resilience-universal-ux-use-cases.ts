import { createHash } from 'node:crypto';import { ERROR_CODES,asFamilyId,asPersonId,createAppError,err,ok,type AppError,type Result } from '@ppt/core';
import { assessWindowsResilienceEvidence,evaluatePolicyWeakening,searchUniversalUx,type PolicyWeakeningProposalInput,
  type UniversalSearchCandidate,type UniversalUxMode,type UniversalUxPreferencesView,type WindowsResilienceEvidenceView } from '@ppt/domain';
import type { PolicyWeakeningProposalRow,UniversalUxOperationRow,WindowsResilienceEvidenceRow,
  WindowsResilienceUniversalUxKey,RepositoryResult } from '@ppt/repository-contracts';import type { LifeApplicationContext,LifePolicyIntent } from './life-use-cases.js';
export interface WindowsResilienceUniversalUxWriteScope{readonly key:WindowsResilienceUniversalUxKey;readonly occurredAt:string;
  loadPreferences():RepositoryResult<UniversalUxPreferencesView|null>;findOperation(clientOperationId:string):RepositoryResult<UniversalUxOperationRow|null>;
  savePreferences(preferences:UniversalUxPreferencesView,operation:UniversalUxOperationRow,expectedRevision:number):RepositoryResult<void>;
  appendPolicyProposal(proposal:PolicyWeakeningProposalRow,operation:UniversalUxOperationRow):RepositoryResult<void>;
  appendResilienceEvidence(evidence:WindowsResilienceEvidenceRow,operation:UniversalUxOperationRow):RepositoryResult<void>;}
export interface WindowsResilienceUniversalUxUnitOfWork{execute<T>(context:LifeApplicationContext,intent:LifePolicyIntent,
  operation:(scope:WindowsResilienceUniversalUxWriteScope)=>Result<T,AppError>):Promise<Result<T,AppError>>;}
export interface UniversalUxMutationReceipt{readonly operationKind:UniversalUxOperationRow['operationKind'];readonly resultId:string;
  readonly replayed:boolean;readonly occurredAt:string;readonly requirementsClosed:boolean;}
const SAFE=/^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,255}$/u;const TIME=/^([01]\d|2[0-3]):[0-5]\d$/u;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value),'utf8').digest('hex');
const error=(context:LifeApplicationContext,code:AppError['code'],category:AppError['category'],message:string)=>createAppError({code,category,message,correlationId:context.correlationId});
const invalid=(context:LifeApplicationContext,message:string)=>error(context,ERROR_CODES.CORE_INVALID_ARGUMENT,'validation',message);
const denied=(context:LifeApplicationContext,message:string)=>error(context,ERROR_CODES.AUTHORIZATION_DENIED,'authorization',message);
const conflict=(context:LifeApplicationContext,message:string)=>error(context,ERROR_CODES.RESOURCE_CONFLICT,'conflict',message);
export const windowsResilienceUniversalUxIntent=(action:'read'|'create'|'update',resourceId:string):LifePolicyIntent=>({action,
  capability:action==='read'?'family.read':'family.write',resourceType:'windows_resilience_universal_ux',resourceId,purpose:'general'});
const canonical=(values:readonly string[],maximum:number):readonly string[]|null=>{if(!Array.isArray(values)||values.length>maximum||values.some(value=>!SAFE.test(value)))return null;
  const result=[...new Set(values)];return result.length===values.length?Object.freeze(result):null;};
const operation=(scope:WindowsResilienceUniversalUxWriteScope,context:LifeApplicationContext,clientOperationId:string,
  operationKind:UniversalUxOperationRow['operationKind'],requestFingerprint:string,resultId:string):UniversalUxOperationRow=>Object.freeze({
    clientOperationId,familyId:scope.key.familyId,ownerPersonId:scope.key.ownerPersonId,operationKind,requestFingerprint,resultId});
const receipt=(row:UniversalUxOperationRow,replayed:boolean,occurredAt:string,requirementsClosed=false):UniversalUxMutationReceipt=>Object.freeze({
  operationKind:row.operationKind,resultId:row.resultId,replayed,occurredAt,requirementsClosed});
export class SearchUniversalUxUseCase{public execute(query:string,candidates:readonly UniversalSearchCandidate[],limit=20){return searchUniversalUx(query,candidates,limit);}}
export class UpdateUniversalUxPreferencesUseCase{public constructor(private readonly uow:WindowsResilienceUniversalUxUnitOfWork){}
  public execute(input:{readonly context:LifeApplicationContext;readonly clientOperationId:string;readonly expectedRevision:number;
    readonly mode:UniversalUxMode;readonly favoriteRouteIds:readonly string[];readonly recentRouteIds:readonly string[];
    readonly dashboardCardIds:readonly string[];readonly quietHoursEnabled:boolean;readonly quietHoursStart:string;
    readonly quietHoursEnd:string;readonly weeklyDigestEnabled:boolean}){const {context}=input;const owner=context.actor.personId;
    const favorites=canonical(input.favoriteRouteIds,64),recents=canonical(input.recentRouteIds,64),cards=canonical(input.dashboardCardIds,32);
    if(!owner)return Promise.resolve(err(denied(context,'Evrensel UX tercihleri kişi bağlı oturum gerektirir.')));
    if(!SAFE.test(input.clientOperationId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||!favorites||!recents||!cards
      ||!TIME.test(input.quietHoursStart)||!TIME.test(input.quietHoursEnd))return Promise.resolve(err(invalid(context,'Evrensel UX tercihi geçersizdir.')));
    const requestFingerprint=hash(input);return this.uow.execute(context,windowsResilienceUniversalUxIntent('update',`universal-ux:${owner}`),scope=>{
      const prior=scope.findOperation(input.clientOperationId);if(!prior.ok)return prior;if(prior.value)return prior.value.operationKind==='preferences_update'
        &&prior.value.requestFingerprint===requestFingerprint?ok(receipt(prior.value,true,scope.occurredAt)):err(conflict(context,'İşlem kimliği farklı UX komutuna aittir.'));
      const loaded=scope.loadPreferences();if(!loaded.ok)return loaded;const revision=loaded.value?.revision??0;if(revision!==input.expectedRevision)return err(conflict(context,'UX tercih sürümü değişti.'));
      const preferences:UniversalUxPreferencesView=Object.freeze({mode:input.mode,favoriteRouteIds:favorites,recentRouteIds:recents,dashboardCardIds:cards,
        quietHoursEnabled:input.quietHoursEnabled,quietHoursStart:input.quietHoursStart,quietHoursEnd:input.quietHoursEnd,
        weeklyDigestEnabled:input.weeklyDigestEnabled,revision:revision+1,updatedAt:scope.occurredAt});const resultId=hash(preferences);
      const op=operation(scope,context,input.clientOperationId,'preferences_update',requestFingerprint,resultId);const saved=scope.savePreferences(preferences,op,revision);
      return saved.ok?ok(receipt(op,false,scope.occurredAt)):saved;});}}
export class RecordPolicyWeakeningProposalUseCase{public constructor(private readonly uow:WindowsResilienceUniversalUxUnitOfWork){}
  public execute(input:{readonly context:LifeApplicationContext;readonly clientOperationId:string;readonly proposal:PolicyWeakeningProposalInput}){
    const {context}=input;const owner=context.actor.personId;if(!owner)return Promise.resolve(err(denied(context,'Politika değişikliği kişi bağlı oturum gerektirir.')));
    if(!SAFE.test(input.clientOperationId))return Promise.resolve(err(invalid(context,'Politika değişikliği işlem kimliği geçersizdir.')));
    const decision=evaluatePolicyWeakening(input.proposal);const requestFingerprint=hash(input);return this.uow.execute(context,
      windowsResilienceUniversalUxIntent('create',input.proposal.proposalId),scope=>{const prior=scope.findOperation(input.clientOperationId);if(!prior.ok)return prior;
      if(prior.value)return prior.value.operationKind==='policy_weakening_record'&&prior.value.requestFingerprint===requestFingerprint
        ?ok(receipt(prior.value,true,scope.occurredAt)):err(conflict(context,'İşlem kimliği farklı politika önerisine aittir.'));
      const proposal:PolicyWeakeningProposalRow=Object.freeze({...input.proposal,familyId:asFamilyId(context.familyId),ownerPersonId:asPersonId(owner),
        accepted:decision.accepted,recordedAt:scope.occurredAt});const resultId=hash(proposal);const op=operation(scope,context,input.clientOperationId,
          'policy_weakening_record',requestFingerprint,resultId);const saved=scope.appendPolicyProposal(proposal,op);
      return saved.ok?ok(receipt(op,false,scope.occurredAt,false)):saved;});}}
export class RecordWindowsResilienceEvidenceUseCase{public constructor(private readonly uow:WindowsResilienceUniversalUxUnitOfWork){}
  public execute(input:{readonly context:LifeApplicationContext;readonly clientOperationId:string;readonly evidenceId:string;
    readonly evidence:Omit<WindowsResilienceEvidenceView,'requirementsClosed'>}){const {context}=input;const owner=context.actor.personId;
    if(!owner)return Promise.resolve(err(denied(context,'Windows dayanıklılık kanıtı kişi bağlı oturum gerektirir.')));
    if(!SAFE.test(input.clientOperationId)||!SAFE.test(input.evidenceId))return Promise.resolve(err(invalid(context,'Dayanıklılık kanıt kimliği geçersizdir.')));
    const assessed=assessWindowsResilienceEvidence(input.evidence);const requestFingerprint=hash(input);return this.uow.execute(context,
      windowsResilienceUniversalUxIntent('create',input.evidenceId),scope=>{const prior=scope.findOperation(input.clientOperationId);if(!prior.ok)return prior;
      if(prior.value)return prior.value.operationKind==='resilience_evidence_record'&&prior.value.requestFingerprint===requestFingerprint
        ?ok(receipt(prior.value,true,scope.occurredAt,assessed.requirementsClosed)):err(conflict(context,'İşlem kimliği farklı dayanıklılık kanıtına aittir.'));
      const evidence:WindowsResilienceEvidenceRow=Object.freeze({...assessed,id:input.evidenceId,familyId:asFamilyId(context.familyId),
        ownerPersonId:asPersonId(owner),recordedAt:scope.occurredAt});const resultId=hash(evidence);const op=operation(scope,context,input.clientOperationId,
          'resilience_evidence_record',requestFingerprint,resultId);const saved=scope.appendResilienceEvidence(evidence,op);
      return saved.ok?ok(receipt(op,false,scope.occurredAt,assessed.requirementsClosed)):saved;});}}
