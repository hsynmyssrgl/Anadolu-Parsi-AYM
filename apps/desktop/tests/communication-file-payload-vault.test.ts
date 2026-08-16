import { existsSync, linkSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { asCorrelationId, ok } from '@ppt/core';
import type { DeviceSecretProtector } from '../src/main/device-secret-protector.js';
import {
  CommunicationFilePayloadVault,
  WindowsDefenderCommunicationFileMalwareScanner,
  type CommunicationFileScannerProcessPort,
  type CommunicationFileMalwareScannerPort
} from '../src/main/communication-file-payload-vault.js';
import { ProtectedSideArtifactStore } from '../src/main/protected-side-artifact-store.js';

const directories:string[]=[];
afterEach(()=>{for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
const protector:DeviceSecretProtector=Object.freeze({protectionId:'test-communication-file-protector',
  isAvailable:()=>true,protect:(plaintext)=>Buffer.from(plaintext,'utf8').toString('base64url'),
  unprotect:(ciphertext)=>Buffer.from(ciphertext,'base64url').toString('utf8')});
const CORRELATION=asCorrelationId('communication-file-payload-vault-test');
const sha256=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const openVault=(malwareScanner?:CommunicationFileMalwareScannerPort)=>{const directory=mkdtempSync(join(tmpdir(),'ppt-34g-file-vault-'));
  directories.push(directory);const protectedStore=new ProtectedSideArtifactStore({keyPath:join(directory,'keys','files.key'),
    applicationVersion:'34-g-test',protector,now:()=> '2026-08-16T01:00:00.000Z'});
  return{directory,protectedStore,vault:new CommunicationFilePayloadVault({
    rootDirectory:join(directory,'payloads'),protectedStore,...(malwareScanner?{malwareScanner}:{})})};};
const seal=(vault:CommunicationFilePayloadVault,bytes=Buffer.from('family file body','utf8'))=>vault.seal({
  familyId:'family-34-g',ownerPersonId:'person-owner-34-g',fileId:'file-34-g',displayName:'Aile belgesi.txt',
  mimeType:'text/plain',bytes,occurredAt:'2026-08-16T01:00:00.000Z',correlationId:CORRELATION
});
const openPayload=(vault:CommunicationFilePayloadVault,result:{readonly sealedPayloadReference:string;
  readonly fullContentSha256:string;readonly providerEvidenceSha256:string},familyId='family-34-g')=>vault.open({
  reference:result.sealedPayloadReference,familyId,ownerPersonId:'person-owner-34-g',fileId:'file-34-g',
  displayName:'Aile belgesi.txt',mimeType:'text/plain',totalBytes:Buffer.byteLength('family file body','utf8'),
  fullContentSha256:result.fullContentSha256,providerEvidenceSha256:result.providerEvidenceSha256,
  correlationId:CORRELATION});

describe('34-G protected communication file payload vault',()=>{
  it('accepts only unchanged exit-zero Windows Defender scans as clean evidence',()=>{
    const directory=mkdtempSync(join(tmpdir(),'ppt-34g-defender-'));directories.push(directory);
    const executable=join(directory,'MpCmdRun.exe');writeFileSync(executable,'fake defender binary');
    const bytes=Buffer.from('defender benign communication payload','utf8');let observedPath='';
    const runner:CommunicationFileScannerProcessPort=Object.freeze({run:(_executable,args)=>{
      expect(args.slice(0,4)).toEqual(['-Scan','-ScanType','3','-File']);observedPath=String(args[4]);
      expect(readFileSync(observedPath)).toEqual(bytes);return Object.freeze({status:0,signal:null,
        stdout:Buffer.from('Scanning file found no threats.','utf8'),stderr:Buffer.alloc(0)});}});
    const scanner=new WindowsDefenderCommunicationFileMalwareScanner({scratchDirectory:join(directory,'scratch'),
      executablePath:executable,processRunner:runner});
    expect(scanner.scan({bytes,mimeType:'text/plain',fullContentSha256:sha256(bytes),correlationId:CORRELATION}))
      .toMatchObject({ok:true,value:{verdict:'clean',providerId:'microsoft-defender-mpcmdrun-v1'}});
    expect(observedPath).not.toBe('');expect(existsSync(observedPath)).toBe(false);
  });

  it('quarantines explicit Defender detections and fails closed on ambiguous errors or staging mutation',()=>{
    const directory=mkdtempSync(join(tmpdir(),'ppt-34g-defender-negative-'));directories.push(directory);
    const executable=join(directory,'MpCmdRun.exe');writeFileSync(executable,'fake defender binary');
    const bytes=Buffer.from('bounded communication payload','utf8');const input={bytes,mimeType:'application/octet-stream',
      fullContentSha256:sha256(bytes),correlationId:CORRELATION} as const;
    let scratchId=0;const scanner=(runner:CommunicationFileScannerProcessPort)=>new WindowsDefenderCommunicationFileMalwareScanner({
      scratchDirectory:join(directory,`scratch-${++scratchId}`),executablePath:executable,processRunner:runner});
    expect(scanner(Object.freeze({run:()=>Object.freeze({status:2,signal:null,
      stdout:Buffer.from('MpScan() has detected 1 threats.','utf8'),stderr:Buffer.alloc(0)})})).scan(input))
      .toMatchObject({ok:true,value:{verdict:'malicious'}});
    expect(scanner(Object.freeze({run:()=>Object.freeze({status:2,signal:null,
      stdout:Buffer.from('Scanning errors.','utf8'),stderr:Buffer.alloc(0)})})).scan(input)).toMatchObject({ok:false});
    expect(scanner(Object.freeze({run:(_path,args)=>{writeFileSync(String(args[4]),'changed');return Object.freeze({
      status:0,signal:null,stdout:Buffer.alloc(0),stderr:Buffer.alloc(0)});}})).scan(input)).toMatchObject({ok:false});
    const identityScanner=scanner(Object.freeze({run:()=>{writeFileSync(executable,'replaced defender binary');return Object.freeze({
      status:0,signal:null,stdout:Buffer.alloc(0),stderr:Buffer.alloc(0)});}}));
    expect(identityScanner.scan(input)).toMatchObject({ok:false});
  });

  it('encrypts the selected bytes and opens them only through exact main-authority metadata',()=>{
    const{directory,vault}=openVault();const result=seal(vault);expect(result.ok).toBe(true);if(!result.ok)return;
    const raw=readFileSync(join(directory,'payloads',result.value.sealedPayloadReference),'utf8');
    expect(raw).not.toContain('family file body');
    const opened=openPayload(vault,result.value);
    expect(opened.ok).toBe(true);if(opened.ok){expect(opened.value.toString('utf8')).toBe('family file body');opened.value.fill(0);}
  });

  it('returns provider_unavailable without inventing malware evidence and accepts bounded clean scanner evidence',()=>{
    const missing=seal(openVault().vault);expect(missing).toMatchObject({ok:true,value:{scanState:'provider_unavailable'}});
    if(missing.ok){expect(missing.value.scanProviderId).toBeUndefined();expect(missing.value.scanEvidenceSha256).toBeUndefined();}
    const scanner:CommunicationFileMalwareScannerPort=Object.freeze({scan:()=>ok(Object.freeze({
      verdict:'clean' as const,providerId:'local-malware-scanner',evidenceSha256:'d'.repeat(64)}))});
    const clean=seal(openVault(scanner).vault);expect(clean).toMatchObject({ok:true,value:{scanState:'clean',
      scanProviderId:'local-malware-scanner',scanEvidenceSha256:'d'.repeat(64)}});
  });

  it('rejects foreign identity bindings and encrypted-envelope tampering',()=>{
    const{directory,vault}=openVault();const result=seal(vault);if(!result.ok)throw new Error('fixture');
    expect(openPayload(vault,result.value,'family-foreign-34-g')).toMatchObject({ok:false});
    const path=join(directory,'payloads',result.value.sealedPayloadReference);const bytes=readFileSync(path);
    bytes[Math.floor(bytes.length/2)]^=1;writeFileSync(path,bytes);
    expect(openPayload(vault,result.value)).toMatchObject({ok:false});
  });

  it('reuses an exact crash-retry payload without overwrite and rejects conflicting metadata',()=>{
    const{directory,vault}=openVault();const first=seal(vault);if(!first.ok)throw new Error('fixture');
    const path=join(directory,'payloads',first.value.sealedPayloadReference);const before=readFileSync(path);
    expect(seal(vault)).toMatchObject({ok:true,value:{sealedPayloadReference:first.value.sealedPayloadReference,
      providerEvidenceSha256:first.value.providerEvidenceSha256}});
    expect(vault.seal({familyId:'family-34-g',ownerPersonId:'person-owner-34-g',fileId:'file-34-g',
      displayName:'Başka ad.txt',mimeType:'text/plain',bytes:Buffer.from('family file body','utf8'),
      occurredAt:'2026-08-16T01:00:01.000Z',correlationId:CORRELATION})).toMatchObject({ok:false});
    expect(readFileSync(path)).toEqual(before);
    const opened=openPayload(vault,first.value);
    expect(opened.ok).toBe(true);if(opened.ok){expect(opened.value.toString('utf8')).toBe('family file body');opened.value.fill(0);}
  });

  it('removes its newly published payload when encrypted readback fails',()=>{
    const{directory,protectedStore,vault}=openVault();
    vi.spyOn(protectedStore,'openEnvelope').mockImplementationOnce(()=>{throw new Error('readback failure');});
    expect(seal(vault)).toMatchObject({ok:false});
    expect(readdirSync(join(directory,'payloads'))).toEqual([]);
  });

  it('repairs both hard-link and temp-only interrupted publications on restart',()=>{
    const{directory,protectedStore,vault}=openVault();const result=seal(vault);if(!result.ok)throw new Error('fixture');
    const root=join(directory,'payloads');const target=join(root,result.value.sealedPayloadReference);
    const linkedTemporary=join(root,'.comm-file-400-a1b2c3d4e5f60718.tmp');linkSync(target,linkedTemporary);
    expect(lstatSync(target).nlink).toBe(2);
    const recovered=new CommunicationFilePayloadVault({rootDirectory:root,protectedStore});
    expect(existsSync(linkedTemporary)).toBe(false);expect(lstatSync(target).nlink).toBe(1);
    const tempOnly=join(root,'.comm-file-401-18273645aabbccdd.tmp');linkSync(target,tempOnly);rmSync(target);
    expect(existsSync(target)).toBe(false);
    const recoveredAgain=new CommunicationFilePayloadVault({rootDirectory:root,protectedStore});
    expect(existsSync(tempOnly)).toBe(false);expect(lstatSync(target).nlink).toBe(1);
    const opened=openPayload(recoveredAgain,result.value);
    expect(opened.ok).toBe(true);if(opened.ok)opened.value.fill(0);
    expect(recovered).toBeInstanceOf(CommunicationFilePayloadVault);
  });

  it('removes a safely unlinked partial publication but rejects unknown root entries',()=>{
    const{directory,protectedStore}=openVault();const root=join(directory,'payloads');
    const partial=join(root,'.comm-file-402-0011223344556677.tmp');writeFileSync(partial,'partial');
    expect(()=>new CommunicationFilePayloadVault({rootDirectory:root,protectedStore})).not.toThrow();
    expect(existsSync(partial)).toBe(false);writeFileSync(join(root,'foreign.bin'),'foreign');
    expect(()=>new CommunicationFilePayloadVault({rootDirectory:root,protectedStore})).toThrow();
  });

  it('sweeps only old unreferenced payloads for the exact owner and preserves young or foreign files',()=>{
    const{directory,vault}=openVault();const create=(familyId:string,ownerPersonId:string,fileId:string,occurredAt:string)=>vault.seal({
      familyId,ownerPersonId,fileId,displayName:`${fileId}.txt`,mimeType:'text/plain',
      bytes:Buffer.from(`payload:${fileId}`,'utf8'),occurredAt,correlationId:CORRELATION});
    const current=create('family-34-g','person-owner-34-g','file-current-34-g','2026-08-01T00:00:00.000Z');
    const orphan=create('family-34-g','person-owner-34-g','file-orphan-34-g','2026-08-01T00:00:00.000Z');
    const foreign=create('family-34-g','person-foreign-34-g','file-foreign-34-g','2026-08-01T00:00:00.000Z');
    const young=create('family-34-g','person-owner-34-g','file-young-34-g','2026-08-16T00:00:00.000Z');
    if(!current.ok||!orphan.ok||!foreign.ok||!young.ok)throw new Error('fixture');
    const swept=vault.sweepOrphans({familyId:'family-34-g',ownerPersonId:'person-owner-34-g',
      referencedPayloads:[current.value.sealedPayloadReference],completedBefore:'2026-08-15T00:00:00.000Z',
      maximumCandidates:128,correlationId:CORRELATION});
    expect(swept).toMatchObject({ok:true,value:{scannedFiles:4,deletedFiles:1,rejectedFiles:0}});
    const root=join(directory,'payloads');expect(existsSync(join(root,current.value.sealedPayloadReference))).toBe(true);
    expect(existsSync(join(root,orphan.value.sealedPayloadReference))).toBe(false);
    expect(existsSync(join(root,foreign.value.sealedPayloadReference))).toBe(true);
    expect(existsSync(join(root,young.value.sealedPayloadReference))).toBe(true);
  });

  it('rejects hard-linked payloads and performs idempotent verified discard',()=>{
    const{directory,vault}=openVault();const result=seal(vault);if(!result.ok)throw new Error('fixture');
    const path=join(directory,'payloads',result.value.sealedPayloadReference);const alias=join(directory,'payloads','alias.pptshare');
    linkSync(path,alias);
    expect(openPayload(vault,result.value)).toMatchObject({ok:false});
    rmSync(alias);
    expect(vault.discard(result.value.sealedPayloadReference,CORRELATION)).toEqual({ok:true,value:undefined});
    expect(vault.discard(result.value.sealedPayloadReference,CORRELATION)).toEqual({ok:true,value:undefined});
  });
});
