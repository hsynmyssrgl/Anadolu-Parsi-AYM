import { describe,expect,it } from 'vitest';
import { asCorrelationId,asFamilyId,asIsoDateTime,asPersonId,asUserId,ok,type AppError,type Result } from '@ppt/core';
import type { DomainEvent } from '@ppt/events';
import { FAMILY_AI_ASSISTANT_KINDS,FAMILY_AI_ASSISTANT_MODULES_BY_KIND,FAMILY_AI_ASSISTANT_RESOURCE_TYPE_BY_MODULE } from '@ppt/domain';
import type { FamilyAiSuggestionMutationRow,FamilyAiSuggestionRow } from '@ppt/repository-contracts';
import {
  GenerateFamilyAiSuggestionUseCase,ReviewFamilyAiSuggestionUseCase,
  RunFamilyAiLocalModelUseCase,
  type FamilyAiAssistantAuthorizedCandidate,type FamilyAiAssistantSourcePort,type FamilyAiAssistantUnitOfWork,
  type FamilyAiAssistantModelPort,type FamilyAiAssistantWriteScope,type LifeApplicationContext,type LifePolicyIntent
} from '../src/index.js';

const NOW=asIsoDateTime('2026-08-15T12:00:00.000Z');
const FAMILY=asFamilyId('family-33-w');const OWNER=asPersonId('person-owner-33-w');
const context:LifeApplicationContext={familyId:FAMILY,actor:{userId:asUserId('account-owner-33-w'),role:'family_admin',personId:OWNER},
  correlationId:asCorrelationId('correlation-family-ai-33-w')};
const candidate:FamilyAiAssistantAuthorizedCandidate={module:'event',resourceType:'event',resourceId:'event-33-w',
  searchableText:['Yaklaşan aile toplantısı'],occurredAt:NOW};

class MemorySource implements FamilyAiAssistantSourcePort{
  public candidates:readonly FamilyAiAssistantAuthorizedCandidate[]=[candidate];
  public calls=0;public inputs:unknown[]=[];
  public loadAuthorizedCandidates(_context?:unknown,input?:unknown){this.calls+=1;this.inputs.push(input);return Promise.resolve(ok(this.candidates));}
}
class MemoryScope implements FamilyAiAssistantWriteScope{
  public readonly occurredAt=NOW;public consent=true;public readonly suggestions=new Map<string,FamilyAiSuggestionRow>();
  public readonly mutations=new Map<string,FamilyAiSuggestionMutationRow>();public readonly audits:unknown[]=[];
  public readonly events:DomainEvent<unknown>[]=[];
  public findSuggestion(_key:unknown,id:string){return ok(this.suggestions.get(id)??null);}
  public findMutation(_key:unknown,id:string){return ok(this.mutations.get(id)??null);}
  public revalidateSourceConsent(){return ok(this.consent);}
  public insertMutation(row:FamilyAiSuggestionMutationRow){this.mutations.set(row.clientOperationId,row);return ok(undefined);}
  public insertSuggestion(row:FamilyAiSuggestionRow){this.suggestions.set(row.id,row);return ok(undefined);}
  public saveSuggestion(row:FamilyAiSuggestionRow,expectedRevision:number){const current=this.suggestions.get(row.id);if(!current||current.revision!==expectedRevision)throw new Error('revision');this.suggestions.set(row.id,row);return ok(undefined);}
  public appendAudit(input:unknown){this.audits.push(input);return ok('audit');}
  public enqueueEvent<TPayload>(event:DomainEvent<TPayload>):Result<void,AppError>{this.events.push(event as DomainEvent<unknown>);return ok(undefined);}
}
class MemoryUnit implements FamilyAiAssistantUnitOfWork{
  public readonly scope=new MemoryScope();public readonly intents:LifePolicyIntent[]=[];
  public execute<T>(_context:LifeApplicationContext,intent:LifePolicyIntent,operation:(scope:FamilyAiAssistantWriteScope)=>Result<T,AppError>){
    this.intents.push(intent);return Promise.resolve(operation(this.scope));
  }
}
class MemoryModel implements FamilyAiAssistantModelPort{
  public calls=0;
  public getStatus(){return Promise.resolve({provider:'ollama_loopback' as const,configured:true,available:true,
    model:'test-local:1',endpoint:'http://127.0.0.1:11434' as const,localLoopbackOnly:true as const,
    networkEgressUsed:false as const,cloudUsed:false as const,checkedAt:NOW});}
  public run(){this.calls+=1;return Promise.resolve(ok({answer:'İzinli kaynaklara göre aile toplantısını gözden geçirin.',
    model:'test-local:1',generatedAt:NOW}));}
}

describe('33-W consent-bound family AI assistant use cases',()=>{
  it('generates one local metadata-only suggestion and replays without duplicate evidence',async()=>{
    const unit=new MemoryUnit();const source=new MemorySource();const useCase=new GenerateFamilyAiSuggestionUseCase(source,unit);
    const command={clientOperationId:'operation-generate-33-w',suggestionId:'suggestion-33-w',kind:'authorized_search' as const,
      modules:['event'] as const,query:'aile toplantısı'};
    expect(await useCase.execute({context,command})).toMatchObject({ok:true,value:{revision:1,replayed:false,networkUsed:false,
      cloudUsed:false,durableActionPerformed:'not_performed'}});
    const reordered={kind:command.kind,suggestionId:command.suggestionId,query:command.query,modules:command.modules,
      clientOperationId:command.clientOperationId};
    expect(await useCase.execute({context,command:reordered})).toMatchObject({ok:true,value:{revision:1,replayed:true}});
    expect(source.calls).toBe(1);
    expect(unit.scope.audits).toHaveLength(1);expect(unit.scope.events).toHaveLength(1);
    expect(unit.intents[0]).toMatchObject({resourceType:'family_ai_suggestion',resourceId:'suggestion-33-w',action:'create',privacy:'private'});
    expect(unit.scope.suggestions.get('suggestion-33-w')).toMatchObject({status:'pending_confirmation',sources:[{module:'event',resourceId:'event-33-w'}]});
    expect(JSON.stringify(unit.scope.suggestions.get('suggestion-33-w'))).not.toContain('Yaklaşan aile toplantısı');
  });

  it('fails closed when no authorized consented local source remains',async()=>{
    const unit=new MemoryUnit();unit.scope.consent=false;const useCase=new GenerateFamilyAiSuggestionUseCase(new MemorySource(),unit);
    const result=await useCase.execute({context,command:{clientOperationId:'operation-denied-33-w',suggestionId:'suggestion-denied-33-w',
      kind:'daily_summary',modules:['event']}});
    expect(result).toMatchObject({ok:false,error:{category:'authorization'}});expect(unit.scope.mutations).toHaveLength(0);
  });

  it('records human confirmation without executing any downstream action',async()=>{
    const unit=new MemoryUnit();await new GenerateFamilyAiSuggestionUseCase(new MemorySource(),unit).execute({context,command:{
      clientOperationId:'operation-create-review-33-w',suggestionId:'suggestion-review-33-w',kind:'meeting_agenda',modules:['event']}});
    const result=await new ReviewFamilyAiSuggestionUseCase(unit).execute({context,command:{clientOperationId:'operation-confirm-33-w',
      suggestionId:'suggestion-review-33-w',expectedRevision:1,decision:'confirm'}});
    expect(result).toMatchObject({ok:true,value:{revision:2,humanConfirmationRecorded:true,durableActionPerformed:'not_performed'}});
    expect(unit.scope.suggestions.get('suggestion-review-33-w')).toMatchObject({status:'confirmed',revision:2});
    expect(unit.scope.events.at(-1)?.payload).toMatchObject({durableActionPerformed:'not_performed',humanConfirmationRecorded:true});
  });

  it('allows dismissal after consent revocation but keeps confirmation fail-closed',async()=>{
    const make=async(id:string)=>{const unit=new MemoryUnit();await new GenerateFamilyAiSuggestionUseCase(new MemorySource(),unit).execute({context,
      command:{clientOperationId:`operation-create-${id}`,suggestionId:id,kind:'meeting_agenda',modules:['event']}});unit.scope.consent=false;return unit;};
    const confirm=await make('suggestion-revoked-confirm');expect(await new ReviewFamilyAiSuggestionUseCase(confirm).execute({context,command:{
      clientOperationId:'operation-revoked-confirm',suggestionId:'suggestion-revoked-confirm',expectedRevision:1,decision:'confirm'}}))
      .toMatchObject({ok:false,error:{category:'authorization'}});
    const dismiss=await make('suggestion-revoked-dismiss');expect(await new ReviewFamilyAiSuggestionUseCase(dismiss).execute({context,command:{
      clientOperationId:'operation-revoked-dismiss',suggestionId:'suggestion-revoked-dismiss',expectedRevision:1,decision:'dismiss'}}))
      .toMatchObject({ok:true,value:{revision:2,humanConfirmationRecorded:false}});
  });

  it('pins every workflow to its canonical source modules and purpose',async()=>{
    for(const [index,kind] of FAMILY_AI_ASSISTANT_KINDS.entries()){
      const module=FAMILY_AI_ASSISTANT_MODULES_BY_KIND[kind][0]!;const source=new MemorySource();source.candidates=[{
        module,resourceType:FAMILY_AI_ASSISTANT_RESOURCE_TYPE_BY_MODULE[module],resourceId:`resource-${kind}`,
        searchableText:[`Kaynak ${kind}`],occurredAt:NOW}];const unit=new MemoryUnit();
      const result=await new GenerateFamilyAiSuggestionUseCase(source,unit).execute({context,command:{
        clientOperationId:`operation-kind-${index}`,suggestionId:`suggestion-kind-${index}`,kind,
        ...(kind==='authorized_search'?{query:'kaynak'}:{})}});
      expect(result).toMatchObject({ok:true,value:{mutationKind:'suggestion_generate',revision:1}});
      expect(source.inputs[0]).toMatchObject({kind,modules:FAMILY_AI_ASSISTANT_MODULES_BY_KIND[kind]});
      expect(unit.scope.suggestions.get(`suggestion-kind-${index}`)?.purpose).toBe(
        kind==='authorized_search'?'search':['daily_summary','weekly_summary','plain_explanation'].includes(kind)?'summary'
          :['ocr_classification','duplicate_record'].includes(kind)?'classification':'recommendation');
    }
  });

  it('rejects missing search text, cross-workflow modules, extra fields and forged source pairs',async()=>{
    const source=new MemorySource();const unit=new MemoryUnit();const useCase=new GenerateFamilyAiSuggestionUseCase(source,unit);
    expect(await useCase.execute({context,command:{clientOperationId:'operation-no-query',suggestionId:'suggestion-no-query',
      kind:'authorized_search'}})).toMatchObject({ok:false,error:{category:'validation'}});
    expect(await useCase.execute({context,command:{clientOperationId:'operation-cross-module',suggestionId:'suggestion-cross-module',
      kind:'meeting_agenda',modules:['finance']}})).toMatchObject({ok:false,error:{category:'validation'}});
    expect(await useCase.execute({context,command:{clientOperationId:'operation-extra',suggestionId:'suggestion-extra',
      kind:'meeting_agenda',executePayment:true} as never})).toMatchObject({ok:false,error:{category:'validation'}});
    source.candidates=[{module:'event',resourceType:'health_record',resourceId:'forged-source',searchableText:['forged']}];
    expect(await useCase.execute({context,command:{clientOperationId:'operation-forged-source',suggestionId:'suggestion-forged-source',
      kind:'meeting_agenda',modules:['event']}})).toMatchObject({ok:false,error:{category:'authorization'}});
    expect(source.calls).toBe(1);
  });

  it('runs a transient local model response and revalidates the exact source set afterwards',async()=>{
    const source=new MemorySource();const model=new MemoryModel();const useCase=new RunFamilyAiLocalModelUseCase(source,model);
    const result=await useCase.execute({context,command:{kind:'authorized_search',modules:['event'],prompt:'aile toplantısı'}});
    expect(result).toMatchObject({ok:true,value:{kind:'authorized_search',sourceCount:1,provider:'ollama_loopback',
      model:'test-local:1',answer:'İzinli kaynaklara göre aile toplantısını gözden geçirin.',truth:{localLoopbackOnly:true,
        networkEgressUsed:false,cloudUsed:false,modelInferencePerformed:true,responsePersisted:false,
        durableActionPerformed:'not_performed',humanReviewRequired:true,sourceConsentRevalidatedAfterInference:true}}});
    expect(source.calls).toBe(2);expect(model.calls).toBe(1);
  });

  it('discards a model response when consent or source state changes during inference',async()=>{
    const source=new MemorySource();let calls=0;source.loadAuthorizedCandidates=(_context?:unknown,input?:unknown)=>{
      source.calls+=1;source.inputs.push(input);calls+=1;return Promise.resolve(ok(calls===1?[candidate]:[]));
    };
    const model=new MemoryModel();const result=await new RunFamilyAiLocalModelUseCase(source,model).execute({context,
      command:{kind:'authorized_search',prompt:'aile toplantısı'}});
    expect(result).toMatchObject({ok:false,error:{category:'authorization'}});expect(model.calls).toBe(1);
  });

  it('rejects local model authority fields and overlong prompts before loading sources',async()=>{
    const source=new MemorySource();const useCase=new RunFamilyAiLocalModelUseCase(source,new MemoryModel());
    expect(await useCase.execute({context,command:{kind:'daily_summary',prompt:'özetle',providerToken:'secret'} as never}))
      .toMatchObject({ok:false,error:{category:'validation'}});
    expect(await useCase.execute({context,command:{kind:'daily_summary',prompt:'x'.repeat(401)}}))
      .toMatchObject({ok:false,error:{category:'validation'}});
    expect(source.calls).toBe(0);
  });
});
