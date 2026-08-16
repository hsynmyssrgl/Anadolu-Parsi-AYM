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
  pluginId:'bank-read-adapter',displayName:'Banka Salt Okunur Adapteri',version:'1.0.0',minimumHostVersion:'4.8.2026-29',
  sourceCommitId:'1'.repeat(40),packageSha256:'1'.repeat(64),entrypointSha256:'2'.repeat(64),sbomSha256:'3'.repeat(64),
  licenseInventorySha256:'4'.repeat(64),provenanceSha256:'5'.repeat(64),providerKinds:['bank'],capabilityCodes:['bank.read'],
  dataDeclarations:[{resourceType:'finance_record',sensitivity:'highly_sensitive',purpose:'finance',access:'read_metadata',retentionDays:0}],
  egress:{mode:'allowlist',hosts:['api.example.com']},sandbox:{profile:'isolated_child_process',filesystemAccess:'none',
    processSpawnAllowed:false,nativeModulesAllowed:false,networkBrokerOnly:true},issuedAt:'2026-08-15T11:00:00.000Z',
  expiresAt:'2026-08-20T11:00:00.000Z'
});
const envelope=(value=manifest()):SignedPluginManifestEnvelope=>({format:'ppt-signed-plugin-manifest',version:1,manifest:value,
  signature:{algorithm:'Ed25519',keyId,valueBase64Url:sign(null,Buffer.from(canonicalizeSignedPluginManifest(value),'utf8'),pair.privateKey).toString('base64url')}});
const options={trustedKeys:[{keyId,publicKeyPem:pair.publicKey.export({type:'spki',format:'pem'}).toString(),status:'ACTIVE' as const}],
  hostVersion:'4.8.2026-29',now:()=>now};

describe('33-Z signed plugin manifest verification',()=>{
  it('verifies exact Ed25519 evidence and returns only bounded metadata',()=>{
    const result=verifySignedPluginManifest(envelope(),options);
    expect(result).toMatchObject({pluginId:'bank-read-adapter',version:'1.0.0',minimumHostVersion:'4.8.2026-29',
      signatureVerified:true,egressMode:'allowlist',
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

  it('rejects undeclared-provider capabilities, empty data scope and a newer required host',()=>{
    const undeclared={...manifest(),providerKinds:['bank' as const],capabilityCodes:['bank.read','maps.read'] as const};
    expect(()=>verifySignedPluginManifest(envelope(undeclared),options)).toThrowError(/declared provider/iu);
    const empty={...manifest(),dataDeclarations:[]};
    expect(()=>verifySignedPluginManifest(envelope(empty),options)).toThrowError(/declaration count/iu);
    const newer={...manifest(),minimumHostVersion:'999999999999999999999.0.0'};
    expect(()=>verifySignedPluginManifest(envelope(newer),options)).toThrowError(/newer host/iu);
  });

  it('rejects accessors, symbols, non-canonical time and a non-Ed25519 trusted key',()=>{
    const withAccessor=Object.defineProperty({...envelope()},'destinationPath',{enumerable:true,get:()=> 'C:/plugins'});
    expect(()=>verifySignedPluginManifest(withAccessor,options)).toThrowError(/malformed/iu);
    const withSymbol={...envelope(),[Symbol('authority')]:'hidden'};
    expect(()=>verifySignedPluginManifest(withSymbol,options)).toThrowError(/malformed/iu);
    const nonCanonical={...manifest(),issuedAt:'2026-08-15T11:00:00Z'};
    expect(()=>verifySignedPluginManifest(envelope(nonCanonical),options)).toThrowError(/time binding/iu);
    const rsa=generateKeyPairSync('rsa',{modulusLength:2048});
    expect(()=>verifySignedPluginManifest(envelope(),{...options,trustedKeys:[{keyId,
      publicKeyPem:rsa.publicKey.export({type:'spki',format:'pem'}).toString(),status:'ACTIVE'}]}))
      .toThrowError(/signature verification failed/iu);
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
