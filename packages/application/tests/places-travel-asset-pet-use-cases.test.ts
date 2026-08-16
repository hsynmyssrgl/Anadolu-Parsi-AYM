import { describe,expect,it } from 'vitest';
import { asCorrelationId,asFamilyId,asIsoDateTime,asPersonId,asUserId,ok,type AppError,type Result } from '@ppt/core';
import type { DomainEvent } from '@ppt/events';
import type { PlacesTravelItemRow,PlacesTravelMutationRow } from '@ppt/repository-contracts';
import {
  CreatePlacesTravelItemUseCase,DeletePlacesTravelItemUseCase,UpdatePlacesTravelItemUseCase,
  placesTravelReadIntent,
  type LifeApplicationContext,type LifePolicyIntent,type PlacesTravelAssetPetUnitOfWork,type PlacesTravelAssetPetWriteScope
} from '../src/index.js';

const NOW=asIsoDateTime('2026-08-15T04:00:00.000Z');const FAMILY=asFamilyId('family-33-v');
const OWNER=asPersonId('person-owner-33-v');const MEMBER=asPersonId('person-member-33-v');
const context=(personId=OWNER):LifeApplicationContext=>({familyId:FAMILY,actor:{userId:asUserId(`account-${personId}`),
  role:personId===OWNER?'family_admin':'limited_member',personId},correlationId:asCorrelationId(`corr-${personId}`)});

class MemoryScope implements PlacesTravelAssetPetWriteScope{
  public readonly occurredAt=NOW;public currentActor:string=OWNER;public readonly items=new Map<string,PlacesTravelItemRow>();
  public readonly mutations=new Map<string,PlacesTravelMutationRow>();public readonly audits:unknown[]=[];public readonly events:DomainEvent<unknown>[]=[];
  public findPerson(personId:string){return ok([OWNER,MEMBER].includes(personId as typeof OWNER)?{id:personId,familyId:FAMILY,status:'active'}:null);}
  public authorize(input:Parameters<PlacesTravelAssetPetWriteScope['authorize']>[0]){return ok(input.privacy==='family'||this.currentActor===input.ownerPersonId);}
  public findItem(_key:unknown,itemId:string){return ok(this.items.get(itemId)??null);}
  public findMutation(_key:unknown,clientOperationId:string){return ok(this.mutations.get(clientOperationId)??null);}
  public insertMutation(row:PlacesTravelMutationRow){this.mutations.set(row.clientOperationId,row);return ok(undefined);}
  public insertItem(row:PlacesTravelItemRow){this.items.set(row.id,row);return ok(undefined);}
  public saveItem(row:PlacesTravelItemRow,expectedRevision:number){const found=this.items.get(row.id);if(!found||found.revision!==expectedRevision)throw new Error('revision');this.items.set(row.id,row);return ok(undefined);}
  public appendAudit(input:unknown){this.audits.push(input);return ok('audit');}
  public enqueueEvent<TPayload>(event:DomainEvent<TPayload>):Result<void,AppError>{this.events.push(event as DomainEvent<unknown>);return ok(undefined);}
}
class MemoryUnit implements PlacesTravelAssetPetUnitOfWork{
  public readonly scope=new MemoryScope();public readonly intents:LifePolicyIntent[]=[];
  public execute<T>(ctx:LifeApplicationContext,intent:LifePolicyIntent,operation:(scope:PlacesTravelAssetPetWriteScope)=>Result<T,AppError>){
    this.intents.push(intent);this.scope.currentActor=ctx.actor.personId!;return Promise.resolve(operation(this.scope));
  }
}

describe('33-V places travel asset and pet use cases',()=>{
  it('creates a local stored place and replays exact command without duplicate evidence',async()=>{
    const unit=new MemoryUnit();const useCase=new CreatePlacesTravelItemUseCase(unit);const command={clientOperationId:'operation-place-33-v',
      itemId:'place-home-33-v',ownerPersonId:OWNER,kind:'stored_place' as const,title:'Aile buluşma noktası',visibility:'private' as const,
      latitudeE6:41015137,longitudeE6:28979430,offlineFallbackLabel:'Parkın kuzey kapısı'};
    expect(await useCase.execute({context:context(),command})).toMatchObject({ok:true,value:{revision:1,replayed:false}});
    expect(await useCase.execute({context:context(),command})).toMatchObject({ok:true,value:{revision:1,replayed:true}});
    expect(unit.scope.audits).toHaveLength(1);expect(unit.scope.events).toHaveLength(1);
    expect(unit.intents[0]).toMatchObject({resourceType:'places_travel_item',action:'create',ownerPersonId:OWNER,privacy:'private'});
  });

  it('requires owner-bound private writes and active same-family travel participants',async()=>{
    const unit=new MemoryUnit();const create=new CreatePlacesTravelItemUseCase(unit);
    const denied=await create.execute({context:context(MEMBER),command:{clientOperationId:'operation-private-denied',itemId:'private-trip',
      ownerPersonId:OWNER,kind:'travel_plan',title:'Özel gezi',visibility:'private',participantPersonIds:[OWNER,MEMBER],
      offlineFallbackLabel:'Yerel buluşma etiketi',
      startsAt:'2026-09-01T08:00:00.000Z',endsAt:'2026-09-02T18:00:00.000Z'}});
    expect(denied).toMatchObject({ok:false,error:{category:'authorization'}});
    const missingOwner=await create.execute({context:context(),command:{clientOperationId:'operation-missing-owner',itemId:'bad-trip',
      ownerPersonId:OWNER,kind:'travel_plan',title:'Eksik gezi',visibility:'family_coordination',participantPersonIds:[MEMBER],
      offlineFallbackLabel:'Yerel buluşma etiketi',
      startsAt:'2026-09-01T08:00:00.000Z',endsAt:'2026-09-02T18:00:00.000Z'}});
    expect(missingOwner).toMatchObject({ok:false,error:{category:'validation'}});
  });

  it('models reservation, document and shared expense without booking payment or verification',async()=>{
    const unit=new MemoryUnit();const create=new CreatePlacesTravelItemUseCase(unit);
    expect(await create.execute({context:context(),command:{clientOperationId:'operation-reservation',itemId:'reservation-33-v',ownerPersonId:OWNER,
      kind:'reservation',title:'Yerel otel notu',visibility:'family_coordination',providerLabel:'Örnek otel',opaqueReference:'opaque-reservation',
      startsAt:'2026-09-01T08:00:00.000Z',endsAt:'2026-09-02T18:00:00.000Z',participantPersonIds:[OWNER,MEMBER]}})).toMatchObject({ok:true});
    expect(await create.execute({context:context(),command:{clientOperationId:'operation-document',itemId:'document-33-v',ownerPersonId:OWNER,
      kind:'travel_document',title:'Pasaport süresi',visibility:'private',archiveItemId:'archive-passport',expiresOn:'2030-01-01',documentKind:'passport'}})).toMatchObject({ok:true});
    expect(await create.execute({context:context(),command:{clientOperationId:'operation-expense',itemId:'expense-33-v',ownerPersonId:OWNER,
      kind:'shared_expense',title:'Konaklama paylaşımı',visibility:'selected_members',participantPersonIds:[OWNER,MEMBER],
      opaqueReference:'trip-expense-opaque',amountMinor:125000,currency:'TRY'}})).toMatchObject({ok:true});
    expect(JSON.stringify(unit.scope.events)).not.toContain('opaque-reservation');
  });

  it('keeps moving OCR as an unaccepted opaque suggestion and pet data free of health advice',async()=>{
    const unit=new MemoryUnit();const create=new CreatePlacesTravelItemUseCase(unit);
    expect(await create.execute({context:context(),command:{clientOperationId:'operation-moving',itemId:'moving-33-v',ownerPersonId:OWNER,
      kind:'moving_inventory',title:'Taşınma kutuları',visibility:'private',archiveItemId:'archive-moving',ocrJobId:'ocr-job-opaque'}})).toMatchObject({ok:true});
    expect(await create.execute({context:context(),command:{clientOperationId:'operation-pet',itemId:'pet-33-v',ownerPersonId:OWNER,
      kind:'pet_care_record',title:'Aşı belgesi hatırlatması',visibility:'private',petReferenceId:'pet-opaque',petWorkflow:'vaccination'}})).toMatchObject({ok:true});
    expect(JSON.stringify(unit.scope.events)).not.toContain('ocr-job-opaque');expect(JSON.stringify(unit.scope.events)).not.toContain('pet-opaque');
  });

  it('covers every pet and travel-requirement workflow as opaque local references',async()=>{
    const unit=new MemoryUnit();const create=new CreatePlacesTravelItemUseCase(unit);
    for(const workflow of ['vaccination','veterinary','microchip','food','insurance','travel_document'] as const){
      expect(await create.execute({context:context(),command:{clientOperationId:`operation-pet-${workflow}`,itemId:`pet-${workflow}`,
        ownerPersonId:OWNER,kind:'pet_care_record',title:`Evcil hayvan ${workflow}`,visibility:'private',
        petReferenceId:'pet-opaque-33-v',petWorkflow:workflow,...(['vaccination','insurance','travel_document'].includes(workflow)
          ?{expiresOn:'2027-05-31'}:{})}})).toMatchObject({ok:true});
    }
    for(const requirementKind of ['health','medication','child','pet'] as const){
      expect(await create.execute({context:context(),command:{clientOperationId:`operation-requirement-${requirementKind}`,
        itemId:`requirement-${requirementKind}`,ownerPersonId:OWNER,kind:'travel_requirement',title:`Gereksinim ${requirementKind}`,
        visibility:'private',requirementKind,opaqueRequirementReference:`requirement-${requirementKind}-opaque`}})).toMatchObject({ok:true});
    }
    const evidence=JSON.stringify({audits:unit.scope.audits,events:unit.scope.events});
    expect(evidence).not.toContain('pet-opaque-33-v');expect(evidence).not.toContain('requirement-health-opaque');
  });

  it('requires exact dates destinations participants and expense linkage',async()=>{
    const unit=new MemoryUnit();const create=new CreatePlacesTravelItemUseCase(unit);
    expect(await create.execute({context:context(),command:{clientOperationId:'operation-invalid-date',itemId:'document-invalid-date',
      ownerPersonId:OWNER,kind:'travel_document',title:'Geçersiz tarih',visibility:'private',archiveItemId:'archive-invalid-date',
      expiresOn:'2026-02-31',documentKind:'passport'}})).toMatchObject({ok:false,error:{category:'validation'}});
    expect(await create.execute({context:context(),command:{clientOperationId:'operation-trip-no-place',itemId:'trip-no-place',
      ownerPersonId:OWNER,kind:'travel_plan',title:'Yersiz plan',visibility:'private',participantPersonIds:[OWNER],
      startsAt:'2026-09-01T08:00:00.000Z',endsAt:'2026-09-02T18:00:00.000Z'}})).toMatchObject({ok:false,error:{category:'validation'}});
    expect(await create.execute({context:context(),command:{clientOperationId:'operation-reservation-no-people',itemId:'reservation-no-people',
      ownerPersonId:OWNER,kind:'reservation',title:'Katılımcısız rezervasyon',visibility:'private',providerLabel:'Yerel otel',
      opaqueReference:'reservation-opaque',startsAt:'2026-09-01T08:00:00.000Z',endsAt:'2026-09-02T18:00:00.000Z'}}))
      .toMatchObject({ok:false,error:{category:'validation'}});
    expect(await create.execute({context:context(),command:{clientOperationId:'operation-budget-no-dates',itemId:'budget-no-dates',
      ownerPersonId:OWNER,kind:'travel_budget',title:'Tarihsiz bütçe',visibility:'private',amountMinor:1000,currency:'TRY'}}))
      .toMatchObject({ok:false,error:{category:'validation'}});
    expect(await create.execute({context:context(),command:{clientOperationId:'operation-settlement-no-ref',itemId:'settlement-no-ref',
      ownerPersonId:OWNER,kind:'expense_settlement',title:'Bağsız kapatma',visibility:'private',participantPersonIds:[OWNER,MEMBER],
      amountMinor:1000,currency:'TRY'}})).toMatchObject({ok:false,error:{category:'validation'}});
  });

  it('binds center reads to the requested owner and prevents visibility laundering',async()=>{
    expect(placesTravelReadIntent(OWNER)).toMatchObject({resourceType:'places_travel_center',resourceId:'*',ownerPersonId:OWNER,privacy:'family'});
    const unit=new MemoryUnit();const create=new CreatePlacesTravelItemUseCase(unit);const update=new UpdatePlacesTravelItemUseCase(unit);
    expect(await create.execute({context:context(),command:{clientOperationId:'operation-private-create',itemId:'private-visibility-item',
      ownerPersonId:OWNER,kind:'stored_place',title:'Özel buluşma yeri',visibility:'private',addressLabel:'Yerel adres'}})).toMatchObject({ok:true});
    expect(await update.execute({context:context(MEMBER),command:{clientOperationId:'operation-private-launder',itemId:'private-visibility-item',
      ownerPersonId:OWNER,expectedRevision:1,visibility:'family_coordination'}})).toMatchObject({ok:false,error:{category:'authorization'}});
    expect(unit.scope.items.get('private-visibility-item')).toMatchObject({visibility:'private',revision:1});
  });

  it('updates common workflow state then deletes to a content-free durable tombstone',async()=>{
    const unit=new MemoryUnit();await new CreatePlacesTravelItemUseCase(unit).execute({context:context(),command:{clientOperationId:'operation-pack-create',
      itemId:'pack-33-v',ownerPersonId:OWNER,kind:'packing_item',title:'Şarj cihazı',visibility:'family_coordination',checklistLabel:'Şarj cihazı',note:'Özel not'}});
    expect(await new UpdatePlacesTravelItemUseCase(unit).execute({context:context(),command:{clientOperationId:'operation-pack-update',
      itemId:'pack-33-v',ownerPersonId:OWNER,expectedRevision:1,status:'completed',checklistCompleted:true}})).toMatchObject({ok:true,value:{revision:2}});
    expect(await new DeletePlacesTravelItemUseCase(unit).execute({context:context(),command:{clientOperationId:'operation-pack-delete',
      itemId:'pack-33-v',ownerPersonId:OWNER,expectedRevision:2,reason:'Artık gerekli değil'}})).toMatchObject({ok:true,value:{revision:3}});
    expect(unit.scope.items.get('pack-33-v')).toMatchObject({status:'deleted',title:'Silindi',revision:3});
    expect(JSON.stringify({audits:unit.scope.audits,events:unit.scope.events})).not.toContain('Özel not');
  });
});
