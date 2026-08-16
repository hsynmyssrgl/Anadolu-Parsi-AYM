import { describe, expect, it } from 'vitest';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId, asUserId, ok, type AppError, type Result } from '@ppt/core';
import type { DomainEvent } from '@ppt/events';
import type { ChildEducationItemRow, ChildEducationMutationRow } from '@ppt/repository-contracts';
import {
  CreateChildEducationItemUseCase,
  DeleteChildEducationItemUseCase,
  UpdateChildEducationItemUseCase,
  type ChildEducationCoordinationUnitOfWork,
  type ChildEducationCoordinationWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '../src/index.js';

const NOW=asIsoDateTime('2026-08-15T02:00:00.000Z');
const FAMILY=asFamilyId('family-33-u');
const PARENT=asPersonId('person-parent-33-u');
const TEEN=asPersonId('person-teen-33-u');
const CHILD=asPersonId('person-child-33-u');

const context=(personId=PARENT):LifeApplicationContext=>({familyId:FAMILY,actor:{userId:asUserId(`account-${personId}`),
  role:personId===PARENT?'family_admin':'limited_member',personId},correlationId:asCorrelationId(`corr-${personId}`)});

class MemoryScope implements ChildEducationCoordinationWriteScope {
  public readonly occurredAt=NOW;
  public readonly items=new Map<string,ChildEducationItemRow>();
  public readonly mutations=new Map<string,ChildEducationMutationRow>();
  public readonly audits:unknown[]=[];public readonly events:DomainEvent<unknown>[]=[];
  public findPerson(personId:string){return ok(personId===TEEN?{id:TEEN,familyId:FAMILY,status:'active',birthDate:'2011-06-01'}
    :personId===CHILD?{id:CHILD,familyId:FAMILY,status:'active',birthDate:'2017-06-01'}
      :personId===PARENT?{id:PARENT,familyId:FAMILY,status:'active',birthDate:'1985-01-01'}:null);}
  public authorize(input:Parameters<ChildEducationCoordinationWriteScope['authorize']>[0]){
    const actor=this.currentActor;
    return ok(input.privacy==='family'||actor===input.ownerPersonId);
  }
  public currentActor:string=PARENT;
  public findItem(_key:unknown,itemId:string){return ok(this.items.get(itemId)??null);}
  public findMutation(_key:unknown,clientOperationId:string){return ok(this.mutations.get(clientOperationId)??null);}
  public insertMutation(row:ChildEducationMutationRow){this.mutations.set(row.clientOperationId,row);return ok(undefined);}
  public insertItem(row:ChildEducationItemRow){this.items.set(row.id,row);return ok(undefined);}
  public saveItem(row:ChildEducationItemRow,expectedRevision:number){const found=this.items.get(row.id);
    if(!found||found.revision!==expectedRevision)throw new Error('revision');this.items.set(row.id,row);return ok(undefined);}
  public appendAudit(input:unknown){this.audits.push(input);return ok('audit');}
  public enqueueEvent<TPayload>(event:DomainEvent<TPayload>):Result<void,AppError>{this.events.push(event as DomainEvent<unknown>);return ok(undefined);}
}

class MemoryUnit implements ChildEducationCoordinationUnitOfWork {
  public readonly scope=new MemoryScope();public intents:LifePolicyIntent[]=[];
  public execute<T>(ctx:LifeApplicationContext,intent:LifePolicyIntent,operation:(scope:ChildEducationCoordinationWriteScope)=>Result<T,AppError>){
    this.intents.push(intent);this.scope.currentActor=ctx.actor.personId!;return Promise.resolve(operation(this.scope));
  }
}

describe('33-U child education coordination use cases',()=>{
  it('creates a family-coordination school record and replays exact input without duplicate evidence',async()=>{
    const unit=new MemoryUnit();const useCase=new CreateChildEducationItemUseCase(unit);
    const command={clientOperationId:'operation-school-33-u',itemId:'school-33-u',childPersonId:TEEN,
      kind:'school' as const,title:'Yerel okul planı',visibility:'family_coordination' as const,institutionLabel:'Örnek okul'};
    expect(await useCase.execute({context:context(),command})).toMatchObject({ok:true,value:{revision:1,replayed:false}});
    expect(await useCase.execute({context:context(),command})).toMatchObject({ok:true,value:{revision:1,replayed:true}});
    expect(unit.scope.audits).toHaveLength(1);expect(unit.scope.events).toHaveLength(1);
    expect(unit.intents[0]).toMatchObject({resourceType:'child_education_item',action:'create',ownerPersonId:TEEN,privacy:'family'});
  });

  it('allows a teen-owned private homework item but denies guardian mutation of the private zone',async()=>{
    const unit=new MemoryUnit();const create=new CreateChildEducationItemUseCase(unit);
    const created=await create.execute({context:context(TEEN),command:{clientOperationId:'operation-private-create',
      itemId:'homework-private',childPersonId:TEEN,kind:'homework',title:'Kişisel çalışma notu',
      visibility:'adolescent_private',subjectLabel:'Matematik',dueAt:'2026-08-20T15:00:00.000Z'}});
    expect(created).toMatchObject({ok:true});
    const invalidClear=await new UpdateChildEducationItemUseCase(unit).execute({context:context(TEEN),command:{
      clientOperationId:'operation-private-clear-due',itemId:'homework-private',childPersonId:TEEN,expectedRevision:1,dueAt:null}});
    expect(invalidClear).toMatchObject({ok:false,error:{category:'validation'}});
    const denied=await new UpdateChildEducationItemUseCase(unit).execute({context:context(),command:{
      clientOperationId:'operation-private-parent',itemId:'homework-private',childPersonId:TEEN,expectedRevision:1,status:'completed'}});
    expect(denied).toMatchObject({ok:false,error:{category:'authorization'}});
  });

  it('rejects adolescent-private space for an under-13 child',async()=>{
    const result=await new CreateChildEducationItemUseCase(new MemoryUnit()).execute({context:context(CHILD),command:{
      clientOperationId:'operation-under13-private',itemId:'book-under13',childPersonId:CHILD,kind:'book',
      title:'Okuma listesi',visibility:'adolescent_private'}});
    expect(result).toMatchObject({ok:false,error:{category:'authorization'}});
  });

  it('enforces allowance, goal, transport and pickup fields without payment or live-tracking claims',async()=>{
    const unit=new MemoryUnit();const create=new CreateChildEducationItemUseCase(unit);
    for(const command of [
      {clientOperationId:'operation-class-no-label',itemId:'class-no-label',childPersonId:TEEN,kind:'class' as const,title:'10-A',visibility:'family_coordination' as const,institutionLabel:'Örnek okul'},
      {clientOperationId:'operation-homework-no-due',itemId:'homework-no-due',childPersonId:TEEN,kind:'homework' as const,title:'Matematik ödevi',visibility:'family_coordination' as const,subjectLabel:'Matematik'},
      {clientOperationId:'operation-exam-no-time',itemId:'exam-no-time',childPersonId:TEEN,kind:'exam' as const,title:'Fen sınavı',visibility:'family_coordination' as const,subjectLabel:'Fen'},
      {clientOperationId:'operation-event-no-time',itemId:'event-no-time',childPersonId:TEEN,kind:'school_event' as const,title:'Okul gezisi',visibility:'family_coordination' as const,institutionLabel:'Örnek okul'},
      {clientOperationId:'operation-pickup-no-window',itemId:'pickup-no-window',childPersonId:TEEN,kind:'pickup_authority' as const,title:'Teslim yetkisi',visibility:'family_coordination' as const,authorityReferenceId:'opaque-credential'},
      {clientOperationId:'operation-course-no-time',itemId:'course-no-time',childPersonId:TEEN,kind:'course' as const,title:'Kodlama kursu',visibility:'family_coordination' as const,institutionLabel:'Yerel kurs'}
    ]) expect(await create.execute({context:context(),command})).toMatchObject({ok:false,error:{category:'validation'}});
    expect(await create.execute({context:context(),command:{clientOperationId:'operation-budget',itemId:'budget-33-u',
      childPersonId:TEEN,kind:'allowance_budget',title:'Aylık harçlık planı',visibility:'family_coordination',amountMinor:10000,currency:'TRY'}})).toMatchObject({ok:true});
    expect(await create.execute({context:context(),command:{clientOperationId:'operation-bad-budget',itemId:'budget-bad',
      childPersonId:TEEN,kind:'allowance_budget',title:'Eksik bütçe',visibility:'family_coordination'}})).toMatchObject({ok:false});
    expect(await create.execute({context:context(),command:{clientOperationId:'operation-pickup',itemId:'pickup-33-u',
      childPersonId:TEEN,kind:'pickup_authority',title:'Teslim yetkisi',visibility:'family_coordination',authorityReferenceId:'opaque-credential-33-p',
      scheduledAt:'2026-08-16T08:00:00.000Z',dueAt:'2026-08-16T18:00:00.000Z'}})).toMatchObject({ok:true});
  });

  it('updates then content-minimizes deletion while keeping audit and outbox payload free of note text',async()=>{
    const unit=new MemoryUnit();const create=new CreateChildEducationItemUseCase(unit);
    await create.execute({context:context(),command:{clientOperationId:'operation-goal-create',itemId:'goal-33-u',childPersonId:TEEN,
      kind:'education_goal',title:'Okuma hedefi',visibility:'family_coordination',progressBasisPoints:1000,note:'Özel ayrıntı'}});
    expect(await new UpdateChildEducationItemUseCase(unit).execute({context:context(),command:{clientOperationId:'operation-goal-update',
      itemId:'goal-33-u',childPersonId:TEEN,expectedRevision:1,progressBasisPoints:5000,status:'active'}})).toMatchObject({ok:true,value:{revision:2}});
    expect(await new UpdateChildEducationItemUseCase(unit).execute({context:context(),command:{clientOperationId:'operation-goal-selected-visibility',
      itemId:'goal-33-u',childPersonId:TEEN,expectedRevision:2,visibility:'child_and_selected_guardians'}}))
      .toMatchObject({ok:false,error:{category:'authorization'}});
    expect(unit.scope.items.get('goal-33-u')).toMatchObject({visibility:'family_coordination',revision:2});
    expect(await new DeleteChildEducationItemUseCase(unit).execute({context:context(),command:{clientOperationId:'operation-goal-delete',
      itemId:'goal-33-u',childPersonId:TEEN,expectedRevision:2,reason:'Artık gerekli değil'}})).toMatchObject({ok:true,value:{revision:3}});
    expect(unit.scope.items.get('goal-33-u')).toMatchObject({status:'deleted',title:'Silindi',revision:3});
    expect(JSON.stringify({audits:unit.scope.audits,events:unit.scope.events})).not.toContain('Özel ayrıntı');
  });
});
