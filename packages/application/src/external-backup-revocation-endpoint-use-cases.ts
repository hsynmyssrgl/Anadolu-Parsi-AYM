import { ERROR_CODES, createAppError, err, ok, type AppError, type Result } from '@ppt/core';
import { isAdministrativeRole } from '@ppt/security';
import type { ExternalBackupEvidenceIssuerView, ExternalBackupRevocationEndpointView, UpsertExternalBackupRevocationEndpointInput } from '@ppt/domain';
import type { StrongAuthenticationPort } from './data-lifecycle-use-cases.js';
import type { ExternalBackupInventoryApplicationContext } from './external-backup-inventory-use-cases.js';

export interface ExternalBackupRevocationEndpointQueryPort {
  listRevocationEndpoints(context:ExternalBackupInventoryApplicationContext,limit:number):Result<readonly ExternalBackupRevocationEndpointView[],AppError>;
  findRevocationEndpoint(context:ExternalBackupInventoryApplicationContext,id:string):Result<ExternalBackupRevocationEndpointView|null,AppError>;
  findRevocationEndpointByIssuer(context:ExternalBackupInventoryApplicationContext,issuerId:string):Result<ExternalBackupRevocationEndpointView|null,AppError>;
  findEvidenceIssuer(context:ExternalBackupInventoryApplicationContext,id:string):Result<ExternalBackupEvidenceIssuerView|null,AppError>;
}
export interface ExternalBackupRevocationEndpointWritePort {
  upsertRevocationEndpoint(context:ExternalBackupInventoryApplicationContext,row:{readonly id:string;readonly issuerId:string;readonly sourceUrl:string;readonly primarySpkiSha256:string;readonly secondarySpkiSha256?:string;readonly secondaryValidFrom?:string;readonly primaryValidUntil?:string;readonly status:'active'|'disabled';readonly createdBy:string;readonly createdAt:string;readonly updatedAt:string},expectedUpdatedAt?:string):Result<ExternalBackupRevocationEndpointView|null,AppError>;
  recordRevocationEndpointFetch(context:ExternalBackupInventoryApplicationContext,input:{readonly id:string;readonly fetchedAt:string;readonly status:'success'|'failed';readonly error?:string}):Result<ExternalBackupRevocationEndpointView|null,AppError>;
}

export const externalBackupRevocationEndpointConfirmation=(issuerId:string)=>`KANIT HTTPS KAYNAĞI ${issuerId}`;
const invalid=(context:ExternalBackupInventoryApplicationContext,message:string)=>createAppError({code:ERROR_CODES.CORE_INVALID_ARGUMENT,message,category:'validation',correlationId:context.correlationId});
const denied=(context:ExternalBackupInventoryApplicationContext)=>createAppError({code:ERROR_CODES.AUTHORIZATION_DENIED,message:'İptal listesi HTTPS kaynaklarını yalnız aile yöneticisi değiştirebilir.',category:'authorization',correlationId:context.correlationId});
const missing=(context:ExternalBackupInventoryApplicationContext,message:string)=>createAppError({code:ERROR_CODES.RESOURCE_NOT_FOUND,message,category:'not_found',correlationId:context.correlationId});
const conflict=(context:ExternalBackupInventoryApplicationContext,message:string)=>createAppError({code:ERROR_CODES.RESOURCE_CONFLICT,message,category:'conflict',correlationId:context.correlationId});
const pin=(value:string)=>value.trim().toLowerCase().replace(/^sha256[:/]/,'');
const iso=(value:string|undefined)=>{if(!value)return undefined;const parsed=Date.parse(value);return Number.isNaN(parsed)?null:new Date(parsed).toISOString();};
const validPin=(value:string)=>/^[a-f0-9]{64}$/.test(value);
const normalizeHttpsSource=(value:string):string|null=>{try{const url=new URL(value.trim());if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||!url.hostname||url.hash)return null;url.username='';url.password='';return url.toString();}catch{return null;}};

export const resolveExternalBackupRevocationEndpointPins=(endpoint:ExternalBackupRevocationEndpointView,at:string):readonly {sha256:string;kind:'primary'|'secondary'}[]=>{
  if(endpoint.status!=='active')return [];
  const now=Date.parse(at);if(!Number.isFinite(now))return [];
  const pins:{sha256:string;kind:'primary'|'secondary'}[]=[];
  const primaryUntil=endpoint.primaryValidUntil?Date.parse(endpoint.primaryValidUntil):Number.POSITIVE_INFINITY;
  if(now<primaryUntil)pins.push({sha256:endpoint.primarySpkiSha256,kind:'primary'});
  if(endpoint.secondarySpkiSha256&&endpoint.secondaryValidFrom&&now>=Date.parse(endpoint.secondaryValidFrom))pins.push({sha256:endpoint.secondarySpkiSha256,kind:'secondary'});
  return pins;
};

export class ListExternalBackupRevocationEndpointsUseCase {
  constructor(private readonly query:ExternalBackupRevocationEndpointQueryPort){}
  execute(context:ExternalBackupInventoryApplicationContext,limit=100):Result<readonly ExternalBackupRevocationEndpointView[],AppError>{return isAdministrativeRole(context.actor.role)?this.query.listRevocationEndpoints(context,Math.max(1,Math.min(500,Math.trunc(limit)))):err(denied(context));}
}
export class FindExternalBackupRevocationEndpointUseCase {
  constructor(private readonly query:ExternalBackupRevocationEndpointQueryPort){}
  execute(context:ExternalBackupInventoryApplicationContext,id:string):Result<ExternalBackupRevocationEndpointView,AppError>{if(!isAdministrativeRole(context.actor.role))return err(denied(context));const result=this.query.findRevocationEndpoint(context,id);if(!result.ok)return result;return result.value?ok(result.value):err(missing(context,'İptal listesi HTTPS kaynak profili bulunamadı.'));}
}
export class UpsertExternalBackupRevocationEndpointUseCase {
  constructor(private readonly query:ExternalBackupRevocationEndpointQueryPort,private readonly write:ExternalBackupRevocationEndpointWritePort,private readonly strongAuth:StrongAuthenticationPort){}
  execute(context:ExternalBackupInventoryApplicationContext,input:UpsertExternalBackupRevocationEndpointInput,id:string,occurredAt:string):Result<ExternalBackupRevocationEndpointView,AppError>{
    if(!isAdministrativeRole(context.actor.role))return err(denied(context));
    const issuerId=input.issuerId.trim();if(input.confirmation!==externalBackupRevocationEndpointConfirmation(issuerId))return err(invalid(context,`Kaynağı kaydetmek için tam olarak “${externalBackupRevocationEndpointConfirmation(issuerId)}” yazılmalıdır.`));
    const issuer=this.query.findEvidenceIssuer(context,issuerId);if(!issuer.ok)return issuer;if(!issuer.value)return err(missing(context,'Kaynağın bağlanacağı güven kökü bulunamadı.'));if(issuer.value.predecessorIssuerId)return err(conflict(context,'HTTPS kaynak profili yalnız sağlayıcı güven zincirinin kök anahtarına bağlanabilir.'));if(issuer.value.status!=='trusted')return err(conflict(context,'İptal edilmiş sağlayıcı için etkin HTTPS kaynak profili oluşturulamaz.'));
    const sourceUrl=normalizeHttpsSource(input.sourceUrl);if(!sourceUrl)return err(invalid(context,'Kaynak, kimlik bilgisi ve fragment içermeyen standart HTTPS adresi olmalıdır.'));
    const primary=pin(input.primarySpkiSha256);if(!validPin(primary))return err(invalid(context,'Birincil TLS SPKI pini 64 karakter küçük onaltılık SHA-256 olmalıdır.'));
    const secondaryRaw=input.secondarySpkiSha256?.trim();const secondary=secondaryRaw?pin(secondaryRaw):undefined;
    const secondaryValidFrom=iso(input.secondaryValidFrom),primaryValidUntil=iso(input.primaryValidUntil);
    if(secondaryRaw&&!secondary)return err(invalid(context,'Geçiş TLS pini geçersizdir.'));
    if(secondary&&!validPin(secondary))return err(invalid(context,'Geçiş TLS SPKI pini 64 karakter küçük onaltılık SHA-256 olmalıdır.'));
    if(Boolean(secondary)!==Boolean(secondaryValidFrom)||Boolean(secondary)!==Boolean(primaryValidUntil))return err(invalid(context,'Pin döndürme için geçiş pini, geçiş başlangıcı ve eski pin bitişi birlikte girilmelidir.'));
    if(secondaryValidFrom===null||primaryValidUntil===null)return err(invalid(context,'Pin geçerlilik tarihleri ISO-8601 biçiminde olmalıdır.'));
    if(secondary&&secondary===primary)return err(invalid(context,'Birincil ve geçiş TLS pinleri aynı olamaz.'));
    if(secondary&&secondaryValidFrom&&primaryValidUntil){const start=Date.parse(secondaryValidFrom),end=Date.parse(primaryValidUntil),now=Date.parse(occurredAt);if(start>end)return err(invalid(context,'Geçiş pini eski pin sona erdikten sonra başlayamaz.'));if(end-start>14*86_400_000)return err(invalid(context,'Çift-pin örtüşme penceresi en fazla 14 gün olabilir.'));if(end<=now)return err(conflict(context,'Eski pin bitiş zamanı gelecekte olmalıdır.'));if(start>now+90*86_400_000)return err(invalid(context,'Geçiş pini en fazla 90 gün önceden planlanabilir.'));}
    const authenticated=this.strongAuth.verify(context,{password:input.password,...(input.code?{code:input.code}:{})});if(!authenticated.ok)return authenticated;
    const existing=this.query.findRevocationEndpointByIssuer(context,issuerId);if(!existing.ok)return existing;
    const stored=this.write.upsertRevocationEndpoint(context,{id:existing.value?.id??id,issuerId,sourceUrl,primarySpkiSha256:primary,...(secondary?{secondarySpkiSha256:secondary}:{}),...(secondaryValidFrom?{secondaryValidFrom}:{}),...(primaryValidUntil?{primaryValidUntil}:{}),status:input.enabled?'active':'disabled',createdBy:existing.value?.createdBy??context.actor.userId,createdAt:existing.value?.createdAt??occurredAt,updatedAt:occurredAt},existing.value?.updatedAt);
    if(!stored.ok)return stored;return stored.value?ok(stored.value):err(conflict(context,'HTTPS kaynak profili eşzamanlı değişti; güncelleme uygulanmadı.'));
  }
}
export class RecordExternalBackupRevocationEndpointFetchUseCase {
  constructor(private readonly write:ExternalBackupRevocationEndpointWritePort){}
  execute(context:ExternalBackupInventoryApplicationContext,input:{readonly id:string;readonly fetchedAt:string;readonly status:'success'|'failed';readonly error?:string}){return this.write.recordRevocationEndpointFetch(context,input);}
}
