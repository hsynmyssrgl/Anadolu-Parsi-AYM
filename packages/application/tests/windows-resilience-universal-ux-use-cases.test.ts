import { describe,expect,it } from 'vitest';import { asCorrelationId,asFamilyId,asPersonId,asUserId,ok,type AppError,type Result } from '@ppt/core';
import type { PolicyWeakeningProposalRow,UniversalUxOperationRow,WindowsResilienceEvidenceRow } from '@ppt/repository-contracts';
import { RecordPolicyWeakeningProposalUseCase,RecordWindowsResilienceEvidenceUseCase,SearchUniversalUxUseCase,
  UpdateUniversalUxPreferencesUseCase,type LifeApplicationContext,type LifePolicyIntent,type WindowsResilienceUniversalUxUnitOfWork,
  type WindowsResilienceUniversalUxWriteScope } from '../src/index.js';
const FAMILY=asFamilyId('family-34-k'),OWNER=asPersonId('person-owner-34-k');const CONTEXT:LifeApplicationContext=Object.freeze({familyId:FAMILY,
  actor:Object.freeze({userId:asUserId('account-owner-34-k'),role:'family_admin',personId:OWNER}),correlationId:asCorrelationId('correlation-34-k')});
class State{public preferences:ReturnType<WindowsResilienceUniversalUxWriteScope['loadPreferences']> extends Result<infer T,AppError>?T:never=null;
  public operations=new Map<string,UniversalUxOperationRow>();public proposals:PolicyWeakeningProposalRow[]=[];public evidence:WindowsResilienceEvidenceRow[]=[];
  public clone(){const next=new State();next.preferences=this.preferences;next.operations=new Map(this.operations);next.proposals=[...this.proposals];next.evidence=[...this.evidence];return next;}}
class Scope implements WindowsResilienceUniversalUxWriteScope{public readonly key={familyId:FAMILY,ownerPersonId:OWNER};public readonly occurredAt='2026-08-16T02:30:00.000Z';
  public constructor(private readonly state:State){}public loadPreferences(){return ok(this.state.preferences);}public findOperation(id:string){return ok(this.state.operations.get(id)??null);}
  public savePreferences(value:NonNullable<State['preferences']>,operation:UniversalUxOperationRow){this.state.preferences=value;this.state.operations.set(operation.clientOperationId,operation);return ok(undefined);}
  public appendPolicyProposal(value:PolicyWeakeningProposalRow,operation:UniversalUxOperationRow){this.state.proposals.push(value);this.state.operations.set(operation.clientOperationId,operation);return ok(undefined);}
  public appendResilienceEvidence(value:WindowsResilienceEvidenceRow,operation:UniversalUxOperationRow){this.state.evidence.push(value);this.state.operations.set(operation.clientOperationId,operation);return ok(undefined);}}
class Unit implements WindowsResilienceUniversalUxUnitOfWork{public state=new State();public intents:LifePolicyIntent[]=[];public execute<T>(_context:LifeApplicationContext,intent:LifePolicyIntent,
  operation:(scope:WindowsResilienceUniversalUxWriteScope)=>Result<T,AppError>){this.intents.push(intent);const draft=this.state.clone();const result=operation(new Scope(draft));if(result.ok)this.state=draft;return Promise.resolve(result);}}
describe('34-K Windows resilience and universal UX use cases',()=>{
  it('filters unauthorized universal results and persists bounded personal UX preferences',async()=>{const search=new SearchUniversalUxUseCase();
    expect(search.execute('sağlık',[{id:'allowed',source:'inbox',title:'Sağlık randevusu',keywords:['bakım'],routeId:'life-center',authorized:true},
      {id:'denied',source:'document',title:'Sağlık sırrı',keywords:['özel'],routeId:'archive',authorized:false}])).toEqual([
      {id:'allowed',source:'inbox',title:'Sağlık randevusu',routeId:'life-center',score:1,authorizationFiltered:true}]);
    const unit=new Unit();const useCase=new UpdateUniversalUxPreferencesUseCase(unit);const first=await useCase.execute({context:CONTEXT,
      clientOperationId:'preferences-34-k',expectedRevision:0,mode:'caregiver',favoriteRouteIds:['life-center'],recentRouteIds:['archive'],
      dashboardCardIds:['today','health'],quietHoursEnabled:true,quietHoursStart:'23:00',quietHoursEnd:'07:00',weeklyDigestEnabled:true});
    expect(first).toMatchObject({ok:true,value:{operationKind:'preferences_update',requirementsClosed:false}});
    expect(unit.state.preferences).toMatchObject({mode:'caregiver',revision:1,weeklyDigestEnabled:true});
    expect((await useCase.execute({context:CONTEXT,clientOperationId:'preferences-34-k',expectedRevision:0,mode:'caregiver',
      favoriteRouteIds:['life-center'],recentRouteIds:['archive'],dashboardCardIds:['today','health'],quietHoursEnabled:true,
      quietHoursStart:'23:00',quietHoursEnd:'07:00',weeklyDigestEnabled:true}))).toMatchObject({ok:true,value:{replayed:true}});});
  it('records policy weakening evidence but never auto-activates it',async()=>{const unit=new Unit();const useCase=new RecordPolicyWeakeningProposalUseCase(unit);
    await useCase.execute({context:CONTEXT,clientOperationId:'policy-invalid-34-k',proposal:{proposalId:'proposal-invalid-34-k',currentPolicyVersion:'v1',
      proposedPolicyVersion:'v1',explicitUserDecisionId:'decision-34-k',riskAnalysisSha256:'1'.repeat(64),rollbackPlanSha256:'2'.repeat(64),reason:'Risk analysis exists.'}});
    await useCase.execute({context:CONTEXT,clientOperationId:'policy-valid-34-k',proposal:{proposalId:'proposal-valid-34-k',currentPolicyVersion:'v1',
      proposedPolicyVersion:'v2',explicitUserDecisionId:'decision-34-k',riskAnalysisSha256:'1'.repeat(64),rollbackPlanSha256:'2'.repeat(64),reason:'Explicitly accepted weakening with rollback.'}});
    expect(unit.state.proposals.map(item=>item.accepted)).toEqual([false,true]);});
  it('keeps lifecycle and soak evidence incomplete without real Windows proof',async()=>{const unit=new Unit();const useCase=new RecordWindowsResilienceEvidenceUseCase(unit);
    const result=await useCase.execute({context:CONTEXT,clientOperationId:'resilience-34-k',evidenceId:'evidence-34-k',evidence:{
      crashSafeTransactionSyntheticPass:true,startupRecoverySyntheticPass:true,installerCleanInstallRealWindowsPass:false,
      installerUpgradeRealWindowsPass:false,installerRepairRealWindowsPass:false,installerUninstallDataProtectionRealWindowsPass:false,
      peopleCount:10_000,eventCount:100_000,documentCount:10_000,soakHours:2,realWindowsSoak:false}});
    expect(result).toMatchObject({ok:true,value:{requirementsClosed:false}});expect(unit.state.evidence[0]).toMatchObject({requirementsClosed:false,realWindowsSoak:false});});
});
