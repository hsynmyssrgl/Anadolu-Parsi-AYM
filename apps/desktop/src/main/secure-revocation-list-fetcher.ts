import { createHash, X509Certificate } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import type { ApplyExternalBackupEvidenceRevocationListInput, FetchedExternalBackupEvidenceRevocationListView } from '@ppt/domain';

const MAX_RESPONSE_BYTES=1_048_576;
const DEFAULT_TIMEOUT_MS=10_000;
const MAX_REDIRECTS=2;

export interface SecureRevocationListFetchInput {
  readonly endpointId:string;
  readonly sourceUrl:string;
  readonly expectedPins:readonly {readonly sha256:string;readonly kind:'primary'|'secondary'}[];
  readonly timeoutMs?:number;
  readonly signal?:AbortSignal;
}
const normalizePin=(value:string)=>value.trim().toLowerCase().replace(/^sha256[:/]/,'');
const isPrivateIpv4=(ip:string)=>{const [a=0,b=0]=ip.split('.').map(Number);return a===10||a===127||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168);};
const isPrivateIp=(ip:string)=>isIP(ip)===4?isPrivateIpv4(ip):ip==='::1'||ip.startsWith('fc')||ip.startsWith('fd')||ip.startsWith('fe80:');
const assertPublicHost=async(hostname:string)=>{const records=await lookup(hostname,{all:true,verbatim:true});if(records.length===0)throw new Error('Kaynak alan adı çözümlenemedi.');if(records.some(record=>isPrivateIp(record.address)))throw new Error('Özel, yerel veya link-local ağ adreslerine erişim reddedildi.');};
const spkiSha256=(certificate:Buffer)=>{const cert=new X509Certificate(certificate);return createHash('sha256').update(cert.publicKey.export({type:'spki',format:'der'})).digest('hex');};

const parsePayload=(raw:string,sourceUrl:string):Omit<ApplyExternalBackupEvidenceRevocationListInput,'confirmation'|'password'|'code'>=>{
  const value=JSON.parse(raw) as Record<string,unknown>;
  if(value.schemaVersion!==1||value.type!=='external-backup-evidence-revocation-list')throw new Error('Kaynak beklenen iptal listesi şemasını taşımıyor.');
  if(!Array.isArray(value.entries))throw new Error('İptal listesi kayıt dizisi geçersiz.');
  return {
    signerIssuerId:String(value.signerIssuerId??''),listId:String(value.listId??''),sequenceNumber:Number(value.sequenceNumber),thisUpdate:String(value.thisUpdate??''),nextUpdate:String(value.nextUpdate??''),
    entries:value.entries.map(item=>{const row=item as Record<string,unknown>;return {fingerprintSha256:String(row.fingerprintSha256??''),revokedAt:String(row.revokedAt??''),reason:String(row.reason??'')};}),
    signatureBase64:String(value.signatureBase64??''),sourceUrl
  };
};

export const fetchExternalBackupEvidenceRevocationList=async(input:SecureRevocationListFetchInput):Promise<FetchedExternalBackupEvidenceRevocationListView>=>{
  if(input.signal?.aborted)throw input.signal.reason instanceof Error?input.signal.reason:new Error('İptal listesi isteği iptal edildi.');
  const expectedPins=input.expectedPins.map(item=>({sha256:normalizePin(item.sha256),kind:item.kind}));
  if(expectedPins.length<1||expectedPins.length>2||expectedPins.some(item=>!/^[a-f0-9]{64}$/.test(item.sha256)))throw new Error('HTTPS kaynak profilinde geçerli TLS SPKI pini bulunamadı.');
  if(new Set(expectedPins.map(item=>item.sha256)).size!==expectedPins.length)throw new Error('HTTPS kaynak profilindeki TLS SPKI pinleri benzersiz olmalıdır.');
  const timeoutMs=Math.max(1_000,Math.min(30_000,Math.trunc(input.timeoutMs??DEFAULT_TIMEOUT_MS)));
  let current=new URL(input.sourceUrl);const originalOrigin=current.origin;
  if(current.protocol!=='https:'||current.username||current.password||current.port&&current.port!=='443')throw new Error('Kaynak kimlik bilgisi içermeyen standart HTTPS adresi olmalıdır.');
  for(let redirect=0;redirect<=MAX_REDIRECTS;redirect+=1){
    await assertPublicHost(current.hostname);
    if(input.signal?.aborted)throw input.signal.reason instanceof Error?input.signal.reason:new Error('İptal listesi isteği iptal edildi.');
    const response=await new Promise<{status:number;headers:Record<string,string|string[]|undefined>;body:string;pin:string}>((resolve,reject)=>{
      const req=request(current,{method:'GET',headers:{accept:'application/json','user-agent':'Pardus-Aile/Build162'},timeout:timeoutMs,rejectUnauthorized:true,...(input.signal?{signal:input.signal}:{})},res=>{
        const socket=res.socket as typeof res.socket&{getPeerCertificate(raw:boolean):{raw?:Buffer}};const raw=socket.getPeerCertificate(true).raw;if(!raw){reject(new Error('TLS eş sertifikası alınamadı.'));return;}const pin=spkiSha256(raw);let size=0;const chunks:Buffer[]=[];
        res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>MAX_RESPONSE_BYTES){req.destroy(new Error('İptal listesi yanıtı 1 MiB sınırını aştı.'));return;}chunks.push(chunk);});
        res.on('end',()=>resolve({status:res.statusCode??0,headers:res.headers,body:Buffer.concat(chunks).toString('utf8'),pin}));
      });req.on('timeout',()=>req.destroy(new Error('İptal listesi HTTPS isteği zaman aşımına uğradı.')));req.on('error',reject);req.end();
    });
    const matched=expectedPins.find(item=>item.sha256===response.pin);if(!matched)throw new Error('TLS SPKI pini kayıtlı sağlayıcı kaynak profiliyle eşleşmedi.');
    if(response.status>=300&&response.status<400){const location=response.headers.location;if(typeof location!=='string')throw new Error('HTTPS yönlendirmesinde Location başlığı bulunamadı.');const next=new URL(location,current);if(next.origin!==originalOrigin)throw new Error('Farklı origin yönlendirmesi reddedildi.');current=next;continue;}
    if(response.status!==200)throw new Error(`İptal listesi kaynağı HTTP ${response.status} döndürdü.`);
    const contentType=String(response.headers['content-type']??'').toLowerCase();if(!contentType.includes('application/json'))throw new Error('İptal listesi yanıtı application/json içerik türünde olmalıdır.');
    const list=parsePayload(response.body,current.toString());
    return {endpointId:input.endpointId,list,fetchedAt:new Date().toISOString(),sourceUrl:current.toString(),tlsSpkiSha256:response.pin,matchedPin:matched.kind,responseBytes:Buffer.byteLength(response.body)};
  }
  throw new Error('İptal listesi yönlendirme sınırı aşıldı.');
};
