import { describe, expect, it } from 'vitest';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId, asUserId, ok } from '@ppt/core';
import type {
  HouseholdOperationItemRow,
  HouseholdOperationMutationRow,
  HouseholdOperationsCenterRow
} from '@ppt/repository-contracts';
import {
  CreateHouseholdOperationItemUseCase,
  DeleteHouseholdOperationItemUseCase,
  UpdateHouseholdOperationItemUseCase,
  type HouseholdOperationsUnitOfWork,
  type HouseholdOperationsWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '../src/index.js';

const NOW=asIsoDateTime('2026-08-15T15:00:00.000Z');
const FAMILY=asFamilyId('family-33-t');
const OWNER=asPersonId('person-33-t-owner');
const MEMBER=asPersonId('person-33-t-member');
const context:LifeApplicationContext=Object.freeze({
  familyId:FAMILY,
  actor:{userId:asUserId('account-33-t-owner'),personId:OWNER,role:'family_admin'},
  correlationId:asCorrelationId('household-operations-33-t')
});

class Unit implements HouseholdOperationsUnitOfWork{
  public center:HouseholdOperationsCenterRow|null=null;
  public readonly items=new Map<string,HouseholdOperationItemRow>();
  public readonly mutations=new Map<string,HouseholdOperationMutationRow>();
  public readonly audits:unknown[]=[];
  public readonly events:unknown[]=[];
  public readonly intents:LifePolicyIntent[]=[];

  public async execute<T>(
    _context:LifeApplicationContext,
    intent:LifePolicyIntent,
    operation:(scope:HouseholdOperationsWriteScope)=>ReturnType<typeof ok<T>>
  ){
    this.intents.push(intent);
    const before={center:this.center,items:new Map(this.items),mutations:new Map(this.mutations),audits:this.audits.length,events:this.events.length};
    const scope:HouseholdOperationsWriteScope={
      occurredAt:NOW,
      findPerson:(personId)=>ok(personId===OWNER||personId===MEMBER?{id:personId,familyId:FAMILY,status:'active'}:null),
      findCenter:()=>ok(this.center),
      findItem:(_key,itemId)=>ok(this.items.get(itemId)??null),
      findMutation:(_key,clientOperationId)=>ok(this.mutations.get(clientOperationId)??null),
      insertMutation:(row)=>{this.mutations.set(row.clientOperationId,row);return ok(undefined);},
      insertCenter:(row)=>{this.center=row;return ok(undefined);},
      saveCenter:(row,expectedRevision)=>{if(this.center?.revision!==expectedRevision)throw new Error('center revision mismatch');this.center=row;return ok(undefined);},
      insertItem:(row)=>{this.items.set(row.id,row);return ok(undefined);},
      saveItem:(row,expectedRevision)=>{if(this.items.get(row.id)?.revision!==expectedRevision)throw new Error('item revision mismatch');this.items.set(row.id,row);return ok(undefined);},
      appendAudit:(input)=>{this.audits.push(input);return ok('audit-hash');},
      enqueueEvent:(event)=>{this.events.push(event);return ok(undefined);}
    };
    const result=operation(scope);
    if(!result.ok){
      this.center=before.center;this.items.clear();for(const [key,value] of before.items)this.items.set(key,value);
      this.mutations.clear();for(const [key,value] of before.mutations)this.mutations.set(key,value);
      this.audits.splice(before.audits);this.events.splice(before.events);
    }
    return result;
  }
}

describe('33-T household operations use cases',()=>{
  it('creates a shopping list and child item, then replays without duplicate writes',async()=>{
    const unit=new Unit();const useCase=new CreateHouseholdOperationItemUseCase(unit);
    const list={expectedCenterRevision:0,clientOperationId:'operation-list-33-t',itemId:'shopping-list-33-t',kind:'shopping_list' as const,title:'Haftalık alışveriş',status:'active' as const};
    const child={expectedCenterRevision:1,clientOperationId:'operation-item-33-t',itemId:'shopping-item-33-t',kind:'shopping_item' as const,title:'Mercimek',parentItemId:list.itemId,status:'planned' as const};
    expect(await useCase.execute({context,command:list})).toMatchObject({ok:true,value:{centerRevision:1,itemRevision:1,replayed:false}});
    expect(await useCase.execute({context,command:child})).toMatchObject({ok:true,value:{centerRevision:2,itemRevision:1,replayed:false}});
    expect(await useCase.execute({context,command:child})).toMatchObject({ok:true,value:{centerRevision:2,itemRevision:1,replayed:true}});
    expect(unit.items).toHaveLength(2);
    expect(unit.items.get(child.itemId)).toMatchObject({area:'shopping',parentItemId:list.itemId});
    expect(unit.intents).toEqual(expect.arrayContaining([expect.objectContaining({resourceType:'household_operation_item',capability:'family.write',purpose:'general'})]));
  });

  it('filters a meal plan against the selected recipe allergens and rolls back on conflict',async()=>{
    const unit=new Unit();const useCase=new CreateHouseholdOperationItemUseCase(unit);
    expect((await useCase.execute({context,command:{
      expectedCenterRevision:0,clientOperationId:'operation-recipe-33-t',itemId:'recipe-33-t',kind:'recipe',title:'Sütlü çorba',ingredientNames:['süt','pirinç'],allergenCodes:['süt']
    }})).ok).toBe(true);
    const before={items:unit.items.size,mutations:unit.mutations.size,audits:unit.audits.length,events:unit.events.length};
    const denied=await useCase.execute({context,command:{
      expectedCenterRevision:1,clientOperationId:'operation-meal-33-t',itemId:'meal-33-t',kind:'meal_plan',title:'Akşam öğünü',parentItemId:'recipe-33-t',avoidedAllergenCodes:['süt']
    }});
    expect(denied).toMatchObject({ok:false,error:{category:'conflict'}});
    expect({items:unit.items.size,mutations:unit.mutations.size,audits:unit.audits.length,events:unit.events.length}).toEqual(before);
  });

  it('requires a complete distinct-person split and persists only the valid shared expense',async()=>{
    const unit=new Unit();const useCase=new CreateHouseholdOperationItemUseCase(unit);
    const invalid=await useCase.execute({context,command:{
      expectedCenterRevision:0,clientOperationId:'operation-split-invalid-33-t',itemId:'expense-invalid-33-t',kind:'shared_expense',title:'Market',amountMinor:10_000,currency:'TRY',splitShares:[{personId:OWNER,basisPoints:5000},{personId:MEMBER,basisPoints:4999}]
    }});
    expect(invalid).toMatchObject({ok:false,error:{category:'validation'}});
    const valid=await useCase.execute({context,command:{
      expectedCenterRevision:0,clientOperationId:'operation-split-valid-33-t',itemId:'expense-valid-33-t',kind:'shared_expense',title:'Market',amountMinor:10_000,currency:'TRY',splitShares:[{personId:OWNER,basisPoints:6000},{personId:MEMBER,basisPoints:4000}]
    }});
    expect(valid.ok).toBe(true);
    expect(unit.items.get('expense-valid-33-t')).toMatchObject({area:'expenses',amountMinor:10_000,currency:'TRY',splitShares:[{personId:MEMBER,basisPoints:4000},{personId:OWNER,basisPoints:6000}]});
  });

  it('rejects unsafe delivery identifiers and accepts only a four-character display hint',async()=>{
    const unit=new Unit();const useCase=new CreateHouseholdOperationItemUseCase(unit);
    expect(await useCase.execute({context,command:{
      expectedCenterRevision:0,clientOperationId:'operation-delivery-full-33-t',itemId:'delivery-full-33-t',kind:'delivery',title:'Kargo',providerLabel:'Yerel taşıyıcı',trackingLastFour:'TRK-123456'
    }})).toMatchObject({ok:false,error:{category:'validation'}});
    expect((await useCase.execute({context,command:{
      expectedCenterRevision:0,clientOperationId:'operation-delivery-safe-33-t',itemId:'delivery-safe-33-t',kind:'delivery',title:'Kargo',providerLabel:'Yerel taşıyıcı',trackingLastFour:'A729'
    }})).ok).toBe(true);
    expect(unit.items.get('delivery-safe-33-t')).toMatchObject({providerLabel:'Yerel taşıyıcı',trackingLastFour:'A729'});
    expect(JSON.stringify(unit.events)).not.toContain('Yerel taşıyıcı');
  });

  it('updates and soft-deletes with optimistic item and center revisions',async()=>{
    const unit=new Unit();const create=new CreateHouseholdOperationItemUseCase(unit);
    await create.execute({context,command:{expectedCenterRevision:0,clientOperationId:'operation-chore-create-33-t',itemId:'chore-33-t',kind:'chore',title:'Mutfağı düzenle',assignedPersonId:MEMBER}});
    const updated=await new UpdateHouseholdOperationItemUseCase(unit).execute({context,command:{expectedCenterRevision:1,expectedItemRevision:1,clientOperationId:'operation-chore-update-33-t',itemId:'chore-33-t',status:'completed'}});
    expect(updated).toMatchObject({ok:true,value:{centerRevision:2,itemRevision:2}});
    const deleted=await new DeleteHouseholdOperationItemUseCase(unit).execute({context,command:{expectedCenterRevision:2,expectedItemRevision:2,clientOperationId:'operation-chore-delete-33-t',itemId:'chore-33-t',reason:'Görev artık gerekli değil.'}});
    expect(deleted).toMatchObject({ok:true,value:{centerRevision:3,itemRevision:3}});
    expect(unit.items.get('chore-33-t')).toMatchObject({status:'deleted',deletedAt:NOW});
    expect(unit.events).toHaveLength(3);
    expect(JSON.stringify(unit.events)).not.toContain('Mutfağı düzenle');
  });
});
