import { describe, expect, it } from 'vitest';
import {
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import {
  AddLocalTranslationDictionaryEntryUseCase,
  CancelLocalTranslationRequestUseCase,
  PrepareLocalTranslationRequestUseCase,
  RecordLocalTranslationCorrectionUseCase,
  UpdateLocalTranslationDictionaryEntryUseCase,
  UpdateLocalTranslationProfileUseCase,
  DeleteLocalTranslationDictionaryEntryUseCase,
  localTranslationKey,
  localTranslationSnapshotToCenterView,
  type LifeApplicationContext,
  type LifePolicyIntent,
  type LocalTranslationUnitOfWork,
  type LocalTranslationWriteScope
} from '../src/index.js';
import type {
  LocalTranslationDictionaryEntryRow,
  LocalTranslationEventRow,
  LocalTranslationMutationRow,
  LocalTranslationProfileRow,
  LocalTranslationRequestRow
} from '@ppt/repository-contracts';

const context:LifeApplicationContext={familyId:asFamilyId('family-34-e'),actor:{userId:asUserId('account-34-e'),
  role:'family_admin',personId:asPersonId('person-34-e')},correlationId:asCorrelationId('correlation-34-e')};
const at=asIsoDateTime('2026-08-15T17:00:00.000Z');

class MemoryUnitOfWork implements LocalTranslationUnitOfWork{
  profile:LocalTranslationProfileRow|null=null;dictionary:LocalTranslationDictionaryEntryRow[]=[];
  requests:LocalTranslationRequestRow[]=[];mutations:LocalTranslationMutationRow[]=[];events:LocalTranslationEventRow[]=[];
  audits=0;outbox=0;failOutbox=false;intents:LifePolicyIntent[]=[];
  async execute<T>(_context:LifeApplicationContext,intent:LifePolicyIntent,operation:(scope:LocalTranslationWriteScope)=>Result<T,AppError>){
    this.intents.push(intent);const snapshot={profile:this.profile,dictionary:[...this.dictionary],requests:[...this.requests],
      mutations:[...this.mutations],events:[...this.events],audits:this.audits,outbox:this.outbox};
    const scope:LocalTranslationWriteScope={occurredAt:at,ownerPersonId:context.actor.personId!,
      findProfile:()=>ok(this.profile),findDictionaryEntry:(id)=>ok(this.dictionary.find(item=>item.id===id)??null),
      findRequest:(id)=>ok(this.requests.find(item=>item.id===id)??null),
      findMutation:(id)=>ok(this.mutations.find(item=>item.clientOperationId===id)??null),
      insertMutation:(row)=>{this.mutations.push(row);return ok(undefined);},
      insertProfile:(row)=>{this.profile=row;return ok(undefined);},saveProfile:(row)=>{this.profile=row;return ok(undefined);},
      insertDictionaryEntry:(row)=>{this.dictionary.push(row);return ok(undefined);},
      saveDictionaryEntry:(row)=>{this.dictionary=this.dictionary.map(item=>item.id===row.id?row:item);return ok(undefined);},
      insertRequest:(row)=>{this.requests.push(row);return ok(undefined);},
      saveRequest:(row)=>{this.requests=this.requests.map(item=>item.id===row.id?row:item);return ok(undefined);},
      appendEvent:(row)=>{this.events.push(row);return ok(undefined);},appendAudit:()=>{this.audits++;return ok('audit');},
      enqueueEvent:()=>{if(this.failOutbox)return err(createAppError({code:'CORE-UNEXPECTED-001',category:'unexpected',
        message:'controlled outbox failure',correlationId:context.correlationId}));this.outbox++;return ok(undefined);}};
    const result=operation(scope);if(!result.ok){this.profile=snapshot.profile;this.dictionary=snapshot.dictionary;
      this.requests=snapshot.requests;this.mutations=snapshot.mutations;this.events=snapshot.events;
      this.audits=snapshot.audits;this.outbox=snapshot.outbox;}return result;
  }
}

const profileInput=(expectedRevision=0)=>({clientOperationId:'profile-operation-34-e',expectedRevision,
  preferredLanguage:'tr',secondaryLanguages:['en'],liveCaptionTranslationEnabled:true,translatedSpeechEnabled:false,
  preserveOriginalAudio:true as const,externalProviderAllowed:false,encryptedSyncRequested:true});

describe('34-E local translation language application',()=>{
  it('creates an owner-bound local-first profile and replays only the exact command',async()=>{
    const uow=new MemoryUnitOfWork();const useCase=new UpdateLocalTranslationProfileUseCase(uow);
    expect(await useCase.execute(context,profileInput())).toMatchObject({ok:true,value:{revision:1,replayed:false,
      providerConfigured:false,translationExecuted:false,networkUsed:false}});
    expect(await useCase.execute(context,profileInput())).toMatchObject({ok:true,value:{revision:1,replayed:true}});
    expect(uow.profile).toMatchObject({preferredLanguage:'tr',secondaryLanguages:['en'],localFirstRequired:true,
      preserveOriginalAudio:true,encryptedSyncRequested:true,encryptedSyncExecuted:false,revision:1});
    expect(uow.intents[0]).toMatchObject({resourceType:'local_translation_profile',action:'create',capability:'family.write'});
    const mismatch={...profileInput(),preferredLanguage:'de'};
    expect(await useCase.execute(context,mismatch)).toMatchObject({ok:false,error:{code:'RESOURCE-CONFLICT-001'}});
    expect(await useCase.execute(context,{...profileInput(1),clientOperationId:'profile-noop-34-e'}))
      .toMatchObject({ok:false,error:{code:'RESOURCE-CONFLICT-001'}});
  });

  it('adds, updates and content-clears a personal dictionary entry only with explicit permission',async()=>{
    const uow=new MemoryUnitOfWork();const add=new AddLocalTranslationDictionaryEntryUseCase(uow);
    const added=await add.execute(context,{clientOperationId:'dictionary-add-34-e',expectedRevision:0,category:'family_name',
      sourceLanguage:'tr',targetLanguage:'en',sourceTerm:'Yılmaz',preferredTerm:'Yilmaz',explicitPermission:true});
    expect(added).toMatchObject({ok:true,value:{revision:1}});const entry=uow.dictionary[0]!;
    const update=new UpdateLocalTranslationDictionaryEntryUseCase(uow);
    expect(await update.execute(context,{clientOperationId:'dictionary-source-change-34-e',expectedRevision:1,entryId:entry.id,
      category:'family_name',sourceLanguage:'tr',targetLanguage:'en',sourceTerm:'Yıldız',preferredTerm:'Yildiz family',
      explicitPermission:true})).toMatchObject({ok:false,error:{code:'RESOURCE-CONFLICT-001'}});
    expect(await update.execute(context,{clientOperationId:'dictionary-update-34-e',expectedRevision:1,entryId:entry.id,
      category:'family_name',sourceLanguage:'tr',targetLanguage:'en',sourceTerm:'Yılmaz',preferredTerm:'Yılmaz family',
      explicitPermission:true})).toMatchObject({ok:true,value:{revision:2}});
    expect(uow.dictionary[0]).toMatchObject({preferredTerm:'Yılmaz family',state:'active',revision:2});
    expect(await update.execute(context,{clientOperationId:'dictionary-noop-34-e',expectedRevision:2,entryId:entry.id,
      category:'family_name',sourceLanguage:'tr',targetLanguage:'en',sourceTerm:'Yılmaz',preferredTerm:'Yılmaz family',
      explicitPermission:true})).toMatchObject({ok:false,error:{code:'RESOURCE-CONFLICT-001'}});
    const remove=new DeleteLocalTranslationDictionaryEntryUseCase(uow);
    expect(await remove.execute(context,{clientOperationId:'dictionary-delete-34-e',expectedRevision:2,entryId:entry.id,
      reason:'Artık kullanmıyorum.'})).toMatchObject({ok:true,value:{revision:3}});
    expect(uow.dictionary[0]).toMatchObject({sourceTerm:'',preferredTerm:'',state:'deleted',revision:3});
  });

  it('requires external preview plus separate consent while keeping provider, network and execution false',async()=>{
    const uow=new MemoryUnitOfWork();const useCase=new PrepareLocalTranslationRequestUseCase(uow);
    const invalid=await useCase.execute(context,{clientOperationId:'external-invalid-34-e',expectedRevision:0,
      sourceKind:'message',sourceResourceId:'message-34-e',targetLanguage:'en',providerMode:'external_preview',
      externalPreviewAcknowledged:true,explicitExternalConsent:false});
    expect(invalid).toMatchObject({ok:false,error:{code:'CORE-VALIDATION-001'}});
    const input={clientOperationId:'external-valid-34-e',expectedRevision:0 as const,sourceKind:'message' as const,
      sourceResourceId:'message-34-e',targetLanguage:'en',providerMode:'external_preview' as const,
      externalPreviewAcknowledged:true,explicitExternalConsent:true};
    expect(await useCase.execute(context,input)).toMatchObject({ok:false,error:{code:'PERMISSION-DENIED-001'}});
    expect(await new UpdateLocalTranslationProfileUseCase(uow).execute(context,{...profileInput(),
      clientOperationId:'external-profile-34-e',externalProviderAllowed:true,encryptedSyncRequested:false})).toMatchObject({ok:true});
    expect(await useCase.execute(context,input)).toMatchObject({ok:true,value:{providerConfigured:false,
      translationExecuted:false,networkUsed:false,cloudUsed:false}});
    expect(uow.requests[0]).toMatchObject({state:'provider_unavailable',externalPreviewAcknowledged:true,
      explicitExternalConsent:true,languageDetectionExecuted:false,translationExecuted:false,speechToTextExecuted:false,
      speakerSeparationExecuted:false,liveCaptionTranslationExecuted:false,textToSpeechExecuted:false,networkUsed:false,cloudUsed:false});
  });

  it('records only a correction digest and then permits logical cancellation',async()=>{
    const uow=new MemoryUnitOfWork();const prepare=new PrepareLocalTranslationRequestUseCase(uow);
    const created=await prepare.execute(context,{clientOperationId:'local-request-34-e',expectedRevision:0,
      sourceKind:'document',sourceResourceId:'archive-item-34-e',targetLanguage:'en',providerMode:'local_offline',
      externalPreviewAcknowledged:false,explicitExternalConsent:false});
    if(!created.ok)throw new Error('fixture failed');const requestId=created.value.resourceId;
    const correct=new RecordLocalTranslationCorrectionUseCase(uow);
    expect(await correct.execute(context,{clientOperationId:'correction-34-e',expectedRevision:1,requestId,
      correctedText:'Düzeltilmiş metin',explicitPermission:true})).toMatchObject({ok:true,value:{revision:2}});
    expect(uow.requests[0]).toMatchObject({state:'correction_recorded',correctionCharacterCount:17});
    expect(JSON.stringify(uow.mutations)).not.toContain('Düzeltilmiş metin');
    const projected=localTranslationSnapshotToCenterView({profile:uow.profile,dictionary:uow.dictionary,requests:uow.requests},
      localTranslationKey(context,context.actor.personId!),at);
    expect(projected.requests[0]).not.toHaveProperty('correctionSha256');
    expect(await correct.execute(context,{clientOperationId:'correction-noop-34-e',expectedRevision:2,requestId,
      correctedText:'Düzeltilmiş metin',explicitPermission:true})).toMatchObject({ok:false,error:{code:'RESOURCE-CONFLICT-001'}});
    const cancel=new CancelLocalTranslationRequestUseCase(uow);
    expect(await cancel.execute(context,{clientOperationId:'cancel-34-e',expectedRevision:2,requestId,
      reason:'Artık gerekli değil.'})).toMatchObject({ok:true,value:{revision:3}});
    expect(uow.requests[0]?.state).toBe('cancelled');
  });

  it('rolls mutation, current row, event and audit back when outbox persistence fails',async()=>{
    const uow=new MemoryUnitOfWork();uow.failOutbox=true;
    const result=await new UpdateLocalTranslationProfileUseCase(uow).execute(context,profileInput());
    expect(result.ok).toBe(false);expect(uow.profile).toBeNull();expect(uow.mutations).toHaveLength(0);
    expect(uow.events).toHaveLength(0);expect(uow.audits).toBe(0);expect(uow.outbox).toBe(0);
  });

  it('projects defaults and explicit no-provider truth without fabricating outputs',()=>{
    const key=localTranslationKey(context,context.actor.personId!);
    const center=localTranslationSnapshotToCenterView({profile:null,dictionary:[],requests:[]},key,at);
    expect(center).toMatchObject({profile:{preferredLanguage:'tr',revision:0,encryptedSyncExecuted:false},
      truth:{commonTranslationProviderPortModeled:true,productionTranslationProviderConfigured:false,
        languageDetectionExecuted:false,translationExecuted:false,speechToTextExecuted:false,
        textToSpeechExecuted:false,networkUsedByCurrentImplementation:false}});
  });
});
