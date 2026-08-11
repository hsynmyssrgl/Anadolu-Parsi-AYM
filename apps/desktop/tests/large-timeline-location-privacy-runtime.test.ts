import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  ERROR_CODES,
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
import type { LocationApplicationContext, LocationPolicyIntent } from '@ppt/application';
import type {
  LargeFamilyReadModelRepositoryPort,
  LargeTimelineRow,
  LocationRecord,
  LocationRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';
import { SqliteLargeFamilyReadModelRepository } from '@ppt/repositories';
import {
  LargeFamilyReadModelService,
  type LargeFamilyReadModelServiceDependencies
} from '../src/main/large-family-read-model-service.js';
import type { RepositoryBackedLocationPolicyTransactionRunner } from '../src/main/location-application-adapter.js';

const NOW=asIsoDateTime('2026-08-08T12:00:00.000Z');
const FAMILY_ID=asFamilyId('family-real');
const PERSON_ID=asPersonId('person-real');
const ACCOUNT_ID=asUserId('account-real');
const CORRELATION_ID=asCorrelationId('large-timeline-location-privacy');
const transaction=Object.freeze({marker:'same-sqlite-transaction'});

const applicationContext:LocationApplicationContext=Object.freeze({
  familyId:FAMILY_ID,
  actor:{userId:ACCOUNT_ID,role:'adult_member',personId:PERSON_ID},
  correlationId:CORRELATION_ID
});

const governedContext:PolicyAuthorizedRepositoryExecutionContext=Object.freeze({
  transaction:transaction as never,
  actor:{userId:ACCOUNT_ID,roles:['adult_member'],personId:PERSON_ID},
  correlationId:CORRELATION_ID,
  occurredAt:NOW,
  policyAuthorization:{} as never
});

const baseEvent=():Omit<LargeTimelineRow,'id'|'title'>=>({
  kind:'memory',startAt:'2026-08-08T10:00:00.000Z',visibility:'family',participantPersonIds:[],
  attachmentCount:0,aiProcessingAllowed:false,recurrence:'none',reminderDays:[],createdAt:'2026-08-08T09:00:00.000Z'
});

const rows:readonly LargeTimelineRow[]=[
  {...baseEvent(),id:'event-visible',title:'Görünür',linkedLocationId:'location-visible'},
  {...baseEvent(),id:'event-revoked',title:'İzni kalkmış',linkedLocationId:'location-revoked'},
  {...baseEvent(),id:'event-freeform',title:'Serbest',freeformLocationLabel:'Park'}
];

const visibleLocation:LocationRecord=Object.freeze({
  id:'location-visible',familyId:FAMILY_ID,ownerPersonId:PERSON_ID,label:'Yetkili Aile Evi',
  kind:'residence',createdAt:NOW
});

interface Harness {
  readonly service:LargeFamilyReadModelService;
  readonly timelineInputs:Array<Parameters<LargeFamilyReadModelRepositoryPort['listTimelinePage']>[1]>;
  readonly runnerIntents:LocationPolicyIntent[];
  readonly genericTransactionExecutor:ReturnType<typeof vi.fn>;
  readonly currentAccountId:ReturnType<typeof vi.fn>;
  readonly canReadEvent:ReturnType<typeof vi.fn>;
  readonly locationReadContexts:PolicyAuthorizedRepositoryExecutionContext[];
  readonly timelineReadContexts:PolicyAuthorizedRepositoryExecutionContext[];
  phase:'before'|'inside'|'after';
}

const createHarness=(denied=false):Harness=>{
  const harness={} as Harness;
  const timelineInputs:Harness['timelineInputs']=[];const runnerIntents:LocationPolicyIntent[]=[];
  const locationReadContexts:PolicyAuthorizedRepositoryExecutionContext[]=[];const timelineReadContexts:PolicyAuthorizedRepositoryExecutionContext[]=[];
  const genericTransactionExecutor=vi.fn(()=>{throw new Error('timeline must not open a generic or nested transaction');});
  const currentAccountId=vi.fn(()=>{throw new Error('timeline must use the governed application actor');});
  const canReadEvent=vi.fn(()=>{expect(harness.phase).toBe('after');return true;});
  const locationRepository={
    listByFamily:(context:PolicyAuthorizedRepositoryExecutionContext,familyId:string)=>{
      expect(harness.phase).toBe('inside');expect(context).toBe(governedContext);expect(context.transaction).toBe(transaction);expect(familyId).toBe(FAMILY_ID);
      locationReadContexts.push(context);return ok([visibleLocation]);
    }
  } as unknown as LocationRepositoryPort;
  const repository={
    listTimelinePage:(context:PolicyAuthorizedRepositoryExecutionContext,input:Parameters<LargeFamilyReadModelRepositoryPort['listTimelinePage']>[1])=>{
      expect(harness.phase).toBe('inside');expect(context).toBe(governedContext);expect(context.transaction).toBe(transaction);
      timelineReadContexts.push(context);timelineInputs.push(input);return ok(rows);
    }
  } as unknown as LargeFamilyReadModelRepositoryPort;
  const runner={
    execute:async <T>(context:LocationApplicationContext,intent:LocationPolicyIntent,operation:(scope:{repository:PolicyAuthorizedRepositoryExecutionContext;occurredAt:typeof NOW;authorization:never})=>Result<T,AppError>):Promise<Result<T,AppError>>=>{
      expect(context).toBe(applicationContext);runnerIntents.push(intent);
      if(denied)return err(createAppError({code:ERROR_CODES.AUTHORIZATION_DENIED,message:'Location grant expired or revoked',category:'authorization',correlationId:CORRELATION_ID}));
      harness.phase='inside';const result=operation({repository:governedContext,occurredAt:NOW,authorization:governedContext.policyAuthorization as never});harness.phase='after';return result;
    }
  } as unknown as Pick<RepositoryBackedLocationPolicyTransactionRunner,'execute'>;
  Object.assign(harness,{
    service:new LargeFamilyReadModelService({
      transactionExecutor:{execute:genericTransactionExecutor} as unknown as TransactionExecutor,
      repository,locationRepository,locationPolicyTransactionRunner:runner,
      locationApplicationContext:()=>applicationContext,currentAccountId,canReadEvent,
      canReadArchiveItem:()=>true
    } satisfies LargeFamilyReadModelServiceDependencies),
    timelineInputs,runnerIntents,genericTransactionExecutor,currentAccountId,canReadEvent,
    locationReadContexts,timelineReadContexts,phase:'before' as const
  });
  return harness;
};

describe('30-Z large timeline governed location projection',()=>{
  it('uses one governed collection transaction, authoritative labels and revocation-safe redaction',async()=>{
    const harness=createHarness();
    const page=await harness.service.listTimelinePage({limit:20,query:'yetkili aile'});

    expect(harness.runnerIntents).toEqual([expect.objectContaining({action:'read',capability:'location.read',resourceType:'location',resourceId:'*',sensitivity:'highly_sensitive'})]);
    expect(harness.timelineInputs).toEqual([expect.objectContaining({familyId:FAMILY_ID,visibleLocationIds:['location-visible'],locationIdsMatchingQuery:['location-visible']})]);
    expect(harness.locationReadContexts[0]).toBe(harness.timelineReadContexts[0]);
    expect(harness.genericTransactionExecutor).not.toHaveBeenCalled();
    expect(harness.currentAccountId).not.toHaveBeenCalled();
    expect(harness.canReadEvent).toHaveBeenCalledTimes(3);
    expect(page.items.find(item=>item.id==='event-visible')).toMatchObject({locationId:'location-visible',locationLabel:'Yetkili Aile Evi'});
    expect(page.items.find(item=>item.id==='event-revoked')).not.toHaveProperty('locationId');
    expect(page.items.find(item=>item.id==='event-revoked')).not.toHaveProperty('locationLabel');
    expect(page.items.find(item=>item.id==='event-freeform')).toMatchObject({locationLabel:'Park'});
  });

  it('does not turn a denied or expired location decision into a generic-read fallback',async()=>{
    const harness=createHarness(true);
    await expect(harness.service.listTimelinePage({limit:20})).rejects.toThrow(`[${ERROR_CODES.AUTHORIZATION_DENIED}]`);
    expect(harness.locationReadContexts).toHaveLength(0);expect(harness.timelineReadContexts).toHaveLength(0);
    expect(harness.genericTransactionExecutor).not.toHaveBeenCalled();expect(harness.canReadEvent).not.toHaveBeenCalled();
  });

  it('keeps cached saved-location labels out of SQL search and projection',()=>{
    const source=readFileSync(fileURLToPath(new URL('../../../packages/repositories/src/large-family-read-model-repository.ts',import.meta.url)),'utf8');
    expect(source).toContain("e.location_id IS NULL AND COALESCE(e.location_label,'') LIKE ?");
    expect(source).toContain('json_each(?) visible_location_match');
    expect(source).toContain('json_each(?) visible_location');
    expect(source).toContain('THEN e.location_id ELSE NULL END governed_location_id');
    expect(source).toContain('CASE WHEN e.location_id IS NULL THEN e.location_label ELSE NULL END freeform_location_label');
    expect(source).not.toContain("{locationLabel:String(row.location_label)}");
  });

  it('rejects a forged repository context before any raw timeline SQL can run',()=>{
    const repository=new SqliteLargeFamilyReadModelRepository();
    expect(()=>repository.listTimelinePage(governedContext,{familyId:FAMILY_ID,limit:20,query:'',visibleLocationIds:[],kind:''})).toThrow(/forged|execution boundary/i);
  });

  it('projects linked ids only from the governed visible-id snapshot at SQL runtime',()=>{
    const database=new DatabaseSync(':memory:');
    try{
      database.exec('CREATE TABLE events(id TEXT PRIMARY KEY,location_id TEXT,location_label TEXT)');
      const insert=database.prepare('INSERT INTO events(id,location_id,location_label) VALUES(?,?,?)');
      insert.run('allowed','location-visible','stale cached label');insert.run('revoked','location-revoked','secret cached label');insert.run('freeform',null,'Park');
      const projected=database.prepare(`
        SELECT id,
          CASE WHEN EXISTS (SELECT 1 FROM json_each(?) visible_location WHERE visible_location.value=e.location_id)
            THEN e.location_id ELSE NULL END governed_location_id,
          CASE WHEN e.location_id IS NULL THEN e.location_label ELSE NULL END freeform_location_label
        FROM events e ORDER BY id
      `).all(JSON.stringify(['location-visible'])) as Array<Record<string,unknown>>;
      expect(projected).toEqual([
        {id:'allowed',governed_location_id:'location-visible',freeform_location_label:null},
        {id:'freeform',governed_location_id:null,freeform_location_label:'Park'},
        {id:'revoked',governed_location_id:null,freeform_location_label:null}
      ]);
    }finally{database.close();}
  });
});
