import { isAdministrativeRole } from '@ppt/security';
import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import type {
  ExternalBackupCopyView,
  ExternalBackupDestructionEvidenceView,
  ExternalBackupEvidenceIssuerRotationView,
  ExternalBackupEvidenceIssuerView,
  RegisterExternalBackupEvidenceIssuerInput,
  RevokeExternalBackupEvidenceIssuerInput,
  RotateExternalBackupEvidenceIssuerInput,
  VerifyExternalBackupDestructionEvidenceInput
} from '@ppt/domain';
import type { StrongAuthenticationPort } from './data-lifecycle-use-cases.js';
import type { ExternalBackupInventoryApplicationContext } from './external-backup-inventory-use-cases.js';

export interface ExternalBackupEvidenceCryptoPort {
  inspectEd25519PublicKey(publicKeyPem:string):Result<{readonly normalizedPublicKeyPem:string;readonly fingerprintSha256:string},string>;
  sha256Utf8(value:string):string;
  verifyEd25519Signature(input:{readonly publicKeyPem:string;readonly payload:string;readonly signatureBase64:string}):Result<boolean,string>;
}
export interface ExternalBackupEvidenceQueryPort {
  findCopy(context:ExternalBackupInventoryApplicationContext,id:string):Result<ExternalBackupCopyView|null,AppError>;
  listEvidenceIssuers(context:ExternalBackupInventoryApplicationContext,limit:number):Result<readonly ExternalBackupEvidenceIssuerView[],AppError>;
  findEvidenceIssuer(context:ExternalBackupInventoryApplicationContext,id:string):Result<ExternalBackupEvidenceIssuerView|null,AppError>;
  findEvidenceIssuerByFingerprint(context:ExternalBackupInventoryApplicationContext,fingerprintSha256:string):Result<ExternalBackupEvidenceIssuerView|null,AppError>;
  listEvidenceIssuerRotations(context:ExternalBackupInventoryApplicationContext,limit:number):Result<readonly ExternalBackupEvidenceIssuerRotationView[],AppError>;
  findEvidenceIssuerRotationByReceipt(context:ExternalBackupInventoryApplicationContext,predecessorIssuerId:string,receiptId:string):Result<ExternalBackupEvidenceIssuerRotationView|null,AppError>;
  listDestructionEvidence(context:ExternalBackupInventoryApplicationContext,copyId:string|undefined,limit:number):Result<readonly ExternalBackupDestructionEvidenceView[],AppError>;
  findDestructionEvidenceByReceipt(context:ExternalBackupInventoryApplicationContext,issuerId:string,receiptId:string):Result<ExternalBackupDestructionEvidenceView|null,AppError>;
}
export interface ExternalBackupEvidenceWritePort {
  insertEvidenceIssuer(context:ExternalBackupInventoryApplicationContext,row:{readonly id:string;readonly label:string;readonly algorithm:'ed25519';readonly publicKeyPem:string;readonly fingerprintSha256:string;readonly status:'trusted';readonly validFrom:string;readonly validUntil?:string;readonly predecessorIssuerId?:string;readonly rotationSequence:number;readonly rotationReceiptId?:string;readonly rotationVerifiedAt?:string;readonly verificationMethod:'legacy_unverified'|'out_of_band_dual_evidence'|'rotation_inherited';readonly legalEntityName?:string;readonly identityEvidenceReference?:string;readonly keyFingerprintEvidenceReference?:string;readonly verificationWitnessName?:string;readonly verificationWitnessOrganization?:string;readonly verificationCheckedAt?:string;readonly verificationReceiptSha256?:string;readonly addedBy:string;readonly addedAt:string;readonly updatedAt:string}):Result<ExternalBackupEvidenceIssuerView,AppError>;
  rotateEvidenceIssuer(context:ExternalBackupInventoryApplicationContext,input:{readonly expectedPredecessorUpdatedAt:string;readonly successor:{readonly id:string;readonly label:string;readonly algorithm:'ed25519';readonly publicKeyPem:string;readonly fingerprintSha256:string;readonly status:'trusted';readonly validFrom:string;readonly predecessorIssuerId:string;readonly rotationSequence:number;readonly rotationReceiptId:string;readonly rotationVerifiedAt:string;readonly verificationMethod:'legacy_unverified'|'out_of_band_dual_evidence'|'rotation_inherited';readonly legalEntityName?:string;readonly identityEvidenceReference?:string;readonly keyFingerprintEvidenceReference?:string;readonly verificationWitnessName?:string;readonly verificationWitnessOrganization?:string;readonly verificationCheckedAt?:string;readonly verificationReceiptSha256?:string;readonly addedBy:string;readonly addedAt:string;readonly updatedAt:string};readonly rotation:{readonly id:string;readonly predecessorIssuerId:string;readonly successorIssuerId:string;readonly receiptId:string;readonly schemaVersion:1;readonly successorFingerprintSha256:string;readonly effectiveAt:string;readonly signatureBase64:string;readonly canonicalPayloadJson:string;readonly verifiedAt:string;readonly createdBy:string;readonly createdAt:string};readonly eventIds:{readonly predecessor:string;readonly successor:string}}):Result<{readonly predecessor:ExternalBackupEvidenceIssuerView;readonly successor:ExternalBackupEvidenceIssuerView;readonly rotation:ExternalBackupEvidenceIssuerRotationView}|null,AppError>;
  revokeEvidenceIssuer(context:ExternalBackupInventoryApplicationContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly reason:string;readonly revokedBy:string;readonly revokedAt:string}):Result<ExternalBackupEvidenceIssuerView|null,AppError>;
  insertVerifiedDestructionEvidence(context:ExternalBackupInventoryApplicationContext,input:{readonly expectedCopyUpdatedAt:string;readonly evidence:{readonly id:string;readonly copyId:string;readonly issuerId:string;readonly receiptId:string;readonly schemaVersion:1;readonly evidenceSha256:string;readonly signatureBase64:string;readonly canonicalPayloadJson:string;readonly issuedAt:string;readonly verificationStatus:'verified';readonly verifiedAt:string;readonly createdBy:string;readonly createdAt:string;readonly updatedAt:string}}):Result<{readonly copy:ExternalBackupCopyView;readonly evidence:ExternalBackupDestructionEvidenceView}|null,AppError>;
}

const denied=(context:ExternalBackupInventoryApplicationContext)=>createAppError({code:ERROR_CODES.AUTHORIZATION_DENIED,message:'İmzalı imha kanıtı güven zincirini yalnız aile yöneticisi kullanabilir.',category:'authorization',correlationId:context.correlationId});
const invalid=(context:ExternalBackupInventoryApplicationContext,message:string)=>createAppError({code:ERROR_CODES.CORE_INVALID_ARGUMENT,message,category:'validation',correlationId:context.correlationId});
const missing=(context:ExternalBackupInventoryApplicationContext,message:string)=>createAppError({code:ERROR_CODES.RESOURCE_NOT_FOUND,message,category:'not_found',correlationId:context.correlationId});
const conflict=(context:ExternalBackupInventoryApplicationContext,message:string)=>createAppError({code:ERROR_CODES.RESOURCE_CONFLICT,message,category:'conflict',correlationId:context.correlationId});
const requireAdmin=<T>(context:ExternalBackupInventoryApplicationContext,operation:()=>Result<T,AppError>):Result<T,AppError>=>isAdministrativeRole(context.actor.role)?operation():err(denied(context));
const validSha256=(value:string)=>/^[a-f0-9]{64}$/.test(value);
const validIdentifier=(value:string)=>/^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/.test(value);
const validSignature=(value:string)=>{try{return /^[A-Za-z0-9+/]+={0,2}$/.test(value)&&Buffer.from(value,'base64').length===64;}catch{return false;}};
const iso=(value:string)=>{const parsed=Date.parse(value);return Number.isNaN(parsed)?null:new Date(parsed).toISOString();};

export const externalBackupEvidenceIssuerAddConfirmation=(fingerprintSha256:string)=>`KÖK GÜVENİNİ DOĞRULA ${fingerprintSha256.slice(0,16)}`;
export const externalBackupEvidenceIssuerRotateConfirmation=(id:string)=>`KANIT ANAHTARI DÖNDÜR ${id}`;
export const externalBackupEvidenceIssuerRevokeConfirmation=(id:string)=>`KANIT SAĞLAYICI İPTAL ${id}`;
export const externalBackupSignedEvidenceConfirmation=(copyId:string)=>`İMZALI İMHA KANITI ${copyId}`;

export interface ExternalBackupDestructionReceiptV1 {
  readonly schemaVersion:1;
  readonly type:'external-backup-destruction-receipt';
  readonly receiptId:string;
  readonly copyId:string;
  readonly issuerId:string;
  readonly issuedAt:string;
  readonly evidenceSha256:string;
  readonly statement:'destroyed';
}
export const canonicalExternalBackupDestructionReceipt=(receipt:ExternalBackupDestructionReceiptV1):string=>JSON.stringify({schemaVersion:1,type:'external-backup-destruction-receipt',receiptId:receipt.receiptId,copyId:receipt.copyId,issuerId:receipt.issuerId,issuedAt:receipt.issuedAt,evidenceSha256:receipt.evidenceSha256,statement:'destroyed'});

export interface ExternalBackupEvidenceKeyRotationReceiptV1 {
  readonly schemaVersion:1;
  readonly type:'external-backup-evidence-key-rotation';
  readonly receiptId:string;
  readonly predecessorIssuerId:string;
  readonly predecessorFingerprintSha256:string;
  readonly successorLabel:string;
  readonly successorFingerprintSha256:string;
  readonly effectiveAt:string;
  readonly statement:'authorize-successor-key';
}
export const canonicalExternalBackupEvidenceKeyRotation=(receipt:ExternalBackupEvidenceKeyRotationReceiptV1):string=>JSON.stringify({schemaVersion:1,type:'external-backup-evidence-key-rotation',receiptId:receipt.receiptId,predecessorIssuerId:receipt.predecessorIssuerId,predecessorFingerprintSha256:receipt.predecessorFingerprintSha256,successorLabel:receipt.successorLabel,successorFingerprintSha256:receipt.successorFingerprintSha256,effectiveAt:receipt.effectiveAt,statement:'authorize-successor-key'});


export interface ExternalBackupEvidenceRootTrustVerificationV1 {
  readonly schemaVersion:1;
  readonly type:'external-backup-evidence-root-trust-verification';
  readonly issuerLabel:string;
  readonly legalEntityName:string;
  readonly fingerprintSha256:string;
  readonly identityEvidenceReference:string;
  readonly keyFingerprintEvidenceReference:string;
  readonly witnessName:string;
  readonly witnessOrganization:string;
  readonly checkedAt:string;
  readonly statement:'out-of-band-dual-evidence-verified';
}
export const canonicalExternalBackupEvidenceRootTrustVerification=(receipt:ExternalBackupEvidenceRootTrustVerificationV1):string=>JSON.stringify({schemaVersion:1,type:'external-backup-evidence-root-trust-verification',issuerLabel:receipt.issuerLabel,legalEntityName:receipt.legalEntityName,fingerprintSha256:receipt.fingerprintSha256,identityEvidenceReference:receipt.identityEvidenceReference,keyFingerprintEvidenceReference:receipt.keyFingerprintEvidenceReference,witnessName:receipt.witnessName,witnessOrganization:receipt.witnessOrganization,checkedAt:receipt.checkedAt,statement:'out-of-band-dual-evidence-verified'});

export const externalBackupEvidenceIssuerTrustedAt=(issuer:ExternalBackupEvidenceIssuerView,at:string):boolean=>{
  const instant=Date.parse(at),validFrom=Date.parse(issuer.validFrom||issuer.addedAt),validUntil=issuer.validUntil?Date.parse(issuer.validUntil):Number.POSITIVE_INFINITY,revokedAt=issuer.revokedAt?Date.parse(issuer.revokedAt):Number.POSITIVE_INFINITY;
  return Number.isFinite(instant)&&Number.isFinite(validFrom)&&instant>=validFrom&&instant<validUntil&&instant<revokedAt;
};

export class ListExternalBackupEvidenceIssuersUseCase {
  constructor(private readonly query:ExternalBackupEvidenceQueryPort){}
  execute(context:ExternalBackupInventoryApplicationContext,limit=100){return requireAdmin(context,()=>this.query.listEvidenceIssuers(context,Math.max(1,Math.min(500,Math.trunc(limit)))));}
}
export class ListExternalBackupEvidenceIssuerRotationsUseCase {
  constructor(private readonly query:ExternalBackupEvidenceQueryPort){}
  execute(context:ExternalBackupInventoryApplicationContext,limit=100){return requireAdmin(context,()=>this.query.listEvidenceIssuerRotations(context,Math.max(1,Math.min(500,Math.trunc(limit)))));}
}
export class ListExternalBackupDestructionEvidenceUseCase {
  constructor(private readonly query:ExternalBackupEvidenceQueryPort){}
  execute(context:ExternalBackupInventoryApplicationContext,copyId:string|undefined,limit=100){return requireAdmin(context,()=>this.query.listDestructionEvidence(context,copyId?.trim()||undefined,Math.max(1,Math.min(500,Math.trunc(limit)))));}
}
export class RegisterExternalBackupEvidenceIssuerUseCase {
  constructor(private readonly query:ExternalBackupEvidenceQueryPort,private readonly write:ExternalBackupEvidenceWritePort,private readonly crypto:ExternalBackupEvidenceCryptoPort,private readonly strongAuth:StrongAuthenticationPort){}
  execute(context:ExternalBackupInventoryApplicationContext,input:RegisterExternalBackupEvidenceIssuerInput,issuerId:string,addedAt:string):Result<ExternalBackupEvidenceIssuerView,AppError>{
    return requireAdmin(context,()=>{
      const label=input.label.trim(),legalEntityName=input.legalEntityName.trim(),identityEvidenceReference=input.identityEvidenceReference.trim(),keyFingerprintEvidenceReference=input.keyFingerprintEvidenceReference.trim(),verificationWitnessName=input.verificationWitnessName.trim(),verificationWitnessOrganization=input.verificationWitnessOrganization.trim();
      if(label.length<3||label.length>160)return err(invalid(context,'Kanıt sağlayıcı adı 3 ile 160 karakter arasında olmalıdır.'));
      if(legalEntityName.length<3||legalEntityName.length>200)return err(invalid(context,'Sağlayıcının resmî tüzel kişi adı 3 ile 200 karakter arasında olmalıdır.'));
      if(identityEvidenceReference.length<12||identityEvidenceReference.length>500||keyFingerprintEvidenceReference.length<12||keyFingerprintEvidenceReference.length>500)return err(invalid(context,'Kimlik ve anahtar parmak izi için iki bağımsız kanıt referansı ayrı ayrı 12 ile 500 karakter arasında olmalıdır.'));
      if(identityEvidenceReference.toLocaleLowerCase('tr-TR')===keyFingerprintEvidenceReference.toLocaleLowerCase('tr-TR'))return err(invalid(context,'Kurum kimliği ve anahtar parmak izi aynı kanıt kanalına dayandırılamaz.'));
      if(verificationWitnessName.length<3||verificationWitnessName.length>160||verificationWitnessOrganization.length<3||verificationWitnessOrganization.length>200)return err(invalid(context,'Bağımsız tanık adı ve kurumu zorunludur.'));
      const checkedAt=iso(input.verificationCheckedAt),addedAtIso=iso(addedAt);if(!checkedAt||!addedAtIso)return err(invalid(context,'Doğrulama zamanı geçersizdir.'));
      if(Date.parse(checkedAt)>Date.parse(addedAtIso)+300_000||Date.parse(checkedAt)<Date.parse(addedAtIso)-30*86_400_000)return err(invalid(context,'Kurum dışı doğrulama son 30 gün içinde yapılmış olmalı ve gelecek zamanda olamaz.'));
      if(!input.publicKeyPem.trim()||input.publicKeyPem.length>20_000)return err(invalid(context,'Ed25519 açık anahtarı eksik veya izin verilen boyutu aşıyor.'));
      const inspected=this.crypto.inspectEd25519PublicKey(input.publicKeyPem);if(!inspected.ok)return err(invalid(context,inspected.error));
      const expectedFingerprint=input.expectedFingerprintSha256.trim().toLowerCase();if(!validSha256(expectedFingerprint)||expectedFingerprint!==inspected.value.fingerprintSha256)return err(invalid(context,'Bağımsız kanaldan alınan SHA-256 parmak izi, eklenen Ed25519 anahtarıyla birebir eşleşmelidir.'));
      if(input.confirmation!==externalBackupEvidenceIssuerAddConfirmation(expectedFingerprint))return err(invalid(context,`Kök güveni eklemek için tam olarak “${externalBackupEvidenceIssuerAddConfirmation(expectedFingerprint)}” yazılmalıdır.`));
      const duplicate=this.query.findEvidenceIssuerByFingerprint(context,inspected.value.fingerprintSha256);if(!duplicate.ok)return duplicate;if(duplicate.value)return err(conflict(context,'Bu Ed25519 açık anahtarı daha önce güven zincirine eklenmiş.'));
      const receipt:ExternalBackupEvidenceRootTrustVerificationV1={schemaVersion:1,type:'external-backup-evidence-root-trust-verification',issuerLabel:label,legalEntityName,fingerprintSha256:inspected.value.fingerprintSha256,identityEvidenceReference,keyFingerprintEvidenceReference,witnessName:verificationWitnessName,witnessOrganization:verificationWitnessOrganization,checkedAt,statement:'out-of-band-dual-evidence-verified'};
      const verificationReceiptSha256=this.crypto.sha256Utf8(canonicalExternalBackupEvidenceRootTrustVerification(receipt));
      const verified=this.strongAuth.verify(context,{password:input.password,...(input.code?{code:input.code}:{})});if(!verified.ok)return verified;
      return this.write.insertEvidenceIssuer(context,{id:issuerId,label,algorithm:'ed25519',publicKeyPem:inspected.value.normalizedPublicKeyPem,fingerprintSha256:inspected.value.fingerprintSha256,status:'trusted',validFrom:addedAtIso,rotationSequence:0,verificationMethod:'out_of_band_dual_evidence',legalEntityName,identityEvidenceReference,keyFingerprintEvidenceReference,verificationWitnessName,verificationWitnessOrganization,verificationCheckedAt:checkedAt,verificationReceiptSha256,addedBy:context.actor.userId,addedAt:addedAtIso,updatedAt:addedAtIso});
    });
  }
}
export class RotateExternalBackupEvidenceIssuerUseCase {
  constructor(private readonly query:ExternalBackupEvidenceQueryPort,private readonly write:ExternalBackupEvidenceWritePort,private readonly crypto:ExternalBackupEvidenceCryptoPort,private readonly strongAuth:StrongAuthenticationPort){}
  execute(context:ExternalBackupInventoryApplicationContext,input:RotateExternalBackupEvidenceIssuerInput,ids:{readonly successor:string;readonly rotation:string;readonly predecessorEvent:string;readonly successorEvent:string},verifiedAt:string):Result<{readonly predecessor:ExternalBackupEvidenceIssuerView;readonly successor:ExternalBackupEvidenceIssuerView;readonly rotation:ExternalBackupEvidenceIssuerRotationView},AppError>{
    return requireAdmin(context,()=>{
      const predecessorId=input.predecessorIssuerId.trim(),label=input.label.trim(),receiptId=input.receiptId.trim(),signatureBase64=input.signatureBase64.trim();
      if(input.confirmation!==externalBackupEvidenceIssuerRotateConfirmation(predecessorId))return err(invalid(context,`Anahtar döndürmek için tam olarak “${externalBackupEvidenceIssuerRotateConfirmation(predecessorId)}” yazılmalıdır.`));
      if(!validIdentifier(predecessorId)||!validIdentifier(receiptId))return err(invalid(context,'Önceki sağlayıcı veya döndürme makbuzu kimliği geçersizdir.'));
      if(label.length<3||label.length>160)return err(invalid(context,'Yeni sağlayıcı anahtar etiketi 3 ile 160 karakter arasında olmalıdır.'));
      if(!validSignature(signatureBase64))return err(invalid(context,'Anahtar döndürme imzası geçerli 64 bayt Base64 Ed25519 imzası olmalıdır.'));
      const effectiveAt=iso(input.effectiveAt),verifiedAtIso=iso(verifiedAt);if(!effectiveAt||!verifiedAtIso)return err(invalid(context,'Anahtar geçerlilik veya doğrulama zamanı geçersizdir.'));
      const effectiveMs=Date.parse(effectiveAt),verifiedMs=Date.parse(verifiedAtIso);if(effectiveMs<verifiedMs-300_000||effectiveMs>verifiedMs+30*86_400_000)return err(invalid(context,'Yeni anahtar başlangıcı doğrulama zamanından en fazla beş dakika önce veya otuz gün sonra olabilir.'));
      const predecessor=this.query.findEvidenceIssuer(context,predecessorId);if(!predecessor.ok)return predecessor;if(!predecessor.value)return err(missing(context,'Döndürülecek sağlayıcı anahtarı bulunamadı.'));
      if(predecessor.value.status!=='trusted'||predecessor.value.validUntil)return err(conflict(context,'Anahtar iptal edilmiş veya daha önce bir ardıl anahtara döndürülmüş.'));
      if(!externalBackupEvidenceIssuerTrustedAt(predecessor.value,verifiedAtIso))return err(conflict(context,'Önceki anahtar doğrulama tarihinde etkin güven aralığında değildir.'));
      if(effectiveMs<=Date.parse(predecessor.value.validFrom))return err(invalid(context,'Ardıl anahtar başlangıcı önceki anahtar başlangıcından sonra olmalıdır.'));
      const inspected=this.crypto.inspectEd25519PublicKey(input.publicKeyPem);if(!inspected.ok)return err(invalid(context,inspected.error));
      if(inspected.value.fingerprintSha256===predecessor.value.fingerprintSha256)return err(conflict(context,'Ardıl anahtar önceki anahtarla aynı olamaz.'));
      const duplicateKey=this.query.findEvidenceIssuerByFingerprint(context,inspected.value.fingerprintSha256);if(!duplicateKey.ok)return duplicateKey;if(duplicateKey.value)return err(conflict(context,'Ardıl Ed25519 anahtarı güven zincirinde zaten kayıtlıdır.'));
      const duplicateReceipt=this.query.findEvidenceIssuerRotationByReceipt(context,predecessorId,receiptId);if(!duplicateReceipt.ok)return duplicateReceipt;if(duplicateReceipt.value)return err(conflict(context,'Bu döndürme makbuzu daha önce kullanılmıştır.'));
      const receipt:ExternalBackupEvidenceKeyRotationReceiptV1={schemaVersion:1,type:'external-backup-evidence-key-rotation',receiptId,predecessorIssuerId:predecessorId,predecessorFingerprintSha256:predecessor.value.fingerprintSha256,successorLabel:label,successorFingerprintSha256:inspected.value.fingerprintSha256,effectiveAt,statement:'authorize-successor-key'};
      const canonicalPayloadJson=canonicalExternalBackupEvidenceKeyRotation(receipt);
      const verified=this.strongAuth.verify(context,{password:input.password,...(input.code?{code:input.code}:{})});if(!verified.ok)return verified;
      const signature=this.crypto.verifyEd25519Signature({publicKeyPem:predecessor.value.publicKeyPem,payload:canonicalPayloadJson,signatureBase64});if(!signature.ok)return err(invalid(context,signature.error));if(!signature.value)return err(invalid(context,'Anahtar döndürme makbuzu önceki güvenilen anahtar tarafından imzalanmamış.'));
      const rotated=this.write.rotateEvidenceIssuer(context,{expectedPredecessorUpdatedAt:predecessor.value.updatedAt,successor:{id:ids.successor,label,algorithm:'ed25519',publicKeyPem:inspected.value.normalizedPublicKeyPem,fingerprintSha256:inspected.value.fingerprintSha256,status:'trusted',validFrom:effectiveAt,predecessorIssuerId:predecessorId,rotationSequence:predecessor.value.rotationSequence+1,rotationReceiptId:receiptId,rotationVerifiedAt:verifiedAtIso,verificationMethod:'rotation_inherited',legalEntityName:predecessor.value.legalEntityName??predecessor.value.label,verificationCheckedAt:verifiedAtIso,verificationReceiptSha256:this.crypto.sha256Utf8(canonicalPayloadJson),addedBy:context.actor.userId,addedAt:verifiedAtIso,updatedAt:verifiedAtIso},rotation:{id:ids.rotation,predecessorIssuerId:predecessorId,successorIssuerId:ids.successor,receiptId,schemaVersion:1,successorFingerprintSha256:inspected.value.fingerprintSha256,effectiveAt,signatureBase64,canonicalPayloadJson,verifiedAt:verifiedAtIso,createdBy:context.actor.userId,createdAt:verifiedAtIso},eventIds:{predecessor:ids.predecessorEvent,successor:ids.successorEvent}});
      if(!rotated.ok)return rotated;return rotated.value?ok(rotated.value):err(conflict(context,'Önceki anahtar eşzamanlı değişti; döndürme uygulanmadı.'));
    });
  }
}
export class RevokeExternalBackupEvidenceIssuerUseCase {
  constructor(private readonly query:ExternalBackupEvidenceQueryPort,private readonly write:ExternalBackupEvidenceWritePort,private readonly strongAuth:StrongAuthenticationPort){}
  execute(context:ExternalBackupInventoryApplicationContext,input:RevokeExternalBackupEvidenceIssuerInput,revokedAt:string):Result<ExternalBackupEvidenceIssuerView,AppError>{
    return requireAdmin(context,()=>{
      if(input.confirmation!==externalBackupEvidenceIssuerRevokeConfirmation(input.id))return err(invalid(context,`Sağlayıcı iptali için tam olarak “${externalBackupEvidenceIssuerRevokeConfirmation(input.id)}” yazılmalıdır.`));
      const reason=input.reason.trim();if(reason.length<12||reason.length>1000)return err(invalid(context,'İptal gerekçesi 12 ile 1000 karakter arasında olmalıdır.'));
      const current=this.query.findEvidenceIssuer(context,input.id);if(!current.ok)return current;if(!current.value)return err(missing(context,'Kanıt sağlayıcı bulunamadı.'));
      if(current.value.status==='revoked')return err(conflict(context,'Kanıt sağlayıcı daha önce iptal edilmiş.'));
      const verified=this.strongAuth.verify(context,{password:input.password,...(input.code?{code:input.code}:{})});if(!verified.ok)return verified;
      const updated=this.write.revokeEvidenceIssuer(context,{id:input.id,expectedUpdatedAt:current.value.updatedAt,reason,revokedBy:context.actor.userId,revokedAt});if(!updated.ok)return updated;return updated.value?ok(updated.value):err(conflict(context,'Sağlayıcı kaydı eşzamanlı değişti; iptal uygulanmadı.'));
    });
  }
}
export class VerifyExternalBackupDestructionEvidenceUseCase {
  constructor(private readonly query:ExternalBackupEvidenceQueryPort,private readonly write:ExternalBackupEvidenceWritePort,private readonly crypto:ExternalBackupEvidenceCryptoPort,private readonly strongAuth:StrongAuthenticationPort){}
  execute(context:ExternalBackupInventoryApplicationContext,input:VerifyExternalBackupDestructionEvidenceInput,evidenceId:string,verifiedAt:string):Result<{readonly copy:ExternalBackupCopyView;readonly evidence:ExternalBackupDestructionEvidenceView},AppError>{
    return requireAdmin(context,()=>{
      const copyId=input.copyId.trim(),issuerId=input.issuerId.trim(),receiptId=input.receiptId.trim();
      if(input.confirmation!==externalBackupSignedEvidenceConfirmation(copyId))return err(invalid(context,`İmzalı kanıt doğrulaması için tam olarak “${externalBackupSignedEvidenceConfirmation(copyId)}” yazılmalıdır.`));
      if(!validIdentifier(copyId)||!validIdentifier(issuerId)||!validIdentifier(receiptId))return err(invalid(context,'Kopya, sağlayıcı veya makbuz kimliği geçersizdir.'));
      const evidenceSha256=input.evidenceSha256.trim().toLowerCase();if(!validSha256(evidenceSha256))return err(invalid(context,'Kanıt SHA-256 değeri 64 küçük onaltılık karakter olmalıdır.'));
      const signatureBase64=input.signatureBase64.trim();if(!validSignature(signatureBase64))return err(invalid(context,'Ed25519 imzası geçerli 64 bayt Base64 biçiminde olmalıdır.'));
      const issuedAt=iso(input.issuedAt),verifiedAtIso=iso(verifiedAt);if(!issuedAt||!verifiedAtIso)return err(invalid(context,'Makbuz veya doğrulama zamanı geçersizdir.'));
      if(Date.parse(issuedAt)>Date.parse(verifiedAtIso)+300_000)return err(invalid(context,'Makbuz zamanı doğrulama zamanından beş dakikadan fazla ileride olamaz.'));
      const copy=this.query.findCopy(context,copyId);if(!copy.ok)return copy;if(!copy.value)return err(missing(context,'Uygulama dışı yedek kopya bulunamadı.'));
      if(copy.value.legalHold)return err(conflict(context,'Hukuki veya koruma bekletmesi bulunan kopyaya imha kanıtı uygulanamaz.'));
      if(Date.parse(issuedAt)<Date.parse(copy.value.createdAt))return err(invalid(context,'İmha makbuzu kopya envantere kaydedilmeden önce düzenlenmiş olamaz.'));
      const issuer=this.query.findEvidenceIssuer(context,issuerId);if(!issuer.ok)return issuer;if(!issuer.value)return err(missing(context,'Kanıt sağlayıcı bulunamadı.'));
      if(!externalBackupEvidenceIssuerTrustedAt(issuer.value,issuedAt))return err(conflict(context,'Makbuz düzenlenme tarihinde sağlayıcı anahtarı geçerli güven aralığında değildir.'));
      const duplicate=this.query.findDestructionEvidenceByReceipt(context,issuerId,receiptId);if(!duplicate.ok)return duplicate;if(duplicate.value)return err(conflict(context,'Bu sağlayıcı ve makbuz kimliği daha önce kullanılmış.'));
      const verified=this.strongAuth.verify(context,{password:input.password,...(input.code?{code:input.code}:{})});if(!verified.ok)return verified;
      const receipt:ExternalBackupDestructionReceiptV1={schemaVersion:1,type:'external-backup-destruction-receipt',receiptId,copyId,issuerId,issuedAt,evidenceSha256,statement:'destroyed'};
      const canonicalPayloadJson=canonicalExternalBackupDestructionReceipt(receipt);
      const signature=this.crypto.verifyEd25519Signature({publicKeyPem:issuer.value.publicKeyPem,payload:canonicalPayloadJson,signatureBase64});if(!signature.ok)return err(invalid(context,signature.error));if(!signature.value)return err(invalid(context,'İmha makbuzu imzası makbuz tarihinde güvenilen sağlayıcı anahtarıyla doğrulanamadı.'));
      const inserted=this.write.insertVerifiedDestructionEvidence(context,{expectedCopyUpdatedAt:copy.value.updatedAt,evidence:{id:evidenceId,copyId,issuerId,receiptId,schemaVersion:1,evidenceSha256,signatureBase64,canonicalPayloadJson,issuedAt,verificationStatus:'verified',verifiedAt:verifiedAtIso,createdBy:context.actor.userId,createdAt:verifiedAtIso,updatedAt:verifiedAtIso}});
      if(!inserted.ok)return inserted;return inserted.value?ok(inserted.value):err(conflict(context,'Kopya veya sağlayıcı güven aralığı eşzamanlı değişti; imzalı kanıt uygulanmadı.'));
    });
  }
}
