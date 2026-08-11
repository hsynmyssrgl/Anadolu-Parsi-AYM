import { createHash } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import type { BackupQuarantineDestructionFilePort } from '@ppt/application';
import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId
} from '@ppt/core';

interface QuarantineManifestArtifact {
  readonly quarantinedName:string;
  readonly sha256:string;
  readonly sizeBytes:number;
}
interface QuarantineManifest {
  readonly schemaVersion:number;
  readonly batchId:string;
  readonly artifacts:readonly QuarantineManifestArtifact[];
}
interface DestructionState {
  readonly schemaVersion:1;
  readonly batchId:string;
  readonly destroyedAt:string;
  readonly artifacts:readonly {readonly name:string;readonly sizeBytes:number}[];
  readonly totalBytes:number;
}
interface DestructionReceipt {
  readonly schemaVersion:1;
  readonly batchId:string;
  readonly destroyedAt:string;
  readonly destroyedArtifacts:number;
  readonly destroyedBytes:number;
}

const isWithin=(baseDirectory:string,candidatePath:string):boolean=>{
  const value=relative(baseDirectory,candidatePath);
  return value===''||(!value.startsWith('..')&&!isAbsolute(value));
};
const writeDurableJson=(filePath:string,value:unknown):void=>{
  mkdirSync(dirname(filePath),{recursive:true,mode:0o700});
  const temporaryPath=`${filePath}.tmp`;
  const descriptor=openSync(temporaryPath,'w',0o600);
  try{writeFileSync(descriptor,`${JSON.stringify(value,null,2)}\n`,'utf8');fsyncSync(descriptor);}finally{closeSync(descriptor);}
  renameSync(temporaryPath,filePath);
  try{chmodSync(filePath,0o600);}catch{}
};
const parseJson=<T>(path:string):T=>JSON.parse(readFileSync(path,'utf8')) as T;
const sha256File=(path:string):string=>createHash('sha256').update(readFileSync(path)).digest('hex');
const overwriteAndDelete=(path:string):void=>{
  if(!existsSync(path))return;
  const size=statSync(path).size;
  const descriptor=openSync(path,'r+');
  try{
    const chunk=Buffer.alloc(Math.min(1024*1024,Math.max(1,size)),0);
    let offset=0;
    while(offset<size){const length=Math.min(chunk.length,size-offset);writeSync(descriptor,chunk,0,length,offset);offset+=length;}
    fsyncSync(descriptor);
  }finally{closeSync(descriptor);}
  unlinkSync(path);
};

export class FileSystemBackupQuarantineDestructionPort implements BackupQuarantineDestructionFilePort {
  destroy(input:Parameters<BackupQuarantineDestructionFilePort['destroy']>[0],correlationId:CorrelationId):ReturnType<BackupQuarantineDestructionFilePort['destroy']>{
    const originalDirectory=resolve(input.quarantineDirectory);
    const originalManifest=resolve(input.manifestPath);
    const quarantineRoot=dirname(originalDirectory);
    const targetRoot=dirname(quarantineRoot);
    const directoryBatchId=basename(originalDirectory);
    if(basename(quarantineRoot)!=='.purge-quarantine'||!isWithin(targetRoot,originalDirectory)||!isWithin(originalDirectory,originalManifest)||basename(originalManifest)!=='manifest.json'){
      return err(this.#error(correlationId,'Yedek karantina dizini güvenli hedef sınırında değil.','path boundary'));
    }
    if(!input.batchId.trim()||Number.isNaN(Date.parse(input.destroyedAt))){return err(this.#error(correlationId,'Yedek karantina imha girdisi geçersiz.','invalid input'));}
    const destroyingDirectory=join(quarantineRoot,`.destroying-${directoryBatchId}`);
    const receiptDirectory=join(targetRoot,'.purge-destruction-receipts');
    const receiptPath=join(receiptDirectory,`${input.batchId}.json`);
    try{
      if(existsSync(receiptPath)){
        const receipt=parseJson<DestructionReceipt>(receiptPath);
        if(receipt.schemaVersion!==1||receipt.batchId!==input.batchId)throw new Error('Karantina imha makbuzu geçersiz.');
        return ok({destroyedArtifacts:receipt.destroyedArtifacts,destroyedBytes:receipt.destroyedBytes,resumed:true,receiptPath});
      }
      let resumed=false;
      if(existsSync(originalDirectory)){
        if(existsSync(destroyingDirectory))throw new Error('Aynı karantina için iki aktif imha dizini bulundu.');
        const manifest=parseJson<QuarantineManifest>(originalManifest);
        this.#validateManifest(manifest,directoryBatchId,originalDirectory);
        renameSync(originalDirectory,destroyingDirectory);
        resumed=false;
      }else if(existsSync(destroyingDirectory)){
        resumed=true;
      }else{
        throw new Error('Karantina dizini veya devam ettirilebilir imha işlemi bulunamadı.');
      }
      try{chmodSync(destroyingDirectory,0o700);}catch{}
      const statePath=join(destroyingDirectory,'destruction-state.json');
      let state:DestructionState;
      if(existsSync(statePath)){
        state=parseJson<DestructionState>(statePath);
        if(state.schemaVersion!==1||state.batchId!==input.batchId)throw new Error('Karantina imha durum kaydı geçersiz.');
      }else{
        const manifestPath=join(destroyingDirectory,'manifest.json');
        const manifest=parseJson<QuarantineManifest>(manifestPath);
        this.#validateManifest(manifest,directoryBatchId,destroyingDirectory);
        const artifacts=manifest.artifacts.map(item=>({name:item.quarantinedName,sizeBytes:item.sizeBytes}));
        state={schemaVersion:1,batchId:input.batchId,destroyedAt:input.destroyedAt,artifacts,totalBytes:artifacts.reduce((sum,item)=>sum+item.sizeBytes,0)};
        writeDurableJson(statePath,state);
      }
      for(const artifact of state.artifacts){
        if(basename(artifact.name)!==artifact.name)throw new Error('İmha durumunda güvenli olmayan dosya adı bulundu.');
        overwriteAndDelete(join(destroyingDirectory,artifact.name));
      }
      overwriteAndDelete(join(destroyingDirectory,'manifest.json'));
      overwriteAndDelete(statePath);
      rmdirSync(destroyingDirectory);
      writeDurableJson(receiptPath,{schemaVersion:1,batchId:input.batchId,destroyedAt:input.destroyedAt,destroyedArtifacts:state.artifacts.length,destroyedBytes:state.totalBytes} satisfies DestructionReceipt);
      try{chmodSync(receiptDirectory,0o700);}catch{}
      return ok({destroyedArtifacts:state.artifacts.length,destroyedBytes:state.totalBytes,resumed,receiptPath});
    }catch(error){return err(this.#error(correlationId,'Yedek karantinası güvenli biçimde imha edilemedi.',error));}
  }

  #validateManifest(manifest:QuarantineManifest,directoryBatchId:string,directory:string):void{
    if(manifest.schemaVersion!==1||manifest.batchId!==directoryBatchId||!Array.isArray(manifest.artifacts)||manifest.artifacts.length===0)throw new Error('Karantina manifesti geçersiz.');
    for(const artifact of manifest.artifacts){
      if(basename(artifact.quarantinedName)!==artifact.quarantinedName||!artifact.quarantinedName.endsWith('.quarantined'))throw new Error('Karantina manifestinde güvenli olmayan dosya adı bulundu.');
      if(!/^[a-f0-9]{64}$/.test(artifact.sha256)||!Number.isInteger(artifact.sizeBytes)||artifact.sizeBytes<0)throw new Error('Karantina manifesti dosya özeti geçersiz.');
      const filePath=join(directory,artifact.quarantinedName);
      if(!isWithin(directory,filePath)||!existsSync(filePath))throw new Error(`Karantina dosyası bulunamadı: ${artifact.quarantinedName}`);
      if(statSync(filePath).size!==artifact.sizeBytes||sha256File(filePath)!==artifact.sha256)throw new Error(`Karantina dosyası bütünlük doğrulamasından geçemedi: ${artifact.quarantinedName}`);
    }
  }

  #error(correlationId:CorrelationId,message:string,error:unknown):AppError{return createAppError({code:ERROR_CODES.CORE_UNEXPECTED,message,category:'infrastructure',correlationId,details:{cause:error instanceof Error?error.message:String(error)}});}
}
