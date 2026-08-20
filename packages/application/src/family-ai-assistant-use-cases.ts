import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  asCorrelationId,
  asEventId,
  asIsoDateTime,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import type { DomainEvent } from '@ppt/events';
import {
  FAMILY_AI_ASSISTANT_KINDS,
  FAMILY_AI_ASSISTANT_MODULES_BY_KIND,
  FAMILY_AI_ASSISTANT_MODULES,
  FAMILY_AI_ASSISTANT_RESOURCE_TYPE_BY_MODULE,
  familyAiAssistantCenterId,
  familyAiAssistantPurposeForKind,
  type FamilyAiAssistantCenterView,
  type FamilyAiAssistantKind,
  type FamilyAiLocalModelResponseView,
  type FamilyAiLocalModelStatusView,
  type FamilyAiAssistantModule,
  type FamilyAiAssistantPurpose,
  type FamilyAiAssistantSourceReferenceView,
  type FamilyAiAssistantSourceResourceType,
  type FamilyAiSuggestionMutationReceiptView,
  type GenerateFamilyAiSuggestionInput,
  type RunFamilyAiLocalModelInput,
  type ReviewFamilyAiSuggestionInput
} from '@ppt/domain';
import {
  canonicalFamilyAiAssistantSources,
  type FamilyAiAssistantCenterKey,
  type FamilyAiSuggestionMutationRow,
  type FamilyAiSuggestionRow
} from '@ppt/repository-contracts';
import type { LifeApplicationContext, LifePolicyIntent } from './life-use-cases.js';

export interface FamilyAiAssistantAuthorizedCandidate {
  readonly module:FamilyAiAssistantModule;
  readonly resourceType:FamilyAiAssistantSourceResourceType;
  readonly resourceId:string;
  /** Main-process matching material; never persisted or returned over IPC. */
  readonly searchableText:readonly string[];
  readonly occurredAt?:string;
}

export interface FamilyAiAssistantSourcePort {
  loadAuthorizedCandidates(context:LifeApplicationContext,input:{
    readonly kind:FamilyAiAssistantKind;
    readonly purpose:FamilyAiAssistantPurpose;
    readonly modules:readonly FamilyAiAssistantModule[];
    readonly query?:string;
  }):Promise<Result<readonly FamilyAiAssistantAuthorizedCandidate[],AppError>>;
}

export interface FamilyAiAssistantQueryPort {
  getCenter(context:LifeApplicationContext):Promise<Result<FamilyAiAssistantCenterView,AppError>>;
}

export interface FamilyAiAssistantModelPort {
  getStatus():Promise<FamilyAiLocalModelStatusView>;
  run(input:{
    readonly correlationId:LifeApplicationContext['correlationId'];
    readonly systemPrompt:string;
    readonly userPrompt:string;
  }):Promise<Result<{readonly answer:string;readonly model:string;readonly generatedAt:FamilyAiLocalModelResponseView['generatedAt']},AppError>>;
}

export interface FamilyAiAssistantWriteScope {
  readonly occurredAt:FamilyAiSuggestionMutationRow['occurredAt'];
  findSuggestion(key:FamilyAiAssistantCenterKey,suggestionId:string):Result<FamilyAiSuggestionRow|null,AppError>;
  findMutation(key:FamilyAiAssistantCenterKey,clientOperationId:string):Result<FamilyAiSuggestionMutationRow|null,AppError>;
  revalidateSourceConsent(purpose:FamilyAiAssistantPurpose,sources:readonly FamilyAiAssistantSourceReferenceView[]):Result<boolean,AppError>;
  insertMutation(row:FamilyAiSuggestionMutationRow):Result<void,AppError>;
  insertSuggestion(row:FamilyAiSuggestionRow):Result<void,AppError>;
  saveSuggestion(row:FamilyAiSuggestionRow,expectedRevision:number):Result<void,AppError>;
  appendAudit(input:{readonly id:string;readonly action:string;readonly resourceType:string;readonly resourceId:string;
    readonly occurredAt:FamilyAiSuggestionMutationRow['occurredAt'];readonly actorId:LifeApplicationContext['actor']['userId']}):Result<string,AppError>;
  enqueueEvent<TPayload>(event:DomainEvent<TPayload>):Result<void,AppError>;
}

export interface FamilyAiAssistantUnitOfWork {
  execute<T>(context:LifeApplicationContext,intent:LifePolicyIntent,
    operation:(scope:FamilyAiAssistantWriteScope)=>Result<T,AppError>):Promise<Result<T,AppError>>;
}

const SAFE_ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{1,159}$/u;
const CONTROL=/[\p{Cc}\p{Cf}\p{Cs}]/u;
const kinds=new Set<string>(FAMILY_AI_ASSISTANT_KINDS);
const modules=new Set<string>(FAMILY_AI_ASSISTANT_MODULES);
const canonicalJson=(value:unknown):string=>{
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number')return Number.isFinite(value)?JSON.stringify(value):'null';
  if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;
  if(typeof value==='object'){
    const record=value as Record<string,unknown>;
    return `{${Object.keys(record).filter((key)=>record[key]!==undefined).sort()
      .map((key)=>`${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(null);
};
const hash=(value:unknown):string=>createHash('sha256').update(canonicalJson(value),'utf8').digest('hex');
const exactRecord=(value:unknown,required:readonly string[],optional:readonly string[]=[]):boolean=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const prototype=Object.getPrototypeOf(value);if(prototype!==Object.prototype&&prototype!==null)return false;
  const keys=Reflect.ownKeys(value);if(keys.some((key)=>typeof key==='symbol'))return false;
  const allowed=new Set([...required,...optional]);if(keys.some((key)=>!allowed.has(String(key))))return false;
  if(required.some((key)=>!Object.prototype.hasOwnProperty.call(value,key)))return false;
  return keys.every((key)=>{const descriptor=Object.getOwnPropertyDescriptor(value,key);
    return Boolean(descriptor&&!descriptor.get&&!descriptor.set&&'value' in descriptor);});
};
const error=(context:LifeApplicationContext,code:typeof ERROR_CODES.CORE_INVALID_ARGUMENT|typeof ERROR_CODES.RESOURCE_CONFLICT
  |typeof ERROR_CODES.RESOURCE_NOT_FOUND|typeof ERROR_CODES.AUTHORIZATION_DENIED,message:string,
category:'validation'|'conflict'|'not_found'|'authorization'):AppError=>createAppError({code,message,category,correlationId:context.correlationId});
const invalid=(context:LifeApplicationContext,message:string)=>error(context,ERROR_CODES.CORE_INVALID_ARGUMENT,message,'validation');
const conflict=(context:LifeApplicationContext,message:string)=>error(context,ERROR_CODES.RESOURCE_CONFLICT,message,'conflict');
const missing=(context:LifeApplicationContext,message:string)=>error(context,ERROR_CODES.RESOURCE_NOT_FOUND,message,'not_found');
const denied=(context:LifeApplicationContext,message:string)=>error(context,ERROR_CODES.AUTHORIZATION_DENIED,message,'authorization');

const keyFor=(context:LifeApplicationContext):Result<FamilyAiAssistantCenterKey,AppError>=>{
  if(!context.actor.personId)return err(denied(context,'Aile asistanı kişi bağlı oturum gerektirir.'));
  return ok(Object.freeze({familyId:context.familyId,accountId:context.actor.userId,actorPersonId:context.actor.personId,
    ownerPersonId:context.actor.personId,centerId:familyAiAssistantCenterId(context.familyId,context.actor.personId)}));
};

export const familyAiAssistantReadIntent=():LifePolicyIntent=>({action:'read',capability:'family.read',
  resourceType:'family_ai_assistant_center',resourceId:'*',purpose:'general'});
const writeIntent=(suggestionId:string,action:'create'|'update',ownerPersonId?:string):LifePolicyIntent=>({action,
  capability:'family.write',resourceType:'family_ai_suggestion',resourceId:suggestionId,purpose:'general',
  ...(action==='create'&&ownerPersonId?{ownerPersonId:asPersonId(ownerPersonId),privacy:'private' as const}:{})});

const canonicalModules=(context:LifeApplicationContext,kind:FamilyAiAssistantKind,input:unknown):Result<readonly FamilyAiAssistantModule[],AppError>=>{
  const allowed=FAMILY_AI_ASSISTANT_MODULES_BY_KIND[kind];
  if(input===undefined)return ok(allowed);
  if(!Array.isArray(input)||input.length<1||input.length>FAMILY_AI_ASSISTANT_MODULES.length
    ||input.some((item)=>typeof item!=='string'||!modules.has(item)||!allowed.includes(item as FamilyAiAssistantModule))
    ||new Set(input).size!==input.length)
    return err(invalid(context,'Aile asistanı kaynak modülleri geçersizdir.'));
  return ok(Object.freeze([...input] as FamilyAiAssistantModule[]));
};
const query=(context:LifeApplicationContext,kind:FamilyAiAssistantKind,value:unknown):Result<string|undefined,AppError>=>{
  if(kind!=='authorized_search')return value===undefined?ok(undefined)
    :err(invalid(context,'Arama ifadesi yalnız izinli yerel arama türünde kullanılabilir.'));
  if(value===undefined||value==='')return err(invalid(context,'İzinli yerel arama için arama ifadesi zorunludur.'));
  if(typeof value!=='string')return err(invalid(context,'Aile asistanı sorgusu metin olmalıdır.'));
  const normalized=value.normalize('NFKC').trim().replace(/\s+/gu,' ');
  return normalized.length>=2&&normalized.length<=80&&!CONTROL.test(normalized)
    ?ok(normalized):err(invalid(context,'Aile asistanı sorgusu geçersizdir.'));
};
const candidateSafe=(candidate:FamilyAiAssistantAuthorizedCandidate):boolean=>modules.has(candidate.module)
  &&candidate.resourceType===FAMILY_AI_ASSISTANT_RESOURCE_TYPE_BY_MODULE[candidate.module]
  &&SAFE_ID.test(candidate.resourceId)&&candidate.searchableText.length>=1&&candidate.searchableText.length<=12
  &&candidate.searchableText.some((item)=>typeof item==='string'&&item.trim().length>0)
  &&candidate.searchableText.every((item)=>typeof item==='string'&&item.length<=1000&&!CONTROL.test(item))
  &&(candidate.occurredAt===undefined||(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(candidate.occurredAt)
    &&Number.isFinite(Date.parse(candidate.occurredAt))));

const modelPrompt=(context:LifeApplicationContext,kind:FamilyAiAssistantKind,prompt:string,
  candidates:readonly FamilyAiAssistantAuthorizedCandidate[]):Result<string,AppError>=>{
  const rows:string[]=[];let used=0;
  for(const candidate of candidates){
    const text=candidate.searchableText.map((value)=>value.normalize('NFKC').trim().replace(/\s+/gu,' '))
      .filter(Boolean).join(' | ');
    if(!text)continue;
    const row=`[${candidate.module}] ${text}`;if(used+row.length>12_000)break;
    rows.push(row);used+=row.length;
  }
  if(rows.length<1)return err(denied(context,'Yerel model için izinli ve içerik taşıyan kaynak bulunamadı.'));
  return ok(`İstek türü: ${kind}\nKullanıcı talebi: ${prompt}\n\nYalnız aşağıdaki izinli yerel kaynakları kullan:\n${rows.join('\n')}`);
};

const candidateFingerprint=(candidates:readonly FamilyAiAssistantAuthorizedCandidate[]):string=>hash(candidates.map((candidate)=>({
  module:candidate.module,resourceType:candidate.resourceType,resourceId:candidate.resourceId,
  searchableText:candidate.searchableText.map((value)=>value.normalize('NFKC').trim().replace(/\s+/gu,' ')),
  occurredAt:candidate.occurredAt??null
})));

const LOCAL_MODEL_SYSTEM_PROMPT=`Sen ParsYuva Aile Yaşam Merkezi içindeki yerel aile yardımcısısın. Yalnız verilen izinli yerel kaynakları kullan.
Kaynakta bulunmayan bilgiyi uydurma. Parola, anahtar, dosya yolu veya teknik kimlik döndürme.
Tıbbi, mali ya da acil durum kararı verme; yalnız inceleme özeti sun ve gerektiğinde uzman doğrulaması iste.
Hiçbir ödeme, rezervasyon, mesaj, silme veya başka kalıcı işlem yaptığını söyleme.
Türkçe, açık ve en fazla 2500 karakterlik tek bir yanıt üret.`;

const presentation:Readonly<Record<FamilyAiAssistantKind,{readonly title:string;readonly explanation:(count:number)=>string}>>=Object.freeze({
  authorized_search:{title:'İzinli yerel arama sonucu',explanation:(count)=>`${count} izinli yerel kaynak eşleşti; sonuçları kaynağından doğrulayın.`},
  daily_summary:{title:'Günlük aile özeti önerisi',explanation:(count)=>`${count} izinli yerel kaynak günlük gözden geçirme için işaretlendi.`},
  weekly_summary:{title:'Haftalık aile özeti önerisi',explanation:(count)=>`${count} izinli yerel kaynak haftalık gözden geçirme için işaretlendi.`},
  reminder_review:{title:'Hatırlatma gözden geçirme önerisi',explanation:(count)=>`${count} kaynakta yaklaşan veya açık kayıt bulunabilir; insan kontrolü gerekir.`},
  emergency_bag:{title:'Acil durum çantası kontrol önerisi',explanation:(count)=>`${count} izinli kaynağa göre yerel kontrol listesi gözden geçirilebilir.`},
  meeting_agenda:{title:'Aile toplantısı gündem önerisi',explanation:(count)=>`${count} izinli kaynak toplantı gündeminde gözden geçirilebilir.`},
  ocr_classification:{title:'OCR sınıflandırma önerisi',explanation:(count)=>`${count} yerel OCR veya arşiv kaydı sınıflandırma için insan incelemesi bekliyor.`},
  duplicate_record:{title:'Olası yinelenen kayıt incelemesi',explanation:(count)=>`${count} izinli kaynak arasında yalnızca kullanıcı tarafından doğrulanabilecek eşleşmeler olabilir.`},
  family_story:{title:'Aile hikâyesi derleme önerisi',explanation:(count)=>`${count} izinli yerel kaynak aile hikâyesi için seçilebilir.`},
  spending_review:{title:'Harcama gözden geçirme önerisi',explanation:(count)=>`${count} izinli yerel kayıt bütçe kararı vermeden gözden geçirilebilir.`},
  meal_plan:{title:'Yemek planı gözden geçirme önerisi',explanation:(count)=>`${count} izinli ev kaydı yemek planı için insan kontrolüne sunuldu.`},
  shopping_list:{title:'Alışveriş listesi gözden geçirme önerisi',explanation:(count)=>`${count} izinli ev kaydı alışveriş listesi için insan kontrolüne sunuldu.`},
  plain_explanation:{title:'Sade anlatım önerisi',explanation:(count)=>`${count} izinli kaynak için otomatik uzman yorumu vermeyen sade gözden geçirme hazırlanabilir.`},
  read_aloud:{title:'Sesli okuma hazırlık önerisi',explanation:(count)=>`${count} izinli kaynak seçildi; bu aşamada ses üretimi yapılmadı.`},
  translation:{title:'Çeviri hazırlık önerisi',explanation:(count)=>`${count} izinli kaynak seçildi; bu aşamada çeviri veya ağ aktarımı yapılmadı.`}
});

const stateFingerprint=(row:Omit<FamilyAiSuggestionRow,'stateFingerprint'>):string=>hash({id:row.id,familyId:row.familyId,
  ownerPersonId:row.ownerPersonId,kind:row.kind,purpose:row.purpose,status:row.status,title:row.title,
  explanation:row.explanation,confidenceBasisPoints:row.confidenceBasisPoints,sources:row.sources,
  sourceFingerprint:row.sourceFingerprint,revision:row.revision,createdAt:row.createdAt,updatedAt:row.updatedAt,
  confirmedAt:row.confirmedAt??null,dismissedAt:row.dismissedAt??null,lastMutationId:row.lastMutationId});
const receipt=(row:FamilyAiSuggestionMutationRow,replayed:boolean):FamilyAiSuggestionMutationReceiptView=>Object.freeze({
  suggestionId:row.suggestionId,mutationKind:row.mutationKind,previousRevision:row.expectedRevision,revision:row.revision,
  occurredAt:row.occurredAt,replayed,durableActionPerformed:'not_performed',
  humanConfirmationRecorded:row.mutationKind==='suggestion_confirm',networkUsed:false,cloudUsed:false
});
const replay=(context:LifeApplicationContext,existing:FamilyAiSuggestionMutationRow|null,requestFingerprint:string,
  kind:FamilyAiSuggestionMutationRow['mutationKind'],suggestionId:string):Result<FamilyAiSuggestionMutationReceiptView|null,AppError>=>{
  if(!existing)return ok(null);
  return existing.requestFingerprint===requestFingerprint&&existing.mutationKind===kind&&existing.suggestionId===suggestionId
    ?ok(receipt(existing,true)):err(conflict(context,'Aynı işlem kimliği farklı bir aile asistanı komutuyla kullanıldı.'));
};
const persist=(context:LifeApplicationContext,scope:FamilyAiAssistantWriteScope,mutation:FamilyAiSuggestionMutationRow,
  suggestion:FamilyAiSuggestionRow,auditId:string,eventId:ReturnType<typeof asEventId>):Result<FamilyAiSuggestionMutationReceiptView,AppError>=>{
  const ledger=scope.insertMutation(mutation);if(!ledger.ok)return ledger;
  const current=mutation.expectedRevision===0?scope.insertSuggestion(suggestion):scope.saveSuggestion(suggestion,mutation.expectedRevision);
  if(!current.ok)return current;
  const audit=scope.appendAudit({id:auditId,action:`family_ai.${mutation.mutationKind}`,resourceType:'family_ai_suggestion',
    resourceId:suggestion.id,occurredAt:mutation.occurredAt,actorId:context.actor.userId});if(!audit.ok)return audit;
  const event=scope.enqueueEvent({eventId,eventType:`family_ai.${mutation.mutationKind}`,eventVersion:1,
    aggregateType:'family_ai_suggestion',aggregateId:suggestion.id,occurredAt:mutation.occurredAt,
    actorId:context.actor.userId,correlationId:context.correlationId,payload:{suggestionId:suggestion.id,kind:suggestion.kind,
      purpose:suggestion.purpose,status:suggestion.status,sourceCount:suggestion.sources.length,revision:suggestion.revision,
      durableActionPerformed:'not_performed',humanConfirmationRecorded:mutation.mutationKind==='suggestion_confirm'}});
  return event.ok?ok(receipt(mutation,false)):event;
};

export class GetFamilyAiAssistantCenterUseCase {
  public constructor(private readonly queryPort:FamilyAiAssistantQueryPort){}
  public execute(context:LifeApplicationContext){return this.queryPort.getCenter(context);}
}

export class GetFamilyAiLocalModelStatusUseCase {
  public constructor(private readonly model:FamilyAiAssistantModelPort){}
  public execute(){return this.model.getStatus();}
}

export class RunFamilyAiLocalModelUseCase {
  public constructor(private readonly source:FamilyAiAssistantSourcePort,private readonly model:FamilyAiAssistantModelPort){}
  public async execute(input:{readonly context:LifeApplicationContext;readonly command:RunFamilyAiLocalModelInput})
  :Promise<Result<FamilyAiLocalModelResponseView,AppError>>{
    const {context,command}=input;
    if(!context.actor.personId)return err(denied(context,'Yerel model kişi bağlı oturum gerektirir.'));
    if(!exactRecord(command,['kind','prompt'],['modules'])||!kinds.has(command.kind))
      return err(invalid(context,'Yerel model komutu yalnız izin verilen alanları taşımalıdır.'));
    if(typeof command.prompt!=='string')return err(invalid(context,'Yerel model talebi metin olmalıdır.'));
    const prompt=command.prompt.normalize('NFKC').trim().replace(/\s+/gu,' ');
    if(prompt.length<2||prompt.length>400||CONTROL.test(prompt))
      return err(invalid(context,'Yerel model talebi 2-400 karakter arasında olmalıdır.'));
    const selected=canonicalModules(context,command.kind,command.modules);if(!selected.ok)return selected;
    const purpose=familyAiAssistantPurposeForKind(command.kind);
    const queryValue=command.kind==='authorized_search'?prompt:undefined;
    const load=()=>this.source.loadAuthorizedCandidates(context,{kind:command.kind,purpose,modules:selected.value,
      ...(queryValue?{query:queryValue}:{})});
    let before:Result<readonly FamilyAiAssistantAuthorizedCandidate[],AppError>;
    try{before=await load();}catch{return err(denied(context,'Yerel modelin izinli kaynakları yüklenemedi.'));}
    if(!before.ok)return before;
    if(before.value.length<1||before.value.length>24||before.value.some((candidate)=>!candidateSafe(candidate)
      ||!selected.value.includes(candidate.module)))return err(denied(context,'Yerel model yalnız tam ve sınırlı izinli kaynak kümesiyle çalışır.'));
    const userPrompt=modelPrompt(context,command.kind,prompt,before.value);if(!userPrompt.ok)return userPrompt;
    const fingerprint=candidateFingerprint(before.value);
    let generated:Awaited<ReturnType<FamilyAiAssistantModelPort['run']>>;
    try{generated=await this.model.run({correlationId:context.correlationId,systemPrompt:LOCAL_MODEL_SYSTEM_PROMPT,
      userPrompt:userPrompt.value});}catch{return err(createAppError({code:ERROR_CODES.CORE_UNEXPECTED,
      message:'Yerel model yanıt vermedi.',category:'infrastructure',retryable:true,correlationId:context.correlationId}));}
    if(!generated.ok)return generated;
    const answer=generated.value.answer.normalize('NFKC').trim();
    if(answer.length<1||answer.length>4000||CONTROL.test(answer))return err(createAppError({code:ERROR_CODES.CORE_UNEXPECTED,
      message:'Yerel model güvenli yanıt sınırını aşan bir sonuç verdi.',category:'security',correlationId:context.correlationId}));
    let after:Result<readonly FamilyAiAssistantAuthorizedCandidate[],AppError>;
    try{after=await load();}catch{return err(denied(context,'Model yanıtından sonra kaynak izni yeniden doğrulanamadı.'));}
    if(!after.ok)return after;
    if(candidateFingerprint(after.value)!==fingerprint)return err(denied(context,
      'Model çalışırken kaynak veya izin kapsamı değişti; geçici yanıt güvenle atıldı.'));
    return ok(Object.freeze({kind:command.kind,answer,sourceCount:before.value.length,provider:'ollama_loopback' as const,
      model:generated.value.model,generatedAt:generated.value.generatedAt,truth:Object.freeze({localLoopbackOnly:true as const,
        networkEgressUsed:false as const,cloudUsed:false as const,modelInferencePerformed:true as const,responsePersisted:false as const,
        durableActionPerformed:'not_performed' as const,humanReviewRequired:true as const,
        sourceConsentRevalidatedAfterInference:true as const,medicalFinancialOrEmergencyDecisionProvided:false as const})}));
  }
}

export class GenerateFamilyAiSuggestionUseCase {
  public constructor(private readonly source:FamilyAiAssistantSourcePort,private readonly unitOfWork:FamilyAiAssistantUnitOfWork){}
  public async execute(input:{readonly context:LifeApplicationContext;readonly command:GenerateFamilyAiSuggestionInput})
  :Promise<Result<FamilyAiSuggestionMutationReceiptView,AppError>>{
    const {context,command}=input;if(!context.actor.personId)return err(denied(context,'Aile asistanı kişi bağlı oturum gerektirir.'));
    if(!exactRecord(command,['clientOperationId','suggestionId','kind'],['modules','query']))
      return err(invalid(context,'Aile asistanı üretim komutu yalnız izin verilen alanları taşımalıdır.'));
    if(!SAFE_ID.test(command.clientOperationId)||!SAFE_ID.test(command.suggestionId)||!kinds.has(command.kind))
      return err(invalid(context,'Aile asistanı işlem, öneri veya tür kimliği geçersizdir.'));
    const selected=canonicalModules(context,command.kind,command.modules);if(!selected.ok)return selected;
    const normalizedQuery=query(context,command.kind,command.query);if(!normalizedQuery.ok)return normalizedQuery;
    const purpose=familyAiAssistantPurposeForKind(command.kind);
    const requestFingerprint=hash({command:{clientOperationId:command.clientOperationId,suggestionId:command.suggestionId,
      kind:command.kind,modules:selected.value,query:normalizedQuery.value??null},purpose});
    const key=keyFor(context);if(!key.ok)return key;const intent=writeIntent(command.suggestionId,'create',context.actor.personId);
    const preflightContext:LifeApplicationContext={...context,correlationId:asCorrelationId(hash({
      correlationId:context.correlationId,slot:'family_ai_generate_replay'}))};
    const preflight=await this.unitOfWork.execute(preflightContext,intent,(scope)=>{
      const existing=scope.findMutation(key.value,command.clientOperationId);if(!existing.ok)return existing;
      return replay(context,existing.value,requestFingerprint,'suggestion_generate',command.suggestionId);
    });
    if(!preflight.ok)return preflight;if(preflight.value)return ok(preflight.value);
    let loaded:Result<readonly FamilyAiAssistantAuthorizedCandidate[],AppError>;
    try{loaded=await this.source.loadAuthorizedCandidates(context,{kind:command.kind,purpose,modules:selected.value,
      ...(normalizedQuery.value?{query:normalizedQuery.value}:{})});}catch{return err(denied(context,'İzinli aile asistanı kaynakları yüklenemedi.'));}
    if(!loaded.ok)return loaded;
    if(loaded.value.length<1||loaded.value.length>24||loaded.value.some((candidate)=>!candidateSafe(candidate)
      ||!selected.value.includes(candidate.module)))return err(denied(context,'Aile asistanı yalnız tam ve sınırlı izinli kaynak kümesiyle çalışır.'));
    const sources=canonicalFamilyAiAssistantSources(loaded.value.map(({module,resourceType,resourceId})=>({module,resourceType,resourceId})));
    if(new Set(sources.map((source)=>`${source.resourceType}:${source.resourceId}`)).size!==sources.length)
      return err(invalid(context,'Aile asistanı kaynak kümesi yinelenen kayıt içeriyor.'));
    const sourceFingerprint=hash(sources);
    return this.unitOfWork.execute(context,intent,(scope)=>{
      const existingMutation=scope.findMutation(key.value,command.clientOperationId);if(!existingMutation.ok)return existingMutation;
      const replayed=replay(context,existingMutation.value,requestFingerprint,'suggestion_generate',command.suggestionId);
      if(!replayed.ok||replayed.value)return replayed.ok?ok(replayed.value!):replayed;
      const current=scope.findSuggestion(key.value,command.suggestionId);if(!current.ok)return current;
      if(current.value)return err(conflict(context,'Aile asistanı öneri kimliği zaten kullanılıyor.'));
      const consent=scope.revalidateSourceConsent(purpose,sources);if(!consent.ok)return consent;
      if(!consent.value)return err(denied(context,'Önerinin bütün kaynakları için etkin ve aynı amaçlı açık izin gerekir.'));
      const label=presentation[command.kind];const mutationId=hash({familyId:context.familyId,accountId:context.actor.userId,
        clientOperationId:command.clientOperationId,requestFingerprint});const occurredAt=asIsoDateTime(scope.occurredAt);
      const base:Omit<FamilyAiSuggestionRow,'stateFingerprint'>={id:command.suggestionId,familyId:context.familyId,
        ownerPersonId:context.actor.personId!,kind:command.kind,purpose,status:'pending_confirmation',title:label.title,
        explanation:label.explanation(sources.length),confidenceBasisPoints:Math.min(9000,6000+sources.length*250),sources,
        sourceFingerprint,revision:1,lastMutationId:mutationId,createdAt:occurredAt,updatedAt:occurredAt};
      const suggestion:FamilyAiSuggestionRow=Object.freeze({...base,stateFingerprint:stateFingerprint(base)});
      const mutation:FamilyAiSuggestionMutationRow=Object.freeze({id:mutationId,familyId:context.familyId,
        ownerPersonId:context.actor.personId!,suggestionId:command.suggestionId,actorAccountId:context.actor.userId,
        actorPersonId:context.actor.personId!,mutationKind:'suggestion_generate',purpose,clientOperationId:command.clientOperationId,
        requestFingerprint,expectedRevision:0,revision:1,suggestionStateFingerprint:suggestion.stateFingerprint,
        sourceFingerprint,sourceCount:sources.length,occurredAt});
      return persist(context,scope,mutation,suggestion,hash({mutationId,kind:'audit'}),asEventId(hash({mutationId,kind:'event'})));
    });
  }
}

export class ReviewFamilyAiSuggestionUseCase {
  public constructor(private readonly unitOfWork:FamilyAiAssistantUnitOfWork){}
  public async execute(input:{readonly context:LifeApplicationContext;readonly command:ReviewFamilyAiSuggestionInput})
  :Promise<Result<FamilyAiSuggestionMutationReceiptView,AppError>>{
    const {context,command}=input;if(!context.actor.personId)return err(denied(context,'Aile asistanı kişi bağlı oturum gerektirir.'));
    if(!exactRecord(command,['clientOperationId','suggestionId','expectedRevision','decision']))
      return err(invalid(context,'Öneri inceleme komutu yalnız izin verilen alanları taşımalıdır.'));
    if(!SAFE_ID.test(command.clientOperationId)||!SAFE_ID.test(command.suggestionId)||!Number.isSafeInteger(command.expectedRevision)
      ||command.expectedRevision<1||!['confirm','dismiss'].includes(command.decision))return err(invalid(context,'Öneri inceleme komutu geçersizdir.'));
    const key=keyFor(context);if(!key.ok)return key;const mutationKind=command.decision==='confirm'?'suggestion_confirm':'suggestion_dismiss';
    const requestFingerprint=hash(command);
    return this.unitOfWork.execute(context,writeIntent(command.suggestionId,'update'),(scope)=>{
      const prior=scope.findMutation(key.value,command.clientOperationId);if(!prior.ok)return prior;
      const replayed=replay(context,prior.value,requestFingerprint,mutationKind,command.suggestionId);
      if(!replayed.ok||replayed.value)return replayed.ok?ok(replayed.value!):replayed;
      const current=scope.findSuggestion(key.value,command.suggestionId);if(!current.ok)return current;
      if(!current.value)return err(missing(context,'Aile asistanı önerisi bulunamadı.'));
      if(current.value.revision!==command.expectedRevision)return err(conflict(context,'Öneri sürümü değişti; güncel görünüm yeniden yüklenmelidir.'));
      if(current.value.status!=='pending_confirmation')return err(conflict(context,'Öneri daha önce incelenmiş.'));
      if(command.decision==='confirm'){
        const consent=scope.revalidateSourceConsent(current.value.purpose,current.value.sources);if(!consent.ok)return consent;
        if(!consent.value)return err(denied(context,'Kaynak izni geri çekilmiş öneri onaylanamaz veya yeniden işlenemez.'));
      }
      const occurredAt=asIsoDateTime(scope.occurredAt);const revision=current.value.revision+1;
      const mutationId=hash({familyId:context.familyId,accountId:context.actor.userId,
        clientOperationId:command.clientOperationId,requestFingerprint});
      const base:Omit<FamilyAiSuggestionRow,'stateFingerprint'>={...current.value,status:command.decision==='confirm'?'confirmed':'dismissed',
        revision,lastMutationId:mutationId,updatedAt:occurredAt,
        ...(command.decision==='confirm'?{confirmedAt:occurredAt}:{dismissedAt:occurredAt})};
      const suggestion:FamilyAiSuggestionRow=Object.freeze({...base,stateFingerprint:stateFingerprint(base)});
      const mutation:FamilyAiSuggestionMutationRow=Object.freeze({id:mutationId,familyId:current.value.familyId,
        ownerPersonId:current.value.ownerPersonId,suggestionId:current.value.id,actorAccountId:context.actor.userId,
        actorPersonId:context.actor.personId!,mutationKind,purpose:current.value.purpose,clientOperationId:command.clientOperationId,
        requestFingerprint,expectedRevision:current.value.revision,revision,suggestionStateFingerprint:suggestion.stateFingerprint,
        sourceFingerprint:current.value.sourceFingerprint,sourceCount:current.value.sources.length,occurredAt});
      return persist(context,scope,mutation,suggestion,hash({mutationId,kind:'audit'}),asEventId(hash({mutationId,kind:'event'})));
    });
  }
}
