import type { AiConsentResourceRow, AiConsentRepositoryPort, SensitiveDataInventoryRow } from '@ppt/repository-contracts';
import type { AiConsentView } from '@ppt/domain';
import type { RepositoryResult } from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';
const consent=(r:Record<string,unknown>):AiConsentView=>({id:String(r.id),accountId:String(r.account_id),purpose:String(r.purpose) as AiConsentView['purpose'],resourceType:String(r.resource_type),resourceId:String(r.resource_id),status:String(r.status) as AiConsentView['status'],startsAt:String(r.starts_at),...(r.ends_at?{endsAt:String(r.ends_at)}:{}),createdAt:String(r.created_at)});

export class SqliteAiConsentRepository extends SqliteRepository implements AiConsentRepositoryPort {
 list(context:RepositoryExecutionContext,accountId:string):RepositoryResult<readonly AiConsentView[]>{return this.execute(context,()=> (this.database(context).prepare('SELECT id,account_id,purpose,resource_type,resource_id,status,starts_at,ends_at,created_at FROM ai_consents WHERE account_id=? ORDER BY created_at DESC').all(accountId) as Array<Record<string,unknown>>).map(consent));}
 findIdentity(context:RepositoryExecutionContext,accountId:string,purpose:string,resourceType:string,resourceId:string):RepositoryResult<string|null>{return this.execute(context,()=>{const r=this.database(context).prepare('SELECT id FROM ai_consents WHERE account_id=? AND purpose=? AND resource_type=? AND resource_id=?').get(accountId,purpose,resourceType,resourceId) as {id:string}|undefined;return r?.id??null;});}
 upsert(context:RepositoryExecutionContext,row:AiConsentView):RepositoryResult<void>{return this.execute(context,()=>{this.database(context).prepare('INSERT INTO ai_consents(id,account_id,purpose,resource_type,resource_id,status,starts_at,ends_at,created_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,starts_at=excluded.starts_at,ends_at=excluded.ends_at').run(row.id,row.accountId,row.purpose,row.resourceType,row.resourceId,row.status,row.startsAt,row.endsAt??null,row.createdAt);});}
 listActive(context:RepositoryExecutionContext,accountId:string,purpose:string,at:string):RepositoryResult<readonly AiConsentView[]>{return this.execute(context,()=> (this.database(context).prepare('SELECT id,account_id,purpose,resource_type,resource_id,status,starts_at,ends_at,created_at FROM ai_consents WHERE account_id=? AND purpose=? AND starts_at<=? AND (ends_at IS NULL OR ends_at>=?)').all(accountId,purpose,at,at) as Array<Record<string,unknown>>).map(consent));}
 countRevoked(context:RepositoryExecutionContext,accountId:string,purpose:string):RepositoryResult<number>{return this.execute(context,()=>Number((this.database(context).prepare("SELECT COUNT(*) c FROM ai_consents WHERE account_id=? AND purpose=? AND status='revoked'").get(accountId,purpose) as {c:number}).c));}
 listAllowedResources(context:RepositoryExecutionContext,resourceType:string,resourceId:string):RepositoryResult<readonly AiConsentResourceRow[]>{return this.execute(context,()=>{
  const database=this.database(context);
  const load=(allSql:string,oneSql:string,title:(row:Record<string,unknown>)=>string):readonly AiConsentResourceRow[]=>{
   const rows=(resourceId==='*'?database.prepare(allSql).all():database.prepare(oneSql).all(resourceId)) as Array<Record<string,unknown>>;
   return rows.map(row=>({resourceType,resourceId:String(row.id),title:title(row)}));
  };
  if(resourceType==='event')return load('SELECT id,title FROM governed_timeline_events WHERE ai_processing_allowed=1','SELECT id,title FROM governed_timeline_events WHERE id=? AND ai_processing_allowed=1',row=>String(row.title));
  if(resourceType==='archive_item')return load('SELECT id,title FROM archive_items WHERE ai_processing_allowed=1 AND destroyed_at IS NULL','SELECT id,title FROM archive_items WHERE id=? AND ai_processing_allowed=1 AND destroyed_at IS NULL',row=>String(row.title));
  if(resourceType==='person')return load("SELECT id,display_name FROM people WHERE status='active'","SELECT id,display_name FROM people WHERE id=? AND status='active'",row=>String(row.display_name));
  if(resourceType==='finance_record')return load('SELECT id,title FROM finance_records','SELECT id,title FROM finance_records WHERE id=?',row=>String(row.title));
  if(resourceType==='health_record')return load('SELECT id,title FROM health_records','SELECT id,title FROM health_records WHERE id=?',row=>String(row.title));
  if(resourceType==='life_record')return load("SELECT id,title FROM life_records WHERE status<>'deleted'","SELECT id,title FROM life_records WHERE id=? AND status<>'deleted'",row=>String(row.title));
  if(resourceType==='local_ocr_job')return load("SELECT id FROM local_governed_ocr_jobs WHERE status<>'deleted'","SELECT id FROM local_governed_ocr_jobs WHERE id=? AND status<>'deleted'",()=> 'Yerel OCR işi');
  if(resourceType==='household_operation_item')return load("SELECT id,title FROM household_operation_items WHERE status<>'deleted'","SELECT id,title FROM household_operation_items WHERE id=? AND status<>'deleted'",row=>String(row.title));
  if(resourceType==='places_travel_item')return load("SELECT id,title FROM places_travel_items WHERE status<>'deleted'","SELECT id,title FROM places_travel_items WHERE id=? AND status<>'deleted'",row=>String(row.title));
  return [];
 });}
 listSensitiveDataInventory(context:RepositoryExecutionContext,at:string):RepositoryResult<readonly SensitiveDataInventoryRow[]>{return this.execute(context,()=>{const database=this.database(context);const count=(sql:string,...parameters:unknown[]):number=>Number((database.prepare(sql).get(...parameters) as {count:number}).count);return [
  {category:'child',recordCount:count("SELECT COUNT(*) AS count FROM people WHERE birth_date IS NOT NULL AND date(birth_date)>date(?,'-18 years')",at),fieldNames:['Ad soyad','Doğum tarihi','Yakınlık','Aile dalı']},
  {category:'health',recordCount:count('SELECT (SELECT COUNT(*) FROM health_records)+(SELECT COUNT(*) FROM medication_plans)+(SELECT COUNT(*) FROM family_health_history) AS count'),fieldNames:['Sağlık kaydı','İlaç planı','Aile sağlık geçmişi','Sağlayıcı','Tarih']},
  {category:'finance',recordCount:count('SELECT (SELECT COUNT(*) FROM finance_records)+(SELECT COUNT(*) FROM finance_valuations)+(SELECT COUNT(*) FROM bank_accounts)+(SELECT COUNT(*) FROM payment_cards)+(SELECT COUNT(*) FROM loan_accounts)+(SELECT COUNT(*) FROM loan_payment_history)+(SELECT COUNT(*) FROM finance_planning_ledger)+(SELECT COUNT(*) FROM finance_import_batches)+(SELECT COUNT(*) FROM finance_import_entries) AS count'),fieldNames:['Finans kaydı','Banka hesabı (maskeli)','Kart (son dört hane)','Kredi','Kredi ödeme geçmişi','Finans planlama ve portföy kaydı','Kontrollü içe aktarma paketi','İçe aktarılan hareket','Tutar','Para birimi','Değerleme','Tarih']},
  {category:'location',recordCount:count('SELECT COUNT(*) AS count FROM locations'),fieldNames:['Konum etiketi','Adres','Koordinat','Konum türü']}
 ] as const;});}
}
