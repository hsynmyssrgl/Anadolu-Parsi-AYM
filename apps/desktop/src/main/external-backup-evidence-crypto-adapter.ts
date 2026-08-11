import { createHash, createPublicKey, verify } from 'node:crypto';
import { err, ok, type Result } from '@ppt/core';
import type { ExternalBackupEvidenceCryptoPort } from '@ppt/application';

export class NodeExternalBackupEvidenceCryptoAdapter implements ExternalBackupEvidenceCryptoPort {
  sha256Utf8(value:string):string{return createHash('sha256').update(value,'utf8').digest('hex');}
  inspectEd25519PublicKey(publicKeyPem:string):Result<{readonly normalizedPublicKeyPem:string;readonly fingerprintSha256:string},string>{
    try{
      if(/PRIVATE KEY/.test(publicKeyPem))return err('Özel anahtar kabul edilmez; yalnız Ed25519 PUBLIC KEY PEM kullanılabilir.');
      const key=createPublicKey(publicKeyPem);
      if(key.type!=='public'||key.asymmetricKeyType!=='ed25519')return err('Anahtar Ed25519 açık anahtarı değildir.');
      const der=key.export({type:'spki',format:'der'});
      const normalizedPublicKeyPem=key.export({type:'spki',format:'pem'}).toString();
      return ok({normalizedPublicKeyPem,fingerprintSha256:createHash('sha256').update(der).digest('hex')});
    }catch{return err('Ed25519 açık anahtarı çözümlenemedi. PEM biçimini ve anahtar içeriğini doğrulayın.');}
  }
  verifyEd25519Signature(input:{readonly publicKeyPem:string;readonly payload:string;readonly signatureBase64:string}):Result<boolean,string>{
    try{
      const key=createPublicKey(input.publicKeyPem);
      if(key.type!=='public'||key.asymmetricKeyType!=='ed25519')return err('Güvenilen sağlayıcı anahtarı Ed25519 değildir.');
      const signature=Buffer.from(input.signatureBase64,'base64');
      if(signature.length!==64)return err('Ed25519 imzası 64 bayt olmalıdır.');
      return ok(verify(null,Buffer.from(input.payload,'utf8'),key,signature));
    }catch{return err('İmza doğrulama işlemi güvenli biçimde tamamlanamadı.');}
  }
}
