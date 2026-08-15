import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  canonicalizeSignedPluginManifest,
  verifySignedPluginManifest,
  type SignedPluginManifest,
  type SignedPluginManifestEnvelope
} from '../src/signed-plugin-manifest.js';

const now=new Date('2026-08-15T12:00:00.000Z');
const pair=generateKeyPairSync('ed25519');
const keyId='plugin-root-2026';
const manifest=():SignedPluginManifest=>({
  pluginId:'bank-read-adapter',displayName:'Banka Salt Okunur Adapteri',version:'1.0.0',minimumHostVersion:'4.8.2026',
  sourceCommitId:'1'.repeat(40),packageSha256:'1'.repeat(64),entrypointSha256:'2'.repeat(64),sbomSha256:'3'.repeat(64),
  licenseInventorySha256:'4'.repeat(64),provenanceSha256:'5'.repeat(64),providerKinds:['bank'],capabilityCodes:['bank.read'],
  dataDeclarations:[{resourceType:'finance_record',sensitivity:'highly_sensitive',purpose:'finance',access:'read_metadata',retentionDays:0}],
  egress:{mode:'allowlist',hosts:['api.example.com']},sandbox:{profile:'isolated_child_process',filesystemAccess:'none',
    processSpawnAllowed:false,nativeModulesAllowed:false,networkBrokerOnly:true},issuedAt:'2026-08-15T11:00:00.000Z',
  expiresAt:'2026-08-20T11:00:00.000Z'
});
const envelope=(value=manifest()):SignedPluginManifestEnvelope=>({format:'ppt-signed-plugin-manifest',version:1,manifest:value,
  signature:{algorithm:'Ed25519',keyId,valueBase64Url:sign(null,Buffer.from(canonicalizeSignedPluginManifest(value),'utf8'),pair.privateKey).toString('base64url')}});
const options={trustedKeys:[{keyId,publicKeyPem:pair.publicKey.export({type:'spki',format:'pem'}).toString(),status:'ACTIVE' as const}],now:()=>now};

describe('33-Z signed plugin manifest verification',()=>{
  it('verifies exact Ed25519 evidence and returns only bounded metadata',()=>{
    const result=verifySignedPluginManifest(envelope(),options);
    expect(result).toMatchObject({pluginId:'bank-read-adapter',version:'1.0.0',signatureVerified:true,egressMode:'allowlist',
      sandboxProfile:'isolated_child_process',processSpawnAllowed:false,nativeModulesAllowed:false,networkBrokerOnly:true});
    expect(result.manifestSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(result)).not.toContain('PRIVATE KEY');
  });

  it('rejects payload tampering and non-canonical signatures',()=>{
    const value=envelope();
    const tampered={...value,manifest:{...value.manifest,displayName:'Değiştirilmiş'}};
    expect(()=>verifySignedPluginManifest(tampered,options)).toThrowError(/signature verification failed/iu);
    const padded={...value,signature:{...value.signature,valueBase64Url:`${value.signature.valueBase64Url}=`}};
    expect(()=>verifySignedPluginManifest(padded,options)).toThrow();
  });

  it('rejects wildcard, private, scheme and path shaped egress hosts',()=>{
    for(const host of ['*.example.com','127.0.0.1','https://api.example.com','api.example.com/path','service.local']){
      const changed={...manifest(),egress:{mode:'allowlist' as const,hosts:[host]}};
      expect(()=>verifySignedPluginManifest(envelope(changed),options)).toThrowError(/egress|allowlist/iu);
    }
  });

  it('rejects missing minimum capability and excessive retention',()=>{
    const noCapability={...manifest(),capabilityCodes:['maps.read' as const]};
    expect(()=>verifySignedPluginManifest(envelope(noCapability),options)).toThrowError(/explicit capability/iu);
    const retention={...manifest(),dataDeclarations:[{...manifest().dataDeclarations[0]!,retentionDays:31}]};
    expect(()=>verifySignedPluginManifest(envelope(retention),options)).toThrowError(/retention/iu);
  });

  it('rejects expired evidence, future evidence and untrusted signer',()=>{
    const expired={...manifest(),issuedAt:'2026-07-01T00:00:00.000Z',expiresAt:'2026-07-10T00:00:00.000Z'};
    expect(()=>verifySignedPluginManifest(envelope(expired),options)).toThrowError(/expired|time window/iu);
    const future={...manifest(),issuedAt:'2026-08-15T13:00:00.000Z',expiresAt:'2026-08-16T13:00:00.000Z'};
    expect(()=>verifySignedPluginManifest(envelope(future),options)).toThrowError(/time window/iu);
    expect(()=>verifySignedPluginManifest(envelope(),{...options,trustedKeys:[]})).toThrowError(/not uniquely trusted/iu);
  });

  it('rejects extra envelope and manifest keys fail-closed',()=>{
    expect(()=>verifySignedPluginManifest({...envelope(),destinationPath:'C:/plugins'},options)).toThrowError(/malformed/iu);
    const value=envelope();
    expect(()=>verifySignedPluginManifest({...value,manifest:{...value.manifest,token:'secret'}},options)).toThrowError(/keys are not exact/iu);
  });
});
