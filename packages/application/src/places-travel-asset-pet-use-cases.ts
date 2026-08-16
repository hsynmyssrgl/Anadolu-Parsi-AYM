import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  asEventId,
  asIsoDate,
  asIsoDateTime,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import {
  PLACES_TRAVEL_AREAS,
  PLACES_TRAVEL_KINDS,
  PLACES_TRAVEL_VISIBILITIES,
  placesTravelAreaForKind,
  placesTravelCenterId,
  type CreatePlacesTravelItemInput,
  type DeletePlacesTravelItemInput,
  type PlacesTravelCenterView,
  type PlacesTravelItemView,
  type PlacesTravelMutationKind,
  type PlacesTravelMutationReceiptView,
  type PlacesTravelVisibility,
  type UpdatePlacesTravelItemInput
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import {
  placesTravelVisibilityPrivacy,
  type PlacesTravelCenterKey,
  type PlacesTravelItemRow,
  type PlacesTravelMutationRow
} from '@ppt/repository-contracts';
import type { LifeApplicationContext, LifePolicyIntent } from './life-use-cases.js';

export interface PlacesTravelAssetPetQueryPort {
  getCenter(context:LifeApplicationContext,ownerPersonId:string):Promise<Result<PlacesTravelCenterView,AppError>>;
}

export interface PlacesTravelAssetPetWriteScope {
  readonly occurredAt:PlacesTravelMutationRow['occurredAt'];
  findPerson(personId:string):Result<{readonly id:string;readonly familyId:string;readonly status:string}|null,AppError>;
  authorize(input:{readonly action:'read'|'create'|'update'|'delete';readonly resourceType:'places_travel_item';
    readonly resourceId:string;readonly ownerPersonId:string;readonly privacy:'private'|'selected_members'|'family'}):Result<boolean,AppError>;
  findItem(key:PlacesTravelCenterKey,itemId:string):Result<PlacesTravelItemRow|null,AppError>;
  findMutation(key:PlacesTravelCenterKey,clientOperationId:string):Result<PlacesTravelMutationRow|null,AppError>;
  insertMutation(row:PlacesTravelMutationRow):Result<void,AppError>;
  insertItem(row:PlacesTravelItemRow):Result<void,AppError>;
  saveItem(row:PlacesTravelItemRow,expectedRevision:number):Result<void,AppError>;
  appendAudit(input:{readonly id:string;readonly action:string;readonly resourceType:string;readonly resourceId:string;
    readonly occurredAt:PlacesTravelMutationRow['occurredAt'];readonly actorId:LifeApplicationContext['actor']['userId']}):Result<string,AppError>;
  enqueueEvent<TPayload>(event:DomainEvent<TPayload>):Result<void,AppError>;
}

export interface PlacesTravelAssetPetUnitOfWork {
  execute<T>(context:LifeApplicationContext,intent:LifePolicyIntent,
    operation:(scope:PlacesTravelAssetPetWriteScope)=>Result<T,AppError>):Promise<Result<T,AppError>>;
}

const SAFE_ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{1,255}$/u;
const CURRENCY=/^[A-Z]{3}$/u;
const LANGUAGE=/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/u;
const DATE=/^\d{4}-\d{2}-\d{2}$/u;
const CONTROL=/[\p{Cc}\p{Cf}\p{Cs}]/u;
const kinds=new Set<string>(PLACES_TRAVEL_KINDS);
const visibilities=new Set<string>(PLACES_TRAVEL_VISIBILITIES);
const statuses=new Set<PlacesTravelItemView['status']>(['planned','active','completed','cancelled','expired','settled']);
const petWorkflows=new Set(['vaccination','veterinary','microchip','food','insurance','travel_document']);
const documentKinds=new Set(['passport','visa','insurance','reservation_document','other']);
const requirementKinds=new Set(['health','medication','child','pet']);

const hash=(value:unknown):string=>createHash('sha256').update(JSON.stringify(value),'utf8').digest('hex');
const appError=(context:LifeApplicationContext,code:typeof ERROR_CODES.CORE_INVALID_ARGUMENT|typeof ERROR_CODES.RESOURCE_CONFLICT
  |typeof ERROR_CODES.RESOURCE_NOT_FOUND|typeof ERROR_CODES.AUTHORIZATION_DENIED,message:string,
category:'validation'|'conflict'|'not_found'|'authorization'):AppError=>createAppError({code,message,category,correlationId:context.correlationId});
const invalid=(context:LifeApplicationContext,message:string)=>appError(context,ERROR_CODES.CORE_INVALID_ARGUMENT,message,'validation');
const conflict=(context:LifeApplicationContext,message:string)=>appError(context,ERROR_CODES.RESOURCE_CONFLICT,message,'conflict');
const missing=(context:LifeApplicationContext,message:string)=>appError(context,ERROR_CODES.RESOURCE_NOT_FOUND,message,'not_found');
const denied=(context:LifeApplicationContext,message:string)=>appError(context,ERROR_CODES.AUTHORIZATION_DENIED,message,'authorization');

const text=(context:LifeApplicationContext,value:unknown,label:string,min:number,max:number):Result<string,AppError>=>{
  if(typeof value!=='string')return err(invalid(context,`${label} metin olmalıdır.`));
  const normalized=value.normalize('NFKC').trim();
  return normalized.length>=min&&normalized.length<=max&&!CONTROL.test(normalized)?ok(normalized):err(invalid(context,`${label} geçersizdir.`));
};
const optionalText=(context:LifeApplicationContext,value:unknown,label:string,max:number):Result<string|undefined,AppError>=>
  value===undefined?ok(undefined):text(context,value,label,1,max);
const optionalIdentifier=(context:LifeApplicationContext,value:unknown,label:string):Result<string|undefined,AppError>=>{
  if(value===undefined)return ok(undefined);
  const normalized=typeof value==='string'?value.normalize('NFKC').trim():'';
  return SAFE_ID.test(normalized)?ok(normalized):err(invalid(context,`${label} geçersizdir.`));
};
const timestamp=(context:LifeApplicationContext,value:unknown,label:string):Result<PlacesTravelMutationRow['occurredAt']|undefined,AppError>=>{
  if(value===undefined)return ok(undefined);
  const parsed=typeof value==='string'?Date.parse(value):Number.NaN;
  if(typeof value!=='string'||!Number.isFinite(parsed)||new Date(parsed).toISOString()!==value)return err(invalid(context,`${label} geçersizdir.`));
  return ok(asIsoDateTime(value));
};
const date=(context:LifeApplicationContext,value:unknown,label:string):Result<ReturnType<typeof asIsoDate>|undefined,AppError>=>{
  if(value===undefined)return ok(undefined);
  const parsed=typeof value==='string'?Date.parse(`${value}T00:00:00.000Z`):Number.NaN;
  if(typeof value!=='string'||!DATE.test(value)||!Number.isFinite(parsed)
    ||new Date(parsed).toISOString().slice(0,10)!==value)return err(invalid(context,`${label} geçersizdir.`));
  return ok(asIsoDate(value));
};
const identifiers=(context:LifeApplicationContext,values:unknown):Result<readonly string[]|undefined,AppError>=>{
  if(values===undefined)return ok(undefined);
  if(!Array.isArray(values)||values.length<1||values.length>50)return err(invalid(context,'Katılımcı listesi 1–50 kişi olmalıdır.'));
  const normalized=values.map((value)=>typeof value==='string'?value.normalize('NFKC').trim():'');
  return normalized.every((value)=>SAFE_ID.test(value))&&new Set(normalized).size===normalized.length
    ?ok(Object.freeze(normalized)):err(invalid(context,'Katılımcı kimlikleri geçersiz veya tekrarlıdır.'));
};

const keyFor=(context:LifeApplicationContext,ownerPersonId:string):Result<PlacesTravelCenterKey,AppError>=>{
  if(!context.actor.personId||!SAFE_ID.test(ownerPersonId))return err(denied(context,'Yer ve seyahat merkezi kişi bağlı oturum gerektirir.'));
  return ok(Object.freeze({familyId:context.familyId,accountId:context.actor.userId,actorPersonId:context.actor.personId,
    ownerPersonId:asPersonId(ownerPersonId),centerId:placesTravelCenterId(context.familyId,ownerPersonId)}));
};
const readIntent=(ownerPersonId:string):LifePolicyIntent=>({action:'read',capability:'family.read',resourceType:'places_travel_center',
  resourceId:'*',purpose:'general',ownerPersonId:asPersonId(ownerPersonId),privacy:'family'});
const writeIntent=(itemId:string,action:'create'|'update'|'delete',ownerPersonId?:string,visibility?:PlacesTravelVisibility):LifePolicyIntent=>({
  action,capability:'family.write',resourceType:'places_travel_item',resourceId:itemId,purpose:'general',
  ...(action==='create'&&ownerPersonId&&visibility?{ownerPersonId:asPersonId(ownerPersonId),privacy:placesTravelVisibilityPrivacy(visibility)}:{})
});

const allowedFields:Readonly<Record<string,ReadonlySet<string>>>=Object.freeze({
  stored_place:new Set(['addressLabel','latitudeE6','longitudeE6','offlineFallbackLabel']),
  moving_inventory:new Set(['archiveItemId','ocrJobId']),
  pet_care_record:new Set(['archiveItemId','expiresOn','petReferenceId','petWorkflow']),
  travel_plan:new Set(['addressLabel','offlineFallbackLabel','participantPersonIds','startsAt','endsAt']),
  reservation:new Set(['participantPersonIds','startsAt','endsAt','providerLabel','opaqueReference']),
  travel_document:new Set(['archiveItemId','expiresOn','documentKind']),
  travel_budget:new Set(['startsAt','endsAt','amountMinor','currency']),
  shared_expense:new Set(['participantPersonIds','opaqueReference','amountMinor','currency']),
  packing_item:new Set(['checklistLabel','checklistCompleted']),
  travel_requirement:new Set(['requirementKind','opaqueRequirementReference']),
  offline_travel_pack:new Set(['archiveItemId']),
  language_pack:new Set(['archiveItemId','languageCode']),
  travel_album:new Set(['archiveItemId']),
  expense_settlement:new Set(['participantPersonIds','opaqueReference','amountMinor','currency'])
});
const specificFields=['addressLabel','latitudeE6','longitudeE6','offlineFallbackLabel','participantPersonIds','startsAt','endsAt',
  'providerLabel','opaqueReference','archiveItemId','expiresOn','documentKind','amountMinor','currency','checklistLabel',
  'checklistCompleted','petReferenceId','petWorkflow','requirementKind','opaqueRequirementReference','languageCode','ocrJobId'] as const;

const validateSpecific=(context:LifeApplicationContext,row:Record<string,unknown>):Result<void,AppError>=>{
  const kind=String(row.kind);const allowed=allowedFields[kind];if(!allowed)return err(invalid(context,'Kayıt türü geçersizdir.'));
  if(specificFields.some((field)=>row[field]!==undefined&&!allowed.has(field)))return err(invalid(context,'Kayıt türü başka iş akışına ait alan içeriyor.'));
  const hasCoordinates=Number.isSafeInteger(row.latitudeE6)&&Number.isSafeInteger(row.longitudeE6);
  const commonAmount=typeof row.amountMinor==='number'&&Number.isSafeInteger(row.amountMinor)&&row.amountMinor>=0&&row.amountMinor<=9_000_000_000_000_000&&typeof row.currency==='string'&&CURRENCY.test(row.currency);
  const participants=Array.isArray(row.participantPersonIds)?row.participantPersonIds:undefined;
  if(kind==='stored_place'&&!(typeof row.addressLabel==='string'||hasCoordinates))return err(invalid(context,'Kayıtlı yer adres etiketi veya koordinat gerektirir.'));
  if(kind==='moving_inventory'&&typeof row.archiveItemId!=='string')return err(invalid(context,'Taşınma envanteri opak arşiv öğesi gerektirir.'));
  if(kind==='pet_care_record'&&(!row.petReferenceId||!petWorkflows.has(String(row.petWorkflow))))return err(invalid(context,'Evcil hayvan kaydı opak hayvan referansı ve iş akışı gerektirir.'));
  if(kind==='travel_plan'&&(!participants?.length||!row.startsAt||!row.endsAt||!row.addressLabel&&!row.offlineFallbackLabel))
    return err(invalid(context,'Seyahat planı yer etiketi, katılımcı ve tarih aralığı gerektirir.'));
  if(kind==='reservation'&&(!participants?.length||!row.providerLabel||!row.opaqueReference||!row.startsAt||!row.endsAt))
    return err(invalid(context,'Rezervasyon katılımcı, yerel sağlayıcı etiketi, opak referans ve tarih gerektirir.'));
  if(kind==='travel_document'&&(!row.archiveItemId||!row.expiresOn||!documentKinds.has(String(row.documentKind))))return err(invalid(context,'Seyahat belgesi opak arşiv öğesi, tür ve süre gerektirir.'));
  if(['travel_budget','shared_expense','expense_settlement'].includes(kind)&&!commonAmount)return err(invalid(context,'Bütçe ve gider kaydı geçerli tutar ve para birimi gerektirir.'));
  if(kind==='travel_budget'&&(!row.startsAt||!row.endsAt))return err(invalid(context,'Seyahat bütçesi tarih aralığı gerektirir.'));
  if(['shared_expense','expense_settlement'].includes(kind)&&(!participants||participants.length<2))return err(invalid(context,'Ortak gider en az iki katılımcı gerektirir.'));
  if(['shared_expense','expense_settlement'].includes(kind)&&!row.opaqueReference)
    return err(invalid(context,'Ortak gider ve kapatma kaydı opak seyahat veya gider referansı gerektirir.'));
  if(kind==='packing_item'&&typeof row.checklistLabel!=='string')return err(invalid(context,'Valiz öğesi checklist etiketi gerektirir.'));
  if(kind==='travel_requirement'&&(!requirementKinds.has(String(row.requirementKind))||!row.opaqueRequirementReference))return err(invalid(context,'Seyahat gereksinimi tür ve opak referans gerektirir.'));
  if(['offline_travel_pack','travel_album'].includes(kind)&&!row.archiveItemId)return err(invalid(context,'Yerel paket veya albüm opak arşiv öğesi gerektirir.'));
  if(kind==='language_pack'&&(!row.archiveItemId||typeof row.languageCode!=='string'||!LANGUAGE.test(row.languageCode)))return err(invalid(context,'Dil paketi opak arşiv öğesi ve dil kodu gerektirir.'));
  if(row.startsAt&&row.endsAt&&String(row.endsAt)<String(row.startsAt))return err(invalid(context,'Bitiş başlangıçtan önce olamaz.'));
  return ok(undefined);
};

const normalizedCreate=(context:LifeApplicationContext,input:CreatePlacesTravelItemInput):Result<Omit<PlacesTravelItemRow,
  'familyId'|'stateFingerprint'|'lastMutationId'|'revision'|'createdAt'|'updatedAt'>,AppError>=>{
  if(!SAFE_ID.test(input.clientOperationId)||!SAFE_ID.test(input.itemId)||!SAFE_ID.test(input.ownerPersonId)||!kinds.has(input.kind)
    ||!visibilities.has(input.visibility)||input.status!==undefined&&!statuses.has(input.status))return err(invalid(context,'Kimlik, tür, görünürlük veya durum geçersizdir.'));
  const title=text(context,input.title,'Başlık',2,160);if(!title.ok)return title;
  const address=optionalText(context,input.addressLabel,'Adres etiketi',300);if(!address.ok)return address;
  const fallback=optionalText(context,input.offlineFallbackLabel,'Çevrimdışı yer etiketi',300);if(!fallback.ok)return fallback;
  const provider=optionalText(context,input.providerLabel,'Sağlayıcı etiketi',160);if(!provider.ok)return provider;
  const reference=optionalText(context,input.opaqueReference,'Opak referans',160);if(!reference.ok)return reference;
  const archive=optionalIdentifier(context,input.archiveItemId,'Arşiv öğesi');if(!archive.ok)return archive;
  const pet=optionalIdentifier(context,input.petReferenceId,'Evcil hayvan referansı');if(!pet.ok)return pet;
  const requirement=optionalIdentifier(context,input.opaqueRequirementReference,'Gereksinim referansı');if(!requirement.ok)return requirement;
  const checklist=optionalText(context,input.checklistLabel,'Checklist etiketi',240);if(!checklist.ok)return checklist;
  const ocr=optionalIdentifier(context,input.ocrJobId,'OCR iş kimliği');if(!ocr.ok)return ocr;
  const language=optionalText(context,input.languageCode,'Dil kodu',35);if(!language.ok)return language;
  const note=optionalText(context,input.note,'Not',1000);if(!note.ok)return note;
  const participants=identifiers(context,input.participantPersonIds);if(!participants.ok)return participants;
  const starts=timestamp(context,input.startsAt,'Başlangıç');if(!starts.ok)return starts;
  const ends=timestamp(context,input.endsAt,'Bitiş');if(!ends.ok)return ends;
  const expires=date(context,input.expiresOn,'Geçerlilik tarihi');if(!expires.ok)return expires;
  if((input.latitudeE6===undefined)!==(input.longitudeE6===undefined)
    ||input.latitudeE6!==undefined&&input.longitudeE6!==undefined&&(
      !Number.isSafeInteger(input.latitudeE6)||input.latitudeE6 < -90_000_000||input.latitudeE6 > 90_000_000
      ||!Number.isSafeInteger(input.longitudeE6)||input.longitudeE6 < -180_000_000||input.longitudeE6 > 180_000_000
    ))return err(invalid(context,'Koordinatlar geçersizdir.'));
  if(input.documentKind!==undefined&&!documentKinds.has(input.documentKind)||input.petWorkflow!==undefined&&!petWorkflows.has(input.petWorkflow)||input.requirementKind!==undefined&&!requirementKinds.has(input.requirementKind))return err(invalid(context,'Alt iş akışı türü geçersizdir.'));
  const row=Object.freeze({id:input.itemId,ownerPersonId:asPersonId(input.ownerPersonId),kind:input.kind,area:placesTravelAreaForKind(input.kind),
    title:title.value,status:input.status??(input.kind==='expense_settlement'?'settled':'planned'),visibility:input.visibility,
    ...(address.value?{addressLabel:address.value}:{}),...(input.latitudeE6===undefined?{}:{latitudeE6:input.latitudeE6,longitudeE6:input.longitudeE6!}),
    ...(fallback.value?{offlineFallbackLabel:fallback.value}:{}),...(participants.value?{participantPersonIds:participants.value}:{}),
    ...(starts.value?{startsAt:starts.value}:{}),...(ends.value?{endsAt:ends.value}:{}),...(provider.value?{providerLabel:provider.value}:{}),
    ...(reference.value?{opaqueReference:reference.value}:{}),...(archive.value?{archiveItemId:archive.value}:{}),...(expires.value?{expiresOn:expires.value}:{}),
    ...(input.documentKind?{documentKind:input.documentKind}:{}),...(input.amountMinor===undefined?{}:{amountMinor:input.amountMinor}),
    ...(input.currency?{currency:input.currency.toUpperCase()}:{}),...(checklist.value?{checklistLabel:checklist.value}:{}),
    ...(input.checklistCompleted===undefined?{}:{checklistCompleted:input.checklistCompleted}),...(pet.value?{petReferenceId:pet.value}:{}),
    ...(input.petWorkflow?{petWorkflow:input.petWorkflow}:{}),...(input.requirementKind?{requirementKind:input.requirementKind}:{}),
    ...(requirement.value?{opaqueRequirementReference:requirement.value}:{}),...(language.value?{languageCode:language.value}:{}),
    ...(ocr.value?{ocrJobId:ocr.value}:{}),...(note.value?{note:note.value}:{})});
  const shape=validateSpecific(context,row);return shape.ok?ok(row):shape;
};

const itemFingerprint=(row:Omit<PlacesTravelItemRow,'stateFingerprint'>):string=>hash({
  id:row.id,familyId:row.familyId,ownerPersonId:row.ownerPersonId,kind:row.kind,area:row.area,title:row.title,status:row.status,
  visibility:row.visibility,revision:row.revision,addressLabel:row.addressLabel??null,latitudeE6:row.latitudeE6??null,longitudeE6:row.longitudeE6??null,
  offlineFallbackLabel:row.offlineFallbackLabel??null,participantPersonIds:row.participantPersonIds??null,startsAt:row.startsAt??null,endsAt:row.endsAt??null,
  providerLabel:row.providerLabel??null,opaqueReference:row.opaqueReference??null,archiveItemId:row.archiveItemId??null,expiresOn:row.expiresOn??null,
  documentKind:row.documentKind??null,amountMinor:row.amountMinor??null,currency:row.currency??null,checklistLabel:row.checklistLabel??null,
  checklistCompleted:row.checklistCompleted??null,petReferenceId:row.petReferenceId??null,petWorkflow:row.petWorkflow??null,
  requirementKind:row.requirementKind??null,opaqueRequirementReference:row.opaqueRequirementReference??null,languageCode:row.languageCode??null,
  ocrJobId:row.ocrJobId??null,note:row.note??null,lastMutationId:row.lastMutationId,createdAt:row.createdAt,updatedAt:row.updatedAt,deletedAt:row.deletedAt??null
});
const receipt=(row:PlacesTravelMutationRow,replayed:boolean):PlacesTravelMutationReceiptView=>Object.freeze({itemId:row.itemId,
  ownerPersonId:row.ownerPersonId,mutationKind:row.mutationKind,previousRevision:row.expectedRevision,revision:row.revision,
  occurredAt:row.occurredAt,replayed,localOnly:true,externalAction:'not_performed'});
const evidenceIds=(context:LifeApplicationContext,clientOperationId:string,itemId:string,kind:PlacesTravelMutationKind,request:unknown)=>{
  const requestFingerprint=hash(request);const root={familyId:context.familyId,actorAccountId:context.actor.userId,clientOperationId,itemId,kind,requestFingerprint};
  return {requestFingerprint,mutationId:hash({...root,type:'mutation'}),auditId:hash({...root,type:'audit'}),eventId:asEventId(hash({...root,type:'event'}))};
};
const mutation=(context:LifeApplicationContext,key:PlacesTravelCenterKey,item:PlacesTravelItemRow,kind:PlacesTravelMutationKind,
  clientOperationId:string,requestFingerprint:string,expectedRevision:number,occurredAt:PlacesTravelMutationRow['occurredAt']):PlacesTravelMutationRow=>Object.freeze({
  id:item.lastMutationId,familyId:key.familyId,ownerPersonId:key.ownerPersonId,itemId:item.id,actorAccountId:context.actor.userId,
  actorPersonId:key.actorPersonId,mutationKind:kind,clientOperationId,requestFingerprint,expectedRevision,revision:item.revision,
  itemStateFingerprint:item.stateFingerprint,occurredAt});
const replay=(context:LifeApplicationContext,found:PlacesTravelMutationRow|null,expected:{kind:PlacesTravelMutationKind;itemId:string;ownerPersonId:string;
  expectedRevision:number;requestFingerprint:string}):Result<PlacesTravelMutationReceiptView|null,AppError>=>{
  if(!found)return ok(null);
  return found.mutationKind===expected.kind&&found.itemId===expected.itemId&&found.ownerPersonId===expected.ownerPersonId
    &&found.expectedRevision===expected.expectedRevision&&found.requestFingerprint===expected.requestFingerprint
    ?ok(receipt(found,true)):err(conflict(context,'İşlem kimliği farklı bir yer/seyahat isteğiyle kullanılmıştır.'));
};
const authorize=(context:LifeApplicationContext,scope:PlacesTravelAssetPetWriteScope,action:'create'|'update'|'delete',itemId:string,
  ownerPersonId:string,visibility:PlacesTravelVisibility):Result<void,AppError>=>{
  if(visibility==='private'&&context.actor.personId!==ownerPersonId)return err(denied(context,'Özel yer/seyahat kaydı yalnız sahibi tarafından yönetilebilir.'));
  const result=scope.authorize({action,resourceType:'places_travel_item',resourceId:itemId,ownerPersonId,privacy:placesTravelVisibilityPrivacy(visibility)});
  return result.ok&&result.value?ok(undefined):result.ok?err(denied(context,'Yer/seyahat görünürlük sınırı işlemi reddetti.')):result;
};
const validatePeople=(context:LifeApplicationContext,scope:PlacesTravelAssetPetWriteScope,ownerPersonId:string,participants:readonly string[]|undefined):Result<void,AppError>=>{
  const ids=new Set([ownerPersonId,...(participants??[])]);for(const id of ids){const found=scope.findPerson(id);if(!found.ok)return found;
    if(!found.value||found.value.familyId!==context.familyId||found.value.status!=='active')return err(missing(context,'Etkin aynı-aile kişi kaydı bulunamadı.'));}
  if(participants&&!participants.includes(ownerPersonId))return err(invalid(context,'Seyahat katılımcıları kayıt sahibini içermelidir.'));
  return ok(undefined);
};
const persist=(context:LifeApplicationContext,scope:PlacesTravelAssetPetWriteScope,row:PlacesTravelMutationRow,item:PlacesTravelItemRow,
  expectedRevision:number,auditId:string,eventId:ReturnType<typeof asEventId>):Result<PlacesTravelMutationReceiptView,AppError>=>{
  const ledger=scope.insertMutation(row);if(!ledger.ok)return ledger;
  const current=expectedRevision===0?scope.insertItem(item):scope.saveItem(item,expectedRevision);if(!current.ok)return current;
  const audit=scope.appendAudit({id:auditId,action:`places_travel.${row.mutationKind}`,resourceType:'places_travel_item',resourceId:item.id,
    occurredAt:row.occurredAt,actorId:context.actor.userId});if(!audit.ok)return audit;
  const event=scope.enqueueEvent({eventId,eventType:`places_travel.${row.mutationKind}`,eventVersion:1,aggregateType:'places_travel_item',aggregateId:item.id,
    occurredAt:row.occurredAt,actorId:context.actor.userId,correlationId:context.correlationId,payload:{itemId:item.id,kind:item.kind,area:item.area,
      status:item.status,revision:item.revision,localOnly:true,externalAction:'not_performed'}});
  return event.ok?ok(receipt(row,false)):event;
};

export const placesTravelTruth=Object.freeze({localOnly:true as const,mapProviderConfigured:false as const,
  coordinateAddressFallbackAvailable:true as const,schoolOrTravelProviderSync:'not_configured' as const,externalBookingPerformed:'not_performed' as const,
  liveTransportTrackingPerformed:'not_performed' as const,paymentExecutionPerformed:'not_performed' as const,documentVerificationPerformed:'not_performed' as const,
  petHealthAdviceProvided:false as const,healthDetailsDuplicated:false as const,ocrSuggestionAutomaticallyAccepted:false as const,
  offlinePackDeliveryPerformed:'not_performed' as const,languagePackDownloadPerformed:'not_performed' as const,albumMediaStoredHere:false as const,
  aiProcessingAllowed:false as const,externalSharingAllowed:false as const});
export const emptyPlacesTravelCounts=()=>Object.fromEntries(PLACES_TRAVEL_AREAS.map((area)=>[area,0])) as Record<(typeof PLACES_TRAVEL_AREAS)[number],number>;

export class GetPlacesTravelCenterUseCase {
  public constructor(private readonly query:PlacesTravelAssetPetQueryPort){}
  public execute(input:{readonly context:LifeApplicationContext;readonly ownerPersonId:string}){return this.query.getCenter(input.context,input.ownerPersonId);}
}

export class CreatePlacesTravelItemUseCase {
  public constructor(private readonly unit:PlacesTravelAssetPetUnitOfWork){}
  public execute(input:{readonly context:LifeApplicationContext;readonly command:CreatePlacesTravelItemInput}){
    const normalized=normalizedCreate(input.context,input.command);if(!normalized.ok)return Promise.resolve(normalized);
    const intent=writeIntent(input.command.itemId,'create',input.command.ownerPersonId,input.command.visibility);
    return this.unit.execute(input.context,intent,(scope)=>{
      const key=keyFor(input.context,input.command.ownerPersonId);if(!key.ok)return key;
      const people=validatePeople(input.context,scope,input.command.ownerPersonId,normalized.value.participantPersonIds);if(!people.ok)return people;
      const allowed=authorize(input.context,scope,'create',input.command.itemId,input.command.ownerPersonId,input.command.visibility);if(!allowed.ok)return allowed;
      const ids=evidenceIds(input.context,input.command.clientOperationId,input.command.itemId,'item_create',normalized.value);
      const found=scope.findMutation(key.value,input.command.clientOperationId);if(!found.ok)return found;
      const replayed=replay(input.context,found.value,{kind:'item_create',itemId:input.command.itemId,ownerPersonId:input.command.ownerPersonId,
        expectedRevision:0,requestFingerprint:ids.requestFingerprint});if(!replayed.ok)return replayed;if(replayed.value)return ok(replayed.value);
      const existing=scope.findItem(key.value,input.command.itemId);if(!existing.ok)return existing;
      if(existing.value)return err(conflict(input.context,'Yer/seyahat kaydı zaten var.'));
      const base=Object.freeze({...normalized.value,familyId:key.value.familyId,revision:1,lastMutationId:ids.mutationId,
        createdAt:scope.occurredAt,updatedAt:scope.occurredAt});const item=Object.freeze({...base,stateFingerprint:itemFingerprint(base)});
      return persist(input.context,scope,mutation(input.context,key.value,item,'item_create',input.command.clientOperationId,
        ids.requestFingerprint,0,scope.occurredAt),item,0,ids.auditId,ids.eventId);
    });
  }
}

export class UpdatePlacesTravelItemUseCase {
  public constructor(private readonly unit:PlacesTravelAssetPetUnitOfWork){}
  public execute(input:{readonly context:LifeApplicationContext;readonly command:UpdatePlacesTravelItemInput}){
    if(!SAFE_ID.test(input.command.clientOperationId)||!SAFE_ID.test(input.command.itemId)||!SAFE_ID.test(input.command.ownerPersonId)
      ||!Number.isSafeInteger(input.command.expectedRevision)||input.command.expectedRevision<1)return Promise.resolve(err(invalid(input.context,'Güncelleme kimliği veya revizyonu geçersizdir.')));
    return this.unit.execute(input.context,writeIntent(input.command.itemId,'update'),(scope)=>{
      const key=keyFor(input.context,input.command.ownerPersonId);if(!key.ok)return key;
      const ids=evidenceIds(input.context,input.command.clientOperationId,input.command.itemId,'item_update',input.command);
      const prior=scope.findMutation(key.value,input.command.clientOperationId);if(!prior.ok)return prior;
      const replayed=replay(input.context,prior.value,{kind:'item_update',itemId:input.command.itemId,ownerPersonId:input.command.ownerPersonId,
        expectedRevision:input.command.expectedRevision,requestFingerprint:ids.requestFingerprint});if(!replayed.ok)return replayed;if(replayed.value)return ok(replayed.value);
      const found=scope.findItem(key.value,input.command.itemId);if(!found.ok)return found;
      if(!found.value||found.value.status==='deleted')return err(missing(input.context,'Güncellenecek yer/seyahat kaydı bulunamadı.'));
      if(found.value.revision!==input.command.expectedRevision)return err(conflict(input.context,'Yer/seyahat kaydı revizyonu değişti.'));
      const nextVisibility=input.command.visibility??found.value.visibility;
      const currentAllowed=authorize(input.context,scope,'update',input.command.itemId,input.command.ownerPersonId,found.value.visibility);
      if(!currentAllowed.ok)return currentAllowed;
      if(nextVisibility!==found.value.visibility){
        const targetAllowed=authorize(input.context,scope,'update',input.command.itemId,input.command.ownerPersonId,nextVisibility);
        if(!targetAllowed.ok)return targetAllowed;
      }
      const nextTitle=input.command.title===undefined?ok(found.value.title):text(input.context,input.command.title,'Başlık',2,160);if(!nextTitle.ok)return nextTitle;
      if(input.command.status!==undefined&&!statuses.has(input.command.status)||input.command.visibility!==undefined&&!visibilities.has(input.command.visibility))return err(invalid(input.context,'Durum veya görünürlük geçersizdir.'));
      const starts=input.command.startsAt===null?ok(undefined):input.command.startsAt===undefined?ok(found.value.startsAt):timestamp(input.context,input.command.startsAt,'Başlangıç');if(!starts.ok)return starts;
      const ends=input.command.endsAt===null?ok(undefined):input.command.endsAt===undefined?ok(found.value.endsAt):timestamp(input.context,input.command.endsAt,'Bitiş');if(!ends.ok)return ends;
      const expires=input.command.expiresOn===null?ok(undefined):input.command.expiresOn===undefined?ok(found.value.expiresOn):date(input.context,input.command.expiresOn,'Geçerlilik');if(!expires.ok)return expires;
      const noteValue=input.command.note===null?ok(undefined):input.command.note===undefined?ok(found.value.note):optionalText(input.context,input.command.note,'Not',1000);if(!noteValue.ok)return noteValue;
      const amount=input.command.amountMinor===null?undefined:input.command.amountMinor??found.value.amountMinor;
      const {stateFingerprint:_state,startsAt:_starts,endsAt:_ends,expiresOn:_expires,amountMinor:_amount,note:_note,...stable}=found.value;
      const without:Omit<PlacesTravelItemRow,'stateFingerprint'>=Object.freeze({...stable,title:nextTitle.value,
        status:input.command.status??found.value.status,visibility:nextVisibility,revision:found.value.revision+1,
        lastMutationId:ids.mutationId,updatedAt:scope.occurredAt,
        ...(starts.value===undefined?{}:{startsAt:starts.value}),...(ends.value===undefined?{}:{endsAt:ends.value}),
        ...(expires.value===undefined?{}:{expiresOn:expires.value}),...(amount===undefined?{}:{amountMinor:amount}),
        ...(input.command.checklistCompleted===undefined?{}:{checklistCompleted:input.command.checklistCompleted}),
        ...(noteValue.value===undefined?{}:{note:noteValue.value})});
      const shape=validateSpecific(input.context,without as unknown as Record<string,unknown>);if(!shape.ok)return shape;
      const item=Object.freeze({...without,stateFingerprint:itemFingerprint(without)});
      return persist(input.context,scope,mutation(input.context,key.value,item,'item_update',input.command.clientOperationId,
        ids.requestFingerprint,found.value.revision,scope.occurredAt),item,found.value.revision,ids.auditId,ids.eventId);
    });
  }
}

export class DeletePlacesTravelItemUseCase {
  public constructor(private readonly unit:PlacesTravelAssetPetUnitOfWork){}
  public execute(input:{readonly context:LifeApplicationContext;readonly command:DeletePlacesTravelItemInput}){
    if(!SAFE_ID.test(input.command.clientOperationId)||!SAFE_ID.test(input.command.itemId)||!SAFE_ID.test(input.command.ownerPersonId)
      ||!Number.isSafeInteger(input.command.expectedRevision)||input.command.expectedRevision<1)return Promise.resolve(err(invalid(input.context,'Silme kimliği veya revizyonu geçersizdir.')));
    const reason=text(input.context,input.command.reason,'Silme nedeni',2,500);if(!reason.ok)return Promise.resolve(reason);
    return this.unit.execute(input.context,writeIntent(input.command.itemId,'delete'),(scope)=>{
      const key=keyFor(input.context,input.command.ownerPersonId);if(!key.ok)return key;
      const ids=evidenceIds(input.context,input.command.clientOperationId,input.command.itemId,'item_delete',{...input.command,reason:reason.value});
      const prior=scope.findMutation(key.value,input.command.clientOperationId);if(!prior.ok)return prior;
      const replayed=replay(input.context,prior.value,{kind:'item_delete',itemId:input.command.itemId,ownerPersonId:input.command.ownerPersonId,
        expectedRevision:input.command.expectedRevision,requestFingerprint:ids.requestFingerprint});if(!replayed.ok)return replayed;if(replayed.value)return ok(replayed.value);
      const found=scope.findItem(key.value,input.command.itemId);if(!found.ok)return found;
      if(!found.value||found.value.status==='deleted')return err(missing(input.context,'Silinecek yer/seyahat kaydı bulunamadı.'));
      if(found.value.revision!==input.command.expectedRevision)return err(conflict(input.context,'Yer/seyahat kaydı revizyonu değişti.'));
      const allowed=authorize(input.context,scope,'delete',input.command.itemId,input.command.ownerPersonId,found.value.visibility);if(!allowed.ok)return allowed;
      const base=Object.freeze({id:found.value.id,familyId:found.value.familyId,ownerPersonId:found.value.ownerPersonId,kind:found.value.kind,
        area:found.value.area,title:'Silindi',status:'deleted' as const,visibility:found.value.visibility,revision:found.value.revision+1,
        lastMutationId:ids.mutationId,createdAt:found.value.createdAt,updatedAt:scope.occurredAt,deletedAt:scope.occurredAt});
      const item=Object.freeze({...base,stateFingerprint:itemFingerprint(base)});
      return persist(input.context,scope,mutation(input.context,key.value,item,'item_delete',input.command.clientOperationId,
        ids.requestFingerprint,found.value.revision,scope.occurredAt),item,found.value.revision,ids.auditId,ids.eventId);
    });
  }
}

export const placesTravelReadIntent=readIntent;
