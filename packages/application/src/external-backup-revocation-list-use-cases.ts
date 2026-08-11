import { ERROR_CODES, createAppError, err, ok, type AppError, type Result } from '@ppt/core';
import { isAdministrativeRole } from '@ppt/security';
import type {
  ApplyExternalBackupEvidenceRevocationListInput,
  ExternalBackupEvidenceIssuerView,
  ExternalBackupEvidenceRevocationListView
} from '@ppt/domain';
import type { StrongAuthenticationPort } from './data-lifecycle-use-cases.js';
import type { ExternalBackupInventoryApplicationContext } from './external-backup-inventory-use-cases.js';
import { externalBackupEvidenceIssuerTrustedAt } from './external-backup-evidence-use-cases.js';

export interface ExternalBackupRevocationListCryptoPort {
  verifyEd25519Signature(input:{readonly publicKeyPem:string;readonly payload:string;readonly signatureBase64:string}):Result<boolean,string>;
  sha256Utf8(value:string):string;
}
export interface ExternalBackupRevocationListQueryPort {
  listEvidenceIssuers(context:ExternalBackupInventoryApplicationContext,limit:number):Result<readonly ExternalBackupEvidenceIssuerView[],AppError>;
  findEvidenceIssuer(context:ExternalBackupInventoryApplicationContext,id:string):Result<ExternalBackupEvidenceIssuerView|null,AppError>;
  findEvidenceIssuerByFingerprint(context:ExternalBackupInventoryApplicationContext,fingerprintSha256:string):Result<ExternalBackupEvidenceIssuerView|null,AppError>;
  listEvidenceRevocationLists(context:ExternalBackupInventoryApplicationContext,limit:number):Result<readonly ExternalBackupEvidenceRevocationListView[],AppError>;
  findLatestEvidenceRevocationList(context:ExternalBackupInventoryApplicationContext,authorityRootIssuerId:string):Result<ExternalBackupEvidenceRevocationListView|null,AppError>;
  findEvidenceRevocationListByListId(context:ExternalBackupInventoryApplicationContext,authorityRootIssuerId:string,listId:string):Result<ExternalBackupEvidenceRevocationListView|null,AppError>;
}
export interface ExternalBackupRevocationListWritePort {
  applyEvidenceRevocationList(context:ExternalBackupInventoryApplicationContext,input:{readonly list:{readonly id:string;readonly authorityRootIssuerId:string;readonly signerIssuerId:string;readonly listId:string;readonly sequenceNumber:number;readonly schemaVersion:1;readonly thisUpdate:string;readonly nextUpdate:string;readonly payloadSha256:string;readonly signatureBase64:string;readonly canonicalPayloadJson:string;readonly sourceUrl?:string;readonly status:'current';readonly verifiedAt:string;readonly createdBy:string;readonly createdAt:string};readonly entries:readonly {readonly id:string;readonly listRowId:string;readonly issuerId:string;readonly fingerprintSha256:string;readonly revokedAt:string;readonly reason:string}[];readonly issuerUpdates:readonly {readonly issuerId:string;readonly expectedUpdatedAt:string;readonly revokedAt:string;readonly reason:string}[]}):Result<ExternalBackupEvidenceRevocationListView|null,AppError>;
}

export interface ExternalBackupEvidenceRevocationListV1 {
  readonly schemaVersion:1;
  readonly type:'external-backup-evidence-revocation-list';
  readonly listId:string;
  readonly authorityRootIssuerId:string;
  readonly signerIssuerId:string;
  readonly sequenceNumber:number;
  readonly thisUpdate:string;
  readonly nextUpdate:string;
  readonly entries:readonly {readonly fingerprintSha256:string;readonly revokedAt:string;readonly reason:string}[];
  readonly statement:'issuer-key-revocation-status';
}
export const canonicalExternalBackupEvidenceRevocationList=(list:ExternalBackupEvidenceRevocationListV1):string=>JSON.stringify({schemaVersion:1,type:'external-backup-evidence-revocation-list',listId:list.listId,authorityRootIssuerId:list.authorityRootIssuerId,signerIssuerId:list.signerIssuerId,sequenceNumber:list.sequenceNumber,thisUpdate:list.thisUpdate,nextUpdate:list.nextUpdate,entries:[...list.entries].sort((a,b)=>a.fingerprintSha256.localeCompare(b.fingerprintSha256)).map(entry=>({fingerprintSha256:entry.fingerprintSha256,revokedAt:entry.revokedAt,reason:entry.reason})),statement:'issuer-key-revocation-status'});
export const externalBackupEvidenceRevocationListConfirmation=(signerIssuerId:string,sequenceNumber:number)=>`KANIT İPTAL LİSTESİ ${signerIssuerId} ${sequenceNumber}`;

const denied=(context:ExternalBackupInventoryApplicationContext)=>createAppError({code:ERROR_CODES.AUTHORIZATION_DENIED,message:'İmzalı iptal listelerini yalnız aile yöneticisi kullanabilir.',category:'authorization',correlationId:context.correlationId});
const invalid=(context:ExternalBackupInventoryApplicationContext,message:string)=>createAppError({code:ERROR_CODES.CORE_INVALID_ARGUMENT,message,category:'validation',correlationId:context.correlationId});
const missing=(context:ExternalBackupInventoryApplicationContext,message:string)=>createAppError({code:ERROR_CODES.RESOURCE_NOT_FOUND,message,category:'not_found',correlationId:context.correlationId});
const conflict=(context:ExternalBackupInventoryApplicationContext,message:string)=>createAppError({code:ERROR_CODES.RESOURCE_CONFLICT,message,category:'conflict',correlationId:context.correlationId});
const requireAdmin=<T>(context:ExternalBackupInventoryApplicationContext,operation:()=>Result<T,AppError>):Result<T,AppError>=>isAdministrativeRole(context.actor.role)?operation():err(denied(context));
const iso=(value:string)=>{const parsed=Date.parse(value);return Number.isNaN(parsed)?null:new Date(parsed).toISOString();};
const validIdentifier=(value:string)=>/^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/.test(value);
const validSha256=(value:string)=>/^[a-f0-9]{64}$/.test(value);
const validSignature=(value:string)=>{try{return /^[A-Za-z0-9+/]+={0,2}$/.test(value)&&Buffer.from(value,'base64').length===64;}catch{return false;}};
const resolveRoot=(issuer:ExternalBackupEvidenceIssuerView,all:readonly ExternalBackupEvidenceIssuerView[]):string|null=>{
  const byId=new Map(all.map(item=>[item.id,item] as const));
  let current=issuer;const visited=new Set<string>();
  while(current.predecessorIssuerId){if(visited.has(current.id))return null;visited.add(current.id);const parent=byId.get(current.predecessorIssuerId);if(!parent)return null;current=parent;}
  return current.id;
};

export class ListExternalBackupEvidenceRevocationListsUseCase {
  constructor(private readonly query:ExternalBackupRevocationListQueryPort){}
  execute(context:ExternalBackupInventoryApplicationContext,limit=100){return requireAdmin(context,()=>this.query.listEvidenceRevocationLists(context,Math.max(1,Math.min(500,Math.trunc(limit)))));}
}

export class ApplyExternalBackupEvidenceRevocationListUseCase {
  constructor(private readonly query:ExternalBackupRevocationListQueryPort,private readonly write:ExternalBackupRevocationListWritePort,private readonly crypto:ExternalBackupRevocationListCryptoPort,private readonly strongAuth:StrongAuthenticationPort){}
  execute(context:ExternalBackupInventoryApplicationContext,input:ApplyExternalBackupEvidenceRevocationListInput,ids:{readonly list:string;readonly entries:readonly string[]},verifiedAt:string):Result<ExternalBackupEvidenceRevocationListView,AppError>{
    return requireAdmin(context,()=>{
      const signerIssuerId=input.signerIssuerId.trim(),listId=input.listId.trim();
      if(!validIdentifier(signerIssuerId)||!validIdentifier(listId))return err(invalid(context,'İmzalayan sağlayıcı veya liste kimliği geçersizdir.'));
      const sequenceNumber=Math.trunc(input.sequenceNumber);if(sequenceNumber<1||sequenceNumber>2_147_483_647)return err(invalid(context,'Liste sıra numarası 1 ile 2147483647 arasında olmalıdır.'));
      if(input.confirmation!==externalBackupEvidenceRevocationListConfirmation(signerIssuerId,sequenceNumber))return err(invalid(context,`İptal listesini uygulamak için tam olarak “${externalBackupEvidenceRevocationListConfirmation(signerIssuerId,sequenceNumber)}” yazılmalıdır.`));
      const thisUpdate=iso(input.thisUpdate),nextUpdate=iso(input.nextUpdate),verifiedAtIso=iso(verifiedAt);if(!thisUpdate||!nextUpdate||!verifiedAtIso)return err(invalid(context,'Liste zaman alanları geçerli ISO-8601 değeri olmalıdır.'));
      const thisMs=Date.parse(thisUpdate),nextMs=Date.parse(nextUpdate),verifiedMs=Date.parse(verifiedAtIso);
      if(nextMs<=thisMs||nextMs-thisMs>31*24*60*60*1000)return err(invalid(context,'İptal listesi geçerlilik penceresi pozitif ve en fazla 31 gün olmalıdır.'));
      if(thisMs>verifiedMs+300_000)return err(invalid(context,'Liste zamanı doğrulama zamanından beş dakikadan fazla ileride olamaz.'));
      if(nextMs<=verifiedMs)return err(conflict(context,'Süresi dolmuş iptal listesi güven durumunu güncelleyemez.'));
      const sourceUrl=input.sourceUrl?.trim();if(sourceUrl){try{const parsed=new URL(sourceUrl);if(parsed.protocol!=='https:'||parsed.username||parsed.password)return err(invalid(context,'İptal listesi kaynağı kimlik bilgisi içermeyen HTTPS adresi olmalıdır.'));}catch{return err(invalid(context,'İptal listesi kaynak adresi geçersizdir.'));}}
      if(!Array.isArray(input.entries)||input.entries.length<1||input.entries.length>500)return err(invalid(context,'İptal listesi 1 ile 500 kayıt içermelidir.'));
      if(ids.entries.length!==input.entries.length)return err(invalid(context,'İptal listesi kayıt kimlikleri eksiktir.'));
      const signatureBase64=input.signatureBase64.trim();if(!validSignature(signatureBase64))return err(invalid(context,'Ed25519 liste imzası geçerli 64 bayt Base64 biçiminde olmalıdır.'));
      const issuers=this.query.listEvidenceIssuers(context,500);if(!issuers.ok)return issuers;
      const signer=issuers.value.find(item=>item.id===signerIssuerId);if(!signer)return err(missing(context,'İptal listesini imzalayan sağlayıcı anahtarı bulunamadı.'));
      if(!externalBackupEvidenceIssuerTrustedAt(signer,thisUpdate))return err(conflict(context,'Liste düzenlenme tarihinde imzalayan anahtar güven aralığında değildir.'));
      const authorityRootIssuerId=resolveRoot(signer,issuers.value);if(!authorityRootIssuerId)return err(conflict(context,'Sağlayıcı anahtar zincirinin kökü güvenli biçimde çözümlenemedi.'));
      const latest=this.query.findLatestEvidenceRevocationList(context,authorityRootIssuerId);if(!latest.ok)return latest;if(latest.value&&sequenceNumber<=latest.value.sequenceNumber)return err(conflict(context,'Liste sıra numarası son doğrulanmış listeden büyük olmalıdır; geri alma saldırısı reddedildi.'));
      const duplicateList=this.query.findEvidenceRevocationListByListId(context,authorityRootIssuerId,listId);if(!duplicateList.ok)return duplicateList;if(duplicateList.value)return err(conflict(context,'Bu iptal listesi kimliği daha önce kullanılmıştır.'));
      const normalizedEntries:{fingerprintSha256:string;revokedAt:string;reason:string;issuer:ExternalBackupEvidenceIssuerView}[]=[];const seen=new Set<string>();
      for(const raw of input.entries){const fingerprint=raw.fingerprintSha256.trim().toLowerCase();if(!validSha256(fingerprint)||seen.has(fingerprint))return err(invalid(context,'İptal edilen anahtar parmak izleri benzersiz 64 karakterlik SHA-256 değerleri olmalıdır.'));seen.add(fingerprint);const revokedAt=iso(raw.revokedAt);if(!revokedAt||Date.parse(revokedAt)>thisMs+300_000)return err(invalid(context,'Anahtar iptal zamanı liste zamanından beş dakikadan fazla ileride olamaz.'));const reason=raw.reason.trim();if(reason.length<12||reason.length>1000)return err(invalid(context,'Her iptal gerekçesi 12 ile 1000 karakter arasında olmalıdır.'));const target=issuers.value.find(item=>item.fingerprintSha256===fingerprint);if(!target)return err(missing(context,`İptal listesindeki ${fingerprint.slice(0,12)}… anahtarı yerel güven zincirinde bulunamadı.`));if(target.id===signerIssuerId)return err(conflict(context,'Bir iptal listesi kendisini imzalayan anahtarı aynı belgede iptal edemez.'));const targetRoot=resolveRoot(target,issuers.value);if(targetRoot!==authorityRootIssuerId)return err(conflict(context,'İptal listesi başka bir sağlayıcı güven zincirindeki anahtarı iptal edemez.'));if(target.status==='revoked')return err(conflict(context,`“${target.label}” anahtarı zaten iptal edilmiştir.`));normalizedEntries.push({fingerprintSha256:fingerprint,revokedAt,reason,issuer:target});}
      const receipt:ExternalBackupEvidenceRevocationListV1={schemaVersion:1,type:'external-backup-evidence-revocation-list',listId,authorityRootIssuerId,signerIssuerId,sequenceNumber,thisUpdate,nextUpdate,entries:normalizedEntries.map(({fingerprintSha256,revokedAt,reason})=>({fingerprintSha256,revokedAt,reason})),statement:'issuer-key-revocation-status'};
      const canonicalPayloadJson=canonicalExternalBackupEvidenceRevocationList(receipt),payloadSha256=this.crypto.sha256Utf8(canonicalPayloadJson);
      const authenticated=this.strongAuth.verify(context,{password:input.password,...(input.code?{code:input.code}:{})});if(!authenticated.ok)return authenticated;
      const signature=this.crypto.verifyEd25519Signature({publicKeyPem:signer.publicKeyPem,payload:canonicalPayloadJson,signatureBase64});if(!signature.ok)return err(invalid(context,signature.error));if(!signature.value)return err(invalid(context,'İptal listesi imzası güvenilen sağlayıcı anahtarıyla doğrulanamadı.'));
      const applied=this.write.applyEvidenceRevocationList(context,{list:{id:ids.list,authorityRootIssuerId,signerIssuerId,listId,sequenceNumber,schemaVersion:1,thisUpdate,nextUpdate,payloadSha256,signatureBase64,canonicalPayloadJson,...(sourceUrl?{sourceUrl}:{}),status:'current',verifiedAt:verifiedAtIso,createdBy:context.actor.userId,createdAt:verifiedAtIso},entries:normalizedEntries.map((entry,index)=>({id:ids.entries[index]!,listRowId:ids.list,issuerId:entry.issuer.id,fingerprintSha256:entry.fingerprintSha256,revokedAt:entry.revokedAt,reason:entry.reason})),issuerUpdates:normalizedEntries.map(entry=>({issuerId:entry.issuer.id,expectedUpdatedAt:entry.issuer.updatedAt,revokedAt:entry.revokedAt,reason:entry.reason}))});
      if(!applied.ok)return applied;return applied.value?ok(applied.value):err(conflict(context,'İptal listesi sıra numarası veya sağlayıcı kayıtları eşzamanlı değişti; liste uygulanmadı.'));
    });
  }
}
