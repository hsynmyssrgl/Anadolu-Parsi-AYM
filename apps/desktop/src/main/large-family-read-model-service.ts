import { createHash, randomUUID } from 'node:crypto';
import { asCorrelationId, asFamilyId, asPersonId, asUserId, ok, type CorrelationId } from '@ppt/core';
import type { LocationApplicationContext } from '@ppt/application';
import type {
  ArchivePageInput,
  ArchivePageItemView,
  ArchivePageView,
  FamilyEventView,
  GenealogyTreePageInput,
  GenealogyTreePageView,
  TimelinePageInput,
  TimelinePageView
} from '@ppt/domain';
import type {
  LargeArchiveCursor,
  LargeFamilyReadModelRepositoryPort,
  LargeTimelineCursor,
  LargeTreeCursor,
  LocationRepositoryPort,
  RepositoryExecutionContext,
  TransactionExecutor,
  TransactionContext
} from '@ppt/repository-contracts';
import {
  locationCollectionReadIntent,
  type RepositoryBackedLocationPolicyTransactionRunner
} from './location-application-adapter.js';

const DEFAULT_PAGE_SIZE=80;
const MAX_PAGE_SIZE=200;
const MAX_CURSOR_LENGTH=512;
const MAX_QUERY_LENGTH=120;
const MAX_FILTER_LENGTH=160;

type CursorEnvelope=
  | {readonly v:1;readonly kind:'tree';readonly scope:string;readonly generation:number;readonly displayName:string;readonly id:string}
  | {readonly v:1;readonly kind:'timeline';readonly scope:string;readonly startAt:string;readonly id:string}
  | {readonly v:1;readonly kind:'archive';readonly scope:string;readonly createdAt:string;readonly id:string};

const boundedText=(value:unknown,label:string,max=MAX_FILTER_LENGTH):string=>{
  if(value===undefined||value===null)return'';
  if(typeof value!=='string')throw new TypeError(`${label} metin olmalıdır.`);
  const normalized=value.trim();
  if(normalized.length>max)throw new RangeError(`${label} en fazla ${max} karakter olabilir.`);
  return normalized;
};
const pageSize=(value:unknown):number=>{
  if(value===undefined)return DEFAULT_PAGE_SIZE;
  if(typeof value!=='number'||!Number.isInteger(value)||value<20||value>MAX_PAGE_SIZE)throw new RangeError(`Sayfa boyutu 20-${MAX_PAGE_SIZE} arasında tam sayı olmalıdır.`);
  return value;
};
const cursorScope=(kind:CursorEnvelope['kind'],accountId:string,filters:Record<string,unknown>):string=>createHash('sha256').update(JSON.stringify({v:1,kind,accountId,filters})).digest('hex');
const encodeCursor=(value:CursorEnvelope):string=>Buffer.from(JSON.stringify(value),'utf8').toString('base64url');
const decodeCursor=(value:unknown,kind:CursorEnvelope['kind'],expectedScope:string):CursorEnvelope|undefined=>{
  if(value===undefined)return undefined;
  if(typeof value!=='string'||value.length===0||value.length>MAX_CURSOR_LENGTH)throw new TypeError('Sayfalama imleci geçersizdir.');
  let parsed:unknown;
  try{parsed=JSON.parse(Buffer.from(value,'base64url').toString('utf8'));}catch{throw new TypeError('Sayfalama imleci çözümlenemedi.');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new TypeError('Sayfalama imleci geçersizdir.');
  const candidate=parsed as Record<string,unknown>;
  if(candidate.v!==1||candidate.kind!==kind)throw new TypeError('Sayfalama imleci bu görünümle uyumlu değildir.');
  const scope=boundedText(candidate.scope,'İmleç kapsamı',64);
  if(scope!==expectedScope)throw new TypeError('Sayfalama imleci mevcut kullanıcı ve filtre kapsamıyla uyumlu değildir.');
  const id=boundedText(candidate.id,'İmleç kimliği',128);
  if(!id)throw new TypeError('Sayfalama imleci kimliği eksiktir.');
  if(kind==='tree'){
    const generation=candidate.generation;
    const displayName=boundedText(candidate.displayName,'İmleç kişi adı',240);
    if(typeof generation!=='number'||!Number.isInteger(generation)||generation<1||generation>20||!displayName)throw new TypeError('Soy ağacı imleci geçersizdir.');
    return {v:1,kind,scope,generation,displayName,id};
  }
  const dateKey=kind==='timeline'?'startAt':'createdAt';
  const date=boundedText(candidate[dateKey],`İmleç ${dateKey}`,64);
  if(!date||!Number.isFinite(Date.parse(date)))throw new TypeError('Tarih imleci geçersizdir.');
  return kind==='timeline'?{v:1,kind,scope,startAt:date,id}:{v:1,kind,scope,createdAt:date,id};
};
const initials=(displayName:string):string=>displayName.split(/\s+/u).filter(Boolean).slice(0,2).map(part=>part[0]??'').join('').toLocaleUpperCase('tr-TR');

export interface LargeFamilyReadModelServiceDependencies {
  readonly transactionExecutor:TransactionExecutor;
  readonly repository:LargeFamilyReadModelRepositoryPort;
  readonly locationRepository:LocationRepositoryPort;
  readonly locationPolicyTransactionRunner:Pick<RepositoryBackedLocationPolicyTransactionRunner,'execute'>;
  readonly locationApplicationContext:(prefix:string)=>LocationApplicationContext;
  readonly currentAccountId:()=>string;
  readonly currentCorrelationId?:()=>CorrelationId|undefined;
  readonly canReadEvent:(eventId:string)=>boolean;
  readonly canReadArchiveItem:(itemId:string)=>boolean;
}

export class LargeFamilyReadModelService {
  public constructor(private readonly dependencies:LargeFamilyReadModelServiceDependencies){}

  #context(correlationId:CorrelationId,transaction:TransactionContext,accountId:string):RepositoryExecutionContext{
    return {transaction:transaction.transaction,actor:{userId:asUserId(accountId),roles:['reader']},correlationId,occurredAt:transaction.occurredAt};
  }

  #correlationId(prefix:string):CorrelationId{
    return this.dependencies.currentCorrelationId?.()??asCorrelationId(`${prefix}-${randomUUID()}`);
  }

  public listTreePage(input:GenealogyTreePageInput={}):GenealogyTreePageView{
    const limit=pageSize(input.limit);const query=boundedText(input.query,'Kişi araması',MAX_QUERY_LENGTH).toLocaleLowerCase('tr-TR');const branch=boundedText(input.branch,'Aile dalı');
    const generation=input.generation;
    if(generation!==undefined&&(!Number.isInteger(generation)||generation<1||generation>20))throw new RangeError('Nesil filtresi 1-20 arasında olmalıdır.');
    const accountId=this.dependencies.currentAccountId();const scope=cursorScope('tree',accountId,{query,branch,generation:generation??null});
    const decoded=decodeCursor(input.cursor,'tree',scope) as Extract<CursorEnvelope,{kind:'tree'}>|undefined;
    const cursor:LargeTreeCursor|undefined=decoded?{generation:decoded.generation,displayName:decoded.displayName,id:decoded.id}:undefined;
    const correlationId=this.#correlationId('large-tree');const started=performance.now();
    const result=this.dependencies.transactionExecutor.execute(correlationId,transaction=>this.dependencies.repository.listTreePage(this.#context(correlationId,transaction,accountId),{familyId:asFamilyId('family-main'),limit:limit+1,query,branch,...(generation===undefined?{}:{generation}),...(cursor?{cursor}:{})}));
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    const hasMore=result.value.length>limit;const rows=result.value.slice(0,limit);const last=rows.at(-1);
    return {items:rows.map(row=>({id:row.id,displayName:row.displayName,...(row.birthDate?{birthDate:row.birthDate}:{}),relationshipType:row.relationshipType,generation:row.generation,branch:row.branch,status:row.status,initials:initials(row.displayName),relationCount:row.relationCount,parentCount:row.parentCount,childCount:row.childCount})),hasMore,...(hasMore&&last?{nextCursor:encodeCursor({v:1,kind:'tree',scope,generation:last.generation,displayName:last.displayName,id:last.id})}:{}),metrics:{returned:rows.length,scanned:result.value.length,queryDurationMs:Number((performance.now()-started).toFixed(2)),limit}};
  }

  public async listTimelinePage(input:TimelinePageInput={}):Promise<TimelinePageView>{
    const limit=pageSize(input.limit);const query=boundedText(input.query,'Zaman tüneli araması',MAX_QUERY_LENGTH).toLocaleLowerCase('tr-TR');const kind=boundedText(input.kind,'Olay türü',64);
    const personIdText=boundedText(input.personId,'Kişi kimliği',128);const personId=personIdText?asPersonId(personIdText):undefined;const year=input.year;
    if(year!==undefined&&(!Number.isInteger(year)||year<1000||year>9999))throw new RangeError('Yıl filtresi geçersizdir.');
    const applicationContext=this.dependencies.locationApplicationContext('large-timeline');
    const accountId=String(applicationContext.actor.userId);const scope=cursorScope('timeline',accountId,{familyId:applicationContext.familyId,actorPersonId:applicationContext.actor.personId??null,query,kind,personId:personIdText,year:year??null});
    const decoded=decodeCursor(input.cursor,'timeline',scope) as Extract<CursorEnvelope,{kind:'timeline'}>|undefined;
    const cursor:LargeTimelineCursor|undefined=decoded?{startAt:decoded.startAt,id:decoded.id}:undefined;
    const started=performance.now();
    const result=await this.dependencies.locationPolicyTransactionRunner.execute(applicationContext,locationCollectionReadIntent(),({repository})=>{
      const locations=this.dependencies.locationRepository.listByFamily(repository,applicationContext.familyId);if(!locations.ok)return locations;
      const visibleLocationsById=new Map(locations.value.map(location=>[location.id,location] as const));
      const visibleLocationIds=[...visibleLocationsById.keys()];
      const locationIdsMatchingQuery=query?[...visibleLocationsById.values()].filter(location=>location.label.toLocaleLowerCase('tr-TR').includes(query)).map(location=>location.id):[];
      const timeline=this.dependencies.repository.listTimelinePage(repository,{familyId:applicationContext.familyId,limit:limit+1,query,visibleLocationIds,...(locationIdsMatchingQuery.length?{locationIdsMatchingQuery}:{}),kind,...(personId?{personId}:{}),...(year===undefined?{}:{year}),...(cursor?{cursor}:{})});if(!timeline.ok)return timeline;
      return ok({rows:timeline.value,visibleLocationsById});
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    const scanned=result.value.rows;const hasMore=scanned.length>limit;const pageRows=scanned.slice(0,limit);const visible=pageRows.filter(event=>this.dependencies.canReadEvent(event.id)).map((event):FamilyEventView=>{
      const {linkedLocationId,freeformLocationLabel,...safeEvent}=event;
      const location=linkedLocationId?result.value.visibleLocationsById.get(linkedLocationId):undefined;
      return {...safeEvent,...(location?{locationId:location.id,locationLabel:location.label}:{}),...(!linkedLocationId&&freeformLocationLabel?{locationLabel:freeformLocationLabel}:{})};
    });const last=pageRows.at(-1);
    return {items:visible,hasMore,...(hasMore&&last?{nextCursor:encodeCursor({v:1,kind:'timeline',scope,startAt:last.startAt,id:last.id})}:{}),metrics:{returned:visible.length,scanned:scanned.length,queryDurationMs:Number((performance.now()-started).toFixed(2)),limit}};
  }

  public listArchivePage(input:ArchivePageInput={}):ArchivePageView{
    const limit=pageSize(input.limit);const query=boundedText(input.query,'Arşiv araması',MAX_QUERY_LENGTH).toLocaleLowerCase('tr-TR');const categoryId=boundedText(input.categoryId,'Kategori kimliği',128);const tag=boundedText(input.tag,'Etiket',80).toLocaleLowerCase('tr-TR');const mimeType=boundedText(input.mimeType,'MIME türü',120);const linkedEventId=boundedText(input.linkedEventId,'Etkinlik kimliği',128);const sensitivity=boundedText(input.sensitivity,'Hassasiyet',16);
    if(sensitivity&&!['standard','personal','high'].includes(sensitivity))throw new RangeError('Arşiv hassasiyeti geçersizdir.');
    const accountId=this.dependencies.currentAccountId();const scope=cursorScope('archive',accountId,{query,categoryId,sensitivity,tag,mimeType,linkedEventId});
    const decoded=decodeCursor(input.cursor,'archive',scope) as Extract<CursorEnvelope,{kind:'archive'}>|undefined;
    const cursor:LargeArchiveCursor|undefined=decoded?{createdAt:decoded.createdAt,id:decoded.id}:undefined;
    const correlationId=this.#correlationId('large-archive');const started=performance.now();let occurredAt='';
    const result=this.dependencies.transactionExecutor.execute(correlationId,transaction=>{occurredAt=transaction.occurredAt;return this.dependencies.repository.listArchivePage(this.#context(correlationId,transaction,accountId),{familyId:asFamilyId('family-main'),limit:limit+1,query,categoryId,sensitivity,tag,mimeType,linkedEventId,...(cursor?{cursor}:{})});});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    const scanned=result.value;const hasMore=scanned.length>limit;const pageRows=scanned.slice(0,limit);const visible=pageRows.filter(item=>this.dependencies.canReadArchiveItem(item.id));const last=pageRows.at(-1);
    const items:ArchivePageItemView[]=visible.map(item=>{const retainUntil=item.retentionDays===undefined?undefined:new Date(Date.parse(item.createdAt)+item.retentionDays*86_400_000).toISOString();return {id:item.id,title:item.title,originalName:item.originalName,mimeType:item.mimeType,sizeBytes:item.sizeBytes,sha256:item.sha256,createdAt:item.createdAt,...(item.linkedEventId?{linkedEventId:item.linkedEventId}:{}),...(item.categoryId?{categoryId:item.categoryId}:{}),...(item.categoryName?{categoryName:item.categoryName}:{}),sensitivity:item.sensitivity,tagNames:[...item.tagNames],...(item.retentionPolicyId?{retentionPolicyId:item.retentionPolicyId}:{}),...(item.retentionPolicyName?{retentionPolicyName:item.retentionPolicyName}:{}),...(retainUntil?{retainUntil}:{}),eligibleForDestruction:Boolean(retainUntil)&&Date.parse(retainUntil!)<=Date.parse(occurredAt),ownershipBinding:item.ownershipBinding};});
    return {items,hasMore,...(hasMore&&last?{nextCursor:encodeCursor({v:1,kind:'archive',scope,createdAt:last.createdAt,id:last.id})}:{}),metrics:{returned:items.length,scanned:scanned.length,queryDurationMs:Number((performance.now()-started).toFixed(2)),limit}};
  }
}
